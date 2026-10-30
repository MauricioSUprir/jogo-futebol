// Teste da VIDA DO BARRY ALLEN (dono, 26/10): os passos à paisana na ordem da história (a volta ao trabalho, a perícia, a
// ligação do vulto, a troca de roupa escondido, o café da Delegacia, a entrevista, as ameaças à família), as pistas em chão
// livre, os cronômetros, as cenas e falas de cada passo, e a noite do raio (o começo). Com --navegador [pasta]: no jogo, a
// noite do raio toca na perícia da Delegacia à noite com o Barry à paisana, o Joe vai embora, o vulto aparece e o raio o
// leva ao prólogo de traje; a roupa segue o passo; as 3 pistas contam; o cronômetro recomeça (ou volta um passo); a troca
// atrás da Delegacia veste o traje; o gelo cresce em volta da Iris.
// Uso: node velocista/tools/teste-barry.mjs [--navegador [pasta-de-prints]]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = (f) => import(pathToFileURL(path.join(AQUI, '../js', f)).href);
const mis = await imp('missoes.js'), M = await imp('marcos.js'), cid = await imp('cidade.js'), I = await imp('interiores.js');
globalThis.document ??= undefined;
const H = await imp('historia.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

// ---- 1. a ordem da história
const ids = mis.MISSOES.map((m) => m.id), pos = (id) => ids.indexOf(id), passo = (id) => mis.MISSOES[pos(id)];
const ordem = ['vibrar', 'delegacia', 'atrasado', 'pericia', 'analise', 'troca', 'assalto'];
ok(ordem.every((id, k) => pos(id) >= 0 && (!k || pos(ordem[k - 1]) === pos(id) - 1)), `Ato 1: ${ordem.join(' → ')}`);
ok(pos('cafe-pedido') + 1 === pos('cafe-entrega') && pos('gangue') < pos('cafe-pedido') && pos('cafe-entrega') < pos('cap-zoom'), 'o café da Delegacia entre a gangue e o Zoom');
ok(pos('jornal') + 1 === pos('entrevista') && pos('entrevista') < pos('cap-zoom'), 'a entrevista com a Iris depois da foto do Picture News');
ok(pos('ameaca-iris') + 1 === pos('cap-frio') && pos('ameaca-joe') + 1 === pos('cap-mago') && pos('visita') + 1 === pos('cap-reverso'), 'cada ameaça à família logo antes do capítulo do vilão');
const civis = mis.MISSOES.filter((m) => m.roupa === 'civil');
ok(civis.length >= 10 && civis.every((m) => (m.ponto || m.alvo || m.alvoSala) && !m.capitulo && !m.crime), `${civis.length} passos à paisana, todos num lugar (nenhum de luta)`);
ok(['delegacia', 'atrasado', 'pericia', 'analise', 'troca', 'cafe-pedido', 'cafe-entrega', 'entrevista', 'cafe', 'relatorio', 'visita', 'casa'].every((id) => passo(id)?.roupa === 'civil'), 'a vida dele (trabalho, café, casa) à paisana');
ok(['assalto', 'gangue', 'jornal', 'ameaca-iris', 'ameaca-joe'].every((id) => !passo(id).roupa), 'o herói (patrulha, foto, resgates) de traje');
const comTempo = mis.MISSOES.slice(0, pos('p2-exames')).filter((m) => m.tempo);     // (os da Parte 2: teste-parte2.mjs)
ok(comTempo.length === 4 && comTempo.every((m) => m.ponto && m.tempo >= 30 && m.tempo <= 90 && (!m.falha || pos(m.falha) === pos(m.id) - 1)), `${comTempo.length} passos com cronômetro (${comTempo.map((m) => `${m.id} ${m.tempo} s`).join(', ')})`);

// ---- 2. lugares: o beco, as pistas e os pontos de dentro
const beco = M.pontoMundo('beco'), Rb = cid.retangulosPerto(beco.x, beco.z, 1);
ok(!cid.empurrar(Rb, beco.x, beco.z, 0.45, cid.CALCADA, 1.8).bateu && cid.chaoEm(Rb, beco.x, beco.z, 1) === cid.CALCADA, `o beco do lado da Delegacia, na calçada (${beco.x}, ${beco.z})`);
const pe = passo('pericia'), pf = M.pontoMundo(pe.ponto);
for (const [u, v, nome, det] of pe.pistas) {
  const x = pf.x + u, z = pf.z + v, R = cid.retangulosPerto(x, z, 1);
  ok(!cid.empurrar(R, x, z, 0.45, 0.3, 1.8).bateu && cid.chaoEm(R, x, z, 1) <= cid.CALCADA + 0.01 && Math.hypot(u, v) < 40 && nome && det, `pista "${nome}" em chão livre a ${Math.hypot(u, v).toFixed(0)} m da praça`);
}
for (const m of mis.MISSOES.filter((k) => k.ponto && M.pontoMundo(k.ponto)?.interior)) {   // (os pontos do laboratório da Parte 3 só existem com o jogo: registrarPontosLab)
  const w = M.pontoMundo(m.ponto);
  ok(w.y === I.Y0 && Object.values(m.aliados || {}).every((p) => M.pontoMundo(p).interior === w.interior), `"${m.id}" dentro de ${I.INTERIORES[w.interior].nome}, com quem espera lá dentro também`);
}

// ---- 3. cenas e falas
const temCena = ['delegacia', 'atrasado', 'pericia', 'analise', 'cafe-entrega', 'entrevista', 'ameaca-iris', 'ameaca-joe', 'visita'];
ok(temCena.every((id) => H.CENAS[`depois-${id}`]?.length >= 5), 'cada passo da vida dele termina numa cena');
ok(['atrasado', 'pericia', 'analise', 'troca', 'cafe-pedido', 'entrevista', 'ameaca-iris', 'ameaca-joe', 'visita'].every((id) => H.MISSOES_FALAS[id]?.abre?.length), 'cada passo novo abre com uma fala de rádio');
ok(comTempo.every((m) => H.RADIO[`falhou-${m.id}`]?.length), 'cada cronômetro tem a fala de quando o tempo acaba');
const noite = H.CENAS['noite-do-raio'], acoes = noite.filter((f) => f.acao).map((f) => f.acao);
ok(noite[0].cartao && noite.at(-1).cartao && ['joeSai', 'vulto', 'tempestade', 'raio'].every((a) => acoes.includes(a)), `a noite do raio: cartão, o Joe sai, o vulto, as faíscas e o raio (${acoes.join(', ')})`);
ok(noite.some((f) => f.quem === 'vulto') && H.CENAS['depois-analise'].some((f) => f.quem === 'vulto') && H.CENAS['depois-visita'].some((f) => f.quem === 'reverso'), 'o vulto na noite do raio e no telefone; o homem de amarelo na cozinha');
ok(H.CENAS.prologo[0].cartao && /depois/i.test(H.CENAS.prologo[0].rotulo), `o prólogo vem depois (${H.CENAS.prologo[0].rotulo})`);
const todas = [...Object.values(H.CENAS), ...Object.values(H.RADIO), ...Object.values(H.MISSOES_FALAS).flatMap((x) => [x.abre || [], x.fecha || []])].flat();
ok(todas.every((f) => f.cartao || (H.PERSONAGENS[f.quem] && f.texto.length < 160)), `${todas.length} falas, todas com personagem e curtas`);

if (process.argv.includes('--navegador')) {
  const saida = process.argv[process.argv.indexOf('--navegador') + 1], prints = saida && !saida.startsWith('--') ? saida : null;
  if (prints) fs.mkdirSync(prints, { recursive: true });
  const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
  const srv = await servidor(0, path.join(AQUI, '..'));
  const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
  const espera = (fn, arg, t = 600000) => pagina.waitForFunction(fn, arg, { timeout: t, polling: 500 }).then(() => true).catch(() => false);
  const foto = async (n) => { if (prints) await pagina.screenshot({ path: path.join(prints, `${n}.png`), timeout: 600000 }).catch((e) => console.log('print falhou', n, e.message)); };
  const quadros = (n = 2) => pagina.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const abrirJogo = async (q, vistas = []) => {
    await pagina.goto(srv.url + q, { timeout: 1200000 });
    await pagina.evaluate((vistas) => { localStorage.clear(); localStorage.setItem('theflash.historia.v1', JSON.stringify({ vistas })); }, vistas);
    await pagina.goto(srv.url + q, { timeout: 1200000 });
    await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
    await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
    await pagina.evaluate(() => { const R = window.__rel; R.mundo.T = Math.max(R.mundo.T, 0); R.crimes.adiantar?.(-1e9); });
  };
  const ir = (x, z, y = 0.3) => pagina.evaluate(([x, z, y]) => { const R = window.__rel; Object.assign(R.P, { x, z, y, vx: 0, vz: 0, vy: 0, noChao: true }); }, [x, z, y]);

  // a noite do raio: na perícia da Delegacia, às onze da noite, o Barry à paisana com o Joe
  await abrirJogo('?historia=1');
  ok(await espera(() => window.__rel.historia.cenaAtual === 'noite-do-raio'), 'um jogo novo começa na noite do raio');
  const n0 = await pagina.evaluate(() => { const R = window.__rel; return { interior: R.J.interior, roupa: R.J.roupa, y: R.P.y, hora: R.mundo.T }; });
  ok(n0.interior === 'delegacia' && n0.roupa === 'civil' && Math.abs(n0.y - 1500) < 1 && n0.hora > 0.9, `na perícia da Delegacia, à paisana, às ${Math.floor(n0.hora * 24)}h`);
  ok(await espera(() => window.__rel.aliados.pessoas.joe?.raiz.visible && window.__rel.modelo?.grupo.visible), 'o Joe está na porta da perícia');
  await quadros(3); await foto('noite-joe');
  // avança fala por fala até o vulto aparecer (cada toque completa o texto e o seguinte passa)
  const avancarAte = (alvo) => pagina.evaluate(async (alvo) => {
    const R = window.__rel;
    for (let k = 0; k < 80 && R.historia.cenaAtual === 'noite-do-raio'; k++) {
      R.historia.avancar(); await new Promise((r) => requestAnimationFrame(() => r()));
      if (R.J.cenaAliados?.aliados && alvo in R.J.cenaAliados.aliados) return true;
    }
    return false;
  }, alvo);
  ok(await avancarAte('vulto'), 'o vulto entra em cena');
  ok(await espera(() => window.__rel.aliados.pessoas.vulto?.raiz.visible && !window.__rel.aliados.pessoas.joe?.raiz.visible), 'o Joe foi embora e o vulto está no canto da perícia');
  await quadros(3); await foto('noite-vulto');
  await pagina.evaluate(() => window.__rel.historia.pular());
  ok(await espera(() => window.__rel.historia.cenaAtual === 'prologo'), 'depois do raio, o prólogo');
  const n1 = await pagina.evaluate(() => { const R = window.__rel; return { interior: R.J.interior, roupa: R.J.roupa, y: R.P.y, sala: R.LAB_B.plano.dentro(R.P.x, R.P.z, R.P.y) }; });
  ok(!n1.interior && n1.roupa === 'traje' && n1.sala === 'cortex', `seis semanas depois, de traje no Cortex (${n1.sala})`);
  await pagina.evaluate(() => window.__rel.historia.pular());
  ok(await espera(() => window.__rel.J.modo === 'jogando' && window.__rel.missoes.atual?.id === 'lab'), 'e a história segue no primeiro passo');

  // a roupa segue o passo: na Delegacia, à paisana; o cronômetro do "Atrasado de novo" recomeça quando acaba
  await abrirJogo('?missao=delegacia', ['cena:prologo', 'cena:noite-do-raio']);
  ok(await espera(() => window.__rel.missoes.atual?.id === 'delegacia' && window.__rel.J.roupa === 'civil'), 'no passo da Delegacia, o Barry à paisana');
  ok(await espera(() => window.__rel.modelo?.grupo.visible && window.__rel.modelo.materiais?.length !== undefined || window.__rel.modelo?.grupo.visible), 'o corpo à paisana aparece');
  await pagina.evaluate(() => window.__rel.historia.calarRadio());     // (sem GPU cada fala de rádio dura minutos; a cena espera ele calar)
  const dg = M.pontoMundo('delegacia'); await ir(dg.x, dg.z - 4); await quadros(4); await foto('barry-delegacia');
  ok(await espera(() => window.__rel.missoes.atual?.id === 'atrasado'), 'chegar à Delegacia: "Atrasado de novo"');
  await pagina.evaluate(() => window.__rel.historia.calarRadio());
  ok(await espera(() => window.__rel.J.cron?.id === 'atrasado' && /\d+ s$/.test(document.getElementById('missaoTexto').textContent)), 'o cronômetro aparece no painel');
  await pagina.evaluate(() => { window.__rel.J.cron.resto = 0.05; });
  ok(await espera(() => window.__rel.J.cron?.resto > 40 && window.__rel.missoes.atual?.id === 'atrasado'), 'o tempo acabou: a contagem recomeça');

  // a perícia: o guia leva a cada pista; parar em cima conta
  await abrirJogo('?missao=pericia', ['cena:prologo', 'cena:noite-do-raio']);
  ok(await espera(() => window.__rel.missoes.atual?.id === 'pericia'), 'passo "Cena do crime"');
  for (let k = 0; k < 3; k++) {
    const a = await pagina.evaluate(() => window.__rel.alvoMissao());
    ok(a?.rotulo === `Pista ${k + 1}/3`, `o guia mostra a pista ${k + 1} (${a?.rotulo})`);
    await ir(a.x - 6, a.z - 6); await quadros(3);
    if (k === 0) { ok(await pagina.evaluate(() => window.__rel.vida.estado.pista), 'o marcador amarelo da pista está no chão'); await foto('pista'); }
    await ir(a.x + 0.5, a.z + 0.5);
    ok(await espera((k) => (window.__rel.missoes.progresso()?.n ?? 3) > k || window.__rel.missoes.atual?.id !== 'pericia', k, 300000), `pista ${k + 1} examinada`);
  }
  ok(await espera(() => window.__rel.missoes.atual?.id === 'analise'), 'as três pistas: "No laboratório"');

  // a troca de roupa escondido: o beco do lado da Delegacia veste o traje
  await abrirJogo('?missao=troca', ['cena:prologo', 'cena:noite-do-raio']);
  ok(await espera(() => window.__rel.missoes.atual?.id === 'troca' && window.__rel.J.roupa === 'civil'), 'passo "Troca relâmpago", à paisana');
  await ir(beco.x, beco.z);
  ok(await espera(() => window.__rel.missoes.atual?.id === 'assalto' && window.__rel.J.roupa === 'traje'), 'no beco, a troca: de traje para a patrulha');

  // o café: o tempo acaba e a história volta ao balcão do Jitters
  await abrirJogo('?missao=cafe-entrega', ['cena:prologo', 'cena:noite-do-raio']);
  ok(await espera(() => window.__rel.J.cron?.id === 'cafe-entrega'), 'passo "Ainda quente" com o cronômetro');
  await pagina.evaluate(() => { window.__rel.J.cron.resto = 0.05; });
  ok(await espera(() => window.__rel.missoes.atual?.id === 'cafe-pedido'), 'café frio: volta ao balcão do Jitters');

  // a ameaça à Iris: o gelo cresce com o relógio
  await abrirJogo('?missao=ameaca-iris', ['cena:prologo', 'cena:noite-do-raio']);
  ok(await espera(() => window.__rel.J.cron?.id === 'ameaca-iris' && window.__rel.vida.estado.gelo), 'o gelo do Frio em volta da Iris');
  const g0 = await pagina.evaluate(() => window.__rel.vida.estado.alturaGelo);
  await pagina.evaluate(() => { window.__rel.J.cron.resto = 8; });
  ok(await espera((g0) => window.__rel.vida.estado.alturaGelo > g0 * 2.5, g0), `e sobe com o relógio (${g0.toFixed(2)} m → mais de ${(g0 * 2.5).toFixed(2)} m)`);
  ok(await espera(() => document.getElementById('missao').classList.contains('urgente')), 'nos últimos 10 s o painel fica vermelho');
  const ce = I.INTERIORES.cafe.fora.gatilho, mc = M.MARCOS.find((m) => m.id === 'cafe'), cx = cid.centroDe(mc.cel[0]), cz = cid.centroDe(mc.cel[1]);
  await ir(cx + (ce[0] + ce[1]) / 2, cz + (ce[2] + ce[3]) / 2);
  if (await espera(() => window.__rel.J.interior === 'cafe' && !window.__rel.J.porta, null, 300000)) { await pagina.evaluate(() => { const R = window.__rel, w = R.alvoMissao(); R.C.yaw = Math.atan2(w.x - R.P.x, w.z - R.P.z); }); await quadros(4); await foto('iris-gelo'); }

  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
