// Generic archetype scoring engine — works for every position from
// src/archetypeConfig.js. Scatter colouring only; never touches the Style
// Hexagon (QC_ROLES) or any score QuickCard/PlayerPager shows. Computed
// entirely from data already shipped in the player JSON
// (seasonsDetail[season].g.{A,D,P} per-season percentiles/raw values,
// qcRoleCareerScores), so no pipeline rebuild is needed.
import { ARCHETYPE_CONFIG, COMPLETE_THRESHOLD, COMPLETE_MIN_ROLES, GENERALIST_THRESHOLD, GENERALIST_MIN_ROLES, HYBRID_2_GAP, HYBRID_3_SPREAD } from './archetypeConfig';

const DECAY = 0.45;

// G_GROUPS, Pipeline/build_players.py — short label (as stored in
// seasonsDetail[season].g[bucket]) <-> Wyscout metric name (as used in
// archetypeConfig.js, matching the Scouting-Hub Feature Q source and
// QC_ROLES), per position.
const G_GROUPS = {
  GK: { A: [['Exits','Exits per 90'],['Goals Prevented','Prevented goals per 90'],['Goals Conceded','Conceded goals per 90'],['Save Rate','Save rate, %'],['Shots Against','Shots against per 90'],['xG Against','xG against per 90']],
        D: [], P: [['Long Passes','Long passes per 90'],['Long Pass %','Accurate long passes, %'],['Passes','Passes per 90'],['Pass %','Accurate passes, %']] },
  CB: { A: [['Goals: Non-Penalty','Non-penalty goals per 90'],['xG','xG per 90'],['Offensive Duels','Offensive duels per 90'],['Offensive Duel %','Offensive duels won, %'],['Progressive Runs','Progressive runs per 90']],
        D: [['Aerial Duels','Aerial duels per 90'],['Aerial Duel %','Aerial duels won, %'],['Defensive Duels','Defensive duels per 90'],['Defensive Duel %','Defensive duels won, %'],['PAdj Interceptions','PAdj Interceptions'],['Shots Blocked','Shots blocked per 90']],
        P: [['Accelerations','Accelerations per 90'],['Dribbles','Dribbles per 90'],['Dribble %','Successful dribbles, %'],['Forward Passes','Forward passes per 90'],['Forward Pass %','Accurate forward passes, %'],['Long Passes','Long passes per 90'],['Long Pass %','Accurate long passes, %'],['Passes','Passes per 90'],['Pass %','Accurate passes, %'],['Passes to F3rd','Passes to final third per 90'],['Passes to F3rd %','Accurate passes to final third, %'],['Progressive Passes','Progressive passes per 90'],['Prog Pass %','Accurate progressive passes, %']] },
  FB: { A: [['Crosses','Crosses per 90'],['Cross %','Accurate crosses, %'],['Goals: Non-Penalty','Non-penalty goals per 90'],['xG','xG per 90'],['xA','xA per 90'],['Offensive Duels','Offensive duels per 90'],['Offensive Duel %','Offensive duels won, %'],['Progressive Runs','Progressive runs per 90'],['Shots','Shots per 90'],['Shot %','Shots on target, %'],['Touches in Box','Touches in box per 90']],
        D: [['Aerial Duels','Aerial duels per 90'],['Aerial Duel %','Aerial duels won, %'],['Defensive Duels','Defensive duels per 90'],['Defensive Duel %','Defensive duels won, %'],['Shots Blocked','Shots blocked per 90'],['PAdj Interceptions','PAdj Interceptions']],
        P: [['Accelerations','Accelerations per 90'],['Deep Completions','Deep completions per 90'],['Dribbles','Dribbles per 90'],['Dribble %','Successful dribbles, %'],['Forward Passes','Forward passes per 90'],['Forward Pass %','Accurate forward passes, %'],['Key Passes','Key passes per 90'],['Long Passes','Long passes per 90'],['Long Pass %','Accurate long passes, %'],['Passes','Passes per 90'],['Pass %','Accurate passes, %'],['Passes to F3rd','Passes to final third per 90'],['Passes to F3rd %','Accurate passes to final third, %'],['Passes to Box','Passes to penalty area per 90'],['Passes to Box %','Accurate passes to penalty area, %'],['Progressive Passes','Progressive passes per 90'],['Prog Pass %','Accurate progressive passes, %'],['Smart Passes','Smart passes per 90']] },
  CM: { A: [['Crosses','Crosses per 90'],['Cross %','Accurate crosses, %'],['Goals: Non-Penalty','Non-penalty goals per 90'],['xG','xG per 90'],['xA','xA per 90'],['Offensive Duels','Offensive duels per 90'],['Offensive Duel %','Offensive duels won, %'],['Progressive Runs','Progressive runs per 90'],['Shots','Shots per 90'],['Touches in Box','Touches in box per 90']],
        D: [['Aerial Duels','Aerial duels per 90'],['Aerial Duel %','Aerial duels won, %'],['Defensive Duels','Defensive duels per 90'],['Defensive Duel %','Defensive duels won, %'],['Shots Blocked','Shots blocked per 90'],['PAdj Interceptions','PAdj Interceptions']],
        P: [['Deep Completions','Deep completions per 90'],['Dribbles','Dribbles per 90'],['Dribble %','Successful dribbles, %'],['Forward Passes','Forward passes per 90'],['Forward Pass %','Accurate forward passes, %'],['Key Passes','Key passes per 90'],['Long Passes','Long passes per 90'],['Long Pass %','Accurate long passes, %'],['Passes','Passes per 90'],['Pass %','Accurate passes, %'],['Passes to F3rd','Passes to final third per 90'],['Passes to F3rd %','Accurate passes to final third, %'],['Passes to Box','Passes to penalty area per 90'],['Passes to Box %','Accurate passes to penalty area, %'],['Progressive Passes','Progressive passes per 90'],['Prog Pass %','Accurate progressive passes, %'],['Smart Passes','Smart passes per 90']] },
  ATT:{ A: [['Crosses','Crosses per 90'],['Cross %','Accurate crosses, %'],['Goals: Non-Penalty','Non-penalty goals per 90'],['xG','xG per 90'],['Conversion %','Goal conversion, %'],['xA','xA per 90'],['Progressive Runs','Progressive runs per 90'],['Shots','Shots per 90'],['Shot %','Shots on target, %'],['Touches in Box','Touches in box per 90']],
        D: [['Aerial Duels','Aerial duels per 90'],['Aerial Duel %','Aerial duels won, %'],['Defensive Duels','Defensive duels per 90'],['Defensive Duel %','Defensive duels won, %'],['PAdj Interceptions','PAdj Interceptions']],
        P: [['Accelerations','Accelerations per 90'],['Deep Completions','Deep completions per 90'],['Dribbles','Dribbles per 90'],['Dribble %','Successful dribbles, %'],['Forward Passes','Forward passes per 90'],['Long Passes','Long passes per 90'],['Key Passes','Key passes per 90'],['Passes','Passes per 90'],['Pass %','Accurate passes, %'],['Passes to F3rd','Passes to final third per 90'],['Passes to F3rd %','Accurate passes to final third, %'],['Passes to Box','Passes to penalty area per 90'],['Passes to Box %','Accurate passes to penalty area, %'],['Progressive Passes','Progressive passes per 90'],['Prog Pass %','Accurate progressive passes, %'],['Smart Passes','Smart passes per 90']] },
  CF: { A: [['Crosses','Crosses per 90'],['Cross %','Accurate crosses, %'],['Goals: Non-Penalty','Non-penalty goals per 90'],['xG','xG per 90'],['Conversion %','Goal conversion, %'],['Header Goals','Head goals per 90'],['xA','xA per 90'],['Progressive Runs','Progressive runs per 90'],['Shots','Shots per 90'],['Shot %','Shots on target, %'],['Touches in Box','Touches in box per 90']],
        D: [['Aerial Duels','Aerial duels per 90'],['Aerial Duel %','Aerial duels won, %'],['Defensive Duels','Defensive duels per 90'],['Defensive Duel %','Defensive duels won, %'],['PAdj Interceptions','PAdj Interceptions']],
        P: [['Deep Completions','Deep completions per 90'],['Dribbles','Dribbles per 90'],['Dribble %','Successful dribbles, %'],['Key Passes','Key passes per 90'],['Passes','Passes per 90'],['Pass %','Accurate passes, %'],['Passes to Box','Passes to penalty area per 90'],['Passes to Box %','Accurate passes to penalty area, %'],['Smart Passes','Smart passes per 90']] },
};

