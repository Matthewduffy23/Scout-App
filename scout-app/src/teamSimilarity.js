// teamSimilarity.js — "Similar teams" calculator engine for the Team Index profile.
//
// Same method as ScoutBoard Pro's find_similar_teams() (Database repo, server.py) and
// build_teams.py, which TeamReport.js's computeSimilarTeams() already ports:
//   - 14 style features, weights 1 or 2 (normalised to sum 1)
//   - percentile rank WITHIN each league-season (pandas rank(pct=True), ties averaged)
//   - z-score of the raw per-90/% value WITHIN each season (population std)
//   - weighted L1 distance on each; similarity = 50·exp(-2.8·pctDist) + 50·exp(-0.6·zDist)
//   - league-strength discount: sim *= floor + (1-floor)·min(lsA,lsB)/max(lsA,lsB)
//     floor 0.8 = build_teams.py / the stored similarTeams on the same card.
//     (Railway's Global list uses beta 0.4, i.e. floor 0.6.)
// The difference from both: the candidate pool is EVERY team-season in teams_final.json,
// not one season (build_teams) or the last 3 (Railway). Normalising per league-season
// and per season keeps those comparable — a 2021-22 Championship side and a 2026
// MLS side are both measured against their own league and year.
import { LEAGUE_STRENGTHS, GBE_LEAGUE_BANDS, COUNTRY_TO_REGION } from './constants';

// [metricGroups group, metric name in teams_final.json, weight, display label]
export const TEAM_SIM_FEATURES = [
  ['Attack', 'Crosses', 1, 'Crosses'],
  ['Attack', 'Goals Scored', 1, 'Goals'],
  ['Attack', 'xG', 1, 'xG'],
  ['Attack', 'Touches in Box', 1, 'Touches in Box'],
  ['Defence', 'Goals Against', 1, 'Goals Against'],
  ['Defence', 'xG Against', 1, 'xG Against'],
  ['Defence', 'Defensive Duels', 1, 'Defensive Duels'],
  ['Defence', 'PPDA', 2, 'PPDA'],
  ['Possession', 'Possession', 2, 'Possession %'],
  ['Possession', 'Passes', 2, 'Passes'],
  ['Possession', 'Passing Accuracy %', 2, 'Pass Accuracy %'],
  ['Possession', 'Long Passes', 2, 'Long Passes'],
  ['Possession', 'Passes to Final 3rd', 1, 'Passes to Final 3rd'],
  ['Possession', 'Progressive Passes', 1, 'Progressive Passes'],
];
const K = TEAM_SIM_FEATURES.length;
const W = (() => {
  const total = TEAM_SIM_FEATURES.reduce((a, f) => a + f[2], 0);
  return TEAM_SIM_FEATURES.map(f => f[2] / total);
})();
export const SIM_LEAGUE_FLOOR = 0.8;

// ── Custom weights (Edit weights panel) ─────────────────────────────────────
// Stored as {label: weight 0-3} in localStorage, keyed by the TEAM_SIM_FEATURES
// display label. Missing/invalid entries fall back to the built-in default weight.
const TEAM_WEIGHTS_KEY = 'scout_team_sim_weights';
export const defaultTeamWeights = () => Object.fromEntries(TEAM_SIM_FEATURES.map(f => [f[3], f[2]]));
export function loadTeamWeightOverrides() {
  try {
    const raw = JSON.parse(localStorage.getItem(TEAM_WEIGHTS_KEY) || '{}');
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  } catch { return {}; }
}
export function saveTeamWeightOverrides(obj) { try { localStorage.setItem(TEAM_WEIGHTS_KEY, JSON.stringify(obj || {})); } catch {} }
export function isCustomTeamWeights(custom) {
  if (!custom) return false;
  return TEAM_SIM_FEATURES.some(f => custom[f[3]] != null && Number(custom[f[3]]) !== f[2]);
}
// Normalised weight vector (sums to 1), same order as TEAM_SIM_FEATURES — the
// default when `custom` is absent/empty is identical to the module constant W.
function weightVector(custom) {
  const raw = TEAM_SIM_FEATURES.map(f => {
    const v = custom && custom[f[3]];
    return (v != null && isFinite(v)) ? Number(v) : f[2];
  });
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map(w => w / total);
}

