// Clima (§33): mesma bola no gramado seco, com chuva e com temporal — distância de um
// passe rasteiro chutado a 12 m/s, altura do 2º quique de uma bola solta de 3 m, e
// velocidade com que o passe de 15 m chega (o solver de passe já compensa o gramado).
// node tools/clima-test.mjs
import { Ball, setSurface, solveGround } from '../js/ball.js';
import { WEATHER } from '../js/config.js';
for (const k of ['seco', 'chuva', 'temporal']) {
  setSurface(WEATHER[k].rain);
  const b = new Ball(); b.place(0, 0.11, 0); b.kick(12, 0, 0);
  for (let i = 0; i < 120 * 12; i++) b.step(1 / 120);
  const roll = b.p.x;
  const c = new Ball(); c.place(0, 3, 0); c.rolling = false;
  let quiques = 0, alt = 0, sobe = false, maxY = 0;
  for (let i = 0; i < 120 * 4 && quiques < 2; i++) { const vy = c.v.y; c.step(1 / 120); if (vy < 0 && c.v.y > 0) { quiques++; sobe = true; maxY = 0; } if (sobe) { maxY = Math.max(maxY, c.p.y); if (c.v.y <= 0 && quiques === 1) { alt = maxY; sobe = false; } } }
  const v = solveGround({ x: 0, y: 0.11, z: 0 }, { x: 15, z: 0 }, 9);
  console.log(`${WEATHER[k].label.padEnd(9)} | passe a 12 m/s rola ${roll.toFixed(1)} m | 1º quique sobe ${alt.toFixed(2)} m | passe de 15 m sai a ${v.speed.toFixed(1)} m/s e chega em ${v.t.toFixed(2)} s`);
}
