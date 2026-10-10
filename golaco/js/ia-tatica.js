// IA da partida 11×11 (Etapa 3): despacho por jogador e a IA SEM a bola (Parte 2): fase do time,
// bloco, linha alinhada, zona e marcação na área, 1º e 2º homem, gatilhos, contrapressão e
// recomposição, sempre pelo ponto de referência da tática (tatica.js posicaoTatica). Com a bola
// chama ia-ataque.js (Parte 3). O movimento continua saindo do para() do ia.js (modos calma/pressa
// e histerese), que fica congelado para o treino. Pura: sem three.js nem DOM; só MD e m.rng.
// Plano 2.1–2.4; constantes em config.js TATICA e IA_DEFESA.
//
// Só roda com m.times (sim.js: m.times ? entradaIATatica : entradaIA). Com m.partida.iaClassica
// (modo --antes dos testes) devolve a IA clássica do treino.
//
// Sem a bola, papéis (um por jogador, nesta ordem):
//  - contrapressão: até IA_DEFESA.contrapressao.max[pressão] dos que estavam a ≤ raio m da bola na
//    perda vão direto no condutor durante contrapressao.s[pressão] s (Bauer & Anzer 2021);
//  - 1º homem (o mais perto da bola, com a histerese IA.trocaPressao): CONTÉM a contencao[pressão] m
//    entre a bola e o meu gol; APERTA a IA_DEFESA.aperto m (e o boteIA do sim.js tenta tirar) com um
//    gatilho (passe para trás, toque pesado, de costas, na lateral, recepção — pesquisa §4.4), com a
//    bola perto do meu gol (IA_DEFESA.perigo) ou sempre na pressão Alta; com a bola longe do meu gol
//    (além de engaja[pressão], a linha de engajamento) não sai do bloco: segue a zona;
//  - PRESSÃO do humano (m.pedidoPressao[time] = tick): o companheiro mais perto (≠ controlado) aperta;
//  - 2º homem: pressão Média/Alta cobre a cobertura m atrás do 1º, do lado do gol e por dentro; na
//    Alta, com gatilho, aperta junto;
//  - linha de defesa (grupo 'def'): a referência alinhada; com atacantes a ≤ individualArea m do meu
//    gol, marcação individual deles (FC 26: individual na área);
//  - zona (os outros): a referência; um adversário a ≤ zona.raio m dela, no nível dela ou nas costas,
//    a puxa zona.peso para o lado do gol dele (uma reivindicação por adversário: marcação única);
//  - recomposição: > recomposicao m à frente da referência com a bola vindo para o meu gol → corre.
// Com a bola (Parte 3: ia-ataque.js): o condutor e os apoios; null = condutor da IA clássica e,
// para os apoios, a referência tática com a bola (posicaoTatica 'com').

import { BOTAO, CAMPO, PASSO, IA, IA_DEFESA, TATICA, ACOES } from './config.js';
import { MD } from './matdet.js';
import { difAng } from './mat.js';
import { entradaIA, para, pontoInterceptacao } from './ia.js';
import { apoioTatico, condutorTatico } from './ia-ataque.js';
import { faseDoTime, posicaoTatica } from './tatica.js';
import { FORMACOES } from './formacoes.js';
import { restricaoParada } from './partida.js';

const DT = PASSO;
const seg = s => Math.round(s / DT);

/**
 * Estado do para() (j.ia) pronto para este tick — a mesma inicialização do entradaIA (use antes de
 * chamar para() de fora do ia.js: o ponto suavizado só vale se a IA guiou o jogador no tick anterior).
 */
export function estadoIA(m, j) {
  const s = j.ia ??= { fx: 0, fz: 0, filtro: false, parado: false, corre: false, ataca: false, ramo: '', cond: -1, cvx: 0, cvz: 0, tick: -2 };
  if (m.tick - s.tick > 1) { s.filtro = false; s.parado = false; s.corre = false; s.ataca = false; }
  s.tick = m.tick;
  return s;
}

/** Entrada virtual {x, z, botoes} do jogador j (não controlado, de linha) na partida. */
export function entradaIATatica(m, j) {
  // modo --antes dos testes, e o goleiro com a bola nas mãos jogado pela IA (a reposição é do ia.js)
  if (m.partida?.iaClassica || m.naMao === j.id) return entradaIA(m, j);
  // recebendo um passe, numa corrida marcada ou indo na bola livre: o código do ia.js
  if ((j.recebe && m.posse !== j.id) || j.corrida) return entradaIA(m, j);
  if (m.posse == null && m.naMao == null && vaiNaLivre(m, j)) return bolaLivre(m, j);
  const f = faseDoTime(m, j.time);
  if (m.posse === j.id) return condutorTatico(m, j) ?? entradaIA(m, j);
  if (f.fase === 'com') return apoioTatico(m, j) ?? referenciaComBola(m, j, f);
  return semBola(m, j, f);
}

/**
 * Quem vai na bola livre (a regra do ia.js vaiNaBolaLivre — quem do time chega primeiro, e no passe
 * do adversário só quem chega antes do recebedor — com histerese): quem já ia leva
 * IA_DEFESA.livre.histerese s de vantagem e, para entrar num passe do adversário, é preciso chegar
 * livre.margem s antes do recebedor. Sem isso, a cada passe deles o mais perto saía da zona para a
 * bola e voltava logo (o tronco ia e voltava: ~45% dos tremores eram até 0,7 s depois de um passe).
 */
function vaiNaLivre(m, j) {
  if (j.posicao === 'GOL') return false;
  const v = m.voo, b = m.bola.p, Lv = (m.iaLivre ??= {}), ant = Lv[j.time];
  if (v && v.para != null && v.time === j.time && v.para !== j.id) return false;
  const atual = ant && ant.tick >= m.tick - 1 ? ant.id : -1, H = IA_DEFESA.livre.histerese;
  const tempo = o => MD.hypot(o.x - b.x, o.z - b.z) / o.par.vArrancada - (o.id === atual ? H : 0);
  const tj = tempo(j);
  for (const o of m.jogadores) {
    if (o === j || o.time !== j.time || o.posicao === 'GOL' || o.papel === 'parado' || o.papel === 'marcador') continue;
    const to = tempo(o);
    if (to < tj || (to === tj && o.id < j.id)) return false;
  }
  if (v && v.para != null && v.time !== j.time) {
    let r = null;
    for (const o of m.jogadores) if (o.id === v.para) { r = o; break; }
    if (r && tempo(r) < tj + (j.id === atual ? 0 : IA_DEFESA.livre.margem)) return false;
  }
  Lv[j.time] = { id: j.id, tick: m.tick };
  return true;
}