const RESERVE_RE = /\s(II|B|U\d{2})$/;
export const isReserveTeam = (name) => {
  const n = String(name || '').trim();
  return n !== 'Willem II' && RESERVE_RE.test(n);
};
export const normLeague = (l) => String(l == null ? '' : l).trim().replace(/\.+$/, '').trim().toLowerCase();
// teams_final.json has no trailing period; constants.js keys do ('England 1.').
export const dotLeague = (l) => String(l == null ? '' : l).trim().replace(/\.+$/, '').trim() + '.';
export const teamCountry = (l) => String(l || '').trim().replace(/\s+\d+\.?$/, '').toLowerCase();
export const leagueStrength = (l) => LEAGUE_STRENGTHS[dotLeague(l)] || 0;   // same as the Team Index LS filter
export const leagueBand = (l) => GBE_LEAGUE_BANDS[dotLeague(l)] || 6;       // same as leagueToBand()
export const leagueRegion = (l) => COUNTRY_TO_REGION[String(l || '').trim().replace(/\s+\d+\.?$/, '')] || 'Other';
export const simStrength = (l) => Math.max(LEAGUE_STRENGTHS[dotLeague(l)] || 30, 1e-6); // port's fallback

// ── Shared with playerSimilarity.js ─────────────────────────────────────────
// Weighted-L1 distances -> 0-100 similarity: 50% percentile half, 50% z-score half,
// then the league-strength discount (floor + (1-floor)·min/max strength ratio).
export function blendSimilarity(pctDist, zDist, simLsA, simLsB, floor = SIM_LEAGUE_FLOOR) {
  const sim = Math.exp(-2.8 * pctDist) * 50 + Math.exp(-0.6 * zDist) * 50;
  return sim * (floor + (1 - floor) * Math.min(simLsA / simLsB, simLsB / simLsA));
}
// Population mean / sd of each column over the given rows (NaN values skipped; sd 0 -> 1).
export function columnStats(vectors, k) {
  const mean = new Float64Array(k), sd = new Float64Array(k), cnt = new Float64Array(k);
  for (const v of vectors) for (let c = 0; c < k; c++) if (isFinite(v[c])) { mean[c] += v[c]; cnt[c]++; }
  for (let c = 0; c < k; c++) mean[c] = cnt[c] ? mean[c] / cnt[c] : 0;
  for (const v of vectors) for (let c = 0; c < k; c++) if (isFinite(v[c])) sd[c] += (v[c] - mean[c]) ** 2;
  for (let c = 0; c < k; c++) sd[c] = Math.sqrt(cnt[c] ? sd[c] / cnt[c] : 0) || 1;
  return { mean, sd };
}
// "Why similar": the 3 closest and 2 furthest features by percentile gap, ranked
// by WEIGHTED gap when a per-feature weight (m.w) is supplied — so a heavily
// weighted metric is more likely to show as a defining factor, and custom
// weights change which rows the panel calls out (still displayed as raw %).
// cols: [{ label, a, b, aPct (0-1), bPct (0-1), w? }]
export function closestFurthest(cols, nClose = 3, nFar = 2) {
  const d = cols.map(m => ({ label: m.label, diff: Math.abs(m.aPct - m.bPct) * (m.w ?? 1), a: m.a, b: m.b,
                              aPct: Math.round(m.aPct * 100), bPct: Math.round(m.bPct * 100) }));
  d.sort((x, y) => x.diff - y.diff);
  return { closest: d.slice(0, nClose), furthest: d.slice(-nFar).reverse() };
}
export const teamKey = (t) => `${t.team}|${normLeague(t.league)}|${t.season}`;

const isCalendar = (s) => /^\d{4}$/.test(String(s));

function vectorOf(t) {
  const out = new Array(K);
  for (let c = 0; c < K; c++) {
    const [group, name] = TEAM_SIM_FEATURES[c];
    const rows = t && t.metricGroups && t.metricGroups[group];
    const row = rows && rows.find(r => r[0] === name);
    const v = row && row[2] != null ? Number(row[2]) : NaN;
    if (!isFinite(v)) return null;
    out[c] = v;
  }
  return out;
}

// Percentile rank (pandas average method) of column c over the given row indices.
function rankPct(rows, idxs, c) {
  const order = idxs.slice().sort((a, b) => rows[a].v[c] - rows[b].v[c]);
  let j = 0;
  while (j < order.length) {
    let e = j;
    while (e + 1 < order.length && rows[order[e + 1]].v[c] === rows[order[j]].v[c]) e++;
    const p = (j + e + 2) / 2 / order.length;
    for (let q = j; q <= e; q++) rows[order[q]].pct[c] = p;
    j = e + 1;
  }
}

