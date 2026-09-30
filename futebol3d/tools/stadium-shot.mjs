// Captura telas da página de teste do estádio com Playwright (headless, SwiftShader).
// Uso: node tools/stadium-shot.mjs <pastaSaida> "tod=noite&cam=tv:nome" ...
// Requer servidor: (cd futebol3d && python3 -m http.server 8765)  — porta via env PORT
// As requisições ao jsdelivr são servidas de um cache local (baixado com curl),
// pois o navegador headless pode não ter acesso direto à rede.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const outDir = process.argv[2];
const shots = process.argv.slice(3);
const cache = join(outDir, '.cdn-cache');
mkdirSync(cache, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.route(/cdn\.jsdelivr\.net/, async (route) => {
  const url = route.request().url();
  const f = join(cache, createHash('md5').update(url).digest('hex'));
  if (!existsSync(f)) execFileSync('curl', ['-sSL', '-o', f, url]);
  await route.fulfill({ body: readFileSync(f), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } });
});

for (const s of shots) {
  const [query, name] = s.split(':');
  const t0 = Date.now();
  await page.goto(`http://localhost:${process.env.PORT ?? 8765}/tools/stadium-test.html?${query}&hud=${process.env.HUD ?? "0"}`, { timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 1500));
  const file = join(outDir, `stadium-${name}.png`);
  await page.screenshot({ path: file, timeout: 180000 });
  console.log('ok', file, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
console.log(errors.length ? errors.join('\n') : 'console: sem erros');
await browser.close();
