// CoachBuilder.js — manual entry modal for a Coach profile. Opened as a button/modal
// from Team Index or Team Card. All fields are typed in by hand since there's no
// coach dataset — tenure (which team+seasons count toward this coach's record) is
// picked from the existing Team Index data, everything else computed from that
// selection via coachMetrics.js, except the fields explicitly called out as manual
// (Clubs/PPG/Contract, narrative bullets, Current/Potential Level, Form, formations,
// trait overrides).
import React, { useState, useMemo } from 'react';
import { newCoachId, upsertCoach } from './coachStorage';

const FORMATIONS = ['4-3-3', '5-4-1', '4-4-2', '4-2-3-1', '3-5-2', '4-1-4-1'];
const TRAIT_KEYS = ['possession', 'pressing', 'passing', 'adaptability', 'youthDevelopment', 'attacking', 'setPieces', 'defensive', 'directness'];
const TRAIT_LABELS = { possession: 'Possession', pressing: 'Pressing', passing: 'Passing', adaptability: 'Adaptability', youthDevelopment: 'Youth Development', attacking: 'Attacking', setPieces: 'Set Pieces', defensive: 'Defensive', directness: 'Directness' };

const inputStyle = { width: '100%', background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 5, padding: '6px 8px', color: '#e2e8f4', fontSize: 12, outline: 'none' };
const labelStyle = { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 };
const sectionStyle = { marginBottom: 16 };

