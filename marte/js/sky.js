// Céu, Sol, luas, tempo marciano, clima básico e iluminação.
import * as THREE from 'three';
import { MARS, GAME } from './config.js';
import { shared } from './materials.js';

const D2R = Math.PI / 180;

// ---------------------------------------------------------------- shader do céu
const skyVert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;            // sempre no plano distante
}`;

const skyFrag = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uSun;         // direção do Sol (mundo)
uniform vec3 uPhobos;
uniform vec3 uDeimos;
uniform vec3 uEarth;
uniform float uTau;        // profundidade óptica da poeira
uniform float uSunRadius;  // raio angular (rad)
uniform float uPhobosRadius;
uniform float uStarRot;    // rotação do céu estrelado
uniform float uGround;     // 1 = desenhar metade inferior (para o mapa de ambiente)
uniform vec3 uGroundColor;
uniform float uHalo;       // menor no mapa de ambiente: o halo azul não deve tingir o chão

float hash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }

// função de fase de Henyey-Greenstein
float hg( float mu, float g ) { float g2 = g * g; return ( 1.0 - g2 ) / ( 4.0 * 3.14159265 * pow( 1.0 + g2 - 2.0 * g * mu, 1.5 ) ); }

vec3 marsSky( vec3 v, vec3 s ) {
  float mu = dot( v, s );
  float sunH = s.y;
  float vy = max( v.y, 0.0 );
  // quanto de "dia" há: o crepúsculo marciano é longo por causa da poeira alta
  float day = smoothstep( -0.28, 0.12, sunH );
  float high = smoothstep( 0.0, 0.5, sunH );
  float dust = clamp( uTau / 0.6, 0.3, 6.0 );

  // céu caramelo: horizonte mais claro, zênite mais escuro
  vec3 zen = vec3( 0.40, 0.235, 0.13 );
  vec3 hor = vec3( 0.80, 0.53, 0.33 );
  float grad = pow( 1.0 - vy, 2.6 );
  vec3 base = mix( zen, hor, grad );
  // com o Sol baixo, o lado oposto fica cinza-acastanhado e escuro
  float antisun = 0.5 + 0.5 * mu;
  base *= mix( 0.35 + 0.65 * antisun, 1.0, high );
  vec3 col = base * ( 0.10 + 1.05 * high + 0.2 * day );

  // halo azul em volta do Sol: a poeira espalha o azul para frente
  float lobe = hg( mu, 0.82 );
  float lobeWide = hg( mu, 0.55 );
  vec3 blue = vec3( 0.26, 0.46, 1.0 );
  vec3 white = vec3( 1.0, 0.93, 0.85 );
  float lowSun = 1.0 - smoothstep( 0.05, 0.6, sunH );
  vec3 halo = mix( white, blue, 0.3 + 0.6 * lowSun ) * ( lobe * 1.25 + lobeWide * 0.22 );
  float horizonBoost = mix( 1.0, 1.0 + 0.6 * pow( 1.0 - vy, 4.0 ), lowSun );
  col += halo * day * horizonBoost / dust * uHalo;

  // tempestade: céu mais uniforme, escuro e alaranjado
  float storm = clamp( ( uTau - 1.0 ) / 3.0, 0.0, 1.0 );
  col = mix( col, vec3( 0.42, 0.26, 0.15 ) * ( 0.1 + 0.9 * high ), storm * 0.8 );

  // noite: brilho residual mínimo
  col += vec3( 0.0012, 0.0010, 0.0010 ) * ( 1.0 - day );
  return col * day + col * 0.08 * ( 1.0 - day );
}

vec3 moonDisk( vec3 v, vec3 dir, float r, vec3 s, vec3 tint ) {
  float c = dot( v, dir );
  float ang = acos( clamp( c, -1.0, 1.0 ) );
  if ( ang > r * 1.6 || dir.y < -0.05 ) return vec3( 0.0 );
  float x = ang / r;
  float edge = 1.0 - smoothstep( 0.85, 1.0, x );
  // normal de uma esfera vista de frente, para a fase iluminada
  vec3 t1 = normalize( cross( dir, vec3( 0.0, 1.0, 0.0 ) ) );
  vec3 t2 = cross( t1, dir );
  vec3 off = v - dir * c;
  float px = dot( off, t1 ) / r, py = dot( off, t2 ) / r;
  float pz = sqrt( max( 1.0 - px * px - py * py, 0.0 ) );
  vec3 n = normalize( -dir * pz + t1 * px + t2 * py );
  float lit = max( dot( n, s ), 0.0 );
  return tint * ( lit * 0.9 + 0.02 ) * edge;
}

void main() {
  vec3 v = normalize( vDir );
  vec3 s = normalize( uSun );
  vec3 col;
  if ( v.y < 0.0 && uGround > 0.5 ) {
    col = uGroundColor;
  } else {
    vec3 vv = vec3( v.x, max( v.y, 0.0 ), v.z );
    col = marsSky( normalize( vv + vec3( 0.0, 0.0001, 0.0 ) ), s );
    float lum = dot( col, vec3( 0.3, 0.5, 0.2 ) );

    // disco do Sol: 0,35° de diâmetro, com escurecimento de borda
    float ca = dot( v, s );
    float ang = acos( clamp( ca, -1.0, 1.0 ) );
    float airmass = 1.0 / max( s.y + 0.03, 0.03 );
    float ext = exp( -uTau * airmass * 0.9 );
    if ( ang < uSunRadius * 1.25 ) {
      float x = ang / uSunRadius;
      float limb = 1.0 - 0.45 * ( 1.0 - sqrt( max( 1.0 - x * x, 0.0 ) ) );
      float disk = ( 1.0 - smoothstep( 0.92, 1.12, x ) ) * limb;
      col += vec3( 1.0, 0.96, 0.9 ) * disk * 900.0 * ext;
    }
    // brilho de proximidade (glare)
    col += vec3( 1.0, 0.95, 0.9 ) * exp( -ang * 60.0 ) * 6.0 * ext;

    // estrelas (fracas de dia; a atmosfera rarefeita quase não as faz cintilar)
    float c = cos( uStarRot ), sn = sin( uStarRot );
    vec3 sv = vec3( c * v.x - sn * v.z, v.y, sn * v.x + c * v.z );
    vec3 cell = floor( sv * 420.0 );
    float h = hash( cell );
    float star = step( 0.9965, h ) * pow( hash( cell + 7.1 ), 6.0 );
    vec3 fp = fract( sv * 420.0 ) - 0.5;
    star *= smoothstep( 0.5, 0.0, length( fp ) );
    float night = 1.0 - smoothstep( 0.002, 0.05, lum );
    vec3 starCol = mix( vec3( 1.0, 0.8, 0.65 ), vec3( 0.75, 0.85, 1.0 ), hash( cell + 3.3 ) );
    col += starCol * star * 0.9 * night * smoothstep( -0.02, 0.1, v.y ) / clamp( uTau, 0.5, 5.0 ) * 0.6;
    // Terra: um ponto azulado brilhante
    float ea = acos( clamp( dot( v, normalize( uEarth ) ), -1.0, 1.0 ) );
    col += vec3( 0.55, 0.75, 1.0 ) * smoothstep( 0.0022, 0.0, ea ) * 1.6 * night;

    // Fobos e Deimos
    col += moonDisk( v, normalize( uPhobos ), uPhobosRadius, s, vec3( 0.13, 0.11, 0.10 ) ) * ( 0.4 + 2.0 * night );
    col += moonDisk( v, normalize( uDeimos ), 0.0011, s, vec3( 0.16, 0.14, 0.12 ) ) * ( 0.4 + 2.0 * night );
  }
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- utilidades astronômicas
function sunDirection(latDeg, hourLMST, lsDeg, out) {
  const dec = Math.asin(Math.sin(MARS.obliquityDeg * D2R) * Math.sin(lsDeg * D2R));
  const lat = latDeg * D2R;
  const H = (hourLMST - 12) * 15 * D2R;
  const up = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const east = -Math.cos(dec) * Math.sin(H);
  const north = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H);
  return out.set(east, up, -north).normalize();         // mundo: +x leste, +z sul
}

// direção de uma lua em órbita equatorial vista de um ponto na latitude dada
function moonDirection(latDeg, hoursSinceEpoch, moon, phase0, out) {
  const lat = latDeg * D2R;
  const solH = MARS.solSeconds / 3600;
  const wRel = 2 * Math.PI * (1 / moon.periodH - 1 / solH);   // rad/h no referencial de Marte
  const th = phase0 + wRel * hoursSinceEpoch;
  const R = MARS.radius;
  // referencial: x = meridiano local no equador, y = leste, z = norte
  const px = moon.a * Math.cos(th) - R * Math.cos(lat);
  const py = moon.a * Math.sin(th);
  const pz = -R * Math.sin(lat);
  const up = px * Math.cos(lat) + pz * Math.sin(lat);
  const north = -px * Math.sin(lat) + pz * Math.cos(lat);
  return out.set(py, up, -north).normalize();
}

// ---------------------------------------------------------------- sistema de ambiente
export class Environment {
  constructor(renderer, scene, meta, tier) {
    this.renderer = renderer;
    this.scene = scene;
    this.lat = meta.lat;
    this.tier = tier;
    this.hour = GAME.startHour;         // hora marciana (0–24 "horas de Marte")
    this.sol = 1;
    this.ls = GAME.startLs;
    this.tau = 0.55;                    // opacidade típica fora de tempestade
    this.timeScale = 1;
    this.wind = new THREE.Vector3(3, 0, 1);
    this.windSpeed = 4;
    this._windPhase = Math.random() * 100;

    this.sunDir = new THREE.Vector3();
    this.phobosDir = new THREE.Vector3();
    this.deimosDir = new THREE.Vector3();
    this.earthDir = new THREE.Vector3();
    this.sunColor = new THREE.Color();
    this.sunIntensity = 0;
    this.ambient = 0;

    this.uniforms = {
      uSun: { value: this.sunDir }, uPhobos: { value: this.phobosDir }, uDeimos: { value: this.deimosDir },
      uEarth: { value: this.earthDir }, uTau: { value: this.tau },
      uSunRadius: { value: MARS.sunAngularDiamDeg * 0.5 * D2R },
      uPhobosRadius: { value: Math.atan(MARS.phobos.radius / (MARS.phobos.a - MARS.radius)) * 1.0 },
      uStarRot: { value: 0 }, uGround: { value: 0 }, uHalo: { value: 1 }, uGroundColor: { value: new THREE.Color(0.1, 0.06, 0.04) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false, toneMapped: true,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // cena só do céu (com chão) para o mapa de ambiente (reflexos no visor e IBL)
    const envMat = mat.clone();
    envMat.uniforms = { ...this.uniforms, uGround: { value: 1 }, uHalo: { value: 0.2 } };
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), envMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this._envTimer = 1e9;

    scene.fog = new THREE.FogExp2(0xb07a52, 0.0009);
    this.exposure = 1;
    this._tmp = new THREE.Vector3();
    this.update(0, new THREE.Vector3());
  }

  get lmst() { return this.hour; }
  setHour(h) { this.hour = ((h % 24) + 24) % 24; this._envTimer = 1e9; }

  // temperatura do ar a ~1,5 m em Jezero (perfil tipo MEDA/Perseverance)
  get airTempC() {
    const h = this.hour;
    const tMin = -82, tMax = -18;
    // mínimo perto das 5h, máximo perto das 14h
    let x;
    if (h >= 5 && h < 14) x = 0.5 - 0.5 * Math.cos(Math.PI * (h - 5) / 9);
    else { const hh = h < 5 ? h + 24 : h; x = 0.5 + 0.5 * Math.cos(Math.PI * (hh - 14) / 15); }
    const stormDamp = Math.min(Math.max((this.tau - 1) / 3, 0), 1);
    const mid = (tMin + tMax) / 2;
    return mid + (tMin + (tMax - tMin) * x - mid) * (1 - 0.6 * stormDamp);
  }
  get pressureKPa() { return MARS.pressureKPa * (1 + 0.035 * Math.cos((this.hour - 6) / 24 * 2 * Math.PI)); }

  update(dt, cameraPos, camera) {
    // tempo: 1 sol = GAME.solRealSeconds
    const dh = dt * 24 / GAME.solRealSeconds * this.timeScale;
    this.hour += dh;
    if (this.hour >= 24) { this.hour -= 24; this.sol++; }
    this.ls = (GAME.startLs + (this.sol - 1 + this.hour / 24) * 360 / 668.6) % 360;

    sunDirection(this.lat, this.hour, this.ls, this.sunDir);
    const hoursAbs = ((this.sol - 1) * 24 + this.hour) * MARS.solSeconds / 3600 / 24;   // horas terrestres
    moonDirection(this.lat, hoursAbs, MARS.phobos, 2.1, this.phobosDir);
    moonDirection(this.lat, hoursAbs, MARS.deimos, 4.0, this.deimosDir);
    // Terra: estrela da tarde/manhã, a ~30° do Sol
    this.earthDir.copy(this.sunDir).applyAxisAngle(new THREE.Vector3(0.2, 1, 0.1).normalize(), 0.55);
    if (this.earthDir.y < 0.05) this.earthDir.y = Math.abs(this.earthDir.y) + 0.05;
    this.uniforms.uStarRot.value = (this.hour / 24) * Math.PI * 2;
    this.uniforms.uTau.value = this.tau;

    // vento: brisa diurna mais forte à tarde, calma à noite; rajadas suaves
    this._windPhase += dt * 0.05 * this.timeScale;
    const diurnal = 2 + 5 * Math.max(0, Math.sin((this.hour - 8) / 12 * Math.PI));
    this.windSpeed = diurnal * (0.75 + 0.25 * Math.sin(this._windPhase * 3.1) + 0.15 * Math.sin(this._windPhase * 7.3)) * (1 + Math.max(0, this.tau - 1) * 1.5);
    const wa = 0.6 + 0.4 * Math.sin(this._windPhase * 0.7);
    this.wind.set(Math.cos(wa), 0, Math.sin(wa)).multiplyScalar(this.windSpeed);

    // ---- luz direta: extinção da poeira pela massa de ar (Kasten-Young simplificado)
    const el = Math.asin(THREE.MathUtils.clamp(this.sunDir.y, -1, 1)) / D2R;
    const am = el > -2 ? 1 / (Math.sin(Math.max(el, 0.1) * D2R) + 0.50572 * Math.pow(Math.max(el, 0) + 6.07995, -1.6364)) : 40;
    const trR = Math.exp(-this.tau * am * 0.78), trG = Math.exp(-this.tau * am * 0.88), trB = Math.exp(-this.tau * am * 1.02);
    const above = THREE.MathUtils.smoothstep(el, -1.0, 1.5);
    const I0 = 5.2;      // irradiância solar de Marte (43% da Terra) em unidades da cena
    this.sunIntensity = I0 * above * (trR * 0.3 + trG * 0.5 + trB * 0.2);
    this.sunColor.setRGB(trR, trG, trB);
    const m = Math.max(this.sunColor.r, this.sunColor.g, this.sunColor.b, 1e-4);
    this.sunColor.multiplyScalar(1 / m);
    // luz difusa do céu: em Marte é grande (poeira), e dura pelo crepúsculo
    const dayAmt = THREE.MathUtils.smoothstep(this.sunDir.y, -0.28, 0.12);
    this.ambient = dayAmt * (0.25 + 0.9 * THREE.MathUtils.smoothstep(this.sunDir.y, 0, 0.6)) * (0.8 + 0.2 * Math.min(this.tau, 2));

    // ---- névoa de poeira
    const fog = this.scene.fog;
    const dens = 0.00016 + this.tau * 0.00032 + Math.max(0, this.tau - 1) * 0.003;
    fog.density = dens;
    const fogDay = new THREE.Color(0.74, 0.49, 0.32).multiplyScalar(0.02 + 1.0 * dayAmt * (0.35 + 0.65 * THREE.MathUtils.smoothstep(this.sunDir.y, 0, 0.5)));
    fog.color.copy(fogDay);
    shared.uFogSunColor.value.setRGB(0.95, 0.85, 0.78).multiplyScalar(0.02 + 1.6 * dayAmt).lerp(new THREE.Color(0.5, 0.62, 0.85).multiplyScalar(1.4 * dayAmt), THREE.MathUtils.smoothstep(this.sunDir.y, 0.5, 0.0) * 0.6);
    if (camera) shared.uSunView.value.copy(this.sunDir).transformDirection(camera.matrixWorldInverse);

    // ---- chão do mapa de ambiente: albedo do regolito iluminado
    const gIrr = this.sunIntensity * Math.max(this.sunDir.y, 0) * 0.3 + this.ambient * 0.35;
    this.uniforms.uGroundColor.value.setRGB(0.36 * gIrr, 0.2 * gIrr, 0.12 * gIrr);

    // ---- exposição automática (como o olho/câmera se adaptando), limitada à noite
    const sceneLum = this.sunIntensity * Math.max(this.sunDir.y, 0.05) * 0.25 + this.ambient * 0.5 + 0.004;
    const target = THREE.MathUtils.clamp(0.3 / sceneLum, 0.5, 7);
    this.exposure += (target - this.exposure) * Math.min(1, dt * 1.5 + (this._firstExposure ? 0 : 1));
    this._firstExposure = true;
    this.renderer.toneMappingExposure = this.exposure;

    this.sky.position.copy(cameraPos);

    // ---- mapa de ambiente (IBL), atualizado de tempos em tempos
    this._envTimer += dt;
    if (this._envTimer > this.tier.envInterval) {
      this._envTimer = 0;
      const old = this.envRT;
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 100, { size: this.tier.envSize });
      this.scene.environment = this.envRT.texture;
      if (old) old.dispose();
    }
  }
}
