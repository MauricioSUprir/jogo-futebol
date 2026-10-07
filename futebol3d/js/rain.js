// Chuva (§33): gotas como segmentos de reta animados TODO no shader de vértice — sem
// custo de CPU por quadro. As gotas vivem numa caixa em volta da câmera que "acompanha"
// o olhar (posição módulo o tamanho da caixa), caem inclinadas pelo vento e somem ao
// longe. Um draw call; quantidade pela qualidade gráfica.
import * as THREE from 'three';

const VERT = /* glsl */`
attribute vec4 aSeed;          // xyz = posição na caixa (0..1), w = 0 topo / 1 base do risco
uniform float uTime, uLen, uSpeed;
uniform vec3 uCam, uBox, uWind;
varying float vA;
void main() {
  vec3 fall = vec3(uWind.x, -uSpeed, uWind.z);
  // posição da gota: semente + queda no tempo, dobrada na caixa centrada na câmera
  vec3 p = aSeed.xyz * uBox + fall * (uTime + aSeed.x * 7.0);
  p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
  p += normalize(fall) * uLen * aSeed.w;          // o risco da gota (motion blur da queda)
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = length(mv.xyz);
  vA = smoothstep(uBox.x * 0.5, uBox.x * 0.2, d) * smoothstep(0.6, 2.5, d) * (1.0 - aSeed.w * 0.6);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform vec3 uColor; uniform float uOpacity;
varying float vA;
void main() { gl_FragColor = vec4(uColor, uOpacity * vA); }`;

export class Rain {
  constructor(scene, { level = 0.5, quality = 'media', night = false } = {}) {
    const n = Math.round((quality === 'baixa' ? 900 : quality === 'media' ? 1800 : 3200) * (0.4 + 0.6 * level));
    const seeds = new Float32Array(n * 2 * 4);
    for (let i = 0; i < n; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      seeds.set([x, y, z, 0, x, y, z, 1], i * 8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.u = {
      uTime: { value: 0 }, uLen: { value: 0.35 + 0.35 * level }, uSpeed: { value: 9 + 5 * level },
      uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(36, 22, 36) },
      uWind: { value: new THREE.Vector3(1.2, 0, 0.6) },
      uColor: { value: new THREE.Color(night ? 0xd8e6ff : 0xc9d2dc) }, uOpacity: { value: (night ? 0.42 : 0.3) * (0.6 + 0.4 * level) },
    };
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u, transparent: true, depthWrite: false });
    this.mesh = new THREE.LineSegments(g, m);
    this.mesh.frustumCulled = false; this.mesh.name = 'chuva'; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  update(dt, camera) { this.u.uTime.value += dt; this.u.uCam.value.copy(camera.position); }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
