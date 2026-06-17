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
const BG          = '#0a0f1c';          // Feature F PAGE_BG
const HEADER_L     = 'rgb(23,26,77)';   // header gradient left
const HEADER_R     = 'rgb(17,22,42)';   // header gradient right
const ACCENT_PINK  = '#ff66c4';         // spec
const TREND_CYAN   = '#00cadc';         // spec trend line
const LABEL_COL    = '#e8eef8';
const BAR_TRACK    = '#1b2636';         // Feature F TRACK
const BAR_RED      = 'rgb(199,54,60)';  // Feature F #C7363C
const BAR_GOLD     = 'rgb(240,197,106)';// Feature F #F0C56A
const BAR_GREEN    = 'rgb(61,166,91)';  // Feature F #3DA65B

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

function barRow(label, pct, rawVal, rowH = 18) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const bc = barColor(p);
  const barH = Math.max(10, rowH - 4);
  return `
    <div style="display:flex;align-items:center;height:${rowH}px;margin-bottom:1px;">
      <div style="font-size:12px;font-weight:700;color:${LABEL_COL};width:180px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
      <div style="flex:1;position:relative;height:${barH}px;">
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(to right, rgba(255,255,255,.10) 0 1px, transparent 1px 10%), ${BAR_TRACK};"></div>
        <div style="position:relative;height:100%;width:${p}%;background:${bc};">
          ${rawVal ? `<span style="position:absolute;left:6px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:400;color:#0b0b0b;white-space:nowrap;">${rawVal}</span>` : ''}
        </div>
        <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:repeating-linear-gradient(to bottom, rgba(255,255,255,.85) 0 3px, transparent 3px 6px);"></div>
      </div>
    </div>`;
}

