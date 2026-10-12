// Esqueleto do corpo humano (Etapa 5.1): a pose de 19 juntas que a animação pura já calcula (anim.js) vira os 22
// ossos do corpo (matrizes de pele 3×4, uma linha da textura de ossos por jogador) e as juntas FINAIS do esqueleto
// (o que o jogador vê; os testes comparam com a pose). PURO: sem three.js nem DOM, e sem alocar nada por quadro.
//
// Como (PESQUISA-ETAPA5.md §2):
//  1) Retarget por DIREÇÃO dos ossos (ossos rígidos do corpo; D. Holden): cada osso aponta da junta da pose para a
//     junta seguinte; a torção sai da linha dos ombros/quadris (tronco), da direção em que o cotovelo/joelho dobra
//     (braço, coxa; com reserva pela frente do corpo) e do "cima" do mundo (pé: a sola fica plana no apoio). O tronco
//     (lombar, peito, tórax) segue as juntas exatas da pose com escala no comprimento (a pose encurta até 1% com o
//     tronco inclinado para a frente e para o lado); a pelve sai da linha dos quadris e do ponto da pelve, então o
//     quadril cai exatamente onde a simulação o pôs.
//  2) Ajuste final (IK de duas juntas, "Simple Two Joint IK", Holden): perna até o tornozelo da pose (o pé apoiado
//     fica no ponto plantado), braço até a mão da pose (goleiro, lateral e todos os outros) e pé + dedos até a ponta
//     da pose (os dedos dobram para cima quando a ponta fica mais perto, como no arranque). Sem o ajuste (opc.ajuste
//     = false, o controle do teste-esqueleto) o corpo é só o retarget com ossos rígidos: na pose interpolada entre
//     dois passos o tornozelo de quem está apoiado treme alguns milímetros e a ponta erra até ~3 cm.
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
  // auxiliares das juntas que mais dobram (joelho e cotovelo): dois por junta, na junta, girando 1/3 e 2/3 da dobra. A
  // pele linear sozinha "murcha" a junta dobrada (entre dois ossos girados de θ a pele encolhe por cos(θ/2): metade do
  // volume a 120°); com os auxiliares, cada trecho da rampa de pesos gira só θ/3 (a ideia dos "helper joints" dos jogos)
  'joelhoE1', 'joelhoE2', 'joelhoD1', 'joelhoD2', 'cotoveloE1', 'cotoveloE2', 'cotoveloD1', 'cotoveloD2',
];
export const NO = OSSOS.length;
export const O = Object.fromEntries(OSSOS.map((n, i) => [n, i]));
/** Pai de cada osso (hierarquia do corpo; a conta posiciona cada osso pela regra dele). */
export const PAI = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 0, 14, 15, 16, 0, 18, 19, 20, 14, 14, 18, 18, 7, 7, 11, 11];
/** Os 22 ossos do corpo (o resto são os 4 auxiliares das juntas). */
export const NO_CORPO = 22;
/** Auxiliares: [osso auxiliar, osso de cima, osso de baixo, fração da dobra] (na cabeça do osso de baixo). */
export const AUXILIARES = [[22, 14, 15, 1 / 3], [23, 14, 15, 2 / 3], [24, 18, 19, 1 / 3], [25, 18, 19, 2 / 3],
  [26, 7, 8, 1 / 3], [27, 7, 8, 2 / 3], [28, 11, 12, 1 / 3], [29, 11, 12, 2 / 3]];
/** Floats por jogador na textura de ossos: 3 texels RGBA por osso (matriz 3×4) + 1 texel de dados do jogador. */
export const FLOATS_POR_JOGADOR = NO * 12 + 4;

