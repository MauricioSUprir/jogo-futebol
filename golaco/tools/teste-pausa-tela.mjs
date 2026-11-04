// Teste da PAUSA do item 58 (dono, 23/10: "não quero ele assim, quero ele igual ao do FIFA" — a pausa do EA FC 24 — "só quero
// que tenha que aparecer o campinho do time no canto direito"; contrato "Pausa (item 58)" no CONTRATOS.md, PESQUISA-ESTADIO.md
// §7.3). Navegador (Chromium pelo Playwright; a régua em tools/lib/pausa-medidas.mjs). Celular deitado em 844×390, 667×375,
// 640×360 e 568×320 com toque e o entalhe simulado; PC em 1280×720; a partida, o fim, os treinos, o Livre, os Pênaltis, o ?tm (num
// quadro COM a meta viewport, como o Total Match de verdade: pedido A, pedido B com a trava, Livre e Pênaltis) e o online (2 abas).
//   P1  a lista à esquerda (uma coluna, na ordem do FC 24 por modo) e o cartão do meu time à direita, nada encostando, cortado ou
//       fora da área segura; CADA item do 1º nível com o foco (a letra maior e o negrito) cabe na linha — também no PC fora do
//       16:9 (1024×768, 1280×1024, 1440×900, 1280×800, 800×600: a letra crescia com a altura e a faixa com a largura), o
//       "Voltar ao Total Match" do fim do TM e o "Sair" armado do online (revisão do item 58, F1)
//   P2  sem rolar em todos os níveis (1º, Opções, Modo de jogo, Estatísticas, Jogadores e Câmera do Livre) × modos × telas,
//       também no PC baixo (1366×600, 1280×520, 1000×520: as Opções rolavam com a barra escondida — F2) e nada saindo das
//       pílulas do Modo de jogo na janela estreita (800×600 — F3)
//   P3  o jogo à vista (pelo print: a luminância com a pausa ≥ 60% da sem ela): ≥ 40% no PC, 25% em 844×390, 17% em 667 e 640,
//       14% em 568×320
//   P4  o campinho: 11 fichas na ordem da formação, número e nome de camisa, a formação do rascunho (o Editar time com 4-4-2 →
//       PRONTO: "4-4-2" antes de o jogo voltar), sem encostar, letras ≥ 10/11 px, o amarelo, o expulso como vaga vazia, o ↑ de
//       quem entra, o anel de "você"; tocar no cartão abre o editor (e não abre na trava); treinos e disputa sem ele; no Livre só
//       quem está em campo
//   P5  teclado: ↓/↑ andam; Esc no submenu volta ao 1º nível com o foco no item que o abriu e Esc de novo fecha; 40 Tabs e 40
//       Shift+Tabs não saem da pausa; o HUD, os botões de toque e a camada das cenas ficam inert com ela aberta
//   P6  alvos ≥ 44 × 32 px (28 em 568×320; no PC altura ≥ 32)
//   P7  leitor de tela: o diálogo "Pausa: …", os grupos das Opções com nome, o cartão como região com nome e resumo, as
//       Estatísticas como tabela com legenda
//   P8  a cara do TM sem ?tm: a Inter TM nos itens (carregada), a barra do foco #22c55e, contraste ≥ 4,5:1 (texto) e ≥ 3:1 (barra)
//   P9  o X no centro do ≡ (±4 px) fecha e não reabre; tocar no jogo fecha; tocar na faixa vazia não fecha
//   P10 todo comando pelos 3 meios (toque, teclado só com setas + Enter, controle pelas ações menu-*) chega ao comando() com o
//       mesmo (c, v); Voltar ao jogo ≤ 2 nos três, Editar time ≤ 2 toques e ≤ 3 teclas/apertos (o resto: tabela informativa)
//   S1  o mundo parado com a pausa aberta (0 passos em 60 quadros; 10 em 10 fechada); no online o jogo anda (de propósito)
//   S2  0 erros no console        S5  a menor letra ≥ 11 px (o campinho ≥ 10 em 568×320)
//   node tools/teste-pausa-tela.mjs [--raiz <pasta golaco>] [--so cel|pc|tm|online]
// (--raiz: mede outra cópia do jogo — a base a5abaa4e tem de REPROVAR)
import path from 'node:path';
import { servidor, abrir, RAIZ as RAIZ_PADRAO } from './lib/navegador.mjs';
import { PED_A, PED_B } from './lib/pedidos-tm.mjs';
import { ORDEM, COMANDOS, SECOS, MEDIR, FOCO, FOCO_LARGURA, margemCelular } from './lib/pausa-medidas.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RAIZ = path.resolve(arg('--raiz', RAIZ_PADRAO));
const SO = arg('--so', null);
const CEL = [[844, 390], [667, 375], [640, 360], [568, 320]];
const PC = [1280, 720];
// o PC fora do 16:9 e baixo (revisão do item 58: F1 4:3, 5:4 e 16:10; F2 a janela do notebook fora da tela cheia; F3 a estreita)
const PC_MAIS = [[1024, 768], [1280, 1024], [1440, 900], [1280, 800], [800, 600], [1366, 600], [1280, 520], [1000, 520]];
const Q = 'q=baixa&replay=0&comemoracao=0&semente=5';
const META_P3 = { 1280: 0.40, 844: 0.25, 667: 0.17, 640: 0.17, 568: 0.14 };
const srv = await servidor(0, RAIZ);
const res = [];
const meta = (nome, medido, alvo, ok) => { res.push({ nome, medido, alvo, ok: !!ok }); console.log(`${ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome}\n          ${medido}  (alvo: ${alvo})`); };
const erros = [];
// as coletas das metas (cada sessão soma aqui; as metas saem no fim)
const P = { p1: [], p1n: 0, p2: [], p2n: 0, p6: [], p6n: 0, s5: [], s5n: 0, p3: [], p4: [], p5: [], p7: [], p8: [], p9: [], p10: [], p10custo: [], s1: [] };
const nada = () => {};

