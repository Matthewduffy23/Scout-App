// ManagerPager.js v1 — Manager All-in-One report. 1920x1080 PNG export.
//
// The coach equivalent of PlayerPager.js, which is itself the player equivalent
// of TeamReport.js. Geometry is PlayerPager's, verbatim: same 24px pad, same
// 150px header band, same 756 / 538 / 538 column split and the same
// 336 / 284 / 229 row heights. The three exports are meant to sit side by side
// in one pack and read as one system.
//
// WHAT REPLACES WHAT (PlayerPager slot -> ManagerPager slot)
//   player photo         -> coach photo (FotMob id, upload, or fallback)
//   club + league row    -> club + league row, minus height and foot
//   Apps/Gls/Asts/xG/xA  -> Games / GF / GA / Pts / xPts / PPG
//   Overall + Potential  -> Overall + Potential (computeCoachScore)
//   position pitch       -> FORMATION pitch — primary + secondary shape, with an
//                           average position map in the heatmap's place
//   GBE points + pips    -> GBE routes (36m cumulative / 24m consecutive), which
//                           for a manager are pass/fail rather than scored
//   percentile column    -> the same column, off computeCoachMetricGroups
//   6 bottom panels      -> Style / Career,
//                           Team Context / Impact OR Strengths & Weaknesses,
//                           Similar Teams / View OR League Table
//
// NOTHING IS REDRAWN HERE. Every renderer is imported from the card that already
// owns it — CoachQuickCard for the career chart, team context bands and impact
// radar, TeamReport for the wheel, the hex chart, Similar Teams and the League
// Table, PlayerPager for the strengths/weaknesses block and the heat extractor.
// Those declarations gained an `export` keyword and nothing else, so their
// existing callers are untouched and this file cannot drift from the other
// cards: if a bar colour changes in QuickCard it changes here in the same
// commit, because it is literally the same function.
//
// The only things built locally are panel chrome (the rounded box + pink title,
// copied constants so it matches by value), the formation pitch, and the
// percentile column, which is assembled out of imported barRow calls rather than
// drawn from scratch.

import React, { useState, useMemo, useEffect } from 'react';
import {
  MONTSERRAT_EMBED_CSS, leagueDisplayName, leagueLogo, leagueFlag, teamCrest,
} from './cardAssets';
import { useIsMobile, deliverPng } from './utils';
import {
  scoreWheel, headerInk, preloadImages, fitNameSize, styleHexSvg, nameEmWidth,
  similarTeamsPanelHtml, leagueTablePanelHtml, resolveSimilarTeams, leagueWindow,
  setSharedImageMap,
  HEADER_COLOURS, HEADER_COLOUR_NAMES,
} from './TeamReport';
import {
  countryToIso2, fadeHexToBG, computeAge,
  shortSeason, resolveStatsRow, FOTMOB_PHOTO_BASE, COACH_FORMATIONS,
} from './CoachCard';
import {
  computeCoachScore, careerChartSvg, teamContextHtml, impactRadarSvg,
} from './CoachQuickCard';
import { computeCoachMetricGroups } from './coachMetrics';
import { barRow, scoreTierColor } from './QuickCard';
import {
  extractHeat, swBlockHtml, leagueAbbrev, SW_TONES, SW_MANUAL_TERMS, SW_HI, SW_LO,
} from './PlayerPager';

// ─── Canvas geometry — identical to PlayerPager.js / TeamReport.js ─────────
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

const ROW1_H = 336;
const ROW2_H = 284;
const ROW3_H = 229;
const ROW_1 = BODY_TOP;                        // 166
const ROW_2 = ROW_1 + ROW1_H + GAP;            // 522
const ROW_3 = ROW_2 + ROW2_H + GAP;            // 826
const LEFT_H = ROW_3 + ROW3_H - BODY_TOP;      // 889

const NAME_X = 172;
const NAME_MAX_W = 462;
const RULE_1 = 644;
const RULE_2 = 1444;
const WHEEL_X = 650;
const WHEEL_W = 296;
const RULE_MID = 946;
const PITCH_X = 968;
const PITCH_W = 466;
const HDR_LABEL_Y = 114;
const GBE_X = 1464;
const GBE_W = 432;

// ─── Palette — same values as PlayerPager/TeamReport/QuickCard ─────────────
const PHOTO_FALLBACK = '/fallback.png';

const ACCENT_PINK = '#ff66c4';
const BG = '#0a0f1c';
const HEADER_L = 'rgb(23,26,77)';
const HEADER_R = 'rgb(17,22,42)';
const PANEL_BG = 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))';
const PANEL_BORDER = 'rgba(255,255,255,0.13)';
const PANEL_SHADOW = '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)';
const PANEL_RADIUS = 14;
const PANEL_PAD = 20;
const TITLE_H = 34;

// Formation dot tiers — the SAME two greens the position pitch uses for a
// player's primary and secondary slot, so a dot on this card means the same
// thing it means on his. Primary is solid, secondary is a ring: two filled sets
// of eleven dots on a 188px pitch is a smear, an outline reads as "and also".
const FM_PRIMARY = '#00bf63';
const FM_SECONDARY = '#7ed957';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const truncateText = (s, n) => {
  const t = String(s == null ? '' : s);
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Panel chrome. Copied by value from PlayerPager, which copied it from
// TeamReport — `panel` there is private and is a box, not a renderer.
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

function headerGradient(spec) {
  const def = `linear-gradient(to right, ${HEADER_L} 0%, ${HEADER_R} 100%)`;
  if (!spec || !spec.hex) return def;
  try {
    const [a, b] = spec.fade || [0.62, 0.93];
    return `linear-gradient(to right, ${fadeHexToBG(spec.hex, a)} 0%, ${fadeHexToBG(spec.hex, b)} 100%)`;
  } catch (e) { return def; }
}

// Rank within league+season. Same three lines CoachCard and CoachQuickCard each
// carry privately — arithmetic, not a renderer, so a third copy can't drift the
// way a redrawn chart would.
function rankIn(pool, row, field) {
  if (!Array.isArray(pool) || !pool.length || row == null) return null;
  const v = Number(row[field]);
  if (!isFinite(v)) return null;
  const peers = pool.filter(r => String(r.league) === String(row.league)
                             && String(r.season) === String(row.season));
  if (peers.length < 2) return null;
  const greater = peers.filter(r => { const x = Number(r[field]); return isFinite(x) && x > v; }).length;
  return { rank: greater + 1, size: peers.length };
}
const rankStr = (r) => (r ? `${r.rank}<span style="color:#6b7385;font-weight:600;">/${r.size}</span>` : '—');

// ───────────────────────────────────────────────────────────────────────────
// SEASON RESOLUTION
//
// A pager describes ONE tenure season. Everything anchored to it — the stat row,
// the percentile column, Team Context, the league table and the similar-teams
// list — has to come off the SAME row, or the card would describe two clubs at
// once for a coach who moved. Default is the most recent tenure, which is what
// both coach cards already do; the override key is "team|season" because that is
// the key resolveStatsRow already understands.
// ───────────────────────────────────────────────────────────────────────────
function resolveTenure(tenureRows, statsSeasonKey) {
  const sortedDesc = [...(tenureRows || [])].sort((a, b) => (a.season < b.season ? 1 : -1));
  const latest = sortedDesc[0] || {};
  const statsRow = resolveStatsRow(sortedDesc, tenureRows, statsSeasonKey) || {};
  return {
    sortedDesc, latest, statsRow,
    team: statsRow.team || latest.team || '',
    league: statsRow.league || latest.league || '',
    season: statsRow.season || latest.season || '',
  };
}

// ─── GBE (manager) ─────────────────────────────────────────────────────────
// No points. A manager either holds a qualifying route or he doesn't, which is
// why this renders as two tick tiles rather than the player card's pip counters.
// Autopass covers an English league or a home-nation passport, exactly as the
// quick card defines it.
const HOME_NATIONS = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland',
  'Ireland', 'Republic of Ireland']);

function deriveGbe(coach, league, ov = {}) {
  const englandLeague = /^England/i.test(String(league || ''));
  const homeNation = HOME_NATIONS.has(String(coach.nationality || '').trim());
  const autopass = englandLeague || homeNation;
  const c36 = !!ov.c36;
  const c24 = !!ov.c24;
  const pass = autopass || c36 || c24;
  const exceptionsText = String(ov.exceptionsText || '').trim();
  const showPanel = !!ov.exceptions && !pass && !!exceptionsText;
  return {
    autopass, englandLeague, homeNation, c36, c24, pass, showPanel, exceptionsText,
    status: pass ? 'PASS' : 'FAIL',
    colour: pass ? '#3da65b' : showPanel ? '#f0a637' : '#c7363c',
  };
}

// ─── Percentile column (PlayerPager's Performance slot) ────────────────────
// Assembled entirely out of imported barRow calls, so bar geometry, colour ramp
// and the 50% midline tick are the quick card's rather than a copy of them. The
// row-height solve is PlayerPager's, copied by value: total rows and the number
// of sections that actually have data both feed the divisor, and the cap scales
// with row count so a short list spreads instead of bunching at the top.
const MG_KEYS = ['Attack', 'Defence', 'Possession'];
const MG_HEADINGS = { Attack: 'Attacking', Defence: 'Defensive', Possession: 'Possession' };

