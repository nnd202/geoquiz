// Grille en curseur : une seule case attend la réponse. Juste → case suivante non trouvée ;
// toucher une autre case y déplace le curseur ; au bout de la grille, retour aux cases restantes.
import { judgeName } from '../core/validate.js';

// Prochaine case à faire après la position pos (en bouclant), ou null s'il n'en reste aucune.
function nextOpen(g, pos) {
  const n = g.order.length;
  for (let k = 1; k <= n; k++) {
    const it = g.order[(pos + k) % n];
    if (!g.found.has(it.code)) return (pos + k) % n;
  }
  return null;
}

function moveTo(g, pos) {
  g.pos = pos;
  g.cur = g.order[pos];
  g.board.setCursor(g.cur.code);
}

export default {
  label: 'Curseur',
  typing: true,
  hasPrompt: false,
  start(g) {
    g.order = g.all.filter(d => g.inPlay.has(d.code)); // ordre de la grille
    moveTo(g, 0);
  },
  judge(g, raw) {
    return judgeName(raw, [g.cur], { all: g.all, found: g.found, notes: false });
  },
  validated(g) {
    const p = nextOpen(g, g.pos);
    if (p === null) { g.board.setCursor(null); return g.finish('all'); }
    moveTo(g, p);
  },
  tap(g, code) {
    const p = g.order.findIndex(d => d.code === code);
    if (p >= 0 && !g.found.has(code)) { moveTo(g, p); $answer()?.focus(); }
  },
};

const $answer = () => document.getElementById('answer');
