// Bandeirão da organizada: pano gigante (≈18 × 9 m) passado por cima das cabeças no
// fundo oeste (setor da organizada da casa). Desenrola de baixo para cima quando a
// torcida entra no canto forte ou no gol, ondula com ondas que correm pelo pano e
// "pula" no compasso; some quando o canto acaba. É o que a câmera de TV enxerga de
// longe — de 60-100 m um torcedor tem poucos pixels, um pano de 160 m² não.
// Uma chamada de desenho, ~400 triângulos; toda a animação no shader.
import * as THREE from 'three';
import { BOWL, ROOF_GLSL } from './stadium-bowl.js';

const NU = 24, NV = 12;
const W = 18, D0 = 5.5, D1 = 14.5;   // largura (z) e faixa de fileiras (distância do anel)

const vert = /* glsl */`
uniform float uTime;
uniform vec4 uEvHome;
uniform vec4 uChant;
uniform vec3 uSunCol;
uniform vec3 uAmb;
${ROOF_GLSL}
varying vec2 vUv;
varying vec3 vLight;
varying float vShow;
float react( float t0, float dur ) {
  float t = uTime - t0;
  return t < 0.0 ? 0.0 : smoothstep( 0.0, 1.0, t ) * ( 1.0 - smoothstep( dur * 0.7, dur, t ) );
}
// altura da arquibancada inferior na distância d (fileiras de 0,8 m subindo 0,42 m)
float standY( float d ) { return ${BOWL.lower.y0.toFixed(2)} + max( d - ${BOWL.lower.d0.toFixed(2)}, 0.0 ) / ${BOWL.lower.depth.toFixed(2)} * ${BOWL.lower.rise.toFixed(2)}; }
vec3 clothPos( vec2 uv, float show ) {
  // desenrola da frente para trás: v visível até "show"
  float v = min( uv.y, show );
  float d = mix( ${D0.toFixed(1)}, ${D1.toFixed(1)}, v );
  float z = ( uv.x - 0.5 ) * ${W.toFixed(1)};
  float t = uTime;
  float beat = t * uChant.z / 60.0;
  // ondas: uma correndo de trás para frente, outra de lado, e o "pulo" no compasso
  float h = 0.38 * sin( v * 9.0 - t * 2.6 + uv.x * 1.5 )
          + 0.22 * sin( uv.x * 14.0 + t * 1.7 + v * 3.0 )
          + 0.18 * pow( max( sin( beat * 6.2831853 ), 0.0 ), 1.6 )
          + 0.12 * sin( uv.x * 31.0 - t * 3.3 ) * sin( v * 17.0 + t * 1.1 );
  float y = standY( d ) + 2.15 + h;
  // as bordas caem um pouco (ninguém segura a ponta do mesmo jeito)
  y -= 0.5 * pow( abs( uv.x - 0.5 ) * 2.0, 4.0 );
  return vec3( -${BOWL.A.toFixed(2)} - d, y, z );
}
void main() {
  float goal = react( uEvHome.x + 2.5, 24.0 );
  float show = clamp( max( smoothstep( 0.55, 0.85, uChant.x ), goal ), 0.0, 1.0 );
  vShow = show;
  if ( show < 0.01 ) { gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 ); return; }
  vec2 uv = position.xy;
  vec3 p = clothPos( uv, show );
  vec3 px = clothPos( uv + vec2( 0.02, 0.0 ), show ), pz = clothPos( uv + vec2( 0.0, 0.02 ), show );
  vec3 n = normalize( cross( pz - p, px - p ) );
  if ( n.y < 0.0 ) n = -n;
  vUv = vec2( uv.x, min( uv.y, show ) );
  float lit = roofLit( ( ${D0.toFixed(1)} + ${D1.toFixed(1)} ) * 0.5, p.y, vec2( -1.0, 0.0 ) );
  vLight = uAmb * 1.4 + uSunCol * ( 0.3 + 0.7 * max( dot( n, uSunDir ), 0.0 ) ) * lit;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}`;

const frag = /* glsl */`
uniform vec3 uColA;
uniform vec3 uColB;
varying vec2 vUv;
varying vec3 vLight;
varying float vShow;
void main() {
  // desenho fictício: listras verticais largas nas cores do clube, faixa central com
  // um "escudo" redondo (estrela de 5 pontas) — nada de marca real
  vec2 q = vUv;
  float stripes = step( 0.5, fract( q.x * 6.0 ) );
  vec3 c = mix( uColA, uColB, stripes );
  vec2 e = ( q - vec2( 0.5, 0.5 ) ) * vec2( 2.0, 1.0 );
  float r = length( e );
  float ring = step( r, 0.42 ) * ( 1.0 - step( r, 0.36 ) );
  float disc = step( r, 0.36 );
  float a = atan( e.y, e.x );
  float star = step( r, 0.22 * ( 0.55 + 0.45 * cos( 5.0 * a ) ) + 0.06 );
  c = mix( c, uColB, disc );
  c = mix( c, uColA, ring + star * disc );
  // borda costurada e dobras do tecido
  float edge = step( q.x, 0.012 ) + step( 0.988, q.x ) + step( q.y, 0.02 );
  c = mix( c, uColA * 0.6, clamp( edge, 0.0, 1.0 ) );
  c *= 0.85 + 0.15 * sin( q.x * 70.0 + q.y * 9.0 );
  gl_FragColor = vec4( c * vLight, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// palH: paleta da casa (stadium-crowd.js); U: uniforms compartilhados do estádio
export function buildTifo({ U, palH }) {
  const pos = [], idx = [];
  for (let v = 0; v <= NV; v++) for (let u = 0; u <= NU; u++) pos.push(u / NU, v / NV, 0);
  for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) {
    const a = v * (NU + 1) + u, b = a + 1, c = a + NU + 2, d = a + NU + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // duas cores bem contrastantes do clube
  const a = new THREE.Color(palH.primary), b = new THREE.Color(palH.secondary);
  const la = 0.3 * a.r + 0.59 * a.g + 0.11 * a.b, lb = 0.3 * b.r + 0.59 * b.g + 0.11 * b.b;
  if (Math.abs(la - lb) < 0.08) b.set(la > 0.3 ? '#111214' : '#f2f2f2');
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uEvHome: U.uEvHome,
      uChant: U.uChant || { value: new THREE.Vector4(0, 0, 130, 120) },
      uSunDir: U.uSunDir, uShadeOn: U.uShadeOn, uSunCol: U.uSunCol, uAmb: U.uAmbCrowd,
      uColA: { value: a }, uColB: { value: b },
    },
    vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.name = 'bandeirao';
  mesh.userData.tris = idx.length / 3;
  return mesh;
}
