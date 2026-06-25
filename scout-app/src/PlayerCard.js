import React, { useRef, useEffect, useState } from 'react';
import { scoreBandColor, formatMV, formatFoot, ROLE_KEY_LABELS, divColor, LEAGUE_STRENGTHS, scoreLabel, scoreToStars, starLabel, POSITION_ATTRIBUTES, playerHasAttribute, GBE_LEAGUE_BANDS } from './constants';

const APP_ROLES = {
  GK:  ['Shot Stopper GK','Ball Playing GK','Sweeper GK'],
  CB:  ['Ball Playing CB','Wide CB','Box Defender'],
  FB:  ['Build Up FB','Attacking FB','Defensive FB'],
  CM:  ['Deep Playmaker CM','Advanced Playmaker CM','Defensive CM','Ball Carrying CM','Goal Threat CM'],
  ATT: ['Playmaker ATT','Goal Threat ATT','Ball Carrier ATT'],
  CF:  ['Target Man CF','Goal Threat CF','Link Up CF'],
};
const TOKEN_TO_POS_KEY = {
  GK:'GK', CB:'CB', LCB:'CB', RCB:'CB',
  LB:'FB', RB:'FB', LWB:'FB', RWB:'FB',
  DMF:'CM', LDMF:'CM', RDMF:'CM', LCMF:'CM', RCMF:'CM',
  AMF:'ATT', LAMF:'ATT', LW:'ATT', LWF:'ATT', RAMF:'ATT', RW:'ATT', RWF:'ATT',
  CF:'CF',
};

const COUNTRY_CODES = {'England':'gb-eng','Scotland':'gb-sct','Wales':'gb-wls','Northern Ireland':'gb-nir','Ireland':'ie','Republic of Ireland':'ie','France':'fr','Germany':'de','Spain':'es','Italy':'it','Portugal':'pt','Netherlands':'nl','Belgium':'be','Brazil':'br','Argentina':'ar','USA':'us','Mexico':'mx','Colombia':'co','Uruguay':'uy','Chile':'cl','Paraguay':'py','Ecuador':'ec','Peru':'pe','Venezuela':'ve','Morocco':'ma','Algeria':'dz','Egypt':'eg','Nigeria':'ng','Tunisia':'tn','South Africa':'za','Senegal':'sn','Ghana':'gh','Ivory Coast':'ci','Cameroon':'cm','Mali':'ml','Guinea':'gn','Japan':'jp','Korea':'kr','Saudi Arabia':'sa','Australia':'au','China':'cn','Turkey':'tr','Ukraine':'ua','Russia':'ru','Poland':'pl','Czech Republic':'cz','Hungary':'hu','Romania':'ro','Serbia':'rs','Croatia':'hr','Slovakia':'sk','Slovenia':'si','Bulgaria':'bg','Greece':'gr','Austria':'at','Switzerland':'ch','Denmark':'dk','Sweden':'se','Norway':'no','Finland':'fi','Iceland':'is','Albania':'al','Bosnia':'ba','Kosovo':'xk','North Macedonia':'mk','Montenegro':'me','Armenia':'am','Georgia':'ge','Azerbaijan':'az','Kazakhstan':'kz','Latvia':'lv','Lithuania':'lt','Estonia':'ee','Moldova':'md','Belarus':'by','Iceland':'is','Canada':'ca','Panama':'pa','Costa Rica':'cr','Jamaica':'jm','Trinidad and Tobago':'tt','Martinique':'mq','Guadeloupe':'gp','Curacao':'cw','Honduras':'hn','Guatemala':'gt','El Salvador':'sv','Nicaragua':'ni','Haiti':'ht','Dominican Republic':'do','Cuba':'cu','Angola':'ao','Zambia':'zm','Zimbabwe':'zw','Mozambique':'mz','Tanzania':'tz','Kenya':'ke','Uganda':'ug','Ethiopia':'et','Sudan':'sd','Libya':'ly','Mauritania':'mr','Sierra Leone':'sl','Liberia':'lr','Guinea-Bissau':'gw','Gambia':'gm','Burkina Faso':'bf','Niger':'ne','Chad':'td','Benin':'bj','Togo':'tg','Rwanda':'rw','Burundi':'bi','DR Congo':'cd','Congo':'cg','Gabon':'ga','Equatorial Guinea':'gq','Comoros':'km','Cape Verde':'cv','Sao Tome':'st','Israel':'il','Lebanon':'lb','Jordan':'jo','Syria':'sy','Iraq':'iq','Iran':'ir','Kuwait':'kw','Qatar':'qa','UAE':'ae','Bahrain':'bh','Oman':'om','Yemen':'ye','Afghanistan':'af','Pakistan':'pk','India':'in','Sri Lanka':'lk','Bangladesh':'bd','Nepal':'np','Thailand':'th','Vietnam':'vn','Indonesia':'id','Malaysia':'my','Philippines':'ph','Myanmar':'mm','Cambodia':'kh','Laos':'la','Mongolia':'mn','New Zealand':'nz','Papua New Guinea':'pg','Fiji':'fj','Palestine':'ps','Kosovo':'xk','Taiwan':'tw','Hong Kong':'hk','Bolivia':'bo'};
function flagUrl(country) {
  if(!country) return '';
  const parts = country.split(',');
  for(const p of parts) {
    const c = p.trim();
    const code = COUNTRY_CODES[c];
    if(code) return `https://flagcdn.com/w20/${code}.png`;
  }
  return '';
}
import { openOnePager } from './PlayerOnePager';
import { Photo, Crest } from './utils';
import ScoutingCardModal from './ScoutingCardModal';

const INTERNATIONAL_LEAGUES = new Set(['UEFA WC Qualifiers.','UEFA U21 Euros.','UEFA U19 Euros.','Asia WC Qualifiers.','AFCON.','AFCON U20.','AFCON U17.','AFCON Qualifiers.','S.America Qualifiers.','U20 World Cup.','U17 World Cup.']);
const CONTINENTAL_LEAGUES = new Set(['Conference League.','Conference League Qualifiers.','Europa League.','Europa League Qualifiers.','Champions League.','Champions League Qualifiers.','Asia Champions League.','Africa Champions League.','Copa Libertadores.','U20 Copa.','Club World Cup.','UEFA Youth League.']);

const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';
const SEC = { fontSize:9, fontWeight:700, color:'#c8d4e8', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10 };
const GRP_LABELS = { D:'Defensive', P:'Possession', A:'Attacking' };

