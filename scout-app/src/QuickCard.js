import React, { useState } from 'react';
import { scoreLabel, formatFoot, formatMV } from './constants';

const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';
const CREST_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/crests/';

const BG          = '#0a0f1c';
const HEADER_L    = 'rgb(23,26,77)';
const HEADER_R    = 'rgb(17,22,42)';
const ACCENT_PINK = '#ff66c4';
const LABEL_COL   = '#e8eef8';
const BAR_RED     = 'rgb(199,54,60)';
const BAR_GOLD    = 'rgb(240,197,106)';
const BAR_GREEN   = 'rgb(61,166,91)';

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
  'Touches in box per 90':'Touches in Opposition Box','Touches in box':'Touches in Opposition Box',
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
  'Forward passes per 90':'Forward Passes','Forward passes':'Forward Passes',
  'Accurate forward passes, %':'Forward Passing %',
  'Key passes per 90':'Key passes','Key passes':'Key passes',
  'Long passes per 90':'Long Passes','Long passes':'Long Passes',
  'Accurate long passes, %':'Long Passing %',
  'Passes per 90':'Passes','Passes':'Passes',
  'Accurate passes, %':'Passing %',
  'Passes to final third per 90':'Passes to Final 3rd','Passes to final third':'Passes to Final 3rd',
  'Accurate passes to final third, %':'Passes to Final 3rd %',
  'Passes to penalty area per 90':'Passes to Penalty Area','Passes to penalty area':'Passes to Penalty Area',
  'Accurate passes to penalty area, %':'Pass to Penalty Area %',
  'Progressive passes per 90':'Progressive Passes','Progressive passes':'Progressive Passes',
  'Accurate progressive passes, %':'Progressive Passing %',
  'Smart passes per 90':'Smart Passes','Smart passes':'Smart Passes',
};
const POSITION_LABELS = {
  'GK':'Goalkeeper (GK)','RB':'Right Back (RB)','RWB':'Right Wingback (RWB)',
  'LCB':'Centre Back (CB)','CB':'Centre Back (CB)','RCB':'Centre Back (CB)',
  'LB':'Left Back (LB)','LWB':'Left Wingback (LWB)',
  'DMF':'Defensive Mid (DM)','LDMF':'Defensive Mid (DM)','RDMF':'Defensive Mid (DM)',
  'LCMF':'Central Mid (CM)','RCMF':'Central Mid (CM)',
  'AMF':'Attacking Mid (AM)','LAMF':'Left Mid (LM)','RAMF':'Right Mid (RM)',
  'LW':'Left Wing (LW)','LWF':'Left Wing (LW)','RW':'Right Wing (RW)','RWF':'Right Wing (RW)',
  'CF':'Center Forward (ST)',
};

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
  const RED = parseRgb(BAR_RED), GOLD = parseRgb(BAR_GOLD), GREEN = parseRgb(BAR_GREEN);
  const rgb = t <= 0.5 ? interp(RED,GOLD,t/0.5) : interp(GOLD,GREEN,(t-0.5)/0.5);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}
function cmToFeet(cm) {
  if (!cm || isNaN(cm)) return null;
  const totalInches = Math.round(Number(cm) / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}
function barRow(label, pct, rawVal, rowH = 18) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const bc = barColor(p);
  const barH = Math.max(8, Math.min(rowH - 4, 14));
  return `
    <div style="display:flex;align-items:center;height:${rowH}px;">
      <div style="width:188px;flex-shrink:0;font-size:12px;font-weight:600;color:${LABEL_COL};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
      <div style="flex:1;position:relative;height:${barH}px;background:#1b2636;border-radius:2px;">
        <div style="position:relative;height:100%;width:${p}%;background:${bc};border-radius:2px;">
          ${rawVal != null ? `<span style="position:absolute;left:4px;top:50%;transform:translateY(-50%);font-size:9px;color:#0b0b0b;font-weight:600;white-space:nowrap;">${rawVal}</span>` : ''}
        </div>
        <div style="position:absolute;left:50%;top:0;width:2px;height:100%;background:repeating-linear-gradient(to bottom, rgba(255,255,255,.95) 0 4px, transparent 4px 7px);"></div>
      </div>
    </div>`;
}

