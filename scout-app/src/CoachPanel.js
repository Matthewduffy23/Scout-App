// CoachPanel.js — the management screen for saved coaches: list, create, edit,
// delete, export/import backup, and generate/download a coach's card PNG. This
// is the piece that actually wires together the other four coach files:
// coachStorage (persistence) -> CoachBuilder (entry form) -> coachMetrics
// (trait computation) -> CoachCard (PNG render/download).
import React, { useState, useEffect, useMemo } from 'react';
import CoachBuilder from './CoachBuilder';
import { loadCoaches, deleteCoach, exportCoaches, importCoachesFile } from './coachStorage';
import { computeCoachTraits } from './coachMetrics';
import { downloadCoachCardPNG } from './CoachCard';

export default function CoachPanel({ allTeams = [], onClose }) {
  const [coaches, setCoaches] = useState(() => loadCoaches());
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingCoach, setEditingCoach] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const importInputRef = React.useRef(null);

  const refresh = () => setCoaches(loadCoaches());

  // Resolve a coach's tenure (their picked {team, league, season} entries) into
  // the actual matching rows from teams_final.json, so traits/card generation
  // have real stat data to work with.
  const resolveTenureRows = (coach) => {
    return (coach.tenures || [])
      .map(t => allTeams.find(x => x.team === t.team && x.league === t.league && x.season === t.season))
      .filter(Boolean);
  };

  const handleNew = () => { setEditingCoach(null); setShowBuilder(true); };
  const handleEdit = (coach) => { setEditingCoach(coach); setShowBuilder(true); };
  const handleDelete = (coach) => {
    if (!window.confirm(`Delete ${coach.name}? This can't be undone (unless you have an export backup).`)) return;
    setCoaches(deleteCoach(coach.id));
  };
  const handleSaved = () => { refresh(); setShowBuilder(false); };

  const handleGenerateCard = async (coach) => {
    const tenureRows = resolveTenureRows(coach);
    if (!tenureRows.length) {
      alert("This coach's saved tenure doesn't match any teams currently in the data — the underlying team-season data may have changed. Try editing the coach and re-picking their seasons.");
      return;
    }
    setGeneratingId(coach.id);
    try {
      const traits = computeCoachTraits(tenureRows, allTeams);
      await downloadCoachCardPNG(coach, tenureRows, traits);
    } catch (err) {
      alert('Could not generate the card — check the browser console for details.');
      console.error(err);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleImportFile = (file) => {
    importCoachesFile(file, () => refresh());
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,10,0.94)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#09111e', border: '1px solid #1e2d45', borderRadius: 16, width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', padding: '20px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>Coaches</div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e2d45', color: '#94a3b8', borderRadius: 6, width: 28, height: 28, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={handleNew} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#3b7de8', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ New Coach</button>
          <button onClick={() => exportCoaches()} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>📥 Export Backup</button>
          <button onClick={() => importInputRef.current?.click()} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>📤 Import Backup</button>
          <input ref={importInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => { handleImportFile(e.target.files[0]); e.target.value = ''; }} />
        </div>

        {coaches.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            No coaches saved yet. Click "+ New Coach" to build your first one.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {coaches.map(coach => {
            const tenureCount = (coach.tenures || []).length;
            const latestTenure = [...(coach.tenures || [])].sort((a, b) => a.season < b.season ? 1 : -1)[0];
            return (
              <div key={coach.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0d1624', border: '1px solid #1e2d45', borderRadius: 8, padding: '10px 14px' }}>
                {coach.photoDataUrl
                  ? <img src={coach.photoDataUrl} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: 6, background: '#1e2d45', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{coach.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    {coach.nationality || '—'} · {tenureCount} season{tenureCount !== 1 ? 's' : ''}{latestTenure ? ` · latest: ${latestTenure.team} (${latestTenure.season})` : ''}
                  </div>
                </div>
                <button onClick={() => handleGenerateCard(coach)} disabled={generatingId === coach.id} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #3b7de8', background: generatingId === coach.id ? '#1e2d45' : 'transparent', color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: generatingId === coach.id ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                  {generatingId === coach.id ? 'Generating…' : '⬇ Card'}
                </button>
                <button onClick={() => handleEdit(coach)} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleDelete(coach)} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #1e2d45', background: 'transparent', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Delete</button>
              </div>
            );
          })}
        </div>
      </div>

      {showBuilder && (
        <CoachBuilder
          allTeams={allTeams}
          existingCoach={editingCoach}
          onClose={() => setShowBuilder(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
