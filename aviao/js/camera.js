// Câmeras: cabine, perseguição, órbita livre e torre.
import * as THREE from 'three';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const MODES = ['cabine', 'perseguicao', 'orbita', 'torre'];
export const MODE_LABEL = { cabine: 'Cabine', perseguicao: 'Perseguição', orbita: 'Órbita livre', torre: 'Torre' };

export class CameraRig {
  constructor(camera, terrain, settings) {
    this.camera = camera; this.terrain = terrain; this.settings = settings;
    this.mode = 'perseguicao';
    this.lookYaw = 0; this.lookPitch = 0;       // olhar em volta (cabine) / órbita
    this.orbYaw = 0; this.orbPitch = 0.18; this.dist = 16;
    this._pos = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this.tower = new THREE.Vector3();
    this._shake = 0;
  }
  next() { this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]; this.lookYaw = this.lookPitch = 0; return this.mode; }
  zoom(dz) { this.dist = THREE.MathUtils.clamp(this.dist * Math.exp(dz * 0.12), 7, 120); }
  shake(a) { this._shake = Math.min(1, this._shake + a); }

  update(dt, ac, look, towerPos) {
    const cam = this.camera, s = this.settings.sensitivity;
    const q = ac.quat, p = ac.pos;
    this._shake = damp(this._shake, 0, 4, dt);
    const sh = this._shake * 0.06;
    if (this.mode === 'cabine') {
      this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - look.x * 0.004 * s, -2.6, 2.6);
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - look.y * 0.004 * s, -1.0, 1.1);
      if (!look.active) { this.lookYaw = damp(this.lookYaw, 0, 1.5, dt); this.lookPitch = damp(this.lookPitch, 0, 1.5, dt); }
      const eye = new THREE.Vector3(-0.28, 0.56, 0.12).applyQuaternion(q).add(p);
      cam.position.copy(eye).add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0));
      const look2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.lookPitch - 0.05, this.lookYaw, 0, 'YXZ'));
      cam.quaternion.copy(q).multiply(look2);
      cam.fov = 70; cam.near = 0.05;
    } else if (this.mode === 'perseguicao' || this.mode === 'orbita') {
      this.orbYaw -= look.x * 0.004 * s; this.orbPitch = THREE.MathUtils.clamp(this.orbPitch + look.y * 0.004 * s, -0.5, 1.3);
      let yaw;
      if (this.mode === 'perseguicao') {
        // segue o rumo do avião com atraso; volta para trás quando o jogador solta
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
        const hdg = Math.atan2(-fwd.x, -fwd.z);
        if (!look.active) { this.orbYaw = damp(this.orbYaw, 0, 1.2, dt); this.orbPitch = damp(this.orbPitch, 0.14, 1.2, dt); }
        this._hdg = this._hdg === undefined ? hdg : this._hdg + Math.atan2(Math.sin(hdg - this._hdg), Math.cos(hdg - this._hdg)) * (1 - Math.exp(-3 * dt));
        yaw = this._hdg + this.orbYaw;
      } else yaw = this.orbYaw;
      const d = this.dist;
      const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(this.orbPitch), Math.sin(this.orbPitch), Math.cos(yaw) * Math.cos(this.orbPitch)).multiplyScalar(d);
      const target = p.clone().add(new THREE.Vector3(0, 1.2, 0));
      const want = target.clone().add(off);
      const gh = this.terrain.heightAt(want.x, want.z) + 2;
      if (want.y < gh) want.y = gh;
      cam.position.copy(want).add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0));
      cam.up.set(0, 1, 0);
      cam.lookAt(target);
      cam.fov = 60; cam.near = 0.3;
    } else {
      cam.position.copy(towerPos);
      cam.up.set(0, 1, 0);
      cam.lookAt(p);
      const dist = towerPos.distanceTo(p);
      cam.fov = THREE.MathUtils.clamp(2 * Math.atan(30 / dist) * 180 / Math.PI, 3, 60);
      cam.near = 1;
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
}
