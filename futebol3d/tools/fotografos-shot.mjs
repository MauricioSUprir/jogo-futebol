// Prints da página de teste dos fotógrafos. Uso: node tools/fotografos-shot.mjs <prefixo> [cenas: perto,fila,alto,frente,costas] [--q alta] [--flash]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const out = process.argv[2] || '/tmp/foto';
const cenas = (process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'perto,fila,alto').split(',');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await routeCDN(ctx);
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
for (const c of cenas) {
  await p.goto(`http://localhost:8790/tools/fotografos-test.html?cam=${c}&q=${arg('q', 'alta')}${process.argv.includes('--flash') ? '&flash=1' : ''}&ball=${arg('ball', '-40,0')}`);
  await p.waitForFunction(() => window.__info, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}-${c}.png` });
  console.log('ok', c, JSON.stringify(await p.evaluate(() => window.__info)));
}
console.log('erros', errs.length ? errs.join('\n') : 'nenhum');
await b.close();
