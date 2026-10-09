// Print do tiro de meta logo na montagem (Regra 16): três adversários dentro da área quando a bola sai pela linha de
// fundo; o print é de 0,3 s depois de a cobrança ser montada (a IA espera para cobrar). Mesma cena nas duas versões.
// node tools/tiro-de-meta-print.mjs --port 8790 --out /pasta/arquivo.png
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', '/tmp/tiro-de-meta.png');
const { browser, page } = await openGame({ w: 1280, h: 720, dpr: 1, port: arg('port', '8790') });
await startMatch(page, { quality: 'alta', timeOfDay: 'dia', userSide: 'none' });
await pumpOn(page);
await page.evaluate(() => window.__golaco.advance(3));
await page.evaluate(() => {
  const m = window.__golaco.game.match, team = m.teams[0], gx = m.ownGoalX(team), s = Math.sign(gx);
  const atk = team.opp.players.filter(p => !p.isGK && !p.sentOff).slice(-3);
  [[11, -6], [8, 3], [13, 9]].forEach(([d, z], i) => atk[i].teleport(gx - s * d, z, s > 0 ? 0 : Math.PI));
  m.ball.place(gx + s * 0.6, 0.11, 6); m.ball.v.x = m.ball.v.z = 0;
  m.stopPlay('out', { type: 'goalkick', team, x: s * (52.5 - 5.5), z: 4 }, 1.2);
});
for (let i = 0; i < 200; i++) { const ok = await page.evaluate(() => window.__golaco.game.match.phase === 'setpiece'); if (ok) break; await stepFrame(page, 1000 / 60, 3); }
await page.evaluate(() => { const m = window.__golaco.game.match; if (m.sp) m.sp.t = -6; });
await stepFrame(page, 1000 / 60, 18);
const info = await page.evaluate(() => {
  const m = window.__golaco.game.match, t = m.sp.team, gx = m.ownGoalX(t);
  const dentro = t.opp.players.filter(q => !q.sentOff && !q.isGK && Math.abs(gx - q.x) < 16.5 && Math.abs(q.z) < 20.16 && Math.sign(q.x) === Math.sign(gx)).length;
  return { fase: m.phase, tipo: m.sp.type, adversariosNaArea: dentro };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: out, timeout: 300000 });
await browser.close();
