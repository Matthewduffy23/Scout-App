// TeamReport.js v4 — Team All-in-One report. 1920x1080 PNG export.
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

import React, { useState, useMemo } from 'react';
import {
  MONTSERRAT_EMBED_CSS, teamCrest, leagueDisplayName,
  leagueLogo, leagueFlag, photoUrl,
} from './cardAssets';
import { loadCoaches } from './coachStorage';
import { FOTMOB_PHOTO_BASE, countryToIso2 } from './CoachCard';

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

const ROW_H = 283;
const ROW_1 = BODY_TOP;                  // 166
const ROW_2 = ROW_1 + ROW_H + GAP;       // 469
const ROW_3 = ROW_2 + ROW_H + GAP;       // 772
const LEFT_H = ROW_3 + ROW_H - BODY_TOP; // 889

// Header column stops. The team name is capped and ellipsised so long clubs
// ("Wolverhampton Wanderers") can't run into the coach block.
const NAME_X = PAD + 128;
const NAME_MAX_W = 520;
// Order across the band: crest+name -> OVR/score card -> manager.
const SCORE_X = 690;                     // score card left edge
const SCORE_W = 566;                     // 690..1256
const OVR_CX = SCORE_X + 74;             // centre of the OVR number
const STAT_X = SCORE_X + 158;
const STAT_W = 92;
const STAT_GAP = 12;                     // 4*92 + 3*12 = 404 -> ends 1252
const COACH_X = 1292;
const COACH_W = 604;                     // 1292..1896

