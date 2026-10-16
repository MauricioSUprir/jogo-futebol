// Botões de defesa do jogador do humano (Etapa 3, Parte 4; plano 2.8): CONTER (acompanha o condutor entre a bola e o
// gol), DIVIDIDA (bote em pé) e PRESSÃO (o companheiro que chega primeiro aperta o condutor; marca no desenho). Pura;
// constantes em config.js DEFESA_HUMANO. Ganchos em sim.js (só agem com os bits apertados ou j.defH ligado; a PRESSÃO
// só na IA tática da partida): entradaConter/pedidoPressao (passo 1) e dividida (passo 3), semAtropelar. Estado:
// j.defH = null | {bote: null | {tick0, contato, cond, longe, pe, bx, bz}, semReacaoAte, tick}; j.conter (filtro e
// histerese do CORRER). iaClassica (o "antes" dos testes): nada disto age. Contrato: CONTRATOS.md.

import { BOTAO, CAMPO, PASSO, ENTRADA, DEFESA_HUMANO, FALTAS, JOGADOR } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { uniforme } from './rng.js';
import { chutarRasteiro } from './bola.js';
import { ataca } from './acoes.js';
import { para } from './ia.js';
import { estadoIA } from './ia-tatica.js';
import { chanceFaltaDividida, montarFalta, registrarFalta, chegada } from './faltas.js';
import { registrarToque } from './regras-goleiro.js';

const C = DEFESA_HUMANO.conter, D = DEFESA_HUMANO.dividida, P = DEFESA_HUMANO.pressao, SA = DEFESA_HUMANO.semAtropelar;
const seg = s => Math.round(s / PASSO);
const TICKS_BOTE = seg(D.tempo);
const SEM_CORRER = ~BOTAO.CORRER;

function porId(m, id) {
  for (const o of m.jogadores) if (o.id === id) return o;
  return null;
}

/** Desligado no "antes" dos testes (a partida com a IA de antes da Etapa 3). */
function desligado(m) {
  return !!(m.partida && m.partida.iaClassica);
}

/**
 * O condutor adversário que o jogador j pode marcar: bola no pé de um adversário (não nas mãos do
 * goleiro), no chão, fora de uma parada ainda não cobrada. Senão null.
 */
export function condutorAdversario(m, j) {
  if (m.posse == null || m.naMao != null) return null;
  if (m.parada && !m.parada.rolou) return null;
  const d0 = porId(m, m.posse);
  if (!d0 || d0.time === j.time) return null;
  if (m.bola.p.y > 0.5) return null;
  return d0;
}

/**
 * Passe do adversário em andamento (bola sem dono, o voo é um passe — não chute — do outro time, fora de parada): o
 * PRESSÃO segue valendo e o chamado corre para onde a bola vai (auditoria dos botões, 12/10: o pedido caía a cada passe
 * da IA e o chamado perdia o embalo). Devolve o voo ou null.
 */
export function passeAdversario(m, time) {
  const v = m.voo;
  if (!v || m.posse != null || m.naMao != null || v.time === time) return null;
  if (m.parada && !m.parada.rolou) return null;
  if (v.tipo === 'chute' || v.tipo === 'colocado' || v.tipo === 'cavadinha' || (v.tipo === 'cabeceio' && v.cabeceio === 'chute')) return null;
  return v.alvo ? v : null;
}

/** Quem a PRESSÃO persegue: o condutor adversário ou, no passe dele, o recebedor (ou o ponto de chegada). */
function alvoPressao(m, time, out) {
  if (m.posse != null) {
    const d0 = m.naMao == null && !(m.parada && !m.parada.rolou) && m.bola.p.y <= 0.5 ? porId(m, m.posse) : null;
    if (!d0 || d0.time === time) return null;
    out.x = d0.x; out.z = d0.z; out.vx = d0.vx; out.vz = d0.vz;
    return out;
  }
  const v = passeAdversario(m, time);
  if (!v) return null;
  // o ponto de chegada do passe, parado (o recebedor vai até ele)
  out.x = v.alvo.x; out.z = v.alvo.z; out.vx = 0; out.vz = 0;
  return out;
}
const _alvoP = { x: 0, z: 0, vx: 0, vz: 0 };

// ------------------------------------------------------------------------------------- CONTER

/**
 * Entrada (velocidade pedida → analógico) que leva o corpo a andar com velocidade (vx, vz): a inversa de
 * jogador.js velocidadeDesejada (sem a bola). Acima da corrida, CORRER pela velocidade do corpo (st.corre).
 */
