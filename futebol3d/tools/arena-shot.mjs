// Capturas do estádio (páginas de teste) com Playwright/SwiftShader.
// Uso: node tools/arena-shot.mjs <pastaSaida> "tod=noite&cam=tv:nome" ...
// Servidor: (cd futebol3d && python3 -m http.server 8795) — porta via env PORT.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { join } from 'node:path';
import { routeCDN } from './cdn-route.mjs';

const outDir = process.argv[2];
const shots = process.argv.slice(3);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: +(process.env.W ?? 1280), height: +(process.env.H ?? 720) } });
await routeCDN(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
for (const s of shots) {
  const [query, name] = s.split(':');
  const t0 = Date.now();
  await page.goto(`http://localhost:${process.env.PORT ?? 8795}/tools/stadium-test.html?${query}&hud=${process.env.HUD ?? '0'}`, { timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 1500));
  const info = await page.evaluate(() => window.__info);
  const file = join(outDir, `arena-${name}.png`);
  await page.screenshot({ path: file, timeout: 180000 });
  console.log('ok', file, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(info));
}
console.log(errors.length ? errors.join('\n') : 'console: sem erros');
await browser.close();
