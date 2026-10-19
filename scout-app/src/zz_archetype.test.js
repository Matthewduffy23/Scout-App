// Archetype engine — tested against real data for all 6 positions directly
// (not the full zz_harness.test.js ALL-players load, which OOMs: reads only
// each position's own chunk files).
import fs from 'fs';
import path from 'path';
import { roleScoresFor, roleScoresForSeason, classifyArchetype, computeQuadrantScores, computeQuadrantScoresCareerBlend } from './archetypeEngine';
import { ARCHETYPE_CONFIG, COMPLETE_MIN_ROLES, GENERALIST_THRESHOLD, GENERALIST_MIN_ROLES } from './archetypeConfig';

const PUB = path.join(__dirname, '..', 'public');
const MIN_MINUTES = 900;
const FILES = {
  GK: ['players_gk.json'],
  CB: [1, 2, 3, 4].map(i => `players_cb_${i}.json`),
  FB: [1, 2, 3, 4].map(i => `players_fb_${i}.json`),
  ATT: [1, 2, 3, 4].map(i => `players_att_${i}.json`),
  CF: [1, 2, 3].map(i => `players_cf_${i}.json`),
  CM: [1, 2, 3, 4].map(i => `players_cm_${i}.json`),
};
function loadPool(pos) {
  let pool = [];
  for (const f of FILES[pos]) {
    const arr = JSON.parse(fs.readFileSync(path.join(PUB, f), 'utf8'));
    for (const p of arr) if ((p.minutesLatest || 0) >= MIN_MINUTES) pool.push(p);
  }
  return pool;
}

test('ARCHETYPE_CONFIG: every position has roles, quadrant, max 3 hybrids, mainTypes, and a full colour set', () => {
  for (const pos of ['GK', 'CB', 'FB', 'CM', 'ATT', 'CF']) {
    const cfg = ARCHETYPE_CONFIG[pos];
    expect(cfg).toBeTruthy();
    expect(Object.keys(cfg.roles).length).toBeGreaterThan(0);
    expect(cfg.hybrids.length).toBeLessThanOrEqual(3);
    expect(cfg.quadrant.x.w).toBeTruthy();
    expect(cfg.quadrant.y.w).toBeTruthy();
    expect(cfg.colors[cfg.completeLabel]).toBe('#f8fafc');
    expect(cfg.colors.Generalist).toBe('#ca8a04');
    expect(cfg.colors['No clear profile']).toBe('#64748b');
    for (const name of [...cfg.mainTypes, ...cfg.hybridNames]) expect(cfg.colors[name]).toBeTruthy();
    // every mainType must itself be a computed role
    for (const name of cfg.mainTypes) expect(cfg.roles[name]).toBeTruthy();
  }
});

test('ATT Creator is computed but excluded from mainTypes (hybrid-only input, never a standalone label)', () => {
  const cfg = ARCHETYPE_CONFIG.ATT;
  expect(cfg.roles.Creator).toBeTruthy();
  expect(cfg.mainTypes).not.toContain('Creator');
  expect(cfg.hybrids.some(h => h.roles.includes('Creator'))).toBe(true);
  // Dominant Creator score alone (nothing else close) must NOT become dominant Creator.
  const r = classifyArchetype('ATT', { Creator: 90, 'Deep Playmaker': 10, 'Goal Threat': 10, Dribbler: 10, 'Wide Playmaker': 10, Sustainer: 10 });
  expect(r.kind).not.toBe('dominant');
  expect(r.key).not.toBe('Creator');
});

test('ATT Complete uses the overridden threshold (80), not the default 75', () => {
  expect(ARCHETYPE_CONFIG.ATT.completeThreshold).toBe(80);
  const at75 = classifyArchetype('ATT', { 'Deep Playmaker': 76, 'Goal Threat': 77, Dribbler: 76, 'Wide Playmaker': 10, Sustainer: 10, Creator: 10 });
  expect(at75.kind).not.toBe('complete'); // 76/77/76 clears the old 75 bar but not ATT's 80
  const at80 = classifyArchetype('ATT', { 'Deep Playmaker': 81, 'Goal Threat': 82, Dribbler: 80, 'Wide Playmaker': 10, Sustainer: 10, Creator: 10 });
  expect(at80.kind).toBe('complete');
});

