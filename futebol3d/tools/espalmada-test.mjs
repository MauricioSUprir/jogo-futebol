// Espalmada para escanteio (gk.js parryOut): com a física real da bola (ball.js), de qualquer ponto
// entre as traves e até 6 m da linha, a bola nunca pode entrar no gol (antes de corrigir, 5,8% entravam
// batendo na trave) e quase sempre sai pela linha de fundo. Reprova (saída 1) se alguma entrar ou se
// menos de 95% saírem pela linha de fundo.
// node tools/espalmada-test.mjs [casos=20000]
import { Ball } from '../js/ball.js';
import { GOAL, PITCH } from '../js/config.js';
import { parryOut } from '../js/gk.js';
const HL = PITCH.length / 2, N = +(process.argv[2] || 20000);
const rand = (a, b) => a + Math.random() * (b - a);
let dentro = 0, fundo = 0, campo = 0;
for (let k = 0; k < N; k++) {
  const s = Math.random() < 0.5 ? 1 : -1;
  const b = new Ball();
  b.p.x = s * rand(HL - 6, HL - 0.2); b.p.z = rand(-GOAL.halfWidth + 0.05, GOAL.halfWidth - 0.05); b.p.y = rand(0.15, 2.4);
  const v = parryOut(b.p, HL, s, Math.random() < 0.5 ? 1 : -1);
  b.kick(v.x, v.y, v.z, 0, 0, 0);
  let saiu = false;
  for (let i = 0; i < 480 && !saiu; i++) {
    const px = b.p.x;
    b.step(1 / 120);
    if (Math.abs(b.p.x) >= HL && Math.abs(px) < HL) {
      saiu = true;
      if (Math.abs(b.p.z) < GOAL.halfWidth && b.p.y < GOAL.height) dentro++; else fundo++;
    }
  }
  if (!saiu) campo++;
}
const ok = dentro === 0 && fundo / N >= 0.95;
console.log(`${ok ? 'PASSOU' : 'FALHOU'} | ${N} espalmadas para escanteio: ${dentro} entraram no gol (alvo 0) | ${(fundo / N * 100).toFixed(1)}% saíram pela linha de fundo (alvo ≥ 95%) | ${campo} ficaram no campo`);
process.exit(ok ? 0 : 1);
