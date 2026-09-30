// Física da bola: gravidade, arrasto quadrático, efeito Magnus (curva, topspin,
// backspin), quique com atrito que troca velocidade por rotação, rolagem com
// resistência da grama, traves/travessão (cápsulas), rede e placas.
// Não depende de three.js: roda também na simulação sem gráficos dos testes.
import { BALL, GOAL, PITCH } from './config.js';

const R = BALL.radius;
const DRAG_K = 0.5 * BALL.airDensity * BALL.dragCoef * Math.PI * R * R / BALL.mass;
const INERTIA_K = 2 / 3;            // casca esférica: I = 2/3 m r²
const BACK_X = PITCH.halfL + GOAL.depth;
const BOARD_X = PITCH.halfL + PITCH.runoffX - 0.25;
const BOARD_Z = PITCH.halfW + PITCH.runoffZ - 0.25;
const BOARD_H = 0.9;

// Traves e travessões como segmentos (cápsulas). Centro da trave sobre a linha.
const PZ = GOAL.halfWidth + GOAL.postRadius;
const BY = GOAL.height + GOAL.postRadius;
export const GOAL_FRAME = [];
for (const s of [-1, 1]) {
  const x = s * PITCH.halfL;
  GOAL_FRAME.push({ s, a: [x, 0, -PZ], b: [x, BY, -PZ] });
  GOAL_FRAME.push({ s, a: [x, 0, PZ], b: [x, BY, PZ] });
  GOAL_FRAME.push({ s, a: [x, BY, -PZ], b: [x, BY, PZ] });
}

// fundo da rede na altura y (a rede desce inclinada do alto para o chão)
const backAt = (y) => PITCH.halfL + GOAL.depth + (GOAL.topDepth - GOAL.depth) * Math.min(1, Math.max(0, y / GOAL.height));

function insideGoal(x, y, z) {
  const ax = Math.abs(x);
  return ax > PITCH.halfL && ax < backAt(y) && Math.abs(z) < GOAL.halfWidth && y < GOAL.height;
}

export class Ball {
  constructor() {
    this.p = { x: 0, y: R, z: 0 };
    this.v = { x: 0, y: 0, z: 0 };
    this.w = { x: 0, y: 0, z: 0 };   // rotação (rad/s)
    this.rolling = true;
    this.held = false;                // nas mãos do goleiro / cobrador de lateral
    this.events = null;               // array opcional para eventos de colisão
    this.wind = { x: 0, z: 0 };
    this.inNet = false;
  }

  place(x, y, z) {
    this.p.x = x; this.p.y = y; this.p.z = z;
    this.v.x = this.v.y = this.v.z = 0;
    this.w.x = this.w.y = this.w.z = 0;
    this.rolling = y <= R + 1e-3;
    this.inNet = false;
  }

  copyFrom(b) {
    Object.assign(this.p, b.p); Object.assign(this.v, b.v); Object.assign(this.w, b.w);
    this.rolling = b.rolling; this.held = b.held; this.inNet = b.inNet;
    this.wind = b.wind;
  }

  speed() { return Math.hypot(this.v.x, this.v.y, this.v.z); }
  hspeed() { return Math.hypot(this.v.x, this.v.z); }

  emit(type, strength, extra) {
    if (this.events) this.events.push({ type, strength, x: this.p.x, y: this.p.y, z: this.p.z, ...extra });
  }

