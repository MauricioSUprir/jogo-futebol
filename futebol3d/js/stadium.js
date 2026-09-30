// GOLAÇO — estádio: gramado, linhas, gols e redes, bandeirinhas, placas de LED,
// bancos, arquibancadas com torcida animada, cobertura, refletores, céu, luzes
// e ambiente PMREM. API em tools/CONTRACTS.md.
//
// Premissas sobre o renderer (definidas pelo main.js, não alteradas aqui):
//   outputColorSpace = SRGBColorSpace, toneMapping = ACESFilmicToneMapping,
//   toneMappingExposure ≈ 1. Aqui só ajustamos renderer.shadowMap.enabled/type
//   (PCFSoftShadowMap) conforme quality.shadows. A câmera deve ter far ≥ 600.
// Também definimos scene.environment e scene.environmentIntensity.
// Extra (fora do contrato): stadium.ready é uma Promise resolvida quando as
// texturas do gramado carregam; stadium.root é o grupo raiz.
//
// Chamadas de desenho (≈16): gramado, arquibancada, cobertura, placas LED, bancos (2),
// traves, armação, redes, mastros, bandeirinhas, torcida, bandeiras da torcida,
// refletores, brilho dos refletores, céu.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { PITCH } from './config.js';
import { BOWL, buildBowl, buildDugouts, floodlightSpots } from './stadium-bowl.js';
import { buildPitch } from './stadium-pitch.js';
import { buildGoals } from './stadium-goals.js';
import { buildAds } from './stadium-ads.js';
import { buildCrowd } from './stadium-crowd.js';

const D2R = Math.PI / 180;

// ---------------------------------------------------------------- horários
const TOD = {
  dia: {
    el: 57, az: [-0.42, -0.91], skyEl: 57,
    sun: 0xfff4e6, sunI: 3.3, hemiSky: 0xbcd4ff, hemiGround: 0x4a6a34, hemiI: 0.35,
    envI: 0.75, amb: [0.34, 0.37, 0.42],
    sky: { turbidity: 2.0, rayleigh: 1.8, mieCoefficient: 0.004, mieDirectionalG: 0.8, gain: 0.55 },
  },
  tarde: {
    el: 27, az: [-0.5, -0.87], skyEl: 7,
    sun: 0xffc690, sunI: 3.4, hemiSky: 0xc9d6ff, hemiGround: 0x4a4a2a, hemiI: 0.6,
    envI: 1.2, amb: [0.36, 0.30, 0.27],
    sky: { turbidity: 6, rayleigh: 2.4, mieCoefficient: 0.006, mieDirectionalG: 0.86, gain: 0.5 },
  },
  noite: {
    dir: [0.3, 1, -0.42],
    sun: 0xeef3ff, sunI: 2.9, hemiSky: 0xa9bbdc, hemiGround: 0x2a3a24, hemiI: 0.55,
    envI: 0.55, amb: [0.2, 0.21, 0.24], crowdSun: 0.5,
  },
};

