// Accueil : stats globales, sections repliables, panneau d'options par quiz, réglages et sauvegarde.
import { $, el } from './core/dom.js';
import { prepare } from './core/text.js';
import { store, save, bestOf, attemptsOf, importText, globalStats, reminderDue, snooze, variantOf } from './core/store.js';
import { morseCfg, setMorse } from './core/morse.js';
import { Game, END, fmtLong, onHome, wireGameControls, backRequest } from './core/game.js';
import { saveNow, folderSupported, folderState, chooseFolder, forgetFolder, writeToFolder } from './core/backup.js';
import { visibleSet, today, fmtCoord } from './core/sky.js';

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
const quizKey = q => q.id || `${q.jeu}|${q.support || 'map'}`;
// Ciel mobile : un seul quiz pour trois listes (q.ciel) ; la liste choisie donne le jeu joué.
const jeuOf = (q, o = store.ui.opts[quizKey(q)] || {}) => q.ciel?.includes(o.liste) ? o.liste : q.jeu;
const canRandom = (q, jeu = jeuOf(q)) => !q.libre && CAT.jeux[jeu].nb > CAT.options.seuilHasard;
const CARTES = [['cfixe', 'Deux disques fixes'], ['cpol', 'Polaire au centre'], ['czen', 'Mon ciel']];
const placeOf = o => store.places.find(p => p.nom === o.lieu) || store.places[0];
function optsOf(q) {
  const o = store.ui.opts[quizKey(q)] || {};
  const sky = q.ciel ? { liste: jeuOf(q, o), carte: CARTES.some(c => c[0] === o.carte) ? o.carte : 'czen', lieu: o.lieu || null, date: o.date || null, sun: !!o.sun } : {};
  // Curseur : choix mémorisé, sinon réglage par défaut du quiz (« curseur » dans le catalogue).
  return { random: !!o.random && canRandom(q), click: !!o.click, cursor: q.support === 'grid' && !!(o.cursor ?? q.curseur), alpha: !!q.ordre && !!o.alpha, ...sky };
}
function cfgOf(q, o = optsOf(q)) {
  // Un quiz peut imposer sa mécanique (morse : manipulateur, écoute).
  // Ciel mobile : la carte choisie tient lieu de support (variantes distinctes des quiz du ciel existants).
  return { jeu: jeuOf(q), support: q.ciel ? o.carte : q.support || 'map', mech: q.mecanique || (o.click ? 'tap' : o.cursor ? 'cur' : 'all'), n: o.random ? CAT.options.hasard : 0,
    // Ordre de la grille (hors identifiant de variante : même historique) : alphabétique seulement en « Tous ».
    alpha: o.alpha && !o.random };
}
const variantId = c => [CAT.jeux[c.jeu].prefixe, c.support, c.mech, c.n].join('|');
const MECH_LABEL = { free: 'transmission libre', key: 'manipulateur', ear: 'à l’oreille', bwrite: 'écriture' };
const optsLabel = (o, q = {}) => [
  ...(q.ciel ? [CARTES.find(c => c[0] === o.carte)[1], ...(o.carte !== 'cfixe' && placeOf(o) ? [placeOf(o).nom] : [])] : []),
  o.random ? `${CAT.options.hasard} au hasard` : 'Tous', MECH_LABEL[q.libre ? 'free' : q.mecanique] || (o.click ? 'clic' : o.cursor ? 'saisie · curseur' : 'saisie')].join(' · ');

let skyGeo = null;
const loadGeo = async () => (skyGeo ||= await fetch('data/ciel-geo.json').then(r => r.json()));
// Ciel mobile : lieu, date et soleil choisis ; le ciel démarre à 22 h, heure solaire du lieu.
async function skyState(q, o, items) {
  if (!q.ciel || o.carte === 'cfixe') return null;
  const geo = await loadGeo(), p = placeOf(o);
  return { mode: o.carte, nom: p.nom, lat: p.lat, lon: p.lon, date: o.date || today(), sun: o.sun, h: 22, geo, visible: visibleSet(items, geo, p.lat) };
}

