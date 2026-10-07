// Estado e movimento de um jogador: aceleração, inércia nas curvas, fôlego,
// ações com tempo de contato (chute, cabeceio, carrinho…) e estado de pose
// que o módulo de animação transforma em esqueleto.
import { PLAYER, ANIM, clamp, lerp, angDiff } from './config.js';
import { cycleLength } from './anim.js';
import { traitsOf } from './tactics.js';

const POSE_KEYS = ['anim', 't', 'speed', 'moveAngle', 'stride', 'lean', 'foot', 'power', 'diveSide', 'diveHeight', 'variant', 'lookYaw', 'lookPitch', 'drib', 'bx', 'bz', 'acc', 'tat'];

// ação de jogo → animação
const ACTION_ANIM = {
  pass: 'pass', long: 'kick', cross: 'kick', shot: 'kick', finesse: 'kick', through: 'pass', chip: 'chip',
  clear: 'kick', volley: 'volley', header: 'header', slide: 'slide', tackle: 'tackle', throwin: 'throwin',
  gk_dive: 'gk_dive', gk_catch: 'gk_catch', gk_throw: 'gk_throw', gk_kick: 'gk_kick', gk_pass: 'pass',
  fall: 'fall', getup: 'getup', celebrate: 'celebrate', dejected: 'dejected', hug: 'hug', penalty: 'kick', freekick: 'kick',
};

export function newPose() {
  return { anim: 'locomotion', t: 0, speed: 0, moveAngle: 0, stride: 0, lean: 0, foot: 1, power: 0.5,
    diveSide: 1, diveHeight: 0, variant: 0, lookYaw: 0, lookPitch: 0, drib: 0, bx: 0, bz: 0, acc: 0, tat: -1, blendFrom: null, blendW: 1 };
}

