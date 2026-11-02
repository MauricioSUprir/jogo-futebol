// Botões de defesa do jogador do humano (Etapa 3, Parte 4; plano 2.8): CONTER (acompanha o condutor entre a bola e o
// gol), DIVIDIDA (bote em pé), PRESSÃO (o companheiro que chega primeiro aperta o condutor; marca no desenho) e o
// disparo do CARRINHO (carrinho; o corpo é do carrinho.js) e os contatos da perna dele com a bola e com o homem. Pura;
// constantes em config.js DEFESA_HUMANO. Ganchos em sim.js (só agem com os bits apertados, j.defH ligado ou um carrinho em
// andamento; a PRESSÃO só na IA tática da partida): entradaConter/pedidoPressao (passo 1), carrinho (passo 2), dividida
// (passo 3), contatosCarrinho e fimDoDeslize (passo 5, a bola), contatosHomemCarrinho (fim do passo), semAtropelar. Estado:
// j.defH = null | {bote: null | {tick0, contato, cond, longe, pe, bx, bz}, semReacaoAte, tick}; j.conter (filtro e
// histerese do CORRER). iaClassica (o "antes" dos testes): nada disto age. Contrato: CONTRATOS.md.

import { BOTAO, CAMPO, PASSO, ENTRADA, DEFESA_HUMANO, FALTAS, JOGADOR, IA_PESSOA, SUBPASSOS_BOLA, BOLA } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { uniforme } from './rng.js';
import { chutarRasteiro, proxVelRolando, DT_BOLA } from './bola.js';
import {
  montarCarrinho, bolaAlta, vivaCarrinho, quadroCarrinho, novoQuadroCarrinho, tempoCarrinho, marcarAcerto, segSeg, distPontoSeg,
  juntaPerna, RAIOS_PERNA,
} from './carrinho.js';
// o contato do carrinho com o HOMEM: as pernas (e, deitado, o corpo inteiro) DESENHADAS do adversário (anim.js não importa
// este módulo: sem ciclo)
import { pose, NJ, J as JA, SEGMENTOS, RAIO_CABECA } from './anim.js';
import { ataca } from './acoes.js';
import { para } from './ia.js';
import { estadoIA } from './ia-tatica.js';
import { contraPessoa } from './tatica.js';
import { chanceFaltaDividida, montarFalta, registrarFalta, chegada, forcaContato, faltaNoCarrinho } from './faltas.js';
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
  if (j.carrinho) return; // no carrinho (carrinho.js): uma ação de cada vez — a DIVIDIDA apertada no tick do aperto não sai
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

// ------------------------------------------------------------------------------------ CARRINHO
// (item 34 da FILA; pedido do dono de 17/10: "botão de CARRINHO — dividida deslizando"). O corpo é um PLANO puro montado
// no aperto (carrinho.js montarCarrinho, como o j.mergulho do goleiro) e um QUADRO puro do tempo, lidos pela simulação
// (sim.js passo 2/2b/8), pela altura do quadril e pela pose (anim.js poseCarrinho). Aqui só o DISPARO: a borda do bit no
// controlado, as guardas da especificação (A.2) e a bola prevista da ajuda de mira pelo encontro (A.3). Contrato:
// CONTRATOS.md "Carrinho (item 34)". Nada sorteia; sem o botão nada daqui roda (a IA nunca liga o bit).

const KC = DEFESA_HUMANO.carrinho;
// a bola prevista para a ajuda de mira: nos instantes da procura (até encontro[1] s) e um tick além (a interpolação)
const N_PREV = Math.round(KC.encontro[1] / PASSO) + 1;
const _distRol = new Float64Array(N_PREV + 1);
const _prev = { rolando: false, x: 0, z: 0, vx: 0, vz: 0, ux: 0, uz: 0 };
const _bolaAgora = { x: 0, z: 0 };

/** A bola prevista t s depois do aperto (em out.x/out.z; t aceita fração: a procura interpola o encontro). */
function preverBolaCarrinho(t, out) {
  const P = _prev;
  if (P.rolando) {
    // rolando sem dono: a distância exata da rolagem (bola.js distRolando, tick a tick) interpolada entre os ticks
    let f = t / PASSO;
    if (!(f > 0)) f = 0; else if (f > N_PREV) f = N_PREV;
    let n = Math.floor(f);
    if (n >= N_PREV) n = N_PREV - 1;
    const d = _distRol[n] + (_distRol[n + 1] - _distRol[n]) * (f - n);
    out.x = P.x + P.ux * d; out.z = P.z + P.uz * d;
  } else { out.x = P.x + P.vx * t; out.z = P.z + P.vz * t; }
  return out;
}

/** Monta a previsão da bola (o condutor adversário com ela no pé; rolando sem dono; no ar, baixa) em _prev. */
function montarPrevisao(m) {
  const b = m.bola, P = _prev;
  P.x = b.p.x; P.z = b.p.z; P.rolando = false;
  const d0 = m.posse != null ? porId(m, m.posse) : null;
  if (d0) { P.vx = d0.vx; P.vz = d0.vz; return; }
  if (!b.rolando) { P.vx = b.v.x; P.vz = b.v.z; return; }
  const s0 = MD.hypot(b.v.x, b.v.z);
  P.rolando = true;
  if (s0 > 1e-9) { P.ux = b.v.x / s0; P.uz = b.v.z / s0; } else { P.ux = 1; P.uz = 0; }
  // a mesma conta do distRolando (bola.js), guardando a distância no fim de cada tick: _distRol[n] = distRolando(s0, n)
  let s = s0, d = 0;
  _distRol[0] = 0;
  for (let i = 1; i <= N_PREV; i++) {
    if (s > 0) for (let k = 0; k < SUBPASSOS_BOLA; k++) { s = proxVelRolando(s, DT_BOLA); d += s * DT_BOLA; }
    _distRol[i] = d;
  }
}

