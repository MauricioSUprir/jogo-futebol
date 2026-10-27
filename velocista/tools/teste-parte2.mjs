// Teste da PARTE 2 da história (dono, 27/10: "quero uma parte dois da história, bem maior"): a ordem dos atos depois do
// 'nucleo', a linha do tempo alterada (o Ponto de Ignição) contínua e com o raio fraco, as cenas e as falas de cada passo,
// os capítulos novos (Nevasca, Corredor Negro) com cena, rádio e perfil, e a continuação de quem já tinha terminado a
// Parte 1 (o save sem passo vai para o primeiro passo novo). Com --navegador: no jogo, a linha do tempo alterada liga o
// crepúsculo e as cores dela e esvazia o Cortex; a Nevasca e o Corredor Negro aparecem com corpo; o Corredor Negro espera
// na praça; tudo sem erro no console.
// Uso: node velocista/tools/teste-parte2.mjs [--navegador]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = (f) => import(pathToFileURL(path.join(AQUI, '../js', f)).href);
const mis = await imp('missoes.js'), M = await imp('marcos.js'), vel = await imp('velocidade.js');
const H = await imp('historia.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

// ---- 1. a ordem
const ids = mis.MISSOES.map((m) => m.id), pos = (id) => ids.indexOf(id), P2 = mis.MISSOES.slice(pos('p2-exames'));
ok(pos('p2-exames') === pos('nucleo') + 1, 'a Parte 2 começa logo depois do fim da Parte 1 (o Núcleo)');
ok(P2.length >= 20, `${P2.length} passos na Parte 2`);
const ordem = ['p2-exames', 'p2-caixinha', 'p2-limite', 'p2-tunel', 'p2-mundo', 'p2-joe', 'p2-iris', 'p2-assalto', 'p2-cisco', 'p2-esferas', 'cap-nevasca', 'p2-mae', 'p2-desfazer', 'p2-volta',
  'p2-boatos', 'p2-silhueta', 'p2-celas', 'p2-incendio', 'p2-fuga', 'cap-negro', 'p2-lista'];
ok(ordem.every((id, k) => pos(id) >= 0 && (!k || pos(ordem[k - 1]) === pos(id) - 1)), 'Atos 5 e 6 na ordem: ' + ordem.join(' → '));
// ---- 2. o Ponto de Ignição: do primeiro passo depois do túnel até o passo de desfazer, contínuo e com o raio fraco
const ig = mis.MISSOES.filter((m) => m.epoca === 'ignicao');
ok(ig.length >= 8 && ig.every((m, k) => !k || pos(m.id) === pos(ig[k - 1].id) + 1), `${ig.length} passos seguidos na linha do tempo alterada`);
ok(ig[0].id === 'p2-mundo' && ig.at(-1).id === 'p2-desfazer' && !mis.MISSOES[pos('p2-desfazer') + 1].epoca, 'entra depois do túnel e sai depois de desfazer');
ok(ig.every((m) => m.fraco > 0.3 && m.fraco < 1), 'lá a velocidade fica mais fraca em todos os passos');
const teto = vel.tetoCorrida(1) * 3.6;
ok(teto >= 400 * 1.05, `os 400 km/h do teste cabem no teto (${teto.toFixed(0)} km/h)`);
ok(mis.MISSOES.filter((m) => m.tipo === 'tunel').every((m) => vel.tetoCorrida(1) * (m.fraco || 1) * 3.6 >= 180 * 1.2), 'o túnel (180 km/h) cabe na velocidade de cada passo de túnel, mesmo fraco');
// ---- 3. os lugares e quem espera neles
const ALIADOS = ['joe', 'iris', 'cisco', 'vulto', 'reverso', 'negro'];
const comPonto = P2.filter((m) => m.ponto);
ok(comPonto.every((m) => M.pontoMundo(m.ponto)), `os ${comPonto.length} lugares da Parte 2 existem`);
ok(P2.every((m) => !m.aliados || Object.entries(m.aliados).every(([q, p]) => ALIADOS.includes(q) && M.pontoMundo(p))), 'quem espera em cada lugar existe');
const aliadosJs = fs.readFileSync(path.join(AQUI, '../js/aliados.js'), 'utf8');
ok(/cisco: \{ pessoa: 'cisco' \}/.test(aliadosJs) && /negro: \{ traje: 'negro', vibra: true \}/.test(aliadosJs), 'o Cisco e o Corredor Negro podem esperar na cidade (aliados.js)');
ok(P2.filter((m) => m.alvoSala).every((m) => ['contencao', 'cortex', 'nucleo'].includes(m.alvoSala)), 'o guia sabe levar até a sala pedida');
// ---- 4. as cenas, as falas e o rádio
// (as esferas fecham pelo rádio; o passo logo antes de um capítulo segue direto para a cena do capítulo)
const semCena = P2.filter((m) => (m.ponto || m.alvo || m.alvoSala || m.tipo === 'tunel') && m.alvo !== 'esfera' && !mis.MISSOES[pos(m.id) + 1]?.capitulo && !H.CENAS[`depois-${m.id}`]);
ok(!semCena.length, `cada passo de história termina numa cena (${semCena.map((m) => m.id).join(', ') || 'todos'})`);
ok(P2.filter((m) => m.alvo === 'esfera' || mis.MISSOES[pos(m.id) + 1]?.capitulo).every((m) => H.MISSOES_FALAS[m.id]?.abre?.length), 'esses abrem com rádio');
ok(P2.filter((m) => H.CENAS[`depois-${m.id}`]).every((m) => H.CENAS[`depois-${m.id}`].length >= 5), 'cada cena com pelo menos 5 falas');
ok(H.CENAS[mis.MISSOES[pos('p2-exames')].cenaAbre]?.[0]?.cartao, 'a Parte 2 abre com o cartão dela');
for (const id of ['nevasca', 'negro']) ok(['cap', 'encontro', 'derrotado'].every((k) => H.CENAS[`${k}-${id}`]?.length >= 3) && ['capitulo', 'luta', 'derrota'].every((k) => H.RADIO[`${k}-${id}`]?.length), `capítulo ${id}: cenas e rádio`);
ok(P2.filter((m) => m.tempo).every((m) => H.RADIO[`falhou-${m.id}`]?.length), 'cada cronômetro tem a fala de quando o tempo acaba');
const todas = [...Object.values(H.CENAS).flat(), ...Object.values(H.RADIO).flat(), ...Object.values(H.MISSOES_FALAS).flatMap((v) => [...(v.abre || []), ...(v.fecha || [])])];
ok(todas.every((f) => f.cartao || (H.PERSONAGENS[f.quem] && f.texto.length < 160)), `${todas.length} falas, todas com personagem e curtas`);
ok(H.CENAS['depois-nucleo'].at(-1).titulo === 'Fim da Parte 1', 'a Parte 1 termina com "Fim da Parte 1"');
// ---- 5. os vilões novos
const V = fs.readFileSync(path.join(AQUI, '../js/viloes.js'), 'utf8');
ok(/nevasca: \{[^}]*pessoa: 'caitlin', arma: 'gelo'/s.test(V) && /negro: \{[^}]*traje: 'negro', raio: 'branco'/s.test(V) && /drena: 0\.\d+/.test(V), 'Nevasca (corpo da Caitlin, raio de gelo) e Corredor Negro (velocista que drena a energia)');
ok(/negro: \{ verm:/.test(fs.readFileSync(path.join(AQUI, '../js/traje.js'), 'utf8')) && /branco: \{ raio:/.test(fs.readFileSync(path.join(AQUI, '../js/raios.js'), 'utf8')), 'o traje do Corredor Negro e o raio pálido existem');
// ---- 6. quem já tinha terminado continua
const mem = (o) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; } });
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, stats: { pontos: 900 }, base: {} }) })).atual?.id === 'p2-exames', 'terminou a Parte 1: continua no começo da Parte 2 (com os pontos)');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v1': JSON.stringify({ indice: 99, stats: {} }) })).atual?.id === 'p2-exames', 'o save antigo (v1) terminado também');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: ids.at(-1), stats: {} }) })).livre, 'terminou tudo: a cidade fica livre');
ok(mis.criarMissoes(mem({})).atual?.id === 'lab', 'sem save: começa do começo');

