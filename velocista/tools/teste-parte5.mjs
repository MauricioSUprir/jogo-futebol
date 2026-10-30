// Teste da PARTE 5 da história (dono, 30/10: "cria o resto da história, cria mais história"), entrega 1 (Atos 17 e 18): a
// ordem depois do fim da Parte 4; o Bloodwork (vilão novo: o jato de sangue — o cone do fogo, vermelho-escuro — que drena a
// energia) e os dois infectados; os passos que usam os pontos de interação novos (a foto com o fã e o desafio de corrida, com o
// guia levando à largada); as cenas e o rádio; a continuação de quem terminou a Parte 4.
// Com --navegador: no jogo, o Bloodwork aparece com corpo (e o chão do jato vermelho, não laranja); o capítulo 19 começa com os
// três, sem um em cima do outro; no passo do desafio o guia aponta a largada; tudo sem erro no console.
// Uso: node velocista/tools/teste-parte5.mjs [--navegador]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = (f) => import(pathToFileURL(path.join(AQUI, '../js', f)).href);
const mis = await imp('missoes.js'), M = await imp('marcos.js'), cid = await imp('cidade.js'), H = await imp('historia.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const ler = (f) => fs.readFileSync(path.join(AQUI, '..', f), 'utf8');
const ids = mis.MISSOES.map((m) => m.id), pos = (id) => ids.indexOf(id), P5 = mis.MISSOES.slice(pos('p5-aniversario'));
const jogo = ler('js/jogo.js'), V = ler('js/viloes.js'), A = ler('js/aderecos.js');

// ---- 1. a ordem
ok(pos('p5-aniversario') === pos('p4-fim') + 1, 'a Parte 5 começa logo depois do fim da Parte 4');
const ordem = ['p5-aniversario', 'p5-ramsey', 'p5-roubo', 'p5-pistas', 'p5-amostra', 'p5-olhos', 'p5-jitters', 'p5-incendio', 'p5-fa', 'cap-sangue', 'p5-culpa',
  'p5-ceu', 'p5-monitor', 'p5-prova', 'p5-desafio', 'p5-iris', 'p5-joe', 'p5-infectados', 'p5-vacina', 'cap-sangue2', 'p5-veredito'];
ok(ordem.every((id, k) => pos(id) >= 0 && (!k || pos(ordem[k - 1]) === pos(id) - 1)), 'Atos 17 e 18 na ordem: ' + ordem.join(' → '));
ok(P5.length >= 21, `${P5.length} passos na Parte 5`);
ok(H.CENAS[mis.MISSOES[pos('p5-aniversario')].cenaAbre]?.[0]?.titulo === 'A Crise', 'a Parte 5 abre com o cartão dela');
// ---- 2. os lugares
const B = cid.bloco(cid.LAB_CELULA[0], cid.LAB_CELULA[1]); M.registrarPontosLab(B.cx, B.cz);
const ALIADOS = ['joe', 'iris', 'cisco', 'caitlin', 'cigarra', 'violeta', 'vulto', 'reverso', 'negro'];
ok(P5.every((m) => !m.aliados || Object.entries(m.aliados).every(([q, p]) => ALIADOS.includes(q) && M.pontoMundo(p))), 'quem espera em cada lugar existe');
ok(P5.filter((m) => m.ponto).every((m) => M.pontoMundo(m.ponto)), 'todos os lugares existem');
const pis = mis.MISSOES[pos('p5-pistas')], per = mis.MISSOES[pos('pericia')];
ok(pis.ponto === per.ponto && JSON.stringify(pis.pistas.map((p) => p.slice(0, 2))) === JSON.stringify(per.pistas.map((p) => p.slice(0, 2))), 'as pistas da praça nos mesmos lugares (já conferidos) da primeira perícia');
// ---- 3. os vilões novos
ok(/sangue: \{\s*nome: 'BLOODWORK'[^}]*arma: 'fogo'[^}]*drena: 0\.15/.test(V) && /infectadoA: \{[^}]*pessoa: 'frio'[^}]*arma: 'fogo'/.test(V) && /infectadoB: \{[^}]*pessoa: 'mago'[^}]*arma: 'fogo'/.test(V), 'o Bloodwork (jato de sangue que drena) e dois infectados');
ok(/id: 'sangue'[^}]*viloes: \['sangue'\][^}]*lugar: 'cidade'/.test(V) && /id: 'sangue2'[^}]*viloes: \['sangue', 'infectadoA', 'infectadoB'\]/.test(V), 'o capítulo 18 (na cidade) e o 19 (os três na porta do laboratório)');
ok(/id === 'sangue'/.test(A) && /id === 'infectadoA' \|\| id === 'infectadoB'/.test(A), 'os adereços: a máscara e as veias do Bloodwork, o capuz dos infectados');
ok(!/\[2\.2, 0\.7, 0\.12\]/.test(V) && /pf\.corRaio\.map\(\(c\) => c \* 0\.85\)/.test(V), 'o chão do jato tem a cor de quem atira (fogo laranja, sangue vermelho)');
ok(/v0\.perf\.dica \|\|/.test(V), 'a dica da luta fala do jato de sangue');
// ---- 4. os passos com os pontos de interação novos
const fa = mis.MISSOES[pos('p5-fa')], de = mis.MISSOES[pos('p5-desafio')];
ok(fa.contador === 'fotos' && de.contador === 'desafios' && de.alvo === 'largada', 'a foto com o fã (contador fotos) e o desafio de corrida (contador desafios, guia na largada)');
ok(/missoes\.contar\('fotos'\)/.test(jogo) && /missoes\.contar\('desafios'\)/.test(jogo) && /m\?\.alvo === 'largada'/.test(jogo), 'o jogo conta as fotos e os desafios e leva o guia à largada mais perto');
{
  const mem = (o) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; } });
  const X = mis.criarMissoes(mem({})); X.irPara('p5-desafio');
  ok(X.progresso().txt === '0/1', 'o passo do desafio começa em 0/1');
  X.contar('desafios'); ok(X.avaliar({})?.id === 'p5-desafio' && X.atual.id === 'p5-iris', 'um desafio completo fecha o passo');
  X.irPara('p5-fa'); X.contar('fotos'); ok(X.avaliar({})?.id === 'p5-fa', 'uma foto com fã fecha o passo da esperança');
}
// ---- 5. as cenas e o rádio
const fechaPeloRadio = (m) => m.alvo === 'esfera' || m.alvo === 'fenda' || m.alvo === 'subestacao' || m.crime || m.patrulha || m.tipo === 'portais' || m.tipo === 'bateria' || mis.MISSOES[pos(m.id) + 1]?.capitulo;
const semCena = P5.filter((m) => !m.capitulo && !fechaPeloRadio(m) && !H.CENAS[`depois-${m.id}`]);
ok(!semCena.length, `cada passo de história termina numa cena (${semCena.map((m) => m.id).join(', ') || 'todos'})`);
ok(P5.filter((m) => !m.capitulo && m.id !== 'p5-aniversario').every((m) => H.MISSOES_FALAS[m.id]?.abre?.length), 'cada passo (menos o primeiro, que abre com a cena) começa com rádio');
for (const id of ['sangue', 'sangue2']) ok(['cap', 'encontro', 'derrotado'].every((k) => H.CENAS[`${k}-${id}`]?.length >= 3) && ['capitulo', 'luta', 'derrota'].every((k) => H.RADIO[`${k}-${id}`]?.length), `capítulo ${id}: cenas e rádio`);
ok(H.RADIO['fase2-sangue']?.length, 'o rádio da 2ª fase do Bloodwork');
ok(P5.filter((m) => m.tempo).every((m) => H.RADIO[`falhou-${m.id}`]?.length), 'cada cronômetro tem a fala de quando o tempo acaba');
for (const [cena, acao] of [['derrotado-sangue', 'someSangue'], ['depois-p5-monitor', 'monitor'], ['depois-p5-desafio', 'someMonitor'], ['derrotado-sangue2', 'cura']]) {
  ok(H.CENAS[cena].some((f) => f.acao === acao) && new RegExp(`'${cena}': \\{ aoAcao`).test(jogo), `a cena ${cena} tem o efeito "${acao}" no jogo`);
}
ok(['ramsey', 'sangue', 'monitor'].every((p) => H.PERSONAGENS[p]), 'os personagens novos: Ramsey Rosso, Bloodwork e o Monitor');
const todas = [...Object.values(H.CENAS).flat(), ...Object.values(H.RADIO).flat(), ...Object.values(H.MISSOES_FALAS).flatMap((v) => [...(v.abre || []), ...(v.fecha || [])])];
ok(todas.every((f) => f.cartao || (H.PERSONAGENS[f.quem] && f.texto.length < 160)), `${todas.length} falas, todas com personagem e curtas`);
ok(H.CENAS['depois-p5-culpa'].some((f) => f.cartao && f.titulo === 'Sangue novo') && H.CENAS['depois-p5-veredito'].some((f) => f.cartao && f.titulo === 'O Monitor'), 'os cartões do fim do Ato 17 e do Ato 18');
ok(/a Parte 5 começa/.test(jogo), 'os créditos da Parte 4 avisam da Parte 5');
// ---- 6. quem já tinha terminado continua
const mem = (o) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; } });
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: 'p4-fim', stats: {} }) })).atual?.id === 'p5-aniversario', 'terminou a Parte 4: continua no começo da Parte 5');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: ids.at(-1), stats: {} }) })).livre, 'terminou tudo: a cidade fica livre');

