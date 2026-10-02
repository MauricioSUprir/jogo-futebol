// Mede "tremedeira": giro do corpo e trocas de direção dos jogadores quase parados.
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6 } });
m.headless = true;
let turn = 0, n = 0, flips = 0, stopgo = 0, frames = 0;
const prev = new Map();
for (let i = 0; i < 60 * 180; i++) {
  m.step(1 / 60, null); for (const e of m.events) if (e.type === 'replay') m.replayFinished(); m.events.length = 0;
  if (m.phase !== 'play') continue;
  frames++;
  for (const p of m.players) {
    if (p.sentOff || p.isGK || p.action) continue;
    const q = prev.get(p) || { h: p.heading, s: p.speed, mv: p.speed > 0.6 };
    let dh = p.heading - q.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    if (p.speed < 1.5) { turn += Math.abs(dh) * 60; n++; }
    const mv = p.speed > 0.6;
    if (mv !== q.mv) stopgo++;
    prev.set(p, { h: p.heading, s: p.speed, mv });
  }
}
console.log('giro médio quase parado (rad/s):', (turn / n).toFixed(2), '| trocas anda/para por jogador por minuto:', (stopgo / 20 / (frames / 3600)).toFixed(1));
