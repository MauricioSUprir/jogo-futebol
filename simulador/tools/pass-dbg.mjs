// Destino dos passes por tipo (recebido / interceptado / saiu) em N partidas.
import { Match } from '../js/engine.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 8);
const agg = {};
for (let i = 0; i < N; i++) {
  const m = new Match({ home: TEAMS[i % 12], away: TEAMS[(i + 5) % 12], seed: 300 + i });
  let cur = null;
  const close = (res) => { if (!cur) return; const k = cur.kind; agg[k] ||= {}; agg[k][res] = (agg[k][res] || 0) + 1; cur = null; };
  const k0 = m._kick.bind(m);
  m._kick = function (p, x, y, kind, target) { close('?'); k0(p, x, y, kind, target); if (m.ball.pass) cur = { kind, from: p, target }; };
  const so = m._setOwner.bind(m);
  m._setOwner = function (p, r) { if (cur && m.ball.pass) close(p.team === cur.from.team ? (p === cur.from ? 'self' : 'ok') : 'intercept'); return so(p, r); };
  const sd = m._setDead.bind(m);
  m._setDead = function (type, ...a) { close('dead:' + type); return sd(type, ...a); };
  const sh = m._shoot.bind(m);
  m._shoot = function (p, kind) { if (cur) close(p.team === cur.from.team ? 'shot' : 'x'); return sh(p, kind); };
  const tk = m._tackles.bind(m);
  m.runToEnd();
}
for (const [k, v] of Object.entries(agg)) {
  const tot = Object.values(v).reduce((a, b) => a + b, 0);
  console.log(k.padEnd(6), String((tot / N).toFixed(1)).padStart(6), Object.entries(v).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a}:${((b / tot) * 100).toFixed(0)}%`).join(' '));
}
