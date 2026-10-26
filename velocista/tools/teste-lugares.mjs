// Teste dos LUGARES DA HISTÓRIA e da história da cidade (Joe e Iris).
//   node velocista/tools/teste-lugares.mjs                 → só Node: plano dos lugares, ponte/ilha, limite, pontos de encontro
//   node velocista/tools/teste-lugares.mjs --navegador [pasta-de-prints] → também o jogo: os passos novos, as cenas com o
//     Joe e a Iris, o Apagão, a travessia da ponte até Iron Heights (e prints de cada lugar, se der a pasta)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..');
const args = process.argv.slice(2), naveg = args.includes('--navegador'), pasta = args.filter((a) => !a.startsWith('--'))[0];
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK  ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const M = await import(pathToFileURL(path.join(RAIZ, 'js/marcos.js')).href);
const cid = await import(pathToFileURL(path.join(RAIZ, 'js/cidade.js')).href);
const mis = await import(pathToFileURL(path.join(RAIZ, 'js/missoes.js')).href);

// ---- 1. cada lugar no seu quarteirão, longe do campus do laboratório e um do outro
const celulas = new Set();
for (const m of M.MARCOS) {
  const [i, j] = m.cel, b = cid.bloco(i, j);
  ok(b.tipo === 'marco' && b.marco.id === m.id && !cid.ehCampus(i, j) && !celulas.has(`${i},${j}`), `${m.nome}: quarteirão (${i},${j}) só dele`);
  celulas.add(`${i},${j}`);
  const dentro = b.lotes.every((l) => l.x0 >= b.cx - 28.01 && l.x1 <= b.cx + 28.01 && l.z0 >= b.cz - 28.01 && l.z1 <= b.cz + 28.01);
  ok(dentro, `${m.nome}: prédios dentro do quarteirão`);
  const e = b.entrada, livre = !cid.empurrar(cid.retangulosPerto(e.x, e.z, 1), e.x, e.z, 0.45, cid.CALCADA, 1.8).bateu;
  ok(livre, `${m.nome}: a entrada (${e.x.toFixed(0)}, ${e.z.toFixed(0)}) está livre`);
}
ok(cid.bloco(21, 24).lotes.some((l) => l.y1 >= 47), 'a torre do relógio da Prefeitura sobe a 47 m');
ok(cid.bloco(20, 20).lotes.some((l) => l.y1 >= 78), 'a torre do Picture News passa de 78 m');

// ---- 2. ponte e ilha: dá para andar da rua da borda até o portão do presídio; fora disso, o limite segura
{
  const P = M.PONTE, R = (x, z) => cid.retangulosPerto(x, z, 1);
  let x = M.ENTRADA_PONTE.x - 20, z = P.z, y = 0, preso = false;
  while (x < M.ENTRADA_PRESIDIO.x) {
    x += 0.5; const L = M.limitar(x, z); if (Math.abs(L.x - x) > 1e-6 || Math.abs(L.z - z) > 1e-6) { preso = true; break; }
    const r = cid.empurrar(R(x, z), x, z, 0.45, y, 1.8); if (r.bateu) { preso = true; break; }
    y = cid.chaoEm(R(x, z), x, z, y);
  }
  ok(!preso && y >= 0.29, `da rua da borda ao portão de Iron Heights pela ponte, sempre em pé (chão ${y.toFixed(2)})`);
  const fora = M.limitar(P.x0 + 100, P.z + 40);
  ok(Math.abs(fora.z - P.z) < P.larg / 2, 'fora do tabuleiro, o limite devolve o herói para a ponte');
  const mar = M.limitar(cid.MEIO + 40, P.z + 300);
  ok(mar.x <= cid.MEIO - 4 + 1e-6 || Math.abs(mar.z - P.z) < 10, 'no mar ao lado da cidade, o limite segura na borda');
  const q = M.PRESIDIO, dentroMuro = !cid.empurrar(R(q.cx, q.cz), q.cx, q.cz, 0.45, 0.3, 1.8).bateu;
  ok(dentroMuro && M.solidosFora().some((r) => r.y1 === q.muro), `muralha de ${q.muro} m com o pátio livre dentro`);
}

