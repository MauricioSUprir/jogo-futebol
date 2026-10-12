// Sinalizadores da torcida (three.js; pedido de 11/10: "sinalizadores"): só em momento marcado — a saída de cada
// tempo, o gol (da casa: vermelhos na organizada e nas quinas; do visitante: brancos no setor deles) e a vitória no
// fim; nunca com a bola rolando sem evento (festa.js agenda). Uma malha instanciada só (1 chamada de desenho, e só
// enquanto algum queima ou a fumaça ainda sobe): por sinalizador um NÚCLEO (aditivo, cintilando), um HALO (aditivo,
// ~6 m) e a FUMAÇA (Média 10, Alta 14 partículas; nenhuma na Baixa), tudo calculado no vertex shader a partir de
// (sinalizador, índice, tempo) — fumaca.js FUMACA_GLSL, a mesma conta do JS. Mistura pré-multiplicada (ONE,
// ONE_MINUS_SRC_ALPHA): o aditivo e a fumaça no mesmo desenho, sem ordenar. A LUZ vermelha no estádio é falsa
// (luz-falsa.js: uniform na torcida, na arquibancada e nas bandeiras; nunca PointLight).
import * as THREE from 'three';
import { FUMACA, FUMACA_GLSL } from './fumaca.js';
import { FESTA, fogoSinalizador } from './festa.js';
import { LUZ_FALSA } from './luz-falsa.js';
import { criarCanvas, texturaCanvas, gerador } from './util.js';

const MAX = FESTA.sinalizadores.max;
const P_MAX = FUMACA.porQualidade.alta;

