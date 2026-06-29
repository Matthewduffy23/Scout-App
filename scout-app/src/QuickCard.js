import React, { useState } from 'react';
import { scoreBandColor, scoreLabel, formatFoot, GBE_LEAGUE_BANDS } from './constants';

// ─── Constants ───────────────────────────────────────────────────────────────
const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';
const CREST_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/crests/';

const APP_ROLES = {
  GK:  ['Shot Stopper GK','Ball Playing GK','Sweeper GK'],
  CB:  ['Ball Playing CB','Wide CB','Box Defender'],
  FB:  ['Build Up FB','Attacking FB','Defensive FB'],
  CM:  ['Deep Playmaker CM','Advanced Playmaker CM','Defensive CM','Defensive','Defensive DM','Ball Carrying CM','Box to Box CM','Goal Threat CM'],
  ATT: ['Playmaker ATT','Goal Threat ATT','Ball Carrier ATT','Wide Creator ATT'],
  CF:  ['Target Man CF','Goal Threat CF','Link Up CF','False 9 CF'],
};

const TOKEN_TO_POS_KEY = {
  GK:'GK', CB:'CB', LCB:'CB', RCB:'CB',
  LB:'FB', RB:'FB', LWB:'FB', RWB:'FB',
  DMF:'CM', LDMF:'CM', RDMF:'CM', LCMF:'CM', RCMF:'CM',
  AMF:'ATT', LAMF:'ATT', LW:'ATT', LWF:'ATT', RAMF:'ATT', RW:'ATT', RWF:'ATT',
  CF:'CF',
};

const ROLE_DISPLAY_NAMES = {
  'Deep Playmaker CM': 'Deep Playmaker',
  'Advanced Playmaker CM': 'Adv. Playmaker CM',
};

