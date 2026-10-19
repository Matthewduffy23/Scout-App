// Archetype engine — tested against real data for all 6 positions directly
// (not the full zz_harness.test.js ALL-players load, which OOMs: reads only
// each position's own chunk files).
import fs from 'fs';
import path from 'path';
import { roleScoresFor, classifyArchetype, computeQuadrantScores } from './archetypeEngine';
import { ARCHETYPE_CONFIG, COMPLETE_THRESHOLD, COMPLETE_MIN_ROLES, GENERALIST_THRESHOLD, GENERALIST_MIN_ROLES } from './archetypeConfig';

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

test('ARCHETYPE_CONFIG: every position has roles, quadrant, hybrids and a full colour set', () => {
  for (const pos of ['GK', 'CB', 'FB', 'CM', 'ATT', 'CF']) {
    const cfg = ARCHETYPE_CONFIG[pos];
    expect(cfg).toBeTruthy();
    expect(Object.keys(cfg.roles).length).toBeGreaterThan(0);
    expect(cfg.quadrant.x.w).toBeTruthy();
    expect(cfg.quadrant.y.w).toBeTruthy();
    expect(cfg.colors[cfg.completeLabel]).toBe('#f8fafc');
    expect(cfg.colors.Generalist).toBe('#ca8a04');
    expect(cfg.colors['No clear profile']).toBe('#64748b');
    for (const name of [...cfg.mainTypes, ...cfg.hybridNames]) expect(cfg.colors[name]).toBeTruthy();
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

test('classifyArchetype cascade (CM): complete, 3-role n/a, 2-role hybrid, dominant, generalist, none', () => {
  const cfg = ARCHETYPE_CONFIG.CM;
  // a) Complete: 3+ roles >=75
  const complete = classifyArchetype('CM', { DLP: 80, Playmaker: 78, 'Ball-Winner': 76, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20, 'Box-to-Box': 20 });
  expect(complete).toEqual({ kind: 'complete', key: cfg.completeLabel, label: cfg.completeLabel, color: '#f8fafc' });
  // c) 2-role hybrid: DLP+Playmaker >=60, gap<8 -> All-Phase Passer
  const hybrid = classifyArchetype('CM', { DLP: 72, Playmaker: 68, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20, 'Box-to-Box': 20 });
  expect(hybrid).toEqual({ kind: 'hybrid', key: 'All-Phase Passer', label: 'All-Phase Passer', color: cfg.colors['All-Phase Passer'] });
  // d) dominant: best >=65, no qualifying hybrid
  const dominant = classifyArchetype('CM', { DLP: 70, Playmaker: 30, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20, 'Box-to-Box': 20 });
  expect(dominant).toEqual({ kind: 'dominant', key: 'DLP', label: 'DLP', color: cfg.colors.DLP });
  // e) generalist: 3+ roles >=54, nothing dominant/hybrid
  const generalist = classifyArchetype('CM', { DLP: 58, Playmaker: 56, 'Ball-Winner': 55, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20, 'Box-to-Box': 20 });
  expect(generalist).toEqual({ kind: 'generalist', key: 'Generalist', label: 'Generalist', color: '#ca8a04' });
  // f) none
  const none = classifyArchetype('CM', { DLP: 40, Playmaker: 38, 'Ball-Winner': 20, Anchor: 20, 'Attacking Midfielder': 20, 'Ball Carrier': 20, 'Box-to-Box': 20 });
  expect(none).toEqual({ kind: 'none', key: 'No clear profile', label: 'No clear profile', color: '#64748b' });
});

test('classifyArchetype cascade (CB): 3-role hybrid beats 2-role and dominant', () => {
  const cfg = ARCHETYPE_CONFIG.CB;
  // Progresser+Ball Carrier+Ball Player all >=60, spread<=10 -> Complete Build-Up Player,
  // even though Ball Player alone would also clear dominantThreshold(65) if checked first.
  const r = classifyArchetype('CB', { Progresser: 68, 'Ball Carrier': 62, 'Ball Player': 66, Aerial: 10, Aggressor: 10, Stopper: 10 });
  expect(r).toEqual({ kind: 'hybrid', key: 'Complete Build-Up Player', label: 'Complete Build-Up Player', color: cfg.colors['Complete Build-Up Player'] });
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

describe.each(['GK', 'CB', 'FB', 'CM', 'ATT', 'CF'])('%s full pool (>=900 mins latest season)', (pos) => {
  test('distribution, Complete/Generalist sensitivity, examples', () => {
    const cfg = ARCHETYPE_CONFIG[pos];
    const pool = loadPool(pos);
    const results = pool.map(p => ({ p, types: roleScoresFor(pos, p) })).filter(r => r.types);
    const classified = results.map(r => ({ ...r, arch: classifyArchetype(pos, r.types) }));
    console.log(`\n[archetype] ${pos} pool=${pool.length} withScores=${results.length}`);

    const counts = {};
    for (const r of classified) counts[r.arch.label] = (counts[r.arch.label] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log(`[archetype] ${pos} distribution:`, sorted.map(([l, n]) => `${l}=${n}(${(100 * n / classified.length).toFixed(2)}%)`).join(' | '));
    expect(counts['No clear profile']).toBeGreaterThan(0);

    // flag hybrids under 1%
    for (const h of cfg.hybrids) {
      const n = counts[h.name] || 0;
      const pct = 100 * n / classified.length;
      if (pct < 1) console.log(`[archetype] ${pos} UNDER 1%: ${h.name} = ${n} (${pct.toFixed(2)}%)`);
    }

    // Complete sensitivity: 3+ >=70, 3+ >=80 (vs shipped >=75)
    for (const T of [70, 75, 80]) {
      const n = results.filter(r => Object.values(r.types).filter(v => v != null).filter(v => v >= T).length >= COMPLETE_MIN_ROLES).length;
      console.log(`[archetype] ${pos} Complete (3+ >=${T}): ${n} (${(100 * n / results.length).toFixed(2)}%)`);
    }
    // Generalist sensitivity: 3+ >=50, 3+ >=58 (vs shipped >=54) — NET (after a-d excluded)
    for (const T of [50, 54, 58]) {
      let n = 0;
      for (const r of results) {
        const entries = Object.entries(r.types).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
        const [n1, s1] = entries[0] || [null, null];
        if (s1 != null && s1 >= COMPLETE_THRESHOLD && entries.filter(([, v]) => v >= COMPLETE_THRESHOLD).length >= COMPLETE_MIN_ROLES) continue; // would be Complete
        // approximate: skip players whose classify() result isn't none/generalist-eligible by threshold T
        if (entries.filter(([, v]) => v >= T).length >= GENERALIST_MIN_ROLES) {
          const arch = classifyArchetype(pos, r.types);
          if (arch.kind !== 'complete' && arch.kind !== 'hybrid' && arch.kind !== 'dominant') n++;
        }
      }
      console.log(`[archetype] ${pos} Generalist net (3+ >=${T}): ${n} (${(100 * n / results.length).toFixed(2)}%)`);
    }

    console.log(`[archetype] ${pos} 5 examples per archetype (by career score):`);
    const byLabel = {};
    for (const r of classified) (byLabel[r.arch.label] = byLabel[r.arch.label] || []).push(r);
    for (const [label, arr] of Object.entries(byLabel)) {
      arr.sort((a, b) => (b.p.careerScore || 0) - (a.p.careerScore || 0));
      const top5 = arr.slice(0, 5).map(r => {
        const top3 = Object.entries(r.types).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ');
        return `${r.p.name} (${r.p.team}, ${r.p.league}) [${top3}]`;
      }).join('; ');
      console.log(`  ${label}: ${top5}`);
    }
  });
});
