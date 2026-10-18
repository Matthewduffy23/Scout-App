// CM "archetype" scoring — a separate system layered alongside (never
// replacing) the Style Hexagon (QC_ROLES in Pipeline/build_players.py).
// Computed entirely in the frontend from data already shipped in the player
// JSON (seasonsDetail[season].g.{A,D,P} per-season percentiles/raw values,
// qcRoleCareerScores), so no pipeline rebuild is needed to ship or tune this.
//
// Two independent pieces:
//   1. The 7 "types" — recency-weighted career blends, same method as the
//      hexagon (weighted average of per-metric percentiles-within-League+
//      Season+CM, decayed exp(-0.45*seasons_back) across seasons). Pool-
//      independent: a function of the player's own data only. Drives the
//      dominant/hybrid/generalist archetype classification and the colour mode.
//   2. Possession Score / Defensive Score (Feature Q's own formulas,
//      verbatim from Scouting-Hub/pages/03_Central_Midfielders.py) — latest
//      qualifying season's raw per-90 values, ranked within WHATEVER POOL
//      IS PASSED IN (the current filtered Scout Index list), matching how
//      the live Streamlit tool recomputes per its own league filter. Drives
//      the two new axis options and the quadrant.

const DECAY = 0.45;

// ---- 7 archetype "types" ----
// Tempo-Setter was removed entirely (2026-10-18) — it never carried enough
// of its own signal once DLP's generic-passing metrics were stripped out
// (11.71% -> 10.29% overlap at launch was still too high to justify a
// separate type), and in practice it ate up ~12% of the pool as a
// catch-all. Players who were Tempo-Setter now fall through to whatever
// they actually are: their next-best type, a hybrid, Generalist, or No
// clear profile.
// DLP (refined): hexagon DLP (Deep Playmaker CM) minus the two generic-
// passing metrics ('Passes per 90', 'Accurate passes, %'). Everything else
// is unchanged.
const DLP_W = { 'Forward Passes': 2, 'Progressive Passes': 3, 'Passes to F3rd': 2.5, 'Forward Pass %': 1.5, 'Long Pass %': 1 };
// Anchor (refined): duel VOLUME dropped entirely (the thing that made it
// overlap with Ball-Winner); 'Aerial duels won %' also dropped — not part
// of the archetype spec's ingredient list (hexagon-only).
const ANCHOR_W = { 'PAdj Interceptions': 3, 'Shots Blocked': 2, 'Defensive Duel %': 1 };
// Ball-Winner: identical to the hexagon's weights already — the spec just
// restates them, so re-derive via the same per-season-percentile method for
// methodological consistency with DLP/Tempo-Setter/Anchor (all four go
// through the exact same pipeline here), rather than reusing the hexagon's
// own already-blended field.
const BALL_WINNER_W = { 'Defensive Duels': 3, 'Defensive Duel %': 2 };

// label -> which g-bucket (A attacking / D defensive / P possession) it
// lives in, per Pipeline/build_players.py's G_GROUPS['CM'].
const D_LABELS = new Set(['Defensive Duels', 'Defensive Duel %', 'Shots Blocked', 'PAdj Interceptions', 'Aerial Duels', 'Aerial Duel %']);
function bucketOf(label) { return D_LABELS.has(label) ? 'D' : label === 'xA' ? 'A' : 'P'; }

function pctFromSeason(sd, label) {
  const bucket = sd && sd.g && sd.g[bucketOf(label)];
  const row = bucket && bucket.find(r => r[0] === label);
  return row ? row[1] : null; // 2nd element = percentile within League+Season+CM
}
function rawFromSeason(sd, label) {
  const bucket = sd && sd.g && sd.g[bucketOf(label)];
  const row = bucket && bucket.find(r => r[0] === label);
  return row ? parseFloat(row[2]) : null; // 3rd element = raw per-90 value
}
function weightedPct(sd, weights) {
  let vals = [], ws = [];
  for (const [label, w] of Object.entries(weights)) {
    const v = pctFromSeason(sd, label);
    if (v != null) { vals.push(v); ws.push(w); }
  }
  if (!vals.length) return null;
  return vals.reduce((s, v, i) => s + v * ws[i], 0) / ws.reduce((a, b) => a + b, 0);
}

