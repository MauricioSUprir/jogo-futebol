// Controles reais de teclado (classe Input) acionando a simulação acelerada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 640, height: 360 } });
await routeCDN(ctx); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async () => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'home', settings: { ...window.__golaco.settings(), quality: 'baixa' } });
  const g = window.__golaco.game; g.match.setupKickoff(g.match.userTeam); });
await p.waitForTimeout(500);
// avança N segundos lendo o teclado de verdade
const run = (s) => p.evaluate((s) => { const G = window.__golaco, g = G.game; let n = 0;
  G.advance(s, () => { if (n++) G.input.consume(); return G.input.poll(g.rig.right, g.rig.fwd); });
  G.input.consume();
  const m = g.match, c = m.controlled; return { phase: m.phase, ctrl: c && c.data.name, owner: m.owner && m.owner.data.name, ctrlX: c && c.x.toFixed(1), ball: m.ball.p.x.toFixed(1) + ',' + m.ball.p.z.toFixed(1), passes: m.userTeam.stats.passes, shots: m.userTeam.stats.shots, score: m.teams.map(t => t.score) }; }, s);
console.log('saída (Espaço):'); await p.keyboard.press('Space'); console.log(JSON.stringify(await run(1.5)));
await p.keyboard.press('KeyQ'); console.log('Q troca:', JSON.stringify(await run(0.2)));
// correr com a bola ou atrás dela: D + Shift (direita da tela = ataque)
await p.keyboard.down('KeyD'); await p.keyboard.down('ShiftLeft');
for (let i = 0; i < 4; i++) console.log('D+Shift', JSON.stringify(await run(1)));
await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyD');
await p.keyboard.down('KeyK'); await run(0.5); await p.keyboard.up('KeyK');
console.log('K chute:', JSON.stringify(await run(2)));
await p.keyboard.press('Space'); console.log('passe:', JSON.stringify(await run(2)));
await p.keyboard.press('KeyL'); console.log('longo:', JSON.stringify(await run(3)));
console.log('erros', errs.join('\n') || 'nenhum');
await b.close();
