// CARRINHO (item 34 da FILA): o corpo de quem dá o carrinho como um PLANO puro montado no aperto (j.carrinho) e um QUADRO
// puro do tempo (quadroCarrinho) — o molde do mergulho do goleiro (goleiro.js iniciarMergulho / quadroMergulho). A
// simulação (sim.js), a pose (anim.js poseCarrinho) e as cenas leem o MESMO quadro: as juntas das duas pernas saem daqui,
// SEM IK depois, e a perna que a simulação confere com a bola e com o adversário é, bit a bit, a perna desenhada.
// Módulo FOLHA: só config.js, matdet.js e mat.js (o anim.js importa este; nada do jogo é importado aqui). Sem three.js
// nem DOM; trigonometria só pelo MD (matdet.js: o online compara o hash dos dois aparelhos; teste-math-proibido). Nada
// aqui sorteia. Contrato: CONTRATOS.md "Carrinho (item 34)"; constantes em config.js DEFESA_HUMANO.carrinho.
//
// Fases (t em s desde o aperto, o tick0; o quadro de t = 0 é o corpo no aperto):
//   0 queda     0 → tAr       a pelve cai pela gravidade (h0 → hImpacto) em QUALQUER entrada; a velocidade horizontal
//                             gira de V0 a ve·u até tq (≤ tAr + tImpacto: o desvio do analógico é limitado para caber)
//   1 impacto   tAr → tD      joelho → quadril: a pelve vai ao chão (hChao) e o corpo perde perdaImpacto
//   2 deslize   tD → tS       desacelera aD (= desac/esc) até parar
//   3 chão      tS → tL       parado, deitado (da parada até de pé: 1,2 s no erro, 0,5 s quando ganhou a bola)
//   4 levantar  tL → tF       o pé dobrado PLANTA em (levX, levZ), o da bola sobe e pousa ao lado; de pé no tick `fim`
// O centro anda por fórmulas fechadas de aceleração constante por trecho (exatas a qualquer t, também nos subpassos da
// bola); nada de teletransporte: P(0) e V(0) são os do corpo no aperto.

import { PASSO, JOGADOR, PASSADA, ENTRADA, DEFESA_HUMANO } from './config.js';
import { clamp, normAng, tabela } from './mat.js';
import { MD } from './matdet.js';

const C = DEFESA_HUMANO.carrinho;
const L1 = JOGADOR.coxa, L2 = JOGADOR.canela;
const LMAX = (L1 + L2) * 0.998;          // o mesmo alcance da IK do jogo (anim.js)
const TORN = JOGADOR.alturaTornozelo;
const MQ = JOGADOR.larguraQuadril / 2;   // MEIO_QUADRIL do anim.js
const AF = PASSADA.afastamentoLateral;   // pé plantado ao lado do centro (de pé)
const T_AR = C.tAr, T_IMP = C.tImpacto, T_D = C.tAr + C.tImpacto;
const DV_MAX = C.aEntrada * T_D;          // o giro da velocidade horizontal cabe até o fim do impacto (4,8 m/s)
const N_ENC0 = Math.round(C.encontro[0] / PASSO), N_ENC1 = Math.round(C.encontro[1] / PASSO);
// perna da bola: o comprimento quadril–tornozelo EXATO com a flexão joelhoFrente (lei dos cossenos; ≤ LMAX)
const LB = Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * MD.cos(C.joelhoFrente));
// perna dobrada (desenho, no referencial do corpo: f = frente, o = para fora do lado dela, y): o quadril na altura da pelve
// deitada (hChao), a coxa no chão para a frente e para fora até o joelho (a yJoelho), a canela para trás e para dentro até o
// tornozelo (à altura de sempre) — os dois ossos com o comprimento exato (o esqueleto do corpo novo só aceita 0,9–1,1)
const DY_J = C.hChao - C.dobra.yJoelho;
const HK = Math.sqrt(L1 * L1 - DY_J * DY_J);
const DK_F = HK * MD.cos(C.dobra.joelho), DK_O = HK * MD.sin(C.dobra.joelho), DK_Y = C.dobra.yJoelho - C.hChao;
const DY_T = TORN - C.dobra.yJoelho;
const HA = Math.sqrt(L2 * L2 - DY_T * DY_T);
const DA_F = DK_F + HA * MD.cos(C.dobra.canela), DA_O = DK_O + HA * MD.sin(C.dobra.canela);
// o polo do joelho de pé (o mesmo do anim.js pose: a frente do pé, um pouco para fora, um pouco para cima)
const POLO_FORA = 0.1, POLO_CIMA = 0.05;
// o joelho nunca abaixo disto (o do desenho deitado, menos a folga do arredondamento): joelhoFora
const Y_JOELHO_MIN = C.dobra.yJoelho - 1e-6;
// a ponta do pé: de pé, a do anim.js (0,17 m à frente, 0,055 abaixo do tornozelo, y ≥ 0,025); deitado, `PONTA` m pela
// direção da canela com a sola para a bola, y ≥ 0,03
const PONTA_PE = 0.17, PONTA_BAIXO = 0.055, PONTA = 0.19, PONTA_Y0 = 0.025, PONTA_Y1 = 0.03;

