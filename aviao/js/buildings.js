// Prédios: gerados sobre a mancha urbana real (imagem de satélite), mais altos no Centro,
// em Copacabana, Botafogo e Niterói. Fachadas com janelas procedurais que acendem à noite.
import * as THREE from 'three';
import { registerMaterial } from './materials.js';

const CHUNK = 2000;

export async function loadBuildings(url) {
  // os bytes vêm empacotados num PNG RGB sem perdas (3 bytes por pixel; os 4 primeiros = tamanho)
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
  const rgba = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const bytes = new Uint8Array(bmp.width * bmp.height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4) { bytes[j++] = rgba[i]; bytes[j++] = rgba[i + 1]; bytes[j++] = rgba[i + 2]; }
  const len = new DataView(bytes.buffer).getUint32(0, true);
  const buf = bytes.slice(4, 4 + len).buffer;
  return parseBuildings(buf);
}

function parseBuildings(buf) {
  const n = new Uint32Array(buf, 0, 1)[0];
  let o = 4;
  const x = new Int16Array(buf.slice(o, o + n * 2)); o += n * 2;
  const z = new Int16Array(buf.slice(o, o + n * 2)); o += n * 2;
  const w = new Uint8Array(buf, o, n); o += n;
  const d = new Uint8Array(buf, o, n); o += n;
  const h = new Uint16Array(buf.slice(o, o + n * 2)); o += n * 2;
  const r = new Uint8Array(buf, o, n); o += n;
  const rgb = new Uint8Array(buf, o, n * 3);
  const list = [];
  for (let i = 0; i < n; i++) list.push({ x: x[i], z: z[i], w: w[i] / 4, d: d[i] / 4, h: h[i] / 10, rot: r[i] / 255 * Math.PI, r: rgb[i * 3], g: rgb[i * 3 + 1], b: rgb[i * 3 + 2] });
  return list;
}

