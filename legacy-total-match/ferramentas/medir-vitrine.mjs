// Mede o custo da animação da vitrine (menu inicial) em celular mediano.
// Mede duas coisas diferentes, porque uma não enxerga a outra:
//   1) thread principal  -> quadros perdidos no requestAnimationFrame + long-animation-frame
//   2) renderização      -> Paint / Layerize / RasterTask somados pelo tracing do CDP
// O headless NÃO mostra custo de GPU real; use os números só para comparar
// "antes x depois" da mesma máquina.
//
// Uso: node ferramentas/medir-vitrine.mjs [--porta 8793] [--trocas 8] [--cpu 4] [--dpr 3]
//   (servidor: python3 -m http.server 8793 na raiz do legacy-total-match)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORTA = arg('porta', '8793'), TROCAS = +arg('trocas', 8), CPU = +arg('cpu', 4), DPR = +arg('dpr', 3);
const ESPERA = 560; // um pouco mais que a transition mais longa (520ms)

const NOMES = /^(Paint|PaintSetup|Layout|UpdateLayerTree|UpdateLayer|RasterTask|Rasterize|CompositeLayers|Layerize|PrePaint|Commit)$/;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR,
  isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', e => erros.push(e.message));
await pg.goto(`http://localhost:${PORTA}/index.html`, { waitUntil: 'load' });

// passa pela abertura ("TOQUE PARA COMEÇAR")
await pg.waitForTimeout(1500);
for (let t = 0; t < 6; t++) {
  if (await pg.$('.vit-palco .vit-carta')) break;
  try { await pg.mouse.click(195, 500); } catch (e) {}
  await pg.waitForTimeout(1200);
}

// espera a vitrine aparecer
try { await pg.waitForSelector('.vit-palco .vit-carta', { timeout: 20000 }); }
catch (e) { console.error('não achei a vitrine; a tela inicial é outra. Erros:', erros.slice(0, 3)); await nav.close(); process.exit(1); }
await pg.waitForTimeout(800);

const cartas = await pg.$$eval('.vit-carta', n => n.length);
const camadas = await pg.evaluate(() => {
  // quanta memória de textura as cartas pedem se cada uma virar camada
  const d = window.devicePixelRatio || 1; let mb = 0, n = 0;
  document.querySelectorAll('.vit-carta').forEach(c => {
    // tamanho de LAYOUT, nao o rect: o rect e pos-transform (as cartas laterais
    // estao em escala e perspectiva) e subestima a textura que a camada aloca
    mb += (c.offsetWidth * d) * (c.offsetHeight * d) * 4 / 1048576; n++;
  });
  return { n, mb: +mb.toFixed(1) };
});

const cdp = await ctx.newCDPSession(pg);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

const eventos = [];
cdp.on('Tracing.dataCollected', e => eventos.push(...e.value));
await cdp.send('Tracing.start', { categories: 'disabled-by-default-devtools.timeline,devtools.timeline,blink,cc', transferMode: 'ReportEvents' });

// começa a contar quadros e dispara as trocas por arraste de dedo
const medida = pg.evaluate((ms) => new Promise(function (ok) {
  var ts = [], laf = [];
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { laf.push(Math.round(e.duration)); }); })
        .observe({ type: 'long-animation-frame' }); } catch (e) {}
  var t0 = performance.now();
  function volta(x) { ts.push(x); if (x - t0 < ms) requestAnimationFrame(volta); else ok({ ts: ts, laf: laf }); }
  requestAnimationFrame(volta);
}), TROCAS * ESPERA + 400);

// Arraste de verdade: 12 passos com ~16ms entre eles, para o trecho em que a
// carta segue o dedo durar ~200ms. Sem a pausa, os movimentos chegam todos no
// mesmo quadro, o rAF os junta num so e a medicao acaba medindo so os encaixes.
const cx = 195, cy = 160, PASSOS = 12;
for (let k = 0; k < TROCAS; k++) {
  await pg.mouse.move(cx + 70, cy); await pg.mouse.down();
  for (let s = 1; s <= PASSOS; s++) {
    await pg.mouse.move(cx + 70 - s * 10, cy);
    await pg.waitForTimeout(16);
  }
  await pg.mouse.up();
  await pg.waitForTimeout(ESPERA);
}

const { ts, laf } = await medida;
const fim = new Promise(r => cdp.once('Tracing.tracingComplete', r));
await cdp.send('Tracing.end'); await fim;

const dt = []; for (let i = 1; i < ts.length; i++) dt.push(ts[i] - ts[i - 1]);
const perdidos = dt.reduce((a, x) => a + Math.max(0, Math.round(x / 16.67) - 1), 0);
const ord = dt.slice().sort((a, b) => a - b);
const soma = {};
for (const e of eventos) { if (e.ph !== 'X' || !e.dur || !NOMES.test(e.name)) continue; soma[e.name] = (soma[e.name] || 0) + e.dur / 1000; }

console.log(`cartas no DOM: ${cartas}  |  camadas potenciais: ${camadas.n} ≈ ${camadas.mb} MB de textura (DPR ${DPR})`);
console.log(`thread principal (cpu ${CPU}x): quadros=${ts.length} perdidos=${perdidos} p50=${(ord[ord.length>>1]||0).toFixed(1)}ms p95=${(ord[Math.floor(ord.length*.95)]||0).toFixed(1)}ms pior=${(ord[ord.length-1]||0).toFixed(1)}ms`);
console.log(`long-animation-frame (>50ms): ${laf.length} ${laf.length ? '[' + laf.join(', ') + '] ms' : ''}`);
console.log('renderização (ms somados em ' + TROCAS + ' trocas): ' + JSON.stringify(Object.fromEntries(Object.entries(soma).map(([k, v]) => [k, +v.toFixed(1)]))));
if (erros.length) console.log('erros de página:', erros.slice(0, 5));
await nav.close();
