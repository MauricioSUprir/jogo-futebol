// Teste de navegador da LOGO na tela de início (e nos créditos): a imagem carrega, cabe na tela inteira sem rolar no PC
// (1280 × 720) e no celular deitado (844 × 390), não encosta no texto nem no botão COMEÇAR, e grava os prints.
// Uso: node velocista/tools/teste-logo.mjs [pasta-de-prints]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), saida = process.argv[2];
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const srv = await servidor(0, path.join(AQUI, '..'));
for (const [nome, opc] of [['pc', { largura: 1280, altura: 720 }], ['cel', { largura: 844, altura: 390, dpr: 2, toque: true }]]) {
  const { navegador, pagina, erros } = await abrir(opc);
  await pagina.goto(srv.url, { timeout: 400000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
  const r = await pagina.evaluate(() => {
    const img = document.querySelector('#telaInicio h1.logo img'), b = img.getBoundingClientRect(), p = document.querySelector('#telaInicio > p:not(.so-toque), #telaInicio > p.so-toque');
    const vis = [...document.querySelectorAll('#telaInicio > p')].find((e) => e.offsetParent), pb = vis?.getBoundingClientRect();
    return { carregou: img.complete && img.naturalWidth === 1800, w: b.width, h: b.height, x0: b.left, x1: b.right, y0: b.top, y1: b.bottom, vw: innerWidth, vh: innerHeight,
      texto: pb ? pb.top : null, alt: img.alt };
  });
  ok(r.carregou && r.alt === 'THE FLASH', `${nome}: a logo carrega (1800 px, alt "${r.alt}")`);
  ok(r.x0 >= 0 && r.x1 <= r.vw && r.y0 >= -2 && r.w >= Math.min(380, r.vw * 0.45), `${nome}: a logo cabe na largura e aparece grande (${Math.round(r.w)} × ${Math.round(r.h)} px numa tela de ${r.vw} × ${r.vh})`);
  ok(r.texto === null || r.texto >= r.y1 - 2, `${nome}: o texto começa abaixo da logo (logo até ${Math.round(r.y1)}, texto em ${Math.round(r.texto)})`);
  if (saida) await pagina.screenshot({ path: path.join(saida, `${nome}-inicio.png`), timeout: 400000 });
  const bt = await pagina.evaluate(() => { const b = document.getElementById('btnJogar').getBoundingClientRect(); return { y1: b.bottom, vh: innerHeight }; });
  ok(bt.y1 <= bt.vh, `${nome}: o botão COMEÇAR aparece sem rolar (termina em ${Math.round(bt.y1)} de ${bt.vh})`);
  ok(!erros.length, `${nome}: sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close();
}
await srv.fechar();
process.exit(falhas ? 1 : 0);
