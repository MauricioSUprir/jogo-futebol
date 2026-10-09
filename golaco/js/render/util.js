// Utilidades do desenho (three.js): junção de geometrias, ruído determinístico e canvas.
import * as THREE from 'three';

/** Hash inteiro → [0, 1). Determinístico (as texturas saem iguais em toda abertura). */
export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Gerador simples com semente para enfeites (nunca usado na lógica do jogo). */
export function gerador(semente) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído de valor 2D periódico (período px, py em células). */
export function ruido(x, y, px, py, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
  const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
  const a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function criarCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** CanvasTexture com mipmaps, anisotropia e espaço de cor sRGB (cor) ou linear (dados). */
export function texturaCanvas(canvas, { repetir = false, aniso = 1, cor = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (repetir) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

/**
 * Junta geometrias (com ou sem índice) numa só, mantendo os atributos que TODAS têm.
 * Cores por geometria opcionais: cores[i] = THREE.Color → vira atributo 'color'.
 */
export function juntarGeometrias(geos, cores = null) {
  const lista = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const nomes = Object.keys(lista[0].attributes).filter(n => lista.every(g => g.attributes[n]));
  let total = 0;
  for (const g of lista) total += g.attributes.position.count;
  const saida = new THREE.BufferGeometry();
  for (const n of nomes) {
    const tam = lista[0].attributes[n].itemSize;
    const arr = new Float32Array(total * tam);
    let o = 0;
    for (const g of lista) {
      const a = g.attributes[n];
      for (let i = 0; i < a.count; i++) for (let k = 0; k < tam; k++) arr[o++] = a.getComponent(i, k);
    }
    saida.setAttribute(n, new THREE.BufferAttribute(arr, tam));
  }
  if (cores) {
    const arr = new Float32Array(total * 3);
    let o = 0;
    lista.forEach((g, i) => {
      const c = cores[i];
      for (let k = 0; k < g.attributes.position.count; k++) { arr[o++] = c.r; arr[o++] = c.g; arr[o++] = c.b; }
    });
    saida.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  saida.computeBoundingSphere();
  return saida;
}

/** Cilindro entre dois pontos (para traves, mastros, estruturas). */
export function cilindroEntre(a, b, raio, segs = 12) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(raio, raio, len, segs, 1, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate(va.x, va.y, va.z);
  return g;
}

/** Caixa com centro e tamanho. */
export function caixa(cx, cy, cz, sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(cx, cy, cz);
  return g;
}

/** Mola crítica exata (estável com qualquer dt). Devolve [x, v]. Daniel Holden, "Spring-It-On". */
export function molaCritica(x, v, alvo, w, dt) {
  const y = x - alvo;
  const j1 = v + y * w;
  const e = Math.exp(-w * dt);
  return [alvo + (y + j1 * dt) * e, (v - j1 * w * dt) * e];
}
