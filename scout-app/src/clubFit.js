// clubFit.js — client-side port of ScoutBoard Pro's /api/club_fit.
//
// Ranks current-season clubs by how well a player fits them. The model is a
// faithful port of the Flask/pandas implementation so both apps give the same
// answer; every constant below is copied from server.py rather than re-derived.
//
// WHY A PORT AND NOT AN API CALL
// The Scout App is static on Vercel and reads players_final.json / teams_final.json.
// Calling Railway at render time would make the Player Pager fail to draw whenever
// that app is down, and add a CORS dependency. The trade-off is that tuning now has
// to happen in two places — see CALIBRATION NOTE at the bottom.
//
// KEY SIMPLIFICATION vs the Python
// server.py recomputes within-league percentiles with pandas groupby().rank(pct=True).
// The pipeline has already done exactly that: every season row's `g` groups store
// [label, percentile, rawValue]. So the percentile half of the distance reads
// straight off the data instead of being recalculated, which is both faster and
// guaranteed consistent with what the cards display.
//
// NOT PORTED
// The target_leagues / get_club_band scoping mode. It is built on ScoutBoard board
// concepts (Target Move, Europe Bands) that don't exist in the Scout App. UK-only
// and unscoped both port cleanly and are what the Player Pager uses.

import { LEAGUE_STRENGTHS } from './constants';

// ─── Feature sets and weights (verbatim from server.py) ────────────────────
const GK_SIM_FEATURES = [
  'Passes per 90', 'Accurate passes, %', 'Long passes per 90',
  'Accurate long passes, %', 'Conceded goals per 90', 'Shots against per 90',
  'Save rate, %', 'xG against per 90', 'Prevented goals per 90', 'Exits per 90',
];
const GK_SIM_WEIGHTS = {
  'Prevented goals per 90': 3, 'Save rate, %': 2, 'xG against per 90': 2,
  'Conceded goals per 90': 2, 'Exits per 90': 2, 'Accurate passes, %': 2,
  'Accurate long passes, %': 2, 'Passes per 90': 1, 'Long passes per 90': 1,
  'Shots against per 90': 1,
};

const SIM_FEATURES = [
  'Defensive duels per 90', 'Defensive duels won, %',
  'Aerial duels per 90', 'Aerial duels won, %', 'Shots blocked per 90',
  'PAdj Interceptions', 'Dribbles per 90', 'Successful dribbles, %',
  'Progressive runs per 90', 'Accelerations per 90', 'Passes per 90',
  'Accurate passes, %', 'Forward passes per 90', 'Accurate forward passes, %',
  'Long passes per 90', 'Accurate long passes, %',
  'Passes to final third per 90', 'Accurate passes to final third, %',
  'Progressive passes per 90', 'Accurate progressive passes, %',
];
const SIM_WEIGHTS = {
  'Passes per 90': 2, 'Accurate passes, %': 2, 'Progressive passes per 90': 2,
  'Defensive duels per 90': 2, 'Defensive duels won, %': 2,
  'Dribbles per 90': 2, 'PAdj Interceptions': 1,
  'Progressive runs per 90': 2, 'Aerial duels per 90': 2, 'Aerial duels won, %': 3,
};

const FB_SIM_FEATURES = [
  'Defensive duels per 90', 'Defensive duels won, %',
  'Aerial duels per 90', 'Aerial duels won, %', 'Shots blocked per 90',
  'PAdj Interceptions', 'Dribbles per 90', 'Successful dribbles, %',
  'Progressive runs per 90', 'Accelerations per 90', 'Passes per 90',
  'Accurate passes, %', 'Forward passes per 90', 'Accurate forward passes, %',
  'Passes to final third per 90', 'Accurate passes to final third, %',
  'Progressive passes per 90', 'Accurate progressive passes, %',
  'Crosses per 90', 'Accurate crosses, %',
  'Passes to penalty area per 90', 'xA per 90', 'Touches in box per 90',
];
const FB_SIM_WEIGHTS = {
  'xA per 90': 3, 'Crosses per 90': 2, 'Dribbles per 90': 2,
  'Progressive runs per 90': 2, 'Defensive duels won, %': 2,
  'PAdj Interceptions': 2, 'Passes per 90': 1, 'Passes to penalty area per 90': 2,
};

