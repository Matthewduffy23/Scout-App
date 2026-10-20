// Archetype config — scatter colouring only. Does NOT touch the Style
// Hexagon (QC_ROLES in Pipeline/build_players.py) or any score QuickCard/
// PlayerPager show. Every role weight, threshold, hybrid pair, name and
// colour for every position lives here so it can be tweaked without
// touching src/archetypeEngine.js's logic.
//
// Role entries (resolved by archetypeEngine.js's resolveRoleDef):
//   { hexagon: 'Role Name' }   — reuse qcRoleCareerScores[key] as-is (unchanged hexagon formula)
//   { weights: {...} }         — recompute fresh from per-season raw percentiles (refined/fixed weights)
//   { maxOf: [def, def, ...] } — resolve each sub-def independently, take the max (any mix of the above)
//
// mainTypes: the subset of `roles` that can themselves become the
// "dominant" archetype / get their own legend entry+colour. A role can
// exist in `roles` but NOT `mainTypes` — it's still computed and can feed
// a hybrid or the Complete/Generalist counts, it just never becomes a
// standalone label (ATT's Creator: trimmed 2026-10-20, "keep it as an
// input for hybrids").
//
// Quadrant: Feature Q formulas, verbatim from the matching Scouting-Hub page
// (metric names are Wyscout column names, identical convention to QC_ROLES).
//
// Classification thresholds: dominantThreshold / hybridThreshold (2-role gap
// <8, 3-role spread <=10) are per-position; completeThreshold defaults to
// COMPLETE_THRESHOLD (75) and can be overridden per position (ATT: 80);
// completeMinRoles (3), generalistThreshold (50), generalistMinRoles (3)
// are the same across every position.
//
// Colours — two independent schemes, chosen in the UI via the Simple/
// Detailed toggle (archetype colour mode only; everything else in the
// cascade above is unaffected by which one is picked):
//
// Detailed: every archetype in a position gets its own colour from
// DETAILED_SWATCHES below — a fixed full-colour-wheel palette (2026-10-20),
// not constrained to stay near the archetype's Simple family hue. Complete
// = white, Generalist = warm taupe, No clear profile = grey — reserved
// across every position, never reassigned to an archetype.
//
// Simple: every archetype collapses into one of five colour "families"
// (red/blue/orange/green/purple) with the SAME hue meaning in every
// position (red=defending, blue=passing/creating, orange=goal threat/
// attacking, green=carrying/running, purple=aerial/physical), plus White=
// Complete, warm taupe=Generalist, grey=No clear profile (Generalist
// shares the same taupe in both modes — see GENERALIST_COLOR, chosen so it
// reads clearly against white/grey/yellow/orange). Each position's
// `simple.family` map says which family every surviving archetype belongs
// to; `simple.labels` gives that position's own word for each family used
// (e.g. CM's red family is labelled "Defensive").
export const COMPLETE_COLOR = '#f8fafc';   // white — most eye-catching, every position
export const GENERALIST_COLOR = '#b08d6a'; // warm taupe — every position, both modes (2026-10-20: the light grey was too close to white/Complete)
export const NONE_COLOR = '#64748b';       // grey, every position, both modes

export const FAMILY_COLOR = {
  red: '#ef4444',
  blue: '#3b82f6',
  orange: '#f97316',
  green: '#22c55e',
  purple: '#a855f7',
  complete: COMPLETE_COLOR,
  generalist: GENERALIST_COLOR,
  none: NONE_COLOR,
};

