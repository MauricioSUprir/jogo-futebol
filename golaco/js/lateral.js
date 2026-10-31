// Lateral com as duas mãos (IFAB Regra 15; Etapa 4). Puro: sem three.js nem DOM; matemática pelo MD. Constantes em
// config.js LATERAL. Só existe na partida (m.parada do tipo 'lateral').
//
// Montagem (partida.js): o cobrador fica com o pé da frente sobre a linha lateral, de frente para o campo, com a bola
// nas duas mãos atrás da cabeça — a bola do estado fica nas mãos (segurarLateral, chamada pelo sim.js no lugar da
// física da bola, e anim.js põe as palmas dos dois lados dela). O pedido (PASSE, ENFIADA ou LANÇAMENTO; o CHUTE não
// vale) começa o arremesso: a bola faz o arco por cima da cabeça em LATERAL.tempo s e sai das mãos à frente do corpo
// (acoes.js arremessoLateral, a física de sempre depois disso).
//
// Três opções (opcoesLateral): os companheiros de linha a LATERAL.dMin–dMax m da bola com a melhor nota (risco da linha
// pelo acoes.js riscoLinha, distância perto de dIdeal, um pouco à frente). O humano escolhe pelo analógico (a opção mais
// perto da direção dele; solto, a 1ª) e a página marca as três no gramado (render/marcas-lateral.js), a escolhida em
// destaque. A IA sorteia uma delas na montagem (LATERAL.pesos) — ou, perto da área, o arremesso longo (longaNaArea).

import { LATERAL, CAMPO } from './config.js';
import { MD } from './matdet.js';
import { clamp } from './mat.js';
import { riscoLinha, ataca } from './acoes.js';

const L = LATERAL;

/** Parada de lateral montada e ainda não cobrada (o cobrador segura a bola)? */
export function lateralSegurando(m) {
  const pr = m.parada;
  return !!(pr && pr.tipo === 'lateral' && !pr.rolou && pr.cobrador != null);
}

function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/**
 * Ponto da bola nas mãos do cobrador `c` (escreve em out {x, y, z}): s = 0 segurando atrás da cabeça; s = 1 a soltura,
 * à frente do corpo; no meio, o arco por cima da cabeça (Bézier quadrática: atrás → por cima → à frente).
 */
export function pontoMaosLateral(c, s, out) {
  const fx = MD.cos(c.rumo), fz = MD.sin(c.rumo);
  const e = suave(s), a = 1 - e;
  // controle do meio: um pouco à frente da cabeça, acima do topo (a curva passa no topo em e = 0,5)
  const fM = (L.soltaFrente - L.tras) * 0.5, yM = 2 * L.topo - (L.altura + L.soltaAltura) / 2;
  const f = a * a * -L.tras + 2 * a * e * fM + e * e * L.soltaFrente;
  out.x = c.x + fx * f;
  out.y = a * a * L.altura + 2 * a * e * yM + e * e * L.soltaAltura;
  out.z = c.z + fz * f;
  return out;
}

const _p = { x: 0, y: 0, z: 0 };
/**
 * Bola nas mãos do cobrador do lateral (o sim.js chama no passo da bola, no lugar da física): parada, no ponto das
 * mãos — segurando ou no arco do arremesso (m.parada.arremesso). Devolve true se segurou.
 */
export function segurarLateral(m) {
  if (!lateralSegurando(m)) return false;
  const pr = m.parada;
  let c = null;
  for (const o of m.jogadores) if (o.id === pr.cobrador) { c = o; break; }
  if (!c) return false;
  const a = pr.arremesso;
  const s = a ? clamp((m.tick + 1 - a.tick0) / Math.max(1, a.solta - a.tick0), 0, 1) : 0;
  pontoMaosLateral(c, s, _p);
  const b = m.bola;
  b.p.x = _p.x; b.p.y = _p.y; b.p.z = _p.z;
  b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0;
  b.rolando = false;
  return true;
}

/** Velocidade máxima do arremesso do jogador j (m/s): pela força e pelo passe longo. */
export function vMaxArremesso(j) {
  const a = j.par.attr;
  const n = clamp((0.6 * (a.forca ?? 60) + 0.4 * (a.passeLongo ?? 60) - 40) / 55, 0, 1);
  return L.vMax[0] + (L.vMax[1] - L.vMax[0]) * n;
}

const _cand = [];
/**
 * As até 3 opções do lateral do cobrador `c`, da melhor para a pior: companheiros de linha (não o goleiro, não quem
 * está parado) a dMin–dMax m da bola. Nota (menor = melhor): risco da linha + distância longe de dIdeal − à frente.
 * Escreve os jogadores em `out` (array) e devolve `out`.
 */
export function opcoesLateral(m, c, out = []) {
  out.length = 0;
  _cand.length = 0;
  const b = m.bola.p, lado = ataca(m, c.time);
  for (const o of m.jogadores) {
    if (o.time !== c.time || o === c || o.posicao === 'GOL' || o.papel === 'parado') continue;
    const d = MD.hypot(o.x - b.x, o.z - b.z);
    if (d < L.dMin || d > L.dMax) continue;
    const u = (o.x - b.x) * lado;
    const s = L.risco * riscoLinha(m, c, b.x, b.z, o.x, o.z, 12) + 0.3 * Math.abs(d - L.dIdeal) - L.frente * clamp(u, -10, 15);
    _cand.push({ o, s });
  }
  _cand.sort((p, q) => p.s - q.s || p.o.id - q.o.id);
  for (let i = 0; i < _cand.length && i < 3; i++) out.push(_cand[i].o);
  return out;
}

/**
 * A opção para onde o analógico do cobrador aponta (a de menor ângulo até a direção dele, com |analógico| > 0,3);
 * solto, a 1ª. Devolve o índice em `ops` (−1 sem opções, ou se a melhor fica abaixo do cosseno `cosMin`).
 */
export function opcaoMirada(m, c, ops, cosMin = -2) {
  if (!ops.length) return -1;
  if (!(c.imag > 0.3)) return 0;
  const b = m.bola.p;
  let mel = 0, mc = -Infinity;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i], ox = o.x - b.x, oz = o.z - b.z, l = MD.hypot(ox, oz) || 1;
    const cos = (ox * c.imx + oz * c.imz) / l; // a mira (pela tela: C6)
    if (cos > mc) { mc = cos; mel = i; }
  }
  return mc < cosMin ? -1 : mel;
}

/** Alvo do arremesso longo na área atacada (perto do 1º pau, na altura da marca da pequena área). */
export function alvoLongoNaArea(m, c, out) {
  const lado = ataca(m, c.time), sz = m.bola.p.z >= 0 ? 1 : -1;
  out.x = lado * (CAMPO.meioX - CAMPO.pequenaArea.profundidade - 1.5);
  out.z = sz * (CAMPO.pequenaArea.largura / 2 - 1);
  return out;
}
