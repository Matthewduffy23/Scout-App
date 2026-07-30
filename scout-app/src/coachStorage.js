import { deliverJson } from './utils';
// coachStorage.js — localStorage persistence for coach profiles, same pattern as
// the Scout Index shortlist (export/import JSON backup for the same reasons: tied
// to one browser/device, so a manual backup matters).

const KEY = 'scout_coaches';

// FIX: a corrupt or hand-edited value (anything that parses to a non-array — an
// object, a number, null) was returned straight through, and the first
// `coaches.findIndex` downstream threw. Everything here assumes an array, so
// enforce it at the boundary.
export function loadCoaches() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(c => c && typeof c === 'object') : [];
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

// FIX: saveCoaches' false return (quota exceeded, Safari private mode) was thrown
// away here, so the UI showed the coach as saved while nothing hit localStorage —
// the work was gone on refresh with no warning. Surface it instead.
export function upsertCoach(coach) {
  const coaches = loadCoaches();
  if (!coach.id) coach.id = newCoachId(); // guard: an id-less coach would collide on import
  const idx = coaches.findIndex(c => c.id === coach.id);
  if (idx >= 0) coaches[idx] = coach;
  else coaches.push(coach);
  const ok = saveCoaches(coaches);
  if (!ok) {
    alert('Could not save — browser storage is full or blocked. Export a backup before closing this tab.');
  }
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
  if (!coaches.length) { alert('No coaches to export yet.'); return; }
  const payload = { coaches, exportedAt: new Date().toISOString() };
  // deliverJson now reports back; on iOS a blocked save is worth saying out loud
  // rather than leaving Export looking dead.
  Promise.resolve(
    deliverJson(JSON.stringify(payload, null, 2), `coaches_backup_${new Date().toISOString().slice(0, 10)}.json`)
  ).catch(() => alert('Export failed — try again.'));
}

export function importCoachesFile(file, onDone) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => alert('Could not read that file.'); // FIX: read errors were silent
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const imported = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.coaches) ? parsed.coaches : null);
      if (!imported) throw new Error('Invalid coaches backup file');
      const existing = loadCoaches();
      const byId = {};
      // FIX: every coach missing an `id` used to land on the key `undefined`, so a
      // backup with two id-less entries silently imported only the last one. Mint an
      // id for anything that arrives without one before keying.
      [...existing, ...imported].forEach(c => {
        if (!c || typeof c !== 'object') return;
        if (!c.id) c.id = newCoachId();
        byId[c.id] = c; // imported wins on id collision (most recent backup should be newest)
      });
      const merged = Object.values(byId);
      if (!saveCoaches(merged)) {
        alert('Imported, but could not save to browser storage — it may be full.');
      }
      if (onDone) onDone(merged);
    } catch (err) {
      alert("Could not read that file — make sure it's a coaches backup exported from this app.");
    }
  };
  reader.readAsText(file);
}
