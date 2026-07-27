// ClubTool.js v5 - Template League dropdown sorted alphabetically. Height filter (v4), Nationality/Min Role Score/Scoring Mode (v2-3) kept.
import React, { useState, useMemo } from 'react';
import PlayerCard from './PlayerCard';
import { scoreBandColor, scoreLabel, formatMV, ROLE_KEY_LABELS, ROLES_BY_KEY,
         ALL_LEAGUES, LEAGUE_STRENGTHS, promotionBadge, divColor, PRESET_LEAGUES,
         HIDDEN_LEAGUES, YOUTH_LEAGUES, leagueToRegion, leagueToBand,
         POSITION_ATTRIBUTES, playerHasAttribute } from './constants';
import { Photo, Crest, useIsMobile } from './utils';

const ALL_SEASONS = ['2025-26','2024-25','2023-24','2022-23','2021-22','2020-21','2019-20','2018-19'];

// Height filter: data is stored in cm, but displayed as feet'inches (matches player card
// convention). Options generated in whole inches (58"-83" ≈ 4'10"-6'11"), each mapped to
// its cm equivalent (rounded, same rounding as the player card's own cm->feet display) so
// the filter boundary always lines up with what's actually shown for a given player.
const HEIGHT_OPTIONS = Array.from({length: 83-58+1}, (_, i) => {
  const totalInches = 58 + i;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { cm: Math.round(totalInches * 2.54), label: `${feet}'${inches}"` };
});

const METRIC_OPTIONS=[
  {label:'xG per 90',key:'xG'},{label:'xA per 90',key:'xA'},
  {label:'Goals (non-pen)',key:'Goals: Non-Penalty'},{label:'Shots per 90',key:'Shots'},
  {label:'Touches in Box',key:'Touches in Box'},{label:'Progressive Runs',key:'Progressive Runs'},
  {label:'Crosses per 90',key:'Crosses'},{label:'Pass % accuracy',key:'Pass %'},
  {label:'Passes per 90',key:'Passes'},{label:'Prog Passes',key:'Progressive Passes'},
  {label:'Dribbles per 90',key:'Dribbles'},{label:'Dribble %',key:'Dribble %'},
  {label:'Key Passes',key:'Key Passes'},{label:'Deep Completions',key:'Deep Completions'},
  {label:'Def Duel Win %',key:'Defensive Duel %'},{label:'Aerial Win %',key:'Aerial Duel %'},
  {label:'Interceptions',key:'PAdj Interceptions'},{label:'Def Duels per 90',key:'Defensive Duels'},
];

