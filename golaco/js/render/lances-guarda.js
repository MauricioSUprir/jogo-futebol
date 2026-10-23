// GUARDADOR DE LANCES (cenas das paradas, PR 3; PLANO-CENAS.md §4.2, R9, R20; contrato "Cenas das paradas" §7.3). Puro
// (sem three.js nem DOM): roda nos testes em Node (tools/teste-lances-guarda.mjs) e chega na página sob demanda (main.js
// SOB.cenas). FORA do fecho do hash: só LÊ o anel do replay (render/replay-anel.js) — o mundo e o hash não mudam.
//
// O anel guarda só os últimos 10 s; o intervalo ("lances do 1º tempo") e o fim ("Melhores momentos") precisam dos lances
// da partida inteira. Cada lance que vale (o gol, no posGol(); a parada de classe A/B de js/lances.js, no passo antes da
// montagem — os dois com ou sem replay) é COPIADO do anel, comprimido, para uma de LANCES_GUARDA.lances vagas fixas:
//  - janela [chave − antes, fim + depois] s (o gol: o chute até 0,5 s depois do gol; a falta: o contato; a chance: o chute
//    até o desfecho), cortada a LANCES_GUARDA.segundos pelo começo, sem atravessar corte (começa no último antes da chave
//    — no gol, antes do gol: o corte entre o chute e o gol dos testes —, acaba antes do primeiro depois dela), nunca
//    depois de ateMax (o expulso sai do mundo no passo da bola morta);
//  - os jogadores a 30 Hz (um passo em cada 2 do anel); por vaga: id (Int16), info (Uint8: time, goleiro, treinador),
//    x/z/rumo (Float32) e a pose em Int16 RELATIVA ao x/z do jogador (y absoluto) com a escala 1/4000 m (±8,19 m; erro ≤
//    0,13 mm; fora da faixa satura e conta em G.saturou);
//  - a bola (p + q, Float32), o relógio do estádio (Float64), o corte e as marcas (bit0 chute, bit1 gol) de TODO passo
//    (60 Hz: ~13 KB por lance — a bola a 30 Hz errava até 65 cm no passo do chute e da batida, e é o que o replay segue);
//  - as batidas da bola na rede dentro da janela (até REDE.maxImpactos; a página passa as recentes — o `ondas` só guarda as
//    que ainda balançam, e a rede de um gol do 1º tempo tem de balançar de novo no intervalo).
// Cheio: sai o de menor peso (o gol pesa mais que qualquer parada: nunca sai por chance); o mais antigo desempata; o novo
// de menor peso que todos fica de fora. Até 1 lance por parada (a chave da parada: a bola morta, ou o tick do gol).
//
// tocar(G, k, mini) descomprime o lance k num MINI-ANEL (criarMini: o mesmo formato do anel — criarAnel com as vagas/nj
// dele —, LANCES_GUARDA.mini passos), a 60 Hz: os jogadores dos passos do meio interpolados (pose e x/z lineares, rumo
// pelo menor ângulo; o jogador casado pelo id, como o lerQuadro), nunca através de corte; a bola e o relógio exatos.
// A perda dos 30 Hz (teste-lances-guarda G3): o próprio desenho tem movimento de 1 passo (o pé que planta, o chute) — o
// ponto do meio fica a ~1,7 mm da média dos vizinhos na mediana e a ~16 mm no p95 por junta. O diretor do replay
// toca o mini-anel com os leitores de sempre (render/replay.js iniciar(ro, fonte); main.js desenharReplay pela fonte); a
// rede do lance vai no `mini.ondas` (o formato de rede-onda.js criarOndas).
//
// Memória fixa: ~3,5 MB do guardador + ~2,2 MB do mini-anel, alocados pela página só na PARTIDA (main.js garantirGuarda: quando
// o módulo chega ou a partida começa com ele já baixado — nunca nos treinos, onde a pré-carga também roda). Nada é alocado
// em guardar nem em tocar (G1).
import { criarAnel } from './replay-anel.js';
import { REDE, criarOndas } from './rede-onda.js';
import { LANCES_GUARDA } from '../cenas-config.js';

