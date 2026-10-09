// Animação do jogador como FUNÇÃO PURA do estado (o replay depende disso).
// Passada procedural: pé de apoio travado no ponto em que pisou (IK de dois ossos na perna),
// pé no balanço indo do ponto onde saiu até o ponto onde vai pousar, quadril baixando para
// a perna alcançar, tronco inclinando pela aceleração (frente/trás) e pela curva (lado),
// braços em contrafase e o pé livre indo até a bola no toque.
// O pé desenhado nunca salta (tools/teste-patinacao.mjs mede todos os quadros):
//  - pé no chão = exatamente o ponto plantado na simulação (nem o toque o tira do lugar: o
//    toque sai sempre do pé livre — conducao.js peLivre);
//  - balanço pela fase entre a saída e o pouso guardados no pé (a fase nunca salta), mirando o
//    ponto em que a simulação planta o pé no fim do último tick do balanço;
//  - gesto do toque pelo peso `puxa` e o ponto `gx, gz` do estado (velocidade limitada,
//    conducao.js atualizarGesto), com desvio que encolhe perto da saída e do pouso do pé.
// Sem three.js nem DOM. Saída: posições das juntas no mundo (Float32Array).

import { JOGADOR, PASSADA, PASSO, G, CONDUCAO, GESTO } from './config.js';
import { clamp, lerp, difAng } from './mat.js';
import { progressoBalanco } from './jogador.js';

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
  const { u, livre, meioApoio } = progressoBalanco(j, p, comBola);
  return { x: pe.tx, y: pe.ty, z: pe.tz, apoio: false, rumo: pe.lrumo, u, livre, meioApoio };
}

/**
 * Desvia o pé da passada na direção de (cx, cy, cz), com peso w e no máximo dMax no chão. Perto
 * da saída e do pouso o desvio máximo encolhe junto com o tempo livre do pé (GESTO.velDesvio):
 * no chão ele é 0, e a velocidade extra do pé fica limitada por construção — vale para toque
 * cedo, tarde ou remarcado.
 */
function desviarPe(pe, cx, cy, cz, w, dMax, vDesvio) {
  if (pe.apoio || w <= 0) return;
  const lim = Math.min(dMax, vDesvio * pe.livre);
  if (lim <= 0) return;
  let dx = cx - pe.x, dz = cz - pe.z;
  const d = Math.hypot(dx, dz);
  if (d > lim) { dx *= lim / d; dz *= lim / d; }
  const wy = w * lim / dMax;
  pe.x += w * dx; pe.z += w * dz; pe.y = lerp(pe.y, cy, wy);
}

