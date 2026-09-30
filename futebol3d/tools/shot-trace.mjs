import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const [dist, zOff, high, power] = process.argv.slice(2).map(Number);
const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'none', settings: { ...DEFAULT_SETTINGS } });
m.headless = true; m.phase = 'play'; m.sp = null;
const att = m.teams[0], def = att.opp, gx = m.goalX(att), s = Math.sign(gx);
for (const p of m.players) if (!p.isGK) p.teleport(-s * 30, (p.idx % 11) * 3 - 15, 0);
const sh = att.players[9], bx = gx - s * dist;
sh.teleport(bx - s * 0.5, zOff, s > 0 ? 0 : Math.PI);
def.gk.teleport(gx - s * 1.5, 0, s > 0 ? Math.PI : 0);
m.ball.place(bx, 0.11, zOff); m.owner = sh;
for (let i = 0; i < 60; i++) { m.step(1 / 60, null); m.owner = sh; m.ball.place(bx, 0.11, zOff); sh.action = null; }
sh.teleport(bx - s * 0.5, zOff, s > 0 ? 0 : Math.PI); m.ball.place(bx, 0.11, zOff); m.owner = sh; m.events.length = 0;
const oc = m.onContact; m.onContact = (p, a) => { const b = m.ball.p; console.log("CONTACT", a.type, p.data.name, "foot", (p.x + p.fx * 0.45).toFixed(2), (p.z + p.fz * 0.45).toFixed(2), "ball", b.x.toFixed(2), b.y.toFixed(2), b.z.toFixed(2), "owner", m.owner && m.owner.data.name); oc(p, a); };
sh.startAction("shot", { target: { x: gx, y: high, z: 2.8 }, power, face: Math.atan2(2.8 - zOff, gx - bx) });
for (let i = 0; i < 120; i++) {
  m.step(1 / 60, null);
  const ev = m.events.map(e => e.type + (e.kind ? ':' + e.kind : '')).filter(e => !e.startsWith('crowd')); m.events.length = 0;
  const b = m.ball.p, g = def.gk;
  if (i < 20) console.log("act", sh.action && sh.action.type, sh.action && sh.action.t.toFixed(2), "owner", m.owner && m.owner.data.name, "held", m.ball.held);
  if (i % 3 === 0 || ev.length) console.log(i, m.phase, 'ball', b.x.toFixed(2), b.y.toFixed(2), b.z.toFixed(2), 'v', m.ball.speed().toFixed(1), 'gk', g.x.toFixed(2), g.z.toFixed(2), g.action?.type || '', ev.join(','));
  if (m.phase !== 'play') break;
}
