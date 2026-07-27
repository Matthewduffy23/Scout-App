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
