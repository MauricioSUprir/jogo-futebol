// Câmeras: TV (lateral, estilo transmissão), Pro (atrás do jogador), Aérea,
// e câmeras de cinema para replay, comemoração e pênalti. Suavização
// criticamente amortecida para não tremer, com tremor leve em chutes fortes.
import * as THREE from 'three';
import { PITCH, clamp, lerp } from './config.js';

const HL = PITCH.halfL, HW = PITCH.halfW;

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
      if (c.type === 'manual') {
        // roteiro externo (abertura): posição/alvo/fov dados a cada quadro
        px = c.pos.x; py = c.pos.y; pz = c.pos.z; lx = c.look.x; ly = c.look.y; lz = c.look.z; fov = c.fov || 40; lam = c.lam || 4;
      } else if (c.type === 'orbit') {
        const a = c.a0 + c.t * 0.25;
        px = T.x + Math.cos(a) * 7; pz = T.z + Math.sin(a) * 7; py = 1.9;
        lx = T.x; ly = 1.2; lz = T.z; fov = 38; lam = 6;
      } else if (c.type === 'goal') {
        // atrás do gol, alto
        px = c.sign * (HL + 5.2); py = 4.2; pz = T.z * 0.3 - 2;
        lx = T.x - c.sign * 4; ly = 0.9; lz = T.z; fov = 50; lam = 5;
      } else if (c.type === 'low') {
        px = c.sign * (HL - 3); py = 0.6; pz = c.side * 12;
        lx = T.x; ly = Math.max(0.6, T.y); lz = T.z; fov = 34; lam = 8;
      } else if (c.type === 'penalty') {
        px = T.x - c.sign * 9; py = 2.4; pz = T.z + 0.8;
        lx = c.sign * HL; ly = 1.1; lz = 0; fov = 40; lam = 6;
      } else if (c.type === 'celebrate') {
        // câmera de mão na comemoração: teleobjetiva baixa, à frente e para dentro do campo,
        // vendo o autor de 3/4 com a torcida atrás; acompanha a corrida e abre quando o abraço fecha
        const f = c.follow, cx = -T.x, cz = -T.z, cl = Math.hypot(cx, cz) || 1;
        let vx = f ? f.vx : 0, vz = f ? f.vz : 0; const vl = Math.hypot(vx, vz);
        if (vl > 1) { c.vx = vx / vl; c.vz = vz / vl; }
        vx = c.vx || 0; vz = c.vz || 0;
        let dx = cx / cl + 0.9 * vx, dz = cz / cl + 0.9 * vz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        const side = Math.sin(c.t * 0.3) * 1.2;
        const dist = 6.2 + Math.min(c.t, 6) * 0.3;
        px = T.x + dx * dist - dz * side; pz = T.z + dz * dist + dx * side; py = 1.4 + 0.06 * Math.sin(c.t * 1.7);
        // ninguém na frente da lente: empurra a câmera para longe de quem estiver perto
        for (const q of m.players) {
          const ex = px - q.x, ez = pz - q.z, e = Math.hypot(ex, ez);
          if (e < 1.8 && e > 1e-3) { px += ex / e * (1.8 - e); pz += ez / e * (1.8 - e); py += (1.8 - e) * 0.6; }
        }
        // não sai do gramado (atrás das placas e bandeirinhas a lente bateria em objetos)
        px = clamp(px, -HL + 0.8, HL - 0.8); pz = clamp(pz, -HW + 0.8, HW - 0.8);
        // tremor de câmera na mão (somas de senos: suave e sem padrão óbvio)
        const sh = 0.03;
        lx = T.x + sh * (Math.sin(c.t * 7.1) + 0.6 * Math.sin(c.t * 12.7));
        ly = 1.15 + sh * (Math.sin(c.t * 8.3 + 1) + 0.5 * Math.sin(c.t * 14.1));
        lz = T.z + sh * Math.sin(c.t * 6.4 + 2);
        fov = 30 + Math.min(c.t, 6) * 1.5; lam = 3.5;
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
      // TV dinâmica: lateral, acompanha a bola de perto (mais perto no celular)
      const mobile = this.aspect > 1.2 && innerHeight < 560;
      // câmera adaptativa (§26): abre no contra-ataque (bola rápida no comprimento),
      // antecipa o lançamento (olha para onde a bola vai cair) e aproxima perto da área
      const bv = ctx.ballVel || { x: 0, z: 0 };
      const fast = clamp((Math.abs(bv.x) - 6) / 10, 0, 1);
      this.open = damp(this.open || 0, fast, fast > (this.open || 0) ? 2.5 : 0.8, dt);
      const nearBox = clamp((Math.abs(b.x) - (HL - 24)) / 10, 0, 1) * (1 - this.open);
      this.boxK = damp(this.boxK || 0, nearBox, 1.2, dt);
      let ax = b.x, az = b.z;
      if (ctx.land) { const w = clamp(ctx.land.t / 1.5, 0, 0.65); ax = lerp(b.x, ctx.land.x, w); az = lerp(b.z, ctx.land.z, w * 0.6); }
      const tx = clamp(ax + (ctx.lead || 0) * 5 + bv.x * 0.35 * this.open, -HL + 10, HL - 10);
      const tz = clamp(az * 0.8, -26, 26);
      const zoomIn = ctx.zoom ?? 0;
      const dist = (mobile ? 30 : 36) - zoomIn * 4 + clamp((-tz - 5) / 20, 0, 1) * 4 + this.open * 5 - this.boxK * 3;
      const h = (mobile ? 13.5 : 15.5) - zoomIn * 1.5 + this.open * 1.5;
      px = tx * 0.94; py = h; pz = Math.max(tz - dist, -50);   // não entra na arquibancada
      lx = tx; ly = 0.4; lz = tz + 2;
      fov = (portrait ? 55 : mobile ? 33 : 30) - zoomIn * 2 + this.open * 5 - this.boxK * 2;
      lam = 2.6;
    }
    const k = this.cine ? lam : lam;
    this.pos.x = damp(this.pos.x, px, k, dt); this.pos.y = damp(this.pos.y, py, k, dt); this.pos.z = damp(this.pos.z, pz, k, dt);
    this.look.x = damp(this.look.x, lx, k * 1.2, dt); this.look.y = damp(this.look.y, ly, k * 1.2, dt); this.look.z = damp(this.look.z, lz, k * 1.2, dt);
    this.fov = damp(this.fov, fov, 2.5, dt);
    if (this.snap) { this.pos.set(px, py, pz); this.look.set(lx, ly, lz); this.fov = fov; this.snap = false; }
    cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.shake *= Math.exp(-6 * dt);
      // ruído suave e dependente do TEMPO (não do FPS): soma de senos incomensuráveis —
      // parece um impacto que balança, não uma falha de imagem
      const t = this.t;
      cam.position.x += (Math.sin(t * 17.3 + 1.3) * 0.6 + Math.sin(t * 23.9 + 4.1) * 0.4) * this.shake * 0.5;
      cam.position.y += (Math.sin(t * 14.1 + 2.2) * 0.6 + Math.sin(t * 21.7 + 0.7) * 0.4) * this.shake * 0.5;
    }
    cam.lookAt(this.look);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    // base para o analógico: direita e frente da câmera no chão
    const fx = this.look.x - this.pos.x, fz = this.look.z - this.pos.z;
    const fl = Math.hypot(fx, fz) || 1;
    this.fwd.set(fx / fl, 0, fz / fl);
    this.right.set(-this.fwd.z, 0, this.fwd.x);
  }
}
