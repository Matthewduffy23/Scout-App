// Targeted test for the QuickCard foot-spacing fix and the season/VS/league
// context tag. Deliberately NOT part of zz_harness.test.js: that file loads
// every player chunk (~900MB) into memory at module load time, which OOMs in
// this environment. This file loads two pre-extracted fixtures instead.
import fs from 'fs';
import path from 'path';

const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'zz_fixtures_footspacing.json'), 'utf8')
);
const archibald = FIXTURES.find(p => p.name === 'T. Archibald');
const kadir = FIXTURES.find(p => p.name === 'J. Kadir');

test('fixtures loaded', () => {
  expect(archibald).toBeTruthy();
  expect(kadir).toBeTruthy();
});

test('Quick Card: foot gap margin is the fixed 30px regardless of position-label content', () => {
  const { buildQuickCardElement } = require('./QuickCard');
  const labels = [
    'Wide Midfielder (LWB-RW)',
    'Attacking Midfielder (AM-LW)',
    'Defensive Midfielder (DM)',
    '', // raw-data default, no override
  ];
  for (const posLabelOverride of labels) {
    const el = buildQuickCardElement(archibald, [archibald], { resolvedPhotoUrl: '/fallback.png', posLabelOverride });
    const html = el.outerHTML;
    // the foot span always carries the same fixed margin-left, independent of
    // the position label's own length/content (flex box-model gap, not text
    // width estimation) — this is what guarantees the rendered gap matches.
    expect(html).toContain('margin-left:30px;">Left</span>');
    el.remove();
  }
});

test('Quick Card: season/VS/league context tag — off by default, matches format when on', () => {
  const { buildQuickCardElement } = require('./QuickCard');

  // Off by default: old automatic "(xx-xx)" tag behaviour is unchanged.
  const offEl = buildQuickCardElement(archibald, [archibald], { resolvedPhotoUrl: '/fallback.png' });
  const offHtml = offEl.outerHTML;
  expect(offHtml).not.toMatch(/VS (GK|CB|FB|CM|ATT|CF)/);
  offEl.remove();

  // On: "25-26 | VS ATT | ENG3" for Archibald's latest row (England 3., split-year season).
  const onEl = buildQuickCardElement(archibald, [archibald], { resolvedPhotoUrl: '/fallback.png', showSeasonContext: true });
  const onHtml = onEl.outerHTML;
  expect(onHtml).toContain('25-26 | VS ATT | ENG3');
  // replaces, not duplicates, the auto season tag
  expect(onHtml).not.toMatch(/>\(25-26\)</);
  onEl.remove();
  console.log('[quick card tag] Archibald on:', onHtml.match(/VS ATT[^<]*/)[0]);
});

test('Quick Card: season/VS/league tag for a calendar-year league (no split-year slicing, non-English code)', () => {
  const { buildQuickCardElement } = require('./QuickCard');
  const el = buildQuickCardElement(kadir, [kadir], { resolvedPhotoUrl: '/fallback.png', showSeasonContext: true });
  const html = el.outerHTML;
  // Brazil 1. is a calendar-year league: season stays "2026", not sliced to 2 digits.
  expect(html).toContain('2026 | VS CF | BRA1');
  el.remove();
  console.log('[quick card tag] Kadir on:', html.match(/2026 \| VS[^<]*/)[0]);
});
