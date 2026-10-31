// Animação do jogador como FUNÇÃO PURA do estado (o replay depende disso).
// Passada procedural: pé de apoio travado no ponto em que pisou (IK de dois ossos na perna),
// pé no balanço indo do ponto onde saiu até o ponto onde vai pousar, quadril baixando para
// a perna alcançar, tronco inclinando pela aceleração (frente/trás) e pela curva (lado),
// braços em contrafase e o pé livre indo até a bola no toque.
// O pé desenhado nunca salta (tools/teste-patinacao.mjs mede todos os quadros):
//  - pé no chão = exatamente o ponto plantado na simulação (nem o toque o tira do lugar: o
//    toque sai sempre do pé livre — conducao.js peLivre);
//  - pé no ar = o pé desenhado que a simulação integra com a velocidade de um pé humano
//    (jogador.js passoPeDesenhado: trajetória do balanço até o ponto de pouso, altura do passo,
//    gesto do toque e arco da pedalada); a simulação só planta o pé quando ele chega ao ponto;
//  - quadril: o teto pelo alcance das pernas (pé no chão; pé no ar na saída e no fim do
//    balanço) e, para cima, no máximo QUADRIL_SOBE (altura guardada pela simulação,
//    alturaQuadril) — o tornozelo preso pelo joelho não salta com o quadril.
// Sem three.js nem DOM. Saída: posições das juntas no mundo (Float32Array).
// Só MD (matdet.js) nas funções não exatas: a pose entra na simulação (sim.js j.quadril pela alturaQuadril e a cabeça
// desenhada no cabeceio, cabecaNaBola; goleiro.js parte de j.quadril no mergulho) e tem de sair igual em todo motor JS
// (online 1×1: tools/teste-math-proibido.mjs).

import { JOGADOR, PASSO, G, CONDUCAO, GOLEIRO, LATERAL, CABECEIO } from './config.js';
import { clamp, lerp, difAng } from './mat.js';
import { MD } from './matdet.js';
import { progressoBalanco } from './jogador.js';
import { mergulhoAtivo, quadroMergulho, maosMergulho, maoDaEspalmada, eixosMergulho, MAO_PRONTA_FRENTE, MAO_PRONTA_BAIXO, baseGoleiro } from './goleiro.js';
import { alturaSalto } from './bolas-paradas.js';
import { puloAtivo, quadroPulo, inclinacaoAte } from './cabeceio.js';
import { quadroReposicao, novoQuadroReposicao } from './reposicao.js';

export const JUNTAS = [
  'pelve', 'lombar', 'peito', 'pescoco', 'cabeca',
  'ombroE', 'cotoveloE', 'maoE', 'ombroD', 'cotoveloD', 'maoD',
  'quadrilE', 'joelhoE', 'tornozeloE', 'pontaE',
  'quadrilD', 'joelhoD', 'tornozeloD', 'pontaD',
];
export const NJ = JUNTAS.length;
export const J = Object.fromEntries(JUNTAS.map((n, i) => [n, i]));

// [junta A, junta B, raio A, raio B, parte] — parte: 'pele' | 'camisa' | 'calcao' | 'meiao' | 'chuteira'
export const SEGMENTOS = [
  [J.pelve, J.lombar, 0.135, 0.13, 'calcao'],
  [J.lombar, J.peito, 0.13, 0.155, 'camisa'],
  [J.peito, J.pescoco, 0.12, 0.06, 'camisa'],
  [J.pescoco, J.cabeca, 0.055, 0.05, 'pele'],
  [J.ombroE, J.ombroD, 0.065, 0.065, 'camisa'],
  [J.ombroE, J.cotoveloE, 0.055, 0.045, 'camisa'],
  [J.cotoveloE, J.maoE, 0.04, 0.035, 'pele'],
  [J.ombroD, J.cotoveloD, 0.055, 0.045, 'camisa'],
  [J.cotoveloD, J.maoD, 0.04, 0.035, 'pele'],
  [J.quadrilE, J.quadrilD, 0.1, 0.1, 'calcao'],
  [J.quadrilE, J.joelhoE, 0.085, 0.062, 'calcao'],
  [J.joelhoE, J.tornozeloE, 0.058, 0.04, 'meiao'],
  [J.tornozeloE, J.pontaE, 0.045, 0.035, 'chuteira'],
  [J.quadrilD, J.joelhoD, 0.085, 0.062, 'calcao'],
  [J.joelhoD, J.tornozeloD, 0.058, 0.04, 'meiao'],
  [J.tornozeloD, J.pontaD, 0.045, 0.035, 'chuteira'],
];
export const RAIO_CABECA = 0.115;

// ---- O corpo DESENHADO como sólido (C3, revisão de 29/10: "nada atravessa o goleiro" pelo que se VÊ). A forma de cada
// segmento no manequim (render/jogador3d.js lê daqui): os raios [A, B] quando o desenho troca os de SEGMENTOS (pelve e quadril
// mais enxutos) e o ACHATAMENTO frente–trás (1 = redondo; o tronco tem 0,68 da largura na profundidade). `sup`: o "frente" da
// seção vem dos ombros (true) ou dos quadris (false) — a mesma regra do desenho. O goleiro tem a luva no antebraço.
const FORMA_DESENHO = {
  'pelve-lombar': { achata: 0.74, r: [0.118, 0.13] },
  'lombar-peito': { achata: 0.68 },
  'peito-pescoco': { achata: 0.78 },
  'ombroE-ombroD': { achata: 0.85 },
  'quadrilE-quadrilD': { achata: 0.84, r: [0.088, 0.088] },
  'tornozeloE-pontaE': { achata: 0.8 },
  'tornozeloD-pontaD': { achata: 0.8 },
};
export const FORMA_SEG = SEGMENTOS.map(([a, b, ra, rb]) => {
  const na = JUNTAS[a], nb = JUNTAS[b], f = FORMA_DESENHO[`${na}-${nb}`] ?? {};
  return { rA: f.r ? f.r[0] : ra, rB: f.r ? f.r[1] : rb, achata: f.achata ?? 1, sup: !/quadril|joelho|tornozelo|ponta|pelve/.test(na + nb) };
});
export const FORMA_SEG_GOL = FORMA_SEG.map((f, i) => (/^cotovelo/.test(JUNTAS[SEGMENTOS[i][0]]) && /^mao/.test(JUNTAS[SEGMENTOS[i][1]]) ? { ...f, rA: 0.046, rB: 0.05 } : f));
// a cabeça (elipsoide RAIO_CABECA × [largura, altura, profundidade]) e o cabelo (a calota de cima de outro elipsoide, até
// CABELO_CALOTA da altura abaixo do centro, deslocado para cima e para trás) — os do desenho
export const CABECA_ESCALA = [0.92, 1.1, 1.0], CABELO_ESCALA = [0.98, 1.08, 1.08], CABELO_DESLOCA = [0.12, -0.1], CABELO_CALOTA = 0.063;
const NSOL = SEGMENTOS.length + 2, TAM_SOL = 17;

