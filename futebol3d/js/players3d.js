// Jogadores 3D do GOLAÇO: corpo humano procedural, instanciado por parte do corpo.
//
// Cada parte (cabeça, pescoço, peito, abdome, pelve/calção, braço, antebraço, mão, coxa,
// canela/meião, chuteira) é UM InstancedMesh compartilhado pelos 22 jogadores; a matriz
// de cada instância é a matriz do osso no mundo (FK de anim.js). Cores do uniforme, pele,
// cabelo, padrão da camisa e números saem de uma textura de dados (uma linha por jogador)
// lida no shader (onBeforeCompile do MeshStandardMaterial); cada instância leva o índice
// do jogador no atributo aPid. Instâncias de membros: i = esquerda, count + i = direita.
// Cabelos (um InstancedMesh por estilo) e barba só desenham os jogadores que os usam
// (instâncias compactadas; mesh.count = quantos usam). Nível de detalhe pela qualidade:
// quality.grassDetail 0 (baixa) / 1 (média) / 2 (alta, ultra) muda a densidade das malhas.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { computePose, createPose, bonePoint } from './anim.js';
import { PLAYER } from './config.js';

// ---------------------------------------------------------------- materiais (ids por vértice)
const M = { SKIN: 0, SHIRT: 1, SLEEVE: 2, SHORTS: 3, SOCK: 4, TRIM: 5, BOOT: 6, HAIR: 7, EYEW: 8, IRIS: 9, LIPS: 10, BROW: 11, HAND: 12, FOREARM: 13, SOLE: 14, ACCENT: 15 };
const HAIR = { bald: 0, short: 1, buzz: 2, curly: 3, long: 4, afro: 5, bun: 6 };
const KW = 12;   // texels por jogador na textura de dados
// densidade das malhas por nível (0 baixa, 1 média, 2 alta/ultra)
// F = segmentos das feições do rosto [largura, altura] (null = omitida)
const LODS = [
  { torso: 9, limb: 6, hand: 5, neck: 6, head: [12, 8], hair: [12, 8], feat: 0,
    F: { eye: [5, 3], iris: null, brow: [4, 3], ear: [5, 3], nose: [5, 3], tip: null, lip: [5, 3], lip2: false, thumb: [5, 3], bun: [6, 4] } },
  { torso: 14, limb: 8, hand: 7, neck: 9, head: [16, 11], hair: [16, 11], feat: 1,
    F: { eye: [6, 4], iris: [4, 3], brow: [5, 3], ear: [6, 4], nose: [6, 4], tip: [5, 3], lip: [6, 3], lip2: true, thumb: [6, 4], bun: [7, 5] } },
  { torso: 18, limb: 10, hand: 9, neck: 11, head: [24, 18], hair: [24, 16], feat: 2,
    F: { eye: [7, 5], iris: [5, 3], brow: [7, 4], ear: [6, 5], nose: [6, 5], tip: [6, 4], lip: [8, 3], lip2: true, thumb: [8, 5], bun: [9, 6] } },
];

// ---------------------------------------------------------------- geometria
// loft: anéis de superelipse ao longo de Y. anel = [y, meiaLargura(x), frente(+z), trás(-z), mat, n, x0, z0]
function loft(rings, seg = 18) {
  const R = [], dup = [];
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    if (i > 0 && (rings[i - 1][4] ?? 0) !== (r[4] ?? 0)) { const d = r.slice(); d[4] = rings[i - 1][4] ?? 0; dup[R.length] = 1; R.push(d); }
    R.push(r);
  }
  const pos = [], mat = [], idx = [];
  for (const r of R) {
    const [y, w, f, b, m = 0, n = 2, x0 = 0, z0 = 0] = r;
    const e = 2 / n;
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(x0 + w * Math.sign(c) * Math.abs(c) ** e, y, z0 + (s > 0 ? f : b) * Math.sign(s) * Math.abs(s) ** e);
      mat.push(m);
    }
  }
  const nr = R.length;
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) {
    if (dup[i]) break;             // faixa de área zero na troca de material
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
    idx.push(a, b, c, b, d, c);
  }
  // tampas
  const top = pos.length / 3; pos.push(R[0][6] || 0, R[0][0], R[0][7] || 0); mat.push(R[0][4] ?? 0);
  const bot = pos.length / 3; const L = R[nr - 1]; pos.push(L[6] || 0, L[0], L[7] || 0); mat.push(L[4] ?? 0);
  for (let j = 0; j < seg; j++) {
    idx.push(top, (j + 1) % seg, j);
    idx.push(bot, (nr - 1) * seg + j, (nr - 1) * seg + (j + 1) % seg);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aMat', new THREE.Float32BufferAttribute(mat, 1));
  g.setIndex(idx);
  orient(g, R[0][0] > L[0] ? 1 : -1);
  g.computeVertexNormals();
  smoothSeams(g, R, seg);
  return g;
}
// garante faces para fora (o loft pode ser escrito de cima p/ baixo ou ao contrário)
function orient(g, dir) {
  if (dir < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
}
// normais iguais nos anéis duplicados (troca de material) para não marcar quina
function smoothSeams(g, R, seg) {
  const n = g.attributes.normal.array;
  for (let i = 1; i < R.length; i++) {
    if (R[i][0] !== R[i - 1][0] || R[i][1] !== R[i - 1][1]) continue;
    for (let j = 0; j < seg; j++) {
      const a = ((i - 1) * seg + j) * 3, b = (i * seg + j) * 3;
      const x = n[a] + n[b], y = n[a + 1] + n[b + 1], z = n[a + 2] + n[b + 2], l = Math.hypot(x, y, z) || 1;
      n[a] = n[b] = x / l; n[a + 1] = n[b + 1] = y / l; n[a + 2] = n[b + 2] = z / l;
    }
  }
}
function blob(x, y, z, rx, ry, rz, m, rotX = 0, rotZ = 0, ws = 12, hs = 8) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.deleteAttribute('uv');
  g.scale(rx, ry, rz);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return withMat(g, m);
}
function withMat(g, m) {
  const n = g.attributes.position.count;
  if (!g.attributes.aMat) g.setAttribute('aMat', new THREE.Float32BufferAttribute(new Float32Array(n).fill(m), 1));
  return g;
}
function finish(parts, rest) {
  const g = mergeGeometries(parts.map((p) => (p.index ? p : mergeVertices(p))));
  const p = g.attributes.position.array, n = p.length / 3, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = p[i * 3] + rest[0]; a[i * 3 + 1] = p[i * 3 + 1] + rest[1]; a[i * 3 + 2] = p[i * 3 + 2] + rest[2]; }
  g.setAttribute('aRest', new THREE.BufferAttribute(a, 3));
  return g;
}

