// Captura quadros do teste de efeitos (tools/fx-test.html) com Playwright.
// Uso: PLAN='[{"tod":"noite","cam":"tv","side":"home","at":[0,2,5,9]}]' node tools/fx-shot.mjs <pastaSaida> [porta]
// "at" = segundos depois do gol em que cada quadro é salvo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
import { join } from 'node:path';

const out = process.argv[2] || '.';
const port = process.argv[3] || '8794';
const plan = JSON.parse(process.env.PLAN || 'null') || [
  { tod: 'noite', cam: 'tv', side: 'home', at: [0, 3, 7] },
  { tod: 'dia', cam: 'tv', side: 'home', at: [3, 7] },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await routeCDN(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
for (const p of plan) {
  await page.goto(`http://localhost:${port}/tools/fx-test.html?tod=${p.tod}&q=${p.q || 'alta'}&cam=${p.cam}&auto=0&hud=${p.hud ?? 0}${p.extra || ''}`, { timeout: 500000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 500000 });
  await page.evaluate(() => window.__adv(0.5));
  if (p.side === 'chance') await page.evaluate(() => window.__chance()); else await page.evaluate((s) => window.__goal(s), p.side);
  let done = 0;
  for (const a of p.at) {
    const inf = await page.evaluate((s) => window.__adv(s), a - done);
    done = a;
    const file = join(out, `fx-${p.tod}-${p.q || 'alta'}-${p.cam}-${p.side}-t${String(a).replace('.', '_')}.png`);
    await page.screenshot({ path: file, timeout: 180000 });
    console.log(file.split('/').pop(), JSON.stringify(inf));
  }
}
console.log(errors.length ? errors.join('\n') : 'console: sem erros');
await browser.close();
