import { Match } from '../js/engine.js';
import { TEAMS } from '../js/teams.js';
const bins = {}; let att = 0, energy = [];
for (let i = 0; i < 20; i++) {
  const m = new Match({ home: TEAMS[i % 12], away: TEAMS[(i + 5) % 12], seed: 50 + i });
  const sh = m._shoot.bind(m);
  m._shoot = function (p, kind) { const d = Math.hypot(52.5 - p.x * p.team.dir, p.y); const k = kind + ":" + (Math.floor(d / 5) * 5); bins[k] = (bins[k] || 0) + 1; return sh(p, kind); };
  const tk = m._tackles.bind(m);
  m.runToEnd();
  for (const t of m.teams) for (const p of t.onPitch) energy.push(p.energy);
}
console.log(Object.entries(bins).sort().map(([k, v]) => `${k}=${(v / 20).toFixed(2)}`).join('  '));
energy.sort(); console.log('energia final: min', energy[0].toFixed(2), 'mediana', energy[energy.length >> 1].toFixed(2));
