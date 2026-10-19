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
// Colours: reserved across every position — Complete = white (most eye-
// catching, maximum contrast on the dark background, and reserved for the
// Complete [Position] tier only as of 2026-10-20 — no hybrid or quadrant
// corner is named bare "Complete" any more), Generalist = sand/gold, No
// clear profile = grey (smaller dot, no change). Main types and hybrids
// draw from a shared 12-colour categorical palette, assigned in listed
// order per position.

export const ARCHETYPE_PALETTE = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#b45309', // brown/amber-dark
];
export const COMPLETE_COLOR = '#f8fafc';   // white — most eye-catching, every position
export const GENERALIST_COLOR = '#ca8a04'; // sand/gold — every position
export const NONE_COLOR = '#64748b';       // grey, smaller dot — every position

function assignColors(mainTypes, hybridNames) {
  const all = [...mainTypes, ...hybridNames];
  const colors = {};
  all.forEach((name, i) => { colors[name] = ARCHETYPE_PALETTE[i % ARCHETYPE_PALETTE.length]; });
  return colors;
}

export const ARCHETYPE_CONFIG = {
  GK: {
    completeLabel: 'Complete Keeper',
    dominantThreshold: 60,
    hybridThreshold: 58,
    roles: {
      'Shot Stopper': { hexagon: 'Shot Stopper' },
      'Sweeper': { hexagon: 'Sweeper' },
      'Passing': { hexagon: 'Passing' },
      // Fixed (archetype-only): xG against per 90 is globally inverted
      // (GK_INVERSE) so it already means "low xG against = good", clashing
      // conceptually with the raw-volume 'Shots against per 90'. Swapped
      // for Prevented goals per 90 (non-inverted, "performed better than
      // expected") — a busy keeper who also outperforms his xG.
      'Fire Fighter': { weights: { 'Shots against per 90': 1, 'Prevented goals per 90': 1 } },
    },
    quadrant: {
      x: { label: 'Possession', w: { 'Passes per 90': 0.25, 'Accurate passes, %': 0.5, 'Accurate long passes, %': 0.25 } },
      y: { label: 'Goalkeeping', w: { 'Prevented goals per 90': 0.8, 'Save rate, %': 0.2 } },
      // "Complete" renamed "All-Round" (scatter only) — "Complete" is
      // reserved for the Complete [Position] archetype tier.
      names: { both: 'All-Round', yOnly: 'Shot Stopper', xOnly: 'Ball Player', neither: 'Limited' },
    },
    hybrids: [
      { roles: ['Shot Stopper', 'Sweeper'], name: 'Modern Keeper' },
      { roles: ['Passing', 'Shot Stopper'], name: 'Ball-Playing Stopper' },
    ],
  },

  CB: {
    completeLabel: 'Complete Centre-Back',
    dominantThreshold: 65,
    hybridThreshold: 60,
    roles: {
      // Trimmed 2026-10-20: Ball Player + Progresser merged into one type
      // (score = max of the two hexagon roles) — they were two flavours of
      // the same "composed on the ball" signal.
      'Ball-Playing CB': { maxOf: [{ hexagon: 'Ball Player' }, { hexagon: 'Progresser' }] },
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
      { roles: ['Ball-Playing CB', 'Ball Carrier'], name: 'Build-Up Specialist' },
    ],
  },

  FB: {
    completeLabel: 'Complete Full-Back',
    dominantThreshold: 60,
    hybridThreshold: 58,
    roles: {
      'Playmaker': { hexagon: 'Playmaker' },
      'Flyer': { hexagon: 'Flyer' },
      'Wide Creator': { hexagon: 'Wide Creator' },
      'Defensive': { hexagon: 'Defensive' },
      // Fixed (archetype-only): was a 100% metric subset of Wide Creator's
      // superset (shared Crosses + xA). Dropped xA/Crosses — now "gets
      // forward and arrives in the box," no creation signal.
      'Wingback': { weights: { 'Dribbles per 90': 2, 'Touches in box per 90': 3 } },
    },
    quadrant: {
      x: { label: 'Possession', w: { 'Passes per 90': 0.1, 'Crosses per 90': 0.1, 'Forward passes per 90': 0.1, 'Progressive passes per 90': 0.2, 'xA per 90': 0.1, 'Dribbles per 90': 0.1, 'Progressive runs per 90': 0.2, 'Passes to penalty area per 90': 0.1 } },
      y: { label: 'Defensive', w: { 'Defensive duels per 90': 0.4, 'Defensive duels won, %': 0.3, 'PAdj Interceptions': 0.2, 'Shots blocked per 90': 0.1 } },
      names: { both: 'Two-Way', yOnly: 'Lockdown', xOnly: 'Build-Up', neither: 'Limited' },
    },
    hybrids: [
      { roles: ['Flyer', 'Wingback'], name: 'All-Action Wingback' },
      { roles: ['Playmaker', 'Wide Creator'], name: 'All-Phase Playmaker' },
    ],
  },

  CM: {
    completeLabel: 'Complete Midfielder',
    dominantThreshold: 65,
    hybridThreshold: 60,
    roles: {
      // Refined (archetype-only): hexagon Deep Playmaker CM minus the two
      // generic-passing metrics ('Passes per 90', 'Accurate passes, %')
      // that overlapped with a since-removed Tempo-Setter type.
      'DLP': { weights: { 'Forward passes per 90': 2, 'Progressive passes per 90': 3, 'Passes to final third per 90': 2.5, 'Accurate forward passes, %': 1.5, 'Accurate long passes, %': 1 } },
      'Playmaker': { hexagon: 'Playmaker' },
      // Re-derived via the same fresh-percentile method as DLP/Anchor for
      // methodological consistency, even though the weights are identical
      // to the hexagon's Ball-Winner.
      'Ball-Winner': { weights: { 'Defensive duels per 90': 3, 'Defensive duels won, %': 2 } },
      // Refined (archetype-only): duel volume and Aerial duels won % dropped
      // entirely — the thing that made it overlap with Ball-Winner.
      'Anchor': { weights: { 'PAdj Interceptions': 3, 'Shots blocked per 90': 2, 'Defensive duels won, %': 1 } },
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
      { roles: ['Attacking Midfielder', 'Playmaker'], name: 'Creative Box Threat' },
      { roles: ['Anchor', 'DLP'], name: 'Regista' },
    ],
  },

  ATT: {
    completeLabel: 'Complete Attacker',
    completeThreshold: 80, // override: ATT uses 3+ roles >=80 (every other position uses the default 75)
    dominantThreshold: 65,
    hybridThreshold: 60,
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
      { roles: ['Dribbler', 'Wide Playmaker'], name: 'Traditional Winger' },
      { roles: ['Creator', 'Deep Playmaker'], name: 'Creative Hub' }, // renamed from "Complete Playmaker" — "Complete" is reserved for the tier-a label now
      { roles: ['Goal Threat', 'Dribbler'], name: 'Dribbling-Finisher' },
    ],
  },

  CF: {
    completeLabel: 'Complete Forward',
    dominantThreshold: 65,
    hybridThreshold: 60,
    roles: {
      'Target Forward': { hexagon: 'Target Forward' },
      'Goal Threat': { hexagon: 'Goal Threat' },
      'Dribbler': { hexagon: 'Dribbler' },
      'Pressing Forward': { hexagon: 'Pressing Forward' },
      // Trimmed 2026-10-20: Chance Creator merged into False 9 (score = max
      // of the two) — Chance Creator was a single metric (xA) that was a
      // 100% subset of False 9's own xA weight, not a distinct identity.
      'False 9': { maxOf: [{ hexagon: 'False 9' }, { weights: { 'xA per 90': 2, 'Key passes per 90': 1 } }] },
    },
    quadrant: {
      x: { label: 'Possession', w: { 'xA per 90': 0.2, 'Dribbles per 90': 0.3, 'Aerial duels won, %': 0.1, 'Progressive runs per 90': 0.2, 'Accurate passes, %': 0.1, 'Passes to penalty area per 90': 0.1 } },
      y: { label: 'Threat', w: { 'xG per 90': 0.4, 'Non-penalty goals per 90': 0.6 } },
      names: { both: 'All-Round', yOnly: 'Poacher', xOnly: 'Link-Up', neither: 'Limited' },
    },
    hybrids: [
      { roles: ['Goal Threat', 'Target Forward'], name: 'Aerial Goal Threat' },
      { roles: ['False 9', 'Dribbler'], name: 'Creative Dribbler' },
    ],
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

// Colours, assigned once per position (mainTypes order, then hybrid order
// as listed above) from the shared palette, plus the three reserved colours.
// A role present in `roles` but not `mainTypes` (ATT's Creator) gets no
// colour — it never becomes a dot colour or legend entry on its own.
for (const [pos, cfg] of Object.entries(ARCHETYPE_CONFIG)) {
  if (!cfg.mainTypes) cfg.mainTypes = Object.keys(cfg.roles);
  const hybridNames = cfg.hybrids.map(h => h.name);
  cfg.colors = {
    [cfg.completeLabel]: COMPLETE_COLOR,
    Generalist: GENERALIST_COLOR,
    'No clear profile': NONE_COLOR,
    ...assignColors(cfg.mainTypes, hybridNames),
  };
  cfg.hybridNames = hybridNames;
}