/** Peso do gol (os da parada vêm de js/lances.js, de 1 a 7: o gol nunca sai por uma parada). */
export const PESO_GOL = 100;
const NB = REDE.maxImpactos;              // batidas da rede por lance
const CB = 9;                             // por batida: t0, x, y, z, plano, amp, dx, dy, dz
const QMAX = 32767, QLIM = QMAX + 0.5;
const satura = q => (q >= QLIM ? QMAX : q <= -QLIM ? -QMAX : Math.floor(q + 0.5));

const lerpAng = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

function novaMeta(k) {
  return {
    ocupado: false, k, seq: 0, tipo: null, classe: null, peso: 0, chave: -1, fim: -1, parada: -1, de: -1, ate: -1, nQ: 0,
    lado: 1, time: 0, x: 0, z: 0, tempo: 1, tick: -1, ids: new Int16Array(4), nIds: 0, nBat: 0,
  };
}

/**
 * O guardador (memória fixa). cfg = LANCES_GUARDA (lances, segundos, hz, escala, mini, antes, depois); o formato do anel que
 * ele copia: vagas (REPLAY.vagas) e nj (anim.js NJ).
 */
export function criarGuarda(cfg = LANCES_GUARDA, { vagas = 26, nj = 19 } = {}) {
  const L = cfg.lances, pq = Math.max(1, Math.round(60 / cfg.hz)), F = Math.max(2, Math.round(cfg.segundos * cfg.hz));
  const V = vagas, P = nj * 3, T = (F - 1) * pq + 1;
  const G = {
    cfg, L, F, V, P, nj, pq, T,
    /** O maior trecho (passos do anel) que cabe num lance: (F − 1) quadros de pq passos (T = span + 1 passos). */
    span: T - 1,
    esc: cfg.escala, inv: 1 / cfg.escala,
    pose: new Int16Array(L * F * V * P),
    xzr: new Float32Array(L * F * V * 3),
    ids: new Int16Array(L * F * V),
    info: new Uint8Array(L * F * V),
    nVagas: new Uint8Array(L * F),
    // por PASSO (T por lance)
    bola: new Float32Array(L * T * 7),
    tEst: new Float64Array(L * T),
    corte: new Uint8Array(L * T),
    marcas: new Uint8Array(L * T),
    bat: new Float64Array(L * NB * CB),
    metas: Array.from({ length: L }, (_, k) => novaMeta(k)),
    seq: 0,
    /** Juntas que saturaram a escala (fora de ±8,19 m do x/z do jogador) desde a criação. */
    saturou: 0,
    // rascunho do tocar (nada alocado por chamada)
    _bp: { x: 0, y: 0, z: 0 }, _bq: { x: 0, y: 0, z: 0, w: 1 },
    _jan: { de: -1, ate: -1 },
  };
  Object.defineProperty(G, 'bytes', {
    get() {
      return G.pose.byteLength + G.xzr.byteLength + G.ids.byteLength + G.info.byteLength + G.nVagas.byteLength + G.bola.byteLength
        + G.tEst.byteLength + G.corte.byteLength + G.marcas.byteLength + G.bat.byteLength;
    },
  });
  return G;
}

/** O mini-anel de tocar um lance (o formato do anel, LANCES_GUARDA.mini passos) com a rede dele em `.ondas`. */
export function criarMini(G) {
  const ticks = Math.max(G.cfg.mini ?? 360, G.span + 1);
  const a = criarAnel({ ticks, vagas: G.V, nj: G.nj });
  a.ondas = criarOndas();
  return a;
}

/** Esquece todos os lances (mundo novo). */
export function limparGuarda(G) {
  for (const mt of G.metas) mt.ocupado = false;
  G.seq = 0;
}

const s60 = s => Math.round(s * 60);

/**
 * A janela do lance no anel agora, em out {de, ate} (ticks; ate − de múltiplo de G.pq), ou null (nada que valha: menos
 * de 0,5 s ou a chave fora do anel). lance = {tipo, chave, fim, ateMax?}. opc.inteira: null também se o começo ideal
 * (chave − antes) já saiu do anel sem um corte depois dele (o lance guardado tarde: o módulo chegou depois).
 */
