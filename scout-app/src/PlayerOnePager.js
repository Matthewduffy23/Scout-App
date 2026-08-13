import { scoreBandColor, scoreLabel, scoreToStars, ROLE_KEY_LABELS, formatMV, formatFoot, LEAGUE_STRENGTHS } from './constants';

// Player photo naming lives in photoName.js — a character-for-character port of
// download_photos.py's safe_filename(), the function that actually names the files
// on disk. The local slugN()/photoUrl() that used to sit here disagreed with disk
// for 2,562 players (single-token names, multi-word surnames, transliteration).
import { photoUrl } from './photoName';

const CREST_BASE = 'https://images.fotmob.com/image_resources/logo/teamlogo/';
const FLAG_BASE = 'https://flagcdn.com/24x18/';

function starsHtml(score, size=16) {
  const stars = scoreToStars(score);
  const full = Math.floor(stars);
  const half = (stars-full)>=0.5?1:0;
  const empty = 5-full-half;
  const s = (filled) => `<span style="color:${filled?'#f59e0b':'#4b5563'};font-size:${size}px;line-height:1">★</span>`;
  return Array(full).fill(s(true)).join('')+(half?s(true):'')+Array(empty).fill(s(false)).join('');
}

function barHtml(label, pct, val) {
  const v = Math.round(pct||0);
  const color = v>=80?'#22c55e':v>=60?'#84cc16':v>=40?'#eab308':v>=20?'#f97316':'#ef4444';
  const textColor = v>=70?'#e2e8f4':v<=30?'#f87171':'#d1d5db';
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
      <div style="width:120px;font-size:9px;color:${textColor};text-align:right;flex-shrink:0;font-weight:${v>=70?700:400}">${label}</div>
      <div style="flex:1;background:#1a2340;border-radius:2px;height:6px;position:relative">
        <div style="width:${v}%;height:100%;border-radius:2px;background:${color}"></div>
        <div style="position:absolute;left:50%;top:-1px;width:1px;height:8px;background:#374151"></div>
      </div>
      <div style="width:24px;font-size:9px;font-weight:800;color:${color};text-align:right;flex-shrink:0">${v}</div>
      <div style="width:32px;font-size:8px;color:#6b7280;text-align:right;flex-shrink:0">${val!=null?Number(val).toFixed(2):''}</div>
    </div>`;
}

// Tactical position map — positions with coordinates on a pitch
const POSITION_COORDS = {
  GK:  [{x:50,y:88}],
  RCB: [{x:70,y:72}], LCB: [{x:30,y:72}], CB: [{x:50,y:72}],
  RB:  [{x:80,y:60}], LB:  [{x:20,y:60}], RWB:[{x:85,y:50}], LWB:[{x:15,y:50}],
  RDMF:[{x:62,y:52}],LDMF:[{x:38,y:52}],DMF:[{x:50,y:52}],
  RCMF:[{x:65,y:40}],LCMF:[{x:35,y:40}],CMF:[{x:50,y:40}],
  RW:  [{x:80,y:25}], LW:  [{x:20,y:25}], RWF:[{x:80,y:18}], LWF:[{x:20,y:18}],
  AMF: [{x:50,y:28}],RAMF:[{x:65,y:28}],LAMF:[{x:35,y:28}],
  CF:  [{x:50,y:14}],
};

function pitchMapHtml(position) {
  const primaryTok = String(position||'').trim().toUpperCase().split(',')[0].trim();
  const allToks = String(position||'').trim().toUpperCase().split(',').map(t=>t.trim());
  
  // All grey dots for common positions
  const allPositions = [
    {tok:'GK',x:50,y:88},{tok:'RCB',x:70,y:72},{tok:'LCB',x:30,y:72},
    {tok:'RB',x:80,y:60},{tok:'LB',x:20,y:60},
    {tok:'RDMF',x:62,y:52},{tok:'LDMF',x:38,y:52},
    {tok:'RCMF',x:65,y:40},{tok:'LCMF',x:35,y:40},
    {tok:'RWF',x:80,y:18},{tok:'LWF',x:20,y:18},
    {tok:'AMF',x:50,y:28},{tok:'CF',x:50,y:14},
  ];

  const dots = allPositions.map(p => {
    const isPrimary = p.tok === primaryTok;
    const isSecondary = allToks.includes(p.tok) && !isPrimary;
    const color = isPrimary ? '#22c55e' : isSecondary ? '#60a5fa' : '#374151';
    const size = isPrimary ? 7 : 5;
    return `<circle cx="${p.x}%" cy="${p.y}%" r="${size}" fill="${color}" opacity="${isPrimary||isSecondary?1:0.5}"/>`;
  }).join('');

  return `
    <svg viewBox="0 0 100 100" style="width:100%;height:120px;border:1px solid #374151;border-radius:4px;background:#0f1c14">
      <!-- Pitch markings -->
      <rect x="10" y="5" width="80" height="90" fill="none" stroke="#1f3d1f" stroke-width="0.8"/>
      <line x1="10" y1="50" x2="90" y2="50" stroke="#1f3d1f" stroke-width="0.6"/>
      <circle cx="50" cy="50" r="12" fill="none" stroke="#1f3d1f" stroke-width="0.6"/>
      <circle cx="50" cy="50" r="1.5" fill="#1f3d1f"/>
      <!-- Penalty areas -->
      <rect x="25" y="5" width="50" height="16" fill="none" stroke="#1f3d1f" stroke-width="0.6"/>
      <rect x="25" y="79" width="50" height="16" fill="none" stroke="#1f3d1f" stroke-width="0.6"/>
      <!-- Goal areas -->
      <rect x="35" y="5" width="30" height="7" fill="none" stroke="#1f3d1f" stroke-width="0.5"/>
      <rect x="35" y="88" width="30" height="7" fill="none" stroke="#1f3d1f" stroke-width="0.5"/>
      ${dots}
    </svg>`;
}

// Physical placeholder dots (5 dots, editable manually)
function physicalDots(filled=3, total=5, color='#22c55e') {
  return Array(total).fill(0).map((_,i) =>
    `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${i<filled?color:'#1f2937'};border:1px solid ${i<filled?color:'#374151'};margin-right:3px"></span>`
  ).join('');
}

