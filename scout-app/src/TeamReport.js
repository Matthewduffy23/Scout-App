// TeamReport.js v40 — Team All-in-One report. 1920x1080 PNG export.
//
// v2: bigger team name; country flag + league logo beside the league name;
//     mini coach profile in the header gap; XI is now formation-driven and
//     auto-filled from squad minutes (photo + colour-coded score per slot,
//     depth names underneath).
//
// The six right-hand panels are still stubs — one function each, replace in place.
//
// COACH DATA: coaches are NOT in teams_final.json. They live in localStorage via
// coachStorage.loadCoaches(), created by hand in the Coaches panel, and link to a
// team through tenures[] matching team+league+season exactly. So the coach block
// only appears for clubs you've actually saved a coach for — everything else gets
// a quiet empty state. localStorage is per-domain, so a coach saved on production
// will NOT show on a preview deploy.
//
// v36: header band retuned. Wheel span tightened 460 -> 396 (89px of dead air
// between Overall and Attack down to 59), RULE_MID/TREND pulled left, so the
// trend gains 76px and its plot goes 304 -> 380. All three wheel labels now
// share one baseline (HDR_LABEL_Y) instead of OVERALL hanging 9px low, and the
// trend's season row sits on the same line with LEAGUE FINISH centred over the
// plot in the same type as the season labels. Ordinal demoted 16 -> 12.5px.
//
// v37: trend fill cut 0.20 -> 0.09 and the ramp stopped at 60% (at 76px tall it
// had become the loudest thing in the header). OVERALL ring to r38/stroke8 to
// reassert it at the tighter spacing; label baseline 112 -> 114 to hold the gap.
// AREAS TO IMPROVE now draws from an outcome-only allow-list, dedupes by label
// (PPDA was eligible for two of the four slots as identical bars).
//
// v38: (reverted in v40 — the similarity briefly moved to a frontend module
// before going back into build_teams.py where it belongs.)
//
// v39: the Finishing/Goalkeeping xG residuals are gone — back to four metric
// bars. The outcome-only allow-list and the PPDA dedupe from v37 stay.
//
// v40: similarity reverted to reading team.similarTeams. It belongs in
// build_teams.py, which is where it already was — the league-strength weighting
// and reserve exclusion were added there instead, so every consumer reads one
// number from one place. teamSimilarity.js is deleted.

import React, { useState, useMemo } from 'react';
import {
  MONTSERRAT_EMBED_CSS, teamCrest, leagueDisplayName,
  leagueLogo, leagueFlag, photoUrl,
} from './cardAssets';
import { loadCoaches } from './coachStorage';
import { FOTMOB_PHOTO_BASE, countryToIso2, computeAge, fadeHexToBG } from './CoachCard';
import { computeCoachScore } from './CoachQuickCard';

// ─── Canvas geometry ───────────────────────────────────────────────────────
const W = 1920;
const H = 1080;
const PAD = 24;
const HEADER_H = 150;
const BODY_TOP = 166;
const GAP = 20;

const LEFT_W = 756;
const COL_W = 538;
const COL_A_X = PAD + LEFT_W + GAP;      // 800
const COL_B_X = COL_A_X + COL_W + GAP;   // 1358

// Rows are no longer equal: Radar + Style lead at the top and get the most
// room, League Table + Weaknesses sit mid, Similar Teams + Key Players close
// out smallest. 336 + 284 + 229 + two 20px gaps = 889, same total as before.
const ROW1_H = 336;
const ROW2_H = 284;
const ROW3_H = 229;
const ROW_1 = BODY_TOP;                        // 166
const ROW_2 = ROW_1 + ROW1_H + GAP;            // 522
const ROW_3 = ROW_2 + ROW2_H + GAP;            // 826
const LEFT_H = ROW_3 + ROW3_H - BODY_TOP;      // 889

// Header column stops. The team name is capped and ellipsised so long clubs
// ("Wolverhampton Wanderers") can't run into the coach block.
const NAME_X = PAD + 128;
// Manager's left edge is COL_B_X, so the header block sits directly above the
// right-hand tile column instead of floating between columns.
//   identity 24-440 | rule 456 | wheels 474-1338 | manager 1358-1896
const NAME_MAX_W = 288;
// 448 is the floor for RULE_1: the name is ellipsised at NAME_MAX_W, so its box
// ends at 440 and the rule can't come any further left without clipping it.
const RULE_1 = 448;
const RULE_2 = 1338;                     // between the wheels and the manager
// WHEEL_W was 460 (step 153), which left 89px of dead air between the Overall
// and Attack rings and made the group read as adrift rather than as one unit.
// 396 gives step 132 / a 59px ring gap, and puts the wheels' visual span
// (498..835) symmetrically between the two rules with ~50px clear either side.
// Every pixel freed goes to the trend, which is the element that needed it:
// PROMOTED/RELEGATED labels are 68px wide and collided on the old 304px plot.
const WHEEL_X = 473;
const WHEEL_W = 396;                     // 3 wheels: Overall, Attack, Defence
const RULE_MID = 886;
const TREND_X = 908;
const TREND_W = 420;                     // 908..1328, plot 304 -> 380

// Wheel labels and the trend's season/caption row share one baseline, so the
// two halves of the header read as a single band rather than two stacks.
const HDR_LABEL_Y = 114;
const COACH_X = 1358;                    // = COL_B_X
const COACH_W = 538;

// ─── Palette ───────────────────────────────────────────────────────────────
// Generic head-and-shoulders, inlined as a data URI so it needs no network and
// survives the html-to-image pass. Layered UNDER the photo: if the photo 404s
// html-to-image swaps in a transparent placeholder and this shows through.
const SILHOUETTE = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" fill="#1a2233"/>' +
  '<circle cx="32" cy="24" r="11" fill="#39445c"/>' +
  '<path d="M10 62c0-12 10-19 22-19s22 7 22 19z" fill="#39445c"/>' +
  '</svg>');

const ACCENT_PINK = '#ff66c4';
// Loan players get a quiet "(L)" rather than a coloured name — colour on the
// name competes with the score, and the marker reads at any position in the list.
const LOAN_TAG = '<span style="color:#6f7c92;font-weight:600;">(L) </span>';
const LOAN_TAG_SM = '<span style="color:#5c6b82;font-weight:600;">(L) </span>';   // same accent as QuickCard / CoachCard
const BG = '#0a0f1c';
const HEADER_L = 'rgb(23,26,77)';
const HEADER_R = 'rgb(17,22,42)';

// Header colour options, same swatch set as QuickCard. Each is faded toward the
// card background exactly like CoachQuickCard does with a club colour, so the
// band keeps its depth instead of turning into a flat block.
// Six common club colours, each with a light and a dark variant. The previous
// set all faded to a similar navy because fadeHexToBG pulls hard toward the card
// background; the dark variants use a lighter fade so they stay distinguishable.
// Curated so every swatch is visibly different AFTER fadeHexToBG — several of
// the previous set (Indigo vs Blue Dark, Maroon vs Red Dark) collapsed to the
// same band once faded. `light: true` flips the header text to dark, which White
// and Silver need or the white type vanishes.
export const HEADER_COLOURS = {
  'Default': { hex: null,      fade: [0.62, 0.93] },
  'Navy':    { hex: '#1e3a8a', fade: [0.30, 0.78] },
  'Royal':   { hex: '#3b82f6', fade: [0.52, 0.88] },
  'Sky':     { hex: '#38bdf8', fade: [0.52, 0.88] },
  'Teal':    { hex: '#14b8a6', fade: [0.52, 0.88] },
  'Forest':  { hex: '#065f46', fade: [0.26, 0.76] },
  'Green':   { hex: '#22c55e', fade: [0.52, 0.88] },
  'Lime':    { hex: '#a3e635', fade: [0.56, 0.90] },
  'Amber':   { hex: '#f59e0b', fade: [0.52, 0.88] },
  'Orange':  { hex: '#ea580c', fade: [0.44, 0.85] },
  'Red':     { hex: '#ef4444', fade: [0.50, 0.87] },
  'Maroon':  { hex: '#7f1d1d', fade: [0.24, 0.74] },
  'Pink':    { hex: '#ff66c4', fade: [0.52, 0.88] },
  'Purple':  { hex: '#a855f7', fade: [0.50, 0.87] },
  'Violet':  { hex: '#4c1d95', fade: [0.26, 0.76] },
  'Bronze':  { hex: '#92400e', fade: [0.28, 0.77] },
  'Slate':   { hex: '#475569', fade: [0.40, 0.82] },
  'Black':   { hex: '#000000', fade: [0.10, 0.55] },
  'Silver':  { hex: '#cbd5e1', fade: [0.05, 0.30], light: true },
  'White':   { hex: '#ffffff', fade: [0.02, 0.22], light: true },
};
export const HEADER_COLOUR_NAMES = Object.keys(HEADER_COLOURS);

// Text palette for the band. A light header needs dark type or the white text
// disappears; everything else keeps the original colours.
function headerInk(spec) {
  return (spec && spec.light)
    ? { primary: '#0b1220', secondary: '#25324a', muted: '#55627a', soft: '#46536b',
        rule: 'rgba(0,0,0,0.13)', track: 'rgba(0,0,0,0.10)' }
    : { primary: '#fff', secondary: '#dbe3f0', muted: '#8fa0b8', soft: '#7f8ca3',
        rule: 'rgba(255,255,255,0.13)', track: 'rgba(255,255,255,0.10)' };
}

// ONE row language for every measured value in the band — style scores, average
// age, squad cost. Label left on a fixed column, track bar, value right. Sharing
// the geometry is what makes the header read as designed rather than as three
// separate widgets that happen to sit next to each other.
function statRow({ x, y, w, label, value, pct, colour, ink, rank, labelW = 74, valueW = 42 }) {
  const barL = x + labelW;
  const barR = x + w - valueW - 10;
  const fill = Math.max(0, Math.min(100, Number(pct) || 0));
  return `
    <div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:18px;">
      <span style="position:absolute;left:0;top:4px;font-size:8px;font-weight:700;
                   letter-spacing:0.13em;color:${ink.muted};white-space:nowrap;">${label}</span>
      <div style="position:absolute;left:${labelW}px;right:${valueW + 10}px;top:6px;height:5px;
                  border-radius:3px;background:${ink.track};overflow:hidden;">
        <div style="width:${fill.toFixed(0)}%;height:100%;background:${colour};border-radius:3px;"></div>
      </div>
      <span style="position:absolute;right:0;top:0;width:${valueW}px;text-align:right;
                   font-size:15px;font-weight:800;color:${colour};line-height:1.15;">${value}</span>
      ${rank ? `<span style="position:absolute;right:0;top:16px;width:${valueW}px;text-align:right;
                   font-size:8px;font-weight:700;color:${ink.muted};">${rank}</span>` : ''}
    </div>`;
}

// Circular gauge. Five of these in a row give the band a single, repeated shape
// instead of a hero-plus-rows split — closer to a broadcast graphic, and the
// arcs are directly comparable at a glance.
function scoreWheel({ cx, cy, r, stroke, value, label, colour, ink, big, labelY }) {
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const size = r * 2 + stroke + 2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
         style="position:absolute;left:${cx - size / 2}px;top:${cy - size / 2}px;">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
              stroke="${ink.track}" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
              stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round"
              stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}"
              transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="${size / 2}" y="${size / 2 + (big ? 9 : 7)}" text-anchor="middle"
            font-family="Montserrat,sans-serif" font-size="${big ? 26 : 20}"
            font-weight="900" fill="${colour}">${whole(value)}</text>
    </svg>
    <div style="position:absolute;left:${cx - 60}px;top:${labelY != null ? labelY : cy + size / 2 + 6}px;width:120px;
                text-align:center;font-size:8px;font-weight:700;letter-spacing:0.15em;
                color:${ink.muted};">${label}</div>`;
}

// ─── Season trend: league ladder position ─────────────────────────────────
// Plotting the overall score said little a scout couldn't already see. Where the
// club actually finished, on a ladder that spans divisions, shows the trajectory:
// 1st in Spain 2 sits directly below 20th in Spain 1, so promotion and relegation
// read as the steps they are rather than as unexplained jumps.

const leagueTier = (l) => {
  const m = String(l || '').trim().match(/(\d+)\.?$/);
  return m ? Number(m[1]) : 1;
};
const leagueCountry = (l) => String(l || '').trim().replace(/\s+\d+\.?$/, '').toLowerCase();

// "2021-22" -> "21-22". Single-year labels are left alone.
export function seasonShort(sn) {
  const t = String(sn || '').trim();
  const m = t.match(/^(\d{2})(\d{2})\s*[-/]\s*(\d{2,4})$/);
  return m ? `${m[2]}-${String(m[3]).slice(-2)}` : t;
}

// Position on a combined national ladder. Divisions above this one are stacked
// on top, so tier 2 position 1 lands just below the bottom of tier 1. Sizes come
// from the data where the division is present; 20 is the fallback when a tier
// isn't tracked, which keeps the shape right even if the offset isn't exact.
export function ladderPosition(row, allTeams) {
  const rank = Number(row && row.pointsRank);
  if (!rank || isNaN(rank)) return null;
  const country = leagueCountry(row.league);
  const tier = leagueTier(row.league);
  let offset = 0;
  for (let t = 1; t < tier; t++) {
    const n = (allTeams || []).filter(x =>
      leagueCountry(x.league) === country && leagueTier(x.league) === t
      && String(x.season) === String(row.season)).length;
    offset += n || 20;
  }
  return offset + rank;
}

// Catmull-Rom through the points, converted to cubic beziers — a straight
// polyline looked mechanical at this size.
function smoothPath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function trendChart({ x, y, w, h, seasons, allTeams, ink }) {
  const rows = (seasons || [])
    .filter(t => t && t.season && ladderPosition(t, allTeams) != null)
    .sort((a, b) => String(a.season) < String(b.season) ? -1 : 1)
    .slice(-5)
    .map(t => ({ ...t, pos: ladderPosition(t, allTeams), tier: leagueTier(t.league) }));

  // Shared with the season labels so the axis row reads as one line of type.
  const AXIS_FONT = `font-size:7.5px;font-weight:700;letter-spacing:0.08em;color:${ink.muted};`;

  if (rows.length < 2) {
    const caption = `<div style="position:absolute;left:${x}px;top:${HDR_LABEL_Y}px;width:${w}px;
        ${AXIS_FONT}">LEAGUE FINISH</div>`;
    return `<div style="position:absolute;left:${x}px;top:${y + 18}px;width:${w}px;
        font-size:10.5px;color:${ink.muted};">Not enough season history.</div>${caption}`;
  }

  // Crop to the range actually used rather than the whole pyramid, with a little
  // padding so the best and worst finishes aren't pinned to the edges.
  const vals = rows.map(r => r.pos);
  const best = Math.min(...vals), worst = Math.max(...vals);
  const pad = Math.max(2, Math.round((worst - best) * 0.25));
  const top = Math.max(1, best - pad), bot = worst + pad;
  const span = (bot - top) || 1;

  const VAL_W = 40;
  const plotW = w - VAL_W;
  const px = (i) => 4 + (i / (rows.length - 1)) * (plotW - 12);
  const py = (v) => 6 + ((v - top) / span) * (h - 14);   // 1st at the top

  const pts = rows.map((r, i) => [px(i), py(r.pos)]);
  const last = rows[rows.length - 1];
  const first = rows[0];
  const move = first.pos - last.pos;                      // + = climbed the ladder
  const moveCol = move === 0 ? ink.muted : move > 0 ? '#22c55e' : '#ef4444';

  const area = `${smoothPath(pts)} L ${pts[pts.length - 1][0].toFixed(1)} ${h} L ${pts[0][0].toFixed(1)} ${h} Z`;

  const dots = pts.map(([a, b], i) => {
    const cur = i === pts.length - 1;
    return `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${cur ? 3.2 : 2.1}"
             fill="${cur ? '#e8eef8' : ink.muted}"
             ${cur ? 'stroke="#e8eef8" stroke-opacity="0.25" stroke-width="4"' : ''}/>`;
  }).join('');

  // A tier change between two seasons gets a marker on the segment between them.
  const moves = rows.slice(1).map((r, i) => {
    const prev = rows[i];
    if (r.tier === prev.tier) return null;
    const up = r.tier < prev.tier;
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    return { mx, my, up };
  }).filter(Boolean);

  const moveMarks = moves.map(mk => `
    <line x1="${mk.mx.toFixed(1)}" y1="4" x2="${mk.mx.toFixed(1)}" y2="${h - 2}"
          stroke="${mk.up ? '#22c55e' : '#ef4444'}" stroke-opacity="0.35"
          stroke-width="1" stroke-dasharray="2 2"/>`).join('');

  const moveLabels = moves.map(mk => `
    <div style="position:absolute;left:${(x + mk.mx - 34).toFixed(0)}px;top:${(y + h - 13).toFixed(0)}px;
                width:68px;text-align:center;font-size:6.5px;font-weight:800;
                letter-spacing:0.1em;color:${mk.up ? '#22c55e' : '#ef4444'};">${
      mk.up ? 'PROMOTED' : 'RELEGATED'}</div>`).join('');

  return `
    <svg width="${plotW}" height="${h}" viewBox="0 0 ${plotW} ${h}"
         style="position:absolute;left:${x}px;top:${y}px;">
      <defs>
        <linearGradient id="trFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8fa0b8" stop-opacity="0.09"/>
          <stop offset="60%" stop-color="#8fa0b8" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#trFill)" stroke="none"/>
      ${moveMarks}
      <path d="${smoothPath(pts)}" fill="none" stroke="#c3ccdd" stroke-opacity="0.75"
            stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>
    ${moveLabels}
    <div style="position:absolute;left:${x + plotW + 8}px;top:${y + Math.round((h - 26) / 2)}px;
                width:${VAL_W - 8}px;">
      <div style="font-size:12.5px;font-weight:800;line-height:1;color:${ink.soft};">${last.pos}${
        last.pos % 10 === 1 && last.pos % 100 !== 11 ? 'st'
        : last.pos % 10 === 2 && last.pos % 100 !== 12 ? 'nd'
        : last.pos % 10 === 3 && last.pos % 100 !== 13 ? 'rd' : 'th'}</div>
      <div style="font-size:9px;font-weight:700;color:${moveCol};margin-top:4px;">${
        move === 0 ? '—' : `${move > 0 ? '▲' : '▼'}${Math.abs(move)}`}</div>
    </div>
    <div style="position:absolute;left:${x}px;top:${HDR_LABEL_Y}px;width:${plotW}px;display:flex;
                justify-content:space-between;${AXIS_FONT}">
      <span>${esc(seasonShort(first.season))}</span>
      <span>${esc(seasonShort(last.season))}</span>
    </div>
    <div style="position:absolute;left:${x}px;top:${HDR_LABEL_Y}px;width:${plotW}px;
                text-align:center;${AXIS_FONT}">LEAGUE FINISH</div>`;
}

function headerGradient(spec) {
  const def = `linear-gradient(to right, ${HEADER_L} 0%, ${HEADER_R} 100%)`;
  if (!spec || !spec.hex) return def;
  try {
    const [a, b] = spec.fade || [0.62, 0.93];
    return `linear-gradient(to right, ${fadeHexToBG(spec.hex, a)} 0%, ${fadeHexToBG(spec.hex, b)} 100%)`;
  } catch (e) { return def; }
}
const PANEL_BG = 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))';
const PANEL_BORDER = 'rgba(255,255,255,0.13)';
const PANEL_SHADOW = '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)';
const PANEL_RADIUS = 14;
const PANEL_PAD = 20;
const TITLE_H = 34;

