import { Match } from '../js/engine.js';
import { TEAMS } from '../js/teams.js';
const z = {}; let crosses = 0, crossWon = 0;
for (let i = 0; i < 10; i++) {
  const m = new Match({ home: TEAMS[i % 12], away: TEAMS[(i + 5) % 12], seed: 90 + i });
  const ex = m._execute.bind(m);
  m._execute = function (p, o) {
    const u = p.x * p.team.dir;
    const zone = u > 36 ? (Math.abs(p.y) < 20 ? 'area' : 'fundo-lado') : u > 17.5 ? (Math.abs(p.y) > 11 ? 'terco-lado' : 'terco-meio') : u > 0 ? 'meio-ataque' : 'defesa';
    z[zone] ||= {}; z[zone][o.kind] = (z[zone][o.kind] || 0) + 1;
    if (o.kind === 'cross') crosses++;
    return ex(p, o);
  };
  m.runToEnd();
}
for (const [k, v] of Object.entries(z)) console.log(k.padEnd(12), Object.entries(v).map(([a, b]) => `${a}:${(b / 10).toFixed(1)}`).join(' '));
