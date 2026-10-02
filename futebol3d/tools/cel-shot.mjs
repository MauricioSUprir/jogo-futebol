// Prints e medições em viewport de celular (844x390, densidade 2, toque).
// Uso: node tools/cel-shot.mjs --q baixa --tod dia --out /caminho/prefixo [--advance 20] [--cam tv]
// Mede: draw calls, triângulos, ms por quadro (render forçado com readPixels, média de 12)
// e fps do laço do jogo. Com WebGL por software os números absolutos não valem para o
// aparelho real — servem para comparar antes/depois na mesma máquina.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/cel');
const W = +arg('w', 844), H = +arg('h', 390), DSF = +arg('dsf', 2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true });
await routeCDN(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${arg('port', '8790')}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.evaluate(async ({ tod, q, cam }) => {
  const T = await import('./js/teams.js');
  const home = T.TEAMS[0], away = T.TEAMS[3];
  const k = T.resolveKits(home, away);
  const settings = { ...window.__golaco.settings(), timeOfDay: tod, quality: q, camera: cam, intro: false };
  await window.__golaco.startMatch({ mode: 'amistoso', home, away, ...k, userSide: 'home', knockout: false, noIntro: true, settings });
}, { tod: arg('tod', 'dia'), q: arg('q', 'baixa'), cam: arg('cam', 'tv') });
await page.waitForTimeout(1500);
const adv = +arg('advance', 20);
if (adv) await page.evaluate((s) => window.__golaco.advance(s), adv);
await page.waitForTimeout(+arg('wait', 5000));
const st = await page.evaluate(() => {
  const G = window.__golaco, g = G.game, r = G.renderer, gl = r.getContext();
  const px = new Uint8Array(4);
  const one = () => { if (g.composer) g.composer.render(1 / 60); else r.render(g.scene, g.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  one(); one();
  r.info.reset();
  const t0 = performance.now();
  for (let i = 0; i < 12; i++) one();
  const ms = (performance.now() - t0) / 12;
  const calls = r.info.render.calls / 12, tris = r.info.render.triangles / 12;
  const db = [gl.drawingBufferWidth, gl.drawingBufferHeight];
  return { calls: Math.round(calls), tris: Math.round(tris), ms: +ms.toFixed(1), fps: +g.fps.toFixed(1), buffer: db, pr: r.getPixelRatio(), post: !!g.composer,
    shadow: r.shadowMap.enabled ? g.stadium.mainLight.shadow.mapSize.x : 0, phase: g.match.phase };
});
console.log(JSON.stringify(st));
await page.screenshot({ path: `${out}.png`, timeout: 300000 });
console.log('erros', errors.length ? errors.slice(0, 20).join('\n') : 'nenhum');
await b.close();
