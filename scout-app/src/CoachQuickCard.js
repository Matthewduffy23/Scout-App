// CoachQuickCard.js — standalone. A player-QuickCard-style 1920×1080 manager
// card, separate from CoachCard.js. Reuses CoachCard's shared primitives via
// named imports; CoachCard.js itself is unchanged apart from exposing those.
import { computeCoachMetricGroups } from './coachMetrics';
import {
  computeAge, countryToIso2, leagueToCountry, barRowCoach, scoreTierColor,
  teamCrestUrl, fadeHexToBG, FOTMOB_PHOTO_BASE, ensureMontserratEmbedded,
  MONTSERRAT_EMBED_CSS, BG, HEADER_L, HEADER_R, ACCENT_PINK, LABEL_COL,
} from './CoachCard';

// ═══════════════════════════════════════════════════════════════════════
// COACH QUICK CARD — player-QuickCard 1920×1080 layout, manager data.
// Self-contained: reuses this module's existing helpers (barRowCoach, trait
// system, computeCoachMetricGroups, teamCrestUrl, flags, Montserrat embed).
// No edits to any existing code above.
// ═══════════════════════════════════════════════════════════════════════

const _cqcNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const _cqcClamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ── HOOK 1: per-season team Overall = league-weighted Team Index "Overall".
//    completeScore = the weighted value shown in the table (Arsenal 90.8 etc.);
//    overall = the raw/unweighted version behind the "Raw Score" toggle.
function _cqcTeamOverall(row) {
  const v = row.completeScore ?? row.overall;
  return _cqcNum(v);
}
// ── HOOK 2: per-season £ performance 0–100 from native resourceEfficiencyRank
//    (rank 1 = best £ efficiency). Falls back to a per-season override map, then 50.
function _cqcCostPerf(row, overrides) {
  const bySeason = overrides.costPerfBySeason || {};
  if (bySeason[row.season] != null) return _cqcClamp(_cqcNum(bySeason[row.season]) ?? 50);
  const rank = _cqcNum(row.resourceEfficiencyRank);
  const size = _cqcNum(row.leagueSize ?? overrides.leagueSize);
  if (rank != null && size != null && size > 1) return _cqcClamp(((size - rank) / (size - 1)) * 100);
  return 50;
}

