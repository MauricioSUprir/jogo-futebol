// Torcida (dados): conta PURA (sem three.js nem DOM) de onde senta cada torcedor, com que roupa, pele e
// cabelo, e o atlas das figuras desenhado por código (8 poses). torcida.js monta o InstancedMesh com
// isto; tools/teste-torcida.mjs confere em Node.
//
// Arquibancadas (as mesmas de campo.js, constantes em ARQUIBANCADA): o lado de lá (z −, de frente para
// a câmera de TV), os dois fundos (atrás dos gols) e o LADO DE CÁ (z +, espelhado, com o túnel dos times no meio;
// pedido de 11/10). Cada cadeira da textura (ARQ: 36 fileiras, 0,5 m por cadeira, corredor a cada 26) pode ter
// um torcedor, pela ocupação da qualidade — CHEIA nas fileiras da frente (TORCIDA.ocupacaoFrente: as que a câmera
// de jogo mostra; diagnóstico de 11/10: na Média só 62% delas tinham gente e os buracos apareciam). Setores (dono:
// mandante maioria): o Golaço FC (time 0) em quase tudo, a ORGANIZADA dele no fundo +x (sempre em pé,
// pulando no ritmo), o setor VISITANTE (Ventania FC, time 1) no fundo −x, separado por cadeiras vazias,
// e o mosaico "GOLAÇO" das cadeiras do lado de lá vira um mosaico de camisas verdes.
//
// Atlas: cada pose numa célula de 64 × 128 px (1,1 × 2,2 m). Os canais NÃO são cor: R = peso da
// camisa, G = peso da pele, B = peso do cabelo/calça, A = cobertura; o que sobra (A − R − G − B) é o
// acento (cachecol, na cor do time). Os pesos já vêm multiplicados pela cobertura: os mipmaps (média)
// continuam certos e o shader troca as cores por torcedor sem textura nova.
import { ESTADIO } from '../config.js';
import { ARQ_GOLACO, gradeGolaco } from './cadeiras-dados.js';

// as medidas das arquibancadas do Estádio Golaço (a fonte é a grade das cadeiras: render/cadeiras-dados.js)
export const ARQUIBANCADA = ARQ_GOLACO;
let _grade = null;
const grade = () => _grade ?? (_grade = gradeGolaco());

export const TORCIDA = {
  ocupacao: { baixa: 0.38, media: 0.62, alta: 0.9 },
  // as fileiras da frente (as `frente` de baixo de cada arquibancada) cheias: é o que a câmera de jogo vê
  ocupacaoFrente: { baixa: 0.85, media: 0.97, alta: 0.98 }, frente: 9,
  // lado de cá (z +): fora do quadro da câmera de TV (aparece nos planos do outro lado, no pré-jogo e no replay)
  ocupacaoCa: { baixa: 0.3, media: 0.6, alta: 0.9 },
  caFaixa: 12,            // o lado de cá em 2 faixas (corte pela câmera): as 12 fileiras da frente e as de cima
  // túnel dos times no meio do lado de cá (config.js ESTADIO.tunel): sem cadeira em cima da boca dele (a largura mais
  // as paredes; o teto com a laje e 0,3 m de folga)
  tunel: { meiaLargura: ESTADIO.tunel.largura / 2 + 0.4, topo: ESTADIO.tunel.altura + ESTADIO.tunel.laje + 0.3 },
  animada: { baixa: false, media: true, alta: true },
  atlas: [64, 128],         // px de cada célula do atlas (um atlas só para as 3 qualidades: o mipmap faz a Baixa)
  largura: 1.1, altura: 2.2,  // m do quadro de cada torcedor (cabe os braços para cima)
  visitante: { x: -1, z: [-22, 18], vazio: 4 },   // fundo −x; 4 m de cadeiras vazias de cada lado
  // a lotação dos sem forma (item 69, PR 4): a capacidade de verdade ÷ (isto × as cadeiras do Golaço) — a Alta desenha ~90%
  // das cadeiras, então um estádio com 90% delas já fica cheio
  lotacaoCheia: 0.9,
  organizada: { x: 1, z: [-18, 18] },              // fundo +x
  quadros: 8,
};

// poses (índice da célula no atlas)
export const POSE = { SENTADO: 0, SENTADO_PALMAS: 1, EM_PE: 2, EM_PE_PALMAS: 3, BRACOS_V: 4, UM_BRACO: 5, CACHECOL: 6, MAOS_CABECA: 7 };