/**
 * Bola livre: quem do time chega primeiro vai ao ponto de interceptação (ia.js pontoInterceptacao),
 * correndo, como no ramo 'livre' do ia.js — mas com o ponto filtrado (alvoPressa): a bola que quica
 * e desvia mexia o ponto a cada tick e o tronco de quem ia buscá-la tremia.
 */
function bolaLivre(m, j) {
  const s = estadoIA(m, j);
  const extra = extraAcao(m, j);
  s.ramo = 'livre';
  const p = pontoInterceptacao(m, j);
  _t.x = p.x; _t.z = p.z;
  alvoPressa(m, j, _t);
  return { ...para(j, _t.x, _t.z, 1, true, extra, 'pressa'), botoes: extra | BOTAO.CORRER };
}

// ---------------------------------------------------------------------------------- o time (bloco)

const ehLinha = o => o.posicao !== 'GOL' && o.papel !== 'parado' && o.papel !== 'marcador';
const passeNoAr = v => v && v.tipo !== 'chute' && v.tipo !== 'colocado' && v.tipo !== 'cavadinha';

/**
 * Estado do time sem/com a bola, uma vez por time e por tick (m.iaBloco[time]): quem é o 1º e o 2º
 * homem, se o 1º aperta, os gatilhos, a contrapressão, o pedido de PRESSÃO do humano, a marcação
 * individual na área e — a 10 Hz — as referências de cada vaga e as reivindicações da zona.
 * Guarda só ids e números (o mundo é copiado com structuredClone).
 */
