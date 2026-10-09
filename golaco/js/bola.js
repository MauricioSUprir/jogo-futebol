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
  // resistência do gramado com teto (atrito de deslizamento) + piso + arrasto do ar
  const grama = Math.min(BOLA.rolagemC * MD.pow(s, BOLA.rolagemN), BOLA.rolagemMax);
  const a = grama + BOLA.rolagemPiso + K_AR * cdPorVel(s) * s * s;
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

/** Velocidade que sobra quando a bola, saindo a v0 rolando, chega a `dist` metros (0 se parar antes). */
function velAoChegar(v0, dist) {
  // mesma conta da integração 3D (subpasso a subpasso): a velocidade do subpasso que cruza dist
  let s = v0, d = 0;
  while (d < dist && s > 0) { s = proxVelRolando(s, DT_BOLA); d += s * DT_BOLA; }
  return s;
}

/**
 * Velocidade de saída para a bola chegar a `dist` metros com velocidade `vChegada` (inverso exato
 * da integração). O teto da busca cresce até bastar — com um teto fixo, passes longos ficavam
 * presos nele e chegavam até 42% mais devagar que o pedido.
 */
export function velParaChegarCom(dist, vChegada) {
  let lo = vChegada, hi = vChegada * 2 + 10;
  while (velAoChegar(hi, dist) < vChegada && hi < 150) { lo = hi; hi *= 1.6; }
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (velAoChegar(m, dist) < vChegada) lo = m; else hi = m;
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

/**
 * Impulso de atrito no ponto de contato com a grama, limitado a jMax (atrito de deslizamento).
 * ex = restituição horizontal do ponto de contato (Cross 2002): 0 para no rolamento puro; > 0 a
 * bola "agarra" e o ponto de contato volta com −ex da velocidade de deslize.
 */
function aplicarAtritoContato(b, jMax, ex = 0) {
  // velocidade do ponto de contato (abaixo do centro): vc = v + w × (0, −R, 0)
  const vcx = b.v.x + R * b.w.z;
  const vcz = b.v.z - R * b.w.x;
  const slip = Math.sqrt(vcx * vcx + vcz * vcz);
  if (slip < 1e-6) return 0;
  const j = Math.min(jMax, (1 + ex) * slip * INV_SLIP);
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

/** Acréscimo de C_D pelo giro, pelo parâmetro de giro Sp = R·|ω|/|v| (BOLA.cdGiro25/50). */
export function cdPorGiro(S) {
  if (S <= 0.25) return BOLA.cdGiro25 * (S / 0.25);
  if (S >= 0.5) return BOLA.cdGiro50;
  return BOLA.cdGiro25 + (BOLA.cdGiro50 - BOLA.cdGiro25) * ((S - 0.25) / 0.25);
}

function passoNoAr(b, dt, ev) {
  const v = b.v, w = b.w;
  const s = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  let ax = 0, ay = -G, az = 0;
  if (s > 1e-6) {
    const wm = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
    const S = (R * wm) / s;
    const kd = K_AR * (cdPorVel(s) + (wm > 1e-6 ? cdPorGiro(S) : 0)) * s;
    ax -= kd * v.x; ay -= kd * v.y; az -= kd * v.z;
    if (wm > 1e-6) {
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
      aplicarAtritoContato(b, BOLA.atritoQuique * (1 + BOLA.restituicao) * M * vn, BOLA.restituicaoTangencial);
      if (ev) ev.push({ tipo: 'quique', forca: vn });
    } else {
      v.y = 0;
      b.rolando = true;
    }
  }
}

// ------------------------------------------------------------ gol e placas
// Colisão CONTÍNUA: em cada subpasso a bola anda em linha reta de a (início) até p (fim). Esse
// segmento é varrido contra os cilindros das traves e do travessão e contra os planos finos da
// rede e das placas; de que lado de cada plano a bola está vem SEMPRE do início do subpasso. Assim
// nada depende de |v|·dt ser menor que a espessura de uma faixa (a 120 Hz, a 30 m/s a bola anda
// 0,25 m por subpasso — mais que o raio do poste somado ao da bola) e a bola parada ou lenta do
// lado de fora (atrás do gol, por fora da rede, além da placa) fica onde está.

// Traves (cilindros verticais), travessão (cilindro horizontal) e rede (planos).
const GOL = CAMPO.gol;
const RP = GOL.raioPoste;
const RC = R + RP;                    // distância eixo–centro da bola no contato
const ZP = GOL.largura / 2 + RP;      // centro do poste em z
const YT = GOL.altura + RP;           // centro do travessão em y
const ZLIM = GOL.largura / 2;         // plano das redes laterais (|z|)
const HG = GOL.altura;                // plano do teto da rede
const PROF = GOL.profundidade;        // plano da rede de fundo (atrás da linha)
const PERTO_GOL = CAMPO.meioX - 1.5;  // |x| a partir do qual testa traves e rede

/**
 * Primeiro instante t ∈ [0, 1] em que o segmento (ax, ay) → (bx, by) chega à distância r do ponto
 * (cx, cy), indo na direção dele; −1 se não chega. Se já começou a menos de r indo para dentro,
 * devolve 0.
 */
function tContato(ax, ay, bx, by, cx, cy, r) {
  const ux = bx - ax, uy = by - ay, fx = ax - cx, fy = ay - cy;
  const B = fx * ux + fy * uy;              // < 0: aproximando
  if (B >= 0) return -1;
  const C = fx * fx + fy * fy - r * r;
  if (C <= 0) return 0;
  const A = ux * ux + uy * uy;
  const D = B * B - A * C;
  if (D < 0) return -1;
  const t = (-B - Math.sqrt(D)) / A;
  return t <= 1 ? t : -1;
}

/**
 * Bola encostada num cilindro: n = direção do eixo até a bola (unitária), dist = distância do
 * eixo ao centro. Tira a penetração e, se a bola vem contra o cilindro, reflete.
 */
function colidirCilindro(b, nx, ny, nz, dist, ev, tipo) {
  const pen = RC - dist;
  if (pen > 0) { b.p.x += nx * pen; b.p.y += ny * pen; b.p.z += nz * pen; }
  const vn = b.v.x * nx + b.v.y * ny + b.v.z * nz;
  if (vn < 0) {
    const k = (1 + BOLA.restituicaoPoste) * vn;
    b.v.x -= k * nx; b.v.y -= k * ny; b.v.z -= k * nz;
    b.w.x *= 0.6; b.w.y *= 0.6; b.w.z *= 0.6;
    if (b.v.y > 0.05 || b.p.y > R + 1e-3) b.rolando = false;
    if (ev) ev.push({ tipo, forca: -vn });
  }
}

/**
 * Plano fino u = c visto por uma bola que foi de u0 a u1 no subpasso. Devolve o lado de onde ela
 * veio (+1 ou −1) e o instante em que a superfície encosta no plano, ou null se não encosta.
 * vu = velocidade na direção u (desempata quando a bola começou exatamente no plano).
 */
function cruzaPlano(u0, u1, c, vu) {
  const d0 = u0 - c, d1 = u1 - c;
  const lado = d0 > 0 || (d0 === 0 && vu <= 0) ? 1 : -1;
  if (lado * d1 >= R) return null;          // termina longe do plano, do mesmo lado
  const e0 = lado * d0;
  // já começou encostada (ou sobreposta): o contato vale desde o início do subpasso
  const t = e0 > R ? (e0 - R) / (e0 - lado * d1) : 0;
  return { lado, t };
}

function colidirGol(b, lado, ev, ax, ay, az) {
  const xg = lado * CAMPO.meioX;
  const p = b.p;
  // 1) traves e travessão: o contato mais cedo do segmento a → p (varredura)
  let tMin = 2, alvo = 0;
  const t1 = tContato(ax, az, p.x, p.z, xg, -ZP, RC);
  if (t1 >= 0 && ay + (p.y - ay) * t1 < YT) { tMin = t1; alvo = 1; }
  const t2 = tContato(ax, az, p.x, p.z, xg, ZP, RC);
  if (t2 >= 0 && t2 < tMin && ay + (p.y - ay) * t2 < YT) { tMin = t2; alvo = 2; }
  const t3 = tContato(ax, ay, p.x, p.y, xg, YT, RC);
  if (t3 >= 0 && t3 < tMin && Math.abs(az + (p.z - az) * t3) < ZP) { tMin = t3; alvo = 3; }
  if (alvo) {
    // leva a bola ao ponto de contato e reflete lá (o resto do subpasso, ≤ 1/120 s, é descartado)
    p.x = ax + (p.x - ax) * tMin; p.y = ay + (p.y - ay) * tMin; p.z = az + (p.z - az) * tMin;
    if (alvo === 3) {
      const dx = p.x - xg, dy = p.y - YT, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1e-9) colidirCilindro(b, dx / d, dy / d, 0, d, ev, 'trave');
    } else {
      const dx = p.x - xg, dz = p.z - (alvo === 1 ? -ZP : ZP), d = Math.sqrt(dx * dx + dz * dz);
      if (d > 1e-9) colidirCilindro(b, dx / d, 0, dz / d, d, ev, 'trave');
    }
  }
  // reserva: penetração no fim do subpasso (bola posta encostada, quina da trave com o travessão)
  for (let sz = -1; sz <= 1; sz += 2) {
    const dx = p.x - xg, dz = p.z - sz * ZP;
    if (p.y < YT + R && Math.abs(dx) < RC + 0.5) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < RC && d > 1e-9) colidirCilindro(b, dx / d, 0, dz / d, d, ev, 'trave');
    }
  }
  if (Math.abs(p.z) < ZP) {
    const dx = p.x - xg, dy = p.y - YT;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < RC && d > 1e-9) colidirCilindro(b, dx / d, dy / d, 0, d, ev, 'trave');
  }

  // 2) rede: caixa atrás da linha (profundidade X, de 0 na linha a PROF no fundo). Cada pano é um
  // plano fino com bordas alargadas pelo raio (a bola não passa pela quina entre dois panos).
  const X0 = lado * (ax - xg), X1 = lado * (p.x - xg);
  if (X0 < 0 && X1 < 0) return;
  const am = BOLA.amortecimentoRede;
  // redes laterais (|z| = ZLIM): segura por dentro e por fora
  for (let s = -1; s <= 1; s += 2) {
    const c = cruzaPlano(az, p.z, s * ZLIM, b.v.z);
    if (!c) continue;
    const X = X0 + (X1 - X0) * c.t, Y = ay + (p.y - ay) * c.t;
    if (X < 0 || X > PROF + R || Y > HG + R) continue;
    p.z = s * ZLIM + c.lado * R;
    if (b.v.z * c.lado < 0) { b.v.z = -b.v.z * am; b.v.x *= c.lado === -s ? 0.6 : 0.7; }
  }
  // teto (y = HG): por baixo segura a bola dentro; por cima ela quica de leve
  {
    const c = cruzaPlano(ay, p.y, HG, b.v.y);
    if (c) {
      const X = X0 + (X1 - X0) * c.t, Z = az + (p.z - az) * c.t;
      if (X >= 0 && X <= PROF + R && Math.abs(Z) <= ZLIM + R) {
        p.y = HG + c.lado * R;
        if (b.v.y * c.lado < 0) b.v.y = -b.v.y * am * (c.lado > 0 ? 2 : 1);
      }
    }
  }
  // rede de fundo (X = PROF): por dentro ela cede e segura; por trás a bola volta para trás
  {
    const vX = lado * b.v.x;
    const c = cruzaPlano(X0, X1, PROF, vX);
    if (c) {
      const Y = ay + (p.y - ay) * c.t, Z = az + (p.z - az) * c.t;
      if (Y <= HG + R && Math.abs(Z) <= ZLIM + R) {
        p.x = xg + lado * (PROF + c.lado * R);
        if (vX * c.lado < 0) {
          // quase toda a energia vai embora
          if (ev) ev.push({ tipo: 'rede', forca: Math.abs(b.v.x) });
          b.v.x = -b.v.x * am; b.v.z *= 0.3; b.v.y *= 0.3;
          b.w.x *= 0.3; b.w.y *= 0.3; b.w.z *= 0.3;
        }
      }
    }
  }
}

