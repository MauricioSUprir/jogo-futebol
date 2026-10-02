// Pós-processamento leve para celular (qualidade 'media') e correção de cor
// "embutida" nos materiais (qualidade 'baixa', sem passe extra nenhum).
//
// O que foi aproveitado da pesquisa:
// - "Uber shader" (Unity PostProcessing, ARM "Post-processing effects on mobile"):
//   em GPU de celular (tile-based) o que custa é banda de memória; cada passe de tela
//   cheia lê e escreve o quadro inteiro. Então tonemapping ACES, correção de cor,
//   vinheta, nitidez leve e a soma do bloom vão num ÚNICO passe final.
// - Bloom "dual filter" (Marius Bjørge, ARM, SIGGRAPH 2015 "Bandwidth-efficient
//   rendering"; Nordeus, Unite 2018 "Post processing at 60 FPS on mid-range
//   smartphones"): o brilho é extraído direto em 1/4 da resolução e borrado com um
//   passe de descida (1/8) e um de subida (1/4) — 3 passes minúsculos (~1/16 dos pixels).
// - Nitidez leve adaptativa ao contraste (ideia do AMD FidelityFX CAS), em razão de
//   luminância para não criar halo nas áreas claras: compensa o upscale do navegador
//   quando a resolução dinâmica baixa.
// - Sem FXAA: three 0.170 é só WebGL2, então o alvo multiamostrado (MSAA 4x) existe
//   sempre; em GPU tile-based o resolve do MSAA é praticamente de graça.
//
// Interface igual à parte usada do EffectComposer: render(dt), setSize(w,h),
// setPixelRatio(pr), dispose(). Extra: setBloom(on), bloomOn.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';

