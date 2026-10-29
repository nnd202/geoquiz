// Nom → toucher : un nom s'affiche, on touche l'élément. Trois erreurs : la réponse est montrée et comptée manquée.
import { next, skip } from './queue.js';

// Le nom est précisé quand un autre élément du quiz porte le même (Saint-Denis, Saint-Pierre…).
const show = g => cur => g.setPrompt(g.label(cur), false, '');

export default {
  label: 'Clic',
  typing: false,
  hasPrompt: true,
  start(g) { next(g, show(g)); },
  judge() { return null; },
  validated(g) { g.queue.shift(); next(g, show(g)); },
  skip(g) { skip(g); next(g, show(g)); },
  tap(g, code) {
    if (!g.inPlay.has(code) || g.found.has(code) || g.missed.has(code)) return;
    const cur = g.cur;
    if (code === cur.code) return g.validate(cur);
    g.errors++;
    g.tries++;
    g.board.mark(code, 'wrong');
    setTimeout(() => g.board.mark(code, 'wrong', false), 450);
    if (g.tries >= 3) {
      g.missed.add(cur.code);
      g.board.mark(cur.code, 'missed');
      g.board.reveal(cur.code, cur.nom);
      g.board.flash(cur.code);
      g.toast(g.def.etiquette === 'code' ? `C'était le ${cur.code}` : 'La bonne réponse est en orange');
      g.queue.shift();
      next(g, show(g));
    }
  },
};
