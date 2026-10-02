// Gramado: textura CC0 (ambientCG Grass005) + camada fina de detalhe (ambientCG
// Grass001: luminância passa-alta + normal numa só textura) que aparece de perto e
// some com a distância (sem cintilar na câmera de TV), faixas de corte com brilho
// que depende da direção do corte e da visão ('faixas' | 'xadrez' | 'diagonal'),
// variação de cor em grande escala, desgaste nas pequenas áreas e no círculo
// central, gramado molhado à noite (brilho especular mais fechado) e as linhas
// oficiais desenhadas analiticamente (campo de distância com antisserrilhado por fwidth).
import * as THREE from 'three';
import { PITCH } from './config.js';

const TEX = (f) => new URL(`../assets/textures/${f}`, import.meta.url).href;
const TILE = 3.2; // metros por repetição da textura
const DTILE = 0.85; // metros por repetição da textura de detalhe
const MOW = { faixas: 0, xadrez: 1, diagonal: 2 };

const P = PITCH;
const f = (v) => v.toFixed(3);

const PITCH_GLSL = /* glsl */`
varying vec3 vPW;
uniform float uLineBright;
uniform float uWet;
uniform sampler2D uDetail;
float lineMask;
float grassVar;
vec3 detN;
float detFade;
float ph( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vnoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( ph( i ), ph( i + vec2( 1, 0 ) ), u.x ), mix( ph( i + vec2( 0, 1 ) ), ph( i + vec2( 1, 1 ) ), u.x ), u.y );
}
float fbm( vec2 p ) { float a = 0.5, s = 0.0; for ( int i = 0; i < 4; i ++ ) { s += a * vnoise( p ); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
float sdSeg( vec2 p, vec2 a, vec2 b ) { vec2 pa = p - a, ba = b - a; float h = clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 ); return length( pa - ba * h ); }

// distância até a linha mais próxima (centros das linhas), simetria em x e z
float pitchLines( vec2 p ) {
  const float HW = ${f(P.lineWidth / 2)};
  vec2 q = abs( p );
  float L = ${f(P.halfL)} - HW, W = ${f(P.halfW)} - HW;
  float d = sdSeg( q, vec2( 0.0, W ), vec2( L, W ) );                         // laterais
  d = min( d, sdSeg( q, vec2( L, 0.0 ), vec2( L, W ) ) );                     // linhas de fundo
  d = min( d, sdSeg( q, vec2( 0.0 ), vec2( 0.0, W ) ) );                      // linha do meio
  d = min( d, abs( length( p ) - ${f(P.centerRadius - P.lineWidth / 2)} ) ); // círculo central
  float bx = ${f(P.halfL - P.boxDepth)} + HW;
  d = min( d, sdSeg( q, vec2( bx, ${f(P.boxHalfW - P.lineWidth / 2)} ), vec2( L, ${f(P.boxHalfW - P.lineWidth / 2)} ) ) );
  d = min( d, sdSeg( q, vec2( bx, 0.0 ), vec2( bx, ${f(P.boxHalfW - P.lineWidth / 2)} ) ) );
  float gx = ${f(P.halfL - P.smallBoxDepth)} + HW;
  d = min( d, sdSeg( q, vec2( gx, ${f(P.smallBoxHalfW - P.lineWidth / 2)} ), vec2( L, ${f(P.smallBoxHalfW - P.lineWidth / 2)} ) ) );
  d = min( d, sdSeg( q, vec2( gx, 0.0 ), vec2( gx, ${f(P.smallBoxHalfW - P.lineWidth / 2)} ) ) );
  // meia-lua (fora da grande área)
  vec2 ps = vec2( ${f(P.halfL - P.penaltySpot)}, 0.0 );
  float arc = abs( length( q - ps ) - ${f(P.centerRadius - P.lineWidth / 2)} );
  d = min( d, q.x < bx - HW ? arc : 1e3 );
  // arcos de escanteio
  vec2 c = q - vec2( ${f(P.halfL)}, ${f(P.halfW)} );
  if ( c.x < 0.0 && c.y < 0.0 ) d = min( d, abs( length( c ) - ${f(P.cornerRadius - P.lineWidth / 2)} ) );
  return d;
}
// área técnica: retângulos tracejados diante dos bancos (lado z negativo)
float techArea( vec2 p ) {
  vec2 q = vec2( abs( p.x ), p.y );
  float d = sdSeg( q, vec2( 5.5, -35.0 ), vec2( 18.5, -35.0 ) );
  d = min( d, sdSeg( q, vec2( 5.5, -35.0 ), vec2( 5.5, -38.9 ) ) );
  d = min( d, sdSeg( q, vec2( 18.5, -35.0 ), vec2( 18.5, -38.9 ) ) );
  float dash = step( 0.5, fract( ( q.x + q.y ) * 1.4 ) );
  return d + dash * 10.0;
}
// linha dos fotógrafos atrás de cada gol (fora da frente da meta)
float photoLine( vec2 p ) {
  vec2 q = abs( p );
  return sdSeg( q, vec2( ${f(P.halfL + 2.6)}, 6.0 ), vec2( ${f(P.halfL + 2.6)}, 24.0 ) );
}
float aaLine( float d, float hw ) {
  float w = max( fwidth( d ), 1e-4 );
  float hwE = max( hw, w * 0.5 );
  return ( 1.0 - smoothstep( hwE - w * 0.5, hwE + w * 0.5, d ) ) * ( hw / hwE );
}
`;

