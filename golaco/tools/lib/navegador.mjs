// Ajuda para os testes no navegador: servidor estático da pasta golaco/ e Chromium
// (Playwright). O Chromium headless deste ambiente não passa pelo proxy: as requisições ao
// CDN (jsdelivr) são atendidas de um cache local preenchido com curl (que usa o proxy).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '../..');
const CACHE = path.join(RAIZ, 'tools', '.cache-cdn');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon',
};

/** Sobe um servidor estático na pasta do jogo. Devolve {url, fechar, bytes()}. */
export function servidor(porta = 0) {
  let bytes = 0;
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arq = path.join(RAIZ, p);
    if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
      res.writeHead(404); res.end('404'); return;
    }
    const dados = fs.readFileSync(arq);
    bytes += dados.length;
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
  return new Promise(ok => srv.listen(porta, '127.0.0.1', () => {
    const { port } = srv.address();
    ok({ url: `http://127.0.0.1:${port}/`, fechar: () => new Promise(r => srv.close(r)), bytes: () => bytes, zerar: () => { bytes = 0; } });
  }));
}

function cdnLocal(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const nome = url.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
  const arq = path.join(CACHE, nome);
  if (!fs.existsSync(arq)) {
    execFileSync('curl', ['-sSfL', '--retry', '3', '-o', arq, url], { stdio: 'inherit' });
  }
  return fs.readFileSync(arq);
}

function tipoPorUrl(u) {
  if (/\.m?js(\?|$)/.test(u)) return 'text/javascript; charset=utf-8';
  if (/\.css(\?|$)/.test(u)) return 'text/css; charset=utf-8';
  if (/\.woff2(\?|$)/.test(u)) return 'font/woff2';
  if (/\.json(\?|$)/.test(u)) return 'application/json';
  return 'application/octet-stream';
}

/** Carrega o Playwright instalado globalmente. */
export function playwright() {
  const req = createRequire(import.meta.url);
  // CI: NODE_PATH aponta para uma instalação local; aqui: a instalação global do ambiente
  const caminhos = ['playwright', ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(':').map(p => p + '/playwright') : []), '/opt/node22/lib/node_modules/playwright'];
  for (const c of caminhos) { try { return req(c); } catch (_) { /* tenta o próximo */ } }
  throw new Error('Playwright não encontrado');
}

/**
 * Abre o Chromium. opc: {largura, altura, dpr, toque, args}
 * Devolve {navegador, contexto, pagina, cdnBytes()}.
 */
export async function abrir(opc = {}) {
  const { chromium } = playwright();
  const navegador = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(opc.args ?? [])],
  });
  const contexto = await navegador.newContext({
    viewport: { width: opc.largura ?? 1280, height: opc.altura ?? 720 },
    deviceScaleFactor: opc.dpr ?? 1,
    hasTouch: !!opc.toque,
    isMobile: !!opc.toque,
  });
  let cdnBytes = 0;
  await contexto.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, async rota => {
    const u = rota.request().url();
    try {
      const corpo = cdnLocal(u);
      cdnBytes += corpo.length;
      await rota.fulfill({ status: 200, body: corpo, headers: { 'Content-Type': tipoPorUrl(u), 'Access-Control-Allow-Origin': '*' } });
    } catch (e) {
      await rota.fulfill({ status: 502, body: String(e) });
    }
  });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', e => erros.push(String(e)));
  pagina.on('console', msg => { if (msg.type() === 'error') erros.push(msg.text()); });
  return { navegador, contexto, pagina, erros, cdnBytes: () => cdnBytes };
}
