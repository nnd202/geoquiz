// Morse, émettre : la case en surbrillance montre une lettre, on la tape au manipulateur.
// Chaque appui est classé en point ou trait selon sa durée (règle absolue, en unités) ;
// après 3 unités de silence, la lettre est terminée et jugée.
import { el } from '../core/dom.js';
import { nextOpen, moveTo } from './cursor.js';
import { warmAudio, toneOn, toneOff, unitMs, units, fmtU, pretty, morseCfg, DOT_MAX, DASH_MAX, LETTER_GAP } from '../core/morse.js';

const WORD_GAP = 7; // silence qui termine un mot (transmission libre)

const BY_PATTERN = {}; // motif → lettre, pour dire ce qui a été reçu

function ui(g) {
  const box = el('div', 'keyer'); box.id = 'g-key';
  const sig = el('div', 'key-sig num', '');
  // Aide au rythme : une jauge en miroir, sans chiffres. Au centre, zéro ; à droite l'appui, à gauche le
  // silence, chacun gradué à 1 et 3 unités, puis une zone de débordement (de 3 à 5 unités) en rouge.
  // Pendant l'appui, la droite se remplit ; au relâchement elle retombe d'un coup et la gauche se remplit.
  const help = el('div', 'key-help');
  const track = el('div', 'gauge');
  for (const cls of ['g-over l', 'g-over r', 'tick l1', 'tick l3', 'tick r1', 'tick r3', 'tick c']) track.append(el('i', cls));
  const press = el('b', 'g-fill r'), gap = el('b', 'g-fill l');
  track.append(press, gap);
  const legend = el('div', 'gauge-k');
  legend.append(el('span', null, 'Silence'), el('span', null, 'Appui'));
  help.append(track, legend);
  // Transmission libre : une seconde jauge, au-dessus, pour le silence entre lettres et mots :
  // de 0 à 8 unités, repère à 3 (fin de lettre) et à 7 (fin de mot : espace).
  let word = null;
  if (g.free) {
    const wt = el('div', 'wgauge');
    word = el('b', 'w-fill');
    wt.append(el('i', 'w-tick t3'), el('i', 'w-tick t7'), word);
    const wk = el('div', 'wgauge-k');
    wk.append(el('span', 'k3', 'lettre'), el('span', 'k7', 'espace'));
    help.prepend(wt, wk);
  }
  help.hidden = !morseCfg().aide;
  const btn = el('button', 'key-btn', 'Appuyer');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Manipulateur morse : appui court pour un point, long pour un trait');
  box.append(sig, help, btn);
  document.getElementById('game').insertBefore(box, document.getElementById('g-input'));
  return { box, sig, help, btn, press, gap, word };
}

// Jauge : 1 unité = 10 % de la largeur ; chaque côté va jusqu'à 5 unités.
const W = u => `${Math.min(u, 5) * 10}%`;
function showPress(k, u) {
  k.gap.style.width = '0%';
  k.press.style.width = W(u);
  k.press.dataset.s = u < DOT_MAX ? 'dot' : u <= DASH_MAX ? 'dash' : 'over';
}
function showGap(k, u) {
  k.press.style.width = '0%';
  k.gap.style.width = W(u);
  k.gap.dataset.s = u < LETTER_GAP ? 'ok' : 'end';
}

function reset(g) {
  g.k.pattern = '';
  g.k.sig.textContent = '';
}

function judgeLetter(g) {
  const k = g.k;
  const p = k.pattern;
  reset(g);
  if (!p || g.over || g.paused) return;
  if (g.free) {
    // Transmission libre : le signe reçu s'écrit (ou un carré s'il est inconnu) ; après 7 unités de silence, une espace.
    g.free.write(BY_PATTERN[p] || '□'); // signe inconnu : un carré, le « ? » étant lui-même un signe
    k.wordTimer = setTimeout(() => g.free.space(), (WORD_GAP - LETTER_GAP) * unitMs());
    return;
  }
  if (g.practice) {
    // Entraînement : juste → petite onde verte et case suivante (en boucle), sans rien compter.
    if (p === g.cur.morse) {
      g.board.pulse(g.cur.code);
      g.toast(`${g.cur.nom} ✓`);
      return moveTo(g, (g.pos + 1) % g.order.length);
    }
    const got = BY_PATTERN[p];
    return g.toast(`Reçu ${pretty(p)}${got ? ` (${got})` : ''}`);
  }
  if (p === g.cur.morse) return g.validate(g.cur);
  g.errors++;
  const got = BY_PATTERN[p];
  g.toast(`Reçu ${pretty(p)}${got ? ` (${got})` : ''}`);
}

