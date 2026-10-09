// Laço de passo fixo + interpolação (puro), com carimbos do requestAnimationFrame tremidos:
//  1. A 60, 120 e 144 Hz (±0,5 ms): a simulação anda 60 passos por segundo de relógio, e o
//     instante desenhado avança exatamente um período do monitor por quadro — medido contra o
//     vsync IDEAL (o quadro aparece no vsync; o tremor é do carimbo). Meta da PESQUISA §1.4
//     (Fiedler 2004): erro abaixo de 1% do deslocamento desenhado por quadro.
//  2. Encaixe do delta (PESQUISA §1.4, Glaiel 2019): vsync de 60 Hz com ±0,5 ms — zero quadros
//     com 0 ou 2 passos em 10.000; também com carimbos arredondados a 0,1 ms (performance.now
//     sem isolamento de origem) em várias fases do primeiro quadro.
//  3. rAF a 144 Hz e a 30 Hz durante 10 s: 600 ± 1 passos; a 33,33 ms, exatamente 2 passos por
//     quadro (MDN rAF; Perry 2020).
//  4. Espiral da morte: um quadro travado de 1 s roda só MAX_PASSOS_POR_QUADRO passos.
//   node tools/teste-laco.mjs
import { criarLaco, avancarLaco } from '../js/laco.js';
import { PASSO, MAX_PASSOS_POR_QUADRO } from '../js/config.js';
import { criarRng, entre } from '../js/rng.js';
import { tabelaTexto, fmt, percentil } from './lib/medidas.mjs';

let falhas = 0;
const resultado = ok => { if (!ok) falhas++; return ok ? 'PASSOU' : 'REPROVOU'; };

/** Roda n quadros de um monitor de hz com tremor ±tremor ms (e carimbo arredondado a `grao` ms). */
function rodar(hz, n, { tremor = 0.5, semente = hz, inicio = 1000, grao = 0 } = {}) {
  const l = criarLaco();
  const r = criarRng(semente);
  const periodo = 1000 / hz;
  let passos = 0, ant = null;
  const erros = [], porQuadro = {};
  for (let q = 0; q < n; q++) {
    const ideal = inicio + q * periodo;
    let agora = ideal + (tremor ? entre(r, -tremor, tremor) : 0);
    if (grao) agora = Math.round(agora / grao) * grao;
    const { passos: k, alfa } = avancarLaco(l, agora);
    passos += k;
    const tDesenho = (passos + alfa) * PASSO; // instante desenhado (s)
    if (q > 0) {
      porQuadro[k] = (porQuadro[k] || 0) + 1;
      // erro do avanço desenhado contra o período ideal, em % do período
      erros.push((Math.abs(tDesenho - ant - periodo / 1000) / (periodo / 1000)) * 100);
    }
    ant = tDesenho;
  }
  return { passos, erros, porQuadro, segundos: (n * periodo) / 1000 };
}

// 1) 60/120/144 Hz com tremor de ±0,5 ms, 20 s
const l1 = [['monitor', 'passos/s', 'erro do avanço desenhado (p99, % do quadro)', 'resultado']];
for (const hz of [60, 120, 144]) {
  const r = rodar(hz, hz * 20);
  const pps = r.passos / r.segundos;
  const e99 = percentil(r.erros, 0.99);
  l1.push([`${hz} Hz ±0,5 ms`, fmt(pps, 2), `${fmt(e99, 3)}% (meta < 1%)`, resultado(Math.abs(pps - 60) < 0.2 && e99 < 1)]);
}
console.log(tabelaTexto(l1));

// 2) encaixe do delta: quadros com 0 ou 2 passos a 60 Hz
const l2 = [['carimbos a 60 Hz', 'quadros com 0 ou 2 passos (de 10.000)', 'resultado']];
{
  const r = rodar(60, 10001, { semente: 7 });
  const ruins = (r.porQuadro[0] || 0) + (r.porQuadro[2] || 0) + (r.porQuadro[3] || 0);
  l2.push(['tremor ±0,5 ms', `${ruins} (meta 0)`, resultado(ruins === 0)]);
}
for (const fase of [0.0, 0.03, 0.05, 0.07, 0.09]) {
  const r = rodar(60, 10001, { tremor: 0, grao: 0.1, inicio: 1000 + fase });
  const ruins = (r.porQuadro[0] || 0) + (r.porQuadro[2] || 0) + (r.porQuadro[3] || 0);
  l2.push([`arredondados a 0,1 ms, início em +${fase.toFixed(2)} ms`, `${ruins} (meta 0)`, resultado(ruins === 0)]);
}
console.log('');
console.log(tabelaTexto(l2));

// 3) 144 Hz e 30 Hz durante 10 s
const l3 = [['monitor', 'passos em 10 s', 'passos por quadro', 'resultado']];
for (const hz of [144, 30]) {
  const r = rodar(hz, hz * 10 + 1);
  const dist = Object.entries(r.porQuadro).map(([k, n]) => `${k}: ${n}`).join(' · ');
  let ok = Math.abs(r.passos - 600) <= 1;
  if (hz === 30) ok = ok && Object.keys(r.porQuadro).length === 1 && r.porQuadro[2] > 0;
  l3.push([`${hz} Hz ±0,5 ms`, `${r.passos} (meta 600 ± 1)`, dist + (hz === 30 ? ' (meta: só 2)' : ''), resultado(ok)]);
}
console.log('');
console.log(tabelaTexto(l3));

// 4) espiral da morte: quadro de 1 s só roda MAX_PASSOS_POR_QUADRO passos
{
  const l = criarLaco();
  avancarLaco(l, 0);
  const { passos } = avancarLaco(l, 1000);
  console.log(`\nquadro travado de 1 s → ${passos} passos (limite ${MAX_PASSOS_POR_QUADRO}): ${resultado(passos === MAX_PASSOS_POR_QUADRO)}`);
}
console.log(falhas ? '\nteste-laco: REPROVOU' : '\nteste-laco: PASSOU');
process.exit(falhas ? 1 : 0);