/** O "frente" do desenho pela linha iE → iD (ombros ou quadris) e o eixo pelve → pescoço: a cópia do render/jogador3d.js frente. */
function frenteDesenho(P, iE, iD, out) {
  const rx = P[iD * 3] - P[iE * 3], ry = P[iD * 3 + 1] - P[iE * 3 + 1], rz = P[iD * 3 + 2] - P[iE * 3 + 2];
  const l0 = Math.sqrt(rx * rx + rz * rz) || 1;
  const ip = J.pelve * 3, iq = J.pescoco * 3;
  const ux = P[iq] - P[ip], uy = P[iq + 1] - P[ip + 1], uz = P[iq + 2] - P[ip + 2];
  const k = clamp((0.87 - uy / (Math.sqrt(ux * ux + uy * uy + uz * uz) || 1)) / 0.16, 0, 1);
  if (k === 0) { out[0] = rz / l0; out[1] = 0; out[2] = -rx / l0; return out; }
  let fx = uy * rz - uz * ry, fy = uz * rx - ux * rz, fz = ux * ry - uy * rx;
  let l = Math.sqrt(fx * fx + fy * fy + fz * fz);
  if (l < 1e-6) { fx = rz; fy = 0; fz = -rx; l = l0; }
  fx = (rz / l0) * (1 - k) + (fx / l) * k; fy = (fy / l) * k; fz = (-rx / l0) * (1 - k) + (fz / l) * k;
  l = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  out[0] = fx / l; out[1] = fy / l; out[2] = fz / l;
  return out;
}
const _fSup = [0, 0, 0], _fInf = [0, 0, 0];

/**
 * Os sólidos do corpo desenhado da pose P (juntas no mundo) em C: por segmento a origem A, o eixo Y (unitário) e o
 * comprimento, os eixos X e Z da seção (Z = o "frente" do desenho, achatado) e os raios rA, rB e o achatamento — os
 * mesmos referenciais do render/jogador3d.js; depois a cabeça e o cabelo (centro, eixos e semieixos). Pura.
 */
export function solidosCorpo(P, goleiro = false, C = new Float64Array(NSOL * TAM_SOL)) {
  frenteDesenho(P, J.ombroE, J.ombroD, _fSup);
  frenteDesenho(P, J.quadrilE, J.quadrilD, _fInf);
  const F = goleiro ? FORMA_SEG_GOL : FORMA_SEG;
  for (let s = 0; s < SEGMENTOS.length; s++) {
    const ia = SEGMENTOS[s][0] * 3, ib = SEGMENTOS[s][1] * 3, o = s * TAM_SOL;
    let yx = P[ib] - P[ia], yy = P[ib + 1] - P[ia + 1], yz = P[ib + 2] - P[ia + 2];
    let len = Math.sqrt(yx * yx + yy * yy + yz * yz);
    if (len < 1e-5) { yx = 0; yy = 1; yz = 0; len = 1e-5; } else { yx /= len; yy /= len; yz /= len; }
    const ref = F[s].sup ? _fSup : _fInf;
    const dp = Math.abs(ref[0] * yx + ref[1] * yy + ref[2] * yz);
    const k = clamp((dp - 0.6) / 0.3, 0, 1);
    let zx = ref[0] * (1 - k), zy = ref[1] * (1 - k) + k, zz = ref[2] * (1 - k);
    const zy0 = zx * yx + zy * yy + zz * yz;
    zx -= zy0 * yx; zy -= zy0 * yy; zz -= zy0 * yz;
    if (zx * zx + zy * zy + zz * zz < 1e-8) { zx = 1 - yx * yx; zy = -yx * yy; zz = -yx * yz; }
    const zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
    zx /= zl; zy /= zl; zz /= zl;
    C[o] = P[ia]; C[o + 1] = P[ia + 1]; C[o + 2] = P[ia + 2];
    C[o + 3] = yx; C[o + 4] = yy; C[o + 5] = yz; C[o + 6] = len;
    C[o + 7] = yy * zz - yz * zy; C[o + 8] = yz * zx - yx * zz; C[o + 9] = yx * zy - yy * zx;
    C[o + 10] = zx; C[o + 11] = zy; C[o + 12] = zz;
    C[o + 13] = F[s].rA; C[o + 14] = F[s].rB; C[o + 15] = F[s].achata; C[o + 16] = 0;
  }
  // cabeça: "cima" pelo pescoço, "frente" pela média de ombros e quadris (o desenho)
  const ic = J.cabeca * 3, iq = J.pescoco * 3;
  let yx = P[ic] - P[iq], yy = P[ic + 1] - P[iq + 1], yz = P[ic + 2] - P[iq + 2];
  const yl = Math.sqrt(yx * yx + yy * yy + yz * yz) || 1;
  yx /= yl; yy /= yl; yz /= yl;
  let zx = _fSup[0] + _fInf[0], zy = _fSup[1] + _fInf[1], zz = _fSup[2] + _fInf[2];
  const zy0 = zx * yx + zy * yy + zz * yz;
  zx -= zy0 * yx; zy -= zy0 * yy; zz -= zy0 * yz;
  const zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  const xx = yy * zz - yz * zy, xy = yz * zx - yx * zz, xz = yx * zy - yy * zx;
  const R = RAIO_CABECA;
  for (let h = 0; h < 2; h++) {
    const o = (SEGMENTOS.length + h) * TAM_SOL, E = h ? CABELO_ESCALA : CABECA_ESCALA;
    const dy = h ? R * CABELO_DESLOCA[0] : 0, dz = h ? R * CABELO_DESLOCA[1] : 0;
    C[o] = P[ic] + yx * dy + zx * dz; C[o + 1] = P[ic + 1] + yy * dy + zy * dz; C[o + 2] = P[ic + 2] + yz * dy + zz * dz;
    C[o + 3] = yx; C[o + 4] = yy; C[o + 5] = yz; C[o + 6] = -1; // (−1: elipsoide)
    C[o + 7] = xx; C[o + 8] = xy; C[o + 9] = xz; C[o + 10] = zx; C[o + 11] = zy; C[o + 12] = zz;
    C[o + 13] = R * E[0]; C[o + 14] = R * E[1]; C[o + 15] = R * E[2]; C[o + 16] = h ? -CABELO_CALOTA : -2;
  }
  return C;
}