// Seasons newest-first, limited to the ones with a stored g-block (i.e. the
// pipeline scored them — matches SCORING_MINUTES/VALID_SEASONS eligibility
// already applied upstream when seasonsDetail was built).
function orderedQualifyingSeasons(p) {
  return (p.allSeasonsSummary || []).map(r => r.s).filter(s => p.seasonsDetail && p.seasonsDetail[s] && p.seasonsDetail[s].g);
}

function careerBlend(p, weights, seasons) {
  let num = 0, den = 0;
  seasons.forEach((s, i) => {
    const sc = weightedPct(p.seasonsDetail[s], weights);
    if (sc == null) return;
    const w = Math.exp(-DECAY * i);
    num += sc * w; den += w;
  });
  return den > 0 ? num / den : null;
}

// The 7 archetype type scores (0-100), career-blended. Returns null if the
// player has no qualifying CM season data at all.
export function cmTypeScores(p) {
  const seasons = orderedQualifyingSeasons(p);
  if (!seasons.length) return null;
  const qc = p.qcRoleCareerScores || {};
  const dlp = careerBlend(p, DLP_W, seasons);
  const anchor = careerBlend(p, ANCHOR_W, seasons);
  const ballWinner = careerBlend(p, BALL_WINNER_W, seasons);
  const playmaker = qc['Playmaker'] ?? null;
  const ballCarrier = qc['Ball Carrier'] ?? null;
  const boxToBox = qc['Box-to-Box'] ?? null;
  const amHex = qc['Attacking Midfielder'] ?? null;
  const boxCrasher = qc['Box-Crasher'] ?? null;
  const attackingMid = (amHex != null || boxCrasher != null) ? Math.max(amHex ?? -Infinity, boxCrasher ?? -Infinity) : null;
  const types = { DLP: dlp, Playmaker: playmaker, 'Ball-Winner': ballWinner, Anchor: anchor, 'Attacking Midfielder': attackingMid, 'Ball Carrier': ballCarrier, 'Box-to-Box': boxToBox };
  if (Object.values(types).every(v => v == null)) return null;
  return types;
}

// ---- Classification ----
// Only pairs that held >=3% of the global CM pool (>=900 mins latest
// season) at T>=65/gap<10 are kept as named hybrids (design-time analysis,
// 2026-10-18) — the rest fall back to the dominant type by design.
export const HYBRID_CANDIDATES = {
  'DLP+Playmaker': { label: 'Complete Playmaker', kept: true },               // 4.03% — kept
  'Attacking Midfielder+Playmaker': { label: 'Creative Box Threat', kept: true }, // 4.13% — kept
  'Ball Carrier+Attacking Midfielder': { label: 'Dynamic 10', kept: false },       // 0.00%
  'Ball Carrier+Playmaker': { label: 'Progressive Creator', kept: false },        // 2.10%
  'Anchor+DLP': { label: 'Regista', kept: false },                                // 2.19%
  'Ball-Winner+Ball Carrier': { label: 'Ball-Winning Carrier', kept: false },      // 0.00%
};
const pairKey = (a, b) => [a, b].sort().join('+');

// Display order: passing family, defending family, then the three standalone types.
export const CM_TYPE_KEYS = ['DLP', 'Playmaker', 'Ball-Winner', 'Anchor', 'Attacking Midfielder', 'Ball Carrier', 'Box-to-Box'];
export const CM_KEPT_HYBRIDS = Object.values(HYBRID_CANDIDATES).filter(c => c.kept).map(c => c.label);

// Generalist: not dominant at anything (no type >=70), not a kept hybrid,
// but solid across several types at once — >=GENERALIST_MIN_TYPES of the 7
// types at >=GENERALIST_THRESHOLD. See zz_cm_archetype.test.js for counts at
// the alternative thresholds considered (3-of-7 >=55, 4-of-7 >=50, 4-of-7
// >=60) before settling on 4-of-7 >=55.
export const GENERALIST_MIN_TYPES = 4;
export const GENERALIST_THRESHOLD = 55;

export const ARCHETYPE_COLORS = {
  // Passing family — 2 shades of blue
  DLP: '#60a5fa', Playmaker: '#1d4ed8',
  // Defending family — 2 shades of red
  'Ball-Winner': '#f87171', Anchor: '#dc2626',
  'Attacking Midfielder': '#f97316', // orange
  'Ball Carrier': '#22c55e',          // green
  'Box-to-Box': '#a855f7',            // purple
  // Kept hybrids — their own distinct colours
  'Complete Playmaker': '#14b8a6',
  'Creative Box Threat': '#ec4899',
  // Neutral, outside every family (sand/gold) — no outline, normal size
  Generalist: '#ca8a04',
  'No clear profile': '#64748b',      // grey, smaller dot (handled by draw code)
};

