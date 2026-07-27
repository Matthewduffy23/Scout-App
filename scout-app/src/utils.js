const PHOTO_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/photos/';
const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';

function slugN(s) {
  s = String(s||'').toLowerCase();
  'ø,o|œ,oe|æ,ae|å,a|ä,a|ö,o|ü,u|ß,ss|ł,l|đ,d|ð,d|þ,th|ç,c|ş,s|ğ,g|ı,i'.split('|').forEach(p=>{const[k,v]=p.split(',');s=s.split(k).join(v);});
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
}

export function photoUrl(name, team) {
  const parts = name.trim().split('.');
  let ini, sur;
  if(parts.length>=2){ini=parts[0].trim();sur=parts.slice(1).join('.').trim();}
  else{const b=name.trim().split(' ');ini=b[0]||'';sur=b.slice(1).join(' ')||b[0]||'';}
  const t=String(team||'').trim().split(/\s+/).map(w=>slugN(w)).join('_').replace(/^_|_$/g,'');
  return `${PHOTO_BASE}${slugN(ini)}_${slugN(sur)}__${t}.png`;
}

import React, { useState } from 'react';

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

export function Crest({id,name,size=20}){
  const [ok,set]=useState(!!id);
  if(!id||!ok) return <div style={{width:size,height:size,borderRadius:3,background:'#1a2740',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.5,color:'#94a3b8',flexShrink:0,fontWeight:700}}>{(name||'?')[0]}</div>;
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
function isTouchDevice(){
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
      try {
        if(blob && navigator.canShare){
          const file = new File([blob], filename, { type: 'image/png' });
          if(navigator.canShare({ files: [file] })){
            await navigator.share({ files: [file] });
            cleanup('shared');
            return;
          }
        }
      } catch(e){
        if(e && e.name === 'AbortError'){ return; } // user backed out of the sheet
      }
      // No share support: open in its own tab, where iOS offers Save to Photos.
      if(objUrl) window.open(objUrl, '_blank');
      else hint.textContent = 'Press and hold the image above to save it.';
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
export async function deliverJson(text, filename){
  const blob = new Blob([text], { type: 'application/json' });
  if(isTouchDevice() && navigator.canShare){
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      if(navigator.canShare({ files: [file] })){
        await navigator.share({ files: [file] });
        return 'shared';
      }
    } catch(e){
      if(e && e.name === 'AbortError') return 'cancelled';
    }
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