// ---------- cabeça (esfera deformada) — o mesmo formato serve de base para cabelo e barba
const HC = [0, 0.094, 0.014];
const sst = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
function headPt(x, y, z, o) {
  let px = x * 0.077, py = y * (y > 0 ? 0.107 : 0.118), pz = z * (z > 0 ? 0.093 : 0.1);
  const lo = Math.max(0, -y);
  px *= 1 - 0.32 * lo ** 1.4 * (z > -0.3 ? 1 : 0.7);
  if (z < 0) pz *= 1 - 0.42 * lo * lo;
  else pz *= 1 - 0.12 * sst(0.5, 1, z) * (1 - Math.abs(y));
  pz += 0.016 * Math.max(0, z) * sst(0.55, 0.95, lo);            // queixo
  px *= 1 + 0.05 * sst(0.3, 0.8, Math.abs(x)) * sst(0.1, 0.6, z) * (1 - Math.abs(y + 0.05) * 2);  // maçãs
  pz += 0.006 * sst(0.8, 0.97, z) * Math.max(0, 1 - Math.abs(y - 0.3) * 6);                      // arco das sobrancelhas
  o[0] = HC[0] + px; o[1] = HC[1] + py; o[2] = HC[2] + pz;
  return o;
}
function sphereDirs(ws, hs) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  return mergeVertices(g);
}
// esfera deformada por fn(x,y,z,o); com cull, descarta triângulos cuja máscara (o[3]) é zero
function deformed(ws, hs, fn, m, cull = false) {
  const g = sphereDirs(ws, hs), p = g.attributes.position.array, o = [0, 0, 0, 1];
  const mk = new Float32Array(p.length / 3);
  for (let i = 0; i < p.length; i += 3) {
    const l = Math.hypot(p[i], p[i + 1], p[i + 2]);
    o[3] = 1; fn(p[i] / l, p[i + 1] / l, p[i + 2] / l, o);
    p[i] = o[0]; p[i + 1] = o[1]; p[i + 2] = o[2]; mk[i / 3] = o[3];
  }
  if (cull) {
    const ix = g.index.array, keep = [];
    for (let i = 0; i < ix.length; i += 3) if (Math.max(mk[ix[i]], mk[ix[i + 1]], mk[ix[i + 2]]) > 0.02) keep.push(ix[i], ix[i + 1], ix[i + 2]);
    g.setIndex(keep);
  }
  g.computeVertexNormals();
  return withMat(g, m);
}
function surf(x, y, z, out = 0, o = [0, 0, 0]) {
  const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
  headPt(x, y, z, o);
  const nx = o[0] - HC[0], ny = o[1] - HC[1], nz = o[2] - HC[2], nl = Math.hypot(nx, ny, nz);
  o[0] += nx / nl * out; o[1] += ny / nl * out; o[2] += nz / nl * out;
  return o;
}
function hairFn(style) {
  const t = [0, 0.011, 0.0035, 0.017, 0.014, 0.04, 0.011][style];
  return (x, y, z, o) => {
    headPt(x, y, z, o);
    let hl = z > 0 ? 0.13 + 0.3 * z * z : 0.13 - 0.63 * (-z) ** 1.3;
    if (style === 5) hl = z > 0 ? 0.12 + 0.28 * z * z : 0.1 - 0.55 * (-z) ** 1.3;
    if (style === 4) hl = z > 0 ? 0.13 + 0.3 * z * z : 0.13 - 1.1 * (-z) ** 0.8;       // longo: cobre a nuca
    if (style === 4 && z < 0.35 && z > -0.2) hl = Math.min(hl, -0.15);                 // e as orelhas
    const m = style === 5 ? sst(hl - 0.03, hl + 0.22, y) : sst(hl - 0.03, hl + 0.07, y);
    let th = t;
    if (style === 3) th += 0.009 * (Math.sin(x * 29) * Math.sin(y * 23 + 1) * Math.sin(z * 27 + 2) + 0.4);
    if (style === 5) th = 0.03 + 0.022 * Math.max(0, y) + 0.004 * Math.sin(x * 31) * Math.sin(y * 29) * Math.sin(z * 27);   // black power
    const nx = o[0] - HC[0], ny = o[1] - HC[1], nz = o[2] - HC[2], nl = Math.hypot(nx, ny, nz);
    const d = m * th - (1 - m) * 0.007;
    o[0] += nx / nl * d; o[1] += ny / nl * d; o[2] += nz / nl * d; o[3] = m;
    if (style === 4 && z < 0.4) {       // cabelo caindo até o pescoço
      const k = m * sst(0.35, -0.7, y) * sst(0.4, -0.2, z);
      o[1] -= 0.075 * k; o[2] -= 0.02 * k; o[0] *= 1 + 0.12 * k;
    }
  };
}
function beardFn(x, y, z, o) {
  headPt(x, y, z, o);
  const lim = -0.4 + 0.3 * sst(0.2, 0.6, Math.abs(x));        // linha da barba: baixa na frente, sobe nas bochechas
  const jaw = sst(-0.3, 0.05, z) * sst(lim + 0.03, lim - 0.05, y);
  const stache = sst(0.2, 0.12, Math.abs(x)) * sst(-0.16, -0.2, y) * sst(-0.3, -0.25, y) * sst(0.85, 0.95, z);
  const m = Math.min(1, jaw + stache);
  const nx = o[0] - HC[0], ny = o[1] - HC[1], nz = o[2] - HC[2], nl = Math.hypot(nx, ny, nz);
  const d = m * 0.005 - (1 - m) * 0.006;
  o[0] += nx / nl * d; o[1] += ny / nl * d; o[2] += nz / nl * d; o[3] = m;
}
function buildHead(L) {
  const parts = [deformed(L.head[0], L.head[1], headPt, M.SKIN)];
  const o = [0, 0, 0], F = L.F;
  for (const s of [1, -1]) {
    let p = surf(s * 0.34, 0.2, 0.92, F.iris ? -0.0068 : -0.004);
    parts.push(blob(p[0], p[1], p[2], 0.0115, 0.0062, 0.0085, F.iris ? M.EYEW : M.IRIS, 0, 0, ...F.eye));
    if (F.iris) { p = surf(s * 0.335, 0.2, 0.93, 0.0006); parts.push(blob(p[0], p[1], p[2], 0.0047, 0.0049, 0.003, M.IRIS, 0, 0, ...F.iris)); }
    p = surf(s * 0.35, 0.37, 0.88, 0.0015);
    parts.push(blob(p[0], p[1], p[2], 0.019, 0.0042, 0.0055, M.BROW, 0, -s * 0.18, ...F.brow));
    p = surf(s * 1, 0.06, -0.1, -0.004);
    parts.push(blob(p[0], p[1], p[2], 0.0085, 0.029, 0.018, M.SKIN, 0.15, s * 0.1, ...F.ear));
  }
  let p = surf(0, 0.1, 1, 0.006, o);
  parts.push(blob(p[0], p[1], p[2], 0.0105, 0.026, 0.013, M.SKIN, -0.32, 0, ...F.nose));
  if (F.tip) { p = surf(0, -0.03, 1, 0.014, o); parts.push(blob(p[0], p[1], p[2], 0.0115, 0.0095, 0.0095, M.SKIN, 0, 0, ...F.tip)); }
  p = surf(0, -0.3, 0.96, 0.0015, o);
  parts.push(blob(p[0], p[1] + (F.lip2 ? 0.0035 : 0), p[2], 0.02, F.lip2 ? 0.0048 : 0.007, 0.007, M.LIPS, 0, 0, ...F.lip));
  if (F.lip2) parts.push(blob(p[0], p[1] - 0.0055, p[2] - 0.001, 0.018, 0.0055, 0.0068, M.LIPS, 0, 0, ...F.lip));
  return finish(parts, [0, 1.6, 0]);
}
// cabelo por estilo (1..6) e barba (7): só a casca da região com cabelo
function buildHair(st, L) {
  if (st === 7) return finish([deformed(Math.round(L.hair[0] * 1.25), Math.round(L.hair[1] * 1.25), beardFn, M.HAIR, true)], [0, 1.6, 0]);
  const parts = [deformed(L.hair[0], L.hair[1], hairFn(st), M.HAIR, true)];
  if (st === 6) parts.push(blob(0, HC[1] + 0.085, HC[2] - 0.075, 0.038, 0.034, 0.036, M.HAIR, 0, 0, ...L.F.bun));
  return finish(parts, [0, 1.6, 0]);
}

