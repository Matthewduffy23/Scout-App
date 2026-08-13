const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';

import React, { useState } from 'react';

// Player photo naming lives in photoName.js — a character-for-character port of
// download_photos.py's safe_filename(), the function that actually names the files
// on disk. The local slugN()/photoUrl() that used to sit here disagreed with disk
// for 2,562 players (single-token names, multi-word surnames, transliteration).
export { photoUrl } from './photoName';
import { photoUrl } from './photoName';

export function Photo({name,team,size=34}){
  const [src,set]=useState(()=>photoUrl(name,team));
  const [tried,setT]=useState(false);
  React.useEffect(()=>{set(photoUrl(name,team));setT(false);},[name,team]);
  return <img src={src} alt="" onError={()=>{if(!tried){set('/fallback.png');setT(true);}}} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',background:'#111827',flexShrink:0,border:'2px solid #1a2740'}}/>;
}

// Single shared viewport check. Live (listens to resize/rotate) rather than a one-shot
// useMemo, so rotating the phone or resizing a desktop window re-lays out instead of
// leaving the app stuck in whichever mode it booted in.
// Desktop is untouched: every consumer branches only when this returns true.
// The `pointer: coarse` half is not optional. A width-only query measures CSS pixels,
// which shrink as you zoom: a 1280px desktop window at 175% zoom reports 731px and would
// flip a laptop into the phone layout. Requiring a coarse primary pointer means only
// actual touch devices (and DevTools device emulation, which sets it) can match.
const MOBILE_Q = (bp) => `(max-width: ${bp}px) and (pointer: coarse)`;

export function useIsMobile(bp=768){
  const [m,setM]=useState(()=>typeof window!=='undefined'&&window.matchMedia(MOBILE_Q(bp)).matches);
  React.useEffect(()=>{
    if(typeof window==='undefined') return;
    const q=window.matchMedia(MOBILE_Q(bp));
    const h=e=>setM(e.matches);
    q.addEventListener?q.addEventListener('change',h):q.addListener(h);
    setM(q.matches);
    return()=>{q.removeEventListener?q.removeEventListener('change',h):q.removeListener(h);};
  },[bp]);
  return m;
}

// FIX: `ok` was seeded from `id` once and never resynced, so this component had two
// permanent-grey-box failure modes wherever React reuses the instance (squad lists,
// panel rows, changing team inside a card):
//   1. a crest 404s -> ok=false -> the NEXT team rendered in that slot keeps ok=false
//      and shows the initial letter even though its badge is fine;
//   2. id arrives late (async teamFotmobId) -> mounted with id=null -> ok=false forever.
// Photo already had this effect; Crest didn't. Reset on id change.
export function Crest({id,name,size=20}){
  const [ok,set]=useState(!!id);
  React.useEffect(()=>{set(!!id);},[id]);
  if(!id||!ok) return <div style={{width:size,height:size,borderRadius:3,background:'#1a2740',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.5,color:'#94a3b8',flexShrink:0,fontWeight:700}}>{(String(name||'?')[0]||'?')}</div>;
  return <img src={`${CREST_BASE}${id}.png`} alt="" onError={()=>set(false)} style={{width:size,height:size,objectFit:'contain',flexShrink:0}}/>;
}

// ---------------------------------------------------------------------------
// PNG delivery.
//
// Every card used to do: a.download = name; a.href = dataUrl; a.click().
// That works on desktop and is a silent no-op on iOS Safari, which ignores the
// `download` attribute on data: URLs entirely — hence "click download, nothing
// happens". Blob URLs don't fix it either; iOS ignores `download` on those too.
//
// What does work on iOS is the share sheet, but navigator.share needs live user
// activation and generating a 1920x1080 PNG takes long enough to lose it. So on
// touch devices we show the finished image in an overlay: the Save button is a
// fresh tap (activation restored, share works), and long-pressing the image is a
// second route that needs no API at all.
//
// Plain DOM rather than React so the standalone export functions in CoachCard.js
// and CoachQuickCard.js can call it too — they aren't components.
// ---------------------------------------------------------------------------
export function isTouchDevice(){
  return typeof window !== 'undefined'
    && window.matchMedia('(pointer: coarse)').matches;
}

async function dataUrlToBlob(dataUrl){
  const res = await fetch(dataUrl);
  return await res.blob();
}

