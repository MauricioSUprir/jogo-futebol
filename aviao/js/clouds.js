// Nuvens cúmulo: aglomerados de "puffs" (billboards com ruído), iluminados pelo Sol,
// base achatada e topo arredondado. Dá para atravessar.
import * as THREE from 'three';

function puffTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S);
  const rnd = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (u, v) => { const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, a = rnd(i, j), b = rnd(i + 1, j), cc = rnd(i, j + 1), d = rnd(i + 1, j + 1), su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv); return a + (b - a) * su + (cc - a) * sv + (a - b - cc + d) * su * sv; };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S - 0.5, v = j / S - 0.5, r = Math.hypot(u, v) * 2;
    let n = 0, a = 0.5, f = 4;
    for (let o = 0; o < 5; o++) { n += a * noise(i / S * f + 7, j / S * f + 3); a *= 0.5; f *= 2; }
    const alpha = Math.max(0, 1 - r) ** 1.4 * (0.55 + n * 0.9);
    const o = (j * S + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.min(255, alpha * 255);
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = true; return t;
}

export class Clouds {
  constructor(scene, tier) {
    this.scene = scene; this.tier = tier;
    this.max = tier.cloudPuffs;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    this.aPos = new Float32Array(this.max * 3); this.aCenter = new Float32Array(this.max * 3); this.aSize = new Float32Array(this.max);
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.aPos, 3));
    g.setAttribute('aCenter', new THREE.InstancedBufferAttribute(this.aCenter, 3));
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(this.aSize, 1));
    g.instanceCount = 0;
    this.u = {
      tPuff: { value: puffTexture() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
      uAmb: { value: new THREE.Color(0.5, 0.55, 0.65) }, uFogCol: { value: new THREE.Color() }, uFogDen: { value: 0 },
    };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec3 aPos; attribute vec3 aCenter; attribute float aSize;
        uniform vec3 uSun; varying vec2 vUv; varying float vLit; varying float vDist; varying float vBottom;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          vUv = uv;
          vec3 right = vec3( viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0] );
          vec3 up = vec3( viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1] );
          vec3 wp = aPos + ( right * position.x + up * position.y ) * aSize;
          vec3 n = normalize( aPos - aCenter + vec3( 0.0, 1e-3, 0.0 ) );
          vLit = clamp( dot( n, uSun ) * 0.55 + 0.55, 0.0, 1.0 );
          vBottom = clamp( ( aPos.y - aCenter.y ) / 120.0 + 0.6, 0.0, 1.0 );
          vec4 mv = viewMatrix * vec4( wp, 1.0 );
          vec3 rel = transpose( mat3( viewMatrix ) ) * mv.xyz;
          mv.xyz -= mat3( viewMatrix ) * vec3( 0.0, dot( rel.xz, rel.xz ) / 12742000.0, 0.0 );
          vDist = length( mv.xyz );
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tPuff; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFogCol; uniform float uFogDen;
        varying vec2 vUv; varying float vLit; varying float vDist; varying float vBottom;
        #include <logdepthbuf_pars_fragment>
        void main() {
          #include <logdepthbuf_fragment>
          float a = texture2D( tPuff, vUv ).a;
          if ( a < 0.01 ) discard;
          vec3 col = uAmb * mix( 0.55, 1.0, vBottom ) + uSunCol * vLit * mix( 0.45, 1.0, vBottom );
          float fog = 1.0 - exp( - uFogDen * vDist );
          col = mix( col, uFogCol, fog );
          // some suavemente quando a câmera está dentro da nuvem
          a *= smoothstep( 20.0, 120.0, vDist ) * 0.85;
          gl_FragColor = vec4( col, a );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
    this.puffs = [];
    this._sortT = 0;
  }

  // cobertura 0..1; base em metros
  generate(cover, baseAlt = 900, seed = 7) {
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    this.puffs = [];
    const nClouds = Math.round(cover * this.max / 22);
    for (let c = 0; c < nClouds && this.puffs.length < this.max - 30; c++) {
      const cx = (rnd() - 0.5) * 60000, cz = (rnd() - 0.5) * 60000;
      const w = 300 + rnd() * 900 * (0.5 + cover), h = 150 + rnd() * 450 * cover;
      const cy = baseAlt + h * 0.3 + rnd() * 150;
      const n = Math.round(10 + rnd() * 26);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * w * 0.5;
        const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r * 0.8;
        const top = (1 - (r / (w * 0.5)) ** 2) * h;
        const py = baseAlt + rnd() * Math.max(top, 30);
        this.puffs.push({ p: new THREE.Vector3(px, py, pz), c: new THREE.Vector3(cx, cy, cz), s: 180 + rnd() * 320 * (0.6 + h / 600) });
      }
    }
    this._write(new THREE.Vector3());
  }

  _write(cam) {
    // ordena de trás para frente (transparência correta)
    const arr = this.puffs.slice().sort((a, b) => b.p.distanceToSquared(cam) - a.p.distanceToSquared(cam));
    arr.forEach((q, i) => { this.aPos.set([q.p.x, q.p.y, q.p.z], i * 3); this.aCenter.set([q.c.x, q.c.y, q.c.z], i * 3); this.aSize[i] = q.s; });
    const g = this.mesh.geometry;
    g.instanceCount = arr.length;
    g.attributes.aPos.needsUpdate = true; g.attributes.aCenter.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }

  update(dt, cam, env, wind) {
    for (const q of this.puffs) { q.p.x += wind.x * dt * 0.8; q.p.z += wind.z * dt * 0.8; q.c.x += wind.x * dt * 0.8; q.c.z += wind.z * dt * 0.8; }
    this._sortT += dt;
    if (this._sortT > 0.4) { this._sortT = 0; this._write(cam); }
    const day = THREE.MathUtils.smoothstep(env.sunDir.y, -0.1, 0.15);
    this.u.uSun.value.copy(env.sunDir);
    this.u.uSunCol.value.copy(env.sunColor).multiplyScalar(env.sunIntensity * 0.42);
    this.u.uAmb.value.setRGB(0.42, 0.48, 0.58).multiplyScalar(0.05 + 0.95 * day);
    this.u.uFogCol.value.copy(this.scene.fog.color); this.u.uFogDen.value = this.scene.fog.density;
  }
}
