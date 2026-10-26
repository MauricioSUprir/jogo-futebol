// Teste de navegador do "Recomeçar a história do zero" na pausa: com a história terminada (8 vilões vencidos, falas
// vistas, pontos), o botão aparece na pausa do celular deitado sem nada por cima; o 1º toque só pede confirmação e
// desarma sozinho em 4 s sem apagar nada; o 2º toque logo depois zera o passo, as falas e os vilões e recarrega; o
// COMEÇAR depois disso abre a história do começo (o S.T.A.R. Labs). (Zerado = nada gravado: a página nova apaga o
// progresso ao carregar, antes de ler.)
// Uso: node velocista/tools/teste-recomecar.mjs [--pc]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const pc = process.argv.includes('--pc');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir(pc ? { largura: 1280, altura: 720 } : { largura: 844, altura: 390, dpr: 2, toque: true });
const espera = (fn, arg, t = 400000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);
const lido = () => pagina.evaluate(() => Object.fromEntries(['theflash.missoes.v2', 'theflash.historia.v1', 'theflash.viloes.v1'].map((k) => [k, JSON.parse(localStorage.getItem(k) || 'null')])));
const comecar = async () => {
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
};
const VILOES = ['zoom', 'frio', 'onda', 'mago', 'reverso', 'final', 'savitar', 'devoe'];

await pagina.goto(srv.url, { timeout: 400000 });
await pagina.evaluate((v) => {
  localStorage.clear();
  localStorage.setItem('theflash.missoes.v2', JSON.stringify({ id: null, stats: { pontos: 21000, crimes: 9 }, base: {} }));
  localStorage.setItem('theflash.viloes.v1', JSON.stringify({ vencidos: v }));
  localStorage.setItem('theflash.historia.v1', JSON.stringify({ vistas: ['cena:prologo', 'cena:depois-nucleo', 'missao:lab:fecha'], capitulo: 'Epílogo' }));
}, VILOES);
await pagina.goto(srv.url, { timeout: 400000 });
await comecar();
ok(await pagina.evaluate(() => window.__rel.missoes.livre), 'com o progresso gravado, a história abre terminada (cidade livre)');
await pagina.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); });
ok(await espera(() => !document.getElementById('telaPausa').hidden, null, 60000), 'a pausa abre');
const caps = await pagina.evaluate(() => document.querySelectorAll('#capitulos .cap').length);
ok(caps === 8, `a pausa tem os 8 capítulos para jogar de novo (${caps}) e o botão de recomeçar embaixo`);
// o clique do Playwright rola até o botão e reprova se outra coisa estiver por cima dele
await pagina.click('#btnRecomecar', { timeout: 60000 });
const armado = await pagina.evaluate(() => { const b = document.getElementById('btnRecomecar'); return { classe: b.classList.contains('confirma'), texto: b.textContent }; });
const depois1 = await lido();
ok(armado.classe && /Toque de novo/.test(armado.texto), `o 1º toque pede confirmação ("${armado.texto}")`);
ok(depois1['theflash.missoes.v2'].id === null && depois1['theflash.viloes.v1'].vencidos.length === 8, 'o 1º toque não apaga nada');
await pagina.waitForTimeout(4600);
const desarmado = await pagina.evaluate(() => { const b = document.getElementById('btnRecomecar'); return { classe: b.classList.contains('confirma'), texto: b.textContent }; });
ok(!desarmado.classe && desarmado.texto === 'Recomeçar a história do zero', `sem o 2º toque, desarma sozinho em 4 s ("${desarmado.texto}")`);
// agora os dois toques: zera e recarrega
await pagina.click('#btnRecomecar', { timeout: 60000 });
const recarregou = pagina.waitForEvent('load', { timeout: 1200000 }).then(() => true).catch(() => false);
await pagina.click('#btnRecomecar', { timeout: 60000 }).catch(() => {});
ok(await recarregou, 'o 2º toque recarrega a página');
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
const zerado = await lido();
ok((zerado['theflash.missoes.v2']?.id ?? 'lab') === 'lab' && !zerado['theflash.missoes.v2']?.stats?.pontos, `o passo da história volta ao começo (${JSON.stringify(zerado['theflash.missoes.v2'])})`);
ok(!zerado['theflash.viloes.v1']?.vencidos.length, `nenhum vilão vencido (${JSON.stringify(zerado['theflash.viloes.v1'])})`);
ok(!zerado['theflash.historia.v1']?.vistas.length && !zerado['theflash.historia.v1']?.capitulo, `as falas e as cenas voltam a tocar (nenhuma vista: ${JSON.stringify(zerado['theflash.historia.v1'])})`);
await comecar();
ok(await espera(() => window.__rel.missoes.atual?.id === 'lab' && !window.__rel.missoes.livre, null, 60000), 'o COMEÇAR abre a história do começo: "Bem-vindo ao S.T.A.R. Labs"');
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
