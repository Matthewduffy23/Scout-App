// PlayerPager.js v1 — Player All-in-One report. 1920x1080 PNG export.
//
// The player equivalent of TeamReport.js. Geometry is TeamReport's, verbatim:
// same 24px pad, same 150px header band, same 756 / 538 / 538 column split and
// the same 336 / 284 / 229 row heights. That is deliberate — the two exports are
// meant to sit side by side in a pack and read as one system.
//
// WHAT REPLACES WHAT (TeamReport slot -> PlayerPager slot)
//   crest              -> player photo
//   club name          -> player name
//   league row         -> club name + league badge + league flag
//   PTS / xPTS         -> Apps / Gls / Asts / xG / xA / Mins
//   3 score wheels     -> Overall + Potential wheels
//   trend line         -> pitch diagram
//   coach profile      -> GBE calculation
//   XI + Depth         -> percentile bars
//   6 bottom panels    -> Style / Career, Team Context / Areas to Improve,
//                         Potential Clubs UK / View
//
// NOTHING IS REDRAWN HERE. Every renderer is imported from the card that already
// owns it — QuickCard for the eight player-side renderers, TeamReport for the
// wheel and the header ink. Those declarations gained an `export` keyword and
// nothing else, so their existing callers are untouched and this file cannot
// drift from the other cards: if a bar colour changes in QuickCard it changes
// here in the same commit, because it is literally the same function.
//
// The only things built locally are panel chrome (the rounded box + pink title,
// copied constants so it matches by value) and the four panel BODIES that have
// no equivalent anywhere else — Areas to Improve, Potential Clubs, View, and the
// percentile column, the last of which is assembled out of imported barRow calls
// rather than drawn from scratch.

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  MONTSERRAT_EMBED_CSS, leagueDisplayName, leagueLogo, leagueFlag,
} from './cardAssets';
import { formatMV, formatFoot } from './constants';
import { useIsMobile, deliverPng, photoUrl } from './utils';
import {
  scoreWheel, headerInk, preloadImages, fitNameSize,
  HEADER_COLOURS, HEADER_COLOUR_NAMES,
} from './TeamReport';
import { fadeHexToBG, countryToIso2 } from './CoachCard';
import {
  pitchDiagramSvg, careerTrajectorySvg, teamRangeBarHtml, gbeThresholdBar,
  rolesDotsSvg, scoreTierColor, barRow,
  TOKEN_TO_POS_KEY, POSITION_LABELS, METRIC_LABEL_MAP,
} from './QuickCard';
import { computeClubFit, simGroup } from './clubFit';

// ─── Canvas geometry — identical to TeamReport.js ──────────────────────────
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

const NAME_X = PAD + 128;
const NAME_MAX_W = 410;
const RULE_1 = 578;
const RULE_2 = 1338;
const WHEEL_X = 582;
const WHEEL_W = 372;
const RULE_MID = 946;
const PITCH_X = 968;                     // TeamReport's trend slot
const PITCH_W = 360;
const HDR_LABEL_Y = 114;
const GBE_X = 1358;                      // TeamReport's coach slot
const GBE_W = 538;