  step(dt) {
    if (this.held) return;
    const p = this.p, v = this.v, w = this.w;
    const px = p.x, py = p.y, pz = p.z;

    // ar relativo (vento)
    const rx = v.x - this.wind.x, ry = v.y, rz = v.z - this.wind.z;
    const rs = Math.hypot(rx, ry, rz);
    let ax = -DRAG_K * rs * rx, ay = -DRAG_K * rs * ry - BALL.gravity, az = -DRAG_K * rs * rz;

    if (!this.rolling) {
      // Magnus: a = k (ω × v)
      const mk = BALL.magnusCoef;
      ax += mk * (w.y * rz - w.z * ry);
      ay += mk * (w.z * rx - w.x * rz);
      az += mk * (w.x * ry - w.y * rx);
      const decay = Math.exp(-BALL.spinDecayAir * dt);
      w.x *= decay; w.y *= decay; w.z *= decay;
    } else {
      // rolando: sem gravidade líquida; resistência da grama
      ay = 0; v.y = 0;
      const hs = Math.hypot(v.x, v.z);
      if (hs > 1e-4) {
        const dec = BALL.rollResistance + BALL.grassDrag * hs;
        const f = Math.max(0, hs - dec * dt) / hs;
        v.x *= f; v.z *= f;
        // efeito lateral residual faz a bola "fechar" levemente rolando
        const curl = w.y * 0.0009;
        const nx = v.x + curl * v.z * dt * 60, nz = v.z - curl * v.x * dt * 60;
        v.x = nx; v.z = nz;
      } else { v.x = 0; v.z = 0; }
      w.y *= Math.exp(-2.5 * dt);
      // rotação coerente com rolar sem deslizar: ω = (vz/r, ωy, -vx/r)
      w.x = v.z / R; w.z = -v.x / R;
    }

    v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;

    // chão
    if (p.y <= R) {
      p.y = R;
      if (!this.rolling) {
        const vin = -v.y;
        if (vin > 0.55) {
          const e = BALL.restitution * (vin > 12 ? 0.9 : 1);
          v.y = vin * e;
          this.frictionImpulse(vin * (1 + e));
          if (vin > 1.2) this.emit('bounce', Math.min(1, vin / 14));
        } else {
          v.y = 0;
          this.rolling = true;
        }
      }
    } else if (this.rolling && p.y > R + 0.01) {
      this.rolling = false;
    }

    this.collideFrame();
    this.collideNet(px, py, pz);
    this.collideBoards();
  }

  // Impulso de atrito no contato com o chão (troca deslize por rotação).
  frictionImpulse(jn) {
    const v = this.v, w = this.w;
    const ux = v.x + R * w.z, uz = v.z - R * w.x;
    const us = Math.hypot(ux, uz);
    if (us < 1e-5) return;
    const jStop = 0.4 * us;                      // por unidade de massa
    const j = Math.min(jStop, BALL.groundFriction * jn);
    const jx = -j * ux / us, jz = -j * uz / us;
    v.x += jx; v.z += jz;
    const inv = 1 / (INERTIA_K * R);             // Δω = (r × J)/I com r = (0,-R,0)
    w.x += -jz * inv; w.z += jx * inv;
    w.y *= 0.85;
  }

  collideFrame() {
    const p = this.p, v = this.v;
    if (Math.abs(p.x) < PITCH.halfL - 1 || Math.abs(p.z) > PZ + 1 || p.y > BY + 1) return;
    const rr = R + GOAL.postRadius;
    for (const seg of GOAL_FRAME) {
      const [ax, ay, az] = seg.a, [bx, by, bz] = seg.b;
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      let t = ((p.x - ax) * dx + (p.y - ay) * dy + (p.z - az) * dz) / (dx * dx + dy * dy + dz * dz);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t, cy = ay + dy * t, cz = az + dz * t;
      let nx = p.x - cx, ny = p.y - cy, nz = p.z - cz;
      const d = Math.hypot(nx, ny, nz);
      if (d >= rr || d < 1e-6) continue;
      nx /= d; ny /= d; nz /= d;
      p.x = cx + nx * rr; p.y = cy + ny * rr; p.z = cz + nz * rr;
      const vn = v.x * nx + v.y * ny + v.z * nz;
      if (vn < 0) {
        const e = BALL.postRestitution;
        v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny; v.z -= (1 + e) * vn * nz;
        v.x *= 0.92; v.y *= 0.92; v.z *= 0.92;
        this.w.x *= 0.5; this.w.y *= -0.4; this.w.z *= 0.5;
        this.rolling = false;
        this.emit(dy > 0.5 ? 'post' : 'bar', Math.min(1, -vn / 25), { goalSign: seg.s });
      }
    }
  }

