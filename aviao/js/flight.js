// Modelo de voo 6 graus de liberdade do Cessna 172 + trem de pouso com mola e amortecedor.
// Eixos locais do avião (como no three.js): +x asa direita, +y cima, -z nariz.
// Taxas aeronáuticas: p (rolamento, asa direita desce +) = -ω.z, q (arfagem, nariz sobe +) = ω.x,
// r (guinada, nariz à direita +) = -ω.y.
import * as THREE from 'three';
import { C172 as A, G } from './config.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _qi = new THREE.Quaternion(), _dq = new THREE.Quaternion();
const RIGHT = new THREE.Vector3(1, 0, 0);

export function airDensity(alt) { return 1.225 * Math.pow(Math.max(0.2, 1 - 2.2558e-5 * alt), 4.2559); }

// coeficiente de sustentação com estol suave (a asa perde sustentação depois de ~15,5°)
function liftCurve(alpha, flapDeg) {
  const as = A.alphaStall - flapDeg * 0.0015, an = A.alphaNegStall;
  const lin = A.CL0 + A.CLa * alpha;
  if (alpha <= as && alpha >= an) return lin;
  if (alpha > as) {
    const peak = A.CL0 + A.CLa * as, x = alpha - as;
    // queda depois do estol, tendendo a uma placa plana (~sen 2α)
    const post = Math.max(0.55, peak - 2.4 * x) ;
    const plate = 1.1 * Math.sin(2 * alpha);
    return x < 0.35 ? post : Math.min(post, plate);
  }
  const peak = A.CL0 + A.CLa * an, x = an - alpha;
  return Math.min(-0.4, peak + 2.0 * x);
}

export class FlightModel {
  constructor(world) {
    this.world = world;                 // { groundAt(x,z) -> {h, water, runway}, buildingHit(p) }
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.omega = new THREE.Vector3();   // local, rad/s
    this.ctl = { elevator: 0, aileron: 0, rudder: 0, throttle: 0, flaps: 0, brake: 0, trim: 0 };
    this.flapDeg = 0;                    // o motor elétrico do flape leva ~7 s de 0 a 30°
    this.rpm = A.rpmIdle;
    this.engineOn = true;
    this.wind = new THREE.Vector3();
    this.gust = new THREE.Vector3();
    this.turb = 0;
    this.out = {};                       // telemetria para instrumentos e HUD
    this.wheels = A.gear.map((g) => ({ ...g, p: new THREE.Vector3(...g.p), comp: 0, contact: false, wasContact: false }));
    this.hard = A.hardpoints.map((p) => new THREE.Vector3(...p));
    this.crashed = null;
    this.onGround = true;
    this.airTime = 0;
    this.events = [];
    this.gLoad = 1;
    this._t = 0;
  }

  reset(pos, headingRad, speed = 0, onGround = true) {
    this.pos.copy(pos);
    this.quat.setFromEuler(new THREE.Euler(0, -headingRad, 0, 'YXZ'));   // rumo 0 = norte (-z)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat);
    this.vel.copy(fwd).multiplyScalar(speed);
    this.omega.set(0, 0, 0);
    this.crashed = null; this.gLoad = 1; this._overG = 0;
    this.onGround = onGround;
    this.airTime = onGround ? 0 : 10;
    this.rpm = onGround ? A.rpmIdle : 2300;
    this.engineOn = true;
    for (const w of this.wheels) { w.contact = w.wasContact = onGround; w.comp = 0; }
    this.events.length = 0;
    this.out = { ias: speed, tas: speed, alpha: 0, beta: 0, pitch: 0, roll: 0, heading: headingRad, alt: pos.y, vs: 0, rpm: this.rpm, flapDeg: this.flapDeg, gload: 1, turnRate: 0, slip: 0, gs: speed, agl: 0, onGround, p: 0, r: 0 };
  }

