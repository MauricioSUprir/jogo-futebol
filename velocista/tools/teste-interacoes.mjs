// Teste dos PONTOS DE INTERAÇÃO (js/interacoes.js): os itens dos parques (bancos e bancas) longe das árvores, da calçada e
// uns dos outros, com sólido; os cinco desafios de corrida (cruzamentos de verdade, fora do campus, medalhas em ordem);
// o botão AÇÃO só perto, parado e livre; sentar e levantar; a banca com a manchete da parte da história; a foto com o fã;
// a corrida inteira (contagem, largada, pontos pelo caminho do quadro — a 800 km/h —, chegada, medalha e recorde) e a
// corrida interrompida. Com --navegador: no jogo, perto de um banco aparece o botão, E senta (a energia enche) e andar
// levanta; na largada de um desafio, X começa a contagem e o guia aponta o 1º ponto.
// Uso: node velocista/tools/teste-interacoes.mjs [--navegador [pasta-de-prints]]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = (f) => import(pathToFileURL(path.join(AQUI, '../js', f)).href);
const cid = await imp('cidade.js'), X = await imp('interacoes.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

// ---- 1. os itens dos parques
let parques = 0, bancos = 0, bancas = 0, ruins = [];
for (let i = 0; i < cid.N; i++) for (let j = 0; j < cid.N; j++) {
  const b = cid.bloco(i, j); if (b.tipo !== 'parque') { if (b.itens.length) ruins.push(`${i},${j} não é parque e tem itens`); continue; }
  parques++;
  for (const q of b.itens) {
    if (q.tipo === 'banco') bancos++; else if (q.tipo === 'banca') bancas++;
    const borda = Math.max(Math.abs(q.x - b.cx), Math.abs(q.z - b.cz));
    if (borda > cid.BLOCO / 2 - 2.2) ruins.push(`${i},${j} ${q.tipo} na calçada (${borda.toFixed(1)} m do centro)`);
    if (b.arvores.some((a) => Math.hypot(a.x - q.x, a.z - q.z) < 1.2)) ruins.push(`${i},${j} ${q.tipo} em cima de uma árvore`);
    if (!b.rects.some((r) => r.item === q.tipo && q.x > r.x0 && q.x < r.x1 && q.z > r.z0 && q.z < r.z1)) ruins.push(`${i},${j} ${q.tipo} sem sólido`);
  }
  for (let a = 0; a < b.itens.length; a++) for (let c = a + 1; c < b.itens.length; c++) if (Math.hypot(b.itens[a].x - b.itens[c].x, b.itens[a].z - b.itens[c].z) < 2.5) ruins.push(`${i},${j} dois itens encostados`);
}
ok(parques > 100 && bancos > parques * 2 && bancas > parques * 0.4, `itens nos parques: ${parques} parques, ${bancos} bancos, ${bancas} bancas`);
ok(!ruins.length, `nenhum item na calçada, em árvore, sem sólido ou encostado em outro (${ruins.slice(0, 3).join(' | ')})`);
{ const b = cid.bloco(5, 5), b2 = cid.bloco(5, 5); ok(JSON.stringify(b.itens) === JSON.stringify(b2.itens), 'os itens são sempre os mesmos (sorteio por quarteirão)'); }

// ---- 2. os desafios de corrida
const CS = X.corridas();
ok(CS.length === 5 && new Set(CS.map((c) => c.id)).size === 5, `cinco desafios (${CS.map((c) => c.nome).join(', ')})`);
const eixo = (v) => Math.abs(((v + cid.MEIO) / cid.CELL) - Math.round((v + cid.MEIO) / cid.CELL)) < 1e-6;
for (const c of CS) {
  const todos = [{ x: c.x, z: c.z }, ...c.pontos];
  ok(todos.every((p) => eixo(p.x) && eixo(p.z)), `${c.nome}: largada e pontos nos cruzamentos das ruas`);
  ok(todos.every((p) => Math.abs(p.x) < cid.MEIO - cid.CELL && Math.abs(p.z) < cid.MEIO - cid.CELL), `${c.nome}: dentro da cidade`);
  const naoCampus = todos.every((p) => { const i = Math.round((p.x + cid.MEIO) / cid.CELL), j = Math.round((p.z + cid.MEIO) / cid.CELL); return ![[0, 0], [1, 0], [0, 1], [1, 1]].some(([a, b]) => cid.ehCampus(i - a, j - b)); });
  ok(naoCampus, `${c.nome}: nenhum ponto no campus do S.T.A.R. Labs`);
  const ult = c.pontos[c.pontos.length - 1];
  ok(ult.x === c.x && ult.z === c.z && c.pontos.length === 8, `${c.nome}: 8 pontos, a chegada é a largada (${(c.metros / 1000).toFixed(1)} km)`);
  ok(c.ouro < c.prata && c.prata < c.bronze && c.ouro > 5, `${c.nome}: ouro ${c.ouro} s < prata ${c.prata} s < bronze ${c.bronze} s`);
}
ok(CS.every((c, k) => !k || c.metros > CS[k - 1].metros), 'os desafios crescem de tamanho');

// ---- 3. o botão AÇÃO, sentar, a banca e a foto
const parque = (() => { for (let i = 0; i < cid.N; i++) for (let j = 0; j < cid.N; j++) { const b = cid.bloco(i, j); if (b.tipo === 'parque' && b.itens.some((q) => q.tipo === 'banca') && b.itens.some((q) => q.tipo === 'banco')) return b; } })();
const banco = parque.itens.find((q) => q.tipo === 'banco'), banca = parque.itens.find((q) => q.tipo === 'banca');
const P = (x, z, v = 0) => ({ x, z, y: cid.CALCADA, vx: v, vz: 0, noChao: true, parede: null });
{
  const I = X.criarInteracoes();
  const frente = P(banco.x + Math.sin(banco.rot) * 1.2, banco.z + Math.cos(banco.rot) * 1.2);
  I.atualizar(0.016, frente, { itens: parque.itens, livre: true });
  ok(I.perto?.tipo === 'banco' && I.perto.rotulo === 'Sentar', 'na frente do banco, o botão AÇÃO oferece "Sentar"');
  I.atualizar(0.016, { ...frente, vx: 20 }, { itens: parque.itens, livre: true });
  ok(!I.perto, 'correndo, o botão não aparece');
  I.atualizar(0.016, frente, { itens: parque.itens, livre: false });
  ok(!I.perto, 'com missão, crime ou vilão em andamento, o botão não aparece');
  I.atualizar(0.016, frente, { itens: parque.itens, livre: true });
  ok(I.acao(frente)?.tipo === 'sentou' && I.sentado && Math.hypot(I.sentado.x - banco.x, I.sentado.z - banco.z) < 0.2, 'AÇÃO senta no banco');
  const lev = I.levantar(frente);
  ok(lev?.tipo === 'levantou' && !I.sentado && Math.hypot(frente.x - banco.x, frente.z - banco.z) > 0.8, 'levantar põe o Barry à frente do banco');
  const pb = P(banca.x + Math.sin(banca.rot) * 1.8, banca.z + Math.cos(banca.rot) * 1.8);
  I.atualizar(0.016, pb, { itens: parque.itens, livre: true });
  const e = I.acao(pb, 0);
  ok(I.perto?.tipo === 'banca' && e?.tipo === 'leu' && I.jornal?.titulo === X.MANCHETES[0][0], `na banca, AÇÃO abre o jornal ("${I.jornal?.titulo}")`);
  ok(X.manchete(1)[0] === X.MANCHETES[X.MANCHETES.length - 1][0] && X.manchete(0.5)[0] !== X.MANCHETES[0][0], 'a manchete acompanha a história');
  I.acao(pb); ok(!I.jornal, 'AÇÃO de novo fecha o jornal');
  const fa = { x: pb.x + 1.2, z: pb.z, vivo: true, olhando: true };
  I.atualizar(0.016, P(fa.x - 1.5, fa.z), { itens: [], fas: [fa], livre: true });
  ok(I.perto?.tipo === 'fa' && I.acao(P(0, 0))?.tipo === 'foto' && I.fotos === 1, 'perto de um fã olhando, AÇÃO tira a foto');
}

// ---- 4. a corrida inteira
{
  const c = CS[0], I = X.criarInteracoes({ recordes: { [c.id]: 999 } });
  const p = P(c.x, c.z);
  I.atualizar(0.016, p, { itens: [], livre: true });
  ok(I.perto?.tipo === 'corrida' && I.perto.q.id === c.id, `na largada aparece "Desafio: ${c.nome}"`);
  ok(I.acao(p)?.tipo === 'desafio' && I.corrida?.fase === 'contagem', 'AÇÃO começa a contagem');
  let ev = []; for (let k = 0; k < 200; k++) ev.push(...I.atualizar(0.02, p, { itens: [], livre: true }));
  ok(ev.filter((e) => e.tipo === 'contagem').length === 2 && ev.some((e) => e.tipo === 'largada') && I.corrida.fase === 'correndo', 'contagem 3-2-1 e largada');
  ok(I.alvo()?.rotulo === 'Ponto 1/8', 'o guia aponta o ponto 1');
  // corre a ~230 m/s (800 km/h): quadros de 1/60 s andam 3,8 m — passa pelos pontos sem parar em cima deles
  let x = c.x, z = c.z; const passo = 230 / 60; ev = [];
  for (const alvo of c.pontos) {
    while (Math.hypot(alvo.x - x, alvo.z - z) > passo) { const d = Math.hypot(alvo.x - x, alvo.z - z); x += (alvo.x - x) / d * passo; z += (alvo.z - z) / d * passo; ev.push(...I.atualizar(1 / 60, P(x, z, 230), { itens: [], livre: true })); }
    x += (alvo.x - x) * 2; z += (alvo.z - z) * 2;                       // passa do ponto (não para em cima)
    ev.push(...I.atualizar(1 / 60, P(x, z, 230), { itens: [], livre: true }));
  }
  const ch = ev.find((e) => e.tipo === 'chegada');
  ok(ev.filter((e) => e.tipo === 'ponto').length === 8 && ch, `a 800 km/h passa pelos 8 pontos e chega (${ch?.t.toFixed(1)} s)`);
  ok(ch?.medalha === X.medalha(c, ch.t) && ch.recorde && I.recordes[c.id] < 999, `medalha (${ch?.medalha}) e recorde novo (${I.recordes[c.id]} s)`);
  for (let k = 0; k < 300; k++) I.atualizar(0.02, P(x, z), { itens: [], livre: true });
  ok(!I.corrida, 'depois da chegada o desafio termina');
  // interrompida: um crime (livre = false) no meio
  I.atualizar(0.016, P(c.x, c.z), { itens: [], livre: true }); I.acao(P(c.x, c.z));
  for (let k = 0; k < 200; k++) I.atualizar(0.02, P(c.x, c.z), { itens: [], livre: true });
  ev = I.atualizar(0.02, P(c.x + 30, c.z), { itens: [], livre: false });
  ok(ev.some((e) => e.tipo === 'abandonou') && !I.corrida, 'um crime ou vilão no meio interrompe o desafio');
}

if (process.argv.includes('--navegador')) {
  const saida = process.argv[process.argv.indexOf('--navegador') + 1];
  if (saida && !saida.startsWith('--')) fs.mkdirSync(saida, { recursive: true });
  const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
  const srv = await servidor(0, path.join(AQUI, '..'));
  const { navegador, pagina, erros } = await abrir({ largura: 960, altura: 540 });
  const espera = (fn, arg, t = 600000) => pagina.waitForFunction(fn, arg, { timeout: t, polling: 500 }).then(() => true).catch(() => false);
  await pagina.goto(srv.url + '?missao=velocidade', { timeout: 1200000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  await pagina.evaluate(() => { const R = window.__rel; R.mundo.T = 0.45; R.crimes.adiantar(-1e9); R.historia.calarRadio?.(); });
  const tecla = (k) => pagina.evaluate((k) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k })); }, k);
  // o banco: vai até a frente dele (o quarteirão carregado), o botão aparece; E senta; a energia enche; W levanta
  const fr = [banco.x + Math.sin(banco.rot) * 1.3, banco.z + Math.cos(banco.rot) * 1.3];
  await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0, energia: 0.2 }); }, fr);
  ok(await espera(() => !document.getElementById('acao').hidden && /Sentar/.test(document.getElementById('acaoRotulo').textContent)), 'no jogo, perto do banco aparece o botão "Sentar"');
  await tecla('x');
  ok(await espera(() => !!window.__rel.interacoes.sentado), 'X senta');
  // (pelo relógio do jogo: sem GPU os quadros são lentos e poucos segundos de verdade são pouco tempo de jogo)
  const [e0, t0] = await pagina.evaluate(() => [window.__rel.P.energia, window.__rel.P.t]);
  await espera((t0) => window.__rel.P.t > t0 + 1.5, t0);
  const [e1, t1] = await pagina.evaluate(() => [window.__rel.P.energia, window.__rel.P.t]);
  const taxa = (e1 - e0) / (t1 - t0);
  ok(taxa > 0.12 && !!(await pagina.evaluate(() => window.__rel.interacoes.sentado)), `sentado, a energia enche 3× mais rápido (${taxa.toFixed(3)} por segundo de jogo; andando é 0,05)`);
  if (saida && !saida.startsWith('--')) await pagina.screenshot({ path: path.join(saida, 'sentado.png'), timeout: 600000 });
  await pagina.evaluate(() => window.__rel.teclas.add('w')); await pagina.waitForTimeout(1500); await pagina.evaluate(() => window.__rel.teclas.delete('w'));
  ok(await espera(() => !window.__rel.interacoes.sentado), 'andar levanta');
  // a largada do 1º desafio
  const c = CS[0];
  await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x, z, y: 0, vx: 0, vz: 0 }); }, [c.x + 1, c.z]);
  ok(await espera(() => /Desafio/.test(document.getElementById('acaoRotulo').textContent) && !document.getElementById('acao').hidden), `na largada aparece "Desafio: ${c.nome}"`);
  await tecla('x');
  ok(await espera(() => window.__rel.interacoes.corrida?.fase === 'correndo' && !document.getElementById('corridaHud').hidden), 'X começa a contagem e larga; o painel do tempo aparece');
  ok(await pagina.evaluate(() => window.__rel.alvoMissao()?.rotulo === 'Ponto 1/8'), 'o guia aponta o ponto 1');
  if (saida && !saida.startsWith('--')) await pagina.screenshot({ path: path.join(saida, 'desafio.png'), timeout: 600000 });
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
