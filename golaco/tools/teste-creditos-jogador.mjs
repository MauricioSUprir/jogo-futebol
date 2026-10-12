// Créditos do corpo dos jogadores (Etapa 5): todo arquivo de assets/jogador/ tem de ter uma linha na tabela do
// assets/jogador/CREDITOS.md com a origem e uma licença permitida (CC0, CC BY ou a da captura de movimento da CMU, "free
// for all uses"). Licença proibida na linha do arquivo (CC BY-NC, ND, Mixamo, LAFAN1, Bandai Namco, Sketchfab, Lee
// Perry-Smith, GPL) reprova. Node, sem navegador.
// Controle: --controle finge um arquivo a mais na pasta (sem linha nos créditos) e um com licença proibida: reprova.
//   node tools/teste-creditos-jogador.mjs [--controle]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.join(AQUI, '..', 'assets', 'jogador');
const controle = process.argv.includes('--controle');

function listar(d, base = '') {
  const r = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) r.push(...listar(path.join(d, e.name), rel)); else r.push(rel);
  }
  return r;
}
const arquivos = listar(PASTA).filter(f => f !== 'CREDITOS.md');
let creditos = fs.readFileSync(path.join(PASTA, 'CREDITOS.md'), 'utf8');
if (controle) {
  arquivos.push('rosto-sem-credito.png', 'clipe-proibido.bin');
  creditos += '\n| `clipe-proibido.bin` | clipe de teste | Mixamo | termos da Adobe |\n';
}
// linhas da tabela: | `arquivo` | o que é | origem | licença |
const linhas = creditos.split('\n').filter(l => /^\|\s*`/.test(l)).map(l => l.split('|').map(c => c.trim()));
const PERMITIDA = /\bCC0\b|\bCC BY\b(?!-N)|CMU/;
const PROIBIDA = /BY-NC|\bNC\b|\bND\b|Mixamo \(Adobe\)|termos da Adobe|LAFAN1|Bandai|Sketchfab|Lee Perry|GPL/;
const res = [];
for (const f of arquivos) {
  const l = linhas.find(c => c[1] && c[1].includes('`' + f + '`'));
  if (!l) { res.push({ f, ok: false, por: 'sem linha no CREDITOS.md' }); continue; }
  const lic = l[4] ?? '';
  const origem = l[3] ?? '';
  if (!PERMITIDA.test(lic)) res.push({ f, ok: false, por: `licença não permitida: ${lic.slice(0, 60)}` });
  else if (PROIBIDA.test(lic) || /Mixamo|LAFAN1|Bandai|Sketchfab|Lee Perry/.test(origem.replace(/nenhum arquivo do serviço Mixamo|O nome "mixamo"|esqueleto `rigs\/standard\/rig\.mixamo\.json`|`rigs\/standard\/weights\.mixamo\.json`/g, ''))) res.push({ f, ok: false, por: 'origem ou licença proibida' });
  else res.push({ f, ok: true, por: lic.split('(')[0].trim() });
}
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.f}: ${r.por}`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(`\n${arquivos.length} arquivo(s) em assets/jogador${controle ? ' (CONTROLE: 2 arquivos falsos)' : ''}`);
console.log(ok ? 'teste-creditos-jogador: PASSOU' : 'teste-creditos-jogador: REPROVOU');
process.exit(ok ? 0 : 1);
