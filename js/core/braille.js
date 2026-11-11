// Case braille dessinée : 6 points (1-2-3 à gauche de haut en bas, 4-5-6 à droite).
import { el } from './dom.js';

export const ORDER = ['1', '4', '2', '5', '3', '6']; // ordre d'affichage ligne par ligne
export const uni = pts => String.fromCharCode(0x2800 + [...pts].reduce((s, n) => s + (1 << (n - 1)), 0));

// Construit une case ; renvoie { cell, dots: {n: élément} }.
export function brailleCell(cls = '') {
  const cell = el('div', `bcell ${cls}`.trim());
  const dots = {};
  for (const n of ORDER) { const d = el('span', 'bdot'); d.dataset.n = n; dots[n] = d; cell.append(d); }
  return { cell, dots };
}

export function setCell(dots, pts) {
  for (const [n, d] of Object.entries(dots)) d.classList.toggle('on', pts.includes(n));
}

import { store, save } from './store.js';

// Retour au passage du doigt sur un point : vibration, petit son, ou les deux (réglage).
export const feedback = () => store.braille?.retour || 'both';
export function setFeedback(v) { store.braille = { ...(store.braille || {}), retour: v }; save(); }

let ctx = null;
function tick() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx ||= new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 1400;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.05);
  } catch { /* son indisponible */ }
}
// Renvoie true si le navigateur a accepté la vibration.
export function vibrate(ms) {
  try { return !!navigator.vibrate?.(ms); } catch { return false; }
}
export function buzz(ms = 14) {
  const m = feedback();
  if (m !== 'sound') vibrate(ms);
  if (m !== 'vibe') tick();
}
export const playTick = tick;