export function janelaDoLance(G, anel, lance, out = G._jan, opc = {}) {
  const C = G.cfg;
  if (!lance || anel.ultimo < 0) return null;
  const gol = lance.tipo === 'gol';
  const fim = Math.max(lance.chave, lance.fim ?? lance.chave);
  const chave = Math.max(anel.primeiro, Math.min(lance.chave, anel.ultimo));
  if (anel.slot(lance.chave) < 0 && !(gol && anel.slot(fim) >= 0)) return null;
  // até onde: fim + depois, o fim do anel e o ateMax
  let ate = Math.min(anel.ultimo, fim + s60(C.depois ?? 0.5), lance.ateMax ?? Infinity);
  // começo: chave − antes, ou o último corte até a chave (no gol, até o gol); o corte depois dele acaba a janela antes
  const ideal = lance.chave - s60(C.antes ?? 2.5);
  let de = Math.max(anel.primeiro, ideal);
  const ref = gol ? Math.min(fim, anel.ultimo) : chave;
  const c = anel.ultimoCorte(de, ref);
  if (c != null) de = c;
  else if (opc.inteira && ideal < anel.primeiro) return null;
  if (ate > de) { const cD = anel.primeiroCorte(de + 1, ate); if (cD != null) ate = cD - 1; }
  // cortada a `segundos` pelo começo; o trecho em quadros inteiros (o começo anda até o próximo)
  if (ate - de > G.span) de = ate - G.span;
  const r = (ate - de) % G.pq;
  if (r) de += G.pq - r;
  if (ate - de < 30) return null;
  out.de = de; out.ate = ate;
  return out;
}

/** A vaga para um lance novo de peso `peso` e chave da parada `parada`: k, ou −1 (fica de fora). */
function escolherVaga(G, peso, parada) {
  // a mesma parada já guardada: troca só por um mais forte
  for (const mt of G.metas) if (mt.ocupado && mt.parada === parada) return peso > mt.peso ? mt.k : -1;
  for (const mt of G.metas) if (!mt.ocupado) return mt.k;
  // cheio: sai o de menor peso (o mais antigo desempata); o novo de menor peso que todos fica de fora
  let alvo = null;
  for (const mt of G.metas) if (!alvo || mt.peso < alvo.peso || (mt.peso === alvo.peso && mt.seq < alvo.seq)) alvo = mt;
  return peso >= alvo.peso ? alvo.k : -1;
}

/**
 * Guarda o lance (cópia do anel; nada escrito nele). lance = {tipo ('gol' | lances.js TIPOS_LANCE), classe ('A' | 'B' |
 * 'gol'), peso? (padrão: PESO_GOL no gol; o da parada vem de lances.js), chave, fim, ateMax?, morta? (a chave da parada;
 * no gol, o tick dele), lado, time, ids?, x?, z?, tempo?}. batidas: as batidas recentes da rede (itens no formato de
 * rede-onda.js: {ativo, t0, x, y, z, plano, amp, dx, dy, dz}) — entram as da janela. opc.inteira: ver janelaDoLance.
 * Devolve a vaga k ou −1 (nada guardado).
 */
