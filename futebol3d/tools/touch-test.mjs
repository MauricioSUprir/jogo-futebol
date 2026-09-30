// Controles de toque: arrasta o joystick e aperta botões (eventos de ponteiro).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
await routeCDN(ctx); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async () => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'home', settings: { ...window.__golaco.settings(), quality: 'baixa' } }); });
await p.waitForTimeout(1500);
const read = () => p.evaluate(() => { const I = window.__golaco.input; const g = window.__golaco.game; const c = I.poll(g.rig.right, g.rig.fwd); return { stick: [I.touchStick.x.toFixed(2), I.touchStick.y.toFixed(2)], move: [c.mx.toFixed(2), c.mz.toFixed(2)], held: Object.keys(c.held).filter(k => c.held[k]), ctx: I.context }; });
// joystick: segura na área esquerda e arrasta para a direita
await p.mouse.move(150, 280); await p.mouse.down(); await p.mouse.move(220, 280, { steps: 5 });
console.log('joystick →', JSON.stringify(await read()));
await p.mouse.up();
const box = await p.locator('.tc-shoot').boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
console.log('botão chute', JSON.stringify(await read()));
await p.mouse.up();
console.log('botões visíveis', await p.locator('.tc-btn').count(), 'pausa', await p.locator('.tc-pause').count());
console.log('erros', errs.join('\n') || 'nenhum');
await b.close();
