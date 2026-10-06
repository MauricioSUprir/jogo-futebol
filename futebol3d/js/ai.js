// IA tática: bloco do time conforme a formação e a bola, pressão, cobertura,
// marcação, apoio ao portador, infiltrações sem ficar impedido, decisão de quem
// conduz (chutar, passar, enfiar, cruzar, driblar, afastar) e bolas paradas.
import { PITCH, GOAL, PLAYER, clamp, lerp, angDiff } from './config.js';

const HL = PITCH.halfL, HW = PITCH.halfW;
const rand = (a, b) => a + Math.random() * (b - a);

export function humanDriving(m, p) {
  return p === m.controlled && p.team.human &&
    (m.phase === 'play' || (m.phase === 'setpiece' && m.sp && (m.sp.taker === p || (m.sp.type === 'penalty' && p.isGK))));
}

// Tempo até cada jogador alcançar a bola (usa a previsão da trajetória).
function intercepts(m, t) {
  const pr = m.pred;
  for (const p of t.players) {
    if (p.sentOff) { p.interceptT = 99; continue; }
    const react = p.human ? 0.1 : m.diff.aiReaction * 0.6;
    const v = p.sprintSpd * 0.92;
    let found = -1;
    for (let k = 0; k < pr.n; k++) {
      const y = pr.y(k);
      if (y > 2.4) continue;
      const d = Math.hypot(pr.x(k) - p.x, pr.z(k) - p.z) - 0.7;
      const need = react + Math.max(0, d) / v + (d > 1 ? 0.25 : 0);
      if (need <= pr.t(k)) { found = k; break; }
    }
    if (found < 0) {
      const k = pr.n - 1;
      p.interceptK = k; p.ix = pr.x(k); p.iz = pr.z(k);
      p.interceptT = pr.t(k) + Math.hypot(p.ix - p.x, p.iz - p.z) / v;
    } else {
      p.interceptK = found; p.ix = pr.x(found); p.iz = pr.z(found); p.interceptT = pr.t(found);
    }
    if (m.ball.held) { p.ix = m.ball.p.x; p.iz = m.ball.p.z; p.interceptT = Math.hypot(p.ix - p.x, p.iz - p.z) / v; }
  }
}

// linha de impedimento (penúltimo adversário) no referencial de ataque do time
function offsideLine(m, t) {
  const ds = t.opp.players.filter(q => !q.sentOff).map(q => m.lx(t, q.x)).sort((a, b) => b - a);
  return Math.max(0, ds[1] ?? HL, m.lx(t, m.ball.p.x));
}

export function teamThink(m, t, dt) {
  intercepts(m, t);
  const b = m.ball.p;
  const owner = m.owner;
  const attacking = owner ? owner.team === t : (m.lastTouch ? m.lastTouch.team === t : false);
  t.attacking = attacking;
  const offLine = offsideLine(m, t);
  const outfield = t.players.filter(p => !p.sentOff && !p.isGK);

  // perseguidor da bola solta
  let chaser = null;
  if (!owner || owner.team !== t) {
    for (const p of outfield) if (p.canPlay() && (!chaser || p.interceptT < chaser.interceptT)) chaser = p;
  }
  t.chaser = chaser;

  // pressionadores quando o adversário tem a bola
  let press1 = null, press2 = null;
  if (owner && owner.team !== t) {
    const sorted = outfield.filter(p => p.canPlay()).sort((a, c) => dist(a, owner) - dist(c, owner));
    press1 = sorted[0]; press2 = sorted[1];
  }

  // alvos de formação
  for (const p of outfield) shapeTarget(m, t, p, attacking, offLine);
  flattenLine(m, t, outfield, attacking);
  if (!attacking) mark(m, t, outfield, press1, press2);
  else if (owner && owner.team === t) support(m, t, outfield, owner, offLine, dt);

  for (const p of t.players) {
    if (p.sentOff || p.isGK) continue;
    if (humanDriving(m, p)) continue;
    p.face = null; p.jockey = false; p.shielding = false;
    p.slow = 1;
    const phase = m.phase;
    if (phase === 'goal') { celebrate(m, p); continue; }
    if (phase === 'stopped' || phase === 'halftime' || phase === 'fulltime' || phase === 'ended') {
      if (m.shootout) { p.dx = p.dz = 0; continue; }
      p.moveTo(p.target.x, p.target.z, 0.25, false);
      p.face = b;
      continue;
    }
    if (phase === 'setpiece') continue;   // setpieceAI cuida
    if (p.stun > 0 || (p.action && ['slide', 'fall', 'getup', 'dejected'].includes(p.action.type))) continue;

    if (owner === p) { carrierThink(m, p, dt); continue; }
    if (tryAerial(m, p)) continue;

    const pt = m.passTarget;
    if (pt && pt.p === p && !owner) {
      // vai ao encontro do passe
      p.moveTo(p.ix, p.iz, 1, true);
      p.face = b;
      continue;
    }
    if (p === chaser && !owner && !m.ball.held) {
      p.moveTo(p.ix, p.iz, 1, p.interceptT > 0.6);
      continue;
    }
    if (p === press1) { pressCarrier(m, p, owner, dt, 1); continue; }
    if (p === press2 && (t.style.press > 0.55 || m.lx(t, owner.x) < -20 || m.teamPressCall === t)) { pressCarrier(m, p, owner, dt, 2); continue; }
    if (p.runUntil > m.time && attacking) {
      const tgx = Math.min(p.target.x * t.dir, offLine - 0.4 + (p.runLate || 0)) * t.dir;
      p.moveTo(tgx, p.target.z, 1, true);
      continue;
    }
    const far = Math.hypot(p.target.x - p.x, p.target.z - p.z);
    p.moveTo(p.target.x, p.target.z, attacking ? 0.55 : 0.7, far > 12);
    if (far < 3) p.face = b;
  }
}