// ------------------------------------------------------------------ ajudantes
const quadros = (pg, n = 2) => pg.evaluate(n => new Promise(ok => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
async function pronta(pg) {
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
  await pg.evaluate(() => document.fonts?.ready);
}
/** Fecha tudo e abre a pausa no 1º nível; espera o cartão (data-pronto) quando o módulo dele existe. */
async function abrirPausa(pg) {
  await pg.evaluate(() => {
    const g = window.__golaco;
    if (!document.getElementById('ajuda').hidden) g.fecharAjuda();
    if (g.editor?.aberto) g.editor.voltar?.();
    g.fecharMenu();
    g.abrirMenu();
  });
  await pg.waitForFunction(() => !window.__golaco.pausa || window.__golaco.pausa.pronta === false ? true : document.getElementById('pausa-time')?.dataset.pronto === '1', null, { timeout: 15000 }).catch(nada);
  await quadros(pg, 2);
}
async function carregarPausa(pg) { await pg.evaluate(() => window.__golaco.pausa?.carregar?.()).catch(nada); }
/** O relógio manual (o laço não roda sozinho: a pausa e os comandos não dependem dele — o teclado, o toque e as ações vão direto
 *  ao tratarAcao; sem o 3D redesenhado a cada quadro a sessão anda bem mais rápido). O P3 desenha o quadro dele. */
const manual = pg => pg.evaluate(() => window.__golaco.relogio.usarManual(true));
async function trocarModo(pg, v) {
  if (v === 'fim') {
    await pg.evaluate(() => {
      const g = window.__golaco;
      g.reiniciar({ modo: 'partida', semente: 21, minutosPorTempo: 0.05 });
      let n = 0;
      while (n < 2400 && g.estado().relogio?.estado !== 'fim') { g.rodarPassos(30, 'demo'); n += 30; }
    });
    await quadros(pg, 3);
    return;
  }
  await pg.evaluate(v => window.__golaco.trocarModo(v), v);
  await pg.waitForFunction(v => window.__golaco.mundo?.modo === v || window.__golaco.estado().modoTreino === v, v, { timeout: 120000 });
  if (v === 'livre') {
    await pg.waitForFunction(() => !!document.getElementById('btn-livre-jogar'), null, { timeout: 60000 });
    await pg.evaluate(() => { const b = document.getElementById('btn-livre-jogar'); if (b && b.offsetParent !== null) b.click(); });
  }
  await quadros(pg, 3);
}
/** O 1º nível e cada submenu que existe aqui (aberto pelo clique no item, como a pessoa). */
async function medirNiveis(pg) {
  await abrirPausa(pg);
  const out = { primeiro: await pg.evaluate(MEDIR), subs: {} };
  out.primeiro.foco = await pg.evaluate(FOCO_LARGURA);
  for (const [nome, sel] of [['opcoes', '#btn-opcoes'], ['modos', '#btn-modos'], ['estatisticas', '#btn-estatisticas'], ['jogadores', '#btn-livre-jogadores'], ['camera', '#btn-livre-camera']]) {
    await abrirPausa(pg);
    const tem = await pg.evaluate(s => { const b = document.querySelector(s); return !!b && !b.hidden && b.getClientRects().length > 0; }, sel);
    if (!tem) continue;
    await pg.evaluate(s => document.querySelector(s).click(), sel);
    await quadros(pg, 2);
    out.subs[nome] = await pg.evaluate(MEDIR);
  }
  await pg.evaluate(() => window.__golaco.fecharMenu());
  return out;
}
/** P1: os problemas de layout do 1º nível. */
function problemasP1(m, ordem, { cartao, pc }) {
  const p = [];
  if (!m.aberta) return ['a pausa não abriu'];
  const ids = (m.linhas ?? []).map(l => l.id);
  if (JSON.stringify(ids) !== JSON.stringify(ordem)) p.push(`ordem [${ids.join(', ')}]`);
  const ls = m.linhas ?? [];
  for (const l of ls) if (Math.abs(l.x - ls[0].x) > 1) { p.push(`fora da coluna: ${l.id} em x ${l.x}`); break; }
  for (let i = 1; i < ls.length; i++) if (ls[i].y < ls[i - 1].b + 2 - 0.01) { p.push(`${ls[i - 1].id}/${ls[i].id} a ${(ls[i].y - ls[i - 1].b).toFixed(1)} px`); break; }
  if (cartao) {
    if (!m.cartao) p.push('sem o cartão do time');
    else {
      const dir = m.W - m.sa[1] - (pc ? 14 : margemCelular(m.W));
      if (Math.abs(m.cartao.r - dir) > 2) p.push(`cartão: direita em ${m.cartao.r.toFixed(1)} (alvo ${dir})`);
      if (m.lista && m.cartao.x < m.lista.r + 8) p.push(`cartão a ${(m.cartao.x - m.lista.r).toFixed(1)} px da lista`);
      if (m.x && m.cartao.y - m.x.b < 8) p.push(`cartão a ${(m.cartao.y - m.x.b).toFixed(1)} px do X`);
      if (m.pilula && m.cartao.y - m.pilula.b < 8) p.push(`cartão a ${(m.cartao.y - m.pilula.b).toFixed(1)} px da pílula`);
    }
  } else if (m.cartao) p.push('cartão do time onde ele não existe');
  if (m.topo && m.lista && m.lista.y - m.topo.b < 8) p.push(`topo a ${(m.lista.y - m.topo.b).toFixed(1)} px da lista`);
  if (m.pilula && m.x && m.x.x - m.pilula.r < 8) p.push(`pílula a ${(m.x.x - m.pilula.r).toFixed(1)} px do X`);
  if (m.pilula && m.topo && m.pilula.x - m.topo.r < 8) p.push(`pílula a ${(m.pilula.x - m.topo.r).toFixed(1)} px do topo da faixa`);
  if (!m.x) p.push('sem o X');
  if (m.encosta.length) p.push(`encosta: ${m.encosta.slice(0, 3).join('; ')}`);
  if (m.cortados.length) p.push(`cortado: ${m.cortados.slice(0, 4).join(', ')}`);
  if (m.fora.length) p.push(`fora da área segura: ${m.fora.slice(0, 4).join(', ')}`);
  const passa = (m.foco ?? []).filter(x => x.sobra < 0);
  if (passa.length) p.push(`com o foco passa da linha: ${passa.slice(0, 4).map(x => `${x.id} ${x.f.toFixed(1)} px ${x.sobra}`).join(', ')}`);
  return p;
}
/** P2, P6 e S5 de uma medida (qualquer nível); devolve as listas de problemas. */
function conferirNivel(rot, m, pc) {
  P.p2n++;
  if (!m.aberta || m.rola > 0) P.p2.push(`${rot}: rola ${m.rola ?? '-'} px`);
  P.p6n++;
  const hMin = pc ? 32 : m.W < 600 ? 28 : 32;
  const peq = (m.alvos ?? []).filter(a => a.w < 44 - 0.01 || a.h < hMin - 0.01).map(a => `${a.nome} ${a.w.toFixed(0)}×${a.h.toFixed(0)}`);
  if (peq.length) P.p6.push(`${rot}: ${peq.slice(0, 4).join(', ')}${peq.length > 4 ? ` (+${peq.length - 4})` : ''}`);
  P.s5n++;
  const fMin = m.fonteMin?.f ?? 99, fCart = m.fonteMinCartao?.f ?? 99, alvoCart = pc || m.W >= 640 ? 11 : 10;
  if (fMin < 11 || fCart < alvoCart) P.s5.push(`${rot}: ${fMin < 11 ? `"${m.fonteMin.t}" ${fMin} px` : ''}${fCart < alvoCart ? ` cartão "${m.fonteMinCartao.t}" ${fCart} px` : ''}`);
  // encostos, cortes e fora da área valem em todo nível (no 1º eles entram no P1)
  if (m.aberta && m.nivel !== 'menu-acoes' && (m.encosta.length || m.cortados.length || m.fora.length)) P.p1.push(`${rot}: ${[...m.encosta.slice(0, 2), ...m.cortados.slice(0, 2).map(c => 'cortado ' + c), ...m.fora.slice(0, 2).map(c => 'fora ' + c)].join('; ')}`);
}
/** O mundo parado com a pausa aberta (relógio manual: 60 quadros) e andando com ela fechada. */
async function mundoParado(pg) {
  return pg.evaluate(() => {
    const g = window.__golaco;
    g.relogio.usarManual(true);
    for (let i = 0; i < 5; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    g.abrirMenu();
    const t0 = g.estado().tick;
    for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    const t1 = g.estado().tick;
    g.fecharMenu();
    for (let i = 0; i < 10; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    const t2 = g.estado().tick;
    return { aberta: t1 - t0, fechada: t2 - t1 };
  });
}
/** P3: a fração da tela com o jogo à vista (o print com a pausa × o print com o #menu escondido, no mesmo quadro). */
async function jogoAVista(pg, pagina) {
  await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(1000 / 60, { desenhar: true }); });
  await quadros(pg, 2);
  const a = await pagina.screenshot({ type: 'png' });
  await pg.evaluate(() => { document.getElementById('menu').style.visibility = 'hidden'; });
  await quadros(pg, 2);
  const b = await pagina.screenshot({ type: 'png' });
  await pg.evaluate(() => { document.getElementById('menu').style.visibility = ''; });
  return pg.evaluate(async ([A, B]) => {
    const ler = async b64 => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data;
    };
    const a = await ler(A), b = await ler(B);
    let n = 0, vis = 0;
    for (let i = 0; i < a.length; i += 8) {
      const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2], lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
      if (lb < 25) continue;
      n++; if (la >= 0.6 * lb) vis++;
    }
    return n ? vis / n : 0;
  }, [a.toString('base64'), b.toString('base64')]);
}
const centro = (pg, sel) => pg.evaluate(s => { const b = typeof s === 'string' ? document.querySelector(s) : null; if (!b || b.hidden || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left }; }, sel);
const vistos = pg => pg.evaluate(() => window.__golaco.comandosVistos ?? null);
const chegou = (lista, c) => !!lista && lista.some(([cc, vv]) => cc === c.c && (c.range || c.v === undefined || vv === c.v));