// ─── Palette — same values as TeamReport/QuickCard ─────────────────────────
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

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt1 = (v) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(1));
const truncateText = (s, n) => {
  const t = String(s == null ? '' : s);
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const normTeamKey = (t) => String(t || '').trim().toLowerCase();

// Panel chrome. Not imported because TeamReport's `panel` is private and isn't a
// renderer — it's a box. Every constant above is copied by value from there, so
// the two sets of panels are pixel-identical without a cross-import.
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

// ───────────────────────────────────────────────────────────────────────────
// SEASON RESOLUTION
//
// Ported from QuickCard's buildQuickCardElement rather than simplified. The
// subtlety it exists for: seasonsDetail is a plain object, so a player with two
// rows in one season (a January transfer) has one of them silently overwritten
// by the duplicate JSON key. seasonsDetailAll keeps every season+club row, and
// the override key is "season||league" so a two-club season resolves to the club
// actually chosen. sd and statsRow are both anchored off the SAME resolved
// league, or the bars and the Apps/Goals row would describe different clubs.
// ───────────────────────────────────────────────────────────────────────────
function resolveSeason(player, seasonOverride) {
  const sdObj = player.seasonsDetail || {};
  const sdAll = player.seasonsDetailAll || [];
  const allSummary = player.allSeasonsSummary || [];

  const [ovSeason, ovLeague] = seasonOverride ? seasonOverride.split('||') : [null, null];
  const valid = ovSeason
    && (sdObj[ovSeason] !== undefined || sdAll.some(r => r.season === ovSeason));
  const seasonKey = (valid ? ovSeason : null)
    || (allSummary[0] && allSummary[0].s)
    || Object.keys(sdObj).sort().reverse()[0];
  const leagueKey = valid ? (ovLeague || null) : null;

  const sdAllMatch = leagueKey
    ? sdAll.find(r => r.season === seasonKey && r.league === leagueKey)
    : sdAll.find(r => r.season === seasonKey);
  const sd = sdAllMatch || sdObj[seasonKey] || Object.values(sdObj)[0] || {};
  const league = sd.league || player.league;
  const statsRow = allSummary.find(r => r.s === seasonKey && r.l === league)
    || allSummary.find(r => r.s === seasonKey)
    || allSummary[0]
    || {};
  return { sd, statsRow, seasonKey, league, team: sd.team || player.team };
}

// ─── GBE ───────────────────────────────────────────────────────────────────
// Same derivation QuickCard uses, including the rule that overriding the band
// must move League Quality points with it — they're a function of the band, so
// falling back to the pipeline's stored figure after a manual band change would
// print two numbers that contradict each other.
const HOME_NATIONS = new Set(['england', 'scotland', 'wales', 'ireland',
  'northern ireland', 'republic of ireland']);
const LQ_BY_BAND = [12, 10, 8, 6, 4, 2];

function deriveGbe(player, ov = {}) {
  const num = (v, fb) => (v === '' || v == null || isNaN(Number(v)) ? fb : Number(v));
  const band = num(ov.band, player.gbeBand || 6);
  const bandOv = ov.band !== '' && ov.band != null;
  const domPts = num(ov.domPts, player.gbeDomPts ?? 0);
  const contPts = num(ov.contPts, player.gbeContPts ?? 0);
  const lqDefault = LQ_BY_BAND[Math.max(0, Math.min(5, band - 1))];
  const lqPts = num(ov.lqPts, bandOv ? lqDefault : (player.gbeLqPts ?? lqDefault));
  const finishPts = num(ov.finishPts, player.gbeFinishPts ?? 0);
  const progPts = num(ov.progPts, player.gbeProgPts ?? 0);
  const dirty = ['band', 'domPts', 'contPts', 'lqPts', 'finishPts', 'progPts']
    .some(k => ov[k] !== '' && ov[k] != null);
  const parts = domPts + contPts + lqPts + finishPts + progPts;
  const total = num(ov.total, dirty ? parts : (player.gbeTotal ?? parts));

  const birth = String(player.birthCountry || '').toLowerCase();
  const passport = String(player.passportCountries || '').toLowerCase();
  const homeNation = [...HOME_NATIONS].some(n => birth.includes(n) || passport.includes(n));

  const pass = homeNation || total >= 15;
  const panelEligible = !pass && total >= 10;
  return {
    band, domPts, contPts, lqPts, finishPts, progPts, total, homeNation, pass,
    panelEligible,
    status: pass ? 'PASS' : 'FAIL',
    colour: pass ? '#3da65b' : panelEligible ? '#f0a637' : '#c7363c',
  };
}

// ─── Percentile column (TeamReport's XI + Depth slot) ──────────────────────
// Assembled entirely out of imported barRow calls, so the bar geometry, the
// colour ramp and the 50% midline tick are the quick card's, not a copy of them.
// Row height is solved for the available space the same way QuickCard solves it
// for its own taller column: total rows and the number of section headings that
// actually have data both feed the divisor, so a keeper with two groups doesn't
// get the same cramped rhythm as an attacker with three.
function percentilePanelBody(w, h, sd, isGK) {
  const groups = sd.g || {};
  const keys = ['A', 'D', 'P'];
  const totalRows = keys.reduce((s, k) => s + (groups[k] ? groups[k].length : 0), 0);
  if (!totalRows) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;color:#475569;font-size:13px;">No percentile data for this season.</div>`;
  }
  const activeSections = keys.filter(k => groups[k] && groups[k].length > 0).length;
  const SECTION_H = 32;          // heading + its margins
  const AXIS_H = 44;             // percent scale + "Percentile Rank" caption
  const budget = h - AXIS_H - activeSections * SECTION_H;
  const rowH = Math.max(8, Math.min(34, Math.floor(budget / totalRows) - 1));
  const slack = Math.max(0, budget - totalRows * (rowH + 1));
  const extraGap = totalRows > 0 ? Math.min(6, Math.floor(slack / totalRows)) : 0;

  const bars = (k) => (groups[k] || []).map(([label, pct, val]) => {
    const display = METRIC_LABEL_MAP[label] || label;
    const isPct = /%/.test(display);
    const n = typeof val === 'number' ? val : parseFloat(val);
    const shown = !isNaN(n) ? n.toFixed(isPct ? 1 : 2) : val;
    return barRow(display, pct, shown, rowH, extraGap);
  }).join('');

  const heading = (t) => `<div style="font-size:15px;font-weight:800;color:#f3f5f7;margin:6px 0 5px;">${t}</div>`;

  return `
    <div style="position:absolute;inset:0;overflow:hidden;">
      ${groups.A && groups.A.length ? heading(isGK ? 'Goalkeeping' : 'Attacking') + bars('A') : ''}
      ${groups.D && groups.D.length ? heading('Defensive') + bars('D') : ''}
      ${groups.P && groups.P.length ? heading('Possession') + bars('P') : ''}
      <div style="display:flex;align-items:center;margin-top:6px;">
        <div style="width:188px;flex-shrink:0;"></div>
        <div style="flex:1;position:relative;height:22px;">
          ${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => `
            <span style="position:absolute;left:${p}%;top:0;
                         transform:translateX(${p === 0 ? '0' : p === 100 ? '-100%' : '-50%'});
                         font-size:10px;font-weight:600;color:#c4cbd9;">${p}%</span>`).join('')}
          <span style="position:absolute;left:50%;top:12px;transform:translateX(-50%);
                       font-size:8px;font-weight:600;color:#5e6678;text-transform:uppercase;
                       letter-spacing:.05em;">Avg</span>
        </div>
      </div>
      <div style="display:flex;">
        <div style="width:188px;flex-shrink:0;"></div>
        <div style="flex:1;text-align:center;font-size:12px;font-weight:700;color:#e8eef8;padding-top:4px;">Percentile Rank</div>
      </div>
    </div>`;
}

// ─── Areas to Improve ──────────────────────────────────────────────────────
// The four weakest metrics this season, as the same bars the percentile column
// uses, plus whatever qualitative weaknesses the pipeline tagged. Metrics are
// taken across all three groups and deduped by DISPLAY label — several raw
// column names map to one display name, and two identical-looking bars in a
// four-slot panel reads as a defect rather than a signal (same reason
// TeamReport dedupes PPDA out of its version).
const IMPROVE_CEILING = 50;      // only show a metric if it's actually below par

function improvePanelBody(w, h, sd, player, manualNotes) {
  const groups = sd.g || {};
  const seen = new Set();
  const rows = [];
  for (const k of ['A', 'D', 'P']) {
    for (const entry of (groups[k] || [])) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const label = METRIC_LABEL_MAP[entry[0]] || entry[0];
      if (seen.has(label)) continue;
      seen.add(label);
      rows.push([label, Number(entry[1]) || 0, entry[2]]);
    }
  }
  rows.sort((a, b) => a[1] - b[1]);
  const worst = rows.filter(r => r[1] < IMPROVE_CEILING).slice(0, 4);

  const weaknesses = (manualNotes && manualNotes.length)
    ? manualNotes
    : (sd.weaknesses || player.latestWeaknesses || []);

  const bars = worst.map(([label, pct, raw]) => {
    const n = typeof raw === 'number' ? raw : parseFloat(raw);
    const isPct = /%/.test(label);
    const shown = !isNaN(n) ? n.toFixed(isPct ? 1 : 2) : raw;
    return barRow(label, pct, shown, 20, 4);
  }).join('');

  const tags = weaknesses.slice(0, 5).map(s => `
    <span style="font-size:12px;background:rgba(248,113,113,0.10);color:#f87171;
                 border:1px solid rgba(248,113,113,0.30);border-radius:12px;
                 padding:3px 10px;display:inline-block;margin:0 6px 6px 0;">${esc(s)}</span>`).join('');

  if (!bars && !tags) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;color:#475569;font-size:13px;">No significant weaknesses.</div>`;
  }
  return `
    <div style="position:absolute;inset:0;overflow:hidden;">
      ${bars}
      ${tags ? `<div style="margin-top:${bars ? 10 : 0}px;">${tags}</div>` : ''}
    </div>`;
}

