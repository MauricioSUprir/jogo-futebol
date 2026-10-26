// Mede o custo de desenho no celular emulado (844×390, dpr 3, toque): chamadas, triângulos, texturas, resolução interna
// e o tempo médio de quadro (Chromium sem GPU: só serve para comparar versões na mesma máquina).
// Uso: node velocista/tools/medir-desempenho.mjs [--pasta <cópia do velocista>] [--pc]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), pasta = a.includes('--pasta') ? a[a.indexOf('--pasta') + 1] : path.join(AQUI, '..'), pc = a.includes('--pc');
const srv = await servidor(0, pasta);
const { navegador, pagina, erros } = await abrir(pc ? { largura: 1280, altura: 720 } : { largura: 844, altura: 390, dpr: 3, toque: true });
await pagina.goto(srv.url);
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
await pagina.evaluate(() => document.getElementById('btnJogar').click());
await pagina.evaluate(() => document.fullscreenElement && document.exitFullscreen());
await pagina.waitForFunction(() => window.__rel.modelo, null, { timeout: 120000 }).catch(() => {});
await pagina.evaluate(() => { const R = window.__rel; R.teclas.add('w'); R.mundo.T = 0.5; });
await pagina.waitForTimeout(3000);
const r = await pagina.evaluate(() => new Promise((ok) => {
  const R = window.__rel, ren = R.renderer; let n = 0; const t0 = performance.now();
  const passo = () => { n++; if (performance.now() - t0 < 8000) requestAnimationFrame(passo); else ok({
    quadroMs: +((performance.now() - t0) / n).toFixed(1), chamadas: ren.info.render.calls, triangulos: ren.info.render.triangles,
    texturas: ren.info.memory.textures, geometrias: ren.info.memory.geometries, programas: ren.info.programs.length,
    resolucao: `${ren.domElement.width}×${ren.domElement.height}`, pixelRatio: ren.getPixelRatio(), quarteiroes: R.carregados.size }); };
  requestAnimationFrame(passo);
}));
console.log(JSON.stringify(r));
const foto = a.includes('--prints') ? a[a.indexOf('--prints') + 1] : null;
if (foto) for (const [n, T] of [['dia', 0.5], ['noite', 0.95]]) {
  await pagina.evaluate((T) => { const R = window.__rel; R.teclas.clear(); R.mundo.T = T; R.P.x = 0; R.P.z = 0; R.P.vx = R.P.vz = 0; R.C.yaw = 0.7; R.C.pitch = 0.3; }, T);
  await pagina.waitForTimeout(1500); await pagina.screenshot({ path: path.join(foto, `cel-${n}.png`), timeout: 120000 });
}
if (erros.length) console.log('erros:', erros.slice(0, 3));
await navegador.close(); await srv.fechar();