// Age bonus for Potential.
function _cqcAgeBonus(age) {
  if (age == null) return 0;
  if (age < 35) return 10;
  if (age <= 45) return 5;
  if (age <= 50) return 2;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────
// IMPACT radar — ported to match Team HQ "⚡ Team Comparison Radar" exactly:
//   • same 12 metrics, same inverted set (xG Against / Goals Against / PPDA)
//   • percentile via (s <= v).mean()*100 (inverted → 100 - p), clipped 0–100,
//     computed vs the COMBINED pool of BOTH rows' leagues
//   • top-start, clockwise; alternating ring bands; red (A) / blue (B) fills @0.60
//   • vertex dots; A label top-left, B label top-right
// Adapted only in scale + short axis labels for the 448px tile — the metric
// identity, inversion, pooling and math are unchanged from Team HQ.
// Raw values come from each row's precomputed metricGroups ([name,pct,raw])
// plus points/matches and expectedPoints/matches.
// ─────────────────────────────────────────────────────────────────────────
const _CQC_RADAR = [
  // [shortLabel, group, metricName, rowAccessor|null, invert]
  ["xG",    "Attack",     "xG",                  null, false],
  ["Goals", "Attack",     "Goals Scored",        null, false],
  ["Box",   "Attack",     "Touches in Box",      null, false],
  ["xGA",   "Defence",    "xG Against",          null, true],
  ["GA",    "Defence",    "Goals Against",       null, true],
  ["PPDA",  "Defence",    "PPDA",                null, true],
  ["Poss%", "Possession", "Possession",          null, false],
  ["Pass",  "Possession", "Passes",              null, false],
  ["\u2192F3",   "Possession", "Passes to Final 3rd", null, false],
  ["Long",  "Possession", "Long Passes",         null, false],
  ["Pts",   null, null, (r) => (r && r.matches ? _cqcNum(r.points) / r.matches : null), false],
  ["xPts",  null, null, (r) => (r && r.matches ? _cqcNum(r.expectedPoints) / r.matches : null), false],
];

function _cqcMgVal(row, group, name) {
  const g = row && row.metricGroups && row.metricGroups[group];
  if (!Array.isArray(g)) return null;
  const hit = g.find((e) => e && e[0] === name);
  return hit ? _cqcNum(hit[2]) : null;
}
function _cqcRadarRaw(row, spec) {
  if (spec[3]) return spec[3](row);          // row-field accessor (Pts / xPts)
  return _cqcMgVal(row, spec[1], spec[2]);   // metricGroups raw value
}
function _cqcRadarPct(pool, spec, v) {
  if (v == null) return 50;
  const vals = pool.map((r) => _cqcRadarRaw(r, spec)).filter((x) => x != null && Number.isFinite(x));
  if (!vals.length) return 50;
  const p = (vals.filter((x) => x <= v).length / vals.length) * 100;
  return _cqcClamp(spec[4] ? 100 - p : p);
}

function _cqcRadarSvg(rowA, rowB, pool, labelA, labelB) {
  if (!rowA || !rowB) {
    return `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b7a9f;font-size:15px;">Pick two seasons to compare</div>`;
  }
  // combined pool = both rows' leagues (Team HQ: df[df.League.isin({leagueA, leagueB})])
  const leagues = new Set([String(rowA.league || ""), String(rowB.league || "")]);
  const basePool = (Array.isArray(pool) && pool.length) ? pool : [rowA, rowB];
  const cpool = basePool.filter((r) => leagues.has(String(r.league || "")));
  const usePool = cpool.length ? cpool : basePool;

  const N = _CQC_RADAR.length;
  const pA = _CQC_RADAR.map((s) => _cqcRadarPct(usePool, s, _cqcRadarRaw(rowA, s)));
  const pB = _CQC_RADAR.map((s) => _cqcRadarPct(usePool, s, _cqcRadarRaw(rowB, s)));

  // geometry — top-start, clockwise (Team HQ: theta_offset=+pi/2, direction=-1)
  const cx = 202, cy = 116, R = 84, innerFrac = 0.10;
  const rr = (pct) => (pct / 100) * R;
  const ang = (i) => (-90 + (i * 360) / N) * (Math.PI / 180);
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];

  // Team HQ Dark theme
  const BAND_OUT = "#162235", BAND_IN = "#0d1524", RING_IN = "#3a4050", RING_OUT = "#cbd5e1",
        LABEL = "#f5f5f5", HOLE = "#141823";
  const COL_A = "#C81E1E", COL_B = "#1D4ED8",
        FILL_A = "rgba(200,30,30,0.60)", FILL_B = "rgba(29,78,216,0.60)";

  // alternating ring bands 10%..100% (outermost = BAND_OUT), as thick-stroke circles
  const edges = Array.from({ length: 11 }, (_, i) => innerFrac * R + (i * (R - innerFrac * R)) / 10);
  let bands = "";
  for (let i = 0; i < 10; i++) {
    const col = (9 - i) % 2 === 0 ? BAND_OUT : BAND_IN;
    const mid = (edges[i + 1] + edges[i]) / 2, w = edges[i + 1] - edges[i];
    bands += `<circle cx="${cx}" cy="${cy}" r="${mid}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
  }
  let rings = "";
  edges.forEach((r, j) => {
    rings += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${j === edges.length - 1 ? RING_OUT : RING_IN}" stroke-width="1"/>`;
  });
  let spokes = "";
  _CQC_RADAR.forEach((s, i) => {
    const [ex, ey] = pt(i, R);
    const [lx, ly] = pt(i, R + 15);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="${RING_IN}" stroke-width="0.8"/>`;
    spokes += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="${LABEL}" font-size="10" font-weight="700" font-family="Montserrat,sans-serif">${s[0]}</text>`;
  });
  const hole = `<circle cx="${cx}" cy="${cy}" r="${innerFrac * R - 0.6}" fill="${HOLE}"/>`;

  const poly = (arr) => arr.map((p, i) => pt(i, rr(p)).join(",")).join(" ");
  const dots = (arr, col) => arr.map((p, i) => { const [x, y] = pt(i, rr(p)); return `<circle cx="${x}" cy="${y}" r="2.4" fill="${col}"/>`; }).join("");

  return `<svg viewBox="0 0 404 236" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
    ${bands}${rings}${spokes}${hole}
    <polygon points="${poly(pA)}" fill="${FILL_A}" stroke="${COL_A}" stroke-width="2.2"/>
    <polygon points="${poly(pB)}" fill="${FILL_B}" stroke="${COL_B}" stroke-width="2.2"/>
    ${dots(pA, COL_A)}${dots(pB, COL_B)}
    <g font-family="Montserrat,sans-serif" font-weight="800">
      <text x="8" y="230" fill="${COL_A}" font-size="14">${(labelA || "").slice(0, 18)}</text>
      <text x="396" y="230" fill="${COL_B}" font-size="14" text-anchor="end">${(labelB || "").slice(0, 18)}</text>
    </g>
  </svg>`;
}

