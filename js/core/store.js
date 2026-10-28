// Stats par tentative, stockées uniquement dans le navigateur du téléphone.
const KEY = 'geoquiz.v1';

export const store = load();

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { s = {}; }
  s.attempts ||= [];
  s.pauses ??= 3;
  return s;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* stockage indisponible */ }
}

export function addAttempt(a) { store.attempts.push(a); save(); }

export function attemptsOf(quiz) { return store.attempts.filter(a => a.quiz === quiz); }

export function bestOf(quiz) {
  const a = attemptsOf(quiz);
  if (!a.length) return null;
  const best = a.reduce((m, x) => (x.found > m.found || (x.found === m.found && x.ms < m.ms) ? x : m));
  const full = a.filter(x => x.found === x.total);
  return { n: a.length, best, fastest: full.length ? Math.min(...full.map(x => x.ms)) : null };
}

// Export : un petit fichier JSON. Import : fusion sans doublons (même début, même quiz).
export function exportText() {
  return JSON.stringify({ app: 'geoquiz', version: 1, exportedAt: new Date().toISOString(), ...store }, null, 1);
}

export function importText(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.attempts)) throw new Error('format');
  const seen = new Set(store.attempts.map(a => a.at + a.quiz));
  let added = 0;
  for (const a of d.attempts) {
    if (a && a.at && a.quiz && !seen.has(a.at + a.quiz)) { store.attempts.push(a); seen.add(a.at + a.quiz); added++; }
  }
  store.attempts.sort((a, b) => a.at.localeCompare(b.at));
  save();
  return added;
}
