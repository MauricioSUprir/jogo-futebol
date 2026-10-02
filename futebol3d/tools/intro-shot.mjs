// Fotografa a abertura (túnel, fila, perfilamento, rostos, aérea) e testa o pular.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const S = process.argv[2] || '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/abertura';
const q = process.argv[3] || 'baixa', tod = process.argv[4] || 'dia';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await routeCDN(ctx); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async ({ q, tod }) => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[1]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[1], ...k, userSide: 'home', settings: { ...window.__golaco.settings(), quality: q, timeOfDay: tod, intro: true } }); }, { q, tod });
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 60000 });
await p.evaluate(() => { window.__golaco.game.paused = true; });
let last = 0;
for (const t of (process.argv[5] || '4,9.5,16,20.5,23,27').split(',').map(Number)) {
  const st = await p.evaluate(({ t, last }) => { const G = window.__golaco, g = G.game; G.advance(t - last); return { phase: g.match.phase, t: g.match.intro && g.match.intro.t.toFixed(1) }; }, { t, last });
  last = t;
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${S}-${String(t).replace('.', '_')}.png`, timeout: 300000 });
  console.log('t', t, JSON.stringify(st));
}
// pular: tecla
await p.evaluate(() => { window.__golaco.game.paused = false; });
await p.keyboard.press('Space'); await p.waitForTimeout(1500);
console.log('depois de pular:', await p.evaluate(() => window.__golaco.game.match.phase));
console.log('erros', errs.join('\n') || 'nenhum');
await b.close();