const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec2 aInst;              // (sinalizador k, papel j: 0 núcleo, 1 halo, 2… fumaça)
uniform vec4 uFl[${MAX}];          // x, y, z, t0
uniform vec4 uFlB[${MAX}];         // dur, cor (0 vermelho, 1 branco), semente, ativo
uniform float uFogo[${MAX}];       // força do fogo agora (festa.js fogoSinalizador)
uniform float uT;
uniform float uP;
uniform float uNoite;
uniform float uDepura;
varying vec2 vUv;
varying vec4 vCor;
varying float vTipo;
${FUMACA_GLSL}
void main() {
  int k = int(aInst.x + 0.5);
  float j = aInst.y;
  vec4 s = uFl[0], sb = uFlB[0];
  float fogo = 0.0;
  for (int i = 0; i < ${MAX}; i++) if (i == k) { s = uFl[i]; sb = uFlB[i]; fogo = uFogo[i]; }
  vec3 centro = s.xyz + vec3(0.0, ${LUZ_FALSA.altura.toFixed(2)}, 0.0);
  float tam = 0.0;
  vCor = vec4(0.0);
  vTipo = j < 0.5 ? 0.0 : (j < 1.5 ? 1.0 : 2.0);
  vec3 cfogo = sb.y < 0.5 ? vec3(1.0, 0.36, 0.12) : vec3(1.0, 0.95, 0.85);
  if (j < 0.5) {
    // núcleo: pequeno, quase branco no meio, cintilando
    tam = fogo > 0.0 ? 0.9 * (0.85 + 0.25 * fogo) : 0.0;
    vCor = vec4(mix(cfogo, vec3(1.0, 0.95, 0.8), 0.55) * (1.6 + 0.8 * fogo), 0.0);
  } else if (j < 1.5) {
    tam = fogo > 0.0 ? 6.0 : 0.0;
    vCor = vec4(cfogo * fogo * mix(0.35, 0.7, uNoite), 0.0);
  } else {
    float a;
    vec4 pp = fumacaParticula(s, sb, j - 2.0, uP, uT, a);
    if (j - 2.0 >= uP) pp.w = 0.0;
    centro = pp.xyz;
    tam = pp.w;
    // a fumaça perto do fogo fica tingida pela luz dele
    float perto = clamp(1.0 - (pp.y - s.y - ${FUMACA.fogo.toFixed(2)}) / 3.0, 0.0, 1.0) * fogo;
    vec3 base = sb.y < 0.5 ? vec3(0.72, 0.68, 0.68) : vec3(0.86, 0.86, 0.86);
    vCor = vec4(mix(base * mix(1.0, 0.45, uNoite), cfogo, 0.45 * perto), a);
  }
  if (tam <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vUv = vec2(0.0); return; }
  // quadro virado para a câmera
  vec3 dir = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 cima = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = centro + (dir * position.x + cima * position.y) * tam;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = position.xy + 0.5;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uFumaca;
uniform float uDepura;
varying vec2 vUv;
varying vec4 vCor;
varying float vTipo;
void main() {
  vec2 d = vUv * 2.0 - 1.0;
  float r = dot(d, d);
  if (r > 1.0) discard;
  vec4 c;
  if (vTipo < 0.5) { float a = exp(-r * 5.0); c = vec4(vCor.rgb * a, 0.0); }
  else if (vTipo < 1.5) { float a = (1.0 - r); a *= a * a; c = vec4(vCor.rgb * a, 0.0); }
  else { float a = texture2D(uFumaca, vUv).a * vCor.a; if (a < 0.004) discard; c = vec4(vCor.rgb * a, a); }
  // passada de depuração (overdraw): cada camada soma 1/255
  if (uDepura > 0.5) { gl_FragColor = vec4(1.0 / 255.0, 0.0, 0.0, 0.0); return; }
  gl_FragColor = c;
  #include <fog_fragment>
}
`;

/** Textura da fumaça (64², por código): um puff macio com ruído (o alfa). */
function texFumaca() {
  const n = 64, c = criarCanvas(n, n), g = c.getContext('2d');
  const img = g.createImageData(n, n);
  const r = gerador(31);
  const grade = Array.from({ length: 9 * 9 }, () => r());
  const ruido = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const at = (a, b) => grade[((b % 9) + 9) % 9 * 9 + ((a % 9) + 9) % 9];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return at(xi, yi) * (1 - sx) * (1 - sy) + at(xi + 1, yi) * sx * (1 - sy) + at(xi, yi + 1) * (1 - sx) * sy + at(xi + 1, yi + 1) * sx * sy;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1, rr = Math.sqrt(dx * dx + dy * dy);
    const nz = 0.55 * ruido(x / 8, y / 8) + 0.45 * ruido(x / 4 + 3, y / 4 + 7);
    const a = Math.max(0, 1 - rr) ** 1.6 * (0.55 + 0.9 * nz);
    const k = 4 * (y * n + x);
    img.data[k] = 255; img.data[k + 1] = 255; img.data[k + 2] = 255; img.data[k + 3] = Math.round(Math.min(1, a) * 255);
  }
  g.putImageData(img, 0, 0);
  return texturaCanvas(c, { cor: false });
}

/** Cria os sinalizadores. opc = {qualidade, hora}. Devolve {mesh, atualizar(festa, t), definirQualidade, definirHora, ...}. */
export function criarSinalizadores(cena, opc = {}) {
  const quad = new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', quad);
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  // ordem: papel j por fora (0 núcleo, 1 halo, 2… fumaça) e sinalizador k por dentro — a qualidade é um prefixo
  const inst = new Float32Array(2 * MAX * (2 + P_MAX));
  for (let j = 0, i = 0; j < 2 + P_MAX; j++) for (let k = 0; k < MAX; k++, i++) { inst[2 * i] = k; inst[2 * i + 1] = j; }
  geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 2));
  const tex = texFumaca();
  const uni = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uFl: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uFlB: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uFogo: { value: new Float32Array(MAX) },
    uT: { value: 0 }, uP: { value: 0 }, uNoite: { value: 0 }, uDepura: { value: 0 }, uFumaca: { value: tex },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'festa-sinalizadores';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;        // depois da torcida e da rede (translúcido)
  mesh.visible = false;
  cena.add(mesh);
  let P = 0, qualidade = null, cheio = 0, precarga = true;
  const api = {
    mesh, uniforms: uni,
    /** festa (festa.js) e t no relógio dela (emocao.t): posições, força do fogo; some quando nada queima nem fuma. */
    atualizar(festa, t, desenha = true) {
      uni.uT.value = t;
      let vivo = false;
      const fl = festa ? festa.flares : [];
      for (let k = 0; k < MAX; k++) {
        const s = fl[k];
        if (!s || !s.ativo) { uni.uFlB.value[k].set(0, 0, 0, 0); uni.uFogo.value[k] = 0; continue; }
        uni.uFl.value[k].set(s.x, s.y, s.z, s.t0);
        uni.uFlB.value[k].set(s.dur, s.cor, s.semente, 1);
        uni.uFogo.value[k] = fogoSinalizador(s, t);
        if (t >= s.t0 - 0.1 && t <= s.t0 + s.dur + (P > 0 ? FUMACA.vida : 0)) vivo = true;
      }
      // pré-carga (como a torcida): no 1º quadro, apagado, vai para a GPU com 0 instâncias — geometria e programa
      // prontos sem chamada de desenho; o 1º sinalizador da partida não engasga nem sobe a memória da GPU
      if (precarga && desenha && !vivo) { mesh.visible = true; geo.instanceCount = 0; } else { mesh.visible = vivo; geo.instanceCount = cheio; }
      if (desenha) precarga = false;
    },
    definirQualidade(q) {
      if (q === qualidade || FUMACA.porQualidade[q] == null) return;
      qualidade = q;
      P = FUMACA.porQualidade[q];
      uni.uP.value = P;
      cheio = MAX * (2 + P);
      geo.instanceCount = cheio;
    },
    definirHora(h) { uni.uNoite.value = h === 'noite' ? 1 : 0; },
    get quantas() { return geo.instanceCount; },
    /**
     * Overdraw da fumaça (testes): desenha só os sinalizadores numa passada aditiva de 1/255 por camada e soma os pixels
     * → camadas por pixel em "telas cheias" (0,5 = metade da tela coberta uma vez). Sem oclusão (limite de cima).
     */
    medirOverdraw(renderer, camera, escala = 0.25) {
      const tam = renderer.getSize(new THREE.Vector2());
      const w = Math.max(1, Math.round(tam.x * escala)), h = Math.max(1, Math.round(tam.y * escala));
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType });
      const antes = { vis: mesh.visible, bd: material.blendDst, bda: material.blendDstAlpha, cor: renderer.getClearColor(new THREE.Color()), alfa: renderer.getClearAlpha() };
      // soma pura: (1/255, alfa 0) com ONE, ONE
      uni.uDepura.value = 1;
      material.blendDst = THREE.OneFactor; material.blendDstAlpha = THREE.OneFactor;
      const cena2 = new THREE.Scene();
      const pai = mesh.parent;
      cena2.add(mesh);
      mesh.visible = true;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(cena2, camera);
      const px = new Uint8Array(4 * w * h);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
      renderer.setRenderTarget(null);
      renderer.setClearColor(antes.cor, antes.alfa);
      if (pai) pai.add(mesh);
      mesh.visible = antes.vis;
      material.blendDst = antes.bd; material.blendDstAlpha = antes.bda;
      uni.uDepura.value = 0;
      rt.dispose();
      let soma = 0;
      for (let i = 0; i < px.length; i += 4) soma += px[i];
      return soma / (w * h);
    },
    dispose() { cena.remove(mesh); geo.dispose(); material.dispose(); tex.dispose(); },
  };
  api.definirQualidade(opc.qualidade ?? 'media');
  api.definirHora(opc.hora ?? 'dia');
  return api;
}
