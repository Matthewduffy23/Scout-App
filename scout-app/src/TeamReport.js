// TeamReport.js v1 — Team All-in-One report. 1920x1080 PNG export.
//
// TEMPLATE ONLY. The header is fully wired to real data; the seven content
// panels are deliberate stubs. Each panel is a single self-contained function
// (xiPanelHtml, radarPanelHtml, ...) that takes its data and returns an HTML
// string sized to fit its box — so "build each section one by one" means
// replacing one function at a time, with no layout code to touch.
//
// Mounted from TeamIndex.js exactly like TeamCard/CoachPanel, but it needs the
// PLAYERS array too (TeamCard has never been passed it — it only ever needed
// team rows). See the mount snippet at the bottom of this file.
//
// Sizing note: the header band is 150px vs QuickCard's 292px. Deliberate —
// there's far more to fit here, so the header buys back 142px of body height.

import React, { useState } from 'react';
import { MONTSERRAT_EMBED_CSS, teamCrest, leagueDisplayName } from './cardAssets';

// ─── Canvas geometry ───────────────────────────────────────────────────────
// Everything is absolutely positioned off these. Change one number here rather
// than hunting through the markup.
const W = 1920;
const H = 1080;
const PAD = 24;
const HEADER_H = 150;   // narrow band — see note above
const BODY_TOP = 166;   // HEADER_H + 16px breathing gap
const GAP = 20;

const LEFT_W = 756;                       // XI pitch column
const COL_W = 538;                        // each of the two right-hand columns
const COL_A_X = PAD + LEFT_W + GAP;        // 800
const COL_B_X = COL_A_X + COL_W + GAP;     // 1358
// 24 + 756 + 20 + 538 + 20 + 538 + 24 = 1920 exactly.

const ROW_H = 283;
const ROW_1 = BODY_TOP;                   // 166
const ROW_2 = ROW_1 + ROW_H + GAP;        // 469
const ROW_3 = ROW_2 + ROW_H + GAP;        // 772
const LEFT_H = ROW_3 + ROW_H - BODY_TOP;  // 889 — pitch spans all three rows

// ─── Palette (matches QuickCard) ───────────────────────────────────────────
const BG = '#0a0f1c';
const HEADER_L = 'rgb(23,26,77)';
const HEADER_R = 'rgb(17,22,42)';
const PANEL_BG = 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))';
const PANEL_BORDER = 'rgba(255,255,255,0.13)';
const PANEL_SHADOW = '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)';
const PANEL_RADIUS = 14;
const PANEL_PAD = 20;
const TITLE_H = 34;

// Same thresholds TeamIndex uses for its score column, so a team reads the same
// colour in the table and on the card.
function scoreColor(v) {
  if (v == null) return '#475569';
  if (v >= 80) return '#00bf63';
  if (v >= 65) return '#22c55e';
  if (v >= 50) return '#fbc701';
  if (v >= 35) return '#f18c31';
  return '#ef4444';
}
const fmt = (v, dp = 1) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(dp));

// ─── Panel chrome ──────────────────────────────────────────────────────────
// Wraps any content string in a titled panel at an absolute position. Content is
// given its exact inner box so panel functions never have to know where they sit.
function panel({ x, y, w, h, title, body }) {
  return `
    <div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;
                background:${PANEL_BG};border:1px solid ${PANEL_BORDER};
                border-radius:${PANEL_RADIUS}px;box-shadow:${PANEL_SHADOW};
                box-sizing:border-box;padding:${PANEL_PAD}px;overflow:hidden;">
      <div style="height:${TITLE_H}px;font-size:15px;font-weight:700;letter-spacing:0.12em;
                  text-transform:uppercase;color:#94a3b8;">${title}</div>
      <div style="height:${h - PANEL_PAD * 2 - TITLE_H}px;position:relative;">${body}</div>
    </div>`;
}

// Placeholder body used by every unbuilt panel. Prints the exact inner pixel box
// so you can size real content against it without measuring anything.
function stub(w, h, note) {
  return `
    <div style="position:absolute;inset:0;border:1px dashed rgba(255,255,255,0.16);
                border-radius:10px;display:flex;flex-direction:column;
                align-items:center;justify-content:center;gap:6px;color:#475569;">
      <div style="font-size:13px;font-weight:600;letter-spacing:0.08em;">${w} x ${h}</div>
      <div style="font-size:12px;color:#3d4a5e;">${note}</div>
    </div>`;
}