// Team Context — value + league rank -> percentile bar (matches the player
// QuickCard's Team Context styling: gradient track, dot at percentile, 50% avg tick).
function _cqcCtxBar(label, m) {
  if (!m || m.value == null || m.value === "") return "";
  const size = _cqcNum(m.size) || null;
  const rank = _cqcNum(m.rank);
  const pct = (rank != null && size && size > 1) ? _cqcClamp(((size - rank) / (size - 1)) * 100) : null;
  const col = pct != null ? scoreTierColor(pct) : "#c8d2e0";
  const dotP = pct != null ? Math.max(2, Math.min(96, pct)) : null;
  const sub = rank != null ? `Rank ${rank}${size ? " of " + size : ""}` : "Rank —";
  return `
    <div style="margin-bottom:13px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
        <span style="font-size:15px;font-weight:700;color:#c8d2e0;">${label}</span>
        <span style="font-size:20px;font-weight:900;color:${col};">${m.value}</span>
      </div>
      <div style="position:relative;height:10px;background:#1b2636;border-radius:5px;margin-bottom:4px;">
        <div style="position:absolute;left:0;top:0;height:100%;width:100%;background:linear-gradient(to right,#c7363c,#f0c56a,#3da65b);border-radius:5px;opacity:0.3;"></div>
        <div style="position:absolute;top:-3px;left:50%;width:2px;height:16px;background:#5e6678;transform:translateX(-50%);"></div>
        ${dotP != null ? `<div style="position:absolute;top:50%;left:${dotP}%;transform:translate(-50%,-50%);"><div style="width:16px;height:16px;border-radius:50%;background:${col};border:2.5px solid #07090f;"></div></div>` : ""}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#3a4458;">
        <span>Low</span><span>${sub}</span><span>High</span>
      </div>
    </div>`;
}
function _cqcTeamContextHtml(tc, age) {
  const bars =
    _cqcCtxBar("Squad Value", tc.squadValue) +
    _cqcCtxBar("Summer Spending", tc.summerSpend) +
    _cqcCtxBar("Odds", tc.odds);
  const ageRow = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:2px;">
      <span style="font-size:15px;font-weight:700;color:#c8d2e0;">Age</span>
      <span style="font-size:18px;font-weight:800;color:#fff;">${(tc.age != null && tc.age !== "") ? tc.age : (age != null ? age : "—")}</span>
    </div>`;
  return (bars || `<div style="font-size:13px;color:#5e6678;margin-bottom:10px;">No context entered.</div>`) + ageRow;
}

export function buildCoachQuickCardElement(coach, tenureRows, traits, overrides = {}) {
  const age = computeAge(coach.dob);
  const sortedDesc = [...tenureRows].sort((a, b) => (a.season < b.season ? 1 : -1));
  const latest = sortedDesc[0] || {};
  const natIso2 = countryToIso2(coach.nationality || "");
  const leagueIso2 = countryToIso2(leagueToCountry(latest.league || ""));

  // ── SCORE / POTENTIAL ──────────────────────────────────────────────
  const perSeason = sortedDesc
    .map((r) => {
      const ov = _cqcTeamOverall(r);
      if (ov == null) return null;
      const cp = _cqcCostPerf(r, overrides);
      return { season: r.season, team: r.team, ov, cp, sc: _cqcClamp(0.8 * ov + 0.2 * cp) };
    })
    .filter(Boolean); // newest → oldest
  let score = null;
  if (perSeason.length) {
    const n = perSeason.length;
    let wsum = 0, acc = 0;
    perSeason.forEach((s, k) => { const w = n - k; wsum += w; acc += w * s.sc; }); // newest weighted highest
    score = _cqcClamp(acc / wsum);
  }
  const potential = score == null ? null : _cqcClamp(score + _cqcAgeBonus(age));
  const showPills = overrides.showScorePills !== false;

  // ── STYLE (career-average traits) ──────────────────────────────────
  const getTrait = (key) => (coach.traitOverrides?.[key] != null ? coach.traitOverrides[key] * 10 : traits?.[key]);
  const STYLE_KEYS = [
    ["Possession", "possession"], ["Pressing", "pressing"], ["Attacking", "attacking"],
    ["Defensive", "defensive"], ["Long Ball", "directness"], ["Passing", "passing"],
  ];

  // ── LEFT percentile bars (same as coach card) ──────────────────────
  const metricGroups = computeCoachMetricGroups(tenureRows) || { Attack: [], Defence: [], Possession: [] };
  const totalRows = metricGroups.Attack.length + metricGroups.Defence.length + metricGroups.Possession.length;
  const rowH = totalRows > 0 ? Math.max(8, Math.min(30, Math.floor((671 - 193) / totalRows) - 1)) : 20;
  const barsHtml = (rows) => rows.map((r) => barRowCoach(r.label, r.pct, r.val, rowH)).join("");

  // ── IMPACT radar seasons ───────────────────────────────────────────
  const findRow = (s) => tenureRows.find((r) => r.season === s);
  const rowA = overrides.impactRowA || (overrides.impactA ? findRow(overrides.impactA) : sortedDesc[sortedDesc.length - 1]);
  const rowB = overrides.impactRowB || (overrides.impactB ? findRow(overrides.impactB) : sortedDesc[0]);
  const radarPool = (overrides.allTeams && overrides.allTeams.length) ? overrides.allTeams : tenureRows;
  const labelA = overrides.impactLabelA || (rowA ? rowA.season : "");
  const labelB = overrides.impactLabelB || (rowB ? rowB.season : "");

  // ── INFO ROW ───────────────────────────────────────────────────────
  const formation = overrides.formation || (Array.isArray(coach.formations) ? coach.formations[0] : coach.formation) || "—";
  const infoRows = [
    ["Formation:", formation],
    ["Contract:", coach.contract || "—"],
    ["Clubs:", coach.clubs ?? "—"],
    ["Agent:", overrides.agent || coach.agent || "—"],
  ];

  // ── HEADER STATS (latest season) ───────────────────────────────────
  const stat = (v) => (v == null ? "—" : String(v));
  const ppg = latest.points != null && latest.matches ? (latest.points / latest.matches).toFixed(2)
    : latest.ppg != null ? Number(latest.ppg).toFixed(2) : null;
  const statRow = [
    ["Games", stat(latest.matches)], ["GF", stat(latest.goalsFor)], ["GA", stat(latest.goalsAgainst)],
    ["xG", latest.xGoalsFor != null ? Number(latest.xGoalsFor).toFixed(1) : "—"],
    ["xGA", latest.xGoalsAgainst != null ? Number(latest.xGoalsAgainst).toFixed(1) : "—"],
    ["PPG", ppg ?? "—"],
  ];

  // ── TEAM CONTEXT (manual: value + league rank -> percentile) ───────
  const tc = overrides.teamContext || {};

  // ── panel geometry (mirrors QuickCard) ─────────────────────────────
  const PANEL_BG = "#141823", PANEL_BORDER = "rgba(255,255,255,0.08)", PANEL_RADIUS = 14, PAD = 22, GAP = 24;
  const STYLE_TOP = 322, HALF_W = 448;
  const ROW1_H = 300, ROW2_TOP = STYLE_TOP + ROW1_H + GAP, ROW2_H = 300;
  const LEFT_TOP = 322;

  const pill = (v) => v == null ? "" :
    `<span style="display:inline-flex;align-items:center;justify-content:center;line-height:1;min-width:18px;font-size:19px;font-weight:800;padding:7px 13px;border-radius:7px;background:${scoreTierColor(v)};color:#07090f;">${Math.round(v)}</span>`;

  const styleBars = STYLE_KEYS.map(([lab, key]) => {
    const sc = getTrait(key);
    return barRowCoach(lab, sc != null ? sc : 0, sc != null ? Math.round(sc) : "—", 30);
  }).join("");

  const careerBars = (() => {
    const chron = [...perSeason].reverse(); // oldest → newest
    if (!chron.length) return `<div style="color:#6b7a9f;font-size:14px;">No season scores</div>`;
    const bw = Math.floor((HALF_W - PAD * 2 - (chron.length - 1) * 10) / chron.length);
    return `<div style="display:flex;align-items:flex-end;gap:10px;height:150px;margin-top:8px;">
      ${chron.map((s) => {
        const h = Math.max(6, (s.sc / 100) * 140);
        return `<div style="width:${bw}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
          <div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:4px;">${Math.round(s.sc)}</div>
          <div style="width:100%;height:${h}px;border-radius:6px 6px 0 0;background:${scoreTierColor(s.sc)};"></div>
          <div style="font-size:12px;color:#c0c0c0;margin-top:6px;">${String(s.season).replace(/^20/, "")}</div>
        </div>`;
      }).join("")}
    </div>`;
  })();

  const infoBox = infoRows.map(([k, v], i) =>
    `<div style="position:absolute;left:1208px;top:${50 + i * 48}px;font-size:18px;font-weight:500;color:#9aa3b8;white-space:nowrap;">${k}</div>
     <div style="position:absolute;left:1353px;top:${50 + i * 48}px;font-size:18px;font-weight:600;color:#fff;white-space:nowrap;">${String(v).slice(0, 20)}</div>`
  ).join("");

  // photo url
  const rawId = coach.fotmobId || "";
  const fmId = typeof rawId === "string" && rawId.includes("fotmob.com")
    ? (rawId.match(/\/(\d+)\.png/) || [])[1] || null : (rawId || null);
  const photo = fmId ? `${FOTMOB_PHOTO_BASE}${fmId}.png` : (coach.photoDataUrl || coach.photoUrl || "/fallback.png");

  const container = document.createElement("div");
  container.style.cssText = `width:1920px;height:1080px;background:${BG};font-family:'Montserrat',sans-serif;color:${LABEL_COL};position:relative;overflow:hidden;box-sizing:border-box;`;

  container.innerHTML = `
    <div id="cqc-card-root" style="width:1920px;height:1080px;overflow:hidden;background:${BG};position:relative;box-sizing:border-box;">

      <div style="position:absolute;top:0;left:0;width:1920px;height:292px;background:linear-gradient(to right, ${coach.clubColor ? fadeHexToBG(coach.clubColor, 0.62) : HEADER_L} 0%, ${coach.clubColor ? fadeHexToBG(coach.clubColor, 0.93) : HEADER_R} 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"></div>

      <div id="cqc-photo" style="position:absolute;left:-12px;top:16px;width:261px;height:261px;background-color:transparent;background-image:url('${photo}');background-size:cover;background-position:center top;border-radius:0 14px 14px 0;"></div>

      <div style="position:absolute;left:248px;top:24px;width:560px;font-size:53.2px;font-weight:700;line-height:1.05;letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${overrides.nameOverride || coach.name || ""}</div>
      <div style="position:absolute;left:248px;top:90px;font-size:26.6px;font-weight:600;color:#fff;">Manager</div>
      <div style="position:absolute;left:248px;top:148px;display:flex;align-items:center;gap:10px;">
        ${natIso2 ? `<div style="width:36px;height:22px;flex-shrink:0;background-size:cover;background-position:center;background-image:url('https://flagcdn.com/w80/${natIso2}.png');border-radius:2px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);"></div>` : ""}
        <span style="font-size:26.6px;font-weight:600;color:#fff;white-space:nowrap;">${age != null ? age + " years old" : ""}</span>
        ${showPills ? pill(score) : ""}
        ${showPills ? pill(potential) : ""}
      </div>

      <div style="position:absolute;left:248px;top:227px;display:flex;align-items:baseline;gap:32px;">
        ${statRow.map(([lab, val]) => `
          <div style="display:flex;align-items:baseline;gap:6px;">
            <span style="font-size:27.9px;font-weight:700;color:#fff;">${val}</span>
            <span style="font-size:16px;font-weight:500;color:#9aa3b8;text-transform:uppercase;letter-spacing:.04em;">${lab}</span>
          </div>`).join("")}
      </div>

      ${teamCrestUrl(latest.team) ? `<div style="position:absolute;left:740px;top:22px;width:155px;height:210px;background-size:contain;background-repeat:no-repeat;background-position:center;background-image:url('${teamCrestUrl(latest.team)}');filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));"></div>` : ""}
      <div style="position:absolute;left:915px;top:90px;width:266px;font-size:32px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${overrides.teamOverride || latest.team || ""}</div>
      <div style="position:absolute;left:915px;top:150px;display:flex;align-items:center;">
        <span style="font-size:21px;font-weight:500;color:#fff;white-space:nowrap;">${latest.league || ""}</span>
        ${leagueIso2 ? `<div style="width:32px;height:20px;flex-shrink:0;margin-left:33px;background-size:cover;background-position:center;background-image:url('https://flagcdn.com/w80/${leagueIso2}.png');border-radius:2px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);"></div>` : ""}
      </div>
      ${coach.tenure ? `<div style="position:absolute;left:915px;top:194px;font-size:21.3px;color:#d9d9d9;white-space:nowrap;">${coach.tenure}</div>` : ""}

      <div style="position:absolute;left:1188px;top:36px;width:2px;height:210px;background:rgba(255,255,255,0.14);"></div>
      ${infoBox}

      <div style="position:absolute;top:24px;left:1510px;width:390px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:20px 24px;box-sizing:border-box;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:15px;font-weight:700;color:#9aa3b8;text-transform:uppercase;letter-spacing:.04em;">GBE Calculation</span>
          <span style="font-size:16px;font-weight:800;color:#9aa3b8;">${(overrides.gbe && overrides.gbe.status) || "Manual"}</span>
        </div>
        <div style="margin-top:14px;font-size:14px;color:#c8d4f0;">${(overrides.gbe && overrides.gbe.note) || "GBE points to be entered manually."}</div>
      </div>

      <div style="position:absolute;top:${LEFT_TOP}px;left:0px;width:920px;height:${1080 - LEFT_TOP}px;overflow:hidden;box-sizing:border-box;padding-left:24px;padding-top:12px;">
        ${metricGroups.Attack.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:0 0 6px;">Attacking</div>${barsHtml(metricGroups.Attack)}` : ""}
        ${metricGroups.Defence.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:8px 0 6px;">Defensive</div>${barsHtml(metricGroups.Defence)}` : ""}
        ${metricGroups.Possession.length ? `<div style="font-size:24px;font-weight:800;color:#f3f5f7;margin:8px 0 6px;">Possession</div>${barsHtml(metricGroups.Possession)}` : ""}
        <div style="display:flex;align-items:center;margin-top:6px;">
          <div style="width:188px;flex-shrink:0;"></div>
          <div style="flex:1;position:relative;height:26px;">
            ${[0,10,20,30,40,50,60,70,80,90,100].map((p) => `<span style="position:absolute;left:${p}%;top:0;transform:translateX(${p === 0 ? "0" : p === 100 ? "-100%" : "-50%"});font-size:12px;font-weight:600;color:#c4cbd9;">${p}%</span>`).join("")}
          </div>
        </div>
        <div style="display:flex;"><div style="width:188px;flex-shrink:0;"></div><div style="flex:1;text-align:center;font-size:14px;font-weight:700;color:${LABEL_COL};padding-top:6px;">Percentile Rank</div></div>
      </div>

      <div style="position:absolute;left:944px;top:${LEFT_TOP}px;width:2px;height:${1080 - LEFT_TOP}px;background:rgba(255,255,255,0.14);"></div>

      <div style="position:absolute;top:${STYLE_TOP}px;left:984px;width:${HALF_W}px;height:${ROW1_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PAD}px;box-sizing:border-box;overflow:hidden;">
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:14px;">Style</div>
        ${styleBars}
      </div>

      <div style="position:absolute;top:${STYLE_TOP}px;left:${984 + HALF_W + GAP}px;width:${HALF_W}px;height:${ROW1_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PAD}px;box-sizing:border-box;overflow:hidden;">
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:14px;">Career</div>
        ${careerBars}
      </div>

      <div style="position:absolute;top:${ROW2_TOP}px;left:984px;width:${HALF_W}px;height:${ROW2_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PAD}px;box-sizing:border-box;overflow:hidden;">
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:12px;">Team Context</div>
        ${_cqcTeamContextHtml(tc, age)}
      </div>

      <div style="position:absolute;top:${ROW2_TOP}px;left:${984 + HALF_W + GAP}px;width:${HALF_W}px;height:${ROW2_H}px;background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:${PANEL_RADIUS}px;padding:${PAD}px;box-sizing:border-box;overflow:hidden;">
        <div style="font-size:22px;font-weight:700;color:${ACCENT_PINK};margin-bottom:6px;">Impact</div>
        ${_cqcRadarSvg(rowA, rowB, radarPool, labelA, labelB)}
      </div>

    </div>`;

  return container;
}

export async function downloadCoachQuickCardPNG(coach, tenureRows, traits, overrides = {}) {
  await ensureMontserratEmbedded();
  const el = buildCoachQuickCardElement(coach, tenureRows, traits, overrides);
  document.body.appendChild(el);

  // Fotmob CDN is CORS-restricted; convert the photo to a data URL first or
  // html-to-image silently blanks it (same fix the full coach card uses).
  const photoDiv = el.querySelector("#cqc-photo");
  if (photoDiv) {
    const _rawId = coach.fotmobId || "";
    const _fmId = typeof _rawId === "string" && _rawId.includes("fotmob.com")
      ? (_rawId.match(/\/(\d+)\.png/) || [])[1] || null
      : (_rawId || null);
    const _pUrl = _fmId ? `${FOTMOB_PHOTO_BASE}${_fmId}.png` : (coach.photoDataUrl || coach.photoUrl || null);
    if (_pUrl) {
      try {
        const resp = await fetch(_pUrl);
        if (!resp.ok) throw new Error("fetch failed");
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        photoDiv.style.backgroundImage = `url('${dataUrl}')`;
      } catch (_err) {
        photoDiv.style.backgroundImage = "url('/fallback.png')";
      }
    }
  }

  try {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(el, {
      width: 1920,
      height: 1080,
      pixelRatio: 1,
      fontEmbedCSS: MONTSERRAT_EMBED_CSS,
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${(overrides.nameOverride || coach.name || "coach").replace(/\s+/g, "_")}_quickcard.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    document.body.removeChild(el);
  }
}
