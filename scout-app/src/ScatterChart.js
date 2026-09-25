import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SCORE_TIERS, POS_COLORS, METRIC_OPTIONS, METRIC_OPTIONS_EXTRA, seasonDetailFor, metricFromDetail } from './constants';
import { useIsMobile, deliverPng } from './utils';

// Scatter view of the current Scout Index result list: plots the top N of the
// already filtered + sorted players (App passes `sorted`), coloured by position
// group. Drawn on canvas in the same style as PlayerCard's squad chart, with the
// same 1920x1080 export through deliverPng.

const POS_ORDER = ['GK','CB','FB','CM','ATT','CF'];
const OTHER_COLOR = '#94a3b8';
// Tier line colours — same palette as PlayerCard's squad chart, keyed by cutoff.
const TIER_COLORS = { 82:'#22c55e', 78:'#4ade80', 72:'#86efac', 67:'#fde047', 61:'#fb923c', 57:'#f87171', 54:'#ef4444', 50:'#94a3b8', 44:'#64748b' };

const money = v => v >= 1e6 ? `£${(v/1e6).toFixed(1)}m` : `£${Math.round(v/1e3)}k`;
const posOrNull = v => (v != null && v > 0 ? v : null);

function tableScoreLabel({ seasonFilter, scoreMode, rawMode, outlierMode }) {
  const season = seasonFilter !== 'all' ? seasonFilter : null;
  if (outlierMode) return scoreMode !== 'complete' ? `Outlier z · ${scoreMode}` : `Outlier z · ${season || 'career'}`;
  if (rawMode) return season ? `Raw score · ${season}` : 'Raw career score';
  if (season) return `Score · ${season}`;
  return scoreMode !== 'complete' ? `${scoreMode} score` : 'Career score';
}

// Every field an axis can show. `get(p, ctx)` returns a number or null;
// `scoreScale` means the level-band gridlines apply.
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
  const step = niceStep((hi - lo + 2*pad) / 6);
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
function computeLayout(W, H, forExport, pts, xf, yf, hasTitle) {
  const fs = forExport ? 2.4 : 1;
  const yTiers = yf.scoreScale, xTiers = xf.scoreScale;
  const titleH = hasTitle ? 90*fs : 0;
  const pad = {
    t: titleH + (forExport ? 30 : 14),
    r: (yTiers ? 120 : 24) * (forExport ? 1.9 : 1),
    b: 46 * fs,
    l: 60 * fs,
  };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const xd = axisDomain(pts.map(d => d.x), xf), yd = axisDomain(pts.map(d => d.y), yf);
  const xS = v => pad.l + ((v - xd.lo) / (xd.hi - xd.lo)) * pw;
  const yS = v => pad.t + ph - ((v - yd.lo) / (yd.hi - yd.lo)) * ph;
  return { fs, pad, pw, ph, xd, yd, xS, yS, xTiers, yTiers };
}

