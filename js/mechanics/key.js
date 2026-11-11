// Morse, émettre : la case en surbrillance montre une lettre, on la tape au manipulateur.
// Chaque appui est classé en point ou trait selon sa durée (règle absolue, en unités) ;
// après 3 unités de silence, la lettre est terminée et jugée.
import { el } from '../core/dom.js';
import { nextOpen, moveTo } from './cursor.js';
import { toneOn, toneOff, unitMs, units, fmtU, pretty, morseCfg, DOT_MAX, DASH_MAX, LETTER_GAP } from '../core/morse.js';

const BY_PATTERN = {}; // motif → lettre, pour dire ce qui a été reçu

function ui(g) {
  const box = el('div', 'keyer'); box.id = 'g-key';
  const sig = el('div', 'key-sig num', '');
  const help = el('div', 'key-help num', '');
  help.hidden = !morseCfg().aide;
  const btn = el('button', 'key-btn', 'Appuyer');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Manipulateur morse : appui court pour un point, long pour un trait');
  box.append(sig, help, btn);
  document.getElementById('game').insertBefore(box, document.getElementById('g-input'));
  return { box, sig, help, btn };
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
  if (p === g.cur.morse) return g.validate(g.cur);
  g.errors++;
  const got = BY_PATTERN[p];
  g.toast(`Reçu ${pretty(p)}${got ? ` (${got})` : ''}`);
}

function down(g, e) {
  e?.preventDefault?.();
  const k = g.k;
  if (g.over || g.paused || k.isDown) return;
  clearTimeout(k.gapTimer); cancelAnimationFrame(k.raf);
  k.isDown = true; k.t0 = performance.now();
  k.btn.classList.add('on');
  toneOn();
  const live = () => {
    if (!k.isDown) return;
    const u = units(performance.now() - k.t0);
    if (!k.help.hidden) k.help.textContent = `Appui ${fmtU(u)} · ${u < DOT_MAX ? 'point' : u <= DASH_MAX ? 'trait' : 'trop long'}`;
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
  if (u > DASH_MAX) {
    if (!k.help.hidden) k.help.textContent = `Appui ${fmtU(u)} · trop long, lettre effacée`;
    g.toast(`Appui trop long (${fmtU(u)}) : lettre effacée`);
    return reset(g);
  }
  k.pattern += u < DOT_MAX ? '.' : '-';
  k.sig.textContent = pretty(k.pattern);
  k.t1 = performance.now();
  const gapLive = () => {
    if (k.isDown || !k.pattern) return;
    if (!k.help.hidden) k.help.textContent = `Appui ${fmtU(u)} · ${u < DOT_MAX ? 'point' : 'trait'} — silence ${fmtU(units(performance.now() - k.t1))}`;
    k.raf = requestAnimationFrame(gapLive);
  };
  gapLive();
  k.gapTimer = setTimeout(() => { cancelAnimationFrame(k.raf); judgeLetter(g); }, LETTER_GAP * unitMs());
}

export default {
  label: 'Manipulateur',
  typing: false,
  hasPrompt: false,
  keyer: true,
  start(g) {
    for (const d of g.all) BY_PATTERN[d.morse] = d.nom;
    g.order = g.all.filter(d => g.inPlay.has(d.code));
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
    moveTo(g, 0);
  },
  stop(g) {
    if (!g.k) return;
    clearTimeout(g.k.gapTimer); cancelAnimationFrame(g.k.raf); toneOff();
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
    if (p >= 0 && !g.found.has(code)) { reset(g); moveTo(g, p); }
  },
};
