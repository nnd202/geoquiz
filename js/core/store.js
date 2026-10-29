// Stats par tentative, stockées uniquement dans le navigateur de l'appareil.
const KEY = 'geoquiz.v1';

export const store = load();

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { s = {}; }
  s.attempts ||= [];
  s.pauses ??= 3;
  s.reminderDays ??= 7;     // rappel de sauvegarde tous les N jours (0 = jamais)
  s.lastExport ??= null;    // date ISO de la dernière sauvegarde
  s.snoozeUntil ??= null;   // « Plus tard » : pas de rappel avant cette date
  s.ui ||= {};
  s.ui.closed ||= [];       // sections repliées
  s.ui.opts ||= {};         // options choisies par quiz
  return s;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* stockage indisponible */ }
}

export function addAttempt(a) { store.attempts.push(a); save(); }

/* Identifiant de variante : jeu | support | mécanique | tirage (0 = tout).
 * Les anciens identifiants (prototype et première version) sont ramenés à ce format quand c'est possible :
 * « dep|grid|all|-|0|600 » devient « dep|grid|all|0 ». Les autres restent comptés dans les totaux. */
export function variantOf(id) {
  const p = String(id).split('|');
  if (p.length === 4) return id;
  if (p.length === 6 && p[3] === '-') return [p[0], p[1], p[2], p[4]].join('|');
  return id;
}

export function attemptsOf(variant) { return store.attempts.filter(a => variantOf(a.quiz) === variant); }

export function bestOf(variant) {
  const a = attemptsOf(variant);
  if (!a.length) return null;
  const best = a.reduce((m, x) => (x.found / x.total > m.found / m.total || (x.found / x.total === m.found / m.total && x.ms < m.ms) ? x : m));
  const full = a.filter(x => x.found === x.total);
  return { n: a.length, best, fastest: full.length ? Math.min(...full.map(x => x.ms)) : null };
}

/* ---------- Stats globales ---------- */
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const prevDay = k => { const [y, m, d] = k.split('-').map(Number); return dayKey(new Date(y, m - 1, d - 1)); };

// Séries recalculées à partir des dates de toutes les tentatives : un import fusionné compte aussi.
export function globalStats(now = new Date()) {
  const days = new Set(store.attempts.map(a => dayKey(a.at)));
  const sorted = [...days].sort();
  let longest = 0, run = 0, last = null;
  for (const k of sorted) {
    run = last && prevDay(k) === last ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = k;
  }
  const today = dayKey(now);
  let cur = 0;
  let k = days.has(today) ? today : prevDay(today); // la série reste vivante tant que la veille a été jouée
  while (days.has(k)) { cur++; k = prevDay(k); }
  return {
    current: cur, longest, playedToday: days.has(today),
    today: store.attempts.filter(a => dayKey(a.at) === today).length,
    total: store.attempts.length,
    totalMs: store.attempts.reduce((s, a) => s + (a.ms || 0), 0),
  };
}

/* ---------- Sauvegarde ---------- */
export function exportText() {
  return JSON.stringify({ app: 'geoquiz', version: 1, exportedAt: new Date().toISOString(),
    attempts: store.attempts, pauses: store.pauses, reminderDays: store.reminderDays }, null, 1);
}

export function markExported() { store.lastExport = new Date().toISOString(); store.snoozeUntil = null; save(); }

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

// Rappel : dû quand des tentatives existent et que la dernière sauvegarde date de N jours ou plus.
export function reminderDue(now = Date.now()) {
  if (!store.reminderDays || !store.attempts.length) return 0;
  if (store.snoozeUntil && now < Date.parse(store.snoozeUntil)) return 0;
  const since = store.lastExport ? Date.parse(store.lastExport) : Date.parse(store.attempts[0].at);
  const days = Math.floor((now - since) / 864e5);
  return days >= store.reminderDays ? days : 0;
}
export function snooze() { store.snoozeUntil = new Date(Date.now() + 864e5).toISOString(); save(); }