const CM_SIM_FEATURES = [
  'Defensive duels per 90', 'Defensive duels won, %', 'Aerial duels per 90',
  'Aerial duels won, %', 'Shots blocked per 90', 'PAdj Interceptions',
  'Non-penalty goals per 90', 'xG per 90', 'Shots per 90', 'Shots on target, %',
  'Dribbles per 90', 'Successful dribbles, %', 'Offensive duels per 90',
  'Offensive duels won, %', 'Touches in box per 90', 'Progressive runs per 90',
  'Accelerations per 90', 'Passes per 90', 'Accurate passes, %',
  'Forward passes per 90', 'Accurate forward passes, %', 'Long passes per 90',
  'Accurate long passes, %', 'xA per 90', 'Smart passes per 90',
  'Key passes per 90', 'Passes to final third per 90',
  'Accurate passes to final third, %', 'Passes to penalty area per 90',
  'Accurate passes to penalty area, %', 'Deep completions per 90',
  'Progressive passes per 90',
];
const CM_SIM_WEIGHTS = Object.fromEntries(CM_SIM_FEATURES.map(f => [f, 1]));
Object.assign(CM_SIM_WEIGHTS, {
  'Passes per 90': 2, 'Progressive runs per 90': 2, 'Progressive passes per 90': 2,
  'Dribbles per 90': 2, 'xA per 90': 2, 'Touches in box per 90': 2,
  'Accurate passes, %': 2, 'Aerial duels won, %': 2,
  'Passes to penalty area per 90': 2, 'Defensive duels per 90': 2,
});

const ATT_SIM_FEATURES = [
  'Defensive duels per 90', 'Aerial duels per 90', 'Aerial duels won, %', 'PAdj Interceptions',
  'xG per 90', 'Non-penalty goals per 90', 'Shots per 90', 'Crosses per 90', 'Accurate crosses, %',
  'Dribbles per 90', 'Successful dribbles, %', 'Touches in box per 90', 'Progressive runs per 90',
  'Accelerations per 90', 'Passes per 90', 'Accurate passes, %', 'xA per 90', 'Smart passes per 90',
  'Key passes per 90', 'Passes to final third per 90', 'Accurate passes to final third, %',
  'Passes to penalty area per 90', 'Accurate passes to penalty area, %', 'Deep completions per 90',
  'Progressive passes per 90',
];
const ATT_SIM_WEIGHTS = Object.fromEntries(ATT_SIM_FEATURES.map(f => [f, 1]));
Object.assign(ATT_SIM_WEIGHTS, {
  'Passes per 90': 3, 'Accurate passes, %': 2, 'Dribbles per 90': 3,
  'Non-penalty goals per 90': 2, 'Shots per 90': 2, 'Successful dribbles, %': 2,
  'Aerial duels won, %': 2, 'xA per 90': 2, 'xG per 90': 2,
  'Touches in box per 90': 2, 'Passes to penalty area per 90': 2,
  'Passes to final third per 90': 2, 'Crosses per 90': 2,
});

const ST_SIM_FEATURES = [
  'Defensive duels per 90', 'Aerial duels per 90', 'Aerial duels won, %',
  'Non-penalty goals per 90', 'xG per 90', 'Shots per 90',
  'Crosses per 90', 'Dribbles per 90', 'Successful dribbles, %',
  'Touches in box per 90', 'Progressive runs per 90',
  'Passes per 90', 'Accurate passes, %', 'xA per 90', 'Smart passes per 90',
  'Passes to penalty area per 90', 'Deep completions per 90',
];
const ST_SIM_WEIGHTS = Object.fromEntries(ST_SIM_FEATURES.map(f => [f, 1]));
Object.assign(ST_SIM_WEIGHTS, {
  'Passes per 90': 2, 'Dribbles per 90': 2,
  'Non-penalty goals per 90': 2, 'Aerial duels per 90': 2,
  'Aerial duels won, %': 2, 'xA per 90': 2,
  'xG per 90': 2, 'Touches in box per 90': 2,
});