function MetricFilterRow({filter,onChange,onRemove}){
  return(
    <div style={{background:'#0d1220',border:'1px solid #1e2d45',borderRadius:6,padding:'8px',marginBottom:6}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
        <select style={{flex:1,background:'#0d1220',border:'1px solid #1e2d45',borderRadius:5,color:'#e2e8f4',padding:'5px 6px',fontSize:10.5,outline:'none'}} value={filter.key} onChange={e=>onChange({...filter,key:e.target.value,label:METRIC_OPTIONS.find(m=>m.key===e.target.value)?.label||e.target.value})}>
          <option value="">Select metric…</option>
          {METRIC_OPTIONS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <button onClick={onRemove} style={{background:'none',border:'1px solid #1e2d45',color:'#94a3b8',borderRadius:4,width:22,height:22,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:1}}>×</button>
      </div>
      {filter.key&&(<>
        <div style={{fontSize:9,color:'#94a3b8',marginBottom:2}}>Percentile: <strong style={{color:'#60a5fa'}}>{filter.min}</strong>–<strong style={{color:'#60a5fa'}}>{filter.max}</strong></div>
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
          <input type="number" min={0} max={filter.max-1} value={filter.min} onChange={e=>onChange({...filter,min:Math.min(Number(e.target.value),filter.max-1)})}
            style={{width:46,background:'#07090f',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',padding:'4px 6px',fontSize:12,fontWeight:700,textAlign:'center',outline:'none'}}/>
          <div style={{flex:1,height:2,background:'#3b7de8',borderRadius:2}}/>
          <input type="number" min={filter.min+1} max={100} value={filter.max} onChange={e=>onChange({...filter,max:Math.max(Number(e.target.value),filter.min+1)})}
            style={{width:46,background:'#07090f',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',padding:'4px 6px',fontSize:12,fontWeight:700,textAlign:'center',outline:'none'}}/>
        </div>
      </>)}
    </div>
  );
}

// Metrics used for similarity per position
const ROLE_METRICS = {
  CB: ['Aerial duels won, %','Defensive duels won, %','Accurate passes, %','Accurate forward passes, %','Progressive runs per 90','Progressive passes per 90','PAdj Interceptions','Dribbles per 90'],
  FB: ['PAdj Interceptions','Defensive duels won, %','Accurate passes, %','Dribbles per 90','Progressive runs per 90','Progressive passes per 90','Passes to final third per 90','xA per 90','Passes to penalty area per 90'],
  CM: ['PAdj Interceptions','Defensive duels won, %','Accurate passes, %','Dribbles per 90','Progressive runs per 90','Progressive passes per 90','xA per 90','Non-penalty goals per 90','xG per 90','Key passes per 90'],
  ATT: ['Accurate passes, %','Dribbles per 90','Progressive runs per 90','xA per 90','Passes to penalty area per 90','Non-penalty goals per 90','xG per 90','Touches in box per 90'],
  CF: ['Dribbles per 90','Progressive runs per 90','xA per 90','Non-penalty goals per 90','xG per 90','Touches in box per 90','Aerial duels won, %'],
};
// Maps Wyscout column names → actual g-data stored labels in players.json
const MLABEL = {
  'Aerial duels won, %':'Aerial Duel %','Aerial duels per 90':'Aerial Duels',
  'Defensive duels won, %':'Def Duel %','Defensive duels per 90':'Defensive Duels',
  'Accurate passes, %':'Pass %','Accurate forward passes, %':'Forward Pass %',
  'Progressive runs per 90':'Progressive Runs','Progressive passes per 90':'Progressive Passes',
  'PAdj Interceptions':'PAdj Interceptions','Dribbles per 90':'Dribbles',
  'Passes to final third per 90':'Passes to F3rd','xA per 90':'xA',
  'Passes to penalty area per 90':'Passes to Box','Non-penalty goals per 90':'Goals: Non-Penalty',
  'xG per 90':'xG','Key passes per 90':'Key Passes','Touches in box per 90':'Touches in Box',
  'Smart passes per 90':'Smart Passes','Crosses per 90':'Crosses',
};
// Role-specific metric weights for similarity matching
// Higher weight = more important for this role
const ROLE_WEIGHTS = {
  GK: {
    '_default': {'Prevented goals per 90':3,'Save rate, %':1,'Exits per 90':2,'Accurate passes, %':1,'Accurate long passes, %':1},
    'Shot Stopper': {'Prevented goals per 90':4,'Save rate, %':2},
    'Sweeper Keeper': {'Exits per 90':4,'Prevented goals per 90':2},
    'Ball Playing GK': {'Accurate passes, %':3,'Accurate long passes, %':3,'Passes per 90':2},
  },
  CB: {
    '_default': {'Aerial Duel %':2,'Def Duel %':2,'Pass %':1.5,'PAdj Interceptions':1.5,'Progressive Runs':1},
    'Ball Playing CB': {'Pass %':2,'Forward Pass %':2,'Progressive Passes':2,'Progressive Runs':1.5},
    'Box Defender': {'Aerial Duel %':3,'Def Duel %':4,'PAdj Interceptions':2},
    'Wide CB': {'Def Duel %':2,'Dribbles':2,'Progressive Runs':2},
  },
  FB: {
    '_default': {'Pass %':1.5,'Dribbles':1.5,'Progressive Runs':1.5,'Def Duel %':1.5,'xA':1.5,'PAdj Interceptions':1},
    'Build Up FB': {'Pass %':2,'Progressive Passes':2.5,'Progressive Runs':2,'Dribbles':2,'Passes to F3rd':2},
    'Attacking FB': {'Dribbles':3.5,'Progressive Runs':3,'xA':3,'Passes to Box':2,'Touches in Box':2},
    'Defensive FB': {'Def Duel %':3.5,'PAdj Interceptions':3,'Defensive Duels':2},
    'Wide Creator FB': {'xA':3,'Crosses':3},
    'Wide Carrier FB': {'Dribbles':3,'Progressive Runs':3},
  },
  CM: {
    '_default': {'Pass %':1.5,'PAdj Interceptions':1.5,'Progressive Runs':1.5,'xA':1.5,'Dribbles':1,'Def Duel %':1},
    'Deep Playmaker CM': {'Pass %':2,'Progressive Passes':3,'Passes to F3rd':2.5,'Forward Pass %':1.5},
    'Advanced Playmaker CM': {'xA':4,'Passes to Box':2},
    'Defensive Midfielder DM': {'Defensive Duels':4,'Def Duel %':4,'PAdj Interceptions':3},
    'Goal Threat CM': {'xG':3,'Goals: Non-Penalty':3,'Touches in Box':2},
    'Ball Carrying CM': {'Dribbles':4,'Progressive Runs':3},
    'Box-to-Box CM': {'Touches in Box':3,'Defensive Duels':3,'Goals: Non-Penalty':2},
  },
  ATT: {
    '_default': {'xG':2,'xA':2,'Dribbles':2,'Progressive Runs':1.5,'Goals: Non-Penalty':1.5},
    'Goal Threat ATT': {'xG':3,'Goals: Non-Penalty':3,'Touches in Box':2},
    'Playmaker ATT': {'xA':3,'Passes to Box':2,'Key Passes':1.5},
    'Ball Carrier ATT': {'Dribbles':4,'Progressive Runs':3},
  },
  CF: {
    '_default': {'Goals: Non-Penalty':3,'xG':3,'Touches in Box':2,'Dribbles':1.5},
    'Target Man CF': {'Aerial Duel %':5,'Aerial Duels':3},
    'Goal Threat CF': {'Goals: Non-Penalty':3,'xG':3,'Touches in Box':2},
    'Link Up CF': {'xA':3,'Passes to Box':3,'Dribbles':2,'Progressive Runs':2},
  },
};

// Short display labels for bars
const MLABEL_DISPLAY = {
  'Aerial Duel %':'Aerial %','Aerial Duels':'Aerials','Def Duel %':'Def Duel %',
  'Defensive Duels':'Def Duels','Pass %':'Pass %','Forward Pass %':'Fwd Pass %',
  'Progressive Runs':'Prog Runs','Progressive Passes':'Prog Pass',
  'PAdj Interceptions':'PAdj Int','Dribbles':'Dribbles','Passes to F3rd':'F3rd Pass',
  'xA':'xA','Passes to Box':'Box Pass','Goals: Non-Penalty':'NP Goals',
  'xG':'xG','Key Passes':'Key Pass','Touches in Box':'Box Touch',
  'Smart Passes':'Smart Pass','Crosses':'Crosses',
};

function MBar({label,pct,tmplPct,showT,weight=1}){
  const v=Math.round(pct||0),t=Math.round(tmplPct||0),diff=v-t;
  const color=v>=80?'#22c55e':v>=60?'#84cc16':v>=40?'#eab308':v>=20?'#f97316':'#ef4444';
  const isKey=weight>=2.5;
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
      <div style={{width:88,fontSize:9.5,color:isKey?'#e2e8f4':diff>10?'#4ade80':diff<-10?'#f87171':'#94a3b8',textAlign:'right',flexShrink:0,fontWeight:isKey?700:400}}>
        {isKey&&<span style={{color:'#f59e0b',marginRight:2}}>★</span>}{MLABEL_DISPLAY[MLABEL[label]]||MLABEL_DISPLAY[label]||MLABEL[label]||label}
      </div>
      <div style={{flex:1,background:'#0c1120',borderRadius:2,height:6,position:'relative'}}>
        <div style={{width:`${v}%`,height:'100%',borderRadius:2,background:color}}/>
        {showT&&<div style={{position:'absolute',top:-2,left:`${t}%`,width:2,height:10,background:'#60a5fa',borderRadius:1}}/>}
        <div style={{position:'absolute',left:'50%',top:-1,width:1,height:8,background:'#1e2d45'}}/>
      </div>
      <div style={{width:22,fontSize:9.5,fontWeight:700,color,textAlign:'right'}}>{v}</div>
      {showT&&<div style={{width:22,fontSize:9,color:diff>0?'#4ade80':'#f87171',textAlign:'right',flexShrink:0}}>{diff>0?'+':''}{diff}</div>}
    </div>
  );
}

function CandidateCard({player, tmplMetrics, rk, onUseAsTemplate, onOpenCard}){
  const [open,setOpen]=useState(false);
  // Use best season metrics if available, otherwise latest
  const matchSeason=player._matchSeason;
  const matchMets=player._matchMets;
  const sd=matchSeason?(player.seasonsDetail||{})[matchSeason]||{}:Object.values(player.seasonsDetail||{})[0]||{};
  const g=sd.g||{};
  const allM=matchMets?.length?matchMets:[...(g.A||[]),...(g.D||[]),...(g.P||[])];
  const mKeys=ROLE_METRICS[rk]||[];
  const dScore=player._displayScore??player.careerScore;
  const promo=promotionBadge(dScore,player.league);
  const ms=player._matchScore;

  return(
    <div style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:9,padding:'12px',cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <Photo name={player.name} team={player.team} size={36}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',marginBottom:2}}>
            <span style={{fontWeight:700,color:'#e2e8f4',fontSize:12}}>{player.name}</span>
            {player.side&&player.side!=='C'&&<span style={{padding:'1px 4px',borderRadius:3,background:'#0e1e38',color:'#93c5fd',fontSize:9,fontWeight:700}}>{player.side==='L'?'Left':'Right'}</span>}
            {promo&&<span style={{padding:'1px 4px',borderRadius:3,background:'#14532d',color:'#22c55e',fontSize:9,fontWeight:700}}>{promo}</span>}
            {matchSeason&&<span style={{padding:'1px 4px',borderRadius:3,background:'#1a1a0e',color:'#f59e0b',fontSize:9,fontWeight:700}}>Best: {matchSeason}</span>}
          </div>
          <div style={{fontSize:10,color:'#64748b'}}>{player.team} · {player.league} · Age {player.age}</div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          {ms!=null&&<div style={{fontSize:16,fontWeight:800,color:ms>=70?'#22c55e':ms>=50?'#f59e0b':'#64748b'}}>{Math.round(ms)}%</div>}
          <div style={{fontSize:11,fontWeight:700,color:scoreBandColor(dScore)}}>{dScore.toFixed(1)}</div>
          <div style={{fontSize:8,color:'#64748b'}}>{scoreLabel(dScore)}</div>
        </div>
        <Crest id={player.teamFotmobId} name={player.team} size={20}/>
      </div>

      {open&&(
        <div style={{borderTop:'1px solid #131c2e',paddingTop:10,marginTop:10}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:10,color:'#64748b',marginBottom:8}}>
            {[['Peak',player.peakScore?.toFixed(1),'#94a3b8'],['Pot',(player.potentialScore||player.careerScore).toFixed(1),'#22c55e'],['Seasons',player.seasons,'#94a3b8'],[formatMV(player.marketValue)||null,null,'#94a3b8'],['xVal',formatMV(player.xValue)||null,'#93c5fd'],['Cont',player.contract&&player.contract!=='nan'?player.contract:null,player.contractYear<=2026?'#fbbf24':'#94a3b8'],[player.foot&&player.foot!=='unknown'?player.foot:null,null,'#94a3b8']].map(([k,v,c],i)=>
              k&&k!=='nan'?<span key={i}>{k}{v?`: `+v:''}<span style={{color:c}}></span></span>:null
            ).filter(Boolean)}
            {player.marketValue>0&&<span>MV: <strong style={{color:'#94a3b8'}}>{formatMV(player.marketValue)}</strong></span>}
            {player.xValue>0&&<span>xVal: <strong style={{color:'#93c5fd'}}>{formatMV(player.xValue)}</strong></span>}
            {player.contract&&player.contract!=='nan'&&<span>Cont: <strong style={{color:player.contractYear<=2026?'#fbbf24':'#94a3b8'}}>{player.contract}</strong></span>}
            {player.foot&&player.foot!=='unknown'&&player.foot!=='nan'&&<span>Foot: <strong style={{color:'#94a3b8'}}>{player.foot}</strong></span>}
          </div>
          {mKeys.length>0&&allM.length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{fontSize:8,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>Metrics vs Template — blue line = template</div>
              {mKeys.map(mk=>{
                const found=allM.find(x=>x[0]===(MLABEL[mk]||mk)||x[0]===mk);
                const tf=tmplMetrics?.find(x=>x[0]===(MLABEL[mk]||mk)||x[0]===mk);
                if(!found) return null;
                const roleWts=(ROLE_WEIGHTS[rk]||{})[player._matchRole||'_default']||(ROLE_WEIGHTS[rk]||{})['_default']||{};
                const w=roleWts[mk]||1;
                return <MBar key={mk} label={mk} pct={found[1]} tmplPct={tf?.[1]} showT={!!tf} weight={w}/>;
              })}
            </div>
          )}
          <div style={{display:'flex',gap:6}}>
            <button onClick={e=>{e.stopPropagation();onOpenCard&&onOpenCard(player);}} style={{padding:'4px 10px',background:'#0e2040',border:'1px solid #22c55e',borderRadius:5,color:'#4ade80',fontSize:10,fontWeight:600,cursor:'pointer'}}>
              View Profile
            </button>
            <button onClick={e=>{e.stopPropagation();onUseAsTemplate(player);}} style={{padding:'4px 10px',background:'#0e2040',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',fontSize:10,fontWeight:600,cursor:'pointer'}}>
              Use as template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const T={
  sel:{width:'100%',background:'#0d1220',border:'1px solid #1e2d45',borderRadius:5,color:'#e2e8f4',padding:'6px 7px',appearance:'none',cursor:'pointer',outline:'none',fontSize:11.5},
  fl:{fontSize:9,fontWeight:700,color:'#94a3b8',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4,display:'block'},
  fg:{marginBottom:12},
  cb:(on)=>({width:13,height:13,borderRadius:2,flexShrink:0,border:`1px solid ${on?'#3b7de8':'#475569'}`,background:on?'#3b7de8':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}),
  cl:(on)=>({fontSize:11,color:on?'#e2e8f4':'#94a3b8'}),
  cr:{display:'flex',alignItems:'center',gap:6,cursor:'pointer',marginBottom:4},
  // --- mobile-only. Unreferenced unless isMobile is true, so desktop is unchanged. ---
  cfgMobile:{position:'fixed',top:0,left:0,bottom:0,width:'88vw',maxWidth:340,zIndex:300,background:'#07090f',borderRight:'1px solid #1e2d45',overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'14px 12px',boxSizing:'border-box',boxShadow:'0 0 40px rgba(0,0,0,.7)'},
  scrim:{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:290},
  fab:{position:'fixed',left:12,bottom:16,zIndex:280,padding:'11px 16px',borderRadius:22,border:'1px solid #26456f',background:'#12203a',color:'#dbeafe',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 6px 20px rgba(0,0,0,.5)'},
};

export default function ClubTool({players}){
  const isMobile=useIsMobile();
  // The 264px config column beside the results grid leaves almost nothing for results
  // on a phone, so on mobile it becomes an off-canvas drawer behind a Setup button.
  const [cfgOpen,setCfgOpen]=useState(false);
  const [selCard,setSelCard]=useState(null);
  const [tmplLeague,setTmplLeague]=useState('England 2.');
  const [tmplTeam,setTmplTeam]=useState('');
  const [tmplSeason,setTmplSeason]=useState('2024-25');
  const [pos,setPos]=useState('FB');
  const [role,setRole]=useState('');
  const [tmplMode,setTmplMode]=useState('average'); // 'average'|'player'
  const [tmplPlayer,setTmplPlayer]=useState('');
  const [ageMax,setAgeMax]=useState(27);
  const [minScore,setMinScore]=useState(0);
  const [leaguePenalty,setLeaguePenalty]=useState(true);
  const [sideFilter,setSideFilter]=useState('Any'); // 'Any'|'L'|'R'|'C'
  const [footFilter,setFootFilter]=useState('Any');
  const [activePreset,setActivePreset]=useState('');
  const [activeBands,setActiveBands]=useState(new Set());
  const [activeRegions,setActiveRegions]=useState(new Set());
  const [showHidden,setShowHidden]=useState(false);
  const [showYouth,setShowYouth]=useState(false);
  const [smartFilter,setSmartFilter]=useState(true);
  const searchLeagues=useMemo(()=>{
    if(showYouth) return new Set(YOUTH_LEAGUES);
    let base;
    if(activePreset&&PRESET_LEAGUES[activePreset]) base=new Set(PRESET_LEAGUES[activePreset]);
    else if(activeBands.size>0||activeRegions.size>0){
      base=new Set(ALL_LEAGUES.filter(l=>{
        const bandOk=activeBands.size===0||activeBands.has(leagueToBand(l));
        const regionOk=activeRegions.size===0||activeRegions.has(leagueToRegion(l));
        return bandOk&&regionOk;
      }));
    } else base=new Set(ALL_LEAGUES);
    if(showHidden)[...HIDDEN_LEAGUES].forEach(l=>base.add(l));
    return base;
  },[activePreset,activeBands,activeRegions,showHidden,showYouth]);
  const [tmplMetrics,setTmplMetrics]=useState([]);
  const [tmplInfo,setTmplInfo]=useState(null);
  const [results,setResults]=useState([]);
  const [ran,setRan]=useState(false);
  const [attrFilters,setAttrFilters]=useState(new Set());
  const [softMode,setSoftMode]=useState(false);
  const [xValueOnly,setXValueOnly]=useState(false);
  const [xValueFilter,setXValueFilter]=useState('');
  const [showXValueFilter,setShowXValueFilter]=useState(false);
  const [xValueMin,setXValueMin]=useState(0);
  const [xValueMax,setXValueMax]=useState(50);
  const [potentialMin,setPotentialMin]=useState(40);
  const [played2526,setPlayed2526]=useState(false);
  const [metricFilters,setMetricFilters]=useState([]);
  const [bestSeasonMode,setBestSeasonMode]=useState(false);
  const [ageMin,setAgeMin]=useState(15);
  const [heightMin,setHeightMin]=useState(152); // 5'0"
  const [heightMax,setHeightMax]=useState(211); // 6'11"
  const [minMins,setMinMins]=useState(0);
  const [minSeas,setMinSeas]=useState(1);
  const [showMvFilter,setShowMvFilter]=useState(false);
  const [mvMax,setMvMax]=useState(50);
  const [showContractFilter,setShowContractFilter]=useState(false);
  const [contractBefore,setContractBefore]=useState(2028);
  const [lsMin,setLsMin]=useState(0);
  const [lsMax,setLsMax]=useState(101);
  const [escOnly,setEscOnly]=useState(false);
  const [gbeMin,setGbeMin]=useState(0);
  const [currentLeagueOnly,setCurrentLeagueOnly]=useState(false);
  const [natFilter,setNatFilter]=useState('');
  const [roleScoreFilter,setRoleScoreFilter]=useState(''); // role to require a min score in (independent of `role`, which weights template similarity)
  const [roleScoreMin,setRoleScoreMin]=useState(50);
  const [scoreMode,setScoreMode]=useState('complete'); // 'complete' or a specific role name — swaps the score shown/filtered on candidate cards
  const addMetricFilter=()=>{if(metricFilters.length<10)setMetricFilters(f=>[...f,{key:'',label:'',min:0,max:100}]);};

  // Teams for selected league - from players who played in that season
  const teams=useMemo(()=>{
    const ts=new Set(
      players
        .filter(p=>p.roleKey===pos)
        .flatMap(p=>p.allSeasonsSummary||[])
        .filter(s=>s.l===tmplLeague&&s.s===tmplSeason)
        .map(s=>s.team)
    );
    // Also check seasonsDetail
    players.filter(p=>p.roleKey===pos).forEach(p=>{
      const sd=(p.seasonsDetail||{})[tmplSeason];
      if(sd&&sd.league===tmplLeague) ts.add(sd.team||p.team);
    });
    return [...ts].sort();
  },[players,tmplLeague,tmplSeason,pos]);

  // Players at template team in template season
  const tmplPlayers=useMemo(()=>{
    return players.filter(p=>{
      if(p.roleKey!==pos) return false;
      const sd=(p.seasonsDetail||{})[tmplSeason];
      if(sd&&(sd.team===tmplTeam||p.team===tmplTeam)&&sd.league===tmplLeague) return true;
      // Check allSeasonsSummary
      return (p.allSeasonsSummary||[]).some(s=>s.s===tmplSeason&&s.l===tmplLeague&&s.team===tmplTeam);
    }).sort((a,b)=>b.careerScore-a.careerScore);
  },[players,tmplLeague,tmplTeam,tmplSeason,pos]);

  // Get metrics from latest seasonsDetail
  const getMetrics=(player)=>{
    // Try the template season first, then latest
    const sd=(player.seasonsDetail||{})[tmplSeason]||(Object.values(player.seasonsDetail||{})[0]||{});
    const g=sd.g||{};
    return [...(g.A||[]),...(g.D||[]),...(g.P||[])];
  };

  const computeMatch=(candMets,tmplMets,candLeague)=>{
    const keys=ROLE_METRICS[pos]||[];
    // Get role-specific weights
    const roleWts = role
      ? (ROLE_WEIGHTS[pos]||{})[role]||(ROLE_WEIGHTS[pos]||{})['_default']||{}
      : (ROLE_WEIGHTS[pos]||{})['_default']||{};

    let sumSq=0,totalW=0;
    for(const mk of keys){
      const lbl=MLABEL[mk]||mk;
      const c=candMets.find(x=>x[0]===lbl||x[0]===mk);
      const t=tmplMets.find(x=>x[0]===lbl||x[0]===mk);
      if(c&&t){
        // Weight: role-specific or default 1.0
        const w=roleWts[mk]||roleWts[lbl]||1.0;
        sumSq+=w*(c[1]-t[1])**2;
        totalW+=w;
      }
    }
    if(!totalW) return null;
    let dist=Math.sqrt(sumSq/totalW);
    if(leaguePenalty){
      const tls=LEAGUE_STRENGTHS[tmplLeague]||50;
      const cls=LEAGUE_STRENGTHS[candLeague]||50;
      dist+=Math.abs(tls-cls)/100*15;
    }
    return Math.max(0,Math.round(100-dist*1.8));
  };

  const run=()=>{
    if(!tmplTeam){alert('Please select a template team');return;}
    let tmplMets=[],tmplInf=null;

    if(tmplMode==='player'&&tmplPlayer){
      const tp=players.find(p=>p.name===tmplPlayer);
      if(tp){
        tmplMets=getMetrics(tp);
        tmplInf={name:tp.name,score:tp.careerScore,season:tmplSeason,league:tmplLeague};
      }
    } else {
      // Average of all template players with metric data in that season
      const eligible=tmplPlayers.filter(p=>getMetrics(p).length>0);
      if(!eligible.length){setRan(true);setResults([]);setTmplInfo({name:`${tmplTeam} (no metric data for ${tmplSeason})`,score:null});return;}
      const allM=eligible.map(p=>getMetrics(p));
      const allKeys=[...new Set(allM.flatMap(m=>m.map(x=>x[0])))];
      tmplMets=allKeys.map(key=>{
        const vals=allM.map(m=>m.find(x=>x[0]===key)?.[1]).filter(v=>v!=null);
        return [key,vals.length?vals.reduce((a,b)=>a+b)/vals.length:50,null];
      });
      tmplInf={name:`${tmplTeam} ${ROLE_KEY_LABELS[pos]} avg (${tmplSeason})`,score:null,league:tmplLeague};
    }

    setTmplMetrics(tmplMets);
    setTmplInfo(tmplInf);

    // Smart league filter - restrict to sensible levels, THEN intersect with user checkboxes
    const tmplLs = LEAGUE_STRENGTHS[tmplLeague]||50;
    const smartLeagues = new Set(ALL_LEAGUES.filter(l=>{
      const ls = LEAGUE_STRENGTHS[l]||0;
      return Math.abs(ls-tmplLs)<=35 || ls>=tmplLs;
    }));
    // Always respect user's checkbox selection; smart filter only restricts further when on
    const effectiveLeagues = smartFilter
      ? new Set([...searchLeagues].filter(l=>smartLeagues.has(l)))
      : searchLeagues;

    const getDisplayScore=(p)=>scoreMode!=='complete' ? ((p.roleCareerScores||{})[scoreMode]??null) : p.careerScore;

    const cands=players.filter(p=>{
      if(p.roleKey!==pos) return false;
      if(p.team===tmplTeam&&p.league===tmplLeague) return false;
      if(!(smartFilter?effectiveLeagues:searchLeagues).has(p.league)) return false;
      if(p.age<ageMin||p.age>ageMax) return false;
      if(p.height&&(p.height<heightMin||p.height>heightMax)) return false;
      const ds=getDisplayScore(p);
      if(scoreMode!=='complete'&&ds==null) return false;
      if(minScore>0&&(ds??p.careerScore)<minScore) return false;
      if(minSeas>1&&(p.seasons||1)<minSeas) return false;
      if(minMins>0&&(p.minutesLatest||0)<minMins) return false;
      if(potentialMin>40&&(p.potentialScore||p.careerScore)<potentialMin) return false;
      if(played2526&&!p.sh?.find(x=>x.s==='2025-26'||x.s==='2026')) return false;
      if(showMvFilter&&p.marketValue>mvMax*1000000) return false;
      if(showContractFilter&&p.contractYear&&p.contractYear>0&&p.contractYear>contractBefore) return false;
      const pls=LEAGUE_STRENGTHS[p.league]||0;
      if(pls<lsMin||pls>lsMax) return false;
      if(escOnly&&!p.escEligible) return false;
      if(gbeMin>0&&(p.gbeTotal||0)<gbeMin) return false;
      if(natFilter&&!(p.passportCountries||'').toLowerCase().includes(natFilter.toLowerCase())&&!(p.birthCountry||'').toLowerCase().includes(natFilter.toLowerCase())) return false;
      if(roleScoreFilter){
        const rs=(p.roleCareerScores||{})[roleScoreFilter]||0;
        if(roleScoreMin>0&&rs<roleScoreMin) return false;
        if(!roleScoreMin&&!rs) return false;
      }
      if(role&&!(p.roleCareerScores||{})[role]) return false;
      if(sideFilter!=='Any'&&p.side&&p.side!=='C'&&p.side!==sideFilter) return false;
      if(footFilter!=='Any'&&p.foot&&p.foot!=='unknown'&&p.foot!=='nan'&&p.foot!==footFilter) return false;
      if(xValueOnly&&!(p.xValueGapPct>15&&p.marketValue>0)) return false;
      if(xValueFilter==='undervalued'&&!(p.xValueGapPct>20&&p.marketValue>0)) return false;
      if(xValueFilter==='gems'&&!(p.xValueGapPct>50&&p.marketValue>0)) return false;
      if(xValueFilter==='overvalued'&&!(p.xValueGapPct<-20&&p.marketValue>0)) return false;
      if(showXValueFilter&&p.xValue&&p.xValue<xValueMin*1000000) return false;
      if(showXValueFilter&&xValueMax<50&&p.xValue&&p.xValue>xValueMax*1000000) return false;
      const sdEntries=p.seasonsDetail||{};
      const sd=sdEntries['2025-26']||sdEntries['2026']||sdEntries['2025']||Object.values(sdEntries)[0]||{};
      for(const mf of metricFilters){
        if(!mf.key) continue;
        let found=null;
        for(const grp of ['A','D','P']){const f=(sd.g?.[grp]||[]).find(x=>x[0]===mf.key);if(f){found=f;break;}}
        if(!found) continue;
        if(found[1]<mf.min||found[1]>mf.max) return false;
      }
      // Attribute filters
      if(attrFilters.size>0){
        const g=sd.g||{};
        const posAttrs=POSITION_ATTRIBUTES[p.roleKey]||[];
        for(const key of attrFilters){
          const attr=posAttrs.find(a=>a.key===key);
          if(attr){
            const adj=softMode?{...attr,tests:attr.tests.map(t=>({...t,p:Math.max(0,t.p-10)}))}:attr;
            if(!playerHasAttribute(adj,g)) return false;
          }
        }
      }
      return true;
    });

    const scored=cands.map(p=>{
      let bestMatch=null,bestSeason=null,bestMets=[];
      if(bestSeasonMode){
        for(const [s,sd] of Object.entries(p.seasonsDetail||{})){
          const g=sd.g||{};
          const mets=[...(g.A||[]),...(g.D||[]),...(g.P||[])];
          if(!mets.length) continue;
          const match=computeMatch(mets,tmplMets,sd.league||p.league);
          if(match!=null&&(bestMatch===null||match>bestMatch)){
            bestMatch=match;bestSeason=s;bestMets=mets;
          }
        }
      } else {
        bestMets=getMetrics(p);
        bestMatch=computeMatch(bestMets,tmplMets,p.league);
      }
      return{...p,_matchScore:bestMatch,_matchRole:role||'_default',_matchSeason:bestSeason,_matchMets:bestMets,_displayScore:getDisplayScore(p)??p.careerScore};
    }).filter(p=>p._matchScore!=null&&p._matchScore>0)
      .sort((a,b)=>b._matchScore-a._matchScore)
      .slice(0,60);

    setResults(scored);
    setRan(true);
  };

  const useAsTemplate=(p)=>{
    setTmplLeague(p.league);
    setTmplTeam(p.team);
    setPos(p.roleKey);
    setTmplMode('player');
    setTmplPlayer(p.name);
    setResults([]);setRan(false);
  };

  return(
    <>
    <div style={{display:'flex',gap:0,flex:1,minHeight:0}}>
      {isMobile&&cfgOpen&&<div style={T.scrim} onClick={()=>setCfgOpen(false)}/>}
      {/* Config */}
      {(!isMobile||cfgOpen)&&(
      <div style={isMobile?T.cfgMobile:{width:264,flexShrink:0,background:'#07090f',borderRight:'1px solid #1e2d45',overflowY:'auto',padding:'14px 12px',scrollbarWidth:'thin',scrollbarColor:'#1e2d45 #07090f'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:800,color:'#e2e8f4'}}>Club Recruitment Tool</div>
          {isMobile&&<button onClick={()=>setCfgOpen(false)} style={{padding:'6px 14px',borderRadius:6,border:'1px solid #26456f',background:'#12203a',color:'#dbeafe',fontSize:12,fontWeight:700,cursor:'pointer'}}>Done</button>}
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Template League</span>
          <select style={T.sel} value={tmplLeague} onChange={e=>{setTmplLeague(e.target.value);setTmplTeam('');setRan(false);}}>
            {[...ALL_LEAGUES].sort((a,b)=>a.localeCompare(b)).map(l=><option key={l}>{l}</option>)}
          </select>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Template Season</span>
          <select style={T.sel} value={tmplSeason} onChange={e=>{setTmplSeason(e.target.value);setTmplTeam('');setRan(false);}}>
            {ALL_SEASONS.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Template Team</span>
          <select style={T.sel} value={tmplTeam} onChange={e=>{setTmplTeam(e.target.value);setTmplPlayer('');setRan(false);}}>
            <option value="">Select team…</option>
            {teams.map(t=><option key={t}>{t}</option>)}
          </select>
          {tmplTeam&&tmplPlayers.length===0&&<div style={{fontSize:9,color:'#f87171',marginTop:3}}>No {ROLE_KEY_LABELS[pos]}s found for this team/season</div>}
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Position</span>
          <select style={T.sel} value={pos} onChange={e=>{setPos(e.target.value);setRole('');setTmplPlayer('');setRan(false);setScoreMode('complete');setRoleScoreFilter('');}}>
            {Object.entries(ROLE_KEY_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {(ROLES_BY_KEY[pos]||[]).length>0&&(
          <div style={T.fg}>
            <span style={T.fl}>Role (optional)</span>
            <select style={T.sel} value={role} onChange={e=>setRole(e.target.value)}>
              <option value="">Any role</option>
              {(ROLES_BY_KEY[pos]||[]).map(r=><option key={r}>{r}</option>)}
            </select>
            <div style={{fontSize:9,color:'#475569',marginTop:2}}>Weights which stats matter most for similarity matching.</div>
          </div>
        )}

        {(ROLES_BY_KEY[pos]||[]).length>0&&(<>
          <div style={T.fg}>
            <span style={T.fl}>Scoring Mode</span>
            <select style={T.sel} value={scoreMode} onChange={e=>setScoreMode(e.target.value)}>
              <option value="complete">Complete Score</option>
              {(ROLES_BY_KEY[pos]||[]).map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            {scoreMode!=='complete'&&<div style={{fontSize:9,color:'#60a5fa',marginTop:3}}>Candidate cards show {scoreMode} score instead of complete score.</div>}
          </div>
          <div style={T.fg}>
            <span style={T.fl}>Filter by Role Score</span>
            <select style={T.sel} value={roleScoreFilter} onChange={e=>setRoleScoreFilter(e.target.value)}>
              <option value="">Any role</option>
              {(ROLES_BY_KEY[pos]||[]).map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          {roleScoreFilter&&(
            <div style={T.fg}>
              <span style={T.fl}>Min {roleScoreFilter}: <strong style={{color:'#60a5fa'}}>{roleScoreMin}</strong></span>
              <input type="range" min={40} max={95} step={1} value={roleScoreMin} onChange={e=>setRoleScoreMin(Number(e.target.value))} style={{width:'100%',accentColor:'#3b7de8'}}/>
            </div>
          )}
        </>)}

        {/* Side filter for FB and ATT */}
        {(pos==='FB'||pos==='ATT'||pos==='CF')&&(
          <div style={T.fg}>
            <span style={T.fl}>{pos==='FB'?'Side (LB/RB)':'Side (LW/RW)'}</span>
            <div style={{display:'flex',gap:4}}>
              {['Any','L','R'].map(s=>(
                <button key={s} onClick={()=>setSideFilter(s)} style={{flex:1,padding:'5px',borderRadius:5,border:`1px solid ${sideFilter===s?'#3b7de8':'#1e2d45'}`,background:sideFilter===s?'#0e2040':'transparent',color:sideFilter===s?'#60a5fa':'#94a3b8',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  {s==='Any'?'Any':s==='L'?pos==='FB'?'Left Back':'Left Wing':pos==='FB'?'Right Back':'Right Wing'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={T.fg}>
          <span style={T.fl}>Preferred Foot</span>
          <select style={T.sel} value={footFilter} onChange={e=>setFootFilter(e.target.value)}>
            {['Any','left','right','both'].map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
          </select>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Height</span>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <select style={{...T.sel,flex:1,width:0}} value={heightMin} onChange={e=>setHeightMin(Number(e.target.value))}>
              {HEIGHT_OPTIONS.map(o=><option key={o.cm} value={o.cm}>{o.label}</option>)}
            </select>
            <span style={{color:'#475569',fontSize:10}}></span>
            <select style={{...T.sel,flex:1,width:0}} value={heightMax} onChange={e=>setHeightMax(Number(e.target.value))}>
              {HEIGHT_OPTIONS.map(o=><option key={o.cm} value={o.cm}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {(POSITION_ATTRIBUTES[pos]||[]).length>0&&(
          <div style={T.fg}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
              <span style={T.fl}>Attributes ({attrFilters.size} active)</span>
              {attrFilters.size>0&&<button onClick={()=>setAttrFilters(new Set())} style={{fontSize:8,padding:'1px 5px',borderRadius:3,border:'1px solid #1e2d45',background:'transparent',color:'#f87171',cursor:'pointer'}}>Clear</button>}
              <label style={{...T.cr,marginLeft:'auto'}} onClick={()=>setSoftMode(p=>!p)}>
                <div style={T.cb(softMode)}>{softMode&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
                <span style={T.cl(softMode)}>Soft (-10%)</span>
              </label>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {(POSITION_ATTRIBUTES[pos]||[]).map(attr=>{
                const on=attrFilters.has(attr.key);
                return(
                  <button key={attr.key} onClick={()=>setAttrFilters(p=>{const n=new Set(p);n.has(attr.key)?n.delete(attr.key):n.add(attr.key);return n;})}
                    style={{padding:'3px 7px',borderRadius:12,border:`1px solid ${on?'#3b7de8':'#1e2d45'}`,background:on?'#0e2040':'transparent',color:on?'#60a5fa':'#64748b',fontSize:9.5,fontWeight:on?700:400,cursor:'pointer'}}>
                    {attr.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}} onClick={()=>setPlayed2526(p=>!p)}>
            <div style={T.cb(played2526)}>{played2526&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
            <span style={{fontSize:11,color:played2526?'#e2e8f4':'#94a3b8'}}>Played in 2025-26 only</span>
          </label>
        </div>
        <div style={T.fg}>
          <span style={T.fl}>Min Potential: <strong style={{color:'#60a5fa'}}>{potentialMin<=40?'Any':potentialMin}</strong></span>
          <input type="range" min={40} max={90} step={1} value={potentialMin} onChange={e=>setPotentialMin(Number(e.target.value))} style={{width:'100%',accentColor:'#3b7de8'}}/>
        </div>
        <div style={T.fg}>
          <span style={T.fl}>xValue Gap Filter</span>
          <select style={T.sel} value={xValueFilter} onChange={e=>setXValueFilter(e.target.value)}>
            <option value="">All players</option>
            <option value="undervalued">Undervalued (xVal &gt; MV 20%+)</option>
            <option value="gems">Hidden Gems (xVal &gt; MV 50%+)</option>
            <option value="overvalued">Overvalued (MV &gt; xVal 20%+)</option>
          </select>
        </div>
        <div style={T.fg}>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',marginBottom:4}} onClick={()=>setShowXValueFilter(p=>!p)}>
            <div style={T.cb(showXValueFilter)}>{showXValueFilter&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
            <span style={{fontSize:11,color:showXValueFilter?'#e2e8f4':'#94a3b8'}}>Filter by xValue range</span>
          </label>
          {showXValueFilter&&(
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                <span style={{fontSize:8,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.08em'}}>Min £m</span>
                <input type="number" min={0} max={xValueMax-1} step={0.5} value={xValueMin} onChange={e=>setXValueMin(Number(e.target.value))}
                  style={{width:52,background:'#07090f',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',padding:'4px 6px',fontSize:12,fontWeight:700,textAlign:'center',outline:'none'}}/>
              </div>
              <div style={{flex:1,height:2,background:'#3b7de8',borderRadius:2,marginTop:10}}/>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                <span style={{fontSize:8,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.08em'}}>Max £m</span>
                <input type="number" min={xValueMin+1} max={200} step={0.5} value={xValueMax} onChange={e=>setXValueMax(Number(e.target.value))}
                  style={{width:52,background:'#07090f',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',padding:'4px 6px',fontSize:12,fontWeight:700,textAlign:'center',outline:'none'}}/>
              </div>
            </div>
          )}
        </div>
        <div style={T.fg}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
            <span style={T.fl}>Metric Filters ({metricFilters.length}/10)</span>
            {metricFilters.length<10&&<button onClick={addMetricFilter} style={{fontSize:9,padding:'2px 8px',borderRadius:3,border:'1px solid #1e3d7a',background:'#0e2040',color:'#93c5fd',cursor:'pointer',fontWeight:700}}>+ Add</button>}
          </div>
          {metricFilters.map((mf,i)=>(
            <MetricFilterRow key={i} filter={mf}
              onChange={v=>setMetricFilters(f=>{const n=[...f];n[i]=v;return n;})}
              onRemove={()=>setMetricFilters(f=>f.filter((_,j)=>j!==i))}/>
          ))}
        </div>
        <div style={T.fg}>
          <span style={T.fl}>Template Mode</span>
          <div style={{display:'flex',gap:4}}>
            {[['average','Team Average'],['player','Specific Player']].map(([v,l])=>(
              <button key={v} onClick={()=>{setTmplMode(v);setRan(false);}} style={{flex:1,padding:'5px',borderRadius:5,border:`1px solid ${tmplMode===v?'#3b7de8':'#1e2d45'}`,background:tmplMode===v?'#0e2040':'transparent',color:tmplMode===v?'#60a5fa':'#94a3b8',fontSize:9.5,fontWeight:600,cursor:'pointer'}}>{l}</button>
            ))}
          </div>
        </div>

        {tmplMode==='player'&&tmplTeam&&(
          <div style={T.fg}>
            <span style={T.fl}>Template Player ({tmplPlayers.length} eligible)</span>
            <select style={T.sel} value={tmplPlayer} onChange={e=>setTmplPlayer(e.target.value)}>
              <option value="">Select player…</option>
              {tmplPlayers.map(p=><option key={p.name} value={p.name}>{p.name} ({p.careerScore.toFixed(1)})</option>)}
            </select>
          </div>
        )}

        <div style={{height:1,background:'#131c2e',margin:'4px 0 12px'}}/>

        <div style={T.fg}>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}} onClick={()=>setBestSeasonMode(p=>!p)}>
            <div style={T.cb(bestSeasonMode)}>{bestSeasonMode&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
            <span style={{fontSize:11,color:bestSeasonMode?'#e2e8f4':'#94a3b8'}}>Best season match</span>
          </label>
          <div style={{fontSize:9,color:'#475569',marginTop:2}}>Scores each candidate on their best-ever matching season, not just latest. Finds players who've played this way before.</div>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Age: <strong style={{color:'#60a5fa'}}>{ageMin}–{ageMax}</strong></span>
          <div style={{display:'flex',gap:6}}>
            <input type="range" min={15} max={ageMax-1} value={ageMin} onChange={e=>setAgeMin(Number(e.target.value))} style={{flex:1,accentColor:'#3b7de8'}}/>
            <input type="range" min={ageMin+1} max={45} value={ageMax} onChange={e=>setAgeMax(Number(e.target.value))} style={{flex:1,accentColor:'#3b7de8'}}/>
          </div>
        </div>
        <div style={T.fg}>
          <span style={T.fl}>Min Career Score: <strong style={{color:'#60a5fa'}}>{minScore||'Any'}</strong></span>
          <input type="range" min={0} max={90} step={1} value={minScore} onChange={e=>setMinScore(Number(e.target.value))} style={{width:'100%',accentColor:'#3b7de8'}}/>
        </div>
        <div style={T.fg}>
          <span style={T.fl}>Min Seasons: <strong style={{color:'#60a5fa'}}>{minSeas}</strong></span>
          <input type="range" min={1} max={8} step={1} value={minSeas} onChange={e=>setMinSeas(Number(e.target.value))} style={{width:'100%',accentColor:'#3b7de8'}}/>
        </div>
        <div style={T.fg}>
          <span style={T.fl}>Min Minutes</span>
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
            {[0,200,400,500,750,1000].map(v=>(
              <button key={v} onClick={()=>setMinMins(v)} style={{padding:'3px 7px',borderRadius:5,border:`1px solid ${minMins===v?'#3b7de8':'#1e2d45'}`,background:minMins===v?'#0e2040':'transparent',color:minMins===v?'#60a5fa':'#64748b',fontSize:9.5,cursor:'pointer'}}>{v||'Any'}</button>
            ))}
          </div>
        </div>
        <div style={T.fg}>
          <label style={T.cr} onClick={()=>setShowMvFilter(p=>!p)}>
            <div style={T.cb(showMvFilter)}>{showMvFilter&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
            <span style={T.cl(showMvFilter)}>Max Market Value</span>
          </label>
          {showMvFilter&&<>
            <span style={{fontSize:10,color:'#64748b',marginTop:4,display:'block'}}>Max: <strong style={{color:'#60a5fa'}}>£{mvMax}m</strong></span>
            <input type="range" min={1} max={200} step={1} value={mvMax} onChange={e=>setMvMax(Number(e.target.value))} style={{width:'100%',accentColor:'#3b7de8'}}/>
          </>}
        </div>
        <div style={T.fg}>
          <label style={T.cr} onClick={()=>setShowContractFilter(p=>!p)}>
            <div style={T.cb(showContractFilter)}>{showContractFilter&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
            <span style={T.cl(showContractFilter)}>Contract expires before</span>
          </label>
          {showContractFilter&&<>
            <span style={{fontSize:10,color:'#64748b',marginTop:4,display:'block'}}><strong style={{color:'#60a5fa'}}>{contractBefore}</strong></span>
            <input type="range" min={2025} max={2032} step={1} value={contractBefore} onChange={e=>setContractBefore(Number(e.target.value))} style={{width:'100%',accentColor:'#3b7de8'}}/>
          </>}
        </div>
        <div style={T.fg}>
          <span style={T.fl}>League Strength: <strong style={{color:'#60a5fa'}}>{lsMin}–{lsMax}</strong></span>
          <div style={{display:'flex',gap:6}}>
            <input type="range" min={0} max={101} step={1} value={lsMin} onChange={e=>setLsMin(Number(e.target.value))} style={{flex:1,accentColor:'#3b7de8'}}/>
            <input type="range" min={0} max={101} step={1} value={lsMax} onChange={e=>setLsMax(Number(e.target.value))} style={{flex:1,accentColor:'#3b7de8'}}/>
          </div>
        </div>
        <div style={T.fg}>
          <label style={T.cr} onClick={()=>setEscOnly(p=>!p)}>
            <div style={T.cb(escOnly)}>{escOnly&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
            <span style={T.cl(escOnly)}>ESC eligible only</span>
          </label>
          <div style={{marginTop:6}}>
            <div style={{fontSize:10,color:'#94a3b8',marginBottom:3}}>MIN GBE POINTS</div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {[0,5,10,15,20,25].map(v=>(
                <span key={v} onClick={()=>setGbeMin(v)} style={{padding:'2px 7px',borderRadius:4,fontSize:10,cursor:'pointer',background:gbeMin===v?'#3b82f6':'#1e293b',color:gbeMin===v?'#fff':'#94a3b8',border:`1px solid ${gbeMin===v?'#3b82f6':'#334155'}`}}>{v===0?'Any':v+'+'}</span>
              ))}
            </div>
          </div>
          <div style={{marginTop:6}}>
            <div style={{fontSize:10,color:'#94a3b8',marginBottom:3}}>NATIONALITY</div>
            <input value={natFilter} onChange={e=>setNatFilter(e.target.value)} placeholder="e.g. France, Brazil" style={{width:'100%',background:'#1e293b',border:'1px solid #334155',borderRadius:4,padding:'4px 7px',fontSize:10,color:'#e2e8f4',outline:'none'}}/>
          </div>
        </div>

        <div style={T.fg}>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}} onClick={()=>setSmartFilter(p=>!p)}>
            <div style={T.cb(smartFilter)}>{smartFilter&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
            <span style={{fontSize:11,color:smartFilter?'#e2e8f4':'#94a3b8'}}>Smart league filter</span>
          </label>
          <div style={{fontSize:9,color:'#475569',marginTop:2}}>Only searches within ±2 league tiers of template.</div>
        </div>
        <div style={T.fg}>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}} onClick={()=>setLeaguePenalty(p=>!p)}>
            <div style={T.cb(leaguePenalty)}>{leaguePenalty&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
            <span style={{fontSize:11,color:leaguePenalty?'#e2e8f4':'#94a3b8'}}>League mismatch penalty</span>
          </label>
        </div>

        {/* LEAGUE PRESETS */}
        <div style={T.fg}>
          <span style={T.fl}>League Presets</span>
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
            {Object.keys(PRESET_LEAGUES).map(p=>(
              <button key={p} onClick={()=>{setActivePreset(activePreset===p?'':p);setActiveBands(new Set());setActiveRegions(new Set());}} style={{padding:'3px 7px',borderRadius:5,border:`1px solid ${activePreset===p?'#3b7de8':'#1e2d45'}`,background:activePreset===p?'#0e2040':'transparent',color:activePreset===p?'#60a5fa':'#64748b',fontSize:9.5,fontWeight:activePreset===p?700:400,cursor:'pointer'}}>{p}</button>
            ))}
          </div>
        </div>

        {/* LEAGUE BANDS */}
        <div style={T.fg}>
          <span style={T.fl}>League Bands</span>
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
            {[1,2,3,4,5,6].map(b=>(
              <button key={b} onClick={()=>{setActiveBands(prev=>{const n=new Set(prev);n.has(b)?n.delete(b):n.add(b);return n;});setActivePreset('');}} style={{padding:'3px 7px',borderRadius:5,border:`1px solid ${activeBands.has(b)?'#3b7de8':'#1e2d45'}`,background:activeBands.has(b)?'#0e2040':'transparent',color:activeBands.has(b)?'#60a5fa':'#64748b',fontSize:9.5,cursor:'pointer'}}>Band {b}</button>
            ))}
          </div>
        </div>

        {/* REGIONS */}
        <div style={T.fg}>
          <span style={T.fl}>Regions</span>
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
            {['Europe','South America','North America','Africa','Asia'].map(r=>(
              <button key={r} onClick={()=>{setActiveRegions(prev=>{const n=new Set(prev);n.has(r)?n.delete(r):n.add(r);return n;});setActivePreset('');}} style={{padding:'3px 7px',borderRadius:5,border:`1px solid ${activeRegions.has(r)?'#3b7de8':'#1e2d45'}`,background:activeRegions.has(r)?'#0e2040':'transparent',color:activeRegions.has(r)?'#60a5fa':'#64748b',fontSize:9.5,cursor:'pointer'}}>{r}</button>
            ))}
          </div>
        </div>

        <button onClick={()=>{run();if(isMobile)setCfgOpen(false);}} style={{width:'100%',padding:isMobile?'13px':'9px',background:'#0e2040',border:'1px solid #3b7de8',borderRadius:6,color:'#60a5fa',fontSize:12,fontWeight:700,cursor:'pointer'}}>
          🔍 Find Similar Players
        </button>
      </div>

      )}
      {isMobile&&!cfgOpen&&(
        <button style={T.fab} onClick={()=>setCfgOpen(true)}>&#9776; Setup</button>
      )}

      {/* Results */}
      <div style={isMobile?{flex:1,minWidth:0,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'12px 10px 74px'}:{flex:1,minWidth:0,overflowY:'auto',padding:'16px'}}>
        {!ran&&(
          <div style={{padding:'20px 24px',maxWidth:580}}>
            <div style={{fontSize:16,fontWeight:800,color:'#e2e8f4',marginBottom:12}}>🏟️ How It Works</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                ['1. Set your template','Pick a league, season and team. This is the club you want to recruit FOR.'],
                ['2. Choose a position','Select the position you want to recruit. FBs and Attackers have a side filter (LB/RB, LW/RW).'],
                ['3. Template mode','Team Average: uses the aggregate metric profile of all that position\'s players at the club. Specific Player: matches to one player\'s exact profile from that season.'],
                ['4. Find candidates','Scores every eligible player on metric similarity (0-100%). Uses Euclidean distance across position-specific metrics. Blue line on expanded cards = template level.'],
                ['5. Smart filter','On by default — only searches within ±2 league tiers. Turn off to search all 13 leagues (may produce irrelevant results).'],
                ['6. Use as template','Click any result to pivot the search around that player\'s profile.'],
              ].map(([title,desc])=>(
                <div key={title} style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:7,padding:'10px 12px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#93c5fd',marginBottom:3}}>{title}</div>
                  <div style={{fontSize:10.5,color:'#94a3b8',lineHeight:1.5}}>{desc}</div>
                </div>
              ))}
              <div style={{background:'#0a1a10',border:'1px solid #14532d',borderRadius:7,padding:'10px 12px'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#4ade80',marginBottom:3}}>Example</div>
                <div style={{fontSize:10.5,color:'#94a3b8',lineHeight:1.5}}>Ipswich 2024-25 → Fullback → Specific Player → Leif Davis → finds Left Backs with similar cross volume, progressive runs, xA, defensive duel % across Championship and League One.</div>
              </div>
            </div>
          </div>
        )}

        {ran&&tmplInfo&&(
          <div style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:9,padding:'12px 16px',marginBottom:12}}>
            <div style={{fontSize:9,color:'#475569',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:3}}>Template</div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:'#e2e8f4'}}>{tmplInfo.name}</div>
                <div style={{fontSize:10,color:'#64748b'}}>{tmplInfo.league} · {tmplSeason} · {ROLE_KEY_LABELS[pos]}</div>
              </div>
              {tmplInfo.score&&<div style={{fontSize:18,fontWeight:800,color:scoreBandColor(tmplInfo.score)}}>{tmplInfo.score.toFixed(1)}</div>}
              <div style={{fontSize:10,color:'#475569'}}>{results.length} candidates</div>
            </div>
          </div>
        )}

        {ran&&results.length===0&&(
          <div style={{textAlign:'center',padding:60,color:'#475569'}}>
            <div style={{fontSize:24,marginBottom:8}}>🔍</div>
            <div>No candidates found — check metric data is available for the template season, or adjust filters</div>
          </div>
        )}

        {ran&&results.length>0&&(
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(340px,1fr))',gap:10}}>
            {results.map((p,i)=>(
              <CandidateCard key={p.name+i} player={p} tmplMetrics={tmplMetrics} rk={pos} onUseAsTemplate={useAsTemplate} onOpenCard={setSelCard}/>
            ))}
          </div>
        )}
      </div>
    </div>
    {selCard&&<PlayerCard player={selCard} players={players} onClose={()=>setSelCard(null)}/>}
    </>
  );
}