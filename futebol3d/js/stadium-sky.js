// Estádio: céu (Preetham com nuvens procedurais de dia/tarde; estrelado à noite)
// e o ambiente PMREM usado nos reflexos (vidros, telões, traves, cobertura).
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

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
float h2( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float n2( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h2( i ), h2( i + vec2( 1, 0 ) ), f.x ), mix( h2( i + vec2( 0, 1 ) ), h2( i + vec2( 1, 1 ) ), f.x ), f.y ); }
void main() {
  vec3 d = normalize( vDir );
  float h = max( d.y, 0.0 );
  vec3 col = mix( vec3( 0.03, 0.034, 0.05 ), vec3( 0.003, 0.005, 0.013 ), pow( h, 0.45 ) );
  col += vec3( 0.07, 0.058, 0.05 ) * exp( -h * 6.0 );            // halo da cidade/estádio
  vec3 p = d * 320.0;
  vec3 i = floor( p );
  float r = h3( i );
  float st = step( 0.9965, r ) * smoothstep( 0.42, 0.0, length( fract( p ) - 0.5 ) );
  // nuvens noturnas finas, iluminadas por baixo pela luz do estádio
  vec2 cp = d.xz / ( d.y + 0.1 ) * 1.4;
  float c = n2( cp * 1.3 ) * 0.6 + n2( cp * 2.9 + 3.1 ) * 0.3 + n2( cp * 6.1 ) * 0.1;
  float cov = smoothstep( 0.52, 0.8, c ) * smoothstep( 0.02, 0.25, h );
  col += vec3( 0.9, 0.93, 1.0 ) * st * ( 0.4 + 2.0 * h3( i + 7.1 ) ) * smoothstep( 0.05, 0.35, h ) * ( 1.0 - cov );
  col = mix( col, vec3( 0.05, 0.05, 0.055 ) * ( 1.0 + 1.5 * exp( -h * 4.0 ) ), cov * 0.8 );
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// nuvens: plano de nuvens projetado na direção de visão, fbm de valor
const CLOUD_GLSL = /* glsl */`
uniform float skyGain;
uniform float uCloud;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
float ch( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float cn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( ch( i ), ch( i + vec2( 1, 0 ) ), f.x ), mix( ch( i + vec2( 0, 1 ) ), ch( i + vec2( 1, 1 ) ), f.x ), f.y ); }
float cfbm( vec2 p ) { float a = 0.5, s = 0.0; for ( int i = 0; i < CLOUD_OCT; i ++ ) { s += a * cn( p ); p = mat2( 1.6, 1.2, -1.2, 1.6 ) * p + 7.3; a *= 0.5; } return s; }
`;
const CLOUD_MAIN = /* glsl */`
  vec3 col = retColor * skyGain;
  if ( direction.y > 0.0 ) {
    vec2 cp = direction.xz / ( direction.y + 0.08 ) * 1.1;
    float n = cfbm( cp + vec2( 3.0, 1.0 ) );
    float n2 = cfbm( cp * 2.3 + 11.0 );
    float cov = smoothstep( 0.62 - uCloud * 0.3, 0.86 - uCloud * 0.2, n * 0.75 + n2 * 0.25 );
    float thick = smoothstep( 0.55, 0.95, n );
    float sunF = pow( max( dot( direction, normalize( vSunDirection ) ), 0.0 ), 6.0 );
    vec3 cc = mix( uCloudLit, uCloudShade, thick * 0.75 );
    cc += uCloudLit * sunF * ( 1.0 - thick ) * 0.9;           // bordas prateadas perto do sol
    float fade = smoothstep( 0.0, 0.16, direction.y );
    col = mix( col, cc, cov * fade * 0.94 );
  }
  gl_FragColor = vec4( col, 1.0 );`;

export function buildSky(isNight, P, detail) {
  if (isNight) {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      vertexShader: nightSkyVert, fragmentShader: nightSkyFrag, side: THREE.BackSide, depthWrite: false,
    }));
    sky.frustumCulled = false; sky.renderOrder = -10; sky.name = 'ceu';
    return { sky, skyMat: null };
  }
  const sky = new Sky();
  const skyMat = sky.material;
  skyMat.defines = { CLOUD_OCT: detail === 0 ? 3 : 5 };
  skyMat.fragmentShader = skyMat.fragmentShader
    .replace('uniform vec3 up;', 'uniform vec3 up;\n' + CLOUD_GLSL)
    .replace('gl_FragColor = vec4( retColor, 1.0 );', CLOUD_MAIN);
  const u = skyMat.uniforms;
  u.skyGain = { value: P.sky.gain };
  u.uCloud = { value: P.clouds.cover };
  u.uCloudLit = { value: new THREE.Color(...P.clouds.lit) };
  u.uCloudShade = { value: new THREE.Color(...P.clouds.shade) };
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) u[k].value = P.sky[k];
  const D2R = Math.PI / 180, se = P.skyEl * D2R;
  u.sunPosition.value.set(P.az[0] * Math.cos(se), Math.sin(se), P.az[1] * Math.cos(se));
  sky.scale.setScalar(900);
  sky.frustumCulled = false; sky.name = 'ceu';
  return { sky, skyMat };
}

// ambiente para reflexos: céu + anel de arquibancadas com faixas (camarotes,
// fita de LED, cobertura, refletores) visto do centro do campo
export function buildEnv(renderer, isNight, skyMat, colors) {
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
  const band = (r0, r1, y0, y1, color) => {
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 48, 1, true);
    g.translate(0, (y0 + y1) / 2, 0);
    return add(g, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  };
  const crowdCol = new THREE.Color(colors.home).multiplyScalar(0.25).lerp(new THREE.Color(0.1, 0.1, 0.1), 0.5);
  const k = isNight ? 1.4 : 1;
  band(60, 64, -1, 10, crowdCol.clone().multiplyScalar(k));
  band(64, 65, 10, 13, isNight ? new THREE.Color(1.6, 1.15, 0.7) : new THREE.Color(0.1, 0.12, 0.14)); // camarotes
  band(65, 65.2, 13, 14.8, new THREE.Color(colors.accent).multiplyScalar(isNight ? 2.5 : 1.2));       // fita de LED
  band(65.2, 72, 14.8, 28, crowdCol.clone().multiplyScalar(k * 0.9));
  band(72, 72, 28, 31, new THREE.Color(isNight ? 0.02 : 0.2, isNight ? 0.02 : 0.21, isNight ? 0.025 : 0.23));
  const ground = new THREE.CircleGeometry(80, 32);
  ground.rotateX(-Math.PI / 2); ground.translate(0, -2, 0);
  add(ground, new THREE.MeshBasicMaterial({ color: isNight ? new THREE.Color(0.07, 0.16, 0.05) : new THREE.Color(0.1, 0.22, 0.06) }));
  if (isNight) {
    // faixas de refletores sob a cobertura: dão reflexos brilhantes em traves e vidros
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const panel = add(new THREE.PlaneGeometry(50, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.98, 0.95).multiplyScalar(22), side: THREE.DoubleSide }));
      panel.position.set(Math.cos(a) * 55, 30, Math.sin(a) * 55);
      panel.lookAt(0, 0, 0);
    }
    const roof = new THREE.CylinderGeometry(70, 70, 4, 48, 1, true);
    roof.translate(0, 33, 0);
    add(roof, new THREE.MeshBasicMaterial({ color: 0x050608, side: THREE.BackSide }));
  }
  const rt = pmrem.fromScene(env, 0.02, 0.1, 1000);
  disposables.forEach((d) => d.dispose());
  pmrem.dispose();
  return rt;
}