// ─── Potential Clubs UK ────────────────────────────────────────────────────
// Rows are computed in the component (computeClubFit walks the whole position
// pool, which is not something to do inside a render function that runs twice
// per export) and passed in already ranked.
function clubsPanelBody(w, h, rows, coreOnly) {
  if (!rows || !rows.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;color:#475569;font-size:13px;text-align:center;">
              No UK club fits — the position pool for this player isn't loaded.</div>`;
  }
  const shown = rows.slice(0, 5);
  const rowH = Math.floor((h - (coreOnly ? 16 : 0)) / shown.length);
  const body = shown.map((r, i) => {
    const col = scoreTierColor(r.finalFit);
    return `
      <div style="display:flex;align-items:center;height:${rowH}px;">
        <span style="width:18px;flex-shrink:0;font-size:11px;font-weight:800;color:#475569;">${i + 1}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:#e2e8f4;white-space:nowrap;">${esc(r.team)}</div>
          <div style="font-size:10px;font-weight:600;color:#64748b;white-space:nowrap;">${esc(leagueDisplayName(r.league) || r.league)}</div>
        </div>
        <div style="width:132px;flex-shrink:0;height:6px;border-radius:3px;
                    background:rgba(255,255,255,0.10);overflow:hidden;margin:0 10px;">
          <div style="width:${Math.max(0, Math.min(100, r.finalFit))}%;height:100%;
                      background:${col};border-radius:3px;"></div>
        </div>
        <span style="width:44px;flex-shrink:0;text-align:right;font-size:17px;
                     font-weight:900;color:${col};">${Math.round(r.finalFit)}</span>
      </div>`;
  }).join('');

  // Stated on the card, not just in the editor. Without the peak-fit blend the
  // number is the core alone and reads a few points high — a reader comparing
  // this against ScoutBoard deserves to know which of the two they're looking at.
  const note = coreOnly
    ? `<div style="position:absolute;left:0;bottom:0;font-size:9px;font-weight:600;
                   color:#475569;letter-spacing:0.04em;">CORE FIT ONLY — CLUB SIMILARITY NOT LOADED</div>`
    : '';
  return `<div style="position:absolute;inset:0;overflow:hidden;">${body}${note}</div>`;
}