/** Os raios das cápsulas das pernas que o contato confere (coxa, canela, chuteira): o maior de cada uma no SEGMENTOS do
 * anim.js (o teste-carrinho confere que são os mesmos). */
export const RAIOS_PERNA = [0.085, 0.058, 0.045];

const sm = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const dsm = u => (u <= 0 || u >= 1 ? 0 : 6 * u * (1 - u));

/** Escala do atributo (desarme 40 → 90: attr[0] → attr[1]). */
export function escalaCarrinho(j) {
  const d = j.par?.attr?.desarme ?? 65;
  return C.attr[0] + (C.attr[1] - C.attr[0]) * clamp((d - 40) / 50, 0, 1);
}

/** O desvio máximo (rad) de u em relação à corrida a v m/s: livre abaixo de desvioLivre; a tabela (90° a 2 → 45° a 6) e
 * asin(aEntrada·(tAr + tImpacto)/v) — o giro da velocidade horizontal cabe até o fim do impacto. */
export function desvioMax(v) {
  if (!(v >= C.desvioLivre)) return Math.PI;
  let lim = tabela(C.desvio, v, 1);
  const a = DV_MAX / v;
  if (a < 1) { const s = MD.asin(a); if (s < lim) lim = s; }
  return lim;
}

/** A bola está alta para o carrinho (no ar acima de altoBola ou subindo)? O mesmo predicado barra o disparo e decide o
 * sentido do L/X na defesa (entrada.js). */
export function bolaAlta(m) {
  const b = m.bola;
  return !b.rolando && (b.p.y > C.altoBola || b.v.y > 0);
}

/** O carrinho de j vale no tick (para a POSE e a altura do quadril; na simulação, "fora do lance" é a existência do
 * plano)? A regra do mergulhoAtivo, com o relógio parado no apito (`congela`, partida.js fimDoTempo). */
export function carrinhoAtivo(j, tick) {
  const c = j.carrinho;
  return !!c && tick > c.tick0 && (c.congela != null && c.congela < tick ? c.congela : tick) <= c.fim;
}

/** O t do quadro (s desde o aperto) no tick, com o relógio parado no apito (`congela`) e a fração do subpasso (s). */
export function tempoCarrinho(c, tick, frac = 0) {
  return ((c.congela != null && c.congela < tick ? c.congela : tick) - c.tick0) * PASSO + frac;
}

/** O 1º toque que GANHA a bola (defesa.js): da parada até de pé passa a chaoAcertou — só antes da parada (nada salta).
 * Devolve true se mudou. */
export function marcarAcerto(c, tick) {
  if (c.tChao === C.chaoAcertou || tempoCarrinho(c, tick) >= c.tS) return false;
  c.tChao = C.chaoAcertou;
  c.fim = c.tick0 + Math.round((c.tS + c.tChao) / PASSO);
  return true;
}