// ---------- corpo
const N = 2.4;
function buildParts(L) {
  const S = M.SKIN, TS = L.torso, LS = L.limb;
  const G = {};
  G.head = buildHead(L);
  for (let st = 1; st <= 7; st++) G['hair' + st] = buildHair(st, L);
  G.neck = finish([loft([
    [0.13, 0.045, 0.042, 0.048, S], [0.09, 0.058, 0.052, 0.06, S], [0.04, 0.063, 0.054, 0.065, S],
    [0, 0.066, 0.055, 0.067, S], [-0.035, 0.095, 0.062, 0.08, S], [-0.07, 0.08, 0.05, 0.065, S],
  ], L.neck)], [0, 1.51, -0.012]);
  const T = M.SHIRT;
  G.chest = finish([loft([
    [0.29, 0.066, 0.058, 0.066, M.TRIM, 2, 0, -0.012], [0.292, 0.077, 0.068, 0.078, M.TRIM, 2, 0, -0.012], [0.276, 0.081, 0.071, 0.08, M.TRIM, 2, 0, -0.01],
    [0.27, 0.085, 0.072, 0.08, T, 2, 0, -0.008], [0.258, 0.135, 0.074, 0.086, T, N, 0, -0.004],
    [0.24, 0.18, 0.088, 0.095, T, N], [0.21, 0.2, 0.108, 0.1, T, N], [0.15, 0.192, 0.122, 0.102, T, N],
    [0.09, 0.178, 0.12, 0.102, T, N], [0.03, 0.168, 0.113, 0.102, T, N], [0, 0.164, 0.11, 0.1, T, N],
    [-0.05, 0.15, 0.1, 0.09, T, N], [-0.09, 0.13, 0.085, 0.078, T, N],
  ], TS)], [0, 1.24, 0]);
  G.spine = finish([loft([
    [0.26, 0.12, 0.08, 0.075, T, N], [0.23, 0.155, 0.104, 0.096, T, N], [0.2, 0.16, 0.107, 0.098, T, N], [0.15, 0.158, 0.105, 0.097, T, N],
    [0.1, 0.156, 0.104, 0.096, T, N], [0.03, 0.156, 0.103, 0.096, T, N],
    [-0.05, 0.16, 0.105, 0.1, T, N], [-0.09, 0.167, 0.11, 0.106, T, N],
    [-0.1, 0.168, 0.111, 0.107, M.TRIM, N], [-0.11, 0.167, 0.11, 0.106, M.TRIM, N], [-0.11, 0.14, 0.088, 0.088, M.TRIM, N],
  ], TS)], [0, 1.04, 0]);
  G.pelvis = finish([loft([
    [0.12, 0.13, 0.082, 0.08, M.SHORTS, N], [0.06, 0.143, 0.088, 0.088, M.SHORTS, N], [-0.02, 0.155, 0.094, 0.096, M.SHORTS, N],
    [-0.075, 0.158, 0.092, 0.1, M.SHORTS, N], [-0.11, 0.115, 0.072, 0.075, M.SHORTS, N], [-0.13, 0.04, 0.03, 0.03, M.SHORTS, N],
  ], TS)], [0, 0.96, 0]);
  G.upperArm = finish([loft([
    [0.055, 0.016, 0.016, 0.016, M.SLEEVE], [0.04, 0.04, 0.042, 0.042, M.SLEEVE], [0.012, 0.054, 0.054, 0.054, M.SLEEVE],
    [-0.04, 0.056, 0.055, 0.053, M.SLEEVE], [-0.1, 0.054, 0.054, 0.051, M.SLEEVE], [-0.13, 0.054, 0.054, 0.051, M.SLEEVE],
    [-0.13, 0.055, 0.055, 0.052, M.TRIM], [-0.145, 0.055, 0.055, 0.052, M.TRIM],
    [-0.145, 0.048, 0.052, 0.045, S], [-0.19, 0.047, 0.053, 0.044, S], [-0.25, 0.042, 0.045, 0.04, S],
    [-0.3, 0.039, 0.037, 0.041, S], [-0.325, 0.024, 0.022, 0.026, S],
  ], LS)], [0, 0, 0]);
  const F = M.FOREARM;
  G.foreArm = finish([loft([
    [0.03, 0.022, 0.022, 0.024, F], [0.005, 0.039, 0.039, 0.043, F], [-0.05, 0.043, 0.048, 0.044, F],
    [-0.12, 0.036, 0.038, 0.035, F], [-0.2, 0.028, 0.03, 0.027, F], [-0.25, 0.022, 0.028, 0.025, F], [-0.27, 0.015, 0.019, 0.017, F],
  ], LS)], [0, 0, 0]);
  const H = M.HAND;
  G.hand = finish([
    loft([[0.012, 0.018, 0.022, 0.022, H], [-0.015, 0.021, 0.033, 0.028, H], [-0.055, 0.023, 0.041, 0.03, H],
      [-0.085, 0.025, 0.04, 0.029, H], [-0.105, 0.022, 0.035, 0.026, H], [-0.12, 0.012, 0.02, 0.014, H]], L.hand),
    blob(0, -0.045, 0.036, 0.012, 0.027, 0.012, H, 0.35, 0, ...L.F.thumb),
  ], [0, 0, 0]);
  const SH = M.SHORTS;
  G.thigh = finish([loft([
    [0.06, 0.03, 0.03, 0.03, SH], [0.03, 0.068, 0.07, 0.07, SH], [-0.02, 0.09, 0.092, 0.092, SH],
    [-0.12, 0.098, 0.1, 0.1, SH], [-0.2, 0.097, 0.1, 0.1, SH], [-0.2, 0.085, 0.09, 0.083, S],
    [-0.26, 0.08, 0.087, 0.076, S], [-0.33, 0.068, 0.075, 0.064, S], [-0.4, 0.056, 0.062, 0.052, S],
    [-0.45, 0.049, 0.054, 0.048, S], [-0.48, 0.03, 0.035, 0.03, S],
  ], LS + 2)], [0, 0, 0]);
  const K = M.SOCK;
  G.shin = finish([loft([
    [0.045, 0.028, 0.03, 0.03, S], [0.02, 0.047, 0.056, 0.048, S], [-0.025, 0.046, 0.052, 0.05, S],
    [-0.065, 0.045, 0.048, 0.054, S], [-0.065, 0.05, 0.053, 0.06, M.TRIM], [-0.1, 0.05, 0.054, 0.063, M.TRIM],
    [-0.1, 0.049, 0.053, 0.062, K], [-0.14, 0.05, 0.059, 0.066, K], [-0.22, 0.046, 0.059, 0.056, K],
    [-0.3, 0.038, 0.053, 0.042, K], [-0.35, 0.033, 0.042, 0.034, K], [-0.4, 0.031, 0.035, 0.034, K],
    [-0.45, 0.022, 0.024, 0.024, K],
  ], LS)], [0, 0, 0]);
  // chuteira: loft ao longo de +Z (depois girado); frente(+z do loft) vira "para baixo"
  const B = M.BOOT, AC = L.feat ? M.ACCENT : B;
  const boot = loft([
    [0.205, 0.016, 0.018, 0.016, B, 2.4, 0, 0.046], [0.19, 0.034, 0.022, 0.024, B, 2.4, 0, 0.044],
    [0.14, 0.047, 0.024, 0.033, B, 2.4, 0, 0.042], [0.075, 0.045, 0.026, 0.045, B, 2.4, 0, 0.038],
    [0.045, 0.043, 0.028, 0.055, AC, 2.4, 0, 0.036], [0.025, 0.042, 0.029, 0.06, AC, 2.4, 0, 0.035],
    [0.0, 0.04, 0.031, 0.066, B, 2.4, 0, 0.034], [-0.04, 0.037, 0.032, 0.058, B, 2.4, 0, 0.034],
    [-0.065, 0.03, 0.03, 0.04, B, 2.4, 0, 0.036], [-0.075, 0.014, 0.018, 0.02, B, 2.4, 0, 0.04],
  ], LS + 2);
  boot.rotateX(Math.PI / 2);
  const sole = loft([
    [0.2, 0.018, 0.005, 0.005, M.SOLE, 4, 0, 0.061], [0.14, 0.05, 0.006, 0.006, M.SOLE, 4, 0, 0.062],
    [0.06, 0.044, 0.006, 0.006, M.SOLE, 4, 0, 0.062], [-0.03, 0.039, 0.006, 0.006, M.SOLE, 4, 0, 0.062],
    [-0.07, 0.03, 0.006, 0.006, M.SOLE, 4, 0, 0.062],
  ], Math.max(LS, 8));
  sole.rotateX(Math.PI / 2);
  G.foot = finish(L.feat ? [boot, sole] : [boot], [0, 0, 0]);
  return G;
}

