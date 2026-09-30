// Estádio: acumulador de geometria com cor por vértice (não indexada). Várias peças
// (vigas, caixas, perfis varridos) viram UMA malha — poucos draw calls.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _x = new THREE.Vector3(1, 0, 0);

export class Parts {
  // alpha = true: cor com 4 componentes (vidros translúcidos com opacidade por peça)
  constructor(alpha = false) {
    this.alpha = alpha;
    this.pos = []; this.nor = []; this.col = [];
  }

  get count() { return this.pos.length / 3; }

  // junta uma geometria qualquer (índices são expandidos) com cor única
  addGeo(geo, color, matrix, a = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) g.applyMatrix4(matrix);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    const c = color.isColor ? color : new THREE.Color(color);
    const cnt = p.length / 3;
    for (let i = 0; i < cnt; i++) {
      this.col.push(c.r, c.g, c.b);
      if (this.alpha) this.col.push(a);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }

  // caixa (w, h, d) com transformação
  box(w, h, d, color, matrix, a = 1) {
    this.addGeo(new THREE.BoxGeometry(w, h, d), color, matrix, a);
  }

  // viga de seção retangular entre dois pontos (só as 4 faces laterais)
  beam(a, b, w, h, color, alpha = 1) {
    const dir = _v.subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return;
    const up = Math.abs(dir.y / len) > 0.95 ? _x : _up;
    _m.lookAt(a, b, up);
    const hx = w / 2, hy = h / 2;
    // cantos no espaço local (z ao longo da viga)
    const corners = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
    const c = color.isColor ? color : new THREE.Color(color);
    const e = _m.elements;
    const tx = (x, y, z) => [
      e[0] * x + e[4] * y + e[8] * z, e[1] * x + e[5] * y + e[9] * z, e[2] * x + e[6] * y + e[10] * z];
    const base = [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2];
    for (let i = 0; i < 4; i++) {
      const c0 = corners[i], c1 = corners[(i + 1) % 4];
      const nx = (c0[0] + c1[0]) / 2, ny = (c0[1] + c1[1]) / 2;
      const nl = Math.hypot(nx, ny) || 1;
      const n = tx(nx / nl, ny / nl, 0);
      const q = [tx(c0[0], c0[1], -len / 2), tx(c1[0], c1[1], -len / 2), tx(c1[0], c1[1], len / 2), tx(c0[0], c0[1], len / 2)];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        this.pos.push(base[0] + q[k][0], base[1] + q[k][1], base[2] + q[k][2]);
        this.nor.push(n[0], n[1], n[2]);
        this.col.push(c.r, c.g, c.b);
        if (this.alpha) this.col.push(alpha);
      }
    }
  }

  // quad (4 pontos em ordem anti-horária vista da frente)
  quad(p0, p1, p2, p3, color, a = 1) {
    const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0)).normalize();
    const c = color.isColor ? color : new THREE.Color(color);
    for (const p of [p0, p1, p2, p0, p2, p3]) {
      this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.col.push(c.r, c.g, c.b);
      if (this.alpha) this.col.push(a);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, this.alpha ? 4 : 3));
    g.computeBoundingSphere();
    this.pos = this.nor = this.col = null;
    return g;
  }
}

// ruído de valor determinístico (para variações na construção)
export function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
