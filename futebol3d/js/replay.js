// Replay: grava os últimos segundos (posição, pose e bola) num buffer circular
// de Float32Array e reproduz com câmeras de cinema. A pose é função pura do
// estado gravado, então o replay mostra exatamente o lance.

import { cycleLength } from './anim.js';

const ANIMS = ['locomotion', 'idle', 'jockey', 'kick', 'pass', 'chip', 'volley', 'header', 'slide', 'tackle', 'throwin',
  'gk_ready', 'gk_dive', 'gk_catch', 'gk_hold', 'gk_throw', 'gk_kick', 'fall', 'getup', 'celebrate', 'dejected', 'shield', 'hug'];
const AIDX = Object.fromEntries(ANIMS.map((a, i) => [a, i]));
const PF = ['t', 'speed', 'moveAngle', 'stride', 'lean', 'foot', 'power', 'diveSide', 'diveHeight', 'variant', 'lookYaw', 'lookPitch', 'drib', 'bx', 'bz', 'acc', 'tat'];
const PSZ = 1 + PF.length;                 // anim + campos
const PL = 5 + PSZ * 2 + 1;                 // x y z heading visible + pose + blendFrom + blendW
const BALLSZ = 7;                           // pos + quaternion

export class Replay {
  constructor(players = 22, seconds = 12, hz = 60) {
    this.n = players;
    this.cap = seconds * hz;
    this.frame = BALLSZ + players * PL;
    this.buf = new Float32Array(this.cap * this.frame);
    this.count = 0; this.head = 0;
    this.playing = false;
    this.poses = Array.from({ length: players }, () => ({ pose: newPose(), from: newPose(), x: 0, y: 0, z: 0, heading: 0, visible: true }));
    this.ball = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  }

  record(match, ballQuat) {
    const f = this.head * this.frame;
    const B = this.buf, b = match.ball.p;
    B[f] = b.x; B[f + 1] = b.y; B[f + 2] = b.z;
    B[f + 3] = ballQuat.x; B[f + 4] = ballQuat.y; B[f + 5] = ballQuat.z; B[f + 6] = ballQuat.w;
    for (let i = 0; i < this.n; i++) {
      const p = match.players[i];
      let o = f + BALLSZ + i * PL;
      B[o++] = p.x; B[o++] = p.y; B[o++] = p.z; B[o++] = p.heading; B[o++] = p.sentOff ? 0 : 1;
      o = writePose(B, o, p.pose);
      const bf = p.pose.blendFrom;
      o = writePose(B, o, bf || p.pose);
      B[o] = bf ? p.pose.blendW : 1;
    }
    this.head = (this.head + 1) % this.cap;
    this.count = Math.min(this.cap, this.count + 1);
  }

  // Começa a reprodução dos últimos `seconds` (até `endAgo` segundos atrás).
  start(seconds = 7, endAgo = 0, speed = 1) {
    const frames = Math.min(this.count, Math.round(seconds * 60));
    if (frames < 30) return false;
    this.playing = true;
    this.speed = speed;
    this.len = frames - Math.round(endAgo * 60);
    this.startIdx = (this.head - frames + this.cap) % this.cap;
    this.pos = 0;
    return true;
  }

  stop() { this.playing = false; }

  // Avança e devolve false quando acabar.
  update(dt) {
    if (!this.playing) return false;
    // câmera lenta perto do fim (o momento do gol)
    const u = this.pos / this.len;
    const sp = this.speed * (u > 0.55 && u < 0.85 ? 0.45 : 1);
    this.pos += dt * 60 * sp;
    if (this.pos >= this.len - 1) { this.playing = false; return false; }
    this.decode(this.pos);
    return true;
  }

  get progress() { return this.len ? this.pos / this.len : 1; }

  decode(pos) {
    const i0 = Math.floor(pos), a = pos - i0;
    const f0 = ((this.startIdx + i0) % this.cap) * this.frame;
    const f1 = ((this.startIdx + i0 + 1) % this.cap) * this.frame;
    const B = this.buf;
    const L = (k) => B[f0 + k] + (B[f1 + k] - B[f0 + k]) * a;
    const bl = this.ball;
    bl.x = L(0); bl.y = L(1); bl.z = L(2);
    this.ballVel = this.ballVel || { x: 0, y: 0, z: 0 };
    this.ballVel.x = (B[f1] - B[f0]) * 60; this.ballVel.y = (B[f1 + 1] - B[f0 + 1]) * 60; this.ballVel.z = (B[f1 + 2] - B[f0 + 2]) * 60;
    bl.qx = B[f1 + 3]; bl.qy = B[f1 + 4]; bl.qz = B[f1 + 5]; bl.qw = B[f1 + 6];
    for (let i = 0; i < this.n; i++) {
      const r = this.poses[i];
      const o0 = f0 + BALLSZ + i * PL, o1 = f1 + BALLSZ + i * PL;
      r.x = B[o0] + (B[o1] - B[o0]) * a; r.y = B[o0 + 1] + (B[o1 + 1] - B[o0 + 1]) * a; r.z = B[o0 + 2] + (B[o1 + 2] - B[o0 + 2]) * a;
      let dh = B[o1 + 3] - B[o0 + 3];
      if (dh > Math.PI) dh -= Math.PI * 2; if (dh < -Math.PI) dh += Math.PI * 2;
      r.heading = B[o0 + 3] + dh * a;
      r.visible = B[o0 + 4] > 0.5;
      const src = a < 0.5 ? o0 : o1;
      readPose(B, src + 5, r.pose);
      readPose(B, src + 5 + PSZ, r.from);
      const w = B[src + 5 + PSZ * 2];
      if (w < 1) { r.pose.blendFrom = r.from; r.pose.blendW = w; } else { r.pose.blendFrom = null; r.pose.blendW = 1; }
      // tempo contínuo para suavizar animação
      if (a >= 0.5) continue;
      r.pose.t += a / 60; r.pose.stride += r.pose.speed / cycleLength(r.pose.speed, r.pose.moveAngle) * a / 60;
    }
  }
}

function newPose() {
  return { anim: 'locomotion', t: 0, speed: 0, moveAngle: 0, stride: 0, lean: 0, foot: 1, power: 0.5, diveSide: 1, diveHeight: 0, variant: 0, lookYaw: 0, lookPitch: 0, drib: 0, bx: 0, bz: 0, acc: 0, tat: -1, blendFrom: null, blendW: 1 };
}
function writePose(B, o, p) {
  B[o++] = AIDX[p.anim] ?? 0;
  for (const k of PF) B[o++] = p[k] || 0;
  return o;
}
function readPose(B, o, p) {
  p.anim = ANIMS[B[o++] | 0] || 'locomotion';
  for (const k of PF) p[k] = B[o++];
  p.blendFrom = null; p.blendW = 1;
}
