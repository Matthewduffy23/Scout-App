// CoachPanel.js — the management screen for saved coaches: list, create, edit,
// delete, export/import backup, and generate/download a coach's card PNG. This
// is the piece that actually wires together the other four coach files:
// coachStorage (persistence) -> CoachBuilder (entry form) -> coachMetrics
// (trait computation) -> CoachCard (PNG render/download).
import React, { useState, useRef, useMemo } from 'react';
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
  ['costPer','£ Perf.'],
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
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stats title</span>
          <input
            type="text"
            defaultValue={overrides.statsTitle == null ? '' : overrides.statsTitle}
            placeholder="Season Stats (default)"
            onBlur={function(e) { onFieldChange(coachId, 'statsTitle', e.target.value === '' ? undefined : e.target.value); }}
            style={{ width: 150, background: '#080f1c', border: '1px solid #1e2d45', borderRadius: 4, color: '#e2e8f4', fontSize: 11, padding: '4px 6px' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1', cursor: 'pointer', paddingBottom: 4 }}>
          <input type="checkbox" checked={!!overrides.hideCostPer} onChange={function(e) { onFieldChange(coachId, 'hideCostPer', e.target.checked || undefined); }} />
          Hide £ Perf.
        </label>
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

function TeamSeasonSearch({ label, valueObj, teams, onPick, onClear }) {
  var sv = useState('');
  var q = sv[0], setQ = sv[1];
  var ql = q.trim().toLowerCase();
  var results = ql.length >= 2
    ? teams.filter(function(t) { return String(t.team || '').toLowerCase().indexOf(ql) !== -1; })
        .sort(function(a, b) { return a.season < b.season ? 1 : -1; })
        .slice(0, 10)
    : [];
  var lbl = { fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' };
  var fieldStyle = { width: 190, background: '#080f1c', border: '1px solid #2b1e45', borderRadius: 4, color: '#e2e8f4', fontSize: 11, padding: '4px 6px' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
      <span style={lbl}>{label}</span>
      {valueObj ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 190, background: '#080f1c', border: '1px solid #2b1e45', borderRadius: 4, padding: '4px 6px', boxSizing: 'border-box' }}>
          <span style={{ fontSize: 11, color: '#e2e8f4', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valueObj.team} · {valueObj.season}</span>
          <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
        </div>
      ) : (
        <input type="text" value={q} placeholder="Search team…" onChange={function(e) { setQ(e.target.value); }} style={fieldStyle} />
      )}
      {!valueObj && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 5, width: 240, maxHeight: 180, overflowY: 'auto', background: '#0b1120', border: '1px solid #2b1e45', borderRadius: 6, marginTop: 2 }}>
          {results.map(function(t, i) {
            return (
              <div
                key={t.team + '|' + t.league + '|' + t.season + '|' + i}
                onClick={function() { onPick({ team: t.team, league: t.league, season: t.season }); setQ(''); }}
                style={{ padding: '5px 8px', fontSize: 11, color: '#cbd5e1', cursor: 'pointer', borderBottom: '1px solid #131c30', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                <b style={{ color: '#e2e8f4' }}>{t.team}</b> — {t.league} · {t.season}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CoachQuickOverrides({ coach, coachId, overrides, teams, onFieldChange, onClear }) {
  var latestT = (coach.tenures || []).slice().sort(function(a, b) { return a.season < b.season ? 1 : -1; })[0];
  var latestRow = latestT ? teams.find(function(x) { return x.team === latestT.team && x.league === latestT.league && x.season === latestT.season; }) : null;
  var sizeHint = latestRow && latestRow.leagueSize != null ? String(latestRow.leagueSize) : '20';

  var VR  = [['squadValue', 'Squad Cost', '£340m'], ['wageBill', 'Wage Bill*', '£120m'], ['odds', 'Betting Forecast', '5/1']];
  var TXT = [['agent', 'Agent', ''], ['formation', 'Formation', '4-3-3'], ['tenure', 'Tenure', '2024-Present']];
  var lbl = { fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' };
  var inp = { width: 100, background: '#080f1c', border: '1px solid #2b1e45', borderRadius: 4, color: '#e2e8f4', fontSize: 11, padding: '4px 6px' };
  var rankInp = Object.assign({}, inp, { width: 58 });
  function set(field, raw) { onFieldChange(coachId, field, raw === '' ? undefined : raw); }

  return (
    <div style={{ margin: '4px 0 6px 52px', padding: '10px 12px', background: '#0a0614', border: '1px solid #2b1e45', borderRadius: 7 }}>
      <div style={{ fontSize: 10, color: '#8b5cf6', marginBottom: 8, fontWeight: 700 }}>
        ⚡ Quick-card inputs — separate from the ⬇ Card overrides. Enter league rank only (size + avg age auto).
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {VR.map(function(f) {
          return (
            <div key={f[0]} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={lbl}>{f[1]} rank</span>
              <input type="number" value={overrides[f[0] + 'Rank'] == null ? '' : overrides[f[0] + 'Rank']} placeholder="3" onChange={function(e) { set(f[0] + 'Rank', e.target.value); }} style={inp} />
            </div>
          );
        })}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'flex-end' }}>
          <span style={lbl}>League Size</span>
          <span style={{ fontSize: 11, color: '#8b5cf6', padding: '4px 0' }}>{sizeHint} (auto)</span>
        </div>
        {TXT.map(function(f) {
          return (
            <div key={f[0]} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={lbl}>{f[1]}</span>
              <input type="text" value={overrides[f[0]] == null ? '' : overrides[f[0]]} placeholder={f[2]} onChange={function(e) { set(f[0], e.target.value); }} style={inp} />
            </div>
          );
        })}
        <TeamSeasonSearch
          label="Impact — A (red, main)"
          valueObj={overrides.impactA}
          teams={teams}
          onPick={function(o) { onFieldChange(coachId, 'impactA', o); }}
          onClear={function() { onFieldChange(coachId, 'impactA', undefined); }}
        />
        <TeamSeasonSearch
          label="Impact — B (blue)"
          valueObj={overrides.impactB}
          teams={teams}
          onPick={function(o) { onFieldChange(coachId, 'impactB', o); }}
          onClear={function() { onFieldChange(coachId, 'impactB', undefined); }}
        />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!overrides.unattached} onChange={function(e) { onFieldChange(coachId, 'unattached', e.target.checked || undefined); }} />
          Unattached (shows "Manager (Unattached)")
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!overrides.hidePills} onChange={function(e) { onFieldChange(coachId, 'hidePills', e.target.checked || undefined); }} />
          Hide Score / Potential
        </label>
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #1a1030' }}>
        <span style={lbl}>GBE — pass route (managers have no points; tick one to pass)</span>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!overrides.gbeC36} onChange={function(e) { onFieldChange(coachId, 'gbeC36', e.target.checked || undefined); }} />
            36 months cumulative (Band 1-5)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!overrides.gbeC24} onChange={function(e) { onFieldChange(coachId, 'gbeC24', e.target.checked || undefined); }} />
            24 months consecutive (Band 1-5)
          </label>
        </div>
        <div style={{ fontSize: 9, color: '#475569', marginTop: 5 }}>
          Auto-passes if managing in an England league or nationality is England / Scotland / Wales / N. Ireland / Ireland.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1', cursor: 'pointer', marginTop: 10 }}>
          <input type="checkbox" checked={!!overrides.gbeExceptions} onChange={function(e) { onFieldChange(coachId, 'gbeExceptions', e.target.checked || undefined); }} />
          Show Exceptions Panel note (orange)
        </label>
        {overrides.gbeExceptions ? (
          <textarea
            value={overrides.gbeExceptionsText == null ? '' : overrides.gbeExceptionsText}
            maxLength={160}
            placeholder="Why the exceptions panel applies (one–two lines)…"
            onChange={function(e) { onFieldChange(coachId, 'gbeExceptionsText', e.target.value === '' ? undefined : e.target.value); }}
            style={{ width: '100%', minHeight: 40, resize: 'vertical', marginTop: 6, background: '#080f1c', border: '1px solid #2b1e45', borderRadius: 4, color: '#e2e8f4', fontSize: 11, padding: '5px 7px', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.4 }}
          />
        ) : null}
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={lbl}>Biography (replaces the Impact radar when filled — max 350)</span>
        <textarea
          value={overrides.biography == null ? '' : overrides.biography}
          maxLength={350}
          placeholder="Leave blank to keep the Impact radar. Type a short bio to swap it in."
          onChange={function(e) { set('biography', e.target.value); }}
          style={{ width: '100%', minHeight: 66, resize: 'vertical', background: '#080f1c', border: '1px solid #2b1e45', borderRadius: 4, color: '#e2e8f4', fontSize: 12, padding: '6px 8px', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.45 }}
        />
        <span style={{ fontSize: 9, color: '#475569', textAlign: 'right' }}>{(overrides.biography || '').length}/350</span>
      </div>
      <button onClick={function() { onClear(coachId); }} style={{ marginTop: 8, fontSize: 10, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        Clear quick-card inputs
      </button>
    </div>
  );
}

function CoachRow({ coach, teams, generatingId, generatingQuickId, expandedOverride, cardOverrides, expandedQuick, quickOverrides, onGenerate, onGenerateQuick, onToggleOverride, onToggleQuick, onEdit, onDelete, onFieldChange, onClear, onQuickFieldChange, onQuickClear }) {
  var tenureCount = (coach.tenures || []).length;
  var sorted = (coach.tenures || []).slice().sort(function(a, b) { return a.season < b.season ? 1 : -1; });
  var latestTenure = sorted[0];
  var isExpanded = expandedOverride === coach.id;
  var overrideBorderColor = isExpanded ? '#60a5fa' : '#1e2d45';
  var overrideBg = isExpanded ? '#0e2040' : 'transparent';
  var overrideColor = isExpanded ? '#60a5fa' : '#64748b';
  var isGenerating = generatingId === coach.id;
  var isGenQuick = generatingQuickId === coach.id;
  var isQuickOpen = expandedQuick === coach.id;
  var quickBorder = isQuickOpen ? '#a855f7' : '#2b1e45';
  var quickBg = isQuickOpen ? '#2b1245' : 'transparent';
  var quickColor = isQuickOpen ? '#c084fc' : '#8b5cf6';
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
          onClick={function() { onToggleQuick(coach.id); }}
          style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid ' + quickBorder, background: quickBg, color: quickColor, fontSize: 11, cursor: 'pointer' }}
          title="Quick-card inputs (context, agent, formation, GBE, radar seasons)"
        >
          ⚙
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
      {isQuickOpen && (
        <CoachQuickOverrides
          coach={coach}
          coachId={coach.id}
          overrides={quickOverrides[coach.id] || {}}
          teams={teams}
          onFieldChange={onQuickFieldChange}
          onClear={onQuickClear}
        />
      )}
    </div>
  );
}

export default function CoachPanel({ allTeams, allPlayers, onClose }) {
  var teams = allTeams || [];
  var players = allPlayers || [];

  // £ Performance (mvPerf) — identical logic to TeamIndex: sum player market values per
  // team, rank teams by MV within a league+season, compare to pointsRank. Positive = the
  // squad overperformed its market value. Requires allPlayers to be passed in from App;
  // if it isn't, £ Per just falls back to the manual override / blank on the card.
  var normLeague = function (l) { return String(l || '').trim().replace(/\.$/, '').toLowerCase(); };
  var totalMVByTeam = useMemo(function () {
    var sums = {};
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (!p.marketValue || p.marketValue <= 0) continue;
      var key = String(p.team).toLowerCase() + '|' + normLeague(p.league);
      sums[key] = (sums[key] || 0) + p.marketValue;
    }
    return sums;
  }, [players]);
  function getTotalMV(team, league) { return totalMVByTeam[String(team).toLowerCase() + '|' + normLeague(league)]; }
  function getMVPerf(row) {
    if (!row || row.pointsRank == null) return null;
    var peers = teams.filter(function (t) { return String(t.league) === String(row.league) && String(t.season) === String(row.season); });
    var withMV = peers
      .map(function (t) { return { t: t, mv: getTotalMV(t.team, t.league) }; })
      .filter(function (x) { return x.mv != null && x.t.pointsRank != null; });
    if (withMV.length < 2) return null;
    withMV.sort(function (a, b) { return b.mv - a.mv; });
    var idx = withMV.findIndex(function (x) { return String(x.t.team).toLowerCase() === String(row.team).toLowerCase(); });
    if (idx < 0) return null;
    return (idx + 1) - Number(row.pointsRank);
  }

  // £ Performance league RANK — rank every team in the league+season by their £ performance
  // (MV-rank minus points-rank; higher = bigger overperformance), rank 1 = best overperformer.
  // Per-season £ PERFORMANCE percentile, keyed season||league||team, for the quick
  // card's coach score. 100 = biggest overperformer in that league+season.
  function buildSeasonPerfMap(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      var r = getMVPerfRank(row);
      if (!r || r.size < 2) return;
      var pct = ((r.size - r.rank) / (r.size - 1)) * 100;
      map[row.season + '||' + row.league + '||' + row.team] = Math.round(pct * 10) / 10;
    });
    return map;
  }

  function getMVPerfRank(row) {
    if (!row) return null;
    var peers = teams.filter(function (t) { return String(t.league) === String(row.league) && String(t.season) === String(row.season); });
    var withMV = peers
      .map(function (t) { return { t: t, mv: getTotalMV(t.team, t.league) }; })
      .filter(function (x) { return x.mv != null && x.t.pointsRank != null; });
    if (withMV.length < 2) return null;
    withMV.sort(function (a, b) { return b.mv - a.mv; });
    var perf = withMV.map(function (x, i) { return { team: x.t.team, val: (i + 1) - Number(x.t.pointsRank) }; });
    var ranked = perf.slice().sort(function (a, b) { return b.val - a.val; });
    var idx = ranked.findIndex(function (x) { return String(x.team).toLowerCase() === String(row.team).toLowerCase(); });
    if (idx < 0) return null;
    return { rank: idx + 1, size: ranked.length };
  }

  var importInputRef = useRef(null);
  var [coaches, setCoaches] = useState(function() { return loadCoaches(); });
  var [showBuilder, setShowBuilder] = useState(false);
  var [editingCoach, setEditingCoach] = useState(null);
  var [generatingId, setGeneratingId] = useState(null);
  var [generatingQuickId, setGeneratingQuickId] = useState(null);
  var [cardOverrides, setCardOverrides] = useState({});
  var [expandedOverride, setExpandedOverride] = useState(null);
  var [quickOverrides, setQuickOverrides] = useState({});
  var [expandedQuick, setExpandedQuick] = useState(null);

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

  function handleToggleQuick(coachId) {
    setExpandedQuick(function(prev) { return prev === coachId ? null : coachId; });
  }

  function handleQuickFieldChange(coachId, field, val) {
    setQuickOverrides(function(prev) {
      var existing = prev[coachId] || {};
      var updated = Object.assign({}, existing);
      if (val === undefined) { delete updated[field]; } else { updated[field] = val; }
      var next = Object.assign({}, prev);
      next[coachId] = updated;
      return next;
    });
  }

  function handleQuickClear(coachId) {
    setQuickOverrides(function(prev) {
      var next = Object.assign({}, prev);
      delete next[coachId];
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
      var overrides = Object.assign({}, cardOverrides[coach.id] || {});
      overrides.allTeams = teams;
      var latestRow = tenureRows.slice().sort(function (a, b) { return a.season < b.season ? 1 : -1; })[0];
      var mvp = getMVPerf(latestRow);
      if (mvp != null) overrides.mvPerf = mvp;
      var mvpRank = getMVPerfRank(latestRow);
      if (mvpRank != null) overrides.mvPerfRank = mvpRank;
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
      var q = quickOverrides[coach.id] || {};

      // League size: explicit input, else latest tenure row's leagueSize, else 20.
      var lr = tenureRows.slice().sort(function(a, b) { return a.season < b.season ? 1 : -1; })[0] || {};
      var size = (lr.leagueSize != null) ? Number(lr.leagueSize) : 20;
      function tcM(vKey) {
        var r = q[vKey + 'Rank'];
        if (r == null || r === '') return undefined;
        return { rank: Number(r), size: size };
      }
      var teamContext = {
        squadValue: tcM('squadValue'),
        wageBill: tcM('wageBill'),
        odds: tcM('odds'),
        age: (lr.avgAge != null ? Number(lr.avgAge).toFixed(1) : undefined),
      };

      // Impact seasons: resolved from the team+season search (any team/league/season),
      // independent of the coach. A = red (main), B = blue. Fall back to tenure if unset.
      function resolveSel(sel) {
        if (sel && sel.team) {
          return teams.find(function(x) { return x.team === sel.team && x.league === sel.league && x.season === sel.season; }) || null;
        }
        return null;
      }
      var descT = tenureRows.slice().sort(function(a, b) { return a.season < b.season ? 1 : -1; });
      var ascT  = tenureRows.slice().sort(function(a, b) { return a.season < b.season ? -1 : 1; });
      var rowA = resolveSel(q.impactA) || descT[0];
      var rowB = resolveSel(q.impactB) || ascT[0];

      var overrides = {
        allTeams: teams,
        teamContext: teamContext,
        seasonPerf: buildSeasonPerfMap(tenureRows),
        agent: q.agent,
        formation: q.formation,
      };
      if (q.tenure && q.tenure.trim()) overrides.tenure = q.tenure.trim();
      if (q.unattached) overrides.unattached = true;
      if (q.hidePills) overrides.showScorePills = false;
      if (q.gbeC36 || q.gbeC24 || q.gbeExceptions) {
        overrides.gbe = {
          c36: !!q.gbeC36,
          c24: !!q.gbeC24,
          exceptions: !!q.gbeExceptions,
          exceptionsText: q.gbeExceptionsText || '',
        };
      }
      if (q.biography && q.biography.trim()) overrides.biography = q.biography.trim().slice(0, 350);
      if (rowA) { overrides.impactRowA = rowA; overrides.impactLabelA = rowA.team; }
      if (rowB) { overrides.impactRowB = rowB; overrides.impactLabelB = rowB.team; }

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
                teams={teams}
                generatingId={generatingId}
                generatingQuickId={generatingQuickId}
                expandedOverride={expandedOverride}
                cardOverrides={cardOverrides}
                expandedQuick={expandedQuick}
                quickOverrides={quickOverrides}
                onGenerate={handleGenerateCard}
                onGenerateQuick={handleGenerateQuickCard}
                onToggleOverride={handleToggleOverride}
                onToggleQuick={handleToggleQuick}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onFieldChange={handleFieldChange}
                onClear={handleClear}
                onQuickFieldChange={handleQuickFieldChange}
                onQuickClear={handleQuickClear}
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
