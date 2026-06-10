export const LEAGUE_STRENGTHS = {
  'England 1.':100,'England 2.':75.10,'England 3.':61.96,'England 4.':50.78,
  'England 5.':33.33,'England 6.':16.08,'Scotland 1.':61.76,'Scotland 2.':38.63,
  'Scotland 3.':20,'Ireland 1.':50.59,'Ireland 2.':10,
  'Northern Ireland 1.':30.98,'Wales 1.':26.67,
};
export const ALL_LEAGUES = [
  'England 1.','England 2.','England 3.','England 4.','England 5.','England 6.',
  'Scotland 1.','Scotland 2.','Scotland 3.','Ireland 1.','Ireland 2.',
  'Northern Ireland 1.','Wales 1.',
];
export const LEAGUE_PRESETS = {
  'All': null,
  'Prem (Eng 1)': ['England 1.'],
  'Championship (Eng 2)': ['England 2.'],
  'League One (Eng 3)': ['England 3.'],
  'League Two (Eng 4)': ['England 4.'],
  'EFL (Eng 2-4)': ['England 2.','England 3.','England 4.'],
  'Champ target (Eng 3-4)': ['England 3.','England 4.'],
  'Scottish Prem': ['Scotland 1.'],
  'Non-league (Eng 5-6)': ['England 5.','England 6.'],
};
export const ROLE_KEY_LABELS = {
  CB:'Centre Back', FB:'Fullback', CM:'Central Mid', ATT:'Attacker', CF:'Striker',
};
export const ROLES_BY_KEY = {
  CB: ['Ball Playing CB','Wide CB','Box Defender'],
  FB: ['Build Up FB','Attacking FB','Defensive FB','Wide Creator FB','Wide Carrier FB'],
  CM: ['Deep Playmaker CM','Advanced Playmaker CM','Defensive Midfielder DM','Goal Threat CM','Ball Carrying CM','Box-to-Box CM'],
  ATT: ['Playmaker ATT','Goal Threat ATT','Ball Carrier ATT'],
  CF: ['Target Man CF','Goal Threat CF','Link Up CF','False-9 Runner CF','False-9 Passer CF'],
};
export function scoreBandColor(s) {
  if (s >= 70) return '#22c55e';
  if (s >= 55) return '#3b82f6';
  if (s >= 40) return '#f59e0b';
  return '#6b7280';
}
export function scoreBand(s) {
  if (s >= 70) return 'Elite';
  if (s >= 55) return 'Advanced';
  if (s >= 40) return 'Developing';
  return 'Emerging';
}
export function formatMV(v) {
  if (!v||v<=0) return '—';
  if (v>=1000000) return `£${(v/1000000).toFixed(1)}m`;
  if (v>=1000) return `£${Math.round(v/1000)}k`;
  return `£${v}`;
}
export function formatFoot(f) {
  if (!f||f==='unknown'||f==='nan') return '—';
  return f.charAt(0).toUpperCase()+f.slice(1);
}
export function divColor(v) {
  const n=Math.max(0,Math.min(100,v||0));
  if (n>=80) return '#22c55e';
  if (n>=60) return '#84cc16';
  if (n>=40) return '#eab308';
  if (n>=20) return '#f97316';
  return '#ef4444';
}
