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
//  - zona (os outros): a referência; um adversário a ≤ zona.raio m dela a puxa zona.peso para o lado
//    do gol dele (uma reivindicação por adversário: a marcação fica única);
//  - recomposição: > recomposicao m à frente da referência com a bola vindo para o meu gol → corre.
// Com a bola (Parte 3: ia-ataque.js): o condutor e os apoios; null = condutor da IA clássica e,
// para os apoios, a referência tática com a bola (posicaoTatica 'com').

import { BOTAO, CAMPO, PASSO, IA, IA_DEFESA, TATICA, ACOES } from './config.js';
import { MD } from './matdet.js';
import { entradaIA, vaiNaBolaLivre, para } from './ia.js';
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
  if (m.posse == null && m.naMao == null && vaiNaBolaLivre(m, j)) return entradaIA(m, j);
  const f = faseDoTime(m, j.time);
  if (m.posse === j.id) return condutorTatico(m, j) ?? entradaIA(m, j);
  if (f.fase === 'com') return apoioTatico(m, j) ?? referenciaComBola(m, j, f);
  return semBola(m, j, f);
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
      gatilhoAte: -1, gatilho: '', vooTick: -1, recebePara: -1, donoAnt: -1,
      contra: [], contraAte: -1,
      refTick: -99, ref: new Float64Array(22), zonaAdv: new Int32Array(11).fill(-1), marcaAdv: new Int32Array(11).fill(-1),
      foco: { x: 0, z: 0 }, cvx: 0, cvz: 0, cond: -1,
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

  // 1º e 2º homem: os mais perto do foco (sem o goleiro), com histerese de IA.trocaPressao m
  let a1 = null, d1 = Infinity, a2 = null, d2 = Infinity, at1 = null, dAt1 = Infinity, at2 = null, dAt2 = Infinity;
  for (const o of js) {
    if (o.time !== t || !ehLinha(o)) continue;
    const d = MD.hypot(o.x - B.foco.x, o.z - B.foco.z);
    if (d < d1) { a2 = a1; d2 = d1; a1 = o; d1 = d; } else if (d < d2) { a2 = o; d2 = d; }
    if (o.id === B.p1) { at1 = o; dAt1 = d; }
    if (o.id === B.p2) { at2 = o; dAt2 = d; }
  }
  let p1 = a1, p2 = a2;
  if (at1 && at1 !== a1 && dAt1 < d1 + IA.trocaPressao) { p1 = at1; p2 = a1; }
  if (p2 && at2 && at2 !== p1 && at2 !== p2 && dAt2 < MD.hypot(p2.x - B.foco.x, p2.z - B.foco.z) + IA.trocaPressao) p2 = at2;
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
    if (lugar && meus >= deles) {
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
    if (adv && adv.posicao !== 'GOL') {
      if (adv.id !== B.donoAnt && adv.id === B.recebePara) gatilho(m, B, 'recepcao');
      if (MD.hypot(b.x - adv.x, b.z - adv.z) > G.toquePesado) gatilho(m, B, 'toquePesado');
      const cr = MD.cos(adv.rumo), sr = MD.sin(adv.rumo);
      if (cr * ladoAdv < MD.cos(G.costas)) gatilho(m, B, 'costas');
      if (Math.abs(b.z) > G.lateral && sr * (b.z > 0 ? 1 : -1) > 0.5) gatilho(m, B, 'lateral');
    }
  }
  B.donoAnt = adv ? adv.id : -1;
  const comGatilho = p >= 1 && B.gatilhoAte >= m.tick;

  // 1º homem: aperta ou contém (o goleiro adversário com a bola na mão não é pressionado: Regra 12.3)
  const dGol = MD.hypot(B.foco.x - meuGol, B.foco.z);
  const engajado = dGol <= IA_DEFESA.engaja[p];
  B.engajado = engajado;
  B.aperta1 = !!adv && adv.posicao !== 'GOL' && (comGatilho || dGol <= IA_DEFESA.perigo || IA_DEFESA.apertaSempre[p]) && engajado;
  B.aperta2 = !!adv && adv.posicao !== 'GOL' && p >= 2 && comGatilho && engajado;

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
    B.refTick = m.tick;
    referencias(m, t, B, f, adv);
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

const _r = { x: 0, z: 0 }, _o = { x: 0, z: 0 }, _bola = { x: 0, z: 0 };
/**
 * Referência de cada vaga do time t (B.ref[2k], B.ref[2k + 1]) pela posicaoTatica, com a mistura
 * com/sem nos TATICA.mistura s depois da troca de fase, e as reivindicações da zona (sem a bola).
 */
