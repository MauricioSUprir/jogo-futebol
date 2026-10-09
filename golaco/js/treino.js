// Modo treino da Etapa 1 (puro): máquina de passes (para treinar o domínio), marcador de
// treino (para a proteção) e bola que volta ao pé quando sai do campo.

import { TREINO, CAMPO, BOLA } from './config.js';
import { entre } from './rng.js';
import { chutarRasteiro, criarBola, velParaChegarCom } from './bola.js';
import { criarJogador } from './jogador.js';
import { criarCond } from './conducao.js';
import { jogadorPorId } from './sim.js';

export const ID_MARCADOR = 90;

/** Lança uma bola rasteira na direção do jogador, de um ponto sorteado (vel = de chegada). */
export function maquinaPasse(m, idAlvo, opc = {}) {
  const j = jogadorPorId(m, idAlvo);
  if (!j) return;
  const ang = opc.angulo ?? entre(m.rng, -Math.PI, Math.PI);
  const dist = opc.dist ?? entre(m.rng, TREINO.maquinaDist[0], TREINO.maquinaDist[1]);
  const vel = opc.vel ?? entre(m.rng, TREINO.maquinaVel[0], TREINO.maquinaVel[1]);
  let x = j.x + Math.cos(ang) * dist, z = j.z + Math.sin(ang) * dist;
  x = Math.max(-CAMPO.meioX + 1, Math.min(CAMPO.meioX - 1, x));
  z = Math.max(-CAMPO.meioZ + 1, Math.min(CAMPO.meioZ - 1, z));
  const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
  if (dono) { dono.cond.toque = null; dono.cond.busca = false; }
  m.posse = null;
  const b = m.bola;
  b.p.x = x; b.p.y = BOLA.raio; b.p.z = z;
  // mira um pouco à frente do jogador (para onde ele vai) — erro pequeno
  const dx = j.x + j.vx * 0.3 - x, dz = j.z + j.vz * 0.3 - z;
  const d = Math.hypot(dx, dz) || 1;
  // vel = velocidade de CHEGADA: a saída é maior porque a grama freia a bola
  const v0 = velParaChegarCom(Math.max(0, d - 0.5), vel);
  chutarRasteiro(b, (dx / d) * v0, (dz / d) * v0);
  b.w.y = 0;
  m.eventos.push({ tipo: 'maquina' });
}

/** Liga/desliga o marcador de treino perto do jogador. */
export function alternarMarcador(m, idAlvo) {
  const i = m.jogadores.findIndex(j => j.id === ID_MARCADOR);
  if (i >= 0) { m.jogadores.splice(i, 1); return false; }
  const j = jogadorPorId(m, idAlvo);
  const x = (j ? j.x : 0) + 5, z = j ? j.z : 0;
  const mk = criarJogador(ID_MARCADOR, x, z, Math.PI, { velocidade: 70, aceleracao: 70, forca: 70 }, 1);
  mk.papel = 'marcador';
  mk.cond = criarCond();
  mk.descanso = 30;
  m.jogadores.push(mk);
  return true;
}

/** Bola fora das linhas: depois de 1 s volta ao pé do jogador. Chamar a cada passo. */
export function cuidarBolaFora(m, idAlvo) {
  const b = m.bola;
  const fora = Math.abs(b.p.x) > CAMPO.meioX + BOLA.raio || Math.abs(b.p.z) > CAMPO.meioZ + BOLA.raio;
  const dentroDoGol = Math.abs(b.p.x) > CAMPO.meioX && Math.abs(b.p.z) < CAMPO.gol.largura / 2 && b.p.y < CAMPO.gol.altura;
  if (!fora) { m.foraDesde = null; return; }
  if (m.foraDesde == null) {
    m.foraDesde = m.tick;
    m.eventos.push({ tipo: dentroDoGol ? 'gol' : 'fora' });
    return;
  }
  if (m.tick - m.foraDesde < 60) return;
  m.foraDesde = null;
  devolverBola(m, idAlvo);
}

/** Bola parada no pé do jogador (recomeçar). */
export function devolverBola(m, idAlvo) {
  const j = jogadorPorId(m, idAlvo);
  if (!j) return;
  const nb = criarBola(j.x + Math.cos(j.rumo) * 0.4, j.z + Math.sin(j.rumo) * 0.4);
  Object.assign(m.bola, nb);
  m.posse = j.id;
  j.cond.toque = null; j.cond.busca = false; j.cond.ref = null; j.cond.longeDesde = -1;
  m.eventos.push({ tipo: 'recomeco' });
}
