// Sessão de treino da Etapa 1 (pura: sem three.js nem DOM). A página (main.js) e os testes em
// Node usam EXATAMENTE estas funções, na mesma ordem — por isso o hash do mundo sai igual no
// navegador e no Node com o mesmo roteiro de entradas.

import { criarMundo, passo, jogadorPorId } from './sim.js';
import { cuidarBolaFora, maquinaPasse, alternarMarcador, devolverBola, ID_MARCADOR } from './treino.js';
import { BOTAO } from './config.js';

export const ID_HUMANO = 0;
export { ID_MARCADOR };

/** Ações de treino aceitas por passoTreino. */
export const ACOES = ['recomecar', 'maquina', 'marcador'];

/**
 * Cria o mundo de treino: um jogador humano (id 0) com a bola no pé.
 * opc: {semente, x, z, rumo, attr, marcador (liga o marcador de treino já no início)}
 */
export function criarTreino(opc = {}) {
  const x = opc.x ?? 0, z = opc.z ?? 0, rumo = opc.rumo ?? 0;
  const m = criarMundo({
    semente: opc.semente ?? 1,
    jogadores: [{ id: ID_HUMANO, x, z, rumo, attr: opc.attr ?? {}, time: 0, papel: 'humano' }],
    bola: { x: x + Math.cos(rumo) * 0.4, z: z + Math.sin(rumo) * 0.4 },
    posse: ID_HUMANO,
  });
  if (opc.marcador) alternarMarcador(m, ID_HUMANO);
  return m;
}

/** Aplica uma ação de treino no mundo (depois do passo, para o evento entrar no passo). */
export function aplicarAcao(m, acao) {
  if (acao === 'recomecar') devolverBola(m, ID_HUMANO);
  else if (acao === 'maquina') maquinaPasse(m, ID_HUMANO);
  else if (acao === 'marcador') {
    const ligado = alternarMarcador(m, ID_HUMANO);
    m.eventos.push({ tipo: ligado ? 'marcadorLigado' : 'marcadorDesligado' });
  }
}

/**
 * Um passo de treino (1/60 s): passo da simulação, bola fora volta ao pé e ações pedidas.
 * entrada = {x, z, botoes} do jogador humano (analógico já no mundo). Devolve os eventos.
 */
export function passoTreino(m, entrada, acoes) {
  passo(m, { [ID_HUMANO]: entrada });
  cuidarBolaFora(m, ID_HUMANO);
  if (acoes) for (const a of acoes) aplicarAcao(m, a);
  return m.eventos;
}

/** Marcador de treino ligado? */
export function marcadorLigado(m) {
  return !!jogadorPorId(m, ID_MARCADOR);
}

// Demonstração (?demo=1): o jogador conduz sozinho em curva em volta de um ponto. É função
// pura do estado do mundo (determinística), usada nos prints e nos testes.
export const DEMO = { cx: 30, cz: 2, raio: 9, mag: 0.82, inicio: { x: 22, z: 8, rumo: -0.6 } };

export function entradaDemo(m, opc = DEMO) {
  const j = jogadorPorId(m, ID_HUMANO);
  if (!j) return { x: 0, z: 0, botoes: 0 };
  const dx = j.x - opc.cx, dz = j.z - opc.cz;
  const d = Math.hypot(dx, dz) || 1;
  const rx = dx / d, rz = dz / d;
  // tangente no sentido anti-horário visto de cima + correção para voltar ao raio
  let tx = -rz, tz = rx;
  const err = (d - opc.raio) * 0.3;
  tx -= rx * err; tz -= rz * err;
  const l = Math.hypot(tx, tz) || 1;
  // a cada ~6 s, 2 s de arrancada (para a passada e a inclinação aparecerem)
  const ciclo = m.tick % 360;
  const botoes = ciclo > 240 ? BOTAO.CORRER : 0;
  return { x: (tx / l) * opc.mag, z: (tz / l) * opc.mag, botoes };
}