function dist(a, c) { return Math.hypot(a.x - c.x, a.z - c.z); }

function shapeTarget(m, t, p, attacking, offLine) {
  const [role, bx, bz] = t.formation[p.slot];
  const b = m.ball.p;
  const bl = m.lx(t, b.x), bzl = b.z * t.dir;
  const wide = 0.9 + t.style.width * 0.3;
  let x, z;
  if (attacking) {
    x = bx + 12 + bl * 0.6;
    z = bz * wide * 1.08 + bzl * 0.22;
    if (role === 'DEF') { x = Math.min(x, bl - 6, 22); if (Math.abs(bz) > 15) x += 4 * t.style.width; }
    if (role === 'ATT' || role === 'MID') x = Math.min(x, Math.max(offLine, bl) - 0.8);
  } else {
    x = bx * 0.92 + bl * 0.55 - 3;
    z = bz * 0.78 + bzl * 0.4;
    if (role === 'DEF') { x = Math.max(x, -HL + 5); x = Math.min(x, bl - 3); }
    if (role === 'MID') x = Math.min(x, bl + 1);
    if (role === 'ATT') x = Math.min(x, bl + 6);
  }
  x = clamp(x, -HL + 2, HL - 2);
  z = clamp(z, -HW + 1.5, HW - 1.5);
  p.target.x = x * t.dir; p.target.z = z * t.dir;
}

// Zagueiros alinhados (linha de impedimento coerente).
function flattenLine(m, t, outfield, attacking) {
  const defs = outfield.filter(p => p.role === 'DEF');
  if (!defs.length) return;
  let line = 0;
  for (const p of defs) line += m.lx(t, p.target.x);
  line /= defs.length;
  // se um atacante adversário está muito fundo, a linha acompanha até a área
  for (const p of defs) {
    const cur = m.lx(t, p.target.x);
    const nx = lerp(cur, line, 0.8);
    p.target.x = nx * t.dir;
  }
}

