// teste-penaltis-tela: o modo Pênaltis 3D no navegador (pedido do dono de 15/10; js/disputa.js, js/disputa-tela.js; contrato
// "Disputa de pênaltis" no CONTRATOS.md). Relógio manual (o laço da página, quadro a quadro).
//   1  PC 1280×720, ?modo=penaltis&demo=1 (a IA joga pelo humano): a disputa abre (Golaço FC × Ventania FC, m.modo
//      'penaltis'), sem o relógio no placar e sem minimapa; as bolinhas logo abaixo do placar, sem encostar nele nem no menu.
//   2  A disputa vai até o fim: os planos da câmera (abertura, cobrança, reação, fim), o placar do topo = o da disputa, as
//      bolinhas = as cobranças (convertido/perdido), quem bate durante as cobranças.
//   3  A faixa do fim: "X venceu nos pênaltis", o placar com as siglas e "Jogar de novo"; o clique abre outra disputa (outra
//      moeda: a semente seguinte) sem a faixa.
//   4  Celular 844×390 com toque, o humano de verdade pelo TECLADO (a entrada da página, com a câmera atrás do cobrador):
//      nenhum botão de toque além do CHUTE e dos estilos (PARADINHA e PULINHO, item 70, P2), e eles só com a cobrança dele
//      montada; segurando → (direita da tela) e o K,
//      a bola vai para a direita da tela; defendendo com → antes do chute, o goleiro escolhe a direita da tela; nada encosta
//      (bolinhas, placar, menu, CHUTE, aviso); a disputa acaba.
//   5  "Modo de jogo" da pausa: o botão "Pênaltis" ao lado da Partida (numa linha: a pausa cabe sem rolar no celular) troca
//      para a disputa sem recarregar; "Partida" volta para a partida (o relógio volta, as bolinhas somem).
//   6  Com ?tm (o quadro do Total Match imitado, pedido com modo "penaltis"): o 3D abre na disputa com os times do pedido,
//      "Simular o resto" até o fim, a faixa com "Voltar ao Total Match" e o pai recebe 'tm3d:fim' com {penaltis: ...} igual
//      ao gravado.
//   7  Nenhum erro no console em nenhuma tela.
//   Revisão de 16/10 (cada item reprovava antes):
//   8  PC: a dica de teclas (H controles · Esc menu) aparece, e o aviso da 1ª cobrança do humano diz a tecla (K); na pausa
//      não há o botão "Minimapa" (não fazia nada na disputa); a Ajuda tem o item "Pênaltis" (esquerda/direita) e não diz o
//      "cima ou baixo" do pênalti da partida.
//   9  A faixa do fim não encosta nas bolinhas nas telas baixas de celular (568×320, 667×375; antes cobria em 568×320).
//  10  Sem ?semente: a disputa sorteia a semente (a 1ª, "Reiniciar disputa" e a volta pelo Modo de jogo, todas diferentes).
//  11  ?tm: durante o "Simular o resto" o placar fica sem o relógio da partida (0' 1º T).
//   node tools/teste-penaltis-tela.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { PED_A } = await import(pathToFileURL(path.join(AQUI, 'lib/pedidos-tm.mjs')).href);
const res = [];
const meta = (nome, medido, ok) => res.push({ nome, medido, ok: !!ok });
const srv = await servidor(0, RAIZ);
const Q = 'q=baixa&replay=0';

/** Anda o relógio manual n quadros de 1/60 s (sem desenhar, menos o último) e devolve o resumo da disputa. */
async function quadros(pg, n, desenhar = false) {
  return pg.evaluate(([n, d]) => { const g = window.__golaco; for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: d && i === n - 1 }); return g.disputa; }, [n, desenhar]);
}
const caixa = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); if (!e || e.hidden) return null; const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }, sel);
const encosta = (a, b, folga = 2) => !!a && !!b && a.l < b.r + folga && b.l < a.r + folga && a.t < b.b + folga && b.t < a.b + folga;