export function blocoDoTime(m, t) {
  const todos = (m.iaBloco ??= {});
  let B = todos[t];
  if (B && B.tick === m.tick) return B;
  if (!B) {
    B = todos[t] = {
      tick: -1, faseAnt: null, p1: -1, p2: -1, aperta1: false, aperta2: false, pedido: -1,
      gatilhoAte: -1, gatilho: '', vooTick: -1, recebePara: -1, donoAnt: -1, cPesado: false, cCostas: false, cLateral: false,
      contra: [], contraAte: -1,
      refTick: -99, ref: new Float64Array(22), refV: new Float64Array(22), zonaAdv: new Int32Array(11).fill(-1), marcaAdv: new Int32Array(11).fill(-1),
      foco: { x: 0, z: 0 }, cvx: 0, cvz: 0, cond: -1, dono: -1, dvx: 0, dvz: 0, bolaRef: { x: 0, z: 0 }, bolaRefDef: { x: 0, z: 0 },
    };
  }
  B.tick = m.tick;
  const f = faseDoTime(m, t);
  const tat = m.times[t].tatica, p = tat.pressao;
  const lado = m.ataca[t], meuGol = -lado * CAMPO.meioX;
  const b = m.bola.p, js = m.jogadores;
  const idB = m.naMao ?? m.posse;
  let dono = null;
  if (idB != null) for (const o of js) if (o.id === idB) { dono = o; break; }
  const adv = dono && dono.time !== t ? dono : null;
  const naParada = !!(m.parada && !m.parada.rolou);
  const humano = m.humanos?.includes(t) ? m.controlado?.[t] : null;

  // foco da pressão: o condutor adversário; com um passe do adversário no ar, o ponto de chegada
  // (o 1º homem vai à recepção); senão a bola
  const v = m.voo;
  if (adv) { B.foco.x = b.x; B.foco.z = b.z; }
  else if (v && v.time != null && v.time !== t && passeNoAr(v) && m.posse == null) { B.foco.x = v.alvo.x; B.foco.z = v.alvo.z; }
  else { B.foco.x = b.x; B.foco.z = b.z; }
  // velocidade do condutor filtrada (~0,5 s): a antecipação do 1º homem (o mesmo filtro do ia.js)
  if (adv && adv.posicao !== 'GOL') {
    if (B.cond !== adv.id) { B.cond = adv.id; B.cvx = adv.vx; B.cvz = adv.vz; }
    const a = DT / IA.filtroCondutor;
    B.cvx += (adv.vx - B.cvx) * a; B.cvz += (adv.vz - B.cvz) * a;
  } else { B.cond = -1; B.cvx = 0; B.cvz = 0; }
  // velocidade (filtrada) de quem tem a bola no pé, de qualquer time: o bloco antecipa para onde a
  // bola vai (sem isso, no modo calma a referência que anda a ~3 m/s deixava o time ~6 m atrasado)
  if (dono && m.naMao == null && dono.posicao !== 'GOL') {
    if (B.dono !== dono.id) { B.dono = dono.id; B.dvx = dono.vx; B.dvz = dono.vz; }
    const a = DT / IA.filtroCondutor;
    B.dvx += (dono.vx - B.dvx) * a; B.dvz += (dono.vz - B.dvz) * a;
  } else { B.dono = -1; B.dvx = 0; B.dvz = 0; }

  // 1º e 2º homem, com histerese de IA.trocaPressao m. 1º: o mais perto do foco (sem o goleiro); quem
  // está — ou tem a referência — à frente da bola (do lado do gol dele) paga IA_DEFESA.frentePaga m:
  // chegar por trás para conter dá a volta no condutor, e o atacante que acompanhou o condutor desde
  // a saída entrega a contenção ao meio-campista quando a bola passa da linha dele. 2º (cobertura):
  // o mais perto entre os que estão do lado do meu gol (o centroavante não volta para cobrir).
  // Quem é da linha de defesa paga IA_DEFESA.defesaPaga m com a bola à frente da referência dele: o
  // lateral que sai para conter tira a linha de 4 do lugar (Metrica: 3,5 m de espalhamento no
  // bloco baixo) — o meio-campista chega antes.
  const ub = B.foco.x * lado, fp = IA_DEFESA.frentePaga, dp = IA_DEFESA.defesaPaga;
  const vagas = FORMACOES[m.times[t].formacao].vagas;
  const efetiva = o => {
    let d = MD.hypot(o.x - B.foco.x, o.z - B.foco.z);
    if (B.refTick < 0) return d;
    const ur = B.ref[2 * o.vagaIdx] * lado;
    if (o.x * lado > ub + 1 || ur > ub + 1) d += fp;
    else if (vagas[o.vagaIdx].grupo === 'def' && ub > ur + 3) d += dp;
    return d;
  };
  let p1 = null, d1 = Infinity, at1 = null, dAt1 = Infinity;
  for (const o of js) {
    if (o.time !== t || !ehLinha(o)) continue;
    const d = efetiva(o);
    if (d < d1) { d1 = d; p1 = o; }
    if (o.id === B.p1) { at1 = o; dAt1 = d; }
  }
  if (at1 && at1 !== p1 && dAt1 < d1 + IA.trocaPressao) p1 = at1;
  let p2 = null, d2 = Infinity, at2 = null, dAt2 = Infinity;
  for (const o of js) {
    if (o.time !== t || !ehLinha(o) || o === p1 || o.x * lado > ub + 1) continue;
    // (quem tem a referência à frente da bola — o atacante que a bola passou — paga frentePaga: a
    // cobertura é do meio; com o atacante cobrindo ~1/4 do tempo, a linha da frente ficava ~6 m
    // atrás da referência e o meio–ataque caía para ~8 m: teste-forma)
    let d = MD.hypot(o.x - B.foco.x, o.z - B.foco.z);
    if (B.refTick >= 0 && B.ref[2 * o.vagaIdx] * lado > ub + 1) d += fp;
    if (d < d2) { d2 = d; p2 = o; }
    if (o.id === B.p2) { at2 = o; dAt2 = d; }
  }
  if (at2 && at2 !== p2 && dAt2 < d2 + IA.trocaPressao) p2 = at2;
  B.p1 = p1 ? p1.id : -1;
  B.p2 = p2 ? p2.id : -1;

  // troca de fase: perdeu a bola → contrapressão dos que estavam perto (pesquisa §4.3: só com a perda
  // no campo adversário ou perto da lateral, e com gente perto — tantos ou mais que eles a ≤ raio m;
  // os outros recompõem). Não numa bola parada.
  if (B.faseAnt === 'com' && f.fase === 'sem' && !naParada && IA_DEFESA.contrapressao.s[p] > 0) {
    B.contra.length = 0;
    const R = IA_DEFESA.contrapressao.raio, max = IA_DEFESA.contrapressao.max[p];
    let meus = 0, deles = 0;
    for (const o of js) {
      if (!ehLinha(o) || MD.hypot(o.x - b.x, o.z - b.z) > R) continue;
      if (o.time === t) meus++; else deles++;
    }
    const lugar = b.x * lado > IA_DEFESA.contrapressao.campo || Math.abs(b.z) > IA_DEFESA.gatilhos.lateral;
    if (lugar && meus >= deles - IA_DEFESA.contrapressao.inferioridade) {
      for (let k = 0; k < max; k++) {
        let mel = null, dm = R;
        for (const o of js) {
          if (o.time !== t || !ehLinha(o) || o.id === humano || B.contra.includes(o.id)) continue;
          const d = MD.hypot(o.x - b.x, o.z - b.z);
          if (d < dm || (d === dm && mel && o.vagaIdx < mel.vagaIdx)) { dm = d; mel = o; }
        }
        if (!mel) break;
        B.contra.push(mel.id);
      }
      B.contraAte = m.tick + seg(IA_DEFESA.contrapressao.s[p]);
    }
    // e o 1º homem aperta logo depois da perda (FIFA 23: "pressão após perda"), se estiver perto
    if (p >= 1) gatilho(m, B, 'perda');
  }
  if (f.fase === 'com' || naParada) B.contraAte = -1;
  B.faseAnt = f.fase;

  // gatilhos de pressão (pesquisa §4.4), só na Média e na Alta
  const G = IA_DEFESA.gatilhos;
  if (f.fase === 'sem' && !naParada) {
    const ladoAdv = m.ataca[1 - t];
    if (v && v.time != null && v.time !== t && v.tick0 !== B.vooTick) {
      B.vooTick = v.tick0;
      B.recebePara = passeNoAr(v) && v.para != null ? v.para : -1;
      if (passeNoAr(v)) {
        let de = null;
        for (const o of js) if (o.id === v.de) { de = o; break; }
        if (de && de.posicao !== 'GOL' && (v.alvo.x - de.x) * ladoAdv < -G.passeTras) gatilho(m, B, 'passeTras');
      }
    }
    // os de estado disparam na BORDA (quando começam): de costas o tempo todo, o 1º homem apertaria
    // sem parar
    if (adv && adv.posicao !== 'GOL') {
      if (adv.id !== B.donoAnt && adv.id === B.recebePara) gatilho(m, B, 'recepcao');
      const pesado = MD.hypot(b.x - adv.x, b.z - adv.z) > G.toquePesado;
      const cr = MD.cos(adv.rumo), sr = MD.sin(adv.rumo);
      const costas = cr * ladoAdv < MD.cos(G.costas);
      const lateral = Math.abs(b.z) > G.lateral && sr * (b.z > 0 ? 1 : -1) > 0.5;
      const novo = adv.id !== B.donoAnt;
      if (pesado && (novo || !B.cPesado)) gatilho(m, B, 'toquePesado');
      if (costas && (novo || !B.cCostas)) gatilho(m, B, 'costas');
      if (lateral && (novo || !B.cLateral)) gatilho(m, B, 'lateral');
      B.cPesado = pesado; B.cCostas = costas; B.cLateral = lateral;
    } else { B.cPesado = false; B.cCostas = false; B.cLateral = false; }
  }
  B.donoAnt = adv ? adv.id : -1;
  B.gatilhoPerto = false;
  if (adv && p1) B.gatilhoPerto = MD.hypot(p1.x - adv.x, p1.z - adv.z) <= G.alcance;
  // (o gatilho só vale com o 1º homem perto o bastante para chegar: gatilhos.alcance m do condutor)
  const comGatilho = p >= 1 && B.gatilhoAte >= m.tick && B.gatilhoPerto;

  // 1º homem: aperta ou contém (o goleiro adversário com a bola na mão não é pressionado: Regra 12.3)
  const dGol = MD.hypot(B.foco.x - meuGol, B.foco.z);
  const engajado = dGol <= IA_DEFESA.engaja[p];
  B.engajado = engajado;
  B.aperta1 = !!adv && adv.posicao !== 'GOL' && (comGatilho || dGol <= IA_DEFESA.perigo || IA_DEFESA.apertaSempre[p]) && engajado;
  // (Alta: "2 pressionam" — o 2º homem fecha o lado de dentro junto com o 1º; tela §7.5)
  B.aperta2 = !!adv && adv.posicao !== 'GOL' && p >= 2 && engajado && (comGatilho || IA_DEFESA.doisApertam[p]);

  // PRESSÃO segurada pelo humano: o companheiro mais perto (≠ controlado) aperta
  B.pedido = -1;
  if ((m.pedidoPressao?.[t] ?? -99) >= m.tick - 1 && f.fase === 'sem' && adv && adv.posicao !== 'GOL') {
    let mel = null, dm = Infinity;
    for (const o of js) {
      if (o.time !== t || !ehLinha(o) || o.id === humano) continue;
      const d = MD.hypot(o.x - b.x, o.z - b.z);
      if (d < dm) { dm = d; mel = o; }
    }
    if (mel) B.pedido = mel.id;
  }

  // marcação individual dos atacantes perto do meu gol, pela linha de defesa (a cada tick: o
  // atacante na área corre)
  marcarNaArea(m, t, B, meuGol, humano, adv);
  // referências e zona a 10 Hz (escalonado por time)
  if (m.tick - B.refTick >= TATICA.avaliaTicks || (m.tick + t * 3) % TATICA.avaliaTicks === 0) {
    const dt = (m.tick - B.refTick) * DT;
    B.refTick = m.tick;
    referencias(m, t, B, f, adv, dt);
  }
  return B;
}

