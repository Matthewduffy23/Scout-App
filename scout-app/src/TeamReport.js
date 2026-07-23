// TeamReport.js v8 — Team All-in-One report. 1920x1080 PNG export.
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
import { FOTMOB_PHOTO_BASE, countryToIso2, computeAge } from './CoachCard';
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
const SCORE_X = 676;                     // score card left edge
const SCORE_W = 512;                     // 676..1188
const OVR_CX = SCORE_X + 66;             // centre of the OVR number
const STAT_X = SCORE_X + 138;
const STAT_W = 84;                       // 4*84 + 3*10 = 366 -> ends 1180
const STAT_GAP = 10;
const COACH_X = 1216;
const COACH_W = 680;                     // 1216..1896

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

export function buildXI(formationKey, squad, depthCount = 2, season = null) {
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

  return slots.map(slot => {
    const list = slotMap[slot.id] || [];
    const starter = list[0] || null;
    // Out of position: starter's primary token doesn't natively belong here.
    const oop = starter
      ? !(slot.native ? slot.native.includes(posTok(starter)) : firstTokFits(starter, slot))
      : false;
    const depth = list.slice(1)
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
const SLOT_W = 176;
const SLOT_H = 138;
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
    // Age sits in a dimmer grey so the name reads first.
    const age = starter && starter.age != null
      ? ` <span style="color:#7c8798;font-weight:600;">(${starter.age})</span>` : '';

    // Ring is neutral grey — colour lives in the score, so the two don't compete.
    const face = starter
      ? `<div style="position:absolute;left:50%;margin-left:-${FACE / 2}px;top:0;
                     width:${FACE}px;height:${FACE}px;border-radius:50%;
                     background-color:rgba(255,255,255,0.07);
                     background-image:url('${src(img)}');background-size:cover;
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
      `<div style="font-size:12.5px;color:#93a1b5;line-height:1.42;white-space:nowrap;
                   overflow:hidden;text-overflow:ellipsis;">${esc(d.name)}${d.age != null ? ` (${d.age})` : ''}</div>`).join('');

    return `
      <div style="position:absolute;left:${left}px;top:${top}px;width:${SLOT_W}px;">
        <div style="position:relative;height:${FACE}px;">${face}${score}</div>
        <div style="font-size:15px;font-weight:700;color:#eaf0f8;margin-top:6px;
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

function coachHtml(coach, team, coachScore) {
  if (!coach) {
    return `
      <div style="position:absolute;left:${COACH_X}px;top:64px;width:${COACH_W}px;
                  font-size:13px;color:#55617a;">
        No coach saved for this club — pick one in the Manager dropdown.
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
    seasonsHere ? ['At club', `${seasonsHere} szn${seasonsHere !== 1 ? 's' : ''}`] : null,
    // Relabelled from "Contract" — same coach.contract field, so typing "2025-"
    // in the Coaches panel renders as "Since: 2025-".
    coach.contract ? ['Since', coach.contract] : null,
  ].filter(Boolean);

  // The pale band at the top of the photo was never a crop problem — FotMob
  // headshots have TRANSPARENT backgrounds, so the light container colour was
  // showing through above the head. Zooming to hide it just cropped the face.
  // A dark container fixes it properly and the image can sit at natural size.
  const photoCss = photo
    ? `background-image:url('${src(photo)}');background-size:cover;background-position:center top;`
    : '';

  // Subtle, inline with the name — not a separate headline number.
  const scoreChip = coachScore == null ? '' : `
    <span style="display:inline-block;margin-left:12px;padding:2px 9px;border-radius:11px;
                 background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.13);
                 font-size:15px;font-weight:800;color:${gradeColor(coachScore)};
                 vertical-align:middle;">${whole(coachScore)}</span>`;

  return `
    <div style="position:absolute;left:${COACH_X}px;top:24px;width:${COACH_W}px;height:102px;">
      <div style="position:absolute;left:0;top:2px;width:94px;height:94px;border-radius:11px;
                  background-color:#151b2e;${photoCss}
                  background-repeat:no-repeat;
                  border:1px solid rgba(255,255,255,0.16);"></div>

      <div style="position:absolute;left:110px;top:6px;width:${COACH_W - 110}px;">
        <div style="font-size:9.5px;font-weight:700;letter-spacing:0.16em;color:#7f8ca3;">MANAGER</div>
        <div style="margin-top:4px;white-space:nowrap;">
          <span style="font-size:25px;font-weight:700;color:#fff;vertical-align:middle;">${esc(coach.name || '')}</span>${scoreChip}
        </div>
        <div style="display:flex;align-items:center;margin-top:7px;white-space:nowrap;">
          ${iso ? `<div style="width:24px;height:15px;flex-shrink:0;background-size:cover;
                     background-position:center;border-radius:2px;
                     box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);
                     background-image:url('${src(`https://flagcdn.com/w40/${iso}.png`)}');"></div>` : ''}
          <span style="font-size:12.5px;color:#aab4c8;${iso ? 'margin-left:7px;' : ''}">${esc(coach.nationality || '')}</span>
          ${facts.map(([k, v]) =>
            `<span style="font-size:11.5px;color:#6f7c92;margin-left:18px;">
               ${k}: <span style="color:#c3ccdd;font-weight:600;">${esc(v)}</span></span>`).join('')}
        </div>
      </div>
    </div>`;
}

// ─── Header ────────────────────────────────────────────────────────────────
function headerHtml(team, coach, coachScore) {
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
                background-image:url('${src(crest)}');background-size:contain;
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
                  background-image:url('${src(flag)}');"></div>` : ''}
      ${logo ? `<div style="width:24px;height:24px;flex-shrink:0;background-size:contain;
                  background-repeat:no-repeat;background-position:center;
                  background-image:url('${src(logo)}');margin-left:9px;"></div>` : ''}
      <span style="font-size:21px;font-weight:600;color:#dbe3f0;margin-left:9px;">${esc(league)}</span>
      ${team.season ? `<span style="font-size:19px;font-weight:500;color:#8fa0b8;margin-left:12px;">· ${esc(team.season)}</span>` : ''}
    </div>

    ${team.pointsRank != null ? `
      <div style="position:absolute;left:${NAME_X}px;top:118px;width:${NAME_MAX_W}px;
                  font-size:13.5px;font-weight:600;color:#7f8ca3;white-space:nowrap;">
        League position ${team.pointsRank}${team.points != null ? ` &nbsp;·&nbsp; ${team.points} pts` : ''}
      </div>` : ''}

    <!-- SCORE CARD. Four tiny stacked columns forced the eye to read each number
         separately; as labelled rows with full-width bars the splits compare
         instantly and the labels get room to breathe. -->
    <div style="position:absolute;left:${SCORE_X}px;top:20px;width:${SCORE_W}px;height:110px;
                background:rgba(255,255,255,0.055);border:1px solid rgba(255,255,255,0.12);
                border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"></div>

    <div style="position:absolute;left:${SCORE_X + 14}px;top:34px;width:112px;text-align:center;">
      <div style="font-size:50px;font-weight:900;line-height:1;color:${scoreColor(ovr)};">${whole(ovr)}</div>
      <div style="width:56px;height:3px;border-radius:2px;margin:10px auto 0;
                  background:${scoreColor(ovr)};"></div>
      <div style="font-size:9px;font-weight:700;letter-spacing:0.18em;color:#94a3b8;margin-top:9px;">OVERALL</div>
    </div>

    <div style="position:absolute;left:${SCORE_X + 140}px;top:34px;width:1px;height:82px;
                background:rgba(255,255,255,0.14);"></div>

    ${cells.map(([label, v], i) => {
      const pct = Math.max(0, Math.min(100, Number(v) || 0));
      return `
      <div style="position:absolute;left:${SCORE_X + 160}px;top:${34 + i * 21}px;
                  width:${SCORE_W - 176}px;height:16px;">
        <span style="position:absolute;left:0;top:3px;font-size:9.5px;font-weight:700;
                     letter-spacing:0.08em;color:#8fa0b8;">${label}</span>
        <div style="position:absolute;left:86px;right:34px;top:5px;height:6px;
                    background:rgba(255,255,255,0.09);border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${scoreColor(v)};border-radius:3px;"></div>
        </div>
        <span style="position:absolute;right:0;top:0;font-size:15px;font-weight:800;
                     color:${scoreColor(v)};">${whole(v)}</span>
      </div>`;
    }).join('')}

    ${coachHtml(coach, team, coachScore)}`;
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

export function cardImageUrls(team, squad, coach) {
  const urls = [teamCrest(team.team), leagueLogo(team.league), leagueFlag(team.league)];
  for (const p of squad) urls.push(photoUrl(p.name, p.team));
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
  const { squad = [], formation = '4-3-3', coach = null, images = {}, depthCount = 2, coachScore = null } = opts;
  IMG = images || {};

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

  const xi = buildXI(formation, squad, depthCount, team.season);

  container.innerHTML = `
    <div id="tr-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(team, coach, coachScore)}

      ${panel({ x: PAD, y: BODY_TOP, w: LEFT_W, h: LEFT_H,
                title: 'XI + Depth', right: formation, body: xiPanelHtml(xiW, xiH, xi) })}

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
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [formation, setFormation] = useState('4-3-3');
  const [depthCount, setDepthCount] = useState(2);

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

  // Same tenure resolution CoachPanel uses, so the manager score here matches
  // the one on their quick card exactly.
  const tenureRows = useMemo(() => {
    if (!coach) return [];
    return (coach.tenures || [])
      .map(t => allTeams.find(x => x.team === t.team && x.league === t.league && x.season === t.season))
      .filter(Boolean);
  }, [coach, allTeams]);

  // Total squad market value per team+league — same grouping TeamIndex uses.
  const totalMVByTeam = useMemo(() => {
    const sums = {};
    for (const p of players) {
      if (!p.marketValue || p.marketValue <= 0) continue;
      const k = String(p.team).toLowerCase() + '|' + String(p.league || '').trim().replace(/\.$/, '').toLowerCase();
      sums[k] = (sums[k] || 0) + p.marketValue;
    }
    return sums;
  }, [players]);

  // Ported from CoachPanel.buildSeasonPerfMap / getMVPerfRank. This is the 25%
  // "£ performance" half of the manager score — without it the score falls back
  // to team quality alone and reads a couple of points below the quick card.
  const seasonPerf = useMemo(() => {
    const getTotalMV = (t, l) =>
      totalMVByTeam[String(t).toLowerCase() + '|' + String(l || '').trim().replace(/\.$/, '').toLowerCase()] ?? null;
    const map = {};
    for (const row of tenureRows) {
      const peers = allTeams.filter(t => String(t.league) === String(row.league)
                                      && String(t.season) === String(row.season));
      const withMV = peers
        .map(t => ({ t, mv: getTotalMV(t.team, t.league) }))
        .filter(x => x.mv != null && x.t.pointsRank != null);
      if (withMV.length < 2) continue;
      withMV.sort((a, b) => b.mv - a.mv);
      const idx = withMV.findIndex(x => x.t.team === row.team);
      if (idx < 0) continue;
      const rank = idx + 1, size = withMV.length;
      const pct = ((size - rank) / (size - 1)) * 100;
      map[`${row.season}||${row.league}||${row.team}`] = Math.round(pct * 10) / 10;
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

  const xi = useMemo(() => buildXI(formation, squad, depthCount, team.season), [formation, squad, depthCount, team]);
  const filled = xi.filter(s => s.starter).length;
  const rating = xiRating(xi);

  // Surfaces any position token with no CANONICAL entry — the silent failure that
  // makes a slot look broken, because canon() collapses unknowns to 'CM'.
  const unmapped = useMemo(() => reportUnmappedTokens(squad), [squad]);
  const unmappedKeys = Object.keys(unmapped);

  const groupsPresent = new Set(players.map(p => p && p.roleKey).filter(Boolean)).size;
  const partialSquadData = players.length > 0 && groupsPresent < 4;

  const handleDownload = async () => {
    // EVERYTHING lives inside try/finally. Previously the preload and the
    // element build sat outside it, so any throw skipped setDownloading(false)
    // and the button stuck on "Generating…" with no error surfaced.
    setDownloading(true);
    setProgress('Loading images…');
    let el = null;
    try {
      const { toPng } = await import('html-to-image');
      const urls = cardImageUrls(team, squad, coach);
      const images = await preloadImages(urls, (d, t) => setProgress(`Images ${d}/${t}`));
      setProgress('Rendering…');

      el = buildTeamReportElement(team, { squad, formation, coach, images, depthCount, coachScore });
      const cardNode = el.querySelector('#tr-card-root') || el;
      const opts = {
        width: W, height: H, pixelRatio: 1, backgroundColor: BG,
        cacheBust: false, fontEmbedCSS: MONTSERRAT_EMBED_CSS,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      };
      await toPng(cardNode, opts);               // warm-up: settles fonts/layout
      const dataUrl = await toPng(cardNode, opts); // real capture
      const a = document.createElement('a');
      a.download = `${String(team.team).replace(/\s+/g, '_')}_team_report.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error('[TeamReport] download failed:', e);
      setError(String((e && e.message) || e));
    } finally {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      setDownloading(false);
      setProgress('');
    }
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
                         letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>
            Depth shown (50+ mins only)
          </span>
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
          {coach ? ` · ${coach.name}${coachScore != null ? ` (${Math.round(coachScore)})` : ''}` : ' · no coach saved'}
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
          style={{ width: '100%', marginTop: 10, padding: '8px 0', borderRadius: 8,
                   border: '1px solid #1e2d45', background: 'transparent',
                   color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}
