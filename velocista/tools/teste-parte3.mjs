// Teste da PARTE 3 da história (dono, 28/10: "faça mais partes da história, introduzindo aquele traje ... quero a Caitlin e o
// Cisco introduzindo e mostrando o traje pra ele, e uma história maior"): a ordem depois do fim da Parte 2; a Caitlin e o Cisco
// na sala dos trajes com a vitrine; o traje novo a partir do 'p3-veste' e os poderes dele (a bateria, a armadura, o tempo lento);
// as cenas, o rádio e o capítulo da Nevasca; a continuação de quem terminou a Parte 2. Com --navegador: no jogo, a Caitlin e o
// Cisco esperam na sala dos trajes com o traje novo girando na vitrine; depois de vestir, o herói usa o traje novo, o botão
// TEMPO aparece e o tempo lento deixa o mundo a 25%; a armadura reduz o golpe; tudo sem erro no console.
// Uso: node velocista/tools/teste-parte3.mjs [--navegador]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = (f) => import(pathToFileURL(path.join(AQUI, '../js', f)).href);
const mis = await imp('missoes.js'), M = await imp('marcos.js'), cid = await imp('cidade.js'), H = await imp('historia.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const ids = mis.MISSOES.map((m) => m.id), pos = (id) => ids.indexOf(id), P3 = mis.MISSOES.slice(pos('p3-convite'));
const jogo = fs.readFileSync(path.join(AQUI, '../js/jogo.js'), 'utf8');

// ---- 1. a ordem
ok(pos('p3-convite') === pos('p2-fim') + 1, 'a Parte 3 começa logo depois do fim da Parte 2');
const ordem = ['p3-convite', 'p3-veste', 'p3-tempo', 'p3-queda', 'p3-bateria', 'p3-gangue', 'p3-noticia', 'p3-vovo', 'p3-devoe', 'p3-batidas', 'p3-maos', 'p3-rastro', 'cap-nevasca2', 'p3-acordo'];
ok(ordem.every((id, k) => pos(id) >= 0 && (!k || pos(ordem[k - 1]) === pos(id) - 1)), 'Atos 9 e 10 na ordem: ' + ordem.join(' → '));
ok(H.CENAS[mis.MISSOES[pos('p3-convite')].cenaAbre]?.[0]?.titulo === 'A força do raio', 'a Parte 3 abre com o cartão dela');
// ---- 2. o traje: a Caitlin e o Cisco mostram na sala dos trajes, com a vitrine; ele veste no pedestal
const B = cid.bloco(cid.LAB_CELULA[0], cid.LAB_CELULA[1]); M.registrarPontosLab(B.cx, B.cz);
for (const n of ['vitrine', 'trajesCaitlin', 'trajesCisco', 'medicaCaitlin']) {
  const w = M.pontoMundo(n), R = cid.retangulosPerto(w.x, w.z, 1);
  ok(!cid.empurrar(R, w.x, w.z, 0.45, 0.3, 1.8).bateu, `ponto "${n}" livre dentro do laboratório`);
}
const conv = mis.MISSOES[pos('p3-convite')], veste = mis.MISSOES[pos('p3-veste')];
ok(conv.alvoSala === 'trajes' && conv.aliados.caitlin && conv.aliados.cisco && veste.ponto === 'vitrine' && veste.aliados.caitlin && veste.aliados.cisco, 'a Caitlin e o Cisco esperam na sala dos trajes, e ele veste na vitrine');
{ const v = M.pontoMundo('vitrine'), c = M.pontoMundo('trajesCaitlin'), k = M.pontoMundo('trajesCisco'), hx = (c.x + k.x) / 2, hz = (c.z + k.z) / 2 + 3.6;
  ok(Math.hypot(hx - (B.cx + 49), hz - (B.cz - 18)) > 2.2 && v.z < c.z, 'na conversa o herói fica de frente para os dois, com a vitrine atrás deles e longe do pedestal do meio'); }
const cv = H.CENAS['depois-p3-convite'], cve = H.CENAS['depois-p3-veste'];
ok(cv.some((f) => f.quem === 'caitlin') && cv.some((f) => f.quem === 'cisco') && cv.some((f) => f.acao === 'luzes') && cv.length >= 10, `a apresentação: a Caitlin e o Cisco mostram o traje (${cv.length} falas, com as luzes da vitrine)`);
ok(cve.some((f) => f.acao === 'veste') && /mundo inteiro fica lento/.test(cve.map((f) => f.texto).join(' ')), 'ele veste o traje na cena e eles contam o tempo lento');
ok(/trajeNovo = \(\) => missoes\.livre \|\| missoes\.indice > POS_VESTE/.test(jogo) && /if \(roupa === 'traje' && trajeNovo\(\)\) roupa = 'novo'/.test(jogo), 'depois do p3-veste, todo "traje" é o traje novo');
ok(/traje: 'novo'/.test(jogo) && /novo: \{ verm:/.test(fs.readFileSync(path.join(AQUI, '../js/traje.js'), 'utf8')), 'o corpo do traje novo é o desenho "novo" de traje.js (o da vitrine traje.html)');
// ---- 3. os poderes
ok(/BATERIA = \{ embalo: 0\.55, carga: 0\.06 \}, ARMADURA = 0\.6, TEMPO_LENTO = \{ fator: 0\.25, dura: 4\.5, custo: 0\.35 \}/.test(jogo), 'bateria (embalo 0,55), armadura (60%), tempo lento (25%, 4,5 s, 35% de energia)');
ok(/combate\.passo\(dt, P, \{ dtMundo: dtM \}\)/.test(jogo) && /viloes\.atualizar\(dtM/.test(jogo) && /trafego\.atualizar\(dtM/.test(jogo) && /pedestres\.atualizar\(dtM/.test(jogo) && /crimes\.atualizar\(J\.dtM/.test(jogo), 'no tempo lento: bandidos, vilões, trânsito, pessoas e crimes a 25%');
ok(/DANO_HEROI \* \(P\.protecao \?\? 1\)/.test(fs.readFileSync(path.join(AQUI, '../js/combate.js'), 'utf8')) && /dano \* k \* \(P\.protecao \?\? 1\)/.test(fs.readFileSync(path.join(AQUI, '../js/viloes.js'), 'utf8')), 'a armadura vale contra bandidos e vilões');
const tp = mis.MISSOES[pos('p3-tempo')], bt = mis.MISSOES[pos('p3-bateria')];
ok(tp.contador === 'lentos' && tp.meta === 2 && bt.tipo === 'bateria', 'os passos de treino: o tempo lento (2 vezes) e a bateria (8 s acima de 400 km/h)');
const html = fs.readFileSync(path.join(AQUI, '../index.html'), 'utf8');
ok(/id="bt-tempo"/.test(html) && /id="chip-tempo"/.test(html) && /body\.lento #cena/.test(html), 'o botão TEMPO (celular), a ficha T (PC) e a cor do tempo lento');
// ---- 4. as cenas, o rádio e o capítulo
const fechaPeloRadio = (m) => m.alvo === 'esfera' || m.crime || m.contador === 'lentos' || m.tipo === 'bateria' || mis.MISSOES[pos(m.id) + 1]?.capitulo;
const semCena = P3.filter((m) => !m.capitulo && !fechaPeloRadio(m) && !H.CENAS[`depois-${m.id}`]);
ok(!semCena.length, `cada passo de história termina numa cena (${semCena.map((m) => m.id).join(', ') || 'todos'})`);
ok(P3.filter((m) => !m.capitulo && m.id !== 'p3-convite').every((m) => H.MISSOES_FALAS[m.id]?.abre?.length), 'cada passo (menos o primeiro, que abre com a cena) começa com rádio');
ok(['cap', 'encontro', 'derrotado'].every((k) => H.CENAS[`${k}-nevasca2`]?.length >= 3) && ['capitulo', 'luta', 'derrota'].every((k) => H.RADIO[`${k}-nevasca2`]?.length), 'capítulo nevasca2: cenas e rádio');
ok(/id: 'nevasca2'[^}]*viloes: \['nevasca'\]/.test(fs.readFileSync(path.join(AQUI, '../js/viloes.js'), 'utf8')), 'o capítulo 12 traz a Nevasca de novo');
const todas = [...Object.values(H.CENAS).flat(), ...Object.values(H.RADIO).flat(), ...Object.values(H.MISSOES_FALAS).flatMap((v) => [...(v.abre || []), ...(v.fecha || [])])];
ok(todas.every((f) => f.cartao || (H.PERSONAGENS[f.quem] && f.texto.length < 160)), `${todas.length} falas, todas com personagem e curtas`);
ok(H.CENAS['depois-p2-fim'].at(-1).titulo === 'Fim da Parte 2' && /a Parte 3 começa/.test(jogo), 'a Parte 2 termina e os créditos dela avisam da Parte 3');
// ---- 5. quem já tinha terminado continua
const mem = (o) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; } });
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: 'p2-fim', stats: {} }) })).atual?.id === 'p3-convite', 'terminou a Parte 2: continua no começo da Parte 3');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: ids.at(-1), stats: {} }) })).livre, 'terminou tudo: a cidade fica livre (com o traje novo)');

