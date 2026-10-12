// Esqueleto do corpo humano (Etapa 5.1): a pose de 19 juntas que a animação pura já calcula (anim.js) vira os 22
// ossos do corpo (+ 8 auxiliares de joelho e cotovelo; matrizes de pele 3×4, uma linha da textura de ossos por
// jogador) e as juntas FINAIS do esqueleto (o que o jogador vê; os testes comparam com a pose). PURO: sem three.js nem
// DOM, e sem alocar nada por quadro (os números passam entre as funções por um Float64Array de rascunho: número com
// vírgula como argumento de função vira objeto no V8 e enche a memória).
//
// Como (PESQUISA-ETAPA5.md §2):
//  1) Retarget por DIREÇÃO dos ossos (ossos rígidos do corpo; D. Holden): cada osso aponta da junta da pose para a
//     junta seguinte; a torção sai da linha dos ombros/quadris (tronco), da direção em que o cotovelo/joelho dobra
//     (braço, coxa; com reserva pela frente do corpo) e do "cima" do mundo (pé: a sola fica plana no apoio). O tronco
//     (lombar, peito, tórax) segue as juntas exatas da pose com escala no comprimento (a pose encurta até 1% com o
//     tronco inclinado para a frente e para o lado); a pelve sai da linha dos quadris e do ponto da pelve, então o
//     quadril cai exatamente onde a simulação o pôs; a clavícula sai do eixo do tronco na altura dos ombros.
//  2) Ajuste final (IK de duas juntas, "Simple Two Joint IK", Holden): perna até o tornozelo da pose (o pé apoiado
//     fica no ponto plantado), braço até a mão da pose (goleiro, lateral e todos os outros; o braço e o antebraço com o
//     comprimento da pose, que balança até ~7% na pedalada) e pé + dedos até a ponta da pose (os dedos dobram para cima
//     quando a ponta fica mais perto; o pé estica até 15% quando ela fica mais longe, no goleiro no ar). Sem o ajuste
//     (opc.ajuste = false, o controle do teste-esqueleto) o corpo é só o retarget com ossos rígidos: na pose
//     interpolada entre dois passos o tornozelo de quem está apoiado treme e a ponta erra alguns centímetros.
//  3) Auxiliares do joelho e do cotovelo (dois por junta, girando 1/3 e 2/3 da dobra, e engordando um pouco na largura
//     conforme ela dobra): a pele linear sozinha "murcha" a junta dobrada (metade do volume a 120°).
// A pose de repouso vem do arquivo do corpo (assets/jogador/corpo.bin, montado por tools/humano/gerar-corpo.mjs): as
// 19 juntas na pose A do modelo com as proporções da simulação (pernas 0,45 + 0,45, tornozelo a 0,08 m, quadris a
// 0,18 m, ombros a 0,38 m, braço 0,29 + 0,26), a base do crânio e a "bola" de cada pé. Os quadros de repouso saem da
// MESMA conta aplicada à pose de repouso: a pose de repouso desenha o corpo exatamente como ele foi modelado.
import { J, NJ } from '../anim.js';

export const OSSOS = [
  'quadril', 'lombar', 'peito', 'torax', 'pescoco', 'cabeca',
  'claviculaE', 'bracoE', 'antebracoE', 'maoE',
  'claviculaD', 'bracoD', 'antebracoD', 'maoD',
  'coxaE', 'canelaE', 'peE', 'dedosE',
  'coxaD', 'canelaD', 'peD', 'dedosD',
  // auxiliares das juntas que mais dobram (joelho e cotovelo): dois por junta, na junta, girando 1/3 e 2/3 da dobra (a
  // ideia dos "helper joints" dos jogos): entre dois ossos girados de θ a pele linear encolhe por cos(θ/2)
  'joelhoE1', 'joelhoE2', 'joelhoD1', 'joelhoD2', 'cotoveloE1', 'cotoveloE2', 'cotoveloD1', 'cotoveloD2',
];
export const NO = OSSOS.length;
export const O = Object.fromEntries(OSSOS.map((n, i) => [n, i]));
/** Pai de cada osso (hierarquia do corpo; a conta posiciona cada osso pela regra dele). */
export const PAI = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 0, 14, 15, 16, 0, 18, 19, 20, 14, 14, 18, 18, 7, 7, 11, 11];
/** Os 22 ossos do corpo (os outros 8 são os auxiliares das juntas). */
export const NO_CORPO = 22;
/** Auxiliares: [osso auxiliar, osso de cima, osso de baixo, fração da dobra] (na cabeça do osso de baixo). */
export const AUXILIARES = [[22, 14, 15, 1 / 3], [23, 14, 15, 2 / 3], [24, 18, 19, 1 / 3], [25, 18, 19, 2 / 3],
  [26, 7, 8, 1 / 3], [27, 7, 8, 2 / 3], [28, 11, 12, 1 / 3], [29, 11, 12, 2 / 3]];
