// ManagerPager.js v2 — Manager All-in-One report. 1920x1080 PNG export.
//
// The coach equivalent of PlayerPager.js, which is itself the player equivalent
// of TeamReport.js. Geometry is PlayerPager's, verbatim: same 24px pad, same
// 150px header band, same 756 / 538 / 538 column split and the same
// 336 / 284 / 229 row heights. The three exports are meant to sit side by side
// in one pack and read as one system.
//
// WHAT REPLACES WHAT (PlayerPager slot -> ManagerPager slot)
//   player photo         -> coach photo (FotMob id, upload, or fallback)
//   club + league row    -> club + league row, minus height, foot and contract
//   Apps/Gls/Asts/xG/xA  -> Games / GF / GA / Pts / xPts / PPG
//   Overall + Potential  -> Overall + Potential (computeCoachScore)
//   position pitch       -> FORMATION pitch — the primary shape, over an Opta
//                           zones-of-control wash in the heatmap's place
//   GBE points + pips    -> GBE routes (36m cumulative / 24m consecutive), which
//                           for a manager are pass/fail rather than scored
//   percentile column    -> the same column, off computeCoachMetricGroups
//   6 bottom panels      -> six FREE slots. Every slot offers every panel
//                           (Style, Career, Team Context, Impact, Comparison,
//                           Strengths & Weaknesses, Potential Clubs, View,
//                           League Table, None), the way the Team Report's
//                           bottom row already lets either slot hold any panel.
//
// NOTHING IS REDRAWN HERE. Every renderer is imported from the card that already
// owns it — CoachQuickCard for the career chart, team context bands and impact
// radar, TeamReport for the wheel, the hex chart and the League Table,
// PlayerPager for the Potential Clubs rows, the strengths/weaknesses block and
// the heat extractor. Those declarations gained an `export` keyword and nothing
// else, so their existing callers are untouched and this file cannot drift from
// the other cards: if a bar colour changes in QuickCard it changes here in the
// same commit, because it is literally the same function.
//
// v3: the panel slots came unstuck. Each one used to offer only the panels tied to
// its own row — Impact/Comparison/S&W in the middle right, View/League Table in the
// bottom right — which meant League Table and View could never be on the same card,
// because they were two values of ONE control rather than two panels. There is now a
// single MP_PANELS list and six slots that all read it. Every renderer already took
// (w, h), so a panel drawn in row 1 and the same panel drawn in row 3 differ only in
// the height they are handed; Style was the one exception and now sizes to its own
// height too. Defaults reproduce the old card exactly.
//
// The formation pitch and the View body moved down to CoachQuickCard.js. The quick
// card needs both, and importing UP from it would have made a cycle — this file
// already imports the career chart, the team context bands and the impact radar from
// there. Same rule as ever: one implementation, imported, never redrawn.
//
// A manual birth date joins the identity row beside the age, in CoachCard's format.
// The age is computed from whichever date wins, since an age derived from one date
// printed beside another is worse than printing neither.
//
// v2 changes: contract is gone from the identity row (tenure only, and an
// Unattached state that reads as a state rather than a missing club); the pitch
// draws ONE shape by default; zones of control recolour into the card's palette
// and sit under the markings; Team Context centres and no longer wraps its
// labels; strengths and weaknesses speak manager language rather than printing
// raw team metric names; Similar Teams became Potential Clubs, with the player
// pager's own row renderer, its per-row notes and its free search.

import React, { useState, useMemo, useEffect } from 'react';
import {
  MONTSERRAT_EMBED_CSS, leagueDisplayName, leagueLogo, leagueFlag, teamCrest,
} from './cardAssets';
import { useIsMobile, deliverPng } from './utils';
import {
  scoreWheel, headerInk, preloadImages, fitNameSize, styleHexSvg, nameEmWidth,
  leagueTablePanelHtml, resolveSimilarTeams, leagueWindow, teamOptions,
  setSharedImageMap, foldIncludes, rankToPct, setPieceScore,
  HEADER_COLOURS, HEADER_COLOUR_NAMES,
} from './TeamReport';
import {
  countryToIso2, fadeHexToBG, computeAge, formatDOB,
  shortSeason, resolveStatsRow, FOTMOB_PHOTO_BASE, COACH_FORMATIONS,
} from './CoachCard';
import {
  computeCoachScore, careerChartSvg, teamContextHtml, impactRadarSvg,
  formationPitchSvg, viewPanelBody, FM_PRIMARY, FM_SECONDARY, FM_ON_IMAGE,
} from './CoachQuickCard';
import { computeCoachMetricGroups } from './coachMetrics';
import { barRow, scoreTierColor } from './QuickCard';
import {
  extractHeat, swBlockHtml, clubsPanelBody, setPagerImageMap,
  leagueAbbrev, SW_TONES, SW_HI, SW_LO,
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
// the percentile column, Team Context, the league table and the club list — has
// to come off the SAME row, or the card would describe two clubs at once for a
// coach who moved. Default is the most recent tenure, which is what both coach
// cards already do; the override key is "team|season" because that is the key
// resolveStatsRow already understands.
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

// ─── Zones of control ──────────────────────────────────────────────────────
// Opta's zones chart arrives as an opaque PNG on a white page: purple where the
// team wins the zone, pink where the opposition does, grey where it's contested,
// with black pitch markings drawn on top. Dropped straight onto the header it
// would be a white rectangle with someone else's palette sitting on a navy band.
//
// So it's remapped at upload time, on a canvas, before it reaches the card:
//   purple -> the card's green,  pink -> the card's red,  everything else -> gone.
// The test is saturation, then which of red and blue leads. Purple has blue
// above red, pink has red above blue, and grey, white and the black markings all
// have the three channels within a few points of each other — so one threshold
// separates the three states without needing to know Opta's exact hexes.
//
// Contested zones going transparent is the point rather than a shortcut: the
// card then shows its own pitch through them, which is what makes the wash read
// as part of the design instead of as a screenshot pasted on top.
//
// The crop is taken from the BLACK MARKINGS, not from the coloured pixels. The
// chart has a white margin and its outer touchline is the only reliable edge; a
// bounding box of coloured pixels would cut off any grey zone that happens to
// sit on the flank, and every zone after it would be drawn in the wrong place.
export function extractZones(dataUrl) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 1200;
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          const g = c.getContext('2d');
          g.drawImage(img, 0, 0, c.width, c.height);
          const data = g.getImageData(0, 0, c.width, c.height);
          const px = data.data;

          // Pass 1 — the pitch outline, so the wash lands where the pitch is.
          let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
          for (let i = 0; i < px.length; i += 4) {
            if (px[i] < 110 && px[i + 1] < 110 && px[i + 2] < 110 && px[i + 3] > 40) {
              const p = i / 4, x = p % c.width, y = (p / c.width) | 0;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }

          // Pass 2 — recolour.
          const GREEN = [0, 191, 99], RED = [255, 49, 49];
          let any = false;
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i], gg = px[i + 1], b = px[i + 2];
            const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
            if (sat < 34) { px[i + 3] = 0; continue; }   // grey / white / markings
            const tint = b > r ? GREEN : RED;            // purple -> green, pink -> red
            px[i] = tint[0]; px[i + 1] = tint[1]; px[i + 2] = tint[2]; px[i + 3] = 255;
            any = true;
          }
          if (!any) return resolve(dataUrl);             // not a zones chart — use it raw
          g.putImageData(data, 0, 0);

          if (maxX <= minX || maxY <= minY) return resolve(c.toDataURL('image/png'));
          const cw = maxX - minX + 1, ch = maxY - minY + 1;
          const c2 = document.createElement('canvas');
          c2.width = cw; c2.height = ch;
          c2.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
          resolve(c2.toDataURL('image/png'));
        } catch (e) { resolve(dataUrl); }                // tainted canvas etc
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch (e) { resolve(dataUrl); }
  });
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
// teamContextHtml lays its rows out with space-between inside whatever box it's
// given, which is right for the quick card's tall tile and wrong here: one or
// two rows in a 210px box left the first pinned to the top and the last to the
// bottom with a canyon between them, and the tile read as broken rather than as
// sparse.
//
// So the BLOCK is sized to its own content — n rows at their natural height —
// and that block is centred in the tile. Two rows then sit as a pair in the
// middle, four fill the tile, and the internal spacing is the same either way.
// Only when the natural height exceeds the tile does anything scale, which keeps
// the bars proportioned exactly as the quick card draws them.
// Measured off the markup, twice adjusted. 62 assumed the Low / "Rank 18 of 20" /
// High caption was one line; on a 498px tile it wrapped, which added ~12px to
// every row and pushed the fourth category off the bottom edge. The caption is
// nowrap now, and the reserve is deliberately generous on top of that: label 20 +
// bar 14 + caption 12 + flex gap 12 measures 58, and over-reserving costs a
// slightly smaller chart where under-reserving costs a clipped row. Only one of
// those looks broken. The player pager reserves 80 for the same reason.
const TC_ROW_H = 76;

