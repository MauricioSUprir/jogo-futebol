// Terreno do Rio: relevo Copernicus 30 m + imagem Sentinel-2, em blocos com LOD.
// Água (baía, oceano e lagoas) com ondas animadas e reflexo do céu; luzes da cidade à noite.
import * as THREE from 'three';
import { registerMaterial } from './materials.js';

const CH = 64;   // células por bloco (64 × 31,25 m = 2 km)

export async function decodePNG(url) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  bmp.close?.();
  return { w: cv.width, h: cv.height, px };
}

export class Terrain {
  constructor(scene, meta, hImg, farImg, maskImg, farWaterImg, tex, tier) {
    this.scene = scene; this.meta = meta; this.tier = tier;
    const N = meta.nearN, S = N + 1;
    this.N = N; this.S = S;
    this.size = meta.nearSize; this.half = this.size / 2; this.cell = this.size / N;
    const H = new Float32Array(S * S);
    for (let i = 0, p = 0; i < S * S; i++, p += 4) H[i] = meta.nearMin + ((hImg.px[p] << 8) | hImg.px[p + 1]) * meta.nearScale;
    this.H = H;
    // máscara de água (R) e urbana (G), 2048²
    this.mask = maskImg;
    // horizonte
    const FS = meta.farN + 1;
    this.farS = FS; this.farCell = meta.farSize / meta.farN; this.farHalf = meta.farSize / 2;
    this.FH = new Float32Array(FS * FS);
    for (let i = 0, p = 0; i < FS * FS; i++, p += 4) this.FH[i] = meta.farMin + ((farImg.px[p] << 8) | farImg.px[p + 1]) * meta.farScale;
    this.farWater = farWaterImg;

    // normais por pixel (RG) a partir do relevo
    const nd = new Uint8Array(S * S * 4);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const hl = H[j * S + Math.max(i - 1, 0)], hr = H[j * S + Math.min(i + 1, N)];
      const hu = H[Math.max(j - 1, 0) * S + i], hd = H[Math.min(j + 1, N) * S + i];
      let nx = (hl - hr) / (2 * this.cell), nz = (hu - hd) / (2 * this.cell);
      const l = Math.hypot(nx, 1, nz); nx /= l; nz /= l;
      const o = (j * S + i) * 4;
      nd[o] = (nx * 0.5 + 0.5) * 255; nd[o + 1] = (nz * 0.5 + 0.5) * 255; nd[o + 3] = 255;
    }
    this.normalTex = new THREE.DataTexture(nd, S, S, THREE.RGBAFormat);
    this.normalTex.minFilter = THREE.LinearMipmapLinearFilter; this.normalTex.magFilter = THREE.LinearFilter;
    this.normalTex.generateMipmaps = true; this.normalTex.needsUpdate = true;

