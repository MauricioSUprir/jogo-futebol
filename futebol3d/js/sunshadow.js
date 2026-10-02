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
const _rot = new THREE.Matrix4();

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
    this.lastW = 0; this.lastH = 0;
  }

  update(camera) {
    if (!this.enabled || !this.light.castShadow) return;
    const L = this.light, sh = L.shadow, size = sh.mapSize.x;
    camera.updateMatrixWorld();
    _o.setFromMatrixPosition(camera.matrixWorld);
    // pegada da visão no chão (y = 0): os 4 cantos da tela, raios acima do horizonte
    // limitados a maxDist; depois recorta no campo + margem (Sutherland–Hodgman)
    let poly = [];
    for (const [nx, ny] of CORNERS) {
      _d.set(nx, ny, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld).sub(_o).normalize();
      const t = Math.min(_d.y < -1e-3 ? -_o.y / _d.y : this.maxDist, this.maxDist);
      poly.push([_o.x + _d.x * t, _o.z + _d.z * t]);
    }
    poly = clipBox(poly, this.halfL, this.halfW);
    // câmera baixa dentro do campo (cinema): garante o entorno dela
    const cx0 = THREE.MathUtils.clamp(_o.x, -this.halfL, this.halfL), cz0 = THREE.MathUtils.clamp(_o.z, -this.halfW, this.halfW);
    poly.push([cx0 - 3, cz0 - 3], [cx0 + 3, cz0 + 3], [cx0 - 3, cz0 + 3], [cx0 + 3, cz0 - 3]);
    // retângulo no espaço da luz (chão e altura dos jogadores/travessão)
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of poly) for (const y of [0, 2.6]) {
      _v.set(x, y, z).applyMatrix4(this.toLight);
      if (_v.x < a0) a0 = _v.x; if (_v.x > a1) a1 = _v.x;
      if (_v.y < b0) b0 = _v.y; if (_v.y > b1) b1 = _v.y;
    }
    // lados quantizados em degraus + histerese (não alterna entre dois degraus)
    const st = this.step;
    const q = (w, last) => { w = Math.ceil((w + 2) / st) * st; return w < last && w > last - st * 1.5 ? last : w; };
    const wx = q(a1 - a0, this.lastW), wy = q(b1 - b0, this.lastH);
    this.lastW = wx; this.lastH = wy;
    const tx = wx / size, ty = wy / size;
    // centro encaixado no texel (cada eixo com o seu tamanho de texel)
    const cx = Math.round((a0 + a1) / 2 / tx) * tx, cy = Math.round((b0 + b1) / 2 / ty) * ty;
    _v.set(cx, cy, 0).applyMatrix4(this.fromLight);
    L.target.position.copy(_v);
    L.position.copy(_v).addScaledVector(this.sunDir, this.dist);
    L.target.updateMatrixWorld();
    L.updateMatrixWorld();
    const cam = sh.camera;
    if (cam.right !== wx / 2 || cam.top !== wy / 2 || this.lastSize !== size) {
      this.lastSize = size;
      cam.left = -wx / 2; cam.right = wx / 2; cam.bottom = -wy / 2; cam.top = wy / 2;
      cam.near = 1; cam.far = this.dist + 160;
      cam.updateProjectionMatrix();
      sh.normalBias = Math.max(0.008, Math.max(tx, ty) * this.texelBias);
    }
  }
}

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
// recorta um polígono convexo [x,z][] na caixa |x|<=hx, |z|<=hz
function clipBox(poly, hx, hz) {
  const planes = [[0, 1, hx], [0, -1, hx], [1, 1, hz], [1, -1, hz]]; // eixo, sinal, limite
  for (const [ax, sg, lim] of planes) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length];
      const da = lim - sg * A[ax], db = lim - sg * B[ax];
      if (da >= 0) out.push(A);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
    }
    poly = out;
    if (!poly.length) break;
  }
  return poly;
}

// Sol do dia "de transmissão": vindo da lateral (oeste), um pouco por trás da
// arquibancada oposta à câmera de TV. Com o sol atrás da câmera (direção antiga) a
// sombra de cada jogador caía exatamente atrás dele e ficava escondida pelo próprio
// corpo; de lado, ela aparece em diagonal no gramado e dá volume (como nas
// transmissões de jogo à tarde). Atualiza no lugar: direção (o mesmo Vector3 é o
// uniforme uSunDir da torcida/cobertura), luz e o sol do céu. Chamar uma vez por partida.
export function aimDaySun(stadium, scene, az = [-0.9, 0.14], elDeg = 50) {
  const e = elDeg * Math.PI / 180, n = Math.hypot(az[0], az[1]);
  const d = stadium.sunDir;
  d.set(az[0] / n * Math.cos(e), Math.sin(e), az[1] / n * Math.cos(e)).normalize();
  stadium.mainLight.position.copy(d).multiplyScalar(250);
  const sky = scene.getObjectByName('ceu');
  const u = sky && sky.material && sky.material.uniforms;
  if (u && u.sunPosition) u.sunPosition.value.copy(d);
  return d;
}
