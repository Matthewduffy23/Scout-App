// TeamSimilarCalc.js — "Similar teams" calculator on the Team Index profile (TeamCard).
// Engine + method notes live in teamSimilarity.js. Computed client-side against every
// team-season in teams_final.json.
import React, { useState, useMemo } from 'react';
import { findSimilarTeams, prepareTeamSim, leagueStrength, normLeague, leagueRegion, sortSeasons, teamCountry, teamKey } from './teamSimilarity';
import { useIsMobile, deliverPng } from './utils';
import { ensureMontserratEmbedded, MONTSERRAT_EMBED_CSS } from './CoachCard';
import { preloadImages } from './TeamReport';

const N_OPTIONS = [5, 10, 15, 20, 25];
const BANDS = [1, 2, 3, 4, 5, 6];
const REGIONS = ['Europe', 'South America', 'North America', 'Asia', 'Africa', 'Other'];

const simColor = v => v >= 70 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#64748b';
const fmt = v => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(Number.isInteger(v) ? 0 : 1));
export const styleTags = t => {
  const a = (t.attributes || []).slice(0, 3);
  return a.length ? a : (t.style ? [t.style] : []);
};

const lbl = { fontSize: 8.5, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 };
const chip = on => ({ padding: '3px 8px', borderRadius: 5, border: `1px solid ${on ? '#3b7de8' : '#1e2d45'}`, background: on ? '#0e2040' : 'transparent', color: on ? '#60a5fa' : '#64748b', fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' });
const inp = { width: 52, background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 5, color: '#e2e8f4', padding: '3px 6px', fontSize: 11, outline: 'none' };

function toggleIn(set, v) { const s = new Set(set); s.has(v) ? s.delete(v) : s.add(v); return s; }

function WhyLine({ m, good }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 10, color: '#94a3b8' }}>
      <span style={{ color: good ? '#4ade80' : '#f87171', width: 10 }}>{good ? '≈' : '≠'}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{m.label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: '#cbd5e1' }}>{fmt(m.a)} <span style={{ color: '#475569' }}>vs</span> {fmt(m.b)}</span>
      <span style={{ width: 70, textAlign: 'right', color: '#475569' }}>{m.aPct}/{m.bPct} pct</span>
    </div>
  );
}

