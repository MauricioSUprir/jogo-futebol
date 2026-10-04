// Controle do jogador humano: movimento relativo à câmera, passe/chute com
// força pelo tempo segurando o botão, mira pelo analógico, drible, proteção,
// desarme, carrinho, pressão, troca de jogador (manual e automática) e bolas paradas.
import { PITCH, GOAL, clamp, angDiff } from './config.js';
import { bestReceiver } from './ai.js';
import { userDistribute } from './gk.js';

const HL = PITCH.halfL, HW = PITCH.halfW;
const power = (h) => clamp(0.12 + h / 0.95, 0.12, 1.1);

export function humanStep(m, cmd, dt) {
  const team = m.userTeam;
  if (!team || !cmd) return;
  let p = m.controlled;
  const mag = Math.min(1, Math.hypot(cmd.mx, cmd.mz));
  const mx = mag > 0.15 ? cmd.mx : 0, mz = mag > 0.15 ? cmd.mz : 0;

  // mergulho do goleiro humano no pênalti: lado do analógico
  if (m.sp && m.sp.type === 'penalty' && m.sp.team !== team) {
    const gk = team.gk, s = Math.sign(m.ownGoalX(team));
    const right = { x: -Math.sin(gk.heading), z: Math.cos(gk.heading) };
    const lat = mx * right.x + mz * right.z;
    m.userDive = { side: Math.abs(lat) > 0.3 ? Math.sign(lat) : 0, height: clamp(-(mx * s) * 0.9 + 0.2, 0, 1) };
    if (Math.abs(lat) <= 0.3 && Math.abs(mx) > 0.5) m.userDive.height = 0.8;
  }
  if (m.phase === 'play' && m.lastSetpiece?.type === 'penalty' && m.userDive) { /* usado pelo gk no chute */ }

  if (m.phase === 'setpiece' && m.sp && m.sp.team === team && m.sp.taker === p) { setpiece(m, p, cmd, mx, mz, dt); return; }
  if (m.phase !== 'play') return;

  // goleiro com a bola na mão: humano repõe
  if (team.gk.holdingBall && m.holder === team.gk) {
    if (p !== team.gk) m.setControlled(team.gk);
    p = team.gk;
    moveInput(p, mx, mz, false, 0.6);
    if (cmd.release.pass || cmd.release.through) userDistribute(m, p, 'pass', mx, mz);
    else if (cmd.release.long || cmd.release.shoot) userDistribute(m, p, 'long', mx, mz);
    return;
  }

  // troca manual
  if (cmd.press.switch) switchPlayer(m, true);
  autoSwitch(m);
  p = m.controlled;
  if (!p || p.sentOff) { switchPlayer(m, false); p = m.controlled; if (!p) return; }

  p.face = null; p.jockey = false; p.shielding = false; p.slow = 1;
  const owner = m.owner;
  const sprint = cmd.held.sprint && mag > 0.3;

  if (p.stun > 0 || (p.action && ['slide', 'fall', 'getup', 'gk_dive', 'throwin'].includes(p.action.type))) return;

  if (owner === p) {
    // ---------------------------------------------------------------- ataque
    if (cmd.held.shield) { p.shielding = true; p.slow = 0.55; const o = nearestOpp(m, p); if (o) p.face = { x: 2 * p.x - o.x, z: 2 * p.z - o.z }; }
    moveInput(p, mx, mz, sprint, 1);
    keepBall(m, p);
    if (p.action) return;
    const dirx = mag > 0.15 ? mx : p.fx, dirz = mag > 0.15 ? mz : p.fz;
    if (cmd.release.shoot) return shoot(m, p, 'shot', power(cmd.hold.shoot), mx, mz);
    if (cmd.release.finesse) return shoot(m, p, 'finesse', power(cmd.hold.finesse), mx, mz);
    if (cmd.release.chip) return shoot(m, p, 'chip', 0.6, mx, mz);
    if (cmd.release.pass) return pass(m, p, 'pass', power(cmd.hold.pass) * 0.85, dirx, dirz);
    if (cmd.release.through) return pass(m, p, 'through', power(cmd.hold.through), dirx, dirz);
    if (cmd.release.long) return pass(m, p, 'long', power(cmd.hold.long), dirx, dirz);
    if (cmd.press.skill || Math.hypot(cmd.rx, cmd.rz) > 0.7 && !m.skillCd) skill(m, p, cmd, mx, mz);
    if (m.skillCd) m.skillCd = Math.max(0, m.skillCd - dt) || 0;
    return;
  }

  const oppHas = owner && owner.team !== team;
  if (!oppHas) {
    // bola solta ou com companheiro: comandos de primeira ficam guardados
    moveInput(p, mx, mz, sprint, 1);
    autoReceive(m, p, mx, mz);
    for (const k of ['shoot', 'finesse', 'chip', 'pass', 'through', 'long']) {
      if (cmd.release[k]) p.queued = { kind: k, power: power(cmd.hold[k]), until: m.time + 0.9, dx: mx, dz: mz };
    }
    firstTime(m, p);
    return;
  }

  // ------------------------------------------------------------------ defesa
  const carrier = owner;
  if (cmd.held.pass) {
    // pressão/contenção automática rumo ao portador
    const gx = m.ownGoalX(team);
    const dx = gx - carrier.x, dz = -carrier.z, dl = Math.hypot(dx, dz) || 1;
    const tx = carrier.x + carrier.vx * 0.25 + dx / dl * 0.9, tz = carrier.z + carrier.vz * 0.25 + dz / dl * 0.9;
    const d = Math.hypot(carrier.x - p.x, carrier.z - p.z);
    p.moveTo(tx + mx * 1.5, tz + mz * 1.5, 1, sprint || d > 5);
    p.face = carrier;
    p.jockey = d < 2.6 && !sprint;
    const bd = Math.hypot(m.ball.p.x - p.x, m.ball.p.z - p.z);
    if (bd < 1.3 && !p.action && (m.tackleCd || 0) <= m.time) {
      m.tackleCd = m.time + 0.7;
      p.startAction('tackle', { face: Math.atan2(m.ball.p.z - p.z, m.ball.p.x - p.x) });
    }
  } else {
    moveInput(p, mx, mz, sprint, 1);
    if (cmd.held.jockey) { p.face = carrier; p.jockey = true; p.slow = 0.7; }
  }
  // dividida (desarme em pé): o comando fica guardado ~0,4 s, então apertar um pouco
  // antes de chegar já sai na hora certa; perto da bola dá um bote curto até ela
  if (cmd.press.tackle) p.wantTackle = m.time + 0.4;
  if (p.wantTackle > m.time && !p.action && (m.tackleCd || 0) <= m.time) {
    const b = m.ball, lead = 0.22;
    const bx = b.p.x + b.v.x * lead, bz = b.p.z + b.v.z * lead;
    const d = Math.hypot(bx - p.x, bz - p.z);
    if (d < 2.3 && b.p.y < 0.6) {
      p.wantTackle = 0; m.tackleCd = m.time + 0.55;
      const lx = (bx - p.x) / (d || 1), lz = (bz - p.z) / (d || 1);
      p.startAction('tackle', { face: Math.atan2(lz, lx), lunge: clamp((d - 0.55) / 0.2, 0, 7.5), lx, lz });
      p.heading = Math.atan2(lz, lx);
    } else {
      // longe: corre até o portador enquanto o comando estiver guardado
      p.moveTo(carrier.x + carrier.vx * 0.3, carrier.z + carrier.vz * 0.3, 1, true);
    }
  }
  if (cmd.press.shoot && !p.action && p.speed > 1.5) {
    p.startAction('slide', { speed: Math.max(6.5, p.speed * 1.08) });
  }
  m.teamPressCall = cmd.held.long ? team : null;
  m.userGKRush = cmd.held.through;
}

