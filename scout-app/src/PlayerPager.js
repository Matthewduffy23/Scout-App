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
  MONTSERRAT_EMBED_CSS, leagueDisplayName, leagueLogo, leagueFlag, teamCrest,
} from './cardAssets';
import { formatMV, formatFoot } from './constants';
import { useIsMobile, deliverPng, photoUrl } from './utils';
import {
  scoreWheel, headerInk, preloadImages, fitNameSize, pillHtml,
  styleHexSvg, gradeColor, radarColor, teamOptions,
  HEADER_COLOURS, HEADER_COLOUR_NAMES,
} from './TeamReport';
import { fadeHexToBG, countryToIso2 } from './CoachCard';
import {
  careerTrajectorySvg, teamRangeBarHtml,
  scoreTierColor, barRow,
  TOKEN_TO_POS_KEY, POSITION_LABELS, METRIC_LABEL_MAP,
  POSITION_TEAM_CONTEXT_CATS, TEAM_CONTEXT_BANDS, computeEscReasons,
} from './QuickCard';
import { computeClubFit, computeSimilarPlayers, simGroup } from './clubFit';

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
// 410 was TeamReport's, sized for club names. Player names run longer
// ("Alexander-Arnold"), so the identity block takes 66px back off the wheel
// span — two wheels never needed 372, and moving them right also opens the gap
// between the rings and the rule.
const NAME_MAX_W = 476;
const RULE_1 = 644;
const RULE_2 = 1338;
const WHEEL_X = 650;
const WHEEL_W = 296;
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
  // Two separate routes in for a player who fails outright, exactly as QuickCard
  // and PlayerCard define them, and they are mutually exclusive by points:
  //   10-14 pts  -> GBE Exceptions Panel review
  //   under 10   -> ESC, but only if the player is flagged escEligible
  // The pager was showing neither, so an ESC-eligible player who reads ESC on his
  // quick card read as a plain FAIL here. escOverride forces the line on for the
  // cases the data can't see, same as the quick card's toggle.
  const panelEligible = !pass && total >= 10;
  const escOn = !!ov.escOverride;
  const escEligible = escOn || (!pass && total < 10 && !!player.escEligible);
  let escReasons = [];
  try {
    escReasons = escOn
      ? (ov.escReason ? [ov.escReason] : computeEscReasons(player))
      : (escEligible ? computeEscReasons(player) : []);
  } catch (e) { escReasons = []; }
  return {
    band, domPts, contPts, lqPts, finishPts, progPts, total, homeNation, pass,
    panelEligible, escEligible, escReasons,
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
  const SECTION_H = 40;          // heading + its margins, quick card's rhythm
  const AXIS_H = 48;             // percent scale + "Percentile Rank" caption
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

  // Quick card sizes these at 24px in a 920px column; 21px is the same weight
  // and colour stepped down for a 716px one.
  const heading = (t) => `<div style="font-size:21px;font-weight:800;color:#f3f5f7;margin:8px 0 6px;">${t}</div>`;

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
// Quality was missing, and not because the data was absent: teamRangeBarHtml
// emits ~67px per category, so four categories need ~268px and the tile has 210.
// The fourth simply fell past overflow:hidden with no visible edge to give it
// away. Rather than re-cut the function for this tile, it renders at whatever
// width makes the block fit once scaled uniformly — the same treatment the Style
// panel needed, and it keeps the bars proportioned exactly as the quick card
// draws them.
// 67 was measured off the markup and left the bottom category's Low/Avg/High
// caption clipping against the tile edge. 74 is the same measurement plus the
// row's own bottom margin, which the first estimate didn't account for.
const TC_ROW_H = 74;

function teamContextBody(w, h, player, posKey) {
  const cats = POSITION_TEAM_CONTEXT_CATS[posKey] || POSITION_TEAM_CONTEXT_CATS.CM;
  const tc = player.teamContext || {};
  const n = cats.filter(c => tc[c] != null && TEAM_CONTEXT_BANDS[c]).length;
  if (!n) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;font-size:12px;color:#55617a;">No team data available.</div>`;
  }
  const scale = Math.min(1, h / (n * TC_ROW_H));
  const renderW = Math.round(w / scale);
  return `<div style="position:absolute;inset:0;overflow:hidden;">
      <div style="width:${renderW}px;transform:scale(${scale.toFixed(4)});transform-origin:top left;">
        ${teamRangeBarHtml(player, posKey, renderW)}
      </div>
    </div>`;
}

// Wyscout token -> the short code a scout would write. Same collapsing the pitch
// uses (RAMF and RWF are both RW), except CF stays CF rather than becoming ST —
// on a card the position label reads as a position, not as a pitch slot.
const POS_SHORT = {
  GK: 'GK',
  CB: 'CB', LCB: 'CB', RCB: 'CB',
  LB: 'LB', RB: 'RB', LWB: 'LWB', RWB: 'RWB',
  DMF: 'DM', LDMF: 'DM', RDMF: 'DM',
  CMF: 'CM', LCMF: 'CM', RCMF: 'CM',
  AMF: 'AM',
  RAMF: 'RW', RWF: 'RW', RW: 'RW',
  LAMF: 'LW', LWF: 'LW', LW: 'LW',
  CF: 'CF',
};
const shortPos = (tok) => POS_SHORT[String(tok || '').trim().toUpperCase()] || String(tok || '').trim().toUpperCase();

// Role names carry a trailing position token ("Ball Playing CB", "Target Man CF")
// which is redundant once the player's own position sits beside it — and worse,
// it can disagree with him: a Wide Creator FB role on a player listed RB printed
// "FB". Strip it and use the player's actual translated position instead.
const ROLE_SUFFIX = /\s+(GK|CB|LCB|RCB|FB|LB|RB|LWB|RWB|DM|DMF|CM|CMF|AM|AMF|WNG|LW|RW|ATT|ST|CF)$/i;
const roleBase = (name) => String(name || '').replace(ROLE_SUFFIX, '').trim();