const METRIC_LABEL_MAP = {
  'Crosses per 90':'Crosses','Crosses':'Crosses',
  'Accurate crosses, %':'Crossing Accuracy %','Crossing accuracy':'Crossing Accuracy %',
  'Non-penalty goals per 90':'Goals: Non-Penalty','Non-penalty goals':'Goals: Non-Penalty',
  'xG per 90':'xG','xG':'xG',
  'xA per 90':'Expected Assists','xA':'Expected Assists',
  'Offensive duels per 90':'Offensive Duels','Offensive duels':'Offensive Duels',
  'Offensive duels won, %':'Offensive Duel Success %',
  'Progressive runs per 90':'Progressive Runs','Progressive runs':'Progressive Runs',
  'Shots per 90':'Shots','Shots':'Shots',
  'Touches in box per 90':'Touches in Box','Touches in box':'Touches in Box',
  'Shots on target, %':'Shooting Accuracy %',
  'Aerial duels per 90':'Aerial Duels','Aerial duels':'Aerial Duels',
  'Aerial duels won, %':'Aerial Duel Success %',
  'Defensive duels per 90':'Defensive Duels','Defensive duels':'Defensive Duels',
  'Defensive duels won, %':'Defensive Duel Success %',
  'Shots blocked per 90':'Shots Blocked','Shots blocked':'Shots Blocked',
  'PAdj Interceptions':'PAdj. Interceptions','PAdj. Interceptions':'PAdj. Interceptions',
  'Deep completions per 90':'Deep Completions','Deep completions':'Deep Completions',
  'Dribbles per 90':'Dribbles','Dribbles':'Dribbles',
  'Successful dribbles, %':'Dribbling Success %',
  'Key passes per 90':'Key Passes','Key passes':'Key Passes',
  'Passes per 90':'Passes','Passes':'Passes',
  'Accurate passes, %':'Passing %',
  'Passes to penalty area per 90':'Passes to Box','Passes to penalty area':'Passes to Box',
  'Accurate passes to penalty area, %':'Pass to Box %',
  'Smart passes per 90':'Smart Passes','Smart passes':'Smart Passes',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function slugN(s) {
  s = String(s || '').toLowerCase();
  'ø,o|œ,oe|æ,ae|å,a|ä,a|ö,o|ü,u|ß,ss|ł,l|đ,d|ð,d|þ,th|ç,c|ş,s|ğ,g|ı,i'.split('|').forEach(p => {
    const [k, v] = p.split(','); s = s.split(k).join(v);
  });
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

function photoUrl(name, team) {
  const parts = name.trim().split('.');
  let ini, sur;
  if (parts.length >= 2) { ini = parts[0].trim(); sur = parts.slice(1).join('.').trim(); }
  else { const b = name.trim().split(' '); ini = b[0] || ''; sur = b.slice(1).join(' ') || b[0] || ''; }
  const t = String(team || '').trim().split(/\s+/).map(w => slugN(w)).join('_').replace(/^_|_$/g, '');
  return `${PHOTO_BASE}${slugN(ini)}_${slugN(sur)}__${t}.png`;
}

function interp(a, b, t) { return [0,1,2].map(i => Math.round(a[i]+(b[i]-a[i])*t)); }
function parseRgb(s) { return s.match(/\d+/g).map(Number); }
function barColor(pct) {
  const t = Math.max(0, Math.min(1, pct/100));
  const RED = parseRgb('rgb(199,54,60)'), GOLD = parseRgb('rgb(240,197,106)'), GREEN = parseRgb('rgb(61,166,91)');
  const rgb = t <= 0.5 ? interp(RED,GOLD,t/0.5) : interp(GOLD,GREEN,(t-0.5)/0.5);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function scoreColor(v) {
  if (v >= 82) return '#22c55e'; if (v >= 78) return '#4ade80'; if (v >= 72) return '#86efac';
  if (v >= 67) return '#fde047'; if (v >= 61) return '#fb923c'; if (v >= 57) return '#f87171';
  return '#ef4444';
}

// ─── QuickCard component (the actual card HTML) ───────────────────────────────
function QuickCardContent({ player, players }) {
  const allSD = player.seasonsDetail || {};
  const latestSDKey = Object.keys(allSD)[0];
  const sd = latestSDKey ? allSD[latestSDKey] : {};
  const latestSeason = latestSDKey || '—';

  // Role scores
  const posToken = (player.position || '').split(',')[0].trim();
  const posKey = TOKEN_TO_POS_KEY[posToken] || player.roleKey || 'CF';
  const validRoles = APP_ROLES[posKey] || [];
  const rcs = player.roleCareerScores || {};
  const sortedRoles = validRoles
    .map(r => [r, rcs[r] || 0])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  // Strengths / weaknesses
  const strengths = sd.strengths || player.latestStrengths || [];
  const weaknesses = sd.weaknesses || player.latestWeaknesses || [];

  // GBE
  const band = player.gbeBand || (GBE_LEAGUE_BANDS && GBE_LEAGUE_BANDS[player.league]) || 6;
  const domPts   = player.gbeDomPts   ?? 0;
  const contPts  = player.gbeContPts  ?? 0;
  const lqPts    = player.gbeLqPts    ?? [12,10,8,6,4,2][Math.max(0,Math.min(5,band-1))];
  const finishPts= player.gbeFinishPts?? 0;
  const progPts  = player.gbeProgPts  ?? 0;
  const gbeTotal = player.gbeTotal    ?? (domPts+contPts+lqPts+finishPts+progPts);
  const gbeStatus= gbeTotal>=15?'Pass':gbeTotal>=10?'Panel':'Fail';
  const gbeColor = gbeTotal>=15?'#22c55e':gbeTotal>=10?'#f59e0b':'#ef4444';

  // Team context
  const teamPlayers = (players||[]).filter(p=>p.team===player.team&&p.careerScore!=null);
  const squadAvg = teamPlayers.length>0
    ? (teamPlayers.reduce((s,p)=>s+p.careerScore,0)/teamPlayers.length)
    : null;

  // Metric groups from seasonsDetail
  const metricGroups = {
    Attacking: (sd.g?.A || []),
    Defensive: (sd.g?.D || []),
    Possession: (sd.g?.P || []),
  };
  const hasMetrics = Object.values(metricGroups).some(g=>g.length>0);

  const photo = photoUrl(player.name, player.team);
  const crest = player.teamFotmobId ? `${CREST_BASE}${player.teamFotmobId}.png` : '';
  const posLabel = (player.position||'').split(',')[0].trim();
  const foot = formatFoot ? formatFoot(player.foot) : (player.foot||'');

  const SEC = { fontSize:9,fontWeight:700,color:'#475569',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:6 };
  const CARD = { background:'#0d1624',border:'1px solid #1e2d45',borderRadius:8,padding:'10px' };

  return (
    <div style={{background:'#07090f',borderRadius:10,padding:16,fontFamily:'Inter,sans-serif',color:'#e2e8f4',minWidth:720}}>

      {/* ── HEADER ── */}
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14,paddingBottom:12,borderBottom:'1px solid #1e2d45'}}>
        {/* Photo */}
        <div style={{width:68,height:68,borderRadius:'50%',overflow:'hidden',background:'#0d1624',flexShrink:0,border:'2px solid #1e2d45'}}>
          <img src={photo} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';}} alt=""/>
        </div>
        {/* Name / info */}
        <div style={{flex:1}}>
          <div style={{fontSize:22,fontWeight:800,color:'#f1f5f9',lineHeight:1.1}}>{player.name}</div>
          <div style={{fontSize:11,color:'#64748b',marginTop:3,display:'flex',gap:8,flexWrap:'wrap'}}>
            <span>{posLabel}</span>
            {foot && <span>· {foot} foot</span>}
            {player.height && <span>· {player.height}cm</span>}
            {player.age && <span>· Age {player.age}</span>}
          </div>
          <div style={{fontSize:10,color:'#475569',marginTop:2}}>{player.league} · {latestSeason}</div>
        </div>
        {/* Crest + team */}
        <div style={{textAlign:'center',flexShrink:0}}>
          {crest && <img src={crest} style={{width:38,height:38,objectFit:'contain',display:'block',margin:'0 auto'}} onError={e=>{e.target.style.display='none';}} alt=""/>}
          <div style={{fontSize:11,fontWeight:700,color:'#e2e8f4',marginTop:3,maxWidth:100,textAlign:'center'}}>{player.team}</div>
        </div>
        {/* Score badge */}
        <div style={{textAlign:'center',background:'#0d1624',borderRadius:10,padding:'10px 16px',border:`2px solid ${scoreColor(player.careerScore)}`,flexShrink:0}}>
          <div style={{fontSize:8,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'.1em'}}>Score</div>
          <div style={{fontSize:28,fontWeight:900,color:scoreColor(player.careerScore),lineHeight:1.05}}>{(player.careerScore||0).toFixed(1)}</div>
          <div style={{fontSize:9,color:'#64748b'}}>{scoreLabel(player.careerScore)}</div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14}}>

        {/* LEFT — metric bars */}
        <div>
          {hasMetrics
            ? Object.entries(metricGroups).map(([section, metrics]) =>
                metrics.length === 0 ? null : (
                  <div key={section} style={{marginBottom:12}}>
                    <div style={{...SEC,color:'#ff66c4'}}>{section}</div>
                    {metrics.map(([label, pct, raw]) => {
                      const dispLabel = METRIC_LABEL_MAP[label] || label;
                      const p = Math.max(0, Math.min(100, pct||0));
                      const bc = barColor(p);
                      return (
                        <div key={label} style={{display:'flex',alignItems:'center',height:17,marginBottom:1}}>
                          <div style={{fontSize:10,color:'#c8d4e8',width:168,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{dispLabel}</div>
                          <div style={{flex:1,position:'relative',height:12,background:'#1b2636',borderRadius:2}}>
                            <div style={{height:'100%',width:`${p}%`,background:bc,borderRadius:2,position:'relative'}}>
                              {raw!=null && <span style={{position:'absolute',left:5,top:'50%',transform:'translateY(-50%)',fontSize:8,color:'#0b0b0b',fontWeight:500,whiteSpace:'nowrap'}}>{typeof raw==='number'?raw.toFixed(2):raw}</span>}
                            </div>
                            <div style={{position:'absolute',left:'50%',top:0,width:1,height:'100%',background:'rgba(255,255,255,0.35)'}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )
            : <div style={{color:'#475569',fontSize:12,padding:'20px 0'}}>No metric data available for this season.</div>
          }
        </div>

        {/* RIGHT — role scores, GBE, attributes, team context, scores */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>

          {/* Role Scores */}
          <div style={CARD}>
            <div style={SEC}>Role Scores</div>
            {sortedRoles.length===0
              ? <div style={{color:'#475569',fontSize:11}}>No role data</div>
              : sortedRoles.map(([role,score])=>{
                  const sc=Math.round(score);
                  const col=scoreColor(sc);
                  const disp=ROLE_DISPLAY_NAMES[role]||role;
                  return(
                    <div key={role} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                      <div style={{fontSize:10,color:'#c8d4e8',background:'#1e2d45',borderRadius:5,padding:'2px 7px',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{disp}</div>
                      <div style={{fontSize:13,fontWeight:800,color:col,minWidth:32,textAlign:'right'}}>{sc}</div>
                    </div>
                  );
                })
            }
          </div>

          {/* GBE */}
          {gbeTotal>0&&(
            <div style={CARD}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <div style={SEC}>GBE Points</div>
                <div style={{fontSize:10,fontWeight:700,color:gbeColor,background:gbeColor+'22',borderRadius:10,padding:'2px 8px',border:`1px solid ${gbeColor}`}}>{gbeStatus} · {gbeTotal}pts</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                {[
                  {label:'Band',val:`B${band}`,col:'#94a3b8'},
                  {label:'Domestic',val:domPts,col:'#60a5fa'},
                  {label:'Cont.',val:contPts,col:'#60a5fa'},
                  {label:'Band Pts',val:lqPts,col:'#60a5fa'},
                  {label:'Finish',val:finishPts,col:'#a78bfa'},
                  {label:'Prog.',val:progPts,col:'#a78bfa'},
                ].map(({label,val,col})=>(
                  <div key={label} style={{background:'#07090f',borderRadius:5,padding:'4px',textAlign:'center'}}>
                    <div style={{fontSize:7,color:'#475569',textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</div>
                    <div style={{fontSize:13,fontWeight:800,color:col}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Attributes & Development Areas */}
          {(strengths.length>0||weaknesses.length>0)&&(
            <div style={CARD}>
              {strengths.length>0&&<>
                <div style={SEC}>Key Attributes</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:strengths.length&&weaknesses.length?8:0}}>
                  {strengths.slice(0,8).map(s=>(
                    <div key={s} style={{fontSize:9,background:'#0e2a1c',color:'#86efac',border:'1px solid #22c55e44',borderRadius:12,padding:'2px 7px'}}>{s}</div>
                  ))}
                </div>
              </>}
              {weaknesses.length>0&&<>
                <div style={SEC}>Development Areas</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {weaknesses.slice(0,5).map(w=>(
                    <div key={w} style={{fontSize:9,background:'#2a0e0e',color:'#fca5a5',border:'1px solid #ef444444',borderRadius:12,padding:'2px 7px'}}>{w}</div>
                  ))}
                </div>
              </>}
            </div>
          )}

          {/* Team Context */}
          <div style={CARD}>
            <div style={SEC}>Team Context</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:6}}>
              <div style={{background:'#07090f',borderRadius:5,padding:'6px',textAlign:'center'}}>
                <div style={{fontSize:7,color:'#475569',textTransform:'uppercase',letterSpacing:'.05em'}}>Squad Avg</div>
                <div style={{fontSize:17,fontWeight:800,color:squadAvg?scoreColor(squadAvg):'#475569'}}>{squadAvg?squadAvg.toFixed(1):'—'}</div>
              </div>
              <div style={{background:'#07090f',borderRadius:5,padding:'6px',textAlign:'center'}}>
                <div style={{fontSize:7,color:'#475569',textTransform:'uppercase',letterSpacing:'.05em'}}>vs Squad</div>
                {squadAvg
                  ? <div style={{fontSize:17,fontWeight:800,color:player.careerScore>squadAvg?'#22c55e':'#f87171'}}>
                      {player.careerScore>squadAvg?'+':''}{(player.careerScore-squadAvg).toFixed(1)}
                    </div>
                  : <div style={{fontSize:14,color:'#475569'}}>—</div>
                }
              </div>
            </div>
            <div style={{fontSize:9,color:'#475569'}}>
              {player.marketValue?`Value: £${(player.marketValue/1e6).toFixed(1)}m · `:''}
              Contract: {player.contractYear||'—'}
            </div>
          </div>

          {/* Career / Peak / Potential */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
            {[
              {label:'Career',val:player.careerScore},
              {label:'Peak',  val:player.peakScore},
              {label:'Potential',val:player.potentialScore},
            ].map(({label,val})=>(
              <div key={label} style={{...CARD,textAlign:'center',padding:'7px 4px'}}>
                <div style={{fontSize:7,color:'#475569',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2}}>{label}</div>
                <div style={{fontSize:15,fontWeight:800,color:val?scoreColor(val):'#475569'}}>{val?val.toFixed(1):'—'}</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{marginTop:12,paddingTop:8,borderTop:'1px solid #1e2d45',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:8,color:'#334155'}}>Scout Index · Wyscout Data</div>
        <div style={{fontSize:8,color:'#334155'}}>{new Date().toLocaleDateString('en-GB',{month:'short',year:'numeric'})}</div>
      </div>

    </div>
  );
}

// ─── QuickCard Modal ──────────────────────────────────────────────────────────
export default function QuickCardModal({ player, players, onClose }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const el = document.getElementById('quick-card-inner');
      if (!el) return;
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, { quality: 1, pixelRatio: 2 });
      const a = document.createElement('a');
      a.download = `${player.name.replace(/\s+/g,'_')}_quick_card.png`;
      a.href = dataUrl;
      a.click();
    } catch(e) { console.error(e); }
    finally { setDownloading(false); }
  };

  return (
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    >
      <div style={{background:'#09111e',border:'1px solid #1e2d45',borderRadius:12,width:'min(820px,98vw)',maxHeight:'95vh',overflowY:'auto',boxShadow:'0 8px 40px rgba(0,0,0,.7)'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #1e2d45',position:'sticky',top:0,background:'#09111e',zIndex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:'#e2e8f4'}}>⚡ Quick Card</div>
          <div style={{display:'flex',gap:8}}>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{background:'#0e2a1c',border:'1px solid #22c55e',color:'#86efac',borderRadius:6,padding:'5px 14px',fontSize:11,fontWeight:700,cursor:'pointer',opacity:downloading?0.6:1}}
            >
              {downloading ? 'Saving…' : '⬇ Download PNG'}
            </button>
            <button
              onClick={onClose}
              style={{background:'none',border:'1px solid #1e2d45',color:'#94a3b8',borderRadius:6,width:28,height:28,fontSize:16,cursor:'pointer',lineHeight:1}}
            >×</button>
          </div>
        </div>

        {/* Card */}
        <div style={{padding:16}}>
          <div id="quick-card-inner">
            <QuickCardContent player={player} players={players}/>
          </div>
        </div>

      </div>
    </div>
  );
}
