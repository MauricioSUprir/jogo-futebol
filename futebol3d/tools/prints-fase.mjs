// Prints de prova (auditoria, prova 3), com torcida e HUD ligados:
//   pc-dia / pc-noite      1280×720, qualidade Alta
//   cel-dia / cel-noite    844×390, dpr 2, celular, qualidade Média
//   rosto                  close de rosto e pescoço (1280×720 Alta, dia)
// Relógio controlado: mesmos lances em todas as versões (antes/depois).
// node tools/prints-fase.mjs --port 8790 --out /pasta/prefixo [--pular 8]
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const port = arg('port', '8790'), out = arg('out', '/tmp/print'), pular = +arg('pular', 8);
const casos = [
  { nome: 'pc-dia', w: 1280, h: 720, dpr: 1, mobile: false, q: 'alta', tod: 'dia' },
  { nome: 'pc-noite', w: 1280, h: 720, dpr: 1, mobile: false, q: 'alta', tod: 'noite' },
  { nome: 'cel-dia', w: 844, h: 390, dpr: 2, mobile: true, q: 'media', tod: 'dia' },
  { nome: 'cel-noite', w: 844, h: 390, dpr: 2, mobile: true, q: 'media', tod: 'noite' },
  { nome: 'rosto', w: 1280, h: 720, dpr: 1, mobile: false, q: 'alta', tod: 'dia', rosto: true },
];
const so = arg('so', null);
for (const c of casos) {
  if (so && !so.split(',').includes(c.nome)) continue;
  const { browser, page, errors } = await openGame({ w: c.w, h: c.h, dpr: c.dpr, mobile: c.mobile, port });
  await startMatch(page, { quality: c.q, timeOfDay: c.tod, userSide: c.mobile ? 'home' : 'none' });
  await pumpOn(page);
  if (c.mobile) {
    // o time do jogador espera o passe para dar a saída: aperta pelo comando da partida
    await page.evaluate(() => window.__golaco.advance(1));
    await page.evaluate(() => window.__golaco.advance(0.1, () => ({ mx: 0, mz: 0, held: { pass: true }, press: { pass: true }, release: {}, hold: {}, rx: 0, rz: 0 })));
    await page.evaluate(() => window.__golaco.advance(0.3, () => ({ mx: 0, mz: 0, held: {}, press: {}, release: { pass: true }, hold: { pass: 0.1 }, rx: 0, rz: 0 })));
  }
  await page.evaluate((s) => window.__golaco.advance(s), pular);
  await stepFrame(page, 1000 / 60, 20);
  if (c.rosto) {
    await page.evaluate(() => {
      const g = window.__golaco.game, m = g.match;
      // o jogador mais perto da bola, de frente, enquadrando rosto e pescoço
      const pl = m.players.reduce((a, p) => (Math.hypot(p.x - m.ball.p.x, p.z - m.ball.p.z) < Math.hypot(a.x - m.ball.p.x, a.z - m.ball.p.z) ? p : a));
      g.paused = true;
      const h = { x: 0, y: 0, z: 0 }; g.players.headPos(pl.idx, h);
      const fx = Math.cos(pl.heading), fz = Math.sin(pl.heading);
      const mk = (o) => ({ ...o, copy() {}, set() {} });
      g.rig.setCinematic({ type: 'manual', pos: mk({ x: h.x + fx * 1.25 - fz * 0.3, y: h.y - 0.05, z: h.z + fz * 1.25 + fx * 0.3 }), look: mk({ x: h.x, y: h.y - 0.12, z: h.z }), fov: 26, lam: 1000 });
      g.rig.snap = true;
    });
    await stepFrame(page, 1000 / 60, 3);
  }
  await page.screenshot({ path: `${out}-${c.nome}.png`, timeout: 300000 });
  console.log(`${out}-${c.nome}.png`, errors.length ? 'ERROS: ' + errors.join(' | ') : 'ok');
  await browser.close();
}
