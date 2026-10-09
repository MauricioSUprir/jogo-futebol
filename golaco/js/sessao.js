// Sessão de treino (pura: sem three.js nem DOM). A página (main.js) e os testes em Node usam
// EXATAMENTE estas funções, na mesma ordem — por isso o hash do mundo sai igual no navegador e no
// Node com o mesmo roteiro de entradas.
//
// Modos:
//  - 'ataque' (Etapa 2, padrão): meu time (goleiro + 5 de linha) ataca o gol de x = +52,5 contra
//    uma defesa (goleiro + 3). Passe, enfiada, lançamento, cruzamento, chute, goleiro e troca.
//  - 'conducao' (Etapa 1): um jogador sozinho com a bola, máquina de passes e marcador.

import { criarMundo, passo, jogadorPorId } from './sim.js';
import { cuidarBolaFora, maquinaPasse, alternarMarcador, devolverBola, ID_MARCADOR } from './treino.js';
import { BOTAO, CAMPO, BOLA } from './config.js';
import { MD } from './matdet.js';
import { criarBola } from './bola.js';
import { entradaIA } from './ia.js';

export const ID_HUMANO = 0;
export { ID_MARCADOR };

/** Ações de treino aceitas por passoTreino. */
export const ACOES = ['recomecar', 'maquina', 'marcador'];

// Elenco do treino de ataque (times fictícios; atributos de jogadores bons, não craques).
const MEU_TIME = [
  { id: 0, posicao: 'MEI', x: -5, z: 0, vaga: { x: 0, z: 0 }, attr: { passe: 80, passeLongo: 76, drible: 78 } },
  { id: 1, posicao: 'ATA', x: 12, z: 2, vaga: { x: 14, z: 0 }, attr: { finalizacao: 82, velocidade: 82, cabeceio: 78 } },
  { id: 2, posicao: 'PON', x: 5, z: -20, vaga: { x: 6, z: -20 }, attr: { velocidade: 85, drible: 80, passeLongo: 74 } },
  { id: 3, posicao: 'PON', x: 5, z: 20, vaga: { x: 6, z: 20 }, attr: { velocidade: 84, drible: 79, passeLongo: 75 } },
  { id: 4, posicao: 'VOL', x: -15, z: 0, vaga: { x: -10, z: 0 }, attr: { passe: 78, forca: 78 } },
  { id: 10, posicao: 'GOL', x: -CAMPO.meioX + 1, z: 0, attr: { reflexo: 76, posicionamento: 74, mergulho: 75 } },
];
const DEFESA = [
  { id: 20, posicao: 'GOL', x: CAMPO.meioX - 1, z: 0, attr: { reflexo: 72, posicionamento: 70, mergulho: 72 } },
  { id: 21, posicao: 'ZAG', x: 30, z: -7, vaga: { x: -8, z: -7 }, attr: { forca: 80, velocidade: 72 } },
  { id: 22, posicao: 'ZAG', x: 30, z: 7, vaga: { x: -8, z: 7 }, attr: { forca: 80, velocidade: 72 } },
  { id: 23, posicao: 'VOL', x: 18, z: 0, vaga: { x: 5, z: 0 }, attr: { forca: 74, velocidade: 74 } },
];

/**
 * Cria o mundo de treino. opc: {modo: 'ataque' | 'conducao', semente, x, z, rumo, attr, marcador}
 */
export function criarTreino(opc = {}) {
  const modo = opc.modo ?? 'ataque';
  if (modo === 'conducao') {
    const x = opc.x ?? 0, z = opc.z ?? 0, rumo = opc.rumo ?? 0;
    const m = criarMundo({
      semente: opc.semente ?? 1,
      jogadores: [{ id: ID_HUMANO, x, z, rumo, attr: opc.attr ?? {}, time: 0, papel: 'humano' }],
      bola: { x: x + MD.cos(rumo) * 0.4, z: z + MD.sin(rumo) * 0.4 },
      posse: ID_HUMANO,
    });
    m.modo = 'conducao';
    if (opc.marcador) alternarMarcador(m, ID_HUMANO);
    return m;
  }
  const jogadores = [
    ...MEU_TIME.map(d => ({ ...d, time: 0, rumo: 0, papel: d.id === 0 ? 'humano' : 'ia' })),
    ...DEFESA.map(d => ({ ...d, time: 1, rumo: Math.PI, papel: 'ia' })),
  ];
  const m = criarMundo({ semente: opc.semente ?? 1, jogadores, bola: { x: -4.6, z: 0 }, posse: 0, controlado: { 0: 0 } });
  m.modo = 'ataque';
  return m;
}

