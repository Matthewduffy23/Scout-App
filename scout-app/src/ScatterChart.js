import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SCORE_TIERS, POS_COLORS, METRIC_OPTIONS, METRIC_OPTIONS_EXTRA, seasonDetailFor, metricFromDetail,
  SCORE_DOT_STEPS, SCORE_DOT_LOW, scoreDotColor, EXPORT_W, EXPORT_H } from './constants';
import { useIsMobile, deliverPng } from './utils';
import { ensureMontserratEmbedded } from './CoachCard';

// Scatter view of the current Scout Index result list: plots the top N of the
// already filtered + sorted players (App passes `sorted`). Canvas, drawn by one
// pure function for the live view and for the 1920x1080 exports (dark + light).

const POS_ORDER = ['GK','CB','FB','CM','ATT','CF'];
const OTHER_COLOR = '#94a3b8';
const NODATA_COLOR = '#64748b';

// Colour sets. The live chart is always dark (the app is dark); exports render both.
// `zone` is the RGB used, at rising alpha (one step per zone), to shade level-band zones — neutral on
// purpose so it never competes with the dot colours.
const THEMES = {
  dark: {
    bg:'#060b14', plot:'#081222', zone:'148,176,230', zoneBase:0.02, zoneStep:0.035,
    grid:'rgba(148,163,184,0.09)', band:'rgba(148,163,184,0.30)', axis:'#2a3950', tick:'#7c8699',
    axisTitle:'#cbd5e1', title:'#f8fafc', sub:'#94a3b8', zoneText:'rgba(203,213,225,0.50)',
    label:'#e5e7eb', halo:'rgba(6,11,20,0.92)', ring:'#060b14', ringW:1.6, hl:'#ffffff',
    leader:'rgba(148,163,184,0.55)', legendText:'#cbd5e1', rule:'#1e293b', footer:'#64748b',
    // Quadrant tints (teal / indigo / slate), stronger on the right-hand (high X) side
    quadTR:'rgba(20,184,166,0.15)', quadBR:'rgba(99,102,241,0.13)', quadTL:'rgba(100,116,139,0.08)',
    quadText:'rgba(226,232,240,0.62)', split:'rgba(148,163,184,0.55)',
    muted:'rgba(203,213,225,0.34)', // group mode: everyone outside the group
  },
  light: {
    bg:'#ffffff', plot:'#fbfcfe', zone:'30,41,59', zoneBase:0.008, zoneStep:0.018,
    grid:'rgba(15,23,42,0.06)', band:'rgba(71,85,105,0.22)', axis:'#94a3b8', tick:'#64748b',
    axisTitle:'#1e293b', title:'#0f172a', sub:'#475569', zoneText:'rgba(51,65,85,0.60)',
    label:'#0f172a', halo:'rgba(255,255,255,0.94)', ring:'rgba(15,23,42,0.6)', ringW:1.1, hl:'#0f172a',
    leader:'rgba(71,85,105,0.6)', legendText:'#1e293b', rule:'#e2e8f0', footer:'#64748b',
    quadTR:'rgba(13,148,136,0.12)', quadBR:'rgba(79,70,229,0.09)', quadTL:'rgba(100,116,139,0.07)',
    quadText:'rgba(30,41,59,0.62)', split:'rgba(71,85,105,0.50)',
    muted:'rgba(148,163,184,0.42)',
  },
};

const money = v => v >= 1e6 ? `£${(v/1e6).toFixed(1)}m` : `£${Math.round(v/1e3)}k`;
const posOrNull = v => (v != null && v > 0 ? v : null);
// Band lines for THIS CHART ONLY: SCORE_TIERS with the 61 line relabelled
// "L1-CH" (57 keeps "League One") and a new "Championship" line at 63. Display override — SCORE_TIERS
// itself (table, star ratings, PlayerCard, score labels) is untouched, and so are
// the score-mode dot colours (app-wide SCORE_DOT_STEPS).
const CHART_TIERS = [
  ...SCORE_TIERS.filter(t => t.min >= 67),
  { min:63, label:'Championship Level', short:'Championship' },
  { min:61, label:'L1-CH', short:'L1-CH' },
  ...SCORE_TIERS.filter(t => t.min <= 57),
];
const tierShort = min => SCORE_TIERS.find(t => t.min === min)?.short || String(min);
const tierAt = v => CHART_TIERS.find(t => v >= t.min);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Score-colour legend buckets, one per SCORE_DOT_STEPS cutoff plus "below".
const SCORE_BUCKETS = [
  ...SCORE_DOT_STEPS.map((s, i) => ({ key:'s'+s.min, color:s.color,
    label:`${tierShort(s.min)} ${s.min}${i ? '–' + SCORE_DOT_STEPS[i-1].min : '+'}` })),
  { key:'slow', color:SCORE_DOT_LOW, label:`Below ${SCORE_DOT_STEPS[SCORE_DOT_STEPS.length-1].min}` },
];
// Quadrant mode: which score fields are "current level" and which are "potential".
const CURRENT_KEYS = new Set(['display', 'careerScore', 'peakScore']);
const POTENTIAL_KEYS = new Set(['potentialScore', 'potentialCeiling']);
const TARGET_TIERS = CHART_TIERS.filter(t => t.min >= 50);
const shortLabel = l => l.replace(/^Table score · /, '');
const quadOf = (q, d) => q.names[(d.y >= q.ySplit ? 't' : 'b') + (d.x >= q.xSplit ? 'r' : 'l')];

const scoreBucketKey = v => { const s = SCORE_DOT_STEPS.find(t => v >= t.min); return s ? 's'+s.min : 'slow'; };

const PLAYER_LOWER_BETTER = new Set(['Goals Conceded', 'xG Against']);

function tableScoreLabel({ seasonFilter, scoreMode, rawMode, outlierMode }) {
  const season = seasonFilter !== 'all' ? seasonFilter : null;
  if (outlierMode) return scoreMode !== 'complete' ? `Outlier z · ${scoreMode}` : `Outlier z · ${season || 'career'}`;
  if (rawMode) return season ? `Raw score · ${season}` : 'Raw career score';
  if (season) return `Score · ${season}`;
  return scoreMode !== 'complete' ? `${scoreMode} score` : 'Career score';
}

// Every field an axis can show. `get(p)` returns a number or null;
// `scoreScale` means the level bands (shading, dashed lines) apply.
function buildFields(ctx) {
  const f = [
    { key:'display', group:'Score', label:`Table score · ${tableScoreLabel(ctx)}`, get:p=>ctx.getDisplayScore(p), scoreScale:!ctx.rawMode&&!ctx.outlierMode },
    { key:'careerScore', group:'Score', label:'Career score', get:p=>p.careerScore, scoreScale:true },
    { key:'peakScore', group:'Score', label:'Peak score', get:p=>p.peakScore, scoreScale:true },
    { key:'potentialScore', group:'Score', label:'Potential', get:p=>p.potentialScore, scoreScale:true },
    { key:'potentialCeiling', group:'Score', label:'Potential ceiling', get:p=>p.potentialCeiling, scoreScale:true },
    { key:'xValue', group:'Value', label:'xValue', get:p=>posOrNull(p.xValue), fmt:money },
    { key:'marketValue', group:'Value', label:'Market value', get:p=>posOrNull(p.marketValue), fmt:money },
    { key:'xValueGapPct', group:'Value', label:'Value gap %', get:p=>p.xValueGapPct },
    { key:'age', group:'Profile', label:'Age', get:p=>p.age, words:['Older', 'Younger'] },
    { key:'height', group:'Profile', label:'Height (cm)', get:p=>posOrNull(p.height) },
    { key:'minutes', group:'Profile', label:`Minutes (${ctx.seasonFilter==='all'?'latest season':ctx.seasonFilter})`, get:p=>seasonDetailFor(p,ctx.seasonFilter)?.minutes ?? null },
    { key:'seasons', group:'Profile', label:'Seasons', get:p=>p.seasons },
    { key:'gbeTotal', group:'Profile', label:'GBE points', get:p=>p.gbeTotal },
  ];
  const seasonTag = ctx.seasonFilter === 'all' ? 'latest' : ctx.seasonFilter;
  for (const m of [...METRIC_OPTIONS, ...METRIC_OPTIONS_EXTRA]) {
    f.push({
      key:'m:'+m.key, group:`Per-90 metrics (${seasonTag})`, metric:true, short:m.label.replace(/ per 90$/, ''),
      // GK Goals Conceded / xG Against: lower is better, and their percentiles are already flipped
      ...(PLAYER_LOWER_BETTER.has(m.key) ? { lowerBetter:true, pctInverted:true } : {}),
      label: ctx.metricMode === 'pct' ? `${m.label} (percentile)` : m.label,
      get: p => { const r = metricFromDetail(seasonDetailFor(p, ctx.seasonFilter), m.key); return r ? (ctx.metricMode === 'pct' ? r.pct : r.val) : null; },
      pctDomain: ctx.metricMode === 'pct',
    });
  }
  return f;
}