/**
 * Joelho e tornozelo pela conta de 2 ossos (coxa, canela) do quadril H ao alvo T, com o polo P (para onde o joelho aponta):
 * a MESMA fórmula do anim.js ik (copiada: o anim.js importa este módulo). Escreve em jo e to ({x, y, z}).
 */
export function joelho2Ossos(hx, hy, hz, tx, ty, tz, px, py, pz, jo, to) {
  const dx = tx - hx, dy = ty - hy, dz = tz - hz;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const dd = clamp(d, 0.05, LMAX);
  const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pd = px * ux + py * uy + pz * uz;
  let qx = px - pd * ux, qy = py - pd * uy, qz = pz - pd * uz;
  const ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
  qx /= ql; qy /= ql; qz /= ql;
  jo.x = hx + ux * a + qx * h; jo.y = hy + uy * a + qy * h; jo.z = hz + uz * a + qz * h;
  to.x = hx + ux * dd; to.y = hy + uy * dd; to.z = hz + uz * dd;
}

/** Um quadro novo (para reusar: o quadro escreve nele). */
export function novoQuadroCarrinho() {
  const p = () => ({ x: 0, y: 0, z: 0 });
  return {
    t: 0, fase: 0, x: 0, z: 0, vx: 0, vz: 0, yaw: 0, h: 0, w: 0, incl: 0, rol: 0, lado: 1,
    qd: [p(), p()], jo: [p(), p()], to: [p(), p()], po: [p(), p()], apoio0: false, apoio1: false, mao: p(),
  };
}

// ------------------------------------------------------------------ o plano (no aperto)

/** O tornozelo DESENHADO do pé no aperto (a conta do anim.js pePrevisto, com o rumo do pé). */
function peDesenhado(pe) {
  return pe.apoio ? { x: pe.x, y: TORN, z: pe.z, r: pe.rumo } : { x: pe.tx + pe.ox, y: pe.ty, z: pe.tz + pe.oz, r: pe.lrumo };
}

/** Grava a direção u (com o desvio limitado pela corrida) e as contas que dependem dela. */
function definirDirecao(c, ux, uz, bola) {
  const l = Math.sqrt(ux * ux + uz * uz) || 1;
  ux /= l; uz /= l;
  const v0 = Math.sqrt(c.vx0 * c.vx0 + c.vz0 * c.vz0);
  if (v0 >= C.desvioLivre) {
    const vx = c.vx0 / v0, vz = c.vz0 / v0;
    const d = MD.atan2(vx * uz - vz * ux, vx * ux + vz * uz);
    const lim = desvioMax(v0);
    if (d > lim || d < -lim) {
      const a = MD.atan2(vz, vx) + (d > 0 ? lim : -lim);
      ux = MD.cos(a); uz = MD.sin(a);
    }
  }
  c.ux = ux; c.uz = uz;
  const vMin = C.vMin * c.esc;
  c.ve = clamp(Math.max(c.vx0 * ux + c.vz0 * uz, vMin), vMin, C.vMax);
  const dx = c.ve * ux - c.vx0, dz = c.ve * uz - c.vz0;
  c.tq = clamp(Math.sqrt(dx * dx + dz * dz) / C.aEntrada, T_AR, T_D);
  c.v1 = Math.max(0.5, c.ve - C.perdaImpacto);
  c.tS = T_D + c.v1 / c.aD;
  // o pé da bola: o do lado dela em relação a u (o corpo cai do lado do outro); sem bola, o direito
  c.frente = !bola || -(bola.x - c.x0) * uz + (bola.z - c.z0) * ux >= 0 ? 1 : 0;
  c.fim = c.tick0 + Math.round((c.tS + c.tChao) / PASSO);
}

const _enc = { t: 0, d: 0, px: 0, pz: 0, bx: 0, bz: 0 };
const _qe = novoQuadroCarrinho(), _be = { x: 0, z: 0 };

