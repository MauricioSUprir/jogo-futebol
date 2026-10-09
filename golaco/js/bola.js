// Física da bola: arrasto com crise do arrasto, efeito Magnus, gravidade, quique na grama
// com atrito (troca velocidade por giro), rolagem com resistência ao rolamento, traves,
// travessão, rede e placas. Passo fixo; sem three.js nem DOM.
//
// Estado da bola (objeto simples, copiável):
//   p {x,y,z}  posição do centro (m)
//   v {x,y,z}  velocidade (m/s)
//   w {x,y,z}  velocidade angular (rad/s)
//   q {x,y,z,w} orientação (só para o desenho, mas faz parte do estado: replay puro)
//   rolando    true quando está apoiada na grama (y = raio, vy = 0)

import { BOLA, CAMPO, AR, G, PASSO, SUBPASSOS_BOLA } from './config.js';
import { MD } from './matdet.js';

const R = BOLA.raio;
const M = BOLA.massa;
const AREA = Math.PI * R * R;
const I = (2 / 3) * M * R * R;              // casca esférica fina
const INV_SLIP = 1 / (1 / M + (R * R) / I); // impulso que zera o deslizamento no contato
const K_AR = (0.5 * AR.densidade * AREA) / M;
export const DT_BOLA = PASSO / SUBPASSOS_BOLA;

export function criarBola(x = 0, z = 0) {
  return {
    p: { x, y: R, z },
    v: { x: 0, y: 0, z: 0 },
    w: { x: 0, y: 0, z: 0 },
    q: { x: 0, y: 0, z: 0, w: 1 },
    rolando: true,
  };
}

export function copiarBola(b) {
  return {
    p: { ...b.p }, v: { ...b.v }, w: { ...b.w }, q: { ...b.q }, rolando: b.rolando,
  };
}

/** Coeficiente de arrasto pela velocidade (crise do arrasto suavizada). */
export function cdPorVel(s) {
  if (s <= BOLA.vCrise1) return BOLA.cdBaixo;
  if (s >= BOLA.vCrise2) return BOLA.cdAlto;
  const t = (s - BOLA.vCrise1) / (BOLA.vCrise2 - BOLA.vCrise1);
  const u = t * t * (3 - 2 * t);
  return BOLA.cdBaixo + (BOLA.cdAlto - BOLA.cdBaixo) * u;
}

/**
 * Velocidade de rolagem depois de um subpasso (só resistência ao rolamento + arrasto).
 * É a MESMA conta usada na integração 3D: o planejador do toque usa esta função para
 * saber exatamente onde a bola vai estar.
 */
export function proxVelRolando(s, dt) {
  if (s <= 0) return 0;
  const a = BOLA.rolagemC * MD.pow(s, BOLA.rolagemN) + BOLA.rolagemPiso + K_AR * cdPorVel(s) * s * s;
  const s2 = s - a * dt;
  return s2 > BOLA.vParada ? s2 : 0;
}

/** Distância percorrida rolando em n passos (ticks) a partir da velocidade s0. */
export function distRolando(s0, nTicks) {
  let s = s0, d = 0;
  for (let i = 0; i < nTicks; i++) {
    for (let k = 0; k < SUBPASSOS_BOLA; k++) {
      s = proxVelRolando(s, DT_BOLA);
      d += s * DT_BOLA;
    }
    if (s === 0) break;
  }
  return d;
}

/** Distância total até parar a partir de s0. */
export function distAteParar(s0) {
  return distRolando(s0, 1e6);
}

/** Velocidade depois de n ticks rolando. */
export function velRolandoApos(s0, nTicks) {
  let s = s0;
  for (let i = 0; i < nTicks && s > 0; i++) {
    for (let k = 0; k < SUBPASSOS_BOLA; k++) s = proxVelRolando(s, DT_BOLA);
  }
  return s;
}

/**
 * Velocidade inicial para a bola rolar exatamente a distância d em n ticks. Se a bola parar
 * antes de n ticks, distRolando já vale a distância até parar — então a mesma busca binária
 * devolve a velocidade que faz a bola PARAR no ponto (chega antes e espera). É a mesma conta
 * da integração 3D (exata).
 */
