// Terreno: relevo real (HiRISE 1 m) em blocos com níveis de detalhe (LOD),
// material PBR com mistura por altura entre regolito, areia e rocha, e horizonte (CTX 20 m).
import * as THREE from 'three';
import { registerMaterial } from './materials.js';

const CH = 128;   // tamanho do bloco em metros

export async function decodeHeightPNG(url, onProgress) {
  const blob = await (await fetch(url)).blob();
  onProgress?.();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  bmp.close?.();
  return { w: cv.width, h: cv.height, px };
}

export class Terrain {
  /**
   * @param meta     meta.json
   * @param hImg     {w,h,px} altura de 1 m (R=byte alto, G=byte baixo)
   * @param maskImg  imagem RGB (rocha, areia, AO) a 2 m
   * @param farImg   {w,h,px} horizonte 20 m
   * @param tex      { alb, nrm, orm } DataArrayTextures (regolito, areia, rocha)
   */
  constructor(scene, meta, hImg, maskTex, farImg, tex, tier) {
    this.scene = scene;
    this.meta = meta;
    this.tier = tier;
    const N = meta.size;
    this.N = N;
    this.half = N / 2;
    const S = N + 1;
    this.S = S;

    // alturas em metros (0 = ponto mais baixo do mapa)
    const H = new Float32Array(S * S);
    const px = hImg.px;
    for (let i = 0, p = 0; i < S * S; i++, p += 4) H[i] = ((px[p] << 8) | px[p + 1]) * meta.scale;
    this.H = H;
    this.minY = 0; this.maxY = 65535 * meta.scale;

    // mapa de normais (RG = nx, nz) para iluminação por pixel mesmo nos blocos distantes
    const step = tier.normalRes;
    const NS = Math.floor(N / step) + 1;
    const nd = new Uint8Array(NS * NS * 4);
    for (let j = 0; j < NS; j++) {
      for (let i = 0; i < NS; i++) {
        const x = i * step, z = j * step;
        const hl = H[z * S + Math.max(x - step, 0)], hr = H[z * S + Math.min(x + step, N)];
        const hu = H[Math.max(z - step, 0) * S + x], hd = H[Math.min(z + step, N) * S + x];
        let nx = (hl - hr) / (2 * step), nz = (hu - hd) / (2 * step), ny = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; nz /= l;
        const o = (j * NS + i) * 4;
        nd[o] = Math.round((nx * 0.5 + 0.5) * 255); nd[o + 1] = Math.round((nz * 0.5 + 0.5) * 255);
        nd[o + 2] = 0; nd[o + 3] = 255;
      }
    }
    this.normalTex = new THREE.DataTexture(nd, NS, NS, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.normalTex.magFilter = THREE.LinearFilter;
    this.normalTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.normalTex.generateMipmaps = true;
    this.normalTex.wrapS = this.normalTex.wrapT = THREE.ClampToEdgeWrapping;
    this.normalTex.needsUpdate = true;

    this.maskTex = maskTex;
    this.tex = tex;
    this.material = this._makeMaterial(tier);

    // blocos
    this.nc = N / CH;
    this.chunks = [];
    for (let cz = 0; cz < this.nc; cz++) {
      for (let cx = 0; cx < this.nc; cx++) {
        const mesh = new THREE.Mesh(undefined, this.material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.visible = false;
        const c = { cx, cz, mesh, lod: -1, geos: [], lastUsed: [], x0: cx * CH - this.half, z0: cz * CH - this.half };
        let lo = Infinity, hi = -Infinity;
        for (let z = cz * CH; z <= cz * CH + CH; z += 4) for (let x = cx * CH; x <= cx * CH + CH; x += 4) {
          const h = H[z * S + x]; if (h < lo) lo = h; if (h > hi) hi = h;
        }
        c.minY = lo - 3; c.maxY = hi + 1;
        this.chunks.push(c);
        scene.add(mesh);
      }
    }
    this._buildFar(farImg);
    this._frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
    this._box = new THREE.Box3();
  }

  // altura bilinear em coordenadas do mundo (origem no centro do mapa)
  heightAt(x, z) {
    const N = this.N, S = this.S;
    const fx = THREE.MathUtils.clamp(x + this.half, 0, N - 1e-4);
    const fz = THREE.MathUtils.clamp(z + this.half, 0, N - 1e-4);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const H = this.H, o = iz * S + ix;
    const a = H[o], b = H[o + 1], c = H[o + S], d = H[o + S + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.75;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    const hu = this.heightAt(x, z - e), hd = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hu - hd).normalize();
  }
  inside(x, z, margin = 0) { return Math.abs(x) < this.half - margin && Math.abs(z) < this.half - margin; }

  // ---------------------------------------------------------------- geometria de um bloco
  _geometry(c, lod) {
    if (c.geos[lod]) return c.geos[lod];
    const s = 1 << lod;               // passo em metros
    const n = CH / s;
    const S = this.S, H = this.H;
    const vcount = (n + 1) * (n + 1) + 4 * (n + 1);
    const pos = new Float32Array(vcount * 3);
    const nor = new Float32Array(vcount * 3);
    const bx = c.cx * CH, bz = c.cz * CH;
    const hAt = (x, z) => H[THREE.MathUtils.clamp(z, 0, this.N) * S + THREE.MathUtils.clamp(x, 0, this.N)];
    let v = 0;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const x = bx + i * s, z = bz + j * s;
        pos[v * 3] = x - this.half; pos[v * 3 + 1] = hAt(x, z); pos[v * 3 + 2] = z - this.half;
        const nx = hAt(x - s, z) - hAt(x + s, z), nz = hAt(x, z - s) - hAt(x, z + s), ny = 2 * s;
        const l = Math.hypot(nx, ny, nz);
        nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
        v++;
      }
    }
    // saias: bordas duplicadas para baixo escondem frestas entre LODs diferentes
    const skirt = 1.2 + s * 1.5;
    const edges = [];
    const addSkirt = (i, j) => {
      const src = j * (n + 1) + i;
      pos[v * 3] = pos[src * 3]; pos[v * 3 + 1] = pos[src * 3 + 1] - skirt; pos[v * 3 + 2] = pos[src * 3 + 2];
      nor[v * 3] = nor[src * 3]; nor[v * 3 + 1] = nor[src * 3 + 1]; nor[v * 3 + 2] = nor[src * 3 + 2];
      return v++;
    };
    const top = [], bottom = [], left = [], right = [];
    for (let i = 0; i <= n; i++) { top.push([i, addSkirt(i, 0)]); bottom.push([i, addSkirt(i, n)]); }
    for (let j = 0; j <= n; j++) { left.push([j, addSkirt(0, j)]); right.push([j, addSkirt(n, j)]); }

    const idx = new (vcount > 65535 ? Uint32Array : Uint16Array)(n * n * 6 + 4 * n * 6);
    let k = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i, b = a + 1, cc = a + n + 1, d = cc + 1;
        // mesma diagonal da colisão (Rapier): menos diferença visual/física
        idx[k++] = a; idx[k++] = cc; idx[k++] = b;
        idx[k++] = b; idx[k++] = cc; idx[k++] = d;
      }
    }
    const strip = (list, getMain, flip) => {
      for (let q = 0; q < n; q++) {
        const m0 = getMain(list[q][0]), m1 = getMain(list[q + 1][0]);
        const s0 = list[q][1], s1 = list[q + 1][1];
        if (flip) { idx[k++] = m0; idx[k++] = s0; idx[k++] = m1; idx[k++] = m1; idx[k++] = s0; idx[k++] = s1; }
        else { idx[k++] = m0; idx[k++] = m1; idx[k++] = s0; idx[k++] = m1; idx[k++] = s1; idx[k++] = s0; }
      }
    };
    strip(top, (i) => i, false);
    strip(bottom, (i) => n * (n + 1) + i, true);
    strip(left, (j) => j * (n + 1), true);
    strip(right, (j) => j * (n + 1) + n, false);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(c.x0, c.minY, c.z0), new THREE.Vector3(c.x0 + CH, c.maxY, c.z0 + CH));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    c.geos[lod] = g;
    return g;
  }

  // ---------------------------------------------------------------- atualização de LOD
  update(camera, focus, now) {
    const L = this.tier.lodDist;
    const shadowFar = this.tier.shadowFar;
    for (const c of this.chunks) {
      const dx = Math.max(c.x0 - focus.x, 0, focus.x - (c.x0 + CH));
      const dz = Math.max(c.z0 - focus.z, 0, focus.z - (c.z0 + CH));
      const dy = Math.max(c.minY - focus.y, 0, focus.y - c.maxY);
      const d = Math.hypot(dx, dz, dy * 0.5);
      let lod = d < L ? 0 : d < 2 * L ? 1 : d < 4 * L ? 2 : d < 8 * L ? 3 : 4;
      lod = Math.max(lod, this.tier.minLod);
      // histerese: evita trocar de LOD sem parar na fronteira
      if (c.lod >= 0 && Math.abs(lod - c.lod) === 1) {
        const edge = L * (1 << Math.min(lod, c.lod));
        if (Math.abs(d - edge) < 6) lod = c.lod;
      }
      if (lod !== c.lod) {
        c.mesh.geometry = this._geometry(c, lod);
        c.lod = lod;
      }
      c.lastUsed[lod] = now;
      c.mesh.visible = true;
      c.mesh.castShadow = d < shadowFar;
      // libera LODs parados há mais de 15 s
      for (let l = 0; l < c.geos.length; l++) {
        if (l !== lod && c.geos[l] && now - (c.lastUsed[l] || 0) > 15) { c.geos[l].dispose(); c.geos[l] = null; }
      }
    }
  }

  // ---------------------------------------------------------------- horizonte distante
  _buildFar(img) {
    const m = this.meta;
    const st = this.tier.farStep;            // amostragem do horizonte conforme a qualidade
    const n = m.farSize / st, res = m.farRes * st, S = n + 1, srcS = m.farSize + 1;
    const pos = new Float32Array(S * S * 3);
    const half = n * res / 2;
    const hNear = this.half;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const o = ((j * st) * srcS + i * st) * 4;
        let y = m.farMin + ((img.px[o] << 8) | img.px[o + 1]) * m.farScale - m.hmin;
        const x = i * res - half, z = j * res - half;
        const ox = Math.max(Math.abs(x) - hNear, 0), oz = Math.max(Math.abs(z) - hNear, 0);
        const out = Math.hypot(ox, oz);
        if (out === 0) y = this.heightAt(x, z) - 4;                 // escondido sob o mapa jogável
        else if (out < 80) y = THREE.MathUtils.lerp(this.heightAt(x, z), y, out / 80);   // costura suave
        const v = (j * S + i) * 3;
        pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
      }
    }
    const idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x0 = i * res - half, z0 = j * res - half;
      if (x0 >= -hNear && x0 + res <= hNear && z0 >= -hNear && z0 + res <= hNear) continue;
      const a = j * S + i, b = a + 1, c = a + S, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 }), (sh) => {
      sh.uniforms.tAlb = { value: this.tex.alb };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform highp sampler2DArray tAlb;')
        .replace('#include <map_fragment>', `
          vec3 fa = texture(tAlb, vec3(vWPos.xz / 23.0, 0.0)).rgb * 0.6 + texture(tAlb, vec3(vWPos.xz / 97.0, 0.0)).rgb * 0.4;
          diffuseColor.rgb *= fa;`);
    }, 'far');
    this.far = new THREE.Mesh(g, mat);
    this.far.receiveShadow = false;
    this.far.castShadow = false;
    this.scene.add(this.far);
  }

  // ---------------------------------------------------------------- material do solo
  _makeMaterial(tier) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    const t = this;
    registerMaterial(mat, (sh) => {
      sh.uniforms.tMacroN = { value: t.normalTex };
      sh.uniforms.tMask = { value: t.maskTex };
      sh.uniforms.tAlb = { value: t.tex.alb };
      sh.uniforms.tNrm = { value: t.tex.nrm };
      sh.uniforms.tOrm = { value: t.tex.orm };
      sh.uniforms.uHalf = { value: t.half };
      sh.uniforms.uMapSize = { value: t.N };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + TERRAIN_PARS + (tier.triplanar ? '#define TRIPLANAR\n' : ''))
        .replace('#include <map_fragment>', TERRAIN_SPLAT)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
        .replace('#include <normal_fragment_maps>', 'normal = normalize( ( viewMatrix * vec4( tNormalW, 0.0 ) ).xyz );')
        .replace('#include <aomap_fragment>', `
          reflectedLight.indirectDiffuse *= tAO;
          reflectedLight.indirectSpecular *= tAO;`);
    }, 'terrain' + (tier.triplanar ? '-tri' : ''));
    return mat;
  }
}