// ------------------------------------------------------------------ 1–3 PC com a demo
{
  const s = await abrir({ largura: 1280, altura: 720 });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?modo=penaltis&demo=1&semente=3&${Q}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
  await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
  await quadros(pg, 30, true);
  const ini = await pg.evaluate(() => {
    const g = window.__golaco, rel = document.getElementById('placar-relogio');
    const mm = document.getElementById('minimapa');
    return { modo: g.mundo.modo, d: g.disputa, siglas: [document.getElementById('sigla-0').textContent, document.getElementById('sigla-1').textContent],
      relogio: !!rel && !rel.hidden && getComputedStyle(rel).display !== 'none', mapa: !!mm && getComputedStyle(mm).display !== 'none', tela: g.telaDisputa(),
      dica: (() => { const d = document.getElementById('dica'); return !!d && getComputedStyle(d).display !== 'none'; })() };
  });
  const cx = { disputa: await caixa(pg, '#disputa'), placar: await caixa(pg, '.placar'), menu: await caixa(pg, '#btn-menu') };
  meta('1 PC: a disputa abre (Golaço × Ventania), placar sem relógio, sem minimapa, bolinhas abaixo do placar sem encostar',
    `modo ${ini.modo}, ${ini.siglas.join(' × ')}, ${ini.d?.estado}; relógio ${ini.relogio ? 'VISÍVEL' : 'escondido'}; minimapa ${ini.mapa ? 'VISÍVEL' : 'escondido'}; bolinhas ${ini.tela?.linhas?.join(' / ')} em y ${cx.disputa ? cx.disputa.t.toFixed(0) : '-'} (placar até ${cx.placar ? cx.placar.b.toFixed(0) : '-'})`,
    ini.modo === 'penaltis' && ini.siglas.join() === 'GLÇ,VNT' && !!ini.d && !ini.relogio && !ini.mapa && ini.tela?.visivel && !!cx.disputa && cx.disputa.t >= cx.placar.b + 2 && !encosta(cx.disputa, cx.menu));
  const planos = new Set(), vezes = new Set(), avisos = new Set();
  let d = null, okBolas = true, okPlacar = true;
  for (let k = 0; k < 60 * 6 * 30 && !(d && d.estado === 'fim'); k += 30) {
    d = await quadros(pg, 30);
    const v = await pg.evaluate(() => ({ plano: window.__golaco.planoCamera, tela: window.__golaco.telaDisputa(), gols: [document.getElementById('gols-0').textContent, document.getElementById('gols-1').textContent], aviso: document.getElementById('aviso')?.textContent?.trim() }));
    if (v.plano) planos.add(v.plano);
    if (v.aviso) avisos.add(v.aviso);
    if (v.tela?.vez) vezes.add(v.tela.vez);
    if (v.gols.join() !== d.placar.join()) okPlacar = false;
    // as bolinhas de cada time = as cobranças dele (g convertido, x perdido) — as das últimas 7 rodadas, contando a que está
    // por bater (disputa-tela.js: com a disputa viva, a rodada da vez entra na janela e a mais antiga sai — com 7 cobranças
    // de cada lado e a 8ª da vez, aparecem as 6 últimas e a vazia)
    const vivo = ['caminhada', 'cobranca', 'chute'].includes(d.estado);
    const ini = Math.max(0, Math.max(5, d.chutes[0], d.chutes[1], vivo ? d.chutes[d.vez] + 1 : 0) - 7);
    for (const t of [0, 1]) {
      const lista = d.cobrancas.filter(c => c.time === t).map(c => (c.resultado === 'gol' ? 'g' : 'x')).join('');
      const tl = (v.tela?.linhas?.[t] ?? '').replace(/[o*]/g, '');
      if (tl !== lista.slice(ini)) okBolas = false;
    }
  }
  meta('2 PC: a disputa vai até o fim; planos da câmera; placar do topo = o da disputa; bolinhas = as cobranças; quem bate',
    `${d?.estado}, ${d?.placar.join(' × ')} em ${d?.cobrancas.length} cobranças; planos [${[...planos].join(', ')}]; placar ${okPlacar ? 'igual' : 'DIFERENTE'}; bolinhas ${okBolas ? 'iguais' : 'DIFERENTES'}; ${vezes.size} nomes em "Bate"`,
    d?.estado === 'fim' && ['abertura', 'cobranca', 'reacao', 'fim'].every(p => planos.has(p)) && okPlacar && okBolas && vezes.size >= 4);
  await quadros(pg, 60, true);
  const faixa = await pg.evaluate(() => ({ vis: !document.getElementById('faixa').hidden, titulo: document.getElementById('faixa-titulo').textContent, placar: document.getElementById('faixa-placar').textContent, botao: document.getElementById('faixa-botao').textContent.trim(), cmd: document.getElementById('faixa-botao').dataset.cmd }));
  // 8) a pausa (sem o botão "Minimapa") e a Ajuda da disputa
  const pausa = await pg.evaluate(async () => {
    window.__golaco.abrirMenu();
    await new Promise(r => requestAnimationFrame(r));
    const chip = document.getElementById('chip-minimapa');
    const r = { minimapa: !!chip && getComputedStyle(chip).display !== 'none' && chip.getBoundingClientRect().width > 0 };
    document.querySelector('#menu [data-cmd="ajuda"]').click();
    await new Promise(ok => requestAnimationFrame(ok));
    const vis = e => !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0;
    const aj = document.getElementById('ajuda');
    r.itens = [...aj.querySelectorAll('dd.so-disputa')].filter(vis).map(e => e.textContent);
    // (innerText deixa de fora o que está com display: none)
    r.cimaBaixo = aj.innerText.includes('cima ou para baixo');
    document.querySelector('#ajuda [data-cmd="fechar-ajuda"]')?.click();
    document.querySelector('#menu [data-cmd="continuar"]')?.click();
    return r;
  });
  meta('8 PC: a dica de teclas aparece; o aviso de bater diz a tecla (K); sem "Minimapa" na pausa; Ajuda com "Pênaltis" (esquerda/direita), sem o "cima ou baixo"',
    `dica ${ini.dica ? 'visível' : 'ESCONDIDA'}; avisos [${[...avisos].join(' | ')}]; Minimapa na pausa ${pausa.minimapa ? 'VISÍVEL' : 'fora'}; Ajuda: ${pausa.itens.length} itens "Pênaltis", "cima ou baixo" ${pausa.cimaBaixo ? 'AINDA' : 'fora'}`,
    ini.dica && [...avisos].some(a => /\bK\b/.test(a)) && !pausa.minimapa && pausa.itens.length === 3 && pausa.itens.every(t => /esquerda/.test(t) && /direita/.test(t)) && !pausa.cimaBaixo);
  // 9) a faixa do fim nas telas baixas de celular (a mesma disputa, a janela menor)
  const baixas = [];
  for (const [w, h] of [[568, 320], [667, 375]]) {
    await pg.setViewportSize({ width: w, height: h });
    await quadros(pg, 2, true);
    const c = { disputa: await caixa(pg, '#disputa'), faixa: await caixa(pg, '#faixa'), placar: await caixa(pg, '.placar') };
    baixas.push({ tela: `${w}×${h}`, encosta: encosta(c.disputa, c.faixa) || encosta(c.placar, c.faixa), dentro: !!c.faixa && c.faixa.b <= h && c.faixa.t >= 0, disputa: c.disputa, faixa: c.faixa });
  }
  await pg.setViewportSize({ width: 1280, height: 720 });
  await quadros(pg, 2, true);
  const fx = r => (r ? `[${[r.l, r.t, r.r, r.b].map(v => v.toFixed(0)).join(',')}]` : '-');
  meta('9 a faixa do fim não encosta nas bolinhas nem no placar nas telas baixas (568×320, 667×375) e cabe na tela',
    baixas.map(b => `${b.tela}: ${b.encosta ? 'ENCOSTA' : 'livre'}${b.dentro ? '' : ' FORA DA TELA'} (bolinhas ${fx(b.disputa)}, faixa ${fx(b.faixa)})`).join('; '),
    baixas.every(b => !b.encosta && b.dentro));
  const nomeVenc = d.vencedor === 0 ? 'Golaço FC' : 'Ventania FC';
  await pg.click('#faixa-botao');
  await quadros(pg, 20, true);
  const de2 = await pg.evaluate(() => ({ d: window.__golaco.disputa, faixa: !document.getElementById('faixa').hidden, semente: window.__golaco.mundo.semente }));
  meta('3 PC: faixa "X venceu nos pênaltis" + placar com siglas + "Jogar de novo"; o clique abre outra disputa (semente seguinte)',
    `${faixa.vis ? 'faixa' : 'SEM faixa'} "${faixa.titulo}" "${faixa.placar}" botão "${faixa.botao}" (${faixa.cmd}); depois: ${de2.d?.estado}, ${de2.d?.cobrancas.length} cobranças, semente ${de2.semente}, faixa ${de2.faixa ? 'AINDA' : 'fora'}`,
    faixa.vis && faixa.titulo === `${nomeVenc} venceu nos pênaltis` && faixa.placar === `GLÇ ${d.placar[0]} × ${d.placar[1]} VNT` && faixa.botao === 'Jogar de novo' && faixa.cmd === 'reiniciar-partida'
      && de2.d && de2.d.cobrancas.length === 0 && de2.d.estado !== 'fim' && !de2.faixa && de2.semente === 4);
  meta('7a PC: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  await s.navegador.close();
}

// ------------------------------------------------------------------ 4–5 celular, humano pelo teclado
{
  const s = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?modo=penaltis&semente=5&toque=1&${Q}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
  await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
  const visiveis = () => pg.evaluate(() => [...document.querySelectorAll('#toque .btn-toque')].filter(b => { const st = getComputedStyle(b); return !b.hidden && st.display !== 'none' && st.visibility !== 'hidden' && b.getBoundingClientRect().width > 0; }).map(b => b.id));
  let outros = new Set(), chuteFora = 0, chuteNaVez = 0, nVez = 0, estilosNaVez = 0, estilosFora = 0;
  let bate = 0, bateDir = 0, defende = 0, defDir = 0, encostou = [];
  let d = await quadros(pg, 1);
  let segura = 0, teclaDir = false;
  const humano = 0;
  for (let k = 0; k < 60 * 400 && d.estado !== 'fim'; k += 3) {
    const pr = await pg.evaluate(() => { const m = window.__golaco.mundo; return m.parada && !m.parada.rolou ? { pronta: m.parada.pronta, tick: m.tick } : null; });
    const vezHumano = d.vez === humano;
    // o analógico para a direita da tela na cobrança (batendo e defendendo); o K segurado ~0,35 s depois da bola pronta
    const querDir = d.estado === 'cobranca' && !!pr;
    if (querDir !== teclaDir) { if (querDir) await pg.keyboard.down('ArrowRight'); else await pg.keyboard.up('ArrowRight'); teclaDir = querDir; }
    if (vezHumano && d.estado === 'cobranca' && pr && pr.tick >= pr.pronta + 8 && segura === 0) { await pg.keyboard.down('KeyK'); segura = 1; }
    else if (segura > 0 && segura < 7) segura++;
    else if (segura >= 7) { await pg.keyboard.up('KeyK'); segura = -1; }
    if (d.estado !== 'cobranca') { if (segura > 0) await pg.keyboard.up('KeyK'); segura = 0; }
    const antes = d;
    d = await quadros(pg, 3);
    const vs = await visiveis();
    // (o estado DEPOIS dos quadros: é o que o último quadro desenhou)
    const naVez = d.vez === humano && d.estado === 'cobranca';
    // os estilos do pênalti (item 70, P2): PARADINHA e PULINHO só com a cobrança do humano montada
    for (const id of vs) if (id !== 'btn-chute' && id !== 'btn-paradinha' && id !== 'btn-pulinho') outros.add(id);
    if (vs.includes('btn-paradinha') && vs.includes('btn-pulinho')) { if (naVez) estilosNaVez++; else estilosFora++; }
    else if (vs.includes('btn-paradinha') || vs.includes('btn-pulinho')) estilosFora++;
    if (vs.includes('btn-chute')) { if (naVez) chuteNaVez++; else chuteFora++; }
    if (naVez) nVez++;
    // a cobrança acabou de sair: o lado da bola (batendo) ou o do goleiro (defendendo), na direita da tela = z·gol > 0
    if (antes.estado === 'cobranca' && (d.estado === 'chute' || d.estado === 'reacao')) {
      const lado = await pg.evaluate(() => { const g = window.__golaco, m = g.mundo, D = m.disputa; const gk = m.jogadores.find(j => j.id === D.goleiro); return { bola: Math.sign(m.bola.v.z) * D.gol, palpite: Math.sign(gk.palpite ?? 0) * D.gol, vez: D.vez }; });
      if (lado.vez === humano) { bate++; if (lado.bola > 0) bateDir++; } else { defende++; if (lado.palpite > 0) defDir++; }
      // nada encosta: bolinhas, placar, menu, CHUTE e o aviso
      const c = { disputa: await caixa(pg, '#disputa'), placar: await caixa(pg, '.placar'), menu: await caixa(pg, '#btn-menu'), chute: await caixa(pg, '#btn-chute'), aviso: await caixa(pg, '#aviso.visivel') };
      for (const [a, b] of [['disputa', 'placar'], ['disputa', 'menu'], ['disputa', 'chute'], ['disputa', 'aviso'], ['aviso', 'placar']]) if (encosta(c[a], c[b])) encostou.push(`${a}×${b}`);
    }
  }
  if (teclaDir) await pg.keyboard.up('ArrowRight');
  meta('4a celular: na disputa nenhum botão de toque além do CHUTE e dos estilos (PARADINHA, PULINHO), e eles só com a cobrança do humano montada',
    `outros ${outros.size ? [...outros].join(', ') : 'nenhum'}; CHUTE visível em ${chuteNaVez}/${nVez} amostras da vez dele, ${chuteFora} fora dela; PARADINHA e PULINHO em ${estilosNaVez}/${nVez}, ${estilosFora} fora dela`,
    outros.size === 0 && chuteFora === 0 && chuteNaVez >= nVez * 0.8 && estilosFora === 0 && estilosNaVez >= nVez * 0.5);
  meta('4b celular: o humano pelo teclado (câmera atrás do cobrador) bate para a direita da tela e o goleiro dele escolhe a direita da tela',
    `bateu ${bateDir}/${bate} para a direita; defendeu escolhendo a direita ${defDir}/${defende}; disputa ${d.estado} (${d.placar.join(' × ')})`,
    bate >= 3 && bateDir >= bate - 1 && defende >= 3 && defDir === defende && d.estado === 'fim');
  meta('4c celular: nada encosta (bolinhas, placar, menu, CHUTE, aviso)', encostou.length ? [...new Set(encostou)].join(', ') : 'nada', encostou.length === 0);
  // 5) o "Modo de jogo": Pênaltis ao lado da Partida, a pausa sem rolar, a troca sem recarregar
  await pg.evaluate(() => window.__golaco.abrirMenu());
  const sub = await pg.evaluate(() => {
    document.getElementById('btn-modos').click();
    const j = document.querySelector('.janela-menu'), p = document.querySelector('#menu-modos [data-valor="penaltis"]'), q = document.querySelector('#menu-modos [data-valor="partida"]');
    const rp = p?.getBoundingClientRect(), rq = q?.getBoundingClientRect();
    return { rola: j ? j.scrollHeight - j.clientHeight : 0, pen: !!p && p.offsetParent !== null, mesmaLinha: !!rp && !!rq && Math.abs(rp.top - rq.top) < 2, folga: rp && rq ? rp.left - rq.right : NaN, marcado: p?.getAttribute('aria-pressed') };
  });
  await pg.evaluate(() => document.querySelector('#menu-modos [data-valor="partida"]').click());
  await quadros(pg, 10, true);
  const naPartida = await pg.evaluate(() => ({ modo: window.__golaco.mundo.modo, disputa: window.__golaco.disputa, rel: !document.getElementById('placar-relogio').hidden, bolinhas: !!document.getElementById('disputa') && !document.getElementById('disputa').hidden, cls: document.documentElement.classList.contains('modo-penaltis') }));
  await pg.evaluate(() => { window.__golaco.abrirMenu(); document.getElementById('btn-modos').click(); document.querySelector('#menu-modos [data-valor="penaltis"]').click(); });
  await quadros(pg, 10, true);
  const deVolta = await pg.evaluate(() => ({ modo: window.__golaco.mundo.modo, d: window.__golaco.disputa, url: location.search }));
  meta('5 celular: "Pênaltis" ao lado da Partida no Modo de jogo (sem rolar), troca para a partida e de volta sem recarregar',
    `rola ${sub.rola} px; Pênaltis ${sub.pen ? 'visível' : 'NÃO'} ${sub.mesmaLinha ? 'na linha da Partida' : 'fora da linha'} (folga ${Number.isFinite(sub.folga) ? sub.folga.toFixed(0) : '-'} px, marcado ${sub.marcado}); partida: ${naPartida.modo}, relógio ${naPartida.rel}, bolinhas ${naPartida.bolinhas}, classe ${naPartida.cls}; de volta: ${deVolta.modo} ${deVolta.d?.estado} (${deVolta.url})`,
    sub.rola <= 0 && sub.pen && sub.mesmaLinha && sub.folga >= 4 && sub.marcado === 'true' && naPartida.modo === 'partida' && !naPartida.disputa && naPartida.rel && !naPartida.bolinhas && !naPartida.cls
      && deVolta.modo === 'penaltis' && !!deVolta.d && /modo=penaltis/.test(deVolta.url));
  meta('7b celular: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  await s.navegador.close();
}

// ------------------------------------------------------------------ 10 sem ?semente: a semente sorteada a cada disputa
{
  const s = await abrir({ largura: 1280, altura: 720 });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?modo=penaltis&${Q}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
  await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
  await quadros(pg, 5, true);
  const sem = [await pg.evaluate(() => window.__golaco.mundo.semente)];
  await pg.evaluate(() => { window.__golaco.abrirMenu(); document.getElementById('btn-reiniciar-partida').click(); });
  await quadros(pg, 5, true);
  sem.push(await pg.evaluate(() => window.__golaco.mundo.semente));
  await pg.evaluate(() => { window.__golaco.abrirMenu(); document.getElementById('btn-modos').click(); document.querySelector('#menu-modos [data-valor="partida"]').click(); });
  await quadros(pg, 5, true);
  await pg.evaluate(() => { window.__golaco.abrirMenu(); document.getElementById('btn-modos').click(); document.querySelector('#menu-modos [data-valor="penaltis"]').click(); });
  await quadros(pg, 5, true);
  sem.push(await pg.evaluate(() => window.__golaco.mundo.modo === 'penaltis' ? window.__golaco.mundo.semente : null));
  meta('10 sem ?semente: a semente da disputa é sorteada (a 1ª, Reiniciar disputa, a volta pelo Modo de jogo)', `sementes ${sem.join(', ')}`,
    sem.every(x => Number.isInteger(x) && x >= 1) && new Set(sem).size === sem.length);
  meta('7d sem ?semente: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  await s.navegador.close();
}

// ------------------------------------------------------------------ 6 Total Match (?tm), pedido com modo "penaltis"
{
  const pedido = { ...PED_A, id: 'tP', modo: 'penaltis' };
  const json = JSON.stringify(JSON.stringify(pedido)).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>TM</title></head><body style="margin:0;background:#000">
<script>
localStorage.setItem('tm3d:pedido:tP', ${json});
localStorage.removeItem('tm3d:resultado:tP');
window.__msgs = [];
addEventListener('message', e => { const f = document.getElementById('q'); if (e.origin === location.origin && f && e.source === f.contentWindow) window.__msgs.push(e.data); });
const f = document.createElement('iframe');
f.id = 'q'; f.src = 'index.html?tm=tP&${Q}';
f.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
document.body.appendChild(f);
</script></body></html>`;
  const s = await abrir({ largura: 1280, altura: 720 });
  const pg = s.pagina;
  const url = `${srv.url}__quadro-tm-pen.html`;
  await s.contexto.route(url, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await pg.goto(url, { waitUntil: 'load' });
  let fr = null;
  for (let i = 0; i < 200 && !fr; i++) { fr = pg.frames().find(f => /[?&]tm=/.test(f.url())); if (!fr) await pg.waitForTimeout(50); }
  await fr.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
  await pg.waitForFunction(() => window.__msgs.some(m => m.tipo === 'tm3d:pronto'), null, { timeout: 10000 }).catch(() => {});
  const info = await fr.evaluate(() => { const g = window.__golaco; return { modo: g.mundo.modo, d: g.disputa, siglas: [document.getElementById('sigla-0').textContent, document.getElementById('sigla-1').textContent], humano: g.tm.humano, trava: g.tm.trava }; });
  const r = await fr.evaluate(async () => {
    // 11) durante a simulação: o placar sem o relógio da partida
    const p = window.__golaco.tm.simularResto();
    await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const rel = document.getElementById('placar-relogio');
    const relogioDurante = !!rel && !rel.hidden && getComputedStyle(rel).display !== 'none';
    const faixaDurante = document.getElementById('faixa-titulo').textContent;
    const res = await p;
    return { res, gravado: window.__golaco.tm.resultadoGravado(), titulo: document.getElementById('faixa-titulo').textContent, botao: document.getElementById('faixa-botao').textContent.trim(), d: window.__golaco.disputa, relogioDurante, faixaDurante };
  });
  meta('11 ?tm: durante o "Simular o resto" o placar fica sem o relógio da partida', `"${r.faixaDurante}": relógio ${r.relogioDurante ? 'VISÍVEL' : 'escondido'}`,
    /Simulando o resto da disputa/.test(r.faixaDurante) && !r.relogioDurante);
  await fr.click('#faixa-botao');
  await pg.waitForFunction(() => window.__msgs.some(m => m.tipo === 'tm3d:fim'), null, { timeout: 10000 }).catch(() => {});
  const msgs = await pg.evaluate(() => window.__msgs.map(m => ({ ...m })));
  const fim = msgs.find(m => m.tipo === 'tm3d:fim');
  const P = r.res?.penaltis;
  meta('6 ?tm: o pedido com modo "penaltis" abre a disputa com os times do pedido; Simular o resto; "Voltar ao Total Match" manda tm3d:fim com {penaltis} = o gravado',
    `${msgs.map(m => m.tipo).join(', ')} · ${info.modo} ${info.siglas.join(' × ')} humano ${info.humano} trava ${info.trava} · ${r.d?.estado} ${P ? P.placar.join(' × ') + ' vencedor ' + P.vencedor + ', ' + P.cobrancas.length + ' cobranças' : 'sem resultado'} · "${r.titulo}" "${r.botao}" · tm3d:fim ${fim ? (JSON.stringify(fim.resultado) === JSON.stringify(r.gravado) ? 'igual ao gravado' : 'DIFERENTE') : 'ausente'}`,
    msgs[0]?.tipo === 'tm3d:pronto' && info.modo === 'penaltis' && info.siglas.join() === 'AZU,VER' && info.humano === 0 && info.trava == null && r.d?.estado === 'fim' && !!P && !('homeGoals' in r.res)
      && P.cobrancas.every(c => /^(azu|ver)\d+$/.test(c.tmId)) && /venceu nos pênaltis$/.test(r.titulo) && r.botao === 'Voltar ao Total Match'
      && !!fim && JSON.stringify(fim.resultado) === JSON.stringify(r.gravado) && JSON.stringify(r.gravado) === JSON.stringify(r.res));
  meta('7c ?tm: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  await s.navegador.close();
}

await srv.fechar();
let falhas = 0;
for (const r of res) { console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome}\n          ${r.medido}`); if (!r.ok) falhas++; }
console.log(falhas ? `\nteste-penaltis-tela: REPROVOU (${falhas})` : '\nteste-penaltis-tela: PASSOU');
process.exit(falhas ? 1 : 0);
