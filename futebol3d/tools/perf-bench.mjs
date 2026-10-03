// Benchmark de desempenho por qualidade (node tools/perf-bench.mjs [baixa,media,alta,ultra] [--w 1280 --h 720] [--mobile])
// Mede, com o jogo rodando (depois da abertura):
//  - tempo de CPU do quadro em JS (callback do requestAnimationFrame: simulação + montagem do render)
//  - tempo da simulação (match.step) separado
//  - draw calls e triângulos do quadro INTEIRO (todas as passadas: sombra, cena, pós)
//  - quadros/s no Chromium com WebGL por software (SwiftShader) — só serve para comparar antes/depois,
//    não é o FPS de uma GPU real.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const quals = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'baixa,media,alta,ultra').split(',');
const W = +arg('w', 1280), H = +arg('h', 720), secs = +arg('secs', 8);
const out = arg('out', '');
const port = arg('port', '8790');

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const res = [];
for (const q of quals) {
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: flag('mobile'), hasTouch: flag('mobile') });
  await routeCDN(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(2000);
  await p.evaluate(async (q) => {
    const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
    window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'none', settings: { ...window.__golaco.settings(), quality: q, timeOfDay: 'noite', halfMinutes: 6, intro: false } });
  }, q);
  await p.waitForFunction(() => window.__golaco.game, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__golaco.advance(3));
  await p.waitForTimeout(+arg('warm', 3) * 1000);
  const r = await p.evaluate(async (secs) => {
    const R = window.__golaco.renderer, g = window.__golaco.game, m = g.match;
    R.info.autoReset = false;
    const frames = [], sims = []; let simAcc = 0, calls = 0, tris = 0, n = 0;
    const step0 = m.step.bind(m);
    m.step = (...a) => { const s = performance.now(); const v = step0(...a); simAcc += performance.now() - s; return v; };
    const raf0 = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf0((t) => {
      R.info.reset(); simAcc = 0;
      const s = performance.now(); cb(t); frames.push(performance.now() - s); sims.push(simAcc);
      calls += R.info.render.calls; tris += R.info.render.triangles; n++;
    });
    const t0 = performance.now(); await new Promise((ok) => setTimeout(ok, secs * 1000));
    const el = (performance.now() - t0) / 1000;
    window.requestAnimationFrame = raf0; m.step = step0; R.info.autoReset = true;
    const pct = (a, k) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * k))]; };
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const db = R.domElement;
    return { fps: +(n / el).toFixed(1), cpuMed: +avg(frames).toFixed(2), cpuP95: +pct(frames, 0.95).toFixed(2), simMed: +avg(sims).toFixed(2),
      calls: Math.round(calls / n), tris: Math.round(tris / n), buffer: db.width + 'x' + db.height,
      phase: m.phase, geoms: R.info.memory.geometries, texs: R.info.memory.textures, progs: R.info.programs?.length };
  }, secs);
  if (out) await p.screenshot({ path: `${out}-${q}.png`, timeout: 300000 });
  res.push({ q, ...r, erros: errs.length });
  console.log(q, JSON.stringify(r), errs.length ? 'ERROS: ' + errs.slice(0, 3).join(' | ') : '');
  await ctx.close();
}
console.table(res);
await b.close();
