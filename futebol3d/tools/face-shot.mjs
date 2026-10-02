// Print de perto dos rostos dos jogadores (câmera manual na frente da cabeça).
// Uso: node tools/face-shot.mjs [saida-prefixo] [qualidade] [ids separados por vírgula]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const out = process.argv[2] || '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/face';
const q = process.argv[3] || 'alta', ids = (process.argv[4] || '9,10,20,3').split(',').map(Number), semFoto = process.argv[5] === 'semfoto';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 640 } }); await routeCDN(ctx);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(1500);
await p.evaluate(async (q) => {
  const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[1]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[1], ...k, userSide: 'none', noIntro: true, settings: { ...window.__golaco.settings(), quality: q, timeOfDay: 'dia', intro: false } });
}, q);
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 120000 });
await p.evaluate((semFoto) => { const g = window.__golaco.game; if (semFoto) g.players.setFaces(null, new Array(22).fill(-1)); g.paused = true; document.getElementById('hud').style.display = 'none';
  g.stadium.root.traverse(o => { if (o.userData && o.userData.count) o.visible = false; }); }, semFoto);
for (const id of ids) {
  await p.evaluate((id) => {
    const G = window.__golaco, g = G.game, pl = g.match.players[id];
    const h = { x: 0, y: 0, z: 0 }; g.players.headPos(id, h);
    const P = Array.isArray(h) ? { x: h[0], y: h[1], z: h[2] } : h;
    const fx = Math.cos(pl.heading), fz = Math.sin(pl.heading), sx = -fz, sz = fx;
    const pos = { x: P.x + fx * 1.1 + sx * 0.25, y: P.y + 0.03, z: P.z + fz * 1.1 + sz * 0.25 };
    const mk = (o) => ({ ...o, copy() {}, set() {} });
    g.rig.setCinematic({ type: 'manual', pos: mk(pos), look: mk({ x: P.x, y: P.y - 0.02, z: P.z }), fov: 24, lam: 100 });
    g.rig.snap = true;
  }, id);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await p.screenshot({ path: `${out}-${id}.png`, timeout: 240000 });
}
console.log('ok', errs.join('; ') || 'sem erros');
await b.close();