export class Player {
  constructor(team, idx, slot, data, role) {
    this.team = team;             // objeto do time na partida
    this.idx = idx;               // 0..21 (índice global)
    this.slot = slot;             // posição na formação
    this.data = data;             // jogador de teams.js
    this.role = role;             // GK | DEF | MID | ATT
    this.isGK = role === 'GK';
    const a = data.attrs;
    this.a = a;
    const f = a.pac / 99;
    this.jog = lerp(PLAYER.jogMin, PLAYER.jogMax, f);
    this.sprintSpd = lerp(PLAYER.sprintMin, PLAYER.sprintMax, f);
    // atributos detalhados (teams.js, detailAttrs); valores antigos se faltarem
    const acc = a.acc ?? (a.pac * 0.7 + a.dri * 0.3), agi = a.agi ?? a.dri;
    this.accel = lerp(PLAYER.accelMin, PLAYER.accelMax, clamp((acc / 99 - 0.45) / 0.5, 0, 1));
    this.agility = 0.78 + 0.4 * (agi / 99);
    this.foot = data.foot === 'E' ? -1 : 1;
    this.traits = traitsOf(a, data.pos || role);     // personalidade (§20): muda decisões da IA
    this.x = 0; this.z = 0; this.y = 0;
    this.vx = 0; this.vz = 0;
    this.heading = 0;
    this.px = 0; this.pz = 0; this.ph = 0;  // estado anterior (interpolação)
    this.dx = 0; this.dz = 0;               // velocidade desejada
    this.sprint = false;
    this.face = null;                       // {x,z} para encarar enquanto se move
    this.pose = newPose();
    this.blendFrom = newPose();
    this.action = null;
    this.stun = 0;
    this.stamina = 1;            // fôlego de curto prazo (gasta no sprint, recupera andando)
    this.fatigue = 0;            // desgaste da partida (0..~0,6), cresce com o esforço
    this.cooldown = 0;                      // não pode tocar na bola
    this.lastTouch = 0;
    this.touchTimer = 0;
    this.yellow = 0;
    this.sentOff = false;
    this.human = false;
    this.aiTimer = Math.random() * 0.4;
    this.runUntil = 0;
    this.fooled = 0;
    this.queued = null;                     // comando do jogador guardado até a bola chegar
    this.target = { x: 0, z: 0 };
    this.interceptT = 99; this.interceptK = -1;
    this.goals = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get fx() { return Math.cos(this.heading); }
  get fz() { return Math.sin(this.heading); }

  teleport(x, z, heading) {
    this.x = this.px = x; this.z = this.pz = z;
    this.vx = this.vz = 0; this.dx = this.dz = 0;
    if (heading !== undefined) this.heading = this.ph = heading;
    this.y = 0;
    this.action = null; this.stun = 0;
    this.setAnim(this.isGK ? 'gk_ready' : 'locomotion', true);
  }

  // Define velocidade desejada rumo a um ponto, freando na chegada.
  moveTo(x, z, urgency = 0.6, sprintOk = false) {
    const ex = x - this.x, ez = z - this.z;
    const d = Math.hypot(ex, ez);
    // histerese: parado, só sai do lugar se o alvo estiver a mais de ~1 m
    const arrive = this.speed < 0.6 ? 0.95 : 0.3;
    if (d < arrive) { this.dx = this.dz = 0; this.sprint = false; return d; }
    const maxS = sprintOk && d > 6 ? this.sprintSpd : this.jog;
    // frenagem: v² = 2·a·d
    const brake = Math.sqrt(2 * PLAYER.decel * 0.55 * d);
    const s = Math.min(maxS * clamp(urgency + d / 30, 0.25, 1), brake);
    this.dx = ex / d * s; this.dz = ez / d * s;
    this.sprint = sprintOk && s > this.jog + 0.2;
    return d;
  }

  setAnim(name, instant = false) {
    const p = this.pose;
    if (p.anim === name && !instant) return;
    if (!instant) {
      const b = this.blendFrom;
      for (const k of POSE_KEYS) b[k] = p[k];
      b.blendFrom = null; b.blendW = 1;
      p.blendFrom = b; p.blendW = 0;
    } else { p.blendFrom = null; p.blendW = 1; }
    p.anim = name; p.t = 0;
  }

  startAction(type, data = {}) {
    const animName = ACTION_ANIM[type] || type;
    const spec = ANIM[animName] || ANIM.kick;
    const dur = (data.dur || spec.dur) / (data.speedup || 1);
    this.action = { type, t: 0, dur, contactT: spec.contact * dur, fired: false, data };
    this.setAnim(animName);
    const p = this.pose;
    p.foot = data.foot ?? this.foot;
    p.power = data.power ?? 0.6;
    p.diveSide = data.diveSide ?? 1;
    p.diveHeight = data.diveHeight ?? 0;
    p.variant = data.variant ?? 0;
    return this.action;
  }

  busy() { return !!this.action || this.stun > 0; }
  canPlay() { return !this.sentOff && this.stun <= 0 && this.cooldown <= 0 && !(this.action && ['slide', 'fall', 'getup', 'gk_dive', 'celebrate', 'dejected', 'hug', 'throwin'].includes(this.action.type)); }

  // Integra movimento. onContact(player, action) é chamado no quadro do contato.
  step(dt, onContact, onEnd) {
    this.px = this.x; this.pz = this.z; this.ph = this.heading;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.fooled > 0) this.fooled -= dt;
    const act = this.action;
    let dx = this.dx, dz = this.dz;

    if (act) {
      act.t += dt;
      const k = act.type;
      if (k === 'slide') {
        const f = clamp(1 - act.t / (act.dur * 0.7), 0, 1);
        const s = (act.data.speed || 6.5) * f;
        dx = this.fx * s; dz = this.fz * s;
        this.vx = dx; this.vz = dz;
      } else if (k === 'fall' || k === 'getup' || k === 'dejected' || k === 'throwin' || k === 'gk_catch' || k === 'gk_throw' || k === 'gk_kick') {
        dx = dz = 0;
        const f = Math.exp(-6 * dt); this.vx *= f; this.vz *= f;
      } else if (k === 'gk_dive') {
        // o corpo voa de lado; a posição lógica acompanha o mergulho
        const side = act.data.diveSide || 1;
        const lat = act.data.lateral || 1.8;
        const u = clamp(act.t / (act.dur * 0.45), 0, 1);
        const prevU = clamp((act.t - dt) / (act.dur * 0.45), 0, 1);
        const du = (Math.sin(u * Math.PI / 2) - Math.sin(prevU * Math.PI / 2)) * lat;
        const rx = -this.fz * side, rz = this.fx * side;   // direita do goleiro
        this.x += rx * du; this.z += rz * du;
        this.vx = this.vz = 0; dx = dz = 0;
      } else if (k === 'celebrate') {
        // aviãozinho: segue correndo (a IA dirige); joelhada: desliza e para; demais: para
        const v = act.data.variant || 0;
        if (v === 1) { dx = dz = 0; const f = Math.exp(-1.1 * dt); this.vx *= f; this.vz *= f; }
        else if (v !== 0) { dx = dz = 0; const f = Math.exp(-5 * dt); this.vx *= f; this.vz *= f; }
      } else if (k === 'tackle' && act.data.lunge) {
        // dividida: bote curto rumo à bola (perde força até o contato)
        // velocidade cheia até o contato do pé, depois freia
        const s = act.t < act.contactT ? act.data.lunge : act.data.lunge * clamp(1 - (act.t - act.contactT) / 0.12, 0, 1) * 0.5;
        dx = act.data.lx * s; dz = act.data.lz * s;
        this.vx = dx; this.vz = dz;
      } else if (k === 'hug') {
        dx = dz = 0; const f = Math.exp(-6 * dt); this.vx *= f; this.vz *= f;
      } else if (this.kickChase && !act.fired) {
        // chute/passe com a bola rolando: a corrida se ajusta para o pé chegar nela no contato
        dx = this.kickChase.x; dz = this.kickChase.z;
      } else {
        // chutes/passes/cabeceios: desacelera um pouco
        dx *= 0.45; dz *= 0.45;
      }
      if (!act.fired && act.t >= act.contactT) { act.fired = true; onContact && onContact(this, act); }
      if (act.t >= act.dur) {
        this.action = null;
        onEnd && onEnd(this, act);
      } else this.pose.t = act.t;
    }

    if (this.stun > 0) { this.stun -= dt; dx = dz = 0; }

    const locked = act && (['slide', 'gk_dive', 'fall', 'getup'].includes(act.type) || (act.type === 'celebrate' && act.data.variant === 1) || (act.type === 'tackle' && act.data.lunge));
    // intenção suavizada: tira a "tremedeira" de alvos que mudam a cada quadro
    const sm = Math.min(1, dt * (this.human ? 16 : 7));
    this.sdx = (this.sdx ?? dx) + (dx - (this.sdx ?? dx)) * sm;
    this.sdz = (this.sdz ?? dz) + (dz - (this.sdz ?? dz)) * sm;
    // humano: a virada brusca é detectada pelo comando CRU (a suavização atrasava o apoio e a
    // virada de 180° "pelo lado" do direcional virava uma curva aberta)
    const pvx = this.vx, pvz = this.vz;
    if (!locked) this.integrate(dt, this.sdx, this.sdz, this.human ? dx : null, dz);
    // aceleração ao longo do corpo (para a pose: tronco à frente ao arrancar, para trás ao frear)
    this.accL = ((this.vx - pvx) * this.fx + (this.vz - pvz) * this.fz) / dt;
    this.x += this.vx * dt; this.z += this.vz * dt;

    // fôlego
    const sp = this.speed;
    // fadiga (seção 34): o desgaste baixa o teto do fôlego e deixa a recuperação lenta
    const cap = 1 - 0.55 * this.fatigue;
    if (this.sprint && sp > this.jog) this.stamina = Math.max(0, this.stamina - dt * 0.012 * (1 + this.fatigue));
    else this.stamina = Math.min(cap, this.stamina + dt * (sp < 2 ? 0.02 : 0.008) * (1 - 0.5 * this.fatigue));

    // salto do cabeceio / barreira
    const hAct = this.action && this.action.type === 'header' ? this.action : null;
    if (hAct) this.y = (hAct.data.jump ?? 0.3) * Math.max(0, Math.sin(Math.PI * clamp(hAct.t / (hAct.dur * 0.9), 0, 1)));
    else if (this.jumpT > 0) { this.jumpT -= dt; this.y = 0.35 * Math.sin(Math.PI * clamp(1 - this.jumpT / 0.35, 0, 1)); }
    else this.y = 0;

    this.updateHeading(dt, act);
    this.updatePose(dt, act);
  }