// Continuous 0-100 ramp: red -> gold -> green. Used for XI scores, where a
// smooth gradient reads better than the five hard bands scoreColor() applies
// to the team-level numbers (those stay banded to match TeamIndex's table).
const RAMP = [[0, [239, 68, 68]], [50, [251, 199, 1]], [100, [0, 191, 99]]];
function gradeColor(v) {
  if (v == null || isNaN(v)) return '#64748b';
  const x = Math.max(0, Math.min(100, Number(v)));
  let a = RAMP[0], b = RAMP[RAMP.length - 1];
  for (let i = 0; i < RAMP.length - 1; i++) {
    if (x >= RAMP[i][0] && x <= RAMP[i + 1][0]) { a = RAMP[i]; b = RAMP[i + 1]; break; }
  }
  const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
  const c = [0, 1, 2].map(i => Math.round(a[1][i] + (b[1][i] - a[1][i]) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function scoreColor(v) {
  if (v == null) return '#475569';
  if (v >= 80) return '#00bf63';
  if (v >= 65) return '#22c55e';
  if (v >= 50) return '#fbc701';
  if (v >= 35) return '#f18c31';
  return '#ef4444';
}
// Rank of this team within its league+season on a field, as {rank, size}.
// Mirrors CoachCard's _rankIn so the header reads the same way as the coach card.
function rankIn(allTeams, team, field, higherIsBetter = true) {
  const pool = (allTeams || []).filter(t =>
    String(t.league) === String(team.league) && String(t.season) === String(team.season)
    && t[field] != null && !isNaN(Number(t[field])));
  if (pool.length < 2) return null;
  const sorted = pool.slice().sort((a, b) =>
    higherIsBetter ? Number(b[field]) - Number(a[field]) : Number(a[field]) - Number(b[field]));
  const i = sorted.findIndex(t => t.team === team.team);
  return i < 0 ? null : { rank: i + 1, size: sorted.length };
}
// "10/24" with the denominator dimmed, same treatment as the quick card.
const rankStr = (r) => r ? `${r.rank}<span style="color:#6b7385;font-weight:600;">/${r.size}</span>` : '—';

const whole = (v) => (v == null || isNaN(v) ? '—' : String(Math.round(Number(v))));
const fmt = (v, dp = 1) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(dp));
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─── Panel chrome ──────────────────────────────────────────────────────────
function panel({ x, y, w, h, title, right = '', body }) {
  return `
    <div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;
                background:${PANEL_BG};border:1px solid ${PANEL_BORDER};
                border-radius:${PANEL_RADIUS}px;box-shadow:${PANEL_SHADOW};
                box-sizing:border-box;padding:${PANEL_PAD}px;overflow:hidden;">
      <div style="height:${TITLE_H}px;position:relative;">
        <span style="font-size:15px;font-weight:700;letter-spacing:0.12em;
                     text-transform:uppercase;color:${ACCENT_PINK};">${title}</span>
        ${right ? `<span style="position:absolute;right:0;top:1px;font-size:13px;white-space:nowrap;
                     font-weight:700;color:#64748b;letter-spacing:0.06em;">${right}</span>` : ''}
      </div>
      <div style="height:${h - PANEL_PAD * 2 - TITLE_H}px;position:relative;">${body}</div>
    </div>`;
}

function stub(w, h, note) {
  return `
    <div style="position:absolute;inset:0;border:1px dashed rgba(255,255,255,0.16);
                border-radius:10px;display:flex;flex-direction:column;
                align-items:center;justify-content:center;color:#475569;">
      <div style="font-size:13px;font-weight:600;letter-spacing:0.08em;">${w} x ${h}</div>
      <div style="font-size:12px;color:#3d4a5e;margin-top:6px;">${note}</div>
    </div>`;
}

// ───────────────────────────────────────────────────────────────────────────
// XI ENGINE — ported from the Streamlit Squad Depth Chart (app.py v8).
//
// Assignment is driven by the player's PRIMARY POSITION — the first token of the
// raw Wyscout `position` string ("RCB, RB, CB" -> "RCB") — not by roleKey/side.
// roleKey only has six buckets and can't tell RCB from LCB or DMF from RCMF.
// Slot coordinates, accepts lists and side preferences are lifted verbatim from
// the Streamlit app so the XI matches what the depth chart already produces.
//
// NOTE: the Streamlit "5-3-2" defines TWELVE slots (LCB, CB1, CB2, RCB plus two
// wing-backs = a back six), so it's omitted here rather than guessing which
// centre-back to drop. Worth fixing in app.py too.
// ───────────────────────────────────────────────────────────────────────────

// Wyscout emits numeric variants in some exports ("RCMF3", "LCMF3"), and canon()
// below silently defaults ANY unrecognised token to 'CM' — so an unmapped winger
// quietly becomes a central midfielder and its slot renders empty. Stripping the
// trailing digits catches the common case; reportUnmappedTokens() surfaces the rest.
const normTok = (t) => String(t || '').trim().toUpperCase().replace(/\d+$/, '');
const posTok = (p) => normTok(String(p.position || '').split(',')[0]);
const allToks = (p) => String(p.position || '').split(',').map(normTok).filter(Boolean);

// Wyscout token -> slot label.
const CANONICAL = {
  GK: 'GK', CB: 'CB', LCB: 'LCB', RCB: 'RCB',
  LB: 'LB', LWB: 'LWB', RB: 'RB', RWB: 'RWB',
  DMF: 'DM', LDMF: 'DM', RDMF: 'DM', LCMF: 'CM', RCMF: 'CM',
  AMF: 'AM', LAMF: 'LW', LW: 'LW', LWF: 'LW',
  RAMF: 'RW', RW: 'RW', RWF: 'RW', CF: 'ST',
};
const SIDE_PREF = {
  RCB: 'R', RCMF: 'R', RDMF: 'R', RB: 'R', RWB: 'R', RW: 'R', RWF: 'R', RAMF: 'R',
  LCB: 'L', LCMF: 'L', LDMF: 'L', LB: 'L', LWB: 'L', LW: 'L', LWF: 'L', LAMF: 'L',
};
const canon = (t) => CANONICAL[t] || 'CM';

// Any squad token with no CANONICAL entry. These are the ones silently collapsing
// to 'CM', so if a slot is mysteriously empty this is the first place to look.
export function reportUnmappedTokens(squad) {
  const bad = {};
  for (const p of squad) {
    for (const t of allToks(p)) {
      if (!CANONICAL[t]) (bad[t] = bad[t] || []).push(p.name);
    }
  }
  return bad;
}
const sideOf = (p) => SIDE_PREF[posTok(p)] || 'N';

// Positional adjacency, best fit first. Tier 0 (the slot's own label) is handled
// by passes 1 and 2; these are the "who else could actually do this job" tiers
// used by pass 3 so an XI is never left with holes.
//
// Reasoning is football, not data: a full-back covers centre-back before a
// midfielder does; a winger covers the opposite flank before dropping to
// wing-back; a striker covers the wide slots before a central midfielder does.
const NEIGHBOURS = {
  GK:  [],                                                   // never substituted
  CB:  [['LCB', 'RCB'], ['LB', 'RB', 'LWB', 'RWB'], ['DM']],
  LCB: [['CB', 'RCB'], ['LB', 'LWB'], ['DM']],
  RCB: [['CB', 'LCB'], ['RB', 'RWB'], ['DM']],
  LB:  [['LWB'], ['LCB', 'CB'], ['LW'], ['RB', 'RWB']],
  RB:  [['RWB'], ['RCB', 'CB'], ['RW'], ['LB', 'LWB']],
  LWB: [['LB'], ['LW'], ['LCB', 'CB']],
  RWB: [['RB'], ['RW'], ['RCB', 'CB']],
  DM:  [['CM'], ['CB', 'LCB', 'RCB'], ['AM']],
  CM:  [['DM'], ['AM'], ['LW', 'RW']],
  AM:  [['CM'], ['LW', 'RW'], ['ST'], ['DM']],
  LW:  [['AM'], ['ST'], ['RW'], ['LWB', 'LB']],
  RW:  [['AM'], ['ST'], ['LW'], ['RWB', 'RB']],
  ST:  [['AM'], ['LW', 'RW'], ['CM']],
};

// Slots are filled back-to-front in this order — specialists (GK, centre-backs)
// claim their players before the generalist slots get a look in.
const PITCH_ORDER = ['GK','LCB','CB','RCB','LB','RB','LWB','RWB','CM','DM','AM','LW','RW','ST'];

// Does a player's primary token suit this slot label, natively or via the
// adjacency tiers? Used to sort the manual picker so sensible names come first.
export function slotFitRank(p, label) {
  const c = canon(posTok(p));
  if (c === label) return 0;
  const tiers = NEIGHBOURS[label] || [];
  for (let i = 0; i < tiers.length; i++) if (tiers[i].includes(c)) return i + 1;
  return 99;
}

const FORMATIONS = {
  '4-2-3-1': [
    {"id":"ST","label":"ST","x":50,"y":14,"accepts":["ST"],"side":"N"},
    {"id":"LW","label":"LW","x":13,"y":30,"accepts":["LW"],"side":"L","native":["LW","LWF","LAMF"]},
    {"id":"AM","label":"AM","x":50,"y":32,"accepts":["AM"],"side":"N","native":["AMF"],"prio":["AMF"]},
    {"id":"RW","label":"RW","x":87,"y":30,"accepts":["RW"],"side":"R","native":["RW","RWF","RAMF"]},
    {"id":"DM","label":"DM","x":35,"y":51,"accepts":["DM"],"side":"L"},
    {"id":"CM","label":"CM","x":65,"y":51,"accepts":["CM"],"side":"R"},
    {"id":"LB","label":"LB","x":12,"y":66,"accepts":["LB","LWB"],"side":"L","wb":1},
    {"id":"CB1","label":"CB","x":32,"y":72,"accepts":["CB","LCB","RCB"],"side":"L"},
    {"id":"CB2","label":"CB","x":68,"y":72,"accepts":["CB","LCB","RCB"],"side":"R"},
    {"id":"RB","label":"RB","x":88,"y":66,"accepts":["RB","RWB"],"side":"R","wb":1},
    {"id":"GK","label":"GK","x":50,"y":89,"accepts":["GK"],"side":"N"},
  ],
  '4-3-3': [
    {"id":"ST","label":"ST","x":50,"y":14,"accepts":["ST"],"side":"N"},
    {"id":"LW","label":"LW","x":14,"y":21,"accepts":["LW"],"side":"L","native":["LW","LWF","LAMF"]},
    {"id":"RW","label":"RW","x":86,"y":21,"accepts":["RW"],"side":"R","native":["RW","RWF","RAMF"]},
    {"id":"CM","label":"CM","x":22,"y":41,"accepts":["CM"],"side":"L"},
    {"id":"DM","label":"DM","x":50,"y":49,"accepts":["DM"],"side":"N"},
    {"id":"AM","label":"AM","x":78,"y":41,"accepts":["AM"],"side":"R"},
    {"id":"LB","label":"LB","x":12,"y":66,"accepts":["LB","LWB"],"side":"L","wb":1},
    {"id":"CB1","label":"CB","x":32,"y":72,"accepts":["CB","LCB","RCB"],"side":"L"},
    {"id":"CB2","label":"CB","x":68,"y":72,"accepts":["CB","LCB","RCB"],"side":"R"},
    {"id":"RB","label":"RB","x":88,"y":66,"accepts":["RB","RWB"],"side":"R","wb":1},
    {"id":"GK","label":"GK","x":50,"y":89,"accepts":["GK"],"side":"N"},
  ],
  '4-4-2': [
    {"id":"ST1","label":"ST","x":35,"y":14,"accepts":["ST"],"side":"L"},
    {"id":"ST2","label":"ST","x":65,"y":14,"accepts":["ST"],"side":"R"},
    {"id":"LW","label":"LW","x":5,"y":33,"accepts":["LW"],"side":"L","native":["LW","LWF","LAMF"]},
    {"id":"CM1","label":"CM","x":34,"y":43,"accepts":["CM"],"side":"L"},
    {"id":"CM2","label":"CM","x":66,"y":43,"accepts":["CM"],"side":"R"},
    {"id":"RW","label":"RW","x":95,"y":33,"accepts":["RW"],"side":"R","native":["RW","RWF","RAMF"]},
    {"id":"LB","label":"LB","x":12,"y":66,"accepts":["LB","LWB"],"side":"L","wb":1},
    {"id":"CB1","label":"CB","x":32,"y":72,"accepts":["CB","LCB","RCB"],"side":"L"},
    {"id":"CB2","label":"CB","x":68,"y":72,"accepts":["CB","LCB","RCB"],"side":"R"},
    {"id":"RB","label":"RB","x":88,"y":66,"accepts":["RB","RWB"],"side":"R","wb":1},
    {"id":"GK","label":"GK","x":50,"y":89,"accepts":["GK"],"side":"N"},
  ],
  '3-5-2': [
    {"id":"ST1","label":"ST","x":35,"y":14,"accepts":["ST"],"side":"L"},
    {"id":"ST2","label":"ST","x":65,"y":14,"accepts":["ST"],"side":"R"},
    {"id":"LWB","label":"LWB","x":13,"y":37,"accepts":["LWB","LB"],"side":"L","wb":1},
    {"id":"AM","label":"AM","x":30,"y":41,"accepts":["AM"],"side":"L"},
    {"id":"DM","label":"DM","x":50,"y":48,"accepts":["DM"],"side":"N"},
    {"id":"CM","label":"CM","x":70,"y":41,"accepts":["CM"],"side":"R"},
    {"id":"RWB","label":"RWB","x":87,"y":37,"accepts":["RWB","RB"],"side":"R","wb":1},
    {"id":"LCB","label":"LCB","x":25,"y":67,"accepts":["LCB","CB"],"side":"L"},
    {"id":"CB","label":"CB","x":50,"y":71,"accepts":["CB","LCB","RCB"],"side":"N"},
    {"id":"RCB","label":"RCB","x":75,"y":67,"accepts":["RCB","CB"],"side":"R"},
    {"id":"GK","label":"GK","x":50,"y":88,"accepts":["GK"],"side":"N"},
  ],
  '3-4-1-2': [
    {"id":"ST1","label":"ST","x":35,"y":13,"accepts":["ST"],"side":"L"},
    {"id":"ST2","label":"ST","x":65,"y":13,"accepts":["ST"],"side":"R"},
    {"id":"AM","label":"AM","x":50,"y":25,"accepts":["AM","LW","RW"],"side":"N","native":["AMF"],"prio":["AMF"]},
    {"id":"LWB","label":"LWB","x":13,"y":40,"accepts":["LWB","LB"],"side":"L","wb":1},
    {"id":"CM1","label":"CM","x":34,"y":44,"accepts":["CM"],"side":"L"},
    {"id":"CM2","label":"CM","x":66,"y":44,"accepts":["CM"],"side":"R"},
    {"id":"RWB","label":"RWB","x":87,"y":40,"accepts":["RWB","RB"],"side":"R","wb":1},
    {"id":"LCB","label":"LCB","x":25,"y":66,"accepts":["LCB","CB"],"side":"L"},
    {"id":"CB","label":"CB","x":50,"y":70,"accepts":["CB","LCB","RCB"],"side":"N"},
    {"id":"RCB","label":"RCB","x":75,"y":66,"accepts":["RCB","CB"],"side":"R"},
    {"id":"GK","label":"GK","x":50,"y":87,"accepts":["GK"],"side":"N"},
  ],
  '3-4-3': [
    {"id":"LW","label":"LW","x":14,"y":21,"accepts":["LW"],"side":"L","native":["LW","LWF","LAMF"]},
    {"id":"ST","label":"ST","x":50,"y":14,"accepts":["ST"],"side":"N"},
    {"id":"RW","label":"RW","x":86,"y":21,"accepts":["RW"],"side":"R","native":["RW","RWF","RAMF"]},
    {"id":"LWB","label":"LWB","x":13,"y":45,"accepts":["LWB","LB"],"side":"L","wb":1},
    {"id":"CM","label":"CM","x":38,"y":43,"accepts":["CM"],"side":"L"},
    {"id":"DM","label":"DM","x":62,"y":43,"accepts":["DM"],"side":"R"},
    {"id":"RWB","label":"RWB","x":87,"y":45,"accepts":["RWB","RB"],"side":"R","wb":1},
    {"id":"LCB","label":"LCB","x":25,"y":67,"accepts":["LCB","CB"],"side":"L"},
    {"id":"CB","label":"CB","x":50,"y":71,"accepts":["CB","LCB","RCB"],"side":"N"},
    {"id":"RCB","label":"RCB","x":75,"y":67,"accepts":["RCB","CB"],"side":"R"},
    {"id":"GK","label":"GK","x":50,"y":88,"accepts":["GK"],"side":"N"},
  ],
  '4-1-4-1': [
    {"id":"ST","label":"ST","x":50,"y":14,"accepts":["ST"],"side":"N"},
    {"id":"LW","label":"LW","x":9,"y":31,"accepts":["LW"],"side":"L","native":["LW","LWF","LAMF"]},
    {"id":"AM","label":"AM","x":30,"y":38,"accepts":["AM"],"side":"L","native":["AMF"],"prio":["AMF"]},
    {"id":"DM","label":"DM","x":50,"y":41,"accepts":["DM"],"side":"N"},
    {"id":"CM","label":"CM","x":70,"y":38,"accepts":["CM"],"side":"R"},
    {"id":"RW","label":"RW","x":91,"y":31,"accepts":["RW"],"side":"R","native":["RW","RWF","RAMF"]},
    {"id":"LB","label":"LB","x":12,"y":66,"accepts":["LB","LWB"],"side":"L","wb":1},
    {"id":"CB1","label":"CB","x":32,"y":72,"accepts":["CB","LCB","RCB"],"side":"L"},
    {"id":"CB2","label":"CB","x":68,"y":72,"accepts":["CB","LCB","RCB"],"side":"R"},
    {"id":"RB","label":"RB","x":88,"y":66,"accepts":["RB","RWB"],"side":"R","wb":1},
    {"id":"GK","label":"GK","x":50,"y":89,"accepts":["GK"],"side":"N"},
  ],
  '4-2-3-1 (CM)': [
    {"id":"ST","label":"ST","x":50,"y":14,"accepts":["ST"],"side":"N"},
    {"id":"LW","label":"LW","x":13,"y":30,"accepts":["LW"],"side":"L","native":["LW","LWF","LAMF"]},
    {"id":"AM","label":"AM","x":50,"y":32,"accepts":["AM"],"side":"N","native":["AMF"],"prio":["AMF"]},
    {"id":"RW","label":"RW","x":87,"y":30,"accepts":["RW"],"side":"R","native":["RW","RWF","RAMF"]},
    {"id":"LCM","label":"CM","x":35,"y":51,"accepts":["CM"],"side":"L"},
    {"id":"RCM","label":"CM","x":65,"y":51,"accepts":["CM"],"side":"R"},
    {"id":"LB","label":"LB","x":12,"y":66,"accepts":["LB","LWB"],"side":"L","wb":1},
    {"id":"CB1","label":"CB","x":32,"y":72,"accepts":["CB","LCB","RCB"],"side":"L"},
    {"id":"CB2","label":"CB","x":68,"y":72,"accepts":["CB","LCB","RCB"],"side":"R"},
    {"id":"RB","label":"RB","x":88,"y":66,"accepts":["RB","RWB"],"side":"R","wb":1},
    {"id":"GK","label":"GK","x":50,"y":89,"accepts":["GK"],"side":"N"},
  ],
  '4-3-3 (CM)': [
    {"id":"ST","label":"ST","x":50,"y":14,"accepts":["ST"],"side":"N"},
    {"id":"LW","label":"LW","x":14,"y":21,"accepts":["LW"],"side":"L","native":["LW","LWF","LAMF"]},
    {"id":"RW","label":"RW","x":86,"y":21,"accepts":["RW"],"side":"R","native":["RW","RWF","RAMF"]},
    {"id":"CM1","label":"CM","x":22,"y":41,"accepts":["CM"],"side":"L"},
    {"id":"DM","label":"DM","x":50,"y":49,"accepts":["DM"],"side":"N"},
    {"id":"CM2","label":"CM","x":78,"y":41,"accepts":["CM"],"side":"R"},
    {"id":"LB","label":"LB","x":12,"y":66,"accepts":["LB","LWB"],"side":"L","wb":1},
    {"id":"CB1","label":"CB","x":32,"y":72,"accepts":["CB","LCB","RCB"],"side":"L"},
    {"id":"CB2","label":"CB","x":68,"y":72,"accepts":["CB","LCB","RCB"],"side":"R"},
    {"id":"RB","label":"RB","x":88,"y":66,"accepts":["RB","RWB"],"side":"R","wb":1},
    {"id":"GK","label":"GK","x":50,"y":89,"accepts":["GK"],"side":"N"},
  ],
  '4-3-1-2': [
    {"id":"ST1","label":"ST","x":35,"y":14,"accepts":["ST"],"side":"L"},
    {"id":"ST2","label":"ST","x":65,"y":14,"accepts":["ST"],"side":"R"},
    {"id":"AM","label":"AM","x":50,"y":28,"accepts":["AM"],"side":"N","native":["AMF"],"prio":["AMF"]},
    {"id":"CM1","label":"CM","x":22,"y":42,"accepts":["CM"],"side":"L"},
    {"id":"DM","label":"DM","x":50,"y":48,"accepts":["DM"],"side":"N"},
    {"id":"CM2","label":"CM","x":78,"y":42,"accepts":["CM"],"side":"R"},
    {"id":"LB","label":"LB","x":12,"y":66,"accepts":["LB","LWB"],"side":"L","wb":1},
    {"id":"CB1","label":"CB","x":32,"y":72,"accepts":["CB","LCB","RCB"],"side":"L"},
    {"id":"CB2","label":"CB","x":68,"y":72,"accepts":["CB","LCB","RCB"],"side":"R"},
    {"id":"RB","label":"RB","x":88,"y":66,"accepts":["RB","RWB"],"side":"R","wb":1},
    {"id":"GK","label":"GK","x":50,"y":89,"accepts":["GK"],"side":"N"},
  ],
  '3-4-2-1': [
    {"id":"ST","label":"ST","x":50,"y":14,"accepts":["ST"],"side":"N"},
    {"id":"LAM","label":"AM","x":22,"y":24,"accepts":["LW","AM"],"side":"L","native":["LW","LWF","LAMF","AMF"]},
    {"id":"RAM","label":"AM","x":78,"y":24,"accepts":["RW","AM"],"side":"R","native":["RW","RWF","RAMF","AMF"]},
    {"id":"LWB","label":"LWB","x":13,"y":45,"accepts":["LWB","LB"],"side":"L","wb":1},
    {"id":"CM","label":"CM","x":38,"y":43,"accepts":["CM"],"side":"L"},
    {"id":"DM","label":"DM","x":62,"y":43,"accepts":["DM"],"side":"R"},
    {"id":"RWB","label":"RWB","x":87,"y":45,"accepts":["RWB","RB"],"side":"R","wb":1},
    {"id":"LCB","label":"LCB","x":25,"y":67,"accepts":["LCB","CB"],"side":"L"},
    {"id":"CB","label":"CB","x":50,"y":71,"accepts":["CB","LCB","RCB"],"side":"N"},
    {"id":"RCB","label":"RCB","x":75,"y":67,"accepts":["RCB","CB"],"side":"R"},
    {"id":"GK","label":"GK","x":50,"y":88,"accepts":["GK"],"side":"N"},
  ],
};
const FORMATION_NAMES = Object.keys(FORMATIONS);

// Slots tagged wb_only accept ONLY genuine full-backs/wing-backs by first token —
// stops a centre-back drifting into a wing-back slot.
function firstTokFits(p, slot) {
  const tok = posTok(p);
  if (slot.wb) return ['LB','LWB','RB','RWB'].includes(tok) && slot.accepts.includes(canon(tok));
  return slot.accepts.includes(canon(tok));
}
// Secondary tokens only — used as a last resort for players whose primary
// position has no slot at all in this formation.
function secondaryFits(p, slot) {
  if (slot.wb) return false;
  return allToks(p).slice(1).some(t => slot.accepts.includes(canon(t)));
}
function sideScore(p, slotSide) {
  const ps = sideOf(p);
  if (slotSide === 'N' || ps === 'N') return 1;
  return ps === slotSide ? 0 : 2;
}

// A depth player has to have actually played THIS season — 50+ minutes.
//
// minutesLatest is the wrong field for this: it's the player's most recent
// recorded season, which for someone who hasn't featured is last year's number.
// That's how a 37-year-old with no minutes this term showed up as depth.
// allSeasonsSummary carries {s, mins} per season, which is what App.js uses
// for its "played 25-26" filter, so season minutes come from there.
export const DEPTH_MIN_MINUTES = 50;

// Season labels appear in two shapes across the data ('2025-26' and '2026'),
// so accept either form of the team's season.
export function seasonMinutes(p, season) {
  const rows = p && p.allSeasonsSummary;
  if (!Array.isArray(rows) || !season) return null;   // null = can't tell
  const want = String(season);
  const alt = want.includes('-') ? String(Number(want.slice(0, 4)) + 1) : want;
  const hits = rows.filter(x => String(x.s) === want || String(x.s) === alt);
  if (!hits.length) return 0;
  return hits.reduce((a, x) => a + (Number(x.mins) || 0), 0);
}

// overrides: { [slot.id]: playerKey } — a manual pick wins over the auto choice
// and is removed from every other slot so nobody appears twice.
// overridePool lets a manual pick come from OUTSIDE the squad — useful for
// showing a target in the XI before he's signed.
// slotLists: { [slot.id]: [playerKey, ...] } — an explicit, ordered list for a
// slot. [] means "leave this slot empty" (they genuinely have no RW), which the
// auto-fill can't express on its own. Position 0 is the starter, the rest depth.
export function buildXI(formationKey, squad, depthCount = 2, season = null, overrides = null, overridePool = null, slotLists = null) {
  const slots = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
  const mins = (p) => Number(p.minutesLatest || 0);

  const byLabel = {};
  slots.forEach(s => { (byLabel[s.label] = byLabel[s.label] || []).push(s); });
  const labelSet = new Set(Object.keys(byLabel));
  const hasPrimarySlot = (p) => labelSet.has(canon(posTok(p)));

  const assigned = new Set();
  const slotMap = {};

  for (const label of PITCH_ORDER) {
    const list = byLabel[label];
    if (!list) continue;

    // Pass 1 — players whose FIRST token fits this slot.
    let matched = squad.filter(p => !assigned.has(p) && list.some(s => firstTokFits(p, s)));
    // Pass 2 — only if pass 1 found nobody: players with no primary slot anywhere
    // in this formation whose secondary tokens fit here.
    if (!matched.length) {
      matched = squad.filter(p => !assigned.has(p) && !hasPrimarySlot(p)
                                  && list.some(s => secondaryFits(p, s)));
    }

    matched.sort((a, b) => mins(b) - mins(a));

    // priority_toks nudges specific tokens to the front within first-token
    // matches (e.g. a natural AMF ahead of a LAMF for the AM slot).
    const prio = new Set(list.flatMap(s => s.prio || []));
    if (prio.size) {
      matched.sort((a, b) => {
        const ap = prio.has(posTok(a)) ? 0 : 1, bp = prio.has(posTok(b)) ? 0 : 1;
        return ap - bp || mins(b) - mins(a);
      });
    }

    matched.forEach(p => assigned.add(p));

    if (list.length === 1) {
      slotMap[list[0].id] = matched;
    } else {
      // Two slots share a label (CB1/CB2, ST1/ST2...). Give each its best-fitting
      // starter by side preference, then round-robin the rest as depth.
      const ordered = list.slice().sort((a, b) =>
        ({ L: 0, N: 1, R: 2 })[a.side] - ({ L: 0, N: 1, R: 2 })[b.side]);
      ordered.forEach(s => { slotMap[s.id] = []; });
      const used = new Set();
      for (const s of ordered) {
        let best = null, bestSc = 99;
        for (const p of matched) {
          if (used.has(p)) continue;
          const sc = sideScore(p, s.side);
          if (sc < bestSc) { bestSc = sc; best = p; }
        }
        if (best) { slotMap[s.id].push(best); used.add(best); }
      }
      matched.filter(p => !used.has(p)).forEach((p, i) => {
        slotMap[ordered[i % ordered.length].id].push(p);
      });
    }
  }

  // Pass 3 — fill anything still empty using positional adjacency, best tier
  // first, ranked by minutes within a tier.
  //
  // Crucially this draws from anyone who isn't already a STARTER, not just the
  // fully unassigned. Passes 1 and 2 hoover up every token-matching player into
  // a slot's depth list, so by this point a 20-man squad can have nobody "spare"
  // at all — the AM slot sat empty while three centre-mids idled on the bench.
  // Promoting a depth player and removing him from that list is the right call:
  // a hole in the XI is worse than an honest out-of-position pick, which gets
  // flagged orange with the player's real token.
  const starterOf = (id) => (slotMap[id] || [])[0] || null;
  const starterSet = new Set();
  for (const id of Object.keys(slotMap)) { const st = starterOf(id); if (st) starterSet.add(st); }
  const removeFromDepth = (p) => {
    for (const id of Object.keys(slotMap)) {
      const i = (slotMap[id] || []).indexOf(p);
      if (i > 0) { slotMap[id].splice(i, 1); return; }
    }
  };

  for (const label of PITCH_ORDER) {
    const list = byLabel[label];
    if (!list) continue;
    for (const sl of list) {
      if ((slotMap[sl.id] || []).length) continue;
      const free = (pred) => squad
        .filter(p => !starterSet.has(p) && pred(p))
        .sort((a, b) => mins(b) - mins(a));

      let pick = null;
      for (const tier of (NEIGHBOURS[sl.label] || [])) {
        const c = free(p => tier.includes(canon(posTok(p))));
        if (c.length) { pick = c[0]; break; }
      }
      // Last resort: any outfielder left, most minutes. Never a keeper.
      if (!pick && sl.label !== 'GK') {
        pick = free(p => canon(posTok(p)) !== 'GK')[0] || null;
      }
      if (pick) {
        removeFromDepth(pick);
        slotMap[sl.id] = [pick];
        starterSet.add(pick);
      }
    }
  }

  // Apply manual overrides last: pin the chosen player to the slot, then strip
  // them from anywhere else they'd been placed.
  if (overrides && Object.keys(overrides).length) {
    const byKey = new Map((overridePool || squad).map(p => [playerKey(p), p]));
    for (const slotId of Object.keys(overrides)) {
      const p = byKey.get(overrides[slotId]);
      if (!p) continue;
      for (const id of Object.keys(slotMap)) {
        if (id === slotId) continue;
        slotMap[id] = (slotMap[id] || []).filter(x => x !== p);
      }
      const rest = (slotMap[slotId] || []).filter(x => x !== p);
      slotMap[slotId] = [p, ...rest];
    }
  }

  // Explicit lists are applied last and are absolute — including an empty one.
  if (slotLists) {
    const byKey = new Map((overridePool || squad).map(p => [playerKey(p), p]));
    for (const slotId of Object.keys(slotLists)) {
      const keys = slotLists[slotId];
      if (!Array.isArray(keys)) continue;
      const chosen = keys.map(k => byKey.get(k)).filter(Boolean);
      const set = new Set(chosen);
      // Anyone pinned here is removed from every other slot.
      for (const id of Object.keys(slotMap)) {
        if (id === slotId) continue;
        slotMap[id] = (slotMap[id] || []).filter(x => !set.has(x));
      }
      slotMap[slotId] = chosen;
    }
  }

  return slots.map(slot => {
    const list = slotMap[slot.id] || [];
    const explicit = slotLists && Array.isArray(slotLists[slot.id]);
    const starter = list[0] || null;
    // Out of position: starter's primary token doesn't natively belong here.
    const oop = starter
      ? !(slot.native ? slot.native.includes(posTok(starter)) : firstTokFits(starter, slot))
      : false;
    // An explicit list is taken as-is: the user chose these, so the minutes
    // filter and the depth cap don't apply.
    const depth = explicit ? list.slice(1) : list.slice(1)
      .filter(p => {
        const sm = seasonMinutes(p, season);
        // No allSeasonsSummary at all -> fall back to minutesLatest rather than
        // silently dropping everyone.
        return sm == null ? Number(p.minutesLatest || 0) >= DEPTH_MIN_MINUTES
                          : sm >= DEPTH_MIN_MINUTES;
      })
      .slice(0, Math.max(0, depthCount));
    return { slot, starter, oop, depth };
  });
}

// Overall XI rating — mean careerScore of the filled starting slots.
export function xiRating(xi) {
  const vals = xi.map(s => s.starter && s.starter.careerScore)
                 .filter(v => typeof v === 'number' && !isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ─── XI panel ──────────────────────────────────────────────────────────────
const SLOT_W = 196;
const SLOT_H = 138;
const FACE = 62;
function xiPanelHtml(w, h, xi, opts = {}) {
  const { hideScores = false, metaMode = 'age', season = null } = opts;
  const line = 'rgba(255,255,255,0.10)';

  const blocks = xi.map(({ slot, starter, oop, depth }) => {
    const cx = (slot.x / 100) * w, cy = (slot.y / 100) * h;   // Streamlit coords are 0-100
    const left = Math.max(-8, Math.min(w - SLOT_W + 8, cx - SLOT_W / 2));
    const top = Math.max(2, Math.min(h - SLOT_H, cy - 34));

    const sc = starter ? starter.careerScore : null;
    const img = starter ? photoUrl(starter.name, starter.team) : '';
    const tok = starter ? String(starter.position || '').split(',')[0].trim() : '';
    // Age (or contract years remaining) in a dimmer grey so the name reads first.
    const meta = (!starter || metaMode === 'none') ? ''
      : metaMode === 'contract'
        ? contractLeft(starter, season)
        : (starter.age != null ? String(starter.age) : '');
    const age = meta ? ` <span style="color:#7c8798;font-weight:600;">(${meta})</span>` : '';

    // Ring is neutral grey — colour lives in the score, so the two don't compete.
    const face = starter
      ? `<div style="position:absolute;left:50%;margin-left:-${FACE / 2}px;top:0;
                     width:${FACE}px;height:${FACE}px;border-radius:50%;
                     background-color:#1a2233;
                     background-image:url('${src(img)}'), url('${SILHOUETTE}');
                     background-size:cover, cover;
                     background-position:center top, center top;
                     background-repeat:no-repeat, no-repeat;
                     border:1.5px solid rgba(190,203,224,0.26);
                     box-shadow:0 0 0 3px rgba(255,255,255,0.035);"></div>`
      : `<div style="position:absolute;left:50%;margin-left:-${FACE / 2}px;top:0;
                     width:${FACE}px;height:${FACE}px;border-radius:50%;
                     background:rgba(255,255,255,0.05);
                     border:1px dashed rgba(255,255,255,0.20);
                     display:flex;align-items:center;justify-content:center;
                     font-size:11px;font-weight:700;color:#475569;">${slot.label}</div>`;

    // Score hangs off the photo's right edge, absolutely placed — so the name
    // below can centre on the PHOTO rather than on photo+score combined.
    const score = (sc == null || hideScores) ? '' :
      `<div style="position:absolute;left:50%;margin-left:${FACE / 2 + 7}px;top:19px;
                   font-size:22px;font-weight:800;line-height:1;
                   color:${gradeColor(sc)};">${Math.round(sc)}</div>`;

    // Out-of-position tag removed — it pushed the name into truncation and the
    // pitch position already conveys where the player is being used.
    const oopTag = '';

    const depthNames = depth.map(d =>
      `<div style="font-size:12.5px;color:#93a1b5;line-height:1.42;white-space:nowrap;
                   overflow:hidden;text-overflow:ellipsis;">${d.onLoan ? LOAN_TAG_SM : ''}${esc(d.name)}${
        (() => {
          if (metaMode === 'none') return '';
          const mv = metaMode === 'contract' ? contractLeft(d, season) : (d.age != null ? String(d.age) : '');
          return mv ? ` (${mv})` : '';
        })()}</div>`).join('');

    return `
      <div style="position:absolute;left:${left}px;top:${top}px;width:${SLOT_W}px;">
        <div style="position:relative;height:${FACE}px;">${face}${score}</div>
        <div style="font-size:14.5px;font-weight:700;color:#eaf0f8;margin-top:6px;
                    text-align:center;white-space:nowrap;overflow:hidden;
                    text-overflow:ellipsis;">${starter && starter.onLoan ? LOAN_TAG : ''}${starter ? esc(starter.name) : '—'}${age}${oopTag}</div>
        <div style="margin-top:3px;text-align:center;">${depthNames}</div>
      </div>`;
  }).join('');

  return `
    <div style="position:absolute;inset:0;border-radius:10px;overflow:hidden;
                background:linear-gradient(180deg,rgba(34,197,94,0.05),rgba(34,197,94,0.02));
                border:1px solid ${line};">
      <div style="position:absolute;left:0;top:50%;width:100%;height:1px;background:${line};"></div>
      <div style="position:absolute;left:50%;top:50%;width:130px;height:130px;
                  margin:-65px 0 0 -65px;border:1px solid ${line};border-radius:50%;"></div>
      <div style="position:absolute;left:50%;top:0;width:300px;height:92px;
                  margin-left:-150px;border:1px solid ${line};border-top:none;"></div>
      <div style="position:absolute;left:50%;bottom:0;width:300px;height:92px;
                  margin-left:-150px;border:1px solid ${line};border-bottom:none;"></div>
      ${blocks}
    </div>`;
}

