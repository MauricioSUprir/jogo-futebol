// Prints das poses de luta do herói (guarda, soco direito/esquerdo, gancho, raio) de frente e de lado, para conferir.
// Uso: node velocista/tools/vista-golpes.mjs <pasta>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const saida = process.argv[2];
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 900, altura: 506 });
await pagina.goto(srv.url);
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
await pagina.evaluate(() => document.getElementById('btnJogar').click());
await pagina.waitForFunction(() => window.__rel.modelo, null, { timeout: 200000 });
await pagina.evaluate(() => { const R = window.__rel; R.mundo.T = 0.45; R.CAM.dist = 2.6; R.CAM.alvoY = 1.25; R.C.pitch = 0.08; R.P.x += 0; });
const poses = [['guarda', null], ['soco-d', { tipo: 'soco', lado: 1, k: 1 }], ['soco-e', { tipo: 'soco', lado: -1, k: 1 }], ['gancho', { tipo: 'gancho', lado: 1, k: 1 }], ['raio', { tipo: 'raio', lado: 1, k: 1 }]];
for (const [nome, golpe] of poses) {
  for (const [vista, yaw] of [['frente', Math.PI], ['lado', Math.PI / 2]]) {
    await pagina.evaluate(({ golpe, yaw }) => { const R = window.__rel; R.combate.poseHeroi = () => ({ golpe, corrida: null, luta: 1 }); R.P.h = 0; R.C.yaw = yaw; }, { golpe, yaw });
    await pagina.waitForTimeout(1500);
    await pagina.screenshot({ path: path.join(saida, `pose-${nome}-${vista}.png`), timeout: 400000 });
  }
}
console.log('erros:', erros.slice(0, 3));
await navegador.close(); await srv.fechar();