// ---------------------------------------------------------------- shader do corpo
const VERT_DECL = /* glsl */`
attribute float aMat; attribute vec3 aRest; attribute float aPid;
varying float vMat; varying vec3 vRest; flat varying float vPid;
`;
const FRAG_DECL = /* glsl */`
uniform highp sampler2D uKit; uniform sampler2D uDigits;
varying float vMat; varying vec3 vRest; flat varying float vPid;
vec4 K(int i) { return texelFetch(uKit, ivec2(i, int(vPid + 0.5)), 0); }
float aa(float d) { float w = max(fwidth(d), 1e-4); return smoothstep(-w, w, d); }
`;
const FRAG_COLOR = /* glsl */`
float matRough = 0.82;
{
  vec3 r = vRest;
  // números (amostrados fora dos desvios para as derivadas valerem)
  float num = floor(K(3).a + 0.5);
  bool back = r.z < 0.0;
  float h = back ? 0.2 : 0.085, cy = back ? 1.33 : 1.395, cx = back ? 0.0 : -0.075;
  float nd = num >= 9.5 ? 2.0 : 1.0;
  float gw = h * 0.6, Wd = gw * nd;
  float uu = (back ? (cx - r.x) : (r.x - cx)) / Wd + 0.5, vv = (r.y - cy) / h + 0.5;
  float dig = nd > 1.5 ? (uu < 0.5 ? floor(num / 10.0) : mod(num, 10.0)) : num;
  vec2 gu = vec2((dig + clamp(fract(uu * nd), 0.0, 1.0)) / 10.0, clamp(vv, 0.0, 1.0));
  vec2 gc = vec2(uu * nd / 10.0, vv);
  vec4 dg = textureGrad(uDigits, gu, dFdx(gc), dFdy(gc));
  float inBox = step(0.0, uu) * step(uu, 1.0) * step(0.0, vv) * step(vv, 1.0) * step(0.035, abs(r.z)) * step(0.5, num);
  int m = int(vMat + 0.5);
  vec3 c = vec3(1.0);
  if (m == 0) { c = K(0).rgb; matRough = 0.5; }
  else if (m == 1) {
    int pat = int(K(0).a + 0.5);
    vec3 c1 = K(1).rgb, c2 = K(5).rgb;
    float s = 0.0;
    if (pat == 1) s = aa(abs(fract(r.x / 0.1 + 0.5) - 0.5) - 0.25);
    else if (pat == 2) s = aa(abs(fract((r.y - 1.0) / 0.14) - 0.5) - 0.25);
    else if (pat == 3) s = aa(r.x);
    else if (pat == 4) s = aa(0.055 - abs(r.x * 0.85 * sign(r.z + 1e-4) + (r.y - 1.24)));
    else if (pat == 5) s = aa(0.0045 - abs(fract(r.x / 0.04 + 0.5) - 0.5) * 0.04);
    c = mix(c1, c2, s);
    c = mix(c, K(6).rgb, dg.g * inBox);
    c = mix(c, K(7).rgb, dg.r * inBox);
  }
  else if (m == 2) c = K(2).rgb;
  else if (m == 3) c = K(3).rgb;
  else if (m == 4) c = K(4).rgb;
  else if (m == 5) c = K(6).rgb;
  else if (m == 6) { c = K(9).rgb; matRough = 0.32; }
  else if (m == 7) { c = K(8).rgb; matRough = 0.7; }
  else if (m == 8) { c = vec3(0.78, 0.76, 0.72); matRough = 0.2; }
  else if (m == 9) { c = vec3(0.025, 0.018, 0.014); matRough = 0.15; }
  else if (m == 10) { c = K(0).rgb * vec3(0.74, 0.5, 0.48); matRough = 0.4; }
  else if (m == 11) { c = K(8).rgb * 0.75; matRough = 0.8; }
  else if (m == 12) { bool gk = K(1).a > 0.5; c = gk ? K(10).rgb : K(0).rgb; matRough = gk ? 0.65 : 0.5; }
  else if (m == 13) { bool gk = K(1).a > 0.5; c = gk ? K(2).rgb : K(0).rgb; matRough = gk ? 0.82 : 0.5; }
  else if (m == 14) { c = K(11).rgb * 0.6 + 0.02; matRough = 0.45; }
  else if (m == 15) { c = K(11).rgb; matRough = 0.3; }
  diffuseColor.rgb = c;
}
`;

function bodyMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPid = aPid; vMat = aMat; vRest = aRest;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = matRough;')
      // leve brilho de borda na pele (sheen barato)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (int(vMat + 0.5) == 0 || int(vMat + 0.5) == 12) totalEmissiveRadiance += diffuseColor.rgb * 0.06 * pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);');
  };
  mat.customProgramCacheKey = () => 'golaco-body-v2';
  return mat;
}

// atlas de algarismos: R = preenchimento, G = contorno
function digitAtlas() {
  const cw = 96, ch = 128;
  const c = document.createElement('canvas'); c.width = cw * 10; c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.font = `900 ${ch * 0.9}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  for (let d = 0; d < 10; d++) {
    const x = d * cw + cw / 2, y = ch * 0.54;
    g.save(); g.translate(x, y); g.scale(0.78, 1);
    g.strokeStyle = '#00ff00'; g.lineWidth = 17; g.strokeText(String(d), 0, 0);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = '#ff0000'; g.fillText(String(d), 0, 0);
    g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#ffff00'; g.lineWidth = 5; g.strokeText(String(d), 0, 0); g.fillStyle = '#ffff00'; g.fillText(String(d), 0, 0);
    g.restore(); g.globalCompositeOperation = 'source-over';
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- sombras, anel e seta
const FX_VERT = /* glsl */`
attribute vec4 aFx; varying vec2 vUv; varying vec4 vFx;
void main() { vUv = uv; vFx = aFx; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const BLOB_FRAG = /* glsl */`
varying vec2 vUv; varying vec4 vFx;
void main() { vec2 p = (vUv - 0.5) * 2.0; float r = dot(p, p);
  float a = exp(-r * 3.2) * (1.0 - smoothstep(0.7, 1.0, r)); gl_FragColor = vec4(0.0, 0.0, 0.0, a * vFx.a); }`;
const STREAK_FRAG = /* glsl */`
varying vec2 vUv; varying vec4 vFx;
void main() { float x = vUv.x, y = abs(vUv.y - 0.5) * 2.0;
  float a = smoothstep(0.0, 0.12, x) * pow(1.0 - x, 1.6) * (1.0 - y * y); gl_FragColor = vec4(0.0, 0.0, 0.0, a * vFx.a); }`;
const RING_FRAG = /* glsl */`
varying vec2 vUv; varying vec4 vFx;
void main() { float r = length(vUv - 0.5) * 2.0;
  float ring = smoothstep(0.66, 0.76, r) * (1.0 - smoothstep(0.86, 0.97, r));
  float glow = (1.0 - smoothstep(0.3, 1.0, r)) * 0.18;
  gl_FragColor = vec4(vFx.rgb * (1.0 + ring * 0.6), (ring * 0.9 + glow) * vFx.a); }`;
const ARROW_VERT = /* glsl */`
attribute vec4 aFx; varying vec2 vUv; varying vec4 vFx;
void main() { vUv = uv; vFx = aFx;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  mv.xy += position.xy * s; gl_Position = projectionMatrix * mv; }`;
const ARROW_FRAG = /* glsl */`
varying vec2 vUv; varying vec4 vFx;
void main() { gl_FragColor = vec4(vFx.rgb * (0.75 + 0.5 * vUv.y), vFx.a); }`;

function fxMesh(geo, vert, frag, n, blending = THREE.NormalBlending, extra = {}) {
  const g = geo.clone();
  const fx = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  g.setAttribute('aFx', fx);
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending, ...extra });
  const m = new THREE.InstancedMesh(g, mat, n);
  m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.instanceMatrix.array.fill(0);
  return m;
}

