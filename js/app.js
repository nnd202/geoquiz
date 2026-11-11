// Accueil : stats globales, sections repliables, panneau d'options par quiz, réglages et sauvegarde.
import { $, el } from './core/dom.js';
import { prepare } from './core/text.js';
import { store, save, bestOf, attemptsOf, importText, globalStats, reminderDue, snooze, variantOf } from './core/store.js';
import { morseCfg, setMorse } from './core/morse.js';
import { Game, END, fmtLong, onHome, wireGameControls, backRequest } from './core/game.js';
import { saveNow, folderSupported, folderState, chooseFolder, forgetFolder, writeToFolder } from './core/backup.js';

const cache = {};
let CAT = null;

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

/* ---------- Quiz et options ----------
 * Un quiz du catalogue = un jeu + un support. Ses options (tirage, mode clic) donnent la variante jouée,
 * et chaque variante a ses propres stats et records. */
const quizKey = q => `${q.jeu}|${q.support || 'map'}`;
const canRandom = q => CAT.jeux[q.jeu].nb > CAT.options.seuilHasard;
function optsOf(q) {
  const o = store.ui.opts[quizKey(q)] || {};
  // Curseur : choix mémorisé, sinon réglage par défaut du quiz (« curseur » dans le catalogue).
  return { random: !!o.random && canRandom(q), click: !!o.click, cursor: q.support === 'grid' && !!(o.cursor ?? q.curseur) };
}
function cfgOf(q, o = optsOf(q)) {
  // Un quiz peut imposer sa mécanique (morse : manipulateur, écoute).
  return { jeu: q.jeu, support: q.support || 'map', mech: q.mecanique || (o.click ? 'tap' : o.cursor ? 'cur' : 'all'), n: o.random ? CAT.options.hasard : 0 };
}
const variantId = c => [CAT.jeux[c.jeu].prefixe, c.support, c.mech, c.n].join('|');
const MECH_LABEL = { key: 'manipulateur', ear: 'à l’oreille', bwrite: 'écriture' };
const optsLabel = (o, q = {}) => [o.random ? `${CAT.options.hasard} au hasard` : 'Tous', MECH_LABEL[q.mecanique] || (o.click ? 'clic' : o.cursor ? 'saisie · curseur' : 'saisie')].join(' · ');

async function play(q, study = false) {
  const cfg = cfgOf(q);
  const { def, data, mapSvg } = await loadJeu(q.jeu);
  closeSheet(true);
  pushGuard();
  new Game({ cfg, name: q.nom, id: variantId(cfg), def, data, mapSvg, study }).start();
}

/* ---------- Accueil ---------- */
function renderHome() {
  const g = globalStats();
  const tiles = [
    [String(g.current), g.current > 1 ? 'jours de suite' : 'jour de suite', g.playedToday ? '' : g.current ? 'à prolonger aujourd’hui' : ''],
    [String(g.longest), 'record de série', ''],
    [String(g.today), "aujourd'hui", ''],
    [String(g.total), 'quiz au total', ''],
    [fmtTotal(g.totalMs), 'temps cumulé', ''],
  ];
  const box = $('stats');
  box.textContent = '';
  for (const [v, k, hint] of tiles) {
    const d = el('div', 'stat');
    d.append(el('b', 'num', v), el('span', null, k));
    if (hint) d.append(el('em', null, hint));
    box.append(d);
  }
  renderSections();
  $('p-val').textContent = store.pauses;
  const mc = morseCfg();
  $('mw-val').textContent = mc.wpm;
  $('ma-on').setAttribute('aria-pressed', String(mc.aide)); $('ma-off').setAttribute('aria-pressed', String(!mc.aide));
  $('r-val').textContent = store.reminderDays ? `${store.reminderDays} j` : 'jamais';
  $('last-save').textContent = store.lastExport
    ? `Dernière sauvegarde : ${new Date(store.lastExport).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${new Date(store.lastExport).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}.`
    : "Aucune sauvegarde pour l'instant.";
  renderFolder();
  maybeRemind();
}

