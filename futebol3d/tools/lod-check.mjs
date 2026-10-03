// Confere o recorte/LOD da torcida e dos jogadores: para várias câmeras, tira um print
// com o LOD/recorte ligados e outro com tudo forçado no detalhado e sem recorte, e
// mostra triângulos de cada um. (node tools/lod-check.mjs [qualidade] [--out prefixo])
// Os prints lado a lado mostram se algum setor some na borda da tela ou se a troca aparece.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const q = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'alta';
const out = arg('out', '/tmp/lod');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await routeCDN(ctx);
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async (q) => {
  const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
  window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'none', settings: { ...window.__golaco.settings(), quality: q, timeOfDay: 'noite', intro: false } });
}, q);
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => { window.__golaco.advance(4); const g = window.__golaco.game; g.paused = true; document.getElementById('hud').style.display = 'none'; });
// câmeras: [nome, posição, alvo, fov]
const cams = [
  ['tv', [0, 22, -62], [0, 0, 0], 32],
  ['perto-arquibancada', [-20, 1.7, 33], [-12, 7.5, 52], 42],
  ['atras-gol', [-49, 1.8, 10], [-70, 7.5, 15], 44],
  ['aerea', [-10, 46, -26], [0, 0, 4], 55],
  ['close-jogador', null, null, 28],
];
for (const [name, pos, look, fov] of cams) {
  for (const mode of ['lod', 'cheio']) {
    const info = await p.evaluate(({ pos, look, fov, mode }) => {
      const g = window.__golaco.game, R = window.__golaco.renderer, cam = g.camera;
      if (pos) g.rig.setCinematic({ type: 'manual', pos: { x: pos[0], y: pos[1], z: pos[2], clone() { return this; } }, look: { x: look[0], y: look[1], z: look[2] }, fov, lam: 100 });
      else {
        const pl = g.match.players[5];
        g.rig.setCinematic({ type: 'manual', pos: { x: pl.x + 3.2, y: 1.6, z: pl.z + 0.5 }, look: { x: pl.x, y: 1.3, z: pl.z }, fov, lam: 100 });
      }
      g.rig.snap = true;
      const crowd = g.stadium.root?.getObjectByName?.('torcida') || g.scene.getObjectByName('torcida');
      const secs = crowd.userData.sectors;
      const lodFn = crowd.userData.updateLOD, plFn = g.players.lodUpdate;
      if (mode === 'cheio') {
        crowd.userData.updateLOD = () => { for (const s of secs) { s.near.visible = true; if (s.far) s.far.visible = false; s.near.frustumCulled = false; } };
        if (g.players.bodyLo) g.players.lodUpdate = function (c) { plFn.call(this, { position: c.position, fov: 1e-3, zoom: 1 }); };
      }
      window.__lodRestore = () => { crowd.userData.updateLOD = lodFn; g.players.lodUpdate = plFn; for (const s of secs) s.near.frustumCulled = true; };
      return { setores: secs.length };
    }, { pos, look, fov, mode });
    // alguns quadros para a câmera assentar e os contadores refletirem o modo
    await p.evaluate(() => { const g = window.__golaco.game; g.paused = false; });
    await p.waitForTimeout(100);
    await p.evaluate(() => { const g = window.__golaco.game; g.paused = true; });
    await p.waitForTimeout(2500);
    const st = await p.evaluate(() => { const R = window.__golaco.renderer, g = window.__golaco.game; const crowd = g.scene.getObjectByName('torcida');
      const secs = crowd.userData.sectors; return { tris: R.info.render.triangles, calls: R.info.render.calls, perto: secs.filter(s => s.near.visible).length, longe: secs.filter(s => s.far && s.far.visible).length, jogDet: g.players.bodyMesh.count, jogLeve: g.players.bodyLo ? g.players.bodyLo.count : 0 }; });
    await p.screenshot({ path: `${out}-${name}-${mode}.png`, timeout: 300000 });
    console.log(name, mode, JSON.stringify(st));
    await p.evaluate(() => window.__lodRestore());
  }
}
await b.close();