export default function TeamSimilarCalc({ subject: profile, allTeams = [], getCrest = () => '', onOpenTeam }) {
  const isMobile = useIsMobile();
  const P = useMemo(() => (allTeams.length ? prepareTeamSim(allTeams) : null), [allTeams]);
  const allSeasons = P ? P.seasons : [];
  const leagueList = useMemo(() => {
    const m = new Map();
    for (const t of allTeams) if (!m.has(normLeague(t.league))) m.set(normLeague(t.league), t.league);
    return [...m.entries()].sort((a, b) => leagueStrength(b[1]) - leagueStrength(a[1]) || a[1].localeCompare(b[1]));
  }, [allTeams]);

  // "Compare from season": every season this club has full style data for, newest first.
  // Defaults to the newest COMPLETED one — P.current holds the in-progress split-year
  // season (2026-27) and the in-progress calendar year (2026), so a calendar club lands
  // on its last full year and a European one on 2025-26.
  const clubSeasons = useMemo(() => {
    if (!P) return [];
    const club = profile.team + '|' + teamCountry(profile.league);
    const rows = P.rows.filter(r => r.club === club).map(r => r.t);
    const order = sortSeasons([...new Set(rows.map(t => String(t.season)))]).reverse();
    return rows.sort((a, b) => order.indexOf(String(a.season)) - order.indexOf(String(b.season)));
  }, [P, profile.team, profile.league]);
  const [fromKey, setFromKey] = useState(null);
  const subject = clubSeasons.find(t => teamKey(t) === fromKey)
    || clubSeasons.find(t => !P.current.has(String(t.season)))
    || clubSeasons[0] || profile;

  const [seasons, setSeasons] = useState(null); // null = all
  const [lsMin, setLsMin] = useState(0);
  const [lsMax, setLsMax] = useState(101);
  const [bands, setBands] = useState(new Set());
  const [regions, setRegions] = useState(new Set());
  const [leagues, setLeagues] = useState(new Set());
  const [leagueQ, setLeagueQ] = useState('');
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const [minMatches, setMinMatches] = useState(8);
  const [n, setN] = useState(10);
  const [excludeSameClub, setExcludeSameClub] = useState(true);
  const [excludeCurrent, setExcludeCurrent] = useState(false);
  const [onePerClub, setOnePerClub] = useState(true);
  const [open, setOpen] = useState(null); // expanded "why similar" row key
  const [busy, setBusy] = useState(false);

  const out = useMemo(() => {
    if (!P) return null;
    return findSimilarTeams(subject, allTeams, {
      seasons: seasons ? new Set(seasons) : null, lsMin, lsMax, bands, regions, leagues,
      minMatches: Number(minMatches) || 0, n, excludeSameClub, excludeCurrent, onePerClub,
    });
  }, [P, subject, allTeams, seasons, lsMin, lsMax, bands, regions, leagues, minMatches, n, excludeSameClub, excludeCurrent, onePerClub]);

  const selfLs = leagueStrength(subject.league);
  const sameLevel = () => { setLsMin(Math.max(0, Math.floor(selfLs - 8))); setLsMax(Math.min(101, Math.ceil(selfLs + 8))); };
  const seasonOn = s => !seasons || seasons.includes(s);
  const toggleSeason = s => {
    const cur = seasons || allSeasons;
    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s];
    setSeasons(next.length === allSeasons.length ? null : next);
  };
  const currentLabel = P ? [...P.current].join(' & ') : '';

  const filterSummary = () => {
    const parts = [];
    parts.push(seasons ? `Seasons: ${seasons.length} selected` : 'All seasons');
    if (lsMin > 0 || lsMax < 101) parts.push(`League strength ${lsMin}–${Math.min(lsMax, 100)}`);
    if (bands.size) parts.push(`GBE band ${[...bands].sort().join('/')}`);
    if (regions.size) parts.push([...regions].join(', '));
    if (leagues.size) parts.push(`${leagues.size} league${leagues.size > 1 ? 's' : ''}`);
    parts.push(`Min ${minMatches} matches`);
    if (excludeCurrent) parts.push(`excl. ${currentLabel}`);
    return parts.join(' · ');
  };

  const exportPng = async () => {
    if (!out || !out.results.length) return;
    setBusy(true);
    try {
      await ensureMontserratEmbedded();
      const urls = [subject, ...out.results.map(r => r.t)].map(t => getCrest(t.team)).filter(Boolean);
      let imgs = {};
      try { imgs = await preloadImages([...new Set(urls)]); } catch (e) { /* crest-less beats no export */ }
      const el = buildExportElement(subject, out.results, imgs, getCrest, filterSummary());
      document.body.appendChild(el);
      try {
        const { toPng } = await import('html-to-image');
        const opts = { width: el.offsetWidth || 1080, height: el.offsetHeight || 900, pixelRatio: 2, fontEmbedCSS: MONTSERRAT_EMBED_CSS };
        const dataUrl = await toPng(el, opts);
        const slug = s => String(s).replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
        if (dataUrl) await deliverPng(dataUrl, `similar_teams_${slug(subject.team)}_${slug(subject.season)}.png`);
      } finally { el.remove(); }
    } finally { setBusy(false); }
  };

  if (!P) return null;
  const leaguesShown = leagueList.filter(([, l]) => !leagueQ || l.toLowerCase().includes(leagueQ.toLowerCase()));

  return (
    <div data-testid="similar-calc">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Similar Teams Calculator — all seasons</div>
        <button onClick={exportPng} disabled={busy || !out || !out.results.length} style={chip(false)}>{busy ? 'Exporting…' : '⬇ Download PNG'}</button>
      </div>
      {clubSeasons.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ ...lbl, marginBottom: 0 }}>Compare from season</span>
          <select aria-label="Compare from season" value={teamKey(subject)} onChange={e => setFromKey(e.target.value)} style={{ ...inp, width: 'auto', fontSize: 12, fontWeight: 700, padding: '4px 8px', borderColor: '#3b7de8' }}>
            {clubSeasons.map(t => (
              <option key={teamKey(t)} value={teamKey(t)}>{t.season} · {t.league}{P.current.has(String(t.season)) ? ' (in progress)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#07090f', border: '1px solid #131c2e', borderRadius: 8, padding: isMobile ? 10 : 12, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={lbl}>Seasons</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {allSeasons.map(s => (
              <label key={s} style={{ ...chip(seasonOn(s)), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={seasonOn(s)} onChange={() => toggleSeason(s)} style={{ margin: 0, accentColor: '#3b7de8' }} />{s}
              </label>
            ))}
            <button style={chip(false)} onClick={() => setSeasons(null)}>All</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flexWrap: 'wrap' }}>
          <div>
            <div style={lbl}>League strength</div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input aria-label="League strength min" type="number" min={0} max={101} value={lsMin} onChange={e => setLsMin(Number(e.target.value) || 0)} style={inp} />
              <span style={{ color: '#475569', fontSize: 11 }}>–</span>
              <input aria-label="League strength max" type="number" min={0} max={101} value={lsMax} onChange={e => setLsMax(e.target.value === '' ? 101 : Number(e.target.value))} style={inp} />
              <button style={chip(false)} onClick={sameLevel} title={`${subject.league} = ${selfLs.toFixed(1)}`}>Same level ±8</button>
              {(lsMin > 0 || lsMax < 101) && <button style={chip(false)} onClick={() => { setLsMin(0); setLsMax(101); }}>Any</button>}
            </div>
          </div>
          <div>
            <div style={lbl}>GBE band</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {BANDS.map(b => <button key={b} style={chip(bands.has(b))} onClick={() => setBands(toggleIn(bands, b))}>{b}</button>)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={lbl}>Regions</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {REGIONS.map(r => <button key={r} style={chip(regions.has(r))} onClick={() => setRegions(toggleIn(regions, r))}>{r}</button>)}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={lbl}>Leagues</div>
            <button style={chip(leagues.size > 0)} onClick={() => setLeaguesOpen(o => !o)}>{leagues.size ? `${leagues.size} selected` : 'Any league'} ▾</button>
            {leagues.size > 0 && <button style={{ ...chip(false), marginLeft: 4 }} onClick={() => setLeagues(new Set())}>Clear</button>}
            {leaguesOpen && (
              <div style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, marginTop: 4, width: 230, maxHeight: 260, overflowY: 'auto', background: '#0c1424', border: '1px solid #1e2d45', borderRadius: 7, padding: 6 }}>
                <input placeholder="Search leagues…" value={leagueQ} onChange={e => setLeagueQ(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: 5 }} />
                {leaguesShown.map(([k, l]) => (
                  <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#cbd5e1', padding: '2px 2px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={leagues.has(k)} onChange={() => setLeagues(toggleIn(leagues, k))} style={{ margin: 0, accentColor: '#3b7de8' }} />
                    <span style={{ flex: 1 }}>{l}</span><span style={{ color: '#475569', fontSize: 9.5 }}>{leagueStrength(l).toFixed(0)} · {leagueRegion(l)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={lbl}>Min matches</div>
            <input aria-label="Min matches" type="number" min={0} value={minMatches} onChange={e => setMinMatches(e.target.value)} style={inp} />
          </div>
          <div>
            <div style={lbl}>Results</div>
            <select aria-label="Number of results" value={n} onChange={e => setN(Number(e.target.value))} style={{ ...inp, width: 58 }}>
              {N_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>Style basis</div>
            <select aria-label="Style basis" value="overall" disabled style={{ ...inp, width: 'auto', opacity: 0.8 }} title="ScoutBoard Pro has no in/out of possession split — Overall uses all 14 style metrics">
              <option value="overall">Overall</option>
            </select>
          </div>
          {[['Exclude same club', excludeSameClub, setExcludeSameClub],
            [`Exclude current season${currentLabel ? ` (${currentLabel})` : ''}`, excludeCurrent, setExcludeCurrent],
            ['One season per club', onePerClub, setOnePerClub]].map(([label, val, set]) => (
            <label key={label} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 10.5, color: val ? '#cbd5e1' : '#64748b', cursor: 'pointer', paddingBottom: 3 }}>
              <input type="checkbox" checked={val} onChange={() => set(v => !v)} style={{ margin: 0, accentColor: '#3b7de8' }} />{label}
            </label>
          ))}
        </div>
      </div>

      {/* Results */}
      {out && out.missing && <div style={{ fontSize: 11, color: '#64748b' }}>Not enough style metrics on file for {subject.team} {subject.season}.</div>}
      {out && !out.missing && !out.results.length && <div style={{ fontSize: 11, color: '#64748b' }}>No team-seasons match these filters.</div>}
      <div data-testid="similar-header" style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', margin: '2px 0 8px', letterSpacing: '-0.01em' }}>
        Teams most similar to {subject.team} <span style={{ color: '#60a5fa' }}>{subject.season}</span>
        <span style={{ fontSize: 10.5, fontWeight: 500, color: '#64748b' }}> · {subject.league}</span>
      </div>
      {out && !out.missing && out.results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {out.results.map((r, i) => {
            const t = r.t, key = `${t.team}|${t.league}|${t.season}`, isOpen = open === key, crest = getCrest(t.team);
            return (
              <div key={key} data-testid="similar-row" style={{ background: '#07090f', border: '1px solid #131c2e', borderRadius: 8 }}>
                <div onClick={() => onOpenTeam && onOpenTeam(t)} title="Open this team-season" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', cursor: onOpenTeam ? 'pointer' : 'default' }}>
                  <div style={{ width: 22, fontSize: 10, fontWeight: 700, color: '#475569', textAlign: 'center', flexShrink: 0 }}>#{i + 1}</div>
                  {crest ? <img src={crest} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.target.style.visibility = 'hidden'; }} /> : <div style={{ width: 24, height: 24, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.team} <span style={{ color: '#64748b', fontWeight: 500 }}>· {t.season} · {t.league}</span></div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 3, overflow: 'hidden' }}>
                      {styleTags(t).map(s => <span key={s} style={{ padding: '1px 6px', borderRadius: 4, background: '#0a1a30', color: '#7eb3f8', fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap' }}>{s}</span>)}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: simColor(r.sim), width: 52, textAlign: 'right', flexShrink: 0 }}>{Math.round(r.sim)}%</div>
                  <button onClick={e => { e.stopPropagation(); setOpen(isOpen ? null : key); }} title="Why similar" aria-label="Why similar"
                    style={{ ...chip(isOpen), padding: '2px 7px', flexShrink: 0 }}>{isOpen ? '▴' : 'Why'}</button>
                </div>
                {isOpen && (
                  <div style={{ padding: '2px 12px 9px 44px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 9, color: '#475569' }}>{subject.team} {subject.season} vs {t.team} {t.season} · raw per 90 · league-season pct</div>
                    {r.why.closest.map(m => <WhyLine key={m.label} m={m} good />)}
                    {r.why.furthest.map(m => <WhyLine key={m.label} m={m} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {out && !out.missing && (
        <div style={{ marginTop: 6, fontSize: 9.5, color: '#334155' }}>
          {out.poolSize.toLocaleString()} team-seasons compared in {out.ms.toFixed(0)} ms · 14 style metrics, percentiles within each league-season + season z-scores, league-strength adjusted (same method as ScoutBoard Pro) · click a row to open it.
        </div>
      )}
    </div>
  );
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildExportElement(subject, results, imgs, getCrest, summary) {
  const crestImg = (team, size) => {
    const u = getCrest(team), d = u && imgs[u];
    return d ? `<img src="${d}" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0"/>` : `<div style="width:${size}px;height:${size}px;flex-shrink:0"></div>`;
  };
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const el = document.createElement('div');
  el.setAttribute('style', 'position:fixed;left:-10000px;top:0;width:1080px;background:#09111e;color:#e2e8f4;font-family:Montserrat,sans-serif;padding:40px 48px 28px;box-sizing:border-box');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:8px">
      ${crestImg(subject.team, 64)}
      <div>
        <div style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748b">Teams most similar to</div>
        <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em">${esc(subject.team)} <span style="color:#64748b;font-weight:600">· ${esc(subject.season)} · ${esc(subject.league)}</span></div>
      </div>
    </div>
    <div style="font-size:13px;color:#64748b;margin-bottom:22px">${esc(summary)}</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${results.map((r, i) => `
        <div style="display:flex;align-items:center;gap:16px;background:#0c1424;border:1px solid #1e2d45;border-radius:10px;padding:10px 18px">
          <div style="width:34px;font-size:15px;font-weight:700;color:#475569;text-align:center">${i + 1}</div>
          ${crestImg(r.t.team, 38)}
          <div style="flex:1;min-width:0">
            <div style="font-size:19px;font-weight:700;white-space:nowrap">${esc(r.t.team)} <span style="color:#64748b;font-weight:500">· ${esc(r.t.season)} · ${esc(r.t.league)}</span></div>
            <div style="display:flex;gap:6px;margin-top:5px">${styleTags(r.t).map(s => `<span style="padding:2px 9px;border-radius:5px;background:#0a1a30;color:#7eb3f8;font-size:12px;font-weight:600">${esc(s)}</span>`).join('')}</div>
          </div>
          <div style="font-size:26px;font-weight:800;color:${simColor(r.sim)}">${Math.round(r.sim)}%</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:20px;font-size:12px;color:#475569;text-align:right">${esc(date)}</div>`;
  return el;
}
