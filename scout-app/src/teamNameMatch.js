// Club name -> crest, for names typed/pasted by hand (Custom Scatter).
// Same crest source as TeamCard (cardAssets: TEAM_FOTMOB_MAP -> CREST_BASE/<id>.png).
// Order: exact map key -> known short form -> normalised name -> unique "name is
// contained in one club" -> closest spelling (strict cutoff + clear winner).
// Anything not confident returns null, so the chart shows a plain dot.
import { TEAM_FOTMOB_MAP, CREST_BASE } from './cardAssets';

// Words that don't identify a club (dropped from both sides before comparing).
const STRIP = new Set(['fc', 'afc', 'cf', 'sc', 'club', 'cd', 'ac', 'as', 'sv', 'fk', 'sk', 'bk', 'ssc', 'calcio',
  'clube', 'de', 'do', 'da', 'the', 'football', 'futbol', 'futebol', 'ud', 'sd', 'rc', 'rcd', 'ca', 'us', 'vfl', 'vfb',
  'tsg', 'tsv', 'fsv', 'kv', 'krc', 'nk', 'hnk', 'gnk', 'cfc', 'ff', 'if', 'ss', 'ogc', 'losc', 'bc', 'acf', 'sl', 'rsc', 'balompie', 'jk', 'ssd']);
const RESERVE = /^(ii|iii|b|u\d\d|women|w|reserves|youth|academy|jong)$/;
// Words too common to identify a club on their own.
const GENERIC = new Set(['town', 'city', 'united', 'rovers', 'wanderers', 'athletic', 'athletico', 'county', 'real', 'sporting',
  'racing', 'union', 'olympic', 'olympique', 'dynamo', 'dinamo', 'albion', 'borough', 'saint', 'inter', 'atletico', 'deportivo',
  'sport', 'sports', 'fc', 'stars', 'rangers', 'celtic', 'hotspur', 'north', 'south', 'east', 'west', 'end', 'park', 'and', 'xi']);

