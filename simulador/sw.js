// Service worker: rede primeiro (sempre a versão mais nova), cache como reserva para jogar offline.
const CACHE = 'lal-v1';
const CORE = ['./', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon.svg',
  './js/main.js', './js/config.js', './js/rng.js', './js/teams.js', './js/engine.js', './js/commentary.js', './js/league.js',
  './js/render.js', './js/dom.js', './js/match-view.js', './js/screens.js', './js/storage.js', './js/log.js', './js/quality.js', './js/audio.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
