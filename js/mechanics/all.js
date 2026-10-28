// Tout trouver : saisie libre, chaque bonne réponse colore son élément.
import { judgeName } from '../core/validate.js';

export default {
  label: 'Tout trouver',
  typing: true,
  hasPrompt: false,
  start() {},
  judge(g, raw) {
    return judgeName(raw, g.items.filter(d => !g.found.has(d.code)), g.all, g.found);
  },
  validated(g) {
    if (g.found.size === g.items.length) g.finish('all');
  },
  tap() {},
};