/**
 * A esfera de raio rb com centro em (x, y, z) entra em algum sólido de C (solidosCorpo)? Por sólido, a distância
 * normalizada q (< 1 = dentro: os semieixos da seção somados a rb); devolve o menor q e, em out, a normal para fora dele
 * (`nx`, `ny`, `nz`) e quanto falta para a superfície por ela (`prof`, m). Pura.
 */
export function corpoNoPonto(C, x, y, z, rb, out) {
  let qMin = Infinity;
  for (let s = 0; s < NSOL; s++) {
    const o = s * TAM_SOL;
    const wx = x - C[o], wy = y - C[o + 1], wz = z - C[o + 2];
    let ox, oy, oz, ax, ay, az;
    if (C[o + 6] >= 0) {
      // cápsula afunilada e achatada: o ponto do eixo mais perto, o raio ali e as calotas nas pontas
      const len = C[o + 6];
      const t = clamp((wx * C[o + 3] + wy * C[o + 4] + wz * C[o + 5]) / len, 0, 1);
      const r = C[o + 13] + (C[o + 14] - C[o + 13]) * t;
      const px = wx - C[o + 3] * len * t, py = wy - C[o + 4] * len * t, pz = wz - C[o + 5] * len * t;
      ox = px * C[o + 7] + py * C[o + 8] + pz * C[o + 9];
      oy = px * C[o + 3] + py * C[o + 4] + pz * C[o + 5];
      oz = px * C[o + 10] + py * C[o + 11] + pz * C[o + 12];
      ax = r + rb; ay = r + rb; az = r * C[o + 15] + rb;
    } else {
      // elipsoide (cabeça; o cabelo só na calota de cima)
      ox = wx * C[o + 7] + wy * C[o + 8] + wz * C[o + 9];
      oy = wx * C[o + 3] + wy * C[o + 4] + wz * C[o + 5];
      oz = wx * C[o + 10] + wy * C[o + 11] + wz * C[o + 12];
      ax = C[o + 13] + rb; ay = C[o + 14] + rb; az = C[o + 15] + rb;
      if (oy < C[o + 16] * C[o + 14]) continue;
    }
    const u = ox / ax, v = oy / ay, w = oz / az;
    const q = Math.sqrt(u * u + v * v + w * w);
    if (q >= qMin) continue;
    qMin = q;
    if (out) {
      // a normal: o gradiente da forma normalizada, de volta para o mundo
      const gx = u / ax, gy = v / ay, gz = w / az;
      let nx = gx * C[o + 7] + gy * C[o + 3] + gz * C[o + 10];
      let ny = gx * C[o + 8] + gy * C[o + 4] + gz * C[o + 11];
      let nz = gx * C[o + 9] + gy * C[o + 5] + gz * C[o + 12];
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-9) { nx = 0; ny = 1; nz = 0; } else { nx /= nl; ny /= nl; nz /= nl; }
      out.nx = nx; out.ny = ny; out.nz = nz;
      // (a distância até a superfície pela normal: o semieixo médio na direção dela × o que falta)
      const sx = ox / (q || 1), sy = oy / (q || 1), sz = oz / (q || 1);
      out.prof = (1 - q) * Math.sqrt(sx * sx + sy * sy + sz * sz);
      out.q = q;
    }
  }
  return qMin;
}

const L1 = JOGADOR.coxa, L2 = JOGADOR.canela;
const LMAX = (L1 + L2) * 0.998;
const TORN = JOGADOR.alturaTornozelo;
const MEIO_QUADRIL = JOGADOR.larguraQuadril / 2;
const QUEDA_BALANCO = 0.12; // m — quanto o pé no balanço pode baixar o quadril
const QUADRIL_SOBE = 1.5;   // m/s — o quadril sobe no máximo isto (desce direto ao alcance das pernas)

function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/**
 * Pé p (tornozelo) e se está no apoio. Pura. comBola = o jogador tem a posse AGORA (a mesma
 * conta da simulação). No chão: o ponto plantado. No balanço: o pé desenhado que a simulação
 * integra com a velocidade de um pé humano (jogador.js passoPeDesenhado: trajetória até o ponto
 * de pouso, altura do passo e gesto do toque) — a pose só lê o estado.
 */
export function pePrevisto(j, p, comBola) {
  const pe = j.pes[p];
  if (pe.apoio) return { x: pe.x, y: TORN, z: pe.z, apoio: true, rumo: pe.rumo, u: 0 };
  const { u, meioApoio } = progressoBalanco(j, p, comBola);
  // + (ox, oz): só o desenho — a chuteira para na superfície da bola (jogador.js passoPeDesenhado; zero no pouso)
  return { x: pe.tx + pe.ox, y: pe.ty, z: pe.tz + pe.oz, apoio: false, rumo: pe.lrumo, u, meioApoio };
}

/** IK de dois ossos da perna: quadril H, alvo T, polo (direção para onde o joelho aponta). Exportada para a cena de
 * comemoração (comemoracao.js: joelhos, agachado, pulo); a pose do jogo usa a mesma. */