/** P10 pelo toque: o ≡, (o item do submenu,) o alvo. Devolve {ok, toques} ou null (o comando não existe aqui). */
async function comandoPeloToque(pg, c) {
  await pg.evaluate(() => { const g = window.__golaco; g.fecharMenu(); g.limparComandosVistos?.(); });
  await quadros(pg, 2);
  const m = await centro(pg, '#btn-menu');
  if (!m) return { ok: false, toques: null, motivo: 'sem o ≡' };
  await pg.touchscreen.tap(m.x, m.y);
  await quadros(pg, 2);
  let toques = 1;
  if (c.sub) {
    const s = await centro(pg, c.sub);
    if (!s) return null;
    await pg.touchscreen.tap(s.x, s.y); toques++;
    await quadros(pg, 2);
  }
  const a = await centro(pg, c.sel);
  if (!a) return c.sub ? { ok: false, toques: null, motivo: 'não está à vista' } : null;
  // (no deslizante, longe da bolinha: tocar em cima dela não muda o valor)
  const fr = c.range ? await pg.evaluate(s => { const e = document.querySelector(s); return (e.value - e.min) / ((e.max - e.min) || 1); }, c.sel) : 0;
  await pg.touchscreen.tap(c.range ? a.l + a.w * (fr < 0.5 ? 0.85 : 0.15) : a.x, a.y); toques++;
  await quadros(pg, 2);
  const v = await vistos(pg);
  return { ok: chegou(v, c), toques };
}
/**
 * P10 pelo teclado ou pelo controle: abre (Esc | Start), anda com as setas | a cruz até o alvo (como a pessoa: para baixo se ele
 * está embaixo, para cima se está em cima, para o lado se está na mesma linha) e aperta (Enter | A; no deslizante, → | direita).
 */
async function comandoPorTeclas(pg, kb, c, meio) {
  await pg.evaluate(() => { const g = window.__golaco; g.fecharMenu(); g.limparComandosVistos?.(); document.activeElement?.blur?.(); });
  await quadros(pg, 2);
  const tecla = async k => {
    if (meio === 'teclado') await kb.press(k);
    else await pg.evaluate(a => window.__golaco.acao(a), { Escape: 'pausa', Enter: 'menu-ok', ArrowDown: 'menu-baixo', ArrowUp: 'menu-cima', ArrowLeft: 'menu-esq', ArrowRight: 'menu-dir' }[k]);
    await quadros(pg, 1);
  };
  let n = 0;
  await tecla('Escape'); n++;
  const ir = async sel => {
    for (let k = 0; k < 30; k++) {
      const r = await pg.evaluate(s => {
        const a = document.activeElement, t = document.querySelector(s);
        if (!t || t.hidden || !t.getClientRects().length) return { sem: true };
        if (a === t) return { ok: true };
        if (!a || a === document.body || !document.getElementById('menu').contains(a)) return { baixo: true };
        const ra = a.getBoundingClientRect(), rt = t.getBoundingClientRect();
        if (rt.top >= ra.bottom - 1) return { k: 'ArrowDown' };
        if (rt.bottom <= ra.top + 1) return { k: 'ArrowUp' };
        return { k: rt.left > ra.left ? 'ArrowRight' : 'ArrowLeft' };
      }, sel);
      if (r.sem) return false;
      if (r.ok) return true;
      await tecla(r.k ?? 'ArrowDown'); n++;
    }
    return false;
  };
  if (c.sub) {
    if (!(await ir(c.sub))) return null;
    await tecla('Enter'); n++;
  }
  if (!(await ir(c.sel))) return c.sub ? { ok: false, teclas: null, motivo: 'não chegou' } : null;
  await tecla(c.range ? 'ArrowRight' : 'Enter'); n++;
  const v = await vistos(pg);
  return { ok: chegou(v, c), teclas: n };
}

// ------------------------------------------------------------------ sessão: celular sem ?tm (toque + entalhe)
async function sessaoCelular() {
  const s = await abrir({ largura: 844, altura: 390, dpr: 1, toque: true });
  const pg = s.pagina;
  try {
    await pg.goto(`${srv.url}index.html?${Q}&toque=1&entalhe=1`, { waitUntil: 'load' });
    await pronta(pg);
    await carregarPausa(pg);
    await manual(pg);
    for (const modo of ['partida', 'fim', 'ataque', 'conducao', 'livre', 'penaltis']) {
      await pg.setViewportSize({ width: 844, height: 390 });
      if (modo !== 'partida') await trocarModo(pg, modo);
      if (modo !== 'fim') {
        const par = await mundoParado(pg);
        P.s1.push(`${modo} ${par.aberta}/${par.fechada}`);
        if (par.aberta !== 0 || par.fechada !== 10) P.s1.push(`FALHA ${modo}`);
      }
      const comCartao = modo === 'partida' || modo === 'fim' || modo === 'livre';
      for (const [W, H] of CEL) {
        await pg.setViewportSize({ width: W, height: H });
        await pg.waitForTimeout(80);
        const r = await medirNiveis(pg);
        P.p1n++;
        const p1 = problemasP1(r.primeiro, ORDEM[modo], { cartao: comCartao, pc: false });
        if (p1.length) P.p1.push(`celular ${modo} ${W}×${H}: ${p1.join('; ')}`);
        conferirNivel(`celular ${modo} ${W}×${H} 1º`, r.primeiro, false);
        for (const [n, m] of Object.entries(r.subs)) conferirNivel(`celular ${modo} ${W}×${H} ${n}`, m, false);
        if (modo === 'partida') {
          await abrirPausa(pg);
          const f = await jogoAVista(pg, pg).catch(() => 0);
          P.p3.push({ tela: `${W}×${H}`, f, meta: META_P3[W], ok: f >= META_P3[W] });
        }
        if (modo === 'livre' && W === 844) {
          await abrirPausa(pg);
          const e = await pg.evaluate(() => ({ tela: window.__golaco.pausa?.tela, esc: window.__golaco.livre?.escolha?.() }));
          const n = e.tela?.fichas?.length ?? 0, esperado = e.esc ? (e.esc.linha[0] + (e.esc.goleiro[0] ? 1 : 0)) : null;
          P.p4.push({ nome: 'Livre: só quem está em campo', ok: !!e.tela?.visivel && n === esperado, medido: `${n} fichas (em campo ${esperado ?? '-'})` });
        }
        if ((modo === 'ataque' || modo === 'penaltis') && W === 844) {
          await abrirPausa(pg);
          const vis = await pg.evaluate(() => { const c = document.getElementById('pausa-time'); return !!c && !c.hidden && c.getClientRects().length > 0; });
          P.p4.push({ nome: `${modo}: sem o cartão`, ok: !vis && !!(await pg.evaluate(() => window.__golaco.pausa)), medido: vis ? 'cartão à vista' : 'sem cartão' });
        }
      }
      await pg.setViewportSize({ width: 844, height: 390 });
      await pg.waitForTimeout(80);
      // P10 pelo toque, nos comandos deste modo
      await pg.evaluate(l => window.__golaco.secarComandos?.(l), SECOS);
      const so = modo === 'partida' ? ['todos', 'partida', 'toque'] : modo === 'conducao' ? ['treino', 'conducao'] : modo === 'livre' ? ['livre'] : [];
      for (const c of COMANDOS.filter(c => so.includes(c.so))) {
        const r = await comandoPeloToque(pg, c).catch(e => ({ ok: false, motivo: e.message }));
        if (r === null) { P.p10.push(`toque ${c.nome}: não existe na pausa`); continue; }
        if (!r.ok) P.p10.push(`toque ${c.nome}: não chegou${r.motivo ? ` (${r.motivo})` : ''}`);
        P.p10custo.push({ meio: 'toque', nome: c.nome, n: r.toques });
      }
      await pg.evaluate(() => window.__golaco.secarComandos?.(null));
      await pg.evaluate(() => window.__golaco.fecharMenu());
      if (modo === 'partida') await partidaCelular(s, pg);
    }
  } catch (e) { erros.push(`celular: ${e.stack ?? e}`); }
  finally { erros.push(...s.erros.map(x => `celular: ${x}`)); await s.navegador.close(); }
}

