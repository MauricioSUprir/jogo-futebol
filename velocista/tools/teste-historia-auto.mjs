// Teste de navegador da história automática: os capítulos entram como passos da história e começam SOZINHOS (sem a
// pausa), um depois do outro; durante a história não há crime aleatório (só os que o passo pede e os do "Guardião
// da cidade"); a pausa não oferece capítulos até o fim; o progresso da versão antiga vai para o mesmo passo; com a
// história terminada, a cidade fica livre (crimes aleatórios e os capítulos para jogar de novo na pausa).
// Uso: node velocista/tools/teste-historia-auto.mjs [--celular]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const celular = process.argv.includes('--celular');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir(celular ? { largura: 844, altura: 390, dpr: 2, toque: true } : { largura: 1280, altura: 720 });
const espera = (fn, arg, t = 400000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);
const abrirJogo = async (q, guardar = {}) => {
  await pagina.goto(srv.url + q, { timeout: 400000 });
  await pagina.evaluate((g) => { localStorage.clear(); for (const [k, v] of Object.entries(g)) localStorage.setItem(k, JSON.stringify(v)); }, guardar);
  await pagina.goto(srv.url + q, { timeout: 400000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  await pagina.evaluate(() => { window.__rel.mundo.T = 0.45; });
};

// ---- o capítulo começa sozinho quando a história chega nele ----
await abrirJogo('?missao=cap-zoom');
ok(await pagina.evaluate(() => window.__rel.missoes.atual?.capitulo === 'zoom'), 'o Zoom é um passo da história');
ok(await espera(() => window.__rel.viloes.fase === 'aparece' && window.__rel.viloes.viloes[0]?.id === 'zoom', null, 200000), 'o capítulo do Zoom começa sozinho, sem a pausa');
// com o Zoom vencido, o passo conclui sozinho e a história segue
await abrirJogo('?missao=cap-zoom', { 'theflash.viloes.v1': { vencidos: ['zoom'] } });
ok(await espera(() => window.__rel.missoes.atual?.id === 'especiais'), 'com o Zoom vencido, o passo conclui e vem o próximo');

// ---- sem crime aleatório durante a história ----
await abrirJogo('?missao=velocidade');
await pagina.evaluate(() => { const R = window.__rel; R.crimes.atualizar(0, R.P, {}); });
await pagina.waitForTimeout(20000);
ok(await pagina.evaluate(() => !window.__rel.crimes.ativo), 'durante a história nenhum crime aparece sozinho');
const pausa = await pagina.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); return true; });
await espera(() => !document.getElementById('pausa').hidden, null, 30000);
const cap = await pagina.evaluate(() => ({ botoes: document.querySelectorAll('#capitulos button').length, texto: document.getElementById('capitulos').textContent }));
ok(pausa && cap.botoes === 0 && /sozinha/.test(cap.texto), `a pausa não oferece capítulos durante a história ("${cap.texto.slice(0, 50)}…")`);

// ---- progresso antigo ----
await abrirJogo('', { 'theflash.missoes.v1': { indice: 14, stats: { pontos: 1234 } }, 'theflash.historia.v1': { vistas: ['cena:prologo'] } });
const mig = await pagina.evaluate(() => ({ id: window.__rel.missoes.atual?.id, pts: window.__rel.missoes.stats.pontos }));
ok(mig.id === 'cap-reverso' && mig.pts === 1234, `o progresso antigo vai para o mesmo passo (${mig.id}, ${mig.pts} pts)`);

// ---- cidade livre depois do fim ----
const todos = ['zoom', 'frio', 'onda', 'mago', 'reverso', 'final', 'savitar', 'devoe'];
await abrirJogo('', { 'theflash.missoes.v2': { id: null }, 'theflash.viloes.v1': { vencidos: todos }, 'theflash.historia.v1': { vistas: ['cena:prologo'] } });
ok(await pagina.evaluate(() => window.__rel.missoes.livre && /Cidade livre/.test(document.getElementById('missaoNum').textContent)), 'história concluída: cidade livre');
ok(await espera(() => !!window.__rel.crimes.ativo, null, 400000), 'na cidade livre os crimes aparecem sozinhos');
await pagina.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); });
await espera(() => !document.getElementById('pausa').hidden, null, 30000);
const n = await pagina.evaluate(() => document.querySelectorAll('#capitulos button.vencido').length);
ok(n === 8, `na pausa, os 8 capítulos para jogar de novo (${n})`);
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