/** Floats por jogador na textura de ossos: 3 texels RGBA por osso (matriz 3×4) + 1 texel de dados do jogador. */
export const FLOATS_POR_JOGADOR = NO * 12 + 4;
/** Quanto os auxiliares engordam por (cos da dobra de repouso − cos da dobra): 0,07 → +10% a 120° no joelho. */
export const INCHA = 0.07;
/** O pé (com os dedos) estica no máximo isto para alcançar a ponta da pose. */
export const ESTICA_PE = 1.15;
/** Os dedos dobram no máximo isto (rad) para a ponta chegar mais perto (o dedão dobra até ~70° no arranque). */
const COS_DEDOS = Math.cos(75 * Math.PI / 180);
/** O pescoço segue o comprimento da pose dentro destes limites. */
const PESCOCO_MIN = 0.9, PESCOCO_MAX = 1.15;
/** Braço e antebraço seguem o comprimento da pose dentro destes limites (fora disso, a pose está quebrada). */
const BRACO_MIN = 0.9, BRACO_MAX = 1.1;

// tronco: osso, junta de baixo, junta de cima, peso da linha dos quadris na torção (o resto é a dos ombros)
const TRONCO_OSSO = [1, 2, 3];
const TRONCO_A = [J.pelve, J.lombar, J.peito];
const TRONCO_B = [J.lombar, J.peito, J.pescoco];
const TRONCO_WQ = [2 / 3, 1 / 3, 0];
// braço: [clavícula, ombro, cotovelo, mão]; perna: [coxa, quadril, joelho, tornozelo, ponta]
const BR = [6, J.ombroE, J.cotoveloE, J.maoE, 10, J.ombroD, J.cotoveloD, J.maoD];
const PE = [14, J.quadrilE, J.joelhoE, J.tornozeloE, J.pontaE, 18, J.quadrilD, J.joelhoD, J.tornozeloD, J.pontaD];

// Rascunho dos vetores passados às funções (índices fixos): nada de número com vírgula como argumento.
// 0..2 eixo Y · 3..5 referência · 6..8 reserva · 9..11 ponto local · 12..13 comprimentos do IK
const V = new Float64Array(16);

/** Quadro em F[o..]: Y = V[0..2], Z de referência V[3..5] (ortogonalizado; reserva V[6..8]). R por linhas (colunas X, Y, Z). */
function quadroYZ(F, o) {
  let yx = V[0], yy = V[1], yz = V[2];
  let l = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1;
  yx /= l; yy /= l; yz /= l;
  let d = V[3] * yx + V[4] * yy + V[5] * yz;
  let ax = V[3] - d * yx, ay = V[4] - d * yy, az = V[5] - d * yz;
  l = Math.sqrt(ax * ax + ay * ay + az * az);
  if (l < 1e-6) {
    d = V[6] * yx + V[7] * yy + V[8] * yz;
    ax = V[6] - d * yx; ay = V[7] - d * yy; az = V[8] - d * yz;
    l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  }
  ax /= l; ay /= l; az /= l;
  const r = o + 3;
  F[r] = yy * az - yz * ay; F[r + 1] = yx; F[r + 2] = ax;
  F[r + 3] = yz * ax - yx * az; F[r + 4] = yy; F[r + 5] = ay;
  F[r + 6] = yx * ay - yy * ax; F[r + 7] = yz; F[r + 8] = az;
}
/** Quadro em F[o..]: Y = V[0..2], X de referência V[3..5] (ortogonalizado). */
function quadroYX(F, o) {
  let yx = V[0], yy = V[1], yz = V[2];
  let l = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1;
  yx /= l; yy /= l; yz /= l;
  const d = V[3] * yx + V[4] * yy + V[5] * yz;
  let xx = V[3] - d * yx, xy = V[4] - d * yy, xz = V[5] - d * yz;
  l = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
  xx /= l; xy /= l; xz /= l;
  const r = o + 3;
  F[r] = xx; F[r + 1] = yx; F[r + 2] = xy * yz - xz * yy;
  F[r + 3] = xy; F[r + 4] = yy; F[r + 5] = xz * yx - xx * yz;
  F[r + 6] = xz; F[r + 7] = yz; F[r + 8] = xx * yy - xy * yx;
}
/** Quadro de destino = o de origem levado pela rotação mínima do Y dele até V[0..2] (sem torção nova). */
function transportar(F, oDst, oSrc) {
  let yx = V[0], yy = V[1], yz = V[2];
  const l = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1;
  yx /= l; yy /= l; yz /= l;
  const r = oSrc + 3, rd = oDst + 3;
  const ax = F[r + 1], ay = F[r + 4], az = F[r + 7];
  const c = ax * yx + ay * yy + az * yz;
  // R v = v c + w × v + w (w·v)/(1 + c), w = a × b
  const wx = ay * yz - az * yy, wy = az * yx - ax * yz, wz = ax * yy - ay * yx;
  const k = 1 / Math.max(1e-9, 1 + c);
  for (let col = 0; col < 3; col += 2) {
    const vx = F[r + col], vy = F[r + 3 + col], vz = F[r + 6 + col];
    const wv = (wx * vx + wy * vy + wz * vz) * k;
    F[rd + col] = vx * c + (wy * vz - wz * vy) + wx * wv;
    F[rd + 3 + col] = vy * c + (wz * vx - wx * vz) + wy * wv;
    F[rd + 6 + col] = vz * c + (wx * vy - wy * vx) + wz * wv;
  }
  F[rd + 1] = yx; F[rd + 4] = yy; F[rd + 7] = yz;
}
function copiarR(F, oDst, oSrc) { for (let i = 3; i < 12; i++) F[oDst + i] = F[oSrc + i]; }
/** out[oo..] = h + R · V[9..11] do quadro em F[o..]. */
function pontoLocal(F, o, out, oo) {
  const r = o + 3, lx = V[9], ly = V[10], lz = V[11];
  out[oo] = F[o] + F[r] * lx + F[r + 1] * ly + F[r + 2] * lz;
  out[oo + 1] = F[o + 1] + F[r + 3] * lx + F[r + 4] * ly + F[r + 5] * lz;
  out[oo + 2] = F[o + 2] + F[r + 6] * lx + F[r + 7] * ly + F[r + 8] * lz;
}
/** Vetor do mundo (vx, vy, vz) no quadro em F[o..] → out[oo..] (Rᵀ v). Só no repouso. */
function paraLocal(F, o, vx, vy, vz, out, oo) {
  const r = o + 3;
  out[oo] = F[r] * vx + F[r + 3] * vy + F[r + 6] * vz;
  out[oo + 1] = F[r + 1] * vx + F[r + 4] * vy + F[r + 7] * vz;
  out[oo + 2] = F[r + 2] * vx + F[r + 5] * vy + F[r + 8] * vz;
}
/**
 * IK de duas juntas: base em A[ia], alvo em A[it], ossos V[12] e V[13], polo V[3..5] (para onde a junta do meio vai).
 * Escreve a junta do meio em A[im] e a ponta em A[ie] (= o alvo, se alcança).
 */
