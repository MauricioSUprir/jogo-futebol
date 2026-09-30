// Abre o jogo no Chromium (WebGL por software), inicia uma partida e tira prints.
// Uso: node tools/game-shot.mjs [--tod noite] [--q alta] [--w 1600 --h 900] [--mobile] [--secs 6] [--shots 3] [--side home] [--out prefixo]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const W = +arg('w', 1600), H = +arg('h', 900);
const out = arg('out', '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/game');
const port = arg('port', '8790');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: flag('mobile'), hasTouch: flag('mobile') });
await routeCDN(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}-menu.png` });
const cfgInfo = await page.evaluate(async ({ tod, q, side, cam, mins }) => {
  const T = await import('./js/teams.js');
  const home = T.TEAMS[+(new URLSearchParams(location.search).get('h') || 0)], away = T.TEAMS[3];
  const k = T.resolveKits ? T.resolveKits(home, away) : { homeKit: home.kits.home, awayKit: away.kits.away, homeGK: home.kits.gk, awayGK: away.kits.gk };
  const settings = { ...window.__golaco.settings(), timeOfDay: tod, quality: q, camera: cam, halfMinutes: +mins };
  window.__golaco.startMatch({ mode: 'amistoso', home, away, ...k, userSide: side, knockout: false, settings });
  return { home: home.name, away: away.name, k: Object.keys(k) };
}, { tod: arg('tod', 'noite'), q: arg('q', 'alta'), side: arg('side', 'home'), cam: arg('cam', 'tv'), mins: arg('mins', '4') });
console.log('partida', JSON.stringify(cfgInfo));
const secs = +arg('secs', 6), shots = +arg('shots', 3);
const adv = +arg('advance', 0);
for (let i = 0; i < shots; i++) {
  if (adv) { await page.waitForTimeout(1500); await page.evaluate((s) => window.__golaco.advance(s), adv); await page.waitForTimeout(secs * 1000); }
  else await page.waitForTimeout(secs * 1000);
  const st = await page.evaluate(() => { const g = window.__golaco.game; if (!g) return null; const m = g.match; return { calls: window.__golaco.renderer.info.render.calls, tris: window.__golaco.renderer.info.render.triangles, phase: m.phase, clock: m.clock.toFixed(0), score: m.teams.map(t => t.score), fps: g.fps.toFixed(1), ball: [m.ball.p.x.toFixed(1), m.ball.p.z.toFixed(1)] }; });
  console.log('estado', JSON.stringify(st));
  await page.screenshot({ path: `${out}-${i}.png` });
}
console.log('erros', errors.length ? errors.slice(0, 20).join('\n') : 'nenhum');
await b.close();