// Marcação por zona com encaixe no atacante mais próximo (do lado do gol).
function mark(m, t, outfield, press1, press2) {
  const gx = m.ownGoalX(t);
  const taken = new Set();
  const opps = t.opp.players.filter(q => !q.sentOff && !q.isGK && q !== m.owner)
    .sort((a, c) => Math.abs(a.x - gx) - Math.abs(c.x - gx));
  for (const q of opps) {
    if (m.lx(t, q.x) > 5) continue;   // atacante no nosso campo
    let best = null, bd = 14;
    for (const p of outfield) {
      if (taken.has(p) || p === press1 || p === press2) continue;
      const d = Math.hypot(p.target.x - q.x, p.target.z - q.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) continue;
    taken.add(best);
    const dx = gx - q.x, dz = -q.z, dl = Math.hypot(dx, dz) || 1;
    const tight = m.lx(t, q.x) < -25 ? 1.3 : 2.2;
    const mx = q.x + dx / dl * tight, mz = q.z + dz / dl * tight;
    best.target.x = lerp(best.target.x, mx, 0.75);
    best.target.z = lerp(best.target.z, mz, 0.75);
    best.markOf = q;
  }
}

// Apoio: dois companheiros oferecem linhas de passe; atacantes infiltram.
function support(m, t, outfield, owner, offLine, dt) {
  const near = outfield.filter(p => p !== owner && !p.human).sort((a, c) => dist(a, owner) - dist(c, owner)).slice(0, 2);
  const angs = [0.8, -0.8, 1.9, -1.9, 0];
  for (const p of near) {
    let best = null, bs = -1e9;
    for (const a of angs) {
      const ang = (t.dir > 0 ? 0 : Math.PI) + a;
      const r = a === 0 ? 16 : 11;
      const x = clamp(owner.x + Math.cos(ang) * r, -HL + 2, HL - 2);
      const z = clamp(owner.z + Math.sin(ang) * r, -HW + 1.5, HW - 1.5);
      if (m.lx(t, x) > offLine - 0.5) continue;
      let s = -Math.hypot(x - p.x, z - p.z) * 0.15;
      for (const q of t.opp.players) if (!q.sentOff) s -= Math.max(0, 6 - Math.hypot(q.x - x, q.z - z));
      for (const o of outfield) if (o !== p && o !== owner) s -= Math.max(0, 5 - Math.hypot(o.x - x, o.z - z)) * 0.6;
      if (s > bs) { bs = s; best = { x, z }; }
    }
    if (best) { p.target.x = lerp(p.target.x, best.x, 0.7); p.target.z = lerp(p.target.z, best.z, 0.7); }
  }
  // infiltrações
  if (m.lx(t, owner.x) > -15) {
    for (const p of outfield) {
      if (p === owner || p.human || (p.role !== 'ATT' && !(p.role === 'MID' && Math.random() < 0.3))) continue;
      if (p.runUntil < m.time && Math.random() < dt * 0.35 * (0.6 + t.style.directness)) {
        p.runUntil = m.time + rand(2, 3.5);
        p.runZ = clamp(p.z * 0.6, -14, 14);
      }
      if (p.runUntil > m.time) { p.target.x = Math.min(HL - 8, offLine + 12) * t.dir; p.target.z = p.runZ ?? p.z; }
      // às vezes o atacante erra o tempo da corrida e fica impedido
      if (p.runUntil > m.time && p.runLate === undefined) p.runLate = Math.random() < 0.18 * (1.1 - m.diff.aiSkill + 0.2) ? rand(0.6, 2) : 0;
      if (p.runUntil <= m.time) p.runLate = undefined;
    }
  }
}

function segDist2(ax, az, bx, bz, px, pz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(ax + dx * u - px, az + dz * u - pz);
}

function pressCarrier(m, p, o, dt, n) {
  const t = p.team;
  const gx = m.ownGoalX(t);
  // fica entre a bola e o gol; aperta quando perto
  const dx = gx - o.x, dz = -o.z, dl = Math.hypot(dx, dz) || 1;
  const d = dist(p, o);
  const ahead = n === 1 ? (d > 4 ? 0.8 : 1.2) : 5;
  const tx = o.x + o.vx * 0.3 + dx / dl * ahead, tz = o.z + o.vz * 0.3 + dz / dl * ahead;
  p.moveTo(tx, tz, 1, d > 5);
  if (d < 4) { p.face = m.ball.p; p.jockey = d < 2.5 && n === 1; }
  if (n !== 1 || p.action || p.fooled > 0) return;
  const skill = m.diff.aiSkill;
  p.aiTimer -= dt;
  if (p.aiTimer > 0) return;
  const bd = Math.hypot(m.ball.p.x - p.x, m.ball.p.z - p.z);
  // corpo do atacante entre mim e a bola (ele protege): não atravessa — contorna pelo lado
  // em que já está e espera a bola se expor (seção 9/10 da especificação)
  const bx0 = m.ball.p.x, bz0 = m.ball.p.z;
  const blocked = segDist2(p.x, p.z, bx0, bz0, o.x, o.z) < 0.45 && Math.hypot(bx0 - o.x, bz0 - o.z) < 1.0;
  if (blocked && bd < 2.5) {
    const ux = bx0 - o.x, uz = bz0 - o.z, ul = Math.hypot(ux, uz) || 1;
    const side = ((p.x - o.x) * -uz + (p.z - o.z) * ux) >= 0 ? 1 : -1;
    p.moveTo(o.x + ux / ul * 0.5 + (-uz / ul) * side * 0.95, o.z + uz / ul * 0.5 + (ux / ul) * side * 0.95, 1, false);
    p.face = m.ball.p; p.aiTimer = 0.12;
    return;
  }
  // bola exposta (toque longo do atacante): o bom antecipador ataca na hora
  const expo = Math.hypot(bx0 - o.x, bz0 - o.z) > 0.75;
  if (bd < 1.35) {
    p.aiTimer = rand(0.25, 0.6) * (expo ? 0.4 : 1) + m.diff.aiReaction * (1.2 - (p.a.ant ?? p.a.def) / 99 * 0.6);
    if (Math.random() < (expo ? 0.85 : 0.45) + skill * 0.15) {
      // mesma dividida do humano: bote curto até onde a bola vai estar no contato
      const bx = m.ball.p.x + m.ball.v.x * 0.22, bz = m.ball.p.z + m.ball.v.z * 0.22;
      const bl = Math.hypot(bx - p.x, bz - p.z) || 1, lx = (bx - p.x) / bl, lz = (bz - p.z) / bl;
      p.startAction('tackle', { face: Math.atan2(lz, lx), lunge: Math.min(7.5, Math.max(0, (bl - 0.55) / 0.2)), lx, lz });
      p.heading = Math.atan2(lz, lx);
    }
  } else if (bd < 3.2 && bd > 1.8 && o.speed > 5 && Math.random() < 0.06 * (0.5 + t.style.press)) {
    // carrinho quando o atacante escapa
    p.heading = Math.atan2(m.ball.p.z + m.ball.v.z * 0.25 - p.z, m.ball.p.x + m.ball.v.x * 0.25 - p.x);
    p.startAction('slide', { speed: Math.max(6.5, p.speed * 1.1) });
    p.aiTimer = 1.5;
  } else p.aiTimer = 0.15;
}

// Cabeceio / voleio quando a bola chega pelo alto.
function tryAerial(m, p) {
  if (p.action || !p.canPlay() || m.owner) return false;
  const b = m.ball;
  if (b.p.y < 0.6 && b.v.y <= 0) return false;
  const pr = m.pred;
  const t = p.team;
  // cabeceio: contato em ~0,32 s
  const kH = Math.max(0, Math.round(0.31 / pr.dt) - 1);
  const hx = pr.x(kH), hy = pr.y(kH), hz = pr.z(kH);
  const px = p.x + p.vx * 0.31, pz = p.z + p.vz * 0.31;
  const dH = Math.hypot(hx - px, hz - pz);
  if (hy > 1.35 && hy < 2.5 && dH < 1.0 && (p === t.chaser || (m.passTarget && m.passTarget.p === p) || dH < 0.7)) {
    const gx = m.goalX(t);
    const dGoal = Math.hypot(gx - p.x, p.z);
    const ownBox = m.inOwnBox(p, p.x, p.z);
    const shot = dGoal < 16 && Math.abs(p.z) < 12;
    let data;
    if (shot) data = { kind: 'shot', jump: clamp(hy - 1.75, 0, 0.6) };
    else if (ownBox || m.lx(t, p.x) < -25) data = { kind: 'pass', target: { x: p.x + t.dir * 25, z: p.z + (p.z > 0 ? 8 : -8) }, jump: clamp(hy - 1.75, 0, 0.6) };
    else {
      const rec = bestReceiver(m, p, 'air');
      data = { kind: 'pass', receiver: rec?.q, target: rec ? { x: rec.q.x, z: rec.q.z } : null, jump: clamp(hy - 1.75, 0, 0.6) };
    }
    p.heading = Math.atan2(hz - p.z, hx - p.x);
    p.startAction('header', data);
    return true;
  }
  // voleio no ataque
  const kV = Math.max(0, Math.round(0.27 / pr.dt) - 1);
  const vy = pr.y(kV), dV = Math.hypot(pr.x(kV) - (p.x + p.vx * 0.27), pr.z(kV) - (p.z + p.vz * 0.27));
  if (vy > 0.45 && vy < 1.2 && dV < 1.0 && m.lx(t, p.x) > HL - 20 && Math.abs(p.z) < 14 && p === t.chaser) {
    p.heading = Math.atan2(m.goalX(t) === 0 ? 0 : -p.z, m.goalX(t) - p.x);
    p.startAction('volley', { power: 0.8 });
    return true;
  }
  return false;
}

// ------------------------------------------------------------ quem tem a bola
export function carrierThink(m, p, dt) {
  const t = p.team;
  const gx = m.goalX(t);
  p.aiTimer -= dt;
  const press = m.pressure(p);
  if (p.intent && p.aiTimer > 0 && !(press > 0.8 && p.intent.kind === 'dribble')) { applyDribble(m, p, p.intent); return; }
  if (p.action) return;

  const skill = m.diff.aiSkill;
  const held = m.time - (p.gotBall || 0);
  const options = [];
  const dGoal = Math.hypot(gx - p.x, p.z);
  const xg = shotQuality(m, p);
  const shotBias = 0.7 + p.a.sho / 99 * 0.6;
  if (dGoal < 32) options.push({ kind: dGoal > 16 && Math.abs(p.z) > 6 && Math.random() < 0.5 ? 'finesse' : 'shot', s: xg * 3.4 * shotBias + (dGoal < 12 ? 0.3 : 0) });

  const lx = m.lx(t, p.x);
  for (const mode of ['ground', 'through', 'air']) {
    const r = bestReceiver(m, p, mode);
    if (r) options.push({ kind: mode === 'ground' ? 'pass' : mode === 'through' ? 'through' : (lx > 25 && Math.abs(p.z) > 16 ? 'cross' : 'long'), s: r.s, q: r.q });
  }
  const space = spaceAhead(m, p);
  options.push({ kind: 'dribble', s: 0.28 + Math.min(space, 12) * 0.04 + p.a.dri / 99 * 0.22 - press * 0.5 + (lx < -30 ? -0.3 : 0) });
  if (lx < -28 && press > 0.5) options.push({ kind: 'clear', s: 0.55 + press * 0.3 });

  // ruído conforme a dificuldade
  for (const o of options) o.s += (Math.random() - 0.5) * 0.25 * (1.25 - skill);
  options.sort((a, c) => c.s - a.s);
  let pick = options[0];
  // segura um instante depois de dominar
  if (pick.kind !== 'dribble' && held < 0.35 && press < 0.6) pick = { kind: 'dribble', s: 0 };

  p.aiTimer = rand(0.2, 0.45) + m.diff.aiReaction * 0.5;
  if (pick.kind === 'dribble') { p.intent = { kind: 'dribble' }; applyDribble(m, p, p.intent); return; }
  p.intent = null;
  const pw = pick.kind === 'shot' ? clamp(0.55 + dGoal / 60, 0.55, 0.92) : 0.6;
  if (pick.kind === 'shot' || pick.kind === 'finesse') {
    const tg = aiShotTarget(m, p);
    p.startAction(pick.kind, { target: tg, power: pw, face: Math.atan2(tg.z - p.z, tg.x - p.x), foot: footFor(p, tg) });
  } else if (pick.kind === 'clear') {
    const tg = { x: p.x + t.dir * rand(35, 50), z: clamp(p.z * 1.4 + rand(-10, 10), -HW + 3, HW - 3) };
    p.startAction('clear', { target: tg, power: 0.9, face: Math.atan2(tg.z - p.z, tg.x - p.x) });
  } else {
    const q = pick.q;
    const tg = { x: q.x, z: q.z };
    p.startAction(pick.kind, { receiver: q, target: tg, power: pick.kind === 'through' ? 0.55 : 0.6, face: Math.atan2(q.z - p.z, q.x - p.x), foot: footFor(p, tg) });
  }
}

function footFor(p, tg) {
  // usa o pé bom; o ruim só quando o alvo está muito do outro lado
  const side = angDiff(p.heading, Math.atan2(tg.z - p.z, tg.x - p.x));
  if (p.foot > 0 && side < -1.2 && p.a.dri > 80) return -1;
  if (p.foot < 0 && side > 1.2 && p.a.dri > 80) return 1;
  return p.foot;
}

function applyDribble(m, p, intent) {
  const t = p.team;
  const gx = m.goalX(t);
  // rumo ao gol, desviando dos adversários
  let dx = gx - p.x, dz = -p.z * 0.6;
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  let ax = dx, az = dz;
  for (const q of t.opp.players) {
    if (q.sentOff) continue;
    const rx = p.x - q.x, rz = p.z - q.z, d = Math.hypot(rx, rz);
    if (d > 7 || d < 0.01) continue;
    const front = (q.x - p.x) * dx + (q.z - p.z) * dz;
    if (front < -1) continue;
    const w = (7 - d) / 7 * 1.6;
    ax += rx / d * w; az += rz / d * w;
  }
  // não sair pela lateral
  if (Math.abs(p.z) > HW - 4) az -= Math.sign(p.z) * 1.5;
  const al = Math.hypot(ax, az) || 1;
  const space = spaceAhead(m, p);
  const sprint = space > 7 && p.stamina > 0.25;
  const s = sprint ? p.sprintSpd : p.jog;
  p.dx = ax / al * s; p.dz = az / al * s; p.sprint = sprint;
  // protege a bola se muito pressionado
  if (m.pressure(p) > 0.85 && space < 2) { p.shielding = true; p.slow = 0.5; }
}

function spaceAhead(m, p) {
  const t = p.team;
  const fx = t.dir, fz = 0;
  let minD = 30;
  for (const q of t.opp.players) {
    if (q.sentOff) continue;
    const rx = q.x - p.x, rz = q.z - p.z;
    const along = rx * fx + rz * fz;
    if (along < -1) continue;
    const lat = Math.abs(-rx * fz + rz * fx);
    if (lat < 3 + along * 0.4) minD = Math.min(minD, Math.hypot(rx, rz));
  }
  return minD;
}

// Chance de gol aproximada (ângulo de abertura, distância, bloqueios).
export function shotQuality(m, p) {
  const t = p.team;
  const gx = m.goalX(t);
  const dx = Math.abs(gx - p.x);
  const a1 = Math.atan2(GOAL.halfWidth - p.z * Math.sign(gx), dx), a2 = Math.atan2(-GOAL.halfWidth - p.z * Math.sign(gx), dx);
  const open = Math.abs(a1 - a2);
  const d = Math.hypot(gx - p.x, p.z);
  let xg = Math.pow(open / 1.2, 1.1) * Math.exp(-d / 16);
  let blockers = 0;
  for (const q of t.opp.players) {
    if (q.sentOff || q.isGK) continue;
    const along = ((q.x - p.x) * (gx - p.x) + (q.z - p.z) * (-p.z)) / (d * d);
    if (along < 0 || along > 1) continue;
    const cx = p.x + (gx - p.x) * along, cz = p.z + (-p.z) * along;
    if (Math.hypot(q.x - cx, q.z - cz) < 1.2 + along * 2.5) blockers++;
  }
  xg *= Math.pow(0.7, blockers);
  if (dx < 1) xg *= 0.2;
  return xg;
}

function aiShotTarget(m, p) {
  const t = p.team, gx = m.goalX(t);
  const gk = t.opp.gk;
  const z = (gk.z > 0.2 ? -1 : gk.z < -0.2 ? 1 : (Math.random() < 0.5 ? -1 : 1)) * rand(1.6, GOAL.halfWidth - 0.45);
  return { x: gx, y: Math.random() < 0.55 ? rand(0.2, 0.6) : rand(1.2, 2.05), z };
}

// Melhor companheiro para passe rasteiro, enfiada ou bola alta.
export function bestReceiver(m, p, mode, dirx, dirz) {
  const t = p.team;
  let best = null;
  const lxP = m.lx(t, p.x);
  const offLine = offsideLine(m, t);
  for (const q of t.players) {
    if (q === p || q.sentOff || !q.canPlay()) continue;
    const dx = q.x - p.x, dz = q.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 4) continue;
    if (mode === 'ground' && d > 38) continue;
    if (mode === 'air' && (d < 18 || d > 60)) continue;
    const lq = m.lx(t, q.x);
    if (mode === 'through' && (lq < lxP - 2 || d > 45 || q.isGK)) continue;
    // impedido não recebe (a IA respeita a linha)
    if (lq > 0 && lq > offLine + 0.2 && lq > m.lx(t, m.ball.p.x) && (dirx !== undefined || Math.random() > 0.25 * (1.15 - m.diff.aiSkill))) continue;
    if (q.isGK && (m.pressure(q) > 0.3 || mode !== 'ground')) continue;
    let s;
    const progress = (lq - lxP);
    const open = openness(m, q);
    if (dirx !== undefined) {
      const ang = Math.abs(angDiff(Math.atan2(dirz, dirx), Math.atan2(dz, dx)));
      if (ang > 1.05) continue;
      s = Math.cos(ang) * 2 - d / 45 + Math.min(open, 6) * 0.04;
    } else {
      let tx = q.x, tz = q.z;
      if (mode === 'through') {
        const lead = 8;
        tx = q.x + t.dir * lead; tz = q.z - q.z * 0.1;
        if (m.lx(t, tx) > HL - 3) continue;
      }
      const risk = laneRisk(m, p, tx, tz, mode);
      s = 0.36 + clamp(progress, -15, 25) * 0.013 + Math.min(open, 7) * 0.045 - risk * 1.6 - (d > 30 ? 0.15 : 0);
      if (mode === 'through') s += q.runUntil > m.time ? 0.35 : -0.25;
      if (mode === 'air') s -= 0.4 - t.style.directness * 0.12;
      if (m.lx(t, q.x) > HL - 17 && Math.abs(q.z) < 18) s += 0.15;
      if (lq < -35) s -= 0.2;
    }
    if (!best || s > best.s) best = { q, s };
  }
  return best;
}