// tronco: [osso, junta de baixo, junta de cima, peso da linha dos quadris na torção (o resto é a dos ombros)]
const TRONCO_OSSO = [1, 2, 3];
const TRONCO_A = [J.pelve, J.lombar, J.peito];
const TRONCO_B = [J.lombar, J.peito, J.pescoco];
const TRONCO_WQ = [2 / 3, 1 / 3, 0];
const LADO_BRACO = [[6, J.ombroE, J.cotoveloE, J.maoE], [10, J.ombroD, J.cotoveloD, J.maoD]];
const LADO_PERNA = [[14, J.quadrilE, J.joelhoE, J.tornozeloE, J.pontaE], [18, J.quadrilD, J.joelhoD, J.tornozeloD, J.pontaD]];

/**
 * Quadro com o eixo Y dado e o Z de referência (ortogonalizado; reserva f se ficar degenerado). Escreve R (9 valores
 * por linhas; colunas = X, Y, Z) em F[o + 3 ..].
 */
function quadroYZ(F, o, yx, yy, yz, zx, zy, zz, fx, fy, fz) {
  let l = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1;
  yx /= l; yy /= l; yz /= l;
  let d = zx * yx + zy * yy + zz * yz;
  let ax = zx - d * yx, ay = zy - d * yy, az = zz - d * yz;
  l = Math.sqrt(ax * ax + ay * ay + az * az);
  if (l < 1e-6) { d = fx * yx + fy * yy + fz * yz; ax = fx - d * yx; ay = fy - d * yy; az = fz - d * yz; l = Math.sqrt(ax * ax + ay * ay + az * az) || 1; }
  ax /= l; ay /= l; az /= l;
  const xx = yy * az - yz * ay, xy = yz * ax - yx * az, xz = yx * ay - yy * ax; // X = Y × Z
  const r = o + 3;
  F[r] = xx; F[r + 1] = yx; F[r + 2] = ax;
  F[r + 3] = xy; F[r + 4] = yy; F[r + 5] = ay;
  F[r + 6] = xz; F[r + 7] = yz; F[r + 8] = az;
}
/** Quadro com o eixo Y dado e o X de referência (ortogonalizado). */
function quadroYX(F, o, yx, yy, yz, xx, xy, xz) {
  let l = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1;
  yx /= l; yy /= l; yz /= l;
  const d = xx * yx + xy * yy + xz * yz;
  xx -= d * yx; xy -= d * yy; xz -= d * yz;
  l = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
  xx /= l; xy /= l; xz /= l;
  const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx; // Z = X × Y
  const r = o + 3;
  F[r] = xx; F[r + 1] = yx; F[r + 2] = zx;
  F[r + 3] = xy; F[r + 4] = yy; F[r + 5] = zy;
  F[r + 6] = xz; F[r + 7] = yz; F[r + 8] = zz;
}
/** Leva um vetor (vx, vy, vz) pela rotação mínima a → b: R v = v c + w × v + w (w·v)/(1 + c), w = a × b. */
function girarMin(F, rd, col, vx, vy, vz, c, wx, wy, wz, k) {
  const wv = wx * vx + wy * vy + wz * vz;
  F[rd + col] = vx * c + (wy * vz - wz * vy) + wx * wv * k;
  F[rd + 3 + col] = vy * c + (wz * vx - wx * vz) + wy * wv * k;
  F[rd + 6 + col] = vz * c + (wx * vy - wy * vx) + wz * wv * k;
}
/** Quadro de destino = o quadro de origem levado pela rotação mínima do Y dele até y (sem torção nova). */
function transportar(F, oDst, oSrc, yx, yy, yz) {
  const l = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1;
  yx /= l; yy /= l; yz /= l;
  const r = oSrc + 3, rd = oDst + 3;
  const ax = F[r + 1], ay = F[r + 4], az = F[r + 7];
  const c = ax * yx + ay * yy + az * yz;
  const wx = ay * yz - az * yy, wy = az * yx - ax * yz, wz = ax * yy - ay * yx;
  const k = 1 / Math.max(1e-9, 1 + c);
  girarMin(F, rd, 0, F[r], F[r + 3], F[r + 6], c, wx, wy, wz, k);
  girarMin(F, rd, 2, F[r + 2], F[r + 5], F[r + 8], c, wx, wy, wz, k);
  F[rd + 1] = yx; F[rd + 4] = yy; F[rd + 7] = yz;
}
function copiarR(F, oDst, oSrc) { for (let i = 3; i < 12; i++) F[oDst + i] = F[oSrc + i]; }
/** out[oo..] = h + R · (lx, ly, lz) do quadro em F[o..]. */
function pontoLocal(F, o, lx, ly, lz, out, oo) {
  const r = o + 3;
  out[oo] = F[o] + F[r] * lx + F[r + 1] * ly + F[r + 2] * lz;
  out[oo + 1] = F[o + 1] + F[r + 3] * lx + F[r + 4] * ly + F[r + 5] * lz;
  out[oo + 2] = F[o + 2] + F[r + 6] * lx + F[r + 7] * ly + F[r + 8] * lz;
}
/** Vetor (vx, vy, vz) do mundo no quadro em F[o..] → out[oo..] (Rᵀ v). */
function paraLocal(F, o, vx, vy, vz, out, oo) {
  const r = o + 3;
  out[oo] = F[r] * vx + F[r + 3] * vy + F[r + 6] * vz;
  out[oo + 1] = F[r + 1] * vx + F[r + 4] * vy + F[r + 7] * vz;
  out[oo + 2] = F[r + 2] * vx + F[r + 5] * vy + F[r + 8] * vz;
}

