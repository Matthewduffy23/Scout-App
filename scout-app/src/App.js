import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PlayerCard from './PlayerCard';
import {
  scoreBand, scoreBandColor, formatMV, formatFoot,
  ROLE_KEY_LABELS, ROLES_BY_KEY, ALL_LEAGUES, LEAGUE_PRESETS,
} from './constants';

const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';
const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';
const PLACEHOLDER_PHOTO = 'https://i.pravatar.cc/80?img=3';

function slugName(s) {
  s = String(s || '').toLowerCase();
  const repl = {'ø':'o','œ':'oe','æ':'ae','å':'a','ä':'a','ö':'o','ü':'u','ß':'ss','ł':'l','đ':'d','ð':'d','þ':'th','ç':'c','ş':'s','ğ':'g','ı':'i'};
  Object.entries(repl).forEach(([k,v]) => { s = s.split(k).join(v); });
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
}

function buildPhotoUrl(name, team) {
  const parts = name.trim().split('.');
  let initial, surname;
  if (parts.length >= 2) {
    initial = parts[0].trim();
    surname = parts.slice(1).join('.').trim();
  } else {
    const bits = name.trim().split(' ');
    initial = bits[0] || '';
    surname = bits.slice(1).join(' ') || bits[0] || '';
  }
  const tSlug = String(team || '').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  return `${PHOTO_BASE}${slugName(initial)}_${slugName(surname)}__${tSlug}.png`;
}

