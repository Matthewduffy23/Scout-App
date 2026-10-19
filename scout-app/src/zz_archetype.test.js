// Archetype engine — tested against real data for all 6 positions directly
// (not the full zz_harness.test.js ALL-players load, which OOMs: reads only
// each position's own chunk files).
import fs from 'fs';
import path from 'path';
import { roleScoresFor, roleScoresForSeason, classifyArchetype, simpleFamilyOf, computeQuadrantScores, computeQuadrantScoresCareerBlend } from './archetypeEngine';
import { ARCHETYPE_CONFIG, COMPLETE_MIN_ROLES, GENERALIST_THRESHOLD, GENERALIST_MIN_ROLES, GENERALIST_COLOR, COMPLETE_COLOR, NONE_COLOR, FAMILY_COLOR } from './archetypeConfig';

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
    expect(cfg.colors.Generalist).toBe('#b08d6a');
    expect(cfg.colors['No clear profile']).toBe('#64748b');
    for (const name of [...cfg.mainTypes, ...cfg.hybridNames]) expect(cfg.colors[name]).toBeTruthy();
    // every mainType must itself be a computed role
    for (const name of cfg.mainTypes) expect(cfg.roles[name]).toBeTruthy();
  }
});

test('Simple mode: every mainType/hybrid in every position has a family mapping, and simpleFamilies covers only families actually used', () => {
  for (const pos of ['GK', 'CB', 'FB', 'CM', 'ATT', 'CF']) {
    const cfg = ARCHETYPE_CONFIG[pos];
    for (const name of [...cfg.mainTypes, ...cfg.hybridNames]) {
      expect(cfg.simple.family[name]).toBeTruthy();
      expect(cfg.simpleColors[name]).toBeTruthy();
      expect(cfg.simpleLabelOf[name]).toBeTruthy();
    }
    const usedTokens = new Set(Object.values(cfg.simple.family));
    expect(new Set(cfg.simpleFamilies.map(f => f.key))).toEqual(usedTokens);
    for (const f of cfg.simpleFamilies) { expect(f.label).toBeTruthy(); expect(f.color).toBeTruthy(); }
  }
});