function Stars({ score, size=14 }) {
  const stars = scoreToStars(score);
  const full = Math.floor(stars);
  const frac = stars - full;
  const empty = 5 - Math.ceil(stars);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:1.5 }}>
      {[...Array(full)].map((_,i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#f59e0b" stroke="none"/>
        </svg>
      ))}
      {frac > 0.1 && (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <defs>
            <linearGradient id={`sg${score}`}>
              <stop offset={`${Math.round(frac*100)}%`} stopColor="#f59e0b"/>
              <stop offset={`${Math.round(frac*100)}%`} stopColor="#334155"/>
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#sg${score})`} stroke="none"/>
        </svg>
      )}
      {[...Array(empty)].map((_,i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#334155" stroke="none"/>
        </svg>
      ))}
      <span style={{ fontSize:size*0.75, color:'#64748b', marginLeft:3 }}>{stars.toFixed(1)}</span>
    </div>
  );
}

function Bar({ label, pct, val }) {
  const v = Math.round(pct||0);
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,minHeight:20}}>
      <div style={{width:138,fontSize:11,color:v>=70?'#e2e8f4':v<=30?'#f87171':'#94a3b8',textAlign:'right',flexShrink:0,fontWeight:v>=70?600:400}}>{label}</div>
      <div style={{flex:1,background:'#0c1120',borderRadius:3,height:7,position:'relative'}}>
        <div style={{width:`${v}%`,height:'100%',borderRadius:3,background:divColor(v),transition:'width 0.4s'}}/>
        <div style={{position:'absolute',left:'50%',top:-1,width:1,height:9,background:'#1e2d45'}}/>
      </div>
      <div style={{width:26,fontSize:11,fontWeight:800,color:divColor(v),textAlign:'right',flexShrink:0}}>{v}</div>
      {val!=null&&<div style={{width:42,fontSize:10,color:'#475569',textAlign:'right',flexShrink:0}}>{typeof val==='number'?val.toFixed(2):val}</div>}
    </div>
  );
}

function Tag({label,bg='#0e1e38',color='#7eb3f8'}) {
  return <span style={{padding:'2px 8px',borderRadius:8,background:bg,color,fontSize:10.5,fontWeight:600,display:'inline-block'}}>{label}</span>;
}

function TabBtn({label,active,onClick}) {
  return <button onClick={onClick} style={{padding:'10px 16px',background:'none',border:'none',borderBottom:`2px solid ${active?'#3b7de8':'transparent'}`,color:active?'#93c5fd':'#64748b',fontSize:11,fontWeight:700,cursor:'pointer',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>{label}</button>;
}

function Trajectory({history:historyProp,showForecast,estPeakScore,rawMode=false}) {
  const ref=useRef(null);
  useEffect(()=>{
    const canvas=ref.current;
    if(!canvas) return;
    const history=(historyProp||[]).filter(h=>h.sc!=null);
    if(history.length<2) return;
    const W=canvas.offsetWidth||700,H=150;
    const dpr=window.devicePixelRatio||1;
    canvas.width=W*dpr;canvas.height=H*dpr;
    canvas.style.width=W+'px';canvas.style.height=H+'px';
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H);
    const pad={t:12,r:20,b:28,l:34};
    const pw=W-pad.l-pad.r,ph=H-pad.t-pad.b;
    const scores=history.map(h=>rawMode?(h.r??h.sc):h.sc);
    const allScores=showForecast&&estPeakScore?[...scores,estPeakScore]:scores;
    const minS=Math.max(40,Math.min(...allScores)-8),maxS=Math.min(100,Math.max(...allScores)+10);
    const n=history.length;
    const xS=i=>pad.l+(i/Math.max(n-1,1))*pw;
    const yS=v=>pad.t+ph-((v-minS)/(maxS-minS||1))*ph;
    [0.25,0.5,0.75,1].forEach(f=>{
      const y=pad.t+ph*(1-f);
      ctx.strokeStyle='#131c2e';ctx.lineWidth=0.7;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+pw,y);ctx.stroke();
      ctx.fillStyle='#94a3b8';ctx.font='9px Inter,sans-serif';ctx.textAlign='right';
      ctx.fillText(Math.round(minS+f*(maxS-minS)),pad.l-4,y+3);
    });
    const pts=history.map((h,i)=>({x:xS(i),y:yS(h.sc),...h}));
    ctx.beginPath();ctx.moveTo(pts[0].x,ph+pad.t);
    pts.forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.lineTo(pts[pts.length-1].x,ph+pad.t);ctx.closePath();
    ctx.fillStyle='rgba(59,125,232,0.08)';ctx.fill();
    ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.strokeStyle='#3b7de8';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
    if(showForecast&&estPeakScore&&estPeakScore>scores[scores.length-1]){
      const lx=pts[pts.length-1].x,ly=pts[pts.length-1].y;
      const py2=yS(Math.min(estPeakScore,maxS-1));
      ctx.beginPath();ctx.setLineDash([4,4]);
      ctx.moveTo(lx,ly);ctx.lineTo(lx+pw*0.25,py2);
      ctx.strokeStyle='#22c55e';ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#22c55e';ctx.font='9px Inter,sans-serif';ctx.textAlign='left';
      ctx.fillText(`Proj: ${estPeakScore.toFixed(0)}`,lx+pw*0.25+4,py2+3);
    }
    pts.forEach(p=>{
      ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);
      ctx.fillStyle='#3b7de8';ctx.fill();ctx.strokeStyle='#07090f';ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#94a3b8';ctx.font='8px Inter,sans-serif';ctx.textAlign='center';
      ctx.fillText(p.s.replace('20','').replace('-','/'),p.x,H-4);
      ctx.fillStyle='#e2e8f4';ctx.font='bold 9px Inter,sans-serif';ctx.textAlign='center';
      ctx.fillText(p.sc.toFixed(0),p.x,p.y-7);
    });
  },[historyProp,showForecast,estPeakScore,rawMode]);
  return <canvas ref={ref} style={{display:'block',width:'100%',height:150,borderRadius:6,background:'#07090f'}}/>;
}

function ScoreCard({label,score,league,sub,showStars=true}) {
  const color = scoreBandColor(score);
  const lbl = scoreLabel(score);
  return (
    <div style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:9,padding:'12px',textAlign:'center'}}>
      <div style={{fontSize:8,fontWeight:700,color:'#94a3b8',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>{label}</div>
      <div style={{fontSize:24,fontWeight:800,color,lineHeight:1}}>{typeof score==='number'?score.toFixed(1):score}</div>
      <div style={{fontSize:10,color,marginTop:3,fontWeight:600,lineHeight:1.2}}>{lbl}</div>

      {showStars&&typeof score==='number'&&(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,marginTop:5}}>
          <Stars score={score} size={12}/>
          <div style={{fontSize:8,color:'#64748b',textAlign:'center'}}>{starLabel(scoreToStars(score))}</div>
        </div>
      )}
      {sub&&<div style={{fontSize:9,color:'#475569',marginTop:3}}>{sub}</div>}
    </div>
  );
}

