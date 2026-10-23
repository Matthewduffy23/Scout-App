// Shared colour data for the scatter engine (ScatterChart.js's drawScatter/ScatterView —
// the single engine behind both the normal Scout Index scatter and Custom Scatter).
// Metric palettes, quadrant-colour themes and solid presets live here ONCE so neither
// caller can drift from the other.

const toRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// Piecewise-linear interpolation across N equally-spaced stops, t in [0,1].
// With exactly 3 stops this puts the middle stop at t=0.5 — the property the
// diverging palettes below rely on (median always lands exactly on the centre stop).
function rampColorAt(hexStops, t) {
  const stops = hexStops.map(toRgb);
  const n = stops.length - 1;
  const tt = Math.max(0, Math.min(1, t));
  const seg = Math.min(n - 1, Math.floor(tt * n));
  const localT = tt * n - seg;
  const a = stops[seg], b = stops[seg + 1];
  return toHex(a.map((v, i) => v + (b[i] - v) * localT));
}

// Diverging: exactly 2 hues + a neutral midpoint, centred on the plotted sample's
// median (not the midpoint of the 5th/95th value range — the two arms can have
// different spans). Sequential: one (or two-hue blend, e.g. Blue-Teal/Viridis)
// ramp, low -> high.
export const METRIC_PALETTES = {
  rgg:   { label: 'Red-Gold-Green', kind: 'diverging', stops: ['#C7363C', '#F0C56A', '#3DA65B'] },
  rb:    { label: 'Red-Blue', kind: 'diverging', stops: ['#C0392B', '#F3F4F6', '#2563EB'] },
  ob:    { label: 'Orange-Blue', kind: 'diverging', stops: ['#E08214', '#F3F4F6', '#2C7FB8'] },
  pg:    { label: 'Purple-Green', kind: 'diverging', stops: ['#7B3294', '#F7F7F7', '#1B7837'] },
  temp:  { label: 'Temperature', kind: 'diverging', stops: ['#2166AC', '#FFFFFF', '#B2182B'] },
  blues:    { label: 'Blues', kind: 'sequential', stops: ['#EFF6FF', '#60A5FA', '#1E3A8A'] },
  greens:   { label: 'Greens', kind: 'sequential', stops: ['#ECFDF5', '#34D399', '#065F46'] },
  reds:     { label: 'Reds', kind: 'sequential', stops: ['#FEF2F2', '#F87171', '#7F1D1D'] },
  oranges:  { label: 'Oranges', kind: 'sequential', stops: ['#FFF7ED', '#FB923C', '#7C2D12'] },
  purples:  { label: 'Purples', kind: 'sequential', stops: ['#FAF5FF', '#A78BFA', '#4C1D95'] },
  gold:     { label: 'Gold', kind: 'sequential', stops: ['#FFFBEB', '#FBBF24', '#78350F'] },
  blueteal: { label: 'Blue-Teal', kind: 'sequential', stops: ['#EFF6FF', '#2563EB', '#0D9488'] },
  viridis:  { label: 'Viridis', kind: 'sequential', stops: ['#440154', '#414487', '#2A788E', '#22A884', '#7AD151', '#FDE725'] },
};
export const METRIC_PALETTE_GROUPS = [
  { label: 'Diverging (centre = median)', keys: ['rgg', 'rb', 'ob', 'pg', 'temp'] },
  { label: 'Sequential (low → high)', keys: ['blues', 'greens', 'reds', 'oranges', 'purples', 'gold', 'blueteal', 'viridis'] },
];

export function paletteColorAt(paletteKey, t) {
  const p = METRIC_PALETTES[paletteKey] || METRIC_PALETTES.rgg;
  return rampColorAt(p.stops, t);
}
// 5-sample gradient (for the legend bar / CSS gradient), honouring Reverse.
export function paletteGradientStops(paletteKey, reverse) {
  return [0, 0.25, 0.5, 0.75, 1].map(t => paletteColorAt(paletteKey, reverse ? 1 - t : t));
}

const safeRatio = (num, den) => (den === 0 ? (num <= 0 ? 0 : 1) : Math.max(0, Math.min(1, num / den)));
// Maps a raw value onto the palette's unit position [0,1] — 0.5 is always the
// diverging centre (sample median), regardless of how far it sits from lo/hi.
export function valueToUnitT(value, { lo, hi, median, kind, reverse }) {
  let t;
  if (kind === 'diverging' && median != null) {
    t = value <= median ? 0.5 * safeRatio(value - lo, median - lo) : 0.5 + 0.5 * safeRatio(value - median, hi - median);
  } else {
    t = safeRatio(value - lo, hi - lo);
  }
  return reverse ? 1 - t : t;
}