  step(dt) {
    if (this.crashed) return;
    this._t += dt;
    const c = this.ctl;
    // blindagem: entrada inválida (gamepad com defeito, etc.) vira neutra
    for (const k of ['elevator', 'aileron', 'rudder', 'throttle', 'brake', 'trim']) if (!Number.isFinite(c[k])) c[k] = 0;
    c.elevator = Math.max(-1, Math.min(1, c.elevator)); c.aileron = Math.max(-1, Math.min(1, c.aileron)); c.rudder = Math.max(-1, Math.min(1, c.rudder));
    c.throttle = Math.max(0, Math.min(1, c.throttle));
    const m = A.mass;

    // ---- atmosfera e vento (com rajadas de turbulência suaves)
    const alt = this.pos.y;
    const rho = airDensity(alt);
    const t = this._t;
    const tb = this.turb * Math.min(1, alt / 300 + 0.3);
    this.gust.set(
      (Math.sin(t * 0.37) + Math.sin(t * 1.13 + 1.7) * 0.6 + Math.sin(t * 2.9 + 0.3) * 0.25) * tb,
      (Math.sin(t * 0.53 + 2.1) + Math.sin(t * 1.71) * 0.5 + Math.sin(t * 3.7 + 1.1) * 0.3) * tb * 0.6,
      (Math.sin(t * 0.41 + 4.0) + Math.sin(t * 1.29 + 0.4) * 0.6) * tb);
    const windHere = _v3.copy(this.wind).multiplyScalar(Math.min(1, Math.max(0.35, alt / 150))).add(this.gust);

    // ---- velocidade do ar no referencial do avião
    _qi.copy(this.quat).invert();
    const vb = _v.copy(this.vel).sub(windHere).applyQuaternion(_qi);
    const V = vb.length();
    const Vs = Math.max(V, 1);
    const u = -vb.z, sideV = vb.x, wDown = -vb.y;
    const alpha = Math.atan2(wDown, Math.max(Math.abs(u), 0.5) * Math.sign(u || 1));
    const beta = Math.asin(THREE.MathUtils.clamp(sideV / Vs, -1, 1));
    const qbar = 0.5 * rho * V * V;
    const p = -this.omega.z, q = this.omega.x, r = -this.omega.y;
    const ph = p * A.b / (2 * Vs), qh = q * A.c / (2 * Vs), rh = r * A.b / (2 * Vs);

    // ---- superfícies de comando (entrada -1..1)
    const de = -(c.elevator * A.maxElev) - c.trim * 0.12;   // puxar (+) = bordo de fuga para cima; compensador + = cabrar
    const da = c.aileron * A.maxAil;                       // + = rolar para a direita
    const dr = c.rudder * A.maxRud;                        // + = pedal direito
    const flapTarget = A.flapSteps[c.flaps] || 0;
    this.flapDeg += THREE.MathUtils.clamp(flapTarget - this.flapDeg, -4.5 * dt, 4.5 * dt);
    const fd = this.flapDeg;

    // ---- coeficientes aerodinâmicos
    const clw = liftCurve(alpha, fd);
    const CL = clw + A.CLflap * fd + A.CLq * qh + A.CLde * (-de);
    const stalled = alpha > A.alphaStall - fd * 0.0015;
    const CD = A.CD0 + A.CDflap * fd + A.K * clw * clw + A.CDbeta * Math.abs(beta) + (stalled ? 0.9 * Math.sin(Math.abs(alpha)) ** 2 : 0);
    const CY = A.CYb * beta - A.CYdr * dr;
    // ao estolar, uma asa cai (pequena assimetria) e o amortecimento de rolamento some
    const drop = stalled ? Math.sin(t * 1.3) * 0.02 + 0.015 : 0;
    const Cl = A.Clb * beta + A.Clp * ph * (stalled ? 0.3 : 1) + A.Clr * rh + A.Clda * da + A.Cldr * dr + drop;
    const Cm = A.Cm0 + A.Cma * alpha + A.Cmq * qh + A.Cmde * de + A.Cmflap * fd - (stalled ? 0.08 : 0);
    const Cn = A.Cnb * beta + A.Cnr * rh + A.Cnp * ph + A.Cnda * da - A.Cndr * dr;

    // ---- motor e hélice (180 hp, potência cai com a altitude)
    const thr = this.engineOn ? c.throttle : 0;
    const rpmTarget = this.engineOn ? A.rpmIdle + (A.rpmMax - A.rpmIdle) * Math.min(1, thr * (0.82 + 0.18 * Math.min(V / 55, 1.2))) : 0;
    this.rpm += (rpmTarget - this.rpm) * Math.min(1, dt * 2.5);
    const P = A.power * thr * (rho / 1.225) * A.propEff;
    const V0 = A.power * A.propEff / A.staticThrust;
    const T = this.engineOn ? P / Math.sqrt(Math.max(u, 0) ** 2 + V0 * V0) : 0;
    // hélice em marcha lenta (ou parada) freia o avião: planeio real ~9:1
    const propDrag = 0.5 * rho * Math.max(u, 0) ** 2 * A.S * 0.03 * (1 - Math.min(1, thr * 4));

    // ---- forças no referencial local
    const vhat = _v2.copy(vb).multiplyScalar(1 / Vs);
    const liftDir = new THREE.Vector3().crossVectors(RIGHT, vhat);
    if (liftDir.lengthSq() > 1e-6) liftDir.normalize();
    const F = new THREE.Vector3()
      .addScaledVector(liftDir, qbar * A.S * CL)
      .addScaledVector(vhat, -qbar * A.S * CD)
      .addScaledVector(RIGHT, qbar * A.S * CY);
    F.z -= T - propDrag;
    // torque do motor e fator P: tendência a rolar e guinar para a esquerda com potência
    const torque = new THREE.Vector3(
      qbar * A.S * A.c * Cm,
      -qbar * A.S * A.b * Cn + (T * 0.035 + T * alpha * 0.25),     // guinada à esquerda (τy +)
      -qbar * A.S * A.b * Cl + T * 0.012);                         // rolamento à esquerda (τz +)

    // ---- trem de pouso
    const Fw = F.applyQuaternion(this.quat);        // forças aerodinâmicas no mundo
    Fw.y -= m * G;
    const Tw = new THREE.Vector3();                // torque do trem, mundo
    const fwdW = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat);
    const omegaW = this.omega.clone().applyQuaternion(this.quat);
    let anyContact = false, touchVS = 0;
    for (const w of this.wheels) {
      const rw = w.p.clone().applyQuaternion(this.quat);
      const P = rw.clone().add(this.pos);
      const g = this.world.groundAt(P.x, P.z);
      const pen = g.h - P.y;
      w.wasContact = w.contact;
      w.contact = pen > 0;
      if (!w.contact) { w.comp = 0; continue; }
      anyContact = true;
      if (g.water) { this._crash('Pouso na água. O Cessna 172 não flutua.'); return; }
      if (pen > 0.45) { this._crash('O trem de pouso cedeu no impacto.'); return; }
      const vp = omegaW.clone().cross(rw).add(this.vel);
      if (!w.wasContact && w.brake) touchVS = Math.min(touchVS, vp.y);
      const n = g.normal || new THREE.Vector3(0, 1, 0);
      const vn = vp.dot(n);
      const Fn = Math.max(0, w.k * pen - w.c * vn);
      w.comp = pen;
      // direção da roda (a do nariz esterça com o pedal em baixa velocidade)
      let wf = fwdW.clone().addScaledVector(n, -fwdW.dot(n)).normalize();
      if (w.steer) {
        const steer = -c.rudder * THREE.MathUtils.degToRad(10) * THREE.MathUtils.clamp(1 - V / 35, 0.2, 1);
        wf.applyAxisAngle(n, steer);
      }
      const wl = new THREE.Vector3().crossVectors(n, wf);
      const vLong = vp.dot(wf), vLat = vp.dot(wl);
      const mu = 0.025 + (w.brake ? c.brake * 0.55 : 0);
      const fLong = -mu * Fn * Math.tanh(vLong / 0.4);
      const fLat = -0.8 * Fn * Math.tanh(vLat / 0.25);
      const Fwheel = n.clone().multiplyScalar(Fn).addScaledVector(wf, fLong).addScaledVector(wl, fLat);
      Fw.add(Fwheel);
      Tw.add(rw.clone().cross(Fwheel));
    }
    // pontos rígidos: asa, cauda, hélice e barriga
    for (const hp of this.hard) {
      const P = hp.clone().applyQuaternion(this.quat).add(this.pos);
      const g = this.world.groundAt(P.x, P.z);
      if (P.y < g.h + 0.02) { this._crash(g.water ? 'O avião tocou a água.' : 'Uma parte do avião bateu no chão.'); return; }
      if (this.world.buildingHit && this.world.buildingHit(P)) { this._crash('Colisão com um prédio.'); return; }
    }
    if (this.world.buildingHit && this.world.buildingHit(this.pos)) { this._crash('Colisão com um prédio.'); return; }
    if (V > A.vne * 1.25) { this._crash('Falha estrutural: velocidade muito acima da VNE.'); return; }
    // carga estrutural (categoria normal: +3,8 / −1,52 g; ruptura ~1,5×)
    if (this.gLoad > 5.7 || this.gLoad < -2.3) { this._overG = (this._overG || 0) + dt; if (this._overG > 0.15) { this._crash(`Falha estrutural: ${this.gLoad.toFixed(1)} g, acima do limite do Cessna.`); return; } } else this._overG = 0;