    this.tex = tex;
    this.material = this._material();
    this.nc = N / CH;
    this.chunks = [];
    for (let cz = 0; cz < this.nc; cz++) for (let cx = 0; cx < this.nc; cx++) {
      const mesh = new THREE.Mesh(undefined, this.material);
      mesh.receiveShadow = true; mesh.castShadow = true; mesh.matrixAutoUpdate = false; mesh.visible = false;
      let lo = Infinity, hi = -Infinity;
      for (let z = cz * CH; z <= cz * CH + CH; z += 2) for (let x = cx * CH; x <= cx * CH + CH; x += 2) { const h = H[z * S + x]; lo = Math.min(lo, h); hi = Math.max(hi, h); }
      this.chunks.push({ cx, cz, mesh, lod: -1, geos: [], used: [], x0: cx * CH * this.cell - this.half, z0: cz * CH * this.cell - this.half, minY: lo - 40, maxY: hi + 2 });
      scene.add(mesh);
    }
    this._buildFar();
  }

  // altura exatamente sobre os triângulos da malha (a física e o visual concordam)
  heightAt(x, z) {
    const fx = (x + this.half) / this.cell, fz = (z + this.half) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.N || fz >= this.N) return this.farHeightAt(x, z);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const S = this.S, H = this.H, o = iz * S + ix;
    const a = H[o], b = H[o + 1], c = H[o + S], d = H[o + S + 1];
    return tx + tz <= 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }
  farHeightAt(x, z) {
    const fx = THREE.MathUtils.clamp((x + this.farHalf) / this.farCell, 0, this.farS - 1.001);
    const fz = THREE.MathUtils.clamp((z + this.farHalf) / this.farCell, 0, this.farS - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, S = this.farS, o = iz * S + ix, F = this.FH;
    return (F[o] * (1 - tx) + F[o + 1] * tx) * (1 - tz) + (F[o + S] * (1 - tx) + F[o + S + 1] * tx) * tz;
  }
  isWater(x, z) {
    const m = this.mask;
    const u = (x + this.half) / this.size, v = (z + this.half) / this.size;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) {
      const fw = this.farWater, fu = (x + this.farHalf) / (this.farHalf * 2), fv = (z + this.farHalf) / (this.farHalf * 2);
      if (fu < 0 || fv < 0 || fu >= 1 || fv >= 1) return true;
      return fw.px[(Math.floor(fv * fw.h) * fw.w + Math.floor(fu * fw.w)) * 4] > 127;
    }
    return m.px[(Math.floor(v * m.h) * m.w + Math.floor(u * m.w)) * 4] > 127;
  }
  urbanAt(x, z) {
    const m = this.mask, u = (x + this.half) / this.size, v = (z + this.half) / this.size;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
    return m.px[(Math.floor(v * m.h) * m.w + Math.floor(u * m.w)) * 4 + 1] / 255;
  }

  _geometry(c, lod) {
    if (c.geos[lod]) return c.geos[lod];
    const s = 1 << lod, n = CH / s, S = this.S, H = this.H, N = this.N, cell = this.cell;
    const vcount = (n + 1) * (n + 1) + 4 * (n + 1);
    const pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3);
    const hAt = (x, z) => H[Math.min(Math.max(z, 0), N) * S + Math.min(Math.max(x, 0), N)];
    let v = 0;
    const bx = c.cx * CH, bz = c.cz * CH;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = bx + i * s, z = bz + j * s;
      pos[v * 3] = x * cell - this.half; pos[v * 3 + 1] = hAt(x, z); pos[v * 3 + 2] = z * cell - this.half;
      const nx = hAt(x - s, z) - hAt(x + s, z), nz = hAt(x, z - s) - hAt(x, z + s), ny = 2 * s * cell, l = Math.hypot(nx, ny, nz);
      nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l; v++;
    }
    const skirt = 8 + s * 6;
    const add = (i, j) => { const src = j * (n + 1) + i; pos[v * 3] = pos[src * 3]; pos[v * 3 + 1] = pos[src * 3 + 1] - skirt; pos[v * 3 + 2] = pos[src * 3 + 2]; nor[v * 3 + 1] = 1; return v++; };
    const top = [], bot = [], left = [], right = [];
    for (let i = 0; i <= n; i++) { top.push([i, add(i, 0)]); bot.push([i, add(i, n)]); }
    for (let j = 0; j <= n; j++) { left.push([j, add(0, j)]); right.push([j, add(n, j)]); }
    const idx = new (vcount > 65535 ? Uint32Array : Uint16Array)(n * n * 6 + 4 * n * 6);
    let k = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, cc = a + n + 1, d = cc + 1;
      idx[k++] = a; idx[k++] = cc; idx[k++] = b; idx[k++] = b; idx[k++] = cc; idx[k++] = d;
    }
    const strip = (list, main, flip) => { for (let q = 0; q < n; q++) { const m0 = main(list[q][0]), m1 = main(list[q + 1][0]), s0 = list[q][1], s1 = list[q + 1][1]; if (flip) { idx[k++] = m0; idx[k++] = s0; idx[k++] = m1; idx[k++] = m1; idx[k++] = s0; idx[k++] = s1; } else { idx[k++] = m0; idx[k++] = m1; idx[k++] = s0; idx[k++] = m1; idx[k++] = s1; idx[k++] = s0; } } };
    strip(top, (i) => i, false); strip(bot, (i) => n * (n + 1) + i, true); strip(left, (j) => j * (n + 1), true); strip(right, (j) => j * (n + 1) + n, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const W = CH * cell;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(c.x0, c.minY, c.z0), new THREE.Vector3(c.x0 + W, c.maxY, c.z0 + W));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    c.geos[lod] = g;
    return g;
  }

  update(focus, now) {
    const L = this.tier.lodDist, W = CH * this.cell;
    for (const c of this.chunks) {
      const dx = Math.max(c.x0 - focus.x, 0, focus.x - (c.x0 + W));
      const dz = Math.max(c.z0 - focus.z, 0, focus.z - (c.z0 + W));
      const dy = Math.max(c.minY - focus.y, 0, focus.y - c.maxY);
      const d = Math.hypot(dx, dz, dy);
      let lod = d < L ? 0 : d < 2 * L ? 1 : d < 4 * L ? 2 : d < 8 * L ? 3 : 4;
      lod = Math.max(lod, this.tier.minLod);
      if (lod !== c.lod) { c.mesh.geometry = this._geometry(c, lod); c.lod = lod; }
      c.used[lod] = now; c.mesh.visible = true;
      c.mesh.castShadow = d < this.tier.shadowFar;
      for (let l = 0; l < c.geos.length; l++) if (l !== lod && c.geos[l] && now - (c.used[l] || 0) > 20) { c.geos[l].dispose(); c.geos[l] = null; }
    }
  }

  _buildFar() {
    const m = this.meta, st = this.tier.farStep;
    const n = m.farN / st, res = this.farCell * st, S = n + 1, half = m.farSize / 2, hN = this.half;
    const pos = new Float32Array(S * S * 3);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = i * res - half, z = j * res - half;
      let y = this.farHeightAt(x, z);
      const out = Math.hypot(Math.max(Math.abs(x) - hN, 0), Math.max(Math.abs(z) - hN, 0));
      if (out === 0) y = this.heightAt(Math.min(Math.max(x, -hN + 1), hN - 1), Math.min(Math.max(z, -hN + 1), hN - 1)) - 30;
      else if (out < 600) y = THREE.MathUtils.lerp(this.heightAt(Math.min(Math.max(x, -hN + 1), hN - 1), Math.min(Math.max(z, -hN + 1), hN - 1)), y, out / 600);
      const v = (j * S + i) * 3; pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
    }
    const idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x0 = i * res - half, z0 = j * res - half;
      if (x0 >= -hN && x0 + res <= hN && z0 >= -hN && z0 + res <= hN) continue;
      const a = j * S + i, b = a + 1, c = a + S, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const t = this;
    const mat = registerMaterial(new THREE.MeshStandardMaterial({ roughness: 0.95 }), (sh) => {
      sh.uniforms.tSat = { value: t.tex.satFar }; sh.uniforms.tFW = { value: t.tex.farWater }; sh.uniforms.uFarHalf = { value: half };
      sh.uniforms.tWaterN = { value: t.tex.waterN };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform sampler2D tSat; uniform sampler2D tFW; uniform sampler2D tWaterN; uniform float uFarHalf;')
        .replace('#include <map_fragment>', `
          vec2 fuv = ( vWPos.xz + uFarHalf ) / ( 2.0 * uFarHalf );
          float fw = texture( tFW, fuv ).r;
          diffuseColor.rgb *= texture( tSat, fuv ).rgb;`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix( 0.95, 0.12, fw );')
        .replace('#include <normal_fragment_maps>', `
          if ( fw > 0.5 ) {
            vec3 wn = texture( tWaterN, vWPos.xz / 220.0 + uTime * 0.004 ).xyz * 2.0 - 1.0;
            normal = normalize( ( viewMatrix * vec4( normalize( vec3( wn.x * 0.25, 1.0, wn.y * 0.25 ) ), 0.0 ) ).xyz );
          }`);
    }, 'far', { shadows: false });
    this.far = new THREE.Mesh(g, mat);
    this.scene.add(this.far);
  }

  _material() {
    const t = this;
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    return registerMaterial(mat, (sh) => {
      Object.assign(sh.uniforms, {
        tSat: { value: t.tex.sat }, tMask: { value: t.tex.mask }, tMacroN: { value: t.normalTex },
        tDetail: { value: t.tex.detailLum }, tDetailN: { value: t.tex.detailN }, tWaterN: { value: t.tex.waterN },
        uHalf: { value: t.half }, uSize: { value: t.size },
      });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + PARS)
        .replace('#include <map_fragment>', SPLAT)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
        .replace('#include <normal_fragment_maps>', 'normal = normalize( ( viewMatrix * vec4( tN, 0.0 ) ).xyz );')
        .replace('#include <emissivemap_fragment>', `
          // luzes da cidade à noite: pontos de iluminação pública nas áreas urbanas
          {
            vec2 cellId = floor( vWPos.xz / 22.0 );
            float hsh = fract( sin( dot( cellId, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
            vec2 f = fract( vWPos.xz / 22.0 ) - 0.5;
            float dotL = smoothstep( 0.22, 0.0, length( f ) ) * step( 0.45, hsh );
            float far = smoothstep( 800.0, 5000.0, tDist );
            float lights = mix( dotL * 2.5, 0.35, far ) * urb * ( 1.0 - water );
            vec3 lampCol = mix( vec3( 1.0, 0.62, 0.28 ), vec3( 0.9, 0.95, 1.0 ), step( 0.8, hsh ) );
            totalEmissiveRadiance += lampCol * lights * uNight * 1.6;
          }`);
    }, 'terrain');
  }
}