  // Rede: a bola que entra no gol é amortecida; de fora, a rede lateral/superior segura.
  collideNet(px, py, pz) {
    const p = this.p, v = this.v;
    const ax = Math.abs(p.x);
    if (ax < PITCH.halfL - 0.5 || ax > BACK_X + 1 || Math.abs(p.z) > GOAL.halfWidth + 1.2 || p.y > GOAL.height + 1) return;
    const s = Math.sign(p.x);
    const wasIn = insideGoal(px, py, pz);
    const isIn = insideGoal(p.x, p.y, p.z);
    if (wasIn) {
      let hit = false;
      const back = backAt(p.y) - R;
      if (ax > back) { p.x = s * back; v.x = -v.x * 0.15; hit = true; }
      if (Math.abs(p.z) > GOAL.halfWidth - R) { p.z = Math.sign(p.z) * (GOAL.halfWidth - R); v.z = -v.z * 0.15; hit = true; }
      if (p.y > GOAL.height - R) { p.y = GOAL.height - R; v.y = -Math.abs(v.y) * 0.1; hit = true; }
      if (hit) {
        const sp = Math.hypot(v.x, v.y, v.z);
        v.x *= BALL.netDamping * 3; v.y *= 0.5; v.z *= BALL.netDamping * 3;
        this.w.x *= 0.2; this.w.y *= 0.2; this.w.z *= 0.2;
        if (!this.inNet || sp > 2) this.emit('net', Math.min(1, sp / 8), { goalSign: s });
        this.inNet = true;
      }
    } else if (isIn) {
      // entrou no volume sem passar pela boca do gol → bateu na rede por fora
      const crossedMouth = Math.abs(px) <= PITCH.halfL + 0.02;
      if (!crossedMouth) {
        p.x = px; p.y = py; p.z = pz;
        const sp = Math.hypot(v.x, v.y, v.z);
        if (Math.abs(pz) >= GOAL.halfWidth) v.z = -v.z * 0.12; else v.y = -v.y * 0.12;
        v.x *= 0.3; v.y *= 0.5; v.z *= 0.3;
        if (sp > 2) this.emit('sidenet', Math.min(1, sp / 12), { goalSign: s });
      }
    }
  }

  collideBoards() {
    const p = this.p, v = this.v;
    // arquibancada: a bola que passa por cima das placas bate no degrau e cai
    const SX = BOARD_X + 3, SZ = BOARD_Z + 3;
    if (Math.abs(p.x) > SX) { p.x = Math.sign(p.x) * SX; v.x = -v.x * 0.2; v.z *= 0.4; }
    if (Math.abs(p.z) > SZ) { p.z = Math.sign(p.z) * SZ; v.z = -v.z * 0.2; v.x *= 0.4; }
    if (p.y > BOARD_H) return;
    if (Math.abs(p.x) > BOARD_X) { p.x = Math.sign(p.x) * BOARD_X; if (v.x * p.x > 0) { v.x = -v.x * 0.35; this.emit('board', Math.min(1, Math.abs(v.x) / 8)); } }
    if (Math.abs(p.z) > BOARD_Z) { p.z = Math.sign(p.z) * BOARD_Z; if (v.z * p.z > 0) { v.z = -v.z * 0.35; this.emit('board', Math.min(1, Math.abs(v.z) / 8)); } }
  }

  // Bola "presa" (nas mãos): segue um ponto sem física.
  hold(x, y, z) {
    this.held = true;
    this.p.x = x; this.p.y = y; this.p.z = z;
    this.v.x = this.v.y = this.v.z = 0;
    this.w.x = this.w.y = this.w.z = 0;
    this.rolling = false;
  }

  release() { this.held = false; }

  // Chuta: velocidade inicial e rotação em coordenadas do mundo.
  kick(vx, vy, vz, wx = 0, wy = 0, wz = 0) {
    this.held = false;
    this.v.x = vx; this.v.y = vy; this.v.z = vz;
    this.w.x = wx; this.w.y = wy; this.w.z = wz;
    this.rolling = vy <= 0.05 && this.p.y <= R + 0.02;
    if (this.rolling) { this.v.y = 0; this.w.x = vz / R; this.w.z = -vx / R; }
    if (this.p.y < R) this.p.y = R;
  }
}