test('simpleFamilyOf: complete/generalist/none collapse to universal tokens with Simple-mode-specific colours', () => {
  const complete = classifyArchetype('CM', { DLP: 80, Playmaker: 78, 'Ball-Winner': 76, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  const sComplete = simpleFamilyOf('CM', complete);
  expect(sComplete).toEqual({ kind: 'complete', key: 'complete', label: 'Complete', color: '#f8fafc' });

  const generalist = classifyArchetype('CM', { DLP: 52, Playmaker: 51, 'Ball-Winner': 50, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  const sGeneralist = simpleFamilyOf('CM', generalist);
  expect(sGeneralist.key).toBe('generalist');
  expect(sGeneralist.color).toBe('#b08d6a'); // 2026-10-20: Generalist's warm taupe is shared by both modes
  expect(sGeneralist.color).toBe(ARCHETYPE_CONFIG.CM.colors.Generalist);

  const none = classifyArchetype('CM', { DLP: 40, Playmaker: 38, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  const sNone = simpleFamilyOf('CM', none);
  expect(sNone).toEqual({ kind: 'none', key: 'none', label: 'No clear profile', color: '#64748b' });
});

test('simpleFamilyOf: dominant and hybrid archetypes collapse to their configured family, same hue across positions', () => {
  // CM: Ball-Winner and Anchor are both "red" (defending); DLP/Playmaker/All-Phase Passer are "blue".
  const ballWinner = classifyArchetype('CM', { 'Ball-Winner': 70, DLP: 20, Playmaker: 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  expect(simpleFamilyOf('CM', ballWinner)).toEqual({ kind: 'dominant', key: 'red', label: 'Defensive', color: '#ef4444' });
  const allPhasePasser = classifyArchetype('CM', { DLP: 72, Playmaker: 68, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  expect(simpleFamilyOf('CM', allPhasePasser)).toEqual({ kind: 'hybrid', key: 'blue', label: 'Passing', color: '#3b82f6' });
  // CB's Aerial is "purple" (aerial/physical family) — same purple used by CF's Target Forward.
  const aerial = classifyArchetype('CB', { Aerial: 70, 'Composed Passer': 20, 'Line-Breaker': 20, 'Ball Carrier': 20, Aggressor: 20, Stopper: 20 });
  expect(simpleFamilyOf('CB', aerial).color).toBe('#a855f7');
  const targetForward = classifyArchetype('CF', { 'Target Forward': 70, 'Goal Threat': 20, Dribbler: 20, 'Playmaking Forward': 20 });
  expect(simpleFamilyOf('CF', targetForward).color).toBe('#a855f7');
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
  expect(generalist).toEqual({ kind: 'generalist', key: 'Generalist', label: 'Generalist', color: '#b08d6a' });
  const none = classifyArchetype('CM', { DLP: 40, Playmaker: 38, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20 });
  expect(none).toEqual({ kind: 'none', key: 'No clear profile', label: 'No clear profile', color: '#64748b' });
});

test('classifyArchetype (CB): un-merged into Composed Passer + Line-Breaker, no hybrid between them, Build-Up Specialist = Line-Breaker + Ball Carrier only', () => {
  const cfg = ARCHETYPE_CONFIG.CB;
  expect(Object.keys(cfg.roles).sort()).toEqual(['Aerial', 'Aggressor', 'Ball Carrier', 'Composed Passer', 'Line-Breaker', 'Stopper'].sort());
  expect(cfg.roles['Ball-Playing CB']).toBeUndefined();
  expect(cfg.hybrids.length).toBe(2);
  expect(cfg.hybrids.map(h => h.name).sort()).toEqual(['Build-Up Specialist', 'Dominant Defender'].sort());
  expect(cfg.hybrids.find(h => h.name === 'Build-Up Specialist').roles.sort()).toEqual(['Ball Carrier', 'Line-Breaker'].sort());
  // Composed Passer and Line-Breaker both high together is NOT a hybrid (no pair lists them) — falls to dominant.
  const r = classifyArchetype('CB', { 'Composed Passer': 90, 'Line-Breaker': 88, 'Ball Carrier': 20, Aerial: 10, Aggressor: 10, Stopper: 10 });
  expect(r.kind).toBe('dominant');
  expect(r.key).toBe('Composed Passer');
  const hybrid = classifyArchetype('CB', { 'Line-Breaker': 68, 'Ball Carrier': 62, 'Composed Passer': 10, Aerial: 10, Aggressor: 10, Stopper: 10 });
  expect(hybrid).toEqual({ kind: 'hybrid', key: 'Build-Up Specialist', label: 'Build-Up Specialist', color: cfg.colors['Build-Up Specialist'] });
});

test('config changes 2026-10-20: GK/FB/CM/ATT/CF renames and removals', () => {
  const gk = ARCHETYPE_CONFIG.GK;
  expect(gk.roles['Fire Fighter']).toBeUndefined();
  expect(gk.roles.Distributor).toBeTruthy(); // renamed from "Passing", still reuses hexagon 'Passing'
  expect(gk.roles.Distributor.hexagon).toBe('Passing');
  expect(gk.hybridNames.sort()).toEqual(['Ball-Playing Stopper', 'Shot-Stopping Sweeper'].sort());
  expect(gk.hybrids.find(h => h.name === 'Ball-Playing Stopper').roles.sort()).toEqual(['Distributor', 'Shot Stopper'].sort());

  const fb = ARCHETYPE_CONFIG.FB;
  expect(fb.roles.Wingback).toBeUndefined();
  expect(fb.roles['Wide Carrier']).toBeTruthy(); // renamed from "Flyer"
  expect(fb.roles['Wide Carrier'].hexagon).toBe('Flyer');
  expect(fb.hybridNames).toEqual(['All-Phase Playmaker']);

  const cm = ARCHETYPE_CONFIG.CM;
  expect(cm.hybridNames).toEqual(['All-Phase Passer']);
  expect(cm.roles['Attacking Midfielder']).toBeTruthy(); // unchanged

  const att = ARCHETYPE_CONFIG.ATT;
  expect(att.hybridNames.sort()).toEqual(['Dribbling-Finisher', 'Roaming Playmaker'].sort());
  expect(att.hybrids.find(h => h.name === 'Roaming Playmaker').roles.sort()).toEqual(['Creator', 'Deep Playmaker'].sort());

  const cf = ARCHETYPE_CONFIG.CF;
  expect(cf.roles['Pressing Forward']).toBeUndefined();
  expect(cf.hybridNames).toEqual(['Creative Dribbler']);
});

test('removed types/hybrids fall back to next-best on real classification', () => {
  // FB: Wingback-shaped player (high dribbling/box-arrival, nothing else) now
  // falls to whatever role scores next, never produces a "Wingback" key.
  const r = classifyArchetype('FB', { Playmaker: 20, 'Wide Carrier': 72, 'Wide Creator': 10, Defensive: 10 });
  expect(r.key).not.toBe('Wingback');
  expect(r.key).toBe('Wide Carrier');
  // CM: old Creative Box Threat pair (AM+Playmaker both high) now classifies
  // as dominant on whichever of the two is higher, not a hybrid.
  const cbt = classifyArchetype('CM', { 'Attacking Midfielder': 72, Playmaker: 68, DLP: 20, 'Ball-Winner': 20, Anchor: 20, 'Ball Carrier': 20 });
  expect(cbt.kind).toBe('dominant');
  expect(cbt.key).toBe('Attacking Midfielder');
});

test('CF: "False 9" renamed to "Playmaking Forward" (still reuses the hexagon\'s own False 9 formula), Creative Dribbler follows', () => {
  const cf = ARCHETYPE_CONFIG.CF;
  expect(cf.roles['False 9']).toBeUndefined();
  expect(cf.roles['Playmaking Forward']).toBeTruthy();
  expect(cf.hybrids.find(h => h.name === 'Creative Dribbler').roles.sort()).toEqual(['Dribbler', 'Playmaking Forward'].sort());
  expect(cf.simple.family['Playmaking Forward']).toBe('blue');
  const r = classifyArchetype('CF', { 'Playmaking Forward': 70, 'Goal Threat': 20, Dribbler: 20, 'Target Forward': 20 });
  expect(r.kind).toBe('dominant');
  expect(r.key).toBe('Playmaking Forward');
});

test('Generalist colour (warm taupe) is now shared by Simple and Detailed, distinct from white/grey/yellow/orange', () => {
  expect(GENERALIST_COLOR).toBe('#b08d6a');
  expect(FAMILY_COLOR.generalist).toBe(GENERALIST_COLOR);
  for (const pos of Object.keys(ARCHETYPE_CONFIG)) {
    expect(ARCHETYPE_CONFIG[pos].colors.Generalist).toBe('#b08d6a');
    expect(ARCHETYPE_CONFIG[pos].simpleColors.Generalist).toBe('#b08d6a');
  }
  // Not confusable with the other reserved colours or the yellow/orange
  // Detailed swatches it sits alongside (CM's Attacking Midfielder #FACC15,
  // CB's Stopper #F97316) — different enough in both hue and lightness.
  const hexToRgb = h => { const s = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
  const [gr, gg, gb] = hexToRgb(GENERALIST_COLOR);
  for (const other of [COMPLETE_COLOR, NONE_COLOR, '#FACC15', '#F97316']) {
    const [or_, og, ob] = hexToRgb(other);
    const dist = Math.sqrt((gr - or_) ** 2 + (gg - og) ** 2 + (gb - ob) ** 2);
    expect(dist).toBeGreaterThan(60);
  }
});

test('Detailed-mode swatches: exact full-colour-wheel palette (2026-10-20), no family-hue constraint', () => {
  const EXPECTED = {
    GK: { 'Shot Stopper': '#EF4444', 'Sweeper': '#22C55E', 'Distributor': '#3B82F6', 'Shot-Stopping Sweeper': '#FACC15', 'Ball-Playing Stopper': '#D946EF' },
    CB: { 'Aggressor': '#EF4444', 'Stopper': '#F97316', 'Aerial': '#8B5CF6', 'Composed Passer': '#22D3EE', 'Line-Breaker': '#3B82F6', 'Ball Carrier': '#22C55E', 'Build-Up Specialist': '#F472B6', 'Dominant Defender': '#FACC15' },
    FB: { 'Defensive': '#EF4444', 'Playmaker': '#3B82F6', 'Wide Creator': '#F97316', 'Wide Carrier': '#22C55E', 'All-Phase Playmaker': '#D946EF' },
    CM: { 'Ball-Winner': '#EF4444', 'Anchor': '#F472B6', 'DLP': '#22D3EE', 'Playmaker': '#3B82F6', 'Attacking Midfielder': '#FACC15', 'Ball Carrier': '#22C55E', 'All-Phase Passer': '#8B5CF6' },
    ATT: { 'Goal Threat': '#EF4444', 'Dribbling-Finisher': '#F97316', 'Wide Playmaker': '#FACC15', 'Dribbler': '#22C55E', 'Sustainer': '#22D3EE', 'Deep Playmaker': '#3B82F6', 'Roaming Playmaker': '#8B5CF6' },
    CF: { 'Goal Threat': '#EF4444', 'Target Forward': '#8B5CF6', 'Playmaking Forward': '#3B82F6', 'Creative Dribbler': '#22D3EE', 'Dribbler': '#22C55E' },
  };
  for (const [pos, swatches] of Object.entries(EXPECTED)) {
    const cfg = ARCHETYPE_CONFIG[pos];
    for (const [name, hex] of Object.entries(swatches)) expect(cfg.colors[name].toUpperCase()).toBe(hex);
  }
  expect(COMPLETE_COLOR).toBe('#f8fafc');
  expect(NONE_COLOR).toBe('#64748b');
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