/**
 * IK de duas juntas: base em A[ia], alvo em A[it], ossos L1 e L2, polo (para onde a junta do meio vai). Escreve a
 * junta do meio em A[im] e a ponta em A[ie] (= o alvo, se alcança).
 */
function ik2(A, ia, it, L1, L2, px, py, pz, im, ie) {
  let dx = A[it] - A[ia], dy = A[it + 1] - A[ia + 1], dz = A[it + 2] - A[ia + 2];
  const d0 = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
  dx /= d0; dy /= d0; dz /= d0;
  const d = Math.min(Math.max(d0, Math.abs(L1 - L2) + 1e-6), (L1 + L2) * 0.99999);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pd = px * dx + py * dy + pz * dz;
  let qx = px - pd * dx, qy = py - pd * dy, qz = pz - pd * dz;
  const ql = Math.sqrt(qx * qx + qy * qy + qz * qz);
  if (ql < 1e-12) { qx = 0; qy = 0; qz = 0; } else { qx /= ql; qy /= ql; qz /= ql; }
  A[im] = A[ia] + dx * a + qx * hh; A[im + 1] = A[ia + 1] + dy * a + qy * hh; A[im + 2] = A[ia + 2] + dz * a + qz * hh;
  A[ie] = A[ia] + dx * d; A[ie + 1] = A[ia + 1] + dy * d; A[ie + 2] = A[ia + 2] + dz * d;
}

/** Quanto os auxiliares engordam por (cos da dobra de repouso − cos da dobra): 0,07 → +10% a 120° no joelho. */
export const INCHA = 0.07;