// ───────────────────────────────────────────────────────────────────────────
// PANEL STUBS — replace one at a time. Each gets the data it needs and the
// inner box it must fit. Nothing outside these functions needs to change.
// ───────────────────────────────────────────────────────────────────────────

// XI + DEPTH.
// Draws the real pitch and the eleven slot markers now, because slot placement
// is the thing most likely to need nudging and it's cheaper to eyeball it
// before any player data is wired in.
//
// Slot assignment (not yet implemented) has to come from roleKey + side:
//   GK -> GK | CB -> 2x CB | FB+side R/L -> RB/LB
//   ATT+side R/L -> RW/LW | CF -> ST
//   CM -> DM + 2x CM  <- the ONLY ambiguous one. roleKey can't split these;
//   it has to come off roleCareerScores['Defensive Midfielder DM'] for the DM
//   slot, then the next two by careerScore. Build and test that function
//   standalone against known squads BEFORE wiring it here.
const XI_SLOTS = [
  { k: 'GK', x: 0.50, y: 0.93 },
  { k: 'RB', x: 0.13, y: 0.775 }, { k: 'CB', x: 0.375, y: 0.805 },
  { k: 'CB', x: 0.625, y: 0.805 }, { k: 'LB', x: 0.87, y: 0.775 },
  { k: 'DM', x: 0.50, y: 0.615 },
  { k: 'CM', x: 0.33, y: 0.455 }, { k: 'CM', x: 0.67, y: 0.455 },
  { k: 'RW', x: 0.13, y: 0.285 }, { k: 'LW', x: 0.87, y: 0.285 },
  { k: 'ST', x: 0.50, y: 0.155 },
];

function xiPanelHtml(w, h /*, squad */) {
  const line = 'rgba(255,255,255,0.10)';
  const slots = XI_SLOTS.map(s => {
    const cx = s.x * w, cy = s.y * h;
    return `
      <div style="position:absolute;left:${cx - 60}px;top:${cy - 44}px;width:120px;
                  text-align:center;">
        <div style="width:58px;height:58px;border-radius:50%;margin:0 auto;
                    background:rgba(255,255,255,0.06);
                    border:1px solid rgba(255,255,255,0.18);
                    display:flex;align-items:center;justify-content:center;
                    font-size:12px;font-weight:700;color:#64748b;">${s.k}</div>
        <div style="font-size:12.5px;font-weight:600;color:#8fa0b8;margin-top:5px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Player</div>
        <div style="font-size:11px;color:#475569;margin-top:1px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">depth</div>
      </div>`;
  }).join('');

  return `
    <div style="position:absolute;inset:0;border-radius:10px;overflow:hidden;
                background:linear-gradient(180deg,rgba(34,197,94,0.05),rgba(34,197,94,0.02));
                border:1px solid ${line};">
      <!-- halfway line + centre circle -->
      <div style="position:absolute;left:0;top:50%;width:100%;height:1px;background:${line};"></div>
      <div style="position:absolute;left:50%;top:50%;width:130px;height:130px;
                  margin:-65px 0 0 -65px;border:1px solid ${line};border-radius:50%;"></div>
      <!-- penalty boxes -->
      <div style="position:absolute;left:50%;top:0;width:300px;height:104px;
                  margin-left:-150px;border:1px solid ${line};border-top:none;"></div>
      <div style="position:absolute;left:50%;bottom:0;width:300px;height:104px;
                  margin-left:-150px;border:1px solid ${line};border-bottom:none;"></div>
      <div style="position:absolute;left:50%;top:0;width:136px;height:42px;
                  margin-left:-68px;border:1px solid ${line};border-top:none;"></div>
      <div style="position:absolute;left:50%;bottom:0;width:136px;height:42px;
                  margin-left:-68px;border:1px solid ${line};border-bottom:none;"></div>
      ${slots}
    </div>`;
}

// PERFORMANCE RADAR — source: t.metricGroups percentiles.
function radarPanelHtml(w, h /*, team */) {
  return stub(w, h, 'radar from t.metricGroups percentiles');
}

// STYLE — source: t.attributes. NOTE: there are SEVEN attributes
// (Possession, Pressing, Long Ball, Attacking, Short Passing, Transitional,
// Vertical), not six. Either drop one for a true hexagon or draw a heptagon.
function stylePanelHtml(w, h /*, team */) {
  return stub(w, h, 'hexagon from t.attributes (7 keys, not 6)');
}

// SIMILAR TEAMS — source: t.similarTeams, already computed in teams_final.json.
// Cheapest panel: crest + name + league + score row per team.
function similarTeamsPanelHtml(w, h /*, team */) {
  return stub(w, h, 'from t.similarTeams');
}