export function ik(hx, hy, hz, tx, ty, tz, px, py, pz, out, iJoelho, iTorn) {
  let dx = tx - hx, dy = ty - hy, dz = tz - hz;
  let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const dd = clamp(d, 0.05, LMAX);
  const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  // componente do polo perpendicular ao eixo
  const pd = px * ux + py * uy + pz * uz;
  let qx = px - pd * ux, qy = py - pd * uy, qz = pz - pd * uz;
  const ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
  qx /= ql; qy /= ql; qz /= ql;
  out[iJoelho * 3] = hx + ux * a + qx * h;
  out[iJoelho * 3 + 1] = hy + uy * a + qy * h;
  out[iJoelho * 3 + 2] = hz + uz * a + qz * h;
  out[iTorn * 3] = hx + ux * dd;
  out[iTorn * 3 + 1] = hy + uy * dd;
  out[iTorn * 3 + 2] = hz + uz * dd;
}

function por(out, i, x, y, z) { out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z; }

/**
 * Pés e quadril do jogador j no tick atual (parte comum da pose e da altura do quadril que a
 * simulação guarda): alvos dos tornozelos e o TETO do quadril — a altura nominal com o balanço da
 * passada, limitada pelo alcance das pernas.
 */
function pesEQuadril(j, m) {
  const tick = m.tick;
  const s = MD.hypot(j.vx, j.vz);
  const h = j.rumo;
  const fx = MD.cos(h), fz = MD.sin(h);   // frente
  const rx = -fz, rz = fx;                    // direita
  const af = j.ax * fx + j.az * fz;           // aceleração para a frente
  const al = j.ax * rx + j.az * rz;           // aceleração para a direita
  const c = j.cond;

  // ---- pés (alvos dos tornozelos)
  const comBola = m.posse === j.id;
  const pes = [pePrevisto(j, 0, comBola), pePrevisto(j, 1, comBola)];
  // (o gesto do toque — o pé livre indo até a bola — e o arco da pedalada já estão no pé
  // desenhado da simulação: jogador.js passoPeDesenhado)

  // ---- quadril: altura nominal + balanço da passada, limitada pelo alcance das pernas
  // (partida: o goleiro na base dobra os joelhos — goleiro.js baseGoleiro)
  const agach = 0.03 + 0.05 * clamp(s / 7, 0, 1) + GOLEIRO.realista.mov.agacha * baseGoleiro(m, j, s);
  let hy = 0.985 - agach;
  // balanço vertical: mais baixo no meio do apoio, mais alto no voo
  const bob = (0.012 + 0.03 * clamp(s / 6, 0, 1)) * MD.cos(2 * Math.PI * (j.fase % 1));
  hy -= bob;
  // deslocamento lateral do quadril sobre o pé de apoio (pequeno) e na pedalada
  let lat = 0.025 * clamp(1 - s / 4, 0, 1) * MD.sin(Math.PI * j.fase);
  if (c && c.pedalada) {
    const tp = clamp((tick - c.pedalada.tick0) * PASSO / CONDUCAO.pedaladaDuracao, 0, 1);
    lat += c.pedalada.lado * 0.12 * MD.sin(Math.PI * tp);
  }
  const px = j.x + rx * lat, pz = j.z + rz * lat;
  // rotação do quadril com a passada (pequena) — o ombro gira ao contrário
  const torcao = 0.08 * clamp(s / 5, 0.2, 1) * MD.sin(Math.PI * j.fase);
  const qh = h + torcao;
  const qrx = -MD.sin(qh), qrz = MD.cos(qh);
  // O pé no balanço também segura o quadril: na saída exatamente como o pé no chão (a perna
  // alcança o pé que acabou de sair) e, no fim do balanço, pelo ponto de pouso (a perna alcança o
  // ponto onde o pé vai ser plantado — e não o pé esticado à frente antes de recuar para o pouso).
  // No meio do balanço a perna pode encolher: o quadril fica até QUEDA_BALANCO abaixo do nominal.
  // O peso vai de 0 a 1 e volta a 0 pela fase do balanço: o quadril não salta quando o pé sai do
  // chão (o pé que ficou para trás segurava o quadril baixo) nem quando pousa.
  const hyNom = hy;
  const alcance = (x, y, z, qx, qz) => y + Math.sqrt(Math.max(0, LMAX * LMAX - (x - qx) * (x - qx) - (z - qz) * (z - qz))) - 0.002;
  for (let p = 0; p < 2; p++) {
    const pe = pes[p];
    const lado = p === 0 ? -1 : 1;
    const qx = px + qrx * lado * MEIO_QUADRIL, qz = pz + qrz * lado * MEIO_QUADRIL;
    let maxY;
    if (pe.apoio) maxY = alcance(pe.x, pe.y, pe.z, qx, qz);
    else {
      // o ponto que a perna precisa alcançar vai do pé (logo depois da saída) ao ponto de pouso
      // visto do corpo (no fim do balanço): meio apoio à frente, como a passada planta o pé (mais
      // um tick no fim: o pé desenhado chega ao ponto de pouso um tick antes de ser plantado).
      // Não é o pé desenhado no fim do balanço: ele passa um pouco do pouso e recua (a perna não
      // estica até lá, o joelho segue dobrado). Com o pé já no ponto de pouso (u = 1), o próprio pé.
      const a = suave((pe.u - 0.25) / 0.5);
      const tp = pe.meioApoio + PASSO * suave((pe.u - 0.8) / 0.2);
      const m0 = pe.u >= 1 ? alcance(pe.x, pe.y, pe.z, qx, qz)
        : alcance(lerp(pe.x, qx + j.vx * tp, a), lerp(pe.y, TORN, a), lerp(pe.z, qz + j.vz * tp, a), qx, qz);
      const solto = hyNom - QUEDA_BALANCO;
      maxY = solto > m0 ? m0 + suave(2 * Math.min(pe.u, 1 - pe.u)) * (solto - m0) : m0;
    }
    if (hy > maxY) hy = maxY;
  }
  // cabeceio (cabeceio.js): no pulo, o quadril é o do quadro do pulo (contramovimento, subida, queda), no máximo onde as
  // pernas alcançam os pés (os pés no ar, que a simulação leva com o corpo, também sobem)
  let hyPulo = null;
  if (j.cab && puloAtivo(j, tick)) {
    const q = quadroPulo(j.cab, tick, _qpulo);
    let teto = Infinity;
    for (let p = 0; p < 2; p++) {
      const pe = pes[p], lado = p === 0 ? -1 : 1;
      teto = Math.min(teto, alcance(pe.x, pe.y, pe.z, px + qrx * lado * MEIO_QUADRIL, pz + qrz * lado * MEIO_QUADRIL));
    }
    hyPulo = Math.min(teto, CABECEIO.hyPe + q.off);
  }
  return { s, h, fx, fz, rx, rz, af, al, c, pes, px, pz, qrx, qrz, torcao, hy, hyPulo };
}
const _qpulo = { off: 0, w: 0, arco: 0, braco: 0 };

