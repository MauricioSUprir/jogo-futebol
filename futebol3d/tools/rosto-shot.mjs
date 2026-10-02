// Prints da página de jogadores (closes de rosto etc.) com relatório de erros, draw calls e triângulos.
// Uso: node tools/rosto-shot.mjs prefixo "nome|query" ["nome2|query2" ...]  [--w 1400 --h 800 --port 8797]
//   ex.: node tools/rosto-shot.mjs /tmp/rosto "frente|faces=6" "perfil|faces=6&turn=90"
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const W = +opt('w', 1400), H = +opt('h', 800), port = opt('port', '8797');
const [prefix, ...jobs] = argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await routeCDN(ctx);
let total = 0;
for (const job of jobs) {
  const [name, q] = job.split('|');
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(`http://localhost:${port}/tools/players-test.html?${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(() => errors.push('timeout'));
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => document.getElementById('info').textContent);
  await page.screenshot({ path: `${prefix}-${name}.png`, timeout: 300000 });
  console.log(`${name}: calls=${await page.evaluate(() => window.__calls)} ${info.replace(/\s+/g, ' ')} erros=${errors.length ? '\n  ' + errors.join('\n  ') : 0}`);
  total += errors.length;
  await page.close();
}
await b.close();
process.exit(total ? 1 : 0);
