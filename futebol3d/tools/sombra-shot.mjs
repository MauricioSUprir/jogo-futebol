// Depuração da sombra do sol/refletores em viewport de celular: print da câmera de TV
// e um close num jogador (câmera manual), mais o tamanho do retângulo da sombra.
// Uso: node tools/sombra-shot.mjs --q baixa --tod dia --out /prefixo [--port 8790] [--js "expr"]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', '/tmp/sombra');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await routeCDN(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${arg('port', '8790')}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.evaluate(async ({ tod, q }) => {
  const T = await import('./js/teams.js');
  const home = T.TEAMS[0], away = T.TEAMS[3];
  const k = T.resolveKits(home, away);
  const settings = { ...window.__golaco.settings(), timeOfDay: tod, quality: q, intro: false };
  await window.__golaco.startMatch({ mode: 'amistoso', home, away, ...k, userSide: 'home', knockout: false, noIntro: true, settings });
}, { tod: arg('tod', 'dia'), q: arg('q', 'baixa') });
await page.waitForTimeout(1000);
await page.evaluate((s) => window.__golaco.advance(s), +arg('advance', 3));
if (arg('js')) console.log('js:', await page.evaluate(arg('js')));
// close: congela o jogo e põe a câmera perto do jogador controlado
const info = await page.evaluate(() => {
  const G = window.__golaco, g = G.game;
  g.paused = true;
  const p = g.match.controlled || g.match.players[9];
  g.rig.setCinematic({ type: 'manual', pos: { x: p.x - 3, y: 3.2, z: p.z - 7.5 }, look: { x: p.x, y: 0.6, z: p.z }, fov: 34, lam: 50 });
  return { x: p.x, z: p.z, w: g.sunFit?.lastW, map: g.stadium.mainLight.shadow.mapSize.x, nb: g.stadium.mainLight.shadow.normalBias };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(2500);
// garante um quadro com a câmera manual mesmo pausado
await page.evaluate(() => {
  const G = window.__golaco, g = G.game; const c = g.rig.cine;
  g.camera.position.set(c.pos.x, c.pos.y, c.pos.z); g.camera.fov = c.fov; g.camera.updateProjectionMatrix(); g.camera.lookAt(c.look.x, c.look.y, c.look.z);
  g.sunFit?.update(g.camera);
  if (g.composer) g.composer.render(1 / 60); else G.renderer.render(g.scene, g.camera);
});
await page.screenshot({ path: `${out}-close.png`, timeout: 300000 });
console.log('erros', errors.length ? errors.slice(0, 20).join('\n') : 'nenhum');
await b.close();