function ik2(A, ia, it, im, ie) {
  const L1 = V[12], L2 = V[13];
  let dx = A[it] - A[ia], dy = A[it + 1] - A[ia + 1], dz = A[it + 2] - A[ia + 2];
  const d0 = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
  dx /= d0; dy /= d0; dz /= d0;
  const d = Math.min(Math.max(d0, Math.abs(L1 - L2) + 1e-6), (L1 + L2) * 0.99999);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pd = V[3] * dx + V[4] * dy + V[5] * dz;
  let qx = V[3] - pd * dx, qy = V[4] - pd * dy, qz = V[5] - pd * dz;
  const ql = Math.sqrt(qx * qx + qy * qy + qz * qz);
  if (ql < 1e-12) { qx = 0; qy = 0; qz = 0; } else { qx /= ql; qy /= ql; qz /= ql; }
  A[im] = A[ia] + dx * a + qx * hh; A[im + 1] = A[ia + 1] + dy * a + qy * hh; A[im + 2] = A[ia + 2] + dz * a + qz * hh;
  A[ie] = A[ia] + dx * d; A[ie + 1] = A[ia + 1] + dy * d; A[ie + 2] = A[ia + 2] + dz * d;
}
function dist(pp, a, b) { return Math.hypot(pp[a * 3] - pp[b * 3], pp[a * 3 + 1] - pp[b * 3 + 1], pp[a * 3 + 2] - pp[b * 3 + 2]); }

/**
 * Cria o esqueleto a partir da pose de repouso do corpo. bind = {pose: 57 floats (19 juntas na pose A),
 * cabecaBase: [x,y,z], bolaE: [x,y,z], bolaD: [x,y,z]} (do arquivo do corpo, render/corpo-leitor.js).
 * Devolve {calcular(pose, out, off, opc), juntas, quadros, quadrosRepouso, escalas, escalasLargura, comprimentos, bind}.
 */