function gatilho(m, B, nome) {
  B.gatilhoAte = m.tick + seg(IA_DEFESA.gatilhos.janela);
  B.gatilho = nome;
}

/** Ocupado num papel de pressão (não marca nem guarda zona). */
function pressiona(m, B, id) {
  return id === B.p1 || id === B.pedido || (B.contraAte > m.tick && B.contra.includes(id)) || (B.aperta2 && id === B.p2);
}

const _ataq = [];
function marcarNaArea(m, t, B, meuGol, humano, adv) {
  const R = IA_DEFESA.individualArea;
  const ant = B.marcaAdv;
  // atacantes (sem o condutor e o goleiro) a ≤ R m do meu gol, do mais perto ao mais longe
  _ataq.length = 0;
  for (const o of m.jogadores) {
    if (o.time === t || !ehLinha(o) || (adv && o.id === adv.id)) continue;
    const d = MD.hypot(o.x - meuGol, o.z);
    if (d > R) continue;
    let k = _ataq.length;
    _ataq.push(o);
    while (k > 0) {
      const q = _ataq[k - 1], dq = MD.hypot(q.x - meuGol, q.z);
      if (dq < d || (dq === d && q.id < o.id)) break;
      _ataq[k] = q; _ataq[k - 1] = o; k--;
    }
  }
  // quem já marcava guarda o homem (IA.trocaMarcacao m de vantagem); o resto, guloso
  const novo = _novo; novo.fill(-1);
  if (_ataq.length) {
    const vagas = FORMACOES[m.times[t].formacao].vagas;
    for (const a of _ataq) {
      let mel = null, dm = Infinity;
      for (const o of m.jogadores) {
        if (o.time !== t || !ehLinha(o) || o.id === humano || vagas[o.vagaIdx].grupo !== 'def') continue;
        if (novo[o.vagaIdx] >= 0 || pressiona(m, B, o.id)) continue;
        const d = MD.hypot(a.x - o.x, a.z - o.z) - (ant[o.vagaIdx] === a.id ? IA.trocaMarcacao : 0);
        if (d < dm || (d === dm && mel && o.vagaIdx < mel.vagaIdx)) { dm = d; mel = o; }
      }
      if (mel) novo[mel.vagaIdx] = a.id;
    }
  }
  ant.set(novo);
}
const _novo = new Int32Array(11);

const _r = { x: 0, z: 0 }, _o = { x: 0, z: 0 };
/**
 * Referência de cada vaga do time t (B.ref[2k], B.ref[2k + 1]) pela posicaoTatica, com a mistura
 * com/sem nos TATICA.mistura s depois da troca de fase, e as reivindicações da zona (sem a bola).
 */
function referencias(m, t, B, f, adv, dt) {
  const T = m.times[t], form = FORMACOES[T.formacao], lado = m.ataca[t];
  const v = m.voo;
  // bola de referência: com um passe no ar, o ponto de chegada (o bloco antecipa); com a bola nas
  // mãos de um goleiro, a referência é a saída de jogo (IA.saidaGoleiro m do gol dele)
  // A linha de defesa usa a bola onde ela estará em TATICA.antecipaDef s (velocidade filtrada de quem
  // a conduz; no máximo antecipaMax m): ela tem de recuar a tempo. O resto do bloco usa a bola de
  // agora (TATICA.antecipa) — antecipar todo mundo fazia o bloco ir e voltar a cada drible.
  const lim = CAMPO.meioX - IA.saidaGoleiro;
  const goleiro = m.naMao != null || (adv && adv.posicao === 'GOL') || (m.posse != null && !adv && donoEhGoleiro(m));
  bolaDeReferencia(m, B, v, TATICA.antecipa, goleiro, lim, B.bolaRef);
  bolaDeReferencia(m, B, v, TATICA.antecipaDef, goleiro, lim, B.bolaRefDef);
  const outra = f.fase === 'com' ? 'sem' : 'com';
  for (const vg of form.vagas) {
    const k = form.indice[vg.id];
    const bola = vg.grupo === 'def' ? B.bolaRefDef : B.bolaRef;
    posicaoTatica(T.formacao, vg, T.tatica, bola, f.fase, lado, _r);
    if (f.mistura < 1) {
      posicaoTatica(T.formacao, vg, T.tatica, bola, outra, lado, _o);
      _r.x = _o.x + (_r.x - _o.x) * f.mistura;
      _r.z = _o.z + (_r.z - _o.z) * f.mistura;
    }
    // velocidade da referência (filtrada): quem segue a referência mira um pouco à frente dela
    // (sem isso, o time que recua atrás da bola andava ~2,5 m atrasado no próprio ritmo dela)
    const V = B.refV;
    if (dt > 0 && dt <= 0.5) {
      let vx = (_r.x - B.ref[2 * k]) / dt, vz = (_r.z - B.ref[2 * k + 1]) / dt;
      const l = MD.hypot(vx, vz), vm = TATICA.lead.vMax;
      if (l > vm) { vx *= vm / l; vz *= vm / l; }
      V[2 * k] += (vx - V[2 * k]) * TATICA.lead.filtro; V[2 * k + 1] += (vz - V[2 * k + 1]) * TATICA.lead.filtro;
    } else { V[2 * k] = 0; V[2 * k + 1] = 0; }
    B.ref[2 * k] = _r.x; B.ref[2 * k + 1] = _r.z;
  }
  // zona: cada adversário perto de uma referência (≤ zona.raio m) e no nível dela ou atrás (do lado
  // do meu gol: o que ataca as costas da zona; o da frente é do bloco que sobe com a bola) é
  // reivindicado por no máximo um jogador do meio (e da frente, na pressão Alta), o par mais perto
  // primeiro (o par de antes leva 1,5 m de vantagem)
  const ant = B.zonaAdv, novo = _novo;
  novo.fill(-1);
  if (f.fase === 'sem') {
    const pr = T.tatica.pressao;
    const R = IA_DEFESA.zona.raio, frente = IA_DEFESA.linhaDePasse.pressao[pr] ? IA_DEFESA.linhaDePasse.frente : IA_DEFESA.zona.frente;
    for (let it = 0; it < 11; it++) {
      let mk = -1, mo = null, dm = Infinity;
      for (const vg of form.vagas) {
        if (vg.grupo === 'gol' || vg.grupo === 'def') continue;
        // a linha da frente só reivindica na pressão Alta (fecha a saída); nas outras ela fica na
        // referência: marcando do lado do gol o meia que passava por ela, ficava ~5 m atrás da
        // referência e o meio–ataque caía (teste-forma)
        if (vg.sem.x >= 0 && !IA_DEFESA.linhaDePasse.pressao[pr]) continue;
        const k = form.indice[vg.id];
        if (novo[k] >= 0) continue;
        const rx = B.ref[2 * k], rz = B.ref[2 * k + 1];
        for (const o of m.jogadores) {
          if (o.time === t || !ehLinha(o) || (adv && o.id === adv.id)) continue;
          let livre = true;
          for (let q = 0; q < 11; q++) if (novo[q] === o.id) { livre = false; break; }
          if (!livre) continue;
          if ((o.x - rx) * lado > frente) continue;
          const d = MD.hypot(o.x - rx, o.z - rz) - (ant[k] === o.id ? 1.5 : 0);
          if (d < R && (d < dm || (d === dm && o.id < mo.id))) { dm = d; mk = k; mo = o; }
        }
      }
      if (mk < 0) break;
      novo[mk] = mo.id;
    }
  }
  ant.set(novo);
}