export function guardar(G, anel, lance, batidas = null, opc = {}) {
  const jan = janelaDoLance(G, anel, lance, G._jan, opc);
  if (!jan) return -1;
  const peso = lance.peso ?? (lance.tipo === 'gol' ? PESO_GOL : 0);
  const parada = lance.morta ?? lance.fim ?? lance.chave;
  const k = escolherVaga(G, peso, parada);
  if (k < 0) return -1;
  const { de, ate } = jan;
  const { F, V, P, nj, pq, inv } = G;
  const nQ = (ate - de) / pq + 1;
  const AK = anel.K, AP = anel.P, AV = anel.vagas, D = anel.dados, PO = G.pose;
  let sat = 0;
  for (let f = 0; f < nQ; f++) {
    const t = de + f * pq, s = anel.slot(t), g = k * F + f;
    const nv = Math.min(anel.nVagas[s], V);
    G.nVagas[g] = nv;
    for (let v = 0; v < nv; v++) {
      const i = s * AV + v, gv = g * V + v, id = anel.ids[i];
      G.ids[gv] = id; G.info[gv] = anel.info[i];
      if (id < 0) continue;
      const o = i * AK, x = D[o + AP], z = D[o + AP + 1];
      G.xzr[gv * 3] = x; G.xzr[gv * 3 + 1] = z; G.xzr[gv * 3 + 2] = D[o + AP + 2];
      // x e z relativos ao jogador, y absoluto, arredondados para o mais perto; fora da faixa satura (e conta)
      for (let a = o, b = gv * P, e = o + nj * 3; a < e; a += 3, b += 3) {
        const qx = (D[a] - x) * inv, qy = D[a + 1] * inv, qz = (D[a + 2] - z) * inv;
        if (qx < QLIM && qx > -QLIM && qy < QLIM && qy > -QLIM && qz < QLIM && qz > -QLIM) {
          // (floor(q + 0,5): o mais perto, sem desvio por sinal — 2× mais rápido que o Math.round ou o ± 0,5 aqui)
          PO[b] = Math.floor(qx + 0.5); PO[b + 1] = Math.floor(qy + 0.5); PO[b + 2] = Math.floor(qz + 0.5);
        } else {
          sat++;
          PO[b] = satura(qx); PO[b + 1] = satura(qy); PO[b + 2] = satura(qz);
        }
      }
    }
  }
  G.saturou += sat;
  // a bola, o relógio, o corte e as marcas de todo passo
  for (let j = 0, gt = k * G.T; j <= ate - de; j++, gt++) {
    const s = anel.slot(de + j);
    for (let b = 0; b < 7; b++) G.bola[gt * 7 + b] = anel.bola[s * 7 + b];
    G.tEst[gt] = anel.tEst[s]; G.corte[gt] = anel.corte[s]; G.marcas[gt] = anel.marcas[s];
  }
  // as batidas da rede da janela (as que balançam em algum passo dela), as mais novas primeiro
  const mt = G.metas[k];
  mt.nBat = 0;
  if (batidas) {
    const t0 = anel.tEst[anel.slot(de)] - REDE.duracao, t1 = anel.tEst[anel.slot(ate)];
    const ob = k * NB * CB;
    for (const b of batidas) {
      if (!b || b.ativo === false || !(b.t0 >= t0 && b.t0 <= t1)) continue;
      // cheio: troca a mais velha se esta for mais nova
      let j = mt.nBat;
      if (j >= NB) {
        j = 0;
        for (let u = 1; u < NB; u++) if (G.bat[ob + u * CB] < G.bat[ob + j * CB]) j = u;
        if (G.bat[ob + j * CB] >= b.t0) continue;
      } else mt.nBat++;
      const o = ob + j * CB;
      G.bat[o] = b.t0; G.bat[o + 1] = b.x; G.bat[o + 2] = b.y; G.bat[o + 3] = b.z; G.bat[o + 4] = b.plano;
      G.bat[o + 5] = b.amp; G.bat[o + 6] = b.dx; G.bat[o + 7] = b.dy; G.bat[o + 8] = b.dz;
    }
  }
  mt.ocupado = true; mt.seq = ++G.seq; mt.tipo = lance.tipo; mt.classe = lance.classe ?? (lance.tipo === 'gol' ? 'gol' : null);
  mt.peso = peso; mt.chave = lance.chave; mt.fim = Math.max(lance.chave, lance.fim ?? lance.chave); mt.parada = parada;
  mt.de = de; mt.ate = ate; mt.nQ = nQ; mt.lado = lance.lado >= 0 ? 1 : -1; mt.time = lance.time ?? 0;
  mt.x = lance.x ?? 0; mt.z = lance.z ?? 0; mt.tempo = lance.tempo ?? 1; mt.tick = anel.ultimo;
  mt.nIds = 0;
  if (lance.ids) for (const id of lance.ids) { if (mt.nIds >= mt.ids.length) break; mt.ids[mt.nIds++] = id; }
  return k;
}

/**
 * Os lances para tocar numa cena (o intervalo: os lances do 1º tempo; o fim: os "Melhores momentos"; PLANO-CENAS.md §4.1 e
 * §5.1): o = {tempo (1 | 2 | null = todos), max, maxSegundos (padrão: sem teto), cronologica (false)}. Primeiro os gols (na
 * ordem em que aconteceram), depois as paradas pelo peso (a mais forte; empate: a mais nova), até `max` lances e
 * `maxSegundos` somados (a duração de cada um: o trecho guardado, de − ate). Escreve os k em `out` — na ordem de escolha, ou
 * na do jogo com `cronologica` — e devolve `out`.
 */