function percentilePanelBody(w, h, mg) {
  const totalRows = MG_KEYS.reduce((s, k) => s + ((mg[k] || []).length), 0);
  if (!totalRows) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;color:#475569;font-size:13px;">No percentile data for this season.</div>`;
  }
  const activeSections = MG_KEYS.filter(k => (mg[k] || []).length > 0).length;
  const SECTION_H = 42;
  const AXIS_H = 68;
  const budget = h - AXIS_H - activeSections * SECTION_H;
  const maxRowH = totalRows <= 12 ? 62 : totalRows <= 18 ? 46 : 34;
  const rowH = Math.max(8, Math.min(maxRowH, (budget - 2) / totalRows - 1));

  const bars = (k) => (mg[k] || [])
    .map(r => barRow(r.label, r.pct, r.val, Number(rowH.toFixed(2)), 0)).join('');
  const heading = (t) => `<div style="font-size:23px;font-weight:700;color:#f3f5f7;margin:8px 0 6px;">${t}</div>`;

  return `
    <div style="position:absolute;inset:0;overflow:hidden;">
      ${MG_KEYS.map(k => ((mg[k] || []).length ? heading(MG_HEADINGS[k]) + bars(k) : '')).join('')}
      <div style="display:flex;align-items:center;margin-top:6px;">
        <div style="width:188px;flex-shrink:0;"></div>
        <div style="flex:1;position:relative;height:22px;">
          ${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => `
            <span style="position:absolute;left:${p}%;top:0;
                         transform:translateX(${p === 0 ? '0' : p === 100 ? '-100%' : '-50%'});
                         font-size:11.5px;font-weight:600;color:#c4cbd9;">${p}%</span>`).join('')}
          <span style="position:absolute;left:50%;top:14px;transform:translateX(-50%);
                       font-size:9px;font-weight:600;color:#5e6678;text-transform:uppercase;
                       letter-spacing:.05em;">Avg</span>
        </div>
      </div>
      <div style="display:flex;">
        <div style="width:188px;flex-shrink:0;"></div>
        <div style="flex:1;text-align:center;font-size:13.5px;font-weight:700;color:#e8eef8;padding-top:5px;">Percentile Rank</div>
      </div>
    </div>`;
}

// ─── Team Context ──────────────────────────────────────────────────────────
// teamContextHtml emits ~62px per category and this tile has 210, so four
// categories don't fit. Same treatment the player pager gives its own Team
// Context: render at whatever width makes the block fit once scaled uniformly,
// which keeps the bars proportioned exactly as the quick card draws them rather
// than re-cutting the function for one tile.
// Measured off the markup: label row 20 + bar 14 + caption 12 + the flex gap 12.
// Deliberately generous — over-reserving costs a slightly smaller chart,
// under-reserving costs a clipped Low/High caption, and only one looks broken.
const TC_ROW_H = 62;

function teamContextBody(w, h, tc, ageVal, agePct) {
  const cats = ['squadValue', 'wageBill', 'odds'];
  let n = cats.filter(k => {
    const m = tc && tc[k];
    return m && num(m.size) != null && num(m.rank) != null && num(m.size) > 1;
  }).length;
  if (agePct != null || (ageVal && ageVal !== '—')) n += 1;
  if (!n) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;font-size:12px;color:#55617a;">No team context entered.</div>`;
  }
  const scale = Math.min(1, h / (n * TC_ROW_H));
  const renderW = Math.round(w / scale);
  const renderH = Math.round(h / scale);
  return `<div style="position:absolute;inset:0;overflow:hidden;">
      <div style="width:${renderW}px;height:${renderH}px;display:flex;flex-direction:column;
                  transform:scale(${scale.toFixed(4)});transform-origin:top left;">
        ${teamContextHtml(tc || {}, ageVal, agePct)}
      </div>
    </div>`;
}

// ─── Formation pitch ───────────────────────────────────────────────────────
// The player pager's pitch chrome, verbatim — same 320x208 viewBox, same two
// line weights, same clip and shadow, so the two cards draw the same pitch. Only
// what sits ON it changes: eleven formation dots instead of labelled position
// discs, and an average position map instead of a heatmap.
//
// CoachCard's FORMATIONS coordinates live in a 330x220 space with the keeper at
// the left edge. That maps onto this pitch's playing area (x 4..316, y 4..204)
// with no distortion, and the two systems already agree — its keeper at [25,110]
// lands on 27.6, 104 against the position pitch's GK slot at [26,104].
const FM_VB = [320, 208];
const fmX = (x) => 4 + (Number(x) / 330) * 312;
const fmY = (y) => 4 + (Number(y) / 220) * 200;