/**
 * CARRINHO (gancho do passo 2 do sim.js, só o CONTROLADO): na borda de BOTAO.CARRINHO monta o plano em j.carrinho e
 * devolve true (o sim.js anda o corpo pelo quadro no mesmo passo). Só na partida (11×11 ou Modo Livre) com a bola VIVA —
 * fora de parada não cobrada, do tick do gol e da disputa de pênaltis —, fora do goleiro, de um carrinho em andamento, do
 * ar (o pulo do cabeceio saído), da DIVIDIDA em andamento ou sem reação; com a bola fora do pé de um companheiro, das
 * mãos do goleiro e de um voo do próprio time (o bit chega cru no Node e no online), e não alta (carrinho.js bolaAlta).
 * No aperto: a ação carregada/pedida, a DIVIDIDA, o CONTER, a recepção e o toque marcado caem; o pulo do cabeceio ainda
 * no chão e a disputa pelo alto também (sim.js faz o mesmo na bola morta: senão o alguemNoAlto, o agendarDisputa e a
 * trocaAerea o contariam como quem vai cabecear). Evento `carrinho {id, fase: 'inicio'}`.
 */
export function carrinho(m, j) {
  if (!((j.botoes & BOTAO.CARRINHO) && !(j.botoesAnt & BOTAO.CARRINHO))) return false;
  if (j.carrinho || !m.times || !m.partida || m.partida.estado !== 'jogo' || m.disputa || desligado(m)) return false;
  if (j.posicao === 'GOL' || j.papel === 'parado' || j.papel === 'marcador') return false;
  // a bola viva: nem parada não cobrada (naParada; o gol cria a parada), nem o tick do gol (sim.js grava m.golTick antes
  // do regrasPartida)
  if ((m.parada && !m.parada.rolou) || m.golTick != null) return false;
  // uma ação de cada vez: no ar (o pulo do cabeceio que saiu do chão), a DIVIDIDA em andamento ou sem reação (o estado
  // velho — o controle saiu dele no meio — o dividida descarta)
  if (j.cab && j.cab.saiu && m.tick <= j.cab.tf) return false;
  const h = j.defH;
  if (h && m.tick - h.tick <= 2 && (h.bote || m.tick < h.semReacaoAte)) return false;
  // a bola: nem nas mãos (Regra 12.3), nem no pé de um companheiro, nem num voo do meu time, nem alta (a perna não alcança)
  if (m.naMao != null) return false;
  if (m.posse != null) { const d0 = porId(m, m.posse); if (!d0 || d0.time === j.time) return false; }
  if (m.voo && m.voo.time === j.time) return false;
  if (bolaAlta(m)) return false;
  // o plano (puro; a ajuda de mira pela bola prevista)
  montarPrevisao(m);
  _bolaAgora.x = m.bola.p.x; _bolaAgora.z = m.bola.p.z;
  j.carrinho = montarCarrinho(j, m.tick, { bola: _bolaAgora, prever: preverBolaCarrinho });
  // o aperto: uma ação de cada vez
  j.defH = null; j.carga = null; j.pedido = null; j.conter = null; j.recebe = null;
  if (j.cond) j.cond.toque = null;
  if (j.cab && !j.cab.saiu) j.cab = null;
  j.disputaAlta = null;
  m.eventos.push({ tipo: 'carrinho', id: j.id, fase: 'inicio' });
  return true;
}

// ---------------------------------------------- CARRINHO: o contato da perna DESENHADA com a BOLA (CONTRATOS.md, B.1/B.2)
// As 6 cápsulas das pernas (coxa, canela, chuteira × 2) saem do QUADRO do carrinho (carrinho.js) e a pose as copia sem IK:
// a perna que toca a bola é, bit a bit, a do manequim. A bola é conferida em KC.subpassos trechos por passo: o trecho que
// ela percorre (o caminho do passo, em linha) contra a perna parada no quadro do FIM do trecho, com a distância EXATA
// segmento × segmento — a bola nunca "pula" a perna, a qualquer velocidade. Só com a bola viva (vivaCarrinho), do aperto
// até a parada (0 < t ≤ tS; o trecho que contém a parada inteiro, com a perna parada dela), com o centro da bola a
// ≤ altoBola no ponto do contato, sem dono ou no pé/num voo do ADVERSÁRIO; um toque por carrinho (depois só o disco do
// corpo, sim.js colisaoBolaCorpo). Entre vários carrinhos vale o contato MAIS CEDO (trecho, a fração do trecho na entrada,
// a profundidade e, no empate exato, o time m.tick % 2): o resultado não depende da ordem de m.jogadores (o lado 0 não leva
// vantagem no online). Sem sorteio.

const SUB_C = KC.subpassos, RB_C = BOLA.raio;
const _qk = novoQuadroCarrinho(), _qa = novoQuadroCarrinho(), _qb = novoQuadroCarrinho();
const _ss = { s: 0, t: 0, d2: 0 }, _pt = { t: 0 };
const _ent = { u: 0, prof: 0 };
const _mel = { j: null, s: 0, u: 0, prof: 0, k: 0, i: 0 };

/** A entrada da bola (o trecho B0 → B1) na cápsula A → B de raio R (a perna parada): false sem contato; com contato, em o
 * a fração do trecho na entrada (u: a 1ª com a distância ≤ R) e a profundidade nela (> 0 só se a bola já começa dentro). */
function entradaNaCapsula(b0x, b0y, b0z, b1x, b1y, b1z, A, B, R, o) {
  segSeg(b0x, b0y, b0z, b1x, b1y, b1z, A.x, A.y, A.z, B.x, B.y, B.z, _ss);
  if (_ss.d2 > R * R) return false;
  const d0 = distPontoSeg(b0x, b0y, b0z, A.x, A.y, A.z, B.x, B.y, B.z);
  if (d0 <= R) { o.u = 0; o.prof = R - d0; return true; }
  // a distância de um ponto que anda em linha até um segmento é convexa: cai de d0 > R até a menor (≤ R, na fração s) —
  // a entrada por bisseção (16 passos: ~2 µm num trecho de 15 cm)
  let lo = 0, hi = _ss.s;
  for (let it = 0; it < 16; it++) {
    const u = (lo + hi) / 2;
    if (distPontoSeg(b0x + (b1x - b0x) * u, b0y + (b1y - b0y) * u, b0z + (b1z - b0z) * u, A.x, A.y, A.z, B.x, B.y, B.z) <= R) hi = u;
    else lo = u;
  }
  o.u = hi; o.prof = 0;
  return true;
}

