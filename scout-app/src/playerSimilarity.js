// playerSimilarity.js — engine for the Similar Players calculator (PlayerSimilarCalc.js)
// on the player profile. The player-level counterpart of teamSimilarity.js; it uses that
// module's shared pieces (blendSimilarity, columnStats, closestFurthest, league strength /
// band / region, sortSeasons) rather than copies.
//
// FEATURES + WEIGHTS: ScoutBoard Pro's per-role *_SIM_FEATURES / weights (server.py
// /api/similar) — the same tables the profile's quick "Similar Players — Global / UK"
// panel already used (moved here from PlayerCard.js so both read one copy). Unlisted
// features weigh 1; weights are normalised to sum 1 (as teamSimilarity does).
//
// METHOD (same as Similar Teams):
//   - percentile: the pipeline's stored percentile on each season row (within its own
//     league-season and position pool — what the cards show);
//   - z-score: raw per-90 / % value standardised within each season label and position
//     group (population sd), over every season row in the data;
//   - weighted L1 distance on each; similarity = 50·exp(-2.8·pctDist) + 50·exp(-0.6·zDist);
//   - league-strength discount, floor 0.8 (SIM_LEAGUE_FLOOR).
// Optional STYLE ROLES: the season row's hexagon scores (qcRoles, 0-100) as extra
// features sharing ROLE_SHARE of the total weight (percentile half = score/100).
import { posToRk, hasMetrics } from './constants';
import { blendSimilarity, columnStats, closestFurthest, leagueStrength, leagueBand, leagueRegion,
         normLeague, sortSeasons, simStrength } from './teamSimilarity';