function formationPitchSvg(primary, secondary, w, h, mapUrl, mapOpacity, showDots) {
  const LINE = 'rgba(255,255,255,0.42)';
  const LINE_SOFT = 'rgba(255,255,255,0.30)';

  const coordsFor = (fm) => (fm && COACH_FORMATIONS[fm]) || null;
  const primaryPts = showDots ? coordsFor(primary) : null;
  const secondaryPts = showDots ? coordsFor(secondary) : null;

  // Secondary FIRST so a shared position doesn't punch a ring through the solid
  // dot that sits on the same spot — the primary shape always reads on top.
  const secondaryDots = (secondaryPts || []).map(([x, y]) => `
      <circle cx="${fmX(x).toFixed(1)}" cy="${fmY(y).toFixed(1)}" r="7.5"
              fill="none" stroke="${FM_SECONDARY}" stroke-width="2.2" opacity="0.85"/>`).join('');
  const primaryDots = (primaryPts || []).map(([x, y]) => `
      <circle cx="${fmX(x).toFixed(1)}" cy="${fmY(y).toFixed(1)}" r="8.5"
              fill="${FM_PRIMARY}" filter="url(#mpShadow)"/>`).join('');

  // The map sits under the markings, clipped to the pitch. An average position
  // map is a chart in its own right rather than a wash, so it defaults far more
  // opaque than a heatmap would — but it still goes underneath, because the
  // pitch is the thing that tells you which way they were playing.
  const mapLayer = mapUrl ? `
      <image href="${mapUrl}" x="4" y="4" width="312" height="200"
             preserveAspectRatio="none" opacity="${mapOpacity}" clip-path="url(#mpClip)"/>` : '';

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${FM_VB[0]} ${FM_VB[1]}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="mpClip"><rect x="4" y="4" width="312" height="200" rx="8"/></clipPath>
        <filter id="mpShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#000" flood-opacity="0.45"/>
        </filter>
        <linearGradient id="mpTurf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.075)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.025)"/>
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="312" height="200" rx="8" fill="url(#mpTurf)"/>
      ${mapLayer}

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

// Same block geometry as the player pager's position block: a 236px text column,
// a 20px gutter and a 188px pitch, nudged 14px left of centre for the same
// reason (the right-hand rule butts onto GBE while the left has the wheels' air).
const FB_PITCH_H = 122;
const FB_PITCH_W = Math.round(FB_PITCH_H * (320 / 208));   // 188
const FB_GAP = 20;
const FB_TEXT_W = 236;

function formationBlockHtml(x, w, ink, primary, secondary, mapUrl, mapOpacity, showDots) {
  const textW = FB_TEXT_W;
  const longest = Math.max(nameEmWidth(primary || '—'), nameEmWidth(secondary || '—'));
  const fs = Math.max(15, Math.min(24, Math.floor(textW / (longest || 1))));
  const groupW = textW + FB_GAP + FB_PITCH_W;
  const left = x + Math.max(0, Math.round((w - groupW) / 2)) - 14;
  return `
    <div style="position:absolute;left:${left}px;top:28px;width:${textW}px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:0.14em;color:${ink.muted};
                  white-space:nowrap;">PRIMARY FORMATION</div>
      <div style="margin-top:9px;display:flex;align-items:center;white-space:nowrap;">
        <span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;
                     background:${FM_PRIMARY};margin-right:9px;"></span>
        <span style="font-size:${fs}px;font-weight:700;color:${ink.primary};
                     line-height:1.05;">${esc(primary || '—')}</span>
      </div>
      <div style="margin-top:14px;font-size:8px;font-weight:700;letter-spacing:0.14em;
                  color:${ink.muted};white-space:nowrap;">SECONDARY FORMATION</div>
      <div style="margin-top:9px;display:flex;align-items:center;white-space:nowrap;">
        ${secondary ? `<span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;
                     border:2px solid ${FM_SECONDARY};box-sizing:border-box;margin-right:9px;"></span>` : ''}
        <span style="font-size:${fs}px;font-weight:700;color:${ink.muted};
                     line-height:1.05;">${secondary ? esc(secondary) : '&mdash;'}</span>
      </div>
    </div>
    <div style="position:absolute;left:${left + textW + FB_GAP}px;top:14px;
                width:${FB_PITCH_W}px;height:${FB_PITCH_H}px;">
      ${formationPitchSvg(primary, secondary, FB_PITCH_W, FB_PITCH_H, mapUrl, mapOpacity, showDots)}
    </div>`;
}

// ─── View ──────────────────────────────────────────────────────────────────
// Copied by value from the player pager: the type is sized to the copy so no
// length overflows, and it picks the LARGEST size that still fits so short copy
// fills the box as completely as long copy does.
function viewPanelBody(w, h, text) {
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
            font-weight:500;color:#e2e8f4;overflow:hidden;">${esc(text)}</div>`;
}

// ─── Impact ────────────────────────────────────────────────────────────────
// The quick card's Team Comparison radar, centred in the tile. It draws at
// height:100% and takes whatever width follows, so it simply scales into a 210px
// slot rather than needing its own cut.
function impactBody(h, rowA, rowB, pool, labelA, labelB, subA, subB) {
  return `<div style="position:absolute;inset:0;display:flex;align-items:center;
            justify-content:center;height:${h}px;">
      ${impactRadarSvg(rowA, rowB, pool, labelA, labelB, subA, subB)}
    </div>`;
}

// ─── Header ────────────────────────────────────────────────────────────────
let IMG = {};
const src = (url) => (url && IMG[url]) || url || '';

export function coachPhotoUrl(coach) {
  const raw = coach && coach.fotmobId ? coach.fotmobId : '';
  const fmId = typeof raw === 'string' && raw.includes('fotmob.com')
    ? (raw.match(/\/(\d+)\.png/) || [])[1] || null
    : (raw || null);
  return fmId ? `${FOTMOB_PHOTO_BASE}${fmId}.png` : (coach && (coach.photoDataUrl || coach.photoUrl)) || '';
}

function headerHtml(coach, ctx, opts) {
  const { statsRow, league, team } = ctx;
  const {
    headerColour, nameOverride, teamOverride, uploadedPhotoDataUrl,
    gbeOv, unattached, contractOverride, tenureOverride,
    showFormation, primaryFormation, secondaryFormation,
    positionMapUrl, mapOpacity, showFormationDots,
    score, potential, overallOverride, potentialOverride,
    overallUnclear, potentialUnclear,
    allTeams,
  } = opts;

  const ink = headerInk(headerColour);
  const displayName = (nameOverride && nameOverride.trim()) || coach.name || '';
  const displayTeam = (teamOverride && teamOverride.trim()) || team;
  const uploadedPhoto = uploadedPhotoDataUrl || (coach.photoDataUrl || '');
  const photo = uploadedPhotoDataUrl || coachPhotoUrl(coach) || PHOTO_FALLBACK;
  const crest = teamCrest(team);
  const logo = leagueLogo(league);
  const flag = leagueFlag(league);
  const LONG_CLUB = String(displayTeam || '').length > 12;
  const natIso = countryToIso2(coach.nationality || '');
  const natFlag = natIso ? `https://flagcdn.com/w80/${natIso}.png` : '';
  const age = computeAge(coach.dob);

  const pool = (allTeams && allTeams.length) ? allTeams : [statsRow];
  const ptsR = rankIn(pool, statsRow, 'points')
    || (statsRow.pointsRank != null && statsRow.leagueSize != null
        ? { rank: statsRow.pointsRank, size: statsRow.leagueSize } : null);
  const xptsR = rankIn(pool, statsRow, 'expectedPoints');
  const ppg = statsRow.points != null && statsRow.matches
    ? (statsRow.points / statsRow.matches).toFixed(2) : '—';

  const cells = [
    ['GAMES', statsRow.matches != null ? String(statsRow.matches) : '—'],
    ['GF', statsRow.goalsFor != null ? String(statsRow.goalsFor) : '—'],
    ['GA', statsRow.goalsAgainst != null ? String(statsRow.goalsAgainst) : '—'],
    ['PTS', rankStr(ptsR)],
    ['xPTS', rankStr(xptsR)],
    ['PPG', ppg],
  ];

  const gbe = deriveGbe(coach, league, gbeOv);
  const contract = (contractOverride && contractOverride.trim()) || coach.contract || '';
  const tenure = (tenureOverride && tenureOverride.trim()) || coach.tenure || '';

  return `
    <div style="position:absolute;top:0;left:0;width:${W}px;height:${HEADER_H}px;
                background:${headerGradient(headerColour)};
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"></div>

    <!-- Coach photo in the crest's box, cover-cropped from the top so a
         head-and-shoulders portrait keeps its chin. ONE layer, chosen up front:
         stacking the fallback under a transparent cut-out prints a grey figure
         through the subject's own shoulders. preloadImages only records URLs it
         actually fetched, so absence from that map IS the 404. -->
    ${(() => {
      const uploaded = !!uploadedPhotoDataUrl || (!!uploadedPhoto && uploadedPhoto.startsWith('data:'));
      const shown = (uploaded || IMG[photo]) ? src(photo) : src(PHOTO_FALLBACK);
      return `<div style="position:absolute;left:12px;top:2px;width:146px;height:146px;
                background-image:url('${shown}');background-size:cover;
                background-position:center top;background-repeat:no-repeat;"></div>`;
    })()}

    <div style="position:absolute;left:${NAME_X}px;top:6px;width:${NAME_MAX_W}px;height:64px;
                display:flex;align-items:flex-end;overflow:hidden;">
      <div style="font-size:${fitNameSize(displayName, NAME_MAX_W)}px;font-weight:700;letter-spacing:-0.8px;
                  line-height:1.18;color:${ink.primary};white-space:nowrap;">${esc(displayName)}</div>
    </div>

    <!-- Club, league and the coach's own details on ONE row. No height and no
         foot — neither means anything for a manager — so contract and tenure
         take the space they used to occupy. -->
    <div style="position:absolute;left:${NAME_X}px;top:78px;display:flex;align-items:center;
                white-space:nowrap;">
      ${unattached ? `
      <span style="font-size:20px;font-weight:700;color:${ink.secondary};">Unattached</span>
      ${displayTeam ? `<span style="font-size:12.5px;font-weight:700;color:${ink.muted};
                   margin-left:10px;">LAST: ${esc(truncateText(displayTeam, 16))}</span>` : ''}`
      : `
      ${crest ? `<div style="width:23px;height:23px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${src(crest)}');"></div>` : ''}
      <span style="font-size:20px;font-weight:700;color:${ink.secondary};${crest ? 'margin-left:9px;' : ''}">${esc(truncateText(displayTeam, 16))}</span>
      ${logo ? `<div style="width:19px;height:19px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${src(logo)}');margin-left:${LONG_CLUB ? 18 : 14}px;"></div>` : ''}
      ${flag ? `<div style="width:22px;height:14px;flex-shrink:0;background-size:cover;
                  background-position:center;border-radius:2px;margin-left:12px;
                  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);
                  background-image:url('${src(flag)}');"></div>` : ''}
      <span style="font-size:12.5px;font-weight:700;letter-spacing:0.08em;
                   color:${ink.muted};margin-left:12px;">${esc(leagueAbbrev(league))}</span>`}

      <span style="width:1px;height:16px;background:${ink.rule};margin:0 6px 0 7px;flex-shrink:0;"></span>

      ${natFlag ? `<div style="width:21px;height:13px;flex-shrink:0;background-size:cover;
                  background-position:center;border-radius:2px;margin-right:8px;
                  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);
                  background-image:url('${src(natFlag)}');"></div>` : ''}
      ${[age != null ? `${age} y.o.` : null,
         contract ? `Contract ${contract}` : null,
         tenure || null,
        ].filter(Boolean).map((v, i) => `
        ${i ? `<span style="color:${ink.muted};margin:0 8px;font-size:11px;">&middot;</span>` : ''}
        <span style="font-size:12.5px;font-weight:700;color:${ink.soft};">${esc(v)}</span>`).join('')}
    </div>

    <!-- Games / GF / GA / Pts / xPts / PPG -->
    <div style="position:absolute;left:${NAME_X}px;top:113px;display:flex;align-items:baseline;
                white-space:nowrap;">
      ${cells.map(([lab, val], i) => `
        <span style="${i ? 'margin-left:18px;' : ''}font-size:15px;font-weight:700;
                     color:${ink.secondary};">${val}</span>
        <span style="margin-left:5px;font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:${ink.muted};">${lab}</span>`).join('')}
    </div>

    ${[RULE_1, RULE_2].map(x =>
      `<div style="position:absolute;left:${x}px;top:28px;width:1px;height:100px;
                   background:${ink.rule};"></div>`).join('')}

    <!-- Overall + Potential, both drawn big. A manager's ceiling is not a
         subordinate stat to his current level. -->
    ${(() => {
      const n = (v, fb) => (v === '' || v == null || isNaN(Number(v)) ? fb : Number(v));
      const all = [
        ['OVERALL', n(overallOverride, score), 37, !!overallUnclear],
        ['POTENTIAL', n(potentialOverride, potential), 33, !!potentialUnclear],
      ];
      const step = WHEEL_W / all.length;
      return all.map(([label, v, r, unclear], i) => {
        const cx = WHEEL_X + step * i + step / 2;
        if (unclear || v == null) {
          const size = r * 2 + 8 + 2;
          return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
           style="position:absolute;left:${cx - size / 2}px;top:${64 - size / 2}px;">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
                stroke="${ink.track}" stroke-width="8"/>
        <text x="${size / 2}" y="${size / 2 + 9}" text-anchor="middle"
              font-family="Montserrat,sans-serif" font-size="26"
              font-weight="700" fill="${ink.muted}">?</text>
      </svg>
      <div style="position:absolute;left:${cx - 60}px;top:${HDR_LABEL_Y}px;width:120px;
                  text-align:center;font-size:8px;font-weight:700;letter-spacing:0.15em;
                  color:${ink.muted};">${label}</div>`;
        }
        return scoreWheel({
          cx, cy: 64, r, stroke: 8,
          value: v, label, colour: scoreTierColor(v), ink, big: true, labelY: HDR_LABEL_Y,
        });
      }).join('');
    })()}

    <div style="position:absolute;left:${RULE_MID}px;top:28px;width:1px;height:100px;
                background:${ink.rule};"></div>

    <!-- Formation, in the position pitch's slot: shape named in words, drawn
         beside it. -->
    ${showFormation ? formationBlockHtml(PITCH_X, PITCH_W, ink, primaryFormation,
        secondaryFormation, positionMapUrl, mapOpacity, showFormationDots) : `
    <div style="position:absolute;left:${PITCH_X}px;top:34px;width:${PITCH_W}px;">
      ${[['FORMATION', primaryFormation || '—'],
         ['ALTERNATIVE', secondaryFormation || '—'],
         ['CONTRACT', contract || '—'],
         ['TENURE', tenure || '—'],
        ].map(([k, v], i) => `
        <div style="position:absolute;left:0;top:${i * 22}px;font-size:8px;font-weight:700;
                    letter-spacing:0.13em;color:${ink.muted};">${k}</div>
        <div style="position:absolute;left:110px;top:${i * 22 - 3}px;font-size:13px;font-weight:700;
                    color:${ink.secondary};white-space:nowrap;">${esc(truncateText(v, 24))}</div>`).join('')}
    </div>`}

    <!-- GBE in the same slot the player pager gives it, but a manager's GBE has
         no points: the two routes are held or they aren't, so the pip counters
         become tick tiles. The third tile carries whatever else decides it —
         the autopass reason, or the Exceptions Panel note. -->
    <div style="position:absolute;left:${GBE_X}px;top:14px;width:${GBE_W}px;height:20px;
                display:flex;align-items:center;white-space:nowrap;overflow:hidden;">
      <span style="flex-shrink:0;font-size:8px;font-weight:700;letter-spacing:0.14em;
                   color:${ink.muted};">GBE CALCULATION</span>
      <span style="flex:1;min-width:0;overflow:hidden;text-align:right;padding:0 10px;">
        ${gbe.autopass ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:${ink.muted};">AUTO PASS</span>` : ''}
        ${gbe.showPanel ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:#f0c56a;">EXCEPTIONS PANEL</span>` : ''}
      </span>
      <span style="flex-shrink:0;display:flex;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:${gbe.colour};
                     background:${gbe.colour}22;border:1px solid ${gbe.colour};border-radius:5px;
                     padding:4px 13px;">${gbe.status}</span>
      </span>
    </div>
    ${(() => {
      const TW = 210, TGX = 12, TH = 38;
      const tick = (on) => `
        <span style="width:15px;height:15px;border-radius:50%;flex-shrink:0;margin-right:9px;
                     background:${on ? '#3da65b' : 'transparent'};
                     border:1.5px solid ${on ? '#3da65b' : ink.rule};
                     display:flex;align-items:center;justify-content:center;">
          ${on ? `<span style="color:#07090f;font-size:9px;font-weight:900;line-height:1;">&#10003;</span>` : ''}
        </span>`;
      const routes = [['36 MONTHS CUMULATIVE', gbe.c36], ['24 MONTHS CONSECUTIVE', gbe.c24]];
      const tiles = routes.map(([label, on], i) => `
        <div style="position:absolute;left:${GBE_X + i * (TW + TGX)}px;top:44px;
                    width:${TW}px;height:${TH}px;box-sizing:border-box;padding:7px 11px;
                    border-radius:7px;
                    border:1px solid ${on ? 'rgba(61,166,91,0.42)' : ink.rule};
                    background:${on ? 'rgba(61,166,91,0.09)' : 'rgba(255,255,255,0.05)'};
                    display:flex;align-items:center;">
          ${tick(on)}
          <span style="display:flex;flex-direction:column;line-height:1.25;min-width:0;">
            <span style="font-size:7.5px;font-weight:700;letter-spacing:0.13em;
                         color:${on ? ink.primary : ink.muted};white-space:nowrap;">${label}</span>
            <span style="font-size:7px;font-weight:700;letter-spacing:0.1em;
                         color:${ink.muted};white-space:nowrap;">BAND 1-5 LEAGUE</span>
          </span>
        </div>`).join('');

      const noteTone = gbe.autopass ? '#3da65b' : gbe.showPanel ? '#f0a637' : ink.muted;
      const noteText = gbe.autopass
        ? `&#10003; AUTO PASS &mdash; ${gbe.englandLeague ? 'ENGLISH LEAGUE' : 'HOME NATION'}`
        : gbe.showPanel
          ? `&#9889; EXCEPTIONS PANEL &mdash; ${esc(gbe.exceptionsText).toUpperCase()}`
          : gbe.pass ? 'QUALIFYING ROUTE HELD' : 'NO QUALIFYING ROUTE';
      const note = `
        <div style="position:absolute;left:${GBE_X}px;top:90px;width:${GBE_W}px;height:38px;
                    box-sizing:border-box;padding:0 11px;border-radius:7px;
                    border:1px solid ${gbe.autopass ? 'rgba(61,166,91,0.32)'
                                        : gbe.showPanel ? 'rgba(240,166,55,0.32)' : ink.rule};
                    background:${gbe.autopass ? 'rgba(61,166,91,0.08)'
                                 : gbe.showPanel ? 'rgba(240,166,55,0.08)' : 'rgba(255,255,255,0.04)'};
                    display:flex;align-items:center;overflow:hidden;">
          <span style="font-size:8.5px;font-weight:700;letter-spacing:0.11em;color:${noteTone};
                       white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${noteText}</span>
        </div>`;
      return tiles + note;
    })()}`;
}

// ─── Image preload ─────────────────────────────────────────────────────────
// Same treatment TeamReport and PlayerPager give theirs, for the same reason:
// html-to-image refetches every remote image on each of the two render passes,
// and a cold FotMob or GitHub fetch is slower than the render itself.
export function managerPagerImageUrls(coach, ctx, uploadedPhotoDataUrl, allTeams = [], similarRows = []) {
  const urls = [
    uploadedPhotoDataUrl ? '' : coachPhotoUrl(coach),
    leagueLogo(ctx.league),
    leagueFlag(ctx.league),
    teamCrest(ctx.team),
    PHOTO_FALLBACK,
  ];
  const iso = countryToIso2(coach.nationality || '');
  if (iso) urls.push(`https://flagcdn.com/w80/${iso}.png`);

  // Similar Teams crests and every crest in the league-table window. Without
  // these they'd be the only remote references left in the render and would
  // blank out in the export.
  for (const t of (similarRows && similarRows.length
    ? similarRows : resolveSimilarTeams(ctx.statsRow || {}, allTeams, 3))) {
    if (t && t.team) urls.push(teamCrest(t.team));
  }
  try {
    const lw = leagueWindow(ctx.statsRow || {}, allTeams, 5);
    for (const t of lw.rows) urls.push(teamCrest(t.team));
    if (lw.pinnedTop) urls.push(teamCrest(lw.pinnedTop.team));
  } catch (e) { /* no table data for this league — nothing to preload */ }

  return [...new Set(urls.filter(u => u && !u.startsWith('data:')))];
}