function openness(m, q) {
  let o = 20;
  for (const r of q.team.opp.players) if (!r.sentOff) o = Math.min(o, Math.hypot(r.x - q.x, r.z - q.z));
  return o;
}

function laneRisk(m, p, tx, tz, mode) {
  const dx = tx - p.x, dz = tz - p.z, L = Math.hypot(dx, dz) || 1;
  const speed = mode === 'air' ? 20 : 10;
  let risk = 0;
  for (const o of p.team.opp.players) {
    if (o.sentOff) continue;
    if (mode === 'air') {
      const d = Math.hypot(o.x - tx, o.z - tz);
      risk = Math.max(risk, clamp((3 - d) / 3, 0, 1) * 0.8);
      continue;
    }
    const u = clamp(((o.x - p.x) * dx + (o.z - p.z) * dz) / (L * L), 0, 1);
    const cx = p.x + dx * u, cz = p.z + dz * u;
    const d = Math.hypot(o.x - cx, o.z - cz);
    const tb = (u * L) / speed;
    const to = Math.max(0, d - 0.9) / 6.5 + 0.2;
    risk = Math.max(risk, clamp((tb - to) * 1.6 + 0.4, 0, 1));
  }
  return risk;
}

function celebrate(m, p) {
  const c = p.celebTarget, gi = m.goalInfo;
  if (c && !c.mate) {
    // autor: corre até a torcida; perto dela faz o gesto (a joelhada começa antes, deslizando)
    if (p.celebDone) { p.dx = p.dz = 0; if (!p.action) p.face = { x: c.x * 1.2, z: c.z * 1.2 }; return; }
    const v = p.celebVariant || 0;
    const d = p.moveTo(c.x, c.z, 1, true);
    if (v !== 0 && d < (v === 1 ? 5.5 : 1.6) && (!p.action || p.action.type !== 'celebrate')) {
      p.startAction('celebrate', { variant: v, dur: v === 1 ? 3.2 : 3.6 });
      p.celebDone = true;
    } else if (v === 0 && d < 1.2) { p.celebDone = true; p.dx = p.dz = 0; }
  } else if (c && c.mate) {
    // companheiros: reagem, correm até o autor e fecham o abraço em roda
    const sc = gi?.scorer;
    if (!sc || gi.t < c.delay) { p.dx = p.dz = 0; return; }
    if (p.action && p.action.type === 'hug') return;
    if (p.isGK) { p.moveTo(p.x + Math.sign(c.x) * 0.5, p.z, 0.4, false); if (!p.action && gi.t > 1.5) p.startAction('celebrate', { variant: 2, dur: 3 }); return; }
    const k = p.team.players.indexOf(p), ang = k * 2.4 + 0.7;
    const sx = sc.x + sc.vx * 0.35, sz = sc.z + sc.vz * 0.35;
    const tx = sx + Math.cos(ang) * 0.62, tz = sz + Math.sin(ang) * 0.62;
    const d = p.moveTo(tx, tz, 1, true);
    const scStill = Math.hypot(sc.vx, sc.vz) < 1.2;
    if (d < 1.0 && scStill) p.startAction('hug', { dur: 6, variant: k, face: Math.atan2(sc.z - p.z, sc.x - p.x) });
  } else {
    p.moveTo(p.x * 0.98, p.z * 0.98, 0.15, false);
    p.face = m.ball.p;
  }
}

