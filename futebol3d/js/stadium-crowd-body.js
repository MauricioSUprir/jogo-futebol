// Malhas low-poly dos torcedores 3D (uma por nível de detalhe).
//
// Cada malha é um corpo inteiro em pose de referência (de pé, braços caídos),
// no espaço local do torcedor: x = direita dele, y = para cima, z = para a frente
// (na direção do campo), pés em y = 0. Cada vértice leva `aPart`, que diz ao
// shader de vértice qual articulação o move:
//   1 tronco   2 cabeça   3 aba do boné
//   4 braço D  5 antebraço D   6 braço E  7 antebraço E
//   8 coxa +x  9 coxa -x  10 canela +x  11 canela -x
// As medidas abaixo (J) são repetidas no GLSL (stadium-crowd-glsl.js).
import * as THREE from 'three';

export const J = {
  pelvisY: 0.93,
  neck: [0, 1.49, 0.0],
  head: [0, 1.615, 0.018], headR: [0.098, 0.118, 0.108],
  shoulder: [0.205, 1.425, 0.0],
  elbow: [0.215, 1.145, 0.0],
  wrist: [0.22, 0.905, 0.01],
  handTip: [0.222, 0.815, 0.015],
  hip: [0.093, 0.93, 0.0],
  knee: [0.1, 0.5, 0.01],
  ankle: [0.1, 0.06, 0.0],
};