// ─── Palette ───────────────────────────────────────────────────────────────
const BG = '#0a0f1c';
const HEADER_L = 'rgb(23,26,77)';
const HEADER_R = 'rgb(17,22,42)';
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
                     text-transform:uppercase;color:#94a3b8;">${title}</span>
        ${right ? `<span style="position:absolute;right:0;top:1px;font-size:13px;
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

// Slots are filled back-to-front in this order — specialists (GK, centre-backs)
// claim their players before the generalist slots get a look in.
const PITCH_ORDER = ['GK','LCB','CB','RCB','LB','RB','LWB','RWB','CM','DM','AM','LW','RW','ST'];

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

export function buildXI(formationKey, squad) {
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

  // Pass 3 — a slot still empty after both passes gets the best unassigned player
  // whose ANY token canonically fits, ranked by minutes. Streamlit leaves these
  // blank; filling them (and flagging out-of-position) is more useful on a card
  // that has to stand on its own.
  for (const label of PITCH_ORDER) {
    const list = byLabel[label];
    if (!list) continue;
    for (const sl of list) {
      if ((slotMap[sl.id] || []).length) continue;
      const spare = squad
        .filter(p => !assigned.has(p) && allToks(p).some(t => sl.accepts.includes(canon(t))))
        .sort((a, b) => mins(b) - mins(a));
      if (spare.length) {
        slotMap[sl.id] = [spare[0]];
        assigned.add(spare[0]);
      }
    }
  }

  return slots.map(slot => {
    const list = slotMap[slot.id] || [];
    const starter = list[0] || null;
    // Out of position: starter's primary token doesn't natively belong here.
    const oop = starter
      ? !(slot.native ? slot.native.includes(posTok(starter)) : firstTokFits(starter, slot))
      : false;
    return { slot, starter, oop, depth: list.slice(1, 3) };
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
const SLOT_W = 168;
const SLOT_H = 118;
const FACE = 62;
function xiPanelHtml(w, h, xi) {
  const line = 'rgba(255,255,255,0.10)';

  const blocks = xi.map(({ slot, starter, oop, depth }) => {
    const cx = (slot.x / 100) * w, cy = (slot.y / 100) * h;   // Streamlit coords are 0-100
    const left = Math.max(-8, Math.min(w - SLOT_W + 8, cx - SLOT_W / 2));
    const top = Math.max(2, Math.min(h - SLOT_H, cy - 34));

    const sc = starter ? starter.careerScore : null;
    const img = starter ? photoUrl(starter.name, starter.team) : '';
    const tok = starter ? String(starter.position || '').split(',')[0].trim() : '';
    const age = starter && starter.age != null ? ` (${starter.age})` : '';

    // Ring is neutral grey — colour lives in the score, so the two don't compete.
    const face = starter
      ? `<div style="position:absolute;left:50%;margin-left:-${FACE / 2}px;top:0;
                     width:${FACE}px;height:${FACE}px;border-radius:50%;
                     background-color:rgba(255,255,255,0.07);
                     background-image:url('${img}');background-size:cover;
                     background-position:center top;
                     border:2px solid rgba(203,213,225,0.55);"></div>`
      : `<div style="position:absolute;left:50%;margin-left:-${FACE / 2}px;top:0;
                     width:${FACE}px;height:${FACE}px;border-radius:50%;
                     background:rgba(255,255,255,0.05);
                     border:1px dashed rgba(255,255,255,0.20);
                     display:flex;align-items:center;justify-content:center;
                     font-size:11px;font-weight:700;color:#475569;">${slot.label}</div>`;

    // Score hangs off the photo's right edge, absolutely placed — so the name
    // below can centre on the PHOTO rather than on photo+score combined.
    const score = sc == null ? '' :
      `<div style="position:absolute;left:50%;margin-left:${FACE / 2 + 7}px;top:19px;
                   font-size:22px;font-weight:800;line-height:1;
                   color:${gradeColor(sc)};">${Math.round(sc)}</div>`;

    const oopTag = (starter && oop && tok)
      ? `<span style="color:#f18c31;font-weight:600;"> (${esc(tok)})</span>` : '';

    const depthNames = depth.map(d =>
      `<div style="font-size:11.5px;color:#8b98ad;line-height:1.4;white-space:nowrap;
                   overflow:hidden;text-overflow:ellipsis;">${esc(d.name)}${d.age != null ? ` (${d.age})` : ''}</div>`).join('');

    return `
      <div style="position:absolute;left:${left}px;top:${top}px;width:${SLOT_W}px;">
        <div style="position:relative;height:${FACE}px;">${face}${score}</div>
        <div style="font-size:13.5px;font-weight:700;color:#eaf0f8;margin-top:6px;
                    text-align:center;white-space:nowrap;overflow:hidden;
                    text-overflow:ellipsis;">${starter ? esc(starter.name) : '—'}${age}${oopTag}</div>
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
function radarPanelHtml(w, h) { return stub(w, h, 'radar from t.metricGroups percentiles'); }
function stylePanelHtml(w, h) { return stub(w, h, 'hexagon from t.attributes (7 keys, not 6)'); }
function similarTeamsPanelHtml(w, h) { return stub(w, h, 'from t.similarTeams'); }
function leagueTablePanelHtml(w, h) { return stub(w, h, 'rows around t.pointsRank'); }
function keyPlayersPanelHtml(w, h) { return stub(w, h, 'top squad players by careerScore'); }
function weaknessesPanelHtml(w, h) { return stub(w, h, 'lowest metricGroups pcts + thin positions'); }

// ─── Coach lookup ──────────────────────────────────────────────────────────
// Exact team+league+season match against saved tenures — the same rule
// CoachPanel's resolveTenureRows() uses. Falls back to any tenure at this club
// so a coach saved against last season still resolves.
export function listSavedCoaches() {
  try { return loadCoaches() || []; } catch (e) { return []; }
}

export function findCoachForTeam(team) {
  let coaches = [];
  try { coaches = loadCoaches() || []; } catch (e) { return null; }
  const exact = coaches.find(c => (c.tenures || []).some(t =>
    t.team === team.team && t.league === team.league && t.season === team.season));
  if (exact) return exact;
  return coaches.find(c => (c.tenures || []).some(t => t.team === team.team)) || null;
}

function coachHtml(coach, team) {
  if (!coach) {
    return `
      <div style="position:absolute;left:${COACH_X}px;top:64px;width:${COACH_W}px;
                  font-size:13px;color:#55617a;">
        No coach saved for this club — add one in the Coaches panel.
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

  const facts = [
    formation ? ['Formation', formation] : null,
    seasonsHere ? ['At club', `${seasonsHere} season${seasonsHere !== 1 ? 's' : ''}`] : null,
    coach.contract ? ['Contract', coach.contract] : null,
  ].filter(Boolean);

  return `
    <div style="position:absolute;left:${COACH_X}px;top:30px;width:${COACH_W}px;
                display:flex;align-items:center;">
      <div style="width:88px;height:88px;border-radius:10px;flex-shrink:0;
                  background-color:rgba(255,255,255,0.06);
                  ${photo ? `background-image:url('${photo}');` : ''}
                  background-size:cover;background-position:center 30%;
                  border:1px solid rgba(255,255,255,0.16);overflow:hidden;"></div>
      <div style="margin-left:14px;min-width:0;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;color:#7f8ca3;">MANAGER</div>
        <div style="font-size:24px;font-weight:700;color:#fff;margin-top:3px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                    max-width:${COACH_W - 120}px;">${esc(coach.name || '')}</div>
        <div style="display:flex;align-items:center;margin-top:6px;white-space:nowrap;">
          ${iso ? `<div style="width:24px;height:15px;flex-shrink:0;background-size:cover;
                     background-position:center;border-radius:2px;
                     box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);
                     background-image:url('https://flagcdn.com/w40/${iso}.png');"></div>` : ''}
          <span style="font-size:13px;color:#aab4c8;${iso ? 'margin-left:7px;' : ''}">${esc(coach.nationality || '')}</span>
          ${facts.map(([k, v]) =>
            `<span style="font-size:12px;color:#6f7c92;margin-left:16px;">
               ${k}: <span style="color:#c3ccdd;font-weight:600;">${esc(v)}</span></span>`).join('')}
        </div>
      </div>
    </div>`;
}

// ─── Header ────────────────────────────────────────────────────────────────
function headerHtml(team, coach) {
  const crest = teamCrest(team.team);
  const league = leagueDisplayName(team.league);
  const logo = leagueLogo(team.league);
  const flag = leagueFlag(team.league);
  const ovr = team.completeScore;
  const cells = [
    ['ATTACK', team.attack], ['DEFENCE', team.defence],
    ['POSSESSION', team.possession], ['PRESSING', team.pressing],
  ];

  return `
    <div style="position:absolute;top:0;left:0;width:${W}px;height:${HEADER_H}px;
                background:linear-gradient(to right, ${HEADER_L} 0%, ${HEADER_R} 100%);
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"></div>

    ${crest ? `<div style="position:absolute;left:${PAD}px;top:21px;width:108px;height:108px;
                background-image:url('${crest}');background-size:contain;
                background-repeat:no-repeat;background-position:center;"></div>` : ''}

    <div style="position:absolute;left:${NAME_X}px;top:16px;width:${NAME_MAX_W}px;
                font-size:58px;font-weight:800;letter-spacing:-0.8px;line-height:1.02;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(team.team)}</div>

    <!-- country flag + league logo + league name + season, one nowrap row -->
    <div style="position:absolute;left:${NAME_X}px;top:86px;display:flex;align-items:center;
                white-space:nowrap;">
      ${flag ? `<div style="width:27px;height:17px;flex-shrink:0;background-size:cover;
                  background-position:center;border-radius:2px;
                  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);
                  background-image:url('${flag}');"></div>` : ''}
      ${logo ? `<div style="width:24px;height:24px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${logo}');margin-left:9px;"></div>` : ''}
      <span style="font-size:21px;font-weight:600;color:#dbe3f0;margin-left:9px;">${esc(league)}</span>
      ${team.season ? `<span style="font-size:19px;font-weight:500;color:#8fa0b8;margin-left:12px;">· ${esc(team.season)}</span>` : ''}
    </div>

    ${team.pointsRank != null ? `
      <div style="position:absolute;left:${NAME_X}px;top:118px;width:${NAME_MAX_W}px;
                  font-size:13.5px;font-weight:600;color:#7f8ca3;white-space:nowrap;">
        League position ${team.pointsRank}${team.points != null ? ` &nbsp;·&nbsp; ${team.points} pts` : ''}
      </div>` : ''}

    <!-- SCORE CARD: OVR + the four style scores, one panel, ahead of the manager -->
    <div style="position:absolute;left:${SCORE_X}px;top:26px;width:${SCORE_W}px;height:98px;
                background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.11);
                border-radius:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.07);"></div>

    <div style="position:absolute;left:${OVR_CX - 70}px;top:38px;width:140px;text-align:center;">
      <div style="font-size:46px;font-weight:900;line-height:1;color:${scoreColor(ovr)};">${fmt(ovr)}</div>
      <div style="font-size:9.5px;font-weight:700;letter-spacing:0.18em;color:#94a3b8;margin-top:7px;">OVERALL</div>
    </div>

    <!-- divider between OVR and the breakdown -->
    <div style="position:absolute;left:${SCORE_X + 148}px;top:42px;width:1px;height:66px;
                background:rgba(255,255,255,0.13);"></div>

    <div style="position:absolute;left:${STAT_X}px;top:44px;display:flex;align-items:flex-start;">
      ${cells.map(([label, v], i) => `
        <div style="text-align:center;width:${STAT_W}px;${i ? `margin-left:${STAT_GAP}px;` : ''}">
          <div style="font-size:25px;font-weight:800;line-height:1;color:${scoreColor(v)};">${fmt(v)}</div>
          <div style="font-size:9px;font-weight:700;letter-spacing:0.10em;color:#8fa0b8;margin-top:7px;">${label}</div>
        </div>`).join('')}
    </div>

    ${coachHtml(coach, team)}`;
}

function buildTeamReportElement(team, opts = {}) {
  const { squad = [], formation = '4-3-3', coach = null } = opts;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${W}px`;
  container.style.height = `${H}px`;

  const innerW = COL_W - PANEL_PAD * 2;
  const innerH = ROW_H - PANEL_PAD * 2 - TITLE_H;
  const xiW = LEFT_W - PANEL_PAD * 2;
  const xiH = LEFT_H - PANEL_PAD * 2 - TITLE_H;

  const xi = buildXI(formation, squad);

  container.innerHTML = `
    <div id="tr-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(team, coach)}

      ${panel({ x: PAD, y: BODY_TOP, w: LEFT_W, h: LEFT_H,
                title: 'XI + Depth', right: xiRatingLabel(xi, formation), body: xiPanelHtml(xiW, xiH, xi) })}

      ${panel({ x: COL_A_X, y: ROW_1, w: COL_W, h: ROW_H,
                title: 'Performance Radar', body: radarPanelHtml(innerW, innerH) })}
      ${panel({ x: COL_A_X, y: ROW_2, w: COL_W, h: ROW_H,
                title: 'Style', body: stylePanelHtml(innerW, innerH) })}
      ${panel({ x: COL_A_X, y: ROW_3, w: COL_W, h: ROW_H,
                title: 'Similar Teams', body: similarTeamsPanelHtml(innerW, innerH) })}

      ${panel({ x: COL_B_X, y: ROW_1, w: COL_W, h: ROW_H,
                title: 'League Table', body: leagueTablePanelHtml(innerW, innerH) })}
      ${panel({ x: COL_B_X, y: ROW_2, w: COL_W, h: ROW_H,
                title: 'Key Players', body: keyPlayersPanelHtml(innerW, innerH) })}
      ${panel({ x: COL_B_X, y: ROW_3, w: COL_W, h: ROW_H,
                title: 'Weaknesses', body: weaknessesPanelHtml(innerW, innerH) })}
    </div>`;

  document.body.appendChild(container);
  return container;
}