const REVERSE = {}; // pos -> Wyscout metric name -> { label, bucket }
for (const pos of Object.keys(G_GROUPS)) {
  const rev = {};
  for (const bucket of ['A', 'D', 'P']) for (const [label, metric] of G_GROUPS[pos][bucket] || []) rev[metric] = { label, bucket };
  REVERSE[pos] = rev;
}

function pctFromSeason(pos, sd, metric) {
  const meta = REVERSE[pos][metric];
  if (!meta) return null;
  const bucket = sd && sd.g && sd.g[meta.bucket];
  const row = bucket && bucket.find(r => r[0] === meta.label);
  return row ? row[1] : null; // 2nd element = percentile within League+Season+position
}
function rawFromSeason(pos, sd, metric) {
  const meta = REVERSE[pos][metric];
  if (!meta) return null;
  const bucket = sd && sd.g && sd.g[meta.bucket];
  const row = bucket && bucket.find(r => r[0] === meta.label);
  return row ? parseFloat(row[2]) : null; // 3rd element = raw per-90 value
}
function weightedPct(pos, sd, weights) {
  let vals = [], ws = [];
  for (const [metric, w] of Object.entries(weights)) {
    const v = pctFromSeason(pos, sd, metric);
    if (v != null) { vals.push(v); ws.push(w); }
  }
  if (!vals.length) return null;
  return vals.reduce((s, v, i) => s + v * ws[i], 0) / ws.reduce((a, b) => a + b, 0);
}

