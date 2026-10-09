// Nenhuma perda de bola sem adversário (seção 4): 60 s de condução com curvas, zigue-zague,
// arrancadas, freadas e condução curta, com roteiro sorteado (semente), e um roteiro DURO com
// giros de 180° de uma vez (correndo e na arrancada) e cortes fortes (69°–115°).
// "Perder" não é só o evento de perda do jogo (bola a > 2,6 m por > 1,2 s, frouxo demais): mede
// também o maior trecho SEGUIDO com a bola fora do alcance de toque (> 1,2 m do corpo) e quantas
// vezes por minuto a bola fugiu do alcance e o corpo teve de ir buscá-la.
//   node tools/teste-perda.mjs [nSementes] [nSementesDuro]
import { criarMundo, passo } from '../js/sim.js';
import { PASSO } from '../js/config.js';
import { criarRoteiro, entrada } from './lib/roteiros.mjs';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const nSem = +(process.argv[2] || 100);
const nDuro = +(process.argv[3] || 40);
const LONGE = 1.2;          // m — bola além disso está fora do alcance de qualquer toque
const META_TRECHO = 1.0;    // s — maior trecho seguido com a bola longe
const META_BUSCAS = 7;      // por minuto (roteiro normal)
const META_BUSCAS_DURO = 10; // por minuto (roteiro duro, com giros de 180°: calibrado — versão
                             // publicada 8,7/min; com o erro de toque 3× maior passa de 30/min)

function bateria(n, duro) {
  let perdas = 0, buscas = 0, piorTrecho = 0, piorSem = 0, dmax = 0;
  for (let s = 1; s <= n; s++) {
    const rot = criarRoteiro(s, { duro });
    const m = criarMundo({ semente: s, jogadores: [{ id: 0, x: 0, z: 0, rumo: rot.rumo0 }], bola: { x: Math.cos(rot.rumo0) * 0.4, z: Math.sin(rot.rumo0) * 0.4 }, posse: 0 });
    const j = m.jogadores[0];
    let ant = false, trecho = 0;
    for (let i = 0; i < 60 * 60; i++) {
      passo(m, { 0: entrada(rot, i * PASSO, j) });
      if (j.cond.busca && !ant) buscas++;
      ant = j.cond.busca;
      const d = Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z);
      dmax = Math.max(dmax, d);
      trecho = d > LONGE ? trecho + PASSO : 0;
      if (trecho > piorTrecho) { piorTrecho = trecho; piorSem = s; }
      if (m.posse !== 0) break; // perdeu
    }
    perdas += m.stats.perdas + (m.posse !== 0 && m.stats.perdas === 0 ? 1 : 0);
  }
  return { n, perdas, buscasMin: buscas / n, piorTrecho, piorSem, dmax };
}

const normal = bateria(nSem, false), duro = bateria(nDuro, true);
const linhas = [
  ['roteiro', 'sementes × 60 s', 'perdas', 'buscas/min', 'maior trecho com a bola > 1,2 m', 'bola–corpo máx'],
  ['normal', normal.n, normal.perdas, fmt(normal.buscasMin, 1), `${fmt(normal.piorTrecho)} s (semente ${normal.piorSem})`, `${fmt(normal.dmax)} m`],
  ['duro (giros 180°, cortes fortes)', duro.n, duro.perdas, fmt(duro.buscasMin, 1), `${fmt(duro.piorTrecho)} s (semente ${duro.piorSem})`, `${fmt(duro.dmax)} m`],
];
console.log(tabelaTexto(linhas));
const metas = [
  ['nenhuma perda de bola (normal e duro)', normal.perdas + duro.perdas === 0, `${normal.perdas} · ${duro.perdas}`, '0'],
  [`maior trecho seguido com a bola fora do alcance (> ${LONGE} m)`, Math.max(normal.piorTrecho, duro.piorTrecho) <= META_TRECHO, `${fmt(normal.piorTrecho)} · ${fmt(duro.piorTrecho)} s`, `≤ ${fmt(META_TRECHO, 1)} s`],
  ['bola fugiu do alcance e o corpo foi buscá-la', normal.buscasMin <= META_BUSCAS && duro.buscasMin <= META_BUSCAS_DURO, `${fmt(normal.buscasMin, 1)} · ${fmt(duro.buscasMin, 1)} por minuto`, `≤ ${META_BUSCAS} · ≤ ${META_BUSCAS_DURO}/min`],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido (normal · duro)', 'Alvo', 'Resultado'], ...metas.map(m => [m[0], m[2], m[3], m[1] ? 'PASSOU' : 'REPROVOU'])]));
const ok = metas.every(m => m[1]);
console.log(ok ? '\nteste-perda: PASSOU' : '\nteste-perda: REPROVOU');
process.exit(ok ? 0 : 1);
