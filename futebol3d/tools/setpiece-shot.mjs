// Fotografa bolas paradas: escanteio, falta com barreira e pênalti.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const S = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/sp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await routeCDN(ctx); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async () => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[4], T.TEAMS[5]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[4], away: T.TEAMS[5], ...k, userSide: 'home', settings: { ...window.__golaco.settings(), quality: 'alta', timeOfDay: 'dia' } }); }).catch(() => {});
await p.waitForTimeout(1500);
for (const [name, r] of [['corner', 'c'], ['falta', 'f'], ['penalti', 'p']]) {
  await p.evaluate((r) => {
    const G = window.__golaco, m = G.game.match, t = m.userTeam, gx = m.goalX(t), s = Math.sign(gx);
    m.phase = 'play'; m.sp = null; G.game.rig.setCinematic(null);
    const R = r === 'c' ? { type: 'corner', team: t, x: gx, z: 34 } : r === 'f' ? { type: 'freekick', team: t, x: gx - s * 22, z: -6 } : { type: 'penalty', team: t };
    m.setupRestart(R);
    G.advance(1.0);
  }, r);
  await p.waitForTimeout(9000);
  await p.screenshot({ path: `${S}-${name}.png` });
}
console.log('erros', errs.join('\n') || 'nenhum');
await b.close();