// Seasons newest-first, limited to the ones with a stored g-block (i.e. the
// pipeline scored them — SCORING_MINUTES/VALID_SEASONS eligibility already
// applied upstream when seasonsDetail was built).
function orderedQualifyingSeasons(p) {
  return (p.allSeasonsSummary || []).map(r => r.s).filter(s => p.seasonsDetail && p.seasonsDetail[s] && p.seasonsDetail[s].g);
}
function latestSeasonDetail(p) {
  const seasons = orderedQualifyingSeasons(p);
  return seasons.length ? p.seasonsDetail[seasons[0]] : null;
}
function careerBlend(pos, p, weights, seasons) {
  let num = 0, den = 0;
  seasons.forEach((s, i) => {
    const sc = weightedPct(pos, p.seasonsDetail[s], weights);
    if (sc == null) return;
    const w = Math.exp(-DECAY * i);
    num += sc * w; den += w;
  });
  return den > 0 ? num / den : null;
}

// The role scores (0-100), career-blended, for one player at one position.
// Returns null if the player has no qualifying season data at all.
export function roleScoresFor(pos, p) {
  const cfg = ARCHETYPE_CONFIG[pos];
  if (!cfg) return null;
  const seasons = orderedQualifyingSeasons(p);
  if (!seasons.length) return null;
  const qc = p.qcRoleCareerScores || {};
  const scores = {};
  for (const [roleName, def] of Object.entries(cfg.roles)) scores[roleName] = resolveRoleDef(pos, p, def, seasons, qc);
  if (Object.values(scores).every(v => v == null)) return null;
  return scores;
}

// Resolves any role-def shape to a single 0-100 score (or null): a fresh
// career-blended weights score, a reused hexagon qcRoleCareerScores value,
// or the max across several sub-defs of either kind (CB's Ball-Playing CB,
// CM's Attacking Midfielder, CF's False 9 — see archetypeConfig.js).
function resolveRoleDef(pos, p, def, seasons, qc) {
  if (def.weights) return careerBlend(pos, p, def.weights, seasons);
  if (def.maxOf) {
    const vals = def.maxOf.map(d => resolveRoleDef(pos, p, d, seasons, qc)).filter(v => v != null);
    return vals.length ? Math.max(...vals) : null;
  }
  if (def.hexagon) return qc[def.hexagon] ?? null;
  return null;
}

// Same role defs, resolved against ONE season's own data only (no career
// recency blending) — used when the scatter's season filter picks a
// specific season instead of 'all'. Hexagon-reuse roles read that season's
// own seasonsDetail[season].qcRoles (the pipeline's per-season hexagon
// scores, already shipped for every qualifying season, not just the
// latest), rather than qcRoleCareerScores.
function resolveRoleDefSeason(pos, sd, def) {
  if (def.weights) return weightedPct(pos, sd, def.weights);
  if (def.maxOf) {
    const vals = def.maxOf.map(d => resolveRoleDefSeason(pos, sd, d)).filter(v => v != null);
    return vals.length ? Math.max(...vals) : null;
  }
  if (def.hexagon) return (sd.qcRoles && sd.qcRoles[def.hexagon]) ?? null;
  return null;
}