/** O instante do encontro (para a mira): nos instantes de `encontro` (de 2 em 2 ticks), o 1º em que a ponta da perna da
 * bola chega à distância (do corpo no aperto) em que a bola prevista está — interpolado entre as duas amostras; sem
 * cruzar, o de menor diferença (o 1º no empate). A ponta e a bola nele em `o`. (Pelo instante da MENOR distância a mira
 * convergia devagar: com a ponta passando à frente da bola, a menor distância cai depois do encontro e as duas voltas
 * paravam a ~5° dele — 0,33–0,34 m no A9 do teste-carrinho a 4 e 5,5 m.) */
function encontro(c, prever, o) {
  const pe = c.frente;
  let gA = 0, tA = 0, melhor = Infinity, tM = N_ENC0 * PASSO, tX = -1;
  for (let n = N_ENC0; n <= N_ENC1; n += 2) {
    const t = n * PASSO;
    quadroCarrinho(c, t, _qe);
    prever(t, _be);
    const px = _qe.po[pe].x - c.x0, pz = _qe.po[pe].z - c.z0, bx = _be.x - c.x0, bz = _be.z - c.z0;
    const g = Math.sqrt(px * px + pz * pz) - Math.sqrt(bx * bx + bz * bz);
    if (n > N_ENC0 && gA < 0 && g >= 0) { tX = tA + (t - tA) * gA / (gA - g); break; }
    const ag = g < 0 ? -g : g;
    if (ag < melhor) { melhor = ag; tM = t; }
    gA = g; tA = t;
  }
  const t = tX >= 0 ? tX : tM;
  quadroCarrinho(c, t, _qe);
  prever(t, _be);
  o.t = t; o.px = _qe.po[pe].x; o.pz = _qe.po[pe].z; o.bx = _be.x; o.bz = _be.z;
}

/** A menor distância (horizontal), nos instantes de `encontro`, entre a ponta da perna da bola no quadro e a bola prevista
 * no mesmo instante (o 1º no empate), em `o.d` — a intenção de jogar a bola (mirou). */
function procurar(c, prever, o) {
  let best = Infinity;
  const pe = c.frente;
  for (let n = N_ENC0; n <= N_ENC1; n += 2) {
    const t = n * PASSO;
    quadroCarrinho(c, t, _qe);
    prever(t, _be);
    const px = _qe.po[pe].x, pz = _qe.po[pe].z;
    const dx = _be.x - px, dz = _be.z - pz, d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; o.t = t; o.px = px; o.pz = pz; o.bx = _be.x; o.bz = _be.z; }
  }
  o.d = Math.sqrt(best);
}

/**
 * O PLANO do carrinho de j, montado no tick do aperto (puro: não escreve em j; nada sorteia). opc:
 *  - bola: {x, z}, a bola agora (a direção sem o analógico, a ≤ assistLonge m; o lado da perna da bola) ou null;
 *  - prever(t, out): a bola prevista t s depois do aperto em out.x/out.z — a procura do encontro (a ajuda de mira) — ou
 *    null (sem ajuda). O disparo (defesa.js carrinho) a monta pelo estado do mundo: o condutor, a bola rolando (bola.js
 *    distRolando) ou no ar.
 * A direção: o analógico (|imag| ≥ ENTRADA.magDirecao); sem ele, a bola a ≤ assistLonge m; senão, o rumo. A ajuda gira u,
 * em até duas voltas, pelo ângulo (visto do corpo no aperto) entre a ponta da perna no quadro e a bola prevista no
 * instante do encontro, se o u novo fica a ≤ assist rad do pedido (com o corpo parado ou alinhado, é a direção da bola
 * prevista no encontro). O desvio de u em relação à corrida é limitado (desvioMax) em todo plano montado.
 */
