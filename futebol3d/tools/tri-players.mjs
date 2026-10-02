// Triângulos e draw calls dos jogadores por qualidade (22 jogadores, cabelos variados).
// Uso: node tools/tri-players.mjs [porta]   (servidor estático em futebol3d/)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const port = process.argv[2] || '8797';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 400, height: 300 } });
await routeCDN(ctx); const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://localhost:${port}/tools/players-test.html?faces=1`); await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const rows = await p.evaluate(async () => {
  const THREE = await import('three');
  const { PlayerMeshes } = await import('../js/players3d.js');
  const { QUALITY } = await import('../js/config.js');
  const HAIRS = ['short', 'buzz', 'curly', 'long', 'bald', 'afro', 'bun'];
  const out = [];
  for (const q of ['baixa', 'media', 'alta']) {
    const scene = new THREE.Scene();
    const pm = new PlayerMeshes(scene, { count: 22, quality: QUALITY[q], night: false });
    for (let i = 0; i < 22; i++) pm.setPlayer(i, { kit: { shirt: '#fff', pattern: 'plain' }, isGK: i % 11 === 0, number: i + 1, look: { skin: '#c68c5a', hair: HAIRS[i % 7], hairColor: '#222', height: 1.8, build: 0.5, beard: i % 3 === 0 } });
    let tris = 0, calls = 0; const per = {};
    scene.traverse((o) => { if (!o.isInstancedMesh || !o.name.startsWith('jog-')) return; const t = o.geometry.index.count / 3; per[o.name] = t; tris += t * o.count; if (o.count) calls++; });
    out.push({ q, tris, calls, per });
    pm.dispose();
  }
  return out;
});
for (const r of rows) console.log(`${r.q}: triângulos (22 jog., sem sombra) = ${r.tris}  draw calls do corpo = ${r.calls}\n   ${Object.entries(r.per).map(([k, v]) => k.slice(4) + ':' + v).join(' ')}`);
console.log('erros:', errors.length ? errors.join('\n') : 0);
await b.close();