/**
 * Bola de referência (out): o ponto de chegada do passe no ar; com a bola no pé de alguém (de linha),
 * o CORPO de quem conduz (a bola vai e volta à frente dele a cada toque — a referência andava aos
 * trancos, a cada ~0,45 s, e o tronco de quem a seguia ia e voltava junto); senão a bola. Mais
 * `antecipa` s da velocidade de quem conduz. Com goleiro, a saída de jogo.
 */
function bolaDeReferencia(m, B, v, antecipa, goleiro, lim, out) {
  if (v && v.time != null && passeNoAr(v) && m.posse == null && m.naMao == null) { out.x = v.alvo.x; out.z = v.alvo.z; }
  else {
    let ax = B.dvx * antecipa, az = B.dvz * antecipa;
    const l = MD.hypot(ax, az);
    if (l > TATICA.antecipaMax) { ax *= TATICA.antecipaMax / l; az *= TATICA.antecipaMax / l; }
    let bx = m.bola.p.x, bz = m.bola.p.z;
    if (B.dono >= 0) for (const o of m.jogadores) if (o.id === B.dono) { bx = o.x; bz = o.z; break; }
    out.x = bx + ax; out.z = bz + az;
  }
  if (goleiro) out.x = Math.max(-lim, Math.min(lim, out.x));
  return out;
}

function donoEhGoleiro(m) {
  for (const o of m.jogadores) if (o.id === m.posse) return o.posicao === 'GOL';
  return false;
}

// ------------------------------------------------------------------------------- jogador sem bola

const _t = { x: 0, z: 0, mag: 1, modo: 'calma', correr: false };

function extraAcao(m, j) {
  if (!j.iaAcao) return 0;
  if (m.tick < j.iaAcao.ate) return j.iaAcao.bot;
  j.iaAcao = null;
  return 0;
}

/** Leva ao ponto (x, z) respeitando a bola parada (adversários fora do raio da cobrança). */
function irPara(m, j, x, z, mag, correr, extra, modo) {
  if (m.parada && !m.parada.rolou) { restricaoParada(m, j, x, z, _t); x = _t.x; z = _t.z; }
  return para(j, x, z, mag, correr, extra, modo);
}

/**
 * Ponto calmo de quem segue a referência (zona, linha, cobertura, apoio). A referência anda a cada
 * passe e a cada avaliação de 10 Hz; seguir cada pedacinho dela a passo lento fazia o jogador ir e
 * voltar, andar de lado cruzando as pernas e o tronco tremer (teste-movimento --modo partida): na
 * faixa de ~1,2–1,8 m/s o sim.js estreita, pela velocidade, o quanto o tronco pode olhar a bola.
 * TATICA.suave (a linha de defesa usa TATICA.suaveLinha; o apoio com a bola sem a Parte 3, TATICA.suaveApoio):
 *  - o alvo passa por um filtro (tau s) e a velocidade dele por outro (tauVel s);
 *  - RECUO (só sem a bola, `lado` = m.ataca do time): com o alvo andando para o meu gol, o ponto vai
 *    à frente dele SÓ na profundidade, fRecuo × a velocidade dessa componente × recuo.s s (no máximo
 *    recuo.max m) — tira o atraso do filtro e do passo calmo (a linha ficava ~6 m alta com a bola
 *    entrando no meu terço); subindo, o mesmo com fSobe. Contínuo: quando a bola para, o ponto volta
 *    junto com o filtro, sem ir e voltar;
 *  - quieto a menos de quieto[0] m até o alvo passar de quieto[1] m; marcha lenta (intensidade
 *    marcha[2], ~1 m/s, abaixo da faixa) a menos de marcha[0] m até passar de marcha[1] m; mais longe,
 *    o modo calma do para() (≥ ~1,9 m/s, acima da faixa), trotando (intensidade no máximo trote[0])
 *    até trote[1] m — correr o tempo todo atrás de cada passe não é o jogo (e a passada de corrida
 *    cruza as pernas: teste-movimento);
 *  - AJUSTE: com o alvo parado (abaixo de vParado m/s) há ajusta[0] s, vai até ele com intensidade
 *    d / dist (no mínimo a da marcha) e fica quieto a ajusta[1] m (retoma além de ajusta[2] m): bola
 *    parada, posse lenta — chega no lugar, sem ficar parado a 1,5 m dele.
 * Reinicia quando o papel muda. Devolve out = {x, z, mag, modo, correr}.
 */