/** O t do quadro no fim do trecho s (1..SUB_C) do passo: o último é o mesmo t do corpo no tick seguinte (passoCarrinho). */
const tTrecho = (c, tick, s) => (s === SUB_C ? tempoCarrinho(c, tick + 1) : tempoCarrinho(c, tick, s * PASSO / SUB_C));

/**
 * O contato das pernas de todos os carrinhos com a bola neste passo (sim.js passo 5, logo depois de passoBola: (bx0, by0,
 * bz0) é a bola no começo do passo e m.bola no fim). Devolve true se uma perna tocou (o sim.js não roda o bloqueioPerna
 * nesse passo: um contato só). Sem carrinho nada roda.
 */
export function contatosCarrinho(m, bx0, by0, bz0) {
  let algum = false;
  for (const j of m.jogadores) if (j.carrinho) { algum = true; break; }
  if (!algum || m.naMao != null || !vivaCarrinho(m)) return false;
  const b = m.bola;
  const d0 = m.posse != null ? porId(m, m.posse) : null;
  if (m.posse != null && !d0) return false;
  const par = m.tick % 2;
  _mel.j = null;
  for (const j of m.jogadores) {
    const c = j.carrinho;
    if (!c || c.bola >= 0) continue;
    // a bola de um companheiro (no pé ou num voo do meu time): a perna passa por ela
    if ((d0 && d0.time === j.time) || (m.voo && m.voo.time === j.time)) continue;
    // parado: a perna não toca mais (só o disco do corpo). O trecho que contém a parada conta inteiro, com a perna dele
    // (de tS em diante o quadro das pernas é o mesmo: o corpo parado no chão)
    let t0 = tempoCarrinho(c, m.tick);
    if (t0 >= c.tS) continue;
    for (let s = 1; s <= SUB_C; s++) {
      if (t0 >= c.tS) break;
      const t = tTrecho(c, m.tick, s);
      t0 = t;
      quadroCarrinho(c, t, _qk);
      const f0 = (s - 1) / SUB_C, f1 = s / SUB_C;
      const b0x = bx0 + (b.p.x - bx0) * f0, b0y = by0 + (b.p.y - by0) * f0, b0z = bz0 + (b.p.z - bz0) * f0;
      const b1x = bx0 + (b.p.x - bx0) * f1, b1y = by0 + (b.p.y - by0) * f1, b1z = bz0 + (b.p.z - bz0) * f1;
      let achou = false, cu = 0, cp = 0, ck = 0, ci = 0;
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i < 3; i++) {
          const A = juntaPerna(_qk, k, i, false), B = juntaPerna(_qk, k, i, true);
          if (!entradaNaCapsula(b0x, b0y, b0z, b1x, b1y, b1z, A, B, RAIOS_PERNA[i] + RB_C, _ent)) continue;
          // o centro da bola a ≤ altoBola no ponto do contato (acima disto a perna não alcança)
          if (b0y + (b1y - b0y) * _ent.u > KC.altoBola) continue;
          if (!achou || _ent.u < cu || (_ent.u === cu && _ent.prof > cp)) { achou = true; cu = _ent.u; cp = _ent.prof; ck = k; ci = i; }
        }
      }
      if (!achou) continue;
      // o mais cedo de todos: o trecho, a fração na entrada, a profundidade e, no empate exato, o time m.tick % 2 (nunca a
      // ordem do array)
      const M = _mel;
      if (!M.j || s < M.s || (s === M.s && (cu < M.u || (cu === M.u && (cp > M.prof || (cp === M.prof && j.time === par && M.j.time !== par)))))) {
        M.j = j; M.s = s; M.u = cu; M.prof = cp; M.k = ck; M.i = ci;
      }
      break;
    }
  }
  if (!_mel.j) return false;
  tocarBolaCarrinho(m, _mel.j, _mel.s, _mel.u, _mel.k, _mel.i, bx0, by0, bz0, d0);
  return true;
}

/** O chute do adversário (o bloqueio da perna é desvio: o gol continua de quem chutou), como o chuteAdv do troca.js. */
const vooDeChute = v => v.tipo === 'chute' || v.tipo === 'colocado' || v.tipo === 'cavadinha' || (v.tipo === 'cabeceio' && v.cabeceio === 'chute');

/**
 * O toque da perna (k, segmento i) de j na bola, na fração u do trecho s (B.2, sem sorteio): a física do contato na cápsula
 * — a normal do ponto mais perto da perna ao centro da bola; a velocidade da perna pela diferença do quadro em t e
 * t − PASSO/SUB_C, limitada a vPernaRel em relação ao corpo (o desenho da transição passa de 9 m/s: só a conta do toque é
 * limitada); restituição eBola; a bola posta na superfície. Depois, pelo que a bola era: o condutor perde a bola só se ela
 * sai a ≥ rouboVRel dele (GANHOU: dividida + roubada); abaixo disso, raspão (a posse fica); o chute do adversário é desvio
 * (bateuCorpo bloqueio, como o bloqueioPerna); o passe do adversário ou a bola livre, roubada (TOQUES: o gol contra, o
 * impedido que desliza marcado, o passe cortado). Quem ganhou a bola levanta mais cedo (marcarAcerto).
 */