export function velParaDistancia(d, nTicks) {
  if (d <= 1e-4) return 0;
  let lo = 0, hi = Math.max(0.5, (2 * d) / Math.max(nTicks * PASSO, 0.05) + 0.5);
  while (distRolando(hi, nTicks) < d) { lo = hi; hi *= 1.6; if (hi > 80) break; }
  for (let i = 0; i < 34; i++) {
    const m = (lo + hi) / 2;
    if (distRolando(m, nTicks) < d) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Velocidade inicial para a bola rolar d metros e parar. */
export function velParaParar(d) {
  return velParaDistancia(d, 1200);
}

/** Velocidade de saída para a bola chegar a `dist` metros com velocidade `vChegada`. */
export function velParaChegarCom(dist, vChegada) {
  let lo = vChegada, hi = vChegada * 2 + 10;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    // rola até percorrer dist e vê a velocidade que sobrou
    let s = m, d = 0;
    while (d < dist && s > 0) { s = proxVelRolando(s, DT_BOLA); d += s * DT_BOLA; }
    if (s < vChegada) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Põe a bola rolando com velocidade horizontal (vx, vz) e giro de rolamento puro. */
export function chutarRasteiro(b, vx, vz) {
  b.v.x = vx; b.v.y = 0; b.v.z = vz;
  b.p.y = R;
  b.w.x = vz / R; b.w.y = 0; b.w.z = -vx / R;
  b.rolando = true;
}

/** Chute com velocidade 3D e giro dados (a bola sai do chão se vy > 0). */
export function chutar(b, v, w) {
  b.v.x = v.x; b.v.y = v.y; b.v.z = v.z;
  b.w.x = w.x; b.w.y = w.y; b.w.z = w.z;
  if (v.y > 0.01) b.rolando = false;
}

// ---------------------------------------------------------------- integração

function aplicarAtritoContato(b, jMax) {
  // velocidade do ponto de contato (abaixo do centro): vc = v + w × (0, −R, 0)
  const vcx = b.v.x + R * b.w.z;
  const vcz = b.v.z - R * b.w.x;
  const slip = Math.sqrt(vcx * vcx + vcz * vcz);
  if (slip < 1e-6) return 0;
  const j = Math.min(jMax, slip * INV_SLIP);
  const jx = -(vcx / slip) * j, jz = -(vcz / slip) * j;
  b.v.x += jx / M;
  b.v.z += jz / M;
  // torque = (0, −R, 0) × J  →  (−R·jz, 0, R·jx)
  b.w.x += (-R * jz) / I;
  b.w.z += (R * jx) / I;
  return slip;
}

function passoRolando(b, dt, ev) {
  // Enquanto desliza (ex.: caiu com giro para trás), o atrito cinético leva a bola ao
  // rolamento puro; só depois vale a resistência ao rolamento.
  const slip = aplicarAtritoContato(b, BOLA.atritoDeslize * M * G * dt);
  const s = Math.sqrt(b.v.x * b.v.x + b.v.z * b.v.z);
  if (slip > 1e-6) {
    const vcx = b.v.x + R * b.w.z, vcz = b.v.z - R * b.w.x;
    if (vcx * vcx + vcz * vcz > 1e-8) {
      b.w.y *= MD.exp(-BOLA.giroVerticalDecai * dt);
      b.v.y = 0; b.p.y = R;
      b.p.x += b.v.x * dt; b.p.z += b.v.z * dt;
      return;
    }
  }
  if (s > 0) {
    const s2 = proxVelRolando(s, dt);
    const k = s2 / s;
    b.v.x *= k; b.v.z *= k;
    // mantém o giro coerente com o rolamento
    b.w.x = b.v.z / R; b.w.z = -b.v.x / R;
  } else {
    b.w.x = 0; b.w.z = 0;
  }
  b.w.y *= MD.exp(-BOLA.giroVerticalDecai * dt);
  b.v.y = 0;
  b.p.y = R;
  b.p.x += b.v.x * dt;
  b.p.z += b.v.z * dt;
}

function passoNoAr(b, dt, ev) {
  const v = b.v, w = b.w;
  const s = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  let ax = 0, ay = -G, az = 0;
  if (s > 1e-6) {
    const kd = K_AR * cdPorVel(s) * s;
    ax -= kd * v.x; ay -= kd * v.y; az -= kd * v.z;
    const wm = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
    if (wm > 1e-6) {
      const S = (R * wm) / s;
      const cl = Math.min(BOLA.clMax, BOLA.magnusK * S);
      // direção ŵ × v̂, módulo |v|²
      const cx = w.y * v.z - w.z * v.y;
      const cy = w.z * v.x - w.x * v.z;
      const cz = w.x * v.y - w.y * v.x;
      const k = (K_AR * cl * s * s) / (wm * s);
      ax += k * cx; ay += k * cy; az += k * cz;
    }
  }
  v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
  b.p.x += v.x * dt; b.p.y += v.y * dt; b.p.z += v.z * dt;
  const dec = MD.exp(-BOLA.giroPorMetro * s * dt); // o giro cai por metro percorrido
  w.x *= dec; w.y *= dec; w.z *= dec;

  if (b.p.y < R) {
    b.p.y = R;
    const vn = -v.y;
    if (vn > BOLA.vQuiqueMin) {
      v.y = BOLA.restituicao * vn;
      aplicarAtritoContato(b, BOLA.atritoQuique * (1 + BOLA.restituicao) * M * vn);
      if (ev) ev.push({ tipo: 'quique', forca: vn });
    } else {
      v.y = 0;
      b.rolando = true;
    }
  }
}

// Traves (cilindros verticais), travessão (cilindro horizontal) e rede (planos).
const GOL = CAMPO.gol;
const RP = GOL.raioPoste;
const ZP = GOL.largura / 2 + RP;      // centro do poste em z
const YT = GOL.altura + RP;           // centro do travessão em y

function colidirCilindro(b, nx, ny, nz, dist, ev, tipo) {
  // n = direção do eixo até a bola (unitária); dist = distância do eixo ao centro
  const pen = R + RP - dist;
  if (pen <= 0) return false;
  b.p.x += nx * pen; b.p.y += ny * pen; b.p.z += nz * pen;
  const vn = b.v.x * nx + b.v.y * ny + b.v.z * nz;
  if (vn < 0) {
    const k = (1 + BOLA.restituicaoPoste) * vn;
    b.v.x -= k * nx; b.v.y -= k * ny; b.v.z -= k * nz;
    b.w.x *= 0.6; b.w.y *= 0.6; b.w.z *= 0.6;
    if (b.v.y > 0.05 || b.p.y > R + 1e-3) b.rolando = false;
    if (ev) ev.push({ tipo, forca: -vn });
  }
  return true;
}

function colidirGol(b, lado, ev) {
  const xg = lado * CAMPO.meioX;
  const p = b.p;
  // postes
  for (const sz of [-1, 1]) {
    const dx = p.x - xg, dz = p.z - sz * ZP;
    if (p.y < YT + R && Math.abs(dx) < R + RP + 0.5) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < R + RP && d > 1e-9) colidirCilindro(b, dx / d, 0, dz / d, d, ev, 'trave');
    }
  }
  // travessão
  if (Math.abs(p.z) < ZP) {
    const dx = p.x - xg, dy = p.y - YT;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < R + RP && d > 1e-9) colidirCilindro(b, dx / d, dy / d, 0, d, ev, 'trave');
  }
  // rede: caixa atrás da linha
  const fundo = xg + lado * GOL.profundidade;
  const dentroX = lado > 0 ? p.x > xg : p.x < xg;
  if (!dentroX) return;
  const alemFundo = lado > 0 ? p.x + R > fundo : p.x - R < fundo;
  const zLim = GOL.largura / 2;
  const dentroZ = Math.abs(p.z) < zLim;
  const dentroY = p.y < GOL.altura;
  const am = BOLA.amortecimentoRede;
  if (dentroZ && dentroY) {
    // dentro do gol: segura nas redes de fundo, laterais e teto
    if (alemFundo) {
      b.p.x = fundo - lado * R;
      if (b.v.x * lado > 0) {
        // a rede de fundo cede e segura: quase toda a energia vai embora
        if (ev) ev.push({ tipo: 'rede', forca: Math.abs(b.v.x) });
        b.v.x = -b.v.x * am; b.v.z *= 0.3; b.v.y *= 0.3;
        b.w.x *= 0.3; b.w.y *= 0.3; b.w.z *= 0.3;
      }
    }
    if (Math.abs(p.z) + R > zLim) {
      b.p.z = Math.sign(p.z) * (zLim - R);
      if (b.v.z * Math.sign(p.z) > 0) { b.v.z = -b.v.z * am; b.v.x *= 0.6; }
    }
    if (p.y + R > GOL.altura) {
      b.p.y = GOL.altura - R;
      if (b.v.y > 0) b.v.y = -b.v.y * am;
    }
  } else {
    // por fora: a rede lateral e o teto não deixam a bola entrar
    const atrasDaLinha = lado > 0 ? p.x - R < fundo : p.x + R > fundo;
    if (!atrasDaLinha) return;
    if (p.y < GOL.altura && Math.abs(p.z) - R < zLim && Math.abs(p.z) > zLim) {
      b.p.z = Math.sign(p.z) * (zLim + R);
      if (b.v.z * Math.sign(p.z) < 0) { b.v.z = -b.v.z * am; b.v.x *= 0.7; }
    } else if (dentroZ && p.y - R < GOL.altura && p.y > GOL.altura) {
      b.p.y = GOL.altura + R;
      if (b.v.y < 0) { b.v.y = -b.v.y * am * 2; }
    }
  }
}

