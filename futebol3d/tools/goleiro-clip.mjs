// Vídeo do botão GOLEIRO no celular (prova): 3 lances de cara a cara; em cada um o "dedo" de teste segura
// o botão GOLEIRO (toque real pelo CDP) e o goleiro sai e ataca a bola. Celular 844×390, Média, dia,
// torcida e HUD ligados, controles de toque visíveis; quadro a quadro com relógio controlado.
// node tools/goleiro-clip.mjs [--seg 21] [--fps 30] [--port 8790] [--out /pasta/video]
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEG = +arg('seg', 21), FPS = +arg('fps', 30), out = arg('out', '/tmp/goleiro-clip');
const N = Math.round(SEG * FPS), LANCE = 7;          // um lance a cada 7 s
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const { browser, page, errors } = await openGame({ w: 844, h: 390, dpr: 1, mobile: true, port: arg('port', '8790') });
await startMatch(page, { quality: 'media', timeOfDay: 'dia', userSide: 'home' });
await pumpOn(page);
await page.evaluate(() => window.__golaco.advance(2));
const cdp = await page.context().newCDPSession(page);
const prepara = (k) => page.evaluate((k) => {
  const m = window.__golaco.game.match, us = m.userTeam, them = us.opp, gk = us.gk;
  const gx = m.ownGoalX(us), s = Math.sign(gx);
  const atts = them.players.filter(p => !p.sentOff && !p.isGK && (p.role === 'ATT' || p.role === 'MID'));
  const A = atts[k % atts.length];
  window.__lance = { A: A.idx, gk: gk.idx, gx, s };
  m.phase = 'play'; m.sp = null;
  for (const q of m.players) { q.action = null; q.stun = 0; if (q !== A && q !== gk) { q.x = -s * 40 + (q.idx % 5); q.z = (q.idx % 11) * 5 - 25; q.vx = q.vz = 0; } }
  A.x = gx - s * (21 + k * 1.5); A.z = [4, -6, 1][k % 3]; A.heading = s > 0 ? 0 : Math.PI; A.vx = s * 4; A.vz = 0;
  gk.x = gx - s * 1.2; gk.z = 0; gk.vx = gk.vz = 0; gk.holdingBall = false;
  m.holder = null; m.ball.held = false;
  m.ball.place(A.x + s * 0.4, 0.11, A.z); m.ball.v.x = m.ball.v.z = m.ball.v.y = 0; m.takeBall(A, 'control');
  m.setControlled(us.players.find(p => !p.isGK));
}, k);
const parados = () => page.evaluate(() => { const m = window.__golaco.game.match, L = window.__lance; for (const q of m.players) if (q.idx !== L.A && q.idx !== L.gk) { q.stun = 0.3; q.dx = q.dz = 0; } });
const caixa = () => page.evaluate(() => { const b = document.querySelector('.tc-gkrush'); if (!b || b.classList.contains('hide')) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
let segurando = false, lance = -1;
const t0 = Date.now(), log = [];
for (let i = 0; i < N; i++) {
  const t = i / FPS, k = Math.floor(t / LANCE), tl = t - k * LANCE;
  if (k !== lance) {
    if (segurando) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); segurando = false; }
    lance = k; await prepara(k);
  }
  await parados();
  // segura o botão de 0,6 s a 4,5 s de cada lance
  if (!segurando && tl >= 0.6 && tl < 4.5) { const c = await caixa(); if (c) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1 }] }); segurando = true; log.push(`${t.toFixed(1)} s aperta GOLEIRO`); } }
  if (segurando && tl >= 4.5) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); segurando = false; log.push(`${t.toFixed(1)} s solta`); }
  await stepFrame(page, 1000 / FPS);
  await page.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88, timeout: 300000 });
  const ev = await page.evaluate(() => { const m = window.__golaco.game.match, L = window.__lance, gk = m.players[L.gk]; return { gkTem: m.owner === gk || m.holder === gk, gol: m.phase === 'goal', fora: Math.abs(L.gx) - Math.abs(gk.x) }; });
  if (ev.gkTem && !log.includes(`lance ${k}: goleiro com a bola`)) log.push(`lance ${k}: goleiro com a bola`, `${t.toFixed(1)} s (goleiro a ${ev.fora.toFixed(1)} m da linha)`);
  if (ev.gol && !log.includes(`lance ${k}: gol`)) log.push(`lance ${k}: gol`, `${t.toFixed(1)} s`);
  if (i % 60 === 0) console.log(`quadro ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${out}/f%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', `${out}.mp4`]);
console.log('lances:', log.join(' | '));
console.log(`vídeo ${out}.mp4: ${N} quadros a ${FPS} qps`, errors.length ? 'ERROS: ' + errors.join(' | ') : 'sem erros de página');