/**
 * Altura do quadril neste tick: o teto (alcance das pernas) e, para cima, no máximo
 * QUADRIL_SOBE·PASSO acima da altura do tick anterior (j.quadril, guardada pela simulação). Para
 * baixo vai direto ao teto (a perna sempre alcança o pé plantado); para cima sobe com a velocidade
 * de um quadril humano — sem saltos quando um pé deixa de segurar o quadril (o pé no ar que
 * passa por baixo do corpo, o pé que pousa).
 */
export function alturaQuadril(j, m) {
  // goleiro na defesa desenhada: a altura do quadro do mergulho (goleiro.js quadroMergulho)
  if (j.posicao === 'GOL' && mergulhoAtivo(j, m.tick)) return quadroMergulho(j.mergulho, m.tick, _qa).h;
  const { hy, hyPulo } = pesEQuadril(j, m);
  // no pulo do cabeceio, o quadril do quadro (sobe com a impulsão, não com o limite de quem anda)
  if (hyPulo != null) return hyPulo;
  return j.quadril == null ? hy : Math.min(hy, j.quadril + QUADRIL_SOBE * PASSO);
}

/**
 * Pose do jogador j no tick atual do mundo m. Escreve em out (Float32Array(3·NJ)) e devolve.
 * Também devolve em info (opcional) os alvos dos pés para o teste de patinação. A altura do
 * quadril é a guardada pela simulação (alturaQuadril), nunca acima do teto deste tick.
 */
