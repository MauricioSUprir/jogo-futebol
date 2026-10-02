// Força um gol e grava a sequência (câmera lenta, corrida, gesto, abraço) em quadros.
// Uso: node tools/goal-clip.mjs [prefixo] [qualidade] [quadros] [intervalo-ms]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { routeCDN } from './cdn-route.mjs';
const out = process.argv[2] || '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/gol';
const q = process.argv[3] || 'baixa', N = +(process.argv[4] || 12), gap = +(process.argv[5] || 700);
const dir = out + '-frames'; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); await routeCDN(ctx);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(1500);
await p.evaluate(async (q) => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[2]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[2], ...k, userSide: 'none', noIntro: true, settings: { ...window.__golaco.settings(), quality: q, timeOfDay: 'dia', intro: false } }); }, q);
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 120000 });
await p.evaluate(() => {
  const G = window.__golaco, g = G.game, m = g.match; document.getElementById('hud').style.display = 'none';
  const t = m.teams[0], gx = m.goalX(t), s = Math.sign(gx), sh = t.players[9];
  for (let tries = 0; tries < 8 && m.phase !== 'goal'; tries++) {
    m.phase = 'play'; m.sp = null;
    for (const q of m.players) if (!q.isGK && q !== sh) q.teleport(gx - s * (14 + (q.idx % 5) * 4), (q.idx % 11) * 3 - 15, 0);
    t.opp.gk.teleport(gx - s * 0.5, 3, s > 0 ? Math.PI : 0);
    sh.teleport(gx - s * 15, 6, s > 0 ? 0 : Math.PI);
    m.ball.place(gx - s * 14.4, 0.11, 6); m.owner = sh;
    sh.startAction('shot', { target: { x: gx, y: 0.6, z: -2.9 }, power: 0.75, face: Math.atan2(-8.9, s * 14.4) });
    for (let i = 0; i < 240 && m.phase !== 'goal'; i++) G.advance(1 / 60);
  }
});
const log = [];
for (let i = 0; i < N; i++) {
  await p.waitForTimeout(gap);
  const info = await p.evaluate(() => { const g = window.__golaco.game, m = g.match, gi = m.goalInfo; const sc = gi?.scorer;
    return { t: gi ? gi.t.toFixed(1) : '-', ph: m.phase, cine: g.rig.cine?.type, sc: sc && sc.action ? sc.action.type : '-', hugs: m.players.filter(q => q.action?.type === 'hug').length }; });
  await p.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png`, timeout: 240000 });
  log.push(JSON.stringify(info));
}
console.log(log.join('\n'));
execFileSync('python3', [new URL('./sheet.py', import.meta.url).pathname, dir, out, '4', '500']);
console.log('folha', out + '-sheet.png', '| erros', errs.join('; ') || 'nenhum');
await b.close();
