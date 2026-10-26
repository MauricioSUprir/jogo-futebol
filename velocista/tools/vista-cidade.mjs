// Prints da cidade no jogo (PC 1280×720): as fachadas com as salas atrás das janelas (janelas.js), os carros novos
// (carros3d.js) estacionados e no trânsito, de dia e de noite, de perto e de longe. Uso: node velocista/tools/vista-cidade.mjs <pasta>
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), pasta = process.argv[2] || '/tmp/vista-cidade';
fs.mkdirSync(pasta, { recursive: true });
const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
const cid = await import('../js/cidade.js');
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
await pagina.goto(srv.url + '?missao=velocidade', { timeout: 1200000 });
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
await pagina.evaluate(() => { window.__rel.crimes.adiantar?.(-1e9); window.__rel.historia.calarRadio(); });
// um quarteirão comum perto do centro: na calçada, olhando para a fachada do outro lado da rua
const i = 18, j = 26, cx = cid.centroDe(i), cz = cid.centroDe(j);
const quadros = (n) => pagina.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
for (const [nome, T, x, z, yaw, pitch, dist] of [
  ['rua-dia', 0.42, cx, cz - 31, Math.PI, 0.05, 6], ['fachada-dia', 0.42, cx, cz - 37, 0, 0.18, 3.2], ['rua-noite', 0.93, cx, cz - 31, Math.PI, 0.05, 6], ['fachada-noite', 0.93, cx, cz - 37, 0, 0.18, 3.2], ['alto-dia', 0.45, cx - 30, cz - 38, 0.6, 0.55, 14]]) {
  await pagina.evaluate(([T, x, z, yaw, pitch, dist]) => { const R = window.__rel; R.mundo.T = T; Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0 }); R.C.yaw = yaw; R.C.pitch = pitch; R.C.dist = dist; }, [T, x, z, yaw, pitch, dist]);
  await quadros(6);
  await pagina.screenshot({ path: path.join(pasta, `${nome}.png`), timeout: 600000 });
}
console.log(erros.length ? `erros: ${erros.slice(0, 3).join(' | ')}` : 'sem erros');
await navegador.close(); await srv.fechar();