// Placas em volta do campo (barreira simples).
const PX = CAMPO.meioX + CAMPO.entorno;
const PZ = CAMPO.meioZ + CAMPO.entorno;
function colidirPlacas(b, ev) {
  const p = b.p, v = b.v;
  if (p.y > 1.0) return;
  if (p.x > PX - R && v.x > 0) { p.x = PX - R; v.x = -v.x * 0.3; if (ev) ev.push({ tipo: 'placa' }); }
  if (p.x < -PX + R && v.x < 0) { p.x = -PX + R; v.x = -v.x * 0.3; if (ev) ev.push({ tipo: 'placa' }); }
  if (p.z > PZ - R && v.z > 0) { p.z = PZ - R; v.z = -v.z * 0.3; if (ev) ev.push({ tipo: 'placa' }); }
  if (p.z < -PZ + R && v.z < 0) { p.z = -PZ + R; v.z = -v.z * 0.3; if (ev) ev.push({ tipo: 'placa' }); }
  if (b.rolando) { b.w.x = v.z / R; b.w.z = -v.x / R; }
}

function integrarOrientacao(b, dt) {
  const q = b.q, w = b.w;
  const hx = 0.5 * dt * w.x, hy = 0.5 * dt * w.y, hz = 0.5 * dt * w.z;
  const qx = q.x + (hx * q.w + hy * q.z - hz * q.y);
  const qy = q.y + (hy * q.w + hz * q.x - hx * q.z);
  const qz = q.z + (hz * q.w + hx * q.y - hy * q.x);
  const qw = q.w + (-hx * q.x - hy * q.y - hz * q.z);
  const n = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
  q.x = qx * n; q.y = qy * n; q.z = qz * n; q.w = qw * n;
}

