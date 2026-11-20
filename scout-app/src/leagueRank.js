// leagueRank.js — "League rank: All | Top 20% | Top 10%" sidebar filter.
//
// A player's rank is the main index score (whatever the list ranks by — see
// App.js getDisplayScore) against every player in the SAME league + SAME position
// group + SAME season. The pool is built from the whole dataset, never from the
// filtered list, so no other filter can change who is top 10%.
//   - Season selected: one entry per real season row (p.sh) in that season bucket.
//     League = the row's league, position = that season's own position (same rule
//     as the Position Group filter: seasonRoleKeyFor/posToRk), minutes = that row's.
//   - All seasons: career score, current league + current roleKey, grouped by the
//     player's latest season (bucketed, so calendar 2026 sits with 2026-27).
// Only players with >= minMins in that season count — both as pool members and as
// qualifiers — so low-minute players don't skew the cut. App.js passes the Min
// Minutes slider value; RANK_MIN_MINS is just the default when none is given.
import { seasonBucketMatch, seasonEntryFor, posToRk, seasonRowFor } from './constants';

export const RANK_MIN_MINS = 500; // the app's default Min Minutes
export const RANK_TIERS = { all: null, top20: 0.2, top10: 0.1 };

// Calendar year Y -> 'Y-(Y+1)', same bucketing as split_seasons.py / seasonBucketMatch.
export const seasonBucket = s => {
  const str = String(s || '');
  return /^\d{4}$/.test(str) ? `${str}-${String((+str + 1) % 100).padStart(2, '0')}` : str;
};

/**
 * Returns Map `${id}|${league}` -> { frac, rank, n } where frac = share of the pool
 * with a strictly higher score (0 = best). Top X% <=> frac < X.
 * rowScore(p, h): score for one season row (season mode).
 * careerScore(p): score with All seasons.
 */
export function buildLeagueRanks(players, season, { rowScore, careerScore, minMins = RANK_MIN_MINS }) {
  // minMins: a number, or league => minutes (the profile's per-season ranks use the
  // slider for senior leagues and 100 for youth leagues, row by row).
  const minFor = typeof minMins === 'function' ? minMins : () => minMins;
  const pools = new Map();
  const add = (key, id, league, score) => {
    if (score == null || !isFinite(score)) return;
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key).push({ id, league, score });
  };
  for (const p of players) {
    if (!season || season === 'all') {
      if ((p.minutesLatest || 0) < minFor(p.league)) continue;
      add(`${p.league}|${p.roleKey}|${seasonBucket(p.season)}`, p.id, p.league, careerScore(p));
      continue;
    }
    for (const h of p.sh || []) {
      if (h.displayOnly || !seasonBucketMatch(h.s, season)) continue;
      const e = seasonEntryFor(p, h);
      if ((e?.minutes || 0) < minFor(h.l)) continue;
      const rk = posToRk(e?.position || p.position) || p.roleKey;
      add(`${h.l}|${rk}`, p.id, h.l, rowScore(p, h));
    }
  }
  const out = new Map();
  for (const pool of pools.values()) {
    pool.sort((a, b) => b.score - a.score);
    const n = pool.length;
    let better = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0 && pool[i].score < pool[i - 1].score) better = i; // ties share a rank
      out.set(`${pool[i].id}|${pool[i].league}`, { frac: better / n, rank: better + 1, n });
    }
  }
  return out;
}

// The rank entry for the row the list actually shows (same row rule as the table).
export function leagueRankFor(ranks, p, season, leagues) {
  if (!season || season === 'all') return ranks.get(`${p.id}|${p.league}`) || null;
  const h = seasonRowFor(p, season, leagues);
  return h ? ranks.get(`${p.id}|${h.l}`) || null : null;
}

export function rankTag(r) {
  if (!r) return null;
  return r.frac < 0.1 ? 'Top 10%' : r.frac < 0.2 ? 'Top 20%' : null;
}
