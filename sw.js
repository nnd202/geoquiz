// Hors ligne : réseau d'abord (l'app est toujours à jour quand le téléphone est connecté),
// cache en secours (l'app marche sans réseau). Changer VERSION force un nettoyage du cache.
const VERSION = 'geoquiz-8';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'catalogue.json',
  'css/app.css',
  'js/app.js',
  'js/core/dom.js',
  'js/core/text.js',
  'js/core/validate.js',
  'js/core/store.js',
  'js/core/backup.js',
  'js/core/confetti.js',
  'js/core/boards.js',
  'js/core/game.js',
  'js/mechanics/index.js',
  'js/mechanics/all.js',
  'js/mechanics/clue.js',
  'js/mechanics/tap.js',
  'js/mechanics/queue.js',
  'data/pays.json',
  'data/capitales.json',
  'data/mers.json',
  'data/constellations.json',
  'data/etoiles.json',
  'data/regions.json',
  'data/departements.json',
  'data/prefectures.json',
  'data/chefs-lieux.json',
  'data/villes-france.json',
  'data/etats-unis.json',
  'data/canada.json',
  'data/capitales-etats-unis.json',
  'data/capitales-canada.json',
  'data/villes-etats-unis.json',
  'data/pays-plus.json',
  'data/lacs.json',
  'data/fleuves.json',
  'data/drapeaux.json',
  'data/herault.json',
  'maps/monde.svg',
  'maps/mers.svg',
  'maps/ciel.svg',
  'maps/france.svg',
  'maps/france-regions.svg',
  'maps/etats-unis.svg',
  'maps/canada.svg',
  'maps/monde-plus.svg',
  'maps/lacs.svg',
  'maps/fleuves.svg',
  'maps/herault.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  // Les drapeaux (≈ 1,3 Mo) sont mis en cache en plus, sans bloquer l'installation s'ils échouent.
  const flags = c => fetch('data/drapeaux.json').then(r => r.json())
    .then(d => c.addAll(d.items.map(it => it.image))).catch(() => {});
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE).then(() => flags(c))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
