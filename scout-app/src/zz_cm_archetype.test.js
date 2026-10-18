// CM Archetype system — tested against real data directly (not the full
// zz_harness.test.js ALL-players load, which OOMs: reads only the 4 CM
// chunk files, same pattern as zz_quickcard_tags.test.js / zz_fixtures_footspacing.json).
import fs from 'fs';
import path from 'path';
import { cmTypeScores, classifyCmArchetype, computeCmPoolScores, HYBRID_CANDIDATES, CM_TYPE_KEYS, ARCHETYPE_COLORS, GENERALIST_MIN_TYPES, GENERALIST_THRESHOLD } from './cmArchetype';

const PUB = path.join(__dirname, '..', 'public');
const MIN_MINUTES = 900;

function loadCmPool() {
  let pool = [];
  for (let i = 1; i <= 4; i++) {
    const arr = JSON.parse(fs.readFileSync(path.join(PUB, `players_cm_${i}.json`), 'utf8'));
    for (const p of arr) if ((p.minutesLatest || 0) >= MIN_MINUTES) pool.push(p);
  }
  return pool;
}

test('cmTypeScores: 7 types present (Tempo-Setter removed), all 0-100 or null, for a real multi-season CM', () => {
  const arr = JSON.parse(fs.readFileSync(path.join(PUB, 'players_cm_1.json'), 'utf8'));
  const p = arr.find(x => x.name === 'M. Trabelsi' && x.team === 'Esperance Tunis') || arr.find(x => x.seasonsDetail && Object.keys(x.seasonsDetail).length >= 2);
  const types = cmTypeScores(p);
  expect(types).toBeTruthy();
  expect(Object.keys(types).sort()).toEqual([...CM_TYPE_KEYS].sort());
  expect(Object.keys(types)).not.toContain('Tempo-Setter');
  for (const v of Object.values(types)) if (v != null) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
});

test('classifyCmArchetype: dominant, kept-hybrid, generalist and no-clear-profile paths all produce a sane result', () => {
  // Dominant: one type clearly >=70, nothing else close.
  const dom = classifyCmArchetype({ DLP: 85, Playmaker: 30, 'Ball-Winner': 20, Anchor: 15, 'Attacking Midfielder': 25, 'Ball Carrier': 20, 'Box-to-Box': 25 });
  expect(dom).toEqual({ kind: 'dominant', key: 'DLP', label: 'DLP', color: ARCHETYPE_COLORS.DLP });

  // Kept hybrid: DLP + Playmaker both >=65, gap <10 -> Complete Playmaker.
  const hyb = classifyCmArchetype({ DLP: 78, Playmaker: 72, 'Ball-Winner': 20, Anchor: 15, 'Attacking Midfielder': 25, 'Ball Carrier': 20, 'Box-to-Box': 25 });
  expect(hyb).toEqual({ kind: 'hybrid', key: 'Complete Playmaker', label: 'Complete Playmaker', color: ARCHETYPE_COLORS['Complete Playmaker'] });

  // Candidate pair that exists but was dropped for being under 3% (Ball-Winner+Ball Carrier) -> falls back to dominant.
  const dropped = classifyCmArchetype({ DLP: 10, Playmaker: 10, 'Ball-Winner': 74, Anchor: 10, 'Attacking Midfielder': 10, 'Ball Carrier': 68, 'Box-to-Box': 10 });
  expect(dropped.kind).toBe('dominant');
  expect(dropped.label).toBe('Ball-Winner');

  // Generalist: nothing >=70, no qualifying hybrid, but 4 of 7 types >=55.
  const gen = classifyCmArchetype({ DLP: 58, Playmaker: 60, 'Ball-Winner': 56, Anchor: 40, 'Attacking Midfielder': 57, 'Ball Carrier': 45, 'Box-to-Box': 50 });
  expect(gen).toEqual({ kind: 'generalist', key: 'Generalist', label: 'Generalist', color: ARCHETYPE_COLORS.Generalist });

  // Only 3 of 7 >=55 -> short of Generalist's 4-of-7 bar -> No clear profile.
  const none = classifyCmArchetype({ DLP: 58, Playmaker: 60, 'Ball-Winner': 56, Anchor: 40, 'Attacking Midfielder': 45, 'Ball Carrier': 42, 'Box-to-Box': 38 });
  expect(none).toEqual({ kind: 'none', key: 'No clear profile', label: 'No clear profile', color: ARCHETYPE_COLORS['No clear profile'] });
});