function tocarBolaCarrinho(m, j, s, u, k, i, bx0, by0, bz0, d0) {
  const c = j.carrinho, b = m.bola;
  const t = tTrecho(c, m.tick, s), tp = s === 1 ? tempoCarrinho(c, m.tick) : tTrecho(c, m.tick, s - 1);
  quadroCarrinho(c, t, _qa);
  quadroCarrinho(c, tp, _qb);
  const R = RAIOS_PERNA[i] + RB_C;
  // o ponto da bola na entrada e o ponto mais perto dela na perna (o segmento no fim do trecho)
  const f = (s - 1 + u) / SUB_C;
  let px = bx0 + (b.p.x - bx0) * f, py = by0 + (b.p.y - by0) * f, pz = bz0 + (b.p.z - bz0) * f;
  const A = juntaPerna(_qa, k, i, false), B = juntaPerna(_qa, k, i, true);
  distPontoSeg(px, py, pz, A.x, A.y, A.z, B.x, B.y, B.z, _pt);
  const v = _pt.t;
  const lx = A.x + (B.x - A.x) * v, ly = A.y + (B.y - A.y) * v, lz = A.z + (B.z - A.z) * v;
  let nx = px - lx, ny = py - ly, nz = pz - lz, nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (nl < 1e-9) {
    // a bola no eixo da perna (só se já começou dentro dela): sai pelo lado de onde veio, senão para a frente do carrinho
    nx = bx0 - lx; ny = 0; nz = bz0 - lz; nl = Math.sqrt(nx * nx + nz * nz);
    if (nl < 1e-9) { nx = c.ux; nz = c.uz; nl = 1; }
  }
  nx /= nl; ny /= nl; nz /= nl;
  // a bola na superfície da cápsula (a rolando fica no chão; a que começou dentro sai pela normal até a superfície)
  const rolando = b.rolando;
  b.p.x = lx + nx * (R + 1e-4); b.p.y = ly + ny * (R + 1e-4); b.p.z = lz + nz * (R + 1e-4);
  if (rolando) {
    b.p.y = RB_C;
    for (let it = 0; it < 3; it++) {
      const d = distPontoSeg(b.p.x, b.p.y, b.p.z, A.x, A.y, A.z, B.x, B.y, B.z, _pt);
      if (d >= R) break;
      const qx = A.x + (B.x - A.x) * _pt.t, qz = A.z + (B.z - A.z) * _pt.t;
      let hx = b.p.x - qx, hz = b.p.z - qz;
      const hl = Math.sqrt(hx * hx + hz * hz);
      if (hl > 1e-9) { hx /= hl; hz /= hl; } else { hx = nx; hz = nz; }
      b.p.x += hx * (R - d + 1e-4); b.p.z += hz * (R - d + 1e-4);
    }
  } else if (b.p.y < RB_C) b.p.y = RB_C;
  // a velocidade do ponto da perna (diferença do quadro no mesmo ponto do segmento), limitada a vPernaRel do corpo
  const A0 = juntaPerna(_qb, k, i, false), B0 = juntaPerna(_qb, k, i, true);
  const dt = t - tp;
  const vcx = _qa.vx, vcz = _qa.vz;
  let rx = 0, ry = 0, rz = 0;
  if (dt > 1e-9) {
    rx = (lx - (A0.x + (B0.x - A0.x) * v)) / dt - vcx;
    ry = (ly - (A0.y + (B0.y - A0.y) * v)) / dt;
    rz = (lz - (A0.z + (B0.z - A0.z) * v)) / dt - vcz;
    const rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (rl > KC.vPernaRel) { const e = KC.vPernaRel / rl; rx *= e; ry *= e; rz *= e; }
  }
  const vpx = vcx + rx, vpy = ry, vpz = vcz + rz;
  const vn = (b.v.x - vpx) * nx + (b.v.y - vpy) * ny + (b.v.z - vpz) * nz;
  if (vn < 0) {
    const e1 = 1 + KC.eBola;
    b.v.x -= e1 * vn * nx; b.v.y -= e1 * vn * ny; b.v.z -= e1 * vn * nz;
  }
  if (rolando) { b.v.y = 0; b.w.x = b.v.z / RB_C; b.w.y = 0; b.w.z = -b.v.x / RB_C; }
  else { b.w.x *= 0.3; b.w.y *= 0.3; b.w.z *= 0.3; }
  // um toque por carrinho; a bola desviada não passa mais onde o domínio aéreo / cabeceio marcado esperava
  c.bola = m.tick;
  for (const o of m.jogadores) if (o.cond && o.cond.toque && o.cond.toque.tipo === 'aereo') o.cond.toque = null;
  if (d0) {
    // a bola de um CONDUTOR adversário: ganhou só se ela sai a ≥ rouboVRel dele (senão é raspão: a condução dele segue)
    if (MD.hypot(b.v.x - d0.vx, b.v.z - d0.vz) >= KC.rouboVRel) {
      d0.cond.toque = null; d0.cond.busca = false; d0.cond.semDominioAte = m.tick + seg(D.semDominio);
      m.posse = null; m.voo = null;
      m.ultimoToque = { id: j.id, time: j.time, tick: m.tick };
      if (m.stats) m.stats.roubadas++;
      marcarAcerto(c, m.tick);
      m.eventos.push({ tipo: 'dividida', id: j.id, ganhou: true, motivo: null, carrinho: true });
      m.eventos.push({ tipo: 'roubada', id: j.id, carrinho: true });
    } else {
      if (d0.cond) d0.cond.bolaDesviada = true;
      m.eventos.push({ tipo: 'carrinho', id: j.id, fase: 'bola', de: 'raspao' });
    }
    registrarToque(m, j, 'roubada');
  } else if (m.voo && vooDeChute(m.voo)) {
    // o chute do adversário: desvio (o m.voo e o m.ultimoToque ficam: o gol desviado continua de quem chutou)
    m.desvio = m.tick; // o goleiro relê o chute desviado (goleiro.js lerChute)
    marcarAcerto(c, m.tick);
    m.eventos.push({ tipo: 'bateuCorpo', id: j.id, bloqueio: true, carrinho: true });
    registrarToque(m, j, 'corpo');
  } else {
    // o passe do adversário ou a bola livre: roubada (o passe acabou)
    const de = m.voo ? 'passe' : 'livre';
    m.voo = null;
    m.ultimoToque = { id: j.id, time: j.time, tick: m.tick };
    marcarAcerto(c, m.tick);
    m.eventos.push({ tipo: 'roubada', id: j.id, carrinho: true, de });
    registrarToque(m, j, 'roubada');
  }
}