// cores (sRGB) — tudo fictício: o Golaço FC de preto e verde, o Ventania FC de branco e cinza
const CASA_CAMISA = [['#15191b', 50], ['#19e07a', 17], ['#10b862', 8], ['#f2f4f3', 6], ['#2b3238', 7], ['#20304a', 5], ['#7a1f24', 3], ['#c9a227', 2], ['#3a5e8c', 2]];
const FORA_CAMISA = [['#e9ecee', 58], ['#b9bfc4', 20], ['#f7f8f8', 10], ['#2b3238', 6], ['#20304a', 6]];
const PELE = [['#f1c7a5', 10], ['#e3b08a', 14], ['#c99069', 16], ['#a8714d', 16], ['#8d5636', 14], ['#6b3e25', 12], ['#4b2b1b', 8], ['#d9a27b', 10]];
const CABELO = [['#16110d', 36], ['#2b1d14', 22], ['#4a3222', 14], ['#7a5a3a', 6], ['#b8935a', 4], ['#8c8c88', 6], ['#26303a', 12]];
export const VERDE_MOSAICO = '#19e07a';

function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function sorteia(lista, r) {
  let tot = 0;
  for (const [, p] of lista) tot += p;
  let x = r * tot;
  for (const [c, p] of lista) { x -= p; if (x <= 0) return hex(c); }
  return hex(lista[lista.length - 1][0]);
}

/** Gerador com semente (mulberry32) — só para o desenho, nunca o gerador do mundo. */
export function geradorTorcida(semente) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A câmera está dentro do volume da arquibancada do lado de cá (em cima das cadeiras, abaixo do teto)? Aí nada
 * dela vai para a GPU — é onde a câmera de TV fica (12,3 m de altura a até 69 m do meio no celular): o teste da caixa
 * daria verdadeiro e os torcedores de lá cobririam a tela (torcida.js e campo.js usam a mesma conta).
 */
export function cameraNoLadoDeCa(p) {
  if (formaCa) return formaCa(p);
  const A = ARQUIBANCADA;
  return p.z > A.frenteZ - 1 && p.z < A.frenteZ + A.profLado + 4 && Math.abs(p.x) < A.meioComprimento + 2 && p.y < A.yTopoLado + 7;
}

// estádio com forma própria (estadio-planta.js, sob demanda: render/estadio-real.js ligarForma): a conta dele
let formaCa = null;
export function definirLadoDeCa(fn) { formaCa = fn || null; }

/** O túnel do lado de cá passa por baixo desta cadeira (a boca e o teto dele: sem ninguém sentado)? */
export function cadeiraNoTunel(x, y) {
  const T = TORCIDA.tunel;
  return Math.abs(x) < T.meiaLargura && y < T.topo;
}

/**
 * Cadeiras de cada arquibancada: lista de {setor: 0 lado de lá | 1 fundo +x | 2 fundo −x | 3 lado de cá, f
 * (fileira, 0 = a de cima), a (cadeira), x, y (o PISO do degrau), z (o centro do assento)} — as da grade (render/
 * cadeiras-dados.js gradeGolaco; item 69: o degrau virou geometria e o torcedor senta no assento dele). O lado de cá é
 * o de lá espelhado em z, sem as cadeiras da boca do túnel.
 */
export function cadeiras() {
  const lista = [];
  grade().iterar(c => lista.push({ setor: c.setor, f: c.f, a: c.a, x: c.x, y: c.y, z: c.z }));
  return lista;
}

// cores pré-convertidas (sem alocar por torcedor)
const PRE = l => { let tot = 0; for (const [, p] of l) tot += p; return { tot, cores: l.map(([c, p]) => [hex(c), p]) }; };
const P_CASA = PRE(CASA_CAMISA), P_FORA = PRE(FORA_CAMISA), P_PELE = PRE(PELE), P_CABELO = PRE(CABELO);
function sorteiaPre(P, r) {
  let x = r * P.tot;
  for (const [c, p] of P.cores) { x -= p; if (x <= 0) return c; }
  return P.cores[P.cores.length - 1][0];
}
const RGB_MOSAICO = hex(VERDE_MOSAICO);
export const NIVEIS = ['baixa', 'media', 'alta'];
/** Grupos de desenho (uma malha instanciada cada): os 3 setores de antes e o lado de cá em 2 faixas de fileiras. */
export const GRUPOS = [
  { setor: 0, nome: 'lado' }, { setor: 1, nome: 'fundo+x' }, { setor: 2, nome: 'fundo-x' },
  { setor: 3, nome: 'ca-frente' }, { setor: 3, nome: 'ca-cima' },
];

