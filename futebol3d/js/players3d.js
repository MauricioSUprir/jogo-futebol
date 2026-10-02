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
//
// Uniforme: gola (kit.collar 'crew'|'v'|'polo'), listras nos punhos e meiões, laterais
// (kit.panel), escudo do clube no peito (kit.club -> atlas de escudos desenhado com crestSVG),
// patrocinador fictício (kit.sponsor -> atlas de letreiros), número nas costas com contorno
// (kit.numberOutline) e número pequeno no calção. Tudo no mesmo material e nos mesmos
// InstancedMesh: os atlas são texturas compartilhadas e o índice de cada jogador vai na
// textura de dados, então o número de draw calls não muda. Na qualidade baixa a trama do
// tecido (normal/rugosidade procedurais) fica desligada.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { computePose, createPose, bonePoint } from './anim.js';
import { PLAYER } from './config.js';
import { teamById, crestSVG } from './teams.js';

// ---------------------------------------------------------------- materiais (ids por vértice)
const M = { SKIN: 0, SHIRT: 1, SLEEVE: 2, SHORTS: 3, SOCK: 4, TRIM: 5, BOOT: 6, HAIR: 7, EYEW: 8, IRIS: 9, LIPS: 10, BROW: 11, HAND: 12, FOREARM: 13, SOLE: 14, ACCENT: 15 };
const HAIR = { bald: 0, short: 1, buzz: 2, curly: 3, long: 4, afro: 5, bun: 6 };
const KW = 17;   // texels por jogador na textura de dados (15: morphs/pele, 16: tom da pele)
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
// raio da cabeça escaneada por direção (a partir de HC), em células de 48 × 24 — o cabelo
// procedural é empurrado para fora dele, senão o crânio do escaneamento fura o cabelo
const RADIAL = [];
function scanRadial(feat) {
  if (RADIAL[feat] !== undefined) return RADIAL[feat];
  const d = SCAN[feat]; if (!d) return (RADIAL[feat] = null);
  const NA = 48, NB = 24, R = new Float32Array(NA * NB);
  for (let i = 0; i < d.p.length; i += 3) {
    const x = d.p[i] - HC[0], y = d.p[i + 1] - 1.6 - HC[1], z = d.p[i + 2] - HC[2], l = Math.hypot(x, y, z);
    const a = Math.floor(((Math.atan2(z, x) / (2 * Math.PI)) + 1) % 1 * NA), b = Math.min(NB - 1, Math.floor(Math.acos(Math.max(-1, Math.min(1, y / l))) / Math.PI * NB));
    R[b * NA + a] = Math.max(R[b * NA + a], l);
  }
  // preenche buracos e suaviza (máximo dos vizinhos)
  const S = new Float32Array(NA * NB);
  for (let b = 0; b < NB; b++) for (let a = 0; a < NA; a++) {
    let m = 0;
    for (let db = -1; db <= 1; db++) for (let da = -1; da <= 1; da++) { const bb = b + db; if (bb < 0 || bb >= NB) continue; m = Math.max(m, R[bb * NA + (a + da + NA) % NA]); }
    S[b * NA + a] = m;
  }
  return (RADIAL[feat] = { S, NA, NB });
}
function scanR(rad, x, y, z) {
  const a = Math.floor(((Math.atan2(z, x) / (2 * Math.PI)) + 1) % 1 * rad.NA), b = Math.min(rad.NB - 1, Math.floor(Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI * rad.NB));
  return rad.S[b * rad.NA + a];
}
function hairFn(style, L) {
  const rad = L ? scanRadial(L.feat) : null;
  const t = [0, 0.011, 0.0035, 0.017, 0.014, 0.04, 0.011][style];
  return (x, y, z, o) => {
    headPt(x, y, z, o);
    if (rad) {     // casca por fora do crânio escaneado
      const nx = o[0] - HC[0], ny = o[1] - HC[1], nz = o[2] - HC[2], nl = Math.hypot(nx, ny, nz);
      const rs = scanR(rad, nx / nl, ny / nl, nz / nl) + 0.002;
      if (rs > nl) { o[0] = HC[0] + nx / nl * rs; o[1] = HC[1] + ny / nl * rs; o[2] = HC[2] + nz / nl * rs; }
    }
    // linha do cabelo: com a cabeça escaneada (rosto em foto) ela sobe para mostrar a testa
    let hl = z > 0 ? 0.13 + (rad ? 1.2 : 0.3) * z * z : 0.13 - 0.63 * (-z) ** 1.3;
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
// Cabeça escaneada (só a forma; ver tools/rostos/cabeca.py). Carregada antes de criar os
// jogadores; sem ela, cai na cabeça procedural.
const SCAN = [null, null, null];
export async function preloadHeads() {
  if (SCAN[0]) return;
  try {
    const ld = async (n) => (await fetch(`assets/cabeca/cabeca-${n}.json`)).json();
    const [a, b] = await Promise.all([ld(1), ld(2)]);
    SCAN[0] = SCAN[1] = a; SCAN[2] = b;
  } catch (e) { console.warn('cabeça escaneada indisponível', e); }
}
// ---------------------------------------------------------------- corpo realista
// Malha humana inteira (Human Base Meshes, Blender Studio, CC0) com pesos para os 17 ossos
// do jogo — ver tools/humano/rig.py. Desenhada como UMA InstancedMesh deformada no shader.
let BODY = null;
export async function preloadBody() {
  if (BODY) return;
  try {
    const ld = (f) => fetch('assets/jogador/' + f);
    const img = (f) => new Promise((ok, err) => { const t = new THREE.TextureLoader().load('assets/jogador/' + f, ok, undefined, err); });
    const [meta, bin, skins, hairs, browA, headN] = await Promise.all([ld('mh.json').then(r => r.json()), ld('mh.bin').then(r => r.arrayBuffer()),
      img('peles.jpg'), img('cabelos.png'), img('sobrancelha-alfa.png'), img('cabeca-normal.jpg')]);
    headN.anisotropy = 4;
    skins.colorSpace = THREE.SRGBColorSpace; hairs.colorSpace = THREE.SRGBColorSpace;
    for (const t of [skins, hairs]) { t.anisotropy = 4; t.generateMipmaps = true; }
    BODY = { meta, bin, skins, hairs, browA, headN, inv: meta.invBind.map(a => new THREE.Matrix4().fromArray(a)) };
  } catch (e) { console.warn('corpo realista indisponível', e); }
}
function bodyGeometry(leve = false) {
  const L = (leve && BODY.meta.bodyLo) || BODY.meta.body, b = BODY.bin, n = L.nv, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b, L.pos, n * 3), 3));
  g.setAttribute('aRest', new THREE.BufferAttribute(new Float32Array(b, L.rest, n * 3), 3));
  g.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(b, L.uv, n * 2), 2));
  g.setAttribute('aFace', new THREE.BufferAttribute(new Float32Array(b, L.face, n * 2), 2));
  g.setAttribute('aMat', new THREE.BufferAttribute(Float32Array.from(new Uint8Array(b, L.mat, n)), 1));
  g.setAttribute('aSkinI', new THREE.BufferAttribute(Float32Array.from(new Uint8Array(b, L.idx, n * 4)), 4));
  g.setAttribute('aSkinW', new THREE.BufferAttribute(new Float32Array(b, L.w, n * 4), 4));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(b, L.index, L.ni), 1));
  g.computeVertexNormals();
  return g;
}
// estilo do jogo → cabelo do MakeHuman (1 curto, 2 raspado, 3 cacheado, 4 longo, 5 black, 6 coque)
const HAIR_MH = [null, 'short02', 'short04', 'short03', 'long01', 'afro01', 'ponytail01'];
function mhHair(st) {
  const k = BODY.meta.hair.findIndex(h => h.name === HAIR_MH[st]);
  const L = BODY.meta.hair[k], b = BODY.bin, n = L.nv, g = new THREE.BufferGeometry();
  const pos = new Float32Array(b, L.pos, n * 3).slice();
  for (let i = 1; i < pos.length; i += 3) pos[i] += 0;       // já relativo à cabeça
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRest', new THREE.BufferAttribute(new Float32Array(b, L.rest, n * 3), 3));
  g.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(b, L.uv, n * 2), 2));
  g.setAttribute('aMA', new THREE.BufferAttribute(new Float32Array(b, L.ma, n * 3), 3));
  g.setAttribute('aMS', new THREE.BufferAttribute(new Float32Array(b, L.ms, n * 3), 3));
  g.setAttribute('aCell', new THREE.BufferAttribute(new Float32Array(n).fill(k), 1));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(b, L.index, L.ni), 1));
  g.computeVertexNormals();
  return withMat(g, M.HAIR);
}
function scanHead(d) {
  const p = Float32Array.from(d.p);
  for (let i = 1; i < p.length; i += 3) p[i] -= 1.6;     // relativo ao osso da cabeça
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setIndex(d.i);
  g.computeVertexNormals();
  return finish([withMat(g, M.SKIN)], [0, 1.6, 0]);
}
function buildHead(L) {
  if (SCAN[L.feat]) return scanHead(SCAN[L.feat]);
  const parts = [deformed(L.head[0], L.head[1], headPt, M.SKIN)];
  const o = [0, 0, 0], F = L.F;
  for (const s of [1, -1]) {
    let p = surf(s * 0.4, 0.2, 0.92, F.iris ? -0.0068 : -0.004);
    parts.push(blob(p[0], p[1], p[2], 0.0115, 0.0062, 0.0085, F.iris ? M.EYEW : M.IRIS, 0, 0, ...F.eye));
    if (F.iris) { p = surf(s * 0.395, 0.2, 0.93, 0.0006); parts.push(blob(p[0], p[1], p[2], 0.0047, 0.0049, 0.003, M.IRIS, 0, 0, ...F.iris)); }
    p = surf(s * 0.41, 0.37, 0.88, 0.0015);
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
  const parts = [deformed(L.hair[0], L.hair[1], hairFn(st, L), M.HAIR, true)];
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

// atlas dos rostos da partida (8 × 4 células de 192 px; vaga = índice do jogador)
const SKIN_K = 0.92;   // pele lisa um pouco mais escura que a foto (que já traz luz de estúdio)
function faceAtlas(cell = 192) {
  const cv = document.createElement('canvas'); cv.width = cell * 8; cv.height = cell * 4;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#9a7056'; g.fillRect(0, 0, cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- shader do corpo
const VERT_DECL = /* glsl */`
attribute float aMat; attribute vec3 aRest; attribute float aPid;
uniform float uCount;
#ifdef BODY_SKIN
// corpo realista: 17 ossos por jogador numa textura (4 texels = 1 matriz, coluna-maior)
attribute vec4 aSkinI; attribute vec4 aSkinW; uniform highp sampler2D uBones;
attribute vec2 aFace; varying vec2 vFaceUv;
mat4 boneM(float b) { int x = int(b + 0.5) * 4, y = int(aPid + 0.5);
  return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0), texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0)); }
#endif
#if defined(BODY_SKIN) || defined(HAIR_TEX)
// MakeHuman: UV da pele/cabelo e morphs de rosto/corpo (pesos por jogador no texel 15)
attribute vec2 aUv; varying vec2 vUv2; uniform highp sampler2D uKit;
#endif
#ifdef HAIR_TEX
attribute vec3 aMA; attribute vec3 aMS;
#endif
#ifdef HAIR_TEX
attribute float aCell; flat varying float vCell;
#endif
flat varying float vMat; varying vec3 vRest; varying vec3 vSphN; flat varying float vPid; flat varying float vSide;
`;
const FRAG_DECL = /* glsl */`
#if defined(BODY_SKIN) || defined(HAIR_TEX)
varying vec2 vUv2; uniform sampler2D uSkins; uniform sampler2D uHairs; uniform sampler2D uBrowA; uniform sampler2D uHeadN; uniform float uDbgN;
#endif
#ifdef BODY_SKIN
varying vec2 vFaceUv;
#endif
#ifdef HAIR_TEX
flat varying float vCell;
#endif
uniform highp sampler2D uKit; uniform sampler2D uDigits; uniform sampler2D uCrest; uniform sampler2D uSponsor; uniform sampler2D uFace; uniform vec4 uFaceA; uniform vec2 uFaceB; uniform vec3 uFaceC;
flat varying float vMat; varying vec3 vRest; varying vec3 vSphN; flat varying float vPid; flat varying float vSide;
vec4 K(int i) { return texelFetch(uKit, ivec2(i, int(vPid + 0.5)), 0); }
float aa(float d) { float w = max(fwidth(d), 1e-4); return smoothstep(-w, w, d); }
float band(float x, float c, float hw) { float w = max(fwidth(x), 1e-4); return smoothstep(-w, w, hw - abs(x - c)); }
float inside(vec2 u) { return step(0.0, u.x) * step(u.x, 1.0) * step(0.0, u.y) * step(u.y, 1.0); }
// número (1 ou 2 algarismos) centrado em c, altura h; mirror = visto de costas
vec4 numAt(vec2 p, vec2 c, float h, bool mirror, float num, vec2 dpx, vec2 dpy, out float inBox) {
  float nd = num >= 9.5 ? 2.0 : 1.0;
  const float CROP = 0.74;                       // só o miolo da célula: algarismos mais juntos
  float Wd = h * 0.6 * CROP * nd, sx = mirror ? -1.0 : 1.0;
  float uu = sx * (p.x - c.x) / Wd + 0.5, vv = (p.y - c.y) / h + 0.5;
  float dig = nd > 1.5 ? (uu < 0.5 ? floor(num / 10.0) : mod(num, 10.0)) : num;
  vec2 gu = vec2((dig + (1.0 - CROP) * 0.5 + CROP * clamp(fract(uu * nd), 0.0, 1.0)) / 10.0, clamp(vv, 0.0, 1.0));
  vec2 gx = vec2(sx * dpx.x / Wd * nd * CROP / 10.0, dpx.y / h), gy = vec2(sx * dpy.x / Wd * nd * CROP / 10.0, dpy.y / h);
  inBox = inside(vec2(uu, vv)) * step(0.5, num);
  return textureGrad(uDigits, gu, gx, gy);
}
// Rosto fotográfico: projeção frontal da foto (atlas 8 × 4, célula = jogador) na cabeça.
// Alinhamento: olhos da malha (y 1,715; ±0,030) → olhos da foto (v 0,42; u 0,5 ± 0,135),
// boca (1,659) → 0,71 e queixo (1,586) → 0,89. Devolve cor e peso (0 = pele lisa).
vec4 facePhoto(vec3 r) {
  if (K(14).a < 0.5 || r.y < 1.5) return vec4(0.0);
  vec3 d = normalize(r - uFaceC);
  // uFaceA = (escala u, y dos olhos, y da boca, inclinação acima da boca); uFaceB.x = abaixo
  float u = 0.5 + (r.x - uFaceB.y) * uFaceA.x;
  float t = r.y >= uFaceA.z ? 0.42 + (uFaceA.y - r.y) * uFaceA.w : 0.717 + (uFaceA.z - r.y) * uFaceB.x;
  float w = smoothstep(0.12, 0.45, d.z) * smoothstep(0.17, 0.34, t) * (1.0 - smoothstep(0.9, 0.97, t))
          * (1.0 - smoothstep(0.33, 0.43, abs(u - 0.5)));
  if (w <= 0.0) return vec4(0.0);
  float cell = vPid;
  vec2 uv = vec2((mod(cell, 8.0) + clamp(u, 0.01, 0.99)) / 8.0, 1.0 - (floor(cell / 8.0) + clamp(t, 0.01, 0.99)) / 4.0);
  return vec4(texture(uFace, uv).rgb, w);
}
// relevo a partir das derivadas da altura (igual ao bump do three, sem textura)
vec3 kitBump(vec3 pos, vec3 n, vec2 dh, float fd) {
  vec3 sx = normalize(dFdx(pos)), sy = normalize(dFdy(pos));
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * fd;
  vec3 g = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * n - g);
}
`;
const FRAG_COLOR = /* glsl */`
float matRough = 0.82;
float fabH = 0.0;
{
  vec3 r = vRest;
  int m = int(vMat + 0.5);
#ifdef BODY_SKIN
  // gola do corpo realista decidida por pixel (os vértices misturam pele/camisa em dente de serra)
  if (r.y > 1.36 && abs(r.x) < 0.24 && (m == 0 || m == 1 || m == 2 || m == 13) && r.y < 1.56)
    m = r.y > 1.522 + 0.7 * max(0.0, abs(r.x) - 0.06) - 0.18 * max(0.0, r.z - 0.03) ? 0 : 1;
  // acima da gola quem aparece é o pescoço escaneado (a borda de cima do pescoço do corpo é serrilhada)
  if (m == 0 && r.y > 1.512 && abs(r.x) < 0.12 && K(14).a > 0.5) discard;
  // limites do uniforme por pixel (os vértices só dizem a "parte": braço, tronco/pernas, cabeça)
  bool armP = m == 2 || m == 13 || m == 12;
  bool bodyP = m == 1 || m == 3 || m == 4 || m == 6 || m == 14 || (m == 0 && r.y < 1.0);
  if (armP) m = r.y > 1.27 ? 2 : r.y > 0.885 ? 13 : 12;
  else if (bodyP && r.y < 1.40) m = r.y > 0.975 ? 1 : r.y > 0.70 ? 3 : r.y > 0.44 ? 0 : r.y > 0.13 ? 4 : r.y > 0.018 ? 6 : 14;
#endif
  vec2 dpx = dFdx(r.xy), dpy = dFdy(r.xy);     // derivadas fora dos desvios
  bool gk = K(1).a > 0.5;
  float num = floor(K(3).a + 0.5);
  // número das costas (grande, com contorno) e do calção (pequeno, perna esquerda)
  float bIn; vec4 dg = numAt(r.xy, vec2(0.0, 1.33), 0.2, true, num, dpx, dpy, bIn);
  bIn *= step(r.z, -0.035);
  // (coordenadas locais da coxa; vSide > 0 = perna esquerda)
  float sIn; vec4 ds = numAt(r.xy, vec2(0.012, -0.135), 0.052, false, num, dpx, dpy, sIn);
  sIn *= step(0.03, r.z) * step(0.5, vSide);
  // escudo no peito esquerdo (atlas 8 x 2 de células 128 px)
  float crSlot = K(13).a;
  const float CS = 0.084;
  vec2 cu = vec2((r.x - 0.084) / CS + 0.5, (r.y - 1.408) / CS + 0.5);
  float cIn = inside(cu) * step(0.03, r.z) * step(-0.5, crSlot);
  float cs = max(crSlot, 0.0);
  vec2 cuv = vec2((mod(cs, 8.0) + cu.x) / 8.0, (floor(cs / 8.0) + 1.0 - clamp(cu.y, 0.0, 1.0)) / 2.0);
  vec4 crest = textureGrad(uCrest, cuv, vec2(dpx.x / CS / 8.0, -dpx.y / CS / 2.0), vec2(dpy.x / CS / 8.0, -dpy.y / CS / 2.0));
  // patrocinador no centro do peito (atlas 2 x 4 de células 512 x 128)
  float spSlot = K(12).a;
  const float SW = 0.215, SH = 0.054;
  vec2 su = vec2(r.x / SW + 0.5, (r.y - 1.283) / SH + 0.5);
  float spIn = inside(su) * step(0.03, r.z) * step(-0.5, spSlot);
  float ss = max(spSlot, 0.0);
  vec2 suv = vec2((mod(ss, 2.0) + clamp(su.x, 0.0, 1.0)) / 2.0, (floor(ss / 2.0) + 1.0 - clamp(su.y, 0.0, 1.0)) / 4.0);
  vec4 sp = textureGrad(uSponsor, suv, vec2(dpx.x / SW / 2.0, -dpx.y / SH / 4.0), vec2(dpy.x / SW / 2.0, -dpy.y / SH / 4.0));
  // faixas de gola, punhos, meiões e laterais (larguras em metros, antisserrilhadas)
  float collar = floor(K(5).a + 0.5);
#ifdef BODY_SKIN
  // corpo realista: golas medidas a partir da linha do pescoço (não da altura fixa do boneco antigo)
  float neckL = 1.522 + 0.7 * max(0.0, abs(r.x) - 0.06) - 0.18 * max(0.0, r.z - 0.03);
  float yv = neckL - 0.07 + abs(r.x) * 1.25;
  float vBand = band(r.y, yv, 0.0085) * step(0.0, r.z) * step(r.y, neckL);
  float vIn = aa(r.y - yv - 0.0085) * step(0.0, r.z);
  float crew = aa(r.y - (neckL - 0.014));
  float polo = aa(r.y - (neckL - 0.02)) + band(r.x, 0.0, 0.011) * step(0.0, r.z) * aa(r.y - (neckL - 0.08)) * aa(neckL - r.y);
#else
  float yv = 1.452 + abs(r.x) * 1.25;
  float vBand = band(r.y, yv, 0.0085) * step(0.0, r.z) * step(r.y, 1.53);
  float vIn = aa(r.y - yv - 0.0085) * step(0.0, r.z);
  float crew = aa(r.y - 1.501);
  float polo = aa(r.y - 1.488) + band(r.x, 0.0, 0.011) * step(0.0, r.z) * aa(r.y - 1.43) * aa(1.5 - r.y);
#endif
  float btn = step(0.0, r.z) * ((1.0 - aa(length(vec2(r.x, r.y - 1.475)) - 0.0038)) + (1.0 - aa(length(vec2(r.x, r.y - 1.448)) - 0.0038)));
  float panel = aa(0.034 - abs(r.z)) * step(0.09, abs(r.x)) * step(r.y, 1.46) * step(0.5, K(6).a);
  float pipe = (band(r.z, 0.034, 0.0035) + band(r.z, -0.034, 0.0035)) * step(0.09, abs(r.x)) * step(r.y, 1.46) * step(0.5, K(6).a);
  float fk = 0.0;
  vec3 c = vec3(1.0);
  vec4 fph = (m == 0 || (m >= 8 && m <= 11)) ? facePhoto(r) : vec4(0.0);
  if (m == 0) { c = K(0).rgb; matRough = 0.5; }
  else if (m == 1) {
    int pat = int(K(0).a + 0.5);
    vec3 c1 = K(1).rgb, c2 = K(5).rgb, tr = K(6).rgb;
    float s = 0.0;
    if (pat == 1) s = aa(abs(fract(r.x / 0.1 + 0.5) - 0.5) - 0.25);
    else if (pat == 2) s = aa(abs(fract((r.y - 1.0) / 0.14) - 0.5) - 0.25);
    else if (pat == 3) s = aa(r.x);
    else if (pat == 4) s = aa(0.055 - abs(r.x * 0.85 * sign(r.z + 1e-4) + (r.y - 1.24)));
    else if (pat == 5) s = aa(0.0045 - abs(fract(r.x / 0.04 + 0.5) - 0.5) * 0.04);
    c = mix(c1, c2, s);
    c = mix(c, K(13).rgb, panel);
    c = mix(c, tr, pipe);
    // gola
    if (collar > 1.5) { c = mix(c, tr, min(polo, 1.0)); c = mix(c, c1 * 0.6, min(btn, 1.0)); }
    else if (collar > 0.5) { c = mix(c, K(0).rgb * 0.9, vIn * step(r.y, 1.53)); c = mix(c, tr, vBand); }
    else c = mix(c, tr, crew);
    // escudo (pré-multiplicado), patrocinador e número
    c = c * (1.0 - crest.a * cIn) + crest.rgb * cIn;
    float spo = step(0.5, K(7).a) * spIn;
    c = mix(c, K(14).rgb, sp.g * spo);
    c = mix(c, K(12).rgb, sp.r * spIn);
    c = mix(c, K(14).rgb, dg.g * bIn);
    c = mix(c, K(7).rgb, dg.r * bIn);
    fk = 1.0;
  }
  else if (m == 2) {
    c = K(2).rgb;
    c = mix(c, K(6).rgb, max(band(r.y, -0.109, 0.0045), band(r.y, -0.121, 0.0028)));
    fk = 1.0;
  }
  else if (m == 3) {
    c = K(3).rgb;
    float side = aa(0.011 - abs(r.z)) * step(0.1, abs(r.x)) + aa(0.011 - abs(r.z)) * step(0.06, r.x * vSide) * step(r.y, 0.1);
    c = mix(c, K(6).rgb, min(side, 1.0));
    c = mix(c, K(14).rgb, ds.g * sIn);
    c = mix(c, K(7).rgb, ds.r * sIn);
    fk = 2.0;
  }
  else if (m == 4) {
    c = K(4).rgb;
    c = mix(c, K(6).rgb, max(band(r.y, -0.124, 0.006), band(r.y, -0.142, 0.003)));
    fk = 3.0;
  }
  else if (m == 5) { c = K(6).rgb; fk = 1.0; }
  else if (m == 6) { c = K(9).rgb; matRough = 0.32; }
  else if (m == 7) { c = K(8).rgb; matRough = 0.7; }
  else if (m == 8) { c = vec3(0.78, 0.76, 0.72); matRough = 0.2; }
  else if (m == 9) { c = vec3(0.025, 0.018, 0.014); matRough = 0.15; }
  else if (m == 10) { c = K(0).rgb * vec3(0.74, 0.5, 0.48); matRough = 0.4; }
  else if (m == 11) { c = K(8).rgb * 0.75; matRough = 0.8; }
  else if (m == 12) { c = gk ? K(10).rgb : K(0).rgb; matRough = gk ? 0.65 : 0.5; }
  else if (m == 13) {
    c = gk ? K(2).rgb : K(0).rgb; matRough = gk ? 0.82 : 0.5;
    if (gk) { c = mix(c, K(6).rgb, band(r.y, -0.205, 0.006)); fk = 1.0; }
  }
  else if (m == 14) { c = K(11).rgb * 0.6 + 0.02; matRough = 0.45; }
  else if (m == 15) { c = K(11).rgb; matRough = 0.3; }
  if (fph.a > 0.0) { c = mix(c, fph.rgb, fph.a); matRough = mix(matRough, 0.55, fph.a); }
#ifdef BODY_SKIN
  // pele real do MakeHuman (atlas 4×2): célula escolhida pelo tom do jogador e tingida para ele
  vec4 sk = K(15), tn = K(16);
  if (m == 0 || m == 12 || m == 13) {
    float cl = floor(sk.z + 0.5);
    c = texture(uSkins, vec2((mod(cl, 4.0) + vUv2.x) / 4.0, 0.5 * (1.0 - floor(cl / 4.0)) + 0.5 * vUv2.y)).rgb * tn.rgb;
    // pescoço: funde com a cor da pele da foto (a cabeça)
    if (K(14).a > 0.5) c = mix(c, K(0).rgb * (0.9 + 0.2 * (c.r + c.g + c.b) / max(tn.r + tn.g + tn.b, 0.1)), smoothstep(1.40, 1.53, r.y));
    // barba rala (quem tem barba): queixo, mandíbula e bigode, com granulado
    if (m == 0 && K(4).a > 0.5 && r.y > 1.565 && r.y < 1.655 && r.z > 0.0) {
      float lip = (1.0 - smoothstep(0.004, 0.012, abs(r.y - 1.627))) * (1.0 - smoothstep(0.02, 0.028, abs(r.x)));
      float face = smoothstep(1.565, 1.59, r.y) * (1.0 - smoothstep(1.64, 1.655, r.y)) * smoothstep(0.0, 0.05, r.z);
      float g = fract(sin(dot(floor(r.xy * 2600.0), vec2(12.9898, 78.233))) * 43758.5453);
      c = mix(c, K(8).rgb * 0.55, face * (1.0 - lip) * (0.55 + 0.35 * g));
    }
    matRough = 0.55;
  } else if (m == 16) {
    // cabeça escaneada: a foto do jogador projetada de frente (como o teste "B");
    // laterais/costas: cabelo acima da linha do cabelo, pele abaixo
    // a base do pescoço escaneado fica dentro da gola: o que escapar abaixo dela some
    if (r.y < 1.505) discard;
    vec3 dd = normalize(r - vec3(0.0, 1.665, 0.035));
    vec2 fu = clamp(vFaceUv, vec2(0.004), vec2(0.996));
    // abaixo do queixo e fora da célula: pele lisa (sem vazar bordas/vizinhos da foto)
    float front = smoothstep(0.02, 0.42, dd.z) * (1.0 - smoothstep(0.9, 0.96, vFaceUv.y)) * (1.0 - smoothstep(0.44, 0.49, abs(vFaceUv.x - 0.5)));
    vec2 cell0 = vec2(mod(vPid, 8.0), floor(vPid / 8.0));
    vec3 ph = texture(uFace, vec2((cell0.x + fu.x) / 8.0, 1.0 - (cell0.y + fu.y) / 4.0)).rgb;
    // a foto já traz luz de estúdio e contraste: como cor da pele ela precisa de menos
    // contraste (escuros levantados, claros contidos), senão o sol estoura a testa e o
    // tone mapping afunda órbitas e barba em manchas
    ph = pow(ph, vec3(0.8)) * 0.78;
    // superfície virada para baixo (sob o queixo/mandíbula) não recebe a foto: ela escorreria em riscos
    // (só abaixo da boca: sob a sobrancelha a superfície também olha para baixo e precisa da foto)
    float gny = normalize(vNormal).y;   // normal suave (espaço da câmera, quase horizontal)
    front *= 1.0 - (1.0 - smoothstep(-0.6, -0.3, gny)) * (1.0 - smoothstep(1.6, 1.625, r.y));
    // pele das laterais/pescoço = a própria foto (bochechas e testa), para o tom bater com o rosto
    vec3 sk0 = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      vec2 q = i == 0 ? vec2(0.27, 0.6) : i == 1 ? vec2(0.71, 0.6) : i == 2 ? vec2(0.5, 0.3) : vec2(0.33, 0.68);
      sk0 += texture(uFace, vec2((cell0.x + q.x) / 8.0, 1.0 - (cell0.y + q.y) / 4.0), 3.0).rgb;
    }
    sk0 = pow(sk0 * 0.25, vec3(0.8)) * 0.78;
    float g2 = fract(sin(dot(floor(r.xz * 900.0 + r.y * 300.0), vec2(12.9898, 78.233))) * 43758.5453);
    float hairZ = (1.0 - sk.w) * (1.0 - smoothstep(0.25, 0.45, dd.z)) * smoothstep(1.638, 1.668, r.y - 0.02 * dd.z) * (1.0 - smoothstep(0.065, 0.08, abs(r.x)) * (1.0 - smoothstep(1.70, 1.72, r.y)));
    vec3 back = mix(sk0, K(8).rgb * (0.8 + 0.35 * g2), hairZ);
    // pescoço: fica na sombra da cabeça e puxa o verde do gramado; um pouco mais claro e quente
    back *= mix(vec3(1.32, 1.24, 1.18), vec3(1.0), smoothstep(1.56, 1.6, r.y));
    c = mix(back, ph, front);
    matRough = mix(0.62, 0.5, front);
    if (uDbgN > 0.5) c = texture(uHeadN, vUv2).rgb;
  } else if (m == 8) {
    c = texture(uSkins, vec2(0.75 + vUv2.x * 0.25, 0.25 + vUv2.y * 0.25)).rgb; matRough = 0.15;
  } else if (m == 11) {
    if (texture(uBrowA, vUv2).r < 0.4) discard;
    c = K(8).rgb * 0.7; matRough = 0.8;
  }
#endif
#ifdef HAIR_TEX
  if (m == 7) {
    float cl = floor(vCell + 0.5);
    vec4 h = texture(uHairs, vec2((mod(cl, 4.0) + fract(vUv2.x)) / 4.0, 0.5 * (1.0 - floor(cl / 4.0)) + 0.5 * fract(vUv2.y)));
    if (h.a < 0.45) discard;
    float l = dot(h.rgb, vec3(0.299, 0.587, 0.114));
    c = K(8).rgb * (0.45 + 1.4 * l); matRough = 0.6;
  }
#endif
#ifdef KIT_FABRIC
  // trama do tecido: malha (camisa), sarja (calção), canelado (meião); some com a distância
  vec3 q = vRest;
  float hMesh = smoothstep(-1.3, 0.3, cos(q.x * 820.0) + cos(q.y * 820.0) + cos(q.z * 820.0));
  float hTwill = 0.5 + 0.5 * sin((q.x + q.y - q.z) * 1300.0);
  float hRib = 0.5 + 0.5 * sin(atan(q.z, q.x) * 44.0);
  float fh = fk < 0.5 ? 0.0 : fk < 1.5 ? hMesh : fk < 2.5 ? hTwill : hRib;
  float fw = length(fwidth(q)) * 820.0;
  fabH = fh * (1.0 - smoothstep(0.7, 2.0, fw));
  c *= 1.0 - 0.07 * (1.0 - fabH) * step(0.5, fk) * (1.0 - smoothstep(0.7, 2.0, fw));
  if (fk > 0.5) matRough = 0.86 - 0.1 * fabH;
#endif
  diffuseColor.rgb = c;
}
`;
const FRAG_NORMAL = /* glsl */`
#ifdef BODY_SKIN
if (int(vMat + 0.5) == 16) {     // relevo da pele do escaneamento (poros, rugas) — base tangente por derivadas
  vec3 mapN = texture(uHeadN, vUv2).xyz * 2.0 - 1.0; mapN.xy *= 0.6;
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition); vec2 st0 = dFdx(vUv2), st1 = dFdy(vUv2);
  vec3 N = normalize(mix(normal, normalize(vSphN) * faceDirection, 0.5)), q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B)), sc = det == 0.0 ? 0.0 : faceDirection * inversesqrt(det);
  normal = normalize(T * (mapN.x * sc) + B * (mapN.y * sc) + N * mapN.z);
}
#endif
#ifdef KIT_FABRIC
normal = kitBump(-vViewPosition, normal, vec2(dFdx(fabH), dFdy(fabH)) * 0.55, faceDirection);
#endif
`;

const SKIN_NORMAL = /* glsl */`#include <beginnormal_vertex>
#ifdef BODY_SKIN
mat4 skinM = aSkinW.x * boneM(aSkinI.x) + aSkinW.y * boneM(aSkinI.y) + aSkinW.z * boneM(aSkinI.z) + aSkinW.w * boneM(aSkinI.w);
objectNormal = normalize(mat3(skinM) * objectNormal);
{ // normal "de esfera" da cabeça (luz suave no rosto: a foto já traz a sombra das órbitas)
  vec3 sn = mat3(skinM) * normalize(aRest - vec3(0.0, 1.665, 0.035));
#ifdef USE_INSTANCING
  sn = mat3(instanceMatrix) * sn;
#endif
  vSphN = normalMatrix * sn;
}
#endif`;
const SKIN_POS = /* glsl */`
#if defined(BODY_SKIN) || defined(HAIR_TEX)
vUv2 = aUv;
#endif
#ifdef HAIR_TEX
{ vec4 km = texelFetch(uKit, ivec2(15, int(aPid + 0.5)), 0); transformed += aMA * km.x + aMS * km.y; }
#endif
#ifdef HAIR_TEX
vCell = aCell;
#endif
#ifdef BODY_SKIN
vFaceUv = aFace;
transformed = (skinM * vec4(transformed, 1.0)).xyz;
vSide = aRest.x >= 0.0 ? 1.0 : -1.0;
#endif`;
// sombra do corpo realista: mesma deformação no material de profundidade
function skinDepthMaterial(uniforms) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.defines = { BODY_SKIN: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPid;\n' + VERT_DECL.split('uniform float uCount;')[1])
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nmat4 skinM = aSkinW.x * boneM(aSkinI.x) + aSkinW.y * boneM(aSkinI.y) + aSkinW.z * boneM(aSkinI.z) + aSkinW.w * boneM(aSkinI.w);\ntransformed = (skinM * vec4(transformed, 1.0)).xyz;');
  };
  m.customProgramCacheKey = () => 'golaco-body-depth';
  return m;
}

function bodyMaterial(uniforms, fabric, skinned = false, hairTex = false) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  mat.defines = {};
  if (fabric) mat.defines.KIT_FABRIC = '';
  if (skinned) mat.defines.BODY_SKIN = '';
  if (hairTex) { mat.defines.HAIR_TEX = ''; mat.side = THREE.DoubleSide; }
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <beginnormal_vertex>', SKIN_NORMAL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPid = aPid; vMat = aMat; vRest = aRest; vSide = float(gl_InstanceID) >= uCount ? -1.0 : 1.0;\n' + SKIN_POS);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = matRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL)
      // leve brilho de borda na pele (sheen barato)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (int(vMat + 0.5) == 0 || int(vMat + 0.5) == 12) totalEmissiveRadiance += diffuseColor.rgb * 0.06 * pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0); if (int(vMat + 0.5) == 8) totalEmissiveRadiance += diffuseColor.rgb * 0.25; if (int(vMat + 0.5) == 16) totalEmissiveRadiance += diffuseColor.rgb * vec3(0.42, 0.3, 0.24) * (1.0 - smoothstep(1.56, 1.6, vRest.y));');
  };
  mat.customProgramCacheKey = () => 'golaco-body-v6' + (fabric ? '-f' : '') + (skinned ? '-s' : '') + (hairTex ? '-h' : '');
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

