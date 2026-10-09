// Animação (seção 4): o tronco inclina para a frente na arrancada, para trás na freada e para
// dentro da curva. Mede o ângulo do tronco (pelve → peito) da pose (anim.js, função pura).
//   node tools/teste-inclinacao.mjs
import { criarMundo, passo } from '../js/sim.js';
import { pose, J, NJ } from '../js/anim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { tabelaTexto, fmt, media, DEG } from './lib/medidas.mjs';

function inclinacao(j, out) {
  const px = out[J.pelve * 3], py = out[J.pelve * 3 + 1], pz = out[J.pelve * 3 + 2];
  const cx = out[J.peito * 3], cy = out[J.peito * 3 + 1], cz = out[J.peito * 3 + 2];
  const dx = cx - px, dy = cy - py, dz = cz - pz;
  const fx = Math.cos(j.rumo), fz = Math.sin(j.rumo);
  const fr = dx * fx + dz * fz;          // para a frente
  const la = -dx * fz + dz * fx;         // para a direita
  return { frente: Math.atan2(fr, dy) * DEG, lado: Math.atan2(la, dy) * DEG };
}

function medir(roteiro, ini, fim, semBola = false) {
  const m = criarMundo({ semente: 4, jogadores: [{ id: 0, x: -30, z: 0, rumo: 0 }], bola: semBola ? { x: 40, z: 30 } : { x: -29.6, z: 0 }, posse: semBola ? null : 0 });
  const j = m.jogadores[0];
  const out = new Float32Array(NJ * 3);
  const fr = [], la = [];
  for (let i = 0; i < fim; i++) {
    passo(m, { 0: roteiro(i * PASSO) });
    if (i >= ini) { pose(j, m, out); const a = inclinacao(j, out); fr.push(a.frente); la.push(a.lado); }
  }
  return { frente: media(fr), lado: media(la) };
}

const parado = medir(() => ({ x: 0, z: 0, botoes: 0 }), 30, 90, true);
const corrida = medir(() => ({ x: 1, z: 0, botoes: 0 }), 240, 300, true);
const arranca = medir(() => ({ x: 1, z: 0, botoes: BOTAO.CORRER }), 2, 30, true);
const freia = medir(t => (t < 4 ? { x: 1, z: 0, botoes: 0 } : { x: 0, z: 0, botoes: 0 }), 242, 262, true);
const curvaE = medir(t => ({ x: Math.cos(-t * 0.9), z: Math.sin(-t * 0.9), botoes: 0 }), 150, 300, true);
const curvaD = medir(t => ({ x: Math.cos(t * 0.9), z: Math.sin(t * 0.9), botoes: 0 }), 150, 300, true);

const linhas = [['situação', 'para a frente (°)', 'para o lado (°, + = direita)']];
for (const [n, r] of [['parado', parado], ['corrida constante', corrida], ['arrancada (0,5 s)', arranca], ['freada', freia], ['curva à esquerda', curvaE], ['curva à direita', curvaD]]) {
  linhas.push([n, fmt(r.frente, 1), fmt(r.lado, 1)]);
}
console.log(tabelaTexto(linhas));
const metas = [
  ['arrancada inclina para a frente (≥ 8° a mais que parado)', arranca.frente >= parado.frente + 8],
  ['freada inclina para trás (≥ 5° a menos que a corrida)', freia.frente <= corrida.frente - 5],
  ['curva à esquerda inclina para a esquerda (≤ −4°)', curvaE.lado <= -4],
  ['curva à direita inclina para a direita (≥ 4°)', curvaD.lado >= 4],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Resultado'], ...metas.map(m => [m[0], m[1] ? 'PASSOU' : 'REPROVOU'])]));
const ok = metas.every(m => m[1]);
console.log(ok ? '\nteste-inclinacao: PASSOU' : '\nteste-inclinacao: REPROVOU');
process.exit(ok ? 0 : 1);
