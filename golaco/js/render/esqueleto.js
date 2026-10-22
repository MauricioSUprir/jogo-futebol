// Esqueleto do corpo humano (Etapa 5) a partir das 19 juntas da pose do jogo (anim.js). SÓ DESENHO: está fora do passo
// da simulação (nada daqui entra no hash; tools/fecho-hash.mjs confere). Puro: sem three.js nem DOM, sem alocar por quadro.
// Para cada boneco, escreve as matrizes de PELE (3×4 por linhas: 12 floats por osso) dos 25 ossos — os 19 principais e
// os 6 ajudantes de meio-giro — que o shader da pele lê (render/humano3d.js; o mesmo cálculo roda em Node nos testes).
//
// Como cada osso sai das juntas (protótipo medido na pesquisa da Etapa 5, v3: 86 saltos > 40° em 316.664 amostras):
//  - tronco e cabeça pelas LINHAS do corpo: X = quadril E→D / ombro E→D (a lombar com a média das duas: a torção do
//    tronco dividida), Y = a coluna. Bem definido em qualquer pose, também deitado (o mergulho do goleiro);
//  - membros: BALANÇO = o menor arco que leva o eixo "parado em relação ao pai" (o do descanso) ao de agora; TORÇÃO só da
//    coxa e do braço, pelo plano da dobra do joelho/cotovelo, misturada à referência de reta quando o membro está quase
//    reto (na perna, pé × membro: o joelho aponta para onde o pé aponta). O menor arco só degenera com o membro invertido
//    em relação ao pai (impossível no joelho, no cotovelo, no pé e no quadril);
//  - ajudantes (joelho, cotovelo e quadril): o meio caminho (nlerp) entre as rotações de pele do osso de cima e do de
//    baixo, levando a junta do descanso à de agora: a dobra não murcha (tools/humano/pesos.py dá a eles o peso de perto);
//  - escala ao longo do osso = |B − A| ÷ o do descanso, limitada a [0,9; 1,1].
// O OMBRO do desenho fica `queda` abaixo (inteira com o braço solto, nada com ele erguido) e `abre` para fora do ombro do
// jogo, no referencial do peito (o "ombro" do jogo
// está acima da articulação de verdade; tools/humano/encaixar.py encaixa a malha com as mesmas constantes, gravadas no
// repouso.json), e o COTOVELO do desenho sai de uma IK com esse ombro, a MÃO do jogo (as luvas na bola) e o lado da
// dobra do braço do jogo. O TORNOZELO do desenho fica `sobeTornozelo` acima do do jogo, ao longo da canela (o pé do
// Rocketbox gira 11,8 cm acima da sola; o do jogo apoiado, a 8 cm).
// Coordenadas do jogo: x = comprimento, z = largura, y para cima (as mesmas da pose).

export const JUNTAS_ESQ = [
  'pelve', 'lombar', 'peito', 'pescoco', 'cabeca',
  'ombroE', 'cotoveloE', 'maoE', 'ombroD', 'cotoveloD', 'maoD',
  'quadrilE', 'joelhoE', 'tornozeloE', 'pontaE',
  'quadrilD', 'joelhoD', 'tornozeloD', 'pontaD',
];
const JE = Object.fromEntries(JUNTAS_ESQ.map((n, i) => [n, i]));
const NJE = JUNTAS_ESQ.length;
/** [junta da origem, junta do eixo Y (null = o referencial do pai na junta)] — 19 principais + 6 ajudantes. */
export const OSSOS = [
  ['pelve', 'lombar'], ['lombar', 'peito'], ['peito', 'pescoco'], ['pescoco', 'cabeca'], ['cabeca', null],
  ['peito', 'ombroE'], ['ombroE', 'cotoveloE'], ['cotoveloE', 'maoE'], ['maoE', null],
  ['peito', 'ombroD'], ['ombroD', 'cotoveloD'], ['cotoveloD', 'maoD'], ['maoD', null],
  ['quadrilE', 'joelhoE'], ['joelhoE', 'tornozeloE'], ['tornozeloE', 'pontaE'],
  ['quadrilD', 'joelhoD'], ['joelhoD', 'tornozeloD'], ['tornozeloD', 'pontaD'],
  ['joelhoE', null], ['joelhoD', null], ['cotoveloE', null], ['cotoveloD', null], ['quadrilE', null], ['quadrilD', null],
];
export const NOMES_OSSOS = [
  'pelve', 'lombar', 'peito', 'pescoco', 'cabeca', 'claviculaE', 'bracoE', 'antebracoE', 'maoE',
  'claviculaD', 'bracoD', 'antebracoD', 'maoD', 'coxaE', 'canelaE', 'peE', 'coxaD', 'canelaD', 'peD',
  'ajJoelhoE', 'ajJoelhoD', 'ajCotoveloE', 'ajCotoveloD', 'ajQuadrilE', 'ajQuadrilD',
];
export const NOSSOS = OSSOS.length;
export const PAI = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 2, 9, 10, 11, 0, 13, 14, 0, 16, 17, 14, 17, 7, 11, 0, 0];
export const N_PRINC = 19;
/** Ajudante h (19 + h): [osso de cima, osso de baixo]. */
export const AJ_PAR = [[13, 14], [16, 17], [6, 7], [10, 11], [0, 13], [0, 16]];
// membros: [osso, pai, junta da dobra (torção) ou -1, junta da ponta da dobra ou -1]
const MEMBROS = [
  [5, 2, -1, -1], [6, 2, JE.cotoveloE, JE.maoE], [7, 6, -1, -1],
  [9, 2, -1, -1], [10, 2, JE.cotoveloD, JE.maoD], [11, 10, -1, -1],
  [13, 0, JE.joelhoE, JE.tornozeloE], [14, 13, -1, -1], [15, 14, -1, -1],
  [16, 0, JE.joelhoD, JE.tornozeloD], [17, 16, -1, -1], [18, 17, -1, -1],
];
const ESC_MIN = 0.9, ESC_MAX = 1.1;
const sq = Math.sqrt;