function alvoCalmo(m, j, x, z, out, lado = 0, fRecuo = 1, fSobe = 0) {
  const r = j.ia.ramo, it = estadoT(j), S = r === 'linha' ? TATICA.suaveLinha : r === 'apoio' ? TATICA.suaveApoio : TATICA.suave;
  if (it.sTick !== m.tick - 1 || it.sRamo !== j.ia.ramo) {
    it.fx = x; it.fz = z; it.vx = 0; it.vz = 0; it.vf = 0;
    it.quieto = false; it.lento = false; it.tParado = 0;
  } else {
    const a = DT / S.tau, b = Math.min(1, DT / S.tauVel);
    const nx = it.fx + (x - it.fx) * a, nz = it.fz + (z - it.fz) * a;
    it.vx += ((nx - it.fx) / DT - it.vx) * b; it.vz += ((nz - it.fz) / DT - it.vz) * b;
    it.vf = MD.hypot(it.vx, it.vz);
    it.fx = nx; it.fz = nz;
  }
  it.sTick = m.tick; it.sRamo = j.ia.ramo;
  let px = it.fx;
  const vD = it.vx * lado, fD = vD < 0 ? fRecuo : fSobe;
  if (fD > 0) px += lado * Math.sign(vD) * fD * Math.min(S.recuo.max, Math.abs(vD) * S.recuo.s);
  out.x = px; out.z = it.fz; out.mag = 1; out.modo = 'calma'; out.correr = true;
  it.tParado = it.vf < S.vParado ? it.tParado + DT : 0;
  const d = MD.hypot(px - j.x, it.fz - j.z), q = S.quieto, g = S.marcha, A = S.ajusta;
  const ajuste = it.tParado >= A[0];
  it.quieto = it.quieto ? d < (ajuste ? A[2] : q[1]) : d < (ajuste ? A[1] : q[0]);
  it.lento = it.lento ? d < g[1] : d < g[0];
  // no ajuste, o modo pressa com intensidade d / dist (no mínimo a da marcha; a histerese de 0,6 m
  // dele deixa chegar a ajusta[1] m); senão o modo calma do para() (filtro, freada na linha e
  // histerese de 1,2 m)
  if (it.quieto) { out.x = j.x; out.z = j.z; it.dTick = -9; return out; }
  if (ajuste) { out.modo = 'pressa'; out.mag = Math.min(1, Math.max(g[2], d / S.dist)); out.correr = d > S.corre; }
  else if (it.lento) out.mag = g[2];
  else {
    // longe: a intensidade do modo calma (d / 14), mas nunca abaixo de trote[2] (~1,9 m/s: acima
    // da faixa em que o tronco treme) e no máximo trote[0] até trote[1] m — pelo modo pressa, que
    // não tem piso próprio (o rumo já vem filtrado e com o giro limitado, abaixo)
    out.modo = 'pressa';
    out.mag = Math.max(S.trote[2], Math.min(d < S.trote[1] ? S.trote[0] : 1, d / 14));
    out.correr = d > S.corre;
  }
  // o rumo pedido gira no máximo giro[1] rad/s (trotando o tronco vai com o caminho); andando
  // (marcha) com a bola atrás do caminho (mais de giro[2] rad), no máximo giro[0]: ali o sim.js segura
  // o lado do olhar e o tronco gira o DOBRO do caminho — um ponto perto que pulava 25° virava um
  // tranco de 50° no tronco, e o próximo, para o outro lado; andando com a bola à frente ou de lado
  // o tronco só olha a bola (giro[3])
  if (d > 1e-6) {
    const aD = MD.atan2(out.z - j.z, out.x - j.x);
    if (it.dTick !== m.tick - 1) it.dir = MD.hypot(j.vx, j.vz) > 0.5 ? MD.atan2(j.vz, j.vx) : aD;
    const atras = Math.abs(difAng(it.dir, MD.atan2(m.bola.p.z - j.z, m.bola.p.x - j.x))) > S.giro[2];
    const w = (it.lento && !ajuste ? (atras ? S.giro[0] : S.giro[3]) : S.giro[1]) * DT, dA = difAng(it.dir, aD);
    // (virada grande — mais de giro[4] rad — vai de uma vez: o para() freia na linha antes de virar;
    // girando aos poucos, quem recuava quando o goleiro pegou a bola seguia ~2 s para o próprio gol)
    it.dir = Math.abs(dA) > S.giro[4] ? aD : it.dir + Math.max(-w, Math.min(w, dA));
    out.x = j.x + MD.cos(it.dir) * d; out.z = j.z + MD.sin(it.dir) * d;
  }
  it.dTick = m.tick;
  return out;
}

