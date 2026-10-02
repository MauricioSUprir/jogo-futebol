// Prints da torcida e dos fotógrafos com o RELÓGIO DO ESTÁDIO controlado pelo script
// (no SwiftShader cada quadro leva segundos; esperar o relógio do jogo não dá).
// Uso: node tools/torcida-shot.mjs <prefixo> [--q media] [--tod noite] [--only tv-repouso,foto-oeste] [--w 1280 --h 720]
// Cenários: tv-bandeirao, tv-repouso, tv-ataque, tv-canto, tv-chance, tv-lamento, tv-gol, tv-gol2, tv-visit, tv-ola, tv-ola2,
//           foto-oeste, foto-perto, foto-leste, foto-flash, foto-alto
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
await p.goto('http://localhost:' + (arg('port', '8790')) + '/index.html');
await p.waitForTimeout(2000);
await p.evaluate(async ({ q, tod }) => {
  const T = await import('./js/teams.js');
  const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'none',
    settings: { ...window.__golaco.settings(), quality: q, timeOfDay: tod, intro: false, halfMinutes: 30 } });
}, { q, tod });
await p.waitForTimeout(2500);
// ganchos: relógio do estádio/efeitos, excitação e câmera fixos
await p.evaluate(() => {
  const g = window.__golaco.game;
  window.__T = 100;
  const su = g.stadium.update;
  let crowd = null;
  g.stadium.root.traverse((o) => { if (o.name === 'torcida') crowd = o; });
  g.stadium.update = function (dt, t, e, c) {
    const r = su.call(this, 0.016, window.__T, window.__exc ?? e, c);
    if (crowd && window.__exc != null) crowd.userData.uniforms.uExc.value = window.__exc;
    return r;
  };
  if (g.fx) {
    const fu = g.fx.update.bind(g.fx);
    g.fx.update = (dt, c) => { g.fx.time = window.__T; fu(0, c); };
  }
  const ru = g.rig.update.bind(g.rig);
  g.rig.update = (...a) => {
    ru(...a);
    const o = window.__cam;
    if (o) { const c = g.camera; c.position.set(...o.pos); c.fov = o.fov ?? c.fov; c.updateProjectionMatrix(); c.lookAt(...o.look); c.updateMatrixWorld(); }
  };
});
const frames = (n = 2) => p.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const setT = async (t) => { await p.evaluate((t) => { window.__T = t; }, t); await frames(2); };
const addT = async (d) => { const t = await p.evaluate(() => window.__T); await setT(t + d); };
const info = () => p.evaluate(() => { const r = window.__golaco.renderer.info.render; return { calls: r.calls, tris: r.triangles, T: window.__T }; });
async function shot(name) {
  const f = `${out}-${name}.png`;
  await p.screenshot({ path: f, timeout: 300000 });
  console.log('ok', f, JSON.stringify(await info()));
}
const want = (n) => !only || only.split(',').includes(n);
const TV = { pos: [0, 19, -62], look: [0, 4, 18], fov: 42 };
let T0 = 100;
// cada cenário começa num instante "limpo" (longe das reações anteriores)
const fresh = async (cam, exc) => { T0 += 60; await p.evaluate((o) => { window.__cam = o.cam; window.__exc = o.exc; }, { cam, exc }); await setT(T0); };
const react = (kind, side) => p.evaluate(({ kind, side }) => {
  const g = window.__golaco.game; g.stadium.crowdReact(kind, side);
  if (kind === 'goal') g.fx?.goal(side, side === 'home' ? ['#111111', '#1db954'] : ['#ffffff', '#c8102e'], -1);
  if (kind === 'chance') g.fx?.chance();
}, { kind, side });