// Temps cumulé : minutes, puis heures, puis jours au-delà de 48 h (« 6 j 22 h ») pour rester court.
function fmtTotal(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  return `${Math.floor(m / 1440)} j ${Math.floor(m % 1440 / 60)} h`;
}

// Nombre de parties terminées aujourd'hui pour un quiz, toutes options confondues.
function todayCount(q) {
  const pre = `${CAT.jeux[q.jeu].prefixe}|${q.support || 'map'}|`;
  const today = new Date().toDateString();
  return store.attempts.filter(a => variantOf(a.quiz).startsWith(pre) && new Date(a.at).toDateString() === today).length;
}

function renderSections() {
  const host = $('sections');
  host.textContent = '';
  for (const sec of CAT.sections) {
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
    for (const q of sec.quiz) list.append(quizRow(q));
    d.append(list);
    host.append(d);
  }
}

function quizRow(q) {
  const def = CAT.jeux[q.jeu];
  const o = optsOf(q);
  const row = el('div', 'qrow');
  const main = el('button', 'qmain');
  const meta = [`${def.nb}`, q.support === 'grid' ? 'grille' : 'carte', optsLabel(o, q)].join(' · ');
  main.append(el('span', 'qname', q.nom), el('span', 'qmeta', meta));
  main.addEventListener('click', () => openSheet(q));
  const best = bestOf(variantId(cfgOf(q, o)));
  const score = el('span', 'qscore num', best?.fastest ? fmtLong(best.fastest) : best ? `${best.best.found}/${best.best.total}` : '');
  if (best?.fastest) score.title = 'Meilleur temps sur cette variante';
  const go = el('button', 'btn small play', 'Jouer');
  go.addEventListener('click', () => play(q));
  const n = todayCount(q);
  if (n) {
    const badge = el('span', 'badge num', String(n));
    badge.setAttribute('aria-label', `${n} partie${n > 1 ? 's' : ''} aujourd'hui`);
    go.append(badge);
  }
  row.append(main, score, go);
  return row;
}

/* ---------- Panneau d'un quiz : options, stats de la variante, historique ---------- */
function openSheet(q) {
  closeSheet();
  const def = CAT.jeux[q.jeu];
  const veil = el('div', 'veil'); veil.id = 'veil';
  veil.addEventListener('click', e => { if (e.target === veil) closeSheet(); });
  const s = el('section', 'qsheet');
  s.setAttribute('role', 'dialog');
  s.setAttribute('aria-label', q.nom);
  veil.append(s);
  document.body.append(veil);
  pushGuard();

  const draw = () => {
    s.textContent = '';
    const o = optsOf(q);
    s.append(el('h3', null, q.nom));
    s.append(el('p', 'note', `${def.nb} éléments · ${q.support === 'grid' ? 'grille' : 'carte'}`));
    const setOpt = (k, v) => { store.ui.opts[quizKey(q)] = { ...optsOf(q), [k]: v }; save(); draw(); renderSections(); };
    const seg = (label, key, choices) => {
      const f = el('div', 'field');
      f.append(el('span', null, label));
      const g = el('div', 'seg');
      for (const [v, txt] of choices) {
        const b = el('button', null, txt);
        b.setAttribute('aria-pressed', String(o[key] === v));
        b.addEventListener('click', () => setOpt(key, v));
        g.append(b);
      }
      f.append(g);
      s.append(f);
    };
    if (canRandom(q)) seg('Sélection', 'random', [[false, `Tous (${def.nb})`], [true, `${CAT.options.hasard} au hasard`]]);
    if (!q.mecanique) {
      seg('Réponse', 'click', [[false, 'Je tape les noms'], [true, q.support === 'grid' ? 'Je touche la case' : 'Je touche la carte']]);
      if (q.support === 'grid' && !o.click) seg('Grille', 'cursor', [[false, 'Libre'], [true, 'Curseur']]);
    }

    const id = variantId(cfgOf(q, o));
    const b = bestOf(id);
    const hist = attemptsOf(id).slice().reverse();
    const big = el('div', 'big');
    [[String(hist.length), 'Tentatives'], [b ? `${b.best.found}/${b.best.total}` : '–', 'Meilleur score'], [b?.fastest ? fmtLong(b.fastest) : '–', 'Meilleur temps']]
      .forEach(([v, k]) => { const d = el('div'); d.append(el('b', null, v), el('span', null, k)); big.append(d); });
    s.append(big);

    const r = el('div', 'row');
    const go = el('button', 'btn', 'Jouer'); go.addEventListener('click', () => play(q));
    const st = el('button', 'btn ghost', 'Étudier'); st.addEventListener('click', () => play(q, true));
    const x = el('button', 'btn ghost', 'Fermer'); x.addEventListener('click', () => closeSheet());
    r.append(go, st, x);
    s.append(r);
    if (hist.length) {
      s.append(el('h2', null, `Historique · ${optsLabel(o, q)}`));
      const tw = el('div', 'tablewrap'), tb = el('table', 'hist');
      tb.innerHTML = '<thead><tr><th>Date</th><th>Heure</th><th>Score</th><th>Durée</th><th>Fin</th><th>Pauses</th></tr></thead>';
      const body = el('tbody');
      hist.slice(0, 30).forEach(h => {
        const d = new Date(h.at), tr = el('tr');
        [d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          `${h.found}/${h.total}`, fmtLong(h.ms), END[h.end] || h.end, h.pauses ?? 0].forEach(v => tr.append(el('td', null, String(v))));
        body.append(tr);
      });
      tb.append(body); tw.append(tb); s.append(tw);
    } else s.append(el('p', 'note', 'Pas encore de tentative avec ces options.'));
    go.focus();
  };
  draw();
}
function closeSheet(keepGuard = false) {
  if (!$('veil')) return;
  $('veil').remove();
  if (!keepGuard) dropGuard();
}