export function montarCarrinho(j, tick, opc = {}) {
  const bola = opc.bola ?? null, prever = opc.prever ?? null;
  const esc = escalaCarrinho(j);
  const c = {
    tick0: tick, x0: j.x, z0: j.z, vx0: j.vx, vz0: j.vz, rumo0: j.rumo, h0: j.quadril ?? C.hPe,
    ux: 1, uz: 0, ve: 0, tq: T_AR, v1: 0, aD: C.desac / esc, tD: T_D, tS: T_D,
    frente: 1, p0: [peDesenhado(j.pes[0]), peDesenhado(j.pes[1])], levX: j.x, levZ: j.z,
    esc, mirou: false, tChao: C.chaoErrou, fim: tick, bola: -1, homem: null,
  };
  // 1) a direção pedida
  let ux, uz;
  const im = Math.sqrt(j.ix * j.ix + j.iz * j.iz);
  if (j.imag >= ENTRADA.magDirecao && im > 1e-9) { ux = j.ix / im; uz = j.iz / im; }
  else {
    const dx = bola ? bola.x - j.x : 0, dz = bola ? bola.z - j.z : 0, d = Math.sqrt(dx * dx + dz * dz);
    if (bola && d > 1e-6 && d <= C.assistLonge) { ux = dx / d; uz = dz / d; }
    else { ux = MD.cos(j.rumo); uz = MD.sin(j.rumo); }
  }
  const u0x = ux, u0z = uz;
  definirDirecao(c, ux, uz, bola);
  // 2) a ajuda de mira pelo encontro (contas fechadas, sem sorteio): ≤ 2 × 26 quadros, só no aperto
  if (prever) {
    for (let k = 0; k < 2; k++) {
      encontro(c, prever, _enc);
      const ax = _enc.px - c.x0, az = _enc.pz - c.z0, bx = _enc.bx - c.x0, bz = _enc.bz - c.z0;
      const ang = MD.atan2(ax * bz - az * bx, ax * bx + az * bz);
      const cs = MD.cos(ang), sn = MD.sin(ang);
      const nx = c.ux * cs - c.uz * sn, nz = c.ux * sn + c.uz * cs;
      if (Math.abs(MD.atan2(u0x * nz - u0z * nx, u0x * nx + u0z * nz)) > C.assist) break;
      definirDirecao(c, nx, nz, bola);
    }
    // 3) a intenção de jogar a bola (Regra 12.4): a ponta passa a ≤ tentouMira da bola prevista no mesmo instante
    procurar(c, prever, _enc);
    c.mirou = _enc.d <= C.tentouMira;
  }
  // 4) o ponto do pé dobrado no levantar: o tornozelo dele no quadro da parada (o corpo fica parado de tS em diante)
  quadroCarrinho(c, c.tS, _qe);
  c.levX = _qe.to[1 - c.frente].x; c.levZ = _qe.to[1 - c.frente].z;
  return c;
}

// ------------------------------------------------------------------ o quadro (puro)

/** O centro e a velocidade no t (sem o levantar): dois termos lineares por trecho, cada um com integral fechada. */
function centroEm(c, t, q) {
  const tq = c.tq, perda = c.ve - c.v1;
  const dqx = c.ve * c.ux - c.vx0, dqz = c.ve * c.uz - c.vz0;
  if (t <= T_D) {
    const R = t <= tq ? t * t / (2 * tq) : tq / 2 + (t - tq);
    const a = t <= tq ? t / tq : 1;
    const s = t <= T_AR ? 0 : t - T_AR;
    const S = s * s / (2 * T_IMP), b = s / T_IMP;
    q.x = c.x0 + c.vx0 * t + dqx * R - c.ux * perda * S;
    q.z = c.z0 + c.vz0 * t + dqz * R - c.uz * perda * S;
    q.vx = c.vx0 + dqx * a - c.ux * perda * b;
    q.vz = c.vz0 + dqz * a - c.uz * perda * b;
    return;
  }
  const RD = tq / 2 + (T_D - tq), SD = T_IMP / 2;
  const tau = (t < c.tS ? t : c.tS) - T_D;
  const d = c.v1 * tau - 0.5 * c.aD * tau * tau;
  q.x = c.x0 + c.vx0 * T_D + dqx * RD - c.ux * perda * SD + c.ux * d;
  q.z = c.z0 + c.vz0 * T_D + dqz * RD - c.uz * perda * SD + c.uz * d;
  const v = t < c.tS ? c.v1 - c.aD * tau : 0;
  q.vx = c.ux * v; q.vz = c.uz * v;
}