// One-off preparation per teams array (percentiles + z-scores for every team-season).
const prepared = new WeakMap();
export function prepareTeamSim(allTeams) {
  if (prepared.has(allTeams)) return prepared.get(allTeams);
  const rows = [];
  for (const t of allTeams) {
    const v = vectorOf(t);
    if (!v) continue;
    // Per-row lookups done once here so a query is just arithmetic.
    rows.push({ t, v, pct: new Float64Array(K), z: new Float64Array(K),
                country: teamCountry(t.league), club: t.team + '|' + teamCountry(t.league),
                norm: normLeague(t.league), season: String(t.season), matches: t.matches || 0,
                ls: leagueStrength(t.league), simLs: simStrength(t.league),
                band: leagueBand(t.league), region: leagueRegion(t.league), reserve: isReserveTeam(t.team) });
  }
  const byLS = new Map(), bySeason = new Map();
  rows.forEach((r, i) => {
    const ls = r.norm + '|' + r.season;
    if (!byLS.has(ls)) byLS.set(ls, []);
    byLS.get(ls).push(i);
    const s = r.season;
    if (!bySeason.has(s)) bySeason.set(s, []);
    bySeason.get(s).push(i);
  });
  for (const idxs of byLS.values()) for (let c = 0; c < K; c++) rankPct(rows, idxs, c);
  for (const idxs of bySeason.values()) {
    const { mean, sd } = columnStats(idxs.map(i => rows[i].v), K);
    for (const i of idxs) for (let c = 0; c < K; c++) rows[i].z[c] = (rows[i].v[c] - mean[c]) / sd[c];
  }
  const index = new Map();
  rows.forEach((r, i) => index.set(teamKey(r.t), i));
  // "Current season" = the newest split-year label and the newest calendar year.
  const seasons = [...bySeason.keys()];
  const split = seasons.filter(s => !isCalendar(s)).sort();
  const cal = seasons.filter(isCalendar).sort();
  const current = new Set([split[split.length - 1], cal[cal.length - 1]].filter(Boolean));
  const out = { rows, index, current, seasons: sortSeasons(seasons) };
  prepared.set(allTeams, out);
  return out;
}

// 2021-22, 2022, 2022-23, 2023, … (by leading year, calendar year after the split season)
export function sortSeasons(list) {
  return [...list].sort((a, b) => {
    const ya = parseInt(a, 10), yb = parseInt(b, 10);
    if (ya !== yb) return ya - yb;
    return isCalendar(a) ? 1 : -1;
  });
}

function whySimilar(a, b, Wc) {
  return closestFurthest(TEAM_SIM_FEATURES.map((f, c) => ({ label: f[3], a: a.v[c], b: b.v[c], aPct: a.pct[c], bPct: b.pct[c], w: Wc[c] })));
}

/**
 * opts: seasons (Set|null), lsMin, lsMax, bands (Set|null), regions (Set|null),
 *       leagues (Set of normLeague|null), minMatches, n, excludeSameClub,
 *       excludeCurrent, onePerClub, weightOverrides ({label: weight 0-3}|null)
 * Returns { results: [{ t, sim, why }], ms, missing } — missing = subject has no full vector.
 */
export function findSimilarTeams(subject, allTeams, opts = {}) {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const P = prepareTeamSim(allTeams);
  const self = P.index.get(teamKey(subject));
  if (self == null) return { results: [], ms: 0, missing: true };
  const {
    seasons = null, lsMin = 0, lsMax = 101, bands = null, regions = null, leagues = null,
    minMatches = 8, n = 10, excludeSameClub = true, excludeCurrent = false, onePerClub = true,
    weightOverrides = null,
  } = opts;
  const Wc = weightOverrides ? weightVector(weightOverrides) : W;
  const S = P.rows[self];
  const lsSelf = S.simLs;
  const useBands = bands && bands.size, useRegions = regions && regions.size, useLeagues = leagues && leagues.size;
  const scored = [];
  for (let i = 0; i < P.rows.length; i++) {
    if (i === self) continue;
    const r = P.rows[i];
    if (excludeSameClub && r.club === S.club) continue;
    if (!S.reserve && r.reserve) continue;
    if (seasons && !seasons.has(r.season)) continue;
    if (excludeCurrent && P.current.has(r.season)) continue;
    if (r.matches < minMatches) continue;
    if (r.ls < lsMin || r.ls > lsMax) continue;
    if (useBands && !bands.has(r.band)) continue;
    if (useRegions && !regions.has(r.region)) continue;
    if (useLeagues && !leagues.has(r.norm)) continue;
    let pd = 0, ad = 0;
    for (let c = 0; c < K; c++) {
      pd += Math.abs(r.pct[c] - S.pct[c]) * Wc[c];
      ad += Math.abs(r.z[c] - S.z[c]) * Wc[c];
    }
    scored.push({ i, sim: blendSimilarity(pd, ad, r.simLs, lsSelf) });
  }
  scored.sort((a, b) => b.sim - a.sim);
  const results = [];
  const seenClub = new Set();
  for (const s of scored) {
    if (results.length >= n) break;
    const t = P.rows[s.i].t;
    if (onePerClub) {
      const ck = P.rows[s.i].club;
      if (seenClub.has(ck)) continue;
      seenClub.add(ck);
    }
    results.push({ t, sim: Math.round(s.sim * 10) / 10, why: whySimilar(S, P.rows[s.i], Wc) });
  }
  const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
  return { results, ms, missing: false, poolSize: scored.length };
}