// Final Detailed-mode swatch list per position (archetype name -> hex),
// 2026-10-20: a fixed full-colour-wheel palette per position, specified
// directly rather than searched/constrained to each archetype's Simple
// family hue (that constraint is dropped for Detailed — Simple mode is
// unaffected and still uses FAMILY_COLOR above).
const DETAILED_SWATCHES = {
  GK: {
    'Shot Stopper': '#EF4444',
    'Sweeper': '#22C55E',
    'Distributor': '#3B82F6',
    'Shot-Stopping Sweeper': '#FACC15',
    'Ball-Playing Stopper': '#D946EF',
  },
  CB: {
    'Aggressor': '#EF4444',
    'Stopper': '#F97316',
    'Aerial': '#8B5CF6',
    'Composed Passer': '#22D3EE',
    'Line-Breaker': '#3B82F6',
    'Ball Carrier': '#22C55E',
    'Build-Up Specialist': '#F472B6',
    'Dominant Defender': '#FACC15',
  },
  FB: {
    'Defensive': '#EF4444',
    'Playmaker': '#3B82F6',
    'Wide Creator': '#F97316',
    'Wide Carrier': '#22C55E',
    'All-Phase Playmaker': '#D946EF',
  },
  CM: {
    'Ball-Winner': '#EF4444',
    'Anchor': '#F472B6',
    'DLP': '#22D3EE',
    'Playmaker': '#3B82F6',
    'Attacking Midfielder': '#FACC15',
    'Ball Carrier': '#22C55E',
    'All-Phase Passer': '#8B5CF6',
  },
  ATT: {
    'Goal Threat': '#EF4444',
    'Dribbling-Finisher': '#F97316',
    'Wide Playmaker': '#FACC15',
    'Dribbler': '#22C55E',
    'Sustainer': '#22D3EE',
    'Deep Playmaker': '#3B82F6',
    'Roaming Playmaker': '#8B5CF6',
  },
  CF: {
    'Goal Threat': '#EF4444',
    'Target Forward': '#8B5CF6',
    'Playmaking Forward': '#3B82F6',
    'Creative Dribbler': '#22D3EE',
    'Dribbler': '#22C55E',
  },
};