export function entradaVelocidade(j, vx, vz, st, botoes) {
  const s = MD.hypot(vx, vz);
  const par = j.par;
  // acima da corrida só o CORRER chega lá, e ele é tudo ou nada (vai à arrancada): liga enquanto o corpo
  // está abaixo do pedido e solta acima (com folga), e a velocidade fica em volta da pedida
  if (s > par.vCorrida) {
    const sAgora = MD.hypot(j.vx, j.vz);
    st.corre = sAgora < s + (st.corre ? C.folgaCorrer : -C.folgaCorrer);
  } else st.corre = false;
  if (s < 0.05) return { x: 0, z: 0, botoes: botoes & SEM_CORRER };
  let mag;
  if (s > par.vCorrida) mag = 1;
  else if (s <= par.vTrote) mag = ENTRADA.magTrote * s / par.vTrote;
  else mag = Math.min(1, ENTRADA.magTrote + (1 - ENTRADA.magTrote) * (s - par.vTrote) / (par.vCorrida - par.vTrote));
  return { x: (vx / s) * mag, z: (vz / s) * mag, botoes: (botoes & SEM_CORRER) | (st.corre ? BOTAO.CORRER : 0) };
}

/**
 * Ponto do CONTER para o condutor d0: na linha condutor → meu gol, a dist (1,5–2 m pela velocidade dele;
 * pelo menos folgaBola à frente da bola), com o analógico mexendo de lado (mostra o lado ao condutor) e na
 * distância. Escreve em out {x, z}.
 */
function pontoConter(m, j, d0, e, st, out) {
  const b = m.bola.p;
  const gx = -ataca(m, j.time) * CAMPO.meioX;
  let ux = gx - d0.x, uz = -d0.z;
  const g = MD.hypot(ux, uz) || 1;
  ux /= g; uz /= g;
  const vC = MD.hypot(st.cvx, st.cvz);
  let dist = lerp(C.dist[0], C.dist[1], clamp(vC / C.vRef, 0, 1));
  // analógico: de lado desloca o ponto; para o meu gol afasta, para o condutor aproxima
  const ex = e ? (e.x ?? 0) : 0, ez = e ? (e.z ?? 0) : 0;
  const px = -uz, pz = ux;
  const lat = clamp(ex * px + ez * pz, -1, 1), fr = clamp(ex * ux + ez * uz, -1, 1);
  dist += fr * C.recua;
  // a bola à frente do condutor (na linha do gol): o ponto fica além dela
  const dB = (b.x - d0.x) * ux + (b.z - d0.z) * uz;
  dist = Math.max(dist, dB + C.folgaBola, 1.0);
  out.x = d0.x + ux * dist + px * lat * C.lado;
  out.z = d0.z + uz * dist + pz * lat * C.lado;
  _alvoDist = dist;
  return out;
}

const _alvo = { x: 0, z: 0 };
let _alvoDist = 0;

/**
 * Entrada do controlado com os botões de defesa (gancho do passo 1): o bote em andamento e o tempo sem
 * reação mandam; com CONTER segurado e um condutor adversário, acompanha o condutor (velocidade dele +
 * correção até o ponto do CONTER). null = a entrada do humano vale.
 */
export function entradaConter(m, j, e) {
  const bot = e ? (e.botoes | 0) : 0;
  const h = j.defH;
  if (h) {
    // estado velho (o controle saiu dele no meio do bote): descarta
    if (m.tick - h.tick > 2) { j.defH = null; return entradaConter(m, j, e); }
    if (h.bote) {
      // bote: um passo curto na direção de onde a bola vai estar no contato (o resto é o pé)
      const dx = h.bote.bx - j.x, dz = h.bote.bz - j.z, d = MD.hypot(dx, dz);
      return d > 0.3 ? { x: (dx / d) * 0.6, z: (dz / d) * 0.6, botoes: bot & SEM_CORRER } : { x: 0, z: 0, botoes: bot & SEM_CORRER };
    }
    if (m.tick < h.semReacaoAte) return { x: 0, z: 0, botoes: bot & SEM_CORRER }; // errou: sem reação
  }
  if (!(bot & BOTAO.CONTER) || desligado(m) || j.posicao === 'GOL') return null;
  const d0 = condutorAdversario(m, j);
  if (!d0) return null;
  const st = j.conter ??= { cond: -1, cvx: 0, cvz: 0, cax: 0, caz: 0, corre: false, tick: -2 };
  if (st.cond !== d0.id || m.tick - st.tick > 1) {
    st.cond = d0.id; st.cvx = d0.vx; st.cvz = d0.vz; st.cax = 0; st.caz = 0; st.corre = false;
  } else {
    // velocidade e aceleração do condutor filtradas (o corpo dele é contínuo; a bola não entra)
    const a = Math.min(1, PASSO / C.filtro);
    const vx0 = st.cvx, vz0 = st.cvz;
    st.cvx += (d0.vx - st.cvx) * a; st.cvz += (d0.vz - st.cvz) * a;
    st.cax += ((st.cvx - vx0) / PASSO - st.cax) * a; st.caz += ((st.cvz - vz0) / PASSO - st.caz) * a;
  }
  st.tick = m.tick;
  pontoConter(m, j, d0, e, st, _alvo);
  // velocidade pedida: a do condutor adiantada pela aceleração dele (o corpo acompanha, sem esperar o
  // condutor chegar para recuar) + a correção até o ponto
  let vx = st.cvx + st.cax * C.antecipa + C.ganho * (_alvo.x - j.x);
  let vz = st.cvz + st.caz * C.antecipa + C.ganho * (_alvo.z - j.z);
  // já do lado do gol e perto: chega no condutor devagar (como no "jockey"), para poder recuar na hora em
  // que ele arranca — vindo rápido, a inversão do corpo (freia na linha e vira) deixava o condutor colar
  const gx = -ataca(m, j.time) * CAMPO.meioX;
  let ux = gx - d0.x, uz = -d0.z;
  const g = MD.hypot(ux, uz) || 1;
  ux /= g; uz /= g;
  const aFrente = (j.x - d0.x) * ux + (j.z - d0.z) * uz;
  if (aFrente > 0 && aFrente < _alvoDist + C.perto) {
    const aprox = -((vx - st.cvx) * ux + (vz - st.cvz) * uz);
    if (aprox > C.aproxMax) { vx += (aprox - C.aproxMax) * ux; vz += (aprox - C.aproxMax) * uz; }
  }
  // o CORRER é do CONTER (pela velocidade pedida, com histerese): o do humano não força a arrancada
  return entradaVelocidade(j, vx, vz, st, bot);
}

