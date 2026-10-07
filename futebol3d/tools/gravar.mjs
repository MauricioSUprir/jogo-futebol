// Gravação quadro a quadro com o relógio controlado (método da auditoria): cada quadro anda
// exatamente 1/FPS s de jogo, por mais lento que seja o renderizador; MP4 H.264 no fim.
// Torcida e HUD ficam ligados (nada é escondido).
// node tools/gravar.mjs --cena tv|cel|noite|dia [--seg 20] [--fps 30] [--w 960 --h 540] [--dpr 1]
//      [--mobile 0] [--q alta] [--tod noite] [--port 8790] [--out /pasta/video]
// cena "cel": time da casa controlado por um "dedo" de teste (direcional para o ataque,
// arrancada e passes de tempos em tempos), com os controles de toque na tela.
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const cena = arg('cena', 'tv'), SEG = +arg('seg', 20), FPS = +arg('fps', 30), out = arg('out', '/tmp/video');
const N = Math.round(SEG * FPS);
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const mobile = arg('mobile', cena === 'cel' ? '1' : '0') === '1';
const { browser, page, errors } = await openGame({ w: +arg('w', mobile ? 844 : 960), h: +arg('h', mobile ? 390 : 540), dpr: +arg('dpr', mobile ? 2 : 1), mobile, port: arg('port', '8790') });
await startMatch(page, { quality: arg('q', mobile ? 'media' : 'alta'), timeOfDay: arg('tod', cena === 'dia' ? 'dia' : 'noite'), userSide: cena === 'cel' ? 'home' : 'none' });
await pumpOn(page);
await page.evaluate((s) => window.__golaco.advance(s), +arg('pular', 3));
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  if (cena === 'cel') {
    await page.evaluate((i) => {
      const I = window.__golaco.input, g = window.__golaco.game, m = g.match;
      const me = m.controlled;
      // direcional: para a bola sem a posse; com ela, para o gol adversário (em coordenadas da câmera)
      let tx = 0, tz = 0;
      if (me) {
        const own = m.owner === me;
        const gx = m.goalX(me.team);
        tx = (own ? gx : m.ball.p.x) - me.x; tz = (own ? 0 : m.ball.p.z) - me.z;
      }
      const r = g.rig.right, f = g.rig.fwd, L = Math.hypot(tx, tz) || 1;
      const sx = (tx * r.x + tz * r.z) / L, sy = (tx * f.x + tz * f.z) / L, k = Math.hypot(sx, sy) || 1;
      I.touchStick.id = 99; I.touchStick.x = sx / k; I.touchStick.y = sy / k; I.touchStick.sprint = i % 90 < 60;
      I.touchBtn.pass = i % 75 >= 70;
    }, i);
  }
  await stepFrame(page, 1000 / FPS);
  await page.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88, timeout: 300000 });
  if (i % 60 === 0) console.log(`quadro ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${out}/f%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', `${out}.mp4`]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${out}.mp4`]).toString().trim();
console.log(`vídeo ${out}.mp4: ${N} quadros a ${FPS} qps = ${(+dur).toFixed(1)} s`, errors.length ? 'ERROS: ' + errors.join(' | ') : 'sem erros de página');