// ─── View ──────────────────────────────────────────────────────────────────
function viewPanelBody(w, h, text) {
  if (!text || !String(text).trim()) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;color:#3d4a5e;font-size:13px;">No view written.</div>`;
  }
  return `<div style="position:absolute;inset:0;font-size:17px;line-height:1.5;
            font-weight:500;color:#e2e8f4;overflow:hidden;">${esc(text)}</div>`;
}

// ─── Header ────────────────────────────────────────────────────────────────
let IMG = {};
const src = (url) => (url && IMG[url]) || url || '';

function headerHtml(player, ctx, opts) {
  const { sd, statsRow, league, team } = ctx;
  const {
    headerColour, nameOverride, teamOverride, positionColors, gbeOv,
    showPitch, isGK,
  } = opts;

  const spec = headerColour;
  const ink = headerInk(spec);
  const displayName = (nameOverride && nameOverride.trim()) || player.name;
  const displayTeam = (teamOverride && teamOverride.trim()) || team;
  const photo = opts.uploadedPhotoDataUrl || photoUrl(player.name, player.team);
  const logo = leagueLogo(league);
  const flag = leagueFlag(league);
  const natIso = countryToIso2(player.birthCountry);

  // xG/xA are stored per 90 in bar-chart group A, not as season totals. Same
  // derivation as QuickCard and PlayerScoutingCard, so all three agree.
  const mins = statsRow.mins || sd.mins || 0;
  const rawA = (...labels) => {
    const hit = (sd.g && sd.g.A ? sd.g.A : [])
      .find(r => labels.includes(String(r[0]).toLowerCase().trim()));
    return hit && typeof hit[2] === 'number' ? hit[2] : null;
  };
  const per90ToSeason = (v) => (v != null && mins ? (v * mins) / 90 : null);
  const xg = player.xgSeason != null ? player.xgSeason : per90ToSeason(rawA('xg'));
  const xa = player.xaSeason != null ? player.xaSeason : per90ToSeason(rawA('xa', 'expected assists'));

  const cells = [
    ['APPS', statsRow.m != null ? String(statsRow.m) : '—'],
    ['GLS', statsRow.g != null ? String(statsRow.g) : '—'],
    ['ASTS', statsRow.a != null ? String(statsRow.a) : '—'],
    ...(isGK ? [] : [['xG', fmt1(xg)], ['xA', fmt1(xa)]]),
    ['MINS', statsRow.mins ? statsRow.mins.toLocaleString() : '—'],
  ];

  const gbe = deriveGbe(player, gbeOv);
  const rawTok = String(player.position || '').split(',')[0].trim();

  return `
    <div style="position:absolute;top:0;left:0;width:${W}px;height:${HEADER_H}px;
                background:${headerGradient(headerColour)};
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"></div>

    <!-- Player photo takes the crest's box. Circular and cover-cropped from the
         top, because the repo's photos are head-and-shoulders portraits and a
         centred crop cuts the chin off. -->
    <div style="position:absolute;left:${PAD}px;top:21px;width:108px;height:108px;
                border-radius:50%;overflow:hidden;background:#1a2233;
                background-image:url('${src(photo)}');background-size:cover;
                background-position:center top;
                box-shadow:inset 0 0 0 2px rgba(255,255,255,0.14);"></div>

    <div style="position:absolute;left:${NAME_X}px;top:14px;width:${NAME_MAX_W}px;height:56px;
                display:flex;align-items:flex-end;overflow:hidden;">
      <div style="font-size:${fitNameSize(displayName)}px;font-weight:800;letter-spacing:-0.8px;
                  line-height:1.0;color:${ink.primary};white-space:nowrap;">${esc(displayName)}</div>
    </div>

    <!-- club + league badge + league flag -->
    <div style="position:absolute;left:${NAME_X}px;top:78px;display:flex;align-items:center;
                white-space:nowrap;">
      <span style="font-size:21px;font-weight:700;color:${ink.secondary};">${esc(truncateText(displayTeam, 20))}</span>
      ${logo ? `<div style="width:23px;height:23px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${src(logo)}');margin-left:12px;"></div>` : ''}
      ${flag ? `<div style="width:26px;height:16px;flex-shrink:0;background-size:cover;
                  background-position:center;border-radius:2px;margin-left:9px;
                  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);
                  background-image:url('${src(flag)}');"></div>` : ''}
      <span style="font-size:14px;font-weight:600;color:${ink.muted};margin-left:9px;">${esc(leagueDisplayName(league) || league)}</span>
    </div>

    <!-- Apps / Gls / Asts / xG / xA / Mins, on TeamReport's PTS baseline -->
    <div style="position:absolute;left:${NAME_X}px;top:113px;display:flex;align-items:baseline;
                white-space:nowrap;">
      ${cells.map(([lab, val], i) => `
        <span style="${i ? 'margin-left:19px;' : ''}font-size:15px;font-weight:800;
                     color:${ink.secondary};">${val}</span>
        <span style="margin-left:5px;font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:${ink.muted};">${lab}</span>`).join('')}
    </div>

    ${[RULE_1, RULE_2].map(x =>
      `<div style="position:absolute;left:${x}px;top:28px;width:1px;height:100px;
                   background:${ink.rule};"></div>`).join('')}

    <!-- Overall + Potential. Both drawn big, unlike TeamReport's one-hero-two-minor
         arrangement: a player's ceiling is not a subordinate stat to his current
         level, and at two wheels there's room for both to carry full weight. -->
    ${(() => {
      const all = [
        ['OVERALL', player.careerScore, 37],
        ['POTENTIAL', player.potentialScore, 33],
      ];
      const step = WHEEL_W / all.length;
      return all.map(([label, v, r], i) => scoreWheel({
        cx: WHEEL_X + step * i + step / 2,
        cy: 66,
        r,
        stroke: 8,
        value: v, label, colour: scoreTierColor(v), ink, big: true, labelY: HDR_LABEL_Y,
      })).join('');
    })()}

    <div style="position:absolute;left:${RULE_MID}px;top:28px;width:1px;height:100px;
                background:${ink.rule};"></div>

    <!-- Pitch diagram in the trend line's slot. Fixed 3:2 box so the SVG's own
         330x220 viewBox scales without distortion. -->
    ${showPitch ? `
    <div style="position:absolute;left:${PITCH_X + (PITCH_W - 153) / 2}px;top:25px;
                width:153px;height:102px;">${pitchDiagramSvg(player, positionColors)}</div>`
    : `
    <div style="position:absolute;left:${PITCH_X}px;top:34px;width:${PITCH_W}px;">
      ${[['POSITION', POSITION_LABELS[rawTok] || rawTok || '—'],
         ['FOOT', player.foot && player.foot !== 'unknown' && player.foot !== 'nan' ? formatFoot(player.foot) : '—'],
         ['xVALUE', player.xValue > 0 ? formatMV(player.xValue) : '—'],
         ['CONTRACT', player.contractYear && player.contractYear !== 'nan' ? String(player.contractYear) : '—'],
        ].map(([k, v], i) => `
        <div style="position:absolute;left:0;top:${i * 22}px;font-size:8px;font-weight:700;
                    letter-spacing:0.13em;color:${ink.muted};">${k}</div>
        <div style="position:absolute;left:96px;top:${i * 22 - 3}px;font-size:13px;font-weight:700;
                    color:${ink.secondary};white-space:nowrap;">${esc(truncateText(v, 24))}</div>`).join('')}
    </div>`}

    <!-- GBE in the coach profile's slot -->
    <div style="position:absolute;left:${GBE_X}px;top:26px;width:${GBE_W}px;">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  white-space:nowrap;margin-bottom:12px;">
        <span style="font-size:8px;font-weight:700;letter-spacing:0.14em;color:${ink.muted};">GBE CALCULATION</span>
        <span style="display:flex;align-items:center;">
          <span style="font-size:14px;font-weight:800;color:${ink.secondary};">${gbe.total} pts</span>
          <span style="margin-left:10px;font-size:11px;font-weight:800;color:${gbe.colour};
                       background:${gbe.colour}22;border:1px solid ${gbe.colour};border-radius:5px;
                       padding:3px 10px;">${gbe.status}</span>
        </span>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${gbeThresholdBar('Domestic Apps', gbe.domPts, 12)}
        ${gbeThresholdBar('Continental', gbe.contPts, 8)}
        ${gbeThresholdBar('League Band', gbe.lqPts, 12)}
        ${gbeThresholdBar('Finish/Prog', gbe.finishPts + gbe.progPts, 10)}
      </div>
      ${gbe.homeNation
        ? `<div style="margin-top:5px;font-size:8.5px;font-weight:700;letter-spacing:0.1em;color:#3da65b;">AUTO PASS — HOME NATION</div>`
        : gbe.panelEligible
        ? `<div style="margin-top:5px;font-size:8.5px;font-weight:700;letter-spacing:0.1em;color:#f0c56a;">ELIGIBLE FOR EXCEPTIONS PANEL</div>`
        : ''}
    </div>`;
}