// CSV column -> the abbreviated label the pipeline stores in each season's `g` groups.
const CAREER_LABEL_MAP = {
  'Defensive duels per 90': 'Defensive Duels', 'Defensive duels won, %': 'Defensive Duel %',
  'Aerial duels per 90': 'Aerial Duels', 'Aerial duels won, %': 'Aerial Duel %',
  'Shots blocked per 90': 'Shots Blocked', 'PAdj Interceptions': 'PAdj Interceptions',
  'Dribbles per 90': 'Dribbles', 'Successful dribbles, %': 'Dribble %',
  'Progressive runs per 90': 'Progressive Runs', 'Accelerations per 90': 'Accelerations',
  'Passes per 90': 'Passes', 'Accurate passes, %': 'Pass %',
  'Forward passes per 90': 'Forward Passes', 'Accurate forward passes, %': 'Forward Pass %',
  'Long passes per 90': 'Long Passes', 'Accurate long passes, %': 'Long Pass %',
  'Passes to final third per 90': 'Passes to F3rd', 'Accurate passes to final third, %': 'Passes to F3rd %',
  'Progressive passes per 90': 'Progressive Passes', 'Accurate progressive passes, %': 'Prog Pass %',
};

// Same transform server.py falls back to for features outside the verified table:
// strip "per 90", drop Accurate/Successful prefixes, ", %" -> " %".
function careerLabel(feat) {
  if (CAREER_LABEL_MAP[feat]) return CAREER_LABEL_MAP[feat];
  return String(feat)
    .replace(' per 90', '')
    .replace('Accurate ', '')
    .replace('Successful ', '')
    .replace(', %', ' %')
    .trim();
}

// Career score -> equivalent point on the LEAGUE_STRENGTHS scale. These are NOT the
// same scale: a career score of 70 means "T5L-adjacent", which is ~83 in league
// strength, not 70. Comparing the raw numbers would misjudge a player's level.
const SCORE_TO_LS_ANCHORS = [[45, 50], [55, 62], [60, 75], [70, 83], [80, 100]];
export function scoreToLeagueStrength(score) {
  const A = SCORE_TO_LS_ANCHORS;
  if (score <= A[0][0]) return A[0][1];
  if (score >= A[A.length - 1][0]) return A[A.length - 1][1];
  for (let i = 0; i < A.length - 1; i++) {
    const [s0, ls0] = A[i], [s1, ls1] = A[i + 1];
    if (score >= s0 && score <= s1) return ls0 + ((score - s0) / (s1 - s0)) * (ls1 - ls0);
  }
  return 50.0;
}

const UK_LEAGUES_CF = new Set(['England 1.', 'England 2.', 'England 3.', 'Scotland 1.']);

// Position-group detection — same token rules as /api/similar and /api/club_fit.
export function simGroup(csvPos) {
  const s = String(csvPos || '').trim().toUpperCase();
  const toks = s.split(/[,/;]\s*|\s+/).filter(Boolean);
  const t = toks[0] || '';
  if (t.startsWith('GK')) return 'GK';
  if (t.startsWith('CF')) return 'ST';
  if (['CB', 'LCB', 'RCB'].includes(t)) return 'CB';
  if (['RB', 'LB', 'RWB', 'LWB'].includes(t)) return 'FB';
  if (['DMF', 'CMF', 'LCMF', 'RCMF', 'LDMF', 'RDMF'].includes(t)) return 'CM';
  if (['RW', 'RWF', 'LW', 'LWF', 'AMF', 'RAMF', 'LAMF'].includes(t)) return 'ATT';
  return '';
}

function featuresFor(group) {
  switch (group) {
    case 'GK': return [GK_SIM_FEATURES, GK_SIM_WEIGHTS];
    case 'CM': return [CM_SIM_FEATURES, CM_SIM_WEIGHTS];
    case 'ATT': return [ATT_SIM_FEATURES, ATT_SIM_WEIGHTS];
    case 'ST': return [ST_SIM_FEATURES, ST_SIM_WEIGHTS];
    case 'FB': return [FB_SIM_FEATURES, FB_SIM_WEIGHTS];
    default: return [SIM_FEATURES, SIM_WEIGHTS];  // CB
  }
}

