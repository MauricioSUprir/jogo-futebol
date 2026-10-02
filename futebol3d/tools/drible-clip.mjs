// Clipe controlado da condução: o jogador humano recebe a bola no meio-campo, conduz
// reto, vira 90° e acelera; câmera de perto. Mesmo lance sempre (compara antes/depois).
// node tools/drible-clip.mjs [--out prefixo] [--frames 24] [--step 0.08] [--q media] [--cam perto|tv]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { routeCDN } from './cdn-route.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('frames', 24), step = +arg('step', 0.08), cam = arg('cam', 'perto');
const out = arg('out', '/tmp/drible');
const dir = out + '-frames';
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: +arg('w', 960), height: +arg('h', 540) } });
await routeCDN(ctx);
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://localhost:${arg('port', '8790')}/index.html`); await p.waitForTimeout(2000);
await p.evaluate(async (q) => {
  const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[1]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[1], ...k, userSide: 'home', noIntro: true, settings: { ...window.__golaco.settings(), quality: q, timeOfDay: 'dia', intro: false } });
}, arg('q', 'media'));
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 60000 });
await p.evaluate(() => {
  const G = window.__golaco, g = G.game, m = g.match;
  g.paused = true; G.advance(3);
  const pl = m.userTeam.players.find(q => q.role !== 'GK' && !q.isGK && q.pos?.role !== 'GK' && q.a.dri > 70) || m.userTeam.players[9];
  // afasta todo mundo e posiciona o conduzidor
  for (const q of m.players) if (q !== pl) { q.x = Math.sign(q.x || 1) * 40; q.homeX = q.x; }
  pl.x = -10; pl.z = 0; pl.heading = 0; pl.vx = 3; pl.vz = 0;
  m.ball.p.x = -9.6; m.ball.p.z = 0.1; m.ball.p.y = 0.11; m.ball.v.x = 3; m.ball.v.z = 0;
  m.phase = "play"; m.sp = null; m.setControlled(pl); m.takeBall(pl, 'control');
  window.__pl = pl; window.__t = 0;
  document.getElementById('hud').style.display = 'none';
  g.stadium.root.traverse(o => { if (o.userData && o.userData.count) o.visible = false; });
});
const raf = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const log = [];
for (let i = 0; i < N; i++) {
  const info = await p.evaluate(({ step, cam }) => {
    const G = window.__golaco, g = G.game, m = g.match, pl = window.__pl;
    const blank = { held: {}, press: {}, release: {}, hold: {}, rx: 0, rz: 0 };
    G.advance(step, () => {
      window.__t += 1 / 60; const t = window.__t;
      // 0–1,2 s reto (+x); depois vira para +z; a partir de 2,4 s em arrancada
      const a = t < 1.2 ? 0 : Math.min(Math.PI / 2, (t - 1.2) * 4);
      return { ...blank, mx: Math.cos(a), mz: Math.sin(a), held: { sprint: t > 2.4 } };
    });
    if (cam === 'perto') {
      g.rig.setCinematic({ type: 'orbit', target: { x: pl.x, y: 0, z: pl.z }, a0: -Math.PI / 2 - 0.6 });
      g.rig.cine.target = { x: pl.x, y: 0, z: pl.z, copy() {}, set() {} };
    } else g.rig.setCinematic(null);
    g.rig.snap = true;
    const d = Math.hypot(m.ball.p.x - pl.x, m.ball.p.z - pl.z);
    return `t ${window.__t.toFixed(2)} dir ${(pl.heading * 57.3).toFixed(0)}° vel ${pl.speed.toFixed(1)} bola ${d.toFixed(2)} m ${m.owner === pl ? 'posse' : 'SOLTA'} ${pl.pose.anim}`;
  }, { step, cam });
  await raf(); await raf();
  await p.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png`, timeout: 180000 });
  log.push(i + ': ' + info);
}
console.log(log.join('\n'));
execFileSync('python3', [new URL('./sheet.py', import.meta.url).pathname, dir, out, '4', String(Math.round(step * 1000))]);
console.log('folha', `${out}-sheet.png`, '| gif', `${out}.gif`, '| erros', errs.join('; ') || 'nenhum');
await b.close();
