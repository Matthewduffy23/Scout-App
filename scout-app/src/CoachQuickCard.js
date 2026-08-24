// CoachQuickCard.js — standalone manager quick card
// v3: two slots on this card can now be swapped, and both default to what they
// always drew, so an existing quick card exports unchanged.
//   - the top-right GBE Calculation tile can hold the FORMATION PITCH instead.
//     The pitch renderer moved here from ManagerPager (which imports it back) so
//     there is one pitch, not two: the pager could not be imported from here
//     without a cycle. The tile holds the pitch and nothing else — a label and a
//     shape badge both repeated what the info column's "Formation:" row already
//     says. The pitch scales to fit whichever ceiling binds first (the tile's
//     width, or the gap above the Career panel) and the tile is then sized to the
//     pitch, so the padding is even on all four sides by construction.
//   - the Team Context tile can hold VIEW, using the pager's own View body, which
//     moved here for the same reason.
//   - EITHER body tile holds any of Team Context / View / Impact / League Table, from
//     one shared list, the way the Team Report's bottom row already works. The table
//     is TeamReport's own renderer imported straight in — same columns, same row
//     chrome, same highlight on the subject's row. That import closes a cycle; see
//     the note on it. Defaults are Team Context left, Impact right, unchanged.
//   - Team Context draws the league-finish caret the pager has always drawn. The
//     quick card called teamContextHtml without it, so its bars showed a rank line
//     and no league position. Age is excluded: its marker is the age figure itself.
// A manual birth date also prints beside the age, in the coach card's format, and
// drives the age itself.
//
// v2: computeCoachScore() extracted and exported (used by TeamReport) — the
// build function now calls it, so there remains exactly one implementation., formatted to match the
// player QuickCard EXACTLY (tile chrome, Style hexagons, Career line chart,
// Team Context bands) with the Team HQ "⚡ Team Comparison Radar" as the
// bottom-right Impact tile. Independent of CoachCard.js apart from a few
// functional helpers imported below.
import { computeCoachMetricGroups } from './coachMetrics';
import { deliverPng } from './utils';
// TeamReport owns the league table — same columns, same row chrome, same highlight of
// the subject's row — so the quick card imports it rather than drawing a second one.
// This closes a cycle (TeamReport imports computeCoachScore from here), which is safe
// because every binding crossing it is an `export function` declaration: those are
// hoisted and defined before either module body runs, and neither side touches the
// other at module-init time — only inside functions called later. Do not turn either
// of them into a `const` arrow without breaking the cycle first.
import { leagueTablePanelHtml, preloadImages, setSharedImageMap,
         cardImageUrls } from './TeamReport';
import {
  computeAge, formatDOB, countryToIso2, leagueToCountry, teamCrestUrl, fadeHexToBG,
  FOTMOB_PHOTO_BASE, ensureMontserratEmbedded, MONTSERRAT_EMBED_CSS, COACH_FORMATIONS,
  abbrevLeague, shortSeason, tenureHistory, resolveStatsRow } from './CoachCard';

// The two body tiles each hold any of these, the way the Team Report's bottom row
// and the pager's six slots already work. Ids are the ones the overrides already
// used, so a saved quick-card input keeps meaning what it meant.
export const CQC_BODY_PANELS = [
  ['context', 'Team Context'], ['view', 'View'],
  ['impact', 'Impact'], ['table', 'League Table'],
];
export const CQC_BODY_DEFAULTS = { leftMid: 'context', rightMid: 'impact' };
const cqcBodyPanel = (v, slot) =>
  CQC_BODY_PANELS.some(([id]) => id === v) ? v : CQC_BODY_DEFAULTS[slot];

// Header nudges. A wide or oddly-shaped badge can crowd the club name, and the two
// blocks need to move independently. Emitted only when non-zero: at 0 the style
// string is exactly what it was before these existed.
const _hdrNudge = (px) => {
  const n = Number(px);
  return Number.isFinite(n) && n !== 0 ? `transform:translateX(${n}px);` : '';
};

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