// The role scores (0-100) for one player at one position, for ONE season's
// data only (no career blend) — sd is a seasonsDetail-shaped entry, e.g.
// from seasonDetailFor(player, season, leagues). Returns null if sd has no
// usable data for this position's roles.
export function roleScoresForSeason(pos, sd) {
  const cfg = ARCHETYPE_CONFIG[pos];
  if (!cfg || !sd) return null;
  const scores = {};
  for (const [roleName, def] of Object.entries(cfg.roles)) scores[roleName] = resolveRoleDefSeason(pos, sd, def);
  if (Object.values(scores).every(v => v == null)) return null;
  return scores;
}

// { kind: 'complete'|'hybrid'|'dominant'|'generalist'|'none', key, label, color }
export function classifyArchetype(pos, roleScores) {
  const cfg = ARCHETYPE_CONFIG[pos];
  if (!cfg || !roleScores) return null;
  // ALL computed roles (including any marked not a "main type", e.g. ATT's
  // Creator) count toward Complete and Generalist — only the dominant step
  // (d) restricts to cfg.mainTypes, since that's the only one that turns a
  // single role into its own standalone archetype label.
  const entries = Object.entries(roleScores).filter(([, v]) => v != null);
  const none = () => ({ kind: 'none', key: 'No clear profile', label: 'No clear profile', color: cfg.colors['No clear profile'] });
  if (!entries.length) return none();

  // a) Complete: 3+ roles >= this position's completeThreshold (default
  // COMPLETE_THRESHOLD, overridable per position — ATT uses 80).
  const completeT = cfg.completeThreshold ?? COMPLETE_THRESHOLD;
  if (entries.filter(([, v]) => v >= completeT).length >= COMPLETE_MIN_ROLES) {
    return { kind: 'complete', key: cfg.completeLabel, label: cfg.completeLabel, color: cfg.colors[cfg.completeLabel] };
  }
  // b) 3-role hybrids (checked directly against each named triple, not the player's own top-3)
  for (const h of cfg.hybrids) {
    if (h.roles.length !== 3) continue;
    const vals = h.roles.map(r => roleScores[r]);
    if (vals.every(v => v != null && v >= cfg.hybridThreshold) && (Math.max(...vals) - Math.min(...vals)) <= HYBRID_3_SPREAD) {
      return { kind: 'hybrid', key: h.name, label: h.name, color: cfg.colors[h.name] };
    }
  }
  // c) 2-role hybrids
  for (const h of cfg.hybrids) {
    if (h.roles.length !== 2) continue;
    const [a, b] = h.roles.map(r => roleScores[r]);
    if (a != null && b != null && a >= cfg.hybridThreshold && b >= cfg.hybridThreshold && Math.abs(a - b) < HYBRID_2_GAP) {
      return { kind: 'hybrid', key: h.name, label: h.name, color: cfg.colors[h.name] };
    }
  }
  // d) dominant: best single MAIN-TYPE role >= dominantThreshold (a role
  // that's computed but not in mainTypes, e.g. ATT's Creator, can never
  // itself become the dominant label).
  const mainEntries = entries.filter(([name]) => cfg.mainTypes.includes(name));
  const sorted = [...mainEntries].sort((a, b) => b[1] - a[1]);
  if (sorted.length && sorted[0][1] >= cfg.dominantThreshold) {
    const [name] = sorted[0];
    return { kind: 'dominant', key: name, label: name, color: cfg.colors[name] };
  }
  // e) generalist: 3+ roles >= GENERALIST_THRESHOLD
  if (entries.filter(([, v]) => v >= GENERALIST_THRESHOLD).length >= GENERALIST_MIN_ROLES) {
    return { kind: 'generalist', key: 'Generalist', label: 'Generalist', color: cfg.colors.Generalist };
  }
  // f) none
  return none();
}