/** O fim do deslize sem tocar a bola (sim.js, depois da bola de cada passo): `dividida {ganhou: false, motivo: 'fora',
 * carrinho}` no passo em que o quadro passa da parada (tS) — só com a bola viva; quem fez falta no homem já teve o dele
 * (`motivo: 'falta'`, contatosHomemCarrinho). A súmula e o autor do gol ignoram. */
export function fimDoDeslize(m) {
  let viva = null;
  for (const j of m.jogadores) {
    const c = j.carrinho;
    if (!c || c.bola >= 0 || (c.homem && c.homem.falta)) continue;
    if (!(tempoCarrinho(c, m.tick) < c.tS && tempoCarrinho(c, m.tick + 1) >= c.tS)) continue;
    if (viva === null) viva = vivaCarrinho(m);
    if (!viva) return;
    m.eventos.push({ tipo: 'dividida', id: j.id, ganhou: false, motivo: 'fora', carrinho: true });
  }
}

// ---------------------------------------------- CARRINHO: o contato da perna DESENHADA com o HOMEM (CONTRATOS.md, B.3/C)
// No fim do passo (sim.js, depois do m.tick++ e da altura do quadril), com o quadro e a pose do tick NOVO: as 6 cápsulas das
// pernas do quadro contra as pernas DESENHADAS do adversário (anim.js pose num buffer pré-alocado: coxa, canela e chuteira
// das duas) — o corpo inteiro (todos os segmentos e a cabeça) quando ele está deitado (a pelve desenhada abaixo de
// pelveDeitado: o goleiro no mergulho, outro carrinho). Só com a bola viva (vivaCarrinho), do aperto até o COMEÇO do levantar
// (t ≤ tS + tChao − levantar: a perna parada no caminho depois da parada é o tropeço da Regra 12.1), uma vez por carrinho
// (c.homem = o 1º contato com um adversário). Ordem sem viés: os carrinhos em duas voltas por m.jogadores (o time m.tick % 2
// primeiro); os candidatos (a ≤ alcanceHomem da ponta da perna da bola) na ordem de m.jogadores. A falta pela Regra 12 é de
// faltas.js faltaNoCarrinho — os ÚNICOS sorteios do carrinho, no tick do 1º contato. Companheiros: nada (as pernas
// atravessam, como hoje). Ninguém cai nesta entrega: o adversário perde velocidade (× 0,5 com falta, × 0,7 sem) e, com
// falta e a bola, o domínio por FALTAS.queda s.

const _qh = novoQuadroCarrinho(), _qh2 = novoQuadroCarrinho();
const _poseH = new Float32Array(NJ * 3), _poseH2 = new Float32Array(NJ * 3);
const _cH = { g: 0, d: 0, r: 0, ax: 0, az: 0, bx: 0, bz: 0 }, _cH2 = { g: 0, d: 0, r: 0, ax: 0, az: 0, bx: 0, bz: 0 };
// os segmentos do adversário [junta A, junta B, raio (o maior dos dois do SEGMENTOS)]: o corpo inteiro (deitado) e só as
// pernas — coxa, canela e chuteira das duas (de pé)
const SEG_CORPO = SEGMENTOS.map(s => [s[0], s[1], Math.max(s[2], s[3])]);
const FIM_PERNA = [JA.joelhoE, JA.tornozeloE, JA.pontaE, JA.joelhoD, JA.tornozeloD, JA.pontaD];
const SEG_PERNAS = SEG_CORPO.filter(s => FIM_PERNA.includes(s[1]));

/**
 * A menor folga (distância − a soma dos raios; ≤ 0 = contato) entre as 6 cápsulas das pernas do quadro q e os segmentos
 * `segs` da pose P (com a esfera da cabeça se `cabeca`). Em o: a distância (d) e a soma dos raios (r) do par e os pontos mais
 * perto no chão (a: na perna do quadro; b: no corpo da pose).
 */
function folgaPernasCorpo(q, P, segs, cabeca, o) {
  let g = Infinity;
  const hc = JA.cabeca * 3;
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 3; i++) {
      const A = juntaPerna(q, k, i, false), B = juntaPerna(q, k, i, true), r = RAIOS_PERNA[i];
      for (let n = 0; n < segs.length; n++) {
        const a3 = segs[n][0] * 3, b3 = segs[n][1] * 3;
        segSeg(A.x, A.y, A.z, B.x, B.y, B.z, P[a3], P[a3 + 1], P[a3 + 2], P[b3], P[b3 + 1], P[b3 + 2], _ss);
        const dd = Math.sqrt(_ss.d2), gg = dd - r - segs[n][2];
        if (gg < g) {
          g = gg; o.d = dd; o.r = r + segs[n][2];
          o.ax = A.x + (B.x - A.x) * _ss.s; o.az = A.z + (B.z - A.z) * _ss.s;
          o.bx = P[a3] + (P[b3] - P[a3]) * _ss.t; o.bz = P[a3 + 2] + (P[b3 + 2] - P[a3 + 2]) * _ss.t;
        }
      }
      if (cabeca) {
        const dd = distPontoSeg(P[hc], P[hc + 1], P[hc + 2], A.x, A.y, A.z, B.x, B.y, B.z, _pt), gg = dd - r - RAIO_CABECA;
        if (gg < g) {
          g = gg; o.d = dd; o.r = r + RAIO_CABECA;
          o.ax = A.x + (B.x - A.x) * _pt.t; o.az = A.z + (B.z - A.z) * _pt.t;
          o.bx = P[hc]; o.bz = P[hc + 2];
        }
      }
    }
  }
  o.g = g;
  return g;
}

/** A intenção de jogar a bola (Regra 12.4; CONTRATOS.md "Carrinho", C.2): a perna já tocou a bola, ou mirou nela no aperto
 * (c.mirou) e a bola está a ≤ tentouLonge m da perna da bola no contato — nunca a distância instantânea sozinha (o cartão
 * mudaria com a fase da passada do condutor). */
