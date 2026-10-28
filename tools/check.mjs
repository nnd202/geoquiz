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
  const short = it => it.dep ? `${it.nom} (${it.dep})` : it.etat ? `${it.nom} (${it.etat})` : `${it.code} ${it.nom}`;
  const codes = new Set();
  for (const it of items) { if (codes.has(it.code)) { console.log(`✗ code en double : ${it.code}`); problems++; } codes.add(it.code); }
  if (def.carte) {
    const svg = readFileSync(new URL(def.carte, root), 'utf8');
    if (!svg.includes('viewBox')) { console.log(`✗ carte sans viewBox : ${def.carte}`); problems++; }
    const onMap = new Set([...svg.matchAll(/data-code="([^"]+)"/g)].map(m => m[1]));
    for (const it of items) if (!onMap.has(it.code)) { console.log(`✗ absent de la carte : ${it.code} ${it.nom}`); problems++; }
  }
  console.log(`\n${data.titre} (${items.length} éléments)`);
  const h = homonyms(items);
  console.log(`  Homonymes : ${h.length ? '' : 'aucun'}`);
  h.forEach(([k, list]) => console.log(`    ${k} : ${list.map(short).join(' / ')}`));
  const p = ambiguousPrefixes(items);
  console.log(`  Préfixes ambigus (validation différée) : ${p.length}`);
  p.forEach(([a, b]) => console.log(`    ${a.nom} → ${b.nom}`));
}
// Hors ligne : chaque fichier de données et de carte doit figurer dans le cache du service worker.
import { existsSync } from 'node:fs';
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const block = sw.slice(sw.indexOf('const CORE = ['), sw.indexOf('];', sw.indexOf('const CORE = [')));
const core = [...block.matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const f of core) if (f !== './' && !existsSync(new URL(f, root))) { console.log(`✗ sw.js cite un fichier absent : ${f}`); problems++; }
for (const def of Object.values(cat.jeux)) for (const f of [def.fichier, def.carte].filter(Boolean)) {
  if (!core.includes(f)) { console.log(`✗ absent du cache hors ligne (sw.js) : ${f}`); problems++; }
}
console.log(problems ? `\n${problems} problème(s)` : '\nAucun problème bloquant.');
process.exit(problems ? 1 : 0);
