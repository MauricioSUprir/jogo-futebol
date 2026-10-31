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
const ids = mis.MISSOES.map((m) => m.id), pos = (id) => ids.indexOf(id), P2 = mis.MISSOES.slice(pos('p2-exames'), pos('p2-fim') + 1);
ok(pos('p2-exames') === pos('nucleo') + 1, 'a Parte 2 começa logo depois do fim da Parte 1 (o Núcleo)');
ok(P2.length >= 20, `${P2.length} passos na Parte 2`);
const ordem = ['p2-exames', 'p2-caixinha', 'p2-limite', 'p2-tunel', 'p2-noite', 'p2-segurar', 'p2-mundo', 'p2-joe', 'p2-iris', 'p2-assalto', 'p2-cisco', 'p2-esferas', 'cap-nevasca', 'p2-mae', 'p2-desfazer', 'p2-noite2', 'p2-espera', 'p2-volta',
  'p2-boatos', 'p2-silhueta', 'p2-celas', 'p2-incendio', 'p2-fuga', 'cap-negro', 'p2-lista'];
ok(ordem.every((id, k) => pos(id) >= 0 && (!k || pos(ordem[k - 1]) === pos(id) - 1)), 'Atos 5 e 6 na ordem: ' + ordem.join(' → '));
const ordem2 = ['p2-lista', 'p2-iron', 'p2-august', 'p2-anel', 'p2-pedido', 'p2-gangue', 'p2-adaga', 'p2-sempoderes', 'p2-esferas2', 'p2-grace', 'cap-cigarra', 'p2-casamento',
  'p2-subestacoes', 'p2-mural', 'p2-treino', 'cap-godspeed', 'p2-grace-acorda', 'p2-fim'];