// ───────────────────────────────────────────────────────────────────────────
export function buildManagerPagerElement(coach, tenureRows, traits, opts = {}) {
  const {
    images = {}, allTeams = [], seasonPerf = {},
    headerColour = HEADER_COLOURS.Default,
    statsSeasonKey = '', nameOverride = '', teamOverride = '',
    uploadedPhotoDataUrl = '', viewText = '',
    contractOverride = '', tenureOverride = '', unattached = false,
    primaryFormation = '', secondaryFormation = '',
    showFormation = true, showFormationDots = true,
    positionMapUrl = '', mapOpacity = 0.75,
    careerMode = 'score', finishOverrides = {}, extraFinish = [],
    teamContext = {},
    rightMid = 'impact',          // impact | sw
    rightLow = 'view',            // view | table
    impactRowA = null, impactRowB = null,
    similarRows = null,
    styleKeys = null,
    overallOverride = '', potentialOverride = '',
    overallUnclear = false, potentialUnclear = false,
    gbeOv = {},
    swDrop = [], swAddStr = [], swAddWeak = [],
  } = opts;

  IMG = images || {};
  // Similar Teams and the League Table are TeamReport's own renderers, and they
  // resolve crests through TeamReport's image map rather than this file's. Point
  // it at the same preloaded set or those two panels would be the only things on
  // the card still holding remote references.
  try { setSharedImageMap(images || {}); } catch (e) { /* older TeamReport build */ }

  const ctx = resolveTenure(tenureRows, statsSeasonKey);
  const { statsRow, latest, sortedDesc } = ctx;
  const age = computeAge(coach.dob);
  const pool = (allTeams && allTeams.length) ? allTeams : tenureRows;

  const { score, potential, perSeason } = computeCoachScore(tenureRows, age, { seasonPerf });

  // Style hexes. Traits are 0-100 already; a saved override is 1-10, so it is
  // scaled the same way both coach cards scale it.
  const getTrait = (key) => (coach.traitOverrides && coach.traitOverrides[key] != null
    ? coach.traitOverrides[key] * 10
    : (traits ? traits[key] : null));
  const TRAIT_LABELS = {
    possession: 'Possession', pressing: 'Pressing', passing: 'Passing',
    adaptability: 'Adaptability', youthDevelopment: 'Youth Development',
    attacking: 'Attacking', setPieces: 'Set Pieces', defensive: 'Defensive',
    directness: 'Long Ball',
  };
  const wantedTraits = (styleKeys && styleKeys.length)
    ? styleKeys
    : ['possession', 'pressing', 'attacking', 'defensive', 'directness', 'passing', 'setPieces'];
  // Seven, not six — styleHexSvg flexes its row height between 30 and 40px, so a
  // seventh row costs nothing and fills a tile that would otherwise end short.
  const styleRows = wantedTraits
    .map(k => [TRAIT_LABELS[k] || k, getTrait(k)])
    .map(([l, v]) => [l, v == null ? 0 : Number(v)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  // Career points, oldest -> newest. Each scored season is matched back to its
  // tenure row so league finish can be ranked against that division's peers.
  const careerPts = [...perSeason].reverse().map(s => {
    const row = (tenureRows || []).find(r => String(r.season) === String(s.season)) || null;
    const auto = row
      ? (rankIn(pool, row, 'points')
         || (row.pointsRank != null && row.leagueSize != null
             ? { rank: row.pointsRank, size: row.leagueSize } : null))
      : null;
    const ov = finishOverrides[String(s.season)];
    const manual = ov && ov.rank && ov.size ? { rank: Number(ov.rank), size: Number(ov.size) } : null;
    return { season: s.season, sc: s.sc, finish: manual || auto };
  });
  // Seasons the data doesn't cover carry no score, so they only join the series
  // in finish mode — appending them in score mode would plot a null.
  if (careerMode === 'finish' && Array.isArray(extraFinish)) {
    for (const e of extraFinish) {
      if (!e || !e.season || !e.rank || !e.size) continue;
      if (careerPts.some(p => String(p.season) === String(e.season))) continue;
      careerPts.push({ season: e.season, sc: null, finish: { rank: Number(e.rank), size: Number(e.size) } });
    }
    careerPts.sort((a, b) => (String(a.season) < String(b.season) ? -1 : 1));
  }

  const mg = computeCoachMetricGroups([statsRow]) || { Attack: [], Defence: [], Possession: [] };

  // Average age percentile against the SAME league+season the rest of the card
  // describes — older squads score higher, which is what the Young/Old caption
  // on that row says.
  const av = num(statsRow.avgAge);
  let ageVal = '—', agePct = null;
  if (av != null) {
    ageVal = av.toFixed(1);
    const agePool = (pool || []).filter(r => String(r.league) === String(statsRow.league)
                                          && String(r.season) === String(statsRow.season));
    const vals = agePool.map(r => num(r.avgAge)).filter(x => x != null);
    if (vals.length > 1) agePct = clamp((vals.filter(x => x <= av).length / vals.length) * 100);
  } else if (teamContext && teamContext.age != null && teamContext.age !== '') {
    ageVal = String(teamContext.age);
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${W}px`;
  container.style.height = `${H}px`;

  const innerW = COL_W - PANEL_PAD * 2;                   // 498
  const row1InnerH = ROW1_H - PANEL_PAD * 2 - TITLE_H;    // 262
  const row2InnerH = ROW2_H - PANEL_PAD * 2 - TITLE_H;    // 210
  const row3InnerH = ROW3_H - PANEL_PAD * 2 - TITLE_H;    // 155
  const leftInnerW = LEFT_W - PANEL_PAD * 2;              // 716
  const leftInnerH = LEFT_H - PANEL_PAD * 2 - TITLE_H;    // 815

  const styleRowH = Math.max(30, Math.min(40, Math.floor((row1InnerH - 6) / (styleRows.length || 1))));
  const styleHtml = styleRows.length
    ? `<div style="position:absolute;left:0;top:${
         Math.max(0, Math.round((row1InnerH - (styleRows.length * styleRowH + 6)) / 2))
       }px;">${styleHexSvg(styleRows, innerW, row1InnerH, 176)}</div>`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;
                   justify-content:center;font-size:12px;color:#55617a;">No trait scores.</div>`;

  // Strengths & weaknesses off the SAME percentile rows the Performance column
  // draws, so a trait called a strength here is visibly a long bar there.
  const swRows = MG_KEYS
    .flatMap(k => (mg[k] || []))
    .map(r => ({ label: r.label, pct: Number(r.pct) }))
    .filter(r => !isNaN(r.pct));

  const rowA = impactRowA || sortedDesc[sortedDesc.length - 1] || null;
  const rowB = impactRowB || sortedDesc[0] || null;

  container.innerHTML = `
    <div id="mp-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(coach, ctx, {
        headerColour, nameOverride, teamOverride, uploadedPhotoDataUrl,
        gbeOv, unattached, contractOverride, tenureOverride,
        showFormation, primaryFormation, secondaryFormation,
        positionMapUrl, mapOpacity, showFormationDots,
        score, potential, overallOverride, potentialOverride,
        overallUnclear, potentialUnclear, allTeams: pool,
      })}

      ${panel({
        x: PAD, y: BODY_TOP, w: LEFT_W, h: LEFT_H,
        title: 'Performance',
        // Season, club, league and the pool the percentiles run against. Without
        // the last two a reader can't tell whether 80th percentile means 80th of
        // League Two or of the Championship, which is the whole meaning of the
        // column.
        right: [shortSeason(ctx.season), ctx.team, leagueDisplayName(ctx.league) || ctx.league]
                 .filter(Boolean).join(' · '),
        body: percentilePanelBody(leftInnerW, leftInnerH, mg),
      })}

      ${panel({
        x: COL_A_X, y: ROW_1, w: COL_W, h: ROW1_H, title: 'Style',
        body: styleHtml,
      })}
      ${panel({
        x: COL_B_X, y: ROW_1, w: COL_W, h: ROW1_H, title: 'Career',
        right: careerMode === 'finish' ? 'LEAGUE FINISH' : '',
        body: `<div style="position:absolute;left:0;top:0;">${
          careerChartSvg(careerPts, innerW, row1InnerH, careerMode)
        }</div>`,
      })}

      ${panel({
        x: COL_A_X, y: ROW_2, w: COL_W, h: ROW2_H, title: 'Team Context',
        body: teamContextBody(innerW, row2InnerH, teamContext, ageVal, agePct),
      })}
      ${panel({
        x: COL_B_X, y: ROW_2, w: COL_W, h: ROW2_H,
        title: rightMid === 'sw' ? 'Strengths &amp; Weaknesses' : 'Impact',
        body: rightMid === 'sw'
          ? swBlockHtml(innerW, row2InnerH, swRows, { swDrop, swAddStr, swAddWeak })
          : impactBody(row2InnerH, rowA, rowB, pool,
              rowA ? String(rowA.team || '') : '', rowB ? String(rowB.team || '') : '',
              rowA ? String(rowA.league || '') : '', rowB ? String(rowB.league || '') : ''),
      })}

      ${panel({
        x: COL_A_X, y: ROW_3, w: COL_W, h: ROW3_H, title: 'Similar Teams',
        right: ctx.team ? esc(truncateText(ctx.team, 18)).toUpperCase() : '',
        body: similarTeamsPanelHtml(innerW, row3InnerH, statsRow, allTeams, similarRows),
      })}
      ${panel({
        x: COL_B_X, y: ROW_3, w: COL_W, h: ROW3_H,
        title: rightLow === 'table' ? 'League Table' : 'View',
        right: rightLow === 'table'
          ? [leagueDisplayName(ctx.league) || ctx.league, shortSeason(ctx.season)].filter(Boolean).join(' · ')
          : '',
        body: rightLow === 'table'
          ? leagueTablePanelHtml(innerW, row3InnerH, statsRow, allTeams)
          : viewPanelBody(innerW, row3InnerH, viewText),
      })}
    </div>`;

  document.body.appendChild(container);
  return container;
}

// ─── Modal ─────────────────────────────────────────────────────────────────
const UI = {
  label: {
    fontSize: 10, color: '#94a3b8', textTransform: 'uppercase',
    letterSpacing: '.06em', display: 'block', marginBottom: 5, textAlign: 'left',
  },
  input: {
    width: '100%', background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 5,
    color: '#e2e8f4', padding: '7px 9px', fontSize: 11.5, boxSizing: 'border-box',
    fontFamily: 'inherit', outline: 'none',
  },
  block: { textAlign: 'left', marginBottom: 12 },
  note: { fontSize: 10.5, color: '#64748b', marginTop: 5, textAlign: 'left' },
};

function Check({ label, value, onChange }) {
  return (
    <div onClick={() => onChange(!value)}
         style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 8 }}>
      <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    border: `1px solid ${value ? '#3b7de8' : '#1e2d45'}`,
                    background: value ? '#3b7de8' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {value && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
      </div>
      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8, textAlign: 'left' }}>{label}</span>
    </div>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
      {options.map(([v, lbl]) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ flex: 1, padding: '6px 0', borderRadius: 5,
                   border: `1px solid ${value === v ? '#3b7de8' : '#1e2d45'}`,
                   background: value === v ? '#0e2040' : 'transparent',
                   color: value === v ? '#60a5fa' : '#94a3b8',
                   fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
      ))}
    </div>
  );
}

