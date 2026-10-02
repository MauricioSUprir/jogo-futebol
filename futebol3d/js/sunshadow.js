// Sombra do sol ajustada ao enquadramento da câmera (estável e nítida).
//
// Antes a câmera ortográfica da sombra cobria o campo inteiro (≈ 115 x 75 m): com
// mapa de 1024 cada texel tinha ~11 cm e a sombra dos jogadores virava borrão. Aqui,
// a cada quadro, cobrimos só a parte do gramado que a câmera enxerga (pegada do
// frustum no chão, recortada no campo + margem), o que na câmera de TV dá 2–4x mais
// resolução sem custo extra.
//
// Estabilidade (sem "tremer/rastejar" quando a câmera anda) — técnica clássica de
// "Common Techniques to Improve Shadow Depth Maps" (Microsoft) / CSM estável:
//   1. o tamanho do retângulo é quantizado em degraus (só muda quando a pegada muda bem);
//   2. o centro é encaixado em múltiplos inteiros do tamanho do texel no espaço da luz;
//   3. a direção da luz nunca muda (só transladamos luz + alvo juntos).
// Por que nada some: um objeto que projeta sombra num ponto visível tem as mesmas
// coordenadas XY (no espaço da luz) que esse ponto — basta o retângulo cobrir os
// receptores visíveis e a luz ficar longe o bastante (near/far folgados).
import * as THREE from 'three';

const _v = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
const _rot = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const NDC = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]];

export class SunShadowFit {
  // light: DirectionalLight com sombra; sunDir: direção PARA a luz (normalizada)
  // opts: { halfL, halfW (meia área a cobrir, com margem), maxDist (alcance do chão visto), step (m) }
  constructor(light, sunDir, opts = {}) {
    this.light = light;
    this.sunDir = sunDir.clone().normalize();
    this.halfL = opts.halfL ?? 56.5;
    this.halfW = opts.halfW ?? 37;
    this.maxDist = opts.maxDist ?? 140;
    this.step = opts.step ?? 6;
    this.dist = opts.dist ?? 220;
    this.texelBias = opts.texelBias ?? 0.9;
    // base do espaço da luz (mesma convenção do lookAt da câmera de sombra)
    _rot.lookAt(this.sunDir, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    this.toLight = _rot.clone().transpose(); // rotação pura: inversa = transposta
    this.fromLight = _rot.clone();
    this.enabled = true;
    this.lastW = 0;
  }

  update(camera) {
    if (!this.enabled || !this.light.castShadow) return;
    const L = this.light, sh = L.shadow, size = sh.mapSize.x;
    camera.updateMatrixWorld();
    _inv.copy(camera.projectionMatrixInverse);
    _o.setFromMatrixPosition(camera.matrixWorld);
    // pegada da visão no chão (y = 0), recortada no campo + margem
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [nx, ny] of NDC) {
      _d.set(nx, ny, 0.5).applyMatrix4(_inv).applyMatrix4(camera.matrixWorld).sub(_o).normalize();
      let t = _d.y < -1e-3 ? -_o.y / _d.y : this.maxDist;
      t = Math.min(t, this.maxDist);
      const px = THREE.MathUtils.clamp(_o.x + _d.x * t, -this.halfL, this.halfL);
      const pz = THREE.MathUtils.clamp(_o.z + _d.z * t, -this.halfW, this.halfW);
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
    }
    // a câmera dentro do campo baixa (cinema) também enxerga ao redor dela
    x0 = Math.min(x0, THREE.MathUtils.clamp(_o.x, -this.halfL, this.halfL) - 2); x1 = Math.max(x1, THREE.MathUtils.clamp(_o.x, -this.halfL, this.halfL) + 2);
    z0 = Math.min(z0, THREE.MathUtils.clamp(_o.z, -this.halfW, this.halfW) - 2); z1 = Math.max(z1, THREE.MathUtils.clamp(_o.z, -this.halfW, this.halfW) + 2);
    // caixa no espaço da luz (chão e altura dos jogadores/travessão)
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, 2.6]) {
      _v.set(x, y, z).applyMatrix4(this.toLight);
      if (_v.x < a0) a0 = _v.x; if (_v.x > a1) a1 = _v.x;
      if (_v.y < b0) b0 = _v.y; if (_v.y > b1) b1 = _v.y;
    }
    // quadrado com lado quantizado (texel igual nos dois eixos, muda pouco)
    const st = this.step;
    let w = Math.max(a1 - a0, b1 - b0) + 2;
    w = Math.ceil(w / st) * st;
    // histerese: não encolhe por pouco (evita alternar entre dois degraus)
    if (w < this.lastW && w > this.lastW - st * 1.5) w = this.lastW;
    this.lastW = w;
    const texel = w / size;
    let cx = (a0 + a1) / 2, cy = (b0 + b1) / 2;
    cx = Math.round(cx / texel) * texel;
    cy = Math.round(cy / texel) * texel;
    // centro de volta ao mundo; a luz fica sobre ele, na mesma direção de sempre
    _v.set(cx, cy, 0).applyMatrix4(this.fromLight);
    L.target.position.copy(_v);
    L.position.copy(_v).addScaledVector(this.sunDir, this.dist);
    L.target.updateMatrixWorld();
    L.updateMatrixWorld();
    const cam = sh.camera, h = w / 2;
    if (cam.right !== h || cam.near !== 1 || this.lastSize !== size) {
      this.lastSize = size;
      cam.left = -h; cam.right = h; cam.bottom = -h; cam.top = h;
      cam.near = 1; cam.far = this.dist + 160;
      cam.updateProjectionMatrix();
      sh.normalBias = Math.max(0.008, texel * this.texelBias);
    }
  }
}