function moveInput(p, mx, mz, sprint, scale) {
  const s = (sprint ? p.sprintSpd : p.jog) * scale;
  p.dx = mx * s; p.dz = mz * s;
  p.sprint = sprint;
}

// Como nos jogos de futebol atuais: com a bola no pé o jogador não foge dela. O
// analógico dá a direção, mas se a bola ficou para trás/de lado ou longe o corpo
// vai até ela primeiro, e logo após o domínio a velocidade é limitada.
function keepBall(m, p) {
  const b = m.ball;
  if (p.action || b.held || b.p.y > 0.6) return;
  // posição relativa prevista (descontando o próprio movimento do jogador)
  const rx = b.p.x + (b.v.x - p.vx) * 0.12 - p.x, rz = b.p.z + (b.v.z - p.vz) * 0.12 - p.z;
  const d = Math.hypot(rx, rz) || 1e-6;
  let dx = p.dx, dz = p.dz;
  let s = Math.hypot(dx, dz);
  const ux = s > 0.01 ? dx / s : p.fx, uz = s > 0.01 ? dz / s : p.fz;
  const ahead = (rx * ux + rz * uz);            // bola à frente na direção pedida?
  // peso do "ir até a bola": cresce com a distância e quando ela não está à frente
  // (a condução em match.js já mantém a bola no pé; aqui só quando ela ficou longe ou
  // para trás — sem puxar para o lado do pé bom, senão a corrida entorta)
  const k = clamp((d - 0.95) / 0.5, 0, 1) + clamp((0.1 - ahead) / 0.35, 0, 1) * 0.7 * clamp((d - 0.45) / 0.3, 0, 1);
  const bs = Math.hypot(b.v.x, b.v.z);
  if (k > 0) {
    const w = Math.min(1, k);
    const gx = ux * (1 - w) + rx / d * w, gz = uz * (1 - w) + rz / d * w, gl = Math.hypot(gx, gz) || 1;
    const want = Math.max(s, Math.min(p.sprintSpd, bs + d * 2.5));
    dx = gx / gl * want; dz = gz / gl * want; s = want;
  }
  // logo após o domínio (amortecendo) ou com a bola atrás: não arranca na frente dela
  const along = (b.v.x * dx + b.v.z * dz) / (s || 1);
  if ((p.cushion > 0 || ahead < 0.2) && s > 0.01) {
    const cap = Math.max(p.jog * 0.45, along + 1.6);
    if (s > cap) { dx *= cap / s; dz *= cap / s; }
  }
  p.dx = dx; p.dz = dz;
}

