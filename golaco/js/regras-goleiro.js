// Mãos do goleiro pelas Leis do Jogo (IFAB 2025/26; pedido do dono, 11/10: "o goleiro só consegue pegar na mão dentro
// da área", "não pode recuo", "eu não consigo mexer com o goleiro"). Puro: sem three.js nem DOM; só MD. Constantes em
// config.js GOLEIRO. Só vale na partida (m.partida): o treino não tem árbitro e continua bit a bit igual.
//
// Regra 12.2 (tiro livre indireto) — o goleiro, NA PRÓPRIA ÁREA, não pode tocar a bola com a mão:
//  - depois de soltá-la, antes de outro jogador tocá-la (m.regraMao.soltou = id do goleiro);
//  - quando ela foi chutada deliberadamente para ele por um companheiro, ou vem direto de um lateral cobrado por um
//    companheiro (m.regraMao.semMao = time: o último toque deliberado foi um chute/passe de um jogador de linha desse
//    time — o lateral daqui é cobrado com o pé, então entra na mesma conta).
// Fora da própria área o goleiro tem as mesmas restrições de qualquer jogador (Regra 12): sem mão — bloqueia com o corpo
// e joga com o pé. "Na área" vale com qualquer parte da bola sobre a área (as linhas são da área).
// Regra 12.3 — com a bola nas mãos por mais de 8 s (GOLEIRO.oitoSegundos), escanteio para o adversário do lado do
// campo mais perto do goleiro; o árbitro conta os 5 últimos com a mão levantada (aqui: um anel no chão, sem texto).
//
// Estado: m.regraMao = {semMao: time | -1, soltou: id | -1} (entra no hash da partida). Quem muda:
//  - acoes.js finalizarChute → registrarChute (chute/passe/lançamento de um jogador de linha: recuo do time dele;
//    toque de outro jogador: o "soltou" acaba);
//  - sim.js (cabeceio, domínio no peito, posse, bateuCorpo, roubada, defesa) → registrarToque;
//  - partida.js bolaMorta → limparRegraMao.

import { CAMPO, BOLA, GOLEIRO, PASSO } from './config.js';
import { MD } from './matdet.js';

const AREA_U = CAMPO.area.profundidade, AREA_W = CAMPO.area.largura / 2;

/** Estado da regra da mão na partida (criado na primeira vez). */
export function estadoMao(m) {
  return m.regraMao ??= { semMao: -1, soltou: -1 };
}

/** x da linha do gol que o goleiro g defende. */
function linhaGol(m, g) {
  const lado = m.ataca ? m.ataca[g.time] : (g.time === 0 ? 1 : -1);
  return -lado * CAMPO.meioX;
}

/**
 * O ponto (x, z) — com a folga `r` (o raio da bola: qualquer parte dela sobre a linha conta) — está na área do goleiro g?
 */
export function naPropriaArea(m, g, x, z, r = BOLA.raio) {
  const gx = linhaGol(m, g), s = gx > 0 ? 1 : -1;
  const u = (gx - x) * s; // distância da linha do gol para dentro do campo
  return u >= -r && u <= AREA_U + r && Math.abs(z) <= AREA_W + r;
}

/**
 * O goleiro g pode tocar com a mão a bola em (x, z)? Fora da partida: sempre (o treino segue como antes). Na partida:
 * na própria área, sem recuo do time dele e sem ter soltado a bola ainda não tocada por outro.
 */
export function maoPermitida(m, g, x, z) {
  if (!m.partida) return true;
  if (!naPropriaArea(m, g, x, z)) return false;
  const R = m.regraMao;
  if (!R) return true;
  return R.semMao !== g.time && R.soltou !== g.id;
}

/** Por que a mão não vale (para o tiro livre indireto do PEGAR): 'recuo' | 'soltou' | 'fora' | null. */
export function motivoSemMao(m, g, x, z) {
  if (!m.partida) return null;
  if (!naPropriaArea(m, g, x, z)) return 'fora';
  const R = m.regraMao;
  if (R && R.soltou === g.id) return 'soltou';
  if (R && R.semMao === g.time) return 'recuo';
  return null;
}

/**
 * Chute/passe/lançamento/cruzamento de j (acoes.js finalizarChute): de um jogador de linha, o goleiro do time dele não
 * pode mais usar a mão (recuo) até outro toque; qualquer toque de outro jogador acaba com o "soltou".
 */
export function registrarChute(m, j, tipo) {
  if (!m.partida) return;
  if (tipo === 'cabeceio') { registrarToque(m, j, 'cabeca'); return; }
  const R = estadoMao(m);
  if (R.soltou >= 0 && R.soltou !== j.id) R.soltou = -1;
  R.semMao = j.posicao === 'GOL' ? -1 : j.time;
}

/**
 * Outro toque deliberado ou não em j (sim.js): `modo` 'cabeca' | 'peito' (o companheiro que cabeceia ou mata no peito
 * para o goleiro não é recuo), 'posse' (domínio com o pé), 'corpo' (a bola bateu nele), 'roubada', 'defesa' (o goleiro).
 * Adversário tocando: o recuo do outro time acaba. Outro jogador tocando: o "soltou" acaba.
 */
export function registrarToque(m, j, modo) {
  if (!m.partida || !j) return;
  const R = estadoMao(m);
  if (R.soltou >= 0 && R.soltou !== j.id) R.soltou = -1;
  if (R.semMao >= 0 && (j.time !== R.semMao || modo === 'cabeca' || modo === 'peito')) R.semMao = -1;
}

