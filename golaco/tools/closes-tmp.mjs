// (temporário) closes de conferência: manequim, bola, gol, linhas
import path from 'node:path';
import { servidor, abrir } from './lib/navegador.mjs';
const SAIDA = process.argv[2];
const so = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const srv = await servidor();
const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
await pagina.goto(`${srv.url}?prints=1&semente=3&q=alta&hora=dia&marcador=1`, { waitUntil: 'load' });
await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
async function foto(nome, fn) {
  if (so && !so.has(nome)) return;
  await pagina.evaluate(fn);
  await pagina.evaluate(() => window.__golaco.desenhar());
  await pagina.screenshot({ path: path.join(SAIDA, nome + '.png') });
  console.log('ok', nome);
}
// jogador correndo em curva (demo) por N passos e câmera perto
async function posicionar(n, entrada) {
  await pagina.evaluate(({ n, entrada }) => {
    const g = window.__golaco;
    g.relogio.usarManual(true);
    g.reiniciar({ semente: 3, x: 0, z: 0, rumo: 0, marcador: true });
    g.forcarEntrada(entrada);
    for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
  }, { n, entrada });
}
const lado = (dx, dy, dz, fov = 22) => `(() => { const g = window.__golaco; const j = g.estado().jogador; g.cameraLivre({ de: [j.x + ${dx}, ${dy}, j.z + ${dz}], para: [j.x, 0.9, j.z], fov: ${fov} }); })()`;
await posicionar(200, { x: 0.7, z: 0, botoes: 0 });
await foto('manequim-lado', lado(0, 1.2, 6));
await foto('manequim-frente', lado(6, 1.4, 0.5));
await foto('manequim-tras', lado(-6, 1.6, 0.5));
await foto('manequim-cima', lado(1.5, 6, 3));
await posicionar(260, { x: 1, z: 0, botoes: 1 });
await foto('arrancada-lado', lado(0, 1.2, 6));
await foto('arrancada-frente', lado(6, 1.2, 1));
await posicionar(60, { x: 0, z: 0, botoes: 0 });
await foto('parado-lado', lado(0.3, 1.2, 5));
await foto('parado-frente', lado(5, 1.3, 0.4));
await foto('bola-perto', `(() => { const g = window.__golaco; const b = g.estado().bola; g.cameraLivre({ de: [b.x + 0.2, 0.9, b.z + 2.2], para: [b.x, 0.1, b.z], fov: 30 }); })()`);
await foto('gol-direita', `window.__golaco.cameraLivre({ de: [38, 5, 14], para: [52.5, 1.2, 0], fov: 40 })`);
await foto('gol-fundo', `window.__golaco.cameraLivre({ de: [60, 3.2, 6], para: [52.5, 1.2, 0], fov: 50 })`);
await foto('escanteio', `window.__golaco.cameraLivre({ de: [44, 6, 26], para: [52.5, 0, 34], fov: 40 })`);
await foto('area-cima', `window.__golaco.cameraLivre({ de: [36, 70, 0.01], para: [36, 0, 0], fov: 45 })`);
await foto('meio-cima', `window.__golaco.cameraLivre({ de: [0, 60, 0.01], para: [0, 0, 0], fov: 45 })`);
await foto('campo-todo', `window.__golaco.cameraLivre({ de: [0, 140, 0.01], para: [0, 0, 0], fov: 50 })`);
console.log('erros', erros);
await navegador.close();
await srv.fechar();
