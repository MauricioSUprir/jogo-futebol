/* O MindTrack AI mudou para https://guidrodrigues21-a11y.github.io/mindtrack-ai/
   Este service worker só existe para DESLIGAR o app antigo nos celulares que já
   tinham ele instalado: apaga o cache, se desinstala e recarrega a página, que
   agora é o redirecionamento (que leva os dados junto). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    const abertas = await self.clients.matchAll({ type: 'window' });
    for (const c of abertas) c.navigate(c.url);
  })());
});
