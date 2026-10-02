// Naturalidade da condução: no instante de cada toque, distância do pé mais próximo
// (bico da chuteira, pela pose real de anim.js) até a bola; toques por segundo e
// oscilação da bola à frente (empurra → alcança). node tools/dribble-nat.mjs [segundos]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
import { computePose, createPose, bonePoint } from '../js/anim.js';
const secs = +(process.argv[2] || 240);
const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6 } });
m.headless = true;
const P = createPose(), A = [0, 0, 0];
const touches = [];
const orig = m.touch.bind(m);
let pend = [];
const why = {};
m.touch = (p, how) => { if (how === 'dribble') { pend.push(p); why[m.dbgWhy] = (why[m.dbgWhy] || 0) + 1; } return orig(p, how); };
function footDist(p) {
  computePose(p.pose, P);
  const hs = (p.data.look?.height || 1.8) / 1.8, th = Math.PI / 2 - p.heading, c = Math.cos(th), s = Math.sin(th);
  let best = 9;
  for (const b of [13, 16]) for (const [ox, oy, oz] of [[0, -0.05, 0.13], [0, -0.05, 0.03]]) {
    bonePoint(P, b, ox, oy, oz, A);
    const wx = p.x + (c * A[0] + s * A[2]) * hs, wy = A[1] * hs, wz = p.z + (-s * A[0] + c * A[2]) * hs;
    best = Math.min(best, Math.hypot(wx - m.ball.p.x, wy - m.ball.p.y, wz - m.ball.p.z) - 0.11);
  }
  return Math.max(0, best);
}
const byWhy = {};
const ahead = { trote: [], corrida: [] };
let own = 0, nT = 0;
for (let i = 0; i < 60 * secs; i++) {
  pend = [];
  m.step(1 / 60, null);
  for (const e of m.events) if (e.type === 'replay') m.replayFinished();
  m.events.length = 0;
  for (const p of pend) if (p.speed > 1) { const d = footDist(p); touches.push(d); (byWhy[m.dbgWhy] ||= []).push(d); }
  const o = m.owner;
  if (!o || o.action || m.phase !== 'play' || m.ball.held || o.speed < 1) continue;
  own++;
  const a = (m.ball.p.x - o.x) * o.fx + (m.ball.p.z - o.z) * o.fz;
  (o.speed < 5 ? ahead.trote : ahead.corrida).push(a);
}
nT = touches.length;
touches.sort((a, b) => a - b);
const avg = v => v.reduce((a, b) => a + b, 0) / v.length;
const sd = v => { const m0 = avg(v); return Math.sqrt(avg(v.map(x => (x - m0) ** 2))); };
console.log('toques (vel>1):', nT, '| por segundo de condução:', (nT / (own / 60)).toFixed(2));
console.log('pé→bola no toque: média', avg(touches).toFixed(2), 'm | mediana', touches[nT >> 1].toFixed(2), 'm | p90', touches[Math.floor(nT * 0.9)].toFixed(2), 'm | <12cm', (touches.filter(x => x < 0.12).length / nT * 100).toFixed(0) + '%');
for (const k in ahead) if (ahead[k].length) console.log('bola à frente', k.padEnd(8), 'média', avg(ahead[k]).toFixed(2), 'm | oscilação (dp)', sd(ahead[k]).toFixed(3), 'm');
console.log('motivos:', JSON.stringify(why), Object.entries(byWhy).map(([k, v]) => k + ' pé→bola ' + avg(v).toFixed(2)).join(' | '));