// ─── Shared with ManagerPager ──────────────────────────────────────────────
// Both cards draw these, and the pager imports them from here rather than the
// other way round, which would be a cycle. Same rule the career chart, the team
// context bands and the impact radar above already follow.
const _esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Formation dot tiers — the SAME two greens the position pitch uses for a
// player's primary and secondary slot, so a dot on this card means the same
// thing it means on his.
export const FM_PRIMARY = '#00bf63';
export const FM_SECONDARY = '#7ed957';
// Over a zones wash the greens disappear into the zones themselves, so the
// shape switches to white. It is still the only solid mark on the pitch, which
// is what makes it read as the shape rather than as more data.
export const FM_ON_IMAGE = '#ffffff';

// ─── Formation pitch ───────────────────────────────────────────────────────
// The player pager's pitch chrome, verbatim — same 320x208 viewBox, same two
// line weights, same clip and shadow, so the two cards draw the same pitch. Only
// what sits ON it changes: eleven formation dots instead of labelled position
// discs, and a zones-of-control wash instead of a heatmap.
//
// CoachCard's FORMATIONS coordinates live in a 330x220 space with the keeper at
// the left edge. That maps onto this pitch's playing area (x 4..316, y 4..204)
// with no distortion, and the two systems already agree — its keeper at [25,110]
// lands on 27.6, 104 against the position pitch's GK slot at [26,104].
//
// ONE SHAPE BY DEFAULT. Drawing the secondary formation as well put 22 marks on
// a 188px pitch, and at that density neither shape is legible — you read a
// scatter of dots rather than a back four. The secondary is NAMED in the text
// column, which is where it belongs, and can be drawn as rings on request for
// the cases where the contrast between the two is the actual point.
const FM_VB = [320, 208];
const fmX = (x) => 4 + (Number(x) / 330) * 312;
const fmY = (y) => 4 + (Number(y) / 220) * 200;

