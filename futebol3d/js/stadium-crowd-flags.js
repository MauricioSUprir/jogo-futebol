// Bandeiras da torcida: mastros agitados por torcedores, pano tremulando com
// desenho nas cores do clube (faixas, meio a meio, diagonal). Uma chamada de desenho.
import * as THREE from 'three';
import { BOWL, ROOF_GLSL } from './stadium-bowl.js';

const flagVert = /* glsl */`
uniform float uTime;
uniform float uExc;
uniform vec4 uEvHome;
uniform vec4 uEvAway;
uniform vec3 uSunCol;
uniform vec3 uAmb;
${ROOF_GLSL}
float react( float t0, float dur ) {
  float t = uTime - t0;
  return t < 0.0 ? 0.0 : smoothstep( 0.0, 0.25, t ) * ( 1.0 - smoothstep( dur * 0.6, dur, t ) );
}
attribute vec4 aPos;   // base do mastro (x, y, z) + d
attribute vec4 aInfo;  // nx, nz, semente, visitante
attribute vec4 aColA;  // cor 1 + desenho
attribute vec4 aColB;  // cor 2 + tamanho
attribute float aPart; // 0 = pano, 1 = mastro
varying vec2 vUv;
varying vec3 vColA;
varying vec3 vColB;
varying float vDesign;
varying vec3 vLight;
varying float vPart;
void main() {
  float seed = aInfo.z;
  float size = 0.8 + aColB.w * 0.9;
  vec3 n = vec3( aInfo.x, 0.0, aInfo.y );
  vec3 tang = vec3( -aInfo.y, 0.0, aInfo.x ) * ( seed > 0.5 ? 1.0 : -1.0 );
  vec4 evMine = aInfo.w > 0.5 ? uEvAway : uEvHome;
  float wave = 1.0 + react( evMine.x, 10.0 ) * 1.6 + uExc * 0.8;
  // mastro em arco: a pessoa agita a bandeira de um lado para o outro
  float swing = sin( uTime * ( 1.3 + seed ) * wave + seed * 30.0 ) * ( 0.25 + 0.2 * uExc + 0.3 * react( evMine.x, 10.0 ) );
  vec3 up = normalize( vec3( 0.0, 1.0, 0.0 ) + tang * swing - n * 0.12 );
  float mast = 2.4 * size;
  vec3 p;
  float u = position.x, v = position.y;
  vec3 base = aPos.xyz + vec3( 0.0, 1.3, 0.0 );
  if ( aPart > 0.5 ) {
    p = base + up * ( v * mast ) + tang * ( u - 0.5 ) * 0.045 - n * ( u - 0.5 ) * 0.02;
  } else {
    vec3 top = base + up * mast;
    float fl = 1.5 * size, fh = 0.95 * size;
    float ph = uTime * 5.5 * wave + seed * 20.0 - u * 5.5;
    // o pano cai um pouco quando o vento/agito diminui
    vec3 along = normalize( tang - up * ( 0.35 - 0.25 * min( wave - 1.0, 1.0 ) ) );
    p = top - up * ( 1.0 - v ) * fh + along * u * fl;
    p += n * ( sin( ph ) * 0.22 * u + sin( ph * 1.7 + v * 2.0 ) * 0.06 * u ) + up * cos( ph * 0.7 ) * 0.06 * u;
  }
  float camD = length( cameraPosition - aPos.xyz );
  vUv = vec2( u, v );
  vPart = aPart;
  vColA = pow( aColA.rgb, vec3( 2.2 ) );
  vColB = pow( aColB.rgb, vec3( 2.2 ) );
  vDesign = aColA.w * 255.0;
  vec3 toCam = normalize( cameraPosition - p );
  float lit = roofLit( aPos.w, p.y, aInfo.xy );
  vec3 nn = normalize( n * sign( dot( n, toCam ) ) + vec3( 0.0, 0.25, 0.0 ) );
  vLight = uAmb * 1.3 + uSunCol * ( 0.35 + 0.65 * max( dot( nn, uSunDir ), 0.0 ) ) * lit;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
  if ( camD < 7.0 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
}`;

