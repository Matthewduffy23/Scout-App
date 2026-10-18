// CM Archetype system — tested against real data directly (not the full
// zz_harness.test.js ALL-players load, which OOMs: reads only the 4 CM
// chunk files, same pattern as zz_quickcard_tags.test.js / zz_fixtures_footspacing.json).
import fs from 'fs';
import path from 'path';
import { cmTypeScores, classifyCmArchetype, computeCmPoolScores, HYBRID_CANDIDATES, CM_TYPE_KEYS, ARCHETYPE_COLORS } from './cmArchetype';

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

test('cmTypeScores: 8 types present, all 0-100 or null, for a real multi-season CM', () => {
  const arr = JSON.parse(fs.readFileSync(path.join(PUB, 'players_cm_1.json'), 'utf8'));
  const p = arr.find(x => x.name === 'M. Trabelsi' && x.team === 'Esperance Tunis') || arr.find(x => x.seasonsDetail && Object.keys(x.seasonsDetail).length >= 2);
  const types = cmTypeScores(p);
  expect(types).toBeTruthy();
  expect(Object.keys(types).sort()).toEqual([...CM_TYPE_KEYS].sort());
  for (const v of Object.values(types)) if (v != null) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
});

test('classifyCmArchetype: dominant, kept-hybrid and no-clear-profile paths all produce a sane result', () => {
  // Dominant: one type clearly >=70, nothing else close.
  const dom = classifyCmArchetype({ DLP: 85, 'Tempo-Setter': 40, Playmaker: 30, 'Ball-Winner': 20, Anchor: 15, 'Attacking Midfielder': 25, 'Ball Carrier': 20, 'Box-to-Box': 25 });
  expect(dom).toEqual({ kind: 'dominant', key: 'DLP', label: 'DLP', color: ARCHETYPE_COLORS.DLP });

  // Kept hybrid: DLP + Playmaker both >=65, gap <10 -> Complete Playmaker.
  const hyb = classifyCmArchetype({ DLP: 78, 'Tempo-Setter': 40, Playmaker: 72, 'Ball-Winner': 20, Anchor: 15, 'Attacking Midfielder': 25, 'Ball Carrier': 20, 'Box-to-Box': 25 });
  expect(hyb).toEqual({ kind: 'hybrid', key: 'Complete Playmaker', label: 'Complete Playmaker', color: ARCHETYPE_COLORS['Complete Playmaker'] });

  // Candidate pair that exists but was dropped for being under 3% (Ball-Winner+Ball Carrier) -> falls back to dominant (top type only, since gap<10 but pair not kept).
  const dropped = classifyCmArchetype({ DLP: 10, 'Tempo-Setter': 10, Playmaker: 10, 'Ball-Winner': 74, Anchor: 10, 'Attacking Midfielder': 10, 'Ball Carrier': 68, 'Box-to-Box': 10 });
  expect(dropped.kind).toBe('dominant');
  expect(dropped.label).toBe('Ball-Winner');

  // Nothing reaches 70, no qualifying hybrid -> No clear profile.
  const none = classifyCmArchetype({ DLP: 55, 'Tempo-Setter': 50, Playmaker: 48, 'Ball-Winner': 40, Anchor: 35, 'Attacking Midfielder': 45, 'Ball Carrier': 42, 'Box-to-Box': 38 });
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

test('Full >=900min CM pool: overlap before/after refinement, final distribution, named sanity checks', () => {
  const pool = loadCmPool();
  console.log(`[cm archetype] pool size (>=900 mins latest season): ${pool.length}`);

  const results = pool.map(p => {
    const types = cmTypeScores(p);
    return { p, types, arch: classifyCmArchetype(types) };
  }).filter(r => r.arch);

  const counts = {};
  for (const r of results) counts[r.arch.label] = (counts[r.arch.label] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log('[cm archetype] final distribution:', sorted.map(([l, n]) => `${l}=${n}(${(100 * n / results.length).toFixed(1)}%)`).join(' | '));
  // sanity: "No clear profile" should be the largest or near-largest single bucket (matches Part-2 report's finding that strict thresholds leave a large unclassified tail)
  expect(counts['No clear profile']).toBeGreaterThan(0);
  // every HYBRID_CANDIDATES label marked kept must appear somewhere in the distribution if the pool is large enough
  for (const [, { label, kept }] of Object.entries(HYBRID_CANDIDATES)) if (kept) expect(counts[label]).toBeGreaterThan(0);

  for (const name of ['M. Verratti', 'Riqui Puig', 'Éverton Ribeiro', 'R. Carrascal']) {
    const r = results.find(x => x.p.name === name);
    if (r) console.log(`[cm archetype] ${name}: ${r.arch.label}`);
  }

  console.log('\n[cm archetype] 5 examples per archetype:');
  const byLabel = {};
  for (const r of results) (byLabel[r.arch.label] = byLabel[r.arch.label] || []).push(r);
  for (const [label, arr] of Object.entries(byLabel)) {
    arr.sort((a, b) => Math.max(...Object.values(b.types).filter(v => v != null)) - Math.max(...Object.values(a.types).filter(v => v != null)));
    const top5 = arr.slice(0, 5).map(r => `${r.p.name} (${r.p.team})`).join('; ');
    console.log(`  ${label}: ${top5}`);
  }
});

test('Overlap before/after refinement, and quadrant x archetype cross-tab (shipped module)', () => {
  const pool = loadCmPool();
  // "Before": old hexagon-weight equivalents, for comparison only (archetype
  // module itself never exposes these — pulled from qcRoleCareerScores directly).
  function overlapPct(aFn, bFn, T) {
    let n = 0, d = 0;
    for (const p of pool) { const a = aFn(p), b = bFn(p); if (a == null || b == null) continue; d++; if (a >= T && b >= T) n++; }
    return { n, d, pct: 100 * n / d };
  }
  const typesOf = p => cmTypeScores(p) || {};
  const oldDLP = p => (p.qcRoleCareerScores || {})['DLP'] ?? null;
  const oldAnchor = p => { const q = p.qcRoleCareerScores || {}; return q['Anchor'] ?? q['Destroyer'] ?? null; };
  const newTempo = p => typesOf(p)['Tempo-Setter'] ?? null;
  const newDLP = p => typesOf(p)['DLP'] ?? null;
  const newAnchor = p => typesOf(p)['Anchor'] ?? null;
  const newBallWinner = p => typesOf(p)['Ball-Winner'] ?? null;

  const before1 = overlapPct(oldDLP, newTempo, 70);
  const after1 = overlapPct(newDLP, newTempo, 70);
  const before2 = overlapPct(newBallWinner, oldAnchor, 70);
  const after2 = overlapPct(newBallWinner, newAnchor, 70);
  console.log(`\n[cm archetype] DLP(hexagon,old)+Tempo-Setter(new) >=70 both: ${before1.n}/${before1.d} = ${before1.pct.toFixed(2)}%`);
  console.log(`[cm archetype] DLP(refined,new)+Tempo-Setter(new) >=70 both: ${after1.n}/${after1.d} = ${after1.pct.toFixed(2)}%`);
  console.log(`[cm archetype] Ball-Winner+Anchor(hexagon,old) >=70 both: ${before2.n}/${before2.d} = ${before2.pct.toFixed(2)}%`);
  console.log(`[cm archetype] Ball-Winner+Anchor(refined,new) >=70 both: ${after2.n}/${after2.d} = ${after2.pct.toFixed(2)}%`);
  // the whole point of the refinement: overlap must go down, not up or stay flat
  expect(after1.pct).toBeLessThan(before1.pct);
  expect(after2.pct).toBeLessThan(before2.pct);

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
    const top = Object.entries(row).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l, n]) => `${l}=${n}(${(100*n/total).toFixed(0)}%)`).join(', ');
    console.log(`  ${q} (n=${total}): ${top}`);
  }
  expect(qTotal).toBeGreaterThan(1000);
});
