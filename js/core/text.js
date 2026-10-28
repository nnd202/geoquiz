// Normalisation des saisies et des réponses (règles du document de référence, § Validation).

// Petits mots facultatifs : « bouches du rhône » = « bouchesrhone » = « bouchesdurhone ».
export const STOP = new Set(['du', 'de', 'des', 'le', 'la', 'les', 'l', 'd']);

// Abréviations usuelles (pas des diminutifs) : « st » = « saint ».
const ABBR = { st: 'saint', ste: 'sainte' };

export function toks(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/['’`\-_.]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/).filter(Boolean)
    .map(w => ABBR[w] || w);
}

// Deux clés par texte : tout attaché, et sans les petits mots.
export function keysOf(s) {
  const t = toks(s);
  return { full: t.join(''), lite: t.filter(w => !STOP.has(w)).join('') };
}

// Ajoute à chaque élément ses clés de comparaison (nom + alias explicites).
export function prepare(items) {
  for (const it of items) {
    const ks = new Set();
    for (const s of [it.nom, ...(it.alias || [])]) {
      const k = keysOf(s);
      if (k.full) ks.add(k.full);
      if (k.lite) ks.add(k.lite);
    }
    it.keys = [...ks];
  }
  return items;
}

// Distance de Damerau-Levenshtein (transpositions comprises), arrêt dès que max est dépassé.
export function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let pp = null, p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    let best = i;
    for (let j = 1; j <= n; j++) {
      let v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
      c.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    pp = p; p = c;
  }
  return p[n];
}

// Fautes tolérées selon la longueur : 0 sous 5 lettres, 1 jusqu'à 8, 2 au-delà.
export const allowedTypos = len => (len < 5 ? 0 : len < 9 ? 1 : 2);
