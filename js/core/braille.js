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

// Petite vibration quand on pique un point (si le téléphone et le navigateur la permettent).
export function buzz(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* indisponible */ }
}