/**
 * Torcedores de TODAS as qualidades de uma vez (contraprova M4: trocar a qualidade no meio do jogo — a
 * Automática faz isso sozinha no aparelho que está sofrendo — montava a torcida de novo e travava o quadro
 * 300 ms). O sorteio é o mesmo por cadeira e a ocupação cresce com a qualidade, então Baixa ⊂ Média ⊂ Alta:
 * cada torcedor guarda o NÍVEL em que entra (0 já na Baixa, 1 a partir da Média, 2 só na Alta) e a troca de
 * qualidade é só quantos desenhar (instanceCount). Ordem: por GRUPO de desenho (GRUPOS: lado de lá, fundo +x,
 * fundo −x, lado de cá frente, lado de cá cima), no grupo por nível e, no nível, da fileira da FRENTE para a de cima
 * — desenhados da frente para trás, os de trás que ficam escondidos são descartados pelo teste de profundidade antes
 * do fragment shader (menos trabalho por pixel; contraprova M3). Tudo em vetores tipados, sem objetos por torcedor.
 * As fileiras da frente (TORCIDA.frente) ficam cheias (ocupacaoFrente); o lado de cá sorteia com o seu próprio
 * gerador (o resto da torcida não muda por causa dele).
 * mascara: Uint8Array(nA × fileiras) com 1 nas cadeiras do mosaico "GOLAÇO" do lado de lá (ou null).
 * Devolve {n, pos: Float32Array(4n) [x, y, z, escala], camisa, pele, cabelo, info: Uint8Array(4n), nivel:
 * Uint8Array(n), faixas: [{inicio, porNivel: [n0, n1, n2], setor, nome}] por GRUPO, publico} — info = [time·255, setor·85,
 * organizada·255, semente2]; pele[3] = semente.
 * paletas (só com ?tm; identidade.js torcida + publico): {casa, fora: [[hex, peso]…], mosaico: hex, foraLados (fração de
 * visitantes espalhados pelos lados), publico (0,1–1: a ocupação)} — as MESMAS cadeiras e os mesmos sorteios; só a cor
 * das camisas, quem é visitante pelos lados e quantos vieram mudam. Sem elas, a torcida de hoje.
 * lugares (estádio com forma própria: estadio-planta.js): {n, fileiras, iterar(cadeira)} no lugar das 4 arquibancadas.
 */
