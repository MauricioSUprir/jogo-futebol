// Cabeceio na bola rolando (entrega "cabeceio + IA intensa", 12/10; pedido do dono, 11/10: "os jogadores não cabeceiam a
// bola, de jeito nenhum"). Puro: sem three.js nem DOM; matemática pelo MD. Constantes em config.js CABECEIO e AEREO.
//
// O PULO é um estado do jogador (j.cab), escrito pela simulação e LIDO pela pose (anim.js: a pose continua função pura
// do estado):
//   j.cab = { tA, td, tc, tp, tf, h, bx, by, bz, cx, cz, vx, vz, saiu, x0, z0, lx, lz, cabeceio }
//   - tA..td: contramovimento (os pés no chão, o quadril baixa e volta); td: sai do chão; tc: o contato, no alto do pulo;
//     tp: pousa (pés plantados); tp..tf: amortece a queda. h = quanto o quadril sobe (0 = cabeceia sem pular: só o tronco
//     e o pescoço vão à bola);
//   - (bx, by, bz) = onde a bola vai estar no contato (a mesma física do jogo: conducao.js preverBola); (cx, cz) = onde o
//     corpo vai para a testa encontrar a bola;
//   - no ar o corpo segue com a velocidade da saída (vx, vz; no máximo CABECEIO.vSaida) e os pés saem do chão e pousam
//     com velocidade zero (teste de patinação: nenhum pé salta, nenhum pouso batendo): vão de onde estavam (x0, z0) para
//     debaixo do corpo e, no fim, até o ponto de pouso (lx, lz).
// A física fica presa ao desenho: o contato (sim.js bolaAltaNoCorpo) só vale com a cabeça DESENHADA (anim.js pose no tick
// do contato) a até CABECEIO.folga m da bola, superfície com superfície.

import { CABECEIO, PASSO, G, CAMPO, PASSADA, JOGADOR, TATICA, ACOES } from './config.js';
import { MD } from './matdet.js';
import { clamp, difAng, lerp } from './mat.js';

const C = CABECEIO;
const DT = PASSO;
const seg = s => Math.round(s / DT);
const TORN = JOGADOR.alturaTornozelo;
const suave = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Quanto o quadril do jogador sobe no pulo, no máximo (m), pela impulsão. */
export function alturaPulo(j) {
  return lerp(C.salto[0], C.salto[1], clamp((j.par.attr.impulsao ?? 65) / 100, 0, 1));
}

/** Distância (m) do quadril ao centro da bola com a cabeça encostando nela pelo eixo do tronco. */
const ALCANCE_TRONCO = C.pescoco + C.contato;

/** Altura máxima (m) do centro da bola que a cabeça desenhada alcança no pulo (de pé + pulo + tronco + o encosto). */
export function alcanceCabeceio(j) {
  return C.hyPe + alturaPulo(j) + ALCANCE_TRONCO + 0.5 * C.folga;
}

/**
 * Tronco indo à bola (bx, by, bz) com o quadril em (px, py, pz) — a cabeça vai pelo eixo do tronco, que aponta para o
 * centro da bola. Escreve em out:
 *  - a = inclinação do tronco a partir da vertical (rad): a da reta quadril → bola, limitada por C.inclina[0] (com a
 *    bola abaixo da cabeça de pé, C.inclina[1]: o tronco desce até a bola baixa) — é a da pose;
 *  - y = a altura do quadril que põe a cabeça encostando na bola (centro da bola a ALCANCE_TRONCO m do quadril), na
 *    vertical de (px, pz), com o tronco o mais em pé possível (até C.inclina[0]) — é a do plano do pulo (quanto subir).
 */
export function inclinacaoAte(px, py, pz, bx, by, bz, out) {
  const L = MD.hypot(bx - px, bz - pz);
  const lim = by < C.hyPe + ALCANCE_TRONCO ? C.inclina[1] : C.inclina[0];
  out.a = clamp(MD.atan2(L, by - py), 0, lim);
  const Lc = Math.min(L, ALCANCE_TRONCO * MD.sin(C.inclina[0]));
  out.y = by - Math.sqrt(ALCANCE_TRONCO * ALCANCE_TRONCO - Lc * Lc);
  return out;
}
const _inc = { a: 0, y: 0 };

