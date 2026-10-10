// Roda toda a bateria de testes em Node (a mesma que o GitHub Actions roda antes de publicar).
// Os testes rodam em paralelo (um processo cada, até o número de núcleos); o resultado sai na
// ordem da lista. Sai com código 1 se algum reprovar.
//   node tools/rodar-testes.mjs [--rapido]
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TESTES = [
  ['matemática determinística (igual em todo motor JS)', 'teste-matdet.mjs'],
  ['física da bola', 'teste-bola.mjs'],
  ['determinismo (semente → mesmo hash)', 'teste-determinismo.mjs'],
  ['entrada e zona morta radial', 'teste-entrada.mjs'],
  ['laço de passo fixo e interpolação', 'teste-laco.mjs'],
  ['resposta do corpo (≤ 0,1 s)', 'teste-resposta.mjs'],
  ['condução — 16 cenas + 4', 'teste-conducao.mjs'],
  ['cortes, giro de 180° e puxada', 'teste-cortes.mjs'],
  ['60 s sem perder a bola', 'teste-perda.mjs'],
  ['patinação dos pés', 'teste-patinacao.mjs'],
  ['tronco inclina na arrancada, freada e curva', 'teste-inclinacao.mjs'],
  ['domínio orientado', 'teste-dominio.mjs'],
  ['proteção de corpo', 'teste-protecao.mjs'],
  ['condução curta e pedalada', 'teste-dribles.mjs'],
  ['recomeço do treino (bola no pé, bola fora)', 'teste-recomeco.mjs'],
  // Etapa 2
  ['passes: rasteiro, enfiada, lançamento, cruzamento, primeira, tabela', 'teste-passes.mjs'],
  ['chute: velocidade, curva, dispersão, perna ruim, cavadinha', 'teste-chutes.mjs'],
  ['goleiro: defesas pelos dados, posição, botão GOLEIRO, mãos', 'teste-goleiro.mjs'],
  ['jogo aéreo: domínio no peito e cabeceio', 'teste-aereo.mjs'],
  ['treino de ataque com a IA: não trava e chega ao chute', 'teste-treino.mjs'],
  // Correções depois da Etapa 2
  ['goleiro com a bola na mão não trava (repõe sozinho, TROCAR)', 'teste-goleiro-trava.mjs'],
];

function rodar(arq) {
  return new Promise(resolve => {
    const ti = Date.now();
    const p = spawn(process.execPath, [path.join(AQUI, arq)], { cwd: path.resolve(AQUI, '..') });
    let saida = '';
    p.stdout.on('data', d => { saida += d; });
    p.stderr.on('data', d => { saida += d; });
    p.on('close', codigo => resolve({ ok: codigo === 0, saida, s: (Date.now() - ti) / 1000 }));
  });
}

const t0 = Date.now();
const nPar = Math.max(2, Math.min(TESTES.length, os.cpus().length || 2));
const res = new Array(TESTES.length);
let prox = 0, impresso = 0;
function imprimir() {
  while (impresso < TESTES.length && res[impresso]) {
    const r = res[impresso], [nome] = TESTES[impresso];
    process.stdout.write(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome}  (${r.s.toFixed(1)} s)\n`);
    if (!r.ok) process.stdout.write(r.saida + '\n');
    impresso++;
  }
}
async function trabalhador() {
  while (prox < TESTES.length) {
    const i = prox++;
    res[i] = await rodar(TESTES[i][1]);
    imprimir();
  }
}
await Promise.all(Array.from({ length: nPar }, trabalhador));
const falhas = res.filter(r => !r.ok);
console.log(`\n${res.length - falhas.length}/${res.length} testes passaram em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas.length ? 1 : 0);
