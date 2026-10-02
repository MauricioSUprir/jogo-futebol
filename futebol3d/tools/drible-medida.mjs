// Condução "presa ao pé": em condução estável (posse há > 0,7 s, sem ação, vel > 1),
// mede onde a bola fica em relação ao jogador (à frente / de lado, média e oscilação),
// quantos toques por segundo e o erro pé→bola no toque. node tools/drible-medida.mjs [s]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const secs = +(process.argv[2] || 300);
const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6 } });
m.headless = true;
const bins = {};
const add = (k, a, l) => { (bins[k] ||= { a: [], l: [] }).a.push(a); bins[k].l.push(l); };
let touches = 0, dribT = 0, lost = 0;
const orig = m.touch.bind(m);
m.touch = (p, how) => { if (how === 'dribble') touches++; return orig(p, how); };
for (let i = 0; i < 60 * secs; i++) {
  const before = m.owner;
  m.step(1 / 60, null);
  for (const e of m.events) if (e.type === 'replay') m.replayFinished();
  m.events.length = 0;
  const o = m.owner;
  if (before && !o && !before.action && m.phase === 'play') lost++;
  if (!o || o.action || m.phase !== 'play' || m.ball.held || m.time - (o.gotBall || 0) < 0.7) continue;
  const s = o.speed; if (s < 1) continue;
  dribT += 1 / 60;
  const rx = m.ball.p.x - o.x, rz = m.ball.p.z - o.z;
  add(s < 4 ? 'trote <4' : s < 6.5 ? 'corrida 4-6.5' : 'arrancada >6.5', rx * o.fx + rz * o.fz, (rx * -o.fz + rz * o.fx) * o.foot);
}
const st = (v) => { const a = v.reduce((x, y) => x + y, 0) / v.length; return [a, Math.sqrt(v.reduce((x, y) => x + (y - a) ** 2, 0) / v.length)]; };
for (const [k, v] of Object.entries(bins)) {
  const [a, sa] = st(v.a), [l, sl] = st(v.l), s = [...v.a].sort((x, y) => x - y);
  console.log(k.padEnd(15), `à frente ${a.toFixed(2)} ±${sa.toFixed(2)} m (p95 ${s[Math.floor(s.length * 0.95)].toFixed(2)}) | lado ${l.toFixed(2)} ±${sl.toFixed(2)} | n ${v.a.length}`);
}
console.log('toques/s na condução estável', (touches / Math.max(dribT, 1)).toFixed(2), '| bolas escapadas sem ação', lost);
