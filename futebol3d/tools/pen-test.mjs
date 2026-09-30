// Taxa de conversão de pênaltis da IA (node tools/pen-test.mjs)
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const r = { gol: 0, defesa: 0, fora: 0 };
for (let n = 0; n < 60; n++) {
  const m = new Match({ home: TEAMS[n % 8], away: TEAMS[(n + 3) % 8], userSide: 'none', settings: { ...DEFAULT_SETTINGS } });
  m.headless = true; m.phase = 'play';
  const t = m.teams[n % 2];
  m.phase = 'play';
  m.setupRestart({ type: 'penalty', team: t });
  const g0 = t.score;
  let out = 'fora';
  for (let i = 0; i < 60 * 6; i++) {
    m.step(1 / 60, null);
    const ev = m.events.map(e => e.type); m.events.length = 0;
    if (t.score > g0) { out = 'gol'; break; }
    if (ev.includes('save') || m.owner === t.opp.gk) { out = 'defesa'; break; }
    if (m.phase === 'stopped' || (m.phase === 'play' && m.lastKick && m.time - m.lastKick.t > 2.5)) break;
  }
  if (out === 'fora') { const b = m.ball.p; console.log('fora:', 'held', m.ball.held, 'owner', m.owner && m.owner.data.name, 'gk', t.opp.gk.x.toFixed(2), t.opp.gk.action && t.opp.gk.action.type, 'phase', m.phase, 'v', m.ball.speed().toFixed(1), 'bola', b.x.toFixed(2), b.y.toFixed(2), b.z.toFixed(2)); }
  r[out]++;
}
console.log(r);