export const SIM_FEATURES = {
  GK:['Passes per 90','Accurate passes, %','Long passes per 90','Accurate long passes, %','Conceded goals per 90','Shots against per 90','Save rate, %','xG against per 90','Prevented goals per 90','Exits per 90'],
  CB:['Defensive duels per 90','Defensive duels won, %','Aerial duels per 90','Aerial duels won, %','Shots blocked per 90','PAdj Interceptions','Dribbles per 90','Successful dribbles, %','Progressive runs per 90','Accelerations per 90','Passes per 90','Accurate passes, %','Forward passes per 90','Accurate forward passes, %','Long passes per 90','Accurate long passes, %','Passes to final third per 90','Accurate passes to final third, %','Progressive passes per 90'],
  FB:['Defensive duels per 90','Defensive duels won, %','Aerial duels per 90','Aerial duels won, %','Shots blocked per 90','PAdj Interceptions','Dribbles per 90','Successful dribbles, %','Progressive runs per 90','Accelerations per 90','Passes per 90','Accurate passes, %','Forward passes per 90','Accurate forward passes, %','Passes to final third per 90','Accurate passes to final third, %','Progressive passes per 90','Crosses per 90','Accurate crosses, %','Passes to penalty area per 90','xA per 90','Touches in box per 90'],
  CM:['Defensive duels per 90','Defensive duels won, %','Aerial duels per 90','Aerial duels won, %','Shots blocked per 90','PAdj Interceptions','Non-penalty goals per 90','xG per 90','Shots per 90','Dribbles per 90','Successful dribbles, %','Offensive duels per 90','Offensive duels won, %','Touches in box per 90','Progressive runs per 90','Passes per 90','Accurate passes, %','Forward passes per 90','Accurate forward passes, %','Long passes per 90','Accurate long passes, %','xA per 90','Smart passes per 90','Key passes per 90','Passes to final third per 90','Accurate passes to final third, %','Passes to penalty area per 90','Accurate passes to penalty area, %','Deep completions per 90','Progressive passes per 90'],
  ATT:['Defensive duels per 90','Aerial duels per 90','Aerial duels won, %','PAdj Interceptions','xG per 90','Non-penalty goals per 90','Shots per 90','Crosses per 90','Accurate crosses, %','Dribbles per 90','Successful dribbles, %','Touches in box per 90','Progressive runs per 90','Accelerations per 90','Passes per 90','Accurate passes, %','xA per 90','Smart passes per 90','Key passes per 90','Passes to final third per 90','Accurate passes to final third, %','Passes to penalty area per 90','Accurate passes to penalty area, %','Deep completions per 90','Progressive passes per 90'],
  CF:['Defensive duels per 90','Aerial duels per 90','Aerial duels won, %','Non-penalty goals per 90','xG per 90','Shots per 90','Crosses per 90','Dribbles per 90','Successful dribbles, %','Touches in box per 90','Progressive runs per 90','Passes per 90','Accurate passes, %','xA per 90','Smart passes per 90','Passes to penalty area per 90','Deep completions per 90'],
};
export const SIM_WEIGHTS = {
  GK:{'Prevented goals per 90':3,'Save rate, %':2,'xG against per 90':2,'Conceded goals per 90':2,'Exits per 90':2,'Accurate passes, %':2,'Accurate long passes, %':2},
  CB:{'Passes per 90':2,'Accurate passes, %':2,'Progressive passes per 90':2,'Defensive duels per 90':2,'Defensive duels won, %':2,'Dribbles per 90':2,'PAdj Interceptions':1,'Progressive runs per 90':2,'Aerial duels per 90':2,'Aerial duels won, %':3},
  FB:{'xA per 90':3,'Crosses per 90':2,'Dribbles per 90':2,'Progressive runs per 90':2,'Defensive duels won, %':2,'PAdj Interceptions':2,'Passes per 90':1,'Passes to penalty area per 90':2},
  CM:{'Passes per 90':2,'Progressive runs per 90':2,'Progressive passes per 90':2,'Dribbles per 90':2,'xA per 90':2,'Touches in box per 90':2,'Accurate passes, %':2,'Aerial duels won, %':2,'Passes to penalty area per 90':2,'Defensive duels per 90':2},
  ATT:{'Passes per 90':3,'Accurate passes, %':2,'Dribbles per 90':3,'Non-penalty goals per 90':2,'Shots per 90':2,'Successful dribbles, %':2,'Aerial duels won, %':2,'xA per 90':2,'xG per 90':2,'Touches in box per 90':2,'Passes to penalty area per 90':2,'Passes to final third per 90':2,'Crosses per 90':2},
  CF:{'Passes per 90':2,'Dribbles per 90':2,'Non-penalty goals per 90':2,'Aerial duels per 90':2,'Aerial duels won, %':2,'xA per 90':2,'xG per 90':2,'Touches in box per 90':2},
};
export const METRIC_TO_LABEL = {
  GK:{'Exits per 90':'Exits','Prevented goals per 90':'Goals Prevented','Conceded goals per 90':'Goals Conceded','Save rate, %':'Save Rate','Shots against per 90':'Shots Against','xG against per 90':'xG Against','Long passes per 90':'Long Passes','Accurate long passes, %':'Long Pass %','Passes per 90':'Passes','Accurate passes, %':'Pass %'},
  CB:{'Non-penalty goals per 90':'Goals: Non-Penalty','xG per 90':'xG','Offensive duels per 90':'Offensive Duels','Offensive duels won, %':'Offensive Duel %','Progressive runs per 90':'Progressive Runs','Aerial duels per 90':'Aerial Duels','Aerial duels won, %':'Aerial Duel %','Defensive duels per 90':'Defensive Duels','Defensive duels won, %':'Defensive Duel %','PAdj Interceptions':'PAdj Interceptions','Shots blocked per 90':'Shots Blocked','Accelerations per 90':'Accelerations','Dribbles per 90':'Dribbles','Successful dribbles, %':'Dribble %','Forward passes per 90':'Forward Passes','Accurate forward passes, %':'Forward Pass %','Long passes per 90':'Long Passes','Accurate long passes, %':'Long Pass %','Passes per 90':'Passes','Accurate passes, %':'Pass %','Passes to final third per 90':'Passes to F3rd','Accurate passes to final third, %':'Passes to F3rd %','Progressive passes per 90':'Progressive Passes'},
  FB:{'Crosses per 90':'Crosses','Accurate crosses, %':'Cross %','Non-penalty goals per 90':'Goals: Non-Penalty','xG per 90':'xG','xA per 90':'xA','Offensive duels per 90':'Offensive Duels','Offensive duels won, %':'Offensive Duel %','Progressive runs per 90':'Progressive Runs','Touches in box per 90':'Touches in Box','Aerial duels per 90':'Aerial Duels','Aerial duels won, %':'Aerial Duel %','Defensive duels per 90':'Defensive Duels','Defensive duels won, %':'Defensive Duel %','Shots blocked per 90':'Shots Blocked','PAdj Interceptions':'PAdj Interceptions','Accelerations per 90':'Accelerations','Dribbles per 90':'Dribbles','Successful dribbles, %':'Dribble %','Forward passes per 90':'Forward Passes','Accurate forward passes, %':'Forward Pass %','Passes per 90':'Passes','Accurate passes, %':'Pass %','Passes to final third per 90':'Passes to F3rd','Accurate passes to final third, %':'Passes to F3rd %','Passes to penalty area per 90':'Passes to Box','Progressive passes per 90':'Progressive Passes'},
  CM:{'Crosses per 90':'Crosses','Deep completions per 90':'Deep Completions','Non-penalty goals per 90':'Goals: Non-Penalty','xG per 90':'xG','xA per 90':'xA','Offensive duels per 90':'Offensive Duels','Offensive duels won, %':'Offensive Duel %','Progressive runs per 90':'Progressive Runs','Shots per 90':'Shots','Touches in box per 90':'Touches in Box','Aerial duels per 90':'Aerial Duels','Aerial duels won, %':'Aerial Duel %','Defensive duels per 90':'Defensive Duels','Defensive duels won, %':'Defensive Duel %','Shots blocked per 90':'Shots Blocked','PAdj Interceptions':'PAdj Interceptions','Dribbles per 90':'Dribbles','Successful dribbles, %':'Dribble %','Forward passes per 90':'Forward Passes','Accurate forward passes, %':'Forward Pass %','Key passes per 90':'Key Passes','Long passes per 90':'Long Passes','Accurate long passes, %':'Long Pass %','Passes per 90':'Passes','Accurate passes, %':'Pass %','Passes to final third per 90':'Passes to F3rd','Accurate passes to final third, %':'Passes to F3rd %','Passes to penalty area per 90':'Passes to Box','Accurate passes to penalty area, %':'Passes to Box %','Progressive passes per 90':'Progressive Passes','Smart passes per 90':'Smart Passes'},
  ATT:{'Crosses per 90':'Crosses','Accurate crosses, %':'Cross %','Non-penalty goals per 90':'Goals: Non-Penalty','xG per 90':'xG','xA per 90':'xA','Progressive runs per 90':'Progressive Runs','Shots per 90':'Shots','Touches in box per 90':'Touches in Box','Aerial duels per 90':'Aerial Duels','Aerial duels won, %':'Aerial Duel %','Defensive duels per 90':'Defensive Duels','PAdj Interceptions':'PAdj Interceptions','Accelerations per 90':'Accelerations','Dribbles per 90':'Dribbles','Successful dribbles, %':'Dribble %','Key passes per 90':'Key Passes','Passes per 90':'Passes','Accurate passes, %':'Pass %','Passes to final third per 90':'Passes to F3rd','Accurate passes to final third, %':'Passes to F3rd %','Passes to penalty area per 90':'Passes to Box','Accurate passes to penalty area, %':'Passes to Box %','Progressive passes per 90':'Progressive Passes','Smart passes per 90':'Smart Passes','Deep completions per 90':'Deep Completions'},
  CF:{'Crosses per 90':'Crosses','Non-penalty goals per 90':'Goals: Non-Penalty','xG per 90':'xG','xA per 90':'xA','Progressive runs per 90':'Progressive Runs','Shots per 90':'Shots','Touches in box per 90':'Touches in Box','Aerial duels per 90':'Aerial Duels','Aerial duels won, %':'Aerial Duel %','Defensive duels per 90':'Defensive Duels','PAdj Interceptions':'PAdj Interceptions','Dribbles per 90':'Dribbles','Successful dribbles, %':'Dribble %','Passes per 90':'Passes','Accurate passes, %':'Pass %','Passes to penalty area per 90':'Passes to Box','Smart passes per 90':'Smart Passes','Deep completions per 90':'Deep Completions'},
};

