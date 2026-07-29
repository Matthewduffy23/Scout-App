// CoachQuickCard.js — standalone manager quick card
// v2: computeCoachScore() extracted and exported (used by TeamReport) — the
// build function now calls it, so there remains exactly one implementation., formatted to match the
// player QuickCard EXACTLY (tile chrome, Style hexagons, Career line chart,
// Team Context bands) with the Team HQ "⚡ Team Comparison Radar" as the
// bottom-right Impact tile. Independent of CoachCard.js apart from a few
// functional helpers imported below.
import { computeCoachMetricGroups } from './coachMetrics';
import { deliverPng } from './utils';
import {
  computeAge, countryToIso2, leagueToCountry, teamCrestUrl, fadeHexToBG,
  FOTMOB_PHOTO_BASE, ensureMontserratEmbedded, MONTSERRAT_EMBED_CSS,
  abbrevLeague, shortSeason, tenureHistory, resolveStatsRow } from './CoachCard';

// ── player-card visual constants (copied verbatim so styling matches exactly) ──
const BG        = '#0a0f1c';
const HEADER_L  = 'rgb(23,26,77)';
const HEADER_R  = 'rgb(17,22,42)';
const LABEL_COL = '#e8eef8';
const BAR_RED   = 'rgb(199,54,60)';
const BAR_GOLD  = 'rgb(240,197,106)';
const BAR_GREEN = 'rgb(61,166,91)';
const ACCENT_PINK = '#ff66c4';
const PANEL_BG     = 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))';
const PANEL_BORDER = 'rgba(255,255,255,0.13)';
const PANEL_SHADOW = '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)';
const PANEL_RADIUS = 14, PANEL_PAD = 22, PANEL_GAP_H = 24, PANEL_GAP_V = 24;

const _n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const _clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const _interp = (a, b, t) => [0,1,2].map(i => Math.round(a[i]+(b[i]-a[i])*t));
const _parseRgb = (s) => s.match(/\d+/g).map(Number);

function barColor(pct) {
  const t = Math.max(0, Math.min(1, pct/100));
  const RED = _parseRgb(BAR_RED), GOLD = _parseRgb(BAR_GOLD), GREEN = _parseRgb(BAR_GREEN);
  const rgb = t <= 0.5 ? _interp(RED,GOLD,t/0.5) : _interp(GOLD,GREEN,(t-0.5)/0.5);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}
function scoreTierColor(score) {
  const v = Number(score);
  if (isNaN(v)) return '#a3a3a3';
  if (v >= 79) return '#00bf63';
  if (v >= 67) return '#7ed957';
  if (v >= 55) return '#c1ff72';
  if (v >= 43) return '#ffde59';
  if (v >= 34) return '#ffbd59';
  if (v >= 25) return '#ff914d';
  return '#ff3131';
}
function pillColor(score) {
  const v = Number(score);
  if (isNaN(v)) return { bg: '#3a4458', fg: '#dbe1ee' };
  if (v >= 85) return { bg: '#fbc701', fg: '#07090f' };
  if (v >= 77) return { bg: '#004aad', fg: '#ffffff' };
  if (v >= 72) return { bg: '#00bf63', fg: '#ffffff' };
  if (v >= 66) return { bg: '#d9d9d9', fg: '#07090f' };
  if (v >= 60) return { bg: '#a3a3a3', fg: '#07090f' };
  if (v >= 54) return { bg: '#f18c31', fg: '#07090f' };
  return { bg: '#bd6742', fg: '#ffffff' };
}

// percentile-bar row for the LEFT column (identical to player barRow)
function barRow(label, pct, rawVal, rowH = 18, extraGap = 0) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const bc = barColor(p);
  const barH = Math.max(13, Math.round(rowH * 0.95));
  return `
    <div style="display:flex;align-items:center;height:${rowH}px;margin-bottom:${1+extraGap}px;">
      <div style="width:188px;flex-shrink:0;font-size:12px;font-weight:600;color:${LABEL_COL};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
      <div style="flex:1;position:relative;height:${barH}px;background:#1b2636;border-radius:2px;">
        <div style="position:relative;height:100%;width:${p}%;background:${bc};border-radius:2px;">
          ${rawVal != null ? `<span style="position:absolute;left:4px;top:50%;transform:translateY(-50%);font-size:9px;color:#0b0b0b;font-weight:600;white-space:nowrap;">${rawVal}</span>` : ''}
        </div>
        <div style="position:absolute;left:50%;top:0;width:2px;height:100%;background:repeating-linear-gradient(to bottom, rgba(255,255,255,.95) 0 4px, transparent 4px 7px);"></div>
      </div>
    </div>`;
}