// LEAGUE TABLE SNIP — source: t.pointsRank / t.points across the same league.
// "Cut out of position": show the rows around this team, not the whole table.
function leagueTablePanelHtml(w, h /*, team, allTeams */) {
  return stub(w, h, 'rows around t.pointsRank');
}

// KEY PLAYERS — source: players filtered to this team+league, top by careerScore.
function keyPlayersPanelHtml(w, h /*, squad */) {
  return stub(w, h, 'top squad players by careerScore');
}

// WEAKNESSES — source: LOWEST t.metricGroups percentiles, plus thin squad
// positions from the XI depth counts once that's built.
function weaknessesPanelHtml(w, h /*, team, squad */) {
  return stub(w, h, 'lowest metricGroups pcts + thin positions');
}

// ─── Header ────────────────────────────────────────────────────────────────
// Crest + name + OVR on the left; the four style scores and league position on
// the right. The right-hand block is using header space that would otherwise be
// dead — delete that one template literal if you'd rather keep the band clean.
function headerHtml(team) {
  const crest = teamCrest(team.team);
  const league = leagueDisplayName(team.league);
  const ovr = team.completeScore;
  const cells = [
    ['ATTACK', team.attack], ['DEFENCE', team.defence],
    ['POSSESSION', team.possession], ['PRESSING', team.pressing],
  ];

  return `
    <div style="position:absolute;top:0;left:0;width:${W}px;height:${HEADER_H}px;
                background:linear-gradient(to right, ${HEADER_L} 0%, ${HEADER_R} 100%);
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"></div>

    ${crest ? `<div style="position:absolute;left:${PAD}px;top:25px;width:100px;height:100px;
                background-image:url('${crest}');background-size:contain;
                background-repeat:no-repeat;background-position:center;"></div>` : ''}

    <div style="position:absolute;left:${PAD + 124}px;top:26px;font-size:46px;font-weight:700;
                letter-spacing:-0.5px;line-height:1.05;white-space:nowrap;">${team.team}</div>
    <div style="position:absolute;left:${PAD + 124}px;top:88px;font-size:22px;font-weight:600;
                color:#c3ccdd;white-space:nowrap;">${league}${team.season ? ` &nbsp;·&nbsp; ${team.season}` : ''}</div>

    <div style="position:absolute;right:${PAD + 470}px;top:38px;text-align:center;">
      <div style="font-size:54px;font-weight:900;line-height:1;color:${scoreColor(ovr)};">${fmt(ovr)}</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;color:#8fa0b8;margin-top:6px;">OVERALL</div>
    </div>

    <!-- four style scores: margin-left, NOT flex gap (gap is unreliable in html-to-image) -->
    <div style="position:absolute;right:${PAD}px;top:44px;display:flex;align-items:flex-start;">
      ${cells.map(([label, v], i) => `
        <div style="text-align:center;width:104px;${i ? 'margin-left:12px;' : ''}">
          <div style="font-size:28px;font-weight:800;line-height:1;color:${scoreColor(v)};">${fmt(v)}</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#8fa0b8;margin-top:7px;">${label}</div>
        </div>`).join('')}
    </div>

    ${team.pointsRank != null ? `
      <div style="position:absolute;left:${PAD + 124}px;top:120px;font-size:14px;
                  font-weight:600;color:#8fa0b8;">
        League position ${team.pointsRank}${team.points != null ? ` &nbsp;·&nbsp; ${team.points} pts` : ''}
      </div>` : ''}`;
}

// ─── Offscreen element builder ─────────────────────────────────────────────
// Same pattern as QuickCard: build detached at -9999px, capture by INNER id
// (#tr-card-root), never the offscreen wrapper.
export function buildTeamReportElement(team, players = []) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${W}px`;
  container.style.height = `${H}px`;

  const innerW = COL_W - PANEL_PAD * 2;
  const innerH = ROW_H - PANEL_PAD * 2 - TITLE_H;
  const xiW = LEFT_W - PANEL_PAD * 2;
  const xiH = LEFT_H - PANEL_PAD * 2 - TITLE_H;

  container.innerHTML = `
    <div id="tr-card-root" style="width:${W}px;height:${H}px;overflow:hidden;background:${BG};
         font-family:'Montserrat',sans-serif;color:#fff;position:relative;box-sizing:border-box;">

      ${headerHtml(team)}

      ${panel({ x: PAD, y: BODY_TOP, w: LEFT_W, h: LEFT_H,
                title: 'XI + Depth', body: xiPanelHtml(xiW, xiH) })}

      ${panel({ x: COL_A_X, y: ROW_1, w: COL_W, h: ROW_H,
                title: 'Performance Radar', body: radarPanelHtml(innerW, innerH) })}
      ${panel({ x: COL_A_X, y: ROW_2, w: COL_W, h: ROW_H,
                title: 'Style', body: stylePanelHtml(innerW, innerH) })}
      ${panel({ x: COL_A_X, y: ROW_3, w: COL_W, h: ROW_H,
                title: 'Similar Teams', body: similarTeamsPanelHtml(innerW, innerH) })}

      ${panel({ x: COL_B_X, y: ROW_1, w: COL_W, h: ROW_H,
                title: 'League Table', body: leagueTablePanelHtml(innerW, innerH) })}
      ${panel({ x: COL_B_X, y: ROW_2, w: COL_W, h: ROW_H,
                title: 'Key Players', body: keyPlayersPanelHtml(innerW, innerH) })}
      ${panel({ x: COL_B_X, y: ROW_3, w: COL_W, h: ROW_H,
                title: 'Weaknesses', body: weaknessesPanelHtml(innerW, innerH) })}
    </div>`;

  document.body.appendChild(container);
  return container;
}