/** Bola morta: nada do lance anterior vale. */
export function limparRegraMao(m) {
  if (m.regraMao) { m.regraMao.semMao = -1; m.regraMao.soltou = -1; }
}

/**
 * Relógio da bola na mão (Regra 12.3) do goleiro g: segundos desde que ele está DE PÉ com a bola nas mãos e a bola em
 * jogo (g.segura.dePe, gravado pelo sim.js), ou null.
 */
export function segundosNaMao(m, g) {
  if (!m.partida || m.naMao !== g.id || !g.segura || g.segura.dePe == null) return null;
  if (m.parada && !m.parada.rolou) return null;
  return (m.tick - g.segura.dePe) * PASSO;
}

/**
 * Anel dos últimos 5 s (para o desenho; pura): {id, frac} — frac de 1 (acabou de começar a contagem) a 0 (8 s) — do
 * goleiro do time `time` com a bola nas mãos, ou null.
 */
export function relogioMao(m, time) {
  if (!m.partida || m.naMao == null) return null;
  let g = null;
  for (const o of m.jogadores) if (o.id === m.naMao) { g = o; break; }
  if (!g || g.time !== time) return null;
  const s = segundosNaMao(m, g);
  if (s == null) return null;
  const ini = GOLEIRO.oitoSegundos - GOLEIRO.contagem;
  if (s < ini) return null;
  return { id: g.id, frac: Math.max(0, Math.min(1, 1 - (s - ini) / GOLEIRO.contagem)) };
}

/**
 * Parede da área para o goleiro andando com a bola nas mãos (pela locomoção, como a parede da bola parada): a
 * componente do pedido de movimento para fora da área (até GOLEIRO.maoAnda.margem m antes da linha) fica limitada pelo
 * que dá para frear antes dela (GOLEIRO.maoAnda.freio m/s²). Devolve `mv` ou um pedido novo. Pura.
 */
export function paredeAreaMao(m, g, mv) {
  const A = GOLEIRO.maoAnda;
  const gx = linhaGol(m, g), s = gx > 0 ? 1 : -1;
  let wx = mv.dx * mv.vel, wz = mv.dz * mv.vel, mudou = false;
  // frente da área: normal para fora = −s em x; dentro da linha do gol: +s
  const limites = [
    [AREA_U - A.margem - (gx - g.x) * s, -s, 0],
    [AREA_W - A.margem - g.z, 0, 1],
    [AREA_W - A.margem + g.z, 0, -1],
    [(gx - g.x) * s - A.margem, s, 0],
  ];
  for (const [d, nx, nz] of limites) {
    const vMax = Math.sqrt(2 * A.freio * Math.max(0, d));
    const vOut = wx * nx + wz * nz;
    if (vOut > vMax) { const c = vOut - vMax; wx -= c * nx; wz -= c * nz; mudou = true; }
  }
  if (!mudou) return mv;
  const vel = MD.hypot(wx, wz);
  if (vel < 1e-6) return { dx: mv.dx, dz: mv.dz, vel: 0, rumoAlvo: mv.rumoAlvo };
  return { dx: wx / vel, dz: wz / vel, vel, rumoAlvo: mv.rumoAlvo };
}

/**
 * Ponto do tiro livre indireto por mão do goleiro em (x, z) (Regra 13): dentro da pequena área, na linha dela mais
 * perto (a da frente, no x dela); senão o próprio ponto. Escreve em out {x, z}.
 */
export function pontoTiroLivreMao(m, g, x, z, out = { x: 0, z: 0 }) {
  const gx = linhaGol(m, g), s = gx > 0 ? 1 : -1;
  const pa = CAMPO.pequenaArea, u = (gx - x) * s;
  out.x = x; out.z = z;
  if (u < pa.profundidade && Math.abs(z) < pa.largura / 2) out.x = gx - s * pa.profundidade;
  return out;
}

/**
 * Partida: o goleiro da IA (ou da demo) joga com o pé neste tick? Com a bola no pé, ou indo à bola livre que ele NÃO
 * pode pegar com a mão (recuo, a bola que ele soltou, fora da área) — o passe é para ele, ou ele é quem chega antes do
 * time a ela (perto: GOLEIRO.pe.busca m) e antes dos adversários (ou ela está na área dele).
 */
export function goleiroNoPe(m, g) {
  if (!m.partida || m.naMao === g.id) return false;
  if (m.posse === g.id) return true;
  if (m.posse != null || m.naMao != null || (m.parada && !m.parada.rolou)) return false;
  const b = m.bola.p;
  if (maoPermitida(m, g, b.x, b.z)) return false;
  const v = m.voo;
  if (v && v.para === g.id) return true;
  if (v && v.para != null && v.time === g.time) return false;
  const dg = MD.hypot(g.x - b.x, g.z - b.z);
  if (dg > GOLEIRO.pe.busca) return false;
  let advAntes = false;
  for (const o of m.jogadores) {
    if (o === g || o.papel === 'parado' || o.papel === 'marcador') continue;
    const d = MD.hypot(o.x - b.x, o.z - b.z);
    if (o.time === g.time && o.posicao !== 'GOL' && d < dg) return false;
    if (o.time !== g.time && d < dg) advAntes = true;
  }
  return !advAntes || naPropriaArea(m, g, b.x, b.z);
}
