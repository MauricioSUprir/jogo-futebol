// Rochas: formas facetadas procedurais (como basaltos e ventifactos de Jezero),
// distribuídas pela rugosidade real do relevo, com colisão convexa e LOD por instância.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerMaterial } from './materials.js';

// ruído 3D simples e determinístico
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let k = 0; k < 8; k++) {
    const dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1;
    r += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return r * 2 - 1;
}
function fbm(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); a *= 0.5; f *= 2.1; }
  return s;
}
export function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function rockGeometry(seed, detail) {
  const rnd = mulberry(seed * 9973 + 17);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const planes = [];
  const np = 5 + Math.floor(rnd() * 5);
  for (let i = 0; i < np; i++) {
    const n = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.4 - 0.4, rnd() * 2 - 1).normalize();
    planes.push([n, 0.62 + rnd() * 0.25]);
  }
  const flat = 0.5 + rnd() * 0.35;
  const stretch = 0.8 + rnd() * 0.5;
  const o = rnd() * 100;
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = 1 + fbm(v.x * 1.4 + o, v.y * 1.4, v.z * 1.4) * 0.32 + fbm(v.x * 5 + o, v.y * 5, v.z * 5, 2) * 0.05;
    v.multiplyScalar(r);
    for (const [n, off] of planes) { const d = v.dot(n) - off; if (d > 0) v.addScaledVector(n, -d * 0.92); }
    v.x *= stretch; v.y *= flat;
    if (v.y < -0.35 * flat) v.y = -0.35 * flat + (v.y + 0.35 * flat) * 0.3;   // base achatada (enterrada)
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = g.toNonIndexed();            // arestas vivas: normais por face ficam mais "rocha"
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export class Rocks {
  constructor(scene, terrain, physics, maskImg, rockTex, tier, avoid = []) {
    this.scene = scene; this.terrain = terrain; this.tier = tier;
    const VAR = 8;
    this.variants = [];
    for (let i = 0; i < VAR; i++) {
      const hi = rockGeometry(i + 1, tier.rockNear > 60 ? 4 : 3);
      const lo = rockGeometry(i + 1, 1);
      // o casco convexo de colisão usa os pontos da versão simplificada
      this.variants.push({ hi, lo, hull: lo.attributes.position.array });
    }
    this.material = this._material(rockTex);

    // --- distribuição: densidade pela máscara de rocha real (2 m)
    const rnd = mulberry(1971);
    const mw = maskImg.w, mpx = maskImg.px;
    const half = terrain.half;
    const list = [];
    const dens = tier.rockDensity;
    for (let j = 1; j < mw - 1; j++) {
      for (let i = 1; i < mw - 1; i++) {
        const o = (j * mw + i) * 4;
        const rock = mpx[o] / 255, sand = mpx[o + 1] / 255;
        const p = dens * (0.0012 + Math.pow(rock, 1.1) * 0.07 + (1 - sand) * 0.004);
        if (rnd() > p) continue;
        const x = i * 2 - half + rnd() * 2, z = j * 2 - half + rnd() * 2;
        if (!terrain.inside(x, z, 10)) continue;
        // lei de potência: muitas pequenas, poucas grandes; maiores nas áreas rochosas
        const u = rnd();
        let s = 0.14 * Math.pow(1 - u * 0.999, -1 / (1.8 - rock * 0.5));
        s = Math.min(s, 0.9 + rock * 2.6);
        let skip = false;
        for (const a of avoid) if (Math.hypot(x - a.x, z - a.z) < a.r + s) { skip = true; break; }
        if (skip) continue;
        list.push({ x, z, s, v: Math.floor(rnd() * VAR), yaw: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.35, sy: 0.75 + rnd() * 0.5 });
      }
    }
    this.list = list;

    // --- matrizes e colisores
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    let colliders = 0;
    for (const r of list) {
      const y = terrain.heightAt(r.x, r.z);
      terrain.normalAt(r.x, r.z, nrm);
      // alinha levemente com a encosta
      const qa = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
      q.setFromEuler(e.set(r.tilt, r.yaw, r.tilt * 0.5)).premultiply(qa.slerp(new THREE.Quaternion(), 0.4));
      sc.set(r.s, r.s * r.sy, r.s);
      pos.set(r.x, y - r.s * r.sy * 0.18, r.z);
      r.m = m.compose(pos, q, sc).clone();
      if (r.s > 0.28) {
        const src = this.variants[r.v].hull;
        const pts = new Float32Array(src.length);
        for (let k = 0; k < src.length; k += 3) { pts[k] = src[k] * sc.x; pts[k + 1] = src[k + 1] * sc.y; pts[k + 2] = src[k + 2] * sc.z; }
        if (physics.addConvex(pts, pos, { x: q.x, y: q.y, z: q.z, w: q.w })) colliders++;
      }
    }
    this.colliders = colliders;

    // --- malhas instanciadas por variante (perto: detalhada; longe: simples)
    const count = new Array(VAR).fill(0);
    for (const r of list) count[r.v]++;
    this.near = []; this.farM = [];
    for (let i = 0; i < VAR; i++) {
      const a = new THREE.InstancedMesh(this.variants[i].hi, this.material, Math.max(count[i], 1));
      const b = new THREE.InstancedMesh(this.variants[i].lo, this.material, Math.max(count[i], 1));
      for (const im of [a, b]) { im.castShadow = true; im.receiveShadow = true; im.count = 0; im.frustumCulled = false; scene.add(im); }
      this.near.push(a); this.farM.push(b);
    }
    this._last = new THREE.Vector3(1e9, 0, 1e9);
  }

  update(focus) {
    if (this._last.distanceToSquared(focus) < 36) return;
    this._last.copy(focus);
    const t = this.tier;
    const nN = this.near.map(() => 0), nF = this.farM.map(() => 0);
    const n2 = t.rockNear * t.rockNear, m2 = t.rockMid * t.rockMid, f2 = t.rockFar * t.rockFar;
    for (const r of this.list) {
      const dx = r.x - focus.x, dz = r.z - focus.z, d2 = dx * dx + dz * dz;
      if (d2 < n2) this.near[r.v].setMatrixAt(nN[r.v]++, r.m);
      else if ((d2 < m2 && r.s > 0.3) || (d2 < f2 && r.s > 0.9)) this.farM[r.v].setMatrixAt(nF[r.v]++, r.m);
    }
    this.near.forEach((im, i) => { im.count = nN[i]; im.instanceMatrix.needsUpdate = true; });
    this.farM.forEach((im, i) => { im.count = nF[i]; im.instanceMatrix.needsUpdate = true; });
  }

  _material(tex) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
    registerMaterial(mat, (sh) => {
      sh.uniforms.tRockA = { value: tex.albedo };
      sh.uniforms.tRockO = { value: tex.orm };
      sh.uniforms.tRockN = { value: tex.normal };
      sh.uniforms.tDustA = { value: tex.dust };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjN;\nvarying mat3 vNormalMat;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 isc = vec3( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ), length( instanceMatrix[2].xyz ) );
            vObjPos = position * isc + vec3( instanceMatrix[3].x * 0.37, 0.0, instanceMatrix[3].z * 0.29 );
          #else
            vObjPos = position;
          #endif
          vObjN = normal;
          #ifdef USE_INSTANCING
            vNormalMat = normalMatrix * mat3( normalize( instanceMatrix[0].xyz ), normalize( instanceMatrix[1].xyz ), normalize( instanceMatrix[2].xyz ) );
          #else
            vNormalMat = normalMatrix;
          #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vObjPos; varying vec3 vObjN; varying mat3 vNormalMat;
          uniform sampler2D tRockN; uniform sampler2D tRockA; uniform sampler2D tRockO; uniform sampler2D tDustA;
          vec3 triW( vec3 n ) { vec3 w = pow( abs( n ), vec3( 4.0 ) ); return w / ( w.x + w.y + w.z ); }`)
        .replace('#include <map_fragment>', `
          vec3 tw = triW( vObjN );
          vec3 tp = vObjPos / 1.6;
          vec3 rA = texture( tRockA, tp.zy ).rgb * tw.x + texture( tRockA, tp.xz ).rgb * tw.y + texture( tRockA, tp.xy ).rgb * tw.z;
          vec4 rO = texture( tRockO, tp.zy ) * tw.x + texture( tRockO, tp.xz ) * tw.y + texture( tRockO, tp.xy ) * tw.z;
          diffuseColor.rgb *= rA;
          `)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix( 0.68, 0.95, rO.g );')
        .replace('#include <normal_fragment_maps>', `
          // detalhe fino: normal map em projeção tripla (espaço do objeto), reorientado
          // para a câmera pela base tangente derivada da própria superfície
          {
            vec3 n0 = normalize( vObjN );
            vec3 nX = texture( tRockN, tp.zy ).xyz * 2.0 - 1.0;
            vec3 nY = texture( tRockN, tp.xz ).xyz * 2.0 - 1.0;
            vec3 nZ = texture( tRockN, tp.xy ).xyz * 2.0 - 1.0;
            // "whiteout" por eixo, resultado no espaço do objeto
            vec3 ox = vec3( n0.x, n0.y + nX.y, n0.z + nX.x );
            vec3 oy = vec3( n0.x + nY.x, n0.y, n0.z + nY.y );
            vec3 oz = vec3( n0.x + nZ.x, n0.y + nZ.y, n0.z );
            vec3 objN = normalize( ox * tw.x + oy * tw.y + oz * tw.z );
            vec3 delta = objN - n0;
            // leva a perturbação ao espaço da câmera pela matriz normal da instância
            normal = normalize( normal + vNormalMat * delta * 0.8 );
          }
          // poeira assentada nas faces de cima
          vec3 wN = ( vec4( normal, 0.0 ) * viewMatrix ).xyz;
          float dustAmt = smoothstep( 0.45, 0.92, wN.y ) * 0.75;
          vec3 dustC = texture( tDustA, vObjPos.xz / 2.3 ).rgb;
          diffuseColor.rgb = mix( diffuseColor.rgb, dustC, dustAmt );`)
        .replace('#include <aomap_fragment>', `
          float rAO = mix( 1.0, rO.r, 0.8 );
          reflectedLight.indirectDiffuse *= rAO; reflectedLight.indirectSpecular *= rAO;`);
    }, 'rock');
    return mat;
  }
}