/** Quanto o quadril sobe (m) para cabecear a bola na altura y com o corpo a L m dela (0 = sem pulo). */
export function subidaPara(y, L) {
  const Lc = Math.min(L, ALCANCE_TRONCO * MD.sin(C.inclina[0]));
  // (+ margem: correndo, o quadril fica mais baixo que o de pé e a perna aberta o segura — a cabeça não chegava)
  const h = y - Math.sqrt(ALCANCE_TRONCO * ALCANCE_TRONCO - Lc * Lc) - C.hyPe + C.margem;
  return h < C.minPulo ? 0 : h;
}

/** Tempo (s) de preparo do cabeceio que sobe h m: o contramovimento e a subida (0,1 s sem pulo: o tronco vai à bola). */
export function preparoPulo(h) {
  if (h <= 0) return 0.1;
  return C.agacha[0] + Math.max(Math.sqrt(2 * h / G), h * Math.PI / (2 * C.peVel));
}

/**
 * Planeja o cabeceio de j no tick tc com a bola em (bx, by, bz), vindo na direção (ux, uz) (horizontal, unitária):
 * escreve j.cab e devolve j.cab, ou null se a cabeça não alcança (bola alta demais, ou sem tempo de subir). Agora =
 * m.tick (o contato é no passo de m.tick = tc). (nx, nz): deslocamento de lado do ponto do corpo (na disputa, os dois
 * ombro com ombro).
 */
export function planejarPulo(m, j, tc, bx, by, bz, ux, uz, nx = 0, nz = 0, folgaAlc = C.margem) {
  if (j.posicao === 'GOL') return null;
  const nTc = tc - m.tick;
  if (nTc < 1) return null;
  // o corpo vai ao ponto em que a bola chega C.chega m à frente dele (a bola vem na direção u)
  const cx = bx + ux * C.chega + nx, cz = bz + uz * C.chega + nz;
  let h = subidaPara(by, MD.hypot(cx - bx, cz - bz));
  const hMax = alturaPulo(j);
  if (h > hMax + folgaAlc) return null;
  h = Math.min(h, hMax);
  let tA, td, tp, tf;
  if (h < C.minPulo) {
    h = 0;
    tA = Math.max(m.tick + 1, tc - seg(C.janela[0])); td = tc; tp = tc; tf = tc + seg(C.janela[1]);
  } else {
    // subida: o tempo da física (√(2h/g)), e o pé subindo no máximo C.peVel (pico do perfil sen²: h·π / (2·subida))
    let nr = Math.max(Math.round(Math.sqrt(2 * h / G) / DT), Math.ceil(h * Math.PI / (2 * C.peVel * DT)), Math.ceil(C.vooMin / (2 * DT)));
    let nc = seg(C.agacha[0]);
    if (nr + 1 > nTc) {
      // sem tempo de subir tudo: o pulo que cabe (mais baixo); se a cabeça não chega, não cabeceia
      nr = nTc - 1;
      if (nr < 3) return null;
      const hCabe = Math.min(G * ((nr * DT) * (nr * DT)) / 2, 2 * C.peVel * nr * DT / Math.PI);
      if (hCabe < h - 0.05) return null;
      h = Math.min(h, hCabe);
    }
    // (voo curto demais para os pés irem ao pouso sem saltar: cabeceia sem pular — só o tronco vai à bola)
    if (2 * nr * DT < C.vooMin - 1e-9) { h = 0; }
    nc = Math.max(0, Math.min(nc, nTc - 1 - nr));
    td = tc - nr; tA = td - nc; tp = tc + nr; tf = tp + seg(C.amortece[0]);
  }
  j.cab = {
    tA, td, tc, tp, tf, h, bx, by, bz, cx, cz, vx: 0, vz: 0, saiu: false,
    x0: [0, 0], z0: [0, 0], y0: [0, 0], lx: [0, 0], lz: [0, 0], cabeceio: true,
  };
  return j.cab;
}

/** O pulo/cabeceio de j está desenhado no tick t (de tA a tf)? */
export function puloAtivo(j, t) {
  const c = j.cab;
  return !!c && t >= c.tA && t <= c.tf;
}

/** j está no ar no tick t (estado do tick: de td + 1 a tp − 1; em tp os pés já estão plantados)? */
export function noAr(j, t) {
  const c = j.cab;
  return !!c && c.h > 0 && c.saiu && t > c.td && t < c.tp;
}

/**
 * Quadro do pulo no tick t (pura): off = quanto o quadril fica acima (+) ou abaixo (−) de C.hyPe; w = peso do tronco
 * indo à bola (0–1; 1 no contato); arco = peso do tronco arqueado para trás (0–1; pico na subida, 0 no contato); braco =
 * peso dos braços abertos para cima (equilíbrio no ar).
 */
