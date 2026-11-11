// Braille, toucher : une grande case affiche la lettre de la case en surbrillance de la grille.
// En glissant le doigt dessus, chaque point en relief déclenche une micro-vibration ; on tape la lettre.
// Les points peuvent être masqués, pour lire au toucher seulement.
import { el } from '../core/dom.js';
import { judgeName } from '../core/validate.js';
import { nextOpen, moveTo } from './cursor.js';
import { brailleCell, setCell, buzz } from '../core/braille.js';

let hidePts = false;

function show(g) {
  setCell(g.b.dots, g.cur.points);
  g.b.last = null;
}
function go(g, p) { moveTo(g, p); show(g); }

export default {
  label: 'Toucher',
  typing: true,
  hasPrompt: false,
  start(g) {
    g.order = g.all.filter(d => g.inPlay.has(d.code));
    const box = el('div', 'braillebox'); box.id = 'g-key';
    const { cell, dots } = brailleCell('big');
    cell.classList.toggle('blind', hidePts);
    const tog = el('button', 'btn small ghost', hidePts ? 'Montrer les points' : 'Masquer les points');
    tog.type = 'button';
    tog.addEventListener('click', () => {
      hidePts = !hidePts; cell.classList.toggle('blind', hidePts);
      tog.textContent = hidePts ? 'Montrer les points' : 'Masquer les points';
      document.getElementById('answer').focus();
    });
    box.append(cell, tog);
    document.getElementById('game').insertBefore(box, document.getElementById('g-input'));
    g.b = { box, cell, dots, last: null };
    // Doigt qui glisse : vibration en entrant sur un point en relief.
    const feel = e => {
      if (g.over || g.paused) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const n = t?.classList?.contains('bdot') && t.classList.contains('on') ? t.dataset.n : null;
      if (n && n !== g.b.last) { buzz(); t.classList.add('felt'); setTimeout(() => t.classList.remove('felt'), 180); }
      g.b.last = n;
    };
    cell.addEventListener('pointerdown', e => { cell.setPointerCapture?.(e.pointerId); g.b.last = null; feel(e); });
    cell.addEventListener('pointermove', feel);
    cell.addEventListener('pointerup', () => { g.b.last = null; });
    go(g, 0);
  },
  stop(g) { g.b?.box.remove(); },
  judge(g, raw) {
    const r = judgeName(raw.trim(), [g.cur], { all: g.all, found: g.found, notes: false });
    if (r?.item) return { item: r.item, when: 'now' };
    if (raw.trim()) {
      g.errors++;
      document.getElementById('answer').value = '';
      return { note: `Pas ${raw.trim().toUpperCase()}` };
    }
    return null;
  },
  validated(g) {
    const p = nextOpen(g, g.pos);
    if (p === null) { g.board.setCursor(null); return g.finish('all'); }
    go(g, p);
  },
  tap(g, code) {
    const p = g.order.findIndex(d => d.code === code);
    if (p >= 0 && !g.found.has(code)) { go(g, p); document.getElementById('answer').focus(); }
  },
};
