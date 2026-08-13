// Player photo naming — the single source of truth for the whole app.
//
// This is a character-for-character port of safe_filename() in
// Scouting-Hub/download_photos.py (lines 74-88). That function is the one that
// actually NAMES the 43,036 files in the scouting-photos repo, so it — not any
// convention we might prefer — defines what a correct URL looks like.
// photo_utils.py (the Streamlit read path) reimplements those same two lines,
// which is why Streamlit and disk can never disagree.
//
// Previously five files each defined their own slugN()/photoUrl() (utils.js,
// cardAssets.js, QuickCard.js, PlayerOnePager.js, PlayerScoutingCard.js) and all
// five diverged from Python in three ways, leaving 2,562 players with a photo on
// disk that the app requested at the wrong URL and rendered as /fallback.png:
//
//   1. Single-token names   "Neymar"        -> js: neymar_neymar__santos  (404)
//                                              py: neymar__santos         (real)
//   2. Multi-word surnames  "R. Van Cruijsen" -> js: r_vancruijsen__…     (404)
//                                                py: r_van_cruijsen__…    (real)
//   3. Transliteration      Lillestrøm      -> js: …__lillestrom          (404)
//                                              py: …__lillestrm           (real)
//
// DO NOT reintroduce the old slugN() explicit character map (ø->o, ß->ss, æ->ae,
// …). It reads like an improvement and is the opposite. Python's _norm() does
// NFKD then .encode("ascii","ignore"), which DROPS letters that have no
// canonical decomposition instead of transliterating them. On disk that really
// is "lillestrm", "frele" (Freßle) and "groaspach" (Großaspach). Matching disk
// means dropping, not transliterating. The old comment in cardAssets.js claiming
// the character map "matters" had it exactly backwards.

export const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';

// Python:
//   def _norm(s):
//       if not s: return ""
//       s = unicodedata.normalize("NFKD", str(s)).encode("ascii","ignore").decode("ascii")
//       return " ".join(s.strip().lower().split())
function _norm(s) {
  if (!s) return '';
  // NFKD, then drop every non-ASCII codepoint — the .encode("ascii","ignore") step.
  const ascii = String(s).normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  // Python's bare .split() splits on any run of whitespace AND discards empties,
  // so the filter(Boolean) is load-bearing, not defensive.
  return ascii.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

// Python: "_".join(re.sub(r"[^a-z0-9 ]","",_norm(x)).split()) or "unknown"
// Note the space inside the character class: spaces survive the strip and become
// the underscores, which is why "R. Van Cruijsen" keeps its word boundaries.
function _part(s) {
  return _norm(s).replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean).join('_') || 'unknown';
}

// Python: f"{p}__{t}" — no extension; callers append ".png".
export function safeFilename(player, team) {
  return `${_part(player)}__${_part(team)}`;
}

export function photoUrl(name, team) {
  // Preserved from the old utils.js photoUrl: a blank name short-circuits to the
  // local fallback rather than requesting the (guaranteed 404) "unknown__team"
  // URL. This is the one intentional deviation from safe_filename, and it only
  // affects a case Python never has to render.
  if (!String(name || '').trim()) return '/fallback.png';
  return `${PHOTO_BASE}${safeFilename(name, team)}.png`;
}