function referencias(m, t, B, f, adv) {
  const T = m.times[t], form = FORMACOES[T.formacao], lado = m.ataca[t];
  const v = m.voo;
  // bola de referência: com um passe no ar, o ponto de chegada (o bloco antecipa); com a bola nas
  // mãos de um goleiro, a referência é a saída de jogo (IA.saidaGoleiro m do gol dele)
  if (v && v.time != null && passeNoAr(v) && m.posse == null && m.naMao == null) { _bola.x = v.alvo.x; _bola.z = v.alvo.z; }
  else { _bola.x = m.bola.p.x; _bola.z = m.bola.p.z; }
  const lim = CAMPO.meioX - IA.saidaGoleiro;
  if (m.naMao != null || (adv && adv.posicao === 'GOL') || (m.posse != null && !adv && donoEhGoleiro(m))) _bola.x = Math.max(-lim, Math.min(lim, _bola.x));
  const outra = f.fase === 'com' ? 'sem' : 'com';
  for (const vg of form.vagas) {
    const k = form.indice[vg.id];
    posicaoTatica(T.formacao, vg, T.tatica, _bola, f.fase, lado, _r);
    if (f.mistura < 1) {
      posicaoTatica(T.formacao, vg, T.tatica, _bola, outra, lado, _o);
      _r.x = _o.x + (_r.x - _o.x) * f.mistura;
      _r.z = _o.z + (_r.z - _o.z) * f.mistura;
    }
    B.ref[2 * k] = _r.x; B.ref[2 * k + 1] = _r.z;
  }
  // zona: cada adversário perto de uma referência (≤ zona.raio m) é reivindicado por no máximo um
  // jogador do meio/ataque, o par mais perto primeiro (o par de antes leva 1,5 m de vantagem)
  const ant = B.zonaAdv, novo = _novo;
  novo.fill(-1);
  if (f.fase === 'sem') {
    const R = IA_DEFESA.zona.raio;
    for (let it = 0; it < 11; it++) {
      let mk = -1, mo = null, dm = Infinity;
      for (const vg of form.vagas) {
        if (vg.grupo === 'gol' || vg.grupo === 'def') continue;
        const k = form.indice[vg.id];
        if (novo[k] >= 0) continue;
        const rx = B.ref[2 * k], rz = B.ref[2 * k + 1];
        for (const o of m.jogadores) {
          if (o.time === t || !ehLinha(o) || (adv && o.id === adv.id)) continue;
          let livre = true;
          for (let q = 0; q < 11; q++) if (novo[q] === o.id) { livre = false; break; }
          if (!livre) continue;
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

function donoEhGoleiro(m) {
  for (const o of m.jogadores) if (o.id === m.posse) return o.posicao === 'GOL';
  return false;
}

// ------------------------------------------------------------------------------- jogador sem bola

const _t = { x: 0, z: 0 };

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
  let tx = B.ref[2 * k], tz = B.ref[2 * k + 1];
  const vaga = FORMACOES[m.times[j.time].formacao].vagas[k];
  s.ramo = vaga.grupo === 'def' ? 'linha' : 'zona';
  const za = B.zonaAdv[k];
  if (za >= 0) {
    for (const o of m.jogadores) {
      if (o.id !== za) continue;
      const gx = meuGol - o.x, gz = -o.z, g = MD.hypot(gx, gz) || 1;
      const ax = o.x + (gx / g) * IA_DEFESA.marcaDist, az = o.z + (gz / g) * IA_DEFESA.marcaDist;
      tx += (ax - tx) * IA_DEFESA.zona.peso; tz += (az - tz) * IA_DEFESA.zona.peso;
      break;
    }
  }
  // recomposição: à frente da referência (o bloco recua) — vai direto (pressa), e corre de longe com a
  // bola vindo para o meu gol (defesa rápida); histerese para não piscar entre os modos
  const it = estadoT(j);
  const frente = (j.x - tx) * lado;
  const R = IA_DEFESA.recompoe;
  it.recua = it.recua ? frente > R.desliga : frente > R.liga;
  if (it.recua) {
    const vem = advComBola ? -(B.cvx * lado) : -(m.bola.v.x * lado);
    const corre = frente > IA_DEFESA.recomposicao && vem > IA_DEFESA.recompoeVel;
    s.ramo = corre ? 'recompoe' : s.ramo;
    const e = irPara(m, j, tx, tz, 1, corre, extra, 'pressa');
    return corre ? { ...e, botoes: extra | BOTAO.CORRER } : e;
  }
  return irPara(m, j, tx, tz, 1, true, extra, 'calma');
}

/** Estado da IA tática do jogador (criado uma vez e reaproveitado). */
function estadoT(j) {
  return j.iaT ??= { recua: false };
}

/** Ponto entre a bola e o meu gol a `dist` m, mirando à frente pela velocidade (filtrada) do condutor. */
function pontoPressao(m, B, meuGol, dist, out, antecipa = IA.antecipaPressao) {
  const fx = B.foco.x, fz = B.foco.z;
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
  pontoPressao(m, B, meuGol, IA_DEFESA.aperto, _t);
  if (lado2) {
    // o 2º fecha o lado de dentro (para o meio do campo), sem disputar o mesmo ponto com o 1º
    const gx = _t.x - B.foco.x, gz = _t.z - B.foco.z, g = MD.hypot(gx, gz) || 1;
    const sz = B.foco.z > 0 ? -1 : 1;
    let nx = -gz / g, nz = gx / g;
    if (nz * sz < 0) { nx = -nx; nz = -nz; }
    _t.x += nx * IA_DEFESA.apertoLado; _t.z += nz * IA_DEFESA.apertoLado;
  }
  const d = MD.hypot(_t.x - j.x, _t.z - j.z);
  return irPara(m, j, _t.x, _t.z, 1, d > IA.pressaoArranca, extra, 'pressa');
}

/** Contém: entre a bola e o meu gol a `c` m, de frente para o condutor (sem bote). */
function conter(m, j, s, B, meuGol, c, extra) {
  const b = m.bola.p;
  if (atacaBola(m, j, s)) { s.ramo = 'ataca'; return { ...irPara(m, j, b.x, b.z, 1, true, extra, 'pressa'), botoes: extra | BOTAO.CORRER }; }
  s.ramo = 'contem';
  pontoPressao(m, B, meuGol, c, _t, IA_DEFESA.antecipaContem);
  const d = MD.hypot(_t.x - j.x, _t.z - j.z);
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
  return irPara(m, j, fx + ux * d + nx * l, fz + uz * d + nz * l, 1, true, extra, 'calma');
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
  return irPara(m, j, B.ref[2 * k], B.ref[2 * k + 1], 1, true, extra, 'calma');
}
