// Motor da partida do LANCE A LANCE.
// Simulação por agentes em passo fixo: 22 jogadores com posição/velocidade/energia, bola com física
// (rolando e no ar), decisões do portador (passe, condução, chute, cruzamento, chutão), desarmes,
// faltas, cartões, impedimento, bolas paradas e relógio com acréscimos.
//
// Regras do módulo: NADA de DOM/canvas aqui (roda nos testes em Node) e toda aleatoriedade vem do
// RNG com semente, então a partida é reproduzível.
import { PITCH, SIM, RESTART_DELAY, FORMATIONS, DEFAULT_TACTICS } from './config.js';
import { createRng } from './rng.js';
import { pickLineup, slotFit, matchKits } from './teams.js';
import { commentary } from './commentary.js';

const { halfL: L, halfW: W, goalHalfW: GW } = PITCH;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hyp = Math.hypot;
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

// ---------- modelos auxiliares (exportados para teste) ----------

/** Ângulo (rad) com que o ponto (u, v) "enxerga" o gol adversário (em u = +L). */
export function goalAngle(u, v) {
  const dx = L - u;
  if (dx <= 0.05) return 0.05;
  return Math.abs(Math.atan2(v + GW, dx) - Math.atan2(v - GW, dx));
}
/** Gols esperados de um chute de pé em (u, v) antes de ajustes de habilidade e pressão. */
export function baseXG(u, v) {
  const d = hyp(L - u, v);
  return sigmoid(-1.12 + 2.5 * goalAngle(u, v) - 0.08 * d);
}
/** Valor posicional de ter a bola em (u, v): ameaça + progresso no campo. */
export function posValue(u, v) {
  // pela ponta no último terço vale mais: é de onde sai o cruzamento
  const wing = u > L - 30 && Math.abs(v) > 10 ? 0.03 * (u - (L - 30)) / 30 : 0;
  return threat(u, v) + 0.075 * (u + L) / (2 * L) + wing;
}

/** Velocidade inicial de um passe rasteiro de d metros (m/s). Passes reais saem a ~12–22 m/s. */
export function passSpeed(d) { return clamp(8.5 + 0.42 * d, 9, 23); }
/** Tempo aproximado para a bola rasteira percorrer d metros com velocidade inicial v0. */
function rollTime(d, v0) {
  const a = SIM.rollDecel + SIM.rollDrag * v0 * v0 * 0.6;
  const disc = v0 * v0 - 2 * a * d;
  return disc > 0 ? (v0 - Math.sqrt(disc)) / a : d / (v0 * 0.5);
}

/** "Ameaça" de ter a bola em (u, v): cresce perto do gol (parecido com xT). */
export function threat(u, v) {
  const dg = hyp(L - u, v * 1.15);
  return 0.008 + 0.45 * Math.exp(-dg / 10) + 0.09 * Math.exp(-dg / 30);
}

function newPlayerStats() {
  return { goals: 0, assists: 0, shots: 0, sot: 0, passes: 0, passOk: 0, keyPasses: 0, tackles: 0, interceptions: 0, saves: 0, fouls: 0, fouled: 0, dribbles: 0, conceded: 0, yellow: 0, red: 0, offsides: 0 };
}
function newTeamStats() {
  return { goals: 0, shots: 0, onTarget: 0, xg: 0, passes: 0, passOk: 0, crosses: 0, crossOk: 0, possTicks: 0, fouls: 0, yellow: 0, red: 0, corners: 0, offsides: 0, saves: 0, tackles: 0, bigChances: 0 };
}

// ---------- partida ----------