async function play(q, study = false) {
  const cfg = cfgOf(q);
  const { def, data, mapSvg } = await loadJeu(cfg.jeu);
  const sky = await skyState(q, optsOf(q), data.items);
  closeSheet(true);
  pushGuard();
  new Game({ cfg, name: q.nom, id: variantId(cfg), def, data, mapSvg, study, sky }).start();
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
  const pres = new Set((q.ciel || [q.jeu]).map(j => CAT.jeux[j].prefixe));
  const sups = new Set(q.ciel ? CARTES.map(c => c[0]) : [q.support || 'map']);
  const day = new Date().toDateString();
  return store.attempts.filter(a => { const [p, s] = variantOf(a.quiz).split('|'); return pres.has(p) && sups.has(s) && new Date(a.at).toDateString() === day; }).length;
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
  const def = CAT.jeux[jeuOf(q)];
  const o = optsOf(q);
  const row = el('div', 'qrow');
  const main = el('button', 'qmain');
  const meta = [`${def.nb}`, ...(q.ciel ? [] : [q.support === 'grid' ? 'grille' : 'carte']), optsLabel(o, q)].join(' · ');
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
    const def = CAT.jeux[jeuOf(q)];
    s.append(el('h3', null, q.nom));
    const note = el('p', 'note', `${def.nb} éléments · ${q.support === 'grid' ? 'grille' : 'carte'}`);
    s.append(note);
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
    if (q.ciel) skyFields(q, o, s, seg, setOpt, note, def, draw);
    if (canRandom(q)) seg('Sélection', 'random', [[false, `Tous (${def.nb})`], [true, `${CAT.options.hasard} au hasard`]]);
    if (!q.mecanique) {
      seg('Réponse', 'click', [[false, 'Je tape les noms'], [true, q.support === 'grid' ? 'Je touche la case' : 'Je touche la carte']]);
      if (q.support === 'grid' && !o.click) seg('Grille', 'cursor', [[false, 'Libre'], [true, 'Curseur']]);
    }
    if (q.ordre && !o.random) seg('Ordre', 'alpha', [[false, 'Au hasard'], [true, 'Alphabétique']]);

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
    if (q.libre) { go.textContent = 'Commencer'; r.append(go, x); } else r.append(go, st, x);
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
/* ---------- Ciel mobile : liste, carte, lieu, date, soleil ---------- */
let placeForm = false; // formulaire « Ajouter un lieu » ouvert
function skyFields(q, o, s, seg, setOpt, note, def, redraw) {
  seg('Liste', 'liste', q.ciel.map(j => [j, CAT.jeux[j].titre]));
  seg('Carte', 'carte', CARTES);
  if (o.carte === 'cfixe') { placeForm = false; return; }
  const p = placeOf(o);
  // Nombre d'éléments qui se lèvent depuis ce lieu (chargé à part : la géométrie du ciel n'est lue qu'ici et en jeu).
  Promise.all([loadGeo(), loadJeu(jeuOf(q))]).then(([geo, { data }]) => {
    const n = visibleSet(data.items, geo, p.lat).size;
    note.textContent = `${n} sur ${def.nb} se lèvent depuis ${p.nom} · heure solaire du lieu`;
  }).catch(() => {});
  const f = el('div', 'field');
  f.append(el('span', null, 'Lieu'));
  const g = el('div', 'seg');
  for (const pl of store.places) {
    const b = el('button', null, pl.nom);
    b.setAttribute('aria-pressed', String(pl === p));
    b.addEventListener('click', () => setOpt('lieu', pl.nom));
    g.append(b);
  }
  const add = el('button', 'add', '+ Ajouter');
  add.setAttribute('aria-pressed', String(placeForm));
  add.addEventListener('click', () => { placeForm = !placeForm; redraw(); });
  g.append(add);
  f.append(g);
  const info = el('div', 'place-info');
  info.append(el('span', 'num', fmtCoord(p.lat, p.lon)));
  if (store.places.length > 1) {
    const del = el('button', 'btn small ghost', 'Supprimer ce lieu');
    del.addEventListener('click', () => { store.places = store.places.filter(x => x !== p); setOpt('lieu', null); });
    info.append(del);
  }
  f.append(info);
  if (placeForm) f.append(placeEditor(nom => { placeForm = false; setOpt('lieu', nom); }));
  s.append(f);

  const fd = el('div', 'field');
  fd.append(el('span', null, 'Date'));
  const row = el('div', 'seg');
  const d = el('input', 'date'); d.type = 'date'; d.value = o.date || today();
  d.addEventListener('change', () => { if (d.value) setOpt('date', d.value === today() ? null : d.value); });
  const now = el('button', null, 'Aujourd’hui');
  now.setAttribute('aria-pressed', String(!o.date));
  now.addEventListener('click', () => setOpt('date', null));
  row.append(d, now);
  fd.append(row);
  s.append(fd);
  seg('Soleil', 'sun', [[false, 'Sans'], [true, 'Avec']]);
}

// Nouveau lieu : nom, latitude, longitude en degrés décimaux, arrondies au dixième (environ 10 km).
function placeEditor(done) {
  const box = el('div', 'placeform');
  const mk = (ph, mode) => { const i = el('input'); i.placeholder = ph; i.autocomplete = 'off'; if (mode) i.inputMode = mode; return i; };
  const nom = mk('Nom (ex. Faro)'), lat = mk('Latitude (ex. 37,0)', 'decimal'), lon = mk('Longitude (ex. -7,9)', 'decimal');
  const msg = el('div', 'note', 'Degrés décimaux : latitude négative au sud, longitude négative à l’ouest. Arrondi au dixième de degré (environ 10 km).');
  const ok = el('button', 'btn small', 'Enregistrer');
  const num = i => { const v = i.value.trim().replace(',', '.'); return v && /^[-+]?\d+(\.\d+)?$/.test(v) ? Math.round(Number(v) * 10) / 10 : NaN; };
  ok.addEventListener('click', () => {
    const n = nom.value.trim(), a = num(lat), b = num(lon);
    if (!n) return (msg.textContent = 'Donnez un nom au lieu.');
    if (store.places.some(p => p.nom.toLocaleLowerCase('fr') === n.toLocaleLowerCase('fr'))) return (msg.textContent = 'Ce nom existe déjà.');
    if (!(Math.abs(a) <= 90)) return (msg.textContent = 'Latitude : un nombre entre -90 et 90.');
    if (!(Math.abs(b) <= 180)) return (msg.textContent = 'Longitude : un nombre entre -180 et 180.');
    store.places.push({ nom: n, lat: a, lon: b });
    save();
    done(n);
  });
  box.append(nom, lat, lon, ok, msg);
  return box;
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
