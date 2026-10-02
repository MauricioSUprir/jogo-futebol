// Motor da partida: regras (gol, lateral, escanteio, tiro de meta, falta, pênalti,
// impedimento, cartões), posse de bola, chutes/passes com física real, relógio,
// intervalo, prorrogação e disputa de pênaltis. Não depende de three.js.
import { Ball, BallPredictor, solveAim, solveLob, solveGround } from './ball.js';
import { Player } from './player.js';
import { FORMATIONS, PITCH, GOAL, BALL, PLAYER, DIFFICULTY, clamp, lerp, angDiff } from './config.js';
import { teamThink, setpieceAI } from './ai.js';
import { keeperThink, keeperSaveCheck } from './gk.js';
import { humanStep } from './human.js';
import { cycleLength } from './anim.js';

const R = BALL.radius;
const HL = PITCH.halfL, HW = PITCH.halfW;
const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;
// roteiro da abertura (segundos)
// lineDone: todos perfilados (câmera passa pelos rostos); card: escalação no campinho
// (com a torcida ao fundo); breakT: vão para o pontapé; end: fim da abertura
const INTRO = { firstOut: 2.5, gap: 0.45, tunnelZ: -37.4, lineZ: -14, lineDone: 19, card: 24, breakT: 31, end: 36, walk: 3.0 };
export const INTRO_TIMES = INTRO;
const KICKS = new Set(['pass', 'long', 'cross', 'shot', 'finesse', 'through', 'chip', 'clear', 'volley', 'penalty', 'freekick', 'gk_kick', 'gk_pass']);

export class Match {
  constructor(cfg) {
    this.cfg = cfg;
    this.settings = cfg.settings;
    this.diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.profissional;
    this.ball = new Ball();
    this.ball.events = [];
    this.pred = new BallPredictor(3, 30);
    this.events = [];
    this.time = 0;
    this.clock = 0;                 // segundos de jogo
    this.half = 1;
    this.phase = 'setpiece';
    this.owner = null;
    this.lastTouch = null;
    this.lastKick = null;
    this.passTarget = null;
    this.offside = null;            // { team, flagged:Set }
    this.sp = null;                 // bola parada em andamento
    this.stopTimer = 0;
    this.pendingRestart = null;
    this.stoppage = 0;
    this.advantage = null;
    this.goalInfo = null;
    this.scorers = [];
    this.threat = 0; this.excitement = 0.3;
    this.shootout = null;
    this.extraTime = false;
    this.halfReal = this.settings.halfMinutes * 60;
    const w = this.settings.wind ? rand(0, 4.5) : 0, wa = rand(0, Math.PI * 2);
    this.wind = { x: Math.cos(wa) * w, z: Math.sin(wa) * w };
    this.ball.wind = this.wind;

    const mk = (i, data, kit, gkKit) => {
      const t = { i, data, kit, gkKit, dir: 1, score: 0, players: [], style: data.style || { press: 0.5, width: 0.5, tempo: 0.5, directness: 0.5 },
        formation: FORMATIONS[data.formation] || FORMATIONS['4-3-3'], human: false,
        stats: { possession: 0, shots: 0, onTarget: 0, fouls: 0, corners: 0, offsides: 0, yellow: 0, red: 0, passes: 0, passOk: 0 } };
      return t;
    };
    this.teams = [mk(0, cfg.home, cfg.homeKit, cfg.homeGK), mk(1, cfg.away, cfg.awayKit, cfg.awayGK)];
    const us = cfg.userSide === 'home' ? 0 : cfg.userSide === 'away' ? 1 : -1;
    this.userTeam = us >= 0 ? this.teams[us] : null;
    if (this.userTeam) this.userTeam.human = true;
    // O time do usuário ataca para -x no 1º tempo (para a direita da câmera de TV).
    const userDir = -1;
    if (us >= 0) { this.teams[us].dir = userDir; this.teams[1 - us].dir = -userDir; }
    else { this.teams[0].dir = -1; this.teams[1].dir = 1; }
    this.players = [];
    for (const t of this.teams) {
      t.formation.forEach(([role], k) => {
        const data = t.data.players[k];
        const p = new Player(t, this.players.length, k, data, role);
        t.players.push(p); this.players.push(p);
      });
      t.gk = t.players[0];
      t.opp = null;
    }
    this.teams[0].opp = this.teams[1]; this.teams[1].opp = this.teams[0];
    for (const p of this.players) p.watch = this.ball.p;   // quase parado, olha a bola
    this.controlled = null;
    this.firstKickoff = Math.random() < 0.5 ? 0 : 1;
    this.setupKickoff(this.teams[this.firstKickoff]);
    if (cfg.intro) this.startIntro();
  }

  // ------------------------------------------------- protocolo de entrada em campo
  // Os times saem do túnel (meio-campo, lado da câmera), perfilam diante da
  // tribuna, cumprimentam a torcida e correm para as posições. Pode ser pulado.
  startIntro() {
    this.phase = 'intro';
    this.intro = { t: 0, end: INTRO.end };
    this.ball.place(0, BALL.radius, 0);
    this.owner = null;
    const order = [];
    for (let k = 0; k < 11; k++) for (const t of this.teams) order.push(t.players[k]);
    order.forEach((p, k) => {
      const side = p.team.i === 0 ? -1 : 1;
      p.introSide = side;
      p.introStart = INTRO.firstOut + Math.floor(k / 2) * INTRO.gap;
      p.introStage = 0;
      // fila dentro do túnel (z negativo, atrás da boca)
      p.teleport(side * 0.75, INTRO.tunnelZ - 2 - Math.floor(k / 2) * 1.25, Math.PI / 2);
      // lugar no perfilamento: lado a lado, de frente para a câmera de TV
      const slot = p.slot;
      p.introLine = { x: side * (2.2 + (10 - slot) * 1.35), z: INTRO.lineZ };
    });
    this.excitement = 0.85;
    this.events.length = 0;            // sem apito do pontapé durante a abertura
    this.emit('intro', { stage: 'start' });
  }

  introStep(dt) {
    const it = this.intro;
    const prevT = it.t;
    it.t += dt;
    if (prevT < INTRO.firstOut + 0.3 && it.t >= INTRO.firstOut + 0.3) this.emit('intro', { stage: 'enter' });
    if (prevT < INTRO.card && it.t >= INTRO.card) this.emit('intro', { stage: 'lineup' });
    if (prevT < INTRO.breakT && it.t >= INTRO.breakT) this.emit('intro', { stage: 'break' });
    this.excitement += (0.85 - this.excitement) * Math.min(1, dt);
    // caminhada de cerimônia: velocidade fixa, freando na chegada
    const walk = (p, x, z, v) => {
      const ex = x - p.x, ez = z - p.z, d = Math.hypot(ex, ez);
      if (d < 0.15) { p.dx = p.dz = 0; return d; }
      const s = Math.min(v, d * 1.6);
      p.dx = ex / d * s; p.dz = ez / d * s;
      return d;
    };
    for (const p of this.players) {
      if (p.sentOff) continue;
      p.face = null; p.jockey = false; p.sprint = false;
      if (it.t < p.introStart) { p.dx = p.dz = 0; continue; }
      if (it.t < INTRO.breakT) {
        // anda até a boca do túnel e depois até o lugar no perfilamento
        const mouth = { x: p.introSide * 0.9, z: INTRO.tunnelZ + 2.5 };
        if (p.introStage === 0) { if (walk(p, mouth.x, mouth.z, INTRO.walk) < 0.8) p.introStage = 1; }
        else {
          const d = walk(p, p.introLine.x, p.introLine.z, INTRO.walk);
          if (d < 0.6) p.face = { x: p.introLine.x, z: INTRO.lineZ - 30 };
        }
      } else {
        // corre para a posição do pontapé inicial
        walk(p, p.kickX ?? p.x, p.kickZ ?? p.z, 4.5);
      }
    }
    if (it.t >= it.end) this.endIntro();
  }

  skipIntro() { if (this.phase === 'intro') this.endIntro(); }