// extrai o brilho (limiar suave) e já desce para 1/4: 4 amostras bilineares = bloco 4x4
const PREFILTER = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr; uniform float uKnee;
varying vec2 vUv;
vec3 pick( vec2 o ) {
  vec3 c = texture2D( tSrc, vUv + o * uTexel ).rgb;
  float l = max( c.r, max( c.g, c.b ) );
  // limiar com joelho suave + peso de Karis (evita vaga-lumes piscando)
  float s = clamp( l - uThr + uKnee, 0.0, 2.0 * uKnee );
  s = s * s / ( 4.0 * uKnee + 1e-4 );
  float w = max( s, l - uThr ) / max( l, 1e-4 );
  return c * w / ( 1.0 + l );
}
void main() {
  vec3 c = pick( vec2( -1.0, -1.0 ) ) + pick( vec2( 1.0, -1.0 ) ) + pick( vec2( -1.0, 1.0 ) ) + pick( vec2( 1.0, 1.0 ) );
  gl_FragColor = vec4( c * 0.25, 1.0 );
}`;
const DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 c = texture2D( tSrc, vUv ).rgb * 4.0;
  c += texture2D( tSrc, vUv + vec2( -h.x, -h.y ) ).rgb + texture2D( tSrc, vUv + vec2( h.x, -h.y ) ).rgb;
  c += texture2D( tSrc, vUv + vec2( -h.x, h.y ) ).rgb + texture2D( tSrc, vUv + vec2( h.x, h.y ) ).rgb;
  gl_FragColor = vec4( c * 0.125, 1.0 );
}`;
const UP = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 c = texture2D( tSrc, vUv + vec2( -2.0 * h.x, 0.0 ) ).rgb + texture2D( tSrc, vUv + vec2( 2.0 * h.x, 0.0 ) ).rgb;
  c += texture2D( tSrc, vUv + vec2( 0.0, -2.0 * h.y ) ).rgb + texture2D( tSrc, vUv + vec2( 0.0, 2.0 * h.y ) ).rgb;
  c += ( texture2D( tSrc, vUv + vec2( -h.x, h.y ) ).rgb + texture2D( tSrc, vUv + vec2( h.x, h.y ) ).rgb ) * 2.0;
  c += ( texture2D( tSrc, vUv + vec2( -h.x, -h.y ) ).rgb + texture2D( tSrc, vUv + vec2( h.x, -h.y ) ).rgb ) * 2.0;
  gl_FragColor = vec4( c / 12.0, 1.0 );
}`;

// correção de cor compartilhada (mesma "cara" de transmissão em todas as qualidades)
export const GRADE_GLSL = /* glsl */`
vec3 golacoRRT( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
vec3 golacoACES( vec3 c ) {
  const mat3 IM = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 OM = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  c = OM * golacoRRT( IM * ( c / 0.6 ) );
  return clamp( c, 0.0, 1.0 );
}
// grade em espaço linear: saturação (luma Rec.709) e contraste em S no espaço ~perceptual
vec3 golacoGrade( vec3 c, float sat, float con ) {
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = max( mix( vec3( l ), c, sat ), 0.0 );
  vec3 p = sqrt( c );
  p = clamp( ( p - 0.5 ) * con + 0.5, 0.0, 1.0 );
  return p * p;
}`;

const FINAL = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBloomHi;
uniform vec2 uTexel; uniform float uBloom; uniform float uExposure; uniform float uSharp;
uniform float uSat; uniform float uCon; uniform float uVig; uniform vec3 uTint; uniform vec2 uAspect;
varying vec2 vUv;
${GRADE_GLSL}
float lum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( max( c, vec3( 0.0 ) ), vec3( 0.41666 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
  vec3 c = texture2D( tScene, vUv ).rgb;
  #ifdef SHARPEN
  // nitidez: cruz de 4 vizinhos, ganho relativo à luminância e limitado (sem halos)
  float n = lum( texture2D( tScene, vUv + vec2( uTexel.x, 0.0 ) ).rgb ) + lum( texture2D( tScene, vUv - vec2( uTexel.x, 0.0 ) ).rgb )
          + lum( texture2D( tScene, vUv + vec2( 0.0, uTexel.y ) ).rgb ) + lum( texture2D( tScene, vUv - vec2( 0.0, uTexel.y ) ).rgb );
  float lc = lum( c ), ln = n * 0.25;
  c *= 1.0 + clamp( ( lc - ln ) / ( ln + 0.03 ), -0.35, 0.35 ) * uSharp;
  #endif
  #ifdef BLOOM
  c += ( texture2D( tBloom, vUv ).rgb * 0.75 + texture2D( tBloomHi, vUv ).rgb * 0.25 ) * uBloom;
  #endif
  c = golacoACES( c * uExposure * uTint );
  c = golacoGrade( c, uSat, uCon );
  vec2 d = ( vUv - 0.5 ) * uAspect;
  c *= 1.0 - uVig * dot( d, d );
  c = toSRGB( c );
  // pontilhado de 1/255 contra faixas no céu e no gramado escuro
  float r = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  gl_FragColor = vec4( c + ( r - 0.5 ) / 255.0, 1.0 );
}`;

// Parâmetros de cor por horário (iguais ao GRADE das qualidades altas, mais um toque
// quente no dia e frio à noite).
export function gradeParams(isNight) {
  return isNight
    ? { sat: 1.06, con: 1.1, vig: 0.42, tint: [0.99, 1.0, 1.02], bloom: 0.55, thr: 1.1, knee: 0.5 }
    : { sat: 1.05, con: 1.08, vig: 0.38, tint: [1.02, 1.0, 0.97], bloom: 0.3, thr: 1.6, knee: 0.6 };
}

export class MobilePost {
  // opts: { night, bloom (bool), sharpen (0..1), msaa (bool), exposure }
  constructor(renderer, scene, camera, opts = {}) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.opts = opts;
    const G = gradeParams(!!opts.night);
    this.pr = renderer.getPixelRatio();
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    const hf = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rt = new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: opts.msaa === false ? 0 : 4 });
    this.bA = new THREE.WebGLRenderTarget(1, 1, hf);
    this.bB = new THREE.WebGLRenderTarget(1, 1, hf);
    this.bC = new THREE.WebGLRenderTarget(1, 1, hf);
    const mk = (frag, uniforms, defines) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, defines: defines || {}, depthTest: false, depthWrite: false, toneMapped: false });
    this.mPre = mk(PREFILTER, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: G.thr }, uKnee: { value: G.knee } });
    this.mDown = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    const defs = {};
    if (opts.sharpen > 0) defs.SHARPEN = '';
    if (opts.bloom) defs.BLOOM = '';
    this.mFinal = mk(FINAL, {
      tScene: { value: this.rt.texture }, tBloom: { value: this.bC.texture }, tBloomHi: { value: this.bA.texture },
      uTexel: { value: new THREE.Vector2() }, uBloom: { value: G.bloom }, uExposure: { value: opts.exposure ?? 1 },
      uSharp: { value: opts.sharpen || 0 }, uSat: { value: G.sat }, uCon: { value: G.con }, uVig: { value: G.vig },
      uTint: { value: new THREE.Vector3(...G.tint) }, uAspect: { value: new THREE.Vector2(1, 1) },
    }, defs);
    this.quad = new FullScreenQuad(null);
    this.bloomOn = !!opts.bloom;
    this.bloomI = G.bloom;
    this.setSize(sz.x / this.pr, sz.y / this.pr);
  }

  // liga/desliga sem recompilar (evita engasgo): zera a soma e pula os 3 passes
  setBloom(on) {
    on = !!on && !!this.opts.bloom;
    if (on === this.bloomOn) return;
    this.bloomOn = on;
    this.mFinal.uniforms.uBloom.value = on ? this.bloomI : 0;
  }

  setPixelRatio(pr) { this.pr = pr; }

  setSize(w, h) {
    const W = Math.max(1, Math.round(w * this.pr)), H = Math.max(1, Math.round(h * this.pr));
    this.rt.setSize(W, H);
    const qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2);
    this.bA.setSize(qw, qh); this.bC.setSize(qw, qh);
    this.bB.setSize(Math.max(1, qw >> 1), Math.max(1, qh >> 1));
    this.mPre.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.mDown.uniforms.uTexel.value.set(0.5 / qw, 0.5 / qh);
    this.mUp.uniforms.uTexel.value.set(0.5 / (qw >> 1 || 1), 0.5 / (qh >> 1 || 1));
    this.mFinal.uniforms.uTexel.value.set(1 / W, 1 / H);
    // vinheta elíptica que respeita o formato da tela (paisagem de celular é bem larga)
    const a = W / H;
    this.mFinal.uniforms.uAspect.value.set(a > 1 ? Math.sqrt(a) : 1, a > 1 ? 1 : Math.sqrt(1 / a)).multiplyScalar(1.15);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  render() {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.camera);
    if (this.bloomOn) {
      this.mPre.uniforms.tSrc.value = this.rt.texture; this.pass(this.mPre, this.bA);
      this.mDown.uniforms.tSrc.value = this.bA.texture; this.pass(this.mDown, this.bB);
      this.mUp.uniforms.tSrc.value = this.bB.texture; this.pass(this.mUp, this.bC);
    }
    this.pass(this.mFinal, null);
  }

  dispose() {
    for (const t of [this.rt, this.bA, this.bB, this.bC]) t.dispose();
    for (const m of [this.mPre, this.mDown, this.mUp, this.mFinal]) m.dispose();
    this.quad.dispose();
  }
}

// Qualidade 'baixa': nenhum passe extra. A mesma correção de cor entra no
// tonemapping de CADA material (THREE.CustomToneMapping), que já roda no shader
// de qualquer forma — custo ~zero. Chamar uma vez, antes de compilar os materiais.
let installed = false;
export function installMaterialGrade() {
  if (installed) return;
  installed = true;
  const G = { sat: 1.0, con: 1.08, tint: [1.0, 1.0, 0.985] }; // neutro: vale p/ dia e noite
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    `${GRADE_GLSL}
vec3 CustomToneMapping( vec3 color ) {
  vec3 c = golacoACES( color * toneMappingExposure * vec3( ${G.tint.map((v) => v.toFixed(3)).join(', ')} ) );
  return golacoGrade( c, ${G.sat.toFixed(3)}, ${G.con.toFixed(3)} );
}`);
}
