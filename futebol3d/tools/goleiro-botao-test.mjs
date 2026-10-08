// Botão GOLEIRO no celular (navegador): na defesa o botão aparece; segurado, o goleiro sai e ataca a
// bola; solto, volta ao normal. Celular 844×390 dpr 2, Média, torcida e HUD ligados; tira prints.
// node tools/goleiro-botao-test.mjs [--port 8790] [--out /pasta/prefixo]
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', '/tmp/goleiro-botao');
const { browser, page, errors } = await openGame({ w: 844, h: 390, dpr: 2, mobile: true, port: arg('port', '8790') });
await startMatch(page, { quality: 'media', timeOfDay: 'dia', userSide: 'home' });
await pumpOn(page);
await page.evaluate(() => window.__golaco.advance(2));
// lance: atacante adversário sozinho a 22 m do gol da casa, conduzindo; o resto longe
await page.evaluate(() => {
  const m = window.__golaco.game.match, us = m.userTeam, them = us.opp, gk = us.gk;
  const gx = m.ownGoalX(us), s = Math.sign(gx);
  const A = them.players.find(p => p.role === 'ATT');
  window.__lance = { A: A.idx, gk: gk.idx, gx, s };
  m.phase = 'play';
  for (const q of m.players) { q.action = null; if (q !== A && q !== gk) { q.x = -s * 40 + (q.idx % 5); q.z = (q.idx % 11) * 5 - 25; q.vx = q.vz = 0; } }
  A.x = gx - s * 22; A.z = 3; A.heading = s > 0 ? 0 : Math.PI; A.vx = s * 3;
  gk.x = gx - s * 1.2; gk.z = 0;
  m.ball.place(A.x + s * 0.4, 0.11, A.z); m.takeBall(A, 'control');
  m.setControlled(us.players.find(p => !p.isGK));
});
const parados = () => page.evaluate(() => { const m = window.__golaco.game.match, L = window.__lance; for (const q of m.players) if (q.idx !== L.A && q.idx !== L.gk) { q.stun = 0.3; q.dx = q.dz = 0; } });
for (let i = 0; i < 6; i++) { await parados(); await stepFrame(page, 1000 / 60, 2); }
const estado = () => page.evaluate(() => {
  const m = window.__golaco.game.match, L = window.__lance, gk = m.players[L.gk];
  const b = document.querySelector('.tc-gkrush');
  const r = b && b.getBoundingClientRect();
  return { ctx: document.getElementById('touch')?.dataset.ctx, existe: !!b, visivel: !!b && !b.classList.contains('hide') && r.width > 0, caixa: r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width } : null, rush: !!m.userGKRush, fora: Math.abs(L.gx) - Math.abs(gk.x) };
});
const e0 = await estado();
const linhas = [];
let ok = true;
const c1 = e0.ctx === 'defend' && e0.existe && e0.visivel;
ok = ok && c1;
linhas.push(`${c1 ? 'PASSOU' : 'FALHOU'} | na defesa (contexto "${e0.ctx}") o botão GOLEIRO ${e0.existe ? (e0.visivel ? `aparece (${Math.round(e0.caixa.w)} px)` : 'existe mas está escondido') : 'não existe'}`);
await page.screenshot({ path: `${out}-1-defesa.png`, timeout: 300000 });
if (c1) {
  // segura o botão
  const { x, y } = e0.caixa;
  // toque de verdade (CDP: o navegador cria o ponteiro, como um dedo na tela)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 0; i < 45; i++) { await parados(); await stepFrame(page, 1000 / 60, 2); if (i === 20) await page.screenshot({ path: `${out}-2-goleiro-saindo.png`, timeout: 300000 }); }
  const e1 = await estado();
  const c2 = e1.rush && e1.fora >= 6;
  ok = ok && c2;
  linhas.push(`${c2 ? 'PASSOU' : 'FALHOU'} | segurando o botão: comando de saída ${e1.rush ? 'ligado' : 'DESLIGADO'}, goleiro a ${e1.fora.toFixed(1)} m da linha depois de 1,5 s (alvo ≥ 6 m)`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await stepFrame(page, 1000 / 60, 4);
  const e2 = await estado();
  const c3 = !e2.rush;
  ok = ok && c3;
  linhas.push(`${c3 ? 'PASSOU' : 'FALHOU'} | soltou o botão: comando de saída ${e2.rush ? 'continua LIGADO' : 'desligado'}`);
}
if (errors.length) { ok = false; linhas.push('FALHOU | erros na página: ' + errors.join(' | ')); }
await browser.close();
for (const l of linhas) console.log(l);
process.exit(ok ? 0 : 1);
