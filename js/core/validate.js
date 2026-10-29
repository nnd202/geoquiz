// Validation instantanée sans bouton « OK », qui ne valide jamais une réponse non visée.
import { keysOf, toks, dist, allowedTypos } from './text.js';

// Ordre fixe quand rien d'autre ne départage deux homonymes : zones, puis villes, puis éléments physiques.
const DOMAIN_ORDER = { zone: 0, ville: 1, physique: 2 };

const sq = v => v * v;
function km(a, b) { // distance approximative entre deux [lon, lat]
  const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  return Math.sqrt(sq((a[0] - b[0]) * k) + sq(a[1] - b[1]));
}

/**
 * Homonymes : une saisie valide un seul élément.
 * 1. le domaine de la réponse précédente ; 2. le plus proche d'elle ; 3. ordre fixe des domaines.
 */
export function pickHomonym(list, last) {
  if (list.length === 1) return list[0];
  let pool = list;
  if (last) {
    const same = list.filter(d => d.domaine === last.domaine);
    if (same.length) pool = same;
    if (last.geo && pool.every(d => d.geo)) return pool.slice().sort((a, b) => km(a.geo, last.geo) - km(b.geo, last.geo))[0];
  }
  return pool.slice().sort((a, b) => (DOMAIN_ORDER[a.domaine] ?? 9) - (DOMAIN_ORDER[b.domaine] ?? 9))[0];
}

/**
 * Juge une saisie de nom.
 * @param raw        texte du champ (comparé en entier, jamais un morceau)
 * @param candidates réponses encore attendues
 * @param ctx        { all, found, last, notes }
 * @returns null, {note}, ou {item, when: 'now' | 'wait'}
 */
export function judgeName(raw, candidates, { all, found, last = null, notes = true }) {
  const k = keysOf(raw);
  const ins = [...new Set([k.full, k.lite])].filter(Boolean);
  if (!ins.length) return null;
  const hit = d => d.keys.some(x => ins.includes(x));

  // 1. Correspondance exacte ; attente si c'est aussi le début d'une autre réponse (Loire / Loiret).
  const exact = candidates.filter(hit);
  if (exact.length) {
    const item = pickHomonym(exact, last);
    const longer = candidates.some(d => !exact.includes(d) &&
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
  // Le mot générique (mer, golfe, détroit…) doit être tapé juste : la faute n'est tolérée que sur le nom.
  const near = candidates.filter(d => d.keys.some(x => ins.some(i => (!d.gen || i.startsWith(d.gen)) && dist(i, x, max) <= max)));
  return near.length === 1 ? { item: near[0], when: 'wait' } : null;
}

// Saisie d'un code (numéro de département…) : « 1 » = « 01 », « 2a » = « 2A ».
export function normCode(s) {
  let v = String(s).trim().toLowerCase().replace(/\s/g, '');
  if (/^\d$/.test(v)) v = '0' + v;
  return v;
}
export function judgeCode(raw, item, field = 'code') {
  return normCode(raw) === normCode(item[field]) ? { item, when: 'now' } : null;
}

// Saisie d'un texte rattaché à l'élément (ex. : l'État d'une capitale), mêmes tolérances que les noms.
export function judgeText(raw, item, field) {
  const want = keysOf(item[field]);
  const k = keysOf(raw);
  const ins = [k.full, k.lite];
  const keys = [want.full, want.lite];
  if (ins.some(i => i && keys.includes(i))) return { item, when: 'now' };
  if (keys.some(x => ins.some(i => i && x.startsWith(i)))) return null;
  const max = allowedTypos(k.lite.length);
  return max && keys.some(x => dist(k.lite, x, max) <= max) ? { item, when: 'wait' } : null;
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

export { toks };
