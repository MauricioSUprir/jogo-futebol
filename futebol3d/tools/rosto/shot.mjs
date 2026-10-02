// node tools/rosto/shot.mjs <saida.png> <query>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from '../cdn-route.mjs';
const [out, qs] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: process.env.SQ ? { width: 1024, height: 1024 } : { width: 700, height: 800 } }); await routeCDN(ctx);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:8790/tools/rosto/teste.html?' + (qs || ''));
await p.waitForFunction(() => window.pronto, null, { timeout: 120000 });
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => window.pronto)));
await p.screenshot({ path: out }); console.log('ok', out, errs.join(';') || '');
await b.close();
