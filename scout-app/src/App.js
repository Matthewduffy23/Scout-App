// App.js v7 - Complete country flag map (all 227 Wyscout countries, incl. mojibake variants) shared via top-level COUNTRY_TO_ISO2, replacing incomplete inline CC map. Height filter (v5/v6), mobile lazy-load fix (v4), shortlist export/import (v2) kept.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PlayerCard from './PlayerCard';
import ClubTool from './ClubTool';
import { Photo as PhotoUtil, Crest as CrestUtil, photoUrl as photoUrlUtil } from './utils';
import { scoreBandColor, formatMV, formatFoot, ROLE_KEY_LABELS, ROLES_BY_KEY, POSITION_ATTRIBUTES, playerHasAttribute, ALL_LEAGUES, DEFAULT_LEAGUES, HIDDEN_LEAGUES, YOUTH_LEAGUES, PRESET_LEAGUES, COUNTRY_TO_REGION, GBE_LEAGUE_BANDS, leagueToRegion, leagueToBand, scoreLabel, scoreToStars, promotionBadge, ALL_SEASONS, LEAGUE_STRENGTHS } from './constants';

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

const COUNTRY_TO_ISO2 = {
  // Home nations / GB
  'England':'gb-eng','Scotland':'gb-sct','Wales':'gb-wls','Northern Ireland':'gb-nir',
  'Republic of Ireland':'ie','Ireland':'ie','Great Britain':'gb',
  // Western/Southern Europe
  'Spain':'es','Germany':'de','Italy':'it','France':'fr','Belgium':'be','Portugal':'pt','Greece':'gr',
  'Netherlands':'nl','Switzerland':'ch','Austria':'at','Luxembourg':'lu','Andorra':'ad',
  'Monaco':'mc','San Marino':'sm','Liechtenstein':'li','Malta':'mt','Cyprus':'cy','Gibraltar':'gi',
  // Nordics
  'Norway':'no','Sweden':'se','Denmark':'dk','Finland':'fi','Iceland':'is','Faroe Islands':'fo',
  // Central/Eastern Europe
  'Poland':'pl','Czech Republic':'cz','Czech':'cz','Slovakia':'sk','Hungary':'hu','Romania':'ro',
  'Bulgaria':'bg','Croatia':'hr','Serbia':'rs','Slovenia':'si','Bosnia and Herzegovina':'ba','Bosnia':'ba',
  'North Macedonia':'mk','Montenegro':'me','Albania':'al','Kosovo':'xk','Moldova':'md',
  'Ukraine':'ua','Belarus':'by','Russia':'ru','Latvia':'lv','Lithuania':'lt','Estonia':'ee',
  // Caucasus / Central Asia
  'Armenia':'am','Georgia':'ge','Azerbaijan':'az','Kazakhstan':'kz','Uzbekistan':'uz',
  'Kyrgyzstan':'kg','Tajikistan':'tj','Turkmenistan':'tm',
  // Turkey
  'Turkey':'tr','Türkiye':'tr','TÃ¼rkiye':'tr',
  // North America
  'United States':'us','USA':'us','Canada':'ca','Mexico':'mx',
  // Central America / Caribbean
  'Costa Rica':'cr','Panama':'pa','Honduras':'hn','Guatemala':'gt','El Salvador':'sv','Nicaragua':'ni',
  'Belize':'bz','Cuba':'cu','Haiti':'ht','Dominican Republic':'do','Jamaica':'jm','Bahamas':'bs',
  'Barbados':'bb','Trinidad and Tobago':'tt','Dominica':'dm','Grenada':'gd','St. Lucia':'lc',
  'St. Vincent and the Grenadines':'vc','St. Kitts and Nevis':'kn','Antigua and Barbuda':'ag',
  'Puerto Rico':'pr','Aruba':'aw','Curaçao':'cw','CuraÃ§ao':'cw','Sint Maarten':'sx','Saint Martin':'mf',
  'Bonaire':'bq','Guadeloupe':'gp','Martinique':'mq','Cayman Islands':'ky','Turks and Caicos Islands':'tc',
  'British Virgin Islands':'vg','US Virgin Islands':'vi','Montserrat':'ms',
  // South America
  'Brazil':'br','Argentina':'ar','Colombia':'co','Ecuador':'ec','Paraguay':'py','Uruguay':'uy',
  'Chile':'cl','Bolivia':'bo','Peru':'pe','Venezuela':'ve','Guyana':'gy','Suriname':'sr',
  'French Guiana':'gf',
  // North Africa / Middle East
  'Morocco':'ma','Algeria':'dz','Egypt':'eg','Tunisia':'tn','Libya':'ly','Sudan':'sd','South Sudan':'ss',
  'Israel':'il','Palestine':'ps','Jordan':'jo','Lebanon':'lb','Syria':'sy','Iraq':'iq','Iran':'ir',
  'Saudi Arabia':'sa','United Arab Emirates':'ae','UAE':'ae','Qatar':'qa','Bahrain':'bh','Kuwait':'kw',
  'Oman':'om','Yemen':'ye',
  // Sub-Saharan Africa
  'Nigeria':'ng','Cameroon':'cm','Senegal':'sn','Mali':'ml','Ghana':'gh',"Côte d'Ivoire":'ci',
  "CÃ´te d'Ivoire":'ci','Ivory Coast':'ci','Guinea-Bissau':'gw','Equatorial Guinea':'gq',
  'Congo':'cg','Congo DR':'cd','DR Congo':'cd','Gambia':'gm','Togo':'tg','Gabon':'ga',
  'Mauritania':'mr','Guinea':'gn','South Africa':'za','Zambia':'zm','Angola':'ao','Ethiopia':'et',
  'Comoros':'km','Kenya':'ke','Benin':'bj','Rwanda':'rw','Burundi':'bi','Botswana':'bw',
  'Central African Republic':'cf','Chad':'td','Uganda':'ug','Madagascar':'mg','Zimbabwe':'zw',
  'Lesotho':'ls','Eritrea':'er','Malawi':'mw','Sierra Leone':'sl','Liberia':'lr','Somalia':'so',
  'Djibouti':'dj','Mozambique':'mz','Namibia':'na','Tanzania':'tz','Zanzibar':'tz','Niger':'ne',
  'Burkina Faso':'bf','Seychelles':'sc','Mauritius':'mu','Cape Verde Islands':'cv','Cape Verde':'cv',
  'Eswatini':'sz',
  'São Tomé e Príncipe':'st','SÃ£o TomÃ© e PrÃ­ncipe':'st',
  // South/Central/East Asia
  'India':'in','Pakistan':'pk','Bangladesh':'bd','Sri Lanka':'lk','Nepal':'np','Bhutan':'bt',
  'Maldives':'mv','Afghanistan':'af','Myanmar':'mm','Cambodia':'kh','Laos':'la','Thailand':'th',
  'Vietnam':'vn','Philippines':'ph','Malaysia':'my','Singapore':'sg','Indonesia':'id','Mongolia':'mn',
  'Timor-Leste':'tl','Brunei Darussalam':'bn',
  // East Asia
  'Japan':'jp','Korea Republic':'kr','Korea':'kr','South Korea':'kr','Korea DPR':'kp','North Korea':'kp',
  'China':'cn','China PR':'cn','Chinese Taipei':'tw','Hong Kong':'hk','Macao':'mo',
  // Oceania / Pacific
  'Australia':'au','New Zealand':'nz','Fiji':'fj','Vanuatu':'vu','Papua New Guinea':'pg',
  'New Caledonia':'nc','Solomon Islands':'sb','Samoa':'ws','Tahiti':'pf','Guam':'gu',
  // Europe channel islands / small states
  'Isle of Man':'im','Jersey':'je','Guernsey':'gg','Réunion':'re','RÃ©union':'re','Bermuda':'bm',
  // Generic regions — intentionally no flag
  'Africa':'','Europe':'','Asia':'','World':'','N/C America':'','South America':'',
};
function countryToIso2(name) {
  if (!name) return '';
  return COUNTRY_TO_ISO2[String(name).trim()] || '';
}


const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';
const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';
const PAGE = 50;

function slugN(s) {
  s = String(s||'').toLowerCase();
  'ø,o|œ,oe|æ,ae|å,a|ä,a|ö,o|ü,u|ß,ss|ł,l|đ,d|ð,d|þ,th|ç,c|ş,s|ğ,g|ı,i'.split('|').forEach(p=>{const[k,v]=p.split(',');s=s.split(k).join(v);});
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
}
export function photoUrl(name,team){
  const parts=name.trim().split('.');let ini,sur;
  if(parts.length>=2){ini=parts[0].trim();sur=parts.slice(1).join('.').trim();}
  else{const b=name.trim().split(' ');ini=b[0]||'';sur=b.slice(1).join(' ')||b[0]||'';}
  const t=String(team||'').trim().split(/\s+/).map(w=>slugN(w)).join('_').replace(/^_|_$/g,'');
  return `${PHOTO_BASE}${slugN(ini)}_${slugN(sur)}__${t}.png`;
}
export function Photo({name,team,size=34}){
  const [src,set]=useState(()=>photoUrl(name,team));
  const [tried,setT]=useState(false);
  React.useEffect(()=>{set(photoUrl(name,team));setT(false);},[name,team]);
  return <img src={src} alt="" onError={()=>{if(!tried){set('/fallback.png');setT(true);}}} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',background:'#111827',flexShrink:0,border:'2px solid #1a2740'}}/>;
}
export function Crest({id,name,size=20}){
  const [ok,set]=useState(!!id);
  if(!id||!ok) return <div style={{width:size,height:size,borderRadius:3,background:'#1a2740',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.5,color:'#94a3b8',flexShrink:0,fontWeight:700}}>{(name||'?')[0]}</div>;
  return <img src={`${CREST_BASE}${id}.png`} alt="" onError={()=>set(false)} style={{width:size,height:size,objectFit:'contain',flexShrink:0}}/>;
}