// ---- 6. no navegador
if (process.argv.includes('--navegador')) {
  const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
  const srv = await servidor(0, path.join(AQUI, '..'));
  const { navegador, pagina, erros } = await abrir({ largura: 960, altura: 540 });
  const espera = (fn, arg, t = 900000) => pagina.waitForFunction(fn, arg, { timeout: t, polling: 500 }).then(() => true).catch(() => false);
  await pagina.goto(srv.url + '?missao=p3-convite', { timeout: 1200000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
  await pagina.evaluate(() => { localStorage.clear(); localStorage.setItem('theflash.historia.v1', JSON.stringify({ vistas: ['cena:p3-abertura', 'cena:noite-do-raio', 'cena:prologo'] })); Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  await pagina.evaluate(() => { const R = window.__rel; R.historia.calarRadio(); R.crimes.adiantar(-1e9); });
  // o herói vai até a sala dos trajes
  await pagina.evaluate(() => { const R = window.__rel, x = R.LAB_B.cx + 49, z = R.LAB_B.cz - 15; Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0 }); });
  ok(await espera(() => !!window.__rel.aliados.pessoas.caitlin && !!window.__rel.aliados.pessoas.cisco), 'a Caitlin e o Cisco esperam na sala dos trajes (com corpo)');
  ok(await espera(() => window.__rel.vitrine?.traje === 'novo' && window.__rel.vitrine.grupo.visible), 'o traje novo gira na vitrine');
  ok(await pagina.evaluate(() => document.getElementById('bt-tempo').classList.contains('bloq')), 'antes do treino, o botão TEMPO fica escondido');
  await pagina.evaluate(() => window.__rel.missoes.irPara('p3-tempo'));
  ok(await espera(() => window.__rel.J.roupa === 'novo'), 'depois de vestir: o herói usa o traje novo');
  ok(await espera(() => window.__rel.vitrine?.traje === 'heroi'), 'e o traje antigo vai para a vitrine');
  ok(await espera(() => !document.getElementById('chip-tempo').classList.contains('bloq')), 'o TEMPO aparece');
  await pagina.evaluate(() => { window.__rel.P.energia = 1; window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 't' })); });
  ok(await espera(() => window.__rel.J.lento > 0 && document.body.classList.contains('lento')), 'T liga o tempo lento (a tela muda de cor)');
  const r = await pagina.evaluate(() => ({ dtM: window.__rel.J.dtM, e: window.__rel.P.energia, prot: window.__rel.P.protecao, n: window.__rel.missoes.stats.lentos }));
  ok(r.dtM < 0.02 && r.e < 0.7 && r.prot === 0.6 && r.n >= 1, `o mundo a 25% (dt ${r.dtM?.toFixed(4)}), custou energia (${(r.e * 100).toFixed(0)}%), armadura ${r.prot}, contou (${r.n})`);
  await pagina.goto(srv.url + '?capitulo=nevasca2', { timeout: 1200000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
  await pagina.evaluate(() => { localStorage.clear(); document.getElementById('btnJogar').click(); });
  ok(await espera(() => window.__rel.viloes.fase === 'aparece' && !!window.__rel.viloes.viloes[0]?.modelo), 'o capítulo 12 começa com a Nevasca');
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