export function quadroPulo(c, t, out) {
  let off = 0;
  if (c.h > 0) {
    if (t < c.td) off = c.td > c.tA ? -C.agacha[1] * MD.sin(Math.PI * (t - c.tA) / (c.td - c.tA)) : 0;
    else if (t <= c.tp) { const s = MD.sin(Math.PI * (t - c.td) / (c.tp - c.td)); off = c.h * s * s; }
    else off = c.tf > c.tp ? -C.amortece[1] * MD.sin(Math.PI * (t - c.tp) / (c.tf - c.tp)) : 0;
  }
  out.off = off;
  // tronco: entra de tA ao contato e sai do contato a tf
  const w = t <= c.tc ? suave((t - c.tA) / Math.max(1, c.tc - c.tA)) : 1 - suave((t - c.tc) / Math.max(1, c.tf - c.tc));
  out.w = w;
  // arqueia na subida (meio do caminho até o contato) e chicoteia para a frente no contato
  out.arco = t < c.tc ? MD.sin(Math.PI * clamp((t - c.tA) / Math.max(1, c.tc - c.tA), 0, 1)) : 0;
  out.braco = c.h > 0 ? (t <= c.tc ? suave((t - c.tA) / Math.max(1, c.tc - c.tA)) : 1 - suave((t - c.tc) / Math.max(1, c.tf - c.tc))) : 0;
  return out;
}

/**
 * Saída do pulo (sim.js, no passo de m.tick = td: o primeiro estado no ar é td + 1). Longe demais do ponto
 * (C.longe m), não pula (j.cab = null). Senão guarda a velocidade da saída (no máximo C.vSaida), os pés de onde saem e
 * os pontos de pouso. Devolve true se saiu do chão.
 */
export function sairDoChao(m, j) {
  const c = j.cab;
  if (MD.hypot(j.x - c.cx, j.z - c.cz) > C.longe) { j.cab = null; return false; }
  // a impulsão escolhe a velocidade da saída: a que leva o corpo ao ponto (cx, cz) no contato, mudando a de agora em no
  // máximo C.impulso m/s (o último apoio empurra para lá) e no máximo C.vSaida
  const Tc = Math.max(1, c.tc - c.td) * DT;
  let ex = (c.cx - j.x) / Tc - j.vx, ez = (c.cz - j.z) / Tc - j.vz;
  const e = MD.hypot(ex, ez);
  if (e > C.impulso) { ex *= C.impulso / e; ez *= C.impulso / e; }
  let vx = j.vx + ex, vz = j.vz + ez;
  const v = MD.hypot(vx, vz);
  if (v > C.vSaida) { vx *= C.vSaida / v; vz *= C.vSaida / v; }
  c.vx = vx; c.vz = vz; c.saiu = true;
  // pouso: o corpo na hora do pouso (no ar ele segue reto) e os pés dos dois lados dele, o da frente um pouco adiante
  const T = (c.tp - c.td) * DT;
  const px = j.x + vx * T, pz = j.z + vz * T;
  const rx = -MD.sin(j.rumo), rz = MD.cos(j.rumo);
  const vv = MD.hypot(vx, vz), fx = vv > 0.3 ? vx / vv : 0, fz = vv > 0.3 ? vz / vv : 0;
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p], s = p === 0 ? -1 : 1;
    c.x0[p] = pe.apoio ? pe.x : pe.tx; c.z0[p] = pe.apoio ? pe.z : pe.tz;
    // (o pé que estava no balanço sai da altura em que estava: pesNoAr desce a sobra até o pouso)
    c.y0[p] = pe.apoio ? 0 : Math.max(0, pe.ty - TORN);
    const adiante = Math.min(0.25, 0.08 * vv) * (p === 0 ? 1 : 0.2);
    c.lx[p] = px + rx * s * PASSADA.afastamentoLateral + fx * adiante;
    c.lz[p] = pz + rz * s * PASSADA.afastamentoLateral + fz * adiante;
  }
  j.vx = vx; j.vz = vz;
  return true;
}

/**
 * Corpo no ar (sim.js passo 2, no lugar da locomoção): segue com a velocidade da saída e o tronco vira para a bola
 * (no máximo JOGADOR.giroCorpoCorrendo rad/s). Muda j.
 */