const MAP_FRAG = /* glsl */`
  vec2 wp = vPW.xz;
  vec3 g1 = texture2D( map, wp / ${f(TILE)} ).rgb;
  #ifdef GRASS_LOW
  vec3 g2 = g1;
  #else
  vec3 g2 = texture2D( map, mat2( 0.8, -0.6, 0.6, 0.8 ) * wp / ${f(TILE * 2.9)} + 0.37 ).rgb;
  #endif
  float nBig = fbm( wp * 0.035 );
  float nMid = fbm( wp * 0.18 + 7.0 );
  vec3 grass = mix( g1, g2, 0.3 + 0.35 * nMid );
  // correção de cor: verde de gramado de TV (menos amarelo, mais profundo)
  float lum = dot( grass, vec3( 0.3, 0.59, 0.11 ) );
  grass = mix( vec3( lum ), grass, 0.9 ) * vec3( 0.36, 0.62, 0.3 );
  grass *= mix( vec3( 0.86, 0.94, 0.86 ), vec3( 1.1, 1.06, 1.0 ), nBig );
  grassVar = nMid;

  // detalhe fino de perto (folhas): some quando 1 pixel cobre mais que ~2 cm
  detN = vec3( 0.0 );
  detFade = 0.0;
  #ifdef GRASS_DETAIL
  {
    float mpp = length( fwidth( wp ) );
    detFade = 1.0 - smoothstep( 0.006, 0.03, mpp );
    if ( detFade > 0.0 ) {
      vec3 dt = texture2D( uDetail, wp / ${f(DTILE)} ).rgb;
      vec3 dt2 = texture2D( uDetail, mat2( 0.6, 0.8, -0.8, 0.6 ) * wp / ${f(DTILE * 0.61)} + 0.21 ).rgb;
      float dl = ( dt.r - 0.5 ) * 2.0 * 0.65 + ( dt2.r - 0.5 ) * 2.0 * 0.35;
      grass *= 1.0 + dl * 0.9 * detFade;
      detN = vec3( ( dt.g + dt2.g ) - 1.0, 0.0, ( dt.b + dt2.b ) - 1.0 ) * detFade;
    }
  }
  #endif

  // faixas de corte: o brilho depende da direção em que o cortador passou e da visão
  vec3 Vw = normalize( cameraPosition - vPW );
  vec2 vxz = normalize( Vw.xz + vec2( 1e-4 ) );
  float grazing = 1.0 - Vw.y * 0.55;
  float bx = ( wp.x + ${f(P.halfL)} ) / 5.25;
  float parX = clamp( sin( bx * 3.14159265 ) / ( fwidth( bx ) * 3.3 + 0.12 ), -1.0, 1.0 );
  float bz = ( wp.y + ${f(P.halfW)} ) / 6.8;
  float parZ = clamp( sin( bz * 3.14159265 ) / ( fwidth( bz ) * 3.3 + 0.12 ), -1.0, 1.0 );
  float stripe;
  #if MOW == 1
  // xadrez: dois cortes cruzados
  stripe = parX * ( 0.05 + 0.08 * vxz.y * grazing ) + parZ * ( 0.05 + 0.08 * vxz.x * grazing );
  #elif MOW == 2
  float bd = ( wp.x * 0.7071 + wp.y * 0.7071 ) / 6.0;
  float parD = clamp( sin( bd * 3.14159265 ) / ( fwidth( bd ) * 3.3 + 0.12 ), -1.0, 1.0 );
  stripe = parD * ( 0.06 + 0.1 * dot( vxz, vec2( -0.7071, 0.7071 ) ) * grazing );
  #else
  // faixas transversais (cortador andando ao longo de z) + corte cruzado leve.
  // As folhas deitam para +z/-z: o contraste é máximo olhando ao longo de z (câmera de
  // TV, ±12%) e some olhando ao longo de x (atrás do gol) — sem termo fixo, que antes
  // anulava o efeito na câmera de TV e deixava as faixas quase invisíveis.
  stripe = parX * ( 0.006 - 0.12 * vxz.y * grazing ) + parZ * 0.018;
  #endif
  grass *= 1.0 + stripe;

  // desgaste: pequenas áreas, marca do pênalti, círculo central e corredores dos assistentes
  vec2 aw = vec2( abs( wp.x ), wp.y );
  float wear = exp( -pow( ( aw.x - 50.6 ) / 2.6, 2.0 ) - pow( aw.y / 3.6, 2.0 ) ) * 0.95;
  wear += exp( -pow( ( aw.x - 52.2 ) / 0.8, 2.0 ) - pow( aw.y / 3.2, 2.0 ) ) * 0.7;
  wear += exp( -dot( aw - vec2( 41.5, 0.0 ), aw - vec2( 41.5, 0.0 ) ) / 2.0 ) * 0.6;
  wear += exp( -dot( wp, wp ) / 20.0 ) * 0.45;
  wear += exp( -pow( ( abs( wp.y ) - 35.3 ) / 0.6, 2.0 ) ) * step( aw.x, 50.0 ) * 0.25;
  // aquecimento dos goleiros e marcas de trave na frente dos gols
  wear += exp( -pow( ( aw.x - 46.0 ) / 4.0, 2.0 ) - pow( aw.y / 7.0, 2.0 ) ) * 0.18;
  float wn = vnoise( wp * 1.7 ) * 0.6 + vnoise( wp * 5.3 ) * 0.4;
  wear = clamp( wear * ( 0.35 + 1.1 * wn ), 0.0, 1.0 );
  vec3 dirt = vec3( 0.12, 0.095, 0.06 ) * ( 0.5 + 1.2 * lum );
  vec3 tired = grass * vec3( 1.15, 0.9, 0.6 );
  grass = mix( grass, tired, smoothstep( 0.0, 0.5, wear ) * 0.8 );
  grass = mix( grass, dirt, smoothstep( 0.45, 1.0, wear ) * 0.75 );
  grassVar = mix( grassVar, 1.0, smoothstep( 0.45, 1.0, wear ) );

  // linhas
  lineMask = aaLine( pitchLines( wp ), ${f(P.lineWidth / 2)} );
  lineMask = max( lineMask, aaLine( min( length( wp ), length( aw - vec2( 41.5, 0.0 ) ) ), 0.11 ) );
  lineMask = max( lineMask, aaLine( techArea( wp ), 0.04 ) * 0.9 );
  lineMask = max( lineMask, aaLine( photoLine( wp ), 0.03 ) * 0.7 );
  // tinta: um pouco da grama aparece por baixo de perto
  vec3 paint = vec3( 0.88, 0.9, 0.88 ) * uLineBright * ( 0.9 + 0.2 * lum ) * ( 1.0 - 0.12 * detFade * ( 1.0 - grassVar ) );
  diffuseColor.rgb = mix( grass, paint, lineMask );
`;