// ─── Position pitch ────────────────────────────────────────────────────────
// A different system to QuickCard's pitchDiagramSvg, which is built for a 390px
// slot on a dark panel. Shrunk to 150px on a coloured band it read as noise:
// thirteen dots, ten of them grey and meaningless, on an opaque #0d1117 box that
// looked pasted onto the gradient.
//
// This draws only the positions the player actually plays, labelled, on a
// transparent outline in the band's own rule colour — so it sits IN the header
// rather than on top of it, and every mark on it carries information. Tier
// colours and the token-to-slot mapping are QuickCard's, so a player reads the
// same on both cards.
const PP_SLOTS = {
  GK:  [100, 270],
  LCB: [56, 226], CB: [100, 232], RCB: [144, 226],
  LB:  [24, 214], RB: [176, 214],
  LWB: [24, 170], RWB: [176, 170],
  DM:  [100, 186], CM: [100, 148], AM: [100, 106],
  LW:  [30, 88], RW: [170, 88],
  ST:  [100, 46],
};
// Landscape equivalents, attacking right. Only used when a heatmap is loaded —
// see positionBlockHtml for why the orientation follows the content.
const PP_SLOTS_H = {
  GK:  [26, 100],
  LCB: [64, 58], CB: [64, 100], RCB: [64, 142],
  LB:  [56, 24], RB: [56, 176],
  LWB: [108, 24], RWB: [108, 176],
  DM:  [104, 100], CM: [148, 100], AM: [196, 100],
  LW:  [224, 30], RW: [224, 170],
  ST:  [264, 100],
};
const PP_TOKEN_TO_SLOT = {
  GK: 'GK', RB: 'RB', RWB: 'RWB', LCB: 'LCB', CB: 'CB', RCB: 'RCB', LB: 'LB', LWB: 'LWB',
  DMF: 'DM', LDMF: 'DM', RDMF: 'DM', LCMF: 'CM', RCMF: 'CM', CMF: 'CM', AMF: 'AM',
  RAMF: 'RW', RWF: 'RW', RW: 'RW', LAMF: 'LW', LWF: 'LW', LW: 'LW', CF: 'ST',
};
const PP_TIERS = { Primary: '#00bf63', Secondary: '#7ed957', Third: '#c1ff72',
                   Fourth: '#ffde59', Fifth: '#ffbd59', Sixth: '#ff914d', Seventh: '#ff3131' };
