// Céu e iluminação: Sol na posição astronômica real sobre o Rio (data e hora escolhidas),
// céu de dispersão atmosférica (Preetham), estrelas, névoa de perspectiva aérea e IBL.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { shared } from './materials.js';

const D2R = Math.PI / 180;

// posição do Sol (algoritmo da NOAA). Retorna direção no mundo (+x leste, +y cima, -z norte).
export function sunDirection(lat, lon, date, out = new THREE.Vector3()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * D2R) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * D2R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * D2R) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * D2R);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * D2R);
  const decl = Math.asin(Math.sin(eps * D2R) * Math.sin(lambda * D2R));
  const y = Math.tan(eps * D2R / 2) ** 2;
  const eqTime = 4 / D2R * (y * Math.sin(2 * L0 * D2R) - 2 * e * Math.sin(M * D2R) + 4 * e * y * Math.sin(M * D2R) * Math.cos(2 * L0 * D2R) - 0.5 * y * y * Math.sin(4 * L0 * D2R) - 1.25 * e * e * Math.sin(2 * M * D2R));
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const tst = utcMin + eqTime + 4 * lon;
  const H = (tst / 4 - 180) * D2R;
  const la = lat * D2R;
  const up = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(H);
  const east = -Math.cos(decl) * Math.sin(H);
  const north = Math.sin(decl) * Math.cos(la) - Math.cos(decl) * Math.sin(la) * Math.cos(H);
  return out.set(east, up, -north).normalize();
}

export class Environment {
  constructor(renderer, scene, meta, tier) {
    this.renderer = renderer; this.scene = scene; this.meta = meta; this.tier = tier;
    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    this.sky.frustumCulled = false;
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4.5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    scene.add(this.sky);

    // estrelas
    const n = 2500, sp = new Float32Array(n * 3), sa = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(15000);
      sp.set([v.x, Math.abs(v.y) * 0.98 + 200, v.z], i * 3); sa[i] = Math.pow(Math.random(), 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aMag', new THREE.BufferAttribute(sa, 1));
    this.starU = { uVis: { value: 0 } };
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aMag; varying float vM; void main(){ vM = aMag; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); p.z = p.w * 0.9999; gl_Position = p; gl_PointSize = 1.0 + aMag * 2.2; }',
      fragmentShader: 'uniform float uVis; varying float vM; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vec3(0.85,0.9,1.0) * (0.3 + vM) * uVis, smoothstep(0.5,0.0,d) * uVis); }',
    }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // cena do mapa de ambiente: céu + chão iluminado
    this.envScene = new THREE.Scene();
    const envSky = new Sky(); envSky.scale.setScalar(50); envSky.material = this.sky.material; this.envScene.add(envSky);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(40, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x223322 }));
    this.envGround.position.y = -1; this.envScene.add(this.envGround);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null; this._envTimer = 1e9; this._lastSun = new THREE.Vector3();

    scene.fog = new THREE.FogExp2(0x9fb4c8, 0.00002);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.sunColor = new THREE.Color();
    this.sunIntensity = 3;
    this.night = 0;
    this.visibility = 40000;    // metros
    this.date = new Date();
    this.timeScale = 1;
  }

  setLocalTime(hours, dateBase = new Date()) {
    // Rio = UTC−3 (sem horário de verão desde 2019)
    const d = new Date(Date.UTC(dateBase.getUTCFullYear(), dateBase.getUTCMonth(), dateBase.getUTCDate(), 0, 0, 0));
    this.date = new Date(d.getTime() + (hours + 3) * 3600000);
    this._envTimer = 1e9;
  }
  get localHours() { const h = (this.date.getUTCHours() - 3 + 24) % 24; return h + this.date.getUTCMinutes() / 60; }

  update(dt, camera) {
    this.date = new Date(this.date.getTime() + dt * 1000 * this.timeScale);
    sunDirection(this.meta.lat0, this.meta.lon0, this.date, this.sunDir);
    const sy = this.sunDir.y;
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);

    const day = THREE.MathUtils.smoothstep(sy, -0.12, 0.12);
    this.night = 1 - THREE.MathUtils.smoothstep(sy, -0.08, 0.06);
    shared.uNight.value = this.night;
    this.starU.uVis.value = THREE.MathUtils.smoothstep(-sy, 0.02, 0.2);

    // luz direta: atenuada e avermelhada perto do horizonte
    const low = 1 - THREE.MathUtils.smoothstep(sy, 0.0, 0.35);
    this.sunColor.setRGB(1, 0.96 - 0.4 * low, 0.9 - 0.62 * low);
    this.sunIntensity = 3.4 * THREE.MathUtils.smoothstep(sy, -0.02, 0.12) * (0.55 + 0.45 * THREE.MathUtils.smoothstep(sy, 0.0, 0.5));

    // névoa (perspectiva aérea): azul acinzentada de dia, alaranjada no crepúsculo, azul-escura à noite
    const fogDay = new THREE.Color(0.58, 0.68, 0.8), fogDusk = new THREE.Color(0.85, 0.6, 0.45), fogNight = new THREE.Color(0.012, 0.018, 0.035);
    const fc = fogDay.clone().lerp(fogDusk, low * 0.7).multiplyScalar(0.25 + 0.75 * day).lerp(fogNight, this.night);
    this.scene.fog.color.copy(fc);
    this.scene.fog.density = 3.0 / this.visibility;
    shared.uFogSunColor.value.copy(this.sunColor).multiplyScalar(1.2 * day).lerp(fc, 0.3);
    shared.uSunView.value.copy(this.sunDir).transformDirection(camera.matrixWorldInverse);

    // exposição: o céu Preetham é muito claro; à noite abrimos mais
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.6, 0.52, day);
    this.envGround.material.color.setRGB(0.09, 0.1, 0.08).multiplyScalar(0.05 + day * 1.5);

    this._envTimer += dt;
    if (this._envTimer > this.tier.envInterval || this._lastSun.distanceTo(this.sunDir) > 0.02) {
      this._envTimer = 0; this._lastSun.copy(this.sunDir);
      const old = this.envRT;
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = 1.15;
      old?.dispose();
    }
  }
}
