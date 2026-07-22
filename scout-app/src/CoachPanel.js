// CoachPanel.js — the management screen for saved coaches: list, create, edit,
// delete, export/import backup, and generate/download a coach's card PNG. This
// is the piece that actually wires together the other four coach files:
// coachStorage (persistence) -> CoachBuilder (entry form) -> coachMetrics
// (trait computation) -> CoachCard (PNG render/download).
import React, { useState, useRef } from 'react';
import CoachBuilder from './CoachBuilder';
import { loadCoaches, deleteCoach, exportCoaches, importCoachesFile } from './coachStorage';
import { computeCoachTraits } from './coachMetrics';
import { downloadCoachCardPNG } from './CoachCard';
import { downloadCoachQuickCardPNG } from './CoachQuickCard';

const FIELD_LABELS = [
  ['games',  'Games'],
  ['gf',     'GF'],
  ['ga',     'GA'],
  ['xgP90',  'xG p90'],
  ['xgaP90', 'xGA p90'],
  ['ppg',    'PPG'],
  ['costPer','£ Per'],
];

function OverrideInput({ label, value, onCommit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <input
        type="number"
        value={value ?? ''}
        placeholder="auto"
        onChange={onCommit}
        style={{ width: 72, background: '#080f1c', border: '1px solid #1e2d45', borderRadius: 4, color: '#e2e8f4', fontSize: 11, padding: '4px 6px' }}
      />
    </div>
  );
}