export function formationPitchSvg(primary, secondary, w, h, mapUrl, mapOpacity, showDots, showSecondary) {
  const LINE = 'rgba(255,255,255,0.46)';
  const LINE_SOFT = 'rgba(255,255,255,0.30)';
  const dotCol = mapUrl ? FM_ON_IMAGE : FM_PRIMARY;

  const coordsFor = (fm) => (fm && COACH_FORMATIONS[fm]) || null;
  const primaryPts = showDots ? coordsFor(primary) : null;
  const secondaryPts = (showDots && showSecondary) ? coordsFor(secondary) : null;

  // Mowing bands. Six stripes at a whisker of white — barely visible on their
  // own, but they give the surface a direction, and direction is the one thing a
  // formation diagram needs the reader to have (this side attacks right). They
  // come off under a zones wash, where they'd fight the data for the same pixels.
  const stripes = mapUrl ? '' : Array.from({ length: 6 }, (_, i) => {
    if (i % 2) return '';
    return `<rect x="${(4 + i * 52).toFixed(1)}" y="4" width="52" height="200"
                  fill="rgba(255,255,255,0.022)"/>`;
  }).join('');

  // Goals, drawn OUTSIDE the touchline. The pitch previously ended at its own
  // boundary, which reads as a rectangle; a net at each end reads as a pitch.
  const goals = `
      <g fill="none" stroke="${LINE_SOFT}" stroke-width="1.3">
        <rect x="0" y="90" width="4" height="28"/>
        <rect x="316" y="90" width="4" height="28"/>
      </g>`;

  // Secondary FIRST so a shared position doesn't punch a ring through the solid
  // dot on the same spot — the primary shape always reads on top.
  const secondaryDots = (secondaryPts || []).map(([x, y]) => `
      <circle cx="${fmX(x).toFixed(1)}" cy="${fmY(y).toFixed(1)}" r="7.5"
              fill="none" stroke="${mapUrl ? 'rgba(255,255,255,0.65)' : FM_SECONDARY}"
              stroke-width="2.2"/>`).join('');
  // Two circles per player, not one. The wider disc underneath is the same
  // colour at a tenth opacity, which separates the shape from whatever is behind
  // it — turf, stripe or zone — without drawing a hard ring around every man.
  const primaryDots = (primaryPts || []).map(([x, y]) => {
    const cx = fmX(x).toFixed(1), cy = fmY(y).toFixed(1);
    return `
      <circle cx="${cx}" cy="${cy}" r="13" fill="${dotCol}" opacity="0.14"/>
      <circle cx="${cx}" cy="${cy}" r="7.6" fill="${dotCol}" filter="url(#mpShadow)"/>`;
  }).join('');

  // The wash sits under the markings, clipped to the pitch. Over the top is what
  // a screenshot does; underneath is what a design does.
  const mapLayer = mapUrl ? `
      <image href="${mapUrl}" x="4" y="4" width="312" height="200"
             preserveAspectRatio="none" opacity="${mapOpacity}" clip-path="url(#mpClip)"/>` : '';

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${FM_VB[0]} ${FM_VB[1]}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="mpClip"><rect x="4" y="4" width="312" height="200" rx="8"/></clipPath>
        <filter id="mpShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#000" flood-opacity="0.55"/>
        </filter>
        <linearGradient id="mpTurf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.085)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.022)"/>
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="312" height="200" rx="8" fill="url(#mpTurf)"/>
      <g clip-path="url(#mpClip)">${stripes}</g>
      ${mapLayer}
      ${goals}

      <g fill="none" stroke="${LINE}" stroke-width="1.6">
        <rect x="4" y="4" width="312" height="200" rx="8"/>
        <line x1="160" y1="4" x2="160" y2="204"/>
      </g>
      <g fill="none" stroke="${LINE_SOFT}" stroke-width="1.4">
        <circle cx="160" cy="104" r="31"/>
        <rect x="4" y="49" width="54" height="110"/>
        <rect x="262" y="49" width="54" height="110"/>
        <rect x="4" y="79" width="20" height="50"/>
        <rect x="296" y="79" width="20" height="50"/>
        <path d="M 58 87 A 22 22 0 0 1 58 121"/>
        <path d="M 262 87 A 22 22 0 0 0 262 121"/>
        <path d="M 4 14 A 10 10 0 0 0 14 4"/>
        <path d="M 306 4 A 10 10 0 0 0 316 14"/>
        <path d="M 4 194 A 10 10 0 0 1 14 204"/>
        <path d="M 316 194 A 10 10 0 0 0 306 204"/>
      </g>
      <g fill="${LINE_SOFT}">
        <circle cx="160" cy="104" r="2.4"/>
        <circle cx="40" cy="104" r="2.2"/>
        <circle cx="280" cy="104" r="2.2"/>
      </g>
      ${secondaryDots}${primaryDots}
    </svg>`;
}

// ─── View ──────────────────────────────────────────────────────────────────
// The pager's View body, moved here so the quick card can show the SAME panel.
// The type is sized to the copy so no
// length overflows, and it picks the LARGEST size that still fits so short copy
// fills the box as completely as long copy does.
export function viewPanelBody(w, h, text) {
  if (!text || !String(text).trim()) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;color:#3d4a5e;font-size:13px;">No view written.</div>`;
  }
  const n = String(text).length;
  let fs = 13;
  for (const cand of [18, 17, 16, 15, 14, 13]) {
    const perLine = Math.max(1, Math.floor(w / (cand * 0.47)));
    if (Math.ceil(n / perLine) * (cand * 1.45) <= h - 2) { fs = cand; break; }
  }
  return `<div style="position:absolute;inset:0;font-size:${fs}px;line-height:1.45;
            font-weight:500;color:#e2e8f4;overflow:hidden;">${_esc(text)}</div>`;
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
function _ctxBarHtml(label, pct, sub, lowLbl = 'Low', highLbl = 'High', markPct = null) {
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
        ${markPct == null ? '' : (() => {
          // Where they FINISHED, against how they were resourced. A bare white bar
          // read as a second midline and got lost against the 50% tick two pixels
          // from it; a caret above the track points AT the position and can't be
          // mistaken for part of the scale. The stem sits inside the bar and stops
          // short of the dot, so a finish that lands on the resource dot doesn't
          // bisect it.
          const mx = _clamp(markPct, 1.5, 98.5);
          return `
        <div style="position:absolute;top:-10px;left:${mx}%;transform:translateX(-50%);width:0;height:0;
                    border-left:5px solid transparent;border-right:5px solid transparent;
                    border-top:7px solid #ffffff;"></div>
        <div style="position:absolute;top:0;left:${mx}%;transform:translateX(-50%);width:2.5px;height:10px;
                    background:#ffffff;box-shadow:0 0 0 1px rgba(7,9,15,0.75);"></div>`;
        })()}
        <div style="position:absolute;top:50%;left:${pVal}%;transform:translate(-50%,-50%);">
          <div style="width:16px;height:16px;border-radius:50%;background:${col};border:2.5px solid #07090f;"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#3a4458;white-space:nowrap;">
        <span>${lowLbl}</span><span>${sub}</span><span>${highLbl}</span>
      </div>
    </div>`;
}
export function teamContextHtml(tc, ageVal, agePct, markPct = null) {
  const cats = [['squadValue','Squad Cost'],['wageBill','Wage Bill*'],['odds','Betting Forecast']];
  const parts = [];
  cats.forEach(([k,label]) => {
    const m = tc[k];
    if (!m) return;
    const size = _n(m.size), rank = _n(m.rank);
    if (rank == null || size == null || size <= 1) return;
    const pct = _clamp(((size - rank) / (size - 1)) * 100);
    parts.push(_ctxBarHtml(label, pct, `Rank ${rank} of ${size}`, 'Low', 'High', markPct));
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
  // A typed birth date beats the saved one, and the age is computed from whichever
  // wins — showing an age derived from one date beside another date is worse than
  // showing neither. Rendered exactly as CoachCard prints it: the age at full size,
  // the date smaller and grey immediately beside it.
  const dob = String(overrides.dob || coach.dob || '').trim();
  const age = computeAge(dob);
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

  // Where they actually FINISHED, on the same 0-100 scale the context bars use, so
  // the white caret sits comparably against squad cost, wages and the odds. The pager
  // has always drawn this; the quick card called teamContextHtml without it, so its
  // bars carried a rank line and no league position. Age is deliberately left out —
  // its own marker is the average-age figure, and a finish caret on it would be
  // claiming something about a number that isn't a league position.
  const _finRank = _n(statsRow.pointsRank) ?? (_ptsR ? _ptsR.rank : null);
  const _finSize = _n(statsRow.leagueSize) || (_ptsR ? _ptsR.size : null);
  const finishPct = (_finRank != null && _finSize != null && _finSize > 1)
    ? _clamp(((_finSize - _finRank) / (_finSize - 1)) * 100) : null;

  // The two swappable slots. Defaults are what the card has always drawn, so an
  // existing quick card exports unchanged.
  const topRight = overrides.topRight === 'pitch' ? 'pitch' : 'gbe';
  const leftMid  = cqcBodyPanel(overrides.leftMid, 'leftMid');
  const rightMid = cqcBodyPanel(overrides.rightMid, 'rightMid');
  const viewText = String(overrides.viewText || '').trim();

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
  // The table reads off statsRow — the club, league and season this card is already
  // describing everywhere else — against the same pool the radar ranks within, so the
  // subject's own row is the one leagueTablePanelHtml highlights.
  const tableHtml = `<div style="position:relative;height:${_radarInnerH}px;">${
    leagueTablePanelHtml(CAREER_PANEL_W - PANEL_PAD * 2, _radarInnerH, statsRow, _pool)}</div>`;


  // Optional Biography — when set, it replaces the Impact tile (same slot), matching
  // the player quick card's biography behaviour (350-char cap, no scout-status here).
  const bioText = overrides.biography ? String(overrides.biography).slice(0, 315) : '';

  // Either tile draws any of the four. Both are 448 wide and ROW2_PANEL_H tall, so one
  // renderer covers both and nothing can be right only in the slot it grew up in.
  const bodyPanelHtml = (id) => {
    if (id === 'view') {
      return { title: 'View',
               body: `<div style="position:relative;flex:1;">${
                 viewPanelBody(STYLE_PANEL_W - PANEL_PAD * 2,
                               ROW2_PANEL_H - PANEL_PAD * 2 - 40, viewText)}</div>` };
    }
    if (id === 'table') return { title: 'League Table', body: tableHtml };
    if (id === 'impact') return { title: 'Impact', body: radarHtml };
    return { title: 'Team Context', body: teamContextHtml(tc, ageVal, agePct, finishPct) };
  };
  const leftPanel = bodyPanelHtml(leftMid);
  // A biography still takes the right tile, as it always has.
  const rightPanel = bioText
    ? { title: 'Biography',
        body: `<div style="font-size:20px;line-height:1.5;font-weight:600;color:#fff;">${bioText}</div>` }
    : bodyPanelHtml(rightMid);

  // The pitch, in the GBE tile's slot and its box. NOTHING else goes in the tile —
  // it carried a FORMATION label and a shape badge, and both said again what the
  // info column two inches to its left already says on its "Formation:" row. The
  // tile is the pitch. ONE shape, as the pager defaults to.
  const _fmPrimary = overrides.formation
    || (Array.isArray(coach.formations) ? coach.formations[0] : coach.formation) || '';

  // Scale to fit, then size the TILE to the pitch — that way the padding is even on
  // all four sides by construction rather than by arithmetic that has to be redone
  // every time something above it moves.
  //
  // Two ceilings. Width: the tile is 390 wide, less its border and its padding.
  // Height: the tile starts at PITCH_TILE_TOP and the Career panel starts at
  // STYLE_TOP, so the pitch plus its padding has to clear that with a gap left over.
  // Whichever ceiling binds first wins, and the other dimension follows from the
  // pager's own 320:208 aspect — the shape is never stretched to fill.
  const PITCH_TILE_TOP = 24, PITCH_TILE_W = 390, PITCH_TILE_PAD = 20, PITCH_TILE_BORDER = 1;
  const PITCH_TILE_GAP = 12;                 // clear air above the Career panel
  const PITCH_MAX_W = PITCH_TILE_W - PITCH_TILE_BORDER * 2 - PITCH_TILE_PAD * 2;
  const PITCH_MAX_H = STYLE_TOP - PITCH_TILE_TOP - PITCH_TILE_GAP
                      - PITCH_TILE_BORDER * 2 - PITCH_TILE_PAD * 2;
  const PITCH_W = Math.min(PITCH_MAX_W, Math.round(PITCH_MAX_H * (320 / 208)));
  const PITCH_H = Math.round(PITCH_W * (208 / 320));
  const PITCH_TILE_H = PITCH_H + PITCH_TILE_PAD * 2 + PITCH_TILE_BORDER * 2;
  // Flex-centred rather than margin-centred: the tile is exactly the pitch plus its
  // padding, so this centres in both axes and can't drift if either ceiling changes.
  const topRightStyle = topRight === 'pitch'
    ? `top:${PITCH_TILE_TOP}px;left:1510px;width:${PITCH_TILE_W}px;height:${PITCH_TILE_H}px;`
      + `padding:${PITCH_TILE_PAD}px;display:flex;align-items:center;justify-content:center;`
    : `top:${gbeTop}px;left:1510px;width:390px;padding:20px 24px;`;
  const pitchBlockHtml = `
        <div style="width:${PITCH_W}px;height:${PITCH_H}px;flex:none;">
          ${formationPitchSvg(_fmPrimary, '', PITCH_W, PITCH_H, '', 0, true, false)}
        </div>`;

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
  const badgeNudge = _hdrNudge(overrides.badgeNudge);
  const hdrTextNudge = _hdrNudge(overrides.headerTextNudge);

  // Unattached: no single current club, so the 740-1180px header slot lists the
  // clubs managed, newest first — (crest) Crawley 24-25 L2. Six rows is what fits
  // in the 210px the big crest used to occupy without shrinking the type.
  const HIST_MAX = 6;
  const histRows = unattached ? tenureHistory(tenureRows, HIST_MAX) : [];
  const HIST_ROW_H = 34;
  const histBlockHtml = !unattached ? '' : `
      <div style="position:absolute;left:740px;top:${Math.max(24, 132 - (histRows.length * HIST_ROW_H) / 2)}px;width:440px;${hdrTextNudge}">
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
        ${dob ? `<span style="font-size:21.3px;color:#c0c0c0;white-space:nowrap;">${formatDOB(dob)}</span>` : ''}
        ${showPills ? pill(score) : ''}
        ${showPills ? pill(potential) : ''}
      </div>

      <div style="position:absolute;left:248px;top:227px;display:flex;align-items:baseline;gap:32px;">
        ${statRow.map(([lab, val]) => `<div style="display:flex;align-items:baseline;gap:6px;"><span style="font-size:27.9px;font-weight:700;color:#fff;">${val}</span><span style="font-size:16px;font-weight:500;color:#9aa3b8;text-transform:uppercase;letter-spacing:.04em;">${lab}</span></div>`).join('')}
      </div>

      ${unattached ? histBlockHtml : `
      ${teamCrestUrl(latest.team) ? `<div style="position:absolute;left:740px;top:22px;width:155px;height:210px;background-size:contain;background-repeat:no-repeat;background-position:center;background-image:url('${teamCrestUrl(latest.team)}');filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));${badgeNudge}"></div>` : ''}
      <div style="position:absolute;left:915px;top:90px;width:266px;font-size:32px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${hdrTextNudge}">${overrides.teamOverride || latest.team || ''}</div>
      <div style="position:absolute;left:915px;top:140px;display:flex;align-items:center;${hdrTextNudge}">
        <span style="font-size:21px;font-weight:500;color:#fff;white-space:nowrap;">${latest.league || ''}</span>
        ${leagueIso2 ? `<div style="width:32px;height:20px;flex-shrink:0;margin-left:24px;background-size:cover;background-position:center;background-image:url('https://flagcdn.com/w80/${leagueIso2}.png');border-radius:2px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);"></div>` : ''}
      </div>
      ${tenure ? `<div style="position:absolute;left:915px;top:178px;font-size:20px;font-weight:500;color:#9aa3b8;white-space:nowrap;${hdrTextNudge}">${tenure}</div>` : ''}`}

      <div style="position:absolute;left:1188px;top:36px;width:2px;height:210px;background:rgba(255,255,255,0.14);"></div>
      ${infoBox}

      <div style="position:absolute;${topRightStyle}background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;box-sizing:border-box;overflow:hidden;">
        ${topRight === 'pitch' ? pitchBlockHtml : `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <span style="font-size:15px;font-weight:700;color:#9aa3b8;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">GBE Calculation</span>
          <span style="font-size:16px;font-weight:800;color:${gbeCol};background:${gbeCol}22;border:1px solid ${gbeCol};border-radius:6px;padding:5px 14px;white-space:nowrap;">${gbeStatus}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${gbeCriteriaRow('36 Months Cumulative', 'Band 1-5 League', gbeC36)}
          ${gbeCriteriaRow('24 Months Consecutive', 'Band 1-5 League', gbeC24)}
        </div>
        ${autopass ? `<div style="margin-top:14px;font-size:12px;font-weight:600;color:#3da65b;border-top:1px solid rgba(61,166,91,0.2);padding-top:10px;">✓ Auto Pass — ${englandLeague ? 'English League' : 'Home Nation'}</div>` : ''}
        ${gbeShowPanel ? `<div style="margin-top:14px;font-size:12px;font-weight:600;color:#f97316;border-top:1px solid rgba(249,115,22,0.2);padding-top:10px;line-height:1.4;">⚡ Exceptions Panel — ${gbeExceptionsText}</div>` : ''}`}
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
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:14px;">${leftPanel.title}</div>
        ${leftPanel.body}
      </div>

      <div style="position:absolute;top:${ROW2_TOP}px;left:${984 + STYLE_PANEL_W + PANEL_GAP_H}px;width:${CAREER_PANEL_W}px;height:${ROW2_PANEL_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PANEL_PAD}px;box-sizing:border-box;overflow:hidden;box-shadow:${PANEL_SHADOW};display:flex;flex-direction:column;">
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:18px;">${rightPanel.title}</div>
        ${rightPanel.body}
      </div>

    </div>`;
  return container;
}

export async function downloadCoachQuickCardPNG(coach, tenureRows, traits, overrides = {}) {
  await ensureMontserratEmbedded();
  // The league table draws a crest per row from a remote URL, and html-to-image can
  // only rasterise what is already a data URL — every other card preloads for exactly
  // this reason. Only done when the table is actually on the card.
  if (overrides.rightMid === 'table' || overrides.leftMid === 'table') {
    try {
      const rows = (tenureRows || []).slice()
        .sort((a, b) => (a.season < b.season ? 1 : -1));
      const subject = resolveStatsRow(rows, tenureRows, overrides.statsSeasonKey) || rows[0];
      if (subject) {
        const pool = (overrides.allTeams && overrides.allTeams.length) ? overrides.allTeams : tenureRows;
        setSharedImageMap(await preloadImages(cardImageUrls(subject, [], null, pool)));
      }
    } catch (e) { /* crest-less rows beat no card at all */ }
  }
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