// Passe vindo para o jogador controlado (ou bola solta que ele alcança primeiro):
// ele vai ao encontro da bola sozinho; o analógico só ajusta um pouco.
function autoReceive(m, p, mx, mz) {
  if (m.owner || m.ball.held || p.action) return;
  const pt = m.passTarget;
  const mine = pt && pt.p === p;
  const bs = m.ball.hspeed();
  const coming = !pt && bs > 4 && p.interceptT < 1.2 && p.interceptT <= Math.min(...p.team.players.filter(q => q !== p && !q.sentOff).map(q => q.interceptT ?? 99));
  if (!mine && !coming) return;
  if (p.ix === undefined) return;
  p.moveTo(p.ix + mx * 0.8, p.iz + mz * 0.8, 1, p.interceptT > 0.6);
  p.face = m.ball.p;
}

function nearestOpp(m, p) {
  let best = null, bd = 1e9;
  for (const q of p.team.opp.players) { if (q.sentOff) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
  return best;
}

// Mira do chute pelo analógico: lateral do gol; sem analógico, canto longe do goleiro.
export function shotTarget(m, p, pw, mx, mz) {
  const team = p.team, gx = m.goalX(team);
  const gk = team.opp.gk;
  const mag = Math.hypot(mx, mz);
  let z;
  if (mag > 0.25) {
    // componente do analógico ao longo da linha do gol (eixo z)
    const lat = mz / Math.max(mag, 1e-3);
    z = clamp(lat * 1.15, -1, 1) * (GOAL.halfWidth - 0.4);
    if (Math.abs(lat) < 0.35) z = 0;
  } else {
    z = (gk.z > 0.25 ? -1 : gk.z < -0.25 ? 1 : (p.z > 0 ? -1 : 1)) * (GOAL.halfWidth - 0.6);
  }
  return { x: gx, y: 0.3 + pw * 1.25, z };
}

function shoot(m, p, kind, pw, mx, mz) {
  const tg = shotTarget(m, p, pw, mx, mz);
  const face = Math.atan2(tg.z - p.z, tg.x - p.x);
  p.startAction(kind, { target: tg, power: pw, face, foot: pickFoot(p, face) });
  m.emit('vibrate', { ms: 25 });
}

function pickFoot(p, face) {
  const side = angDiff(p.heading, face);
  if (p.foot > 0 && side < -1.0) return -1;
  if (p.foot < 0 && side > 1.0) return 1;
  return p.foot;
}

function pass(m, p, kind, pw, dirx, dirz) {
  const team = p.team;
  const lx = m.lx(team, p.x);
  let mode = kind === 'long' ? 'air' : kind === 'through' ? 'through' : 'ground';
  let type = kind;
  if (kind === 'long' && lx > 20 && Math.abs(p.z) > 14) type = 'cross';
  const assist = m.settings.passAssist !== false;
  let r = bestReceiver(m, p, mode, dirx, dirz);
  if (!r && mode === 'through') r = bestReceiver(m, p, 'ground', dirx, dirz);
  if (!r && mode === 'air') r = bestReceiver(m, p, 'ground', dirx, dirz);
  let tg, rec = null;
  if (r && assist) { rec = r.q; tg = { x: rec.x, z: rec.z }; }
  else {
    const l = Math.hypot(dirx, dirz) || 1;
    const dist = mode === 'air' ? 18 + pw * 32 : 6 + pw * 26;
    tg = { x: clamp(p.x + dirx / l * dist, -HL + 1, HL - 1), z: clamp(p.z + dirz / l * dist, -HW + 1, HW - 1) };
    if (r) rec = r.q;
  }
  const face = Math.atan2(tg.z - p.z, tg.x - p.x);
  p.startAction(type, { receiver: rec, target: tg, power: pw, face, foot: pickFoot(p, face) });
}

// Drible: toque para o lado com finta de corpo; o marcador pode "comprar".
function skill(m, p, cmd, mx, mz) {
  if ((m.skillT || 0) > m.time) return;
  m.skillT = m.time + 0.6;
  const b = m.ball;
  const right = { x: -p.fz, z: p.fx };
  let side = 0;
  const sx = Math.hypot(cmd.rx, cmd.rz) > 0.5 ? cmd.rx : mx, sz = Math.hypot(cmd.rx, cmd.rz) > 0.5 ? cmd.rz : mz;
  side = Math.sign(sx * right.x + sz * right.z) || (Math.random() < 0.5 ? 1 : -1);
  const fwd = 2.2 + p.speed * 0.6;
  b.kick(p.fx * fwd + right.x * side * 4.2, 0, p.fz * fwd + right.z * side * 4.2);
  p.touchTimer = 0.45;
  p.vx += right.x * side * 2.5; p.vz += right.z * side * 2.5;
  p.pose.lean = side * 0.5;
  m.emit('skill', {});
  const chance = 0.45 + (p.a.dri - 70) / 60;
  for (const q of p.team.opp.players) {
    if (q.sentOff || q.isGK) continue;
    if (Math.hypot(q.x - p.x, q.z - p.z) < 3.2 && Math.random() < chance - (q.a.def - 70) / 90) {
      q.fooled = 0.7; q.stun = 0.35;
      q.vx -= right.x * side * 2; q.vz -= right.z * side * 2;
    }
  }
}

// Executa o comando guardado quando a bola chega (passe/chute de primeira, cabeceio).
function firstTime(m, p) {
  const q = p.queued;
  if (!q || p.action) return;
  if (m.time > q.until) { p.queued = null; return; }
  const b = m.ball.p;
  const pr = m.pred;
  const k = Math.max(0, Math.round(0.3 / pr.dt) - 1);
  const hx = pr.x(k), hy = pr.y(k), hz = pr.z(k);
  const dh = Math.hypot(hx - (p.x + p.vx * 0.3), hz - (p.z + p.vz * 0.3));
  if (hy > 1.3 && hy < 2.6 && dh < 1.1) {
    const shot = ['shoot', 'finesse', 'chip'].includes(q.kind);
    const r = shot ? null : bestReceiver(m, p, 'air', q.dx || p.fx, q.dz || p.fz);
    p.heading = Math.atan2(hz - p.z, hx - p.x);
    p.startAction('header', { kind: shot ? 'shot' : 'pass', receiver: r?.q, target: shot ? shotTarget(m, p, 0.3, q.dx, q.dz) : r ? { x: r.q.x, z: r.q.z } : null, jump: clamp(hy - 1.75, 0, 0.6) });
    p.queued = null;
    return;
  }
  const d = Math.hypot(b.x - p.footX(), b.z - p.footZ());
  if (d < 1.25 && b.y < 1.3) {
    const shot = ['shoot', 'finesse', 'chip'].includes(q.kind);
    if (shot) {
      const kind = b.y > 0.45 ? 'volley' : q.kind === 'shoot' ? 'shot' : q.kind;
      const tg = shotTarget(m, p, q.power, q.dx, q.dz);
      p.startAction(kind, { target: tg, power: q.power, face: Math.atan2(tg.z - p.z, tg.x - p.x) });
    } else {
      const dirx = Math.hypot(q.dx, q.dz) > 0.15 ? q.dx : p.fx, dirz = Math.hypot(q.dx, q.dz) > 0.15 ? q.dz : p.fz;
      pass(m, p, q.kind === 'pass' ? 'pass' : q.kind, q.power * 0.85, dirx, dirz);
    }
    p.queued = null;
  }
}

// Troca: o companheiro que chega primeiro na bola (ou no portador adversário).
function switchList(m) {
  const team = m.userTeam;
  const cur = m.controlled;
  const b = m.ball.p;
  return team.players.filter(q => !q.sentOff && !q.isGK && q !== cur)
    .map(q => ({ q, s: q.interceptT + Math.hypot(q.x - b.x, q.z - b.z) * 0.02 - (m.lx(team, q.x) < m.lx(team, b.x) ? 0.3 : 0) }))
    .sort((a, c) => a.s - c.s);
}
function switchIndex(m, n, manual) {
  return manual && m.lastSwitchT && m.time - m.lastSwitchT < 0.9 ? (m.switchIdx + 1) % Math.min(3, n) : 0;
}
export function switchPlayer(m, manual) {
  const list = switchList(m);
  if (!list.length) return;
  const idx = switchIndex(m, list.length, manual);
  m.switchIdx = idx; m.lastSwitchT = m.time;
  m.setControlled(list[idx].q);
}
// Quem o botão TROCAR pegaria agora (para o indicador amarelo na tela)
export function switchCandidate(m) {
  if (!m.userTeam || m.phase !== 'play') return null;
  const list = switchList(m);
  return list.length ? list[switchIndex(m, list.length, true)].q : null;
}

function autoSwitch(m) {
  const team = m.userTeam;
  const owner = m.owner;
  const cur = m.controlled;
  const key = owner ? owner.idx : -1;
  if (key !== m.lastOwnerKey) {
    m.lastOwnerKey = key;
    if (owner && owner.team !== team && cur) {
      const d = Math.hypot(cur.x - owner.x, cur.z - owner.z);
      if (d > 12) switchPlayer(m, false);
    }
    return;
  }
  // bola solta longe do controlado: passa para quem chega antes
  if (!owner && cur && !m.passTarget && m.time - (m.lastSwitchT || 0) > 1.2) {
    const best = team.chaser;
    if (best && best !== cur && cur.interceptT - best.interceptT > 1.2 && Math.hypot(cur.x - m.ball.p.x, cur.z - m.ball.p.z) > 14) {
      m.setControlled(best); m.lastSwitchT = m.time;
    }
  }
}

// ---------------------------------------------------------- bolas paradas
function setpiece(m, p, cmd, mx, mz, dt) {
  const sp = m.sp;
  p.dx = p.dz = 0;
  if (sp.taken) return;
  const mag = Math.hypot(mx, mz);
  // mira: gira a direção com o analógico
  if (mag > 0.3) {
    let want = Math.atan2(mz, mx);
    if (sp.type === 'throwin') {
      const into = Math.atan2(-Math.sign(sp.z), 0);
      const d = clamp(angDiff(into, want), -1.35, 1.35);
      want = into + d;
    }
    if (sp.type === 'penalty' || sp.type === 'freekick' && Math.hypot(m.goalX(p.team) - sp.x, sp.z) < 32) {
      // em cobrança direta, o analógico mira o gol (mostrado pelo indicador)
      sp.aimStick = { mx, mz };
    } else {
      const d = angDiff(sp.aim, want);
      sp.aim += clamp(d, -3 * dt, 3 * dt);
    }
    if (sp.type !== 'penalty' && !(sp.type === 'freekick' && Math.hypot(m.goalX(p.team) - sp.x, sp.z) < 32)) p.heading = sp.aim;
  }
  const dirx = Math.cos(sp.aim), dirz = Math.sin(sp.aim);
  const rel = cmd.release;
  const direct = sp.type === 'penalty' || (sp.type === 'freekick' && Math.hypot(m.goalX(p.team) - sp.x, sp.z) < 35);
  if (direct && (rel.shoot || rel.finesse || rel.chip)) {
    const k = rel.chip ? 'chip' : rel.finesse ? 'finesse' : sp.type === 'penalty' ? 'penalty' : 'freekick';
    const st = sp.aimStick || { mx: 0, mz: 0 };
    const pw = power(cmd.hold[rel.chip ? 'chip' : rel.finesse ? 'finesse' : 'shoot']);
    const tg = shotTarget(m, p, pw * (sp.type === 'freekick' ? 1.15 : 0.9), st.mx, st.mz);
    if (sp.type === 'freekick' && k === 'freekick') tg.y = clamp(1.2 + pw * 1.0, 0.9, 2.6);
    sp.aim = Math.atan2(tg.z - m.ball.p.z, tg.x - m.ball.p.x);
    m.takeSetpiece(k, { target: tg, power: pw, foot: p.foot });
    return;
  }
  for (const k of ['pass', 'long', 'through', 'shoot']) {
    if (!rel[k]) continue;
    const pw = power(cmd.hold[k]);
    const mode = k === 'long' || k === 'shoot' ? 'air' : 'ground';
    const r = bestReceiver(m, p, mode, dirx, dirz) || bestReceiver(m, p, 'ground', dirx, dirz);
    let tg = r ? { x: r.q.x, z: r.q.z } : { x: p.x + dirx * (mode === 'air' ? 30 : 14), z: p.z + dirz * (mode === 'air' ? 30 : 14) };
    if (sp.type === 'corner' && mode === 'air' && !r) tg = { x: m.goalX(p.team) - p.team.dir * 8, z: 0 };
    tg.x = clamp(tg.x, -HL + 1, HL - 1); tg.z = clamp(tg.z, -HW + 1, HW - 1);
    sp.aim = Math.atan2(tg.z - p.z, tg.x - p.x);
    const kind = sp.type === 'throwin' ? (mode === 'air' ? 'long' : 'pass') : sp.type === 'corner' && mode === 'air' ? 'cross' : mode === 'air' ? 'long' : 'pass';
    m.takeSetpiece(kind, { receiver: r?.q, target: tg, power: sp.type === 'kickoff' ? Math.min(pw, 0.5) : pw });
    return;
  }
}
