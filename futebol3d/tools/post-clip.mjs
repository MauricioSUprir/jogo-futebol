// Chute na trave filmado de perto: rastro da bola, vibração da trave e rede.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { routeCDN } from './cdn-route.mjs';
const out = process.argv[2] || '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/trave';
const dir = out + '-frames'; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 960, height: 540 } });
await routeCDN(ctx); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async () => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[1]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[1], ...k, userSide: 'none', settings: { ...window.__golaco.settings(), quality: 'baixa', timeOfDay: 'dia' } }); });
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 60000 });
const setup = await p.evaluate(async () => {
  const B = await import('./js/ball.js');
  const G = window.__golaco, g = G.game, m = g.match;
  g.paused = true; document.getElementById('hud').style.display = 'none';
  g.stadium.root.traverse(o => { if (o.userData && o.userData.count) o.visible = false; });
  m.phase = 'play'; m.sp = null;
  const t = m.teams[0], gx = m.goalX(t), s = Math.sign(gx);
  for (const q of m.players) if (!q.isGK) q.teleport(-s * 20, (q.idx % 11) * 3 - 15, 0);
  t.opp.gk.teleport(gx - s * 1.2, -2, s > 0 ? Math.PI : 0);
  const sh = t.players[9];
  sh.teleport(gx - s * 18.5, 2, s > 0 ? 0 : Math.PI); m.ball.place(gx - s * 18, 0.11, 2); m.owner = sh;
  // mira na trave direita (do ponto de vista do chutador) a meia altura
  sh.action = null; m.owner = null; sh.teleport(gx - s * 30, 10, 0); sh.cooldown = 5;
  const o = { x: gx - s * 18, y: 0.11, z: 2 };
  const v = B.solveAim(o, { x: gx, y: 1.3, z: 3.66 }, 28, { side: 0, top: 6 }, m.wind);
  m.ball.place(o.x, o.y, o.z); m.ball.kick(v.vx, v.vy, v.vz, v.wx, v.wy, v.wz);
  m.lastTouch = sh; m.lastShot = { p: sh, t: m.time, speed: 28, counted: false };
  window.__s = s; window.__gx = gx;
  return { gx, s };
});
const frames = [];
for (let i = 0; i < 16; i++) {
  const st = await p.evaluate((i) => {
    const G = window.__golaco, g = G.game, m = g.match;
    G.advance(i < 3 ? 0.1 : 0.04);
    g.rig.setCinematic({ type: 'goal', target: { x: m.ball.p.x, y: m.ball.p.y, z: m.ball.p.z, copy() {}, set() {} }, sign: window.__s });
    g.rig.snap = true;
    return { x: m.ball.p.x.toFixed(1), y: m.ball.p.y.toFixed(2), z: m.ball.p.z.toFixed(2), v: m.ball.speed().toFixed(1) };
  }, i);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png`, timeout: 180000 });
  frames.push(`${i}: bola ${st.x},${st.y},${st.z} v=${st.v}`);
}
console.log(frames.join('\n'));
execFileSync('python3', [new URL('./sheet.py', import.meta.url).pathname, dir, out, '4', '80']);
console.log('erros', errs.join('; ') || 'nenhum');
await b.close();