function teamContextBody(w, h, tc, ageVal, agePct, markPct) {
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
  const natural = n * TC_ROW_H;
  const scale = Math.min(1, h / natural);
  const blockH = Math.min(h, natural);
  const top = Math.max(0, Math.round((h - blockH) / 2));
  return `<div style="position:absolute;inset:0;overflow:hidden;">
      <div style="position:absolute;left:0;top:${top}px;
                  width:${Math.round(w / scale)}px;height:${Math.round(blockH / scale)}px;
                  display:flex;flex-direction:column;
                  transform:scale(${scale.toFixed(4)});transform-origin:top left;">
        ${teamContextHtml(tc || {}, ageVal, agePct, markPct)}
      </div>
    </div>`;
}


// ─── Formation block ───────────────────────────────────────────────────────
// The pitch renderer itself moved to CoachQuickCard.js so the quick card can
// draw the SAME pitch — importing it up from here would have made a cycle.
// Only this block, which is pager geometry, stayed.
//
// Same block geometry as the player pager's position block: a 236px text column,
// a 20px gutter and a 188px pitch, nudged 14px left of centre for the same
// reason (the right-hand rule butts onto GBE while the left has the wheels' air).
// The player pager reserves 236px of text because "Defensive Midfielder" needs
// it. "4-2-3-1" needs 128, and handing the other 108 to the pitch buys ~35% more
// drawing area at the same aspect. Height is bounded by the band rather than by
// the text: 8..142 inside a 150px header clears the photo's own 2..148.
const FB_PITCH_H = 134;
const FB_PITCH_W = Math.round(FB_PITCH_H * (320 / 208));   // 206
const FB_GAP = 36;
const FB_TEXT_W = 128;