// ---------------------------------------------------------------- classe principal
const BOOTS = ['#141414', '#f2f2f2', '#ff5a1f', '#1f7bff', '#d71f2a', '#e8c02a', '#7cf03a', '#ff3aa0'];
const ACC = ['#f2f2f2', '#141414', '#141414', '#f2f2f2', '#f2f2f2', '#141414', '#141414', '#141414'];
const LIMB = [[5, 8, 'upperArm'], [6, 9, 'foreArm'], [7, 10, 'hand'], [11, 14, 'thigh'], [12, 15, 'shin'], [13, 16, 'foot']];
const SINGLE = [[4, 'head'], [3, 'neck'], [2, 'chest'], [1, 'spine'], [0, 'pelvis']];
const GEO = [];   // geometrias por nível de detalhe (compartilhadas entre instâncias da classe)
const pidAttr = (n, per) => { const a = new Float32Array(n * per); for (let k = 0; k < a.length; k++) a[k] = k % n; return new THREE.InstancedBufferAttribute(a, 1); };

export class PlayerMeshes {
  constructor(scene, { count = 22, quality = null, night = false } = {}) {
    this.scene = scene; this.count = count; this.night = night;
    const lod = quality ? Math.max(0, Math.min(2, quality.grassDetail ?? 2)) : 2;
    this.lod = lod;
    if (!GEO[lod]) GEO[lod] = buildParts(LODS[lod]);
    const geos = GEO[lod];
    this.kitData = new Float32Array(KW * count * 4);
    this.kitTex = new THREE.DataTexture(this.kitData, KW, count, THREE.RGBAFormat, THREE.FloatType);
    this.kitTex.minFilter = this.kitTex.magFilter = THREE.NearestFilter;
    this.kitTex.needsUpdate = true;
    this.digits = digitAtlas();
    const uni = { uKit: { value: this.kitTex }, uDigits: { value: this.digits } };
    this.material = bodyMaterial(uni);
    const shadows = quality ? quality.shadows !== false : true;
    this.group = new THREE.Group(); this.group.name = 'jogadores';
    this.parts = [];   // { mesh, bones: [b] ou [bL, bR], kind }
    const mk = (name, per) => {
      // geometria própria (clone raso) para o atributo aPid por instância
      const g = new THREE.BufferGeometry();
      for (const k in geos[name].attributes) g.setAttribute(k, geos[name].attributes[k]);
      g.setIndex(geos[name].index);
      g.setAttribute('aPid', pidAttr(count, per));
      const m = new THREE.InstancedMesh(g, this.material, count * per);
      m.castShadow = shadows; m.receiveShadow = true; m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceMatrix.array.fill(0);
      m.name = 'jog-' + name;
      this.group.add(m);
      return m;
    };
    for (const [b, name] of SINGLE) this.parts.push({ mesh: mk(name, 1), bones: [b], kind: name });
    for (const [bl, br, name] of LIMB) this.parts.push({ mesh: mk(name, 2), bones: [bl, br], kind: name });
    // cabelos por estilo (1..6) e barba (7): instâncias compactadas, só quem usa é desenhado
    this.hair = [null];
    for (let st = 1; st <= 7; st++) { const m = mk('hair' + st, 1); m.count = 0; this.hair.push(m); }
    this.style = new Uint8Array(count); this.beard = new Uint8Array(count);
    this.slot = new Int16Array(count * 2).fill(-1);   // [cabelo, barba] por jogador
    // chão: sombra de contato, sombras dos refletores, anel e seta
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.blob = fxMesh(plane, FX_VERT, BLOB_FRAG, count); this.blob.renderOrder = 1;
    this.streaks = fxMesh(plane, FX_VERT, STREAK_FRAG, count * 4); this.streaks.renderOrder = 1;
    this.streaks.visible = !!night;
    this.ring = fxMesh(plane, FX_VERT, RING_FRAG, count); this.ring.renderOrder = 2;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0.5, 0, 0, -0.5, 0, 0.5, 0.5, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0.5, 0, 1, 1], 2));
    this.arrow = fxMesh(tri, ARROW_VERT, ARROW_FRAG, count, THREE.NormalBlending, { depthTest: false });
    this.arrow.renderOrder = 10;
    this.group.add(this.blob, this.streaks, this.ring, this.arrow);
    scene.add(this.group);
    // estado por jogador
    this.poses = []; for (let i = 0; i < count; i++) this.poses.push(createPose());
    this.tr = new Float32Array(count * 5);      // x, y, z, ângulo, escala
    this.hs = new Float32Array(count).fill(1);
    this.bw = new Float32Array(count).fill(1);
    this.gk = new Uint8Array(count);
    this.vis = new Uint8Array(count).fill(1);
    this.ind = new Float32Array(count * 4);     // cor do indicador (a = ligado)
    this.dirty = true;
    this._p = new Float32Array(3);
  }

  setPlayer(i, { kit, isGK = false, number = 0, look = {} }) {
    const d = this.kitData, o = i * KW * 4, col = new THREE.Color();
    const put = (k, hex, a = 0) => { col.set(hex || '#888888'); d[o + k * 4] = col.r; d[o + k * 4 + 1] = col.g; d[o + k * 4 + 2] = col.b; d[o + k * 4 + 3] = a; };
    const pat = ['plain', 'stripes', 'hoops', 'halves', 'sash', 'pinstripe'].indexOf(kit.pattern || 'plain');
    const seed = ((number * 7 + (look.height || 1.8) * 100 + (look.build || 0.5) * 37) | 0) % BOOTS.length;
    put(0, look.skin || '#c68c5a', Math.max(pat, 0));
    put(1, kit.shirt, isGK ? 1 : 0);
    put(2, kit.sleeves || kit.shirt, HAIR[look.hair] ?? 1);
    put(3, kit.shorts, number | 0);
    put(4, kit.socks, look.beard ? 1 : 0);
    put(5, kit.second || kit.shirt);
    put(6, kit.trim || kit.second || '#ffffff');
    put(7, kit.number || '#ffffff');
    put(8, look.hairColor || '#1a120c');
    put(9, look.boots || BOOTS[seed]);
    put(10, kit.gloves || kit.trim || '#e8f040');
    put(11, look.bootAccent || ACC[seed]);
    this.kitTex.needsUpdate = true;
    this.style[i] = HAIR[look.hair] ?? 1; this.beard[i] = look.beard ? 1 : 0;
    this._packHair();
    this.hs[i] = (look.height || PLAYER.height) / 1.8;
    this.bw[i] = 0.92 + 0.16 * (look.build ?? 0.5);
    this.gk[i] = isGK ? 1 : 0;
  }

  // redistribui as instâncias de cabelo/barba: cada estilo desenha só os seus jogadores
  _packHair() {
    const n = this.count, used = new Int16Array(8);
    for (let i = 0; i < n; i++) {
      const st = this.style[i];
      if (st) { const m = this.hair[st]; m.geometry.attributes.aPid.array[used[st]] = i; this.slot[i * 2] = used[st]++; } else this.slot[i * 2] = -1;
      if (this.beard[i]) { const m = this.hair[7]; m.geometry.attributes.aPid.array[used[7]] = i; this.slot[i * 2 + 1] = used[7]++; } else this.slot[i * 2 + 1] = -1;
    }
    for (let st = 1; st <= 7; st++) {
      const m = this.hair[st];
      m.count = used[st]; m.geometry.attributes.aPid.needsUpdate = true;
      m.instanceMatrix.array.fill(0);        // update() reescreve os visíveis
    }
  }

  setVisible(i, v) { this.vis[i] = v ? 1 : 0; if (!v) this._hide(i); this.dirty = true; }
  setIndicator(i, color) {
    const o = i * 4;
    if (!color) { this.ind[o + 3] = 0; return; }
    const c = new THREE.Color(color);
    this.ind[o] = c.r; this.ind[o + 1] = c.g; this.ind[o + 2] = c.b; this.ind[o + 3] = 1;
  }

  _hide(i) {
    const n = this.count;
    for (const p of this.parts) {
      const a = p.mesh.instanceMatrix.array;
      for (let k = 0; k < p.bones.length; k++) a.fill(0, (k * n + i) * 16, (k * n + i) * 16 + 16);
    }
    for (let k = 0; k < 2; k++) { const sl = this.slot[i * 2 + k]; if (sl >= 0) this.hair[k ? 7 : this.style[i]].instanceMatrix.array.fill(0, sl * 16, sl * 16 + 16); }
    this.blob.instanceMatrix.array.fill(0, i * 16, i * 16 + 16);
    this.streaks.instanceMatrix.array.fill(0, i * 64, i * 64 + 64);
    this.ring.instanceMatrix.array.fill(0, i * 16, i * 16 + 16);
    this.arrow.instanceMatrix.array.fill(0, i * 16, i * 16 + 16);
  }

  update(i, { x = 0, y = 0, z = 0, heading = 0, pose }) {
    if (!this.vis[i]) return;
    const P = this.poses[i];
    computePose(pose, P);
    const th = Math.PI / 2 - heading, c = Math.cos(th), s = Math.sin(th);
    const qy = Math.sin(th / 2), qw = Math.cos(th / 2);
    const hs = this.hs[i], bw = this.bw[i], n = this.count;
    const t = this.tr; t[i * 5] = x; t[i * 5 + 1] = y; t[i * 5 + 2] = z; t[i * 5 + 3] = th; t[i * 5 + 4] = hs;
    const mq = P.mq, mp = P.mp;
    for (const part of this.parts) {
      const a = part.mesh.instanceMatrix.array, bones = part.bones;
      const kind = part.kind;
      const sx = kind === 'head' || kind === 'foot' ? 1 : kind === 'hand' ? (this.gk[i] ? 1.22 : 1) : bw;
      for (let k = 0; k < bones.length; k++) {
        const b = bones[k];
        // rotação no mundo = yaw * mq
        const bx = mq[b * 4], by = mq[b * 4 + 1], bz = mq[b * 4 + 2], bw4 = mq[b * 4 + 3];
        const X = qw * bx + qy * bz, Y = qw * by + qy * bw4, Z = qw * bz - qy * bx, Wq = qw * bw4 - qy * by;
        const px = mp[b * 3] * hs, py = mp[b * 3 + 1] * hs, pz = mp[b * 3 + 2] * hs;
        const o = (k * n + i) * 16;
        writeMat(a, o, X, Y, Z, Wq, x + c * px + s * pz, y + py, z - s * px + c * pz, sx * hs, (kind === 'hand' && this.gk[i] ? 1.12 : 1) * hs, sx * hs);
        if (kind === 'head') {       // cabelo e barba seguem a cabeça
          const s0 = this.slot[i * 2], s1 = this.slot[i * 2 + 1];
          if (s0 >= 0) this.hair[this.style[i]].instanceMatrix.array.set(a.subarray(o, o + 16), s0 * 16);
          if (s1 >= 0) this.hair[7].instanceMatrix.array.set(a.subarray(o, o + 16), s1 * 16);
        }
      }
    }
    this._ground(i, x, y, z, th, hs, P);
  }

  _ground(i, x, y, z, th, hs, P) {
    const mp = P.mp, c = Math.cos(th), s = Math.sin(th);
    // pontos projetados: pelve, cabeça, pés (espaço do modelo -> mundo)
    const fmx = (mp[39] + mp[48]) * 0.5, fmz = (mp[41] + mp[50]) * 0.5;
    const fx = x + (c * fmx + s * fmz) * hs, fz = z + (-s * fmx + c * fmz) * hs;
    const hx = x + (c * mp[12] + s * mp[14]) * hs, hz = z + (-s * mp[12] + c * mp[14]) * hs;
    const pX = x + (c * mp[0] + s * mp[2]) * hs, pZ = z + (-s * mp[0] + c * mp[2]) * hs;
    const cx = (fx + hx + pX * 2) * 0.25, cz = (fz + hz + pZ * 2) * 0.25;
    const dx = hx - fx, dz = hz - fz, len = Math.hypot(dx, dz);
    const ang = len > 0.05 ? Math.atan2(-dz, dx) : 0;
    const air = Math.max(0, mp[1] * hs - 1.0 * hs);   // pelve acima do normal (salto)
    const alpha = (this.night ? 0.62 : 0.5) * Math.max(0.25, 1 - air * 1.2);
    const L = Math.max(0.75, len + 0.55) * (1 + air * 0.4), Wd = 0.62 * hs * (1 + air * 0.3);
    writeMat(this.blob.instanceMatrix.array, i * 16, 0, Math.sin(ang / 2), 0, Math.cos(ang / 2), cx, y + 0.012, cz, L, 1, Wd);
    this.blob.geometry.attributes.aFx.array[i * 4 + 3] = alpha;
    if (this.night) {
      const sa = this.streaks.instanceMatrix.array, fa = this.streaks.geometry.attributes.aFx.array;
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2 + 0.07 * Math.sin(i * 1.7 + k);
        const len2 = (2.2 + 0.4 * ((k + i) & 1)) * hs;
        const ex = Math.cos(a), ez = Math.sin(a);
        // o quad começa nos pés e se estende na direção (ex, ez)
        writeMat(sa, (i * 4 + k) * 16, 0, Math.sin(-a / 2), 0, Math.cos(-a / 2), fx + ex * len2 * 0.5, y + 0.01, fz + ez * len2 * 0.5, len2, 1, 0.42 * hs);
        fa[(i * 4 + k) * 4 + 3] = 0.16 * Math.max(0.3, 1 - air);
      }
    }
    const io = i * 4, on = this.ind[io + 3] > 0;
    const rf = this.ring.geometry.attributes.aFx.array, af = this.arrow.geometry.attributes.aFx.array;
    if (on) {
      writeMat(this.ring.instanceMatrix.array, i * 16, 0, 0, 0, 1, pX, y + 0.02, pZ, 1.25 * hs, 1, 1.25 * hs);
      const hy = (mp[4 * 3 + 1] + 0.62) * hs + y;
      writeMat(this.arrow.instanceMatrix.array, i * 16, 0, 0, 0, 1, hx, hy, hz, 0.26, 0.26, 0.26);
      for (let k = 0; k < 3; k++) { rf[io + k] = this.ind[io + k]; af[io + k] = this.ind[io + k]; }
      rf[io + 3] = 0.85; af[io + 3] = 0.95;
    } else {
      this.ring.instanceMatrix.array.fill(0, i * 16, i * 16 + 16);
      this.arrow.instanceMatrix.array.fill(0, i * 16, i * 16 + 16);
    }
  }

  // posições no mundo (após update)
  _world(i, b, lx, ly, lz, out) {
    const p = bonePoint(this.poses[i], b, lx, ly, lz, this._p), t = this.tr, o = i * 5;
    const th = t[o + 3], hs = t[o + 4], c = Math.cos(th), s = Math.sin(th);
    out.x = t[o] + (c * p[0] + s * p[2]) * hs; out.y = t[o + 1] + p[1] * hs; out.z = t[o + 2] + (-s * p[0] + c * p[2]) * hs;
    return out;
  }
  footPos(i, foot, out) { return this._world(i, foot === -1 ? 13 : 16, 0, -0.035, 0.075, out); }
  headPos(i, out) { return this._world(i, 4, 0, 0.1, 0.02, out); }
  handPos(i, side, out) { return this._world(i, side === -1 ? 7 : 10, 0, -0.075, 0.01, out); }

  commit() {
    for (const p of this.parts) p.mesh.instanceMatrix.needsUpdate = true;
    for (let st = 1; st <= 7; st++) this.hair[st].instanceMatrix.needsUpdate = true;
    for (const m of [this.blob, this.streaks, this.ring, this.arrow]) {
      m.instanceMatrix.needsUpdate = true;
      m.geometry.attributes.aFx.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    // (atributos compartilhados com o cache são reenviados à GPU se outra instância os usar)
    for (const p of this.parts) { p.mesh.geometry.dispose(); p.mesh.dispose(); }
    for (let st = 1; st <= 7; st++) { this.hair[st].geometry.dispose(); this.hair[st].dispose(); }
    for (const m of [this.blob, this.streaks, this.ring, this.arrow]) { m.geometry.dispose(); m.material.dispose(); m.dispose(); }
    this.material.dispose(); this.kitTex.dispose(); this.digits.dispose();
  }
}

// matriz T·R·S (coluna principal) direto no array da instância
function writeMat(a, o, x, y, z, w, px, py, pz, sx, sy, sz) {
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  a[o] = (1 - (yy + zz)) * sx; a[o + 1] = (xy + wz) * sx; a[o + 2] = (xz - wy) * sx; a[o + 3] = 0;
  a[o + 4] = (xy - wz) * sy; a[o + 5] = (1 - (xx + zz)) * sy; a[o + 6] = (yz + wx) * sy; a[o + 7] = 0;
  a[o + 8] = (xz + wy) * sz; a[o + 9] = (yz - wx) * sz; a[o + 10] = (1 - (xx + yy)) * sz; a[o + 11] = 0;
  a[o + 12] = px; a[o + 13] = py; a[o + 14] = pz; a[o + 15] = 1;
}
