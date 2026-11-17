// Gera os ícones PNG do app (PWA/iPhone) a partir do SVG da marca, com o Chromium do Playwright.
// Uso: node scripts/gerar-icones.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // o Playwright instalado na máquina
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const marca = (escala) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${48 * escala}" height="${48 * escala}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>
  <circle cx="24" cy="24" r="19" fill="none" stroke="url(#g)" stroke-width="3.2"/>
  <circle cx="24" cy="24" r="12.5" fill="none" stroke="url(#g)" stroke-width="1.6" stroke-dasharray="4 3.2" opacity=".85"/>
  <circle cx="24" cy="24" r="5.5" fill="url(#g)"/>
</svg>`;

const pagina = (tam, fracao) => `<!doctype html><html><body style="margin:0;width:${tam}px;height:${tam}px;display:grid;place-items:center;
  background:radial-gradient(circle at 30% 20%, #10204a, #080b12 70%)">
  <div style="width:${tam * fracao}px;height:${tam * fracao}px;filter:drop-shadow(0 0 ${tam / 30}px rgba(37,99,235,.7))">${marca(1).replace(/width="48" height="48"/, 'width="100%" height="100%"')}</div>
</body></html>`;

const saidas = [
  ["public/icones/icone-192.png", 192, 0.72],
  ["public/icones/icone-512.png", 512, 0.72],
  ["public/icones/icone-mascara-512.png", 512, 0.56], // área segura do ícone adaptável
  ["public/apple-touch-icon.png", 180, 0.7],
  ["public/favicon.png", 64, 0.86],
];

const nav = await chromium.launch();
for (const [arq, tam, fr] of saidas) {
  const p = await nav.newPage({ viewport: { width: tam, height: tam } });
  await p.setContent(pagina(tam, fr));
  await writeFile(path.join(raiz, arq), await p.screenshot({ type: "png" }));
  await p.close();
  console.log("gerado", arq);
}
await nav.close();
