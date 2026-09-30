// Goleiro: posicionamento no ângulo, saída do gol, leitura do chute pela
// trajetória prevista, tempo de reação, mergulho com alcance real, encaixe ou
// rebote, saída em cruzamentos, pênaltis e reposição (mão ou chutão).
import { PITCH, GOAL, BALL, clamp, lerp, angDiff } from './config.js';
import { carrierThink, bestReceiver } from './ai.js';

const HL = PITCH.halfL;
const rand = (a, b) => a + Math.random() * (b - a);
const DIVE_DUR = 1.3, DIVE_CONTACT = 0.35 * 1.3;

function skillOf(m, gk) {
  const base = gk.a.gk / 99;
  return gk.team.human ? base * 0.95 : base * m.diff.gkSkill;
}

export function keeperThink(m, gk, dt) {
  if (gk.sentOff) return;
  const t = gk.team;
  const gx = m.ownGoalX(t), s = Math.sign(gx);
  const b = m.ball;
  gk.gkReady = false; gk.face = null; gk.jockey = false;
  const human = gk === m.controlled && t.human;

  if (m.phase === 'goal' || m.phase === 'halftime' || m.phase === 'fulltime' || m.phase === 'ended') {
    if (m.shootout && m.phase !== 'ended') { gk.dx = gk.dz = 0; return; }
    gk.moveTo(gx - s * 3, 0, 0.3, false); return;
  }
  if (m.phase === 'stopped') { gk.moveTo(gx - s * 4, clamp(b.p.z * 0.1, -2, 2), 0.35, false); gk.face = b.p; return; }

  // segurando a bola: repõe
  if (gk.holdingBall && m.holder === gk) {
    gk.holdTime += dt;
    if (!gk.action) {
      if (!human) { gk.dx = gk.dz = 0; gk.face = { x: 0, z: 0 }; }
      if ((!human && gk.holdTime > rand(1.4, 2.6)) || gk.holdTime > 6) distribute(m, gk);
    }
    return;
  }
  if (gk.action) return;
  if (m.owner === gk) { if (!human) carrierThink(m, gk, dt); return; }

  const sp = m.sp;
  if (m.phase === 'setpiece' && sp) {
    if (sp.type === 'penalty' && sp.team !== t) {
      gk.teleportIfFar?.();
      gk.dx = gk.dz = 0; gk.gkReady = true; gk.heading = s > 0 ? Math.PI : 0;
      return;
    }
    if (sp.type === 'goalkick' && sp.taker === gk) return;
  }

  // pênalti: mergulha no momento do chute
  if (m.lastSetpiece && m.lastSetpiece.type === 'penalty' && m.lastSetpiece.team !== t && !gk.penDived && m.lastKick && m.lastKick.t >= m.time - 0.05) {
    gk.penDived = true;
    let side, height;
    const bz = m.ball.v.z, lat = -bz * s;   // + = direita do goleiro olhando p/ o campo
    if (human && m.userDive) { side = m.userDive.side; height = m.userDive.height; }
    else {
      const right = Math.random() < 0.42 + skillOf(m, gk) * 0.2;
      side = right ? Math.sign(lat || 1) : -Math.sign(lat || 1);
      height = rand(0, 0.7);
      if (Math.random() < 0.08) side = 0;
    }
    if (side !== 0) gk.startAction('gk_dive', { diveSide: side, diveHeight: height, lateral: 1.9, face: s > 0 ? Math.PI : 0 });
    return;
  }
  if (m.phase === 'play' && m.lastSetpiece?.type !== 'penalty') gk.penDived = false;

  // chute vindo: lê a trajetória
  const shot = readShot(m, gk);
  if (shot) {
    if (gk.reactAt === undefined || m.time - (gk.shotSeen || 0) > 1.2) { gk.shotSeen = m.time; gk.reactAt = m.time + reaction(m, gk); }
    const right = { x: -Math.sin(gk.heading), z: Math.cos(gk.heading) };
    const lat = (shot.z - gk.z) * right.z + (shot.x - gk.x) * right.x;
    const need = Math.abs(lat);
    if (need < 0.75 && shot.y < 2.0) {
      // no corpo: só se ajeita
      gk.moveTo(shot.x, shot.z, 1, false); gk.face = b.p; gk.gkReady = true;
      return;
    }
    const tLeft = shot.t - DIVE_CONTACT;
    if (m.time >= gk.reactAt && tLeft < 0.08 && need < 3.4) {
      const height = clamp((shot.y - 0.25) / 1.9, 0, 1);
      gk.startAction('gk_dive', { diveSide: Math.sign(lat), diveHeight: height, lateral: clamp(need - 0.9, 0.4, 2.1), face: gk.heading });
      return;
    }
    // desloca lateralmente enquanto espera
    gk.moveTo(gk.x + right.x * lat * 0.4, gk.z + right.z * lat * 0.4, 1, false);
    gk.face = b.p; gk.gkReady = true;
    return;
  }

  // 1 contra 1: sai para fechar o ângulo (ou o jogador mandou o goleiro sair)
  const o = m.owner;
  const called = m.userGKRush && t.human && o && o.team !== t && Math.abs(o.x - gx) < 30;
  if (o && o.team !== t && (m.inOwnBox(gk, o.x, o.z) || called)) {
    const d = Math.hypot(o.x - gk.x, o.z - gk.z);
    const defendersBetween = t.players.some(p => !p.isGK && !p.sentOff && Math.abs(p.x - gx) < Math.abs(o.x - gx) && Math.hypot(p.x - o.x, p.z - o.z) < 4);
    if (!defendersBetween || called) {
      const tx = o.x + (gx - o.x) * 0.18, tz = o.z * 0.82;
      gk.moveTo(tx, tz, 1, true);
      gk.face = b.p;
      // abafa nos pés
      const bd = Math.hypot(b.p.x - gk.x, b.p.z - gk.z);
      if (bd < 2.2 && bd > 0.8 && Math.random() < dt * 3 * skillOf(m, gk)) {
        const ang = Math.atan2(b.p.z - gk.z, b.p.x - gk.x);
        const lat = angDiff(gk.heading, ang);
        gk.startAction('gk_dive', { diveSide: lat > 0 ? 1 : -1, diveHeight: 0, lateral: clamp(bd - 0.6, 0.3, 1.4), face: gk.heading });
      }
      return;
    }
  }

  // bola solta na área ou cruzamento: vai buscar
  const ik = gk.interceptT;
  if (!o && !b.held) {
    const inBox = m.inOwnBox(gk, gk.ix, gk.iz);
    let others = 99;
    for (const p of m.players) if (!p.isGK && !p.sentOff) others = Math.min(others, p.interceptT);
    if (inBox && ik < others + 0.15 && !m.isBackPass(gk)) {
      gk.moveTo(gk.ix, gk.iz, 1, true); gk.face = b.p;
      return;
    }
    if (inBox && m.isBackPass(gk) && ik < others) { gk.moveTo(gk.ix, gk.iz, 1, true); return; }
  }

  // posição base: sobre a bissetriz entre a bola e o centro do gol
  const dx = b.p.x - gx, dz = b.p.z;
  const d = Math.hypot(dx, dz) || 1;
  const out = d > 45 ? clamp(4 + (d - 45) * 0.25, 4, 14) : clamp(0.8 + d * 0.07, 0.8, 4);
  let tx = gx + dx / d * out, tz = dz / d * out;
  if (Math.abs(tx) > HL - 0.4) tx = s * (HL - 0.4);
  tz = clamp(tz, -GOAL.halfWidth, GOAL.halfWidth);
  gk.moveTo(tx, tz, d < 30 ? 1 : 0.5, false);
  gk.face = b.p;
  gk.gkReady = d < 40;
}