const PP_TIER_ORDER = ['Primary', 'Secondary', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'];

// Full position names for the stated line. POSITION_LABELS carries these already
// but in "Right Winger (RW)" form; the code is printed separately here so the two
// can be typed differently.
const POS_FULL = {
  GK: 'Goalkeeper', CB: 'Centre Back', LB: 'Left Back', RB: 'Right Back',
  LWB: 'Left Wing Back', RWB: 'Right Wing Back', DM: 'Defensive Midfielder',
  CM: 'Central Midfielder', AM: 'Attacking Midfielder',
  LW: 'Left Winger', RW: 'Right Winger', CF: 'Striker', ST: 'Striker',
};

// Which slots this player occupies, in tier order. Shared by the pitch and the
// editor, so the percentage boxes can only ever appear for slots actually drawn.
export function occupiedSlots(player, manualColors) {
  const out = [];
  if (manualColors && Object.keys(manualColors).length) {
    for (const slot of Object.keys(manualColors)) {
      if (manualColors[slot] && PP_SLOTS[slot]) out.push(slot);
    }
    return out;
  }
  const toks = String(player.position || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  for (const tok of toks) {
    const slot = PP_TOKEN_TO_SLOT[tok];
    if (slot && !out.includes(slot) && out.length < PP_TIER_ORDER.length) out.push(slot);
  }
  return out;
}

function positionPitchSvg(player, w, h, manualColors, pcts, heatmap, heatOpacity) {
  const slots = occupiedSlots(player, manualColors);
  const colourFor = (slot, i) => {
    if (manualColors && manualColors[slot]) return PP_TIERS[manualColors[slot]] || manualColors[slot];
    return PP_TIERS[PP_TIER_ORDER[Math.min(i, PP_TIER_ORDER.length - 1)]];
  };

  const land = !!heatmap;
  const SLOTS = land ? PP_SLOTS_H : PP_SLOTS;
  const VB = land ? [300, 200] : [200, 300];
  const R = land ? 15 : 16;

  const GHOST = 'rgba(255,255,255,0.13)';
  const MARK = 'rgba(255,255,255,0.24)';
  const dots = Object.keys(SLOTS).map(slot => {
    const [x, y] = SLOTS[slot];
    const i = slots.indexOf(slot);
    // With a heatmap behind it the ghost dots are clutter over the data, so only
    // the player's own positions draw.
    if (i < 0) return land ? '' : `<circle cx="${x}" cy="${y}" r="4.5" fill="${GHOST}"/>`;
    const col = colourFor(slot, i);
    const pct = pcts && pcts[slot] != null && pcts[slot] !== '' ? Number(pcts[slot]) : null;
    return `<circle cx="${x}" cy="${y}" r="${R}" fill="${col}" stroke="rgba(0,0,0,0.45)" stroke-width="1.2"/>
      <text x="${x}" y="${y + 4.5}" text-anchor="middle" font-family="Montserrat,sans-serif"
            font-size="11" font-weight="800" fill="#07090f">${slot}</text>${
      pct == null ? '' : `
      <text x="${x}" y="${y + R + 14}" text-anchor="middle" font-family="Montserrat,sans-serif"
            font-size="10.5" font-weight="800" fill="${col}">${Math.round(pct)}%</text>`}`;
  }).join('');

  // The heatmap goes UNDER the markings and the dots, clipped to the pitch
  // rectangle so a slightly-off crop can't bleed past the touchline. Drawn over
  // the same faint white base the tile system uses, so a transparent PNG picks up
  // the header's own colour through it rather than carrying its own green.
  const clipId = `pp-pitch-clip-${land ? 'h' : 'v'}`;
  const heatLayer = heatmap ? `
      <clipPath id="${clipId}"><rect x="1" y="1" width="${VB[0] - 2}" height="${VB[1] - 2}" rx="10"/></clipPath>
      <image href="${heatmap}" x="1" y="1" width="${VB[0] - 2}" height="${VB[1] - 2}"
             preserveAspectRatio="none" opacity="${heatOpacity}" clip-path="url(#${clipId})"/>` : '';

  const marks = land
    ? `<line x1="150" y1="8" x2="150" y2="192"/>
       <circle cx="150" cy="100" r="30"/>
       <rect x="8" y="52" width="42" height="96" rx="2"/>
       <rect x="250" y="52" width="42" height="96" rx="2"/>
       <rect x="8" y="76" width="17" height="48" rx="1"/>
       <rect x="275" y="76" width="17" height="48" rx="1"/>`
    : `<line x1="8" y1="150" x2="192" y2="150"/>
       <circle cx="100" cy="150" r="30"/>
       <rect x="52" y="8" width="96" height="42" rx="2"/>
       <rect x="52" y="250" width="96" height="42" rx="2"/>
       <rect x="76" y="8" width="48" height="17" rx="1"/>
       <rect x="76" y="275" width="48" height="17" rx="1"/>`;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${VB[0]} ${VB[1]}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${VB[0] - 2}" height="${VB[1] - 2}" rx="10"
            fill="rgba(255,255,255,0.045)" stroke="${MARK}" stroke-width="1.5"/>
      ${heatLayer}
      <rect x="1" y="1" width="${VB[0] - 2}" height="${VB[1] - 2}" rx="10"
            fill="none" stroke="${MARK}" stroke-width="1.5"/>
      <g fill="none" stroke="${MARK}" stroke-width="1.5">${marks}</g>
      <circle cx="${VB[0] / 2}" cy="${VB[1] / 2}" r="2.5" fill="${MARK}"/>
      ${dots}
    </svg>`;
}

// Position block: the pitch, plus the position stated in words.
//
// The pair is CENTRED in the slot rather than pinned to its edges. The first
// version put the text hard left at 968 and the pitch hard right at 1259, which
// left ~90px of dead air between two things that belong together and made the
// pitch read as though it had drifted into the GBE column. Text and pitch now sit
// as one group with a fixed 20px gap, centred in the 360px slot, and the pitch is
// sized off the band's depth rather than a guessed number.
const PB_PITCH_H = 112;
const PB_GAP = 20;

function positionBlockHtml(player, x, w, ink, manualColors, pcts, heatmap, heatOpacity) {
  const toks = String(player.position || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  const primary = toks[0] || '';
  const short = shortPos(primary);
  const full = POS_FULL[short] || POSITION_LABELS[primary] || short || '—';
  const others = toks.slice(1).map(shortPos).filter((v, i, a) => v && v !== short && a.indexOf(v) === i);

  // ORIENTATION FOLLOWS THE CONTENT.
  // Upright is right for a position map: thirteen slots need vertical spread and
  // the band is short, and it leaves room to state the position in words.
  // A heatmap is landscape and always will be — every tool that makes one draws
  // it that way — so rotating it to fit an upright box would both distort it and
  // squeeze it into 75px. In heatmap mode the pitch turns landscape instead,
  // which is its natural shape, and gets 168px rather than 75. The text column
  // gives up 16px to pay for it.
  const land = !!heatmap;
  const pitchW = land ? 168 : Math.round(PB_PITCH_H * (200 / 300));   // 168 or 75
  const textW = land ? 160 : 176;

  const groupW = textW + PB_GAP + pitchW;
  const left = x + Math.max(0, Math.round((w - groupW) / 2));
  return `
    <div style="position:absolute;left:${left}px;top:44px;width:${textW}px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:0.14em;color:${ink.muted};
                  white-space:nowrap;">POSITION</div>
      <div style="margin-top:8px;font-size:${land ? 18 : 20}px;font-weight:800;color:${ink.primary};
                  line-height:1.05;white-space:nowrap;">${esc(full)}</div>
      <div style="margin-top:7px;font-size:11px;font-weight:700;letter-spacing:0.08em;
                  color:${ink.soft};white-space:nowrap;">${esc(short)}${
        others.length ? `<span style="color:${ink.muted};font-weight:600;"> &middot; ${esc(others.join(' '))}</span>` : ''
      }</div>
    </div>
    <div style="position:absolute;left:${left + textW + PB_GAP}px;top:19px;
                width:${pitchW}px;height:${PB_PITCH_H}px;">
      ${positionPitchSvg(player, pitchW, PB_PITCH_H, manualColors, pcts, heatmap, heatOpacity)}
    </div>`;
}

// ─── Strengths & Weaknesses ────────────────────────────────────────────────
// Ported from the Streamlit position pages' STYLE_MAP (01_Center_Backs.py et al),
// including the two things that made those pages' output readable and mine not:
//
//  1. The LABELS. "Accurate passes, %" is "Passing Retention", not "Retention",
//     and it differs by position — PAdj Interceptions reads "Interceptions" for
//     a centre back but "Defensive positioning" for a full back or midfielder.
//  2. The EXCLUSIONS. A metric whose sw entry is null is deliberately not
//     eligible: Shots per 90 says nothing about a full back, Smart Passes nothing
//     about a winger, Deep Completions nothing about anyone. Metrics absent from
//     a position's map are equally ineligible. That is why the Streamlit output
//     never claimed a striker was weak at long passing.
//
// HI/LO thresholds are the Streamlit ones verbatim: 70 and 30.
const SW_HI = 70;
const SW_LO = 30;

const SW_LABELS = {
  GK: {
    "Long Passes per 90": null,
    "Passes per 90": "Passing Involvement",
    "Accurate passes, %": "Passing Retention",
  },
  CB: {
    "Defensive duels per 90": "Defensive Duel Attempts",
    "Aerial duels won, %": "Aerial Duels",
    "Defensive duels won, %": "Tackling %",
    "Long Passes per 90": null,
    "PAdj Interceptions": "Interceptions",
    "Accurate forward passes, %": "Forward Passing Accuracy",
    "Dribbles per 90": "Dribble Volume",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Progressive runs per 90": "Progressive Runs",
    "Passes per 90": "Passing Involvement",
    "Accurate passes, %": "Passing Retention",
    "Progressive passes per 90": "Ball progression via passes",
    "Shots blocked per 90": null,
  },
  FB: {
    "Defensive duels per 90": "Defensive Duel Attempts",
    "Aerial duels won, %": "Aerial Duels",
    "Defensive duels won, %": "Tackling %",
    "Long passes per 90": null,
    "xG per 90": "Goal Threat",
    "Shots per 90": null,
    "PAdj Interceptions": "Defensive positioning",
    "Accurate forward passes, %": "Forward Passing Accuracy",
    "Dribbles per 90": "Dribble Volume",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Touches in box per 90": "Penalty-box Coverage",
    "Progressive runs per 90": "Progressive Runs",
    "Passes per 90": "Passing Involvement",
    "Accurate passes, %": "Passing Retention",
    "xA per 90": "Creativity",
    "Passes to penalty area per 90": "Passes to Penalty Area",
    "Deep completions per 90": null,
    "Progressive passes per 90": "Ball progression via passes",
    "Smart passes per 90": null,
  },
  CM: {
    "Defensive duels per 90": "Defensive Duel Attempts",
    "Aerial duels won, %": "Aerial Duels",
    "Defensive duels won, %": "Tackling %",
    "Long Passes per 90": null,
    "Non-penalty goals per 90": "Scoring Goals",
    "xG per 90": "Goal Threat",
    "Shots per 90": null,
    "PAdj Interceptions": "Defensive positioning",
    "Accurate forward passes, %": "Forward Passing Accuracy",
    "Dribbles per 90": "Dribble Volume",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Touches in box per 90": "Penalty-box Coverage",
    "Progressive runs per 90": "Progressive Runs",
    "Passes per 90": "Passing Involvement",
    "Accurate passes, %": "Passing Retention",
    "xA per 90": "Creativity",
    "Passes to penalty area per 90": "Passes to Penalty Area",
    "Deep completions per 90": null,
    "Progressive passes per 90": "Ball progression via passes",
    "Smart passes per 90": null,
  },
  ATT: {
    "Defensive duels per 90": "Defensive Duels",
    "Aerial duels won, %": "Aerial Duels",
    "Aerial duels per 90": null,
    "Non-penalty goals per 90": "Scoring Goals",
    "xG per 90": "Attacking Positioning",
    "Shots per 90": "Shot Volume",
    "Goal conversion, %": "Finishing",
    "Crosses per 90": "Crossing",
    "Dribbles per 90": "Dribble Volume",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Touches in box per 90": "Penalty-box Coverage",
    "Progressive runs per 90": "Progressive Runs",
    "Passes per 90": "Involvement",
    "Accurate passes, %": "Retention",
    "xA per 90": "Creativity",
    "Passes to penalty area per 90": "Passes to Penalty Area",
    "Deep completions per 90": null,
    "Progressive passes per 90": null,
    "Smart passes per 90": null,
  },
  CF: {
    "Defensive duels per 90": "Defensive Duel Attempts",
    "Aerial duels won, %": "Aerial Duels",
    "xG per 90": "Goal Threat",
    "Shots per 90": "Shot Volume",
    "Crosses per 90": null,
    "Dribbles per 90": "Dribble Volume",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Touches in box per 90": "Penalty-box Coverage",
    "Progressive runs per 90": "Progressive Runs",
    "Passes per 90": "Involvement",
    "Accurate passes, %": "Passing Retention",
    "xA per 90": "Creativity",
    "Passes to penalty area per 90": "Passes to Penalty Area",
    "Deep completions per 90": null,
    "Goal conversion, %": "Finishing",
    "Smart passes per 90": null,
  },};

// The pipeline's `g` groups store abbreviated labels ("Pass %"), not the Wyscout
// column names STYLE_MAP is keyed on ("Accurate passes, %"). This maps one to the
// other. Lookups are lowercased because the Streamlit maps are inconsistent about
// capitalising "Long Passes per 90" vs "Long passes per 90".
const G_LABEL_TO_COLUMN = {
  'Crosses': 'Crosses per 90', 'Cross %': 'Accurate crosses, %',
  'Non-penalty goals': 'Non-penalty goals per 90', 'Goals: Non-Penalty': 'Non-penalty goals per 90',
  'xG': 'xG per 90', 'Conversion %': 'Goal conversion, %',
  'xA': 'xA per 90', 'Expected Assists': 'xA per 90',
  'Shots': 'Shots per 90', 'Shot %': 'Shots on target, %',
  'Touches in Box': 'Touches in box per 90', 'Touches in Opposition Box': 'Touches in box per 90',
  'Progressive Runs': 'Progressive runs per 90', 'Accelerations': 'Accelerations per 90',
  'Aerial Duels': 'Aerial duels per 90', 'Aerial Duel %': 'Aerial duels won, %',
  'Defensive Duels': 'Defensive duels per 90', 'Defensive Duel %': 'Defensive duels won, %',
  'PAdj Interceptions': 'PAdj Interceptions', 'PAdj. Interceptions': 'PAdj Interceptions',
  'Shots Blocked': 'Shots blocked per 90',
  'Dribbles': 'Dribbles per 90', 'Dribble %': 'Successful dribbles, %',
  'Deep Completions': 'Deep completions per 90',
  'Passes': 'Passes per 90', 'Pass %': 'Accurate passes, %',
  'Forward Passes': 'Forward passes per 90', 'Forward Pass %': 'Accurate forward passes, %',
  'Long Passes': 'Long passes per 90', 'Long Pass %': 'Accurate long passes, %',
  'Key Passes': 'Key passes per 90', 'Key passes': 'Key passes per 90',
  'Smart Passes': 'Smart passes per 90',
  'Passes to F3rd': 'Passes to final third per 90', 'Passes to F3rd %': 'Accurate passes to final third, %',
  'Passes to Box': 'Passes to penalty area per 90', 'Passes to Box %': 'Accurate passes to penalty area, %',
  'Progressive Passes': 'Progressive passes per 90', 'Prog Pass %': 'Accurate progressive passes, %',
};

// { label, pct } for every metric this position is allowed to be judged on.
function swEligible(sd, posKey) {
  const table = SW_LABELS[posKey] || SW_LABELS.CM;
  const lower = {};
  for (const k of Object.keys(table)) lower[k.toLowerCase()] = table[k];

  const groups = sd.g || {};
  const out = [];
  for (const k of ['A', 'D', 'P']) {
    for (const entry of (groups[k] || [])) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const pct = Number(entry[1]);
      if (isNaN(pct)) continue;
      const col = G_LABEL_TO_COLUMN[entry[0]] || entry[0];
      const label = lower[String(col).toLowerCase()];
      if (!label) continue;              // null or absent = not eligible
      out.push({ label, pct });
    }
  }
  // Best percentile wins per label, same de-dupe the Streamlit pages do.
  const best = {};
  for (const r of out) {
    if (best[r.label] == null || r.pct > best[r.label]) best[r.label] = r.pct;
  }
  return Object.keys(best).map(label => ({ label, pct: best[label] }));
}

function strengthsPanelBody(w, h, sd, posKey) {
  const rows = swEligible(sd, posKey);
  if (!rows.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;font-size:12px;color:#55617a;">No percentile data for this season.</div>`;
  }
  const strengths = rows.filter(r => r.pct >= SW_HI).sort((a, b) => b.pct - a.pct).slice(0, 6);
  const weaknesses = rows.filter(r => r.pct <= SW_LO).sort((a, b) => a.pct - b.pct).slice(0, 3);

  // Strengths as pills — a strength is a claim, and a bar invites the reader to
  // compare five things that are all simply good.
  const strengthsHtml = strengths.length
    ? strengths.map(r => pillHtml(r.label, '#22c55e', 11, 11)).join('')
    : `<span style="font-size:11px;color:#8b98ad;">None above the ${SW_HI}th percentile</span>`;

  // Weaknesses stay as bars, in TeamReport's exact weakness-bar language: 32px
  // rows, label left, figure right in radarColor, 5px track at full width. A
  // weakness needs its magnitude shown — 29th percentile and 4th are different
  // problems, and a pill flattens them into the same statement.
  const BAR_H = 32;
  const weakHtml = weaknesses.length
    ? weaknesses.map((r, i) => `
      <div style="position:absolute;left:0;top:${i * BAR_H}px;width:${w}px;height:${BAR_H - 8}px;">
        <span style="position:absolute;left:0;right:40px;top:0;font-size:11.5px;font-weight:600;
                     color:#c8d2e0;white-space:nowrap;overflow:hidden;">${esc(r.label)}</span>
        <span style="position:absolute;right:0;top:-1px;font-size:13px;font-weight:800;
                     color:${radarColor(r.pct)};">${Math.round(r.pct)}</span>
        <div style="position:absolute;left:0;right:0;top:17px;height:5px;border-radius:3px;
                    background:rgba(255,255,255,0.08);overflow:hidden;">
          <div style="width:${Math.max(2, Math.min(100, r.pct))}%;height:100%;
                      background:${radarColor(r.pct)};border-radius:3px;"></div>
        </div>
      </div>`).join('')
    : `<span style="font-size:11px;color:#8b98ad;">None below the ${SW_LO}th percentile</span>`;

  const WEAK_TOP = 92;
  return `<div style="position:absolute;inset:0;">
      <div style="position:absolute;left:0;top:0;width:${w}px;">
        <div style="font-size:8.5px;font-weight:700;letter-spacing:0.14em;color:#6f7c92;">STRENGTHS</div>
        <div style="margin-top:9px;">${strengthsHtml}</div>
      </div>
      <div style="position:absolute;left:0;top:${WEAK_TOP}px;width:${w}px;">
        <div style="font-size:8.5px;font-weight:700;letter-spacing:0.14em;color:#6f7c92;">WEAKNESSES</div>
        <div style="position:relative;margin-top:11px;height:${h - WEAK_TOP - 24}px;">${weakHtml}</div>
      </div>
    </div>`;
}