export function pose(j, m, out = new Float32Array(NJ * 3), info = null) {
  if (j.posicao === 'GOL' && mergulhoAtivo(j, m.tick)) return poseMergulho(j, m, out, info);
  const { s, h, fx, fz, rx, rz, af, al, c, pes, px, pz, qrx, qrz, torcao, hy: teto, hyPulo } = pesEQuadril(j, m);
  // goleiro na reposição com a mão (C5; reposicao.js quadroReposicao, a mesma conta da bola do estado): o corpo desce e
  // inclina rolando, os braços levam a bola e a perna do chute vai à bola (só desenho: o quadril da simulação não muda)
  const qr = j.posicao === 'GOL' && j.arremessoGk ? quadroReposicao(j, m, _qr) : null;
  const hy = (hyPulo != null ? hyPulo : j.quadril == null ? teto : Math.min(teto, j.quadril)) - (qr ? qr.desce : 0);
  por(out, J.pelve, px, hy, pz);

  // ---- tronco: inclinação para a frente (velocidade + aceleração) e para o lado (curva)
  let pitch = 0.03 + 0.022 * s + MD.atan2(af, G) * 0.8 + GOLEIRO.realista.mov.inclina * baseGoleiro(m, j, s);
  pitch = clamp(pitch, -0.3, 0.42) + (qr ? qr.inclina : 0);
  const roll = clamp(MD.atan2(al, G) * 0.7, -0.35, 0.35);
  // vetor "para cima" do tronco: gira em torno do eixo direito (pitch) e da frente (roll)
  const cp = MD.cos(pitch), sp = MD.sin(pitch), cr = MD.cos(roll), sr = MD.sin(roll);
  let ux = fx * sp * cr + rx * sr * cp;
  let uy = cp * cr;
  let uz = fz * sp * cr + rz * sr * cp;
  // cabeceio (cabeceio.js): o tronco inclina para a cabeça ir ao ponto do contato (a bola no tick tc), arqueado para trás
  // na subida e chicoteando para a frente no contato — a simulação confere o contato com ESTA cabeça (sim.js)
  let braco = 0;
  if (hyPulo != null) {
    const cb = j.cab, q = quadroPulo(cb, m.tick, _qpulo);
    braco = q.braco;
    if (q.w > 0) {
      inclinacaoAte(px, hy, pz, cb.bx, cb.by, cb.bz, _ic);
      let dx = cb.bx - px, dz = cb.bz - pz;
      const L = MD.hypot(dx, dz);
      if (L > 1e-3) { dx /= L; dz /= L; } else { dx = fx; dz = fz; }
      const a = _ic.a * q.w - CABECEIO.arco * q.arco;
      const lx = dx * MD.sin(a), ly = MD.cos(a), lz = dz * MD.sin(a);
      ux += (lx - ux) * q.w; uy += (ly - uy) * q.w; uz += (lz - uz) * q.w;
      const l = MD.hypot(ux, uy, uz) || 1;
      ux /= l; uy /= l; uz /= l;
    }
  }
  const lomb = [px + ux * 0.17, hy + uy * 0.17, pz + uz * 0.17];
  por(out, J.lombar, lomb[0], lomb[1], lomb[2]);
  const pei = [lomb[0] + ux * 0.22, lomb[1] + uy * 0.22, lomb[2] + uz * 0.22];
  por(out, J.peito, pei[0], pei[1], pei[2]);
  const pes2 = [pei[0] + ux * 0.13, pei[1] + uy * 0.13, pei[2] + uz * 0.13];
  por(out, J.pescoco, pes2[0], pes2[1], pes2[2]);
  // cabeça: um pouco para a frente e olhando a bola
  por(out, J.cabeca, pes2[0] + ux * 0.13 + fx * 0.02, pes2[1] + uy * 0.13, pes2[2] + uz * 0.13 + fz * 0.02);

  // ---- ombros e braços (contrafase com as pernas)
  // goleiro sem a bola, de pé e devagar (ou com chute vindo): mãos prontas (o braço vai por IK até elas)
  const pronto = j.posicao === 'GOL' && m.naMao !== j.id
    ? (j.defesa && !j.defesa.fora ? 1 : clamp(1 - (s - 2) / 2, 0, 1)) : 0;
  // goleiro com a bola nas mãos: as palmas dos dois lados da bola (goleiro.js bolaNaMao; o encaixe desenhado
  // termina nesse mesmo ponto — sem salto de braço ao acabar a defesa)
  const segura = j.posicao === 'GOL' && m.naMao === j.id;
  const sgx = MD.cos(j.rumo), sgz = MD.sin(j.rumo);
  // lateral (Regra 15): o cobrador segura a bola com as duas mãos atrás da cabeça e a leva no arco do arremesso (a bola
  // do estado: lateral.js segurarLateral); depois da soltura os braços seguem o arremesso por LATERAL.seguimento s
  const pr = m.parada;
  const lat = !!(pr && pr.tipo === 'lateral' && !pr.rolou && pr.cobrador === j.id);
  let segue = -1;
  if (!lat && j.arremesso) { const t = (m.tick - j.arremesso.tick) * PASSO; if (t >= 0 && t < LATERAL.seguimento) segue = t / LATERAL.seguimento; }
  const oh = h - torcao * 1.4;
  const orx = -MD.sin(oh), orz = MD.cos(oh);
  const ofx = MD.cos(oh), ofz = MD.sin(oh);
  const amp = lerp(0.25, 0.95, clamp(s / 7, 0, 1));
  const flex = lerp(0.35, 1.45, clamp(s / 5, 0, 1));
  for (let lado = -1; lado <= 1; lado += 2) {
    const iO = lado < 0 ? J.ombroE : J.ombroD;
    const iC = lado < 0 ? J.cotoveloE : J.cotoveloD;
    const iM = lado < 0 ? J.maoE : J.maoD;
    const ox = pei[0] + ux * 0.07 + orx * lado * 0.19;
    const oy = pei[1] + uy * 0.07;
    const oz = pei[2] + uz * 0.07 + orz * lado * 0.19;
    por(out, iO, ox, oy, oz);
    // braço esquerdo vai à frente quando a perna direita vai à frente
    const balanco = amp * MD.sin(Math.PI * j.fase) * (lado < 0 ? 1 : -1);
    const abre = 0.12 + (c && c.pedalada ? 0.35 : 0);
    // direção do braço: para baixo girado para a frente por "balanco" e para fora por "abre"
    const bx = ofx * MD.sin(balanco) + orx * lado * MD.sin(abre);
    const by = -MD.cos(balanco) * MD.cos(abre);
    const bz = ofz * MD.sin(balanco) + orz * lado * MD.sin(abre);
    const cxp = ox + bx * 0.29, cyp = oy + by * 0.29, czp = oz + bz * 0.29;
    por(out, iC, cxp, cyp, czp);
    const a2 = balanco + flex;
    const fbx = ofx * MD.sin(a2) + orx * lado * 0.08;
    const fby = -MD.cos(a2);
    const fbz = ofz * MD.sin(a2) + orz * lado * 0.08;
    por(out, iM, cxp + fbx * 0.26, cyp + fby * 0.26, czp + fbz * 0.26);
    if (pronto > 0) {
      // goleiro: mãos prontas à frente da cintura (a mesma espera da defesa desenhada — goleiro.js maosMergulho)
      const ax = ox + fx * MAO_PRONTA_FRENTE - ux * MAO_PRONTA_BAIXO, ay = oy - uy * MAO_PRONTA_BAIXO, az = oz + fz * MAO_PRONTA_FRENTE - uz * MAO_PRONTA_BAIXO;
      const mx = out[iM * 3] + (ax - out[iM * 3]) * pronto, my = out[iM * 3 + 1] + (ay - out[iM * 3 + 1]) * pronto, mz = out[iM * 3 + 2] + (az - out[iM * 3 + 2]) * pronto;
      ikBraco(ox, oy, oz, mx, my, mz, orx * lado - ux * 0.4 - fx * 0.2, -uy * 0.4, orz * lado - uz * 0.4 - fz * 0.2, out, iC, iM);
    } else if (segura) {
      // as palmas dos dois lados da bola (a bola do estado: goleiro.js bolaNaMao a leva ao ponto de segurar)
      const bp = m.bola.p;
      ikBraco(ox, oy, oz, bp.x - sgz * lado * BOLA_MAO.palma, bp.y, bp.z + sgx * lado * BOLA_MAO.palma,
        orx * lado - ux * 0.4 - fx * 0.2, -uy * 0.4, orz * lado - uz * 0.4 - fz * 0.2, out, iC, iM);
    } else if (lat) {
      // lateral: as palmas dos dois lados da bola, acima da cabeça; os cotovelos para fora e para a frente
      const bp = m.bola.p;
      ikBraco(ox, oy, oz, bp.x - sgz * lado * BOLA_MAO.palma, bp.y, bp.z + sgx * lado * BOLA_MAO.palma,
        orx * lado * 0.7 + fx * 0.5 + ux * 0.3, uy * 0.3, orz * lado * 0.7 + fz * 0.5 + uz * 0.3, out, iC, iM);
    } else if (segue >= 0) {
      // depois da soltura: as mãos seguem para a frente e para baixo; no fim voltam ao balanço da passada
      const e = suave(segue), ar = j.arremesso;
      const afx = MD.cos(ar.rumo), afz = MD.sin(ar.rumo);
      const fr = LATERAL.soltaFrente + 0.3 * e, yy = LATERAL.soltaAltura - 0.75 * e;
      const w = segue < 0.6 ? 1 : (1 - segue) / 0.4;
      const tx = j.x + afx * fr - afz * lado * BOLA_MAO.palma, tz = j.z + afz * fr + afx * lado * BOLA_MAO.palma;
      const mx = out[iM * 3] + (tx - out[iM * 3]) * w, my = out[iM * 3 + 1] + (yy - out[iM * 3 + 1]) * w, mz = out[iM * 3 + 2] + (tz - out[iM * 3 + 2]) * w;
      ikBraco(ox, oy, oz, mx, my, mz, orx * lado * 0.7 + fx * 0.3 - ux * 0.2, -uy * 0.2, orz * lado * 0.7 + fz * 0.3 - uz * 0.2, out, iC, iM);
    } else if (braco > 0) {
      // pulo do cabeceio: os braços abrem para cima e para os lados (equilíbrio e proteção do espaço no alto)
      const ax = ox + orx * lado * 0.34 + fx * 0.12 + ux * 0.1, ay = oy + 0.12, az = oz + orz * lado * 0.34 + fz * 0.12 + uz * 0.1;
      const mx = out[iM * 3] + (ax - out[iM * 3]) * braco, my = out[iM * 3 + 1] + (ay - out[iM * 3 + 1]) * braco, mz = out[iM * 3 + 2] + (az - out[iM * 3 + 2]) * braco;
      ikBraco(ox, oy, oz, mx, my, mz, orx * lado * 0.3 - fx * 0.3 - ux * 0.5, -uy * 0.5, orz * lado * 0.3 - fz * 0.3 - uz * 0.5, out, iC, iM);
    }
    // reposição do goleiro (C5): a mão do gesto sobre a do desenho de agora, pelo peso (entra e sai sem salto)
    const ir = lado < 0 ? 0 : 1;
    if (qr && qr.w[ir] > 0) {
      const w = qr.w[ir], g = qr.m[ir];
      const mx = out[iM * 3] + (g.x - out[iM * 3]) * w, my = out[iM * 3 + 1] + (g.y - out[iM * 3 + 1]) * w, mz = out[iM * 3 + 2] + (g.z - out[iM * 3 + 2]) * w;
      ikBraco(ox, oy, oz, mx, my, mz, orx * lado - ux * 0.4 - fx * 0.2, -uy * 0.4, orz * lado - uz * 0.4 - fz * 0.2, out, iC, iM);
    }
  }

  // ---- pernas (IK) e pés
  for (let p = 0; p < 2; p++) {
    const lado = p === 0 ? -1 : 1;
    const iQ = p === 0 ? J.quadrilE : J.quadrilD;
    const iJ = p === 0 ? J.joelhoE : J.joelhoD;
    const iT = p === 0 ? J.tornozeloE : J.tornozeloD;
    const iP = p === 0 ? J.pontaE : J.pontaD;
    const qx = px + qrx * lado * MEIO_QUADRIL, qy = hy - 0.03, qz = pz + qrz * lado * MEIO_QUADRIL;
    por(out, iQ, qx, qy, qz);
    const pe = pes[p];
    const pr = pe.rumo ?? h;
    const pfx = MD.cos(pr), pfz = MD.sin(pr);
    // a perna do bate-pronto/chutão do goleiro (C5): o tornozelo do gesto sobre o desenhado, pelo peso
    const wc = qr && qr.pe === p ? qr.wp : 0;
    const ax = wc > 0 ? pe.x + (qr.p.x - pe.x) * wc : pe.x, ay = wc > 0 ? pe.y + (qr.p.y - pe.y) * wc : pe.y, az = wc > 0 ? pe.z + (qr.p.z - pe.z) * wc : pe.z;
    // joelho aponta para a frente do pé (um pouco para fora)
    ik(qx, qy, qz, ax, ay, az, pfx + qrx * lado * 0.1, 0.05, pfz + qrz * lado * 0.1, out, iJ, iT);
    const tx = out[iT * 3], ty = out[iT * 3 + 1], tz = out[iT * 3 + 2];
    // ponta do pé: no chão quando apoiado; no balanço aponta um pouco para baixo
    const incl = wc > 0 ? qr.ponta * wc : pe.apoio ? 0 : -0.35 * MD.sin(Math.PI * (pe.u ?? 0));
    por(out, iP, tx + pfx * 0.17 * MD.cos(incl), Math.max(0.025, ty - 0.055 + 0.17 * MD.sin(incl)), tz + pfz * 0.17 * MD.cos(incl));
    if (info) {
      info.pes = info.pes || [{}, {}];
      info.pes[p].apoio = pe.apoio && !(wc > 0);
      info.pes[p].x = tx; info.pes[p].y = ty; info.pes[p].z = tz;
      info.pes[p].alvoX = ax; info.pes[p].alvoZ = az;
    }
  }
  // barreira (Etapa 4): o pulo no chute sobe o corpo inteiro (bolas-paradas.js alturaSalto: a mesma conta da colisão);
  // o pulinho do pênalti (item 70, P2: alturaPulinho, só desenho) também
  const hs = (j.salto ? alturaSalto(j, m.tick) : 0) + alturaPulinho(j, m);
  if (hs > 0) for (let i = 1; i < out.length; i += 3) out[i] += hs;
  return out;
}