    // pouso: registra a razão de descida no toque
    if (anyContact && !this.onGround && this.airTime > 2) {
      const fpm = touchVS * 196.85;
      if (fpm < -700) { this._crash(`Pouso muito duro (${Math.round(fpm)} pés/min).`); return; }
      this.events.push({ type: 'touchdown', fpm, speed: V, pos: this.pos.clone() });
    }
    if (anyContact) { this.onGround = true; this.airTime = 0; } else { this.airTime += dt; if (this.airTime > 0.5) this.onGround = false; }

    // ---- integração
    const acc = Fw.clone().multiplyScalar(1 / m);
    this.gLoad = acc.clone().add(new THREE.Vector3(0, G, 0)).applyQuaternion(_qi).y / G;
    this.vel.addScaledVector(acc, dt);
    this.pos.addScaledVector(this.vel, dt);
    const tauL = torque.add(Tw.applyQuaternion(_qi));
    const I = new THREE.Vector3(A.I.pitch, A.I.yaw, A.I.roll);
    const Iw = this.omega.clone().multiply(I);
    const gyro = this.omega.clone().cross(Iw);
    const wdot = tauL.sub(gyro).divide(I);
    this.omega.addScaledVector(wdot, dt);
    const ang = this.omega.length() * dt;
    if (ang > 1e-9) { _dq.setFromAxisAngle(_v.copy(this.omega).normalize(), ang); this.quat.multiply(_dq).normalize(); }

    // ---- telemetria
    const eul = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');
    const o = this.out;
    o.ias = V * Math.sqrt(rho / 1.225);        // velocidade indicada (m/s)
    o.tas = V; o.alpha = alpha; o.beta = beta; o.stalled = stalled; o.stallWarn = alpha > A.alphaStall - 0.09 && V > 8 && !anyContact;
    o.pitch = eul.x; o.roll = -eul.z; o.heading = ((-eul.y) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    o.alt = this.pos.y; o.vs = this.vel.y; o.rpm = this.rpm; o.flapDeg = fd; o.gload = this.gLoad;
    o.turnRate = -omegaW.y; o.slip = beta; o.gs = Math.hypot(this.vel.x, this.vel.z);
    o.agl = this.pos.y - this.world.groundAt(this.pos.x, this.pos.z).h - 1.33;
    o.onGround = this.onGround; o.thrust = T; o.p = p; o.r = r; o.overG = this.gLoad > 3.8 || this.gLoad < -1.52;
  }

  _crash(reason) {
    this.crashed = reason;
    this.events.push({ type: 'crash', reason, pos: this.pos.clone(), speed: this.vel.length() });
  }
}