export const SIM_GROUPS = ['GK', 'CB', 'FB', 'CM', 'ATT', 'CF'];
export const ROLE_SHARE = 0.25;
// [data label, weight] per group, in server.py order.
export function groupFeatures(rk) {
  const feats = SIM_FEATURES[rk] || [], w = SIM_WEIGHTS[rk] || {}, lab = METRIC_TO_LABEL[rk] || {};
  return feats.map(f => [lab[f] || f, w[f] || 1]);
}

const isCalendar = s => /^\d{4}$/.test(String(s));
const rowGroup = (p, sd) => posToRk(sd.position) || posToRk(p.position) || p.roleKey || '';
// [label, pct, raw] rows of a season's bar-chart groups -> { label: [pct 0-1, raw] }
function metricsOf(sd) {
  const out = {};
  for (const k of ['A', 'D', 'P']) for (const e of ((sd.g && sd.g[k]) || [])) {
    if (!Array.isArray(e) || e.length < 3) continue;
    const pct = Number(e[1]), raw = Number(e[2]);
    if (isFinite(pct) && isFinite(raw)) out[e[0]] = [pct / 100, raw];
  }
  return out;
}
export const seasonRowKey = (p, sd) => `${p.id}|${sd.season}|${sd.league}`;

// Every season row with metrics, grouped by its own season position, plus per-season
// column stats for the z-scores. Cached per players array.
const prepared = new WeakMap();
export function preparePlayerSim(allPlayers) {
  if (prepared.has(allPlayers)) return prepared.get(allPlayers);
  const groups = {};
  for (const rk of SIM_GROUPS) groups[rk] = { feats: groupFeatures(rk), rows: [], roleKeys: [], stats: new Map() };
  const roleCount = {};
  for (const p of allPlayers) {
    for (const sd of (p.seasonsDetailAll || [])) {
      if (!hasMetrics(sd)) continue;
      const rk = rowGroup(p, sd), G = groups[rk];
      if (!G) continue;
      const m = metricsOf(sd);
      const v = new Float64Array(G.feats.length), pct = new Float64Array(G.feats.length);
      G.feats.forEach(([lab], c) => { const e = m[lab]; v[c] = e ? e[1] : NaN; pct[c] = e ? e[0] : NaN; });
      const roles = sd.qcRoles || null;
      if (roles) { roleCount[rk] = roleCount[rk] || {}; for (const k of Object.keys(roles)) roleCount[rk][k] = (roleCount[rk][k] || 0) + 1; }
      G.rows.push({ p, sd, v, pct, roles, season: String(sd.season), league: sd.league, norm: normLeague(sd.league),
                    minutes: Number(sd.minutes) || 0, age: sd.age != null ? Number(sd.age) : Number(p.age),
                    ls: leagueStrength(sd.league), simLs: simStrength(sd.league), band: leagueBand(sd.league), region: leagueRegion(sd.league) });
    }
  }
  const seasons = new Set();
  for (const rk of SIM_GROUPS) {
    const G = groups[rk];
    // Style roles used = the hexagon keys on at least 80% of the group's rows (some
    // groups have alternates such as Anchor / Destroyer that only some rows carry).
    const rc = roleCount[rk] || {};
    G.roleKeys = Object.keys(rc).filter(k => rc[k] >= 0.8 * G.rows.length).sort();
    const bySeason = new Map();
    for (const r of G.rows) {
      seasons.add(r.season);
      r.rv = new Float64Array(G.roleKeys.length);
      G.roleKeys.forEach((k, c) => { const x = r.roles ? Number(r.roles[k]) : NaN; r.rv[c] = isFinite(x) ? x : NaN; });
      if (!bySeason.has(r.season)) bySeason.set(r.season, []);
      bySeason.get(r.season).push(r);
    }
    for (const [s, rows] of bySeason) {
      G.stats.set(s, { f: columnStats(rows.map(r => r.v), G.feats.length), r: columnStats(rows.map(r => r.rv), G.roleKeys.length) });
    }
  }
  const all = sortSeasons([...seasons]);
  const split = all.filter(s => !isCalendar(s)), cal = all.filter(isCalendar);
  const current = new Set([split[split.length - 1], cal[cal.length - 1]].filter(Boolean));
  const out = { groups, seasons: all, current };
  prepared.set(allPlayers, out);
  return out;
}