/** Avança a bola um passo de simulação (PASSO), em SUBPASSOS_BOLA subpassos. */
export function passoBola(b, ev) {
  const dt = DT_BOLA;
  for (let k = 0; k < SUBPASSOS_BOLA; k++) {
    if (b.rolando) passoRolando(b, dt, ev);
    else passoNoAr(b, dt, ev);
    if (Math.abs(b.p.x) > CAMPO.meioX - 1.5) colidirGol(b, b.p.x > 0 ? 1 : -1, ev);
    colidirPlacas(b, ev);
    integrarOrientacao(b, dt);
  }
}

/** Bola parada? */
export function bolaParada(b) {
  return b.rolando && b.v.x === 0 && b.v.z === 0;
}

export const CONST_BOLA = { R, M, I, AREA, K_AR };

// ------------------------------------------------------------ bola no ar: mira

/** Bola de trabalho (para simular voos sem mexer na bola do jogo). */
function bolaDeTeste(p, v, w) {
  const b = criarBola(p.x, p.z);
  b.p.y = p.y;
  b.v.x = v.x; b.v.y = v.y; b.v.z = v.z;
  b.w.x = w.x; b.w.y = w.y; b.w.z = w.z;
  b.rolando = !(v.y > 0.01 || p.y > R + 1e-3);
  return b;
}