// atlas de escudos: 8 x 2 células de 128 px (RGBA pré-multiplicado, sRGB). Cada clube
// entra na primeira vez que um uniforme dele aparece; o SVG é rasterizado de forma assíncrona.
function crestAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.premultiplyAlpha = true; t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function drawCrest(tex, slot, team) {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => {
    const g = tex.image.getContext('2d'), x = (slot % 8) * 128, y = Math.floor(slot / 8) * 128;
    const h = 122, w = h * 200 / 224;
    g.clearRect(x, y, 128, 128);
    g.drawImage(img, x + (128 - w) / 2, y + 3, w, h);
    tex.needsUpdate = true;
  };
  // versão simplificada do escudo (lê melhor nos ~7 cm do peito)
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(crestSVG(team, 72));
}
// atlas de patrocinadores: 2 x 4 células de 512 x 128; R = letras, G = contorno
function sponsorAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.anisotropy = 4;
  return t;
}
function drawSponsor(tex, slot, text) {
  const g = tex.image.getContext('2d'), x = (slot % 2) * 512, y = Math.floor(slot / 2) * 128;
  g.save();
  g.beginPath(); g.rect(x, y, 512, 128); g.clip();
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(x, y, 512, 128);
  g.font = 'italic 800 100px "Barlow Condensed", "Arial Narrow", "Roboto Condensed", Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const w = g.measureText(text).width, k = Math.min(1, 460 / Math.max(w, 1));
  g.translate(x + 256, y + 68); g.scale(k, 1);
  g.strokeStyle = '#00ff00'; g.lineWidth = 16; g.strokeText(text, 0, 0);
  g.globalCompositeOperation = 'lighter'; g.fillStyle = '#ff0000'; g.fillText(text, 0, 0);
  g.restore();
  tex.needsUpdate = true;
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
const GEO_SCAN = [];
const GEO_BODY = [];
const pidAttr = (n, per) => { const a = new Float32Array(n * per); for (let k = 0; k < a.length; k++) a[k] = k % n; return new THREE.InstancedBufferAttribute(a, 1); };

export class PlayerMeshes {
  constructor(scene, { count = 22, quality = null, night = false } = {}) {
    this.scene = scene; this.count = count; this.night = night;
    const lod = quality ? Math.max(0, Math.min(2, quality.grassDetail ?? 2)) : 2;
    this.lod = lod;
    this.realBody = !!BODY;
    let geos;
    if (this.realBody) {
      // corpo realista: uma malha só; cabelo tirado da própria cabeça
      if (!GEO_BODY[lod]) { GEO_BODY[lod] = { body: bodyGeometry(lod <= 1) }; for (let st = 1; st <= 6; st++) GEO_BODY[lod]['hair' + st] = mhHair(st); GEO_BODY[lod].hair7 = withMat(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)).setAttribute('aRest', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)), M.HAIR); }
      geos = GEO_BODY[lod];
    } else {
      const cache = SCAN[LODS[lod].feat] ? GEO_SCAN : GEO;
      if (!cache[lod]) cache[lod] = buildParts(LODS[lod]);
      geos = cache[lod];
    }
    this.kitData = new Float32Array(KW * count * 4);
    this.kitTex = new THREE.DataTexture(this.kitData, KW, count, THREE.RGBAFormat, THREE.FloatType);
    this.kitTex.minFilter = this.kitTex.magFilter = THREE.NearestFilter;
    this.kitTex.needsUpdate = true;
    this.digits = digitAtlas();
    this.crestTex = crestAtlas(); this.sponsorTex = sponsorAtlas();
    this.crestSlots = new Map(); this.sponsorSlots = new Map();
    const uni = { uKit: { value: this.kitTex }, uDigits: { value: this.digits }, uCrest: { value: this.crestTex },
      uSponsor: { value: this.sponsorTex }, uCount: { value: count }, uFace: { value: this.faceTex = faceAtlas(BODY ? (lod >= 2 ? 384 : 256) : 192) },
      // olhos/boca/queixo da cabeça escaneada (y 1,7149 / 1,6602 / 1,6192; olhos ±0,0272) ou da procedural
      uFaceA: { value: this.realBody ? new THREE.Vector4(4.545, 1.6951, 1.6313, 4.655) : SCAN[LODS[lod].feat] ? new THREE.Vector4(4.963, 1.7149, 1.6602, 5.43) : new THREE.Vector4(4.47, 1.7154, 1.6586, 5.22) },
      uFaceB: { value: this.realBody ? new THREE.Vector2(4.248, 0.0006) : new THREE.Vector2(SCAN[LODS[lod].feat] ? 4.76 : 2.67, 0) },
      // centro da cabeça (para saber o que é "frente do rosto")
      uFaceC: { value: this.realBody ? new THREE.Vector3(0, 1.67, 0.04) : new THREE.Vector3(0, 1.694, 0.014) } };
    if (this.realBody) {
      this.boneData = new Float32Array(17 * 4 * 4 * count);
      this.boneTex = new THREE.DataTexture(this.boneData, 17 * 4, count, THREE.RGBAFormat, THREE.FloatType);
      this.boneTex.minFilter = this.boneTex.magFilter = THREE.NearestFilter;
      uni.uBones = { value: this.boneTex };
      uni.uSkins = { value: BODY.skins }; uni.uHairs = { value: BODY.hairs }; uni.uBrowA = { value: BODY.browA }; uni.uHeadN = { value: BODY.headN }; uni.uDbgN = { value: 0 }; this.uni = uni;
      this.hairMat = bodyMaterial(uni, false, false, true);
    }
    this.material = bodyMaterial(uni, lod > 0);
    // redesenha os letreiros quando a fonte condensada terminar de carregar
    document.fonts?.load?.('italic 800 100px "Barlow Condensed"').then(() => {
      for (const [txt, sl] of this.sponsorSlots) drawSponsor(this.sponsorTex, sl, txt);
    }).catch(() => {});
    const shadows = quality ? quality.shadows !== false : true;
    this.group = new THREE.Group(); this.group.name = 'jogadores';
    this.parts = [];   // { mesh, bones: [b] ou [bL, bR], kind }
    const mk = (name, per) => {
      // geometria própria (clone raso) para o atributo aPid por instância
      const g = new THREE.BufferGeometry();
      for (const k in geos[name].attributes) g.setAttribute(k, geos[name].attributes[k]);
      g.setIndex(geos[name].index);
      g.setAttribute('aPid', pidAttr(count, per));
      const m = new THREE.InstancedMesh(g, this.realBody && name.startsWith('hair') ? this.hairMat : this.material, count * per);
      m.castShadow = shadows; m.receiveShadow = true; m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceMatrix.array.fill(0);
      m.name = 'jog-' + name;
      this.group.add(m);
      return m;
    };
    if (this.realBody) {
      const g = geos.body.clone(); g.setAttribute('aPid', pidAttr(count, 1));
      const m = new THREE.InstancedMesh(g, bodyMaterial(uni, lod > 0, true), count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceMatrix.array.fill(0);
      m.customDepthMaterial = skinDepthMaterial(uni);
      m.castShadow = shadows; m.receiveShadow = true; m.frustumCulled = false; m.name = 'jog-corpo';
      this.group.add(m); this.bodyMesh = m;
      this._hm = new Float32Array(16);
    } else {
      for (const [b, name] of SINGLE) this.parts.push({ mesh: mk(name, 1), bones: [b], kind: name });
      for (const [bl, br, name] of LIMB) this.parts.push({ mesh: mk(name, 2), bones: [bl, br], kind: name });
    }
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
    // passes com material de substituição (normais do GTAO) não sabem deformar o esqueleto:
    // calculariam a oclusão sobre o corpo em pose de repouso (olheiras e manchas). Pula.
    this.group.traverse(o => {
      if (!o.isInstancedMesh || o === this.blob || o === this.streaks || o === this.ring || o === this.arrow) return;
      let saved = 0;
      o.onBeforeRender = (r, sc, c, geo, mat) => { if (mat !== o.material && mat !== o.customDepthMaterial && !mat.isMeshDepthMaterial && !mat.isMeshDistanceMaterial) { saved = o.count; o.count = 0; } };
      o.onAfterRender = (r, sc, c, geo, mat) => { if (mat !== o.material && mat !== o.customDepthMaterial && !mat.isMeshDepthMaterial && !mat.isMeshDistanceMaterial) o.count = saved; };
    });
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
    const collar = { crew: 0, v: 1, polo: 2 }[kit.collar] ?? 0;
    put(5, kit.second || kit.shirt, collar);
    put(6, kit.trim || kit.second || '#ffffff', kit.panel ? 1 : 0);
    put(7, kit.number || '#ffffff', kit.sponsorOutline ? 1 : 0);
    put(8, look.hairColor || '#1a120c');
    put(9, look.boots || BOOTS[seed]);
    put(10, kit.gloves || kit.trim || '#e8f040');
    put(11, look.bootAccent || ACC[seed]);
    put(12, kit.sponsorColor || kit.number || '#ffffff', kit.sponsor ? this._sponsorSlot(kit.sponsor) : -1);
    put(13, kit.panel || kit.shirt, kit.club ? this._crestSlot(kit.club) : -1);
    put(14, kit.numberOutline || kit.trim || kit.second || '#111111');
    if (this.realBody) {
      // pele MakeHuman: célula do atlas pelo tom (escuras 0–1, claras 2–6), tinta para o tom exato
      // e morphs de rosto/corpo (africano / asiático) variando por jogador
      const sc = new THREE.Color(look.skin || '#c68c5a'), Ls = (0.299 * sc.r + 0.587 * sc.g + 0.114 * sc.b);
      const hh = (k) => { const x = Math.sin((number * 13.7 + (look.height || 1.8) * 91 + (look.build || 0.5) * 57 + k * 7.3)) * 43758.5; return x - Math.floor(x); };
      const lumL = BODY.meta.skinLum.map(v => Math.pow(v / 255, 2.2));
      const dark = Ls < 0.12;
      const cell = dark ? (hh(1) < 0.6 ? 0 : 1) : 2 + Math.floor(hh(2) * 5);
      const t = Math.min(1.45, Math.max(0.5, Ls / lumL[cell] * 0.82));
      const o15 = o + 15 * 4, o16 = o + 16 * 4;
      d[o15] = dark ? 0.55 + 0.45 * hh(3) : 0.12 * hh(3);
      d[o15 + 1] = !dark && hh(4) > 0.72 ? 0.45 + 0.55 * hh(5) : 0;
      d[o15 + 2] = cell;
      d[o16] = t * (1 + (sc.r - sc.g) * 0.25); d[o16 + 1] = t; d[o16 + 2] = t * (1 - (sc.g - sc.b) * 0.2);
    }
    this.kitTex.needsUpdate = true;
    this.style[i] = HAIR[look.hair] ?? 1; this.beard[i] = this.realBody ? 0 : look.beard ? 1 : 0;
    this._packHair();
    this.hs[i] = (look.height || PLAYER.height) / 1.8;
    this.bw[i] = 0.92 + 0.16 * (look.build ?? 0.5);
    this.gk[i] = isGK ? 1 : 0;
  }

  // Rostos fotográficos: copia a célula do banco (faces.js) para a vaga do jogador i
  // (atlas 8 × 4) e acerta a cor da pele do corpo pela foto.
  setFaces(fp, cells) {
    const cv = this.faceTex.image, g = cv.getContext('2d'), F = cv.width / 8, d = this.kitData;
    if (this.realBody) {
      // foto do jogador como pele da cabeça escaneada; corpo do MakeHuman tingido com a cor da pele da foto
      const lumL = BODY.meta.skinLum.map(v => Math.pow(v / 255, 2.2));
      for (let i = 0; i < cells.length && i < 32; i++) {
        const c = cells[i], o = i * KW * 4;
        if (!fp || c < 0) continue;
        const C = fp.meta.cell;
        g.drawImage(fp.img, (c % fp.meta.cols) * C, Math.floor(c / fp.meta.cols) * C, C, C, (i % 8) * F, Math.floor(i / 8) * F, F, F);
        const pk = fp.meta.pele[c], hk = fp.meta.cabelo?.[c] || pk;
        const sc = new THREE.Color().setRGB(pk[0] / 255, pk[1] / 255, pk[2] / 255, THREE.SRGBColorSpace);
        const hc = new THREE.Color().setRGB(hk[0] / 255, hk[1] / 255, hk[2] / 255, THREE.SRGBColorSpace);
        const Ls = 0.299 * sc.r + 0.587 * sc.g + 0.114 * sc.b, Lh = 0.299 * hc.r + 0.587 * hc.g + 0.114 * hc.b;
        d[o] = sc.r * 0.92; d[o + 1] = sc.g * 0.92; d[o + 2] = sc.b * 0.92;          // pele (costas da cabeça, pescoço)
        d[o + 32] = hc.r; d[o + 33] = hc.g; d[o + 34] = hc.b;                        // cabelo
        const cell = Ls < 0.12 ? 0 : 2 + (i % 5);
        const t = Math.min(1.6, Math.max(0.45, Ls / lumL[cell] * 0.95));
        d[o + 60] = 0; d[o + 61] = 0; d[o + 62] = cell; d[o + 63] = Lh > Ls * 0.72 ? 1 : 0;   // morphs 0; careca?
        const hue = (x) => 1 + 0.45 * (x / Math.max(Ls, 1e-3) - 1);
        d[o + 64] = t * hue(sc.r); d[o + 65] = t * hue(sc.g); d[o + 66] = t * hue(sc.b);
        d[o + 59] = 1; this.style[i] = 0; this.beard[i] = 0;
      }
      this._packHair();
      this.faceTex.needsUpdate = true; this.kitTex.needsUpdate = true;
      return;
    }
    for (let i = 0; i < cells.length && i < 32; i++) {
      const c = cells[i], o = i * KW * 4 + 14 * 4 + 3;
      if (!fp || c < 0) { d[o] = 0; continue; }
      const C = fp.meta.cell;
      g.drawImage(fp.img, (c % fp.meta.cols) * C, Math.floor(c / fp.meta.cols) * C, C, C, (i % 8) * F, Math.floor(i / 8) * F, F, F);
      d[o] = 1;
      // pele do corpo = média das bochechas da foto (a barba já vem na foto: sem barba 3D)
      const x0 = (i % 8) * F, y0 = Math.floor(i / 8) * F;
      let r = 0, gg = 0, bb = 0, n = 0;
      // testa + bochechas + queixo (média ampla: a luz da foto varia pelo rosto)
      for (const [cx, cy] of [[0.46, 0.3], [0.27, 0.6], [0.65, 0.6], [0.46, 0.86]]) {
        const px = g.getImageData(x0 + cx * F, y0 + cy * F, 0.08 * F, 0.06 * F).data;
        for (let k = 0; k < px.length; k += 4) { r += px[k]; gg += px[k + 1]; bb += px[k + 2]; n++; }
      }
      const col = new THREE.Color().setRGB(r / n / 255, gg / n / 255, bb / n / 255, THREE.SRGBColorSpace);
      d[i * KW * 4] = col.r * SKIN_K; d[i * KW * 4 + 1] = col.g * SKIN_K; d[i * KW * 4 + 2] = col.b * SKIN_K;
      // cabelo 3D com a cor do cabelo da foto (topo da célula), se for bem mais escuro que a pele
      const hp = g.getImageData(x0 + 0.42 * F, y0 + 0.07 * F, 0.16 * F, 0.05 * F).data;
      let hr = 0, hg = 0, hb = 0, hn = 0;
      for (let k = 0; k < hp.length; k += 4) { hr += hp[k]; hg += hp[k + 1]; hb += hp[k + 2]; hn++; }
      if ((hr + hg + hb) / hn < (r + gg + bb) / n * 0.7) {
        const hc = new THREE.Color().setRGB(hr / hn / 255, hg / hn / 255, hb / hn / 255, THREE.SRGBColorSpace);
        const o8 = i * KW * 4 + 8 * 4; d[o8] = hc.r * 0.8; d[o8 + 1] = hc.g * 0.8; d[o8 + 2] = hc.b * 0.8;
      }
      this.beard[i] = 0;
    }
    this._packHair();
    this.faceTex.needsUpdate = true; this.kitTex.needsUpdate = true;
  }

  // vaga do escudo do clube no atlas (-1 = clube desconhecido)
  _crestSlot(id) {
    if (this.crestSlots.has(id)) return this.crestSlots.get(id);
    const team = teamById(id);
    if (!team || this.crestSlots.size >= 16) return -1;
    const sl = this.crestSlots.size;
    this.crestSlots.set(id, sl);
    drawCrest(this.crestTex, sl, team);
    return sl;
  }
  _sponsorSlot(text) {
    if (this.sponsorSlots.has(text)) return this.sponsorSlots.get(text);
    if (this.sponsorSlots.size >= 8) return -1;
    const sl = this.sponsorSlots.size;
    this.sponsorSlots.set(text, sl);
    drawSponsor(this.sponsorTex, sl, text);
    return sl;
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
    if (this.realBody) { this.bodyMesh.instanceMatrix.array.fill(0, i * 16, i * 16 + 16); this.bodyMesh.instanceMatrix.needsUpdate = true; }
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
    if (this.realBody) this._skin(i, x, y, z, qy, qw, c, s, hs, bw, P);
    this._ground(i, x, y, z, th, hs, P);
  }

  // matrizes dos 17 ossos (mundo × inversa da ligação) para a deformação no shader
  _skin(i, x, y, z, qy, qw, c, s, hs, bw, P) {
    // matriz da instância = posição/giro/escala do jogador; ossos no espaço do modelo
    // (passes que trocam o material, como o AO, ao menos põem o corpo no lugar certo)
    writeMat(this.bodyMesh.instanceMatrix.array, i * 16, 0, qy, 0, qw, x, y, z, hs * bw, hs, hs * bw);
    const mq = P.mq, mp = P.mp, D = this.boneData, o0 = i * 17 * 16, M = _M, inv = BODY.inv;
    for (let b = 0; b < 17; b++) {
      writeMat(M.elements, 0, mq[b * 4], mq[b * 4 + 1], mq[b * 4 + 2], mq[b * 4 + 3], mp[b * 3], mp[b * 3 + 1], mp[b * 3 + 2], 1, 1, 1);
      M.multiply(inv[b]);
      D.set(M.elements, o0 + b * 16);
      if (b === 4) {     // cabelo segue a cabeça
        const bx = mq[16], by = mq[17], bz = mq[18], bw4 = mq[19];
        const X = qw * bx + qy * bz, Y = qw * by + qy * bw4, Z = qw * bz - qy * bx, Wq = qw * bw4 - qy * by;
        const px = mp[12] * hs, py = mp[13] * hs, pz = mp[14] * hs;
        writeMat(this._hm, 0, X, Y, Z, Wq, x + c * px + s * pz, y + py, z - s * px + c * pz, hs, hs, hs);
        const s0 = this.slot[i * 2];
        if (s0 >= 0) this.hair[this.style[i]].instanceMatrix.array.set(this._hm, s0 * 16);
      }
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.boneTex.needsUpdate = true;
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
    this.material.dispose(); this.kitTex.dispose(); this.digits.dispose(); this.crestTex.dispose(); this.sponsorTex.dispose();
  }
}

// matriz T·R·S (coluna principal) direto no array da instância
const _M = new THREE.Matrix4();
function writeMat(a, o, x, y, z, w, px, py, pz, sx, sy, sz) {
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  a[o] = (1 - (yy + zz)) * sx; a[o + 1] = (xy + wz) * sx; a[o + 2] = (xz - wy) * sx; a[o + 3] = 0;
  a[o + 4] = (xy - wz) * sy; a[o + 5] = (1 - (xx + zz)) * sy; a[o + 6] = (yz + wx) * sy; a[o + 7] = 0;
  a[o + 8] = (xz + wy) * sz; a[o + 9] = (yz - wx) * sz; a[o + 10] = (1 - (xx + yy)) * sz; a[o + 11] = 0;
  a[o + 12] = px; a[o + 13] = py; a[o + 14] = pz; a[o + 15] = 1;
}