function ForecastTab({player}) {
  const fc=player.forecast||{};
  const history=(player.sh||[]).filter(h=>h.sc!=null);
  if(history.length<2) return <div style={{color:'#475569',fontSize:12,padding:16}}>Insufficient data.</div>;
  const scores=history.map(h=>h.sc);
  const n=scores.length;
  const xs=scores.map((_,i)=>i);
  const meanX=xs.reduce((a,b)=>a+b)/n;
  const meanY=scores.reduce((a,b)=>a+b)/n;
  const slope=xs.reduce((s,x,i)=>s+(x-meanX)*(scores[i]-meanY),0)/xs.reduce((s,x)=>s+(x-meanX)**2,0.001);
  const recentAvg=scores.slice(-2).reduce((a,b)=>a+b)/2;
  const proj1=Math.min(95,Math.max(40,recentAvg+slope));
  const trendPts=parseFloat(slope.toFixed(1));
  const trend=trendPts>0.5?'Rising':trendPts<-0.5?'Declining':'Stable';
  const trendColor=trendPts>0.5?'#22c55e':trendPts<-0.5?'#ef4444':'#f59e0b';
  const leagues=[...new Set(history.map(h=>h.l))];
  const latestSd=Object.values(player.seasonsDetail||{})[0]||{};
  const indicators=latestSd.indicators||[];
  const indScore=latestSd.indScore||50;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div>
        <div style={SEC}>Career Trajectory + Projection</div>
        <div style={{background:'#07090f',borderRadius:7,padding:'8px 4px 2px',border:'1px solid #0d1220'}}>
          <Trajectory history={history} showForecast estPeakScore={player.potentialScore}/>
        </div>
      </div>

      {/* Potential + Ceiling with stars */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <ScoreCard label="Potential Score" score={player.potentialScore} league={player.league} showStars/>
        <ScoreCard label="Ceiling" score={player.potentialCeiling||player.potentialScore} league={player.league} showStars/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {[
          {label:'Trajectory',val:trend,color:trendColor,sub:`${trendPts>0?'+':''}${trendPts} pts/season`},
          {label:'1-Season Proj',val:proj1.toFixed(1),color:scoreBandColor(proj1),sub:scoreLabel(proj1)},
          {label:'Peak Age',val:player.estPeakAge,color:'#93c5fd',sub:player.age<player.estPeakAge?`${player.estPeakAge-player.age}yr to peak`:player.age===player.estPeakAge?'At peak age':'Past peak age'},
        ].map(({label,val,color,sub})=>(
          <div key={label} style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:9,padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:9,fontWeight:700,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>{label}</div>
            <div style={{fontSize:22,fontWeight:800,color,lineHeight:1}}>{val}</div>
            <div style={{fontSize:9,color:'#475569',marginTop:3}}>{sub}</div>
          </div>
        ))}
      </div>

      {indicators.length>0&&(
        <div style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:10,padding:'14px'}}>
          <div style={{...SEC,marginBottom:8}}>Potential Indicators</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:10}}>
            {indicators.map(ind=>(
              <div key={ind.label} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:140,fontSize:11,color:ind.pct>=70?'#e2e8f4':'#94a3b8',textAlign:'right',flexShrink:0,fontWeight:ind.pct>=70?600:400}}>{ind.label}</div>
                <div style={{flex:1,background:'#0c1120',borderRadius:3,height:7,position:'relative'}}>
                  <div style={{width:`${Math.round(ind.pct)}%`,height:'100%',borderRadius:3,background:divColor(ind.pct)}}/>
                  <div style={{position:'absolute',left:'50%',top:-1,width:1,height:9,background:'#1e2d45'}}/>
                </div>
                <div style={{width:26,fontSize:11,fontWeight:800,color:divColor(ind.pct),textAlign:'right',flexShrink:0}}>{Math.round(ind.pct)}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:10,color:'#64748b'}}>Composite: <strong style={{color:divColor(indScore)}}>{Math.round(indScore)}</strong></div>
        </div>
      )}

      {fc.comparables&&fc.comparables.length>0&&(
        <div style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:10,padding:'14px'}}>
          <div style={{...SEC,marginBottom:8}}>Comparable Players</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {fc.comparables.map((c,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'1px solid #131c2e'}}>
                <div style={{width:20,fontSize:10,color:'#475569',flexShrink:0,textAlign:'right'}}>{i+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                    <div style={{fontSize:12,color:'#c8d4e8',fontWeight:600}}>{c.name}</div>
                    <span style={{padding:'1px 5px',borderRadius:4,background:c.matchType==='exact'?'#14532d':c.matchType==='tier'?'#1e3a5f':'#292524',color:c.matchType==='exact'?'#22c55e':c.matchType==='tier'?'#60a5fa':'#a8a29e',fontSize:9,fontWeight:700}}>
                      {c.matchType==='exact'?'Same League':c.matchType==='tier'?'Same Tier':'Similar'}
                    </span>
                  </div>
                  <div style={{fontSize:10,color:'#94a3b8'}}>{c.league} · age {c.age} · score {c.score}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:scoreBandColor(c.peak)}}>→ {c.peak}</div>
                  <div style={{fontSize:9,color:'#475569'}}>{scoreLabel(c.peak)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:8,fontSize:9.5,color:'#334155'}}>
            {fc.exactMatches>0?`${fc.exactMatches} exact same-league matches`:' No exact league matches'} + {fc.cohortSize-fc.exactMatches} broader · Weighted median: {fc.cohortMedian} · Top quartile: {fc.cohortTop}
          </div>
        </div>
      )}

      {leagues.length>1&&(
        <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.6,padding:'10px 12px',background:'#0d1624',borderRadius:7,border:'1px solid #1e2d45'}}>
          <strong style={{color:'#e2e8f4'}}>League journey:</strong> {leagues.join(' → ')}
          {trendPts>0.5&&<span style={{color:'#22c55e'}}> · Improving as level rises ✓</span>}
        </div>
      )}

      <div>
        <div style={SEC}>Season by Season</div>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {history.map(h=>(
            <div key={h.s} style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:52,fontSize:10,color:'#94a3b8',flexShrink:0}}>{h.s.replace('20','').replace('-','/')}</div>
              <div style={{width:78,fontSize:10,color:'#94a3b8',flexShrink:0}}>{(h.l||'').replace('England','Eng').replace('Scotland','Sco').replace(' ','')}</div>
              <div style={{width:22,fontSize:10,color:'#94a3b8',flexShrink:0,textAlign:'right'}}>{h.a}</div>
              <div style={{flex:1,background:'#0c1120',borderRadius:3,height:6}}>
                <div style={{width:`${h.sc!=null?Math.min(((h.sc-40)/55)*100,100):0}%`,height:'100%',borderRadius:3,background:h.sc!=null?scoreBandColor(h.sc):'#1e2d45'}}/>
              </div>
              <div style={{width:30,fontSize:11,fontWeight:700,color:h.sc!=null?scoreBandColor(h.sc):'#475569',textAlign:'right'}}>{h.sc!=null?h.sc:'—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{fontSize:10,color:'#334155',lineHeight:1.6,padding:'8px 10px',background:'#070a12',borderRadius:6,border:'1px solid #0d1220'}}>
        <strong style={{color:'#475569'}}>Methodology:</strong> Cohort matching on 9,210 career arcs. Same-league matches weighted 4×, same tier 2×, broader 1×. Fixed peak ages: CB:28, FB:26, CM:28, ATT:27, CF:27. PL players receive +4pt career premium.
      </div>
    </div>
  );
}

