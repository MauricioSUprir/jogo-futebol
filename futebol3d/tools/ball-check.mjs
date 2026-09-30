// Verifica a bola na cena (posição, visibilidade, material) e tira um close.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await routeCDN(ctx);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('http://localhost:8790/index.html'); await page.waitForTimeout(2000);
await page.evaluate(async () => {
  const T = await import('./js/teams.js');
  const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
  window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'home', knockout: false, settings: { ...window.__golaco.settings(), quality: 'media' } });
});
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const g = window.__golaco.game; const bm = g.ball.mesh;
  g.rig.setCinematic({ type: 'orbit', target: bm.position.clone(), a0: 0.5 }); g.rig.snap = true;
  return { pos: bm.position.toArray().map(v => v.toFixed(2)), visible: bm.visible, inScene: !!bm.parent, map: !!bm.material.map, scale: bm.scale.toArray(), mball: g.match.ball.p };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(4000);
await page.screenshot({ path: '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/ball-close.png' });
await b.close();