function PlayerPhoto({ name, team, size = 40 }) {
  const [src, setSrc] = useState(buildPhotoUrl(name, team));
  return (
    <img
      src={src}
      alt={name}
      onError={() => setSrc(PLACEHOLDER_PHOTO)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#1a2438', flexShrink: 0, border: '2px solid #1e2d45' }}
    />
  );
}

function TeamCrest({ fotmobId, teamName, size = 24 }) {
  const [ok, setOk] = useState(true);
  if (!fotmobId || !ok) return (
    <div style={{ width: size, height: size, borderRadius: 4, background: '#1a2438', display:'flex', alignItems:'center', justifyContent:'center', fontSize: size*0.45, color:'#4a5a78', flexShrink:0 }}>
      {(teamName||'?')[0]}
    </div>
  );
  return (
    <img
      src={`${CREST_BASE}${fotmobId}.png`}
      alt={teamName}
      onError={() => setOk(false)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

const PAGE_SIZE = 50;

const SORT_COLS = { careerScore:'Career Score', peakScore:'Peak Score', age:'Age', seasons:'Seasons', minutesLatest:'Minutes' };

const css = {
  app: { display:'flex', flexDirection:'column', minHeight:'100vh', background:'#080c14' },
  topbar: { background:'#0a0f1c', borderBottom:'1px solid #1a2740', padding:'0 24px', display:'flex', alignItems:'center', gap:16, height:52, flexShrink:0 },
  logo: { fontSize:14, fontWeight:800, color:'#e2e8f4', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:8 },
  logoDot: { width:7, height:7, borderRadius:'50%', background:'#3b7de8' },
  topbarRight: { marginLeft:'auto', display:'flex', alignItems:'center', gap:10 },
  datasetTag: { fontSize:11, color:'#4a5a78', background:'#111827', border:'1px solid #1a2740', borderRadius:6, padding:'3px 8px' },
  layout: { display:'flex', flex:1, minHeight:0 },
  sidebar: { width:260, flexShrink:0, background:'#090d18', borderRight:'1px solid #1a2740', overflowY:'auto', padding:'16px 14px' },
  main: { flex:1, display:'flex', flexDirection:'column', minWidth:0 },
  filterGroup: { marginBottom:18 },
  filterLabel: { fontSize:10, fontWeight:700, color:'#3d5070', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6, display:'block' },
  select: { width:'100%', background:'#111827', border:'1px solid #1a2740', borderRadius:7, color:'#e2e8f4', padding:'7px 9px', appearance:'none', cursor:'pointer', outline:'none', fontSize:13 },
  rangeRow: { display:'flex', gap:6, alignItems:'center' },
  rangeInput: { flex:1, background:'#111827', border:'1px solid #1a2740', borderRadius:7, color:'#e2e8f4', padding:'6px 9px', width:0, outline:'none', fontSize:13 },
  rangeSep: { color:'#3d5070', fontSize:12 },
  checkGrid: { display:'flex', flexDirection:'column', gap:4 },
  checkRow: { display:'flex', alignItems:'center', gap:7, cursor:'pointer' },
  checkBox: (on) => ({ width:15, height:15, borderRadius:3, flexShrink:0, border:`1px solid ${on?'#3b7de8':'#1a2740'}`, background:on?'#3b7de8':'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s' }),
  checkLabel: { fontSize:12, color:'#8898b4', userSelect:'none' },
  sliderWrap: { display:'flex', flexDirection:'column', gap:5 },
  slider: { width:'100%', accentColor:'#3b7de8', cursor:'pointer' },
  resetBtn: { width:'100%', padding:'8px', background:'none', border:'1px solid #1a2740', borderRadius:7, color:'#8898b4', fontSize:12, marginTop:6, cursor:'pointer' },
  divider: { height:1, background:'#111827', margin:'2px 0 16px' },
  statsBar: { padding:'12px 20px', background:'#090d18', borderBottom:'1px solid #1a2740', display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' },
  statItem: { display:'flex', flexDirection:'column', gap:1 },
  statVal: { fontSize:18, fontWeight:800, color:'#e2e8f4', lineHeight:1 },
  statLabel: { fontSize:10, color:'#3d5070', textTransform:'uppercase', letterSpacing:'0.08em' },
  statDiv: { width:1, height:28, background:'#1a2740' },
  tableWrap: { flex:1, overflowY:'auto', overflowX:'auto' },
  table: { width:'100%', borderCollapse:'collapse', minWidth:860 },
  thead: { position:'sticky', top:0, zIndex:10, background:'#090d18' },
  th: { padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#3d5070', letterSpacing:'0.08em', textTransform:'uppercase', borderBottom:'1px solid #1a2740', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' },
  thActive: { color:'#3b7de8' },
  td: { padding:'10px 12px', borderBottom:'1px solid #111827', fontSize:13, color:'#e2e8f4', whiteSpace:'nowrap', verticalAlign:'middle' },
  tdMuted: { color:'#8898b4' },
  rolePill: { display:'inline-block', padding:'2px 8px', borderRadius:10, background:'#122044', color:'#7eb3f8', fontSize:11, fontWeight:600, whiteSpace:'nowrap' },
  footPill: (f) => ({ display:'inline-block', padding:'2px 7px', borderRadius:10, background: f==='left'?'#0f2e1a': f==='right'?'#111827':'#1a1a2e', color: f==='left'?'#4ade80': f==='right'?'#60a5fa':'#a78bfa', fontSize:11, fontWeight:600 }),
  bandDot: (s) => ({ width:8, height:8, borderRadius:'50%', background:scoreBandColor(s), flexShrink:0, display:'inline-block', marginRight:5 }),
  emptyState: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', color:'#3d5070', gap:10 },
  searchWrap: { position:'relative' },
  searchInput: { width:'100%', background:'#111827', border:'1px solid #1a2740', borderRadius:7, color:'#e2e8f4', padding:'7px 9px 7px 32px', outline:'none', fontSize:13 },
  searchIcon: { position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#3d5070', fontSize:14 },
  loading: { display:'flex', alignItems:'center', justifyContent:'center', flex:1, flexDirection:'column', gap:14, color:'#3d5070' },
  spinner: { width:28, height:28, border:'3px solid #1a2740', borderTop:'3px solid #3b7de8', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  pagination: { padding:'10px 18px', borderTop:'1px solid #1a2740', display:'flex', alignItems:'center', gap:6, background:'#090d18' },
  pageBtn: (active) => ({ width:28, height:26, borderRadius:5, border:'1px solid #1a2740', background:active?'#122044':'transparent', color:active?'#60a5fa':'#8898b4', fontSize:11, fontWeight:600, cursor:'pointer' }),
};

function Th({ col, label, sort, onSort }) {
  const active = sort.col === col;
  return <th style={{...css.th,...(active?css.thActive:{})}} onClick={() => onSort(col)}>{label}{active?(sort.asc?' ↑':' ↓'):''}</th>;
}

export default function App() {
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [posGroup, setPosGroup] = useState('All');
  const [specificRole, setSpecificRole] = useState('Any');
  const [leaguePreset, setLeaguePreset] = useState('All');
  const [customLeagues, setCustomLeagues] = useState(new Set(ALL_LEAGUES));
  const [ageMin, setAgeMin] = useState(16);
  const [ageMax, setAgeMax] = useState(38);
  const [foot, setFoot] = useState('Any');
  const [minCareerScore, setMinCareerScore] = useState(0);
  const [minSeasons, setMinSeasons] = useState(1);
  const [recentOnly, setRecentOnly] = useState(true);
  const [sort, setSort] = useState({ col:'careerScore', asc:false });

  useEffect(() => {
    fetch('/players.json').then(r => r.json())
      .then(d => { setAllPlayers(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { setSpecificRole('Any'); }, [posGroup]);
  useEffect(() => {
    const preset = LEAGUE_PRESETS[leaguePreset];
    if (preset === null) setCustomLeagues(new Set(ALL_LEAGUES));
    else if (preset) setCustomLeagues(new Set(preset));
  }, [leaguePreset]);

  const handleSort = useCallback((col) => {
    setSort(prev => prev.col === col ? { col, asc: !prev.asc } : { col, asc: false });
    setPage(0);
  }, []);

  const roleOptions = useMemo(() => {
    if (posGroup === 'All') return [];
    const rk = Object.entries(ROLE_KEY_LABELS).find(([,v]) => v === posGroup)?.[0];
    return rk ? ROLES_BY_KEY[rk] : [];
  }, [posGroup]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPlayers.filter(p => {
      if (q && !p.name.toLowerCase().includes(q) && !p.team.toLowerCase().includes(q)) return false;
      if (posGroup !== 'All' && ROLE_KEY_LABELS[p.roleKey] !== posGroup) return false;
      if (specificRole !== 'Any' && p.role !== specificRole) return false;
      if (!customLeagues.has(p.league)) return false;
      if (p.age < ageMin || p.age > ageMax) return false;
      if (foot !== 'Any' && p.foot !== foot) return false;
      if (p.careerScore < minCareerScore) return false;
      if (p.seasons < minSeasons) return false;
      if (recentOnly && !p.hasRecent) return false;
      return true;
    });
  }, [allPlayers, search, posGroup, specificRole, customLeagues, ageMin, ageMax, foot, minCareerScore, minSeasons, recentOnly]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a,b) => {
      const av = a[sort.col] ?? (sort.asc ? Infinity : -Infinity);
      const bv = b[sort.col] ?? (sort.asc ? Infinity : -Infinity);
      return sort.asc ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sort]);

  const pageData = sorted.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const stats = useMemo(() => ({
    count: filtered.length,
    avgScore: filtered.length ? (filtered.reduce((s,p) => s+p.careerScore,0)/filtered.length) : 0,
    elite: filtered.filter(p => p.careerScore >= 85).length,
    avgAge: filtered.length ? (filtered.reduce((s,p) => s+p.age,0)/filtered.length) : 0,
  }), [filtered]);

  const resetFilters = () => {
    setSearch(''); setPosGroup('All'); setSpecificRole('Any');
    setLeaguePreset('All'); setCustomLeagues(new Set(ALL_LEAGUES));
    setAgeMin(16); setAgeMax(38); setFoot('Any');
    setMinCareerScore(0); setMinSeasons(1); setRecentOnly(true); setPage(0);
  };

  if (loading) return (
    <div style={{...css.app, alignItems:'center', justifyContent:'center'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={css.spinner} />
      <div style={{color:'#3d5070', fontSize:13}}>Loading player database…</div>
    </div>
  );

  if (error) return <div style={{...css.app, alignItems:'center', justifyContent:'center', color:'#ef4444'}}>Error: {error}</div>;

  return (
    <div style={css.app}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus,select:focus{border-color:#3b7de8!important}
        .row-hover:hover td{background:#0c1525!important}
        .reset-btn:hover{background:#111827!important;color:#e2e8f4!important}
      `}</style>

      {/* Topbar */}
      <div style={css.topbar}>
        <div style={css.logo}><div style={css.logoDot}/>Scout Index</div>
        <div style={{width:1,height:18,background:'#1a2740'}}/>
        <div style={{fontSize:12,color:'#3d5070'}}>Career Sample Analysis</div>
        <div style={css.topbarRight}>
          <div style={css.datasetTag}>{allPlayers.length.toLocaleString()} players</div>
        </div>
      </div>

      <div style={css.layout}>
        {/* Sidebar */}
        <aside style={css.sidebar}>
          <div style={css.filterGroup}>
            <span style={css.filterLabel}>Search</span>
            <div style={css.searchWrap}>
              <span style={css.searchIcon}>⌕</span>
              <input style={css.searchInput} placeholder="Player or team…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
          </div>

          <div style={css.divider}/>

          <div style={css.filterGroup}>
            <span style={css.filterLabel}>Position</span>
            <select style={css.select} value={posGroup} onChange={e => { setPosGroup(e.target.value); setPage(0); }}>
              <option>All</option>
              {Object.values(ROLE_KEY_LABELS).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {posGroup !== 'All' && roleOptions.length > 0 && (
            <div style={css.filterGroup}>
              <span style={css.filterLabel}>Role</span>
              <select style={css.select} value={specificRole} onChange={e => { setSpecificRole(e.target.value); setPage(0); }}>
                <option>Any</option>
                {roleOptions.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div style={css.divider}/>

          <div style={css.filterGroup}>
            <span style={css.filterLabel}>League Preset</span>
            <select style={css.select} value={leaguePreset} onChange={e => { setLeaguePreset(e.target.value); setPage(0); }}>
              {Object.keys(LEAGUE_PRESETS).map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div style={css.filterGroup}>
            <span style={css.filterLabel}>Leagues</span>
            <div style={css.checkGrid}>
              {ALL_LEAGUES.map(lg => (
                <label key={lg} style={css.checkRow} onClick={() => {
                  setCustomLeagues(prev => { const n=new Set(prev); n.has(lg)?n.delete(lg):n.add(lg); return n; });
                  setLeaguePreset('All'); setPage(0);
                }}>
                  <div style={css.checkBox(customLeagues.has(lg))}>
                    {customLeagues.has(lg) && <span style={{color:'#fff',fontSize:9,lineHeight:1}}>✓</span>}
                  </div>
                  <span style={css.checkLabel}>{lg}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={css.divider}/>

          <div style={css.filterGroup}>
            <span style={css.filterLabel}>Age</span>
            <div style={css.rangeRow}>
              <input style={css.rangeInput} type="number" min={14} max={50} value={ageMin} onChange={e=>{setAgeMin(Number(e.target.value));setPage(0);}}/>
              <span style={css.rangeSep}>–</span>
              <input style={css.rangeInput} type="number" min={14} max={50} value={ageMax} onChange={e=>{setAgeMax(Number(e.target.value));setPage(0);}}/>
            </div>
          </div>

          <div style={css.filterGroup}>
            <span style={css.filterLabel}>Foot</span>
            <select style={css.select} value={foot} onChange={e=>{setFoot(e.target.value);setPage(0);}}>
              {['Any','left','right','both'].map(f=><option key={f}>{f}</option>)}
            </select>
          </div>

          <div style={css.filterGroup}>
            <span style={css.filterLabel}>Min Career Score: {minCareerScore}</span>
            <input type="range" style={css.slider} min={0} max={95} step={1} value={minCareerScore}
              onChange={e=>{setMinCareerScore(Number(e.target.value));setPage(0);}}/>
          </div>

          <div style={css.filterGroup}>
            <span style={css.filterLabel}>Min Seasons: {minSeasons}</span>
            <input type="range" style={css.slider} min={1} max={8} step={1} value={minSeasons}
              onChange={e=>{setMinSeasons(Number(e.target.value));setPage(0);}}/>
          </div>

          <div style={css.filterGroup}>
            <label style={css.checkRow} onClick={() => { setRecentOnly(p => !p); setPage(0); }}>
              <div style={css.checkBox(recentOnly)}>
                {recentOnly && <span style={{color:'#fff',fontSize:9,lineHeight:1}}>✓</span>}
              </div>
              <span style={{...css.checkLabel, color: recentOnly?'#e2e8f4':'#8898b4'}}>Active only (2023-24+)</span>
            </label>
          </div>

          <button className="reset-btn" style={css.resetBtn} onClick={resetFilters}>Reset filters</button>
        </aside>

        {/* Main */}
        <main style={css.main}>
          {/* Stats bar */}
          <div style={css.statsBar}>
            {[
              [stats.count.toLocaleString(),'Found'],
              null,
              [stats.avgScore.toFixed(1),'Avg Score'],
              null,
              [stats.avgAge.toFixed(1),'Avg Age'],
              null,
              [stats.elite.toLocaleString(),'Elite (85+)'],
            ].map((item,i) => item===null
              ? <div key={i} style={css.statDiv}/>
              : <div key={i} style={css.statItem}><div style={css.statVal}>{item[0]}</div><div style={css.statLabel}>{item[1]}</div></div>
            )}
            <div style={{marginLeft:'auto',display:'flex',gap:5}}>
              {['careerScore','peakScore','age'].map(col => (
                <button key={col} onClick={() => handleSort(col)} style={css.pageBtn(sort.col===col)}>
                  {SORT_COLS[col]}{sort.col===col?(sort.asc?' ↑':' ↓'):''}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={css.tableWrap}>
            {sorted.length === 0
              ? <div style={css.emptyState}><div style={{fontSize:32}}>⚽</div><div>No players match filters</div></div>
              : (
                <table style={css.table}>
                  <thead style={css.thead}>
                    <tr>
                      <th style={{...css.th,width:36,textAlign:'center'}}>#</th>
                      <th style={{...css.th,width:40}}></th>
                      <Th col="name" label="Player" sort={sort} onSort={handleSort}/>
                      <th style={css.th}>Club</th>
                      <th style={css.th}>League</th>
                      <Th col="age" label="Age" sort={sort} onSort={handleSort}/>
                      <th style={css.th}>Foot</th>
                      <th style={css.th}>Best Role</th>
                      <Th col="careerScore" label="Career Score" sort={sort} onSort={handleSort}/>
                      <Th col="peakScore" label="Peak" sort={sort} onSort={handleSort}/>
                      <Th col="seasons" label="Seasons" sort={sort} onSort={handleSort}/>
                      <th style={css.th}>Mkt Val</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((p, i) => (
                      <tr key={p.id} className="row-hover"
                        style={{cursor:'pointer'}}
                        onClick={() => setSelected(p)}>
                        <td style={{...css.td,textAlign:'center',color:'#3d5070',fontSize:11}}>{page*PAGE_SIZE+i+1}</td>
                        <td style={css.td}>
                          <PlayerPhoto name={p.name} team={p.team} size={34}/>
                        </td>
                        <td style={css.td}>
                          <div style={{fontWeight:600,color:'#e2e8f4'}}>{p.name}</div>
                        </td>
                        <td style={css.td}>
                          <div style={{display:'flex',alignItems:'center',gap:7}}>
                            <TeamCrest fotmobId={p.teamFotmobId} teamName={p.team} size={20}/>
                            <span style={{...css.tdMuted,fontSize:12}}>{p.team}</span>
                          </div>
                        </td>
                        <td style={{...css.td,...css.tdMuted,fontSize:12}}>{p.league}</td>
                        <td style={css.td}>{p.age}</td>
                        <td style={css.td}>
                          {p.foot && p.foot!=='unknown' && p.foot!=='nan'
                            ? <span style={css.footPill(p.foot)}>{formatFoot(p.foot)}</span>
                            : <span style={{color:'#3d5070'}}>—</span>}
                        </td>
                        <td style={css.td}><span style={css.rolePill}>{p.role}</span></td>
                        <td style={css.td}>
                          <div style={{display:'flex',alignItems:'center',gap:0}}>
                            <span style={css.bandDot(p.careerScore)}/>
                            <span style={{fontWeight:700,color:scoreBandColor(p.careerScore)}}>{p.careerScore.toFixed(1)}</span>
                          </div>
                        </td>
                        <td style={{...css.td,color:'#8898b4'}}>{p.peakScore.toFixed(1)}</td>
                        <td style={{...css.td,color:'#8898b4'}}>{p.seasons}</td>
                        <td style={{...css.td,color:'#8898b4'}}>{formatMV(p.marketValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={css.pagination}>
              <span style={{fontSize:11,color:'#3d5070',marginRight:4}}>
                {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,sorted.length)} of {sorted.length.toLocaleString()}
              </span>
              {[...Array(Math.min(totalPages,10))].map((_,i) => (
                <button key={i} onClick={() => setPage(i)} style={css.pageBtn(page===i)}>{i+1}</button>
              ))}
              {totalPages>10 && <span style={{color:'#3d5070',fontSize:11}}>…{totalPages}</span>}
            </div>
          )}
        </main>
      </div>

      {selected && <PlayerCard player={selected} onClose={() => setSelected(null)}/>}
    </div>
  );
}