export function drawScatter(canvas, W, H, dpr, forExport, o) {
  const { pts, xf, yf, hidden, hoverId, showNames, title, subtitle } = o;
  canvas.width = W*dpr; canvas.height = H*dpr;
  if (!forExport) { canvas.style.width = W+'px'; canvas.style.height = H+'px'; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#060b14'; ctx.fillRect(0, 0, W, H);
  if (!pts.length) return null;

  const L = computeLayout(W, H, forExport, pts, xf, yf, forExport);
  const { fs, pad, pw, ph, xd, yd, xS, yS } = L;
  ctx.fillStyle = '#07101e'; ctx.fillRect(pad.l, pad.t, pw, ph);

  if (forExport) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8fafc'; ctx.font = `bold ${20*fs}px Inter,sans-serif`;
    ctx.fillText(title, pad.l, 44*fs);
    ctx.fillStyle = '#94a3b8'; ctx.font = `${11*fs}px Inter,sans-serif`;
    ctx.fillText(subtitle, pad.l, 66*fs);
    // Position legend, top right
    const groups = POS_ORDER.filter(g => pts.some(d => d.g === g) && !hidden.has(g));
    ctx.font = `bold ${10*fs}px Inter,sans-serif`; ctx.textAlign = 'left';
    let lx = pad.l + pw;
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i], w = ctx.measureText(g).width;
      lx -= w + 26*fs;
      ctx.beginPath(); ctx.arc(lx + 5*fs, 62*fs, 5*fs, 0, Math.PI*2); ctx.fillStyle = POS_COLORS[g]; ctx.fill();
      ctx.fillStyle = '#cbd5e1'; ctx.fillText(g, lx + 14*fs, 66*fs);
    }
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, 80*fs); ctx.lineTo(pad.l + pw, 80*fs); ctx.stroke();
  }

  // Plain grid + tick labels
  ctx.setLineDash([]);
  for (let v = yd.lo; v <= yd.hi + 1e-9; v += yd.step) {
    const y = yS(v);
    ctx.strokeStyle = '#0d1829'; ctx.lineWidth = forExport ? 1.5 : 0.7;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
    ctx.fillStyle = '#6b7280'; ctx.font = `${10*fs}px Inter,sans-serif`; ctx.textAlign = 'right';
    ctx.fillText(tickText(v, yf, yd.step), pad.l - 8*fs, y + 3.5*fs);
  }
  for (let v = xd.lo; v <= xd.hi + 1e-9; v += xd.step) {
    const x = xS(v);
    ctx.strokeStyle = '#0d1829'; ctx.lineWidth = forExport ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke();
    ctx.fillStyle = '#6b7280'; ctx.font = `${10*fs}px Inter,sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(tickText(v, xf, xd.step), x, pad.t + ph + 18*fs);
  }

  // Level-band lines (score-scale axes only), cutoffs from SCORE_TIERS
  ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
  for (const t of SCORE_TIERS) {
    const col = TIER_COLORS[t.min] || OTHER_COLOR;
    ctx.setLineDash([7, 5]); ctx.strokeStyle = col + '55'; ctx.lineWidth = forExport ? 2.5 : 1.4;
    if (L.yTiers && t.min > yd.lo && t.min < yd.hi) {
      ctx.beginPath(); ctx.moveTo(pad.l, yS(t.min)); ctx.lineTo(pad.l + pw, yS(t.min)); ctx.stroke();
    }
    if (L.xTiers && t.min > xd.lo && t.min < xd.hi) {
      ctx.beginPath(); ctx.moveTo(xS(t.min), pad.t); ctx.lineTo(xS(t.min), pad.t + ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.save(); ctx.translate(xS(t.min) - 4*fs, pad.t + 6*fs); ctx.rotate(-Math.PI/2);
      ctx.fillStyle = col + 'dd'; ctx.font = `${9*fs}px Inter,sans-serif`; ctx.textAlign = 'right';
      ctx.fillText(t.short, 0, 0); ctx.restore();
    }
  }
  ctx.setLineDash([]); ctx.restore();
  if (L.yTiers) for (const t of SCORE_TIERS) {
    if (t.min <= yd.lo || t.min >= yd.hi) continue;
    ctx.fillStyle = (TIER_COLORS[t.min] || OTHER_COLOR) + 'dd';
    ctx.font = `${forExport ? 'bold ' : ''}${9*fs}px Inter,sans-serif`; ctx.textAlign = 'left';
    ctx.fillText(t.short, pad.l + pw + 10*fs, yS(t.min) + 3.5*fs);
  }

  // Axes + titles
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = forExport ? 1.5 : 0.8;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph); ctx.stroke();
  ctx.fillStyle = '#94a3b8'; ctx.font = `${10*fs}px Inter,sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(xf.label, pad.l + pw/2, pad.t + ph + 36*fs);
  ctx.save(); ctx.translate(pad.l - 44*fs, pad.t + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText(yf.label, 0, 0); ctx.restore();

  // Dots — drawn lowest-ranked first so the top of the list sits on top
  const r = (pts.length > 200 ? 4 : 5.5) * fs;
  const visible = pts.filter(d => !hidden.has(d.g));
  for (let i = visible.length - 1; i >= 0; i--) {
    const d = visible[i];
    ctx.beginPath(); ctx.arc(xS(d.x), yS(d.y), r, 0, Math.PI*2);
    ctx.fillStyle = POS_COLORS[d.g] || OTHER_COLOR; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#060b14'; ctx.lineWidth = 2*fs; ctx.stroke();
  }

  // Name labels for the top of the list, skipping any that would collide
  if (showNames) {
    const placed = [];
    const maxLabels = forExport ? 30 : 15;
    ctx.font = `${9.5*fs}px Inter,sans-serif`; ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    for (const d of visible.slice(0, maxLabels)) {
      const text = d.p.name.split(' ').slice(-1)[0];
      const w = ctx.measureText(text).width, h = 11*fs;
      const x = xS(d.x), y = yS(d.y);
      let lx = x + r + 4*fs;
      if (lx + w > pad.l + pw) lx = x - r - 4*fs - w;
      const box = { x0: lx - 2, y0: y - h/2 - 1, x1: lx + w + 2, y1: y + h/2 + 1 };
      if (placed.some(b => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      placed.push(box);
      ctx.strokeStyle = '#060b14'; ctx.lineWidth = 3.5*fs; ctx.strokeText(text, lx, y + 3.5*fs);
      ctx.fillStyle = '#d1d5db'; ctx.fillText(text, lx, y + 3.5*fs);
    }
  }

  // Hover ring
  const hv = hoverId != null && visible.find(d => d.p.id === hoverId);
  if (hv) {
    ctx.beginPath(); ctx.arc(xS(hv.x), yS(hv.y), r + 2.5*fs, 0, Math.PI*2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2*fs; ctx.stroke();
  }
  return L;
}

export default function ScatterChart({ players, getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode, onSelect, onClose, contextLabel }) {
  const isMobile = useIsMobile();
  const [n, setN] = useState(50);
  const [xKey, setXKey] = useState('age');
  const [yKey, setYKey] = useState('display');
  const [metricMode, setMetricMode] = useState('val'); // 'val' (per-90 value) | 'pct' (percentile)
  const [showNames, setShowNames] = useState(true);
  const [hidden, setHidden] = useState(() => new Set());
  const [hover, setHover] = useState(null); // {d, left, top}
  const [width, setWidth] = useState(900);
  const wrapRef = useRef(null), canvasRef = useRef(null), layoutRef = useRef(null);
  const H = isMobile ? 380 : 560;

  const fields = useMemo(() => buildFields({ getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode, metricMode }),
    [getDisplayScore, seasonFilter, scoreMode, rawMode, outlierMode, metricMode]);
  const xf = fields.find(f => f.key === xKey) || fields[0];
  const yf = fields.find(f => f.key === yKey) || fields[0];

  const top = useMemo(() => players.slice(0, Math.max(1, n)), [players, n]);
  const pts = useMemo(() => top.map(p => ({ p, g: POS_COLORS[p.roleKey] ? p.roleKey : 'Other', x: xf.get(p), y: yf.get(p) }))
    .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y)), [top, xf, yf]);
  const groupCounts = useMemo(() => { const c = {}; pts.forEach(d => { c[d.g] = (c[d.g] || 0) + 1; }); return c; }, [pts]);

  const title = `Scout Index · ${contextLabel}`;
  const subtitle = `Top ${top.length} · ${yf.label} vs ${xf.label}`;

  useEffect(() => {
    const measure = () => { const w = wrapRef.current?.offsetWidth; if (w) setWidth(w); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    layoutRef.current = drawScatter(canvasRef.current, width, H, window.devicePixelRatio || 1, false,
      { pts, xf, yf, hidden, hoverId: hover?.d.p.id, showNames });
  }, [pts, xf, yf, hidden, hover, showNames, width, H]);

  const hitTest = useCallback(e => {
    const L = layoutRef.current, c = canvasRef.current;
    if (!L || !c) return null;
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bestD = 12 * 12; // hit target larger than the dot
    for (const d of pts) {
      if (hidden.has(d.g)) continue;
      const dx = L.xS(d.x) - mx, dy = L.yS(d.y) - my, dd = dx*dx + dy*dy;
      if (dd <= bestD) { bestD = dd; best = d; }
    }
    return best ? { d: best, left: L.xS(best.x), top: L.yS(best.y) } : null;
  }, [pts, hidden]);

  const onMove = e => {
    const h = hitTest(e);
    if ((h?.d.p.id ?? null) !== (hover?.d.p.id ?? null)) setHover(h);
    e.currentTarget.style.cursor = h ? 'pointer' : 'default';
  };
  const onClick = e => { const h = hitTest(e); if (h) onSelect(h.d.p); };

  const download = () => {
    const off = document.createElement('canvas');
    drawScatter(off, 1920, 1080, 1, true, { pts, xf, yf, hidden, hoverId: null, showNames, title, subtitle });
    const slug = s => s.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
    deliverPng(off.toDataURL('image/png'), `scatter_${slug(yf.label)}_vs_${slug(xf.label)}.png`);
  };

  const toggleGroup = g => setHidden(prev => { const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s; });
  const swap = () => { setXKey(yKey); setYKey(xKey); };

  const groups = [...new Set(fields.map(f => f.group))];
  const sel = { background:'#0d1220', border:'1px solid #1e2d45', borderRadius:5, color:'#e2e8f4', padding:'5px 6px', fontSize:11, outline:'none', minWidth:0, maxWidth:isMobile?'100%':230 };
  const btn = on => ({ padding:'5px 10px', borderRadius:5, border:`1px solid ${on?'#3b7de8':'#1e2d45'}`, background:on?'#0e2040':'#0d1624', color:on?'#93c5fd':'#94a3b8', fontSize:10.5, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' });
  const lbl = { fontSize:9, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' };
  const fieldSelect = (value, onChange, aria) => (
    <select aria-label={aria} style={sel} value={value} onChange={e => onChange(e.target.value)}>
      {groups.map(g => <optgroup key={g} label={g}>{fields.filter(f => f.group === g).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>)}
    </select>
  );
  const missing = top.length - pts.length;
  const usesMetric = xf.metric || yf.metric;

  return (
    <div style={{ flex:1, overflow:'auto', padding:isMobile?'10px 12px 80px':'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:10 }}>
        <label style={{ display:'flex', flexDirection:'column', gap:3 }}><span style={lbl}>Y axis</span>{fieldSelect(yKey, setYKey, 'Y axis')}</label>
        <button title="Swap axes" onClick={swap} style={btn(false)}>⇄</button>
        <label style={{ display:'flex', flexDirection:'column', gap:3 }}><span style={lbl}>X axis</span>{fieldSelect(xKey, setXKey, 'X axis')}</label>
        <label style={{ display:'flex', flexDirection:'column', gap:3 }}><span style={lbl}>Top N</span>
          <input aria-label="Top N" type="number" min={1} max={1000} value={n} onChange={e => setN(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            style={{ ...sel, width:70 }}/>
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
          <button style={btn(false)} onClick={download} disabled={!pts.length}>⬇ Download 1920×1080</button>
        </div>
      </div>

      <div ref={wrapRef} style={{ position:'relative', width:'100%' }} onMouseLeave={() => setHover(null)}>
        <canvas ref={canvasRef} onMouseMove={onMove} onClick={onClick} style={{ display:'block', borderRadius:6 }}/>
        {!pts.length && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:12, textAlign:'center', padding:20 }}>
            {top.length ? `None of the top ${top.length} have data for ${yf.label} and ${xf.label}.` : 'No players match the current filters.'}
          </div>
        )}
        {hover && (
          <div role="tooltip" style={{ position:'absolute', left:Math.min(hover.left + 12, width - 230), top:Math.max(0, hover.top - 70), width:215, pointerEvents:'none',
            background:'#0d1220', border:'1px solid #26456f', borderRadius:6, padding:'8px 10px', boxShadow:'0 6px 20px rgba(0,0,0,.5)', zIndex:5 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:POS_COLORS[hover.d.g] || OTHER_COLOR, flexShrink:0 }}/>
              <span style={{ fontSize:12, fontWeight:700, color:'#f8fafc' }}>{hover.d.p.name}</span>
            </div>
            <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>{hover.d.p.team} · {hover.d.p.league}</div>
            <div style={{ fontSize:10.5, color:'#94a3b8' }}>{hover.d.p.position} · age {hover.d.p.age}</div>
            <div style={{ fontSize:10.5, color:'#e2e8f4', marginTop:4 }}>{yf.label}: <b>{valueText(hover.d.y, yf)}</b></div>
            <div style={{ fontSize:10.5, color:'#e2e8f4' }}>{xf.label}: <b>{valueText(hover.d.x, xf)}</b></div>
            <div style={{ fontSize:9.5, color:'#64748b', marginTop:4 }}>Click to open profile</div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'6px 12px' }}>
        {[...POS_ORDER, 'Other'].filter(g => groupCounts[g]).map(g => (
          <button key={g} onClick={() => toggleGroup(g)} title={hidden.has(g) ? 'Show' : 'Hide'}
            style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:0, opacity:hidden.has(g) ? 0.4 : 1 }}>
            <span style={{ width:9, height:9, borderRadius:'50%', background:POS_COLORS[g] || OTHER_COLOR }}/>
            <span style={{ fontSize:11, color:'#cbd5e1', textDecoration:hidden.has(g) ? 'line-through' : 'none' }}>{g} <span style={{ color:'#64748b' }}>{groupCounts[g]}</span></span>
          </button>
        ))}
        <span style={{ fontSize:10, color:'#64748b', marginLeft:'auto' }}>
          {pts.length} of top {top.length} plotted{missing > 0 ? ` · ${missing} without data for these axes` : ''}
          {(xf.scoreScale || yf.scoreScale) ? ' · dashed lines = level bands' : ''}
        </span>
      </div>
    </div>
  );
}
