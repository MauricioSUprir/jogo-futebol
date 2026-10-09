// Laço de passo fixo + interpolação (puro): a 60, 120 e 144 Hz (com tremor de ±0,3 ms nos
// carimbos do requestAnimationFrame), a simulação anda 60 passos por segundo de relógio, e o
// instante desenhado avança exatamente o tempo do quadro (sem tranco nem câmera lenta).
// Também confere o limite contra a espiral da morte.
//   node tools/teste-laco.mjs
import { criarLaco, avancarLaco } from '../js/laco.js';
import { PASSO, MAX_PASSOS_POR_QUADRO } from '../js/config.js';
import { criarRng, entre } from '../js/rng.js';
import { tabelaTexto, fmt, percentil } from './lib/medidas.mjs';

const linhas = [['monitor', 'passos/s', 'erro do instante desenhado (p99)', 'resultado']];
let falhas = 0;
for (const hz of [60, 120, 144]) {
  const l = criarLaco();
  const r = criarRng(hz);
  let t = 1000, passos = 0, ant = null;
  const erros = [];
  const N = hz * 20;
  for (let q = 0; q < N; q++) {
    const agora = t + entre(r, -0.3, 0.3);
    const { passos: n, alfa } = avancarLaco(l, agora);
    passos += n;
    // instante desenhado = passos completos + alfa (em passos)
    const tDesenho = (passos + alfa) * PASSO;
    if (ant !== null) {
      const dReal = (agora - ant.agora) / 1000;
      const dDes = tDesenho - ant.tDesenho;
      erros.push(Math.abs(dDes - dReal) * 1000);
    }
    ant = { agora, tDesenho };
    t += 1000 / hz;
  }
  const pps = passos / 20;
  const e99 = percentil(erros, 0.99);
  const ok = Math.abs(pps - 60) < 0.2 && e99 < 0.05;
  if (!ok) falhas++;
  linhas.push([`${hz} Hz`, fmt(pps, 2), `${fmt(e99, 4)} ms`, ok ? 'PASSOU' : 'REPROVOU']);
}
console.log(tabelaTexto(linhas));
// espiral da morte: quadro de 1 s só roda MAX_PASSOS_POR_QUADRO passos
{
  const l = criarLaco();
  avancarLaco(l, 0);
  const { passos } = avancarLaco(l, 1000);
  const ok = passos === MAX_PASSOS_POR_QUADRO;
  if (!ok) falhas++;
  console.log(`\nquadro travado de 1 s → ${passos} passos (limite ${MAX_PASSOS_POR_QUADRO}): ${ok ? 'PASSOU' : 'REPROVOU'}`);
}
console.log(falhas ? '\nteste-laco: REPROVOU' : '\nteste-laco: PASSOU');
process.exit(falhas ? 1 : 0);