export async function deliverPng(dataUrl, filename){
  // Desktop: unchanged from what every card did before.
  if(!isTouchDevice()){
    const a = document.createElement('a');
    a.download = filename;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  }

  let blob = null;
  try { blob = await dataUrlToBlob(dataUrl); } catch(e){ /* fall through to img-only */ }
  const objUrl = blob ? URL.createObjectURL(blob) : null;

  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.setAttribute('style',
      'position:fixed;inset:0;z-index:100000;background:rgba(2,4,10,.96);'+
      'display:flex;flex-direction:column;align-items:center;justify-content:center;'+
      'padding:14px;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif;');

    const hint = document.createElement('div');
    hint.textContent = 'Press and hold the image to save it, or use Save below.';
    hint.setAttribute('style','color:#94a3b8;font-size:12.5px;text-align:center;margin-bottom:10px;line-height:1.45;');

    const img = document.createElement('img');
    img.src = objUrl || dataUrl;
    img.setAttribute('style',
      'max-width:100%;max-height:62vh;object-fit:contain;border-radius:8px;'+
      'border:1px solid #1e2d45;background:#09111e;');

    const row = document.createElement('div');
    row.setAttribute('style','display:flex;gap:10px;margin-top:14px;width:100%;max-width:420px;');

    const btn = (label, bg, color, border) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.setAttribute('style',
        `flex:1;padding:13px 0;border-radius:8px;border:1px solid ${border};`+
        `background:${bg};color:${color};font-size:13px;font-weight:700;cursor:pointer;`);
      return b;
    };

    const cleanup = (result) => {
      if(objUrl) setTimeout(()=>URL.revokeObjectURL(objUrl), 20000);
      if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
      resolve(result);
    };

    const saveBtn = btn('Save', '#3b7de8', '#fff', '#3b7de8');
    saveBtn.onclick = async () => {
      // This click is fresh user activation, which is exactly what navigator.share
      // needs and what the original post-render a.click() no longer had.
      //
      // FIX: the open-in-tab fallback used to sit after a possible `await`, so on the
      // path where share() rejected with something other than AbortError the activation
      // was already spent and iOS silently blocked the popup — Save appeared dead.
      // Decide whether we can share BEFORE awaiting anything, and keep a hint-only
      // last resort that needs no popup at all.
      let file = null;
      let canShareFiles = false;
      try {
        if(blob && navigator.canShare){
          file = new File([blob], filename, { type: 'image/png' });
          canShareFiles = navigator.canShare({ files: [file] });
        }
      } catch(e){ canShareFiles = false; }

      if(!canShareFiles){
        if(objUrl && window.open(objUrl, '_blank')) return;
        hint.textContent = 'Press and hold the image above to save it.';
        return;
      }

      try {
        await navigator.share({ files: [file] });
        cleanup('shared');
      } catch(e){
        if(e && e.name === 'AbortError') return; // user backed out of the sheet
        hint.textContent = 'Press and hold the image above to save it.';
      }
    };

    const closeBtn = btn('Close', 'transparent', '#94a3b8', '#1e2d45');
    closeBtn.onclick = () => cleanup('closed');

    row.appendChild(saveBtn);
    row.appendChild(closeBtn);
    wrap.appendChild(hint);
    wrap.appendChild(img);
    wrap.appendChild(row);
    document.body.appendChild(wrap);
  });
}

// JSON backups (shortlist, coaches) hit the same iOS wall: `download` is ignored, so
// tapping Export did nothing. Share sheet is the only route to Files on iOS.
//
// FIX: when canShare was missing or returned false for a .json File (which iOS Safari
// does do), this fell through to the anchor+download path — which is precisely the
// silent no-op it exists to avoid. Export looked like it worked and no file appeared,
// with no way to recover the data. Now touch devices get a visible last resort
// (open in a tab, else an on-screen copyable overlay) and the caller gets a status
// back so it can say so.
export async function deliverJson(text, filename){
  const blob = new Blob([text], { type: 'application/json' });
  if(isTouchDevice()){
    let file = null, canShareFiles = false;
    try {
      if(navigator.canShare){
        file = new File([blob], filename, { type: 'application/json' });
        canShareFiles = navigator.canShare({ files: [file] });
      }
    } catch(e){ canShareFiles = false; }

    if(canShareFiles){
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch(e){
        if(e && e.name === 'AbortError') return 'cancelled';
      }
    }
    const url = URL.createObjectURL(blob);
    if(window.open(url, '_blank')){
      setTimeout(()=>URL.revokeObjectURL(url), 60000);
      return 'opened';
    }
    URL.revokeObjectURL(url);
    showTextFallback(text, filename);
    return 'shown';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 20000);
  return 'downloaded';
}

