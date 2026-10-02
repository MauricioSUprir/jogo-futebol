// Jogador controlado com a bola e analógico mudando de direção à toa: mede se ele
// "foge" da bola (distância máxima, bolas perdidas sem ação). node tools/keepball-test.mjs [seg]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const secs = +(process.argv[2] || 120);
const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6 } });
m.headless = true;
const cmd = { mx: 1, mz: 0, press: {}, release: {}, held: {}, hold: {}, rx: 0, rz: 0 };
let tChange = 0, own = 0, far = 0, lost = 0, maxD = 0, dsum = 0;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 60 * secs; i++) {
  for (const k of ['press', 'release', 'held', 'hold']) cmd[k] = {};
  tChange -= 1 / 60;
  if (tChange <= 0) { const a = rnd() * Math.PI * 2; cmd.mx = Math.cos(a); cmd.mz = Math.sin(a); cmd.sprint = rnd() < 0.5; tChange = 0.4 + rnd() * 1.2; }
  cmd.held.sprint = cmd.sprint;
  { const c = m.controlled; if (c && (Math.abs(c.x) > 40 || Math.abs(c.z) > 26)) { const l = Math.hypot(c.x, c.z); cmd.mx = -c.x / l; cmd.mz = -c.z / l; } }
  if (!m.owner && m.phase === 'play' && rnd() < 0.002) { /* nada */ }
  const p = m.controlled, had = m.owner && m.owner === p;
  // sem adversário roubando: o teste é só do jogador × bola
  for (const q of m.controlled.team.opp.players) { q.x = 60; q.z = 40; }
  m.step(1 / 60, cmd);
  for (const e of m.events) if (e.type === 'replay') m.replayFinished();
  m.events.length = 0;
  if (had && !m.owner && !p.action && m.phase === 'play') lost++;
  if (m.owner && m.owner === m.controlled && m.phase === 'play' && !m.owner.action) {
    own++; const o = m.owner; const d = Math.hypot(m.ball.p.x - o.x, m.ball.p.z - o.z);
    dsum += d; maxD = Math.max(maxD, d); if (d > 1.2) far++;
  }
}
console.log(`quadros com posse ${own} | dist. média ${(dsum / own).toFixed(2)} m | máx ${maxD.toFixed(2)} m | >1,2 m ${(far / own * 100).toFixed(1)}% | bolas que escaparam ${lost}`);
