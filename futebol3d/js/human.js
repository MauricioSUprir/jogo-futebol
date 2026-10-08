// Controle do jogador humano: movimento relativo à câmera, passe/chute com
// força pelo tempo segurando o botão, mira pelo analógico, drible, proteção,
// desarme, carrinho, pressão, troca de jogador (manual e automática) e bolas paradas.
import { PITCH, GOAL, ANIM, clamp, angDiff } from './config.js';
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
  // sair com o goleiro: botão GOLEIRO (toque), G (teclado) ou Y segurado (controle). Lido sempre, mesmo
  // com o jogador controlado caído ou num carrinho: quem sai é o goleiro
  m.userGKRush = !!(cmd.held.gkrush || cmd.held.through);

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
  else if (cmd.press.switchdir && (cmd.swx || cmd.swz)) switchDirectional(m, cmd.swx, cmd.swz);
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

}

function moveInput(p, mx, mz, sprint, scale) {
  const s = (sprint ? p.sprintSpd : p.jog) * scale;
  p.dx = mx * s; p.dz = mz * s;
  p.sprint = sprint;
}

// Condução sem ímã (auditoria, Fase 2): a bola só muda de rumo num TOQUE (match.js,
// controlBall/dribbleTouch). Entre os toques o condutor "monta" na bola: se ela não está ao
// alcance do pé, ele corre até o ponto atrás dela na trajetória (arrancando se precisar). O
// rumo pedido (analógico ou IA) fica guardado em p.intentX/Z e vira o próximo toque assim que
// a bola chega ao pé.
export function keepBall(m, p) {
  const b = m.ball;
  if (p.action || b.held || b.p.y > 0.6) return;
  // rumo pedido: o humano vale na hora; o da IA é suavizado (o desvio de marcadores oscila
  // quadro a quadro e viraria uma série de cortes)
  if (p.human || p.intentX == null) { p.intentX = p.dx; p.intentZ = p.dz; }
  else { const k = Math.min(1, m.dt60 ?? 0.2); p.intentX += (p.dx - p.intentX) * k; p.intentZ += (p.dz - p.intentZ) * k; }
  const sp = p.speed, ctl = (p.a.ctl ?? p.a.dri) / 99;
  const base = 0.27 + Math.min(sp, 8) * 0.01, side = 0.1 * p.foot;
  const rx = -p.fz, rz = p.fx;
  const fx = p.x + p.fx * base + rx * side, fz = p.z + p.fz * base + rz * side;
  const footErr = Math.hypot(b.p.x - fx, b.p.z - fz);
  const reach = 0.3 + 0.12 * ctl;
  let dx = p.dx, dz = p.dz, s = Math.hypot(dx, dz);
  const bs = Math.hypot(b.v.x, b.v.z);
  if (footErr > reach + 0.05) {
    // monta na bola: ponto atrás dela (um pé de distância) na trajetória prevista
    const ux = s > 0.01 ? dx / s : p.fx, uz = s > 0.01 ? dz / s : p.fz;
    const hx = bs > 1 ? b.v.x / bs : ux, hz = bs > 1 ? b.v.z / bs : uz;
    const px = b.p.x + b.v.x * 0.12 - hx * base + hz * side, pz = b.p.z + b.v.z * 0.12 - hz * base - hx * side;
    const ex = px - p.x, ez = pz - p.z, d = Math.hypot(ex, ez) || 1e-6;
    // chega na bola com vontade (e não desacelera atrás de uma bola lenta que está à frente:
    // ele a alcança e o próximo toque já a empurra no ritmo pedido)
    const frente = (ex * (s > 0.01 ? dx / s : p.fx) + ez * (s > 0.01 ? dz / s : p.fz)) / d;
    const want = Math.min(p.sprintSpd, Math.max(bs + d * 3.5, frente > 0.7 ? Math.min(s, sp) : 0));
    dx = ex / d * want; dz = ez / d * want; s = want;
    // a bola abriu (toque longo): arranca para alcançá-la, se tiver fôlego
    if (want > p.jog + 0.2 && p.stamina > 0.15) p.sprint = true;
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
  // gatilho por TEMPO (FC 26: sair de primeira em vez de um toque extra): começa a ação
  // quando a bola vai chegar ao pé exatamente no momento do contato da animação.
  // Só pela distância, bola firme (10+ m/s) passava antes do pé encostar.
  const d = Math.hypot(b.x - p.footX(), b.z - p.footZ());
  const shotQ = ['shoot', 'finesse', 'chip'].includes(q.kind);
  const anim = shotQ ? (b.y > 0.45 ? ANIM.volley : q.kind === 'chip' ? ANIM.chip : ANIM.kick) : ANIM.pass;
  const ct = anim.dur * anim.contact;
  const bv = m.ball.v, rx = b.x - p.footX(), rz = b.z - p.footZ(), vx = bv.x - p.vx, vz = bv.z - p.vz;
  const vv = vx * vx + vz * vz;
  const tc = vv > 1 ? -(rx * vx + rz * vz) / vv : 99;               // tempo até a maior aproximação
  const dmin = tc < 99 ? Math.hypot(rx + vx * tc, rz + vz * tc) : d;
  const due = tc > 0 && tc <= ct + 1 / 60 && dmin < 1.0;
  if ((due || (d < 1.25 && vv <= 1)) && b.y < 1.3) {
    const shot = shotQ;
    if (shot) {
      const kind = b.y > 0.45 ? 'volley' : q.kind === 'shoot' ? 'shot' : q.kind;
      const tg = shotTarget(m, p, q.power, q.dx, q.dz);
      // de primeira o corpo fica entre a bola que chega e o gol (o pé não sai da linha da bola)
      const aT = Math.atan2(tg.z - p.z, tg.x - p.x), aB = Math.atan2(b.z - p.z, b.x - p.x);
      p.startAction(kind, { target: tg, power: q.power, face: aB + angDiff(aB, aT) * 0.5 });
    } else {
      const dirx = Math.hypot(q.dx, q.dz) > 0.15 ? q.dx : p.fx, dirz = Math.hypot(q.dx, q.dz) > 0.15 ? q.dz : p.fz;
      pass(m, p, q.kind === 'pass' ? 'pass' : q.kind, q.power * 0.85, dirx, dirz);
    }
    p.queued = null;
  }
}

// Troca: o companheiro que chega primeiro na bola (ou no portador adversário). Com a bola no pé do
// adversário, vale quem chega antes no caminho dele (onde ele vai estar em 0,5 s) estando entre ele e o
// nosso gol — quem vem por trás chega, mas não defende
function switchList(m) {
  const team = m.userTeam;
  const cur = m.controlled;
  const b = m.ball.p, o = m.owner, adv = o && o.team !== team;
  const x = adv ? o.x + o.vx * 0.5 : b.x, z = adv ? o.z + o.vz * 0.5 : b.z;
  return team.players.filter(q => !q.sentOff && !q.isGK && q !== cur)
    .map(q => ({ q, s: adv ? notaMarcador(m, q, x, z) : q.interceptT + Math.hypot(q.x - b.x, q.z - b.z) * 0.02 - (m.lx(team, q.x) < m.lx(team, b.x) ? 0.3 : 0) }))
    .sort((a, c) => a.s - c.s);
}
function switchIndex(m, n, manual) {
  // switchIdx pode faltar (troca automática só grava o horário): conta a partir do primeiro
  return manual && m.lastSwitchT && m.time - m.lastSwitchT < 0.9 ? ((m.switchIdx | 0) + 1) % Math.min(3, n) : 0;
}
export function switchPlayer(m, manual) {
  const list = switchList(m);
  if (!list.length) return;
  const idx = switchIndex(m, list.length, manual);
  m.switchIdx = idx; m.lastSwitchT = m.time;
  m.setControlled(list[idx].q);
}
// Troca direcional (arrastar o TROCAR / analógico direito): o companheiro mais alinhado
// com a direção pedida a partir do jogador atual, preferindo os mais perto.
export function switchDirectional(m, dx, dz) {
  const team = m.userTeam, cur = m.controlled;
  if (!team || !cur) return;
  let best = null, bs = -1e9;
  for (const q of team.players) {
    if (q === cur || q.sentOff || q.isGK) continue;
    const vx = q.x - cur.x, vz = q.z - cur.z, d = Math.hypot(vx, vz) || 1;
    const c = (vx * dx + vz * dz) / d;
    if (c < 0.45) continue;
    const sc = c * 1.6 - d / 40;
    if (sc > bs) { bs = sc; best = q; }
  }
  if (best) { m.lastSwitchT = m.time; m.switchIdx = 0; m.setControlled(best); }
}

// Quem o botão TROCAR pegaria agora (para o indicador amarelo na tela)
export function switchCandidate(m) {
  if (!m.userTeam || m.phase !== 'play') return null;
  const list = switchList(m);
  return list.length ? list[switchIndex(m, list.length, true)].q : null;
}

// Tempo aproximado para um jogador chegar a um ponto (arrancada + o giro que ele precisa dar).
function tempoAte(q, x, z) {
  const dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz);
  const giro = d > 0.5 ? (1 - (dx * q.fx + dz * q.fz) / d) * 0.25 : 0;
  return d / (q.sprintSpd || 8) + giro;
}
// Nota de um marcador para um ponto: quem chega antes, com desconto para quem já está entre o ponto e o
// nosso gol (quem vem por trás chega, mas não defende)
function notaMarcador(m, q, x, z) {
  return tempoAte(q, x, z) + (m.lx(q.team, q.x) < m.lx(q.team, x) + 1 ? 0 : 0.6);
}
function melhorMarcador(m, x, z) {
  let best = null, bs = 1e9;
  for (const q of m.userTeam.players) {
    if (q.sentOff || q.isGK) continue;
    const s = notaMarcador(m, q, x, z);
    if (s < bs) { bs = s; best = q; }
  }
  return best ? { q: best, s: bs } : null;
}