// ─── Remaining panel stubs ─────────────────────────────────────────────────
// ─── PERFORMANCE RADAR — port of Team HQ "Feature Y" (team_hq.py §5) ──────
// Same twelve metrics, same percentile rule ((s <= v).mean()*100 within the
// league pool, inverted where lower is better), same colour ramp, same geometry:
// angles reversed, rotated so the first sits at 75 degrees, bars at 85% of the
// slice, dotted rings at 25/50/75/90, brighter separators on the cardinals.
// Nine metrics — Points, Expected Points and Long Passes dropped.
const RADAR_METRICS = [
  ['XG',            'Attack',     'xG',                  false],
  ['GOALS',         'Attack',     'Goals Scored',        false],
  ['TOUCHES BOX',   'Attack',     'Touches in Box',      false],
  ['XG AGAINST',    'Defence',    'xG Against',          true],
  ['GOALS AGAINST', 'Defence',    'Goals Against',       true],
  ['PPDA',          'Pressing',   'PPDA',                true],
  ['POSSESSION',    'Possession', 'Possession',          false],
  ['PASSES',        'Possession', 'Passes',              false],
  ['PASSES F3',     'Possession', 'Passes to Final 3rd', false],
];

// Raw value for a metric — metricGroups rows are [name, pct, raw]; the last two
// metrics are plain fields on the team row.
function rawMetric(t, group, name) {
  if (!group) { const v = Number(t[name]); return isNaN(v) ? null : v; }
  const rows = t.metricGroups && t.metricGroups[group];
  if (!Array.isArray(rows)) return null;
  const hit = rows.find(r => r && r[0] === name);
  if (!hit) return null;
  const v = Number(hit[2]);
  return isNaN(v) ? null : v;
}

