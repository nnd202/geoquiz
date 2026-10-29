// Tout trouver : saisie libre, chaque bonne réponse colore son élément.
import { judgeName } from '../core/validate.js';

export default {
  label: 'Saisie',
  typing: true,
  hasPrompt: false,
  start() {},
  judge(g, raw) {
    return judgeName(raw, g.items.filter(d => !g.found.has(d.code)), { all: g.all, found: g.found, last: g.last });
  },
  validated(g) {
    if (g.found.size === g.items.length) g.finish('all');
  },
  tap() {},
};
