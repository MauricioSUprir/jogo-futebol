/* Total Match — service worker (app instalável + offline) */
var CACHE = "total-match-v90";
/* Concha do app: caminhos base (sem ?v=) — combinados por ignoreSearch. */
var SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "assets/logo.png",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png",
  "css/styles.css",
  "js/vendor/qrcode.js",
  "js/rng.js", "js/data.js", "js/placeholders.js", "js/storage.js", "js/notify.js",
  "js/engine.js", "js/ui.js", "js/settings.js", "js/saves.js", "js/quick.js",
  "js/competitions.js", "js/coach.js", "js/player.js", "js/director.js", "js/build.js",
  "js/compmode.js", "js/tournament.js", "js/groupcomp.js", "js/matchview.js", "js/pitch2d.js", "js/scout.js",
  "js/net.js", "js/online.js", "js/account.js", "js/editor.js", "js/app.js"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // adiciona um a um p/ não falhar tudo se um recurso faltar
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  // só cuidamos do próprio site; Firebase/CDNs seguem direto pela rede
  if (url.origin !== self.location.origin) return;

  // Rede primeiro (fresco quando online); cache como reserva offline.
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        // navegação offline sem cache exato -> devolve o index em cache
        if (req.mode === "navigate") return caches.match("./index.html", { ignoreSearch: true });
        return Response.error();
      });
    })
  );
});
