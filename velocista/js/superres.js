// SUPER RESOLUÇÃO (dono, 30/10: "quero um dlss 5" → o DLSS só existe em jogos instalados com o kit da NVIDIA numa placa
// RTX; no navegador, a mesma ideia com código aberto): a cena é desenhada numa resolução interna menor e reconstruída na
// resolução da tela em dois passos, a partir do FidelityFX Super Resolution 1 da AMD (licença MIT):
//   1. EASU — reamostragem adaptativa às bordas: 12 amostras em volta do pixel, a direção e o comprimento da borda pela
//      luminância, um núcleo tipo Lanczos esticado ao longo da borda e o resultado preso entre o mínimo e o máximo dos 4
//      vizinhos (sem halo);
//   2. RCAS — nitidez adaptativa ao contraste: realça só até onde não estoura o vizinho mais claro/escuro, com o filtro
//      de ruído (não realça granulado).
// Roda depois do OutputPass (no espaço da tela, já com o tom e o sRGB), como o FSR pede. Os presets são os dos jogos.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const PRESETS = {
  nativa: { nome: 'Nativa', escala: 1 },
  qualidade: { nome: 'Qualidade', escala: 0.77 },
  equilibrado: { nome: 'Equilibrado', escala: 0.67 },
  desempenho: { nome: 'Desempenho', escala: 0.5 },
};

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const EASU = {
  uniforms: { tDiffuse: { value: null }, tam: { value: new THREE.Vector2(1, 1) } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 tam; varying vec2 vUv;
    vec3 px(vec2 p) { return texture2D(tDiffuse, (p + 0.5) / tam).rgb; }
    float lum(vec3 c) { return c.g + 0.5 * (c.r + c.b); }
    void soma(inout vec2 dir, inout float len, float w, float lA, float lB, float lC, float lD, float lE) {
      float lenX = max(abs(lD - lC), abs(lC - lB)), dirX = lD - lB;
      dir.x += dirX * w; lenX = clamp(abs(dirX) / max(lenX, 1e-5), 0.0, 1.0); len += lenX * lenX * w;
      float lenY = max(abs(lE - lC), abs(lC - lA)), dirY = lE - lA;
      dir.y += dirY * w; lenY = clamp(abs(dirY) / max(lenY, 1e-5), 0.0, 1.0); len += lenY * lenY * w;
    }
    void tap(inout vec3 aC, inout float aW, vec2 off, vec2 dir, vec2 len2, float lob, float clp, vec3 c) {
      vec2 v = vec2(dot(off, dir), dot(off, vec2(-dir.y, dir.x))) * len2;
      float d2 = min(dot(v, v), clp);
      float wB = 0.4 * d2 - 1.0, wA = lob * d2 - 1.0;
      wB *= wB; wA *= wA; wB = 1.5625 * wB - 0.5625;
      float w = wB * wA; aC += c * w; aW += w;
    }
    void main() {
      vec2 pp = vUv * tam - 0.5, fp = floor(pp); pp -= fp;
      //    b c
      //  e f g h
      //  i j k l
      //    n o
      vec3 b = px(fp + vec2(0.0, -1.0)), c = px(fp + vec2(1.0, -1.0));
      vec3 e = px(fp + vec2(-1.0, 0.0)), f = px(fp), g = px(fp + vec2(1.0, 0.0)), h = px(fp + vec2(2.0, 0.0));
      vec3 i = px(fp + vec2(-1.0, 1.0)), j = px(fp + vec2(0.0, 1.0)), k = px(fp + vec2(1.0, 1.0)), l = px(fp + vec2(2.0, 1.0));
      vec3 n = px(fp + vec2(0.0, 2.0)), o = px(fp + vec2(1.0, 2.0));
      float bL = lum(b), cL = lum(c), eL = lum(e), fL = lum(f), gL = lum(g), hL = lum(h), iL = lum(i), jL = lum(j), kL = lum(k), lL = lum(l), nL = lum(n), oL = lum(o);
      vec2 dir = vec2(0.0); float len = 0.0;
      soma(dir, len, (1.0 - pp.x) * (1.0 - pp.y), bL, eL, fL, gL, jL);
      soma(dir, len, pp.x * (1.0 - pp.y), cL, fL, gL, hL, kL);
      soma(dir, len, (1.0 - pp.x) * pp.y, fL, iL, jL, kL, nL);
      soma(dir, len, pp.x * pp.y, gL, jL, kL, lL, oL);
      float dirR = dot(dir, dir); bool zero = dirR < 1.0 / 32768.0;
      dirR = zero ? 1.0 : inversesqrt(dirR); dir.x = zero ? 1.0 : dir.x; dir *= dirR;
      len = len * 0.5; len *= len;
      float estica = dot(dir, dir) / max(abs(dir.x), abs(dir.y));
      vec2 len2 = vec2(1.0 + (estica - 1.0) * len, 1.0 - 0.5 * len);
      float lob = 0.5 - 0.29 * len, clp = 1.0 / lob;
      vec3 mn = min(min(f, g), min(j, k)), mx = max(max(f, g), max(j, k));
      vec3 aC = vec3(0.0); float aW = 0.0;
      tap(aC, aW, vec2(0.0, -1.0) - pp, dir, len2, lob, clp, b);
      tap(aC, aW, vec2(1.0, -1.0) - pp, dir, len2, lob, clp, c);
      tap(aC, aW, vec2(-1.0, 1.0) - pp, dir, len2, lob, clp, i);
      tap(aC, aW, vec2(0.0, 1.0) - pp, dir, len2, lob, clp, j);
      tap(aC, aW, vec2(0.0, 0.0) - pp, dir, len2, lob, clp, f);
      tap(aC, aW, vec2(-1.0, 0.0) - pp, dir, len2, lob, clp, e);
      tap(aC, aW, vec2(1.0, 1.0) - pp, dir, len2, lob, clp, k);
      tap(aC, aW, vec2(2.0, 1.0) - pp, dir, len2, lob, clp, l);
      tap(aC, aW, vec2(2.0, 0.0) - pp, dir, len2, lob, clp, h);
      tap(aC, aW, vec2(1.0, 0.0) - pp, dir, len2, lob, clp, g);
      tap(aC, aW, vec2(1.0, 2.0) - pp, dir, len2, lob, clp, o);
      tap(aC, aW, vec2(0.0, 2.0) - pp, dir, len2, lob, clp, n);
      gl_FragColor = vec4(min(mx, max(mn, aC / max(aW, 1e-5))), 1.0);
    }`,
};

const RCAS = {
  uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2(1, 1) }, nitidez: { value: 0.85 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 texel; uniform float nitidez; varying vec2 vUv;
    float lum(vec3 c) { return c.g + 0.5 * (c.r + c.b); }
    void main() {
      //   b
      // d e f
      //   h
      vec3 b = texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb, d = texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb;
      vec3 e = texture2D(tDiffuse, vUv).rgb;
      vec3 f = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb, h = texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb;
      vec3 mn4 = min(min(b, d), min(f, h)), mx4 = max(max(b, d), max(f, h));
      // até onde dá para realçar sem passar do vizinho mais escuro (0) nem do mais claro (1)
      vec3 hitMin = min(mn4, e) / max(4.0 * mx4, vec3(1e-4));
      vec3 hitMax = (1.0 - max(mx4, e)) / min(4.0 * mn4 - 4.0, vec3(-1e-4));
      vec3 lobeRGB = max(-hitMin, hitMax);
      float lobe = max(-0.1875, min(max(lobeRGB.r, max(lobeRGB.g, lobeRGB.b)), 0.0)) * nitidez;
      // filtro de ruído: onde o centro destoa sozinho dos vizinhos (granulado), realça menos
      float bL = lum(b), dL = lum(d), eL = lum(e), fL = lum(f), hL = lum(h);
      float nz = 0.25 * (bL + dL + fL + hL) - eL;
      float faixa = max(max(max(bL, dL), max(fL, hL)), eL) - min(min(min(bL, dL), min(fL, hL)), eL);
      nz = clamp(abs(nz) / max(faixa, 1e-5), 0.0, 1.0); nz = -0.5 * nz + 1.0;
      lobe *= nz;
      gl_FragColor = vec4((lobe * (b + d + f + h) + e) / (4.0 * lobe + 1.0), 1.0);
    }`,
};

/** O passe final: reconstrói a imagem da resolução interna na da tela (EASU) e realça (RCAS). */
export class PassoSuperRes extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.easu = new THREE.ShaderMaterial({ ...EASU, uniforms: THREE.UniformsUtils.clone(EASU.uniforms), depthTest: false, depthWrite: false });
    this.rcas = new THREE.ShaderMaterial({ ...RCAS, uniforms: THREE.UniformsUtils.clone(RCAS.uniforms), depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(null);
    this.alvo = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  }
  /** o tamanho da resolução interna (o composer chama) */
  setSize(w, h) { this.easu.uniforms.tam.value.set(Math.max(1, w), Math.max(1, h)); }
  /** o tamanho da saída (a tela, em pixels de verdade) */
  saida(w, h) { w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); this.alvo.setSize(w, h); this.rcas.uniforms.texel.value.set(1 / w, 1 / h); }
  render(renderer, writeBuffer, readBuffer) {
    this.easu.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.easu; renderer.setRenderTarget(this.alvo); this.quad.render(renderer);
    this.rcas.uniforms.tDiffuse.value = this.alvo.texture;
    this.quad.material = this.rcas; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.easu.dispose(); this.rcas.dispose(); this.alvo.dispose(); this.quad.dispose(); }
}
