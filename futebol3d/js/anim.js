// Esqueleto e poses procedurais dos jogadores do GOLAÇO — funções PURAS.
//
// computePose(s, out) depende só de s (PoseState): nada de relógio interno nem
// aleatório (a única variação vem de s.variant). O replay recalcula qualquer quadro.
//
// ESPAÇO DO MODELO (canônico, jogador de 1,80 m — players3d escala por look.height/1,80):
//   origem no gramado sob o jogador, +Y para cima, +Z para a frente (heading),
//   +X para a ESQUERDA do jogador (logo a direita é -X).
//
// SAÍDA (Pose, criada com createPose()):
//   q    Float32Array(17*4)  rotação local de cada osso (quatérnio x,y,z,w)
//   mq   Float32Array(17*4)  rotação de cada osso no espaço do modelo
//   mp   Float32Array(17*3)  posição da articulação no espaço do modelo
//   root Float32Array(3)     posição da pelve no espaço do modelo (x, y, z) — inclui
//                            a altura do quadril já ajustada ao chão, o salto do
//                            cabeceio e o deslocamento lateral do mergulho do goleiro.
//
// DESLOCAMENTO DO CORPO (para a jogabilidade):
//   rootOffset(s, out) -> { right, forward, up } em metros (canônicos) = quanto a pelve
//   saiu da posição do jogador. Só gk_dive desloca de verdade na lateral (até ~2,2 m no
//   fim); header sobe (salto). Ao terminar um gk_dive, some o deslocamento lateral na
//   posição do goleiro ANTES de trocar de animação, senão o corpo "volta" ao ponto inicial.
//   Carrinho, queda e corrida NÃO transladam a raiz: a jogabilidade move o jogador.
//
// ALCANCE DO GOLEIRO no contato do mergulho (t = ANIM.gk_dive.contact*dur), mão mais
// distante, medido da posição do goleiro (1,80 m; multiplique por height/1,80):
//   gkReach(diveHeight) -> { lateral, up }. Valores aproximados (ver tools/players-test):
//     diveHeight 0   -> lateral ≈ 2,47 m, up ≈ 0,41 m  (rasteira, corpo deitado de lado)
//     diveHeight 0,5 -> lateral ≈ 2,41 m, up ≈ 1,03 m
//     diveHeight 1   -> lateral ≈ 2,21 m, up ≈ 2,09 m  (ângulo, corpo na diagonal)
//   O corpo (pelve) termina o mergulho ~2,2 m para o lado (rootOffset).
//   (os números saem da própria pose: chame gkReach uma vez por altura e guarde.)
//   cycleLength(speed, moveAngle) -> metros por ciclo de passada; s.stride é a fase acumulada em ciclos
//   (stride += speed·dt / cycleLength), contínua mesmo quando a velocidade muda.
//   Esqueleto exportado (BONE, PARENT, OFFSET, NB) e bonePoint(pose, osso, x, y, z, out).
//
// CONVENÇÕES DO PoseState: moveAngle + = andando para a direita; lean + = inclina à
// direita; foot 1 = pé direito chuta; diveSide 1 = mergulha à direita; lookYaw + = olha
// para a esquerda, lookPitch + = olha para cima. blendW = peso do estado atual (1 = só ele).
// Animações sem duração em ANIM (locomotion, idle, jockey, shield, gk_ready, gk_hold)
// são cíclicas em s.t / s.stride. celebrate.variant: 0 aviãozinho, 1 joelhada deslizando,
// 2 salto com soco no ar, 3 aponta ao céu. dejected.variant: 0 mãos na cabeça, 1 mãos na cintura.

import { ANIM, clamp, lerp, smooth } from './config.js';

// ---------------------------------------------------------------- esqueleto
export const BONE = {
  pelvis: 0, spine: 1, chest: 2, neck: 3, head: 4,
  upperArmL: 5, foreArmL: 6, handL: 7, upperArmR: 8, foreArmR: 9, handR: 10,
  thighL: 11, shinL: 12, footL: 13, thighR: 14, shinR: 15, footR: 16,
};
export const NB = 17;
export const PARENT = Int8Array.from([-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15]);
// deslocamento de cada articulação em relação ao pai (pose de repouso, metros)
export const OFFSET = Float32Array.from([
  0, 0.96, 0,          // pelve (repouso)
  0, 0.08, 0,          // coluna (lombar)
  0, 0.20, 0,          // peito
  0, 0.27, -0.012,     // pescoço
  0, 0.09, 0.012,      // cabeça (base do crânio)
  0.178, 0.205, -0.012, 0, -0.30, 0, 0, -0.26, 0,     // braço esquerdo
  -0.178, 0.205, -0.012, 0, -0.30, 0, 0, -0.26, 0,    // braço direito
  0.095, -0.03, 0, 0, -0.44, 0, 0, -0.42, 0,          // perna esquerda
  -0.095, -0.03, 0, 0, -0.44, 0, 0, -0.42, 0,         // perna direita
]);
export const LEG = { thigh: 0.44, shin: 0.42, ankle: 0.07, hipX: 0.095, hipY: -0.03 };
const SIDE = Int8Array.from([0, 0, 0, 0, 0, 1, 1, 1, -1, -1, -1, 1, 1, 1, -1, -1, -1]);
const MIRROR = Int8Array.from([0, 1, 2, 3, 4, 8, 9, 10, 5, 6, 7, 14, 15, 16, 11, 12, 13]);
const L1 = LEG.thigh, L2 = LEG.shin;

export const ANIM_LIST = ['locomotion', 'idle', 'jockey', 'shield', 'kick', 'pass', 'chip', 'volley', 'header',
  'slide', 'tackle', 'throwin', 'gk_ready', 'gk_dive', 'gk_catch', 'gk_hold', 'gk_throw', 'gk_kick',
  'fall', 'getup', 'celebrate', 'dejected'];

export function createPose() {
  const p = { q: new Float32Array(NB * 4), mq: new Float32Array(NB * 4), mp: new Float32Array(NB * 3), root: new Float32Array(3) };
  for (let b = 0; b < NB; b++) { p.q[b * 4 + 3] = 1; p.mq[b * 4 + 3] = 1; }
  return p;
}

// ---------------------------------------------------------------- matemática (sem alocação)
const V = new Float32Array(3);
// quatérnio a partir de Euler: ordem 0 = YXZ (tronco/cabeça), 1 = ZXY (membros)
function qEuler(o, i, x, y, z, order) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  if (order === 0) {
    o[i] = s1 * c2 * c3 + c1 * s2 * s3; o[i + 1] = c1 * s2 * c3 - s1 * c2 * s3;
    o[i + 2] = c1 * c2 * s3 - s1 * s2 * c3; o[i + 3] = c1 * c2 * c3 + s1 * s2 * s3;
  } else {
    o[i] = s1 * c2 * c3 - c1 * s2 * s3; o[i + 1] = c1 * s2 * c3 + s1 * c2 * s3;
    o[i + 2] = c1 * c2 * s3 + s1 * s2 * c3; o[i + 3] = c1 * c2 * c3 - s1 * s2 * s3;
  }
}
function qMul(a, ai, b, bi, o, oi) {
  const ax = a[ai], ay = a[ai + 1], az = a[ai + 2], aw = a[ai + 3];
  const bx = b[bi], by = b[bi + 1], bz = b[bi + 2], bw = b[bi + 3];
  o[oi] = ax * bw + aw * bx + ay * bz - az * by;
  o[oi + 1] = ay * bw + aw * by + az * bx - ax * bz;
  o[oi + 2] = az * bw + aw * bz + ax * by - ay * bx;
  o[oi + 3] = aw * bw - ax * bx - ay * by - az * bz;
}
// gira (x,y,z) pelo quatérnio q[qi] (conj = true usa o inverso); resultado em V
function qRot(q, qi, x, y, z, conj) {
  const qx = conj ? -q[qi] : q[qi], qy = conj ? -q[qi + 1] : q[qi + 1], qz = conj ? -q[qi + 2] : q[qi + 2], qw = q[qi + 3];
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  V[0] = x + qw * tx + qy * tz - qz * ty;
  V[1] = y + qw * ty + qz * tx - qx * tz;
  V[2] = z + qw * tz + qx * ty - qy * tx;
}
function qSlerp(a, b, i, t, o) {
  let bx = b[i], by = b[i + 1], bz = b[i + 2], bw = b[i + 3];
  const ax = a[i], ay = a[i + 1], az = a[i + 2], aw = a[i + 3];
  let d = ax * bx + ay * by + az * bz + aw * bw;
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0 = 1 - t, k1 = t;
  if (d < 0.9995) {
    const th = Math.acos(d), s = Math.sin(th);
    k0 = Math.sin((1 - t) * th) / s; k1 = Math.sin(t * th) / s;
  }
  let x = ax * k0 + bx * k1, y = ay * k0 + by * k1, z = az * k0 + bz * k1, w = aw * k0 + bw * k1;
  const n = 1 / Math.hypot(x, y, z, w);
  o[i] = x * n; o[i + 1] = y * n; o[i + 2] = z * n; o[i + 3] = w * n;
}
const frac = (x) => x - Math.floor(x);
const TAU = Math.PI * 2;
// Catmull-Rom sobre tabelas pequenas (T crescente de 0 a 1)
function crs(T, Y, x) {
  const n = T.length;
  let k = 0;
  while (k < n - 2 && x > T[k + 1]) k++;
  const t0 = T[k], t1 = T[k + 1], u = clamp((x - t0) / (t1 - t0), 0, 1);
  const y0 = Y[k], y1 = Y[k + 1];
  const m0 = k > 0 ? (Y[k + 1] - Y[k - 1]) / (T[k + 1] - T[k - 1]) * (t1 - t0) : 0;
  const m1 = k < n - 2 ? (Y[k + 2] - Y[k]) / (T[k + 2] - T[k]) * (t1 - t0) : 0;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1;
}
const bump = (x, c, w) => { const d = Math.abs(x - c) / w; return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(d * Math.PI); };

