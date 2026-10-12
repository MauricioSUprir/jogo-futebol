// three.js 0.170 em Node (para medir o código de desenho sem o navegador): o especificador 'three' aponta para o mesmo
// arquivo do CDN que o jogo usa (cache em tools/.cache-cdn, baixado com curl se faltar) e um "document" mínimo com um
// canvas de mentira (as texturas de canvas só precisam existir; nada é desenhado nem enviado à placa de vídeo).
// Importar ESTE módulo antes de qualquer módulo que importe 'three':
//   import './lib/three-node.mjs'; const { criarJogadores3D } = await import('../js/render/jogador3d.js');
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const URL_CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
const CACHE = path.join(AQUI, '..', '.cache-cdn');
const arq = path.join(CACHE, URL_CDN.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180));
if (!fs.existsSync(arq)) {
  fs.mkdirSync(CACHE, { recursive: true });
  execFileSync('curl', ['-sSfL', '--retry', '3', '-o', arq, URL_CDN], { stdio: 'inherit' });
}
const alvo = pathToFileURL(arq).href;
const ganchos = `
export async function resolve(esp, ctx, prox) {
  if (esp === 'three') return { url: ${JSON.stringify(alvo)}, shortCircuit: true };
  return prox(esp, ctx);
}
export async function load(url, ctx, prox) {
  if (url === ${JSON.stringify(alvo)}) return { format: 'module', source: await (await import('node:fs/promises')).readFile(new URL(url)), shortCircuit: true };
  return prox(url, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(ganchos), import.meta.url);

if (typeof globalThis.document === 'undefined') {
  const ctx2d = new Proxy({}, {
    get: (alvo2, k) => (k in alvo2 ? alvo2[k] : () => ({ addColorStop() {} })),
    set: (alvo2, k, v) => { alvo2[k] = v; return true; },
  });
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }),
  };
}
