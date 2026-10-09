// Linha de impedimento no gramado (como na transmissão): quando o impedimento é marcado,
// aparece a linha do penúltimo defensor no instante do passe (verde, atravessando o campo) e
// uma faixa curta vermelha onde o atacante estava. Some sozinha em ~3,5 s. 2 draw calls,
// criados uma vez.
import * as THREE from 'three';
import { PITCH } from './config.js';

export class OffsideLine {
  constructor(scene) {
    const mk = (w, len, color) => {
      const g = new THREE.PlaneGeometry(w, len);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false });
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = 3; mesh.visible = false; mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    };
    this.line = mk(0.16, PITCH.halfW * 2, 0x1ee37a);
    this.mark = mk(0.16, 5, 0xff3b3b);
    this.t = 0; this.dur = 3.6;
  }
  show(lineX, x, z) {
    this.line.position.set(lineX, 0.03, 0);
    this.mark.position.set(x, 0.035, z);
    this.t = this.dur;
    this.line.visible = this.mark.visible = true;
  }
  update(dt) {
    if (this.t <= 0) return;
    this.t -= dt;
    // entra rápido, fica, e sai suave
    const a = Math.min(1, (this.dur - this.t) / 0.25) * Math.min(1, Math.max(0, this.t) / 0.6);
    this.line.material.opacity = 0.85 * a; this.mark.material.opacity = 0.9 * a;
    if (this.t <= 0) this.line.visible = this.mark.visible = false;
  }
  dispose() {
    for (const o of [this.line, this.mark]) { o.parent?.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }
}