export function buildPitch(ctx) {
  const { U, anisotropy, isNight } = ctx;
  const W = (P.halfL + P.runoffX) * 2, H = (P.halfW + P.runoffZ) * 2;
  const geo = new THREE.PlaneGeometry(W, H, 12, 8);
  geo.rotateX(-Math.PI / 2);
  // uv em metros/TILE (usado pelo normalMap)
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / TILE, p.getZ(i) / TILE);

  const loader = new THREE.TextureLoader();
  const loads = [];
  const load = (file, srgb) => {
    let res;
    loads.push(new Promise((r) => { res = r; }));
    const t = loader.load(TEX(file), () => res(), undefined, () => res());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const map = load('grass_color.jpg', true);

  // grassDetail 0 (celulares fracos): sem normal map, sem detalhe e uma amostra só da textura
  const gd = ctx.quality.grassDetail ?? 2;
  const low = gd === 0;
  const normalMap = low ? null : load('grass_normal.jpg', false);
  const detailTex = gd >= 1 ? load('grass_detail.jpg', false) : null;
  const mat = new THREE.MeshStandardMaterial({
    map, normalMap, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.92, metalness: 0,
  });
  const mow = MOW[ctx.mow] ?? 0;
  mat.defines = { MOW: mow };
  if (low) mat.defines.GRASS_LOW = '';
  if (detailTex) mat.defines.GRASS_DETAIL = '';
  if (gd >= 2) mat.defines.GRASS_DETAIL_N = '';
  const lineBright = { value: isNight ? 1.0 : 0.95 };
  // gramado regado: à noite o brilho especular fica mais fechado e aparece nos refletores
  const wet = { value: isNight ? 1 : ctx.tod === 'tarde' ? 0.35 : 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLineBright = lineBright;
    sh.uniforms.uWet = wet;
    sh.uniforms.uDetail = { value: detailTex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PITCH_GLSL)
      .replace('#include <map_fragment>', MAP_FRAG)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix( roughnessFactor, mix( 0.8, 0.55, grassVar ) , uWet * 0.9 );
        roughnessFactor = mix( roughnessFactor, 0.75, lineMask );`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef GRASS_DETAIL_N
        normal = normalize( normal + ( viewMatrix * vec4( detN.x, 0.0, -detN.z, 0.0 ) ).xyz * 0.9 );
        #endif
        normal = normalize( mix( normal, nonPerturbedNormal, lineMask * 0.8 ) );`);
  };
  mat.customProgramCacheKey = () => `golaco-gramado-${gd}-${mow}`;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'gramado';
  mesh.receiveShadow = true;
  mesh.userData.ready = Promise.all(loads);
  mesh.userData.dispose = () => { if (detailTex) detailTex.dispose(); };
  return mesh;
}
