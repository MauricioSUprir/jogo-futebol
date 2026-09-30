// Carrega a página e lista erros de console (node tools/load-check.mjs [url])
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const url = process.argv[2] || 'http://localhost:8790/index.html';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const cx = await b.newContext({ ignoreHTTPSErrors: true }); await routeCDN(cx); const p = await cx.newPage();
const errs = [];
p.on('console', m => { if (m.type() !== 'log') errs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
p.on('requestfailed', r => errs.push('falhou: ' + r.url()));
await p.goto(url); await p.waitForTimeout(4000); console.log('título:', await p.title(), '| menu:', await p.locator('.gm-root').count());
console.log(errs.join('\n') || 'sem erros');
await b.close();