function reaction(m, gk) {
  const sk = skillOf(m, gk);
  return lerp(0.3, 0.1, sk) + rand(0, 0.06);
}

// Onde a bola cruza a "linha do goleiro" (ou a linha do gol), se estiver indo para o gol.
function readShot(m, gk) {
  const t = gk.team;
  const gx = m.ownGoalX(t), s = Math.sign(gx);
  const b = m.ball;
  if (b.held || m.owner) return null;
  const vx = b.v.x * s;
  if (vx < 6) return null;
  const pr = m.pred;
  const planeX = gk.x;
  let prevX = b.p.x;
  for (let k = 0; k < pr.n; k++) {
    const x = pr.x(k);
    if ((x - planeX) * s >= 0 && (prevX - planeX) * s < 0 || (x - gx) * s >= 0) {
      const z = pr.z(k), y = pr.y(k);
      // para onde a bola vai na linha do gol
      let onGoal = false;
      for (let j = k; j < pr.n; j++) {
        if ((pr.x(j) - gx) * s >= 0) { onGoal = Math.abs(pr.z(j)) < GOAL.halfWidth + 0.6 && pr.y(j) < GOAL.height + 0.5; break; }
      }
      if (!onGoal) return null;
      return { x, y, z, t: pr.t(k) };
    }
    prevX = x;
  }
  return null;
}