/** IK de dois ossos: quadril H, alvo T, polo (direção para onde o joelho aponta). */
function ik(hx, hy, hz, tx, ty, tz, px, py, pz, out, iJoelho, iTorn) {
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
  const s = Math.hypot(j.vx, j.vz);
  const h = j.rumo;
  const fx = Math.cos(h), fz = Math.sin(h);   // frente
  const rx = -fz, rz = fx;                    // direita
  const af = j.ax * fx + j.az * fz;           // aceleração para a frente
  const al = j.ax * rx + j.az * rz;           // aceleração para a direita
  const c = j.cond;

  // ---- pés (alvos dos tornozelos)
  const comBola = m.posse === j.id;
  const pes = [pePrevisto(j, 0, comBola), pePrevisto(j, 1, comBola)];
  if (c) {
    // (o gesto do toque — o pé livre indo até a bola — já está no pé desenhado da simulação)
    const bx = m.bola.p.x, bz = m.bola.p.z;
    // pedalada: o pé de fora passa por cima da bola em arco (só o pé livre)
    if (c.pedalada) {
      const tp = clamp((tick - c.pedalada.tick0) * PASSO / CONDUCAO.pedaladaDuracao, 0, 1);
      const lado = c.pedalada.lado;
      const p = pes[lado > 0 ? 0 : 1];
      const ang = Math.PI * tp;
      const cx = bx + rx * lado * 0.22 * Math.cos(ang) - fx * 0.1;
      const cz = bz + rz * lado * 0.22 * Math.cos(ang) - fz * 0.1;
      desviarPe(p, cx, TORN + 0.18 * Math.sin(ang), cz, Math.sin(Math.PI * tp), GESTO.desvio[0], GESTO.velDesvio[0]);
    }
  }

  // ---- quadril: altura nominal + balanço da passada, limitada pelo alcance das pernas
  const agach = 0.03 + 0.05 * clamp(s / 7, 0, 1);
  let hy = 0.985 - agach;
  // balanço vertical: mais baixo no meio do apoio, mais alto no voo
  const bob = (0.012 + 0.03 * clamp(s / 6, 0, 1)) * Math.cos(2 * Math.PI * (j.fase % 1));
  hy -= bob;
  // deslocamento lateral do quadril sobre o pé de apoio (pequeno) e na pedalada
  let lat = 0.025 * clamp(1 - s / 4, 0, 1) * Math.sin(Math.PI * j.fase);
  if (c && c.pedalada) {
    const tp = clamp((tick - c.pedalada.tick0) * PASSO / CONDUCAO.pedaladaDuracao, 0, 1);
    lat += c.pedalada.lado * 0.12 * Math.sin(Math.PI * tp);
  }
  const px = j.x + rx * lat, pz = j.z + rz * lat;
  // rotação do quadril com a passada (pequena) — o ombro gira ao contrário
  const torcao = 0.08 * clamp(s / 5, 0.2, 1) * Math.sin(Math.PI * j.fase);
  const qh = h + torcao;
  const qrx = -Math.sin(qh), qrz = Math.cos(qh);
  // O pé no balanço também segura o quadril: na saída exatamente como o pé no chão (a perna
  // alcança o pé que acabou de sair) e, no fim do balanço, pelo ponto de pouso (a perna alcança o
  // ponto onde o pé vai ser plantado — e não o pé esticado à frente antes de recuar para o pouso).
  // No meio do balanço a perna pode encolher: o quadril fica até QUEDA_BALANCO abaixo do nominal.
  // O peso vai de 0 a 1 e volta a 0 pela fase do balanço: o quadril não salta quando o pé sai do
  // chão (o pé que ficou para trás segurava o quadril baixo) nem quando pousa.
  const hyNom = hy;
  const alcance = (x, y, z, qx, qz) => y + Math.sqrt(Math.max(0, LMAX * LMAX - (x - qx) ** 2 - (z - qz) ** 2)) - 0.002;
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
  return { s, h, fx, fz, rx, rz, af, al, c, pes, px, pz, qrx, qrz, torcao, hy };
}

/**
 * Altura do quadril neste tick: o teto (alcance das pernas) e, para cima, no máximo
 * QUADRIL_SOBE·PASSO acima da altura do tick anterior (j.quadril, guardada pela simulação). Para
 * baixo vai direto ao teto (a perna sempre alcança o pé plantado); para cima sobe com a velocidade
 * de um quadril humano — sem saltos quando um pé deixa de segurar o quadril (o pé no ar que
 * passa por baixo do corpo, o pé que pousa).
 */
export function alturaQuadril(j, m) {
  const { hy } = pesEQuadril(j, m);
  return j.quadril == null ? hy : Math.min(hy, j.quadril + QUADRIL_SOBE * PASSO);
}

/**
 * Pose do jogador j no tick atual do mundo m. Escreve em out (Float32Array(3·NJ)) e devolve.
 * Também devolve em info (opcional) os alvos dos pés para o teste de patinação. A altura do
 * quadril é a guardada pela simulação (alturaQuadril), nunca acima do teto deste tick.
 */
