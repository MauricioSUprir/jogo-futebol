// Câmeras: TV (lateral, estilo transmissão), Pro (atrás do jogador), Aérea,
// e câmeras de cinema para replay, comemoração e pênalti. Suavização
// criticamente amortecida para não tremer, com tremor leve em chutes fortes.
import * as THREE from 'three';
import { PITCH, clamp, lerp } from './config.js';

const HL = PITCH.halfL;

function damp(cur, target, lambda, dt) { return lerp(cur, target, 1 - Math.exp(-lambda * dt)); }

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'tv';
    this.look = new THREE.Vector3(0, 0, 0);
    this.pos = new THREE.Vector3(0, 20, -60);
    this.fov = 30;
    this.shake = 0;
    this.t = 0;
    this.cine = null;
    this.right = new THREE.Vector3(-1, 0, 0);
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.aspect = 16 / 9;
  }

  setMode(m) { this.mode = m; }
  kick(strength) { this.shake = Math.max(this.shake, strength * 0.25); }

  // Câmera de cinema: { type: 'orbit'|'goal'|'low'|'penalty', target: Vector3, sign }
  setCinematic(c) { this.cine = c; if (c) c.t = 0; }

  update(dt, m, ctx) {
    this.t += dt;
    const cam = this.cam;
    const b = ctx.ball;
    const portrait = this.aspect < 1.2;
    let px, py, pz, lx, ly, lz, fov, lam = 3.2;
    if (this.cine) {
      const c = this.cine; c.t += dt;
      const T = c.target;
      if (c.type === 'orbit') {
        const a = c.a0 + c.t * 0.25;
        px = T.x + Math.cos(a) * 7; pz = T.z + Math.sin(a) * 7; py = 1.9;
        lx = T.x; ly = 1.2; lz = T.z; fov = 38; lam = 6;
      } else if (c.type === 'goal') {
        // atrás do gol, alto
        px = c.sign * (HL + 14); py = 6.5; pz = T.z * 0.3 - 3;
        lx = T.x - c.sign * 4; ly = 0.8; lz = T.z; fov = 42; lam = 5;
      } else if (c.type === 'low') {
        px = c.sign * (HL - 3); py = 0.6; pz = c.side * 12;
        lx = T.x; ly = Math.max(0.6, T.y); lz = T.z; fov = 34; lam = 8;
      } else if (c.type === 'penalty') {
        px = T.x - c.sign * 9; py = 2.4; pz = T.z + 0.8;
        lx = c.sign * HL; ly = 1.1; lz = 0; fov = 40; lam = 6;
      } else if (c.type === 'celebrate') {
        const a = c.a0 + c.t * 0.18;
        px = T.x + Math.cos(a) * 6; pz = T.z + Math.sin(a) * 6; py = 2.2;
        lx = T.x; ly = 1.3; lz = T.z; fov = 40; lam = 3;
      }
    } else if (this.mode === 'pro' && ctx.player) {
      const p = ctx.player, dir = ctx.attackDir;
      const tx = p.x * 0.7 + b.x * 0.3, tz = p.z * 0.7 + b.z * 0.3;
      px = tx - dir * 10; py = 5.2; pz = tz * 0.9;
      lx = tx + dir * 7; ly = 0.8; lz = tz;
      fov = portrait ? 62 : 50; lam = 3.5;
    } else if (this.mode === 'aerea') {
      const tx = clamp(b.x, -HL + 18, HL - 18);
      px = tx * 0.8; py = 52; pz = -48;
      lx = tx; ly = 0; lz = b.z * 0.4;
      fov = portrait ? 58 : 36;
    } else {
      // TV: lateral, alta, teleobjetiva; acompanha a bola com folga
      const tx = clamp(b.x + (ctx.lead || 0) * 4, -HL + 12, HL - 12);
      const zoomIn = ctx.zoom ?? 0;
      px = tx * 0.9; py = 17.5 - zoomIn * 2; pz = -56 + zoomIn * 5;
      lx = tx; ly = 0; lz = clamp(b.z * 0.7 + 1, -20, 22);
      fov = (portrait ? 40 : 21) - zoomIn * 2;
      // mais perto da lateral de baixo, abre um pouco
      fov += clamp((-b.z - 10) / 24, 0, 1) * 4;
    }
    const k = this.cine ? lam : lam;
    this.pos.x = damp(this.pos.x, px, k, dt); this.pos.y = damp(this.pos.y, py, k, dt); this.pos.z = damp(this.pos.z, pz, k, dt);
    this.look.x = damp(this.look.x, lx, k * 1.2, dt); this.look.y = damp(this.look.y, ly, k * 1.2, dt); this.look.z = damp(this.look.z, lz, k * 1.2, dt);
    this.fov = damp(this.fov, fov, 2.5, dt);
    if (this.snap) { this.pos.set(px, py, pz); this.look.set(lx, ly, lz); this.fov = fov; this.snap = false; }
    cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.shake *= Math.exp(-6 * dt);
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
    }
    cam.lookAt(this.look);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    // base para o analógico: direita e frente da câmera no chão
    const fx = this.look.x - this.pos.x, fz = this.look.z - this.pos.z;
    const fl = Math.hypot(fx, fz) || 1;
    this.fwd.set(fx / fl, 0, fz / fl);
    this.right.set(-this.fwd.z, 0, this.fwd.x);
  }
}
