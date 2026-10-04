// Passe / chute de primeira do jogador humano: a bola vem rasteira (passe de 12 m, firme)
// e o recebedor já tem o comando guardado (apertou antes da bola chegar). Mede quantas
// vezes sai DE PRIMEIRA, quantas vira domínio (toque extra) e quantas o pé fura.
// node tools/primeira-test.mjs [lances] [velocidade de chegada m/s] [passe|chute]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
import { solveGround } from '../js/ball.js';
const N = +(process.argv[2] || 100), ARR = +(process.argv[3] || 10), KIND = process.argv[4] || 'passe';
const res = { primeira: 0, dominou: 0, furou: 0 };
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
  m.headless = true;
  let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  const us = m.userTeam, R = us.players[9];
  const dir = -Math.sign(m.ownGoalX(us)) || 1;          // atacando para +dir
  // adversários longe do lance
  for (const q of us.opp.players) if (!q.isGK) { q.x = -dir * 40; q.z = (q.idx % 10) * 6 - 27; }
  R.x = dir * 25; R.z = (Math.random() - 0.5) * 10; R.vx = R.vz = 0; R.heading = Math.PI;
  const ang = (Math.random() - 0.5) * 1.6, o = { x: R.x - Math.cos(ang) * 12 * dir, z: R.z - Math.sin(ang) * 12 };
  m.owner = null; m.ball.place(o.x, 0.11, o.z);
  const v = solveGround(m.ball.p, { x: R.x, z: R.z }, ARR); m.ball.kick(v.vx, 0, v.vz);
  m.passTarget = { p: R, x: R.x, z: R.z, t: m.time };
  m.setControlled(R);
  const key = KIND === 'chute' ? 'shoot' : 'pass';
  let out = null;
  for (let i = 0; i < 150 && !out; i++) {
    const cmd = { mx: 0, mz: 0, held: {}, press: {}, release: i === 3 ? { [key]: true } : {}, hold: i === 3 ? { [key]: 0.15 } : {}, rx: 0, rz: 0 };
    m.step(1 / 60, cmd);
    for (const e of m.events) {
      if (e.type === 'kick' && m.lastKick?.p === R) out = 'primeira';
      if (e.type === 'shot' && m.lastShot?.p === R) out = 'primeira';
    }
    m.events.length = 0;
    if (!out && m.owner === R) out = 'dominou';
    if (!out && Math.hypot(m.ball.p.x - R.x, m.ball.p.z - R.z) > 4 && i > 40) out = 'furou';
  }
  res[out || 'furou']++;
}
console.log(`${KIND} de primeira, bola chegando a ${ARR} m/s (${N} lances):`, Object.entries(res).map(([k, v]) => `${k} ${(100 * v / N).toFixed(0)}%`).join(' | '));