export function gerarTorcidaNiveis(mascara = null, paletas = null, lugares = null) {
  const T = TORCIDA, A = ARQUIBANCADA;
  const pCasa = paletas && paletas.casa ? PRE(paletas.casa) : P_CASA, pFora = paletas && paletas.fora ? PRE(paletas.fora) : P_FORA;
  const rgbMosaico = paletas && paletas.mosaico ? hex(paletas.mosaico) : RGB_MOSAICO;
  const foraLados = paletas && Number.isFinite(paletas.foraLados) ? paletas.foraLados : 0.03;
  const publico = paletas && Number.isFinite(paletas.publico) ? Math.max(0.1, Math.min(1, paletas.publico)) : 1;
  // a LOTAÇÃO (item 69, PR 4): um estádio sem forma própria (a geometria do Golaço, ~29,4 mil cadeiras) com menos lugares
  // de verdade (a capacidade da base, paletas.capacidade) desenha a gente dele, não a do Golaço — fora das fileiras da
  // frente do lado de lá (as da TV, cheias como antes)
  const lotacao = !lugares && paletas && Number.isFinite(paletas.capacidade) && paletas.capacidade > 0 ? Math.min(1, paletas.capacidade / (TORCIDA.lotacaoCheia * grade().capacidade)) : 1;
  const ocs = NIVEIS.map(q => T.ocupacao[q]);
  const ocF = NIVEIS.map(q => T.ocupacaoFrente[q]);
  const ocCa = NIVEIS.map(q => T.ocupacaoCa[q]);
  const rnd = geradorTorcida(20261010);
  const rndCa = geradorTorcida(20261011);
  const nA = Math.round(A.comprimento / A.assento);
  const NF = lugares ? lugares.fileiras : A.fileiras;
  const cap = lugares ? lugares.n : A.fileiras * nA * 4;
  const tPos = new Float32Array(4 * cap), tCam = new Uint8Array(4 * cap), tPel = new Uint8Array(4 * cap), tCab = new Uint8Array(4 * cap), tInf = new Uint8Array(4 * cap);
  const tNiv = new Uint8Array(cap), tF = new Uint8Array(cap), tG = new Uint8Array(cap);
  let n = 0;
  const [vz0, vz1] = T.visitante.z;
  const pq = [0, 0, 0];
  // uma cadeira: os MESMOS 7 sorteios por cadeira e na mesma ordem de cadeiras() (o resultado não muda)
  // forma própria: a torcida dividida do clássico (metade de cada uma, a do mandante em +x) e a sombra da cobertura (luz)
  const dividida = !!(lugares && lugares.dividida);
  function cadeira(setor, f, a, x, y, z, esc = 1, im = a + f * nA, luz = 1, fantasma = false) {
    const g = setor === 3 ? rndCa : rnd;
    const r = g(), r2 = g(), r3 = g(), r4 = g(), r5 = g(), r6 = g(), r7 = g();
    // a cadeira que o PR 4 tirou da grade (a escada ao lado do túnel, o poste do refletor): só os sorteios dela
    if (fantasma) return;
    let time = 0, org = 0, mosaico = false;
    const frente = NF - 1 - f < T.frente;
    const lado = setor === 0 || setor === 3;
    const topo = 1 - 0.18 * (1 - (f + 0.5) / NF) * (lado ? 1 : 0);
    for (let q = 0; q < 3; q++) pq[q] = (setor === 3 ? ocCa[q] : ocs[q]) * (lado ? 1 : 0.95) * topo;
    // as fileiras da frente cheias (a câmera de jogo mostra estas)
    if (frente) for (let q = 0; q < 3; q++) pq[q] = Math.max(pq[q], ocF[q]);
    if (setor === 0 && mascara && im >= 0 && mascara[im]) { mosaico = true; pq[0] = 0.8; pq[1] = 1; pq[2] = 1; }
    if (setor === 2 && !dividida) {
      if (z >= vz0 && z <= vz1) { time = 1; for (let q = 0; q < 3; q++) pq[q] = Math.max(pq[q], Math.min(1, ocs[q] * 1.05)); }
      else if (z >= vz0 - T.visitante.vazio && z <= vz1 + T.visitante.vazio) { pq[0] = 0; pq[1] = 0; pq[2] = 0; }
    }
    if (setor === 1 && z >= T.organizada.z[0] && z <= T.organizada.z[1]) { org = 1; for (let q = 0; q < 3; q++) pq[q] = Math.max(pq[q], Math.min(1, ocs[q] * 1.15 + 0.08)); }
    // alguns visitantes espalhados pelos lados
    if (lado && !mosaico && r7 < foraLados) time = 1;
    if (dividida) time = (x < 0) !== (r7 < 0.02) ? 1 : 0;
    // público do Total Match (só desenho): menos gente nas mesmas cadeiras; a lotação do estádio fora da frente
    if (publico < 1) for (let q = 0; q < 3; q++) pq[q] *= publico;
    if (lotacao < 1 && !(frente && setor === 0)) for (let q = 0; q < 3; q++) pq[q] *= lotacao;
    let nivel = 3;
    for (let q = 2; q >= 0; q--) if (r < pq[q]) nivel = q;
    if (nivel > 2) return;
    const camisa = mosaico ? rgbMosaico : sorteiaPre(time === 1 ? pFora : pCasa, r2);
    const pele = sorteiaPre(P_PELE, r3);
    const cabelo = r5 < 0.08 ? pele : sorteiaPre(P_CABELO, r4);
    const k = 4 * n;
    tPos[k] = x + (r6 - 0.5) * 0.12; tPos[k + 1] = y; tPos[k + 2] = z; tPos[k + 3] = (0.92 + 0.16 * r5) * esc;
    tCam[k] = camisa[0] * luz; tCam[k + 1] = camisa[1] * luz; tCam[k + 2] = camisa[2] * luz; tCam[k + 3] = 255;
    tPel[k] = pele[0] * luz; tPel[k + 1] = pele[1] * luz; tPel[k + 2] = pele[2] * luz; tPel[k + 3] = Math.floor(r6 * 255.99);
    tCab[k] = cabelo[0] * luz; tCab[k + 1] = cabelo[1] * luz; tCab[k + 2] = cabelo[2] * luz; tCab[k + 3] = 255;
    tInf[k] = time * 255; tInf[k + 1] = setor * 85; tInf[k + 2] = org * 255; tInf[k + 3] = Math.floor(r2 * 255.99);
    tNiv[n] = nivel; tF[n] = f;
    tG[n] = setor < 3 ? setor : (NF - 1 - f < T.caFaixa ? 3 : 4);
    n++;
  }
  // o Estádio Golaço: as cadeiras da grade, na ordem de sempre (os MESMOS sorteios por cadeira: só o lugar mudou — o
  // assento, no piso do degrau)
  if (lugares) lugares.iterar(cadeira);
  else grade().iterar(c => cadeira(c.setor, c.f, c.a, c.x, c.y, c.z, 1, c.a + c.f * nA, 1, !!c.fantasma), true);
  // ordem por (grupo, nível, fileira da frente para cima): contagem por balde (estável)
  const F = NF, NG = GRUPOS.length, NB = NG * 3 * F;
  const conta = new Int32Array(NB + 1);
  const balde = i => (tG[i] * 3 + tNiv[i]) * F + (F - 1 - tF[i]);
  for (let i = 0; i < n; i++) conta[balde(i) + 1]++;
  for (let b = 0; b < NB; b++) conta[b + 1] += conta[b];
  const pos = new Float32Array(4 * n), camisa = new Uint8Array(4 * n), pele = new Uint8Array(4 * n), cabelo = new Uint8Array(4 * n), info = new Uint8Array(4 * n), nivel = new Uint8Array(n);
  const faixas = GRUPOS.map(g => ({ inicio: 0, porNivel: [0, 0, 0], setor: g.setor, nome: g.nome }));
  for (let i = 0; i < n; i++) {
    const b = balde(i), j = conta[b]++;
    pos.set(tPos.subarray(4 * i, 4 * i + 4), 4 * j); camisa.set(tCam.subarray(4 * i, 4 * i + 4), 4 * j);
    pele.set(tPel.subarray(4 * i, 4 * i + 4), 4 * j); cabelo.set(tCab.subarray(4 * i, 4 * i + 4), 4 * j);
    info.set(tInf.subarray(4 * i, 4 * i + 4), 4 * j); nivel[j] = tNiv[i];
    faixas[tG[i]].porNivel[tNiv[i]]++;
  }
  for (let g = 1; g < NG; g++) faixas[g].inicio = faixas[g - 1].inicio + faixas[g - 1].porNivel[0] + faixas[g - 1].porNivel[1] + faixas[g - 1].porNivel[2];
  // publico: a ocupação do pedido do TM (0,1–1; 1 sem ele) vezes a lotação — a densidade real perto da câmera (item 69, PR 3:
  // render/impostor.js)
  return { n, pos, camisa, pele, cabelo, info, nivel, faixas, publico: publico * lotacao, lotacao };
}

