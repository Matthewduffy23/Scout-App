// PlayerScoutingCard.js
// Generates a 1920x1080 scouting card PNG matching the Canva template exactly.
// Rebuilt against a pixel-accurate 1920x1080 export of the real Canva design.
// Uses html2canvas to screenshot an offscreen DOM node and trigger a PNG download.

import { scoreBandColor, scoreLabel, scoreToStars, ROLE_KEY_LABELS, formatMV, formatFoot, LEAGUE_STRENGTHS } from './constants';

const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';
const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';

// ── Colours sampled directly from the real Canva export ──────────────────────
const BG          = '#090f1b';          // body background (sampled 9,15,27)
const HEADER_L     = 'rgb(23,26,77)';   // header gradient left
const HEADER_R     = 'rgb(17,22,42)';   // header gradient right
const ACCENT_PINK  = '#ff4fa8';
const TREND_CYAN   = '#22d3ee';
const LABEL_COL    = '#e8eef8';
const BAR_TRACK    = '#0d1424';
const BAR_RED      = 'rgb(211,90,72)';   // sampled
const BAR_GOLD     = 'rgb(187,186,103)'; // sampled
const BAR_GREEN    = 'rgb(73,166,95)';   // sampled

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

function interp(a, b, t) {
  return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
}
function parseRgb(s) { return s.match(/\d+/g).map(Number); }
function barColor(pct) {
  const t = Math.max(0, Math.min(1, pct / 100));
  const RED = parseRgb(BAR_RED), GOLD = parseRgb(BAR_GOLD), GREEN = parseRgb(BAR_GREEN);
  const rgb = t <= 0.5 ? interp(RED, GOLD, t / 0.5) : interp(GOLD, GREEN, (t - 0.5) / 0.5);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function starsHtml(score, size = 20) {
  const stars = scoreToStars(score);
  const full = Math.floor(stars);
  const half = (stars - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const s = (state) => `<span style="color:${state === 'empty' ? '#3a4566' : '#f6c244'};font-size:${size}px;line-height:1">${state === 'half' ? '⯨' : '★'}</span>`;
  return Array(full).fill(s('full')).join('') + (half ? s('half') : '') + Array(empty).fill(s('empty')).join('');
}

function barRow(label, pct, rawVal, count) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const bc = barColor(p);
  return `
    <div style="display:flex;align-items:center;height:15px;margin-bottom:1px;">
      <div style="font-size:8.5px;font-weight:600;color:${LABEL_COL};width:148px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
      <div style="width:16px;flex-shrink:0;font-size:7.5px;color:#6b7280;text-align:right;padding-right:4px;">${count != null ? count : ''}</div>
      <div style="flex:1;position:relative;height:11px;">
        <div style="width:100%;height:11px;background:${BAR_TRACK};position:relative;overflow:hidden;">
          <div style="height:100%;width:${p}%;background:${bc};position:relative;">
            ${rawVal ? `<span style="position:absolute;left:4px;top:50%;transform:translateY(-50%);font-size:7.5px;font-weight:700;color:#0a0a0a;white-space:nowrap;">${rawVal}</span>` : ''}
          </div>
        </div>
        <div style="position:absolute;left:50%;top:0;width:1px;height:11px;background:rgba(255,255,255,.55);"></div>
      </div>
    </div>`;
}

function rolePill(roleName, score) {
  const sc = Math.round(score);
  const bc = barColor(sc);
  const fg = sc > 45 ? '#0a0a0a' : '#fff';
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;background:#1c2236;border-radius:8px;padding:9px 12px;margin-bottom:8px;width:228px;">
      <span style="font-size:13px;color:#e2e6ee;font-weight:500;">${roleName}</span>
      <span style="font-size:13px;font-weight:800;padding:3px 11px;border-radius:5px;min-width:34px;text-align:center;background:${bc};color:${fg};">${sc}</span>
    </div>`;
}

function trendSvg(trendData) {
  if (!trendData || trendData.length < 2) return '';
  const W = 270, H = 75;
  const scores = trendData.map(d => d.score);
  const mn = Math.min(...scores) - 8, mx = Math.max(...scores) + 8;
  const tx = i => 14 + i * (W - 28) / (trendData.length - 1);
  const ty = s => H - 16 - (s - mn) / (mx - mn || 1) * (H - 30);
  const pts = trendData.map((d, i) => `${tx(i)},${ty(d.score)}`).join(' ');
  const dots = trendData.map((d, i) => {
    const x = tx(i), y = ty(d.score);
    return `<rect x="${x-15}" y="${y-22}" width="30" height="17" rx="4" fill="${TREND_CYAN}"/>
      <text x="${x}" y="${y-9.5}" text-anchor="middle" fill="#04222a" font-size="11.5" font-weight="800" font-family="Montserrat">${d.score}</text>
      <text x="${x}" y="${H}" text-anchor="middle" fill="#8b93a7" font-size="10.5" font-family="Montserrat">${d.season}</text>`;
  }).join('');
  return `<svg width="${W}" height="${H+8}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${pts}" fill="none" stroke="${TREND_CYAN}" stroke-width="2.5"/>${dots}
  </svg>`;
}

function physicalDotsHtml(physical) {
  const dotColors = { 5: '#22c55e', 4: '#65d17e', 3: '#9ad15a', 2: '#e0c84a', 1: '#e0c84a' };
  return Object.entries(physical).map(([attr, dots]) => {
    const dotsHtml = [0, 1, 2, 3, 4].map(i => {
      const filled = i < dots;
      const col = filled ? (dotColors[dots] || '#22c55e') : '#3a4566';
      return `<span style="width:15px;height:15px;border-radius:50%;display:inline-block;background:${col};margin-right:6px;"></span>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-size:14px;color:#aab2c5;width:66px;">${attr}</span>
      <span style="display:flex;">${dotsHtml}</span>
    </div>`;
  }).join('');
}

function formBlocksHtml(form) {
  const fm = { W: '#3aa65c', D: '#e0904a', L: '#d35a48' };
  return (form || []).slice(0, 5).map(r => {
    const col = fm[r.toUpperCase()] || '#4b5563';
    return `<span style="width:38px;height:38px;border-radius:5px;display:inline-block;background:${col};margin-right:8px;"></span>`;
  }).join('');
}

// ── Feature F bar chart metric sets by position ──────────────────────────────
const FEATURE_F = {
  CF: {
    Attacking: ['Crosses', 'Crossing Accuracy %', 'Goals: Non-Penalty', 'xG', 'Conversion Rate %', 'Header Goals', 'Expected Assists', 'Offensive Duels', 'Progressive Runs', 'Shots', 'Shooting Accuracy %', 'Touches in Opposition Box'],
    Defensive: ['Aerial Duels', 'Aerial Duel Success %', 'Defensive Duels', 'Defensive Duel Success %', 'PAdj. Interceptions'],
    Possession: ['Deep Completions', 'Dribbles', 'Dribbling Success %', 'Key Passes', 'Passes', 'Passing Accuracy %', 'Passes to Penalty Area', 'Passes to Penalty Area %', 'Smart Passes'],
  },
};
FEATURE_F.ST = FEATURE_F.CF;

const POS_TO_KEY = {
  GK: 'GK', CB: 'CB', LCB: 'CB', RCB: 'CB',
  LB: 'FB', RB: 'FB', LWB: 'FB', RWB: 'FB',
  DMF: 'CM', LDMF: 'CM', RDMF: 'CM', LCMF: 'CM', RCMF: 'CM',
  AMF: 'ATT', LAMF: 'ATT', RAMF: 'ATT',
  LW: 'ATT', RW: 'ATT', LWF: 'ATT', RWF: 'ATT',
  CF: 'CF', ST: 'CF',
};

function pitchDiagramSvg() {
  // Static pitch with markers — simplified version of the reference
  return `<svg viewBox="0 0 330 220" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
    <rect x="0" y="0" width="330" height="220" fill="#0d1117" rx="6"/>
    <rect x="10" y="10" width="310" height="200" fill="none" stroke="#3a4156" stroke-width="1.5"/>
    <line x1="165" y1="10" x2="165" y2="210" stroke="#3a4156" stroke-width="1.5"/>
    <circle cx="165" cy="110" r="28" fill="none" stroke="#3a4156" stroke-width="1.5"/>
    <rect x="10" y="65" width="35" height="90" fill="none" stroke="#3a4156" stroke-width="1.5"/>
    <rect x="285" y="65" width="35" height="90" fill="none" stroke="#3a4156" stroke-width="1.5"/>
    <circle cx="55" cy="110" r="5" fill="#9aa3b5"/>
    <circle cx="95" cy="55" r="5" fill="#9aa3b5"/>
    <circle cx="95" cy="165" r="5" fill="#9aa3b5"/>
    <circle cx="135" cy="55" r="5" fill="#9aa3b5"/>
    <circle cx="135" cy="165" r="5" fill="#9aa3b5"/>
    <circle cx="170" cy="110" r="5" fill="#9aa3b5"/>
    <circle cx="220" cy="40" r="6" fill="#3aa65c"/>
    <circle cx="245" cy="90" r="6" fill="#e0c84a"/>
    <circle cx="245" cy="135" r="6" fill="#3aa65c"/>
    <circle cx="220" cy="180" r="6" fill="#e0c84a"/>
  </svg>`;
}

/**
 * Build the offscreen DOM node for the card.
 */
export function buildCardElement(player, manual = {}) {
  const sd = Object.values(player.seasonsDetail || {})[0] || {};
  const rcs = player.roleCareerScores || {};
  const sortedRoles = Object.entries(rcs).slice(0, 3);
  const groups = sd.g || {};
  const allSeasons = player.allSeasonsSummary || [];
  const latestSeason = allSeasons[0] || {};
  const photo = photoUrl(player.name, player.team);
  const crest = player.teamFotmobId ? `${CREST_BASE}${player.teamFotmobId}.png` : '';

  const trendData = (player.sh || []).slice(-3).map(h => ({ season: h.s, score: Math.round(h.sc) }));

  const buildGroupBars = (grpKey) => (groups[grpKey] || []).map(([label, pct, val], i) =>
    barRow(label, pct, typeof val === 'number' ? val.toFixed(2) : val, null)
  ).join('');

  const rolesHtml = sortedRoles.map(([role, score]) => rolePill(role, score)).join('');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1920px';
  container.style.height = '1080px';

  container.innerHTML = `
    <div style="width:1920px;height:1080px;overflow:hidden;background:${BG};font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      <!-- HEADER -->
      <div style="position:absolute;top:0;left:0;right:0;height:210px;background:linear-gradient(to right, ${HEADER_L} 0%, ${HEADER_R} 100%);display:flex;align-items:flex-start;padding:14px 0 0 0;">

        <img src="${photo}" crossorigin="anonymous" onerror="this.style.background='#1c2236'" style="width:175px;height:175px;object-fit:cover;flex-shrink:0;margin-left:0;"/>

        <div style="flex:1;padding-top:6px;padding-left:14px;">
          <div style="font-size:34px;font-weight:800;line-height:1.1;letter-spacing:-0.3px;">${player.name}</div>
          <div style="font-size:17px;font-weight:600;color:#d7dbe6;margin-top:5px;">
            ${player.position ? player.position.split(',')[0].trim() : (ROLE_KEY_LABELS[player.roleKey] || '')} &nbsp; <span style="color:#b9bfcd;font-weight:500;">${player.foot && player.foot !== 'unknown' && player.foot !== 'nan' ? formatFoot(player.foot) : ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:9px;font-size:14px;color:#d7dbe6;">
            ${player.nationality ? `<img src="https://flagcdn.com/24x18/${(player.countryCode||'').toLowerCase()}.png" style="width:22px;height:16px;object-fit:cover;" onerror="this.style.display='none'"/>` : ''}
            <span style="font-weight:700;">${player.age} years old</span>
            <span style="color:#b9bfcd;margin-left:4px;">${player.dob || ''}</span>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:14px;padding-top:14px;width:300px;flex-shrink:0;">
          ${crest ? `<img src="${crest}" crossorigin="anonymous" onerror="this.style.display='none'" style="width:56px;height:64px;object-fit:contain;"/>` : '<div style="width:56px;"></div>'}
          <div style="display:flex;flex-direction:column;gap:3px;">
            <div style="font-size:17px;font-weight:700;">${player.team}</div>
            <div style="font-size:13px;color:#aab2c5;">${player.league}</div>
            <div style="font-size:12px;color:#7d869b;margin-top:2px;">${player.onLoan ? 'On Loan' : 'Important Player'}</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;padding-top:14px;width:170px;flex-shrink:0;">
          <div style="display:flex;gap:8px;font-size:13px;"><span style="color:#aab2c5;width:60px;">Height:</span><span style="color:#fff;font-weight:700;">${manual.height || '—'}</span></div>
          <div style="display:flex;gap:8px;font-size:13px;"><span style="color:#aab2c5;width:60px;">Value:</span><span style="color:#fff;font-weight:700;">${player.marketValue > 0 ? formatMV(player.marketValue) : '—'}</span></div>
          <div style="display:flex;gap:8px;font-size:13px;"><span style="color:#aab2c5;width:60px;">Contract:</span><span style="color:#fff;font-weight:700;">${player.contract && player.contract !== 'nan' ? player.contract : '—'}</span></div>
        </div>

        <div style="width:280px;flex-shrink:0;"></div>

      </div>

      <!-- NAV -->
      <div style="position:absolute;top:165px;left:200px;display:flex;align-items:center;gap:26px;font-size:15px;color:#c2c7d4;">
        <span style="font-weight:700;color:#fff;">Profile ▸</span><span>Performance ▾</span><span>Similar Players ▾</span><span>Club Fit ▾</span><span>Video ▾</span><span>Compare ▾</span>
      </div>

      <!-- POSITION DIAGRAM -->
      <div style="position:absolute;top:14px;right:14px;width:255px;height:170px;">
        ${pitchDiagramSvg()}
      </div>

      <!-- BEST ROLE header (top right, below pitch) -->
      <div style="position:absolute;top:192px;right:30px;font-size:16px;font-weight:800;color:#fff;">BEST ROLE</div>

      <!-- SEASON STATS -->
      <div style="position:absolute;top:210px;left:0;width:670px;display:flex;align-items:center;padding:10px 16px;">
        <span style="font-size:15px;font-weight:800;color:${ACCENT_PINK};margin-right:18px;white-space:nowrap;">Season Stats</span>
        ${['Apps', 'Gls', 'Asts', 'xG', 'xA', 'Mins'].map((label, i) => {
          const vals = [latestSeason.m || '—', latestSeason.g || '0', latestSeason.a || '0', '—', '—', latestSeason.mins ? latestSeason.mins.toLocaleString() : '—'];
          return `<div style="display:flex;flex-direction:column;align-items:center;min-width:60px;"><span style="font-size:11px;color:#8b93a7;">${label}</span><span style="font-size:14px;font-weight:700;">${vals[i]}</span></div>`;
        }).join('')}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:60px;">
          <span style="font-size:11px;color:#8b93a7;">Av. Rat</span>
          <span style="background:#f0b94a;color:#1a1300;font-size:13px;font-weight:800;padding:1px 9px;border-radius:4px;">${sd.score ? ((sd.score - 40) / 54 * 7.5 + 1).toFixed(1) : '—'}</span>
        </div>
      </div>

      <!-- BAR CHART PANEL -->
      <div style="position:absolute;top:255px;left:0;width:670px;padding:0 16px;">
        ${groups.A && groups.A.length ? `<div style="font-size:17px;font-weight:800;color:#fff;margin:4px 0 6px;">Attacking</div>${buildGroupBars('A')}` : ''}
        ${groups.D && groups.D.length ? `<div style="font-size:17px;font-weight:800;color:#fff;margin:10px 0 6px;">Defensive</div>${buildGroupBars('D')}` : ''}
        ${groups.P && groups.P.length ? `<div style="font-size:17px;font-weight:800;color:#fff;margin:10px 0 6px;">Possession</div>${buildGroupBars('P')}` : ''}
        <div style="display:flex;margin-top:6px;padding-left:164px;font-size:9px;color:#6b7280;justify-content:space-between;padding-right:4px;">
          ${[0,10,20,30,40,50,60,70,80,90,100].map(p=>`<span>${p}%</span>`).join('')}
        </div>
        <div style="text-align:center;font-size:11px;color:#8b93a7;padding-top:4px;padding-left:164px;">Percentile Rank</div>
      </div>

      <!-- NOTES PANEL -->
      <div style="position:absolute;top:255px;left:702px;width:460px;padding:0 10px;">
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <span style="color:${ACCENT_PINK};font-size:16px;flex-shrink:0;line-height:1.6;">•</span>
          <div style="font-size:15px;line-height:1.6;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">Key Attributes: </span>${manual.keyAttributes || ''}</div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <span style="color:${ACCENT_PINK};font-size:16px;flex-shrink:0;line-height:1.6;">•</span>
          <div style="font-size:15px;line-height:1.6;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">Development Areas: </span>${manual.devAreas || ''}</div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:20px;">
          <span style="color:${ACCENT_PINK};font-size:16px;flex-shrink:0;line-height:1.6;">•</span>
          <div style="font-size:15px;line-height:1.6;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">View: </span>${manual.view || ''}</div>
        </div>
        <div style="margin-top:6px;">
          <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:8px;">CURRENT LEVEL</div>
          <div style="display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">${starsHtml(manual.currentScore ?? player.careerScore)}</span><span style="font-size:14px;color:#aab2c5;">${manual.currentLevel || scoreLabel(player.careerScore)}</span></div>
        </div>
        <div style="margin-top:18px;">
          <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:8px;">POTENTIAL LEVEL</div>
          <div style="display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">${starsHtml(manual.potentialScore ?? player.potentialScore ?? player.careerScore)}</span><span style="font-size:14px;color:#aab2c5;">${manual.potentialLevel || scoreLabel(player.potentialScore || player.careerScore)}</span></div>
        </div>
      </div>

      <!-- FAR RIGHT PANEL -->
      <div style="position:absolute;top:218px;left:1188px;right:0;padding:0 30px;">
        ${rolesHtml}
        ${trendData.length >= 2 ? `<div style="margin-top:18px;"><div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:10px;">PERFORMANCE TREND</div>${trendSvg(trendData)}</div>` : ''}
        <div style="margin-top:22px;"><div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:14px;">PHYSICAL</div>${physicalDotsHtml(manual.physical || { Pace: 3, Power: 3, Fitness: 3 })}</div>
        <div style="margin-top:18px;">
          <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:10px;">FORM</div>
          <div style="display:flex;margin-top:6px;">${formBlocksHtml(manual.form || [])}</div>
          ${manual.avgRating5 ? `<div style="display:inline-flex;align-items:center;gap:6px;background:#d35a48;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:5px;margin-top:10px;">${manual.avgRating5} <span style="font-weight:500;">Last 5 Avg Rating</span></div>` : ''}
        </div>
      </div>

    </div>`;

  document.body.appendChild(container);
  return container;
}

export async function downloadScoutingCardPNG(player, manual = {}) {
  const html2canvas = (await import('html2canvas')).default;

  if (!document.getElementById('montserrat-font-link')) {
    const link = document.createElement('link');
    link.id = 'montserrat-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
    await new Promise(r => setTimeout(r, 300));
  }

  const el = buildCardElement(player, manual);

  try {
    const canvas = await html2canvas(el, {
      width: 1920,
      height: 1080,
      scale: 1,
      backgroundColor: BG,
      useCORS: true,
      logging: false,
    });

    const link = document.createElement('a');
    link.download = `${player.name.replace(/\s+/g, '_')}_scouting_card.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    document.body.removeChild(el);
  }
}