export function escolherLances(G, o = {}, out = []) {
  out.length = 0;
  const max = o.max ?? G.L, teto = o.maxSegundos ?? Infinity, tempo = o.tempo ?? null;
  let soma = 0;
  const cabe = mt => mt.ocupado && (tempo == null || mt.tempo === tempo) && !out.includes(mt.k) && soma + (mt.ate - mt.de) / 60 <= teto + 1e-9;
  // os gols, na ordem do jogo
  for (;;) {
    if (out.length >= max) break;
    let melhor = null;
    for (const mt of G.metas) if (mt.tipo === 'gol' && cabe(mt) && (!melhor || mt.chave < melhor.chave)) melhor = mt;
    if (!melhor) break;
    out.push(melhor.k); soma += (melhor.ate - melhor.de) / 60;
  }
  // as paradas, a mais forte primeiro (empate: a mais nova)
  for (;;) {
    if (out.length >= max) break;
    let melhor = null;
    for (const mt of G.metas) if (mt.tipo !== 'gol' && cabe(mt) && (!melhor || mt.peso > melhor.peso || (mt.peso === melhor.peso && mt.seq > melhor.seq))) melhor = mt;
    if (!melhor) break;
    out.push(melhor.k); soma += (melhor.ate - melhor.de) / 60;
  }
  if (o.cronologica) out.sort((a, b) => G.metas[a].chave - G.metas[b].chave);
  return out;
}

/** A meta do lance k (o objeto da vaga: não guarde) ou null. */
export function lanceGuardado(G, k) {
  const mt = G.metas[k];
  return mt && mt.ocupado ? mt : null;
}

/**
 * Os lances guardados, na ordem em que entraram (cópias: para a cena e os testes, não por passo): {k, tipo, classe, peso,
 * chave, fim, de, ate, lado, time, ids, x, z, tempo, quadros, batidas, segundos}.
 */
export function listar(G, out = []) {
  out.length = 0;
  for (const mt of G.metas) if (mt.ocupado) {
    out.push({
      k: mt.k, seq: mt.seq, tipo: mt.tipo, classe: mt.classe, peso: mt.peso, chave: mt.chave, fim: mt.fim, de: mt.de, ate: mt.ate,
      lado: mt.lado, time: mt.time, ids: Array.from(mt.ids.subarray(0, mt.nIds)), x: mt.x, z: mt.z, tempo: mt.tempo,
      quadros: mt.nQ, batidas: mt.nBat, segundos: (mt.ate - mt.de) / 60,
    });
  }
  out.sort((a, b) => a.seq - b.seq);
  return out;
}

// tocar escreve DIRETO nas memórias do mini-anel (o formato do anel: replay-anel.js criarAnel — dados por vaga = a pose NJ×3
// no mundo + x, z, rumo; ids, info, nVagas), depois do inicio(t) dele; marcar e fim pela API dele
/** A bola, as marcas e o fim do passo t do lance (gt = o índice do passo no guardador). */
function fimPasso(G, gt, mini) {
  if (G.marcas[gt]) mini.marcar(G.marcas[gt]);
  const B = G.bola, o = gt * 7;
  G._bp.x = B[o]; G._bp.y = B[o + 1]; G._bp.z = B[o + 2];
  G._bq.x = B[o + 3]; G._bq.y = B[o + 4]; G._bq.z = B[o + 5]; G._bq.w = B[o + 6];
  mini.fim(G._bp, G._bq);
}

/** Escreve no mini-anel o quadro f do lance (no tick t; gt = o índice do passo) — exato. */
function quadroExato(G, k, f, t, gt, mini) {
  const { F, V, P, nj, esc } = G, g = k * F + f, PO = G.pose, X = G.xzr;
  mini.inicio(t, G.tEst[gt], G.corte[gt] !== 0);
  const s = mini.slot(t), MD = mini.dados, MK = mini.K, MV = mini.vagas;
  const nv = Math.min(G.nVagas[g], MV);
  for (let v = 0; v < nv; v++) {
    const gv = g * V + v, id = G.ids[gv], i = s * MV + v;
    mini.ids[i] = id;
    if (id < 0) continue;
    mini.info[i] = G.info[gv];
    const x = X[gv * 3], z = X[gv * 3 + 1], o = i * MK;
    for (let a = gv * P, b = o, e = o + nj * 3; b < e; a += 3, b += 3) {
      MD[b] = x + PO[a] * esc; MD[b + 1] = PO[a + 1] * esc; MD[b + 2] = z + PO[a + 2] * esc;
    }
    MD[o + P] = x; MD[o + P + 1] = z; MD[o + P + 2] = X[gv * 3 + 2];
  }
  mini.nVagas[s] = nv;
  fimPasso(G, gt, mini);
}