// Placas em volta do campo (barreira simples de 1 m de altura): planos finos com o lado de
// onde a bola veio; a bola que passou por cima (ou que foi posta além da placa) fica lá fora.
const PX = CAMPO.meioX + CAMPO.entorno;
const PZ = CAMPO.meioZ + CAMPO.entorno;
const ALTURA_PLACA = 1.0;
function colidirPlacas(b, ev, ax, az) {
  const p = b.p, v = b.v;
  if (p.y <= ALTURA_PLACA) {
    for (let s = -1; s <= 1; s += 2) {
      const c = cruzaPlano(ax, p.x, s * PX, v.x);
      if (c && v.x * c.lado < 0 && Math.abs(p.z) <= PZ + R) {
        p.x = s * PX + c.lado * R; v.x = -v.x * 0.3; if (ev) ev.push({ tipo: 'placa' });
      }
    }
    for (let s = -1; s <= 1; s += 2) {
      const c = cruzaPlano(az, p.z, s * PZ, v.z);
      if (c && v.z * c.lado < 0 && Math.abs(p.x) <= PX + R) {
        p.z = s * PZ + c.lado * R; v.z = -v.z * 0.3; if (ev) ev.push({ tipo: 'placa' });
      }
    }
  }
  // rolando, o giro acompanha a rolagem (como antes: vale a cada subpasso, com ou sem batida)
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
    const ax = b.p.x, ay = b.p.y, az = b.p.z;   // início do subpasso (para a varredura)
    if (b.rolando) passoRolando(b, dt, ev);
    else passoNoAr(b, dt, ev);
    if (Math.abs(b.p.x) > PERTO_GOL || Math.abs(ax) > PERTO_GOL) colidirGol(b, b.p.x > 0 ? 1 : -1, ev, ax, ay, az);
    colidirPlacas(b, ev, ax, az);
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
