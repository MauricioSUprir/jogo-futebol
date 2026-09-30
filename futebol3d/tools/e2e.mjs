// Fluxo completo pelo menu + controles por teclado + pausa (node tools/e2e.mjs)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const S = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/e2e';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 640, height: 360 } });
await routeCDN(ctx);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2500);
await p.keyboard.press('Enter'); await p.waitForTimeout(800);
await p.click('[data-key="amistoso"]'); await p.waitForTimeout(800);
await p.screenshot({ path: S + '-1select.png' });
await p.click('text=Próximo'); await p.waitForTimeout(800);
await p.click('[data-key="halfMinutes-2"]').catch(() => {});
await p.screenshot({ path: S + '-2options.png' });
await p.click('[data-key="start"]');
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 60000 });
await p.waitForTimeout(3000);
const st = () => p.evaluate(() => { const g = window.__golaco.game; if (!g) return null; const m = g.match; const c = m.controlled; return { phase: m.phase, sp: m.sp && m.sp.type, spTeamHuman: m.sp && m.sp.team.human, ctrl: c && c.data.name, owner: m.owner && m.owner.data.name, ball: [m.ball.p.x.toFixed(1), m.ball.p.z.toFixed(1)], clock: m.clock.toFixed(0), passes: m.userTeam.stats.passes, shots: m.userTeam.stats.shots }; });
console.log('início', JSON.stringify(await st()));
// se o humano dá a saída: Espaço
await p.keyboard.press('Space'); await p.waitForTimeout(4000);
console.log('após saída', JSON.stringify(await st()));
// corre para a direita com Shift, depois chuta segurando K
await p.keyboard.down('KeyD'); await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(4000);
await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyD');
await p.keyboard.down('KeyK'); await p.waitForTimeout(500); await p.keyboard.up('KeyK'); await p.waitForTimeout(2500);
console.log('após chute', JSON.stringify(await st()));
await p.screenshot({ path: S + '-3play.png' });
await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
await p.screenshot({ path: S + '-4pause.png' });
console.log('pausado', await p.evaluate(() => window.__golaco.game.paused));
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
console.log('retomado', await p.evaluate(() => !window.__golaco.game.paused));
// fim acelerado
await p.evaluate(() => { const g = window.__golaco.game; g.match.teams[0].score = 2; g.match.clock = 89.9 * 60; g.match.half = 2; });
await p.evaluate(() => window.__golaco.advance(40));
await p.waitForTimeout(4000);
await p.screenshot({ path: S + '-5result.png' });
console.log('erros', errs.join('\n') || 'nenhum');
await b.close();
