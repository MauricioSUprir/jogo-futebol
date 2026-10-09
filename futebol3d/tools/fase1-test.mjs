// Fase 1 da auditoria — testes que REPROVAM (saída 1):
//  1. Bola desenhada no mesmo instante dos jogadores: |bola desenhada − posição real da bola
//     no instante do quadro (interpolada entre os passos da física)| ≤ 1 cm a 60/120/144 Hz.
//  2. Analógico com zona morta radial: direção preservada (erro ≤ 2°) e diagonal sutil
//     (|v| = 0,17) registrada.
//  3. Tremor de câmera dependente do tempo, não do FPS: deslocamento no mesmo instante a 60 e
//     a 144 Hz difere ≤ 10% da amplitude, e nenhum salto entre quadros > 15% da amplitude.
// node tools/fase1-test.mjs [--port 8790]
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const port = arg('port', '8790');
let ok = true;
const check = (nome, cond, info) => { console.log(`${cond ? 'PASSOU' : 'FALHOU'} | ${nome} | ${info}`); if (!cond) ok = false; };

const { browser, page, errors } = await openGame({ w: 640, h: 360, port });
await startMatch(page, { quality: 'baixa', userSide: 'none' });
await pumpOn(page);
await page.evaluate(() => window.__golaco.advance(4));
await stepFrame(page, 1000 / 60, 30);

// ---------- 1. interpolação da bola
await page.evaluate(() => {
  const g = window.__golaco.game, m = g.match;
  window.__bp = { ...m.ball.p }; window.__bc = { ...m.ball.p };
  const st = m.step.bind(m);
  m.step = (...a) => { window.__bp = { ...m.ball.p }; const r = st(...a); window.__bc = { ...m.ball.p }; return r; };
});
// (espera a bola rolar antes de medir: com a partida parada — falta, lateral ou tiro de meta logo no começo, ~15% das
// partidas nas duas versões entre 4,5 e 7 s — os 90 quadros saíam sem bola em jogo e o teste reprovava por sorteio)
const rolando = () => page.evaluate(() => { const m = window.__golaco.game.match; return m.phase === 'play' && !m.ball.held && !m.ball.inNet && Math.hypot(m.ball.v.x, m.ball.v.z) > 1; });
for (const hz of [60, 120, 144]) {
  let worst = 0, n = 0, speed = 0, vsum = 0;
  for (let i = 0; i < 1200 && !(await rolando()); i++) await stepFrame(page, 1000 / 60);
  for (let i = 0; i < 90; i++) {
    await stepFrame(page, 1000 / hz);
    const r = await page.evaluate(() => {
      const g = window.__golaco.game, m = g.match;
      if (m.phase !== 'play' || m.ball.held || m.ball.inNet) return null;
      const STEP = 1 / 60, a = Math.min(1, Math.max(0, g.acc / STEP));
      const P = window.__bp, C = window.__bc, d = g.ball.mesh.position;
      const ex = P.x + (C.x - P.x) * a, ey = P.y + (C.y - P.y) * a, ez = P.z + (C.z - P.z) * a;
      return { err: Math.hypot(d.x - ex, d.y - ey, d.z - ez), v: Math.hypot(m.ball.v.x, m.ball.v.z) };
    });
    if (!r) continue;
    n++; vsum += r.v; if (r.err >= worst) { worst = r.err; speed = r.v; }
  }
  // a bola tem que estar andando, senão o teste não prova nada
  check(`bola no instante certo a ${hz} Hz`, n > 20 && vsum / n > 1 && worst <= 0.01, `pior desvio ${(worst * 100).toFixed(1)} cm (bola a ${speed.toFixed(1)} m/s; média ${(vsum / Math.max(1, n)).toFixed(1)} m/s), ${n} quadros`);
}

// ---------- 2. zona morta radial
const casos = [[0.9, 0.15], [0.7, 0.7], [0.3, 0.95], [-0.5, 0.25], [0.12, 0.12]];
const st = await page.evaluate((casos) => {
  const I = window.__golaco.input;
  const out = [];
  for (const [x, y] of casos) {
    navigator.getGamepads = () => [{ axes: [x, y, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
    I.padIndex = 0;
    const c = I.poll({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    out.push({ x, y, sx: c.sx, sy: c.sy });
  }
  I.padIndex = null;
  return out;
}, casos);
let angErr = 0; let diag = null;
for (const c of st) {
  const mag = Math.hypot(c.sx, c.sy);
  if (c.x === 0.12) { diag = mag; continue; }
  const want = Math.atan2(-c.y, c.x), got = Math.atan2(c.sy, c.sx);
  let d = Math.abs(want - got); if (d > Math.PI) d = 2 * Math.PI - d;
  angErr = Math.max(angErr, d * 180 / Math.PI);
}
check('analógico preserva a direção', angErr <= 2, `maior erro de ângulo ${angErr.toFixed(1)}° (casos ${JSON.stringify(casos.slice(0, 4))})`);
check('diagonal sutil (|v| = 0,17) registrada', diag > 0.005, `saída ${diag.toFixed(3)}`);

// ---------- 3. tremor de câmera
async function shakeRun(hz) {
  return page.evaluate(async (hz) => {
    const g = window.__golaco.game, rig = g.rig;
    g.paused = true;
    rig.setCinematic({ type: 'manual', pos: { x: 0, y: 12, z: -30 }, look: { x: 0, y: 0, z: 0 }, fov: 40, lam: 1000 }); rig.snap = true;
    window.__pump.step(1000 / 60);
    rig.t = 10; rig.shake = 1;
    const samples = [];
    for (let i = 0; i < Math.round(hz * 0.5); i++) {
      window.__pump.step(1000 / hz);
      const c = g.camera.position;
      samples.push({ t: (i + 1) / hz, dx: c.x - rig.pos.x, dy: c.y - rig.pos.y, amp: rig.shake });
    }
    rig.shake = 0; rig.setCinematic(null); g.paused = false;
    return samples;
  }, hz);
}
const s60 = await shakeRun(60), s144 = await shakeRun(144);
let jump = 0;
for (let i = 1; i < s144.length; i++) jump = Math.max(jump, Math.hypot(s144[i].dx - s144[i - 1].dx, s144[i].dy - s144[i - 1].dy) / Math.max(1e-6, s144[i].amp));
let diff = 0;
for (const a of s60) {
  const b = s144.reduce((p, c) => (Math.abs(c.t - a.t) < Math.abs(p.t - a.t) ? c : p));
  if (Math.abs(b.t - a.t) > 0.004) continue;
  diff = Math.max(diff, Math.hypot(a.dx - b.dx, a.dy - b.dy) / Math.max(1e-6, a.amp));
}
check('tremor igual a 60 e 144 Hz', diff <= 0.1, `maior diferença ${(diff * 100).toFixed(0)}% da amplitude`);
check('tremor sem saltos', jump <= 0.15, `maior salto entre quadros a 144 Hz ${(jump * 100).toFixed(0)}% da amplitude`);

if (errors.length) check('sem erros de página', false, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(ok ? 'FASE 1: TODOS PASSARAM' : 'FASE 1: HÁ FALHAS');
process.exit(ok ? 0 : 1);