// ---------------------------------------------------------------- estado de trabalho
// R: ângulos de Euler "relativos ao lado" (membros escritos como se fossem do lado
// esquerdo: rz + = abdução para fora, rx - = flexão para a frente; joelho rx + = dobra).
// Tronco: rx + = inclina para a frente, ry + = gira para a esquerda, rz + = tomba à direita.
const R = new Float32Array(NB * 3);
const W = { rx: 0, rz: 0, lift: 0, mode: 0, mirror: false, sup: 0 };
const M_FEET = 0, M_SUPPORT = 1, M_BODY = 2, M_ABS = 3, M_IK = 4;
const set = (b, x, y, z) => { R[b * 3] = x; R[b * 3 + 1] = y; R[b * 3 + 2] = z; };
const add = (b, x, y, z) => { R[b * 3] += x; R[b * 3 + 1] += y; R[b * 3 + 2] += z; };

// pontos de contato com o chão: osso, deslocamento local, raio, grupo (0 pé E, 1 pé D, 2 corpo)
const PTS = [
  [13, 0, -0.068, -0.055, 0, 0], [13, 0, -0.066, 0.125, 0, 0], [13, 0, -0.058, 0.19, 0, 0],
  [16, 0, -0.068, -0.055, 0, 1], [16, 0, -0.066, 0.125, 0, 1], [16, 0, -0.058, 0.19, 0, 1],
  [0, 0, -0.04, -0.02, 0.12, 2], [1, 0, 0.1, 0, 0.12, 2], [2, 0, 0.13, 0, 0.13, 2], [4, 0, 0.1, 0.01, 0.105, 2],
  [12, 0, 0, 0.01, 0.055, 2], [15, 0, 0, 0.01, 0.055, 2], [12, 0, -0.22, 0, 0.05, 2], [15, 0, -0.22, 0, 0.05, 2],
  [11, 0, -0.22, 0, 0.08, 2], [14, 0, -0.22, 0, 0.08, 2],
  [6, 0, 0, 0, 0.045, 2], [9, 0, 0, 0, 0.045, 2], [7, 0, -0.1, 0, 0.04, 2], [10, 0, -0.1, 0, 0.04, 2],
  [5, 0, -0.15, 0, 0.05, 2], [8, 0, -0.15, 0, 0.05, 2],
];
const NPT = PTS.length;
const PT = new Float32Array(NPT * 6);
PTS.forEach((p, k) => PT.set(p, k * 6));