/**
 * Rumo do tronco pedido no CONTER (de frente para a bola), para o gancho do passo 2 quando ele existir
 * (pedido ao integrador: em sim.js, para o controlado sem a bola, `const r = rumoConter(m, j)` e, se não
 * for null, `mv.rumoAlvo = r` — limitado pela velocidade como o "olha a bola" da IA). null = sem pedido.
 */
export function rumoConter(m, j) {
  const st = j.conter;
  if (!st || st.tick !== m.tick || !(j.botoes & BOTAO.CONTER)) return null;
  const b = m.bola.p;
  return MD.atan2(b.z - j.z, b.x - j.x);
}

// ----------------------------------------------------------------------------------- DIVIDIDA

/** Chance de o bote na hora certa ganhar a bola (desarme × drible/controle, bola solta do pé). */
export function chanceDividida(j, d0, bx, bz) {
  const a = j.par.attr, c = d0.par.attr;
  const dif = (a.desarme ?? 65) - ((c.drible ?? 75) + (c.controle ?? 75)) / 2;
  const dC = MD.hypot(bx - d0.x, bz - d0.z);
  const solta = clamp((dC - D.soltaIni) / D.soltaFaixa, 0, 1);
  return clamp(D.base + D.porAttr * dif + D.solta * solta, D.chance[0], D.chance[1]);
}

/**
 * DIVIDIDA (gancho do passo 3, controlado): na borda do botão começa o bote — o pé sai na direção da bola
 * (toque de domínio marcado no tick do contato: a passada tira o pé do chão e o gesto leva o pé até a
 * bola, conducao.js). No contato, ganha se a bola estiver ao alcance do pé, o condutor não tiver tocado
 * nela nos últimos semToque s e o sorteio (chanceDividida, m.rng) disser que sim: a bola sai para longe
 * do condutor e ele fica sem domínio por um instante. Senão, semReacao s parado (o condutor escapa).
 * Eventos: `dividida {id, ganhou, motivo}` e, ganhando, `roubada {id, dividida: true}`.
 */
export function dividida(m, j) {
  const h = j.defH;
  if (h) {
    if (m.tick - h.tick > 2) { j.defH = null; } // estado velho (o controle saiu dele): descarta
    else if (h.bote) {
      h.tick = m.tick;
      if (m.tick >= h.bote.contato) resolverBote(m, j, h);
      return;
    } else if (m.tick < h.semReacaoAte) { h.tick = m.tick; return; }
    else j.defH = null; // acabou o tempo sem reação
  }
  const apertou = (j.botoes & BOTAO.DIVIDIDA) && !(j.botoesAnt & BOTAO.DIVIDIDA);
  if (!apertou || desligado(m) || j.posicao === 'GOL') return;
  const d0 = condutorAdversario(m, j);
  if (!d0) return;
  const b = m.bola;
  const dB = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  // onde a bola vai estar no contato (rolando com o condutor; a conta só serve para o pé e o passo)
  const tt = TICKS_BOTE * PASSO;
  const bx = b.p.x + b.v.x * tt, bz = b.p.z + b.v.z * tt;
  // pé do lado da bola (a mesma regra da recepção em corrida, conducao.js)
  const hx = MD.cos(j.rumo), hz = MD.sin(j.rumo);
  const la = -(bx - j.x) * hz + (bz - j.z) * hx;
  const pe = la >= 0 ? 1 : 0;
  const contato = m.tick + TICKS_BOTE;
  j.defH = { bote: { tick0: m.tick, contato, cond: d0.id, longe: dB > D.longe, pe, bx, bz }, semReacaoAte: -1, tick: m.tick };
  // o pé sai na direção da bola: toque de domínio marcado (só o gesto e a passada; o bote não é domínio)
  const c = j.cond;
  if (c && !(c.toque && c.toque.tipo === 'aereo')) {
    c.toque = { tick: contato, pe, bx, bz, tipo: 'dominio', modo: 'frente', desde: m.tick, qx: j.x, qz: j.z, bote: true };
  }
}

