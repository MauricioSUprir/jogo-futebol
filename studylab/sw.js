/* bloqueio: este service worker substitui o do app, apaga o cache e se remove */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  const janelas = await self.clients.matchAll({ type: 'window' });
  janelas.forEach((c) => { try { c.navigate(c.url); } catch (_) { /* segue */ } });
})()));
