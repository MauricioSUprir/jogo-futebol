// Teste da TEMPORADA DA SÉRIE (js/serie.js; só na edição pessoal; dono, 31/10: "a história não fala sobre os meses em coma do
// Barry, não tem o Harrison Wells ... não mostra o Barry aprendendo seus poderes"). Em Node: com a senha guardada, a história
// é a da temporada (a normal, sem ela, não muda nada); cada passo com o que precisa (lugares que existem, capítulos que
// existem, falas de quem existe, só ações que o jogo conhece); os nove meses de coma, o Wells, os treinos que liberam cada
// golpe especial na ordem, o pai em Iron Heights, o homem de amarelo e a noite da mãe; o progresso guardado à parte.
// Com --navegador: a abertura (a noite do acelerador e o coma na maca), o Wells sentado no Cortex, os golpes trancados até
// o treino, o progresso em 'theflash.serie.*' e nenhum erro no console.
// Uso: node velocista/tools/teste-serie.mjs [--navegador]
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const HASH = /const HASH = '([0-9a-f]{64})'/.exec(fs.readFileSync(path.join(RAIZ, 'js/edicao.js'), 'utf8'))[1];
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

// cada modo num processo à parte (o módulo da edição lê a senha guardada uma vez, na carga)
const resumo = (pessoal) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  globalThis.localStorage = { getItem: (k) => (k === 'theflash.edicao.v1' && ${pessoal} ? '${HASH}' : null), setItem() {}, removeItem() {} };
  const m = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'js/missoes.js')).href)});
  const h = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, 'js/historia.js')).href)});
  const limpa = (o) => JSON.parse(JSON.stringify(o));
  console.log(JSON.stringify({ missoes: m.MISSOES.map(({ checar, ...r }) => r), cenas: limpa(h.CENAS), radio: limpa(h.RADIO), falas: limpa(h.MISSOES_FALAS), pers: limpa(h.PERSONAGENS) }));
`], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const N = resumo(false), S = resumo(true);

// ---- 1. a versão normal não muda; a pessoal é a temporada ----
ok(N.missoes[0].id === 'lab' && N.missoes.length > 150 && N.cenas['noite-do-raio'][0].rotulo === 'Seis semanas atrás' && !N.pers.wells, 'sem a senha: a história de sempre (começa no "lab", a noite do raio de seis semanas atrás, sem o Wells)');
ok(S.missoes.every((m) => m.id.startsWith('s1e')) && S.missoes.length >= 20, `com a senha: só os passos da temporada (${S.missoes.length})`);
ok(S.cenas['noite-do-raio'][0].titulo === 'A noite do acelerador' && /Harrison Wells/.test(JSON.stringify(S.cenas['noite-do-raio'])), 'a abertura é a noite do acelerador, com o Dr. Harrison Wells na TV');

// ---- 2. cada passo tem o que precisa ----
const marcos = ler('js/marcos.js'), viloes = ler('js/viloes.js'), serie = ler('js/serie.js');
const pontos = new Set([...(marcos + ler('js/interiores.js')).matchAll(/([a-zA-Z0-9]+): [[{]/g)].map((m) => m[1]));
const capsSerie = [...serie.matchAll(/\{ id: '([a-z0-9-]+)',(?: base: '([a-z0-9]+)',)?[^\n]*titulo: 'Ep\. /g)].map((m) => ({ id: m[1], base: m[2] || m[1] }));
const capsNormal = new Set([...viloes.matchAll(/\{ id: '([a-z0-9]+)', titulo: '/g)].map((m) => m[1]));
ok(capsSerie.length >= 6 && capsSerie.every((c) => capsNormal.has(c.base)), `os capítulos da temporada partem de capítulos que existem em viloes.js (${capsSerie.map((c) => c.id).join(', ')})`);
const semPonto = S.missoes.filter((m) => m.ponto && !pontos.has(m.ponto)).map((m) => `${m.id}:${m.ponto}`);
ok(!semPonto.length, `todo lugar dos passos existe no mapa (${semPonto.join(', ')})`);
ok(S.missoes.filter((m) => m.capitulo).every((m) => capsSerie.some((c) => c.id === m.capitulo)) && new Set(S.missoes.filter((m) => m.capitulo).map((m) => m.capitulo)).size === S.missoes.filter((m) => m.capitulo).length, 'todo capítulo dos passos está na lista da temporada, e cada um uma vez só');
ok(new Set(S.missoes.map((m) => m.id)).size === S.missoes.length, 'nenhum passo repetido');
const STATS = /const STATS0 = \{([^}]*)\}/.exec(ler('js/missoes.js'))[1];
ok(S.missoes.filter((m) => m.contador).every((m) => new RegExp(`\\b${m.contador}:`).test(STATS)), 'todo contador dos passos existe (inclusive os cachorros-quentes do episódio 2)');
const ACOES = new Set(['joeSai', 'tempestade', 'raio', 'deita', 'acorda', 'raioCasa', 'luzGideon', 'jornalFuturo', 'fechaJornal', 'levanta', 'senta', 'vira', 'desvira', 'someReverso', 'tunel', 'fimTunel', 'clarao']);
const quem = new Set(Object.keys(S.pers)), faltam = new Set(), acoesRuins = new Set(), cartaoComAcao = [];
const daSerie = (id) => serie.includes(`'${id}': [`) || serie.includes(`\n  ${id}: [`);
for (const [id, falas] of Object.entries(S.cenas)) for (const f of falas) {
  if (!f.cartao && !quem.has(f.quem)) faltam.add(`${id}:${f.quem}`);
  if (f.acao && daSerie(id) && !ACOES.has(f.acao)) acoesRuins.add(`${id}:${f.acao}`);
  if (f.cartao && f.acao) cartaoComAcao.push(id);
}
for (const fs2 of [...Object.values(S.radio), ...Object.values(S.falas).flatMap((o) => Object.values(o))]) for (const f of fs2) if (!quem.has(f.quem)) faltam.add(f.quem);
ok(!faltam.size, `toda fala é de alguém que existe (${[...faltam].slice(0, 5).join(', ')})`);
ok(!acoesRuins.size, `as cenas só usam ações que o jogo conhece (${[...acoesRuins].join(', ')})`);
ok(!cartaoComAcao.length, `nenhum cartão com ação (cartão não dispara ação: ${cartaoComAcao.join(', ')})`);
const ids = new Set(S.missoes.map((m) => m.id));
const orfas = Object.keys(S.cenas).filter((k) => k.startsWith('depois-s1') && !ids.has(k.slice(7)));
ok(!orfas.length, `toda cena "depois-" tem o passo dela (${orfas.join(', ')})`);
const abre = S.missoes.filter((m) => m.cenaAbre).map((m) => m.cenaAbre);
ok(abre.every((c) => S.cenas[c]), 'toda cena de abertura de episódio existe');
const POV = [...serie.matchAll(/'(pov-[a-z0-9]+)'/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
ok(POV.length >= 12 && POV.every((c) => abre.includes(c) && S.cenas[c]) && /export const CENAS_NO_LAB = new Set\(\[/.test(serie), `as cenas sem o Barry (o Wells sozinho) abrem os passos certos (${POV.length})`);

// ---- 3. igual à série: os 23 episódios, na ordem, com os títulos brasileiros (pesquisa: Wikipédia EN e PT) ----
const TITULOS = ['Piloto', 'O Homem Mais Rápido Vivo', 'O Que Não Dá Para Ultrapassar', 'Trapaceando', 'Plástico', 'O Surgimento do Flash', 'Queda de Energia', 'Flash vs. Arqueiro',
  'O Homem na Roupa Amarela', 'A Vingança dos Trapaceiros', 'O Som e a Fúria', 'Louco por Você', 'O Homem Nuclear', 'Recaída', 'Fora do Tempo', 'Tempo Trapaceiro', 'Trapaceiros',
  'Todo o Time Unido', 'Quem é Harrison Wells?', 'A Armadilha', 'As Vidas de Grodd', 'Trapaça no Ar', 'Rápido o Suficiente'];
// a ordem em que o jogador vê os cartões: o prólogo, depois a abertura de cada passo e a cena depois dele
const ordem = [...S.cenas.prologo];
for (const m of S.missoes) { if (m.cenaAbre) ordem.push(...S.cenas[m.cenaAbre]); ordem.push(...(S.cenas[`depois-${m.id}`] || [])); }
const eps = ordem.filter((f) => f.cartao && /^Episódio \d+$/.test(f.rotulo)).map((f) => [Number(f.rotulo.slice(9)), f.titulo]);
ok(eps.length === 23 && eps.every(([n, t], i) => n === i + 1 && t === TITULOS[i]), `os 23 episódios aparecem na ordem, com os títulos brasileiros (${eps.length}: ${eps.slice(-2).map((e) => e.join(' ')).join(', ')})`);
// em que episódio cada passo e cada cena caem
const epDo = {}; { let e = 1; for (const m of S.missoes) { if (m.cenaAbre) for (const f of S.cenas[m.cenaAbre]) if (f.cartao && /^Episódio \d+$/.test(f.rotulo)) e = Number(f.rotulo.slice(9)); epDo[m.id] = e; } }
const txtEp = (n) => JSON.stringify(S.missoes.filter((m) => epDo[m.id] === n).flatMap((m) => [m, ...(S.cenas[`depois-${m.id}`] || [])]));
const tudo = (c) => JSON.stringify(S.cenas[c] || []);
const fatos = [
  [1, ['Clyde Mardon', 'Ferris Air', 'Starling City', 'Um tiro', 'Flash'], 'Ep. 1: o teste no Ferris Air, o Oliver em Starling, o Clyde Mardon, o tornado, o Joe atira e o nome Flash'],
  [2, ['Danton Black', 'Multiplex', 'Hipoglicemia', 'cachorros-quentes'], 'Ep. 2: o Multiplex e a fome do metabolismo acelerado'],
  [3, ['Kyle Nimbus', 'Ronnie', 'Iron Heights', 'cela'], 'Ep. 3: o Névoa, a prisão no anel do acelerador e o Ronnie'],
  [4, ['Leonard Snart', 'Felicity', 'pistola de frio', 'Mick'], 'Ep. 4: o Snart com a pistola de frio, a Felicity e o encontro com o Mick Rory'],
  [5, ['Bette', 'Eiling', 'rio'], 'Ep. 5: a Bette Sans Souci, o General Eiling e a bomba no rio'],
  [6, ['Tony Woodward', 'Mach 1', 'O Flash', 'arquivo da Nora Allen'], 'Ep. 6: o Girder, o soco supersônico, o nome dado à Iris e o homem de amarelo ameaçando o Joe'],
  [7, ['Farooq', 'Tockman', 'velocidade sumiu'], 'Ep. 7: o Blackout drena a velocidade e o Tockman na Delegacia'],
  [8, ['Bivolo', 'Oliver', 'Ronnie', 'força-tarefa'], 'Ep. 8: o Bivolo, o Flash contra o Arqueiro e o rosto do Ronnie no fogo'],
  [9, ['Mercury Labs', 'táquions', 'apaixonado', 'armadilha'], 'Ep. 9: a Mercury Labs, a confissão para a Iris e a armadilha'],
  [10, ['Caitlin', 'Lisa'], 'Ep. 10: o Snart e o Rory sequestram a Caitlin; a Lisa tira os dois do transporte'],
  [11, ['Hartley', 'podia explodir'], 'Ep. 11: o Hartley Rathaway e o risco que o Wells sabia'],
  [12, ['Shawna', 'Linda', 'jeito de correr', 'FUNDIRAM'], 'Ep. 12: a Peek-a-Boo, a Linda Park, o pai desconfiando e o Ronnie fundido com o Stein'],
  [13, ['Stein', 'Barry adulto', 'explodir'], 'Ep. 13: o Firestorm e o sangue do Barry adulto na casa'],
  [14, ['Eiling', 'voltar', 'Mason'], 'Ep. 14: o exército, o Ronnie e o Stein indo embora e o Barry decidido a voltar no tempo'],
  [15, ['Mark Mardon', 'eu sou o Flash', 'Vinte e quatro horas antes'], 'Ep. 15: o Mark Mardon, a Iris sabendo e o Barry voltando um dia no tempo'],
  [16, ['vivo', 'Lisa', 'Fechado'], 'Ep. 16: o Cisco vivo de novo, o sequestro pela Lisa e o trato com o Snart'],
  [17, ['Axel Walker', 'James Jesse', 'bomba', 'homem de amarelo'], 'Ep. 17: os Trapaceiros, a bomba e o Barry contando que o Wells é o homem de amarelo'],
  [18, ['Ray Palmer', 'Brie Larvan', 'Tina', 'sonhos'], 'Ep. 18: o Ray Palmer, as abelhas-robô da Brie Larvan e os sonhos do Cisco'],
  [19, ['Hannibal Bates', 'verdadeiro Harrison Wells', '2024'], 'Ep. 19: o Everyman, o corpo do verdadeiro Wells e a sala escondida com o jornal de 2024'],
  [20, ['óculos', 'Hannibal Bates', 'você vai morrer'], 'Ep. 20: as memórias do Cisco, a armadilha, o Joe atira no Bates e a promessa do Wells ao Barry em coma'],
  [21, ['Grodd', 'trem', 'Eiling'], 'Ep. 21: o Grodd controlando o Eiling e o trem'],
  [22, ['cadeira de rodas', 'Lian Yu', 'nanites', 'ficha'], 'Ep. 22: a cadeira de rodas, o transporte, o Snart e as nanites do Arqueiro'],
  [23, ['odiava o Flash', 'marido e mulher', 'balançando a cabeça', 'Eu te amo, mãe', 'buraco negro', 'Temporada 2'], 'Ep. 23: o porquê do Thawne, o casamento, a despedida da Nora, o Eddie, o buraco negro e "continua"'],
];
const textoEp = (n) => txtEp(n) + JSON.stringify(Object.entries(S.cenas).filter(([k]) => (k.startsWith('pov-') || k.startsWith('ep-') || k.startsWith('cap-') || k.startsWith('encontro-') || k.startsWith('derrotado-')) && S.missoes.some((m) => epDo[m.id] === n && (m.cenaAbre === k || (m.capitulo && k.endsWith(`-${m.capitulo}`))))).map(([, v]) => v));
for (const [n, palavras, msg] of fatos) { const t = textoEp(n), faltando = palavras.filter((p) => !t.includes(p)); ok(!faltando.length, `${msg}${faltando.length ? ` (falta: ${faltando.join(', ')})` : ''}`); }
// as revelações no episódio certo (o que a série mostra sem o Barry)
ok(/2024/.test(tudo('pov-e2')) && tudo('pov-e2').indexOf('jornalFuturo') < tudo('pov-e2').indexOf('Episódio 2'), 'o fim do episódio 1: o Wells sozinho, andando, lendo o jornal de 2024');
ok(/Stagg/.test(tudo('pov-e3')) && tudo('pov-e3').indexOf('Stagg') < tudo('pov-e3').indexOf('Episódio 3'), 'o fim do episódio 2: o Wells vai até o Stagg');
ok(/raio/.test(tudo('pov-e4')) && /gravação/.test(tudo('pov-e4')), 'o fim do episódio 3: o Wells assistindo à gravação do raio na perícia');
ok(/Grodd/.test(tudo('pov-e6')), 'o fim do episódio 5: o Wells e o Grodd numa jaula, cinco anos antes');
ok(S.cenas['pov-e10'].some((f) => f.acao === 'vira') && tudo('pov-e10').indexOf('vira') < tudo('pov-e10').indexOf('Episódio 10'), 'o fim do episódio 9: o Wells é o homem de amarelo (o traje na sala escondida)');
ok(/Eobard Thawne/.test(tudo('pov-cisco')) && S.cenas['pov-cisco'].findIndex((f) => f.acao === 'levanta') < S.cenas['pov-cisco'].findIndex((f) => f.acao === 'vira') && epDo['s1e15-iris'] === 15, 'episódio 15: o Wells se levanta para o Cisco, diz que é o Eobard Thawne e mata o Cisco (na linha do tempo que o Barry desfaz)');
ok(/Mason/.test(tudo('pov-e17')) && /Tess/.test(tudo('pov-e18')) && /De hoje em diante, eu sou Harrison Wells/.test(tudo('pov-e18')), 'episódios 16 e 17: o Mason some; e o Thawne mata o verdadeiro Wells e toma o lugar dele');
ok(/criou/.test(tudo('ep-20')) && /se casa/.test(tudo('ep-20')), 'episódio 20: a Gideon conta que o Barry a criou e que ele se casa com a Iris');
// os poderes no episódio em que a série mostra o Barry aprendendo
const lib = Object.fromEntries(S.missoes.flatMap((m) => (m.libera || []).map((t) => [t, epDo[m.id]])));
ok(lib.ciclone === 1 && lib.sonico === 6 && lib.vibrar === 17 && lib.raio === 23 && S.missoes.at(-1).libera?.includes('raio'), `os poderes no episódio da série: ciclone no 1 (o tornado), soco supersônico no 6, atravessar vibrando no 17; o raio só depois da temporada (${JSON.stringify(lib)})`);
ok(S.missoes.find((m) => m.id === 's1e7-refens')?.semEnergia && S.missoes.find((m) => m.id === 's1e7-refens')?.teto <= 8, 'episódio 7: sem a velocidade (o Blackout drenou)');
ok(S.missoes.filter((m) => epDo[m.id] >= 20 && m.id !== 's1e20-memorias' && m.id !== 's1e20-plano' && m.id !== 's1e20-armadilha').every((m) => m.semEquipe?.includes('wells')), 'depois que a armadilha o desmascara (episódio 20), o Wells some do Cortex');
ok(S.missoes.filter((m) => m.reversoPreso).every((m) => epDo[m.id] === 23), 'o Flash Reverso só fica na cela depois de preso pelas nanites (episódio 23)');
ok(S.missoes.find((m) => m.id === 's1e23-buraco')?.crise, 'o buraco negro: o céu da crise');
// a viagem no tempo é jogável (dono, 31/10: "ele fica correndo e eu não faço nada, eu que tenho que impedir e fazer as coisas")
{ const i = S.missoes.findIndex((m) => m.id === 's1e23-passado'), [t1, casa, esp, volta, fim] = S.missoes.slice(i, i + 5);
  ok(t1.tipo === 'tunel' && casa.epoca === 'noite' && casa.tempo && casa.ponto && S.cenas[casa.cenaAbre] && esp.tipo === 'espera' && esp.naoEntrar > 0 && esp.epoca === 'noite' && volta.tipo === 'tunel' && volta.epoca === 'noite' && fim.capitulo && S.cenas[fim.cenaAbre],
    'episódio 23 jogável: o túnel é a sua corrida, você corre até a casa no passado contra o relógio, se segura para não entrar (o Flash do futuro te bloqueia), volta pelo túnel e enfrenta o Thawne'); }
ok(!Object.entries(S.cenas).some(([k, v]) => daSerie(k) && v.some((f) => f.acao === 'tunel')), 'nenhuma cena da temporada com o herói correndo sozinho no túnel');
ok(S.missoes.find((m) => m.id === 's1e17-bomba')?.semTunel, 'a corrida com a bomba (episódio 17) não abre o túnel do tempo');
ok(/uniform float uVib/.test(ler('js/traje.js')) && /tCab = smoothstep\(1\.45, 1\.62, position\.y\)/.test(ler('js/traje.js')) && /mt\.userData\.uVib\.value = vj/.test(ler('js/humano.js')), 'a vibração nova: o corpo e mais o rosto tremendo a cada quadro no shader do traje, com o contorno elétrico');

// ---- 4. no jogo ----
const jogo = ler('js/jogo.js');
ok(/CHAVES_HISTORIA = new Set\(\['theflash\.missoes\.v2'/.test(jogo) && /c\.replace\('theflash\.', 'theflash\.serie\.'\)/.test(jogo), 'o progresso da temporada em chaves próprias (theflash.serie.*)');
ok(/const podeEspecial = \(t\) =>/.test(jogo) && /!podeEspecial\(t\)\) return;/.test(jogo) && /querVibrar && podeEspecial\('vibrar'\)/.test(jogo), 'golpe especial e vibrar trancados até o episódio que ensina');
ok(/POS_VESTE >= 0 &&/.test(jogo) && /POS_TEMPO >= 0 &&/.test(jogo) && /POS_TEMPESTADE >= 0 &&/.test(jogo), 'sem o traje novo, o tempo lento e a tempestade na temporada');
ok(/function cenaNoLab\(on\)/.test(jogo) && /J\.heroiFora/.test(jogo) && /heroi\.visible = !J\.heroiFora/.test(jogo), 'as cenas sem o Barry: ele some e volta para onde estava');
ok(/m\.crimeNome/.test(jogo) && /crimeTexto/.test(jogo), 'o crime leva o nome do meta do episódio');
ok(/if \(PESSOAL\) LUGARES\.wells = \{/.test(ler('js/equipe.js')) && fs.existsSync(path.join(RAIZ, 'assets/personagens/wells/corpo.bin')) && fs.existsSync(path.join(RAIZ, 'assets/personagens/retratos/wells.webp')), 'o Wells no Cortex (corpo e retrato próprios)');

if (process.argv.includes('--navegador')) {
  const { servidor, abrir } = await import(pathToFileURL(path.join(AQUI, '../../golaco/tools/lib/navegador.mjs')).href);
  const srv = await servidor(0, RAIZ);
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  pagina.setDefaultTimeout(1200000);
  await pagina.addInitScript((h) => { localStorage.setItem('theflash.edicao.v1', h); localStorage.setItem('theflash.missoes.v2', '{"id":"cafe","ultimo":"x","stats":{}}'); }, HASH);
  await pagina.goto(srv.url + '?historia=1');
  await pagina.waitForSelector('#btnJogar:not([hidden])');
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  const quadros = (n) => pagina.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  await pagina.waitForFunction(() => window.__rel.historia.cenaAtual === 'noite-do-raio', null, { polling: 300 });
  ok(await pagina.evaluate(() => window.__rel.historia.cartaoAtual === 'Nove meses atrás — A noite do acelerador'), 'a abertura: "Nove meses atrás — A noite do acelerador"');
  await pagina.evaluate(() => window.__rel.historia.pular());
  await pagina.waitForFunction(() => window.__rel.historia.cenaAtual === 'prologo', null, { polling: 300 });
  for (let i = 0; i < 40 && await pagina.evaluate(() => !!window.__rel.historia.cartaoAtual); i++) { await pagina.waitForTimeout(800); await pagina.evaluate(() => window.__rel.historia.avancar()); }
  await pagina.waitForFunction(() => window.__rel.J.deitado === true, null, { polling: 300 });
  ok(true, 'o coma: o Barry deitado na maca do Cortex');
  await pagina.evaluate(() => window.__rel.historia.pular());
  await pagina.waitForFunction(() => window.__rel.J.modo === 'jogando' && window.__rel.J.deitado === false, null, { polling: 300 });
  ok(await pagina.evaluate(() => window.__rel.missoes.atual?.id === 's1e1-jitters' && window.__rel.J.roupa === 'civil'), 'acordou: o 1º passo do episódio 1 (o Jitters), à paisana');
  await pagina.waitForFunction(() => window.__rel.equipe.pronta, null, { polling: 500 });
  ok(await pagina.evaluate(() => typeof window.__rel.equipe.focos().wells === 'function'), 'o Wells está no Cortex');
  await quadros(4);
  ok(await pagina.evaluate(() => ['raio', 'ciclone', 'sonico'].every((t) => document.getElementById(`bt-${t}`).classList.contains('bloq')) && document.getElementById('btVibrar').classList.contains('bloq')), 'no começo, nenhum golpe especial e nem vibrar (ainda não aprendeu)');
  await pagina.evaluate(() => window.__rel.missoes.irPara('s1e6-girder')); await quadros(4);
  ok(await pagina.evaluate(() => !document.getElementById('bt-ciclone').classList.contains('bloq') && !document.getElementById('bt-sonico').classList.contains('bloq') && document.getElementById('bt-raio').classList.contains('bloq') && document.getElementById('btVibrar').classList.contains('bloq')), 'no episódio 6: o ciclone (ep. 1) e o soco supersônico liberados; o raio e o vibrar ainda não');
  await pagina.evaluate(() => window.__rel.missoes.irPara('s1e17-vibrar')); await quadros(4);
  ok(await pagina.evaluate(() => !document.getElementById('btVibrar').classList.contains('bloq') && document.getElementById('bt-raio').classList.contains('bloq')), 'no episódio 17: vibrar liberado; o raio ainda não');
  ok(await pagina.evaluate(() => JSON.parse(localStorage.getItem('theflash.serie.missoes.v2') || '{}').id === 's1e17-vibrar' && JSON.parse(localStorage.getItem('theflash.missoes.v2')).id === 'cafe'), 'o progresso da temporada fica em theflash.serie.* e o da história normal não muda');
  // a sala escondida (episódio 19): o jornal de 2024 na tela
  const ate = (id) => pagina.evaluate((id) => { const R = window.__rel, s = R.LAB_B.plano.pontosDeInteresse.find((q) => q.nome === id); Object.assign(R.P, { x: s.x, y: s.y, z: s.z, vx: 0, vz: 0 }); }, id);
  await pagina.evaluate(() => window.__rel.missoes.irPara('s1e19-sala')); await ate('alaLeste');
  await pagina.waitForFunction(() => window.__rel.historia.cenaAtual === 'depois-s1e19-sala', null, { polling: 300 });
  for (let i = 0; i < 60 && await pagina.evaluate(() => document.getElementById('jornal').hidden); i++) { await pagina.waitForTimeout(500); await pagina.evaluate(() => { const h = window.__rel.historia; h.avancar(); h.avancar(); }); }
  ok(await pagina.evaluate(() => !document.getElementById('jornal').hidden && /2024/.test(document.getElementById('jnData').textContent)), 'episódio 19: na sala escondida, o jornal de 2024 aparece na tela');
  await pagina.evaluate(() => window.__rel.historia.pular());
  await pagina.waitForFunction(() => window.__rel.J.modo === 'jogando', null, { polling: 300 });
  await quadros(3);
  ok(await pagina.evaluate(() => document.getElementById('jornal').hidden), 'e some quando a cena acaba');
  // a cena sem o Barry (episódio 15): o herói sai de cena, o Wells se levanta para o Cisco e vira o homem de amarelo; no fim, o herói volta
  // (um lugar aberto: a praça da Prefeitura; espera uns quadros para o herói assentar antes de anotar onde ele está)
  await pagina.evaluate(() => { const R = window.__rel, w = R.pontoMundo('prefeitura'); Object.assign(R.P, { x: w.x, z: w.z, vx: 0, vz: 0 }); });
  await quadros(6);
  const antes = await pagina.evaluate(() => ({ x: window.__rel.P.x, z: window.__rel.P.z }));
  await pagina.evaluate(() => window.__rel.missoes.irPara('s1e15-iris'));
  await pagina.waitForFunction(() => window.__rel.historia.cenaAtual === 'pov-cisco', null, { polling: 300 });
  ok(await pagina.evaluate(() => window.__rel.J.heroiFora === true && !window.__rel.heroi.visible), 'episódio 15, a cena do Cisco: o Barry fora de cena');
  for (let i = 0; i < 80 && await pagina.evaluate(() => !window.__rel.J.wellsVirou); i++) { await pagina.waitForTimeout(500); await pagina.evaluate(() => { const h = window.__rel.historia; h.avancar(); h.avancar(); }); }
  await pagina.waitForFunction(() => !!window.__rel.aliados.foco('reverso'), null, { polling: 300 });
  ok(await pagina.evaluate(() => { const R = window.__rel, f = R.aliados.foco('reverso'), w = R.equipe.focos().wells(); return R.J.wellsVirou && Math.hypot(f.x - w.x, f.z - w.z) < 1.5; }), 'o Wells vira o homem de amarelo no lugar dele, diante do Cisco');
  await pagina.evaluate(() => window.__rel.historia.pular());
  await pagina.waitForFunction(() => window.__rel.J.modo === 'jogando', null, { polling: 300 });
  const depois = await pagina.evaluate(() => ({ x: window.__rel.P.x, z: window.__rel.P.z, fora: window.__rel.J.heroiFora, vis: window.__rel.heroi.visible, virou: window.__rel.J.wellsVirou }));
  ok(!depois.fora && depois.vis && Math.hypot(depois.x - antes.x, depois.z - antes.z) < 1 && !depois.virou, `no fim, o Barry volta exatamente para onde estava (${Math.hypot(depois.x - antes.x, depois.z - antes.z).toFixed(2)} m)`);
  // a viagem jogável do episódio 23: na noite do passado, perto demais da casa o Flash do futuro te empurra; parado, a espera conta
  await pagina.evaluate(() => window.__rel.missoes.irPara('s1e23-espera'));
  await pagina.waitForFunction(() => window.__rel.tempo.epoca === 'noite', null, { polling: 300 });
  ok(await pagina.evaluate(() => document.body.classList.contains('passado')), 'episódio 23: a noite do passado (as cores de outra época)');
  await pagina.evaluate(() => { const R = window.__rel, w = R.pontoMundo('casa'); Object.assign(R.P, { x: w.x + 1, z: w.z + 1, vx: 0, vz: 0 }); });
  await quadros(3);
  ok(await pagina.evaluate(() => { const R = window.__rel, w = R.pontoMundo('casa'); return Math.hypot(R.P.x - w.x, R.P.z - w.z) >= 4.9; }), 'chegou perto demais da porta: o Flash do futuro te empurra para fora');
  await pagina.evaluate(() => { const R = window.__rel, w = R.pontoMundo('casa'); Object.assign(R.P, { x: w.x + 9, z: w.z + 6, vx: 0, vz: 0 }); });
  await pagina.waitForFunction(() => window.__rel.historia.cenaAtual === 'depois-s1e23-espera', null, { polling: 300 });
  ok(true, 'parado do lado de fora, a espera termina e vem a despedida da Nora');
  await pagina.evaluate(() => window.__rel.historia.pular());
  await pagina.waitForFunction(() => window.__rel.J.modo === 'jogando' && window.__rel.missoes.atual?.id === 's1e23-volta', null, { polling: 300 });
  await pagina.evaluate(() => { window.__rel.J.tunelT = 3; });
  await quadros(2);
  ok(await pagina.evaluate(() => window.__rel.tempo.tunel === true), 'na volta, o túnel do tempo abre em volta de você enquanto você corre');
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