export function passoCorpoNoAr(m, j) {
  const c = j.cab;
  j.vx = c.vx; j.vz = c.vz;
  j.x += j.vx * DT; j.z += j.vz * DT;
  const alvo = MD.atan2(c.bz - j.z, c.bx - j.x);
  const w = JOGADOR.giroCorpoCorrendo * DT;
  const d = clamp(difAng(j.rumo, alvo), -w, w);
  j.rumo += d; j.giro = d / DT;
  const k = Math.min(1, DT / 0.1);
  j.ax += (0 - j.ax) * k; j.az += (0 - j.az) * k;
}

/**
 * Pés no ar (sim.js passo 2, no lugar da passada) para o estado do tick m.tick + 1: os dois fora do chão, subindo e
 * descendo com o quadril (perfil sen², velocidade zero na saída e no pouso), indo de onde saíram (x0, z0) para debaixo
 * do corpo (até 35% do voo), com ele, e para o ponto de pouso (de 60% em diante). No tick tp, plantados no pouso (como
 * goleiro.js pesMergulho planta os pés do goleiro).
 */
export function pesNoAr(m, j) {
  const c = j.cab, t = m.tick + 1;
  const u = clamp((t - c.td) / Math.max(1, c.tp - c.td), 0, 1);
  const s = MD.sin(Math.PI * u), lift = c.h * s * s;
  const rx = -MD.sin(j.rumo), rz = MD.cos(j.rumo);
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p], ld = p === 0 ? -1 : 1;
    if (t >= c.tp) {
      pe.apoio = true; pe.x = c.lx[p]; pe.z = c.lz[p]; pe.rumo = j.rumo; pe.faseApoio = j.fase - (p === 0 ? 0 : 1);
      pe.lx = pe.x; pe.lz = pe.z; pe.lrumo = j.rumo; pe.bx = pe.x; pe.bz = pe.z; pe.gx = pe.x; pe.gz = pe.z;
      pe.chegou = false; pe.pendente = false; pe.k = 0; pe.puxa = 0;
      pe.tx = pe.x; pe.ty = TORN; pe.tz = pe.z;
      continue;
    }
    pe.apoio = false;
    // um caminho só, suave, de onde saiu ao ponto de pouso no voo inteiro (velocidade zero na saída e no pouso; o pé nunca
    // anda mais que o necessário — o teste de patinação limita o pé a 2,5·v + 3 m/s)
    // (o pé que saiu do chão no meio do balanço parte da altura que tinha — c.y0, acima do tornozelo no chão — e essa sobra
    // some no caminho até o pouso; antes ele caía no chão no 1º passo do voo: ~7 cm num quadro, teste-cabeceio F4)
    const k = suave(u);
    pe.tx = lerp(c.x0[p], c.lx[p], k); pe.tz = lerp(c.z0[p], c.lz[p], k); pe.ty = TORN + lift + (c.y0 ? c.y0[p] * (1 - k) : 0);
    pe.lx = c.lx[p]; pe.lz = c.lz[p]; pe.lrumo = j.rumo; pe.puxa = 0;
  }
}

/**
 * Intenção do cabeceio sem botão (IA e o humano sem apertar nada): {tipo} do pedido.
 *  - na área adversária a até C.gol m do gol: a gol ('chute');
 *  - no meu terço (u < −TATICA.terco): afastar ('lancamento': longe do gol e para o lado);
 *  - no resto: passe de cabeça para um companheiro ('passe').
 * Com a bola entre C.alturaPedido e ACOES.cabeceio.alturaPeito[1] (na altura do peito/rosto), só de cabeça se for para o
 * gol ou para afastar: o passe é de peito (null).
 */
export function intencaoCabeceio(m, j, y) {
  const lado = m.ataca ? m.ataca[j.time] : (j.time === 0 ? 1 : -1);
  const u = j.x * lado;
  const gx = lado * CAMPO.meioX;
  const naArea = u > CAMPO.meioX - CAMPO.area.profundidade && Math.abs(j.z) < CAMPO.area.largura / 2;
  // (o arremesso do lateral do meu time não se afasta: no meu terço ele domina ou passa de cabeça; afastando, a bola ia
  // para fora e virava lateral deles — teste-bolas-paradas E2)
  const doMeuTime = !!(m.voo && m.voo.time === j.time && m.voo.tipo === 'lateral');
  let tipo;
  if (naArea && MD.hypot(gx - j.x, j.z) <= C.gol) tipo = 'chute';
  else if (u < -TATICA.terco && !doMeuTime) tipo = 'lancamento';
  else tipo = 'passe';
  if (y <= ACOES.cabeceio.alturaPeito[1] && tipo === 'passe') return null;
  return { tipo, forca: tipo === 'chute' ? 0.7 : 0.5, auto: true };
}