// Percentiles are recomputed from raw values against the league pool rather than
// reusing metricGroups' stored pct, so the inversion rule matches Feature Y
// exactly instead of depending on how build_teams.py stored it.
export function radarPercentiles(team, allTeams) {
  const pool = (allTeams || []).filter(t =>
    String(t.league) === String(team.league) && String(t.season) === String(team.season));
  return RADAR_METRICS.map(([label, group, name, invert]) => {
    const v = rawMetric(team, group, name);
    if (v == null) return [label, 50];
    const vals = pool.map(t => rawMetric(t, group, name)).filter(x => x != null);
    if (vals.length < 2) return [label, 50];
    const p = (vals.filter(x => x <= v).length / vals.length) * 100;
    return [label, Math.max(0, Math.min(100, invert ? 100 - p : p))];
  });
}

// Feature Y's seven-stop ramp, linearly interpolated.
const RADAR_RAMP = ['#be2a3e', '#e25f48', '#f88f4d', '#f4d166', '#90b960', '#4b9b5f', '#22763f'];
function radarColor(p) {
  const x = Math.max(0, Math.min(100, p)) / 100 * (RADAR_RAMP.length - 1);
  const i = Math.min(RADAR_RAMP.length - 2, Math.floor(x)), t = x - i;
  const hex = (c) => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
  const a = hex(RADAR_RAMP[i]), b = hex(RADAR_RAMP[i + 1]);
  return `rgb(${[0,1,2].map(k => Math.round(a[k] + (b[k] - a[k]) * t)).join(',')})`;
}

function radarPanelHtml(w, h, team, allTeams) {
  const rows = radarPercentiles(team, allTeams);
  const N = rows.length;

  // Nine metrics in a taller tile means the labels go back on the ring like the
  // matplotlib original, so the cramped truncated side list is gone.
  const LABEL_R = 1.28;
  // Labels sit at LABEL_R and need their own text height on top, or the bottom
  // one ("GOALS AGAINST") clips against the tile edge.
  const LABEL_PAD = 12;
  const R = Math.floor(Math.min((h / 2 - LABEL_PAD) / LABEL_R, w / 2 / (LABEL_R + 0.42)));
  const cx = w / 2, cy = h / 2;

  const angles = Array.from({ length: N }, (_, i) => (2 * Math.PI * i) / N).reverse();
  const shift = (75 * Math.PI / 180) - angles[0];
  const rot = angles.map(a => ((a + shift) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI));
  const barW = (2 * Math.PI / N) * 0.85;

  const pt = (ang, r) => [cx + r * Math.cos(ang), cy - r * Math.sin(ang)];
  const wedge = (ang, r, fill, stroke, sw) => {
    const a0 = ang - barW / 2, a1 = ang + barW / 2;
    const [x0, y0] = pt(a0, 0), [x1, y1] = pt(a0, r), [x2, y2] = pt(a1, r);
    return `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)}
             A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 0 ${x2.toFixed(1)} ${y2.toFixed(1)} Z"
             fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
  };
  const rScale = (p) => (p / 100) * R;

  let svg = '';
  rot.forEach(a => { svg += wedge(a, R, '#3a4152', null, 0); });
  rows.forEach(([, p], i) => { svg += wedge(rot[i], rScale(p), radarColor(p), '#ffffff', 1.3); });
  [25, 50, 75, 90].forEach(rp => {
    svg += `<circle cx="${cx}" cy="${cy}" r="${rScale(rp).toFixed(1)}" fill="none"
             stroke="#c9d2e0" stroke-opacity="0.4" stroke-width="0.9" stroke-dasharray="2 3"/>`;
  });
  rot.forEach(a => {
    const sep = a - barW / 2;
    const norm = ((sep % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const cross = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].some(k => Math.abs(norm - k) < 0.01);
    const [x1, y1] = pt(sep, 0), [x2, y2] = pt(sep, R);
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
             stroke="#fff" stroke-opacity="${cross ? 1 : 0.25}" stroke-width="${cross ? 1.4 : 0.8}"/>`;
  });
  rows.forEach(([label], i) => {
    const [x, y] = pt(rot[i], R * LABEL_R);
    // Anchor by side so long labels grow outward rather than over the dial.
    const c = Math.cos(rot[i]);
    const anchor = c > 0.25 ? 'start' : c < -0.25 ? 'end' : 'middle';
    svg += `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}"
             font-family="Montserrat,sans-serif" font-size="8.5" font-weight="700"
             fill="#c8d2e0" letter-spacing="0.04em">${label}</text>`;
  });

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"
           xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;">${svg}</svg>`;
}

// Hexagon geometry lifted verbatim from CoachQuickCard.styleHexSvg so the team
// card and the manager card read identically.
//
// NOTE: t.attributes is a list of attribute NAMES (tags like "Possession"), not
// 0-100 values, so it can't drive this. The numbers come from the season's own
// percentiles instead — the four headline splits plus two metricGroups entries.
function styleHexSvg(rows, maxWidth, maxHeight) {
  const R = 11;
  const hex = (cx, cy, opacity, col) => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 180 * (60 * i - 30);
      return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${col}" opacity="${opacity}" stroke="#07090f" stroke-width="1.5"/>`;
  };
  // Row height flexes so a 7th row (set pieces) still fits the tile.
  const rowH = maxHeight ? Math.max(30, Math.min(40, Math.floor((maxHeight - 6) / rows.length))) : 40;
  const labelW = 156, numHex = 10, WD = R * 2, hexGap = 1;
  const w = Math.min(maxWidth, labelW + numHex * WD + (numHex - 1) * hexGap + 6);
  const h = rows.length * rowH + 6;
  const body = rows.map(([disp, score], i) => {
    const sc = Math.round(score || 0);
    const filled = Math.max(0, Math.min(numHex, Math.round(sc / 10)));
    const col = gradeColor(sc);
    const y = i * rowH + rowH / 2 + 2;
    const hexes = Array.from({ length: numHex }, (_, d) => {
      const cx = labelW + d * (WD + hexGap) + WD / 2;
      const on = d < filled;
      return hex(cx, y, on ? (1 - (d / numHex) * 0.4).toFixed(2) : 0.1, on ? col : '#dbe1ee');
    }).join('');
    return `<text x="0" y="${y + 5}" font-family="Montserrat,sans-serif" font-size="14"
             font-weight="600" fill="#ffffff">${disp}</text>${hexes}`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

// Percentile for a metricGroups entry: metricGroups[group] = [[name, pct, raw], ...]
function mgPct(team, group, name) {
  const rows = team.metricGroups && team.metricGroups[group];
  if (!Array.isArray(rows)) return null;
  const hit = rows.find(r => r && r[0] === name);
  return hit ? Number(hit[1]) : null;
}

// Set pieces aren't in the dataset, so they're two hand-entered 1-10 ratings
// (attacking / defending) averaged into one figure. Scaled x10 to sit on the
// same 0-100 scale as everything else on the card.
export const SET_PIECE_WEAK_CUTOFF = 3;      // avg at or below this = a weakness
export function setPieceScore(att, def) {
  const a = Number(att), d = Number(def);
  const vals = [a, d].filter(v => !isNaN(v) && v >= 1 && v <= 10);
  if (!vals.length) return null;
  return (vals.reduce((x, y) => x + y, 0) / vals.length) * 10;
}

function styleRowsFor(team, setPieces) {
  return [
    ['Possession', mgPct(team, 'Possession', 'Possession') ?? team.possession],
    ['Pressing',   team.pressing],
    ['Attacking',  team.attack],
    ['Defensive',  team.defence],
    ['Long Ball',  mgPct(team, 'Possession', 'Long Passes')],
    ['Passing',    mgPct(team, 'Possession', 'Passing Accuracy %')],
  ].map(([l, v]) => [l, v == null || isNaN(v) ? 0 : Number(v)])
   .concat(setPieces == null ? [] : [['Set Pieces', setPieces]])
   .sort((a, b) => b[1] - a[1]);
}

function stylePanelHtml(w, h, team, setPieces) {
  const rows = styleRowsFor(team, setPieces);
  return `<div style="position:absolute;left:0;top:2px;">${styleHexSvg(rows, w, h)}</div>`;
}
// t.similarTeams may hold plain names or objects — resolve either against the
// full team list so the row gets a crest, league and score regardless.
// TeamCard.js renders these straight from the data:
//   {s.team} / {s.league} / {s.similarity}%
// so `similarity` is precomputed in build_teams.py and already on a 0-100 scale.
// Take team and league from the ENTRY, not from a lookup — a club can appear in
// more than one league/season and TeamCard shows the entry's own values.
// allTeams is only consulted as a fallback for entries that are plain strings.
export function resolveSimilarTeams(team, allTeams, n = 3) {
  const raw = Array.isArray(team.similarTeams) ? team.similarTeams : [];
  const out = [];
  for (const entry of raw) {
    if (out.length >= n) break;
    if (entry && typeof entry === 'object') {
      if (!entry.team || entry.team === team.team) continue;
      out.push({ team: entry.team, league: entry.league || '', __sim: entry.similarity ?? null });
      continue;
    }
    // Legacy/plain-string form: no similarity available, fall back to the row.
    const name = entry;
    if (!name || name === team.team) continue;
    const row = (allTeams || []).find(t => t.team === name && String(t.season) === String(team.season))
             || (allTeams || []).find(t => t.team === name);
    out.push({ team: name, league: row ? row.league : '', __sim: null,
               completeScore: row ? row.completeScore : null });
  }
  return out;
}

// TeamCard's exact thresholds, so a match reads the same colour on both.
function similarityColor(v) {
  return v >= 70 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#64748b';
}

// ─── League table ──────────────────────────────────────────────────────────
// The full table won't fit and mostly isn't relevant — show the window around
// this team so its position reads in context, with the leader pinned above when
// they're out of view (the gap to the top is usually the first thing you want).
export function leagueSizeFor(team, allTeams) {
  return (allTeams || []).filter(t => String(t.league) === String(team.league)
                                   && String(t.season) === String(team.season)).length || null;
}

export function leagueWindow(team, allTeams, size = 5) {
  const pool = (allTeams || [])
    .filter(t => String(t.league) === String(team.league)
              && String(t.season) === String(team.season) && t.pointsRank != null)
    // Level on points is common; the stored pointsRank doesn't break those ties,
    // so order by goal difference then goals scored, the way a real table does.
    .sort((a, b) => {
      const pd = (Number(b.points) || 0) - (Number(a.points) || 0);
      if (pd) return pd;
      const gd = (a2 => a2)((Number(b.goalsFor) || 0) - (Number(b.goalsAgainst) || 0))
               - ((Number(a.goalsFor) || 0) - (Number(a.goalsAgainst) || 0));
      if (gd) return gd;
      const gf = (Number(b.goalsFor) || 0) - (Number(a.goalsFor) || 0);
      if (gf) return gf;
      return (a.pointsRank || 0) - (b.pointsRank || 0);
    });
  if (!pool.length) return { rows: [], pinnedTop: null, total: 0 };
  // Stored pointsRank leaves ties sharing a number (three sides all showing 13),
  // so the displayed position comes from this sorted order instead — points, then
  // goal difference, then goals scored.
  const ranked = pool.map((t, i) => ({ ...t, pointsRank: i + 1 }));
  const idx = ranked.findIndex(t => t.team === team.team);
  if (idx < 0) return { rows: ranked.slice(0, size), pinnedTop: null, total: ranked.length };
  const start = Math.max(0, Math.min(idx - Math.floor(size / 2), ranked.length - size));
  return { rows: ranked.slice(start, start + size), pinnedTop: start > 0 ? ranked[0] : null, total: ranked.length };
}
function pinnedRows(h) { return h >= 190 ? 5 : 4; }

// Column stops measured from the right edge, so the club name takes whatever's
// left and truncates rather than colliding with the numbers.
// Narrower numeric columns buy ~50px back for the club name.
const TCOL = { pts: 4, xpts: 38, gd: 80, l: 132, d: 156, w: 180, pl: 204 };
const TNAME_LEFT = 68;

function tableCell(right, wdt, text, style) {
  return `<span style="position:absolute;right:${right}px;top:50%;margin-top:-8px;width:${wdt}px;
           text-align:${right === TCOL.gd ? 'center' : 'right'};${style}">${text}</span>`;
}

function tableRowHtml(t, team, w, top, rowH, dim) {
  const me = t.team === team.team;
  const crest = teamCrest(t.team);
  const pl = (Number(t.wins) || 0) + (Number(t.draws) || 0) + (Number(t.losses) || 0);
  const num = (v) => (v == null || isNaN(v) ? '—' : Math.round(Number(v)));
  const cell = `font-size:11.5px;font-weight:600;color:${me ? '#dbe7ff' : '#8b98ad'};`;
  return `
    <div style="position:absolute;left:0;top:${top}px;width:${w}px;height:${rowH - 4}px;
                background:${me ? 'rgba(59,125,232,0.16)' : 'rgba(255,255,255,0.03)'};
                border:1px solid ${me ? 'rgba(96,165,250,0.45)' : 'rgba(255,255,255,0.06)'};
                border-radius:7px;opacity:${dim ? 0.62 : 1};">
      <span style="position:absolute;left:9px;top:50%;margin-top:-8px;width:20px;text-align:center;
                   font-size:12.5px;font-weight:800;color:${me ? '#93c5fd' : '#8b98ad'};">${t.pointsRank}</span>
      ${crest ? `<div style="position:absolute;left:38px;top:50%;margin-top:-10px;width:21px;height:21px;
                   background-image:url('${src(crest)}');background-size:contain;
                   background-repeat:no-repeat;background-position:center;"></div>` : ''}
      <span style="position:absolute;left:${TNAME_LEFT}px;right:${TCOL.pl + 22}px;top:50%;
                   margin-top:-8px;font-size:12.5px;
                   font-weight:${me ? 700 : 600};color:${me ? '#fff' : '#c8d2e0'};white-space:nowrap;
                   overflow:hidden;text-overflow:ellipsis;">${esc(t.team)}</span>
      ${tableCell(TCOL.pl,   20, pl || '—', cell)}
      ${tableCell(TCOL.w,    20, num(t.wins), cell)}
      ${tableCell(TCOL.d,    20, num(t.draws), cell)}
      ${tableCell(TCOL.l,    20, num(t.losses), cell)}
      ${tableCell(TCOL.gd,   46, `${num(t.goalsFor)}<span style="color:#6b7385;">-</span>${num(t.goalsAgainst)}`, cell)}
      ${tableCell(TCOL.xpts, 30, num(t.expectedPoints), 'font-size:11.5px;font-weight:600;color:#8b98ad;')}
      ${tableCell(TCOL.pts,  30, num(t.points),
          `font-size:14.5px;font-weight:800;color:${me ? '#fff' : '#dbe3f0'};`)}
    </div>`;
}

function leagueTablePanelHtml(w, h, team, allTeams) {
  const { rows, pinnedTop } = leagueWindow(team, allTeams, pinnedRows(h));
  if (!rows.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
             justify-content:center;font-size:12px;color:#55617a;">No table data for this league.</div>`;
  }
  const HEAD = 17;
  const list = pinnedTop ? [pinnedTop, ...rows] : rows;
  const rowH = Math.floor((h - HEAD) / list.length);
  const hs = 'font-size:8.5px;font-weight:700;letter-spacing:0.08em;color:#6f7c92;';
  const head = `
    <div style="position:absolute;left:0;top:0;width:${w}px;height:${HEAD}px;">
      <span style="position:absolute;right:${TCOL.pl}px;top:0;width:20px;text-align:right;${hs}">PL</span>
      <span style="position:absolute;right:${TCOL.w}px;top:0;width:20px;text-align:right;${hs}">W</span>
      <span style="position:absolute;right:${TCOL.d}px;top:0;width:20px;text-align:right;${hs}">D</span>
      <span style="position:absolute;right:${TCOL.l}px;top:0;width:20px;text-align:right;${hs}">L</span>
      <span style="position:absolute;right:${TCOL.gd}px;top:0;width:46px;text-align:center;${hs}">+/-</span>
      <span style="position:absolute;right:${TCOL.xpts}px;top:0;width:30px;text-align:right;${hs}">xPTS</span>
      <span style="position:absolute;right:${TCOL.pts}px;top:0;width:30px;text-align:right;${hs}">PTS</span>
    </div>`;
  return head + list.map((t, i) =>
    tableRowHtml(t, team, w, HEAD + i * rowH, rowH, pinnedTop && i === 0)).join('');
}

// Season objective — a fixed list so it's scannable and can carry a colour,
// rather than free text that reads differently every card.
// Either bottom slot can hold any of these.
export const BOTTOM_PANELS = ['Similar Teams', 'Key Players', 'Recruitment Recommendations',
                              'Summary', 'Possible Departures', 'None'];

// Did they hit it? Rendered as a small badge beside the objective.
// Where each objective expects a side to finish, as a fraction of the league
// (or an absolute position where the target is a specific place). Comparing that
// to actual position gives both the gap and how big a job closing it is.
const OBJECTIVE_TARGET = {
  'Title Challenge':  { abs: 1 },
  'Promotion':        { abs: 2 },
  'European Places':  { frac: 0.20 },
  'Play-offs':        { frac: 0.30 },
  'Upper Mid-Table':  { frac: 0.35 },
  'Mid-Table':        { frac: 0.50 },
  'Consolidate':      { frac: 0.65 },
  'Avoid Relegation': { frac: 0.85 },
  'Rebuild':          null,
};
const CHANGE_BANDS = [
  { max: 0,        label: 'On Target',   colour: '#22c55e' },
  { max: 2,        label: 'Minor Work',  colour: '#84cc16' },
  { max: 5,        label: 'Moderate',    colour: '#fbc701' },
  { max: 9,        label: 'Significant', colour: '#f59e0b' },
  { max: Infinity, label: 'Major Rebuild', colour: '#ef4444' },
];

// { gap, label, colour } — gap is places short of the objective (0 = met/beaten).
export function objectiveGap(objective, pointsRank, leagueSize) {
  const t = OBJECTIVE_TARGET[objective];
  if (!t || pointsRank == null || !leagueSize) return null;
  const target = t.abs != null ? t.abs : Math.max(1, Math.round(t.frac * leagueSize));
  const gap = Math.max(0, Number(pointsRank) - target);
  const band = CHANGE_BANDS.find(b => gap <= b.max);
  return { gap, target, label: band.label, colour: band.colour };
}

// Judgement calls that no metric captures. Each is off by default; when switched
// on it carries a severity that drives the colour.
export const EXTRA_AREAS = ['Shape Flexibility', 'Contracts', 'Trading Assets',
                            'Athleticism', 'Physicality'];
export const SEVERITIES = ['low', 'medium', 'high'];
const SEVERITY_COLOUR = { low: '#fbc701', medium: '#f59e0b', high: '#ef4444' };

export const OBJECTIVE_OUTCOMES = ['', 'Achieved', 'Partial', 'Missed'];
const OUTCOME_STYLE = {
  Achieved: { c: '#22c55e', g: '✓' },
  Partial:  { c: '#fbc701', g: '–' },
  Missed:   { c: '#ef4444', g: '✕' },
};

export const OBJECTIVES = [
  'Title Challenge', 'European Places', 'Promotion', 'Play-offs',
  'Upper Mid-Table', 'Mid-Table', 'Consolidate', 'Avoid Relegation', 'Rebuild',
];
const OBJECTIVE_COLOUR = {
  'Title Challenge': '#00bf63', 'European Places': '#22c55e', 'Promotion': '#22c55e',
  'Play-offs': '#84cc16', 'Upper Mid-Table': '#fbc701', 'Mid-Table': '#fbc701',
  'Consolidate': '#f59e0b', 'Avoid Relegation': '#ef4444', 'Rebuild': '#94a3b8',
};

export const SUMMARY_WORD_LIMIT = 90;
export const countWords = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
export function clampWords(t, limit = SUMMARY_WORD_LIMIT) {
  const w = String(t || '').trim().split(/\s+/).filter(Boolean);
  return w.length <= limit ? String(t || '') : w.slice(0, limit).join(' ');
}

// Free-text scout summary. Sized down a step when the text runs long so it fills
// the tile without overflowing rather than clipping mid-sentence.
function summaryPanelHtml(w, h, text) {
  const body = String(text || '').trim();
  if (!body) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
             justify-content:center;font-size:12px;color:#55617a;">No summary written.</div>`;
  }
  const n = countWords(body);
  const fs = n > 70 ? 12 : n > 45 ? 13 : 14;
  return `<div style="position:absolute;inset:0;overflow:hidden;">
      <div style="font-size:${fs}px;line-height:1.55;color:#c8d2e0;white-space:pre-wrap;
                  word-break:break-word;">${esc(body)}</div>
    </div>`;
}

