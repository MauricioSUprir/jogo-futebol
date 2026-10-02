// Quadros de um chute visto de lado (para conferir a animação). node tools/kick-shot.mjs [prefixo]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { routeCDN } from './cdn-route.mjs';
const out = process.argv[2] || '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/chute';
const dir = out + '-frames'; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 480 } }); await routeCDN(ctx);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(1500);
await p.evaluate(async () => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[1]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[1], ...k, userSide: 'none', noIntro: true, settings: { ...window.__golaco.settings(), quality: 'media', timeOfDay: 'dia', intro: false } }); });
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 120000 });
await p.evaluate(() => { const G = window.__golaco, g = G.game, m = g.match; g.paused = true; document.getElementById('hud').style.display = 'none';
  g.stadium.root.traverse(o => { if (o.userData && o.userData.count) o.visible = false; });
  m.phase = 'play'; m.sp = null;
  for (const q of m.players) q.teleport(-40, (q.idx - 11) * 2, 0);
  const sh = m.teams[0].players[9]; sh.teleport(-0.45, 0, 0); m.ball.place(0, 0.11, 0.1); m.owner = sh;
  sh.startAction('shot', { target: { x: 52, y: 1, z: 0 }, power: 0.9, face: 0 });
  window.__sh = sh;
  const mk = (o) => ({ ...o, copy() {}, set() {} });
  g.rig.setCinematic({ type: 'manual', pos: mk({ x: 0.2, y: 1.1, z: -4.2 }), look: mk({ x: 0.2, y: 0.8, z: 0 }), fov: 36, lam: 100 }); g.rig.snap = true; });
for (let i = 0; i < 10; i++) {
  await p.evaluate(() => window.__golaco.advance(0.05));
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png` });
}
execFileSync('python3', [new URL('./sheet.py', import.meta.url).pathname, dir, out, '5', '100']);
console.log('folha', out + '-sheet.png', '| erros', errs.join('; ') || 'nenhum');
await b.close();