// { kind: 'dominant'|'hybrid'|'generalist'|'none', key, label, color }
export function classifyCmArchetype(types) {
  if (!types) return null;
  const entries = Object.entries(types).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { kind: 'none', key: 'No clear profile', label: 'No clear profile', color: ARCHETYPE_COLORS['No clear profile'] };
  const [n1, s1] = entries[0];
  const [n2, s2] = entries[1] || [null, null];
  if (s2 != null && s1 >= 65 && s2 >= 65 && (s1 - s2) < 10) {
    const cand = HYBRID_CANDIDATES[pairKey(n1, n2)];
    if (cand && cand.kept) return { kind: 'hybrid', key: cand.label, label: cand.label, color: ARCHETYPE_COLORS[cand.label] };
  }
  if (s1 >= 70) return { kind: 'dominant', key: n1, label: n1, color: ARCHETYPE_COLORS[n1] };
  if (entries.filter(([, v]) => v >= GENERALIST_THRESHOLD).length >= GENERALIST_MIN_TYPES) {
    return { kind: 'generalist', key: 'Generalist', label: 'Generalist', color: ARCHETYPE_COLORS['Generalist'] };
  }
  return { kind: 'none', key: 'No clear profile', label: 'No clear profile', color: ARCHETYPE_COLORS['No clear profile'] };
}

// ---- Feature Q: Possession Score / Defensive Score ----
// Verbatim from Scouting-Hub/pages/03_Central_Midfielders.py metric_groups
// (re-checked against source 2026-10-18; note 'Defensive duels won, %' is
// 0.3 there, not 0.4 — using the source value).
export const DEF_SCORE_W = { 'Defensive Duels': 0.4, 'Defensive Duel %': 0.3, 'PAdj Interceptions': 0.2, 'Shots Blocked': 0.1 };
export const POSS_SCORE_W = { Passes: 0.2, 'Pass %': 0.1, 'Forward Passes': 0.2, 'Progressive Passes': 0.2, xA: 0.1, 'Key Passes': 0.1, 'Passes to Box': 0.1 };

function latestSeasonDetail(p) {
  const seasons = orderedQualifyingSeasons(p);
  return seasons.length ? p.seasonsDetail[seasons[0]] : null;
}

function percentileRanks(values) {
  const n = values.length;
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = avgRank;
    i = j + 1;
  }
  return ranks.map(r => (r / n) * 100);
}

// Ranks Possession/Defensive Score for every CM in `players` against each
// other (the current filtered Scout Index pool) — recomputed whenever that
// pool changes, matching how Feature Q itself recomputes per its own league
// filter rather than using a fixed global percentile.
export function computeCmPoolScores(players) {
  const rows = [];
  for (const p of players) {
    const sd = latestSeasonDetail(p);
    if (!sd) continue;
    const defRaw = {}, possRaw = {};
    let ok = true;
    for (const l of Object.keys(DEF_SCORE_W)) { const v = rawFromSeason(sd, l); if (v == null || Number.isNaN(v)) { ok = false; break; } defRaw[l] = v; }
    if (ok) for (const l of Object.keys(POSS_SCORE_W)) { const v = rawFromSeason(sd, l); if (v == null || Number.isNaN(v)) { ok = false; break; } possRaw[l] = v; }
    if (!ok) continue;
    rows.push({ id: p.id, defRaw, possRaw });
  }
  for (const l of Object.keys(DEF_SCORE_W)) { const r = percentileRanks(rows.map(x => x.defRaw[l])); rows.forEach((x, i) => x.defRaw[l + '_pct'] = r[i]); }
  for (const l of Object.keys(POSS_SCORE_W)) { const r = percentileRanks(rows.map(x => x.possRaw[l])); rows.forEach((x, i) => x.possRaw[l + '_pct'] = r[i]); }
  const out = new Map();
  for (const x of rows) {
    const def = Object.entries(DEF_SCORE_W).reduce((s, [k, w]) => s + x.defRaw[k + '_pct'] * w, 0);
    const poss = Object.entries(POSS_SCORE_W).reduce((s, [k, w]) => s + x.possRaw[k + '_pct'] * w, 0);
    out.set(x.id, { possessionScore: poss, defensiveScore: def });
  }
  return out;
}