/** Quantos torcedores de um grupo de desenho (GRUPOS) a qualidade desenha (os primeiros da faixa dele). */
export function quantosNoSetor(d, grupo, qualidade) {
  const q = Math.max(0, NIVEIS.indexOf(qualidade));
  let k = 0;
  for (let v = 0; v <= q; v++) k += d.faixas[grupo].porNivel[v];
  return k;
}

/**
 * Torcedores de uma qualidade (os de gerarTorcidaNiveis com nível ≤ o da qualidade). mascara como lá.
 * Devolve {n, pos, camisa, pele, cabelo, info} no mesmo formato.
 */
export function gerarTorcida(qualidade = 'media', mascara = null, niveis = null) {
  const d = niveis ?? gerarTorcidaNiveis(mascara);
  const q = NIVEIS.includes(qualidade) ? NIVEIS.indexOf(qualidade) : 1;
  let n = 0;
  for (let i = 0; i < d.n; i++) if (d.nivel[i] <= q) n++;
  const pos = new Float32Array(4 * n), camisa = new Uint8Array(4 * n), pele = new Uint8Array(4 * n), cabelo = new Uint8Array(4 * n), info = new Uint8Array(4 * n);
  let j = 0;
  for (let i = 0; i < d.n; i++) {
    if (d.nivel[i] > q) continue;
    pos.set(d.pos.subarray(4 * i, 4 * i + 4), 4 * j); camisa.set(d.camisa.subarray(4 * i, 4 * i + 4), 4 * j);
    pele.set(d.pele.subarray(4 * i, 4 * i + 4), 4 * j); cabelo.set(d.cabelo.subarray(4 * i, 4 * i + 4), 4 * j);
    info.set(d.info.subarray(4 * i, 4 * i + 4), 4 * j);
    j++;
  }
  return { n, pos, camisa, pele, cabelo, info };
}