export const ARCHETYPE_CONFIG = {
  GK: {
    completeLabel: 'Complete Keeper',
    dominantThreshold: 60,
    hybridThreshold: 58,
    // Complete, added 2026-10-20: 3+ roles >=75 (below) is no longer enough
    // on its own — at least one of those roles must come from EACH side
    // here (fixed 75 bar, independent of completeThreshold), so a player
    // can't be "Complete" purely on one kind of strength (e.g. a CB high
    // only in Aggressor/Stopper/Aerial). Sides match this position's own
    // Feature Q axis THEME, not the literal quadrant weight formula.
    completeSides: { a: ['Shot Stopper', 'Sweeper'], b: ['Distributor'] }, // Goalkeeping vs Possession
    roles: {
      'Shot Stopper': { hexagon: 'Shot Stopper' },
      'Sweeper': { hexagon: 'Sweeper' },
      // Renamed 2026-10-20 (display name only — still reuses the hexagon's
      // own "Passing" formula unchanged, qc['Passing']).
      'Distributor': { hexagon: 'Passing' },
      // Fire Fighter removed 2026-10-20 — players fall back to their
      // next-best type.
    },
    quadrant: {
      x: { label: 'Possession', w: { 'Passes per 90': 0.25, 'Accurate passes, %': 0.5, 'Accurate long passes, %': 0.25 } },
      y: { label: 'Goalkeeping', w: { 'Prevented goals per 90': 0.8, 'Save rate, %': 0.2 } },
      // "Complete" renamed "All-Round" (scatter only) — "Complete" is
      // reserved for the Complete [Position] archetype tier.
      names: { both: 'All-Round', yOnly: 'Shot Stopper', xOnly: 'Ball Player', neither: 'Limited' },
    },
    hybrids: [
      { roles: ['Shot Stopper', 'Sweeper'], name: 'Shot-Stopping Sweeper' }, // renamed from "Modern Keeper"
      { roles: ['Distributor', 'Shot Stopper'], name: 'Ball-Playing Stopper' },
    ],
    simple: {
      family: { 'Shot Stopper': 'red', 'Sweeper': 'green', 'Shot-Stopping Sweeper': 'green', 'Distributor': 'blue', 'Ball-Playing Stopper': 'blue' },
      labels: { red: 'Shot Stopping', green: 'Sweeping', blue: 'Distribution' },
    },
  },

  CB: {
    completeLabel: 'Complete Centre-Back',
    dominantThreshold: 65,
    hybridThreshold: 60,
    completeSides: { a: ['Aggressor', 'Stopper', 'Aerial'], b: ['Composed Passer', 'Line-Breaker', 'Ball Carrier'] }, // Defensive vs Possession
    roles: {
      // Un-merged 2026-10-20 back into the two original hexagon roles —
      // the merge (score = max of the two) didn't earn its keep as a
      // single type.
      'Composed Passer': { hexagon: 'Ball Player' },
      'Line-Breaker': { hexagon: 'Progresser' },
      'Ball Carrier': { hexagon: 'Ball Carrier' },
      'Aerial': { hexagon: 'Aerial' },
      'Aggressor': { hexagon: 'Aggressor' },
      'Stopper': { hexagon: 'Stopper' },
    },
    quadrant: {
      x: { label: 'Possession', w: { 'Passes per 90': 0.1, 'Forward passes per 90': 0.1, 'Progressive passes per 90': 0.25, 'Dribbles per 90': 0.1, 'Progressive runs per 90': 0.2, 'Accurate passes, %': 0.15, 'Accurate long passes, %': 0.1 } },
      y: { label: 'Defensive', w: { 'Defensive duels per 90': 0.1, 'Defensive duels won, %': 0.3, 'PAdj Interceptions': 0.2, 'Aerial duels won, %': 0.3, 'Shots blocked per 90': 0.1 } },
      names: { both: 'All-Round', yOnly: 'Box-Defender', xOnly: 'Ball Player', neither: 'Limited' },
    },
    hybrids: [
      { roles: ['Aerial', 'Stopper'], name: 'Dominant Defender' },
      { roles: ['Line-Breaker', 'Ball Carrier'], name: 'Build-Up Specialist' }, // no longer pairs with Composed Passer
    ],
    simple: {
      family: { 'Aggressor': 'red', 'Stopper': 'red', 'Dominant Defender': 'red', 'Aerial': 'purple', 'Composed Passer': 'blue', 'Line-Breaker': 'blue', 'Build-Up Specialist': 'blue', 'Ball Carrier': 'green' },
      labels: { red: 'Defending', purple: 'Aerial', blue: 'Passing', green: 'Carrier' },
    },
  },

  FB: {
    completeLabel: 'Complete Full-Back',
    dominantThreshold: 60,
    hybridThreshold: 58,
    completeSides: { a: ['Defensive'], b: ['Playmaker', 'Wide Carrier', 'Wide Creator'] }, // Defensive vs Possession
    roles: {
      'Playmaker': { hexagon: 'Playmaker' },
      // Renamed from "Flyer" 2026-10-20 (display name only, same hexagon
      // formula).
      'Wide Carrier': { hexagon: 'Flyer' },
      'Wide Creator': { hexagon: 'Wide Creator' },
      'Defensive': { hexagon: 'Defensive' },
      // Wingback removed 2026-10-20 — players fall back to their next-best
      // type.
    },
    quadrant: {
      x: { label: 'Possession', w: { 'Passes per 90': 0.1, 'Crosses per 90': 0.1, 'Forward passes per 90': 0.1, 'Progressive passes per 90': 0.2, 'xA per 90': 0.1, 'Dribbles per 90': 0.1, 'Progressive runs per 90': 0.2, 'Passes to penalty area per 90': 0.1 } },
      y: { label: 'Defensive', w: { 'Defensive duels per 90': 0.4, 'Defensive duels won, %': 0.3, 'PAdj Interceptions': 0.2, 'Shots blocked per 90': 0.1 } },
      names: { both: 'Two-Way', yOnly: 'Lockdown', xOnly: 'Build-Up', neither: 'Limited' },
    },
    hybrids: [
      // All-Action Wingback removed along with Wingback.
      { roles: ['Playmaker', 'Wide Creator'], name: 'All-Phase Playmaker' },
    ],
    simple: {
      family: { 'Defensive': 'red', 'Playmaker': 'blue', 'Wide Creator': 'blue', 'All-Phase Playmaker': 'blue', 'Wide Carrier': 'green' },
      labels: { red: 'Defensive', blue: 'Creating', green: 'Carrier' },
    },
  },

  CM: {
    completeLabel: 'Complete Midfielder',
    dominantThreshold: 65,
    hybridThreshold: 60,
    completeSides: { a: ['Ball-Winner', 'Anchor'], b: ['DLP', 'Playmaker', 'Attacking Midfielder', 'Ball Carrier'] }, // Defensive vs Possession
    roles: {
      // Hexagon-exact (2026-10-20 — was a "refined" custom weight set that
      // quietly dropped 'Passes per 90'/'Accurate passes, %' vs the real
      // hexagon DLP; see the hexagon-audit this round). Matching the
      // QuickCard formula exactly means the scatter can never contradict
      // the card.
      'DLP': { hexagon: 'DLP' },
      'Playmaker': { hexagon: 'Playmaker' },
      // Hexagon-exact (2026-10-20 — previously recomputed fresh from the
      // same weights as a methodological-consistency exercise; switched to
      // reading qc['Ball-Winner'] directly so it can never drift from the
      // hexagon even if one side's weights change later).
      'Ball-Winner': { hexagon: 'Ball-Winner' },
      // Hexagon-exact (2026-10-20 — was a custom "refined" formula that
      // dropped the hexagon's duel-volume/aerial% weight and added Shots
      // Blocked, which isn't in the hexagon Anchor formula at all. That
      // mismatch is what let a player (e.g. G. Franco, Swansea 2025-26) show
      // as scatter-Anchor while the QuickCard hexagon had Ball-Winner on top
      // and Anchor/Destroyer not even in the top 6 — confirmed by this
      // round's hexagon audit at 13.7% CM top-role disagreement, almost all
      // of it this one role. The pipeline relabels this hexagon role to
      // "Destroyer" (apply_anchor_destroyer_relabel) once a player's
      // Touches-in-box percentile clears 30 — same formula/score either
      // way, just a different qc key — so this reads whichever of the two
      // keys is actually present (a player only ever has one).
      'Anchor': { maxOf: [{ hexagon: 'Anchor' }, { hexagon: 'Destroyer' }] },
      // Folds Box-Crasher in via max(), per the original CM spec.
      'Attacking Midfielder': { maxOf: [{ hexagon: 'Attacking Midfielder' }, { hexagon: 'Box-Crasher' }] },
      'Ball Carrier': { hexagon: 'Ball Carrier' },
      // Box-to-Box removed entirely 2026-10-20 (trim) — not kept even as a
      // hidden hybrid input; no remaining hybrid references it.
    },
    quadrant: {
      // Unchanged from the already-shipped CM axes — moved here verbatim.
      x: { label: 'Possession Score', w: { 'Passes per 90': 0.2, 'Accurate passes, %': 0.1, 'Forward passes per 90': 0.2, 'Progressive passes per 90': 0.2, 'xA per 90': 0.1, 'Key passes per 90': 0.1, 'Passes to penalty area per 90': 0.1 } },
      y: { label: 'Defensive Score', w: { 'Defensive duels per 90': 0.4, 'Defensive duels won, %': 0.3, 'PAdj Interceptions': 0.2, 'Shots blocked per 90': 0.1 } },
      names: { both: 'All Action', yOnly: 'Defensive', xOnly: 'Playmaker', neither: 'Limited' },
    },
    hybrids: [
      { roles: ['DLP', 'Playmaker'], name: 'All-Phase Passer' },
      // Creative Box Threat and Regista removed 2026-10-20 — players fall
      // back to their next-best type (for the old Creative Box Threat
      // pair, that's whichever of Attacking Midfielder / Playmaker scores
      // higher).
    ],
    // Fallback-only type, added 2026-10-20: NOT in `roles`/`mainTypes` — it
    // never competes in the normal cascade (can't feed Complete/Generalist,
    // can't be a hybrid, can't out-rank DLP/Playmaker/All-Phase Passer/
    // anything else). Applied by classifyArchetypeWithFallback() only when
    // the normal cascade already returned "No clear profile": if this
    // player's Controller score (exact hexagon formula, via qc['Controller']
    // — same number the QuickCard shows, name unchanged there) is >=
    // threshold AND is their single highest score of any kind (including
    // the roles above), they get labelled "Safe Circulator" — renamed
    // 2026-10-20, scatter display only, QuickCard keeps calling it
    // Controller — instead of grey. Threshold is 60 (checked against the
    // >8%-of-CMs trigger on 2026-10-20: overall came back 3.68%, kept at 60
    // — the only subset that cleared 8% was PL 2025-26 specifically, off a
    // 23-player sample).
    fallbackRole: { name: 'Safe Circulator', def: { hexagon: 'Controller' }, threshold: 60, color: '#14b8a6', simpleFamily: 'blue' },
    simple: {
      family: { 'Ball-Winner': 'red', 'Anchor': 'red', 'DLP': 'blue', 'Playmaker': 'blue', 'All-Phase Passer': 'blue', 'Attacking Midfielder': 'orange', 'Ball Carrier': 'green', 'Safe Circulator': 'blue' },
      labels: { red: 'Defensive', blue: 'Passing', orange: 'Attacking', green: 'Carrier' },
    },
  },

  ATT: {
    completeLabel: 'Complete Attacker',
    completeThreshold: 80, // override: ATT uses 3+ roles >=80 (every other position uses the default 75)
    dominantThreshold: 65,
    hybridThreshold: 60,
    completeSides: { a: ['Goal Threat'], b: ['Deep Playmaker', 'Dribbler', 'Wide Playmaker', 'Sustainer', 'Creator'] }, // Threat vs Possession
    roles: {
      'Deep Playmaker': { hexagon: 'Deep Playmaker' },
      'Goal Threat': { hexagon: 'Goal Threat' },
      'Dribbler': { hexagon: 'Dribbler' },
      'Wide Playmaker': { hexagon: 'Wide Playmaker' },
      'Sustainer': { hexagon: 'Sustainer' },
      // Trimmed 2026-10-20: no longer a main type (can't itself be the
      // "dominant" archetype or get a legend entry) — still computed and
      // still feeds Creative Hub below, and still counts toward
      // Complete/Generalist, same as any other role score.
      'Creator': { hexagon: 'Creator' },
    },
    mainTypes: ['Deep Playmaker', 'Goal Threat', 'Dribbler', 'Wide Playmaker', 'Sustainer'],
    quadrant: {
      x: { label: 'Possession', w: { 'Smart passes per 90': 0.1, 'Dribbles per 90': 0.3, 'Deep completions per 90': 0.1, 'Progressive runs per 90': 0.2, 'Passes to penalty area per 90': 0.3 } },
      y: { label: 'Threat', w: { 'xG per 90': 0.3, 'Non-penalty goals per 90': 0.4, 'xA per 90': 0.3 } },
      names: { both: 'Multi-Threat', yOnly: 'Final Action', xOnly: 'Facilitator', neither: 'Limited' },
    },
    hybrids: [
      // Traditional Winger removed 2026-10-20 — players fall back to their
      // next-best type.
      { roles: ['Creator', 'Deep Playmaker'], name: 'Roaming Playmaker' }, // renamed from "Creative Hub" (itself renamed from "Complete Playmaker" — "Complete" is reserved for the tier-a label)
      { roles: ['Goal Threat', 'Dribbler'], name: 'Dribbling-Finisher' },
    ],
    simple: {
      family: { 'Deep Playmaker': 'blue', 'Roaming Playmaker': 'blue', 'Sustainer': 'blue', 'Goal Threat': 'orange', 'Dribbling-Finisher': 'orange', 'Dribbler': 'green', 'Wide Playmaker': 'purple' },
      labels: { blue: 'Creating', orange: 'Attacking', green: 'Carrier', purple: 'Wide Threat' },
    },
  },

  CF: {
    completeLabel: 'Complete Forward',
    dominantThreshold: 65,
    hybridThreshold: 60,
    completeSides: { a: ['Goal Threat'], b: ['Target Forward', 'Dribbler', 'Playmaking Forward'] }, // Threat vs Possession
    roles: {
      'Target Forward': { hexagon: 'Target Forward' },
      'Goal Threat': { hexagon: 'Goal Threat' },
      'Dribbler': { hexagon: 'Dribbler' },
      // Pressing Forward removed 2026-10-20 — players fall back to their
      // next-best type.
      // Trimmed 2026-10-20: Chance Creator merged into False 9 (score = max
      // of the two) — Chance Creator was a single metric (xA) that was a
      // 100% subset of False 9's own xA weight, not a distinct identity.
      // Renamed "False 9" -> "Playmaking Forward" 2026-10-20 (display name
      // only — still reuses the hexagon's own "False 9" formula via maxOf).
      // Hexagon-exact (2026-10-20 hexagon audit): the Chance Creator side of
      // this max() was a custom {xA:2, Key passes:1} approximation, not the
      // real hexagon Chance Creator ({xA:1} alone) — a high-xA, average-key-
      // passes player (mostly young/small-sample CFs) could show hexagon
      // Chance Creator as their clear #1 while the scatter ranked
      // Playmaking Forward below Dribbler/Target Forward/Goal Threat.
      'Playmaking Forward': { maxOf: [{ hexagon: 'False 9' }, { hexagon: 'Chance Creator' }] },
    },
    quadrant: {
      x: { label: 'Possession', w: { 'xA per 90': 0.2, 'Dribbles per 90': 0.3, 'Aerial duels won, %': 0.1, 'Progressive runs per 90': 0.2, 'Accurate passes, %': 0.1, 'Passes to penalty area per 90': 0.1 } },
      y: { label: 'Threat', w: { 'xG per 90': 0.4, 'Non-penalty goals per 90': 0.6 } },
      names: { both: 'All-Round', yOnly: 'Poacher', xOnly: 'Link-Up', neither: 'Limited' },
    },
    hybrids: [
      // Aerial Goal Threat (Goal Threat + Target Forward) removed 2026-10-20
      // — players fall back to their next-best type.
      { roles: ['Playmaking Forward', 'Dribbler'], name: 'Creative Dribbler' },
    ],
    simple: {
      family: { 'Goal Threat': 'orange', 'Target Forward': 'purple', 'Playmaking Forward': 'blue', 'Creative Dribbler': 'blue', 'Dribbler': 'green' },
      labels: { orange: 'Attacking', purple: 'Aerial', blue: 'Creating', green: 'Carrier' },
    },
  },
};

