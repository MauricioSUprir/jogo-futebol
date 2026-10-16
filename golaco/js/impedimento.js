// Impedimento (IFAB Regra 11; Etapa 4). Puro: sem three.js nem DOM. Constantes em config.js IMPEDIMENTO.
//
// Posição de impedimento (não é infração por si): no campo adversário (sem a linha do meio) e mais perto da linha
// de fundo adversária que a bola E o penúltimo adversário (o goleiro conta), no instante em que um companheiro joga
// ou toca a bola. "Na mesma linha" não é impedimento (IMPEDIMENTO.tolerancia). Conta o corpo (o centro do jogador).
//
// Infração: quem estava em posição de impedimento na última jogada do companheiro TOCA a bola — direto do passe,
// no rebote da trave, do corpo de um adversário ou de uma DEFESA do goleiro (ganhar vantagem). A jogada deliberada
// de um adversário (domínio, passe, chute, chutão) zera a foto; a defesa do goleiro e a bola que bate no corpo não
// zeram. Recebendo direto de tiro de meta, lateral ou escanteio não há impedimento (a foto só volta no próximo
// toque do time). Recomeço (partida.js): tiro livre indireto do outro time no ponto em que ele tocou a bola.
//
// Estado em m.partida.imped = null | {time (quem ataca), ids: [quem estava impedido], tick (da jogada), linhaX
// (x da linha no mundo: o maior entre o penúltimo adversário, a bola e o meio), por (id de quem jogou), defensor (id do
// penúltimo adversário que fazia a linha, ou null se a linha era a bola ou o meio-campo)}. O `defensor` é só para o
// desenho (a cena semiautomática do replay): o hash não o lê.

import { IMPEDIMENTO } from './config.js';
import { jogadorPorId } from './sim.js';

/** Recomeços dos quais não há impedimento recebendo direto (Regra 11.3). */
export const SEM_IMPEDIMENTO = new Set(['tiroDeMeta', 'lateral', 'escanteio']);

/**
 * Penúltimo adversário do time t (o goleiro conta), no referencial de quem ataca: {u, id}. u = x · ataca[t].
 * Com menos de 2 adversários (não acontece na partida), −∞.
 */
export function penultimoAdversario(m, t) {
  const lado = m.ataca[t];
  let u1 = -Infinity, u2 = -Infinity, i1 = null, i2 = null;
  for (const o of m.jogadores) {
    if (o.time === t || o.papel === 'marcador') continue;
    const u = o.x * lado;
    if (u > u1) { u2 = u1; i2 = i1; u1 = u; i1 = o.id; } else if (u > u2) { u2 = u; i2 = o.id; }
  }
  return { u: u2, id: i2 };
}

/**
 * Linha de impedimento do time t AGORA (no referencial de quem ataca): o maior entre o penúltimo adversário, a bola
 * e o meio-campo. {u, x (mundo), defensor (id do penúltimo, ou null se a linha é a bola ou o meio)}.
 */
export function linhaImpedimento(m, t, out = { u: 0, x: 0, defensor: null }) {
  const lado = m.ataca[t];
  const p = penultimoAdversario(m, t);
  const ub = m.bola.p.x * lado;
  let u = Math.max(p.u, ub, 0);
  out.u = u; out.x = u * lado; out.defensor = u === p.u ? p.id : null;
  return out;
}

/** O jogador j (do time t) está em posição de impedimento com a linha `u` (referencial de t)? */
export function emPosicaoDeImpedimento(m, j, u) {
  return j.x * m.ataca[j.time] > u + IMPEDIMENTO.tolerancia;
}

const _l = { u: 0, x: 0, defensor: null };
/** Foto da jogada: o companheiro `idToque` (time t) jogou/tocou a bola agora — quem está impedido. */
export function fotografar(m, t, idToque) {
  linhaImpedimento(m, t, _l);
  const ids = [];
  for (const j of m.jogadores) {
    if (j.time !== t || j.id === idToque || j.papel === 'marcador') continue;
    if (emPosicaoDeImpedimento(m, j, _l.u)) ids.push(j.id);
  }
  m.partida.imped = { time: t, ids, tick: m.tick, linhaX: _l.x, por: idToque, defensor: _l.defensor };
  return m.partida.imped;
}

const _toques = [];
/**
 * Regra do impedimento no fim do passo (partida.js regrasPartida, com a bola rolando). Lê quem tocou a bola neste
 * passo (o dono — no pé ou na mão —, os eventos de passe/chute, bola no corpo e defesa do goleiro) e:
 *  1) se um impedido da foto tocou: devolve a infração {id, time, x, z, linhaX, tick, por, defensor} (não mexe em nada);
 *  2) jogada deliberada do adversário (não a defesa nem a bola no corpo): zera a foto;
 *  3) recomeço sem impedimento (tiro de meta, lateral, escanteio) neste passo: zera e não fotografa;
 *  4) jogada/toque de alguém (deliberado): nova foto para o time dele.
 * Devolve null sem infração.
 */
export function regraImpedimento(m) {
  // Modo Livre (livre.js): não há impedimento — nenhuma foto, nenhuma infração
  if (m.livre) { m.partida.imped = null; return null; }
  const p = m.partida;
  _toques.length = 0;
  let direto = false;
  const dono = m.naMao ?? m.posse;
  if (dono != null) _toques.push(dono, 1);
  for (const e of m.eventos) {
    if (e.tipo === 'passe' || e.tipo === 'chute' || e.tipo === 'roubada') _toques.push(e.id, 1);
    else if (e.tipo === 'bateuCorpo') _toques.push(e.id, 0);
    else if (e.tipo === 'defesa') _toques.push(e.id, 2);
    else if (e.tipo === 'cobranca' && SEM_IMPEDIMENTO.has(e.parada)) direto = true;
  }
  const im = p.imped;
  if (im) {
    for (let k = 0; k < _toques.length; k += 2) {
      const id = _toques[k];
      if (!im.ids.includes(id)) continue;
      const j = jogadorPorId(m, id);
      if (!j || j.time !== im.time) continue;
      return { id, time: im.time, x: m.bola.p.x, z: m.bola.p.z, linhaX: im.linhaX, tick: im.tick, por: im.por, defensor: im.defensor ?? null };
    }
    for (let k = 0; k < _toques.length; k += 2) {
      if (_toques[k + 1] !== 1) continue;
      const j = jogadorPorId(m, _toques[k]);
      if (j && j.time !== im.time) { p.imped = null; break; }
    }
  }
  if (direto) { p.imped = null; return null; }
  // nova foto: a jogada deliberada mais recente do passo (o evento de passe/chute vale mais que o dono, que é o
  // mesmo jogador ou o recebedor — o recebedor também "toca" a bola)
  for (let k = _toques.length - 2; k >= 0; k -= 2) {
    if (_toques[k + 1] !== 1) continue;
    const j = jogadorPorId(m, _toques[k]);
    if (j) fotografar(m, j.time, j.id);
    break;
  }
  return null;
}