// ─── Image preload ─────────────────────────────────────────────────────────
// Four remote references only — nothing like TeamReport's ~16 — but the same
// treatment, because html-to-image refetches every remote image on each of the
// two render passes and a cold GitHub fetch is slower than the render.
export function pagerImageUrls(player, ctx, uploadedPhotoDataUrl) {
  const urls = [
    uploadedPhotoDataUrl ? '' : photoUrl(player.name, player.team),
    leagueLogo(ctx.league),
    leagueFlag(ctx.league),
  ];
  const iso = countryToIso2(player.birthCountry);
  if (iso) urls.push(`https://flagcdn.com/w80/${iso}.png`);
  return [...new Set(urls.filter(u => u && !u.startsWith('data:')))];
}

// ───────────────────────────────────────────────────────────────────────────
export function buildPlayerPagerElement(player, opts = {}) {
  const {
    images = {}, headerColourName = 'Default', seasonOverride = '',
    nameOverride = '', teamOverride = '', uploadedPhotoDataUrl = '',
    viewText = '', clubRows = [], clubsCoreOnly = true,
    showForecast = false, useBestRoleCareer = false, showPitch = true,
    positionColors = {}, gbeOv = {}, improveNotes = [],
  } = opts;
  IMG = images || {};

  const ctx = resolveSeason(player, seasonOverride);
  const { sd } = ctx;
  const rawTok = String(player.position || '').split(',')[0].trim();
  const posKey = TOKEN_TO_POS_KEY[rawTok] || player.roleKey || 'CF';
  const isGK = rawTok === 'GK' || String(player.roleKey || '').startsWith('GK');

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

  // Style. rolesDotsSvg is built for an 880px column and hard-codes a 280px
  // label gutter; handed 498 directly the ten dots would overlap each other.
  // So it's rendered at its native width and scaled down as a unit — the
  // proportions the function was designed around are preserved exactly, and it
  // stays the same function the quick card calls rather than a re-tuned copy.
  const ROLES_NATIVE_W = 880;
  const ROLES_ROW_H = 56;
  const qcRoles = player.qcRoleCareerScores || player.qcLatestRoles || player.roleCareerScores;
  const roleList = qcRoles && Object.keys(qcRoles).length
    ? Object.entries(qcRoles).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];
  const rolesScale = innerW / ROLES_NATIVE_W;
  const rolesHtml = roleList.length
    ? `<div style="position:absolute;left:0;top:0;width:${ROLES_NATIVE_W}px;
                   transform:scale(${rolesScale.toFixed(4)});transform-origin:top left;">
         ${rolesDotsSvg(roleList, ROLES_NATIVE_W, ROLES_ROW_H)}
       </div>`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;
                   justify-content:center;color:#475569;font-size:13px;">No role scores.</div>`;

  container.innerHTML = `
    <div id="pp-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(player, ctx, {
        headerColour: HEADER_COLOURS[headerColourName], nameOverride, teamOverride,
        uploadedPhotoDataUrl, positionColors, gbeOv, showPitch, isGK,
      })}

      ${panel({
        x: PAD, y: BODY_TOP, w: LEFT_W, h: LEFT_H,
        title: 'Percentile Rank',
        right: `${ctx.seasonKey || ''}${ctx.team ? ` · ${truncateText(ctx.team, 22)}` : ''}`,
        body: percentilePanelBody(leftInnerW, leftInnerH, sd, isGK),
      })}

      ${panel({
        x: COL_A_X, y: ROW_1, w: COL_W, h: ROW1_H, title: 'Style',
        body: rolesHtml,
      })}
      ${panel({
        x: COL_B_X, y: ROW_1, w: COL_W, h: ROW1_H, title: 'Career',
        body: `<div style="position:absolute;left:0;top:0;">${
          careerTrajectorySvg(player, innerW, row1InnerH, showForecast, posKey, useBestRoleCareer)
        }</div>`,
      })}

      ${panel({
        x: COL_A_X, y: ROW_2, w: COL_W, h: ROW2_H, title: 'Team Context',
        body: `<div style="position:absolute;inset:0;overflow:hidden;">${
          teamRangeBarHtml(player, posKey, innerW)
        }</div>`,
      })}
      ${panel({
        x: COL_B_X, y: ROW_2, w: COL_W, h: ROW2_H, title: 'Areas to Improve',
        body: improvePanelBody(innerW, row2InnerH, sd, player, improveNotes),
      })}

      ${panel({
        x: COL_A_X, y: ROW_3, w: COL_W, h: ROW3_H, title: 'Potential Clubs UK',
        body: clubsPanelBody(innerW, row3InnerH, clubRows, clubsCoreOnly),
      })}
      ${panel({
        x: COL_B_X, y: ROW_3, w: COL_W, h: ROW3_H, title: 'View',
        body: viewPanelBody(innerW, row3InnerH, viewText),
      })}
    </div>`;

  document.body.appendChild(container);
  return container;
}

