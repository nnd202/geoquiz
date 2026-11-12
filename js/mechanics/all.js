// Tout trouver : saisie libre, chaque bonne réponse colore son élément.
import { judgeName, judgeExact } from '../core/validate.js';

export default {
  label: 'Saisie',
  typing: true,
  hasPrompt: false,
  start() {},
  judge(g, raw) {
    if (g.def.exact) { const r = judgeExact(raw, g.items.filter(d => !g.found.has(d.code))); return r?.item ? r : null; }
    return judgeName(raw, g.items.filter(d => !g.found.has(d.code)), { all: g.all, found: g.found, last: g.last });
  },
  validated(g) {
    if (g.found.size === g.items.length) g.finish('all');
  },
  tap() {},
};