function similarTeamsPanelHtml(w, h, team, allTeams) {
  const rows = resolveSimilarTeams(team, allTeams, 3);
  if (!rows.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
             justify-content:center;font-size:12px;color:#55617a;">No similar teams in the data.</div>`;
  }
  const rowH = Math.floor((h - 4) / 3);
  const VAL_W = 50;
  return rows.map((t, i) => {
    const sim = t.__sim;
    const col = sim != null ? similarityColor(sim) : scoreColor(t.completeScore);
    const crest = teamCrest(t.team);
    const val = sim != null
      ? `<div style="font-size:15px;font-weight:800;color:${col};line-height:1.05;">${Math.round(sim)}%</div>
         <div style="font-size:7.5px;font-weight:600;letter-spacing:0.06em;color:#55617a;
                     margin-top:3px;line-height:1;">match</div>`
      : (t.completeScore == null ? '' :
         `<div style="font-size:15px;font-weight:800;color:${col};">${whole(t.completeScore)}</div>`);
    return `
      <div style="position:absolute;left:0;top:${i * rowH + 2}px;width:${w}px;height:${rowH - 6}px;
                  background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);
                  border-radius:9px;">
        <span style="position:absolute;left:10px;top:50%;margin-top:-6px;font-size:10px;
                     font-weight:700;color:#475569;">#${i + 1}</span>
        ${crest ? `<div style="position:absolute;left:32px;top:50%;margin-top:-13px;width:26px;height:26px;
                     background-image:url('${src(crest)}');background-size:contain;
                     background-repeat:no-repeat;background-position:center;"></div>` : ''}
        <!-- right edge stops where the value column starts, so names truncate
             instead of running under it -->
        <div style="position:absolute;left:68px;right:${VAL_W + 18}px;top:50%;margin-top:-15px;">
          <div style="font-size:13px;font-weight:700;color:#eaf0f8;line-height:1.15;white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis;">${esc(t.team)}</div>
          <div style="font-size:10px;color:#8b98ad;margin-top:4px;line-height:1.15;white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis;">${esc(leagueDisplayName(t.league))}</div>
        </div>
        <!-- centred, not right-aligned: "match" is narrower than the figure so
             right-aligning left the two visually off-axis -->
        <div style="position:absolute;right:10px;top:50%;margin-top:-15px;width:${VAL_W}px;
                    text-align:center;">${val}</div>
      </div>`;
  }).join('');
}

// Highest-scoring role from the pipeline's roleCareerScores, e.g. "Target Man".
// Role strings already carry a trailing position token ("Box-to-Box CM"), which
// is redundant next to the position we print, so it's trimmed off.
export function bestRole(p) {
  const rs = p && p.roleCareerScores;
  if (!rs || typeof rs !== 'object') return '';
  let best = null, bv = -Infinity;
  for (const k of Object.keys(rs)) {
    const v = Number(rs[k]);
    if (!isNaN(v) && v > bv) { bv = v; best = k; }
  }
  if (!best) return '';
  return best.replace(/\s+(GK|CB|FB|RB|LB|DM|CM|AM|RW|LW|ST|CF|WNG|ATT)$/i, '').trim();
}

// Stable identity for manual selections. Name alone collides across clubs.
// Season label -> the calendar year it ends in. '2025-26' -> 2026, '2026' -> 2026.
export function seasonEndYear(season) {
  const t = String(season || '').trim();
  const m = t.match(/^(\d{4})\s*[-/]\s*(\d{2,4})$/);
  if (m) return m[2].length === 2 ? Number(m[1].slice(0, 2) + m[2]) : Number(m[2]);
  const y = t.match(/(\d{4})/);
  return y ? Number(y[1]) : null;
}

// "+1" for a deal running one season beyond the current one, "Exp" for the
// season it runs out. Returns '' when there's no contract data.
export function contractLeft(p, season) {
  const cy = Number(p && p.contractYear);
  const end = seasonEndYear(season);
  if (!cy || !end || isNaN(cy)) return '';
  const d = cy - end;
  return `+${Math.max(0, d)}`;
}

// Accent-insensitive matching: "plzen" finds "Plzeň", "munchen" finds "München".
// NFD handles most diacritics; the explicit map covers the ones it can't
// decompose (ø, ł, đ, ß...), matching the treatment photoUrl already uses.
const FOLD_MAP = { 'ø':'o','œ':'oe','æ':'ae','å':'a','ß':'ss','ł':'l','đ':'d','ð':'d',
                   'þ':'th','ı':'i','ħ':'h','ŧ':'t','ĸ':'k','ŉ':'n' };
export function fold(str) {
  let t = String(str || '').toLowerCase();
  for (const k of Object.keys(FOLD_MAP)) if (t.includes(k)) t = t.split(k).join(FOLD_MAP[k]);
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export const foldIncludes = (hay, needle) => fold(hay).includes(fold(needle));

export const playerKey = (p) => `${p && p.name}|${p && p.team}`;
export function findByKeys(pool, keys) {
  if (!Array.isArray(keys) || !keys.length) return [];
  const idx = new Map((pool || []).map(p => [playerKey(p), p]));
  return keys.map(k => idx.get(k)).filter(Boolean);
}

export function topPlayers(squad, n = 3) {
  return squad.slice()
    .filter(p => p && p.careerScore != null)
    .sort((a, b) => b.careerScore - a.careerScore)
    .slice(0, n);
}

function keyPlayersPanelHtml(w, h, rows, showClub = false, hideScores = false) {
  if (!rows || !rows.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
             justify-content:center;font-size:12px;color:#55617a;">No players selected.</div>`;
  }
  const rowH = Math.floor((h - 4) / 3);
  const PILL_W = 38, PILL_GAP = 5;
  const VALS_W = PILL_W * 2 + PILL_GAP;
  return rows.map((p, i) => {
    const sc = p.careerScore;
    const pot = p.potentialScore != null ? p.potentialScore : p.careerScore;
    const pos = String(p.position || '').split(',')[0].trim();
    const role = bestRole(p);
    return `
      <div style="position:absolute;left:0;top:${i * rowH + 2}px;width:${w}px;height:${rowH - 6}px;
                  background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);
                  border-radius:9px;">
        <div style="position:absolute;left:10px;top:50%;margin-top:-16px;width:32px;height:32px;
                    border-radius:50%;background-color:#1a2233;
                    background-image:url('${src(photoUrl(p.name, p.team))}'), url('${SILHOUETTE}');
                    background-size:cover, cover;
                    background-position:center top, center top;
                    background-repeat:no-repeat, no-repeat;
                    border:1.5px solid rgba(190,203,224,0.26);"></div>
        <!-- text box ends exactly where the pills begin — previously it was a
             fixed max-width guess, which is why names were ellipsising early -->
        <div style="position:absolute;left:50px;right:${VALS_W + 20}px;top:50%;margin-top:-15px;">
          <div style="font-size:13.5px;font-weight:700;color:#eaf0f8;line-height:1.15;white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}<span
                style="color:#7c8798;font-weight:600;"> ${p.age != null ? p.age : '—'}</span></div>
          <div style="font-size:10px;color:#8b98ad;margin-top:4px;line-height:1.15;white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis;">${esc(pos)}${role ? `<span style="color:#6f7c92;"> · </span><span style="color:#93a1b5;">${esc(role)}</span>` : ''}${
            showClub && p.team ? `<span style="color:#6f7c92;"> · </span><span style="color:#8b98ad;">${esc(p.team)}</span>` : ''}</div>
        </div>
        ${hideScores ? '' : `
        <!-- lifted 3px and captions a size down: they were sitting on the row's
             bottom edge while still crowding the pills above -->
        <div style="position:absolute;right:10px;top:50%;margin-top:-18px;width:${VALS_W}px;display:flex;">
          <div style="width:${PILL_W}px;text-align:center;">
            <div style="padding:3px 0;border-radius:11px;background:rgba(255,255,255,0.06);
                        border:1px solid ${gradeColor(sc)}44;font-size:13px;font-weight:800;
                        color:${gradeColor(sc)};">${Math.round(sc)}</div>
            <div style="font-size:6px;font-weight:700;letter-spacing:0.06em;color:#6f7c92;margin-top:3px;">OVR</div>
          </div>
          <div style="width:${PILL_W}px;text-align:center;margin-left:${PILL_GAP}px;">
            <div style="padding:3px 0;border-radius:11px;background:rgba(255,255,255,0.03);
                        border:1px dashed ${gradeColor(pot)}55;font-size:13px;font-weight:800;
                        color:${gradeColor(pot)};">${Math.round(pot)}</div>
            <div style="font-size:6px;font-weight:700;letter-spacing:0.06em;color:#6f7c92;margin-top:3px;">POT</div>
          </div>
        </div>`}
      </div>`;
  }).join('');
}

// Every metricGroups entry, percentiled against the league the same way the
// radar does it (recomputed from raw, inverted where lower is better) so
// "Goals Against" can't show up as a strength by accident.
const WEAKNESS_INVERT = new Set(['xG Against', 'Goals Against', 'Shots Against', 'PPDA']);

// Only outcome metrics are eligible to be called a weakness. The full
// metricGroups set mixes these with volume/identity metrics -- Crosses, Long
// Passes, Possession, Dribbles, Progressive Runs and the two duel *counts* --
// where being bottom of the league is a decision, not a flaw. A direct,
// low-block side would otherwise have Game Control, Retention and Long Passing %
// eat three of four slots while describing its identity. Those axes are also
// already in the Style panel. Shooting % is excluded on the same grounds: it
// tracks finishing luck more than anything a coach controls.
const WEAKNESS_ELIGIBLE = new Set([
  'Goals Scored', 'xG', 'Shots', 'Touches in Box',
  'Goals Against', 'xG Against', 'Shots Against', 'PPDA',
  'Aerial Duel Success %', 'Defensive Duel Win %', 'Defensive Duels Win %',
  'Passes to Final 3rd', 'Progressive Passes',
]);

// Wyscout metric names read like a stats export; these are the plain-English
// equivalents for the card. Anything not listed falls through unchanged.
const METRIC_PLAIN = {
  'xG': 'Creating Chances',
  'Shots': 'Shot Attempts',
  'Touches in Box': 'Attacking Territory',
  'Goals Against': 'Conceding Goals',
  'xG Against': 'Conceding Chances',
  'Defensive Duel Win %': 'Winning Duels',
  'Defensive Duels Win %': 'Winning Duels',
  'Aerial Duel Success %': 'Winning Aerials',
  'Shots Against': 'Allowing Opposition Shots',
  'Possession': 'Game Control',
  'Passing Accuracy %': 'Retention',
  'Passes to Final 3rd': 'Getting Ball Into Key Areas',
  'Progressive Passes': 'Ball Progression',
};
const plainMetric = (n) => METRIC_PLAIN[n] || n;

// A starter is flagged for improvement when this season's score sits clearly
// below the rest of the XI. Relative rather than absolute, so it still works
// for a Championship side and a Premier League one.
const IMPROVE_GAP = 4;
const IMPROVE_FLOOR = 45;

// Score for the season shown on the card, falling back to career.
function seasonScore(p, season) {
  const hit = Array.isArray(p && p.sh) ? p.sh.find(x => String(x.s) === String(season)) : null;
  return hit && hit.sc != null ? Number(hit.sc) : (p && p.careerScore != null ? Number(p.careerScore) : null);
}

// Weakest starting slots — the squad-quality counterpart to the metric bars.
export function improveSlots(xi, season, max = 4) {
  const rated = xi.filter(s => s.starter).map(s => ({ k: s.slot.label, v: seasonScore(s.starter, season) }))
                  .filter(x => x.v != null);
  if (rated.length < 4) return [];
  const avg = rated.reduce((a, b) => a + b.v, 0) / rated.length;
  const cut = Math.min(avg - IMPROVE_GAP, IMPROVE_FLOOR + 20);
  return rated.filter(x => x.v < cut).sort((a, b) => a.v - b.v).slice(0, max);
}

export function weakestMetrics(team, allTeams, n = 4) {
  const pool = allTeams.filter(t => String(t.league) === String(team.league)
                                 && String(t.season) === String(team.season));
  const out = [];
  const groups = team.metricGroups || {};
  for (const g of Object.keys(groups)) {
    const rows = Array.isArray(groups[g]) ? groups[g] : [];
    for (const r of rows) {
      if (!r || r[0] == null) continue;
      const name = r[0];
      const v = Number(r[2]);
      if (isNaN(v)) continue;
      if (!WEAKNESS_ELIGIBLE.has(name)) continue;
      const vals = pool.map(t => rawMetric(t, g, name)).filter(x => x != null);
      if (vals.length < 2) continue;
      const p = (vals.filter(x => x <= v).length / vals.length) * 100;
      out.push([plainMetric(name), WEAKNESS_INVERT.has(name) ? 100 - p : p]);
    }
  }
  // PPDA sits in both the Defence and Pressing groups and resolves to the same
  // raw value, so without this it could take two of the four slots as two
  // identical bars -- it also isn't in METRIC_PLAIN, so both read "PPDA".
  const seen = new Set();
  return out.sort((a, b) => a[1] - b[1])
            .filter(([name]) => !seen.has(name) && seen.add(name))
            .slice(0, n);
}

// Starting slots with no cover behind them — the squad-shape half of "weakness".
export function uncoveredSlots(xi) {
  return xi.filter(s => s.starter && (!s.depth || !s.depth.length)).map(s => s.slot.label);
}

function weaknessesPanelHtml(w, h, team, allTeams, xi, depthList, upgradeList, setPieces, extraAreas) {
  let metrics = weakestMetrics(team, allTeams, 4);
  // A set-piece rating at or below the cutoff replaces the mildest of the four —
  // it's a real weakness and deserves the slot more than the least-bad metric.
  if (setPieces != null && setPieces <= SET_PIECE_WEAK_CUTOFF * 10) {
    metrics = metrics.slice(0, 3).concat([['Set Pieces', setPieces]]);
  }
  // null means "use the auto-detected set"; an array means the user picked.
  const thinAll = Array.isArray(depthList) ? depthList : uncoveredSlots(xi);
  const improve = Array.isArray(upgradeList)
    ? upgradeList.map(k => ({ k }))
    : improveSlots(xi, team.season, 4);

  // 32 normally; tightened only when the "Also" row is in play, so the default
  // panel keeps the spacing it had rather than compressing for a row that isn't there.
  const hasExtras = Array.isArray(extraAreas) && extraAreas.some(x => x && x.name);
  const rowH = hasExtras ? 24 : 32;
  const bars = metrics.map(([name, p], i) => `
    <div style="position:absolute;left:0;top:${i * rowH}px;width:${w}px;height:${rowH - 8}px;">
      <!-- left+right gives a definite width; left+max-width made this
           shrink-to-fit and ellipsise far earlier than the max-width -->
      <span style="position:absolute;left:0;right:40px;top:0;font-size:11.5px;font-weight:600;
                   color:#c8d2e0;white-space:nowrap;overflow:hidden;
                   text-overflow:ellipsis;">${esc(name)}</span>
      <span style="position:absolute;right:0;top:-1px;font-size:13px;font-weight:800;
                   color:${radarColor(p)};">${Math.round(p)}</span>
      <div style="position:absolute;left:0;right:0;top:17px;height:5px;border-radius:3px;
                  background:rgba(255,255,255,0.08);overflow:hidden;">
        <div style="width:${Math.max(2, Math.min(100, p))}%;height:100%;
                    background:${radarColor(p)};border-radius:3px;"></div>
      </div>
    </div>`).join('');

  // +12 rather than +4: the squad columns were sitting right under the last
  // metric bar. Both groups now share the same label-to-pill gap (7px) and the
  // same gap from what's above them (14px).
  const colTop = metrics.length * rowH + (hasExtras ? 12 : 4);
  const colW = Math.floor((w - 16) / 2);
  // 5 fits one line at this pill size (5 x ~42px + gaps inside a 241px column).
  // Beyond that shows as "+N" rather than wrapping into a second row.
  const CAP = 5;
  const pill = (text, tone) => `<span style="display:inline-block;font-size:10.5px;font-weight:700;
      padding:3px 8px;border-radius:10px;margin-right:5px;margin-bottom:4px;
      background:${tone}1e;border:1px solid ${tone}59;color:${tone};">${text}</span>`;

  const depthPills = thinAll.length
    ? thinAll.slice(0, CAP).map(k => pill(k, '#f6a75c')).join('')
      + (thinAll.length > CAP ? `<span style="font-size:10.5px;font-weight:700;color:#8b98ad;">+${thinAll.length - CAP}</span>` : '')
    : `<span style="font-size:11px;color:#8b98ad;">All slots covered</span>`;

  const improvePills = improve.length
    ? improve.map(x => pill(x.k, '#f87171')).join('')
    : `<span style="font-size:11px;color:#8b98ad;">No clear weak link</span>`;

  // Hand-picked areas sit on their own row beneath the squad columns, coloured
  // by severity rather than measured, so they read as judgement not data.
  const extras = (extraAreas || []).filter(x => x && x.name).slice(0, 4);
  const extrasHtml = !extras.length ? '' : `
    <div style="position:absolute;left:0;top:${colTop + 55}px;width:${w}px;">
      <div style="font-size:8.5px;font-weight:700;letter-spacing:0.14em;color:#6f7c92;">OTHER</div>
      <div style="margin-top:7px;">
        ${extras.map(x => {
          const c = SEVERITY_COLOUR[x.severity] || SEVERITY_COLOUR.medium;
          // nowrap: "Trading Assets" was breaking onto a second line inside its
          // own pill and blowing the row height out.
          return `<span style="display:inline-block;font-size:10px;font-weight:700;
                    padding:4px 10px;border-radius:11px;margin-right:6px;
                    white-space:nowrap;line-height:1.1;
                    background:${c}1e;border:1px solid ${c}59;color:${c};">${esc(x.name)}</span>`;
        }).join('')}
      </div>
    </div>`;

  return `<div style="position:absolute;inset:0;">
    ${bars}
    <div style="position:absolute;left:0;top:${colTop}px;width:${colW}px;">
      <div style="font-size:8.5px;font-weight:700;letter-spacing:0.14em;color:#6f7c92;">DEPTH</div>
      <div style="margin-top:7px;">${depthPills}</div>
    </div>
    <div style="position:absolute;left:${colW + 16}px;top:${colTop}px;width:${colW}px;">
      <div style="font-size:8.5px;font-weight:700;letter-spacing:0.14em;color:#6f7c92;">XI UPGRADE</div>
      <div style="margin-top:7px;">${improvePills}</div>
    </div>
    ${extrasHtml}
  </div>`;
}

// Departures default to the squad's shortest contracts — the players actually
// at risk — but the list is editable, since it's a judgement call.
export function likelyDepartures(squad, season, n = 3) {
  return squad
    .filter(p => p && p.contractYear)
    .map(p => ({ p, left: Number(p.contractYear) - (seasonEndYear(season) || 0) }))
    .filter(x => !isNaN(x.left))
    .sort((a, b) => a.left - b.left || (b.p.careerScore || 0) - (a.p.careerScore || 0))
    .slice(0, n)
    .map(x => x.p);
}

function departuresPanelHtml(w, h, rows, season) {
  if (!rows || !rows.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
             justify-content:center;font-size:12px;color:#55617a;">No departures flagged.</div>`;
  }
  const rowH = Math.floor((h - 4) / 3);
  return rows.slice(0, 3).map((p, i) => {
    const left = contractLeft(p, season);
    const urgent = left === '+0';
    const pos = String(p.position || '').split(',')[0].trim();
    return `
      <div style="position:absolute;left:0;top:${i * rowH + 2}px;width:${w}px;height:${rowH - 6}px;
                  background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);
                  border-radius:9px;">
        <div style="position:absolute;left:10px;top:50%;margin-top:-16px;width:32px;height:32px;
                    border-radius:50%;background-color:#1a2233;
                    background-image:url('${src(photoUrl(p.name, p.team))}'), url('${SILHOUETTE}');
                    background-size:cover, cover;background-position:center top, center top;
                    background-repeat:no-repeat, no-repeat;
                    border:1.5px solid rgba(190,203,224,0.26);"></div>
        <div style="position:absolute;left:50px;right:96px;top:50%;margin-top:-15px;">
          <div style="font-size:13.5px;font-weight:700;color:#eaf0f8;line-height:1.15;white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}<span
                style="color:#7c8798;font-weight:600;"> ${p.age != null ? p.age : '—'}</span></div>
          <div style="font-size:10px;color:#8b98ad;margin-top:4px;line-height:1.15;white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis;">${esc(pos)}${
            p.marketValue ? `<span style="color:#6f7c92;"> · </span><span style="color:#93a1b5;">${formatMoney(p.marketValue)}</span>` : ''}${
            p.xValue ? `<span style="color:#6f7c92;"> · xV </span><span style="color:#93c5fd;">${formatMoney(p.xValue)}</span>` : ''}</div>
        </div>
        <div style="position:absolute;right:11px;top:50%;margin-top:-13px;width:76px;text-align:center;
                    padding:4px 0;border-radius:13px;
                    background:${urgent ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.06)'};
                    border:1px solid ${urgent ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.13)'};">
          <span style="font-size:12px;font-weight:800;color:${urgent ? '#f87171' : '#c3ccdd'};">
            ${p.contractYear ? esc(String(p.contractYear)) : '—'}</span>
          <span style="font-size:10px;font-weight:700;color:${urgent ? '#f87171' : '#8b98ad'};margin-left:5px;">${left}</span>
        </div>
      </div>`;
  }).join('');
}