function tentouBolaCarrinho(m, c, q) {
  if (c.bola >= 0) return true;
  if (!c.mirou) return false;
  const b = m.bola.p, k = c.frente;
  let d = Infinity;
  for (let i = 0; i < 3; i++) {
    const A = juntaPerna(q, k, i, false), B = juntaPerna(q, k, i, true);
    const di = distPontoSeg(b.x, b.y, b.z, A.x, A.y, A.z, B.x, B.y, B.z);
    if (di < d) d = di;
  }
  return d <= KC.tentouLonge;
}

/** O carrinho de j ainda pode tocar o homem no t (do aperto até o começo do levantar)? */
const janelaHomem = (c, t) => t > 0 && t <= c.tS + c.tChao - KC.levantar;

/**
 * O contato das pernas de todos os carrinhos com os adversários neste passo (sim.js, no fim do passo). Sem carrinho sem
 * contato, nada roda.
 */
export function contatosHomemCarrinho(m) {
  let algum = false;
  for (const j of m.jogadores) if (j.carrinho && !j.carrinho.homem) { algum = true; break; }
  if (!algum || !vivaCarrinho(m)) return;
  const par = m.tick % 2;
  for (let volta = 0; volta < 2; volta++) {
    const time = volta === 0 ? par : 1 - par;
    for (const j of m.jogadores) {
      const c = j.carrinho;
      if (!c || c.homem || j.time !== time) continue;
      const t = tempoCarrinho(c, m.tick);
      if (janelaHomem(c, t)) homemDoCarrinho(m, j, c, t);
    }
  }
}

/** O 1º adversário que a perna de j toca neste tick (se houver): a falta e o efeito. */
function homemDoCarrinho(m, j, c, t) {
  const q = quadroCarrinho(c, t, _qh);
  const pt = q.po[c.frente];
  const A2 = KC.alcanceHomem * KC.alcanceHomem;
  for (const o of m.jogadores) {
    if (o.time === j.time) continue;
    const dx = o.x - pt.x, dz = o.z - pt.z;
    if (dx * dx + dz * dz > A2) continue;
    pose(o, m, _poseH);
    const deitado = _poseH[JA.pelve * 3 + 1] < KC.pelveDeitado;
    let g = folgaPernasCorpo(q, _poseH, deitado ? SEG_CORPO : SEG_PERNAS, deitado, _cH);
    let ax = _cH.ax, az = _cH.az, bx = _cH.bx, bz = _cH.bz, dd = _cH.d, rr = _cH.r;
    // dois carrinhos de times opostos (o outro ainda sem contato e na janela dele): o contato é SIMÉTRICO — as pernas de cada
    // um no corpo do outro, nos dois sentidos (o resultado não depende de quem a volta vê primeiro: o lado 0 do online não
    // leva vantagem)
    const oc = o.carrinho;
    let dois = false;
    if (oc && !oc.homem) {
      const to = tempoCarrinho(oc, m.tick);
      if (janelaHomem(oc, to)) {
        dois = true;
        pose(j, m, _poseH2);
        const jDeitado = _poseH2[JA.pelve * 3 + 1] < KC.pelveDeitado;
        const g2 = folgaPernasCorpo(quadroCarrinho(oc, to, _qh2), _poseH2, jDeitado ? SEG_CORPO : SEG_PERNAS, jDeitado, _cH2);
        if (g2 < g) { g = g2; ax = _cH2.bx; az = _cH2.bz; bx = _cH2.ax; bz = _cH2.az; dd = _cH2.d; rr = _cH2.r; }
      }
    }
    if (!(g <= 0)) continue;
    // a normal (no chão) do contato: a dos pontos mais perto (de quem desliza ao adversário) quando ela diz algo — o contato
    // raso (a distância ≥ 1/4 da soma dos raios) e de lado (a parte no chão ≥ metade dela); com as cápsulas cruzadas fundo ou
    // uma por cima da outra (a perna por cima do pé), a direção dos pontos mais perto é qualquer uma (a força ia a 0 com o
    // condutor correndo de lado): a linha dos centros dos corpos; no limite, u
    let nx = bx - ax, nz = bz - az, nl = Math.sqrt(nx * nx + nz * nz);
    if (!(dd >= 0.25 * rr && nl >= 0.5 * dd)) { nx = o.x - j.x; nz = o.z - j.z; nl = Math.sqrt(nx * nx + nz * nz); }
    if (nl < 1e-6) { nx = c.ux; nz = c.uz; nl = 1; }
    nx /= nl; nz /= nl;
    // a força: a aproximação dos CORPOS na normal (o do carrinho é o do quadro; o tropeço conta)
    const f = Math.max(0, (j.vx - o.vx) * nx + (j.vz - o.vz) * nz);
    if (dois) { resolverDoisCarrinhos(m, j, o, nx, nz, f); return; }
    const depois = c.bola >= 0;
    const fExc = Math.max(0, j.vx * nx + j.vz * nz);
    const h = c.homem = { id: o.id, tick: m.tick, depois, falta: false, f, fExc, ch: chegada(j, o) };
    // (com a falta do passo já feita, o carrinho não sorteia: uma falta por passo, como a DIVIDIDA)
    const fal = m.faltaPendente ? null : faltaNoCarrinho(m, j, o, {
      depois, f, fExc, v: MD.hypot(j.vx, j.vz), naMao: m.naMao === o.id, tentouBola: tentouBolaCarrinho(m, c, q),
    });
    if (fal) {
      m.eventos.push({ tipo: 'dividida', id: j.id, ganhou: false, motivo: 'falta', carrinho: true });
      registrarFalta(m, fal);
      h.falta = true;
    }
    // ninguém cai nesta entrega: com falta, a velocidade cai à metade (como a DIVIDIDA) e, com a bola, sem domínio por
    // FALTAS.queda s; sem falta (incidental ou sorteio limpo) × 0,7 e ele segue com a bola se ainda a tem
    if (!o.carrinho) {
      const k = fal ? 0.5 : 0.7;
      o.vx *= k; o.vz *= k;
      if (fal && m.posse === o.id && o.cond) o.cond.semDominioAte = m.tick + seg(FALTAS.queda);
    }
    return;
  }
}

