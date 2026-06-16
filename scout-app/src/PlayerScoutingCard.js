// PlayerScoutingCard.js
// Generates a 1920x1080 scouting card PNG matching the Canva template exactly.
// Uses html2canvas to screenshot an offscreen DOM node and trigger a PNG download.
// Reuses the same photoUrl/Crest logic as utils.js and PlayerOnePager.js.

import { scoreBandColor, scoreLabel, scoreToStars, ROLE_KEY_LABELS, formatMV, formatFoot, LEAGUE_STRENGTHS } from './constants';

const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';
const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';

// ── Exact Canva card colours (confirmed via Canva colour picker) ─────────────
const BG          = '#0a0f1c';
const ACCENT_PINK = '#ff66c4';
const TREND_CYAN  = '#00cadc';
const LABEL_COL   = '#e8eef8';
const BAR_TRACK   = '#1a2540';
const TAB_RED     = [199, 54,  60];   // #C7363C
const TAB_GOLD    = [240, 197, 106];  // #F0C56A
const TAB_GREEN   = [61,  166, 91];   // #3DA65B

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
function barColor(pct) {
  const t = Math.max(0, Math.min(1, pct / 100));
  const rgb = t <= 0.5 ? interp(TAB_RED, TAB_GOLD, t / 0.5) : interp(TAB_GOLD, TAB_GREEN, (t - 0.5) / 0.5);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function starsHtml(score, size = 18) {
  const stars = scoreToStars(score);
  const full = Math.floor(stars);
  const half = (stars - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const s = (state) => `<span style="color:${state === 'full' ? '#f6c90e' : state === 'half' ? '#f6c90e' : '#2a3450'};font-size:${size}px;line-height:1">${state === 'half' ? '½' : '★'}</span>`;
  return Array(full).fill(s('full')).join('') + (half ? s('half') : '') + Array(empty).fill(s('empty')).join('');
}

function barRow(label, pct, rawVal) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const bc = barColor(p);
  return `
    <div style="display:flex;align-items:center;height:13px;padding:1px 5px;">
      <div style="font-size:7.5px;color:${LABEL_COL};width:152px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
      <div style="flex:1;position:relative;height:10px;">
        <div style="width:100%;height:10px;background:${BAR_TRACK};border-radius:2px;overflow:hidden;position:relative;">
          <div style="height:100%;width:${p}%;border-radius:2px;background:${bc};position:relative;">
            ${rawVal ? `<span style="position:absolute;left:3px;top:50%;transform:translateY(-50%);font-size:6.2px;font-weight:700;color:#0a0a0a;white-space:nowrap;">${rawVal}</span>` : ''}
          </div>
        </div>
        <div style="position:absolute;left:50%;top:0;width:1px;height:10px;background:rgba(255,255,255,.45);"></div>
      </div>
    </div>`;
}

function rolePill(roleName, score) {
  const sc = Math.round(score);
  const bc = barColor(sc);
  const fg = sc > 45 ? '#000' : '#fff';
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;background:#111827;border-radius:7px;padding:5px 8px;margin-bottom:5px;width:196px;">
      <span style="font-size:9.5px;color:#d1d5db;">${roleName}</span>
      <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px;min-width:28px;text-align:center;background:${bc};color:${fg};">${sc}</span>
    </div>`;
}

function trendSvg(trendData) {
  if (!trendData || trendData.length < 2) return '';
  const W = 220, H = 65;
  const scores = trendData.map(d => d.score);
  const mn = Math.min(...scores) - 8, mx = Math.max(...scores) + 8;
  const tx = i => 10 + i * (W - 20) / (trendData.length - 1);
  const ty = s => H - 8 - (s - mn) / (mx - mn || 1) * (H - 18);
  const pts = trendData.map((d, i) => `${tx(i)},${ty(d.score)}`).join(' ');
  const dots = trendData.map((d, i) => {
    const x = tx(i), y = ty(d.score);
    return `<circle cx="${x}" cy="${y}" r="5" fill="${TREND_CYAN}"/>
      <text x="${x}" y="${y - 9}" text-anchor="middle" fill="#fff" font-size="11" font-weight="800" font-family="Montserrat">${d.score}</text>
      <text x="${x}" y="${H + 12}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="Montserrat">${d.season}</text>`;
  }).join('');
  return `<svg width="${W}" height="${H + 18}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${pts}" fill="none" stroke="${TREND_CYAN}" stroke-width="2.5"/>${dots}
  </svg>`;
}