function formationBlockHtml(x, w, ink, primary, secondary, mapUrl, mapOpacity, showDots, showSecondary) {
  const textW = FB_TEXT_W;
  const longest = Math.max(nameEmWidth(primary || '—'), nameEmWidth(secondary || '—'));
  const fs = Math.max(15, Math.min(24, Math.floor(textW / (longest || 1))));
  const groupW = textW + FB_GAP + FB_PITCH_W;
  // 14 left of centre. True centre reads right-heavy here: the right-hand rule
  // butts straight onto the GBE tiles while the left has the wheels' air beside
  // it. The gutter above does the rest — at 18px the pitch sat on the shoulder of
  // "SECONDARY FORMATION" and the two blocks read as one.
  const left = x + Math.max(0, Math.round((w - groupW) / 2)) - 14;
  const dotCol = mapUrl ? FM_ON_IMAGE : FM_PRIMARY;
  return `
    <div style="position:absolute;left:${left}px;top:26px;width:${textW}px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:0.14em;color:${ink.muted};
                  white-space:nowrap;">PRIMARY FORMATION</div>
      <div style="margin-top:9px;display:flex;align-items:center;white-space:nowrap;">
        ${(showDots && showSecondary && secondary) ? `<span style="width:9px;height:9px;
                     border-radius:50%;flex-shrink:0;background:${dotCol};margin-right:9px;"></span>` : ''}
        <span style="font-size:${fs}px;font-weight:700;color:${ink.primary};
                     line-height:1.05;">${esc(primary || '—')}</span>
      </div>
      <div style="margin-top:14px;font-size:8px;font-weight:700;letter-spacing:0.14em;
                  color:${ink.muted};white-space:nowrap;">SECONDARY FORMATION</div>
      <div style="margin-top:9px;display:flex;align-items:center;white-space:nowrap;">
        ${(secondary && showDots && showSecondary) ? `<span style="width:9px;height:9px;border-radius:50%;
                     flex-shrink:0;border:2px solid ${mapUrl ? 'rgba(255,255,255,0.65)' : FM_SECONDARY};
                     box-sizing:border-box;margin-right:9px;"></span>` : ''}
        <span style="font-size:${fs}px;font-weight:700;color:${ink.muted};
                     line-height:1.05;">${secondary ? esc(secondary) : '&mdash;'}</span>
      </div>
    </div>
    <div style="position:absolute;left:${left + textW + FB_GAP}px;top:8px;
                width:${FB_PITCH_W}px;height:${FB_PITCH_H}px;">
      ${formationPitchSvg(primary, secondary, FB_PITCH_W, FB_PITCH_H, mapUrl, mapOpacity, showDots, showSecondary)}
    </div>`;
}

// ─── Strengths & weaknesses, in manager language ───────────────────────────
// The percentile column prints the METRIC names, which is right for a column of
// bars — "Passes to Final 3rd" beside a bar is a measurement and reads as one.
// As a strength pill it isn't: a pill saying "Dribbles" claims the manager is
// good at dribbling, and "Passes" claims nothing at all.
//
// So the same translation the player pager does per position, done here per
// metric: a label a scout would write, and null for the metrics that shouldn't
// be eligible at all. The exclusions are all VOLUME measures — how much a side
// crosses, dribbles, duels or plays long is a description of how they play, not
// of how well. Elche's 19th-percentile Dribbles was printing as a weakness when
// what it actually says is that they don't dribble, which is a style choice and
// on this card is already stated three tiles away.
//
// HI/LO thresholds are the player pager's, imported rather than repeated.
const MP_SW_LABELS = {
  // Attacking
  'Goals Scored': 'Scoring Goals',
  'xG': 'Creating Chances',
  'Shots': 'Shot Volume',
  'Touches in Box': 'Penalty Box Entries',
  'Shooting %': null,
  'Crosses': null,
  // Defensive
  'Goals Against': 'Conceding Goals',
  'xG Against': 'Chance Prevention',
  'Shots Against': 'Conceding Shots',
  'PPDA': 'Pressing Intensity',
  'Aerial Duel Success %': 'Winning Aerials',
  'Defensive Duel Win %': 'Winning Duels',
  'Aerial Duels': null,
  'Defensive Duels': null,
  // Possession
  'Possession': 'Control',
  'Passing Accuracy %': 'Passing Retention',
  'Passes to Final 3rd': 'Territorial Progression',
  'Progressive Passes': 'Progression',
  'Long Passing %': null,
  'Passes': null,
  'Long Passes': null,
  'Dribbles': null,
  'Progressive Runs': null,
};


// Attacking and defending are kept SEPARATE here even though Style shows the
// average of the two. A side ranked 2nd for attacking corners and 19th for
// defending them averages to unremarkable, which is the one reading that tells
// you nothing: the point is that one of those is a weapon and the other a leak.
function mpSwEligible(mg, spAttPct = null, spDefPct = null) {
  const lower = {};
  for (const k of Object.keys(MP_SW_LABELS)) lower[k.toLowerCase()] = MP_SW_LABELS[k];
  const best = {};
  for (const k of MG_KEYS) {
    for (const r of (mg[k] || [])) {
      if (!r || r.label == null) continue;
      const pct = Number(r.pct);
      if (isNaN(pct)) continue;
      const label = lower[String(r.label).toLowerCase().trim()];
      if (!label) continue;                 // null or absent = not eligible
      if (best[label] == null || pct > best[label]) best[label] = pct;
    }
  }
  // These arrive as percentiles already — rankToPct did the conversion — so they
  // meet the same 70/30 thresholds as everything else with no special casing.
  //
  // When both sides land on the SAME side of the line they collapse into one
  // entry. Two bars reading "Defending Set Pieces 5" and "Attacking Set Pieces 10"
  // spend two of three weakness slots making one point, and squeeze out a real
  // second problem. Split them only when they disagree, which is the case where
  // the distinction is the finding.
  const spA = (spAttPct != null && !isNaN(Number(spAttPct))) ? Number(spAttPct) : null;
  const spD = (spDefPct != null && !isNaN(Number(spDefPct))) ? Number(spDefPct) : null;
  if (spA != null && spD != null
      && ((spA >= SW_HI && spD >= SW_HI) || (spA <= SW_LO && spD <= SW_LO))) {
    best['Set Pieces'] = (spA + spD) / 2;
  } else {
    if (spA != null) best['Attacking Set Pieces'] = spA;
    if (spD != null) best['Defending Set Pieces'] = spD;
  }
  return Object.keys(best).map(label => ({ label, pct: best[label] }));
}

// Judgements no metric measures. These are the manager equivalent of the player
// pager's SW_MANUAL_TERMS — that list is Pace and Weak Foot, which say nothing
// about a head coach. Alphabetical rather than grouped, for the same reason:
// in a long dropdown you're scanning for a word you've already chosen.
// Every panel this card can draw, offered to EVERY slot — the same rule the Team
// Report's bottom row already follows, where either slot holds any panel. Each slot
// used to offer only the panels tied to its own row, which is why League Table and
// View could never appear together: they were two values of one control.
//
// Every renderer below takes (w, h), so a panel drawn in row 1 and the same panel
// drawn in row 3 differ only in the height they are handed. Nothing is row-specific.
export const MP_PANELS = [
  'Style', 'Career', 'Team Context', 'Impact', 'Comparison',
  'Strengths & Weaknesses', 'Potential Clubs', 'View', 'League Table', 'None',
];
// What each slot draws unless told otherwise — exactly the card as it was before
// the slots became free, so an untouched report exports unchanged.
export const MP_SLOT_DEFAULTS = {
  a1: 'Style', b1: 'Career',
  a2: 'Team Context', b2: 'Impact',
  a3: 'Potential Clubs', b3: 'View',
};
export const MP_SLOT_KEYS = ['a1', 'b1', 'a2', 'b2', 'a3', 'b3'];

export const MP_MANUAL_TERMS = [
  'Adaptability', 'Attacking Set Pieces', 'Board Relations', 'Build-Up Structure',
  'Counter-Attacking', 'Counter-Pressing', 'Defending Set Pieces',
  'Defensive Organisation', 'Defensive Transitions', 'Developing Young Players',
  'Discipline', 'Elite Player Management', 'Facing a Low Block', 'Game Management',
  'High Defensive Line', 'In-Game Adaptation', 'Injury Record', 'Loan Market Use',
  'Low Block Defending', 'Man Management', 'Media Handling', 'Midfield Control',
  'Off-Ball Structure', 'Overload Creation', 'Playing Out From The Back',
  'Pressing Structure', 'Pressing Triggers', 'Promoting From The Academy',
  'Recruitment Judgement', 'Resilience', 'Rotation Management', 'Second Balls',
  'Set-Piece Coaching', 'Squad Building', 'Squad Cohesion', 'Staff Retention',
  'Style Consistency', 'Tactical Flexibility', 'Territorial Dominance',
  'Transitional Play', 'Wide Overloads', 'Winning Mentality', 'Work Rate',
  'Working To A Budget', 'Working With A Young Squad',
];


// ─── Impact ────────────────────────────────────────────────────────────────
function impactBody(h, rowA, rowB, pool, labelA, labelB, subA, subB) {
  return `<div style="position:absolute;inset:0;display:flex;align-items:center;
            justify-content:center;height:${h}px;">
      ${impactRadarSvg(rowA, rowB, pool, labelA, labelB, subA, subB)}
    </div>`;
}

// ─── Potential Clubs ───────────────────────────────────────────────────────
// The player pager's own Potential Clubs renderer, called with clubs rather than
// players — same 9px card, same #n index, same 26px crest, same league flag and
// the same pink note beside it. Nothing is redrawn, so the two cards' club lists
// are the same object.
//
// Where the ranking comes from is the honest difference. A player has a fit
// model; a manager doesn't, so the ordering is the SIMILARITY of each club to
// the one he is at — which is a defensible proxy (a side that plays and is
// resourced like his current one is a side he'd walk into) and is labelled as
// such in the panel's right-hand slot rather than passed off as a fit score.
function potentialClubRows(statsRow, allTeams, n = 8) {
  try {
    return resolveSimilarTeams(statsRow || {}, allTeams, n)
      .map(t => ({ team: t.team, league: t.league, finalFit: t.__sim }));
  } catch (e) { return []; }
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
    gbeOv, unattached, tenureOverride,
    showFormation, primaryFormation, secondaryFormation,
    positionMapUrl, mapOpacity, showFormationDots, showSecondaryShape,
    score, potential, overallOverride, potentialOverride,
    overallUnclear, potentialUnclear,
    allTeams, dobOverride,
  } = opts;

  const ink = headerInk(headerColour);
  const displayName = (nameOverride && nameOverride.trim()) || coach.name || '';
  const displayTeam = (teamOverride && teamOverride.trim()) || team;
  const photo = uploadedPhotoDataUrl || coachPhotoUrl(coach) || PHOTO_FALLBACK;
  const crest = teamCrest(team);
  const logo = leagueLogo(league);
  const flag = leagueFlag(league);
  const LONG_CLUB = String(displayTeam || '').length > 12;
  const natIso = countryToIso2(coach.nationality || '');
  const natFlag = natIso ? `https://flagcdn.com/w80/${natIso}.png` : '';
  // A typed birth date beats the saved one, and the age is computed from whichever
  // wins — an age derived from one date printed beside another is worse than
  // printing neither. The date joins the identity row's own dot-separated list, so
  // it sits beside the age exactly as the coach card prints it beside "years old".
  const dob = String(dobOverride || coach.dob || '').trim();
  const age = computeAge(dob);

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
  const tenure = (tenureOverride && tenureOverride.trim()) || coach.tenure || '';

  // UNATTACHED reads as a STATE, not as a missing club. The crest still draws,
  // dimmed, with the club named in the muted ink and a small tag after it — a
  // manager between jobs is defined by where he last was, so removing the club
  // entirely lost the one thing a reader wants. The league badge and flag go,
  // because he isn't in that league any more.
  const clubBlock = unattached ? `
      ${crest ? `<div style="width:23px;height:23px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;opacity:0.55;
                  background-image:url('${src(crest)}');"></div>` : ''}
      <span style="font-size:20px;font-weight:700;color:${ink.muted};${crest ? 'margin-left:9px;' : ''}">${esc(truncateText(displayTeam, 16))}</span>
      <span style="font-size:9px;font-weight:700;letter-spacing:0.14em;color:${ink.muted};
                   border:1px solid ${ink.rule};border-radius:4px;padding:3px 8px;
                   margin-left:11px;">UNATTACHED</span>`
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
                   color:${ink.muted};margin-left:12px;">${esc(leagueAbbrev(league))}</span>`;

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
      const uploaded = !!uploadedPhotoDataUrl || (!!photo && photo.startsWith('data:'));
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

    <!-- Club, league and the coach's own details on ONE row. No height, no foot
         and no contract: the first two mean nothing for a manager and the third
         is a number that dates the card the moment it's wrong. Tenure says how
         long he's been there, which is the thing a reader actually uses. -->
    <div style="position:absolute;left:${NAME_X}px;top:78px;display:flex;align-items:center;
                white-space:nowrap;">
      ${clubBlock}

      <span style="width:1px;height:16px;background:${ink.rule};margin:0 6px 0 7px;flex-shrink:0;"></span>

      ${natFlag ? `<div style="width:21px;height:13px;flex-shrink:0;background-size:cover;
                  background-position:center;border-radius:2px;margin-right:8px;
                  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);
                  background-image:url('${src(natFlag)}');"></div>` : ''}
      ${[age != null ? `${age} y.o.` : null, dob ? formatDOB(dob) : null, tenure || null]
        .filter(Boolean).map((v, i) => `
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
         beside it, over the zones wash if one is loaded. -->
    ${showFormation ? formationBlockHtml(PITCH_X, PITCH_W, ink, primaryFormation,
        secondaryFormation, positionMapUrl, mapOpacity, showFormationDots, showSecondaryShape) : `
    <div style="position:absolute;left:${PITCH_X}px;top:38px;width:${PITCH_W}px;">
      ${[['FORMATION', primaryFormation || '—'],
         ['ALTERNATIVE', secondaryFormation || '—'],
         ['TENURE', tenure || '—'],
        ].map(([k, v], i) => `
        <div style="position:absolute;left:0;top:${i * 26}px;font-size:8px;font-weight:700;
                    letter-spacing:0.13em;color:${ink.muted};">${k}</div>
        <div style="position:absolute;left:110px;top:${i * 26 - 3}px;font-size:13px;font-weight:700;
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
export function managerPagerImageUrls(coach, ctx, uploadedPhotoDataUrl, allTeams = [], clubRows = []) {
  const urls = [
    uploadedPhotoDataUrl ? '' : coachPhotoUrl(coach),
    leagueLogo(ctx.league),
    leagueFlag(ctx.league),
    teamCrest(ctx.team),
    PHOTO_FALLBACK,
  ];
  const iso = countryToIso2(coach.nationality || '');
  if (iso) urls.push(`https://flagcdn.com/w80/${iso}.png`);

  // Potential Clubs crests AND their league flags — the row prints both, so
  // missing either leaves a hole in the export.
  for (const t of (clubRows && clubRows.length
    ? clubRows : potentialClubRows(ctx.statsRow || {}, allTeams, 3))) {
    if (!t || !t.team) continue;
    urls.push(teamCrest(t.team));
    if (t.league) urls.push(leagueFlag(t.league));
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
    uploadedPhotoDataUrl = '', viewText = '', dobOverride = '',
    tenureOverride = '', unattached = false,
    primaryFormation = '', secondaryFormation = '',
    showFormation = true, showFormationDots = true, showSecondaryShape = false,
    positionMapUrl = '', mapOpacity = 0.15,
    careerMode = 'score', finishOverrides = {}, extraFinish = [],
    teamContext = {},
    slots = {},                   // slot key -> any name in MP_PANELS
    clubsTitle = 'Potential Clubs',
    impactRowA = null, impactRowB = null,
    clubRows = null, clubNotes = {}, hideFitScores = false,
    styleKeys = null, traitOv = {}, setPiecesPct = null,
    spAttPct = null, spDefPct = null,
    overallOverride = '', potentialOverride = '',
    overallUnclear = false, potentialUnclear = false,
    gbeOv = {},
    swDrop = [], swAddStr = [], swAddWeak = [],
  } = opts;

  IMG = images || {};
  // Potential Clubs is PlayerPager's renderer and the League Table is
  // TeamReport's; both resolve crests through their OWN module image map rather
  // than this file's. Point all three at the same preloaded set or those panels
  // would be the only things on the card still holding remote references.
  try { setSharedImageMap(images || {}); } catch (e) { /* older TeamReport build */ }
  try { setPagerImageMap(images || {}); } catch (e) { /* older PlayerPager build */ }

  const ctx = resolveTenure(tenureRows, statsSeasonKey);
  const { statsRow, sortedDesc } = ctx;
  const age = computeAge(dobOverride || coach.dob);
  const pool = (allTeams && allTeams.length) ? allTeams : tenureRows;

  const { score, potential, perSeason } = computeCoachScore(tenureRows, age, { seasonPerf });

  // Style hexes. Traits are 0-100 already; a saved override is 1-10, so it is
  // scaled the same way both coach cards scale it.
  // Order of authority: what you typed on this card, then the coach's saved
  // 1-10 override, then the computed trait. Set Pieces has no metric behind it
  // at all, so without the first of those it can only ever be changed by editing
  // the coach — which is a round trip for a number you're deciding as you build
  // the card.
  const getTrait = (key) => {
    // Set pieces aren't in the data at any level, so there is nothing to compute.
    // Two league ranks averaged into a percentile is the route the team report
    // already uses, and reusing it means a side rated 4th for attacking corners
    // scores the same here as it does there.
    if (key === 'setPieces' && setPiecesPct != null) return Number(setPiecesPct);
    const t = traitOv && traitOv[key];
    if (t !== '' && t != null && !isNaN(Number(t))) return Number(t) * 10;
    if (coach.traitOverrides && coach.traitOverrides[key] != null) return coach.traitOverrides[key] * 10;
    return traits ? traits[key] : null;
  };
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

  // Where they actually finished, on the same 0-100 scale the context bars use,
  // so the tick sits comparably against squad cost and the betting forecast.
  const finRank = num(statsRow.pointsRank);
  const finSize = num(statsRow.leagueSize)
    || (rankIn(pool, statsRow, 'points') || {}).size || null;
  const finishPct = (finRank != null && finSize != null && finSize > 1)
    ? clamp(((finSize - finRank) / (finSize - 1)) * 100) : null;

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

  // Sized to the height it is HANDED, not to row 1's — Style can now sit in any of
  // the three rows and the hexes have to centre in whichever one it lands in.
  const styleBody = (h) => {
    if (!styleRows.length) {
      return `<div style="position:absolute;inset:0;display:flex;align-items:center;
                   justify-content:center;font-size:12px;color:#55617a;">No trait scores.</div>`;
    }
    const rowH = Math.max(30, Math.min(40, Math.floor((h - 6) / (styleRows.length || 1))));
    return `<div style="position:absolute;left:0;top:${
      Math.max(0, Math.round((h - (styleRows.length * rowH + 6)) / 2))
    }px;">${styleHexSvg(styleRows, innerW, h, 176)}</div>`;
  };

  const swRows = mpSwEligible(mg, spAttPct, spDefPct);
  const rowA = impactRowA || sortedDesc[sortedDesc.length - 1] || null;
  const rowB = impactRowB || sortedDesc[0] || null;
  const clubs = (clubRows && clubRows.length) ? clubRows : potentialClubRows(statsRow, allTeams, 3);

  // One renderer per panel name, keyed by the name the dropdown shows. Returns the
  // panel's title, its right-hand caption and its body for the height it is given.
  // Nothing here knows which slot it is in — that is the whole point.
  const panelFor = (kind, h) => {
    switch (kind) {
      case 'Style':
        return { title: 'Style', body: styleBody(h) };
      case 'Career':
        return { title: 'Career',
                 body: `<div style="position:absolute;left:0;top:0;">${
                   careerChartSvg(careerPts, innerW, h, careerMode)}</div>` };
      case 'Team Context':
        return { title: 'Team Context',
                 body: teamContextBody(innerW, h, teamContext, ageVal, agePct, finishPct) };
      case 'Impact':
      case 'Comparison':
        // Same radar; the title is the claim being made about it, as before.
        return { title: kind,
                 body: impactBody(h, rowA, rowB, pool,
                   rowA ? String(rowA.team || '') : '', rowB ? String(rowB.team || '') : '',
                   rowA ? String(rowA.league || '') : '', rowB ? String(rowB.league || '') : '') };
      case 'Strengths & Weaknesses':
        return { title: 'Strengths &amp; Weaknesses',
                 body: swBlockHtml(innerW, h, swRows, { swDrop, swAddStr, swAddWeak }) };
      case 'Potential Clubs':
        // A hand-typed note is a scout's own words, so it takes the body ink
        // rather than the pink the player card uses. Pink there is the only
        // editorial mark on the tile; here it read as a second accent arguing
        // with the panel title two lines above it.
        return { title: esc(clubsTitle),
                 body: clubsPanelBody(innerW, h, clubs, false, 'clubs', hideFitScores,
                                      clubNotes, '#c8d2e0') };
      case 'View':
        return { title: 'View', body: viewPanelBody(innerW, h, viewText) };
      case 'League Table':
        return { title: 'League Table',
                 right: [leagueDisplayName(ctx.league) || ctx.league, shortSeason(ctx.season)]
                          .filter(Boolean).join(' · '),
                 body: leagueTablePanelHtml(innerW, h, statsRow, allTeams) };
      default:
        return null;                      // 'None', or anything unrecognised
    }
  };

  const SLOT_BOXES = {
    a1: { x: COL_A_X, y: ROW_1, h: ROW1_H, ih: row1InnerH },
    b1: { x: COL_B_X, y: ROW_1, h: ROW1_H, ih: row1InnerH },
    a2: { x: COL_A_X, y: ROW_2, h: ROW2_H, ih: row2InnerH },
    b2: { x: COL_B_X, y: ROW_2, h: ROW2_H, ih: row2InnerH },
    a3: { x: COL_A_X, y: ROW_3, h: ROW3_H, ih: row3InnerH },
    b3: { x: COL_B_X, y: ROW_3, h: ROW3_H, ih: row3InnerH },
  };
  const slotsHtml = MP_SLOT_KEYS.map(key => {
    const box = SLOT_BOXES[key];
    const kind = slots[key] || MP_SLOT_DEFAULTS[key];
    const spec = panelFor(kind, box.ih);
    if (!spec) return '';
    return panel({ x: box.x, y: box.y, w: COL_W, h: box.h,
                   title: spec.title, right: spec.right || '', body: spec.body });
  }).join('');

  container.innerHTML = `
    <div id="mp-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(coach, ctx, {
        headerColour, nameOverride, teamOverride, uploadedPhotoDataUrl, dobOverride,
        gbeOv, unattached, tenureOverride,
        showFormation, primaryFormation, secondaryFormation,
        positionMapUrl, mapOpacity, showFormationDots, showSecondaryShape,
        score, potential, overallOverride, potentialOverride,
        overallUnclear, potentialUnclear, allTeams: pool,
      })}

      ${panel({
        x: PAD, y: BODY_TOP, w: LEFT_W, h: LEFT_H,
        title: 'Performance',
        right: [shortSeason(ctx.season), ctx.team, leagueDisplayName(ctx.league) || ctx.league]
                 .filter(Boolean).join(' · '),
        body: percentilePanelBody(leftInnerW, leftInnerH, mg),
      })}

      ${slotsHtml}
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

function TeamSeasonPicker({ label, value, teams, onPick, onClear }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const t = q.trim();
    if (t.length < 2) return [];
    const out = [];
    for (const r of (teams || [])) {
      if (!r || !r.team) continue;
      if (!foldIncludes(r.team, t)) continue;
      out.push(r);
      if (out.length >= 24) break;
    }
    return out.sort((a, b) => (a.season < b.season ? 1 : -1)).slice(0, 10);
  }, [q, teams]);

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5,
                    background: '#0d1220', border: '1px solid #1e2d45',
                    borderRadius: 6, padding: '5px 8px' }}>
        <span style={{ width: 16, flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#475569' }}>{label}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: '#e2e8f4',
                       overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {value.team}<span style={{ color: '#64748b' }}> · {shortSeason(value.season)}</span>
        </span>
        <button onClick={onClear}
          style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#64748b',
                   cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#475569' }}>{label}</span>
        <input value={q} onChange={e => setQ(e.target.value)}
               placeholder="Search any club…" style={{ ...UI.input, flex: 1 }} />
      </div>
      {hits.map((r, i) => (
        <div key={r.team + r.season + i}
             onClick={() => { onPick(r); setQ(''); }}
             style={{ display: 'flex', alignItems: 'center', cursor: 'pointer',
                      padding: '5px 8px', borderBottom: '1px solid #101a2c' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#c8d2e0',
                         overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {r.team}<span style={{ color: '#64748b' }}> · {r.league} · {shortSeason(r.season)}</span>
          </span>
        </div>
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
// The note shares a 498px line with a flag and a league name, so it has to be
// short enough that the row never wraps. Same cap as the player pager's.
const CLUB_NOTE_MAX = 26;

export default function ManagerPagerModal({
  coach, tenureRows = [], traits = {}, allTeams = [], seasonPerf = {},
  squadValueRanks = {}, onClose,
}) {
  const isMobile = useIsMobile();

  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

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
  const [showSecondaryShape, setShowSecondaryShape] = useState(false);
  const [mapRaw, setMapRaw] = useState('');
  const [positionMapUrl, setPositionMapUrl] = useState('');
  const [mapMode, setMapMode] = useState('zones');   // zones | raw | heat
  const [mapOpacity, setMapOpacity] = useState(15);

  const [careerMode, setCareerMode] = useState('score');
  // Slot key -> panel name. Every slot offers every panel, so the shape of the card
  // is chosen rather than fixed by the row a panel happens to belong to.
  const [slots, setSlots] = useState(MP_SLOT_DEFAULTS);
  const setSlot = (key, kind) => setSlots(o => ({ ...o, [key]: kind }));
  const slotHas = (kind) => MP_SLOT_KEYS.some(k => slots[k] === kind);

  const [overallOverride, setOverallOverride] = useState('');
  const [potentialOverride, setPotentialOverride] = useState('');
  const [overallUnclear, setOverallUnclear] = useState(false);
  const [potentialUnclear, setPotentialUnclear] = useState(false);

  const [styleKeys, setStyleKeys] = useState(
    ['possession', 'pressing', 'attacking', 'defensive', 'directness', 'passing', 'setPieces']);

  const [tcRanks, setTcRanks] = useState({ squadValue: '', wageBill: '', odds: '' });
  const [leagueSizeOv, setLeagueSizeOv] = useState('');

  const [impactA, setImpactA] = useState(null);
  const [impactB, setImpactB] = useState(null);
  const [clubsTitle, setClubsTitle] = useState('Potential Clubs');
  const [traitOv, setTraitOv] = useState({});
  const [spAtt, setSpAtt] = useState('');
  const [spDef, setSpDef] = useState('');

  const [manualClubs, setManualClubs] = useState(null);
  const [clubNotes, setClubNotes] = useState({});
  const [hideFitScores, setHideFitScores] = useState(false);
  const [clubQuery, setClubQuery] = useState('');

  const [gbeOv, setGbeOv] = useState({ c36: false, c24: false, exceptions: false, exceptionsText: '' });

  const [swDrop, setSwDrop] = useState([]);
  const [swAddStr, setSwAddStr] = useState([]);
  const [swAddWeak, setSwAddWeak] = useState([]);
  const [swNew, setSwNew] = useState({ label: '', tone: 'Green' });

  const ctx = useMemo(() => resolveTenure(tenureRows, statsSeasonKey), [tenureRows, statsSeasonKey]);
  const pool = useMemo(() => ((allTeams && allTeams.length) ? allTeams : tenureRows), [allTeams, tenureRows]);
  const [dobOverride, setDobOverride] = useState('');
  const age = useMemo(() => computeAge(dobOverride || coach.dob),
    [dobOverride, coach.dob]);
  const scores = useMemo(
    () => computeCoachScore(tenureRows, age, { seasonPerf }),
    [tenureRows, age, seasonPerf]);

  const spLeagueSize = leagueSizeOv !== '' ? Number(leagueSizeOv)
    : (ctx.statsRow && ctx.statsRow.leagueSize != null ? Number(ctx.statsRow.leagueSize) : 20);
  const setPiecesPct = setPieceScore(spAtt, spDef, spLeagueSize);
  const spAttPct = rankToPct(spAtt, spLeagueSize);
  const spDefPct = rankToPct(spDef, spLeagueSize);

  const rowByKey = (key) => (tenureRows || []).find(r => `${r.team}|${r.season}` === key) || null;

  const seasonOptions = useMemo(() => [...(tenureRows || [])]
    .sort((a, b) => (a.season < b.season ? 1 : -1))
    .map(r => ({ key: `${r.team}|${r.season}`, label: `${shortSeason(r.season)} — ${r.team}` })),
    [tenureRows]);

  const mg = useMemo(() => computeCoachMetricGroups([ctx.statsRow])
    || { Attack: [], Defence: [], Possession: [] }, [ctx.statsRow]);
  const swRows = useMemo(() => mpSwEligible(mg, spAttPct, spDefPct), [mg, spAttPct, spDefPct]);
  const swStrengthLabels = useMemo(
    () => swRows.filter(r => r.pct >= SW_HI).sort((a, b) => b.pct - a.pct).map(r => r.label), [swRows]);
  const swWeakLabels = useMemo(
    () => swRows.filter(r => r.pct <= SW_LO).sort((a, b) => a.pct - b.pct).map(r => r.label), [swRows]);

  // Squad cost comes from the market values CoachPanel already sums per club, so
  // the row draws itself for any season with player data behind it. Typing over
  // it stays possible — the number is a proxy for a wage bill nobody publishes.
  const autoSquadRank = squadValueRanks[`${ctx.season}||${ctx.league}||${ctx.team}`] || null;

  const autoClubs = useMemo(
    () => potentialClubRows(ctx.statsRow || {}, allTeams, 8), [ctx.statsRow, allTeams]);
  // A different season is a different club's list, so a manual pick can't
  // survive the switch.
  useEffect(() => { setManualClubs(null); setClubQuery(''); }, [statsSeasonKey]);

  const clubRows = useMemo(
    () => (manualClubs || autoClubs.slice(0, 3)), [manualClubs, autoClubs]);

  // Ranked candidates first, then ANY club in the data. Restricting the picker to
  // the similarity list would make a club you actually want unreachable, which
  // defeats the point of a manual override. Clubs found by search carry no
  // figure and the row prints a dash rather than inventing one.
  const clubChoices = useMemo(() => {
    const q = clubQuery.trim().toLowerCase();
    const chosen = new Set(clubRows.map(r => r.team));
    const ranked = autoClubs
      .filter(r => !chosen.has(r.team))
      .filter(r => !q || foldIncludes(r.team, q));
    if (q.length < 2) return ranked.slice(0, 8);
    const seen = new Set(ranked.map(r => r.team));
    const extra = teamOptions(allTeams || [], clubQuery, 20)
      .filter(t => !seen.has(t.team) && !chosen.has(t.team))
      .map(t => ({ team: t.team, league: t.league, finalFit: null }));
    return [...ranked, ...extra].slice(0, 10);
  }, [autoClubs, clubRows, clubQuery, allTeams]);

  const teamContext = useMemo(() => {
    const size = leagueSizeOv !== '' ? Number(leagueSizeOv)
      : (ctx.statsRow && ctx.statsRow.leagueSize != null ? Number(ctx.statsRow.leagueSize) : 20);
    const m = (k, auto) => {
      const r = tcRanks[k] !== '' && tcRanks[k] != null ? tcRanks[k] : auto;
      if (r === '' || r == null) return undefined;
      return { rank: Number(r), size };
    };
    return {
      squadValue: m('squadValue', autoSquadRank),
      wageBill: m('wageBill', null),
      odds: m('odds', null),
    };
  }, [tcRanks, leagueSizeOv, ctx.statsRow, autoSquadRank]);



  const processMap = async (raw, mode) => {
    if (!raw) return '';
    if (mode === 'zones') return await extractZones(raw);
    if (mode === 'heat') return await extractHeat(raw);
    return raw;
  };

  const buildOpts = () => ({
    allTeams, seasonPerf,
    headerColour: COLOURS[headerColourName] || HEADER_COLOURS.Default,
    statsSeasonKey, nameOverride, teamOverride, uploadedPhotoDataUrl, viewText,
    tenureOverride, unattached,
    primaryFormation, secondaryFormation, showFormation, showFormationDots, showSecondaryShape,
    positionMapUrl, mapOpacity: Number(mapOpacity) / 100,
    careerMode, teamContext, slots, dobOverride,
    impactRowA: impactA, impactRowB: impactB,
    clubRows, clubNotes, hideFitScores, clubsTitle,
    styleKeys, traitOv, setPiecesPct, spAttPct, spDefPct,
    overallOverride, potentialOverride, overallUnclear, potentialUnclear,
    gbeOv, swDrop, swAddStr, swAddWeak,
  });

  const handleDownload = async () => {
    setDownloading(true); setProgress('Loading images…'); setError('');
    let el = null;
    try {
      const { toPng } = await import('html-to-image');
      const urls = managerPagerImageUrls(coach, ctx, uploadedPhotoDataUrl, allTeams, clubRows);
      const images = await preloadImages(urls, (d, t) => setProgress(`Images ${d}/${t}`));
      setProgress('Rendering…');
      el = buildManagerPagerElement(coach, tenureRows, traits, { ...buildOpts(), images });
      const node = el.querySelector('#mp-card-root') || el;
      const opts = {
        width: W, height: H, pixelRatio: 1, backgroundColor: BG,
        cacheBust: false, fontEmbedCSS: MONTSERRAT_EMBED_CSS,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      };
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

          <div style={UI.block}>
            <span style={UI.label}>Birth date</span>
            <input style={{ ...UI.input, cursor: 'text' }} type="date" value={dobOverride}
                   onChange={e => setDobOverride(e.target.value)} />
            <div style={UI.note}>
              {coach.dob
                ? `Saved: ${formatDOB(coach.dob)}. Typing here overrides it on this card.`
                : 'No date saved against this manager — the age and the date both come from here.'}
              {' '}Prints beside the age in the identity row.
            </div>
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
                Drives the stat row, percentiles, Team Context, Potential Clubs and the table.
              </div>
            </div>
          )}

          <div style={UI.block}>
            <span style={UI.label}>Club &amp; tenure on card</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...UI.input, flex: 1 }} value={teamOverride}
                     onChange={e => setTeamOverride(e.target.value)} placeholder={ctx.team} />
              <input style={{ ...UI.input, flex: 1 }} value={tenureOverride}
                     onChange={e => setTenureOverride(e.target.value)}
                     placeholder={coach.tenure || '2024–Present'} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Check label="Unattached — club greys out and takes an Unattached tag"
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
            <span style={UI.label}>Panels</span>
            {[['a1', 'b1'], ['a2', 'b2'], ['a3', 'b3']].map(pair => (
              <div key={pair[0]} style={{ display: 'flex', marginBottom: 6 }}>
                {pair.map((key, i) => (
                  <select key={key} value={slots[key]} onChange={e => setSlot(key, e.target.value)}
                          style={{ ...UI.select, flex: 1, marginLeft: i ? 6 : 0 }}>
                    {MP_PANELS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
              </div>
            ))}
            <Seg options={[['Potential Clubs', 'Potential Clubs'], ['Similar Teams', 'Similar Teams']]}
                 value={clubsTitle} onChange={setClubsTitle} />
            <div style={UI.note}>
              Any slot holds any panel — League Table and View can both be on the card,
              or the same panel twice. Impact and Comparison draw the same radar; the
              title is the claim you are making about it. The Potential Clubs panel
              takes whichever title is picked above.
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
            <div style={{ marginTop: 8 }}>
              <Check label="Formation pitch in the header (off = formation / alternative / tenure)"
                     value={showFormation} onChange={setShowFormation} />
              <Check label="Draw the shape on the pitch"
                     value={showFormationDots} onChange={setShowFormationDots} />
              <Check label="Also draw the secondary shape as rings"
                     value={showSecondaryShape} onChange={setShowSecondaryShape} />
            </div>
            <div style={UI.note}>
              One shape by default — twenty-two marks on a 188px pitch reads as a
              scatter rather than as a back four.
            </div>
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Pitch background (optional)</span>
            <Seg options={[['zones', 'Zones of control'], ['raw', 'As uploaded'], ['heat', 'Strip pitch']]}
                 value={mapMode}
                 onChange={async (v) => {
                   setMapMode(v);
                   if (mapRaw) setPositionMapUrl(await processMap(mapRaw, v));
                   if (v !== 'zones' && mapRaw) setShowFormationDots(false);
                 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ flex: 1, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                              padding: '7px 10px', borderRadius: 5, textAlign: 'center',
                              border: `1px solid ${mapRaw ? '#3b7de8' : '#1e2d45'}`,
                              background: mapRaw ? '#0e2040' : 'transparent',
                              color: mapRaw ? '#60a5fa' : '#8b98ad' }}>
                {mapRaw ? 'Image loaded ✓' : 'Upload image'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files && e.target.files[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = async (ev) => {
                      const raw = String(ev.target.result);
                      setMapRaw(raw);
                      setPositionMapUrl(await processMap(raw, mapMode));
                      // A zones wash is a backdrop the shape sits on; an average
                      // position map already IS the shape, so the dots come off.
                      if (mapMode !== 'zones') setShowFormationDots(false);
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
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontSize: 10.5, color: '#94a3b8', width: 54, flexShrink: 0 }}>Strength</span>
                  <input type="range" min="15" max="100" value={mapOpacity}
                    onChange={e => setMapOpacity(e.target.value)}
                    style={{ flex: 1, accentColor: '#3b7de8' }} />
                  <span style={{ fontSize: 10.5, color: '#64748b', width: 34, textAlign: 'right' }}>{mapOpacity}%</span>
                </div>
                <div style={UI.note}>
                  Zones recolours Opta&rsquo;s chart into the card&rsquo;s palette — purple
                  becomes green, pink becomes red, contested drops out so the pitch
                  shows through. The shape turns white over it.
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
            {styleKeys.filter(k => k !== 'setPieces').map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', marginTop: 5 }}>
                <span style={{ width: 96, flexShrink: 0, fontSize: 11, color: '#94a3b8' }}>
                  {TRAIT_CHIP_LABELS[k]}
                </span>
                <input value={traitOv[k] ?? ''} inputMode="decimal"
                  placeholder={(() => {
                    const auto = (coach.traitOverrides && coach.traitOverrides[k] != null)
                      ? coach.traitOverrides[k] : (traits && traits[k] != null ? traits[k] / 10 : null);
                    return auto == null ? '—' : String(Math.round(auto * 10) / 10);
                  })()}
                  onChange={e => {
                    const v = e.target.value.replace(/[^\d.]/g, '').slice(0, 4);
                    setTraitOv(o => { const n = { ...o }; if (v === '') delete n[k]; else n[k] = v; return n; });
                  }}
                  style={{ ...UI.input, width: 72, flex: '0 0 auto' }} />
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>/ 10</span>
              </div>
            ))}
            <div style={UI.note}>
              Blank uses the coach&rsquo;s saved value, then the computed one.
            </div>
          </div>

          {styleKeys.includes('setPieces') && (
            <div style={UI.block}>
              <span style={UI.label}>Set pieces — league rank (1 = best of {spLeagueSize})</span>
              <div style={{ display: 'flex' }}>
                <input value={spAtt} onChange={e => setSpAtt(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                       placeholder="Attacking rank" style={{ ...UI.input, flex: 1 }} />
                <input value={spDef} onChange={e => setSpDef(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                       placeholder="Defending rank" style={{ ...UI.input, flex: 1, marginLeft: 6 }} />
              </div>
              <div style={UI.note}>
                {setPiecesPct == null
                  ? `Blank falls back to the coach's saved rating. Ranks out of ${spLeagueSize}, converted to a percentile — each side also feeds Strengths & Weaknesses on its own.`
                  : `${rankToPct(spAtt, spLeagueSize) != null
                        ? `Att ${Math.round(rankToPct(spAtt, spLeagueSize))} ` : ''}${
                      rankToPct(spDef, spLeagueSize) != null
                        ? `Def ${Math.round(rankToPct(spDef, spLeagueSize))} ` : ''}\u2192 ${
                      Math.round(setPiecesPct)} percentile`}
              </div>
            </div>
          )}

          <div style={UI.block}>
            <span style={UI.label}>Career chart</span>
            <Seg options={[['score', 'Score'], ['finish', 'League finish']]}
                 value={careerMode} onChange={setCareerMode} />
          </div>

          <div style={UI.block}>
            <span style={UI.label}>Team context — league rank</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['squadValue', autoSquadRank ? `Squad cost (${autoSquadRank})` : 'Squad cost'],
                ['wageBill', 'Wage bill'], ['odds', 'Odds']].map(([k, lbl]) => (
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
              1 = richest / heaviest favourite. Squad cost fills itself from market
              values where they exist; average age comes from the data. The block
              centres in the tile, so two rows sit as a pair rather than at opposite
              ends of it.
            </div>
          </div>

          {(slotHas('Impact') || slotHas('Comparison')) && (
            <div style={UI.block}>
              <span style={UI.label}>
                {slotHas('Impact') ? 'Impact' : 'Comparison'} — sides compared
              </span>
              <TeamSeasonPicker label="A" value={impactA} teams={pool}
                onPick={setImpactA} onClear={() => setImpactA(null)} />
              <TeamSeasonPicker label="B" value={impactB} teams={pool}
                onPick={setImpactB} onClear={() => setImpactB(null)} />
              {(!impactA || !impactB) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 2 }}>
                  {seasonOptions.map(o => (
                    <button key={o.key}
                      onClick={() => (impactA ? setImpactB(rowByKey(o.key)) : setImpactA(rowByKey(o.key)))}
                      style={{ padding: '3px 8px', marginRight: 5, marginBottom: 5, borderRadius: 10,
                               border: '1px solid #1e2d45', background: 'transparent',
                               color: '#8b98ad', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              <div style={UI.note}>
                A draws red, B draws blue. Blank falls back to his earliest and latest
                tenure; the chips are shortcuts, the search reaches any club in the data.
              </div>
            </div>
          )}

          {slotHas('Strengths & Weaknesses') && (
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
              <div style={UI.note}>
                Metric names are translated into coaching terms, and the volume
                measures (crosses, dribbles, duels, passes) are excluded — how much
                a side does something is style, not quality.
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <select value={swNew.label} onChange={e => setSwNew(o => ({ ...o, label: e.target.value }))}
                        style={{ ...UI.input, flex: 1, cursor: 'pointer' }}>
                  <option value="">Add a trait…</option>
                  {MP_MANUAL_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
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
              Potential clubs {manualClubs ? '(manual)' : '(auto — top 3)'}
              {manualClubs && (
                <button onClick={() => { setManualClubs(null); setClubQuery(''); }}
                  style={{ marginLeft: 8, background: 'transparent', border: '1px solid #1e2d45',
                           borderRadius: 4, color: '#60a5fa', fontSize: 9, padding: '1px 5px',
                           cursor: 'pointer' }}>back to auto</button>
              )}
            </span>
            <Check label="Hide the match figure beside each club"
                   value={hideFitScores} onChange={setHideFitScores} />

            {clubRows.map((r, i) => (
              <div key={r.team + i}
                   style={{ display: 'flex', alignItems: 'center', marginBottom: 5,
                            background: '#0d1220', border: '1px solid #1e2d45',
                            borderRadius: 6, padding: '5px 8px' }}>
                <span style={{ width: 16, flexShrink: 0, fontSize: 10, color: '#475569' }}>#{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: '#e2e8f4',
                               overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {r.team}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800,
                               color: r.finalFit == null ? '#475569' : '#60a5fa', marginLeft: 8 }}>
                  {r.finalFit == null ? '—' : Math.round(r.finalFit)}
                </span>
                <button onClick={() => setManualClubs(clubRows.filter((_, j) => j !== i))}
                  style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#64748b',
                           cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}

            {clubRows.map((r, i) => (
              <div key={'note' + r.team + i} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ width: 74, flexShrink: 0, fontSize: 10, color: '#64748b',
                               overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {r.team}
                </span>
                <input value={clubNotes[r.team] || ''} maxLength={CLUB_NOTE_MAX}
                  onChange={e => setClubNotes(o => ({ ...o, [r.team]: e.target.value.slice(0, CLUB_NOTE_MAX) }))}
                  placeholder="note, e.g. rebuild, sells well"
                  style={{ ...UI.input, flex: 1 }} />
              </div>
            ))}
            <div style={UI.note}>Notes print beside the league, {CLUB_NOTE_MAX} characters max.</div>

            {clubRows.length < 3 && (
              <>
                <input value={clubQuery} onChange={e => setClubQuery(e.target.value)}
                       placeholder="Add a club…" style={{ ...UI.input, marginTop: 4 }} />
                {clubChoices.map((r, i) => (
                  <div key={r.team + i}
                       onClick={() => { setManualClubs([...clubRows, r]); setClubQuery(''); }}
                       style={{ display: 'flex', alignItems: 'center', cursor: 'pointer',
                                padding: '5px 8px', borderBottom: '1px solid #101a2c' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#c8d2e0',
                                   overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {r.team}
                      <span style={{ color: '#64748b' }}> · {r.league}</span>
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700,
                                   color: r.finalFit == null ? '#475569' : '#8b98ad', marginLeft: 8 }}>
                      {r.finalFit == null ? 'add' : Math.round(r.finalFit)}
                    </span>
                  </div>
                ))}
                {!clubChoices.length && <div style={UI.note}>
                  {clubQuery.trim().length < 2 ? 'Type to search any club.' : 'No match.'}
                </div>}
              </>
            )}
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
                     placeholder="Reason, e.g. UEFA A Licence & a season in Serie A"
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