// Nearest-rank-with-interpolation percentile (numpy 'linear' convention) of an
// ALREADY-SORTED-ASCENDING array. Scale anchors (section 1: "5th-95th percentile
// as the ends") are built from this, not raw min/max, so one outlier can't wash
// out the rest of the sample.
export function percentileOf(sortedVals, p) {
  const n = sortedVals.length;
  if (!n) return null;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sortedVals[lo] : sortedVals[lo] + (sortedVals[hi] - sortedVals[lo]) * (idx - lo);
}

// Solid-colour presets for the "Solid" colour-by mode. "White/Black depending on
// theme" isn't a fixed hex — the caller resolves it against the active theme.
export const SOLID_PRESETS = [
  { key: 'blue', label: 'Blue', hex: '#3B82F6' },
  { key: 'red', label: 'Red', hex: '#EF4444' },
  { key: 'green', label: 'Green', hex: '#22C55E' },
  { key: 'gold', label: 'Gold', hex: '#D4A017' },
  { key: 'purple', label: 'Purple', hex: '#8B5CF6' },
  { key: 'teal', label: 'Teal', hex: '#14B8A6' },
];
export const solidMonoFor = themeName => (themeName === 'light' ? '#111111' : '#F8FAFC');

// Quadrant-colour themes: median-split background tints (per corner, per
// light/dark mode) PLUS solid dot colours for the "Colour by Quadrant" mode.
// bg alpha stays low (~0.07-0.15) deliberately, so a solid metric-coloured dot
// (e.g. Red-Gold-Green) still reads clearly on top of any of them.
export const QUADRANT_THEMES = {
  tealLilac: {
    label: 'Teal / Lilac',
    bg: {
      dark:  { tr: 'rgba(20,184,166,0.15)', br: 'rgba(99,102,241,0.13)', tl: 'rgba(100,116,139,0.08)', bl: 'rgba(0,0,0,0)' },
      light: { tr: 'rgba(13,148,136,0.12)', br: 'rgba(79,70,229,0.09)', tl: 'rgba(100,116,139,0.07)', bl: 'rgba(0,0,0,0)' },
    },
    dot: { tr: '#14B8A6', br: '#B983E0', tl: '#5C6BC0', bl: '#9CA3AF' },
  },
  traffic: {
    label: 'Traffic light',
    bg: {
      dark:  { tr: 'rgba(34,197,94,0.14)', tl: 'rgba(217,119,6,0.13)', br: 'rgba(217,119,6,0.13)', bl: 'rgba(220,38,38,0.13)' },
      light: { tr: 'rgba(22,163,74,0.12)', tl: 'rgba(217,119,6,0.11)', br: 'rgba(217,119,6,0.11)', bl: 'rgba(220,38,38,0.11)' },
    },
    dot: { tr: '#16A34A', tl: '#D97706', br: '#D97706', bl: '#DC2626' },
  },
  neutral: {
    label: 'Neutral',
    bg: {
      dark:  { tr: 'rgba(212,160,23,0.12)', tl: 'rgba(148,163,184,0.05)', br: 'rgba(148,163,184,0.05)', bl: 'rgba(148,163,184,0.05)' },
      light: { tr: 'rgba(161,98,7,0.10)', tl: 'rgba(100,116,139,0.05)', br: 'rgba(100,116,139,0.05)', bl: 'rgba(100,116,139,0.05)' },
    },
    dot: { tr: '#D4A017', tl: '#94A3B8', br: '#94A3B8', bl: '#94A3B8' },
  },
  none: {
    label: 'None',
    bg: {
      dark:  { tr: 'rgba(0,0,0,0)', tl: 'rgba(0,0,0,0)', br: 'rgba(0,0,0,0)', bl: 'rgba(0,0,0,0)' },
      light: { tr: 'rgba(0,0,0,0)', tl: 'rgba(0,0,0,0)', br: 'rgba(0,0,0,0)', bl: 'rgba(0,0,0,0)' },
    },
    // "if dots are coloured by quadrant, use Traffic light dot colours"
    dot: { tr: '#16A34A', tl: '#D97706', br: '#D97706', bl: '#DC2626' },
  },
};
export const QUADRANT_THEME_ORDER = ['tealLilac', 'traffic', 'neutral', 'none'];
