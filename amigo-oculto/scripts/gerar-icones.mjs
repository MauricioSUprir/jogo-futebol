// Gera os ícones do PWA a partir da marca (o mesmo desenho de MarcaPresente, src/components/ui/logo.tsx):
//   public/icones/icone-192.png, icone-512.png          — ícone do app (cantos arredondados, fundo da marca)
//   public/icones/icone-maskable-192.png, -512.png       — "maskable" (fundo até a borda, marca dentro da zona segura)
//   public/icones/badge-96.png                           — selo monocromático das notificações (Android usa só o alfa)
//   src/app/apple-icon.png (180)                         — ícone da Tela de Início do iPhone
// Uso: node scripts/gerar-icones.mjs   (rasteriza com o Chromium do Playwright)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("/opt/node-tools/node_modules/playwright");
}

const raiz = new URL("../", import.meta.url);
const pastaIcones = new URL("public/icones/", raiz);
mkdirSync(pastaIcones, { recursive: true });

const DEFS = `
  <linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2394f"/><stop offset="1" stop-color="#8f0f22"/></linearGradient>
  <linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ef4a5f"/><stop offset="1" stop-color="#b3172d"/></linearGradient>
  <linearGradient id="o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset=".45" stop-color="#f2cf6b"/><stop offset="1" stop-color="#b8861f"/></linearGradient>
  <linearGradient id="v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#19b383"/><stop offset="1" stop-color="#064d36"/></linearGradient>
  <radialGradient id="fundo" cx="30%" cy="20%" r="95%"><stop offset="0" stop-color="#1b6b52"/><stop offset=".55" stop-color="#0c3a2d"/><stop offset="1" stop-color="#07211a"/></radialGradient>
  <radialGradient id="luz" cx="50%" cy="58%" r="45%"><stop offset="0" stop-color="#f2cf6b" stop-opacity=".38"/><stop offset="1" stop-color="#f2cf6b" stop-opacity="0"/></radialGradient>`;

const MARCA = `
  <rect x="10" y="30" width="44" height="28" rx="6" fill="url(#c)"/>
  <rect x="7" y="22" width="50" height="11" rx="5" fill="url(#t)"/>
  <rect x="28" y="22" width="8" height="36" fill="url(#v)"/>
  <path d="M32 4.5l3.1 7.2 7.8.6-5.9 5.1 1.9 7.6L32 21l-6.9 4 1.9-7.6-5.9-5.1 7.8-.6z" fill="url(#o)"/>
  <circle cx="32" cy="44" r="6.2" fill="#fffdf8" opacity=".95"/>
  <path d="M30 42.2c.2-1.4 1.2-2.2 2.4-2.2 1.4 0 2.4.9 2.4 2.1 0 1.8-2.4 1.9-2.4 3.6" fill="none" stroke="#8f0f22" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="32.4" cy="47.8" r=".95" fill="#8f0f22"/>`;

const ESTRELINHAS = [
  [12, 14, 2.2], [54, 10, 1.6], [56, 50, 1.4], [8, 46, 1.2], [46, 20, 1],
]
  .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f7d983" opacity=".75"/>`)
  .join("");

/** Ícone do app: fundo esmeralda-noite com a marca no centro (escala = fração do lado ocupada pela marca). */
function svgIcone({ arredondado, escala }) {
  const lado = 64;
  const m = lado * escala;
  const desloc = (lado - m) / 2;
  const fundo = arredondado
    ? `<rect width="64" height="64" rx="14" fill="url(#fundo)"/><rect width="64" height="64" rx="14" fill="url(#luz)"/>`
    : `<rect width="64" height="64" fill="url(#fundo)"/><rect width="64" height="64" fill="url(#luz)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${DEFS}</defs>${fundo}${ESTRELINHAS}
    <g transform="translate(${desloc} ${desloc + 1}) scale(${escala})">${MARCA}</g></svg>`;
}

/** Selo monocromático: só a silhueta (caixa, tampa e estrela) em branco; a fita fica vazada. */
const SVG_BADGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="#fff">
    <path d="M10 36a6 6 0 0 1 6-6h11v28H16a6 6 0 0 1-6-6z"/>
    <path d="M37 30h11a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H37z"/>
    <path d="M12 22h15v11H12a5 5 0 0 1-5-5v-1a5 5 0 0 1 5-5z"/>
    <path d="M37 22h15a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5H37z"/>
    <path d="M32 3l3.5 8 8.6.7-6.5 5.6 2.1 8.4L32 21.3l-7.7 4.4 2.1-8.4-6.5-5.6 8.6-.7z"/>
  </g></svg>`;

const navegador = await playwright.chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 1 });

async function rasterizar(svg, tamanho, destino) {
  await pagina.setViewportSize({ width: tamanho, height: tamanho });
  await pagina.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">
      <div style="width:${tamanho}px;height:${tamanho}px">${svg.replace("<svg ", `<svg width="${tamanho}" height="${tamanho}" `)}</div>
    </body></html>`,
  );
  await pagina.screenshot({ path: destino, omitBackground: true, clip: { x: 0, y: 0, width: tamanho, height: tamanho } });
  console.log("gerado:", destino);
}

const arq = (nome) => new URL(nome, pastaIcones).pathname;
await rasterizar(svgIcone({ arredondado: true, escala: 0.8 }), 192, arq("icone-192.png"));
await rasterizar(svgIcone({ arredondado: true, escala: 0.8 }), 512, arq("icone-512.png"));
// maskable: a zona segura é o círculo de 80% do lado — a marca ocupa ~58%
await rasterizar(svgIcone({ arredondado: false, escala: 0.58 }), 192, arq("icone-maskable-192.png"));
await rasterizar(svgIcone({ arredondado: false, escala: 0.58 }), 512, arq("icone-maskable-512.png"));
await rasterizar(SVG_BADGE, 96, arq("badge-96.png"));
// iPhone: o sistema arredonda os cantos (quadrado inteiro, sem transparência)
await rasterizar(svgIcone({ arredondado: false, escala: 0.74 }), 180, new URL("src/app/apple-icon.png", raiz).pathname);

await navegador.close();
