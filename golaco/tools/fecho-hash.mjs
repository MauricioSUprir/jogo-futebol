// O FECHO DO HASH: os módulos que a simulação carrega (o que hash-igual, hash-partida, teste-math-proibido e as partidas
// dos modos importam), percorrendo os `import` estáticos e dinâmicos a partir dos pontos de entrada da simulação. Mexer
// num arquivo do fecho pode mudar a partida; a Etapa 5 (corpo, rosto e mocap: só desenho) não pode tocar em nenhum.
//   node tools/fecho-hash.mjs                 lista o fecho
//   node tools/fecho-hash.mjs --diff <ref>    cruza o fecho com `git diff --name-only <ref>`: sai com 1 se houver arquivo
//                                             do fecho mexido (e diz qual)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'js');
const ENTRADAS = ['sim.js', 'partida.js', 'treino.js', 'sessao.js', 'disputa.js', 'livre.js', 'online.js', 'tm-times.js'];
const args = process.argv.slice(2);
const fecho = new Set();
function visitar(arq) {
  if (fecho.has(arq) || !fs.existsSync(arq)) return;
  fecho.add(arq);
  const s = fs.readFileSync(arq, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const re = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|export\s[^'"]*?from\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(s))) visitar(path.resolve(path.dirname(arq), m[1]));
}
for (const e of ENTRADAS) visitar(path.join(JS, e));
const lista = [...fecho].map(f => path.relative(path.join(RAIZ, '..'), f)).sort();
if (!args.includes('--diff')) {
  console.log(`fecho do hash: ${lista.length} módulos a partir de ${ENTRADAS.join(', ')}`);
  for (const f of lista) console.log('  ' + f);
  process.exit(0);
}
const ref = args[args.indexOf('--diff') + 1];
const mexidos = execFileSync('git', ['diff', '--name-only', ref, '--', '.'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(f => f.trim());
const novos = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '.'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(f => path.relative(path.join(RAIZ, '..'), path.join(RAIZ, f)));
const tocados = [...new Set([...mexidos, ...novos])].filter(f => lista.includes(f));
console.log(`fecho do hash: ${lista.length} módulos; mexidos desde ${ref}: ${mexidos.length + novos.length} arquivos; no fecho: ${tocados.length}`);
for (const f of tocados) console.log('  NO FECHO: ' + f);
process.exit(tocados.length ? 1 : 0);