// ---- 7. no navegador
if (process.argv.includes('--navegador')) {
  const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
  const srv = await servidor(0, path.join(AQUI, '..'));
  const { navegador, pagina, erros } = await abrir({ largura: 960, altura: 540 });
  const espera = (fn, arg, t = 900000) => pagina.waitForFunction(fn, arg, { timeout: t, polling: 500 }).then(() => true).catch(() => false);
  const abrirJogo = async (q) => {
    await pagina.goto(srv.url + q, { timeout: 1200000 });
    await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
    await pagina.evaluate(() => { localStorage.clear(); localStorage.setItem('theflash.historia.v1', JSON.stringify({ vistas: ['cena:p5-abertura', 'cena:noite-do-raio', 'cena:prologo'] })); Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
    await pagina.evaluate(() => { const R = window.__rel; R.historia.calarRadio(); R.crimes.adiantar(-1e9); });
  };
  await abrirJogo('?capitulo=sangue');
  ok(await espera(() => ['aparece', 'luta'].includes(window.__rel.viloes.fase) && window.__rel.viloes.viloes[0]?.id === 'sangue' && !!window.__rel.viloes.viloes[0].modelo), 'o capítulo 18 começa com o Bloodwork, com corpo');
  ok(await pagina.evaluate(() => { const P = window.__rel.viloes.perigos || []; return P.length > 0 && P.every((p) => p.rgb && p.rgb[0] > p.rgb[1] * 8); }), 'o rastro no chão em volta dele é vermelho de sangue (não laranja)');
  await abrirJogo('?capitulo=sangue2');
  ok(await espera(() => ['aparece', 'luta'].includes(window.__rel.viloes.fase) && window.__rel.viloes.viloes.length === 3 && window.__rel.viloes.viloes.every((v) => v.modelo)), 'o capítulo 19 começa com os três (o Bloodwork e os infectados), com corpo');
  ok(await pagina.evaluate(() => { const v = window.__rel.viloes.viloes; return Math.min(Math.hypot(v[0].x - v[1].x, v[0].z - v[1].z), Math.hypot(v[0].x - v[2].x, v[0].z - v[2].z), Math.hypot(v[1].x - v[2].x, v[1].z - v[2].z)) > 2; }), 'nenhum em cima do outro');
  await abrirJogo('?missao=p5-desafio');
  ok(await espera(() => /^Desafio: /.test(window.__rel.alvoMissao()?.rotulo || '')), 'no passo do desafio, o guia aponta a largada mais perto');
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
