// Braille, écrire : la case en surbrillance montre une lettre ; on pique ses points sur une grande case
// (toucher un point l'active ou le retire), puis « Valider ».
import { el } from '../core/dom.js';
import { nextOpen, moveTo } from './cursor.js';
import { brailleCell, setCell, buzz, uni } from '../core/braille.js';

const BY = {};
const val = g => [...g.w.sel].sort().join('');
function clear(g) { g.w.sel.clear(); setCell(g.w.dots, ''); }

export default {
  label: 'Écrire',
  typing: false,
  hasPrompt: false,
  start(g) {
    for (const d of g.all) BY[d.points] = d.nom;
    g.order = g.all.filter(d => g.inPlay.has(d.code));
    const box = el('div', 'braillebox'); box.id = 'g-key';
    const { cell, dots } = brailleCell('big write');
    const row = el('div', 'row');
    const del = el('button', 'btn small ghost', 'Effacer'), ok = el('button', 'btn small', 'Valider');
    del.type = ok.type = 'button';
    row.append(del, ok);
    box.append(cell, row);
    document.getElementById('game').insertBefore(box, document.getElementById('g-input'));
    g.w = { box, dots, sel: new Set() };
    for (const [n, d] of Object.entries(dots)) {
      d.addEventListener('click', () => {
        if (g.over || g.paused) return;
        if (g.w.sel.has(n)) g.w.sel.delete(n); else g.w.sel.add(n);
        d.classList.toggle('on', g.w.sel.has(n)); buzz(8);
      });
    }
    del.addEventListener('click', () => clear(g));
    ok.addEventListener('click', () => {
      if (g.over || g.paused || !g.w.sel.size) return;
      const p = val(g);
      if (p === g.cur.points) return g.validate(g.cur);
      g.errors++;
      g.toast(`Reçu ${uni(p)}${BY[p] ? ` (${BY[p]})` : ''}`);
      clear(g);
    });
    moveTo(g, 0);
  },
  stop(g) { g.w?.box.remove(); },
  pause(g) { if (g.w) clear(g); },
  judge() { return null; },
  validated(g) {
    clear(g);
    const p = nextOpen(g, g.pos);
    if (p === null) { g.board.setCursor(null); return g.finish('all'); }
    moveTo(g, p);
  },
  tap(g, code) {
    const p = g.order.findIndex(d => d.code === code);
    if (p >= 0 && !g.found.has(code)) { clear(g); moveTo(g, p); }
  },
};
