// Determinismo: a mesma semente e as mesmas entradas geram a mesma partida bit a bit (hash do
// mundo igual a cada segundo); outra semente muda; cópia no meio do caminho continua igual.
//   node tools/teste-determinismo.mjs
import { criarMundo, passo, hashMundo, copiarMundo } from '../js/sim.js';
import { PASSO } from '../js/config.js';
import { criarRoteiro, entrada } from './lib/roteiros.mjs';
import { maquinaPasse, alternarMarcador } from '../js/treino.js';
import { tabelaTexto } from './lib/medidas.mjs';
import { teclasParaAnalogico, paraMundo } from '../js/controle.js';

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

// Zero negativo na entrada: com a câmera de TV (yaw = −π/2) a tecla ESQUERDA da página vira
// paraMundo(−1, 0, −π/2) = {x: −1, z: −6e−17}, e a quantização não pode deixar sobrar −0
// (atan2(−0, −1) = −π, atan2(+0, −1) = +π). A mesma partida tem que sair igual (a) ao roteiro
// escrito à mão no Node ({x: −1, z: 0}) e (b) às mesmas entradas gravadas em inteiros de 1/1024
// (replay compacto, Int16) — que devolvem +0.
{
  const YAW_TV = -Math.PI / 2;
  // teclas [cima, baixo, esq, dir] trocando a cada 0,5 s (esquerda e baixo dão −0 na página)
  const SEQ = [[0, 0, 1, 0], [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 1], [1, 0, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0], [1, 0, 0, 0], [0, 1, 0, 1], [0, 0, 1, 0]];
  const teclas = i => SEQ[Math.floor(i / 30) % SEQ.length];
  const daPagina = i => { const [c, b, e, d] = teclas(i); const a = teclasParaAnalogico(!!c, !!b, !!e, !!d); return paraMundo(a.x, a.y, YAW_TV); };
  const aMao = i => { const [c, b, e, d] = teclas(i); const x = d - e, z = b - c; const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
  const replayInt16 = i => { const e = daPagina(i); const q = new Int16Array([Math.round(e.x * 1024), Math.round(e.z * 1024)]); return { x: q[0] / 1024, z: q[1] / 1024 }; };
  const rodarEntradas = fonte => {
    const m = criarMundo({ semente: 9, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }], bola: { x: 0.4, z: 0 }, posse: 0 });
    const hs = [];
    for (let i = 0; i < 20 * 60; i++) {
      if (i === 300) alternarMarcador(m, 0);
      passo(m, { 0: { ...fonte(i), botoes: 0 } });
      if (i % 60 === 59) hs.push(hashMundo(m));
    }
    return hs;
  };
  const hp = rodarEntradas(daPagina), hm = rodarEntradas(aMao), hr = rodarEntradas(replayInt16);
  const div = (x, y) => { const k = x.findIndex((h, i) => h !== y[i]); return k < 0 ? null : k + 1; };
  const dm = div(hp, hm), dr = div(hp, hr);
  linhas.push(['tecla da página (−0) = roteiro à mão {x:−1, z:0} (20 s)', dm === null ? 'PASSOU' : `REPROVOU (diverge no ${dm}º s)`]);
  linhas.push(['tecla da página = replay gravado em inteiros Int16 (20 s)', dr === null ? 'PASSOU' : `REPROVOU (diverge no ${dr}º s)`]);
  if (dm !== null) falhas++;
  if (dr !== null) falhas++;
}
console.log(tabelaTexto(linhas));
console.log(`hash final (semente 42, 40 s): ${a.hashes[a.hashes.length - 1]}`);
console.log(falhas ? '\nteste-determinismo: REPROVOU' : '\nteste-determinismo: PASSOU');
process.exit(falhas ? 1 : 0);