  // velocidade máxima agora (arrancada ou não, fôlego, bola no pé)
  topSpeed() {
    // com a bola no pé: um pouco mais lento e menos ágil (depende do drible)
    const ballK = this.hasBall ? (this.sprint ? 0.9 : 0.95) + this.a.dri / 99 * 0.05 : 1;
    return (this.sprint ? this.sprintSpd * (0.86 + 0.14 * this.stamina) : this.jog) * (this.slow || 1) * ballK;
  }

  integrate(dt, dx, dz, rawx = null, rawz = 0) {
    const maxS = this.topSpeed();
    let ds = Math.hypot(dx, dz);
    if (ds > maxS) { dx *= maxS / ds; dz *= maxS / ds; ds = maxS; }
    const sp = Math.hypot(this.vx, this.vz);
    if (sp < 0.6) {
      const ex = dx - this.vx, ez = dz - this.vz;
      const e = Math.hypot(ex, ez), m = this.accel * 1.3 * dt;
      if (e > m) { this.vx += ex / e * m; this.vz += ez / e * m; } else { this.vx = dx; this.vz = dz; }
      return;
    }
    const cur = Math.atan2(this.vz, this.vx);
    const tgt = ds > 0.1 ? Math.atan2(dz, dx) : cur;
    const diff = angDiff(cur, tgt);
    const fs = clamp(sp / PLAYER.sprintMax, 0, 1);
    // giro limitado pela aceleração lateral que o corpo aguenta (ω ≤ a_lat / v): em alta
    // velocidade a curva abre, a menos que o jogador freie — o freio vem do 'want' abaixo
    const aLat = (8 + 14 * (this.a.agi ?? this.a.dri) / 99) * (this.hasBall ? 0.9 : 1);
    const turnRate = Math.min(lerp(PLAYER.turnRateStill, PLAYER.turnRateSprint, Math.pow(fs, 0.8)) * this.agility * (this.hasBall ? 0.85 : 1), aLat / Math.max(sp, 0.5));
    // quanto mais rápido, menor o ângulo que já exige plantar o pé e frear antes de virar
    // (a 30+ km/h não existe curva de 90° instantânea: desacelera → apoia → gira → acelera)
    const plant = lerp(1.9, 0.85, fs * fs) * (0.85 + 0.3 * (this.agility - 0.78) / 0.4);
    let nsp, nang;
    const rl = rawx === null ? 0 : Math.hypot(rawx, rawz);
    if (rl > 0.1 && Math.abs(angDiff(cur, Math.atan2(rawz, rawx))) > plant) {
      // comando cru pede virada brusca: usa a direção dele (módulo limitado como acima)
      const k = Math.min(rl, maxS) / rl;
      dx = rawx * k; dz = rawz * k; ds = Math.hypot(dx, dz);
    }
    if ((Math.abs(diff) > plant || (rl > 0.1 && Math.abs(angDiff(cur, Math.atan2(rawz, rawx))) > plant)) && ds > 0.1) {
      // mudança brusca de sentido: planta o pé. A força do apoio é um VETOR limitado: primeiro
      // anula a velocidade de lado (em relação ao rumo novo), o resto freia e arranca ao longo
      // do rumo. Antes o vetor girava enquanto freava e o jogador desenhava um "U" (deriva de
      // ~1 m numa virada de 180°); agora para na linha, gira o corpo e sai de volta.
      const ux = dx / ds, uz = dz / ds;
      const vpar = this.vx * ux + this.vz * uz;
      let px = this.vx - vpar * ux, pz = this.vz - vpar * uz;
      let budget = PLAYER.decel * 1.15 * dt;
      const pl = Math.hypot(px, pz), cut = Math.min(pl, budget * 0.75);
      if (pl > 1e-6) { px -= px / pl * cut; pz -= pz / pl * cut; }
      budget -= cut;
      const np = vpar + clamp(ds - vpar, -budget, budget * (vpar < 0 ? 1 : 0.6));
      this.vx = px + np * ux; this.vz = pz + np * uz;
      return;
    } else {
      nang = cur + clamp(diff, -turnRate * dt, turnRate * dt);
      const want = ds * Math.max(0.35, Math.cos(Math.min(Math.abs(diff), 1.4)));
      // arranque forte e ganho decrescente perto do máximo (o rápido chega antes ao topo)
      // cansado ainda chega à velocidade alta, mas demora mais para acelerar
      const tired = (0.72 + 0.28 * this.stamina) * (1 - 0.25 * this.fatigue);
      const rate = (want > sp ? this.accel * tired * (1 - 0.8 * (sp / PLAYER.sprintMax) ** 2) : PLAYER.decel) * dt;
      nsp = sp + clamp(want - sp, -rate, rate);
    }
    this.vx = Math.cos(nang) * nsp; this.vz = Math.sin(nang) * nsp;
  }

