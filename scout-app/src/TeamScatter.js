import React, { useMemo, useCallback, useRef } from 'react';
import { ScatterView } from './ScatterChart';
import { TEAM_SCORE_STEPS, TEAM_SCORE_LOW, teamScoreColor } from './constants';

// Team Index scatter chart: the shared ScatterView (same engine as the player
// chart) with team axes, colours, tooltip and group conditions. Results are per
// match, not season totals — calendar leagues and part-seasons have played
// different numbers of games, so totals would bury them.

const money = v => v >= 1e6 ? `£${(v/1e6).toFixed(1)}m` : `£${Math.round(v/1e3)}k`;
const perMatch = (t, k) => (t[k] != null && t.matches > 0 ? t[k] / t.matches : null);

// Match metrics stored on each team row as metricGroups[group] = [[name, pct, raw], ...].
const TEAM_METRICS = {
  Attack: ['xG', 'Goals Scored', 'Shots', 'Shooting %', 'Touches in Box', 'Crosses'],
  Defence: ['xG Against', 'Goals Against', 'Shots Against', 'PPDA', 'Aerial Duels', 'Aerial Duel Success %', 'Defensive Duels', 'Defensive Duel Win %'],
  Possession: ['Possession', 'Passes', 'Passing Accuracy %', 'Progressive Passes', 'Progressive Runs', 'Passes to Final 3rd', 'Long Passes', 'Long Passing %', 'Dribbles'],
};
// Lower is better — and their stored percentiles are already flipped (high pct = fewer
// goals against / more intense pressing), checked against the data.
const TEAM_LOWER_BETTER = new Set(['Defence:xG Against', 'Defence:Goals Against', 'Defence:Shots Against', 'Defence:PPDA']);

const metricOf = (t, group, name, mode) => {
  const row = (t.metricGroups?.[group] || []).find(m => m[0] === name);
  if (!row) return null;
  const v = mode === 'pct' ? row[1] : parseFloat(row[2]);
  return Number.isFinite(v) ? v : null;
};

const TEAM_SCORE_BUCKETS = [
  ...TEAM_SCORE_STEPS.map((s, i) => ({ key: 't' + s.min, color: s.color, label: `${s.min}${i ? '–' + TEAM_SCORE_STEPS[i - 1].min : '+'}` })),
  { key: 'tlow', color: TEAM_SCORE_LOW, label: `Below ${TEAM_SCORE_STEPS[TEAM_SCORE_STEPS.length - 1].min}` },
];
const teamBucket = v => { const s = TEAM_SCORE_STEPS.find(t => v >= t.min); return s ? 't' + s.min : 'tlow'; };

const TEAM_GROUPS = [
  { key: 'league', label: 'League', kind: 'choice', valueOf: t => t.league || '', labelOf: v => v },
  { key: 'avgAge', label: 'Avg age', kind: 'number', get: t => t.avgAge, def: 25, step: 0.5 },
];
const teamId = t => `${t.team}|${t.league}|${t.season}`;
const teamName = t => t.team;
const teamSub = t => `${t.league} · ${t.season}`;
const teamTip = t => [`${t.league} · ${t.season}`, `${t.style || 'No style'}${t.pointsRank ? ` · ${t.pointsRank}/${t.leagueSize || '?'} in league` : ''}`];

