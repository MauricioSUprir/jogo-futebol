// Animação do jogador como FUNÇÃO PURA do estado (o replay depende disso).
// Passada procedural: pé de apoio travado no ponto em que pisou (IK de dois ossos na perna),
// pé no balanço indo do ponto onde saiu até o ponto onde vai pousar, quadril baixando para
// a perna alcançar, tronco inclinando pela aceleração (frente/trás) e pela curva (lado),
// braços em contrafase e o pé indo até a bola no tick do toque.
// Sem three.js nem DOM. Saída: posições das juntas no mundo (Float32Array).

import { JOGADOR, PASSADA, PASSO, G, CONDUCAO } from './config.js';
import { clamp, lerp, difAng } from './mat.js';
import { infoPassada, faseLocal, pontoPouso } from './jogador.js';

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

function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/** Posição prevista do pé p (tornozelo no chão) e se está no apoio. Pura. */
export function pePrevisto(j, p, tick) {
  const pe = j.pes[p];
  const s = Math.hypot(j.vx, j.vz);
  const comBola = j.cond && j.cond.ult !== null;
  const { f, carga } = infoPassada(s, comBola);
  if (pe.apoio) return { x: pe.x, y: TORN, z: pe.z, apoio: true, rumo: pe.rumo, u: 0 };
  // balanço: de onde saiu até onde vai pousar
  const psi = faseLocal(j.fase, p);
  const ini = 2 * carga;
  const u = clamp((psi - ini) / Math.max(2 - ini, 1e-3), 0, 1);
  const tAte = Math.max(0, (2 - psi) / Math.max(f, 0.5));
  const alvo = pontoPouso(j, p, carga, f, tAte);
  const k = suave(u);
  const alt = lerp(0.07, PASSADA.alturaPasso + 0.1 * clamp((s - 4) / 4, 0, 1), clamp(s / 3, 0, 1));
  return {
    x: lerp(pe.x, alvo.x, k),
    y: TORN + alt * Math.sin(Math.PI * u),
    z: lerp(pe.z, alvo.z, k),
    apoio: false,
    rumo: alvo.rumo,
    u,
  };
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
 * Pose do jogador j no tick atual do mundo m. Escreve em out (Float32Array(3·NJ)) e devolve.
 * Também devolve em info (opcional) os alvos dos pés para o teste de patinação.
 */
export function pose(j, m, out = new Float32Array(NJ * 3), info = null) {
  const tick = m.tick;
  const s = Math.hypot(j.vx, j.vz);
  const h = j.rumo;
  const fx = Math.cos(h), fz = Math.sin(h);   // frente
  const rx = -fz, rz = fx;                    // direita
  const af = j.ax * fx + j.az * fz;           // aceleração para a frente
  const al = j.ax * rx + j.az * rz;           // aceleração para a direita
  const c = j.cond;

  // ---- pés (alvos dos tornozelos)
  const pes = [pePrevisto(j, 0, tick), pePrevisto(j, 1, tick)];
  // toque na bola: o pé vai até a bola no tick marcado e acompanha logo depois
  if (c) {
    const t = c.toque;
    if (t) {
      const falta = (t.tick - tick) * PASSO;
      if (falta >= 0 && falta < 0.16) {
        const w = suave(1 - falta / 0.16);
        const p = pes[t.pe];
        const dx = t.bx - j.x, dz = t.bz - j.z;
        const dl = Math.hypot(dx, dz) || 1;
        // o pé encosta atrás da bola, na direção do corpo até ela
        const cx = t.bx - (dx / dl) * 0.15, cz = t.bz - (dz / dl) * 0.15;
        p.x = lerp(p.x, cx, w); p.z = lerp(p.z, cz, w); p.y = lerp(p.y, TORN + 0.02, w);
        p.toque = true;
      }
    }
    const u = c.ult;
    if (u) {
      const passou = (tick - u.tick) * PASSO;
      if (passou >= 0 && passou < 0.12) {
        const w = 1 - suave(passou / 0.12);
        const p = pes[u.pe];
        if (!p.apoio) {
          const cx = u.bx - u.dx * 0.15 + u.dx * Math.min(0.25, u.v * passou * 0.5);
          const cz = u.bz - u.dz * 0.15 + u.dz * Math.min(0.25, u.v * passou * 0.5);
          p.x = lerp(p.x, cx, w); p.z = lerp(p.z, cz, w); p.y = lerp(p.y, TORN + 0.03, w);
          p.toque = true;
        }
      }
    }
    // pedalada: o pé passa por cima da bola em arco
    if (c.pedalada) {
      const tp = clamp((tick - c.pedalada.tick0) * PASSO / CONDUCAO.pedaladaDuracao, 0, 1);
      const lado = c.pedalada.lado;
      const pi = lado > 0 ? 0 : 1; // pé de fora passa por cima
      const p = pes[pi];
      if (!p.apoio) {
        const bx = m.bola.p.x, bz = m.bola.p.z;
        const ang = Math.PI * tp;
        const cx = bx + rx * lado * 0.22 * Math.cos(ang) - fx * 0.1;
        const cz = bz + rz * lado * 0.22 * Math.cos(ang) - fz * 0.1;
        const w = Math.sin(Math.PI * tp);
        p.x = lerp(p.x, cx, w); p.z = lerp(p.z, cz, w); p.y = lerp(p.y, TORN + 0.18 * Math.sin(ang), w);
      }
    }
  }

  // ---- quadril: altura nominal + balanço da passada, limitada pelo alcance das pernas
  const { carga } = infoPassada(s, !!(c && c.ult));
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
  for (let p = 0; p < 2; p++) {
    const pe = pes[p];
    if (!pe.apoio) continue;
    const lado = p === 0 ? -1 : 1;
    const qx = px + qrx * lado * MEIO_QUADRIL, qz = pz + qrz * lado * MEIO_QUADRIL;
    const dh = Math.hypot(pe.x - qx, pe.z - qz);
    const maxY = TORN + Math.sqrt(Math.max(0, LMAX * LMAX - dh * dh)) - 0.002;
    if (hy > maxY) hy = maxY;
  }
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
      info.pes[p].apoio = pe.apoio && !pe.toque;
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