export default function CoachBuilder({ allTeams = [], existingCoach = null, onClose, onSaved }) {
  const [name, setName] = useState(existingCoach?.name || '');
  const [nationality, setNationality] = useState(existingCoach?.nationality || '');
  const [dob, setDob] = useState(existingCoach?.dob || '');
  const [photoDataUrl, setPhotoDataUrl] = useState(existingCoach?.photoDataUrl || '');
  const [fotmobId, setFotmobId] = useState(existingCoach?.fotmobId || '');
  const [clubs, setClubs] = useState(existingCoach?.clubs ?? '');
  const [ppg, setPpg] = useState(existingCoach?.ppg ?? '');
  const [contract, setContract] = useState(existingCoach?.contract || '');
  // formations: array of up to 3, primary first. Migrate from legacy single `formation` field.
  const [formations, setFormations] = useState(
    existingCoach?.formations?.length
      ? existingCoach.formations
      : existingCoach?.formation
        ? [existingCoach.formation]
        : ['4-3-3']
  );
  const [tenures, setTenures] = useState(existingCoach?.tenures || []); // [{team, league, season}]
  const [playStyle, setPlayStyle] = useState(existingCoach?.playStyle || '');
  const [development, setDevelopment] = useState(existingCoach?.development || '');
  const [view, setView] = useState(existingCoach?.view || '');
  const [currentStars, setCurrentStars] = useState(existingCoach?.currentStars ?? 3);
  const [currentLabel, setCurrentLabel] = useState(existingCoach?.currentLabel || '');
  const [potentialStars, setPotentialStars] = useState(existingCoach?.potentialStars ?? 3.5);
  const [potentialLabel, setPotentialLabel] = useState(existingCoach?.potentialLabel || '');
  const [form, setForm] = useState(existingCoach?.form || ['W', 'W', 'D', 'L', 'W']); // last 5, oldest->newest
  const [traitOverrides, setTraitOverrides] = useState(existingCoach?.traitOverrides || {});

  // Toggle a formation on/off (max 3). Order of selection becomes primary/secondary/tertiary.
  const toggleFormation = (f) => {
    setFormations(prev => {
      if (prev.includes(f)) return prev.filter(x => x !== f);
      if (prev.length >= 3) return prev; // already at max — must deselect one first
      return [...prev, f];
    });
  };

  // Tenure picker: search team+season combos from the already-loaded Team Index data.
  const [tenureSearch, setTenureSearch] = useState('');
  const tenureOptions = useMemo(() => {
    if (!tenureSearch.trim()) return [];
    const q = tenureSearch.toLowerCase();
    return allTeams
      .filter(t => t.team.toLowerCase().includes(q))
      .filter(t => !tenures.some(x => x.team === t.team && x.league === t.league && x.season === t.season))
      .slice(0, 20);
  }, [tenureSearch, allTeams, tenures]);

  const addTenure = (t) => {
    setTenures(prev => [...prev, { team: t.team, league: t.league, season: t.season }]);
    setTenureSearch('');
  };
  const removeTenure = (i) => setTenures(prev => prev.filter((_, idx) => idx !== i));

  const handlePhotoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setPhotoDataUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  const setFormResult = (i, val) => setForm(prev => prev.map((r, idx) => idx === i ? val : r));

  const toggleTraitOverride = (key) => {
    setTraitOverrides(prev => {
      const next = { ...prev };
      if (next[key] != null) delete next[key];
      else next[key] = 5;
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) { alert('Name is required.'); return; }
    if (!tenures.length) { alert('Add at least one team/season to this coach\'s tenure.'); return; }
    if (!formations.length) { alert('Select at least one formation.'); return; }
    const coach = {
      id: existingCoach?.id || newCoachId(),
      name: name.trim(),
      nationality: nationality.trim(),
      dob,
      photoDataUrl,
      fotmobId: (() => { const raw = fotmobId.trim(); const m = raw.match(/(\d{5,})/); return m ? m[1] : (raw || null); })(),
      role: 'Head Coach',
      clubs: clubs === '' ? null : Number(clubs),
      ppg: ppg === '' ? null : Number(ppg),
      contract,
      formation: formations[0],   // backward compat — primary formation
      formations,                 // full ordered array for the card
      tenures,
      playStyle,
      development,
      view,
      currentStars: Number(currentStars),
      currentLabel,
      potentialStars: Number(potentialStars),
      potentialLabel,
      form,
      traitOverrides,
      updatedAt: new Date().toISOString(),
    };
    upsertCoach(coach);
    if (onSaved) onSaved(coach);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,10,0.94)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#09111e', border: '1px solid #1e2d45', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto', padding: '20px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{existingCoach ? 'Edit Coach' : 'New Coach'}</div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e2d45', color: '#94a3b8', borderRadius: 6, width: 28, height: 28, cursor: 'pointer' }}>×</button>
        </div>

        {/* Info */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><span style={labelStyle}>Name</span><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Eder Sarabia" /></div>
            <div><span style={labelStyle}>Nationality</span><input style={inputStyle} value={nationality} onChange={e => setNationality(e.target.value)} placeholder="Spain" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><span style={labelStyle}>Date of Birth</span><input style={inputStyle} type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
            <div><span style={labelStyle}>Clubs</span><input style={inputStyle} type="number" value={clubs} onChange={e => setClubs(e.target.value)} placeholder="2" /></div>
            <div><span style={labelStyle}>Contract</span><input style={inputStyle} value={contract} onChange={e => setContract(e.target.value)} placeholder="2027" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><span style={labelStyle}>PPG</span><input style={inputStyle} type="number" step="0.01" value={ppg} onChange={e => setPpg(e.target.value)} placeholder="1.53" /></div>
            <div>
              <span style={labelStyle}>Fotmob ID or URL</span>
              <input style={inputStyle} value={fotmobId} onChange={e => setFotmobId(e.target.value)} placeholder="1381560 or full Fotmob URL" />
              <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>Paste full URL or just the numeric ID</div>
            </div>
            <div>
              <span style={labelStyle}>Photo (upload)</span>
              <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e.target.files[0])} style={{ fontSize: 10, color: '#94a3b8' }} />
              <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>Overrides Fotmob if set</div>
            </div>
          </div>
          {photoDataUrl && <img src={photoDataUrl} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
        </div>

        {/* Formation — multi-select up to 3, order = primary/secondary/tertiary */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Formation</div>
            <div style={{ fontSize: 9, color: '#475569' }}>
              Select up to 3 · first selected = primary &nbsp;
              {formations.length > 0 && (
                <span style={{ color: '#60a5fa' }}>{formations.join(' › ')}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {FORMATIONS.map(f => {
              const idx = formations.indexOf(f);
              const selected = idx !== -1;
              const orderLabel = selected ? ['①', '②', '③'][idx] : null;
              return (
                <button
                  key={f}
                  onClick={() => toggleFormation(f)}
                  style={{
                    flex: '1 1 calc(33% - 8px)',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1px solid ${selected ? '#3b7de8' : '#1e2d45'}`,
                    background: selected ? '#0e2040' : 'transparent',
                    color: selected ? '#60a5fa' : '#94a3b8',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  {f}{orderLabel && <span style={{ fontSize: 13 }}>{orderLabel}</span>}
                </button>
              );
            })}
          </div>
          {formations.length >= 3 && (
            <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 6 }}>Max 3 formations — deselect one to change.</div>
          )}
        </div>

        {/* Tenure — team/season picker */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Tenure (team + seasons this coach's record covers)</div>
          <input style={inputStyle} value={tenureSearch} onChange={e => setTenureSearch(e.target.value)} placeholder="Search team…" />
          {tenureOptions.length > 0 && (
            <div style={{ border: '1px solid #1e2d45', borderRadius: 6, marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
              {tenureOptions.map((t, i) => (
                <div key={t.team + t.league + t.season + i} onClick={() => addTenure(t)} style={{ padding: '6px 10px', fontSize: 11, color: '#e2e8f4', cursor: 'pointer', borderBottom: '1px solid #131c2e' }}>
                  {t.team} — {t.league} · {t.season}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {tenures.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d1624', border: '1px solid #1e2d45', borderRadius: 6, padding: '5px 10px' }}>
                <span style={{ fontSize: 11, color: '#e2e8f4' }}>{t.team} — {t.league} · {t.season}</span>
                <button onClick={() => removeTenure(i)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13 }}>×</button>
              </div>
            ))}
            {!tenures.length && <div style={{ fontSize: 10, color: '#475569' }}>No seasons added yet — search above.</div>}
          </div>
        </div>

        {/* Narrative */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Narrative</div>
          <div style={{ marginBottom: 8 }}><span style={labelStyle}>Play Style</span><textarea style={{ ...inputStyle, minHeight: 44, resize: 'vertical' }} value={playStyle} onChange={e => setPlayStyle(e.target.value)} /></div>
          <div style={{ marginBottom: 8 }}><span style={labelStyle}>Development</span><textarea style={{ ...inputStyle, minHeight: 44, resize: 'vertical' }} value={development} onChange={e => setDevelopment(e.target.value)} /></div>
          <div><span style={labelStyle}>View</span><textarea style={{ ...inputStyle, minHeight: 44, resize: 'vertical' }} value={view} onChange={e => setView(e.target.value)} /></div>
        </div>

        {/* Current / Potential Level */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Current / Potential Level</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span style={labelStyle}>Current Level Stars (0-5, 0.5 steps)</span>
              <input style={inputStyle} type="number" min={0} max={5} step={0.5} value={currentStars} onChange={e => setCurrentStars(e.target.value)} />
              <input style={{ ...inputStyle, marginTop: 4 }} value={currentLabel} onChange={e => setCurrentLabel(e.target.value)} placeholder="Lower Top 5 EU League Manager" />
            </div>
            <div>
              <span style={labelStyle}>Potential Level Stars</span>
              <input style={inputStyle} type="number" min={0} max={5} step={0.5} value={potentialStars} onChange={e => setPotentialStars(e.target.value)} />
              <input style={{ ...inputStyle, marginTop: 4 }} value={potentialLabel} onChange={e => setPotentialLabel(e.target.value)} placeholder="Good Premier League Manager" />
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Form (last 5, oldest → newest)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {form.map((r, i) => (
              <select
                key={i}
                value={r}
                onChange={e => setFormResult(i, e.target.value)}
                style={{
                  width: '100%',
                  background: '#0d1220',
                  border: '1px solid #1e2d45',
                  borderRadius: 5,
                  padding: '8px 4px',
                  color: r === 'W' ? '#22c55e' : r === 'D' ? '#f59e0b' : '#ef4444',
                  fontSize: 14,
                  fontWeight: 800,
                  outline: 'none',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <option value="W" style={{ color: '#22c55e' }}>W</option>
                <option value="D" style={{ color: '#f59e0b' }}>D</option>
                <option value="L" style={{ color: '#ef4444' }}>L</option>
              </select>
            ))}
          </div>
        </div>

        {/* Trait overrides */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#c8d4e8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Coaching Trait Overrides (optional — leave off to auto-compute)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {TRAIT_KEYS.map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={traitOverrides[key] != null} onChange={() => toggleTraitOverride(key)} />
                <span style={{ fontSize: 10, color: '#94a3b8', flex: 1 }}>{TRAIT_LABELS[key]}</span>
                {traitOverrides[key] != null && (
                  <input type="number" min={1} max={10} value={traitOverrides[key]} onChange={e => setTraitOverrides(prev => ({ ...prev, [key]: Number(e.target.value) }))} style={{ width: 40, background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 4, color: '#e2e8f4', fontSize: 11, padding: '2px 4px' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#3b7de8', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Save Coach</button>
        </div>
      </div>
    </div>
  );
}
