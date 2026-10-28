// Indice → saisie : un indice s'affiche (numéro, nom, département, ou élément surligné), on tape la réponse.
import { judgeName, judgeCode, judgeText } from '../core/validate.js';
import { next, skip } from './queue.js';

const CODE_LIKE = new Set(['code', 'dep']);

const show = g => cur => {
  const { ask, answer } = g.cfg;
  const hint = answer === 'nom' ? 'nom ?' : CODE_LIKE.has(answer) ? 'numéro ?' : `${answer} ?`;
  if (ask === 'zone') {
    g.board.ask(cur.code);
    g.setPrompt(g.def.question || 'Quel est cet élément ?', false, '');
  } else {
    g.setPrompt(cur[ask], CODE_LIKE.has(ask), hint);
  }
};

export default {
  label: 'Indice → saisie',
  typing: true,
  hasPrompt: true,
  start(g) { next(g, show(g)); },
  judge(g, raw) {
    const { answer } = g.cfg;
    if (answer === 'nom') return judgeName(raw, [g.cur], { all: g.all, found: g.found, notes: false });
    if (CODE_LIKE.has(answer)) return judgeCode(raw, g.cur, answer);
    return judgeText(raw, g.cur, answer);
  },
  validated(g) { g.board.ask(null); g.queue.shift(); next(g, show(g)); },
  skip(g) { skip(g); next(g, show(g)); },
  tap() {},
};
