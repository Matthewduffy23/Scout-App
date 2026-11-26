// CoachProfile.js — read-only profile view for a saved coach (CoachPanel's "Profile"
// button), the coach-side counterpart of opening a player's profile. Lists every
// season of the coach's saved tenure; clicking one opens that season's TEAM profile
// (TeamCard — same component TeamIndex uses) so "team, league, results and team
// metrics for that season" comes from the one place that already renders them,
// rather than a second copy of the team-metrics UI.
import React, { useMemo, useState } from 'react';
import TeamCard from './TeamCard';
import { teamCountry } from './teamSimilarity';
import { computeAge, formatDOB } from './CoachCard';
import { useIsMobile } from './utils';

export default function CoachProfileModal({ coach, tenureRows = [], teams = [], onClose }) {
  const isMobile = useIsMobile();
  const age = computeAge(coach.dob);
  const sorted = useMemo(
    () => tenureRows.slice().sort((a, b) => (a.season < b.season ? 1 : -1)),
    [tenureRows],
  );
  const [selected, setSelected] = useState(null); // a tenure row -> opens its TeamCard
  const latest = sorted[0];

  // Same club across any season this coach managed it (promotion/relegation safe —
  // teamCountry ignores the league tier number), matching TeamIndex's own history list.
  const teamSeasonsFor = row => teams
    .filter(t => t.team === row.team && teamCountry(t.league) === teamCountry(row.league))
    .map(t => ({ ...t, crest: undefined }));

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,10,0.94)', zIndex: 260, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center', padding: isMobile ? 6 : 16, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#09111e', border: '1px solid #1e2d45', borderRadius: isMobile ? 12 : 16, width: '100%', maxWidth: 640, maxHeight: isMobile ? '97vh' : '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '14px 12px' : '20px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {coach.photoDataUrl
              ? <img src={coach.photoDataUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 48, height: 48, borderRadius: 8, background: '#1e2d45', flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>{coach.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {coach.nationality || '—'}
                {age != null ? ` · ${age} y.o.` : ''}
                {coach.dob ? ` (${formatDOB(coach.dob)})` : ''}
                {latest ? ` · latest: ${latest.team} (${latest.season})` : ''}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e2d45', color: '#94a3b8', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Seasons — click one for that season's team, league, results and metrics
        </div>

        {sorted.length === 0 && (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
            No tenure seasons on file for this coach.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map(row => (
            <button
              key={`${row.team}|${row.league}|${row.season}`}
              onClick={() => setSelected(row)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid #1e2d45', background: '#0d1624', color: '#e2e8f4', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
            >
              <span style={{ fontWeight: 700, width: 66, flexShrink: 0 }}>{row.season}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.team}</span>
              <span style={{ fontSize: 10.5, color: '#64748b', flexShrink: 0 }}>{row.league}</span>
              {row.pointsRank != null && <span style={{ fontSize: 10.5, color: '#60a5fa', flexShrink: 0 }}>#{row.pointsRank}</span>}
              <span style={{ color: '#475569', flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <TeamCard
          key={`${selected.team}|${selected.league}|${selected.season}`}
          team={selected}
          allTeamSeasons={teamSeasonsFor(selected)}
          allTeams={teams}
          onOpenTeam={t => setSelected(t)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
