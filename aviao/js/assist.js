// Pilotagem "Simples (WASD)": o jogador pede o que quer (subir, descer, virar) e este
// piloto de apoio mexe nos comandos de verdade. A física por baixo continua a mesma.
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const D2R = Math.PI / 180;

export class SimpleAssist {
  constructor() { this.eBias = 0.05; this.climbOut = false; }
  reset() { this.eBias = 0.05; this.climbOut = false; }

  /**
   * @param fm   FlightModel
   * @param inp  { pitch: -1..1 (+ = subir), roll: -1..1 (+ = direita), throttle: 0..1, brake }
   */
  apply(fm, inp, dt) {
    const o = fm.out, c = fm.ctl;
    const kt = (o.ias || 0) * 1.944;
    const q = fm.omega.x, p = o.p || 0, pitch = o.pitch || 0, roll = o.roll || 0, alpha = o.alpha || 0;
    c.throttle = inp.throttle;
    c.brake = inp.brake;

    if (fm.onGround) {
      this.climbOut = kt > 40;          // saiu do chão acelerando: subida inicial automática
      // no chão: A/D esterçam a bequilha; o avião levanta o nariz sozinho a partir de 55 nós
      c.aileron = 0;
      c.rudder = clamp(inp.roll * 0.8, -1, 1);
      let qDes = 0;
      if ((kt > 55 && inp.throttle > 0.5) || (kt > 45 && inp.pitch > 0.3)) qDes = clamp((9 * D2R - pitch) * 0.8, 0, 0.12);
      this.eBias = clamp(this.eBias + (qDes - q) * dt * 0.6, -0.3, 0.6);
      c.elevator = clamp(this.eBias + (qDes - q) * 2.2 + (kt > 45 ? 0.1 : 0), -1, 1);
      return;
    }

    // ar: ↑/↓ comandam a razão de arfagem; soltou, o avião segura a altitude
    // subida inicial: depois de decolar, sobe ~600 pés/min até 500 pés acima do chão
    if (this.climbOut && ((o.agl || 0) > 150 || Math.abs(inp.pitch) > 0.05)) this.climbOut = false;
    const vsTarget = this.climbOut ? 3.0 : 0;
    let qDes;
    if (Math.abs(inp.pitch) > 0.05) qDes = inp.pitch * 0.22;
    else qDes = clamp((vsTarget - (o.vs || 0)) * 0.018, -0.06, 0.06);
    // limites: não passa de 25° de arfagem e protege contra o estol
    if (pitch > 25 * D2R) qDes = Math.min(qDes, -0.05);
    if (pitch < -25 * D2R) qDes = Math.max(qDes, 0.05);
    if (alpha > 11 * D2R || kt < 52) qDes = Math.min(qDes, -0.04);
    this.eBias = clamp(this.eBias + (qDes - q) * dt * 0.9, -0.4, 0.7);
    c.elevator = clamp(this.eBias + (qDes - q) * 2.0, -1, 1);

    // A/D pedem inclinação (até 35°); soltou, as asas nivelam
    const bankDes = inp.roll * 35 * D2R;
    c.aileron = clamp((bankDes - roll) * 1.6 - p * 0.45, -1, 1);
    // leme automático: curva coordenada, sem derrapar
    c.rudder = clamp((o.beta || 0) * 4 - (o.r || 0) * 0.3, -1, 1);
    c.trim = 0;   // o termo integral (eBias) já faz o papel do compensador
  }
}