/**
 * O pulinho do pênalti (item 70, P2; corrida.js cr.pulo): no voo do penúltimo apoio até o pouso do pé de apoio ao lado da
 * bola, o corpo inteiro sobe h·sen²(π·v) — v, a fração do balanço do pé de apoio desde o começo do pulinho (u0): 0 na saída
 * do pé que bate, 1 no pouso (a subida e o pouso sem velocidade a mais: o pé não salta nem pousa batendo). Os dois pés
 * estão no ar. Só desenho (a simulação não lê: o ritmo do pulinho é a lógica da corrida).
 */
export function alturaPulinho(j, m) {
  const pr = m.parada, cr = pr && pr.corrida, pu = cr && cr.pulo;
  if (!pu || pr.rolou || pr.cobrador !== j.id || cr.plantou >= 0 || j.pes[cr.ps].apoio || j.pes[cr.pe].apoio) return 0;
  const u = progressoBalanco(j, cr.ps, m.posse === j.id).u;
  const v = clamp((u - pu.u0) / Math.max(1 - pu.u0, 1e-3), 0, 1), sv = MD.sin(Math.PI * v);
  return pu.h * sv * sv;
}

// ---------------------------------------------------------------- goleiro: mergulho, salto e defesa em pé
const _qa = {}, _qp = {}, _mp = {}, _ep = {};
const _qr = novoQuadroReposicao();
const _ic = { a: 0, y: 0 }; // cabeceio: inclinação do tronco
const BOLA_MAO = GOLEIRO.bolaMao;
export const BRACO = 0.29, ANTEBRACO = 0.26;

/** IK de dois ossos do braço: ombro O, mão M, polo (para onde o cotovelo aponta); escreve o cotovelo. Exportada para
 * os gestos da cena de comemoração (comemoracao.js). */