function semBola(m, j, f) {
  const s = estadoIA(m, j);
  const B = blocoDoTime(m, j.time);
  const extra = extraAcao(m, j);
  const lado = m.ataca[j.time], meuGol = -lado * CAMPO.meioX;
  const p = m.times[j.time].tatica.pressao;
  const b = m.bola.p;
  const advComBola = B.cond >= 0; // condutor adversário de linha com a bola no pé
  const naMaoAdv = m.naMao != null;
  // 1) contrapressão (janela depois da perda)
  if (B.contraAte > m.tick && B.contra.includes(j.id) && !naMaoAdv) return apertar(m, j, s, B, meuGol, extra, 'contra');
  // 2) PRESSÃO pedida pelo humano
  if (j.id === B.pedido) return apertar(m, j, s, B, meuGol, extra, 'aperta');
  // 3) 1º homem
  // (com a bola além da linha de engajamento ele não sai do bloco: segue a zona, abaixo)
  if (j.id === B.p1 && !naMaoAdv && B.engajado) {
    if (B.aperta1) return apertar(m, j, s, B, meuGol, extra, 'aperta');
    return conter(m, j, s, B, meuGol, IA_DEFESA.contencao[p], extra);
  }
  // 4) 2º homem (Média e Alta)
  if (j.id === B.p2 && p >= 1 && advComBola && !naMaoAdv) {
    if (B.aperta2) return apertar(m, j, s, B, meuGol, extra, 'aperta', 1);
    if (B.engajado) return cobrir(m, j, s, B, meuGol, extra);
  }
  // 5) marcação individual perto do meu gol (linha de defesa)
  const k = j.vagaIdx;
  if (B.marcaAdv[k] >= 0) {
    let a = null;
    for (const o of m.jogadores) if (o.id === B.marcaAdv[k]) { a = o; break; }
    if (a) {
      // do lado do gol do atacante, mas sem sair da linha para a frente: com o atacante à frente da
      // linha, o marcador fica na altura da linha e só acompanha de lado (a linha não se desmancha)
      const gx = meuGol - a.x, gz = -a.z, g = MD.hypot(gx, gz) || 1;
      const d = IA_DEFESA.marcaDist;
      let tx = a.x + (gx / g) * d;
      const xl = B.ref[2 * k];
      if ((tx - xl) * lado > 0) tx = xl;
      s.ramo = 'marca';
      return irPara(m, j, tx, a.z + (gz / g) * d, 1, true, extra, 'pressa');
    }
  }
  // 6) referência (linha alinhada ou zona), com recomposição
  const vaga = FORMACOES[m.times[j.time].formacao].vagas[k];
  pontoRef(B, k, _t, vaga.grupo === 'def');
  let tx = _t.x, tz = _t.z;
  s.ramo = vaga.grupo === 'def' ? 'linha' : 'zona';
  const za = B.zonaAdv[k];
  if (za >= 0) {
    for (const o of m.jogadores) {
      if (o.id !== za) continue;
      let ax, az;
      const L = IA_DEFESA.linhaDePasse;
      let c = null;
      if (L.pressao[p] && B.cond >= 0) for (const q of m.jogadores) if (q.id === B.cond) { c = q; break; }
      if (c && MD.hypot(o.x - c.x, o.z - c.z) <= L.alcance) {
        // pressão Alta: fecha a linha de passe do condutor para ele (FM: "os outros fecham linhas de
        // passe"; mais interceptações — o PPDA cai)
        ax = c.x + (o.x - c.x) * L.ponto; az = c.z + (o.z - c.z) * L.ponto;
        s.ramo = 'fechaLinha';
      } else {
        const gx = meuGol - o.x, gz = -o.z, g = MD.hypot(gx, gz) || 1;
        ax = o.x + (gx / g) * IA_DEFESA.marcaDist; az = o.z + (gz / g) * IA_DEFESA.marcaDist;
      }
      tx += (ax - tx) * IA_DEFESA.zona.peso; tz += (az - tz) * IA_DEFESA.zona.peso;
      break;
    }
  }
  // recomposição: à frente da referência (o bloco recua) — vai direto (pressa), e corre de longe com a
  // bola vindo para o meu gol (defesa rápida); histerese para não piscar entre os modos
  const it = estadoT(j);
  const frente = (j.x - tx) * lado;
  const R = IA_DEFESA.recompoe;
  it.recua = (vaga.grupo === 'def' || frente > IA_DEFESA.recomposicao) && (it.recua ? frente > R.desliga : frente > R.liga);
  if (it.recua) {
    const vem = advComBola ? -(B.cvx * lado) : -(m.bola.v.x * lado);
    const corre = frente > IA_DEFESA.recomposicao && vem > IA_DEFESA.recompoeVel;
    s.ramo = corre ? 'recompoe' : s.ramo;
    const e = irPara(m, j, tx, tz, 1, corre, extra, 'pressa');
    return corre ? { ...e, botoes: extra | BOTAO.CORRER } : e;
  }
  // (a linha da frente não recua a todo vapor — ela fica para a saída — e sobe junto com a bola que
  // volta para o goleiro deles, para pressionar; o meio e a defesa recuam no ritmo da bola e sobem
  // com calma: TATICA.recuoFrente)
  const frenteSem = vaga.grupo !== 'def' && vaga.sem.x >= 0;
  alvoCalmo(m, j, tx, tz, _t, lado, frenteSem ? TATICA.recuoFrente[0] : 1, frenteSem ? TATICA.recuoFrente[1] : 0);
  return deCostasSemTremer(m, j, irPara(m, j, _t.x, _t.z, _t.mag, _t.correr, extra, _t.modo));
}

/**
 * Ponto que segue a referência da vaga k: ela mais `lead` s da velocidade dela (no máx. lead.max m;
 * a linha de defesa usa TATICA.lead.def, o resto TATICA.lead.s).
 */
function pontoRef(B, k, out, def = false) {
  const ls = def ? TATICA.lead.def : TATICA.lead.s;
  let lx = B.refV[2 * k] * ls, lz = B.refV[2 * k + 1] * ls;
  const l = MD.hypot(lx, lz);
  if (l > TATICA.lead.max) { lx *= TATICA.lead.max / l; lz *= TATICA.lead.max / l; }
  out.x = B.ref[2 * k] + lx; out.z = B.ref[2 * k + 1] + lz;
  return out;
}

/**
 * Andando devagar para longe da bola (recuando), o sim.js vira o tronco para olhar a bola; com a bola
 * a ~150° do caminho, o lado por onde o tronco gira trocava a cada pequena mudança do caminho (o
 * tremor do teste-movimento). Entre TATICA.suave.costas[0] e [1] rad, o caminho gira para
 * costas[1] (bem de costas para a bola, onde o sim.js guarda o lado escolhido), mantendo o lado.
 * Só no passo lento (intensidade ≤ costas[2]); o desvio é de no máximo ~30°.
 */
function deCostasSemTremer(m, j, e) {
  const mag = MD.hypot(e.x, e.z), C = TATICA.suave.costas;
  if (mag < 1e-6 || mag > C[2]) return e;
  const aMov = MD.atan2(e.z, e.x), aB = MD.atan2(m.bola.p.z - j.z, m.bola.p.x - j.x);
  const d = difAng(aMov, aB), ad = Math.abs(d);
  if (ad <= C[0] || ad >= C[1]) return e;
  const n = aB - (d >= 0 ? C[1] : -C[1]);
  e.x = MD.cos(n) * mag; e.z = MD.sin(n) * mag;
  return e;
}

/**
 * Ponto de quem pressiona (conter, apertar, contrapressão), com um filtro curto (TATICA.suave.tauPressa
 * s): o ponto anda com cada toque do condutor e, sem o filtro do modo calma, o tronco ia e voltava
 * a cada drible de lado. Com `lead` s (> 0), mira à frente pela velocidade do ponto filtrado (filtro
 * de tauVelPressa s): tira o atraso do filtro e do controle proporcional do modo pressa — quem contém
 * recua no ritmo do condutor, sem deixar ele chegar. Reinicia quando o papel muda.
 */
function alvoPressa(m, j, out, lead = 0) {
  const it = estadoT(j), S = TATICA.suave;
  if (it.pTick !== m.tick - 1 || it.pRamo !== j.ia.ramo) { it.px = out.x; it.pz = out.z; it.pvx = 0; it.pvz = 0; }
  else {
    const a = Math.min(1, DT / S.tauPressa), c = Math.min(1, DT / S.tauVelPressa);
    const nx = it.px + (out.x - it.px) * a, nz = it.pz + (out.z - it.pz) * a;
    it.pvx += ((nx - it.px) / DT - it.pvx) * c; it.pvz += ((nz - it.pz) / DT - it.pvz) * c;
    it.px = nx; it.pz = nz;
  }
  it.pTick = m.tick; it.pRamo = j.ia.ramo;
  out.x = it.px + it.pvx * lead; out.z = it.pz + it.pvz * lead;
  return out;
}

