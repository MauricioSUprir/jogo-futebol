/* Amigo Oculto — service worker.
 *
 * O que guarda: a página /offline (versão pública, sem cookies) com os estáticos dela, os arquivos de /_next/static
 * (têm nome com hash: nunca mudam) e os ícones. Navegação: rede primeiro; sem rede, a página /offline.
 * O que NUNCA guarda: respostas do Supabase (outra origem), /api, /auth, páginas logadas ou qualquer HTML que não seja
 * o /offline. Registrado com ?dev=1 no desenvolvimento: aí não guarda os estáticos (os nomes não têm hash).
 * Push: mostra a notificação e, no clique, foca uma aba do app (ou abre uma) no link da notificação.
 */
const VERSAO = "ao-v1";
const CACHE = `amigo-oculto-${VERSAO}`;
const DEV = new URL(self.location.href).searchParams.has("dev");
const OFFLINE = "/offline";
const ICONES = ["/icones/icone-192.png", "/icones/icone-512.png", "/icones/badge-96.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ICONES).catch(() => {});
      try {
        const resposta = await fetch(new Request(OFFLINE, { credentials: "omit", cache: "no-store" }));
        if (resposta.ok) {
          const html = await resposta.clone().text();
          await cache.put(OFFLINE, resposta);
          if (!DEV) {
            // os estáticos que a página offline usa (CSS, JS e fontes com hash)
            const estaticos = [...new Set(html.match(/\/_next\/static\/[^"'()\s<>\\]+/g) ?? [])];
            await Promise.all(estaticos.map((u) => cache.add(u).catch(() => {})));
          }
        }
      } catch {
        // sem rede na instalação: tenta de novo na próxima
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n.startsWith("amigo-oculto-") && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function podeGuardarEstatico(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/icones/")) return true;
  return !DEV && url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // Supabase e qualquer outra origem: direto na rede, nada guardado
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (pedido.mode === "navigate") {
    // rede primeiro; a resposta NÃO é guardada (páginas logadas). Sem rede: a página offline.
    evento.respondWith(
      fetch(pedido).catch(async () => (await caches.match(OFFLINE)) ?? new Response("Sem conexão.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })),
    );
    return;
  }

  if (podeGuardarEstatico(url)) {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const guardado = await cache.match(pedido);
        if (guardado) return guardado;
        const resposta = await fetch(pedido);
        if (resposta.ok && resposta.type === "basic") cache.put(pedido, resposta.clone()).catch(() => {});
        return resposta;
      })(),
    );
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------------------------------------------------
self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { titulo: evento.data ? evento.data.text() : "" };
  }
  const titulo = typeof dados.titulo === "string" && dados.titulo ? dados.titulo : "Amigo Oculto";
  const link = typeof dados.link === "string" && dados.link.startsWith("/") && !dados.link.startsWith("//") ? dados.link : "/notificacoes";
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: typeof dados.corpo === "string" ? dados.corpo : undefined,
      icon: "/icones/icone-192.png",
      badge: "/icones/badge-96.png",
      tag: typeof dados.id === "string" ? dados.id : undefined,
      lang: "pt-BR",
      data: { link },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const link = evento.notification.data && typeof evento.notification.data.link === "string" ? evento.notification.data.link : "/notificacoes";
  const destino = new URL(link, self.location.origin).href;
  evento.waitUntil(
    (async () => {
      const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const aba of abas) {
        if (new URL(aba.url).origin !== self.location.origin) continue;
        await aba.focus();
        if ("navigate" in aba) {
          try {
            await aba.navigate(destino);
          } catch {
            // aba não controlada por este service worker: abre uma nova
            await self.clients.openWindow(destino);
          }
        }
        return;
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
