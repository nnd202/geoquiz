// Accueil : récents, sections repliables de quiz compacts, panneau de détail, quiz personnalisé, réglages.
import { $, el, fmt } from './core/dom.js';
import { prepare } from './core/text.js';
import { store, save, bestOf, attemptsOf, exportText, importText } from './core/store.js';
import { Game, END, onHome, wireGameControls } from './core/game.js';
import { MECHANICS } from './mechanics/index.js';

const SUPPORT = { map: 'Carte', grid: 'Grille' };
const cache = {};
let CAT = null;
store.ui ||= { closed: [] };

async function loadJeu(key) {
  if (cache[key]) return cache[key];
  const def = CAT.jeux[key];
  const [data, mapSvg] = await Promise.all([
    fetch(def.fichier).then(r => r.json()),
    def.carte ? fetch(def.carte).then(r => r.text()) : Promise.resolve(null),
  ]);
  prepare(data.items);
  return (cache[key] = { def, data, mapSvg });
}

// Entrée du catalogue → réglages de partie.
function toCfg(q) {
  const def = CAT.jeux[q.jeu];
  const sens = q.mecanique === 'clue' ? (def.sens.find(s => s.demande === q.demande) || def.sens[0]) : null;
  return { jeu: q.jeu, support: q.support, mech: q.mecanique, ask: sens?.demande ?? null, answer: sens?.reponse ?? null, n: q.n || 0, limit: q.chrono || 0 };
}

// Identifiant stable d'un quiz pour les stats (compatible avec le prototype pour les départements).
function quizId(c) {
  const def = CAT.jeux[c.jeu];
  let clue = '-';
  if (c.mech === 'clue') {
    clue = def.prefixe === 'dep' && c.ask === 'code' && c.answer === 'nom' ? 'num2name'
      : def.prefixe === 'dep' && c.ask === 'nom' && c.answer === 'code' ? 'name2num'
        : `${c.ask}>${c.answer}`;
  }
  return [def.prefixe, c.support, c.mech, clue, c.n, c.limit].join('|');
}

function tagsOf(c) {
  const def = CAT.jeux[c.jeu];
  const sens = def.sens.find(s => s.demande === c.ask && s.reponse === c.answer);
  return [SUPPORT[c.support], MECHANICS[c.mech].label, ...(c.mech === 'clue' && sens ? [sens.label] : []),
    c.n ? `${c.n} au hasard` : 'Tous', c.limit ? `${c.limit / 60} min` : 'Illimité'];
}

async function play(cfg, name, study = false) {
  const { def, data, mapSvg } = await loadJeu(cfg.jeu);
  closeSheet();
  new Game({ cfg, name, id: quizId(cfg), def, data, mapSvg, study }).start();
}

// Tous les quiz du catalogue, indexés par identifiant.
function allQuiz() {
  const out = new Map();
  for (const s of CAT.sections) for (const q of s.quiz) { const cfg = toCfg(q); out.set(quizId(cfg), { name: q.nom, cfg }); }
  return out;
}

/* ---------- Accueil ---------- */
function renderHome() {
  $('h-att').textContent = store.attempts.length;
  const today = new Date().toDateString();
  $('h-today').textContent = store.attempts.filter(x => new Date(x.at).toDateString() === today).length;
  renderRecent();
  renderSections();
  $('p-val').textContent = store.pauses;
}

// Les 4 derniers quiz joués, à un toucher de l'ouverture.
function renderRecent() {
  const known = allQuiz();
  const box = $('recent');
  box.textContent = '';
  const seen = new Set();
  for (const a of store.attempts.slice().reverse()) {
    if (seen.has(a.quiz) || !known.has(a.quiz)) continue;
    seen.add(a.quiz);
    const q = known.get(a.quiz);
    const chip = el('button', 'chip');
    chip.append(el('span', 'chip-name', q.name), el('span', 'chip-score num', `${a.found}/${a.total} · ${fmt(a.ms)}`));
    chip.addEventListener('click', () => play(q.cfg, q.name));
    chip.setAttribute('aria-label', `Rejouer ${q.name}`);
    box.append(chip);
    if (seen.size === 4) break;
  }
  $('recent-wrap').hidden = !seen.size;
}