if (want('tv-repouso')) { await fresh(TV, 0.15); await addT(3); await shot('tv-repouso'); }
if (want('tv-ataque')) { await fresh(TV, 0.95); await addT(4); await shot('tv-ataque'); }
if (want('tv-canto')) { await fresh(TV, 0.6); await p.evaluate(() => { const s = window.__golaco.game.stadium; s.crowdChant?.('home', 1, 40); s.crowdChant?.('away', 1, 40); }); await addT(0.5); await addT(0.5); await addT(0.5); await addT(0.5); await addT(0.5); await addT(0.5); await addT(1.2); await shot('tv-canto'); await addT(0.23); await shot('tv-canto2'); }
if (want('tv-chance')) { await fresh(TV, 0.7); await react('chance', 'home'); await addT(1.2); await shot('tv-chance'); }
if (want('tv-lamento')) { await fresh(TV, 0.7); await react('chance', 'home'); await addT(2.2); await shot('tv-lamento'); }
if (want('tv-gol')) { await fresh(TV, 0.9); await react('goal', 'home'); await addT(1.4); await shot('tv-gol'); await addT(0.25); await shot('tv-gol2'); }
if (want('tv-visit')) { await fresh({ pos: [20, 16, -50], look: [70, 6, 0], fov: 40 }, 0.9); await react('goal', 'away'); await addT(1.5); await shot('tv-visit'); }
if (want('tv-ola')) {
  await fresh(TV, 0.15);
  await p.evaluate(() => { const s = window.__golaco.game.stadium; s.crowdChant?.('home', 0, 60); s.crowdChant?.('away', 0, 60); });
  for (let i = 0; i < 5; i++) await addT(0.5);
  // sentido +1: a frente sai do fundo oeste e passa no meio da lateral norte em ~7,4 s
  await p.evaluate(() => window.__golaco.game.stadium.crowdWave?.(1, 1));
  await addT(3.5); await shot('tv-ola'); await addT(1.6); await shot('tv-ola2');
}
if (want('medir')) {
  // chamadas de desenho com e sem as peças novas (fotógrafos, bandeirão), mesma câmera
  const cams = { tv: TV, fundo: { pos: [-44, 4, -9], look: [-56, 0.8, 4], fov: 45 } };
  for (const [k, cam] of Object.entries(cams)) {
    await fresh(cam, 0.6);
    await p.evaluate(() => window.__golaco.game.stadium.crowdChant?.('home', 1, 40));
    for (let i = 0; i < 6; i++) await addT(0.5);
    const com = await info();
    await p.evaluate(() => window.__golaco.game.stadium.root.traverse((o) => { if (o.name === 'fotografos' || o.name === 'bandeirao') o.visible = false; }));
    await addT(0.1);
    const sem = await info();
    await p.evaluate(() => window.__golaco.game.stadium.root.traverse((o) => { if (o.name === 'fotografos' || o.name === 'bandeirao') o.visible = true; }));
    console.log('medir', k, 'com', JSON.stringify(com), 'sem', JSON.stringify(sem));
  }
}
if (want('tv-bandeirao')) {
  await fresh({ pos: [-8, 17, -48], look: [-66, 6, 0], fov: 42 }, 0.6);
  await p.evaluate(() => window.__golaco.game.stadium.crowdChant?.('home', 1, 40));
  for (let i = 0; i < 8; i++) await addT(0.5);
  await shot('tv-bandeirao'); await addT(0.4); await shot('tv-bandeirao2');
}
if (want('foto-oeste')) { await fresh({ pos: [-44, 4, -9], look: [-56, 0.8, 4], fov: 45 }, 0.3); await addT(1.5); await shot('foto-oeste'); }
if (want('foto-perto')) { await fresh({ pos: [-52.5, 1.5, 4.5], look: [-56, 0.8, 10], fov: 45 }, 0.3); await addT(1.5); await shot('foto-perto'); }
if (want('foto-leste')) { await fresh({ pos: [40, 6, 12], look: [56, 0.5, -2], fov: 50 }, 0.3); await addT(1.5); await shot('foto-leste'); }
if (want('foto-alto')) { await fresh(TV, 0.3); await p.evaluate(() => { window.__cam = { pos: [-30, 12, -40], look: [-56, 0, -5], fov: 30 }; }); await addT(1); await shot('foto-alto'); }
if (want('foto-flash')) { await fresh({ pos: [-44, 4, -9], look: [-56, 0.8, 4], fov: 45 }, 0.9); await react('goal', 'home'); await addT(0.6); await shot('foto-flash'); }
console.log('erros', errs.length ? errs.slice(0, 20).join('\n') : 'nenhum');
await b.close();