/** O alvo do tornozelo da perna k com o corpo em (x, z), a direita do corpo (rx, rz: o quadril) e os quadris na altura hy:
 * o desenho do deslize no referencial de u (a frente FIXA do carrinho: com o corpo virando para u, o alvo não varre em volta
 * dele — de costas para u, os pés iam a ~20 m/s); a perna da bola alcança o chão à frente com o comprimento LB. */
function alvoTornozelo(c, k, x, z, rx, rz, hy, out) {
  const s = k === 0 ? -1 : 1, fx = c.ux, fz = c.uz, ox = -fz * s, oz = fx * s;
  const hx = x + rx * s * MQ, hz = z + rz * s * MQ;
  if (k === c.frente) {
    const dy = hy - C.yBola;
    const a = Math.sqrt(Math.max(0, LB * LB - dy * dy));
    out.x = hx + fx * a; out.y = C.yBola; out.z = hz + fz * a;
  } else {
    out.x = hx + fx * DA_F + ox * DA_O; out.y = TORN; out.z = hz + fz * DA_F + oz * DA_O;
  }
}

/** O joelho nunca entra no chão: abaixo de yMin, gira no círculo dos dois ossos (em volta do eixo quadril → tornozelo)
 * para cima até yMin (os comprimentos ficam exatos). Sem isto, na transição da queda (o corpo girando, a pelve agachada,
 * um pé no ar longe), o polo do desenho deitado levava o joelho dobrado ao chão: em 6 de 6441 estados de partida
 * (sementes 3002–3006), o fundo da cápsula dele a até −2,1 cm. */
function joelhoFora(H, T, J, yMin) {
  if (J.y >= yMin) return;
  let ex = T.x - H.x, ey = T.y - H.y, ez = T.z - H.z;
  const L = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
  ex /= L; ey /= L; ez /= L;
  const a = (J.x - H.x) * ex + (J.y - H.y) * ey + (J.z - H.z) * ez;
  const ox = H.x + ex * a, oy = H.y + ey * a, oz = H.z + ez * a;
  let dx = J.x - ox, dy = J.y - oy, dz = J.z - oz;
  const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (r < 1e-9) return;
  dx /= r; dy /= r; dz /= r;
  // a direção "para cima" no plano do círculo, sem a componente da atual
  let ux = -ey * ex, uy = 1 - ey * ey, uz = -ey * ez;
  const ud = ux * dx + uy * dy + uz * dz;
  ux -= ud * dx; uy -= ud * dy; uz -= ud * dz;
  const lu = Math.sqrt(ux * ux + uy * uy + uz * uz);
  if (lu < 1e-9) return;
  ux /= lu; uy /= lu; uz /= lu;
  // y(φ) = oy + r·(cos φ·dy + sen φ·uy): o menor φ ≥ 0 com y = yMin (ou o mais alto, se não chega)
  const A = r * dy, B = r * uy, R = Math.sqrt(A * A + B * B), f0 = MD.atan2(B, A);
  const k = (yMin - oy) / R;
  const f = k >= 1 ? f0 : f0 - MD.acos(k);
  const cs = MD.cos(f), sn = MD.sin(f);
  J.x = ox + r * (cs * dx + sn * ux); J.y = oy + r * (cs * dy + sn * uy); J.z = oz + r * (cs * dz + sn * uz);
}

const _a = { x: 0, y: 0, z: 0 }, _a0 = { x: 0, y: 0, z: 0 }, _cs = { x: 0, z: 0, vx: 0, vz: 0 };

