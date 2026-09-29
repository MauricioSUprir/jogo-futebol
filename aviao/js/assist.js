// Pilotagem "Simples (WASD)": o jogador pede o que quer (subir, descer, virar, mais ou menos
// velocidade) e este piloto de apoio mexe nos comandos de verdade. A física continua a mesma.
// Tudo é "preso": solte as teclas e o avião segura altitude, rumo e velocidade.
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const D2R = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const SPEED_MIN = 55, SPEED_MAX = 120;      // nós

export class SimpleAssist {
  constructor() { this.reset(); }
  reset() {
    this.eBias = 0.08; this.climbOut = false; this.altHold = null; this.hdgHold = null;
    this.bankCmd = 0; this.vsCmd = 0; this.thrI = 0; this.targetKt = 90;
  }

  /**
   * @param fm   FlightModel
   * @param inp  { pitch: -1..1 (+ = subir), roll: -1..1 (+ = direita), throttle: 0..1 (alavanca), brake }
   */
  apply(fm, inp, dt) {
    const o = fm.out, c = fm.ctl;
    const kt = (o.ias || 0) * 1.944;
    const q = fm.omega.x, p = o.p || 0, pitch = o.pitch || 0, roll = o.roll || 0, alpha = o.alpha || 0, vs = o.vs || 0;
    const hdg = o.heading || 0, agl = o.agl || 0;
    c.brake = inp.brake;
    // a alavanca (W/S) vira velocidade desejada no ar
    this.targetKt = SPEED_MIN + inp.throttle * (SPEED_MAX - SPEED_MIN);

    if (fm.onGround) {
      // no chão: alavanca = potência direta; A/D esterçam; o nariz sobe sozinho a 55 nós
      c.throttle = inp.throttle;
      this.climbOut = kt > 40;
      this.altHold = null; this.hdgHold = hdg; this.bankCmd = 0; this.thrI = 0;
      c.aileron = 0;
      c.rudder = clamp(inp.roll * 0.6, -1, 1);
      let qDes = 0;
      if ((kt > 55 && inp.throttle > 0.5) || (kt > 45 && inp.pitch > 0.3)) qDes = clamp((8 * D2R - pitch) * 0.6, 0, 0.08);
      this.eBias = clamp(this.eBias + (qDes - q) * dt * 0.6, -0.3, 0.6);
      c.elevator = clamp(this.eBias + (qDes - q) * 2.2 + (kt > 45 ? 0.1 : 0), -1, 1);
      return;
    }

    // ---- vertical: ↑/↓ pedem razão de subida; soltou, trava a altitude
    let vsTarget;
    if (this.climbOut && (agl > 150 || Math.abs(inp.pitch) > 0.05)) { this.climbOut = false; this.altHold = fm.pos.y; }
    if (Math.abs(inp.pitch) > 0.05) { vsTarget = inp.pitch * 5.0; this.altHold = null; }
    else if (this.climbOut) vsTarget = 3.0;
    else { if (this.altHold === null) this.altHold = fm.pos.y + vs * 1.5; vsTarget = clamp((this.altHold - fm.pos.y) * 0.2, -3, 3); }
    // perto do chão descendo: arredonda sozinho (pouso suave)
    const flare = vsTarget < 0 && agl < 8;
    if (flare) vsTarget = Math.max(vsTarget, -0.6 - agl * 0.1);
    // muda a razão devagar: sensação de avião pesado
    // (inverter o sentido é mais rápido que começar do zero)
    const rate = vsTarget * this.vsCmd < 0 ? 6.0 : 3.0;
    this.vsCmd += clamp(vsTarget - this.vsCmd, -rate * dt, rate * dt);
    let qDes = clamp((this.vsCmd - vs) * 0.04, -0.06, 0.06);
    if (pitch > 15 * D2R) qDes = Math.min(qDes, -0.03);
    if (pitch < -12 * D2R) qDes = Math.max(qDes, 0.03);
    if (alpha > 11 * D2R || kt < 48) qDes = Math.min(qDes, -0.03);   // proteção contra estol
    this.eBias = clamp(this.eBias + (qDes - q) * dt * 0.8, -0.4, 0.7);
    // em curva é preciso puxar mais para não perder altura
    const bankComp = (1 / Math.max(Math.cos(roll), 0.5) - 1) * 0.45;
    c.elevator = clamp(this.eBias + bankComp + (qDes - q) * 1.8, -1, 1);

    // ---- velocidade: o motor se ajusta sozinho para manter a velocidade pedida
    const want = flare && agl < 3 ? 0 : null;
    const e = this.targetKt - kt;
    this.thrI = clamp(this.thrI + e * dt * 0.012, -0.3, 0.6);
    // subindo precisa de mais motor, descendo de menos
    c.throttle = want ?? clamp(0.45 + e * 0.04 + this.thrI + this.vsCmd * 0.05, 0, 1);

    // ---- lateral: A/D pedem curva (até 30°); soltou, nivela e trava o rumo
    let bankDes;
    if (Math.abs(inp.roll) > 0.05) { bankDes = inp.roll * 30 * D2R; this.hdgHold = null; }
    else {
      if (this.hdgHold === null && Math.abs(roll) < 5 * D2R) this.hdgHold = hdg;
      bankDes = this.hdgHold === null ? 0 : clamp(wrap(this.hdgHold - hdg) * 1.5, -12 * D2R, 12 * D2R);
    }
    // inclinação muda devagar (20°/s)
    this.bankCmd += clamp(bankDes - this.bankCmd, -20 * D2R * dt, 20 * D2R * dt);
    c.aileron = clamp((this.bankCmd - roll) * 1.3 - p * 0.7, -1, 1);
    // leme automático: curva coordenada, sem derrapar
    c.rudder = clamp((o.beta || 0) * 4 - (o.r || 0) * 0.3, -1, 1);
    c.trim = 0;   // o termo integral (eBias) faz o papel do compensador
  }
}