/** Estado da IA tática do jogador (criado uma vez e reaproveitado). */
function estadoT(j) {
  return j.iaT ??= { recua: false, sTick: -9, sRamo: '', fx: 0, fz: 0, vx: 0, vz: 0, vf: 0, quieto: false, lento: false, tParado: 0, dir: 0, dTick: -9, pTick: -9, pRamo: '', px: 0, pz: 0, pvx: 0, pvz: 0 };
}

/**
 * Ponto entre o foco (a bola; na contenção, o corpo do condutor: a distância real é até ele) e o meu
 * gol a `dist` m, mirando à frente pela velocidade (filtrada) do condutor.
 */
function pontoPressao(m, B, meuGol, dist, out, antecipa = IA.antecipaPressao, peloCorpo = false) {
  let fx = B.foco.x, fz = B.foco.z;
  if (peloCorpo && B.cond >= 0) for (const o of m.jogadores) if (o.id === B.cond) { fx = o.x; fz = o.z; break; }
  const gx = meuGol - fx, gz = -fz, g = MD.hypot(gx, gz) || 1;
  let ax = B.cvx * antecipa, az = B.cvz * antecipa;
  const l = MD.hypot(ax, az);
  if (l > IA.antecipaMax) { ax *= IA.antecipaMax / l; az *= IA.antecipaMax / l; }
  out.x = fx + (gx / g) * dist + ax;
  out.z = fz + (gz / g) * dist + az;
  return out;
}

/** Bola solta do pé de quem conduz (entre toques) e EU mais perto dela que ele: ataca a bola (como o ia.js). */
function atacaBola(m, j, s) {
  const b = m.bola.p;
  let d0 = null;
  if (m.posse != null) for (const o of m.jogadores) if (o.id === m.posse) { d0 = o; break; }
  if (d0 && d0.time !== j.time && d0.posicao !== 'GOL') {
    const dc = MD.hypot(b.x - d0.x, b.z - d0.z), dj = MD.hypot(b.x - j.x, b.z - j.z);
    s.ataca = s.ataca ? dj < dc + 0.3 : dc > ACOES.boteIA.bolaSolta && dj < dc - 0.2;
  } else s.ataca = false;
  return s.ataca;
}

/** Aperta o condutor (1,5 m, e o boteIA tenta tirar). `lado2` = 2º a apertar (fecha por dentro). */
function apertar(m, j, s, B, meuGol, extra, ramo, lado2 = 0) {
  const b = m.bola.p;
  if (atacaBola(m, j, s)) { s.ramo = 'ataca'; return { ...irPara(m, j, b.x, b.z, 1, true, extra, 'pressa'), botoes: extra | BOTAO.CORRER }; }
  s.ramo = ramo;
  if (ramo === 'contra') pontoPressao(m, B, meuGol, IA_DEFESA.contrapressao.dist, _t, IA_DEFESA.antecipaContem);
  else pontoPressao(m, B, meuGol, IA_DEFESA.aperto[m.times[j.time].tatica.pressao], _t);
  if (lado2) {
    // o 2º fecha o lado de dentro (para o meio do campo), sem disputar o mesmo ponto com o 1º
    const gx = _t.x - B.foco.x, gz = _t.z - B.foco.z, g = MD.hypot(gx, gz) || 1;
    const sz = B.foco.z > 0 ? -1 : 1;
    let nx = -gz / g, nz = gx / g;
    if (nz * sz < 0) { nx = -nx; nz = -nz; }
    _t.x += nx * IA_DEFESA.apertoLado; _t.z += nz * IA_DEFESA.apertoLado;
  }
  // arranca (CORRER) de longe; na pressão Alta, já de perto (fecha o condutor que trota)
  const d = MD.hypot(_t.x - j.x, _t.z - j.z);
  alvoPressa(m, j, _t);
  return irPara(m, j, _t.x, _t.z, 1, d > IA_DEFESA.apertoArranca[m.times[j.time].tatica.pressao], extra, 'pressa');
}

/** Contém: entre a bola e o meu gol a `c` m, de frente para o condutor (sem bote). */
function conter(m, j, s, B, meuGol, c, extra) {
  const b = m.bola.p;
  if (atacaBola(m, j, s)) { s.ramo = 'ataca'; return { ...irPara(m, j, b.x, b.z, 1, true, extra, 'pressa'), botoes: extra | BOTAO.CORRER }; }
  s.ramo = 'contem';
  pontoPressao(m, B, meuGol, c, _t, IA_DEFESA.antecipaContem, true);
  const d = MD.hypot(_t.x - j.x, _t.z - j.z);
  alvoPressa(m, j, _t, IA_DEFESA.contemLead);
  return irPara(m, j, _t.x, _t.z, 1, d > IA.pressaoArranca, extra, 'pressa');
}

/** 2º homem: cobertura atrás do 1º, do lado do gol e por dentro (na diagonal). */
function cobrir(m, j, s, B, meuGol, extra) {
  s.ramo = 'cobre';
  const fx = B.foco.x, fz = B.foco.z;
  const gx = meuGol - fx, gz = -fz, g = MD.hypot(gx, gz) || 1;
  const ux = gx / g, uz = gz / g;
  // perpendicular para o meio do campo
  let nx = -uz, nz = ux;
  const sz = fz > 0 ? -1 : 1;
  if (nz * sz < 0) { nx = -nx; nz = -nz; }
  const d = IA_DEFESA.cobertura, l = IA_DEFESA.coberturaLado;
  alvoCalmo(m, j, fx + ux * d + nx * l, fz + uz * d + nz * l, _t, m.ataca[j.time]);
  return deCostasSemTremer(m, j, irPara(m, j, _t.x, _t.z, _t.mag, _t.correr, extra, _t.modo));
}

// ------------------------------------------------------------------- com a bola (sem a Parte 3)

/**
 * Apoio sem a Parte 3 (apoioTatico devolveu null): a referência tática com a bola (posicaoTatica
 * 'com', misturada com a 'sem' logo depois da retomada).
 */
function referenciaComBola(m, j, f) {
  const s = estadoIA(m, j);
  const B = blocoDoTime(m, j.time);
  const extra = extraAcao(m, j);
  s.ramo = 'apoio';
  const k = j.vagaIdx;
  pontoRef(B, k, _t);
  alvoCalmo(m, j, _t.x, _t.z, _t);
  return deCostasSemTremer(m, j, irPara(m, j, _t.x, _t.z, _t.mag, _t.correr, extra, _t.modo));
}