export function ikBraco(ox, oy, oz, mx, my, mz, px, py, pz, out, iCot, iMao) {
  let dx = mx - ox, dy = my - oy, dz = mz - oz;
  const d0 = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
  const ux = dx / d0, uy = dy / d0, uz = dz / d0;
  const d = clamp(d0, 0.05, (BRACO + ANTEBRACO) * 0.999);
  const a = (BRACO * BRACO - ANTEBRACO * ANTEBRACO + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, BRACO * BRACO - a * a));
  const pd = px * ux + py * uy + pz * uz;
  let qx = px - pd * ux, qy = py - pd * uy, qz = pz - pd * uz;
  const ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
  qx /= ql; qy /= ql; qz /= ql;
  por(out, iCot, ox + ux * a + qx * hh, oy + uy * a + qy * hh, oz + uz * a + qz * hh);
  por(out, iMao, ox + ux * d, oy + uy * d, oz + uz * d);
}

/**
 * Pose do goleiro na defesa desenhada (pura): quadril, tronco inclinado de lado (phi), pés e mãos do quadro do
 * mergulho (goleiro.js quadroMergulho / maosMergulho — a mesma conta da simulação). Pés no chão = o ponto
 * plantado; no ar = o tornozelo do quadro. info (opcional) como em pose().
 */
export function poseMergulho(j, m, out, info) {
  const g = j.mergulho;
  const q = quadroMergulho(g, m.tick, _qp);
  // segurando a bola (encaixe): as mãos a trazem para o peito (a mesma conta da bola nas mãos na simulação)
  const segura = m.naMao === j.id;
  // cima do tronco (inclinado de lado e para a frente) e direita do corpo: a mesma conta da simulação
  const e = eixosMergulho(g, q, _ep);
  const ux = e.ux, uy = e.uy, uz = e.uz, rx = e.rx, ry = e.ry, rz = e.rz;
  const px = q.x, py = q.h, pz = q.z;
  por(out, J.pelve, px, py, pz);
  const lx = px + ux * 0.17, ly = py + uy * 0.17, lz = pz + uz * 0.17;
  por(out, J.lombar, lx, ly, lz);
  const ex = lx + ux * 0.22, ey = ly + uy * 0.22, ez = lz + uz * 0.22;
  por(out, J.peito, ex, ey, ez);
  const nx = ex + ux * 0.13, ny = ey + uy * 0.13, nz = ez + uz * 0.13;
  por(out, J.pescoco, nx, ny, nz);
  // cabeça: no eixo do tronco, olhando para a bola (um pouco para a frente)
  por(out, J.cabeca, nx + ux * 0.13 + q.fx * 0.03, ny + uy * 0.13, nz + uz * 0.13 + q.fz * 0.03);
  // braços: ombros e mãos do quadro (depois do contato voltam à mão pronta, a mesma da pose de pé); na espalmada da bola
  // alta no mergulho, UMA mão vai à bola — a de cima (goleiro.js maoDaEspalmada; só desenho: a simulação confere a mão pelas
  // duas palmas, maoAlcanca, e a de uma mão chega quando ela chega)
  const mm = maosMergulho(g, q, _mp, segura, segura ? -1 : maoDaEspalmada(g));
  for (let p = 0; p < 2; p++) {
    const lado = p === 0 ? -1 : 1;
    const o = p === 0 ? mm.o0 : mm.o1, mao = p === 0 ? mm.m0 : mm.m1;
    por(out, p === 0 ? J.ombroE : J.ombroD, o.x, o.y, o.z);
    // cotovelo para fora e um pouco para trás (para baixo do braço)
    ikBraco(o.x, o.y, o.z, mao.x, mao.y, mao.z, rx * lado - ux * 0.4 - q.fx * 0.2, ry * lado - uy * 0.4, rz * lado - uz * 0.4 - q.fz * 0.2, out,
      p === 0 ? J.cotoveloE : J.cotoveloD, p === 0 ? J.maoE : J.maoD);
  }
  // pernas: quadris pela direita girada; tornozelos do quadro; joelhos para a frente
  for (let p = 0; p < 2; p++) {
    const lado = p === 0 ? -1 : 1;
    const iQ = p === 0 ? J.quadrilE : J.quadrilD, iJ = p === 0 ? J.joelhoE : J.joelhoD;
    const iT = p === 0 ? J.tornozeloE : J.tornozeloD, iP = p === 0 ? J.pontaE : J.pontaD;
    const hx = px + rx * lado * MEIO_QUADRIL - ux * 0.03, hyq = py + ry * lado * MEIO_QUADRIL - uy * 0.03, hz = pz + rz * lado * MEIO_QUADRIL - uz * 0.03;
    por(out, iQ, hx, hyq, hz);
    const a = p === 0 ? q.a0 : q.a1;
    const pe = j.pes[p];
    // plantado: exatamente o ponto plantado na simulação (y do tornozelo)
    const tx = pe.apoio ? pe.x : a.x, ty = pe.apoio ? TORN : a.y, tz = pe.apoio ? pe.z : a.z;
    ik(hx, hyq, hz, tx, ty, tz, q.fx + rx * lado * 0.1, 0.05, q.fz + rz * lado * 0.1, out, iJ, iT);
    const ax = out[iT * 3], ay = out[iT * 3 + 1], az = out[iT * 3 + 2];
    // ponta do pé: para a frente; no ar, esticada um pouco na direção da perna
    const estica = pe.apoio ? 0 : clamp((py - ay) < 0.5 ? 0.6 : 0.3, 0, 1);
    const dpx = q.fx * (1 - estica) - ux * estica, dpy = -uy * estica, dpz = q.fz * (1 - estica) - uz * estica;
    const dl = Math.sqrt(dpx * dpx + dpy * dpy + dpz * dpz) || 1;
    por(out, iP, ax + (dpx / dl) * 0.17, Math.max(0.025, ay - 0.055 + (dpy / dl) * 0.17), az + (dpz / dl) * 0.17);
    if (info) {
      info.pes = info.pes || [{}, {}];
      info.pes[p].apoio = pe.apoio;
      info.pes[p].x = ax; info.pes[p].y = ay; info.pes[p].z = az;
      info.pes[p].alvoX = tx; info.pes[p].alvoZ = tz;
    }
  }
  return out;
}

/** Interpola duas poses (desenho entre dois passos). */
export function interpolarPose(a, b, t, out) {
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}
