// coachMetrics.js — pure computation functions for Coach Card traits.
// All traits are CAREER AVERAGES across whichever team+season tenure rows the
// user selects for a coach (confirmed explicitly: "all these are career averages
// from inputted seasons"), computed from the same Team Index data (teams_final.json)
// already loaded elsewhere in the app — no separate coach dataset exists.
//
// Several formulas below involve a numeric scaling/normalization choice that wasn't
// fully specified (e.g. how much raw volatility maps to "high" Adaptability) — each
// is flagged clearly in its own comment so it's easy to find and adjust if the
// output doesn't feel right once tested against real coaches.

function getMetric(teamRow, group, label, field) {
  // field: 'pct' (percentile) or 'raw' (raw per-90/percent value)
  const g = (teamRow.metricGroups && teamRow.metricGroups[group]) || [];
  const row = g.find(r => r[0] === label);
  if (!row) return null;
  return field === 'raw' ? row[2] : row[1];
}

function avg(arr) {
  const valid = arr.filter(v => v != null && !Number.isNaN(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function coefficientOfVariation(arr) {
  const valid = arr.filter(v => v != null && !Number.isNaN(v));
  if (valid.length < 2) return 0; // can't measure volatility from a single season
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  if (mean === 0) return 0;
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

/**
 * Compute all 9 Coaching Traits for a coach, as career averages across their
 * selected tenure.
 * @param {Array} tenureRows - the matching team-season records from teams_final.json
 *   for every {team, league, season} the coach's profile includes.
 * @param {Array} allTeams - the full teams_final.json array (needed for Youth
 *   Development, which compares the coach's squad age against the REST of their
 *   league that same season).
 * @returns {Object|null} trait scores, each on a 0-100 scale (null tenureRows -> null)
 */
export function computeCoachTraits(tenureRows, allTeams) {
  if (!tenureRows || !tenureRows.length) return null;

  // -- Possession: average possession % (percentile) --
  const possession = avg(tenureRows.map(t => t.possession));

  // -- Pressing: average PPDA (percentile, already inverted so high = good pressing) --
  const pressing = avg(tenureRows.map(t => t.pressing));

  // -- Passing: Passes p90 75% + Pass Accuracy % 25% --
  const passesPct = avg(tenureRows.map(t => getMetric(t, 'Possession', 'Passes', 'pct')));
  const passAccPct = avg(tenureRows.map(t => getMetric(t, 'Possession', 'Passing Accuracy %', 'pct')));
  const passing = (passesPct != null && passAccPct != null) ? 0.75 * passesPct + 0.25 * passAccPct : null;

  // -- Adaptability: volatility (coefficient of variation) of RAW possession/long
  // passes/PPDA across seasons, .33 each — a coach whose style barely changes
  // season to season scores low; one who visibly adapts scores high.
  // SCALING CHOICE: coefficient of variation for these metrics typically falls in a
  // 0-0.4 range in practice; multiplying by 250 maps that range onto roughly 0-100.
  // Needs at least 2 seasons of data to mean anything — returns null with only 1.
  if (tenureRows.length < 2) {
    var adaptability = null;
  } else {
    const possessionRaw = tenureRows.map(t => getMetric(t, 'Possession', 'Possession', 'raw'));
    const longPassesRaw = tenureRows.map(t => getMetric(t, 'Possession', 'Long Passes', 'raw'));
    const ppdaRaw = tenureRows.map(t => getMetric(t, 'Pressing', 'PPDA', 'raw'));
    const avgCV = (coefficientOfVariation(possessionRaw) + coefficientOfVariation(longPassesRaw) + coefficientOfVariation(ppdaRaw)) / 3;
    var adaptability = Math.max(0, Math.min(100, avgCV * 250));
  }

  // -- Youth Development: squad avg age vs the REST of their league that season,
  // lower squad age relative to league = better. SCALING CHOICE: a league-relative
  // age gap of 0 years maps to 50 (average); each year younger than the league adds
  // ~17 points, each year older subtracts ~17 (so a squad ~3 years younger than
  // their league's average caps out near 100).
  const youthDiffs = tenureRows.map(t => {
    const leagueAges = allTeams.filter(x => x.league === t.league && x.season === t.season && x.avgAge != null && x.team !== t.team).map(x => x.avgAge);
    if (!leagueAges.length || t.avgAge == null) return null;
    const leagueAvg = leagueAges.reduce((a, b) => a + b, 0) / leagueAges.length;
    return leagueAvg - t.avgAge; // positive = younger than the rest of the league (good)
  });
  const avgYouthDiff = avg(youthDiffs);
  const youthDevelopment = avgYouthDiff == null ? null : Math.max(0, Math.min(100, 50 + avgYouthDiff * 16.7));

  // -- Attacking / Defensive: plain career averages of the existing category scores --
  const attacking = avg(tenureRows.map(t => t.attack));
  const defensive = avg(tenureRows.map(t => t.defence));

  // -- Set Pieces: no set-piece data exists anywhere in the pipeline — always a flat
  // 5/10 (50 on the 0-100 scale), shown yellow, per explicit instruction.
  const setPieces = 50;

  // -- Directness: 60% Long Passes percentile + 40% Progressive-Passes-to-Passes
  // ratio. SCALING CHOICE: that ratio typically falls roughly 0.05-0.20 in this
  // data; linearly mapped onto 0-100 across that range (clamped at the edges).
  const longPassesPct = avg(tenureRows.map(t => getMetric(t, 'Possession', 'Long Passes', 'pct')));
  const ratios = tenureRows.map(t => {
    const prog = getMetric(t, 'Possession', 'Progressive Passes', 'raw');
    const passes = getMetric(t, 'Possession', 'Passes', 'raw');
    return (prog != null && passes) ? prog / passes : null;
  });
  const avgRatio = avg(ratios);
  const ratioScore = avgRatio == null ? null : Math.max(0, Math.min(100, (avgRatio - 0.05) / (0.20 - 0.05) * 100));
  const directness = (longPassesPct != null && ratioScore != null) ? 0.6 * longPassesPct + 0.4 * ratioScore : null;

  return { possession, pressing, passing, adaptability, youthDevelopment, attacking, setPieces, defensive, directness };
}

/**
 * Per-metric percentile breakdown (career-averaged), for showing multiple bars
 * per category — same pattern as the real Metric Percentiles section, just
 * averaged across the coach's whole tenure instead of one season.
 */
export function computeCoachMetricGroups(tenureRows) {
  if (!tenureRows || !tenureRows.length) return null;
  const groups = {};
  const groupNames = ['Attack', 'Defence', 'Possession'];
  for (const groupName of groupNames) {
    const byLabel = {}; // label -> { pctSum, valSum, n }
    for (const t of tenureRows) {
      const rows = (t.metricGroups && t.metricGroups[groupName]) || [];
      for (const [label, pct, val] of rows) {
        if (!byLabel[label]) byLabel[label] = { pctSum: 0, valSum: 0, n: 0, valN: 0 };
        if (pct != null) { byLabel[label].pctSum += pct; byLabel[label].n += 1; }
        if (val != null) { byLabel[label].valSum += val; byLabel[label].valN += 1; }
      }
    }
    groups[groupName] = Object.entries(byLabel).map(([label, d]) => ({
      label,
      pct: d.n ? Math.round((d.pctSum / d.n) * 10) / 10 : null,
      val: d.valN ? Math.round((d.valSum / d.valN) * 100) / 100 : null,
    })).filter(r => r.pct != null);
  }
  return groups;
}

// Red/yellow/green tier color for a 0-100 trait score, same palette convention
// used elsewhere in the app (scoreBandColor/divColor).
export function traitTierColor(score) {
  if (score == null) return '#64748b';
  if (score >= 70) return '#22c55e'; // green
  if (score >= 45) return '#f59e0b'; // yellow/amber
  return '#ef4444'; // red
}

// Convert a 0-100 trait score to a 1-10 display number (for the manual override
// picker, which works on a 1-10 scale per spec).
export function traitScoreToTen(score) {
  return score == null ? null : Math.round(score / 10);
}
export function traitTenToScore(ten) {
  return ten == null ? null : ten * 10;
}