  // Giro do corpo com velocidade angular suavizada (sem estalos). Quase parado,
  // o jogador acompanha a bola com o olhar/corpo devagar em vez de girar à toa.
  updateHeading(dt, act) {
    if (act && ['slide', 'gk_dive', 'fall', 'getup', 'throwin'].includes(act.type)) { this.angVel = 0; return; }
    let tgt = null, maxRate = 11;
    const sp = this.speed;
    if (act && act.data.face !== undefined) { tgt = act.data.face; maxRate = 9; }
    else if (this.face) { tgt = Math.atan2(this.face.z - this.z, this.face.x - this.x); maxRate = 6.5; }
    else if (sp > 0.9) { tgt = Math.atan2(this.vz, this.vx); maxRate = lerp(12, 7, clamp(sp / 9, 0, 1)); }
    else if (this.watch) { tgt = Math.atan2(this.watch.z - this.z, this.watch.x - this.x); maxRate = 3.5; }
    if (tgt === null) { this.angVel = (this.angVel || 0) * Math.exp(-10 * dt); return; }
    const d = angDiff(this.heading, tgt);
    // zona morta pequena para não ficar "corrigindo" alguns graus o tempo todo
    const want = Math.abs(d) < 0.06 && sp < 0.9 ? 0 : clamp(d * 9, -maxRate, maxRate);
    this.angVel = (this.angVel || 0) + (want - (this.angVel || 0)) * Math.min(1, dt * 16);
    let turn = this.angVel * dt;
    if (Math.abs(turn) > Math.abs(d)) turn = d;
    this.heading += turn;
    if (this.heading > Math.PI) this.heading -= Math.PI * 2;
    if (this.heading < -Math.PI) this.heading += Math.PI * 2;
    this.turnVel = turn / dt;
  }

