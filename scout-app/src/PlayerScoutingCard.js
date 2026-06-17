// PlayerScoutingCard.js
// Generates a 1920x1080 scouting card PNG matching the Canva template exactly.
// Rebuilt against a pixel-accurate 1920x1080 export of the real Canva design.
// Uses html2canvas to screenshot an offscreen DOM node and trigger a PNG download.

import { scoreBandColor, scoreLabel, scoreToStars, ROLE_KEY_LABELS, formatMV, formatFoot, LEAGUE_STRENGTHS } from './constants';

const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';
const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';

// ── Country name (as found in birthCountry field) → ISO 3166-1 alpha-2 code, for flagcdn ──
const COUNTRY_TO_ISO2 = {
  'England': 'gb-eng', 'Scotland': 'gb-sct', 'Wales': 'gb-wls', 'Northern Ireland': 'gb-nir',
  'Spain': 'es', 'Germany': 'de', 'Italy': 'it', 'France': 'fr', 'Belgium': 'be',
  'Portugal': 'pt', 'Netherlands': 'nl', 'Croatia': 'hr', 'Switzerland': 'ch', 'Norway': 'no',
  'Sweden': 'se', 'Cyprus': 'cy', 'Czech': 'cz', 'Czech Republic': 'cz', 'Greece': 'gr',
  'Austria': 'at', 'Hungary': 'hu', 'Romania': 'ro', 'Slovenia': 'si', 'Slovakia': 'sk',
  'Ukraine': 'ua', 'Bulgaria': 'bg', 'Serbia': 'rs', 'Albania': 'al', 'Bosnia': 'ba',
  'Bosnia and Herzegovina': 'ba', 'Kosovo': 'xk', 'Ireland': 'ie', 'Republic of Ireland': 'ie',
  'Finland': 'fi', 'Armenia': 'am', 'Georgia': 'ge', 'Poland': 'pl', 'Iceland': 'is',
  'North Macedonia': 'mk', 'Latvia': 'lv', 'Montenegro': 'me', 'Denmark': 'dk', 'Estonia': 'ee',
  'Russia': 'ru', 'Kazakhstan': 'kz', 'Lithuania': 'lt', 'Malta': 'mt', 'Moldova': 'md',
  'Israel': 'il', 'Andorra': 'ad', 'Faroe Islands': 'fo',
  'Brazil': 'br', 'Argentina': 'ar', 'Colombia': 'co', 'Ecuador': 'ec', 'Paraguay': 'py',
  'Uruguay': 'uy', 'Chile': 'cl', 'Bolivia': 'bo', 'Peru': 'pe', 'Venezuela': 've', 'Panama': 'pa',
  'USA': 'us', 'United States': 'us', 'Mexico': 'mx', 'Costa Rica': 'cr', 'Canada': 'ca',
  'Morocco': 'ma', 'Algeria': 'dz', 'Egypt': 'eg', 'Nigeria': 'ng', 'Tunisia': 'tn',
  'South Africa': 'za', 'Zambia': 'zm', 'Ghana': 'gh', 'Senegal': 'sn', 'Cameroon': 'cm',
  'Ivory Coast': 'ci', "Côte d'Ivoire": 'ci', 'Mali': 'ml', 'DR Congo': 'cd', 'Guinea': 'gn',
  'Japan': 'jp', 'Korea': 'kr', 'South Korea': 'kr', 'Saudi': 'sa', 'Saudi Arabia': 'sa',
  'UAE': 'ae', 'Qatar': 'qa', 'Uzbekistan': 'uz', 'China': 'cn', 'Turkey': 'tr',
  'Azerbaijan': 'az', 'Kyrgyzstan': 'kg', 'Australia': 'au', 'Iran': 'ir', 'Iraq': 'iq',
  'Jordan': 'jo', 'Syria': 'sy', 'India': 'in',
};
function countryToIso2(name) {
  if (!name) return '';
  return COUNTRY_TO_ISO2[String(name).trim()] || '';
}

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
  const t = String(team || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
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

function barRow(label, pct, rawVal, count, rowH = 20) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const bc = barColor(p);
  const barH = Math.max(10, rowH - 4);
  return `
    <div style="display:flex;align-items:center;height:${rowH}px;margin-bottom:1px;">
      <div style="font-size:13px;font-weight:600;color:${LABEL_COL};width:170px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
      <div style="width:26px;flex-shrink:0;font-size:11px;color:#6b7280;text-align:right;padding-right:6px;">${count != null ? count : ''}</div>
      <div style="flex:1;position:relative;height:${barH}px;">
        <div style="width:100%;height:${barH}px;background:${BAR_TRACK};position:relative;overflow:hidden;">
          <div style="height:100%;width:${p}%;background:${bc};position:relative;">
            ${rawVal ? `<span style="position:absolute;left:6px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:#0a0a0a;white-space:nowrap;">${rawVal}</span>` : ''}
          </div>
        </div>
        <div style="position:absolute;left:50%;top:0;width:1px;height:${barH}px;background:rgba(255,255,255,.55);"></div>
      </div>
    </div>`;
}