function resolverBote(m, j, h) {
  const bt = h.bote;
  const c = j.cond;
  if (c && c.toque && c.toque.bote) c.toque = null;
  const b = m.bola;
  const d0 = m.posse === bt.cond && m.naMao == null && !(m.parada && !m.parada.rolou) ? porId(m, bt.cond) : null;
  let motivo = null, ganhou = false;
  if (!d0) motivo = 'semCondutor';
  else if (bt.longe) motivo = 'longe';
  else if (b.p.y > 0.5) motivo = 'alta';
  else {
    const dB = MD.hypot(b.p.x - j.x, b.p.z - j.z);
    const dPe = Math.max(0, dB - D.perna);
    const ult = d0.cond && d0.cond.ult;
    const tocou = ult && (m.tick - ult.tick) * PASSO < D.semToque;
    if (dPe > D.alcance) motivo = 'fora';
    else if (tocou) motivo = 'tocou';
    else {
      ganhou = uniforme(m.rng) < chanceDividida(j, d0, b.p.x, b.p.z);
      if (!ganhou) motivo = 'perdeu';
    }
  }
  // Etapa 4 (só na partida): a dividida que não ganha a bola com o pé no condutor pode ser falta (faltas.js)
  let falta = null;
  // (no Modo Livre não há falta: m.livre)
  if (!ganhou && m.partida && !m.livre && d0 && (motivo === 'perdeu' || motivo === 'tocou') && !m.faltaPendente) {
    const pF = chanceFaltaDividida(m, j, d0, motivo);
    if (uniforme(m.rng) < pF) {
      const v = MD.hypot(j.vx, j.vz);
      const exc = v >= FALTAS.excessivo && uniforme(m.rng) < FALTAS.excessivoP;
      falta = montarFalta(m, j, d0, 'dividida', true, exc);
    }
  }
  m.eventos.push({ tipo: 'dividida', id: j.id, ganhou, motivo: falta ? 'falta' : motivo });
  if (falta) { registrarFalta(m, falta); d0.vx *= 0.5; d0.vz *= 0.5; }
  if (ganhou) {
    let ux = b.p.x - d0.x, uz = b.p.z - d0.z;
    const l = MD.hypot(ux, uz);
    if (l < 1e-6) { ux = d0.x - j.x; uz = d0.z - j.z; }
    const l2 = MD.hypot(ux, uz) || 1;
    chutarRasteiro(b, (ux / l2) * D.vSai, (uz / l2) * D.vSai);
    d0.cond.toque = null; d0.cond.busca = false; d0.cond.semDominioAte = m.tick + seg(D.semDominio);
    m.posse = null; m.voo = null;
    m.ultimoToque = { id: j.id, time: j.time, tick: m.tick };
    if (m.stats) m.stats.roubadas++;
    m.eventos.push({ tipo: 'roubada', id: j.id, dividida: true });
    registrarToque(m, j, 'roubada');
    j.defH = null;
    return;
  }
  // errou: sem reação (se o controle sair dele, a IA também não dá bote nesse tempo)
  j.defH = { bote: null, semReacaoAte: m.tick + seg(D.semReacao), tick: m.tick };
  j.descansoBote = Math.max(j.descansoBote ?? 0, seg(D.semReacao));
}

// ------------------------------------------------------------------------------------ PRESSÃO
// (pedido do dono, 11/10: "o botão de pressão não funciona". Como no EA FC — segurar o botão manda o companheiro que
// chega primeiro PERSEGUIR o condutor de forma agressiva, com uma marca em cima dele; se a IA já aperta, o botão chama o
// segundo. Antes: o mais perto da BOLA ia a 1 m dela, do lado do gol — quase o que a IA já fazia sozinha, sem disputar
// a bola e sem nada na tela; a distância ao condutor caía ~0,5 m.)

/** PRESSÃO segurado: pede à IA tática que um companheiro aperte o condutor (contrato). */
export function pedidoPressao(m, j) {
  (m.pedidoPressao ??= {})[j.time] = m.tick;
}

/**
 * j é o chamado da PRESSÃO do time (o último escolhido de pressionadorDe dentro da validade do pedido, com o pedido
 * valendo)? No passe do adversário ele segue a PRESSÃO até o ponto de chegada (entradaPressao), não entra no corte do
 * passe (ia-tatica.js vaiNaLivre): cortando, ele saía da aproximação da PRESSÃO e, com o domínio do recebedor longe
 * dele, recomeçava do parado (teste-pressao-humano M5, o chamado que corre de verdade). Sem o botão, sempre false (a
 * partida IA × IA não muda).
 */
export function chamadoDaPressao(m, j) {
  if (!pressaoPedida(m, j.time)) return false;
  const c = m.pressaoHumano?.[j.time];
  return !!c && c.ult === j.id && c.ultTick >= 0 && m.tick - c.ultTick <= seg(P.validade);
}

/** O pedido de PRESSÃO do time está valendo neste tick? */
export function pressaoPedida(m, time) {
  const t = m.pedidoPressao?.[time];
  return t != null && m.tick - t <= P.validade && !desligado(m);
}