export default function TeamScatter({ teams, getDisplayScore, scoreLabel, styleColors, getAvgXValue, getTotalMV, getMVPerf, onSelect, onClose, contextLabel }) {
  // Latest lookup functions via a ref, so axis getters stay current without
  // rebuilding every field on each Team Index render.
  const fns = useRef({});
  fns.current = { getDisplayScore, getAvgXValue, getTotalMV, getMVPerf };

  const buildFields = useCallback(mode => {
    const f = [
      { key: 'score', group: 'Scores', label: `Table score · ${scoreLabel}`, get: t => fns.current.getDisplayScore(t) },
      { key: 'completeScore', group: 'Scores', label: 'Overall score', get: t => t.completeScore },
      { key: 'attack', group: 'Scores', label: 'Attack', get: t => t.attack },
      { key: 'defence', group: 'Scores', label: 'Defence', get: t => t.defence },
      { key: 'possession', group: 'Scores', label: 'Possession', get: t => t.possession },
      { key: 'pressing', group: 'Scores', label: 'Pressing', get: t => t.pressing },
      { key: 'ppm', group: 'Results (per match)', label: 'Points per match', short: 'Points', get: t => perMatch(t, 'points') },
      { key: 'xppm', group: 'Results (per match)', label: 'xPts per match', short: 'xPts', get: t => perMatch(t, 'expectedPoints') },
      { key: 'gfpm', group: 'Results (per match)', label: 'Goals for per match', short: 'Goals For', get: t => perMatch(t, 'goalsFor') },
      { key: 'gapm', group: 'Results (per match)', label: 'Goals against per match', short: 'Goals Against', lowerBetter: true, get: t => perMatch(t, 'goalsAgainst') },
      { key: 'gdpm', group: 'Results (per match)', label: 'Goal difference per match', short: 'Goal Diff', get: t => (t.goalsFor != null && t.goalsAgainst != null && t.matches > 0 ? (t.goalsFor - t.goalsAgainst) / t.matches : null) },
      { key: 'luck', group: 'Results (per match)', label: 'Points minus xPts per match', short: 'Pts − xPts', get: t => (t.points != null && t.expectedPoints != null && t.matches > 0 ? (t.points - t.expectedPoints) / t.matches : null) },
      { key: 'winPct', group: 'Results (per match)', label: 'Win %', short: 'Win %', get: t => (t.wins != null && t.matches > 0 ? 100 * t.wins / t.matches : null) },
      { key: 'lossPct', group: 'Results (per match)', label: 'Loss %', short: 'Loss %', lowerBetter: true, get: t => (t.losses != null && t.matches > 0 ? 100 * t.losses / t.matches : null) },
      { key: 'avgAge', group: 'Squad', label: 'Average age', words: ['Older', 'Younger'], get: t => t.avgAge },
      { key: 'avgXValue', group: 'Squad', label: 'Average xValue', short: 'Avg xValue', fmt: money, get: t => fns.current.getAvgXValue(t.team, t.league) },
      { key: 'totalMV', group: 'Squad', label: 'Squad market value', short: 'Squad Value', fmt: money, get: t => fns.current.getTotalMV(t.team, t.league) },
      { key: 'mvPerf', group: 'Squad', label: '£ performance (league places vs squad value)', short: '£ Performance', get: t => fns.current.getMVPerf(t.team, t.league) },
    ];
    for (const [group, names] of Object.entries(TEAM_METRICS)) {
      for (const name of names) {
        const lower = TEAM_LOWER_BETTER.has(`${group}:${name}`);
        f.push({
          key: `mg:${group}:${name}`, group: `Match metrics · ${group}`, metric: true, short: name,
          label: mode === 'pct' ? `${name} (percentile)` : name, pctDomain: mode === 'pct',
          ...(lower ? { lowerBetter: true, pctInverted: true } : {}),
          get: t => metricOf(t, group, name, mode),
        });
      }
    }
    return f;
  }, [scoreLabel]);

  const colorModes = useMemo(() => [['style', 'Style'], ['score', `Score (${scoreLabel})`]], [scoreLabel]);
  const colorOf = useCallback((t, mode) => {
    if (mode === 'style') return { g: t.style || 'No Defined Style', color: (styleColors[t.style] || styleColors['No Defined Style'] || { color: '#94a3b8' }).color };
    const v = fns.current.getDisplayScore(t);
    return Number.isFinite(v) ? { g: teamBucket(v), color: teamScoreColor(v) } : { g: 'none', color: '#64748b' };
  }, [styleColors]);
  const legendBase = useCallback(mode => (mode === 'style'
    ? Object.entries(styleColors).map(([k, v]) => ({ key: k, label: k, color: v.color }))
    : [...TEAM_SCORE_BUCKETS, { key: 'none', label: 'No data', color: '#64748b' }]), [styleColors]);

  return (
    <ScatterView items={teams} idOf={teamId} nameOf={teamName} subOf={teamSub} tooltipLines={teamTip}
      buildFields={buildFields} defaultX="xppm" defaultY="ppm" metricLabel="Raw value"
      colorModes={colorModes} colorOf={colorOf} legendBase={legendBase} scoreQuad={null} targetTiers={null}
      groups={TEAM_GROUPS} noun="team" openLabel="Open team card" onSelect={onSelect} onClose={onClose} contextLabel={contextLabel}/>
  );
}
