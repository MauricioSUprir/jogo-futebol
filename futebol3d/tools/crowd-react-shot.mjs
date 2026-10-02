// Prints da torcida reagindo e dos fotógrafos dentro do jogo de verdade.
// Uso: node tools/crowd-react-shot.mjs <prefixo> [--q media] [--tod noite] [--only tv-repouso,foto-oeste]
// Cenários: tv-repouso, tv-ataque, tv-chance, tv-gol, tv-gol2, tv-ola, foto-oeste, foto-leste, foto-perto, foto-flash
// Servidor: python3 -m http.server 8790 em futebol3d/.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = process.argv[2] || '/tmp/torcida';
const q = arg('q', 'media'), tod = arg('tod', 'noite');
const only = arg('only', '');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: +arg('w', 1280), height: +arg('h', 720) } });
await routeCDN(ctx);
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await p.goto('http://localhost:8790/index.html');
await p.waitForTimeout(2000);
await p.evaluate(async ({ q, tod }) => {
  const T = await import('./js/teams.js');
  const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'none',
    settings: { ...window.__golaco.settings(), quality: q, timeOfDay: tod, intro: false, halfMinutes: 30 } });
}, { q, tod });
await p.waitForTimeout(2500);
// ganchos: excitação forçada e câmera fixa
await p.evaluate(() => {
  const g = window.__golaco.game;
  const su = g.stadium.update;
  g.stadium.update = function (dt, t, e, c) { return su.call(this, dt, t, window.__exc ?? e, c); };
  const ru = g.rig.update.bind(g.rig);
  g.rig.update = (...a) => {
    ru(...a);
    const o = window.__cam;
    if (o) { const c = g.camera; c.position.set(...o.pos); c.fov = o.fov ?? c.fov; c.updateProjectionMatrix(); c.lookAt(...o.look); c.updateMatrixWorld(); }
  };
});
// espera passar `s` segundos do relógio do jogo (g.t), não do relógio de parede
async function waitGame(s) {
  const t0 = await p.evaluate(() => window.__golaco.game.t);
  await p.waitForFunction((tt) => window.__golaco.game.t >= tt, t0 + s, { timeout: 300000, polling: 200 });
}
const info = () => p.evaluate(() => { const r = window.__golaco.renderer.info.render, g = window.__golaco.game; return { calls: r.calls, tris: r.triangles, fps: +g.fps.toFixed(1), t: +g.t.toFixed(1) }; });
async function shot(name) {
  const f = `${out}-${name}.png`;
  await p.screenshot({ path: f, timeout: 300000 });
  console.log('ok', f, JSON.stringify(await info()));
}
const want = (n) => !only || only.split(',').includes(n);
const TV = { pos: [0, 19, -62], look: [0, 4, 18], fov: 42 };
const set = (o) => p.evaluate((o) => { window.__cam = o.cam; window.__exc = o.exc; }, o);
const react = (kind, side) => p.evaluate(({ kind, side }) => { const g = window.__golaco.game; g.stadium.crowdReact(kind, side); if (kind === 'goal') g.fx?.goal(side, side === 'home' ? ['#111111', '#1db954'] : ['#ffffff', '#c8102e'], 1); if (kind === 'chance') g.fx?.chance(); }, { kind, side });

if (want('tv-real')) { await set({ cam: null, exc: 0.9 }); await react('goal', 'home'); await waitGame(1.5); await shot('tv-real'); }
if (want('tv-repouso')) { await set({ cam: TV, exc: 0.15 }); await waitGame(3); await shot('tv-repouso'); }
if (want('tv-ataque')) { await set({ cam: TV, exc: 0.95 }); await waitGame(4); await shot('tv-ataque'); }
if (want('tv-chance')) { await set({ cam: TV, exc: 0.7 }); await react('chance', 'home'); await waitGame(1.1); await shot('tv-chance'); }
if (want('tv-gol')) { await set({ cam: TV, exc: 0.9 }); await react('goal', 'home'); await waitGame(1.4); await shot('tv-gol'); await waitGame(1.0); await shot('tv-gol2'); }
if (want('tv-fundo')) { await set({ cam: { pos: [20, 16, -50], look: [-60, 8, 0], fov: 40 }, exc: 0.9 }); await react('goal', 'home'); await waitGame(1.6); await shot('tv-fundo'); }
if (want('tv-ola')) { await set({ cam: { pos: [0, 30, -20], look: [0, 10, 50], fov: 60 }, exc: 0.4 }); await p.evaluate(() => window.__golaco.game.stadium.crowdWave?.()); await waitGame(4); await shot('tv-ola'); }
if (want('foto-oeste')) { await set({ cam: { pos: [-44, 4, -9], look: [-56, 0.8, 4], fov: 45 }, exc: 0.3 }); await waitGame(1.5); await shot('foto-oeste'); }
if (want('foto-perto')) { await set({ cam: { pos: [-53, 1.6, 4], look: [-56.5, 0.7, 9], fov: 45 }, exc: 0.3 }); await waitGame(1.5); await shot('foto-perto'); }
if (want('foto-leste')) { await set({ cam: { pos: [40, 6, 12], look: [56, 0.5, -2], fov: 50 }, exc: 0.3 }); await waitGame(1.5); await shot('foto-leste'); }
if (want('foto-flash')) { await set({ cam: { pos: [-44, 4, -9], look: [-56, 0.8, 4], fov: 45 }, exc: 0.9 }); await react('goal', 'home'); await waitGame(0.5); await shot('foto-flash'); }
console.log('erros', errs.length ? errs.slice(0, 20).join('\n') : 'nenhum');
await b.close();