/** Recomeça a jogada do treino de ataque: todos nas posições, bola com o meia. */
export function recomecarAtaque(m) {
  const pos = new Map([...MEU_TIME, ...DEFESA].map(d => [d.id, d]));
  for (const j of m.jogadores) {
    const d = pos.get(j.id);
    if (!d) continue;
    j.x = d.x; j.z = d.z; j.vx = 0; j.vz = 0; j.ax = 0; j.az = 0;
    j.rumo = j.time === 0 ? 0 : Math.PI; j.giro = 0;
    for (const p of j.pes) { p.x = j.x; p.z = j.z; p.apoio = true; }
    j.pes[0].z = j.z - 0.09; j.pes[1].z = j.z + 0.09;
    j.recebe = null; j.corrida = null; j.pedido = null; j.carga = null; j.defesa = null; j.mergulho = null; j.segura = null;
    j.cond.toque = null; j.cond.busca = false; j.cond.ref = null; j.cond.longeDesde = -1; j.cond.ult = null;
  }
  Object.assign(m.bola, criarBola(-4.6, 0));
  m.posse = 0; m.naMao = null; m.voo = null; m.golTick = null; m.foraDesde = null;
  m.controlado[0] = 0;
  m.eventos.push({ tipo: 'recomeco' });
}

function idControlado(m) {
  return m.controlado?.[0] ?? ID_HUMANO;
}

/** Aplica uma ação de treino no mundo (depois do passo, para o evento entrar no passo). */
export function aplicarAcao(m, acao) {
  if (acao === 'recomecar') {
    if (m.modo === 'ataque') recomecarAtaque(m); else devolverBola(m, idControlado(m));
  } else if (acao === 'maquina') maquinaPasse(m, idControlado(m));
  else if (acao === 'marcador') {
    if (m.modo === 'ataque') return;
    const ligado = alternarMarcador(m, ID_HUMANO);
    m.eventos.push({ tipo: ligado ? 'marcadorLigado' : 'marcadorDesligado' });
  }
}

/** Regras do treino de ataque: gol e bola fora recomeçam a jogada. */
function regrasAtaque(m) {
  const b = m.bola;
  if (m.golTick != null) {
    if (m.tick - m.golTick > 150) recomecarAtaque(m);
    return;
  }
  const fora = Math.abs(b.p.x) > CAMPO.meioX + BOLA.raio || Math.abs(b.p.z) > CAMPO.meioZ + BOLA.raio;
  if (!fora) { m.foraDesde = null; return; }
  if (m.foraDesde == null) { m.foraDesde = m.tick; m.eventos.push({ tipo: 'fora' }); return; }
  if (m.tick - m.foraDesde > 60) recomecarAtaque(m);
}

/**
 * Um passo de treino (1/60 s): passo da simulação, regras do treino e ações pedidas.
 * entrada = {x, z, botoes} do humano (time 0; analógico já no mundo). Devolve os eventos.
 */
export function passoTreino(m, entrada, acoes) {
  passo(m, { 0: entrada });
  if (m.modo === 'ataque') regrasAtaque(m);
  else cuidarBolaFora(m, ID_HUMANO);
  if (acoes) for (const a of acoes) aplicarAcao(m, a);
  return m.eventos;
}

/** Marcador de treino ligado? */
export function marcadorLigado(m) {
  return !!jogadorPorId(m, ID_MARCADOR);
}

// Demonstração (?demo=1). No treino de ataque, a IA joga pelo humano (passes, enfiadas, chutes);
// no modo condução, o jogador conduz em curva. Função pura do estado (determinística).
export const DEMO = { cx: 30, cz: 2, raio: 9, mag: 0.82, inicio: { x: 22, z: 8, rumo: -0.6 } };

export function entradaDemo(m, opc = DEMO) {
  if (m.modo === 'ataque') {
    const j = jogadorPorId(m, idControlado(m));
    return j ? entradaIA(m, j) : { x: 0, z: 0, botoes: 0 };
  }
  const j = jogadorPorId(m, ID_HUMANO);
  if (!j) return { x: 0, z: 0, botoes: 0 };
  const dx = j.x - opc.cx, dz = j.z - opc.cz;
  const d = MD.hypot(dx, dz) || 1;
  const rx = dx / d, rz = dz / d;
  // tangente no sentido anti-horário visto de cima + correção para voltar ao raio
  let tx = -rz, tz = rx;
  const err = (d - opc.raio) * 0.3;
  tx -= rx * err; tz -= rz * err;
  const l = MD.hypot(tx, tz) || 1;
  // a cada ~6 s, 2 s de arrancada (para a passada e a inclinação aparecerem)
  const ciclo = m.tick % 360;
  const botoes = ciclo > 240 ? BOTAO.CORRER : 0;
  return { x: (tx / l) * opc.mag, z: (tz / l) * opc.mag, botoes };
}