function niceStep(raw) {
  const e = 10 ** Math.floor(Math.log10(raw));
  const f = raw / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}
// Tight range: the data plus 4% each side (not rounded out to a whole step, which
// used to leave ~40% of the plot empty). Ticks sit on round steps inside it.
function axisDomain(vals, field) {
  if (field.pctDomain) return { lo:0, hi:100, step:20 };
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.04;
  lo -= pad; hi += pad;
  let step = niceStep((hi - lo) / 6);
  if (field.scoreScale && step === 2.5) step = 2; // 67.5 / 72.5 ticks crowd the band lines
  if (vals.every(Number.isInteger) && !Number.isInteger(step)) step = Math.max(1, Math.round(step) === 3 ? 2 : Math.round(step));
  return { lo, hi, step };
}
function ticksOf(d) {
  const out = [];
  for (let i = Math.ceil(d.lo / d.step - 1e-9); i * d.step <= d.hi + 1e-9; i++) out.push(+(i * d.step).toFixed(6));
  return out;
}
function tickText(v, field, step) {
  if (field.fmt) return field.fmt(v);
  // as many decimals as the step itself has (0.25 -> 2), so 1.25 never shows as "1.3"
  const dp = Math.min(3, (String(+step.toFixed(6)).split('.')[1] || '').length);
  return v.toFixed(dp);
}
function valueText(v, field) {
  if (field.fmt) return field.fmt(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// Pure layout: scales + padding for a W x H canvas. Shared by drawing and hit-testing.
const EXPORT_PAD = { r:70, b:140, l:140 };
function computeLayout(W, H, forExport, pts, xf, yf, exportTop, stripX = xf.scoreScale ? 2 : 0) {
  const fs = forExport ? W / 800 : 1;
  // Live: a strip above the plot carries the X-axis band names (two rows) when X is a score.
  const pad = forExport ? { ...EXPORT_PAD, t: exportTop } : { t: 12 + [0, 20, 32][stripX ? Number(stripX) : 0], r:16, b:46, l:60 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const xd = axisDomain(pts.map(d => d.x), xf), yd = axisDomain(pts.map(d => d.y), yf);
  const xS = v => pad.l + ((v - xd.lo) / (xd.hi - xd.lo)) * pw;
  const yS = v => pad.t + ph - ((v - yd.lo) / (yd.hi - yd.lo)) * ph;
  // Both axes scores -> quadrants. One score axis -> band shading along it. Neither -> plain.
  const quad = !!(xf.scoreScale && yf.scoreScale);
  const shade = quad ? null : yf.scoreScale ? 'y' : xf.scoreScale ? 'x' : null;
  return { fs, pad, pw, ph, xd, yd, xS, yS, quad, shade };
}

const pid = d => d.id ?? d.p?.id;
const pname = d => d.name ?? d.p?.name;
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// Greedy label placement: each label tries 8 positions round its dot, first
// touching it and then one short step out with a leader line. A spot must be
// clear of the plot edge, every dot and every label already placed, and a leader
// may not cross another dot or label. Labels are fed in priority order; a
// `force` label (the highlighted player) always gets placed.
function placeLabels(ctx, items, dots, bounds, taken, fs, budget = Infinity) {
  const placed = [...taken];
  const DIRS = [[1,0],[-1,0],[0,-1],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]];
  const clear = b => b.x0 >= bounds.x0 && b.x1 <= bounds.x1 && b.y0 >= bounds.y0 && b.y1 <= bounds.y1
    && !placed.some(q => overlaps(b, q))
    && !dots.some(o => o.x + o.r > b.x0 && o.x - o.r < b.x1 && o.y + o.r > b.y0 && o.y - o.r < b.y1);
  const leaderClear = (it, b) => {
    const tx = Math.max(b.x0, Math.min(it.x, b.x1)), ty = Math.max(b.y0, Math.min(it.y, b.y1));
    for (let k = 1; k < 8; k++) {
      const px = it.x + (tx - it.x) * k / 8, py = it.y + (ty - it.y) * k / 8;
      if (dots.some(o => (o.x !== it.x || o.y !== it.y) && (o.x - px) ** 2 + (o.y - py) ** 2 < (o.r + 1) ** 2)) return false;
      if (placed.some(q => px > q.x0 && px < q.x1 && py > q.y0 && py < q.y1)) return false;
    }
    return true;
  };
  const out = [];
  let named = 0;
  for (const it of items) {
    if (!it.force && named >= budget) continue;
    ctx.font = it.font;
    const w = ctx.measureText(it.text).width + 4, h = it.px * 1.3;
    let choice = null;
    for (const extra of [0, 10*fs]) {
      for (const [dx, dy] of DIRS) {
        const k = dx && dy ? 0.75 : 1, dist = (it.r + 3*fs + extra) * k;
        const cx = it.x + dx*dist, cy = it.y + dy*dist;
        const x0 = dx > 0 ? cx : dx < 0 ? cx - w : cx - w/2;
        const y0 = dy > 0 ? cy : dy < 0 ? cy - h : cy - h/2;
        const b = { x0, y0, x1: x0 + w, y1: y0 + h };
        if (clear(b) && (!extra || leaderClear(it, b))) { choice = { b, leader: extra > 0 }; break; }
      }
      if (choice) break;
    }
    if (!choice && it.force) {
      const x0 = Math.min(it.x + it.r + 3*fs, bounds.x1 - w), y0 = Math.max(bounds.y0, it.y - h - it.r);
      choice = { b: { x0, y0, x1: x0 + w, y1: y0 + h }, leader: true };
    }
    if (!choice) continue;
    if (!it.force) named++;
    placed.push(choice.b);
    if (choice.leader) { // reserve the leader's path so later names can't sit on it
      const b = choice.b, tx = Math.max(b.x0, Math.min(it.x, b.x1)), ty = Math.max(b.y0, Math.min(it.y, b.y1));
      for (let k = 2; k < 8; k++) { const px = it.x + (tx - it.x) * k / 8, py = it.y + (ty - it.y) * k / 8; placed.push({ x0: px - 1, y0: py - 1, x1: px + 1, y1: py + 1 }); }
    }
    out.push({ ...it, box: choice.b, leader: choice.leader });
  }
  return out;
}

// Export header: title + subtitle on the left, legend right-aligned beside the
// title (wrapping onto extra rows). If a long title leaves no room, the legend
// drops to its own rows under the subtitle. Returns where the plot can start.
function exportHeader(ctx, W, FONT, title, legend, xIsScore) {
  const right = W - EXPORT_PAD.r, L0 = EXPORT_PAD.l;
  ctx.font = `700 46px ${FONT}`;
  const titleW = ctx.measureText(title).width;
  ctx.font = `600 21px ${FONT}`;
  const items = (legend || []).map(it => { const txt = `${it.label}  ${it.count}`; return { it, txt, w: ctx.measureText(txt).width + 26 }; });
  const GAP = 36;
  const rowsFor = maxW => {
    const rows = []; let row = [], rw = 0;
    for (const x of items) {
      if (row.length && rw + GAP + x.w > maxW) { rows.push(row); row = []; rw = 0; }
      rw += (row.length ? GAP : 0) + x.w; row.push(x);
    }
    if (row.length) rows.push(row);
    return rows;
  };
  const avail = right - (L0 + titleW + 80);
  let rows = avail > 0 ? rowsFor(avail) : [];
  const beside = avail > 260 && items.every(x => x.w <= avail) && rows.length <= 3;
  if (!beside) rows = rowsFor(right - L0);
  const legendTop = beside ? 58 : 146;
  const legendBottom = rows.length ? legendTop + (rows.length - 1) * 32 + 12 : 0;
  const ruleY = Math.max(122, legendBottom + 8);
  return { rows, beside, legendTop, ruleY, right, GAP, plotTop: ruleY + 26 + [0, 34, 62][xIsScore ? Number(xIsScore) : 0] };
}

export function drawScatter(canvas, W, H, dpr, forExport, o) {
  const { pts, xf, yf, hidden, hoverId, highlightId, showNames, soloLabel, title, subtitle, footer, legend, quad: Q, median, group, theme: themeName = 'dark' } = o;
  const T = THEMES[themeName];
  const FONT = forExport ? 'Montserrat, Inter, sans-serif' : 'Inter, sans-serif';
  canvas.width = W*dpr; canvas.height = H*dpr;
  if (!forExport) { canvas.style.width = W+'px'; canvas.style.height = H+'px'; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
  if (!pts.length) return null;

  const stripX = xf.scoreScale ? 2 : median && median.x != null ? 1 : 0; // rows of labels above the plot
  const head = forExport ? exportHeader(ctx, W, FONT, title, legend, stripX) : null;
  const L = computeLayout(W, H, forExport, pts, xf, yf, head && head.plotTop, stripX);
  const { fs, pad, pw, ph, xd, yd, xS, yS, shade } = L;
  const quad = Q || null; // score quadrants (both axes scores) or median quadrants (neither is)
  const f = (px, weight = 400) => `${weight} ${px*fs}px ${FONT}`;
  const inX = m => m > xd.lo && m < xd.hi, inY = m => m > yd.lo && m < yd.hi;
  ctx.fillStyle = T.plot; ctx.fillRect(pad.l, pad.t, pw, ph);
  const taken = []; // boxes name labels must avoid (zone, band and quadrant labels)
  const textBox = (x, y, w, h) => ({ x0: x - 2*fs, y0: y - h, x1: x + w + 2*fs, y1: y + 3*fs });

  ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
  // ── Quadrants (both axes scores): tints strengthen towards the right ─────
  let qs = null;
  if (quad) {
    const sx = Math.max(pad.l, Math.min(pad.l + pw, xS(quad.xSplit))), sy = Math.max(pad.t, Math.min(pad.t + ph, yS(quad.ySplit)));
    qs = { sx, sy };
    // tint per corner: 'best' (better on both axes) teal, 'x' (better on X only) indigo,
    // 'y' (better on Y only) slate, none for worse on both
    const tint = quad.tint || { tr:'best', br:'x', tl:'y', bl:null };
    const fillOf = k => ({ best: T.quadTR, x: T.quadBR, y: T.quadTL })[k];
    const rects = { tr: [sx, pad.t, pad.l + pw - sx, sy - pad.t], br: [sx, sy, pad.l + pw - sx, pad.t + ph - sy],
      tl: [pad.l, pad.t, sx - pad.l, sy - pad.t], bl: [pad.l, sy, sx - pad.l, pad.t + ph - sy] };
    for (const k of ['tr', 'br', 'tl', 'bl']) if (fillOf(tint[k])) { ctx.fillStyle = fillOf(tint[k]); ctx.fillRect(...rects[k]); }
  }
  // ── Single score axis: neutral band zones along it ──────────────────────
  if (shade) {
    const d = shade === 'y' ? yd : xd, S = shade === 'y' ? yS : xS;
    const cuts = CHART_TIERS.map(t => t.min).filter(m => m > d.lo && m < d.hi).sort((a, b) => a - b);
    const edges = [d.lo, ...cuts, d.hi];
    for (let k = 0; k < edges.length - 1; k++) {
      ctx.fillStyle = `rgba(${T.zone},${(T.zoneBase + k*T.zoneStep).toFixed(3)})`;
      const a = S(edges[k]), b = S(edges[k+1]);
      if (shade === 'y') ctx.fillRect(pad.l, b, pw, a - b); else ctx.fillRect(a, pad.t, b - a, ph);
    }
  }
  // ── Plain grid only on axes that are not scores (scores get band lines) ──
  ctx.setLineDash([]); ctx.strokeStyle = T.grid; ctx.lineWidth = 1;
  if (!yf.scoreScale) for (const v of ticksOf(yd)) { ctx.beginPath(); ctx.moveTo(pad.l, yS(v)); ctx.lineTo(pad.l + pw, yS(v)); ctx.stroke(); }
  if (!xf.scoreScale) for (const v of ticksOf(xd)) { ctx.beginPath(); ctx.moveTo(xS(v), pad.t); ctx.lineTo(xS(v), pad.t + ph); ctx.stroke(); }
  // ── Dashed band lines on every score axis ────────────────────────────────
  ctx.setLineDash([5*fs, 4*fs]); ctx.strokeStyle = T.band; ctx.lineWidth = forExport ? 2 : 1;
  for (const t of CHART_TIERS) {
    if (yf.scoreScale && inY(t.min) && !(quad && t.min === quad.ySplit)) { ctx.beginPath(); ctx.moveTo(pad.l, yS(t.min)); ctx.lineTo(pad.l + pw, yS(t.min)); ctx.stroke(); }
    if (xf.scoreScale && inX(t.min) && !(quad && t.min === quad.xSplit)) { ctx.beginPath(); ctx.moveTo(xS(t.min), pad.t); ctx.lineTo(xS(t.min), pad.t + ph); ctx.stroke(); }
  }
  ctx.setLineDash([]);
  // ── Quadrant split lines (median quadrants use the dashed median lines below) ──
  if (quad && !quad.median) {
    ctx.strokeStyle = T.split; ctx.lineWidth = (forExport ? 2 : 1.2);
    if (inX(quad.xSplit)) { ctx.beginPath(); ctx.moveTo(qs.sx, pad.t); ctx.lineTo(qs.sx, pad.t + ph); ctx.stroke(); }
    if (inY(quad.ySplit)) { ctx.beginPath(); ctx.moveTo(pad.l, qs.sy); ctx.lineTo(pad.l + pw, qs.sy); ctx.stroke(); }
  }
  // ── Median lines on non-score axes (dashed, like the band lines) ─────────
  if (median) {
    ctx.setLineDash([5*fs, 4*fs]); ctx.strokeStyle = T.split; ctx.lineWidth = forExport ? 2 : 1.2;
    if (median.x != null && inX(median.x)) { ctx.beginPath(); ctx.moveTo(xS(median.x), pad.t); ctx.lineTo(xS(median.x), pad.t + ph); ctx.stroke(); }
    if (median.y != null && inY(median.y)) { ctx.beginPath(); ctx.moveTo(pad.l, yS(median.y)); ctx.lineTo(pad.l + pw, yS(median.y)); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  ctx.restore();

  const r = (pts.length > 200 ? 4 : 5.5) * fs;
  const hl = highlightId != null ? pts.find(d => pid(d) === highlightId) : null;
  const visible = pts.filter(d => d === hl || !hidden.has(d.g));
  const dots = visible.map(d => ({ x: xS(d.x), y: yS(d.y), r: d === hl ? r*1.6 : r }));
  const hitsDot = b => dots.some(o => o.x + o.r > b.x0 && o.x - o.r < b.x1 && o.y + o.r > b.y0 && o.y - o.r < b.y1);

  // Quadrant and band names are collected here and drawn AFTER the dots with a
  // halo, so in the rare case no clear spot exists a dot can't hide the text.
  const overlays = [];
  const dotHits = b => dots.filter(o => o.x + o.r > b.x0 && o.x - o.r < b.x1 && o.y + o.r > b.y0 && o.y - o.r < b.y1).length;

  // ── Quadrant names in the corners (slid along the edge, then inwards, to clear dots) ──
  if (quad) {
    ctx.font = f(9.5, 700); ctx.fillStyle = T.quadText;
    const inset = 8*fs, hgt = 11*fs;
    const corners = [
      [quad.names.tr, 'right', pad.l + pw - inset, pad.t + 14*fs, pad.l + pw - qs.sx, qs.sy - pad.t],
      [quad.names.tl, 'left',  pad.l + inset,      pad.t + 14*fs, qs.sx - pad.l,      qs.sy - pad.t],
      [quad.names.br, 'right', pad.l + pw - inset, pad.t + ph - inset, pad.l + pw - qs.sx, pad.t + ph - qs.sy],
      [quad.names.bl, 'left',  pad.l + inset,      pad.t + ph - inset, qs.sx - pad.l,      pad.t + ph - qs.sy],
    ];
    const alt = quad.alt || {};
    for (const [txt0, align, x, y, qw, qh, key] of corners.map((c, i) => [...c, ['tr', 'tl', 'br', 'bl'][i]])) {
      if (!txt0) continue;
      let label = txt0.toUpperCase(), tw = ctx.measureText(label).width;
      if (qw < tw + 2*inset && alt[key]) { label = alt[key].toUpperCase(); tw = ctx.measureText(label).width; } // long axis names
      if (qw < tw + 2*inset || qh < hgt + 2*inset) continue; // quadrant too small on screen
      const down = y < pad.t + ph/2 ? 1 : -1; // top corners move down, bottom corners up
      let best = null, fewest = null;
      for (let lift = 0; lift <= Math.min(qh - hgt - 2*inset, 60*fs) && !best; lift += 12*fs) {
        const ly = y + down*lift;
        for (let shift = 0; shift <= qw - tw - 2*inset; shift += 12*fs) {
          const lx = align === 'right' ? x - shift - tw : x + shift;
          const b = textBox(lx, ly, tw, hgt), hits = dotHits(b);
          if (!hits && !taken.some(q => overlaps(b, q))) { best = { lx, ly, b }; break; }
          if (!fewest || hits < fewest.hits) fewest = { lx, ly, b, hits };
        }
      }
      best = best || fewest;
      overlays.push({ text: label, x: best.lx, y: best.ly, font: f(9.5, 700), color: T.quadText });
      taken.push(best.b);
    }
  }
  // ── Band names: every band line in range is named. A name slides along its
  //    line to clear dots and other labels; if nowhere is clear it still goes in.
  ctx.font = f(8, 600); ctx.fillStyle = T.zoneText;
  const slideLabel = (name, y, color) => {
    const tw = ctx.measureText(name).width;
    let pick = null;
    for (let x = pad.l + 8*fs; x + tw <= pad.l + pw - 8*fs; x += 12*fs) {
      const b = textBox(x, y, tw, 10*fs);
      if (!taken.some(q => overlaps(b, q)) && !hitsDot(b)) { pick = { x, b }; break; }
    }
    if (!pick) pick = { x: pad.l + 8*fs, b: textBox(pad.l + 8*fs, y, tw, 10*fs) };
    overlays.push({ text: name, x: pick.x, y, font: f(8, 600), color }); taken.push(pick.b);
  };
  if (shade === 'y') {
    // zone names inside the plot, at the top of each zone
    const cuts = CHART_TIERS.map(t => t.min).filter(inY).sort((a, b) => a - b);
    const edges = [yd.lo, ...cuts, yd.hi];
    for (let k = 0; k < edges.length - 1; k++) {
      const top = yS(edges[k+1]), bot = yS(edges[k]);
      if (bot - top < 11*fs) continue; // a zone thinner than the text itself
      slideLabel((tierAt(edges[k])?.short || 'Development').toUpperCase(), top + 10*fs, T.zoneText);
    }
  } else if (quad && yf.scoreScale) {
    // Y band names just above their line (below it if the line is at the very top)
    for (const t of CHART_TIERS) {
      if (!inY(t.min)) continue;
      const above = yS(t.min) - 4*fs, y = above - 10*fs < pad.t ? yS(t.min) + 12*fs : above;
      slideLabel(t.short.toUpperCase(), y, t.min === quad.ySplit ? T.quadText : T.zoneText);
    }
  }
  const aboveLine = v => { const a = yS(v) - 4*fs; return a - 10*fs < pad.t ? yS(v) + 12*fs : a; };
  if (median && median.y != null && inY(median.y)) slideLabel(`MEDIAN ${median.yText}`, aboveLine(median.y), T.quadText);
  if (median && median.x != null && inX(median.x)) {
    ctx.font = f(8, 600);
    const name = `MEDIAN ${median.xText}`, tw = ctx.measureText(name).width;
    const x0 = Math.max(pad.l, Math.min(xS(median.x) - tw/2, pad.l + pw - tw));
    ctx.textAlign = 'left'; ctx.fillStyle = T.quadText; ctx.fillText(name, x0, pad.t - 7*fs);
  }
  if (xf.scoreScale) {
    // X band names horizontally above the plot, centred on each line; two rows so
    // close lines (League One 61 / Championship 63) both keep their names.
    ctx.font = f(8, 600);
    const rowY = [pad.t - 7*fs, pad.t - 19*fs], lastRight = [-Infinity, -Infinity];
    const marks = CHART_TIERS.filter(t => inX(t.min)).sort((a, b) => a.min - b.min);
    for (const t of marks) {
      const name = t.short.toUpperCase(), tw = ctx.measureText(name).width, cx = xS(t.min);
      const x0 = Math.max(pad.l, Math.min(cx - tw/2, pad.l + pw - tw));
      const row = x0 >= lastRight[0] + 10*fs ? 0 : x0 >= lastRight[1] + 10*fs ? 1 : -1;
      if (row < 0) continue;
      ctx.textAlign = 'left'; ctx.fillStyle = t.min === quad?.xSplit ? T.quadText : T.zoneText;
      ctx.fillText(name, x0, rowY[row]); lastRight[row] = x0 + tw;
    }
    ctx.fillStyle = T.zoneText;
  }

  // ── Axes, ticks, titles ──────────────────────────────────────────────────
  ctx.strokeStyle = T.axis; ctx.lineWidth = forExport ? 2 : 1;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph); ctx.stroke();
  ctx.font = f(10, 500); ctx.fillStyle = T.tick;
  ctx.textAlign = 'right';
  for (const v of ticksOf(yd)) {
    ctx.fillText(tickText(v, yf, yd.step), pad.l - 8*fs, yS(v) + 3.5*fs);
    ctx.beginPath(); ctx.moveTo(pad.l - 4*fs, yS(v)); ctx.lineTo(pad.l, yS(v)); ctx.stroke();
  }
  ctx.textAlign = 'center';
  for (const v of ticksOf(xd)) {
    ctx.fillText(tickText(v, xf, xd.step), xS(v), pad.t + ph + 17*fs);
    ctx.beginPath(); ctx.moveTo(xS(v), pad.t + ph); ctx.lineTo(xS(v), pad.t + ph + 4*fs); ctx.stroke();
  }
  ctx.font = f(10.5, 600); ctx.fillStyle = T.axisTitle; ctx.textAlign = 'center';
  ctx.fillText(xf.label, pad.l + pw/2, pad.t + ph + 36*fs);
  ctx.save(); ctx.translate(pad.l - 44*fs, pad.t + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText(yf.label, 0, 0); ctx.restore();

  // ── Dots ─────────────────────────────────────────────────────────────────
  const ringDot = (d, rad, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(xS(d.x), yS(d.y), rad, 0, Math.PI*2);
    ctx.fillStyle = d.muted ? T.muted : d.color; ctx.fill();
    ctx.strokeStyle = T.ring; ctx.lineWidth = T.ringW*fs; ctx.stroke();
    ctx.globalAlpha = 1;
  };
  // Highlight fades everyone else; single-highlight mode instead keeps them solid but
  // unnamed. A group highlight already mutes non-members, so no extra fading then.
  const solo = !!(hl && soloLabel);
  const fade = hl && !solo && !group ? 0.25 : 0.95;
  const dotColor = d => (d.muted ? T.muted : d.color);
  for (const pass of group ? [true, false] : [null]) {
    for (let i = visible.length - 1; i >= 0; i--) {
      const d = visible[i];
      if (d === hl || (pass !== null && !!d.muted !== pass)) continue;
      ringDot({ ...d, color: dotColor(d) }, r, d.muted ? 1 : fade);
    }
  }
  ctx.lineJoin = 'round'; ctx.textAlign = 'left';
  for (const ov of overlays) {
    ctx.font = ov.font;
    ctx.strokeStyle = T.halo; ctx.lineWidth = 3*fs; ctx.strokeText(ov.text, ov.x, ov.y);
    ctx.fillStyle = ov.color; ctx.fillText(ov.text, ov.x, ov.y);
  }

  // ── Name labels ──────────────────────────────────────────────────────────
  const bounds = { x0: pad.l + 2, y0: pad.t + 2, x1: pad.l + pw - 2, y1: pad.t + ph - 2 };
  const items = [];
  if (hl) items.push({ x: xS(hl.x), y: yS(hl.y), r: r*1.6, force: true, px: 11*fs, font: f(11, 700),
    text: pname(hl) + (hl.extra ? `  #${hl.rank}` : ''), hl: true });
  // Names: walk the list in rank order and keep placing until the budget of
  // *placed* names is used, so names that can't fit in a cluster don't use up
  // the allowance and sparse areas still get labelled.
  const budget = group ? Infinity : Math.max(12, Math.min(90, Math.round(pw*ph / (4500*fs*fs))));
  if (showNames && !solo) {
    for (const d of group ? visible.filter(v => !v.muted) : visible.slice(0, 400)) {
      if (d === hl) continue;
      items.push({ x: xS(d.x), y: yS(d.y), r, px: 9.5*fs, font: f(9.5, 500), text: pname(d) });
    }
  }
  const labels = placeLabels(ctx, items, dots, bounds, taken, fs, budget);
  L.labels = labels; L.dots = dots; L.bounds = bounds; L.taken = taken;
  ctx.lineJoin = 'round'; ctx.textAlign = 'left';
  for (const lb of labels) {
    ctx.globalAlpha = lb.hl || !hl || solo || group ? 1 : 0.35;
    if (lb.leader) {
      const bx = Math.max(lb.box.x0, Math.min(lb.x, lb.box.x1)), by = Math.max(lb.box.y0, Math.min(lb.y, lb.box.y1));
      const ang = Math.atan2(by - lb.y, bx - lb.x);
      ctx.strokeStyle = T.leader; ctx.lineWidth = fs;
      ctx.beginPath(); ctx.moveTo(lb.x + Math.cos(ang)*lb.r, lb.y + Math.sin(ang)*lb.r); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.font = lb.font;
    const bx = lb.box.x0 + 2, by = lb.box.y0 + lb.px * 1.02;
    ctx.strokeStyle = T.halo; ctx.lineWidth = 3*fs; ctx.strokeText(lb.text, bx, by);
    ctx.fillStyle = T.label; ctx.fillText(lb.text, bx, by);
    ctx.globalAlpha = 1;
  }

  // ── Highlighted player on top ────────────────────────────────────────────
  if (hl) {
    ringDot(hl, r*1.6, 1);
    ctx.beginPath(); ctx.arc(xS(hl.x), yS(hl.y), r*1.6 + 3*fs, 0, Math.PI*2);
    ctx.strokeStyle = T.hl; ctx.lineWidth = 2*fs; ctx.stroke();
  }
  const hv = hoverId != null && hoverId !== highlightId && visible.find(d => pid(d) === hoverId);
  if (hv) {
    ctx.beginPath(); ctx.arc(xS(hv.x), yS(hv.y), r + 2.5*fs, 0, Math.PI*2);
    ctx.strokeStyle = T.hl; ctx.lineWidth = 1.5*fs; ctx.stroke();
  }

  // ── Export frame: title block, right-aligned legend, footer ──────────────
  if (forExport) {
    ctx.textAlign = 'left';
    ctx.fillStyle = T.title; ctx.font = `700 46px ${FONT}`; ctx.fillText(title, pad.l, 72);
    ctx.fillStyle = T.sub; ctx.font = `500 24px ${FONT}`; ctx.fillText(subtitle, pad.l, 108);
    ctx.font = `600 21px ${FONT}`;
    head.rows.forEach((row, i) => {
      const rowW = row.reduce((a, x) => a + x.w, 0) + head.GAP * (row.length - 1);
      let x = head.beside ? head.right - rowW : pad.l;
      const cy = head.legendTop + i*32;
      for (const { it, txt, w } of row) {
        ctx.beginPath(); ctx.arc(x + 9, cy, 9, 0, Math.PI*2); ctx.fillStyle = it.color; ctx.fill();
        ctx.strokeStyle = T.ring; ctx.lineWidth = T.ringW*1.5; ctx.stroke();
        ctx.fillStyle = T.legendText; ctx.fillText(txt, x + 26, cy + 7);
        x += w + head.GAP;
      }
    });
    ctx.strokeStyle = T.rule; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad.l, head.ruleY); ctx.lineTo(pad.l + pw, head.ruleY); ctx.stroke();
    ctx.fillStyle = T.footer; ctx.font = `500 19px ${FONT}`; ctx.fillText(footer, pad.l, H - 28);
  }
  return L;
}

// ── Median helpers (non-score axes) ──────────────────────────────────────────
const medianOf = arr => {
  const v = [...arr].sort((a, b) => a - b), n = v.length;
  return n ? (n % 2 ? v[(n - 1) / 2] : (v[n/2 - 1] + v[n/2]) / 2) : null;
};
const baseName = f => f.short || shortLabel(f.label).replace(/ \(percentile\)$/, '');
// Does "up" on this axis mean MORE of the real quantity? Not for a lower-is-better
// metric shown as a percentile: the pipeline already flipped those (high pct = fewer
// goals against), so up = less.
const upIsMore = f => !(f.pctDomain && f.pctInverted);
// Is "up" the better side of this axis?
const upIsGood = f => (upIsMore(f) ? !f.lowerBetter : !!f.lowerBetter);
// Plain-English phrase for one side of an axis, describing the real quantity.
const sidePhrase = (f, up) => {
  const more = up === upIsMore(f);
  return f.words ? f.words[more ? 0 : 1] : `${more ? 'High' : 'Low'} ${baseName(f)}`;
};
// Median quadrant names. Each corner names the axes it is better on (or, for the
// corner that is worse on both, describes both), so a low-xG-Against corner reads
// "Low xG Against", never a technically-true-but-backwards "High xG Against".
export function medianQuadrant(xf, yf, mx, my) {
  const names = {}, alt = {}, tint = {};
  for (const [key, top, right] of [['tr', true, true], ['tl', true, false], ['br', false, true], ['bl', false, false]]) {
    const yGood = top === upIsGood(yf), xGood = right === upIsGood(xf);
    const wy = sidePhrase(yf, top), wx = sidePhrase(xf, right);
    const join = () => {
      const [a, b] = [wy.split(' '), wx.split(' ')];
      return !yf.words && !xf.words && a[0] === b[0] ? `${a[0]} ${baseName(yf)} & ${baseName(xf)}` : `${wy} & ${wx}`;
    };
    names[key] = yGood && !xGood ? wy : xGood && !yGood ? wx : join();
    alt[key] = yGood && xGood ? 'Above both' : !yGood && !xGood ? 'Below both' : `Above ${yGood ? baseName(yf) : baseName(xf)}`;
    tint[key] = yGood && xGood ? 'best' : xGood ? 'x' : yGood ? 'y' : null;
  }
  return { xSplit: mx, ySplit: my, names, alt, tint, median: true };
}

const GROUP_RED = '#ef4444';
const GROUP_OUT = '#94a3b8';
const OPS = { le: ['≤', (a, b) => a <= b], eq: ['=', (a, b) => a === b], ge: ['≥', (a, b) => a >= b] };

// ── Player score quadrants (both axes scores) ────────────────────────────────
// The current-level axis splits at the target band; the potential axis one band
// higher (potential >= current for every player, so an equal split would leave one
// quadrant permanently empty). Auto target = the band cutoff closest to the median
// current score on the plot.
function playerScoreQuad(xf, yf, topPts, targetMin) {
  if (!xf.scoreScale || !yf.scoreScale || !topPts.length) return null;
  const xPot = POTENTIAL_KEYS.has(xf.key) && CURRENT_KEYS.has(yf.key);
  const yPot = POTENTIAL_KEYS.has(yf.key) && CURRENT_KEYS.has(xf.key);
  const cur = yPot ? 'x' : 'y';
  const vals = topPts.map(d => d[cur]).sort((a, b) => a - b), med = vals[Math.floor(vals.length / 2)];
  const autoTier = TARGET_TIERS.reduce((best, t) => Math.abs(t.min - med) < Math.abs(best.min - med) ? t : best, TARGET_TIERS[0]);
  const target = TARGET_TIERS.find(t => t.min === targetMin) || autoTier;
  const i = CHART_TIERS.indexOf(target), next = i > 0 ? CHART_TIERS[i - 1] : target;
  const pair = xPot || yPot, potSplit = pair ? next.min : target.min;
  const names = xPot ? { tr:'The Best', tl:'Peaked', br:'High Ceiling', bl:'Mid' }
    : yPot ? { tr:'The Best', tl:'High Ceiling', br:'Peaked', bl:'Mid' }
    : { tr:'High on both', tl:`High ${shortLabel(yf.label)}`, br:`High ${shortLabel(xf.label)}`, bl:'Below target' };
  return { xSplit: xPot ? potSplit : target.min, ySplit: yPot ? potSplit : target.min, names, target, autoTier, next, pair };
}

// ── Shared chart view ────────────────────────────────────────────────────────
// Everything interactive about the scatter chart, for any kind of item (players,
// teams). The page-specific parts come in as props: the axis fields, colour modes,
// tooltip lines, group-highlight conditions, and what a double-click opens.
export function ScatterView({ items, idOf, nameOf, subOf, tooltipLines, buildFields: buildFieldsFor, defaultX, defaultY,
  metricLabel = 'Per-90 value', colorModes, colorOf: colorOfMode, legendBase, scoreQuad, targetTiers, groups = [],
  noun = 'player', openLabel = 'Open profile', onSelect, onClose, contextLabel }) {
  const isMobile = useIsMobile();
  const [n, setN] = useState(50);
  const [xKey, setXKey] = useState(defaultX);
  const [yKey, setYKey] = useState(defaultY);
  const [metricMode, setMetricMode] = useState('val'); // 'val' (raw / per-90 value) | 'pct' (percentile)
  const [colorBy, setColorBy] = useState(colorModes[0][0]);
  const [showNames, setShowNames] = useState(true);
  const [hidden, setHidden] = useState(() => new Set());
  const [hover, setHover] = useState(null); // {d, left, top}
  const [highlightId, setHighlightId] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportTheme, setExportTheme] = useState('dark'); // 'dark' | 'light'
  const [customTitle, setCustomTitle] = useState('');
  const [trimLow, setTrimLow] = useState(false);
  const [targetMin, setTargetMin] = useState(null); // score-quadrant target level; null = auto
  const [exportLegend, setExportLegend] = useState(false); // band/position counts in the export header
  const [soloLabel, setSoloLabel] = useState(false); // single-highlight mode: only the highlighted item is named
  const [excluded, setExcluded] = useState(() => new Set()); // items removed from the plot by hand
  const [medianOn, setMedianOn] = useState(true); // median lines + median quadrants on non-score axes
  const [groupKey, setGroupKey] = useState('off'); // group highlight: 'off' | a groups[].key
  const [groupOp, setGroupOp] = useState('le');
  const [groupNum, setGroupNum] = useState(null);
  const [groupChoice, setGroupChoice] = useState('');
  const [width, setWidth] = useState(900);
  const wrapRef = useRef(null), canvasRef = useRef(null), layoutRef = useRef(null);
  const H = isMobile ? 400 : 580;
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  const fields = useMemo(() => buildFieldsFor(metricMode), [buildFieldsFor, metricMode]);
  const xf = fields.find(f => f.key === xKey) || fields[0];
  const yf = fields.find(f => f.key === yKey) || fields[0];
  useEffect(() => { if (!colorModes.some(m => m[0] === colorBy)) setColorBy(colorModes[0][0]); }, [colorModes, colorBy]);

  const groupDef = groups.find(g => g.key === groupKey) || null;
  useEffect(() => { setHidden(new Set()); }, [colorBy, groupKey]);
  useEffect(() => { if (groupDef?.kind === 'number' && groupNum == null) setGroupNum(groupDef.def); }, [groupDef, groupNum]);

  const rankById = useMemo(() => new Map(items.map((p, i) => [idOf(p), i + 1])), [items, idOf]);
  useEffect(() => { if (highlightId != null && !rankById.has(highlightId)) setHighlightId(null); }, [rankById, highlightId]);

  const sample = useMemo(() => items.slice(0, Math.max(1, n)), [items, n]);
  const top = useMemo(() => (excluded.size ? sample.filter(p => !excluded.has(idOf(p))) : sample), [sample, excluded, idOf]);
  const removedHere = sample.length - top.length;

  // Group highlight: Sample-only membership test.
  const inGroup = useMemo(() => {
    if (!groupDef) return null;
    if (groupDef.kind === 'number') {
      const [, cmp] = OPS[groupOp];
      return p => { const v = groupDef.get(p); return Number.isFinite(v) && groupNum != null && cmp(v, groupNum); };
    }
    return p => !!groupChoice && groupDef.valueOf(p) === groupChoice;
  }, [groupDef, groupOp, groupNum, groupChoice]);
  const groupChoices = useMemo(() => {
    if (groupDef?.kind !== 'choice') return [];
    const c = new Map();
    for (const p of top) { const v = groupDef.valueOf(p); if (v) c.set(v, (c.get(v) || 0) + 1); }
    return [...c.entries()].map(([value, count]) => ({ value, count, label: groupDef.labelOf(value) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [groupDef, top]);
  const groupLabel = !groupDef ? '' : groupDef.kind === 'number' ? `${groupDef.label} ${OPS[groupOp][0]} ${groupNum ?? ''}` : (groupChoice ? groupDef.labelOf(groupChoice) : groupDef.label);

  const colorOf = useCallback(p => {
    if (inGroup) return inGroup(p) ? { g: 'in', color: GROUP_RED } : { g: 'out', color: GROUP_OUT, muted: true };
    return colorOfMode(p, colorBy);
  }, [inGroup, colorOfMode, colorBy]);

  const toPoint = useCallback((p, extra) => ({ p, id: idOf(p), name: nameOf(p), x: xf.get(p), y: yf.get(p), rank: rankById.get(idOf(p)), extra, ...colorOf(p) }),
    [xf, yf, rankById, colorOf, idOf, nameOf]);
  const allTopPts = useMemo(() => top.map(p => toPoint(p, false)).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y)), [top, toPoint]);
  // "Hide low outliers": same rule as PlayerCard's squad chart — drop points more
  // than 2 SD below the mean, checked on each axis (only with 5+ points).
  const topPts = useMemo(() => {
    if (!trimLow || allTopPts.length <= 4) return allTopPts;
    const floor = k => { const v = allTopPts.map(d => d[k]), m = v.reduce((a, b) => a + b, 0) / v.length;
      return m - 2 * Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
    const fx = floor('x'), fy = floor('y');
    return allTopPts.filter(d => d.x >= fx && d.y >= fy);
  }, [allTopPts, trimLow]);
  const trimmed = allTopPts.length - topPts.length;

  // Medians of the PLOTTED items, on each non-score axis — of whatever the axis
  // shows (raw value or percentile).
  const median = useMemo(() => {
    if (!medianOn || !topPts.length || (xf.scoreScale && yf.scoreScale)) return null;
    const mx = xf.scoreScale ? null : medianOf(topPts.map(d => d.x)), my = yf.scoreScale ? null : medianOf(topPts.map(d => d.y));
    return { x: mx, y: my, xText: mx == null ? '' : valueText(mx, xf), yText: my == null ? '' : valueText(my, yf) };
  }, [medianOn, topPts, xf, yf]);
  const sQuad = useMemo(() => (scoreQuad ? scoreQuad(xf, yf, topPts, targetMin) : null), [scoreQuad, xf, yf, topPts, targetMin]);
  const quad = sQuad || (median && median.x != null && median.y != null ? medianQuadrant(xf, yf, median.x, median.y) : null);
  const quadNote = sQuad ? `quadrants: ${shortLabel(yf.label)} ≥ ${sQuad.ySplit} · ${shortLabel(xf.label)} ≥ ${sQuad.xSplit}`
    : median ? `median${median.x != null && median.y != null ? 's' : ''}: ${[median.y != null && `${baseName(yf)} ${median.yText}`, median.x != null && `${baseName(xf)} ${median.xText}`].filter(Boolean).join(' · ')}` : '';

  const hlItem = useMemo(() => (highlightId == null ? null : items.find(p => idOf(p) === highlightId) || null), [items, highlightId, idOf]);
  const pts = useMemo(() => {
    if (!hlItem || excluded.has(idOf(hlItem)) || topPts.some(d => d.id === idOf(hlItem))) return topPts;
    const d = toPoint(hlItem, true);
    return Number.isFinite(d.x) && Number.isFinite(d.y) ? [...topPts, d] : topPts;
  }, [topPts, hlItem, toPoint, excluded, idOf]);
  const hlPoint = hlItem ? pts.find(d => d.id === idOf(hlItem)) : null;

  const legend = useMemo(() => {
    const c = {}; topPts.forEach(d => { c[d.g] = (c[d.g] || 0) + 1; });
    const base = inGroup ? [{ key: 'in', label: groupLabel, color: GROUP_RED }, { key: 'out', label: 'Others', color: GROUP_OUT }] : legendBase(colorBy);
    return base.filter(it => c[it.key]).map(it => ({ ...it, count: c[it.key] }));
  }, [topPts, colorBy, inGroup, groupLabel, legendBase]);
  const groupCount = inGroup ? topPts.filter(d => d.g === 'in').length : 0;

  const colorLabel = colorModes.find(o => o[0] === colorBy)?.[1] || colorModes[0][1];
  const autoTitle = `${yf.label} vs ${xf.label}`;
  const title = customTitle.trim() || autoTitle;
  const subtitle = `${sample.length} Sample · ${contextLabel}${inGroup ? ` · highlighted: ${groupLabel} (${groupCount})` : ''}${hlPoint ? ` · highlighted: ${hlPoint.name}` : ''}`;

  useEffect(() => {
    const measure = () => { const w = wrapRef.current?.offsetWidth; if (w) setWidth(w); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const drawOpts = { pts, xf, yf, hidden, highlightId, showNames, soloLabel, quad, median, group: !!inGroup };
  useEffect(() => {
    if (!canvasRef.current) return;
    layoutRef.current = drawScatter(canvasRef.current, width, H, window.devicePixelRatio || 1, false, { ...drawOpts, hoverId: hover?.d.id });
  }, [pts, xf, yf, hidden, hover, highlightId, showNames, soloLabel, quad, median, inGroup, width, H]);

  useEffect(() => {
    if (highlightId == null) return;
    const onKey = e => { if (e.key === 'Escape') setHighlightId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [highlightId]);

  const hitTest = useCallback(e => {
    const L = layoutRef.current, c = canvasRef.current;
    if (!L || !c) return null;
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bestD = 12 * 12; // hit target larger than the dot
    for (const d of pts) {
      if (hidden.has(d.g) && d.id !== highlightId) continue;
      const dx = L.xS(d.x) - mx, dy = L.yS(d.y) - my, dd = dx*dx + dy*dy;
      if (dd <= bestD) { bestD = dd; best = d; }
    }
    return best ? { d: best, left: L.xS(best.x), top: L.yS(best.y) } : null;
  }, [pts, hidden, highlightId]);

  const onMove = e => {
    const h = hitTest(e);
    if ((h?.d.id ?? null) !== (hover?.d.id ?? null)) setHover(h);
    e.currentTarget.style.cursor = h ? 'pointer' : 'default';
  };
  // Single click highlights (background click clears); double click opens the card.
  const onClick = e => { const h = hitTest(e); setHighlightId(h ? h.d.id : null); };
  const onDoubleClick = e => { const h = hitTest(e); if (h) onSelect(h.d.p); };

  const download = async () => {
    setBusy(true);
    try {
      await ensureMontserratEmbedded();
      const slug = t => t.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
      const base = customTitle.trim() ? slug(customTitle) : `scatter_${slug(yf.label)}_vs_${slug(xf.label)}`;
      const date = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
      const bandsNote = (xf.scoreScale || yf.scoreScale) ? 'dashed lines = Scout Index level bands' : '';
      const footer = ['Scout Index · ' + date, quadNote, sQuad ? bandsNote : (xf.scoreScale || yf.scoreScale) ? 'shaded zones / dashed lines = Scout Index level bands' : ''].filter(Boolean).join(' · ');
      const off = document.createElement('canvas');
      drawScatter(off, EXPORT_W, EXPORT_H, 1, true, { ...drawOpts, hoverId: null, title, subtitle, footer, legend: exportLegend ? legend : [], theme: exportTheme });
      await deliverPng(off.toDataURL('image/png'), `${base}_${exportTheme}.png`);
    } finally { setBusy(false); }
  };

  const toggleGroup = g => setHidden(prev => { const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s; });
  const swap = () => { setXKey(yKey); setYKey(xKey); };

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    const out = [];
    for (let i = 0; i < items.length && out.length < 8; i++) {
      const p = items[i];
      if (norm(nameOf(p)).includes(q)) out.push({ p, rank: i + 1 });
    }
    return out;
  }, [items, query, nameOf]);
  const pick = p => { setExcluded(prev => { if (!prev.has(idOf(p))) return prev; const s = new Set(prev); s.delete(idOf(p)); return s; }); setHighlightId(idOf(p)); setQuery(''); };
  const removedItems = useMemo(() => items.filter(p => excluded.has(idOf(p))), [items, excluded, idOf]);

  const fieldGroups = [...new Set(fields.map(f => f.group))];
  const sel = { background:'#0d1220', border:'1px solid #1e2d45', borderRadius:5, color:'#e2e8f4', padding:'5px 6px', fontSize:11, outline:'none', minWidth:0, maxWidth:isMobile?'100%':230 };
  const btn = on => ({ padding:'5px 10px', borderRadius:5, border:`1px solid ${on?'#3b7de8':'#1e2d45'}`, background:on?'#0e2040':'#0d1624', color:on?'#93c5fd':'#94a3b8', fontSize:10.5, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' });
  const lbl = { fontSize:9, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' };
  const col = { display:'flex', flexDirection:'column', gap:3 };
  const fieldSelect = (value, onChange, aria) => (
    <select aria-label={aria} style={sel} value={value} onChange={e => onChange(e.target.value)}>
      {fieldGroups.map(g => <optgroup key={g} label={g}>{fields.filter(f => f.group === g).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>)}
    </select>
  );
  const missing = top.length - allTopPts.length;
  const usesMetric = xf.metric || yf.metric;
  const hasNonScore = !xf.scoreScale || !yf.scoreScale;
  const [tip1, tip2] = hover ? tooltipLines(hover.d.p) : [];

  return (
    <div style={{ flex:1, overflow:'auto', padding:isMobile?'10px 12px 80px':'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:10 }}>
        <label style={col}><span style={lbl}>Y axis</span>{fieldSelect(yKey, setYKey, 'Y axis')}</label>
        <button title="Swap axes" onClick={swap} style={btn(false)}>⇄</button>
        <label style={col}><span style={lbl}>X axis</span>{fieldSelect(xKey, setXKey, 'X axis')}</label>
        <label style={col}><span style={lbl}>Sample</span>
          <input aria-label="Sample size" type="number" min={1} max={1000} value={n} onChange={e => setN(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            style={{ ...sel, width:70 }}/>
        </label>
        <label style={col}><span style={lbl}>Colour by</span>
          <select aria-label="Colour by" style={{ ...sel, opacity: inGroup ? 0.5 : 1 }} value={colorBy} onChange={e => setColorBy(e.target.value)} title={inGroup ? 'Group highlight is overriding colours' : ''}>
            {colorModes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {groups.length > 0 && (
          <label style={col}><span style={lbl}>Group</span>
            <div style={{ display:'flex', gap:4 }}>
              <select aria-label="Group" style={sel} value={groupKey} onChange={e => { setGroupKey(e.target.value); setGroupChoice(''); setGroupNum(null); }}>
                <option value="off">Off</option>
                {groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
              {groupDef?.kind === 'number' && (<>
                <select aria-label="Group condition" style={{ ...sel, width:48 }} value={groupOp} onChange={e => setGroupOp(e.target.value)}>
                  {Object.entries(OPS).map(([k, [sym]]) => <option key={k} value={k}>{sym}</option>)}
                </select>
                <input aria-label="Group value" type="number" step={groupDef.step || 1} value={groupNum ?? ''} onChange={e => setGroupNum(e.target.value === '' ? null : Number(e.target.value))} style={{ ...sel, width:60 }}/>
              </>)}
              {groupDef?.kind === 'choice' && (
                <select aria-label="Group value" style={sel} value={groupChoice} onChange={e => setGroupChoice(e.target.value)}>
                  <option value="">Pick {groupDef.label.toLowerCase()}…</option>
                  {groupChoices.map(o => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                </select>
              )}
            </div>
          </label>
        )}
        {sQuad && targetTiers && (
          <label style={col}><span style={lbl}>Target level</span>
            <select aria-label="Target level" style={sel} value={targetMin ?? ''} onChange={e => setTargetMin(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Auto ({sQuad.autoTier.short} {sQuad.autoTier.min})</option>
              {targetTiers.map(t => <option key={t.min} value={t.min}>{t.short} ({t.min})</option>)}
            </select>
          </label>
        )}
        {usesMetric && (
          <div style={{ display:'flex', gap:3 }}>
            <button style={btn(metricMode==='val')} onClick={() => setMetricMode('val')}>{metricLabel}</button>
            <button style={btn(metricMode==='pct')} onClick={() => setMetricMode('pct')}>Percentile</button>
          </div>
        )}
        <button style={btn(showNames)} onClick={() => setShowNames(s => !s)}>Names</button>
        {hasNonScore && <button style={btn(medianOn)} aria-pressed={medianOn} title="Median line on each non-score axis; median quadrants when neither axis is a score" onClick={() => setMedianOn(v => !v)}>Median split</button>}
        <button style={btn(soloLabel)} aria-pressed={soloLabel} title={`When a ${noun} is highlighted, name only them`} onClick={() => setSoloLabel(v => !v)}>Single highlight</button>
        <button style={btn(exportLegend)} aria-pressed={exportLegend} title="Show the colour legend with counts in the downloaded image" onClick={() => setExportLegend(v => !v)}>Legend in export</button>
        <button style={btn(trimLow)} aria-pressed={trimLow} title="Hide points more than 2 SD below the mean on either axis" onClick={() => setTrimLow(v => !v)}>Hide low outliers</button>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          {onClose && <button style={btn(false)} onClick={onClose}>☰ Table</button>}
          <div style={{ display:'flex', gap:0 }}>
            {['dark', 'light'].map((t, i) => (
              <button key={t} aria-pressed={exportTheme === t} onClick={() => setExportTheme(t)}
                style={{ ...btn(exportTheme === t), borderRadius: i ? '0 5px 5px 0' : '5px 0 0 5px' }}>{t === 'dark' ? 'Dark' : 'Light'}</button>
            ))}
          </div>
          <button style={btn(false)} onClick={download} disabled={!pts.length || busy}>{busy ? 'Exporting…' : '⬇ Download PNG'}</button>
        </div>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8 }}>
        <div style={{ position:'relative' }}>
          <input aria-label={`Highlight ${noun}`} placeholder={`Highlight a ${noun}…`} value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches[0]) pick(matches[0].p); }}
            style={{ ...sel, width:isMobile?200:240, padding:'6px 8px' }}/>
          {matches.length > 0 && (
            <div role="listbox" style={{ position:'absolute', top:'100%', left:0, marginTop:3, width:320, background:'#0d1220', border:'1px solid #26456f', borderRadius:6, zIndex:20, boxShadow:'0 6px 20px rgba(0,0,0,.5)' }}>
              {matches.map(({ p, rank }) => (
                <button key={idOf(p)} role="option" aria-selected={false} onClick={() => pick(p)}
                  style={{ display:'flex', width:'100%', gap:8, alignItems:'baseline', padding:'6px 10px', background:'none', border:'none', borderBottom:'1px solid #111c2e', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:11.5, color:'#e2e8f4', fontWeight:600 }}>{nameOf(p)}</span>
                  <span style={{ fontSize:10, color:'#64748b', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subOf(p)}</span>
                  <span style={{ fontSize:10, color: rank <= n ? '#93c5fd' : '#94a3b8' }}>#{rank}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input aria-label="Chart title" placeholder={`Title: ${autoTitle}`} value={customTitle} onChange={e => setCustomTitle(e.target.value)}
          style={{ ...sel, width:isMobile?200:280, padding:'6px 8px', maxWidth:'100%' }}/>
        {hlItem && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 6px 4px 10px', borderRadius:14, border:'1px solid #26456f', background:'#0e2040' }}>
            <span style={{ fontSize:11, color:'#dbeafe' }}>
              <b>{nameOf(hlItem)}</b> · {subOf(hlItem)} · #{rankById.get(idOf(hlItem))}
              {!hlPoint ? ' · no data for these axes' : !hlPoint.extra ? '' : hlPoint.rank <= sample.length ? ' · low outlier, shown because highlighted' : ` · outside the ${sample.length} Sample`}
            </span>
            <button onClick={() => onSelect(hlItem)} style={{ ...btn(false), padding:'3px 8px' }}>{openLabel}</button>
            <button onClick={() => { setExcluded(prev => new Set(prev).add(idOf(hlItem))); setHighlightId(null); }} style={{ ...btn(false), padding:'3px 8px' }}>Remove from plot</button>
            <button aria-label="Clear highlight" onClick={() => setHighlightId(null)} style={{ ...btn(false), padding:'3px 8px' }}>✕</button>
          </div>
        )}
      </div>

      {removedItems.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, fontSize:10.5, color:'#94a3b8' }}>
          <span style={lbl}>Removed</span>
          {removedItems.map(p => (
            <button key={idOf(p)} title="Put back on the plot" onClick={() => setExcluded(prev => { const s = new Set(prev); s.delete(idOf(p)); return s; })}
              style={{ ...btn(false), padding:'2px 8px' }}>{nameOf(p)} ↺</button>
          ))}
          <button onClick={() => setExcluded(new Set())} style={{ ...btn(false), padding:'2px 8px' }}>Restore all</button>
        </div>
      )}

      <div ref={wrapRef} style={{ position:'relative', width:'100%' }} onMouseLeave={() => setHover(null)}>
        <canvas ref={canvasRef} onMouseMove={onMove} onClick={onClick} onDoubleClick={onDoubleClick} style={{ display:'block', borderRadius:6 }}/>
        {!pts.length && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:12, textAlign:'center', padding:20 }}>
            {top.length ? `None of the ${sample.length} Sample have data for ${yf.label} and ${xf.label}.` : sample.length ? `Every ${noun} in the Sample has been removed.` : `No ${noun}s match the current filters.`}
          </div>
        )}
        {hover && (
          <div role="tooltip" style={{ position:'absolute', left:Math.min(hover.left + 12, width - 230), top:Math.max(0, hover.top - 70), width:215, pointerEvents:'none',
            background:'#0d1220', border:'1px solid #26456f', borderRadius:6, padding:'8px 10px', boxShadow:'0 6px 20px rgba(0,0,0,.5)', zIndex:5 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:hover.d.color, flexShrink:0 }}/>
              <span style={{ fontSize:12, fontWeight:700, color:'#f8fafc' }}>{hover.d.name}</span>
            </div>
            <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>{tip1}</div>
            <div style={{ fontSize:10.5, color:'#94a3b8' }}>{tip2} · #{hover.d.rank}</div>
            <div style={{ fontSize:10.5, color:'#e2e8f4', marginTop:4 }}>{yf.label}: <b>{valueText(hover.d.y, yf)}</b></div>
            <div style={{ fontSize:10.5, color:'#e2e8f4' }}>{xf.label}: <b>{valueText(hover.d.x, xf)}</b></div>
            {quad && <div style={{ fontSize:10.5, color:'#5eead4', marginTop:3, fontWeight:600 }}>{quadOf(quad, hover.d)}</div>}
            <div style={{ fontSize:9.5, color:'#64748b', marginTop:4 }}>Click to highlight · double-click for {noun === 'team' ? 'team card' : 'profile'}</div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'6px 12px' }}>
        {(inGroup || colorBy !== colorModes[0][0]) && <span style={{ ...lbl, marginRight:2 }}>{inGroup ? 'Group' : colorLabel}</span>}
        {legend.map(it => (
          <button key={it.key} onClick={() => toggleGroup(it.key)} title={hidden.has(it.key) ? 'Show' : 'Hide'}
            style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:0, opacity:hidden.has(it.key) ? 0.4 : 1 }}>
            <span style={{ width:9, height:9, borderRadius:'50%', background:it.color }}/>
            <span style={{ fontSize:11, color:'#cbd5e1', textDecoration:hidden.has(it.key) ? 'line-through' : 'none' }}>{it.label} <span style={{ color:'#64748b' }}>{it.count}</span></span>
          </button>
        ))}
        <span style={{ fontSize:10, color:'#64748b', marginLeft:'auto' }}>
          {sample.length} Sample · {topPts.length} plotted{removedHere > 0 ? ` · ${removedHere} removed` : ''}{missing > 0 ? ` · ${missing} without data for these axes` : ''}{trimmed > 0 ? ` · ${trimmed} low outlier${trimmed > 1 ? 's' : ''} hidden` : ''}
          {quadNote ? ` · ${quadNote}` : ''}{!sQuad && (xf.scoreScale || yf.scoreScale) ? ' · shaded zones = level bands' : ''}
        </span>
      </div>
    </div>
  );
}

// ── Player chart (Scout Index) ───────────────────────────────────────────────
const PLAYER_GROUPS = [
  { key:'age', label:'Age', kind:'number', get:p => p.age, def:21 },
  { key:'team', label:'Team', kind:'choice', valueOf:p => (p.team ? `${p.team}|${p.league}` : ''),
    labelOf:v => { const [t, l] = v.split('|'); return `${t} (${l})`; } },
];
const playerId = p => p.id, playerName = p => p.name, playerSub = p => p.team;
const playerTip = p => [`${p.team} · ${p.league}`, `${p.position} · age ${p.age}`];
const playerLegendBase = mode => (mode === 'position'
  ? [...POS_ORDER, 'Other'].map(g => ({ key: g, label: g, color: POS_COLORS[g] || OTHER_COLOR }))
  : [...SCORE_BUCKETS, { key: 'none', label: 'No data', color: NODATA_COLOR }]);

export default function ScatterChart({ players, getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode, onSelect, onClose, contextLabel }) {
  const buildFieldsFor = useCallback(metricMode => buildFields({ getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode, metricMode }),
    [getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode]);
  const displayIsScore = !rawMode && !outlierMode;
  const colorModes = useMemo(() => [
    ['position', 'Position'], ['careerScore', 'Career score'], ['potentialScore', 'Potential'],
    ...(displayIsScore ? [['display', `Table score · ${tableScoreLabel({ seasonFilter, scoreMode, rawMode, outlierMode })}`]] : []),
  ], [displayIsScore, seasonFilter, scoreMode, rawMode, outlierMode]);
  const colorOf = useCallback((p, mode) => {
    if (mode === 'position') return POS_COLORS[p.roleKey] ? { g: p.roleKey, color: POS_COLORS[p.roleKey] } : { g: 'Other', color: OTHER_COLOR };
    const v = mode === 'display' ? getDisplayScore(p) : p[mode];
    return Number.isFinite(v) ? { g: scoreBucketKey(v), color: scoreDotColor(v) } : { g: 'none', color: NODATA_COLOR };
  }, [getDisplayScore]);
  return (
    <ScatterView items={players} idOf={playerId} nameOf={playerName} subOf={playerSub} tooltipLines={playerTip}
      buildFields={buildFieldsFor} defaultX="potentialScore" defaultY="careerScore" metricLabel="Per-90 value"
      colorModes={colorModes} colorOf={colorOf} legendBase={playerLegendBase} scoreQuad={playerScoreQuad} targetTiers={TARGET_TIERS}
      groups={PLAYER_GROUPS} noun="player" openLabel="Open profile" onSelect={onSelect} onClose={onClose} contextLabel={contextLabel}/>
  );
}
