// Captura quadros do teste da rede (tools/net-test.html) com Playwright.
// Uso: node tools/net-shot.mjs <pastaSaida> [porta]   (servidor em futebol3d/)
// Para cada câmera/chute, avança a simulação em passos fixos e salva quadros
// antes, durante (rede estufada) e depois do impacto.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
import { join } from 'node:path';

const out = process.argv[2] || '.';
const port = process.argv[3] || '8794';
const plan = JSON.parse(process.env.PLAN || 'null') || [
  { cam: 'front', shot: 0, frames: [24, 28, 33, 45, 90] },
  { cam: 'side', shot: 0, frames: [27, 31, 40, 70] },
  { cam: 'behind', shot: 1, frames: [27, 31, 60] },
  { cam: 'front', shot: 2, frames: [40, 46, 70] },
  { cam: 'side', shot: 4, frames: [40, 46, 70] },
  { cam: 'tv', shot: 6, frames: [0, 21, 25, 50] },
  { cam: 'front', shot: 3, frames: [0, 80, 200] },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await routeCDN(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
for (const p of plan) {
  await page.goto(`http://localhost:${port}/tools/net-test.html?cam=${p.cam}&auto=0&hud=${p.hud ?? 0}${p.night ? '&night=1' : ''}${p.extra || ''}`, { timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.evaluate((k) => window.__shot(k), p.shot);
  let done = 0;
  for (const f of p.frames) {
    const inf = await page.evaluate((n) => window.__adv(n), f - done);
    done = f;
    const file = join(out, `net-${p.cam}-s${p.shot + 1}-f${String(f).padStart(3, '0')}${p.night ? '-noite' : ''}.png`);
    await page.screenshot({ path: file, timeout: 300000 });
    console.log(file, JSON.stringify(inf));
  }
}
console.log(errors.length ? errors.join('\n') : 'console: sem erros');
await browser.close();
