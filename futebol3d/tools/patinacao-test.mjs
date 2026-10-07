// Patinação dos pés (auditoria, Fase 2 — "foot slip < 0,05 m/s"), definição da auditoria:
// para v de 2,5 a 9,3 m/s, computePose em linha reta com stride += v·dt/cycleLength(v),
// dt = 1/600; para cada ponto de contato do pé (calcanhar / planta / ponta, via bonePoint)
// abaixo de 1,2 cm em dois quadros seguidos, velocidade no mundo = (Δx/dt, Δz/dt + v)
// (o corpo anda +v em z). A média tem que ficar < 0,05 m/s. Reprova (saída 1) se não.
// Com a captura de movimento carregada (como no jogo).
// node tools/patinacao-test.mjs [--sem-mocap]
import { readFileSync } from 'node:fs';
import { computePose, createPose, cycleLength, bonePoint, setMocap } from '../js/anim.js';
if (!process.argv.includes('--sem-mocap')) setMocap(JSON.parse(readFileSync(new URL('../assets/mocap/locomocao.json', import.meta.url))));
const DT = 1 / 600, LIM = 0.012, ALVO = 0.05;
const PTS = [[13, 0, -0.068, -0.055], [13, 0, -0.066, 0.125], [13, 0, -0.058, 0.19], [16, 0, -0.068, -0.055], [16, 0, -0.066, 0.125], [16, 0, -0.058, 0.19]];
const P = createPose(), o = [0, 0, 0];
let somaG = 0, nG = 0;
const linhas = [];
for (let v = 2.5; v <= 9.3 + 1e-9; v += 0.4) {
  const s = { anim: 'locomotion', speed: v, moveAngle: 0, stride: 0, t: 0, variant: 0, blendFrom: null, blendW: 1 };
  const prev = PTS.map(() => null);
  let soma = 0, n = 0, pior = 0;
  const L = cycleLength(v);
  for (let i = 0; i < Math.round(3 * L / v / DT); i++) {        // 3 ciclos de passada
    s.t = i * DT; s.stride += v * DT / L;
    computePose(s, P);
    PTS.forEach((p, k) => {
      bonePoint(P, p[0], p[1], p[2], p[3], o);
      const cur = [o[0], o[1], o[2]], pr = prev[k];
      if (pr && pr[1] < LIM && cur[1] < LIM) {
        const vel = Math.hypot((cur[0] - pr[0]) / DT, (cur[2] - pr[2]) / DT + v);
        soma += vel; n++; pior = Math.max(pior, vel);
      }
      prev[k] = cur;
    });
  }
  const media = n ? soma / n : NaN;
  somaG += soma; nG += n;
  linhas.push({ v: v.toFixed(1), media, pior, n });
}
for (const l of linhas) console.log(`v ${l.v.padStart(4)} m/s | patinação média ${l.media.toFixed(3)} m/s | pior ${l.pior.toFixed(2)} m/s | ${l.n} amostras no chão`);
const mediaG = somaG / nG;
const ok = nG > 0 && mediaG < ALVO && linhas.every(l => l.n > 0);
console.log(`${ok ? 'PASSOU' : 'FALHOU'} | patinação média geral ${mediaG.toFixed(3)} m/s (alvo < ${ALVO})`);
process.exit(ok ? 0 : 1);
