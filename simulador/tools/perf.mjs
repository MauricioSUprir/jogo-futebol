// Mede desempenho real da partida no Chromium em cada nível de qualidade.
// Uso: node tools/perf.mjs [--mobile] [--cpu 4] [--secs 5]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const mobile = process.argv.includes('--mobile');
const cpu = +arg('cpu', 1), secs = +arg('secs', 5);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
if (cpu > 1) { const c = await ctx.newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
console.log(`${mobile ? 'celular 390x844 @3x' : 'desktop 1440x900'}  CPU ÷${cpu}`);
for (const q of ['baixo', 'medio', 'alto', 'ultra']) {
  await page.goto('http://localhost:8791/index.html');
  await page.evaluate((q) => localStorage.setItem('lal.settings.v1', JSON.stringify({ quality: q, sound: false, speed: 8 })), q);
  await page.reload();
  await page.waitForSelector('#home');
  await page.evaluate(() => { const T = window.__lal.app; T.go.quick(); });
  await page.click('text=Começar partida');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async (secs) => {
    const mv = window.__lal.app.matchView;
    const frames = [], draws = [], eng = [];
    let last = performance.now();
    const end = last + secs * 1000;
    await new Promise((res) => {
      const f = (now) => { frames.push(now - last); last = now; draws.push(mv.renderer.drawMs); eng.push(mv.engineMs); if (now < end) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
    const s = (a) => { const x = [...a].sort((p, q) => p - q); return { avg: x.reduce((p, q) => p + q, 0) / x.length, p95: x[Math.floor(x.length * 0.95)], max: x[x.length - 1] }; };
    const fr = s(frames), dr = s(draws), en = s(eng);
    return { fps: 1000 / fr.avg, p95: fr.p95, max: fr.max, draw: dr.avg, drawP95: dr.p95, eng: en.avg, engP95: en.p95, dpr: mv.renderer.dpr, canvas: `${mv.renderer.w}x${mv.renderer.h}`, heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null, level: window.__lal.app.level };
  }, secs);
  console.log(`${q.padEnd(6)} ${r.fps.toFixed(0).padStart(3)} fps  quadro p95 ${r.p95.toFixed(1)} ms (máx ${r.max.toFixed(0)})  desenho ${r.draw.toFixed(2)}/${r.drawP95.toFixed(2)} ms  motor ${r.eng.toFixed(2)}/${r.engP95.toFixed(2)} ms  canvas ${r.canvas} dpr ${r.dpr}  heap ${r.heap?.toFixed(1)} MB`);
}
console.log('erros:', errs.length ? errs.join('; ') : 'nenhum');
await b.close();
