// PlayerSimilarCalc.js — "Similar players" calculator on the player profile (PlayerCard).
// Same look and controls as TeamSimilarCalc (whose style helpers and Why row it imports);
// engine + method notes live in playerSimilarity.js. Computed client-side against every
// player-season row in players_final.json.
import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { findSimilarPlayers, findSimilarPlayersCareer, careerRowFor, DEFAULT_CAREER_MINUTES,
         preparePlayerSim, playerSeasonRows, defaultFromRow, subjectGroup, seasonRowKey, SIM_GROUPS, ROLE_SHARE,
         groupFeatures, loadPlayerWeightOverrides, savePlayerWeightOverrides, isCustomPlayerWeights } from './playerSimilarity';
import { leagueStrength, leagueRegion, normLeague } from './teamSimilarity';
import { N_OPTIONS, BANDS, REGIONS, simColor, lbl, chip, inp, toggleIn, WhyLine, esc } from './TeamSimilarCalc';
import { PRESET_LEAGUES } from './constants';
import { useIsMobile, deliverPng, Photo, photoUrl } from './utils';
import { teamCrest } from './cardAssets';
import { ensureMontserratEmbedded, MONTSERRAT_EMBED_CSS } from './CoachCard';
import { preloadImages } from './TeamReport';

const GROUP_LABEL = { GK: 'Goalkeepers', CB: 'Centre-backs', FB: 'Full-backs', CM: 'Midfielders', ATT: 'Attackers / wingers', CF: 'Strikers' };
const rowKeyOf = (p, sd) => seasonRowKey(p, sd);

