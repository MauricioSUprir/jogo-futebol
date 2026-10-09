// Prints das bolas paradas (antes/depois): tiro de meta, escanteio, lateral (bola nas mãos) e goleiro
// segurando a bola. PC 1280×720 Alta, dia, torcida e HUD ligados. Em cada lance a cobrança da IA é
// adiada uns segundos (sp.t negativo) para os times se arrumarem — vale igual para as duas versões.
// node tools/bola-parada-prints.mjs [--port 8790] [--out /pasta/prefixo]
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', '/tmp/bola-parada');
const { browser, page, errors } = await openGame({ w: 1280, h: 720, dpr: 1, port: arg('port', '8790') });
await startMatch(page, { quality: 'alta', timeOfDay: 'dia', userSide: 'none' });
await pumpOn(page);
await page.evaluate(() => window.__golaco.advance(3));
const lance = async (nome, prep, espera, cam, bolaParada = true) => {
  await page.evaluate(prep);
  // até a bola parada começar; adia a cobrança para os times se arrumarem
  for (let i = 0; i < 40 && bolaParada; i++) { const ok = await page.evaluate(() => window.__golaco.game.match.phase === 'setpiece'); if (ok) break; await page.evaluate(() => window.__golaco.advance(0.1)); }
  await page.evaluate((e) => { const m = window.__golaco.game.match; if (m.sp) m.sp.t = -e; }, espera);
  await page.evaluate((e) => window.__golaco.advance(e), espera - 0.4);
  if (cam) await page.evaluate(cam);
  await stepFrame(page, 1000 / 60, 24);
  await page.screenshot({ path: `${out}-${nome}.png`, timeout: 300000 });
  const info = await page.evaluate(() => { const m = window.__golaco.game.match; return { fase: m.phase, sp: m.sp && m.sp.type }; });
  console.log(nome, JSON.stringify(info));
  // devolve a partida ao jogo
  await page.evaluate(() => { const m = window.__golaco.game.match; const g = window.__golaco.game; g.rig.setCinematic(null); if (m.sp) m.sp.t = 99; });
  await page.evaluate(() => window.__golaco.advance(4));
};
const HL = 52.5, HW = 34;
// tiro de meta do time da casa
await lance('tiro-de-meta', () => { const m = window.__golaco.game.match; m.phase = 'play'; const t = m.teams[0]; m.stopPlay('out', { type: 'goalkick', team: t, x: Math.sign(m.ownGoalX(t)) * 47, z: 4 }, 0.3); }, 4.5);
// escanteio a favor da casa
await lance('escanteio', () => { const m = window.__golaco.game.match; m.phase = 'play'; const t = m.teams[0]; m.stopPlay('out', { type: 'corner', team: t, x: Math.sign(m.goalX(t)) * 52.5, z: 34 }, 0.3); }, 9);
// lateral: câmera perto do cobrador
const pertoDe = (quem) => `(() => { const g = window.__golaco.game, m = g.match; const p = ${quem}; if (!p) return; const mk = (o) => ({ ...o, copy() {}, set() {} });
  const fx = Math.cos(p.heading), fz = Math.sin(p.heading);
  g.rig.setCinematic({ type: 'manual', pos: mk({ x: p.x + fx * 3.2 - fz * 1.6, y: 1.9, z: p.z + fz * 3.2 + fx * 1.6 }), look: mk({ x: p.x, y: 1.5, z: p.z }), fov: 40, lam: 1000 }); g.rig.snap = true; })()`;
await lance('lateral', () => { const m = window.__golaco.game.match; m.phase = 'play'; const t = m.teams[0]; m.stopPlay('out', { type: 'throwin', team: t, x: 8, z: 34 }, 0.3); }, 2.5,
  pertoDe('m.sp && m.sp.taker'));
// goleiro com a bola nas mãos
await lance('goleiro', () => { const m = window.__golaco.game.match; m.phase = 'play'; m.sp = null; const gk = m.teams[1].gk; gk.action = null; m.owner = null; m.ball.place(gk.x + 0.5, 1, gk.z); m.gkCatch(gk); }, 1.0,
  pertoDe('m.teams[1].gk'), false);
await browser.close();
if (errors.length) console.log('ERROS:', errors.join(' | '));
