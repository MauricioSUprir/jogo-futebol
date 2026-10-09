// Determinismo: a mesma semente e as mesmas entradas geram a mesma partida bit a bit (hash do
// mundo igual a cada segundo); outra semente muda; cópia no meio do caminho continua igual.
//   node tools/teste-determinismo.mjs
import { criarMundo, passo, hashMundo, copiarMundo } from '../js/sim.js';
import { PASSO } from '../js/config.js';
import { criarRoteiro, entrada } from './lib/roteiros.mjs';
import { maquinaPasse, alternarMarcador } from '../js/treino.js';
import { tabelaTexto } from './lib/medidas.mjs';

function rodar(semente, segundos, aoTick) {
  const rot = criarRoteiro(7);
  const m = criarMundo({ semente, jogadores: [{ id: 0, x: 0, z: 0, rumo: rot.rumo0 }], bola: { x: Math.cos(rot.rumo0) * 0.4, z: Math.sin(rot.rumo0) * 0.4 }, posse: 0 });
  const hashes = [];
  for (let i = 0; i < segundos * 60; i++) {
    if (i === 900) alternarMarcador(m, 0);
    if (i === 1500) maquinaPasse(m, 0);
    passo(m, { 0: entrada(rot, i * PASSO, m.jogadores[0]) });
    if (aoTick) aoTick(m, i);
    if (i % 60 === 59) hashes.push(hashMundo(m));
  }
  return { m, hashes };
}

const linhas = [['teste', 'resultado']];
let falhas = 0;
const a = rodar(42, 40), b = rodar(42, 40), c = rodar(43, 40);
const iguais = a.hashes.every((h, i) => h === b.hashes[i]);
linhas.push(['mesma semente → mesmo hash a cada segundo (40 s)', iguais ? 'PASSOU' : 'REPROVOU']);
if (!iguais) falhas++;
const difere = a.hashes.some((h, i) => h !== c.hashes[i]);
linhas.push(['outra semente → partida diferente', difere ? 'PASSOU' : 'REPROVOU']);
if (!difere) falhas++;
// cópia no meio (replay a partir de um instante): copia o mundo E o estado do roteiro
let copia = null, rotCopia = null, hCopia = null, hOrig = null;
{
  const rot = criarRoteiro(7);
  const m = criarMundo({ semente: 42, jogadores: [{ id: 0, x: 0, z: 0, rumo: rot.rumo0 }], bola: { x: Math.cos(rot.rumo0) * 0.4, z: Math.sin(rot.rumo0) * 0.4 }, posse: 0 });
  for (let i = 0; i < 1200; i++) {
    if (i === 900) alternarMarcador(m, 0);
    passo(m, { 0: entrada(rot, i * PASSO, m.jogadores[0]) });
    if (i === 600) { copia = copiarMundo(m); rotCopia = structuredClone(rot); }
  }
  hOrig = hashMundo(m);
  for (let i = 601; i < 1200; i++) {
    if (i === 900) alternarMarcador(copia, 0);
    passo(copia, { 0: entrada(rotCopia, i * PASSO, copia.jogadores[0]) });
  }
  hCopia = hashMundo(copia);
}
const okCopia = hCopia === hOrig;
linhas.push(['cópia do mundo no meio continua igual (replay)', okCopia ? 'PASSOU' : `REPROVOU (${hCopia} × ${hOrig})`]);
if (!okCopia) falhas++;
console.log(tabelaTexto(linhas));
console.log(`hash final (semente 42, 40 s): ${a.hashes[a.hashes.length - 1]}`);
console.log(falhas ? '\nteste-determinismo: REPROVOU' : '\nteste-determinismo: PASSOU');
process.exit(falhas ? 1 : 0);