export function StarDisplay({score,size=11}){
  const stars=scoreToStars(score);
  const full=Math.floor(stars);
  const half=(stars-full)>=0.5?1:0;
  const empty=5-full-half;
  const S=({fill})=>(<svg width={size} height={size} viewBox="0 0 24 24" style={{flexShrink:0}}><defs><linearGradient id="hg"><stop offset="50%" stopColor="#f59e0b"/><stop offset="50%" stopColor="#334155"/></linearGradient></defs><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={fill==='full'?'#f59e0b':fill==='half'?'url(#hg)':'#334155'} stroke="none"/></svg>);
  return <div style={{display:'flex',alignItems:'center',gap:1.5}}>{[...Array(full)].map((_,i)=><S key={i} fill="full"/>)}{half===1&&<S fill="half"/>}{[...Array(empty)].map((_,i)=><S key={i} fill="empty"/>)}</div>;
}

const METRIC_OPTIONS=[
  {label:'xG per 90',key:'xG'},{label:'xA per 90',key:'xA'},
  {label:'Goals (non-pen)',key:'Goals: Non-Penalty'},{label:'Shots per 90',key:'Shots'},
  {label:'Touches in Box',key:'Touches in Box'},{label:'Progressive Runs',key:'Progressive Runs'},
  {label:'Crosses per 90',key:'Crosses'},{label:'Pass % accuracy',key:'Pass %'},
  {label:'Passes per 90',key:'Passes'},{label:'Prog Passes',key:'Progressive Passes'},
  {label:'Dribbles per 90',key:'Dribbles'},{label:'Dribble %',key:'Dribble %'},
  {label:'Key Passes',key:'Key Passes'},{label:'Deep Completions',key:'Deep Completions'},
  {label:'Def Duel Win %',key:'Def Duel Win %'},{label:'Aerial Win %',key:'Aerial Duel %'},
  {label:'Interceptions',key:'PAdj Interceptions'},{label:'Def Duels per 90',key:'Def Duels'},
];

function getMetricPct(player,metricKey){
  const seasons=Object.values(player.seasonsDetail||{});
  if(!seasons.length) return null;
  const sd=seasons[0];
  for(const grp of ['A','D','P']){
    const found=(sd.g?.[grp]||[]).find(x=>x[0]===metricKey);
    if(found) return {pct:found[1],val:found[2]};
  }
  return null;
}

// Get score for a specific season from sh array
function getSeasonScore(player, season){
  if(season==='all') return null;
  const h=player.sh?.find(x=>x.s===season);
  return h?h.sc:null;
}