ok(ordem2.every((id, k) => pos(id) >= 0 && (!k || pos(ordem2[k - 1]) === pos(id) - 1)) && (ids[pos('p2-fim') + 1] ?? 'p3-convite').startsWith('p3-'), 'Atos 7 e 8 na ordem, e a Parte 2 termina no jantar (depois, a Parte 3): ' + ordem2.join(' → '));
// ---- sem poderes: a adaga trancou o raio (um teto de velocidade de gente comum e sem energia) e a volta pela metade
const sp = mis.MISSOES[pos('p2-sempoderes')];
ok(sp.teto > 4 && sp.teto <= 8 && sp.semEnergia && sp.tempo && M.pontoMundo(sp.ponto), `sem poderes: no máximo ${sp.teto} m/s, sem energia, com cronômetro`);
{ const a = M.pontoMundo('prefeitura'), b = M.pontoMundo(sp.ponto), d = Math.hypot(a.x - b.x, a.z - b.z); ok(d / sp.teto < sp.tempo * 0.75, `dá para chegar a pé: ${d.toFixed(0)} m a ${sp.teto} m/s = ${(d / sp.teto).toFixed(0)} s de ${sp.tempo} s`); }
ok(mis.MISSOES[pos('p2-esferas2')].fraco === 0.6, 'depois do choque, a velocidade volta pela metade até as esferas');
// ---- 2. o Ponto de Ignição: do primeiro passo depois do túnel até o passo de desfazer, contínuo e com o raio fraco
const ig = mis.MISSOES.filter((m) => m.epoca === 'ignicao');
ok(ig.length >= 8 && ig.every((m, k) => !k || pos(m.id) === pos(ig[k - 1].id) + 1), `${ig.length} passos seguidos na linha do tempo alterada`);
ok(ig[0].id === 'p2-mundo' && ig.at(-1).id === 'p2-desfazer' && mis.MISSOES[pos('p2-desfazer') + 1].epoca === 'noite' && !mis.MISSOES[pos('p2-volta')].epoca, 'entra depois da noite do passado e sai depois de desfazer (e da noite de novo)');
// a viagem no tempo é jogável (dono, 31/10: "ele fica correndo e eu não faço nada"): depois de cada túnel, a noite do passado
// (epoca 'noite'): correr até a casa contra o relógio e, lá, ficar parado (tipo 'espera'): segurar o pai / não entrar
{ const n1 = mis.MISSOES[pos('p2-noite')], s1 = mis.MISSOES[pos('p2-segurar')], n2 = mis.MISSOES[pos('p2-noite2')], e2 = mis.MISSOES[pos('p2-espera')];
  ok(n1.epoca === 'noite' && n1.tempo && n1.ponto && n1.cenaAbre && s1.tipo === 'espera' && s1.espera > 0, 'a 1ª viagem: corra até a casa no passado (com cronômetro) e segure o seu pai parado ao lado dele');
  ok(n2.epoca === 'noite' && n2.tempo && e2.tipo === 'espera' && e2.naoEntrar > 0, 'a 2ª viagem: corra até a casa e, desta vez, não entre (chegar perto demais te empurra para trás)'); }
{ const j = fs.readFileSync(path.join(AQUI, '../js/jogo.js'), 'utf8');
  ok(!/'depois-p2-tunel'|'depois-p2-desfazer'/.test(j) && !/'depois-tunel': \{ antes: \(\) => \{ tempo\.tunel = true; J\.corridaCena = true/.test(j), 'nenhuma cena de túnel com o herói correndo sozinho (a corrida é sua)');
  ok(/tempo\.tunel = J\.tunelT > 1 && !m\.semTunel/.test(j) && /J\.tunelT = 0; J\.esperaT = 0;/.test(j) && /m\?\.tipo === 'espera'/.test(j) && /if \(ep === 'noite'\)/.test(j), 'o túnel abre em volta de você na sua corrida; cada túnel começa do zero; a espera e a época "noite" no jogo'); }
ok(ig.every((m) => m.fraco > 0.3 && m.fraco < 1), 'lá a velocidade fica mais fraca em todos os passos');
const teto = vel.tetoCorrida(1) * 3.6;
ok(teto >= 400 * 1.05, `os 400 km/h do teste cabem no teto (${teto.toFixed(0)} km/h)`);
ok(mis.MISSOES.filter((m) => m.tipo === 'tunel').every((m) => vel.tetoCorrida(1) * (m.fraco || 1) * 3.6 >= 180 * 1.2), 'o túnel (180 km/h) cabe na velocidade de cada passo de túnel, mesmo fraco');
// ---- 3. os lugares e quem espera neles
const ALIADOS = ['joe', 'iris', 'cisco', 'cigarra', 'vulto', 'reverso', 'negro'];
const comPonto = P2.filter((m) => m.ponto);
ok(comPonto.every((m) => M.pontoMundo(m.ponto)), `os ${comPonto.length} lugares da Parte 2 existem`);
ok(P2.every((m) => !m.aliados || Object.entries(m.aliados).every(([q, p]) => ALIADOS.includes(q) && M.pontoMundo(p))), 'quem espera em cada lugar existe');
const aliadosJs = fs.readFileSync(path.join(AQUI, '../js/aliados.js'), 'utf8');
ok(/cisco: \{ pessoa: 'cisco' \}/.test(aliadosJs) && /negro: \{ traje: 'negro', vibra: true \}/.test(aliadosJs) && /cigarra: \{ pessoa: 'frio', aderecos: 'cigarra' \}/.test(aliadosJs), 'o Cisco, a Cigarra mascarada e o Corredor Negro podem esperar na cidade (aliados.js)');
ok(P2.filter((m) => m.alvoSala).every((m) => ['contencao', 'cortex', 'nucleo', 'medica'].includes(m.alvoSala)), 'o guia sabe levar até a sala pedida');
// ---- 4. as cenas, as falas e o rádio
// (as esferas fecham pelo rádio; o passo logo antes de um capítulo segue direto para a cena do capítulo)
const fechaPeloRadio = (m) => m.alvo === 'esfera' || m.alvo === 'subestacao' || mis.MISSOES[pos(m.id) + 1]?.capitulo;
// (o túnel termina na chegada: a cena de abertura do passo seguinte, já na noite do passado)
const semCena = P2.filter((m) => (m.ponto || m.alvo || m.alvoSala || m.tipo === 'tunel') && !fechaPeloRadio(m) && !H.CENAS[`depois-${m.id}`] && !(m.tipo === 'tunel' && H.CENAS[mis.MISSOES[pos(m.id) + 1]?.cenaAbre]));
ok(!semCena.length, `cada passo de história termina numa cena (${semCena.map((m) => m.id).join(', ') || 'todos'})`);
ok(P2.filter(fechaPeloRadio).every((m) => H.MISSOES_FALAS[m.id]?.abre?.length), 'esses abrem com rádio');
ok(P2.filter((m) => H.CENAS[`depois-${m.id}`]).every((m) => H.CENAS[`depois-${m.id}`].length >= 5), 'cada cena com pelo menos 5 falas');
ok(H.CENAS[mis.MISSOES[pos('p2-exames')].cenaAbre]?.[0]?.cartao, 'a Parte 2 abre com o cartão dela');
for (const id of ['nevasca', 'negro', 'cigarra', 'godspeed']) ok(['cap', 'encontro', 'derrotado'].every((k) => H.CENAS[`${k}-${id}`]?.length >= 3) && ['capitulo', 'luta', 'derrota'].every((k) => H.RADIO[`${k}-${id}`]?.length), `capítulo ${id}: cenas e rádio`);
ok(P2.filter((m) => m.tempo).every((m) => H.RADIO[`falhou-${m.id}`]?.length), 'cada cronômetro tem a fala de quando o tempo acaba');
const todas = [...Object.values(H.CENAS).flat(), ...Object.values(H.RADIO).flat(), ...Object.values(H.MISSOES_FALAS).flatMap((v) => [...(v.abre || []), ...(v.fecha || [])])];
ok(todas.every((f) => f.cartao || (H.PERSONAGENS[f.quem] && f.texto.length < 160)), `${todas.length} falas, todas com personagem e curtas`);
ok(H.CENAS['depois-nucleo'].at(-1).titulo === 'Fim da Parte 1', 'a Parte 1 termina com "Fim da Parte 1"');
ok(H.CENAS['depois-p2-fim'].at(-1).titulo === 'Fim da Parte 2' && !P2.flatMap((m) => H.CENAS[`depois-${m.id}`] || []).some((f) => f.cartao && f.rotulo === 'Continua'), 'a Parte 2 termina com "Fim da Parte 2" (sem "Continua")');
ok(H.RADIO['armadura-godspeed']?.length && ['derrotado-godspeed'].every((k) => H.CENAS[k].some((f) => f.acao === 'negroLeva')), 'o Godspeed tem armadura, e no fim o Corredor Negro volta');
// ---- 5. os vilões novos
const V = fs.readFileSync(path.join(AQUI, '../js/viloes.js'), 'utf8');
ok(/nevasca: \{[^}]*pessoa: 'caitlin', arma: 'gelo'/s.test(V) && /negro: \{[^}]*traje: 'negro', raio: 'branco'/s.test(V) && /drena: 0\.\d+/.test(V), 'Nevasca (corpo da Caitlin, raio de gelo) e Corredor Negro (velocista que drena a energia)');
ok(/negro: \{ verm:/.test(fs.readFileSync(path.join(AQUI, '../js/traje.js'), 'utf8')) && /branco: \{ raio:/.test(fs.readFileSync(path.join(AQUI, '../js/raios.js'), 'utf8')), 'o traje do Corredor Negro e o raio pálido existem');
ok(/cigarra: \{[^}]*pessoa: 'frio', arma: 'adaga'[^}]*drena:/s.test(V) && /godspeed: \{[^}]*traje: 'godspeed'[^}]*armadura: \d+/s.test(V) && /g === 'adaga'/.test(V), 'Cigarra (a adaga que drena) e Godspeed (velocista de armadura)');
ok(/godspeed: \{ verm:/.test(fs.readFileSync(path.join(AQUI, '../js/traje.js'), 'utf8')) && /prata: \{ raio:/.test(fs.readFileSync(path.join(AQUI, '../js/raios.js'), 'utf8')) && /id === 'cigarra'/.test(fs.readFileSync(path.join(AQUI, '../js/aderecos.js'), 'utf8')), 'o traje do Godspeed, o raio prateado e a máscara e a adaga da Cigarra existem');
ok(/'cigarra'\]/.test(fs.readFileSync(path.join(AQUI, '../js/contencao.js'), 'utf8')), 'a Cigarra vencida vai para a 8ª cela da contenção');
// ---- 6. quem já tinha terminado continua
const mem = (o) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; } });
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, stats: { pontos: 900 }, base: {} }) })).atual?.id === 'p2-exames', 'terminou a Parte 1: continua no começo da Parte 2 (com os pontos)');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v1': JSON.stringify({ indice: 99, stats: {} }) })).atual?.id === 'p2-exames', 'o save antigo (v1) terminado também');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: ids.at(-1), stats: {} }) })).livre, 'terminou tudo: a cidade fica livre');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: 'p2-lista', stats: {} }) })).atual?.id === 'p2-iron', 'terminou a 1ª entrega da Parte 2 (a carta): continua no Ato 7');
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
  await pagina.evaluate(() => window.__rel.missoes.irPara('p2-sempoderes'));
  ok(await espera(() => window.__rel.P.energia === 0), 'sem poderes: a energia fica em zero');
  await pagina.evaluate(() => window.__rel.missoes.irPara('p2-adaga'));
  ok(await espera(() => !!window.__rel.aliados.pessoas.cigarra), 'a Cigarra mascarada espera na praça (com corpo)');
  for (const id of ['nevasca', 'negro', 'cigarra', 'godspeed']) {
    await abrirJogo(`?capitulo=${id}`);
    ok(await espera(() => window.__rel.viloes.fase === 'aparece'), `capítulo ${id} começa`);
    ok(await espera(() => !!window.__rel.viloes.viloes[0]?.modelo), `${id} tem corpo`);
  }
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