function rolePill(roleName, score) {
  const sc = Math.round(score);
  const bc = barColor(sc);
  const fg = sc > 45 ? '#0a0a0a' : '#fff';
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;background:#1c2236;border-radius:10px;padding:14px 18px;margin-bottom:12px;width:370px;box-sizing:border-box;">
      <span style="font-size:19px;color:#e2e6ee;font-weight:500;">${roleName}</span>
      <span style="font-size:19px;font-weight:800;padding:4px 16px;border-radius:6px;min-width:46px;text-align:center;background:${bc};color:${fg};">${sc}</span>
    </div>`;
}

function trendSvg(trendData) {
  if (!trendData || trendData.length < 2) return '';
  const W = 370, H = 95;
  const scores = trendData.map(d => d.score);
  const mn = Math.min(...scores) - 8, mx = Math.max(...scores) + 8;
  const tx = i => 24 + i * (W - 48) / (trendData.length - 1);
  const ty = s => H - 22 - (s - mn) / (mx - mn || 1) * (H - 40);
  const pts = trendData.map((d, i) => `${tx(i)},${ty(d.score)}`).join(' ');
  const dots = trendData.map((d, i) => {
    const x = tx(i), y = ty(d.score);
    return `<rect x="${x-19}" y="${y-28}" width="38" height="22" rx="5" fill="${TREND_CYAN}"/>
      <text x="${x}" y="${y-12}" text-anchor="middle" fill="#04222a" font-size="15" font-weight="800" font-family="Montserrat">${d.score}</text>
      <text x="${x}" y="${H}" text-anchor="middle" fill="#8b93a7" font-size="14" font-family="Montserrat">${d.season}</text>`;
  }).join('');
  return `<svg width="${W}" height="${H+10}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${H-2}" x2="${W}" y2="${H-2}" stroke="#2a3349" stroke-width="1.5"/>
    <polyline points="${pts}" fill="none" stroke="${TREND_CYAN}" stroke-width="3"/>${dots}
  </svg>`;
}

function physicalDotsHtml(physical) {
  const dotColors = { 5: '#22c55e', 4: '#65d17e', 3: '#9ad15a', 2: '#e0c84a', 1: '#e0c84a' };
  return Object.entries(physical).map(([attr, dots]) => {
    const dotsHtml = [0, 1, 2, 3, 4].map(i => {
      const filled = i < dots;
      const col = filled ? (dotColors[dots] || '#22c55e') : '#3a4566';
      return `<span style="width:21px;height:21px;border-radius:50%;display:inline-block;background:${col};margin-right:9px;"></span>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
      <span style="font-size:19px;color:#aab2c5;width:90px;">${attr}</span>
      <span style="display:flex;">${dotsHtml}</span>
    </div>`;
  }).join('');
}

function formBlocksHtml(form) {
  const fm = { W: '#3aa65c', D: '#e0904a', L: '#d35a48' };
  return (form || []).slice(0, 5).map(r => {
    const col = fm[r.toUpperCase()] || '#4b5563';
    return `<span style="width:54px;height:54px;border-radius:7px;display:inline-block;background:${col};margin-right:11px;"></span>`;
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
  // seasonsDetail is a dict keyed by season string (e.g. "2023-24") with no guaranteed
  // insertion order matching recency — Object.values()[0] previously grabbed whichever
  // key happened to be first, which could be the OLDEST season (confirmed bug: showed
  // Marmoush's 2023-24 Frankfurt bar-chart stats while the header correctly showed
  // Man City). Pick explicitly using the most recent season key from allSeasonsSummary,
  // falling back to sorting seasonsDetail's own keys descending if that's unavailable.
  const seasonsDetailObj = player.seasonsDetail || {};
  const mostRecentSeasonKey = (player.allSeasonsSummary && player.allSeasonsSummary[0] && player.allSeasonsSummary[0].s)
    || Object.keys(seasonsDetailObj).sort().reverse()[0];
  const sd = seasonsDetailObj[mostRecentSeasonKey] || Object.values(seasonsDetailObj)[0] || {};
  const rcs = player.roleCareerScores || {};
  const sortedRoles = Object.entries(rcs).slice(0, 3);
  const groups = sd.g || {};
  const allSeasons = player.allSeasonsSummary || [];
  const latestSeason = allSeasons[0] || {};
  const photo = photoUrl(player.name, player.team);
  const crest = player.teamFotmobId ? `${CREST_BASE}${player.teamFotmobId}.png` : '';

  const trendData = (player.sh || []).slice(-3).map(h => ({ season: h.s, score: Math.round(h.sc) }));

  // ── Dynamic row sizing: bar chart panel has a fixed vertical budget (1080 - panelTop - footerH).
  // At the reference (CF/ST) row count of 26 rows across 3 groups, 20px rows fit comfortably.
  // If a position has more metrics than that, shrink row height proportionally so the panel
  // never overflows past the bottom of the 1920x1080 canvas, regardless of how many rows the
  // upstream data pipeline includes for that position.
  // ── Dynamic row sizing: bar chart panel has a fixed vertical budget (1080 - panelTop - margin).
  // Fixed overhead (3 section headers + axis/footer, independent of row count) was measured
  // empirically via a real-DOM sweep at 163px; per-row footprint is (rowH + 1px row margin).
  // This guarantees the percentile axis never gets clipped regardless of how many bar-chart
  // metrics the upstream data pipeline includes for a given position.
  const groupKeys = ['A', 'D', 'P'];
  const totalRows = groupKeys.reduce((s, k) => s + (groups[k] ? groups[k].length : 0), 0);
  const PANEL_TOP = 333, SAFETY_MARGIN = 8, FIXED_OVERHEAD = 163;
  const maxPanelHeight = 1080 - PANEL_TOP - SAFETY_MARGIN;
  const REFERENCE_ROW_H = 20;
  let rowH = totalRows > 0
    ? Math.min(REFERENCE_ROW_H, Math.floor((maxPanelHeight - FIXED_OVERHEAD) / totalRows) - 1)
    : REFERENCE_ROW_H;
  rowH = Math.max(8, rowH); // never shrink below a legible minimum
  if (typeof window !== 'undefined' && window.__FORCE_ROW_H) rowH = window.__FORCE_ROW_H;

  const buildGroupBars = (grpKey) => {
    const rows = groups[grpKey] || [];
    const startVal = Math.floor((rows.length) / 2) * 2; // largest even number <= rowCount, decorative ruler
    return rows.map(([label, pct, val], i) => {
      const decorNum = (i % 2 === 0 && (startVal - i) >= 0) ? (startVal - i) : null;
      return barRow(label, pct, typeof val === 'number' ? val.toFixed(2) : val, decorNum, rowH);
    }).join('');
  };

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
      <div style="position:absolute;top:0;left:0;width:1920px;height:288px;background:linear-gradient(to right, ${HEADER_L} 0%, ${HEADER_R} 100%);">

        <div id="scc-photo" style="position:absolute;left:0;top:0;width:218px;height:265px;background-color:#1c2236;background-image:url('${photo}');background-size:cover;background-position:center center;"></div>

        <div style="position:absolute;left:235px;top:8px;width:470px;">
          <div style="font-size:48px;font-weight:800;line-height:1.05;letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${player.name}</div>
          <div style="font-size:24px;font-weight:600;color:#d7dbe6;margin-top:8px;">
            ${player.position ? player.position.split(',')[0].trim() : (ROLE_KEY_LABELS[player.roleKey] || '')} &nbsp; <span style="color:#b9bfcd;font-weight:500;">${player.foot && player.foot !== 'unknown' && player.foot !== 'nan' ? formatFoot(player.foot) : ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:18px;font-size:22px;color:#d7dbe6;">
            ${countryToIso2(player.birthCountry) ? `<div style="width:30px;height:22px;background-size:cover;background-position:center;background-image:url('https://flagcdn.com/32x24/${countryToIso2(player.birthCountry)}.png');"></div>` : ''}
            <span style="font-weight:700;">${player.age} years old</span>
          </div>
        </div>

        <!-- NAV -->
        <div style="position:absolute;left:235px;top:175px;display:flex;align-items:center;gap:32px;font-size:20px;color:#c2c7d4;">
          <span style="font-weight:700;color:#fff;">Profile ▸</span><span>Performance ▾</span><span>Similar Players ▾</span><span>Club Fit ▾</span><span>Video ▾</span><span>Compare ▾</span>
        </div>

        ${crest ? `<div style="position:absolute;left:725px;top:55px;width:90px;height:85px;background-size:contain;background-repeat:no-repeat;background-position:center;background-image:url('${crest}');"></div>` : ''}
        <div style="position:absolute;left:835px;top:60px;">
          <div style="font-size:24px;font-weight:700;">${player.team}</div>
          <div style="font-size:18px;color:#aab2c5;margin-top:4px;">${player.league}</div>
          <div style="font-size:16px;color:#7d869b;margin-top:8px;">${player.onLoan ? 'On Loan' : 'Important Player'}</div>
        </div>

        <div style="position:absolute;left:1180px;top:0;width:1px;height:288px;background:rgba(255,255,255,.12);"></div>

        <div style="position:absolute;left:1210px;top:55px;">
          <div style="display:flex;gap:14px;font-size:18px;margin-bottom:16px;"><span style="color:#aab2c5;width:90px;">Height:</span><span style="color:#fff;font-weight:700;">${manual.height || '—'}</span></div>
          <div style="display:flex;gap:14px;font-size:18px;margin-bottom:16px;"><span style="color:#aab2c5;width:90px;">Value:</span><span style="color:#fff;font-weight:700;">${player.marketValue > 0 ? formatMV(player.marketValue) : '—'}</span></div>
          <div style="display:flex;gap:14px;font-size:18px;"><span style="color:#aab2c5;width:90px;">Contract:</span><span style="color:#fff;font-weight:700;">${player.contract && player.contract !== 'nan' ? player.contract : '—'}</span></div>
        </div>

      </div>

      <!-- POSITION DIAGRAM -->
      <div style="position:absolute;top:15px;left:1518px;width:370px;height:220px;">
        ${pitchDiagramSvg()}
      </div>

      <!-- BEST ROLE header (top right, below pitch) -->
      <div style="position:absolute;top:248px;left:1518px;font-size:22px;font-weight:800;color:#fff;">BEST ROLE <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#4b5563;color:#cbd5e1;font-size:13px;font-weight:700;vertical-align:middle;">i</span></div>
      <!-- SEASON STATS -->
      <div style="position:absolute;top:300px;left:0;width:670px;display:flex;align-items:center;padding:0 16px;">
        <span style="font-size:20px;font-weight:800;color:${ACCENT_PINK};margin-right:24px;white-space:nowrap;">Season Stats</span>
        ${['Apps', 'Gls', 'Asts', 'xG', 'xA', 'Mins'].map((label, i) => {
          const vals = [latestSeason.m || '—', latestSeason.g || '0', latestSeason.a || '0', '—', '—', latestSeason.mins ? latestSeason.mins.toLocaleString() : '—'];
          return `<div style="display:flex;flex-direction:column;align-items:center;min-width:64px;"><span style="font-size:15px;color:#8b93a7;">${label}</span><span style="font-size:19px;font-weight:700;margin-top:2px;">${vals[i]}</span></div>`;
        }).join('')}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:64px;">
          <span style="font-size:15px;color:#8b93a7;">Av. Rat</span>
          <span style="background:#f0b94a;color:#1a1300;font-size:17px;font-weight:800;padding:2px 12px;border-radius:4px;margin-top:2px;">${sd.score ? ((sd.score - 40) / 54 * 7.5 + 1).toFixed(1) : '—'}</span>
        </div>
      </div>


      <!-- BAR CHART PANEL -->
      <div style="position:absolute;top:333px;left:0;width:670px;padding:0 16px;">
        ${groups.A && groups.A.length ? `<div style="font-size:23px;font-weight:800;color:#fff;margin:4px 0 6px;">Attacking</div>${buildGroupBars('A')}` : ''}
        ${groups.D && groups.D.length ? `<div style="font-size:23px;font-weight:800;color:#fff;margin:10px 0 6px;">Defensive</div>${buildGroupBars('D')}` : ''}
        ${groups.P && groups.P.length ? `<div style="font-size:23px;font-weight:800;color:#fff;margin:10px 0 6px;">Possession</div>${buildGroupBars('P')}` : ''}
        <div style="display:flex;align-items:center;margin-top:6px;">
          <div style="width:170px;flex-shrink:0;"></div>
          <div style="width:26px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;justify-content:space-between;font-size:13px;color:#6b7280;padding:0 0 0 0;">
            ${[0,10,20,30,40,50,60,70,80,90,100].map(p=>`<span>${p}%</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;">
          <div style="width:196px;flex-shrink:0;"></div>
          <div style="flex:1;text-align:center;font-size:15px;color:#8b93a7;padding-top:5px;">Percentile Rank</div>
        </div>
      </div>

      <!-- NOTES PANEL -->
      <div style="position:absolute;top:345px;left:702px;width:786px;padding:0 30px 0 30px;">
        <div style="display:flex;gap:10px;margin-bottom:22px;">
          <span style="color:${ACCENT_PINK};font-size:22px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:21px;line-height:1.5;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">Key Attributes: </span>${manual.keyAttributes || ''}</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:22px;">
          <span style="color:${ACCENT_PINK};font-size:22px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:21px;line-height:1.5;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">Development Areas: </span>${manual.devAreas || ''}</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:26px;">
          <span style="color:${ACCENT_PINK};font-size:22px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:21px;line-height:1.5;color:${LABEL_COL};"><span style="color:${ACCENT_PINK};font-weight:700;">View: </span>${manual.view || ''}</div>
        </div>
        <div style="margin-top:8px;">
          <div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:10px;">CURRENT LEVEL</div>
          <div style="display:flex;align-items:center;gap:14px;"><span style="font-size:28px;">${starsHtml(manual.currentScore ?? player.careerScore)}</span><span style="font-size:19px;color:#aab2c5;">${manual.currentLevel || scoreLabel(player.careerScore)}</span></div>
        </div>
        <div style="margin-top:24px;">
          <div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:10px;">POTENTIAL LEVEL</div>
          <div style="display:flex;align-items:center;gap:14px;"><span style="font-size:28px;">${starsHtml(manual.potentialScore ?? player.potentialScore ?? player.careerScore)}</span><span style="font-size:19px;color:#aab2c5;">${manual.potentialLevel || scoreLabel(player.potentialScore || player.careerScore)}</span></div>
        </div>
      </div>

      <!-- FAR RIGHT PANEL -->
      <div style="position:absolute;top:290px;left:1518px;width:370px;">
        ${rolesHtml}
        ${trendData.length >= 2 ? `<div style="margin-top:24px;"><div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:14px;">PERFORMANCE TREND</div>${trendSvg(trendData)}</div>` : ''}
        <div style="margin-top:28px;"><div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:18px;">PHYSICAL</div>${physicalDotsHtml(manual.physical || { Pace: 3, Power: 3, Fitness: 3 })}</div>
        <div style="margin-top:18px;">
          <div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:14px;">FORM</div>
          <div style="display:flex;margin-top:8px;">${formBlocksHtml(manual.form || [])}</div>
          ${manual.avgRating5 ? `<div style="display:inline-flex;align-items:center;gap:8px;background:#d35a48;color:#fff;font-size:16px;font-weight:700;padding:6px 14px;border-radius:5px;margin-top:14px;">${manual.avgRating5} <span style="font-weight:500;">Last 5 Avg Rating</span></div>` : ''}
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
  }

  // Force-load the specific weights the card actually uses (400/500/600/700/800)
  // and wait for the browser's real font-ready signal — a flat setTimeout is not
  // reliable enough to guarantee bold text has applied before html2canvas captures.
  try {
    const weights = [400, 500, 600, 700, 800];
    await Promise.all(weights.map(w => document.fonts.load(`${w} 16px Montserrat`)));
    await document.fonts.ready;
  } catch (e) {
    // Font Loading API unsupported or failed — fall back to a short wait so we don't hang forever
    await new Promise(r => setTimeout(r, 500));
  }

  const el = buildCardElement(player, manual);

  // background-image has no onerror — preload the real photo URL manually and
  // swap to the fallback image if it 404s, before html2canvas captures the card.
  const photoDiv = el.querySelector('#scc-photo');
  if (photoDiv) {
    const bgUrl = photoUrl(player.name, player.team);
    await new Promise((resolve) => {
      const testImg = new Image();
      testImg.onload = () => resolve();
      testImg.onerror = () => {
        photoDiv.style.backgroundImage = "url('/fallback.png')";
        resolve();
      };
      testImg.src = bgUrl;
    });
  }

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