function renderSections() {
  const host = $('sections');
  host.textContent = '';
  CAT.sections.forEach(sec => {
    const d = el('details', 'section');
    d.open = !store.ui.closed.includes(sec.titre);
    d.addEventListener('toggle', () => {
      store.ui.closed = store.ui.closed.filter(t => t !== sec.titre);
      if (!d.open) store.ui.closed.push(sec.titre);
      save();
    });
    const sum = el('summary');
    sum.append(el('span', 'sec-title', sec.titre), el('span', 'sec-count num', String(sec.quiz.length)));
    d.append(sum);
    const list = el('div', 'rows');
    for (const q of sec.quiz) list.append(quizRow(q.nom, toCfg(q)));
    d.append(list);
    host.append(d);
  });
}

function quizRow(name, cfg) {
  const row = el('div', 'qrow');
  const main = el('button', 'qmain');
  main.append(el('span', 'qname', name), el('span', 'qmeta', tagsOf(cfg).join(' · ')));
  main.addEventListener('click', () => openSheet(name, cfg));
  const last = attemptsOf(quizId(cfg)).at(-1);
  const score = el('span', 'qscore num', last ? `${last.found}/${last.total}` : '');
  const go = el('button', 'btn small', 'Jouer');
  go.addEventListener('click', () => play(cfg, name));
  row.append(main, score, go);
  return row;
}