const ASCII = { 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };
export function foldName(s) {
  return String(s || '').toLowerCase().replace(/[øæœßłđðþı]/g, c => ASCII[c])
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/['’`´.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokensOf(s) {
  const raw = foldName(s).split(' ').filter(Boolean).map(t => (t === 'utd' ? 'united' : t === 'st' ? 'saint' : t));
  const kept = raw.filter(t => !STRIP.has(t) && !/^\d+$/.test(t));
  return kept.length ? kept : raw;
}
export const normName = s => tokensOf(s).join(' ');

// Common short forms -> the club's name in the crest map.
const ALIAS_SRC = {
  'Manchester United': ['man utd', 'man united', 'man u', 'mufc', 'manchester utd'],
  'Manchester City': ['man city', 'mcfc', 'man c'],
  'Wolverhampton Wanderers': ['wolves'],
  'Tottenham Hotspur': ['spurs', 'tottenham', 'thfc'],
  'PSG': ['paris saint germain', 'paris sg', 'paris saint-germain', 'paris st germain'],
  'Internazionale': ['inter', 'inter milan', 'internazionale milano', 'fc internazionale'],
  'Milan': ['ac milan'],
  'Bayer Leverkusen': ['leverkusen', 'bayer 04 leverkusen', 'bayer 04'],
  'Borussia Dortmund': ['dortmund', 'bvb', 'bvb 09'],
  "Borussia M'gladbach": ['gladbach', 'monchengladbach', 'borussia monchengladbach', 'moenchengladbach', 'borussia moenchengladbach', 'bmg', 'mgladbach'],
  'Bayern München': ['bayern', 'bayern munich', 'fc bayern', 'bayern muenchen', 'fcb munich'],
  'Atlético Madrid': ['atleti', 'atletico', 'atl madrid', 'atl. madrid', 'atletico de madrid'],
  'Barcelona': ['barca', 'fc barcelona'],
  'Juventus': ['juve'],
  'Napoli': ['ssc napoli'],
  'Roma': ['as roma'],
  'Sheffield United': ['sheff utd', 'sheff united', 'sheffield u', 'blades'],
  'Sheffield Wednesday': ['sheff wed', 'sheffield wed', 'sheffield weds', 'sheff weds', 'owls'],
  'Queens Park Rangers': ['qpr'],
  'West Bromwich Albion': ['west brom', 'wba', 'west bromwich'],
  'West Ham United': ['west ham', 'whu'],
  'Nottingham Forest': ['forest', 'nottm forest', "nott'm forest", 'notts forest', 'nffc'],
  'Brighton': ['brighton and hove albion', 'brighton & hove albion', 'brighton hove albion', 'bha'],
  'Middlesbrough': ['boro'],
  'Crystal Palace': ['palace'],
  'Aston Villa': ['villa'],
  'Newcastle United': ['newcastle', 'nufc'],
  'Milton Keynes Dons': ['mk dons', 'milton keynes', 'mkd'],
  'Preston North End': ['preston', 'pne', 'preston ne'],
  'Hibernian': ['hibs'],
  'Slavia Praha': ['slavia prague'],
  'Sparta Praha': ['sparta prague'],
  'Legia Warszawa': ['legia warsaw', 'legia'],
  'Rennes': ['stade rennais'],
  'København': ['copenhagen', 'fc copenhagen', 'fck', 'kobenhavn'],
  'CSKA Moskva': ['cska moscow'],
  'Spartak Moskva': ['spartak moscow'],
  'Zenit': ['zenit saint petersburg', 'zenit petersburg'],
  'Dynamo Kyiv': ['dynamo kiev', 'dinamo kiev', 'dynamo kyiv'],
  'Olympique Lyonnais': ['lyon', 'ol lyon', 'olympique lyon'],
  'Olympique Marseille': ['marseille', 'om', 'olympique de marseille'],
  'Olympiacos Piraeus': ['olympiacos', 'olympiakos', 'olympiakos piraeus'],
  'Crvena Zvezda': ['red star', 'red star belgrade', 'crvena zvezda beograd'],
  'Salzburg': ['red bull salzburg', 'rb salzburg', 'fc salzburg'],
  'Hearts': ['heart of midlothian'],
  'Los Angeles Galaxy': ['la galaxy'],
  'AZ': ['az alkmaar'],
  'PSV': ['psv eindhoven'],
  'Sporting CP': ['sporting lisbon', 'sporting portugal'],
  'Real Betis': ['betis'],
  'Bodø / Glimt': ['bodo glimt', 'bodo/glimt', 'glimt'],
  'Athletic Bilbao': ['bilbao', 'athletic club bilbao'],
  'Köln': ['cologne', 'koeln', '1 fc koeln'],
  'Mainz 05': ['mainz'],
  'Saint-Étienne': ['st etienne', 'asse'],
  'Leicester City': ['leicester', 'lcfc'],
  'Huddersfield Town': ['huddersfield'],
};

let IDX = null;
function index() {
  if (IDX) return IDX;
  const byNorm = new Map(), alias = new Map(), entries = [], seen = new Set();
  for (const [key, id] of Object.entries(TEAM_FOTMOB_MAP)) {
    const n = normName(key);
    if (!n) continue;
    if (!byNorm.has(n)) byNorm.set(n, new Map());
    if (!byNorm.get(n).has(id) || (byNorm.get(n).get(id) === byNorm.get(n).get(id).toLowerCase() && key !== key.toLowerCase())) byNorm.get(n).set(id, key);
    const k = n + '|' + id;
    if (seen.has(k)) { // keep the properly cased spelling for display
      const prev = entries.find(e => e.n === n && e.id === id);
      if (prev && prev.key === prev.key.toLowerCase() && key !== key.toLowerCase()) prev.key = key;
      continue;
    }
    seen.add(k);
    const toks = n.split(' ');
    entries.push({ key, id, n, toks, reserve: toks.some(t => RESERVE.test(t)), compact: n.replace(/ /g, '') });
  }
  for (const [canon, list] of Object.entries(ALIAS_SRC)) {
    const id = TEAM_FOTMOB_MAP[canon];
    if (!id) continue;
    for (const a of list) alias.set(normName(a), { id, key: canon });
  }
  IDX = { byNorm, alias, entries };
  return IDX;
}

function bigrams(s) {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
  return m;
}
function dice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a), B = bigrams(b);
  let inter = 0;
  for (const [g, c] of A) inter += Math.min(c, B.get(g) || 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

export const FUZZY_CUTOFF = 0.84;
const FUZZY_MARGIN = 0.08;
const hit = (id, key, how) => ({ id, key, how, url: `${CREST_BASE}${id}.png` });

// -> { id, key (crest-map name), how, url } or null (not confident).
export function matchTeamName(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const exact = TEAM_FOTMOB_MAP[raw] || TEAM_FOTMOB_MAP[raw.toLowerCase()];
  if (exact) return hit(exact, raw, 'exact');
  const { byNorm, alias, entries } = index();
  const n = normName(raw);
  if (!n) return null;
  if (alias.has(n)) { const a = alias.get(n); return hit(a.id, a.key, 'short form'); }
  const same = byNorm.get(n);
  if (same) {
    if (same.size !== 1) return null; // two different clubs normalise the same: don't guess
    const [[id, key]] = [...same];
    return hit(id, key, 'normalised');
  }
  const q = n.split(' ');
  const qReserve = q.some(t => RESERVE.test(t));
  // Contained: every typed word is a word (or a 5+ letter start of one) of exactly one club.
  if (q.join('').length >= 4) {
    const has = (toks, t) => toks.some(k => k === t || (t.length >= 5 && k.startsWith(t)));
    const cands = entries.filter(e => (qReserve || !e.reserve) && e.toks.length - q.length <= 3 && q.every(t => has(e.toks, t)));
    if (cands.length) {
      const min = Math.min(...cands.map(e => e.toks.length));
      const ids = new Set(cands.filter(e => e.toks.length === min).map(e => e.id));
      if (ids.size === 1) { const e = cands.find(c => c.toks.length === min); return hit(e.id, e.key, 'contained'); }
      return null;
    }
    // Typed name carries extra words (e.g. "Ajax Amsterdam"): the one club, with the
    // most words, whose name is wholly inside the typed name.
    const inside = entries.filter(e => !e.reserve && e.toks.some(t => t.length >= 4 && !GENERIC.has(t)) && e.toks.every(t => q.includes(t)));
    if (inside.length) {
      const max = Math.max(...inside.map(e => e.toks.length));
      const top = inside.filter(e => e.toks.length === max), ids = new Set(top.map(e => e.id));
      if (ids.size === 1) return hit(top[0].id, top[0].key, 'contained');
      return null;
    }
  }
  // Closest spelling: high cutoff and a clear winner over any other club.
  const c = n.replace(/ /g, '');
  if (c.length < 5) return null;
  let best = null, bestS = 0, second = 0;
  for (const e of entries) {
    if (e.reserve && !qReserve) continue;
    if (Math.abs(e.compact.length - c.length) > Math.max(3, c.length * 0.35)) continue;
    const s = dice(c, e.compact);
    if (s > bestS) { if (!best || best.id !== e.id) second = bestS; best = e; bestS = s; }
    else if (s > second && e.id !== best.id) second = s;
  }
  if (best && bestS >= FUZZY_CUTOFF && bestS - second >= FUZZY_MARGIN) return { ...hit(best.id, best.key, 'closest'), score: +bestS.toFixed(3) };
  return null;
}

// Manual fixes, saved in this browser: { [normName(raw)]: { team, url } | { none: true } }.
export const BADGE_FIX_KEY = 'scoutIndex.customScatter.badgeFixes.v1';
export function readBadgeFixes() {
  try { const v = JSON.parse(window.localStorage.getItem(BADGE_FIX_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
export function writeBadgeFixes(f) {
  try { window.localStorage.setItem(BADGE_FIX_KEY, JSON.stringify(f)); } catch { /* private mode: fixes last this visit only */ }
}
export const fixKey = raw => foldName(raw);