const ROLE_METRICS_PC = {
  GK:['Prevented goals per 90','Save rate, %','Exits per 90','Accurate passes, %','Accurate long passes, %'],
  CB:['Aerial duels won, %','Defensive duels won, %','Accurate passes, %','Accurate forward passes, %','Progressive runs per 90','Progressive passes per 90','PAdj Interceptions','Dribbles per 90'],
  FB:['PAdj Interceptions','Defensive duels won, %','Accurate passes, %','Dribbles per 90','Progressive runs per 90','Progressive passes per 90','Passes to final third per 90','xA per 90','Passes to penalty area per 90'],
  CM:['PAdj Interceptions','Defensive duels won, %','Accurate passes, %','Dribbles per 90','Progressive runs per 90','Progressive passes per 90','xA per 90','Non-penalty goals per 90','xG per 90','Key passes per 90'],
  ATT:['Accurate passes, %','Dribbles per 90','Progressive runs per 90','xA per 90','Passes to penalty area per 90','Non-penalty goals per 90','xG per 90','Touches in box per 90'],
  CF:['Dribbles per 90','Progressive runs per 90','xA per 90','Non-penalty goals per 90','xG per 90','Touches in box per 90','Aerial duels won, %'],
};
const MLABEL_PC = {
  'Aerial duels won, %':'Aerial Duel %','Aerial duels per 90':'Aerial Duels',
  'Defensive duels won, %':'Defensive Duel %','Defensive duels per 90':'Defensive Duels',
  'Accurate passes, %':'Pass %','Accurate forward passes, %':'Forward Pass %',
  'Progressive runs per 90':'Progressive Runs','Progressive passes per 90':'Progressive Passes',
  'PAdj Interceptions':'PAdj Interceptions','Dribbles per 90':'Dribbles',
  'Passes to final third per 90':'Passes to F3rd','xA per 90':'xA',
  'Passes to penalty area per 90':'Passes to Box','Non-penalty goals per 90':'Goals: Non-Penalty',
  'xG per 90':'xG','Key passes per 90':'Key Passes','Touches in box per 90':'Touches in Box',
  'Prevented goals per 90':'Goals Prevented','Exits per 90':'Exits',
  'Save rate, %':'Save Rate','Accurate long passes, %':'Long Pass %',
};

function getSimilar(player, allPlayers){
  if(!allPlayers?.length) return [];
  const rk=player.roleKey;
  const keys=ROLE_METRICS_PC[rk]||[];
  const pSd=Object.values(player.seasonsDetail||{})[0]||{};
  const pMets=[...(pSd.g?.A||[]),...(pSd.g?.D||[]),...(pSd.g?.P||[])];
  if(!pMets.length) return [];
  const pls=LEAGUE_STRENGTHS[player.league]||50;

  return allPlayers
    .filter(c=>{
      if(c.id===player.id||c.roleKey!==rk) return false;
      const cls=LEAGUE_STRENGTHS[c.league]||50;
      return Math.abs(cls-pls)<=20; // within ~2 tier band
    })
    .map(c=>{
      const cSd=Object.values(c.seasonsDetail||{})[0]||{};
      const cMets=[...(cSd.g?.A||[]),...(cSd.g?.D||[]),...(cSd.g?.P||[])];
      let sumSq=0,total=0;
      for(const mk of keys){
        const lbl=MLABEL_PC[mk]||mk;
        const p=pMets.find(x=>x[0]===lbl||x[0]===mk);
        const cc=cMets.find(x=>x[0]===lbl||x[0]===mk);
        if(p&&cc){
          const cls=LEAGUE_STRENGTHS[c.league]||50;
          const leaguePenalty=Math.abs(cls-pls)/100*15;
          sumSq+=(p[1]-cc[1])**2;
          total++;
          if(total===1) sumSq+=leaguePenalty**2; // add league penalty once
        }
      }
      if(!total) return null;
      const match=Math.max(0,Math.round(100-Math.sqrt(sumSq/total)*1.8));
      return{...c,_sim:match};
    })
    .filter(Boolean)
    .sort((a,b)=>b._sim-a._sim)
    .slice(0,5);
}