function CoachStatOverrides({ coachId, overrides, onFieldChange, onClear }) {
  return (
    <div style={{ margin: '4px 0 6px 52px', padding: '10px 12px', background: '#060c18', border: '1px solid #1e2d45', borderRadius: 7 }}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>
        Override card stats — leave blank to use auto-calculated values. xG/xGA entered as per-90 (multiplied by matches on card).
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {FIELD_LABELS.map(function(pair) {
          var field = pair[0];
          var label = pair[1];
          return (
            <OverrideInput
              key={field}
              label={label}
              value={overrides[field]}
              onCommit={function(e) {
                var raw = e.target.value;
                onFieldChange(coachId, field, raw === '' ? undefined : Number(raw));
              }}
            />
          );
        })}
      </div>
      <button
        onClick={function() { onClear(coachId); }}
        style={{ marginTop: 8, fontSize: 10, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        Clear overrides
      </button>
    </div>
  );
}

function CoachRow({ coach, generatingId, generatingQuickId, expandedOverride, cardOverrides, onGenerate, onGenerateQuick, onToggleOverride, onEdit, onDelete, onFieldChange, onClear }) {
  var tenureCount = (coach.tenures || []).length;
  var sorted = (coach.tenures || []).slice().sort(function(a, b) { return a.season < b.season ? 1 : -1; });
  var latestTenure = sorted[0];
  var isExpanded = expandedOverride === coach.id;
  var overrideBorderColor = isExpanded ? '#60a5fa' : '#1e2d45';
  var overrideBg = isExpanded ? '#0e2040' : 'transparent';
  var overrideColor = isExpanded ? '#60a5fa' : '#64748b';
  var isGenerating = generatingId === coach.id;
  var isGenQuick = generatingQuickId === coach.id;
  return (
    <div key={coach.id}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0d1624', border: '1px solid #1e2d45', borderRadius: 8, padding: '10px 14px' }}>
        {coach.photoDataUrl
          ? <img src={coach.photoDataUrl} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 40, height: 40, borderRadius: 6, background: '#1e2d45', flexShrink: 0 }} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{coach.name}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>
            {coach.nationality || '—'} · {tenureCount} season{tenureCount !== 1 ? 's' : ''}{latestTenure ? ' · latest: ' + latestTenure.team + ' (' + latestTenure.season + ')' : ''}
          </div>
        </div>
        <button
          onClick={function() { onGenerate(coach); }}
          disabled={isGenerating}
          style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #3b7de8', background: isGenerating ? '#1e2d45' : 'transparent', color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: isGenerating ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {isGenerating ? 'Generating…' : '⬇ Card'}
        </button>
        <button
          onClick={function() { onGenerateQuick(coach); }}
          disabled={isGenQuick}
          style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #a855f7', background: isGenQuick ? '#1e2d45' : 'transparent', color: '#c084fc', fontSize: 11, fontWeight: 600, cursor: isGenQuick ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {isGenQuick ? 'Generating…' : '⚡ Quick'}
        </button>
        <button
          onClick={function() { onToggleOverride(coach.id); }}
          style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid ' + overrideBorderColor, background: overrideBg, color: overrideColor, fontSize: 11, cursor: 'pointer' }}
          title="Override card stats"
        >
          ✏️
        </button>
        <button onClick={function() { onEdit(coach); }} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Edit</button>
        <button onClick={function() { onDelete(coach); }} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #1e2d45', background: 'transparent', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Delete</button>
      </div>
      {isExpanded && (
        <CoachStatOverrides
          coachId={coach.id}
          overrides={cardOverrides[coach.id] || {}}
          onFieldChange={onFieldChange}
          onClear={onClear}
        />
      )}
    </div>
  );
}

export default function CoachPanel({ allTeams, onClose }) {
  var teams = allTeams || [];
  var importInputRef = useRef(null);
  var [coaches, setCoaches] = useState(function() { return loadCoaches(); });
  var [showBuilder, setShowBuilder] = useState(false);
  var [editingCoach, setEditingCoach] = useState(null);
  var [generatingId, setGeneratingId] = useState(null);
  var [generatingQuickId, setGeneratingQuickId] = useState(null);
  var [cardOverrides, setCardOverrides] = useState({});
  var [expandedOverride, setExpandedOverride] = useState(null);

  function refresh() { setCoaches(loadCoaches()); }

  function resolveTenureRows(coach) {
    return (coach.tenures || [])
      .map(function(t) { return teams.find(function(x) { return x.team === t.team && x.league === t.league && x.season === t.season; }); })
      .filter(Boolean);
  }

  function handleNew() { setEditingCoach(null); setShowBuilder(true); }
  function handleEdit(coach) { setEditingCoach(coach); setShowBuilder(true); }
  function handleSaved() { refresh(); setShowBuilder(false); }

  function handleDelete(coach) {
    if (!window.confirm('Delete ' + coach.name + '? This can\'t be undone (unless you have an export backup).')) return;
    setCoaches(deleteCoach(coach.id));
  }

  function handleToggleOverride(coachId) {
    setExpandedOverride(function(prev) { return prev === coachId ? null : coachId; });
  }

  function handleFieldChange(coachId, field, val) {
    setCardOverrides(function(prev) {
      var existing = prev[coachId] || {};
      var updated = Object.assign({}, existing);
      if (val === undefined) {
        delete updated[field];
      } else {
        updated[field] = val;
      }
      var next = Object.assign({}, prev);
      next[coachId] = updated;
      return next;
    });
  }

  function handleClear(coachId) {
    setCardOverrides(function(prev) {
      var next = Object.assign({}, prev);
      delete next[coachId];
      return next;
    });
  }

  async function handleGenerateCard(coach) {
    var tenureRows = resolveTenureRows(coach);
    if (!tenureRows.length) {
      alert("This coach's saved tenure doesn't match any teams currently in the data — the underlying team-season data may have changed. Try editing the coach and re-picking their seasons.");
      return;
    }
    var missingCount = (coach.tenures || []).length - tenureRows.length;
    if (missingCount > 0) {
      var resolvedKeys = new Set(tenureRows.map(function(t) { return t.team + '|' + t.league + '|' + t.season; }));
      var missing = (coach.tenures || []).filter(function(t) { return !resolvedKeys.has(t.team + '|' + t.league + '|' + t.season); });
      var proceed = window.confirm(
        missingCount + ' of ' + coach.tenures.length + ' saved season(s) couldn\'t be matched against the current team data and will be left out of this card:\n\n' +
        missing.map(function(t) { return t.team + ' — ' + t.league + ' · ' + t.season; }).join('\n') +
        '\n\nThis usually means the underlying team data was updated since you added that season. Generate the card anyway with just the ' + tenureRows.length + ' that matched?'
      );
      if (!proceed) return;
    }
    setGeneratingId(coach.id);
    try {
      var traits = computeCoachTraits(tenureRows, teams);
      var overrides = cardOverrides[coach.id] || {};
      await downloadCoachCardPNG(coach, tenureRows, traits, overrides);
    } catch (err) {
      alert('Could not generate the card — check the browser console for details.');
      console.error(err);
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleGenerateQuickCard(coach) {
    var tenureRows = resolveTenureRows(coach);
    if (!tenureRows.length) {
      alert("This coach's saved tenure doesn't match any teams currently in the data — the underlying team-season data may have changed. Try editing the coach and re-picking their seasons.");
      return;
    }
    var missingCount = (coach.tenures || []).length - tenureRows.length;
    if (missingCount > 0) {
      var resolvedKeys = new Set(tenureRows.map(function(t) { return t.team + '|' + t.league + '|' + t.season; }));
      var missing = (coach.tenures || []).filter(function(t) { return !resolvedKeys.has(t.team + '|' + t.league + '|' + t.season); });
      var proceed = window.confirm(
        missingCount + ' of ' + coach.tenures.length + ' saved season(s) couldn\'t be matched against the current team data and will be left out of this card:\n\n' +
        missing.map(function(t) { return t.team + ' — ' + t.league + ' · ' + t.season; }).join('\n') +
        '\n\nGenerate the quick card anyway with just the ' + tenureRows.length + ' that matched?'
      );
      if (!proceed) return;
    }
    setGeneratingQuickId(coach.id);
    try {
      var traits = computeCoachTraits(tenureRows, teams);
      var overrides = Object.assign({}, cardOverrides[coach.id] || {}, { allTeams: teams });
      await downloadCoachQuickCardPNG(coach, tenureRows, traits, overrides);
    } catch (err) {
      alert('Could not generate the quick card — check the browser console for details.');
      console.error(err);
    } finally {
      setGeneratingQuickId(null);
    }
  }

  function handleImportFile(file) {
    importCoachesFile(file, function() { refresh(); });
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,10,0.94)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#09111e', border: '1px solid #1e2d45', borderRadius: 16, width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', padding: '20px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>Coaches</div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e2d45', color: '#94a3b8', borderRadius: 6, width: 28, height: 28, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={handleNew} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#3b7de8', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ New Coach</button>
          <button onClick={function() { exportCoaches(); }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>📥 Export Backup</button>
          <button onClick={function() { if (importInputRef.current) importInputRef.current.click(); }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>📤 Import Backup</button>
          <input ref={importInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={function(e) { handleImportFile(e.target.files[0]); e.target.value = ''; }} />
        </div>

        {coaches.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            No coaches saved yet. Click "+ New Coach" to build your first one.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {coaches.map(function(coach) {
            return (
              <CoachRow
                key={coach.id}
                coach={coach}
                generatingId={generatingId}
                generatingQuickId={generatingQuickId}
                expandedOverride={expandedOverride}
                cardOverrides={cardOverrides}
                onGenerate={handleGenerateCard}
                onGenerateQuick={handleGenerateQuickCard}
                onToggleOverride={handleToggleOverride}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onFieldChange={handleFieldChange}
                onClear={handleClear}
              />
            );
          })}
        </div>

      </div>

      {showBuilder && (
        <CoachBuilder
          allTeams={teams}
          existingCoach={editingCoach}
          onClose={function() { setShowBuilder(false); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
