// Prints do TRAJE NOVO na vitrine (traje.html) de vários ângulos, para conferir antes de mandar ao dono.
// Uso: node velocista/tools/vista-traje.mjs <pasta> [novo|heroi]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), saida = process.argv[2] || '/tmp/traje', traje = process.argv[3] || 'novo';
fs.mkdirSync(saida, { recursive: true });
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 1000, altura: 1000 });
const vistas = [
  ['frente', 'parado', [0.15, 1.3, 4.3], [0, 1.0, 0]], ['costas', 'parado', [0, 1.3, -4.3], [0, 1.0, 0]], ['lado', 'parado', [4.3, 1.2, 0.6], [0, 1.0, 0]],
  ['peito', 'parado', [0.2, 1.4, 1.35], [0, 1.28, 0]], ['cabeca', 'parado', [0.35, 1.68, 0.75], [0, 1.62, 0]], ['botas', 'parado', [0.6, 0.5, 1.6], [0, 0.3, 0]],
  ['correndo', 'correndo', [2.8, 1.3, 3.2], [0, 1.0, 0]], ['luta', 'luta', [-2.4, 1.3, 3.4], [0, 1.0, 0]],
];
for (const [nome, pose, pos, alvo] of vistas) {
  await pagina.goto(`${srv.url}traje.html?traje=${traje}&pose=${pose}&girar=0`, { timeout: 600000 });
  await pagina.waitForFunction(() => window.__traje?.pronto && window.__traje.quadros > 3, null, { timeout: 600000 });
  await pagina.evaluate(([p, a]) => { const T = window.__traje; T.ctl.target.set(...a); T.camera.position.set(...p); T.ctl.update(); }, [pos, alvo]);
  const q0 = await pagina.evaluate(() => window.__traje.quadros);
  await pagina.waitForFunction((q) => window.__traje.quadros > q + 3, q0, { timeout: 600000 });
  await pagina.screenshot({ path: path.join(saida, `${traje}-${nome}.png`), timeout: 600000 });
  console.log('ok', nome);
}
console.log(erros.length ? `ERROS: ${erros.slice(0, 3).join(' | ')}` : 'sem erros');
await navegador.close(); await srv.fechar();
