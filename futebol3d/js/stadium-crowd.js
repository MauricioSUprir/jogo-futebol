// Torcida instanciada: cada instância são 2 torcedores (2 quads) que olham para a
// câmera (billboard cilíndrico). Toda a animação é no shader: balanço, palmas,
// braços para cima, ficar de pé e pular, conforme `uExc` e pulsos por torcida.
// Inclui bandeiras tremulando nas arquibancadas (1 chamada de desenho extra).
import * as THREE from 'three';
import { BOWL, ROOF_GLSL, crowdSeats } from './stadium-bowl.js';

// textura de silhueta: 2 quadros (braços abaixados | braços erguidos).
// Canais: R = camisa, G = pele, B = escuro (cabelo/calça), A = cobertura.
function silhouetteTexture() {
  const W = 256, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  const fw = 128;
  const Y = (v) => H * (1 - v);          // v: 0 = base, 1 = topo
  const rr = (x, y, w, h, r, col) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  for (let f = 0; f < 2; f++) {
    const ox = f * fw, cx = ox + fw / 2;
    // pernas / calça (base até o quadril)
    rr(cx - 34, Y(0.40), 68, H * 0.42, 10, '#0000ff');
    // tronco com ombros arredondados
    rr(cx - 44, Y(0.74), 88, H * 0.38, [22, 22, 8, 8], '#ff0000');
    // pescoço + cabeça
    rr(cx - 9, Y(0.79), 18, H * 0.07, 4, '#00ff00');
    g.fillStyle = '#00ff00'; g.beginPath(); g.ellipse(cx, Y(0.855), 19, 23, 0, 0, Math.PI * 2); g.fill();
    // cabelo (topo da cabeça)
    g.fillStyle = '#0000ff'; g.beginPath(); g.ellipse(cx, Y(0.875), 20, 18, 0, Math.PI, Math.PI * 2); g.fill();
    if (f === 0) {
      // braços ao lado do corpo
      rr(cx - 56, Y(0.72), 18, H * 0.30, 9, '#ff0000');
      rr(cx + 38, Y(0.72), 18, H * 0.30, 9, '#ff0000');
      g.fillStyle = '#00ff00';
      g.beginPath(); g.arc(cx - 47, Y(0.42), 9, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + 47, Y(0.42), 9, 0, Math.PI * 2); g.fill();
    } else {
      // braços erguidos em "V"
      for (const s of [-1, 1]) {
        g.save();
        g.translate(cx + s * 36, Y(0.70));
        g.rotate(s * 0.38);
        rr(-9, -H * 0.30, 18, H * 0.31, 9, '#ff0000');
        g.fillStyle = '#00ff00'; g.beginPath(); g.arc(0, -H * 0.30, 10, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

const COMMON_GLSL = /* glsl */`
uniform float uTime;
uniform float uExc;
uniform vec4 uEvHome;   // instante (s) do último: gol, chance, falta, defesa
uniform vec4 uEvAway;
uniform vec3 uHomeCol;
uniform vec3 uAwayCol;
float h11( float n ) { return fract( sin( n * 91.3458 ) * 47453.5453 ); }
// envelope de reação: sobe rápido, dura "dur" segundos
float react( float t0, float dur ) {
  float t = uTime - t0;
  return t < 0.0 ? 0.0 : smoothstep( 0.0, 0.25, t ) * ( 1.0 - smoothstep( dur * 0.6, dur, t ) );
}
`;

const crowdVert = /* glsl */`
${COMMON_GLSL}
${ROOF_GLSL}
attribute vec4 aPos;     // x, y (degrau), z, d (distância do anel)
attribute vec4 aInfo;    // nx, nz, semente, flags (1 = visitante, 2 = anel superior)
attribute float aSub;
varying vec2 vUv;
varying vec3 vShirt;
varying vec3 vSkin;
varying vec3 vDark;
varying vec3 vLight;
varying float vFrame;
uniform vec3 uSunCol;
uniform vec3 uAmb;

vec3 skinTone( float r ) {
  if ( r < 0.18 ) return vec3( 0.62, 0.42, 0.30 );
  if ( r < 0.38 ) return vec3( 0.45, 0.28, 0.17 );
  if ( r < 0.58 ) return vec3( 0.28, 0.16, 0.09 );
  if ( r < 0.78 ) return vec3( 0.70, 0.52, 0.40 );
  return vec3( 0.16, 0.09, 0.05 );
}

void main() {
  float seed = fract( aInfo.z * 7.13 + aSub * 0.618 );
  float r1 = h11( seed * 13.1 ), r2 = h11( seed * 27.7 ), r3 = h11( seed * 5.3 ), r4 = h11( seed * 41.9 );
  float away = mod( aInfo.w, 2.0 );
  vec3 tang = vec3( -aInfo.y, 0.0, aInfo.x );
  vec3 base = aPos.xyz + tang * ( aSub - 0.5 ) * 0.55;

  // --- reações (a própria torcida x adversária)
  vec4 evMine = away > 0.5 ? uEvAway : uEvHome;
  vec4 evOpp = away > 0.5 ? uEvHome : uEvAway;
  float dl = r2 * 0.45;
  float goal = react( evMine.x + dl, 9.0 );
  float chance = react( evMine.y + dl, 3.0 );
  float foul = react( evMine.z + dl, 2.2 );
  float save = react( evMine.w + dl, 2.6 ) + react( evOpp.w + dl, 2.0 ) * 0.4;
  float sad = react( evOpp.x + dl, 7.0 );
  float exc = uExc * ( 0.55 + 0.9 * r1 );

  float standUp = clamp( goal + chance * step( 0.25, r1 ) + foul * step( 0.55, r3 ) + save * step( 0.5, r4 )
                        + step( 0.78, exc ) + step( 0.93, r3 ) * step( 0.2, uExc ), 0.0, 1.0 ) * ( 1.0 - sad * 0.8 );
  float ph = uTime * ( 2.1 + r3 * 0.9 ) + r1 * 6.2831;
  float jump = abs( sin( ph * 1.35 ) ) * ( goal * ( 0.22 + 0.2 * r4 ) + chance * 0.06 + step( 0.9, exc ) * 0.08 );
  // cantoria sincronizada por blocos quando a empolgação está alta
  float block = floor( aPos.x / 14.0 ) + floor( aPos.z / 14.0 ) * 3.0;
  jump += uExc * step( 0.55, h11( block ) ) * step( 0.35, r2 ) * abs( sin( uTime * 4.2 ) ) * 0.1;
  float clap = step( 0.0, sin( uTime * 13.0 + r1 * 40.0 ) ) * step( 0.6, exc + chance );
  float arms = clamp( goal * step( 0.2, r2 ) + chance * step( 0.45, r2 ) + foul * step( 0.7, r2 ) + step( 0.95, r4 ) * uExc, 0.0, 1.0 );
  arms = max( arms, clap * step( 0.5, r3 ) );
  vFrame = step( 0.5, arms );

  // --- geometria do quad (cilíndrico, virado para a câmera)
  vec3 toCam = cameraPosition - base;
  vec3 right = normalize( vec3( toCam.z, 0.0, -toCam.x ) + 1e-4 );
  float wScale = 0.52 * ( 0.9 + 0.2 * r3 );
  float hSeat = 1.18 * ( 0.9 + 0.18 * r4 ) - sad * 0.1;
  float h = hSeat + standUp * 0.42;
  vec3 p = base;
  p += right * position.x * wScale;
  p.y += position.y * h + jump;
  p += tang * sin( uTime * ( 0.6 + r2 ) + r1 * 20.0 ) * 0.035 * ( 1.0 + 2.0 * uExc ) * position.y;

  float flip = step( 0.5, r2 ) * 2.0 - 1.0;
  vUv = vec2( ( ( position.x * flip ) + 0.5 ) * 0.5 + vFrame * 0.5, position.y );

  // --- roupas
  vec3 team = away > 0.5 ? uAwayCol : uHomeCol;
  vec3 shirt;
  if ( r1 < ( away > 0.5 ? 0.72 : 0.52 ) ) shirt = team * ( 0.55 + 0.4 * r3 );
  else if ( r1 < 0.7 ) shirt = vec3( 0.62 );
  else if ( r1 < 0.86 ) shirt = vec3( 0.03 );
  else shirt = mix( vec3( 0.05, 0.07, 0.12 ), vec3( 0.35, 0.33, 0.3 ), r3 ) * ( r4 > 0.8 ? vec3( 1.4, 1.1, 0.4 ) : vec3( 1.0 ) );
  vShirt = shirt * ( 0.75 + 0.4 * r4 );
  vSkin = skinTone( r4 );
  vDark = mix( vec3( 0.025, 0.022, 0.02 ), vec3( 0.06, 0.08, 0.13 ), r3 ); // cabelo / jeans

  // --- luz: sol (com sombra da cobertura) + ambiente
  vec3 n = normalize( vec3( toCam.x, 0.0, toCam.z ) ) * 0.6 + vec3( 0.0, 0.8, 0.0 );
  float lit = roofLit( aPos.w, base.y + 1.0, aInfo.xy );
  float lam = 0.35 + 0.65 * max( dot( normalize( n ), uSunDir ), 0.0 );
  vLight = uAmb + uSunCol * lam * lit;

  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}`;

const crowdFrag = /* glsl */`
uniform sampler2D uTex;
varying vec2 vUv;
varying vec3 vShirt;
varying vec3 vSkin;
varying vec3 vDark;
varying vec3 vLight;
varying float vFrame;
void main() {
  vec4 m = texture2D( uTex, vUv );
  // teste alfa com nitidez (preserva a cobertura em mipmaps distantes)
  vec2 px = vUv * vec2( 256.0 );
  float lod = max( 0.0, 0.5 * log2( max( dot( dFdx( px ), dFdx( px ) ), dot( dFdy( px ), dFdy( px ) ) ) ) );
  float a = m.a * ( 1.0 + lod * 0.25 );
  a = ( a - 0.5 ) / max( fwidth( a ), 1e-4 ) + 0.5;
  if ( a < 0.5 ) discard;
  float s = m.r + m.g + m.b + 1e-4;
  vec3 alb = ( vShirt * m.r + vSkin * m.g + vDark * m.b ) / s;
  // sombreado vertical leve: base mais escura (entre as fileiras)
  alb *= mix( 0.45, 1.0, smoothstep( 0.0, 0.55, vUv.y ) );
  gl_FragColor = vec4( alb * vLight, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- bandeiras
const flagVert = /* glsl */`
${COMMON_GLSL}
${ROOF_GLSL}
attribute vec4 aPos;   // base do mastro (x, y, z) + d
attribute vec4 aInfo;  // nx, nz, semente, visitante
attribute float aPart; // 0 = pano, 1 = mastro
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vCol2;
varying vec3 vLight;
varying float vPart;
uniform vec3 uSunCol;
uniform vec3 uAmb;
void main() {
  float seed = aInfo.z;
  vec3 n = vec3( aInfo.x, 0.0, aInfo.y );
  vec3 tang = vec3( -aInfo.y, 0.0, aInfo.x ) * ( seed > 0.5 ? 1.0 : -1.0 );
  vec4 evMine = aInfo.w > 0.5 ? uEvAway : uEvHome;
  float wave = 1.0 + react( evMine.x, 9.0 ) * 1.5 + uExc;
  // mastro balançando (a pessoa agita a bandeira)
  float swing = sin( uTime * ( 1.4 + seed ) * wave + seed * 30.0 ) * 0.35;
  vec3 up = normalize( vec3( 0.0, 1.0, 0.0 ) + tang * swing * 0.5 );
  vec3 p;
  float u = position.x, v = position.y;  // pano: u 0..1 (do mastro), v 0..1
  if ( aPart > 0.5 ) {
    p = aPos.xyz + up * ( v * 2.6 ) + tang * ( u - 0.5 ) * 0.05;
  } else {
    vec3 top = aPos.xyz + up * 2.6;
    float ph = uTime * 5.0 * wave + seed * 20.0 - u * 5.0;
    p = top - up * ( 1.0 - v ) * 0.95 + tang * u * 1.5;
    p += n * sin( ph ) * 0.22 * u + up * cos( ph * 0.7 ) * 0.06 * u;
  }
  vUv = vec2( u, v );
  vPart = aPart;
  vCol = aInfo.w > 0.5 ? uAwayCol : uHomeCol;
  vCol2 = fract( seed * 7.0 ) > 0.5 ? vec3( 0.85 ) : vec3( 0.02 );
  vec3 toCam = normalize( cameraPosition - p );
  float lit = roofLit( aPos.w, p.y, aInfo.xy );
  vLight = uAmb + uSunCol * ( 0.4 + 0.6 * max( dot( normalize( n * sign( dot( n, toCam ) ) ), uSunDir ), 0.0 ) ) * lit;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}`;

const flagFrag = /* glsl */`
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vCol2;
varying vec3 vLight;
varying float vPart;
void main() {
  vec3 c = vPart > 0.5 ? vec3( 0.25 ) : ( abs( vUv.y - 0.5 ) < 0.14 ? vCol2 : vCol );
  gl_FragColor = vec4( c * vLight, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildCrowd(ctx) {
  const { U, quality, homeColor, awayColor } = ctx;
  const group = new THREE.Group();
  group.name = 'torcida';
  const rng = mulberry(1234);
  const occ = Math.min(0.96, 0.42 + 0.54 * (quality.crowd ?? 1));
  const seats = crowdSeats(occ, rng);
  const n = seats.length / 8;

  // geometria base: 2 quads (x -0,5..0,5, y 0..1), aSub = 0/1
  const base = new THREE.InstancedBufferGeometry();
  const pos = [], sub = [], idx = [];
  for (let s = 0; s < 2; s++) {
    const o = s * 4;
    pos.push(-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0);
    sub.push(s, s, s, s);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  base.setAttribute('aSub', new THREE.Float32BufferAttribute(sub, 1));
  base.setIndex(idx);
  base.instanceCount = n;
  const iib = new THREE.InstancedInterleavedBuffer(seats, 8, 1);
  base.setAttribute('aPos', new THREE.InterleavedBufferAttribute(iib, 4, 0));
  base.setAttribute('aInfo', new THREE.InterleavedBufferAttribute(iib, 4, 4));
  base.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 140);

  const tex = silhouetteTexture();
  const uniforms = {
    uTime: U.uTime, uExc: U.uExc, uEvHome: U.uEvHome, uEvAway: U.uEvAway,
    uHomeCol: { value: new THREE.Color(homeColor) }, uAwayCol: { value: new THREE.Color(awayColor) },
    uSunDir: U.uSunDir, uShadeOn: U.uShadeOn, uSunCol: U.uSunCol, uAmb: U.uAmbCrowd,
    uTex: { value: tex },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: crowdVert, fragmentShader: crowdFrag, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(base, mat);
  mesh.frustumCulled = false;
  mesh.name = 'torcedores';
  group.add(mesh);

  // ---- bandeiras: escolhe assentos ao acaso (mais atrás dos gols)
  const nFlags = Math.round(18 + 34 * (quality.crowd ?? 1));
  const fl = [];
  for (let tries = 0; fl.length < nFlags * 8 && tries < 5000; tries++) {
    const i = Math.floor(rng() * n) * 8;
    const x = seats[i], z = seats[i + 2];
    const endBias = Math.abs(x) > BOWL.A - 2 ? 1 : 0.35;
    if (rng() > endBias) continue;
    fl.push(x, seats[i + 1], z, seats[i + 3], seats[i + 4], seats[i + 5], rng(), seats[i + 7] % 2);
  }
  const fb = new THREE.InstancedBufferGeometry();
  const fp = [], fpart = [], fi = [];
  const NU = 8, NV = 3;
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
  fb.instanceCount = fl.length / 8;
  const fmat = new THREE.ShaderMaterial({ uniforms, vertexShader: flagVert, fragmentShader: flagFrag, side: THREE.DoubleSide });
  const flags = new THREE.Mesh(fb, fmat);
  flags.frustumCulled = false;
  flags.name = 'bandeiras-torcida';
  group.add(flags);

  group.userData.count = n * 2;
  return group;
}
