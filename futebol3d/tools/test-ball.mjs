// Testes de sanidade da física da bola (node tools/test-ball.mjs)
import { Ball, solveAim, solveLob, solveGround } from '../js/ball.js';
const b = new Ball();
function run(label, setup, T = 6) {
  b.place(0, 0.11, 0); setup(b); b.events = [];
  let t = 0, maxY = 0, path = [];
  while (t < T) { b.step(1 / 120); t += 1 / 120; maxY = Math.max(maxY, b.p.y); if (Math.abs(t % 0.5) < 1 / 240) path.push(`${b.p.x.toFixed(1)},${b.p.y.toFixed(2)},${b.p.z.toFixed(2)}`); }
  console.log(label, 'final', b.p.x.toFixed(2), b.p.z.toFixed(2), 'maxY', maxY.toFixed(2), 'v', b.speed().toFixed(2), 'events', b.events.length);
}
run('passe rasteiro 15m/s', b => b.kick(15, 0, 0));
run('chute 28m/s 8°', b => b.kick(28 * Math.cos(0.14), 28 * Math.sin(0.14), 0));
run('curva 25m/s ω=+y 50', b => b.kick(25, 3, 0, 0, 50, 0), 1.2);
run('topspin', b => b.kick(25, 6, 0, 0, 0, -40), 1.2);
run('backspin', b => b.kick(25, 6, 0, 0, 0, 40), 1.2);
const a = solveAim({ x: 30, y: 0.11, z: 10 }, { x: 52.5, y: 1.8, z: -2.5 }, 27, { side: 45, top: 0 });
console.log('solveAim', a);
b.place(30, 0.11, 10); b.kick(a.vx, a.vy, a.vz, a.wx, a.wy, a.wz); b.events = [];
for (let i = 0; i < 240; i++) { b.step(1 / 120); if (b.p.x >= 52.4) break; }
console.log(' -> chega em', b.p.x.toFixed(2), b.p.y.toFixed(2), b.p.z.toFixed(2));
const l = solveLob({ x: 0, y: 0.11, z: 0 }, { x: 35, y: 0.11, z: 10 }, 0.5, { side: 0, top: -8 });
b.place(0, 0.11, 0); b.kick(l.vx, l.vy, l.vz, l.wx, l.wy, l.wz);
let up = true; for (let i = 0; i < 1200; i++) { b.step(1 / 120); if (b.v.y < 0) up = false; if (!up && b.p.y <= 0.111) break; }
console.log('solveLob land', b.p.x.toFixed(2), b.p.z.toFixed(2), 'speed', l.speed.toFixed(1));
const g = solveGround({ x: 0, y: 0.11, z: 0 }, { x: 20, y: 0, z: 0 }, 6);
console.log('solveGround 20m arrive 6 ->', g.speed.toFixed(2), 't', g.t.toFixed(2));
// na trave
b.place(40, 0.11, 3.72); b.events = []; b.kick(25, 0.5, 0);
for (let i = 0; i < 200; i++) b.step(1 / 120);
console.log('trave eventos', b.events.map(e => e.type), 'pos', b.p.x.toFixed(2), b.p.z.toFixed(2));
// gol na rede
b.place(40, 0.11, 0); b.events = []; b.kick(25, 2, 0);
for (let i = 0; i < 400; i++) b.step(1 / 120);
console.log('rede eventos', b.events.map(e => e.type), 'pos', b.p.x.toFixed(2), b.p.y.toFixed(2), b.p.z.toFixed(2));
