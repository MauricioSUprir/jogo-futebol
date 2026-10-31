// Gera os retratos da caixa de fala (assets/personagens/retratos/<id>.webp): o rosto de cada personagem renderizado a
// partir do modelo 3D (equipe.js retratar). Feito uma vez, fora do jogo: no jogo, ler a imagem de volta da GPU
// (readPixels) travava o navegador às vezes. Rodar de novo quando um modelo ou traje mudar.
// Uso: node velocista/tools/gerar-retratos.mjs [ids separados por vírgula]   (precisa do Pillow no python3 para gravar WebP)
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..'), SAIDA = path.join(RAIZ, 'assets/personagens/retratos');
fs.mkdirSync(SAIDA, { recursive: true });
const srv = await servidor(0, RAIZ);
const { navegador, pagina } = await abrir({ largura: 800, altura: 500 });
await pagina.goto(srv.url, { timeout: 400000 });
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
const ids = (process.argv[2] || 'heroi,zoom,reverso,caitlin,cisco,joe,iris,frio,onda,mago,savitar,devoe').split(',');
for (const id of ids) {
  const url = await pagina.evaluate(async (id) => {
    const { criarHeroi } = await import('./js/humano.js'), { colocarAderecos } = await import('./js/aderecos.js');
    const pessoa = ['caitlin', 'cisco', 'joe', 'iris', 'frio', 'onda', 'mago', 'devoe', 'wells'].includes(id) ? id : null;
    const m = await criarHeroi({ lod: 0, pessoa, traje: pessoa ? 'heroi' : id });
    if (['frio', 'onda', 'mago', 'devoe', 'savitar'].includes(id)) colocarAderecos(id, m);
    let saida = null; window.__rel.historia.definirRetrato = (_, u) => { saida = u; };
    window.__rel.equipe.retratar(id, m);
    return saida;
  }, id);
  const png = path.join(SAIDA, `${id}.png`);
  fs.writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync('python3', ['-I', '-c', `from PIL import Image; Image.open('${png}').save('${png.replace('.png', '.webp')}', 'WEBP', quality=88, method=6)`]);
  fs.unlinkSync(png);
  console.log(id, fs.statSync(png.replace('.png', '.webp')).size, 'bytes');
}
await navegador.close(); await srv.fechar();
