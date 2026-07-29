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
  styleHexSvg, gradeColor, radarColor, teamOptions, personFlagUrl, nameEmWidth,
  foldIncludes,
  HEADER_COLOURS, HEADER_COLOUR_NAMES,
} from './TeamReport';
import { fadeHexToBG, countryToIso2 } from './CoachCard';
import {
  careerTrajectorySvg, teamRangeBarHtml,
  scoreTierColor, barRow,
  TOKEN_TO_POS_KEY, POSITION_LABELS, METRIC_LABEL_MAP,
  POSITION_TEAM_CONTEXT_CATS, TEAM_CONTEXT_BANDS, computeEscReasons, ESC_REASON_OPTIONS,
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

// Pushed right to clear the bigger photo, which now runs 14..158.
const NAME_X = 172;
// 410 was TeamReport's, sized for club names. Player names run longer
// ("Alexander-Arnold"), so the identity block takes 66px back off the wheel
// span — two wheels never needed 372, and moving them right also opens the gap
// between the rings and the rule.
const NAME_MAX_W = 462;
const RULE_1 = 644;
// 1338 gave GBE the whole 538px coach slot and left the position block 360px for
// a 188px pitch plus two position names. "Defensive Midfielder" is ~190px at 19px
// nowrap, so it ran straight out of its 138px column and across the pitch.
// GBE does not need 538: four small counters fit two-up in 432, which hands 106px
// back to the block that actually needed it.
const RULE_2 = 1444;
const WHEEL_X = 650;
const WHEEL_W = 296;
const RULE_MID = 946;
const PITCH_X = 968;                     // TeamReport's trend slot
const PITCH_W = 466;
const HDR_LABEL_Y = 114;
const GBE_X = 1464;
const GBE_W = 432;

// FONT WEIGHTS. MONTSERRAT_EMBED_CSS carries 400/500/600/700/900 and no 800, so
// anything asking for 800 was being synthesised as a faux-bold off the 700 face —
// invisible at 8px captions, obvious on a 52px name, and the reason the header
// didn't match the quick card. Every weight used here is one that exists in the
// embed. QuickCard's own name is 700, which is now what this uses.

// ─── Palette — same values as TeamReport/QuickCard ─────────────────────────
// The app-wide photo fallback. utils.js's <Photo> swaps to it on error, and the
// scouting card sets it on 404 — same file, so a player with no picture looks the
// same everywhere.
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
  const SECTION_H = 42;          // 23px heading at 1.2 + 8/6 margins, measured
  // Measured: axis row 22px + Avg sub-label 14px + caption 20px + margins ~= 68.
  // Under-reserving sheared the caption; over-reserving left a band of dead space.
  const AXIS_H = 68;
  const budget = h - AXIS_H - activeSections * SECTION_H;
  // Cap was a flat 34, which suited an outfielder's ~28 rows but left a keeper's
  // ten sitting in the top half of an 815px column with 300px of dead space under
  // them. The ceiling now scales with how many rows there are, so a short list
  // spreads out instead of bunching at the top.
  const maxRowH = totalRows <= 12 ? 62 : totalRows <= 18 ? 46 : 34;
  // Fractional, not floored. Flooring 20.7 to 19 threw away 0.7px on every one of
  // thirty rows — 21px of dead space at the foot of the column — and the leftover
  // was too small to redistribute as an integer gap. CSS takes decimal px happily,
  // so the rows now divide the budget exactly. The -2 keeps the caption clear of
  // the overflow edge.
  const rowH = Math.max(8, Math.min(maxRowH, (budget - 2) / totalRows - 1));
  const extraGap = 0;

  const bars = (k) => (groups[k] || []).map(([label, pct, val]) => {
    const display = METRIC_LABEL_MAP[label] || label;
    const isPct = /%/.test(display);
    const n = typeof val === 'number' ? val : parseFloat(val);
    const shown = !isNaN(n) ? n.toFixed(isPct ? 1 : 2) : val;
    return barRow(display, pct, shown, Number(rowH.toFixed(2)), extraGap);
  }).join('');

  // Quick card sizes these at 24px in a 920px column; 21px is the same weight
  // and colour stepped down for a 716px one.
  const heading = (t) => `<div style="font-size:23px;font-weight:700;color:#f3f5f7;margin:8px 0 6px;">${t}</div>`;

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
// Measured off the markup, twice adjusted: 67 ignored the row's bottom margin, 74
// still sheared the last category's Low/Avg/High caption by a couple of pixels.
// 80 is deliberately generous — over-reserving costs a slightly smaller chart,
// under-reserving costs a clipped caption, and only one of those looks broken.
const TC_ROW_H = 80;

function teamContextBody(w, h, player, posKey, sd) {
  const cats = POSITION_TEAM_CONTEXT_CATS[posKey] || POSITION_TEAM_CONTEXT_CATS.CM;
  // Season context if the pipeline stored any for this season, else the player's
  // own. A 2025 export was describing the 2026 club otherwise — and for a player
  // who moved, that is a different club entirely.
  const tc = (sd && sd.teamContext && Object.keys(sd.teamContext).length)
    ? sd.teamContext : (player.teamContext || {});
  const n = cats.filter(c => tc[c] != null && TEAM_CONTEXT_BANDS[c]).length;
  if (!n) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;font-size:12px;color:#55617a;">No team data available.</div>`;
  }
  const scale = Math.min(1, h / (n * TC_ROW_H));
  const renderW = Math.round(w / scale);
  return `<div style="position:absolute;inset:0;overflow:hidden;">
      <div style="width:${renderW}px;transform:scale(${scale.toFixed(4)});transform-origin:top left;">
        ${teamRangeBarHtml({ ...player, teamContext: tc }, posKey, renderW)}
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

// Roles that shouldn't carry the position tag, because the name already says a
// position and the tag then contradicts or repeats it: "Attacking Midfielder CM"
// reads as two different answers to the same question, "DLP CM" is an
// abbreviation stapled to an abbreviation.
//
// Two rules rather than one list, so new roles behave sensibly without an edit:
// any role whose name contains a positional noun is caught automatically, and a
// short explicit set covers the established abbreviations that don't contain one.
const ROLE_POSITIONAL_WORD = /\b(Midfielder|Forward|Winger|Back|Keeper|Striker|Defender)\b/i;
const ROLE_NO_TAG = new Set(['DLP', 'Controller', 'Regista', 'Libero', 'Enganche']);
const roleWantsTag = (base) =>
  !ROLE_NO_TAG.has(base) && !ROLE_POSITIONAL_WORD.test(base);

// "Denmark 2." -> "DEN2". The full league name is redundant beside the flag and
// the league badge, and at 14px it was the widest thing on the row.
export function leagueAbbrev(league) {
  const t = String(league || '').trim();
  const m = t.match(/^(.*?)\s*(\d+)\.?$/);
  if (!m) return t.toUpperCase().slice(0, 5);
  const country = m[1].replace(/[^A-Za-z ]/g, '').trim();
  return `${country.slice(0, 3).toUpperCase()}${m[2]}`;
}

const cmToFeet = (cm) => {
  const n = Number(cm);
  if (!n || isNaN(n)) return null;
  const inches = Math.round(n / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};

// ─── Heatmap extraction ────────────────────────────────────────────────────
// Heatmaps arrive as opaque PNGs with a pitch baked in — a flat pale green plus
// white lines. Compositing that onto the header can't work: mix-blend-mode is
// exactly the sort of CSS property this render pipeline drops silently, so it
// would look right on screen and break in the export.
//
// So the background is removed at upload time instead, on a canvas, before the
// image ever reaches the card. The test is warmth: heat runs yellow -> red, all
// of which have red far above blue, while pale green (206,230,196) and white
// lines (255,255,255) have red and blue nearly equal. Alpha therefore comes from
// (R-B), squared so the faint wash at the edges falls away faster than the hot
// core, leaving the blobs on transparency with the pitch and its lines gone.
//
// The card then draws its OWN pitch underneath in the header's palette, which is
// what makes the heat sit in the design rather than on top of it.
export function extractHeat(dataUrl) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 1000;
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          const g = c.getContext('2d');
          g.drawImage(img, 0, 0, c.width, c.height);
          const data = g.getImageData(0, 0, c.width, c.height);
          const px = data.data;
          for (let i = 0; i < px.length; i += 4) {
            const warmth = (px[i] - px[i + 2]) / 130;      // red over blue
            const a = Math.max(0, Math.min(1, warmth));
            px[i + 3] = Math.round(255 * a * a);
          }
          g.putImageData(data, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (e) { resolve(dataUrl); }   // tainted canvas etc — use it raw
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch (e) { resolve(dataUrl); }
  });
}

// Score -> the badge of the English tier that score corresponds to. The cut-offs
// are the career chart's own (CAREER_LEAGUE_BANDS) so the badge and the chart's
// dashed lines can't disagree.
//
// T5L is deliberately absent. It's a chart band meaning "top-five-league level",
// which has no single crest to show — a player at 70 sits above the Championship
// and below the Premier League, and this resolves him to the Championship badge:
// the highest tier he'd certainly hold down, rather than one he might not.
const TIER_LEAGUE = [
  [72, 'England 1.'], [61, 'England 2.'], [57, 'England 3.'],
  [54, 'England 4.'], [50, 'England 5.'],
];
function tierLeagueKey(score) {
  const v = Number(score);
  if (isNaN(v)) return null;
  for (const [min, key] of TIER_LEAGUE) if (v >= min) return key;
  return null;
}
function tierLeagueLogo(score) {
  const key = tierLeagueKey(score);
  return key ? leagueLogo(key) : null;
}

// An "unclear" wheel. Same geometry as scoreWheel — same size formula, same text
// baseline offset, same label block — so it drops into the row without shifting
// anything. The ring is left as bare track and the figure becomes a question mark
// in the muted ink: a score you don't trust shouldn't be printed as a number, and
// a blank space would read as a rendering fault rather than a judgement.
function unclearWheel({ cx, cy, r, stroke, label, ink, big, labelY }) {
  const size = r * 2 + stroke + 2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
         style="position:absolute;left:${cx - size / 2}px;top:${cy - size / 2}px;">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
              stroke="${ink.track}" stroke-width="${stroke}"/>
      <text x="${size / 2}" y="${size / 2 + (big ? 9 : 7)}" text-anchor="middle"
            font-family="Montserrat,sans-serif" font-size="${big ? 26 : 20}"
            font-weight="700" fill="${ink.muted}">?</text>
    </svg>
    <div style="position:absolute;left:${cx - 60}px;top:${labelY != null ? labelY : cy + size / 2 + 6}px;
                width:120px;text-align:center;font-size:8px;font-weight:700;letter-spacing:0.15em;
                color:${ink.muted};">${label}</div>`;
}

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
// One landscape slot set, attacking right. The upright version is gone: a pitch
// is landscape, every heatmap is landscape, and switching orientation between the
// two modes meant one card drew the same information two different shapes.
// Coordinates are on a 320x208 viewBox — 1.54:1, the real ratio — so nothing
// stretches whatever sits behind it.
const PP_SLOTS = {
  GK:  [26, 104],
  CB:  [70, 104],
  LB:  [62, 22], RB: [62, 186],
  LWB: [116, 22], RWB: [116, 186],
  DM:  [112, 104], CM: [158, 104], AM: [208, 104],
  LW:  [238, 28], RW: [238, 180],
  ST:  [280, 104],
};
// LCB, CB and RCB collapse to ONE slot. Wyscout emits the side a centre back
// happened to line up on, not a different position — a player listed "CB, RCB"
// was drawing two discs and printing "Centre Back" twice, once as his primary and
// once as his secondary. Which side he's comfortable on is a shading question,
// which the manual position-colour override already answers.
const PP_TOKEN_TO_SLOT = {
  GK: 'GK', RB: 'RB', RWB: 'RWB', LCB: 'CB', CB: 'CB', RCB: 'CB', LB: 'LB', LWB: 'LWB',
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

// Order by minutes share when there is one, otherwise by the order the position
// string lists them. Whoever has the most minutes IS the primary — a player
// listed CF first but playing 60% at LW is a left winger, and the tier colours
// have to follow the same order or the pitch would contradict the text.
export function orderSlots(slots, pcts) {
  const withPct = (slots || []).filter(sl => pcts && pcts[sl] != null && pcts[sl] !== '');
  if (!withPct.length) return slots || [];
  return (slots || []).slice().sort((a, b) => {
    const pa = Number(pcts[a]); const pb = Number(pcts[b]);
    const va = isNaN(pa) ? -1 : pa; const vb = isNaN(pb) ? -1 : pb;
    return vb - va;
  });
}

function positionPitchSvg(player, w, h, manualColors, pcts, heatmap, heatOpacity, shownSlots) {
  const slots = orderSlots((shownSlots && shownSlots.length)
    ? shownSlots : occupiedSlots(player, manualColors), pcts);
  const colourFor = (slot, i) => {
    if (manualColors && manualColors[slot]) return PP_TIERS[manualColors[slot]] || manualColors[slot];
    return PP_TIERS[PP_TIER_ORDER[Math.min(i, PP_TIER_ORDER.length - 1)]];
  };

  const VB = [320, 208];
  const GHOST = 'rgba(255,255,255,0.10)';
  // Markings sit ABOVE the heat and have to hold their own against a bright blob,
  // so they're drawn at 0.42 rather than the 0.26 that reads fine on an empty
  // pitch. Two weights: the boundary and halfway line carry the shape, the boxes
  // and arcs are furniture and stay a step back.
  const LINE = 'rgba(255,255,255,0.42)';
  const LINE_SOFT = 'rgba(255,255,255,0.30)';

  const discs = Object.keys(PP_SLOTS).map(slot => {
    const [x, y] = PP_SLOTS[slot];
    const i = slots.indexOf(slot);
    if (i < 0) return heatmap ? '' : `<circle cx="${x}" cy="${y}" r="3.6" fill="${GHOST}"/>`;
    const col = colourFor(slot, i);
    const pct = pcts && pcts[slot] != null && pcts[slot] !== '' ? Number(pcts[slot]) : null;
    // The share IS the disc size. A number chip under every disc was a second
    // label competing with the position code for the same 40px, and the reader
    // has to do the comparing anyway — area does it for them at a glance.
    // 13 at 0% up to 23 at 100%, so even a 5% cameo still holds a readable code.
    const r = pct == null ? 18 : 13 + (Math.max(0, Math.min(100, pct)) / 100) * 10;
    const fs = Math.max(9, Math.min(13, r * 0.68));
    // No ring: a dark stroke round a bright disc on a dark pitch drew a halo and
    // made every position look outlined rather than placed. The drop shadow alone
    // gives the lift. Type down to 700 too — 800 at this size was heavier than
    // anything else on the card.
    return `
      <circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${col}" filter="url(#ppShadow)"/>
      <text x="${x}" y="${y + fs * 0.35}" text-anchor="middle" font-family="Montserrat,sans-serif"
            font-size="${fs.toFixed(1)}" font-weight="700" fill="#07090f">${slot}</text>`;
  }).join('');

  // Heat under the markings, clipped to the pitch, deliberately faint: a backdrop
  // saying "he operates here", not a chart to be read off.
  const heatLayer = heatmap ? `
      <image href="${heatmap}" x="4" y="4" width="312" height="200"
             preserveAspectRatio="none" opacity="${heatOpacity}" clip-path="url(#ppClip)"/>` : '';

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${VB[0]} ${VB[1]}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="ppClip"><rect x="4" y="4" width="312" height="200" rx="8"/></clipPath>
        <filter id="ppShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#000" flood-opacity="0.45"/>
        </filter>
        <linearGradient id="ppTurf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.075)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.025)"/>
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="312" height="200" rx="8" fill="url(#ppTurf)"/>
      ${heatLayer}

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
      ${discs}
    </svg>`;
}

// The pitch now takes the height the band allows and the width that follows from
// the true ratio, rather than being sized to leave a comfortable text column and
// ending up a thumbnail. 182x118 against the old 75x112 is 2.4x the area.
const PB_PITCH_H = 122;
const PB_PITCH_W = Math.round(PB_PITCH_H * (320 / 208));   // 188
const PB_GAP = 20;
const PB_TEXT_W = 236;

function positionBlockHtml(player, x, w, ink, manualColors, pcts, heatmap, heatOpacity, shownSlots) {
  // Derived from the SLOTS THE PITCH DRAWS, not from the raw position string.
  // Those two disagree the moment a position is switched on by hand: the pitch
  // showed ST and RW while the text still read off "CF" alone and printed no
  // secondary at all. One source for both, so what's written matches what's drawn.
  const slots = orderSlots((shownSlots && shownSlots.length)
    ? shownSlots : occupiedSlots(player, manualColors), pcts);
  const primary = slots[0] || shortPos(String(player.position || '').split(',')[0]);
  const secondary = slots[1] || null;
  const full = (sl) => POS_FULL[sl] || POSITION_LABELS[sl] || sl || '—';

  const textW = PB_TEXT_W;
  // The position names are nowrap, so a long one has to be MEASURED rather than
  // assumed to fit — "Attacking Midfielder" and "Defensive Midfielder" are both
  // wider at 19px than the column they sat in, which is how they ended up drawn
  // over the pitch. nameEmWidth is the same estimator the club name uses.
  const longest = Math.max(nameEmWidth(full(primary)),
                           secondary ? nameEmWidth(full(secondary)) : 0);
  const posFs = Math.max(13, Math.min(19, Math.floor(textW / (longest || 1))));
  const groupW = textW + PB_GAP + PB_PITCH_W;
  // Nudged 14px left of centre: the block sits between RULE_MID and RULE_2, and
  // the right-hand rule butts straight onto the GBE tiles while the left one has
  // the wheels' air beside it, so true centre reads right-heavy.
  const left = x + Math.max(0, Math.round((w - groupW) / 2)) - 14;
  return `
    <div style="position:absolute;left:${left}px;top:28px;width:${textW}px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:0.14em;color:${ink.muted};
                  white-space:nowrap;">POSITION</div>
      <!-- A dot in the disc's own colour ties the name to the mark on the pitch.
           The NAMES stay white-then-grey rather than taking the tier colours: two
           more saturated greens beside the wheels would read as another score,
           and the hierarchy here is primary vs secondary, which weight already
           says. The dot carries the link without adding a third colour voice. -->
      <div style="margin-top:9px;display:flex;align-items:center;white-space:nowrap;">
        <span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;
                     background:${PP_TIERS.Primary};margin-right:9px;"></span>
        <span style="font-size:${posFs}px;font-weight:700;color:${ink.primary};
                     line-height:1.05;">${esc(full(primary))}</span>
      </div>
      <div style="margin-top:14px;font-size:8px;font-weight:700;letter-spacing:0.14em;
                  color:${ink.muted};white-space:nowrap;">SECONDARY POSITION</div>
      <div style="margin-top:9px;display:flex;align-items:center;white-space:nowrap;">
        ${secondary ? `<span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;
                     background:${PP_TIERS.Secondary};margin-right:9px;"></span>` : ''}
        <span style="font-size:${posFs}px;font-weight:700;color:${ink.muted};
                     line-height:1.05;">${secondary ? esc(full(secondary)) : '&mdash;'}</span>
      </div>
    </div>
    <div style="position:absolute;left:${left + textW + PB_GAP}px;top:14px;
                width:${PB_PITCH_W}px;height:${PB_PITCH_H}px;">
      ${positionPitchSvg(player, PB_PITCH_W, PB_PITCH_H, manualColors, pcts, heatmap, heatOpacity, shownSlots)}
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
export const SW_HI = 70;
export const SW_LO = 30;

const SW_LABELS = {
  GK: {
    "Save rate, %": "Shot Stopping",
    "Prevented goals per 90": "Preventing Goals",
    "Conceded goals per 90": "Conceding Goals",
    "Exits per 90": "Sweeping",
    "Accurate passes, %": "Short Passing",
    "Accurate long passes, %": "Long Passing",
    "Passes per 90": null,
    "Long Passes per 90": null,
    "xG against per 90": null,
    "Shots against per 90": null,
  },
  CB: {
    "Defensive duels per 90": "Defensive Duel Attempts",
    "Aerial duels won, %": "Aerial Duels",
    "Defensive duels won, %": "Tackling",
    "PAdj Interceptions": "Positioning",
    "Accurate forward passes, %": "Forward Passing %",
    "Dribbles per 90": "Stepping with the ball",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Progressive runs per 90": "Progressive Carries",
    "Accurate passes, %": "Passing Retention",
    "Progressive passes per 90": "Progressive Passes",
    "Accurate long passes, %": "Long passing",
    "Shots blocked per 90": "Blocking Shots",
    "Passes per 90": null,
    "Long Passes per 90": null,
  },
  FB: {
    "Defensive duels per 90": "Defensive Duel Attempts",
    "Aerial duels won, %": "Aerial Duels",
    "Defensive duels won, %": "Tackling",
    "PAdj Interceptions": "Defensive Positioning",
    "Accurate forward passes, %": "Forward Passing %",
    "Dribbles per 90": "Ball Carrying",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Progressive runs per 90": "Progressive Carries",
    "Accurate passes, %": "Passing Retention",
    "Progressive passes per 90": "Progressive Passes",
    "Accurate long passes, %": "Long passing",
    "Shots blocked per 90": "Blocking Shots",
    "xG per 90": "Goal Threat",
    "Touches in box per 90": "Penalty-box Coverage",
    "xA per 90": "Creating Chances",
    "Passes to penalty area per 90": "Passes to Penalty Area",
    "Crosses per 90": "Crossing",
    "Accurate crosses, %": "Crossing",
    "Passes per 90": null,
    "Long passes per 90": null,
    "Shots per 90": null,
    "Deep completions per 90": null,
    "Smart passes per 90": null,
  },
  CM: {
    "Defensive duels per 90": "Defensive Duel Attempts",
    "Aerial duels won, %": "Aerial Duels",
    "Defensive duels won, %": "Tackling",
    "PAdj Interceptions": "Interceptions",
    "Accurate forward passes, %": "Forward Passing %",
    "Dribbles per 90": "Dribble volume",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Progressive runs per 90": "Progressive Carries",
    "Accurate passes, %": "Passing Retention",
    "Progressive passes per 90": "Progressive Passes",
    "Accurate long passes, %": "Long passing",
    "Shots blocked per 90": "Blocking Shots",
    "xG per 90": "Goal Threat",
    "Touches in box per 90": "Getting into penalty box",
    "xA per 90": "Creating Chances",
    "Passes to penalty area per 90": "Passes to Penalty Area",
    "Crosses per 90": "Crossing",
    "Accurate crosses, %": "Crossing",
    "Smart passes per 90": "Through Balls",
    "Passes per 90": null,
    "Long Passes per 90": null,
    "Shots per 90": null,
    "Deep completions per 90": null,
    "Non-penalty goals per 90": null,
  },
  ATT: {
    "Defensive duels per 90": "Defensive Duels",
    "Aerial duels won, %": "Aerial Duels",
    "Non-penalty goals per 90": "Scoring Goals",
    "xG per 90": "Attacking Positioning",
    "Shots per 90": "Shot Volume",
    "Goal conversion, %": "Finishing",
    "Crosses per 90": "Crossing",
    "Accurate crosses, %": "Crossing",
    "Dribbles per 90": "Dribble Volume",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Touches in box per 90": "Penalty-box Coverage",
    "Progressive runs per 90": "Progressive Carries",
    "Passes per 90": "Involvement",
    "Accurate passes, %": "Retention",
    "xA per 90": "Creating Chances",
    "Passes to penalty area per 90": "Passes to Penalty Area",
    "Smart passes per 90": "Through Balls",
    "Progressive passes per 90": "Progressive Passes",
    "Aerial duels per 90": null,
    "Deep completions per 90": null,
  },
  CF: {
    "Defensive duels per 90": "Defensive Duel Attempts",
    "Aerial duels won, %": "Aerial Duels",
    "xG per 90": "Goal Threat",
    "Shots per 90": "Shot Volume",
    "Goal conversion, %": "Finishing",
    "Dribbles per 90": "Dribble Volume",
    "Successful dribbles, %": "Dribbling Efficiency",
    "Touches in box per 90": "Penalty-box Coverage",
    "Progressive runs per 90": "Progressive Carries",
    "Passes per 90": "Involvement",
    "Accurate passes, %": "Passing Retention",
    "xA per 90": "Creating Chances",
    "Passes to penalty area per 90": "Passes to Penalty Area",
    "Smart passes per 90": "Through Balls",
    "Non-penalty goals per 90": "Scoring Goals",
    "Crosses per 90": null,
    "Deep completions per 90": null,
  },
};
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
  // Goalkeeping
  'Save Rate': 'Save rate, %', 'Save rate': 'Save rate, %',
  'Goals Prevented': 'Prevented goals per 90', 'Prevented goals': 'Prevented goals per 90',
  'Goals Conceded': 'Conceded goals per 90', 'Conceded goals': 'Conceded goals per 90',
  'xG Against': 'xG against per 90', 'Shots Against': 'Shots against per 90',
  'Exits': 'Exits per 90',
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

// Manual entries a percentile can never produce. Athleticism and Physicality are
// scout judgements — no Wyscout column measures either — so they're offered as
// one-tap additions rather than left to be typed every time.
// Scout judgements no Wyscout column measures. ALPHABETICAL, not grouped: a
// grouped list only helps someone who already knows which group a trait is in,
// and in a 30-item dropdown you're scanning for a word you've already decided on.
export const SW_MANUAL_TERMS = [
  'Aerial Presence', 'Aggression', 'Agility', 'Athleticism', 'Availability',
  'Balance', 'Ball Striking', 'Bravery', 'Composure', 'Consistency',
  'Decision Making', 'Dynamism', 'First Touch', 'Injury Record', 'Intensity', 'IQ',
  'Leadership', 'Mentality', 'Movement', 'Pace', 'Physicality',
  'Positioning', 'Receiving Under Pressure', 'Resilience', 'Running Power',
  'Set Pieces',
  'Size', 'Stamina', 'Strength', 'Unique', 'Versatility', 'Weak Foot',
];
// The same five steps the position tiers and score wheels use, so a pill on this
// tile means what the same colour means anywhere else on the card.
export const SW_TONES = {
  Green: '#00bf63', 'Light Green': '#7ed957', Yellow: '#ffde59',
  Orange: '#ff914d', Red: '#ff3131',
};

function strengthsPanelBody(w, h, sd, posKey, opts = {}) {
  return swBlockHtml(w, h, swEligible(sd, posKey), opts);
}

// The tile itself, taking [{label, pct}] rather than a season object. Split out
// so the manager pager can hand it coach percentiles instead of player ones —
// same pills, same bars, same fit-or-trim logic, one implementation.
export function swBlockHtml(w, h, rows, opts = {}) {
  const { swDrop = [], swAddStr = [], swAddWeak = [] } = opts;
  rows = rows || [];
  const dropped = new Set(swDrop);

  // Manual entries go FIRST. Appended after the derived ones they were cut by the
  // slice — six derived strengths meant anything typed in fell outside the cap and
  // silently never appeared. A hand-entered trait is a deliberate act and outranks
  // a computed one.
  const strengths = [
    ...swAddStr.map(x => ({ label: x.label, tone: SW_TONES[x.tone] || SW_TONES.Green })),
    ...rows.filter(r => r.pct >= SW_HI && !dropped.has(r.label))
           .sort((a, b) => b.pct - a.pct)
           .map(r => ({ label: r.label, tone: SW_TONES.Green })),
  ].slice(0, 6);

  // Derived weaknesses are bars — a percentile has magnitude, and 4th is a
  // different problem from 29th. Manual ones are pills: a scout writing
  // "Physicality" is making a call, not reporting a measurement, and a bar lends it
  // a precision it doesn't have. The tile reads pills, rules, pills.
  const weaknesses = rows.filter(r => r.pct <= SW_LO && !dropped.has(r.label))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);
  const weakPills = swAddWeak.slice(0, 4);

  if (!strengths.length && !weaknesses.length && !weakPills.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;font-size:12px;color:#55617a;">No profile data for this season.</div>`;
  }

  const strengthsHtml = strengths.length
    ? strengths.map(r => pillHtml(r.label, r.tone, 11, 11)).join('')
    : `<span style="font-size:11px;color:#8b98ad;">None above the ${SW_HI}th percentile</span>`;

  const BAR_H = 32;
  const buildWeakHtml = () => weaknesses.length
    ? weaknesses.map((r, i) => `
      <div style="position:absolute;left:0;top:${i * BAR_H}px;width:${w}px;height:${BAR_H - 8}px;">
        <span style="position:absolute;left:0;right:44px;top:0;font-size:11.5px;font-weight:600;
                     color:#c8d2e0;white-space:nowrap;overflow:hidden;">${esc(r.label)}</span>
        <span style="position:absolute;right:2px;top:-1px;font-size:13px;font-weight:700;
                     color:${radarColor(r.pct)};">${Math.round(r.pct)}</span>
        <div style="position:absolute;left:0;right:2px;top:17px;height:5px;border-radius:3px;
                    background:rgba(255,255,255,0.08);overflow:hidden;">
          <div style="width:${Math.max(2, Math.min(100, r.pct))}%;height:100%;
                      background:${radarColor(r.pct)};border-radius:3px;"></div>
        </div>
      </div>`).join('')
    : (weakPills.length ? '' : `<span style="font-size:11px;color:#8b98ad;">None below the ${SW_LO}th percentile</span>`);

  const pillsHtml = weakPills.length
    ? weakPills.map(x => pillHtml(x.label, SW_TONES[x.tone] || SW_TONES.Red, 11, 11)).join('')
    : '';

  // WHERE THE WEAKNESSES START IS MEASURED, NOT ASSUMED.
  // A fixed 92px top assumed the strengths always packed into two rows. Labels like
  // "Progressive Carries" and the like run long, so six of them can
  // wrap to three rows and the WEAKNESSES heading was drawn straight through the
  // last of them. Pill widths use the same formula pillHtml does — nameEmWidth at
  // the pill's font size, plus its side padding and margin — packed into lines of
  // the panel width. Many strengths therefore push the weaknesses down; few pull
  // them up, which is the behaviour you'd expect from the tile.
  const PILL_W = (t) => Math.ceil(nameEmWidth(t) * 11) + 22 + 6;
  const packRows = (labels) => {
    if (!labels.length) return 1;
    let rows = 1, x = 0;
    for (const t of labels) {
      const pw = PILL_W(t);
      if (x + pw > w && x > 0) { rows += 1; x = pw; } else { x += pw; }
    }
    return rows;
  };
  const LABEL_H = 12, LABEL_GAP = 9, PILL_ROW_H = 25, BLOCK_GAP = 15;
  // The weaknesses block has to FIT, not merely start in the right place. Its own
  // height is known — heading, bars, and however many rows the manual pills pack
  // into — so the strengths are trimmed one pill at a time until the pair fits the
  // tile. Previously a third strength row plus a bar plus two pills came to 222px
  // in a 210px box and the pills were silently clipped off the bottom, which looks
  // identical to them never having been added.
  const measureWeak = (n) => LABEL_H + 11 + n * BAR_H
    + (weakPills.length ? 10 + packRows(weakPills.map(x => x.label)) * PILL_ROW_H : 0);
  const MIN_STRENGTH_H = LABEL_H + LABEL_GAP + PILL_ROW_H;   // one row of pills
  while (weaknesses.length > 1 && MIN_STRENGTH_H + BLOCK_GAP + measureWeak(weaknesses.length) > h) {
    weaknesses.pop();
  }

  const weakBlockH = measureWeak(weaknesses.length);
  const weakHtml = buildWeakHtml();

  let shown = strengths.slice();
  let strengthsH = LABEL_H + LABEL_GAP + packRows(shown.map(r => r.label)) * PILL_ROW_H;
  while (shown.length > 1 && strengthsH + BLOCK_GAP + weakBlockH > h) {
    shown = shown.slice(0, -1);
    strengthsH = LABEL_H + LABEL_GAP + packRows(shown.map(r => r.label)) * PILL_ROW_H;
  }
  const strengthsHtml2 = shown.length
    ? shown.map(r => pillHtml(r.label, r.tone, 11, 11)).join('')
    : strengthsHtml;
  const WEAK_TOP = Math.max(0, Math.min(strengthsH + BLOCK_GAP, h - weakBlockH));
  const barsH = weaknesses.length * BAR_H;

  return `<div style="position:absolute;inset:0;overflow:hidden;">
      <div style="position:absolute;left:0;top:0;width:${w}px;">
        <div style="font-size:8.5px;font-weight:700;letter-spacing:0.14em;color:#6f7c92;">STRENGTHS</div>
        <div style="margin-top:${LABEL_GAP}px;">${strengthsHtml2}</div>
      </div>
      <div style="position:absolute;left:0;top:${WEAK_TOP}px;width:${w}px;">
        <div style="font-size:8.5px;font-weight:700;letter-spacing:0.14em;color:#6f7c92;">WEAKNESSES</div>
        <div style="position:relative;margin-top:11px;height:${barsH}px;">${weakHtml}</div>
        ${pillsHtml ? `<div style="margin-top:${weaknesses.length ? 10 : 0}px;">${pillsHtml}</div>` : ''}
      </div>
    </div>`;
}

// ─── Potential Clubs UK ────────────────────────────────────────────────────
// Row geometry ported line for line from TeamReport's Similar Teams panel —
// same 9px card, same #n index at 10px, same 26px crest at x=32, same 68px text
// column, same 50px centred value column with its caption underneath. Only the
// caption word changes, because these are fit scores rather than match scores.
export function clubsPanelBody(w, h, rows, coreOnly, mode, hideScores, notes, noteColour) {
  const NOTE_COL = noteColour || ACCENT_PINK;
  const isPlayers = mode === 'players';
  if (!rows || !rows.length) {
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;font-size:12px;color:#55617a;text-align:center;">
              ${isPlayers ? 'No comparable players' : 'No club fits'} —
              the position pool isn't loaded.</div>`;
  }
  const shown = rows.slice(0, 3);
  const note = (!isPlayers && coreOnly && !hideScores);
  const rowH = Math.floor((h - (note ? 14 : 0) - 4) / shown.length);
  const VAL_W = hideScores ? 0 : 50;
  const body = shown.map((t, i) => {
    const figure = isPlayers ? t.simPct : t.finalFit;
    const col = gradeColor(figure);
    // A similar-players row is about the PLAYER, so it carries his face. Showing
    // his club's badge instead put three different clubs down the left of a panel
    // whose subject is three people, and it read as a club list.
    const badge = isPlayers ? photoUrl(t.name, t.team) : teamCrest(t.team);
    const crest = teamCrest(t.team);
    const title = isPlayers ? t.name : t.team;
    // A player row's second line is his club and league; a club row's is just the
    // league. Both stay one nowrap line so nothing wraps into the crest.
    const sub = isPlayers
      ? [t.team, leagueDisplayName(t.league) || t.league].filter(Boolean).join(' · ')
      : (leagueDisplayName(t.league) || t.league);
    const lflag = leagueFlag(t.league);
    const note = (notes && notes[isPlayers ? `${t.name}|${t.team}` : t.team]) || '';
    return `
      <div style="position:absolute;left:0;top:${i * rowH + 2}px;width:${w}px;height:${rowH - 6}px;
                  background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);
                  border-radius:9px;">
        <span style="position:absolute;left:10px;top:50%;margin-top:-6px;font-size:10px;
                     font-weight:700;color:#475569;">#${i + 1}</span>
        ${badge ? `<div style="position:absolute;left:31px;top:50%;margin-top:-17px;
                     width:34px;height:34px;background-image:url('${src(badge)}');
                     background-size:${isPlayers ? 'cover' : 'contain'};
                     background-repeat:no-repeat;
                     background-position:center ${isPlayers ? 'top' : 'center'};
                     ${isPlayers ? 'border-radius:50%;background-color:#1a2233;' : ''}"></div>` : ''}
        <!-- The sub-line is ABSOLUTELY placed, not laid out. Flex shrank the
             league name to an ellipsis with 200px spare; inline-block let the
             flag print over it. Both are the renderer resolving widths its own
             way. nameEmWidth measures the text, so the flag is positioned at a
             coordinate and can neither overlap nor push anything. -->
        <div style="position:absolute;left:74px;right:${VAL_W + 16}px;top:50%;margin-top:-17px;">
          <div style="font-size:14px;font-weight:700;color:#eaf0f8;line-height:1.15;
                      white-space:nowrap;">${esc(title)}</div>
          <div style="position:relative;height:14px;margin-top:5px;">
            ${(() => {
              const SUB_FS = 10.5;
              const subW = Math.ceil(nameEmWidth(sub) * SUB_FS);
              let x = 0;
              const parts = [];
              if (isPlayers && crest) {
                parts.push(`<span style="position:absolute;left:${x}px;top:0;width:14px;height:14px;
                             background-size:contain;background-repeat:no-repeat;
                             background-position:center;
                             background-image:url('${src(crest)}');"></span>`);
                x += 20;
              } else if (!isPlayers && lflag) {
                parts.push(`<span style="position:absolute;left:${x}px;top:2px;width:15px;height:10px;
                             background-size:cover;background-position:center;border-radius:1.5px;
                             box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.25);
                             background-image:url('${src(lflag)}');"></span>`);
                x += 21;
              }
              parts.push(`<span style="position:absolute;left:${x}px;top:0;font-size:${SUB_FS}px;
                           color:#8b98ad;white-space:nowrap;line-height:14px;">${esc(sub)}</span>`);
              // nameEmWidth is a deliberately generous estimator — it runs about
              // 10% wide so nothing ever collides. Left uncorrected that surplus
              // became visible air between the league name and its flag.
              x += Math.round(subW * 0.90) + 5;
              if (isPlayers && lflag) {
                parts.push(`<span style="position:absolute;left:${x}px;top:2px;width:15px;height:10px;
                             background-size:cover;background-position:center;border-radius:1.5px;
                             box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.25);
                             background-image:url('${src(lflag)}');"></span>`);
                x += 23;
              }
              if (note) {
                parts.push(`<span style="position:absolute;left:${x}px;top:0;font-size:${SUB_FS}px;
                             color:#5c6b82;line-height:14px;">&middot;</span>`);
                parts.push(`<span style="position:absolute;left:${x + 10}px;top:0;font-size:${SUB_FS}px;
                             font-weight:600;color:${NOTE_COL};white-space:nowrap;
                             line-height:14px;">${esc(note)}</span>`);
              }
              return parts.join('');
            })()}
          </div>
        </div>
        ${hideScores ? '' : `
        <div style="position:absolute;right:10px;top:50%;margin-top:-15px;width:${VAL_W}px;
                    text-align:center;">
          <div style="font-size:15px;font-weight:700;color:${figure == null ? '#475569' : col};line-height:1.05;">${
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
  // Raising the character cap without proving the tile could hold it is what kept
  // clipping the last line. The type is sized to the copy instead: a full-length
  // view steps down until it fits, so no length can overflow. Capacities at 155px
  // of tile — 15px: ~490 chars, 14px: ~525, 13px: ~650 — all above the 475 cap
  // at their own band, with the step chosen so the text never fills the last line
  // to its edge.
  // Sizing only to FIT left short copy sitting in the top two thirds of the tile
  // with a band of dead space under it. This picks the LARGEST size that still
  // fits, so 200 characters fill the box as completely as 470 do.
  const n = String(text).length;
  let fs = 13;
  for (const cand of [18, 17, 16, 15, 14, 13]) {
    const perLine = Math.max(1, Math.floor(w / (cand * 0.47)));
    if (Math.ceil(n / perLine) * (cand * 1.45) <= h - 2) { fs = cand; break; }
  }
  return `<div style="position:absolute;inset:0;font-size:${fs}px;line-height:1.45;
            font-weight:500;color:#e2e8f4;overflow:hidden;">${esc(text)}</div>`;
}

// ─── Header ────────────────────────────────────────────────────────────────
let IMG = {};
const src = (url) => (url && IMG[url]) || url || '';
// ManagerPager reuses clubsPanelBody, which resolves crests and flags through
// the map above. buildPlayerPagerElement assigns IMG on every build, so this
// can't leave anything stale behind it.
export function setPagerImageMap(images) { IMG = images || {}; }

function headerHtml(player, ctx, opts) {
  const { sd, statsRow, league, team } = ctx;
  const {
    headerColour, nameOverride, teamOverride, positionColors, gbeOv,
    showPitch, isGK, positionPcts, heatmapDataUrl, heatOpacity, shownSlots,
    heightOverride, footOverride, showXValue, xValueOverride, showTierBadge,
    overallOverride, potentialOverride, overallUnclear, potentialUnclear,
  } = opts;

  const spec = headerColour;
  const ink = headerInk(spec);
  const displayName = (nameOverride && nameOverride.trim()) || player.name;
  const displayTeam = (teamOverride && teamOverride.trim()) || team;
  const photo = opts.uploadedPhotoDataUrl || photoUrl(player.name, player.team);
  const crest = teamCrest(team);
  // A long club name needs a touch more air before the league badge. "Viktoria
  // Plzeň" was close enough to the badge that its caron read as touching it — and
  // a diacritic sits outside the glyph box the width estimate accounts for, so the
  // estimate is fractionally short exactly on the names that need the room.
  // Threshold is that name one character shorter, measured rather than counted so
  // it fires on width, not on how many letters happen to be in it.
  const LONG_CLUB_W = nameEmWidth('Viktoria Plze');
  const LONG_CLUB = nameEmWidth(truncateText(displayTeam, 16)) >= LONG_CLUB_W;
  const logo = leagueLogo(league);
  const flag = leagueFlag(league);
  const natFlag = personFlagUrl(player);

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
    <!-- 146 square in a 150 band, so it reads as a portrait rather than a thumbnail
         while still clearing both edges by 2px.
         ONE layer, chosen up front. Stacking the fallback under the photo meant an
         opaque plate behind every transparent cut-out — a grey figure showing
         through the player's own shoulders. preloadImages only records URLs it
         actually fetched, so its absence from that map IS the 404, and the fallback
         is drawn instead of behind. An uploaded photo is a data URL and never goes
         through the preloader, so it counts as present. -->
    ${(() => {
      const uploaded = !!opts.uploadedPhotoDataUrl;
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

    <!-- Club, league and the player's own details on ONE row. Split across two
         they left the nationality flag stranded above a lone age, and cost a whole
         row of the band. The league FLAG is dropped: DEN2 already names the
         country and the badge already identifies the competition, so it was the
         third thing on the row saying "Denmark". -->
    <div style="position:absolute;left:${NAME_X}px;top:78px;display:flex;align-items:center;
                white-space:nowrap;">
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
                   color:${ink.muted};margin-left:12px;">${esc(leagueAbbrev(league))}</span>

      <span style="width:1px;height:16px;background:${ink.rule};margin:0 6px 0 7px;flex-shrink:0;"></span>

      ${natFlag ? `<div style="width:21px;height:13px;flex-shrink:0;background-size:cover;
                  background-position:center;border-radius:2px;margin-right:8px;
                  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);
                  background-image:url('${src(natFlag)}');"></div>` : ''}
      ${[player.age != null ? `${player.age} y.o.` : null,
         (heightOverride && heightOverride.trim()) || cmToFeet(player.height),
         (footOverride && footOverride.trim())
           || ((player.foot && player.foot !== 'unknown' && player.foot !== 'nan') ? formatFoot(player.foot) : null),
         // Off unless asked for: a model estimate sitting in the identity row
         // reads as fact, and it is the one number here that is inferred rather
         // than recorded.
         showXValue
           ? ((xValueOverride && xValueOverride.trim())
              || (player.xValue > 0 ? formatMV(player.xValue) : null))
           : null,
        ].filter(Boolean).map((v, i) => `
        ${i ? `<span style="color:${ink.muted};margin:0 8px;font-size:11px;">&middot;</span>` : ''}
        <span style="font-size:12.5px;font-weight:700;color:${ink.soft};">${esc(v)}</span>`).join('')}
    </div>

    <!-- Apps / Gls / Asts / xG / xA / Mins -->
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

    <!-- Overall + Potential. Both drawn big, unlike TeamReport's one-hero-two-minor
         arrangement: a player's ceiling is not a subordinate stat to his current
         level, and at two wheels there's room for both to carry full weight. -->
    ${(() => {
      const num = (v, fb) => (v === '' || v == null || isNaN(Number(v)) ? fb : Number(v));
      const all = [
        ['OVERALL', num(overallOverride, player.careerScore), 37, !!overallUnclear],
        ['POTENTIAL', num(potentialOverride, player.potentialScore), 33, !!potentialUnclear],
      ];
      const step = WHEEL_W / all.length;
      // Optional tier key under each wheel. The thresholds are the career chart's
      // own (scoreLeagueTier), so the badge and the dashed lines in the Career
      // panel can never disagree about what 72 means. Subtle by design — it is a
      // key to a number already on screen, not a second headline.
      return all.map(([label, v, r, unclear], i) => {
        const cx = WHEEL_X + step * i + step / 2;
        const wheel = unclear
          ? unclearWheel({ cx, cy: 64, r, stroke: 8, label, ink, big: true, labelY: HDR_LABEL_Y })
          : scoreWheel({
              cx, cy: 64, r, stroke: 8,
              value: v, label, colour: scoreTierColor(v), ink, big: true, labelY: HDR_LABEL_Y,
            });
        // No tier badge on an unclear score — the whole point is that we aren't
        // claiming a level for it.
        if (!showTierBadge || unclear) return wheel;
        const badge = tierLeagueLogo(v);
        if (!badge) return wheel;
        // Small, centred on the same axis as the label, and tucked close under it:
        // it is a footnote to the number, not a third element competing with it.
        return wheel + `
      <div style="position:absolute;left:${cx - 60}px;top:${HDR_LABEL_Y + 14}px;
                  width:120px;height:15px;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${src(badge)}');"></div>`;
      }).join('');
    })()}

    <div style="position:absolute;left:${RULE_MID}px;top:28px;width:1px;height:100px;
                background:${ink.rule};"></div>

    <!-- Position, in the trend line's slot: stated in words, with an upright
         pitch beside it. -->
    ${showPitch ? positionBlockHtml(player, PITCH_X, PITCH_W, ink, positionColors, positionPcts, heatmapDataUrl, heatOpacity, shownSlots) : `
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

    <!-- GBE in the coach profile's slot.
         Four tiles on one rhythm: caption, figure, pips. The figure and its
         denominator sit together on one baseline rather than at opposite ends of
         the tile — split apart, "0" and "/12" read as two unrelated things and
         the eye had to travel 100px to pair them up. Points are counted, not
         measured, so the track is pips: twelve of them with ten lit is a number
         you read, where a bar at 10/12 is a length you estimate against a scale
         that isn't drawn. A maxed component turns its tile green and says MAX.
         Tiles run 44..124 inside the 28..128 band rules; 124 wide on a 14px
         gutter fills the 538px slot exactly. -->
    <!-- The status notes are right-aligned and nowrap, so a long one ("ESC
         ELIGIBLE - YOUTH LEAGUE (5+ GAMES)") grew leftwards straight out of the
         block and over the pitch. The row is a flex with a shrinkable middle that
         clips, and the reason is dropped: the badge says he has a route in, the
         View panel is where the reason belongs. -->
    <div style="position:absolute;left:${GBE_X}px;top:14px;width:${GBE_W}px;height:20px;
                display:flex;align-items:center;white-space:nowrap;overflow:hidden;">
      <span style="flex-shrink:0;font-size:8px;font-weight:700;letter-spacing:0.14em;
                   color:${ink.muted};">GBE CALCULATION</span>
      <span style="flex:1;min-width:0;overflow:hidden;text-align:right;padding:0 10px;">
        ${gbe.homeNation ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:${ink.muted};">AUTO PASS &middot; HOME NATION</span>` : ''}
        ${gbe.panelEligible ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:#f0c56a;">EXCEPTIONS PANEL</span>` : ''}
        ${gbe.escEligible ? `<span style="font-size:8px;font-weight:700;letter-spacing:0.13em;
                     color:#f97316;">&#9889; ESC ELIGIBLE</span>` : ''}
      </span>
      <span style="flex-shrink:0;display:flex;align-items:center;">
        <span style="font-size:17px;font-weight:700;color:${ink.primary};line-height:1;">${gbe.total}</span>
        <span style="font-size:8px;font-weight:700;letter-spacing:0.13em;color:${ink.muted};
                     margin-left:6px;">PTS</span>
        <span style="margin-left:14px;font-size:11px;font-weight:700;color:${gbe.colour};
                     background:${gbe.colour}22;border:1px solid ${gbe.colour};border-radius:5px;
                     padding:4px 13px;">${gbe.status}</span>
      </span>
    </div>
    ${(() => {
      // Two-up rather than four across. Each counter needs a caption, a figure and
      // a track; stacked two-by-two that costs 210px of width instead of 538, and
      // the caption and figure share one line rather than each owning a row.
      const TW = 210, TGX = 12, TH = 38, TGY = 8;
      return [['DOMESTIC', gbe.domPts, 12], ['CONTINENTAL', gbe.contPts, 8],
              ['LEAGUE BAND', gbe.lqPts, 12], ['FINISH / PROG', gbe.finishPts + gbe.progPts, 10]]
        .map(([label, val, max], i) => {
          const got = Math.max(0, Math.min(max, val));
          const done = got >= max;
          const tone = done ? '#3da65b' : ink.secondary;
          const gap = 2;
          const inner = TW - 22;
          const pipW = (inner - (max - 1) * gap) / max;
          const pips = Array.from({ length: max }, (_, k) => `
            <div style="width:${pipW.toFixed(2)}px;height:5px;border-radius:1.5px;
                        margin-left:${k ? gap : 0}px;
                        background:${k < got ? tone : ink.track};"></div>`).join('');
          return `
        <div style="position:absolute;left:${GBE_X + (i % 2) * (TW + TGX)}px;
                    top:${44 + Math.floor(i / 2) * (TH + TGY)}px;width:${TW}px;height:${TH}px;
                    box-sizing:border-box;padding:7px 11px;border-radius:7px;
                    border:1px solid ${done ? 'rgba(61,166,91,0.42)' : ink.rule};
                    background:${done ? 'rgba(61,166,91,0.09)' : 'rgba(255,255,255,0.05)'};">
          <div style="display:flex;align-items:baseline;justify-content:space-between;
                      white-space:nowrap;line-height:1;">
            <span style="font-size:7.5px;font-weight:700;letter-spacing:0.13em;
                         color:${ink.muted};">${label}</span>
            <span>
              <span style="font-size:14px;font-weight:700;
                           color:${got === 0 ? ink.muted : ink.primary};">${got}</span><span
                    style="font-size:9.5px;font-weight:700;color:${ink.muted};">/${max}</span>
            </span>
          </div>
          <div style="display:flex;margin-top:8px;">${pips}</div>
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
  const nf = personFlagUrl(player);
  if (nf) urls.push(nf);
  urls.push(PHOTO_FALLBACK);
  for (const v of [player.careerScore, player.potentialScore]) {
    const b = tierLeagueLogo(v);
    if (b) urls.push(b);
  }
  for (const r of (clubRows || [])) {
    urls.push(r.name ? photoUrl(r.name, r.team) : teamCrest(r.team));
    if (r.name) urls.push(teamCrest(r.team));
    if (r.league) urls.push(leagueFlag(r.league));
  }
  return [...new Set(urls.filter(u => u && !u.startsWith('data:')))];
}

// ───────────────────────────────────────────────────────────────────────────
export function buildPlayerPagerElement(player, opts = {}) {
  const {
    images = {}, headerColourName = 'Default', seasonOverride = '',
    nameOverride = '', teamOverride = '', uploadedPhotoDataUrl = '',
    viewText = '', clubRows = [], clubsCoreOnly = true,
    clubsMode = 'clubs', hideFitScores = false, ukOnly = true, clubNotes = {},
    showForecast = false, useBestRoleCareer = false, showPitch = true,
    positionColors = {}, positionPcts = {}, gbeOv = {},
    heatmapDataUrl = '', heatOpacity = 0.3, shownSlots = null,
    heightOverride = '', footOverride = '', showXValue = false, xValueOverride = '',
    showTierBadge = false,
    overallOverride = '', potentialOverride = '',
    overallUnclear = false, potentialUnclear = false,
    swDrop = [], swAddStr = [], swAddWeak = [],
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
  // sd.roles is the APP role set — three broad buckets per position ("Ball
  // Playing CB", "Wide CB", "Box Defender"). The Style panel wants the QC set,
  // which is the six-way split a scout actually reads (Aggressor, Ball Carrier,
  // Progresser, Aerial, Ball Player, Stopper). Reaching for sd.roles to make the
  // season dropdown affect this panel swapped one for the other and halved the
  // rows. Season-specific QC scores are used if the pipeline ever stores them;
  // until then this is career QC, same as it always was.
  const qcRoles = (sd.qcRoles && Object.keys(sd.qcRoles).length ? sd.qcRoles : null)
    || player.qcRoleCareerScores || player.qcLatestRoles || player.roleCareerScores;
  // "Ball Playing CB" -> "Ball Playing · CB", where the CB is the PLAYER's
  // translated position rather than the role string's own suffix, so a RAMF
  // reads RW and a role whose suffix disagrees with the player can't print a
  // position he doesn't play.
  // The suffix follows the position the card is actually claiming — the primary
  // slot after the minutes-share ordering — not the first token in the raw string.
  // Switching Titraoui's primary to CM left Style still reading "Ball Carrier DM",
  // so the two halves of the card disagreed about what he is.
  const primarySlot = orderSlots(
    (shownSlots && shownSlots.length) ? shownSlots : occupiedSlots(player, positionColors),
    positionPcts)[0];
  const posShort = primarySlot || shortPos(rawTok);
  const roleRows = qcRoles && Object.keys(qcRoles).length
    ? Object.entries(qcRoles)
        .map(([k, v]) => {
          const base = roleBase(k);
          const tag = (posShort && roleWantsTag(base)) ? `  ${posShort}` : '';
          return [`${base}${tag}`, Number(v) || 0];
        })
        .sort((a, b) => b[1] - a[1])
        // Seven, not six. The hex chart flexes its row height between 30 and 40px,
        // so a seventh row costs nothing and fills a tile that was ending 40px
        // short. Positions with only six roles are unaffected.
        .slice(0, 7)
    : [];
  const rolesHtml = roleRows.length
    // 156 was sized for Team Report's one-word style axes. "Chance Creator CF"
    // is half as long again, so the hexes have to move right by the same amount
    // or the gap between text and chart closes up on the longest row.
    // Vertically centred rather than pinned to the top, so whatever the row
    // height solves to, the leftover splits evenly instead of pooling underneath.
    ? `<div style="position:absolute;left:0;top:${
         Math.max(0, Math.round((row1InnerH - (roleRows.length * Math.max(30, Math.min(40,
           Math.floor((row1InnerH - 6) / roleRows.length))) + 6)) / 2))
       }px;">${styleHexSvg(roleRows, innerW, row1InnerH, 205)}</div>`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;
                   justify-content:center;font-size:12px;color:#55617a;">No role scores.</div>`;

  container.innerHTML = `
    <div id="pp-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(player, ctx, {
        headerColour: HEADER_COLOURS[headerColourName], nameOverride, teamOverride,
        uploadedPhotoDataUrl, positionColors, gbeOv, showPitch, isGK, positionPcts, heatmapDataUrl, heatOpacity, shownSlots,
        heightOverride, footOverride, showXValue, xValueOverride, showTierBadge,
        overallOverride, potentialOverride, overallUnclear, potentialUnclear,
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
        body: teamContextBody(innerW, row2InnerH, player, posKey, sd),
      })}
      ${panel({
        x: COL_B_X, y: ROW_2, w: COL_W, h: ROW2_H, title: 'Strengths & Weaknesses',
        body: strengthsPanelBody(innerW, row2InnerH, sd, posKey, { swDrop, swAddStr, swAddWeak }),
      })}

      ${panel({
        x: COL_A_X, y: ROW_3, w: COL_W, h: ROW3_H,
        title: clubsMode === 'players' ? 'Similar Players' : 'Potential Clubs',
        // Scope goes in the panel's right-hand slot rather than the title, so the
        // heading stays the same length whichever way it's set.
        right: ukOnly ? 'UK' : 'WORLDWIDE',
        body: clubsPanelBody(innerW, row3InnerH, clubRows, clubsCoreOnly, clubsMode, hideFitScores, clubNotes),
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

const ALL_PITCH_SLOTS = ['GK', 'LB', 'CB', 'RB', 'LWB', 'RWB',
                         'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
// The note shares a 498px line with a flag and a league name, so it has to be
// short enough that the row never wraps.
const CLUB_NOTE_MAX = 26;
const VIEW_MAX_LENGTH = 440;
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
  const [heatRaw, setHeatRaw] = useState('');
  const [heatmapDataUrl, setHeatmapDataUrl] = useState('');
  const [heatExtract, setHeatExtract] = useState(true);
  const [heatOpacity, setHeatOpacity] = useState(30);
  const [gbeOv, setGbeOv] = useState({});
  const [swDrop, setSwDrop] = useState([]);
  const [swAddStr, setSwAddStr] = useState([]);
  const [swAddWeak, setSwAddWeak] = useState([]);
  const [swNew, setSwNew] = useState({ label: '', tone: 'Green', pct: '' });
  const [clubNotes, setClubNotes] = useState({});
  const [heightOverride, setHeightOverride] = useState('');
  const [footOverride, setFootOverride] = useState('');
  const [showXValue, setShowXValue] = useState(false);
  const [showTierBadge, setShowTierBadge] = useState(false);
  const [overallOverride, setOverallOverride] = useState('');
  const [potentialOverride, setPotentialOverride] = useState('');
  const [overallUnclear, setOverallUnclear] = useState(false);
  const [potentialUnclear, setPotentialUnclear] = useState(false);
  const [xValueOverride, setXValueOverride] = useState('');

  const [clubsMode, setClubsMode] = useState('clubs');   // clubs | players
  const [hideFitScores, setHideFitScores] = useState(false);
  // UK by default because that's the working case; the toggle exists for the
  // times the honest answer is somewhere else.
  const [ukOnly, setUkOnly] = useState(true);
  // Kept PER MODE. A single list meant a club list could still be on screen after
  // switching to Similar Players — the clear-on-switch effect fired, but anything
  // added before the switch came back the moment you switched back, and a stale
  // render could show both at once. Two independent lists cannot cross over.
  const [manualByMode, setManualByMode] = useState({ clubs: null, players: null });
  const [rowQuery, setRowQuery] = useState('');

  const [peakFit, setPeakFit] = useState(null);
  const [peakState, setPeakState] = useState('idle');   // idle | loading | ok | none

  const ctx = useMemo(() => resolveSeason(player, seasonOverride), [player, seasonOverride]);

  // Only the slots actually drawn on the pitch get a box, so a percentage can
  // never be entered against a position the card doesn't show.
  // Slots the pitch draws = the player's own tokens PLUS anything switched on by
  // hand. A player listed only as CF can still be shown at AM and LW with a share
  // against each, which is the point of tracking minutes by position at all.
  const posKeyForEditor = useMemo(() => {
    const tok = String(player.position || '').split(',')[0].trim();
    return TOKEN_TO_POS_KEY[tok] || player.roleKey || 'CF';
  }, [player]);
  const autoSlots = useMemo(() => occupiedSlots(player, {}), [player]);
  const [extraSlots, setExtraSlots] = useState([]);
  const pagerSlots = useMemo(
    () => [...autoSlots, ...extraSlots.filter(sl => !autoSlots.includes(sl))],
    [autoSlots, extraSlots]);
  const swRows = useMemo(() => {
    try { return swEligible(resolveSeason(player, seasonOverride).sd, posKeyForEditor); }
    catch (e) { return []; }
  }, [player, seasonOverride, posKeyForEditor]);
  const swStrengthLabels = useMemo(
    () => swRows.filter(r => r.pct >= SW_HI).sort((a, b) => b.pct - a.pct).map(r => r.label),
    [swRows]);
  const swWeakLabels = useMemo(
    () => swRows.filter(r => r.pct <= SW_LO).sort((a, b) => a.pct - b.pct).map(r => r.label),
    [swRows]);

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
        ? computeSimilarPlayers(player, players || [], { ukOnly, topN: 8 })
        : computeClubFit(player, players || [], { ukOnly, topN: 8, peakFitByTeam: peakFit });
    } catch (e) {
      console.error('[PlayerPager] ranking failed:', e);
      return [];
    }
  }, [player, players, peakFit, clubsMode, ukOnly]);

  useEffect(() => { setRowQuery(''); }, [clubsMode]);
  // A UK shortlist is not a worldwide one, so changing scope drops the manual list.
  useEffect(() => { setManualByMode({ clubs: null, players: null }); }, [ukOnly]);

  const manualRows = manualByMode[clubsMode];
  const setManualRows = useCallback(
    (rows) => setManualByMode(m => ({ ...m, [clubsMode]: rows })), [clubsMode]);

  // Belt and braces: only rows of the right shape for the current mode are drawn,
  // so nothing stale can reach the card even if state gets out of step.
  const clubRows = useMemo(() => {
    const rows = manualRows || autoRows.slice(0, 3);
    return (rows || []).filter(r => r && (clubsMode === 'players' ? !!r.name : !r.name));
  }, [manualRows, autoRows, clubsMode]);

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
    if (q.length < 2) return ranked.slice(0, 8);
    if (clubsMode === 'players') {
      // Same freedom the club picker has: search every player in the pool, not
      // only the ones the model happened to rank. A hand-picked comparison carries
      // no match figure and the row prints a dash rather than inventing one.
      const seen = new Set(ranked.map(key));
      const extra = [];
      for (const pl of (players || [])) {
        if (!pl || !pl.name) continue;
        const k = `${pl.name}|${pl.team}`;
        if (seen.has(k) || chosen.has(k)) continue;
        if (!foldIncludes(pl.name, q) && !foldIncludes(pl.team || '', q)) continue;
        extra.push({ name: pl.name, team: pl.team, league: pl.league,
                     age: pl.age ?? null, score: pl.careerScore ?? null,
                     simPct: null, unranked: true });
        if (extra.length >= 12) break;
      }
      extra.sort((a, b) => (b.score || 0) - (a.score || 0));
      return [...ranked, ...extra].slice(0, 10);
    }
    const seen = new Set(ranked.map(r => r.team));
    const extra = teamOptions(players || [], rowQuery, 20)
      .filter(t => !seen.has(t.team) && !chosen.has(t.team))
      .map(t => ({ team: t.team, league: t.league, finalFit: null, unranked: true }));
    return [...ranked, ...extra].slice(0, 10);
  }, [autoRows, manualRows, rowQuery, clubsMode, players]);

  const buildOpts = () => ({
    headerColourName, seasonOverride, nameOverride, teamOverride,
    uploadedPhotoDataUrl, viewText, clubRows,
    clubsMode, hideFitScores, ukOnly, positionPcts,
    heatmapDataUrl, heatOpacity: Number(heatOpacity) / 100, shownSlots: pagerSlots,
    heightOverride, footOverride, showXValue, xValueOverride, showTierBadge,
    overallOverride, potentialOverride, overallUnclear, potentialUnclear,
    swDrop, swAddStr, swAddWeak, clubNotes,
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

          <Check label="League tier key under Overall & Potential"
                 value={showTierBadge} onChange={setShowTierBadge} />
          <Check label="Pitch diagram in the header (off = position / foot / xValue / contract)"
                 value={showPitch} onChange={setShowPitch} />
          <Check label="Career forecast (dashed line to potential)"
                 value={showForecast} onChange={setShowForecast} />
          <Check label="Career chart uses best role per season"
                 value={useBestRoleCareer} onChange={setUseBestRoleCareer} />

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
                                 setSwNew({ label: '', tone: 'Green', pct: '' }); }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 5, border: '1px solid #22c55e55',
                         background: swNew.label ? '#22c55e1e' : 'transparent',
                         color: swNew.label ? '#22c55e' : '#55617a', fontSize: 11, fontWeight: 700,
                         cursor: swNew.label ? 'pointer' : 'default' }}>+ Strength</button>
              <button disabled={!swNew.label}
                onClick={() => { setSwAddWeak(a => [...a, { label: swNew.label, tone: swNew.tone }]);
                                 setSwNew({ label: '', tone: 'Green', pct: '' }); }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 5, border: '1px solid #f8717155',
                         background: swNew.label ? '#f871711e' : 'transparent',
                         color: swNew.label ? '#f87171' : '#55617a',
                         fontSize: 11, fontWeight: 700,
                         cursor: swNew.label ? 'pointer' : 'default' }}>+ Weakness</button>
            </div>
            <div style={UI.note}>
              Manual weaknesses draw as red pills under the measured bars — no score
              needed, since it&rsquo;s a judgement rather than a percentile.
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

          <div style={UI.block}>
            <span style={UI.label}>Overall &amp; potential</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={overallOverride} inputMode="numeric"
                     onChange={e => setOverallOverride(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                     placeholder={player.careerScore != null ? String(Math.round(player.careerScore)) : 'Overall'}
                     disabled={overallUnclear}
                     style={{ ...UI.input, flex: 1, opacity: overallUnclear ? 0.45 : 1 }} />
              <input value={potentialOverride} inputMode="numeric"
                     onChange={e => setPotentialOverride(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                     placeholder={player.potentialScore != null ? String(Math.round(player.potentialScore)) : 'Potential'}
                     disabled={potentialUnclear}
                     style={{ ...UI.input, flex: 1, opacity: potentialUnclear ? 0.45 : 1 }} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Check label="Overall unclear (?)" value={overallUnclear} onChange={setOverallUnclear} />
              <Check label="Potential unclear (?)" value={potentialUnclear} onChange={setPotentialUnclear} />
            </div>
            <div style={UI.note}>
              Unclear draws an empty ring with a question mark and drops the tier badge —
              a score you don&rsquo;t trust shouldn&rsquo;t print as a number.
            </div>
          </div>

          <div style={{ ...UI.block, marginTop: 10 }}>
            <span style={UI.label}>Height &amp; foot</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={heightOverride} onChange={e => setHeightOverride(e.target.value)}
                     placeholder={cmToFeet(player.height) || 'Height'}
                     style={{ ...UI.input, flex: 1 }} />
              <input value={footOverride} onChange={e => setFootOverride(e.target.value)}
                     placeholder={(player.foot && player.foot !== 'unknown' && player.foot !== 'nan')
                                    ? formatFoot(player.foot) : 'Foot'}
                     style={{ ...UI.input, flex: 1 }} />
            </div>
            <div style={UI.note}>Blank uses the pipeline value.</div>

            <div style={{ marginTop: 10 }}>
              <Check label="Show xValue in the identity row"
                     value={showXValue} onChange={setShowXValue} />
              {showXValue && (
                <input value={xValueOverride} onChange={e => setXValueOverride(e.target.value)}
                       placeholder={player.xValue > 0 ? formatMV(player.xValue) : 'xValue'}
                       style={UI.input} />
              )}
            </div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Heatmap (optional)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ flex: 1, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                            padding: '7px 10px', borderRadius: 5, textAlign: 'center',
                            border: `1px solid ${heatRaw ? '#3b7de8' : '#1e2d45'}`,
                            background: heatRaw ? '#0e2040' : 'transparent',
                            color: heatRaw ? '#60a5fa' : '#8b98ad' }}>
              {heatRaw ? 'Heatmap loaded ✓' : 'Upload heatmap'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files && e.target.files[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = async (ev) => {
                    const raw = String(ev.target.result);
                    setHeatRaw(raw);
                    setHeatmapDataUrl(heatExtract ? await extractHeat(raw) : raw);
                  };
                  r.readAsDataURL(f);
                  e.target.value = '';
                }} />
            </label>
            {heatRaw && (
              <button onClick={() => { setHeatRaw(''); setHeatmapDataUrl(''); }}
                style={{ padding: '7px 10px', background: 'none', border: '1px solid #1e2d45',
                         borderRadius: 5, color: '#f87171', fontSize: 11, cursor: 'pointer' }}>✕</button>
            )}
          </div>
          {heatRaw && (
            <>
              <div style={{ marginTop: 8 }}>
                <Check label="Strip the pitch background (keep the heat only)"
                       value={heatExtract}
                       onChange={async (v) => {
                         setHeatExtract(v);
                         setHeatmapDataUrl(v ? await extractHeat(heatRaw) : heatRaw);
                       }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 10.5, color: '#94a3b8', width: 54, flexShrink: 0 }}>Strength</span>
                <input type="range" min="15" max="100" value={heatOpacity}
                  onChange={e => setHeatOpacity(e.target.value)}
                  style={{ flex: 1, accentColor: '#3b7de8' }} />
                <span style={{ fontSize: 10.5, color: '#64748b', width: 34, textAlign: 'right' }}>{heatOpacity}%</span>
              </div>
              <div style={UI.note}>
                Sits behind the pitch as a backdrop — it should read as where he
                operates, not as a chart competing with the position discs.
              </div>
            </>
          )}
          </div>

          <div style={UI.block}>
          <span style={UI.label}>Positions shown &amp; minutes split</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 8 }}>
            {ALL_PITCH_SLOTS.map(sl => {
              const on = pagerSlots.includes(sl);
              const locked = autoSlots.includes(sl);
              return (
                <button key={sl}
                  onClick={() => {
                    if (locked) return;
                    setExtraSlots(list => on ? list.filter(x => x !== sl) : [...list, sl]);
                    if (on) setPositionPcts(o => { const n = { ...o }; delete n[sl]; return n; });
                  }}
                  title={locked ? 'From the player\u2019s own position data' : ''}
                  style={{ padding: '3px 8px', marginRight: 5, marginBottom: 5, borderRadius: 10,
                           border: `1px solid ${on ? '#3b7de8' : '#1e2d45'}`,
                           background: on ? '#0e2040' : 'transparent',
                           color: on ? '#60a5fa' : '#8b98ad', opacity: locked ? 0.75 : 1,
                           fontSize: 10, fontWeight: 700,
                           cursor: locked ? 'default' : 'pointer' }}>{sl}</button>
              );
            })}
          </div>
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
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>% of minutes</span>
            </div>
          ))}
          <div style={UI.note}>
            {!pagerSlots.length ? 'Switch on the positions he plays.'
              : pctTotal === 0 ? 'Blank leaves the discs unlabelled.'
              : `${pctTotal}% assigned${pctTotal > 100 ? ' — over 100' : ''}`}
          </div>
          </div>

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

          <div style={UI.block}>
            <span style={UI.label}>
              GBE &amp; ESC — {gbe.total} pts &middot;{' '}
              <span style={{ color: gbe.pass ? '#4ade80' : gbe.panelEligible ? '#f0c56a' : '#f87171' }}>
                {gbe.status}
              </span>
            </span>
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

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #16233a' }}>
              <Check label="Force ESC eligible"
                     value={!!gbeOv.escOverride}
                     onChange={v => setG('escOverride', v ? true : '')} />
              {!!gbeOv.escOverride && (
                <select value={gbeOv.escReason || ''}
                        onChange={e => setG('escReason', e.target.value)}
                        style={{ ...UI.input, cursor: 'pointer' }}>
                  <option value="">Auto — use the detected reason</option>
                  {ESC_REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
              <div style={UI.note}>
                Shows the ESC line when the data can&rsquo;t see the route in — loan spells
                recorded oddly, continental minutes missing from the CSV.
              </div>
            </div>
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

            <span style={UI.label}>Scope</span>
            <div style={{ display: 'flex', marginBottom: 10 }}>
              {[[true, 'UK only'], [false, 'Worldwide']].map(([v, lbl], i) => (
                <button key={lbl} onClick={() => setUkOnly(v)}
                  style={{ flex: 1, padding: '6px 0', marginLeft: i ? 6 : 0, borderRadius: 5,
                           border: `1px solid ${ukOnly === v ? '#3b7de8' : '#1e2d45'}`,
                           background: ukOnly === v ? '#0e2040' : 'transparent',
                           color: ukOnly === v ? '#60a5fa' : '#94a3b8',
                           fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
              ))}
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
            {clubRows.map((r, i) => {
              const k = clubsMode === 'players' ? `${r.name}|${r.team}` : r.team;
              return (
                <div key={'note' + k + i} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ width: 74, flexShrink: 0, fontSize: 10, color: '#64748b',
                                 overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {clubsMode === 'players' ? r.name : r.team}
                  </span>
                  <input value={clubNotes[k] || ''} maxLength={CLUB_NOTE_MAX}
                    onChange={e => setClubNotes(o => ({ ...o, [k]: e.target.value.slice(0, CLUB_NOTE_MAX) }))}
                    placeholder="note, e.g. Mukendi replacement"
                    style={{ ...UI.input, flex: 1 }} />
                </div>
              );
            })}
            <div style={UI.note}>Notes print beside the league, {CLUB_NOTE_MAX} characters max.</div>

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
