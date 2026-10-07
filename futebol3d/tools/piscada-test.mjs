// Teste de piscada (prova 6 da auditoria): grava N quadros com o relógio controlado a F qps
// (o FPS baixo força a resolução dinâmica a mudar), monta o MP4 e REPROVA (saída 1) se
// algum quadro estiver vazio (canvas apagado → cor única escura do fundo da página).
// node tools/piscada-test.mjs [--frames 300] [--fps 30] [--q media] [--w 844 --h 390 --dpr 2] [--port 8790] [--out pasta]
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('frames', 300), FPS = +arg('fps', 30), out = arg('out', '/tmp/piscada');
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const { browser, page, errors } = await openGame({ w: +arg('w', 844), h: +arg('h', 390), dpr: +arg('dpr', 2), mobile: arg('mobile', '1') === '1', port: arg('port', '8790') });
await startMatch(page, { quality: arg('q', 'media'), timeOfDay: arg('tod', 'dia') });
// --inicio alta: no modo auto, começa num preset pesado para forçar a queda automática de preset
if (arg('inicio', null)) await page.evaluate((k) => window.__golaco.setPreset(k), arg('inicio', null));
await pumpOn(page);
// dá a saída (o jogo espera o toque do jogador) para o teste rodar com a bola em jogo
await page.evaluate(() => { window.__golaco.input.touchBtn.pass = true; });
await stepFrame(page, 1000 / FPS, 2);
await page.evaluate(() => { window.__golaco.input.touchBtn.pass = false; });
const dyn = [], apagados = [];
for (let i = 0; i < N; i++) {
  // um quadro do jogo e, no MESMO instante em que ele termina, os pixels do canvas: se a
  // resolução foi trocada depois do desenho, o buffer está apagado (tudo zero) — é o quadro
  // que a GPU de verdade mostra vazio
  const px = await page.evaluate((ms) => {
    window.__pump.step(ms);
    const gl = window.__golaco.renderer.getContext(), c = gl.canvas;
    const w = 24, h = 24, buf = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels((c.width / 2 - w / 2) | 0, (c.height / 2 - h / 2) | 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let s = 0; for (let k = 0; k < buf.length; k += 4) s += buf[k] + buf[k + 1] + buf[k + 2];
    if (s === 0) {
      // o print do Playwright recompõe a página e esconderia a falha: mostra no vídeo
      // exatamente o que o canvas tem no fim deste quadro (copiado agora, antes de qualquer
      // outro desenho), por cima do canvas
      const img = new Image(); img.src = c.toDataURL(); img.id = '__quadro';
      const r = c.getBoundingClientRect();
      Object.assign(img.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: 0, pointerEvents: 'none' });
      c.after(img);
    }
    return s;
  }, 1000 / FPS);
  if (px === 0) { apagados.push(i); await page.waitForFunction(() => document.getElementById('__quadro')?.complete, null, { polling: 50 }); }
  await page.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 85, timeout: 300000 });
  if (px === 0) await page.evaluate(() => document.getElementById('__quadro').remove());
  if (i % 15 === 0) dyn.push(await page.evaluate(() => window.__golaco.renderer.getPixelRatio().toFixed(2) + (window.__golaco.preset ? '/' + window.__golaco.preset() : '')));
}
await browser.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${out}/f%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', `${out}.mp4`]);
console.log('pixel ratio ao longo do teste (a cada 15 quadros):', dyn.join(' '));
console.log(`canvas apagado ao fim do quadro: ${apagados.length}`, apagados.length ? '→ quadros ' + apagados.join(', ') : '');
let res;
try { res = execFileSync('python3', [new URL('./quadros-vazios.py', import.meta.url).pathname, out]).toString(); console.log(res.trim()); }
catch (e) { console.log(e.stdout.toString().trim()); console.log('FALHOU: há quadros vazios'); process.exit(1); }
if (apagados.length) { console.log('FALHOU: canvas apagado (piscada) em', apagados.length, 'quadros'); process.exit(1); }
if (errors.length) { console.log('FALHOU: erros de página', errors); process.exit(1); }
console.log('PASSOU: nenhum quadro vazio em', N, 'quadros; vídeo', out + '.mp4');
