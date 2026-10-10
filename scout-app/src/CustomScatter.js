import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { ScatterView } from './ScatterChart';

// Custom Scatter: upload any CSV (one label column + any number of numeric
// columns) and plot it with the same engine as the real scatter charts —
// but with every score-specific thing (tiers, quadrant bands, Target Level,
// Group-by-Team, league/season filters) stripped out, since there's no
// scoring system behind an arbitrary upload. Nothing here touches pipeline
// data, is saved, or persists between visits — it's in-memory React state
// for the life of this tab only.

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — generous for a CSV of teams, protects the tab from hanging on something huge
const MIN_COERCE_RATE = 0.6; // a column counts as numeric if most non-blank cells coerce

// "31.25%" -> 31.25, "1,234.5" -> 1234.5, "" / "N/A" / "-" -> null
function coerceNum(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '' || s === '-' || /^n\/?a$/i.test(s)) return null;
  const cleaned = s.replace(/%/g, '').replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Classifies each CSV header as numeric (enough cells coerce) or text, and
// flags numeric columns whose raw cells were "%"-formatted so the axis can
// still show them that way.
function classifyColumns(headers, rows) {
  return headers.map(key => {
    let seen = 0, coerced = 0, pct = 0;
    for (const row of rows) {
      const raw = row[key];
      if (raw == null || String(raw).trim() === '') continue;
      seen++;
      const v = coerceNum(raw);
      if (v != null) { coerced++; if (String(raw).includes('%')) pct++; }
    }
    const numeric = seen > 0 && coerced / seen >= MIN_COERCE_RATE;
    return { key, numeric, isPercent: numeric && pct === coerced && coerced > 0 };
  });
}

function parseCsvText(text) {
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (res.errors && res.errors.length && (!res.data || !res.data.length)) {
    throw new Error(res.errors[0].message || 'Could not parse this file as CSV.');
  }
  const headers = res.meta.fields || [];
  if (!headers.length) throw new Error('No columns found — check the file has a header row.');
  const rawRows = res.data.filter(r => Object.values(r).some(v => v != null && String(v).trim() !== ''));
  if (!rawRows.length) throw new Error('No data rows found under the header.');

  const cols = classifyColumns(headers, rawRows);
  const numericCols = cols.filter(c => c.numeric);
  const labelCol = cols.find(c => !c.numeric) || null;
  if (numericCols.length < 2) {
    throw new Error(`Found ${numericCols.length} numeric column${numericCols.length === 1 ? '' : 's'} — need at least 2 to plot a scatter. Columns seen: ${headers.join(', ')}`);
  }

  const items = rawRows.map((row, i) => {
    const label = labelCol ? String(row[labelCol.key] ?? '').trim() || `Row ${i + 1}` : `Row ${i + 1}`;
    const p = { __id: `${label}__${i}`, __label: label };
    for (const c of numericCols) p[c.key] = coerceNum(row[c.key]);
    return p;
  });

  return { items, numericCols, labelCol, rowCount: items.length };
}

const noColorOf = () => ({ g: 'all', color: '#64748b' });
const noLegend = () => [];
const customId = p => p.__id;
const customName = p => p.__label;
const customSub = () => '';
const customTip = () => [];