/* ---------- Panneau de détail d'un quiz ---------- */
function openSheet(name, cfg) {
  closeSheet();
  const id = quizId(cfg);
  const veil = el('div', 'veil'); veil.id = 'veil';
  veil.addEventListener('click', e => { if (e.target === veil) closeSheet(); });
  const s = el('section', 'qsheet');
  s.setAttribute('role', 'dialog');
  s.setAttribute('aria-label', name);
  s.append(el('h3', null, name));
  const t = el('div', 'tags');
  tagsOf(cfg).forEach(x => t.append(el('span', 'tag', x)));
  s.append(t);
  const b = bestOf(id);
  const hist = attemptsOf(id).slice().reverse();
  const big = el('div', 'big');
  [[String(hist.length), 'Tentatives'], [b ? `${b.best.found}/${b.best.total}` : '–', 'Meilleur'], [b?.fastest ? fmt(b.fastest) : '–', 'Record']]
    .forEach(([v, k]) => { const d = el('div'); d.append(el('b', null, v), el('span', null, k)); big.append(d); });
  s.append(big);
  const r = el('div', 'row');
  const go = el('button', 'btn', 'Jouer'); go.addEventListener('click', () => play(cfg, name));
  const st = el('button', 'btn ghost', 'Étudier'); st.addEventListener('click', () => play(cfg, name, true));
  const x = el('button', 'btn ghost', 'Fermer'); x.addEventListener('click', closeSheet);
  r.append(go, st, x);
  s.append(r);
  if (hist.length) {
    const tw = el('div', 'tablewrap'), tb = el('table', 'hist');
    tb.innerHTML = '<thead><tr><th>Date</th><th>Heure</th><th>Score</th><th>Durée</th><th>Fin</th><th>Pauses</th></tr></thead>';
    const body = el('tbody');
    hist.slice(0, 20).forEach(h => {
      const d = new Date(h.at), tr = el('tr');
      [d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        `${h.found}/${h.total}`, fmt(h.ms), END[h.end] || h.end, h.pauses ?? 0].forEach(v => tr.append(el('td', null, String(v))));
      body.append(tr);
    });
    tb.append(body); tw.append(tb); s.append(tw);
  } else s.append(el('p', 'note', 'Pas encore de tentative.'));
  veil.append(s);
  document.body.append(veil);
  go.focus();
}
function closeSheet() { $('veil')?.remove(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ---------- Quiz personnalisé ---------- */
const custom = { jeu: 'departements', support: 'map', mech: 'clue', ask: 'code', answer: 'nom', n: 10, limit: 0 };

function renderBuilder() {
  const b = $('builder');
  b.textContent = '';
  const def = CAT.jeux[custom.jeu];
  if (!def.grille && custom.support === 'grid') custom.support = 'map';
  if (custom.support === 'grid' && custom.ask === 'zone') custom.ask = null;
  if (!def.sens.some(s => s.demande === custom.ask && s.reponse === custom.answer)) {
    const s0 = def.sens.find(s => custom.support !== 'grid' || s.demande !== 'zone') || def.sens[0];
    custom.ask = s0.demande; custom.answer = s0.reponse;
  }
  const field = (label, key, opts, isOn, set, disabled = () => false) => {
    const f = el('div', 'field');
    f.append(el('span', null, label));
    const s = el('div', 'seg');
    opts.forEach(([v, txt], i) => {
      const btn = el('button', null, txt);
      btn.id = `b-${key}-${i}`;
      btn.setAttribute('aria-pressed', String(isOn(v)));
      btn.disabled = disabled(v);
      btn.addEventListener('click', () => { set(v); renderBuilder(); });
      s.append(btn);
    });
    f.append(s); b.append(f);
  };
  const simple = key => [v => custom[key] === v, v => { custom[key] = v; }];
  field('Jeu', 'jeu', Object.entries(CAT.jeux).map(([k, d]) => [k, d.titre]), ...simple('jeu'));
  field('Support', 'support', Object.entries(SUPPORT), ...simple('support'), v => v === 'grid' && !def.grille);
  field('Mécanique', 'mech', Object.entries(MECHANICS).map(([k, m]) => [k, m.label]), ...simple('mech'));
  field("Indice", 'sens', def.sens.map(s => [s, s.label]),
    s => custom.ask === s.demande && custom.answer === s.reponse,
    s => { custom.ask = s.demande; custom.answer = s.reponse; },
    s => custom.mech !== 'clue' || (custom.support === 'grid' && s.demande === 'zone'));
  field('Sélection', 'n', [[0, 'Tous'], [10, '10 au hasard'], [20, '20'], [30, '30']], ...simple('n'));
  field('Chrono', 'limit', [[0, 'Illimité'], [120, '2 min'], [300, '5 min'], [600, '10 min'], [900, '15 min']], ...simple('limit'));
  const r = el('div', 'row');
  const cfg = () => ({ ...custom, ask: custom.mech === 'clue' ? custom.ask : null, answer: custom.mech === 'clue' ? custom.answer : null });
  const name = () => `Personnalisé · ${def.titre}`;
  const go = el('button', 'btn', 'Jouer'); go.addEventListener('click', () => play(cfg(), name()));
  const st = el('button', 'btn ghost', 'Étudier'); st.addEventListener('click', () => play(cfg(), name(), true));
  r.append(go, st); b.append(r);
}

/* ---------- Réglages et sauvegarde ---------- */
function wireSettings() {
  $('p-minus').addEventListener('click', () => { store.pauses = Math.max(0, store.pauses - 1); save(); renderHome(); });
  $('p-plus').addEventListener('click', () => { store.pauses = Math.min(9, store.pauses + 1); save(); renderHome(); });
  const msg = t => { $('io-msg').textContent = t; };
  $('exp').addEventListener('click', () => {
    const blob = new Blob([exportText()], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `geoquiz-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    msg('Sauvegarde téléchargée.');
  });
  const doImport = text => {
    try {
      const n = importText(text);
      renderHome();
      msg(`Import terminé : ${n} nouvelle${n > 1 ? 's' : ''} tentative${n > 1 ? 's' : ''}, ${store.attempts.length} au total.`);
    } catch {
      msg("Ce fichier n'est pas une sauvegarde Géo-quiz. Choisissez le fichier exporté, ou collez le texte en entier.");
    }
  };
  $('imp-file').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (f) doImport(await f.text());
    e.target.value = '';
  });
  $('imp-text').addEventListener('click', () => doImport($('io').value));
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function main() {
  CAT = await fetch('catalogue.json').then(r => r.json());
  wireGameControls();
  wireSettings();
  onHome(renderHome);
  renderHome();
  renderBuilder();
  loadJeu('departements');
  registerSW();
}

main().catch(() => {
  $('sections').textContent = "Impossible de charger les quiz. Vérifiez la connexion, puis rouvrez l'app.";
});
