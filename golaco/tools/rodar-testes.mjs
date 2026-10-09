// Roda toda a bateria de testes em Node (a mesma que o GitHub Actions roda antes de publicar).
// Sai com código 1 se algum reprovar.
//   node tools/rodar-testes.mjs [--rapido]
import { spawnSync } from 'node:child_process';
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
  ['recomeço do treino (bola no pé, bola fora)', 'teste-treino.mjs'],
];

const res = [];
const t0 = Date.now();
for (const [nome, arq] of TESTES) {
  const ti = Date.now();
  const r = spawnSync(process.execPath, [path.join(AQUI, arq)], { encoding: 'utf8', cwd: path.resolve(AQUI, '..') });
  const ok = r.status === 0;
  res.push({ nome, arq, ok, s: (Date.now() - ti) / 1000 });
  process.stdout.write(`${ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome}  (${((Date.now() - ti) / 1000).toFixed(1)} s)\n`);
  if (!ok) {
    process.stdout.write((r.stdout || '') + (r.stderr || '') + '\n');
  }
}
const falhas = res.filter(r => !r.ok);
console.log(`\n${res.length - falhas.length}/${res.length} testes passaram em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas.length ? 1 : 0);