export default function PlayerSimilarCalc({ player, players = [], onOpenPlayer }) {
  const isMobile = useIsMobile();
  const P = useMemo(() => (players.length ? preparePlayerSim(players) : null), [players]);
  const allSeasons = P ? P.seasons : [];
  const leagueList = useMemo(() => {
    if (!P) return [];
    const m = new Map();
    for (const rk of SIM_GROUPS) for (const r of P.groups[rk].rows) if (!m.has(r.norm)) m.set(r.norm, r.league);
    return [...m.entries()].sort((a, b) => leagueStrength(b[1]) - leagueStrength(a[1]) || a[1].localeCompare(b[1]));
  }, [P]);

  const ownRows = useMemo(() => playerSeasonRows(player), [player]);
  const [fromKey, setFromKey] = useState(null);
  const sd = ownRows.find(r => rowKeyOf(player, r) === fromKey) || defaultFromRow(player);
  const ownGroup = sd ? subjectGroup(player, sd) : (player.roleKey || 'CM');

  const [group, setGroup] = useState(null); // null = same as the compare-from row
  const [seasons, setSeasons] = useState(null); // null = all
  const [lsMin, setLsMin] = useState(0);
  const [lsMax, setLsMax] = useState(101);
  const [bands, setBands] = useState(new Set());
  const [regions, setRegions] = useState(new Set());
  const [leagues, setLeagues] = useState(new Set());
  const [leagueQ, setLeagueQ] = useState('');
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const [ageMin, setAgeMin] = useState(15);
  const [ageMax, setAgeMax] = useState(45);
  const [minMinutes, setMinMinutes] = useState(900);
  const [n, setN] = useState(10);
  const [onePerPlayer, setOnePerPlayer] = useState(true);
  const [excludeSelf, setExcludeSelf] = useState(true);
  const [useRoles, setUseRoles] = useState(false);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const activeGroup = group || ownGroup;

  // Compare basis: a single season row (default) or the player's whole career
  // profile (minutes-weighted mean across every qualifying season, vs other
  // players' career profiles the same way). Season-only filters (Seasons,
  // One season per player) don't apply in career mode.
  const [compareBasis, setCompareBasis] = useState('season'); // 'season'|'career'
  const careerRow = useMemo(() => (compareBasis === 'career' && P) ? careerRowFor(players, activeGroup, player.id) : null,
    [compareBasis, P, players, activeGroup, player.id]);
  // Career totals run much higher than one season — nudge the Min minutes default
  // when switching basis, but only while it's still at the OTHER basis's default
  // (a value the user picked by hand is left alone either way).
  useEffect(() => {
    if (compareBasis === 'career' && Number(minMinutes) === 900) setMinMinutes(DEFAULT_CAREER_MINUTES);
    else if (compareBasis === 'season' && Number(minMinutes) === DEFAULT_CAREER_MINUTES) setMinMinutes(900);
  }, [compareBasis]);

  // Edit weights: per-position-group overrides, persisted across sessions.
  const [allWeights, setAllWeights] = useState(() => loadPlayerWeightOverrides());
  const [weightsOpen, setWeightsOpen] = useState(false);
  const groupWeights = allWeights[activeGroup] || null;
  const customWeights = isCustomPlayerWeights(activeGroup, groupWeights);
  const setGroupWeight = (label, val) => setAllWeights(prev => {
    const next = { ...prev, [activeGroup]: { ...(prev[activeGroup] || {}), [label]: val } };
    savePlayerWeightOverrides(next);
    return next;
  });
  const resetGroupWeights = () => setAllWeights(prev => {
    const next = { ...prev };
    delete next[activeGroup];
    savePlayerWeightOverrides(next);
    return next;
  });

  const query = useMemo(() => ({
    sdKey: sd ? rowKeyOf(player, sd) : '', group: activeGroup, seasons, lsMin, lsMax, bands, regions, leagues,
    ageMin: Number(ageMin) || 0, ageMax: ageMax === '' ? 99 : Number(ageMax),
    minMinutes: Number(minMinutes) || 0, n, onePerPlayer, excludeSelf, useRoles, weightOverrides: groupWeights,
  }), [player, sd, activeGroup, seasons, lsMin, lsMax, bands, regions, leagues, ageMin, ageMax, minMinutes, n, onePerPlayer, excludeSelf, useRoles, groupWeights]);
  const q = useDeferredValue(query); // typing in a box doesn't wait on a 50k-row scan
  const out = useMemo(() => {
    if (!P || !sd) return null;
    if (compareBasis === 'career') {
      return findSimilarPlayersCareer({ player }, players, { ...q, group: activeGroup });
    }
    return findSimilarPlayers({ player, sd }, players, { ...q, seasons: q.seasons ? new Set(q.seasons) : null });
  }, [P, player, sd, players, q, compareBasis, activeGroup]);

  const selfLs = sd ? leagueStrength(sd.league) : 0;
  const effectiveSelfLs = (compareBasis === 'career' && careerRow) ? careerRow.ls : selfLs;
  const sameLevel = () => { setLsMin(Math.max(0, Math.floor(effectiveSelfLs - 8))); setLsMax(Math.min(101, Math.ceil(effectiveSelfLs + 8))); };
  const seasonOn = s => !seasons || seasons.includes(s);
  const toggleSeason = s => {
    const cur = seasons || allSeasons;
    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s];
    setSeasons(next.length === allSeasons.length ? null : next);
  };

  // Display row for one result, season-mode or career-mode, so the rest of the
  // UI (and the PNG export) can read team/league/season/age/minutes the same way
  // regardless of which basis produced the result.
  const displayOf = r => compareBasis === 'career'
    ? { team: r.career.team, league: r.career.league,
        season: `Career · ${r.career.seasonCount} season${r.career.seasonCount === 1 ? '' : 's'}`,
        age: r.career.age, minutes: r.career.minutes }
    : { team: r.sd.team, league: r.sd.league, season: r.sd.season, age: r.sd.age, minutes: r.sd.minutes };
  const resultKey = r => compareBasis === 'career' ? `career|${r.p.id}` : rowKeyOf(r.p, r.sd);

  const filterSummary = () => {
    const parts = [GROUP_LABEL[activeGroup] || activeGroup, compareBasis === 'career' ? 'Career profile' : 'Season'];
    if (compareBasis === 'season') parts.push(seasons ? `Seasons: ${seasons.length} selected` : 'All seasons');
    if (lsMin > 0 || lsMax < 101) parts.push(`League strength ${lsMin}–${Math.min(lsMax, 100)}`);
    if (bands.size) parts.push(`GBE band ${[...bands].sort().join('/')}`);
    if (regions.size) parts.push([...regions].join(', '));
    if (leagues.size) parts.push(`${leagues.size} league${leagues.size > 1 ? 's' : ''}`);
    parts.push(`Age ${query.ageMin}–${query.ageMax}`);
    parts.push(`Min ${query.minMinutes}' ${compareBasis === 'career' ? 'career' : ''}`.trim());
    if (useRoles) parts.push('+ style roles');
    if (customWeights) parts.push('custom weights');
    return parts.join(' · ');
  };

  const exportPng = async () => {
    if (!out || !out.results.length) return;
    setBusy(true);
    try {
      await ensureMontserratEmbedded();
      const subjectSd = compareBasis === 'career' && careerRow
        ? { team: careerRow.team, league: careerRow.league, season: `Career · ${careerRow.seasonCount} seasons`, age: careerRow.age, minutes: careerRow.minutes }
        : sd;
      const resultsShim = out.results.map(r => ({ ...r, sd: displayOf(r) }));
      const urls = [photoUrl(player.name, player.team), teamCrest(subjectSd.team),
        ...resultsShim.flatMap(r => [photoUrl(r.p.name, r.p.team), teamCrest(r.sd.team)])].filter(Boolean);
      let imgs = {};
      try { imgs = await preloadImages([...new Set(urls)]); } catch (e) { /* image-less beats no export */ }
      const el = buildPlayerExportElement(player, subjectSd, resultsShim, imgs, filterSummary());
      document.body.appendChild(el);
      try {
        const { toPng } = await import('html-to-image');
        // The node sits at left:-10000px to stay off screen; captured as-is it draws out of
        // frame (a fully transparent PNG). Reset the position on the captured clone only.
        const opts = { width: el.offsetWidth || 1080, height: el.offsetHeight || 900, pixelRatio: 2, fontEmbedCSS: MONTSERRAT_EMBED_CSS, style: { position: 'static', left: '0', top: '0' } };
        await toPng(el, opts); // first pass warms font + image caches (same as the other cards)
        const dataUrl = await toPng(el, opts);
        const slug = s => String(s).replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
        if (dataUrl) await deliverPng(dataUrl, `similar_players_${slug(player.name)}_${slug(subjectSd.season)}.png`);
      } finally { el.remove(); }
    } finally { setBusy(false); }
  };

  if (!P) return null;
  if (!sd) return <div style={{ fontSize: 11, color: '#64748b' }}>No season with per-90 metrics on file for {player.name}.</div>;
  const leaguesShown = leagueList.filter(([, l]) => !leagueQ || l.toLowerCase().includes(leagueQ.toLowerCase()));
  const stale = q !== query;

  return (
    <div data-testid="player-similar-calc">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Similar Players Calculator — all seasons</div>
        <button onClick={exportPng} disabled={busy || !out || !out.results.length} style={chip(false)}>{busy ? 'Exporting…' : '⬇ Download PNG'}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ ...lbl, marginBottom: 0 }}>Compare basis</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[['season', 'Season'], ['career', 'Career']].map(([v, l]) => (
            <button key={v} data-compare-basis={v} style={chip(compareBasis === v)} onClick={() => setCompareBasis(v)}>{l}</button>
          ))}
        </div>
        {compareBasis === 'season' && (<>
          <span style={{ ...lbl, marginBottom: 0 }}>Compare from season</span>
          <select aria-label="Compare from season" value={rowKeyOf(player, sd)} onChange={e => { setFromKey(e.target.value); setGroup(null); }}
            style={{ ...inp, width: 'auto', fontSize: 12, fontWeight: 700, padding: '4px 8px', borderColor: '#3b7de8' }}>
            {ownRows.map(r => (
              <option key={rowKeyOf(player, r)} value={rowKeyOf(player, r)}>{r.season} · {r.team} · {r.league} · {r.minutes}'{P.current.has(String(r.season)) ? ' (in progress)' : ''}</option>
            ))}
          </select>
        </>)}
        {compareBasis === 'career' && careerRow && (
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {careerRow.team} · {careerRow.league} · {careerRow.minutes.toLocaleString()}' across {careerRow.seasonCount} season{careerRow.seasonCount === 1 ? '' : 's'}
          </span>
        )}
        {compareBasis === 'career' && !careerRow && (
          <span style={{ fontSize: 11, color: '#64748b' }}>No qualifying seasons on file for {player.name}.</span>
        )}
      </div>

      {/* Filters */}
      <div style={{ background: '#07090f', border: '1px solid #131c2e', borderRadius: 8, padding: isMobile ? 10 : 12, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        {compareBasis === 'season' && (
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
        )}

        <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flexWrap: 'wrap' }}>
          <div>
            <div style={lbl}>League strength</div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input aria-label="League strength min" type="number" min={0} max={101} value={lsMin} onChange={e => setLsMin(Number(e.target.value) || 0)} style={inp} />
              <span style={{ color: '#475569', fontSize: 11 }}>–</span>
              <input aria-label="League strength max" type="number" min={0} max={101} value={lsMax} onChange={e => setLsMax(e.target.value === '' ? 101 : Number(e.target.value))} style={inp} />
              <button style={chip(false)} onClick={sameLevel} title={`${compareBasis === 'career' && careerRow ? careerRow.league : sd.league} = ${(compareBasis === 'career' && careerRow ? careerRow.ls : selfLs).toFixed(1)}`}>Same level ±8</button>
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
            <button style={{ ...chip(false), marginLeft: 4 }} onClick={() => setLeagues(new Set([...PRESET_LEAGUES.UK].map(normLeague)))}>UK</button>
            <button style={{ ...chip(false), marginLeft: 4 }} onClick={() => setLeagues(new Set([...PRESET_LEAGUES['EFL (England 2–4)']].map(normLeague)))}>EFL</button>
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
            <div style={lbl}>Age</div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input aria-label="Age min" type="number" min={14} max={45} value={ageMin} onChange={e => setAgeMin(e.target.value)} style={{ ...inp, width: 44 }} />
              <span style={{ color: '#475569', fontSize: 11 }}>–</span>
              <input aria-label="Age max" type="number" min={14} max={45} value={ageMax} onChange={e => setAgeMax(e.target.value)} style={{ ...inp, width: 44 }} />
            </div>
          </div>
          <div>
            <div style={lbl}>Min minutes</div>
            <input aria-label="Min minutes" type="number" min={0} step={100} value={minMinutes} onChange={e => setMinMinutes(e.target.value)} style={{ ...inp, width: 60 }} />
          </div>
          <div>
            <div style={lbl}>Position group</div>
            <select aria-label="Position group" value={activeGroup} onChange={e => setGroup(e.target.value === ownGroup ? null : e.target.value)} style={{ ...inp, width: 'auto' }}>
              {SIM_GROUPS.map(g => <option key={g} value={g}>{GROUP_LABEL[g]}{g === ownGroup ? ' (same)' : ''}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>Results</div>
            <select aria-label="Number of results" value={n} onChange={e => setN(Number(e.target.value))} style={{ ...inp, width: 58 }}>
              {N_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>Style basis</div>
            <select aria-label="Style basis" value={useRoles ? 'roles' : 'metrics'} onChange={e => setUseRoles(e.target.value === 'roles')} style={{ ...inp, width: 'auto' }}
              title={`Metrics + style roles adds the season's hexagon role scores (${Math.round(ROLE_SHARE * 100)}% of the weight)`}>
              <option value="metrics">Position metrics</option>
              <option value="roles">Metrics + style roles</option>
            </select>
          </div>
          {[['Exclude this player', excludeSelf, setExcludeSelf],
            ...(compareBasis === 'season' ? [['One season per player', onePerPlayer, setOnePerPlayer]] : [])].map(([label, val, set]) => (
            <label key={label} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 10.5, color: val ? '#cbd5e1' : '#64748b', cursor: 'pointer', paddingBottom: 3 }}>
              <input type="checkbox" checked={val} onChange={() => set(v => !v)} style={{ margin: 0, accentColor: '#3b7de8' }} />{label}
            </label>
          ))}
          <button style={chip(weightsOpen || customWeights)} onClick={() => setWeightsOpen(o => !o)}>⚖ Edit weights{customWeights ? ' •' : ''}</button>
        </div>

        {weightsOpen && (
          <div style={{ borderTop: '1px solid #131c2e', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={lbl}>Metric weights — {GROUP_LABEL[activeGroup]} (0–3, step 0.5)</div>
              <button style={chip(false)} onClick={resetGroupWeights} disabled={!customWeights}>Reset to default</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '4px 16px', maxHeight: 260, overflowY: 'auto' }}>
              {groupFeatures(activeGroup).map(([label, defaultW]) => {
                const val = (groupWeights && groupWeights[label] != null) ? groupWeights[label] : defaultW;
                return (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#94a3b8' }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    <input aria-label={`Weight: ${label}`} type="number" min={0} max={3} step={0.5} value={val}
                      onChange={e => setGroupWeight(label, e.target.value === '' ? defaultW : Number(e.target.value))}
                      style={{ ...inp, width: 48 }} />
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {out && out.missing && <div style={{ fontSize: 11, color: '#64748b' }}>Not enough {GROUP_LABEL[activeGroup] || ''} metrics on file for {player.name}{compareBasis === 'season' ? ` ${sd.season}` : ''}.</div>}
      {out && !out.missing && !out.results.length && <div style={{ fontSize: 11, color: '#64748b' }}>No player{compareBasis === 'career' ? 's' : '-seasons'} match these filters.</div>}
      <div data-testid="player-similar-header" style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', margin: '2px 0 8px', letterSpacing: '-0.01em', opacity: stale ? 0.6 : 1 }}>
        {compareBasis === 'career' ? 'Career profiles' : 'Players'} most similar to {player.name}{' '}
        <span style={{ color: '#60a5fa' }}>{compareBasis === 'career' ? 'Career' : sd.season}</span>
        <span style={{ fontSize: 10.5, fontWeight: 500, color: '#64748b' }}>
          {compareBasis === 'career' ? (careerRow ? ` · ${careerRow.team} · ${careerRow.league}` : '') : ` · ${sd.team} · ${sd.league}`}
        </span>
      </div>
      {out && !out.missing && out.results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, opacity: stale ? 0.6 : 1 }}>
          {!isMobile && (
            <div style={{ display: 'flex', gap: 10, padding: '0 10px', fontSize: 8.5, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <div style={{ width: 22 }} /><div style={{ width: 28 }} /><div style={{ flex: 1 }}>Player · team · league · season</div>
              <div style={{ width: 34, textAlign: 'right' }}>Age</div><div style={{ width: 50, textAlign: 'right' }}>Mins</div>
              <div style={{ width: 52, textAlign: 'right' }}>Match</div><div style={{ width: 38 }} />
            </div>
          )}
          {out.results.map((r, i) => {
            const key = resultKey(r), isOpen = open === key, rd = displayOf(r);
            return (
              <div key={key} data-testid="player-similar-row" style={{ background: '#07090f', border: '1px solid #131c2e', borderRadius: 8 }}>
                <div onClick={() => onOpenPlayer && onOpenPlayer(r.p)} title="Open this player" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', cursor: onOpenPlayer ? 'pointer' : 'default' }}>
                  <div style={{ width: 22, fontSize: 10, fontWeight: 700, color: '#475569', textAlign: 'center', flexShrink: 0 }}>#{i + 1}</div>
                  <Photo name={r.p.name} team={r.p.team} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.p.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rd.team} · {rd.league} · {rd.season}{isMobile ? ` · ${rd.age} · ${rd.minutes}'` : ''}</div>
                  </div>
                  {!isMobile && <div style={{ width: 34, textAlign: 'right', fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{rd.age ?? '—'}</div>}
                  {!isMobile && <div style={{ width: 50, textAlign: 'right', fontSize: 11, color: '#94a3b8', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{Number(rd.minutes).toLocaleString()}</div>}
                  <div style={{ fontSize: 14, fontWeight: 800, color: simColor(r.sim), width: 52, textAlign: 'right', flexShrink: 0 }}>{Math.round(r.sim)}%</div>
                  <button onClick={e => { e.stopPropagation(); setOpen(isOpen ? null : key); }} title="Why similar" aria-label="Why similar"
                    style={{ ...chip(isOpen), padding: '2px 7px', flexShrink: 0, width: 38 }}>{isOpen ? '▴' : 'Why'}</button>
                </div>
                {isOpen && (
                  <div style={{ padding: '2px 12px 9px 44px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 9, color: '#475569' }}>{player.name} {compareBasis === 'career' ? 'Career' : sd.season} vs {r.p.name} {rd.season} · raw per 90 / % · league-season pct</div>
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
          {out.poolSize.toLocaleString()} {compareBasis === 'career' ? 'player careers' : 'player-seasons'} compared in {out.ms.toFixed(0)} ms · {out.feats.length} {activeGroup} metrics{out.roleKeys.length ? ` + ${out.roleKeys.length} style roles` : ''}{customWeights ? ' · custom weights' : ''}, {compareBasis === 'career' ? 'minutes-weighted percentiles + z-scores across each career' : 'league-season percentiles + season z-scores'}, league-strength adjusted (same method as Similar Teams) · click a row to open the player.
        </div>
      )}
    </div>
  );
}

export function buildPlayerExportElement(player, sd, results, imgs, summary) {
  const img = (u, size, round) => {
    const d = u && imgs[u];
    return d ? `<img src="${d}" style="width:${size}px;height:${size}px;object-fit:${round ? 'cover' : 'contain'};${round ? 'border-radius:50%;background:#111827;' : ''}flex-shrink:0"/>` : `<div style="width:${size}px;height:${size}px;flex-shrink:0"></div>`;
  };
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const el = document.createElement('div');
  el.setAttribute('style', 'position:fixed;left:-10000px;top:0;width:1080px;background:#09111e;color:#e2e8f4;font-family:Montserrat,sans-serif;padding:40px 48px 28px;box-sizing:border-box');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:8px">
      ${img(photoUrl(player.name, player.team), 68, true)}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748b">Players most similar to</div>
        <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em">${esc(player.name)} <span style="color:#64748b;font-weight:600">· ${esc(sd.season)}</span></div>
        <div style="font-size:15px;color:#94a3b8;margin-top:2px">${esc(sd.team)} · ${esc(sd.league)} · age ${esc(sd.age)} · ${esc(Number(sd.minutes).toLocaleString())} mins</div>
      </div>
      ${img(teamCrest(sd.team), 56)}
    </div>
    <div style="font-size:13px;color:#64748b;margin-bottom:22px">${esc(summary)}</div>
    <div style="display:flex;gap:16px;padding:0 18px 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#475569">
      <div style="width:34px"></div><div style="width:44px"></div><div style="flex:1">Player · team · league · season</div>
      <div style="width:50px;text-align:right">Age</div><div style="width:70px;text-align:right">Mins</div><div style="width:78px;text-align:right">Match</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${results.map((r, i) => `
        <div style="display:flex;align-items:center;gap:16px;background:#0c1424;border:1px solid #1e2d45;border-radius:10px;padding:10px 18px">
          <div style="width:34px;font-size:15px;font-weight:700;color:#475569;text-align:center">${i + 1}</div>
          ${img(photoUrl(r.p.name, r.p.team), 44, true)}
          <div style="flex:1;min-width:0">
            <div style="font-size:19px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.p.name)}</div>
            <div style="display:flex;align-items:center;gap:7px;margin-top:3px;font-size:13px;color:#94a3b8;white-space:nowrap">${img(teamCrest(r.sd.team), 18)}${esc(r.sd.team)} · ${esc(r.sd.league)} · ${esc(r.sd.season)}</div>
          </div>
          <div style="width:50px;text-align:right;font-size:16px;color:#cbd5e1">${esc(r.sd.age)}</div>
          <div style="width:70px;text-align:right;font-size:16px;color:#cbd5e1">${esc(Number(r.sd.minutes).toLocaleString())}</div>
          <div style="width:78px;text-align:right;font-size:26px;font-weight:800;color:${simColor(r.sim)}">${Math.round(r.sim)}%</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:20px;font-size:12px;color:#475569;text-align:right">${esc(date)}</div>`;
  return el;
}