export function criarEsqueleto(bind) {
  const P = new Float64Array(NJ * 3);       // a pose que entra
  const JF = new Float64Array(NJ * 3);      // juntas finais do esqueleto
  const A = new Float64Array(24);           // pontos de rascunho do IK
  const T = new Float64Array(12);           // quadro "da linha" do pé (h + R)
  const F = new Float64Array(NO * 12);      // quadros finais: h (3) + R (9) por osso
  const S = new Float64Array(NO);           // escala no comprimento (tronco, braço, pé)
  const SL = new Float64Array(NO).fill(1);  // escala na largura (auxiliares das juntas: o volume da dobra)
  const Fb = new Float64Array(NO * 12);     // quadros de repouso
  // medidas da pose de repouso (comprimentos e pontos locais), por índice: nada é procurado por nome no quadro
  const C = {
    tronco: new Float64Array(3), pesc: 0, cab: new Float64Array(3), kClav: 0,
    clav: new Float64Array(2), braco: new Float64Array(2), ante: new Float64Array(2),
    quad: new Float64Array(6), coxa: new Float64Array(2), canela: new Float64Array(2),
    bola: new Float64Array(6), pa: new Float64Array(2), pb: new Float64Array(2), linha: new Float64Array(2),
    dobra: new Float64Array(AUXILIARES.length),
  };
  let repouso = true;

  function montar(pp, ajuste) {
    // linhas dos quadris e dos ombros (E − D), normalizadas
    const iqe = J.quadrilE * 3, iqd = J.quadrilD * 3, ioe = J.ombroE * 3, iod = J.ombroD * 3;
    let hx = pp[iqe] - pp[iqd], hy = pp[iqe + 1] - pp[iqd + 1], hz = pp[iqe + 2] - pp[iqd + 2];
    let l = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1; hx /= l; hy /= l; hz /= l;
    let sx = pp[ioe] - pp[iod], sy = pp[ioe + 1] - pp[iod + 1], sz = pp[ioe + 2] - pp[iod + 2];
    l = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx /= l; sy /= l; sz /= l;
    // ---- pelve: X = linha dos quadris, Y = da média dos quadris até a pelve (o quadril sai exato)
    const ip = J.pelve * 3;
    F[0] = pp[ip]; F[1] = pp[ip + 1]; F[2] = pp[ip + 2];
    V[0] = pp[ip] - (pp[iqe] + pp[iqd]) / 2; V[1] = pp[ip + 1] - (pp[iqe + 1] + pp[iqd + 1]) / 2; V[2] = pp[ip + 2] - (pp[iqe + 2] + pp[iqd + 2]) / 2;
    V[3] = hx; V[4] = hy; V[5] = hz;
    quadroYX(F, 0);
    S[0] = 1;
    // ---- tronco: as juntas exatas da pose (escala no comprimento); torção dos quadris para os ombros
    for (let k = 0; k < 3; k++) {
      const b = TRONCO_OSSO[k], o = b * 12, ia = TRONCO_A[k] * 3, ib = TRONCO_B[k] * 3, wq = TRONCO_WQ[k];
      F[o] = pp[ia]; F[o + 1] = pp[ia + 1]; F[o + 2] = pp[ia + 2];
      const dx = pp[ib] - pp[ia], dy = pp[ib + 1] - pp[ia + 1], dz = pp[ib + 2] - pp[ia + 2];
      V[0] = dx; V[1] = dy; V[2] = dz;
      V[3] = hx * wq + sx * (1 - wq); V[4] = hy * wq + sy * (1 - wq); V[5] = hz * wq + sz * (1 - wq);
      quadroYX(F, o);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (repouso) C.tronco[k] = len;
      S[b] = len / C.tronco[k];
    }
    // ---- pescoço (rígido, apontando para a cabeça da pose) e cabeça (continua o pescoço)
    const i4 = J.pescoco * 3, ic = J.cabeca * 3, o4 = 48;
    F[o4] = pp[i4]; F[o4 + 1] = pp[i4 + 1]; F[o4 + 2] = pp[i4 + 2];
    V[0] = pp[ic] - pp[i4]; V[1] = pp[ic + 1] - pp[i4 + 1]; V[2] = pp[ic + 2] - pp[i4 + 2];
    V[3] = sx; V[4] = sy; V[5] = sz;
    quadroYX(F, o4);
    if (repouso) {
      C.pesc = Math.hypot(pp[ic] - pp[i4], pp[ic + 1] - pp[i4 + 1], pp[ic + 2] - pp[i4 + 2]);
      paraLocal(F, o4, bind.cabecaBase[0] - pp[i4], bind.cabecaBase[1] - pp[i4 + 1], bind.cabecaBase[2] - pp[i4 + 2], C.cab, 0);
    }
    // com o ajuste, o pescoço segue o comprimento da pose (no mergulho do goleiro a cabeça da pose vai 0,03 à frente
    // do tronco deitado e o pescoço da pose chega a ~0,16 m): entre 0,9 e 1,15 do de repouso
    let sp = 1;
    if (ajuste) {
      const ex = pp[ic] - pp[i4], ey = pp[ic + 1] - pp[i4 + 1], ez = pp[ic + 2] - pp[i4 + 2];
      sp = Math.sqrt(ex * ex + ey * ey + ez * ez) / C.pesc;
      sp = sp < PESCOCO_MIN ? PESCOCO_MIN : sp > PESCOCO_MAX ? PESCOCO_MAX : sp;
    }
    S[4] = sp;
    V[9] = C.cab[0]; V[10] = C.cab[1] * sp; V[11] = C.cab[2];
    pontoLocal(F, o4, F, 60);
    copiarR(F, 60, o4);
    S[5] = 1;
    V[9] = 0; V[10] = C.pesc * sp; V[11] = 0;
    pontoLocal(F, o4, JF, ic);
    for (let k = 0; k < 3; k++) { JF[ip + k] = F[k]; JF[J.lombar * 3 + k] = F[24 + k]; JF[J.peito * 3 + k] = F[36 + k]; JF[i4 + k] = F[48 + k]; }
    // ---- braços
    const ipe = J.peito * 3;
    if (repouso) {
      // a clavícula sai do eixo do tronco, na altura dos ombros: fração k do caminho do peito ao pescoço
      C.kClav = ((pp[ioe + 1] + pp[iod + 1]) / 2 - pp[ipe + 1]) / (pp[i4 + 1] - pp[ipe + 1]);
    }
    const r3 = 36 + 3; // quadro do tórax (frente = coluna Z, cima = coluna Y)
    for (let lado = 0; lado < 2; lado++) {
      const bc = BR[lado * 4], jO = BR[lado * 4 + 1], jC = BR[lado * 4 + 2], jM = BR[lado * 4 + 3];
      const oc = bc * 12, ob = oc + 12, oa = oc + 24, om = oc + 36;
      const ioo = jO * 3, icc = jC * 3, imm = jM * 3;
      const k = C.kClav;
      F[oc] = pp[ipe] + (pp[i4] - pp[ipe]) * k; F[oc + 1] = pp[ipe + 1] + (pp[i4 + 1] - pp[ipe + 1]) * k; F[oc + 2] = pp[ipe + 2] + (pp[i4 + 2] - pp[ipe + 2]) * k;
      const cx = pp[ioo] - F[oc], cy = pp[ioo + 1] - F[oc + 1], cz = pp[ioo + 2] - F[oc + 2];
      V[0] = cx; V[1] = cy; V[2] = cz;
      V[3] = F[r3 + 2]; V[4] = F[r3 + 5]; V[5] = F[r3 + 8];
      V[6] = F[r3 + 1]; V[7] = F[r3 + 4]; V[8] = F[r3 + 7];
      quadroYZ(F, oc);
      if (repouso) { C.clav[lado] = Math.sqrt(cx * cx + cy * cy + cz * cz); C.braco[lado] = dist(pp, jO, jC); C.ante[lado] = dist(pp, jC, jM); }
      S[bc] = 1; S[bc + 3] = 1;
      V[9] = 0; V[10] = C.clav[lado]; V[11] = 0;
      pontoLocal(F, oc, A, 0); // ombro = ponta da clavícula
      // braço e antebraço com o comprimento da pose (a pose do braço balançando estica até ~7%; fora de ±10%, rígido)
      let sb = 1, sa = 1;
      if (ajuste) {
        let ex = pp[icc] - pp[ioo], ey = pp[icc + 1] - pp[ioo + 1], ez = pp[icc + 2] - pp[ioo + 2];
        sb = Math.sqrt(ex * ex + ey * ey + ez * ez) / C.braco[lado];
        ex = pp[imm] - pp[icc]; ey = pp[imm + 1] - pp[icc + 1]; ez = pp[imm + 2] - pp[icc + 2];
        sa = Math.sqrt(ex * ex + ey * ey + ez * ez) / C.ante[lado];
        if (!(sb >= BRACO_MIN && sb <= BRACO_MAX)) sb = 1;
        if (!(sa >= BRACO_MIN && sa <= BRACO_MAX)) sa = 1;
      }
      S[bc + 1] = sb; S[bc + 2] = sa;
      const L1 = C.braco[lado] * sb, L2 = C.ante[lado] * sa;
      if (ajuste) {
        // IK até a mão da pose; polo = o cotovelo da pose
        A[3] = pp[imm]; A[4] = pp[imm + 1]; A[5] = pp[imm + 2];
        V[3] = pp[icc] - pp[ioo]; V[4] = pp[icc + 1] - pp[ioo + 1]; V[5] = pp[icc + 2] - pp[ioo + 2];
        V[12] = L1; V[13] = L2;
        ik2(A, 0, 3, 6, 9);
      } else {
        let ux = pp[icc] - pp[ioo], uy = pp[icc + 1] - pp[ioo + 1], uz = pp[icc + 2] - pp[ioo + 2];
        let lu = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
        A[6] = A[0] + ux / lu * L1; A[7] = A[1] + uy / lu * L1; A[8] = A[2] + uz / lu * L1;
        ux = pp[imm] - pp[icc]; uy = pp[imm + 1] - pp[icc + 1]; uz = pp[imm + 2] - pp[icc + 2];
        lu = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
        A[9] = A[6] + ux / lu * L2; A[10] = A[7] + uy / lu * L2; A[11] = A[8] + uz / lu * L2;
      }
      // braço: Y = ombro → cotovelo; Z = para onde o cotovelo dobra (o antebraço sem a parte ao longo do braço), com
      // reserva pela frente do tronco e, com o braço apontando para a frente, pelo "cima" do tronco
      let yx = A[6] - A[0], yy = A[7] - A[1], yz = A[8] - A[2];
      const ly = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1; yx /= ly; yy /= ly; yz /= ly;
      let fx = A[9] - A[6], fy = A[10] - A[7], fz = A[11] - A[8];
      const lf = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1; fx /= lf; fy /= lf; fz /= lf;
      const d = fx * yx + fy * yy + fz * yz;
      F[ob] = A[0]; F[ob + 1] = A[1]; F[ob + 2] = A[2];
      V[0] = yx; V[1] = yy; V[2] = yz;
      V[3] = fx - d * yx + 0.15 * F[r3 + 2] + 0.05 * F[r3 + 1];
      V[4] = fy - d * yy + 0.15 * F[r3 + 5] + 0.05 * F[r3 + 4];
      V[5] = fz - d * yz + 0.15 * F[r3 + 8] + 0.05 * F[r3 + 7];
      V[6] = F[r3 + 1]; V[7] = F[r3 + 4]; V[8] = F[r3 + 7];
      quadroYZ(F, ob);
      // antebraço: o quadro do braço levado pela rotação mínima até a direção do antebraço; mão: continua o antebraço
      F[oa] = A[6]; F[oa + 1] = A[7]; F[oa + 2] = A[8];
      V[0] = fx; V[1] = fy; V[2] = fz;
      transportar(F, oa, ob);
      F[om] = A[9]; F[om + 1] = A[10]; F[om + 2] = A[11];
      copiarR(F, om, oa);
      for (let q = 0; q < 3; q++) { JF[ioo + q] = A[q]; JF[icc + q] = A[6 + q]; JF[imm + q] = A[9 + q]; }
    }
    // ---- pernas
    for (let lado = 0; lado < 2; lado++) {
      const bq = PE[lado * 5], jQ = PE[lado * 5 + 1], jJ = PE[lado * 5 + 2], jT = PE[lado * 5 + 3], jP = PE[lado * 5 + 4];
      const oq = bq * 12, oc = oq + 12, ope = oq + 24, od = oq + 36;
      const iq = jQ * 3, ij = jJ * 3, it = jT * 3, ipp = jP * 3;
      if (repouso) {
        paraLocal(F, 0, pp[iq] - F[0], pp[iq + 1] - F[1], pp[iq + 2] - F[2], C.quad, lado * 3);
        C.coxa[lado] = dist(pp, jQ, jJ); C.canela[lado] = dist(pp, jJ, jT);
      }
      S[bq] = 1; S[bq + 1] = 1; S[bq + 2] = 1; S[bq + 3] = 1;
      V[9] = C.quad[lado * 3]; V[10] = C.quad[lado * 3 + 1]; V[11] = C.quad[lado * 3 + 2];
      pontoLocal(F, 0, A, 0); // quadril no quadro da pelve
      const L1 = C.coxa[lado], L2 = C.canela[lado];
      if (ajuste) {
        A[3] = pp[it]; A[4] = pp[it + 1]; A[5] = pp[it + 2];
        V[3] = pp[ij] - pp[iq]; V[4] = pp[ij + 1] - pp[iq + 1]; V[5] = pp[ij + 2] - pp[iq + 2];
        V[12] = L1; V[13] = L2;
        ik2(A, 0, 3, 6, 9);
      } else {
        let ux = pp[ij] - pp[iq], uy = pp[ij + 1] - pp[iq + 1], uz = pp[ij + 2] - pp[iq + 2];
        let lu = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
        A[6] = A[0] + ux / lu * L1; A[7] = A[1] + uy / lu * L1; A[8] = A[2] + uz / lu * L1;
        ux = pp[it] - pp[ij]; uy = pp[it + 1] - pp[ij + 1]; uz = pp[it + 2] - pp[ij + 2];
        lu = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
        A[9] = A[6] + ux / lu * L2; A[10] = A[7] + uy / lu * L2; A[11] = A[8] + uz / lu * L2;
      }
      // frente do pé no chão (horizontal): reserva da torção da coxa
      let pfx = pp[ipp] - pp[it], pfz = pp[ipp + 2] - pp[it + 2];
      const lpf = Math.sqrt(pfx * pfx + pfz * pfz) || 1; pfx /= lpf; pfz /= lpf;
      let yx = A[6] - A[0], yy = A[7] - A[1], yz = A[8] - A[2];
      const ly = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1; yx /= ly; yy /= ly; yz /= ly;
      let fx = A[9] - A[6], fy = A[10] - A[7], fz = A[11] - A[8];
      const lf = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1; fx /= lf; fy /= lf; fz /= lf;
      const d = fx * yx + fy * yy + fz * yz;
      // coxa: o joelho aponta para o lado contrário de onde a canela dobra (reserva: a frente do pé e da pelve)
      F[oq] = A[0]; F[oq + 1] = A[1]; F[oq + 2] = A[2];
      V[0] = yx; V[1] = yy; V[2] = yz;
      V[3] = -(fx - d * yx) + 0.15 * pfx + 0.05 * F[5]; V[4] = -(fy - d * yy) + 0.05 * F[8]; V[5] = -(fz - d * yz) + 0.15 * pfz + 0.05 * F[11];
      V[6] = F[5]; V[7] = F[8]; V[8] = F[11];
      quadroYZ(F, oq);
      F[oc] = A[6]; F[oc + 1] = A[7]; F[oc + 2] = A[8];
      V[0] = fx; V[1] = fy; V[2] = fz;
      transportar(F, oc, oq);
      // pé: quadro "da linha" (tornozelo final → ponta da pose; "cima" do pé = cima do mundo para a sola ficar plana;
      // com o pé quase de pé, mistura com a frente da canela)
      const tx = A[9], ty = A[10], tz = A[11];
      const lx = pp[ipp] - tx, lyy = pp[ipp + 1] - ty, lz = pp[ipp + 2] - tz;
      const ll = Math.sqrt(lx * lx + lyy * lyy + lz * lz) || 1;
      let kv = (Math.abs(lyy / ll) - 0.75) / 0.2;
      kv = kv <= 0 ? 0 : kv >= 1 ? 1 : kv * kv * (3 - 2 * kv);
      const rc = oc + 3;
      T[0] = tx; T[1] = ty; T[2] = tz;
      V[0] = lx; V[1] = lyy; V[2] = lz;
      V[3] = F[rc + 2] * kv; V[4] = 1 - kv + F[rc + 5] * kv; V[5] = F[rc + 8] * kv;
      V[6] = F[rc + 2]; V[7] = F[rc + 5]; V[8] = F[rc + 8];
      quadroYZ(T, 0);
      if (repouso) {
        const bola = lado === 0 ? bind.bolaE : bind.bolaD;
        paraLocal(T, 0, bola[0] - tx, bola[1] - ty, bola[2] - tz, C.bola, lado * 3);
        C.pa[lado] = Math.hypot(bola[0] - tx, bola[1] - ty, bola[2] - tz);
        C.pb[lado] = Math.hypot(pp[ipp] - bola[0], pp[ipp + 1] - bola[1], pp[ipp + 2] - bola[2]);
        C.linha[lado] = ll;
      }
      const bx = C.bola[lado * 3], by = C.bola[lado * 3 + 1], bz = C.bola[lado * 3 + 2];
      A[12] = tx; A[13] = ty; A[14] = tz;
      if (ajuste) {
        // pé + dedos até a ponta da pose (polo = o lado para onde a bola sai da linha no repouso); a ponta além do
        // alcance (o goleiro no ar com o pé esticado: a ponta da pose chega a ~0,23 m do tornozelo) estica o pé até
        // ESTICA_PE
        // a ponta perto demais (a trava da ponta no chão encolhe o pé da pose do goleiro deitado até ~9 cm): os dedos
        // dobram no máximo DEDOS_MAX e o pé aponta para a ponta da pose (não dá para ter um pé de 9 cm)
        const pa = C.pa[lado], pb = C.pb[lado];
        const dmin = Math.sqrt(pa * pa + pb * pb + 2 * pa * pb * COS_DEDOS);
        const lc = ll < dmin ? dmin : ll;
        A[15] = tx + lx / ll * lc; A[16] = ty + lyy / ll * lc; A[17] = tz + lz / ll * lc;
        const alc = pa + pb, ep = ll > alc ? Math.min(ESTICA_PE, ll / alc) : 1;
        S[bq + 2] = ep; S[bq + 3] = ep;
        V[3] = T[3] * bx + T[5] * bz; V[4] = T[6] * bx + T[8] * bz; V[5] = T[9] * bx + T[11] * bz;
        V[12] = C.pa[lado] * ep; V[13] = C.pb[lado] * ep;
        ik2(A, 12, 15, 18, 21);
      } else {
        // rígido: a bola e a ponta de repouso no quadro da linha
        V[9] = bx; V[10] = by; V[11] = bz;
        pontoLocal(T, 0, A, 18);
        const Lr = C.linha[lado];
        A[21] = tx + lx / ll * Lr; A[22] = ty + lyy / ll * Lr; A[23] = tz + lz / ll * Lr;
      }
      // pé e dedos: Y pela direção, Z de referência = o "cima" da linha (reserva: o Y da linha)
      F[ope] = tx; F[ope + 1] = ty; F[ope + 2] = tz;
      V[0] = A[18] - tx; V[1] = A[19] - ty; V[2] = A[20] - tz;
      V[3] = T[5]; V[4] = T[8]; V[5] = T[11];
      V[6] = T[4]; V[7] = T[7]; V[8] = T[10];
      quadroYZ(F, ope);
      F[od] = A[18]; F[od + 1] = A[19]; F[od + 2] = A[20];
      V[0] = A[21] - A[18]; V[1] = A[22] - A[19]; V[2] = A[23] - A[20];
      quadroYZ(F, od);
      for (let q = 0; q < 3; q++) { JF[iq + q] = A[q]; JF[ij + q] = A[6 + q]; JF[it + q] = A[9 + q]; JF[ipp + q] = A[21 + q]; }
    }
    // ---- auxiliares: na junta; o quadro de cima levado (rotação mínima) até a direção a 1/3 e a 2/3 do caminho entre
    // as direções dos dois ossos (interpolação esférica); engordam na largura conforme a junta dobra além do repouso
    // (a carne do lado de dentro da dobra é apertada contra a junta: os "volume helpers" dos jogos)
    for (let k = 0; k < AUXILIARES.length; k++) {
      const AX = AUXILIARES[k], oa = AX[0] * 12, ocm = AX[1] * 12, obx = AX[2] * 12, f = AX[3];
      F[oa] = F[obx]; F[oa + 1] = F[obx + 1]; F[oa + 2] = F[obx + 2];
      const ax = F[ocm + 4], ay = F[ocm + 7], az = F[ocm + 10], bx = F[obx + 4], by = F[obx + 7], bz = F[obx + 10];
      let c = ax * bx + ay * by + az * bz;
      c = c < -1 ? -1 : c > 1 ? 1 : c;
      const om = Math.acos(c), so = Math.sin(om);
      let ka = 1 - f, kb = f;
      if (so > 1e-6) { ka = Math.sin((1 - f) * om) / so; kb = Math.sin(f * om) / so; }
      V[0] = ax * ka + bx * kb; V[1] = ay * ka + by * kb; V[2] = az * ka + bz * kb;
      transportar(F, oa, ocm);
      S[AX[0]] = 1;
      if (repouso) C.dobra[k] = c;
      const inc = C.dobra[k] - c;
      SL[AX[0]] = inc > 0 ? 1 + INCHA * inc : 1;
    }
  }

  // repouso: comprimentos, pontos locais e os quadros de repouso (a mesma conta)
  for (let i = 0; i < NJ * 3; i++) P[i] = bind.pose[i];
  montar(P, true);
  repouso = false;
  Fb.set(F);

  const esq = {
    /** Quadros finais (h + R por osso, R por linhas com colunas X, Y, Z) da última conta. */
    quadros: F,
    /** Quadros de repouso. */
    quadrosRepouso: Fb,
    /** Escala no comprimento (tronco, braço, pé) da última conta. */
    escalas: S,
    /** Escala na largura (auxiliares) da última conta. */
    escalasLargura: SL,
    /** Juntas finais do esqueleto (19 × 3, a ordem de anim.js JUNTAS) da última conta. */
    juntas: JF,
    comprimentos: C,
    bind,
    /**
     * Pose (57 floats, no mundo) → matrizes de pele 3×4 dos ossos em out[off ..] (12 floats por osso, por linhas: cada
     * linha com a translação no 4º valor). opc.ajuste (padrão true) = o ajuste final (IK de pés e mãos).
     */
    calcular(pose, out, off = 0, opc) {
      const ajuste = !opc || opc.ajuste !== false;
      for (let i = 0; i < NJ * 3; i++) P[i] = pose[i];
      montar(P, ajuste);
      if (out) escreverPele(F, Fb, S, SL, out, off);
      return esq;
    },
  };
  return esq;
}