/**
 * Ponto de encontro do jogador o com o condutor d0 (velocidade vx, vz): a P.colado m do corpo do condutor, na linha dele
 * até o meu gol, adiantado pelo tempo que o jogador leva para chegar (até P.leadMax s; 3 voltas do ponto fixo — quem
 * persegue o condutor que foge por trás não chega: o tempo cresce). Escreve em out {x, z, ux, uz, t} (u = direção
 * condutor → meu gol; t = tempo de chegada).
 */
function pontoEncontro(m, time, o, d0, vx, vz, out) {
  const gx = -ataca(m, time) * CAMPO.meioX;
  let ux = gx - d0.x, uz = -d0.z;
  const g = MD.hypot(ux, uz) || 1;
  ux /= g; uz /= g;
  let t = 0;
  for (let k = 0; k < 3; k++) {
    const l = Math.min(t, P.leadMax);
    out.x = d0.x + vx * l + ux * P.colado; out.z = d0.z + vz * l + uz * P.colado;
    t = tempoChegada(o, out.x, out.z);
  }
  out.ux = ux; out.uz = uz; out.t = t;
  return out;
}
const _pc = { x: 0, z: 0, ux: 0, uz: 0, t: 0 };

/**
 * Tempo (s) de o chegar a (px, pz) em disparada pelo perfil de aceleração do corpo (jogador.js passoCorpo): x(t) = vA·t −
 * (vA − v0)/k · (1 − e^(−k·t)), k = acel0/vTeto; na inversão freia na linha antes (CONTRATOS.md, PRESSÃO).
 */
function tempoChegada(o, px, pz) {
  let dx = px - o.x, dz = pz - o.z, d = MD.hypot(dx, dz);
  if (d < 1e-6) return 0;
  const par = o.par, vA = par.vArrancada, k = par.acel0 / par.vTeto, s = MD.hypot(o.vx, o.vz);
  let v0 = (o.vx * dx + o.vz * dz) / d, t0 = 0;
  if (s > JOGADOR.vGiroLivre && v0 < COS_INVERSAO * s) {
    t0 = s / par.freioGiro;
    const l = s / (2 * par.freioGiro);
    dx -= o.vx * l; dz -= o.vz * l; d = MD.hypot(dx, dz);
    v0 = 0;
  }
  v0 = Math.max(0, v0);
  if (v0 >= vA) return t0 + d / v0;
  // Newton (x(t) convexa e crescente)
  const falta = (vA - v0) / k;
  let t = (d + falta) / vA;
  for (let i = 0; i < 3; i++) {
    const e = MD.exp(-k * t);
    t -= (vA * t - falta * (1 - e) - d) / (vA - (vA - v0) * e);
  }
  return t0 + t;
}

/**
 * Quem do time aperta o condutor a pedido do humano: o companheiro de linha que CHEGA PRIMEIRO ao condutor (pontoEncontro:
 * o tempo de chegada ao ponto adiantado pela corrida do condutor), sem o controlado, o goleiro e `excluir` (o 1º homem da
 * IA que já aperta por conta própria: o botão dobra a marcação). Quem já vai leva P.histerese s de vantagem (e nunca é
 * o excluído). Uma vez por tick (m.pressaoHumano[time] = {tick, id}; o desenho lê por pressionadorVisivel). -1 = ninguém.
 */
export function pressionadorDe(m, time, excluir = -1) {
  const cache = (m.pressaoHumano ??= {});
  const ant = cache[time];
  if (ant && ant.tick === m.tick) return ant.id;
  // o condutor adversário ou, no passe dele, o ponto de chegada (o chamado segue correndo no passe)
  const d0 = alvoPressao(m, time, _alvoP);
  const ctrl = m.humanos.includes(time) ? m.controlado[time] : null;
  // a vantagem (histerese) é do ÚLTIMO escolhido dentro da validade do pedido — não só do tick anterior: no passe do
  // adversário ninguém era chamado e, com o recebedor, outro jogador partia do zero
  const atual = ant && ant.ult >= 0 && m.tick - ant.ultTick <= seg(P.validade) ? ant.ult : -1;
  let id = -1;
  if (d0) {
    let mt = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== time || o.posicao === 'GOL' || o.id === ctrl || o.papel === 'parado' || o.papel === 'marcador') continue;
      if (o.id === excluir && o.id !== atual) continue;
      let t = pontoEncontro(m, time, o, d0, d0.vx, d0.vz, _pc).t;
      // a vantagem de quem já ia só vale se ele continua indo para lá: com o ponto novo (o passe do adversário mudou o
      // alvo) além de JOGADOR.angInversao do sentido da corrida, ele freia na linha até parar (jogador.js passoCorpo) e
      // quem chega primeiro assume (teste-pressao-humano M5, 14/10: o chamado parado no meio da inversão)
      if (o.id === atual && !inverte(o, _pc.x, _pc.z)) t -= P.histerese;
      if (t < mt) { mt = t; id = o.id; }
    }
  }
  const c = (cache[time] ??= { tick: m.tick, id, ult: -1, ultTick: -1 });
  c.tick = m.tick; c.id = id;
  if (id >= 0) { c.ult = id; c.ultTick = m.tick; }
  else if (c.ult === undefined) { c.ult = -1; c.ultTick = -1; }
  return id;
}