  endIntro() {
    this.intro = null;
    this.phase = 'stopped';
    this.setupKickoff(this.teams[this.firstKickoff]);
    this.emit('intro', { stage: 'end' });
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  minute() { return Math.floor(this.clock / 60) + 1; }
  opp(t) { return t.opp; }
  active(t) { return t.players.filter(p => !p.sentOff); }
  goalX(t) { return t.dir * HL; }              // gol que o time ataca
  ownGoalX(t) { return -t.dir * HL; }
  lx(t, x) { return x * t.dir; }               // x no referencial de ataque do time

  // ------------------------------------------------------------------ laço
  step(dt, cmd) {
    this.time += dt;
    this.ball.wind = this.wind;
    this.pred.run(this.ball);

    if (this.phase === 'play' && !this.shootout) {
      this.clock += dt * (this.extraTime ? 900 : 2700) / this.halfReal;
      this.checkClock();
    }
    if (this.phase === 'stopped') {
      this.stopTimer -= dt;
      if (this.stopTimer <= 0 && this.pendingRestart) { const r = this.pendingRestart; this.pendingRestart = null; this.setupRestart(r); }
    }
    if (this.phase === 'goal') this.goalStep(dt);
    if (this.phase === 'halftime' || this.phase === 'fulltime') {
      this.stopTimer -= dt;
      if (this.stopTimer <= 0) this.afterBreak();
    }
    if (this.shootout) { this.shootoutStep(dt); this.shootoutAdvance(dt); }
    if (this.phase === 'setpiece') this.setpieceRun(dt);

    if (this.phase === 'intro') {
      this.introStep(dt);
      for (const p of this.players) if (!p.sentOff) p.step(dt, this.onContact, this.onActionEnd);
      this.bodies(dt);
      return;
    }
    // IA e humano definem velocidades desejadas e ações
    if (this.phase !== 'ended') {
      for (const t of this.teams) teamThink(this, t, dt);
      for (const t of this.teams) keeperThink(this, t.gk, dt);
      if (this.phase === 'setpiece') setpieceAI(this, dt);
      if (this.userTeam) humanStep(this, cmd, dt);
    }

    for (const p of this.players) {
      if (p.sentOff) continue;
      p.hasBall = this.owner === p;
      p.step(dt, this.onContact, this.onActionEnd);
    }
    this.bodies(dt);
    this.slideChecks();

    // bola: 2 subpassos por quadro de 60 Hz
    const sub = 2;
    for (let i = 0; i < sub; i++) {
      this.controlBall(dt / sub);
      this.ball.step(dt / sub);
      if (this.phase === 'play') this.ballBodies();
      if (this.phase === 'play' || this.phase === 'setpiece') keeperSaveCheck(this, dt / sub);
      if (this.phase === 'play') this.checkBall();
    }
    for (const e of this.ball.events) this.events.push(e);
    this.ball.events.length = 0;

    this.possession(dt);
    this.updateThreat(dt);
  }

  // ------------------------------------------------------------ contato físico
  bodies(dt) {
    const ps = this.players, rr = PLAYER.radius * 2;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i]; if (a.sentOff) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j]; if (b.sentOff) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, over = rr - d;
        // o mais forte empurra mais (físico + velocidade)
        const sa = a.a.phy + a.speed * 4, sb = b.a.phy + b.speed * 4;
        const wa = sb / (sa + sb), wb = 1 - wa;
        a.x -= nx * over * wa; a.z -= nz * over * wa;
        b.x += nx * over * wb; b.z += nz * over * wb;
        const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (rel > 0) {
          a.vx -= nx * rel * wa * 0.8; a.vz -= nz * rel * wa * 0.8;
          b.vx += nx * rel * wb * 0.8; b.vz += nz * rel * wb * 0.8;
          if (rel > 2.5 && a.team !== b.team && this.phase === 'play') {
            if (rel > 3.5) this.emit('bodyHit', { strength: Math.min(1, rel / 7) });
            // choque com quem conduz: pode desequilibrar
            const carrier = this.owner === a ? a : this.owner === b ? b : null;
            if (carrier) {
              const other = carrier === a ? b : a;
              const k = (other.a.phy - carrier.a.phy) / 99 + rel / 12 - (carrier.shielding ? 0.35 : 0);
              if (Math.random() < k * 0.5) this.looseBall(carrier, 3);
            }
          }
        }
      }
    }
  }

  // Carrinho: toca a bola ou derruba o adversário (falta).
  slideChecks() {
    for (const p of this.players) {
      const act = p.action;
      if (!act || act.type !== 'slide' || act.t < 0.08 || act.t > act.dur * 0.6) continue;
      const fx = p.x + p.fx * 0.9, fz = p.z + p.fz * 0.9;
      const b = this.ball.p;
      if (!act.data.hitBall && b.y < 0.6 && Math.hypot(b.x - fx, b.z - fz) < 0.85) {
        act.data.hitBall = true;
        const sp = 7 + Math.random() * 5;
        const ang = p.heading + rand(-0.6, 0.6);
        if (this.owner) this.owner.cooldown = 0.5;
        this.owner = null;
        this.ball.kick(Math.cos(ang) * sp + p.vx * 0.3, rand(0, 1.5), Math.sin(ang) * sp + p.vz * 0.3);
        this.touch(p, 'tackle');
        this.emit('tackle', { strength: 0.8 });
      }
      for (const o of p.team.opp.players) {
        if (o.sentOff || o.stun > 0 || (o.action && o.action.type === 'fall')) continue;
        if (Math.hypot(o.x - fx, o.z - fz) < 0.75 || Math.hypot(o.x - p.x, o.z - p.z) < 0.6) {
          const behind = Math.cos(angDiff(p.heading, o.heading)) > 0.55;
          o.startAction('fall', {}); o.stun = 1.6;
          if (this.owner === o) this.looseBall(o, 2);
          if (!act.data.hitBall && this.phase === 'play') this.foul(p, o, behind ? 2 : 1);
          else this.emit('bodyHit', { strength: 0.6 });
        }
      }
    }
  }

  // Bola rápida batendo no corpo de um jogador (bloqueio de chute, barreira).
  ballBodies() {
    const b = this.ball;
    if (b.held) return;
    const sp = b.speed();
    if (sp < 7 || b.p.y < 0.3) return;
    const shot = this.lastShot && this.lastKick && this.lastKick.p === this.lastShot.p && this.time - this.lastShot.t < 2;
    if (!shot && b.p.y < 0.95) return;          // bola baixa: domínio/desvio normal
    const kicker = this.lastKick ? this.lastKick.p : null;
    for (const p of this.players) {
      if (p.sentOff || p.isGK || p === this.owner) continue;
      if (!shot && kicker && p.team === kicker.team) continue;   // companheiro domina
      if (this.lastTouch === p && this.time - p.lastTouch < 0.3) continue;
      const top = 1.85 + p.y;
      if (b.p.y > top + 0.1) continue;
      const dx = b.p.x - p.x, dz = b.p.z - p.z;
      const d = Math.hypot(dx, dz);
      const r = (b.p.y > 1.3 ? 0.2 : 0.27) + R;
      if (d > r || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      const vn = b.v.x * nx + b.v.z * nz;
      if (vn >= 0) continue;
      b.p.x = p.x + nx * r; b.p.z = p.z + nz * r;
      b.v.x = (b.v.x - 1.6 * vn * nx) * 0.35; b.v.z = (b.v.z - 1.6 * vn * nz) * 0.35; b.v.y *= 0.4;
      b.w.x *= 0.3; b.w.y *= 0.3; b.w.z *= 0.3;
      b.rolling = false;
      this.touch(p, 'block');
      this.emit('block', { strength: Math.min(1, sp / 25) });
      if (this.lastShot && this.time - this.lastShot.t < 1.5) this.emit('crowd', { kind: 'ooh', strength: 0.5 });
      break;
    }
  }

  // ---------------------------------------------------------- posse e drible
  controlBall(dt) {
    const b = this.ball, o = this.owner;
    if (b.held) {
      // bola nas mãos (goleiro ou lateral)
      const h = this.holder;
      if (h) {
        if (h.isGK) {
          const lying = h.action && (h.action.type === 'gk_dive' || h.action.type === 'getup');
          b.hold(h.x + h.fx * (lying ? 0.1 : 0.35), lying ? 0.4 : 1.15, h.z + h.fz * (lying ? 0.1 : 0.35));
        }
        else b.hold(h.x - h.fx * 0.15, 2.25, h.z - h.fz * 0.15);
      }
      return;
    }
    if (!o || this.phase === 'setpiece') return;
    const dist = Math.hypot(b.p.x - o.x, b.p.z - o.z);
    if (dist > 2.4 || o.sentOff || o.stun > 0) { this.owner = null; this.dbgLost = (this.dbgLost || 0) + 1; return; }
    const act = o.action;
    if (act && KICKS.has(act.type) && !act.fired) {
      // preparando o chute: a bola desacelera à frente do pé
      const tx = o.x + o.fx * 0.55, tz = o.z + o.fz * 0.55;
      b.v.x += (tx - b.p.x) * 6 * dt + (o.vx - b.v.x) * 4 * dt;
      b.v.z += (tz - b.p.z) * 6 * dt + (o.vz - b.v.z) * 4 * dt;
      return;
    }
    if (act) return;
    if (b.p.y > 0.5) return;
    // Condução híbrida (como nos jogos de futebol de console): existe uma "bola
    // animada" presa à passada — sai do pé no toque, abre um pouco à frente e volta a
    // encontrar o pé exatamente no próximo toque (curva 4u(1-u), a de uma bola que
    // desacelera em relação ao jogador) — e a bola física é puxada para ela. O toque
    // acontece quando o pé bom chega à frente na passada (fase de anim.js), então o pé
    // e a bola se encontram na tela. Viradas fortes geram um "toque de esforço".
    const sp = o.speed;
    const dri = o.a.dri / 99;
    const rx = -o.fz, rz = o.fx;
    const L = cycleLength(sp, o.pose.moveAngle || 0);
    const st = o.pose.stride, want = o.foot > 0 ? 0.35 : 0.85;
    let dSt = st - (o.lastStride ?? st);
    if (dSt < -512) dSt += 1024;
    if (dSt < 0 || dSt > 0.25) dSt = 0;
    const crossed = sp > 0.8 && dSt > 0 && Math.floor(st - want) !== Math.floor(st - dSt - want);
    o.lastStride = st;
    o.touchTimer -= dt;
    if (o.cushion > 0) o.cushion -= dt;
    // ciclos de passada entre toques: 1 conduzindo; 2 em arrancada (bola mais longa)
    const per = o.sprint && sp > 6.5 ? 2 : 1;
    if (o.dribSt === undefined) o.dribSt = st;
    let ph = st - o.dribSt; if (ph < 0) ph += 1024;
    const u = Math.min(ph / per, 1.15);
    // alcance do pé no toque e abertura máxima da bola entre toques
    const base = o.shielding ? 0.3 : 0.36 + Math.min(sp, 8) * 0.022;
    const open = (o.shielding ? 0.03 : Math.min(sp, 9) * (per > 1 ? 0.085 : 0.045)) * (1.3 - dri * 0.55);
    const gap = sp > 0.8 ? open * 4 * u * (1 - Math.min(u, 1)) : 0;
    const lead = base + gap;
    const side = (sp > 0.8 ? 0.1 : 0.12) * o.foot;
    const tx = o.x + o.fx * lead + rx * side, tz = o.z + o.fz * lead + rz * side;
    const ex = tx - b.p.x, ez = tz - b.p.z, err = Math.hypot(ex, ez);
    this.dbgErr = err;
    // virada: a bola ficou fora da direção do corpo
    const relx = b.p.x - o.x, relz = b.p.z - o.z;
    const ahead = relx * o.fx + relz * o.fz;
    const angOff = Math.abs(Math.atan2(relx * rx + relz * rz, Math.max(0.05, ahead)));
    const effort = angOff > 0.75 && sp > 1 && err > 0.3;
    const due = crossed && ph / per > 0.6;
    if (o.touchTimer <= 0 && (due || effort || (sp <= 0.8 && err > 0.3))) {
      o.dribSt = st;
      o.touchTimer = effort ? 0.3 : 0.2;
      this.dbgWhy = effort ? 'giro' : due ? 'fase' : 'lento';
      // velocidade de saída da bola animada logo após o toque (+ o que falta corrigir)
      const v0 = sp > 0.8 ? open * 4 / Math.max(0.25, L * per / Math.max(sp, 1)) : 0;
      const noise = (1 - dri) * 0.18 * (o.sprint ? 1.5 : 1);
      b.kick(o.vx + o.fx * v0 + ex * 3 + gauss() * noise, 0, o.vz + o.fz * v0 + ez * 3 + gauss() * noise);
      this.touch(o, 'dribble');
      if (sp > 3 && Math.random() < 0.3) this.emit('dribble', {});
      return;
    }
    // entre os toques: a bola física segue a bola animada (velocidade da curva + correção
    // limitada, para não "teleportar"); amortecendo o domínio, assenta mais devagar
    const dGap = sp > 0.8 && u < 1 ? open * 4 * (1 - 2 * u) * sp / (L * per) : 0;
    const vtx = o.vx + o.fx * dGap, vtz = o.vz + o.fz * dGap;
    const kc = o.cushion > 0 ? 5 : 9;
    let cx = ex * kc, cz = ez * kc;
    const cmax = o.cushion > 0 ? 3 : 2.2 + sp * 0.35, cl = Math.hypot(cx, cz);
    if (cl > cmax) { cx *= cmax / cl; cz *= cmax / cl; }
    const k = Math.min(1, dt * (o.cushion > 0 ? 8 : 14));
    b.v.x += (vtx + cx - b.v.x) * k;
    b.v.z += (vtz + cz - b.v.z) * k;
  }

  possession(dt) {
    if (this.phase !== 'play' && this.phase !== 'setpiece') return;
    const b = this.ball;
    if (b.held) return;
    if (this.phase === 'setpiece') return;
    // posse estatística
    const pt = this.owner ? this.owner.team : this.lastTouch ? this.lastTouch.team : null;
    if (pt) pt.stats.possession += dt;

    if (this.owner) {
      // adversário cutuca uma bola exposta
      const o = this.owner;
      for (const q of o.team.opp.players) {
        if (!q.canPlay() || q.action) continue;
        const d = Math.hypot(b.p.x - q.footX(), b.p.z - q.footZ());
        const dOwner = Math.hypot(b.p.x - o.x, b.p.z - o.z);
        if (d < 0.55 && dOwner > 0.75 && b.p.y < 0.5) {
          const chance = 0.9 * dt * 8 * (q.a.def / 99) * (1.2 - o.a.dri / 150);
          if (Math.random() < chance) { this.takeBall(q, 'intercept'); break; }
        }
      }
      return;
    }
    // bola solta: quem pode dominar?
    let best = null, bestD = 1e9;
    const hs = b.hspeed();
    for (const p of this.players) {
      if (!p.canPlay() || (p.action && !KICKS.has(p.action.type) && p.action.type !== 'tackle')) continue;
      if (p.action && KICKS.has(p.action.type)) continue;
      const d = Math.hypot(b.p.x - p.footX(), b.p.z - p.footZ());
      const reach = PLAYER.controlRange + (hs < 3 ? 0.25 : 0);
      if (d < reach && b.p.y < 0.95 && d < bestD) { best = p; bestD = d; }
    }
    if (!best) {
      // domínio no peito
      for (const p of this.players) {
        if (!p.canPlay() || p.action) continue;
        const d = Math.hypot(b.p.x - p.x, b.p.z - p.z);
        if (d < 0.6 && b.p.y > 0.95 && b.p.y < 1.75 && b.v.y <= 1) {
          const rel = Math.hypot(b.v.x - p.vx, b.v.z - p.vz);
          if (rel < 13) {
            b.v.x = p.vx * 0.5 + p.fx * 0.8; b.v.z = p.vz * 0.5 + p.fz * 0.8; b.v.y = Math.min(b.v.y, -0.5);
            this.touch(p, 'chest');
            this.emit('touch', { strength: 0.3 });
            break;
          }
        }
      }
      return;
    }
    const p = best;
    // pegar com as mãos: goleiro dentro da área (sem recuo proposital de pé)
    if (p.isGK && this.inOwnBox(p, b.p.x, b.p.z) && !this.isBackPass(p)) { this.gkCatch(p); return; }
    const rel = Math.hypot(b.v.x - p.vx, b.v.z - p.vz);
    const limit = 12 + p.a.dri * 0.08 + (p.human ? 2 : 0);
    if (rel > limit && Math.random() < 0.7) {
      // dominada ruim: a bola espirra
      const ang = Math.atan2(b.v.z, b.v.x) + rand(-1.2, 1.2);
      const s = rel * rand(0.2, 0.4);
      b.kick(Math.cos(ang) * s, rand(0, 2), Math.sin(ang) * s);
      p.cooldown = 0.35;
      this.touch(p, 'deflect');
      this.emit('touch', { strength: 0.5 });
      return;
    }
    this.takeBall(p, 'control');
  }

  takeBall(p, how) {
    const b = this.ball;
    const prev = this.owner;
    if (prev && prev !== p) { prev.cooldown = 0.45; }
    this.owner = p;
    p.gotBall = this.time;
    p.touchTimer = 0.12;
    // primeiro toque amortece e traz a bola para a frente do pé
    const lead = 0.35 + p.speed * 0.045;
    const tx = p.x + p.fx * lead, tz = p.z + p.fz * lead;
    b.v.x = p.vx + (tx - b.p.x) * 2.4; b.v.z = p.vz + (tz - b.p.z) * 2.4;
    p.cushion = 0.5;
    p.dribSt = undefined;
    if (b.p.y < R + 0.05) { b.v.y = 0; b.rolling = true; }
    this.touch(p, how);
    this.emit('touch', { strength: 0.25 });
  }

  looseBall(p, speed) {
    if (this.owner !== p) return;
    this.owner = null;
    p.cooldown = 0.5;
    const ang = p.heading + rand(-1.4, 1.4);
    this.ball.kick(Math.cos(ang) * speed + p.vx * 0.5, rand(0, 0.8), Math.sin(ang) * speed + p.vz * 0.5);
  }

  // Todo toque na bola passa por aqui (impedimento, recuo, passe completado…)
  touch(p, how) {
    const prevTouch = this.lastTouch;
    this.lastTouch = p;
    p.lastTouch = this.time;
    // impedimento: jogador marcado participou do lance
    const off = this.offside;
    if (off && this.phase === 'play') {
      if (p.team === off.team && off.flagged.has(p) && how !== 'dribble') {
        this.offside = null;
        this.callOffside(p);
        return;
      }
      if (p.team !== off.team && !(p.isGK && (how === 'save' || how === 'parry'))) this.offside = null;
    }
    // passe completado
    if (this.lastKick && this.lastKick.p !== p && ['pass', 'long', 'through', 'cross', 'gk_pass', 'gk_throw', 'throwin'].includes(this.lastKick.kind) && !this.lastKick.counted) {
      this.lastKick.counted = true;
      if (p.team === this.lastKick.p.team) this.lastKick.p.team.stats.passOk++;
    }
    if (how !== 'dribble' && p.team.human && p !== this.controlled && (how === 'control' || how === 'intercept' || how === 'chest')) this.setControlled(p);
    if (prevTouch && prevTouch.team !== p.team) this.passTarget = null;
    if (this.passTarget && this.passTarget.p === p) this.passTarget = null;
    this.indirectTouches = (this.indirectTouches || 0) + 1;
    // recalcula impedimento a cada toque do time que ataca (condução inclusive)
    if (this.phase === 'play' && !this.noOffsideKick && !(p.isGK && (how === 'save' || how === 'parry'))) this.markOffside(p);
  }

  isBackPass(gk) {
    const k = this.lastKick;
    return k && k.p.team === gk.team && k.p !== gk && ['pass', 'long', 'through', 'clear'].includes(k.kind) && this.lastTouch === k.p;
  }

  inOwnBox(p, x, z) {
    const gx = this.ownGoalX(p.team);
    return Math.abs(x - gx) < PITCH.boxDepth && Math.abs(z) < PITCH.boxHalfW && Math.sign(x) === Math.sign(gx);
  }
  inBox(sign, x, z) {
    return Math.sign(x) === sign && Math.abs(x) > HL - PITCH.boxDepth && Math.abs(z) < PITCH.boxHalfW;
  }

  gkCatch(gk) {
    this.owner = gk;
    this.holder = gk;
    this.ball.hold(gk.x, 1.1, gk.z);
    gk.holdingBall = true;
    gk.holdTime = 0;
    if (!(gk.action && gk.action.type === 'gk_dive')) gk.startAction('gk_catch', {});
    this.touch(gk, 'catch');
    this.offside = null;
    this.passTarget = null;
    this.emit('catch', {});
  }

  // ------------------------------------------------------------ impedimento
  markOffside(p) {
    const t = p.team, opp = t.opp;
    const ds = opp.players.filter(q => !q.sentOff).map(q => this.lx(t, q.x)).sort((a, b) => b - a);
    const second = ds[1] ?? HL;
    const bx = this.lx(t, this.ball.p.x);
    const flagged = new Set();
    for (const q of t.players) {
      if (q === p || q.sentOff) continue;
      const qx = this.lx(t, q.x);
      if (qx > 0.3 && qx > bx + 0.3 && qx > second + 0.3) flagged.add(q);
    }
    this.offside = flagged.size ? { team: t, flagged } : null;
  }

  callOffside(p) {
    p.team.stats.offsides++;
    this.owner = null;
    this.emit('banner', { text: 'IMPEDIMENTO', sub: p.data.name, kind: 'offside' });
    this.emit('crowd', { kind: 'groan', strength: 0.4 });
    this.stopPlay('foul', { type: 'indirect', team: p.team.opp, x: p.x, z: p.z });
  }

  // ---------------------------------------------------------------- faltas
  foul(by, victim, severity) {
    if (this.phase !== 'play') return;
    const t = by.team;
    t.stats.fouls++;
    const x = victim.x, z = victim.z;
    const penalty = this.inOwnBox(by, x, z);
    // vantagem: o time que sofreu a falta segue com a bola no ataque
    if (!penalty && severity < 2) {
      const mate = this.owner && this.owner.team === victim.team && this.owner !== victim;
      if (mate && this.lx(victim.team, x) > -10) {
        this.advantage = { team: victim.team, until: this.time + 2.5, x, z, by };
        this.emit('banner', { text: 'VANTAGEM', kind: 'info' });
        return;
      }
    }
    let card = null;
    if (severity >= 2 || (penalty && Math.random() < 0.35)) {
      if (severity >= 3 || Math.random() < 0.04) card = 'red';
      else { by.yellow++; card = by.yellow >= 2 ? 'red' : 'yellow'; }
    }
    this.emit('whistle', { kind: 'foul' });
    this.emit('crowd', { kind: victim.team.human || victim.team === this.teams[0] ? 'boo' : 'groan', strength: 0.6 });
    this.emit('banner', { text: penalty ? 'PÊNALTI!' : 'FALTA', sub: by.data.name, kind: penalty ? 'penalty' : 'foul' });
    if (card) {
      if (card === 'yellow') t.stats.yellow++; else t.stats.red++;
      this.emit('card', { color: card, name: by.data.name, side: t.i });
      if (card === 'red') this.sendOff(by);
    }
    this.stopPlay('foul', penalty ? { type: 'penalty', team: victim.team } : { type: 'freekick', team: victim.team, x, z }, card ? 2.8 : 1.6, true);
  }

  sendOff(p) {
    if (p.isGK) return;   // goleiro nunca é expulso aqui (simplificação)
    p.sentOff = true;
    if (this.owner === p) this.owner = null;
    if (this.controlled === p) this.setControlled(null);
    p.x = p.px = this.ownGoalX(p.team) * 0 + 0; p.z = p.pz = -HW - 8;
  }

  // -------------------------------------------------------------- regras
  checkBall() {
    if (this.shootout) return;
    const b = this.ball.p;
    if (this.advantage && this.time > this.advantage.until) this.advantage = null;
    // gol
    if (Math.abs(b.x) > HL + GOAL.postRadius + R && Math.abs(b.z) < GOAL.halfWidth && b.y < GOAL.height) {
      this.goal(Math.sign(b.x));
      return;
    }
    const lt = this.lastTouch;
    if (Math.abs(b.z) > HW + R) {
      const team = lt ? lt.team.opp : this.teams[0];
      this.emit('banner', { text: 'LATERAL', kind: 'info' });
      this.stopPlay('out', { type: 'throwin', team, x: clamp(b.x, -HL + 1, HL - 1), z: Math.sign(b.z) * HW }, 1.0);
      return;
    }
    const inMouth = Math.abs(b.z) < GOAL.halfWidth && b.y < GOAL.height;
    if (Math.abs(b.x) > HL + R && !inMouth) {
      const s = Math.sign(b.x);
      const defending = this.teams.find(t => Math.sign(this.ownGoalX(t)) === s);
      if (lt && lt.team === defending) {
        defending.opp.stats.corners++;
        this.emit('banner', { text: 'ESCANTEIO', kind: 'info' });
        this.emit('crowd', { kind: 'cheer', strength: 0.5 });
        this.stopPlay('out', { type: 'corner', team: defending.opp, x: s * HL, z: Math.sign(b.z || 1) * HW }, 1.2);
      } else {
        this.emit('banner', { text: 'TIRO DE META', kind: 'info' });
        if (Math.abs(b.z) < GOAL.halfWidth + 6) this.emit('crowd', { kind: 'ooh', strength: 0.6 });
        this.stopPlay('out', { type: 'goalkick', team: defending, x: s * (HL - 5.5), z: Math.sign(b.z || 1) * 4 }, 1.2);
      }
    }
  }

  goal(sign) {
    const scoredOn = this.teams.find(t => Math.sign(this.ownGoalX(t)) === sign);
    const team = scoredOn.opp;
    // gol direto de tiro livre indireto não vale
    if (this.indirectFrom && this.indirectFrom.team === team && this.indirectTouches <= 1) {
      this.emit('banner', { text: 'TIRO DE META', sub: 'Falta indireta', kind: 'info' });
      this.stopPlay('out', { type: 'goalkick', team: scoredOn, x: sign * (HL - 5.5), z: 4 }, 1.2);
      return;
    }
    team.score++;
    this.shotOnTarget(team);
    const lt = this.lastTouch;
    const own = lt && lt.team !== team;
    const scorer = own ? lt : (lt || team.players[9]);
    if (!own) scorer.goals++;
    const minute = Math.min(this.minute(), this.half === 1 ? 45 : this.half === 2 ? 90 : this.half === 3 ? 105 : 120);
    this.scorers.push({ side: team.i, name: scorer.data.name + (own ? ' (contra)' : ''), minute, own });
    if (this.lastKick && this.lastKick.onTargetCounted !== true && this.lastKick.p.team === team && !own) { /* já contado */ }
    this.phase = 'goal';
    this.goalInfo = { team, scorer, own, t: 0, sign, replayDone: false };
    this.owner = null; this.holder = null;
    this.offside = null; this.sp = null;
    this.emit('goal', { side: team.i, name: scorer.data.name, own, minute, sign });
    this.emit('crowd', { kind: 'goal', strength: 1, side: team.i });
    this.emit('netImpact', { sign, strength: 1 });
    // comemoração: o autor corre até a torcida (perto da bandeirinha) e só lá faz o gesto;
    // os companheiros vão atrás e fecham um abraço em volta dele (ai.js: celebrate)
    const cornerX = sign * (HL - 3.5), cornerZ = (scorer.z > 0 ? 1 : -1) * (HW - 3.5);
    const variant = Math.floor(Math.random() * 4);
    for (const p of team.players) {
      if (p.sentOff) continue;
      p.action = null; p.celebDone = false;
      if (p === scorer && !own) {
        p.celebVariant = variant;
        p.celebTarget = { x: cornerX, z: cornerZ };
        if (variant === 0) p.startAction('celebrate', { variant: 0, dur: 7 });     // aviãozinho já correndo
      } else p.celebTarget = !own ? { x: cornerX, z: cornerZ, mate: true, delay: 0.3 + Math.random() * 0.6 } : null;
    }
    for (const p of scoredOn.players) {
      if (p.sentOff) continue;
      p.celebTarget = null;
      if (Math.random() < 0.6) p.startAction('dejected', { variant: Math.floor(Math.random() * 2), dur: 3 + Math.random() * 2 });
    }
  }

  goalStep(dt) {
    const g = this.goalInfo;
    g.t += dt;
    if (g.t > 7.5 && !g.replayAsked) { g.replayAsked = true; this.emit('replay', { kind: 'goal' }); }
    // main.js avisa quando o replay acabar (replayFinished); sem gráficos segue direto
    if (g.replayAsked && (g.replayDone || this.headless) && g.t > 7.8) {
      this.phase = 'stopped';
      this.setupKickoff(g.team.opp);
    }
  }

  replayFinished() { if (this.goalInfo) this.goalInfo.replayDone = true; }

  stopPlay(reason, restart, delay = 1.2, whistled = false) {
    if (this.phase !== 'play') return;
    if (!whistled && reason !== 'out') this.emit('whistle', { kind: 'short' });
    if (reason === 'out') this.emit('whistle', { kind: 'short' });
    this.phase = 'stopped';
    this.stopTimer = delay;
    this.pendingRestart = restart;
    this.owner = null;
    this.passTarget = null;
    this.offside = null;
    this.advantage = null;
    for (const p of this.players) if (p.action && ['pass', 'shot', 'long', 'cross', 'through', 'chip', 'finesse', 'tackle'].includes(p.action.type) && !p.action.fired) p.action = null;
  }

  // --------------------------------------------------------- bolas paradas
  setupKickoff(team) {
    this.phase = 'setpiece';
    this.owner = null; this.holder = null; this.ball.held = false;
    this.ball.place(0, R, 0);
    this.offside = null;
    for (const t of this.teams) {
      t.formation.forEach(([role, bx, bz], k) => {
        const p = t.players[k];
        if (p.sentOff) return;
        let x = clamp(bx * 0.9 - 3, -HL + 2, -1.2), z = bz * 0.85;
        if (t !== team) {
          const d = Math.hypot(x, z);
          if (d < PITCH.centerRadius + 0.6) { const f = (PITCH.centerRadius + 0.8) / Math.max(0.1, d); x *= f; z *= f; if (x > -0.5) x = -0.5; }
        }
        p.teleport(x * t.dir, z * t.dir, t.dir > 0 ? 0 : Math.PI);
        p.kickX = x * t.dir; p.kickZ = z * t.dir;
        p.holdingBall = false;
        p.celebTarget = null;
      });
    }
    // cobrador e parceiro no círculo central
    const atts = team.players.filter(p => !p.sentOff && !p.isGK).sort((a, b) => team.dir * (b.x - a.x));
    const taker = atts[0], mate = atts[1];
    taker.teleport(-team.dir * 0.45, 0.2, team.dir > 0 ? 0 : Math.PI);
    mate.teleport(-team.dir * 1.2, -2.2 * team.dir, team.dir > 0 ? -0.6 : Math.PI + 0.6);
    this.sp = { type: 'kickoff', team, taker, x: 0, z: 0, t: 0, aim: team.dir > 0 ? Math.PI : 0 };
    this.sp.aim = Math.atan2(mate.z - 0, mate.x - 0);
    this.indirectFrom = null;
    this.noOffsideKick = false;
    if (team.human) this.setControlled(taker);
    else this.controlNearest();
    this.emit('whistle', { kind: 'short' });
    this.emit('setpiece', { type: 'kickoff' });
  }

  setupRestart(r) {
    const team = r.team, b = this.ball;
    const opp = team.opp;
    this.phase = 'setpiece';
    this.owner = null; this.holder = null; b.held = false;
    for (const p of this.players) { p.holdingBall = false; if (p.action && p.action.type !== 'fall') p.action = null; }
    let x = r.x ?? 0, z = r.z ?? 0;
    let taker;
    const pool = team.players.filter(p => !p.sentOff && !p.isGK && p.stun <= 0);
    const nearest = (px, pz, list = pool) => list.reduce((a, p) => (Math.hypot(p.x - px, p.z - pz) < Math.hypot(a.x - px, a.z - pz) ? p : a), list[0]);
    const tgx = this.goalX(team);
    let aim = Math.atan2(-z * 0.3, tgx - x);
    this.noOffsideKick = ['throwin', 'corner', 'goalkick'].includes(r.type);
    this.indirectFrom = r.type === 'indirect' ? { team } : null;
    this.indirectTouches = 0;

    if (r.type === 'throwin') {
      z = Math.sign(z) * (HW + 0.3);
      taker = nearest(x, z);
      aim = Math.atan2(-Math.sign(z), team.dir * 0.4);
      taker.teleport(x, z, aim);
      this.holder = taker; b.hold(x, 2.2, z);
      taker.startAction('throwin', { dur: 99 });  // segura até cobrar
      taker.action.t = 0.05; taker.action.contactT = 999;
    } else if (r.type === 'corner') {
      x = Math.sign(x) * (HL - 0.35); z = Math.sign(z) * (HW - 0.35);
      const wide = pool.filter(p => p.role !== 'DEF');
      taker = wide.sort((a, c) => c.a.pas - a.a.pas)[0] || pool[0];
      aim = Math.atan2(-z, -x * 0.35);
      taker.teleport(x + Math.sign(x) * 0.9 * 0.5, z + Math.sign(z) * 0.6, aim);
      b.place(x, R, z);
    } else if (r.type === 'goalkick') {
      taker = team.gk;
      x = Math.sign(x) * (HL - 5.5); z = Math.sign(z || 1) * 3.5;
      aim = team.dir > 0 ? 0 : Math.PI;
      taker.teleport(x - team.dir * 1.2, z, aim);
      b.place(x, R, z);
    } else if (r.type === 'penalty') {
      x = this.goalX(team) - team.dir * PITCH.penaltySpot; z = 0;
      taker = [...pool].sort((a, c) => c.a.sho - a.a.sho)[0];
      if (r.taker) taker = r.taker;
      aim = team.dir > 0 ? 0 : Math.PI;
      taker.teleport(x - team.dir * 2.2, 0.4, aim);
      b.place(x, R, z);
      // todos fora da área, atrás da linha da bola
      for (const p of this.players) {
        if (p === taker || p.isGK || p.sentOff) continue;
        const px = clamp(p.x * team.dir, -30, HL - PITCH.boxDepth - 1.5) * team.dir;
        p.teleport(px, clamp(p.z, -18, 18), p.heading);
      }
      opp.gk.teleport(this.goalX(team) - team.dir * 0.3, 0, team.dir > 0 ? Math.PI : 0);
    } else {
      // falta (direta/indireta)
      x = clamp(x, -HL + 1, HL - 1); z = clamp(z, -HW + 1, HW - 1);
      taker = nearest(x, z);
      const dGoal = Math.hypot(tgx - x, z);
      const better = pool.filter(p => Math.hypot(p.x - x, p.z - z) < 30).sort((a, c) => c.a.sho - a.a.sho)[0];
      if (r.type === 'freekick' && dGoal < 32 && better) taker = better;
      aim = Math.atan2(-z, tgx - x);
      taker.teleport(x - Math.cos(aim) * 0.8, z - Math.sin(aim) * 0.8, aim);
      b.place(x, R, z);
    }
    // distância regulamentar dos adversários
    const minD = r.type === 'throwin' ? 2.2 : r.type === 'penalty' ? 0 : PITCH.centerRadius;
    for (const p of opp.players) {
      if (p.sentOff || p.isGK && r.type !== 'throwin') continue;
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d < minD) {
        const nx = d > 0.1 ? dx / d : -team.dir, nz = d > 0.1 ? dz / d : 0;
        p.teleport(clamp(x + nx * (minD + 0.3), -HL + 0.5, HL - 0.5), clamp(z + nz * (minD + 0.3), -HW + 0.5, HW - 0.5), Math.atan2(-nz, -nx));
      }
    }
    // barreira
    this.wall = [];
    if ((r.type === 'freekick' || r.type === 'indirect') && Math.hypot(tgx - x, z) < 30) {
      const gdx = tgx - x, gdz = -z, gd = Math.hypot(gdx, gdz);
      const ux = gdx / gd, uz = gdz / gd;
      const n = gd < 22 ? 4 : 3;
      const cand = opp.players.filter(p => !p.isGK && !p.sentOff).sort((a, c) => Math.hypot(a.x - x, a.z - z) - Math.hypot(c.x - x, c.z - z)).slice(0, n);
      cand.forEach((p, k) => {
        const off = (k - (n - 1) / 2) * 0.62 + 0.35 * Math.sign(z || 1);
        p.teleport(x + ux * 9.15 - uz * off, z + uz * 9.15 + ux * off, Math.atan2(-uz, -ux));
        p.inWall = true;
        this.wall.push(p);
      });
    }
    this.sp = { type: r.type, team, taker, x, z, t: 0, aim, shootout: r.shootout };
    if (team.human) this.setControlled(taker);
    else if (opp.human && r.type === 'penalty') this.setControlled(opp.gk);
    else this.controlNearest();
    this.emit('setpiece', { type: r.type, side: team.i });
  }

  // Cobrança efetuada (humano ou IA). kind: pass | long | shot | finesse | chip | cross | throw
  takeSetpiece(kind, params = {}) {
    const sp = this.sp;
    if (!sp || this.phase !== 'setpiece') return;
    const p = sp.taker;
    if (sp.type === 'throwin') {
      p.action = null;
      p.startAction('throwin', { face: sp.aim, ...params, kind });
      p.action.data.setpiece = true;
    } else {
      const type = sp.type === 'penalty' ? (kind === 'chip' ? 'chip' : kind === 'finesse' ? 'finesse' : 'penalty') : kind;
      sp.pending = { type, params };
    }
    sp.taken = true;
  }

  // corrida do cobrador até a bola; chuta quando chega
  setpieceRun(dt) {
    const sp = this.sp;
    if (!sp || !sp.pending) return;
    const p = sp.taker, b = this.ball.p;
    const ux = Math.cos(sp.aim), uz = Math.sin(sp.aim);
    const foot = sp.pending.params.foot ?? p.foot;
    // o pé de apoio fica ao lado da bola
    const tx = b.x - ux * 0.5 + uz * 0.12 * foot, tz = b.z - uz * 0.5 - ux * 0.12 * foot;
    const d = Math.hypot(tx - p.x, tz - p.z);
    p.face = null;
    if (d > 0.3 && !sp.pending.started) {
      const s = Math.min(sp.type === 'penalty' ? 4.5 : 5.5, 1.5 + d * 3);
      p.dx = (tx - p.x) / d * s; p.dz = (tz - p.z) / d * s;
      p.sprint = false;
      sp.runT = (sp.runT || 0) + dt;
      if (sp.runT < (sp.type === 'kickoff' ? 0.6 : 2)) return;
    }
    if (!sp.pending.started) {
      sp.pending.started = true;
      p.heading = sp.aim;
      this.owner = p;
      p.startAction(sp.pending.type, { ...sp.pending.params, face: sp.aim, setpiece: true });
      sp.pending = null;
    }
  }

  // chamado no quadro do contato do chute de bola parada
  endSetpiece() {
    const sp = this.sp;
    this.phase = 'play';
    for (const p of this.wall || []) { p.inWall = false; if (Math.random() < 0.8) p.jumpT = 0.35; }
    this.wall = [];
    if (sp && sp.type === 'kickoff') this.emit('kickoff', {});
    this.lastSetpiece = sp;
    if (sp) sp.endT = this.time;
    this.sp = null;
  }

  // ----------------------------------------------------------- contato de ações
  onContact = (p, act) => {
    const t = act.type;
    const b = this.ball;
    if (t === 'throwin') {
      if (!act.data.kind) return;
      const tg = act.data.target || { x: p.x + Math.cos(act.data.face) * 12, z: p.z + Math.sin(act.data.face) * 12 };
      const long = act.data.kind === 'long';
      b.release(); this.holder = null;
      b.place(p.x + p.fx * 0.2, 2.1, p.z + p.fz * 0.2);
      const v = solveLob(b.p, { x: tg.x, y: 0.5, z: tg.z }, long ? 0.45 : 0.3, null, this.wind);
      b.kick(v.vx, v.vy, v.vz);
      if (this.phase === 'setpiece') this.endSetpiece();
      this.emit('kick', { power: 0.3, kind: 'throw' });
      this.afterKick(p, 'throwin', tg, act.data.receiver);
      return;
    }
    if (t === 'gk_throw' || t === 'gk_kick') {
      if (!this.ball.held || this.holder !== p) return;
      b.release(); this.holder = null; p.holdingBall = false;
      const tg = act.data.target;
      if (t === 'gk_throw') {
        b.place(p.x + p.fx * 0.5, 1.6, p.z + p.fz * 0.5);
        const v = solveLob(b.p, { x: tg.x, y: R, z: tg.z }, 0.12, null, this.wind);
        b.kick(v.vx, v.vy, v.vz);
        this.emit('kick', { power: 0.3, kind: 'throw' });
      } else {
        b.place(p.x + p.fx * 0.6, 0.5, p.z + p.fz * 0.6);
        const v = solveLob(b.p, { x: tg.x, y: R, z: tg.z }, 0.62, { top: -6 }, this.wind);
        b.kick(v.vx, v.vy, v.vz, v.wx, v.wy, v.wz);
        this.emit('kick', { power: 0.9, kind: 'gk' });
      }
      this.owner = null;
      this.afterKick(p, t === 'gk_throw' ? 'gk_throw' : 'long', tg, act.data.receiver);
      return;
    }
    if (t === 'tackle') {
      const d = Math.hypot(b.p.x - (p.x + p.fx * 0.8), b.p.z - (p.z + p.fz * 0.8));
      const o = this.owner;
      if (d < 1.15 && b.p.y < 0.6) {
        const skill = p.a.def / 99, drib = o ? o.a.dri / 99 : 0.3;
        const behind = o && Math.cos(angDiff(p.heading, o.heading)) > 0.6;
        const chance = clamp(0.55 + (skill - drib) * 0.8 - (o && o.shielding ? 0.2 : 0) - (behind ? 0.25 : 0), 0.12, 0.92);
        if (Math.random() < chance) {
          if (o) { o.cooldown = 0.5; o.stun = 0.25; }
          this.owner = null;
          if (Math.random() < 0.55 + skill * 0.3) this.takeBall(p, 'tackle');
          else { const a = p.heading + rand(-0.8, 0.8); b.kick(Math.cos(a) * 5, 0.3, Math.sin(a) * 5); this.touch(p, 'tackle'); }
          this.emit('tackle', { strength: 0.6 });
        } else if (o && behind && Math.random() < 0.45) {
          o.startAction('fall', {}); o.stun = 1.4;
          this.foul(p, o, Math.random() < 0.15 ? 2 : 1);
        } else { p.stun = 0.35; }
      } else p.stun = 0.25;
      return;
    }
    if (t === 'header') { this.doHeader(p, act); return; }
    if (!KICKS.has(t)) return;

    // chutes e passes
    const reach = this.owner === p || act.data.setpiece ? 1.7 : (t === 'volley' ? 1.3 : 1.15);
    const fx = p.x + p.fx * 0.45, fz = p.z + p.fz * 0.45;
    const d = Math.hypot(b.p.x - fx, b.p.z - fz);
    const maxY = t === 'volley' ? 1.4 : 0.75;
    if (d > reach || b.p.y > maxY || b.held) {
      if (act.data.setpiece && this.phase === 'setpiece') this.endSetpiece();
      return; // furou
    }
    if (act.data.setpiece && this.phase === 'setpiece') this.endSetpiece();
    this.executeKick(p, t, act.data);
  };

  onActionEnd = (p, act) => {
    if (act.type === 'fall') { p.startAction('getup', {}); }
    if (act.type === 'gk_dive') { p.startAction('getup', { variant: act.data.diveSide > 0 ? 1 : 0 }); if (!p.holdingBall) p.stun = 0.5; }
    if (act.type === 'gk_catch' && p.holdingBall) { /* segue segurando */ }
    if (act.type === 'slide' && !act.data.hitBall) p.stun = 0.3;
  };

  // Resolve o vetor do chute conforme o tipo e aplica erro de execução.
  executeKick(p, kind, data) {
    const b = this.ball;
    const power = clamp(data.power ?? 0.6, 0.05, 1.1);
    const a = p.a;
    const weak = (data.foot ?? p.foot) !== p.foot;
    const press = this.pressure(p);
    const moving = p.speed / PLAYER.sprintMax;
    const o = { x: b.p.x, y: b.p.y, z: b.p.z };
    const team = p.team;
    let v, tg = data.target, err = 0, kindOut = kind;
    const skill = p.team.human ? 1 : this.diff.aiSkill;

    const errBase = (attr) => (1.12 - attr / 99) * (1 + press * 0.8) * (weak ? 1.5 : 1) * (1 + moving * 0.3) / (0.75 + 0.25 * skill);

    if (kind === 'shot' || kind === 'finesse' || kind === 'volley' || kind === 'penalty' || kind === 'freekick') {
      const gx = this.goalX(team);
      tg = tg || this.autoShotTarget(p, power);
      const dist = Math.hypot(tg.x - o.x, tg.z - o.z);
      let speed, spin;
      if (kind === 'finesse') { speed = 17 + 9 * power; spin = { side: (data.foot ?? p.foot) * 42, top: 4 }; }
      else if (kind === 'penalty') { speed = 17 + 10 * power; spin = { side: 0, top: 3 }; }
      else if (kind === 'freekick') { speed = 19 + 9 * power; spin = { side: (data.foot ?? p.foot) * 55, top: 16 }; }
      else { speed = 19 + 14 * power; spin = { side: gauss() * 6, top: 6 + 12 * power }; }
      if (kind === 'volley') speed *= 0.92;
      // força demais: a bola sobe
      const over = Math.max(0, power - 0.88);
      const ty = clamp(tg.y + over * 6 + (dist > 25 ? 0.2 : 0), 0.15, 5);
      err = errBase(a.sho) * (kind === 'finesse' ? 0.75 : 1) * (0.8 + power * 0.5) * 0.05;
      const eAng = gauss() * err, eUp = gauss() * err * 0.7;
      const target = { x: tg.x, y: ty + eUp * dist, z: tg.z + eAng * dist };
      v = solveAim(o, target, speed, spin, this.wind);
      team.stats.shots++;
      this.lastShot = { p, t: this.time, speed, counted: false };
      this.emit('shot', { side: team.i, power });
      kindOut = 'shot';
    } else if (kind === 'chip') {
      tg = tg || this.autoShotTarget(p, 0.5);
      const target = { x: this.goalX(team) - team.dir * 0.6, y: 1.1, z: tg.z };
      v = solveLob(o, target, 0.72, { top: -10 }, this.wind);
      const e = errBase(a.sho) * 0.03;
      v.vx *= 1 + gauss() * e; v.vz *= 1 + gauss() * e;
      team.stats.shots++;
      this.lastShot = { p, t: this.time, speed: 14, counted: false };
      kindOut = 'chip';
    } else if (kind === 'pass' || kind === 'gk_pass') {
      tg = this.leadTarget(p, data.receiver, tg, 'ground');
      const arrive = lerp(4.5, 11, power);
      v = solveGround(o, tg, arrive);
      err = errBase(a.pas) * 0.03;
      rot(v, gauss() * err);
      team.stats.passes++;
    } else if (kind === 'through') {
      tg = this.leadTarget(p, data.receiver, tg, 'through', power);
      v = solveGround(o, tg, lerp(2.5, 6, power));
      err = errBase(a.pas) * 0.035;
      rot(v, gauss() * err);
      team.stats.passes++;
    } else if (kind === 'long' || kind === 'cross' || kind === 'clear') {
      tg = this.leadTarget(p, data.receiver, tg, 'air', power);
      const pitch = kind === 'cross' ? 0.36 : kind === 'clear' ? 0.62 : 0.5;
      const side = kind === 'cross' ? -(data.foot ?? p.foot) * 12 : 0;
      err = errBase(a.pas) * (kind === 'clear' ? 0.09 : 0.045);
      const d = Math.hypot(tg.x - o.x, tg.z - o.z);
      const t2 = { x: tg.x + gauss() * err * d, y: R, z: tg.z + gauss() * err * d };
      v = solveLob(o, t2, pitch, { side, top: -5 }, this.wind);
      if (kind !== 'clear') team.stats.passes++;
    }
    if (!v) return;
    b.kick(v.vx, v.vy, v.vz, v.wx, v.wy, v.wz);
    this.emit('kick', { src: kind, role: p.role, sp: this.lastSetpiece && this.time - (this.lastSetpiece.endT || 0) < 0.1 ? this.lastSetpiece.type : '', power: Math.min(1, Math.hypot(v.vx, v.vy, v.vz) / 32), kind: kindOut === 'shot' ? 'shot' : kind === 'volley' ? 'volley' : kind === 'chip' ? 'chip' : ['long', 'cross', 'clear'].includes(kind) ? 'long' : 'pass' });
    this.afterKick(p, kind, tg, data.receiver);
  }

  afterKick(p, kind, tg, receiver) {
    this.owner = null;
    p.cooldown = 0.3;
    this.lastKick = { p, kind, t: this.time, counted: false };
    this.touch(p, 'kick');
    if (this.noOffsideKick) { this.offside = null; this.noOffsideKick = false; }
    if (receiver && receiver.team === p.team) {
      this.passTarget = { p: receiver, x: tg.x, z: tg.z, t: this.time };
      if (p.team.human && receiver !== this.controlled) this.setControlled(receiver);
    } else this.passTarget = null;
  }

  // Alvo do passe considerando o movimento do companheiro.
  leadTarget(p, rec, tg, mode, power = 0.6) {
    if (!rec) return tg || { x: p.x + p.fx * 15, z: p.z + p.fz * 15 };
    const d = Math.hypot(rec.x - p.x, rec.z - p.z);
    const tFlight = mode === 'air' ? 0.6 + d / 22 : d / 13;
    let x = rec.x + rec.vx * tFlight * 0.85, z = rec.z + rec.vz * tFlight * 0.85;
    if (mode === 'through') {
      // à frente do atacante, rumo ao gol, no espaço
      const gx = this.goalX(rec.team);
      const ax = gx - rec.x, az = -rec.z * 0.35;
      const al = Math.hypot(ax, az) || 1;
      const lead = 5 + power * 9;
      const vs = Math.hypot(rec.vx, rec.vz);
      const ux = vs > 2 ? rec.vx / vs : ax / al, uz = vs > 2 ? rec.vz / vs : az / al;
      x = rec.x + ux * lead; z = rec.z + uz * lead;
    }
    return { x: clamp(x, -HL + 0.5, HL - 0.5), z: clamp(z, -HW + 0.5, HW - 0.5) };
  }

  autoShotTarget(p, power) {
    const team = p.team, gx = this.goalX(team);
    const gk = team.opp.gk;
    // canto mais longe do goleiro
    const side = gk.z > 0.3 ? -1 : gk.z < -0.3 ? 1 : (p.z > 0 ? -1 : 1);
    return { x: gx, y: 0.35 + power * 0.9, z: side * (GOAL.halfWidth - 0.55) };
  }

  pressure(p) {
    let m = 99;
    for (const q of p.team.opp.players) { if (q.sentOff) continue; m = Math.min(m, Math.hypot(q.x - p.x, q.z - p.z)); }
    return clamp(1 - (m - 0.8) / 3.5, 0, 1);
  }

  doHeader(p, act) {
    const b = this.ball;
    const jump = act.data.jump ?? 0.35;
    const hx = p.x + p.fx * 0.15, hz = p.z + p.fz * 0.15, hy = 1.72 + jump;
    const d = Math.hypot(b.p.x - hx, b.p.y - hy, b.p.z - hz);
    if (d > 0.85) return;
    const team = p.team;
    const incoming = b.speed();
    let tg = act.data.target;
    let v;
    if (act.data.kind === 'shot') {
      tg = tg || this.autoShotTarget(p, 0.2);
      const target = { x: tg.x, y: clamp(0.3 + gauss() * 0.4, 0.1, 2.8), z: tg.z + gauss() * (1.3 - p.a.sho / 99) * 1.4 };
      v = solveAim(b.p, target, clamp(11 + incoming * 0.35 + p.a.phy * 0.05, 11, 22), { top: 4 }, this.wind);
      team.stats.shots++;
      this.lastShot = { p, t: this.time, speed: 15, counted: false };
      this.emit('shot', { side: team.i, power: 0.6 });
    } else {
      tg = tg || { x: p.x + p.fx * 14, z: p.z + p.fz * 14 };
      if (act.data.receiver) tg = this.leadTarget(p, act.data.receiver, tg, 'air');
      v = solveLob(b.p, { x: tg.x, y: R, z: tg.z }, 0.35, null, this.wind);
      const cap = 16;
      const s = Math.hypot(v.vx, v.vy, v.vz);
      if (s > cap) { v.vx *= cap / s; v.vy *= cap / s; v.vz *= cap / s; }
    }
    if (this.owner) this.owner = null;
    b.kick(v.vx, v.vy, v.vz, v.wx || 0, v.wy || 0, v.wz || 0);
    this.emit('kick', { power: 0.5, kind: 'header' });
    this.afterKick(p, act.data.kind === 'shot' ? 'header' : 'hpass', tg, act.data.receiver);
  }

  // --------------------------------------------------------------- tempo
  checkClock() {
    const endMin = this.half === 1 ? 45 : this.half === 2 ? 90 : this.half === 3 ? 105 : 120;
    if (!this.stoppageSet && this.clock >= (endMin - 1) * 60) {
      this.stoppageSet = true;
      this.stoppage = this.extraTime ? 1 : Math.min(6, 1 + Math.floor(Math.random() * 3) + Math.floor(this.scorers.length / 2));
      this.emit('stoppage', { minutes: this.stoppage });
    }
    if (this.clock >= (endMin + this.stoppage) * 60) {
      // não encerra no meio de um ataque perigoso (até 12 s extras)
      const danger = this.threat > 0.55 && this.clock < (endMin + this.stoppage) * 60 + 12 * ((this.extraTime ? 900 : 2700) / this.halfReal);
      if (danger) return;
      this.endHalf();
    }
  }

  endHalf() {
    this.stoppageSet = false; this.stoppage = 0;
    this.owner = null; this.holder = null; this.ball.held = false;
    const h = this.half;
    const [a, b] = [this.teams[0].score, this.teams[1].score];
    if (h === 1 || h === 3) {
      this.phase = 'halftime';
      this.stopTimer = 4;
      this.emit('whistle', { kind: 'half' });
      this.emit('banner', { text: h === 1 ? 'INTERVALO' : 'FIM DO 1º TEMPO DA PRORROGAÇÃO', kind: 'period' });
    } else if (h === 2 && this.cfg.knockout && a === b) {
      this.phase = 'halftime';
      this.stopTimer = 4;
      this.emit('whistle', { kind: 'end' });
      this.emit('banner', { text: 'PRORROGAÇÃO', kind: 'period' });
    } else if (h === 4 && a === b) {
      this.phase = 'halftime';
      this.stopTimer = 4;
      this.emit('whistle', { kind: 'end' });
      this.emit('banner', { text: 'PÊNALTIS', kind: 'period' });
    } else {
      this.phase = 'fulltime';
      this.stopTimer = 4.5;
      this.emit('whistle', { kind: 'end' });
      this.emit('banner', { text: 'FIM DE JOGO', kind: 'period' });
    }
  }

  afterBreak() {
    if (this.phase === 'fulltime') { this.phase = 'ended'; this.emit('ended', { result: this.result() }); return; }
    const h = this.half;
    if (h === 4 || (h === 2 && this.extraTimeDone)) { this.startShootout(); return; }
    this.half++;
    if (this.half === 3) { this.extraTime = true; this.clock = 90 * 60; this.halfReal = Math.max(60, this.settings.halfMinutes * 20); }
    if (this.half === 2) this.clock = 45 * 60;
    if (this.half === 4) this.clock = 105 * 60;
    for (const t of this.teams) t.dir = -t.dir;
    for (const p of this.players) p.stamina = Math.min(1, p.stamina + (this.half === 2 ? 0.35 : 0.15));
    const kick = this.half % 2 === 0 ? this.teams[1 - this.firstKickoff] : this.teams[this.firstKickoff];
    this.setupKickoff(kick);
    this.emit('banner', { text: ['', '1º TEMPO', '2º TEMPO', '1º TEMPO DA PRORROGAÇÃO', '2º TEMPO DA PRORROGAÇÃO'][this.half], kind: 'period' });
  }

  // --------------------------------------------------------------- pênaltis
  startShootout() {
    this.phase = 'setpiece';
    this.shootout = { kicks: [[], []], turn: this.firstKickoff, order: [0, 0], wait: 0, active: false, done: false };
    this.lastKick = null;
    for (const t of this.teams) {
      t.shooters = t.players.filter(p => !p.sentOff && !p.isGK).sort((a, b) => b.a.sho - a.a.sho);
      t.shooters.push(t.gk);
    }
    // todos no círculo central; o gol usado é o leste (+x)
    this.teams[0].dir = 1; this.teams[1].dir = 1;
    this.placeShootoutPlayers();
    this.nextPenalty();
  }

  placeShootoutPlayers() {
    for (const t of this.teams) t.players.forEach((p, k) => {
      if (p.sentOff) return;
      const a = (k / 11) * Math.PI - (t.i ? Math.PI : 0);
      p.teleport(Math.cos(a) * 5, Math.sin(a) * 5, 0);
    });
  }

  nextPenalty() {
    const so = this.shootout;
    const t = this.teams[so.turn];
    const taker = t.shooters[so.order[so.turn] % t.shooters.length];
    so.order[so.turn]++;
    this.placeShootoutPlayers();
    this.lastKick = null; so.startT = this.time;
    // o goleiro do outro time no gol leste; o time que cobra "ataca" +x
    this.teams[so.turn].dir = 1; this.teams[1 - so.turn].dir = -1;
    so.wait = 0; so.active = true; so.kickT = null;
    this.phase = 'play';
    this.setupRestart({ type: 'penalty', team: t, taker, shootout: true });
  }

  shootoutStep(dt) {
    const so = this.shootout;
    if (!so || so.done || !so.active) return;
    if (this.phase === 'goal') {
      // conta o gol da disputa sem comemoração longa
      this.phase = 'play';
    }
    if (so.kickT === null && this.lastKick && this.lastKick.t > (so.startT || 0) && this.phase === 'play') so.kickT = this.time;
    if (so.kickT !== null) {
      const b = this.ball.p;
      const scored = Math.abs(b.x) > HL + R && Math.abs(b.z) < GOAL.halfWidth && b.y < GOAL.height;
      const dead = this.time - so.kickT > 3.2 || (this.ball.hspeed() < 0.5 && this.time - so.kickT > 1.2) || this.owner === this.teams[1 - so.turn].gk || Math.abs(b.x) > HL + 0.5 && !scored;
      if (scored || dead) {
        so.active = false;
        so.kicks[so.turn].push(scored);
        this.emit(scored ? 'penaltyGoal' : 'penaltyMiss', { side: so.turn });
        this.emit('crowd', { kind: scored ? 'goal' : 'ooh', strength: scored ? 0.7 : 0.8, side: so.turn });
        if (scored) this.emit('netImpact', { sign: 1, strength: 0.8 });
        so.wait = 2.2;
        so.pending = true;
      }
    }
  }

  shootoutAdvance(dt) {
    const so = this.shootout;
    if (!so || !so.pending) return;
    so.wait -= dt;
    if (so.wait > 0) return;
    so.pending = false;
    const [a, b] = so.kicks;
    const ga = a.filter(Boolean).length, gb = b.filter(Boolean).length;
    const na = a.length, nb = b.length;
    let over = false;
    if (na <= 5 && nb <= 5) {
      if (ga > gb + (5 - nb)) over = true;
      if (gb > ga + (5 - na)) over = true;
      if (na === 5 && nb === 5 && ga !== gb) over = true;
    } else if (na === nb && ga !== gb) over = true;
    if (over) {
      so.done = true;
      this.pens = { home: ga, away: gb };
      this.phase = 'fulltime';
      this.stopTimer = 4;
      this.emit('whistle', { kind: 'end' });
      this.emit('banner', { text: (ga > gb ? this.teams[0] : this.teams[1]).data.name.toUpperCase() + ' VENCE', sub: `Pênaltis ${ga} x ${gb}`, kind: 'period' });
      return;
    }
    so.turn = 1 - so.turn;
    so.startT = this.time;
    this.lastKick = null;
    this.nextPenalty();
  }

  // --------------------------------------------------------------- utilidades
  // finalização no alvo = virou gol ou exigiu defesa do goleiro
  shotOnTarget(team) {
    const ls = this.lastShot;
    if (!ls || ls.counted || this.time - ls.t > 4 || ls.p.team !== team) return;
    ls.counted = true;
    team.stats.onTarget++;
  }

  // o humano sempre controla alguém: o mais perto da bola
  controlNearest() {
    const t = this.userTeam;
    if (!t) return;
    const b = this.ball.p;
    let best = null, bd = 1e9;
    for (const p of t.players) { if (p.sentOff || p.isGK) continue; const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd) { bd = d; best = p; } }
    if (best) this.setControlled(best);
  }

  setControlled(p) {
    if (this.controlled === p) return;
    if (this.controlled) this.controlled.human = false;
    this.controlled = p;
    if (p) { p.human = true; p.queued = null; }
    this.emit('switch', { idx: p ? p.idx : -1 });
  }

  updateThreat(dt) {
    const b = this.ball.p;
    let th = 0;
    for (const t of this.teams) {
      const gx = this.goalX(t);
      const d = Math.hypot(gx - b.x, b.z);
      const has = (this.owner && this.owner.team === t) || (!this.owner && this.lastTouch && this.lastTouch.team === t);
      if (has) th = Math.max(th, clamp(1 - (d - 8) / 32, 0, 1));
    }
    if (this.phase !== 'play') th *= 0.5;
    this.threat += (th - this.threat) * Math.min(1, dt * 2);
    const ex = 0.25 + this.threat * 0.7;
    this.excitement += (ex - this.excitement) * Math.min(1, dt * 1.2);
  }

  result() {
    const [h, a] = this.teams;
    const tot = h.stats.possession + a.stats.possession || 1;
    const pair = k => [h.stats[k], a.stats[k]];
    return {
      homeGoals: h.score, awayGoals: a.score,
      pens: this.pens || undefined,
      scorers: this.scorers,
      stats: {
        possession: [Math.round(h.stats.possession / tot * 100), Math.round(a.stats.possession / tot * 100)],
        shots: pair('shots'), onTarget: pair('onTarget'), fouls: pair('fouls'), corners: pair('corners'),
        offsides: pair('offsides'), yellow: pair('yellow'), red: pair('red'),
        passes: pair('passes'),
        passAcc: [h, a].map(t => t.stats.passes ? Math.round(t.stats.passOk / t.stats.passes * 100) : 0),
      },
    };
  }
}

function rot(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const x = v.vx * c - v.vz * s, z = v.vx * s + v.vz * c;
  v.vx = x; v.vz = z;
}