/**
 * Matriz de pele de cada osso: M = Rp · diag(sl, s, sl) · Rbᵀ (s = escala no comprimento; sl = na largura) e
 * t = hp − M · hb, por linhas (3 linhas × [m0, m1, m2, t]).
 */
export function escreverPele(F, Fb, S, SL, out, off) {
  for (let b = 0; b < NO; b++) {
    const o = b * 12, r = o + 3, s = S[b], sl = SL[b];
    const q = off + b * 12;
    for (let i = 0; i < 3; i++) {
      const p0 = F[r + i * 3] * sl, p1 = F[r + i * 3 + 1] * s, p2 = F[r + i * 3 + 2] * sl;
      const m0 = p0 * Fb[r] + p1 * Fb[r + 1] + p2 * Fb[r + 2];
      const m1 = p0 * Fb[r + 3] + p1 * Fb[r + 4] + p2 * Fb[r + 5];
      const m2 = p0 * Fb[r + 6] + p1 * Fb[r + 7] + p2 * Fb[r + 8];
      const w = q + i * 4;
      out[w] = m0; out[w + 1] = m1; out[w + 2] = m2;
      out[w + 3] = F[o + i] - (m0 * Fb[o] + m1 * Fb[o + 1] + m2 * Fb[o + 2]);
    }
  }
}