/** Correndo (acima de JOGADOR.vGiroLivre), o ponto (px, pz) pede a inversão do corpo (além de JOGADOR.angInversao)? */
function inverte(o, px, pz) {
  const dx = px - o.x, dz = pz - o.z, d = MD.hypot(dx, dz), s = MD.hypot(o.vx, o.vz);
  return s > JOGADOR.vGiroLivre && d > 1e-6 && (o.vx * dx + o.vz * dz) < COS_INVERSAO * s * d;
}
const COS_INVERSAO = MD.cos(JOGADOR.angInversao);

/**
 * Chega freando (o chamado não atropela o — carga, FALTAS.forca): o pedido (vx, vz) fecha em o no máximo pela curva de
 * freada que encosta a P.contato m/s (conta no CONTRATOS.md, PRESSÃO). Escreve em _vf {x, z}; true se limitou.
 */
function chegaFreando(j, o, vx, vz) {
  _vf.x = vx; _vf.z = vz;
  const rx = o.x - j.x, rz = o.z - j.z, dc = MD.hypot(rx, rz);
  if (dc < 1e-6) return false;
  const nx = rx / dc, nz = rz / dc;
  const fecha = (vx - o.vx) * nx + (vz - o.vz) * nz;
  const folga = Math.max(0, dc - 2 * JOGADOR.raio);
  const vo = o.vx * nx + o.vz * nz; // > 0: o se afasta de j; < 0: vem
  const a = P.freioChegada * j.par.freio, perto = Math.max(0, 1 - folga / SA.perto);
  const margem = Math.min(Math.max(0, vo), SA.reacao * JOGADOR.freioGiro) * perto;
  // o condutor vindo: além de dEng a curva vale para a velocidade de j; perto, no referencial do condutor
  const vem = Math.max(0, -vo), c0 = P.contato;
  const dEng = 2 * JOGADOR.raio + (j.par.vCorrida * j.par.vCorrida - c0 * c0) / (2 * a);
  const c = dc > dEng ? c0 : c0 + vem;
  const max = Math.sqrt(c * c + 2 * a * folga) + (dc > dEng ? vem : 0) - margem;
  // com o corpo já acima da curva, pede a curva menos o excesso (o corpo segue o pedido com atraso)
  const fechaCorpo = (j.vx - o.vx) * nx + (j.vz - o.vz) * nz;
  const alvo = max - Math.max(0, fechaCorpo - max);
  if (fecha <= alvo) return false;
  const corte = fecha - alvo;
  _vf.x -= corte * nx; _vf.z -= corte * nz;
  return true;
}
const _vf = { x: 0, z: 0 };

/**
 * Sem atropelar (sim.js, só na partida, o time jogado por uma pessoa): a velocidade pedida para dentro do condutor
 * adversário (ou do recebedor do passe) fica na curva de freada que encosta a ~SA.chega m/s (conta no CONTRATOS.md,
 * "Faltas com sentido"; teste-faltas-sentido B2). A de lado fica; a DIVIDIDA saindo não muda. Devolve mv ou um novo {…mv, dx, dz, vel}.
 */
export function semAtropelar(m, j, mv) {
  if (j.defH && j.defH.bote) return mv;
  let o = condutorAdversario(m, j);
  if (!o && m.posse == null) { const pv = passeAdversario(m, j.time); if (pv && pv.para != null) o = porId(m, pv.para); }
  if (!o || o.time === j.time) return mv;
  const rx = o.x - j.x, rz = o.z - j.z, dc = MD.hypot(rx, rz);
  if (dc < 1e-6) return mv;
  // o chamado da PRESSÃO longe corre pela conta dele (entradaPressao)
  if (dc > P.chega && j.ia && j.ia.ramo === 'pressaoHumano' && m.tick - j.ia.tick <= 1) return mv;
  const nx = rx / dc, nz = rz / dc;
  let vx = mv.dx * mv.vel, vz = mv.dz * mv.vel;
  const entra = vx * nx + vz * nz;
  const folga = Math.max(0, dc - 2 * JOGADOR.raio);
  const vAfasta = Math.max(0, o.vx * nx + o.vz * nz - SA.reacao * JOGADOR.freioGiro * Math.max(0, 1 - folga / SA.perto));
  const max = vAfasta + Math.sqrt(SA.chega * SA.chega + 2 * SA.freio * folga);
  if (entra <= max) return mv;
  vx -= (entra - max) * nx; vz -= (entra - max) * nz;
  const v = MD.hypot(vx, vz);
  if (v < 1e-6) return { ...mv, vel: 0 };
  return { ...mv, dx: vx / v, dz: vz / v, vel: v };
}

/** Disparada na direção (dx, dz) desviando dos corpos (desvio) e chegando freando em o (chegaFreando). */
function corridaAte(m, j, o, dx, dz, st) {
  const l = MD.hypot(dx, dz);
  if (l < 1e-6) return direto(j, dx, dz, true);
  const v = j.par.vArrancada;
  let ux = dx / l, uz = dz / l;
  if (desvio(m, j, o, ux, uz, v)) { ux = _dv.x; uz = _dv.z; }
  if (!o || !chegaFreando(j, o, ux * v, uz * v)) return direto(j, ux, uz, true);
  return entradaVelocidade(j, _vf.x, _vf.z, st, 0);
}

