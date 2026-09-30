// GOLAÇO — efeitos de comemoração no estádio: sinalizadores com fumaça colorida
// nas cores do clube, papel picado e serpentinas caindo do anel superior, flashes
// de celular/câmera piscando no estádio inteiro e (à noite) fogos sobre a cobertura.
//
// ============================================================================
// API (para quem integra — main.js)
// ----------------------------------------------------------------------------
//   import { StadiumFX } from './fx.js';
//   const fx = new StadiumFX(scene, { quality, isNight, homeColor, awayColor, sunDir?, wind? });
//     quality   : objeto de QUALITY (config.js) ou a chave ('baixa'|'media'|'alta'|'ultra')
//     isNight   : stadium.isNight
//     homeColor / awayColor : '#hex' (cor principal dos clubes)
//     sunDir    : (opcional) THREE.Vector3 PARA a luz principal (stadium.sunDir) — sombreia a fumaça
//     wind      : (opcional) {x,z} m/s — deriva da fumaça (igual ao stadium.setWind)
//   fx.goal(side, colors, goalSign)
//     side     : 'home' | 'away' (quem comemora)
//     colors   : [c1, c2] '#hex' — cores da fumaça/papel (ex.: ['#1db954', '#111111'])
//                (opcional: usa homeColor/awayColor + preto)
//     goalSign : -1 | 1 — gol em que a bola entrou (−1 oeste, +1 leste); a festa
//                nas laterais se concentra desse lado
//   fx.chance()               // lance de perigo: alguns flashes
//   fx.setWind({x,z}), fx.setLightDir(vec3)
//   fx.update(dt, camera)     // todo quadro (dt em s). camera não é obrigatória.
//   fx.dispose()
//
// Onde fica a torcida (igual ao stadium-crowd.js): visitante = anel inferior atrás do
// gol leste (x > A, |z| < 22); casa = todo o resto (fundo oeste + laterais + anel
// superior leste). Sinalizadores da casa: 50% na "curva" oeste, o resto na lateral
// norte (lado do gol marcado) e no anel superior leste. O lado sul (z < 0) fica livre
// porque é onde a câmera de TV do jogo fica (camera.js).
//
// Custo: 5 malhas instanciadas (fumaça, núcleo dos sinalizadores, papel, flashes,
// fogos) → no máximo 5 chamadas de desenho, e 0 quando nada está ativo (ficam
// invisíveis). Toda a animação é no shader a partir do instante de nascimento de
// cada partícula; a CPU só escreve os atributos uma vez por gol.
// Limites por qualidade (baixa / média / alta+):
//   fumaça 160 / 600 / 1100 · sinalizadores 6 / 14 / 22 · papel 0 / 1500 / 3200
//   flashes 300 / 700 / 1400 · fogos (só à noite) 0 / 1100 / 2400
// ============================================================================
import * as THREE from 'three';
import { BOWL, crowdSeats } from './stadium-bowl.js';

const TIERS = {
  baixa: { smoke: 160, flares: 6, confetti: 0, flashes: 300, fw: 0 },
  media: { smoke: 600, flares: 14, confetti: 1500, flashes: 700, fw: 1100 },
  alta: { smoke: 1100, flares: 22, confetti: 3200, flashes: 1400, fw: 2400 },
};

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

// ------------------------------------------------------------------ geometria da arquibancada
// altura do degrau (onde a pessoa pisa) no anel inferior / superior, a distância d do anel
function lowerY(d) {
  const L = BOWL.lower;
  if (d < L.d0) return 0;
  const i = Math.min(L.rows - 1, Math.floor((d - L.d0) / L.depth));
  return L.y0 + i * L.rise;
}
function upperY(d) {
  const U = BOWL.upper;
  const j = Math.max(0, Math.min(U.rows - 1, Math.floor((d - U.d0) / U.depth)));
  return U.y0 + j * U.rise;
}
const lowerEnd = () => BOWL.lower.d0 + BOWL.lower.rows * BOWL.lower.depth;
const upperEnd = () => BOWL.upper.d0 + BOWL.upper.rows * BOWL.upper.depth;

// ponto na arquibancada: lado ('W','E','S','N'), coordenada ao longo do lado, distância d
function standPoint(side, along, d) {
  const { A, B } = BOWL;
  if (side === 'W') return { x: -A - d, z: along, nx: -1, nz: 0 };
  if (side === 'E') return { x: A + d, z: along, nx: 1, nz: 0 };
  if (side === 'S') return { x: along, z: -B - d, nx: 0, nz: -1 };
  return { x: along, z: B + d, nx: 0, nz: 1 };
}

