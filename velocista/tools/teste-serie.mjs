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
ok(S.missoes.every((m) => m.id.startsWith('s1-')) && S.missoes.length >= 20, `com a senha: só os passos da temporada (${S.missoes.length})`);
ok(S.cenas['noite-do-raio'][0].titulo === 'A noite do acelerador' && /Harrison Wells/.test(JSON.stringify(S.cenas['noite-do-raio'])), 'a abertura é a noite do acelerador, com o Dr. Harrison Wells na TV');

// ---- 2. cada passo tem o que precisa ----
const marcos = ler('js/marcos.js'), viloes = ler('js/viloes.js'), serie = ler('js/serie.js');
const pontos = new Set([...(marcos + ler('js/interiores.js')).matchAll(/([a-zA-Z0-9]+): [[{]/g)].map((m) => m[1]));
const capsSerie = [...serie.matchAll(/\{ id: '([a-z0-9]+)', titulo: 'Capítulo/g)].map((m) => m[1]);
const capsNormal = new Set([...viloes.matchAll(/\{ id: '([a-z0-9]+)', titulo: '/g)].map((m) => m[1]));
ok(capsSerie.every((c) => capsNormal.has(c)), `os capítulos da temporada existem em viloes.js (${capsSerie.join(', ')})`);
const semPonto = S.missoes.filter((m) => m.ponto && !pontos.has(m.ponto)).map((m) => `${m.id}:${m.ponto}`);
ok(!semPonto.length, `todo lugar dos passos existe no mapa (${semPonto.join(', ')})`);
ok(S.missoes.filter((m) => m.capitulo).every((m) => capsSerie.includes(m.capitulo)), 'todo capítulo dos passos está na lista da temporada');
ok(new Set(S.missoes.map((m) => m.id)).size === S.missoes.length, 'nenhum passo repetido');
const STATS = /const STATS0 = \{([^}]*)\}/.exec(ler('js/missoes.js'))[1];
ok(S.missoes.filter((m) => m.contador).every((m) => new RegExp(`\\b${m.contador}:`).test(STATS)), 'todo contador dos passos existe');
const ACOES = new Set(['joeSai', 'tempestade', 'raio', 'deita', 'acorda', 'raioCasa']);
const quem = new Set(Object.keys(S.pers)), faltam = new Set(), acoesRuins = new Set();
for (const [id, falas] of Object.entries(S.cenas)) for (const f of falas) { if (!f.cartao && !quem.has(f.quem)) faltam.add(`${id}:${f.quem}`); if (f.acao && serie.includes(`'${id}'`) && !ACOES.has(f.acao)) acoesRuins.add(`${id}:${f.acao}`); }
for (const fs2 of [...Object.values(S.radio), ...Object.values(S.falas).flatMap((o) => Object.values(o))]) for (const f of fs2) if (!quem.has(f.quem)) faltam.add(f.quem);
ok(!faltam.size, `toda fala é de alguém que existe (${[...faltam].slice(0, 5).join(', ')})`);
ok(!acoesRuins.size, `as cenas da temporada só usam ações que o jogo conhece (${[...acoesRuins].join(', ')})`);
const ids = new Set(S.missoes.map((m) => m.id));
const orfas = Object.keys(S.cenas).filter((k) => k.startsWith('depois-s1-') && !ids.has(k.slice(7)));
ok(!orfas.length, `toda cena "depois-" da temporada tem o passo dela (${orfas.join(', ')})`);
ok(S.cenas['prologo'].some((f) => f.acao === 'deita' && !f.cartao) && S.cenas['prologo'].some((f) => f.acao === 'acorda'), 'as ações do coma ficam em falas (cartão não dispara ação)');

// ---- 3. o que o dono pediu ----
const txt = (c) => JSON.stringify(S.cenas[c] || []);
ok(['Semana 1', 'Mês 3', 'Mês 6', 'Mês 9'].every((m) => txt('prologo').includes(m)) && /Nove meses/.test(txt('prologo')), 'os nove meses de coma, mês a mês, no prólogo');
ok(/"quem":"wells"/.test(txt('prologo')) && /"quem":"wells"/.test(txt('depois-s1-volta')) && S.pers.wells.nome === 'Dr. Harrison Wells', 'o Dr. Harrison Wells cuidando do coma e explicando os poderes');
const lib = S.missoes.map((m, i) => [m.libera, i]).filter(([l]) => l).flatMap(([l, i]) => l.map((t) => [t, i]));
const pos = Object.fromEntries(lib);
ok(pos.ciclone < pos.raio && pos.raio < pos.sonico && Object.keys(pos).length === 3, `o Barry aprende os golpes num treino cada: ciclone (passo ${pos.ciclone}), raio (${pos.raio}), sônico (${pos.sonico})`);
ok(S.missoes.some((m) => m.id === 's1-parede') && S.missoes.some((m) => m.id === 's1-vibrar') && S.missoes.some((m) => m.id === 's1-teste'), 'os treinos do Wells: velocidade, escalar e vibrar');
ok(/Iron Heights/.test(txt('depois-s1-presidio')) && /"quem":"pai"/.test(txt('depois-s1-presidio')), 'a visita ao pai em Iron Heights');
ok(/Quinze anos atrás/.test(txt('depois-s1-casa')) && /"quem":"nora"/.test(txt('depois-s1-casa')) && /amarelo/.test(txt('depois-s1-casa')), 'a noite em que a mãe morreu, com o homem de amarelo dentro do raio');
ok(S.missoes.some((m) => m.capitulo === 'reverso') && /O homem de amarelo/.test(S.pers.reverso.nome), 'o homem de amarelo (ainda sem rosto nesta parte)');
ok(/Continua\.\.\./.test(txt('depois-s1-casa')), 'a parte 1 termina com o "Continua..."');

// ---- 4. no jogo ----
const jogo = ler('js/jogo.js');
ok(/CHAVES_HISTORIA = new Set\(\['theflash\.missoes\.v2'/.test(jogo) && /c\.replace\('theflash\.', 'theflash\.serie\.'\)/.test(jogo), 'o progresso da temporada em chaves próprias (theflash.serie.*)');
ok(/const podeEspecial = \(t\) =>/.test(jogo) && /!podeEspecial\(t\)\) return;/.test(jogo), 'golpe especial trancado até o treino que ensina');
ok(/POS_VESTE >= 0 &&/.test(jogo) && /POS_TEMPO >= 0 &&/.test(jogo) && /POS_TEMPESTADE >= 0 &&/.test(jogo), 'sem o traje novo, o tempo lento e a tempestade na temporada (os passos deles não existem nela)');
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
  await pagina.waitForFunction(() => window.__rel.historia.cenaAtual === 'noite-do-raio', null, { polling: 300 });
  ok(await pagina.evaluate(() => window.__rel.historia.cartaoAtual === 'Nove meses atrás — A noite do acelerador'), 'a abertura: "Nove meses atrás — A noite do acelerador"');
  await pagina.evaluate(() => window.__rel.historia.pular());
  await pagina.waitForFunction(() => window.__rel.historia.cenaAtual === 'prologo', null, { polling: 300 });
  for (let i = 0; i < 40 && await pagina.evaluate(() => !!window.__rel.historia.cartaoAtual); i++) { await pagina.waitForTimeout(800); await pagina.evaluate(() => window.__rel.historia.avancar()); }
  await pagina.waitForFunction(() => window.__rel.J.deitado === true, null, { polling: 300 });
  ok(true, 'o coma: o Barry deitado na maca do Cortex');
  await pagina.evaluate(() => window.__rel.historia.pular());
  await pagina.waitForFunction(() => window.__rel.J.modo === 'jogando' && window.__rel.J.deitado === false, null, { polling: 300 });
  ok(await pagina.evaluate(() => window.__rel.missoes.atual?.id === 's1-jitters' && window.__rel.J.roupa === 'civil'), 'acordou: o 1º passo (o Jitters), à paisana');
  await pagina.waitForFunction(() => window.__rel.equipe.pronta, null, { polling: 500 });
  ok(await pagina.evaluate(() => typeof window.__rel.equipe.focos().wells === 'function'), 'o Wells está no Cortex');
  const quadros = (n) => pagina.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  await quadros(4);                                      // (os botões se atualizam no quadro do jogo)
  ok(await pagina.evaluate(() => ['raio', 'ciclone', 'sonico'].every((t) => document.getElementById(`bt-${t}`).classList.contains('bloq'))), 'no começo, nenhum golpe especial (ainda não aprendeu)');
  await pagina.evaluate(() => window.__rel.missoes.irPara('s1-raio'));
  await quadros(4);
  ok(await pagina.evaluate(() => !document.getElementById('bt-ciclone').classList.contains('bloq') && document.getElementById('bt-sonico').classList.contains('bloq')), 'no treino do raio: o raio e o ciclone (aprendido antes) liberados, o sônico ainda não');
  ok(await pagina.evaluate(() => JSON.parse(localStorage.getItem('theflash.serie.missoes.v2') || '{}').id === 's1-raio' && JSON.parse(localStorage.getItem('theflash.missoes.v2')).id === 'cafe'), 'o progresso da temporada fica em theflash.serie.* e o da história normal não muda');
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