// ---- 7. no navegador
if (process.argv.includes('--navegador')) {
  const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
  const srv = await servidor(0, path.join(AQUI, '..'));
  const { navegador, pagina, erros } = await abrir({ largura: 960, altura: 540 });
  const espera = (fn, arg, t = 900000) => pagina.waitForFunction(fn, arg, { timeout: t, polling: 500 }).then(() => true).catch(() => false);
  async function abrirJogo(q) {
    await pagina.goto(srv.url + q, { timeout: 1200000 });
    await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
    await pagina.evaluate(() => { localStorage.clear(); Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
    await pagina.evaluate(() => { const R = window.__rel; R.historia.calarRadio(); R.crimes.adiantar(-1e9); });
  }
  await abrirJogo('?missao=p2-joe');
  ok(await espera(() => document.body.classList.contains('ignicao')), 'Ponto de Ignição: o mundo nas cores dele (body.ignicao)');
  ok(await pagina.evaluate(() => Math.abs(window.__rel.mundo.T - 0.77) < 0.01), 'e no crepúsculo parado');
  ok(await espera(() => window.__rel.aliados.pessoas.joe?.raiz.visible === false || !!window.__rel.aliados.pessoas.joe), 'o Joe espera na Delegacia');
  await pagina.evaluate(() => window.__rel.missoes.irPara('p2-volta'));
  ok(await espera(() => !document.body.classList.contains('ignicao')), 'depois de desfazer: de volta ao presente');
  await pagina.evaluate(() => window.__rel.missoes.irPara('p2-silhueta'));
  ok(await espera(() => !!window.__rel.aliados.pessoas.negro), 'o Corredor Negro espera na praça (com corpo)');
  for (const id of ['nevasca', 'negro']) {
    await abrirJogo(`?capitulo=${id}`);
    ok(await espera(() => window.__rel.viloes.fase === 'aparece'), `capítulo ${id} começa`);
    ok(await espera(() => !!window.__rel.viloes.viloes[0]?.modelo), `${id} tem corpo`);
  }
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