/**
 * Desvio dos corpos no caminho (Reynolds 1999, aproximação máxima prevista em P.desvio.T s): o rumo (ux, uz) gira o
 * bastante para passar a 2 raios + P.desvio.folga m do mais iminente. Escreve em _dv {x, z}; true se desviou.
 */
function desvio(m, j, o, ux, uz, v) {
  const R = 2 * JOGADOR.raio + P.desvio.folga, T = P.desvio.T, A = P.desvio.alcance;
  const wx = ux * v, wz = uz * v;
  let melhor = null, tMin = Infinity;
  for (const p of m.jogadores) {
    if (p === j || p === o || p.papel === 'parado') continue;
    const rx = p.x - j.x, rz = p.z - j.z, d = MD.hypot(rx, rz);
    if (d > A || d < 1e-6) continue;
    const ex = p.vx - wx, ez = p.vz - wz, e2 = ex * ex + ez * ez;
    if (e2 < 1e-6) continue;
    const t = -(rx * ex + rz * ez) / e2;
    if (t <= 0 || t > T) continue;
    const cx = rx + ex * t, cz = rz + ez * t;
    if (MD.hypot(cx, cz) >= R) continue;
    if (t < tMin) { tMin = t; melhor = p; }
  }
  if (!melhor) return false;
  const rx = melhor.x + melhor.vx * tMin - j.x, rz = melhor.z + melhor.vz * tMin - j.z;
  const L = rx * ux + rz * uz, lat = -rx * uz + rz * ux, D = MD.hypot(rx, rz);
  if (D < 1e-6) return false;
  const lado = lat >= 0 ? -1 : 1;
  const ang = MD.atan2(Math.abs(lat), Math.max(L, 1e-6)), preciso = MD.asin(Math.min(1, R / D)) - ang;
  if (preciso <= 0) return false;
  const c = MD.cos(preciso), sn = MD.sin(preciso) * lado;
  _dv.x = ux * c - uz * sn; _dv.z = ux * sn + uz * c;
  return true;
}
const _dv = { x: 0, z: 0 };

/** j é (ou foi há até P.depois s) o chamado da PRESSÃO? (sim.js boteIA: bote com responsabilidade, sem falta tática) */
export function chamadoRecente(m, j) {
  const st = j.pressaoH;
  return !!st && st.tick >= 0 && m.tick - st.tick <= seg(P.depois) && !desligado(m);
}

/**
 * O companheiro que aperta a pedido do humano no último passo (para a marca do desenho: render/jogador3d.js), ou -1.
 * Pura (só lê o que o passo gravou: o desenho nunca muda a simulação).
 */
export function pressionadorVisivel(m, time) {
  const c = m.pressaoHumano?.[time];
  return c && c.tick === m.tick - 1 && c.id >= 0 && pressaoPedida(m, time) ? c.id : -1;
}

/**
 * Entrada do companheiro escolhido por pressionadorDe (a IA tática a dá a ele: ia-tatica.js semBola), com o pedido
 * valendo e um condutor adversário; senão null. Em duas fases:
 *  - APROXIMAÇÃO (a mais de P.chega m do condutor): em disparada (CORRER, analógico cheio, sem o filtro da IA), em linha
 *    reta até o ponto da disputa adiantado pela velocidade do condutor (até P.leadMax s), com desvio e chegaFreando;
 *    vindo por trás dele, contorna pelo lado (não atravessa o corpo do condutor: carga por trás);
 *  - DISPUTA: o ponto a P.colado m do corpo do condutor, do lado do meu gol — a bola fica ao alcance do bote (sim.js
 *    boteIA, 0,65 m) — e, com a bola solta do pé (a mais de P.bolaSolta m dele) e eu mais perto, vai na bola.
 */
