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
    grid:'rgba(148,163,184,0.09)', band:'rgba(148,163,184,0.32)', axis:'#2a3950', tick:'#7c8699',
    axisTitle:'#cbd5e1', title:'#f8fafc', sub:'#94a3b8', zoneText:'rgba(203,213,225,0.45)',
    label:'#e5e7eb', halo:'rgba(6,11,20,0.92)', ring:'#060b14', ringW:1.6, hl:'#ffffff',
    leader:'rgba(148,163,184,0.55)', legendText:'#cbd5e1', rule:'#1e293b', footer:'#64748b',
  },
  light: {
    bg:'#ffffff', plot:'#fbfcfe', zone:'30,41,59', zoneBase:0.008, zoneStep:0.018,
    grid:'rgba(15,23,42,0.06)', band:'rgba(71,85,105,0.38)', axis:'#94a3b8', tick:'#64748b',
    axisTitle:'#1e293b', title:'#0f172a', sub:'#475569', zoneText:'rgba(51,65,85,0.55)',
    label:'#0f172a', halo:'rgba(255,255,255,0.94)', ring:'rgba(15,23,42,0.6)', ringW:1.1, hl:'#0f172a',
    leader:'rgba(71,85,105,0.6)', legendText:'#1e293b', rule:'#e2e8f0', footer:'#64748b',
  },
};

