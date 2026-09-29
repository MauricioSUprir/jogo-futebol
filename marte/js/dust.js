// Poeira e pegadas.
// Grãos de areia: trajetória balística com g = 3,71 m/s² e arrasto quase nulo (ar rarefeito).
// Pó fino: fica suspenso, é levado pelo vento e assenta devagar.
import * as THREE from 'three';
import { MARS } from './config.js';
import { mulberry } from './rocks.js';

const vert = /* glsl */`
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
varying float vFwd;
uniform float uScale;
uniform vec3 uSunDir;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max( -mv.z, 0.1 );
  vAlpha = aAlpha;
  vec3 wdir = normalize( position - cameraPosition );
  vFwd = pow( max( dot( wdir, uSunDir ), 0.0 ), 6.0 );
}`;
const frag = /* glsl */`
varying float vAlpha;
varying float vFwd;
uniform vec3 uLight;
uniform vec3 uColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length( c );
  if ( d > 0.5 ) discard;
  float a = smoothstep( 0.5, 0.1, d ) * vAlpha;
  // o pó espalha muita luz para frente: contra o Sol ele brilha
  vec3 col = uColor * uLight * ( 1.0 + vFwd * 2.0 );
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Dust {
  constructor(scene, terrain, tier) {
    this.terrain = terrain;
    const n = tier.dust;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.kind = new Uint8Array(n);        // 0 grão, 1 pó fino
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.cursor = 0;
    this.rnd = mulberry(42);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = {
      uScale: { value: 400 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uLight: { value: new THREE.Color(1, 1, 1) }, uColor: { value: new THREE.Color(0.62, 0.42, 0.28) },
    };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms,
      transparent: true, depthWrite: false, toneMapped: true,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.ambientTimer = 0;
  }

  _spawn(x, y, z, vx, vy, vz, kind, life, size) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.kind[i] = kind; this.size[i] = size;
  }

  // chute de poeira numa pisada
  kick(x, y, z, strength, dirx = 0, dirz = 0) {
    const r = this.rnd;
    const grains = Math.round(10 + 26 * strength), fines = Math.round(5 + 14 * strength);
    for (let k = 0; k < grains; k++) {
      const a = r() * Math.PI * 2, sp = (0.3 + r() * 1.3) * (0.6 + strength);
      this._spawn(x + (r() - 0.5) * 0.2, y + 0.03, z + (r() - 0.5) * 0.2,
        Math.cos(a) * sp * 0.6 + dirx * 0.6, 0.6 + r() * 1.6 * (0.5 + strength), Math.sin(a) * sp * 0.6 + dirz * 0.6, 0, 3, 0.02 + r() * 0.03);
    }
    for (let k = 0; k < fines; k++) {
      const a = r() * Math.PI * 2, sp = 0.2 + r() * 0.6;
      this._spawn(x + (r() - 0.5) * 0.3, y + 0.05 + r() * 0.1, z + (r() - 0.5) * 0.3,
        Math.cos(a) * sp + dirx * 0.3, 0.15 + r() * 0.5, Math.sin(a) * sp + dirz * 0.3, 1, 2.5 + r() * 4, 0.18 + r() * 0.3);
    }
  }

  update(dt, env, camPos) {
    const g = MARS.g, w = env.wind;
    const P = this.pos, V = this.vel, T = this.terrain;
    // saltação trazida pelo vento perto do chão (mais forte com vento forte)
    this.ambientTimer += dt * Math.max(0, env.windSpeed - 3) * 3;
    while (this.ambientTimer > 1) {
      this.ambientTimer -= 1;
      const r = this.rnd;
      const x = camPos.x + (r() - 0.5) * 40, z = camPos.z + (r() - 0.5) * 40;
      const y = T.heightAt(x, z);
      this._spawn(x, y + 0.05 + r() * 0.3, z, w.x * 0.6, 0.1 + r() * 0.3, w.z * 0.6, 1, 3 + r() * 3, 0.25 + r() * 0.4);
    }
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const o = i * 3;
      if (this.kind[i] === 0) {
        // grão: quase sem arrasto
        V[o + 1] -= g * dt;
        V[o] *= 1 - 0.1 * dt; V[o + 2] *= 1 - 0.1 * dt;
      } else {
        // pó fino: arrastado pelo vento e com velocidade terminal baixa (~5 cm/s)
        const k = 1.6 * dt;
        V[o] += (w.x - V[o]) * k; V[o + 2] += (w.z - V[o + 2]) * k; V[o + 1] += (-0.05 - V[o + 1]) * k;
      }
      P[o] += V[o] * dt; P[o + 1] += V[o + 1] * dt; P[o + 2] += V[o + 2] * dt;
      const gh = T.heightAt(P[o], P[o + 2]);
      if (P[o + 1] < gh) {
        if (this.kind[i] === 0) { this.life[i] = 0; } else { P[o + 1] = gh; V[o + 1] = 0.05; }
      }
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.kind[i] === 0 ? Math.min(1, t * 3) * 0.95 : Math.sin(Math.PI * Math.min(1, t)) * 0.16;
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
    this.uniforms.uSunDir.value.copy(env.sunDir);
    // mesma escala de radiância do solo (Lambert: albedo/π × irradiância)
    const L = (env.sunIntensity * Math.max(env.sunDir.y, 0) * 0.6 + env.ambient * 0.8) / Math.PI + 0.004;
    this.uniforms.uLight.value.copy(env.sunColor).multiplyScalar(L);
  }

  setViewport(heightPx) { this.uniforms.uScale.value = heightPx * 0.9; }
}

// pegadas: pequenos decalques escuros no solo, em fila circular
export class Footprints {
  constructor(scene, terrain, max) {
    this.terrain = terrain; this.max = max;
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128;
      const x = c.getContext('2d');
      const grd = x.createRadialGradient(32, 64, 4, 32, 64, 60);
      grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = grd;
      x.beginPath(); x.ellipse(32, 64, 26, 58, 0, 0, Math.PI * 2); x.fill();
      // sulcos da sola
      x.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < 9; i++) x.fillRect(12, 16 + i * 11, 40, 4);
      const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
      return t;
    })();
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.15, 0.3).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, color: 0x000000, opacity: 0.6, fog: true }), max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.i = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._n = new THREE.Vector3();
  }
  add(x, z, yaw) {
    const y = this.terrain.heightAt(x, z) + 0.015;
    const n = this.terrain.normalAt(x, z, this._n);
    this._q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    this._m.compose(new THREE.Vector3(x, y, z), this._q, new THREE.Vector3(1, 1, 1));
    this.mesh.setMatrixAt(this.i, this._m);
    this.i = (this.i + 1) % this.max;
    this.mesh.count = Math.min(this.mesh.count + 1, this.max);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