// The player's own season rows with metrics, newest first (calendar year after split),
// most minutes first within a season.
export function playerSeasonRows(player) {
  const rows = (player.seasonsDetailAll || []).filter(hasMetrics);
  const order = sortSeasons([...new Set(rows.map(r => String(r.season)))]).reverse();
  return rows.slice().sort((a, b) => order.indexOf(String(a.season)) - order.indexOf(String(b.season)) || (Number(b.minutes) || 0) - (Number(a.minutes) || 0));
}
export const DEFAULT_FROM_MINUTES = 900;
// "Compare from season" default: the newest season row with at least 900 minutes,
// else the row with the most minutes.
export function defaultFromRow(player, minMinutes = DEFAULT_FROM_MINUTES) {
  const rows = playerSeasonRows(player);
  return rows.find(r => (Number(r.minutes) || 0) >= minMinutes)
    || rows.slice().sort((a, b) => (Number(b.minutes) || 0) - (Number(a.minutes) || 0))[0] || null;
}
export const subjectGroup = (player, sd) => (sd ? rowGroup(player, sd) : (player.roleKey || ''));

/**
 * subject: { player, sd } (sd = one of the player's seasonsDetailAll rows)
 * opts: group (default the row's own), seasons (Set|null), lsMin, lsMax, bands, regions,
 *       leagues (Set of normLeague), ageMin, ageMax, minMinutes, n, onePerPlayer,
 *       excludeSelf, useRoles
 * Returns { results: [{ p, sd, sim, why }], ms, missing, poolSize, feats, roleKeys }
 */
