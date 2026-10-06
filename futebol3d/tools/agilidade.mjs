// Agilidade do jogador (sem bola e com bola), medida no integrador de player.js:
// tempo para chegar a 90% da velocidade (trote e arrancada) partindo do parado, e tempo
// para completar uma virada de 90° e de 180° correndo (velocidade apontando a ±15° do
// pedido). node tools/agilidade.mjs
import { Player } from '../js/player.js';
import { TEAMS } from '../js/teams.js';
const dt = 1 / 60;
function mk(attrs, hasBall = false) {
  const data = { ...TEAMS[0].players[9], attrs: { ...TEAMS[0].players[9].attrs, ...attrs } };
  const p = new Player({ i: 0, dir: 1 }, 0, 0, data, 'MID');
  p.human = true;
  Object.defineProperty(p, 'hasBall', { get: () => hasBall });
  return p;
}
function arranque(p, sprint) {
  p.sprint = sprint;
  const target = (sprint ? p.sprintSpd : p.jog);
  for (let i = 0; i < 600; i++) { p.dx = target; p.dz = 0; p.step(dt); if (p.speed >= 0.9 * target * (p.hasBall ? 0.95 : 1)) return i * dt; }
  return NaN;
}
function virada(p, graus, sprint) {
  p.sprint = sprint;
  const s = sprint ? p.sprintSpd : p.jog;
  for (let i = 0; i < 240; i++) { p.dx = s; p.dz = 0; p.step(dt); }
  const a = graus * Math.PI / 180;
  for (let i = 0; i < 600; i++) {
    p.dx = Math.cos(a) * s; p.dz = Math.sin(a) * s; p.step(dt);
    const va = Math.atan2(p.vz, p.vx);
    let d = Math.abs(((va - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (d < 15 * Math.PI / 180 && p.speed > 0.6 * s) return i * dt;
  }
  return NaN;
}
const f = (v) => v.toFixed(2) + ' s';
for (const [nome, at] of [['médio (acc 72, agi 70)', { pac: 75, dri: 75, acc: 72, agi: 70 }], ['ágil (acc 90, agi 90)', { pac: 90, dri: 88, acc: 90, agi: 90 }], ['pesado (acc 60, agi 55)', { pac: 65, dri: 60, acc: 60, agi: 55 }]]) {
  for (const bola of [false, true]) {
    const r = [arranque(mk(at, bola), false), arranque(mk(at, bola), true), virada(mk(at, bola), 90, false), virada(mk(at, bola), 180, false), virada(mk(at, bola), 90, true)];
    console.log(`${nome.padEnd(24)} ${bola ? 'com bola' : 'sem bola'} | 0→90% trote ${f(r[0])} | 0→90% arrancada ${f(r[1])} | 90° trote ${f(r[2])} | 180° trote ${f(r[3])} | 90° arrancada ${f(r[4])}`);
  }
}