test('classifyArchetype cascade (CM, trimmed roles — no Box-to-Box): complete, 2-role hybrid, dominant, generalist, none', () => {
  const cfg = ARCHETYPE_CONFIG.CM;
  expect(Object.keys(cfg.roles).sort()).toEqual(['Anchor', 'Attacking Midfielder', 'Ball Carrier', 'Ball-Winner', 'DLP', 'Playmaker'].sort());
  const complete = classifyArchetype('CM', { DLP: 80, Playmaker: 78, 'Ball-Winner': 76, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  expect(complete).toEqual({ kind: 'complete', key: cfg.completeLabel, label: cfg.completeLabel, color: '#f8fafc' });
  const hybrid = classifyArchetype('CM', { DLP: 72, Playmaker: 68, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  expect(hybrid).toEqual({ kind: 'hybrid', key: 'All-Phase Passer', label: 'All-Phase Passer', color: cfg.colors['All-Phase Passer'] });
  const dominant = classifyArchetype('CM', { DLP: 70, Playmaker: 30, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  expect(dominant).toEqual({ kind: 'dominant', key: 'DLP', label: 'DLP', color: cfg.colors.DLP });
  // Generalist threshold is now 50 (was 54) — 3 roles at exactly 50+ qualifies.
  const generalist = classifyArchetype('CM', { DLP: 52, Playmaker: 51, 'Ball-Winner': 50, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  expect(generalist).toEqual({ kind: 'generalist', key: 'Generalist', label: 'Generalist', color: '#ca8a04' });
  const none = classifyArchetype('CM', { DLP: 40, Playmaker: 38, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  expect(none).toEqual({ kind: 'none', key: 'No clear profile', label: 'No clear profile', color: '#64748b' });
});

test('classifyArchetype (CB): Ball-Playing CB = max(Ball Player, Progresser) feeds Build-Up Specialist hybrid, no 3-role hybrid remains', () => {
  const cfg = ARCHETYPE_CONFIG.CB;
  expect(cfg.hybrids.length).toBe(2);
  expect(cfg.hybrids.map(h => h.name).sort()).toEqual(['Build-Up Specialist', 'Dominant Defender'].sort());
  const r = classifyArchetype('CB', { 'Ball-Playing CB': 68, 'Ball Carrier': 62, Aerial: 10, Aggressor: 10, Stopper: 10 });
  expect(r).toEqual({ kind: 'hybrid', key: 'Build-Up Specialist', label: 'Build-Up Specialist', color: cfg.colors['Build-Up Specialist'] });
});

test('GK, CB, CF quadrant "both" corner is renamed All-Round, not Complete (reserved for the archetype tier)', () => {
  for (const pos of ['GK', 'CB', 'CF']) expect(ARCHETYPE_CONFIG[pos].quadrant.names.both).toBe('All-Round');
  expect(ARCHETYPE_CONFIG.FB.quadrant.names.both).toBe('Two-Way');
  expect(ARCHETYPE_CONFIG.ATT.quadrant.names.both).toBe('Multi-Threat');
  expect(ARCHETYPE_CONFIG.CM.quadrant.names.both).toBe('All Action');
  // no hybrid or quadrant name is the bare word "Complete" anywhere
  for (const pos of Object.keys(ARCHETYPE_CONFIG)) {
    const cfg = ARCHETYPE_CONFIG[pos];
    expect(Object.values(cfg.quadrant.names)).not.toContain('Complete');
    expect(cfg.hybridNames).not.toContain('Complete');
  }
});

test('roleScoresFor: real player, every position, scores are 0-100 or null and keys match config roles', () => {
  for (const pos of ['GK', 'CB', 'FB', 'CM', 'ATT', 'CF']) {
    const arr = JSON.parse(fs.readFileSync(path.join(PUB, FILES[pos][0]), 'utf8'));
    const p = arr.find(x => x.qcRoleCareerScores && Object.keys(x.qcRoleCareerScores).length >= 2);
    const scores = roleScoresFor(pos, p);
    expect(scores).toBeTruthy();
    expect(Object.keys(scores).sort()).toEqual(Object.keys(ARCHETYPE_CONFIG[pos].roles).sort());
    for (const v of Object.values(scores)) if (v != null) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
  }
});

test('roleScoresForSeason: single-season scores differ from the career blend for a multi-season player, and use that season\'s own qcRoles for hexagon-reuse roles', () => {
  const arr = JSON.parse(fs.readFileSync(path.join(PUB, FILES.CM[0]), 'utf8'));
  // A player with >=2 qualifying seasons whose hexagon Playmaker score actually
  // changed season to season, so the two paths are expected to disagree.
  const p = arr.find(x => {
    const seasons = Object.keys(x.seasonsDetail || {}).filter(s => x.seasonsDetail[s].g && x.seasonsDetail[s].qcRoles);
    if (seasons.length < 2) return false;
    const vals = seasons.map(s => x.seasonsDetail[s].qcRoles.Playmaker).filter(v => v != null);
    return vals.length >= 2 && new Set(vals).size > 1;
  });
  expect(p).toBeTruthy();
  const career = roleScoresFor('CM', p);
  const seasons = Object.keys(p.seasonsDetail).filter(s => p.seasonsDetail[s].g && p.seasonsDetail[s].qcRoles);
  const olderSeason = seasons.find(s => p.seasonsDetail[s].qcRoles.Playmaker !== career.Playmaker) || seasons[0];
  const seasonScores = roleScoresForSeason('CM', p.seasonsDetail[olderSeason]);
  expect(seasonScores).toBeTruthy();
  expect(seasonScores.Playmaker).toBe(p.seasonsDetail[olderSeason].qcRoles.Playmaker);
  expect(Object.keys(seasonScores).sort()).toEqual(Object.keys(ARCHETYPE_CONFIG.CM.roles).sort());
});

test('roleScoresForSeason returns null for a season with no usable data (e.g. under the pipeline\'s scoring-minutes floor)', () => {
  expect(roleScoresForSeason('CM', null)).toBeNull();
  expect(roleScoresForSeason('CM', {})).toBeNull();
});

test('computeQuadrantScores: a seasonDetailOf override changes which season\'s raw stats feed the ranking', () => {
  const pool = loadPool('CB');
  const multiSeason = pool.filter(p => Object.keys(p.seasonsDetail || {}).filter(s => p.seasonsDetail[s].g).length >= 2);
  expect(multiSeason.length).toBeGreaterThan(20);
  const oldest = p => { const seasons = Object.keys(p.seasonsDetail).filter(s => p.seasonsDetail[s].g); return p.seasonsDetail[seasons[seasons.length - 1]]; };
  const withOverride = computeQuadrantScores('CB', multiSeason, oldest);
  const defaultLatest = computeQuadrantScores('CB', multiSeason); // default = latest season
  expect(withOverride.size).toBeGreaterThan(20);
  // At least some players should rank differently between oldest- and latest-season stats.
  let anyDiff = false;
  for (const [id, v] of withOverride) { const d = defaultLatest.get(id); if (d && Math.abs(d.x - v.x) > 0.01) { anyDiff = true; break; } }
  expect(anyDiff).toBe(true);
});

test('computeQuadrantScoresCareerBlend: a multi-season player gets different axis values than Latest season', () => {
  const pool = loadPool('CB');
  const multiSeason = pool.filter(p => {
    const seasons = Object.keys(p.seasonsDetail || {}).filter(s => p.seasonsDetail[s].g);
    return seasons.length >= 2 && seasons.every(s => (p.seasonsDetail[s].minutes || 0) > 0);
  });
  expect(multiSeason.length).toBeGreaterThan(20);
  const latest = computeQuadrantScores('CB', multiSeason); // default = latest season
  const career = computeQuadrantScoresCareerBlend('CB', multiSeason);
  expect(career.size).toBeGreaterThan(20);
  let anyDiff = false;
  for (const [id, v] of career) { const d = latest.get(id); if (d && Math.abs(d.x - v.x) > 0.01) { anyDiff = true; break; } }
  expect(anyDiff).toBe(true);
  for (const { x, y } of career.values()) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(100); }
});

test('computeQuadrantScores: 0-100 range for a couple of positions', () => {
  for (const pos of ['CB', 'ATT']) {
    const pool = loadPool(pos).slice(0, 500);
    const scores = computeQuadrantScores(pos, pool);
    expect(scores.size).toBeGreaterThan(50);
    for (const { x, y, q } of scores.values()) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(100);
      expect(Object.values(ARCHETYPE_CONFIG[pos].quadrant.names)).toContain(q);
    }
  }
});

describe.each(['GK', 'CB', 'FB', 'CM', 'ATT', 'CF'])('%s full pool (>=900 mins latest season), trimmed config', (pos) => {
  test('distribution (incl. grey %), 3 examples per archetype', () => {
    const cfg = ARCHETYPE_CONFIG[pos];
    const pool = loadPool(pos);
    const results = pool.map(p => ({ p, types: roleScoresFor(pos, p) })).filter(r => r.types);
    const classified = results.map(r => ({ ...r, arch: classifyArchetype(pos, r.types) }));
    console.log(`\n[archetype] ${pos} pool=${pool.length} withScores=${results.length}`);

    const counts = {};
    for (const r of classified) counts[r.arch.label] = (counts[r.arch.label] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log(`[archetype] ${pos} distribution:`, sorted.map(([l, n]) => `${l}=${n}(${(100 * n / classified.length).toFixed(2)}%)`).join(' | '));
    console.log(`[archetype] ${pos} grey %: ${(100 * (counts['No clear profile'] || 0) / classified.length).toFixed(2)}%`);
    console.log(`[archetype] ${pos} categories present: ${sorted.length} of max possible ${cfg.mainTypes.length + cfg.hybrids.length + 3}`);
    expect(counts['No clear profile']).toBeGreaterThan(0);
    expect(sorted.length).toBeLessThanOrEqual(cfg.mainTypes.length + cfg.hybrids.length + 3); // mainTypes + hybrids + Complete + Generalist + grey

    console.log(`[archetype] ${pos} 3 examples per archetype (by career score):`);
    const byLabel = {};
    for (const r of classified) (byLabel[r.arch.label] = byLabel[r.arch.label] || []).push(r);
    for (const [label, arr] of Object.entries(byLabel)) {
      arr.sort((a, b) => (b.p.careerScore || 0) - (a.p.careerScore || 0));
      const top3 = arr.slice(0, 3).map(r => {
        const topScores = Object.entries(r.types).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ');
        return `${r.p.name} (${r.p.team}, ${r.p.league}) [${topScores}]`;
      }).join('; ');
      console.log(`  ${label}: ${top3}`);
    }
  });
});
