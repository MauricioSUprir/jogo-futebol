// Teste de navegador do RELÂMPAGO: carrega, corre, pula, desliza, usa a Força e confere o fim de jogo.
// Uso: node velocista/tools/teste.mjs [pasta-de-prints]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const saida = process.argv[2];
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
await pagina.goto(srv.url);
await pagina.waitForFunction(() => window.__relampago, null, { timeout: 20000 });
await pagina.waitForTimeout(600);
if (saida) await pagina.screenshot({ path: path.join(saida, 'menu.png') });
await pagina.click('#btnJogar');
await pagina.waitForTimeout(1500);
const r = await pagina.evaluate(() => { const J = window.__relampago.J; return { modo: J.modo, dist: J.dist, vel: J.vel, ativos: window.__relampago.ativos.length }; });
ok(r.modo === 'jogando', 'modo jogando depois de CORRER');
ok(r.dist > 5, `distância avança (${r.dist.toFixed(1)} m)`);
ok(r.ativos > 3, `obstáculos gerados (${r.ativos})`);

await pagina.keyboard.press('ArrowLeft');
await pagina.waitForTimeout(300);
ok(await pagina.evaluate(() => window.__relampago.J.faixa) === 0, 'trocou para a faixa da esquerda');
await pagina.keyboard.press('Space');
await pagina.waitForTimeout(150);
ok(await pagina.evaluate(() => window.__relampago.J.y) > 0.2, 'pulou');
await pagina.waitForTimeout(900);
await pagina.keyboard.press('ArrowDown');
await pagina.waitForTimeout(120);
ok(await pagina.evaluate(() => window.__relampago.J.deslizando) > 0, 'deslizou');

// Força da Velocidade: gasta energia e desacelera o tempo
const antes = await pagina.evaluate(() => window.__relampago.J.forca);
await pagina.keyboard.down('Shift');
await pagina.waitForTimeout(500);
const dur = await pagina.evaluate(() => ({ f: window.__relampago.J.forca, a: window.__relampago.J.forcaAtiva }));
await pagina.keyboard.up('Shift');
ok(dur.a && dur.f < antes, `Força gasta energia (${antes.toFixed(2)} -> ${dur.f.toFixed(2)})`);
if (saida) await pagina.screenshot({ path: path.join(saida, 'jogo.png') });

// deixa correr sem desviar até acabar as vidas
await pagina.evaluate(() => { window.__relampago.J.forca = 0; });
await pagina.waitForFunction(() => window.__relampago.J.modo === 'fim', null, { timeout: 90000 }).catch(() => {});
const fim = await pagina.evaluate(() => ({ modo: window.__relampago.J.modo, vidas: window.__relampago.J.vidas, tela: !document.getElementById('telaFim').hidden }));
ok(fim.modo === 'fim' && fim.vidas === 0 && fim.tela, 'fim de jogo depois de 3 batidas');
if (saida) await pagina.screenshot({ path: path.join(saida, 'fim.png') });
await pagina.click('#btnDeNovo');
await pagina.waitForTimeout(300);
ok(await pagina.evaluate(() => window.__relampago.J.modo) === 'jogando', 'recomeça');

ok(erros.length === 0, `sem erros no console (${erros.join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