// ---------------------------------------------------------------------------
// Previsão de trajetória (usada pela IA, goleiro e interceptações).
const _sim = new Ball();

export class BallPredictor {
  constructor(seconds = 3, hz = 30) {
    this.n = Math.round(seconds * hz);
    this.dt = 1 / hz;
    this.pos = new Float32Array(this.n * 3);
    this.vel = new Float32Array(this.n * 3);
  }
  // amostra k está no tempo (k+1)·dt
  run(ball) {
    _sim.copyFrom(ball); _sim.events = null; _sim.held = false;
    const sub = 4, h = this.dt / sub;
    for (let k = 0; k < this.n; k++) {
      for (let i = 0; i < sub; i++) _sim.step(h);
      this.pos[k * 3] = _sim.p.x; this.pos[k * 3 + 1] = _sim.p.y; this.pos[k * 3 + 2] = _sim.p.z;
      this.vel[k * 3] = _sim.v.x; this.vel[k * 3 + 1] = _sim.v.y; this.vel[k * 3 + 2] = _sim.v.z;
    }
  }
  x(k) { return this.pos[k * 3]; }
  y(k) { return this.pos[k * 3 + 1]; }
  z(k) { return this.pos[k * 3 + 2]; }
  t(k) { return (k + 1) * this.dt; }
}

// Simula um chute e devolve onde a bola passa pela distância horizontal D
// (medida ao longo de dirx,dirz a partir da origem).
function shoot(o, vx, vy, vz, wx, wy, wz, dirx, dirz, D, wind, maxT = 4) {
  _sim.place(o.x, Math.max(R, o.y), o.z);
  _sim.events = null; _sim.wind = wind || { x: 0, z: 0 };
  _sim.kick(vx, vy, vz, wx, wy, wz);
  const h = 1 / 120;
  let prevD = 0, prevY = _sim.p.y, prevLat = 0, t = 0;
  while (t < maxT) {
    _sim.step(h); t += h;
    const rx = _sim.p.x - o.x, rz = _sim.p.z - o.z;
    const d = rx * dirx + rz * dirz;
    const lat = -rx * dirz + rz * dirx;
    if (d >= D) {
      const f = (D - prevD) / Math.max(1e-6, d - prevD);
      return { y: prevY + (_sim.p.y - prevY) * f, lat: prevLat + (lat - prevLat) * f, t: t - h * (1 - f), reached: true, speed: _sim.speed() };
    }
    if (_sim.hspeed() < 0.3 && _sim.rolling) break;
    prevD = d; prevY = _sim.p.y; prevLat = lat;
  }
  return { y: _sim.p.y, lat: prevLat, t, reached: false, d: prevD, speed: _sim.speed() };
}

// Resolve direção (yaw) e elevação para a bola, saindo de `o` com velocidade
// `speed` e efeito `spin` = {side, top} (rad/s; side>0 curva p/ a esquerda de quem
// chuta, top>0 = topspin), passar pelo ponto `tg` (x,y,z).
export function solveAim(o, tg, speed, spin, wind) {
  let dx = tg.x - o.x, dz = tg.z - o.z;
  const D = Math.hypot(dx, dz) || 1e-3;
  let yaw = Math.atan2(dz, dx);
  let pitch = Math.atan2(tg.y - o.y, D) + 0.02;
  let res = null;
  for (let it = 0; it < 6; it++) {
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const vx = c * cp * speed, vy = sp * speed, vz = s * cp * speed;
    const w = spinVec(c, s, spin);
    res = shoot(o, vx, vy, vz, w.x, w.y, w.z, dx / D, dz / D, D, wind);
    if (!res.reached) { pitch += 0.08; continue; }
    const eY = tg.y - res.y, eL = res.lat;
    if (Math.abs(eY) < 0.03 && Math.abs(eL) < 0.03) break;
    yaw -= Math.atan2(eL, D) * 0.95;
    pitch += Math.atan2(eY, D) * 0.95;
    pitch = Math.max(-0.2, Math.min(1.3, pitch));
  }
  const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const w = spinVec(c, s, spin);
  return { vx: c * cp * speed, vy: sp * speed, vz: s * cp * speed, wx: w.x, wy: w.y, wz: w.z, t: res ? res.t : 1, reached: res ? res.reached : false };
}

