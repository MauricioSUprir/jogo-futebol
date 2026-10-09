// Treino de ataque jogado pela IA (o modo ?demo=1 e o que o jogador vê em volta dele): não pode
// travar (bola parada sem ninguém ir nela), tem que chegar ao chute e nada vira NaN.
//   node tools/teste-treino.mjs
import { criarTreino, passoTreino, entradaDemo } from '../js/sessao.js';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

let piorParada = 0, chutesMin = Infinity, nan = 0;
const porSemente = [];
for (const sem of [1, 2, 3]) {
  const m = criarTreino({ semente: sem });
  let parado = 0, maxParado = 0, ult = null, chutes = 0, passes = 0, gols = 0;
  for (let i = 0; i < 60 * 120; i++) {
    const ev = passoTreino(m, entradaDemo(m));
    for (const e of ev) { if (e.tipo === 'chute') chutes++; if (e.tipo === 'passe') passes++; if (e.tipo === 'gol') gols++; }
    const b = m.bola.p;
    if (!Number.isFinite(b.x + b.y + b.z)) nan++;
    for (const j of m.jogadores) if (!Number.isFinite(j.x + j.z + j.vx + j.vz)) nan++;
    const p = `${b.x.toFixed(2)},${b.z.toFixed(2)}`;
    parado = p === ult ? parado + 1 : 0;
    maxParado = Math.max(maxParado, parado);
    ult = p;
  }
  piorParada = Math.max(piorParada, maxParado / 60);
  chutesMin = Math.min(chutesMin, chutes);
  porSemente.push(`semente ${sem}: ${chutes} chutes, ${gols} gols, ${passes} passes, parada máx ${fmt(maxParado / 60, 1)} s`);
}
console.log(porSemente.join('\n'));
reg('treino de ataque (IA) — bola parada sem ninguém ir nela', `máx ${fmt(piorParada, 1)} s`, '≤ 5 s', piorParada <= 5);
reg('treino de ataque (IA) — chega ao chute', `pior semente: ${chutesMin} chutes em 2 min`, '≥ 3', chutesMin >= 3);
reg('treino de ataque (IA) — nada vira NaN', `${nan}`, '0', nan === 0);

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-treino: REPROVOU (${falhas})` : '\nteste-treino: PASSOU');
process.exit(falhas ? 1 : 0);