// Last-resort backup route: the raw JSON on screen, selected and copyable. Ugly, but
// a backup you can paste into Notes beats an Export button that does nothing.
function showTextFallback(text, filename){
  const wrap = document.createElement('div');
  wrap.setAttribute('style',
    'position:fixed;inset:0;z-index:100000;background:rgba(2,4,10,.96);'+
    'display:flex;flex-direction:column;padding:14px;box-sizing:border-box;'+
    'font-family:system-ui,-apple-system,sans-serif;');
  const hint = document.createElement('div');
  hint.textContent = `Couldn't save ${filename} directly. Copy the text below and paste it somewhere safe.`;
  hint.setAttribute('style','color:#94a3b8;font-size:12.5px;text-align:center;margin-bottom:10px;line-height:1.45;');
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly','readonly');
  ta.setAttribute('style',
    'flex:1;width:100%;box-sizing:border-box;background:#09111e;color:#cbd5e1;'+
    'border:1px solid #1e2d45;border-radius:8px;padding:10px;font-size:11px;'+
    'font-family:ui-monospace,Menlo,monospace;');
  const row = document.createElement('div');
  row.setAttribute('style','display:flex;gap:10px;margin-top:12px;');
  const mk = (label,bg,color,border)=>{
    const b=document.createElement('button');
    b.textContent=label;
    b.setAttribute('style',`flex:1;padding:13px 0;border-radius:8px;border:1px solid ${border};background:${bg};color:${color};font-size:13px;font-weight:700;`);
    return b;
  };
  const copy = mk('Copy','#3b7de8','#fff','#3b7de8');
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(text); copy.textContent='Copied'; }
    catch(e){ ta.select(); }
  };
  const close = mk('Close','transparent','#94a3b8','#1e2d45');
  close.onclick = () => { if(wrap.parentNode) wrap.parentNode.removeChild(wrap); };
  row.appendChild(copy); row.appendChild(close);
  wrap.appendChild(hint); wrap.appendChild(ta); wrap.appendChild(row);
  document.body.appendChild(wrap);
}

// ---------------------------------------------------------------------------
// Squad loader.
//
// On mobile App.js only holds one position group at a time, so Team Report's XI
// can never be filled — it can see strikers but no keeper, defenders or midfield.
//
// Loading every chunk the way desktop does is what crashed iOS in the first place,
// but the culprit was Promise.all holding ~15 parsed chunks in memory at once, not
// the row count. Fetching sequentially and filtering to the one club before moving
// on means peak memory is a single chunk — the same cost as one position group,
// which is already known to be safe — while what's retained is ~30 players.
// ---------------------------------------------------------------------------
const _squadCache = {};

function normLeagueName(l){ return String(l||'').trim().replace(/\.$/,'').toLowerCase(); }
function normTeamName(t){ return String(t||'').trim().toLowerCase(); }

export async function loadSquad(team, league, onProgress){
  const key = `${normTeamName(team)}|${normLeagueName(league)}`;
  if(_squadCache[key]) return _squadCache[key];

  let manifest = null;
  try { const r = await fetch('/players_manifest.json'); if(r.ok) manifest = await r.json(); } catch(e){}
  // FIX: dedupe the file list. A manifest that lists the same chunk under two position
  // groups (or a player who qualifies for two groups) put the same player in the squad
  // twice, which shows up as duplicate names in the XI and in every squad panel.
  const files = Array.from(new Set(manifest
    ? Object.values(manifest).flat()
    : ['gk','cb','fb','cm','att','cf'].map(f=>`players_${f}.json`)));

  const wantTeam = normTeamName(team);
  const wantLeague = normLeagueName(league);
  const squad = [];
  const seen = new Set();
  // FIX: a single failed chunk used to `continue` and then the short squad got cached
  // forever — one flaky fetch and that club is permanently missing a keeper for the
  // rest of the session, with no retry and no sign anything went wrong. Track failures
  // and only cache a complete read, so the next call retries.
  let failures = 0;

  for(let i=0;i<files.length;i++){
    if(onProgress) onProgress(i+1, files.length);
    let rows = null;
    try {
      const r = await fetch(`/${files[i]}`);
      if(!r.ok) throw new Error(`HTTP ${r.status} for ${files[i]}`);
      rows = await r.json();
    } catch(e){
      failures++;
      console.warn('[loadSquad] chunk failed:', files[i], e);
      continue;
    }
    if(!Array.isArray(rows)){ failures++; rows = null; continue; }
    for(const p of rows){
      if(!p) continue;
      if(normTeamName(p.team) !== wantTeam) continue;
      if(normLeagueName(p.league) !== wantLeague) continue;
      const id = p.wyscoutId ?? p.wyId ?? p.id ?? `${normTeamName(p.name)}|${wantTeam}`;
      if(seen.has(id)) continue;
      seen.add(id);
      squad.push(p);
    }
    rows = null; // drop the chunk before fetching the next one
  }

  if(!failures) _squadCache[key] = squad;
  return squad;
}