// Collapses a classifyArchetype() result to its Simple-mode family entry
// for this position: { kind, key: family token, label, color }. `kind` is
// kept as-is (complete/hybrid/dominant/generalist/none) so callers that
// branch on it (e.g. "is this a grey dot") don't need a second code path.
export function simpleFamilyOf(pos, arch) {
  const cfg = ARCHETYPE_CONFIG[pos];
  if (!cfg || !arch) return null;
  const label = cfg.simpleLabelOf[arch.key];
  const color = cfg.simpleColors[arch.key];
  // The family token itself (for counting/legend keys) — complete/
  // generalist/none reuse their own kind as the token, every other
  // archetype's token comes from cfg.simple.family.
  const key = arch.kind === 'complete' ? 'complete' : arch.kind === 'generalist' ? 'generalist' : arch.kind === 'none' ? 'none' : cfg.simple.family[arch.key];
  return { kind: arch.kind, key, label, color };
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

// Shared tail for both quadrant-score modes below: percentile-rank each raw
// metric across the pool, weight into the two axis scores, assign a corner.
function rankQuadrant(cfg, rows) {
  const { x, y, names } = cfg.quadrant;
  for (const m of Object.keys(x.w)) { const r = percentileRanks(rows.map(v => v.xRaw[m])); rows.forEach((v, i) => v.xRaw[m + '_pct'] = r[i]); }
  for (const m of Object.keys(y.w)) { const r = percentileRanks(rows.map(v => v.yRaw[m])); rows.forEach((v, i) => v.yRaw[m + '_pct'] = r[i]); }
  const out = new Map();
  for (const row of rows) {
    const xs = Object.entries(x.w).reduce((s, [k, w]) => s + row.xRaw[k + '_pct'] * w, 0);
    const ys = Object.entries(y.w).reduce((s, [k, w]) => s + row.yRaw[k + '_pct'] * w, 0);
    const q = (xs >= 50 && ys >= 50) ? names.both : ys >= 50 ? names.yOnly : xs >= 50 ? names.xOnly : names.neither;
    out.set(row.id, { x: xs, y: ys, q });
  }
  return out;
}

// Ranks the position's two Feature Q axis scores for every player in
// `players` against each other (the current filtered Scout Index pool) —
// recomputed whenever that pool changes, matching how Feature Q itself
// recomputes per its own league filter rather than a fixed global percentile.
// seasonDetailOf(player) resolves which season's raw data to use per player;
// defaults to each player's own latest qualifying season (unchanged
// behaviour) when the caller doesn't pass one — e.g. when the scatter's
// season filter is 'all', or for the career-only callers in tests.
export function computeQuadrantScores(pos, players, seasonDetailOf = latestSeasonDetail) {
  const cfg = ARCHETYPE_CONFIG[pos];
  const { x, y } = cfg.quadrant;
  const rows = [];
  for (const p of players) {
    const sd = seasonDetailOf(p);
    if (!sd) continue;
    const xRaw = {}, yRaw = {}; let ok = true;
    for (const m of Object.keys(x.w)) { const v = rawFromSeason(pos, sd, m); if (v == null || Number.isNaN(v)) { ok = false; break; } xRaw[m] = v; }
    if (ok) for (const m of Object.keys(y.w)) { const v = rawFromSeason(pos, sd, m); if (v == null || Number.isNaN(v)) { ok = false; break; } yRaw[m] = v; }
    if (!ok) continue;
    rows.push({ id: p.id, xRaw, yRaw });
  }
  return rankQuadrant(cfg, rows);
}

// A player's blended raw per-90 value for one metric, across all their
// qualifying seasons — weighted by BOTH recency (same decay as the career
// role-score blend) AND that season's minutes, so a 300-minute season
// doesn't pull the average as hard as a full one did.
function careerBlendRaw(pos, p, metric, seasons) {
  let num = 0, den = 0;
  seasons.forEach((s, i) => {
    const sd = p.seasonsDetail[s];
    const v = rawFromSeason(pos, sd, metric);
    if (v == null || Number.isNaN(v)) return;
    const mins = sd.minutes || 0;
    if (mins <= 0) return;
    const w = Math.exp(-DECAY * i) * mins;
    num += v * w; den += w;
  });
  return den > 0 ? num / den : null;
}

// Same ranking as computeQuadrantScores, but each metric is first blended
// across a player's whole qualifying-season history (recency + minutes
// weighted) instead of taken from one season — the "Career blend" axes
// option, offered only when the scatter's season filter is 'all'.
export function computeQuadrantScoresCareerBlend(pos, players) {
  const cfg = ARCHETYPE_CONFIG[pos];
  const { x, y } = cfg.quadrant;
  const rows = [];
  for (const p of players) {
    const seasons = orderedQualifyingSeasons(p);
    if (!seasons.length) continue;
    const xRaw = {}, yRaw = {}; let ok = true;
    for (const m of Object.keys(x.w)) { const v = careerBlendRaw(pos, p, m, seasons); if (v == null || Number.isNaN(v)) { ok = false; break; } xRaw[m] = v; }
    if (ok) for (const m of Object.keys(y.w)) { const v = careerBlendRaw(pos, p, m, seasons); if (v == null || Number.isNaN(v)) { ok = false; break; } yRaw[m] = v; }
    if (!ok) continue;
    rows.push({ id: p.id, xRaw, yRaw });
  }
  return rankQuadrant(cfg, rows);
}
