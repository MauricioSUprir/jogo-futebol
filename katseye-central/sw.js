/* ===== sw.js — cache offline do KATSEYE Central =====
   Estratégia: rede primeiro, cache como rede de segurança. Assim uma
   atualização publicada chega na hora e o app continua abrindo sem
   internet. A API da IA nunca passa por aqui.                             */

const CACHE = 'katseye-central-v1';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './assets/icon.svg', './assets/icon-maskable.svg',
  './js/app.js', './js/store.js', './js/chave.js', './js/util.js', './js/ui.js', './js/motion.js',
  './js/engine.js', './js/dados.js', './js/ia.js', './js/cartaz.js', './js/fotos.js',
  './js/views/comum.js', './js/views/inicio.js', './js/views/membros.js',
  './js/views/agenda.js', './js/views/estudio.js', './js/views/conselheiro.js',
  './js/views/config.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // só o próprio app: nunca intercepta a API do Gemini nem a da Anthropic
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
