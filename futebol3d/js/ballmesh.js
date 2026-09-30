// Bola 3D (textura procedural de gomos gerada em código, rotação real pela
// física), sombra de contato e indicadores de mira das bolas paradas.
import * as THREE from 'three';
import { BALL, PITCH, GOAL } from './config.js';

// Textura equirretangular: 12 pentágonos (vértices do icosaedro) + 20 hexágonos,
// costuras entre gomos e um desenho próprio (faixas limão/azul).
function ballTexture(size = 1024) {
  const W = size, H = size / 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const t = (1 + Math.sqrt(5)) / 2;
  const ico = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map(v => { const l = Math.hypot(...v); return v.map(c => c / l); });
  // centros das faces (hexágonos) = média de trincas de vértices vizinhos
  const faces = [];
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) {
    const d = (i, j) => Math.hypot(ico[i][0] - ico[j][0], ico[i][1] - ico[j][1], ico[i][2] - ico[j][2]);
    if (d(a, b) < 1.1 && d(a, c) < 1.1 && d(b, c) < 1.1) {
      const v = [0, 1, 2].map(k => ico[a][k] + ico[b][k] + ico[c][k]); const l = Math.hypot(...v);
      faces.push(v.map(x => x / l));
    }
  }
  const centers = ico.map(v => ({ v, pent: true })).concat(faces.map(v => ({ v, pent: false })));
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2 - Math.PI;
      const p = [cl * Math.cos(lon), sl, cl * Math.sin(lon)];
      // dois centros mais próximos (Voronoi esférico → gomos e costuras)
      let b1 = -2, b2 = -2, i1 = 0;
      for (let i = 0; i < centers.length; i++) {
        const c = centers[i].v;
        const d = p[0] * c[0] + p[1] * c[1] + p[2] * c[2];
        if (d > b1) { b2 = b1; b1 = d; i1 = i; } else if (d > b2) b2 = d;
      }
      const seam = (b1 - b2) * 60;
      const c = centers[i1];
      let r = 244, g = 244, bl = 240;
      if (c.pent) {
        // pentágono: miolo azul-marinho com borda limão
        const core = b1 > 0.975;
        if (core) { r = 18; g = 28; bl = 60; } else { r = 30; g = 200; bl = 110; }
      } else {
        // leve faixa decorativa em alguns hexágonos
        const band = Math.sin((p[0] * 3 + p[2] * 2) * 3) > 0.92;
        if (band) { r = 30; g = 40; bl = 80; }
      }
      const s = Math.min(1, seam);
      const k = 0.55 + 0.45 * s;
      const o = (y * W + x) * 4;
      img.data[o] = r * k; img.data[o + 1] = g * k; img.data[o + 2] = bl * k; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function blobTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export class BallMesh {
  constructor(scene, quality) {
    const geo = new THREE.SphereGeometry(BALL.radius, 40, 24);
    const mat = new THREE.MeshStandardMaterial({ map: ballTexture(quality.grassDetail >= 1 ? 1024 : 512), roughness: 0.38, metalness: 0 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = quality.shadows;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 2;
    scene.add(this.blob);
    this.q = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
    this._dq = new THREE.Quaternion();

    // seta de mira no gramado (bolas paradas)
    const shape = new THREE.Shape();
    shape.moveTo(0.5, -0.06); shape.lineTo(3.6, -0.05); shape.lineTo(3.6, -0.22); shape.lineTo(4.3, 0); shape.lineTo(3.6, 0.22); shape.lineTo(3.6, 0.05); shape.lineTo(0.5, 0.06);
    const ag = new THREE.ShapeGeometry(shape); ag.rotateX(-Math.PI / 2);
    this.arrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0x1ee37a, transparent: true, opacity: 0.6, depthWrite: false }));
    this.arrow.renderOrder = 3; this.arrow.visible = false;
    scene.add(this.arrow);
    // alvo no gol (cobrança direta)
    const rg = new THREE.RingGeometry(0.22, 0.32, 32);
    this.reticle = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x1ee37a, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
    this.reticle.renderOrder = 10; this.reticle.visible = false;
    scene.add(this.reticle);
  }

  // Integra a rotação a partir do vetor ω da física.
  spin(w, dt) {
    const s = Math.hypot(w.x, w.y, w.z);
    if (s < 1e-3) return;
    this._axis.set(w.x / s, w.y / s, w.z / s);
    this._dq.setFromAxisAngle(this._axis, s * dt);
    this.q.premultiply(this._dq);
    this.q.normalize();
  }

  set(x, y, z, q) {
    this.mesh.position.set(x, y, z);
    this.mesh.quaternion.copy(q || this.q);
    const h = Math.max(0, y - BALL.radius);
    const s = 0.34 + h * 0.2;
    this.blob.position.set(x, 0.012, z);
    this.blob.scale.set(s, s, 1);
    this.blob.material.opacity = Math.max(0, 1 - h / 3);
  }

  aim(m, sp, userTaking) {
    const show = sp && userTaking && !sp.taken;
    this.arrow.visible = !!show && sp.type !== 'kickoff' && !(sp.type === 'penalty' || (sp.type === 'freekick' && Math.hypot(m.goalX(sp.team) - sp.x, sp.z) < 35));
    this.reticle.visible = !!show && sp.type !== 'kickoff' && !this.arrow.visible;
    if (!show) return;
    const b = m.ball.p;
    if (this.arrow.visible) {
      this.arrow.position.set(b.x, 0.03, b.z);
      this.arrow.rotation.y = -sp.aim;
      this.arrow.material.opacity = 0.45 + 0.2 * Math.sin(performance.now() / 180);
    } else {
      const st = sp.aimStick || { mx: 0, mz: 0 };
      const mag = Math.hypot(st.mx, st.mz);
      const gx = m.goalX(sp.team);
      let z = 0;
      if (mag > 0.25) { const lat = st.mz / mag; z = Math.abs(lat) < 0.35 ? 0 : Math.max(-1, Math.min(1, lat * 1.15)) * (GOAL.halfWidth - 0.4); }
      this.reticle.position.set(gx - Math.sign(gx) * 0.05, 1.0, z);
      this.reticle.rotation.y = Math.PI / 2;
    }
  }
}
