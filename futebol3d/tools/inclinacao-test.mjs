// Inclinação do tronco pela aceleração (auditoria, Fase 2 item 3): a 5 m/s, o peito inclina
// ≥ 5° MAIS para a frente arrancando (acc +6 m/s²) do que em velocidade constante, e ≥ 6°
// MENOS (para trás) freando com apoio (acc −9 m/s²). Reprova (saída 1) se não.
// node tools/inclinacao-test.mjs
import { readFileSync } from 'node:fs';
import { computePose, createPose, bonePoint, setMocap } from '../js/anim.js';
setMocap(JSON.parse(readFileSync(new URL('../assets/mocap/locomocao.json', import.meta.url))));
const P = createPose(), a = [0, 0, 0], b = [0, 0, 0];
// inclinação média do peito (ombros em relação à pelve) ao longo de um ciclo de passada
function incl(acc) {
  let soma = 0;
  for (let k = 0; k < 40; k++) {
    computePose({ anim: 'locomotion', speed: 5, moveAngle: 0, stride: k / 40, t: k * 0.02, acc, blendFrom: null, blendW: 1 }, P);
    bonePoint(P, 0, 0, 0, 0, a); bonePoint(P, 3, 0, 0, 0, b);
    soma += Math.atan2(b[2] - a[2], b[1] - a[1]) * 180 / Math.PI;
  }
  return soma / 40;
}
const c = incl(0), f = incl(6), t = incl(-9);
const ok1 = f - c >= 5, ok2 = c - t >= 6;
console.log(`inclinação do tronco (graus, + = à frente): constante ${c.toFixed(1)} | arrancando ${f.toFixed(1)} | freando ${t.toFixed(1)}`);
console.log(`${ok1 ? 'PASSOU' : 'FALHOU'} | arrancada inclina ${(f - c).toFixed(1)}° a mais (alvo ≥ 5°)`);
console.log(`${ok2 ? 'PASSOU' : 'FALHOU'} | frenagem inclina ${(c - t).toFixed(1)}° para trás (alvo ≥ 6°)`);
process.exit(ok1 && ok2 ? 0 : 1);
