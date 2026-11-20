// teamSeasonMetrics.js — two per-season team metrics, from fields already in
// teams_final.json (no new pipeline data):
//
//  xPosition difference = xPointsRank − pointsRank
//    Where the team would sit on an xPts table minus where it actually finished.
//    Positive = finished higher than its xPts said (overperformed), negative = lower.
//    pointsRank / xPointsRank are exact ranks of points / expectedPoints within the
//    league-season (checked against every row). Fallback when a row has a real table
//    position but no xPts: expected position = rank of xG − xG against (per match) in
//    that league-season. In the current data no row needs it — the 26 rows without xPts
//    (Bulgaria 1 2024-25, Bosnia 1 2025-26) have no points/results either, so they have
//    no actual position and get no value.
//
//  League table difference = previous season's pointsRank − this season's pointsRank
//    Positive = climbed the table. Only when the team was in the SAME league the season
//    before ('2024-25' for '2025-26', '2024' for '2025'): a position in a different
//    division (promoted / relegated) isn't comparable, so those get no value.

const metricRaw = (t, group, name) => {
  const row = (t.metricGroups?.[group] || []).find(m => m[0] === name);
  const v = row ? parseFloat(row[2]) : NaN;
  return Number.isFinite(v) ? v : null;
};

export function prevSeasonOf(season) {
  const s = String(season || '');
  let m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) { const y = +m[1] - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; }
  m = s.match(/^(\d{4})$/);
  return m ? String(+m[1] - 1) : null;
}

const keyOf = (team, league, season) => `${team}|${league}|${season}`;

// Map team|league|season -> { xPosDiff, tableDiff, xPosSource, prevRank, prevSize }.
export function buildTeamSeasonMetrics(allTeams) {
  const byKey = new Map(), groups = new Map();
  for (const t of allTeams || []) {
    byKey.set(keyOf(t.team, t.league, t.season), t);
    const g = `${t.league}|${t.season}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  // xG-difference rank, only for league-seasons where some row needs the fallback.
  const xgRank = new Map();
  for (const rows of groups.values()) {
    if (!rows.some(t => t.pointsRank != null && t.xPointsRank == null)) continue;
    const vals = rows.map(t => { const a = metricRaw(t, 'Attack', 'xG'), b = metricRaw(t, 'Defence', 'xG Against'); return a != null && b != null ? a - b : null; });
    rows.forEach((t, i) => { if (vals[i] != null) xgRank.set(t, 1 + vals.filter(v => v != null && v > vals[i]).length); });
  }
  const out = new Map();
  for (const t of allTeams || []) {
    let xPosDiff = null, xPosSource = null;
    if (t.pointsRank != null) {
      if (t.xPointsRank != null) { xPosDiff = t.xPointsRank - t.pointsRank; xPosSource = 'xPts'; }
      else if (xgRank.has(t)) { xPosDiff = xgRank.get(t) - t.pointsRank; xPosSource = 'xG'; }
    }
    const ps = prevSeasonOf(t.season);
    const prev = ps ? byKey.get(keyOf(t.team, t.league, ps)) : null;
    const tableDiff = prev && prev.pointsRank != null && t.pointsRank != null ? prev.pointsRank - t.pointsRank : null;
    out.set(keyOf(t.team, t.league, t.season), { xPosDiff, xPosSource, tableDiff, prevRank: prev?.pointsRank ?? null, prevSize: prev?.leagueSize ?? null });
  }
  return out;
}

export const teamSeasonMetricsFor = (map, t) => (map && t ? map.get(keyOf(t.team, t.league, t.season)) || null : null);
export const signed = v => (v == null ? '—' : v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