// ---------------------------------------------------------------- clipes por quadros-chave
const NCH = NB * 3 + 3;   // + raiz x, raiz z, lift
const NAMES = { pelvis: 0, spine: 1, chest: 2, neck: 3, head: 4, uaL: 5, faL: 6, hL: 7, uaR: 8, faR: 9, hR: 10, thL: 11, shL: 12, ftL: 13, thR: 14, shR: 15, ftR: 16 };
const STAND = {
  pelvis: [0.03, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [-0.03, 0, 0],
  uaL: [0.04, 0, 0.1], faL: [-0.22], hL: [-0.1], uaR: [0.04, 0, 0.1], faR: [-0.22], hR: [-0.1],
  thL: [-0.03, 0, 0.03], shL: [0.06], ftL: [-0.03], thR: [-0.03, 0, 0.03], shR: [0.06], ftR: [-0.03], root: [0, 0, 0],
};
function applySpec(cur, spec) {
  for (const k in spec) {
    const v = spec[k];
    const o = k === 'root' ? NB * 3 : NAMES[k] * 3;
    if (o === undefined || Number.isNaN(o)) throw new Error('osso desconhecido: ' + k);
    cur[o] = v[0] || 0; cur[o + 1] = v[1] || 0; cur[o + 2] = v[2] || 0;
  }
}
// def: { mode, loop, keys: [[u, {osso: [x,y,z]}], ...] } — cada quadro herda do anterior
function clip(def) {
  const cur = new Float32Array(NCH);
  applySpec(cur, STAND);
  if (def.base) applySpec(cur, def.base);
  const n = def.keys.length;
  const c = { T: new Float32Array(n), D: new Float32Array(n * NCH), mode: def.mode ?? M_FEET, loop: !!def.loop, pmask: null, C: null };
  def.keys.forEach(([u, spec], k) => { applySpec(cur, spec); c.T[k] = u; c.D.set(cur, k * NCH); });
  if (def.power) {        // canais escalados pela força, preservando a pose do contato
    c.pmask = new Uint8Array(NCH);
    for (const nm of def.power) for (let j = 0; j < 3; j++) c.pmask[NAMES[nm] * 3 + j] = 1;
    c.C = new Float32Array(NCH);
    sampleInto(c, def.contact, c.C);
  }
  return c;
}
function sampleInto(c, u, out) {
  const T = c.T, D = c.D, n = T.length;
  if (n === 1) { out.set(D.subarray(0, NCH)); return; }
  u = c.loop ? frac(u) : clamp(u, 0, 1);
  let k = 0;
  while (k < n - 2 && u > T[k + 1]) k++;
  const t0 = T[k], t1 = T[k + 1], h = t1 - t0, s = clamp((u - t0) / h, 0, 1);
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const kp = k > 0 ? k - 1 : (c.loop ? n - 2 : -1), kn = k + 2 < n ? k + 2 : (c.loop ? 1 : -1);
  const tp = k > 0 ? T[k - 1] : T[0] - (1 - T[n - 2]), tn = k + 2 < n ? T[k + 2] : 1 + T[1];
  const a = k * NCH, b = (k + 1) * NCH, p = kp * NCH, q = kn * NCH;
  for (let j = 0; j < NCH; j++) {
    const y0 = D[a + j], y1 = D[b + j];
    const m0 = kp >= 0 ? (y1 - D[p + j]) / (t1 - tp) * h : 0;
    const m1 = kn >= 0 ? (D[q + j] - y0) / (tn - t0) * h : 0;
    out[j] = h00 * y0 + h10 * m0 + h01 * y1 + h11 * m1;
  }
}
const S1 = new Float32Array(NCH), S2 = new Float32Array(NCH);
function useClip(c, u, pw) {
  sampleInto(c, u, S1);
  if (c.pmask && pw !== 1) {
    const C = c.C, m = c.pmask;
    for (let j = 0; j < NCH; j++) if (m[j]) S1[j] = C[j] + (S1[j] - C[j]) * pw;
  }
  R.set(S1.subarray(0, NB * 3));
  W.rx = S1[NB * 3]; W.rz = S1[NB * 3 + 1]; W.lift = S1[NB * 3 + 2]; W.mode = c.mode;
}

// ---------- chutes (escritos para o pé DIREITO; o esquerdo é espelhado)
const KICK = clip({
  mode: M_SUPPORT, contact: ANIM.kick.contact, power: ['thR', 'shR', 'uaL', 'uaR', 'pelvis', 'spine', 'chest'],
  keys: [
    [0, { pelvis: [0.14, 0, 0], thL: [-0.35, 0, 0.04], shL: [0.35], ftL: [-0.1], thR: [0.25, 0, 0.05], shR: [0.7], ftR: [0.35],
      uaL: [-0.35, 0, 0.3], faL: [-0.5], uaR: [0.35, 0, 0.2], faR: [-0.5] }],
    [0.2, { pelvis: [0.16, -0.32, -0.12], spine: [0.04, -0.12, -0.05], chest: [0.02, -0.1, 0], head: [0.2, 0.2, 0],
      thL: [-0.42, 0.2, 0.08], shL: [0.45], ftL: [-0.15], thR: [0.75, 0.05, 0.12], shR: [1.9], ftR: [0.75],
      uaL: [-0.55, 0, 1.15], faL: [-0.35], uaR: [0.45, 0, 0.55], faR: [-0.4] }],
    [0.32, { pelvis: [0.14, -0.1, -0.18], thL: [-0.36, 0.05, 0.1], shL: [0.5], ftL: [-0.28], thR: [0.0, 0.02, 0.1], shR: [1.65], ftR: [0.85],
      uaL: [-0.45, 0, 1.25], uaR: [0.25, 0, 0.6] }],
    [0.42, { pelvis: [0.08, 0.1, -0.2], spine: [0.08, 0.05, -0.05], chest: [0.1, 0.08, 0], head: [0.35, 0, 0],
      thL: [-0.3, -0.1, 0.1], shL: [0.52], ftL: [-0.3], thR: [-0.55, 0, 0.08], shR: [0.6], ftR: [0.95],
      uaL: [-0.2, 0, 1.25], faL: [-0.3], uaR: [-0.1, 0, 0.6], faR: [-0.5] }],
    [0.66, { pelvis: [0.02, 0.4, -0.12], spine: [-0.02, 0.12, -0.02], chest: [-0.02, 0.1, 0], head: [0.1, -0.1, 0],
      thL: [-0.12, -0.35, 0.05], shL: [0.25], ftL: [0.25], thR: [-1.45, 0, 0.02], shR: [0.2], ftR: [0.7],
      uaL: [0.25, 0, 0.9], faL: [-0.5], uaR: [-0.75, 0, 0.55], faR: [-0.6] }],
    [1, { pelvis: [0.08, 0.15, 0], spine: [0.02, 0, 0], chest: [0, 0, 0], head: [0, 0, 0],
      thL: [0.12, 0, 0.03], shL: [0.3], ftL: [0.1], thR: [-0.45, 0, 0.03], shR: [0.35], ftR: [-0.05],
      uaL: [0.2, 0, 0.25], faL: [-0.5], uaR: [-0.3, 0, 0.25], faR: [-0.5] }],
  ],
});
const PASS = clip({
  mode: M_SUPPORT, contact: ANIM.pass.contact, power: ['thR', 'shR', 'uaL', 'uaR'],
  keys: [
    [0, { pelvis: [0.1, 0, 0], thL: [-0.3, 0, 0.04], shL: [0.35], ftL: [-0.1], thR: [0.15, 0.3, 0.1], shR: [0.5], ftR: [0.2],
      uaL: [-0.2, 0, 0.3], faL: [-0.5], uaR: [0.2, 0, 0.25], faR: [-0.5] }],
    [0.22, { pelvis: [0.12, -0.18, -0.08], head: [0.25, 0.1, 0], thL: [-0.25, 0.1, 0.06], shL: [0.45], ftL: [-0.3],
      thR: [0.4, 0.65, 0.2], shR: [1.0], ftR: [0.1], uaL: [-0.35, 0, 0.7], uaR: [0.3, 0, 0.45] }],
    [0.4, { pelvis: [0.12, 0.05, -0.1], head: [0.35, 0, 0], thL: [-0.22, 0, 0.06], shL: [0.48], ftL: [-0.36],
      thR: [-0.3, 0.9, 0.28], shR: [0.28], ftR: [-0.2], uaL: [-0.25, 0, 0.75], uaR: [0.15, 0, 0.5] }],
    [0.68, { pelvis: [0.06, 0.18, -0.05], head: [0.15, 0, 0], thR: [-0.75, 0.75, 0.22], shR: [0.3], ftR: [-0.1],
      uaL: [0.05, 0, 0.5], uaR: [-0.2, 0, 0.4] }],
    [1, { pelvis: [0.06, 0.05, 0], head: [0, 0, 0], thL: [0.05, 0, 0.03], shL: [0.25], ftL: [0.05],
      thR: [-0.3, 0.2, 0.05], shR: [0.3], ftR: [0], uaL: [0.1, 0, 0.2], uaR: [-0.1, 0, 0.2] }],
  ],
});
const CHIP = clip({
  mode: M_SUPPORT, contact: ANIM.chip.contact, power: ['thR', 'shR', 'uaL', 'uaR'],
  keys: [
    [0, { pelvis: [0.1, 0, 0], thL: [-0.35, 0, 0.04], shL: [0.35], ftL: [-0.1], thR: [0.2, 0, 0.05], shR: [0.6], ftR: [0.3],
      uaL: [-0.3, 0, 0.3], faL: [-0.5], uaR: [0.3, 0, 0.2], faR: [-0.5] }],
    [0.22, { pelvis: [0.08, -0.2, -0.1], head: [0.2, 0.15, 0], thL: [-0.38, 0.1, 0.08], shL: [0.45], ftL: [-0.12],
      thR: [0.55, 0, 0.1], shR: [1.6], ftR: [0.55], uaL: [-0.5, 0, 1.0], faL: [-0.4], uaR: [0.4, 0, 0.5] }],
    [0.44, { pelvis: [-0.05, 0.05, -0.15], spine: [-0.08, 0, 0], chest: [-0.05, 0, 0], head: [0.35, 0, 0],
      thL: [-0.12, 0, 0.08], shL: [0.5], ftL: [-0.36], thR: [-0.35, 0, 0.06], shR: [0.5], ftR: [0.2],
      uaL: [-0.3, 0, 1.2], uaR: [-0.2, 0, 0.7] }],
    [0.68, { pelvis: [-0.08, 0.12, -0.08], spine: [-0.08, 0, 0], thR: [-0.8, 0, 0.04], shR: [0.55], ftR: [0.1],
      uaL: [-0.1, 0, 0.9], uaR: [-0.4, 0, 0.6] }],
    [1, { pelvis: [0.05, 0.05, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], thL: [0.05, 0, 0.03], shL: [0.25],
      ftL: [0.05], thR: [-0.35, 0, 0.03], shR: [0.35], ftR: [0], uaL: [0.1, 0, 0.25], uaR: [-0.1, 0, 0.25] }],
  ],
});
const VOLLEY = clip({
  mode: M_SUPPORT, contact: ANIM.volley.contact, power: ['thR', 'shR'],
  keys: [
    [0, { pelvis: [0.08, 0, 0], thL: [-0.2, 0, 0.04], shL: [0.3], thR: [0, 0, 0.05], shR: [0.3], uaL: [-0.2, 0, 0.3], uaR: [0.2, 0, 0.3] }],
    [0.25, { pelvis: [0.05, 0.25, -0.42], spine: [0, 0.1, -0.12], chest: [0, 0.1, -0.1], neck: [0, 0, 0.25], head: [0.2, -0.2, 0.2],
      thL: [-0.15, -0.2, 0.2], shL: [0.45], ftL: [-0.3], thR: [-0.25, 0.35, 1.05], shR: [1.6], ftR: [0.4],
      uaL: [0.3, 0, 0.7], faL: [-0.6], uaR: [-0.3, 0, 1.5], faR: [-0.4] }],
    [0.45, { pelvis: [0.02, 0.45, -0.55], spine: [0, 0.15, -0.15], chest: [0, 0.12, -0.12], head: [0.25, -0.35, 0.25],
      thR: [-0.75, 0.3, 1.1], shR: [0.2], ftR: [0.65], uaL: [0.35, 0, 0.8], uaR: [-0.2, 0, 1.6] }],
    [0.7, { pelvis: [0.05, 0.8, -0.3], spine: [0, 0.2, -0.05], chest: [0, 0.15, -0.05], head: [0.1, -0.3, 0.1],
      thR: [-1.0, 0.1, 0.55], shR: [0.35], ftR: [0.4], thL: [-0.1, -0.5, 0.1], uaL: [0.2, 0, 0.6], uaR: [-0.4, 0, 0.9] }],
    [1, { pelvis: [0.05, 0.3, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
      thL: [0, 0, 0.05], shL: [0.25], ftL: [0.05], thR: [-0.3, 0, 0.1], shR: [0.4], ftR: [0], uaL: [0.1, 0, 0.3], uaR: [-0.1, 0, 0.3] }],
  ],
});
const TACKLE = clip({
  mode: M_SUPPORT, contact: ANIM.tackle.contact,
  keys: [
    [0, { pelvis: [0.15, 0, 0], thL: [-0.25, 0, 0.05], shL: [0.4], ftL: [-0.1], thR: [-0.1, 0, 0.08], shR: [0.35], uaL: [-0.2, 0, 0.35], faL: [-0.7], uaR: [-0.2, 0, 0.35], faR: [-0.7] }],
    [0.25, { pelvis: [0.2, -0.15, -0.12], spine: [0.1, 0, 0], thL: [-0.45, 0.1, 0.08], shL: [0.85], ftL: [-0.4],
      thR: [-0.3, 0.3, 0.25], shR: [0.9], ftR: [0.1], uaL: [-0.2, 0, 0.7], uaR: [0.1, 0, 0.6] }],
    [0.45, { pelvis: [0.12, -0.1, -0.22], spine: [0.12, 0.1, -0.05], chest: [0.08, 0.05, 0], head: [0.3, 0, 0],
      thL: [-0.55, 0.05, 0.1], shL: [1.0], ftL: [-0.55], thR: [-0.95, 0.5, 0.35], shR: [0.12], ftR: [-0.15],
      uaL: [-0.35, 0, 0.9], faL: [-0.4], uaR: [0.3, 0, 0.7], faR: [-0.4] }],
    [0.75, { thR: [-0.9, 0.45, 0.32], shR: [0.2] }],
    [1, { pelvis: [0.12, 0, 0], spine: [0.05, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], thL: [-0.3, 0, 0.05], shL: [0.5],
      ftL: [-0.2], thR: [-0.3, 0.1, 0.1], shR: [0.4], ftR: [0], uaL: [-0.1, 0, 0.3], faL: [-0.6], uaR: [-0.1, 0, 0.3], faR: [-0.6] }],
  ],
});
// ---------- cabeceio (lift = salto; escalado por power)
const HEADER = clip({
  mode: M_FEET, contact: ANIM.header.contact,
  keys: [
    [0, { pelvis: [0.3, 0, 0], spine: [0.1, 0, 0], thL: [-0.75, 0, 0.06], shL: [1.25], ftL: [-0.4], thR: [-0.75, 0, 0.06], shR: [1.25], ftR: [-0.4],
      uaL: [0.55, 0, 0.3], faL: [-0.4], uaR: [0.55, 0, 0.3], faR: [-0.4], head: [-0.2, 0, 0] }],
    [0.16, { pelvis: [0.05, 0, 0], spine: [0, 0, 0], thL: [0, 0, 0.04], shL: [0.05], ftL: [0.6], thR: [0, 0, 0.04], shR: [0.05], ftR: [0.6],
      uaL: [-1.1, 0, 0.6], faL: [-0.6], uaR: [-1.1, 0, 0.6], faR: [-0.6], root: [0, 0, 0.02] }],
    [0.32, { pelvis: [-0.05, 0, 0], spine: [-0.2, 0, 0], chest: [-0.15, 0, 0], neck: [-0.25, 0, 0], head: [-0.2, 0, 0],
      thL: [-0.25, 0, 0.08], shL: [0.9], ftL: [0.5], thR: [0.1, 0, 0.06], shR: [0.8], ftR: [0.5],
      uaL: [-0.9, 0, 1.2], faL: [-0.7], uaR: [-0.9, 0, 1.2], faR: [-0.7], root: [0, 0, 0.4] }],
    [0.45, { pelvis: [0.05, 0, 0], spine: [0.2, 0, 0], chest: [0.15, 0, 0], neck: [0.3, 0, 0], head: [0.25, 0, 0],
      thL: [-0.45, 0, 0.08], shL: [0.7], thR: [-0.2, 0, 0.06], shR: [0.6], uaL: [-0.4, 0, 1.2], faL: [-0.9], uaR: [-0.4, 0, 1.2], faR: [-0.9],
      root: [0, 0, 0.5] }],
    [0.62, { pelvis: [0.05, 0, 0], spine: [0.1, 0, 0], chest: [0.05, 0, 0], neck: [0.1, 0, 0], head: [0.05, 0, 0],
      thL: [-0.25, 0, 0.06], shL: [0.35], ftL: [0.4], thR: [-0.15, 0, 0.06], shR: [0.35], ftR: [0.4],
      uaL: [-0.3, 0, 0.8], faL: [-0.6], uaR: [-0.3, 0, 0.8], faR: [-0.6], root: [0, 0, 0.36] }],
    [0.8, { pelvis: [0.2, 0, 0], thL: [-0.5, 0, 0.06], shL: [0.9], ftL: [-0.4], thR: [-0.5, 0, 0.06], shR: [0.9], ftR: [-0.4],
      uaL: [-0.3, 0, 0.5], uaR: [-0.3, 0, 0.5], root: [0, 0, 0] }],
    [1, { pelvis: [0.05, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
      thL: [-0.1, 0, 0.04], shL: [0.2], ftL: [-0.1], thR: [-0.1, 0, 0.04], shR: [0.2], ftR: [-0.1],
      uaL: [0.05, 0, 0.2], faL: [-0.4], uaR: [0.05, 0, 0.2], faR: [-0.4], root: [0, 0, 0] }],
  ],
});
// ---------- carrinho (perna direita à frente)
const SLIDE = clip({
  mode: M_BODY, contact: ANIM.slide.contact,
  keys: [
    [0, { pelvis: [0.15, 0, 0], thL: [0.2, 0, 0.04], shL: [0.9], ftL: [0.4], thR: [-0.6, 0, 0.04], shR: [0.6], ftR: [0],
      uaL: [-0.4, 0, 0.2], faL: [-1.2], uaR: [0.4, 0, 0.2], faR: [-1.2] }],
    [0.12, { pelvis: [-0.35, 0, -0.2], spine: [0.1, 0, 0], chest: [0.1, 0, 0], neck: [0.2, 0, 0],
      thL: [-0.35, 0.2, 0.2], shL: [1.6], ftL: [0.4], thR: [-1.05, 0, 0.05], shR: [0.35], ftR: [0.1],
      uaL: [0.6, 0, 0.5], faL: [-0.3], uaR: [-0.6, 0, 0.7], faR: [-0.6] }],
    [0.25, { pelvis: [-0.95, 0, -0.35], spine: [0.15, 0, 0.1], chest: [0.12, 0, 0.05], neck: [0.4, 0, 0], head: [0.15, 0, 0],
      thL: [-0.25, 0.3, 0.45], shL: [2.1], ftL: [0.5], thR: [-0.5, 0, 0.02], shR: [0.08], ftR: [0.2],
      uaL: [0.9, 0, 0.5], faL: [-0.15], hL: [0.5], uaR: [-0.8, 0, 0.9], faR: [-0.5] }],
    [0.62, { pelvis: [-0.9, 0, -0.3], thR: [-0.55, 0, 0.02], shR: [0.12], uaR: [-0.7, 0, 0.8] }],
    [0.8, { pelvis: [-0.35, 0, -0.2], spine: [0.3, 0, 0.1], chest: [0.2, 0, 0], neck: [0.1, 0, 0], head: [0, 0, 0],
      thL: [-0.9, 0.2, 0.3], shL: [2.0], ftL: [-0.3], thR: [-1.0, 0, 0.05], shR: [1.1], ftR: [-0.2], uaL: [0.5, 0, 0.4], faL: [-0.3] }],
    [1, { pelvis: [0.2, 0, 0], spine: [0.05, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], thL: [-0.5, 0, 0.05], shL: [0.8], ftL: [-0.3],
      thR: [-0.35, 0, 0.05], shR: [0.7], ftR: [-0.35], uaL: [-0.1, 0, 0.3], faL: [-0.8], hL: [-0.1], uaR: [-0.1, 0, 0.3], faR: [-0.8] }],
  ],
});
// ---------- lateral (pés juntos, bola sobre a cabeça)
const THROWIN = clip({
  mode: M_FEET, contact: ANIM.throwin.contact,
  base: { thL: [-0.02, 0, 0.02], thR: [-0.02, 0, 0.02] },
  keys: [
    [0, { uaL: [-1.25, 0, 0.3], faL: [-1.5], hL: [-0.3], uaR: [-1.25, 0, 0.3], faR: [-1.5], hR: [-0.3] }],
    [0.32, { pelvis: [-0.05, 0, 0], spine: [-0.1, 0, 0], chest: [-0.12, 0, 0], neck: [-0.02, 0, 0], head: [0.02, 0, 0],
      thL: [0.04, 0, 0.02], shL: [0.18], ftL: [-0.1], thR: [0.04, 0, 0.02], shR: [0.18], ftR: [-0.1],
      uaL: [-2.8, 0, 0.35], faL: [-1.6], hL: [-0.4], uaR: [-2.8, 0, 0.35], faR: [-1.6], hR: [-0.4] }],
    [0.62, { pelvis: [0.08, 0, 0], spine: [0.12, 0, 0], chest: [0.15, 0, 0], neck: [0.05, 0, 0], head: [0, 0, 0],
      thL: [-0.04, 0, 0.02], shL: [0.12], ftL: [0], thR: [-0.04, 0, 0.02], shR: [0.12], ftR: [0],
      uaL: [-2.35, 0, 0.25], faL: [-0.25], hL: [-0.2], uaR: [-2.35, 0, 0.25], faR: [-0.25], hR: [-0.2] }],
    [0.8, { pelvis: [0.12, 0, 0], spine: [0.22, 0, 0], chest: [0.12, 0, 0], uaL: [-1.4, 0, 0.25], faL: [-0.2], uaR: [-1.4, 0, 0.25], faR: [-0.2] }],
    [1, { pelvis: [0.05, 0, 0], spine: [0.05, 0, 0], chest: [0, 0, 0], uaL: [-0.3, 0, 0.2], faL: [-0.4], hL: [-0.1], uaR: [-0.3, 0, 0.2], faR: [-0.4], hR: [-0.1] }],
  ],
});
// ---------- goleiro: mergulho para a DIREITA (rasteiro e no ângulo; mistura por diveHeight)
const READY = {
  pelvis: [0.32, 0, 0], spine: [0.08, 0, 0], chest: [0.02, 0, 0], neck: [-0.2, 0, 0], head: [-0.2, 0, 0],
  thL: [-0.62, 0.15, 0.25], shL: [1.0], ftL: [-0.3], thR: [-0.62, 0.15, 0.25], shR: [1.0], ftR: [-0.3],
  uaL: [-0.55, 0, 0.45], faL: [-0.8], hL: [-0.3], uaR: [-0.55, 0, 0.45], faR: [-0.8], hR: [-0.3],
};
const DIVE_LO = clip({
  mode: M_ABS, contact: ANIM.gk_dive.contact, base: READY,
  keys: [
    [0, { root: [0, 0, 0.78] }],
    [0.13, { pelvis: [0.3, 0, 0.55], spine: [0.1, 0, 0.1], neck: [-0.2, 0, -0.3],
      thL: [-0.2, 0, 0.2], shL: [0.35], ftL: [0.3], thR: [-0.8, 0.2, 0.7], shR: [1.1], ftR: [-0.2],
      uaL: [-0.7, 0, 1.3], faL: [-0.5], uaR: [-0.5, 0, 1.8], faR: [-0.4], root: [-0.45, 0, 0.62] }],
    [0.35, { pelvis: [0.05, 0, 1.52], spine: [0, 0, 0.05], chest: [0, 0, 0.05], neck: [-0.1, 0, -0.35], head: [-0.1, 0, -0.2],
      thL: [0.05, 0, 0.12], shL: [0.3], ftL: [0.5], thR: [-0.3, 0, -0.08], shR: [0.5], ftR: [0.4],
      uaL: [-0.15, 0, 3.2], faL: [-0.05], hL: [-0.2], uaR: [0.05, 0, 3.05], faR: [-0.05], hR: [-0.2], root: [-1.35, 0, 0.22] }],
    [0.55, { pelvis: [0.05, 0, 1.57], root: [-1.85, 0, 0.2] }],
    [0.72, { pelvis: [0.1, 0, 1.57], spine: [0.15, 0, 0], chest: [0.1, 0, 0], neck: [0.1, 0, -0.2],
      thL: [-0.4, 0, 0.1], shL: [0.8], thR: [-0.6, 0, 0.2], shR: [1.0],
      uaL: [-1.2, 0, 1.5], faL: [-1.3], uaR: [-1.0, 0, 1.3], faR: [-1.5], root: [-2.05, 0, 0.18] }],
    [1, { root: [-2.2, 0, 0.18] }],
  ],
});
const DIVE_HI = clip({
  mode: M_ABS, contact: ANIM.gk_dive.contact, base: READY,
  keys: [
    [0, { root: [0, 0, 0.78] }],
    [0.14, { pelvis: [0.1, 0, 0.35], spine: [-0.05, 0, 0.1], neck: [-0.3, 0, -0.2],
      thL: [0.1, 0, 0.15], shL: [0.2], ftL: [0.6], thR: [-1.0, 0.2, 0.5], shR: [1.2], ftR: [-0.2],
      uaL: [-1.6, 0, 1.0], faL: [-0.4], uaR: [-1.4, 0, 1.4], faR: [-0.3], root: [-0.35, 0, 0.9] }],
    [0.35, { pelvis: [-0.05, 0, 0.72], spine: [-0.08, 0, 0.1], chest: [-0.05, 0, 0.08], neck: [-0.2, 0, -0.25], head: [-0.2, 0, -0.15],
      thL: [0.1, 0, 0.1], shL: [0.4], ftL: [0.6], thR: [-0.55, 0, 0.35], shR: [1.1], ftR: [0.4],
      uaL: [-0.3, 0, 2.95], faL: [-0.05], hL: [-0.2], uaR: [-0.1, 0, 3.05], faR: [-0.05], hR: [-0.2], root: [-1.2, 0, 1.55] }],
    [0.55, { pelvis: [0.0, 0, 1.25], root: [-1.7, 0, 0.9] }],
    [0.72, { pelvis: [0.1, 0, 1.57], spine: [0.15, 0, 0], chest: [0.1, 0, 0], neck: [0.1, 0, -0.2],
      thL: [-0.4, 0, 0.1], shL: [0.8], thR: [-0.6, 0, 0.2], shR: [1.0],
      uaL: [-1.2, 0, 1.5], faL: [-1.3], uaR: [-1.0, 0, 1.3], faR: [-1.5], root: [-2.0, 0, 0.18] }],
    [1, { root: [-2.2, 0, 0.18] }],
  ],
});
const GK_CATCH = clip({
  mode: M_FEET, contact: ANIM.gk_catch.contact,
  base: { pelvis: [0.15, 0, 0], thL: [-0.3, 0.1, 0.1], shL: [0.5], ftL: [-0.2], thR: [-0.3, 0.1, 0.1], shR: [0.5], ftR: [-0.2] },
  keys: [
    [0, { uaL: [-0.55, 0, 0.45], faL: [-0.8], hL: [-0.3], uaR: [-0.55, 0, 0.45], faR: [-0.8], hR: [-0.3] }],
    [0.3, { spine: [0.05, 0, 0], head: [0.1, 0, 0], uaL: [-1.35, 0.3, 0.25], faL: [-0.35], hL: [-0.5], uaR: [-1.35, 0.3, 0.25], faR: [-0.35], hR: [-0.5] }],
    [0.65, { pelvis: [0.08, 0, 0], spine: [0.15, 0, 0], chest: [0.1, 0, 0], head: [0.2, 0, 0],
      uaL: [-0.35, 0.5, 0.35], faL: [-2.1], hL: [-0.3], uaR: [-0.35, 0.5, 0.35], faR: [-2.1], hR: [-0.3],
      thL: [-0.1, 0, 0.05], shL: [0.2], ftL: [-0.1], thR: [-0.1, 0, 0.05], shR: [0.2], ftR: [-0.1] }],
    [1, { pelvis: [0.05, 0, 0], spine: [0.08, 0, 0], chest: [0.05, 0, 0], head: [0.05, 0, 0],
      thL: [-0.04, 0, 0.04], shL: [0.08], ftL: [-0.04], thR: [-0.04, 0, 0.04], shR: [0.08], ftR: [-0.04] }],
  ],
});
const HOLD = {
  pelvis: [0.05, 0, 0], spine: [0.08, 0, 0], chest: [0.05, 0, 0], head: [0.05, 0, 0],
  uaL: [-0.35, 0.5, 0.35], faL: [-2.1], hL: [-0.3], uaR: [-0.35, 0.5, 0.35], faR: [-2.1], hR: [-0.3],
};
const GK_HOLD = clip({ mode: M_FEET, loop: true, base: HOLD, keys: [[0, { chest: [0.05, 0, 0] }], [0.5, { chest: [0.02, 0, 0], spine: [0.07, 0, 0] }], [1, { chest: [0.05, 0, 0], spine: [0.08, 0, 0] }]] });
const GK_THROW = clip({
  mode: M_SUPPORT, contact: ANIM.gk_throw.contact, base: HOLD,
  keys: [
    [0, {}],
    [0.25, { pelvis: [0.05, -0.5, -0.1], spine: [-0.05, -0.2, 0], chest: [-0.05, -0.15, 0], head: [0, 0.6, 0],
      thL: [-0.6, 0, 0.06], shL: [0.35], ftL: [-0.2], thR: [0.35, 0, 0.08], shR: [0.25], ftR: [0.2],
      uaL: [-2.1, 0, 0.3], faL: [-0.2], hL: [0], uaR: [1.1, 0, 0.35], faR: [-0.15], hR: [0] }],
    [0.45, { pelvis: [0.05, -0.3, -0.1], spine: [-0.1, -0.1, -0.1], uaR: [2.6, 0, 0.3], faR: [-0.1], uaL: [-1.6, 0, 0.3] }],
    [0.6, { pelvis: [0.15, 0.2, -0.12], spine: [0.1, 0.1, -0.1], chest: [0.15, 0.1, 0], head: [0.1, 0, 0],
      thL: [-0.5, 0, 0.06], shL: [0.45], ftL: [-0.2], thR: [0.3, 0, 0.08], shR: [0.4], ftR: [0.4],
      uaR: [3.85, 0, 0.25], faR: [-0.1], uaL: [-0.4, 0, 0.5], faL: [-0.5] }],
    [0.8, { pelvis: [0.3, 0.4, -0.1], spine: [0.2, 0.15, 0], chest: [0.15, 0.1, 0], uaR: [4.9, 0, 0.3], faR: [-0.3], uaL: [0.3, 0, 0.4] }],
    [1, { pelvis: [0.1, 0.2, 0], spine: [0.05, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], thL: [-0.3, 0, 0.05], shL: [0.3], ftL: [-0.05],
      thR: [0.1, 0, 0.05], shR: [0.4], ftR: [0.2], uaR: [5.95, 0, 0.2], faR: [-0.4], uaL: [0.1, 0, 0.2], faL: [-0.4] }],
  ],
});
const GK_KICK = clip({
  mode: M_SUPPORT, contact: ANIM.gk_kick.contact, base: HOLD, power: ['thR', 'shR'],
  keys: [
    [0, {}],
    [0.25, { pelvis: [0.12, 0, 0], thL: [-0.45, 0, 0.05], shL: [0.35], ftL: [-0.1], thR: [0.2, 0, 0.05], shR: [0.5], ftR: [0.3],
      uaL: [-1.25, 0.2, 0.25], faL: [-0.3], uaR: [-1.25, 0.2, 0.25], faR: [-0.3] }],
    [0.4, { pelvis: [0.08, -0.15, -0.1], head: [0.3, 0, 0], thL: [-0.3, 0, 0.06], shL: [0.4], ftL: [-0.2], thR: [0.65, 0, 0.08], shR: [1.5], ftR: [0.6],
      uaL: [-0.6, 0, 1.0], faL: [-0.4], uaR: [-0.2, 0, 0.9], faR: [-0.4] }],
    [0.55, { pelvis: [-0.05, 0.08, -0.15], spine: [-0.05, 0, 0], head: [0.3, 0, 0], thL: [-0.15, 0, 0.06], shL: [0.35], ftL: [-0.1],
      thR: [-0.95, 0, 0.05], shR: [0.35], ftR: [0.9], uaL: [-0.4, 0, 1.2], uaR: [0.1, 0, 0.9] }],
    [0.75, { pelvis: [-0.2, 0.2, -0.08], spine: [-0.1, 0, 0], head: [0, 0, 0], thL: [0, 0, 0.05], shL: [0.2], ftL: [0.5],
      thR: [-1.95, 0, 0.05], shR: [0.1], ftR: [0.6], uaL: [0, 0, 1.1], uaR: [-0.8, 0, 0.7] }],
    [1, { pelvis: [0.05, 0.1, 0], spine: [0, 0, 0], thL: [-0.05, 0, 0.04], shL: [0.2], ftL: [0], thR: [-0.4, 0, 0.04], shR: [0.4], ftR: [0],
      uaL: [0.1, 0, 0.3], faL: [-0.4], uaR: [-0.1, 0, 0.3], faR: [-0.4] }],
  ],
});
// ---------- queda para a frente e levantar (deitado de bruços)
const PRONE = {
  pelvis: [1.5, 0, 0], spine: [0.02, 0, 0], chest: [0, 0, 0], neck: [-0.55, 0, 0], head: [-0.3, 0.3, 0],
  thL: [0.08, 0, 0.1], shL: [0.25], ftL: [1.1], thR: [0.05, 0, 0.12], shR: [0.4], ftR: [1.1],
  uaL: [-2.5, 0, 0.55], faL: [-1.4], hL: [0.2], uaR: [-2.2, 0, 0.7], faR: [-1.6], hR: [0.2],
};
const FALL = clip({
  mode: M_BODY,
  keys: [
    [0, { pelvis: [0.15, 0, 0], thL: [-0.5, 0, 0.04], shL: [0.5], thR: [0.3, 0, 0.04], shR: [0.6], uaL: [0.3, 0, 0.2], faL: [-1.1], uaR: [-0.3, 0, 0.2], faR: [-1.1] }],
    [0.12, { pelvis: [0.45, 0, 0.1], spine: [0.1, 0, 0], neck: [-0.3, 0, 0], thL: [-0.2, 0, 0.05], shL: [0.2], ftL: [0.2],
      thR: [0.6, 0, 0.05], shR: [1.3], ftR: [0.5], uaL: [-1.3, 0, 0.5], faL: [-0.4], uaR: [-1.2, 0, 0.6], faR: [-0.4] }],
    [0.28, { pelvis: [0.95, 0, 0.05], spine: [0.05, 0, 0], neck: [-0.45, 0, 0], thL: [0.25, 0, 0.08], shL: [0.4], ftL: [0.8],
      thR: [0.4, 0, 0.08], shR: [0.9], ftR: [0.8], uaL: [-2.0, 0, 0.5], faL: [-0.3], uaR: [-1.9, 0, 0.6], faR: [-0.3] }],
    [0.42, { ...PRONE, uaL: [-2.3, 0, 0.5], faL: [-0.9], uaR: [-2.1, 0, 0.6], faR: [-1.0], neck: [-0.4, 0, 0] }],
    [0.55, PRONE],
    [1, PRONE],
  ],
});
const GETUP = clip({
  mode: M_BODY,
  keys: [
    [0, PRONE],
    [0.28, { pelvis: [1.25, 0, 0], spine: [0.05, 0, 0], neck: [-0.5, 0, 0], head: [-0.1, 0, 0],
      thL: [-0.9, 0, 0.12], shL: [1.9], ftL: [0.9], thR: [-0.9, 0, 0.12], shR: [1.9], ftR: [0.9],
      uaL: [-1.4, 0, 0.3], faL: [-0.2], hL: [0.6], uaR: [-1.4, 0, 0.3], faR: [-0.2], hR: [0.6] }],
    [0.55, { pelvis: [0.45, 0, 0], spine: [0.2, 0, 0], neck: [-0.3, 0, 0], head: [0, 0, 0],
      thL: [-1.6, 0, 0.08], shL: [1.8], ftL: [-0.3], thR: [0.35, 0, 0.1], shR: [1.6], ftR: [0.9],
      uaL: [-0.6, 0, 0.3], faL: [-0.7], hL: [0], uaR: [-0.4, 0, 0.3], faR: [-0.6], hR: [0] }],
    [0.8, { pelvis: [0.25, 0, 0], spine: [0.1, 0, 0], neck: [-0.1, 0, 0], thL: [-0.8, 0, 0.06], shL: [0.9], ftL: [-0.1],
      thR: [0.1, 0, 0.06], shR: [0.8], ftR: [0.5], uaL: [-0.2, 0, 0.3], faL: [-0.6], uaR: [0, 0, 0.3], faR: [-0.5] }],
    [1, STAND],
  ],
});
// ---------- comemorações e desânimo
const KNEESLIDE = clip({
  mode: M_BODY,
  keys: [
    [0, { pelvis: [0.2, 0, 0], thL: [-0.5, 0, 0.05], shL: [0.6], thR: [0.2, 0, 0.05], shR: [0.8], uaL: [0.3, 0, 0.4], uaR: [-0.3, 0, 0.4] }],
    [0.1, { pelvis: [0.05, 0, 0], spine: [-0.1, 0, 0], thL: [-0.2, 0, 0.12], shL: [1.9], ftL: [0.9], thR: [-0.1, 0, 0.12], shR: [2.0], ftR: [0.9],
      uaL: [-0.5, 0, 1.4], faL: [-0.3], uaR: [-0.5, 0, 1.4], faR: [-0.3] }],
    [0.25, { pelvis: [-0.15, 0, 0], spine: [-0.25, 0, 0], chest: [-0.25, 0, 0], neck: [-0.25, 0, 0], head: [-0.2, 0, 0],
      thL: [0.1, 0, 0.14], shL: [2.25], ftL: [1.2], thR: [0.1, 0, 0.14], shR: [2.25], ftR: [1.2],
      uaL: [-0.6, 0, 2.5], faL: [-0.25], hL: [0], uaR: [-0.6, 0, 2.5], faR: [-0.25], hR: [0] }],
    [0.6, { uaL: [-0.4, 0, 2.7], faL: [-0.5], uaR: [-0.4, 0, 2.7], faR: [-0.5], head: [-0.35, 0, 0] }],
    [1, { uaL: [-0.6, 0, 2.5], faL: [-0.25], uaR: [-0.6, 0, 2.5], faR: [-0.25], head: [-0.2, 0, 0] }],
  ],
});
const FISTPUMP = clip({
  mode: M_FEET, loop: true,
  keys: [
    [0, { pelvis: [0.25, 0, 0], spine: [0.1, 0, 0], thL: [-0.6, 0, 0.06], shL: [1.1], ftL: [-0.45], thR: [-0.6, 0, 0.06], shR: [1.1], ftR: [-0.45],
      uaL: [0.2, 0, 0.4], faL: [-1.2], uaR: [-0.4, 0, 0.5], faR: [-1.9], neck: [-0.2, 0, 0], head: [-0.1, 0, 0] }],
    [0.25, { pelvis: [-0.05, 0, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], neck: [-0.3, 0, 0], head: [-0.2, 0, 0],
      thL: [-0.1, 0, 0.06], shL: [0.5], ftL: [0.6], thR: [0.1, 0, 0.06], shR: [0.7], ftR: [0.6],
      uaL: [0.1, 0, 0.5], faL: [-1.3], uaR: [-2.95, 0, 0.25], faR: [-0.25], root: [0, 0, 0.42] }],
    [0.5, { pelvis: [0, 0, 0], thL: [-0.2, 0, 0.06], shL: [0.4], ftL: [0.3], thR: [-0.2, 0, 0.06], shR: [0.4], ftR: [0.3],
      uaR: [-2.4, 0, 0.35], faR: [-1.4], root: [0, 0, 0.22] }],
    [0.7, { pelvis: [0.3, 0, 0], spine: [0.12, 0, 0], thL: [-0.7, 0, 0.06], shL: [1.25], ftL: [-0.5], thR: [-0.7, 0, 0.06], shR: [1.25], ftR: [-0.5],
      uaR: [-0.6, 0, 0.45], faR: [-2.0], root: [0, 0, 0] }],
    [1, { pelvis: [0.25, 0, 0], spine: [0.1, 0, 0], chest: [0, 0, 0], thL: [-0.6, 0, 0.06], shL: [1.1], ftL: [-0.45], thR: [-0.6, 0, 0.06], shR: [1.1], ftR: [-0.45],
      uaR: [-0.4, 0, 0.5], faR: [-1.9], neck: [-0.2, 0, 0], head: [-0.1, 0, 0] }],
  ],
});
const POINTSKY = clip({
  mode: M_FEET,
  keys: [
    [0, {}],
    [0.15, { spine: [-0.12, 0, 0], chest: [-0.12, 0, 0], neck: [-0.35, 0, 0], head: [-0.3, 0, 0],
      uaL: [-2.6, 0.3, 0.45], faL: [-0.15], hL: [0.3], uaR: [-2.6, 0.3, 0.45], faR: [-0.15], hR: [0.3] }],
    [0.6, { spine: [-0.16, 0, 0], neck: [-0.4, 0, 0], uaL: [-2.75, 0.3, 0.4], uaR: [-2.75, 0.3, 0.4] }],
    [1, { spine: [-0.12, 0, 0], neck: [-0.35, 0, 0], uaL: [-2.6, 0.3, 0.45], uaR: [-2.6, 0.3, 0.45] }],
  ],
});
const HANDS_HEAD = clip({
  mode: M_FEET,
  keys: [
    [0, {}],
    [0.15, { spine: [0.05, 0, 0], neck: [0.3, 0, 0], head: [0.25, 0, 0], uaL: [-0.75, 0.3, 2.05], faL: [-2.25], hL: [-0.4], uaR: [-0.75, 0.3, 2.05], faR: [-2.25], hR: [-0.4] }],
    [0.55, { neck: [0.4, 0, 0], head: [0.3, 0.1, 0], spine: [0.08, 0, 0] }],
    [1, { neck: [0.35, 0, 0], head: [0.2, -0.1, 0] }],
  ],
});
const HANDS_HIPS = clip({
  mode: M_FEET,
  keys: [
    [0, {}],
    [0.15, { spine: [0.1, 0, 0], chest: [0.12, 0, 0], neck: [0.35, 0, 0], head: [0.35, 0, 0],
      uaL: [0.3, -0.3, 0.6], faL: [-1.7], hL: [0.2, 0, -0.3], uaR: [0.3, -0.3, 0.6], faR: [-1.7], hR: [0.2, 0, -0.3],
      thL: [-0.02, 0, 0.07], thR: [-0.02, 0, 0.07] }],
    [0.6, { neck: [0.45, 0, 0], chest: [0.16, 0, 0] }],
    [1, { neck: [0.4, 0, 0], chest: [0.12, 0, 0] }],
  ],
});

// ---------------------------------------------------------------- IK de perna e locomoção
const QP = new Float32Array(4);
// resolve a perna (0 = esq., 1 = dir.) para levar o tornozelo ao alvo (espaço do modelo),
// com a pelve em (px, py, pz) e rotação QP; pitch = inclinação do pé no mundo (+ = ponta p/ baixo)
function legIK(side, px, py, pz, tx, ty, tz, pitch, yawFix) {
  const sg = side === 0 ? 1 : -1;
  qRot(QP, 0, sg * LEG.hipX, LEG.hipY, 0, false);
  qRot(QP, 0, tx - (px + V[0]), ty - (py + V[1]), tz - (pz + V[2]), true);
  const vx = V[0] * sg, vy = V[1], vz = V[2];
  const len = Math.hypot(vx, vy, vz) || 1e-6;
  const D = clamp(len, 0.3, (L1 + L2) * 0.9995);
  const abd = clamp(Math.atan2(vx, Math.max(-vy, 0.05)), -0.5, 1.4);
  const a0 = Math.atan2(-vz, Math.hypot(vx, vy));
  const k = Math.acos(clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
  const beta = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
  const th = a0 - beta;
  const b = side === 0 ? 11 : 14;
  set(b, th, 0, abd);
  set(b + 1, k, 0, 0);
  set(b + 2, pitch - (R[0] + th + k), yawFix, 0);
}
// altura máxima da pelve para que o pé alcance o alvo (perna quase esticada)
function reachY(side, px, pz, tx, ty, tz) {
  const sg = side === 0 ? 1 : -1;
  qRot(QP, 0, sg * LEG.hipX, LEG.hipY, 0, false);
  const hx = px + V[0] - tx, hz = pz + V[2] - tz, Lm = (L1 + L2) * 0.985;
  const h2 = hx * hx + hz * hz;
  return ty + Math.sqrt(Math.max(Lm * Lm - h2, 0.01)) - V[1];
}
// deslocamento do tornozelo quando o pé gira sobre a bola (φ>0) ou o calcanhar (φ<0)
const PV = { dy: 0, dz: 0 };
function pivot(phi) {
  const py = -0.066, pz = phi >= 0 ? 0.125 : -0.055;
  const c = Math.cos(phi), s = Math.sin(phi);
  PV.dy = -(py * c - pz * s) + py;       // tornozelo sobe
  PV.dz = pz - (py * s + pz * c);
}
// tabelas da trajetória do pé no balanço (b 0..1): avanço (fração de d) e altura
const SW_T = [0, 0.2, 0.45, 0.7, 0.88, 1];
const SWW_Z = [-0.5, -0.36, -0.05, 0.3, 0.47, 0.5], SWW_Y = [0.02, 0.07, 0.075, 0.05, 0.02, 0];
const SWR_Z = [-0.5, -0.6, -0.28, 0.32, 0.56, 0.5], SWR_Y = [0.04, 0.8, 1, 0.62, 0.16, 0];
const SWW_P = [0.55, 0.3, 0, -0.1, -0.18, -0.2], SWR_P = [0.6, 0.95, 0.75, 0.2, 0.05, 0.05];

// comprimento (m) de um ciclo completo de passada (dois passos) na velocidade v
export function cycleLength(v, moveAngle = 0) {
  const lat = Math.abs(Math.sin(moveAngle)), back = Math.max(0, -Math.cos(moveAngle));
  const L = v < 1.5 ? lerp(0.7, 1.505, Math.max(v, 0) / 1.5) : 0.95 + 0.37 * v;
  return L * (1 - 0.3 * lat - 0.25 * back);
}

const G = { v: 0, ma: 0, stride: 0, t: 0, crouch: 0, width: 0.12, lean: 0, yaw: 0, Lmul: 1, heel: 0, bank: 0, seed: 0, armA: 1, drib: 0, bx: 0, bz: 0, tf: 1 };
const FT = new Float32Array(8); // alvo por pé: x, y, z, pitch
function gaitReset() {
  G.v = 0; G.ma = 0; G.stride = 0; G.t = 0; G.crouch = 0; G.width = 0.12; G.lean = 0; G.yaw = 0; G.Lmul = 1; G.heel = 0; G.bank = 0; G.seed = 0; G.armA = 1; G.drib = 0; G.bx = 0; G.bz = 0; G.tf = 1;
}
function gait() {
  const v = Math.max(G.v, 0), ma = G.ma, t = G.t;
  const mv = smooth(clamp(v / 0.7, 0, 1));
  const run = smooth(clamp((v - 1.9) / 1.5, 0, 1));
  const spr = smooth(clamp((v - 5.8) / 3.2, 0, 1));
  const sM = Math.sin(ma), cM = Math.cos(ma);
  const lat = Math.abs(sM), back = Math.max(0, -cM), fwd = Math.max(0, cM);
  const L = cycleLength(v, ma) * G.Lmul;
  // apoio: limitado pelo alcance da perna (quadril baixa no máximo ~5 cm)
  const pyNom = lerp(lerp(0.935 - 0.01 * (1 - mv), 0.915, run), 0.9, spr) - G.crouch;
  const reach = (L1 + L2) * 0.985, hv = pyNom - lerp(0.055, 0.035, run) - 0.03 - LEG.ankle;
  const dMax = 2 * Math.sqrt(Math.max(reach * reach - hv * hv, 0.01)) + 0.1;
  let duty = Math.min(lerp(lerp(0.58, 0.4, run), 0.27, spr), dMax / L);
  duty = Math.max(duty, lerp(0.53, 0.2, run));
  const d = duty * L;
  const ph = G.stride;
  const uL = frac(ph), uR = frac(ph + 0.5);
  const dirX = -sM, dirZ = cM;
  // inclinação para a frente
  const leanF = mv * (lerp(lerp(0.05, 0.14, run), 0.32, spr) * fwd + 0.06 * back + 0.06 * lat) + G.lean;
  const breath = Math.sin(t * TAU / lerp(3.4, 1.4, mv * run)) * lerp(0.018, 0.01, mv);
  const sway = Math.sin(t * 0.9 + G.seed * 5.1) * (1 - mv);
  const Ay = mv * lerp(0.1, 0.13, run) * (1 - 0.6 * lat);
  const yawOsc = -Ay * Math.cos(TAU * uL);
  // pelve e tronco (antes do IK, que depende da rotação da pelve)
  set(0, leanF * 0.5 + G.crouch * 1.4, yawOsc + G.yaw * 0.55, G.bank * 0.8 - sway * 0.03 + mv * 0.03 * Math.sin(TAU * uL) * (1 - run));
  set(1, leanF * 0.28 - G.crouch * 0.5, -yawOsc * 0.4 + G.yaw * 0.2, G.bank * 0.15 + sway * 0.02);
  set(2, leanF * 0.22 + breath - G.crouch * 0.4, -yawOsc * 1.1 + G.yaw * 0.15, sway * 0.01);
  set(3, -leanF * 0.35 + G.crouch * 0.3, -G.yaw * 0.4, 0);
  set(4, -leanF * 0.3 - 0.02 + G.crouch * 0.2, -G.yaw * 0.3 + (1 - mv) * 0.06 * Math.sin(t * 0.37 + G.seed * 3.3), 0);
  qEuler(QP, 0, R[0], R[1], R[2], 0);
  // alvos dos pés
  let flight = 1e9, anyStance = false;
  const bankX = Math.sin(G.bank) * 0.8;
  const cy = Math.cos(G.yaw * 0.9), sy = Math.sin(G.yaw * 0.9);
  for (let sd = 0; sd < 2; sd++) {
    const sg = sd === 0 ? 1 : -1, u = sd === 0 ? uL : uR;
    let m, y, pitch;
    if (u < duty) {
      const a = u / duty;
      m = d * (0.42 - a); y = 0;
      pitch = -lerp(0.22, 0.02, run) * Math.max(0, 1 - a / 0.2) + lerp(0.5, 0.45, run) * smooth(clamp((a - 0.55) / 0.45, 0, 1));
      anyStance = true;
      flight = 0;
    } else {
      const b = (u - duty) / (1 - duty);
      const hk = lerp(0.2, 0.52, spr);
      m = d * (lerp(crs(SW_T, SWW_Z, b), crs(SW_T, SWR_Z, b), run) - 0.08) - run * 0.06 * Math.sin(Math.PI * b);
      y = lerp(crs(SW_T, SWW_Y, b), crs(SW_T, SWR_Y, b) * hk, run);
      pitch = lerp(crs(SW_T, SWW_P, b), crs(SW_T, SWR_P, b), run);
      flight = Math.min(flight, y);
    }
    // postura parada (idle / prontidão) — pés afastados, levemente desencontrados
    const ix0 = sg * (G.width + 0.015), iz0 = sg * 0.03 * (G.seed > 0.5 ? 1 : -1);
    const ix = ix0 * cy + iz0 * sy, iz = -ix0 * sy + iz0 * cy;
    let tx = lerp(ix, sg * (lerp(0.105, 0.07, run) + 0.08 * lat + G.width - 0.12) + dirX * m, mv) + bankX;
    let tz = lerp(iz, dirZ * m, mv);
    pitch = lerp(G.heel, pitch, mv);
    y *= mv;
    // toque de condução: o pé bom busca a bola no fim do balanço (u ≈ 0,85, o mesmo
    // instante em que match.js dá o toque) e a empurra com o peito do pé
    if (G.drib > 0 && sd === (G.tf > 0 ? 1 : 0) && u >= duty) {
      const bz = G.bz, reachK = clamp((1.05 - bz) / 0.3, 0, 1) * clamp((bz - 0.05) / 0.15, 0, 1);
      const w = G.drib * mv * reachK * Math.exp(-(((u - 0.86) / 0.1) ** 2));
      if (w > 0.001) {
        tx = lerp(tx, clamp(G.bx, -0.35, 0.35) + sg * 0.02, w);
        tz = lerp(tz, bz - 0.22, w);
        y = lerp(y, 0.06, w);
        pitch = lerp(pitch, 0.4, w);
      }
    }
    // no apoio o pé gira sobre a bola/calcanhar; no balanço o efeito some aos poucos
    pivot(pitch);
    const fade = u < duty ? 1 : lerp(1, Math.max(1 - (u - duty) / (1 - duty) * 3, 0), mv);
    FT[sd * 4] = tx;
    FT[sd * 4 + 1] = LEG.ankle + y + PV.dy * fade;
    FT[sd * 4 + 2] = tz + PV.dz * fade;
    FT[sd * 4 + 3] = pitch;
  }
  // altura da pelve: nominal (com balanço vertical) limitada pelo alcance dos pés de apoio
  let py = pyNom;
  py -= mv * (1 - run) * 0.012 * Math.cos(TAU * 2 * uL) + run * 0.025 * Math.cos(TAU * 2 * (uL - duty * 0.5));
  if (!anyStance) py += Math.min(flight, 0.12) * 0.5;
  const rx = sway * 0.025, rz = -G.crouch * 0.35;
  for (let sd = 0; sd < 2; sd++) {
    const u = sd === 0 ? uL : uR;
    if (u < duty || mv < 0.99) py = Math.min(py, reachY(sd, rx, rz, FT[sd * 4], FT[sd * 4 + 1], FT[sd * 4 + 2]));
  }
  W.rx = rx; W.rz = rz; W.lift = py; W.mode = M_IK;
  for (let sd = 0; sd < 2; sd++) legIK(sd, rx, py, rz, FT[sd * 4], FT[sd * 4 + 1], FT[sd * 4 + 2], FT[sd * 4 + 3] + R[0] * 0, 0.06 - R[1] * (sd === 0 ? 1 : -1));
  // braços opostos às pernas
  const A = mv * lerp(lerp(0.32, 0.62, run), 1.0, spr) * (1 - 0.65 * lat) * G.armA;
  const off = -mv * lerp(0.02, 0.18, run) - 0.1 * spr;
  for (let sd = 0; sd < 2; sd++) {
    const u = sd === 0 ? uL : uR, sw = Math.cos(TAU * u);
    const ua = sd === 0 ? 5 : 8;
    set(ua, off + A * sw * (1 - 0.25 * G.drib) + 0.04 * (1 - mv), (0.15 * run) * mv, lerp(0.1, 0.16, run) + 0.03 * sway * (sd === 0 ? 1 : -1) + 0.2 * G.drib * mv);
    set(ua + 1, -lerp(0.22, lerp(1.35, 1.55, spr), run * mv) - mv * run * 0.3 * Math.max(0, -sw), 0, 0);
    set(ua + 2, -lerp(0.1, 0.25, run), 0, 0);
  }
}

// ---------------------------------------------------------------- estados
function hash(n) { const x = Math.sin((n | 0) * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const DV2 = new Float32Array(NB * 3);

function evalState(s, P) {
  R.fill(0); W.rx = 0; W.rz = 0; W.lift = 0; W.mode = M_FEET; W.mirror = false; W.sup = 0;
  const t = s.t || 0, anim = s.anim || 'idle';
  const pw = s.power == null ? 0.7 : clamp(s.power, 0, 1);
  const foot = s.foot === -1 ? -1 : 1;
  gaitReset();
  G.t = t; G.seed = hash(s.variant || 0);
  switch (anim) {
    case 'locomotion': case 'idle':
      G.v = anim === 'idle' ? 0 : s.speed || 0; G.ma = s.moveAngle || 0; G.stride = s.stride || 0;
      G.bank = clamp(s.lean || 0, -0.5, 0.5);
      G.drib = anim === 'idle' ? 0 : clamp(s.drib || 0, 0, 1); G.bx = s.bx || 0; G.bz = s.bz || 0; G.tf = foot;
      // conduzindo: base um pouco mais baixa, braços abertos para equilíbrio
      G.crouch = 0.03 * G.drib;
      gait();
      break;
    case 'jockey': {
      G.v = Math.min(s.speed || 0, 4); G.ma = s.moveAngle || 0; G.stride = s.stride || 0;
      G.crouch = 0.12; G.width = 0.2; G.lean = 0.22; G.yaw = 0.5 * foot; G.Lmul = 0.55; G.heel = 0.08; G.armA = 0.3;
      gait();
      for (let sd = 0; sd < 2; sd++) { const ua = sd ? 8 : 5; add(ua, -0.3, 0, 0.25); R[(ua + 1) * 3] = -0.95; }
      break;
    }
    case 'shield': {
      G.v = Math.min(s.speed || 0, 3); G.ma = s.moveAngle || 0; G.stride = s.stride || 0;
      G.crouch = 0.1; G.width = 0.22; G.lean = 0.05; G.Lmul = 0.6; G.armA = 0.2;
      gait();
      for (let sd = 0; sd < 2; sd++) { const ua = sd ? 8 : 5; set(ua, 0.2, 0, 0.55); set(ua + 1, -0.7, 0, 0); set(ua + 2, 0, 0, 0.3); }
      add(2, -0.1, 0, 0);
      break;
    }
    case 'gk_ready': {
      G.v = Math.min(s.speed || 0, 3.5); G.ma = s.moveAngle || 0; G.stride = s.stride || 0;
      G.crouch = 0.17; G.width = 0.2; G.lean = 0.2; G.heel = 0.15; G.armA = 0.25;
      gait();
      W.lift += 0.012 * Math.abs(Math.sin(t * 5.5)) * (1 - smooth(clamp(G.v, 0, 1)));
      for (let sd = 0; sd < 2; sd++) { const ua = sd ? 8 : 5; set(ua, -0.6, 0.2, 0.42); set(ua + 1, -0.85, 0, 0); set(ua + 2, -0.35, 0, 0); }
      break;
    }
    case 'kick': useClip(KICK, t / ANIM.kick.dur, 0.45 + 0.55 * pw); W.mirror = foot === -1; break;
    case 'pass': useClip(PASS, t / ANIM.pass.dur, 0.6 + 0.4 * pw); W.mirror = foot === -1; break;
    case 'chip': useClip(CHIP, t / ANIM.chip.dur, 0.6 + 0.4 * pw); W.mirror = foot === -1; break;
    case 'volley': useClip(VOLLEY, t / ANIM.volley.dur, 0.7 + 0.3 * pw); W.mirror = foot === -1; break;
    case 'tackle': useClip(TACKLE, t / ANIM.tackle.dur, 1); W.mirror = foot === -1; break;
    case 'slide': useClip(SLIDE, t / ANIM.slide.dur, 1); W.mirror = foot === -1; break;
    case 'header': useClip(HEADER, t / ANIM.header.dur, 1); W.lift *= 0.55 + 0.45 * pw; break;
    case 'throwin': useClip(THROWIN, t / ANIM.throwin.dur, 1); break;
    case 'gk_dive': {
      const h = clamp(s.diveHeight || 0, 0, 1), u = t / ANIM.gk_dive.dur;
      useClip(DIVE_HI, u, 1); DV2.set(R); const lh = W.lift, xh = W.rx;
      useClip(DIVE_LO, u, 1);
      for (let j = 0; j < NB * 3; j++) R[j] = lerp(R[j], DV2[j], h);
      W.lift = lerp(W.lift, lh, h); W.rx = lerp(W.rx, xh, h);
      W.mirror = s.diveSide === -1;
      break;
    }
    case 'gk_catch': useClip(GK_CATCH, t / ANIM.gk_catch.dur, 1); break;
    case 'gk_hold': useClip(GK_HOLD, t / 3, 1); break;
    case 'gk_throw': useClip(GK_THROW, t / ANIM.gk_throw.dur, 1); W.mirror = foot === -1; break;
    case 'gk_kick': useClip(GK_KICK, t / ANIM.gk_kick.dur, 0.6 + 0.4 * pw); W.mirror = foot === -1; break;
    case 'fall': useClip(FALL, t / ANIM.fall.dur, 1); W.mirror = hash(s.variant || 0) > 0.5; break;
    case 'getup': useClip(GETUP, t / ANIM.getup.dur, 1); W.mirror = hash(s.variant || 0) > 0.5; break;
    case 'celebrate': {
      const v = ((s.variant || 0) % 4 + 4) % 4;
      if (v === 0) {        // aviãozinho: corre de braços abertos inclinando como asa
        G.v = Math.max(s.speed || 0, 5.2); G.stride = (s.speed || 0) > 1 ? s.stride || 0 : t * 5.2 / cycleLength(5.2);
        G.bank = 0.28 * Math.sin(t * 1.7); G.armA = 0;
        gait();
        for (let sd = 0; sd < 2; sd++) { const ua = sd ? 8 : 5, sg = sd ? -1 : 1; set(ua, 0.1, 0, 1.45 - 0.2 * sg * G.bank); set(ua + 1, -0.12, 0, 0); set(ua + 2, 0, 0, 0.1); }
        add(3, -0.15, 0, -0.2 * G.bank); add(4, -0.1, 0, 0);
      } else if (v === 1) useClip(KNEESLIDE, t / ANIM.celebrate.dur, 1);
      else if (v === 2) useClip(FISTPUMP, t / 0.95, 1);
      else useClip(POINTSKY, t / ANIM.celebrate.dur, 1);
      W.mirror = hash((s.variant || 0) + 7) > 0.5;
      break;
    }
    case 'dejected':
      useClip(((s.variant || 0) & 1) ? HANDS_HIPS : HANDS_HEAD, t / ANIM.dejected.dur, 1);
      add(2, 0.012 * Math.sin(t * 2.2), 0, 0);
      break;
    default:
      gait();
  }
  W.sup = W.mirror ? 1 : 0;    // pé de apoio (clipes escritos com o apoio na esquerda)
  // --- Euler relativo ao lado -> quatérnios locais
  const q = P.q, mir = W.mirror;
  for (let b = 0; b < NB; b++) {
    const src = mir ? MIRROR[b] : b;
    let x = R[src * 3], y = R[src * 3 + 1], z = R[src * 3 + 2];
    const sd = SIDE[b];
    if (sd === -1 || (sd === 0 && mir)) { y = -y; z = -z; }
    if (b === 3 || b === 4) {   // olhar
      const ly = clamp(s.lookYaw || 0, -1.3, 1.3), lp = clamp(s.lookPitch || 0, -0.7, 0.6);
      y += ly * (b === 3 ? 0.4 : 0.6); x -= lp * (b === 3 ? 0.4 : 0.6);
    }
    qEuler(q, b * 4, x, y, z, b < 5 ? 0 : 1);
  }
  if (mir) W.rx = -W.rx;
  fk(P, W.rx, 0, W.rz);
  ground(P);
}

function fk(P, rx, ry, rz) {
  const q = P.q, mq = P.mq, mp = P.mp;
  mq[0] = q[0]; mq[1] = q[1]; mq[2] = q[2]; mq[3] = q[3];
  mp[0] = rx; mp[1] = ry; mp[2] = rz;
  for (let b = 1; b < NB; b++) {
    const p = PARENT[b];
    qRot(mq, p * 4, OFFSET[b * 3], OFFSET[b * 3 + 1], OFFSET[b * 3 + 2], false);
    mp[b * 3] = mp[p * 3] + V[0]; mp[b * 3 + 1] = mp[p * 3 + 1] + V[1]; mp[b * 3 + 2] = mp[p * 3 + 2] + V[2];
    qMul(mq, p * 4, q, b * 4, mq, b * 4);
  }
  P.root[0] = rx; P.root[1] = ry; P.root[2] = rz;
}
function pointY(P, k) {
  const o = k * 6, b = PT[o];
  qRot(P.mq, b * 4, PT[o + 1], PT[o + 2], PT[o + 3], false);
  return P.mp[b * 3 + 1] + V[1] - PT[o + 4];
}
function footMin(P, side) {
  let m = 1e9;
  for (let k = side * 3; k < side * 3 + 3; k++) m = Math.min(m, pointY(P, k));
  return m;
}
const QX = new Float32Array(4), QT = new Float32Array(4);
// ajusta a altura da raiz ao chão conforme o modo e evita que um pé livre atravesse o gramado
function ground(P) {
  let y;
  const mode = W.mode;
  if (mode === M_IK) y = W.lift;
  else if (mode === M_SUPPORT) y = -footMin(P, W.sup) + W.lift;
  else if (mode === M_FEET) y = -Math.min(footMin(P, 0), footMin(P, 1)) + W.lift;
  else {
    let m = 1e9;
    for (let k = 0; k < NPT; k++) m = Math.min(m, pointY(P, k));
    y = mode === M_BODY ? -m + W.lift : Math.max(W.lift, -m);
  }
  const mp = P.mp;
  for (let b = 0; b < NB; b++) mp[b * 3 + 1] += y;
  P.root[1] = y;
  // pés livres: se a ponta/calcanhar entrar no chão, gira o pé (tornozelo) para cima
  for (let sd = 0; sd < 2; sd++) {
    let m = footMin(P, sd);
    if (m >= 0) continue;
    const fb = sd === 0 ? 13 : 16;
    // qual ponto está mais baixo? ponta -> gira a ponta para cima (δ<0), calcanhar -> δ>0
    const heel = pointY(P, sd * 3), toe = pointY(P, sd * 3 + 2);
    const dir = toe < heel ? -1 : 1;
    let dl = 0;
    for (let it = 0; it < 12 && m < 0; it++) {
      dl += dir * 0.1;
      qEuler(QX, 0, dl, 0, 0, 1);
      qMul(P.q, fb * 4, QX, 0, QT, 0);
      qMul(P.mq, PARENT[fb] * 4, QT, 0, P.mq, fb * 4);
      m = footMin(P, sd);
    }
    P.q.set(QT, fb * 4);
    // se ainda atravessa (tornozelo baixo demais), sobe o corpo o necessário
    if (m < 0 && mode !== M_SUPPORT) { for (let b = 0; b < NB; b++) mp[b * 3 + 1] -= m; P.root[1] -= m; }
  }
}

// ---------------------------------------------------------------- API
const TMP = createPose();
export function computePose(s, out) {
  evalState(s, out);
  const bf = s.blendFrom, w = s.blendW == null ? 1 : clamp(s.blendW, 0, 1);
  if (bf && w < 1) {
    evalState(bf, TMP);
    for (let b = 0; b < NB; b++) qSlerp(TMP.q, out.q, b * 4, w, out.q);
    const x = lerp(TMP.root[0], out.root[0], w), y = lerp(TMP.root[1], out.root[1], w), z = lerp(TMP.root[2], out.root[2], w);
    fk(out, x, y, z);
    // nenhum pé abaixo do gramado depois da mistura
    const m = Math.min(footMin(out, 0), footMin(out, 1));
    if (m < 0) { for (let b = 0; b < NB; b++) out.mp[b * 3 + 1] -= m; out.root[1] -= m; }
  }
  return out;
}

// deslocamento da pelve em relação à posição do jogador (metros canônicos, 1,80 m)
const RO = createPose();
export function rootOffset(s, out = { right: 0, forward: 0, up: 0 }) {
  computePose(s, RO);
  out.right = -RO.root[0]; out.forward = RO.root[2]; out.up = RO.root[1] - OFFSET[1];
  return out;
}

// alcance da mão mais distante no contato do mergulho: { lateral, up } (1,80 m)
const GKS = { anim: 'gk_dive', t: 0, diveSide: 1, diveHeight: 0, blendFrom: null, blendW: 1 };
export function gkReach(diveHeight, out = { lateral: 0, up: 0 }) {
  GKS.t = ANIM.gk_dive.contact * ANIM.gk_dive.dur; GKS.diveHeight = clamp(diveHeight, 0, 1);
  computePose(GKS, RO);
  let best = -1e9, up = 0;
  for (const hb of [7, 10]) {
    qRot(RO.mq, hb * 4, 0, -0.09, 0, false);
    const x = -(RO.mp[hb * 3] + V[0]);
    if (x > best) { best = x; up = RO.mp[hb * 3 + 1] + V[1]; }
  }
  out.lateral = best; out.up = up;
  return out;
}

// ponto de um osso (deslocamento local) no espaço do modelo — usado por players3d
export function bonePoint(P, b, x, y, z, out) {
  qRot(P.mq, b * 4, x, y, z, false);
  out[0] = P.mp[b * 3] + V[0]; out[1] = P.mp[b * 3 + 1] + V[1]; out[2] = P.mp[b * 3 + 2] + V[2];
  return out;
}