export function pose(j, m, out = new Float32Array(NJ * 3), info = null) {
  const { s, h, fx, fz, rx, rz, af, al, c, pes, px, pz, qrx, qrz, torcao, hy: teto } = pesEQuadril(j, m);
  const hy = j.quadril == null ? teto : Math.min(teto, j.quadril);
  por(out, J.pelve, px, hy, pz);

  // ---- tronco: inclinação para a frente (velocidade + aceleração) e para o lado (curva)
  let pitch = 0.03 + 0.022 * s + Math.atan2(af, G) * 0.8;
  pitch = clamp(pitch, -0.3, 0.42);
  const roll = clamp(Math.atan2(al, G) * 0.7, -0.35, 0.35);
  // vetor "para cima" do tronco: gira em torno do eixo direito (pitch) e da frente (roll)
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const ux = fx * sp * cr + rx * sr * cp;
  const uy = cp * cr;
  const uz = fz * sp * cr + rz * sr * cp;
  const lomb = [px + ux * 0.17, hy + uy * 0.17, pz + uz * 0.17];
  por(out, J.lombar, lomb[0], lomb[1], lomb[2]);
  const pei = [lomb[0] + ux * 0.22, lomb[1] + uy * 0.22, lomb[2] + uz * 0.22];
  por(out, J.peito, pei[0], pei[1], pei[2]);
  const pes2 = [pei[0] + ux * 0.13, pei[1] + uy * 0.13, pei[2] + uz * 0.13];
  por(out, J.pescoco, pes2[0], pes2[1], pes2[2]);
  // cabeça: um pouco para a frente e olhando a bola
  por(out, J.cabeca, pes2[0] + ux * 0.13 + fx * 0.02, pes2[1] + uy * 0.13, pes2[2] + uz * 0.13 + fz * 0.02);

  // ---- ombros e braços (contrafase com as pernas)
  const oh = h - torcao * 1.4;
  const orx = -Math.sin(oh), orz = Math.cos(oh);
  const ofx = Math.cos(oh), ofz = Math.sin(oh);
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
    const balanco = amp * Math.sin(Math.PI * j.fase) * (lado < 0 ? 1 : -1);
    const abre = 0.12 + (c && c.pedalada ? 0.35 : 0);
    // direção do braço: para baixo girado para a frente por "balanco" e para fora por "abre"
    const bx = ofx * Math.sin(balanco) + orx * lado * Math.sin(abre);
    const by = -Math.cos(balanco) * Math.cos(abre);
    const bz = ofz * Math.sin(balanco) + orz * lado * Math.sin(abre);
    const cxp = ox + bx * 0.29, cyp = oy + by * 0.29, czp = oz + bz * 0.29;
    por(out, iC, cxp, cyp, czp);
    const a2 = balanco + flex;
    const fbx = ofx * Math.sin(a2) + orx * lado * 0.08;
    const fby = -Math.cos(a2);
    const fbz = ofz * Math.sin(a2) + orz * lado * 0.08;
    por(out, iM, cxp + fbx * 0.26, cyp + fby * 0.26, czp + fbz * 0.26);
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
    const pfx = Math.cos(pr), pfz = Math.sin(pr);
    // joelho aponta para a frente do pé (um pouco para fora)
    ik(qx, qy, qz, pe.x, pe.y, pe.z, pfx + qrx * lado * 0.1, 0.05, pfz + qrz * lado * 0.1, out, iJ, iT);
    const tx = out[iT * 3], ty = out[iT * 3 + 1], tz = out[iT * 3 + 2];
    // ponta do pé: no chão quando apoiado; no balanço aponta um pouco para baixo
    const incl = pe.apoio ? 0 : -0.35 * Math.sin(Math.PI * (pe.u ?? 0));
    por(out, iP, tx + pfx * 0.17 * Math.cos(incl), Math.max(0.025, ty - 0.055 + 0.17 * Math.sin(incl)), tz + pfz * 0.17 * Math.cos(incl));
    if (info) {
      info.pes = info.pes || [{}, {}];
      info.pes[p].apoio = pe.apoio;
      info.pes[p].x = tx; info.pes[p].y = ty; info.pes[p].z = tz;
      info.pes[p].alvoX = pe.x; info.pes[p].alvoZ = pe.z;
    }
  }
  return out;
}

/** Interpola duas poses (desenho entre dois passos). */
export function interpolarPose(a, b, t, out) {
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}