function physicalDotsHtml(physical) {
  const dotColors = { 5: '#22c55e', 4: '#4ade80', 3: '#facc15', 2: '#f97316', 1: '#ef4444' };
  return Object.entries(physical).map(([attr, dots]) => {
    const dotsHtml = [0, 1, 2, 3, 4].map(i => {
      const filled = i < dots;
      const col = filled ? (dotColors[dots] || '#22c55e') : '#1a2540';
      return `<span style="width:13px;height:13px;border-radius:50%;display:inline-block;background:${col};margin-right:3px;"></span>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
      <span style="font-size:10px;color:#9ca3af;width:50px;">${attr}</span>
      <span style="display:flex;">${dotsHtml}</span>
    </div>`;
  }).join('');
}

function formBlocksHtml(form) {
  const fm = { W: '#22c55e', D: '#f59e0b', L: '#ef4444' };
  return (form || []).slice(0, 5).map(r => {
    const col = fm[r.toUpperCase()] || '#4b5563';
    return `<span style="width:24px;height:24px;border-radius:3px;display:inline-block;background:${col};margin-right:4px;"></span>`;
  }).join('');
}

// ── Feature F bar chart metric sets by position ──────────────────────────────
const FEATURE_F = {
  CF: {
    Attacking: ['Crosses', 'Crossing Accuracy %', 'Goals: Non-Penalty', 'xG', 'Conversion Rate %', 'Header Goals', 'Expected Assists', 'Offensive Duels', 'Progressive Runs', 'Shots', 'Shots on target %', 'Touches in Opposition Box'],
    Defensive: ['Aerial Duels', 'Aerial Duel Success %', 'Defensive Duels', 'Defensive Duel Success %', 'PAdj. Interceptions'],
    Possession: ['Deep Completions', 'Dribbles', 'Dribbling Success %', 'Key Passes', 'Passes', 'Passing Accuracy %', 'Passes to Penalty Area', 'Smart Passes'],
  },
};
FEATURE_F.ST = FEATURE_F.CF;

/**
 * Build the offscreen DOM node for the card.
 * `player` = the existing player object from players.json (same shape as PlayerCard.js uses)
 * `manual` = { keyAttributes, devAreas, view, currentStars, currentLevel, potentialStars,
 *              potentialLevel, physical:{Pace,Power,Fitness}, form:['W','D','L',...],
 *              avgRating5, clubColor, positionImageDataUrl }
 */
export function buildCardElement(player, manual = {}) {
  const sd = Object.values(player.seasonsDetail || {})[0] || {};
  const rcs = player.roleCareerScores || {};
  const sortedRoles = Object.entries(rcs).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const groups = sd.g || {};
  const allSeasons = player.allSeasonsSummary || [];
  const latestSeason = allSeasons[0] || {};
  const photo = photoUrl(player.name, player.team);
  const crest = player.teamFotmobId ? `${CREST_BASE}${player.teamFotmobId}.png` : '';
  const clubColor = manual.clubColor || '#1a3a6b';

  const trendData = (player.sh || []).slice(-3).map(h => ({ season: h.s, score: Math.round(h.sc) }));

  const buildGroupBars = (grpKey) => (groups[grpKey] || []).map(([label, pct, val]) =>
    barRow(label, pct, typeof val === 'number' ? val.toFixed(2) : val)
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
      <div style="position:absolute;top:0;left:0;right:0;height:305px;background:linear-gradient(to right, ${clubColor} 0%, ${BG} 58%);display:flex;align-items:flex-start;padding:20px 16px 0;gap:18px;">
        <img src="${photo}" crossorigin="anonymous" onerror="this.style.background='#111827'" style="width:258px;height:258px;object-fit:cover;border-radius:4px;flex-shrink:0;"/>
        <div style="flex:1;padding-top:2px;">
          <div style="font-size:42px;font-weight:900;line-height:1.1;letter-spacing:-0.5px;">${player.name}</div>
          <div style="font-size:19px;font-weight:600;color:#d1d5db;margin-top:4px;">
            ${player.position ? player.position.split(',')[0].trim() : (ROLE_KEY_LABELS[player.roleKey] || '')} &nbsp; ${player.foot && player.foot !== 'unknown' && player.foot !== 'nan' ? formatFoot(player.foot) : ''}
          </div>
          <div style="display:flex;align-items:center;gap:7px;margin-top:7px;font-size:14px;color:#d1d5db;">
            <span>${player.age} years old</span>
            ${player.dob ? `<span style="color:#374151;">·</span><span>${player.dob}</span>` : ''}
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;margin-top:16px;">
            ${crest ? `<img src="${crest}" crossorigin="anonymous" onerror="this.style.display='none'" style="width:70px;height:70px;object-fit:contain;"/>` : ''}
            <div style="display:flex;flex-direction:column;gap:2px;">
              <div style="font-size:18px;font-weight:800;">${player.team}</div>
              <div style="font-size:13px;color:#9ca3af;">${player.league}</div>
              <div style="font-size:11px;color:#6b7280;">${player.onLoan ? 'On Loan' : ''}</div>
            </div>
          </div>
        </div>
        <div style="margin-left:auto;display:flex;flex-direction:column;gap:5px;padding-top:2px;">
          <div style="display:flex;gap:6px;font-size:13px;"><span style="color:#9ca3af;width:70px;">Height:</span><span style="color:#fff;font-weight:700;">${manual.height || '—'}</span></div>
          <div style="display:flex;gap:6px;font-size:13px;"><span style="color:#9ca3af;width:70px;">Value:</span><span style="color:#fff;font-weight:700;">${player.marketValue > 0 ? formatMV(player.marketValue) : '—'}</span></div>
          <div style="display:flex;gap:6px;font-size:13px;"><span style="color:#9ca3af;width:70px;">Contract:</span><span style="color:#fff;font-weight:700;">${player.contract && player.contract !== 'nan' ? player.contract : '—'}</span></div>
        </div>
      </div>

      ${manual.positionImageDataUrl ? `<img src="${manual.positionImageDataUrl}" style="position:absolute;top:20px;right:18px;width:155px;height:155px;object-fit:contain;"/>` : ''}

      <!-- NAV -->
      <div style="position:absolute;top:195px;left:282px;display:flex;gap:28px;font-size:11px;color:#6b7280;">
        <span>Profile ▸</span><span>Performance ▾</span><span>Similar Players ▾</span><span>Club Fit ▾</span><span>Video ▾</span><span>Compare ▾</span>
      </div>

      <!-- SEASON STATS -->
      <div style="position:absolute;top:305px;left:0;width:900px;height:30px;background:#0d1117;display:flex;align-items:center;padding:0 10px;">
        <span style="font-size:12px;font-weight:800;color:${ACCENT_PINK};margin-right:10px;white-space:nowrap;">Season Stats</span>
        ${['Apps', 'Gls', 'Asts', 'xG', 'xA', 'Mins'].map((label, i) => {
          const vals = [latestSeason.m || '—', latestSeason.g || '0', latestSeason.a || '0', '—', '—', latestSeason.mins ? latestSeason.mins.toLocaleString() : '—'];
          return `<div style="display:flex;flex-direction:column;align-items:center;min-width:75px;"><span style="font-size:8px;color:#6b7280;">${label}</span><span style="font-size:11px;font-weight:700;">${vals[i]}</span></div>`;
        }).join('')}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:75px;">
          <span style="font-size:8px;color:#6b7280;">Av.Rat</span>
          <span style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:1px 7px;border-radius:3px;">${sd.score ? ((sd.score - 40) / 54 * 7.5 + 1).toFixed(1) : '—'}</span>
        </div>
      </div>

      <div style="position:absolute;top:305px;bottom:0;width:1px;background:#1a2540;left:900px;"></div>
      <div style="position:absolute;top:305px;bottom:0;width:1px;background:#1a2540;left:1162px;"></div>

      <!-- BAR CHART -->
      <div style="position:absolute;top:335px;left:0;width:895px;padding:4px 0;">
        ${groups.A && groups.A.length ? `<div style="font-size:12px;font-weight:800;color:#fff;padding:4px 8px 2px;">Attacking</div>${buildGroupBars('A')}` : ''}
        ${groups.D && groups.D.length ? `<div style="font-size:12px;font-weight:800;color:#fff;padding:4px 8px 2px;">Defensive</div>${buildGroupBars('D')}` : ''}
        ${groups.P && groups.P.length ? `<div style="font-size:12px;font-weight:800;color:#fff;padding:4px 8px 2px;">Possession</div>${buildGroupBars('P')}` : ''}
        <div style="text-align:center;font-size:8px;color:#4b5563;padding-top:6px;margin-left:157px;">Percentile Rank</div>
      </div>

      <!-- NOTES PANEL -->
      <div style="position:absolute;top:335px;left:908px;width:248px;padding:7px 10px;">
        <div style="display:flex;gap:5px;margin-bottom:12px;">
          <span style="color:${ACCENT_PINK};font-size:12px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:10.5px;line-height:1.55;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">Key Attributes: </span>${manual.keyAttributes || ''}</div>
        </div>
        <div style="display:flex;gap:5px;margin-bottom:12px;">
          <span style="color:${ACCENT_PINK};font-size:12px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:10.5px;line-height:1.55;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">Development Areas: </span>${manual.devAreas || ''}</div>
        </div>
        <div style="display:flex;gap:5px;margin-bottom:12px;">
          <span style="color:${ACCENT_PINK};font-size:12px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:10.5px;line-height:1.55;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">View: </span>${manual.view || ''}</div>
        </div>
        <div style="margin-top:16px;">
          <div style="font-size:11px;font-weight:800;color:#fff;margin-bottom:4px;">CURRENT LEVEL</div>
          <div style="display:flex;align-items:center;gap:7px;"><span style="font-size:18px;">${starsHtml(manual.currentScore ?? player.careerScore)}</span><span style="font-size:9px;color:#9ca3af;">${manual.currentLevel || scoreLabel(player.careerScore)}</span></div>
        </div>
        <div style="margin-top:10px;">
          <div style="font-size:11px;font-weight:800;color:#fff;margin-bottom:4px;">POTENTIAL LEVEL</div>
          <div style="display:flex;align-items:center;gap:7px;"><span style="font-size:18px;">${starsHtml(manual.potentialScore ?? player.potentialScore ?? player.careerScore)}</span><span style="font-size:9px;color:#9ca3af;">${manual.potentialLevel || scoreLabel(player.potentialScore || player.careerScore)}</span></div>
        </div>
      </div>

      <!-- FAR RIGHT PANEL -->
      <div style="position:absolute;top:305px;left:1168px;right:0;padding:12px 14px;">
        <div style="font-size:10px;font-weight:900;color:#fff;letter-spacing:.06em;margin-bottom:8px;">BEST ROLE</div>
        ${rolesHtml}
        ${trendData.length >= 2 ? `<div style="margin-top:12px;"><div style="font-size:10px;font-weight:900;color:#fff;letter-spacing:.06em;margin-bottom:8px;">PERFORMANCE TREND</div>${trendSvg(trendData)}</div>` : ''}
        <div style="margin-top:12px;"><div style="font-size:10px;font-weight:900;color:#fff;letter-spacing:.06em;margin-bottom:8px;">PHYSICAL</div>${physicalDotsHtml(manual.physical || { Pace: 3, Power: 3, Fitness: 3 })}</div>
        <div style="margin-top:12px;">
          <div style="font-size:10px;font-weight:900;color:#fff;letter-spacing:.06em;margin-bottom:8px;">FORM</div>
          <div style="display:flex;margin-top:4px;">${formBlocksHtml(manual.form || [])}</div>
          ${manual.avgRating5 ? `<div style="font-size:9px;color:#9ca3af;margin-top:6px;">⭐ ${manual.avgRating5} &nbsp; Last 5 Avg Rating</div>` : ''}
        </div>
      </div>

    </div>`;

  document.body.appendChild(container);
  return container;
}

/**
 * Generates and downloads the PNG. Requires html2canvas to be loaded
 * (npm install html2canvas, then `import html2canvas from 'html2canvas'`).
 */
export async function downloadScoutingCardPNG(player, manual = {}) {
  const html2canvas = (await import('html2canvas')).default;

  // Ensure Montserrat is loaded before rendering
  if (!document.getElementById('montserrat-font-link')) {
    const link = document.createElement('link');
    link.id = 'montserrat-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
    await new Promise(r => setTimeout(r, 300)); // give font time to register
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
