// Grava uma sequência de quadros da partida (simulação controlada) e monta uma
// folha de contato + vídeo, para avaliar movimento, condução e animações.
// Uso: node tools/clip.mjs [--cam tv|close] [--frames 12] [--step 0.1] [--warm 12] [--out prefixo] [--q media]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { routeCDN } from './cdn-route.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const cam = arg('cam', 'close'), N = +arg('frames', 12), step = +arg('step', 0.1), warm = +arg('warm', 12);
const out = arg('out', '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/clip');
const W = +arg('w', 960), H = +arg('h', 540);
const dir = out + '-frames';
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: W, height: H } });
await routeCDN(ctx);
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://localhost:${arg('port', '8790')}/index.html`); await p.waitForTimeout(2000);
await p.evaluate(async (q) => {
  const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[1]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[1], ...k, userSide: 'none', settings: { ...window.__golaco.settings(), quality: q, timeOfDay: 'dia' } });
}, arg('q', 'baixa'));
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 60000 });
// aquece até alguém conduzir a bola correndo
await p.evaluate((warm) => {
  const G = window.__golaco, g = G.game, m = g.match;
  g.paused = true; G.advance(warm);
  for (let i = 0; i < 600; i++) { if (m.owner && m.owner.speed > 4 && m.phase === 'play') break; G.advance(1 / 60); }
  document.getElementById('hud').style.display = 'none';
  // a torcida pesa demais no renderizador por software: some no clipe
  g.stadium.root.traverse(o => { if (o.userData && o.userData.count) o.visible = false; });
}, warm);
const raf = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const log = [];
for (let i = 0; i < N; i++) {
  const info = await p.evaluate(({ cam, step }) => {
    const G = window.__golaco, g = G.game, m = g.match;
    if (step) G.advance(step);
    const o = m.owner || m.players.reduce((a, q) => (Math.hypot(q.x - m.ball.p.x, q.z - m.ball.p.z) < Math.hypot(a.x - m.ball.p.x, a.z - m.ball.p.z) ? q : a));
    if (cam === 'close') {
      const T = { x: o.x, y: 0, z: o.z };
      g.rig.setCinematic({ type: 'orbit', target: T, a0: -Math.PI / 2 - 0.5 });
      g.rig.cine.target = { x: o.x, y: 0, z: o.z, copy() {}, set() {} };
    } else g.rig.setCinematic(null);
    g.rig.snap = true;
    const d = Math.hypot(m.ball.p.x - o.x, m.ball.p.z - o.z);
    return { who: o.data.name, owner: !!m.owner, speed: o.speed.toFixed(1), dist: d.toFixed(2), ballY: m.ball.p.y.toFixed(2), anim: o.pose.anim };
  }, { cam, step });
  await raf(); await raf();
  await p.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png`, timeout: 180000 });
  log.push(`${i}: ${info.who} vel ${info.speed} bola a ${info.dist} m (y ${info.ballY}) ${info.owner ? 'com posse' : 'solta'} ${info.anim}`);
}
console.log(log.join('\n'));
execFileSync('python3', [new URL('./sheet.py', import.meta.url).pathname, dir, out, '4', String(Math.round(step * 1000) || 100)]);
console.log('folha', `${out}-sheet.png`, '| gif', `${out}.gif`, '| erros', errs.join('; ') || 'nenhum');
await b.close();