// Lançamento/cruzamento: elevação fixa, resolve velocidade para cair no alvo.
export function solveLob(o, tg, pitch, spin, wind) {
  const dx = tg.x - o.x, dz = tg.z - o.z;
  const D = Math.max(1, Math.hypot(dx, dz));
  let yaw = Math.atan2(dz, dx);
  let speed = Math.sqrt(D * BALL.gravity / Math.max(0.2, Math.sin(2 * pitch))) * 1.05;
  const targetY = tg.y ?? R;
  for (let it = 0; it < 7; it++) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const w = spinVec(c, s, spin);
    // distância em que a bola desce até a altura do alvo
    const land = landDistance(o, c * Math.cos(pitch) * speed, Math.sin(pitch) * speed, s * Math.cos(pitch) * speed, w, c, s, targetY, wind);
    const err = D - land.d;
    if (Math.abs(err) < 0.15 && Math.abs(land.lat) < 0.15) break;
    speed *= Math.sqrt(Math.max(0.3, D / Math.max(0.5, land.d)));
    speed = Math.min(40, speed);
    yaw -= Math.atan2(land.lat, D) * 0.95;
  }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const w = spinVec(c, s, spin);
  return { vx: c * Math.cos(pitch) * speed, vy: Math.sin(pitch) * speed, vz: s * Math.cos(pitch) * speed, wx: w.x, wy: w.y, wz: w.z, speed };
}

function landDistance(o, vx, vy, vz, w, dirx, dirz, targetY, wind) {
  _sim.place(o.x, Math.max(R, o.y), o.z);
  _sim.events = null; _sim.wind = wind || { x: 0, z: 0 };
  _sim.kick(vx, vy, vz, w.x, w.y, w.z);
  const h = 1 / 120;
  let t = 0, up = true;
  while (t < 6) {
    _sim.step(h); t += h;
    if (_sim.v.y < 0) up = false;
    if (!up && _sim.p.y <= Math.max(R + 0.01, targetY)) break;
  }
  const rx = _sim.p.x - o.x, rz = _sim.p.z - o.z;
  return { d: rx * dirx + rz * dirz, lat: -rx * dirz + rz * dirx, t };
}

// Passe rasteiro: velocidade inicial para chegar ao alvo com `arrive` m/s.
export function solveGround(o, tg, arrive) {
  const dx = tg.x - o.x, dz = tg.z - o.z;
  const D = Math.hypot(dx, dz) || 0.1;
  const c = dx / D, s = dz / D;
  let lo = 2, hi = 38;
  for (let it = 0; it < 14; it++) {
    const mid = (lo + hi) / 2;
    const r = rollTo(o, c * mid, s * mid, D);
    if (!r.reached || r.speed < arrive) lo = mid; else hi = mid;
  }
  const sp = (lo + hi) / 2;
  return { vx: c * sp, vy: 0, vz: s * sp, wx: 0, wy: 0, wz: 0, speed: sp, t: rollTo(o, c * sp, s * sp, D).t };
}

function rollTo(o, vx, vz, D) {
  _sim.place(o.x, R, o.z);
  _sim.events = null; _sim.wind = { x: 0, z: 0 };
  _sim.kick(vx, 0, vz);
  const h = 1 / 60;
  let t = 0;
  while (t < 8) {
    _sim.step(h); t += h;
    if (Math.hypot(_sim.p.x - o.x, _sim.p.z - o.z) >= D) return { reached: true, speed: _sim.hspeed(), t };
    if (_sim.hspeed() < 0.2) break;
  }
  return { reached: false, speed: 0, t };
}

// Vetor de rotação a partir de efeito lateral (side) e topspin (top) para a
// direção horizontal (c, s).
export function spinVec(c, s, spin) {
  const side = spin?.side || 0, top = spin?.top || 0;
  // topspin: eixo ŷ × d = (s, 0, -c) · … ; backspin é o oposto
  return { x: top * s, y: side, z: -top * c };
}