export class Buildings {
  constructor(scene, terrain, list, tier) {
    this.terrain = terrain; this.tier = tier; this.list = list;
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.material = this._material();
    // grade espacial para colisão
    this.grid = new Map();
    const chunks = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (const b of list) {
      // base: o ponto mais baixo sob o prédio, enterrado um pouco para não flutuar em encosta
      const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
      let base = Infinity;
      for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
        const lx = ax * b.w / 2, lz = az * b.d / 2;
        base = Math.min(base, terrain.heightAt(b.x + lx * cs + lz * sn, b.z - lx * sn + lz * cs));
      }
      b.base = base - 2; b.top = base + b.h;
      const key = Math.floor(b.x / CHUNK) + ',' + Math.floor(b.z / CHUNK);
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key).push(b);
      const gk = Math.floor(b.x / 100) + ',' + Math.floor(b.z / 100);
      if (!this.grid.has(gk)) this.grid.set(gk, []);
      this.grid.get(gk).push(b);
    }
    this.chunks = [];
    for (const [key, arr] of chunks) {
      const im = new THREE.InstancedMesh(geo, this.material, arr.length);
      let minY = Infinity, maxY = -Infinity;
      arr.forEach((b, i) => {
        q.setFromAxisAngle(up, b.rot);
        s.set(b.w, b.h + 2, b.d);
        p.set(b.x, b.base, b.z);
        im.setMatrixAt(i, m.compose(p, q, s));
        // telhado/paredes: tom claro da cidade, puxado da cor do satélite
        // paleta de fachadas cariocas: concreto, bege, cinza-azulado, terracota; puxa um pouco da cor do satélite
        const pal = [[0.72, 0.7, 0.66], [0.78, 0.72, 0.6], [0.6, 0.63, 0.66], [0.74, 0.62, 0.52], [0.85, 0.84, 0.8], [0.55, 0.52, 0.48]];
        const pc = pal[(Math.abs(b.x * 7 + b.z * 13) | 0) % pal.length];
        col.setRGB(pc[0], pc[1], pc[2]).lerp(new THREE.Color(b.r / 255, b.g / 255, b.b / 255), 0.3).multiplyScalar(0.8);
        if (b.h > 40) col.lerp(new THREE.Color(0.5, 0.55, 0.6), 0.35);
        im.setColorAt(i, col);
        minY = Math.min(minY, b.base); maxY = Math.max(maxY, b.top);
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere(); im.computeBoundingBox?.();
      const [kx, kz] = key.split(',').map(Number);
      this.chunks.push({ im, cx: (kx + 0.5) * CHUNK, cz: (kz + 0.5) * CHUNK, maxH: maxY - minY });
      scene.add(im);
    }
  }

  update(cam) {
    const D = this.tier.buildingDist;
    for (const c of this.chunks) {
      const d = Math.hypot(c.cx - cam.x, c.cz - cam.z) - CHUNK * 0.7;
      c.im.visible = d < D;
      c.im.castShadow = d < this.tier.shadowFar;
    }
  }

  // o ponto está dentro de algum prédio?
  hit(pt) {
    const gx = Math.floor(pt.x / 100), gz = Math.floor(pt.z / 100);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const arr = this.grid.get((gx + i) + ',' + (gz + j)); if (!arr) continue;
      for (const b of arr) {
        if (pt.y > b.top || pt.y < b.base) continue;
        const dx = pt.x - b.x, dz = pt.z - b.z, cs = Math.cos(b.rot), sn = Math.sin(b.rot);
        const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
        if (Math.abs(lx) < b.w / 2 && Math.abs(lz) < b.d / 2) return true;
      }
    }
    return false;
  }

  _material() {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.0 });
    return registerMaterial(mat, (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP; varying vec3 vBN; varying float vBH; varying float vSeed;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 isc = vec3( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ), length( instanceMatrix[2].xyz ) );
          vBP = position * isc;             // coordenadas locais em metros
          vBN = normal; vBH = isc.y;
          vSeed = fract( sin( dot( instanceMatrix[3].xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP; varying vec3 vBN; varying float vBH; varying float vSeed;')
        .replace('#include <map_fragment>', `
          float isRoof = step( 0.5, vBN.y );
          float along = abs( vBN.x ) > 0.5 ? vBP.z : vBP.x;
          float floorH = 3.0, winW = 3.2;
          vec2 cell = vec2( along / winW, ( vBP.y - 2.0 ) / floorH );
          vec2 f = fract( cell );
          float win = step( 0.18, f.x ) * step( f.x, 0.82 ) * step( 0.25, f.y ) * step( f.y, 0.8 ) * step( 1.0, vBP.y ) * step( vBP.y, vBH - 3.0 );
          win *= 1.0 - isRoof;
          // anti-moiré: longe, a grade de janelas vira um tom médio em vez de serrilhar
          float fw = max( fwidth( cell.x ), fwidth( cell.y ) );
          float farW = smoothstep( 0.25, 0.7, fw );
          win = mix( win, 0.38 * ( 1.0 - isRoof ), farW );
          vec3 wall = diffuseColor.rgb * ( 0.85 + 0.15 * vSeed );
          vec3 glass = mix( vec3( 0.08, 0.1, 0.12 ), vec3( 0.25, 0.32, 0.38 ), step( 0.5, vSeed ) );
          diffuseColor.rgb = mix( wall, glass, win );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 0.8, isRoof );
          float bWin = win;
          vec2 winId = floor( cell ) + vec2( vSeed * 97.0, vSeed * 13.0 );
          float lit = step( 0.62, fract( sin( dot( winId, vec2( 27.1, 61.7 ) ) ) * 9151.3 ) );`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix( 0.85, 0.15, bWin );')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = bWin * 0.3;')
        .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += vec3( 1.0, 0.78, 0.5 ) * bWin * lit * uNight * 1.4;');
    }, 'bld');
  }
}
