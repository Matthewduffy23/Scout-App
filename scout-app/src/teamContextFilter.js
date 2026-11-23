// teamContextFilter.js — the sidebar "Team context" filter.
//
// SCORES: exactly what the Team Context card shows — seasonTeamContext() in constants.js,
// the same function QuickCard and PlayerPager call: the season row's stored
// teamContext, else the player's own. Scores are 0-100 composites, NOT percentiles, so
// the filter ranks each team-season's score against a pool of teams:
//   'league' (default) — teams in the same league and season;
//   'all'              — every team in that season label.
// The team pool is every distinct team / league / season carrying a teamContext across
// all players' season rows (the pipeline writes one per team-season; every player at
// that club shares it — checked: 12,263 team-seasons, 0 disagreements).
// Percentile = (teams below + half the ties) / pool size × 100, so in a 24-team league
// "0–50" is exactly the bottom 12 and "75–100" exactly the top 6.
import { seasonTeamContext, seasonEntryFor, seasonRowFor, seasonDetailExact } from './constants';

export const TEAM_CTX_CATS = ['Quality', 'Attack', 'Possession', 'Pressing'];

const prepared = new WeakMap();
export function buildTeamContextPools(allPlayers) {
  if (prepared.has(allPlayers)) return prepared.get(allPlayers);
  const seen = new Set();
  const league = new Map(), season = new Map(); // key -> { cat: sorted values }
  const push = (m, k, tc) => {
    if (!m.has(k)) m.set(k, Object.fromEntries(TEAM_CTX_CATS.map(c => [c, []])));
    const o = m.get(k);
    for (const c of TEAM_CTX_CATS) if (tc[c] != null && isFinite(tc[c])) o[c].push(Number(tc[c]));
  };
  for (const p of allPlayers) {
    for (const sd of (p.seasonsDetailAll || [])) {
      const tc = sd.teamContext;
      if (!tc || !Object.keys(tc).length) continue;
      const key = `${sd.team}|${sd.league}|${sd.season}`;
      if (seen.has(key)) continue;
      seen.add(key);
      push(league, `${sd.league}|${sd.season}`, tc);
      push(season, String(sd.season), tc);
    }
  }
  for (const m of [league, season]) for (const o of m.values()) for (const c of TEAM_CTX_CATS) o[c].sort((a, b) => a - b);
  const out = { league, season, teams: seen.size };
  prepared.set(allPlayers, out);
  return out;
}

// Count of values < v and === v in a sorted array.
function below(arr, v) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
  let e = lo;
  while (e < arr.length && arr[e] === v) e++;
  return [lo, e - lo];
}
export function pctInPool(arr, v) {
  if (!arr || !arr.length || v == null || !isFinite(v)) return null;
  const [lt, eq] = below(arr, Number(v));
  return (lt + eq / 2) / arr.length * 100;
}

// The team-season a player is judged on: the season row the table shows (the selected
// season's row, see seasonRowFor) or, with All seasons, the current club's row.
export function teamContextRow(player, season, leagues) {
  if (!season || season === 'all') {
    const sd = seasonDetailExact(player, player.season, player.league);
    return { sd, league: player.league, season: String(player.season), team: player.team };
  }
  const h = seasonRowFor(player, season, leagues);
  if (!h) return null;
  const sd = seasonEntryFor(player, h);
  return { sd, league: h.l, season: String(h.s), team: (sd && sd.team) || player.team };
}

// { Quality: {score, pct}, ... } for one player, or null if no team context.
export function teamContextPcts(pools, player, season, leagues, pool = 'league') {
  const row = teamContextRow(player, season, leagues);
  if (!row) return null;
  const tc = seasonTeamContext(player, row.sd);
  if (!tc || !Object.keys(tc).length) return null;
  const src = pool === 'all' ? pools.season.get(row.season) : pools.league.get(`${row.league}|${row.season}`);
  const out = {};
  for (const c of TEAM_CTX_CATS) out[c] = { score: tc[c] == null ? null : Number(tc[c]), pct: src ? pctInPool(src[c], tc[c]) : null };
  return out;
}

// filters: [{ cat, on, min, max }] — all active ones must hold.
export function passesTeamContext(pcts, filters) {
  for (const f of filters) {
    if (!f.on) continue;
    const x = pcts && pcts[f.cat];
    if (!x || x.pct == null) return false;
    if (x.pct < f.min || x.pct > f.max) return false;
  }
  return true;
}
