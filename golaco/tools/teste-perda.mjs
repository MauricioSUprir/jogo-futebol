// Nenhuma perda de bola sem adversário (seção 4): 60 s de condução com curvas, zigue-zague,
// arrancadas, freadas e condução curta, com roteiro sorteado (semente). 20 sementes.
// Conta perdas (bola longe por > 1,2 s) e "buscas" (a bola saiu do alcance e o corpo foi buscá-la).
//   node tools/teste-perda.mjs [nSementes]
import { criarMundo, passo } from '../js/sim.js';
import { PASSO } from '../js/config.js';
import { criarRoteiro, entrada } from './lib/roteiros.mjs';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const nSem = +(process.argv[2] || 20);

const linhas = [['semente', 'perdas', 'buscas', 'toques', 'bola–corpo máx (m)']];
let perdasTot = 0, buscasTot = 0;
for (let s = 1; s <= nSem; s++) {
  const rot = criarRoteiro(s);
  const m = criarMundo({ semente: s, jogadores: [{ id: 0, x: 0, z: 0, rumo: rot.rumo0 }], bola: { x: Math.cos(rot.rumo0) * 0.4, z: Math.sin(rot.rumo0) * 0.4 }, posse: 0 });
  const j = m.jogadores[0];
  let buscas = 0, dmax = 0, ant = false;
  for (let i = 0; i < 60 * 60; i++) {
    passo(m, { 0: entrada(rot, i * PASSO, j) });
    if (j.cond.busca && !ant) buscas++;
    ant = j.cond.busca;
    if (m.posse === 0) dmax = Math.max(dmax, Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z));
    if (m.posse !== 0) break; // perdeu
  }
  const perdas = m.stats.perdas + (m.posse !== 0 && m.stats.perdas === 0 ? 1 : 0);
  perdasTot += perdas; buscasTot += buscas;
  linhas.push([s, perdas, buscas, j.cond.nToques, fmt(dmax)]);
}
console.log(tabelaTexto(linhas));
const ok = perdasTot === 0;
console.log(`\n60 s × ${nSem} sementes: ${perdasTot} perda(s), ${buscasTot} busca(s) → ${ok ? 'PASSOU' : 'REPROVOU'} (meta: 0 perdas)`);
process.exit(ok ? 0 : 1);
