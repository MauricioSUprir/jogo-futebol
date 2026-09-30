// Teste do goleiro: chutes de várias distâncias/alturas/cantos contra o goleiro da IA.
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS, PITCH } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const res = { gol: 0, defesa: 0, fora: 0, trave: 0 };
const rows = [];
for (let n = 0; n < 60; n++) {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 3 } });
  m.headless = true;
  m.phase = 'play'; m.sp = null;
  const att = m.teams[0], def = att.opp;
  const gx = m.goalX(att), s = Math.sign(gx);
  // tira todo mundo do caminho
  for (const p of m.players) if (!p.isGK) p.teleport(-s * 30, (p.idx % 11) * 3 - 15, 0);
  const dist = 11 + (n % 4) * 5, zOff = ((n >> 2) % 3 - 1) * 8;
  const shooter = att.players[9];
  const bx = gx - s * dist;
  shooter.teleport(bx - s * 0.5, zOff, s > 0 ? 0 : Math.PI);
  def.gk.teleport(gx - s * 1.5, 0, s > 0 ? Math.PI : 0);
  m.ball.place(bx, 0.11, zOff);
  m.owner = shooter;
  // posiciona o goleiro por 1 s
  for (let i = 0; i < 60; i++) { shooter.dx = shooter.dz = 0; m.step(1 / 60, null); m.owner = shooter; m.ball.place(bx, 0.11, zOff); shooter.action = null; }
  shooter.teleport(bx - s * 0.5, zOff, s > 0 ? 0 : Math.PI); m.ball.place(bx, 0.11, zOff); m.owner = shooter; m.events.length = 0;
const corner = (n % 2 ? 1 : -1) * 2.8, high = (n >> 1) % 2 ? 1.9 : 0.4;
  const power = 0.5 + (n % 5) * 0.1;
  shooter.startAction('shot', { target: { x: gx, y: high, z: corner }, power, face: Math.atan2(corner - zOff, gx - bx) });
  let out = 'fora';
  const goals0 = att.score;
  for (let i = 0; i < 60 * 3; i++) {
    m.step(1 / 60, null);
    const ev = m.events.map(e => e.type); m.events.length = 0;
    if (att.score > goals0) { out = 'gol'; break; }
    if (ev.includes('save') || m.owner === def.gk) { out = 'defesa'; break; }
    if (ev.includes('post') || ev.includes('bar')) out = 'trave';
    if (m.phase !== 'play') break;
  }
  res[out]++;
  rows.push(`${dist}m z${zOff} ${high > 1 ? 'alto' : 'baixo'} p${power.toFixed(1)} → ${out}`);
}
console.log(rows.join('\n'));
console.log(res);