// ───────────────────────────────────────────────────────────────────────────
// PEAK-FIT WIRING
//
// The 20% career-peak weight in club fit needs "how similar is each candidate
// club to the club where this player actually peaked". build_teams.py already
// computed exactly that and stored it on every team row as similarTeams —
// [{team, league, similarity}] on a 0-100 scale, which TeamReport and TeamCard
// both read straight out. So the map is a lookup, not a model.
//
// teams_final.json isn't in memory on this route (PlayerCard only ever receives
// players), so it's fetched on demand and cached for the session. If the fetch
// fails the export still works — clubFit falls back to core-only scoring, which
// the panel then says on its face rather than quietly publishing a number that's
// a few points high.
// ───────────────────────────────────────────────────────────────────────────
let _teamsCache = null;
let _teamsFailed = false;

async function loadTeams() {
  if (_teamsCache) return _teamsCache;
  if (_teamsFailed) return null;
  try {
    const r = await fetch('/teams_final.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json();
    _teamsCache = Array.isArray(rows) ? rows : (rows.teams || []);
    return _teamsCache;
  } catch (e) {
    _teamsFailed = true;
    return null;
  }
}

const normLeagueKey = (l) => String(l || '').trim().replace(/\.$/, '').toLowerCase();

function peakSeasonRow(player) {
  const ss = (player.seasonsDetailAll || []).filter(s => s && s.score != null);
  if (!ss.length) return null;
  return ss.reduce((a, b) => (b.score > a.score ? b : a));
}

// { normalisedTeamName: similarity } for the club the player peaked at. The peak
// club itself is 100 — a like-for-like move is a perfect stylistic fit by
// definition, and leaving it out would penalise the one club we're most certain
// suits him.
function buildPeakFitMap(player, teams) {
  if (!teams || !teams.length) return null;
  const peak = peakSeasonRow(player);
  const team = (peak && peak.team) || player.team;
  const league = (peak && peak.league) || player.league;
  const season = peak && peak.season;

  const byName = teams.filter(t => normTeamKey(t.team) === normTeamKey(team));
  const row = byName.find(t => normLeagueKey(t.league) === normLeagueKey(league)
                            && String(t.season) === String(season))
    || byName.find(t => normLeagueKey(t.league) === normLeagueKey(league))
    || byName[0];
  if (!row || !Array.isArray(row.similarTeams) || !row.similarTeams.length) return null;

  const map = { [normTeamKey(team)]: 100 };
  for (const s of row.similarTeams) {
    if (!s) continue;
    const name = typeof s === 'object' ? s.team : s;
    const sim = typeof s === 'object' ? s.similarity : null;
    if (!name || sim == null) continue;
    map[normTeamKey(name)] = Number(sim);
  }
  return Object.keys(map).length > 1 ? map : null;
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

const VIEW_MAX_LENGTH = 300;
const SEASON_SORT = ['2018-19', '2019-20', '2020-21', '2021-22', '2022-23', '2023-24', '2024-25', '2025-26'];

export default function PlayerPagerModal({ player, players = [], onClose }) {
  const isMobile = useIsMobile();

  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const [headerColourName, setHeaderColourName] = useState('Default');
  const [seasonOverride, setSeasonOverride] = useState('');
  const [nameOverride, setNameOverride] = useState('');
  const [teamOverride, setTeamOverride] = useState('');
  const [uploadedPhotoDataUrl, setUploadedPhotoDataUrl] = useState('');
  const [viewText, setViewText] = useState('');
  const [showForecast, setShowForecast] = useState(false);
  const [useBestRoleCareer, setUseBestRoleCareer] = useState(false);
  const [showPitch, setShowPitch] = useState(true);
  const [gbeOv, setGbeOv] = useState({});
  const [showGbeEdit, setShowGbeEdit] = useState(false);

  const [peakFit, setPeakFit] = useState(null);
  const [peakState, setPeakState] = useState('idle');   // idle | loading | ok | none

  const ctx = useMemo(() => resolveSeason(player, seasonOverride), [player, seasonOverride]);

  const availableSeasons = useMemo(() => {
    const seen = new Set();
    return (player.allSeasonsSummary || [])
      .filter(r => r && r.s)
      .filter(r => { const k = `${r.s}||${r.l}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => SEASON_SORT.indexOf(b.s) - SEASON_SORT.indexOf(a.s))
      .map(r => ({ key: `${r.s}||${r.l || ''}`, label: r.team ? `${r.s} — ${r.team}` : r.s }));
  }, [player]);

  // Club Fit compares like for like, so the pool is the position group already
  // in memory — computeClubFit filters it down to the player's own group itself,
  // which means the full `players` prop is correct on desktop and the single
  // loaded chunk is correct on mobile, with no extra fetch either way. The
  // player necessarily came out of his own group's chunk, so that chunk is
  // always the one that's loaded.
  const group = useMemo(() => simGroup(player.position || player.roleKey || ''), [player]);
  const poolSize = useMemo(
    () => (players || []).filter(p => p && simGroup(p.position || p.roleKey || '') === group).length,
    [players, group],
  );

  const loadPeakFit = useCallback(async () => {
    setPeakState('loading');
    const teams = await loadTeams();
    const map = buildPeakFitMap(player, teams);
    setPeakFit(map);
    setPeakState(map ? 'ok' : 'none');
  }, [player]);

  // Desktop pulls the similarity file on open so the number on the card is the
  // blended one by default. On mobile it's a tap, because teams_final.json is a
  // multi-megabyte fetch on a phone connection and the export still produces a
  // correct, clearly-labelled core-only score without it.
  useEffect(() => {
    if (!isMobile) loadPeakFit();
  }, [isMobile, loadPeakFit]);

  const clubRows = useMemo(() => {
    try {
      return computeClubFit(player, players || [], {
        ukOnly: true, topN: 5, peakFitByTeam: peakFit,
      });
    } catch (e) {
      console.error('[PlayerPager] club fit failed:', e);
      return [];
    }
  }, [player, players, peakFit]);

  const buildOpts = () => ({
    headerColourName, seasonOverride, nameOverride, teamOverride,
    uploadedPhotoDataUrl, viewText, clubRows,
    clubsCoreOnly: !peakFit,
    showForecast, useBestRoleCareer, showPitch, gbeOv,
  });

  const handleDownload = async () => {
    setDownloading(true); setProgress('Loading images…'); setError('');
    let el = null;
    try {
      const { toPng } = await import('html-to-image');
      const urls = pagerImageUrls(player, ctx, uploadedPhotoDataUrl);
      const images = await preloadImages(urls, (d, t) => setProgress(`Images ${d}/${t}`));
      setProgress('Rendering…');
      el = buildPlayerPagerElement(player, { ...buildOpts(), images });
      const node = el.querySelector('#pp-card-root') || el;
      const opts = {
        width: W, height: H, pixelRatio: 1, backgroundColor: BG,
        cacheBust: false, fontEmbedCSS: MONTSERRAT_EMBED_CSS,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      };
      // Double render: the first pass warms the font and image caches, the
      // second is the one that actually comes out right. Same pattern as every
      // other card here.
      await toPng(node, opts);
      const dataUrl = await toPng(node, opts);
      await deliverPng(dataUrl, `${String(player.name).replace(/\s+/g, '_')}_player_pager.png`);
    } catch (e) {
      console.error('[PlayerPager] download failed:', e);
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

  const setG = (k, v) => setGbeOv(o => ({ ...o, [k]: v }));
  const gbe = deriveGbe(player, gbeOv);
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
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f4' }}>📄 Player Pager</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {player.name} · {player.team}
          </div>
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', flex: 1,
                      paddingRight: 4, marginRight: -4 }}>

          <div style={UI.block}>
            <span style={UI.label}>Player name on card</span>
            <input style={UI.input} value={nameOverride}
                   onChange={e => setNameOverride(e.target.value)} placeholder={player.name} />
          </div>

          {availableSeasons.length > 1 && (
            <div style={UI.block}>
              <span style={UI.label}>Season</span>
              <select style={{ ...UI.input, cursor: 'pointer' }} value={seasonOverride}
                      onChange={e => setSeasonOverride(e.target.value)}>
                <option value="">Default (most recent)</option>
                {availableSeasons.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}

          <div style={UI.block}>
            <span style={UI.label}>Club name on card</span>
            <input style={UI.input} value={teamOverride}
                   onChange={e => setTeamOverride(e.target.value)} placeholder={ctx.team} />
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
              placeholder="Your read on the player…" />
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Header colour</span>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {HEADER_COLOUR_NAMES.map(n => {
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

          <Check label="Pitch diagram in the header (off = position / foot / xValue / contract)"
                 value={showPitch} onChange={setShowPitch} />
          <Check label="Career forecast (dashed line to potential)"
                 value={showForecast} onChange={setShowForecast} />
          <Check label="Career chart uses best role per season"
                 value={useBestRoleCareer} onChange={setUseBestRoleCareer} />

          <div style={{ ...UI.block, marginTop: 10 }}>
            <span style={UI.label}>Player photo</span>
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
          </div>

          <div style={{ ...UI.block, marginTop: 4 }}>
            <div onClick={() => setShowGbeEdit(v => !v)}
                 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          cursor: 'pointer', marginBottom: 6 }}>
              <span style={{ ...UI.label, marginBottom: 0 }}>
                GBE — {gbe.total} pts · {gbe.status}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>{showGbeEdit ? '−' : '+'}</span>
            </div>
            {showGbeEdit && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[['band', 'Band'], ['domPts', 'Domestic'], ['contPts', 'Continental'],
                    ['lqPts', 'League Qual'], ['finishPts', 'Finish'], ['progPts', 'Prog'],
                    ['total', 'Total']].map(([k, lbl]) => (
                    <input key={k} value={gbeOv[k] ?? ''} placeholder={lbl} inputMode="numeric"
                           onChange={e => setG(k, e.target.value.replace(/[^\d]/g, ''))}
                           style={{ ...UI.input, width: 'calc(33.33% - 4px)', flex: '0 0 auto' }} />
                  ))}
                </div>
                <div style={UI.note}>
                  Blank falls through to the pipeline value. Changing Band moves League Qual with it.
                </div>
              </>
            )}
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Potential Clubs UK</span>
            {poolSize < 50 && (
              <div style={{ ...note, color: '#fbc701', background: 'rgba(251,199,1,0.08)',
                            border: '1px solid rgba(251,199,1,0.25)' }}>
                Only {poolSize} {group || 'matching'} players loaded — club fit needs the
                position group in memory to rank against.
              </div>
            )}
            <div style={UI.note}>
              {clubRows.length
                ? `${clubRows.length} clubs ranked against ${poolSize} ${group} players.`
                : 'No clubs ranked.'}
            </div>
            {peakState === 'ok' && (
              <div style={{ ...UI.note, color: '#4ade80' }}>
                Club similarity loaded — full blended fit.
              </div>
            )}
            {peakState !== 'ok' && (
              <>
                <div style={{ ...UI.note, color: '#f6a75c' }}>
                  {peakState === 'loading'
                    ? 'Loading club similarity…'
                    : 'Core-only fit — reads a few points high. Marked on the card.'}
                </div>
                <button onClick={loadPeakFit} disabled={peakState === 'loading'}
                  style={{ width: '100%', marginTop: 6, padding: '8px 0', borderRadius: 6,
                           border: '1px solid #3b7de8',
                           background: peakState === 'loading' ? '#1e2d45' : '#0e2040',
                           color: '#93c5fd', fontSize: 11.5, fontWeight: 700,
                           cursor: peakState === 'loading' ? 'default' : 'pointer' }}>
                  {peakState === 'loading' ? 'Loading…' : 'Load club similarity (+20% peak fit)'}
                </button>
              </>
            )}
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
