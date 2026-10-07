// Relógio controlado para gravar/testar o jogo quadro a quadro com dt exato, por mais lento
// que seja o renderizador (método da auditoria): performance.now e requestAnimationFrame
// da página passam a andar só quando chamamos step(ms).
//
// Uso:
//   const { browser, page } = await openGame({ w, h, dpr, mobile, port });
//   await startMatch(page, { quality: 'media', timeOfDay: 'noite', userSide: 'home' });
//   await pumpOn(page);
//   for (...) { await stepFrame(page, 1000 / 60); await page.screenshot(...); }
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';

export const INIT_PUMP = () => {
  const realNow = performance.now.bind(performance), realRAF = requestAnimationFrame.bind(window);
  let manual = false, fake = 0; const q = [];
  performance.now = () => (manual ? fake : realNow());
  window.requestAnimationFrame = (cb) => { if (!manual) return realRAF(cb); q.push(cb); return q.length; };
  window.__pump = {
    on() { manual = true; fake = realNow(); },
    pending() { return q.length; },
    step(ms) { fake += ms; const list = q.splice(0); for (const cb of list) cb(fake); },
  };
};

// site publicado (GitHub Pages): o Chromium headless não passa pelo proxy — busca com curl,
// sem cache entre execuções (sempre a versão no ar)
const TIPOS = { html: 'text/html', js: 'application/javascript', mjs: 'application/javascript', json: 'application/json', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', bin: 'application/octet-stream', ktx2: 'image/ktx2', glb: 'model/gltf-binary', woff2: 'font/woff2', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', webmanifest: 'application/manifest+json' };
async function routeSite(ctx) {
  const { execFileSync } = await import('node:child_process');
  await ctx.route(/github\.io/, async (route) => {
    const url = route.request().url();
    let body;
    try { body = execFileSync('curl', ['-sSL', '--fail', '-A', 'Mozilla/5.0 Chrome/120', url], { maxBuffer: 256 * 1024 * 1024 }); }
    catch { return route.fulfill({ status: 404, body: '' }); }
    const ext = (new URL(url).pathname.split('.').pop() || 'html').toLowerCase();
    await route.fulfill({ body, contentType: TIPOS[ext] || (url.endsWith('/') ? 'text/html' : 'application/octet-stream') });
  });
}

export async function openGame({ w = 1280, h = 720, dpr = 1, mobile = false, port = 8790, swiftshader = true, url = null } = {}) {
  const args = swiftshader ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [];
  const browser = await chromium.launch({ args });
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true });
  await routeCDN(context);
  if (url) await routeSite(context);
  await context.addInitScript(INIT_PUMP);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(url || `http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(2500);
  return { browser, context, page, errors };
}

export async function startMatch(page, opts = {}) {
  await page.evaluate(async (o) => {
    const T = await import('./js/teams.js');
    const home = T.TEAMS[o.home ?? 0], away = T.TEAMS[o.away ?? 3];
    const k = T.resolveKits(home, away);
    const settings = { ...window.__golaco.settings(), quality: o.quality || 'alta', timeOfDay: o.timeOfDay || 'noite', intro: !!o.intro, weather: o.weather || 'seco', camera: o.camera || 'tv', halfMinutes: o.halfMinutes || 6 };
    await window.__golaco.startMatch({ mode: 'amistoso', home, away, ...k, userSide: o.userSide || 'home', settings });
  }, opts);
  await page.waitForFunction(() => window.__golaco.game, null, { timeout: 300000 });
}

// liga o relógio manual e espera o laço do jogo (que estava no rAF real) entrar na fila
export async function pumpOn(page) {
  await page.evaluate(() => window.__pump.on());
  await page.waitForFunction(() => window.__pump.pending() > 0, null, { timeout: 60000, polling: 100 });
}
export const stepFrame = (page, ms = 1000 / 60, n = 1) => page.evaluate(({ ms, n }) => { for (let i = 0; i < n; i++) window.__pump.step(ms); }, { ms, n });