function buildQuickCardElement(player, players) {
  const seasonsDetailObj = player.seasonsDetail || {};
  const chosenSeasonKey = (player.allSeasonsSummary && player.allSeasonsSummary[0] && player.allSeasonsSummary[0].s)
    || Object.keys(seasonsDetailObj).sort().reverse()[0];
  const sd = seasonsDetailObj[chosenSeasonKey] || Object.values(seasonsDetailObj)[0] || {};
  const sdTeam = sd.team || player.team;
  const sdLeague = sd.league || player.league;
  const crest = player.teamFotmobId ? `${CREST_BASE}${player.teamFotmobId}.png` : '';
  const photo = photoUrl(player.name, player.team);
  const groups = sd.g || {};

  const rawPosToken = (player.position || '').split(',')[0].trim();
  const posKey = TOKEN_TO_POS_KEY[rawPosToken] || player.roleKey || 'CF';
  const validRoles = APP_ROLES[posKey] || [];
  const rcs = player.roleCareerScores || {};
  const seasonRoles = sd.roles || {};
  const roleSource = Object.keys(seasonRoles).length > 0 ? seasonRoles : rcs;
  const sortedRoles = Object.entries(roleSource)
    .filter(([role]) => validRoles.length === 0 || validRoles.includes(role))
    .sort((a, b) => b[1] - a[1]);

  const strengths = sd.strengths || player.latestStrengths || [];
  const weaknesses = sd.weaknesses || player.latestWeaknesses || [];

  const band = player.gbeBand || 6;
  const domPts    = player.gbeDomPts    ?? 0;
  const contPts   = player.gbeContPts   ?? 0;
  const lqPts     = player.gbeLqPts     ?? [12,10,8,6,4,2][Math.max(0,Math.min(5,band-1))];
  const finishPts = player.gbeFinishPts ?? 0;
  const progPts   = player.gbeProgPts   ?? 0;
  const gbeTotal  = player.gbeTotal     ?? (domPts+contPts+lqPts+finishPts+progPts);
  const gbeStatus = gbeTotal>=15?'PASS':gbeTotal>=10?'PANEL':'FAIL';
  const gbeColor  = gbeTotal>=15?'#3da65b':gbeTotal>=10?'#f0c56a':'#c7363c';

  const teamPlayers = (players||[]).filter(p=>p.team===player.team&&p.careerScore!=null);
  const squadAvg = teamPlayers.length>0 ? (teamPlayers.reduce((s,p)=>s+p.careerScore,0)/teamPlayers.length) : null;

  const groupKeys = ['A', 'D', 'P'];
  const totalRows = groupKeys.reduce((s, k) => s + (groups[k] ? groups[k].length : 0), 0);
  const activeSections = groupKeys.filter(k => groups[k] && groups[k].length > 0).length;
  const CHART_HEIGHT = 671;
  const FULL_OVERHEAD = 193;
  const SECTION_TITLE_H = 48;
  const FIXED_OVERHEAD = FULL_OVERHEAD - (3 - activeSections) * SECTION_TITLE_H;
  const MIN_ROW_H = 8, MAX_ROW_H = 55;
  let rowH = totalRows > 0
    ? Math.max(MIN_ROW_H, Math.min(MAX_ROW_H, Math.floor((CHART_HEIGHT - FIXED_OVERHEAD) / totalRows) - 1))
    : MAX_ROW_H;

  const buildGroupBars = (grpKey) => {
    const rows = groups[grpKey] || [];
    return rows.map(([label, pct, val]) => {
      const displayLabel = METRIC_LABEL_MAP[label] || label;
      return barRow(displayLabel, pct, typeof val === 'number' ? val.toFixed(2) : val, rowH);
    }).join('');
  };

  const isGK = rawPosToken === 'GK' || (player.roleKey || '').startsWith('GK');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1920px';
  container.style.height = '1080px';

  const rolePillsHtml = sortedRoles.slice(0, 6).map(([role, score]) => {
    const sc = Math.round(score);
    const disp = ROLE_DISPLAY_NAMES[role] || role;
    const c = sc>=79?'#00bf63':sc>=67?'#7ed957':sc>=55?'#c1ff72':sc>=43?'#ffde59':sc>=34?'#ffbd59':sc>=25?'#ff914d':'#ff3131';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;width:349px;height:36px;margin-bottom:6px;">
        <span style="font-size:16px;font-weight:600;color:#d9d9d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:270px;">${disp}</span>
        <span style="font-size:16px;font-weight:800;color:#0b0b0b;background:${c};border-radius:6px;padding:3px 10px;min-width:36px;text-align:center;">${sc}</span>
      </div>`;
  }).join('');

  const gbeTilesHtml = [
    ['Band', `B${band}`, '#94a3b8'],
    ['Domestic', domPts, '#7fb3ff'],
    ['Cont.', contPts, '#7fb3ff'],
    ['Band Pts', lqPts, '#7fb3ff'],
    ['Finish', finishPts, '#c4a4ff'],
    ['Prog.', progPts, '#c4a4ff'],
  ].map(([label,val,col]) => `
    <div style="background:#10182a;border-radius:6px;padding:6px 4px;text-align:center;">
      <div style="font-size:9px;color:#7a8499;text-transform:uppercase;letter-spacing:.05em;">${label}</div>
      <div style="font-size:18px;font-weight:800;color:${col};">${val}</div>
    </div>`).join('');

  const attributeTagsHtml = (arr, bg, fg, border) => arr.slice(0,6).map(s =>
    `<span style="font-size:13px;background:${bg};color:${fg};border:1px solid ${border};border-radius:14px;padding:4px 11px;display:inline-block;margin:0 6px 6px 0;">${s}</span>`
  ).join('');

  container.innerHTML = `
    <div id="qc-card-root" style="width:1920px;height:1080px;overflow:hidden;background:${BG};font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      <div style="position:absolute;top:0;left:0;width:1520px;height:292px;background:linear-gradient(to right, ${HEADER_L} 0%, ${HEADER_R} 100%);"></div>

      <div style="position:absolute;left:-12px;top:16px;width:261px;height:261px;background-color:transparent;background-image:url('${photo}');background-size:cover;background-position:center top;"></div>

      <div style="position:absolute;left:248px;top:24px;width:880px;font-size:53.2px;font-weight:700;line-height:1.05;letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${player.name}</div>
      <div style="position:absolute;left:248px;top:87px;display:flex;align-items:baseline;gap:15px;">
        <span style="font-size:26.6px;font-weight:600;color:#fff;white-space:nowrap;">${POSITION_LABELS[rawPosToken] || rawPosToken}</span>
        ${(player.foot && player.foot !== 'unknown' && player.foot !== 'nan') ? `<span style="font-size:21.3px;color:#c0c0c0;white-space:nowrap;">${formatFoot(player.foot)}</span>` : ''}
      </div>
      <div style="position:absolute;left:248px;top:153px;font-size:26.6px;font-weight:600;color:#fff;white-space:nowrap;">${player.age} years old</div>

      ${crest ? `<div style="position:absolute;left:756px;top:39px;width:118px;height:164px;background-size:contain;background-repeat:no-repeat;background-position:center;background-image:url('${crest}');"></div>` : ''}
      <div style="position:absolute;left:884px;top:57px;font-size:26.6px;font-weight:700;color:#fff;${sdTeam.length >= 16 ? 'letter-spacing:-0.8px;' : ''}">${sdTeam}</div>
      <div style="position:absolute;left:884px;top:97px;font-size:21.3px;font-weight:500;color:#fff;">${sdLeague}</div>

      <div style="position:absolute;left:1164px;top:45px;width:3px;height:155px;background:#737373;"></div>

      ${[['Height:', cmToFeet(player.height) || '—'], ['Value:', (player.xValue > 0 ? formatMV(player.xValue) : '—')], ['Contract:', (player.contractYear && player.contractYear !== 'nan') ? String(player.contractYear) : '—']].map(([k,v],i) => `
        <div style="position:absolute;left:1196px;top:${56 + i*50}px;font-size:20px;font-weight:600;color:#d9d9d9;">${k}</div>
        <div style="position:absolute;left:1311px;top:${56 + i*50}px;font-size:20px;font-weight:600;color:#fff;">${v}</div>`).join('')}

      <div style="position:absolute;top:36px;left:1520px;width:400px;text-align:center;font-size:28px;font-weight:800;color:#fff;line-height:1.2;">GBE<br/>CALCULATION</div>
      <div style="position:absolute;top:108px;left:1520px;width:400px;text-align:center;">
        <span style="font-size:16px;font-weight:800;color:${gbeColor};background:${gbeColor}22;border:1px solid ${gbeColor};border-radius:12px;padding:3px 14px;">${gbeStatus} · ${gbeTotal} PTS</span>
      </div>

      <div style="position:absolute;left:1520px;top:0;width:3px;height:1080px;background:#737373;"></div>

      <div style="position:absolute;left:890px;top:291px;width:2px;height:789px;background:#737373;"></div>

      <div style="position:absolute;top:160px;left:1545px;width:350px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
        ${gbeTilesHtml}
      </div>

      <div style="position:absolute;top:280px;left:1546px;width:349px;height:2px;background:rgba(192,192,192,.35);"></div>

      <div style="position:absolute;top:294px;left:1520px;width:400px;text-align:center;font-size:27.9px;font-weight:700;color:#d9d9d9;">ROLE SCORES</div>
      <div style="position:absolute;top:340px;left:1546px;width:349px;">
        ${rolePillsHtml || `<div style="color:#475569;font-size:14px;text-align:center;padding:20px 0;">No role data</div>`}
      </div>

      <div style="position:absolute;top:660px;left:1546px;width:349px;height:2px;background:rgba(192,192,192,.35);"></div>

      <div style="position:absolute;top:674px;left:1520px;width:400px;text-align:center;font-size:27.9px;font-weight:700;color:#d9d9d9;">TEAM CONTEXT</div>
      <div style="position:absolute;top:718px;left:1546px;width:349px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:#10182a;border-radius:6px;padding:10px;text-align:center;">
          <div style="font-size:10px;color:#7a8499;text-transform:uppercase;letter-spacing:.05em;">Squad Avg</div>
          <div style="font-size:24px;font-weight:800;color:#fff;">${squadAvg ? squadAvg.toFixed(1) : '—'}</div>
        </div>
        <div style="background:#10182a;border-radius:6px;padding:10px;text-align:center;">
          <div style="font-size:10px;color:#7a8499;text-transform:uppercase;letter-spacing:.05em;">vs Squad</div>
          <div style="font-size:24px;font-weight:800;color:${squadAvg ? (player.careerScore>squadAvg?'#7ed957':'#ff914d') : '#fff'};">${squadAvg ? (player.careerScore>squadAvg?'+':'')+(player.careerScore-squadAvg).toFixed(1) : '—'}</div>
        </div>
      </div>
      <div style="position:absolute;top:790px;left:1546px;width:349px;text-align:center;font-size:14px;color:#94a3b8;">League: ${sdLeague}</div>

      <div style="position:absolute;top:826px;left:1546px;width:349px;height:2px;background:rgba(192,192,192,.35);"></div>

      ${(strengths.length>0 || weaknesses.length>0) ? `
      <div style="position:absolute;top:840px;left:1520px;width:400px;text-align:center;font-size:20px;font-weight:700;color:#d9d9d9;">KEY ATTRIBUTES</div>
      <div style="position:absolute;top:874px;left:1546px;width:349px;text-align:center;">
        ${attributeTagsHtml(strengths, '#0e2a1c', '#86efac', '#22c55e44')}
      </div>
      ${weaknesses.length>0 ? `
      <div style="position:absolute;top:${874 + Math.ceil(strengths.length/2)*34 + 20}px;left:1520px;width:400px;text-align:center;font-size:20px;font-weight:700;color:#d9d9d9;">DEVELOPMENT AREAS</div>
      <div style="position:absolute;top:${874 + Math.ceil(strengths.length/2)*34 + 54}px;left:1546px;width:349px;text-align:center;">
        ${attributeTagsHtml(weaknesses, '#2a0e0e', '#fca5a5', '#ef444444')}
      </div>` : ''}
      ` : ''}

      <div style="position:absolute;top:300px;left:17px;font-size:26.6px;font-weight:700;color:${ACCENT_PINK};">Season Stats</div>
      <div style="position:absolute;top:356px;left:17px;font-size:20px;font-weight:500;color:#fff;">${sdLeague}</div>
      ${(() => {
        const cols = [
          ['Apps', 235, sd.mins ? Math.round(sd.mins/90) : '—'],
          ['Mins', 678, sd.mins ? sd.mins.toLocaleString() : '—'],
        ];
        const heads = cols.map(([lab,x]) => `<div style="position:absolute;top:319px;left:${x}px;font-size:20px;font-weight:500;color:#d9d9d9;">${lab}</div>`).join('');
        const vals = cols.map(([,x,v]) => `<div style="position:absolute;top:357px;left:${x}px;font-size:20px;font-weight:500;color:#fff;">${v}</div>`).join('');
        return heads + vals;
      })()}

      <div style="position:absolute;top:409px;left:0px;width:876px;height:671px;overflow:hidden;box-sizing:border-box;padding-left:24px;">
        ${groups.A && groups.A.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:0 0 6px;">${isGK ? 'Goalkeeping' : 'Attacking'}</div>${buildGroupBars('A')}` : ''}
        ${groups.D && groups.D.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:8px 0 6px;">Defensive</div>${buildGroupBars('D')}` : ''}
        ${groups.P && groups.P.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:8px 0 6px;">Possession</div>${buildGroupBars('P')}` : ''}
        <div style="display:flex;align-items:center;margin-top:6px;">
          <div style="width:188px;flex-shrink:0;"></div>
          <div style="flex:1;position:relative;height:22px;">
            ${[0,10,20,30,40,50,60,70,80,90,100].map(p=>`<span style="position:absolute;left:${p}%;top:0;transform:translateX(${p===0?'0':p===100?'-100%':'-50%'});font-size:12px;font-weight:600;color:#c4cbd9;">${p}%</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;">
          <div style="width:188px;flex-shrink:0;"></div>
          <div style="flex:1;text-align:center;font-size:14px;font-weight:700;color:${LABEL_COL};padding-top:6px;">Percentile Rank</div>
        </div>
      </div>

      <div style="position:absolute;top:330px;left:898px;width:616px;">
        <div style="display:flex;align-items:center;justify-content:center;gap:24px;margin-bottom:24px;">
          ${[['CAREER',player.careerScore],['PEAK',player.peakScore],['POTENTIAL',player.potentialScore]].map(([label,val])=>`
            <div style="text-align:center;background:#10182a;border-radius:10px;padding:18px 22px;min-width:160px;">
              <div style="font-size:14px;font-weight:700;color:#7a8499;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">${label}</div>
              <div style="font-size:42px;font-weight:900;color:${val ? barColor(Math.max(0,Math.min(100,(val-40)/0.6))) : '#475569'};">${val ? val.toFixed(1) : '—'}</div>
            </div>`).join('')}
        </div>
      </div>

      <div style="position:absolute;top:894px;left:938px;font-size:26.6px;font-weight:700;color:#fff;">SCORE LABEL</div>
      <div style="position:absolute;top:940px;left:941px;font-size:30px;font-weight:700;color:${barColor(Math.max(0,Math.min(100,(player.careerScore-40)/0.6)))};">${scoreLabel(player.careerScore)}</div>

    </div>
  `;

  document.body.appendChild(container);
  return container;
}

export default function QuickCardModal({ player, players, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  React.useEffect(() => {
    const el = buildQuickCardElement(player, players);
    (async () => {
      try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(el.querySelector('#qc-card-root'), { quality: 1, pixelRatio: 1, width: 1920, height: 1080 });
        setPreviewUrl(dataUrl);
      } catch(e) { console.error(e); }
      finally { document.body.removeChild(el); }
    })();
  }, [player, players]);

  const handleDownload = async () => {
    setDownloading(true);
    const el = buildQuickCardElement(player, players);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el.querySelector('#qc-card-root'), { quality: 1, pixelRatio: 1, width: 1920, height: 1080 });
      const a = document.createElement('a');
      a.download = `${player.name.replace(/\s+/g,'_')}_quick_card.png`;
      a.href = dataUrl;
      a.click();
    } catch(e) { console.error(e); }
    finally {
      document.body.removeChild(el);
      setDownloading(false);
    }
  };

  return (
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    >
      <div style={{background:'#09111e',border:'1px solid #1e2d45',borderRadius:12,width:'min(1100px,98vw)',maxHeight:'95vh',overflowY:'auto',boxShadow:'0 8px 40px rgba(0,0,0,.7)'}}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #1e2d45',position:'sticky',top:0,background:'#09111e',zIndex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:'#e2e8f4'}}>⚡ Quick Card</div>
          <div style={{display:'flex',gap:8}}>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{background:'#0e2a1c',border:'1px solid #22c55e',color:'#86efac',borderRadius:6,padding:'5px 14px',fontSize:11,fontWeight:700,cursor:'pointer',opacity:downloading?0.6:1}}
            >
              {downloading ? 'Saving…' : '⬇ Download 1920×1080'}
            </button>
            <button
              onClick={onClose}
              style={{background:'none',border:'1px solid #1e2d45',color:'#94a3b8',borderRadius:6,width:28,height:28,fontSize:16,cursor:'pointer',lineHeight:1}}
            >×</button>
          </div>
        </div>

        <div style={{padding:16}}>
          {previewUrl
            ? <img src={previewUrl} style={{width:'100%',borderRadius:8,display:'block'}} alt="Quick Card preview"/>
            : <div style={{color:'#64748b',fontSize:13,textAlign:'center',padding:'60px 0'}}>Generating preview…</div>
          }
        </div>

      </div>
    </div>
  );
}
