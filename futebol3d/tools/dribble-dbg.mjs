// Mede a distância bola–jogador na condução, por faixa de velocidade (node tools/dribble-dbg.mjs [segundos])
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const secs = +(process.argv[2] || 240);
const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6 } });
m.headless = true;
const bins = { 'parado (<1)': [], 'trote (1-5)': [], 'corrida (5-7)': [], 'arrancada (>7)': [] };
let lost = 0, own = 0;
for (let i = 0; i < 60 * secs; i++) {
  const before = m.owner;
  m.step(1 / 60, null);
  for (const e of m.events) if (e.type === 'replay') m.replayFinished();
  m.events.length = 0;
  const o = m.owner;
  if (before && !o && !before.action) lost++;
  if (!o || o.action || m.phase !== 'play' || m.ball.held) continue;
  if (process.argv[3] === 'semdominio' && m.time - (o.gotBall || 0) < 0.7) continue;
  own++;
  const d = Math.hypot(m.ball.p.x - o.x, m.ball.p.z - o.z), s = o.speed;
  (s < 1 ? bins['parado (<1)'] : s < 5 ? bins['trote (1-5)'] : s < 7 ? bins['corrida (5-7)'] : bins['arrancada (>7)']).push(d);
}
for (const [k, v] of Object.entries(bins)) {
  if (!v.length) continue;
  v.sort((a, b) => a - b);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  console.log(k.padEnd(16), 'média', avg.toFixed(2), 'm | p90', v[Math.floor(v.length * 0.9)].toFixed(2), 'm | máx', v[v.length - 1].toFixed(2), 'm | amostras', v.length);
}
console.log('perdas de bola sem ação (escapou do pé):', lost, '| quadros com posse:', own);
