// THE FLASH — service worker: rede primeiro SEM o cache do navegador (cache: 'no-cache' revalida cada arquivo no
// servidor), para o jogo instalado na tela de início sempre abrir a versão nova; o cache daqui só serve sem internet.
const CACHE = 'theflash-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;               // three.js do CDN segue direto
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())),
  );
});