export default function CustomScatter() {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { items, numericCols, labelCol, rowCount }
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((text, name) => {
    setBusy(true); setError('');
    try {
      const result = parseCsvText(text);
      setParsed(result);
      setFileName(name);
    } catch (e) {
      setError(e.message || 'Could not read this CSV.');
      setParsed(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const onFile = useCallback(async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file after Clear
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError(`That file is ${(file.size / 1e6).toFixed(1)}MB — please keep uploads under ${MAX_FILE_BYTES / 1e6}MB.`); return; }
    const text = await file.text();
    load(text, file.name);
  }, [load]);

  const onPasteLoad = useCallback(() => {
    if (!pasteText.trim()) return;
    load(pasteText, 'Pasted CSV');
  }, [pasteText, load]);

  // Per-column overrides — relabelling and inverting only ever touch these,
  // never parsed.items or the column's own key, so data/column matching is
  // untouched.
  const [labelOverrides, setLabelOverrides] = useState({}); // {colKey: displayLabel}
  const [invertCols, setInvertCols] = useState(() => new Set()); // colKeys plotted mirrored
  const [showColumnEditor, setShowColumnEditor] = useState(false);

  const clear = useCallback(() => {
    setParsed(null); setFileName(''); setError(''); setPasteText('');
    setLabelOverrides({}); setInvertCols(new Set()); setShowColumnEditor(false);
  }, []);

  const renameCol = useCallback((key, value) => setLabelOverrides(prev => ({ ...prev, [key]: value })), []);
  const toggleInvert = useCallback(key => setInvertCols(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; }), []);

  const buildFields = useCallback(() => {
    if (!parsed) return [];
    return parsed.numericCols.map(c => {
      const label = labelOverrides[c.key]?.trim() || c.key;
      const inverted = invertCols.has(c.key);
      // Inverting mirrors the plotted value (so "better" sits up/right), but
      // fmt always converts back to the true value for ticks/tooltips/medians
      // — the axis never shows the mirrored number, only the real one.
      const toTrue = v => (inverted ? -v : v);
      const needsFmt = c.isPercent || inverted;
      return {
        key: c.key, group: 'CSV columns', label, short: label, neutral: true,
        get: p => { const v = p[c.key]; return v == null ? null : (inverted ? -v : v); },
        // Tells the engine's median/quadrant label wording that "up on this
        // axis" is the mirrored value, not the real one — otherwise an
        // inverted axis gets an auto-generated "High X" label sitting on top
        // of the lowest real values.
        ...(inverted ? { invertedDirection: true, lowerBetter: true } : {}),
        ...(needsFmt ? { fmt: v => { const real = toTrue(v); return c.isPercent ? `${real.toFixed(2)}%` : (Number.isInteger(real) ? String(real) : real.toFixed(2)); } } : {}),
      };
    });
  }, [parsed, labelOverrides, invertCols]);

  const [defaultX, defaultY] = useMemo(() => {
    if (!parsed) return [null, null];
    return [parsed.numericCols[0].key, parsed.numericCols[1].key];
  }, [parsed]);

  const sel = { background:'#0d1220', border:'1px solid #1e2d45', borderRadius:5, color:'#e2e8f4', padding:'5px 6px', fontSize:11, outline:'none' };
  const btn = { padding:'6px 12px', borderRadius:5, border:'1px solid #1e2d45', background:'#0d1624', color:'#94a3b8', fontSize:10.5, fontWeight:600, cursor:'pointer' };

  if (!parsed) {
    return (
      <div style={{ flex:1, overflow:'auto', padding:'24px 20px', display:'flex', flexDirection:'column', gap:16, maxWidth:620 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:'#f8fafc' }}>Custom Scatter</div>
          <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:4 }}>
            Upload any CSV — a name/label column plus any number of numeric columns. Plotted as-is: no
            scoring, no tiers, nothing merged into real data. Nothing here is saved between visits.
          </div>
        </div>
        <label style={{ ...btn, display:'inline-flex', alignItems:'center', gap:8, width:'fit-content', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Reading…' : '⬆ Upload CSV file'}
          <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} style={{ display:'none' }}/>
        </label>
        <div style={{ fontSize:10, color:'#64748b' }}>— or paste CSV text —</div>
        <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={'Team,Possession %,xG\nArsenal,61.4,2.1\n...'}
          rows={8} style={{ ...sel, fontFamily:'monospace', fontSize:11, resize:'vertical' }}/>
        <button style={{ ...btn, width:'fit-content', opacity: pasteText.trim() ? 1 : 0.5 }} disabled={!pasteText.trim() || busy} onClick={onPasteLoad}>Load pasted CSV</button>
        {error && <div style={{ fontSize:11.5, color:'#f87171', background:'#1a0e10', border:'1px solid #3a1a1e', borderRadius:6, padding:'8px 10px' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1px solid #1e2d45' }}>
        <span style={{ fontSize:11.5, color:'#e2e8f4', fontWeight:600 }}>Custom Scatter</span>
        <span style={{ fontSize:10.5, color:'#64748b' }}>{fileName} · {parsed.rowCount} rows · {parsed.numericCols.length} numeric columns</span>
        <button style={{ ...btn, ...(showColumnEditor ? { borderColor:'#3b7de8', color:'#93c5fd' } : {}) }} onClick={() => setShowColumnEditor(v => !v)}>✎ Edit columns</button>
        <button style={{ ...btn, marginLeft:'auto' }} onClick={clear}>⬆ Upload a different file</button>
      </div>
      {showColumnEditor && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'10px 16px', borderBottom:'1px solid #1e2d45', background:'#0a0f1a' }}>
          <span style={{ fontSize:10, color:'#64748b' }}>Rename a column's axis/legend label, or invert it so a lower-is-better metric (e.g. goals conceded) plots with "better" up/right. The underlying data and column matching never change.</span>
          {parsed.numericCols.map(c => (
            <div key={c.key} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:10.5, color:'#94a3b8', width:160, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={c.key}>{c.key}</span>
              <input aria-label={`Rename ${c.key}`} placeholder={`Rename: ${c.key}`} value={labelOverrides[c.key] || ''} onChange={e => renameCol(c.key, e.target.value)}
                style={{ ...sel, width:220, padding:'4px 7px' }}/>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, color:'#94a3b8', cursor:'pointer' }}>
                <input type="checkbox" checked={invertCols.has(c.key)} onChange={() => toggleInvert(c.key)}/>
                Invert (lower = better)
              </label>
            </div>
          ))}
        </div>
      )}
      <ScatterView
        items={parsed.items} idOf={customId} nameOf={customName} subOf={customSub} tooltipLines={customTip}
        buildFields={buildFields} defaultX={defaultX} defaultY={defaultY} metricLabel="Value"
        colorModes={[]} colorOf={noColorOf} legendBase={noLegend}
        scoreQuad={null} targetTiers={null} groups={[]} noun="team"
        defaultMedianOn={false} defaultSample={parsed.rowCount}
        contextLabel={`${fileName} · ${parsed.rowCount} rows`}
      />
    </div>
  );
}