/** Na partida do celular (844×390): o campinho (P4), o toque (P9), o leitor de tela (P7) e a cara do TM (P8). */
async function partidaCelular(s, pg) {
  // ---- P9: o X no centro do ≡; o X fecha e não reabre; tocar no jogo fecha; tocar na faixa vazia não fecha
  await pg.evaluate(() => window.__golaco.fecharMenu());
  await quadros(pg, 2);
  const tri = await centro(pg, '#btn-menu');
  await pg.touchscreen.tap(tri.x, tri.y);
  await quadros(pg, 3);
  const abriu = await pg.evaluate(() => window.__golaco.estado().menuAberto);
  const x = await centro(pg, '#menu .btn-fechar[data-cmd="continuar"]');
  const dx = x ? Math.hypot(x.x - tri.x, x.y - tri.y) : Infinity;
  if (x) await pg.touchscreen.tap(x.x, x.y);
  await pg.waitForTimeout(700);
  const fechouX = !(await pg.evaluate(() => window.__golaco.estado().menuAberto));
  P.p9.push({ nome: 'o X no centro do ≡ (±4 px) fecha e não reabre', ok: abriu && dx <= 4 && fechouX, medido: `≡ abre ${abriu}; X a ${Number.isFinite(dx) ? dx.toFixed(1) : '-'} px do ≡; fechado depois de 0,7 s ${fechouX}` });
  await abrirPausa(pg);
  const m = await pg.evaluate(MEDIR);
  const ref = m.cartao ?? { r: m.W - 60, b: 200 };
  const ptJogo = { x: Math.min(m.W - 4, (ref.r + m.W) / 2), y: Math.min(m.H - 4, (ref.b + m.H) / 2) };
  await pg.touchscreen.tap(ptJogo.x, ptJogo.y);
  await pg.waitForTimeout(500);
  const fechouJogo = !(await pg.evaluate(() => window.__golaco.estado().menuAberto));
  await abrirPausa(pg);
  const ptFaixa = m.lista ? { x: m.lista.r + 6, y: m.lista.y + m.lista.h * 0.5 } : { x: 10, y: m.H / 2 };
  await pg.touchscreen.tap(ptFaixa.x, ptFaixa.y);
  await pg.waitForTimeout(500);
  const ficou = await pg.evaluate(() => window.__golaco.estado().menuAberto);
  P.p9.push({ nome: 'tocar no jogo fecha; tocar na faixa vazia (ao lado da lista) não fecha', ok: fechouJogo && ficou, medido: `jogo (${ptJogo.x.toFixed(0)}, ${ptJogo.y.toFixed(0)}) fecha ${fechouJogo}; faixa (${ptFaixa.x.toFixed(0)}, ${ptFaixa.y.toFixed(0)}) fica aberta ${ficou}` });
  // o toque que troca de nível deixa o foco (e o destaque) no que o nível escolhe — o mousedown de compatibilidade que o navegador
  // gera depois do toque, no ponto do dedo, dava o foco ao X (no lugar do ≡) ou a um controle do submenu que ficou embaixo do dedo
  // (revisão do item 58, F4): ≡ → "Voltar ao jogo"; Opções → o escolhido do 1º grupo; o Voltar do submenu → o item "Opções"
  for (const [W, H] of [[844, 390], [568, 320]]) {
    await pg.setViewportSize({ width: W, height: H });
    await pg.waitForTimeout(80);
    await pg.evaluate(() => { window.__golaco.fecharMenu(); document.activeElement?.blur?.(); });
    await quadros(pg, 2);
    const focoAgora = () => pg.evaluate(() => {
      const a = document.activeElement, sel = [...document.querySelectorAll('#menu .selecionado')];
      const nome = !a || a === document.body ? 'BODY' : (a.id || (a.closest('.segmentado') ? `${a.closest('.segmentado').dataset.grupo}:${a.dataset.valor}` : a.dataset?.cmd || a.className));
      const nivel = [...document.querySelectorAll('#menu .menu-acoes')].find(e => !e.hidden && e.getClientRects().length);
      const vis = nivel ? [...nivel.querySelectorAll('button, input[type="range"]')].filter(b => !b.disabled && !b.hidden && b.getClientRects().length && !b.classList.contains('btn-voltar')) : [];
      const esperado = vis.find(b => b.getAttribute('aria-pressed') === 'true') ?? vis[0] ?? null;
      return { nome, destaque: sel.length === 1 && sel[0] === a, esperadoSub: !!esperado && a === esperado, peso: getComputedStyle(document.getElementById('btn-continuar')).fontWeight };
    });
    const tri2 = await centro(pg, '#btn-menu');
    await pg.touchscreen.tap(tri2.x, tri2.y);
    await quadros(pg, 3);
    const f1 = await focoAgora();
    const op = await centro(pg, '#btn-opcoes');
    if (op) await pg.touchscreen.tap(op.x, op.y);
    await quadros(pg, 3);
    const f2 = await focoAgora();
    const vt = await centro(pg, '#menu-opcoes .btn-voltar');
    if (vt) await pg.touchscreen.tap(vt.x, vt.y);
    await quadros(pg, 3);
    const f3 = await focoAgora();
    P.p9.push({ nome: `${W}×${H}: o toque que troca de nível não deixa o foco no que ficou embaixo do dedo`,
      ok: f1.nome === 'btn-continuar' && f1.destaque && f1.peso === '800' && f2.esperadoSub && f2.destaque && f3.nome === 'btn-opcoes' && f3.destaque,
      medido: `≡ → foco ${f1.nome} (destaque ${f1.destaque}, peso ${f1.peso}); Opções → ${f2.nome} (o escolhido ${f2.esperadoSub}, destaque ${f2.destaque}); Voltar → ${f3.nome} (destaque ${f3.destaque})` });
  }
  await pg.evaluate(() => window.__golaco.fecharMenu());
  await pg.setViewportSize({ width: 844, height: 390 });
  await pg.waitForTimeout(80);

  // ---- P4: o campinho em 844×390 e 568×320
  for (const [W, H] of [[844, 390], [568, 320]]) {
    await pg.setViewportSize({ width: W, height: H });
    await pg.waitForTimeout(80);
    await abrirPausa(pg);
    const r = await pg.evaluate(async () => {
      const g = window.__golaco, t = g.pausa?.tela;
      if (!t || !t.visivel) return null;
      const { FORMACOES } = await import(new URL('js/formacoes.js', location.href).href);
      const { fichaDe } = await import(new URL('js/elenco.js', location.href).href);
      const d = g.pausa.dados();
      const vagas = FORMACOES[d.formacao].vagas.map(v => v.id);
      const prob = [];
      if (t.fichas.length !== 11) prob.push(`${t.fichas.length} fichas`);
      if (t.formacao !== d.formacao) prob.push(`cabeçalho "${t.formacao}" × ${d.formacao}`);
      if (JSON.stringify(t.fichas.map(f => f.vaga)) !== JSON.stringify(vagas)) prob.push('ordem das vagas');
      for (const f of t.fichas) {
        const fi = fichaDe(f.id);
        if (!fi) { prob.push(`ficha ${f.vaga} sem jogador`); continue; }
        if (f.num !== String(fi.num)) prob.push(`${f.vaga}: número ${f.num} × ${fi.num}`);
        if (f.nome !== fi.camisa) prob.push(`${f.vaga}: nome "${f.nome}" × "${fi.camisa}"`);
      }
      // em cima/embaixo pela fila (o goleiro na mais baixa) e da esquerda para a direita pelo col
      const cy = f => f.disco.y + f.disco.h / 2, cx = f => f.disco.x + f.disco.w / 2;
      for (const a of t.fichas) for (const b of t.fichas) {
        if (a === b) continue;
        if (a.fila < b.fila && !(cy(a) > cy(b))) prob.push(`${a.vaga} (fila ${a.fila}) não está abaixo de ${b.vaga}`);
        if (a.fila === b.fila && a.col < b.col && !(cx(a) < cx(b))) prob.push(`${a.vaga} não está à esquerda de ${b.vaga}`);
      }
      // sem encostar (≥ 2 px entre as fichas: o disco e o nome)
      const caixas = t.fichas.map(f => [f.disco, f.nomeCaixa].filter(Boolean));
      let enc = 0;
      for (let i = 0; i < caixas.length; i++) for (let k = i + 1; k < caixas.length; k++) for (const A of caixas[i]) for (const B of caixas[k]) {
        const gap = Math.max(B.x - (A.x + A.w), A.x - (B.x + B.w), B.y - (A.y + A.h), A.y - (B.y + B.h));
        if (gap < 2) enc++;
      }
      if (enc) prob.push(`${enc} encostos entre fichas`);
      const letra = Math.min(...t.fichas.map(f => Math.min(f.letra ?? 99, f.letraNum ?? 99)));
      const cortaSemReticencias = t.fichas.filter(f => f.nomeCortado).length && getComputedStyle(document.querySelector('.pt-nm')).textOverflow !== 'ellipsis';
      if (cortaSemReticencias) prob.push('nome cortado sem "…"');
      return { prob, letra, n: t.fichas.length, formacao: t.formacao, cortados: t.fichas.filter(f => f.nomeCortado).length };
    });
    const alvoLetra = W >= 640 ? 11 : 10;
    P.p4.push({ nome: `${W}×${H}: 11 fichas na ordem da formação, número e nome, sem encostar, letra ≥ ${alvoLetra}`, ok: !!r && r.prob.length === 0 && r.letra >= alvoLetra,
      medido: r ? `${r.n} fichas, ${r.formacao}, letra ${r.letra} px, ${r.cortados} nomes com "…"${r.prob.length ? ' — ' + r.prob.slice(0, 4).join('; ') : ''}` : 'sem o campinho' });
  }
  await pg.setViewportSize({ width: 844, height: 390 });
  await pg.waitForTimeout(80);
  // amarelo, entra, você e o expulso (vaga vazia)
  const marcas = await pg.evaluate(async () => {
    const g = window.__golaco;
    g.reiniciar({ modo: 'partida', semente: 9 });
    g.rodarPassos(200, 'demo');
    const ctl = g.estado().controlado;
    g.faltaDeTeste({ cartao: 'amarelo', doMeu: true });
    g.rodarPassos(5, 'demo');
    const amarelado = ctl;
    const t = g.estadoTime?.(0) ?? g.estado().times[0];
    const ed = { tipo: 'editarTime', time: 0, base: t.versao, formacao: t.formacao, vagas: { ...t.vagas, ATA: 22 }, substituicoes: [{ sai: t.vagas.ATA, entra: 22 }], tatica: { ...t.tatica } };
    g.editarTime(ed);
    g.abrirMenu();
    await new Promise(r => setTimeout(r, 200));
    const e1 = g.pausa?.tela;
    const voce = g.estado().controlado;
    const f = id => e1?.fichas.find(x => x.id === id);
    const r = { amarelo: !!f(amarelado)?.amarelo, entra: !!f(22)?.entra, voce: !!f(voce)?.voce, nVoce: e1?.fichas.filter(x => x.voce).length ?? 0 };
    g.fecharMenu();
    g.editarTime(null);
    // o vermelho direto no controlado
    const ctl2 = g.estado().controlado;
    g.faltaDeTeste({ cartao: 'vermelho', doMeu: true });
    g.rodarPassos(5, 'demo');
    g.abrirMenu();
    await new Promise(r => setTimeout(r, 200));
    const e2 = g.pausa?.tela;
    const fx = e2?.fichas.find(x => x.id === ctl2);
    r.expulso = !!fx?.vazia && !fx.nome && !fx.num;
    r.expulsoId = ctl2;
    g.fecharMenu();
    return r;
  }).catch(e => ({ erro: e.message }));
  P.p4.push({ nome: 'o amarelo, o ↑ de quem entra (substituição na fila), o anel de "você" e o expulso como vaga vazia', ok: marcas.amarelo && marcas.entra && marcas.voce && marcas.nVoce === 1 && marcas.expulso,
    medido: marcas.erro ?? `amarelo ${marcas.amarelo}, entra ${marcas.entra}, você ${marcas.voce} (${marcas.nVoce}), expulso vazio ${marcas.expulso}` });
  // tocar no cartão abre o Editar time
  await pg.evaluate(() => window.__golaco.reiniciar({ modo: 'partida', semente: 5 }));
  await pg.evaluate(() => window.__golaco.sobDemanda?.ja?.());
  await pg.waitForFunction(() => window.__golaco.sobDemanda?.estado?.editor, null, { timeout: 30000 }).catch(nada);
  await abrirPausa(pg);
  const c = await centro(pg, '#pausa-time');
  if (c) await pg.touchscreen.tap(c.x, c.y + c.h * 0.25);
  await pg.waitForTimeout(400);
  const editor = await pg.evaluate(() => !!window.__golaco.editor?.aberto);
  P.p4.push({ nome: 'tocar no cartão abre o Editar time (partida)', ok: !!c && editor, medido: c ? `editor ${editor ? 'aberto' : 'fechado'}` : 'sem o cartão' });
  if (editor) { await pg.evaluate(() => window.__golaco.editor.voltar()); await quadros(pg, 3); }

  // ---- P7: o leitor de tela (a árvore de acessibilidade do Playwright)
  await abrirPausa(pg);
  const a1 = await pg.locator('#menu').ariaSnapshot().catch(() => '');
  await pg.evaluate(() => document.getElementById('btn-opcoes')?.click());
  await quadros(pg, 2);
  const a2 = await pg.locator('#menu').ariaSnapshot().catch(() => '');
  await abrirPausa(pg);
  await pg.evaluate(() => document.getElementById('btn-estatisticas')?.click());
  await pg.waitForTimeout(300);
  const a3 = await pg.locator('#menu').ariaSnapshot().catch(() => '');
  const grupos = ['Qualidade', 'Horário', 'Câmera', 'Replays automáticos', 'Som da torcida'];
  const faltam = grupos.filter(gr => !new RegExp(`group "${gr}"`).test(a2));
  const dialogo = /dialog "Pausa: [^"]+"/.test(a1), regiao = /region "[^"]+"/.test(a1), resumo = /Goleiro: \d+ /.test(a1), tabela = /table "Estatísticas da partida"/.test(a3);
  P.p7.push({ ok: dialogo && regiao && resumo && tabela && faltam.length === 0, medido: `diálogo "Pausa: …" ${dialogo}; grupos sem nome: ${faltam.join(', ') || 'nenhum'}; cartão região ${regiao} com resumo ${resumo}; Estatísticas tabela com legenda ${tabela}` });

  // ---- P8: a cara do TM sem ?tm (a Inter TM carregada, a barra verde, o contraste sobre a faixa)
  await abrirPausa(pg);
  const c8 = await pg.evaluate(async () => {
    await document.fonts.ready;
    const b = document.getElementById('btn-continuar');
    b.focus();
    const fam = getComputedStyle(b).fontFamily.split(',')[0].trim().replace(/["']/g, '');
    const barra = getComputedStyle(b, '::before').backgroundColor;
    const txt = getComputedStyle(document.querySelector('#menu-acoes [data-cmd="ajuda"]')).color;
    const fundo = getComputedStyle(document.querySelector('.janela-menu')).backgroundImage;
    return { fam, ok: document.fonts.check('15px "Inter TM"'), barra, txt, fundo };
  });
  const rgb = t => (t.match(/[\d.]+/g) ?? []).map(Number);
  const L = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contraste = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // a faixa (a 1ª cor do degradê) sobre o pior quadro do jogo (branco); o texto com o alfa dele por cima
  const f0 = rgb(c8.fundo.match(/rgba?\([^)]*\)/)?.[0] ?? 'rgb(0,0,0)'), af = f0[3] ?? 1;
  const fundo = [0, 1, 2].map(i => f0[i] * af + 255 * (1 - af));
  const t0 = rgb(c8.txt), at = t0[3] ?? 1;
  const texto = [0, 1, 2].map(i => t0[i] * at + fundo[i] * (1 - at));
  const cTexto = contraste(texto, fundo), cBarra = contraste(rgb(c8.barra), fundo);
  P.p8.push({ ok: c8.fam === 'Inter TM' && c8.ok && /34,\s*197,\s*94/.test(c8.barra) && cTexto >= 4.5 && cBarra >= 3,
    medido: `fonte "${c8.fam}" (carregada ${c8.ok}); barra ${c8.barra}; contraste do texto ${cTexto.toFixed(1)}:1, da barra ${cBarra.toFixed(1)}:1 (faixa sobre branco)` });
  await pg.evaluate(() => window.__golaco.fecharMenu());
}

// ------------------------------------------------------------------ sessão: PC sem toque (1280×720)
async function sessaoPC() {
  const s = await abrir({ largura: PC[0], altura: PC[1], dpr: 1, toque: false });
  const pg = s.pagina, kb = pg.keyboard;
  try {
    await pg.goto(`${srv.url}index.html?${Q}`, { waitUntil: 'load' });
    await pronta(pg);
    await carregarPausa(pg);
    await manual(pg);
    for (const modo of ['partida', 'conducao', 'livre']) {
      if (modo !== 'partida') await trocarModo(pg, modo);
      const r = await medirNiveis(pg);
      P.p1n++;
      const p1 = problemasP1(r.primeiro, ORDEM[modo], { cartao: modo !== 'conducao', pc: true });
      if (p1.length) P.p1.push(`PC ${modo}: ${p1.join('; ')}`);
      conferirNivel(`PC ${modo} 1º`, r.primeiro, true);
      for (const [n, m] of Object.entries(r.subs)) conferirNivel(`PC ${modo} ${n}`, m, true);
      if (modo === 'partida') {
        await abrirPausa(pg);
        const f = await jogoAVista(pg, pg).catch(() => 0);
        P.p3.push({ tela: `${PC[0]}×${PC[1]}`, f, meta: META_P3[PC[0]], ok: f >= META_P3[PC[0]] });
        await pcTeclado(pg, kb);
        await pcEditor(pg);
      }
      // P10 pelo teclado e pelo controle
      await pg.evaluate(l => window.__golaco.secarComandos?.(l), SECOS);
      const so = modo === 'partida' ? ['todos', 'partida'] : modo === 'conducao' ? ['treino', 'conducao'] : ['livre'];
      for (const meio of ['teclado', 'controle']) {
        for (const c of COMANDOS.filter(c => so.includes(c.so))) {
          const r2 = await comandoPorTeclas(pg, kb, c, meio).catch(e => ({ ok: false, motivo: e.message }));
          if (r2 === null) { P.p10.push(`${meio} ${c.nome}: não alcança`); continue; }
          if (!r2.ok) P.p10.push(`${meio} ${c.nome}: não chegou${r2.motivo ? ` (${r2.motivo})` : ''}`);
          P.p10custo.push({ meio, nome: c.nome, n: r2.teclas });
        }
      }
      await pg.evaluate(() => { window.__golaco.secarComandos?.(null); window.__golaco.fecharMenu(); });
    }
    // P1/P2/P6/S5 no PC fora do 16:9, baixo e estreito (o 1º nível com o foco em cada item e todos os submenus), começando no
    // Livre (o modo em que o laço acima termina)
    for (const modo of ['livre', 'conducao', 'partida', 'fim']) {
      if (modo !== 'livre') await trocarModo(pg, modo);
      for (const [W, H] of PC_MAIS) {
        await pg.setViewportSize({ width: W, height: H });
        await pg.waitForTimeout(80);
        const r = await medirNiveis(pg);
        P.p1n++;
        const p1 = problemasP1(r.primeiro, ORDEM[modo], { cartao: modo !== 'conducao', pc: true });
        if (p1.length) P.p1.push(`PC ${modo} ${W}×${H}: ${p1.join('; ')}`);
        conferirNivel(`PC ${modo} ${W}×${H} 1º`, r.primeiro, true);
        for (const [n, m] of Object.entries(r.subs)) conferirNivel(`PC ${modo} ${W}×${H} ${n}`, m, true);
      }
    }
    await pg.setViewportSize({ width: PC[0], height: PC[1] });
  } catch (e) { erros.push(`PC: ${e.stack ?? e}`); }
  finally { erros.push(...s.erros.map(x => `PC: ${x}`)); await s.navegador.close(); }
}

/** P5 no PC: as setas, o Esc por nível, o Tab preso e o inert. */
async function pcTeclado(pg, kb) {
  await pg.evaluate(() => { window.__golaco.fecharMenu(); document.activeElement?.blur?.(); });
  await quadros(pg, 2);
  await kb.press('Escape');
  await quadros(pg, 2);
  const f0 = (await pg.evaluate(FOCO)).id;
  await kb.press('ArrowDown'); await quadros(pg, 1);
  const f1 = (await pg.evaluate(FOCO)).id;
  await kb.press('ArrowUp'); await quadros(pg, 1);
  const f2 = (await pg.evaluate(FOCO)).id;
  const inert = await pg.evaluate(() => ['hud', 'toque', 'cena'].map(id => document.getElementById(id)).every(e => !e || e.inert === true));
  // Opções pelo teclado, Esc volta ao 1º nível com o foco nele, Esc de novo fecha
  for (let k = 0; k < 10 && (await pg.evaluate(FOCO)).id !== 'opcoes'; k++) { await kb.press('ArrowDown'); await quadros(pg, 1); }
  await kb.press('Enter'); await quadros(pg, 2);
  const nivelSub = await pg.evaluate(() => window.__golaco.pausa?.nivel ?? null);
  await kb.press('Escape'); await quadros(pg, 2);
  const depoisEsc = await pg.evaluate(() => ({ aberta: window.__golaco.estado().menuAberto, nivel: window.__golaco.pausa?.nivel ?? null }));
  const fEsc = (await pg.evaluate(FOCO)).id;
  await kb.press('Escape'); await quadros(pg, 2);
  const fechou = !(await pg.evaluate(() => window.__golaco.estado().menuAberto));
  const inertDepois = await pg.evaluate(() => ['hud', 'toque', 'cena'].map(id => document.getElementById(id)).every(e => !e || e.inert !== true));
  // 40 Tabs e 40 Shift+Tabs
  let saiu = 0, saiuTras = 0;
  await kb.press('Escape'); await quadros(pg, 2);
  for (let k = 0; k < 40; k++) { await kb.press('Tab'); if (!(await pg.evaluate(FOCO)).dentro) saiu++; }
  for (let k = 0; k < 40; k++) { await kb.press('Shift+Tab'); if (!(await pg.evaluate(FOCO)).dentro) saiuTras++; }
  await pg.evaluate(() => window.__golaco.fecharMenu());
  P.p5.push({ ok: f0 === 'continuar' && f1 === 'editar-time' && f2 === 'continuar' && nivelSub === 'opcoes' && depoisEsc.aberta && depoisEsc.nivel === 'acoes' && fEsc === 'opcoes' && fechou && saiu === 0 && saiuTras === 0 && inert && inertDepois,
    medido: `foco ${f0} → ↓ ${f1} → ↑ ${f2}; Enter no Opções → ${nivelSub}; Esc → ${depoisEsc.aberta ? depoisEsc.nivel : 'fechou'} (foco ${fEsc}); Esc → ${fechou ? 'fechou' : 'aberta'}; Tab fora ${saiu}/40, Shift+Tab fora ${saiuTras}/40; inert ${inert} (fechada: solto ${inertDepois})` });
}

/** P4 no PC: o Editar time com 4-4-2 → PRONTO → o cartão diz "4-4-2" antes de o jogo voltar. */
async function pcEditor(pg) {
  await pg.evaluate(() => window.__golaco.sobDemanda?.ja?.());
  await pg.waitForFunction(() => window.__golaco.sobDemanda?.estado?.editor, null, { timeout: 30000 }).catch(nada);
  await abrirPausa(pg);
  const antes = await pg.evaluate(() => window.__golaco.pausa?.tela?.formacao ?? null);
  await pg.click('#menu-acoes [data-cmd="editar-time"]').catch(nada);
  await pg.waitForFunction(() => window.__golaco.editor?.aberto, null, { timeout: 8000 }).catch(nada);
  await pg.click('#editar-time [data-aba="formacao"]').catch(nada);
  await pg.click('#editar-time [data-formacao="4-4-2"]').catch(nada);
  await pg.click('#editar-time [data-ed="pronto"]').catch(nada);
  await quadros(pg, 3);
  const r = await pg.evaluate(() => ({ aberta: window.__golaco.estado().menuAberto, forma: window.__golaco.pausa?.tela?.formacao ?? null, mundo: window.__golaco.estado().times?.[0]?.formacao, fichas: window.__golaco.pausa?.tela?.fichas?.map(f => f.vaga).join(',') ?? '' }));
  P.p4.push({ nome: 'Editar time 4-4-2 → PRONTO: o cartão diz "4-4-2" antes de o jogo voltar', ok: r.aberta && r.forma === '4-4-2' && r.mundo !== '4-4-2' && r.fichas.includes('ATE'),
    medido: `antes ${antes}; depois do PRONTO a pausa ${r.aberta ? 'aberta' : 'fechada'}, cartão "${r.forma}", mundo ${r.mundo}` });
  await pg.evaluate(() => { window.__golaco.editarTime(null); window.__golaco.fecharMenu(); });
}

// ------------------------------------------------------------------ sessão: ?tm num quadro com a meta viewport (como o TM)
async function sessaoTM(ped, modo, ordem, telas, opc = {}) {
  const s = await abrir({ largura: telas[0][0], altura: telas[0][1], dpr: 1, toque: !opc.pc });
  let pg = s.pagina;
  const rot = `?tm ${opc.rot ?? modo}`;
  try {
    const url = `index.html?tm=${ped.id}&${Q}${opc.pc ? '' : '&toque=1&entalhe=1'}`;
    const json = JSON.stringify(JSON.stringify(ped)).replace(/</g, '\\u003c');
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>TM</title></head><body style="margin:0;background:#000"><script>
localStorage.setItem('tm3d:pedido:' + ${JSON.stringify(ped.id)}, ${json});
localStorage.removeItem('tm3d:resultado:' + ${JSON.stringify(ped.id)});
const f = document.createElement('iframe'); f.id = 'q'; f.src = ${JSON.stringify(url)};
f.allow = 'fullscreen; autoplay; gamepad'; f.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
document.body.appendChild(f);
</script></body></html>`;
    const u = `${srv.url}__quadro-${ped.id}.html`;
    await s.contexto.route(u, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    await s.pagina.goto(u, { waitUntil: 'load' });
    let fr = null;
    for (let i = 0; i < 400 && !fr; i++) { fr = s.pagina.frames().find(f => /[?&]tm=/.test(f.url())); if (!fr) await s.pagina.waitForTimeout(50); }
    if (!fr) throw new Error('o quadro do jogo não abriu');
    pg = fr;
    await pronta(pg);
    await carregarPausa(pg);
    // o fim da partida do TM: o "Voltar ao Total Match" sobe para o 1º lugar com o foco (o item mais longo da lista)
    if (opc.fim) await trocarModo(pg, 'fim');
    if (modo === 'livre') {
      await pg.waitForFunction(() => !!document.getElementById('btn-livre-jogar'), null, { timeout: 60000 }).catch(nada);
      await pg.evaluate(() => { const b = document.getElementById('btn-livre-jogar'); if (b && b.offsetParent !== null) b.click(); });
    }
    for (const [W, H] of telas) {
      await s.pagina.setViewportSize({ width: W, height: H });
      await s.pagina.waitForTimeout(120);
      const r = await medirNiveis(pg);
      if (r.primeiro.W !== W) erros.push(`${rot}: o quadro mede ${r.primeiro.W} px, não ${W}`);
      P.p1n++;
      const p1 = problemasP1(r.primeiro, ordem, { cartao: modo !== 'penaltis', pc: !!opc.pc });
      if (p1.length) P.p1.push(`${rot} ${W}×${H}: ${p1.join('; ')}`);
      conferirNivel(`${rot} ${W}×${H} 1º`, r.primeiro, !!opc.pc);
      for (const [n, m] of Object.entries(r.subs)) conferirNivel(`${rot} ${W}×${H} ${n}`, m, !!opc.pc);
    }
    if (opc.trava) {
      await abrirPausa(pg);
      const c = await centro(pg, '#pausa-time');
      const ed = await pg.evaluate(() => document.getElementById('pausa-time')?.dataset.editavel ?? null);
      if (c) await s.pagina.touchscreen.tap(c.x, c.y + c.h * 0.25).catch(nada);
      await s.pagina.waitForTimeout(400);
      const aberto = await pg.evaluate(() => !!window.__golaco.editor?.aberto);
      P.p4.push({ nome: '?tm com a trava (Rumo ao Estrelato): o cartão aparece e não abre o editor', ok: !!c && ed === '0' && !aberto, medido: c ? `editável ${ed}, editor ${aberto ? 'aberto' : 'fechado'}` : 'sem o cartão' });
    }
    if (modo === 'partida' && !opc.trava && !opc.pc) {
      // a competição do pedido no topo da faixa
      const comp = await pg.evaluate(() => ({ t: document.getElementById('pausa-competicao')?.textContent ?? null, e: window.__golaco.pausa?.competicao?.() ?? null }));
      if (!comp.t || comp.t !== comp.e) P.p1.push(`${rot}: competição "${comp.t}" (esperada "${comp.e}")`);
    }
  } catch (e) { erros.push(`${rot}: ${e.stack ?? e}`); }
  finally { erros.push(...s.erros.map(x => `${rot}: ${x}`)); await s.navegador.close(); }
}

// ------------------------------------------------------------------ sessão: online 1×1 (duas abas pelo BroadcastChannel)
async function sessaoOnline() {
  const s = await abrir({ largura: 844, altura: 390, dpr: 1, toque: true });
  const sala = 'pausa' + Date.now();
  const q = lado => `${srv.url}index.html?online=${sala}&transporte=bc&lado=${lado}&ia=1&semente=7&q=baixa&replay=0&comemoracao=0&prejogo=0&D=4&toque=1&entalhe=1`;
  const A = s.pagina, B = await s.contexto.newPage();
  B.on('pageerror', e => s.erros.push(String(e)));
  try {
    await Promise.all([A.goto(q(0), { waitUntil: 'load' }), B.goto(q(1), { waitUntil: 'load' })]);
    await Promise.all([A, B].map(p => p.waitForFunction(() => window.__golaco && window.__golaco.pronto && window.__golaco.online, null, { timeout: 240000 })));
    await carregarPausa(B);
    // (também no PC: o online do TM roda no computador; o "Sair" armado — o 1º toque — é o texto mais longo da lista dele)
    for (const [W, H] of [[844, 390], [667, 375], [640, 360], [568, 320], [1280, 720], [1024, 768]]) {
      const pc = H > 480;
      await B.setViewportSize({ width: W, height: H });
      await B.waitForTimeout(150);
      // (com a pausa fechada o selo fica dentro da área segura: --sa-r/--sa-t, o entalhe simulado)
      const seloFora = await B.evaluate(() => {
        const s = document.getElementById('online-selo');
        if (!s) return null;
        const era = s.hidden, txt = s.textContent;
        s.hidden = false; s.textContent = 'Conexão instável';
        const r = s.getBoundingClientRect(), cs = getComputedStyle(document.documentElement);
        s.hidden = era; s.textContent = txt;
        const sr = parseFloat(cs.getPropertyValue('--sa-r')) || 0, st = parseFloat(cs.getPropertyValue('--sa-t')) || 0;
        return r.right > innerWidth - sr + 0.5 || r.top < st - 0.5 ? `x ${r.left.toFixed(0)}–${r.right.toFixed(0)} (área útil até ${innerWidth - sr})` : null;
      });
      await B.evaluate(() => window.__golaco.abrirMenu());
      await quadros(B, 2);
      const m = await B.evaluate(MEDIR);
      m.foco = await B.evaluate(FOCO_LARGURA);
      // o 1º clique no Sair só arma a confirmação (3 s); a medida é com o texto armado e a espera deixa ele desarmar
      const armado = await B.evaluate(() => { const b = document.getElementById('btn-online-sair'); b?.click(); return (b?.querySelector('.item-txt') ?? b?.firstChild)?.textContent ?? ''; });
      const fArmado = (await B.evaluate(FOCO_LARGURA)).filter(x => x.id === 'btn-online-sair').map(x => ({ ...x, id: `Sair armado "${armado.trim()}"` }));
      m.foco.push(...fArmado);
      P.p1n++;
      const p1 = problemasP1(m, ORDEM.online, { cartao: true, pc });
      // o selo "Conexão instável" (online-pagina.js) com a pausa aberta: não fica por cima do X, da pílula nem do cartão (antes ele
      // ia para o canto do ≡, onde agora mora o X — revisão do item 58, F5); o estado instável é forçado só no instante da medida
      const selo = await B.evaluate(() => {
        const s = document.getElementById('online-selo');
        if (!s) return { falta: true };
        const era = s.hidden, txt = s.textContent;
        s.hidden = false; s.textContent = 'Conexão instável';
        const r = s.getBoundingClientRect(), vis = r.width > 0 && getComputedStyle(s).display !== 'none' && getComputedStyle(s).visibility !== 'hidden';
        s.hidden = era; s.textContent = txt;
        if (!vis) return { vis };
        const enc = ['#menu .pausa-topo-dir .btn-fechar', '#pausa-placar', '#pausa-time'].map(q => document.querySelector(q)).filter(e => e && e.getClientRects().length)
          .filter(e => { const q = e.getBoundingClientRect(); return r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom; }).map(e => e.id || e.className);
        return { vis, enc };
      });
      if (seloFora) p1.push(`o selo "Conexão instável" fora da área segura com a pausa fechada: ${seloFora}`);
      if (selo.falta) p1.push('sem o selo do online');
      else if (selo.vis && selo.enc.length) p1.push(`o selo "Conexão instável" por cima de ${selo.enc.join(', ')}`);
      if (p1.length) P.p1.push(`online ${W}×${H}: ${p1.join('; ')}`);
      conferirNivel(`online ${W}×${H} 1º`, m, pc);
      await B.waitForTimeout(3300);
      await B.evaluate(() => window.__golaco.fecharMenu());
    }
    // a vazão do lockstep entre duas abas varia com a carga da máquina (45 passos em 3 s sozinho, 10–26 com outro teste rodando):
    // a meta compara a mesma janela com a pausa fechada logo antes — com ela aberta o jogo anda (≥ 40% e ≥ 1 passo)
    const nF0 = await B.evaluate(() => window.__golaco.online.n);
    await B.waitForTimeout(3000);
    const n0 = await B.evaluate(() => window.__golaco.online.n);
    await B.evaluate(() => window.__golaco.abrirMenu());
    await B.waitForTimeout(3000);
    const n1 = await B.evaluate(() => window.__golaco.online.n);
    await B.evaluate(() => window.__golaco.fecharMenu());
    const fechada = n0 - nF0, aberta = n1 - n0;
    P.s1.push(`online: ${aberta} passos em 3 s com a pausa aberta (${fechada} fechada)`);
    // (de propósito: no online a IA joga pelo meu controlado e o outro lado não espera)
    if (aberta < 1 || aberta < 0.4 * fechada) P.s1.push('FALHA online (o jogo devia andar)');
  } catch (e) { erros.push(`online: ${e.stack ?? e}`); }
  finally { erros.push(...s.erros.map(x => `online: ${x}`)); await s.navegador.close(); }
}

// ------------------------------------------------------------------ as sessões
const t0 = Date.now();
if (!SO || SO === 'cel') await sessaoCelular();
if (!SO || SO === 'pc') await sessaoPC();
if (!SO || SO === 'tm') {
  const PED_L = { ...PED_A, id: 'pL', modo: 'livre', livre: { linha: [5, 5], goleiro: [true, true] } };
  const PED_P = { ...PED_A, id: 'pP', modo: 'penaltis' };
  await sessaoTM(PED_A, 'partida', ORDEM.tmPartida, CEL, { rot: 'partida' });
  const PC_TM = [PC, [1024, 768], [1280, 1024], [1440, 900], [1280, 800], [800, 600]];
  await sessaoTM(PED_A, 'partida', ORDEM.tmPartida, PC_TM, { rot: 'partida PC', pc: true });
  await sessaoTM(PED_A, 'partida', ORDEM.tmFim, PC_TM, { rot: 'fim PC', pc: true, fim: true });
  await sessaoTM(PED_B, 'partida', ORDEM.tmTrava, [[844, 390], [568, 320]], { rot: 'trava', trava: true });
  await sessaoTM(PED_L, 'livre', ORDEM.tmLivre, [[844, 390], [568, 320]], { rot: 'Livre' });
  await sessaoTM(PED_P, 'penaltis', ORDEM.tmPenaltis, [[844, 390], [568, 320]], { rot: 'Pênaltis' });
}
if (!SO || SO === 'online') await sessaoOnline();
await srv.fechar();

// ------------------------------------------------------------------ as metas
console.log('');
const lista = (l, n = 8) => (l.length ? l.slice(0, n).join(' | ') + (l.length > n ? ` (+${l.length - n})` : '') : 'nenhum');
if (P.p1n) meta('P1 a lista à esquerda (uma coluna, na ordem do FC 24 por modo) e o cartão do time à direita; folgas ≥ 8 px, ≥ 2 px entre os botões, nada cortado nem fora da área segura',
  `${P.p1n} telas; problemas: ${lista(P.p1, 6)}`, 'nenhum', P.p1.length === 0);
if (P.p2n) meta('P2 sem rolar em todos os níveis × modos × telas (844, 667, 640, 568 com entalhe; 1280×720)', `${P.p2n} medidas; rolam: ${lista(P.p2)}`, 'nenhuma rola', P.p2.length === 0);
if (P.p3.length) meta('P3 o jogo à vista pelo print (luminância com a pausa ≥ 60% da sem ela; pixels com ≥ 25/255)', P.p3.map(x => `${x.tela} ${(x.f * 100).toFixed(1)}% (≥ ${Math.round(x.meta * 100)})`).join('; '), '≥ 40% PC, 25% 844, 17% 667/640, 14% 568', P.p3.every(x => x.ok));
if (P.p4.length) meta('P4 o campinho do meu time (fichas, ordem, nomes, marcas, o editor pelo cartão, por modo)', P.p4.map(x => `${x.ok ? 'ok' : 'FALHA'} ${x.nome}: ${x.medido}`).join(' | '), 'todos ok', P.p4.every(x => x.ok));
if (P.p5.length) meta('P5 teclado: ↓/↑ andam, Esc volta um nível (o foco no item que abriu) e depois fecha, Tab preso, fundo inert', P.p5.map(x => x.medido).join(' | '), 'tudo certo', P.p5.every(x => x.ok));
if (P.p6n) meta('P6 alvos ≥ 44 × 32 px no celular (28 em 568×320) e altura ≥ 32 no PC', `${P.p6n} medidas; pequenos: ${lista(P.p6, 6)}`, 'nenhum', P.p6.length === 0);
if (P.p7.length) meta('P7 leitor de tela: "Pausa: …", grupos das Opções com nome, o cartão como região com resumo, Estatísticas em tabela', P.p7.map(x => x.medido).join(' | '), 'tudo certo', P.p7.every(x => x.ok));
if (P.p8.length) meta('P8 a cara do TM sem ?tm (Inter TM carregada, barra #22c55e, contraste ≥ 4,5:1 e ≥ 3:1)', P.p8.map(x => x.medido).join(' | '), 'tudo certo', P.p8.every(x => x.ok));
if (P.p9.length) meta('P9 o toque: o X no lugar do ≡ fecha e não reabre; tocar no jogo fecha; a faixa vazia não', P.p9.map(x => `${x.ok ? 'ok' : 'FALHA'} ${x.nome}: ${x.medido}`).join(' | '), 'tudo certo', P.p9.every(x => x.ok));
if (P.p10custo.length || P.p10.length) {
  const custo = (meio, nome) => P.p10custo.find(x => x.meio === meio && x.nome === nome)?.n ?? null;
  const v = { tq: custo('toque', 'Voltar ao jogo'), te: custo('teclado', 'Voltar ao jogo'), co: custo('controle', 'Voltar ao jogo') };
  const e = { tq: custo('toque', 'Editar time'), te: custo('teclado', 'Editar time'), co: custo('controle', 'Editar time') };
  const okCusto = (SO && SO !== 'cel' ? true : v.tq != null && v.tq <= 2 && e.tq != null && e.tq <= 2) && (SO && SO !== 'pc' ? true : v.te != null && v.te <= 2 && v.co != null && v.co <= 2 && e.te != null && e.te <= 3 && e.co != null && e.co <= 3);
  meta('P10 todo comando pelos 3 meios (toque; teclado só com setas + Enter; controle pelas ações menu-*) chega ao comando(); Voltar ao jogo ≤ 2, Editar time ≤ 2 toques e ≤ 3 teclas/apertos',
    `falhas: ${lista(P.p10, 6)}; Voltar ao jogo ${v.tq}/${v.te}/${v.co}, Editar time ${e.tq}/${e.te}/${e.co} (toque/teclado/controle)`, 'nenhuma falha; custos no limite', P.p10.length === 0 && okCusto);
  const nomes = [...new Set(P.p10custo.map(x => x.nome))];
  console.log('          custos (toques / teclas / apertos do controle, a partir do jogo):');
  for (const n of nomes) console.log(`            ${n}: ${custo('toque', n) ?? '-'} / ${custo('teclado', n) ?? '-'} / ${custo('controle', n) ?? '-'}`);
}
if (P.s1.length) meta('S1 o mundo parado com a pausa aberta (0/60 passos; 10/10 fechada); no online o jogo anda', P.s1.join('; '), '0/10 fora do online', !P.s1.some(x => x.startsWith('FALHA')));
if (P.s5n) meta('S5 a menor letra da pausa ≥ 11 px (o campinho ≥ 10 em 568×320, ≥ 11 a partir de 640)', `${P.s5n} medidas; abaixo: ${lista(P.s5)}`, 'nenhuma', P.s5.length === 0);
meta('S2 0 erros no console', erros.length ? erros.slice(0, 4).join(' | ') : '0', '0', erros.length === 0);
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s; raiz ${RAIZ})`);
const ok = res.every(r => r.ok);
console.log(ok ? 'teste-pausa-tela: PASSOU' : 'teste-pausa-tela: REPROVOU');
process.exit(ok ? 0 : 1);