// ------------------------------------------------------------------ atlas das figuras (SDF)

function dSeg(px, py, ax, ay, bx, by, r) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(wx - vx * t, wy - vy * t) - r;
}
function dCaixa(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function dCirc(px, py, cx, cy, r) { return Math.hypot(px - cx, py - cy) - r; }

/** Formas de uma pose: lista em ordem de pintura de [região 0 camisa | 1 pele | 2 cabelo | 3 acento, sdf(x, y)]. */
function formas(pose) {
  const sent = pose === POSE.SENTADO || pose === POSE.SENTADO_PALMAS;
  const dy = sent ? -0.4 : 0;
  const ombroY = 1.38 + dy, quadrilY = 0.95 + dy, cabecaY = 1.6 + dy;
  const L = [];
  // pernas (calça, na cor do cabelo/calça)
  if (sent) {
    for (const s of [-1, 1]) {
      L.push([2, (x, y) => dSeg(x, y, s * 0.09, quadrilY, s * 0.13, quadrilY - 0.06, 0.08)]);
      L.push([2, (x, y) => dSeg(x, y, s * 0.13, quadrilY - 0.06, s * 0.13, 0.1, 0.07)]);
    }
  } else {
    for (const s of [-1, 1]) L.push([2, (x, y) => dSeg(x, y, s * 0.09, quadrilY, s * 0.105, 0.1, 0.075)]);
  }
  // tronco, pescoço, cabeça, cabelo
  L.push([0, (x, y) => dCaixa(x, y, 0, (ombroY + quadrilY) / 2 + 0.02, 0.18, (ombroY - quadrilY) / 2 + 0.05, 0.07)]);
  L.push([1, (x, y) => dSeg(x, y, 0, ombroY + 0.02, 0, cabecaY - 0.08, 0.05)]);
  L.push([1, (x, y) => dCirc(x, y, 0, cabecaY, 0.105)]);
  L.push([2, (x, y) => Math.max(dCirc(x, y, 0, cabecaY + 0.025, 0.11), cabecaY + 0.01 - y)]);
  // braços: [cotovelo, mão] de cada lado (−1 = esquerda na tela, +1 = direita)
  const baixo = s => [[s * 0.25, ombroY - 0.26], [s * 0.26, ombroY - 0.48]];
  const palmas = s => [[s * 0.27, ombroY - 0.2], [s * 0.04, ombroY - 0.08]];
  const V = s => [[s * 0.33, ombroY + 0.27], [s * 0.45, ombroY + 0.54]];
  const cima = s => [[s * 0.27, ombroY + 0.3], [s * 0.31, ombroY + 0.6]];
  const cachecol = s => [[s * 0.3, ombroY + 0.28], [s * 0.36, ombroY + 0.57]];
  const cabeca = s => [[s * 0.36, ombroY + 0.2], [s * 0.11, cabecaY + 0.1]];
  let bracos;
  switch (pose) {
    case POSE.SENTADO: case POSE.EM_PE: bracos = [baixo(-1), baixo(1)]; break;
    case POSE.SENTADO_PALMAS: case POSE.EM_PE_PALMAS: bracos = [palmas(-1), palmas(1)]; break;
    case POSE.BRACOS_V: bracos = [V(-1), V(1)]; break;
    case POSE.UM_BRACO: bracos = [baixo(-1), cima(1)]; break;
    case POSE.CACHECOL: bracos = [cachecol(-1), cachecol(1)]; break;
    default: bracos = [cabeca(-1), cabeca(1)];
  }
  bracos.forEach(([cot, mao], i) => {
    const s = i === 0 ? -1 : 1, ox = s * 0.2, oy = ombroY - 0.02;
    L.push([0, (x, y) => dSeg(x, y, ox, oy, cot[0], cot[1], 0.058)]);   // manga
    L.push([1, (x, y) => dSeg(x, y, cot[0], cot[1], mao[0], mao[1], 0.048)]); // antebraço
    L.push([1, (x, y) => dCirc(x, y, mao[0], mao[1], 0.052)]);              // mão
  });
  if (pose === POSE.CACHECOL) {
    const yc = ombroY + 0.55;
    L.push([3, (x, y) => dCaixa(x, y, 0, yc, 0.42, 0.05, 0.02)]);
    for (const s of [-1, 1]) L.push([3, (x, y) => dCaixa(x, y, s * 0.39, yc - 0.13, 0.04, 0.13, 0.02)]);
  }
  return L;
}

/**
 * Atlas das 8 poses: Uint8Array RGBA (largura = 8·cw, altura = ch), linha 0 = EMBAIXO (y = 0, como o
 * DataTexture sem flipY). R/G/B = pesos de camisa/pele/cabelo já vezes a cobertura; A = cobertura.
 */
export function atlasTorcida(cw = 64, ch = 128) {
  const T = TORCIDA, W = cw * T.quadros, H = ch;
  const dados = new Uint8Array(W * H * 4);
  const px = T.largura / cw;
  for (let pose = 0; pose < T.quadros; pose++) {
    const L = formas(pose);
    for (let r = 0; r < H; r++) {
      const y = (r + 0.5) / H * T.altura;
      for (let c = 0; c < cw; c++) {
        const x = (c + 0.5) / cw * T.largura - T.largura / 2;
        // pinta de trás para frente: (pesos, cobertura) sobre o que já tem
        let wr = 0, wg = 0, wb = 0, wa = 0, a = 0;
        for (const [reg, f] of L) {
          const cob = Math.max(0, Math.min(1, 0.5 - f(x, y) / px));
          if (cob <= 0) continue;
          wr *= 1 - cob; wg *= 1 - cob; wb *= 1 - cob; wa *= 1 - cob; a = a * (1 - cob) + cob;
          if (reg === 0) wr += cob; else if (reg === 1) wg += cob; else if (reg === 2) wb += cob; else wa += cob;
        }
        const k = (r * W + pose * cw + c) * 4;
        dados[k] = Math.round(wr * 255); dados[k + 1] = Math.round(wg * 255); dados[k + 2] = Math.round(wb * 255); dados[k + 3] = Math.round(a * 255);
      }
    }
  }
  return { dados, largura: W, altura: H };
}

// ------------------------------------------------------------------ pose (JS e GLSL da MESMA regra)
// Limiares e ritmos da pose num lugar só: poseDoTorcedor (JS, testes) e POSE_GLSL (o vertex shader de
// torcida.js) saem destes números (contraprova M9: as duas contas eram escritas à mão em dois lugares; o
// teste-estadio confere na GPU que o shader dá o mesmo que o JS).
export const POSE_REGRA = {
  emPeTensao: [0.25, 0.7], emPeExcita: [0.08, 0.5],   // em pé: nível > a + b·h (h = semente do torcedor)
  explode: [0.2, 0.55], lamento: [0.3, 0.5], palmas: [0.2, 0.6],
  bateHz: 2.3,                                       // palmas
  bracoV: 0.45, umBraco: 0.75,                       // gol: h2 < 0,45 braços em V, < 0,75 um braço, senão cachecol
  orgCachecol: 0.15, orgUmBraco: 0.3, orgPalmas: 0.6,
  // a organizada pula no surdo da batucada (som.js SOM.arquivos.batucada.bpm = 76,8 → 1,28 Hz; com o som rodando o
  // relógio dela vem da própria gravação: torcida.js uTempoOrg)
  puloHz: 1.9, puloAlt: 0.32, puloGanho: 1.4, orgPuloHz: 1.28, orgPuloAlt: 0.11, orgPuloFase: 0.6,
};
const TAU = Math.PI * 2;

/**
 * Pose e pulo de um torcedor (a MESMA regra do vertex shader de torcida.js, POSE_GLSL):
 * niveis = {excita, tensao, lamento, palmas} do time dele; h = semente 0–1; org = organizada; t = s.
 */
export function poseDoTorcedor(niveis, h, h2, org, t, animada = true) {
  const R = POSE_REGRA;
  const { excita, tensao, lamento, palmas } = niveis;
  const emPe = org || tensao > R.emPeTensao[0] + R.emPeTensao[1] * h || excita > R.emPeExcita[0] + R.emPeExcita[1] * h;
  const bate = animada && (Math.sin(t * TAU * R.bateHz + h2 * 6.283) > 0) ? 1 : 0;
  const explode = excita > R.explode[0] + R.explode[1] * h;
  let pose;
  if (explode) pose = h2 < R.bracoV ? POSE.BRACOS_V : h2 < R.umBraco ? POSE.UM_BRACO : POSE.CACHECOL;
  else if (lamento > R.lamento[0] + R.lamento[1] * h) pose = POSE.MAOS_CABECA;
  else if (palmas > R.palmas[0] + R.palmas[1] * h) pose = emPe ? (bate ? POSE.EM_PE_PALMAS : POSE.EM_PE) : (bate ? POSE.SENTADO_PALMAS : POSE.SENTADO);
  else if (org) pose = h2 < R.orgCachecol ? POSE.CACHECOL : h2 < R.orgUmBraco ? POSE.UM_BRACO : (bate && h2 < R.orgPalmas ? POSE.EM_PE_PALMAS : POSE.EM_PE);
  else pose = emPe ? POSE.EM_PE : POSE.SENTADO;
  let pulo = 0;
  if (animada) {
    const fase = Math.sin(t * TAU * R.puloHz + h * 6.283);
    if (explode) pulo = Math.max(0, fase) * R.puloAlt * Math.min(1, excita * R.puloGanho);
    else if (org) pulo = Math.max(0, Math.sin(t * TAU * R.orgPuloHz + h * R.orgPuloFase)) * R.orgPuloAlt;
  }
  return { pose, emPe, pulo };
}

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/**
 * A mesma regra em GLSL: vec2 torcidaPose(ex, te, la, pa, h, h2, org, t, animada) → (pose, pulo).
 * org e animada: 0 ou 1.
 */
export const POSE_GLSL = (() => {
  const R = POSE_REGRA, P = POSE;
  return `
vec2 torcidaPose(float ex, float te, float la, float pa, float h, float h2, float org, float t, float animada) {
  bool emPe = org > 0.5 || te > ${g(R.emPeTensao[0])} + ${g(R.emPeTensao[1])} * h || ex > ${g(R.emPeExcita[0])} + ${g(R.emPeExcita[1])} * h;
  bool bate = animada > 0.5 && sin(t * ${g(TAU * R.bateHz)} + h2 * 6.283) > 0.0;
  bool explode = ex > ${g(R.explode[0])} + ${g(R.explode[1])} * h;
  float pose;
  if (explode) pose = h2 < ${g(R.bracoV)} ? ${g(P.BRACOS_V)} : (h2 < ${g(R.umBraco)} ? ${g(P.UM_BRACO)} : ${g(P.CACHECOL)});
  else if (la > ${g(R.lamento[0])} + ${g(R.lamento[1])} * h) pose = ${g(P.MAOS_CABECA)};
  else if (pa > ${g(R.palmas[0])} + ${g(R.palmas[1])} * h) pose = emPe ? (bate ? ${g(P.EM_PE_PALMAS)} : ${g(P.EM_PE)}) : (bate ? ${g(P.SENTADO_PALMAS)} : ${g(P.SENTADO)});
  else if (org > 0.5) pose = h2 < ${g(R.orgCachecol)} ? ${g(P.CACHECOL)} : (h2 < ${g(R.orgUmBraco)} ? ${g(P.UM_BRACO)} : ((bate && h2 < ${g(R.orgPalmas)}) ? ${g(P.EM_PE_PALMAS)} : ${g(P.EM_PE)}));
  else pose = emPe ? ${g(P.EM_PE)} : ${g(P.SENTADO)};
  float pulo = 0.0;
  if (animada > 0.5) {
    float fase = sin(t * ${g(TAU * R.puloHz)} + h * 6.283);
    if (explode) pulo = max(0.0, fase) * ${g(R.puloAlt)} * min(1.0, ex * ${g(R.puloGanho)});
    else if (org > 0.5) pulo = max(0.0, sin(t * ${g(TAU * R.orgPuloHz)} + h * ${g(R.orgPuloFase)})) * ${g(R.orgPuloAlt)};
  }
  return vec2(pose, pulo);
}
`;
})();

/**
 * Caixa de cada pose dentro da célula do atlas (largura e altura em fração da célula, com 1 texel de folga;
 * medida no atlas 64 × 128 — tools/teste-torcida confere que nada da figura fica de fora): o quadro de cada
 * torcedor encolhe para a pose (sentado com os braços para baixo ocupa 40% do quadro cheio) — menos pixels
 * descartados por torcedor (contraprova M3: a torcida custava muito por pixel com os quadros sobrepostos).
 */
export const CAIXA_POSE = [[0.61, 0.617], [0.64, 0.617], [0.61, 0.797], [0.64, 0.797], [0.954, 0.906], [0.704, 0.938], [0.796, 0.922], [0.796, 0.805]];