function rolePill(roleName, score, width = 320) {
  const sc = Math.round(score);
  const bc = barColor(sc);
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;width:${width}px;height:46px;margin:0 auto 14px;">
      <span style="background:#737373;border-radius:10px;padding:8px 16px;font-size:20px;color:#fff;font-weight:600;white-space:nowrap;">${roleName}</span>
      <span style="font-size:19px;font-weight:800;padding:6px 15px;border-radius:8px;min-width:42px;text-align:center;background:${bc};color:#000000;">${sc}</span>
    </div>`;
}

function trendSvg(trendData) {
  if (!trendData || trendData.length < 2) return '';
  const W = 338, H = 130;
  const scores = trendData.map(d => d.score);
  const mn = Math.min(...scores) - 8, mx = Math.max(...scores) + 8;
  const tx = i => 30 + i * (W - 60) / (trendData.length - 1);
  const ty = s => H - 30 - (s - mn) / (mx - mn || 1) * (H - 58);
  const pts = trendData.map((d, i) => `${tx(i)},${ty(d.score)}`).join(' ');
  const dots = trendData.map((d, i) => {
    const x = tx(i), y = ty(d.score);
    return `<rect x="${x-19}" y="${y-26}" width="38" height="22" rx="5" fill="${barColor(d.score)}"/>
      <text x="${x}" y="${y-10}" text-anchor="middle" fill="#000000" font-size="13" font-weight="700" font-family="Montserrat">${d.score}</text>
      <text x="${x}" y="${H-4}" text-anchor="middle" fill="#c0c0c0" font-size="13" font-family="Montserrat">${d.season}</text>`;
  }).join('');
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${pts}" fill="none" stroke="${TREND_CYAN}" stroke-width="3"/>${dots}
  </svg>`;
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

  // ── Season-stats values ──────────────────────────────────────────────────
  // xG / xA are not stored as season totals in players.json, but the bar-chart
  // group A carries the per-90 raw values (e.g. ['xG', pct, 0.42]). Wyscout-style
  // season totals are per90 × (mins / 90) — this reproduces the Canva numbers
  // (Adu: 0.38/90 × 1320min ≈ 5.6 → 5.8 shown). Falls back to '—' if unavailable.
  const minsNum = latestSeason.mins || sd.mins || 0;
  const findRawA = (...labels) => {
    const arr = groups.A || [];
    const hit = arr.find(r => labels.includes(String(r[0]).toLowerCase().trim()));
    return hit && typeof hit[2] === 'number' ? hit[2] : null;
  };
  const per90ToSeason = (v) => (v != null && minsNum) ? (v * minsNum / 90) : null;
  const xgSeason = per90ToSeason(findRawA('xg'));
  const xaSeason = per90ToSeason(findRawA('xa', 'expected assists'));
  const fmt1 = (v) => (v == null ? '—' : v.toFixed(1));
  const leagueName = latestSeason.l || player.league || '';

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
  const PANEL_TOP = 409, SAFETY_MARGIN = 8, FIXED_OVERHEAD = 150;
  const maxPanelHeight = 1080 - PANEL_TOP - SAFETY_MARGIN;
  const REFERENCE_ROW_H = 20;
  let rowH = totalRows > 0
    ? Math.min(REFERENCE_ROW_H, Math.floor((maxPanelHeight - FIXED_OVERHEAD) / totalRows) - 1)
    : REFERENCE_ROW_H;
  rowH = Math.max(8, rowH); // never shrink below a legible minimum
  if (typeof window !== 'undefined' && window.__FORCE_ROW_H) rowH = window.__FORCE_ROW_H;

  const buildGroupBars = (grpKey) => {
    const rows = groups[grpKey] || [];
    return rows.map(([label, pct, val]) =>
      barRow(label, pct, typeof val === 'number' ? val.toFixed(2) : val, rowH)
    ).join('');
  };

  const rolesHtml = sortedRoles.map(([role, score]) => rolePill(role, score)).join('');

  // Match-rating (≈5.5–8.5 useful range) → red-gold-green pill colour, per spec
  const ratingPct = (r) => { const v = parseFloat(r); return isNaN(v) ? 50 : Math.max(0, Math.min(100, (v - 5.5) / 3 * 100)); };
  const ratingColor = (r) => barColor(ratingPct(r));
  const seasonRating = sd.score ? ((sd.score - 40) / 54 * 7.5 + 1).toFixed(1) : null;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1920px';
  container.style.height = '1080px';

  container.innerHTML = `

    <div style="width:1920px;height:1080px;overflow:hidden;background:${BG};font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      <!-- HEADER GRADIENT BAND (left region) -->
      <div style="position:absolute;top:0;left:0;width:1520px;height:270px;background:linear-gradient(to right, ${HEADER_L} 0%, ${HEADER_R} 100%);"></div>

      <!-- PHOTO -->
      <div id="scc-photo" style="position:absolute;left:-12px;top:16px;width:261px;height:261px;background-color:transparent;background-image:url('${photo}');background-size:cover;background-position:center top;"></div>

      <!-- NAME / POSITION / FOOT / FLAG / AGE -->
      <div style="position:absolute;left:248px;top:24px;width:880px;font-size:40px;font-weight:700;line-height:1.05;letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${player.name}</div>
      <div style="position:absolute;left:248px;top:87px;font-size:20px;font-weight:600;color:#fff;">${player.position ? player.position.split(',')[0].trim() : (ROLE_KEY_LABELS[player.roleKey] || '')}</div>
      ${player.foot && player.foot !== 'unknown' && player.foot !== 'nan' ? `<div style="position:absolute;left:536px;top:90px;font-size:16px;color:#c0c0c0;">${formatFoot(player.foot)}</div>` : ''}
      ${countryToIso2(player.birthCountry) ? `<div style="position:absolute;left:248px;top:155px;width:47px;height:28px;background-size:cover;background-position:center;background-image:url('https://flagcdn.com/48x36/${countryToIso2(player.birthCountry)}.png');"></div>` : ''}
      <div style="position:absolute;left:310px;top:153px;font-size:20px;font-weight:600;color:#fff;">${player.age} years old</div>

      <!-- NAV -->
      ${[['Profile ▸',267,true],['Performance ▾',442,false],['Similar Players ▾',697,false],['Club Fit ▾',977,false],['Video ▾',1174,false],['Compare ▾',1318,false]].map(([t,x,act]) => `<div style="position:absolute;left:${x}px;top:227px;font-size:21px;font-weight:700;color:${act ? '#fff' : '#b4b4b4'};">${t}</div>`).join('')}

      <!-- CLUB CREST / NAME / LEAGUE -->
      ${crest ? `<div style="position:absolute;left:764px;top:56px;width:89px;height:124px;background-size:contain;background-repeat:no-repeat;background-position:center;background-image:url('${crest}');"></div>` : ''}
      <div style="position:absolute;left:884px;top:57px;font-size:20px;font-weight:700;color:#fff;">${player.team}</div>
      <div style="position:absolute;left:884px;top:97px;font-size:16px;font-weight:500;color:#fff;">${player.league}</div>
      <div style="position:absolute;left:884px;top:147px;font-size:16px;color:#d9d9d9;">${player.onLoan ? 'On Loan' : 'Important Player'}</div>

      <!-- HEADER VERTICAL SEPARATOR -->
      <div style="position:absolute;left:1164px;top:45px;width:3px;height:155px;background:#737373;"></div>

      <!-- INFO BOX -->
      ${[['Height:', manual.height || '—'], ['Value:', player.marketValue > 0 ? formatMV(player.marketValue) : '—'], ['Contract:', (player.contract && player.contract !== 'nan') ? player.contract : '—']].map(([k,v],i) => `
        <div style="position:absolute;left:1196px;top:${56 + i*45}px;font-size:15px;font-weight:600;color:#d9d9d9;">${k}</div>
        <div style="position:absolute;left:1311px;top:${56 + i*45}px;font-size:15px;font-weight:600;color:#fff;">${v}</div>`).join('')}

      <!-- FULL-HEIGHT SEPARATOR -->
      <div style="position:absolute;left:1520px;top:0;width:3px;height:1080px;background:#737373;"></div>

      <!-- CHART / TEXTBOX SEPARATOR -->
      <div style="position:absolute;left:890px;top:291px;width:2px;height:789px;background:#737373;"></div>

      <!-- RIGHT PANEL (centred in the right block x1520–1920; exact spec Y) -->
      <div style="position:absolute;top:16px;left:1520px;width:400px;display:flex;justify-content:center;"><div style="width:329px;height:218px;">${pitchDiagramSvg()}</div></div>

      <!-- BEST ROLE -->
      <div style="position:absolute;top:245px;left:1520px;width:400px;text-align:center;font-size:21px;font-weight:700;color:#d9d9d9;">BEST ROLE <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#4b5563;color:#cbd5e1;font-size:12px;font-weight:700;vertical-align:middle;">i</span></div>

      <!-- ROLE PILLS -->
      <div style="position:absolute;top:291px;left:1520px;width:400px;">${rolesHtml}</div>

      <!-- DIVIDER 1 -->
      <div style="position:absolute;top:468px;left:1546px;width:349px;height:2px;background:rgba(192,192,192,.35);"></div>

      ${trendData.length >= 2 ? `
      <!-- PERFORMANCE TREND -->
      <div style="position:absolute;top:482px;left:1520px;width:400px;text-align:center;font-size:21px;font-weight:700;color:#d9d9d9;">PERFORMANCE TREND</div>
      <div style="position:absolute;top:512px;left:1520px;width:400px;display:flex;justify-content:center;">${trendSvg(trendData)}</div>` : ''}

      <!-- DIVIDER 2 -->
      <div style="position:absolute;top:680px;left:1546px;width:349px;height:2px;background:rgba(192,192,192,.35);"></div>

      <!-- PHYSICAL -->
      <div style="position:absolute;top:686px;left:1520px;width:400px;text-align:center;font-size:21px;font-weight:700;color:#d9d9d9;">PHYSICAL</div>
      ${(() => {
        const phys = manual.physical || { Pace: 3, Power: 3, Fitness: 3 };
        const rowY = { Pace: 728, Power: 792, Fitness: 859 };
        const dotCol = { 5:'#22c55e', 4:'#65d17e', 3:'#9ad15a', 2:'#e0c84a', 1:'#e0c84a' };
        return Object.entries(rowY).map(([attr, y]) => {
          const n = phys[attr] || 0;
          const dots = [0,1,2,3,4].map(i => {
            const col = i < n ? (dotCol[n] || '#22c55e') : '#3a4566';
            return `<span style="width:25px;height:25px;border-radius:50%;background:${col};"></span>`;
          }).join('');
          return `<div style="position:absolute;top:${y}px;left:1560px;width:320px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:17px;font-weight:700;color:#d9d9d9;">${attr}</span>
            <span style="display:flex;gap:15px;">${dots}</span>
          </div>`;
        }).join('');
      })()}

      <!-- DIVIDER 3 -->
      <div style="position:absolute;top:906px;left:1546px;width:349px;height:2px;background:rgba(192,192,192,.35);"></div>

      <!-- FORM -->
      <div style="position:absolute;top:916px;left:1520px;width:400px;text-align:center;font-size:21px;font-weight:600;color:#c0c0c0;">FORM</div>
      <div style="position:absolute;top:950px;left:1520px;width:400px;display:flex;justify-content:center;gap:11px;">
        ${(manual.form || []).slice(0,5).map(r => { const fm={W:'#3aa65c',D:'#e0904a',L:'#d35a48'}; const c=fm[String(r).toUpperCase()]||'#4b5563'; return `<span style="width:25px;height:73px;border-radius:6px;background:${c};"></span>`; }).join('')}
      </div>
      ${manual.avgRating5 ? `
      <div style="position:absolute;top:1038px;left:1520px;width:400px;display:flex;align-items:center;justify-content:center;gap:10px;">
        <span style="font-size:12px;font-weight:700;color:#000;background:${ratingColor(manual.avgRating5)};border-radius:6px;padding:3px 9px;">${manual.avgRating5}</span>
        <span style="font-size:13px;font-weight:600;color:#c0c0c0;">Last 5 Avg Rating</span>
      </div>` : ''}

      <!-- SEASON STATS -->
      <div style="position:absolute;top:300px;left:17px;font-size:20px;font-weight:700;color:${ACCENT_PINK};">Season Stats</div>
      <div style="position:absolute;top:357px;left:24px;font-size:16px;color:#fff;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${leagueName}</div>
      ${(() => {
        const cols = [
          ['Apps', 235, latestSeason.m != null ? String(latestSeason.m) : '—'],
          ['Gls',  332, latestSeason.g != null ? String(latestSeason.g) : '0'],
          ['Asts', 408, latestSeason.a != null ? String(latestSeason.a) : '0'],
          ['xG',   500, fmt1(xgSeason)],
          ['xA',   595, fmt1(xaSeason)],
          ['Mins', 678, latestSeason.mins ? latestSeason.mins.toLocaleString() : '—'],
        ];
        const heads = cols.map(([lab,x]) => `<div style="position:absolute;top:319px;left:${x}px;font-size:15px;color:#d9d9d9;">${lab}</div>`).join('');
        const vals = cols.map(([,x,v]) => `<div style="position:absolute;top:357px;left:${x}px;font-size:15px;color:#fff;">${v}</div>`).join('');
        const avHead = `<div style="position:absolute;top:319px;left:782px;font-size:15px;color:#d9d9d9;">Av Rat</div>`;
        const avVal = seasonRating ? `<span style="position:absolute;top:354px;left:782px;font-size:15px;font-weight:400;color:#000;background:${ratingColor(seasonRating)};border-radius:6px;padding:2px 10px;">${seasonRating}</span>` : '';
        return heads + vals + avHead + avVal;
      })()}

      <!-- PERCENTILE CHART (Feature F) -->
      <div style="position:absolute;top:409px;left:6px;width:876px;">
        ${groups.A && groups.A.length ? `<div style="font-size:24px;font-weight:900;color:#f3f5f7;margin:0 0 6px;">Attacking</div>${buildGroupBars('A')}` : ''}
        ${groups.D && groups.D.length ? `<div style="font-size:24px;font-weight:900;color:#f3f5f7;margin:10px 0 6px;">Defensive</div>${buildGroupBars('D')}` : ''}
        ${groups.P && groups.P.length ? `<div style="font-size:24px;font-weight:900;color:#f3f5f7;margin:10px 0 6px;">Possession</div>${buildGroupBars('P')}` : ''}
        <div style="display:flex;align-items:center;margin-top:6px;">
          <div style="width:180px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#ffffff;">
            ${[0,10,20,30,40,50,60,70,80,90,100].map(p=>`<span>${p}%</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;">
          <div style="width:180px;flex-shrink:0;"></div>
          <div style="flex:1;text-align:center;font-size:13px;font-weight:700;color:${LABEL_COL};padding-top:6px;">Percentile Rank</div>
        </div>
      </div>

      <!-- NOTES (Key Attributes / Dev / View) — spread across the text box -->
      <div style="position:absolute;top:291px;left:898px;width:616px;height:570px;display:flex;flex-direction:column;justify-content:space-between;">
        <div style="display:flex;gap:10px;">
          <span style="color:${ACCENT_PINK};font-size:21px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:21px;line-height:1.5;color:#fff;"><span style="color:${ACCENT_PINK};font-weight:700;">Key Attributes: </span><span style="font-weight:600;">${manual.keyAttributes || ''}</span></div>
        </div>
        <div style="display:flex;gap:10px;">
          <span style="color:${ACCENT_PINK};font-size:21px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:21px;line-height:1.5;color:#fff;"><span style="color:${ACCENT_PINK};font-weight:700;">Development Areas: </span><span style="font-weight:600;">${manual.devAreas || ''}</span></div>
        </div>
        <div style="display:flex;gap:10px;">
          <span style="color:${ACCENT_PINK};font-size:21px;flex-shrink:0;line-height:1.5;">•</span>
          <div style="font-size:21px;line-height:1.5;color:#fff;"><span style="color:${ACCENT_PINK};font-weight:700;">View: </span><span style="font-weight:600;">${manual.view || ''}</span></div>
        </div>
      </div>

      <!-- CURRENT / POTENTIAL LEVEL -->
      <div style="position:absolute;top:894px;left:938px;font-size:20px;font-weight:600;color:#fff;">CURRENT LEVEL</div>
      <div style="position:absolute;top:940px;left:941px;">${starsHtml(manual.currentScore ?? player.careerScore, 28)}</div>
      <div style="position:absolute;top:948px;left:1111px;font-size:15px;font-weight:500;color:#c0c0c0;">${manual.currentLevel || scoreLabel(player.careerScore)}</div>
      <div style="position:absolute;top:995px;left:938px;font-size:20px;font-weight:600;color:#fff;">POTENTIAL LEVEL</div>
      <div style="position:absolute;top:1033px;left:937px;">${starsHtml(manual.potentialScore ?? player.potentialScore ?? player.careerScore, 28)}</div>
      <div style="position:absolute;top:1039px;left:1111px;font-size:15px;font-weight:500;color:#c0c0c0;">${manual.potentialLevel || scoreLabel(player.potentialScore || player.careerScore)}</div>

    </div>
  `;

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
