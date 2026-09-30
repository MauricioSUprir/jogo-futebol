// Impedimento: passe para atacante atrás da linha → apito; em linha → segue.
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
function run(ahead) {
  const m = new Match({ home: TEAMS[0], away: TEAMS[3], userSide: 'none', settings: { ...DEFAULT_SETTINGS } });
  m.headless = true; m.phase = 'play'; m.sp = null;
  const t = m.teams[0], o = t.opp, d = t.dir;
  o.players.forEach((q, k) => { if (!q.isGK) q.teleport(d * 25, k < 6 ? -8 - k * 2 : 10 + k * 2, 0); });
  o.gk.teleport(d * 50, 0, 0);
  t.players.forEach((q, k) => { if (!q.isGK) q.teleport(d * (k < 5 ? -20 : 0), (k - 5) * 4, 0); });
  const passer = t.players[5], runner = t.players[9];
  passer.teleport(d * 5, 0, d > 0 ? 0 : Math.PI);
  runner.teleport(d * (25 + ahead), 3, 0);
  m.ball.place(d * 5.5, 0.11, 0); m.owner = passer; passer.gotBall = -9;
  passer.startAction('pass', { receiver: runner, target: { x: runner.x, z: runner.z }, power: 0.7, face: Math.atan2(3, d * 20) });
  const ev = [];
  let logged = 0; for (let i = 0; i < 60 * 4; i++) { m.step(1 / 60, null); if (m.offside && !logged) { logged = 1; ev.push('flag:' + [...m.offside.flagged].map(q => q.data.name).join('/')); } if (m.lastTouch && ev[ev.length-1] !== 'T:' + m.lastTouch.data.name) ev.push('T:' + m.lastTouch.data.name); for (const e of m.events) if (e.type === 'banner') ev.push(e.text); m.events.length = 0; }
  return ev.join(',') || '(nada)';
}
console.log('2 m adiantado:', run(2));
console.log('1 m atrás da linha:', run(-1));