function down(g, e) {
  e?.preventDefault?.();
  const k = g.k;
  if (g.over || g.paused || k.isDown) return;
  clearTimeout(k.gapTimer); clearTimeout(k.wordTimer); cancelAnimationFrame(k.raf);
  k.isDown = true; k.t0 = performance.now();
  cancelAnimationFrame(k.wraf);
  if (k.word) { k.word.style.width = '0%'; k.word.dataset.s = ''; }
  k.btn.classList.add('on');
  toneOn();
  const live = () => {
    if (!k.isDown) return;
    const u = units(performance.now() - k.t0);
    if (!k.help.hidden) showPress(k, u);
    k.btn.classList.toggle('long', u >= DOT_MAX && u <= DASH_MAX);
    k.btn.classList.toggle('over', u > DASH_MAX);
    k.raf = requestAnimationFrame(live);
  };
  live();
}

function up(g) {
  const k = g.k;
  if (!k.isDown) return;
  k.isDown = false;
  toneOff();
  k.btn.classList.remove('on', 'long', 'over');
  const ms = performance.now() - k.t0;
  if (ms < 15) return; // rebond
  const u = units(ms);
  if (!k.help.hidden) showPress(k, u);
  if (u > DASH_MAX) {
    g.toast(`Appui trop long (${fmtU(u)}) : lettre effacée`);
    return reset(g);
  }
  k.pattern += u < DOT_MAX ? '.' : '-';
  k.sig.textContent = pretty(k.pattern);
  k.t1 = performance.now();
  const gapLive = () => {
    if (k.isDown || !k.pattern) return;
    if (!k.help.hidden) showGap(k, units(performance.now() - k.t1));
    k.raf = requestAnimationFrame(gapLive);
  };
  gapLive();
  if (k.word) {
    const wordLive = () => {
      if (k.isDown) return;
      const w = units(performance.now() - k.t1);
      k.word.style.width = `${Math.min(w, 8) / 8 * 100}%`;
      k.word.dataset.s = w >= WORD_GAP ? 'word' : w >= LETTER_GAP ? 'letter' : '';
      if (w < 8) k.wraf = requestAnimationFrame(wordLive);
    };
    cancelAnimationFrame(k.wraf); wordLive();
  }
  k.gapTimer = setTimeout(() => { cancelAnimationFrame(k.raf); judgeLetter(g); }, LETTER_GAP * unitMs());
}

export default {
  label: 'Manipulateur',
  typing: false,
  hasPrompt: false,
  keyer: true,
  practice: true, // aussi actif en mode étude
  start(g) {
    for (const d of g.all) BY_PATTERN[d.morse] = d.nom;
    g.order = g.all.filter(d => g.inPlay.has(d.code));
    warmAudio();
    g.k = { pattern: '', isDown: false, ...ui(g) };
    const b = g.k.btn;
    b.addEventListener('pointerdown', e => { b.setPointerCapture?.(e.pointerId); down(g, e); });
    b.addEventListener('pointerup', () => up(g));
    b.addEventListener('pointercancel', () => up(g));
    b.addEventListener('contextmenu', e => e.preventDefault());
    // Sur ordinateur : la barre d'espace sert de manipulateur.
    g.k.onKey = e => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      if (e.type === 'keydown') down(g); else up(g);
    };
    document.addEventListener('keydown', g.k.onKey);
    document.addEventListener('keyup', g.k.onKey);
    if (!g.free) moveTo(g, 0);
  },
  stop(g) {
    if (!g.k) return;
    clearTimeout(g.k.gapTimer); clearTimeout(g.k.wordTimer); cancelAnimationFrame(g.k.raf); cancelAnimationFrame(g.k.wraf); toneOff();
    document.removeEventListener('keydown', g.k.onKey);
    document.removeEventListener('keyup', g.k.onKey);
    g.k.box.remove();
  },
  pause(g) { if (g.k) { up(g); clearTimeout(g.k.gapTimer); reset(g); } },
  judge() { return null; },
  validated(g) {
    const p = nextOpen(g, g.pos);
    if (p === null) { g.board.setCursor(null); return g.finish('all'); }
    moveTo(g, p);
  },
  tap(g, code) {
    const p = g.order.findIndex(d => d.code === code);
    if (p >= 0 && (g.practice || !g.found.has(code))) { reset(g); moveTo(g, p); }
  },
};
