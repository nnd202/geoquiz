// Morse, écouter : l'app joue la lettre de la case en surbrillance, on tape la lettre entendue.
import { judgeName, judgeExact } from '../core/validate.js';
import { nextOpen, moveTo } from './cursor.js';
import { playPattern } from '../core/morse.js';

let timer = 0;
function listen(g, delay = 350) {
  clearTimeout(timer);
  timer = setTimeout(() => { if (!g.over && !g.paused && g.cur) playPattern(g.cur.morse); }, delay);
}

export default {
  label: 'Écoute',
  typing: true,
  hasPrompt: true,
  skipLabel: 'Réécouter',
  start(g) {
    g.order = g.all.filter(d => g.inPlay.has(d.code));
    moveTo(g, 0);
    g.setPrompt('♪', false, 'Tapez la lettre ou le chiffre entendu');
    listen(g, 500);
  },
  stop() { clearTimeout(timer); },
  judge(g, raw) {
    const r = g.def.exact ? judgeExact(raw, [g.cur]) : judgeName(raw.trim(), [g.cur], { all: g.all, found: g.found, notes: false });
    if (r?.item) return { item: r.item, when: 'now' };
    // Un seul caractère attendu : une autre réponse est une erreur, effacée pour réessayer.
    if (raw.trim()) {
      g.errors++;
      document.getElementById('answer').value = '';
      return { note: `Pas ${raw.trim().toUpperCase()}, réécoutez` };
    }
    return null;
  },
  validated(g) {
    const p = nextOpen(g, g.pos);
    if (p === null) { g.board.setCursor(null); return g.finish('all'); }
    moveTo(g, p);
    listen(g, 600);
  },
  skip(g) { listen(g, 0); },
  tap(g, code) {
    const p = g.order.findIndex(d => d.code === code);
    if (p >= 0 && !g.found.has(code)) { moveTo(g, p); listen(g, 150); document.getElementById('answer').focus(); }
  },
};