// Compact money for the departures row — the squad-value formatter lives in
// constants.js and isn't imported here.
function formatMoney(v) {
  const n = Number(v);
  if (!n || isNaN(n)) return '';
  if (n >= 1e6) return `£${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}m`;
  if (n >= 1e3) return `£${Math.round(n / 1e3)}k`;
  return `£${Math.round(n)}`;
}

// ─── Coach lookup ──────────────────────────────────────────────────────────
export function listSavedCoaches() {
  try { return loadCoaches() || []; } catch (e) { return []; }
}

// Exact team+league+season match against saved tenures — the same rule
// CoachPanel's resolveTenureRows() uses. Falls back to any tenure at this club
// so a coach saved against last season still resolves.
export function findCoachForTeam(team) {
  let coaches = [];
  try { coaches = loadCoaches() || []; } catch (e) { return null; }
  const exact = coaches.find(c => (c.tenures || []).some(t =>
    t.team === team.team && t.league === team.league && t.season === team.season));
  if (exact) return exact;
  return coaches.find(c => (c.tenures || []).some(t => t.team === team.team)) || null;
}

function coachHtml(coach, team, coachScore, hideManagerScore = false, ink = headerInk(null), clubFacts = '') {
  if (!coach) {
    // No manager saved: the club facts still belong here rather than vanishing.
    return `
      <div style="position:absolute;left:${COACH_X}px;top:44px;width:${COACH_W}px;">
        <div style="font-size:12.5px;color:${ink.muted};">No manager saved for this club.</div>
        ${clubFacts ? `<div style="margin-top:14px;">${clubFacts}</div>` : ''}
      </div>`;
  }
  const rawId = coach.fotmobId || '';
  const fmId = typeof rawId === 'string' && rawId.includes('fotmob.com')
    ? (rawId.match(/\/(\d+)\.png/) || [])[1] || null
    : (rawId || null);
  const photo = fmId ? `${FOTMOB_PHOTO_BASE}${fmId}.png` : (coach.photoDataUrl || coach.photoUrl || '');

  const iso = countryToIso2(coach.nationality || '');
  const formation = (Array.isArray(coach.formations) ? coach.formations[0] : coach.formation) || '';
  const seasonsHere = (coach.tenures || []).filter(t => t.team === team.team).length;

  // "Since" is the start of their spell here, derived from the earliest saved
  // tenure at this club — NOT coach.contract, which is the contract end year.
  const clubSeasons = (coach.tenures || [])
    .filter(t => t.team === team.team)
    .map(t => String(t.season))
    .sort();
  const sinceYear = clubSeasons.length ? clubSeasons[0].slice(0, 4) : '';

  const facts = [
    formation ? ['Formation', formation] : null,
    sinceYear ? ['Since', sinceYear] : null,

    coach.contract ? ['Contract', coach.contract] : null,
  ].filter(Boolean);

  // The pale band at the top of the photo was never a crop problem — FotMob
  // headshots have TRANSPARENT backgrounds, so the light container colour was
  // showing through above the head. Zooming to hide it just cropped the face.
  // A dark container fixes it properly and the image can sit at natural size.
  const photoCss = photo
    ? `background-image:url('${src(photo)}');background-size:cover;background-position:center top;`
    : '';

  // Subtle, inline with the name — not a separate headline number.
  const scoreChip = (coachScore == null || hideManagerScore) ? '' : `
    <span style="display:inline-block;margin-left:12px;padding:2px 9px;border-radius:11px;
                 background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.13);
                 font-size:15px;font-weight:800;color:${gradeColor(coachScore)};
                 vertical-align:middle;">${whole(coachScore)}</span>`;

  return `
    <div style="position:absolute;left:${COACH_X}px;top:20px;width:${COACH_W}px;height:114px;">
      <div style="position:absolute;left:0;top:4px;width:94px;height:94px;border-radius:11px;
                  background-color:#151b2e;${photoCss}
                  background-repeat:no-repeat;
                  border:1px solid rgba(255,255,255,0.16);"></div>

      <div style="position:absolute;left:110px;top:4px;width:${COACH_W - 110}px;">
        <div style="font-size:9.5px;font-weight:700;letter-spacing:0.16em;color:${ink.muted};">MANAGER</div>
        <div style="margin-top:4px;white-space:nowrap;">
          <span style="font-size:25px;font-weight:700;color:${ink.primary};vertical-align:middle;">${esc(coach.name || '')}</span>${scoreChip}
        </div>
        <div style="display:flex;align-items:center;margin-top:7px;white-space:nowrap;">
          ${iso ? `<div style="width:24px;height:15px;flex-shrink:0;background-size:cover;
                     background-position:center;border-radius:2px;
                     box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);
                     background-image:url('${src(`https://flagcdn.com/w40/${iso}.png`)}');"></div>` : ''}
          <span style="font-size:12.5px;color:${ink.soft};${iso ? 'margin-left:7px;' : ''}">${esc(coach.nationality || '')}</span>
          ${facts.map(([k, v]) =>
            `<span style="font-size:11.5px;color:${ink.muted};margin-left:18px;">
               ${k}: <span style="color:${ink.secondary};font-weight:600;">${esc(v)}</span></span>`).join('')}
        </div>
        ${clubFacts ? `<div style="margin-top:9px;">${clubFacts}</div>` : ''}
      </div>
    </div>`;
}

// ─── Header ────────────────────────────────────────────────────────────────
function headerHtml(team, coach, coachScore, allTeams, headerColour, rawOverall, hideManagerScore,
                    purchaseValue, purchaseRank, objective, teamNameOverride, objectiveOutcome, allTeamSeasons) {
  const displayName = (teamNameOverride && teamNameOverride.trim()) || team.team;
  const crest = teamCrest(team.team);
  const league = leagueDisplayName(team.league);
  const logo = leagueLogo(team.league);
  const flag = leagueFlag(team.league);
  // completeScore is league-weighted; overall is the raw within-league score.
  // Same pair TeamIndex's "Raw Score (not league weighted)" toggle switches on.
  const spec = headerColour;
  const ink = headerInk(spec);
  const ageRankLate = rankIn(allTeams, team, 'avgAge', false);
  const leagueSizeLate = (allTeams || []).filter(t =>
    String(t.league) === String(team.league) && String(t.season) === String(team.season)).length || null;
  const ovr = rawOverall ? (team.overall ?? team.completeScore) : team.completeScore;
  const cells = [
    ['ATTACK', team.attack], ['DEFENCE', team.defence],
    ['POSSESSION', team.possession], ['PRESSING', team.pressing],
  ];
  // Club facts render as one quiet line inside the manager block — same zone, no
  // divider, deliberately lower contrast than his name so it reads as context.
  const clubFactsHtml = (() => {
    const bits = [];
    if (team.avgAge != null && !isNaN(team.avgAge)) {
      bits.push(['AVG AGE', Number(team.avgAge).toFixed(1), ageRankLate]);
    }
    if (purchaseValue) {
      bits.push(['SQUAD COST', purchaseValue,
        (purchaseRank && leagueSizeLate) ? { rank: purchaseRank, size: leagueSizeLate } : null]);
    }
    const oc = OBJECTIVE_COLOUR[objective] || '#94a3b8';
    const out = OUTCOME_STYLE[objectiveOutcome] || null;
    if (!bits.length && !objective) return '';
    return `
      <div style="display:flex;align-items:baseline;white-space:nowrap;">
        ${bits.map(([k, v, rk], i) => `
          <span style="${i ? 'margin-left:22px;' : ''}font-size:7.5px;font-weight:700;
                       letter-spacing:0.13em;color:${ink.muted};">${k}:</span>
          <!-- fixed-width value column, right-aligned, so "27.7" and "£49m" end
               on the same edge and their ranks line up beneath each other -->
          <span style="display:inline-block;width:46px;text-align:right;margin-left:8px;
                       font-size:11.5px;font-weight:700;color:${ink.soft};">${v}</span>
          <span style="display:inline-block;width:38px;text-align:left;margin-left:6px;
                       font-size:8.5px;font-weight:600;color:${ink.muted};">${rk ? rankStr(rk) : ''}</span>
        `).join('')}
        ${objective ? `
          <span style="${bits.length ? 'margin-left:14px;' : ''}font-size:7.5px;font-weight:700;
                       letter-spacing:0.13em;color:${ink.muted};">OBJECTIVE:</span>
          <span style="margin-left:8px;font-size:9.5px;font-weight:700;color:${oc};">${esc(objective)}</span>
          ${out ? `<span style="display:inline-flex;align-items:center;justify-content:center;
                margin-left:6px;width:14px;height:14px;border-radius:50%;background:${out.c}22;
                border:1px solid ${out.c}66;font-size:8px;font-weight:800;
                color:${out.c};line-height:1;vertical-align:middle;">${out.g}</span>` : ''}` : ''}
      </div>`;
  })();

  const ptsRank = team.pointsRank != null && team.leagueSize != null
    ? { rank: team.pointsRank, size: team.leagueSize }
    : rankIn(allTeams, team, 'points');
  const xptsRank = rankIn(allTeams, team, 'expectedPoints');
  // Youngest = 1. Not a value judgement — it's the trajectory signal.
  const ageRank = ageRankLate;
  const leagueSize = leagueSizeLate;

  return `
    <div style="position:absolute;top:0;left:0;width:${W}px;height:${HEADER_H}px;
                background:${headerGradient(headerColour)};
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"></div>

    ${crest ? `<div style="position:absolute;left:${PAD}px;top:21px;width:108px;height:108px;
                background-image:url('${src(crest)}');background-size:contain;
                background-repeat:no-repeat;background-position:center;"></div>` : ''}

    <div style="position:absolute;left:${NAME_X}px;top:16px;width:${NAME_MAX_W}px;
                font-size:52px;font-weight:800;letter-spacing:-0.8px;line-height:1.02;color:${ink.primary};
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(displayName)}</div>

    <!-- country flag + league logo + league name + season, one nowrap row -->
    <div style="position:absolute;left:${NAME_X}px;top:78px;display:flex;align-items:center;
                white-space:nowrap;">
      ${flag ? `<div style="width:27px;height:17px;flex-shrink:0;background-size:cover;
                  background-position:center;border-radius:2px;
                  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);
                  background-image:url('${src(flag)}');"></div>` : ''}
      ${logo ? `<div style="width:24px;height:24px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${src(logo)}');margin-left:9px;"></div>` : ''}
      <span style="font-size:20px;font-weight:600;color:${ink.secondary};margin-left:9px;">${esc(league)}</span>
      ${team.season ? `<span style="font-size:18px;font-weight:500;color:${ink.muted};margin-left:12px;">· ${esc(team.season)}</span>` : ''}
    </div>

    <!-- League standing sits with the club identity, not with the style scores —
         it's a fact about the season rather than a measure of how they play. -->
    <div style="position:absolute;left:${NAME_X}px;top:117px;display:flex;align-items:center;
                white-space:nowrap;">
      <span style="font-size:8px;font-weight:700;letter-spacing:0.14em;color:${ink.muted};">PTS</span>
      <span style="font-size:13px;font-weight:800;color:${ink.secondary};margin-left:7px;">${rankStr(ptsRank)}</span>
      <span style="font-size:8px;font-weight:700;letter-spacing:0.14em;color:${ink.muted};margin-left:24px;">xPTS</span>
      <span style="font-size:13px;font-weight:800;color:${ink.secondary};margin-left:7px;">${rankStr(xptsRank)}</span>
    </div>

    ${[RULE_1, RULE_2].filter(Boolean).map(x =>
      `<div style="position:absolute;left:${x}px;top:28px;width:1px;height:100px;
                   background:${ink.rule};"></div>`).join('')}

    <!-- FIVE WHEELS. One repeated shape across the whole span reads as a single
         system; OVERALL is bigger and sits first so the hierarchy still holds. -->
    ${(() => {
      // Possession and Pressing are dropped: they're style descriptors and both
      // already appear as Style rows, so as wheels they duplicated that panel.
      // What's left — Overall, Attack, Defence — is the quality axis.
      const all = [['OVERALL', ovr, true],
                   ...cells.filter(([l]) => l === 'ATTACK' || l === 'DEFENCE').map(([l, v]) => [l, v, false])];
      const step = WHEEL_W / all.length;
      return all.map(([label, v, big], i) => scoreWheel({
        cx: WHEEL_X + step * i + step / 2,
        cy: 66,
        r: big ? 38 : 28,
        stroke: big ? 8 : 6,
        value: v, label, colour: scoreColor(v), ink, big, labelY: HDR_LABEL_Y,
      })).join('');
    })()}

    <!-- Matches RULE_1/RULE_2's 28..122 span so all three rules bracket the same
         band, including the label baseline at the bottom of it. -->
    <div style="position:absolute;left:${RULE_MID}px;top:28px;width:1px;height:100px;
                background:${ink.rule};"></div>

    <!-- Chart occupies 30..106 and its axis row lands on HDR_LABEL_Y with the
         wheel labels. Taller as well as wider now that RULE_MID moved left. -->
    ${trendChart({ x: TREND_X, y: 30, w: TREND_W, h: 76,
                   seasons: allTeamSeasons, allTeams, ink })}

    ${coachHtml(coach, team, coachScore, hideManagerScore, ink, clubFactsHtml)}`;
}

// ─── Image handling ────────────────────────────────────────────────────────
// html-to-image fetches every remote image ITSELF and inlines it as a data URL,
// once per toPng call — so the double-render pattern means two fetches for each
// of ~16 images. A `new Image()` preload doesn't help, because those cache
// entries aren't what html-to-image reuses.
//
// So: fetch everything once up front, convert to data URLs, and hand the render
// a card with no remote references at all. Both passes then cost nothing.
// Anything that fails falls back to its original URL — no worse than before.
let IMG = {};
const src = (url) => (url && IMG[url]) || url || '';

export function cardImageUrls(team, squad, coach, allTeams = [], extraPlayers = []) {
  const urls = [teamCrest(team.team), leagueLogo(team.league), leagueFlag(team.league)];
  // Similar-team crests, so they're inlined like everything else.
  for (const t of resolveSimilarTeams(team, allTeams, 3)) urls.push(teamCrest(t.team));
  // League-table crests.
  const lw = leagueWindow(team, allTeams, 5);
  for (const t of lw.rows) urls.push(teamCrest(t.team));
  if (lw.pinnedTop) urls.push(teamCrest(lw.pinnedTop.team));
  for (const p of squad) urls.push(photoUrl(p.name, p.team));
  // Recruitment picks can sit outside the squad.
  for (const p of (extraPlayers || [])) urls.push(photoUrl(p.name, p.team));
  if (coach) {
    const rawId = coach.fotmobId || '';
    const fmId = typeof rawId === 'string' && rawId.includes('fotmob.com')
      ? (rawId.match(/\/(\d+)\.png/) || [])[1] || null : (rawId || null);
    urls.push(fmId ? `${FOTMOB_PHOTO_BASE}${fmId}.png` : (coach.photoDataUrl || coach.photoUrl || ''));
    const iso = countryToIso2(coach.nationality || '');
    if (iso) urls.push(`https://flagcdn.com/w40/${iso}.png`);
  }
  return [...new Set(urls.filter(u => u && !u.startsWith('data:')))];
}

function fetchAsDataUrl(url, timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    setTimeout(() => finish(null), timeoutMs);
    fetch(url, { mode: 'cors', cache: 'force-cache' })
      .then(r => (r.ok ? r.blob() : null))
      .then(b => {
        if (!b) return finish(null);
        const fr = new FileReader();
        fr.onload = () => finish(fr.result);
        fr.onerror = () => finish(null);
        fr.readAsDataURL(b);
      })
      .catch(() => finish(null));
  });
}

// Concurrency capped — 16 parallel requests to raw.githubusercontent is slower
// than 6, and one stalled photo shouldn't hold up the rest.
export async function preloadImages(urls, onProgress, timeoutMs = 4000, concurrency = 6) {
  const map = {};
  let done = 0;
  const queue = urls.slice();
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      const data = await fetchAsDataUrl(url, timeoutMs);
      if (data) map[url] = data;
      done += 1;
      if (onProgress) onProgress(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, urls.length)) }, worker));
  return map;
}