// ---------------------------------------------------------- bolas paradas
export function setpieceAI(m, dt) {
  const sp = m.sp;
  if (!sp) return;
  sp.t += dt;
  const team = sp.team, opp = team.opp;
  const b = m.ball.p;
  const gx = m.goalX(team), dir = team.dir;
  // posicionamento
  if (sp.type === 'corner' || ((sp.type === 'freekick' || sp.type === 'indirect') && Math.abs(gx - b.x) < 40)) {
    const spots = [
      [5.5, 3 * Math.sign(b.z || 1)], [6.5, -3 * Math.sign(b.z || 1)], [11, 0], [9, 5], [16.5, -2], [8, -8],
    ];
    const line = offsideLine(m, team);
    const att = team.players.filter(p => !p.sentOff && !p.isGK && p !== sp.taker).sort((a, c) => c.a.phy + c.data.look.height * 30 - (a.a.phy + a.data.look.height * 30));
    att.forEach((p, k) => {
      if (humanDriving(m, p)) return;
      if (k < spots.length && k < 5) {
        let x = gx - dir * spots[k][0], z = spots[k][1];
        if (sp.type !== 'corner') x = Math.min(m.lx(team, x), line - 0.5) * dir;
        p.target.x = x; p.target.z = z;
      }
      p.moveTo(p.target.x, p.target.z, 0.6, false);
      p.face = b;
    });
    const def = opp.players.filter(p => !p.sentOff && !p.isGK && !p.inWall);
    def.forEach((p, k) => {
      if (humanDriving(m, p)) return;
      const q = att[k];
      if (q && k < 6) { const og = m.ownGoalX(opp); p.target.x = q.target.x + Math.sign(og - q.target.x) * 1; p.target.z = q.target.z * 0.9; }
      p.moveTo(p.target.x, p.target.z, 0.6, false);
      p.face = b;
    });
  } else {
    for (const t of m.teams) for (const p of t.players) {
      if (p.sentOff || p.isGK || p === sp.taker || p.inWall || humanDriving(m, p)) continue;
      if (sp.type === 'kickoff' || sp.type === 'penalty') { p.dx = p.dz = 0; p.face = b; continue; }
      p.moveTo(p.target.x, p.target.z, 0.5, false);
      if (sp.type === 'throwin' && t === team) {
        // dois se aproximam para receber
        const near = team.players.filter(q => !q.sentOff && !q.isGK && q !== sp.taker).sort((a, c) => dist(a, sp.taker) - dist(c, sp.taker)).slice(0, 2);
        const k = near.indexOf(p);
        if (k >= 0) p.moveTo(clamp(sp.x + dir * (k ? 9 : -2), -HL + 2, HL - 2), sp.z * 0.72 + (k ? 0 : -Math.sign(sp.z) * 4), 0.8, false);
      }
      p.face = b;
    }
  }
  for (const p of m.wall || []) { p.dx = p.dz = 0; p.face = b; }
  if (!sp.taken && sp.taker) { sp.taker.dx = sp.taker.dz = 0; }

  // cobrador da IA
  const human = team.human && !(m.shootout && false);
  const wait = sp.type === 'kickoff' ? 1.2 : sp.type === 'penalty' ? 1.8 : 1.6;
  if (sp.taken || (human && sp.t < 14) || sp.t < wait) return;
  aiTakeSetpiece(m, sp);
}