// ─── Potential Clubs UK ────────────────────────────────────────────────────
// Row geometry ported line for line from TeamReport's Similar Teams panel —
// same 9px card, same #n index at 10px, same 26px crest at x=32, same 68px text
// column, same 50px centred value column with its caption underneath. Only the
// caption word changes, because these are fit scores rather than match scores.
function clubsPanelBody(w, h, rows, coreOnly, mode, hideScores) {
  const isPlayers = mode === 'players';
  if (!rows || !rows.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;font-size:12px;color:#55617a;text-align:center;">
              ${isPlayers ? 'No comparable UK players' : 'No UK club fits'} —
              the position pool isn't loaded.</div>`;
  }
  const shown = rows.slice(0, 3);
  const note = (!isPlayers && coreOnly && !hideScores);
  const rowH = Math.floor((h - (note ? 14 : 0) - 4) / shown.length);
  const VAL_W = hideScores ? 0 : 50;
  const body = shown.map((t, i) => {
    const figure = isPlayers ? t.simPct : t.finalFit;
    const col = gradeColor(figure);
    const crest = teamCrest(t.team);
    const title = isPlayers ? t.name : t.team;
    // A player row's second line is his club and league; a club row's is just the
    // league. Both stay one nowrap line so nothing wraps into the crest.
    const sub = isPlayers
      ? [t.team, leagueDisplayName(t.league) || t.league].filter(Boolean).join(' · ')
      : (leagueDisplayName(t.league) || t.league);
    return `
      <div style="position:absolute;left:0;top:${i * rowH + 2}px;width:${w}px;height:${rowH - 6}px;
                  background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);
                  border-radius:9px;">
        <span style="position:absolute;left:10px;top:50%;margin-top:-6px;font-size:10px;
                     font-weight:700;color:#475569;">#${i + 1}</span>
        ${crest ? `<div style="position:absolute;left:32px;top:50%;margin-top:-13px;width:26px;height:26px;
                     background-image:url('${src(crest)}');background-size:contain;
                     background-repeat:no-repeat;background-position:center;"></div>` : ''}
        <div style="position:absolute;left:68px;right:${VAL_W + 18}px;top:50%;margin-top:-15px;">
          <div style="font-size:13px;font-weight:700;color:#eaf0f8;line-height:1.15;white-space:nowrap;
                      ">${esc(title)}</div>
          <div style="font-size:10px;color:#8b98ad;margin-top:4px;line-height:1.15;white-space:nowrap;
                      overflow:hidden;">${esc(sub)}</div>
        </div>
        ${hideScores ? '' : `
        <div style="position:absolute;right:10px;top:50%;margin-top:-15px;width:${VAL_W}px;
                    text-align:center;">
          <div style="font-size:15px;font-weight:800;color:${figure == null ? '#475569' : col};line-height:1.05;">${
            figure == null ? '—' : `${Math.round(figure)}${isPlayers ? '%' : ''}`}</div>
          <div style="font-size:7.5px;font-weight:600;letter-spacing:0.06em;color:#55617a;
                      margin-top:3px;line-height:1;">${isPlayers ? 'match' : 'fit'}</div>
        </div>`}
      </div>`;
  }).join('');

  // Stated on the card, not just in the editor. Without the peak-fit blend the
  // number is the core alone and reads a few points high — anyone comparing this
  // against ScoutBoard deserves to know which of the two they are looking at.
  // Pointless when the figures are hidden, so it only draws alongside them.
  return `<div style="position:absolute;inset:0;overflow:hidden;">${body}${
    note ? `<div style="position:absolute;left:0;bottom:0;font-size:8px;font-weight:700;
                   letter-spacing:0.14em;color:#475569;">CORE FIT ONLY — CLUB SIMILARITY NOT LOADED</div>` : ''
  }</div>`;
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
    showPitch, isGK, positionPcts, heatmapDataUrl, heatOpacity,
  } = opts;

  const spec = headerColour;
  const ink = headerInk(spec);
  const displayName = (nameOverride && nameOverride.trim()) || player.name;
  const displayTeam = (teamOverride && teamOverride.trim()) || team;
  const photo = opts.uploadedPhotoDataUrl || photoUrl(player.name, player.team);
  const crest = teamCrest(team);
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

    <!-- Player photo takes the crest's box. No circle, no ring, no fill plate:
         the repo's cut-outs already have transparent backgrounds, so a disc
         behind one just prints a grey coin around the player's shoulders. The
         image sits straight on the band and the gradient shows through. Still
         cover-cropped from the top, because a centred crop on a head-and-
         shoulders portrait cuts the chin off. -->
    <div style="position:absolute;left:${PAD}px;top:19px;width:112px;height:112px;
                background-image:url('${src(photo)}');background-size:cover;
                background-position:center top;background-repeat:no-repeat;"></div>

    <div style="position:absolute;left:${NAME_X}px;top:14px;width:${NAME_MAX_W}px;height:56px;
                display:flex;align-items:flex-end;overflow:hidden;">
      <div style="font-size:${fitNameSize(displayName, NAME_MAX_W)}px;font-weight:800;letter-spacing:-0.8px;
                  line-height:1.0;color:${ink.primary};white-space:nowrap;">${esc(displayName)}</div>
    </div>

    <!-- club crest, club, league badge, league flag, league. The crest leads:
         it is the fastest identifier on the row and TeamReport puts the badge
         first for the same reason. -->
    <div style="position:absolute;left:${NAME_X}px;top:76px;display:flex;align-items:center;
                white-space:nowrap;">
      ${crest ? `<div style="width:24px;height:24px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${src(crest)}');"></div>` : ''}
      <span style="font-size:21px;font-weight:700;color:${ink.secondary};${crest ? 'margin-left:10px;' : ''}">${esc(truncateText(displayTeam, 18))}</span>
      ${logo ? `<div style="width:21px;height:21px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${src(logo)}');margin-left:14px;"></div>` : ''}
      ${flag ? `<div style="width:26px;height:16px;flex-shrink:0;background-size:cover;
                  background-position:center;border-radius:2px;margin-left:8px;
                  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);
                  background-image:url('${src(flag)}');"></div>` : ''}
      <span style="font-size:14px;font-weight:600;color:${ink.muted};margin-left:8px;">${esc(leagueDisplayName(league) || league)}</span>
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

    <!-- Position, in the trend line's slot: stated in words, with an upright
         pitch beside it. -->
    ${showPitch ? positionBlockHtml(player, PITCH_X, PITCH_W, ink, positionColors, positionPcts, heatmapDataUrl, heatOpacity) : `
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

    <!-- GBE in the coach profile's slot, as four tiles.
         Bare statRows on a gradient had no edges, so four labels and four
         figures floated in the band with nothing holding them together and read
         as scruff. Each component now sits in its own bordered tile — same
         1px rule, same 8px radius and same faint white fill as the panels below,
         so the block belongs to the card's tile system rather than being loose
         type on a gradient. Four across at 127px fills the 538px slot exactly.
         Tiles run 54..116, inside the 28..128 band rules. -->
    <div style="position:absolute;left:${GBE_X}px;top:26px;width:${GBE_W}px;height:20px;">
      <span style="position:absolute;left:0;top:5px;width:150px;font-size:8px;font-weight:700;
                   letter-spacing:0.14em;color:${ink.muted};white-space:nowrap;">GBE CALCULATION</span>
      <span style="position:absolute;right:0;top:0;display:flex;align-items:center;white-space:nowrap;">
        ${gbe.homeNation ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:${ink.muted};margin-right:14px;">AUTO PASS &middot; HOME NATION</span>` : ''}
        ${gbe.panelEligible ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:#f0c56a;margin-right:14px;">EXCEPTIONS PANEL</span>` : ''}
        ${gbe.escEligible ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:#f97316;margin-right:14px;white-space:nowrap;">&#9889; ESC ELIGIBLE${
                       gbe.escReasons.length ? ` &middot; ${esc(String(gbe.escReasons[0]).toUpperCase())}` : ''}</span>` : ''}
        <span style="font-size:16px;font-weight:800;color:${ink.primary};">${gbe.total}</span>
        <span style="font-size:8px;font-weight:700;letter-spacing:0.13em;color:${ink.muted};
                     margin-left:6px;">PTS</span>
        <span style="margin-left:13px;font-size:11px;font-weight:800;color:${gbe.colour};
                     background:${gbe.colour}22;border:1px solid ${gbe.colour};border-radius:5px;
                     padding:3px 12px;">${gbe.status}</span>
      </span>
    </div>
    ${(() => {
      const TW = 127, TG = 10;
      return [['DOMESTIC', gbe.domPts, 12], ['CONTINENTAL', gbe.contPts, 8],
              ['LEAGUE BAND', gbe.lqPts, 12], ['FINISH / PROG', gbe.finishPts + gbe.progPts, 10]]
        .map(([label, val, max], i) => {
          const pct = Math.max(0, Math.min(100, (val / max) * 100));
          return `
        <div style="position:absolute;left:${GBE_X + i * (TW + TG)}px;top:54px;width:${TW}px;height:62px;
                    box-sizing:border-box;padding:9px 11px;border-radius:8px;
                    border:1px solid ${ink.rule};background:rgba(255,255,255,0.05);">
          <div style="font-size:7.5px;font-weight:700;letter-spacing:0.13em;color:${ink.muted};
                      white-space:nowrap;">${label}</div>
          <div style="margin-top:7px;font-size:17px;font-weight:800;color:${ink.primary};
                      line-height:1;white-space:nowrap;">${val}<span
              style="font-size:11px;font-weight:600;color:${ink.muted};">/${max}</span></div>
          <div style="margin-top:8px;height:4px;border-radius:2px;background:${ink.track};overflow:hidden;">
            <div style="width:${pct.toFixed(0)}%;height:100%;background:${ink.secondary};border-radius:2px;"></div>
          </div>
        </div>`;
        }).join('');
    })()}`;
}

// ─── Image preload ─────────────────────────────────────────────────────────
// Four remote references only — nothing like TeamReport's ~16 — but the same
// treatment, because html-to-image refetches every remote image on each of the
// two render passes and a cold GitHub fetch is slower than the render.
export function pagerImageUrls(player, ctx, uploadedPhotoDataUrl, clubRows = []) {
  const urls = [
    uploadedPhotoDataUrl ? '' : photoUrl(player.name, player.team),
    leagueLogo(ctx.league),
    leagueFlag(ctx.league),
    teamCrest(ctx.team),
  ];
  const iso = countryToIso2(player.birthCountry);
  if (iso) urls.push(`https://flagcdn.com/w80/${iso}.png`);
  // Potential Clubs crests. Without these they would be the only remote
  // references left in the render and would blank out in the export.
  for (const r of (clubRows || [])) urls.push(teamCrest(r.team));
  return [...new Set(urls.filter(u => u && !u.startsWith('data:')))];
}

// ───────────────────────────────────────────────────────────────────────────
export function buildPlayerPagerElement(player, opts = {}) {
  const {
    images = {}, headerColourName = 'Default', seasonOverride = '',
    nameOverride = '', teamOverride = '', uploadedPhotoDataUrl = '',
    viewText = '', clubRows = [], clubsCoreOnly = true,
    clubsMode = 'clubs', hideFitScores = false,
    showForecast = false, useBestRoleCareer = false, showPitch = true,
    positionColors = {}, positionPcts = {}, gbeOv = {}, improveNotes = [],
    heatmapDataUrl = '', heatOpacity = 0.9,
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

  // Style. TeamReport's own hex chart, called with the player's role scores in
  // place of a club's style axes. The previous version scaled QuickCard's
  // lollipop chart down to fit, which meant this tile alone was speaking the
  // quick card's visual language while every other tile spoke TeamReport's.
  // styleHexSvg flexes its own row height to the box, so no scaling is needed.
  const qcRoles = player.qcRoleCareerScores || player.qcLatestRoles || player.roleCareerScores;
  // "Ball Playing CB" -> "Ball Playing · CB", where the CB is the PLAYER's
  // translated position rather than the role string's own suffix, so a RAMF
  // reads RW and a role whose suffix disagrees with the player can't print a
  // position he doesn't play.
  const posShort = shortPos(rawTok);
  const roleRows = qcRoles && Object.keys(qcRoles).length
    ? Object.entries(qcRoles)
        .map(([k, v]) => [`${roleBase(k)}${posShort ? `  ${posShort}` : ''}`, Number(v) || 0])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : [];
  const rolesHtml = roleRows.length
    // 156 was sized for Team Report's one-word style axes. "Chance Creator CF"
    // is half as long again, so the hexes have to move right by the same amount
    // or the gap between text and chart closes up on the longest row.
    ? `<div style="position:absolute;left:0;top:2px;">${styleHexSvg(roleRows, innerW, row1InnerH, 205)}</div>`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;
                   justify-content:center;font-size:12px;color:#55617a;">No role scores.</div>`;

  container.innerHTML = `
    <div id="pp-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(player, ctx, {
        headerColour: HEADER_COLOURS[headerColourName], nameOverride, teamOverride,
        uploadedPhotoDataUrl, positionColors, gbeOv, showPitch, isGK, positionPcts, heatmapDataUrl, heatOpacity,
      })}

      ${panel({
        x: PAD, y: BODY_TOP, w: LEFT_W, h: LEFT_H,
        title: 'Performance',
        // Season, club, league and the pool the percentiles are against. Without
        // the last two a reader can't tell whether 80th percentile means 80th of
        // Cyprus 1. strikers or of Premier League ones, which is the whole
        // meaning of the column.
        right: [ctx.seasonKey, ctx.team, ctx.league].filter(Boolean).join(' · ')
               + (posKey ? ` vs ${posKey}'s` : ''),
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
        body: teamContextBody(innerW, row2InnerH, player, posKey),
      })}
      ${panel({
        x: COL_B_X, y: ROW_2, w: COL_W, h: ROW2_H, title: 'Strengths & Weaknesses',
        body: strengthsPanelBody(innerW, row2InnerH, sd, posKey),
      })}

      ${panel({
        x: COL_A_X, y: ROW_3, w: COL_W, h: ROW3_H,
        title: clubsMode === 'players' ? 'Similar Players UK' : 'Potential Clubs UK',
        body: clubsPanelBody(innerW, row3InnerH, clubRows, clubsCoreOnly, clubsMode, hideFitScores),
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
  const [positionPcts, setPositionPcts] = useState({});
  const [heatmapDataUrl, setHeatmapDataUrl] = useState('');
  const [heatOpacity, setHeatOpacity] = useState(90);
  const [gbeOv, setGbeOv] = useState({});
  const [showGbeEdit, setShowGbeEdit] = useState(false);

  const [clubsMode, setClubsMode] = useState('clubs');   // clubs | players
  const [hideFitScores, setHideFitScores] = useState(false);
  // null = auto (whatever the model ranks). An array = the user has taken over,
  // and is authoritative including its order.
  const [manualRows, setManualRows] = useState(null);
  const [rowQuery, setRowQuery] = useState('');

  const [peakFit, setPeakFit] = useState(null);
  const [peakState, setPeakState] = useState('idle');   // idle | loading | ok | none

  const ctx = useMemo(() => resolveSeason(player, seasonOverride), [player, seasonOverride]);

  // Only the slots actually drawn on the pitch get a box, so a percentage can
  // never be entered against a position the card doesn't show.
  const pagerSlots = useMemo(() => occupiedSlots(player, {}), [player]);
  const pctTotal = useMemo(
    () => pagerSlots.reduce((a, k) => a + (Number(positionPcts[k]) || 0), 0),
    [pagerSlots, positionPcts]);

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

  const autoRows = useMemo(() => {
    try {
      return clubsMode === 'players'
        ? computeSimilarPlayers(player, players || [], { ukOnly: true, topN: 8 })
        : computeClubFit(player, players || [], { ukOnly: true, topN: 8, peakFitByTeam: peakFit });
    } catch (e) {
      console.error('[PlayerPager] ranking failed:', e);
      return [];
    }
  }, [player, players, peakFit, clubsMode]);

  // Switching mode drops a manual list built for the other one — a club list is
  // not a player list, and silently carrying it across would print clubs under a
  // "Similar Players" heading.
  useEffect(() => { setManualRows(null); setRowQuery(''); }, [clubsMode]);

  const clubRows = manualRows || autoRows.slice(0, 3);

  // Ranked candidates first, then ANY club in the data. Restricting the picker to
  // the model's own shortlist meant a club you actually wanted to put on the card
  // was unreachable if the model hadn't ranked it — which defeats the point of a
  // manual override. Clubs found by search carry no fit figure, and the row prints
  // a dash rather than inventing one; with scores hidden the distinction vanishes
  // and any club can be listed freely.
  const rowChoices = useMemo(() => {
    const q = rowQuery.trim().toLowerCase();
    const key = (r) => (clubsMode === 'players' ? `${r.name}|${r.team}` : r.team);
    const chosen = new Set((manualRows || []).map(key));
    const ranked = autoRows
      .filter(r => !chosen.has(key(r)))
      .filter(r => !q || String(clubsMode === 'players' ? r.name : r.team).toLowerCase().includes(q)
                     || String(r.team || '').toLowerCase().includes(q));
    if (clubsMode === 'players' || q.length < 2) return ranked.slice(0, 8);
    const seen = new Set(ranked.map(r => r.team));
    const extra = teamOptions(players || [], rowQuery, 20)
      .filter(t => !seen.has(t.team) && !chosen.has(t.team))
      .map(t => ({ team: t.team, league: t.league, finalFit: null, unranked: true }));
    return [...ranked, ...extra].slice(0, 10);
  }, [autoRows, manualRows, rowQuery, clubsMode, players]);

  const buildOpts = () => ({
    headerColourName, seasonOverride, nameOverride, teamOverride,
    uploadedPhotoDataUrl, viewText, clubRows,
    clubsMode, hideFitScores, positionPcts,
    heatmapDataUrl, heatOpacity: Number(heatOpacity) / 100,
    clubsCoreOnly: !peakFit,
    showForecast, useBestRoleCareer, showPitch, gbeOv,
  });

  const handleDownload = async () => {
    setDownloading(true); setProgress('Loading images…'); setError('');
    let el = null;
    try {
      const { toPng } = await import('html-to-image');
      const urls = pagerImageUrls(player, ctx, uploadedPhotoDataUrl, clubRows);
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
            <span style={UI.label}>Bottom-left panel</span>
            <div style={{ display: 'flex', marginBottom: 8 }}>
              {[['clubs', 'Potential Clubs'], ['players', 'Similar Players']].map(([v, lbl], i) => (
                <button key={v} onClick={() => setClubsMode(v)}
                  style={{ flex: 1, padding: '6px 0', marginLeft: i ? 6 : 0, borderRadius: 5,
                           border: `1px solid ${clubsMode === v ? '#3b7de8' : '#1e2d45'}`,
                           background: clubsMode === v ? '#0e2040' : 'transparent',
                           color: clubsMode === v ? '#60a5fa' : '#94a3b8',
                           fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
              ))}
            </div>

            <div style={UI.block}>
            <span style={UI.label}>Heatmap (optional)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ flex: 1, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                              padding: '7px 10px', borderRadius: 5, textAlign: 'center',
                              border: `1px solid ${heatmapDataUrl ? '#3b7de8' : '#1e2d45'}`,
                              background: heatmapDataUrl ? '#0e2040' : 'transparent',
                              color: heatmapDataUrl ? '#60a5fa' : '#8b98ad' }}>
                {heatmapDataUrl ? 'Heatmap loaded ✓' : 'Upload heatmap'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files && e.target.files[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = ev => setHeatmapDataUrl(String(ev.target.result));
                    r.readAsDataURL(f);
                    e.target.value = '';
                  }} />
              </label>
              {heatmapDataUrl && (
                <button onClick={() => setHeatmapDataUrl('')}
                  style={{ padding: '7px 10px', background: 'none', border: '1px solid #1e2d45',
                           borderRadius: 5, color: '#f87171', fontSize: 11, cursor: 'pointer' }}>✕</button>
              )}
            </div>
            {heatmapDataUrl && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 7 }}>
                <span style={{ fontSize: 10.5, color: '#94a3b8', width: 54, flexShrink: 0 }}>Opacity</span>
                <input type="range" min="30" max="100" value={heatOpacity}
                  onChange={e => setHeatOpacity(e.target.value)}
                  style={{ flex: 1, accentColor: '#3b7de8' }} />
                <span style={{ fontSize: 10.5, color: '#64748b', width: 34, textAlign: 'right' }}>{heatOpacity}%</span>
              </div>
            )}
            <div style={UI.note}>
              {heatmapDataUrl
                ? 'Pitch switches to landscape — a heatmap is landscape, and rotating it would distort it.'
                : 'Export it with a transparent background: the header colour then shows through instead of the heatmap carrying its own green.'}
            </div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Position split (optional)</span>
            {pagerSlots.length ? (
              <>
                {pagerSlots.map(slot => (
                  <div key={slot} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ width: 44, flexShrink: 0, fontSize: 11, fontWeight: 800,
                                   color: '#93c5fd' }}>{slot}</span>
                    <input value={positionPcts[slot] ?? ''} inputMode="numeric" placeholder="—"
                      onChange={e => {
                        const v = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
                        setPositionPcts(o => {
                          const n = { ...o };
                          if (v === '') delete n[slot]; else n[slot] = v;
                          return n;
                        });
                      }}
                      style={{ ...UI.input, width: 70, flex: '0 0 auto' }} />
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                      % of minutes
                    </span>
                  </div>
                ))}
                <div style={UI.note}>
                  {pctTotal === 0
                    ? 'Blank leaves the pitch unlabelled.'
                    : `${pctTotal}% assigned${pctTotal > 100 ? ' — over 100' : ''}`}
                </div>
              </>
            ) : (
              <div style={UI.note}>No recognised position tokens for this player.</div>
            )}
          </div>

          <Check label={clubsMode === 'players' ? 'Hide match % beside players' : 'Hide fit score beside clubs'}
                   value={hideFitScores} onChange={setHideFitScores} />

            {poolSize < 50 && (
              <div style={{ ...note, color: '#fbc701', background: 'rgba(251,199,1,0.08)',
                            border: '1px solid rgba(251,199,1,0.25)' }}>
                Only {poolSize} {group || 'matching'} players loaded — this ranks against
                the position group in memory.
              </div>
            )}

            <span style={{ ...UI.label, marginTop: 4 }}>
              Shown {manualRows ? '(manual)' : '(auto — top 3)'}
              {manualRows && (
                <button onClick={() => { setManualRows(null); setRowQuery(''); }}
                  style={{ marginLeft: 8, background: 'transparent', border: '1px solid #1e2d45',
                           borderRadius: 4, color: '#60a5fa', fontSize: 9, padding: '1px 5px',
                           cursor: 'pointer' }}>back to auto</button>
              )}
            </span>

            {clubRows.map((r, i) => {
              const label = clubsMode === 'players' ? r.name : r.team;
              const figure = clubsMode === 'players' ? r.simPct : r.finalFit;
              return (
                <div key={label + i}
                     style={{ display: 'flex', alignItems: 'center', marginBottom: 5,
                              background: '#0d1220', border: '1px solid #1e2d45',
                              borderRadius: 6, padding: '5px 8px' }}>
                  <span style={{ width: 16, flexShrink: 0, fontSize: 10, color: '#475569' }}>#{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: '#e2e8f4',
                                 overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {label}
                    {clubsMode === 'players' && <span style={{ color: '#64748b' }}> · {r.team}</span>}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800,
                                 color: figure == null ? '#475569' : '#60a5fa', marginLeft: 8 }}>
                    {figure == null ? '—' : Math.round(figure)}
                  </span>
                  <button onClick={() => setManualRows(clubRows.filter((_, j) => j !== i))}
                    style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#64748b',
                             cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              );
            })}

            {clubRows.length < 3 && (
              <>
                <input value={rowQuery} onChange={e => setRowQuery(e.target.value)}
                       placeholder={clubsMode === 'players' ? 'Add a player…' : 'Add a club…'}
                       style={{ ...UI.input, marginTop: 4 }} />
                {rowChoices.map((r, i) => {
                  const label = clubsMode === 'players' ? r.name : r.team;
                  const figure = clubsMode === 'players' ? r.simPct : r.finalFit;
                  return (
                    <div key={label + i}
                         onClick={() => { setManualRows([...clubRows, r]); setRowQuery(''); }}
                         style={{ display: 'flex', alignItems: 'center', cursor: 'pointer',
                                  padding: '5px 8px', borderBottom: '1px solid #101a2c' }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#c8d2e0',
                                     overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {label}
                        {clubsMode === 'players' && <span style={{ color: '#64748b' }}> · {r.team}</span>}
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700,
                                     color: figure == null ? '#475569' : '#8b98ad', marginLeft: 8 }}>
                        {figure == null ? 'add' : Math.round(figure)}
                      </span>
                    </div>
                  );
                })}
                {!rowChoices.length && <div style={UI.note}>
                  {rowQuery.trim().length < 2 ? 'Type to search any club.' : 'No match.'}
                </div>}
              </>
            )}

            {clubsMode === 'clubs' && peakState === 'ok' && (
              <div style={{ ...UI.note, color: '#4ade80' }}>Club similarity loaded — full blended fit.</div>
            )}
            {clubsMode === 'clubs' && peakState !== 'ok' && (
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