// Verificação de defesa (a cada subpasso da física).
export function keeperSaveCheck(m, dt) {
  const b = m.ball;
  if (b.held) return;
  for (const t of m.teams) {
    const gk = t.gk;
    if (gk.sentOff || m.owner === gk) continue;
    if (gk.saveCd > 0) { gk.saveCd -= dt; continue; }
    const gx = m.ownGoalX(t), s = Math.sign(gx);
    if (!m.inOwnBox(gk, b.p.x, b.p.z) && Math.abs(b.p.x - gx) > 18) continue;
    const toward = b.v.x * s;
    const act = gk.action;
    let hit = false, edge = 0;
    if (act && act.type === 'gk_dive') {
      const u = act.t / act.dur;
      if (u < 0.12 || u > 0.72) continue;
      const side = act.data.diveSide || 1, h = act.data.diveHeight || 0;
      const rx = -Math.sin(gk.heading) * side, rz = Math.cos(gk.heading) * side;
      const lift = Math.sin(clamp(u / 0.45, 0, 1) * Math.PI / 2);
      const cy = 0.35 + h * 1.35 * lift;
      // segmento do corpo: quadril → mãos esticadas
      const ax = gk.x - rx * 0.5, ay = Math.max(0.25, cy - 0.2), az = gk.z - rz * 0.5;
      const bx = gk.x + rx * 1.0, by = cy + 0.25 + h * 0.2, bz = gk.z + rz * 1.0;
      const r = segDist(b.p.x, b.p.y, b.p.z, ax, ay, az, bx, by, bz);
      if (r.d < 0.32 + BALL.radius) { hit = true; edge = r.u; }
    } else {
      if (toward < 3 && b.p.y < 1.2) continue;   // passes lentos: domínio normal
      const dh = Math.hypot(b.p.x - gk.x, b.p.z - gk.z);
      const reachUp = act && act.type === 'gk_catch' ? 2.5 : 2.35;
      if (dh < 0.55 && b.p.y < reachUp) { hit = true; edge = dh / 0.55 * 0.5; }
    }
    if (!hit) continue;
    if (!m.inOwnBox(gk, gk.x, gk.z) && !m.inOwnBox(gk, b.p.x, b.p.z)) continue;
    save(m, gk, edge);
  }
}

function segDist(px, py, pz, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let u = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / (dx * dx + dy * dy + dz * dz);
  u = clamp(u, 0, 1);
  const cx = ax + dx * u, cy = ay + dy * u, cz = az + dz * u;
  return { d: Math.hypot(px - cx, py - cy, pz - cz), u };
}

function save(m, gk, edge) {
  const b = m.ball;
  const sp = b.speed();
  const sk = skillOf(m, gk);
  const pSave = clamp(0.42 + sk * 0.62 - Math.max(0, sp - 18) * 0.016 - edge * 0.2, 0.08, 0.97);
  gk.saveCd = 0.35;
  if (Math.random() > pSave) {
    // só raspa
    b.v.x *= 0.88; b.v.z += (Math.random() - 0.5) * 2; b.v.y += 0.6;
    m.emit('touch', { strength: 0.3 });
    return;
  }
  const t = gk.team, s = Math.sign(m.ownGoalX(t));
  const diving = gk.action && gk.action.type === 'gk_dive';
  const catchable = sp < (diving ? 17 : 23) && edge < (diving ? 0.75 : 0.9) && b.p.y < 2.2 && Math.random() < 0.35 + sk * 0.6;
  m.lastShotSaved = { t: m.time, gk };
  if (catchable) {
    m.gkCatch(gk);
    m.emit('save', { kind: 'catch', side: t.i });
    m.emit('crowd', { kind: 'save', strength: 0.6 });

    return;
  }
  // rebote: para fora, longe do centro do gol
  const side = Math.sign(b.p.z - gk.z || (Math.random() - 0.5));
  const out = sp * rand(0.25, 0.45);
  b.kick(-s * sp * rand(0.12, 0.3), rand(1.5, 5), side * out + b.v.z * 0.2, 0, 0, 0);
  m.lastTouch = gk;
  m.touch(gk, 'parry');
  m.emit('save', { kind: 'parry', side: t.i });
  m.emit('crowd', { kind: 'ooh', strength: 0.8 });
  m.emit('catch', {});
}

function distribute(m, gk) {
  const t = gk.team;
  const r = bestReceiver(m, gk, 'ground');
  if (r && r.q && Math.hypot(r.q.x - gk.x, r.q.z - gk.z) < 32 && r.s > 0.25) {
    gk.startAction('gk_throw', { target: { x: r.q.x, z: r.q.z }, receiver: r.q, face: Math.atan2(r.q.z - gk.z, r.q.x - gk.x) });
  } else {
    const fwd = t.players.filter(p => (p.role === 'ATT' || p.role === 'MID') && !p.sentOff).sort(() => Math.random() - 0.5)[0];
    const tg = fwd ? { x: fwd.x, z: fwd.z } : { x: gk.x + t.dir * 50, z: 0 };
    gk.startAction('gk_kick', { target: tg, receiver: fwd, face: Math.atan2(tg.z - gk.z, tg.x - gk.x) });
  }
}

export function userDistribute(m, gk, kind, dirx, dirz) {
  const t = gk.team;
  if (kind === 'long') {
    const ang = Math.hypot(dirx, dirz) > 0.3 ? Math.atan2(dirz, dirx) : (t.dir > 0 ? 0 : Math.PI);
    const tg = { x: gk.x + Math.cos(ang) * 50, z: clamp(gk.z + Math.sin(ang) * 50, -30, 30) };
    gk.startAction('gk_kick', { target: tg, face: ang });
  } else {
    const r = Math.hypot(dirx, dirz) > 0.3 ? bestReceiver(m, gk, 'ground', dirx, dirz) : bestReceiver(m, gk, 'ground');
    const q = r?.q;
    const tg = q ? { x: q.x, z: q.z } : { x: gk.x + t.dir * 20, z: gk.z };
    gk.startAction('gk_throw', { target: tg, receiver: q, face: Math.atan2(tg.z - gk.z, tg.x - gk.x) });
  }
}
