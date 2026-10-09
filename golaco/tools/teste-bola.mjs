// Física da bola: quique, rolagem, arrasto, efeito, traves, rede, giro coerente e a conta do
// planejador (velParaDistancia) batendo com a integração 3D.
//   node tools/teste-bola.mjs
import { criarBola, passoBola, chutar, chutarRasteiro, velParaDistancia, distAteParar, CONST_BOLA } from '../js/bola.js';
import { PASSO, CAMPO, BOLA } from '../js/config.js';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

// 1) queda de 2 m: altura do 1º quique
{
  const b = criarBola(0, 0); b.p.y = 2; b.rolando = false;
  let subiu = false, pico = 0, vy0 = 0;
  for (let i = 0; i < 400; i++) {
    const vyAnt = b.v.y;
    passoBola(b, []);
    if (vyAnt < 0 && b.v.y > 0) subiu = true;
    if (subiu) { pico = Math.max(pico, b.p.y); if (b.v.y < 0) break; }
  }
  const ret = (pico - BOLA.raio) / (2 - BOLA.raio);
  reg('queda de 2 m — volta ao quicar (altura)', `${fmt(ret * 100, 0)}% (${fmt(pico)} m)`, '30–45% (FIFA: bola na grama)', ret >= 0.3 && ret <= 0.45);
}
// 2) rolagem: rampa de ~1 m de altura (FIFA Quality "ball roll") → 4–10 m
{
  const v0 = Math.sqrt((2 * 9.81 * 1.0 * 3) / 5); // casca fina rolando: v² = 2gh·(3/5)
  const d = distAteParar(v0);
  reg('rolagem saindo da rampa de 1 m', `${fmt(d)} m (v0 ${fmt(v0)} m/s)`, '4–10 m', d >= 4 && d <= 10);
}
// 3) chute a 30 m/s: perda de velocidade pelo arrasto em 20 m de voo quase reto
{
  const b = criarBola(0, 0); b.p.y = 1.5; b.rolando = false;
  chutar(b, { x: 30, y: 4.2, z: 0 }, { x: 0, y: 0, z: 0 });
  let i = 0;
  while (b.p.x < 20 && i < 600) { passoBola(b, []); i++; }
  const s = Math.hypot(b.v.x, b.v.y, b.v.z);
  reg('chute de 30 m/s — velocidade aos 20 m', `${fmt(s)} m/s`, '22–27 m/s', s >= 22 && s <= 27);
}
// 4) efeito: giro em torno de +y faz a bola curvar para −z quando vai em +x (ω × v)
{
  const b = criarBola(0, 0); b.p.y = 1; b.rolando = false;
  chutar(b, { x: 25, y: 3, z: 0 }, { x: 0, y: 40, z: 0 });
  for (let i = 0; i < 60; i++) passoBola(b, []);
  const zEsp = Math.sign(40 * 0 - 0); // ŵ × v̂: (0,1,0)×(1,0,0) = (0,0,−1)
  void zEsp;
  reg('efeito (Magnus) — curva para o lado certo em 1 s', `${fmt(b.p.z)} m`, '< −0,5 m', b.p.z < -0.5);
}
// 5) rolando: o giro é de rolamento puro
{
  const b = criarBola(0, 0);
  chutarRasteiro(b, 5, 2);
  for (let i = 0; i < 30; i++) passoBola(b, []);
  const vcx = b.v.x + CONST_BOLA.R * b.w.z, vcz = b.v.z - CONST_BOLA.R * b.w.x;
  reg('rolando — ponto de contato parado (sem derrapar)', `${fmt(Math.hypot(vcx, vcz), 6)} m/s`, '< 1e-6', Math.hypot(vcx, vcz) < 1e-6);
}
// 6) planejador = integração: velParaDistancia(d, n) leva a bola exatamente a d em n passos
{
  let pior = 0;
  for (const [d, n] of [[1.2, 30], [2.4, 43], [4.0, 30], [0.6, 60], [3.3, 96]]) {
    const v = velParaDistancia(d, n);
    const b = criarBola(0, 0);
    chutarRasteiro(b, v * 0.6, v * 0.8);
    for (let i = 0; i < n; i++) passoBola(b, []);
    pior = Math.max(pior, Math.abs(Math.hypot(b.p.x, b.p.z) - d));
  }
  reg('toque planejado chega ao ponto (pior erro)', `${fmt(pior * 1000, 3)} mm`, '< 1 mm', pior < 1e-3);
}
// 7) trave: bola rasteira no poste volta
{
  const b = criarBola(CAMPO.meioX - 4, CAMPO.gol.largura / 2 + CAMPO.gol.raioPoste);
  b.p.y = 0.5; b.rolando = false;
  chutar(b, { x: 15, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
  const ev = [];
  for (let i = 0; i < 40; i++) passoBola(b, ev);
  reg('trave — bola bate no poste e volta', `${ev.filter(e => e.tipo === 'trave').length} batida(s), vx ${fmt(b.v.x)}`, 'bate e vx < 0', ev.some(e => e.tipo === 'trave') && b.v.x < 0);
}
// 8) rede: chute forte no meio do gol fica dentro
{
  const b = criarBola(CAMPO.meioX - 11, 0); b.p.y = 0.8; b.rolando = false;
  chutar(b, { x: 28, y: 2, z: 1 }, { x: 0, y: 0, z: 0 });
  for (let i = 0; i < 240; i++) passoBola(b, []);
  const dentro = b.p.x > CAMPO.meioX && b.p.x < CAMPO.meioX + CAMPO.gol.profundidade + 0.01 && Math.abs(b.p.z) < CAMPO.gol.largura / 2;
  reg('rede — chute forte fica dentro do gol', `x ${fmt(b.p.x)} z ${fmt(b.p.z)}`, 'dentro da rede', dentro);
}
// 9) determinismo da bola
{
  const rodar = () => { const b = criarBola(0, 0); b.p.y = 1; b.rolando = false; chutar(b, { x: 20, y: 6, z: 3 }, { x: 5, y: 20, z: -3 }); for (let i = 0; i < 300; i++) passoBola(b, []); return [b.p.x, b.p.y, b.p.z, b.q.w].join(','); };
  reg('determinismo — mesmas condições, mesma bola', rodar() === rodar() ? 'igual' : 'diferente', 'igual', rodar() === rodar());
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-bola: REPROVOU (${falhas})` : '\nteste-bola: PASSOU');
process.exit(falhas ? 1 : 0);