// ---- 3. pontos de encontro e subestações em lugar livre
const DE_ALIADO = new Set([...mis.MISSOES.flatMap((m) => Object.values(m.aliados || {})), 'portaCsi', 'cantoCsi']);
for (const id of Object.keys(M.PONTOS)) {
  // (os pontos de dentro dos lugares ficam no piso da sala, no alto: interiores.js; lá dentro, o herói só para à frente de quem espera por ele)
  const w = M.pontoMundo(id), R = cid.retangulosPerto(w.x, w.z, 1), y = w.y ?? cid.CALCADA;
  ok(!cid.empurrar(R, w.x, w.z, 0.4, y, 1.8).bateu, `ponto "${id}" livre para a pessoa ficar`);
  const hx = w.x + Math.sin(w.h) * 3.6, hz = w.z + Math.cos(w.h) * 3.6;
  ok(Math.hypot(...Object.values(M.limitar(hx, hz)).map((v, k) => v - [hx, hz][k])) < 1e-6 && (!w.interior || !DE_ALIADO.has(id) || !cid.empurrar(R, hx, hz, 0.4, y, 1.8).bateu), `ponto "${id}": o herói cabe à frente (${hx.toFixed(0)}, ${hz.toFixed(0)})`);
}
for (const s of M.SUBESTACOES) ok(!cid.empurrar(cid.retangulosPerto(s.x, s.z, 1), s.x, s.z, 0.7, cid.CALCADA, 1.8).bateu, `subestação (${s.x}, ${s.z}) na calçada, sem prédio em cima`);

// ---- 4. os passos novos na ordem da história
const ids = mis.MISSOES.map((m) => m.id), antes = (a, b) => ids.indexOf(a) >= 0 && ids.indexOf(a) < ids.indexOf(b);
ok(antes('vibrar', 'delegacia') && antes('delegacia', 'atrasado') && antes('troca', 'assalto') && antes('gangue', 'jornal') && antes('cap-zoom', 'energia') && antes('cap-frio', 'presidio')
  && antes('cap-onda', 'cafe') && antes('cap-reverso', 'casa') && antes('cap-final', 'prefeitura') && antes('prefeitura', 'fendas'), `os passos da cidade entre os capítulos (${ids.length} passos)`);
ok(mis.MISSOES.filter((m) => m.ponto).every((m) => M.PONTOS[m.ponto] && Object.values(m.aliados || {}).every((p) => M.PONTOS[p])), 'todo passo com lugar tem ponto e aliados conhecidos');

