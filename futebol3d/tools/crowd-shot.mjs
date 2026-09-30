// Capturas da torcida 3D (tools/crowd-test.html) com Playwright (headless, SwiftShader).
// Uso: node tools/crowd-shot.mjs <pastaSaida> "q=alta&cam=close:nome" ...
// Servidor: (cd futebol3d && python3 -m http.server 8793) — porta via env PORT.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { join } from 'node:path';
import { routeCDN } from './cdn-route.mjs';

const outDir = process.argv[2];
const shots = process.argv.slice(3);
const port = process.env.PORT ?? 8793;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: +(process.env.W ?? 1280), height: +(process.env.H ?? 720) } });
await routeCDN(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

for (const s of shots) {
  const k = s.lastIndexOf(':');
  const query = s.slice(0, k), name = s.slice(k + 1);
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/tools/crowd-test.html?${query}&hud=${process.env.HUD ?? '1'}`, { timeout: 240000 });
  try {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: +(process.env.TIMEOUT ?? 240000), polling: 500 });
  } catch (e) {
    console.log('FALHOU', name, e.message.split('\n')[0]);
    console.log(errors.join('\n').slice(0, 6000));
    continue;
  }
  const info = await page.evaluate(() => window.__info);
  const file = join(outDir, `crowd3d-${name}.png`);
  await page.screenshot({ path: file, timeout: 240000 });
  console.log('ok', file, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(info));
}
console.log(errors.length ? errors.join('\n') : 'console: sem erros');
await browser.close();