const TERRAIN_PARS = /* glsl */`
varying vec3 vWPos;
uniform sampler2D tMacroN;
uniform sampler2D tMask;
uniform highp sampler2DArray tAlb;
uniform highp sampler2DArray tNrm;
uniform highp sampler2DArray tOrm;
uniform float uHalf;
uniform float uMapSize;

vec3 detailN( vec2 uv, float layer, float strength ) {
  vec3 n = texture( tNrm, vec3( uv, layer ) ).xyz * 2.0 - 1.0;
  n.xy *= strength;
  return n;
}
// mistura "whiteout" da normal de detalhe (espaço da textura xz) com a normal do relevo
vec3 blendN( vec3 N, vec3 d ) { return normalize( vec3( N.x + d.x, N.y * d.z, N.z + d.y ) ); }
`;

const TERRAIN_SPLAT = /* glsl */`
  vec2 muv = ( vWPos.xz + uHalf ) / uMapSize;
  vec2 mn = texture( tMacroN, muv ).rg * 2.0 - 1.0;
  vec3 Nm = normalize( vec3( mn.x, sqrt( max( 1.0 - dot( mn, mn ), 0.0 ) ), mn.y ) );
  vec3 mk = texture( tMask, muv ).rgb;
  float dist = length( vWPos - cameraPosition );
  float slope = 1.0 - Nm.y;

  float rockW = clamp( mk.r + smoothstep( 0.22, 0.42, slope ), 0.0, 1.0 );
  float sandW = mk.g * ( 1.0 - rockW );
  float regW = max( 1.0 - rockW - sandW, 0.0 );

  vec2 uvR = vWPos.xz / 2.3;
  vec2 uvS = vWPos.xz / 3.1 + vec2( 0.37, 0.11 );
  vec2 uvK = vWPos.xz / 3.7 + vec2( 0.71, 0.53 );

  vec4 oR = texture( tOrm, vec3( uvR, 0.0 ) );
  vec4 oS = texture( tOrm, vec3( uvS, 1.0 ) );
  vec4 oK = texture( tOrm, vec3( uvK, 2.0 ) );

  // mistura por altura: a rocha "aparece" entre o regolito, a areia enche os vãos
  vec3 present = vec3( step( 0.001, regW ), step( 0.001, sandW ), step( 0.001, rockW ) );
  vec3 hh = vec3( oR.b + regW * 1.2, oS.b + sandW * 1.2, oK.b + rockW * 1.25 ) + ( present - 1.0 ) * 10.0;
  float hmax = max( max( hh.x, hh.y ), hh.z ) - 0.18;
  vec3 bw = max( hh - hmax, 0.0 );
  bw /= max( bw.x + bw.y + bw.z, 1e-4 );

  vec3 aR = texture( tAlb, vec3( uvR, 0.0 ) ).rgb;
  vec3 aS = texture( tAlb, vec3( uvS, 1.0 ) ).rgb;
  vec3 aK = texture( tAlb, vec3( uvK, 2.0 ) ).rgb;
  float nStr = mix( 1.0, 0.35, smoothstep( 25.0, 160.0, dist ) );
  vec3 dR = detailN( uvR, 0.0, 1.0 * nStr );
  vec3 dS = detailN( uvS, 1.0, 0.9 * nStr );
  vec3 dK = detailN( uvK, 2.0, 1.3 * nStr );

  #ifdef TRIPLANAR
  // paredes íngremes: projeção tripla da rocha, sem esticar a textura
  if ( rockW > 0.01 && slope > 0.18 ) {
    vec3 w = pow( abs( Nm ), vec3( 4.0 ) ); w /= ( w.x + w.y + w.z );
    vec3 p = vWPos / 3.7;
    vec3 ax = texture( tAlb, vec3( p.zy, 2.0 ) ).rgb, az = texture( tAlb, vec3( p.xy, 2.0 ) ).rgb;
    aK = ax * w.x + aK * w.y + az * w.z;
    vec3 nx = texture( tNrm, vec3( p.zy, 2.0 ) ).xyz * 2.0 - 1.0;
    vec3 nz = texture( tNrm, vec3( p.xy, 2.0 ) ).xyz * 2.0 - 1.0;
    // converte cada projeção para o espaço do mundo e mistura
    vec3 wx = vec3( Nm.x, Nm.y + nx.y * 1.3, Nm.z + nx.x * 1.3 );
    vec3 wz = vec3( Nm.x + nz.x * 1.3, Nm.y + nz.y * 1.3, Nm.z );
    vec3 wy = blendN( Nm, dK );
    vec3 triN = normalize( wx * w.x + wy * w.y + wz * w.z );
    dK = vec3( triN.x - Nm.x, triN.z - Nm.z, 1.0 );
  }
  #endif

  vec3 alb = aR * bw.x + aS * bw.y + aK * bw.z;
  // variação de grande escala: manchas de poeira clara e areia basáltica escura
  float macro = texture( tAlb, vec3( vWPos.xz / 71.0, 0.0 ) ).r / 0.55;
  float macro2 = texture( tAlb, vec3( vWPos.xz / 263.0 + 0.5, 1.0 ) ).g / 0.44;
  alb *= clamp( mix( 1.0, macro * 0.55 + macro2 * 0.45, 0.35 ), 0.75, 1.25 );
  // pó assentado nas faces viradas para cima das rochas
  alb = mix( alb, aR * 1.05, bw.z * smoothstep( 0.93, 0.99, Nm.y ) * 0.45 );
  // anti-repetição à distância
  vec3 farA = texture( tAlb, vec3( vWPos.xz / 19.0, 0.0 ) ).rgb;
  alb = mix( alb, farA, smoothstep( 40.0, 220.0, dist ) * 0.5 );
  diffuseColor.rgb *= alb;

  vec3 dN = dR * bw.x + dS * bw.y + dK * bw.z;
  vec3 tNormalW = blendN( Nm, dN );
  // regolito e areia marcianos são muito foscos; só a rocha tem algum brilho
  float tRough = mix( 0.86, 1.0, oR.g * bw.x + oS.g * bw.y ) * ( bw.x + bw.y ) + mix( 0.7, 0.95, oK.g ) * bw.z;
  float detAO = oR.r * bw.x + oS.r * bw.y + oK.r * bw.z;
  float tAO = mk.b * mix( 1.0, detAO, 0.6 );
  diffuseColor.rgb *= mix( 1.0, detAO, 0.35 );
`;
