// Teste de navegador do laboratório DENTRO do jogo (com a cidade): o herói anda do Acelerador até a Câmara do Núcleo e das
// alas até as salas novas pela colisão do jogo; dentro() diz a sala; sem erros; grava prints de cada sala (celular deitado).
// Uso: node velocista/tools/teste-lab-jogo.mjs [pasta-de-prints]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), saida = process.argv[2];
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
const espera = (fn, arg, t = 400000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);
await pagina.goto(srv.url + '?missao=relatorio', { timeout: 1200000 });
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
await pagina.evaluate(() => { window.__rel.mundo.T = 0.45; window.__rel.crimes.adiantar(-1e9); });
// põe o herói num lugar (coordenadas locais do laboratório), olhando para um ponto, e espera alguns quadros
async function ir(nome, u, v, au, av) {
  const r = await pagina.evaluate(([u, v, au, av]) => { const R = window.__rel, L = R.LAB_B; Object.assign(R.P, { x: L.cx + u, z: L.cz + v, y: 0.3, vx: 0, vz: 0, vy: 0, noChao: true }); R.C.yaw = Math.atan2(au - u, av - v); R.C.pitch = 0.12; return R.quadros || 0; }, [u, v, au, av]);
  await pagina.waitForTimeout(2500);
  await espera(() => true, null, 1000);
  const sala = await pagina.evaluate(() => { const R = window.__rel; return R.LAB_B.plano.dentro(R.P.x, R.P.z, R.P.y); });
  if (saida) await pagina.screenshot({ path: path.join(saida, `jogo-${nome}.png`), timeout: 400000 });
  return sala;
}
for (const [nome, u, v, au, av] of [['nucleo', 0, 41, 0, 50], ['nucleo2', -13, 56, 0, 48], ['medica', -40, -9, -55, -20], ['oficina', -40, 9, -55, 28], ['trajes', 45, -8, 55, -22], ['fenda', 41, 10, 49, 28], ['alaOeste', -38, 0, -60, 0], ['corredorNorte', 0, 28, 0, 40]]) {
  const sala = await ir(nome, u, v, au, av);
  ok(sala === nome.replace(/\d$/, ''), `no jogo, o herói em (${u}, ${v}) está em "${sala}"`);
}
// andar de verdade (o joystick) do Acelerador até o Núcleo pelo corredor
await pagina.evaluate(() => { const R = window.__rel, L = R.LAB_B; Object.assign(R.P, { x: L.cx + 1.5, z: L.cz + 16, y: 0.3, vx: 0, vz: 0 }); R.C.yaw = 0; });
await pagina.evaluate(() => { const R = window.__rel; R.stick.x = 0; R.stick.y = 1; });
ok(await espera(() => { const R = window.__rel; return R.LAB_B.plano.dentro(R.P.x, R.P.z, R.P.y) === 'nucleo'; }, null, 300000), 'andando com o joystick do Acelerador, o herói chega à Câmara do Núcleo pelo corredor norte');
await pagina.evaluate(() => { const R = window.__rel; R.stick.x = 0; R.stick.y = 0; });
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