/**
 * Escreve no mini-anel o passo t entre os quadros f e f + 1 (a = 0..1; gt = o índice do passo): os jogadores interpolados
 * (o jogador casado pelo id), a bola e o relógio do próprio passo.
 */
function quadroMeio(G, k, f, t, gt, a, mini) {
  const { F, V, P, nj, esc } = G, g0 = k * F + f, g1 = g0 + 1, PO = G.pose, X = G.xzr;
  mini.inicio(t, G.tEst[gt], G.corte[gt] !== 0);
  const s = mini.slot(t), MD = mini.dados, MK = mini.K, MV = mini.vagas;
  const nv0 = Math.min(G.nVagas[g0], MV), nv1 = G.nVagas[g1];
  // a pose do meio no mundo: (x0 + q0·e)(1 − a) + (x1 + q1·e)a = x0 + (x1 − x0)a + e·(q0 + (q1 − q0)a)
  const ea = esc * a, eb = esc * (1 - a);
  for (let v = 0; v < nv0; v++) {
    const i0 = g0 * V + v, id = G.ids[i0], i = s * MV + v;
    mini.ids[i] = id;
    if (id < 0) continue;
    let i1 = g1 * V + v;
    if (v >= nv1 || G.ids[i1] !== id) { i1 = -1; for (let w = 0; w < nv1; w++) if (G.ids[g1 * V + w] === id) { i1 = g1 * V + w; break; } }
    if (i1 < 0) i1 = i0;   // saiu no quadro seguinte (o expulso): fica onde estava
    mini.info[i] = G.info[i0];
    const x0 = X[i0 * 3], z0 = X[i0 * 3 + 1], xm = x0 + (X[i1 * 3] - x0) * a, zm = z0 + (X[i1 * 3 + 1] - z0) * a;
    const o = i * MK;
    for (let p0 = i0 * P, p1 = i1 * P, b = o, e = o + nj * 3; b < e; p0 += 3, p1 += 3, b += 3) {
      MD[b] = xm + PO[p0] * eb + PO[p1] * ea; MD[b + 1] = PO[p0 + 1] * eb + PO[p1 + 1] * ea; MD[b + 2] = zm + PO[p0 + 2] * eb + PO[p1 + 2] * ea;
    }
    MD[o + P] = xm; MD[o + P + 1] = zm; MD[o + P + 2] = lerpAng(X[i0 * 3 + 2], X[i1 * 3 + 2], a);
  }
  mini.nVagas[s] = nv0;
  fimPasso(G, gt, mini);
}

/**
 * Toca o lance k: descomprime no mini-anel (criarMini) a 60 Hz, nos MESMOS ticks do anel de quando foi guardado (o roteiro
 * do lance lê de mini.primeiro a mini.ultimo), e a rede do lance em mini.ondas. Devolve a meta (lanceGuardado) ou null.
 */
export function tocar(G, k, mini) {
  const mt = lanceGuardado(G, k);
  if (!mt) return null;
  mini.limpar();
  const { pq } = G, g0 = k * G.T;
  for (let f = 0; f < mt.nQ; f++) {
    const t = mt.de + f * pq, gt = g0 + f * pq;
    quadroExato(G, k, f, t, gt, mini);
    // os passos do meio (nunca através de um corte: com o quadro seguinte marcado como corte, eles repetem este)
    if (f + 1 < mt.nQ) {
      const corta = G.corte[gt + pq] !== 0;
      for (let d = 1; d < pq; d++) quadroMeio(G, k, f, t + d, gt + d, corta ? 0 : d / pq, mini);
    }
  }
  const ond = mini.ondas;
  if (ond) {
    const ob = k * NB * CB;
    for (let j = 0; j < ond.imp.length; j++) {
      const it = ond.imp[j];
      if (j >= mt.nBat) { it.ativo = false; continue; }
      const o = ob + j * CB;
      it.ativo = true; it.t0 = G.bat[o]; it.x = G.bat[o + 1]; it.y = G.bat[o + 2]; it.z = G.bat[o + 3]; it.plano = G.bat[o + 4];
      it.amp = G.bat[o + 5]; it.dx = G.bat[o + 6]; it.dy = G.bat[o + 7]; it.dz = G.bat[o + 8];
    }
  }
  return mt;
}
