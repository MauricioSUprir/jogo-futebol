/* ===== sw.js — cache offline do StudyLab ===== */
const CACHE = 'studylab-v5';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './assets/logo.svg', './assets/icon.svg', './assets/icon-maskable.svg',
  './js/app.js', './js/store.js', './js/seed.js', './js/engine.js', './js/ai.js', './js/ui.js', './js/util.js',
  './js/produto.js', './js/auth.js', './js/api.js',
  './js/views/comum.js', './js/views/inicio.js', './js/views/agenda.js', './js/views/tarefas.js',
  './js/views/provas.js', './js/views/materias.js', './js/views/aprender.js', './js/views/questoes.js',
  './js/views/flashcards.js', './js/views/revisao.js', './js/views/foco.js', './js/views/desempenho.js',
  './js/views/conquistas.js', './js/views/biblioteca.js', './js/views/studyai.js', './js/views/config.js',
  './js/views/quickadd.js', './js/views/busca.js', './js/views/perfil.js',
  './js/views/entrar.js', './js/views/planos.js', './js/views/pagamento.js', './js/views/criador.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // nunca intercepta a API da Anthropic
  e.respondWith(
    fetch(e.request)
      .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
