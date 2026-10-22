// Nível de detalhe do corpo humano (js/render/lod-humano.js, puro): 32 bonecos com alturas na tela que andam como numa
// partida (a câmera de TV parada e o jogo correndo; um close passando), 60 s a 60 qps.
//   L1 com a câmera parada e o boneco a velocidade de jogo, ≤ 1 troca de nível por boneco por segundo (a histerese);
//   L2 no máximo 2 na LOD0 e no máximo 3 níveis com gente em todo quadro;
//   L3 o teto de triângulos respeitado em todo quadro (Média: 60 mil, com os triângulos de verdade do corpo.json);
//   L4 sem teto e com tudo longe, todos na LOD3; com um boneco a 300 px, ele na LOD0.
// Na versão sem o corpo humano reprova (o módulo não existe).
//   node tools/teste-lod-humano.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto } from './lib/medidas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (n, m, a, ok) => { linhas.push([n, m, a, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
let L;
try { L = await import(pathToFileURL(path.join(RAIZ, 'js/render/lod-humano.js')).href); } catch (_) { L = null; }
if (!L) { reg('nível de detalhe do corpo humano (js/render/lod-humano.js)', 'não existe', 'existe', false); console.log(tabelaTexto(linhas)); process.exit(1); }
const ind = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets/jogador/corpo.json'), 'utf8'));
const TRI = ind.lods.map(l => l.triangulos);
const N = 32, Q = 3600;
let s = 7;
const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
const itens = Array.from({ length: N }, (_, i) => ({ chave: 100 + i }));
const est = L.criarEstadoLod();
const dist = Float64Array.from({ length: N }, () => 15 + rnd() * 50), vel = Float64Array.from({ length: N }, () => (rnd() - 0.5) * 6);
const K = 720 / (2 * Math.tan((34 * Math.PI) / 360)); // altura da tela 720 px, fov 34°
const ant = new Int8Array(N).fill(-1), trocas = new Int32Array(N);
let maxL0 = 0, maxNiveis = 0, piorTeto = 0, closeL0 = 0;
for (let q = 0; q < Q; q++) {
  for (let i = 0; i < N; i++) {
    if (rnd() < 0.01) vel[i] = (rnd() - 0.5) * 12;
    dist[i] = Math.min(70, Math.max(4, dist[i] + vel[i] / 60));
    est.alturas[i] = 1.8 * K / dist[i];
  }
  // um close passando (a câmera do replay): o boneco 0 a 1,5–6 m entre 20 e 25 s
  if (q >= 1200 && q < 1500) est.alturas[0] = 1.8 * K / (1.5 + 4.5 * Math.abs(Math.sin(q / 60)));
  const out = L.escolherLods(est, N, itens, TRI, 6e4);
  const usados = [0, 0, 0, 0];
  let tri = 0;
  for (let i = 0; i < N; i++) { usados[out[i]]++; tri += TRI[out[i]]; if (q < 1200 || q >= 1500) { if (ant[i] >= 0 && ant[i] !== out[i]) trocas[i]++; } ant[i] = out[i]; }
  if (q >= 1200 && q < 1500 && out[0] === 0) closeL0++;
  maxL0 = Math.max(maxL0, usados[0]); maxNiveis = Math.max(maxNiveis, usados.filter(Boolean).length);
  piorTeto = Math.max(piorTeto, tri);
}
const maxTrocas = Math.max(...trocas) / (Q / 60);
reg('L1 trocas de nível por boneco por segundo (câmera parada, boneco a velocidade de jogo)', `pior ${maxTrocas.toFixed(2)}/s`, '≤ 1/s', maxTrocas <= 1);
reg('L2 no máximo 2 na LOD0 e 3 níveis com gente', `LOD0 ${maxL0}; níveis ${maxNiveis}`, '≤ 2; ≤ 3', maxL0 <= 2 && maxNiveis <= 3);
reg('L3 teto de triângulos (Média, 60 mil) em todo quadro', `pior ${piorTeto}`, '≤ 60000', piorTeto <= 6e4);
{
  const e2 = L.criarEstadoLod(); e2.alturas.fill(40);
  const a = L.escolherLods(e2, N, itens, TRI);
  const e3 = L.criarEstadoLod(); e3.alturas.fill(40); e3.alturas[3] = 300;
  const b = L.escolherLods(e3, N, itens, TRI);
  const ok = Array.from(a.slice(0, N)).every(v => v === 3) && b[3] === 0;
  reg('L4 tudo longe = LOD3; um a 300 px = LOD0', `longe: ${new Set(a.slice(0, N)).size === 1 ? 'todos ' + a[0] : 'misturado'}; o de 300 px: LOD${b[3]}; close passando: LOD0 em ${closeL0} de 300 quadros`, 'LOD3; LOD0', ok && closeL0 > 30);
}
console.log(tabelaTexto(linhas));
process.exit(falhas ? 1 : 0);