// Form bars (5 placeholder bars)
function formBars() {
  const colors = ['#22c55e','#22c55e','#eab308','#ef4444','#22c55e'];
  return colors.map(c =>
    `<div style="display:inline-block;width:22px;height:28px;background:${c};border-radius:2px;margin-right:3px;opacity:0.85"></div>`
  ).join('');
}

export function generateOnePager(player) {
  const sd = Object.values(player.seasonsDetail||{})[0]||{};
  const rcs = player.roleCareerScores||{};
  const sortedRoles = Object.entries(rcs).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const topRole = sortedRoles[0]?.[0]||'—';
  const ls = LEAGUE_STRENGTHS[player.league]||50;
  const groups = sd.g||{};
  const allSeasons = player.allSeasonsSummary||[];
  const latestSeason = allSeasons[0]||{};
  const photo = photoUrl(player.name, player.team);
  const crest = player.teamFotmobId?`${CREST_BASE}${player.teamFotmobId}.png`:'';
  const careerLabel = scoreLabel(player.careerScore);
  const potLabel = scoreLabel(player.potentialScore||player.careerScore);

  const buildGroupBars = (grpKey) => (groups[grpKey]||[]).map(([label,pct,val])=>barHtml(label,pct,val)).join('');

  const roleRowsHtml = sortedRoles.map(([role,score])=>{
    const pct = Math.round(score);
    const color = scoreBandColor(score);
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="flex:1;font-size:10px;color:#d1d5db;font-weight:${role===topRole?700:400}">${role}</div>
        <div style="font-size:13px;font-weight:900;color:${color}">${pct}</div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${player.name} — Scout Report</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#1a0a14; color:#e2e8f4; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .no-print { display:none!important; }
    @page { size:A4 landscape; margin:0; }
    .page { width:297mm; height:210mm; padding:6mm; }
  }
  .page { width:1100px; min-height:720px; margin:0 auto; padding:20px; background:#1a0a14; }
  [contenteditable] { outline:none; cursor:text; }
  [contenteditable]:hover { background:rgba(255,255,255,0.05); border-radius:3px; }
</style>
</head>
<body>

<!-- PRINT BAR -->
<div class="no-print" style="background:#0e2040;color:#e2e8f4;padding:10px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100;border-bottom:1px solid #1e3d7a">
  <strong style="color:#60a5fa">${player.name} — Scout Report</strong>
  <span style="opacity:.6;font-size:11px">Click fields to edit text · Then print to PDF</span>
  <button onclick="window.print()" style="margin-left:auto;background:#3b7de8;color:#fff;border:none;padding:7px 16px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px">⬇ Save as PDF</button>
</div>

<div class="page">

  <!-- ═══ HEADER ROW ═══ -->
  <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;padding-bottom:12px;border-bottom:2px solid #7c1c4a">

    <!-- Photo -->
    <img src="${photo}" onerror="this.src='';this.style.background='#1f2937'" crossorigin="anonymous"
      style="width:90px;height:90px;border-radius:8px;object-fit:cover;flex-shrink:0;border:2px solid #7c1c4a;background:#1f2937"/>

    <!-- Name + info -->
    <div style="flex:1;min-width:0">
      <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.02em;line-height:1.1">${player.name}</div>
      <div style="font-size:12px;color:#a78bfa;font-weight:600;margin-bottom:6px">
        ${ROLE_KEY_LABELS[player.roleKey]||player.roleKey}
        ${player.position?' ('+player.position.split(',')[0].trim()+')':''}
        · ${player.foot&&player.foot!=='unknown'&&player.foot!=='nan'?formatFoot(player.foot):'—'}
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#d1d5db">
        <span style="font-weight:700;color:#e2e8f4">${player.age} years old</span>
        ${player.contract&&player.contract!=='nan'?`<span style="color:#6b7280">·</span><span>${player.contract}</span>`:''}
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">
        <!-- Nav tabs style (decorative) -->
        ${['Profile ▶','Performance ▼','Similar Players ▼','Club Fit ▼','Video ▼','Compare ▼'].map((t,i)=>`
          <span style="padding:3px 8px;border-radius:4px;background:${i===0?'#7c1c4a':'transparent'};color:${i===0?'#fff':'#6b7280'};font-size:9px;font-weight:600;border:1px solid ${i===0?'#7c1c4a':'#374151'}">${t}</span>`).join('')}
      </div>
    </div>

    <!-- Club info -->
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">
      ${crest?`<img src="${crest}" onerror="this.style.display='none'" crossorigin="anonymous" style="width:44px;height:44px;object-fit:contain"/>`:
        `<div style="width:44px;height:44px;background:#1f2937;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:18px">⚽</div>`}
      <div style="text-align:center">
        <div style="font-size:12px;font-weight:700;color:#fff">${player.team}</div>
        <div style="font-size:10px;color:#9ca3af">${player.league}</div>
        <div style="font-size:9px;color:#6b7280;margin-top:2px">
          ${topRole?topRole.split(' ').slice(-1)[0]+' Player':'—'}
        </div>
      </div>
    </div>

    <!-- Quick stats -->
    <div style="flex-shrink:0;display:flex;flex-direction:column;gap:4px;min-width:120px">
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span style="color:#9ca3af">Height:</span>
        <span contenteditable="true" style="color:#fff;font-weight:600">—</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span style="color:#9ca3af">Value:</span>
        <span style="color:#fff;font-weight:600">${player.marketValue>0?formatMV(player.marketValue):'—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span style="color:#9ca3af">Contract:</span>
        <span style="color:#fff;font-weight:600">${player.contract&&player.contract!=='nan'?player.contract:'—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span style="color:#9ca3af">xValue:</span>
        <span style="color:#60a5fa;font-weight:600">${player.xValue>0?formatMV(player.xValue):'—'}</span>
      </div>
    </div>

    <!-- Tactical map -->
    <div style="flex-shrink:0;width:130px">
      ${pitchMapHtml(player.position)}
    </div>

  </div>

  <!-- ═══ MAIN THREE COLUMNS ═══ -->
  <div style="display:grid;grid-template-columns:1fr 220px 200px;gap:14px">

    <!-- ── COL 1: Season stats + metric bars ── -->
    <div>
      <!-- Season stats row -->
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:800;color:#ec4899;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Season Stats</div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          ${crest?`<img src="${crest}" onerror="this.style.display='none'" crossorigin="anonymous" style="width:20px;height:20px;object-fit:contain"/>`:''} 
          <span style="font-size:11px;color:#d1d5db">${player.league}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;margin-bottom:8px">
          ${['Apps','Gls','Asts','xG','xA','Mins','Av. Rat'].map(h=>
            `<div style="font-size:8px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">${h}</div>`
          ).join('')}
          ${[
            latestSeason.m||'—',
            latestSeason.g||'0',
            latestSeason.a||'0',
            sd.score?((sd.score-40)/54*7.5+1).toFixed(1):'—',
            '—',
            latestSeason.mins?.toLocaleString()||'—',
            `<span contenteditable="true" style="color:#6b7280">—</span>`
          ].map(v=>`<div style="font-size:12px;font-weight:700;color:#e2e8f4">${v}</div>`).join('')}
        </div>
      </div>

      <!-- Attacking -->
      ${groups.A&&groups.A.length?`
      <div style="margin-bottom:8px">
        <div style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Attacking</div>
        ${buildGroupBars('A')}
      </div>`:''}

      <!-- Defensive -->
      ${groups.D&&groups.D.length?`
      <div style="margin-bottom:8px">
        <div style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Defensive</div>
        ${buildGroupBars('D')}
      </div>`:''}

      <!-- Possession -->
      ${groups.P&&groups.P.length?`
      <div style="margin-bottom:8px">
        <div style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Possession</div>
        ${buildGroupBars('P')}
      </div>`:''}

      <div style="font-size:8px;color:#4b5563;margin-top:4px">0% ·········· 50% ·········· 100% — Percentile Rank</div>
    </div>

    <!-- ── COL 2: Scout text + levels ── -->
    <div style="display:flex;flex-direction:column;gap:10px">

      <!-- Key Attributes -->
      <div style="background:#0d1220;border-radius:6px;padding:10px">
        <div style="font-size:9px;font-weight:700;color:#ec4899;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">● Key Attributes:</div>
        <div contenteditable="true" style="font-size:11px;color:#d1d5db;line-height:1.5;min-height:40px">
          Click to edit key attributes…
        </div>
      </div>

      <!-- Development Areas -->
      <div style="background:#0d1220;border-radius:6px;padding:10px">
        <div style="font-size:9px;font-weight:700;color:#ec4899;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">● Development Areas:</div>
        <div contenteditable="true" style="font-size:11px;color:#d1d5db;line-height:1.5;min-height:30px">
          Click to edit development areas…
        </div>
      </div>

      <!-- Scout View -->
      <div style="background:#0d1220;border-radius:6px;padding:10px;flex:1">
        <div style="font-size:9px;font-weight:700;color:#ec4899;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">● View:</div>
        <div contenteditable="true" style="font-size:11px;color:#d1d5db;line-height:1.5;min-height:80px">
          Click to edit scout view…
        </div>
      </div>

      <!-- Current Level -->
      <div>
        <div style="font-size:9px;font-weight:700;color:#9ca3af;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">Current Level</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span>${starsHtml(player.careerScore,14)}</span>
          <span style="font-size:10px;color:#d1d5db;font-weight:600">${careerLabel}</span>
        </div>
      </div>

      <!-- Potential Level -->
      <div>
        <div style="font-size:9px;font-weight:700;color:#9ca3af;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">Potential Level</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span>${starsHtml(player.potentialScore||player.careerScore,14)}</span>
          <span style="font-size:10px;color:#22c55e;font-weight:600">${potLabel}</span>
        </div>
      </div>

    </div>

    <!-- ── COL 3: Best role + trend + physical + form ── -->
    <div style="display:flex;flex-direction:column;gap:10px">

      <!-- Best Role -->
      <div>
        <div style="font-size:9px;font-weight:700;color:#9ca3af;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Best Role</div>
        ${roleRowsHtml||'<div style="color:#6b7280;font-size:10px">—</div>'}
      </div>

      <!-- Performance Trend -->
      <div>
        <div style="font-size:9px;font-weight:700;color:#9ca3af;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Performance Trend</div>
        ${(()=>{
          const sh = (player.sh||[]).slice(-4);
          if(sh.length<2) return '<div style="color:#6b7280;font-size:10px">Insufficient data</div>';
          const scores = sh.map(h=>h.sc);
          const min = Math.min(...scores)-5;
          const max = Math.max(...scores)+5;
          const W=180,H=60,pad=10;
          const pts = scores.map((s,i)=>{
            const x = pad + (i/(scores.length-1))*(W-pad*2);
            const y = H - pad - ((s-min)/(max-min))*(H-pad*2);
            return `${x},${y}`;
          });
          const dots = scores.map((s,i)=>{
            const x = pad + (i/(scores.length-1))*(W-pad*2);
            const y = H - pad - ((s-min)/(max-min))*(H-pad*2);
            return `<circle cx="${x}" cy="${y}" r="4" fill="#0d1220" stroke="#22c55e" stroke-width="2"/>
                    <text x="${x}" y="${y-7}" text-anchor="middle" font-size="9" fill="#e2e8f4" font-weight="700">${s.toFixed(0)}</text>
                    <text x="${x}" y="${H}" text-anchor="middle" font-size="7" fill="#6b7280">${sh[i].s.slice(2)}</text>`;
          }).join('');
          return `<svg viewBox="0 0 ${W} ${H+8}" style="width:100%;overflow:visible">
            <polyline points="${pts.join(' ')}" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linejoin="round"/>
            ${dots}
          </svg>`;
        })()}
      </div>

      <!-- Physical -->
      <div>
        <div style="font-size:9px;font-weight:700;color:#9ca3af;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Physical</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:10px;color:#d1d5db;width:50px">Pace</span>
            <div contenteditable="true" style="font-size:10px;color:#d1d5db">${physicalDots(3,5,'#eab308')}</div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:10px;color:#d1d5db;width:50px">Power</span>
            <div contenteditable="true" style="font-size:10px;color:#d1d5db">${physicalDots(4,5,'#22c55e')}</div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:10px;color:#d1d5db;width:50px">Fitness</span>
            <div contenteditable="true" style="font-size:10px;color:#d1d5db">${physicalDots(3,5,'#84cc16')}</div>
          </div>
        </div>
        <div style="font-size:8px;color:#4b5563;margin-top:3px">Click dots section to edit</div>
      </div>

      <!-- Form -->
      <div>
        <div style="font-size:9px;font-weight:700;color:#9ca3af;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Form</div>
        <div contenteditable="true">${formBars()}</div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:8px;color:#4b5563">Last 5 Avg Rating:</span>
          <span contenteditable="true" style="font-size:10px;font-weight:700;color:#e2e8f4">—</span>
        </div>
      </div>

    </div>
  </div>

</div>
</body>
</html>`;

  return html;
}

export function openOnePager(player) {
  const html = generateOnePager(player);
  const win = window.open('', '_blank', 'width=1200,height=800');
  if(!win) { alert('Please allow popups to generate the report.'); return; }
  win.document.write(html);
  win.document.close();
}