export default function PlayerCard({player,players,onClose,rawMode:rawModeProp=false}) {
  const SEASON_ORDER_ARR=['2025-26','2026','2025','2024-25','2024','2023-24','2023','2022-23','2022','2021-22','2021','2020-21','2020','2019-20','2018-19'];
  const seasons=Object.keys(player.seasonsDetail||{}).sort((a,b)=>{
    const ai=SEASON_ORDER_ARR.indexOf(a); const bi=SEASON_ORDER_ARR.indexOf(b);
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });
  const [selS,setSelS]=useState(seasons[0]||player.season);
  const [tab,setTab]=useState('profile');
  const [grpTab,setGrpTab]=useState('A');
  const [rawModeLocal,setRawModeLocal]=useState(false);
  const [showScoutingCard,setShowScoutingCard]=useState(false);
  const rawMode = rawModeProp || rawModeLocal; // external prop takes precedence
  const sd=(player.seasonsDetail||{})[selS]||{};
  // Raw scores: simple average of sh season scores (no ls weighting)
  // Raw scores: stored during data build as true league-relative (no ls weighting)
  const rawCareer = rawMode ? (player.careerRaw??player.careerScore) : player.careerScore;
  const rawPeak   = rawMode ? (player.peakRaw??player.peakScore) : player.peakScore;
  const rawPot    = rawMode ? Math.min((player.careerRaw??player.careerScore)*1.05+2,94) : (player.potentialScore||player.careerScore);
  // In raw mode, league strength for star calculation = 100 (don't apply league context to stars)
  // In normal mode, stars use absolute scale as always
  const roles=sd.roles||player.latestRoles||player.roleCareerScores||{};
  const strengths=sd.strengths||player.latestStrengths||[];
  const weaknesses=sd.weaknesses||player.latestWeaknesses||[];
  const styles=sd.styles||player.latestStyles||[];
  const groups=sd.g||{};
  const gap=player.peakScore-player.careerScore;
  const ls=LEAGUE_STRENGTHS[player.league]||40;
  const rawPosToken=(player.position||'').split(',')[0].trim();
  const posKey=TOKEN_TO_POS_KEY[rawPosToken]||player.roleKey;
  const validRoles=(posKey&&APP_ROLES[posKey])||[];
  const sortedRoles=Object.entries(roles)
    .filter(([role])=>validRoles.length===0||validRoles.includes(role))
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3);
  const topRole=sortedRoles[0]?.[0];
  const hasUpside=player.potentialScore>player.careerScore+3;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(2,4,10,0.94)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(8px)'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#09111e',border:'1px solid #1e2d45',borderRadius:16,width:'100%',maxWidth:880,maxHeight:'94vh',overflowY:'auto'}}>

        {/* Header */}
        <div style={{background:'#0c1424',borderBottom:'1px solid #1e2d45',padding:'18px 22px',display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{position:'relative',flexShrink:0}}>
            <Photo name={player.name} team={player.team} size={72}/>
            {player.teamFotmobId&&<img src={`${CREST_BASE}${player.teamFotmobId}.png`} onError={e=>e.target.style.display='none'} style={{position:'absolute',bottom:-4,right:-4,width:22,height:22,background:'#0c1424',borderRadius:5,padding:2,border:'1px solid #1e2d45'}} alt=""/>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
              <div style={{fontSize:21,fontWeight:800,color:'#f1f5f9',letterSpacing:'-0.02em'}}>{player.name}</div>
              <div style={{padding:'3px 10px',borderRadius:6,background:scoreBandColor(player.careerScore),color:'#fff',fontSize:14,fontWeight:900}}>{player.careerScore.toFixed(1)}</div>
              {hasUpside&&<div style={{padding:'3px 10px',borderRadius:6,background:'#14532d',color:'#22c55e',fontSize:12,fontWeight:700}}>↑ {player.potentialScore?.toFixed(1)} pot</div>}
            </div>
            <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>{sd.team||player.team} · {sd.league||player.league}</div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              <Tag label={ROLE_KEY_LABELS[player.roleKey]} bg='#0e1e38' color='#93c5fd'/>
              {(()=>{
                const allS=player.allSeasonsSummary||[];
                const freq={};
                allS.forEach(s=>{const tok=(s.pos||s.position||'').split(',')[0].trim();if(tok)freq[tok]=(freq[tok]||0)+1;});
                const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3);
                const colors=['#4ade80','#fbbf24','#fb923c'];
                const bgs=['#0a1e14','#1c1200','#1c0800'];
                return sorted.map(([pos],i)=><Tag key={pos} label={pos} bg={bgs[i]||'#0e1e38'} color={colors[i]||'#94a3b8'}/>);
              })()}
              {topRole&&<Tag label={topRole} bg='#0a1a30' color='#7eb3f8'/>}
              {player.foot&&player.foot!=='unknown'&&player.foot!=='nan'&&<Tag label={formatFoot(player.foot)+' foot'} bg={player.foot==='left'?'#0a1e14':'#0d1624'} color={player.foot==='left'?'#4ade80':'#60a5fa'}/>}
              <Tag label={`Age ${player.age}`} bg='#0d1220' color='#94a3b8'/>
              <Tag label={`${player.seasons} seasons`} bg='#0d1220' color='#94a3b8'/>
              {player.contract&&player.contract!=='nan'&&<Tag label={`📋 ${player.contract}`} bg='#0d1220' color={player.contractYear<=2026?'#fbbf24':'#94a3b8'}/>}
              {(player.birthCountry||player.passportCountries)&&<div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                {(()=>{
                const passRaw=player.passportCountries&&player.passportCountries!=='nan'?player.passportCountries:'';
                const birth=player.birthCountry&&player.birthCountry!=='nan'?player.birthCountry:'';
                const passports=passRaw?passRaw.split(',').map(s=>s.trim()).filter(Boolean):[];
                const allFlags=[...passports];
                if(birth&&!allFlags.includes(birth)) allFlags.push(birth);
                return <>{allFlags.map((ctry,i)=>flagUrl(ctry)?<img key={i} src={flagUrl(ctry)} alt={ctry} title={ctry} style={{width:20,height:15,objectFit:'cover',borderRadius:1,opacity:i>=passports.length?0.7:1}}/>:null)}</>;
              })()}
              </div>}
              {player.marketValue&&<Tag label={`💰 ${formatMV(player.marketValue)}`} bg='#0d1220' color='#94a3b8'/>}
              {player.onLoan&&<Tag label='On Loan' bg='#160f30' color='#a78bfa'/>}
            </div>
          </div>
          <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
            <button onClick={()=>openOnePager(player)} style={{background:'#0e2040',border:'1px solid #3b7de8',color:'#93c5fd',borderRadius:6,padding:'0 10px',height:28,display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
              <span style={{fontSize:13}}>⬇</span> PDF Report
            </button>
            <button onClick={()=>setShowScoutingCard(true)} style={{background:'#3a0e2a',border:'1px solid #ff66c4',color:'#ff8fd4',borderRadius:6,padding:'0 10px',height:28,display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
              <span style={{fontSize:13}}>🖼</span> Scouting Card
            </button>
            <button onClick={onClose} style={{background:'none',border:'1px solid #1e2d45',color:'#94a3b8',borderRadius:6,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,cursor:'pointer'}}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid #1e2d45',background:'#09111e',overflowX:'auto'}}>
          <TabBtn label="Profile" active={tab==='profile'} onClick={()=>setTab('profile')}/>
          <TabBtn label="Forecast & Potential" active={tab==='forecast'} onClick={()=>setTab('forecast')}/>
        </div>

        <div style={{padding:'18px 22px',display:'flex',flexDirection:'column',gap:18}}>

          {rawMode&&<div style={{padding:'6px 14px',background:'#2d1a00',borderBottom:'1px solid #92400e',fontSize:10,color:'#fbbf24',fontWeight:600}}>★ Raw mode — scores show unweighted league percentile (no league strength discount). Stars reflect performance vs league peers only.</div>}
      {tab==='profile'&&(<>
            {/* Score cards with stars */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
              <ScoreCard label={rawMode?'Career (Unweighted)':'Career Score'} score={rawMode?rawCareer:player.careerScore} league={rawMode?null:player.league} showStars/>
              <ScoreCard label={rawMode?'Peak (Unweighted)':'Peak Score'} score={rawMode?rawPeak:player.peakScore} league={rawMode?null:player.league} showStars/>
              <ScoreCard label="Potential" score={player.potentialScore} league={player.league} showStars sub={`ceil: ${(player.potentialCeiling||0).toFixed(1)}`}/>
              <div style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:9,padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:8,fontWeight:700,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>League Strength</div>
                <div style={{fontSize:24,fontWeight:800,color:'#94a3b8',lineHeight:1}}>{ls.toFixed(0)}</div>
                <div style={{fontSize:10,color:'#475569',marginTop:3}}>{player.league}</div>
              </div>
            </div>

            {player.xValue&&(
              <div style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:9,padding:'14px'}}>
                <div style={{...SEC,marginBottom:8}}>xValue Analysis</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
                  {[
                    {label:'xValue',val:formatMV(player.xValue),color:'#93c5fd',sub:'model estimate'},
                    {label:'Actual MV',val:player.marketValue?formatMV(player.marketValue):'No MV data',color:'#94a3b8',sub:player.xValueMvSource==='team_avg'?'used team avg base':player.xValueMvSource==='actual'?'transfermarkt':'estimated'},
                    {label:'Value Gap',val:player.marketValue>0?(player.xValueGapPct>0?'+':'')+player.xValueGapPct?.toFixed(0)+'%':'—',color:player.xValueGapPct>20?'#22c55e':player.xValueGapPct<-20?'#ef4444':'#94a3b8',sub:player.xValueGapPct>20?'Undervalued':player.xValueGapPct<-20?'Overvalued':'Fair value'},
                  ].map(({label,val,color,sub})=>(
                    <div key={label} style={{background:'#07090f',border:'1px solid #131c2e',borderRadius:7,padding:'10px',textAlign:'center'}}>
                      <div style={{fontSize:8,fontWeight:700,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>{label}</div>
                      <div style={{fontSize:18,fontWeight:800,color,lineHeight:1}}>{val}</div>
                      <div style={{fontSize:9,color:'#475569',marginTop:3}}>{sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:12,fontSize:10,color:'#64748b'}}>
                  <span>Performance: <strong style={{color:'#c8d4e8'}}>{player.rawPct?.toFixed(0) ?? player.perfPct?.toFixed(0)}th pct</strong> in league (raw)</span>
                  <span>Multiplier: <strong style={{color:'#c8d4e8'}}>{player.xMultiplier?.toFixed(2)}x</strong></span>
                  <span>Contract: <strong style={{color:'#c8d4e8'}}>{player.xValueContractYrs} yrs</strong>{player.isEnglish&&<span style={{marginLeft:6}}>🏴󠁧󠁢󠁥󠁮󠁧󠁿 English +20%</span>}</span>
                </div>
                <div style={{marginTop:6,fontSize:9,color:'#334155'}}>
                  xValue = base MV adjusted by raw league percentile, then × (performance +50%/+30%) × age × nationality × contract. Gap vs Transfermarkt listing.
                </div>
              </div>
            )}

            {/* Season selector */}
            {seasons.length>0&&(
              <div>
                <div style={SEC}>Season</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {seasons.map(s=>{
                    const sd2=(player.seasonsDetail||{})[s]||{};
                    return <button key={s} onClick={()=>setSelS(s)} style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${selS===s?'#3b7de8':'#1e2d45'}`,background:selS===s?'#0e2040':'transparent',color:selS===s?'#60a5fa':'#64748b',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      {s} <span style={{opacity:.5,fontSize:9}}>{(sd2.league||'').replace('England','Eng').replace('Scotland','Sco').replace(' ','')}</span>
                    </button>;
                  })}
                </div>
                {sd.team&&<div style={{marginTop:6,fontSize:10.5,color:'#64748b'}}><strong style={{color:'#94a3b8'}}>{sd.team}</strong> · {sd.league} · Score: <strong style={{color:scoreBandColor(sd.score||0)}}>{(sd.score||0).toFixed(1)}</strong> · {scoreLabel(sd.score||0)}</div>}
              {/* Season stats */}
              {(player.allSeasonsSummary||[]).length>0&&(
              <div style={{marginTop:10,background:'#07090f',border:'1px solid #131c2e',borderRadius:7,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:'#0d1220'}}>
                    {['Season','Club','League','Apps','Mins','Goals','Assists'].map(h=>(
                      <th key={h} style={{padding:'5px 8px',textAlign:'left',fontSize:9,fontWeight:700,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase',borderBottom:'1px solid #131c2e'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(()=>{const seen=new Set();return (player.allSeasonsSummary||[]).filter(s=>{const k=`${s.s}-${s.l}-${s.team}-${s.mins}`;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>{const ai=SEASON_ORDER_ARR.indexOf(a.s);const bi=SEASON_ORDER_ARR.indexOf(b.s);return (ai===-1?99:ai)-(bi===-1?99:bi);}).map((s,i)=>(
                      <tr key={`${s.s}-${s.l}-${s.team}`} style={{background:i%2===0?'transparent':'#07090f'}}>
                        <td style={{padding:'5px 8px',fontSize:11,color:'#e2e8f4',fontWeight:selS===s.s?700:400,borderBottom:'1px solid #0d1525'}}>{s.s}</td>
                        <td style={{padding:'5px 8px',fontSize:11,color:'#94a3b8',borderBottom:'1px solid #0d1525'}}>{s.team}</td>
                        <td style={{padding:'5px 8px',fontSize:10,color:'#64748b',borderBottom:'1px solid #0d1525'}}>{(s.l||'').replace('England','Eng').replace('Scotland','Sco').replace(' ','')}</td>
                        <td style={{padding:'5px 8px',fontSize:11,color:'#e2e8f4',borderBottom:'1px solid #0d1525'}}>{s.m}</td>
                        <td style={{padding:'5px 8px',fontSize:11,color:'#94a3b8',borderBottom:'1px solid #0d1525'}}>{s.mins?.toLocaleString()}</td>
                        <td style={{padding:'5px 8px',fontSize:11,fontWeight:s.g>0?700:400,color:s.g>0?'#4ade80':'#94a3b8',borderBottom:'1px solid #0d1525'}}>{s.g}</td>
                        <td style={{padding:'5px 8px',fontSize:11,fontWeight:s.a>0?700:400,color:s.a>0?'#60a5fa':'#94a3b8',borderBottom:'1px solid #0d1525'}}>{s.a}</td>
                      </tr>
                    ))})()}
                  </tbody>
                </table>
              </div>
              )}
              </div>
            )}

            {/* Style / strengths / weaknesses */}
            {(styles.length>0||strengths.length>0||weaknesses.length>0)&&(
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {[
                  {label:'Playing Style',items:styles,bg:'#0e1830',color:'#60a5fa'},
                  {label:'Strengths',items:strengths,bg:'#0a1e14',color:'#4ade80'},
                  {label:'Weaknesses',items:weaknesses,bg:'#1a0e0e',color:'#f87171'},
                ].map(({label,items,bg,color})=>(
                  <div key={label} style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:8,padding:'12px'}}>
                    <div style={{fontSize:8,fontWeight:700,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>{label}</div>
                    {items.length>0?<div style={{display:'flex',flexWrap:'wrap',gap:4}}>{items.map(s=><span key={s} style={{padding:'2px 7px',borderRadius:5,background:bg,color,fontSize:10,fontWeight:600}}>{s}</span>)}</div>:<div style={{fontSize:10,color:'#334155'}}>—</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Metric groups */}
            {Object.keys(groups).length>0&&(
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={SEC}>Metric Percentiles — {selS} · vs <span style={{color:'#60a5fa'}}>{sd.position?.split(',')[0]||player.position?.split(',')[0]||ROLE_KEY_LABELS[player.roleKey]||'same position'}</span> in {sd.league||player.league}</div>
                  <div style={{display:'flex',gap:4}}>
                    {Object.keys(GRP_LABELS).filter(k=>groups[k]?.length>0).map(k=>(
                      <button key={k} onClick={()=>setGrpTab(k)} style={{padding:'3px 9px',borderRadius:5,border:`1px solid ${grpTab===k?'#3b7de8':'#1e2d45'}`,background:grpTab===k?'#0e2040':'transparent',color:grpTab===k?'#60a5fa':'#64748b',fontSize:10,fontWeight:700,cursor:'pointer'}}>
                        {GRP_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {(groups[grpTab]||[]).map(([label,pct,val])=>(<Bar key={label} label={label} pct={pct} val={val}/>))}
                </div>
                <div style={{marginTop:6,fontSize:9.5,color:'#334155'}}>Midline = league average (50th pct) · Right value = raw per 90</div>
              </div>
            )}

            {/* Role scores */}
            {sortedRoles.length>0&&(
              <div>
                <div style={SEC}>Role Scores — {selS} (unweighted vs league peers)</div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {sortedRoles.map(([role,score])=>(
                    <div key={role} style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:180,fontSize:11,color:role===topRole?'#c8d4e8':'#64748b',textAlign:'right',flexShrink:0,fontWeight:role===topRole?600:400}}>{role}</div>
                      <div style={{flex:1,background:'#0c1120',borderRadius:3,height:7}}>
                        <div style={{width:`${Math.min(score,100)}%`,height:'100%',borderRadius:3,background:role===topRole?'#3b7de8':'#1e2d45',transition:'width 0.4s'}}/>
                      </div>
                      <div style={{width:26,fontSize:11,fontWeight:800,color:role===topRole?'#93c5fd':divColor(score),textAlign:'right'}}>{Math.round(score)}<span style={{fontSize:8,color:'#475569'}}>%</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Players */}
            {(()=>{
              const similar=getSimilar(player,players);
              if(!similar.length) return null;
              return(
                <div>
                  <div style={SEC}>Similar Players — Within League Band</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {similar.map((p,i)=>(
                      <div key={p.id||p.name} style={{display:'flex',alignItems:'center',gap:10,background:'#07090f',border:'1px solid #131c2e',borderRadius:8,padding:'8px 12px'}}>
                        <div style={{width:18,fontSize:10,fontWeight:700,color:'#475569',textAlign:'center',flexShrink:0}}>#{i+1}</div>
                        <Photo name={p.name} team={p.team} size={30}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:'#e2e8f4',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                          <div style={{fontSize:10,color:'#64748b'}}>{p.team} · {p.league} · Age {p.age}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:13,fontWeight:800,color:scoreBandColor(p.careerScore)}}>{p.careerScore.toFixed(1)}</div>
                          <div style={{fontSize:9,color:'#475569'}}>career</div>
                        </div>
                        <div style={{width:44,textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:13,fontWeight:800,color:p._sim>=70?'#22c55e':p._sim>=50?'#f59e0b':'#64748b'}}>{p._sim}%</div>
                          <div style={{fontSize:9,color:'#475569'}}>match</div>
                        </div>
                        <Crest id={p.teamFotmobId} name={p.team} size={20}/>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Trajectory */}
            {player.sh&&player.sh.length>=2&&(
              <div>
                <div style={SEC}>Career Trajectory</div>
                <div style={{background:'#07090f',borderRadius:7,padding:'8px 4px 2px',border:'1px solid #0d1220'}}>
                  <Trajectory history={player.sh} rawMode={rawMode}/>
                </div>
              </div>
            )}

            {/* GBE / Visa Points — uses pre-computed fields from pipeline */}
            {(()=>{
              const POINTS_SEASONS = new Set(['2025-26','2026','2025']);
              const ESC_SEASONS = new Set(['2025-26','2026','2025','2024-25','2024']);
              const HOME_NATIONS = new Set(['england','scotland','wales','ireland','northern ireland','republic of ireland']);
              const YOUTH_LEAGUES_GBE = new Set(['Sweden 4.','Switzerland 3.','Ukraine 3.','Brazil 4.','Czech 3.','Denmark 4.','Germany 5.','Germany 6.','Italy 5.','Portugal 4.','Serbia 3.','England 7.','England 8.','England 9.','England 10.']);
              const INTL_LEAGUES_GBE = new Set(['UEFA WC Qualifiers.','UEFA U21 Euros.','UEFA U19 Euros.','Asia WC Qualifiers.','AFCON.','AFCON U20.','AFCON U17.','AFCON Qualifiers.','S.America Qualifiers.','U20 World Cup.','U17 World Cup.']);
              const CONT_BAND = {'Champions League.':1,'Europa League.':2,'Conference League.':2,'Copa Libertadores.':2,'Club World Cup.':2,'Asia Champions League.':3,'Africa Champions League.':3,'CAF Champions League.':3};
              const CONT_ESC_ONLY = new Set(['Champions League Qualifiers.','Europa League Qualifiers.','Conference League Qualifiers.','UEFA Youth League.','U20 Copa.']);

              // Use pre-computed if available, otherwise calculate live
              const allS = player.allSeasonsSummary||[];
              const band = player.gbeBand || GBE_LEAGUE_BANDS[player.league]||6;
              const domPts = player.gbeDomPts ?? 0;
              const contPts = player.gbeContPts ?? 0;
              const lqPts = player.gbeLqPts ?? [12,10,8,6,4,2][Math.max(0,Math.min(5,band-1))];
              const finishPts = player.gbeFinishPts ?? 0;
              const progPts = player.gbeProgPts ?? 0;
              const total = player.gbeTotal ?? (domPts+contPts+lqPts+finishPts+progPts);
              const minsPct = player.gbeMinsPct ?? 0;

              // ESC — use pre-computed if available, else calculate
              const birth = (player.birthCountry||'').toLowerCase();
              const passport = (player.passportCountries||'').toLowerCase();
              const isHomeNation = player.escEligible!==undefined ? false : [...HOME_NATIONS].some(n=>birth.includes(n)||passport.includes(n));
              const escEligible = player.escEligible ?? (
                [...HOME_NATIONS].some(n=>birth.includes(n)||passport.includes(n)) ||
                allS.some(s=>(CONT_BAND[s.l]||CONT_ESC_ONLY.has(s.l))&&(s.mins||0)>=1) ||
                allS.some(s=>INTL_LEAGUES_GBE.has(s.l)&&(s.mins||0)>=1) ||
                allS.some(s=>YOUTH_LEAGUES_GBE.has(s.l)&&(s.m||0)>=5) ||
                allS.filter(s=>ESC_SEASONS.has(s.s)&&(GBE_LEAGUE_BANDS[s.l]||6)<=5).reduce((sum,s)=>sum+(s.m||0),0)>=5
              );
              const homeNation = [...HOME_NATIONS].some(n=>birth.includes(n)||passport.includes(n));

              // Find best domestic season for display
              const domSh = allS.filter(s=>POINTS_SEASONS.has(s.s)&&!INTL_LEAGUES_GBE.has(s.l)&&!CONT_BAND[s.l]&&!CONT_ESC_ONLY.has(s.l)&&!YOUTH_LEAGUES_GBE.has(s.l)).sort((a,b)=>(b.mins||0)-(a.mins||0))[0];

              // Only show if player has some GBE-relevant data
              if(!domSh && !allS.some(s=>CONT_BAND[s.l]||INTL_LEAGUES_GBE.has(s.l))) return null;

              let status, statusColor;
              if(homeNation){status='Auto Pass – Home Nation';statusColor='#22c55e';}
              else if(total>=15){status='Pass';statusColor='#22c55e';}
              else if(total>=10){status='Exceptions Panel';statusColor='#f59e0b';}
              else if(escEligible){status='Fail / ESC Eligible';statusColor='#f97316';}
              else{status='Fail';statusColor='#ef4444';}

              // ESC reasons
              const escReasons = [
                homeNation&&'Home nation',
                allS.some(s=>(CONT_BAND[s.l]||CONT_ESC_ONLY.has(s.l))&&(s.mins||0)>=1)&&'Continental history',
                allS.some(s=>INTL_LEAGUES_GBE.has(s.l)&&(s.mins||0)>=1)&&'International history',
                allS.some(s=>YOUTH_LEAGUES_GBE.has(s.l)&&(s.m||0)>=5)&&'Youth league (5+ games)',
                allS.filter(s=>ESC_SEASONS.has(s.s)&&(GBE_LEAGUE_BANDS[s.l]||6)<=5).reduce((sum,s)=>sum+(s.m||0),0)>=5&&'5+ games Band 1-5',
              ].filter(Boolean);

              return(
                <div style={{background:'#0d1624',border:'1px solid #1e2d45',borderRadius:9,padding:'14px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={SEC}>GBE / Visa Points</div>
                    <div style={{padding:'4px 12px',borderRadius:20,background:statusColor+'22',border:`1px solid ${statusColor}`,color:statusColor,fontSize:11,fontWeight:700}}>{status}</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6,marginBottom:10}}>
                    {[
                      {label:'Band',val:`Band ${band}`,sub:domSh?.l||player.league,color:'#94a3b8'},
                      {label:'Minutes',val:(domSh?.mins||0).toLocaleString(),sub:`${minsPct}% · ${domSh?.s||'—'}`,color:'#94a3b8'},
                      {label:'Dom. (T2)',val:domPts,sub:'of 12',color:'#60a5fa'},
                      {label:'Cont. (T3)',val:contPts,sub:'of 10',color:'#60a5fa'},
                      {label:'Band (T6)',val:lqPts,sub:'quality',color:'#60a5fa'},
                      {label:'Finish (T4)',val:finishPts,sub:'of 6',color:'#a78bfa'},
                      {label:'Prog. (T5)',val:progPts,sub:'of 10',color:'#a78bfa'},
                    ].map(({label,val,sub,color})=>(
                      <div key={label} style={{background:'#07090f',borderRadius:7,padding:'8px',textAlign:'center'}}>
                        <div style={{fontSize:8,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>{label}</div>
                        <div style={{fontSize:18,fontWeight:800,color}}>{val}</div>
                        <div style={{fontSize:8,color:'#475569',marginTop:2}}>{sub}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#07090f',borderRadius:7,padding:'8px 12px',marginBottom:8}}>
                    <span style={{fontSize:11,color:'#94a3b8'}}>Estimated Total</span>
                    <span style={{fontSize:20,fontWeight:800,color:statusColor}}>{total} pts</span>
                  </div>
                  {escEligible&&escReasons.length>0&&<div style={{fontSize:9,color:'#f97316',marginBottom:6}}>
                    ESC eligible: {escReasons.join(' · ')}
                  </div>}
                  <div style={{fontSize:9,color:'#475569',lineHeight:1.5}}>
                    T2 (domestic) + T3 (continental mins) + T4 (league finish) + T5 (continental progression) + T6 (league band) · 2025-26/2026/2025 only · 0–9 = Fail · 10–14 = Exceptions Panel · 15+ = Pass
                  </div>
                </div>
              );
            })()}
          </>)}

          {tab==='forecast'&&<ForecastTab player={player}/>}
        </div>
      </div>
      {showScoutingCard&&<ScoutingCardModal player={player} onClose={()=>setShowScoutingCard(false)}/>}
    </div>
  );
}
