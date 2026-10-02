// Desfoque de movimento de câmera (estilo transmissão): reconstrói a posição de
// cada pixel pela profundidade, projeta com a câmera do quadro anterior e borra
// ao longo do deslocamento na tela. Barato (8 amostras) e só no PC.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export class CameraBlurPass extends Pass {
  constructor(camera, strength = 0.6) {
    super();
    this.camera = camera;
    this.prevVP = new THREE.Matrix4();
    this.curVP = new THREE.Matrix4();
    this.first = true;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null },
        uInvVP: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() },
        uStrength: { value: strength },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse, tDepth; uniform mat4 uInvVP, uPrevVP; uniform float uStrength;
        varying vec2 vUv;
        void main() {
          float d = texture2D(tDepth, vUv).x;
          vec4 ndc = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 w = uInvVP * ndc; w /= w.w;
          vec4 p = uPrevVP * w; vec2 prevUv = p.xy / p.w * 0.5 + 0.5;
          vec2 vel = (vUv - prevUv) * uStrength;
          float L = length(vel);
          if (L > 0.035) vel *= 0.035 / L;
          vec4 c = texture2D(tDiffuse, vUv);
          if (L < 0.0008) { gl_FragColor = c; return; }
          vec4 acc = c; float n = 1.0;
          for (int i = 1; i < 8; i++) {
            float t = float(i) / 7.0 - 0.5;
            acc += texture2D(tDiffuse, vUv + vel * t); n += 1.0;
          }
          gl_FragColor = acc / n;
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera;
    this.curVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    if (this.first) { this.prevVP.copy(this.curVP); this.first = false; }
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.uInvVP.value.copy(this.curVP).invert();
    u.uPrevVP.value.copy(this.prevVP);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
    this.prevVP.copy(this.curVP);
  }

  // cortes de câmera (replay, comemoração) não devem borrar
  reset() { this.first = true; }

  dispose() { this.material.dispose(); this.quad.dispose(); }
}