export function entradaPressao(m, j) {
  if (!pressaoPedida(m, j.time)) return null;
  // passe do adversário: em disparada até P.colado m do ponto de chegada, pelo lado do meu gol (chegaFreando no recebedor)
  const pv = m.posse == null ? passeAdversario(m, j.time) : null;
  const st = j.pressaoH ??= { corre: false, tick: -1 };
  if (pv) {
    if (pressionadorDe(m, j.time) !== j.id) return null;
    estadoIA(m, j).ramo = 'pressaoHumano';
    st.tick = m.tick;
    const gx = -ataca(m, j.time) * CAMPO.meioX - pv.alvo.x, gz = -pv.alvo.z, g = MD.hypot(gx, gz) || 1;
    const dx = pv.alvo.x + (gx / g) * P.colado - j.x, dz = pv.alvo.z + (gz / g) * P.colado - j.z, d = MD.hypot(dx, dz);
    // perto do ponto, freia (o analógico proporcional à distância): espera o recebedor ali
    if (d < 1) return { x: dx, z: dz, botoes: 0 };
    // em disparada, chegando freando no recebedor (ele vem ao encontro da bola)
    return corridaAte(m, j, pv.para != null ? porId(m, pv.para) : null, dx, dz, st);
  }
  const d0 = condutorAdversario(m, j);
  if (!d0 || pressionadorDe(m, j.time) !== j.id) return null;
  const s = estadoIA(m, j);
  if (s.cond !== d0.id) { s.cond = d0.id; s.cvx = d0.vx; s.cvz = d0.vz; }
  const a = Math.min(1, PASSO / P.filtro);
  s.cvx += (d0.vx - s.cvx) * a; s.cvz += (d0.vz - s.cvz) * a;
  s.ramo = 'pressaoHumano';
  st.tick = m.tick;
  const b = m.bola.p;
  // bola solta do pé do condutor e eu mais perto dela: vou na bola (chegando freando no condutor)
  const dbC = MD.hypot(b.x - d0.x, b.z - d0.z), dbJ = MD.hypot(b.x - j.x, b.z - j.z);
  if (dbC > P.bolaSolta && dbJ < dbC) return corridaAte(m, j, d0, b.x - j.x, b.z - j.z, st);
  const dc = MD.hypot(d0.x - j.x, d0.z - j.z);
  let tx, tz;
  const longe = dc > P.chega;
  if (longe) {
    pontoEncontro(m, j.time, j, d0, s.cvx, s.cvz, _pc);
    tx = _pc.x; tz = _pc.z;
  } else {
    // disputa: na BOLA, pelo lado do meu gol (P.naBola m antes dela), adiantada pela corrida do condutor — a bola fica ao
    // alcance do bote; com ela do outro lado do corpo do condutor (ele protege), o corpo dele segura o meu
    const gx = -ataca(m, j.time) * CAMPO.meioX - b.x, gz = -b.z, g = MD.hypot(gx, gz) || 1;
    _pc.ux = gx / g; _pc.uz = gz / g;
    tx = b.x + _pc.ux * P.naBola + s.cvx * P.leadDisputa; tz = b.z + _pc.uz * P.naBola + s.cvz * P.leadDisputa;
  }
  // vindo por trás do condutor (do lado do gol dele ou nas costas dele: faltas.js chegada) com o corpo dele no caminho:
  // contorna pelo lado (atravessar o corpo dele é carga por trás — falta)
  const rx = j.x - d0.x, rz = j.z - d0.z;
  const atras = rx * _pc.ux + rz * _pc.uz < 0 || chegada(j, d0) === 'tras';
  if (atras) {
    const dx = tx - j.x, dz = tz - j.z, L = MD.hypot(dx, dz) || 1;
    const cx = d0.x - j.x, cz = d0.z - j.z, ao = (cx * dx + cz * dz) / L;
    const lat = (-cx * dz + cz * dx) / L;
    if (ao > 0 && ao < L + JOGADOR.raio * 2 && Math.abs(lat) < P.contorno) {
      const lado = lat > 0 ? -1 : 1, nx = -dz / L * lado, nz = dx / L * lado;
      tx = d0.x + nx * P.contorno + s.cvx * P.leadDisputa; tz = d0.z + nz * P.contorno + s.cvz * P.leadDisputa;
    }
  }
  if (longe) return corridaAte(m, j, d0, tx - j.x, tz - j.z, st);
  // disputa pela VELOCIDADE (como o CONTER): a do condutor + P.ganho × (ponto − corpo), chegando no máximo a P.aproxMax
  // m/s mais rápido que ele — o para() reduzia a intensidade perto do ponto e soltava o CORRER, e o condutor que arrancava
  // fugia; por trás dele, perto (P.trasPerto m), a aproximação fica abaixo da carga por trás (P.trasAprox m/s)
  let vx = s.cvx + P.ganho * (tx - j.x), vz = s.cvz + P.ganho * (tz - j.z);
  let rvx = vx - s.cvx, rvz = vz - s.cvz;
  const rl = MD.hypot(rvx, rvz);
  if (rl > P.aproxMax) { rvx *= P.aproxMax / rl; rvz *= P.aproxMax / rl; }
  vx = s.cvx + rvx; vz = s.cvz + rvz;
  // (pela velocidade de agora do condutor: com a filtrada, quem corta ou freia levava a trombada nas costas)
  if (atras && dc < P.trasPerto) {
    const nx = (d0.x - j.x) / (dc || 1), nz = (d0.z - j.z) / (dc || 1), ap = (vx - d0.vx) * nx + (vz - d0.vz) * nz;
    if (ap > P.trasAprox) { vx -= (ap - P.trasAprox) * nx; vz -= (ap - P.trasAprox) * nz; }
  }
  chegaFreando(j, d0, vx, vz);
  return entradaVelocidade(j, _vf.x, _vf.z, st, 0);
}

/** Analógico cheio na direção (dx, dz), com CORRER. */
function direto(j, dx, dz, correr) {
  const l = MD.hypot(dx, dz);
  if (l < 1e-6) return { x: 0, z: 0, botoes: 0 };
  return { x: dx / l, z: dz / l, botoes: correr ? BOTAO.CORRER : 0 };
}