const money = v => v >= 1e6 ? `£${(v/1e6).toFixed(1)}m` : `£${Math.round(v/1e3)}k`;
const posOrNull = v => (v != null && v > 0 ? v : null);
const tierShort = min => SCORE_TIERS.find(t => t.min === min)?.short || String(min);
const tierAt = v => SCORE_TIERS.find(t => v >= t.min);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Score-colour legend buckets, one per SCORE_DOT_STEPS cutoff plus "below".
const SCORE_BUCKETS = [
  ...SCORE_DOT_STEPS.map((s, i) => ({ key:'s'+s.min, color:s.color,
    label:`${tierShort(s.min)} ${s.min}${i ? '–' + SCORE_DOT_STEPS[i-1].min : '+'}` })),
  { key:'slow', color:SCORE_DOT_LOW, label:`Below ${SCORE_DOT_STEPS[SCORE_DOT_STEPS.length-1].min}` },
];
const scoreBucketKey = v => { const s = SCORE_DOT_STEPS.find(t => v >= t.min); return s ? 's'+s.min : 'slow'; };

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
    { key:'display', group:'Score', label:tableScoreLabel(ctx), get:p=>ctx.getDisplayScore(p), scoreScale:!ctx.rawMode&&!ctx.outlierMode },
    { key:'careerScore', group:'Score', label:'Career score', get:p=>p.careerScore, scoreScale:true },
    { key:'peakScore', group:'Score', label:'Peak score', get:p=>p.peakScore, scoreScale:true },
    { key:'potentialScore', group:'Score', label:'Potential', get:p=>p.potentialScore, scoreScale:true },
    { key:'potentialCeiling', group:'Score', label:'Potential ceiling', get:p=>p.potentialCeiling, scoreScale:true },
    { key:'xValue', group:'Value', label:'xValue', get:p=>posOrNull(p.xValue), fmt:money },
    { key:'marketValue', group:'Value', label:'Market value', get:p=>posOrNull(p.marketValue), fmt:money },
    { key:'xValueGapPct', group:'Value', label:'Value gap %', get:p=>p.xValueGapPct },
    { key:'age', group:'Profile', label:'Age', get:p=>p.age },
    { key:'height', group:'Profile', label:'Height (cm)', get:p=>posOrNull(p.height) },
    { key:'minutes', group:'Profile', label:`Minutes (${ctx.seasonFilter==='all'?'latest season':ctx.seasonFilter})`, get:p=>seasonDetailFor(p,ctx.seasonFilter)?.minutes ?? null },
    { key:'seasons', group:'Profile', label:'Seasons', get:p=>p.seasons },
    { key:'gbeTotal', group:'Profile', label:'GBE points', get:p=>p.gbeTotal },
  ];
  const seasonTag = ctx.seasonFilter === 'all' ? 'latest' : ctx.seasonFilter;
  for (const m of [...METRIC_OPTIONS, ...METRIC_OPTIONS_EXTRA]) {
    f.push({
      key:'m:'+m.key, group:`Per-90 metrics (${seasonTag})`, metric:true,
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
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}
function axisDomain(vals, field) {
  if (field.pctDomain) return { lo:0, hi:100, step:20 };
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.06;
  const step = niceStep((hi - lo + 2*pad) / 5);
  return { lo: Math.floor((lo - pad) / step) * step, hi: Math.ceil((hi + pad) / step) * step, step };
}
function tickText(v, field, step) {
  if (field.fmt) return field.fmt(v);
  const dp = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  return v.toFixed(dp);
}
function valueText(v, field) {
  if (field.fmt) return field.fmt(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// Pure layout: scales + padding for a W x H canvas. Shared by drawing and hit-testing.
const EXPORT_PAD = { t:205, r:70, b:140, l:140 }, LEGEND_ROW = 34;
function computeLayout(W, H, forExport, pts, xf, yf, extraTop = 0) {
  const fs = forExport ? W / 800 : 1;
  const pad = forExport ? { ...EXPORT_PAD, t: EXPORT_PAD.t + extraTop } : { t:12, r:16, b:46, l:60 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const xd = axisDomain(pts.map(d => d.x), xf), yd = axisDomain(pts.map(d => d.y), yf);
  const xS = v => pad.l + ((v - xd.lo) / (xd.hi - xd.lo)) * pw;
  const yS = v => pad.t + ph - ((v - yd.lo) / (yd.hi - yd.lo)) * ph;
  // Shade along Y when Y is a score; otherwise along X if X is. A second score
  // axis keeps plain dashed band lines.
  const shade = yf.scoreScale ? 'y' : xf.scoreScale ? 'x' : null;
  return { fs, pad, pw, ph, xd, yd, xS, yS, shade, xLines: xf.scoreScale && shade !== 'x' };
}

// Greedy label placement: each label tries 8 positions round its dot at three
// distances (the outer two get a leader line), and takes the first spot clear
// of the plot edge, every dot, and every label already placed. Labels are fed in
// priority order; a `force` label (the highlighted player) always gets placed.
function placeLabels(ctx, items, dots, bounds, taken, fs) {
  const placed = [...taken];
  const DIRS = [[1,0],[-1,0],[0,-1],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]];
  const clear = b => b.x0 >= bounds.x0 && b.x1 <= bounds.x1 && b.y0 >= bounds.y0 && b.y1 <= bounds.y1
    && !placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)
    && !dots.some(o => o.x + o.r > b.x0 && o.x - o.r < b.x1 && o.y + o.r > b.y0 && o.y - o.r < b.y1);
  const out = [];
  for (const it of items) {
    ctx.font = it.font;
    const w = ctx.measureText(it.text).width + 4, h = it.px * 1.3;
    let choice = null;
    for (const extra of [0, 14*fs, 30*fs]) {
      for (const [dx, dy] of DIRS) {
        const k = dx && dy ? 0.75 : 1, dist = (it.r + 3*fs + extra) * k;
        const cx = it.x + dx*dist, cy = it.y + dy*dist;
        const x0 = dx > 0 ? cx : dx < 0 ? cx - w : cx - w/2;
        const y0 = dy > 0 ? cy : dy < 0 ? cy - h : cy - h/2;
        const b = { x0, y0, x1: x0 + w, y1: y0 + h };
        if (clear(b)) { choice = { b, leader: extra > 0 }; break; }
      }
      if (choice) break;
    }
    if (!choice && it.force) {
      const x0 = Math.min(it.x + it.r + 3*fs, bounds.x1 - w), y0 = Math.max(bounds.y0, it.y - h - it.r);
      choice = { b: { x0, y0, x1: x0 + w, y1: y0 + h }, leader: true };
    }
    if (!choice) continue;
    placed.push(choice.b);
    out.push({ ...it, box: choice.b, leader: choice.leader });
  }
  return out;
}

export function drawScatter(canvas, W, H, dpr, forExport, o) {
  const { pts, xf, yf, hidden, hoverId, highlightId, showNames, title, subtitle, footer, legend, theme: themeName = 'dark' } = o;
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

  // Export legend rows are measured first: a long legend (score buckets) wraps
  // onto extra rows and pushes the plot down rather than being cut off.
  const legendRows = [];
  if (forExport && legend && legend.length) {
    ctx.font = `600 21px ${FONT}`;
    let row = [], x = EXPORT_PAD.l;
    for (const it of legend) {
      const txt = `${it.label}  ${it.count}`, w = ctx.measureText(txt).width + 26;
      if (row.length && x + w > W - EXPORT_PAD.r) { legendRows.push(row); row = []; x = EXPORT_PAD.l; }
      row.push({ it, txt, x }); x += w + 44;
    }
    if (row.length) legendRows.push(row);
  }
  const extraTop = Math.max(0, legendRows.length - 1) * LEGEND_ROW;
  const L = computeLayout(W, H, forExport, pts, xf, yf, extraTop);
  const { fs, pad, pw, ph, xd, yd, xS, yS, shade } = L;
  const f = (px, weight = 400) => `${weight} ${px*fs}px ${FONT}`;
  ctx.fillStyle = T.plot; ctx.fillRect(pad.l, pad.t, pw, ph);
  const taken = []; // boxes name labels must avoid (zone + band labels)

  // ── Level-band zones: neutral shade that deepens one step per tier ──────
  if (shade) {
    const d = shade === 'y' ? yd : xd, S = shade === 'y' ? yS : xS;
    const cuts = SCORE_TIERS.map(t => t.min).filter(m => m > d.lo && m < d.hi).sort((a, b) => a - b);
    const edges = [d.lo, ...cuts, d.hi];
    for (let k = 0; k < edges.length - 1; k++) {
      const tier = tierAt(edges[k]);
      // One shade step per zone, counted up from the lowest zone on screen
      ctx.fillStyle = `rgba(${T.zone},${(T.zoneBase + k*T.zoneStep).toFixed(3)})`;
      const a = S(edges[k]), b = S(edges[k+1]);
      if (shade === 'y') ctx.fillRect(pad.l, b, pw, a - b); else ctx.fillRect(a, pad.t, b - a, ph);
      const name = (tier ? tier.short : 'Development').toUpperCase();
      ctx.font = f(8, 600); ctx.fillStyle = T.zoneText; ctx.textAlign = 'left';
      const tw = ctx.measureText(name).width;
      if (shade === 'y' && a - b >= 15*fs) {
        ctx.fillText(name, pad.l + 8*fs, b + 12*fs);
        taken.push({ x0: pad.l + 4*fs, y0: b + 2*fs, x1: pad.l + 12*fs + tw, y1: b + 15*fs });
      } else if (shade === 'x' && b - a >= tw + 12*fs) {
        ctx.fillText(name, a + 6*fs, pad.t + 12*fs);
        taken.push({ x0: a + 2*fs, y0: pad.t + 2*fs, x1: a + 10*fs + tw, y1: pad.t + 15*fs });
      }
    }
  }

  // ── Grid: plain lines only on axes without zone shading ─────────────────
  ctx.setLineDash([]); ctx.strokeStyle = T.grid; ctx.lineWidth = 1;
  if (shade !== 'y') for (let v = yd.lo + yd.step; v < yd.hi - 1e-9; v += yd.step) {
    ctx.beginPath(); ctx.moveTo(pad.l, yS(v)); ctx.lineTo(pad.l + pw, yS(v)); ctx.stroke();
  }
  if (shade !== 'x') for (let v = xd.lo + xd.step; v < xd.hi - 1e-9; v += xd.step) {
    ctx.beginPath(); ctx.moveTo(xS(v), pad.t); ctx.lineTo(xS(v), pad.t + ph); ctx.stroke();
  }

  // ── Dashed band lines: zone edges, plus a second score axis if present ───
  ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
  ctx.setLineDash([5*fs, 4*fs]); ctx.strokeStyle = T.band; ctx.lineWidth = forExport ? 2 : 1;
  for (const t of SCORE_TIERS) {
    if (shade === 'y' && t.min > yd.lo && t.min < yd.hi) { ctx.beginPath(); ctx.moveTo(pad.l, yS(t.min)); ctx.lineTo(pad.l + pw, yS(t.min)); ctx.stroke(); }
    if ((shade === 'x' || L.xLines) && t.min > xd.lo && t.min < xd.hi) { ctx.beginPath(); ctx.moveTo(xS(t.min), pad.t); ctx.lineTo(xS(t.min), pad.t + ph); ctx.stroke(); }
  }
  ctx.setLineDash([]);
  if (L.xLines) for (const t of SCORE_TIERS) {
    if (t.min <= xd.lo || t.min >= xd.hi) continue;
    const x = xS(t.min);
    ctx.save(); ctx.translate(x - 4*fs, pad.t + ph - 6*fs); ctx.rotate(-Math.PI/2);
    ctx.font = f(8, 600); ctx.fillStyle = T.zoneText; ctx.textAlign = 'left';
    const tw = ctx.measureText(t.short.toUpperCase()).width;
    ctx.fillText(t.short.toUpperCase(), 0, 0); ctx.restore();
    taken.push({ x0: x - 13*fs, y0: pad.t + ph - 6*fs - tw, x1: x - 2*fs, y1: pad.t + ph - 4*fs });
  }
  ctx.restore();

  // ── Axes, ticks, titles ──────────────────────────────────────────────────
  ctx.strokeStyle = T.axis; ctx.lineWidth = forExport ? 2 : 1;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph); ctx.stroke();
  ctx.font = f(10, 500); ctx.fillStyle = T.tick;
  ctx.textAlign = 'right';
  for (let v = yd.lo; v <= yd.hi + 1e-9; v += yd.step) {
    ctx.fillText(tickText(v, yf, yd.step), pad.l - 8*fs, yS(v) + 3.5*fs);
    ctx.beginPath(); ctx.moveTo(pad.l - 4*fs, yS(v)); ctx.lineTo(pad.l, yS(v)); ctx.stroke();
  }
  ctx.textAlign = 'center';
  for (let v = xd.lo; v <= xd.hi + 1e-9; v += xd.step) {
    ctx.fillText(tickText(v, xf, xd.step), xS(v), pad.t + ph + 17*fs);
    ctx.beginPath(); ctx.moveTo(xS(v), pad.t + ph); ctx.lineTo(xS(v), pad.t + ph + 4*fs); ctx.stroke();
  }
  ctx.font = f(10.5, 600); ctx.fillStyle = T.axisTitle; ctx.textAlign = 'center';
  ctx.fillText(xf.label, pad.l + pw/2, pad.t + ph + 36*fs);
  ctx.save(); ctx.translate(pad.l - 44*fs, pad.t + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText(yf.label, 0, 0); ctx.restore();

  // ── Dots ─────────────────────────────────────────────────────────────────
  const r = (pts.length > 200 ? 4 : 5.5) * fs;
  const hl = highlightId != null ? pts.find(d => d.p.id === highlightId) : null;
  const visible = pts.filter(d => d === hl || !hidden.has(d.g));
  const ringDot = (d, rad, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(xS(d.x), yS(d.y), rad, 0, Math.PI*2);
    ctx.fillStyle = d.color; ctx.fill();
    ctx.strokeStyle = T.ring; ctx.lineWidth = T.ringW*fs; ctx.stroke();
    ctx.globalAlpha = 1;
  };
  for (let i = visible.length - 1; i >= 0; i--) if (visible[i] !== hl) ringDot(visible[i], r, hl ? 0.25 : 0.95);

  // ── Name labels ──────────────────────────────────────────────────────────
  const dots = visible.map(d => ({ x: xS(d.x), y: yS(d.y), r: d === hl ? r*1.6 : r }));
  const bounds = { x0: pad.l + 2, y0: pad.t + 2, x1: pad.l + pw - 2, y1: pad.t + ph - 2 };
  const items = [];
  if (hl) items.push({ x: xS(hl.x), y: yS(hl.y), r: r*1.6, force: true, px: 11*fs, font: f(11, 700),
    text: hl.p.name + (hl.extra ? `  #${hl.rank}` : ''), hl: true });
  if (showNames) {
    const budget = Math.max(8, Math.min(40, Math.round(pw*ph / (9000*fs*fs))));
    for (const d of visible.slice(0, budget + 1)) {
      if (d === hl || items.length > budget) continue;
      items.push({ x: xS(d.x), y: yS(d.y), r, px: 9.5*fs, font: f(9.5, 500), text: d.p.name.split(' ').slice(-1)[0] });
    }
  }
  const labels = placeLabels(ctx, items, dots, bounds, taken, fs);
  L.labels = labels; L.dots = dots; L.bounds = bounds; L.taken = taken;
  ctx.lineJoin = 'round'; ctx.textAlign = 'left';
  for (const lb of labels) {
    const a = lb.hl || !hl ? 1 : 0.35;
    ctx.globalAlpha = a;
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
  const hv = hoverId != null && hoverId !== highlightId && visible.find(d => d.p.id === hoverId);
  if (hv) {
    ctx.beginPath(); ctx.arc(xS(hv.x), yS(hv.y), r + 2.5*fs, 0, Math.PI*2);
    ctx.strokeStyle = T.hl; ctx.lineWidth = 1.5*fs; ctx.stroke();
  }

  // ── Export frame: title block, legend, footer ────────────────────────────
  if (forExport) {
    ctx.textAlign = 'left';
    ctx.fillStyle = T.title; ctx.font = `700 46px ${FONT}`; ctx.fillText(title, pad.l, 72);
    ctx.fillStyle = T.sub; ctx.font = `500 24px ${FONT}`; ctx.fillText(subtitle, pad.l, 112);
    ctx.font = `600 21px ${FONT}`;
    legendRows.forEach((row, i) => row.forEach(({ it, txt, x }) => {
      const cy = 150 + i*LEGEND_ROW;
      ctx.beginPath(); ctx.arc(x + 9, cy, 9, 0, Math.PI*2); ctx.fillStyle = it.color; ctx.fill();
      ctx.strokeStyle = T.ring; ctx.lineWidth = T.ringW*1.5; ctx.stroke();
      ctx.fillStyle = T.legendText; ctx.fillText(txt, x + 26, cy + 8);
    }));
    ctx.strokeStyle = T.rule; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad.l, 180 + extraTop); ctx.lineTo(pad.l + pw, 180 + extraTop); ctx.stroke();
    ctx.fillStyle = T.footer; ctx.font = `500 19px ${FONT}`; ctx.fillText(footer, pad.l, H - 28);
  }
  return L;
}

export default function ScatterChart({ players, getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode, onSelect, onClose, contextLabel }) {
  const isMobile = useIsMobile();
  const [n, setN] = useState(50);
  const [xKey, setXKey] = useState('age');
  const [yKey, setYKey] = useState('display');
  const [metricMode, setMetricMode] = useState('val'); // 'val' (per-90 value) | 'pct' (percentile)
  const [colorBy, setColorBy] = useState('position'); // 'position' | 'careerScore' | 'potentialScore' | 'display'
  const [showNames, setShowNames] = useState(true);
  const [hidden, setHidden] = useState(() => new Set());
  const [hover, setHover] = useState(null); // {d, left, top}
  const [highlightId, setHighlightId] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(900);
  const wrapRef = useRef(null), canvasRef = useRef(null), layoutRef = useRef(null);
  const H = isMobile ? 400 : 580;

  const fields = useMemo(() => buildFields({ getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode, metricMode }),
    [getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode, metricMode]);
  const xf = fields.find(f => f.key === xKey) || fields[0];
  const yf = fields.find(f => f.key === yKey) || fields[0];
  const displayIsScore = fields[0].scoreScale;
  const colorOptions = [
    ['position', 'Position'], ['careerScore', 'Career score'], ['potentialScore', 'Potential'],
    ...(displayIsScore ? [['display', `Table score (${fields[0].label})`]] : []),
  ];
  useEffect(() => { if (colorBy === 'display' && !displayIsScore) setColorBy('position'); }, [colorBy, displayIsScore]);
  useEffect(() => { setHidden(new Set()); }, [colorBy]);

  const rankById = useMemo(() => new Map(players.map((p, i) => [p.id, i + 1])), [players]);
  useEffect(() => { if (highlightId != null && !rankById.has(highlightId)) setHighlightId(null); }, [rankById, highlightId]);

  const colorOf = useCallback(p => {
    if (colorBy === 'position') return POS_COLORS[p.roleKey] ? { g: p.roleKey, color: POS_COLORS[p.roleKey] } : { g: 'Other', color: OTHER_COLOR };
    const v = colorBy === 'display' ? getDisplayScore(p) : p[colorBy];
    return Number.isFinite(v) ? { g: scoreBucketKey(v), color: scoreDotColor(v) } : { g: 'none', color: NODATA_COLOR };
  }, [colorBy, getDisplayScore]);

  const top = useMemo(() => players.slice(0, Math.max(1, n)), [players, n]);
  const toPoint = useCallback((p, extra) => ({ p, x: xf.get(p), y: yf.get(p), rank: rankById.get(p.id), extra, ...colorOf(p) }), [xf, yf, rankById, colorOf]);
  const topPts = useMemo(() => top.map(p => toPoint(p, false)).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y)), [top, toPoint]);
  const hlPlayer = useMemo(() => (highlightId == null ? null : players.find(p => p.id === highlightId) || null), [players, highlightId]);
  const pts = useMemo(() => {
    if (!hlPlayer || topPts.some(d => d.p.id === hlPlayer.id)) return topPts;
    const d = toPoint(hlPlayer, true);
    return Number.isFinite(d.x) && Number.isFinite(d.y) ? [...topPts, d] : topPts;
  }, [topPts, hlPlayer, toPoint]);
  const hlPoint = hlPlayer ? pts.find(d => d.p.id === hlPlayer.id) : null;

  const legend = useMemo(() => {
    const c = {}; topPts.forEach(d => { c[d.g] = (c[d.g] || 0) + 1; });
    const base = colorBy === 'position'
      ? [...POS_ORDER, 'Other'].map(g => ({ key: g, label: g, color: POS_COLORS[g] || OTHER_COLOR }))
      : [...SCORE_BUCKETS, { key: 'none', label: 'No data', color: NODATA_COLOR }];
    return base.filter(it => c[it.key]).map(it => ({ ...it, count: c[it.key] }));
  }, [topPts, colorBy]);

  const colorLabel = colorOptions.find(o => o[0] === colorBy)?.[1] || 'Position';
  const title = `${yf.label} vs ${xf.label}`;
  const subtitle = `Top ${top.length} · ${contextLabel}${colorBy !== 'position' ? ` · colour: ${colorLabel}` : ''}${hlPoint ? ` · highlighted: ${hlPoint.p.name}` : ''}`;

  useEffect(() => {
    const measure = () => { const w = wrapRef.current?.offsetWidth; if (w) setWidth(w); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    layoutRef.current = drawScatter(canvasRef.current, width, H, window.devicePixelRatio || 1, false,
      { pts, xf, yf, hidden, hoverId: hover?.d.p.id, highlightId, showNames });
  }, [pts, xf, yf, hidden, hover, highlightId, showNames, width, H]);

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
      if (hidden.has(d.g) && d.p.id !== highlightId) continue;
      const dx = L.xS(d.x) - mx, dy = L.yS(d.y) - my, dd = dx*dx + dy*dy;
      if (dd <= bestD) { bestD = dd; best = d; }
    }
    return best ? { d: best, left: L.xS(best.x), top: L.yS(best.y) } : null;
  }, [pts, hidden, highlightId]);

  const onMove = e => {
    const h = hitTest(e);
    if ((h?.d.p.id ?? null) !== (hover?.d.p.id ?? null)) setHover(h);
    e.currentTarget.style.cursor = h ? 'pointer' : 'default';
  };
  // Single click highlights (background click clears); double click opens the profile.
  const onClick = e => { const h = hitTest(e); setHighlightId(h ? h.d.p.id : null); };
  const onDoubleClick = e => { const h = hitTest(e); if (h) onSelect(h.d.p); };

  const download = async () => {
    setBusy(true);
    try {
      await ensureMontserratEmbedded();
      const slug = s => s.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
      const base = `scatter_${slug(yf.label)}_vs_${slug(xf.label)}`;
      const date = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
      const footer = `Scout Index · ${date}${(xf.scoreScale || yf.scoreScale) ? ' · shaded zones / dashed lines = Scout Index level bands' : ''}`;
      for (const theme of ['dark', 'light']) {
        const off = document.createElement('canvas');
        drawScatter(off, EXPORT_W, EXPORT_H, 1, true, { pts, xf, yf, hidden, hoverId: null, highlightId, showNames, title, subtitle, footer, legend, theme });
        await deliverPng(off.toDataURL('image/png'), `${base}_${theme}.png`);
      }
    } finally { setBusy(false); }
  };

  const toggleGroup = g => setHidden(prev => { const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s; });
  const swap = () => { setXKey(yKey); setYKey(xKey); };

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    const out = [];
    for (let i = 0; i < players.length && out.length < 8; i++) {
      const p = players[i];
      if (norm(p.name).includes(q)) out.push({ p, rank: i + 1 });
    }
    return out;
  }, [players, query]);
  const pick = p => { setHighlightId(p.id); setQuery(''); };

  const groups = [...new Set(fields.map(f => f.group))];
  const sel = { background:'#0d1220', border:'1px solid #1e2d45', borderRadius:5, color:'#e2e8f4', padding:'5px 6px', fontSize:11, outline:'none', minWidth:0, maxWidth:isMobile?'100%':230 };
  const btn = on => ({ padding:'5px 10px', borderRadius:5, border:`1px solid ${on?'#3b7de8':'#1e2d45'}`, background:on?'#0e2040':'#0d1624', color:on?'#93c5fd':'#94a3b8', fontSize:10.5, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' });
  const lbl = { fontSize:9, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' };
  const col = { display:'flex', flexDirection:'column', gap:3 };
  const fieldSelect = (value, onChange, aria) => (
    <select aria-label={aria} style={sel} value={value} onChange={e => onChange(e.target.value)}>
      {groups.map(g => <optgroup key={g} label={g}>{fields.filter(f => f.group === g).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>)}
    </select>
  );
  const missing = top.length - topPts.length;
  const usesMetric = xf.metric || yf.metric;

  return (
    <div style={{ flex:1, overflow:'auto', padding:isMobile?'10px 12px 80px':'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:10 }}>
        <label style={col}><span style={lbl}>Y axis</span>{fieldSelect(yKey, setYKey, 'Y axis')}</label>
        <button title="Swap axes" onClick={swap} style={btn(false)}>⇄</button>
        <label style={col}><span style={lbl}>X axis</span>{fieldSelect(xKey, setXKey, 'X axis')}</label>
        <label style={col}><span style={lbl}>Top N</span>
          <input aria-label="Top N" type="number" min={1} max={1000} value={n} onChange={e => setN(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            style={{ ...sel, width:70 }}/>
        </label>
        <label style={col}><span style={lbl}>Colour by</span>
          <select aria-label="Colour by" style={sel} value={colorBy} onChange={e => setColorBy(e.target.value)}>
            {colorOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {usesMetric && (
          <div style={{ display:'flex', gap:3 }}>
            <button style={btn(metricMode==='val')} onClick={() => setMetricMode('val')}>Per-90 value</button>
            <button style={btn(metricMode==='pct')} onClick={() => setMetricMode('pct')}>Percentile</button>
          </div>
        )}
        <button style={btn(showNames)} onClick={() => setShowNames(s => !s)}>Names</button>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          {onClose && <button style={btn(false)} onClick={onClose}>☰ Table</button>}
          <button style={btn(false)} onClick={download} disabled={!pts.length || busy}>{busy ? 'Exporting…' : '⬇ Download PNG (dark + light)'}</button>
        </div>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8 }}>
        <div style={{ position:'relative' }}>
          <input aria-label="Highlight player" placeholder="Highlight a player…" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches[0]) pick(matches[0].p); }}
            style={{ ...sel, width:isMobile?200:240, padding:'6px 8px' }}/>
          {matches.length > 0 && (
            <div role="listbox" style={{ position:'absolute', top:'100%', left:0, marginTop:3, width:320, background:'#0d1220', border:'1px solid #26456f', borderRadius:6, zIndex:20, boxShadow:'0 6px 20px rgba(0,0,0,.5)' }}>
              {matches.map(({ p, rank }) => (
                <button key={p.id} role="option" aria-selected={false} onClick={() => pick(p)}
                  style={{ display:'flex', width:'100%', gap:8, alignItems:'baseline', padding:'6px 10px', background:'none', border:'none', borderBottom:'1px solid #111c2e', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:11.5, color:'#e2e8f4', fontWeight:600 }}>{p.name}</span>
                  <span style={{ fontSize:10, color:'#64748b', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.team}</span>
                  <span style={{ fontSize:10, color: rank <= n ? '#93c5fd' : '#94a3b8' }}>#{rank}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {hlPlayer && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 6px 4px 10px', borderRadius:14, border:'1px solid #26456f', background:'#0e2040' }}>
            <span style={{ fontSize:11, color:'#dbeafe' }}>
              <b>{hlPlayer.name}</b> · {hlPlayer.team} · #{rankById.get(hlPlayer.id)}
              {!hlPoint ? ' · no data for these axes' : hlPoint.extra ? ' · outside top ' + top.length : ''}
            </span>
            <button onClick={() => onSelect(hlPlayer)} style={{ ...btn(false), padding:'3px 8px' }}>Open profile</button>
            <button aria-label="Clear highlight" onClick={() => setHighlightId(null)} style={{ ...btn(false), padding:'3px 8px' }}>✕</button>
          </div>
        )}
      </div>

      <div ref={wrapRef} style={{ position:'relative', width:'100%' }} onMouseLeave={() => setHover(null)}>
        <canvas ref={canvasRef} onMouseMove={onMove} onClick={onClick} onDoubleClick={onDoubleClick} style={{ display:'block', borderRadius:6 }}/>
        {!pts.length && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:12, textAlign:'center', padding:20 }}>
            {top.length ? `None of the top ${top.length} have data for ${yf.label} and ${xf.label}.` : 'No players match the current filters.'}
          </div>
        )}
        {hover && (
          <div role="tooltip" style={{ position:'absolute', left:Math.min(hover.left + 12, width - 230), top:Math.max(0, hover.top - 70), width:215, pointerEvents:'none',
            background:'#0d1220', border:'1px solid #26456f', borderRadius:6, padding:'8px 10px', boxShadow:'0 6px 20px rgba(0,0,0,.5)', zIndex:5 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:hover.d.color, flexShrink:0 }}/>
              <span style={{ fontSize:12, fontWeight:700, color:'#f8fafc' }}>{hover.d.p.name}</span>
            </div>
            <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>{hover.d.p.team} · {hover.d.p.league}</div>
            <div style={{ fontSize:10.5, color:'#94a3b8' }}>{hover.d.p.position} · age {hover.d.p.age} · #{hover.d.rank}</div>
            <div style={{ fontSize:10.5, color:'#e2e8f4', marginTop:4 }}>{yf.label}: <b>{valueText(hover.d.y, yf)}</b></div>
            <div style={{ fontSize:10.5, color:'#e2e8f4' }}>{xf.label}: <b>{valueText(hover.d.x, xf)}</b></div>
            <div style={{ fontSize:9.5, color:'#64748b', marginTop:4 }}>Click to highlight · double-click for profile</div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'6px 12px' }}>
        {colorBy !== 'position' && <span style={{ ...lbl, marginRight:2 }}>{colorLabel}</span>}
        {legend.map(it => (
          <button key={it.key} onClick={() => toggleGroup(it.key)} title={hidden.has(it.key) ? 'Show' : 'Hide'}
            style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:0, opacity:hidden.has(it.key) ? 0.4 : 1 }}>
            <span style={{ width:9, height:9, borderRadius:'50%', background:it.color }}/>
            <span style={{ fontSize:11, color:'#cbd5e1', textDecoration:hidden.has(it.key) ? 'line-through' : 'none' }}>{it.label} <span style={{ color:'#64748b' }}>{it.count}</span></span>
          </button>
        ))}
        <span style={{ fontSize:10, color:'#64748b', marginLeft:'auto' }}>
          {topPts.length} of top {top.length} plotted{missing > 0 ? ` · ${missing} without data for these axes` : ''}
          {(xf.scoreScale || yf.scoreScale) ? ' · shaded zones = level bands' : ''}
        </span>
      </div>
    </div>
  );
}