/* ---------- Bouton retour d'Android ----------
 * Une entrée d'historique « garde » est ajoutée quand un panneau ou une partie s'ouvre.
 * Retour la consomme : il ferme le panneau, ou annule la partie (avec confirmation au-delà de 10 trouvés).
 * Sur l'accueil, sans garde, retour quitte l'app normalement. */
let ignorePop = false;
function pushGuard() { if (!history.state?.gq) history.pushState({ gq: 1 }, ''); }
function dropGuard() { if (history.state?.gq) { ignorePop = true; history.back(); } }
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; return; }
  if ($('remind')) { $('remind').remove(); snooze(); return; }
  if ($('veil')) { $('veil').remove(); return; }
  if (!$('game').hidden && backRequest()) pushGuard(); // la partie continue (confirmation affichée ou refusée)
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); $('remind')?.remove(); } });

/* ---------- Rappel de sauvegarde ---------- */
function maybeRemind() {
  const days = reminderDue();
  if (!days || $('remind') || !$('game').hidden) return;
  const veil = el('div', 'veil center'); veil.id = 'remind';
  const box = el('section', 'qsheet small');
  box.setAttribute('role', 'dialog');
  box.append(el('h3', null, 'Sauvegarder vos stats ?'),
    el('p', 'note', store.lastExport ? `Dernière sauvegarde il y a ${days} jours.` : 'Vous n’avez encore jamais sauvegardé vos stats.'));
  const r = el('div', 'row');
  const ok = el('button', 'btn', 'Sauvegarder');
  ok.addEventListener('click', async () => { const m = await saveNow(); veil.remove(); renderHome(); flash(m); });
  const later = el('button', 'btn ghost', 'Plus tard');
  later.addEventListener('click', () => { snooze(); veil.remove(); });
  r.append(ok, later);
  box.append(r);
  veil.append(box);
  document.body.append(veil);
}
function flash(m) { $('io-msg').textContent = m; }

/* ---------- Réglages et sauvegarde ---------- */
async function renderFolder() {
  const box = $('folder');
  if (!folderSupported()) { box.hidden = true; return; }
  box.hidden = false;
  const st = await folderState();
  const txt = $('folder-txt'), b1 = $('folder-pick'), b2 = $('folder-off');
  if (!st) { txt.textContent = 'Sur ordinateur, l’app peut réécrire la sauvegarde dans un dossier de votre choix après chaque quiz.'; b1.textContent = 'Choisir un dossier'; b2.hidden = true; return; }
  b2.hidden = false;
  if (st.perm === 'granted') { txt.textContent = `Sauvegarde automatique dans « ${st.name} » après chaque quiz.`; b1.textContent = 'Changer de dossier'; }
  else { txt.textContent = `Dossier « ${st.name} » : autorisation à renouveler depuis la réouverture de l’app.`; b1.textContent = 'Autoriser'; }
}