// ─── Modal ─────────────────────────────────────────────────────────────────
export default function TeamReport({ team, allTeamSeasons = [], allTeams = [], players = [], onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [formation, setFormation] = useState('4-3-3');

  // Player rows carry league in the '.' format ('England 1.'); team rows don't.
  // Compare on the normalised form or every squad comes back empty.
  const squad = useMemo(() => {
    const norm = (l) => String(l || '').trim().replace(/\.$/, '').toLowerCase();
    return players.filter(p =>
      String(p.team).toLowerCase() === String(team.team).toLowerCase() &&
      norm(p.league) === norm(team.league));
  }, [players, team]);

  // Auto-matched coach is only the DEFAULT — the dropdown below lets you pick
  // any coach from the saved Coaches section, which is what you'll need for the
  // majority of clubs that have no tenure saved against them.
  const savedCoaches = useMemo(() => listSavedCoaches(), []);
  const autoCoach = useMemo(() => findCoachForTeam(team), [team]);
  const [coachId, setCoachId] = useState('auto');
  const coach = coachId === 'auto'
    ? autoCoach
    : coachId === 'none'
      ? null
      : (savedCoaches.find(c => String(c.id) === String(coachId)) || autoCoach);

  const xi = useMemo(() => buildXI(formation, squad), [formation, squad]);
  const filled = xi.filter(s => s.starter).length;
  const rating = xiRating(xi);

  // Surfaces any position token with no CANONICAL entry — the silent failure that
  // makes a slot look broken, because canon() collapses unknowns to 'CM'.
  const unmapped = useMemo(() => reportUnmappedTokens(squad), [squad]);
  const unmappedKeys = Object.keys(unmapped);

  const groupsPresent = new Set(players.map(p => p && p.roleKey).filter(Boolean)).size;
  const partialSquadData = players.length > 0 && groupsPresent < 4;

  const handleDownload = async () => {
    setDownloading(true);
    const { toPng } = await import('html-to-image');
    const el = buildTeamReportElement(team, { squad, formation, coach });
    try {
      const cardNode = el.querySelector('#tr-card-root') || el;
      const opts = {
        width: W, height: H, pixelRatio: 1, backgroundColor: BG,
        cacheBust: true, fontEmbedCSS: MONTSERRAT_EMBED_CSS,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      };
      await toPng(cardNode, opts);
      const dataUrl = await toPng(cardNode, opts);
      const a = document.createElement('a');
      a.download = `${String(team.team).replace(/\s+/g, '_')}_team_report.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) { console.error(e); }
    finally { document.body.removeChild(el); setDownloading(false); }
  };

  const note = { fontSize: 11.5, borderRadius: 8, padding: '8px 10px', marginBottom: 14, lineHeight: 1.45 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#09111e', border: '1px solid #1e2d45', borderRadius: 12,
                    padding: 28, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.7)',
                    minWidth: 340, maxWidth: 400 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f4', marginBottom: 6 }}>Team Report</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
          {team.team} · {leagueDisplayName(team.league)}
        </div>

        <div style={{ textAlign: 'left', marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase',
                         letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Formation</span>
          <select value={formation} onChange={e => setFormation(e.target.value)}
            style={{ width: '100%', background: '#0d1220', border: '1px solid #1e2d45',
                     borderRadius: 5, color: '#e2e8f4', padding: '6px 7px',
                     fontSize: 11.5, cursor: 'pointer' }}>
            {FORMATION_NAMES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div style={{ textAlign: 'left', marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase',
                         letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Manager</span>
          <select value={coachId} onChange={e => setCoachId(e.target.value)}
            style={{ width: '100%', background: '#0d1220', border: '1px solid #1e2d45',
                     borderRadius: 5, color: '#e2e8f4', padding: '6px 7px',
                     fontSize: 11.5, cursor: 'pointer' }}>
            <option value="auto">
              {autoCoach ? `Auto — ${autoCoach.name}` : 'Auto — none matched'}
            </option>
            <option value="none">Hide manager</option>
            {savedCoaches.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!savedCoaches.length && (
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 5 }}>
              No saved coaches found on this domain.
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'left', marginBottom: 14 }}>
          {squad.length} in squad · {filled}/11 filled{rating != null ? ` · XI ${rating.toFixed(1)}` : ''}
          {coach ? ` · ${coach.name}` : ' · no coach saved'}
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
            <b>{unmappedKeys.join(', ')}</b> — these fall through to CM and can leave
            a slot empty. Add them to CANONICAL in TeamReport.js.
          </div>
        )}

        {!partialSquadData && filled < 11 && (
          <div style={{ ...note, color: '#f18c31', background: 'rgba(241,140,49,0.08)',
                        border: '1px solid rgba(241,140,49,0.25)' }}>
            {11 - filled} slot{11 - filled === 1 ? '' : 's'} unfilled — no squad player matches
            that role. They render as dashed outlines.
          </div>
        )}

        <button onClick={handleDownload} disabled={downloading}
          style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                   background: downloading ? '#1e2d45' : '#3b7de8', color: '#fff',
                   fontSize: 13, fontWeight: 700, cursor: downloading ? 'default' : 'pointer' }}>
          {downloading ? 'Generating…' : '⬇ Download 1920×1080'}
        </button>
        <button onClick={onClose}
          style={{ width: '100%', marginTop: 10, padding: '8px 0', borderRadius: 8,
                   border: '1px solid #1e2d45', background: 'transparent',
                   color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}