function suave(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function dist(pp, a, b) { return Math.hypot(pp[a * 3] - pp[b * 3], pp[a * 3 + 1] - pp[b * 3 + 1], pp[a * 3 + 2] - pp[b * 3 + 2]); }

/**
 * Cria o esqueleto a partir da pose de repouso do corpo. bind = {pose: 57 floats (19 juntas na pose A),
 * cabecaBase: [x,y,z], bolaE: [x,y,z], bolaD: [x,y,z]} (do arquivo do corpo, render/corpo-leitor.js).
 * Devolve {calcular(pose, out, off, opc), juntas, quadros, quadrosRepouso, escalas, comprimentos, bind}.
 */
export function criarEsqueleto(bind) {
  const P = new Float64Array(NJ * 3);       // a pose que entra
  const JF = new Float64Array(NJ * 3);      // juntas finais do esqueleto
  const A = new Float64Array(24);           // pontos de rascunho do IK
  const T = new Float64Array(12);           // quadro "da linha" do pé (h + R)
  const F = new Float64Array(NO * 12);      // quadros finais: h (3) + R (9) por osso
  const S = new Float64Array(NO);           // escala no comprimento (tronco)
  const SL = new Float64Array(NO).fill(1);  // escala na largura (auxiliares das juntas: o volume da dobra)
  const Fb = new Float64Array(NO * 12);     // quadros de repouso
  // medidas da pose de repouso (comprimentos e pontos locais), por índice (nada é procurado por nome no quadro)
  const C = {
    tronco: new Float64Array(3), pesc: 0, cab: new Float64Array(3), kClav: 0,
    clav: new Float64Array(2), braco: new Float64Array(2), ante: new Float64Array(2),
    quad: new Float64Array(6), coxa: new Float64Array(2), canela: new Float64Array(2),
    bola: new Float64Array(6), pa: new Float64Array(2), pb: new Float64Array(2), linha: new Float64Array(2),
    dobra: new Float64Array(AUXILIARES.length),
  };
  const g = (pp, j, k) => pp[j * 3 + k];
  let repouso = true;

  function montar(pp, ajuste) {
    // linhas dos quadris e dos ombros (E − D), normalizadas
    let hx = g(pp, J.quadrilE, 0) - g(pp, J.quadrilD, 0), hy = g(pp, J.quadrilE, 1) - g(pp, J.quadrilD, 1), hz = g(pp, J.quadrilE, 2) - g(pp, J.quadrilD, 2);
    let l = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1; hx /= l; hy /= l; hz /= l;
    let sx = g(pp, J.ombroE, 0) - g(pp, J.ombroD, 0), sy = g(pp, J.ombroE, 1) - g(pp, J.ombroD, 1), sz = g(pp, J.ombroE, 2) - g(pp, J.ombroD, 2);
    l = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx /= l; sy /= l; sz /= l;
    // ---- pelve: X = linha dos quadris, Y = da média dos quadris até a pelve (o quadril sai exato)
    const ip = J.pelve * 3;
    const mx = (g(pp, J.quadrilE, 0) + g(pp, J.quadrilD, 0)) / 2, my = (g(pp, J.quadrilE, 1) + g(pp, J.quadrilD, 1)) / 2, mz = (g(pp, J.quadrilE, 2) + g(pp, J.quadrilD, 2)) / 2;
    F[0] = pp[ip]; F[1] = pp[ip + 1]; F[2] = pp[ip + 2];
    quadroYX(F, 0, pp[ip] - mx, pp[ip + 1] - my, pp[ip + 2] - mz, hx, hy, hz);
    S[0] = 1;
    // ---- tronco: as juntas exatas da pose (escala no comprimento); torção dos quadris para os ombros
    for (let k = 0; k < 3; k++) {
      const b = TRONCO_OSSO[k], o = b * 12, ia = TRONCO_A[k] * 3, ib = TRONCO_B[k] * 3, wq = TRONCO_WQ[k];
      F[o] = pp[ia]; F[o + 1] = pp[ia + 1]; F[o + 2] = pp[ia + 2];
      const dx = pp[ib] - pp[ia], dy = pp[ib + 1] - pp[ia + 1], dz = pp[ib + 2] - pp[ia + 2];
      quadroYX(F, o, dx, dy, dz, hx * wq + sx * (1 - wq), hy * wq + sy * (1 - wq), hz * wq + sz * (1 - wq));
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (repouso) C.tronco[k] = len;
      S[b] = len / C.tronco[k];
    }
    // ---- pescoço (rígido, apontando para a cabeça da pose) e cabeça (continua o pescoço)
    const i4 = J.pescoco * 3, ic = J.cabeca * 3, o4 = 48;
    F[o4] = pp[i4]; F[o4 + 1] = pp[i4 + 1]; F[o4 + 2] = pp[i4 + 2];
    quadroYX(F, o4, pp[ic] - pp[i4], pp[ic + 1] - pp[i4 + 1], pp[ic + 2] - pp[i4 + 2], sx, sy, sz);
    S[4] = 1;
    if (repouso) {
      C.pesc = Math.hypot(pp[ic] - pp[i4], pp[ic + 1] - pp[i4 + 1], pp[ic + 2] - pp[i4 + 2]);
      paraLocal(F, o4, bind.cabecaBase[0] - pp[i4], bind.cabecaBase[1] - pp[i4 + 1], bind.cabecaBase[2] - pp[i4 + 2], C.cab, 0);
    }
    pontoLocal(F, o4, C.cab[0], C.cab[1], C.cab[2], F, 60);
    copiarR(F, 60, o4);
    S[5] = 1;
    pontoLocal(F, o4, 0, C.pesc, 0, JF, ic);
    for (let k = 0; k < 3; k++) { JF[ip + k] = F[k]; JF[J.lombar * 3 + k] = F[24 + k]; JF[J.peito * 3 + k] = F[36 + k]; JF[i4 + k] = F[48 + k]; }
    // ---- braços
    const ipe = J.peito * 3;
    if (repouso) {
      const ce = (pp[J.ombroE * 3 + 1] + pp[J.ombroD * 3 + 1]) / 2 - pp[ipe + 1];
      C.kClav = ce / (pp[i4 + 1] - pp[ipe + 1]); // a clavícula sai do eixo do tronco, na altura dos ombros
    }
    const r3 = 36 + 3; // quadro do tórax (frente = coluna Z, cima = coluna Y)
    for (let lado = 0; lado < 2; lado++) {
      const LB = LADO_BRACO[lado], bc = LB[0], jO = LB[1], jC = LB[2], jM = LB[3];
      const oc = bc * 12, ob = oc + 12, oa = oc + 24, om = oc + 36;
      const k = C.kClav;
      F[oc] = pp[ipe] + (pp[i4] - pp[ipe]) * k; F[oc + 1] = pp[ipe + 1] + (pp[i4 + 1] - pp[ipe + 1]) * k; F[oc + 2] = pp[ipe + 2] + (pp[i4 + 2] - pp[ipe + 2]) * k;
      const ioo = jO * 3, icc = jC * 3, imm = jM * 3;
      const cx = pp[ioo] - F[oc], cy = pp[ioo + 1] - F[oc + 1], cz = pp[ioo + 2] - F[oc + 2];
      quadroYZ(F, oc, cx, cy, cz, F[r3 + 2], F[r3 + 5], F[r3 + 8], F[r3 + 1], F[r3 + 4], F[r3 + 7]);
      if (repouso) { C.clav[lado] = Math.sqrt(cx * cx + cy * cy + cz * cz); C.braco[lado] = dist(pp, jO, jC); C.ante[lado] = dist(pp, jC, jM); }
      S[bc] = 1; S[bc + 1] = 1; S[bc + 2] = 1; S[bc + 3] = 1;
      pontoLocal(F, oc, 0, C.clav[lado], 0, A, 0); // ombro = ponta da clavícula
      const L1 = C.braco[lado], L2 = C.ante[lado];
      if (ajuste) {
        // IK até a mão da pose; polo = o cotovelo da pose
        A[3] = pp[imm]; A[4] = pp[imm + 1]; A[5] = pp[imm + 2];
        ik2(A, 0, 3, L1, L2, pp[icc] - pp[ioo], pp[icc + 1] - pp[ioo + 1], pp[icc + 2] - pp[ioo + 2], 6, 9);
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
      quadroYZ(F, ob, yx, yy, yz,
        fx - d * yx + 0.15 * F[r3 + 2] + 0.05 * F[r3 + 1], fy - d * yy + 0.15 * F[r3 + 5] + 0.05 * F[r3 + 4], fz - d * yz + 0.15 * F[r3 + 8] + 0.05 * F[r3 + 7],
        F[r3 + 1], F[r3 + 4], F[r3 + 7]);
      // antebraço: o quadro do braço levado pela rotação mínima até a direção do antebraço; mão: continua o antebraço
      F[oa] = A[6]; F[oa + 1] = A[7]; F[oa + 2] = A[8];
      transportar(F, oa, ob, fx, fy, fz);
      F[om] = A[9]; F[om + 1] = A[10]; F[om + 2] = A[11];
      copiarR(F, om, oa);
      for (let q = 0; q < 3; q++) { JF[ioo + q] = A[q]; JF[icc + q] = A[6 + q]; JF[imm + q] = A[9 + q]; }
    }
    // ---- pernas
    for (let lado = 0; lado < 2; lado++) {
      const LP = LADO_PERNA[lado], bq = LP[0], jQ = LP[1], jJ = LP[2], jT = LP[3], jP = LP[4];
      const oq = bq * 12, oc = oq + 12, ope = oq + 24, od = oq + 36;
      const iq = jQ * 3, ij = jJ * 3, it = jT * 3, ipp = jP * 3;
      if (repouso) {
        paraLocal(F, 0, pp[iq] - F[0], pp[iq + 1] - F[1], pp[iq + 2] - F[2], C.quad, lado * 3);
        C.coxa[lado] = dist(pp, jQ, jJ); C.canela[lado] = dist(pp, jJ, jT);
      }
      S[bq] = 1; S[bq + 1] = 1; S[bq + 2] = 1; S[bq + 3] = 1;
      pontoLocal(F, 0, C.quad[lado * 3], C.quad[lado * 3 + 1], C.quad[lado * 3 + 2], A, 0); // quadril no quadro da pelve
      const L1 = C.coxa[lado], L2 = C.canela[lado];
      if (ajuste) {
        A[3] = pp[it]; A[4] = pp[it + 1]; A[5] = pp[it + 2];
        ik2(A, 0, 3, L1, L2, pp[ij] - pp[iq], pp[ij + 1] - pp[iq + 1], pp[ij + 2] - pp[iq + 2], 6, 9);
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
      quadroYZ(F, oq, yx, yy, yz,
        -(fx - d * yx) + 0.15 * pfx + 0.05 * F[5], -(fy - d * yy) + 0.05 * F[8], -(fz - d * yz) + 0.15 * pfz + 0.05 * F[11],
        F[5], F[8], F[11]);
      F[oc] = A[6]; F[oc + 1] = A[7]; F[oc + 2] = A[8];
      transportar(F, oc, oq, fx, fy, fz);
      // pé: quadro "da linha" (tornozelo final → ponta da pose; "cima" do pé = cima do mundo para a sola ficar plana;
      // com o pé quase de pé, mistura com a frente da canela)
      const tx = A[9], ty = A[10], tz = A[11];
      const lx = pp[ipp] - tx, lyy = pp[ipp + 1] - ty, lz = pp[ipp + 2] - tz;
      const ll = Math.sqrt(lx * lx + lyy * lyy + lz * lz) || 1;
      const kv = suave(0.75, 0.95, Math.abs(lyy / ll));
      const rc = oc + 3;
      T[0] = tx; T[1] = ty; T[2] = tz;
      quadroYZ(T, 0, lx, lyy, lz, F[rc + 2] * kv, 1 - kv + F[rc + 5] * kv, F[rc + 8] * kv, F[rc + 2], F[rc + 5], F[rc + 8]);
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
        // pé + dedos até a ponta da pose (polo = o lado para onde a bola sai da linha no repouso)
        A[15] = pp[ipp]; A[16] = pp[ipp + 1]; A[17] = pp[ipp + 2];
        const r = 3;
        ik2(A, 12, 15, C.pa[lado], C.pb[lado],
          T[r] * bx + T[r + 2] * bz, T[r + 3] * bx + T[r + 5] * bz, T[r + 6] * bx + T[r + 8] * bz, 18, 21);
      } else {
        // rígido: a bola e a ponta de repouso no quadro da linha
        pontoLocal(T, 0, bx, by, bz, A, 18);
        const Lr = C.linha[lado];
        A[21] = tx + lx / ll * Lr; A[22] = ty + lyy / ll * Lr; A[23] = tz + lz / ll * Lr;
      }
      F[ope] = tx; F[ope + 1] = ty; F[ope + 2] = tz;
      quadroYZ(F, ope, A[18] - tx, A[19] - ty, A[20] - tz, T[5], T[8], T[11], T[4], T[7], T[10]);
      F[od] = A[18]; F[od + 1] = A[19]; F[od + 2] = A[20];
      quadroYZ(F, od, A[21] - A[18], A[22] - A[19], A[23] - A[20], T[5], T[8], T[11], T[4], T[7], T[10]);
      for (let q = 0; q < 3; q++) { JF[iq + q] = A[q]; JF[ij + q] = A[6 + q]; JF[it + q] = A[9 + q]; JF[ipp + q] = A[21 + q]; }
    }
    // ---- auxiliares: na junta; o quadro de cima levado (rotação mínima) até a direção a 1/3 e a 2/3 do caminho entre
    // as direções dos dois ossos (interpolação esférica)
    for (let k = 0; k < AUXILIARES.length; k++) {
      const AX = AUXILIARES[k], oa = AX[0] * 12, ocm = AX[1] * 12, obx = AX[2] * 12, f = AX[3];
      F[oa] = F[obx]; F[oa + 1] = F[obx + 1]; F[oa + 2] = F[obx + 2];
      const ax = F[ocm + 4], ay = F[ocm + 7], az = F[ocm + 10], bx = F[obx + 4], by = F[obx + 7], bz = F[obx + 10];
      const c = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz)), om = Math.acos(c), so = Math.sin(om);
      let ka = 1 - f, kb = f;
      if (so > 1e-6) { ka = Math.sin((1 - f) * om) / so; kb = Math.sin(f * om) / so; }
      transportar(F, oa, ocm, ax * ka + bx * kb, ay * ka + by * kb, az * ka + bz * kb);
      S[AX[0]] = 1;
      // volume: a carne do lado de dentro da dobra é apertada contra a junta; os auxiliares engordam um pouco (na
      // largura, nunca no comprimento) conforme a junta dobra além do repouso — como os "volume helpers" dos jogos
      if (repouso) C.dobra[k] = c;
      SL[AX[0]] = 1 + INCHA * Math.max(0, C.dobra[k] - c);
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
    /** Escala no comprimento (tronco) da última conta. */
    escalas: S,
    escalasLargura: SL,
    /** Juntas finais do esqueleto (19 × 3, a ordem de anim.js JUNTAS) da última conta. */
    juntas: JF,
    comprimentos: C,
    bind,
    /**
     * Pose (57 floats, no mundo) → matrizes de pele 3×4 dos 22 ossos em out[off ..] (12 floats por osso, por linhas:
     * cada linha com a translação no 4º valor). opc.ajuste (padrão true) = o ajuste final (IK de pés e mãos).
     */
    calcular(pose, out, off = 0, opc) {
      const ajuste = !opc || opc.ajuste !== false;
      for (let i = 0; i < NJ * 3; i++) P[i] = pose[i];
      montar(P, ajuste);
      if (out) escreverPele(F, Fb, S, out, off, SL);
      return esq;
    },
  };
  return esq;
}

/**
 * Matriz de pele de cada osso: M = Rp · diag(sl, s, sl) · Rbᵀ (s = escala no comprimento do tronco; sl = na largura dos
 * auxiliares) e t = hp − M · hb, por linhas (3 linhas × [m0, m1, m2, t]).
 */
export function escreverPele(F, Fb, S, out, off, SL) {
  for (let b = 0; b < NO; b++) {
    const o = b * 12, r = o + 3, s = S[b], sl = SL ? SL[b] : 1;
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

/** Aplica a matriz de pele 3×4 (em m[q..q+11]) ao ponto (x, y, z) → r[ro..ro+2]. */
export function aplicarPele(m, q, x, y, z, r, ro) {
  r[ro] = m[q] * x + m[q + 1] * y + m[q + 2] * z + m[q + 3];
  r[ro + 1] = m[q + 4] * x + m[q + 5] * y + m[q + 6] * z + m[q + 7];
  r[ro + 2] = m[q + 8] * x + m[q + 9] * y + m[q + 10] * z + m[q + 11];
}