class Builder {
  constructor() { this.pos = []; this.nor = []; this.part = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  v(p, nn, part) {
    this.pos.push(p[0], p[1], p[2]);
    const l = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    this.nor.push(nn[0] / l, nn[1] / l, nn[2] / l);
    this.part.push(part);
    return this.n - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  // prisma vertical por anéis: rings = [{ y, x, z, rx, rz }], seções com `sides` lados.
  // a0 = ângulo inicial; capTop/capBot = tampa plana; apex = [x,y,z] fecha o topo num cone.
  prism(rings, sides, part, { a0 = 0, capTop = false, capBot = false, apex = null } = {}) {
    const start = this.n;
    for (const r of rings) {
      for (let k = 0; k < sides; k++) {
        const a = a0 + (k / sides) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        this.v([r.x + c * r.rx, r.y, r.z + s * r.rz], [c / r.rx, 0, s / r.rz], part);
      }
    }
    for (let i = 0; i < rings.length - 1; i++) {
      // anéis vão de cima para baixo ou de baixo para cima: acerta a orientação
      const up = rings[i + 1].y > rings[i].y;
      for (let k = 0; k < sides; k++) {
        const a = start + i * sides + k, b = start + i * sides + (k + 1) % sides;
        const c = a + sides, d = b + sides;
        if (up) { this.tri(a, c, b); this.tri(b, c, d); } else { this.tri(a, b, c); this.tri(b, d, c); }
      }
    }
    const top = rings.reduce((m, r) => (r.y > m.y ? r : m), rings[0]);
    const bot = rings.reduce((m, r) => (r.y < m.y ? r : m), rings[0]);
    const cap = (r, dir) => {
      const o = this.n;
      for (let k = 0; k < sides; k++) {
        const a = a0 + (k / sides) * Math.PI * 2;
        this.v([r.x + Math.cos(a) * r.rx, r.y, r.z + Math.sin(a) * r.rz], [0, dir, 0], part);
      }
      for (let k = 1; k < sides - 1; k++) {
        if (dir > 0) this.tri(o, o + k + 1, o + k); else this.tri(o, o + k, o + k + 1);
      }
    };
    if (capTop) cap(top, 1);
    if (capBot) cap(bot, -1);
    if (apex) {
      const ti = rings.indexOf(top), o = start + ti * sides;
      const ai = this.v(apex, [0, 1, 0], part);
      for (let k = 0; k < sides; k++) this.tri(o + k, ai, o + (k + 1) % sides);
    }
  }
  // elipsoide a partir de um poliedro (icosaedro/octaedro), normais suaves
  blob(geo, c, r, part) {
    const g = geo;
    const p = g.attributes.position;
    const map = new Map(), ids = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      let id = map.get(key);
      if (id === undefined) {
        id = this.v([c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]], [x / r[0], y / r[1], z / r[2]], part);
        map.set(key, id);
      }
      ids.push(id);
    }
    if (g.index) for (let i = 0; i < g.index.count; i += 3) this.tri(ids[g.index.getX(i)], ids[g.index.getX(i + 1)], ids[g.index.getX(i + 2)]);
    else for (let i = 0; i < ids.length; i += 3) this.tri(ids[i], ids[i + 1], ids[i + 2]);
    geo.dispose();
  }
  // placa fina (aba do boné): 2 triângulos em cima (+2 embaixo se twoSided)
  plate(pts, part, twoSided) {
    const [a, b, c, d] = pts;
    const o = this.n;
    for (const p of pts) this.v(p, [0, 1, 0.25], part);
    this.tri(o, o + 2, o + 1); this.tri(o, o + 3, o + 2);
    if (twoSided) {
      const u = this.n;
      for (const p of [a, b, c, d]) this.v([p[0], p[1] - 0.008, p[2]], [0, -1, 0], part);
      this.tri(u, u + 1, u + 2); this.tri(u, u + 2, u + 3);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
    g.setIndex(this.idx);
    return g;
  }
}

// lod: 'ultra' | 'alta' | 'media' | 'baixa'
export function buildBodyGeometry(lod = 'alta') {
  const B = new Builder();
  const hi = lod === 'ultra', mid = lod === 'alta', lo = lod === 'media', min = lod === 'baixa';

  // ---- cabeça
  if (min) {
    // octaedro achatado em cima (menos "diamante"), 8 triângulos
    const o = new THREE.OctahedronGeometry(1, 0);
    const p = o.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setY(i, 0.62);
    o.rotateY(Math.PI / 4);
    B.blob(o, J.head, J.headR.map((v) => v * 1.18), 2);
  } else B.blob(new THREE.IcosahedronGeometry(1, 0), J.head, J.headR, 2);

  // ---- aba do boné (fica colapsada em quem não usa boné)
  if (!min) {
    const y = J.head[1] + 0.045, z0 = J.head[2] + 0.07, z1 = J.head[2] + 0.19;
    B.plate([[-0.085, y, z0], [0.085, y, z0], [0.08, y - 0.02, z1], [-0.08, y - 0.02, z1]], 3, false);
  }

  // ---- tronco (quadril → peito → ombros → pescoço)
  if (hi || mid) {
    const rings = [
      { y: 0.88, x: 0, z: 0.0, rx: 0.160, rz: 0.108 },
      { y: 1.20, x: 0, z: 0.012, rx: 0.172, rz: 0.118 },
      { y: 1.405, x: 0, z: 0.0, rx: 0.200, rz: 0.100 },
    ];
    if (hi) B.prism(rings, 6, 1, { apex: [0, 1.50, -0.005] });
    else B.prism(rings, 6, 1, { capTop: true });
  } else {
    if (lo) {
      B.prism([
        { y: 0.88, x: 0, z: 0.0, rx: 0.2, rz: 0.14 },
        { y: 1.41, x: 0, z: 0.0, rx: 0.26, rz: 0.13 },
      ], 4, 1, { a0: Math.PI / 4, capTop: true });
    } else {
      // baixa: cunha que fecha numa aresta nos ombros (sem tampa)
      B.prism([
        { y: 0.88, x: 0, z: 0.0, rx: 0.21, rz: 0.15 },
        { y: 1.45, x: 0, z: 0.0, rx: 0.27, rz: 0.012 },
      ], 4, 1, { a0: Math.PI / 4 });
    }
  }

  // ---- braços
  for (const side of [1, -1]) {
    const up = side > 0 ? 4 : 6, fo = side > 0 ? 5 : 7;
    const S = J.shoulder, E = J.elbow, W = J.wrist, H = J.handTip;
    const sx = (p) => p[0] * side;
    if (min) {
      // braço inteiro num segmento só (sem cotovelo)
      B.prism([
        { y: S[1] + 0.02, x: sx(S), z: S[2], rx: 0.07, rz: 0.07 },
        { y: H[1] + 0.03, x: sx(H), z: H[2], rx: 0.05, rz: 0.05 },
      ], 3, up, { a0: side > 0 ? 0 : Math.PI });
      continue;
    }
    const sides = hi ? 4 : 3, a0 = hi ? Math.PI / 4 : (side > 0 ? 0 : Math.PI);
    B.prism([
      { y: S[1] + 0.03, x: sx(S), z: S[2], rx: 0.066, rz: 0.064 },
      { y: E[1], x: sx(E), z: E[2], rx: 0.054, rz: 0.054 },
    ], sides, up, { a0 });
    B.prism([
      { y: E[1] + 0.02, x: sx(E), z: E[2], rx: 0.052, rz: 0.05 },
      { y: H[1], x: sx(H), z: H[2], rx: 0.042, rz: 0.034 },
    ], sides, fo, { a0, capBot: hi || mid });
  }

  // ---- pernas: coxa (gira no quadril) + canela (gira no joelho)
  if (!min) {
    for (const side of [1, -1]) {
      const Hp = J.hip, K = J.knee, A = J.ankle;
      const a0 = hi ? Math.PI / 4 : Math.PI / 2, sides = hi ? 4 : 3;
      B.prism([
        { y: Hp[1], x: Hp[0] * side, z: Hp[2], rx: 0.088, rz: 0.09 },
        { y: K[1] - 0.03, x: K[0] * side, z: K[2], rx: 0.066, rz: 0.07 },
      ], sides, side > 0 ? 8 : 9, { a0 });
      B.prism([
        { y: K[1] + 0.02, x: K[0] * side, z: K[2], rx: 0.06, rz: 0.064 },
        { y: A[1], x: A[0] * side, z: A[2] + 0.03, rx: 0.05, rz: 0.085 },
      ], 3, side > 0 ? 10 : 11, { a0: Math.PI / 2 });
    }
  }
  return B.build();
}

// Cachecol: faixa com `seg` segmentos. position.x = u (0..1 ao longo), position.y = lado (0/1).
export function buildScarfGeometry(seg = 6) {
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) pos.push(i / seg, 0, 0, i / seg, 1, 0);
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(0), 3));
  g.setIndex(idx);
  return g;
}

export function triCount(g) { return g.index ? g.index.count / 3 : g.attributes.position.count / 3; }