export class Match {
  /**
   * @param {object} o
   * @param {object} o.home  time (teams.js)
   * @param {object} o.away
   * @param {number|string} [o.seed]
   * @param {object} [o.tactics] [táticasMandante, táticasVisitante]
   * @param {number|null} [o.userSide] 0, 1 ou null (quem o usuário comanda; o outro é da IA)
   */
  constructor({ home, away, seed = Date.now(), tactics = null, userSide = null, halfPhysical = SIM.halfPhysical }) {
    if (!home || !away || home.id === away.id) throw new Error('Partida precisa de dois times diferentes');
    this.seed = seed;
    this.rng = createRng(seed);
    this.H = halfPhysical;
    this.K = (45 * 60) / halfPhysical;
    this.userSide = userSide;
    const kits = matchKits(home, away);
    this.teams = [home, away].map((def, side) => this._makeTeam(def, side, kits[side], tactics?.[side] ?? def.tactics ?? DEFAULT_TACTICS));
    this.teams[0].opp = this.teams[1];
    this.teams[1].opp = this.teams[0];
    this.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, px: 0, py: 0, pz: 0, owner: null, ownerSince: 0, last: null, lastTeam: null, pass: null, shot: null, held: false, assist: null };
    this.period = 1;
    this.tp = 0;          // tempo físico no período
    this.tAll = 0;        // tempo físico total
    this.tick = 0;
    this.phase = 'play';  // play | halftime | ended
    this.dead = null;
    this.added = [0, 0];
    this.addedAnnounced = false;
    this.stoppage = 0;
    this.events = [];
    this.fx = [];
    this.momentum = new Float32Array(130);
    this.heat = [new Float32Array(24 * 16), new Float32Array(24 * 16)];
    this._predict = [];
    this._predictTick = -1;
    this.kickoffFirst = this.rng.chance(0.5) ? 0 : 1;
    this._aiNext = [0, 0];
    this._setDead('kickoff', this.teams[this.kickoffFirst], 0, 0, RESTART_DELAY.kickoff);
    this._event('kickoff', null, commentary('kickoff', { home: home.name, away: away.name }, this.rng));
  }

  _makeTeam(def, side, kit, tactics) {
    const t = {
      side, def, kit, tactics: { ...DEFAULT_TACTICS, ...tactics }, dir: side === 0 ? 1 : -1,
      score: 0, subsLeft: SIM.maxSubs, onPitch: [], bench: [], out: [], stats: newTeamStats(), offLine: 0, lineU: -30,
    };
    const xi = pickLineup(def, t.tactics.formation);
    const slots = ['GOL', ...FORMATIONS[t.tactics.formation].map((s) => s[0])];
    const anchors = [[-1.5, 0], ...FORMATIONS[t.tactics.formation].map((s) => [s[1], s[2]])];
    xi.forEach((pd, i) => t.onPitch.push(this._makePlayer(pd, t, slots[i], anchors[i], 0)));
    const ids = new Set(xi.map((p) => p.id));
    t.bench = def.players.filter((p) => !ids.has(p.id)).map((pd) => ({ d: pd, used: false }));
    // posições iniciais: metade própria
    for (const p of t.onPitch) {
      const [u, v] = this._kickoffSpot(p);
      p.x = p.px = u * t.dir; p.y = p.py = v;
    }
    return t;
  }

  _makePlayer(d, team, slot, anchor, enteredMin) {
    return {
      d, team, slot, au: anchor[0], av: anchor[1], isGK: slot === 'GOL',
      x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, tx: 0, ty: 0, sprint: false,
      energy: 1, yellow: 0, off: false, cool: 0, beaten: 0, runT: 0, runCool: 0, runX: 0, runY: 0,
      wx: 0, wy: 0, wanderT: 0, reposT: 0, rx: 0, ry: 0, decideT: 0, carryX: 0, carryY: 0, carrySprint: false,
      entered: enteredMin, left: null, st: newPlayerStats(),
    };
  }

  // ---------- relógio ----------
  get minuteFloat() { return (this.period - 1) * 45 + (this.tp * this.K) / 60; }
  get clockLabel() {
    const m = this.minuteFloat;
    const cap = this.period * 45;
    if (m >= cap) return `${cap}+${Math.max(1, Math.ceil(m - cap))}'`;
    return `${Math.floor(m) + 1}'`;
  }
  get clockMMSS() {
    const secs = Math.floor(this.tp * this.K) + (this.period - 1) * 2700;
    const mm = Math.floor(secs / 60), ss = secs % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  get finished() { return this.phase === 'ended'; }

  _event(type, team, text, extra = {}) {
    const ev = { i: this.events.length, type, side: team ? team.side : null, minute: this.minuteFloat, label: this.clockLabel, text, ...extra };
    this.events.push(ev);
    return ev;
  }

  // ---------- API do usuário ----------

  setTactics(side, patch) {
    const t = this.teams[side];
    if (!t || this.finished) return false;
    const next = { ...t.tactics };
    if (patch.mentality !== undefined) next.mentality = clamp(Math.round(patch.mentality), -2, 2);
    if (patch.pressing !== undefined) next.pressing = clamp(Math.round(patch.pressing), 0, 2);
    if (patch.tempo !== undefined) next.tempo = clamp(Math.round(patch.tempo), 0, 2);
    if (patch.formation !== undefined && FORMATIONS[patch.formation] && patch.formation !== t.tactics.formation) {
      next.formation = patch.formation;
      this._applyFormation(t, patch.formation);
      this._event('formation', t, commentary('formation', { team: t.def.name, what: patch.formation }, this.rng));
    }
    const changedPost = next.mentality !== t.tactics.mentality;
    t.tactics = next;
    if (changedPost) {
      const label = ['retranca', 'mais defensivo', 'equilibrado', 'mais ofensivo', 'tudo ao ataque'][next.mentality + 2];
      this._event('tactic', t, commentary('tactic', { team: t.def.name, what: label }, this.rng));
    }
    return true;
  }

  /** Redistribui as vagas da formação entre os jogadores em campo (goleiro fica). */
  _applyFormation(t, formation) {
    const slots = FORMATIONS[formation];
    const field = t.onPitch.filter((p) => !p.isGK);
    const free = slots.map((s, i) => i);
    // vagas mais "raras" primeiro, cada uma pega o jogador que melhor encaixa
    const rar = (c) => ({ LE: 1, LD: 1, PE: 2, PD: 2, ZAG: 3, ATA: 4, VOL: 5, MEI: 6, MC: 7 }[c] ?? 9);
    free.sort((a, b) => rar(slots[a][0]) - rar(slots[b][0]));
    const taken = new Set();
    for (const si of free) {
      let best = null, bs = -1;
      for (const p of field) {
        if (taken.has(p)) continue;
        const sc = slotFit(p.d.pos, slots[si][0]) * 100 - hyp(p.au - slots[si][1], p.av - slots[si][2]) * 4;
        if (sc > bs) { bs = sc; best = p; }
      }
      if (!best) break;
      taken.add(best);
      best.slot = slots[si][0]; best.au = slots[si][1]; best.av = slots[si][2];
    }
  }

  /** Troca jogador. Retorna { ok, error }. */
  substitute(side, outId, inId) {
    const t = this.teams[side];
    if (!t || this.finished) return { ok: false, error: 'Partida encerrada' };
    if (t.subsLeft <= 0) return { ok: false, error: 'Sem substituições restantes' };
    const outP = t.onPitch.find((p) => p.d.id === outId);
    if (!outP) return { ok: false, error: 'Jogador não está em campo' };
    const b = t.bench.find((x) => x.d.id === inId);
    if (!b || b.used) return { ok: false, error: 'Reserva indisponível' };
    if (outP.isGK !== (b.d.pos === 'GOL') && t.bench.some((x) => !x.used && (x.d.pos === 'GOL') === outP.isGK)) {
      // permite, mas só quando não há alternativa natural; aqui existe, então avisa
      return { ok: false, error: outP.isGK ? 'Goleiro só sai para outro goleiro' : 'Goleiro reserva só entra no lugar do goleiro' };
    }
    const minute = Math.min(this.minuteFloat, 120);
    const inP = this._makePlayer(b.d, t, outP.slot, [outP.au, outP.av], minute);
    inP.isGK = outP.isGK;
    inP.x = inP.px = outP.x; inP.y = inP.py = outP.y;
    if (this.ball.owner === outP) { this.ball.owner = inP; }
    if (this.ball.last === outP) this.ball.last = inP;
    outP.left = minute;
    t.out.push(outP);
    t.onPitch[t.onPitch.indexOf(outP)] = inP;
    b.used = true;
    t.subsLeft--;
    this.stoppage += 0.2;
    this._event('sub', t, commentary('sub', { team: t.def.name, out: outP.d.name, in: b.d.name }, this.rng), { outId, inId });
    return { ok: true };
  }

  resumeSecondHalf() {
    if (this.phase !== 'halftime') return;
    this.phase = 'play';
    this.period = 2;
    this.tp = 0;
    this.addedAnnounced = false;
    this.stoppage = 0;
    for (const t of this.teams) {
      t.dir = -t.dir;
      for (const p of t.onPitch) {
        p.energy = Math.min(1, p.energy + 0.1);
        const [u, v] = this._kickoffSpot(p);
        p.x = p.px = u * t.dir; p.y = p.py = v; p.vx = p.vy = 0; p.runT = 0;
      }
    }
    this._resetBall(0, 0);
    this._setDead('kickoff', this.teams[1 - this.kickoffFirst], 0, 0, RESTART_DELAY.kickoff);
    this._event('secondHalf', null, commentary('secondHalf', {}, this.rng));
  }

  /** Simula até o fim (intervalo incluso). Seguro contra laço infinito. */
  runToEnd() {
    let guard = 0;
    while (!this.finished && guard++ < 200000) {
      if (this.phase === 'halftime') this.resumeSecondHalf();
      else this.step();
    }
  }

  // ---------- passo ----------

  step() {
    if (this.phase !== 'play') return;
    const dt = SIM.dt;
    this.tick++;
    this.tp += dt;
    this.tAll += dt;
    const b = this.ball;
    b.px = b.x; b.py = b.y; b.pz = b.z;
    for (const t of this.teams) for (const p of t.onPitch) { p.px = p.x; p.py = p.y; }

    this._updateLines();
    if (this.dead) this._deadTargets();
    else this._playTargets(dt);

    if (!this.dead && b.owner && !b.shot) {
      b.owner.decideT -= dt;
      if (b.owner.decideT <= 0) this._decide(b.owner);
    }
    this._movePlayers(dt);

    if (this.dead) this._updateDead(dt);
    else {
      this._updateBall(dt);
      if (!this.dead && b.shot) { if (this.tAll >= b.shot.resolveAt) this._resolveShot(); }
      else if (!this.dead) {
        if (b.owner) this._tackles(dt);
        else this._freeBallControl();
        if (!this.dead) this._checkOut();
      }
    }
    this._accumulate(dt);
    this._clock();
    if (this.tick % 20 === 0) { this._aiManager(0); this._aiManager(1); }
    if (this.fx.length && this.tAll - this.fx[0].t > 4) this.fx.shift();
  }

  // ---------- linhas / impedimento ----------

  _updateLines() {
    for (const t of this.teams) {
      // linha de impedimento que os atacantes de t enfrentam: penúltimo adversário (no referencial de t)
      let a = -Infinity, bb = -Infinity;
      for (const o of t.opp.onPitch) {
        const u = o.x * t.dir;
        if (u > a) { bb = a; a = u; } else if (u > bb) bb = u;
      }
      const ballU = this.ball.x * t.dir;
      t.offLine = Math.max(bb, 0, ballU);
    }
  }
  _isOffside(p) {
    const t = p.team;
    const u = p.x * t.dir;
    return u > 0 && u > this.ball.x * t.dir + 0.3 && u > t.offLine + 0.35;
  }

  // ---------- alvos (IA coletiva) ----------

  _possTeam() {
    const b = this.ball;
    if (b.owner) return b.owner.team;
    if (b.pass) return b.pass.from.team;
    return b.lastTeam;
  }

  _playTargets(dt) {
    const b = this.ball;
    const pt = this._possTeam();
    const free = !b.owner && !b.shot;
    if (free) this._predictBall();
    for (const t of this.teams) {
      const dir = t.dir, tac = t.tactics, ment = tac.mentality;
      const uBall = b.x * dir, vBall = b.y;
      const inPoss = t === pt && !free ? true : t === pt && free && b.pass != null;
      let center, S, Wd, shiftV;
      if (inPoss) {
        center = clamp(uBall * 0.6 + 6 + 4 * ment, -18, 26); S = 40; Wd = 62; shiftV = vBall * 0.18;
      } else {
        center = clamp(uBall * 0.55 - 9 + 3 * ment + (tac.pressing - 1) * 4, -30, 14); S = 30; Wd = 44; shiftV = vBall * 0.35;
      }
      let lineU = center - S / 2;
      if (!inPoss) lineU = Math.min(lineU, uBall - 3);
      lineU = clamp(lineU, -46, inPoss ? 12 + ment * 5 : 10);
      t.lineU = lineU;
      const owner = b.owner;
      // pressão
      let press1 = null, press2 = null;
      if (!inPoss && owner && owner.team !== t) {
        let d1 = Infinity, d2 = Infinity;
        for (const p of t.onPitch) {
          if (p.isGK) continue;
          const d = hyp(p.x - owner.x, p.y - owner.y);
          if (d < d1) { d2 = d1; press2 = press1; d1 = d; press1 = p; } else if (d < d2) { d2 = d; press2 = p; }
        }
        const zoneOk = tac.pressing === 2 ? uBall > -25 : tac.pressing === 1 ? uBall < -22 || d2 < 6 : d2 < 4;
        if (!zoneOk) press2 = null;
        if (tac.pressing === 0 && uBall > 5 && d1 > 8) press1 = null; // pressão baixa: só acompanha
      }
      // perseguidor de bola solta
      let chaser = null, chaserPt = null;
      if (free) {
        let best = Infinity;
        const cands = b.pass && b.pass.from.team === t ? [b.pass.to] : t.onPitch;
        for (const p of cands) {
          if (!p || p.off) continue;
          if (p.isGK && !this._inOwnBox(p.team, b.x, b.y) && hyp(p.x - b.x, p.y - b.y) > 6) continue;
          const r = this._interceptFor(p);
          if (r.t < best) { best = r.t; chaser = p; chaserPt = r; }
        }
        // se o passe for para um companheiro, o adversário só corre se chegar a tempo
        if (b.pass && b.pass.from.team !== t && chaser) {
          const recv = b.pass.to && this._interceptFor(b.pass.to);
          if (recv && best > recv.t + 0.8) chaser = null;
        }
      }
      for (const p of t.onPitch) {
        p.sprint = false;
        p.runCool -= dt; p.wanderT -= dt; p.reposT -= dt;
        if (p.cool > 0) p.cool -= dt;
        if (p.beaten > 0) p.beaten -= dt;
        if (p === owner) continue; // portador segue a própria decisão
        if (p === chaser) { p.tx = chaserPt.x; p.ty = chaserPt.y; p.sprint = true; continue; }
        if (p.isGK) { this._gkTarget(p, t, uBall, vBall); continue; }
        if (p === press1 || p === press2) {
          // chega pelo lado do gol (entre o portador e o próprio gol)
          const gx = -L * dir;
          const dx = gx - owner.x, dy = -owner.y * 0.5, dl = hyp(dx, dy) || 1;
          const off = p === press1 ? 0.9 : 3.5;
          p.tx = owner.x + (dx / dl) * off; p.ty = owner.y + (dy / dl) * off + (p === press2 ? Math.sign(owner.y || 1) * -2 : 0);
          p.sprint = true;
          continue;
        }
        let u = center + p.au * (S / 2);
        let v = p.av * (Wd / 2) + shiftV;
        if (p.au <= -0.9) u = lineU + (p.au + 1) * 3;
        if (inPoss) {
          if ((p.slot === 'LE' || p.slot === 'LD') && ment >= 1) u += 5 + ment * 2;
          if (p.au > 0.3) u = Math.min(u, t.offLine - 1.0);
          // bola pela ponta no último terço: atacantes e meias ocupam a área
          if (owner && owner.team === t && uBall > L - 32 && Math.abs(vBall) > 10 && p.au > 0.2 && p !== owner) {
            const k = this._rankInTeam(p, (q) => -q.au);
            const spots = [[L - 6, -Math.sign(vBall) * 1.5], [L - 9, -Math.sign(vBall) * 7], [L - 12, 0], [L - 17, Math.sign(vBall) * 4]];
            if (k < spots.length) { [u, v] = spots[k]; u = Math.min(u, t.offLine - 0.6); p.rx = p.ry = 0; p.sprint = true; }
          }
          // corrida em profundidade
          if (p.runT > 0) {
            p.runT -= dt;
            u = p.runX; v = p.runY; p.sprint = true;
            if (p.runT <= 0) p.runCool = 2 + this.rng.next() * 2;
          } else if (owner && owner.team === t && p.au > 0.1 && p.runCool <= 0 && owner.x * dir > -8) {
            const rate = (0.18 + 0.1 * tac.tempo + 0.05 * ment) * dt;
            if (this.rng.chance(rate)) {
              p.runT = 1.8 + this.rng.next() * 1.2;
              p.runX = clamp(t.offLine + 7 + this.rng.next() * 10, -L, L - 6);
              p.runY = clamp(p.y * 0.6 + this.rng.range(-8, 8), -W + 4, W - 4);
              u = p.runX; v = p.runY; p.sprint = true;
            }
          }
          // procura espaço livre de tempos em tempos
          if (p.runT <= 0) {
            if (p.reposT <= 0) {
              p.reposT = 0.5 + this.rng.next() * 0.4;
              let bo = -1; p.rx = 0; p.ry = 0;
              for (const [ox, oy] of [[0, 0], [4, 0], [-4, 0], [0, 5], [0, -5], [3, 3], [3, -3]]) {
                const cx = u + ox, cy = v + oy;
                const open = Math.min(9, this._nearestOppDist(t, cx * dir, cy)) - hyp(ox, oy) * 0.12;
                if (open > bo) { bo = open; p.rx = ox; p.ry = oy; }
              }
            }
            u += p.rx; v += p.ry;
          }
        } else {
          p.runT = 0;
          // marcação por zona: puxa para o adversário mais próximo da zona, pelo lado do gol
          let near = null, nd = 10;
          const axw = u * dir, ayw = v;
          for (const o of t.opp.onPitch) {
            if (o.isGK) continue;
            const d = hyp(o.x - axw, o.y - ayw);
            if (d < nd) { nd = d; near = o; }
          }
          if (near) {
            const w = p.au < -0.5 ? 0.55 : 0.4;
            const mu = near.x * dir - 1.8, mv = near.y * 0.92;
            u = u + (mu - u) * w; v = v + (mv - v) * w;
            if (p.au <= -0.9) u = Math.max(u, lineU - 6);
          }
        }
        // pequena variação individual para o movimento não ficar robótico
        if (p.wanderT <= 0) { p.wanderT = 1.5 + this.rng.next() * 2; p.wx = this.rng.range(-1.5, 1.5); p.wy = this.rng.range(-1.5, 1.5); }
        u += p.wx; v += p.wy;
        p.tx = clamp(u, -L + 1, L - 1) * dir;
        p.ty = clamp(v, -W + 1, W - 1);
        if (hyp(p.tx - p.x, p.ty - p.y) > 9) p.sprint = true;
      }
    }
  }

  _gkTarget(p, t, uBall, vBall) {
    const b = this.ball;
    if (b.shot && b.shot.gk === p) {
      p.tx = b.shot.gkX; p.ty = b.shot.gkY; p.sprint = true; return;
    }
    const inPoss = this._possTeam() === t && b.owner;
    let u = -L + 1.2 + clamp((uBall + L) * 0.05, 0, inPoss ? 14 : 5);
    let v = clamp(vBall * 0.12, -2.8, 2.8);
    p.tx = u * t.dir; p.ty = v;
  }

  _nearestOppDist(t, x, y) {
    let m = Infinity;
    for (const o of t.opp.onPitch) { const d = hyp(o.x - x, o.y - y); if (d < m) m = d; }
    return m;
  }
  _nearestOpp(p) {
    let m = Infinity, q = null;
    for (const o of p.team.opp.onPitch) { const d = hyp(o.x - p.x, o.y - p.y); if (d < m) { m = d; q = o; } }
    return [q, m];
  }
  _inOwnBox(t, x, y) {
    const u = x * t.dir;
    return u < -L + PITCH.boxDepth && Math.abs(y) < PITCH.boxHalfW;
  }
  _vmax(p) {
    const base = 5.6 + (3.2 * p.d.attrs.pace) / 99;
    return base * (0.8 + 0.2 * p.energy);
  }

  // previsão da trajetória da bola solta (para interceptação)
  _predictBall() {
    if (this._predictTick === this.tick) return;
    this._predictTick = this.tick;
    const b = this.ball;
    const out = this._predict; out.length = 0;
    let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
    const h = 0.1;
    for (let k = 1; k <= 30; k++) {
      if (z > 0 || vz > 0) {
        vz -= SIM.gravity * h; z += vz * h;
        if (z <= 0) { z = 0; vz = Math.abs(vz) > 2 ? -vz * SIM.bounce : 0; vx *= 0.8; vy *= 0.8; }
      } else {
        const s = hyp(vx, vy);
        if (s > 0) {
          const ns = Math.max(0, s - (SIM.rollDecel + SIM.rollDrag * s * s) * h);
          vx *= ns / s; vy *= ns / s;
        }
      }
      x += vx * h; y += vy * h;
      out.push({ t: k * h, x, y, z });
    }
  }
  _interceptFor(p) {
    const pr = this._predict;
    const vm = this._vmax(p);
    for (const q of pr) {
      if (q.z > 2.2) continue;
      const d = hyp(q.x - p.x, q.y - p.y) - 0.8;
      if (d <= vm * Math.max(0, q.t - 0.15)) return { x: q.x, y: q.y, t: q.t };
    }
    const last = pr[pr.length - 1] || { x: this.ball.x, y: this.ball.y };
    return { x: last.x, y: last.y, t: 3 + hyp(last.x - p.x, last.y - p.y) / vm };
  }

  // ---------- movimento ----------

  _movePlayers(dt) {
    const all = [];
    for (const t of this.teams) for (const p of t.onPitch) all.push(p);
    const b = this.ball;
    for (const p of all) {
      const isOwner = b.owner === p;
      let tx = p.tx, ty = p.ty, sprint = p.sprint;
      if (isOwner) { tx = p.carryX; ty = p.carryY; sprint = p.carrySprint; }
      let vm = this._vmax(p);
      if (isOwner) vm *= 0.8 + (0.12 * p.d.attrs.dribbling) / 99;
      if (p.beaten > 0) vm *= 0.45;
      const want = sprint ? vm : vm * 0.62;
      const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
      let dvx, dvy;
      if (d < 0.25) { dvx = -p.vx; dvy = -p.vy; }
      else {
        const s = Math.min(want, d * 1.8);
        dvx = (dx / d) * s - p.vx; dvy = (dy / d) * s - p.vy;
      }
      const dl = hyp(dvx, dvy);
      const acc = (dl > 0 && (dvx * p.vx + dvy * p.vy) < 0 ? 8.5 : 5.2) * (0.75 + 0.25 * p.energy) * dt;
      if (dl > acc) { dvx *= acc / dl; dvy *= acc / dl; }
      p.vx += dvx; p.vy += dvy;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = clamp(p.x, -L - 2, L + 2); p.y = clamp(p.y, -W - 1.5, W + 1.5);
      // energia
      const sp = hyp(p.vx, p.vy) / (vm || 1);
      const drain = (0.00026 + 0.0011 * sp * sp) * (1.35 - (0.7 * p.d.attrs.stamina) / 99);
      p.energy = Math.max(0.3, p.energy - drain * dt);
    }
    // separação (evita bolinhas sobrepostas)
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      for (let j = i + 1; j < all.length; j++) {
        const c = all[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = a.team === c.team ? 1.6 : 0.9;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (min - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          if (b.owner !== a) { a.x -= nx * push; a.y -= ny * push; }
          if (b.owner !== c) { c.x += nx * push; c.y += ny * push; }
        }
      }
    }
  }

  // ---------- bola ----------

  _updateBall(dt) {
    const b = this.ball;
    if (b.owner) {
      const o = b.owner;
      const s = hyp(o.vx, o.vy);
      let hx, hy;
      if (s > 0.4) { hx = o.vx / s; hy = o.vy / s; } else { hx = o.team.dir; hy = 0; }
      const lead = b.held ? 0.3 : 0.55 + Math.min(0.4, s * 0.04);
      b.x = o.x + hx * lead; b.y = o.y + hy * lead; b.z = b.held ? 1.0 : 0;
      b.vx = o.vx; b.vy = o.vy; b.vz = 0;
      return;
    }
    if (b.z > 0 || b.vz > 0) {
      b.vz -= SIM.gravity * dt;
      const s = hyp(b.vx, b.vy);
      const k = Math.max(0, 1 - SIM.airDrag * s * dt);
      b.vx *= k; b.vy *= k;
      b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -2) { b.vz = -b.vz * SIM.bounce; b.vx *= 0.8; b.vy *= 0.8; } else b.vz = 0;
      }
    } else {
      const s = hyp(b.vx, b.vy);
      if (s > 0) {
        const ns = Math.max(0, s - (SIM.rollDecel + SIM.rollDrag * s * s) * dt);
        b.vx *= ns / s; b.vy *= ns / s;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
  }

  _resetBall(x, y) {
    const b = this.ball;
    Object.assign(b, { x, y, z: 0, vx: 0, vy: 0, vz: 0, px: x, py: y, pz: 0, owner: null, pass: null, shot: null, held: false });
  }

  _setOwner(p, reaction = null) {
    const b = this.ball;
    const pass = b.pass;
    if (pass) {
      if (p.team === pass.from.team) {
        if (pass.offside && pass.offside === p) { this._offside(p); return; }
        if (p !== pass.from) {
          if (pass.kind === 'cross') pass.from.team.stats.crossOk++;
          else if (pass.kind !== 'clear') { pass.from.st.passOk++; pass.from.team.stats.passOk++; }
          b.assist = { p: pass.from, t: this.tAll };
        }
      } else {
        p.st.interceptions++;
        b.assist = null;
      }
    } else if (b.lastTeam !== p.team) b.assist = null;
    b.pass = null;
    b.owner = p; b.ownerSince = this.tAll; b.last = p; b.lastTeam = p.team; b.held = false;
    b.z = 0; b.vz = 0;
    p.decideT = reaction ?? (0.18 + this.rng.next() * 0.3);
    p.carryX = p.x + p.team.dir * 2; p.carryY = p.y; p.carrySprint = false;
    p.runT = 0;
  }

  _freeBallControl() {
    const b = this.ball;
    if (b.z > 2.6) return;
    const speed = hyp(b.vx, b.vy);
    let best = null, bestScore = 0;
    for (const t of this.teams) {
      for (const p of t.onPitch) {
        const gkHands = p.isGK && this._inOwnBox(t, b.x, b.y);
        const r = gkHands ? 1.7 : SIM.controlRadius + (b.z > 0.9 ? 0.2 : 0);
        const d = hyp(p.x - b.x, p.y - b.y);
        if (d > r) continue;
        if (b.z > (gkHands ? 2.7 : 2.2)) continue;
        if (b.pass && b.pass.from === p && this.tAll - b.pass.t0 < 0.35) continue;
        let pc;
        const a = p.d.attrs;
        if (b.pass && b.pass.from.team === t) pc = speed < 14 ? 0.88 : 0.62;
        else if (b.pass) pc = (0.22 + (0.4 * a.defending) / 99) * (speed > 13 ? 0.55 : 1);
        else pc = 0.7;
        if (b.z > 0.9) pc *= 0.4 + (0.5 * a.physical) / 99; // bola alta: disputa física
        if (gkHands) pc = Math.max(pc, 0.55 + (0.4 * a.goalkeeping) / 99);
        const score = this.rng.next() * pc * 2 - d * 0.1;
        if (this.rng.next() < pc && score > bestScore) { bestScore = score; best = p; }
      }
    }
    if (!best) return;
    // cabeceio ofensivo na área a partir de cruzamento
    const pass = b.pass;
    if (b.z > 1.1 && pass && pass.kind === 'cross' && best.team === pass.from.team && best !== pass.offside) {
      const u = b.x * best.team.dir;
      if (u > L - 17 && Math.abs(b.y) < 12) {
        pass.from.team.stats.crossOk++;
        b.assist = { p: pass.from, t: this.tAll };
        b.pass = null; b.last = best; b.lastTeam = best.team;
        this._shoot(best, 'header');
        return;
      }
    }
    // defensor afasta de cabeça
    if (b.z > 1.1 && !best.isGK && best.team !== (pass ? pass.from.team : null) && pass) {
      best.st.interceptions++;
      const inBox = this._inOwnBox(best.team, b.x, b.y);
      b.pass = null; b.last = best; b.lastTeam = best.team; b.assist = null;
      if (inBox && this.rng.chance(0.3)) { this._corner(best.team.opp, b.y); return; }
      const dir = best.team.dir;
      const ang = this.rng.range(-0.9, 0.9);
      const sp = 12 + this.rng.next() * 6;
      b.vx = Math.cos(ang) * sp * dir; b.vy = Math.sin(ang) * sp; b.vz = 5 + this.rng.next() * 3;
      return;
    }
    const wasGK = best.isGK && this._inOwnBox(best.team, b.x, b.y) && (b.z > 0.4 || (pass && pass.from.team !== best.team) || (!pass && b.lastTeam !== best.team));
    this._setOwner(best);
    if (b.owner === best && wasGK) { b.held = true; best.decideT = 1.0 + this.rng.next() * 1.2; }
  }

  // ---------- decisões do portador ----------

  _decide(p) {
    const t = p.team, dir = t.dir, tac = t.tactics;
    const b = this.ball;
    const u = p.x * dir, v = p.y;
    const [nOpp, nd] = this._nearestOpp(p);
    const ment = tac.mentality;
    const lossCost = 0.025 + 0.1 * Math.exp(-(u + L) / 16);
    const thrHere = posValue(u, v);
    const fwdW = [0.75, 1, 1.35][tac.tempo];
    let best = { kind: 'hold', util: 0.004 };
    const consider = (o) => { o.util += this.rng.gauss() * 0.006 * (1.15 - p.d.attrs.passing / 120); if (o.util > best.util) best = o; };

    // goleiro com a bola na mão: repõe
    if (p.isGK && b.held) {
      for (const q of t.onPitch) {
        if (q === p) continue;
        const e = this._evalPass(p, q, lossCost, thrHere, fwdW, false);
        if (e) consider(e);
      }
      const lx = (this.rng.range(0, 20)) * dir, ly = this.rng.range(-22, 22);
      consider({ kind: 'long', util: 0.02 + (ment < 0 ? 0.02 : 0), x: lx, y: ly });
      return this._execute(p, best);
    }

    // chute
    const dG = hyp(L - u, v);
    if (dG < 33 && u < L - 0.5) {
      const xg = this._shotXG(p, u, v, 'open');
      const shootW = (dG < 17 ? 1.9 : 1.12) + 0.2 * ment + (dG < 11 ? 0.4 : 0);
      // defensores na linha do chute desanimam a finalização
      let lane = 0;
      for (const o of t.opp.onPitch) if (!o.isGK && this._segDist(o.x, o.y, p.x, p.y, L * dir, 0) < 1.2) lane++;
      consider({ kind: 'shoot', util: (xg * shootW - 0.016 - Math.max(0, dG - 17) * 0.0022) * (1 - Math.min(0.6, lane * 0.22)) });
    }
    // passes
    for (const q of t.onPitch) {
      if (q === p || q.off) continue;
      const e = this._evalPass(p, q, lossCost, thrHere, fwdW, true);
      if (e) consider(e);
    }
    // cruzamento
    if (u > L - 30 && Math.abs(v) > 11) {
      let targets = 0;
      for (const q of t.onPitch) {
        const qu = q.x * dir;
        if (q !== p && qu > L - 17 && Math.abs(q.y) < 13) targets++;
      }
      if (targets > 0) {
        const tx = (L - this.rng.range(6, 12)) * dir, ty = -Math.sign(v) * this.rng.range(-3, 6);
        consider({ kind: 'cross', util: 0.05 + 0.035 * Math.min(targets, 3) + 0.01 * ment + (u > L - 14 ? 0.03 : 0), x: tx, y: ty });
      }
    }
    // condução
    const dirs = [0, 0.5, -0.5, 1.05, -1.05, 1.8, -1.8];
    const beatBase = clamp(0.42 + (p.d.attrs.dribbling - (nOpp ? nOpp.d.attrs.defending : 50)) / 110, 0.15, 0.8);
    for (const ang of dirs) {
      const step = 7;
      const cu = u + Math.cos(ang) * step, cv = v + Math.sin(ang) * step;
      if (Math.abs(cv) > W - 1.5 || cu > L - 1 || cu < -L + 2) continue;
      const cx = cu * dir, cy = cv;
      // adversários no caminho
      let block = 0;
      for (const o of t.opp.onPitch) {
        const dd = this._segDist(o.x, o.y, p.x, p.y, cx, cy);
        if (dd < 2.2) block = Math.max(block, 1 - dd / 2.2);
      }
      const gain = posValue(cu, cv) - thrHere;
      const openBonus = Math.min(8, this._nearestOppDist(t, cx, cy)) * 0.0009;
      let util;
      if (block > 0.05) util = gain * beatBase + openBonus - (1 - beatBase) * lossCost * block * 0.9 + 0.004;
      else util = gain * 1.05 + openBonus + 0.004;
      if (tac.tempo === 0) util -= 0.004;
      consider({ kind: 'dribble', util, x: cx, y: cy, sprint: block < 0.05 && ang === 0 });
    }
    // chutão para afastar
    if (u < -L + 30 && nd < 3) {
      consider({ kind: 'clear', util: 0.012 + (nd < 1.5 ? 0.03 : 0) + (u < -L + 18 ? 0.02 : 0), x: this.rng.range(0, 25) * dir, y: this.rng.range(-26, 26) });
    }
    return this._execute(p, best);
  }

  _segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const s = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return hyp(px - (ax + dx * s), py - (ay + dy * s));
  }

  _evalPass(p, q, lossCost, thrHere, fwdW, allowOffsideCheck) {
    const t = p.team, dir = t.dir;
    let tx = q.x, ty = q.y;
    const d0 = hyp(tx - p.x, ty - p.y);
    if (d0 < 4 || d0 > 58) return null;
    // corredor: lança no espaço à frente
    const through = q.runT > 0;
    const lead = through ? 0.9 : 0.55;
    const tEst = d0 / 13;
    tx += q.vx * tEst * lead; ty += q.vy * tEst * lead;
    tx = clamp(tx, -L + 0.5, L - 0.5); ty = clamp(ty, -W + 0.5, W - 0.5);
    const d = hyp(tx - p.x, ty - p.y);
    const air = d > 30;
    if (allowOffsideCheck && this._isOffside(q)) {
      // o passador percebe o impedimento na maioria das vezes
      if (this.rng.next() < 0.42 + (0.36 * p.d.attrs.passing) / 99) return null;
    }
    const tu = tx * dir, tv = ty;
    let succ;
    if (!air) {
      const v0 = passSpeed(d);
      const tb = rollTime(d, v0);
      let s = 1, dr = Infinity;
      const dx = tx - p.x, dy = ty - p.y;
      const l2 = dx * dx + dy * dy;
      for (const o of t.opp.onPitch) {
        dr = Math.min(dr, hyp(o.x - tx, o.y - ty));
        // corrida pela linha do passe (o trecho final é disputa com o recebedor, tratada abaixo)
        const sp = clamp(((o.x - p.x) * dx + (o.y - p.y) * dy) / l2, 0.05, 0.88);
        const cx = p.x + dx * sp, cy = p.y + dy * sp;
        const dc = hyp(o.x - cx, o.y - cy);
        const to = Math.max(0, dc - 1.0) / this._vmax(o) + 0.45;
        const margin = to - tb * sp;
        const rmax = 0.22 + (0.2 * o.d.attrs.defending) / 99;
        const risk = margin <= 0 ? rmax : rmax * Math.exp(-margin * 4.5);
        s *= 1 - risk;
      }
      // pressão sobre quem recebe: não intercepta, mas pode roubar logo depois
      s *= dr < 1.5 ? 0.6 : dr < 3 ? 0.78 : dr < 5 ? 0.92 : 1;
      succ = s * (0.84 + (0.15 * p.d.attrs.passing) / 99) * (1 - Math.max(0, d - 22) / 70);
    } else {
      let contest = 0;
      for (const o of t.opp.onPitch) { const dd = hyp(o.x - tx, o.y - ty); if (dd < 5) contest += (5 - dd) / 5; }
      succ = clamp(0.55 - contest * 0.28, 0.08, 0.6) * (0.78 + (0.22 * p.d.attrs.passing) / 99);
    }
    let value = posValue(tu, tv) - thrHere;
    if (value > 0) value *= fwdW * (air ? 0.8 : 1);
    value += t.tactics.tempo === 0 ? 0.02 : 0.012;
    if (through) value += 0.02;
    // passe de volta ao goleiro só sob pressão
    if (q.isGK) value -= 0.02;
    const util = succ * value - (1 - succ) * lossCost;
    return { kind: air ? 'longpass' : 'pass', util, q, x: tx, y: ty, through };
  }

  _execute(p, o) {
    const b = this.ball;
    const dir = p.team.dir;
    const tempo = p.team.tactics.tempo;
    const nextDecide = () => [0.75, 0.55, 0.4][tempo] + this.rng.next() * [0.45, 0.35, 0.3][tempo];
    switch (o.kind) {
      case 'shoot': return this._shoot(p, 'open');
      case 'pass': return this._kick(p, o.x, o.y, 'pass', o.q);
      case 'longpass': return this._kick(p, o.x, o.y, 'long', o.q);
      case 'cross': return this._kick(p, o.x, o.y, 'cross', null);
      case 'long': return this._kick(p, o.x, o.y, 'long', null);
      case 'clear': return this._kick(p, o.x, o.y, 'clear', null);
      case 'dribble':
        p.carryX = o.x; p.carryY = o.y; p.carrySprint = !!o.sprint;
        p.decideT = nextDecide();
        return;
      default: {
        // segura / protege: anda devagar para longe do adversário mais próximo
        const [n] = this._nearestOpp(p);
        let ax = p.x + dir * 1.5, ay = p.y;
        if (n) { const dx = p.x - n.x, dy = p.y - n.y, dl = hyp(dx, dy) || 1; ax = p.x + (dx / dl) * 3; ay = p.y + (dy / dl) * 3; }
        p.carryX = clamp(ax, -L + 1, L - 1); p.carryY = clamp(ay, -W + 1, W - 1); p.carrySprint = false;
        p.decideT = nextDecide() * 0.7;
        b.held = b.held && p.isGK;
      }
    }
  }

  /** Chuta a bola para (x, y). kind: pass | long | cross | clear | throw */
  _kick(p, x, y, kind, target) {
    const b = this.ball;
    const a = p.d.attrs;
    const [, nd] = this._nearestOpp(p);
    const pressure = nd < 1.5 ? 1 : nd < 3 ? 0.5 : 0;
    const d0 = hyp(x - p.x, y - p.y);
    const errK = (kind === 'clear' ? 0.14 : kind === 'cross' ? 0.08 : 0.05) * (1.25 - a.passing / 99) * (1 + pressure * 0.8);
    const ex = this.rng.gauss() * d0 * errK, ey = this.rng.gauss() * d0 * errK;
    x += ex; y += ey;
    const d = hyp(x - b.x, y - b.y) || 1;
    const nx = (x - b.x) / d, ny = (y - b.y) / d;
    let vh, vz = 0;
    if (kind === 'pass' || kind === 'throw') {
      vh = passSpeed(d);
      if (kind === 'throw') { vh = Math.min(vh, 13); vz = 2.4; }
    } else {
      vh = kind === 'clear' ? 20 + this.rng.next() * 6 : clamp(d / 2.1, 14, 24);
      const tf = d / vh;
      vz = (SIM.gravity * tf) / 2 * (kind === 'cross' ? 0.95 : 1);
    }
    // chutão espirrado dentro da própria área: escanteio
    if (kind === 'clear' && this._inOwnBox(p.team, p.x, p.y) && nd < 2 && this.rng.chance(0.25)) {
      b.owner = null; b.pass = null; b.held = false;
      this._corner(p.team.opp, p.y);
      return;
    }
    // cruzamento travado pelo marcador: vira escanteio ou sobra
    if (kind === 'cross' && nd < 2.2 && this.rng.chance(0.3)) {
      p.team.stats.crosses++;
      b.owner = null; b.pass = null; b.held = false;
      if (this.rng.chance(0.6)) { b.last = null; this._corner(p.team, p.y); return; }
      b.vx = -p.team.dir * this.rng.range(2, 6); b.vy = -Math.sign(p.y) * this.rng.range(1, 5); b.vz = 1.5; b.z = 0.3;
      b.lastTeam = p.team.opp;
      return;
    }
    b.owner = null; b.held = false;
    b.vx = nx * vh; b.vy = ny * vh; b.vz = vz; b.z = Math.max(b.z, 0.05);
    if (vz === 0) b.z = 0;
    b.last = p; b.lastTeam = p.team;
    b.pass = { from: p, to: target, t0: this.tAll, kind, offside: target && this._isOffside(target) ? target : null };
    if (kind === 'cross') p.team.stats.crosses++;
    else if (kind !== 'clear') { p.st.passes++; p.team.stats.passes++; }
    p.decideT = 0;
    p.cool = 0.4;
    // nenhum destinatário definido (cruzamento/chutão): marca impedidos na área do lance
    if (!target && kind === 'cross') {
      for (const q of p.team.onPitch) if (this._isOffside(q) && hyp(q.x - x, q.y - y) < 8) { b.pass.offside = q; break; }
    }
  }

  _shotXG(p, u, v, kind) {
    const a = p.d.attrs;
    let xg = baseXG(u, v);
    const skill = clamp(0.62 + (0.8 * (a.shooting - 40)) / 60, 0.5, 1.4);
    xg *= skill;
    const [, nd] = this._nearestOpp(p);
    xg *= nd < 1 ? 0.55 : nd < 2 ? 0.75 : nd < 4 ? 0.9 : 1.05;
    if (kind === 'header') xg *= 0.55 * (0.65 + (0.6 * a.physical) / 99);
    return clamp(xg, 0.01, 0.85);
  }

  _shoot(p, kind) {
    const b = this.ball, t = p.team, dir = t.dir;
    const u = p.x * dir, v = p.y;
    const a = p.d.attrs;
    let xg = kind === 'penalty' ? 0.76 : kind === 'freekick' ? clamp(baseXG(u, v) * 0.55 * (0.6 + a.shooting / 120), 0.02, 0.12) : this._shotXG(p, u, v, kind);
    const gk = t.opp.onPitch.find((q) => q.isGK) || null;
    t.stats.shots++; t.stats.xg += xg; p.st.shots++;
    if (xg > 0.35) t.stats.bigChances++;
    // passe decisivo
    if (b.assist && b.assist.p.team === t && this.tAll - b.assist.t < 6 && b.assist.p !== p) b.assist.p.st.keyPasses++;
    // bloqueio
    let outcome = null, blocker = null;
    if (kind === 'open' || kind === 'header') {
      const gx = L * dir;
      for (const o of t.opp.onPitch) {
        if (o.isGK) continue;
        const sd = this._segDist(o.x, o.y, p.x, p.y, gx, 0);
        const along = ((o.x - p.x) * (gx - p.x) + (o.y - p.y) * (0 - p.y)) / (hyp(gx - p.x, p.y) ** 2 || 1);
        if (sd < 1.1 && along > 0.02 && along < 0.65 && this.rng.chance(0.22)) { outcome = 'blocked'; blocker = o; break; }
      }
    }
    const kf = gk ? clamp(1.1 + (78 - gk.d.attrs.goalkeeping) / 110, 0.8, 1.25) : 1.6;
    if (!outcome) {
      const pGoal = clamp(xg * kf, 0.005, 0.95);
      let pOn = kind === 'penalty' ? 0.92 : clamp(0.26 + 1.1 * xg + (0.2 * (a.shooting - 60)) / 40, 0.2, 0.9);
      pOn = Math.max(pOn, pGoal + 0.04);
      const r = this.rng.next();
      outcome = r < pGoal ? 'goal' : r < pOn ? 'save' : this.rng.chance(kind === 'penalty' ? 0.2 : 0.09) ? 'post' : 'wide';
    }
    if (outcome === 'goal' || outcome === 'save') { t.stats.onTarget++; p.st.sot++; }
    // trajetória (animação coerente com o desfecho)
    const gx = L * dir;
    let ty, tz, ex = gx;
    const side = this.rng.chance(0.5) ? 1 : -1;
    if (outcome === 'goal') { ty = side * this.rng.range(0.6, GW - 0.3); tz = kind === 'header' ? this.rng.range(0.2, 1.6) : this.rng.range(0.1, 2.1); ex = gx + dir * 1.1; }
    else if (outcome === 'save') { ty = (gk ? gk.y : 0) + side * this.rng.range(0, 1.8); tz = this.rng.range(0.2, 1.8); ex = gx - dir * 0.8; }
    else if (outcome === 'post') { ty = side * GW; tz = this.rng.range(0.3, 2.3); ex = gx; }
    else if (outcome === 'blocked') { ty = blocker.y; tz = 0.4; ex = blocker.x; }
    else {
      if (this.rng.chance(0.45)) { ty = side * this.rng.range(0, GW); tz = 2.7 + this.rng.next() * 2; }
      else { ty = side * this.rng.range(GW + 0.4, GW + 6); tz = this.rng.range(0.2, 2); }
      ex = gx + dir * 1.5;
    }
    const d = hyp(ex - b.x, ty - b.y) || 1;
    const speed = kind === 'header' ? 13 + (4 * a.physical) / 99 : kind === 'penalty' ? 24 : 21 + (9 * a.shooting) / 99;
    const tf = d / speed;
    b.owner = null; b.held = false; b.pass = null;
    b.vx = ((ex - b.x) / d) * speed; b.vy = ((ty - b.y) / d) * speed;
    b.z = kind === 'header' ? 1.9 : 0.1;
    b.vz = (tz - b.z + 0.5 * SIM.gravity * tf * tf) / tf;
    b.last = p; b.lastTeam = t;
    let gkX = gx - dir * 0.9, gkY = ty;
    if (outcome === 'goal') gkY = (gk ? gk.y : 0) + (ty - (gk ? gk.y : 0)) * 0.45;
    if (outcome === 'wide' || outcome === 'post') gkY = ty * 0.5;
    b.shot = { shooter: p, team: t, xg, kind, outcome, blocker, gk, gkX, gkY: clamp(gkY, -GW, GW), resolveAt: this.tAll + tf, x0: p.x, y0: p.y, ty };
    this.fx.push({ kind: 'shot', t: this.tAll, x0: p.x, y0: p.y, x1: ex, y1: ty, outcome, side: t.side });
  }

  _resolveShot() {
    const b = this.ball, s = b.shot;
    const p = s.shooter, t = s.team, opp = t.opp, dir = t.dir;
    const name = p.d.name;
    b.shot = null;
    switch (s.outcome) {
      case 'goal': {
        t.score++; t.stats.goals++; p.st.goals++;
        let assist = null;
        if (b.assist && b.assist.p.team === t && b.assist.p !== p && this.tAll - b.assist.t < 8) { assist = b.assist.p; assist.st.assists++; }
        for (const q of opp.onPitch) q.st.conceded++;
        const key = s.kind === 'header' ? 'goalHeader' : s.kind === 'penalty' ? 'goalPen' : s.kind === 'freekick' ? 'goalFK' : 'goal';
        let text = commentary(key, { p: name, team: t.def.name }, this.rng);
        if (assist) text += commentary('goalAssist', { a: assist.d.name }, this.rng);
        this._event('goal', t, text, { playerId: p.d.id, assistId: assist ? assist.d.id : null, xg: s.xg, kind: s.kind });
        this.stoppage += 0.55;
        b.x = (L + 1.2) * dir; b.y = s.ty; b.z = 0.3; b.vx = b.vy = b.vz = 0;
        b.assist = null;
        this.fx.push({ kind: 'goal', t: this.tAll, side: t.side });
        this._setDead('kickoff', opp, 0, 0, RESTART_DELAY.goal, { celebrate: true });
        break;
      }
      case 'save': {
        const gk = s.gk;
        opp.stats.saves++; if (gk) gk.st.saves++;
        const k = gk ? gk.d.name : 'o goleiro';
        this._event('save', t, commentary(s.kind === 'penalty' ? 'savePen' : 'save', { p: name, k }, this.rng), { playerId: p.d.id, xg: s.xg });
        const catchP = gk ? clamp(0.35 + (0.4 * gk.d.attrs.goalkeeping) / 99 - s.xg * 0.6, 0.1, 0.8) : 0;
        if (gk && this.rng.chance(catchP)) {
          b.x = gk.x + dir * -0.3; b.y = gk.y;
          b.pass = null;
          this._setOwner(gk, 1.2 + this.rng.next() * 1.3);
          b.held = true;
        } else if (this.rng.chance(0.55)) {
          b.last = gk; b.lastTeam = opp;
          this._corner(t, s.ty);
        } else {
          b.x = L * dir - dir * 1.5; b.y = s.ty;
          const ang = this.rng.range(-1.2, 1.2);
          const sp = 5 + this.rng.next() * 6;
          b.vx = -dir * Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.vz = 1.5; b.z = 0.5;
          b.last = gk; b.lastTeam = opp; b.pass = null;
        }
        break;
      }
      case 'post': {
        this._event('post', t, commentary('post', { p: name, team: t.def.name }, this.rng), { playerId: p.d.id, xg: s.xg });
        b.x = L * dir - dir * 0.3; b.y = s.ty;
        const ang = this.rng.range(-1, 1);
        const sp = 6 + this.rng.next() * 7;
        b.vx = -dir * Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp + (s.ty > 0 ? -2 : 2); b.vz = 1;
        b.pass = null;
        break;
      }
      case 'blocked': {
        this._event('blocked', t, commentary('blocked', { p: name }, this.rng), { playerId: p.d.id, xg: s.xg, quiet: true });
        const bl = s.blocker;
        b.last = bl; b.lastTeam = opp;
        if (this.rng.chance(0.45)) { this._corner(t, bl.y); break; }
        const ang = this.rng.range(-1.6, 1.6);
        const sp = 4 + this.rng.next() * 8;
        b.x = bl.x; b.y = bl.y;
        b.vx = Math.cos(ang) * sp * -dir; b.vy = Math.sin(ang) * sp; b.vz = this.rng.next() * 3;
        b.pass = null;
        break;
      }
      default: {
        const big = s.xg > 0.3;
        this._event(big ? 'bigMiss' : 'wide', t, commentary(big ? 'bigMiss' : 'wide', { p: name }, this.rng), { playerId: p.d.id, xg: s.xg });
        this._setDead('goalkick', opp, (L - 5.5) * dir, clamp(s.ty, -9, 9) > 0 ? 4 : -4, RESTART_DELAY.goalkick);
      }
    }
  }

  // ---------- desarmes e faltas ----------

  _tackles(dt) {
    const b = this.ball, o = b.owner;
    if (b.held) return;
    if (this.tAll - b.ownerSince < 0.35) return;
    const t = o.team.opp;
    for (const d of t.onPitch) {
      if (d.cool > 0 || d.beaten > 0) continue;
      const dist = hyp(d.x - o.x, d.y - o.y);
      if (dist > SIM.tackleRadius) continue;
      const rate = (1.7 + 0.45 * t.tactics.pressing) * dt;
      if (!this.rng.chance(rate)) continue;
      d.cool = 0.8 + this.rng.next() * 0.4;
      const da = d.d.attrs, oa = o.d.attrs;
      const pSucc = clamp(0.42 + (da.defending - (oa.dribbling * 0.7 + oa.physical * 0.3)) / 105, 0.14, 0.8) * (0.85 + 0.15 * d.energy);
      const ok = this.rng.chance(pSucc);
      const careful = d.yellow ? 0.55 : 1;
      const boxK = this._inOwnBox(t, o.x, o.y) ? 1.9 : 1;
      const pFoul = boxK * careful * ((d.isGK ? 0.16 : 0.21) + (t.tactics.pressing === 2 ? 0.03 : 0) + (ok ? 0 : 0.12) + (1 - d.energy) * 0.05 + (d.d.attrs.defending < 55 ? 0.03 : 0));
      if (this.rng.chance(pFoul)) { this._foul(d, o); return; }
      if (ok) {
        d.st.tackles++; t.stats.tackles++;
        if (this.rng.chance(0.62)) { b.pass = null; this._setOwner(d); }
        else {
          b.owner = null; b.pass = null; b.last = d; b.lastTeam = t;
          const ang = this.rng.range(-Math.PI, Math.PI), sp = 3 + this.rng.next() * 5;
          b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
        }
        o.decideT = 0.4;
        return;
      }
      d.beaten = 0.6 + this.rng.next() * 0.4;
      o.st.dribbles++;
    }
  }

  _foul(d, victim) {
    const t = d.team, vt = victim.team;
    const b = this.ball;
    t.stats.fouls++; d.st.fouls++; victim.st.fouled++;
    const inBox = this._inOwnBox(t, victim.x, victim.y);
    const pen = inBox && this.rng.chance(0.75);
    // falta tática em contra-ataque rende mais cartão
    const counter = victim.x * vt.dir > 0 && t.onPitch.filter((q) => q.x * vt.dir > victim.x * vt.dir).length <= 4;
    this._event(pen ? 'penalty' : 'foul', t, commentary(pen ? 'penalty' : 'foul', { p: d.d.name, v: victim.d.name }, this.rng), { playerId: d.d.id, quiet: !pen });
    let card = null;
    const r = this.rng.next();
    const careful = d.yellow ? 0.6 : 1;
    if (r < 0.0045) card = 'red';
    else if (r < 0.0045 + careful * ((counter ? 0.4 : 0.15) + (pen ? 0.2 : 0))) card = 'yellow';
    if (card === 'yellow') {
      d.yellow++; d.st.yellow++; t.stats.yellow++;
      if (d.yellow >= 2) { this._event('red', t, commentary('secondYellow', { p: d.d.name }, this.rng), { playerId: d.d.id, second: true }); this._sendOff(d); }
      else this._event('yellow', t, commentary('yellow', { p: d.d.name, team: t.def.name }, this.rng), { playerId: d.d.id });
      this.stoppage += 0.25;
    } else if (card === 'red') {
      this._event('red', t, commentary('red', { p: d.d.name }, this.rng), { playerId: d.d.id });
      this._sendOff(d);
      this.stoppage += 0.4;
    }
    b.owner = null; b.pass = null; b.held = false;
    if (pen) {
      this.stoppage += 0.8;
      this._setDead('penalty', vt, (L - PITCH.penaltySpot) * vt.dir, 0, RESTART_DELAY.penalty);
    } else {
      this._setDead('freekick', vt, clamp(victim.x, -L + 1, L - 1), clamp(victim.y, -W + 1, W - 1), RESTART_DELAY.freekick);
    }
  }

  _sendOff(p) {
    const t = p.team;
    p.st.red++; t.stats.red++;
    p.off = true;
    p.left = this.minuteFloat;
    if (this.ball.owner === p) this.ball.owner = null;
    t.out.push(p);
    t.onPitch.splice(t.onPitch.indexOf(p), 1);
    // goleiro expulso: um jogador de linha vai para o gol
    if (p.isGK && t.onPitch.length) {
      const sub = t.onPitch.reduce((a, c) => (c.au < a.au ? c : a));
      sub.isGK = true; sub.slot = 'GOL'; sub.au = -1.5; sub.av = 0;
    }
  }

  _offside(p) {
    const t = p.team, b = this.ball;
    t.stats.offsides++; p.st.offsides++;
    this._event('offside', t, commentary('offside', { p: p.d.name }, this.rng), { playerId: p.d.id, quiet: true });
    b.pass = null; b.owner = null;
    this.fx.push({ kind: 'offside', t: this.tAll, x: p.x, side: t.side });
    this._setDead('freekick', t.opp, clamp(p.x, -L + 1, L - 1), clamp(p.y, -W + 1, W - 1), RESTART_DELAY.offside, { indirect: true });
  }

  // ---------- saídas de bola ----------

  _checkOut() {
    const b = this.ball;
    if (Math.abs(b.y) > W + 0.11) {
      const team = b.lastTeam ? b.lastTeam.opp : this.teams[0];
      if (b.pass) b.pass = null;
      this._setDead('throwin', team, clamp(b.x, -L + 1, L - 1), Math.sign(b.y) * W, RESTART_DELAY.throwin);
      return;
    }
    if (Math.abs(b.x) > L + 0.11) {
      // de quem é o gol nessa linha de fundo?
      const defT = this.teams.find((t) => b.x * t.dir < 0);
      if (b.pass) b.pass = null;
      if (b.lastTeam === defT) this._corner(defT.opp, b.y);
      else this._setDead('goalkick', defT, (L - 5.5) * -defT.dir, b.y > 0 ? 4 : -4, RESTART_DELAY.goalkick);
    }
  }

  _corner(attT, y) {
    attT.stats.corners++;
    const sy = y >= 0 ? 1 : -1;
    this._event('corner', attT, commentary('corner', { team: attT.def.name }, this.rng), { quiet: true });
    this._setDead('corner', attT, (L - 0.3) * attT.dir, sy * (W - 0.3), RESTART_DELAY.corner);
  }

  // ---------- bolas paradas ----------

  _setDead(type, team, x, y, delay, extra = {}) {
    const b = this.ball;
    if (!extra.celebrate) { b.x = x; b.y = y; b.z = 0; }
    b.vx = b.vy = b.vz = 0;
    b.owner = null; b.pass = null; b.shot = null; b.held = false;
    for (const t of this.teams) for (const p of t.onPitch) p.runT = 0;
    this.dead = { type, team, x, y, t: delay, ...extra };
    // cobrador: o mais próximo (goleiro no tiro de meta; atacante mais adiantado no pontapé inicial)
    let taker = null;
    if (type === 'goalkick') taker = team.onPitch.find((p) => p.isGK);
    else if (type === 'kickoff') taker = team.onPitch.filter((p) => !p.isGK).reduce((a, c) => (c.au > a.au ? c : a), team.onPitch.find((p) => !p.isGK));
    else if (type === 'penalty') taker = team.onPitch.filter((p) => !p.isGK).reduce((a, c) => (c.d.attrs.shooting > a.d.attrs.shooting ? c : a));
    else {
      let bd = Infinity;
      for (const p of team.onPitch) {
        if (p.isGK && type !== 'freekick') continue;
        if (p.isGK && !this._inOwnBox(team, x, y)) continue;
        const d = hyp(p.x - x, p.y - y);
        if (d < bd) { bd = d; taker = p; }
      }
    }
    this.dead.taker = taker;
  }

  _kickoffSpot(p) {
    if (p.isGK) return [-L + 2, 0];
    const u = Math.min(-1.5, -4 + p.au * 16 - 6);
    return [clamp(u, -L + 8, -1.5), p.av * 26];
  }

  _deadTargets() {
    const dd = this.dead, b = this.ball;
    const att = dd.team, def = att.opp;
    for (const t of this.teams) {
      const dir = t.dir;
      for (const p of t.onPitch) {
        p.sprint = false; p.runT = 0;
        if (p.cool > 0) p.cool -= SIM.dt;
        if (p.beaten > 0) p.beaten = 0;
        let u, v;
        if (dd.type === 'kickoff') {
          [u, v] = this._kickoffSpot(p);
          if (p === dd.taker) { u = -0.4; v = 0; }
          else if (t === att && p.au > 0.5) { u = -1.2; v = p.av * 20 || 8; }
          if (t !== att && hyp(u, v) < PITCH.circleR + 0.5) u = -PITCH.circleR - 0.8;
          if (dd.celebrate && dd.t > RESTART_DELAY.goal - 2.2 && t === att.opp) { /* comemoração: o time que marcou fica perto da bola */
            const sx = b.x, sy = b.y;
            u = (sx - dir * (4 + p.au * 2)) * dir; v = sy * 0.5 + p.av * 5;
          }
        } else if (p === dd.taker) {
          const back = dd.type === 'penalty' ? 1.8 : 0.9;
          u = dd.x * dir - back; v = dd.y * (dd.type === 'throwin' ? 1.02 : 1);
          if (dd.type === 'corner') v = dd.y + Math.sign(dd.y) * 0.4;
        } else if (p.isGK) {
          u = -L + (dd.type === 'penalty' && t !== att ? 0.2 : 1.2); v = 0;
          if (t === att) u = -L + 8;
        } else if (dd.type === 'penalty') {
          const eu = t === att ? L - PITCH.boxDepth - 2 : -(L - PITCH.boxDepth - 2);
          u = eu + (t === att ? -Math.abs(p.av) * 3 : Math.abs(p.av) * 3) * 1; v = p.av * 18;
        } else if (dd.type === 'corner') {
          const spots = [[L - 6, -3], [L - 11, 0], [L - 6, 4], [L - 14, -6], [L - 13, 7], [L - 20, 0], [L - 3, 0]];
          const rank = this._rankInTeam(p, (q) => (t === att ? -q.au : q.au));
          if (t === att) {
            if (rank < 5) { [u, v] = spots[rank]; }
            else { u = rank < 7 ? L - 24 : -5 + p.au * 6; v = p.av * 18; }
          } else {
            if (rank < 7) { u = -(L - [5, 10, 5, 12, 12, 17, 2][rank]); v = [-4, 0, 4, -6, 7, 0, 0][rank]; }
            else { u = -18; v = p.av * 20; }
          }
        } else {
          const uBall = dd.x * dir;
          const center = t === att ? clamp(uBall * 0.6 + 6, -18, 26) : clamp(uBall * 0.55 - 9, -30, 14);
          u = center + p.au * (t === att ? 20 : 15); v = p.av * (t === att ? 30 : 22) + dd.y * 0.25;
          if (p.au <= -0.9) u = Math.min(u, t === att ? 20 : u);
        }
        let x = clamp(u, -L + 0.5, L - 0.5) * dir, y = clamp(v, -W + 0.5, W - 0.5);
        if (p === dd.taker) { x = clamp(u * dir, -L - 1, L + 1); y = clamp(v, -W - 1, W + 1); }
        // distância regulamentar da bola nas cobranças
        if (t === def && dd.type !== 'kickoff' && dd.type !== 'throwin') {
          const dx = x - dd.x, dy = y - dd.y, d = hyp(dx, dy);
          if (d < 9.15) { const k = 9.15 / (d || 1); x = dd.x + dx * k; y = dd.y + dy * k; }
        }
        p.tx = x; p.ty = y;
        if (hyp(p.tx - p.x, p.ty - p.y) > 4) p.sprint = true;
      }
    }
  }
  _rankInTeam(p, key) {
    const list = p.team.onPitch.filter((q) => !q.isGK && q !== this.dead?.taker).sort((a, b) => key(a) - key(b));
    return list.indexOf(p);
  }

  _updateDead(dt) {
    const dd = this.dead, b = this.ball;
    dd.t -= dt;
    if (dd.celebrate && dd.t < 2.2 && b.x !== 0) { this._resetBall(0, 0); }
    if (!dd.celebrate || dd.t < 2.2) { b.x = dd.x; b.y = dd.y; b.z = 0; }
    if (dd.t > 0) return;
    const taker = dd.taker && dd.team.onPitch.includes(dd.taker) ? dd.taker : dd.team.onPitch.find((p) => !p.isGK) || dd.team.onPitch[0];
    if (!taker) { this.dead = null; return; }
    const d = hyp(taker.x - dd.x, taker.y - dd.y);
    if (d > 2 && dd.t > -2.5) return; // espera o cobrador chegar (com limite)
    taker.x = dd.x - dd.team.dir * 0.6; taker.y = dd.y * (dd.type === 'throwin' ? 1.01 : 1);
    this.dead = null;
    this._restart(dd, taker);
  }

  _restart(dd, p) {
    const b = this.ball, t = dd.team, dir = t.dir;
    b.x = dd.x; b.y = dd.y; b.z = 0;
    b.owner = p; b.last = p; b.lastTeam = t; b.ownerSince = this.tAll; b.pass = null; b.assist = null;
    const u = dd.x * dir, v = dd.y;
    switch (dd.type) {
      case 'kickoff': {
        const mates = t.onPitch.filter((q) => q !== p && !q.isGK).sort((a, c) => hyp(a.x, a.y) - hyp(c.x, c.y));
        const q = mates[0];
        this._kick(p, q.x - dir * 1, q.y, 'pass', q);
        return;
      }
      case 'penalty': return this._shoot(p, 'penalty');
      case 'corner': {
        if (this.rng.chance(0.14)) {
          const q = t.onPitch.filter((x) => x !== p && !x.isGK).sort((a, c) => hyp(a.x - p.x, a.y - p.y) - hyp(c.x - p.x, c.y - p.y))[0];
          this._kick(p, q.x, q.y, 'pass', q);
        } else {
          const tx = (L - this.rng.range(4, 12)) * dir, ty = this.rng.range(-6, 6);
          this._kick(p, tx, ty, 'cross', null);
          b.assist = { p, t: this.tAll };
        }
        return;
      }
      case 'goalkick': {
        const cbs = t.onPitch.filter((q) => !q.isGK && q.au < -0.8);
        const pressed = cbs.every((q) => this._nearestOppDist(t, q.x, q.y) < 8);
        if (!pressed && cbs.length && this.rng.chance(0.55 - t.tactics.tempo * 0.12)) {
          const q = this.rng.pick(cbs);
          this._kick(p, q.x, q.y, 'pass', q);
        } else {
          const mids = t.onPitch.filter((q) => q.au > -0.5);
          const q = mids.length ? this.rng.pick(mids) : null;
          this._kick(p, q ? q.x : 5 * dir, q ? q.y : this.rng.range(-20, 20), 'long', q);
        }
        return;
      }
      case 'throwin': {
        const mates = t.onPitch.filter((q) => q !== p && !q.isGK && hyp(q.x - p.x, q.y - p.y) < 24).sort((a, c) => this._nearestOppDist(t, c.x, c.y) - this._nearestOppDist(t, a.x, a.y));
        const q = mates[0] || t.onPitch.find((x) => x !== p);
        this._kick(p, q.x, q.y, 'throw', q);
        return;
      }
      case 'freekick': {
        const dG = hyp(L - u, v);
        if (!dd.indirect && dG < 30 && Math.abs(v) < 18 && u > L - 32 && this.rng.chance(0.6)) {
          this.stoppage += 0.15;
          return this._shoot(p, 'freekick');
        }
        if (u > L - 36) {
          this._kick(p, (L - this.rng.range(5, 12)) * dir, this.rng.range(-7, 7), 'cross', null);
          b.assist = { p, t: this.tAll };
          return;
        }
        p.decideT = 0;
        return this._decide(p);
      }
      default:
        p.decideT = 0;
        return this._decide(p);
    }
  }

  // ---------- estatística, momento, relógio ----------

  _accumulate(dt) {
    const b = this.ball;
    const pt = b.owner ? b.owner.team : b.pass ? b.pass.from.team : null;
    if (pt && !this.dead) {
      pt.stats.possTicks++;
      const u = b.x * pt.dir;
      const thr = threat(u, b.y);
      const mi = Math.min(this.momentum.length - 1, Math.floor(this.minuteFloat));
      this.momentum[mi] += (pt.side === 0 ? 1 : -1) * thr * dt;
      // mapa de calor no referencial do time (sempre atacando para a direita)
      const gx = clamp(Math.floor(((u + L) / (2 * L)) * 24), 0, 23);
      const gy = clamp(Math.floor(((b.y * pt.dir + W) / (2 * W)) * 16), 0, 15);
      this.heat[pt.side][gy * 24 + gx] += dt;
    }
  }

  _clock() {
    const H = this.H;
    if (!this.addedAnnounced && this.tp >= H) {
      const base = this.period === 1 ? 1 : 2.2;
      const n = clamp(Math.round(base + this.stoppage + this.rng.next() * 1.2), 1, SIM.maxAddedMin);
      this.added[this.period - 1] = n;
      this.addedAnnounced = true;
      this._event('added', null, commentary('added', { n }, this.rng), { n, quiet: true });
    }
    if (!this.addedAnnounced) return;
    const end = H + (this.added[this.period - 1] * 60) / this.K;
    if (this.tp < end) return;
    // não encerra com pênalti marcado ou chute no ar; espera lance perigoso acabar (com limite)
    const b = this.ball;
    if (b.shot || (this.dead && this.dead.type === 'penalty')) return;
    const pt = this._possTeam();
    const danger = pt && b.x * pt.dir > L - 25 && !this.dead;
    if (danger && this.tp < end + 8) return;
    const [h, a] = this.teams;
    if (this.period === 1) {
      this.phase = 'halftime';
      this.dead = null;
      this._resetBall(0, 0);
      this._event('halftime', null, commentary('halftime', { home: h.def.name, away: a.def.name, sh: h.score, sa: a.score }, this.rng));
    } else {
      this.phase = 'ended';
      this.dead = null;
      b.owner = null; b.pass = null;
      b.vx = b.vy = b.vz = 0;
      const endMin = this.minuteFloat;
      for (const t of this.teams) for (const p of t.onPitch) if (p.left == null) p.left = endMin;
      this._event('fulltime', null, commentary('fulltime', { home: h.def.name, away: a.def.name, sh: h.score, sa: a.score }, this.rng));
    }
  }

  // ---------- técnico da IA ----------

  _aiManager(side) {
    if (side === this.userSide) return;
    const t = this.teams[side];
    const m = this.minuteFloat;
    if (m < 55 || m < this._aiNext[side]) return;
    // como na vida real, só mexe com a bola parada
    if (!this.dead) return;
    this._aiNext[side] = m + 3 + this.rng.next() * 5;
    // substituições: as primeiras por volta dos 60', depois 70–85'; sai quem está mais cansado (ou pendurado atrás)
    const planned = m < 60 ? 0 : m < 70 ? 2 : m < 80 ? 3 : 4;
    const made = SIM.maxSubs - t.subsLeft;
    if (t.subsLeft > 0 && made < planned) {
      const tired = t.onPitch.filter((p) => !p.isGK && m - p.entered > 30)
        .map((p) => ({ p, score: p.energy - (p.yellow && p.au < -0.5 ? 0.12 : 0) }))
        .filter((x) => x.score < 0.86)
        .sort((a, b) => a.score - b.score);
      for (const { p } of tired.slice(0, Math.min(2, planned - made))) {
        const cand = t.bench.filter((b) => !b.used && b.d.pos !== 'GOL').sort((a, b) => slotFit(b.d.pos, p.slot) * b.d.overall - slotFit(a.d.pos, p.slot) * a.d.overall)[0];
        if (cand && t.subsLeft > 0) this.substitute(side, p.d.id, cand.d.id);
      }
    }
    // postura conforme o placar
    const diff = t.score - t.opp.score;
    const base = t.def.tactics?.mentality ?? 0;
    let want = base;
    if (m > 65 && diff < 0) want = Math.min(2, base + 1 + (m > 80 ? 1 : 0));
    else if (m > 78 && diff > 0) want = Math.max(-2, base - 1);
    if (want !== t.tactics.mentality) this.setTactics(side, { mentality: want });
  }

  // ---------- resumo ----------

  possession() {
    const a = this.teams[0].stats.possTicks, b = this.teams[1].stats.possTicks;
    const tot = a + b;
    if (!tot) return [50, 50];
    const h = Math.round((a / tot) * 100);
    return [h, 100 - h];
  }

  /** Nota 3,0–10,0 de um jogador (null se jogou pouco). */
  rating(p) {
    const s = p.st;
    const mins = (p.left ?? this.minuteFloat) - p.entered;
    if (mins < 12) return null;
    const t = p.team, diff = t.score - t.opp.score;
    let r = 6.0;
    r += s.goals * 1.05 + s.assists * 0.65 + s.keyPasses * 0.22 + s.sot * 0.1 + s.tackles * 0.12 + s.interceptions * 0.08 + s.dribbles * 0.05;
    if (s.passes >= 5) r += ((s.passOk / s.passes) - 0.78) * 1.6;
    r -= s.fouls * 0.08 + s.yellow * 0.3 + s.red * 1.6 + s.offsides * 0.08;
    const defensive = p.isGK || p.au < -0.8;
    if (defensive) {
      r -= s.conceded * (p.isGK ? 0.35 : 0.22);
      if (s.conceded === 0 && mins > 60) r += p.isGK ? 0.6 : 0.4;
    }
    if (p.isGK) r += s.saves * 0.28;
    r += diff > 0 ? 0.3 : diff < 0 ? -0.25 : 0;
    return Math.round(clamp(r, 3, 10) * 10) / 10;
  }

  /** Jogador da partida (maior nota; desempate por gols). */
  manOfTheMatch() {
    let best = null, br = -1;
    for (const t of this.teams) for (const p of [...t.onPitch, ...t.out]) {
      const r = this.rating(p);
      if (r != null && (r > br || (r === br && p.st.goals > (best?.st.goals ?? 0)))) { br = r; best = p; }
    }
    return best ? { player: best, rating: br } : null;
  }

  /** Resultado compacto (para campeonato/histórico). */
  result() {
    const [h, a] = this.teams;
    const scorers = this.events.filter((e) => e.type === 'goal').map((e) => ({ side: e.side, playerId: e.playerId, minute: e.label }));
    return {
      home: h.def.id, away: a.def.id, hs: h.score, as: a.score, seed: this.seed, scorers,
      xg: [h.stats.xg, a.stats.xg].map((x) => Math.round(x * 100) / 100),
      poss: this.possession(),
    };
  }
}