// ─── Modal ─────────────────────────────────────────────────────────────────
// allTeamSeasons: this club's history, already grouped by teamCountry so promoted/
//   relegated sides merge but same-named foreign clubs don't. For trend panels.
// allTeams: every team row — the League Table panel needs its league-mates.
export default function TeamReport({ team, allTeamSeasons = [], allTeams = [], players = [], onClose }) {
  const [downloading, setDownloading] = useState(false);

  // Guard for the mobile lazy-load path in App.js: on mobile `all` holds ONE
  // position group at a time, so `players` arrives with only GK (or only CF...).
  // Without this the XI renders with eight empty slots and looks like a bug.
  const groupsPresent = new Set(players.map(p => p && p.roleKey).filter(Boolean)).size;
  const partialSquadData = players.length > 0 && groupsPresent < 4;

  const handleDownload = async () => {
    setDownloading(true);
    const { toPng } = await import('html-to-image');
    const el = buildTeamReportElement(team, players);
    try {
      const cardNode = el.querySelector('#tr-card-root') || el;
      const opts = {
        width: W, height: H, pixelRatio: 1, backgroundColor: BG,
        cacheBust: true, fontEmbedCSS: MONTSERRAT_EMBED_CSS,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      };
      await toPng(cardNode, opts);              // warm-up: fonts/images land in cache
      const dataUrl = await toPng(cardNode, opts); // real capture
      const a = document.createElement('a');
      a.download = `${String(team.team).replace(/\s+/g, '_')}_team_report.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) { console.error(e); }
    finally { document.body.removeChild(el); setDownloading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#09111e', border: '1px solid #1e2d45', borderRadius: 12,
                    padding: 32, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.7)',
                    minWidth: 320, maxWidth: 380 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f4', marginBottom: 8 }}>
          Team Report
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
          {team.team} · {leagueDisplayName(team.league)}
        </div>

        {partialSquadData && (
          <div style={{ fontSize: 11.5, color: '#fbc701', background: 'rgba(251,199,1,0.08)',
                        border: '1px solid rgba(251,199,1,0.25)', borderRadius: 8,
                        padding: '8px 10px', marginBottom: 16, lineHeight: 1.45 }}>
            Only {groupsPresent} position group{groupsPresent === 1 ? '' : 's'} loaded — the XI
            will be incomplete. Switch position filter to "All" to load every group.
          </div>
        )}

        <button onClick={handleDownload} disabled={downloading}
          style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                   background: downloading ? '#1e2d45' : '#3b7de8', color: '#fff',
                   fontSize: 13, fontWeight: 700,
                   cursor: downloading ? 'default' : 'pointer' }}>
          {downloading ? 'Generating…' : '⬇ Download 1920×1080'}
        </button>

        <button onClick={onClose}
          style={{ width: '100%', marginTop: 10, padding: '8px 0', borderRadius: 8,
                   border: '1px solid #1e2d45', background: 'transparent',
                   color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  );
}

/*  MOUNT — in TeamIndex.js, alongside the existing TeamCard / CoachPanel mounts:

      {reportTeam && (
        <TeamReport
          team={reportTeam}
          players={players}          // <- TeamCard has never been passed this
          onClose={() => setReportTeam(null)}
        />
      )}

    plus  const [reportTeam, setReportTeam] = useState(null);
    and   import TeamReport from './TeamReport';
*/
