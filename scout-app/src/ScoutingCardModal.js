// ScoutingCardModal.js
// Small modal collecting the manual fields (notes, physical, form, club colour)
// then calls downloadScoutingCardPNG from PlayerScoutingCard.js

import React, { useState, useMemo } from 'react';
import { useIsMobile } from './utils';
import { downloadScoutingCardPNG } from './PlayerScoutingCard';

const inputStyle = {
  width: '100%', background: '#0d1424', border: '1px solid #1e2d4a', borderRadius: 5,
  color: '#fff', padding: '7px 9px', fontSize: 11.5, outline: 'none', fontFamily: 'inherit',
};
const labelStyle = { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, display: 'block' };
const sectionStyle = { marginBottom: 14 };
// Matches PlayerScoutingCard.js's own TREND_SEASON_ORDER (not exported from there) —
// keep in sync each season transition, same as the lists in QuickCard.js/PlayerCard.js.
const SEASON_ORDER = ['2018-19','2019-20','2020-21','2021','2021-22','2022','2022-23','2023','2023-24','2024','2024-25','2025','2025-26','2026','2026-27'];

export default function ScoutingCardModal({ player, players, onClose }) {
  const isMobile = useIsMobile();
  const [keyAttributes, setKeyAttributes] = useState('');
  const [devAreas, setDevAreas] = useState('');
  const [view, setView] = useState('');
  const [height, setHeight] = useState('');
  const [clubColor, setClubColor] = useState('#1a3a6b');
  const [currentLevel, setCurrentLevel] = useState('');
  const [currentScore, setCurrentScore] = useState(player.careerScore?.toFixed(0) || '70');
  const [potentialLevel, setPotentialLevel] = useState('');
  const [potentialScore, setPotentialScore] = useState((player.potentialScore || player.careerScore)?.toFixed(0) || '75');
  const [pace, setPace] = useState(3);
  const [power, setPower] = useState(3);
  const [fitness, setFitness] = useState(3);
  const [formRatings, setFormRatings] = useState(['', '', '', '', '']);
  const [currentStarsOverride, setCurrentStarsOverride] = useState('');
  const [potentialStarsOverride, setPotentialStarsOverride] = useState('');
  const [seasonAvgRatingOverride, setSeasonAvgRatingOverride] = useState('');
  const formAvg = (() => {
    const nums = formRatings.map(r => parseFloat(r)).filter(n => !isNaN(n));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  })();
  const [posImageFile, setPosImageFile] = useState(null);
  const [posImageDataUrl, setPosImageDataUrl] = useState('');
  const [playerPhotoDataUrl, setPlayerPhotoDataUrl] = useState('');
  const [playerPhotoUrl, setPlayerPhotoUrl] = useState('');
  const [hideTeamBadge, setHideTeamBadge] = useState(false);
  const [iphoneExport, setIphoneExport] = useState(false);
  const [nameOverride, setNameOverride] = useState('');
  const [valueOverride, setValueOverride] = useState('');
  const [contractOverride, setContractOverride] = useState('');
  const [positionOverride, setPositionOverride] = useState('');
  const [footOverride, setFootOverride] = useState('');
  const [statsOverrides, setStatsOverrides] = useState({apps:'',gls:'',asts:'',xg:'',xa:'',mins:''});
  const [birthDate, setBirthDate] = useState('');
  const [importanceOverride, setImportanceOverride] = useState('');
  const [positionColors, setPositionColors] = useState({});
  const [selectedSeasonKey, setSelectedSeasonKey] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('');
  const [seasonStatsLabel, setSeasonStatsLabel] = useState('');
  const [busy, setBusy] = useState(false);
  // Team / badge override — same component/logic as QuickCard's "Display Club"
  // picker: teamOverride is free-text team NAME only; teamPick (from search)
  // swaps name + badge + league + flag together. Neither touches which
  // season's stats are shown (selectedSeasonKey/selectedLeague above).
  const [teamOverride, setTeamOverride] = useState('');
  const [teamPick, setTeamPick] = useState(null);
  const [teamPickQuery, setTeamPickQuery] = useState('');
  const teamPickChoices = useMemo(() => {
    const fold = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = fold(teamPickQuery.trim());
    if (q.length < 2) return [];
    const seen = new Set();
    const out = [];
    for (const p of (players || [])) {
      if (!p || !p.team || seen.has(p.team)) continue;
      if (!fold(p.team).includes(q)) continue;
      seen.add(p.team);
      out.push({ team: p.team, league: p.league || '', fotmobId: p.teamFotmobId || '' });
      if (out.length >= 10) break;
    }
    return out;
  }, [players, teamPickQuery]);

  const handlePosImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPosImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setPosImageDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handlePlayerPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPlayerPhotoDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await downloadScoutingCardPNG(player, {
        keyAttributes, devAreas, view, height, clubColor,
        currentLevel, currentScore: Number(currentScore),
        potentialLevel, potentialScore: Number(potentialScore),
        physical: { Pace: pace, Power: power, Fitness: fitness },
        formRatings,
        currentStarsOverride,
        potentialStarsOverride,
        seasonAvgRatingOverride,
        avgRating5: formAvg !== null ? formAvg.toFixed(1) : '',
        positionImageDataUrl: posImageDataUrl,
        playerPhotoDataUrl,
        playerPhotoUrl,
        hideTeamBadge,
        iphoneExport,
        nameOverride,
        valueOverride,
        contractOverride,
        positionOverride,
        footOverride,
        statsOverrides,
        birthDate,
        importanceOverride,
        positionColors,
        selectedSeasonKey: selectedSeasonKey || undefined,
        selectedLeague: selectedLeague || undefined,
        seasonStatsLabel: seasonStatsLabel || undefined,
        teamOverride: teamOverride || undefined,
        teamPick,
      });
    } catch (err) {
      alert('Failed to generate card: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'center', padding: isMobile ? 6 : 20,
    }} onClick={onClose}>
      <div style={{
        background: '#0c1424', borderRadius: 10, border: '1px solid #1e2d45',
        width: isMobile ? '100%' : 480, maxWidth: isMobile ? 480 : undefined,
        boxSizing: isMobile ? 'border-box' : undefined,
        maxHeight: isMobile ? '97vh' : '88vh', overflowY: 'auto',
        WebkitOverflowScrolling: 'touch', padding: isMobile ? 14 : 22,
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Scouting Card — {player.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Season / Team for Card</label>
            <select style={inputStyle} value={selectedSeasonKey + '||' + selectedLeague} onChange={e => {
              const [sk, sl] = e.target.value.split('||');
              setSelectedSeasonKey(sk === 'auto' ? '' : sk);
              setSelectedLeague(sl === 'auto' ? '' : sl);
            }}>
              <option value="auto||auto">Auto (most recent)</option>
              {(()=>{
                // Every row the player has (youth, continental, international included) —
                // same source and no type filter as QuickCard's season picker. The
                // Performance Trend chart below applies its OWN separate 400+ min,
                // standard/hidden-only qualifying filter; that's a quality gate on the
                // trend line, not a reason to hide these rows from the picker.
                const seen=new Set();
                const rowTypeRank = (s) => ({ continental: 1, international: 2 }[s && s.type] ?? 0);
                return (player.allSeasonsSummary || [])
                  .filter(s => s && s.s)
                  .filter(s => { const k=`${s.s}||${s.l}`; if(seen.has(k)) return false; seen.add(k); return true; })
                  .sort((a,b) => (SEASON_ORDER.indexOf(b.s) - SEASON_ORDER.indexOf(a.s)) || (rowTypeRank(a) - rowTypeRank(b)))
                .map((s, i) => (
                  <option key={`${s.s}-${s.l}-${i}`} value={`${s.s}||${s.l}`}>
                    {s.s} — {s.team}{s.l ? ` (${(s.l||'').replace('England ','Eng ').replace('Scotland ','Sco ')})` : ''}
                  </option>
                ))})()}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Name Override</label>
            <input style={inputStyle} value={nameOverride} onChange={e => setNameOverride(e.target.value)} placeholder={player.name} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Position Override (under name)</label>
            <input style={inputStyle} value={positionOverride} onChange={e => setPositionOverride(e.target.value)} placeholder="e.g. Striker (CF)" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Value Override</label>
            <input style={inputStyle} value={valueOverride} onChange={e => setValueOverride(e.target.value)} placeholder="e.g. €35m" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Contract Override</label>
            <input style={inputStyle} value={contractOverride} onChange={e => setContractOverride(e.target.value)} placeholder="e.g. 2027" />
          </div>
          <div style={{ width: 110 }}>
            <label style={labelStyle}>Foot</label>
            <select style={inputStyle} value={footOverride} onChange={e => setFootOverride(e.target.value)}>
              <option value="">Auto</option>
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div style={{ width: 130 }}>
            <label style={labelStyle}>Birth Date (optional)</label>
            <input style={inputStyle} value={birthDate} onChange={e => setBirthDate(e.target.value)} placeholder="23/9/2003" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Importance (under team name)</label>
            <select style={inputStyle} value={importanceOverride} onChange={e => setImportanceOverride(e.target.value)}>
              <option value="">Auto (by minutes %)</option>
              <option value="Crucial Player">Crucial Player</option>
              <option value="Important Player">Important Player</option>
              <option value="Rotation Player">Rotation Player</option>
              <option value="Fringe Player">Fringe Player</option>
              <option value="On Loan">On Loan</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Team Name</label>
            <input style={inputStyle} value={teamOverride} onChange={e => setTeamOverride(e.target.value)} placeholder={player.team} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Badge (search any club)</label>
            {teamPick ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {teamPick.team}<span style={{ color: '#64748b' }}> — {teamPick.league || '—'}</span>
                  </span>
                </div>
                <button type="button" onClick={() => { setTeamPick(null); setTeamPickQuery(''); }}
                  style={{ padding: '6px 10px', background: 'none', border: '1px solid #1e2d45', borderRadius: 6, color: '#f87171', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <>
                <input style={inputStyle} value={teamPickQuery}
                  onChange={e => setTeamPickQuery(e.target.value)} placeholder="Search any club…" />
                {teamPickQuery.trim().length >= 2 && (
                  <div style={{ border: '1px solid #1e2d45', borderRadius: 6, marginTop: 4, maxHeight: 168, overflowY: 'auto', background: '#0e1e38' }}>
                    {teamPickChoices.length ? teamPickChoices.map(t => (
                      <div key={`${t.team}|${t.league}`}
                        onClick={() => { setTeamPick(t); setTeamPickQuery(''); }}
                        style={{ padding: '6px 9px', fontSize: 11.5, color: '#e2e8f4', cursor: 'pointer', borderBottom: '1px solid #13233d' }}>
                        {t.team}<span style={{ color: '#64748b' }}> — {t.league || '—'}</span>
                      </div>
                    )) : (
                      <div style={{ padding: '6px 9px', fontSize: 11, color: '#64748b' }}>No match.</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div style={{ marginTop: -8, marginBottom: 14, fontSize: 10, color: '#6b7a99' }}>
          Swaps club name, badge, league name and flag. Stats stay from the selected season above.
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Key Attributes</label>
          <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={keyAttributes} onChange={e => setKeyAttributes(e.target.value)} placeholder="Acceleration, pace, taking contact..." />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Development Areas</label>
          <textarea style={{ ...inputStyle, minHeight: 40, resize: 'vertical' }} value={devAreas} onChange={e => setDevAreas(e.target.value)} placeholder="Finishing, availability, consistency" />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Scout View</label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={view} onChange={e => setView(e.target.value)} placeholder="Fitness / injuries have stalled..." />
        </div>

        <div style={{ marginTop: -8, marginBottom: 14, fontSize: 11, textAlign: 'right' }}>
          <span style={{ color: (keyAttributes.length + devAreas.length + view.length) > 373 ? '#ef4444' : '#6b7a99' }}>
            {keyAttributes.length + devAreas.length + view.length} / 373 characters
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Height</label>
            <input style={inputStyle} value={height} onChange={e => setHeight(e.target.value)} placeholder="5'11" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Club Colour (hex)</label>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 6 }}>
              {[
                ['Red Dark', '#7f1d1d'], ['Red Light', '#ef4444'],
                ['Blue Dark', '#1e3a5f'], ['Blue Light', '#3b82f6'],
                ['Green Dark', '#14532d'], ['Green Light', '#22c55e'],
                ['Yellow Dark', '#78350f'], ['Yellow Light', '#f59e0b'],
                ['Purple Dark', '#4c1d95'], ['Purple Light', '#a855f7'],
                ['Black Dark', '#0a0a0a'], ['Black Light', '#27272a'],
                ['White Dark', '#9ca3af'], ['White Light', '#e5e7eb'],
                ['Orange Dark', '#7c2d12'], ['Orange Light', '#f97316'],
                ['Maroon Dark', '#450a0a'], ['Maroon Light', '#991b1b'],
                ['Navy Dark', '#0c1844'], ['Navy Light', '#1a3a6b'],
              ].map(([label, hex]) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  onClick={() => setClubColor(hex)}
                  style={{
                    width: 22, height: 22, borderRadius: 4, background: hex, flexShrink: 0, cursor: 'pointer',
                    border: clubColor === hex ? '2px solid #fff' : '1px solid #1e2d4a',
                  }}
                />
              ))}
            </div>
            <input style={inputStyle} value={clubColor} onChange={e => setClubColor(e.target.value)} placeholder="#1a3a6b" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Current Level Label</label>
            <input style={inputStyle} value={currentLevel} onChange={e => setCurrentLevel(e.target.value)} placeholder="Very Good Champ ST" />
          </div>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Score</label>
            <input style={inputStyle} type="number" value={currentScore} onChange={e => setCurrentScore(e.target.value)} />
          </div>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Stars</label>
            <input style={inputStyle} type="number" step="0.1" value={currentStarsOverride} onChange={e => setCurrentStarsOverride(e.target.value)} placeholder="auto" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Potential Level Label</label>
            <input style={inputStyle} value={potentialLevel} onChange={e => setPotentialLevel(e.target.value)} placeholder="Good Top 5 EU League ST" />
          </div>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Score</label>
            <input style={inputStyle} type="number" value={potentialScore} onChange={e => setPotentialScore(e.target.value)} />
          </div>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Stars</label>
            <input style={inputStyle} type="number" step="0.1" value={potentialStarsOverride} onChange={e => setPotentialStarsOverride(e.target.value)} placeholder="auto" />
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Physical (1–5)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['Pace', pace, setPace], ['Power', power, setPower], ['Fitness', fitness, setFitness]].map(([lbl, val, setter]) => (
              <div key={lbl} style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, color: '#9ca3af', marginBottom: 3 }}>{lbl}</div>
                <input type="range" min={1} max={5} step={0.5} value={val} onChange={e => setter(Number(e.target.value))} style={{ width: '100%' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: '#fff' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Last 5 Match Ratings</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {formRatings.map((r, i) => (
              <input
                key={i}
                style={{ ...inputStyle, textAlign: 'center', padding: '7px 4px' }}
                value={r}
                onChange={e => {
                  const next = [...formRatings];
                  next[i] = e.target.value;
                  setFormRatings(next);
                }}
                placeholder="6.9"
              />
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#6b7a99', marginTop: 6 }}>
            Average: {formAvg !== null ? formAvg.toFixed(1) : '—'} (colour and average calculated automatically)
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Season Stats Avg Rating Override</label>
          <input style={inputStyle} value={seasonAvgRatingOverride} onChange={e => setSeasonAvgRatingOverride(e.target.value)} placeholder="auto from data" />
          <div style={{ fontSize: 10, color: '#6b7a99', marginTop: 4 }}>
            This is the "Av Rat" pill in the Season Stats row (left panel) — separate from the Last 5 Match Ratings above.
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Season Stats Overrides</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['apps','Apps'],['gls','Gls'],['asts','Asts'],['xg','xG'],['xa','xA'],['mins','Mins']].map(([k,lab]) => (
              <div key={k}>
                <label style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 3 }}>{lab}</label>
                <input style={inputStyle} value={statsOverrides[k]} onChange={e => setStatsOverrides(s => ({...s, [k]: e.target.value}))} placeholder="auto" />
              </div>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Season Stats Header Label</label>
          <input style={inputStyle} value={seasonStatsLabel} onChange={e => setSeasonStatsLabel(e.target.value)} placeholder="Season Stats" />
          <div style={{ fontSize: 10, color: '#6b7a99', marginTop: 4 }}>Override the "Season Stats" title — e.g. "24-25 Stats"</div>

        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Player Photo Override</label>
          <input type="file" accept="image/*" onChange={handlePlayerPhoto} style={{ fontSize: 11, color: '#94a3b8' }} />
          {playerPhotoDataUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <img src={playerPhotoDataUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              <button onClick={() => setPlayerPhotoDataUrl('')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#6b7a99', margin: '6px 0 4px' }}>or paste an image URL</div>
          <input style={inputStyle} value={playerPhotoUrl} onChange={e => setPlayerPhotoUrl(e.target.value)} placeholder="https://images.fotmob.com/image_resources/playerimages/209405.png" />
        </div>

        <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="hideTeamBadge" checked={hideTeamBadge} onChange={e => setHideTeamBadge(e.target.checked)} />
            <label htmlFor="hideTeamBadge" style={{ fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>Hide team badge</label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="iphoneExport" checked={iphoneExport} onChange={e => setIphoneExport(e.target.checked)} />
            <label htmlFor="iphoneExport" style={{ fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>iPhone Export</label>
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Position Map Colours</label>
          <div style={{ fontSize: 10, color: '#6b7a99', marginBottom: 8 }}>
            Leave all on Auto to default to grey dots with the player's primary position highlighted Primary (Dark Green).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['GK', 'Goalkeeper'],
              ['LB', 'Left Back'], ['LCB', 'Left Centre Back'], ['RCB', 'Right Centre Back'], ['RB', 'Right Back'],
              ['LWB', 'Left Wingback'], ['RWB', 'Right Wingback'],
              ['DM', 'Defensive Midfielder'], ['CM', 'Central Midfielder'], ['AM', 'Attacking Midfielder'],
              ['LW', 'Left Winger'], ['RW', 'Right Winger'],
              ['ST', 'Striker'],
            ].map(([slot, label]) => (
              <div key={slot}>
                <div style={{ fontSize: 9.5, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
                <select
                  style={{ ...inputStyle, fontSize: 10.5, padding: '5px 7px' }}
                  value={positionColors[slot] || ''}
                  onChange={e => setPositionColors({ ...positionColors, [slot]: e.target.value })}
                >
                  <option value="">Auto / Default (Grey)</option>
                  <option value="Primary">Primary (Dark Green) #00bf63</option>
                  <option value="Secondary">Secondary (Green) #7ed957</option>
                  <option value="Third">Third (Light Green) #c1ff72</option>
                  <option value="Fourth">Fourth (Yellow) #ffde59</option>
                  <option value="Fifth">Fifth (Peach) #ffbd59</option>
                  <option value="Sixth">Sixth (Orange) #ff914d</option>
                  <option value="Seventh">Seventh (Red) #ff3131</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Position Diagram Image</label>
          <input type="file" accept="image/*" onChange={handlePosImage} style={{ fontSize: 11, color: '#94a3b8' }} />
        </div>

        <button
          onClick={handleGenerate}
          disabled={busy}
          style={{
            width: '100%', background: busy ? '#374151' : '#fff', color: busy ? '#9ca3af' : '#000',
            border: 'none', borderRadius: 6, padding: '11px 0', fontSize: 13, fontWeight: 800,
            cursor: busy ? 'default' : 'pointer', marginTop: 6,
          }}
        >
          {busy ? 'Generating…' : '🖼 Generate & Download PNG'}
        </button>
      </div>
    </div>
  );
}
