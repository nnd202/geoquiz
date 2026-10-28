// Indice → saisie : un indice s'affiche (numéro ou nom), on tape la réponse.
import { judgeName, judgeCode } from '../core/validate.js';
import { next, skip } from './queue.js';

const show = g => cur => {
  if (g.cfg.ask === 'code') g.setPrompt(cur.code, true, 'nom ?');
  else g.setPrompt(cur.nom, false, 'numéro ?');
};

export default {
  label: 'Indice → saisie',
  typing: true,
  hasPrompt: true,
  start(g) { next(g, show(g)); },
  judge(g, raw) {
    return g.cfg.ask === 'code'
      ? judgeName(raw, [g.cur], g.all, g.found, false)
      : judgeCode(raw, g.cur);
  },
  validated(g) { g.queue.shift(); next(g, show(g)); },
  skip(g) { skip(g); next(g, show(g)); },
  tap() {},
};
