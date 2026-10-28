// Accueil : catalogue des quiz, quiz personnalisé, réglages, sauvegarde.
import { $, el, fmt } from './core/dom.js';
import { prepare } from './core/text.js';
import { store, save, bestOf, exportText, importText } from './core/store.js';
import { Game, onHome, wireGameControls } from './core/game.js';
import { MECHANICS } from './mechanics/index.js';

const SUPPORT = { map: 'Carte', grid: 'Grille' };
const cache = {};

async function loadJeu(cat, key) {
  if (cache[key]) return cache[key];
  const def = cat.jeux[key];
  const [data, mapSvg] = await Promise.all([
    fetch(def.fichier).then(r => r.json()),
    def.carte ? fetch(def.carte).then(r => r.text()) : Promise.resolve(null),
  ]);
  prepare(data.items);
  return (cache[key] = { def, data, mapSvg });
}

// Entrée du catalogue → réglages de partie.
const toCfg = q => ({
  jeu: q.jeu, support: q.support, mech: q.mecanique,
  ask: q.mecanique === 'clue' ? (q.demande || 'code') : null,
  n: q.n || 0, limit: q.chrono || 0,
});

// Identifiant stable d'un quiz pour les stats (compatible avec le prototype).
const quizId = (cat, c) => [cat.jeux[c.jeu].prefixe, c.support, c.mech,
  c.mech === 'clue' ? (c.ask === 'code' ? 'num2name' : 'name2num') : '-', c.n, c.limit].join('|');

const tagsOf = (cat, c) => [SUPPORT[c.support], MECHANICS[c.mech].label,
  ...(c.mech === 'clue' ? [cat.jeux[c.jeu].sens[c.ask]] : []),
  c.n ? `${c.n} au hasard` : 'Tous', c.limit ? `${c.limit / 60} min` : 'Temps illimité'];

async function play(cat, cfg, name, study = false) {
  const { data, mapSvg } = await loadJeu(cat, cfg.jeu);
  new Game({ cfg, name, id: quizId(cat, cfg), data, mapSvg, study }).start();
}

function renderHome(cat) {
  $('h-att').textContent = store.attempts.length;
  const today = new Date().toDateString();
  $('h-today').textContent = store.attempts.filter(x => new Date(x.at).toDateString() === today).length;
  const box = $('presets');
  box.textContent = '';
  for (const q of cat.quiz) {
    const cfg = toCfg(q);
    const c = el('article', 'card');
    c.append(el('h3', null, q.nom));
    const t = el('div', 'tags');
    tagsOf(cat, cfg).forEach(x => t.append(el('span', 'tag', x)));
    c.append(t);
    const b = bestOf(quizId(cat, cfg));
    const s = el('div', 'stat');
    if (b) {
      s.append(el('b', null, String(b.n)), document.createTextNode(` tentative${b.n > 1 ? 's' : ''} · meilleur `),
        el('b', null, `${b.best.found}/${b.best.total}`));
      if (b.fastest) s.append(document.createTextNode(' · record '), el('b', null, fmt(b.fastest)));
    } else s.textContent = 'Pas encore de tentative';
    c.append(s);
    const r = el('div', 'row');
    const go = el('button', 'btn small', 'Jouer');
    go.addEventListener('click', () => play(cat, cfg, q.nom));
    const st = el('button', 'btn small ghost', 'Étudier');
    st.addEventListener('click', () => play(cat, cfg, q.nom, true));
    r.append(go, st); c.append(r); box.append(c);
  }
  $('p-val').textContent = store.pauses;
}

function renderBuilder(cat, custom) {
  const b = $('builder');
  b.textContent = '';
  const sens = cat.jeux[custom.jeu].sens;
  const field = (label, key, opts) => {
    const f = el('div', 'field');
    f.append(el('span', null, label));
    const s = el('div', 'seg');
    for (const [v, txt] of opts) {
      const btn = el('button', null, txt);
      btn.id = `b-${key}-${v}`;
      btn.setAttribute('aria-pressed', String(custom[key] === v));
      if (key === 'ask' && custom.mech !== 'clue') btn.disabled = true;
      btn.addEventListener('click', () => { custom[key] = v; renderBuilder(cat, custom); });
      s.append(btn);
    }
    f.append(s); b.append(f);
  };
  field('Support', 'support', Object.entries(SUPPORT));
  field('Mécanique', 'mech', Object.entries(MECHANICS).map(([k, m]) => [k, m.label]));
  field("Sens de l'indice", 'ask', Object.entries(sens));
  field('Sélection', 'n', [[0, 'Tous'], [10, '10 au hasard'], [20, '20'], [30, '30']]);
  field('Chrono', 'limit', [[0, 'Illimité'], [120, '2 min'], [300, '5 min'], [600, '10 min']]);
  const r = el('div', 'row');
  const cfg = () => ({ ...custom, ask: custom.mech === 'clue' ? custom.ask : null });
  const go = el('button', 'btn', 'Jouer');
  go.addEventListener('click', () => play(cat, cfg(), 'Personnalisé'));
  const st = el('button', 'btn ghost', 'Étudier');
  st.addEventListener('click', () => play(cat, cfg(), 'Personnalisé', true));
  r.append(go, st); b.append(r);
}

function wireSettings(cat) {
  $('p-minus').addEventListener('click', () => { store.pauses = Math.max(0, store.pauses - 1); save(); renderHome(cat); });
  $('p-plus').addEventListener('click', () => { store.pauses = Math.min(9, store.pauses + 1); save(); renderHome(cat); });

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
      renderHome(cat);
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

// Hors ligne et mises à jour : le service worker garde l'app en cache et la rafraîchit à l'ouverture.
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function main() {
  const cat = await fetch('catalogue.json').then(r => r.json());
  const custom = { jeu: cat.personnalise.jeu, support: 'map', mech: 'clue', ask: 'code', n: 10, limit: 0 };
  wireGameControls();
  wireSettings(cat);
  onHome(() => renderHome(cat));
  renderHome(cat);
  renderBuilder(cat, custom);
  loadJeu(cat, cat.personnalise.jeu); // préchargement
  registerSW();
}

main().catch(() => {
  $('presets').textContent = "Impossible de charger les quiz. Vérifiez la connexion, puis rouvrez l'app.";
});