function autoSwitch(m) {
  const team = m.userTeam;
  const owner = m.owner;
  const cur = m.controlled;
  const troca = (q) => { m.setControlled(q); m.lastSwitchT = m.time; m.switchIdx = 0; };
  // passe do adversário: troca NO PASSE para quem chega antes ao recebedor (FC: "auto switching" no passe).
  // Antes só trocava quando o recebedor dominava (~1 s depois) e se o controlado estivesse a > 12 m.
  // Só troca com vantagem clara (0,35 s): se o controlado já é quem chega, ele continua.
  const lk = m.lastKick, pt = m.passTarget;
  if (lk && lk.t !== m.trocaPasseT && lk.p.team !== team && !owner && cur && pt && pt.p && pt.p.team !== team && m.time - pt.t < 0.2) {
    m.trocaPasseT = lk.t;
    const b = melhorMarcador(m, pt.x, pt.z);
    if (b && b.q !== cur && notaMarcador(m, cur, pt.x, pt.z) - b.s > 0.35) troca(b.q);
  }
  // marcador batido: o condutor passou do controlado rumo ao nosso gol e há um companheiro entre ele e o
  // gol que chega antes ao caminho dele — troca para esse (antes ficava no batido até apertar TROCAR)
  if (owner && owner.team !== team && cur && m.time - (m.lastSwitchT || 0) > 0.6 && m.lx(team, cur.x) - m.lx(team, owner.x) > 2.5) {
    const x = owner.x + owner.vx * 0.6, z = owner.z + owner.vz * 0.6;
    const b = melhorMarcador(m, x, z);
    if (b && b.q !== cur && m.lx(team, b.q.x) < m.lx(team, owner.x) + 1 && b.s < notaMarcador(m, cur, x, z) - 0.2) troca(b.q);
  }
  const key = owner ? owner.idx : -1;
  if (key !== m.lastOwnerKey) {
    m.lastOwnerKey = key;
    if (owner && owner.team !== team && cur && m.time - (m.lastSwitchT || 0) > 0.3) {
      const d = Math.hypot(cur.x - owner.x, cur.z - owner.z);
      if (d > 12) switchPlayer(m, false);
    }
    return;
  }
  // bola solta longe do controlado: passa para quem chega antes
  if (!owner && cur && !m.passTarget && m.time - (m.lastSwitchT || 0) > 1.2) {
    const best = team.chaser;
    if (best && best !== cur && cur.interceptT - best.interceptT > 1.2 && Math.hypot(cur.x - m.ball.p.x, cur.z - m.ball.p.z) > 14) {
      m.setControlled(best); m.lastSwitchT = m.time; m.switchIdx = 0;
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
  // pênalti só se cobra chutando: passe/enfiada aqui virava um "pênalti" com alvo de passe, sem
  // altura, e a bola ia para NaN (achado pelo sim-test com humano aleatório)
  if (sp.type === 'penalty') return;
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
