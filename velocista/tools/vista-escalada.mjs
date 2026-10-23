// Prints da escalada de lado, para conferir a orientação do corpo na parede.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const saida = process.argv[2];
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 1000, altura: 640 });
await pagina.goto(srv.url);
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 240000 });
await pagina.waitForFunction(() => window.__rel.modelo, null, { timeout: 60000 });
await pagina.click('#btnJogar');
const pr = await pagina.evaluate(async () => {
  const mod = await import('/js/cidade.js');
  for (let i = 19; i <= 25; i++) for (let j = 19; j <= 25; j++) { const b = mod.bloco(i, j); for (const l of b.lotes) if (l.y0 === mod.CALCADA && l.y1 > 22 && l.y1 < 40 && l.x1 - l.x0 > 12 && l.z0 - b.cz < -10 && b.tipo !== 'lab') return { x: (l.x0 + l.x1) / 2, zRua: b.cz - 38, lote: l }; }
});
await pagina.evaluate((a) => { const R = window.__rel, P = R.P; P.x = a.x; P.z = a.zRua; P.y = 0.3; P.vx = 0; P.vz = 46; P.energia = 1; R.C.yaw = 0; R.teclas.clear(); R.teclas.add('w'); R.teclas.add('shift'); }, pr);
await pagina.waitForFunction(() => { const R = window.__rel; if (R.P.parede && R.P.y > 6) { R.P.parede.v = 0.01; return true; } return false; }, null, { timeout: 120000 });
await pagina.evaluate(() => { const R = window.__rel; R.C.yaw = Math.PI / 2; R.C.pitch = 0.05; R.CAM.dist = 7; });
await pagina.waitForTimeout(1200);
await pagina.screenshot({ path: path.join(saida, 'escalada-lado.png'), timeout: 120000 });
console.log(JSON.stringify(await pagina.evaluate(() => { const R = window.__rel, h = R.heroi; return { y: R.P.y, parede: !!R.P.parede, q: h && h.quaternion.toArray() }; })));
await navegador.close(); await srv.fechar();