/**
 * O quadro do carrinho no t (s desde o aperto; aceita fração — os subpassos da bola; fora de [0, tF] fica nas pontas).
 * Puro: lê o plano e escreve só em q (novoQuadroCarrinho): o centro (x, z), a velocidade (vx, vz), o rumo (yaw), a pelve
 * (h), o peso do corpo deitado (w: 0 de pé → 1 deitado), as inclinações do tronco (incl para trás, rol para o lado
 * `lado` da perna dobrada), a fase (0–4), as juntas das DUAS pernas no mundo (qd quadril, jo joelho, to tornozelo, po ponta;
 * a pose as copia sem IK), os apoios (apoio0, apoio1) e o ponto da mão de apoio (mao).
 */
export function quadroCarrinho(c, t, q) {
  const tF = (c.fim - c.tick0) * PASSO;
  if (!(t > 0)) t = 0; else if (t > tF) t = tF;
  const tS = c.tS, tL = tS > tF - C.levantar ? tS : tF - C.levantar, dL = tF - tL;
  const lev = t > tL;
  q.t = t;
  // ---- centro e velocidade (no levantar parte do ponto da parada)
  centroEm(c, lev ? tS : t, q);
  const yawU = MD.atan2(c.uz, c.ux);
  const yaw = t < c.tq ? c.rumo0 + normAng(yawU - c.rumo0) * sm(t / c.tq) : yawU;
  const fx = MD.cos(yaw), fz = MD.sin(yaw), rx = -fz, rz = fx;
  const b = c.frente, d = 1 - b, sb = b === 1 ? 1 : -1;
  // a mão de apoio: no chão atrás do quadril, do lado da perna dobrada (presa no levantar)
  q.mao.x = q.x + fx * C.mao[0] - rx * sb * C.mao[1];
  q.mao.y = C.mao[2];
  q.mao.z = q.z + fz * C.mao[0] - rz * sb * C.mao[1];
  // ---- pelve (no relógio da gravidade, não no do tq), peso deitado e fase
  let h, w, sL = 0;
  if (lev) sL = (t - tL) / dL;
  if (t <= T_AR) { const k = t / T_AR; h = c.h0 - (c.h0 - C.hImpacto) * k * k; }
  else if (t <= T_D) h = C.hImpacto + (C.hChao - C.hImpacto) * sm((t - T_AR) / T_IMP);
  else if (!lev) h = C.hChao;
  else h = C.hChao + (C.hPe - C.hChao) * sm(sL);
  w = t < T_D ? sm(t / T_D) : !lev ? 1 : 1 - sm(sL);
  q.fase = t < T_AR ? 0 : t < T_D ? 1 : t < tS ? 2 : !lev ? 3 : 4;
  if (lev) {
    // o centro vai do ponto da parada ao meio dos pés finais (o dobrado plantado, o da bola ao lado dele)
    const pfx = c.levX + rx * sb * AF, pfz = c.levZ + rz * sb * AF;
    const k = sm(sL), dk = dsm(sL) / dL;
    _cs.x = q.x; _cs.z = q.z;
    q.x = _cs.x + (pfx - _cs.x) * k; q.z = _cs.z + (pfz - _cs.z) * k;
    q.vx = (pfx - _cs.x) * dk; q.vz = (pfz - _cs.z) * dk;
  }
  q.yaw = yaw; q.h = h; q.w = w; q.incl = C.tronco * w; q.rol = C.rolagem * w; q.lado = -sb;
  const hy = h - 0.03 * (1 - w); // os quadris: de pé 0,03 abaixo da pelve (o anim.js); deitado, na altura dela
  const tr = t < T_D ? sm(t / T_D) : 1; // a transição dos tornozelos (do desenhado no aperto ao desenho do deslize)
  for (let k = 0; k < 2; k++) {
    const s = k === 0 ? -1 : 1;
    const H = q.qd[k];
    H.x = q.x + rx * s * MQ; H.y = hy; H.z = q.z + rz * s * MQ;
    // o alvo do tornozelo
    if (!lev) {
      alvoTornozelo(c, k, q.x, q.z, rx, rz, hy, _a);
      if (tr < 1) {
        // a diferença do começo some andando com o corpo: o pé nunca fica plantado com o quadril indo embora
        alvoTornozelo(c, k, c.x0, c.z0, -MD.sin(c.rumo0), MD.cos(c.rumo0), c.h0 - 0.03, _a0);
        const p0 = c.p0[k], e = 1 - tr;
        _a.x -= (_a0.x - p0.x) * e; _a.y -= (_a0.y - p0.y) * e; _a.z -= (_a0.z - p0.z) * e;
      }
    } else if (k === d) {
      _a.x = c.levX; _a.y = TORN; _a.z = c.levZ;   // o pé dobrado plantado
    } else {
      // o pé da bola sobe e pousa ao lado do dobrado
      alvoTornozelo(c, k, _cs.x, _cs.z, rx, rz, C.hChao, _a0);
      const k2 = sm(sL);
      const ex = c.levX + rx * sb * 2 * AF, ez = c.levZ + rz * sb * 2 * AF;
      _a.x = _a0.x + (ex - _a0.x) * k2;
      _a.y = _a0.y + (TORN - _a0.y) * k2 + C.passoLevanta * 4 * sL * (1 - sL);
      _a.z = _a0.z + (ez - _a0.z) * k2;
    }
    // dentro do alcance da perna (a IK não mexe no tornozelo: a pose copia)
    let ax = _a.x - H.x, ay = _a.y - H.y, az = _a.z - H.z;
    const da = Math.sqrt(ax * ax + ay * ay + az * az);
    if (da > LMAX) { const f = LMAX / da; ax *= f; ay *= f; az *= f; }
    // o polo do joelho: o de pé (a frente do pé no aperto, girando com o corpo) → o do desenho deitado (a perna da bola
    // para cima; a dobrada para o joelho no chão, no referencial de u como o alvo do tornozelo), pelo peso deitado
    const dp = lev ? 0 : normAng(c.p0[k].r - c.rumo0);
    const pf = yaw + dp, pcx = MD.cos(pf), pcz = MD.sin(pf);
    let px = (pcx + rx * s * POLO_FORA) * (1 - w), py = POLO_CIMA * (1 - w), pz = (pcz + rz * s * POLO_FORA) * (1 - w);
    if (k === b) py += w;
    else { px += (c.ux * DK_F - c.uz * s * DK_O) * w; py += DK_Y * w; pz += (c.uz * DK_F + c.ux * s * DK_O) * w; }
    const J = q.jo[k], T = q.to[k];
    joelho2Ossos(H.x, H.y, H.z, H.x + ax, H.y + ay, H.z + az, px, py, pz, J, T);
    joelhoFora(H, T, J, Y_JOELHO_MIN);
    // a ponta: a de pé (pela frente do pé) → a deitada (pela canela), pelo peso deitado
    const cx = (T.x - J.x) / L2, cy = (T.y - J.y) / L2, cz = (T.z - J.z) / L2;
    const P = q.po[k];
    P.x = T.x + pcx * PONTA_PE * (1 - w) + cx * PONTA * w;
    P.y = T.y - PONTA_BAIXO * (1 - w) + cy * PONTA * w;
    P.z = T.z + pcz * PONTA_PE * (1 - w) + cz * PONTA * w;
    const yMin = PONTA_Y0 + (PONTA_Y1 - PONTA_Y0) * w;
    if (P.y < yMin) P.y = yMin;
  }
  // os apoios: da queda ao fim do chão, nenhum (deslizam com o corpo); no levantar, o dobrado plantado e o da bola só no fim
  const ap0 = lev && (d === 0 || t >= tF), ap1 = lev && (d === 1 || t >= tF);
  q.apoio0 = ap0; q.apoio1 = ap1;
  return q;
}
