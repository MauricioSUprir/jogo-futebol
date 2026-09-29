// Câmera em terceira pessoa (braço com mola e colisão) e primeira pessoa (dentro do capacete).
import * as THREE from 'three';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class CameraRig {
  constructor(camera, physics, terrain, settings) {
    this.camera = camera; this.physics = physics; this.terrain = terrain; this.settings = settings;
    this.yaw = Math.PI;          // olhando para -z no início
    this.pitch = -0.18;
    this.dist = 4.2;
    this.targetDist = 4.2;
    this.firstPerson = !!settings.firstPerson;
    this._pos = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._shake = 0;
    this.camera.layers.enable(0);
  }

  toggle() { this.firstPerson = !this.firstPerson; return this.firstPerson; }
  zoom(delta) { this.targetDist = THREE.MathUtils.clamp(this.targetDist + delta, 1.6, 14); }
  kick(amount) { if (!this.settings.reduceShake) this._shake = Math.min(1, this._shake + amount); }

  update(dt, player, look) {
    const sens = this.settings.sensitivity;
    this.yaw -= look.x * 0.0026 * sens;
    this.pitch -= look.y * 0.0022 * sens * (this.settings.invertY ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.firstPerson ? -1.35 : -1.2, this.firstPerson ? 1.35 : 0.95);
    this.dist = damp(this.dist, this.targetDist, 8, dt);

    const cam = this.camera;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this._shake = damp(this._shake, 0, 5, dt);
    const sh = this._shake * 0.05;
    const jitter = new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);

    if (this.firstPerson) {
      const head = player.headPos;
      // olhos ~8 cm à frente do centro do capacete
      head.x += Math.sin(player.facing) * 0.06; head.z += Math.cos(player.facing) * 0.06;
      this._pos.copy(head).add(jitter);
      cam.position.copy(this._pos);
      cam.lookAt(this._pos.clone().add(fwd));
      cam.near = 0.08;
    } else {
      // alvo: sobre o ombro direito, na altura do capacete
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const tgt = this._target.copy(player.renderPos).add(new THREE.Vector3(0, 1.62, 0)).addScaledVector(right, cam.aspect < 1 ? 0.12 : 0.42);
      tgt.y += player.model.body.position.y * 0.5;
      const back = fwd.clone().multiplyScalar(-1);
      let d = this.dist;
      // colisão do braço da câmera com rochas e relevo
      const hit = this.physics.castRay({ x: tgt.x, y: tgt.y, z: tgt.z }, { x: back.x, y: back.y, z: back.z }, d + 0.3, player.collider);
      if (hit !== null) d = Math.max(0.6, hit - 0.3);
      const p = tgt.clone().addScaledVector(back, d);
      const gh = this.terrain.heightAt(p.x, p.z) + 0.35;
      if (p.y < gh) p.y = gh;
      this._pos.copy(p).add(jitter);
      cam.position.copy(this._pos);
      cam.lookAt(tgt);
      cam.near = 0.12;
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // em primeira pessoa o corpo fica na camada 1 (só sombras)
    if (this.firstPerson) cam.layers.disable(1); else cam.layers.enable(1);
  }

  // rumo (graus, 0 = norte) para a bússola
  get heading() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    // mundo: +x leste, -z norte
    return (Math.atan2(f.x, -f.z) * 180 / Math.PI + 360) % 360;
  }
}