const FORMATION_NAMES = Object.keys(COACH_FORMATIONS);
const TRAIT_KEYS = ['possession', 'pressing', 'passing', 'adaptability', 'youthDevelopment',
                    'attacking', 'setPieces', 'defensive', 'directness'];
const TRAIT_CHIP_LABELS = {
  possession: 'Possession', pressing: 'Pressing', passing: 'Passing',
  adaptability: 'Adaptability', youthDevelopment: 'Youth Dev',
  attacking: 'Attacking', setPieces: 'Set Pieces', defensive: 'Defensive',
  directness: 'Long Ball',
};
const VIEW_MAX_LENGTH = 440;

export default function ManagerPagerModal({
  coach, tenureRows = [], traits = {}, allTeams = [], seasonPerf = {}, onClose,
}) {
  const isMobile = useIsMobile();

  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // A saved club colour is the honest default for a coach card — it is the club
  // he is actually at. The named palette stays available beside it.
  const COLOURS = useMemo(() => (coach.clubColor
    ? { Club: { hex: coach.clubColor, fade: [0.62, 0.93] }, ...HEADER_COLOURS }
    : HEADER_COLOURS), [coach.clubColor]);
  const COLOUR_NAMES = useMemo(
    () => (coach.clubColor ? ['Club', ...HEADER_COLOUR_NAMES] : HEADER_COLOUR_NAMES),
    [coach.clubColor]);
  const [headerColourName, setHeaderColourName] = useState(coach.clubColor ? 'Club' : 'Default');

  const [statsSeasonKey, setStatsSeasonKey] = useState('');
  const [nameOverride, setNameOverride] = useState('');
  const [teamOverride, setTeamOverride] = useState('');
  const [contractOverride, setContractOverride] = useState('');
  const [tenureOverride, setTenureOverride] = useState('');
  const [unattached, setUnattached] = useState(false);
  const [uploadedPhotoDataUrl, setUploadedPhotoDataUrl] = useState('');
  const [viewText, setViewText] = useState('');

  const savedFormations = Array.isArray(coach.formations) && coach.formations.length
    ? coach.formations : (coach.formation ? [coach.formation] : []);
  const [primaryFormation, setPrimaryFormation] = useState(savedFormations[0] || '4-3-3');
  const [secondaryFormation, setSecondaryFormation] = useState(savedFormations[1] || '');
  const [showFormation, setShowFormation] = useState(true);
  const [showFormationDots, setShowFormationDots] = useState(true);
  const [mapRaw, setMapRaw] = useState('');
  const [positionMapUrl, setPositionMapUrl] = useState('');
  const [mapExtract, setMapExtract] = useState(false);
  const [mapOpacity, setMapOpacity] = useState(75);

  const [careerMode, setCareerMode] = useState('score');
  const [rightMid, setRightMid] = useState('impact');
  const [rightLow, setRightLow] = useState('view');

  const [overallOverride, setOverallOverride] = useState('');
  const [potentialOverride, setPotentialOverride] = useState('');
  const [overallUnclear, setOverallUnclear] = useState(false);
  const [potentialUnclear, setPotentialUnclear] = useState(false);

  const [styleKeys, setStyleKeys] = useState(
    ['possession', 'pressing', 'attacking', 'defensive', 'directness', 'passing', 'setPieces']);

  const [tcRanks, setTcRanks] = useState({ squadValue: '', wageBill: '', odds: '' });
  const [leagueSizeOv, setLeagueSizeOv] = useState('');

  const [impactAKey, setImpactAKey] = useState('');
  const [impactBKey, setImpactBKey] = useState('');

  const [similarPicked, setSimilarPicked] = useState([]);

  const [gbeOv, setGbeOv] = useState({ c36: false, c24: false, exceptions: false, exceptionsText: '' });

  const [swDrop, setSwDrop] = useState([]);
  const [swAddStr, setSwAddStr] = useState([]);
  const [swAddWeak, setSwAddWeak] = useState([]);
  const [swNew, setSwNew] = useState({ label: '', tone: 'Green' });

  const ctx = useMemo(() => resolveTenure(tenureRows, statsSeasonKey), [tenureRows, statsSeasonKey]);
  const pool = useMemo(() => ((allTeams && allTeams.length) ? allTeams : tenureRows), [allTeams, tenureRows]);
  const age = useMemo(() => computeAge(coach.dob), [coach.dob]);
  const scores = useMemo(
    () => computeCoachScore(tenureRows, age, { seasonPerf }),
    [tenureRows, age, seasonPerf]);

  const seasonOptions = useMemo(() => [...(tenureRows || [])]
    .sort((a, b) => (a.season < b.season ? 1 : -1))
    .map(r => ({ key: `${r.team}|${r.season}`, label: `${shortSeason(r.season)} — ${r.team}` })),
    [tenureRows]);

  const mg = useMemo(() => computeCoachMetricGroups([ctx.statsRow])
    || { Attack: [], Defence: [], Possession: [] }, [ctx.statsRow]);
  const swRows = useMemo(() => MG_KEYS
    .flatMap(k => (mg[k] || []))
    .map(r => ({ label: r.label, pct: Number(r.pct) }))
    .filter(r => !isNaN(r.pct)), [mg]);
  const swStrengthLabels = useMemo(
    () => swRows.filter(r => r.pct >= SW_HI).sort((a, b) => b.pct - a.pct).map(r => r.label), [swRows]);
  const swWeakLabels = useMemo(
    () => swRows.filter(r => r.pct <= SW_LO).sort((a, b) => a.pct - b.pct).map(r => r.label), [swRows]);

  const similarChoices = useMemo(() => {
    try { return resolveSimilarTeams(ctx.statsRow || {}, allTeams, 7); }
    catch (e) { return []; }
  }, [ctx.statsRow, allTeams]);
  // A different season is a different club's similarity list, so the manual pick
  // can't survive the switch.
  useEffect(() => { setSimilarPicked([]); }, [statsSeasonKey]);

  const teamContext = useMemo(() => {
    const size = leagueSizeOv !== '' ? Number(leagueSizeOv)
      : (ctx.statsRow && ctx.statsRow.leagueSize != null ? Number(ctx.statsRow.leagueSize) : 20);
    const m = (k) => {
      const r = tcRanks[k];
      if (r === '' || r == null) return undefined;
      return { rank: Number(r), size };
    };
    return { squadValue: m('squadValue'), wageBill: m('wageBill'), odds: m('odds') };
  }, [tcRanks, leagueSizeOv, ctx.statsRow]);

  const rowFor = (key) => (tenureRows || []).find(r => `${r.team}|${r.season}` === key) || null;

  const buildOpts = () => ({
    allTeams, seasonPerf,
    headerColour: COLOURS[headerColourName] || HEADER_COLOURS.Default,
    statsSeasonKey, nameOverride, teamOverride, uploadedPhotoDataUrl, viewText,
    contractOverride, tenureOverride, unattached,
    primaryFormation, secondaryFormation, showFormation, showFormationDots,
    positionMapUrl, mapOpacity: Number(mapOpacity) / 100,
    careerMode, teamContext, rightMid, rightLow,
    impactRowA: rowFor(impactAKey), impactRowB: rowFor(impactBKey),
    similarRows: similarPicked.length ? similarPicked : null,
    styleKeys,
    overallOverride, potentialOverride, overallUnclear, potentialUnclear,
    gbeOv, swDrop, swAddStr, swAddWeak,
  });

  const handleDownload = async () => {
    setDownloading(true); setProgress('Loading images…'); setError('');
    let el = null;
    try {
      const { toPng } = await import('html-to-image');
      const urls = managerPagerImageUrls(coach, ctx, uploadedPhotoDataUrl, allTeams,
        similarPicked.length ? similarPicked : null);
      const images = await preloadImages(urls, (d, t) => setProgress(`Images ${d}/${t}`));
      setProgress('Rendering…');
      el = buildManagerPagerElement(coach, tenureRows, traits, { ...buildOpts(), images });
      const node = el.querySelector('#mp-card-root') || el;
      const opts = {
        width: W, height: H, pixelRatio: 1, backgroundColor: BG,
        cacheBust: false, fontEmbedCSS: MONTSERRAT_EMBED_CSS,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      };
      // Double render: the first pass warms the font and image caches, the
      // second is the one that comes out right. Same pattern as every card here.
      await toPng(node, opts);
      const dataUrl = await toPng(node, opts);
      await deliverPng(dataUrl, `${String(coach.name || 'manager').replace(/\s+/g, '_')}_manager_pager.png`);
    } catch (e) {
      console.error('[ManagerPager] download failed:', e);
      setError(String((e && e.message) || e));
    } finally {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      setDownloading(false); setProgress('');
    }
  };

  const handlePhotoUpload = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setUploadedPhotoDataUrl(String(ev.target.result));
    r.readAsDataURL(f);
    e.target.value = '';
  };

  const gbe = deriveGbe(coach, ctx.league, gbeOv);
  const note = { fontSize: 11.5, borderRadius: 8, padding: '8px 10px', marginBottom: 12, lineHeight: 1.45, textAlign: 'left' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9999,
                  display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'center', padding: isMobile ? 6 : 0 }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#09111e', border: '1px solid #1e2d45', borderRadius: 12,
                    padding: isMobile ? 14 : 22, boxShadow: '0 8px 40px rgba(0,0,0,.7)',
                    width: isMobile ? '100%' : 440, maxWidth: isMobile ? 460 : undefined,
                    boxSizing: isMobile ? 'border-box' : undefined,
                    maxHeight: isMobile ? '97vh' : '88vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ textAlign: 'center', marginBottom: 14, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f4' }}>📄 Manager Pager</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {coach.name} · {ctx.team || '—'}
          </div>
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', flex: 1,
                      paddingRight: 4, marginRight: -4 }}>

          {!tenureRows.length && (
            <div style={{ ...note, color: '#f87171', background: 'rgba(248,113,113,0.08)',
                          border: '1px solid rgba(248,113,113,0.25)' }}>
              No tenure seasons matched the current team data — the card will be empty.
            </div>
          )}

          <div style={UI.block}>
            <span style={UI.label}>Manager name on card</span>
            <input style={UI.input} value={nameOverride}
                   onChange={e => setNameOverride(e.target.value)} placeholder={coach.name} />
          </div>

          {seasonOptions.length > 1 && (
            <div style={UI.block}>
              <span style={UI.label}>Season</span>
              <select style={{ ...UI.input, cursor: 'pointer' }} value={statsSeasonKey}
                      onChange={e => setStatsSeasonKey(e.target.value)}>
                <option value="">Default (most recent)</option>
                {seasonOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <div style={UI.note}>
                Drives the stat row, percentiles, Team Context, Similar Teams and the table.
              </div>
            </div>
          )}

          <div style={UI.block}>
            <span style={UI.label}>Club name on card</span>
            <input style={UI.input} value={teamOverride}
                   onChange={e => setTeamOverride(e.target.value)} placeholder={ctx.team} />
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Contract &amp; tenure</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...UI.input, flex: 1 }} value={contractOverride}
                     onChange={e => setContractOverride(e.target.value)}
                     placeholder={coach.contract || 'Contract'} />
              <input style={{ ...UI.input, flex: 1 }} value={tenureOverride}
                     onChange={e => setTenureOverride(e.target.value)}
                     placeholder={coach.tenure || '2024–Present'} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Check label="Unattached (drops the club identity line)"
                     value={unattached} onChange={setUnattached} />
            </div>
          </div>

          <div style={UI.block}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ ...UI.label, marginBottom: 0 }}>View</span>
              <span style={{ fontSize: 10, color: viewText.length > VIEW_MAX_LENGTH - 25 ? '#f87171' : '#64748b' }}>
                {viewText.length} / {VIEW_MAX_LENGTH}
              </span>
            </div>
            <textarea
              style={{ ...UI.input, minHeight: 76, marginTop: 4, resize: 'vertical', lineHeight: 1.5 }}
              value={viewText} maxLength={VIEW_MAX_LENGTH}
              onChange={e => setViewText(e.target.value.slice(0, VIEW_MAX_LENGTH))}
              placeholder="Your read on the manager…" />
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Bottom-right panels</span>
            <Seg options={[['impact', 'Impact'], ['sw', 'Strengths & Weaknesses']]}
                 value={rightMid} onChange={setRightMid} />
            <Seg options={[['view', 'View'], ['table', 'League Table']]}
                 value={rightLow} onChange={setRightLow} />
            <div style={UI.note}>
              Left column is fixed: Style, Team Context, Similar Teams.
            </div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Header colour</span>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {COLOUR_NAMES.map(n => {
                const spec = COLOURS[n];
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
            <span style={UI.label}>Formation</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <select style={{ ...UI.input, flex: 1, cursor: 'pointer' }} value={primaryFormation}
                      onChange={e => setPrimaryFormation(e.target.value)}>
                {FORMATION_NAMES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select style={{ ...UI.input, flex: 1, cursor: 'pointer' }} value={secondaryFormation}
                      onChange={e => setSecondaryFormation(e.target.value)}>
                <option value="">No secondary</option>
                {FORMATION_NAMES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={UI.note}>Primary draws solid, secondary as rings.</div>
            <div style={{ marginTop: 8 }}>
              <Check label="Formation pitch in the header (off = formation / contract / tenure list)"
                     value={showFormation} onChange={setShowFormation} />
              <Check label="Draw the formation dots"
                     value={showFormationDots} onChange={setShowFormationDots} />
            </div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Average position map (optional)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ flex: 1, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                              padding: '7px 10px', borderRadius: 5, textAlign: 'center',
                              border: `1px solid ${mapRaw ? '#3b7de8' : '#1e2d45'}`,
                              background: mapRaw ? '#0e2040' : 'transparent',
                              color: mapRaw ? '#60a5fa' : '#8b98ad' }}>
                {mapRaw ? 'Position map loaded ✓' : 'Upload position map'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files && e.target.files[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = async (ev) => {
                      const raw = String(ev.target.result);
                      setMapRaw(raw);
                      setPositionMapUrl(mapExtract ? await extractHeat(raw) : raw);
                      setShowFormationDots(false);
                    };
                    r.readAsDataURL(f);
                    e.target.value = '';
                  }} />
              </label>
              {mapRaw && (
                <button onClick={() => { setMapRaw(''); setPositionMapUrl(''); setShowFormationDots(true); }}
                  style={{ padding: '7px 10px', background: 'none', border: '1px solid #1e2d45',
                           borderRadius: 5, color: '#f87171', fontSize: 11, cursor: 'pointer' }}>✕</button>
              )}
            </div>
            {mapRaw && (
              <>
                <div style={{ marginTop: 8 }}>
                  <Check label="Strip the pitch background (heat-style maps only)"
                         value={mapExtract}
                         onChange={async (v) => {
                           setMapExtract(v);
                           setPositionMapUrl(v ? await extractHeat(mapRaw) : mapRaw);
                         }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, color: '#94a3b8', width: 54, flexShrink: 0 }}>Strength</span>
                  <input type="range" min="15" max="100" value={mapOpacity}
                    onChange={e => setMapOpacity(e.target.value)}
                    style={{ flex: 1, accentColor: '#3b7de8' }} />
                  <span style={{ fontSize: 10.5, color: '#64748b', width: 34, textAlign: 'right' }}>{mapOpacity}%</span>
                </div>
                <div style={UI.note}>
                  Sits under the pitch markings, which is what keeps it inside the
                  design rather than pasted on top of it.
                </div>
              </>
            )}
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Manager photo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ flex: 1, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                              padding: '7px 10px', borderRadius: 5, textAlign: 'center',
                              border: `1px solid ${uploadedPhotoDataUrl ? '#3b7de8' : '#1e2d45'}`,
                              background: uploadedPhotoDataUrl ? '#0e2040' : 'transparent',
                              color: uploadedPhotoDataUrl ? '#60a5fa' : '#8b98ad' }}>
                {uploadedPhotoDataUrl ? 'Photo uploaded ✓' : 'Upload photo (optional)'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
              </label>
              {uploadedPhotoDataUrl && (
                <button onClick={() => setUploadedPhotoDataUrl('')}
                  style={{ padding: '7px 10px', background: 'none', border: '1px solid #1e2d45',
                           borderRadius: 5, color: '#f87171', fontSize: 11, cursor: 'pointer' }}>✕</button>
              )}
            </div>
            <div style={UI.note}>Blank uses the Fotmob id, then the saved photo.</div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Overall &amp; potential</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={overallOverride} inputMode="numeric"
                     onChange={e => setOverallOverride(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                     placeholder={scores.score != null ? String(Math.round(scores.score)) : 'Overall'}
                     disabled={overallUnclear}
                     style={{ ...UI.input, flex: 1, opacity: overallUnclear ? 0.45 : 1 }} />
              <input value={potentialOverride} inputMode="numeric"
                     onChange={e => setPotentialOverride(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                     placeholder={scores.potential != null ? String(Math.round(scores.potential)) : 'Potential'}
                     disabled={potentialUnclear}
                     style={{ ...UI.input, flex: 1, opacity: potentialUnclear ? 0.45 : 1 }} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Check label="Overall unclear (?)" value={overallUnclear} onChange={setOverallUnclear} />
              <Check label="Potential unclear (?)" value={potentialUnclear} onChange={setPotentialUnclear} />
            </div>
            <div style={UI.note}>
              75% team quality + 25% £ performance, recency weighted — same figure the
              quick card prints.
            </div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Style traits (up to 7)</span>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {TRAIT_KEYS.map(k => {
                const on = styleKeys.includes(k);
                return (
                  <button key={k}
                    onClick={() => setStyleKeys(list => on
                      ? list.filter(x => x !== k)
                      : (list.length >= 7 ? list : [...list, k]))}
                    style={{ padding: '3px 8px', marginRight: 5, marginBottom: 5, borderRadius: 10,
                             border: `1px solid ${on ? '#3b7de8' : '#1e2d45'}`,
                             background: on ? '#0e2040' : 'transparent',
                             color: on ? '#60a5fa' : '#8b98ad',
                             fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    {TRAIT_CHIP_LABELS[k]}
                  </button>
                );
              })}
            </div>
            <div style={UI.note}>{styleKeys.length} selected · sorted by score on the card.</div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Career chart</span>
            <Seg options={[['score', 'Score'], ['finish', 'League finish']]}
                 value={careerMode} onChange={setCareerMode} />
            <div style={UI.note}>
              Finish mode scales each season against its own division, so 3rd of 24
              and 3rd of 20 don&rsquo;t plot at the same height.
            </div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Team context — league rank</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['squadValue', 'Squad cost'], ['wageBill', 'Wage bill'], ['odds', 'Odds']].map(([k, lbl]) => (
                <input key={k} value={tcRanks[k]} inputMode="numeric" placeholder={lbl}
                       onChange={e => setTcRanks(o => ({ ...o, [k]: e.target.value.replace(/[^\d]/g, '').slice(0, 2) }))}
                       style={{ ...UI.input, flex: 1 }} />
              ))}
            </div>
            <input value={leagueSizeOv} inputMode="numeric"
                   onChange={e => setLeagueSizeOv(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                   placeholder={`League size (${ctx.statsRow && ctx.statsRow.leagueSize ? ctx.statsRow.leagueSize : 20})`}
                   style={{ ...UI.input, marginTop: 6 }} />
            <div style={UI.note}>
              Ranks within the league — 1 = richest / heaviest favourite. Average age
              comes from the data.
            </div>
          </div>

          {rightMid === 'impact' && (
            <div style={UI.block}>
              <span style={UI.label}>Impact — seasons compared</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <select style={{ ...UI.input, flex: 1, cursor: 'pointer' }} value={impactAKey}
                        onChange={e => setImpactAKey(e.target.value)}>
                  <option value="">A: earliest tenure</option>
                  {seasonOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <select style={{ ...UI.input, flex: 1, cursor: 'pointer' }} value={impactBKey}
                        onChange={e => setImpactBKey(e.target.value)}>
                  <option value="">B: latest tenure</option>
                  {seasonOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div style={UI.note}>A draws red, B draws blue.</div>
            </div>
          )}

          {rightMid === 'sw' && (
            <div style={UI.block}>
              <span style={UI.label}>Strengths &amp; weaknesses</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 6 }}>
                {[...swStrengthLabels, ...swWeakLabels].map(lbl => {
                  const off = swDrop.includes(lbl);
                  const isStr = swStrengthLabels.includes(lbl);
                  return (
                    <button key={lbl}
                      onClick={() => setSwDrop(d => off ? d.filter(x => x !== lbl) : [...d, lbl])}
                      style={{ padding: '3px 8px', marginRight: 5, marginBottom: 5, borderRadius: 10,
                               border: `1px solid ${off ? '#1e2d45' : (isStr ? '#22c55e55' : '#f8717155')}`,
                               background: off ? 'transparent' : (isStr ? '#22c55e1e' : '#f871711e'),
                               color: off ? '#55617a' : (isStr ? '#22c55e' : '#f87171'),
                               textDecoration: off ? 'line-through' : 'none',
                               fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{lbl}</button>
                  );
                })}
                {!swStrengthLabels.length && !swWeakLabels.length &&
                  <span style={UI.note}>Nothing derived for this season.</span>}
              </div>
              <div style={UI.note}>Tap to drop one. Add your own below.</div>

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <select value={swNew.label} onChange={e => setSwNew(o => ({ ...o, label: e.target.value }))}
                        style={{ ...UI.input, flex: 1, cursor: 'pointer' }}>
                  <option value="">Add a trait…</option>
                  {SW_MANUAL_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={swNew.tone} onChange={e => setSwNew(o => ({ ...o, tone: e.target.value }))}
                        style={{ ...UI.input, width: 86, flex: '0 0 auto', cursor: 'pointer' }}>
                  {Object.keys(SW_TONES).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button disabled={!swNew.label}
                  onClick={() => { setSwAddStr(a => [...a, { label: swNew.label, tone: swNew.tone }]);
                                   setSwNew({ label: '', tone: 'Green' }); }}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 5, border: '1px solid #22c55e55',
                           background: swNew.label ? '#22c55e1e' : 'transparent',
                           color: swNew.label ? '#22c55e' : '#55617a', fontSize: 11, fontWeight: 700,
                           cursor: swNew.label ? 'pointer' : 'default' }}>+ Strength</button>
                <button disabled={!swNew.label}
                  onClick={() => { setSwAddWeak(a => [...a, { label: swNew.label, tone: swNew.tone }]);
                                   setSwNew({ label: '', tone: 'Green' }); }}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 5, border: '1px solid #f8717155',
                           background: swNew.label ? '#f871711e' : 'transparent',
                           color: swNew.label ? '#f87171' : '#55617a',
                           fontSize: 11, fontWeight: 700,
                           cursor: swNew.label ? 'pointer' : 'default' }}>+ Weakness</button>
              </div>

              {[...swAddStr.map((x, i) => ({ ...x, i, kind: 'str' })),
                ...swAddWeak.map((x, i) => ({ ...x, i, kind: 'weak' }))].map(x => (
                <div key={x.kind + x.i + x.label}
                     style={{ display: 'flex', alignItems: 'center', marginTop: 5,
                              background: '#0d1220', border: '1px solid #1e2d45',
                              borderRadius: 6, padding: '5px 8px' }}>
                  <span style={{ flex: 1, fontSize: 11.5,
                                 color: SW_TONES[x.tone] || (x.kind === 'str' ? SW_TONES.Green : SW_TONES.Red) }}>
                    {x.label}
                  </span>
                  <button onClick={() => x.kind === 'str'
                            ? setSwAddStr(a => a.filter((_, j) => j !== x.i))
                            : setSwAddWeak(a => a.filter((_, j) => j !== x.i))}
                    style={{ background: 'transparent', border: 'none', color: '#64748b',
                             cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={UI.block}>
            <span style={UI.label}>
              Similar teams {similarPicked.length ? `(${similarPicked.length} chosen)` : '(auto — top 3)'}
              {similarPicked.length > 0 && (
                <button onClick={() => setSimilarPicked([])}
                  style={{ marginLeft: 8, background: 'transparent', border: '1px solid #1e2d45',
                           borderRadius: 4, color: '#60a5fa', fontSize: 9, padding: '1px 5px',
                           cursor: 'pointer' }}>back to auto</button>
              )}
            </span>
            {!similarChoices.length && <div style={UI.note}>No similarity data on this season&rsquo;s row.</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {similarChoices.map(t => {
                const on = similarPicked.some(x => x.team === t.team);
                return (
                  <button key={t.team}
                    onClick={() => setSimilarPicked(list => on
                      ? list.filter(x => x.team !== t.team)
                      : (list.length >= 3 ? list : [...list, t]))}
                    style={{ padding: '3px 8px', marginRight: 5, marginBottom: 5, borderRadius: 10,
                             border: `1px solid ${on ? '#3b7de8' : '#1e2d45'}`,
                             background: on ? '#0e2040' : 'transparent',
                             color: on ? '#60a5fa' : '#8b98ad',
                             fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    {t.team}{t.__sim != null ? ` ${Math.round(t.__sim)}%` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>
              GBE —{' '}
              <span style={{ color: gbe.pass ? '#4ade80' : gbe.showPanel ? '#f0c56a' : '#f87171' }}>
                {gbe.status}
              </span>
              {gbe.autopass ? ' · auto pass' : ''}
            </span>
            <Check label="36 months cumulative — Band 1-5 league"
                   value={gbeOv.c36} onChange={v => setGbeOv(o => ({ ...o, c36: v }))} />
            <Check label="24 months consecutive — Band 1-5 league"
                   value={gbeOv.c24} onChange={v => setGbeOv(o => ({ ...o, c24: v }))} />
            <Check label="Exceptions Panel"
                   value={gbeOv.exceptions} onChange={v => setGbeOv(o => ({ ...o, exceptions: v }))} />
            {gbeOv.exceptions && (
              <input value={gbeOv.exceptionsText}
                     onChange={e => setGbeOv(o => ({ ...o, exceptionsText: e.target.value.slice(0, 44) }))}
                     placeholder="Reason, e.g. Continental experience"
                     style={UI.input} />
            )}
            <div style={UI.note}>
              An English league or a home-nation passport passes on its own — the
              routes are only asked about when neither applies.
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, paddingTop: 12 }}>
          {error && (
            <div style={{ ...note, color: '#f87171', background: 'rgba(248,113,113,0.08)',
                          border: '1px solid rgba(248,113,113,0.25)' }}>
              Download failed: {error}
            </div>
          )}
          <button onClick={handleDownload} disabled={downloading}
            style={{ width: '100%', padding: isMobile ? '13px 0' : '10px 0', borderRadius: 8,
                     border: 'none', background: downloading ? '#1e2d45' : '#3b7de8',
                     color: '#fff', fontSize: 13, fontWeight: 700,
                     cursor: downloading ? 'default' : 'pointer' }}>
            {downloading ? (progress || 'Generating…') : (isMobile ? '⬇ Download Pager' : '⬇ Download 1920×1080')}
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
