// Botões de defesa do jogador do humano (Etapa 3, Parte 4; plano 2.8): CONTER (segurar: acompanha o
// condutor entre a bola e o gol, de frente para ele), DIVIDIDA (borda: bote em pé, o pé sai na direção
// da bola) e PRESSÃO (segurar: um companheiro aperta o condutor). CARRINHO fica na Etapa 4 (precisa de
// falta e cartão). Pura: sem three.js nem DOM; só MD e m.rng. Constantes em config.js DEFESA_HUMANO.
//
// Ganchos em sim.js (valem também no treino, mas só agem com os bits CONTER/DIVIDIDA/PRESSÃO
// apertados ou com o estado j.defH ligado — nenhum roteiro do treino aperta esses bits):
//  - passo 1 (entradas), jogador controlado: entradaConter(m, j, e) → entrada que substitui a do
//    analógico (ou null = usa a do humano); pedidoPressao(m, j) com PRESSÃO segurado;
//  - passo 3 (desarmes), jogador controlado: dividida(m, j).
// Estado do humano na defesa: j.defH = null (nada) | {bote: null | {tick0, contato, cond, longe, pe, bx,
// bz}, semReacaoAte: tick, tick} — o bote em andamento e o tempo sem reação depois de errar. Com
// j.defH ligado os dois ganchos rodam a cada passo; no fim volta a null. j.conter guarda o filtro da
// velocidade do condutor e a histerese do CORRER (não é lido pelo sim.js).
//
// iaClassica (m.partida.iaClassica, o "antes" dos testes): nada disto age — o jogo de antes da Etapa 3
// não tinha botões de defesa.

import { BOTAO, CAMPO, PASSO, ENTRADA, IA, DEFESA_HUMANO } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { uniforme } from './rng.js';
import { chutarRasteiro } from './bola.js';
import { ataca } from './acoes.js';
import { para } from './ia.js';
import { estadoIA } from './ia-tatica.js';

const C = DEFESA_HUMANO.conter, D = DEFESA_HUMANO.dividida, P = DEFESA_HUMANO.pressao;
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

// ------------------------------------------------------------------------------------- CONTER

/**
 * Entrada (velocidade pedida → analógico) que leva o corpo a andar com velocidade (vx, vz): a inversa de
 * jogador.js velocidadeDesejada (sem a bola). Acima da corrida, CORRER pela velocidade do corpo (st.corre).
 */
function entradaVelocidade(j, vx, vz, st, botoes) {
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
  const solta = clamp((dC - 0.45) / 0.5, 0, 1);
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
  m.eventos.push({ tipo: 'dividida', id: j.id, ganhou, motivo });
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
    j.defH = null;
    return;
  }
  // errou: sem reação (se o controle sair dele, a IA também não dá bote nesse tempo)
  j.defH = { bote: null, semReacaoAte: m.tick + seg(D.semReacao), tick: m.tick };
  j.descansoBote = Math.max(j.descansoBote ?? 0, seg(D.semReacao));
}

// ------------------------------------------------------------------------------------ PRESSÃO

/** PRESSÃO segurado: pede à IA tática que o companheiro mais perto aperte o condutor (contrato). */
export function pedidoPressao(m, j) {
  (m.pedidoPressao ??= {})[j.time] = m.tick;
}

/** O pedido de PRESSÃO do time está valendo neste tick? */
export function pressaoPedida(m, time) {
  const t = m.pedidoPressao?.[time];
  return t != null && m.tick - t <= P.validade && !desligado(m);
}

/**
 * Quem do time aperta o condutor a pedido do humano: o companheiro de linha mais perto da bola (sem o
 * controlado nem o goleiro); quem já aperta só perde a vez para outro P.troca m mais perto. Uma vez por
 * tick (m.pressaoHumano[time] = {tick, id}). -1 = ninguém.
 */
export function pressionadorDe(m, time) {
  const cache = (m.pressaoHumano ??= {});
  const ant = cache[time];
  if (ant && ant.tick === m.tick) return ant.id;
  const b = m.bola.p;
  const ctrl = m.humanos.includes(time) ? m.controlado[time] : null;
  let mel = null, dm = Infinity, dAnt = Infinity;
  for (const o of m.jogadores) {
    if (o.time !== time || o.posicao === 'GOL' || o.id === ctrl || o.papel === 'parado' || o.papel === 'marcador') continue;
    const d = MD.hypot(o.x - b.x, o.z - b.z);
    if (d < dm) { dm = d; mel = o; }
    if (ant && o.id === ant.id) dAnt = d;
  }
  let id = mel ? mel.id : -1;
  if (ant && ant.tick === m.tick - 1 && dAnt < dm + P.troca) id = ant.id;
  cache[time] = { tick: m.tick, id };
  return id;
}

/**
 * Leitor de referência do pedido de PRESSÃO (quem decide usar é a IA tática, ia-tatica.js, dona do
 * comportamento sem a bola): para o jogador da IA escolhido por pressionadorDe, a entrada que aperta o
 * condutor a P.aperto m do lado do meu gol, mirando à frente pela velocidade dele (a conta do 1º homem do
 * ia.js), com pressa; com o pedido valendo e um condutor adversário. Senão null.
 */
export function entradaPressao(m, j) {
  if (!pressaoPedida(m, j.time)) return null;
  const d0 = condutorAdversario(m, j);
  if (!d0 || pressionadorDe(m, j.time) !== j.id) return null;
  const s = estadoIA(m, j);
  if (s.cond !== d0.id) { s.cond = d0.id; s.cvx = d0.vx; s.cvz = d0.vz; }
  const a = PASSO / IA.filtroCondutor;
  s.cvx += (d0.vx - s.cvx) * a; s.cvz += (d0.vz - s.cvz) * a;
  let ax = s.cvx * IA.antecipaPressao, az = s.cvz * IA.antecipaPressao;
  const l = MD.hypot(ax, az);
  if (l > IA.antecipaMax) { ax *= IA.antecipaMax / l; az *= IA.antecipaMax / l; }
  const b = m.bola.p;
  const gx = -ataca(m, j.time) * CAMPO.meioX - b.x, gz = -b.z, g = MD.hypot(gx, gz) || 1;
  const tx = b.x + (gx / g) * P.aperto + ax, tz = b.z + (gz / g) * P.aperto + az;
  s.ramo = 'pressaoHumano';
  // aperta de verdade: CORRER até perto (a histerese do modo pressa solta o CORRER a ~1,5 m)
  return para(j, tx, tz, 1, true, 0, 'pressa');
}