// ------------------------------------------------------------------ texturas
function smokeTexture() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const rnd = mulberry(7);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.9) * S * 0.24;
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    const rad = S * (0.06 + rnd() * 0.16) * (1 - r / (S * 0.4));
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = 0.05 + rnd() * 0.08;
    gr.addColorStop(0, `rgba(255,255,255,${v})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  // borda bem suave: multiplica por um degradê radial
  g.globalCompositeOperation = 'multiply';
  const rg = g.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S * 0.5);
  rg.addColorStop(0, '#fff'); rg.addColorStop(0.55, '#aaa'); rg.addColorStop(1, '#000');
  g.fillStyle = rg; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// quad instanciado com atributos por instância
function instGeo(count, attrs, segY = 1) {
  const base = new THREE.PlaneGeometry(1, 1, 1, segY);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  const arrays = {};
  for (const [name, size] of Object.entries(attrs)) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(count * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(name, a);
    arrays[name] = a;
  }
  g.instanceCount = count;
  // partículas "desligadas": nascimento no futuro distante
  return { g, a: arrays };
}

const HIDE = 'gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return;';

// ------------------------------------------------------------------ shaders
const smokeVert = /* glsl */`
attribute vec4 aA;   // posição inicial, nascimento
attribute vec4 aB;   // velocidade inicial, vida
attribute vec4 aC;   // cor, semente
attribute vec4 aD;   // tamanho inicial, final, brilho do sinalizador, -
uniform float uTime;
uniform vec2 uWind;
uniform vec3 uLightDir;
varying vec2 vUv;
varying vec2 vQ;
varying vec3 vCol;
varying float vAlpha;
varying float vGlow;
varying vec3 vL;
void main() {
  float t = uTime - aA.w, life = aB.w;
  if ( t < 0.0 || t > life ) { ${HIDE} }
  float age = t / life;
  float s = aC.w;
  vec3 p = aA.xyz + aB.xyz * ( 1.0 - exp( -0.6 * t ) ) / 0.6
         + vec3( uWind.x, 0.0, uWind.y ) * t * 0.5 + vec3( 0.0, 0.3 * t, 0.0 )
         + vec3( sin( t * 0.8 + s * 31.0 ), 0.25 * sin( t * 1.1 + s * 7.0 ), cos( t * 0.7 + s * 17.0 ) ) * 0.7 * sqrt( t );
  float size = mix( aD.x, aD.y, 1.0 - ( 1.0 - age ) * ( 1.0 - age ) );
  float ang = aC.w * 6.2831 + t * ( aC.w - 0.5 ) * 0.6;
  vec2 q = position.xy;
  vQ = q * 2.0;
  vUv = vec2( cos( ang ) * q.x - sin( ang ) * q.y, sin( ang ) * q.x + cos( ang ) * q.y ) + 0.5;
  vec4 mv = viewMatrix * vec4( p, 1.0 );
  mv.xy += q * size;
  gl_Position = projectionMatrix * mv;
  vCol = aC.rgb;
  vAlpha = smoothstep( 0.0, 0.5, t ) * ( 1.0 - smoothstep( 0.45, 1.0, age ) );
  vGlow = aD.z * exp( -t * 2.6 );
  vL = normalize( ( viewMatrix * vec4( uLightDir, 0.0 ) ).xyz );
}`;
const smokeFrag = /* glsl */`
uniform sampler2D uTex;
uniform vec3 uAmb;
uniform vec3 uSun;
uniform vec3 uFlareCol;
varying vec2 vUv;
varying vec2 vQ;
varying vec3 vCol;
varying float vAlpha;
varying float vGlow;
varying vec3 vL;
void main() {
  float d = texture2D( uTex, vUv ).r;
  float r2 = dot( vQ, vQ );
  // normal "de bolha" para sombrear a nuvem (lado da luz mais claro)
  vec3 n = normalize( vec3( vQ * 0.85, sqrt( max( 0.0, 1.0 - r2 ) ) + 0.25 ) );
  float lit = 0.35 + 0.65 * max( dot( n, vL ), 0.0 );
  float thick = smoothstep( 0.0, 0.9, d );
  vec3 col = vCol * ( uAmb + uSun * lit * ( 1.0 - 0.35 * thick ) );
  // brilho do sinalizador por baixo da fumaça
  float below = smoothstep( 0.6, -1.0, vQ.y ) * ( 1.0 - smoothstep( 0.2, 1.0, r2 ) );
  col += uFlareCol * vGlow * ( 0.1 + below * 1.1 ) * thick;
  float a = clamp( d * 2.3, 0.0, 1.0 ) * vAlpha * 0.85;
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const flareVert = /* glsl */`
attribute vec4 aA;   // posição, nascimento
attribute vec4 aB;   // cor, duração
attribute vec4 aC;   // semente, tamanho, -, -
uniform float uTime;
uniform float uNight;
varying vec2 vQ;
varying vec3 vCol;
varying float vI;
void main() {
  float t = uTime - aA.w, dur = aB.w;
  if ( t < 0.0 || t > dur ) { ${HIDE} }
  float s = aC.x;
  float flick = 0.72 + 0.16 * sin( t * 41.0 + s * 50.0 ) + 0.12 * sin( t * 23.0 + s * 9.0 );
  vI = flick * smoothstep( 0.0, 0.35, t ) * ( 1.0 - smoothstep( dur - 1.5, dur, t ) );
  vec3 p = aA.xyz + vec3( sin( t * 3.1 + s * 20.0 ), 0.0, cos( t * 2.7 + s * 11.0 ) ) * 0.12; // o torcedor agita o braço
  vec4 mv = viewMatrix * vec4( p, 1.0 );
  float size = aC.y * ( 0.8 + 0.35 * flick ) * mix( 0.55, 1.0, uNight );
  size = max( size, -mv.z * 0.011 );
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vQ = position.xy * 2.0;
  vCol = aB.rgb;
}`;
const flareFrag = /* glsl */`
uniform float uNight;
varying vec2 vQ;
varying vec3 vCol;
varying float vI;
void main() {
  float r2 = dot( vQ, vQ );
  float core = exp( -r2 * 60.0 ) * 7.0;
  float mid = exp( -r2 * 9.0 ) * 1.6;
  float halo = exp( -sqrt( r2 ) * 3.5 ) * mix( 0.35, 1.1, uNight );
  vec3 col = vCol * ( mid + halo ) + vec3( 1.0, 0.93, 0.85 ) * core;
  gl_FragColor = vec4( col * vI * ( 1.0 - smoothstep( 0.85, 1.0, sqrt( r2 ) ) ), 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const confVert = /* glsl */`
attribute vec4 aA;   // posição inicial, nascimento
attribute vec4 aB;   // vx, vz, vy0, queda (m/s)
attribute vec4 aC;   // cor, semente
attribute vec4 aD;   // largura, comprimento, instante do pouso, vida
uniform float uTime;
uniform vec3 uLightDir;
varying vec3 vCol;
varying float vShade;
vec3 rotAxis( vec3 v, vec3 k, float a ) {
  float c = cos( a ), s = sin( a );
  return v * c + cross( k, v ) * s + k * dot( k, v ) * ( 1.0 - c );
}
void main() {
  float t = uTime - aA.w;
  if ( t < 0.0 || t > aD.w ) { ${HIDE} }
  float sd = aC.w;
  float tl = aD.z, tt = min( t, tl );
  vec3 p = aA.xyz;
  p.xz += aB.xy * ( 1.0 - exp( -1.5 * tt ) ) / 1.5;
  p.y += aB.z * ( 1.0 - exp( -3.0 * tt ) ) / 3.0 - aB.w * tt;
  // tremulado lateral enquanto cai
  float fl = ( 1.0 - step( tl, t ) );
  p.x += sin( t * 2.3 + sd * 40.0 ) * 0.28 * fl;
  p.z += cos( t * 1.9 + sd * 23.0 ) * 0.28 * fl;
  float shrink = 1.0 - smoothstep( aD.w - 1.5, aD.w, t );
  // de longe, cresce até ~1,5 px para não sumir (vira o "brilho" de papel no ar);
  // serpentina só engrossa, não estica
  float grow = max( 1.0, length( cameraPosition - p ) * 0.0024 / max( aD.x, 0.05 ) );
  bool strm = aD.y > 0.3;
  vec3 v = vec3( position.x * aD.x * grow, position.y * aD.y * ( strm ? 1.0 : grow ), 0.0 ) * shrink;
  vec3 n = vec3( 0.0, 0.0, 1.0 );
  if ( strm ) v.z += sin( position.y * 9.0 + t * 8.0 + sd * 30.0 ) * 0.06;   // serpentina ondulando
  if ( t < tl ) {
    vec3 k = normalize( vec3( sin( sd * 91.0 ), cos( sd * 57.0 ), sin( sd * 33.0 + 1.0 ) ) );
    float ang = t * ( 5.0 + 9.0 * fract( sd * 13.0 ) );
    v = rotAxis( v, k, ang ); n = rotAxis( n, k, ang );
  } else {
    // pousado: deitado no degrau
    float yaw = sd * 6.2831;
    v = vec3( v.x * cos( yaw ) - v.y * sin( yaw ), 0.02, v.x * sin( yaw ) + v.y * cos( yaw ) );
    n = vec3( 0.0, 1.0, 0.0 );
  }
  vec3 wp = p + v;
  vec4 mv = viewMatrix * vec4( wp, 1.0 );
  gl_Position = projectionMatrix * mv;
  vec3 V = normalize( cameraPosition - wp );
  float dl = abs( dot( n, uLightDir ) );
  float glint = pow( abs( dot( reflect( -uLightDir, n ), V ) ), 24.0 ) * step( 0.7, fract( sd * 7.0 ) ) * 2.5;
  vShade = 0.35 + 0.75 * dl + glint;
  vCol = aC.rgb;
}`;
const confFrag = /* glsl */`
uniform vec3 uLight;
varying vec3 vCol;
varying float vShade;
void main() {
  gl_FragColor = vec4( vCol * vShade * uLight, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const flashVert = /* glsl */`
attribute vec4 aA;   // posição (cabeça do torcedor), semente
attribute vec4 aB;   // frequência, tipo (0 flash, 1 celular filmando), -, -
uniform float uTime;
uniform float uGoalT;
uniform float uChanceT;
uniform float uNight;
varying vec2 vQ;
varying float vI;
varying float vKind;
float env( float t0, float up, float dur ) {
  float t = uTime - t0;
  return t < 0.0 ? 0.0 : smoothstep( 0.0, up, t ) * ( 1.0 - smoothstep( dur * 0.55, dur, t ) );
}
void main() {
  float s = aA.w;
  float e = env( uGoalT + fract( s * 3.7 ) * 0.8, 0.4, 13.0 ) + 0.4 * env( uChanceT, 0.2, 3.0 );
  float kind = aB.y;
  float I;
  if ( kind < 0.5 ) {
    float ph = fract( uTime * aB.x + s * 17.0 );
    I = smoothstep( 0.0, 0.015, ph ) * ( 1.0 - smoothstep( 0.015, 0.08, ph ) ) * 6.0;
    I *= step( fract( s * 11.3 ), e * 1.1 );            // no auge, quase todo mundo fotografa
  } else {
    I = 0.55 * smoothstep( 0.2, 0.6, e ) * mix( 0.35, 1.0, uNight );   // tela acesa filmando
  }
  if ( I < 0.01 ) { ${HIDE} }
  vec3 wp = aA.xyz + normalize( cameraPosition - aA.xyz ) * 0.6;   // à frente do torcedor
  vec4 mv = viewMatrix * vec4( wp, 1.0 );
  float size = kind < 0.5 ? 0.5 : 0.16;
  size = max( size, -mv.z * ( kind < 0.5 ? 0.009 : 0.0035 ) );
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vQ = position.xy * 2.0; vI = I; vKind = kind;
}`;
const flashFrag = /* glsl */`
varying vec2 vQ;
varying float vI;
varying float vKind;
void main() {
  float r2 = dot( vQ, vQ );
  float g = vKind < 0.5 ? exp( -r2 * 7.0 ) + exp( -r2 * 40.0 ) * 2.0 : exp( -r2 * 5.0 );
  vec3 col = vKind < 0.5 ? vec3( 1.0, 0.98, 0.95 ) : vec3( 0.75, 0.85, 1.0 );
  gl_FragColor = vec4( col * g * vI, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const fwVert = /* glsl */`
attribute vec4 aA;   // centro da explosão, instante da explosão
attribute vec4 aB;   // velocidade, vida
attribute vec4 aC;   // cor, semente
attribute vec4 aD;   // tipo (0 faísca, 1 foguete subindo, 2 clarão), atraso do rastro, altura do lançamento, tamanho
uniform float uTime;
varying vec2 vQ;
varying vec3 vCol;
varying float vI;
void main() {
  float kind = aD.x, lag = aD.y;
  vec3 p; float I; float size = aD.w;
  if ( kind < 0.5 ) {
    float t = uTime - aA.w - lag;
    if ( t < 0.0 || t > aB.w ) { ${HIDE} }
    float u = t / aB.w;
    p = aA.xyz + aB.xyz * ( 1.0 - exp( -1.6 * t ) ) / 1.6 - vec3( 0.0, 1.4 * t * t, 0.0 );
    float crackle = u > 0.62 ? step( 0.45, fract( t * 13.0 + aC.w * 9.0 ) ) : 1.0;
    I = pow( 1.0 - u, 1.4 ) * crackle * ( lag > 0.0 ? 0.4 - lag * 2.0 : 1.0 ) * 3.2;
  } else if ( kind < 1.5 ) {
    float rise = 1.15;
    float t = uTime - ( aA.w - rise ) - lag;
    if ( t < 0.0 || t > rise ) { ${HIDE} }
    float u = t / rise;
    vec3 l = vec3( aA.x, aD.z, aA.z );
    p = mix( l, aA.xyz, 1.0 - ( 1.0 - u ) * ( 1.0 - u ) );
    I = ( 1.0 - lag * 9.0 ) * 1.6;
  } else {
    float t = uTime - aA.w;
    if ( t < 0.0 || t > 0.35 ) { ${HIDE} }
    p = aA.xyz;
    I = ( 1.0 - t / 0.35 ) * 0.9;
  }
  vec4 mv = viewMatrix * vec4( p, 1.0 );
  size = max( size, -mv.z * 0.004 * ( kind > 1.5 ? 6.0 : 1.0 ) );
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vQ = position.xy * 2.0; vCol = aC.rgb; vI = I;
}`;
const fwFrag = /* glsl */`
varying vec2 vQ;
varying vec3 vCol;
varying float vI;
void main() {
  float r2 = dot( vQ, vQ );
  float g = exp( -r2 * 6.0 ) + exp( -r2 * 40.0 ) * 1.5;
  vec3 col = mix( vCol, vec3( 1.0, 0.97, 0.9 ), exp( -r2 * 40.0 ) );
  gl_FragColor = vec4( col * g * vI, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------ classe principal
export class StadiumFX {
  constructor(scene, opts = {}) {
    const q = opts.quality;
    const qKey = typeof q === 'string' ? q : (q && q.label ? { Baixa: 'baixa', 'Média': 'media', Alta: 'alta', Ultra: 'alta' }[q.label] : 'alta');
    const T = TIERS[qKey] || TIERS[qKey === 'ultra' ? 'alta' : 'media'] || TIERS.media;
    this.tier = { ...T, fw: opts.isNight ? T.fw : 0 };
    this.isNight = !!opts.isNight;
    this.homeColor = opts.homeColor || '#1db954';
    this.awayColor = opts.awayColor || '#f2f2f2';
    this.scene = scene;
    this.time = 0;
    this.rng = mulberry(opts.seed ?? 1234);
    this.group = new THREE.Group();
    this.group.name = 'efeitos-estadio';
    scene.add(this.group);

    const lightDir = (opts.sunDir ? opts.sunDir.clone() : new THREE.Vector3(0.3, 1, -0.42)).normalize();
    const wind = new THREE.Vector2(opts.wind?.x ?? 2.0, opts.wind?.z ?? 0.8);
    this.U = {
      uTime: { value: 0 }, uWind: { value: wind }, uLightDir: { value: lightDir },
      uNight: { value: this.isNight ? 1 : 0 },
      uGoalT: { value: -1e4 }, uChanceT: { value: -1e4 },
    };
    this.until = { smoke: -1, flares: -1, conf: -1, flash: -1, fw: -1 };
    this.cursor = { smoke: 0, flares: 0, conf: 0, fw: 0 };
    const U = this.U;
    const mk = (name, count, attrs, vert, frag, extra, segY = 1) => {
      if (count <= 0) return null;
      const { g, a } = instGeo(count, attrs, segY);
      for (const at of Object.values(a)) {
        // nascimento no futuro distante = desligada
        if (at.itemSize === 4) for (let i = 0; i < count; i++) at.array[i * 4 + 3] = 1e9;
      }
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...U, ...(extra.uniforms || {}) }, vertexShader: vert, fragmentShader: frag,
        transparent: !!extra.transparent, depthWrite: !!extra.depthWrite, blending: extra.blending ?? THREE.NormalBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = extra.renderOrder ?? 6;
      mesh.name = name;
      this.group.add(mesh);
      return { mesh, a, count };
    };
    const P = this.isNight;
    this.smokeTex = smokeTexture();
    this.smoke = mk('fx-fumaca', this.tier.smoke, { aA: 4, aB: 4, aC: 4, aD: 4 }, smokeVert, smokeFrag, {
      transparent: true, renderOrder: 7,
      uniforms: {
        uTex: { value: this.smokeTex },
        uAmb: { value: P ? new THREE.Vector3(0.26, 0.27, 0.3) : new THREE.Vector3(0.38, 0.4, 0.45) },
        uSun: { value: P ? new THREE.Vector3(0.75, 0.76, 0.8) : new THREE.Vector3(0.95, 0.9, 0.82) },
        uFlareCol: { value: new THREE.Vector3(1.0, 0.32, 0.12).multiplyScalar(P ? 1.6 : 0.6) },
      },
    });
    this.flares = mk('fx-sinalizadores', this.tier.flares * 2, { aA: 4, aB: 4, aC: 4 }, flareVert, flareFrag, {
      transparent: true, blending: THREE.AdditiveBlending, renderOrder: 8,
    });
    this.conf = mk('fx-papel', this.tier.confetti, { aA: 4, aB: 4, aC: 4, aD: 4 }, confVert, confFrag, {
      depthWrite: true, renderOrder: 5,
      uniforms: { uLight: { value: P ? new THREE.Vector3(0.9, 0.9, 0.95) : new THREE.Vector3(1.05, 1.02, 0.98) } },
    }, 6);
    this.flash = mk('fx-flashes', this.tier.flashes, { aA: 4, aB: 4 }, flashVert, flashFrag, {
      transparent: true, blending: THREE.AdditiveBlending, renderOrder: 8,
    });
    this.fw = mk('fx-fogos', this.tier.fw, { aA: 4, aB: 4, aC: 4, aD: 4 }, fwVert, fwFrag, {
      transparent: true, blending: THREE.AdditiveBlending, renderOrder: 9,
    });
    this._initFlashes();
  }

  // flashes: pontos fixos nas cabeças de torcedores do estádio todo
  _initFlashes() {
    const F = this.flash;
    if (!F) return;
    const rng = mulberry(99);
    const seats = crowdSeats(1, rng);
    const n = seats.length / 8;
    const A = F.a.aA.array, B = F.a.aB.array;
    for (let i = 0; i < F.count; i++) {
      const k = Math.floor(rng() * n) * 8;
      const side = rng() < 0.5 ? -0.27 : 0.27;
      const tx = -seats[k + 5], tz = seats[k + 4];
      A[i * 4] = seats[k] + tx * side;
      A[i * 4 + 1] = seats[k + 1] + 1.35 + rng() * 0.35;
      A[i * 4 + 2] = seats[k + 2] + tz * side;
      A[i * 4 + 3] = rng();
      B[i * 4] = 0.45 + rng() * 1.1;
      B[i * 4 + 1] = rng() < 0.3 ? 1 : 0;
    }
    F.a.aA.needsUpdate = true; F.a.aB.needsUpdate = true;
  }

  setWind(w) { if (w) this.U.uWind.value.set(w.x || 0, w.z || 0); }
  setLightDir(v) { if (v) this.U.uLightDir.value.copy(v).normalize(); }

  chance() {
    this.U.uChanceT.value = this.time;
    this.until.flash = Math.max(this.until.flash, this.time + 3.5);
  }

  // pontos da comemoração: [{ x, y, z, nx, nz, tier }]
  _spots(side, goalSign, n, tierPref) {
    const rng = this.rng, out = [];
    const { A } = BOWL;
    const Lend = lowerEnd(), Uend = upperEnd();
    for (let i = 0; i < n; i++) {
      let s, along, d, tier;
      if (side === 'away') {
        s = 'E'; along = (rng() * 2 - 1) * 18; tier = 0;
        d = BOWL.lower.d0 + 1.5 + rng() * (Lend - BOWL.lower.d0 - 3);
      } else {
        // o lado sul (z < 0) fica livre: é onde está a câmera de TV do jogo
        const r = rng(), sg = goalSign || -1;
        tier = rng() < (tierPref ?? 0.3) ? 1 : 0;
        if (r < 0.5) { s = 'W'; along = (rng() * 2 - 1) * (tier ? 30 : 21); }   // curva / ultras
        else if (r < 0.85 || sg < 0) { s = 'N'; along = sg * (4 + rng() * (A - 10)); }
        else { s = 'E'; along = (rng() * 2 - 1) * 28; tier = 1; }               // anel superior leste (casa)
        d = tier ? BOWL.upper.d0 + 1 + rng() * (Uend - BOWL.upper.d0 - 3) : BOWL.lower.d0 + 1.5 + rng() * (Lend - BOWL.lower.d0 - 3);
      }
      const p = standPoint(s, along, d);
      out.push({ ...p, y: tier ? upperY(d) : lowerY(d), tier, d });
    }
    return out;
  }

  goal(side = 'home', colors, goalSign = 1) {
    const now = this.time, rng = this.rng;
    const cols = (colors && colors.length ? colors : [side === 'away' ? this.awayColor : this.homeColor, '#161616'])
      .map((c) => new THREE.Color(c));
    if (cols.length < 2) cols.push(new THREE.Color('#161616'));
    this.U.uGoalT.value = now;
    this.until.flash = now + 14;

    // --- sinalizadores + fumaça
    const nF = this.tier.flares;
    const spots = this._spots(side, goalSign, nF, 0.3);
    const flareRed = new THREE.Color(1.0, 0.18, 0.08);
    const flarePink = new THREE.Color(1.0, 0.12, 0.22);
    const S = this.smoke, Fl = this.flares;
    const perSrc = S ? Math.max(4, Math.floor(S.count / nF)) : 0;
    spots.forEach((sp, i) => {
      const t0 = now + 0.4 + rng() * 2.5;
      const dur = 9 + rng() * 5;
      const hand = { x: sp.x, y: sp.y + 1.75, z: sp.z };
      if (Fl) {
        const k = this.cursor.flares++ % Fl.count;
        const fc = rng() < 0.5 ? flareRed : flarePink;
        Fl.a.aA.array.set([hand.x, hand.y, hand.z, t0], k * 4);
        Fl.a.aB.array.set([fc.r, fc.g, fc.b, dur], k * 4);
        Fl.a.aC.array.set([rng(), 0.55 + rng() * 0.3, 0, 0], k * 4);
      }
      if (!S) return;
      // fumaça: alterna as duas cores por sinalizador; o preto vira fumaça cinza-escura
      const base = cols[i % cols.length].clone();
      const lum = 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b;
      if (lum < 0.03) base.setRGB(0.045, 0.045, 0.05);
      const every = dur / perSrc;
      for (let j = 0; j < perSrc; j++) {
        const k = this.cursor.smoke++ % S.count;
        const birth = t0 + j * every + rng() * every * 0.5;
        const life = 6 + rng() * 4;
        const c = base.clone().lerp(new THREE.Color(0.5, 0.5, 0.5), 0.08 + rng() * 0.12).multiplyScalar(0.85 + rng() * 0.3);
        const out = 0.3 + rng() * 0.5; // derrama em direção ao campo
        S.a.aA.array.set([hand.x + (rng() - 0.5) * 0.3, hand.y + 0.1, hand.z + (rng() - 0.5) * 0.3, birth], k * 4);
        S.a.aB.array.set([(rng() - 0.5) * 2.4 - sp.nx * out, 0.9 + rng() * 1.6, (rng() - 0.5) * 2.4 - sp.nz * out, life], k * 4);
        S.a.aC.array.set([c.r, c.g, c.b, rng()], k * 4);
        S.a.aD.array.set([0.6 + rng() * 0.5, 6 + rng() * 6, this.isNight ? 1 : 0.5, 0], k * 4);
      }
      this.until.smoke = Math.max(this.until.smoke, t0 + dur + 9.5);
      this.until.flares = Math.max(this.until.flares, t0 + dur);
    });
    for (const sys of [S, Fl]) if (sys) for (const at of Object.values(sys.a)) at.needsUpdate = true;

    // --- papel picado e serpentinas
    const C = this.conf;
    if (C) {
      const white = new THREE.Color(0.95, 0.95, 0.93), silver = new THREE.Color(0.8, 0.82, 0.86);
      // papel preto some de longe: cor quase preta vira prateado
      const dark = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.04;
      const palette = [cols[0], cols[0], dark(cols[1]) ? silver : cols[1], white, white, silver];
      const n = C.count;
      // "chuva" em rajadas a partir da borda do anel superior (casa) ou do setor visitante
      const nSrc = side === 'away' ? 6 : 14;
      const srcs = [];
      for (let i = 0; i < nSrc; i++) {
        if (side === 'away') {
          const along = (rng() * 2 - 1) * 16, d = lowerEnd() - 2 - rng() * 6;
          srcs.push({ ...standPoint('E', along, d), y0: lowerY(d) + 2.0, d0: d, up: true });
        } else {
          const sd = rng() < 0.45 ? 'W' : 'N';
          const along = sd === 'W' ? (rng() * 2 - 1) * 28 : (goalSign || -1) * (6 + rng() * (BOWL.A - 12));
          const d = BOWL.upper.d0 + 0.3 + rng() * 2.5;
          srcs.push({ ...standPoint(sd, along, d), y0: upperY(d) + 1.9, d0: d, up: false });
        }
      }
      for (let i = 0; i < n; i++) {
        const k = this.cursor.conf++ % n;
        const src = srcs[i % nSrc];
        const tan = { x: -src.nz, z: src.nx };
        const lat = (rng() - 0.5) * 9;
        const birth = now + 0.8 + Math.pow(rng(), 1.6) * 5.5;
        const streamer = rng() < 0.12;
        const hv = src.up ? 0.4 + rng() * 1.2 : 1.2 + rng() * 2.8;   // arremesso para o campo
        const vx = -src.nx * hv + tan.x * (rng() - 0.5) * 1.2, vz = -src.nz * hv + tan.z * (rng() - 0.5) * 1.2;
        const vy0 = src.up ? 3 + rng() * 3 : 0.5 + rng() * 2;
        const fall = streamer ? 1.6 + rng() * 0.8 : 0.9 + rng() * 0.8;
        const x0 = src.x + tan.x * lat, z0 = src.z + tan.z * lat;
        // pouso: integra a mesma fórmula do shader até tocar o degrau do anel inferior
        let tl = 30, prevY = src.y0;
        for (let t = 0.05; t < 30; t += 0.05) {
          const h = (1 - Math.exp(-1.5 * t)) / 1.5;
          const x = x0 + vx * h, z = z0 + vz * h;
          const y = src.y0 + vy0 * (1 - Math.exp(-3 * t)) / 3 - fall * t;
          const dd = src.nx !== 0 ? Math.abs(x) - BOWL.A : Math.abs(z) - BOWL.B;
          let floor = dd < 0 ? 0 : dd < BOWL.lower.d0 ? 0 : lowerY(dd);
          if (dd > lowerEnd() + 1) floor = 0;
          if (y <= floor + 0.03 && y < prevY) { tl = t; break; }
          prevY = y;
        }
        const col = palette[Math.floor(rng() * palette.length)];
        const sh = 0.8 + rng() * 0.35;
        C.a.aA.array.set([x0, src.y0, z0, birth], k * 4);
        C.a.aB.array.set([vx, vz, vy0, fall], k * 4);
        C.a.aC.array.set([col.r * sh, col.g * sh, col.b * sh, rng()], k * 4);
        C.a.aD.array.set(streamer ? [0.035, 0.7 + rng() * 0.6, tl, tl + 7 + rng() * 5] : [0.06 + rng() * 0.05, 0.08 + rng() * 0.05, tl, tl + 6 + rng() * 6], k * 4);
        this.until.conf = Math.max(this.until.conf, birth + tl + 13);
      }
      for (const at of Object.values(C.a)) at.needsUpdate = true;
    }

    // --- fogos (noite)
    const W = this.fw;
    if (W) {
      const shells = qKeyShells(W.count);
      const per = Math.floor(W.count / shells);
      const fwCols = [cols[0], new THREE.Color(1, 0.8, 0.35), new THREE.Color(1, 1, 1), cols[0], new THREE.Color(0.9, 0.2, 0.15)];
      for (let s = 0; s < shells; s++) {
        const tb = now + 1.6 + s * (4.5 / shells) + rng() * 0.4;
        // sobre a cobertura: ao redor do anel, com preferência pelo lado de quem comemora
        const sd = side === 'away' ? 'E' : ['W', 'N', 'S', 'W', 'N'][s % 5];
        const along = sd === 'W' || sd === 'E' ? (rng() * 2 - 1) * 30 : (rng() * 2 - 1) * 50;
        const p = standPoint(sd, along, BOWL.roofIn + rng() * (BOWL.roofOut - BOWL.roofIn));
        const cy = BOWL.roofY + 22 + rng() * 16;
        const col = fwCols[s % fwCols.length];
        const speed = 20 + rng() * 8;
        const nRocket = 10, nFlash = 1;
        let spark = [0, 0, 0, 1];
        for (let i = 0; i < per; i++) {
          const k = this.cursor.fw++ % W.count;
          let kind = 0, lag = 0, vx = 0, vy = 0, vz = 0, life = 1;
          if (i < nRocket) { kind = 1; lag = i * 0.012; }
          else if (i < nRocket + nFlash) { kind = 2; }
          else {
            const j = i - nRocket - nFlash;
            const trail = j % 3;          // 1 faísca + 2 rastros atrasados (mesma direção)
            lag = trail * 0.045;
            if (trail === 0) {
              // direção uniforme na esfera
              const u = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
              const sp = speed * (0.85 + rng() * 0.3);
              spark = [r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp, 1.9 + rng() * 1.0];
            }
            [vx, vy, vz, life] = spark;
          }
          const c = kind === 1 ? new THREE.Color(1, 0.75, 0.4) : col;
          W.a.aA.array.set([p.x, cy, p.z, tb], k * 4);
          W.a.aB.array.set([vx, vy, vz, life], k * 4);
          W.a.aC.array.set([c.r, c.g, c.b, rng()], k * 4);
          W.a.aD.array.set([kind, lag, BOWL.roofY + 0.5, kind === 2 ? 9 : kind === 1 ? 0.5 : 0.8], k * 4);
        }
        this.until.fw = Math.max(this.until.fw, tb + 3);
      }
      for (const at of Object.values(W.a)) at.needsUpdate = true;
    }
  }

  update(dt /* , camera */) {
    this.time += Math.min(Math.max(dt || 0, 0), 0.1);
    const t = this.time;
    this.U.uTime.value = t;
    if (this.smoke) this.smoke.mesh.visible = t < this.until.smoke;
    if (this.flares) this.flares.mesh.visible = t < this.until.flares;
    if (this.conf) this.conf.mesh.visible = t < this.until.conf;
    if (this.flash) this.flash.mesh.visible = t < this.until.flash;
    if (this.fw) this.fw.mesh.visible = t < this.until.fw;
  }

  // diagnóstico: partículas por sistema e malhas visíveis agora
  stats() {
    const s = {};
    for (const k of ['smoke', 'flares', 'conf', 'flash', 'fw']) s[k] = this[k] ? { count: this[k].count, visible: this[k].mesh.visible } : null;
    return s;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.smokeTex.dispose();
  }
}

// número de explosões conforme o tamanho do lote
function qKeyShells(count) { return count >= 2000 ? 8 : 5; }