function DualSlider({min,max,onChange}){
  // Simple two-input approach - unambiguous, no overlap confusion
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
        <span style={{fontSize:8,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.08em'}}>Min</span>
        <input type="number" min={0} max={max-1} value={min}
          onChange={e=>onChange(Math.min(Number(e.target.value),max-1),max)}
          style={{width:46,background:'#07090f',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',padding:'4px 6px',fontSize:12,fontWeight:700,textAlign:'center',outline:'none'}}/>
      </div>
      <div style={{flex:1,height:2,background:'#3b7de8',borderRadius:2,marginTop:10}}/>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
        <span style={{fontSize:8,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.08em'}}>Max</span>
        <input type="number" min={min+1} max={100} value={max}
          onChange={e=>onChange(min,Math.max(Number(e.target.value),min+1))}
          style={{width:46,background:'#07090f',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',padding:'4px 6px',fontSize:12,fontWeight:700,textAlign:'center',outline:'none'}}/>
      </div>
    </div>
  );
}

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
        <DualSlider min={filter.min} max={filter.max} onChange={(mn,mx)=>onChange({...filter,min:mn,max:mx})}/>
      </>)}
    </div>
  );
}

const T={
  app:{display:'flex',flexDirection:'column',minHeight:'100vh',background:'#07090f'},
  topbar:{background:'#0a0d18',borderBottom:'1px solid #1e2d45',padding:'0 20px',display:'flex',alignItems:'center',gap:12,height:48,flexShrink:0},
  logo:{fontSize:13,fontWeight:800,color:'#f1f5f9',letterSpacing:'-0.02em',display:'flex',alignItems:'center',gap:6},
  dot:{width:6,height:6,borderRadius:'50%',background:'#3b7de8'},
  layout:{display:'flex',flex:1,minHeight:0},
  sb:{width:260,flexShrink:0,background:'#07090f',borderRight:'1px solid #1e2d45',overflowY:'auto',padding:'12px 11px',scrollbarWidth:'thin',scrollbarColor:'#1e2d45 #07090f'},
  main:{flex:1,display:'flex',flexDirection:'column',minWidth:0},
  fg:{marginBottom:14},
  fl:{fontSize:9,fontWeight:700,color:'#94a3b8',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4,display:'block'},
  sel:{width:'100%',background:'#0d1220',border:'1px solid #1e2d45',borderRadius:5,color:'#e2e8f4',padding:'6px 7px',appearance:'none',cursor:'pointer',outline:'none',fontSize:11.5},
  rr:{display:'flex',gap:4,alignItems:'center'},
  ri:{flex:1,background:'#0d1220',border:'1px solid #1e2d45',borderRadius:5,color:'#e2e8f4',padding:'5px 7px',width:0,outline:'none',fontSize:11.5},
  rs:{color:'#94a3b8',fontSize:10},
  cg:{display:'flex',flexDirection:'column',gap:3},
  cr:{display:'flex',alignItems:'center',gap:5,cursor:'pointer'},
  cb:(on)=>({width:13,height:13,borderRadius:2,flexShrink:0,border:`1px solid ${on?'#3b7de8':'#475569'}`,background:on?'#3b7de8':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}),
  cl:(on)=>({fontSize:11,color:on?'#e2e8f4':'#94a3b8',userSelect:'none'}),
  sl:{width:'100%',accentColor:'#3b7de8',cursor:'pointer'},
  rb:{width:'100%',padding:'6px',background:'none',border:'1px solid #1e2d45',borderRadius:5,color:'#94a3b8',fontSize:10.5,marginTop:3,cursor:'pointer'},
  dv:{height:1,background:'#131c2e',margin:'2px 0 12px'},
  statsBar:{padding:'10px 16px',background:'#0a0d18',borderBottom:'1px solid #1e2d45',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'},
  si:{display:'flex',flexDirection:'column',gap:1},
  sv:{fontSize:16,fontWeight:800,color:'#f1f5f9',lineHeight:1},
  sl2:{fontSize:8,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em'},
  sdv:{width:1,height:22,background:'#1e2d45'},
  tw:{flex:1,overflow:'auto',WebkitOverflowScrolling:'touch'},
  tbl:{width:'100%',borderCollapse:'collapse',minWidth:960},
  th_:{position:'sticky',top:0,zIndex:10,background:'#0a0d18'},
  th:{padding:'7px 10px',textAlign:'left',fontSize:9,fontWeight:700,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase',borderBottom:'1px solid #1e2d45',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none'},
  tha:{color:'#60a5fa'},
  td:{padding:'8px 10px',borderBottom:'1px solid #0d1525',fontSize:11.5,color:'#e2e8f4',whiteSpace:'nowrap',verticalAlign:'middle'},
  tdm:{color:'#94a3b8'},
  rp:{display:'inline-block',padding:'2px 6px',borderRadius:8,background:'#0e1e38',color:'#93c5fd',fontSize:10,fontWeight:600,whiteSpace:'nowrap'},
  fp:(f)=>({display:'inline-block',padding:'2px 6px',borderRadius:8,background:f==='left'?'#0a1e14':'#0d1624',color:f==='left'?'#4ade80':'#60a5fa',fontSize:10,fontWeight:600}),
  es:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',color:'#64748b',gap:8},
  sw:{position:'relative'},
  si2:{width:'100%',background:'#0d1220',border:'1px solid #1e2d45',borderRadius:5,color:'#e2e8f4',padding:'6px 7px 6px 28px',outline:'none',fontSize:11.5},
  si3:{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#64748b',fontSize:12},
  pg:{padding:'8px 14px',borderTop:'1px solid #1e2d45',display:'flex',alignItems:'center',gap:4,background:'#07090f'},
  pb:(a)=>({width:24,height:22,borderRadius:4,border:`1px solid ${a?'#3b7de8':'#1e2d45'}`,background:a?'#0e2040':'transparent',color:a?'#60a5fa':'#94a3b8',fontSize:10,fontWeight:600,cursor:'pointer'}),
  tog:(on)=>({padding:'4px 10px',borderRadius:5,border:`1px solid ${on?'#3b7de8':'#1e2d45'}`,background:on?'#0e2040':'transparent',color:on?'#93c5fd':'#94a3b8',fontSize:10,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}),
};

function Th({col,label,sort,onSort}){
  const a=sort.col===col;
  return <th style={{...T.th,...(a?T.tha:{})}} onClick={()=>onSort(col)}>{label}{a?(sort.asc?' ↑':' ↓'):''}</th>;
}

export default function App(){
  const isMobile=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 768px)').matches,[]);
  const [all,setAll]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState(null);
  const [page,setPage]=useState(0);

  const [search,setSearch]=useState('');
  const [pos,setPos]=useState(isMobile?'Striker':'All');
  const [roleFilters,setRoleFilters]=useState(new Set());
  const [roleFilter,setRoleFilter]=useState('');
  const [roleScoreMin,setRoleScoreMin]=useState(50);
  const [scoreMode,setScoreMode]=useState('complete');
  const [activePreset,setActivePreset]=useState('');
  const [showHidden,setShowHidden]=useState(false);
  const [showYouth,setShowYouth]=useState(false);
  const [activeBands,setActiveBands]=useState(new Set());
  const [activeRegions,setActiveRegions]=useState(new Set());
  const [activePresetLeagues,setActivePresetLeagues]=useState(null); // null = use derived, Set = manual additions/removals on top
  const [lsMin,setLsMin]=useState(0);
  const [lsMax,setLsMax]=useState(101);

  // Derive the active leagues set from all filter states
  const leagues=useMemo(()=>{
    if(showYouth) return new Set(YOUTH_LEAGUES);
    let base;
    if(activePresetLeagues!==null) return new Set(activePresetLeagues);
    if(activeBands.size>0||activeRegions.size>0){
      base=new Set(ALL_LEAGUES.filter(l=>{
        const bandOk = activeBands.size===0 || activeBands.has(leagueToBand(l));
        const regionOk = activeRegions.size===0 || activeRegions.has(leagueToRegion(l));
        return bandOk && regionOk;
      }));
    } else {
      base=new Set(DEFAULT_LEAGUES);
    }
    if(showHidden)[...HIDDEN_LEAGUES].forEach(l=>base.add(l));
    return base;
  },[activePresetLeagues,activeBands,activeRegions,showHidden,showYouth]);
  const [ageMin,setAgeMin]=useState(16);
  const [ageMax,setAgeMax]=useState(38);
  const [heightMin,setHeightMin]=useState(152); // 5'0"
  const [heightMax,setHeightMax]=useState(211); // 6'11"
  const [foot,setFoot]=useState('Any');
  const [minScore,setMinScore]=useState(40);
  const [minSeas,setMinSeas]=useState(1);
  const [mvMax,setMvMax]=useState(50);
  const [showMvFilter,setShowMvFilter]=useState(false);
  const [contractBefore,setContractBefore]=useState(2028);
  const [showContractFilter,setShowContractFilter]=useState(false);
  const [seasonFilter,setSeasonFilter]=useState('all');
  const [metricFilters,setMetricFilters]=useState([]);
  const [xValueFilter,setXValueFilter]=useState('');
  const [xValueMin,setXValueMin]=useState(0);
  const [xValueMax,setXValueMax]=useState(50);
  const [showXValueFilter,setShowXValueFilter]=useState(false);
  const [potentialMin,setPotentialMin]=useState(40);
  const [played2526,setPlayed2526]=useState(false);
  const [escOnly,setEscOnly]=useState(false);
  const [gbeMin,setGbeMin]=useState(0);
  const [natFilter,setNatFilter]=useState('');
  const [shortlist,setShortlist]=React.useState(()=>{try{return JSON.parse(localStorage.getItem('scout_shortlist')||'[]')}catch{return []}});
  const [showShortlist,setShowShortlist]=React.useState(false);
  const [notPlayingOnly,setNotPlayingOnly]=React.useState(false);
  const [softMode,setSoftMode]=React.useState(false);
  const shortlistFileInputRef=React.useRef(null);
  const toggleShortlist=(id)=>{
    setShortlist(prev=>{
      const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];
      try{localStorage.setItem('scout_shortlist',JSON.stringify(next))}catch{}
      return next;
    });
  };
  const exportShortlist=()=>{
    const payload={ids:shortlist,exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`shortlist_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const importShortlistFile=(file)=>{
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      try{
        const parsed=JSON.parse(e.target.result);
        const importedIds=Array.isArray(parsed)?parsed:(Array.isArray(parsed.ids)?parsed.ids:null);
        if(!importedIds) throw new Error('Invalid shortlist file');
        setShortlist(prev=>{
          const merged=[...new Set([...prev,...importedIds])];
          try{localStorage.setItem('scout_shortlist',JSON.stringify(merged))}catch{}
          return merged;
        });
      }catch(err){
        alert('Could not read that file — make sure it\'s a shortlist backup exported from this app.');
      }
    };
    reader.readAsText(file);
  };
  const [rawMode,setRawMode]=useState(false); // no league weight
  const [onlyElite,setOnlyElite]=useState(false); // only elite in their division
  const [sort,setSort]=useState({col:'careerScore',asc:false});
  const [recentOnly,setRecentOnly]=useState(true);
  const [minMins,setMinMins]=useState(500);
  const [currentLeagueOnly,setCurrentLeagueOnly]=useState(false);
  const [activeTab,setActiveTab]=useState('scout'); // 'scout' | 'club'
  const [hiddenCols,setHiddenCols]=useState(new Set(['marketValue']));
  const [attrFilters,setAttrFilters]=useState(new Set()); // active attribute keys // hide MV by default, show xValue
  const [showColPicker,setShowColPicker]=useState(false); // default: only show players active 2022-23+

  const groupCacheRef=React.useRef({}); // mobile only: {gk:[...players], cf:[...players], ...}
  const manifestRef=React.useRef(null);
  const rk=useMemo(()=>Object.entries(ROLE_KEY_LABELS).find(([,v])=>v===pos)?.[0]||'',[pos]);

  // Desktop: unchanged — load every position group upfront.
  useEffect(()=>{
    if(isMobile) return;
    fetch('/players_manifest.json').then(r=>r.ok?r.json():null).catch(()=>null)
      .then(manifest=>{
        const fileList = manifest
          ? Object.values(manifest).flat()                                    // chunked files, e.g. players_cm_1.json, players_cm_2.json...
          : ['gk','cb','fb','cm','att','cf'].map(f=>`players_${f}.json`);      // fallback: old un-chunked deploy, no manifest yet
        return Promise.all(fileList.map(fname=>fetch(`/${fname}`).then(r=>r.json()).catch(()=>[])));
      })
      .then(results=>{setAll(results.flat());setLoading(false);})
      .catch(()=>setLoading(false));
  },[isMobile]);

  // Mobile: load one position group at a time, cached per session, refetched only when switching to an uncached group.
  useEffect(()=>{
    if(!isMobile) return;
    const groupKey = rk || null; // 'GK'|'CB'|'FB'|'CM'|'ATT'|'CF' — matches manifest keys exactly (uppercase, = roleKey), or null for "All"
    let cancelled=false;
    setLoading(true);
    const loadGroup=(manifest)=>{
      if(!groupKey){
        // "All" selected on mobile — user explicitly chose this, load everything like desktop (same tradeoff as before).
        const fileList = manifest ? Object.values(manifest).flat() : ['gk','cb','fb','cm','att','cf'].map(f=>`players_${f}.json`);
        return Promise.all(fileList.map(fname=>fetch(`/${fname}`).then(r=>r.json()).catch(()=>[]))).then(results=>results.flat());
      }
      if(groupCacheRef.current[groupKey]) return Promise.resolve(groupCacheRef.current[groupKey]);
      const fileList = manifest && manifest[groupKey] ? manifest[groupKey] : [`players_${groupKey.toLowerCase()}.json`];
      return Promise.all(fileList.map(fname=>fetch(`/${fname}`).then(r=>r.json()).catch(()=>[])))
        .then(results=>{const flat=results.flat();groupCacheRef.current[groupKey]=flat;return flat;});
    };
    (manifestRef.current?Promise.resolve(manifestRef.current):fetch('/players_manifest.json').then(r=>r.ok?r.json():null).catch(()=>null))
      .then(manifest=>{manifestRef.current=manifest;return loadGroup(manifest);})
      .then(data=>{if(!cancelled){setAll(data);setLoading(false);}})
      .catch(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[isMobile,rk]);
  useEffect(()=>{setRoleFilter('');setRoleScoreMin(50);setScoreMode('complete');},[pos]);
  useEffect(()=>{if(activePreset&&PRESET_LEAGUES[activePreset]){setActivePresetLeagues([...PRESET_LEAGUES[activePreset]]);}  },[activePreset]);

  const onSort=useCallback(col=>{setSort(p=>p.col===col?{col,asc:!p.asc}:{col,asc:false});setPage(0);},[]);

  // Get display score based on all mode toggles
  const getDisplayScore=useCallback((p)=>{
    if(rawMode){
      if(seasonFilter!=='all'){
        const h=p.sh?.find(x=>x.s===seasonFilter);
        return h?(h.r??h.sc):null;  // use raw score if available
      }
      // Raw career: use stored careerRaw (true unweighted league-relative score)
      return p.careerRaw??p.careerScore;
    }
    if(seasonFilter!=='all'){
      const h=p.sh?.find(x=>x.s===seasonFilter);
      return h?h.sc:null;
    }
    if(scoreMode!=='complete') return (p.roleCareerScores||{})[scoreMode]||null;
    return p.careerScore;
  },[seasonFilter,scoreMode,rawMode]);

  const addMetricFilter=()=>{if(metricFilters.length<10)setMetricFilters(f=>[...f,{key:'',label:'',min:0,max:100}]);};

  const filtered=useMemo(()=>{
    const _norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const q=_norm(search.trim());
    return all.filter(p=>{
      if(q&&!_norm(p.name).includes(q)&&!_norm(p.team).includes(q)) return false;
      // RecentOnly: skip if no recent data, BUT allow all if a specific season is selected
      if(recentOnly&&!p.hasRecentData&&seasonFilter==='all'&&!played2526&&!showYouth) return false;
      if(minMins>0&&(p.minutesLatest||0)<(showYouth?100:minMins)) return false;
      // Current league only: player must be currently in one of the selected leagues
      if(currentLeagueOnly&&!leagues.has(p.league)) return false;
      // When specific season selected, player must have data for that season
      if(seasonFilter!=='all'&&!p.sh?.find(x=>x.s===seasonFilter)) return false;
      if(pos!=='All'&&ROLE_KEY_LABELS[p.roleKey]!==pos) return false;
      if(!leagues.has(p.league)) return false;
      const pls=LEAGUE_STRENGTHS[p.league]||0;
      if(pls<lsMin||pls>lsMax) return false;
      if(p.age<ageMin||p.age>ageMax) return false;
      if(p.height&&(p.height<heightMin||p.height>heightMax)) return false;
      if(foot!=='Any'&&p.foot!==foot) return false;
      const ds=getDisplayScore(p);
      if(ds===null) return false; // no data for that season
      if(ds<minScore) return false;
      if(p.seasons<minSeas) return false;
      if(potentialMin>40&&(p.potentialScore||p.careerScore)<potentialMin) return false;
      if(played2526&&!p.sh?.find(x=>x.s==='2025-26'||x.s==='2026')) return false;
      if(escOnly&&!p.escEligible) return false;
      if(gbeMin>0&&(p.gbeTotal||0)<gbeMin) return false;
      if(natFilter&&!(p.passportCountries||'').toLowerCase().includes(natFilter.toLowerCase())&&!(p.birthCountry||'').toLowerCase().includes(natFilter.toLowerCase())) return false;
      if(showShortlist&&!shortlist.includes(p.id)) return false;
      if(notPlayingOnly){
        const allS=p.allSeasonsSummary||[];
        const curr=allS.filter(x=>x.s==='2025-26'||x.s==='2026');
        const prev=allS.filter(x=>x.s==='2024-25'||x.s==='2025');
        const currMins=curr.reduce((a,x)=>a+(x.mins||0),0);
        const prevMins=prev.reduce((a,x)=>a+(x.mins||0),0);
        if(!(prevMins>400&&currMins<prevMins*0.4)) return false;
      }
      if(showMvFilter&&p.marketValue&&p.marketValue>mvMax*1000000) return false;
      if(showContractFilter&&p.contractYear&&p.contractYear>0&&p.contractYear>contractBefore) return false;
      if(roleFilters.size>0){
        const hasRole=[...roleFilters].some(rf=>{
          const rs=(p.roleCareerScores||{})[rf]||0;
          return roleScoreMin>0?rs>=roleScoreMin:rs>0;
        });
        if(!hasRole) return false;
      } else if(roleFilter){
        const rs=(p.roleCareerScores||{})[roleFilter]||0;
        if(roleScoreMin>0&&rs<roleScoreMin) return false;
        if(!roleScoreMin&&!rs) return false;
      }
      if(onlyElite&&!promotionBadge(p.careerScore,p.league)) return false;
      // Attribute filters
      if(attrFilters.size>0&&rk){
        const sdEntries=p.seasonsDetail||{};
        const sd=sdEntries['2025-26']||sdEntries['2026']||sdEntries['2025']||Object.values(sdEntries)[0]||{};
        const g=sd.g||{};
        const posAttrs=POSITION_ATTRIBUTES[rk]||[];
        for(const key of attrFilters){
          const attr=posAttrs.find(a=>a.key===key);
          if(attr){
            const adj=softMode?{...attr,tests:attr.tests.map(t=>({...t,p:Math.max(0,t.p-10)}))}:attr;
            if(!playerHasAttribute(adj,g)) return false;
          }
        }
      }
      if(showXValueFilter&&p.xValue&&p.xValue<xValueMin*1000000) return false;
      if(showXValueFilter&&xValueMax<50&&p.xValue&&p.xValue>xValueMax*1000000) return false;
      if(xValueFilter==='undervalued'&&!(p.xValueGapPct>20&&p.marketValue>0)) return false;
      if(xValueFilter==='gems'&&!(p.xValueGapPct>50&&p.marketValue>0)) return false;
      if(xValueFilter==='overvalued'&&!(p.xValueGapPct<-20&&p.marketValue>0)) return false;
      for(const mf of metricFilters){
        if(!mf.key) continue;
        const m=getMetricPct(p,mf.key);
        if(!m) continue;
        if(m.pct<mf.min||m.pct>mf.max) return false;
      }
      return true;
    });
  },[all,search,pos,leagues,ageMin,ageMax,heightMin,heightMax,foot,minScore,minSeas,showMvFilter,mvMax,showContractFilter,contractBefore,roleFilter,roleScoreMin,seasonFilter,metricFilters,xValueFilter,onlyElite,getDisplayScore,recentOnly,showXValueFilter,xValueMin,xValueMax,attrFilters,minMins,currentLeagueOnly,played2526,potentialMin,lsMin,lsMax,escOnly,gbeMin,natFilter,softMode,roleFilters,shortlist,showShortlist,notPlayingOnly]);

  const sorted=useMemo(()=>{
    const a=[...filtered];
    const roleName=scoreMode!=='complete'?scoreMode:roleFilter;
    a.sort((x,y)=>{
      if(sort.col==='roleScore'&&roleName){
        const av=(x.roleCareerScores||{})[roleName]||0;
        const bv=(y.roleCareerScores||{})[roleName]||0;
        return sort.asc?av-bv:bv-av;
      }
      if(sort.col==='careerScore'){
        const av=getDisplayScore(x)??(sort.asc?Infinity:-Infinity);
        const bv=getDisplayScore(y)??(sort.asc?Infinity:-Infinity);
        return sort.asc?av-bv:bv-av;
      }
      const av=x[sort.col]??(sort.asc?Infinity:-Infinity);
      const bv=y[sort.col]??(sort.asc?Infinity:-Infinity);
      return sort.asc?av-bv:bv-av;
    });
    return a;
  },[filtered,sort,roleFilter,scoreMode,seasonFilter,getDisplayScore]);

  const pageData=sorted.slice(page*PAGE,(page+1)*PAGE);
  const totalPages=Math.ceil(sorted.length/PAGE);
  const stats=useMemo(()=>({
    count:filtered.length,
    avg:filtered.length?filtered.reduce((s,p)=>s+(getDisplayScore(p)||p.careerScore),0)/filtered.length:0,
    elite:filtered.filter(p=>p.careerScore>=80).length,
    avgAge:filtered.length?filtered.reduce((s,p)=>s+p.age,0)/filtered.length:0,
  }),[filtered,getDisplayScore]);

  const reset=()=>{setSearch('');setPos('All');setRoleFilter('');setRoleFilters(new Set());setSoftMode(false);setRoleFilters(new Set());setSoftMode(false);setRoleScoreMin(50);setActivePreset('');setActivePresetLeagues(null);setShowHidden(false);setShowYouth(false);setActiveBands(new Set());setActiveRegions(new Set());setLsMin(0);setLsMax(101);setAgeMin(16);setAgeMax(38);setHeightMin(152);setHeightMax(211);setFoot('Any');setMinScore(40);setMinSeas(1);setShowMvFilter(false);setMvMax(50);setShowContractFilter(false);setContractBefore(2028);setSeasonFilter('all');setScoreMode('complete');setMetricFilters([]);setXValueFilter('');setRawMode(false);setOnlyElite(false);setRecentOnly(true);setShowXValueFilter(false);setXValueMin(0);setXValueMax(50);setAttrFilters(new Set());setMinMins(500);setCurrentLeagueOnly(false);setPotentialMin(40);setPlayed2526(false);setEscOnly(false);setGbeMin(0);setNatFilter('');setNotPlayingOnly(false);setShowShortlist(false);setSoftMode(false);setRoleFilters(new Set());setPage(0);};

  if(loading) return <div style={{...T.app,alignItems:'center',justifyContent:'center'}}><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style><div style={{width:24,height:24,border:'2px solid #1e2d45',borderTop:'2px solid #3b7de8',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/><div style={{color:'#94a3b8',fontSize:11,marginTop:8}}>Loading…</div></div>;

  const colLabel=rawMode?'Raw':scoreMode!=='complete'?scoreMode.split(' ')[0]+'…':seasonFilter!=='all'?seasonFilter.slice(2):'Career';

  return(
    <div style={T.app}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}.rh:hover td{background:#0c1830!important;cursor:pointer}'}</style>
      <div style={T.topbar}>
        <div style={T.logo}><div style={T.dot}/>Scout Index</div>
        <div style={{width:1,height:14,background:'#1e2d45'}}/>
        <div style={{display:'flex',gap:2}}>
          <button onClick={()=>setActiveTab('scout')} style={{padding:'4px 10px',borderRadius:5,border:`1px solid ${activeTab==='scout'?'#3b7de8':'transparent'}`,background:activeTab==='scout'?'#0e2040':'transparent',color:activeTab==='scout'?'#60a5fa':'#94a3b8',fontSize:10,fontWeight:600,cursor:'pointer'}}>Scout Index</button>
          <button onClick={()=>setActiveTab('club')} style={{padding:'4px 10px',borderRadius:5,border:`1px solid ${activeTab==='club'?'#3b7de8':'transparent'}`,background:activeTab==='club'?'#0e2040':'transparent',color:activeTab==='club'?'#60a5fa':'#94a3b8',fontSize:10,fontWeight:600,cursor:'pointer'}}>Club Tool</button>
        </div>
        {rawMode&&<div style={{padding:'2px 8px',borderRadius:4,background:'#1e3a5f',color:'#60a5fa',fontSize:10,fontWeight:700}}>RAW MODE — no league weighting</div>}
        <div style={{marginLeft:'auto',fontSize:9,color:'#94a3b8',background:'#0d1220',border:'1px solid #1e2d45',borderRadius:4,padding:'2px 6px'}}>{all.length.toLocaleString()} players</div>
      </div>

      {activeTab==='club'?<ClubTool players={all}/>:(<div style={T.layout}>
        <aside style={T.sb}>
          <div style={T.fg}>
            <div style={T.sw}><span style={T.si3}>⌕</span><input style={T.si2} placeholder="Player or team…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></div>
          </div>
          <div style={T.dv}/>

          {/* Scoring modes */}
          <div style={T.fg}>
            <span style={T.fl}>Position Group</span>
            <select style={T.sel} value={pos} onChange={e=>{setPos(e.target.value);setAttrFilters(new Set());setMinMins(0);setCurrentLeagueOnly(false);setPage(0);}}>
              <option>All</option>
              {Object.values(ROLE_KEY_LABELS).map(v=><option key={v}>{v}</option>)}
            </select>
          </div>

          {pos!=='All'&&rk&&(POSITION_ATTRIBUTES[rk]||[]).length>0&&(
            <div style={T.fg}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                <span style={T.fl}>Attributes{attrFilters.size>0&&<span style={{color:'#60a5fa'}}> ({attrFilters.size} active)</span>}</span>
                {attrFilters.size>0&&<button onClick={()=>setAttrFilters(new Set())} style={{fontSize:8,padding:'1px 6px',borderRadius:3,border:'1px solid #1e2d45',background:'transparent',color:'#f87171',cursor:'pointer'}}>Clear</button>}
                <label style={{...T.cr,marginLeft:'auto'}} onClick={()=>setSoftMode(p=>!p)}>
                  <div style={T.cb(softMode)}>{softMode&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
                  <span style={T.cl(softMode)}>Soft (-10%)</span>
                </label>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {(POSITION_ATTRIBUTES[rk]||[]).map(attr=>{
                  const on=attrFilters.has(attr.key);
                  return(
                    <button key={attr.key} onClick={()=>{setAttrFilters(p=>{const n=new Set(p);n.has(attr.key)?n.delete(attr.key):n.add(attr.key);return n;});setPage(0);}}
                      style={{padding:'3px 8px',borderRadius:12,border:`1px solid ${on?'#3b7de8':'#1e2d45'}`,background:on?'#0e2040':'transparent',color:on?'#60a5fa':'#64748b',fontSize:9.5,fontWeight:on?700:400,cursor:'pointer'}}>
                      {attr.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {pos!=='All'&&rk&&(<>
            <div style={T.fg}>
              <span style={T.fl}>Scoring Mode</span>
              <select style={T.sel} value={scoreMode} onChange={e=>{const v=e.target.value;setScoreMode(v);setSort(v!=='complete'?{col:'roleScore',asc:false}:{col:'careerScore',asc:false});setPage(0);}}>
                <option value="complete">Complete Score</option>
                {(ROLES_BY_KEY[rk]||[]).map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              {scoreMode!=='complete'&&<div style={{fontSize:9,color:'#60a5fa',marginTop:3}}>Sorted by {scoreMode} career avg</div>}
            </div>
            <div style={T.fg}>
              <span style={T.fl}>Filter by Role</span>
              <select style={T.sel} value={roleFilter} onChange={e=>{const v=e.target.value;setRoleFilter(v);if(v){setRoleFilters(s=>{const n=new Set(s);n.has(v)?n.delete(v):n.add(v);return n;});}else{setRoleFilters(new Set());}setPage(0);}}>
                <option value="">Any role</option>
                {(ROLES_BY_KEY[rk]||[]).map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            {roleFilter&&(
              <div style={T.fg}>
                <span style={T.fl}>Min {roleFilter}: <strong style={{color:'#60a5fa'}}>{roleScoreMin}</strong></span>
                <input type="range" style={T.sl} min={40} max={95} step={1} value={roleScoreMin} onChange={e=>{setRoleScoreMin(Number(e.target.value));setPage(0);}}/>
              </div>
            )}
          </>)}

          <div style={T.dv}/>

          {/* Season + mode toggles */}
          <div style={T.fg}>
            <span style={T.fl}>Season</span>
            <select style={T.sel} value={seasonFilter} onChange={e=>{setSeasonFilter(e.target.value);setPage(0);}}>
              <option value="all">All seasons (career avg)</option>
              {ALL_SEASONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={T.fg}>
            <span style={T.fl}>Scoring Options</span>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <label style={T.cr} onClick={()=>{setRawMode(p=>!p);setPage(0);}}>
                <div style={T.cb(rawMode)}>{rawMode&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
                <span style={T.cl(rawMode)}>Raw score (no league weight)</span>
              </label>
              <label style={T.cr} onClick={()=>{setOnlyElite(p=>!p);setPage(0);}}>
                <div style={T.cb(onlyElite)}>{onlyElite&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
                <span style={T.cl(onlyElite)}>Elite in division only</span>
              </label>
            </div>
          </div>

          <div style={T.dv}/>

          {/* LEAGUE PRESETS */}
          <div style={T.fg}>
            <span style={T.fl}>League Presets</span>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
              {Object.keys(PRESET_LEAGUES).map(p=>(
                <button key={p} onClick={()=>{
                  const isActive=activePreset===p;
                  setActivePreset(isActive?'':'');
                  setActivePresetLeagues(isActive?null:[...PRESET_LEAGUES[p]]);
                  if(!isActive){setActiveBands(new Set());setActiveRegions(new Set());}
                  setPage(0);
                }} style={{padding:'3px 7px',borderRadius:5,border:`1px solid ${activePreset===p?'#3b7de8':'#1e2d45'}`,background:activePreset===p?'#0e2040':'transparent',color:activePreset===p?'#60a5fa':'#64748b',fontSize:9.5,fontWeight:activePreset===p?700:400,cursor:'pointer'}}>{p}</button>
              ))}
            </div>
          </div>

          {/* LEAGUE BANDS */}
          <div style={T.fg}>
            <span style={T.fl}>League Bands</span>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
              {[1,2,3,4,5,6].map(b=>(
                <button key={b} onClick={()=>{
                  setActiveBands(prev=>{const n=new Set(prev);n.has(b)?n.delete(b):n.add(b);return n;});
                  setActivePresetLeagues(null);setActivePreset('');setPage(0);
                }} style={{padding:'3px 7px',borderRadius:5,border:`1px solid ${activeBands.has(b)?'#3b7de8':'#1e2d45'}`,background:activeBands.has(b)?'#0e2040':'transparent',color:activeBands.has(b)?'#60a5fa':'#64748b',fontSize:9.5,fontWeight:activeBands.has(b)?700:400,cursor:'pointer'}}>Band {b}</button>
              ))}
            </div>
          </div>

          {/* LEAGUE REGIONS */}
          <div style={T.fg}>
            <span style={T.fl}>Regions</span>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
              {['Europe','South America','North America','Africa','Asia'].map(r=>(
                <button key={r} onClick={()=>{
                  setActiveRegions(prev=>{const n=new Set(prev);n.has(r)?n.delete(r):n.add(r);return n;});
                  setActivePresetLeagues(null);setActivePreset('');setPage(0);
                }} style={{padding:'3px 7px',borderRadius:5,border:`1px solid ${activeRegions.has(r)?'#3b7de8':'#1e2d45'}`,background:activeRegions.has(r)?'#0e2040':'transparent',color:activeRegions.has(r)?'#60a5fa':'#64748b',fontSize:9.5,fontWeight:activeRegions.has(r)?700:400,cursor:'pointer'}}>{r}</button>
              ))}
            </div>
          </div>

          {/* LEAGUE LIST */}
          <div style={T.fg}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
              <span style={T.fl}>Leagues <span style={{color:'#4a5a78',fontSize:9}}>({leagues.size} active)</span></span>
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>{setActivePresetLeagues(null);setActivePreset('');setActiveBands(new Set());setActiveRegions(new Set());setShowHidden(false);setShowYouth(false);setPage(0);}} style={{fontSize:9,padding:'2px 6px',borderRadius:3,border:'1px solid #1e3d7a',background:'#0e2040',color:'#93c5fd',cursor:'pointer',fontWeight:700}}>Default</button>
                <button onClick={()=>{setActivePresetLeagues([...ALL_LEAGUES]);setActivePreset('');setActiveBands(new Set());setActiveRegions(new Set());setPage(0);}} style={{fontSize:9,padding:'2px 6px',borderRadius:3,border:'1px solid #1e3d7a',background:'#0e2040',color:'#93c5fd',cursor:'pointer',fontWeight:700}}>All</button>
                <button onClick={()=>{setActivePresetLeagues([]);setActivePreset('');setActiveBands(new Set());setActiveRegions(new Set());setPage(0);}} style={{fontSize:9,padding:'2px 6px',borderRadius:3,border:'1px solid #1e2d45',background:'#0d1220',color:'#94a3b8',cursor:'pointer',fontWeight:700}}>None</button>
              </div>
            </div>
            {/* Hidden / Youth toggles */}
            <div style={{display:'flex',gap:8,marginBottom:6}}>
              <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer'}} onClick={()=>{
                const next=!showHidden;
                setShowHidden(next);
                // Snapshot current leagues and add/remove hidden ones
                const current=new Set(leagues);
                if(next)[...HIDDEN_LEAGUES].forEach(l=>current.add(l));
                else[...HIDDEN_LEAGUES].forEach(l=>current.delete(l));
                setActivePresetLeagues([...current]);
                setActiveBands(new Set());setActiveRegions(new Set());setPage(0);
              }}>
                <div style={T.cb(showHidden)}>{showHidden&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
                <span style={{fontSize:9.5,color:showHidden?'#e2e8f4':'#94a3b8'}}>Show Hidden</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer'}} onClick={()=>{setShowYouth(p=>!p);setPage(0);}}>
                <div style={T.cb(showYouth)}>{showYouth&&<span style={{color:'#fff',fontSize:8}}>✓</span>}</div>
                <span style={{fontSize:9.5,color:showYouth?'#e2e8f4':'#94a3b8'}}>Show Youth</span>
              </label>
            </div>
            {/* League Strength Range */}
            <div style={{marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:10,color:'#64748b'}}>League Strength: <strong style={{color:'#60a5fa'}}>{lsMin}–{lsMax}</strong></span>
                {(lsMin>0||lsMax<101)&&<button onClick={()=>{setLsMin(0);setLsMax(101);setPage(0);}} style={{fontSize:8,padding:'1px 5px',borderRadius:3,border:'1px solid #1e2d45',background:'transparent',color:'#64748b',cursor:'pointer'}}>Reset</button>}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="number" min={0} max={lsMax-1} value={lsMin} onChange={e=>{setLsMin(Number(e.target.value));setPage(0);}}
                  style={{width:40,background:'#07090f',border:'1px solid #1e2d45',borderRadius:4,color:'#60a5fa',padding:'3px 5px',fontSize:11,fontWeight:700,textAlign:'center',outline:'none'}}/>
                <input type="range" min={0} max={101} step={1} value={lsMin} onChange={e=>{setLsMin(Number(e.target.value));setPage(0);}} style={{flex:1,accentColor:'#3b7de8'}}/>
                <input type="range" min={0} max={101} step={1} value={lsMax} onChange={e=>{setLsMax(Number(e.target.value));setPage(0);}} style={{flex:1,accentColor:'#3b7de8'}}/>
                <input type="number" min={lsMin+1} max={101} value={lsMax} onChange={e=>{setLsMax(Number(e.target.value));setPage(0);}}
                  style={{width:40,background:'#07090f',border:'1px solid #1e2d45',borderRadius:4,color:'#60a5fa',padding:'3px 5px',fontSize:11,fontWeight:700,textAlign:'center',outline:'none'}}/>
              </div>
            </div>
            <div style={{...T.cg,maxHeight:200,overflowY:'auto'}}>
              {[...ALL_LEAGUES].filter(lg=>showHidden||!HIDDEN_LEAGUES.has(lg)).filter(lg=>showYouth||!YOUTH_LEAGUES.has(lg)).sort((a,b)=>a.localeCompare(b)).map(lg=>(
                <label key={lg} style={T.cr} onClick={()=>{
                  const current=new Set(leagues);
                  current.has(lg)?current.delete(lg):current.add(lg);
                  setActivePresetLeagues([...current]);
                  setActiveBands(new Set());setActiveRegions(new Set());setActivePreset('');setPage(0);
                }}>                  <div style={T.cb(leagues.has(lg))}>{leagues.has(lg)&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
                  <span style={T.cl(leagues.has(lg))}>{lg}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={T.dv}/>

          <div style={T.fg}>
            <span style={T.fl}>Age</span>
            <div style={T.rr}>
              <input style={T.ri} type="number" min={14} max={50} value={ageMin} onChange={e=>{setAgeMin(Number(e.target.value));setPage(0);}}/>
              <span style={T.rs}>–</span>
              <input style={T.ri} type="number" min={14} max={50} value={ageMax} onChange={e=>{setAgeMax(Number(e.target.value));setPage(0);}}/>
            </div>
          </div>
          <div style={T.fg}>
            <span style={T.fl}>Min Minutes Played</span>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
              {[0,200,300,500,750,900,1000,1500].map(v=>(
                <button key={v} onClick={()=>{setMinMins(v);setPage(0);}}
                  style={{padding:'3px 8px',borderRadius:10,border:`1px solid ${minMins===v?'#3b7de8':'#1e2d45'}`,background:minMins===v?'#0e2040':'transparent',color:minMins===v?'#60a5fa':'#64748b',fontSize:9.5,fontWeight:minMins===v?700:400,cursor:'pointer'}}>
                  {v===0?'Any':`${v}+`}
                </button>
              ))}
            </div>
          </div>
          <div style={T.fg}>
            <span style={T.fl}>Preferred Foot</span>
            <select style={T.sel} value={foot} onChange={e=>{setFoot(e.target.value);setPage(0);}}>
              {['Any','left','right','both'].map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div style={T.fg}>
            <span style={T.fl}>Height</span>
            <div style={T.rr}>
              <select style={{...T.sel,flex:1,width:0}} value={heightMin} onChange={e=>{setHeightMin(Number(e.target.value));setPage(0);}}>
                {HEIGHT_OPTIONS.map(o=><option key={o.cm} value={o.cm}>{o.label}</option>)}
              </select>
              <span style={T.rs}>–</span>
              <select style={{...T.sel,flex:1,width:0}} value={heightMax} onChange={e=>{setHeightMax(Number(e.target.value));setPage(0);}}>
                {HEIGHT_OPTIONS.map(o=><option key={o.cm} value={o.cm}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={T.fg}>
            <span style={T.fl}>Min Score: <strong style={{color:'#60a5fa'}}>{minScore}</strong></span>
            <input type="range" style={T.sl} min={40} max={85} step={1} value={minScore} onChange={e=>{setMinScore(Number(e.target.value));setPage(0);}}/>
          </div>
          <div style={T.fg}>
            <span style={T.fl}>Min Potential: <strong style={{color:'#60a5fa'}}>{potentialMin<=40?'Any':potentialMin}</strong></span>
            <input type="range" style={T.sl} min={40} max={90} step={1} value={potentialMin} onChange={e=>{setPotentialMin(Number(e.target.value));setPage(0);}}/>
          </div>
          <div style={T.fg}>
            <label style={T.cr} onClick={()=>{setPlayed2526(p=>!p);setPage(0);}}>
              <div style={T.cb(played2526)}>{played2526&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
              <span style={T.cl(played2526)}>Played in 2025-26 only</span>
            </label>
          </div>
          <div style={T.fg}>
            <label style={T.cr} onClick={()=>{setEscOnly(p=>!p);setPage(0);}}>
              <div style={T.cb(escOnly)}>{escOnly&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
              <span style={T.cl(escOnly)}>ESC eligible only</span>
            </label>
            <div style={{marginTop:6}}>
              <div style={{fontSize:10,color:'#94a3b8',marginBottom:3}}>MIN GBE POINTS</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {[0,5,10,15,20,25].map(v=>(
                  <span key={v} onClick={()=>{setGbeMin(v);setPage(0);}} style={{padding:'2px 7px',borderRadius:4,fontSize:10,cursor:'pointer',background:gbeMin===v?'#3b82f6':'#1e293b',color:gbeMin===v?'#fff':'#94a3b8',border:`1px solid ${gbeMin===v?'#3b82f6':'#334155'}`}}>{v===0?'Any':v+'+'}</span>
                ))}
              </div>
            </div>
            <div style={{marginTop:6}}>
              <div style={{fontSize:10,color:'#94a3b8',marginBottom:3}}>NATIONALITY</div>
              <input value={natFilter} onChange={e=>{setNatFilter(e.target.value);setPage(0);}} placeholder="e.g. France, Brazil" style={{width:'100%',background:'#1e293b',border:'1px solid #334155',borderRadius:4,padding:'4px 7px',fontSize:10,color:'#e2e8f4',outline:'none'}}/>
            </div>
            <label style={T.cr} onClick={()=>{setNotPlayingOnly(p=>!p);setPage(0);}}>
              <div style={T.cb(notPlayingOnly)}>{notPlayingOnly&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
              <span style={T.cl(notPlayingOnly)}>Not Playing (mins ↓60%+)</span>
            </label>
            <label style={T.cr} onClick={()=>{setShowShortlist(p=>!p);setPage(0);}}>
              <div style={T.cb(showShortlist)}>{showShortlist&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
              <span style={T.cl(showShortlist)}>★ Shortlist ({shortlist.length})</span>
            </label>
            <div style={{display:'flex',gap:6,marginTop:6}}>
              <button onClick={exportShortlist} title="Download a backup of your shortlist" style={{padding:'3px 8px',borderRadius:6,border:'1px solid #1e2d45',background:'transparent',color:'#64748b',fontSize:9.5,cursor:'pointer'}}>📥 Export</button>
              <button onClick={()=>shortlistFileInputRef.current&&shortlistFileInputRef.current.click()} title="Restore shortlist from a backup file" style={{padding:'3px 8px',borderRadius:6,border:'1px solid #1e2d45',background:'transparent',color:'#64748b',fontSize:9.5,cursor:'pointer'}}>📤 Import</button>
              <input ref={shortlistFileInputRef} type="file" accept="application/json" style={{display:'none'}} onChange={e=>{importShortlistFile(e.target.files[0]);e.target.value='';}}/>
            </div>
            <div style={{fontSize:9,color:'#475569',marginTop:2,lineHeight:1.4}}>Home nations · Continental/Intl history · Youth league · 5+ games Band 1-5 (24-25/25-26)</div>
          </div>
          <div style={T.fg}>
            <span style={T.fl}>Min Seasons: <strong style={{color:'#60a5fa'}}>{minSeas}</strong></span>
            <input type="range" style={T.sl} min={1} max={8} step={1} value={minSeas} onChange={e=>{setMinSeas(Number(e.target.value));setPage(0);}}/>
          </div>

          {/* xValue filters */}
          <div style={T.fg}>
            <span style={T.fl}>xValue Gap Filter</span>
            <select style={T.sel} value={xValueFilter} onChange={e=>{setXValueFilter(e.target.value);setPage(0);}}>
              <option value="">All players</option>
              <option value="undervalued">Undervalued (xVal &gt; MV 20%+)</option>
              <option value="gems">Hidden Gems (xVal &gt; MV 50%+)</option>
              <option value="overvalued">Overvalued (MV &gt; xVal 20%+)</option>
            </select>
          </div>
          <div style={T.fg}>
            <label style={T.cr} onClick={()=>{setShowXValueFilter(p=>!p);setPage(0);}}>
              <div style={T.cb(showXValueFilter)}>{showXValueFilter&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
              <span style={T.cl(showXValueFilter)}>Filter by xValue range</span>
            </label>
            {showXValueFilter&&(
              <div style={{marginTop:6}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                    <span style={{fontSize:8,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.08em'}}>Min £m</span>
                    <input type="number" min={0} max={xValueMax-1} step={0.5} value={xValueMin}
                      onChange={e=>{setXValueMin(Number(e.target.value));setPage(0);}}
                      style={{width:52,background:'#07090f',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',padding:'4px 6px',fontSize:12,fontWeight:700,textAlign:'center',outline:'none'}}/>
                  </div>
                  <div style={{flex:1,height:2,background:'#3b7de8',borderRadius:2,marginTop:10}}/>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                    <span style={{fontSize:8,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.08em'}}>Max £m</span>
                    <input type="number" min={xValueMin+1} max={200} step={0.5} value={xValueMax}
                      onChange={e=>{setXValueMax(Number(e.target.value));setPage(0);}}
                      style={{width:52,background:'#07090f',border:'1px solid #3b7de8',borderRadius:5,color:'#60a5fa',padding:'4px 6px',fontSize:12,fontWeight:700,textAlign:'center',outline:'none'}}/>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metric filters */}
          <div style={T.fg}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <span style={T.fl}>Metric Filters ({metricFilters.length}/10)</span>
              {metricFilters.length<10&&<button onClick={addMetricFilter} style={{fontSize:9,padding:'2px 8px',borderRadius:3,border:'1px solid #1e3d7a',background:'#0e2040',color:'#93c5fd',cursor:'pointer',fontWeight:700}}>+ Add</button>}
            </div>
            {metricFilters.map((mf,i)=>(
              <MetricFilterRow key={i} filter={mf}
                onChange={v=>{setMetricFilters(f=>{const n=[...f];n[i]=v;return n;});setPage(0);}}
                onRemove={()=>{setMetricFilters(f=>f.filter((_,j)=>j!==i));setPage(0);}}/>
            ))}
          </div>

          <div style={T.fg}>
            <label style={T.cr} onClick={()=>{setShowMvFilter(p=>!p);setPage(0);}}>
              <div style={T.cb(showMvFilter)}>{showMvFilter&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
              <span style={T.cl(showMvFilter)}>Filter by Market Value</span>
            </label>
            {showMvFilter&&<div style={{marginTop:6}}><span style={{fontSize:9,color:'#94a3b8',display:'block',marginBottom:4}}>Max: <strong style={{color:'#60a5fa'}}>£{mvMax}m</strong></span><input type="range" style={T.sl} min={0} max={50} step={0.5} value={mvMax} onChange={e=>{setMvMax(Number(e.target.value));setPage(0);}}/></div>}
          </div>
          <div style={T.fg}>
            <label style={T.cr} onClick={()=>{setShowContractFilter(p=>!p);setPage(0);}}>
              <div style={T.cb(showContractFilter)}>{showContractFilter&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}</div>
              <span style={T.cl(showContractFilter)}>Filter by Contract</span>
            </label>
            {showContractFilter&&<div style={{marginTop:6}}><span style={{fontSize:9,color:'#94a3b8',display:'block',marginBottom:4}}>Expires before: <strong style={{color:'#60a5fa'}}>{contractBefore}</strong></span><input type="range" style={T.sl} min={2025} max={2030} step={1} value={contractBefore} onChange={e=>{setContractBefore(Number(e.target.value));setPage(0);}}/></div>}
          </div>

          <button style={T.rb} onClick={reset}>Reset all filters</button>
        </aside>

        <main style={T.main}>
          <div style={T.statsBar}>
            <div style={T.si}><div style={T.sv}>{stats.count.toLocaleString()}</div><div style={T.sl2}>Found</div></div>
            <div style={T.sdv}/>
            <div style={T.si}><div style={T.sv}>{stats.avg.toFixed(1)}</div><div style={T.sl2}>Avg Score</div></div>
            <div style={T.sdv}/>
            <div style={T.si}><div style={T.sv}>{stats.avgAge.toFixed(1)}</div><div style={T.sl2}>Avg Age</div></div>
            <div style={T.sdv}/>
            <div style={T.si}><div style={T.sv}>{stats.elite}</div><div style={T.sl2}>Score 80+</div></div>
            <div style={{marginLeft:'auto',display:'flex',gap:3,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{position:'relative'}}>
                <button onClick={()=>setShowColPicker(p=>!p)} style={{padding:'4px 9px',borderRadius:4,border:'1px solid #1e2d45',background:showColPicker?'#0e2040':'transparent',color:'#94a3b8',fontSize:10,fontWeight:600,cursor:'pointer'}}>⊞ Columns</button>
                {showColPicker&&(
                  <div style={{position:'absolute',right:0,top:30,background:'#0d1220',border:'1px solid #1e2d45',borderRadius:8,padding:'10px',zIndex:50,minWidth:160,boxShadow:'0 4px 20px rgba(0,0,0,.5)'}}>
                    <div style={{fontSize:9,color:'#94a3b8',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Show / Hide Columns</div>
                    {[['marketValue','Mkt Val'],['xValue','xValue'],['xValueGapPct','Value Gap'],['peakScore','Peak'],['seasons','Seasons'],['potentialScore','Potential'],['contract','Contract']].map(([col,label])=>(
                      <label key={col} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',marginBottom:5}} onClick={()=>setHiddenCols(p=>{const n=new Set(p);n.has(col)?n.delete(col):n.add(col);return n;})}>
                        <div style={{width:12,height:12,borderRadius:2,border:`1px solid ${!hiddenCols.has(col)?'#3b7de8':'#475569'}`,background:!hiddenCols.has(col)?'#3b7de8':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          {!hiddenCols.has(col)&&<span style={{color:'#fff',fontSize:8,lineHeight:1}}>✓</span>}
                        </div>
                        <span style={{fontSize:11,color:!hiddenCols.has(col)?'#e2e8f4':'#94a3b8'}}>{label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {['careerScore','potentialScore','peakScore','xValue','xValueGapPct','age',...(scoreMode!=='complete'||roleFilter?['roleScore']:[])].map(col=>(
                <button key={col} onClick={()=>onSort(col)} style={{padding:'4px 9px',borderRadius:4,border:`1px solid ${sort.col===col?'#3b7de8':'#1e2d45'}`,background:sort.col===col?'#0e2040':'transparent',color:sort.col===col?'#93c5fd':'#94a3b8',fontSize:10,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                  {col==='careerScore'?'Career':col==='potentialScore'?'Potential':col==='peakScore'?'Peak':col==='xValue'?'xValue':col==='xValueGapPct'?'Value Gap':col==='age'?'Age':'Role'}{sort.col===col?(sort.asc?' ↑':' ↓'):''}
                </button>
              ))}
            </div>
          </div>

          <div style={T.tw}>
            {sorted.length===0
              ?<div style={T.es}><div style={{fontSize:26}}>⚽</div><div style={{fontSize:12,color:'#94a3b8'}}>{showYouth?'Youth league players not in current data — will appear after next pipeline rebuild':'No players match filters'}</div></div>
              :(
                <table style={T.tbl}>
                  <thead style={T.th_}><tr>
                    <th style={{...T.th,width:30,textAlign:'center'}}>#</th>
                    <th style={{...T.th,width:34}}/>
                    <Th col="name" label="Player" sort={sort} onSort={onSort}/>
                    <th style={T.th}>Club</th>
                    <th style={T.th}>League</th>
                    <Th col="age" label="Age" sort={sort} onSort={onSort}/>
                    <th style={T.th}>Foot</th>
                    <th style={T.th}>Best Role</th>
                    <Th col="careerScore" label={colLabel} sort={sort} onSort={onSort}/>
                    {scoreMode!=='complete'&&<th style={{...T.th,color:'#60a5fa'}}>Role Avg</th>}
                    {!hiddenCols.has('peakScore')&&<Th col="peakScore" label="Peak" sort={sort} onSort={onSort}/>}
                    {!hiddenCols.has('seasons')&&<th style={T.th}>Seasons</th>}
                    {!hiddenCols.has('potentialScore')&&<Th col="potentialScore" label="Potential" sort={sort} onSort={onSort}/>}
                    {!hiddenCols.has('xValue')&&<Th col="xValue" label="xValue" sort={sort} onSort={onSort}/>}
                    {!hiddenCols.has('xValueGapPct')&&<th style={T.th}>vs MV</th>}
                    {!hiddenCols.has('marketValue')&&<th style={T.th}>Mkt Val</th>}
                    {!hiddenCols.has('contract')&&<th style={T.th}>Contract</th>}
                  </tr></thead>
                  <tbody>
                    {pageData.map((p,i)=>{
                      const rcs=p.roleCareerScores||{};
                      const bestEntry=Object.entries(rcs).sort((a,b)=>b[1]-a[1])[0];
                      const bestRole=bestEntry?bestEntry[0]:'—';
                      const ds=getDisplayScore(p)??p.careerScore;
                      const roleModeScore=scoreMode!=='complete'?(rcs[scoreMode]||null):null;
                      const promo=promotionBadge(p.careerScore,p.league);
                      const ls=LEAGUE_STRENGTHS[p.league]||50;
                      return(
                        <tr key={p.id} className="rh" onClick={()=>setSel(p)}>
                          <td style={{...T.td,textAlign:'center',color:'#64748b',fontSize:10}}>{page*PAGE+i+1}</td>
                          <td style={T.td}><Photo name={p.name} team={p.team} size={30}/></td>
                          <td style={T.td}>
                            <span style={{display:'flex',alignItems:'center',gap:4}}>
                              <span onClick={e=>{e.stopPropagation();toggleShortlist(p.id);}} style={{cursor:'pointer',fontSize:14,opacity:shortlist.includes(p.id)?1:0.3}} title={shortlist.includes(p.id)?'Remove from shortlist':'Add to shortlist'}>{shortlist.includes(p.id)?'★':'☆'}</span>
                              {(()=>{const passRaw=p.passportCountries&&p.passportCountries!=='nan'?p.passportCountries:'';const birthRaw=p.birthCountry&&p.birthCountry!=='nan'?p.birthCountry:'';const p1=(passRaw||birthRaw).split(',')[0].trim();const code=countryToIso2(p1);return code?<img src={'https://flagcdn.com/w20/'+code+'.png'} alt="" style={{width:16,height:12,objectFit:'cover',borderRadius:1,flexShrink:0}}/>:null;})()}
                              <span style={{fontWeight:600}}>{p.name}</span>
                            </span>
                          </td>
                          <td style={T.td}><div style={{display:'flex',alignItems:'center',gap:5}}><Crest id={p.teamFotmobId} name={p.team} size={16}/><span style={{...T.tdm,fontSize:11}}>{p.team}</span></div></td>
                          <td style={{...T.td,...T.tdm,fontSize:11}}>{p.league}</td>
                          <td style={T.td}>{p.age}</td>
                          <td style={T.td}>{p.foot&&p.foot!=='unknown'&&p.foot!=='nan'?<span style={T.fp(p.foot)}>{formatFoot(p.foot)}</span>:<span style={{color:'#64748b'}}>—</span>}</td>
                          <td style={T.td}><span style={T.rp}>{bestRole}</span></td>
                          <td style={T.td}>
                            <div style={{display:'flex',flexDirection:'column',gap:2}}>
                              <div style={{display:'flex',alignItems:'center',gap:4}}>
                                <div style={{width:6,height:6,borderRadius:'50%',background:scoreBandColor(ds),flexShrink:0}}/>
                                <span style={{fontWeight:700,color:scoreBandColor(ds)}}>{ds.toFixed(1)}</span>
                              </div>
                              <StarDisplay score={ds}/>
                              {promo&&<span style={{fontSize:8,color:'#22c55e',fontWeight:600}}>{promo}</span>}
                            </div>
                          </td>
                          {scoreMode!=='complete'&&<td style={T.td}>{roleModeScore!=null?<span style={{fontWeight:700,color:scoreBandColor(roleModeScore)}}>{roleModeScore.toFixed(1)}</span>:<span style={{color:'#64748b'}}>—</span>}</td>}
                          {!hiddenCols.has('peakScore')&&<td style={{...T.td,color:'#94a3b8'}}>{p.peakScore.toFixed(1)}</td>}
                          {!hiddenCols.has('seasons')&&<td style={{...T.td,color:'#94a3b8'}}>{p.seasons}</td>}
                          {!hiddenCols.has('potentialScore')&&<td style={T.td}><div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',flexShrink:0}}/><span style={{fontWeight:600,color:'#22c55e',fontSize:11}}>{(p.potentialScore||p.careerScore).toFixed(1)}</span></div></td>}
                          {!hiddenCols.has('xValue')&&<td style={T.td}>{p.xValue?<span style={{fontSize:11,fontWeight:700,color:'#93c5fd'}}>{formatMV(p.xValue)}</span>:<span style={{color:'#475569'}}>—</span>}</td>}
                          {!hiddenCols.has('xValueGapPct')&&<td style={T.td}>{p.xValue&&p.marketValue>0&&p.xValueGapPct!=null?<span style={{fontSize:11,fontWeight:700,color:p.xValueGapPct>20?'#22c55e':p.xValueGapPct<-20?'#ef4444':'#94a3b8'}}>{p.xValueGapPct>0?'+':''}{p.xValueGapPct.toFixed(0)}%</span>:<span style={{color:'#475569'}}>—</span>}</td>}
                          {!hiddenCols.has('marketValue')&&<td style={{...T.td,color:'#94a3b8'}}>{formatMV(p.marketValue)}</td>}
                          {!hiddenCols.has('contract')&&<td style={{...T.td,color:p.contractYear<=2026?'#fbbf24':'#94a3b8',fontSize:11}}>{p.contract&&p.contract!=='nan'?p.contract:'—'}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            }
          </div>

          {totalPages>1&&(
            <div style={T.pg}>
              <span style={{fontSize:9,color:'#64748b',marginRight:4}}>{page*PAGE+1}–{Math.min((page+1)*PAGE,sorted.length)} of {sorted.length.toLocaleString()}</span>
              {[...Array(Math.min(totalPages,12))].map((_,i)=><button key={i} onClick={()=>setPage(i)} style={T.pb(page===i)}>{i+1}</button>)}
              {totalPages>12&&<span style={{color:'#64748b',fontSize:9}}>…{totalPages}</span>}
            </div>
          )}
        </main>
      </div>)}

      {sel&&<PlayerCard player={sel} players={all} onClose={()=>setSel(null)} rawMode={rawMode}/>}
    </div>
  );
}
