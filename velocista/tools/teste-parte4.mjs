// Teste da PARTE 4 da história (dono, 30/10: "e mais história, faça"): a ordem depois do fim da Parte 3; a velocista de roxo
// (o corpo da Iris com a roupa roxa e os óculos) nos lugares; a TEMPESTADE (o golpe novo do traje) liberada só depois do Cisco
// instalar; os Malandros (três vilões juntos) e a fuga das celas; as cenas e o rádio; a continuação de quem terminou a Parte 3.
// Com --navegador: no jogo, a velocista de roxo aparece com corpo; a TEMPESTADE fica escondida antes e, liberada, derruba uma
// gangue inteira em volta; o capítulo dos Malandros começa com os três; tudo sem erro no console.
// Uso: node velocista/tools/teste-parte4.mjs [--navegador]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = (f) => import(pathToFileURL(path.join(AQUI, '../js', f)).href);
const mis = await imp('missoes.js'), M = await imp('marcos.js'), cid = await imp('cidade.js'), H = await imp('historia.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const ler = (f) => fs.readFileSync(path.join(AQUI, '..', f), 'utf8');
const ids = mis.MISSOES.map((m) => m.id), pos = (id) => ids.indexOf(id), P4 = mis.MISSOES.slice(pos('p4-consulta'), pos('p4-fim') + 1);
const jogo = ler('js/jogo.js'), V = ler('js/viloes.js');

// ---- 1. a ordem
ok(pos('p4-consulta') === pos('p3-fim') + 1, 'a Parte 4 começa logo depois do fim da Parte 3');
const ordem = ['p4-consulta', 'p4-assalto', 'p4-beco', 'p4-gangue', 'p4-foto', 'p4-cortex', 'p4-corrida', 'p4-jantar', 'p4-revelacao',
  'p4-explica', 'p4-celas', 'p4-oficina', 'p4-tempestade', 'p4-incendio', 'p4-queda', 'p4-maefilha', 'cap-malandros', 'p4-vovo'];
ok(ordem.every((id, k) => pos(id) >= 0 && (!k || pos(ordem[k - 1]) === pos(id) - 1)), 'Atos 13 e 14 na ordem: ' + ordem.join(' → '));
ok(H.CENAS[mis.MISSOES[pos('p4-consulta')].cenaAbre]?.[0]?.titulo === 'O futuro dela', 'a Parte 4 abre com o cartão dela');
const ordem2 = ['p4-vovo', 'p4-cela', 'p4-antenas', 'p4-fendas', 'p4-capangas', 'p4-vibe', 'p4-diario', 'p4-confronto', 'p4-sozinho', 'p4-joe', 'p4-perdao', 'cap-devoe2',
  'p4-satelite', 'p4-plano', 'p4-fuga', 'p4-bateria', 'p4-corrida2', 'p4-panico', 'cap-reinicio', 'p4-despedida', 'p4-partida', 'p4-bebe', 'p4-fim'];
ok(ordem2.every((id, k) => pos(id) >= 0 && (!k || pos(ordem2[k - 1]) === pos(id) - 1)) && (ids[pos('p4-fim') + 1] ?? 'p5-').startsWith('p5-'), 'Atos 15 e 16 na ordem, e a Parte 4 termina no Cortex: ' + ordem2.join(' → '));
ok(P4.length >= 40, `${P4.length} passos na Parte 4`);
// ---- 2. os lugares e a velocista de roxo
const B = cid.bloco(cid.LAB_CELULA[0], cid.LAB_CELULA[1]); M.registrarPontosLab(B.cx, B.cz);
for (const n of ['cortexVisita', 'oficinaCisco']) {
  const w = M.pontoMundo(n), R = cid.retangulosPerto(w.x, w.z, 1), hx = w.x + Math.sin(w.h) * 3.6, hz = w.z + Math.cos(w.h) * 3.6;
  ok(!cid.empurrar(R, w.x, w.z, 0.45, 0.3, 1.8).bateu && !cid.empurrar(cid.retangulosPerto(hx, hz, 1), hx, hz, 0.45, 0.3, 1.8).bateu, `ponto "${n}" livre, e o herói cabe à frente`);
}
const ALIADOS = ['joe', 'iris', 'cisco', 'caitlin', 'cigarra', 'violeta', 'vulto', 'reverso', 'negro'];
ok(P4.every((m) => !m.aliados || Object.entries(m.aliados).every(([q, p]) => ALIADOS.includes(q) && M.pontoMundo(p))), 'quem espera em cada lugar existe');
ok(/violeta: \{ pessoa: 'iris', aderecos: 'violeta' \}/.test(ler('js/aliados.js')) && /id === 'violeta'/.test(ler('js/aderecos.js')), 'a velocista de roxo: o corpo da Iris, a roupa roxa e os óculos (aderecos.js)');
// ---- 3. a TEMPESTADE
const C = ler('js/combate.js');
ok(/tempestade: \{ nome: 'Tempestade', custo: 0\.6, teclas: \['4', 'g'\] \}/.test(C) && /A\.tipo === 'tempestade'/.test(C) && /d > 24/.test(C), 'TEMPESTADE: 60% de energia, teclas 4 e G, um relâmpago em cada inimigo a até 24 m');
ok(/t === 'tempestade' && !podeTempestade\(\)/.test(jogo) && /POS_TEMPESTADE = MISSOES\.findIndex\(\(m\) => m\.id === 'p4-tempestade'\)/.test(jogo), 'só liberada a partir do passo p4-tempestade (antes, a tecla não faz nada)');
ok(pos('p4-oficina') + 1 === pos('p4-tempestade') && mis.MISSOES[pos('p4-tempestade')].contador === 'tempestades' && mis.MISSOES[pos('p4-tempestade')].crime === 'gangue', 'o Cisco instala na oficina e o passo seguinte é usar numa gangue');
ok(/id="bt-tempestade"/.test(ler('index.html')) && /id="chip-tempestade"/.test(ler('index.html')), 'o botão TEMPESTADE (celular) e a ficha 4 (PC)');
// ---- 4. os Malandros
ok(/id: 'malandros'[^}]*viloes: \['frio', 'onda', 'mago'\]/.test(V) && /const OFF = \[\[0, 0\], \[4, 2\], \[-4, 3\]/.test(V), 'os Malandros: os três juntos, cada um no seu lugar');
ok(/FUGAS = \[\{ de: MISSOES\.findIndex\(\(m\) => m\.id === 'p4-celas'\), ate: 'malandros', ids: \['frio', 'onda', 'mago'\] \}[,\]]/.test(jogo), 'eles somem das celas da contenção do p4-celas até o capítulo ser vencido');
// ---- 5. as cenas e o rádio
const fechaPeloRadio = (m) => m.alvo === 'esfera' || m.alvo === 'fenda' || m.alvo === 'subestacao' || m.crime || m.patrulha || m.tipo === 'portais' || m.tipo === 'bateria' || mis.MISSOES[pos(m.id) + 1]?.capitulo;
const semCena = P4.filter((m) => !m.capitulo && !fechaPeloRadio(m) && !H.CENAS[`depois-${m.id}`]);
ok(!semCena.length, `cada passo de história termina numa cena (${semCena.map((m) => m.id).join(', ') || 'todos'})`);
ok(P4.filter((m) => !m.capitulo && m.id !== 'p4-consulta').every((m) => H.MISSOES_FALAS[m.id]?.abre?.length), 'cada passo (menos o primeiro, que abre com a cena) começa com rádio');
for (const id of ['malandros', 'devoe2', 'reinicio']) ok(['cap', 'encontro', 'derrotado'].every((k) => H.CENAS[`${k}-${id}`]?.length >= 3) && ['capitulo', 'luta', 'derrota'].every((k) => H.RADIO[`${k}-${id}`]?.length), `capítulo ${id}: cenas e rádio`);
ok(/id: 'reinicio'[^}]*viloes: \['devoe', 'frio', 'onda', 'mago'\][^}]*perseguicao: false/.test(V) && /id: 'devoe2'[^}]*viloes: \['devoe'\]/.test(V), 'o capítulo 16 (o corpo novo do DeVoe) e o 17 (o DeVoe e os três Malandros juntos)');
ok(['escudo', 'fase2'].every((k) => H.RADIO[`${k}-devoe2`]?.length && H.RADIO[`${k}-reinicio`]?.length), 'o rádio do escudo e da 2ª fase do DeVoe nos dois capítulos');
ok(H.CENAS['depois-p4-fim'].at(-1).titulo === 'Fim da Parte 4' && !P4.flatMap((m) => H.CENAS[`depois-${m.id}`] || []).some((f) => f.cartao && f.rotulo === 'Continua') && /mostrarCreditos\(4\)/.test(jogo), 'a Parte 4 termina com "Fim da Parte 4" e os créditos dela (sem "Continua")');
ok(P4.filter((m) => m.tempo).every((m) => H.RADIO[`falhou-${m.id}`]?.length), 'cada cronômetro tem a fala de quando o tempo acaba');
const todas = [...Object.values(H.CENAS).flat(), ...Object.values(H.RADIO).flat(), ...Object.values(H.MISSOES_FALAS).flatMap((v) => [...(v.abre || []), ...(v.fecha || [])])];
ok(todas.every((f) => f.cartao || (H.PERSONAGENS[f.quem] && f.texto.length < 160)), `${todas.length} falas, todas com personagem e curtas`);
ok(H.CENAS['depois-p3-fim'].at(-1).titulo === 'Fim da Parte 3' && /a Parte 4 começa/.test(jogo), 'a Parte 3 termina e os créditos dela avisam da Parte 4');
// ---- 6. quem já tinha terminado continua
const mem = (o) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; } });
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: 'p3-fim', stats: {} }) })).atual?.id === 'p4-consulta', 'terminou a Parte 3: continua no começo da Parte 4');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: ids.at(-1), stats: {} }) })).livre, 'terminou tudo: a cidade fica livre');
ok(mis.criarMissoes(mem({ 'theflash.missoes.v2': JSON.stringify({ id: null, ultimo: 'p4-vovo', stats: {} }) })).atual?.id === 'p4-cela', 'terminou a 1ª entrega da Parte 4: continua no Ato 15');