export function buildTeamReportElement(team, opts = {}) {
  const { squad = [], formation = '4-3-3', coach = null, images = {}, depthCount = 2, coachScore = null, allTeams = [], headerColour = null, rawOverall = false,
    bottomLeft = 'Similar Teams',
    bottomRight = 'Key Players',
    summaryText = '',
    keyRows = null,                // explicit Key Players list
    recruitRows = [],              // Recruitment Recommendations list
    departureRows = null,          // null = auto (shortest contracts)
    depthList = null, upgradeList = null,
    xiSlotLists = null,
    xiOverridePool = null,
    hidePlayerScores = false,
    hideManagerScore = false,
    metaMode = 'age',        // 'age' | 'contract' | 'none'
    setPieces = null,        // averaged 1-10 rating, already x10
    extraAreas = [],         // [{ name, severity }]
    allTeamSeasons = [],     // this club's season history, for the trend line
    purchaseValue = '', purchaseRank = null, objective = '', teamNameOverride = '',
    objectiveOutcome = '',
  } = opts;
  IMG = images || {};

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${W}px`;
  container.style.height = `${H}px`;

  const innerW = COL_W - PANEL_PAD * 2;
  const xiW = LEFT_W - PANEL_PAD * 2;
  const xiH = LEFT_H - PANEL_PAD * 2 - TITLE_H;

  const xi = buildXI(formation, squad, depthCount, team.season, null, xiOverridePool, xiSlotLists);
  const players3 = keyRows || topPlayers(squad, 3);
  const departures = departureRows || likelyDepartures(squad, team.season, 3);

  container.innerHTML = `
    <div id="tr-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(team, coach, coachScore, allTeams, headerColour, rawOverall, hideManagerScore,
                   purchaseValue, purchaseRank, objective, teamNameOverride, objectiveOutcome, allTeamSeasons)}

      ${panel({ x: PAD, y: BODY_TOP, w: LEFT_W, h: LEFT_H,
                title: 'XI + Depth', right: formation, body: xiPanelHtml(xiW, xiH, xi, { hideScores: hidePlayerScores, metaMode, season: team.season }) })}

      ${panel({ x: COL_A_X, y: ROW_1, w: COL_W, h: ROW1_H,
                title: 'Performance', body: radarPanelHtml(innerW, ROW1_H - PANEL_PAD * 2 - TITLE_H, team, allTeams) })}
      ${panel({ x: COL_B_X, y: ROW_1, w: COL_W, h: ROW1_H,
                title: 'Style', body: stylePanelHtml(innerW, ROW1_H - PANEL_PAD * 2 - TITLE_H, team, setPieces) })}

      ${panel({ x: COL_A_X, y: ROW_2, w: COL_W, h: ROW2_H,
                title: 'League Table', body: leagueTablePanelHtml(innerW, ROW2_H - PANEL_PAD * 2 - TITLE_H, team, allTeams) })}
      ${panel({ x: COL_B_X, y: ROW_2, w: COL_W, h: ROW2_H,
                title: 'Areas to Improve',
                body: weaknessesPanelHtml(innerW, ROW2_H - PANEL_PAD * 2 - TITLE_H, team, allTeams, xi, depthList, upgradeList, setPieces, extraAreas) })}

      ${[['A', COL_A_X, bottomLeft], ['B', COL_B_X, bottomRight]].map(([, x, kind]) => {
        const ih = ROW3_H - PANEL_PAD * 2 - TITLE_H;
        if (kind === 'None') return '';
        if (kind === 'Similar Teams')
          return panel({ x, y: ROW_3, w: COL_W, h: ROW3_H, title: 'Similar Teams',
                         body: similarTeamsPanelHtml(innerW, ih, team, allTeams) });
        if (kind === 'Summary')
          return panel({ x, y: ROW_3, w: COL_W, h: ROW3_H, title: 'Summary',
                         body: summaryPanelHtml(innerW, ih, summaryText) });
        if (kind === 'Possible Departures')
          return panel({ x, y: ROW_3, w: COL_W, h: ROW3_H, title: 'Possible Departures',
                         body: departuresPanelHtml(innerW, ih, departures, team.season) });
        if (kind === 'Recruitment Recommendations')
          return panel({ x, y: ROW_3, w: COL_W, h: ROW3_H, title: 'Recruitment Recommendations',
                         body: keyPlayersPanelHtml(innerW, ih, recruitRows, true, hidePlayerScores) });
        return panel({ x, y: ROW_3, w: COL_W, h: ROW3_H, title: 'Key Players',
                       body: keyPlayersPanelHtml(innerW, ih, players3, false, hidePlayerScores) });
      }).join('')}
    </div>`;

  document.body.appendChild(container);
  return container;
}

// Per-slot XI editor. Replaces the eleven dropdowns: each row shows who's in the
// slot with a clear button, and clicking it opens a search filtered to players
// who actually suit that position (best fits first). Choosing someone already in
// another slot SWAPS the two rather than leaving a hole.
function XiSlotEditor({ xi, pool, lists, setLists, teamName }) {
  const [openSlot, setOpenSlot] = useState(null);
  const [q, setQ] = useState('');
  const [anyPos, setAnyPos] = useState(false);

  // The list a slot is actually showing — explicit if set, otherwise whatever
  // the auto-fill produced. Editing anything converts it to explicit.
  const currentList = (slot, row) =>
    Array.isArray(lists[slot.id])
      ? lists[slot.id]
      : [row.starter, ...(row.depth || [])].filter(Boolean).map(playerKey);

  const setList = (slotId, keys) => setLists(l => ({ ...l, [slotId]: keys }));
  const revert = (slotId) => setLists(l => { const n = { ...l }; delete n[slotId]; return n; });

  const move = (slot, row, i, dir) => {
    const arr = currentList(slot, row).slice();
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setList(slot.id, arr);
  };
  const removeAt = (slot, row, i) => {
    const arr = currentList(slot, row).slice();
    arr.splice(i, 1);
    setList(slot.id, arr);
  };
  const add = (slot, row, p) => {
    const arr = currentList(slot, row).slice();
    const k = playerKey(p);
    if (!arr.includes(k)) arr.push(k);
    setList(slot.id, arr);
    setOpenSlot(null); setQ('');
  };

  const byKey = useMemo(() => new Map(pool.map(p => [playerKey(p), p])), [pool]);

  return (
    <div>
      {xi.map((row) => {
        const slot = row.slot;
        const open = openSlot === slot.id;
        const explicit = Array.isArray(lists[slot.id]);
        const keys = currentList(slot, row);
        const t = q.trim().toLowerCase();
        const results = !open ? [] : pool
          .filter(p => !keys.includes(playerKey(p)))
          .filter(p => !t || foldIncludes(p.name, t) || foldIncludes(p.team || '', t))
          .map(p => ({ p, fit: slotFitRank(p, slot.label) }))
          .filter(x => (anyPos || t) ? true : x.fit < 99)
          .sort((a, b) => a.fit - b.fit
            || (b.p.minutesLatest || 0) - (a.p.minutesLatest || 0)
            || (b.p.careerScore || 0) - (a.p.careerScore || 0))
          .slice(0, 8);

        return (
          <div key={slot.id} style={{ marginBottom: 6, border: `1px solid ${explicit ? '#26456f' : '#16233a'}`,
                                      borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#0d1220', padding: '4px 8px' }}>
              <span style={{ flex: 1, fontSize: 10, fontWeight: 800,
                             color: explicit ? '#60a5fa' : '#6f7c92' }}>{slot.label}</span>
              {explicit && (
                <button onClick={() => revert(slot.id)} title="Back to auto"
                  style={{ background: 'transparent', border: '1px solid #1e2d45', borderRadius: 4,
                           color: '#8b98ad', fontSize: 9, padding: '1px 6px', cursor: 'pointer',
                           marginRight: 6 }}>auto</button>
              )}
              <button onClick={() => { setOpenSlot(open ? null : slot.id); setQ(''); }}
                style={{ background: 'transparent', border: '1px solid #1e2d45', borderRadius: 4,
                         color: '#60a5fa', fontSize: 9, padding: '1px 7px', cursor: 'pointer' }}>+ add</button>
            </div>

            {!keys.length && (
              <div style={{ padding: '6px 9px', fontSize: 10.5, color: '#55617a', background: '#080e19' }}>
                Empty — nothing shown in this position.
              </div>
            )}

            {keys.map((k, i) => {
              const p = byKey.get(k);
              if (!p) return null;
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', background: '#080e19',
                                      padding: '4px 8px', borderTop: '1px solid #101a2c' }}>
                  <span style={{ width: 34, flexShrink: 0, fontSize: 8.5, fontWeight: 700,
                                 color: i === 0 ? '#60a5fa' : '#55617a' }}>
                    {i === 0 ? 'XI' : `${i + 1}${i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}`}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: i === 0 ? '#e2e8f4' : '#93a1b5',
                                 whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                    {p.team !== teamName && <span style={{ color: '#64748b' }}> · {p.team}</span>}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#8b98ad', marginLeft: 6 }}>
                    {p.careerScore != null ? Math.round(p.careerScore) : '—'}</span>
                  <button onClick={() => move(slot, row, i, -1)} disabled={i === 0} title="Move up"
                    style={{ marginLeft: 6, background: 'transparent', border: 'none',
                             color: i === 0 ? '#26324a' : '#8b98ad', fontSize: 11,
                             cursor: i === 0 ? 'default' : 'pointer', padding: '0 2px' }}>▲</button>
                  <button onClick={() => move(slot, row, i, 1)} disabled={i === keys.length - 1} title="Move down"
                    style={{ background: 'transparent', border: 'none',
                             color: i === keys.length - 1 ? '#26324a' : '#8b98ad', fontSize: 11,
                             cursor: i === keys.length - 1 ? 'default' : 'pointer', padding: '0 2px' }}>▼</button>
                  <button onClick={() => removeAt(slot, row, i)} title="Remove"
                    style={{ marginLeft: 4, background: 'transparent', border: 'none', color: '#64748b',
                             fontSize: 13, lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}>×</button>
                </div>
              );
            })}

            {open && (
              <div style={{ padding: '7px 8px', background: '#060b14', borderTop: '1px solid #101a2c' }}>
                <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                  placeholder={`Search for ${slot.label}…`} style={{ ...UI.input, fontSize: 11 }} />
                <div onClick={() => setAnyPos(v => !v)}
                     style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: '6px 0 2px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                                border: `1px solid ${anyPos ? '#3b7de8' : '#1e2d45'}`,
                                background: anyPos ? '#3b7de8' : 'transparent' }} />
                  <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>Any position</span>
                </div>
                {results.map(({ p, fit }) => (
                  <div key={playerKey(p)} onClick={() => add(slot, row, p)}
                       style={{ display: 'flex', alignItems: 'center', cursor: 'pointer',
                                padding: '4px 2px', borderBottom: '1px solid #101a2c' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#c8d2e0',
                                   whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                      <span style={{ color: '#55617a' }}> · {String(p.position || '').split(',')[0].trim()}</span>
                      {p.team !== teamName && <span style={{ color: '#64748b' }}> · {p.team}</span>}
                    </span>
                    {fit === 0 && <span style={{ fontSize: 8.5, color: '#22c55e', marginLeft: 6 }}>NAT</span>}
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8b98ad', marginLeft: 7 }}>
                      {p.careerScore != null ? Math.round(p.careerScore) : '—'}</span>
                  </div>
                ))}
                {!results.length && <div style={UI.note}>No match — try "Any position".</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────
// ─── Small modal building blocks ───────────────────────────────────────────
const UI = {
  label: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase',
           letterSpacing: '.04em', display: 'block', marginBottom: 6 },
  select: { width: '100%', background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 5,
            color: '#e2e8f4', padding: '6px 7px', fontSize: 11.5, cursor: 'pointer' },
  input: { width: '100%', background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 5,
           color: '#e2e8f4', padding: '6px 8px', fontSize: 11.5, boxSizing: 'border-box' },
  block: { textAlign: 'left', marginBottom: 14 },
  note: { fontSize: 10.5, color: '#64748b', marginTop: 5 },
};

function Section({ title, open, onToggle, children }) {
  return (
    <div style={{ border: '1px solid #16233a', borderRadius: 8, marginBottom: 10,
                  background: 'rgba(255,255,255,0.015)' }}>
      <div onClick={onToggle}
           style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 11px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em',
                       textTransform: 'uppercase', color: open ? '#ff66c4' : '#8b98ad' }}>{title}</span>
        <span style={{ color: '#64748b', fontSize: 11 }}>{open ? '−' : '+'}</span>
      </div>
      {open && <div style={{ padding: '0 11px 12px' }}>{children}</div>}
    </div>
  );
}

function Chips({ options, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {options.map((o, i) => {
        const on = selected.includes(o);
        return (
          <button key={o + i} onClick={() => onToggle(o)}
            style={{ padding: '4px 9px', marginRight: 6, marginBottom: 6, borderRadius: 11,
                     border: `1px solid ${on ? '#3b7de8' : '#1e2d45'}`,
                     background: on ? '#0e2040' : 'transparent',
                     color: on ? '#60a5fa' : '#94a3b8',
                     fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>{o}</button>
        );
      })}
    </div>
  );
}

// Type-to-search player picker. Only searches once there are 2+ characters —
// the pool can be the full ~83k player list, so it never renders unfiltered.
function PlayerPicker({ pool, picked, onPick, onRemove, max = 3, placeholder }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const out = [];
    for (const p of pool) {
      if (!p || !p.name) continue;
      if (foldIncludes(p.name, t) || foldIncludes(p.team || '', t)) {
        out.push(p);
        if (out.length >= 40) break;
      }
    }
    return out.sort((a, b) => (b.careerScore || 0) - (a.careerScore || 0)).slice(0, 8);
  }, [q, pool]);

  return (
    <div>
      {picked.map((p, i) => (
        <div key={playerKey(p) + i}
             style={{ display: 'flex', alignItems: 'center', marginBottom: 5,
                      background: '#0d1220', border: '1px solid #1e2d45',
                      borderRadius: 6, padding: '5px 8px' }}>
          <span style={{ flex: 1, fontSize: 11.5, color: '#e2e8f4', overflow: 'hidden',
                         whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {p.name} <span style={{ color: '#64748b' }}>· {p.team}</span>
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginLeft: 8 }}>
            {p.careerScore != null ? Math.round(p.careerScore) : '—'}
          </span>
          <button onClick={() => onRemove(p)}
            style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#64748b',
                     cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      ))}
      {picked.length < max && (
        <>
          <input value={q} onChange={e => setQ(e.target.value)}
                 placeholder={placeholder || 'Search player…'} style={UI.input} />
          {results.map((p, i) => (
            <div key={playerKey(p) + i} onClick={() => { onPick(p); setQ(''); }}
                 style={{ display: 'flex', alignItems: 'center', cursor: 'pointer',
                          padding: '5px 8px', borderBottom: '1px solid #101a2c' }}>
              <span style={{ flex: 1, fontSize: 11, color: '#c8d2e0', overflow: 'hidden',
                             whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {p.name} <span style={{ color: '#64748b' }}>· {p.team}</span>
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8b98ad', marginLeft: 8 }}>
                {p.careerScore != null ? Math.round(p.careerScore) : '—'}
              </span>
            </div>
          ))}
          {q.trim().length === 1 && <div style={UI.note}>Keep typing…</div>}
          {q.trim().length >= 2 && !results.length && <div style={UI.note}>No match.</div>}
        </>
      )}
    </div>
  );
}
// ─── Modal ─────────────────────────────────────────────────────────────────
export default function TeamReport({ team, allTeamSeasons = [], allTeams = [], players = [], onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [openSection, setOpenSection] = useState('layout');
  const toggleSection = (k) => setOpenSection(cur => (cur === k ? '' : k));

  const [formation, setFormation] = useState('4-3-3');
  const [depthCount, setDepthCount] = useState(2);
  const [headerColourName, setHeaderColourName] = useState('Default');
  const [rawOverall, setRawOverall] = useState(false);
  const [bottomLeft, setBottomLeft] = useState('Similar Teams');
  const [bottomRight, setBottomRight] = useState('Key Players');
  const [departureKeys, setDepartureKeys] = useState(null);
  const [teamNameOverride, setTeamNameOverride] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [keyMode, setKeyMode] = useState('auto');          // auto | manual | recruit
  const [manualKeys, setManualKeys] = useState([]);
  const [recruitKeys, setRecruitKeys] = useState([]);
  const [xiLists, setXiLists] = useState({});
  const [purchaseValue, setPurchaseValue] = useState('');
  const [purchaseRank, setPurchaseRank] = useState('');
  const [objective, setObjective] = useState('');
  const [objectiveOutcome, setObjectiveOutcome] = useState('');
  const [hidePlayerScores, setHidePlayerScores] = useState(false);
  const [hideManagerScore, setHideManagerScore] = useState(false);
  const [metaMode, setMetaMode] = useState('age');   // beside player names
  const [spAtt, setSpAtt] = useState('');
  const [spDef, setSpDef] = useState('');
  const [extraAreas, setExtraAreas] = useState({});   // { name: severity }
  const [xiSearchAll, setXiSearchAll] = useState(false);
  const [depthSel, setDepthSel] = useState(null);          // null = auto
  const [upgradeSel, setUpgradeSel] = useState(null);

  const squad = useMemo(() => {
    const norm = (l) => String(l || '').trim().replace(/\.$/, '').toLowerCase();
    return players.filter(p =>
      String(p.team).toLowerCase() === String(team.team).toLowerCase() &&
      norm(p.league) === norm(team.league));
  }, [players, team]);

  const savedCoaches = useMemo(() => listSavedCoaches(), []);
  const autoCoach = useMemo(() => findCoachForTeam(team), [team]);
  const [coachId, setCoachId] = useState('auto');
  const coach = coachId === 'auto' ? autoCoach
    : coachId === 'none' ? null
    : (savedCoaches.find(c => String(c.id) === String(coachId)) || autoCoach);

  const tenureRows = useMemo(() => {
    if (!coach) return [];
    return (coach.tenures || [])
      .map(t => allTeams.find(x => x.team === t.team && x.league === t.league && x.season === t.season))
      .filter(Boolean);
  }, [coach, allTeams]);

  const totalMVByTeam = useMemo(() => {
    const sums = {};
    for (const p of players) {
      if (!p.marketValue || p.marketValue <= 0) continue;
      const k = String(p.team).toLowerCase() + '|' + String(p.league || '').trim().replace(/\.$/, '').toLowerCase();
      sums[k] = (sums[k] || 0) + p.marketValue;
    }
    return sums;
  }, [players]);

  // Ported from CoachPanel.buildSeasonPerfMap / getMVPerfRank — the 25%
  // "£ performance" half of the manager score. The ranking is mv-rank MINUS
  // points-rank (overperformance vs spend), then teams ranked on THAT.
  const seasonPerf = useMemo(() => {
    const getTotalMV = (t, l) =>
      totalMVByTeam[String(t).toLowerCase() + '|' + String(l || '').trim().replace(/\.$/, '').toLowerCase()] ?? null;
    const map = {};
    for (const row of tenureRows) {
      const peers = allTeams.filter(t => String(t.league) === String(row.league)
                                     && String(t.season) === String(row.season));
      const withMV = peers.map(t => ({ t, mv: getTotalMV(t.team, t.league) }))
                          .filter(x => x.mv != null && x.t.pointsRank != null);
      if (withMV.length < 2) continue;
      withMV.sort((a, b) => b.mv - a.mv);
      const perf = withMV.map((x, i) => ({ team: x.t.team, val: (i + 1) - Number(x.t.pointsRank) }));
      const ranked = perf.slice().sort((a, b) => b.val - a.val);
      const idx = ranked.findIndex(x => String(x.team).toLowerCase() === String(row.team).toLowerCase());
      if (idx < 0) continue;
      map[`${row.season}||${row.league}||${row.team}`] =
        Math.round(((ranked.length - (idx + 1)) / (ranked.length - 1)) * 1000) / 10;
    }
    return map;
  }, [tenureRows, allTeams, totalMVByTeam]);

  const coachScore = useMemo(() => {
    if (!coach || !tenureRows.length) return null;
    try {
      let age = null;
      try { age = computeAge(coach.dob); } catch (e) { age = null; }
      return computeCoachScore(tenureRows, age, { seasonPerf }).score;
    } catch (e) { return null; }
  }, [coach, tenureRows, seasonPerf]);

  const xiPool = xiSearchAll ? players : squad;

  const xi = useMemo(() => buildXI(formation, squad, depthCount, team.season, null, xiPool, xiLists),
                     [formation, squad, depthCount, team, xiPool, xiLists]);
  const filled = xi.filter(s => s.starter).length;

  const slotLabels = useMemo(() => {
    const seen = [];
    xi.forEach(s => { if (!seen.includes(s.slot.label)) seen.push(s.slot.label); });
    return seen;
  }, [xi]);
  const autoDepth = useMemo(() => uncoveredSlots(xi), [xi]);
  const autoUpgrade = useMemo(() => improveSlots(xi, team.season, 4).map(x => x.k), [xi, team]);

  const manualPicked = useMemo(() => findByKeys(squad, manualKeys), [squad, manualKeys]);
  const recruitPicked = useMemo(() => findByKeys(players, recruitKeys), [players, recruitKeys]);

  const keyRows = keyMode === 'manual' ? manualPicked : topPlayers(squad, 3);
  const autoDepartures = useMemo(() => likelyDepartures(squad, team.season, 3), [squad, team]);
  const departurePicked = departureKeys === null ? autoDepartures : findByKeys(squad, departureKeys);
  const shown = [bottomLeft, bottomRight];

  const unmapped = useMemo(() => reportUnmappedTokens(squad), [squad]);
  const unmappedKeys = Object.keys(unmapped);
  const groupsPresent = new Set(players.map(p => p && p.roleKey).filter(Boolean)).size;
  const partialSquadData = players.length > 0 && groupsPresent < 4;
  const summaryWords = countWords(summaryText);

  const buildOpts = () => ({
    squad, formation, coach, depthCount, coachScore, allTeams,
    headerColour: HEADER_COLOURS[headerColourName], rawOverall,
    bottomLeft, bottomRight, summaryText,
    keyRows, recruitRows: recruitPicked, departureRows: departurePicked,
    teamNameOverride,
    depthList: depthSel, upgradeList: upgradeSel,
    xiSlotLists: xiLists, xiOverridePool: xiPool,
    hidePlayerScores, hideManagerScore, metaMode,
    setPieces: setPieceScore(spAtt, spDef),
    extraAreas: Object.keys(extraAreas).map(name => ({ name, severity: extraAreas[name] })),
    allTeamSeasons,
    purchaseValue: purchaseValue.trim(),
    purchaseRank: purchaseRank ? Number(purchaseRank) : null,
    objective, objectiveOutcome,
  });

  const handleDownload = async () => {
    setDownloading(true); setProgress('Loading images…'); setError('');
    let el = null;
    try {
      const { toPng } = await import('html-to-image');
      const outsiders = findByKeys(players, Object.values(xiLists || {}).flat())
        .filter(p => !squad.includes(p));
      const urls = cardImageUrls(team, squad, coach, allTeams,
        [...(keyRows || []), ...recruitPicked, ...departurePicked, ...outsiders]);
      const images = await preloadImages(urls, (d, t) => setProgress(`Images ${d}/${t}`));
      setProgress('Rendering…');
      el = buildTeamReportElement(team, { ...buildOpts(), images });
      const cardNode = el.querySelector('#tr-card-root') || el;
      const opts = {
        width: W, height: H, pixelRatio: 1, backgroundColor: BG,
        cacheBust: false, fontEmbedCSS: MONTSERRAT_EMBED_CSS,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      };
      await toPng(cardNode, opts);
      const dataUrl = await toPng(cardNode, opts);
      const a = document.createElement('a');
      a.download = `${String(team.team).replace(/\s+/g, '_')}_team_report.png`;
      a.href = dataUrl; a.click();
    } catch (e) {
      console.error('[TeamReport] download failed:', e);
      setError(String((e && e.message) || e));
    } finally {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      setDownloading(false); setProgress('');
    }
  };

  const note = { fontSize: 11.5, borderRadius: 8, padding: '8px 10px', marginBottom: 12, lineHeight: 1.45 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#09111e', border: '1px solid #1e2d45', borderRadius: 12,
                    padding: 22, boxShadow: '0 8px 40px rgba(0,0,0,.7)',
                    width: 460, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ textAlign: 'center', marginBottom: 14, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f4' }}>Team Report</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {team.team} · {leagueDisplayName(team.league)}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, marginRight: -4 }}>

          <Section title="Layout & panels" open={openSection === 'layout'} onToggle={() => toggleSection('layout')}>
            <div style={UI.block}>
              <span style={UI.label}>Bottom row</span>
              <div style={{ display: 'flex' }}>
                <select value={bottomLeft} onChange={e => setBottomLeft(e.target.value)}
                        style={{ ...UI.select, flex: 1 }}>
                  {BOTTOM_PANELS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={bottomRight} onChange={e => setBottomRight(e.target.value)}
                        style={{ ...UI.select, flex: 1, marginLeft: 6 }}>
                  {BOTTOM_PANELS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={UI.note}>Left and right can each hold any panel.</div>
            </div>
            <div style={UI.block}>
              <span style={UI.label}>Club name on card</span>
              <input value={teamNameOverride} onChange={e => setTeamNameOverride(e.target.value)}
                     placeholder={team.team} style={UI.input} />
            </div>
            {shown.includes('Summary') && (
              <div style={UI.block}>
                <span style={UI.label}>Summary</span>
                <textarea value={summaryText} rows={5}
                  onChange={e => setSummaryText(clampWords(e.target.value))}
                  placeholder="Write the scout summary…"
                  style={{ ...UI.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                <div style={{ ...UI.note, color: summaryWords >= SUMMARY_WORD_LIMIT ? '#f6a75c' : '#64748b' }}>
                  {summaryWords}/{SUMMARY_WORD_LIMIT} words
                </div>
              </div>
            )}
            <div style={UI.block}>
              <span style={UI.label}>Header colour</span>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {HEADER_COLOUR_NAMES.map((n) => {
                  const spec = HEADER_COLOURS[n];
                  const on = headerColourName === n;
                  return (
                    <button key={n} title={n} onClick={() => setHeaderColourName(n)}
                      style={{ width: 24, height: 24, borderRadius: 6, marginRight: 6, marginBottom: 6,
                               cursor: 'pointer', padding: 0,
                               border: on ? '2px solid #60a5fa' : '1px solid #1e2d45',
                               background: spec.hex || 'linear-gradient(135deg,rgb(23,26,77),rgb(17,22,42))' }} />
                  );
                })}
              </div>
            </div>
            <div style={UI.block}>
              <span style={UI.label}>Beside player names</span>
              <div style={{ display: 'flex' }}>
                {[['age', 'Age'], ['contract', 'Contract'], ['none', 'Nothing']].map(([v, lbl], i) => (
                  <button key={v} onClick={() => setMetaMode(v)}
                    style={{ flex: 1, padding: '5px 0', marginLeft: i ? 6 : 0, borderRadius: 5,
                             border: `1px solid ${metaMode === v ? '#3b7de8' : '#1e2d45'}`,
                             background: metaMode === v ? '#0e2040' : 'transparent',
                             color: metaMode === v ? '#60a5fa' : '#94a3b8',
                             fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
            </div>

            {[['Hide player scores', hidePlayerScores, setHidePlayerScores],
              ['Hide manager score', hideManagerScore, setHideManagerScore],
             ].map(([lbl, val, setter]) => (
              <div key={lbl} onClick={() => setter(v => !v)}
                   style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 7 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                              border: `1px solid ${val ? '#3b7de8' : '#1e2d45'}`,
                              background: val ? '#3b7de8' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {val && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>{lbl}</span>
              </div>
            ))}
            <div style={UI.block}>
              <span style={UI.label}>Set pieces (1–10)</span>
              <div style={{ display: 'flex' }}>
                <input value={spAtt} onChange={e => setSpAtt(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                       placeholder="Attacking" style={{ ...UI.input, flex: 1 }} />
                <input value={spDef} onChange={e => setSpDef(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                       placeholder="Defending" style={{ ...UI.input, flex: 1, marginLeft: 6 }} />
              </div>
              <div style={UI.note}>
                {setPieceScore(spAtt, spDef) == null
                  ? 'Leave blank to omit. Adds a 7th Style row when set.'
                  : `Average ${(setPieceScore(spAtt, spDef) / 10).toFixed(1)}/10${
                      setPieceScore(spAtt, spDef) <= SET_PIECE_WEAK_CUTOFF * 10
                        ? ' — flagged in Weaknesses' : ''}`}
              </div>
            </div>

            <div style={UI.block}>
              <span style={UI.label}>Objective</span>
              <div style={{ display: 'flex' }}>
                <select value={objective} onChange={e => setObjective(e.target.value)}
                        style={{ ...UI.select, flex: 2 }}>
                  <option value="">None</option>
                  {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={objectiveOutcome} onChange={e => setObjectiveOutcome(e.target.value)}
                        style={{ ...UI.select, flex: 1, marginLeft: 6 }}>
                  {OBJECTIVE_OUTCOMES.map(o => <option key={o} value={o}>{o || 'No status'}</option>)}
                </select>
              </div>
            </div>
            <div style={UI.block}>
              <span style={UI.label}>Purchase value</span>
              <div style={{ display: 'flex' }}>
                <input value={purchaseValue} onChange={e => setPurchaseValue(e.target.value)}
                       placeholder="£49.4m" style={{ ...UI.input, flex: 2 }} />
                <input value={purchaseRank} onChange={e => setPurchaseRank(e.target.value.replace(/\D/g, ''))}
                       placeholder="rank" style={{ ...UI.input, flex: 1, marginLeft: 6 }} />
              </div>
              <div style={UI.note}>Typed — squad spend isn't in the dataset. Age is automatic.</div>
            </div>

            <div onClick={() => setRawOverall(v => !v)}
                 style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                            border: `1px solid ${rawOverall ? '#3b7de8' : '#1e2d45'}`,
                            background: rawOverall ? '#3b7de8' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {rawOverall && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
                Raw overall (not league weighted)
              </span>
            </div>
          </Section>

          <Section title={`XI & depth · ${formation}`} open={openSection === 'xi'} onToggle={() => toggleSection('xi')}>
            <div style={UI.block}>
              <span style={UI.label}>Formation</span>
              <select value={formation} onChange={e => { setFormation(e.target.value); setXiOverrides({}); }}
                      style={UI.select}>
                {FORMATION_NAMES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <div style={UI.note}>Changing formation clears manual XI picks.</div>
            </div>
            <div style={UI.block}>
              <span style={UI.label}>Depth shown (50+ mins only)</span>
              <div style={{ display: 'flex' }}>
                {[0, 1, 2, 3].map((n, i) => (
                  <button key={n} onClick={() => setDepthCount(n)}
                    style={{ flex: 1, padding: '5px 0', marginLeft: i ? 6 : 0, borderRadius: 5,
                             border: `1px solid ${depthCount === n ? '#3b7de8' : '#1e2d45'}`,
                             background: depthCount === n ? '#0e2040' : 'transparent',
                             color: depthCount === n ? '#60a5fa' : '#94a3b8',
                             fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={UI.block}>
              <span style={UI.label}>Manual XI</span>
              <div onClick={() => setXiSearchAll(v => !v)}
                   style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                              border: `1px solid ${xiSearchAll ? '#3b7de8' : '#1e2d45'}`,
                              background: xiSearchAll ? '#3b7de8' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {xiSearchAll && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
                  Include players from other clubs
                </span>
              </div>
              <XiSlotEditor xi={xi} pool={xiPool} lists={xiLists}
                            setLists={setXiLists} teamName={team.team} />
              <div style={UI.note}>
                ▲▼ reorders, × removes. Removing everyone leaves the position blank.
              </div>
              {!!Object.keys(xiLists).length && (
                <button onClick={() => setXiLists({})}
                  style={{ marginTop: 7, background: 'transparent', border: '1px solid #1e2d45',
                           borderRadius: 5, color: '#94a3b8', fontSize: 10.5, padding: '4px 9px',
                           cursor: 'pointer' }}>Reset all to auto</button>
              )}
            </div>
          </Section>

          <Section title="Weaknesses tabs" open={openSection === 'weak'} onToggle={() => toggleSection('weak')}>
            <div style={UI.block}>
              <span style={UI.label}>Depth {depthSel === null && <span style={{ color: '#475569' }}>(auto)</span>}</span>
              <Chips options={slotLabels} selected={depthSel === null ? autoDepth : depthSel}
                     onToggle={(k) => setDepthSel(cur => {
                       const base = cur === null ? autoDepth : cur;
                       return base.includes(k) ? base.filter(x => x !== k) : [...base, k];
                     })} />
              {depthSel !== null && (
                <button onClick={() => setDepthSel(null)}
                  style={{ background: 'transparent', border: '1px solid #1e2d45', borderRadius: 5,
                           color: '#94a3b8', fontSize: 10.5, padding: '4px 9px', cursor: 'pointer' }}>
                  Back to auto
                </button>
              )}
            </div>
            <div style={UI.block}>
              <span style={UI.label}>Also flag (max 4)</span>
              {EXTRA_AREAS.map(name => {
                const sev = extraAreas[name];
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <div onClick={() => setExtraAreas(m => {
                           const n = { ...m };
                           if (n[name]) delete n[name]; else n[name] = 'medium';
                           return n;
                         })}
                         style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1 }}>
                      <div style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                                    border: `1px solid ${sev ? '#3b7de8' : '#1e2d45'}`,
                                    background: sev ? '#3b7de8' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sev && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 11, color: sev ? '#e2e8f4' : '#94a3b8', marginLeft: 8 }}>{name}</span>
                    </div>
                    {sev && (
                      <div style={{ display: 'flex' }}>
                        {[['low', '#fbc701'], ['medium', '#f59e0b'], ['high', '#ef4444']].map(([lvl, col]) => (
                          <button key={lvl} title={lvl}
                            onClick={() => setExtraAreas(m => ({ ...m, [name]: lvl }))}
                            style={{ width: 18, height: 18, marginLeft: 4, borderRadius: 4, padding: 0,
                                     cursor: 'pointer', background: sev === lvl ? col : 'transparent',
                                     border: `1px solid ${sev === lvl ? col : '#1e2d45'}` }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={UI.block}>
              <span style={UI.label}>XI Upgrade {upgradeSel === null && <span style={{ color: '#475569' }}>(auto)</span>}</span>
              <Chips options={slotLabels} selected={upgradeSel === null ? autoUpgrade : upgradeSel}
                     onToggle={(k) => setUpgradeSel(cur => {
                       const base = cur === null ? autoUpgrade : cur;
                       return base.includes(k) ? base.filter(x => x !== k) : [...base, k];
                     })} />
              {upgradeSel !== null && (
                <button onClick={() => setUpgradeSel(null)}
                  style={{ background: 'transparent', border: '1px solid #1e2d45', borderRadius: 5,
                           color: '#94a3b8', fontSize: 10.5, padding: '4px 9px', cursor: 'pointer' }}>
                  Back to auto
                </button>
              )}
            </div>
          </Section>

          <Section title="Bottom panels" open={openSection === 'key'} onToggle={() => toggleSection('key')}>
            <div style={UI.block}>
              <span style={UI.label}>Mode</span>
              <select value={keyMode} onChange={e => setKeyMode(e.target.value)} style={UI.select}>
                <option value="auto">Top 3 by score</option>
                <option value="manual">Pick manually</option>
              </select>
            </div>
            {keyMode === 'manual' && (
              <div style={UI.block}>
                <span style={UI.label}>Pick up to 3 from the squad</span>
                <PlayerPicker pool={squad} picked={manualPicked} max={3}
                  placeholder="Search squad…"
                  onPick={p => setManualKeys(k => [...k, playerKey(p)])}
                  onRemove={p => setManualKeys(k => k.filter(x => x !== playerKey(p)))} />
              </div>
            )}
            {shown.includes('Recruitment Recommendations') && (
              <div style={UI.block}>
                <span style={UI.label}>Recruitment — up to 3 from all players</span>
                <PlayerPicker pool={players} picked={recruitPicked} max={3}
                  placeholder="Search all players…"
                  onPick={p => setRecruitKeys(k => [...k, playerKey(p)])}
                  onRemove={p => setRecruitKeys(k => k.filter(x => x !== playerKey(p)))} />
                <div style={UI.note}>{players.length.toLocaleString()} players searchable.</div>
              </div>
            )}
            {shown.includes('Possible Departures') && (
              <div style={{ ...UI.block, marginTop: 4 }}>
                <span style={UI.label}>
                  Departures {departureKeys === null && <span style={{ color: '#475569' }}>(auto — shortest contracts)</span>}
                </span>
                <PlayerPicker pool={squad} picked={departurePicked} max={3}
                  placeholder="Search squad…"
                  onPick={p => setDepartureKeys(k => [...(k === null ? autoDepartures.map(playerKey) : k), playerKey(p)])}
                  onRemove={p => setDepartureKeys(k => (k === null ? autoDepartures.map(playerKey) : k)
                    .filter(x => x !== playerKey(p)))} />
                {departureKeys !== null && (
                  <button onClick={() => setDepartureKeys(null)}
                    style={{ marginTop: 5, background: 'transparent', border: '1px solid #1e2d45',
                             borderRadius: 5, color: '#94a3b8', fontSize: 10.5, padding: '4px 9px',
                             cursor: 'pointer' }}>Back to auto</button>
                )}
              </div>
            )}
          </Section>

          <Section title="Manager" open={openSection === 'coach'} onToggle={() => toggleSection('coach')}>
            <select value={coachId} onChange={e => setCoachId(e.target.value)} style={UI.select}>
              <option value="auto">{autoCoach ? `Auto — ${autoCoach.name}` : 'Auto — none matched'}</option>
              <option value="none">Hide manager</option>
              {savedCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!savedCoaches.length && <div style={UI.note}>No saved coaches on this domain.</div>}
            {coach && coachScore != null && (
              <div style={UI.note}>Manager score {Math.round(coachScore)}.</div>
            )}
          </Section>
        </div>

        <div style={{ flexShrink: 0, paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', textAlign: 'left', marginBottom: 10 }}>
            {squad.length} in squad · {filled}/11 filled{coach ? ` · ${coach.name}` : ''}
          </div>

          {partialSquadData && (
            <div style={{ ...note, color: '#fbc701', background: 'rgba(251,199,1,0.08)',
                          border: '1px solid rgba(251,199,1,0.25)' }}>
              Only {groupsPresent} position group{groupsPresent === 1 ? '' : 's'} loaded — the XI
              will be incomplete. Switch the position filter to "All" to load every group.
            </div>
          )}
          {unmappedKeys.length > 0 && (
            <div style={{ ...note, color: '#f87171', background: 'rgba(248,113,113,0.08)',
                          border: '1px solid rgba(248,113,113,0.25)', textAlign: 'left' }}>
              Unrecognised position token{unmappedKeys.length === 1 ? '' : 's'}:{' '}
              <b>{unmappedKeys.join(', ')}</b> — these fall through to CM.
            </div>
          )}
          {error && (
            <div style={{ ...note, color: '#f87171', background: 'rgba(248,113,113,0.08)',
                          border: '1px solid rgba(248,113,113,0.25)', textAlign: 'left' }}>
              Download failed: {error}
            </div>
          )}

          <button onClick={handleDownload} disabled={downloading}
            style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                     background: downloading ? '#1e2d45' : '#3b7de8', color: '#fff',
                     fontSize: 13, fontWeight: 700, cursor: downloading ? 'default' : 'pointer' }}>
            {downloading ? (progress || 'Generating…') : '⬇ Download 1920×1080'}
          </button>
          <button onClick={onClose}
            style={{ width: '100%', marginTop: 9, padding: '8px 0', borderRadius: 8,
                     border: '1px solid #1e2d45', background: 'transparent',
                     color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
