// ScoutingCardModal.js
// Small modal collecting the manual fields (notes, physical, form, club colour)
// then calls downloadScoutingCardPNG from PlayerScoutingCard.js

import React, { useState } from 'react';
import { downloadScoutingCardPNG } from './PlayerScoutingCard';

const inputStyle = {
  width: '100%', background: '#0d1424', border: '1px solid #1e2d4a', borderRadius: 5,
  color: '#fff', padding: '7px 9px', fontSize: 11.5, outline: 'none', fontFamily: 'inherit',
};
const labelStyle = { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, display: 'block' };
const sectionStyle = { marginBottom: 14 };

export default function ScoutingCardModal({ player, onClose }) {
  const [keyAttributes, setKeyAttributes] = useState('');
  const [devAreas, setDevAreas] = useState('');
  const [view, setView] = useState('');
  const [height, setHeight] = useState('');
  const [clubColor, setClubColor] = useState('#1a3a6b');
  const [currentLevel, setCurrentLevel] = useState('');
  const [currentScore, setCurrentScore] = useState(player.careerScore?.toFixed(0) || '70');
  const [potentialLevel, setPotentialLevel] = useState('');
  const [potentialScore, setPotentialScore] = useState((player.potentialScore || player.careerScore)?.toFixed(0) || '75');
  const [pace, setPace] = useState(3);
  const [power, setPower] = useState(3);
  const [fitness, setFitness] = useState(3);
  const [form, setForm] = useState('WWDLW');
  const [avgRating5, setAvgRating5] = useState('');
  const [posImageFile, setPosImageFile] = useState(null);
  const [posImageDataUrl, setPosImageDataUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePosImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPosImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setPosImageDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await downloadScoutingCardPNG(player, {
        keyAttributes, devAreas, view, height, clubColor,
        currentLevel, currentScore: Number(currentScore),
        potentialLevel, potentialScore: Number(potentialScore),
        physical: { Pace: pace, Power: power, Fitness: fitness },
        form: form.toUpperCase().split('').filter(c => 'WDL'.includes(c)).slice(0, 5),
        avgRating5,
        positionImageDataUrl: posImageDataUrl,
      });
    } catch (err) {
      alert('Failed to generate card: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#0c1424', borderRadius: 10, border: '1px solid #1e2d45',
        width: 480, maxHeight: '88vh', overflowY: 'auto', padding: 22,
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Scouting Card — {player.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Key Attributes</label>
          <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={keyAttributes} onChange={e => setKeyAttributes(e.target.value)} placeholder="Acceleration, pace, taking contact..." />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Development Areas</label>
          <textarea style={{ ...inputStyle, minHeight: 40, resize: 'vertical' }} value={devAreas} onChange={e => setDevAreas(e.target.value)} placeholder="Finishing, availability, consistency" />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Scout View</label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={view} onChange={e => setView(e.target.value)} placeholder="Fitness / injuries have stalled..." />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Height</label>
            <input style={inputStyle} value={height} onChange={e => setHeight(e.target.value)} placeholder="5'11" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Club Colour (hex)</label>
            <input style={inputStyle} value={clubColor} onChange={e => setClubColor(e.target.value)} placeholder="#1a3a6b" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Current Level Label</label>
            <input style={inputStyle} value={currentLevel} onChange={e => setCurrentLevel(e.target.value)} placeholder="Very Good Champ ST" />
          </div>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Score</label>
            <input style={inputStyle} type="number" value={currentScore} onChange={e => setCurrentScore(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Potential Level Label</label>
            <input style={inputStyle} value={potentialLevel} onChange={e => setPotentialLevel(e.target.value)} placeholder="Good Top 5 EU League ST" />
          </div>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Score</label>
            <input style={inputStyle} type="number" value={potentialScore} onChange={e => setPotentialScore(e.target.value)} />
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Physical (1–5)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['Pace', pace, setPace], ['Power', power, setPower], ['Fitness', fitness, setFitness]].map(([lbl, val, setter]) => (
              <div key={lbl} style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, color: '#9ca3af', marginBottom: 3 }}>{lbl}</div>
                <input type="range" min={1} max={5} value={val} onChange={e => setter(Number(e.target.value))} style={{ width: '100%' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: '#fff' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Form (e.g. WDLWW)</label>
            <input style={inputStyle} value={form} onChange={e => setForm(e.target.value)} maxLength={5} />
          </div>
          <div style={{ width: 110 }}>
            <label style={labelStyle}>Last 5 Avg</label>
            <input style={inputStyle} value={avgRating5} onChange={e => setAvgRating5(e.target.value)} placeholder="6.3" />
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Position Diagram Image</label>
          <input type="file" accept="image/*" onChange={handlePosImage} style={{ fontSize: 11, color: '#94a3b8' }} />
        </div>

        <button
          onClick={handleGenerate}
          disabled={busy}
          style={{
            width: '100%', background: busy ? '#374151' : '#fff', color: busy ? '#9ca3af' : '#000',
            border: 'none', borderRadius: 6, padding: '11px 0', fontSize: 13, fontWeight: 800,
            cursor: busy ? 'default' : 'pointer', marginTop: 6,
          }}
        >
          {busy ? 'Generating…' : '🖼 Generate & Download PNG'}
        </button>
      </div>
    </div>
  );
}
