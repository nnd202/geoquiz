// Script de vérification : à lancer après chaque ajout de données.
// Usage : node tools/check.mjs   (liste homonymes et préfixes ambigus de chaque jeu du catalogue)
import { readFileSync } from 'node:fs';
import { prepare } from '../js/core/text.js';
import { ambiguousPrefixes, homonyms } from '../js/core/validate.js';

const root = new URL('..', import.meta.url);
const cat = JSON.parse(readFileSync(new URL('catalogue.json', root)));
let problems = 0;
for (const [key, def] of Object.entries(cat.jeux)) {
  const data = JSON.parse(readFileSync(new URL(def.fichier, root)));
  const items = prepare(data.items);
  const codes = new Set();
  for (const it of items) { if (codes.has(it.code)) { console.log(`✗ code en double : ${it.code}`); problems++; } codes.add(it.code); }
  if (def.carte) {
    const svg = readFileSync(new URL(def.carte, root), 'utf8');
    const onMap = new Set([...svg.matchAll(/data-code="([^"]+)"/g)].map(m => m[1]));
    for (const it of items) if (!onMap.has(it.code)) { console.log(`✗ absent de la carte : ${it.code} ${it.nom}`); problems++; }
  }
  console.log(`\n${data.titre} (${items.length} éléments)`);
  const h = homonyms(items);
  console.log(`  Homonymes : ${h.length ? '' : 'aucun'}`);
  h.forEach(([k, list]) => console.log(`    ${k} : ${list.map(i => `${i.code} ${i.nom}`).join(' / ')}`));
  const p = ambiguousPrefixes(items);
  console.log(`  Préfixes ambigus (validation différée) : ${p.length}`);
  p.forEach(([a, b]) => console.log(`    ${a.nom} → ${b.nom}`));
}
process.exit(problems ? 1 : 0);