/**
 * repouso: o JSON de tools/humano/encaixar.py ({queda, abre, braco, antebraco, juntas: {nome: [x, y, z]}}), com as juntas
 * do JOGO em pé. Devolve {pele(pose, out, off), juntasDesenho(pose, out), mundo(pose, out), bind}.
 */
export function criarEsqueleto(repouso) {
  const QUEDA = repouso.queda, ABRE = repouso.abre, L1 = repouso.braco, L2 = repouso.antebraco;
  const SOBE_TORN = repouso.sobeTornozelo ?? 0;
  const IA = new Int32Array(OSSOS.map(o => JE[o[0]]));
  const IB = new Int32Array(OSSOS.map(o => (o[1] ? JE[o[1]] : -1)));
  const rel = new Float64Array(NOSSOS * 9);      // rotação do filho no referencial do pai, no descanso (Rpᵀ·Rc)
  const compr = new Float64Array(NOSSOS);        // comprimento de cada osso no descanso (desenho)
  let temBind = false;
  const D = new Float64Array(NJE * 3);           // juntas do desenho do quadro
  const PG = new Float64Array(NJE * 3);          // as do JOGO do mesmo quadro (a torção da perna sai delas)
  const W = new Float64Array(NOSSOS * 12);       // matrizes de mundo do quadro
  const v = new Float64Array(3), u = new Float64Array(3), vg = new Float64Array(3), Rr = new Float64Array(9), Q = new Float64Array(9);
  const alvo = new Float64Array(3);
  const XQ = new Float64Array(3), XS = new Float64Array(3), XM = new Float64Array(3);
  const qa = new Float64Array(4), qb = new Float64Array(4);

  /** Juntas do desenho: a pose do jogo com o ombro descido/aberto no referencial do peito e o cotovelo pela IK. */
  function juntasDesenho(po, o) {
    for (let k = 0; k < NJE * 3; k++) { o[k] = po[k]; PG[k] = po[k]; }
    const p = JE.peito * 3, n = JE.pescoco * 3, e = JE.ombroE * 3, d = JE.ombroD * 3;
    let yx = po[n] - po[p], yy = po[n + 1] - po[p + 1], yz = po[n + 2] - po[p + 2];
    let l = sq(yx * yx + yy * yy + yz * yz) || 1e-9; yx /= l; yy /= l; yz /= l;
    let xx = po[d] - po[e], xy = po[d + 1] - po[e + 1], xz = po[d + 2] - po[e + 2];
    const dd = xx * yx + xy * yy + xz * yz; xx -= dd * yx; xy -= dd * yy; xz -= dd * yz;
    l = sq(xx * xx + xy * xy + xz * xz) || 1e-9; xx /= l; xy /= l; xz /= l;
    // a queda acompanha o braço: inteira com o braço solto (como no repouso), nenhuma com ele erguido — o ombro de
    // verdade sobe junto quando o braço sobe; com a queda fixa, a mão erguida ficava longe demais do ombro do desenho, o
    // cotovelo esticava e a torção do braço virava de uma vez
    const qe = QUEDA * elevacao(po, JE.ombroE, JE.cotoveloE, yx, yy, yz) / Q_REP, qd = QUEDA * elevacao(po, JE.ombroD, JE.cotoveloD, yx, yy, yz) / Q_REP;
    o[e] = po[e] - qe * yx - ABRE * xx; o[e + 1] = po[e + 1] - qe * yy - ABRE * xy; o[e + 2] = po[e + 2] - qe * yz - ABRE * xz;
    o[d] = po[d] - qd * yx + ABRE * xx; o[d + 1] = po[d + 1] - qd * yy + ABRE * xy; o[d + 2] = po[d + 2] - qd * yz + ABRE * xz;
    // para trás do peito (Z = X × Y): o cotovelo de um braço solto aponta para trás
    const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
    ikBraco(po, o, JE.ombroE, JE.cotoveloE, JE.maoE, zx - 0.35 * xx, zy - 0.35 * xy, zz - 0.35 * xz);
    ikBraco(po, o, JE.ombroD, JE.cotoveloD, JE.maoD, zx + 0.35 * xx, zy + 0.35 * xy, zz + 0.35 * xz);
    // o tornozelo do desenho: preso ao PÉ (o pé do Rocketbox gira mais alto que o do jogo), no referencial do pé — eixo
    // tornozelo→ponta e "cima" = a canela sem a parte ao longo do pé; com o pé apoiado, ele não sai do lugar quando a
    // canela inclina (a sola fica no chão)
    for (let p = 0; p < 2; p++) {
      const a = (p ? JE.joelhoD : JE.joelhoE) * 3, t = (p ? JE.tornozeloD : JE.tornozeloE) * 3, q = (p ? JE.pontaD : JE.pontaE) * 3;
      if (!temPeRep) { o[t] = po[t]; o[t + 1] = po[t + 1]; o[t + 2] = po[t + 2]; continue; }
      basePe(po, a, t, q);
      const k = p * 3;
      o[t] = po[t] + PE_REP[k] * BP[0] + PE_REP[k + 1] * BP[3] + PE_REP[k + 2] * BP[6];
      o[t + 1] = po[t + 1] + PE_REP[k] * BP[1] + PE_REP[k + 1] * BP[4] + PE_REP[k + 2] * BP[7];
      o[t + 2] = po[t + 2] + PE_REP[k] * BP[2] + PE_REP[k + 1] * BP[5] + PE_REP[k + 2] * BP[8];
    }
    return o;
  }
  // referencial do pé em BP: [eixo f (tornozelo→ponta), cima c, lado l = f × c]. "Cima" = o do MUNDO sem a parte ao longo
  // do pé (o pé apoiado fica de sola no chão, qualquer que seja a inclinação da canela); com o pé quase vertical (a ponta
  // para baixo, no chute), mistura com a canela
  const BP = new Float64Array(9), PE_REP = new Float64Array(6);
  let temPeRep = false;
  function basePe(po, a, t, q) {
    let fx = po[q] - po[t], fy = po[q + 1] - po[t + 1], fz = po[q + 2] - po[t + 2];
    let l = sq(fx * fx + fy * fy + fz * fz) || 1e-9; fx /= l; fy /= l; fz /= l;
    let ux = -fy * fx, uy = 1 - fy * fy, uz = -fy * fz;
    let lu = sq(ux * ux + uy * uy + uz * uz) || 1e-9; ux /= lu; uy /= lu; uz /= lu;
    let cx = po[a] - po[t], cy = po[a + 1] - po[t + 1], cz = po[a + 2] - po[t + 2];
    const d = cx * fx + cy * fy + cz * fz; cx -= d * fx; cy -= d * fy; cz -= d * fz;
    l = sq(cx * cx + cy * cy + cz * cz) || 1e-9; cx /= l; cy /= l; cz /= l;
    const k = Math.min(1, Math.max(0, (Math.abs(fy) - 0.85) / 0.1));
    cx = ux * (1 - k) + cx * k; cy = uy * (1 - k) + cy * k; cz = uz * (1 - k) + cz * k;
    l = sq(cx * cx + cy * cy + cz * cz) || 1;
    BP[0] = fx; BP[1] = fy; BP[2] = fz; BP[3] = cx; BP[4] = cy; BP[5] = cz;
    BP[6] = fy * cz - fz * cy; BP[7] = fz * cx - fx * cz; BP[8] = fx * cy - fy * cx;
  }
  /** (1 − cos) ÷ 2 do braço do jogo com a coluna do peito: 1 com o braço para baixo, 0 com ele para cima. */
  function elevacao(po, io, ic, yx, yy, yz) {
    const a = io * 3, c = ic * 3;
    const bx = po[c] - po[a], by = po[c + 1] - po[a + 1], bz = po[c + 2] - po[a + 2];
    const l = sq(bx * bx + by * by + bz * bz) || 1e-9;
    return (1 - (bx * yx + by * yy + bz * yz) / l) / 2;
  }
  let Q_REP = 1;
  /**
   * Cotovelo do desenho: IK de dois ossos (L1, L2) do ombro do desenho à mão do jogo. O lado da dobra é o do braço do jogo
   * (o cotovelo do jogo fora da reta ombro→mão do JOGO); com o braço do jogo quase reto (seno < 0,087 ≈ 5°), mistura com o
   * polo anatômico (ax, ay, az: para trás e um pouco para fora) até 20° — sem isso, com o braço reto, o lado da dobra
   * dependia só da diferença entre os dois ombros e virava de um quadro para o outro.
   */
  function ikBraco(po, o, io, ic, im, ax, ay, az) {
    const a = io * 3, c = ic * 3, m = im * 3;
    let ex = o[m] - o[a], ey = o[m + 1] - o[a + 1], ez = o[m + 2] - o[a + 2];
    const L = sq(ex * ex + ey * ey + ez * ez);
    if (L < 1e-6) return;
    ex /= L; ey /= L; ez /= L;
    if (L >= L1 + L2 - 1e-6) { // esticado: o cotovelo na reta (o braço estica até 1,1 pela escala)
      const f = L * L1 / (L1 + L2);
      o[c] = o[a] + ex * f; o[c + 1] = o[a + 1] + ey * f; o[c + 2] = o[a + 2] + ez * f;
      return;
    }
    const x = (L1 * L1 - L2 * L2 + L * L) / (2 * L);
    const y = sq(Math.max(L1 * L1 - x * x, 0));
    // a dobra do braço do jogo, no referencial do braço do jogo
    let gx = po[m] - po[a], gy = po[m + 1] - po[a + 1], gz = po[m + 2] - po[a + 2];
    const lg = sq(gx * gx + gy * gy + gz * gz) || 1e-9; gx /= lg; gy /= lg; gz /= lg;
    let px = po[c] - po[a], py = po[c + 1] - po[a + 1], pz = po[c + 2] - po[a + 2];
    let pe = px * gx + py * gy + pz * gz; px -= pe * gx; py -= pe * gy; pz -= pe * gz;
    let lp = sq(px * px + py * py + pz * pz);
    const sn = lp / L1;
    const w = Math.min(1, Math.max(0, (sn - 0.087) / (0.342 - 0.087)));
    if (lp > 1e-9) { px /= lp; py /= lp; pz /= lp; }
    px = px * w + ax * (1 - w); py = py * w + ay * (1 - w); pz = pz * w + az * (1 - w);
    pe = px * ex + py * ey + pz * ez; px -= pe * ex; py -= pe * ey; pz -= pe * ez;
    lp = sq(px * px + py * py + pz * pz);
    if (lp < 1e-9) { px = ax; py = ay; pz = az; pe = px * ex + py * ey + pz * ez; px -= pe * ex; py -= pe * ey; pz -= pe * ez; lp = sq(px * px + py * py + pz * pz) || 1; }
    px /= lp; py /= lp; pz /= lp;
    o[c] = o[a] + ex * x + px * y; o[c + 1] = o[a + 1] + ey * x + py * y; o[c + 2] = o[a + 2] + ez * x + pz * y;
  }

  /** Base com Y = eixo dado e X ≈ x dado (ortogonalizado); Z = X × Y. Escreve rotação + origem em o[ob..]. */
  function baseYX(yx, yy, yz, xx, xy, xz, o, ob, tx, ty, tz) {
    let l = sq(yx * yx + yy * yy + yz * yz) || 1e-9; yx /= l; yy /= l; yz /= l;
    const d = xx * yx + xy * yy + xz * yz; xx -= d * yx; xy -= d * yy; xz -= d * yz;
    l = sq(xx * xx + xy * xy + xz * xz) || 1e-9; xx /= l; xy /= l; xz /= l;
    const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
    o[ob] = xx; o[ob + 1] = yx; o[ob + 2] = zx; o[ob + 3] = tx;
    o[ob + 4] = xy; o[ob + 5] = yy; o[ob + 6] = zy; o[ob + 7] = ty;
    o[ob + 8] = xz; o[ob + 9] = yz; o[ob + 10] = zz; o[ob + 11] = tz;
  }
  const d3 = (po, a, b, out) => { out[0] = po[b * 3] - po[a * 3]; out[1] = po[b * 3 + 1] - po[a * 3 + 1]; out[2] = po[b * 3 + 2] - po[a * 3 + 2]; return out; };
  /** Menor arco que leva a (unitário) a b (unitário), como 3×3 por linhas (Rodrigues). */
  function arco(ax, ay, az, bx, by, bz, R) {
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const c = ax * bx + ay * by + az * bz;
    const k = 1 / (1 + Math.max(c, -0.999999));
    R[0] = c + cx * cx * k; R[1] = cx * cy * k - cz; R[2] = cx * cz * k + cy;
    R[3] = cy * cx * k + cz; R[4] = c + cy * cy * k; R[5] = cy * cz * k - cx;
    R[6] = cz * cx * k - cy; R[7] = cz * cy * k + cx; R[8] = c + cz * cz * k;
  }
  /** Tronco e cabeça pelas linhas do corpo. */
  function tronco(po, o) {
    d3(po, JE.quadrilE, JE.quadrilD, XQ); d3(po, JE.ombroE, JE.ombroD, XS);
    const lq = sq(XQ[0] * XQ[0] + XQ[1] * XQ[1] + XQ[2] * XQ[2]) || 1, ls = sq(XS[0] * XS[0] + XS[1] * XS[1] + XS[2] * XS[2]) || 1;
    for (let k = 0; k < 3; k++) { XQ[k] /= lq; XS[k] /= ls; XM[k] = XQ[k] + XS[k]; }
    const P = (a, b, X, ob, j) => { d3(po, a, b, v); baseYX(v[0], v[1], v[2], X[0], X[1], X[2], o, ob, po[j * 3], po[j * 3 + 1], po[j * 3 + 2]); };
    P(JE.pelve, JE.lombar, XQ, 0, JE.pelve);
    P(JE.lombar, JE.peito, XM, 12, JE.lombar);
    P(JE.peito, JE.pescoco, XS, 24, JE.peito);
    P(JE.pescoco, JE.cabeca, XS, 36, JE.pescoco);
    P(JE.pescoco, JE.cabeca, XS, 48, JE.cabeca);
  }
  const perna = b => b === 13 || b === 16;
  /**
   * Para onde vai o X (a dobradiça) do membro b: a normal do plano da dobra n = membro × segmento seguinte, com o sinal
   * natural; quase reto (seno < 0,087 ≈ 5°) mistura com a referência de reta — na perna, pé × membro; no braço, o X dado.
   * Tudo pelas juntas do JOGO (PG). O descanso usa a MESMA conta (torção zero no descanso por construção).
   */
  function alvoTorcao(po, b, jk, jt, rx, ry, rz) {
    // na perna, o plano da dobra e o pé saem das juntas do JOGO: com o tornozelo do desenho (preso ao pé), o joelho quase
    // reto do jogo podia parecer dobrado para a frente e a torção virava de um quadro para o outro
    if (perna(b)) po = PG;
    d3(po, IA[b], IB[b], vg);
    let l = sq(vg[0] * vg[0] + vg[1] * vg[1] + vg[2] * vg[2]) || 1e-9; vg[0] /= l; vg[1] /= l; vg[2] /= l;
    d3(po, jk, jt, u);
    l = sq(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]) || 1e-9; u[0] /= l; u[1] /= l; u[2] /= l;
    let nx = vg[1] * u[2] - vg[2] * u[1], ny = vg[2] * u[0] - vg[0] * u[2], nz = vg[0] * u[1] - vg[1] * u[0];
    const sn = sq(nx * nx + ny * ny + nz * nz);
    const w = Math.min(1, Math.max(0, (sn - 0.087) / (0.342 - 0.087)));
    if (perna(b)) {
      const t = b === 13 ? JE.tornozeloE : JE.tornozeloD, pt = b === 13 ? JE.pontaE : JE.pontaD;
      const fx = po[pt * 3] - po[t * 3], fy = po[pt * 3 + 1] - po[t * 3 + 1], fz = po[pt * 3 + 2] - po[t * 3 + 2];
      const cx = fy * vg[2] - fz * vg[1], cy = fz * vg[0] - fx * vg[2], cz = fx * vg[1] - fy * vg[0];
      const lc = sq(cx * cx + cy * cy + cz * cz);
      if (lc > 1e-4) { rx = cx / lc; ry = cy / lc; rz = cz / lc; }
    }
    if (sn > 1e-9) { nx /= sn; ny /= sn; nz /= sn; }
    alvo[0] = nx * w + rx * (1 - w); alvo[1] = ny * w + ry * (1 - w); alvo[2] = nz * w + rz * (1 - w);
  }
  /** Membro b: balanço a partir do pai (+ torção pela dobra). */
  function membro(po, o, b, p, jk, jt) {
    const ip = p * 12, ir = b * 9;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
      Rr[r * 3 + c] = o[ip + r * 4] * rel[ir + c] + o[ip + r * 4 + 1] * rel[ir + 3 + c] + o[ip + r * 4 + 2] * rel[ir + 6 + c];
    d3(po, IA[b], IB[b], v);
    const l = sq(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1e-9; v[0] /= l; v[1] /= l; v[2] /= l;
    arco(Rr[1], Rr[4], Rr[7], v[0], v[1], v[2], Q);
    const ob = b * 12;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
      o[ob + r * 4 + c] = Q[r * 3] * Rr[c] + Q[r * 3 + 1] * Rr[3 + c] + Q[r * 3 + 2] * Rr[6 + c];
    if (jk >= 0) {
      alvoTorcao(po, b, jk, jt, o[ob], o[ob + 4], o[ob + 8]);
      const Xx = o[ob], Xy = o[ob + 4], Xz = o[ob + 8], Zx = o[ob + 2], Zy = o[ob + 6], Zz = o[ob + 10];
      const th = Math.atan2(alvo[0] * Zx + alvo[1] * Zy + alvo[2] * Zz, alvo[0] * Xx + alvo[1] * Xy + alvo[2] * Xz);
      const c = Math.cos(th), s = Math.sin(th);
      o[ob] = Xx * c + Zx * s; o[ob + 4] = Xy * c + Zy * s; o[ob + 8] = Xz * c + Zz * s;
      o[ob + 2] = Zx * c - Xx * s; o[ob + 6] = Zy * c - Xy * s; o[ob + 10] = Zz * c - Xz * s;
    }
    o[ob + 3] = po[IA[b] * 3]; o[ob + 7] = po[IA[b] * 3 + 1]; o[ob + 11] = po[IA[b] * 3 + 2];
  }
  function copiarNaJunta(po, o, b, de) {
    const ob = b * 12, os = de * 12;
    for (let k = 0; k < 12; k++) o[ob + k] = o[os + k];
    o[ob + 3] = po[IA[b] * 3]; o[ob + 7] = po[IA[b] * 3 + 1]; o[ob + 11] = po[IA[b] * 3 + 2];
  }
  /** Matrizes de mundo (rígidas, sem a escala) dos 19 ossos principais a partir das juntas do DESENHO po. */
  function mundoDesenho(po, o) {
    tronco(po, o);
    for (let i = 0; i < MEMBROS.length; i++) {
      const b = MEMBROS[i][0], p = MEMBROS[i][1], jk = MEMBROS[i][2], jt = MEMBROS[i][3];
      if (!temBind) {
        d3(po, IA[b], IB[b], v);
        const l = sq(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1e-9; v[0] /= l; v[1] /= l; v[2] /= l;
        let rx = o[p * 12], ry = o[p * 12 + 4], rz = o[p * 12 + 8];
        if (jk >= 0) { alvoTorcao(po, b, jk, jt, rx, ry, rz); rx = alvo[0]; ry = alvo[1]; rz = alvo[2]; }
        baseYX(v[0], v[1], v[2], rx, ry, rz, o, b * 12, po[IA[b] * 3], po[IA[b] * 3 + 1], po[IA[b] * 3 + 2]);
      } else membro(po, o, b, p, jk, jt);
    }
    // o pé: eixo tornozelo do desenho → ponta e o lado pelo referencial BP (sola no chão), não pelo balanço da canela (que
    // trazia a torção da perna para o pé e enterrava a borda da sola)
    for (let p = 0; p < 2; p++) {
      const b = p ? 18 : 15, a = (p ? JE.joelhoD : JE.joelhoE) * 3, t = (p ? JE.tornozeloD : JE.tornozeloE) * 3, q = (p ? JE.pontaD : JE.pontaE) * 3;
      basePe(po, a, t, q);
      baseYX(BP[0], BP[1], BP[2], -BP[6], -BP[7], -BP[8], o, b * 12, po[t], po[t + 1], po[t + 2]);
    }
    copiarNaJunta(po, o, 8, 7); copiarNaJunta(po, o, 12, 11);
    return o;
  }
  function quat(o, i, q) {
    const m00 = o[i], m01 = o[i + 1], m02 = o[i + 2], m10 = o[i + 4], m11 = o[i + 5], m12 = o[i + 6], m20 = o[i + 8], m21 = o[i + 9], m22 = o[i + 10];
    const tr = m00 + m11 + m22;
    if (tr > 0) { const s = sq(tr + 1) * 2; q[3] = 0.25 * s; q[0] = (m21 - m12) / s; q[1] = (m02 - m20) / s; q[2] = (m10 - m01) / s; }
    else if (m00 > m11 && m00 > m22) { const s = sq(1 + m00 - m11 - m22) * 2; q[3] = (m21 - m12) / s; q[0] = 0.25 * s; q[1] = (m01 + m10) / s; q[2] = (m02 + m20) / s; }
    else if (m11 > m22) { const s = sq(1 + m11 - m00 - m22) * 2; q[3] = (m02 - m20) / s; q[0] = (m01 + m10) / s; q[1] = 0.25 * s; q[2] = (m12 + m21) / s; }
    else { const s = sq(1 + m22 - m00 - m11) * 2; q[3] = (m10 - m01) / s; q[0] = (m02 + m20) / s; q[1] = (m12 + m21) / s; q[2] = 0.25 * s; }
  }
  /** Rotação do meio caminho (nlerp) entre as rotações 3×3 de o[a..] e o[b..] (sem escala), escrita em o[ob..]. */
  function meio(o, a, b, ob) {
    quat(o, a, qa); quat(o, b, qb);
    const sg = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3] < 0 ? -1 : 1;
    let x = qa[0] + sg * qb[0], y = qa[1] + sg * qb[1], z = qa[2] + sg * qb[2], w = qa[3] + sg * qb[3];
    const l = sq(x * x + y * y + z * z + w * w) || 1; x /= l; y /= l; z /= l; w /= l;
    o[ob] = 1 - 2 * (y * y + z * z); o[ob + 1] = 2 * (x * y - w * z); o[ob + 2] = 2 * (x * z + w * y);
    o[ob + 4] = 2 * (x * y + w * z); o[ob + 5] = 1 - 2 * (x * x + z * z); o[ob + 6] = 2 * (y * z - w * x);
    o[ob + 8] = 2 * (x * z - w * y); o[ob + 9] = 2 * (y * z + w * x); o[ob + 10] = 1 - 2 * (x * x + y * y);
  }

  // ---- descanso: as juntas do jogo em pé → as do desenho → matrizes de mundo e as inversas
  const R0 = new Float64Array(NJE * 3);
  JUNTAS_ESQ.forEach((n, i) => { const p = repouso.juntas[n]; R0[i * 3] = p[0]; R0[i * 3 + 1] = p[1]; R0[i * 3 + 2] = p[2]; });
  // o tornozelo do desenho no descanso: SOBE_TORN acima do do jogo, ao longo da canela (como tools/humano/encaixar.py); o
  // deslocamento guardado no referencial do pé (PE_REP), que acompanha o pé em toda pose
  for (let p = 0; p < 2; p++) {
    const a = (p ? JE.joelhoD : JE.joelhoE) * 3, t = (p ? JE.tornozeloD : JE.tornozeloE) * 3, q = (p ? JE.pontaD : JE.pontaE) * 3;
    let dx = R0[a] - R0[t], dy = R0[a + 1] - R0[t + 1], dz = R0[a + 2] - R0[t + 2];
    const l = sq(dx * dx + dy * dy + dz * dz) || 1e-9; dx *= SOBE_TORN / l; dy *= SOBE_TORN / l; dz *= SOBE_TORN / l;
    basePe(R0, a, t, q);
    PE_REP[p * 3] = dx * BP[0] + dy * BP[1] + dz * BP[2];
    PE_REP[p * 3 + 1] = dx * BP[3] + dy * BP[4] + dz * BP[5];
    PE_REP[p * 3 + 2] = dx * BP[6] + dy * BP[7] + dz * BP[8];
  }
  temPeRep = true;
  {
    const p = JE.peito * 3, n = JE.pescoco * 3;
    let yx = R0[n] - R0[p], yy = R0[n + 1] - R0[p + 1], yz = R0[n + 2] - R0[p + 2];
    const l = sq(yx * yx + yy * yy + yz * yz) || 1;
    Q_REP = elevacao(R0, JE.ombroE, JE.cotoveloE, yx / l, yy / l, yz / l);
  }
  const D0 = juntasDesenho(R0, new Float64Array(NJE * 3));
  const W0 = mundoDesenho(D0, new Float64Array(NOSSOS * 12));
  for (let i = 0; i < MEMBROS.length; i++) {
    const b = MEMBROS[i][0], p = MEMBROS[i][1];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += W0[p * 12 + k * 4 + r] * W0[b * 12 + k * 4 + c]; // Rpᵀ · Rc
      rel[b * 9 + r * 3 + c] = s;
    }
  }
  for (let b = 0; b < NOSSOS; b++) {
    if (IB[b] < 0) { compr[b] = 0; continue; }
    const a = IA[b] * 3, c = IB[b] * 3;
    compr[b] = sq((D0[c] - D0[a]) ** 2 + (D0[c + 1] - D0[a + 1]) ** 2 + (D0[c + 2] - D0[a + 2]) ** 2);
  }
  temBind = true;
  // os ajudantes no descanso: a orientação do osso de cima, na junta (servem só para a inversa: a pele deles é montada)
  for (let h = 0; h < AJ_PAR.length; h++) copiarNaJunta(D0, W0, N_PRINC + h, AJ_PAR[h][0]);
  const INV = inverterRigidas(W0, NOSSOS);

  /**
   * Matrizes de PELE (S = W × inversa do descanso) dos 25 ossos da pose po (as 19 juntas do jogo, Float32Array como a
   * do anim.js), escritas em out (Float32Array ou Float64Array) a partir de off: 12 floats por osso (3×4 por linhas).
   */
  function pele(po, out, off = 0) {
    juntasDesenho(po, D);
    mundoDesenho(D, W);
    // escala ao longo do eixo Y de cada osso com eixo
    for (let b = 0; b < N_PRINC; b++) {
      if (IB[b] < 0 || b === 15 || b === 18) continue; // o pé é rígido (o tornozelo do desenho preso a ele)
      const a = IA[b] * 3, c = IB[b] * 3;
      let k = sq((D[c] - D[a]) ** 2 + (D[c + 1] - D[a + 1]) ** 2 + (D[c + 2] - D[a + 2]) ** 2) / compr[b];
      k = k < ESC_MIN ? ESC_MIN : k > ESC_MAX ? ESC_MAX : k;
      const i = b * 12;
      W[i + 1] *= k; W[i + 5] *= k; W[i + 9] *= k;
    }
    multiplicar(W, INV, N_PRINC, out, off);
    for (let h = 0; h < AJ_PAR.length; h++) {
      const b = N_PRINC + h, ia = IA[b], ob = off + b * 12;
      meio(out, off + AJ_PAR[h][0] * 12, off + AJ_PAR[h][1] * 12, ob);
      const jx = D0[ia * 3], jy = D0[ia * 3 + 1], jz = D0[ia * 3 + 2];
      out[ob + 3] = D[ia * 3] - (out[ob] * jx + out[ob + 1] * jy + out[ob + 2] * jz);
      out[ob + 7] = D[ia * 3 + 1] - (out[ob + 4] * jx + out[ob + 5] * jy + out[ob + 6] * jz);
      out[ob + 11] = D[ia * 3 + 2] - (out[ob + 8] * jx + out[ob + 9] * jy + out[ob + 10] * jz);
    }
    return out;
  }
  return {
    pele,
    juntasDesenho,
    /** Matrizes de mundo da última pele (com a escala), para os testes. */
    get mundo() { return W; },
    /** As juntas do desenho da última pele e as do descanso. */
    get desenho() { return D; },
    get desenhoRepouso() { return D0; },
    get comprimentos() { return compr; },
  };
}