function aiTakeSetpiece(m, sp) {
  const team = sp.team, p = sp.taker, b = m.ball.p;
  const gx = m.goalX(team), dir = team.dir;
  if (sp.type === 'kickoff') {
    const q = team.players.filter(q => q !== p && !q.sentOff).sort((a, c) => dist(a, p) - dist(c, p))[0];
    sp.aim = Math.atan2(q.z - p.z, q.x - p.x);
    m.takeSetpiece('pass', { receiver: q, target: { x: q.x, z: q.z }, power: 0.35 });
    return;
  }
  if (sp.type === 'throwin') {
    const cands = team.players.filter(q => q !== p && !q.sentOff && !q.isGK && dist(q, p) < 22).sort((a, c) => (openness(m, c) - dist(c, p) * 0.2) - (openness(m, a) - dist(a, p) * 0.2));
    const q = cands[0];
    if (q) { sp.aim = Math.atan2(q.z - p.z, q.x - p.x); m.takeSetpiece('pass', { receiver: q, target: { x: q.x, z: q.z } }); }
    else m.takeSetpiece('pass', { target: { x: p.x + dir * 10, z: p.z * 0.7 } });
    return;
  }
  if (sp.type === 'corner') {
    const box = team.players.filter(q => !q.sentOff && q !== p && Math.abs(gx - q.x) < 13 && Math.abs(q.z) < 12);
    const q = box[Math.floor(Math.random() * box.length)];
    const tg = q ? { x: q.target.x, z: q.target.z } : { x: gx - dir * 8, z: 0 };
    sp.aim = Math.atan2(tg.z - p.z, tg.x - p.x);
    m.takeSetpiece('cross', { receiver: q, target: tg, power: 0.75 });
    return;
  }
  if (sp.type === 'goalkick') {
    if (Math.random() < 0.45) {
      const q = team.players.filter(q => q.role === 'DEF' && !q.sentOff).sort((a, c) => openness(m, c) - openness(m, a))[0];
      if (q && openness(m, q) > 8) { sp.aim = Math.atan2(q.z - p.z, q.x - p.x); m.takeSetpiece('pass', { receiver: q, target: { x: q.x, z: q.z }, power: 0.6 }); return; }
    }
    const q = team.players.filter(q => (q.role === 'ATT' || q.role === 'MID') && !q.sentOff).sort(() => Math.random() - 0.5)[0];
    const tg = { x: q.x, z: q.z };
    sp.aim = Math.atan2(tg.z - p.z, tg.x - p.x);
    m.takeSetpiece('long', { receiver: q, target: tg, power: 0.9 });
    return;
  }
  if (sp.type === 'penalty') {
    const z = (Math.random() < 0.5 ? -1 : 1) * rand(1.5, GOAL.halfWidth - 0.5);
    const tg = { x: gx, y: Math.random() < 0.6 ? rand(0.2, 0.7) : rand(1.1, 1.9), z };
    if (Math.random() < 0.08) tg.z = rand(-0.6, 0.6);
    sp.aim = Math.atan2(tg.z - b.z, tg.x - b.x);
    m.takeSetpiece('penalty', { target: tg, power: rand(0.55, 0.85) });
    return;
  }
  // falta
  const dGoal = Math.hypot(gx - b.x, b.z);
  const angleOk = Math.abs(b.z) < 22;
  if (sp.type === 'freekick' && dGoal < 30 && angleOk) {
    const side = b.z > 0 ? -1 : 1;
    const tg = { x: gx, y: rand(1.3, 2.1), z: side * rand(2.0, GOAL.halfWidth - 0.45) };
    sp.aim = Math.atan2(tg.z - b.z, tg.x - b.x);
    m.takeSetpiece('freekick', { target: tg, power: 0.7, foot: p.foot });
    return;
  }
  const r = bestReceiver(m, p, dGoal < 45 ? 'air' : 'ground') || bestReceiver(m, p, 'ground');
  if (r) {
    sp.aim = Math.atan2(r.q.z - p.z, r.q.x - p.x);
    m.takeSetpiece(dGoal < 45 ? 'cross' : 'pass', { receiver: r.q, target: { x: r.q.x, z: r.q.z }, power: 0.6 });
  } else m.takeSetpiece('long', { target: { x: gx - dir * 12, z: 0 }, power: 0.8 });
}
