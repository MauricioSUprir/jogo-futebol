// Pós-processamento: bloom (o brilho dos raios, das janelas e dos letreiros), borrão de velocidade radial (mais forte
// nas bordas, o herói fica nítido) e vinheta. No celular o bloom roda em meia resolução e o borrão usa menos amostras.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BORRAO = {
  uniforms: { tDiffuse: { value: null }, forca: { value: 0 }, centro: { value: new THREE.Vector2(0.5, 0.48) }, vinheta: { value: 0.25 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float forca; uniform vec2 centro; uniform float vinheta; varying vec2 vUv;
    void main() {
      vec2 d = vUv - centro;
      float r = length(d);
      float m = smoothstep(0.12, 0.6, r) * forca;           // centro (o herói) nítido; bordas borradas
      vec4 c = vec4(0.0);
      for (int i = 0; i < AMOSTRAS; i++) { float t = float(i) / float(AMOSTRAS); c += texture2D(tDiffuse, vUv - d * t * m * 0.22); }
      c /= float(AMOSTRAS);
      c.rgb *= 1.0 - vinheta * smoothstep(0.35, 0.95, r);
      gl_FragColor = c;
    }`,
};

export function criarPosFx(renderer, cena, camera, { mobile = false } = {}) {
  // alvo com MSAA 4× (WebGL 2): tira o serrilhado das bordas, que o pós-processamento perdia (o antialias do canvas não vale aqui)
  const alvo = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  const composer = new EffectComposer(renderer, alvo);
  composer.addPass(new RenderPass(cena, camera));
  const tam = new THREE.Vector2(innerWidth, innerHeight);
  const bloom = new UnrealBloomPass(mobile ? tam.clone().multiplyScalar(0.5) : tam, 0.55, 0.45, 0.82);
  composer.addPass(bloom);
  const borrao = new ShaderPass({ ...BORRAO, defines: { AMOSTRAS: mobile ? 6 : 10 } });
  composer.addPass(borrao);
  composer.addPass(new OutputPass());
  return {
    composer, bloom, borrao,
    /** velocidade 0..1 (0 = parado), noite 0..1 */
    ajustar(veloc, noite) {
      borrao.uniforms.forca.value += (veloc - borrao.uniforms.forca.value) * 0.15;
      // no celular o passe do borrão só roda correndo: parado/andando é uma tela cheia a menos por quadro
      if (mobile) borrao.enabled = borrao.uniforms.forca.value > 0.02;
      bloom.strength = 0.42 + 0.35 * noite + 0.25 * veloc;
      bloom.threshold = 0.85 - 0.12 * noite;
    },
    tamanho(w, h, pr) { composer.setPixelRatio(pr); composer.setSize(w, h); if (mobile) bloom.setSize(w * pr * 0.5, h * pr * 0.5); },
    render() { composer.render(); },
  };
}