const flagFrag = /* glsl */`
varying vec2 vUv;
varying vec3 vColA;
varying vec3 vColB;
varying float vDesign;
varying vec3 vLight;
varying float vPart;
void main() {
  vec3 c;
  if ( vPart > 0.5 ) c = vec3( 0.2 );
  else {
    float d = floor( vDesign + 0.5 );
    float m;
    if ( d < 0.5 ) m = step( abs( vUv.y - 0.5 ), 0.17 );                 // faixa horizontal
    else if ( d < 1.5 ) m = step( 0.5, vUv.x );                          // meio a meio
    else if ( d < 2.5 ) m = step( abs( vUv.x * 0.65 - vUv.y + 0.18 ), 0.16 );  // diagonal
    else m = step( 0.5, fract( vUv.x * 2.5 ) );                          // listras
    c = mix( vColA, vColB, m );
    // dobras do tecido
    c *= 0.82 + 0.18 * sin( vUv.x * 18.0 + vUv.y * 3.0 );
  }
  gl_FragColor = vec4( c * vLight, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildFlags({ U, seats, rng, count, palH, palA }) {
  const n = seats.length / 8;
  const fl = [];
  const cols = [];
  const col = new THREE.Color();
  const push = (h, w) => { col.set(h).convertLinearToSRGB(); cols.push(col.r * 255, col.g * 255, col.b * 255, w); };
  for (let tries = 0; fl.length < count * 8 && tries < 8000; tries++) {
    const i = Math.floor(rng() * n) * 8;
    const x = seats[i], z = seats[i + 2];
    const end = Math.abs(x) > BOWL.A - 2;
    if (rng() > (end ? 1 : 0.3)) continue;
    const away = seats[i + 7] % 2;
    fl.push(x, seats[i + 1], z, seats[i + 3], seats[i + 4], seats[i + 5], rng(), away);
    const pal = away ? palA : palH;
    const pairs = [[pal.primary, pal.secondary], [pal.kit.shirt, pal.kit.second], [pal.secondary, pal.primary], [pal.kit.shirt, pal.accent]];
    let [a, b] = pairs[Math.floor(rng() * pairs.length)];
    if (a.toLowerCase() === b.toLowerCase()) b = pal.accent === a ? '#f2f2f2' : pal.accent;
    push(a, Math.floor(rng() * 4));
    push(b, Math.floor((end ? 0.4 + rng() * 0.6 : rng() * 0.6) * 255));
  }
  const fb = new THREE.InstancedBufferGeometry();
  const fp = [], fpart = [], fi = [];
  const NU = 10, NV = 3;
  for (let v = 0; v <= NV; v++) for (let u = 0; u <= NU; u++) { fp.push(u / NU, v / NV, 0); fpart.push(0); }
  for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) {
    const a = v * (NU + 1) + u, b = a + 1, c = a + NU + 2, d = a + NU + 1;
    fi.push(a, b, c, a, c, d);
  }
  const o = fp.length / 3;
  fp.push(0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0); fpart.push(1, 1, 1, 1);
  fi.push(o, o + 1, o + 2, o, o + 2, o + 3);
  fb.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fb.setAttribute('aPart', new THREE.Float32BufferAttribute(fpart, 1));
  fb.setIndex(fi);
  const fib = new THREE.InstancedInterleavedBuffer(new Float32Array(fl), 8, 1);
  fb.setAttribute('aPos', new THREE.InterleavedBufferAttribute(fib, 4, 0));
  fb.setAttribute('aInfo', new THREE.InterleavedBufferAttribute(fib, 4, 4));
  const cib = new THREE.InstancedInterleavedBuffer(new Uint8Array(cols), 8, 1);
  fb.setAttribute('aColA', new THREE.InterleavedBufferAttribute(cib, 4, 0, true));
  fb.setAttribute('aColB', new THREE.InterleavedBufferAttribute(cib, 4, 4, true));
  fb.instanceCount = fl.length / 8;
  const uniforms = {
    uTime: U.uTime, uExc: U.uExc, uEvHome: U.uEvHome, uEvAway: U.uEvAway,
    uSunDir: U.uSunDir, uShadeOn: U.uShadeOn, uSunCol: U.uSunCol, uAmb: U.uAmbCrowd,
  };
  const fmat = new THREE.ShaderMaterial({ uniforms, vertexShader: flagVert, fragmentShader: flagFrag, side: THREE.DoubleSide });
  const flags = new THREE.Mesh(fb, fmat);
  flags.frustumCulled = false;
  flags.name = 'bandeiras-torcida';
  flags.userData.tris = (fi.length / 3) * fb.instanceCount;
  return flags;
}
