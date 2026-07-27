import { deliverJson } from './utils';
// coachStorage.js — localStorage persistence for coach profiles, same pattern as
// the Scout Index shortlist (export/import JSON backup for the same reasons: tied
// to one browser/device, so a manual backup matters).

const KEY = 'scout_coaches';

export function loadCoaches() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCoaches(coaches) {
  try {
    localStorage.setItem(KEY, JSON.stringify(coaches));
    return true;
  } catch {
    return false;
  }
}

export function upsertCoach(coach) {
  const coaches = loadCoaches();
  const idx = coaches.findIndex(c => c.id === coach.id);
  if (idx >= 0) coaches[idx] = coach;
  else coaches.push(coach);
  saveCoaches(coaches);
  return coaches;
}

export function deleteCoach(id) {
  const coaches = loadCoaches().filter(c => c.id !== id);
  saveCoaches(coaches);
  return coaches;
}

export function newCoachId() {
  return 'coach_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

export function exportCoaches() {
  const coaches = loadCoaches();
  const payload = { coaches, exportedAt: new Date().toISOString() };
  deliverJson(JSON.stringify(payload, null, 2), `coaches_backup_${new Date().toISOString().slice(0, 10)}.json`);
}

export function importCoachesFile(file, onDone) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const imported = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.coaches) ? parsed.coaches : null);
      if (!imported) throw new Error('Invalid coaches backup file');
      const existing = loadCoaches();
      const byId = {};
      [...existing, ...imported].forEach(c => { byId[c.id] = c; }); // imported wins on id collision (most recent backup should be newest)
      const merged = Object.values(byId);
      saveCoaches(merged);
      if (onDone) onDone(merged);
    } catch (err) {
      alert("Could not read that file — make sure it's a coaches backup exported from this app.");
    }
  };
  reader.readAsText(file);
}