const PARS = /* glsl */`
varying vec3 vWPos;
uniform sampler2D tSat; uniform sampler2D tMask; uniform sampler2D tMacroN;
uniform sampler2D tDetail; uniform sampler2D tDetailN; uniform sampler2D tWaterN;
uniform float uHalf; uniform float uSize;
`;
const SPLAT = /* glsl */`
  vec2 muv = ( vWPos.xz + uHalf ) / uSize;
  vec3 sat = texture( tSat, muv ).rgb;
  vec3 mk = texture( tMask, muv ).rgb;
  float water = smoothstep( 0.35, 0.65, mk.r );
  float urb = mk.g;
  vec2 mn = texture( tMacroN, muv ).rg * 2.0 - 1.0;
  vec3 Nm = normalize( vec3( mn.x, sqrt( max( 1.0 - dot( mn, mn ), 0.0 ) ), mn.y ) );
  float tDist = length( vWPos - cameraPosition );

  // detalhe de perto (texturas CC0): mantém a cor do satélite e acrescenta grão
  float near = 1.0 - smoothstep( 150.0, 1400.0, tDist );
  vec3 dl = texture( tDetail, vWPos.xz / 6.0 ).rgb * 2.0;
  vec3 dl2 = texture( tDetail, vWPos.xz / 41.0 ).rgb * 2.0;
  float veg = smoothstep( 0.02, 0.07, sat.g - ( sat.r + sat.b ) * 0.5 );
  float det = mix( mix( dl.g, dl.r, veg ), mix( dl2.g, dl2.r, veg ), 0.4 );
  // a imagem Sentinel é um pouco escura como albedo: realça levemente e abre as sombras
  vec3 land = pow( sat, vec3( 0.92 ) ) * 1.18 * mix( 1.0, det, near * 0.55 );

  // água: cor escura + ondas; o reflexo vem do céu (IBL) e do Sol
  vec2 w1 = vWPos.xz / 38.0 + vec2( uTime * 0.018, uTime * 0.011 );
  vec2 w2 = vWPos.xz / 97.0 - vec2( uTime * 0.007, uTime * 0.015 );
  vec3 wn = ( texture( tWaterN, w1 ).xyz * 2.0 - 1.0 ) + ( texture( tWaterN, w2 ).xyz * 2.0 - 1.0 );
  // anti-serrilhado da água: quanto mais metros por pixel, mais lisa (e mais fosca) ela fica
  float mpp = length( fwidth( vWPos.xz ) );
  float wAA = smoothstep( 0.4, 6.0, mpp );
  float calm = mix( 0.35, 0.12, smoothstep( 300.0, 6000.0, tDist ) ) * ( 1.0 - 0.85 * wAA );
  vec3 Nw = normalize( vec3( wn.x * calm, 1.0, wn.y * calm ) );
  vec3 waterCol = mix( vec3( 0.012, 0.035, 0.045 ), sat * 0.55, 0.45 );

  diffuseColor.rgb *= mix( land, waterCol, water );

  vec3 dn = texture( tDetailN, vWPos.xz / 9.0 ).xyz * 2.0 - 1.0;
  dn.xy *= near * 0.6;
  vec3 Nl = normalize( vec3( Nm.x + dn.x, Nm.y * dn.z, Nm.z + dn.y ) );
  vec3 tN = normalize( mix( Nl, Nw, water ) );
  float tRough = mix( 0.93, mix( 0.04, 0.14, smoothstep( 500.0, 8000.0, tDist ) ) + 0.2 * wAA, water );
`;