// ---------------------------------------------------------------- céu noturno
const nightSkyVert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;
}`;
const nightSkyFrag = /* glsl */`
varying vec3 vDir;
float h3( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
void main() {
  vec3 d = normalize( vDir );
  float h = max( d.y, 0.0 );
  vec3 col = mix( vec3( 0.022, 0.026, 0.04 ), vec3( 0.0025, 0.004, 0.011 ), pow( h, 0.45 ) );
  col += vec3( 0.06, 0.05, 0.045 ) * exp( -h * 7.0 );           // halo de luz da cidade/estádio
  vec3 p = d * 320.0;
  vec3 i = floor( p );
  float r = h3( i );
  float st = step( 0.9965, r ) * smoothstep( 0.42, 0.0, length( fract( p ) - 0.5 ) );
  col += vec3( 0.9, 0.93, 1.0 ) * st * ( 0.4 + 2.0 * h3( i + 7.1 ) ) * smoothstep( 0.05, 0.35, h );
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- brilho dos refletores
const glowVert = /* glsl */`
attribute vec3 aPos;
attribute vec3 aAim;
varying vec2 vUv;
varying float vI;
void main() {
  vec3 toCam = normalize( cameraPosition - aPos );
  float f = max( dot( aAim, toCam ), 0.0 );
  float size = 0.9 + 3.2 * pow( f, 3.0 );
  vI = 0.35 + 0.9 * pow( f, 2.0 );
  vUv = position.xy;
  vec4 mv = viewMatrix * vec4( aPos, 1.0 );
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
}`;
const glowFrag = /* glsl */`
uniform float uOn;
varying vec2 vUv;
varying float vI;
void main() {
  float r = length( vUv );
  float core = exp( -r * r * 60.0 ) * 6.0;
  float halo = exp( -r * 4.5 ) * 0.35;
  float a = ( core + halo ) * vI * uOn * ( 1.0 - smoothstep( 0.8, 1.0, r ) );
  gl_FragColor = vec4( vec3( 1.0, 0.97, 0.92 ) * a, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function buildFloodlights(isNight) {
  const group = new THREE.Group();
  group.name = 'refletores';
  const spots = floodlightSpots();
  const box = new THREE.BoxGeometry(0.95, 0.6, 0.35);
  box.translate(0, 0, 0.1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a2c30, roughness: 0.5, metalness: 0.6,
    emissive: isNight ? 0xfff6e8 : 0x000000, emissiveIntensity: isNight ? 3.5 : 0,
  });
  const inst = new THREE.InstancedMesh(box, mat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const z = new THREE.Vector3(0, 0, 1);
  spots.forEach((s, i) => {
    q.setFromUnitVectors(z, s.aim);
    m.compose(s.p, q, one);
    inst.setMatrixAt(i, m);
  });
  inst.name = 'refletores-caixas';
  group.add(inst);

  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const pa = new Float32Array(spots.length * 3), aa = new Float32Array(spots.length * 3);
  spots.forEach((s, i) => { s.p.clone().addScaledVector(s.aim, 0.35).toArray(pa, i * 3); s.aim.toArray(aa, i * 3); });
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pa, 3));
  g.setAttribute('aAim', new THREE.InstancedBufferAttribute(aa, 3));
  g.instanceCount = spots.length;
  const gm = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 1 } }, vertexShader: glowVert, fragmentShader: glowFrag,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const glow = new THREE.Mesh(g, gm);
  glow.frustumCulled = false;
  glow.renderOrder = 5;
  glow.visible = isNight;
  glow.name = 'refletores-brilho';
  group.add(glow);
  return group;
}

// ---------------------------------------------------------------- ambiente (PMREM)
function buildEnv(renderer, isNight, skyMat, homeColor) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const disposables = [];
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); env.add(m); disposables.push(geo, mat); return m; };
  if (isNight) {
    add(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ vertexShader: nightSkyVert, fragmentShader: nightSkyFrag, side: THREE.BackSide, depthWrite: false }));
  } else {
    const s = new Sky();
    s.material = skyMat;
    s.scale.setScalar(400);
    env.add(s);
  }
  // anel de arquibancadas (cheio de gente) e gramado vistos do centro
  const ring = new THREE.CylinderGeometry(70, 60, 30, 48, 1, true);
  ring.translate(0, 13, 0);
  const crowdCol = new THREE.Color(homeColor).multiplyScalar(0.25).lerp(new THREE.Color(0.1, 0.1, 0.1), 0.5);
  add(ring, new THREE.MeshBasicMaterial({ color: isNight ? crowdCol.clone().multiplyScalar(1.4) : crowdCol, side: THREE.BackSide }));
  const ground = new THREE.CircleGeometry(80, 32);
  ground.rotateX(-Math.PI / 2); ground.translate(0, -2, 0);
  add(ground, new THREE.MeshBasicMaterial({ color: isNight ? new THREE.Color(0.07, 0.16, 0.05) : new THREE.Color(0.1, 0.22, 0.06) }));
  if (isNight) {
    // faixas de refletores sob a cobertura: dão reflexos brilhantes em traves e cobertura
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const panel = add(new THREE.PlaneGeometry(50, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.98, 0.95).multiplyScalar(22), side: THREE.DoubleSide }));
      panel.position.set(Math.cos(a) * 55, 34, Math.sin(a) * 55);
      panel.lookAt(0, 0, 0);
    }
    const roof = new THREE.CylinderGeometry(70, 70, 4, 48, 1, true);
    roof.translate(0, 34, 0);
    add(roof, new THREE.MeshBasicMaterial({ color: 0x050608, side: THREE.BackSide }));
  }
  const rt = pmrem.fromScene(env, 0.02, 0.1, 1000);
  disposables.forEach((d) => d.dispose());
  pmrem.dispose();
  return rt;
}

// ---------------------------------------------------------------- principal
export function buildStadium(renderer, scene, opts = {}) {
  const quality = opts.quality || { shadows: true, shadowSize: 2048, crowd: 0.6, anisotropy: 4 };
  const tod = TOD[opts.timeOfDay] ? opts.timeOfDay : 'noite';
  const P = TOD[tod];
  const isNight = tod === 'noite';
  const homeColor = opts.homeColor || '#c8102e';
  const awayColor = opts.awayColor || '#f2f2f2';
  const stadiumName = opts.stadiumName || 'Arena Vale do Sol';
  const shadows = !!quality.shadows;
  const anisotropy = Math.min(quality.anisotropy || 4, renderer.capabilities.getMaxAnisotropy());

  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // direção PARA a luz principal
  const sunDir = new THREE.Vector3();
  if (isNight) sunDir.fromArray(P.dir).normalize();
  else sunDir.set(P.az[0] * Math.cos(P.el * D2R), Math.sin(P.el * D2R), P.az[1] * Math.cos(P.el * D2R)).normalize();

  const sunColor = new THREE.Color(P.sun);
  const U = {
    uTime: { value: 0 }, uExc: { value: 0.2 },
    uEvHome: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) },
    uEvAway: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) },
    uSunDir: { value: sunDir },
    uShadeOn: { value: isNight ? 0 : 1 },
    uSunCol: { value: sunColor.clone().multiplyScalar(P.sunI / Math.PI * (P.crowdSun ?? 1)) },
    uAmbCrowd: { value: new THREE.Color().fromArray(P.amb) },
    uWind: { value: new THREE.Vector2(opts.wind?.x ?? 2.5, opts.wind?.z ?? 1.2) },
  };

  const root = new THREE.Group();
  root.name = 'estadio';
  scene.add(root);

  // ---- céu
  let skyMat = null;
  if (isNight) {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      vertexShader: nightSkyVert, fragmentShader: nightSkyFrag, side: THREE.BackSide, depthWrite: false,
    }));
    sky.frustumCulled = false; sky.renderOrder = -10; sky.name = 'ceu';
    root.add(sky);
  } else {
    const sky = new Sky();
    skyMat = sky.material;
    skyMat.fragmentShader = skyMat.fragmentShader
      .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float skyGain;')
      .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
    const u = skyMat.uniforms;
    u.skyGain = { value: P.sky.gain };
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) u[k].value = P.sky[k];
    const se = P.skyEl * D2R;
    u.sunPosition.value.set(P.az[0] * Math.cos(se), Math.sin(se), P.az[1] * Math.cos(se));
    sky.scale.setScalar(900);
    sky.frustumCulled = false; sky.name = 'ceu';
    root.add(sky);
  }

  // ---- ambiente
  const envRT = buildEnv(renderer, isNight, skyMat, homeColor);
  const envMap = envRT.texture;
  const prevEnv = scene.environment, prevEnvI = scene.environmentIntensity;
  scene.environment = envMap;
  scene.environmentIntensity = P.envI;

  // ---- luzes
  const mainLight = new THREE.DirectionalLight(sunColor, P.sunI);
  mainLight.name = isNight ? 'luz-refletores' : 'sol';
  mainLight.position.copy(sunDir).multiplyScalar(250);
  mainLight.target.position.set(0, 0, 0);
  mainLight.castShadow = shadows;
  if (shadows) {
    const sh = mainLight.shadow;
    sh.mapSize.set(quality.shadowSize, quality.shadowSize);
    // ajusta a câmera ortográfica da sombra ao gramado (+ margem e altura dos jogadores)
    const view = new THREE.Matrix4().lookAt(mainLight.position, mainLight.target.position, new THREE.Vector3(0, 1, 0));
    view.setPosition(mainLight.position);
    view.invert();
    const hx = PITCH.halfL + 4, hz = PITCH.halfW + 3;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [-hx, hx]) for (const z of [-hz, hz]) for (const y of [0, 3]) {
      v.set(x, y, z).applyMatrix4(view);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const cam = sh.camera;
    cam.left = minX; cam.right = maxX; cam.bottom = minY; cam.top = maxY;
    cam.near = 1; cam.far = 500;
    cam.updateProjectionMatrix();
    const texel = Math.max(maxX - minX, maxY - minY) / quality.shadowSize;
    sh.bias = -0.0003;
    sh.normalBias = Math.max(0.012, texel * 0.9);
    sh.radius = 2;
  }
  scene.add(mainLight, mainLight.target);
  const hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemiI);
  hemi.name = 'luz-hemisferio';
  scene.add(hemi);

  // ---- peças
  const ctx = { U, quality, homeColor, awayColor, stadiumName, isNight, anisotropy, shadows };
  const pitch = buildPitch(ctx);
  root.add(pitch);

  const bowl = buildBowl(ctx);
  bowl.userData.stands.castShadow = shadows && !isNight;
  bowl.userData.roof.castShadow = shadows && !isNight;
  root.add(bowl);

  const ads = buildAds({ ...ctx, samples: bowl.userData.samples });
  ads.castShadow = shadows;
  root.add(ads);

  root.add(buildDugouts(ctx));
  const goals = buildGoals(ctx);
  root.add(goals);
  const crowd = buildCrowd(ctx);
  root.add(crowd);
  root.add(buildFloodlights(isNight));

  // ---- estado
  let lastTime = 0, goalAt = -1e4;
  const wind = U.uWind.value;

  const stadium = {
    sunDir, mainLight, envMap, isNight, root,
    ready: pitch.userData.ready,
    crowdCount: crowd.userData.count,

    update(dt, time, excitement = 0, camera) {
      lastTime = time;
      U.uTime.value = time;
      const e = THREE.MathUtils.clamp(excitement, 0, 1);
      U.uExc.value += (e - U.uExc.value) * Math.min(1, dt * 1.5);
      ads.userData.uniforms.uFlash.value = time - goalAt < 7 ? 1 : 0;
    },

    crowdReact(kind, side = 'home') {
      const v = (side === 'away' ? U.uEvAway : U.uEvHome).value;
      if (kind === 'goal') { v.x = lastTime; goalAt = lastTime; }
      else if (kind === 'chance') v.y = lastTime;
      else if (kind === 'foul') v.z = lastTime;
      else if (kind === 'save') v.w = lastTime;
    },

    netImpact(goalSign, point, strength = 1) {
      goals.userData.impact(goalSign, point, strength, lastTime);
    },

    setWind(w) {
      if (w) wind.set(w.x || 0, w.z || 0);
    },

    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          for (const k of ['map', 'normalMap']) if (m[k]) m[k].dispose();
          if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) u.value.dispose();
          m.dispose();
        }
      });
      scene.remove(root, mainLight, mainLight.target, hemi);
      mainLight.dispose(); hemi.dispose();
      if (scene.environment === envMap) { scene.environment = prevEnv || null; scene.environmentIntensity = prevEnvI ?? 1; }
      envRT.dispose();
    },
  };
  return stadium;
}

export { BOWL };