/**
 * Dois carrinhos de times opostos que se tocam (CONTRATOS.md "Carrinho", B.3 e I.11), tratados como um par, uma vez: se só
 * UM tocou a bola antes, quem NÃO tocou comete a falta (sem sorteio de chance; abaixo de FALTAS.forca.min o contato é
 * incidental; o cartão segue o sorteio de sempre); nenhum ou os dois: "dividida de dois carrinhos", sem falta. A normal
 * (nx, nz) vai de j para o; f é a aproximação (a mesma dos dois lados).
 */
function resolverDoisCarrinhos(m, j, o, nx, nz, f) {
  const c = j.carrinho, oc = o.carrinho;
  const tj = c.bola >= 0, to = oc.bola >= 0;
  const hj = c.homem = { id: o.id, tick: m.tick, depois: tj, falta: false, f, fExc: Math.max(0, j.vx * nx + j.vz * nz), ch: chegada(j, o) };
  const ho = oc.homem = { id: j.id, tick: m.tick, depois: to, falta: false, f, fExc: Math.max(0, -(o.vx * nx + o.vz * nz)), ch: chegada(o, j) };
  if (tj === to || m.faltaPendente) return;
  const d = tj ? o : j, v = tj ? j : o, hd = tj ? ho : hj;
  const qd = quadroCarrinho(d.carrinho, tempoCarrinho(d.carrinho, m.tick), _qh2);
  const fal = faltaNoCarrinho(m, d, v, { dois: true, depois: false, f, fExc: hd.fExc, v: MD.hypot(d.vx, d.vz), tentouBola: tentouBolaCarrinho(m, d.carrinho, qd) });
  if (fal) {
    m.eventos.push({ tipo: 'dividida', id: d.id, ganhou: false, motivo: 'falta', carrinho: true });
    registrarFalta(m, fal);
    hd.falta = true;
  }
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
 * O time ganhou a bola (sim.js ganhouPosse): o pedido de PRESSÃO dele acaba — o toque antes da retomada não volta a valer
 * se a bola se perde de novo dentro da validade (segurado, o próximo passo grava de novo). As retomadas sem ganhouPosse (o
 * encaixe e o PEGAR do goleiro) a pressaoPedida pega por m.possePorTime; esta cobre a bola ganha e perdida no mesmo passo.
 */
export function encerrarPressao(m, time) {
  if (m.pedidoPressao && m.pedidoPressao[time] != null) m.pedidoPressao[time] = null;
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

/**
 * O pedido de PRESSÃO do time está valendo neste tick? Até P.validade s depois do último passo com o botão (um toque
 * curto vale ~1 s; antes valia 1 PASSO e o chamado dava uns passos e voltava ao bloco) e só com o time DEFENDENDO
 * (defende: a bola em jogo e não é dele). A retomada encerra o pedido: o time que teve a bola DEPOIS dele (m.possePorTime,
 * gravado no começo de cada passo, também com a bola nas mãos do goleiro) — qualquer retomada, também o encaixe e o PEGAR
 * do goleiro, que não passam por sim.js ganhouPosse (encerrarPressao); segurado, o pedido do mesmo passo empata e vale.
 * Pura (o desenho lê por pressionadorVisivel).
 */
export function pressaoPedida(m, time) {
  const t = m.pedidoPressao?.[time];
  return t != null && m.tick - t <= seg(P.validade) && (m.possePorTime?.[time] ?? -1) <= t && defende(m, time) && !desligado(m);
}

/**
 * O time está defendendo: a bola em jogo (na partida, o estado 'jogo' — no intervalo, no fim e nas paradas o passo não
 * grava o botão e o pedido ficava "valendo" sem ninguém chamado: teste-pressao-humano M6) e ela não é dele (nem no pé,
 * nem nas mãos do goleiro, nem num voo dele). Pura.
 */
function defende(m, time) {
  if (m.partida && m.partida.estado !== 'jogo') return false;
  const dono = m.naMao ?? m.posse;
  if (dono != null) { const o = porId(m, dono); return !o || o.time !== time; }
  return !(m.voo && m.voo.time === time);
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
 * IA que já aperta por conta própria: o botão dobra a marcação). Quem já vai leva P.histerese s de vantagem
 * (P.histeresePasse no passe do adversário) e nunca é o excluído. Uma vez por tick (m.pressaoHumano[time] = {tick, id};
 * o desenho lê por pressionadorVisivel). -1 = ninguém.
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
  // no passe do adversário (o alvo é o ponto de chegada) a vantagem é maior: era ali que a marca pulava de jogador
  // (~85% das trocas do chamado; teste-pressao-humano M11)
  const H = m.posse == null ? P.histeresePasse : P.histerese;
  let id = -1;
  if (d0) {
    let mt = Infinity;
    for (const o of m.jogadores) {
      // (quem está no carrinho, deitado no chão — carrinho.js —, não é chamado)
      if (o.time !== time || o.posicao === 'GOL' || o.id === ctrl || o.papel === 'parado' || o.papel === 'marcador' || o.carrinho) continue;
      if (o.id === excluir && o.id !== atual) continue;
      let t = pontoEncontro(m, time, o, d0, d0.vx, d0.vz, _pc).t;
      // a vantagem de quem já ia só vale se ele continua indo para lá: com o ponto novo (o passe do adversário mudou o
      // alvo) além de JOGADOR.angInversao do sentido da corrida, ele freia na linha até parar (jogador.js passoCorpo) e
      // quem chega primeiro assume (teste-pressao-humano M5, 14/10: o chamado parado no meio da inversão)
      if (o.id === atual && !inverte(o, _pc.x, _pc.z)) t -= H;
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
  // (D4: os companheiros da pessoa contra a IA — não o controlado — chegam numa curva de freada mais forte:
  // IA_PESSOA.companheiros.freio; o controlado segue a de sempre, a carga por trás do teste-faltas-sentido B2)
  const fr = m.controlado?.[j.time] !== j.id && contraPessoa(m, 1 - j.time) ? IA_PESSOA.companheiros.freio : SA.freio;
  const max = vAfasta + Math.sqrt(SA.chega * SA.chega + 2 * fr * folga);
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
 * O bote do chamado da PRESSÃO no condutor `dono` fica contido? (sim.js boteIA: "delay, don't dive in") Devolve o motivo
 * ou null: 'embalado' — FECHANDO no condutor a mais de FALTAS.bote.vLivre m/s, pela mesma conta da força do contato
 * (faltas.js forcaContato): a MENOR entre a parte da velocidade dele e a da velocidade relativa na direção do corpo do
 * condutor. Correndo junto do condutor (a relativa ~0) ou parado diante de quem vem para cima dele (a própria ~0) ninguém
 * entra no corpo de ninguém: pela velocidade absoluta, o chamado que acompanhava o condutor em disparada nunca tentava — o
 * bote saía em 20% dos passos com a bola ao alcance fora das outras duas travas (teste-pressao-humano M10, main fd6dedb9);
 * pelo módulo da relativa, 76–85% em 12 partidas (o chamado que passa de lado ou se afasta do condutor com a bola no pé
 * dele também não tentava); só pela parte da relativa que fecha, 93% — mas o condutor vindo para cima do chamado parado
 * contava como embalo DELE (a 1,4 m/s, com o chamado a 2,9 m/s, 4,3 > 4: travado com a falta impossível, forcaContato 0);
 * pela conta do forcaContato, 99% (o que ela libera tem forcaContato ≤ FALTAS.forca.min: falta nova nenhuma).
 * 'tras' — nas costas dele (faltas.js chegada); 'corpo' — o corpo entrando no dele (faltas.js forcaContato >
 * FALTAS.forca.min, inclusive o choque recente). Pura.
 */
export function boteContidoDoChamado(m, j, dono) {
  const rx = dono.x - j.x, rz = dono.z - j.z, l = MD.hypot(rx, rz) || 1;
  const fp = (j.vx * rx + j.vz * rz) / l, fr = ((j.vx - dono.vx) * rx + (j.vz - dono.vz) * rz) / l;
  if (Math.min(fp, fr) > FALTAS.bote.vLivre) return 'embalado';
  if (chegada(j, dono) === 'tras') return 'tras';
  if (forcaContato(m, j, dono) > FALTAS.forca.min) return 'corpo';
  return null;
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
    return corridaAoPasse(m, j, pv, st);
  }
  const d0 = condutorAdversario(m, j);
  if (!d0 || pressionadorDe(m, j.time) !== j.id) return null;
  const s = estadoIA(m, j);
  filtrarCondutor(s, d0);
  s.ramo = 'pressaoHumano';
  st.tick = m.tick;
  return perseguirCondutor(m, j, d0, s, st);
}

/**
 * PRESSÃO segurado com o analógico SOLTO: o PRÓPRIO controlado também aperta (a C1 do diagnóstico de 23/10, atrás de
 * P.controlado — LIGADA, dono, 24/10: "meu jogador aperta também"; o controlado parado chega a ≤ 1 m do condutor em
 * 3 s em 30% das posses com o botão segurado, contra 13% desligada — teste-pressao-humano, linha
 * "(D1, a C1)"). A mesma perseguição do chamado (perseguirCondutor / corridaAoPasse),
 * com o estado no próprio jogador (j.pressaoP, j.pressaoPS: não é o chamado — chamadoRecente não vale para ele). Só com o
 * time defendendo (defende) e um condutor ou um passe do adversário; senão null.
 */
export function entradaPressaoPropria(m, j) {
  if (!P.controlado || desligado(m) || !defende(m, j.time)) return null;
  const st = j.pressaoP ??= { corre: false, tick: -1 };
  const pv = m.posse == null ? passeAdversario(m, j.time) : null;
  if (pv) { st.tick = m.tick; return corridaAoPasse(m, j, pv, st); }
  const d0 = condutorAdversario(m, j);
  if (!d0) return null;
  const s = j.pressaoPS ??= { cond: -1, cvx: 0, cvz: 0 };
  filtrarCondutor(s, d0);
  st.tick = m.tick;
  return perseguirCondutor(m, j, d0, s, st);
}

/** Velocidade do condutor d0 filtrada (P.filtro s) em s {cond, cvx, cvz}; recomeça do zero com outro condutor. */
function filtrarCondutor(s, d0) {
  if (s.cond !== d0.id) { s.cond = d0.id; s.cvx = d0.vx; s.cvz = d0.vz; }
  const a = Math.min(1, PASSO / P.filtro);
  s.cvx += (d0.vx - s.cvx) * a; s.cvz += (d0.vz - s.cvz) * a;
}

/** No passe do adversário pv: em disparada até P.colado m do ponto de chegada, do lado do meu gol; freia no último metro. */
function corridaAoPasse(m, j, pv, st) {
  const gx = -ataca(m, j.time) * CAMPO.meioX - pv.alvo.x, gz = -pv.alvo.z, g = MD.hypot(gx, gz) || 1;
  const dx = pv.alvo.x + (gx / g) * P.colado - j.x, dz = pv.alvo.z + (gz / g) * P.colado - j.z, d = MD.hypot(dx, dz);
  // perto do ponto, freia (o analógico proporcional à distância): espera o recebedor ali
  if (d < 1) return { x: dx, z: dz, botoes: 0 };
  // em disparada, chegando freando no recebedor (ele vem ao encontro da bola)
  return corridaAte(m, j, pv.para != null ? porId(m, pv.para) : null, dx, dz, st);
}

/** A perseguição ao condutor d0 (aproximação e disputa; ver entradaPressao), com a velocidade filtrada dele em s. */
function perseguirCondutor(m, j, d0, s, st) {
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