  updatePose(dt, act) {
    const p = this.pose;
    const sp = this.speed;
    if (!act) {
      let want = 'locomotion';
      if (this.isGK && this.gkReady) want = 'gk_ready';
      else if (this.jockey) want = 'jockey';
      else if (this.holdingBall) want = 'gk_hold';
      if (p.anim !== want) this.setAnim(want);
      p.t += dt;
    }
    p.speed = sp;
    p.moveAngle = sp > 0.2 ? angDiff(this.heading, Math.atan2(this.vz, this.vx)) : 0;
    // fase da passada em ciclos (contínua quando a velocidade muda; % 1024 mantém a precisão)
    p.stride = (p.stride + sp * dt / cycleLength(sp, p.moveAngle)) % 1024;
    p.acc += (clamp(this.accL || 0, -14, 12) - p.acc) * Math.min(1, dt * 9);
    const lean = clamp((this.turnVel || 0) * sp * 0.025, -0.35, 0.35);
    p.lean += (lean - p.lean) * Math.min(1, dt * 8);
    // condução: posição da bola no espaço do modelo (x = esquerda, z = frente, escala de 1,80 m)
    // para o pé de toque buscar a bola na passada (anim.js)
    p.drib += ((this.hasBall && !act ? 1 : 0) - p.drib) * Math.min(1, dt * 6);
    // passada do próximo toque planejado (o pé só vai na bola nela; -1 = sem plano)
    p.tat = this.hasBall && this.touchSt != null ? this.touchSt : -1;
    if (this.watch && p.drib > 0.01) {
      const hs = (this.data.look?.height || PLAYER.height) / 1.8;
      const rx = this.watch.x - this.x, rz = this.watch.z - this.z;
      p.bz = (rx * this.fx + rz * this.fz) / hs;
      p.bx = (rx * this.fz - rz * this.fx) / hs;
    }
    if (p.blendW < 1) p.blendW = Math.min(1, p.blendW + dt / 0.16);
    if (p.blendW >= 1) p.blendFrom = null;
  }

  lookAt(x, y, z) {
    const yaw = angDiff(this.heading, Math.atan2(z - this.z, x - this.x));
    const d = Math.hypot(x - this.x, z - this.z);
    const p = this.pose;
    p.lookYaw = clamp(yaw, -1.1, 1.1);
    p.lookPitch = clamp(Math.atan2(y - 1.65, d), -0.7, 0.5);
  }

  // Posição aproximada do pé que vai tocar a bola.
  footX() { return this.x + this.fx * 0.35; }
  footZ() { return this.z + this.fz * 0.35; }
}