/**
 * Simula um voo até a bola tocar o chão pela 1ª vez (ou maxTicks). Devolve o ponto de queda,
 * os ticks e a altura máxima. Mesma física do jogo (exata).
 */
export function simularVoo(p, v, w, maxTicks = 420) {
  const b = bolaDeTeste(p, v, w);
  const ev = [];
  let apice = b.p.y;
  for (let i = 1; i <= maxTicks; i++) {
    passoBola(b, ev);
    if (b.p.y > apice) apice = b.p.y;
    if (ev.length && ev.some(e => e.tipo === 'quique') || (b.rolando && i > 1)) {
      return { x: b.p.x, z: b.p.z, ticks: i, apice, v: { ...b.v } };
    }
    ev.length = 0;
  }
  return { x: b.p.x, z: b.p.z, ticks: maxTicks, apice, v: { ...b.v } };
}

/**
 * Altura da bola quando ela percorre a distância horizontal D na direção (ux, uz), saindo de p
 * com velocidade escalar s e elevação el (rad). Se cair antes, devolve a altura negativa
 * proporcional ao que faltou (mantém a função crescente na elevação, para a busca binária).
 */
export function alturaNaDistancia(p, ux, uz, D, s, el, w = { x: 0, y: 0, z: 0 }, maxTicks = 300) {
  const ce = MD.cos(el), se = MD.sin(el);
  const b = bolaDeTeste(p, { x: ux * s * ce, y: s * se, z: uz * s * ce }, w);
  const ev = [];
  let dAnt = 0, yAnt = b.p.y;
  for (let i = 1; i <= maxTicks; i++) {
    passoBola(b, ev);
    const d = (b.p.x - p.x) * ux + (b.p.z - p.z) * uz;
    if (d >= D) {
      const t = (D - dAnt) / Math.max(d - dAnt, 1e-9);
      return { y: yAnt + (b.p.y - yAnt) * t, ticks: i, lateral: -(b.p.x - p.x) * uz + (b.p.z - p.z) * ux };
    }
    if (ev.some(e => e.tipo === 'quique') || (b.rolando && i > 2)) return { y: -(D - d), ticks: i, lateral: 0, caiu: true };
    ev.length = 0;
    dAnt = d; yAnt = b.p.y;
  }
  return { y: -D, ticks: maxTicks, lateral: 0, caiu: true };
}

/**
 * Passe alto: velocidade (m/s) para a bola, saindo de p na direção (ux,uz) com elevação el,
 * cair a D metros. Busca binária sobre a simulação.
 */
export function velParaPousar(p, ux, uz, D, el, w = { x: 0, y: 0, z: 0 }) {
  const ce = MD.cos(el), se = MD.sin(el);
  let lo = 1, hi = 45;
  const dist = s => {
    const r = simularVoo(p, { x: ux * s * ce, y: s * se, z: uz * s * ce }, w, 600);
    return (r.x - p.x) * ux + (r.z - p.z) * uz;
  };
  if (dist(hi) < D) return hi;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (dist(m) < D) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * Chute: elevação (rad) para a bola, saindo a velocidade s na direção (ux,uz), passar a D metros
 * na altura y. Busca binária na elevação entre −8° e 50°.
 */
export function elevacaoParaAltura(p, ux, uz, D, s, y, w = { x: 0, y: 0, z: 0 }) {
  let lo = -0.14, hi = 0.87;
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (alturaNaDistancia(p, ux, uz, D, s, m, w).y < y) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
