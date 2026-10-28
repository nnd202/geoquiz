// Validation instantanée sans bouton « OK », qui ne valide jamais une réponse non visée.
import { keysOf, dist, allowedTypos } from './text.js';

/**
 * Juge une saisie de nom.
 * @param raw        texte du champ (comparé en entier, jamais un morceau)
 * @param candidates réponses encore attendues
 * @param all        toutes les réponses du jeu de données
 * @param found      Set des codes déjà trouvés
 * @param notes      afficher « Déjà trouvé » ou non
 * @returns null, {note}, ou {item, when: 'now' | 'wait'}
 */
export function judgeName(raw, candidates, all, found, notes = true) {
  const k = keysOf(raw);
  const ins = [...new Set([k.full, k.lite])].filter(Boolean);
  if (!ins.length) return null;
  const hit = d => d.keys.some(x => ins.includes(x));

  // 1. Correspondance exacte ; attente si c'est aussi le début d'une autre réponse (Loire / Loiret).
  const exact = candidates.filter(hit);
  if (exact.length) {
    const item = exact[0];
    const longer = candidates.some(d => d !== item &&
      d.keys.some(x => ins.some(i => x.length > i.length && x.startsWith(i))));
    return { item, when: longer ? 'wait' : 'now' };
  }

  // 2. Encore en train de taper une réponse plus longue : ni message ni tolérance.
  if (candidates.some(d => d.keys.some(x => ins.some(i => x.startsWith(i))))) return null;

  // 3. Exactement une autre réponse : jamais de faute tolérée.
  const other = all.find(hit);
  if (other) return { note: notes && found.has(other.code) ? `Déjà trouvé : ${other.nom}` : null };

  // 4. Fautes de frappe : une seule réponse proche, validée après une pause de frappe.
  const max = allowedTypos(k.lite.length);
  if (!max) return null;
  const near = candidates.filter(d => d.keys.some(x => ins.some(i => dist(i, x, max) <= max)));
  return near.length === 1 ? { item: near[0], when: 'wait' } : null;
}

// Saisie d'un code (numéro de département) : « 1 » = « 01 », « 2a » = « 2A ».
export function judgeCode(raw, item) {
  let s = String(raw).trim().toLowerCase().replace(/\s/g, '');
  if (/^\d$/.test(s)) s = '0' + s;
  return s === item.code.toLowerCase() ? { item, when: 'now' } : null;
}

// Script de vérification : réponses qui commencent comme une autre (validation différée).
export function ambiguousPrefixes(items) {
  const out = [];
  for (const a of items) for (const b of items) {
    if (a !== b && b.keys.some(x => a.keys.some(y => x.length > y.length && x.startsWith(y)))) out.push([a, b]);
  }
  return out;
}

// Script de vérification : homonymes (même clé, éléments différents).
export function homonyms(items) {
  const by = new Map();
  for (const it of items) for (const k of it.keys) {
    if (!by.has(k)) by.set(k, new Set());
    by.get(k).add(it);
  }
  return [...by.entries()].filter(([, s]) => s.size > 1).map(([k, s]) => [k, [...s]]);
}
