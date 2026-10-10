// IA da partida 11×11 (Etapa 3): despacho por jogador e a IA SEM a bola (Parte 2): fase do time,
// bloco, linha alinhada, zona e marcação na área, 1º e 2º homem, gatilhos, contrapressão e
// recomposição, sempre pelo ponto de referência da tática (tatica.js posicaoTatica). Com a bola
// chama ia-ataque.js (Parte 3). O movimento continua saindo do para() do ia.js (modos calma/pressa
// e histerese), que fica congelado para o treino. Pura: sem three.js nem DOM; só MD e m.rng.
// Plano 2.1–2.4; constantes em config.js TATICA e IA_DEFESA.
//
// Só roda com m.times (sim.js: m.times ? entradaIATatica : entradaIA). Com m.partida.iaClassica
// (modo --antes dos testes) devolve a IA clássica do treino.
//
// ESQUELETO (Parte 0): recebe / corrida / bola livre e a fase 'sem' ficam com a IA clássica; com a
// bola, chama ia-ataque.js (que devolve null) e cai na clássica.

import { entradaIA, vaiNaBolaLivre } from './ia.js';
import { apoioTatico, condutorTatico } from './ia-ataque.js';
import { faseDoTime } from './tatica.js';

/**
 * Estado do para() (j.ia) pronto para este tick — a mesma inicialização do entradaIA (use antes de
 * chamar para() de fora do ia.js: o ponto suavizado só vale se a IA guiou o jogador no tick anterior).
 */
export function estadoIA(m, j) {
  const s = j.ia ??= { fx: 0, fz: 0, filtro: false, parado: false, corre: false, ataca: false, ramo: '', cond: -1, cvx: 0, cvz: 0, tick: -2 };
  if (m.tick - s.tick > 1) { s.filtro = false; s.parado = false; s.corre = false; s.ataca = false; }
  s.tick = m.tick;
  return s;
}

/** Entrada virtual {x, z, botoes} do jogador j (não controlado, de linha) na partida. */
export function entradaIATatica(m, j) {
  // modo --antes dos testes, e o goleiro com a bola nas mãos jogado pela IA (a reposição é do ia.js)
  if (m.partida?.iaClassica || m.naMao === j.id) return entradaIA(m, j);
  // recebendo um passe, numa corrida marcada ou indo na bola livre: o código do ia.js
  if ((j.recebe && m.posse !== j.id) || j.corrida) return entradaIA(m, j);
  if (m.posse == null && m.naMao == null && vaiNaBolaLivre(m, j)) return entradaIA(m, j);
  const f = faseDoTime(m, j.time);
  if (m.posse === j.id) return condutorTatico(m, j) ?? entradaIA(m, j);
  if (f.fase === 'com') return apoioTatico(m, j) ?? entradaIA(m, j);
  // sem a bola (Parte 2): bloco, linha, zona, pressão, contrapressão, recomposição
  return entradaIA(m, j);
}