function wireSettings() {
  const step = (id, f) => $(id).addEventListener('click', () => { f(); save(); renderHome(); });
  step('p-minus', () => { store.pauses = Math.max(0, store.pauses - 1); });
  step('p-plus', () => { store.pauses = Math.min(9, store.pauses + 1); });
  step('r-minus', () => { store.reminderDays = Math.max(0, store.reminderDays - 1); });
  step('r-plus', () => { store.reminderDays = Math.min(60, store.reminderDays + 1); });
  // Morse : de 5 à 30 mots par minute (12 par défaut : point 100 ms, trait 300 ms).
  step('mw-minus', () => setMorse({ wpm: Math.max(5, morseCfg().wpm - 1) }));
  step('mw-plus', () => setMorse({ wpm: Math.min(30, morseCfg().wpm + 1) }));
  step('ma-on', () => setMorse({ aide: true }));
  step('ma-off', () => setMorse({ aide: false }));
  $('exp').addEventListener('click', async () => { flash(await saveNow()); renderHome(); });
  const doImport = text => {
    try {
      const n = importText(text);
      renderHome();
      flash(`Import terminé : ${n} nouvelle${n > 1 ? 's' : ''} tentative${n > 1 ? 's' : ''}, ${store.attempts.length} au total.`);
    } catch {
      flash("Ce fichier n'est pas une sauvegarde Geoquiz. Choisissez le fichier exporté, ou collez le texte en entier.");
    }
  };
  $('imp-file').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (f) doImport(await f.text());
    e.target.value = '';
  });
  $('imp-text').addEventListener('click', () => doImport($('io').value));
  $('folder-pick').addEventListener('click', async () => {
    try {
      const st = await folderState();
      if (st && st.perm !== 'granted') await writeToFolder(true);
      else await chooseFolder();
      flash('Sauvegarde automatique activée.');
    } catch { flash('Aucun dossier choisi.'); }
    renderHome();
  });
  $('folder-off').addEventListener('click', async () => { await forgetFolder(); flash('Sauvegarde automatique désactivée.'); renderHome(); });
}

// Mise à jour : quand une nouvelle version prend la main, l'accueil se recharge tout seul
// (jamais pendant une partie : la nouvelle version attend alors le prochain retour à l'accueil).
let pendingReload = false;
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // première installation : la page est déjà à jour
    if ($('game').hidden) location.reload(); else pendingReload = true;
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}

async function main() {
  CAT = await fetch('catalogue.json').then(r => r.json());
  wireGameControls();
  wireSettings();
  onHome(() => { if (pendingReload) return location.reload(); renderHome(); dropGuard(); });
  renderHome();
  registerSW();
  trackViewport();
  showVersion();
  navigator.serviceWorker?.ready.then(() => setTimeout(showVersion, 1500));
}

// Zone réellement visible (barre du navigateur, clavier) : les fenêtres s'y calent en direct.
function trackViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const set = () => {
    document.documentElement.style.setProperty('--vv-h', `${vv.height}px`);
    document.documentElement.style.setProperty('--vv-top', `${vv.offsetTop}px`);
  };
  vv.addEventListener('resize', set);
  vv.addEventListener('scroll', set);
  set();
}

// Version installée (nom du cache hors ligne), pour vérifier qu'une mise à jour est bien arrivée.
async function showVersion() {
  try {
    const k = (await caches.keys()).filter(n => n.startsWith('geoquiz-')).sort((a, b) => parseInt(b.slice(8)) - parseInt(a.slice(8)))[0];
    if (k) $('app-version').textContent = `Version ${k.slice(8)}`;
  } catch { /* rien */ }
}

main().catch(() => {
  $('sections').textContent = "Impossible de charger les quiz. Vérifiez la connexion, puis rouvrez l'app.";
});