const normLeague = (l) => String(l || '').trim().replace(/\.$/, '').toLowerCase();
const normTeam = (t) => String(t || '').trim().toLowerCase();

// Pull {label: [pct, raw]} out of a season's bar-chart groups.
function metricsFromSeason(sd) {
  const out = {};
  if (!sd || !sd.g) return out;
  for (const grp of ['A', 'D', 'P']) {
    for (const entry of (sd.g[grp] || [])) {
      if (Array.isArray(entry) && entry.length >= 3) out[entry[0]] = [entry[1], entry[2]];
    }
  }
  return out;
}

function seasonsOf(p) {
  return (p && p.seasonsDetailAll ? p.seasonsDetailAll : []).filter(s => s && s.score != null);
}
function peakSeason(p) {
  const ss = seasonsOf(p);
  if (!ss.length) return null;
  return ss.reduce((a, b) => (b.score > a.score ? b : a));
}
function latestSeason(p) {
  const ss = seasonsOf(p);
  if (!ss.length) return null;
  return ss.reduce((a, b) => (String(b.season) > String(a.season) ? b : a));
}

/**
 * Rank clubs by fit for a player.
 *
 * @param {Object} player   the target, from players_final.json
 * @param {Array}  pool     candidate players. Club Fit compares a striker against
 *                          strikers, so this is the same position chunk already
 *                          loaded for the player being viewed — no extra fetch.
 * @param {Object} opts     { ukOnly, topN, minMinutes, peakFitByTeam }
 *                          peakFitByTeam: optional { normalisedTeamName: similarity }
 *                          from teams_final.json; supplies the 20% career-peak weight.
 * @returns {Array} [{ team, league, finalFit, simPct, avgMV, numPlayers }]
 */