export function findSimilarPlayers(subject, allPlayers, opts = {}) {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const P = preparePlayerSim(allPlayers);
  const { player, sd } = subject || {};
  const empty = { results: [], ms: 0, missing: true, poolSize: 0, feats: [], roleKeys: [] };
  if (!player || !sd || !hasMetrics(sd)) return empty;
  const {
    group = rowGroup(player, sd), seasons = null, lsMin = 0, lsMax = 101, bands = null, regions = null,
    leagues = null, ageMin = 0, ageMax = 99, minMinutes = 900, n = 10, onePerPlayer = true, excludeSelf = true,
    useRoles = true,
  } = opts;
  const G = P.groups[group];
  if (!G) return empty;
  const sm = metricsOf(sd);
  // Features = the group's list that the subject row actually has (another position
  // group can ask for metrics the subject's own pool doesn't record).
  const cols = [];
  G.feats.forEach(([lab, w], c) => { if (sm[lab]) cols.push({ c, lab, w, pct: sm[lab][0], raw: sm[lab][1] }); });
  if (cols.length < 5) return empty;
  const rcols = [];
  if (useRoles && sd.qcRoles) G.roleKeys.forEach((k, c) => { const x = Number(sd.qcRoles[k]); if (isFinite(x)) rcols.push({ c, lab: k, raw: x }); });
  const fSum = cols.reduce((a, x) => a + x.w, 0);
  const share = rcols.length ? ROLE_SHARE : 0;
  cols.forEach(x => { x.nw = x.w / fSum * (1 - share); });
  rcols.forEach(x => { x.nw = share / rcols.length; });
  const st = G.stats.get(String(sd.season));
  const zOf = (stats, c, v) => (stats ? (v - stats.mean[c]) / stats.sd[c] : 0);
  cols.forEach(x => { x.z = zOf(st && st.f, x.c, x.raw); });
  rcols.forEach(x => { x.z = zOf(st && st.r, x.c, x.raw); });
  const selfLs = simStrength(sd.league);
  const useBands = bands && bands.size, useRegions = regions && regions.size, useLeagues = leagues && leagues.size;
  const scored = [];
  for (let i = 0; i < G.rows.length; i++) {
    const r = G.rows[i];
    if (r.sd === sd) continue;
    if (excludeSelf && r.p.id === player.id) continue;
    if (seasons && !seasons.has(r.season)) continue;
    if (r.minutes < minMinutes) continue;
    if (!(r.age >= ageMin && r.age <= ageMax)) continue;
    if (r.ls < lsMin || r.ls > lsMax) continue;
    if (useBands && !bands.has(r.band)) continue;
    if (useRegions && !regions.has(r.region)) continue;
    if (useLeagues && !leagues.has(r.norm)) continue;
    const cs = G.stats.get(r.season);
    let pd = 0, ad = 0, ok = true;
    for (const x of cols) {
      const v = r.v[x.c];
      if (!isFinite(v)) { ok = false; break; }
      pd += Math.abs(r.pct[x.c] - x.pct) * x.nw;
      ad += Math.abs((v - cs.f.mean[x.c]) / cs.f.sd[x.c] - x.z) * x.nw;
    }
    if (!ok) continue;
    for (const x of rcols) {
      let v = r.rv[x.c];
      if (!isFinite(v)) v = cs.r.mean[x.c]; // role missing on this row -> season mean
      pd += Math.abs(v - x.raw) / 100 * x.nw;
      ad += Math.abs((v - cs.r.mean[x.c]) / cs.r.sd[x.c] - x.z) * x.nw;
    }
    scored.push({ i, sim: blendSimilarity(pd, ad, r.simLs, selfLs) });
  }
  scored.sort((a, b) => b.sim - a.sim);
  const results = [], seen = new Set();
  for (const s of scored) {
    if (results.length >= n) break;
    const r = G.rows[s.i];
    if (onePerPlayer) { if (seen.has(r.p.id)) continue; seen.add(r.p.id); }
    const why = closestFurthest(cols.map(x => ({ label: x.lab, a: x.raw, b: r.v[x.c], aPct: x.pct, bPct: r.pct[x.c] })));
    results.push({ p: r.p, sd: r.sd, sim: Math.round(s.sim * 10) / 10, why });
  }
  const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
  return { results, ms, missing: false, poolSize: scored.length, feats: cols.map(x => [x.lab, x.w]), roleKeys: rcols.map(x => x.lab) };
}