if (naveg) {
  const fs = await import('node:fs');
  if (pasta) fs.mkdirSync(pasta, { recursive: true });
  const { servidor, abrir } = await import(pathToFileURL(path.join(RAIZ, '../golaco/tools/lib/navegador.mjs')).href);
  const srv = await servidor(0, RAIZ);
  const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
  const espera = (fn, arg, t = 400000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);
  const foto = async (n) => { if (pasta) await pagina.screenshot({ path: path.join(pasta, `${n}.png`), timeout: 400000 }).catch((e) => console.log('print falhou', n, e.message)); };
  const abrirJogo = async (q) => {
    await pagina.goto(srv.url + q, { timeout: 400000 });
    await pagina.evaluate(() => { localStorage.clear(); localStorage.setItem('theflash.historia.v1', JSON.stringify({ vistas: ['cena:prologo'] })); });
    await pagina.goto(srv.url + q, { timeout: 400000 });
    await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
    await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
    await pagina.evaluate(() => { window.__rel.mundo.T = 0.45; });
  };
  const ir = (x, z, h = 0) => pagina.evaluate(([x, z, h]) => { const R = window.__rel; Object.assign(R.P, { x, z, y: 0.3, vx: 0, vz: 0, vy: 0, h }); R.C.yaw = h; }, [x, z, h]);
  const pular = () => pagina.evaluate(() => document.querySelector('#cenaHist .pular')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));

  // a Delegacia: o guia leva até lá, o Joe espera na porta, chegar abre a cena com ele
  await abrirJogo('?historia=1&missao=delegacia');
  ok(await espera(() => window.__rel.missoes.atual?.id === 'delegacia'), 'passo "Delegacia Central"');
  const g = await pagina.evaluate(() => window.__rel.alvoMissao());
  const pj = M.pontoMundo('delegacia');
  ok(g && Math.hypot(g.x - pj.x, g.z - pj.z) < 5, `o guia leva até a porta da Delegacia (${g?.rotulo})`);
  await ir(pj.x - 12, pj.z - 14, 0.7);
  ok(await espera(() => window.__rel.aliados.pessoas.joe?.raiz.visible), 'o Joe está na porta da Delegacia');
  await pagina.waitForTimeout(2500); await foto('delegacia');
  await pagina.evaluate(() => window.__rel.historia.calarRadio());     // a cena espera o rádio terminar de falar
  await ir(pj.x, pj.z - 5, 0);
  ok(await espera(() => window.__rel.historia.cenaAtual === 'depois-delegacia'), 'chegar perto abre a cena com o Joe');
  const em = await pagina.evaluate(() => { const R = window.__rel, j = R.aliados.foco('joe'); return j && Math.hypot(R.P.x - j.x, R.P.z - j.z); });
  ok(em && em < 5, `de frente para o Joe na cena (${em?.toFixed(1)} m)`);
  await pagina.waitForTimeout(2500); await foto('delegacia-cena');
  await pular();
  ok(await espera(() => window.__rel.missoes.atual?.id === 'atrasado' && window.__rel.J.modo === 'jogando'), 'depois da cena, a história segue (Atrasado de novo)');

  // o Apagão: as 3 subestações, uma por vez, e a cidade acende de novo
  await abrirJogo('?missao=energia');
  ok(await espera(() => window.__rel.missoes.atual?.id === 'energia' && window.__rel.J.apagao === 1), 'Apagão: a cidade escura, 3 subestações para religar');
  for (let k = 0; k < 3; k++) {
    const a = await pagina.evaluate(() => window.__rel.alvoMissao());
    await ir(a.x + 2, a.z + 2);
    ok(await espera((k) => (window.__rel.missoes.progresso()?.n ?? 3) > k || !window.__rel.missoes.atual || window.__rel.missoes.atual.id !== 'energia', k, 60000), `subestação ${k + 1} religada`);
    if (k === 0) { await pagina.waitForTimeout(1500); await foto('subestacao'); }
  }
  ok(await espera(() => window.__rel.missoes.atual?.id !== 'energia' && window.__rel.J.apagao === 0), 'as três religadas: a luz volta e a história segue');

  // a ponte até Iron Heights
  await abrirJogo('?historia=1&missao=presidio');
  ok(await espera(() => window.__rel.missoes.atual?.id === 'presidio'), 'passo "Iron Heights"');
  await ir(M.PONTE.x0 + 30, M.PONTE.z, Math.PI / 2);
  await pagina.waitForTimeout(3000); await foto('ponte');
  await pagina.evaluate(() => { window.__rel.P.vx = 60; });
  await pagina.waitForTimeout(800);
  const naPonte = await pagina.evaluate(() => { const R = window.__rel; return { x: R.P.x, z: R.P.z, y: R.P.y }; });
  ok(naPonte.x > M.PONTE.x0 + 30 && Math.abs(naPonte.z - M.PONTE.z) < M.PONTE.larg / 2 && naPonte.y > 0.2, `corre pela ponte sem cair (${naPonte.x.toFixed(0)}, ${naPonte.y.toFixed(2)})`);
  const pp = M.pontoMundo('presidio');
  await ir(pp.x - 30, pp.z, Math.PI / 2); await pagina.waitForTimeout(2500); await foto('presidio');
  await pagina.evaluate(() => window.__rel.historia.calarRadio());
  await ir(pp.x - 5, pp.z, Math.PI / 2);
  ok(await espera(() => window.__rel.historia.cenaAtual === 'depois-presidio'), 'no portão de Iron Heights, a cena com o Joe');
  await pagina.waitForTimeout(2000); await foto('presidio-cena'); await pular();

  // os outros lugares (prints) e o relógio da Prefeitura na hora do jogo
  // de frente para cada fachada, um pouco acima (a câmera do jogo atrás do herói, mais longe)
  for (const [nome, id, d, pitch] of [['delegacia', 'delegacia', 14, 0.2], ['jornal', 'jornal', 13, 0.5], ['cafe', 'cafe', 9, 0.15], ['prefeitura', 'prefeitura', 28, 0.4], ['casa', 'casa', 24, 0.25]]) {
    const w = M.pontoMundo(id); await ir(w.x, w.z - d, 0);
    await pagina.evaluate(([p]) => { const R = window.__rel; R.C.pitch = p; R.CAM.dist = 16; R.mundo.T = 0.45; }, [pitch]);
    await pagina.waitForTimeout(3500); await foto(`lugar-${nome}`);
  }
  await pagina.evaluate(() => { const R = window.__rel; R.CAM.dist = 6.6; });
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