export function computeClubFit(player, pool, opts = {}) {
  const { ukOnly = false, topN = 5, peakFitByTeam = null } = opts;
  if (!player || !Array.isArray(pool) || !pool.length) return [];

  const group = simGroup(player.position || player.roleKey || '');
  const [featList, featWeights] = featuresFor(group);

  // Side-aware for full backs: a right back is compared against right backs.
  let fbSide = null;
  if (group === 'FB') {
    const t0 = String(player.position || '').trim().toUpperCase().split(/[,/;]\s*|\s+/)[0];
    if (t0 === 'RB' || t0 === 'RWB') fbSide = 'R';
    else if (t0 === 'LB' || t0 === 'LWB') fbSide = 'L';
  }

  const tgtLeague = player.league || '';
  const tgtLs = Math.max(Number(LEAGUE_STRENGTHS[tgtLeague]) || 1.0, 1e-6);

  // Target vector comes from the player's PEAK season, not their current one. A
  // player having a poor, ill-fitting season now but a strong one last year should
  // be matched on the strong one — that's the honest signal of what they are.
  const tgtPeak = peakSeason(player);
  const tgtMetrics = metricsFromSeason(tgtPeak || latestSeason(player));
  const latestScore = latestSeason(player) ? latestSeason(player).score : null;

  // Only keep features the target actually has, so a missing metric can't be read
  // as a distance of zero.
  const avail = featList.filter(f => tgtMetrics[careerLabel(f)] != null);
  if (avail.length < 5) return [];
  const labels = avail.map(careerLabel);
  const weights = avail.map(f => Number(featWeights[f] || 1));

  const tgtPct = labels.map(l => (Number(tgtMetrics[l][0]) || 50) / 100);
  const tgtRaw = labels.map(l => Number(tgtMetrics[l][1]) || 0);

  // ── Candidate pool ──────────────────────────────────────────────────────
  const ownTeam = normTeam(player.team);
  const cands = [];
  for (const c of pool) {
    if (!c || c.id === player.id) continue;
    if (normTeam(c.team) === ownTeam) continue;             // exclude the player's own club
    if (String(c.name).toLowerCase() === String(player.name).toLowerCase()) continue;
    if (simGroup(c.position || c.roleKey || '') !== group) continue;
    if (fbSide) {
      const t0 = String(c.position || '').trim().toUpperCase().split(/[,/;]\s*|\s+/)[0];
      const side = (t0 === 'RB' || t0 === 'RWB') ? 'R' : (t0 === 'LB' || t0 === 'LWB') ? 'L' : null;
      if (side !== fbSide) continue;
    }
    if (ukOnly && !UK_LEAGUES_CF.has(String(c.league).trim())) continue;

    const sd = latestSeason(c);
    if (!sd) continue;
    const m = metricsFromSeason(sd);
    const pct = [], raw = [];
    let ok = true;
    for (const l of labels) {
      if (m[l] == null) { ok = false; break; }
      pct.push((Number(m[l][0]) || 50) / 100);
      raw.push(Number(m[l][1]) || 0);
    }
    if (!ok) continue;
    cands.push({ p: c, pct, raw, ls: Math.max(Number(LEAGUE_STRENGTHS[c.league]) || 1.0, 1e-6) });
  }
  if (!cands.length) return [];

  // ── Distance: 70% within-league percentile + 30% z-scored raw ───────────
  const n = labels.length;
  const means = new Array(n).fill(0), stds = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const c of cands) s += c.raw[i];
    means[i] = s / cands.length;
    let v = 0;
    for (const c of cands) v += (c.raw[i] - means[i]) ** 2;
    stds[i] = Math.sqrt(v / cands.length) || 1.0;
  }
  const tgtStd = tgtRaw.map((v, i) => (v - means[i]) / stds[i]);

  const combined = cands.map(c => {
    let dp = 0, dv = 0;
    for (let i = 0; i < n; i++) {
      dp += (c.pct[i] - tgtPct[i]) ** 2 * weights[i];
      dv += (((c.raw[i] - means[i]) / stds[i]) - tgtStd[i]) ** 2 * weights[i];
    }
    return Math.sqrt(dp) * 0.7 + Math.sqrt(dv) * 0.3;
  });
  const cMin = Math.min(...combined), cMax = Math.max(...combined);
  const rng = (cMax - cMin) || 1.0;

  cands.forEach((c, i) => {
    const rawSim = (1 - (combined[i] - cMin) / rng) * 100;
    const ratio = Math.min(c.ls / tgtLs, tgtLs / c.ls);
    c.adjSim = rawSim * (0.8 + 0.2 * ratio);
  });

  // ── Aggregate by club ───────────────────────────────────────────────────
  const byTeam = {};
  for (const c of cands) {
    const k = c.p.team;
    if (!byTeam[k]) byTeam[k] = { team: k, league: c.p.league, sims: [], mvs: [] };
    byTeam[k].sims.push(c.adjSim);
    if (c.p.marketValue > 0) byTeam[k].mvs.push(c.p.marketValue);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

  // A club's score is an average over however many qualifying players it put in the
  // pool. For most clubs that is a small number, so one player who happens to rank
  // closely by chance can produce a misleadingly high "club" score that isn't
  // squad-wide similarity at all. GK/ST/ATT are exempt at 1 — a club having one
  // qualifying keeper is normal, not a small sample.
  const minCandidates = (group === 'GK' || group === 'ST' || group === 'ATT') ? 1 : 2;

  let clubs = Object.values(byTeam)
    .filter(t => t.sims.length >= minCandidates)
    .map(t => ({
      team: t.team,
      league: t.league,
      simPct: mean(t.sims),
      avgMV: t.mvs.length ? mean(t.mvs) : null,
      numPlayers: t.sims.length,
      leagueLs: Number(LEAGUE_STRENGTHS[t.league]) || 50.0,
    }));
  if (!clubs.length) return [];

  const mvAll = clubs.filter(c => c.avgMV != null).map(c => c.avgMV).sort((a, b) => a - b);
  const mvMedian = mvAll.length ? mvAll[Math.floor(mvAll.length / 2)] : 2000000;
  clubs.forEach(c => { if (c.avgMV == null) c.avgMV = mvMedian; });

  // ── Hard league floor ───────────────────────────────────────────────────
  // Downward-only: a candidate can't be much weaker than where the player already
  // plays, but there's no ceiling — moving up to a stronger league is never a drop.
  const tgtLsNominal = Number(LEAGUE_STRENGTHS[tgtLeague]) || 50.0;
  const tgtLsFromScore = latestScore != null ? scoreToLeagueStrength(Number(latestScore)) : 0;
  const tgtLsForFilter = Math.max(tgtLsNominal, tgtLsFromScore);
  clubs = clubs.filter(c => c.leagueLs >= tgtLsForFilter * 0.85);
  if (!clubs.length) return [];

  // Soft tapering within the survivors, plus an upward-gap penalty so a huge jump
  // still ranks below a same-level move even though it isn't excluded.
  const LEAGUE_WEIGHT = 0.5;
  clubs.forEach(c => {
    const ratio = Math.min(Math.max(c.leagueLs / Math.max(tgtLsForFilter, 1e-6), 0.5), 1.2);
    c.simPct = c.simPct * (1 - LEAGUE_WEIGHT) + c.simPct * ratio * LEAGUE_WEIGHT;
    const gap = Math.max(c.leagueLs - tgtLsForFilter, 0);
    c.simPct = c.simPct * Math.max(1 - gap / 100, 0.7);
  });

  // ── Market value fit (25%) ──────────────────────────────────────────────
  const tgtMv = Math.max(Number(player.marketValue) || 2000000, 1.0);
  const MARKET_WEIGHT = 0.25;
  clubs.forEach(c => {
    const r = Math.min(Math.max(c.avgMV / tgtMv, 0.5), 1.5);
    const mvScore = (1 - Math.abs(1 - r)) * 100;
    c.core = c.simPct * (1 - MARKET_WEIGHT) + mvScore * MARKET_WEIGHT;
  });

  // ── Level ruler (10%) ───────────────────────────────────────────────────
  // Nudges toward clubs matching where the player is performing right now.
  // Deliberately light — the core similarity, league floor and value fit already
  // do the real work.
  const LEVEL_BLEND_WEIGHT = 0.10;
  if (latestScore != null) {
    const ls = Math.max(scoreToLeagueStrength(Number(latestScore)), 1.0);
    clubs.forEach(c => {
      const r = Math.min(Math.max(c.leagueLs / ls, 0.5), 1.5);
      c.core = c.core * (1 - LEVEL_BLEND_WEIGHT) + ((1 - Math.abs(1 - r)) * 100) * LEVEL_BLEND_WEIGHT;
    });
  }

  // ── Career-peak team fit (20%) ──────────────────────────────────────────
  if (peakFitByTeam && Object.keys(peakFitByTeam).length) {
    clubs.forEach(c => {
      const pf = peakFitByTeam[normTeam(c.team)];
      c.finalFit = Math.round((c.core * 0.8 + (pf == null ? 50.0 : pf) * 0.2) * 10) / 10;
    });
  } else {
    clubs.forEach(c => { c.finalFit = Math.round(c.core * 10) / 10; });
  }

  return clubs
    .sort((a, b) => b.finalFit - a.finalFit)
    .slice(0, topN)
    .map(c => ({
      team: c.team,
      league: c.league,
      finalFit: c.finalFit,
      simPct: Math.round(c.simPct * 10) / 10,
      avgMV: Math.round(c.avgMV),
      numPlayers: c.numPlayers,
    }));
}

// ─── CALIBRATION NOTE ──────────────────────────────────────────────────────
// Two things are expected to differ slightly from the Flask version, and both are
// worth knowing before treating a mismatch as a bug:
//
// 1. POOL. server.py ranks against the full Wyscout CSV (every European league,
//    500+ minutes). This ranks against whatever is in players_final.json for the
//    position group. Different pool -> slightly different z-score means/stds and a
//    different min/max for the similarity normalisation, so absolute numbers can
//    move even where the ordering doesn't.
//
// 2. PEAK FIT. The 20% career-peak weight needs find_similar_teams over
//    teams_final.json. Pass it in via opts.peakFitByTeam; with nothing passed the
//    score is the core alone (server.py behaves the same way when it can't resolve
//    a peak season), which will read a few points higher than the blended version.
//
// Ordering should match. If it doesn't, compare a single player side by side
// against ScoutBoard before changing any constant here.