// Shared classification constants (same across every position unless a
// position overrides completeThreshold — see ATT above).
export const COMPLETE_THRESHOLD = 75;
export const COMPLETE_MIN_ROLES = 3;
export const GENERALIST_THRESHOLD = 50;
export const GENERALIST_MIN_ROLES = 3;
export const HYBRID_2_GAP = 8;
export const HYBRID_3_SPREAD = 10;
// "Leaning" (2026-10-20, every position, applied after the fallback-role
// step above): a player who still has no archetype gets labelled with
// their single highest-scoring role (including a position's fallbackRole,
// e.g. CM's Controller, if it has one) when that score is >= this bar —
// same colour as that role, just faded, never a separate legend entry or
// its own classification "kind" beyond the opacity treatment.
export const LEANING_THRESHOLD = 55;

// Detailed colours, from this position's DETAILED_SWATCHES plus the three
// reserved colours. A role present in `roles` but not `mainTypes` (ATT's
// Creator) gets no colour — it never becomes a dot colour or legend entry
// on its own. Simple colours/labels: every mainType/hybrid maps through
// `simple.family` to one of the five shared family colours, plus the three
// reserved Simple-mode colours (Complete/Generalist/None — Generalist's
// Simple colour is its own light grey, not Detailed's gold).
for (const [pos, cfg] of Object.entries(ARCHETYPE_CONFIG)) {
  if (!cfg.mainTypes) cfg.mainTypes = Object.keys(cfg.roles);
  const hybridNames = cfg.hybrids.map(h => h.name);
  cfg.colors = {
    [cfg.completeLabel]: COMPLETE_COLOR,
    Generalist: GENERALIST_COLOR,
    'No clear profile': NONE_COLOR,
    ...DETAILED_SWATCHES[pos],
  };
  if (cfg.fallbackRole) cfg.colors[cfg.fallbackRole.name] = cfg.fallbackRole.color;
  cfg.hybridNames = hybridNames;

  const { family, labels } = cfg.simple;
  cfg.simpleColors = {
    [cfg.completeLabel]: FAMILY_COLOR.complete,
    Generalist: FAMILY_COLOR.generalist,
    'No clear profile': FAMILY_COLOR.none,
  };
  cfg.simpleLabelOf = { [cfg.completeLabel]: 'Complete', Generalist: 'Generalist', 'No clear profile': 'No clear profile' };
  for (const name of [...cfg.mainTypes, ...hybridNames]) {
    const token = family[name];
    cfg.simpleColors[name] = FAMILY_COLOR[token];
    cfg.simpleLabelOf[name] = labels[token];
  }
  if (cfg.fallbackRole) {
    const token = cfg.fallbackRole.simpleFamily;
    cfg.simpleColors[cfg.fallbackRole.name] = FAMILY_COLOR[token];
    cfg.simpleLabelOf[cfg.fallbackRole.name] = labels[token];
  }
  // Legend building needs the reverse too: family token -> {label, color},
  // in a stable family order (shared across positions where present).
  const order = ['red', 'blue', 'orange', 'green', 'purple'];
  const familiesUsed = new Set(Object.values(family));
  if (cfg.fallbackRole) familiesUsed.add(cfg.fallbackRole.simpleFamily);
  cfg.simpleFamilies = order.filter(t => familiesUsed.has(t)).map(t => ({ key: t, label: labels[t], color: FAMILY_COLOR[t] }));
}