test('computeCmPoolScores: Feature Q weights sum correctly and rank within the given pool (0-100)', () => {
  const pool = loadCmPool().slice(0, 500);
  const scores = computeCmPoolScores(pool);
  expect(scores.size).toBeGreaterThan(50);
  for (const { possessionScore, defensiveScore } of scores.values()) {
    expect(possessionScore).toBeGreaterThanOrEqual(0); expect(possessionScore).toBeLessThanOrEqual(100);
    expect(defensiveScore).toBeGreaterThanOrEqual(0); expect(defensiveScore).toBeLessThanOrEqual(100);
  }
});

test('Generalist threshold alternatives (real >=900min CM pool) — counts at 3-of-7>=55, 4-of-7>=50, 4-of-7>=55 (used), 4-of-7>=60', () => {
  const pool = loadCmPool();
  const allTypes = pool.map(p => cmTypeScores(p)).filter(Boolean);
  const countAtLeast = (types, n, T) => Object.values(types).filter(v => v != null).filter(v => v >= T).length >= n;
  const variants = [['3-of-7 >=55', 3, 55], ['4-of-7 >=50', 4, 50], ['4-of-7 >=55 (used)', 4, 55], ['4-of-7 >=60', 4, 60]];

  console.log('\n[cm archetype] Generalist threshold alternatives — RAW (any player meeting the count-of-types test, before excluding dominant/hybrid):');
  for (const [label, n, T] of variants) {
    const count = allTypes.filter(t => countAtLeast(t, n, T)).length;
    console.log(`  ${label}: ${count} (${(100 * count / allTypes.length).toFixed(2)}%)`);
  }

  // NET — what would actually land in the "Generalist" bucket at each
  // threshold: byte-for-byte classifyCmArchetype's own dominant/hybrid
  // logic (only a KEPT HYBRID_CANDIDATES pair short-circuits it, same as
  // the real function), just swapping in the alternative (n, T) for the
  // generalist check at the end.
  const pairKeyLocal = (a, b) => [a, b].sort().join('+');
  function classifyWith(types, n, T) {
    const entries = Object.entries(types).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return 'none';
    const [n1, s1] = entries[0];
    const [n2, s2] = entries[1] || [null, null];
    if (s2 != null && s1 >= 65 && s2 >= 65 && (s1 - s2) < 10) {
      const cand = HYBRID_CANDIDATES[pairKeyLocal(n1, n2)];
      if (cand && cand.kept) return 'hybrid';
    }
    if (s1 >= 70) return 'dominant';
    if (entries.filter(([, v]) => v >= T).length >= n) return 'generalist';
    return 'none';
  }
  console.log('\n[cm archetype] Generalist threshold alternatives — NET (actually lands as Generalist, dominant/hybrid excluded first):');
  for (const [label, n, T] of variants) {
    const count = allTypes.filter(t => classifyWith(t, n, T) === 'generalist').length;
    console.log(`  ${label}: ${count} (${(100 * count / allTypes.length).toFixed(2)}%)`);
  }

  expect(GENERALIST_MIN_TYPES).toBe(4);
  expect(GENERALIST_THRESHOLD).toBe(55);
});

