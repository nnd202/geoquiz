// Hors ligne : réseau d'abord (l'app est toujours à jour quand le téléphone est connecté),
// cache en secours (l'app marche sans réseau). Changer VERSION force un nettoyage du cache.
const VERSION = 'geoquiz-2';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'catalogue.json', 'css/app.css',
  'js/app.js', 'js/core/dom.js', 'js/core/text.js', 'js/core/validate.js', 'js/core/store.js',
  'js/core/boards.js', 'js/core/game.js',
  'js/mechanics/index.js', 'js/mechanics/all.js', 'js/mechanics/clue.js', 'js/mechanics/tap.js', 'js/mechanics/queue.js',
  'data/departements.json', 'data/regions.json', 'data/prefectures.json', 'data/sous-prefectures.json', 'data/chefs-lieux.json',
  'data/etats-unis.json', 'data/capitales-etats-unis.json', 'data/canada.json', 'data/capitales-canada.json',
  'maps/france.svg', 'maps/france-regions.svg', 'maps/etats-unis.svg', 'maps/canada.svg',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
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