// GBE criteria row (manager) — player-style tick circle + label/sublabel.
// No points for managers: a route is either selected (Pass) or not.
function gbeCriteriaRow(label, sub, selected) {
  return `
    <div style="display:flex;align-items:center;gap:11px;">
      <span style="width:17px;height:17px;border-radius:50%;flex-shrink:0;background:${selected?'#dbe1ee':'transparent'};border:1.5px solid ${selected?'#dbe1ee':'#3a4458'};display:flex;align-items:center;justify-content:center;">
        ${selected ? `<span style="color:#07090f;font-size:11px;font-weight:900;line-height:1;">&#10003;</span>` : ''}
      </span>
      <div style="display:flex;flex-direction:column;line-height:1.2;">
        <span style="font-size:14px;font-weight:700;color:${selected?'#e8eef8':'#9aa3b8'};">${label}</span>
        <span style="font-size:11px;font-weight:500;color:#5e6678;">${sub}</span>
      </div>
    </div>`;
}

// STYLE hexagons — identical geometry to player rolesRankedSvgHtml
function styleHexSvg(rows, maxWidth = 404) {
  const R = 11;
  const hex = (cx, cy, opacity, col) => {
    const pts = Array.from({length:6}, (_,i) => {
      const a = Math.PI/180 * (60*i - 30);
      return `${(cx + R*Math.cos(a)).toFixed(1)},${(cy + R*Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${col}" opacity="${opacity}" stroke="#07090f" stroke-width="1.5"/>`;
  };
  const rowH = 46, labelW = 172, numHex = 10, W = R * 2, hexGap = 1;
  const totalHexW = numHex * W + (numHex - 1) * hexGap;
  const w = Math.min(maxWidth, labelW + totalHexW + 6);
  const h = rows.length * rowH + 8;
  const body = rows.map(([disp, score], i) => {
    const sc = Math.round(score || 0);
    const filled = Math.max(0, Math.min(numHex, Math.round(sc / 10)));
    const col = scoreTierColor(sc);
    const y = i * rowH + rowH / 2 + 4;
    const hexes = Array.from({length: numHex}, (_, d) => {
      const cx = labelW + d * (W + hexGap) + W/2;
      const isFilled = d < filled;
      const opacity = isFilled ? (1 - (d / numHex) * 0.4).toFixed(2) : 0.1;
      return hex(cx, y, opacity, isFilled ? col : '#dbe1ee');
    }).join('');
    return `<text x="0" y="${y+5}" font-family="Montserrat,sans-serif" font-size="15" font-weight="800" fill="#c8d2e0">${disp}</text>${hexes}`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

// CAREER line chart — mirrors player careerTrajectorySvg styling (per-season scores)
// Career chart, league-finish variant. Y is inverted so 1st sits at the top, and
// each season is scaled against its OWN league size — finishing 3rd of 24 and 3rd
// of 20 are not the same achievement, so the dot height reflects the percentile
// within that division rather than the raw position number.
function finishChartSvg(points, w, h) {
  const usable = points.filter(p => p.finish && p.finish.rank && p.finish.size > 1);
  if (!usable.length) {
    return `<div style="font-size:13px;color:#5e6678;padding:6px 0;">No league finish data for these seasons.</div>`;
  }
  const small = usable.length === 1;
  const pad = { t: 18, r: 16, b: 26, l: 16 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const DATA_X = 0.82, dataW = pw * DATA_X;
  const n = usable.length;
  // pctOf: 100 = won the league, 0 = bottom.
  const pctOf = f => ((f.size - f.rank) / (f.size - 1)) * 100;
  const xS = i => pad.l + (n === 1 ? dataW / 2 : (i / (n - 1)) * dataW);
  const yS = pct => pad.t + ph - (pct / 100) * ph;
  const GUIDES = [[100, '1st'], [50, 'Mid'], [0, 'Last']];
  const guideLines = GUIDES.map(([pct, label]) => {
    const y = yS(pct);
    return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${pad.l + pw}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3"/><text x="${(pad.l + pw - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-family="Montserrat,sans-serif" font-size="9" font-weight="700" fill="rgba(255,255,255,0.4)" text-anchor="end">${label}</text>`;
  }).join('');
  const linePts = usable.map((p, i) => `${xS(i).toFixed(1)},${yS(pctOf(p.finish)).toFixed(1)}`).join(' ');
  const dots = usable.map((p, i) => {
    const pct = pctOf(p.finish);
    const cx = xS(i), cy = yS(pct), col = scoreTierColor(pct);
    const sLbl = String(p.season).replace(/^20/, '');
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${col}" stroke="#07090f" stroke-width="1.5"/><text x="${cx.toFixed(1)}" y="${(cy - 11).toFixed(1)}" font-family="Montserrat,sans-serif" font-size="11" font-weight="700" fill="${col}" text-anchor="middle">${p.finish.rank}/${p.finish.size}</text><text x="${cx.toFixed(1)}" y="${(pad.t + ph + 17).toFixed(1)}" font-family="Montserrat,sans-serif" font-size="10" font-weight="600" fill="#5e6678" text-anchor="middle">${sLbl}</text>`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    ${guideLines}
    <line x1="${pad.l}" y1="${pad.t + ph}" x2="${pad.l + pw}" y2="${pad.t + ph}" stroke="#1e2a3e" stroke-width="1"/>
    <polyline points="${linePts}" fill="none" stroke="#a78bfa" stroke-width="2.5"/>
    ${dots}
    ${small ? `<text x="${pad.l}" y="${pad.t - 6}" font-family="Montserrat,sans-serif" font-size="10" font-weight="600" fill="#5e6678">Small Sample</text>` : ''}
  </svg>`;
}

export function careerChartSvg(points, w = 404, h = 284, mode = 'score') {
  if (!points.length) return `<div style="font-size:13px;color:#5e6678;padding:6px 0;">Not enough season history.</div>`;
  // League-finish mode plots position instead of score. It needs its own axis
  // (inverted — 1st at the top), and the score band lines are meaningless here,
  // so it gets a separate renderer rather than a pile of conditionals.
  if (mode === 'finish') return finishChartSvg(points, w, h);
  const small = points.length === 1;
  const pad = { t: 18, r: 16, b: 26, l: 16 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const LEAGUE_BANDS = [['PL',72],['T5L',68],['Champ',61],['L1',57],['L2',54],['NL',50]];
  const scores = points.map(p => p.sc);
  const minS = Math.min(...scores) - 4, maxS = Math.max(...scores) + 4;
  const bands = LEAGUE_BANDS.filter(([,v]) => v >= minS && v <= maxS);
  const DATA_X = 0.82, dataW = pw * DATA_X;
  const n = points.length;
  const xS = i => pad.l + (n === 1 ? dataW/2 : (i/(n-1))*dataW);
  const yS = v => pad.t + ph - ((v - minS)/(maxS - minS || 1))*ph;
  const linePts = points.map((p,i) => `${xS(i).toFixed(1)},${yS(p.sc).toFixed(1)}`).join(' ');
  const bandLines = bands.map(([label,val]) => {
    const y = yS(val);
    return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${pad.l+pw}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3"/><text x="${(pad.l+pw-3).toFixed(1)}" y="${(y-3).toFixed(1)}" font-family="Montserrat,sans-serif" font-size="9" font-weight="700" fill="rgba(255,255,255,0.4)" text-anchor="end">${label}</text>`;
  }).join('');
  const dots = points.map((p,i) => {
    const cx = xS(i), cy = yS(p.sc), col = scoreTierColor(p.sc);
    const sLbl = String(p.season).replace(/^20/, '');
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${col}" stroke="#07090f" stroke-width="1.5"/><text x="${cx.toFixed(1)}" y="${(cy-11).toFixed(1)}" font-family="Montserrat,sans-serif" font-size="11" font-weight="700" fill="${col}" text-anchor="middle">${Math.round(p.sc)}</text><text x="${cx.toFixed(1)}" y="${(pad.t+ph+17).toFixed(1)}" font-family="Montserrat,sans-serif" font-size="10" font-weight="600" fill="#5e6678" text-anchor="middle">${sLbl}</text>`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    ${bandLines}
    <line x1="${pad.l}" y1="${pad.t+ph}" x2="${pad.l+pw}" y2="${pad.t+ph}" stroke="#1e2a3e" stroke-width="1"/>
    <polyline points="${linePts}" fill="none" stroke="#a78bfa" stroke-width="2.5"/>
    ${dots}
    ${small ? `<text x="${pad.l}" y="${pad.t-6}" font-family="Montserrat,sans-serif" font-size="10" font-weight="600" fill="#5e6678">Small Sample</text>` : ''}
  </svg>`;
}

// TEAM CONTEXT — rank -> percentile, drawn in the player Team Context band style.
function _ctxBarHtml(label, pct, sub, lowLbl = 'Low', highLbl = 'High') {
  const val = Math.round(pct);
  const col = scoreTierColor(val);
  const pVal = Math.max(2, Math.min(96, pct));
  return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
        <span style="font-size:15px;font-weight:700;color:#c8d2e0;white-space:nowrap;">${label}</span>
        <span style="font-size:20px;font-weight:900;color:${col};">${val}</span>
      </div>
      <div style="position:relative;height:10px;background:#1b2636;border-radius:5px;margin-bottom:4px;">
        <div style="position:absolute;left:0;top:0;height:100%;width:100%;background:linear-gradient(to right,#c7363c,#f0c56a,#3da65b);border-radius:5px;opacity:0.3;"></div>
        <div style="position:absolute;top:-3px;left:50%;width:2px;height:16px;background:#5e6678;transform:translateX(-50%);"></div>
        <div style="position:absolute;top:50%;left:${pVal}%;transform:translate(-50%,-50%);">
          <div style="width:16px;height:16px;border-radius:50%;background:${col};border:2.5px solid #07090f;"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#3a4458;white-space:nowrap;">
        <span>${lowLbl}</span><span>${sub}</span><span>${highLbl}</span>
      </div>
    </div>`;
}
export function teamContextHtml(tc, ageVal, agePct) {
  const cats = [['squadValue','Squad Cost'],['wageBill','Wage Bill*'],['odds','Betting Forecast']];
  const parts = [];
  cats.forEach(([k,label]) => {
    const m = tc[k];
    if (!m) return;
    const size = _n(m.size), rank = _n(m.rank);
    if (rank == null || size == null || size <= 1) return;
    const pct = _clamp(((size - rank) / (size - 1)) * 100);
    parts.push(_ctxBarHtml(label, pct, `Rank ${rank} of ${size}`));
  });
  if (agePct != null) {
    parts.push(_ctxBarHtml('Average Age', agePct, `Avg age ${ageVal}`, 'Young', 'Old'));
  } else if (ageVal !== '—') {
    parts.push(`<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:15px;font-weight:700;color:#c8d2e0;">Average Age</span><span style="font-size:20px;font-weight:900;color:#fff;">${ageVal}</span></div>`);
  }
  const n = parts.length;
  if (!n) return `<div style="font-size:13px;color:#5e6678;margin-bottom:8px;">No context entered.</div>`;
  // Fill the tile: 4 rows sit top-aligned with a fixed gap; fewer rows spread out to fill the height.
  const layout = n >= 4 ? 'justify-content:flex-start;gap:12px;' : 'justify-content:space-between;';
  return `<div style="flex:1;min-height:0;display:flex;flex-direction:column;${layout}">${parts.join('')}</div>`;
}

// ─── IMPACT radar — faithful replica of Team HQ Section 8 comparison radar ───
const _RADAR = [
  ['xG',           'Attack',     'xG',                  null, false],
  ['Goals',        'Attack',     'Goals Scored',        null, false],
  ['Touches Box',  'Attack',     'Touches in Box',      null, false],
  ['xGA',          'Defence',    'xG Against',          null, true],
  ['Goals vs',     'Defence',    'Goals Against',       null, true],
  ['PPDA',         'Defence',    'PPDA',                null, true],
  ['Possession',   'Possession', 'Possession',          null, false],
  ['Passes',       'Possession', 'Passes',              null, false],
  ['Pass F3rd',    'Possession', 'Passes to Final 3rd', null, false],
  ['Long Passes',  'Possession', 'Long Passes',         null, false],
  ['Pts',          null, null, (r) => (r && r.matches ? _n(r.points)/r.matches : null), false],
  ['xPts',         null, null, (r) => (r && r.matches ? _n(r.expectedPoints)/r.matches : null), false],
];
function _mg(row, group, name) {
  const g = row && row.metricGroups && row.metricGroups[group];
  if (!Array.isArray(g)) return null;
  const hit = g.find(e => e && e[0] === name);
  return hit ? _n(hit[2]) : null;
}
function _raw(row, spec) { return spec[3] ? spec[3](row) : _mg(row, spec[1], spec[2]); }
function _pct(pool, spec, v) {
  if (v == null) return 50;
  const vals = pool.map(r => _raw(r, spec)).filter(x => x != null && Number.isFinite(x));
  if (!vals.length) return 50;
  const p = (vals.filter(x => x <= v).length / vals.length) * 100;
  return _clamp(spec[4] ? 100 - p : p);
}
function _decile(pool, spec) {
  const vals = pool.map(r => _raw(r, spec)).filter(x => x != null && Number.isFinite(x)).sort((a,b)=>a-b);
  if (!vals.length) return null;
  const at = (q) => { const idx = (vals.length - 1) * q; const lo = Math.floor(idx), hi = Math.ceil(idx); return vals[lo] + (vals[hi]-vals[lo])*(idx-lo); };
  let ticks = Array.from({length: 11}, (_, i) => at(i/10));
  if (spec[4]) ticks = ticks.slice().reverse();
  return ticks;
}

export function impactRadarSvg(rowA, rowB, pool, labelA, labelB, subA, subB) {
  if (!rowA || !rowB) return `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b7a9f;font-size:14px;">Pick two seasons to compare</div>`;
  const leagues = new Set([String(rowA.league||''), String(rowB.league||'')]);
  const base = (Array.isArray(pool) && pool.length) ? pool : [rowA, rowB];
  const cp = base.filter(r => leagues.has(String(r.league||'')));
  const usePool = cp.length ? cp : base;

  const N = _RADAR.length;
  const A = _RADAR.map(s => _pct(usePool, s, _raw(rowA, s)));
  const B = _RADAR.map(s => _pct(usePool, s, _raw(rowB, s)));
  const seasonA = rowA && rowA.season ? String(rowA.season).replace(/^20/, '') : '';
  const seasonB = rowB && rowB.season ? String(rowB.season).replace(/^20/, '') : '';

  // square canvas so it scales to the tile — bigger radius, tighter margins
  const VB = 560, VH = 420, cx = 280, cy = 230, INNER = 10, OUTER = 100, R = 170, LABEL_R = 184;
  const rpx = (r) => (r / 100) * R;
  const ang = (i) => (-90 + (i * 360) / N) * Math.PI/180;
  const pt = (i, r) => [cx + rpx(r)*Math.cos(ang(i)), cy + rpx(r)*Math.sin(ang(i))];

  const BAND_OUT='#162235', BAND_IN='#0d1524', RING='#3a4050',
        LBL='#f5f5f5', HOLE=BG, COL_A='#C81E1E', COL_B='#1D4ED8',
        FILL_A='rgba(200,30,30,0.60)', FILL_B='rgba(29,78,216,0.60)';

  const edges = Array.from({length: 11}, (_, i) => INNER + i*(OUTER-INNER)/10);
  let bands = '';
  for (let i = 0; i < 10; i++) {
    const col = (9 - i) % 2 === 0 ? BAND_OUT : BAND_IN;
    const mid = rpx((edges[i+1]+edges[i])/2), wpx = rpx(edges[i+1]) - rpx(edges[i]);
    bands += `<circle cx="${cx}" cy="${cy}" r="${mid.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${wpx.toFixed(1)}"/>`;
  }
  let rings = '';
  edges.forEach((r, j) => {
    if (j === 0) return;
    const outer = j === edges.length - 1;
    rings += `<circle cx="${cx}" cy="${cy}" r="${rpx(r).toFixed(1)}" fill="none" stroke="${outer ? '#8b97ab' : RING}" stroke-width="${outer ? 1.2 : 1}" opacity="${outer ? 0.9 : 0.85}"/>`;
  });
  let spokes = '', labels = '';
  _RADAR.forEach((sp, i) => {
    const [ex, ey] = pt(i, OUTER);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${RING}" stroke-width="1" opacity="0.85"/>`;
    // Labels upright/horizontal, anchored outward so they clear the ring.
    const dx = Math.cos(ang(i)), dy = Math.sin(ang(i));
    const [lx, ly] = pt(i, LABEL_R / R * 100);
    const anchor = dx > 0.2 ? 'start' : dx < -0.2 ? 'end' : 'middle';
    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-family="Montserrat,sans-serif" font-size="14" font-weight="700" fill="${LBL}">${sp[0]}</text>`;
  });
  const hole = `<circle cx="${cx}" cy="${cy}" r="${rpx(INNER-0.6).toFixed(1)}" fill="${HOLE}"/>`;
  const poly = (arr) => arr.map((p,i) => pt(i, p).map(v=>v.toFixed(1)).join(',')).join(' ');
  const dots = (arr, col) => arr.map((p,i) => { const [x,y]=pt(i,p); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${col}"/>`; }).join('');

  return `<svg viewBox="0 0 ${VB} ${VH}" xmlns="http://www.w3.org/2000/svg" style="height:100%;width:auto;display:block;margin:0 auto;">
    ${bands}${rings}${spokes}${labels}${hole}
    <polygon points="${poly(A)}" fill="${FILL_A}" stroke="${COL_A}" stroke-width="2.2"/>
    <polygon points="${poly(B)}" fill="${FILL_B}" stroke="${COL_B}" stroke-width="2.2"/>
    ${dots(A, COL_A)}${dots(B, COL_B)}
    <g font-family="Montserrat,sans-serif">
      <text x="4" y="20"><tspan font-size="20" font-weight="800" fill="${COL_A}">${(labelA||'').slice(0,18)}</tspan>${seasonA ? ` <tspan font-size="13" font-weight="700" fill="${COL_A}" opacity="0.8">${seasonA}</tspan>` : ''}</text>
      <text x="4" y="40" font-size="13" font-weight="600" fill="${COL_A}">${(subA||'')}</text>
      <text x="${VB-4}" y="20" text-anchor="end"><tspan font-size="20" font-weight="800" fill="${COL_B}">${(labelB||'').slice(0,18)}</tspan>${seasonB ? ` <tspan font-size="13" font-weight="700" fill="${COL_B}" opacity="0.8">${seasonB}</tspan>` : ''}</text>
      <text x="${VB-4}" y="40" font-size="13" font-weight="600" fill="${COL_B}" text-anchor="end">${(subB||'')}</text>
    </g>
  </svg>`;
}

// ── scoring helpers ──
function _teamOverall(row) { return _n(row.completeScore ?? row.overall); }

// remap() — mirrors build_teams.py / build_players.py exactly. Converts a raw
// percentile (0-100) onto the displayed score scale (~52-96).
function _remapPct(s) {
  const bp = [0, 8, 18, 30, 44, 56, 70, 83, 95, 100];
  const tg = [52, 57, 62, 67, 71, 75, 80, 86, 92, 96];
  if (s <= bp[0]) return tg[0];
  if (s >= bp[bp.length - 1]) return tg[tg.length - 1];
  for (let i = 0; i < bp.length - 1; i++) {
    if (s <= bp[i + 1]) {
      const f = (s - bp[i]) / (bp[i + 1] - bp[i]);
      return tg[i] + f * (tg[i + 1] - tg[i]);
    }
  }
  return tg[tg.length - 1];
}

// The league-weighting factor actually applied to this row, derived empirically
// from the data we already have: completeScore is the league-weighted score and
// overall is the raw percentile, so their ratio is that league's effective scaler.
function _leagueScaleFactor(row) {
  const cs = _n(row.completeScore), ov = _n(row.overall);
  if (cs == null || ov == null) return null;
  const base = _remapPct(ov);
  if (!base) return null;
  return _clamp(cs / base, 0.5, 1.2);
}

// £ PERFORMANCE, on the SAME scale as the team score.
//
// This previously took a raw 0-100 uniform percentile and blended it straight
// into a score that lives on the remapped ~52-96 scale. An exactly-average
// manager therefore contributed 50 against a team score of ~70, dragging every
// coach toward the middle (and, since resourceEfficiencyRank isn't present in
// teams_final.json, it was CONSTANT 50 for everyone — a flat downward pull).
// Remapping the percentile and applying the league factor puts both halves of
// the blend on one scale, so "average resources, average results" now lands on
// the league average instead of 50.
function _costPerfScaled(row, perfPct) {
  if (perfPct == null) return null;              // no market-value data -> stay neutral
  const scaled = _remapPct(_clamp(perfPct));
  const f = _leagueScaleFactor(row);
  return f == null ? scaled : scaled * f;
}
function _ageBonus(age) { if (age == null) return 0; if (age < 35) return 10; if (age <= 45) return 5; if (age <= 50) return 2; return 0; }

function _rankIn(pool, row, field) {
  if (!Array.isArray(pool) || !pool.length || row == null) return null;
  var v = Number(row[field]); if (!isFinite(v)) return null;
  var peers = pool.filter(function(r){ return String(r.league) === String(row.league) && String(r.season) === String(row.season); });
  if (peers.length < 2) return null;
  var greater = peers.filter(function(r){ var x = Number(r[field]); return isFinite(x) && x > v; }).length;
  return { rank: greater + 1, size: peers.length };
}

// Score / Potential — extracted so TeamReport can show the same manager number
// without re-implementing (and drifting from) the calibration.
//
// Per season: 75% team quality + 25% £ performance (both on the same scale).
// Where no market-value data exists for a season, the team score stands alone
// rather than being dragged toward a neutral 50.
export function computeCoachScore(tenureRows, age, overrides = {}) {
  const sortedDesc = [...(tenureRows || [])].sort((a, b) => (a.season < b.season ? 1 : -1));
  const perfMap = overrides.seasonPerf || {};
  const perSeason = sortedDesc.map(r => {
    const ov = _teamOverall(r); if (ov == null) return null;
    const pKey = `${r.season}||${r.league}||${r.team}`;
    const perf = _costPerfScaled(r, perfMap[pKey] == null ? null : _n(perfMap[pKey]));
    const sc = perf == null ? _clamp(ov) : _clamp(0.75*ov + 0.25*perf);
    return { season: r.season, ov, sc };
  }).filter(Boolean);

  let score = null;
  if (perSeason.length) {
    // Exponential (EWMA-style) recency weighting: the most recent season carries
    // weight 1 and each season further back is discounted by DECAY. This is the
    // standard way to weight a time series toward recent form — it decays smoothly
    // regardless of how many seasons a coach has, where the previous linear ramp
    // (n, n-1, ... 1) flattened out as tenure grew.
    const DECAY = 0.6;
    let ws = 0, acc = 0;
    perSeason.forEach((s, k) => { const w = Math.pow(DECAY, k); ws += w; acc += w*s.sc; });
    score = _clamp(acc/ws);
  }
  const potential = score == null ? null : _clamp(score + _ageBonus(age));
  return { score, potential, perSeason };
}

export function buildCoachQuickCardElement(coach, tenureRows, traits, overrides = {}) {
  const age = computeAge(coach.dob);
  const sortedDesc = [...tenureRows].sort((a, b) => (a.season < b.season ? 1 : -1));
  const latest = sortedDesc[0] || {};
  const natIso2 = countryToIso2(coach.nationality || '');
  const leagueIso2 = countryToIso2(leagueToCountry(latest.league || ''));

  const { score, potential, perSeason } = computeCoachScore(tenureRows, age, overrides);
  const showPills = overrides.showScorePills !== false;

  // Style hexagons (career-avg traits)
  const getTrait = (key) => (coach.traitOverrides && coach.traitOverrides[key] != null ? coach.traitOverrides[key]*10 : (traits ? traits[key] : null));
  const styleRows = [
    ['Possession', getTrait('possession')], ['Pressing', getTrait('pressing')],
    ['Attacking', getTrait('attacking')], ['Defensive', getTrait('defensive')],
    ['Long Ball', getTrait('directness')], ['Passing', getTrait('passing')],
  ].map(([l, v]) => [l, v == null ? 0 : v]).sort((a, b) => b[1] - a[1]);

  // Career line points (oldest -> newest)
  const careerMode = overrides.careerMode === 'finish' ? 'finish' : 'score';
  // Match each scored season back to its tenure row so league finish can be ranked
  // against that division's peers in `_pool` (falls back to a stored pointsRank).
  const _careerPool = (overrides.allTeams && overrides.allTeams.length) ? overrides.allTeams : tenureRows;
  const finishOv = overrides.finishOverrides || {};
  const careerPts = [...perSeason].reverse().map(s => {
    const row = tenureRows.find(r => String(r.season) === String(s.season)) || null;
    const finish = row
      ? (_rankIn(_careerPool, row, 'points')
         || (row.pointsRank != null && row.leagueSize != null ? { rank: row.pointsRank, size: row.leagueSize } : null))
      : null;
    const ov = finishOv[String(s.season)];
    const manual = ov && ov.rank && ov.size
      ? { rank: Number(ov.rank), size: Number(ov.size) }
      : null;
    return { season: s.season, sc: s.sc, finish: manual || finish };
  });
  // Seasons the data doesn't cover at all. They carry no score, so they only join
  // the series in finish mode — appending them in score mode would plot a null.
  if (careerMode === 'finish' && Array.isArray(overrides.extraFinish)) {
    for (const e of overrides.extraFinish) {
      if (!e || !e.season || !e.rank || !e.size) continue;
      if (careerPts.some(p => String(p.season) === String(e.season))) continue;
      careerPts.push({ season: e.season, sc: null,
                       finish: { rank: Number(e.rank), size: Number(e.size) } });
    }
    careerPts.sort((a, b) => (String(a.season) < String(b.season) ? -1 : 1));
  }

  // LEFT percentile bars — RECENT season only (matches the header's latest team,
  // rather than blending every tenure season).
  // Percentiles, the stat row and Team Context all describe ONE season. Default is
  // the most recent (unchanged); overrides.statsSeasonKey picks another tenure.
  const statsRow = resolveStatsRow(sortedDesc, tenureRows, overrides.statsSeasonKey);
  const statsSeasonPicked = !!overrides.statsSeasonKey
    && statsRow && (statsRow.team + '|' + statsRow.season) === overrides.statsSeasonKey
    && statsRow !== sortedDesc[0];
  const _mgRows = [statsRow];
  const mg = computeCoachMetricGroups(_mgRows) || { Attack: [], Defence: [], Possession: [] };
  const totalRows = mg.Attack.length + mg.Defence.length + mg.Possession.length;
  const activeSections = ['Attack','Defence','Possession'].filter(k => mg[k] && mg[k].length > 0).length;
  const CHART_HEIGHT = 671, LEFT_TOP = 296;
  const SECTION_TITLE_H = 48;
  const FIXED_OVERHEAD = 193 - (3 - activeSections) * SECTION_TITLE_H;
  const rowH = totalRows > 0 ? Math.max(8, Math.min(55, Math.floor((CHART_HEIGHT - FIXED_OVERHEAD) / totalRows) - 1)) : 55;
  const leftoverSlack = Math.max(0, (1080 - LEFT_TOP) - CHART_HEIGHT);
  const totalSlots = totalRows + 4;
  const EXTRA_GAP = Math.round(totalSlots > 0 ? leftoverSlack / totalSlots : 0);
  const barsHtml = (rows) => rows.map(r => barRow(r.label, r.pct, r.val, rowH, EXTRA_GAP)).join('');

  // Impact radar rows
  const rowA = overrides.impactRowA || sortedDesc[sortedDesc.length - 1];
  const rowB = overrides.impactRowB || sortedDesc[0];
  const radarPool = (overrides.allTeams && overrides.allTeams.length) ? overrides.allTeams : tenureRows;
  const labelA = overrides.impactLabelA || (rowA ? String(rowA.team||'') : '');
  const labelB = overrides.impactLabelB || (rowB ? String(rowB.team||'') : '');
  const subA = rowA ? String(rowA.league||'') : '';
  const subB = rowB ? String(rowB.league||'') : '';

  // header + info
  const formation = overrides.formation || (Array.isArray(coach.formations) ? coach.formations[0] : coach.formation) || '—';
  const infoRows = [['Formation:', formation], ['Contract:', coach.contract || '—'], ['Clubs:', coach.clubs ?? '—'], ['Agent:', overrides.agent || coach.agent || '—']];
  const stat = (v) => (v == null ? '—' : String(v));
  const ppg = statsRow.points != null && statsRow.matches ? (statsRow.points/statsRow.matches).toFixed(2) : '—';
  const _pool = (overrides.allTeams && overrides.allTeams.length) ? overrides.allTeams : tenureRows;
  const _ptsR = _rankIn(_pool, statsRow, 'points') || (statsRow.pointsRank != null && statsRow.leagueSize != null ? { rank: statsRow.pointsRank, size: statsRow.leagueSize } : null);
  const _xptsR = _rankIn(_pool, statsRow, 'expectedPoints');
  const _rankStr = (r) => r ? `${r.rank}<span style="color:#5b6577;font-weight:600;">/${r.size}</span>` : '—';
  const statRow = [
    ['Games', stat(statsRow.matches)], ['GF', stat(statsRow.goalsFor)], ['GA', stat(statsRow.goalsAgainst)],
    ['Pts', _rankStr(_ptsR)],
    ['xPts', _rankStr(_xptsR)],
    ['PPG', ppg],
  ];
  const tc = overrides.teamContext || {};
  // Average-age percentile vs the latest squad's league+season (younger = higher).
  const _lv = _n(latest.avgAge);
  let ageVal = '—', agePct = null;
  if (_lv != null) {
    ageVal = _lv.toFixed(1);
    const agePool = (radarPool || []).filter(r => String(r.league) === String(latest.league) && String(r.season) === String(latest.season));
    const ageVals = agePool.map(r => _n(r.avgAge)).filter(x => x != null && Number.isFinite(x));
    if (ageVals.length > 1) {
      // older = higher: percentile of THIS squad's age within its league+season (no inversion)
      const raw = (ageVals.filter(x => x <= _lv).length / ageVals.length) * 100;
      agePct = _clamp(raw);
    }
  } else if (tc.age != null && tc.age !== '') {
    ageVal = String(tc.age);
  }

  // GBE (manager) — no points. Pass = either route selected, OR autopass.
  // Autopass: managing in an England league, or nationality is a home nation.
  const HOME_NATIONS = new Set(['England','Scotland','Wales','Northern Ireland','Ireland','Republic of Ireland']);
  const englandLeague = /^England/i.test(String(latest.league || ''));
  const homeNation    = HOME_NATIONS.has(String(coach.nationality || '').trim());
  const autopass      = englandLeague || homeNation;
  const _gbe   = overrides.gbe || {};
  const gbeC36 = !!_gbe.c36;                 // 36-months cumulative, Band 1-5
  const gbeC24 = !!_gbe.c24;                 // 24-months consecutive, Band 1-5
  const gbePass   = autopass || gbeC36 || gbeC24;
  const gbeStatus = gbePass ? 'PASS' : 'FAIL';
  const gbeExceptions     = !!_gbe.exceptions && !gbePass;
  const gbeExceptionsText = String(_gbe.exceptionsText || '').trim();
  const gbeShowPanel = gbeExceptions && gbeExceptionsText;
  // FAIL badge turns orange when an Exceptions Panel note is in play (like the player card's panel state).
  const gbeCol = gbePass ? '#3da65b' : gbeShowPanel ? '#f0a637' : '#c7363c';
  // Centre the GBE tile a little lower when there's no Exceptions Panel note; keep it up top when there is.
  const gbeTop = gbeShowPanel ? 24 : 52;

  // panel geometry (match player)
  const STYLE_PANEL_W = 448, CAREER_PANEL_W = 448, STYLE_TOP = 310;
  const STYLE_HEADER_H = 40, hexH = styleRows.length*46 + 8;
  const ROW1_PANEL_H = PANEL_PAD*2 + STYLE_HEADER_H + hexH;
  const ROW2_TOP = STYLE_TOP + ROW1_PANEL_H + 14;            // tighter gap -> row 2 sits higher
  const ROW2_PANEL_H = PANEL_PAD*2 + STYLE_HEADER_H + 5*52 + 28; // taller tiles (bottom stays within 1080)

  const styleHtml = styleHexSvg(styleRows, STYLE_PANEL_W - PANEL_PAD*2);
  const careerHtml = careerChartSvg(careerPts, CAREER_PANEL_W - PANEL_PAD*2, hexH, careerMode);
  const _radarInnerH = ROW2_PANEL_H - PANEL_PAD * 2 - 40;
  const radarHtml = `<div style="height:${_radarInnerH}px;display:flex;align-items:center;justify-content:center;">${impactRadarSvg(rowA, rowB, radarPool, labelA, labelB, subA, subB)}</div>`;

  // Optional Biography — when set, it replaces the Impact tile (same slot), matching
  // the player quick card's biography behaviour (350-char cap, no scout-status here).
  const bioText = overrides.biography ? String(overrides.biography).slice(0, 315) : '';

  const pill = (v) => { if (v == null) return ''; const c = pillColor(v); return `<span style="display:inline-flex;align-items:center;justify-content:center;line-height:1;min-width:18px;font-size:19px;font-weight:800;padding:7px 13px;border-radius:7px;background:${c.bg};color:${c.fg};">${Math.round(v)}</span>`; };

  const headerBgL = coach.clubColor ? fadeHexToBG(coach.clubColor, 0.62) : HEADER_L;
  const headerBgR = coach.clubColor ? fadeHexToBG(coach.clubColor, 0.93) : HEADER_R;

  const rawId = coach.fotmobId || '';
  const fmId = typeof rawId === 'string' && rawId.includes('fotmob.com') ? (rawId.match(/\/(\d+)\.png/) || [])[1] || null : (rawId || null);
  const photo = fmId ? `${FOTMOB_PHOTO_BASE}${fmId}.png` : (coach.photoDataUrl || coach.photoUrl || '/fallback.png');

  const infoBox = infoRows.map(([k, v], i) =>
    `<div style="position:absolute;left:1208px;top:${50 + i*48}px;font-size:18px;font-weight:500;color:#9aa3b8;white-space:nowrap;">${k}</div>
     <div style="position:absolute;left:1353px;top:${50 + i*48}px;font-size:18px;font-weight:600;color:#fff;white-space:nowrap;">${String(v).slice(0,20)}</div>`
  ).join('');

  const tenure = overrides.tenure || coach.tenure || '';
  const unattached = !!overrides.unattached;

  // Unattached: no single current club, so the 740-1180px header slot lists the
  // clubs managed, newest first — (crest) Crawley 24-25 L2. Six rows is what fits
  // in the 210px the big crest used to occupy without shrinking the type.
  const HIST_MAX = 6;
  const histRows = unattached ? tenureHistory(tenureRows, HIST_MAX) : [];
  const HIST_ROW_H = 34;
  const histBlockHtml = !unattached ? '' : `
      <div style="position:absolute;left:740px;top:${Math.max(24, 132 - (histRows.length * HIST_ROW_H) / 2)}px;width:440px;">
        ${histRows.map(r => `
          <div style="display:flex;align-items:center;gap:14px;height:${HIST_ROW_H}px;">
            ${teamCrestUrl(r.team)
              ? `<div style="width:28px;height:28px;flex-shrink:0;background-size:contain;background-repeat:no-repeat;background-position:center;background-image:url('${teamCrestUrl(r.team)}');"></div>`
              : `<div style="width:28px;height:28px;flex-shrink:0;"></div>`}
            <span style="font-size:22px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px;">${r.team || ''}</span>
            <span style="font-size:19px;font-weight:500;color:#c4cbd9;white-space:nowrap;">${shortSeason(r.season)}</span>
            <span style="font-size:18px;font-weight:600;color:#9aa3b8;white-space:nowrap;">${abbrevLeague(r.league)}</span>
          </div>`).join('')}
      </div>`;

  // Footnote naming which season the left-hand percentiles and stat row describe,
  // shown only when it is not simply the most recent tenure.
  const statsNoteHtml = !statsSeasonPicked ? '' : `
      <div style="position:absolute;left:24px;bottom:10px;font-size:16px;font-weight:600;color:#9aa3b8;white-space:nowrap;">*${statsRow.team || ''} ${shortSeason(statsRow.season)}</div>`;

  const container = document.createElement('div');
  container.style.cssText = `width:1920px;height:1080px;background:${BG};font-family:'Montserrat',sans-serif;color:#fff;position:relative;overflow:hidden;box-sizing:border-box;`;
  container.innerHTML = `
    <div id="qc-card-root" style="width:1920px;height:1080px;overflow:hidden;background:${BG};font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      <div style="position:absolute;top:0;left:0;width:1920px;height:292px;background:linear-gradient(to right, ${headerBgL} 0%, ${headerBgR} 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"></div>

      <div id="cqc-photo" style="position:absolute;left:-12px;top:16px;width:261px;height:261px;background-color:transparent;background-image:url('${photo}');background-size:cover;background-position:center top;border-radius:0 14px 14px 0;"></div>

      <div style="position:absolute;left:248px;top:24px;width:560px;font-size:53.2px;font-weight:700;line-height:1.05;letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${overrides.nameOverride || coach.name || ''}</div>
      <div style="position:absolute;left:248px;top:90px;font-size:26.6px;font-weight:600;color:#fff;">Manager${unattached ? ` <span style="color:#9aa3b8;font-weight:600;">(Unattached)</span>` : ''}</div>
      <div style="position:absolute;left:248px;top:148px;display:flex;align-items:center;gap:10px;">
        ${natIso2 ? `<div style="width:36px;height:22px;flex-shrink:0;background-size:cover;background-position:center;background-image:url('https://flagcdn.com/w80/${natIso2}.png');border-radius:2px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);"></div>` : ''}
        <span style="font-size:26.6px;font-weight:600;color:#fff;white-space:nowrap;">${age != null ? age + ' years old' : ''}</span>
        ${showPills ? pill(score) : ''}
        ${showPills ? pill(potential) : ''}
      </div>

      <div style="position:absolute;left:248px;top:227px;display:flex;align-items:baseline;gap:32px;">
        ${statRow.map(([lab, val]) => `<div style="display:flex;align-items:baseline;gap:6px;"><span style="font-size:27.9px;font-weight:700;color:#fff;">${val}</span><span style="font-size:16px;font-weight:500;color:#9aa3b8;text-transform:uppercase;letter-spacing:.04em;">${lab}</span></div>`).join('')}
      </div>

      ${unattached ? histBlockHtml : `
      ${teamCrestUrl(latest.team) ? `<div style="position:absolute;left:740px;top:22px;width:155px;height:210px;background-size:contain;background-repeat:no-repeat;background-position:center;background-image:url('${teamCrestUrl(latest.team)}');filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));"></div>` : ''}
      <div style="position:absolute;left:915px;top:90px;width:266px;font-size:32px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${overrides.teamOverride || latest.team || ''}</div>
      <div style="position:absolute;left:915px;top:140px;display:flex;align-items:center;">
        <span style="font-size:21px;font-weight:500;color:#fff;white-space:nowrap;">${latest.league || ''}</span>
        ${leagueIso2 ? `<div style="width:32px;height:20px;flex-shrink:0;margin-left:24px;background-size:cover;background-position:center;background-image:url('https://flagcdn.com/w80/${leagueIso2}.png');border-radius:2px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);"></div>` : ''}
      </div>
      ${tenure ? `<div style="position:absolute;left:915px;top:178px;font-size:20px;font-weight:500;color:#9aa3b8;white-space:nowrap;">${tenure}</div>` : ''}`}

      <div style="position:absolute;left:1188px;top:36px;width:2px;height:210px;background:rgba(255,255,255,0.14);"></div>
      ${infoBox}

      <div style="position:absolute;top:${gbeTop}px;left:1510px;width:390px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:20px 24px;box-sizing:border-box;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <span style="font-size:15px;font-weight:700;color:#9aa3b8;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">GBE Calculation</span>
          <span style="font-size:16px;font-weight:800;color:${gbeCol};background:${gbeCol}22;border:1px solid ${gbeCol};border-radius:6px;padding:5px 14px;white-space:nowrap;">${gbeStatus}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${gbeCriteriaRow('36 Months Cumulative', 'Band 1-5 League', gbeC36)}
          ${gbeCriteriaRow('24 Months Consecutive', 'Band 1-5 League', gbeC24)}
        </div>
        ${autopass ? `<div style="margin-top:14px;font-size:12px;font-weight:600;color:#3da65b;border-top:1px solid rgba(61,166,91,0.2);padding-top:10px;">✓ Auto Pass — ${englandLeague ? 'English League' : 'Home Nation'}</div>` : ''}
        ${gbeShowPanel ? `<div style="margin-top:14px;font-size:12px;font-weight:600;color:#f97316;border-top:1px solid rgba(249,115,22,0.2);padding-top:10px;line-height:1.4;">⚡ Exceptions Panel — ${gbeExceptionsText}</div>` : ''}
      </div>

      <div style="position:absolute;top:${LEFT_TOP}px;left:0px;width:920px;height:${1080-LEFT_TOP}px;overflow:hidden;box-sizing:border-box;padding-left:24px;padding-top:12px;">
        ${mg.Attack.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:${EXTRA_GAP}px 0 6px;">Attacking</div>${barsHtml(mg.Attack)}` : ''}
        ${mg.Defence.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:${8+EXTRA_GAP}px 0 6px;">Defensive</div>${barsHtml(mg.Defence)}` : ''}
        ${mg.Possession.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:${8+EXTRA_GAP}px 0 6px;">Possession</div>${barsHtml(mg.Possession)}` : ''}
        <div style="display:flex;align-items:center;margin-top:${6+EXTRA_GAP}px;">
          <div style="width:188px;flex-shrink:0;"></div>
          <div style="flex:1;position:relative;height:26px;">
            ${[0,10,20,30,40,50,60,70,80,90,100].map(p => `<span style="position:absolute;left:${p}%;top:0;transform:translateX(${p===0?'0':p===100?'-100%':'-50%'});font-size:12px;font-weight:600;color:#c4cbd9;">${p}%</span>`).join('')}
            <span style="position:absolute;left:50%;top:14px;transform:translateX(-50%);font-size:9px;font-weight:600;color:#5e6678;text-transform:uppercase;letter-spacing:.05em;">Avg</span>
          </div>
        </div>
        <div style="display:flex;"><div style="width:188px;flex-shrink:0;"></div><div style="flex:1;text-align:center;font-size:14px;font-weight:700;color:${LABEL_COL};padding-top:6px;">Percentile Rank</div></div>
      </div>

      ${statsNoteHtml}
      <div style="position:absolute;left:944px;top:${LEFT_TOP}px;width:2px;height:${1080-LEFT_TOP}px;background:rgba(255,255,255,0.14);"></div>

      <div style="position:absolute;top:${STYLE_TOP}px;left:984px;width:${STYLE_PANEL_W}px;height:${ROW1_PANEL_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PANEL_PAD}px;box-sizing:border-box;overflow:hidden;box-shadow:${PANEL_SHADOW};">
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:14px;">Style</div>
        ${styleHtml}
      </div>

      <div style="position:absolute;top:${STYLE_TOP}px;left:${984 + STYLE_PANEL_W + PANEL_GAP_H}px;width:${CAREER_PANEL_W}px;height:${ROW1_PANEL_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PANEL_PAD}px;box-sizing:border-box;overflow:hidden;box-shadow:${PANEL_SHADOW};">
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:14px;">Career</div>
        ${careerHtml}
      </div>

      <div style="position:absolute;top:${ROW2_TOP}px;left:984px;width:${STYLE_PANEL_W}px;height:${ROW2_PANEL_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PANEL_PAD}px;box-sizing:border-box;overflow:hidden;box-shadow:${PANEL_SHADOW};display:flex;flex-direction:column;">
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:14px;">Team Context</div>
        ${teamContextHtml(tc, ageVal, agePct)}
      </div>

      <div style="position:absolute;top:${ROW2_TOP}px;left:${984 + STYLE_PANEL_W + PANEL_GAP_H}px;width:${CAREER_PANEL_W}px;height:${ROW2_PANEL_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PANEL_PAD}px;box-sizing:border-box;overflow:hidden;box-shadow:${PANEL_SHADOW};">
        ${bioText ? `
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:14px;">Biography</div>
        <div style="font-size:20px;line-height:1.5;font-weight:600;color:#fff;">${bioText}</div>
        ` : `
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:18px;">Impact</div>
        ${radarHtml}
        `}
      </div>

    </div>`;
  return container;
}

export async function downloadCoachQuickCardPNG(coach, tenureRows, traits, overrides = {}) {
  await ensureMontserratEmbedded();
  const el = buildCoachQuickCardElement(coach, tenureRows, traits, overrides);
  document.body.appendChild(el);

  const photoDiv = el.querySelector('#cqc-photo');
  if (photoDiv) {
    const rawId = coach.fotmobId || '';
    const fmId = typeof rawId === 'string' && rawId.includes('fotmob.com') ? (rawId.match(/\/(\d+)\.png/) || [])[1] || null : (rawId || null);
    const pUrl = fmId ? `${FOTMOB_PHOTO_BASE}${fmId}.png` : (coach.photoDataUrl || coach.photoUrl || null);
    if (pUrl) {
      try {
        const resp = await fetch(pUrl);
        if (!resp.ok) throw new Error('fetch failed');
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
        photoDiv.style.backgroundImage = `url('${dataUrl}')`;
      } catch (_e) { photoDiv.style.backgroundImage = "url('/fallback.png')"; }
    }
  }

  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(el, { width: 1920, height: 1080, pixelRatio: 1, fontEmbedCSS: MONTSERRAT_EMBED_CSS });
    await deliverPng(dataUrl, `${(overrides.nameOverride || coach.name || 'coach').replace(/\s+/g, '_')}_quickcard.png`);
  } finally {
    document.body.removeChild(el);
  }
}