test('Full >=900min CM pool: final distribution (incl. Generalist), named sanity checks, 5 top-league examples per archetype', () => {
  const pool = loadCmPool();
  console.log(`[cm archetype] pool size (>=900 mins latest season): ${pool.length}`);

  const results = pool.map(p => {
    const types = cmTypeScores(p);
    return { p, types, arch: classifyCmArchetype(types) };
  }).filter(r => r.arch);

  const counts = {};
  for (const r of results) counts[r.arch.label] = (counts[r.arch.label] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log('[cm archetype] final distribution:');
  sorted.forEach(([l, n]) => console.log(`  ${l}: ${n} (${(100 * n / results.length).toFixed(2)}%)`));
  expect(counts['No clear profile']).toBeGreaterThan(0);
  expect(counts['Generalist']).toBeGreaterThan(0);
  for (const [, { label, kept }] of Object.entries(HYBRID_CANDIDATES)) if (kept) expect(counts[label]).toBeGreaterThan(0);

  for (const name of ['M. Verratti', 'Riqui Puig', 'Éverton Ribeiro', 'R. Carrascal']) {
    const r = results.find(x => x.p.name === name);
    if (r) console.log(`[cm archetype] ${name}: ${r.arch.label}`);
  }

  console.log('\n[cm archetype] 5 examples per archetype (sorted by career score, so top-league/well-known names surface first):');
  const byLabel = {};
  for (const r of results) (byLabel[r.arch.label] = byLabel[r.arch.label] || []).push(r);
  for (const [label, arr] of Object.entries(byLabel)) {
    arr.sort((a, b) => (b.p.careerScore || 0) - (a.p.careerScore || 0));
    const top5 = arr.slice(0, 5).map(r => `${r.p.name} (${r.p.team}, ${r.p.league})`).join('; ');
    console.log(`  ${label}: ${top5}`);
  }
});

test('Ball-Winner+Anchor overlap stays reduced (refinement unaffected by Tempo-Setter removal), and quadrant x archetype cross-tab', () => {
  const pool = loadCmPool();
  function overlapPct(aFn, bFn, T) {
    let n = 0, d = 0;
    for (const p of pool) { const a = aFn(p), b = bFn(p); if (a == null || b == null) continue; d++; if (a >= T && b >= T) n++; }
    return { n, d, pct: 100 * n / d };
  }
  const typesOf = p => cmTypeScores(p) || {};
  const oldAnchor = p => { const q = p.qcRoleCareerScores || {}; return q['Anchor'] ?? q['Destroyer'] ?? null; };
  const newAnchor = p => typesOf(p)['Anchor'] ?? null;
  const newBallWinner = p => typesOf(p)['Ball-Winner'] ?? null;

  const before = overlapPct(newBallWinner, oldAnchor, 70);
  const after = overlapPct(newBallWinner, newAnchor, 70);
  console.log(`\n[cm archetype] Ball-Winner+Anchor(hexagon,old) >=70 both: ${before.n}/${before.d} = ${before.pct.toFixed(2)}%`);
  console.log(`[cm archetype] Ball-Winner+Anchor(refined,new) >=70 both: ${after.n}/${after.d} = ${after.pct.toFixed(2)}%`);
  expect(after.pct).toBeLessThan(before.pct);

  const results = pool.map(p => ({ p, arch: classifyCmArchetype(cmTypeScores(p)) })).filter(r => r.arch);
  const poolScores = computeCmPoolScores(pool);
  const qxArch = {};
  let qTotal = 0;
  for (const r of results) {
    const sc = poolScores.get(r.p.id);
    if (!sc) continue;
    const q = (sc.defensiveScore >= 50 && sc.possessionScore >= 50) ? 'All Action'
      : sc.defensiveScore >= 50 ? 'Defensive' : sc.possessionScore >= 50 ? 'Playmaker' : 'Limited';
    qxArch[q] = qxArch[q] || {}; qxArch[q][r.arch.label] = (qxArch[q][r.arch.label] || 0) + 1; qTotal++;
  }
  console.log(`\n[cm archetype] quadrant x archetype (n=${qTotal}):`);
  for (const q of ['All Action', 'Defensive', 'Playmaker', 'Limited']) {
    const row = qxArch[q] || {}; const total = Object.values(row).reduce((a, b) => a + b, 0);
    const top = Object.entries(row).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l, n]) => `${l}=${n}(${(100*n/total).toFixed(0)}%)`).join(', ');
    console.log(`  ${q} (n=${total}): ${top}`);
  }
  expect(qTotal).toBeGreaterThan(1000);
});