/** Inversa de cada 3×4 rígida (rotação ortonormal + translação). */
export function inverterRigidas(w, n) {
  const o = new Float64Array(n * 12);
  for (let b = 0; b < n; b++) {
    const i = b * 12;
    const r00 = w[i], r01 = w[i + 1], r02 = w[i + 2], r10 = w[i + 4], r11 = w[i + 5], r12 = w[i + 6], r20 = w[i + 8], r21 = w[i + 9], r22 = w[i + 10];
    const tx = w[i + 3], ty = w[i + 7], tz = w[i + 11];
    o[i] = r00; o[i + 1] = r10; o[i + 2] = r20; o[i + 3] = -(r00 * tx + r10 * ty + r20 * tz);
    o[i + 4] = r01; o[i + 5] = r11; o[i + 6] = r21; o[i + 7] = -(r01 * tx + r11 * ty + r21 * tz);
    o[i + 8] = r02; o[i + 9] = r12; o[i + 10] = r22; o[i + 11] = -(r02 * tx + r12 * ty + r22 * tz);
  }
  return o;
}

/** S = W × inv (3×4 × 3×4) dos n primeiros ossos, escrito em out a partir de off (12 floats por osso). */
export function multiplicar(w, inv, n, out, off) {
  for (let b = 0; b < n; b++) {
    const i = b * 12, o = off + i;
    for (let r = 0; r < 3; r++) {
      const w0 = w[i + r * 4], w1 = w[i + r * 4 + 1], w2 = w[i + r * 4 + 2], w3 = w[i + r * 4 + 3];
      out[o + r * 4] = w0 * inv[i] + w1 * inv[i + 4] + w2 * inv[i + 8];
      out[o + r * 4 + 1] = w0 * inv[i + 1] + w1 * inv[i + 5] + w2 * inv[i + 9];
      out[o + r * 4 + 2] = w0 * inv[i + 2] + w1 * inv[i + 6] + w2 * inv[i + 10];
      out[o + r * 4 + 3] = w0 * inv[i + 3] + w1 * inv[i + 7] + w2 * inv[i + 11] + w3;
    }
  }
}

/** Pele linear de um vértice (para os testes e a conferência GPU = JS): p' = Σ wᵢ Sᵢ p. */
export function peleVertice(S, off, ossos, pesos, x, y, z, out) {
  let ox = 0, oy = 0, oz = 0;
  for (let k = 0; k < 4; k++) {
    const w = pesos[k];
    if (!w) continue;
    const i = off + ossos[k] * 12;
    ox += w * (S[i] * x + S[i + 1] * y + S[i + 2] * z + S[i + 3]);
    oy += w * (S[i + 4] * x + S[i + 5] * y + S[i + 6] * z + S[i + 7]);
    oz += w * (S[i + 8] * x + S[i + 9] * y + S[i + 10] * z + S[i + 11]);
  }
  out[0] = ox; out[1] = oy; out[2] = oz;
  return out;
}
