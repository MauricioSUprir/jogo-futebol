// Triângulos por objeto da cena (node tools/tri-count.mjs [qualidade])
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const q = process.argv[2] || 'baixa';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 800, height: 450 } });
await routeCDN(ctx); const p = await ctx.newPage();
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async (q) => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
  window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'home', settings: { ...window.__golaco.settings(), quality: q } }); }, q);
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 60000 }); await p.waitForTimeout(2000);
const rows = await p.evaluate(() => { const out = []; window.__golaco.game.scene.traverse(o => { if (!o.isMesh && !o.isPoints && !o.isLine) return; const g = o.geometry; let t = g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3; const inst = o.isInstancedMesh ? o.count : (g.instanceCount && g.instanceCount !== Infinity ? g.instanceCount : 1); out.push([o.name || o.type + '/' + (o.material?.type || ''), Math.round(t * inst), inst]); }); return out.sort((a, b) => b[1] - a[1]).slice(0, 15); });
for (const r of rows) console.log(r.join('  '));
await b.close();
