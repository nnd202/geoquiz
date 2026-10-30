// Noyau d'une partie : plateau, chrono, pause, saisie différée, fin, bilan, mode étude.
import { $, el, fmt, shuffle } from './dom.js';
import { buildGrid, buildMap } from './boards.js';
import { store, addAttempt, attemptsOf, bestOf } from './store.js';
import { writeToFolder } from './backup.js';
import { keysOf } from './text.js';
import { MECHANICS } from '../mechanics/index.js';

export const END = { time: 'Chrono écoulé', all: 'Tout trouvé', list: 'Liste terminée', stop: 'Terminer' };
export const fmtLong = ms => { const s = Math.round(ms / 1000); return s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}` : fmt(ms); };
const WAIT_MS = 700; // pause de frappe avant de valider un préfixe ambigu ou une faute
const CONFIRM_FROM = 10; // éléments trouvés au-delà desquels Annuler demande confirmation

let current = null;
let onLeave = () => {};
export function onHome(f) { onLeave = f; }

export class Game {
  constructor({ cfg, name, id, def, data, mapSvg, study }) {
    this.cfg = cfg; this.name = name; this.id = id; this.study = study; this.def = def;
    this.last = null; // réponse précédente (départage des homonymes)
    this.all = data.items;
    // En mode étude, tout est montré, même pour un quiz « N au hasard ».
    this.items = cfg.n && !study ? shuffle(this.all.slice()).slice(0, cfg.n) : this.all.slice();
    this.inPlay = new Set(this.items.map(d => d.code));
    this.found = new Set(); this.missed = new Set();
    this.queue = shuffle(this.items.slice());
    this.tries = 0; this.errors = 0;
    this.acc = 0; this.resumeAt = null; this.paused = false; this.over = false;
    this.pausesLeft = store.pauses; this.pausesUsed = 0;
    this.at = new Date().toISOString();
    this.mech = MECHANICS[cfg.mech];
    this.mapSvg = mapSvg;
    this.waitTimer = null;
    // Mode clic : un nom partagé par plusieurs éléments est précisé (« Saint-Denis (La Réunion) »).
    const seen = new Map();
    for (const d of this.all) { const k = keysOf(d.nom).full; seen.set(k, (seen.get(k) || 0) + 1); }
    this.dupNames = new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }

  // Nom affiché en mode clic, précisé si un autre élément porte le même nom.
  label(item) {
    if (!this.dupNames.has(keysOf(item.nom).full)) return item.nom;
    const ctx = item.depNom || item.etat || item.pays || item.categorie;
    return ctx ? `${item.nom} (${ctx})` : item.nom;
  }

  start() {
    current?.dispose();
    current = this;
    const { cfg, study, mech } = this;
    $('home').hidden = true; $('game').hidden = false;
    $('g-title').textContent = study ? `${this.name} · étude` : this.name;
    this.buildBoard();
    const typing = !study && mech.typing;
    const inp = $('answer');
    $('g-input').hidden = study;
    inp.hidden = !typing; inp.value = ''; inp.disabled = false; inp.classList.remove('pending');
    inp.inputMode = cfg.mech === 'clue' && cfg.ask === 'nom' ? 'text' : 'text';
    $('g-cancel').setAttribute('aria-label', study ? "Fermer l'étude" : 'Annuler la partie');
    this.revealOn = false; this.revealUsed = false;
    $('g-reveal').hidden = study || !this.def.reveler;
    $('g-reveal').setAttribute('aria-pressed', 'false');
    $('g-clock').hidden = study; $('g-score').hidden = study;
    $('g-pause').hidden = study; $('g-stop').hidden = study;
    this.updatePauseBtn();
    $('g-prompt').hidden = study || !mech.hasPrompt;
    $('g-prompt').style.visibility = '';
    $('g-skip').hidden = !mech.skip;
    fitViewport();
    $('board').classList.toggle('study', !!study);
    if (study) {
      this.board.showLabels(this.items, this.def.etiquette);
      if (this.def.legende && cfg.support !== 'grid') {
        const lg = el('div', 'legend');
        for (const [k, t] of this.def.legende) { const s = el('span'); s.append(el('i', `st-${k}`), t); lg.append(s); }
        $('board').append(lg);
      }
      return;
    }
    this.resumeAt = performance.now();
    mech.start(this);
    this.tick();
    if (typing) setTimeout(() => inp.focus(), 50);
  }

  dispose() { this.over = true; clearTimeout(this.waitTimer); }

  buildBoard() {
    const host = $('board');
    host.textContent = '';
    const tap = code => this.onTap(code);
    this.board = this.cfg.support === 'grid'
      ? buildGrid(host, this.all, this.inPlay, tap, { images: !!this.def.images })
      : buildMap(host, this.mapSvg, {
        codes: new Set(this.all.map(d => d.code)), inPlay: this.inPlay, layers: this.def.calques || [],
        onTap: tap, label: this.def.titre, style: this.def.style,
        tapNeedsSingle: () => this.cfg.mech === 'tap' && !this.over && !this.study,
      });
    this.toastEl = el('div', 'toast');
    host.append(this.toastEl);
  }

  /* --- Chrono --- */
  elapsed() { return this.acc + (this.resumeAt != null ? performance.now() - this.resumeAt : 0); }
  tick() {
    if (current !== this || this.over || this.study || this.paused) return;
    // Pas de limite : on mesure le temps mis.
    $('g-clock').textContent = fmtLong(this.elapsed());
    $('g-score').textContent = `${this.found.size}/${this.items.length}`;
    setTimeout(() => this.tick(), 200);
  }

  /* --- Affichage --- */
  setPrompt(text, isCode, hint) {
    const q = $('g-q');
    q.textContent = text;
    q.classList.toggle('num', isCode);
    $('g-hint').textContent = hint || '';
  }
  toast(msg) {
    if (!msg) return;
    const t = this.toastEl;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1400);
  }

  /* --- Réponses --- */
  onInput() {
    if (this.over || this.paused || this.study) return;
    clearTimeout(this.waitTimer);
    const inp = $('answer');
    inp.classList.remove('pending');
    const raw = inp.value;
    if (!raw.trim()) return;
    const r = this.mech.judge(this, raw);
    if (!r) return;
    if (r.note !== undefined) return this.toast(r.note);
    if (r.when === 'now') return this.validate(r.item);
    inp.classList.add('pending');
    this.waitTimer = setTimeout(() => {
      if (inp.value === raw && !this.paused && !this.over) this.validate(r.item);
    }, WAIT_MS);
  }

  validate(item) {
    this.found.add(item.code);
    this.last = item;
    this.board.mark(item.code, 'todo', false);
    this.board.mark(item.code, 'found');
    this.board.relate(item.code, 'rel');
    this.board.flash(item.code);
    this.board.reveal(item.code, item.nom);
    const inp = $('answer');
    inp.value = ''; inp.classList.remove('pending');
    $('g-score').textContent = `${this.found.size}/${this.items.length}`;
    this.mech.validated(this, item);
  }

  onTap(code) {
    if (this.paused) return;
    if (this.study || this.over) return this.showInfo(code);
    // Pendant la partie, toucher un élément déjà trouvé rappelle discrètement son nom.
    if (this.found.has(code)) {
      const it = this.all.find(d => d.code === code);
      return it && this.toast(this.label(it));
    }
    this.mech.tap(this, code);
  }

  toggleReveal() {
    if (this.over || this.study || this.paused) return;
    this.revealOn = !this.revealOn;
    this.revealUsed ||= this.revealOn;
    this.board.setReveal(this.revealOn);
    $('g-reveal').setAttribute('aria-pressed', String(this.revealOn));
  }

  skip() {
    if (this.over || this.paused || !this.mech.skip) return;
    $('answer').value = '';
    this.mech.skip(this);
    if (this.mech.typing) $('answer').focus();
  }

  /* --- Pause : chrono arrêté, plateau masqué, saisie bloquée --- */
  updatePauseBtn() {
    const b = $('g-pause');
    b.textContent = `Pause · ${this.pausesLeft}`;
    b.disabled = !this.pausesLeft || this.paused;
  }
  /* --- Annuler : quitter sans rien enregistrer ---
   * Sans question tant que moins de 10 éléments sont trouvés ; au-delà, une confirmation dans la page. */
  cancel() {
    if (this.over || this.study) return goHome();
    if ($('confirm')) return this.closeConfirm();
    if (this.found.size < CONFIRM_FROM) return goHome();
    this.wasPaused = this.paused;
    if (!this.paused) { this.paused = true; this.acc = this.elapsed(); this.resumeAt = null; }
    clearTimeout(this.waitTimer);
    $('answer').blur();
    const box = el('div', 'confirm'); box.id = 'confirm';
    const card = el('div', 'confirm-card');
    card.append(el('h3', null, 'Annuler la partie ?'), el('p', null, `${this.found.size} trouvés. Rien ne sera enregistré.`));
    const r = el('div', 'row');
    const yes = el('button', 'btn', 'Annuler la partie'); yes.addEventListener('click', () => goHome());
    const no = el('button', 'btn ghost', 'Continuer'); no.addEventListener('click', () => this.closeConfirm());
    r.append(yes, no); card.append(r); box.append(card);
    $('board').append(box);
    no.focus();
    return true;
  }
  closeConfirm() {
    $('confirm')?.remove();
    if (this.over || this.wasPaused) return;
    this.paused = false; this.resumeAt = performance.now();
    this.tick();
    if (this.mech.typing) $('answer').focus();
  }

  pause() {
    if (this.over || this.paused || !this.pausesLeft || this.study) return;
    this.paused = true; this.pausesLeft--; this.pausesUsed++;
    this.acc = this.elapsed(); this.resumeAt = null;
    clearTimeout(this.waitTimer);
    const inp = $('answer');
    inp.disabled = true; inp.blur();
    $('g-prompt').style.visibility = 'hidden';
    const p = el('div', 'pause'); p.id = 'pause';
    p.append(el('h3', null, 'En pause'),
      el('p', null, this.pausesLeft
        ? `Encore ${this.pausesLeft} pause${this.pausesLeft > 1 ? 's' : ''} pour cette partie.`
        : "C'était la dernière pause de cette partie."));
    const b = el('button', 'btn', 'Reprendre');
    b.addEventListener('click', () => this.resume());
    p.append(b);
    $('board').append(p);
    this.updatePauseBtn();
  }
  resume() {
    this.paused = false; this.resumeAt = performance.now();
    $('pause')?.remove();
    $('answer').disabled = false;
    $('g-prompt').style.visibility = '';
    this.updatePauseBtn();
    this.tick();
    if (this.mech.typing) $('answer').focus();
  }

  /* --- Fin --- */
  finish(reason) {
    if (this.over) return;
    this.over = true;
    clearTimeout(this.waitTimer);
    this.board.setReveal(false);
    $('g-reveal').hidden = true;
    const ms = this.elapsed();
    for (const d of this.items) {
      if (!this.found.has(d.code)) { this.missed.add(d.code); this.board.mark(d.code, 'todo', false); this.board.mark(d.code, 'missed'); this.board.reveal(d.code, d.nom); }
    }
    const att = {
      quiz: this.id, label: this.name, at: this.at, ms: Math.round(ms),
      found: this.found.size, total: this.items.length, end: reason,
      pauses: this.pausesUsed, missed: [...this.missed], errors: this.errors,
      ...(this.revealUsed ? { revealed: true } : {}),
    };
    addAttempt(att);
    writeToFolder().catch(() => {}); // sauvegarde automatique sur PC si un dossier est choisi
    $('answer').blur();
    $('g-input').hidden = true; $('g-prompt').hidden = true;
    $('g-clock').textContent = fmtLong(ms);
    $('g-cancel').setAttribute('aria-label', 'Retour à l’accueil');
    this.results(att);
  }

  results(att) {
    const byCode = Object.fromEntries(this.all.map(d => [d.code, d]));
    const order = new Map(this.all.map((d, i) => [d.code, i]));
    const s = el('section', 'sheet'); s.id = 'sheet';
    const grab = el('button', 'grab');
    grab.setAttribute('aria-label', 'Réduire ou agrandir le bilan');
    grab.addEventListener('click', () => s.classList.toggle('min'));
    s.append(grab);

    const big = el('div', 'big');
    [[`${att.found}/${att.total}`, 'Score'], [fmtLong(att.ms), 'Durée'], [END[att.end], 'Fin'], [String(att.pauses), 'Pauses']]
      .forEach(([v, k]) => { const d = el('div'); d.append(el('b', null, v), el('span', null, k)); big.append(d); });
    big.children[2].querySelector('b').style.fontSize = '17px';
    s.append(big);

    if (att.missed.length) {
      s.append(el('h2', null, `Manqués · ${att.missed.length}`));
      const ml = el('div', 'missed-list');
      att.missed.slice().sort((a, b) => order.get(a) - order.get(b)).forEach(c => {
        const sp = el('span');
        if (this.def.etiquette === 'code') sp.append(el('b', null, c));
        sp.append(document.createTextNode(this.label(byCode[c])));
        ml.append(sp);
      });
      s.append(ml);
    }

    const hist = attemptsOf(att.quiz).slice().reverse();
    const best = bestOf(att.quiz);
    const record = best?.fastest === att.ms && att.found === att.total && hist.length > 1;
    if (record) s.append(el('div', 'record', 'Nouveau record de temps'));
    s.append(el('h2', null, `Historique de cette variante · ${hist.length}`));
    if (best) s.append(el('div', 'note', `Meilleur score ${best.best.found}/${best.best.total}${best.fastest ? ` · meilleur temps ${fmtLong(best.fastest)}` : ''}`));
    const tw = el('div', 'tablewrap'), t = el('table', 'hist');
    t.innerHTML = '<thead><tr><th>Date</th><th>Heure</th><th>Score</th><th>Durée</th><th>Fin</th><th>Pauses</th></tr></thead>';
    const tb = el('tbody');
    hist.slice(0, 50).forEach(h => {
      const d = new Date(h.at), tr = el('tr', h === att ? 'now' : null);
      [d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        `${h.found}/${h.total}`, fmtLong(h.ms), END[h.end] || h.end, h.pauses ?? 0]
        .forEach(v => tr.append(el('td', null, String(v))));
      tb.append(tr);
    });
    t.append(tb); tw.append(t); s.append(tw);

    const r = el('div', 'row');
    const again = el('button', 'btn', 'Rejouer');
    again.addEventListener('click', () => this.replay());
    const back = el('button', 'btn ghost', 'Accueil');
    back.addEventListener('click', goHome);
    r.append(again, back);
    s.append(r, el('div', 'note', 'Touchez la carte ou la grille pour revoir un élément.'));
    $('board').append(s);
  }

  replay() {
    new Game({ cfg: this.cfg, name: this.name, id: this.id, def: this.def, data: { items: this.all }, mapSvg: this.mapSvg, study: false }).start();
  }

  /* --- Étude et bilan : toucher un élément affiche son code et son nom --- */
  showInfo(code) {
    const it = this.all.find(d => d.code === code);
    if (!it) return;
    if (it.image) {
      // Drapeau agrandi, avec son nom ; un toucher n'importe où le referme.
      const v = el('div', 'flagview');
      const fig = el('figure');
      const img = el('img'); img.src = it.image; img.alt = `Drapeau : ${it.nom}`;
      const cap = el('figcaption');
      cap.append(el('b', null, it.nom), el('span', null, it.detail || ''));
      fig.append(img, cap); v.append(fig);
      v.addEventListener('click', () => v.remove());
      $('board').append(v);
      return;
    }
    this.board.select(code);
    let ib = $('info');
    if (!ib) { ib = el('div', 'infobar'); ib.id = 'info'; $('board').append(ib); }
    ib.textContent = '';
    if (this.def.etiquette === 'code') ib.append(el('span', 'num', code));
    ib.append(el('b', null, it.nom));
    if (it.detail) ib.append(el('span', 'detail', it.detail));
    if (this.over) $('sheet')?.classList.add('min');
  }
}

// Bouton retour d'Android : même effet que ✕. Renvoie true si l'écran de jeu reste affiché.
export function backRequest() {
  if (!current) return false;
  current.cancel();
  return !!current;
}

export function goHome() {
  current?.dispose();
  current = null;
  $('game').hidden = true; $('home').hidden = false; $('g-input').hidden = false;
  onLeave();
}

// Branchements uniques des contrôles de partie.
export function wireGameControls() {
  $('answer').addEventListener('input', () => current?.onInput());
  $('answer').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  $('g-pause').addEventListener('click', () => current?.pause());
  $('g-stop').addEventListener('click', () => { if (current && !current.over && !current.paused && !current.study) current.finish('stop'); });
  $('g-skip').addEventListener('click', () => current?.skip());
  $('g-cancel').addEventListener('click', () => current?.cancel());
  $('g-reveal').addEventListener('click', () => current?.toggleReveal());
  window.visualViewport?.addEventListener('resize', fitViewport);
  window.visualViewport?.addEventListener('scroll', fitViewport);
}

// Le plein écran suit la zone visible quand le clavier s'ouvre.
function fitViewport() {
  const vv = window.visualViewport, g = $('game');
  if (!vv || !g) return;
  g.style.height = vv.height + 'px';
  g.style.top = vv.offsetTop + 'px';
}