// ---- 7. no navegador
if (process.argv.includes('--navegador')) {
  const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
  const srv = await servidor(0, path.join(AQUI, '..'));
  const { navegador, pagina, erros } = await abrir({ largura: 960, altura: 540 });
  const espera = (fn, arg, t = 900000) => pagina.waitForFunction(fn, arg, { timeout: t, polling: 500 }).then(() => true).catch(() => false);
  const abrirJogo = async (q) => {
    await pagina.goto(srv.url + q, { timeout: 1200000 });
    await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
    await pagina.evaluate(() => { localStorage.clear(); localStorage.setItem('theflash.historia.v1', JSON.stringify({ vistas: ['cena:p4-abertura', 'cena:noite-do-raio', 'cena:prologo'] })); Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
    await pagina.evaluate(() => { const R = window.__rel; R.historia.calarRadio(); R.crimes.adiantar(-1e9); });
  };
  await abrirJogo('?missao=p4-beco');
  ok(await espera(() => !!window.__rel.aliados.pessoas.violeta), 'a velocista de roxo espera atrás da Delegacia (com corpo)');
  ok(await pagina.evaluate(() => document.getElementById('bt-tempestade').classList.contains('bloq')), 'antes do Cisco, a TEMPESTADE fica escondida');
  await pagina.evaluate(() => window.__rel.missoes.irPara('p4-tempestade'));
  ok(await espera(() => !document.getElementById('chip-tempestade').classList.contains('bloq')), 'liberada, a TEMPESTADE aparece');
  const n0 = await pagina.evaluate(() => { const R = window.__rel; R.combate.gerarGangue(R.P.x + 9, R.P.z + 3, 4); R.P.energia = 1; return R.missoes.stats.nocautes || 0; });
  await pagina.waitForTimeout(3000);
  await pagina.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: '4' })); });
  ok(await espera(() => (window.__rel.missoes.stats.tempestades || 0) >= 1), 'a tecla 4 solta a TEMPESTADE (e conta para o passo)');
  ok(await espera((n0) => (window.__rel.missoes.stats.nocautes || 0) >= n0 + 3, n0, 600000), 'o céu derruba a gangue em volta (3 ou mais nocautes)');
  await abrirJogo('?capitulo=malandros');
  ok(await espera(() => window.__rel.viloes.fase === 'aparece' && window.__rel.viloes.viloes.length === 3 && window.__rel.viloes.viloes.every((v) => v.modelo)), 'o capítulo dos Malandros começa com os três, com corpo');
  ok(await pagina.evaluate(() => { const v = window.__rel.viloes.viloes; return Math.min(Math.hypot(v[0].x - v[1].x, v[0].z - v[1].z), Math.hypot(v[0].x - v[2].x, v[0].z - v[2].z), Math.hypot(v[1].x - v[2].x, v[1].z - v[2].z)) > 2; }), 'nenhum em cima do outro');
  await abrirJogo('?capitulo=reinicio');
  // (o capítulo 17 é em frente ao S.T.A.R. Labs, onde o herói começa: a luta já sai na hora)
  ok(await espera(() => ['aparece', 'luta'].includes(window.__rel.viloes.fase) && window.__rel.viloes.viloes.length === 4 && window.__rel.viloes.viloes.every((v) => v.modelo)), 'o capítulo 17 começa com os quatro (o DeVoe e os Malandros), com corpo');
  await pagina.evaluate(() => window.__rel.missoes.irPara('p4-partida'));
  ok(await espera(() => !!window.__rel.aliados.pessoas.violeta), 'a Nora espera na Câmara do Núcleo para voltar (com corpo)');
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
