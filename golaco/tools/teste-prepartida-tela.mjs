// A TELA ANTES DO JOGO no navegador (item 64; dono, 23/10: "quero que fique NESSE NÍVEL" — a pré-partida do EA FC com a cara do
// TM; contrato "Tela antes do jogo (item 64)" no CONTRATOS.md). Chromium pelo Playwright, `?prepartida=1` (com webdriver ela fica
// desligada sem o parâmetro). Na base 30ce999f tudo reprova (não há tela); os itens com * reprovam também pelo comportamento.
//   E1  liga/desliga: aparece na partida, no TM (público e o Rumo ao Estrelato), no Livre e nos Pênaltis; não nos treinos; com
//       webdriver sem o parâmetro, com ?prepartida=0, ?prints=1 e ?demo=1 nenhum #prepartida e o começo de hoje
//   E2* a simulação parada: 10 s de relógio com a tela (partida com e sem o pré-jogo, Livre, Pênaltis — na base os Pênaltis andam):
//       tick 0, 0 passos, o hash = o do Node (criarPartida/criarLivre/criarDisputa); depois do Jogar, 600 passos = Node
//   E3  sem rolar e E4 nada encosta: 4 telas do celular (com o entalhe) e 6 do PC × a escalação, o adversário e as duas vistas
//       (as fichas, os discos, a barra, a competição, o ≡, a info, os cantos, as abas; dentro da tela e da área segura); também
//       com as fontes BLOQUEADAS (a letra do sistema); E4b os Pênaltis e o TM pro com o clássico e o estádio longos no celular (a
//       info nunca cortada pelo CSS: revisão A3)
//   E5  a letra: nome ≥ 10 px (568×320), ≥ 11 (outros celulares), ≥ 13 (PC ≥ 720); info ≥ 11; abas ≥ 13; o resto ≥ 11/12
//   E6  os alvos: abas ≥ 177 × 40 (568), ≥ 200 × 44 (640+); ≡ ≥ 34/40/44; os times ≥ 30 × 56 (568) e 36 × 64; nada sob o entalhe
//   E7* toques até o jogo: partida com o pré-jogo 2 (Jogar + Pular); sem pré-jogo 1 → o apito; Pênaltis 1; o requestFullscreen
//       chamado DENTRO do handler do Jogar (toque)
//   E9  o som: o toque no Jogar liga o contexto em ≤ 1 s; o apito só depois
//   E10* teclado: o foco inicial no Jogar; ←/→; 40 Tabs presos; Enter na Visão tática e no Personalizar NÃO começa; Esc e P nunca
//       levam ao jogo (na base, Esc no pré-jogo = o jogo); Q/E trocam o time; o ≡ abre a pausa "antes do jogo" e volta à tela
//   E11* controle (getGamepads falso): a cruz anda; Ⓐ na Visão tática não começa; Ⓑ volta; Ⓨ abre o Personalizar; LB/RB; Start = ≡
//   E11b* com o pré-jogo: o Ⓐ segurado 6 quadros no Jogar começa as cenas do 1º plano (não pula o bloco; revisão A1)
//   E12 leitor de tela: o diálogo com nome e aria-modal; a barra de ferramentas; a lista com a nota; o fundo inert
//   E13* Personalizar: abre o editor "antes do jogo"; o PRONTO volta à tela no Personalizar; a escalação (9 → 22, 1 → 12, 4-4-2)
//       sem substituição (feitas 0, saiu vazio), o reserva na ficha, o hash = Node criarPartida({times}); com o pré-jogo, o reserva
//       no cortejo e o lado de fora NÃO remontado
//   E14 por modo: TM "Simular partida" só no 2º toque → tm3d:fim com o resultado do motor 3D; Rumo ao Estrelato sem Personalizar,
//       com "VOCÊ"; Livre: Jogadores volta à tela e o N contra M aparece; Pênaltis: a fila e a disputa só anda depois do Bater;
//       Pênaltis 3D do TM: o [<] "Voltar ao Total Match" antes do Bater volta SEM resultado (tm3d:sair; revisão A2)
//   E15 desenho (celular Média): ≤ 40 chamadas e ≤ 130 mil triângulos com a tela; ≤ 31 desenhos 3D por segundo
//   E16 download: os bytes até +2,5 s com a tela ≤ os sem ela + 140 KB; a TM Cond só com a tela
//   E17 contraste: a luminância (mediana) atrás da info e da barra ≤ 50/255, de dia e de noite, nos dois fundos
//   E18 em pé: o #girar cobre, o fundo para; deitado de novo, o mesmo foco
//   E19 voltas: "Jogar de novo" mostra a tela; "Reiniciar partida" no meio não; a troca de modo mostra a do modo novo; o
//       "Pré-jogo da partida" mudado pelo ≡ vale no Jogar (desligado = o apito)
//   E20 as proporções do FC 24 no PC 16:9 (±1,5 ponto)
//   E21 a reserva: com o módulo bloqueado, a abertura de texto de hoje (e o jogo começa como hoje)
//   Online (§8.3; duas abas do mesmo Chromium pelo BroadcastChannel, ?online=<sala>&transporte=bc&lado=0|1&ia=1&D=4):
//   O1* A pronto e B na tela: nenhum passo nos dois, nenhum "A conexão parou" nem W.O.; A diz "Aguardando {B}…"
//   O2  B pronto: os dois saem em ≤ 0,5 s; os hashes iguais em todos os HASH_CADA até 1200 passos
//   O3  antes do Pronto, A troca o time mostrado, a vista e as Opções (qualidade, horário): hashes iguais, nenhum "Pausado por"
//   O4  A pula o pré-jogo e B assiste: A parado em n = D com "{B} ainda está no pré-jogo"
//   O5  B na tela enquanto A espera (padrão 10 s; --espera 100 = os 100 s da especificação): nenhum W.O. oferecido
//   O6  sem Personalizar no online (nem o Y, nem o toque no campinho); "Sair da partida" só no 2º toque → o outro recebe o abandono
//   O7  20% dos pacotes do jogo descartados de propósito: a saída conjunta em ≤ 1 s
//   node tools/teste-prepartida-tela.mjs [--raiz <pasta golaco>] [--so pc,cel,telas,modos,pad,tm,online,carga] [--espera <s>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ as RAIZ_PADRAO } from './lib/navegador.mjs';
import { PED_A, PED_B } from './lib/pedidos-tm.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RAIZ = path.resolve(arg('--raiz', RAIZ_PADRAO));
const SO = arg('--so', null)?.split(',') ?? null;
const faz = s => !SO || SO.includes(s);
const imp = f => import(pathToFileURL(path.join(RAIZ, 'js', f)).href);
const { criarPartida, passoPartida } = await imp('partida.js');
const { hashMundo } = await imp('sim.js');
const { BOTAO } = await imp('config.js');
const { criarLivre } = await imp('livre.js');
const { criarDisputa } = await imp('disputa.js');
const hexa = h => (h >>> 0).toString(16).padStart(8, '0');
const res = [];
const meta = (nome, medido, alvo, ok) => { res.push({ nome, medido, alvo, ok: !!ok }); console.log(`${ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome}\n          ${medido}  (alvo: ${alvo})`); };
const srv = await servidor(0, RAIZ);
const Q = 'q=baixa&replay=0&comemoracao=0&replayParada=0&cenas=0';

// o roteiro de 600 passos depois do Jogar (o mesmo nos dois motores; o do teste-prejogo)
function roteiro(n) {
  const r = [];
  for (let i = 0; i < n; i++) {
    const a = 0.8 * Math.sin(i / 40);
    r.push({ x: Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, botoes: (i >= 90 && i < 170 ? BOTAO.CORRER : 0) | (i >= 260 && i < 280 ? BOTAO.PASSE : 0) | (i >= 420 && i < 445 ? BOTAO.CHUTE : 0) });
  }
  return r;
}
function hashNode(m, n) {
  const h0 = hashMundo(m);
  for (const e of roteiro(n)) {
    const t = { 0: { x: e.x, z: e.z, botoes: e.botoes } };
    Object.defineProperties(t, { x: { value: e.x }, z: { value: e.z }, botoes: { value: e.botoes } });
    passoPartida(m, t, null);
  }
  return { h0, h: hashMundo(m) };
}

// ------------------------------------------------------------------------------------------------ ajudantes da página
async function abrirPagina(o) {
  const ctx = await abrir({ largura: o.w, altura: o.h, toque: !!o.toque, dpr: o.toque ? 2 : 1 });
  if (o.pedido) await ctx.contexto.addInitScript(([id, json]) => { try { localStorage.setItem('tm3d:pedido:' + id, json); } catch (_) { /* */ } }, [o.pedido.id, JSON.stringify(o.pedido)]);
  if (o.bloquear) await ctx.contexto.route(o.bloquear, r => r.abort());
  if (o.semFontes) await ctx.contexto.route(/\.woff2(\?|$)/, r => r.abort());
  if (o.espiar) await ctx.contexto.addInitScript(() => {
    window.__telaCheia = [];
    const orig = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function (...a) { window.__telaCheia.push({ ativo: navigator.userActivation ? navigator.userActivation.isActive : null }); return orig ? orig.apply(this, a).catch(() => {}) : Promise.resolve(); };
  });
  const t0 = Date.now();
  await ctx.pagina.goto(srv.url + '?' + o.q + (o.toque ? '&toque=1&entalhe=1' : ''));
  await ctx.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
  ctx.tPronto = (Date.now() - t0) / 1000;
  return ctx;
}
// (com teto de 10 s: numa aba sem quadros — escondida — o teste segue e a meta reprova, em vez de ficar parado)
const quadros = (pg, n = 2) => pg.evaluate(n => new Promise(ok => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); setTimeout(ok, 10000); }), n);
const temTela = pg => pg.evaluate(() => !!window.__golaco?.prepartida?.aberta).catch(() => false);
/** Avança o relógio manual (ms em quadros de 1000/hz). */
const avancar = (pg, ms, hz = 60) => pg.evaluate(([ms, hz]) => { const g = window.__golaco; const n = Math.round(ms * hz / 1000); for (let i = 0; i < n; i++) g.relogio.avancar(1000 / hz, { desenhar: false }); return g.mundo.tick; }, [ms, hz]);
const estado = pg => pg.evaluate(() => { const g = window.__golaco; return { pp: g.prepartida?.estado ?? null, aberta: !!g.prepartida?.aberta, tick: g.mundo.tick, passos: g.passos, menu: g.estado().menuAberto, editor: g.editor.aberto, pre: g.prejogo ? { ativo: g.prejogo.ativo, fase: g.prejogo.fase, bloco: g.prejogo.bloco } : null, foco: document.activeElement?.closest?.('#prepartida') ? (document.activeElement.dataset.aba ?? document.activeElement.dataset.pp ?? 'outro') : (document.activeElement?.id || document.activeElement?.tagName) }; });
const tecla = async (pg, k, n = 1) => { for (let i = 0; i < n; i++) await pg.keyboard.press(k); await quadros(pg, 1); };

/** A régua da tela (na página): rolagem, encostos, cortes, área segura, letras, alvos. */
const MEDIR = () => {
  const R = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const raiz = document.getElementById('prepartida');
  if (!raiz || raiz.hidden) return null;
  // (as animações de entrada acabadas: mede o lugar final)
  for (const a of document.getAnimations?.() ?? []) { try { if (raiz.contains(a.effect?.target)) a.finish(); } catch (_) { /* infinita */ } }
  const W = innerWidth, H = innerHeight;
  const de = document.documentElement;
  const rolagem = Math.max(de.scrollWidth - W, de.scrollHeight - H, document.body.scrollWidth - W, document.body.scrollHeight - H, 0);
  const s = document.createElement('i');
  s.style.cssText = 'position:fixed;padding:var(--sa-t,0px) var(--sa-r,0px) var(--sa-b,0px) var(--sa-l,0px)';
  document.body.appendChild(s);
  const cs = getComputedStyle(s);
  const sa = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
  s.remove();
  const sob = (a, b, fx, fy) => a.x < b.r + fx - 0.01 && b.x < a.r + fx - 0.01 && a.y < b.b + fy - 0.01 && b.y < a.b + fy - 0.01;
  const prob = [];
  const fichas = [...raiz.querySelectorAll('.pp-ficha')].map(f => {
    const c = R(f.querySelector('.pp-cab')), n = f.querySelector('.pp-nome'), b = R(n);
    return { v: f.dataset.vaga, x: Math.min(c.x, b.x), r: Math.max(c.r, b.r), y: c.y, b: b.b, cortado: n.scrollWidth > n.clientWidth + 0.5, letra: parseFloat(getComputedStyle(n).fontSize), nome: n.textContent };
  });
  for (let i = 0; i < fichas.length; i++) for (let j = i + 1; j < fichas.length; j++) if (sob(fichas[i], fichas[j], 3, 2)) prob.push(`ficha ${fichas[i].v}×${fichas[j].v}`);
  const discos = [...raiz.querySelectorAll('.pp-disco')].map(d => ({ v: d.dataset.vaga, ...R(d), letra: parseFloat(getComputedStyle(d.querySelector('b')).fontSize) }));
  for (let i = 0; i < discos.length; i++) for (let j = i + 1; j < discos.length; j++) {
    const a = discos[i], b = discos[j];
    if (Math.hypot((a.x + a.r) / 2 - (b.x + b.r) / 2, (a.y + a.b) / 2 - (b.y + b.b) / 2) < (a.w + b.w) / 2 + 1 - 0.01) prob.push(`disco ${a.v}×${b.v}`);
  }
  const q = sel => { const e = raiz.querySelector(sel); return e && e.getClientRects().length ? R(e) : null; };
  const pecas = { barra: q('.pp-barra'), comp: q('.pp-comp'), menu: q('[data-pp="menu"]'), canto: q('[data-pp="canto"]'), info: q('#pp-info'), campo: q('.pp-gramado'), abas: q('.pp-abas'), esq: q('.pp-canto-esq'), dir: q('.pp-canto-dir'), cmd: q('.pp-cmd') };
  // a competição: o texto (não a caixa inteira) — a caixa vai até a borda no PC
  const compTxt = raiz.querySelector('.pp-comp-txt');
  if (compTxt) { const r = R(compTxt); const ic = R(raiz.querySelector('.pp-comp svg')); pecas.comp = { x: ic.x, r: r.r, y: Math.min(ic.y, r.y), b: Math.max(ic.b, r.b) }; }
  const pares = [['comp', 'barra'], ['menu', 'barra'], ['canto', 'barra'], ['canto', 'comp'], ['menu', 'comp'], ['barra', 'info'], ['info', 'abas'], ['campo', 'abas'], ['abas', 'cmd'], ['esq', 'abas'], ['dir', 'abas'], ['esq', 'dir'], ['info', 'menu'], ['info', 'canto']];
  for (const [a, b] of pares) if (pecas[a] && pecas[b] && sob(pecas[a], pecas[b], 1, 1)) prob.push(`${a}×${b}`);
  const cantosTxt = [...raiz.querySelectorAll('.pp-canto-esq > *, .pp-canto-dir > *')].map(R).filter(r => r.w > 0);
  for (const k of cantosTxt) for (const f of fichas) if (sob(k, f, 3, 1)) prob.push(`canto×${f.v}`);
  // a info cortada pelo CSS (o corte por prioridade evita: só pode o estádio com "…" da conta)
  for (const l of raiz.querySelectorAll('.pp-info-l')) if (l.scrollWidth > l.clientWidth + 1) prob.push('info cortada pelo CSS');
  // dentro da tela; os interativos fora do entalhe
  for (const [k, r] of Object.entries(pecas)) if (r && (r.x < -0.5 || r.y < -0.5 || r.r > W + 0.5 || r.b > H + 0.5)) prob.push(`${k} fora da tela`);
  const inter = [...raiz.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => ({ c: b.className.split(' ')[0], ...R(b) }));
  for (const b of inter) if (b.x < sa.l - 0.5 || b.r > W - sa.r + 0.5 || b.b > H - sa.b + 0.5) prob.push(`${b.c} sob a área insegura`);
  for (const f of fichas) if (f.x < sa.l - 0.5 || f.r > W - sa.r + 0.5) prob.push(`ficha ${f.v} sob o entalhe`);
  // letras (com texto visível)
  let menorNome = Infinity, menorInfo = Infinity, menorAba = Infinity, menorResto = Infinity;
  for (const f of fichas) menorNome = Math.min(menorNome, f.letra);
  for (const e of raiz.querySelectorAll('#pp-info')) if (e.getClientRects().length) menorInfo = Math.min(menorInfo, parseFloat(getComputedStyle(e).fontSize));
  for (const e of raiz.querySelectorAll('.pp-aba-txt')) menorAba = Math.min(menorAba, parseFloat(getComputedStyle(e).fontSize));
  for (const e of raiz.querySelectorAll('.pp-comp-txt, .pp-hora, .pp-forma, .pp-selo, .pp-geral, .pp-tnome b, .pp-tnome i, .pp-cmd span')) if (e.getClientRects().length) menorResto = Math.min(menorResto, parseFloat(getComputedStyle(e).fontSize));
  const abas = [...raiz.querySelectorAll('.pp-aba')].map(R);
  const times = [...raiz.querySelectorAll('.pp-time')].map(R);
  return {
    W, H, sa, rolagem, prob, nFichas: fichas.length, nDiscos: discos.length, cortados: fichas.filter(f => f.cortado).map(f => f.nome),
    letras: { nome: menorNome, info: menorInfo, aba: menorAba, resto: menorResto, disco: discos.length ? Math.min(...discos.map(d => d.letra)) : null },
    alvos: { aba: abas.length ? { w: Math.min(...abas.map(a => a.w)), h: Math.min(...abas.map(a => a.h)) } : null, menu: pecas.menu ? { w: pecas.menu.w, h: pecas.menu.h } : null, time: times.length ? { w: Math.min(...times.map(a => a.w)), h: Math.min(...times.map(a => a.h)) } : null },
    pecas,
  };
};

// ================================================================================================ PC: a partida, o teclado, o Personalizar
if (faz('pc')) {
  const SEM = 3;
  const { navegador, pagina: pg, erros } = await abrirPagina({ w: 1280, h: 720, q: `${Q}&prepartida=1&semente=${SEM}` });
  try {
    const tem = await temTela(pg);
    meta('E1 a tela na partida (?prepartida=1, PC)', tem ? JSON.stringify(await pg.evaluate(() => { const e = window.__golaco.prepartida.estado; return { modo: e.modo, fundo: e.fundo, abas: e.abas }; })) : 'sem tela (#prepartida não existe)', 'aberta, partida, fundo jogo, 3 abas', tem);
    if (tem) {
      await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
      const d0 = await pg.evaluate(() => window.__golaco.prepartida.desenhos);
      const t = await avancar(pg, 10000, 60);
      const d1 = await pg.evaluate(() => window.__golaco.prepartida.desenhos);
      const st = await estado(pg);
      const hP = await pg.evaluate(() => window.__golaco.hash());
      const node = hashNode(criarPartida({ semente: SEM }), 0);
      meta('E2* a simulação parada com a tela (partida sem pré-jogo): 10 s de relógio', `tick ${t}, passos ${st.passos}; hash ${hexa(hP)} × Node ${hexa(node.h0)}; ${((d1 - d0) / 10).toFixed(1)} desenhos 3D/s`, 'tick 0, 0 passos, iguais, ≤ 31/s', t === 0 && st.passos === 0 && hP === node.h0 && (d1 - d0) / 10 <= 31);
      // E10 teclado
      const k = [];
      k.push(['foco inicial', (await estado(pg)).foco]);
      await tecla(pg, 'ArrowRight'); k.push(['→', (await estado(pg)).foco]);
      await tecla(pg, 'Enter'); let e = await estado(pg); k.push(['Enter na Visão tática', `${e.pp.visao}, tick ${e.tick}, aberta ${e.aberta}`]);
      const okVisao = e.pp.visao === 'sem' && e.tick === 0 && e.aberta;
      await tecla(pg, 'Enter'); e = await estado(pg); const okCom = e.pp.visao === 'com';
      await tecla(pg, 'Escape'); e = await estado(pg); k.push(['Esc', e.pp.visao]);
      const okEsc = e.pp.visao === 'escalacao' && e.aberta && e.tick === 0;
      await tecla(pg, 'Escape'); e = await estado(pg); const okEsc2 = e.aberta && e.tick === 0 && !e.menu;
      // 40 Tabs e 40 Shift+Tabs: nunca saem
      let fora = 0;
      for (let i = 0; i < 40; i++) { await pg.keyboard.press('Tab'); if (!(await pg.evaluate(() => !!document.activeElement?.closest?.('#prepartida')))) fora++; }
      for (let i = 0; i < 40; i++) { await pg.keyboard.press('Shift+Tab'); if (!(await pg.evaluate(() => !!document.activeElement?.closest?.('#prepartida')))) fora++; }
      k.push(['80 Tabs fora', fora]);
      await tecla(pg, 'KeyE'); e = await estado(pg); const okE = e.pp.time === 1;
      await tecla(pg, 'Escape'); e = await estado(pg); const okVolta = e.pp.time === 0;
      await tecla(pg, 'KeyQ');
      // P = ≡: a pausa "antes do jogo"
      await tecla(pg, 'KeyP');
      const pausa = await pg.evaluate(() => ({ aberta: window.__golaco.estado().menuAberto, antes: document.getElementById('menu').dataset.antes ?? null, voltar: document.querySelector('#btn-continuar .item-txt')?.textContent, editar: !!document.querySelector('#menu [data-cmd="editar-time"]')?.getClientRects().length, replay: !!document.querySelector('#menu [data-cmd="replay"]')?.getClientRects().length }));
      await tecla(pg, 'Escape');
      await avancar(pg, 100);
      e = await estado(pg);
      k.push(['P → pausa', JSON.stringify(pausa)], ['Esc na pausa', `menu ${e.menu}, aberta ${e.aberta}, tick ${e.tick}, foco ${e.foco}`]);
      const okPausa = pausa.aberta && pausa.antes === '1' && pausa.voltar === 'Voltar' && !pausa.editar && !pausa.replay && !e.menu && e.aberta && e.tick === 0 && e.foco === 'menu';
      meta('E10* teclado: foco no Jogar, ←/→, Enter na Visão tática não começa, Esc volta um nível, 80 Tabs presos, Q/E, P = ≡ "antes do jogo" e Esc volta à tela', k.map(x => `${x[0]}: ${x[1]}`).join(' · '),
        'jogar → visao; sem/com; Esc → escalação; 0 fora; time 1 ↔ 0; pausa antes e de volta com o foco no ≡', k[0][1] === 'jogar' && k[1][1] === 'visao' && okVisao && okCom && okEsc && okEsc2 && fora === 0 && okE && okVolta && okPausa);
      // E12 leitor de tela
      const ar = await pg.evaluate(() => {
        const r = document.getElementById('prepartida');
        const t = document.getElementById(r.getAttribute('aria-labelledby'));
        return { role: r.getAttribute('role'), modal: r.getAttribute('aria-modal'), nome: t?.textContent ?? '', toolbar: !!r.querySelector('[role="toolbar"][aria-label]'), itens: r.querySelectorAll('.pp-lista li').length, nota: /nota \d+/.test(r.querySelector('.pp-lista')?.textContent ?? ''), inert: ['hud', 'tela', 'toque'].every(id => !document.getElementById(id) || document.getElementById(id).inert), vivo: !!r.querySelector('[aria-live]') };
      });
      meta('E12 leitor de tela: o diálogo com nome e aria-modal, a barra de ferramentas, a lista com a nota, o fundo inert, a região viva', JSON.stringify(ar), 'dialog, true, "Antes do jogo: …", toolbar, ≥ 4 itens com nota, inert', ar.role === 'dialog' && ar.modal === 'true' && /^Antes do jogo:/.test(ar.nome) && ar.toolbar && ar.itens >= 4 && ar.nota && ar.inert && ar.vivo);
      // E20 proporções do FC 24 (16:9)
      const m = await pg.evaluate(MEDIR);
      const pct = (v, H = 720) => (v / H * 100);
      const P = m.pecas;
      const prop = { barra: [pct(P.barra.y), pct(P.barra.b)], info: [pct(P.info.y)], campo: [pct(P.campo.y), pct(P.campo.b)], abas: [pct(P.abas.y), pct(P.abas.b)], abasX: [P.abas.x / 12.8, P.abas.r / 12.8], cmd: [pct(P.cmd.y)] };
      const perto = (v, a) => Math.abs(v - a) <= 1.5;
      const okProp = perto(prop.barra[0], 15.5) && perto(prop.barra[1], 22) && perto(prop.info[0], 24.6) && perto(prop.campo[0], 32) && perto(prop.campo[1], 78) && perto(prop.abas[0], 83.5) && perto(prop.abas[1], 90.8) && perto(prop.abasX[0], 5) && perto(prop.abasX[1], 95) && Math.abs(prop.cmd[0] - 95.4) <= 2.5;
      meta('E20 as proporções do FC 24 no PC 16:9 (% da altura; abas de 5% a 95%)', Object.entries(prop).map(([k, v]) => `${k} ${v.map(x => x.toFixed(1)).join('–')}`).join(' · '), 'barra 15,5–22, info 24,6, campinho 32–78, abas 83,5–90,8 e 5–95, comandos 95,4', okProp);
      // E13 Personalizar: o editor no modo antes do jogo e o PRONTO de volta à tela
      await pg.evaluate(() => window.__golaco.sobDemanda.ja());
      await pg.waitForFunction(() => window.__golaco.sobDemanda.estado.editor, null, { timeout: 60000 });
      await pg.evaluate(() => { const b = document.querySelector('#prepartida [data-aba="personalizar"]'); b.focus(); });
      await tecla(pg, 'Enter');
      await pg.waitForFunction(() => window.__golaco.editor.aberto, null, { timeout: 15000 }).catch(() => {});
      const ed = await pg.evaluate(() => ({ aberto: window.__golaco.editor.aberto, contagem: document.querySelector('#editar-time .ed-contagem')?.textContent ?? '', tick: window.__golaco.mundo.tick, aberta: window.__golaco.prepartida.aberta }));
      await pg.evaluate(() => window.__golaco.editor.voltar());
      await avancar(pg, 100);
      e = await estado(pg);
      // a escalação: o mesmo caminho do PRONTO com uma edição (dois toques: 9 → 22, 1 → 12; 4-4-2) — feita no Node pelas regras da tela
      const ESC = await imp('escalacao.js');
      const mx = criarPartida({ semente: SEM });
      let r = ESC.rascunhoDe(structuredClone(mx.times[0]), null, 0);
      for (const id of [9, 22, 1, 12]) r = ESC.tocar(r, id).rasc;
      r = ESC.mudarFormacao(r, '4-4-2');
      const edicao = ESC.edicaoDe(r);
      const vagasE = { formacao: edicao.formacao, vagas: { ...edicao.vagas }, tatica: { ...edicao.tatica } };
      const depois = await pg.evaluate(ed => {
        const g = window.__golaco;
        const ok = g.prepartida.escalar(ed);
        const t = g.estadoTime(0);
        const d = g.prepartida.dados();
        return { ok, feitas: t.subs.feitas, saiu: t.saiu.length, pendente: t.pendente, gol: t.vagas.GOL, em22: g.mundo.jogadores.some(j => j.id === 22), forma: t.formacao, ficha22: d.times[0].fichas.some(f => f.id === 22), fichaDom: !!document.querySelector('#prepartida .pp-ficha[data-id="22"]'), aberta: g.prepartida.aberta, tick: g.mundo.tick, hash: g.hash(), foco: g.prepartida.estado.foco };
      }, edicao);
      const nodeE = hashNode(criarPartida({ semente: SEM, times: { 0: vagasE } }), 600);
      meta('E13* Personalizar: o editor "antes do jogo", o PRONTO volta à tela no Personalizar; a escalação sem substituição e o hash = Node criarPartida({times})',
        `editor ${ed.aberto} ("${ed.contagem}"), tick ${ed.tick}; depois: aberta ${e.aberta}, foco ${e.foco}; escalação: feitas ${depois.feitas}, saiu ${depois.saiu}, pendente ${depois.pendente}, GOL ${depois.gol}, 22 em campo ${depois.em22} e na ficha ${depois.ficha22 && depois.fichaDom}, ${depois.forma}; hash ${hexa(depois.hash)} × Node ${hexa(nodeE.h0)}`,
        'editor aberto "Antes do jogo…", tick 0; foco personalizar; 0, 0, null, 12, true, 4-4-2, iguais',
        ed.aberto && /Antes do jogo/.test(ed.contagem) && ed.tick === 0 && ed.aberta && e.aberta && e.foco === 'personalizar' && depois.ok && depois.feitas === 0 && depois.saiu === 0 && depois.pendente === null && depois.gol === 12 && depois.em22 && depois.ficha22 && depois.fichaDom && depois.forma === '4-4-2' && depois.hash === nodeE.h0);
      // E7: o Jogar (Enter no Jogar) sem pré-jogo → o apito; 600 passos = Node
      await pg.evaluate(() => document.querySelector('#prepartida [data-aba="jogar"]').focus());
      await tecla(pg, 'Enter');
      const j = await pg.evaluate(() => ({ aberta: window.__golaco.prepartida.aberta, tick: window.__golaco.mundo.tick, apito: window.__golaco.estadio?.som?.tocados?.apito ?? null }));
      const h600 = await pg.evaluate(rot => { const g = window.__golaco; g.pausar(true); return g.rodarPassos(rot.length, rot); }, roteiro(600));
      meta('E7* sem pré-jogo: 1 aperto (Enter no Jogar) → o jogo; 600 passos com a escalação = Node', `tela ${j.aberta}, tick ${j.tick}; hash ${hexa(h600)} × Node ${hexa(nodeE.h)}`, 'fechada, 0, iguais', !j.aberta && j.tick === 0 && h600 === nodeE.h);
      // E19 voltas: Reiniciar no meio sem tela; a troca de modo e o "Jogar de novo" com ela
      const v = await pg.evaluate(async () => {
        const g = window.__golaco, out = {};
        g.pausar(false);
        document.querySelector('#btn-reiniciar-partida').click();
        out.reiniciar = g.prepartida.aberta;
        g.reiniciar({ modo: 'partida', semente: 21, minutosPorTempo: 0.05 });
        let n = 0;
        while (n < 3000 && g.estado().relogio?.estado !== 'fim') { g.rodarPassos(30, 'demo'); n += 30; }
        out.fim = g.estado().relogio?.estado;
        document.querySelector('#btn-reiniciar-partida').click();
        out.jogarDeNovo = g.prepartida.aberta;
        out.tick = g.mundo.tick;
        g.trocarModo('ataque');
        out.treino = g.prepartida.aberta;
        return out;
      });
      await pg.evaluate(() => window.__golaco.trocarModo('penaltis'));
      await pg.waitForFunction(() => window.__golaco.mundo?.disputa, null, { timeout: 60000 });
      const v2 = await pg.evaluate(() => ({ aberta: window.__golaco.prepartida.aberta, modo: window.__golaco.prepartida.estado?.modo, tick: window.__golaco.mundo.tick }));
      meta('E19 voltas: Reiniciar no meio sem tela; "Jogar de novo" com ela; a troca de modo mostra a do modo novo (e os treinos não têm)', `${JSON.stringify(v)} · Pênaltis ${JSON.stringify(v2)}`, 'false; fim → true, tick 0; treino false; Pênaltis com a tela', !v.reiniciar && v.fim === 'fim' && v.jogarDeNovo && v.tick === 0 && !v.treino && v2.aberta && v2.modo === 'penaltis');
    }
    meta('S1 0 erros no console (PC)', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
  } finally { await navegador.close(); }
}

// ================================================================================================ celular: o fundo da abertura, toque, som
if (faz('cel')) {
  const { navegador, pagina: pg, erros } = await abrirPagina({ w: 844, h: 390, toque: true, espiar: true, q: `q=media&replay=0&comemoracao=0&replayParada=0&cenas=0&prepartida=1&prejogo=1&semente=3` });
  try {
    const tem = await temTela(pg);
    const e0 = tem ? await estado(pg) : null;
    const ab = tem ? await pg.evaluate(() => ({ vis: getComputedStyle(document.getElementById('prejogo')).visibility, chama: getComputedStyle(document.querySelector('.pj-abertura')).display })) : null;
    meta('E1 a tela por cima da abertura calada (celular, ?prejogo=1)', tem ? `fundo ${e0.pp.fundo}, pré-jogo ${e0.pre.fase}, a camada da abertura ${ab.vis}` : 'sem tela', 'abertura, abertura, hidden', tem && e0.pp.fundo === 'abertura' && e0.pre.fase === 'abertura' && ab.vis === 'hidden');
    if (tem) {
      // E15 desenho e 30 qps
      await pg.waitForTimeout(1500);
      const dz = await pg.evaluate(async () => { const g = window.__golaco; const d0 = g.prepartida.desenhos, t0 = performance.now(); await new Promise(r => setTimeout(r, 2000)); return { qps: (g.prepartida.desenhos - d0) / ((performance.now() - t0) / 1000), ...g.prejogo.desenho }; });
      meta('E15 desenho com a tela (844×390 Média): chamadas, triângulos e 3D a ≤ 31 qps', `${dz.chamadas} chamadas, ${(dz.triangulos / 1000).toFixed(0)} mil triângulos, ${dz.qps.toFixed(1)} desenhos/s`, '≤ 40, ≤ 130 mil, ≤ 31', dz.chamadas <= 40 && dz.triangulos <= 130000 && dz.qps <= 31);
      // E17 contraste (o fundo da abertura, de dia)
      const contr = await contraste(pg);
      meta('E17 contraste atrás do texto (fundo da abertura, dia)', `info ${contr.info.toFixed(0)}, barra ${contr.barra.toFixed(0)} (mediana /255)`, '≤ 50', contr.info <= 50 && contr.barra <= 50);
      // E18 em pé
      await pg.evaluate(() => document.querySelector('#prepartida [data-aba="visao"]').focus());
      await pg.setViewportSize({ width: 390, height: 844 });
      await quadros(pg, 4);
      const emPe = await pg.evaluate(() => ({ girar: getComputedStyle(document.getElementById('girar')).display !== 'none', parado: window.__golaco.prejogo.parado, tick: window.__golaco.mundo.tick }));
      await pg.setViewportSize({ width: 844, height: 390 });
      await quadros(pg, 4);
      const deitado = await estado(pg);
      meta('E18 em pé: o #girar cobre e o fundo para; deitado, o mesmo foco', `em pé ${JSON.stringify(emPe)}; deitado: foco ${deitado.foco}, aberta ${deitado.aberta}`, 'girar, parado, tick 0; visao', emPe.girar && emPe.parado && emPe.tick === 0 && deitado.foco === 'visao' && deitado.aberta);
      // E7 + E9: o toque no Jogar → as cenas (o requestFullscreen dentro do gesto), o som em ≤ 1 s; o Pular → o jogo
      const somAntes = await pg.evaluate(() => window.__golaco.estadio?.som?.estado ?? null);
      const b = await pg.evaluate(() => { const r = document.querySelector('#prepartida [data-aba="jogar"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await pg.touchscreen.tap(b.x, b.y);
      const t0 = Date.now();
      await pg.waitForFunction(() => window.__golaco.estadio?.som?.contexto === 'running', null, { timeout: 3000 }).catch(() => {});
      const tSom = (Date.now() - t0) / 1000;
      const dep = await pg.evaluate(() => ({ aberta: window.__golaco.prepartida.aberta, pre: window.__golaco.prejogo.fase, tick: window.__golaco.mundo.tick, som: window.__golaco.estadio?.som?.contexto ?? null, cheia: window.__telaCheia, apito: window.__golaco.estadio?.som?.tocados?.apito ?? 0 }));
      meta('E9 o som: o toque no Jogar liga o contexto (antes, sem contexto); o apito ainda não', `antes ${somAntes}; depois ${dep.som} em ${tSom.toFixed(2)} s; apito ${dep.apito}`, 'sem contexto → running ≤ 1 s; 0', dep.som === 'running' && tSom <= 1 && !dep.apito);
      await pg.evaluate(() => window.__golaco.prejogo.escalacao.pular); // (o botão aparece com o movimento)
      await pg.evaluate(() => document.getElementById('prejogo').dispatchEvent(new PointerEvent('pointermove', { bubbles: true })));
      const pb = await pg.evaluate(() => { const r = document.querySelector('.pj-pular').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await pg.touchscreen.tap(pb.x, pb.y);
      await quadros(pg, 3);
      const fim = await pg.evaluate(() => ({ pre: window.__golaco.prejogo.ativo, tick: window.__golaco.mundo.tick }));
      meta('E7* com o pré-jogo: 2 toques (Jogar + Pular) até o jogo; o requestFullscreen DENTRO do gesto do Jogar', `depois do Jogar: tela ${dep.aberta}, pré-jogo ${dep.pre}, tick ${dep.tick}; tela cheia pedida ${dep.cheia.length}× (gesto ativo: ${dep.cheia.map(c => c.ativo).join(',')}); depois do Pular: pré-jogo ${fim.pre}, tick ${fim.tick}`,
        'fechada, rodando, 0; 1× com o gesto; jogo', !dep.aberta && dep.pre === 'rodando' && dep.tick === 0 && dep.cheia.length >= 1 && dep.cheia[0].ativo !== false && !fim.pre);
    }
    meta('S1 0 erros no console (celular)', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
  } finally { await navegador.close(); }
}

/** A luminância mediana atrás da info e da barra (o print sem o texto: a tela fica com o texto transparente). */
async function contraste(pg) {
  await pg.addStyleTag({ content: '#prepartida.medindo .pp-info, #prepartida.medindo .pp-barra { color: transparent !important; } #prepartida.medindo .pp-barra * { visibility: hidden !important; }' });
  await pg.evaluate(() => document.getElementById('prepartida').classList.add('medindo'));
  await quadros(pg, 2);
  const caixas = await pg.evaluate(() => { const R = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }; return { info: R(document.getElementById('pp-info')), barra: R(document.querySelector('.pp-barra')) }; });
  const png = await pg.screenshot({ type: 'png' });
  await pg.evaluate(() => document.getElementById('prepartida').classList.remove('medindo'));
  const dpr = await pg.evaluate(() => devicePixelRatio);
  return pg.evaluate(async ([b64, cx, dpr]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const med = r => {
      const d = g.getImageData(Math.round(r.x * dpr), Math.round(r.y * dpr), Math.max(1, Math.round(r.w * dpr)), Math.max(1, Math.round(r.h * dpr))).data;
      const v = [];
      for (let i = 0; i < d.length; i += 16) v.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      v.sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    return { info: med(cx.info), barra: med(cx.barra) };
  }, [png.toString('base64'), caixas, dpr]);
}

// ================================================================================================ telas: sem rolar, nada encosta, letras, alvos
if (faz('telas')) {
  const CEL = [[844, 390], [667, 375], [640, 360], [568, 320]];
  const PCS = [[1280, 720], [1920, 1080], [1024, 768], [1280, 800], [1366, 600], [1280, 520]];
  for (const [modo, ext, fontes] of [['celular', 'cel', true], ['PC', 'pc', true], ['celular sem as fontes', 'cel', false]]) {
    const cel = ext === 'cel';
    const { navegador, pagina: pg, erros } = await abrirPagina({ w: cel ? 844 : 1280, h: cel ? 390 : 720, toque: cel, semFontes: !fontes, q: `${Q}&prepartida=1&semente=3&hora=noite` });
    try {
      if (!(await temTela(pg))) { meta(`E3/E4 ${modo}`, 'sem tela', 'a tela', false); continue; }
      await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
      if (fontes) await pg.evaluate(() => document.fonts.ready);
      const falhas = [], letras = [], alvos = [];
      let casos = 0, rolagem = 0, cortes = new Set();
      for (const [w, h] of cel ? CEL : PCS) {
        // (o entalhe simulado só no 844×390, o iPhone; as outras telas sem ele)
        await pg.evaluate(c => document.documentElement.classList.toggle('entalhe-simulado', c), cel && w === 844);
        await pg.setViewportSize({ width: w, height: h });
        await quadros(pg, 2);
        for (const [t, vista] of [[0, 'escalacao'], [1, 'escalacao'], [0, 'sem'], [0, 'com']]) {
          await pg.evaluate(([t, vista]) => { const P = window.__golaco.prepartida; P.adversario(t); let n = 0; while (P.estado.visao !== vista && n++ < 4) P.vista(); }, [t, vista]);
          await quadros(pg, 1);
          const m = await pg.evaluate(MEDIR);
          casos++;
          rolagem = Math.max(rolagem, m.rolagem);
          for (const p of m.prob) falhas.push(`${w}×${h} t${t} ${vista}: ${p}`);
          for (const n of m.cortados) cortes.add(n);
          if (vista === 'escalacao' && t === 0) {
            letras.push({ tela: `${w}×${h}`, ...m.letras });
            alvos.push({ tela: `${w}×${h}`, ...m.alvos, sa: m.sa });
          }
          if (vista !== 'escalacao' && m.letras.disco != null && m.letras.disco < 10) falhas.push(`${w}×${h} ${vista}: número ${m.letras.disco} px`);
        }
        await pg.evaluate(() => { const P = window.__golaco.prepartida; P.adversario(0); let n = 0; while (P.estado.visao !== 'escalacao' && n++ < 4) P.vista(); });
      }
      meta(`E3 sem rolar (${modo}: ${(cel ? CEL : PCS).length} telas × meu time/o outro × escalação/sem/com)`, `rolagem máx ${rolagem} px em ${casos} casos`, '0', rolagem <= 0);
      meta(`E4 nada encosta (${modo})`, falhas.length ? `${falhas.length}: ${falhas.slice(0, 4).join(' · ')}` : `0 em ${casos} casos; nomes com "…": ${[...cortes].join(', ') || 'nenhum'}`, '0', falhas.length === 0 && (fontes ? cortes.size === 0 : true));
      if (fontes) {
        const ruins = letras.filter(l => {
          const pc = !cel, minNome = pc ? (l.tela.endsWith('720') || +l.tela.split('×')[1] >= 720 ? 13 : 11) : l.tela === '568×320' ? 10 : 11;
          return l.nome < minNome - 0.01 || l.info < 11 - 0.01 || l.aba < 13 - 0.01 || l.resto < (pc ? 12 : 11) - 0.01;
        });
        meta(`E5 a letra (${modo})`, letras.map(l => `${l.tela}: nome ${l.nome}, info ${l.info.toFixed(1)}, aba ${l.aba.toFixed(1)}, resto ${l.resto.toFixed(1)}`).join(' · '), 'nome ≥ 10/11/13, info ≥ 11, abas ≥ 13, resto ≥ 11/12', ruins.length === 0);
        const ruinsA = alvos.filter(a => {
          const w = +a.tela.split('×')[0], h = +a.tela.split('×')[1];
          if (!cel) return a.aba.h < 44 - 0.5 || a.menu.w < 44 - 0.5 || a.time.h < 36 - 0.5;
          const c = w <= 568 ? { aw: 177, ah: 40, m: 34, tw: 56, th: 30 } : { aw: 200, ah: 44, m: 40, tw: 64, th: 36 };
          return a.aba.w < c.aw - 0.5 || a.aba.h < c.ah - 0.5 || a.menu.w < c.m - 0.5 || a.time.w < c.tw - 0.5 || a.time.h < c.th - 0.5 || h < 0;
        });
        meta(`E6 os alvos (${modo})`, alvos.map(a => `${a.tela}: aba ${a.aba.w.toFixed(0)}×${a.aba.h.toFixed(0)}, ≡ ${a.menu.w.toFixed(0)}, time ${a.time.w.toFixed(0)}×${a.time.h.toFixed(0)}`).join(' · '), cel ? 'abas ≥ 177×40 (568) / 200×44; ≡ ≥ 34/40; times ≥ 56×30 / 64×36' : 'abas ≥ 44 de altura, ≡ 44, times ≥ 36', ruinsA.length === 0);
      }
      if (cel && fontes) {
        // E17 de noite com o fundo do jogo (a página está de noite)
        await pg.setViewportSize({ width: 844, height: 390 });
        await pg.evaluate(() => window.__golaco.relogio.avancar(40));
        const c = await contraste(pg);
        meta('E17 contraste atrás do texto (fundo do jogo, noite)', `info ${c.info.toFixed(0)}, barra ${c.barra.toFixed(0)}`, '≤ 50', c.info <= 50 && c.barra <= 50);
      }
      meta(`S1 0 erros no console (telas ${modo})`, erros.filter(x => !/woff2|net::ERR_FAILED|Failed to load resource/.test(x)).slice(0, 3).join(' | ') || '0', '0', erros.filter(x => !/woff2|net::ERR_FAILED|Failed to load resource/.test(x)).length === 0);
    } finally { await navegador.close(); }
  }
  // E4b os outros modos no celular (a revisão do item 64): os Pênaltis (a duração "5 cobranças · Começa: …") e o TM pro com o
  // clássico, a competição e o estádio longos (4 abas) — a linha de informação sem o corte do CSS (A3)
  const PED_PRO = { ...PED_A, id: 'tProPP', edicao: 'pro', home: { ...PED_A.home, stadium: 'Estadio Municipal El Molinón – Enrique Castro "Quini"' }, partida: { ...PED_A.partida, classico: true, nomeClassico: 'Clássico das Multidões', competicao: 'Brasileirão Série A' } };
  const MODOS_TELA = [
    ['Pênaltis', { q: `${Q}&prepartida=1&modo=penaltis&semente=5&hora=noite` }, ['meu', 'outro']],
    ['TM pro com o clássico', { q: `${Q}&prepartida=1&tm=${PED_PRO.id}&hora=noite`, pedido: PED_PRO }, ['meu']],
  ];
  const TELAS_B = [[844, 390], [667, 375], [640, 360], [568, 320]];
  for (const [nome, o, vistas] of MODOS_TELA) {
    const { navegador, pagina: pg, erros } = await abrirPagina({ w: 844, h: 390, toque: true, ...o });
    try {
      if (!(await temTela(pg))) { meta(`E4b ${nome}`, 'sem tela', 'a tela', false); continue; }
      await pg.evaluate(() => document.fonts.ready);
      const falhas = [];
      let casos = 0;
      for (const [w, h] of TELAS_B) {
        await pg.evaluate(c => document.documentElement.classList.toggle('entalhe-simulado', c), w === 844);
        await pg.setViewportSize({ width: w, height: h });
        await quadros(pg, 2);
        for (const v of vistas) {
          await pg.evaluate(v => {
            const P = window.__golaco.prepartida, meu = P.estado.meu;
            P.adversario(v === 'outro' ? 1 - meu : meu);
            let n = 0; const alvo = v === 'sem' || v === 'com' ? v : 'escalacao';
            while (P.estado.visao !== alvo && n++ < 4) P.vista();
          }, v);
          await quadros(pg, 1);
          const m = await pg.evaluate(MEDIR);
          casos++;
          for (const p of m.prob) falhas.push(`${w}×${h} ${v}: ${p}`);
        }
      }
      meta(`E4b nada encosta nem é cortado pelo CSS (${nome}: ${TELAS_B.length} telas do celular)`, falhas.length ? `${falhas.length}: ${falhas.slice(0, 4).join(' · ')}` : `0 em ${casos} casos`, '0', falhas.length === 0);
      meta(`S1 0 erros no console (telas ${nome})`, erros.slice(0, 3).join(' | ') || '0', '0', erros.length === 0);
    } finally { await navegador.close(); }
  }
}

// ================================================================================================ modos: Livre, Pênaltis, controle, liga/desliga
if (faz('modos')) {
  // Livre
  {
    const { navegador, pagina: pg, erros } = await abrirPagina({ w: 1280, h: 720, q: `${Q}&prepartida=1&modo=livre&semente=4` });
    try {
      const tem = await temTela(pg);
      if (!tem) meta('E14 Livre', 'sem tela (a pausa no submenu Jogadores)', 'a tela', false);
      else {
        await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
        const t = await avancar(pg, 3000);
        const e = await estado(pg);
        const a = await pg.evaluate(() => { const g = window.__golaco; return { e: g.livre.escolha(), texto: g.prepartida.dados().times[0].texto, hash: g.hash(), menu: g.estado().menuAberto }; });
        // Jogadores: a pausa no submenu, mais 1 do adversário, Voltar → a tela com o N contra M novo
        await pg.evaluate(() => document.querySelector('#prepartida [data-aba="jogadores"]').click());
        const sub = await pg.evaluate(() => !document.getElementById('menu-livre')?.hidden && window.__golaco.estado().menuAberto);
        await pg.evaluate(() => { document.querySelector('#menu-livre [data-cmd="livre-menos"][data-valor="adv"]')?.click(); document.querySelector('#menu-livre [data-cmd="livre-voltar"]')?.click(); });
        await avancar(pg, 100);
        const b = await pg.evaluate(() => { const g = window.__golaco; return { aberta: g.prepartida.aberta, menu: g.estado().menuAberto, texto: g.prepartida.dados().times[0].texto, e: g.livre.escolha(), tick: g.mundo.tick, hash: g.hash(), foco: document.activeElement?.closest?.('#prepartida') ? document.activeElement.dataset.aba : null }; });
        const nodeL = hashMundo(criarLivre({ semente: 4, linha: [b.e.linha[0], b.e.linha[1]], goleiro: [b.e.goleiro[0], b.e.goleiro[1]] }));
        meta('E2*/E14 Livre: tela no tick 0; Jogadores abre o submenu e o Voltar volta à tela; o N contra M novo no campinho; o hash = Node criarLivre',
          `tick ${t}, passos ${e.passos}, abas ${e.pp.abas}; ${a.texto} → submenu ${sub} → ${b.texto} (aberta ${b.aberta}, menu ${b.menu}, foco ${b.foco}, tick ${b.tick}); hash ${hexa(b.hash)} × Node ${hexa(nodeL)}`,
          'tick 0; jogar/jogadores/camera; o adversário com 1 a menos; iguais',
          t === 0 && e.passos === 0 && e.pp.abas.join() === 'jogar,jogadores,camera' && sub && b.aberta && !b.menu && b.texto !== a.texto && b.tick === 0 && b.hash === nodeL);
        await pg.evaluate(() => window.__golaco.prepartida.jogar());
        const t2 = await avancar(pg, 1000);
        meta('E7 Livre: 1 aperto (Jogar) e o jogo anda', `tick ${t2}`, '> 0', t2 > 0);
      }
      meta('S1 0 erros (Livre)', erros.slice(0, 3).join(' | ') || '0', '0', erros.length === 0);
    } finally { await navegador.close(); }
  }
  // Pênaltis
  {
    const SEM = 4;
    const { navegador, pagina: pg, erros } = await abrirPagina({ w: 844, h: 390, toque: true, q: `${Q}&prepartida=1&modo=penaltis&semente=${SEM}` });
    try {
      const tem = await temTela(pg);
      await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
      const t = await avancar(pg, 3000);
      if (!tem) meta('E2* Pênaltis: a disputa parada antes do Bater', `sem tela; tick ${t} (anda sozinha)`, 'tick 0', false);
      else {
        const d = await pg.evaluate(() => { const g = window.__golaco; const d = g.prepartida.dados(); return { fila: d.disputa.fila, hash: g.hash(), fichas: document.querySelectorAll('#prepartida .pp-ficha').length, ordem: [...document.querySelectorAll('#prepartida .pp-ordem')].map(e => e.textContent), abas: g.prepartida.estado.abas }; });
        const nodeD = hashMundo(criarDisputa({ semente: SEM }));
        await pg.evaluate(() => document.querySelector('#prepartida [data-aba="adversario"]').click());
        const adv = await pg.evaluate(() => window.__golaco.prepartida.estado.time);
        meta('E2*/E14 Pênaltis: tick 0 com a tela; a fila (goleiro + 5 numerados) do m.disputa; o adversário; o hash = Node criarDisputa',
          `tick ${t}; ${d.fichas} fichas, ${d.ordem.join(' ')}; adversário → time ${adv}; abas ${d.abas}; hash ${hexa(d.hash)} × Node ${hexa(nodeD)}`, 'tick 0; 6 fichas 1º…5º; 1; iguais',
          t === 0 && d.fichas === 6 && d.ordem.join() === '1º,2º,3º,4º,5º' && adv === 1 && d.hash === nodeD);
        const b = await pg.evaluate(() => { const r = document.querySelector('#prepartida [data-aba="jogar"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        await pg.touchscreen.tap(b.x, b.y);
        const t2 = await avancar(pg, 1000);
        meta('E7* Pênaltis: 1 toque (Bater pênaltis) e a disputa anda (na base: 0 toques, andando sozinha)', `tick ${t2}`, '> 0', t2 > 0);
      }
      meta('S1 0 erros (Pênaltis)', erros.slice(0, 3).join(' | ') || '0', '0', erros.length === 0);
    } finally { await navegador.close(); }
  }
  // controle (getGamepads falso)
  {
    const { navegador, pagina: pg, erros } = await abrirPagina({ w: 1280, h: 720, q: `${Q}&prepartida=1&semente=3` });
    try {
      if (!(await temTela(pg))) meta('E11* controle', 'sem tela', 'a tela', false);
      else {
        await pg.evaluate(() => {
          const b = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
          window.__pad = { id: 'falso', index: 0, connected: true, mapping: 'standard', buttons: b, axes: [0, 0, 0, 0], timestamp: 0 };
          navigator.getGamepads = () => [window.__pad];
          window.__golaco.relogio.usarManual(true);
        });
        const aperta = async k => {
          await pg.evaluate(k => { window.__pad.buttons[k].pressed = true; window.__pad.buttons[k].value = 1; window.__golaco.relogio.avancar(16.7); }, k);
          await pg.evaluate(k => { window.__pad.buttons[k].pressed = false; window.__pad.buttons[k].value = 0; window.__golaco.relogio.avancar(16.7); window.__golaco.relogio.avancar(16.7); }, k);
          return estado(pg);
        };
        const k = [];
        let e = await aperta(15); k.push(`→ ${e.foco}`);
        e = await aperta(0); k.push(`Ⓐ ${e.pp.visao}/tick ${e.tick}`);
        const okA = e.pp.visao === 'sem' && e.tick === 0 && e.aberta;
        e = await aperta(1); k.push(`Ⓑ ${e.pp.visao}`);
        const okB = e.pp.visao === 'escalacao';
        e = await aperta(5); k.push(`RB time ${e.pp.time}`);
        const okRB = e.pp.time === 1;
        e = await aperta(4); k.push(`LB time ${e.pp.time}`);
        e = await aperta(9); k.push(`Start menu ${e.menu}`);
        const okStart = e.menu;
        e = await aperta(1); k.push(`Ⓑ na pausa: menu ${e.menu}, aberta ${e.aberta}`);
        await pg.evaluate(() => window.__golaco.sobDemanda.ja());
        await pg.waitForFunction(() => window.__golaco.sobDemanda.estado.editor, null, { timeout: 60000 });
        e = await aperta(3);
        await pg.waitForFunction(() => window.__golaco.editor.aberto, null, { timeout: 10000 }).catch(() => {});
        e = await estado(pg); k.push(`Ⓨ editor ${e.editor}, tick ${e.tick}`);
        const okY = e.editor && e.tick === 0;
        meta('E11* controle: a cruz anda, Ⓐ na Visão tática não começa, Ⓑ volta, LB/RB, Start = ≡, Ⓑ fecha a pausa, Ⓨ abre o Personalizar', k.join(' · '), '→ visao; sem/tick 0; escalação; 1; 0; menu; fechada; editor/tick 0',
          k[0] === '→ visao' && okA && okB && okRB && okStart && !e.menu && okY);
      }
      meta('S1 0 erros (controle)', erros.slice(0, 3).join(' | ') || '0', '0', erros.length === 0);
    } finally { await navegador.close(); }
  }
  // liga/desliga e a reserva
  {
    const casos = [['webdriver, sem o parâmetro', `${Q}&prejogo=1`, false, 'abertura'], ['?prepartida=0', `${Q}&prejogo=1&prepartida=0`, false, 'abertura'], ['?prints=1', `${Q}&prints=1`, false, null], ['?demo=1', `${Q}&demo=1`, false, null], ['treino (?modo=ataque)', `${Q}&prepartida=1&modo=ataque`, false, null]];
    const out = [];
    let ok = true;
    for (const [nome, q, quer, pre] of casos) {
      const { navegador, pagina: pg } = await abrirPagina({ w: 1024, h: 600, q });
      try {
        const r = await pg.evaluate(() => ({ el: !!document.getElementById('prepartida'), aberta: !!window.__golaco.prepartida?.aberta, fase: window.__golaco.prejogo?.fase ?? null, carregou: !!window.__golaco.sobDemanda?.estado?.prepartida }));
        out.push(`${nome}: #prepartida ${r.el}, pré-jogo ${r.fase}`);
        if (r.el !== quer || r.aberta !== quer || r.carregou || (pre && r.fase !== pre)) ok = false;
      } finally { await navegador.close(); }
    }
    meta('E1 desligada com webdriver sem o parâmetro, ?prepartida=0, prints, demo e nos treinos (o começo de hoje; o módulo nem baixa)', out.join(' · '), 'nenhum #prepartida; com ?prejogo=1 a abertura de texto', ok);
    // E21 a reserva
    const { navegador, pagina: pg } = await abrirPagina({ w: 1024, h: 600, q: `${Q}&prejogo=1&prepartida=1`, bloquear: /prepartida-tela\.js/ });
    try {
      const r = await pg.evaluate(() => ({ aberta: !!window.__golaco.prepartida?.aberta, fase: window.__golaco.prejogo?.fase, chama: document.querySelector('.pj-ab-chama')?.textContent ?? '' }));
      meta('E21 a reserva: com o módulo bloqueado, a abertura de texto de hoje', JSON.stringify(r), 'sem tela; abertura; "Clique ou aperte Enter…"', !r.aberta && r.fase === 'abertura' && /começar/.test(r.chama));
    } finally { await navegador.close(); }
  }
}

// ================================================================================================ o Ⓐ do Jogar com o pré-jogo
if (faz('pad')) {
  // E11b* o Ⓐ do Jogar com o pré-jogo (revisão A1): um toque de verdade dura 80–150 ms — o Ⓐ segurado 6 quadros no "Jogar
  // partida" começa as cenas do 1º plano (na HEAD antes da correção ia ao bloco 'escalacao0', ~60 s à frente)
  {
    const s = await abrir({ largura: 1280, altura: 720 });
    const { navegador, contexto, pagina: pg, erros } = s;
    try {
      await contexto.addInitScript(() => {
        const mk = () => ({ pressed: false, value: 0, touched: false });
        window.__pad = { id: 'falso', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, mk) };
        navigator.getGamepads = () => [window.__pad, null, null, null];
      });
      await pg.goto(srv.url + `index.html?${Q}&prepartida=1&prejogo=1&semente=3`);
      await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
      const antes = await pg.evaluate(() => ({ tela: !!window.__golaco.prepartida?.aberta, fase: window.__golaco.prejogo?.fase, foco: window.__golaco.prepartida?.estado?.foco }));
      await pg.evaluate(() => { window.__pad.buttons[0].pressed = true; window.__pad.buttons[0].value = 1; window.__pad.timestamp++; });
      await quadros(pg, 6);
      await pg.evaluate(() => { window.__pad.buttons[0].pressed = false; window.__pad.buttons[0].value = 0; window.__pad.timestamp++; });
      await quadros(pg, 3);
      const d = await pg.evaluate(() => { const p = window.__golaco.prejogo; return { tela: !!window.__golaco.prepartida?.aberta, fase: p.fase, bloco: p.bloco, indice: p.indice, t: +p.tempo.toFixed(2) }; });
      meta('E11b* controle com o pré-jogo: o Ⓐ segurado 6 quadros no Jogar começa as cenas do 1º plano (não pula o bloco)',
        `antes: tela ${antes.tela}, ${antes.fase}, foco ${antes.foco}; depois: tela ${d.tela}, ${d.fase}, bloco ${d.bloco}, plano ${d.indice}, t ${d.t} s`,
        'aberta, abertura, jogar → fechada, rodando, cenas, 0, < 2 s',
        antes.tela && antes.foco === 'jogar' && !d.tela && d.fase === 'rodando' && d.bloco === 'cenas' && d.indice === 0 && d.t < 2);
      meta('S1 0 erros (controle com o pré-jogo)', erros.slice(0, 3).join(' | ') || '0', '0', erros.length === 0);
    } finally { await navegador.close(); }
  }
}

// ================================================================================================ TM: público (Simular partida) e o Rumo ao Estrelato
if (faz('tm')) {
  const PED_PEN = { ...PED_A, id: 'tPenPP', modo: 'penaltis' };
  for (const [nome, ped] of [['TM pública', PED_A], ['Rumo ao Estrelato', PED_B], ['Pênaltis 3D do TM', PED_PEN]]) {
    // num quadro, como o TM de verdade (fora dele o fimTM navegaria de volta ao TM)
    const s = await abrir({ largura: 1280, altura: 720 });
    const { navegador, erros } = s;
    let pg = s.pagina;
    try {
      const url = `index.html?tm=${ped.id}&${Q}&prepartida=1&min=1`;
      const json = JSON.stringify(JSON.stringify(ped)).replace(/</g, '\\u003c');
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>TM</title></head><body style="margin:0;background:#000"><script>
localStorage.setItem('tm3d:pedido:' + ${JSON.stringify(ped.id)}, ${json});
const f = document.createElement('iframe'); f.id = 'q'; f.src = ${JSON.stringify(url)};
f.allow = 'fullscreen; autoplay; gamepad'; f.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
document.body.appendChild(f);
</script></body></html>`;
      const u = `${srv.url}__quadro-pp-${ped.id}.html`;
      await s.contexto.route(u, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
      await s.pagina.goto(u, { waitUntil: 'load' });
      let fr = null;
      for (let i = 0; i < 400 && !fr; i++) { fr = s.pagina.frames().find(f => /[?&]tm=/.test(f.url())); if (!fr) await s.pagina.waitForTimeout(50); }
      if (!fr) throw new Error('o quadro do jogo não abriu');
      pg = fr;
      await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
      const tem = await temTela(pg);
      if (!tem) { meta(`E14 ${nome}`, 'sem tela', 'a tela', false); continue; }
      const e = await estado(pg);
      const voce = await pg.evaluate(() => [...document.querySelectorAll('#prepartida .pp-ficha.voce')].length);
      if (ped === PED_A) {
        meta('E14 TM: 4 abas (Simular partida), o escudo do TM, o estádio "Estádio Total Match"', `abas ${e.pp.abas}; ${await pg.evaluate(() => { const d = window.__golaco.prepartida.dados(); return `${d.estadio}, escudo ${d.times[0].escudo?.url ? 'url' : d.times[0].escudo?.simbolo}`; })}`, 'jogar,visao,personalizar,simular; Estádio Total Match, url', e.pp.abas.join() === 'jogar,visao,personalizar,simular');
        await pg.evaluate(() => document.querySelector('#prepartida [data-aba="simular"]').click());
        const arm = await pg.evaluate(() => ({ armado: window.__golaco.prepartida.estado.armado, aberta: window.__golaco.prepartida.aberta, msgs: window.__golaco.tm.mensagens.map(m => m.tipo) }));
        await pg.evaluate(() => document.querySelector('#prepartida [data-aba="simular"]').click());
        await pg.waitForFunction(() => window.__golaco.tm.mensagens.some(m => m.tipo === 'tm3d:fim'), null, { timeout: 120000 }).catch(() => {});
        const fim = await pg.evaluate(() => { const m = window.__golaco.tm.mensagens.find(x => x.tipo === 'tm3d:fim'); return { tem: !!m, placar: m?.dados?.placar ?? m?.resultado?.placar ?? null, estado: window.__golaco.estado().relogio?.estado }; });
        meta('E14 TM: "Simular partida" arma no 1º toque e simula pelo motor 3D no 2º → tm3d:fim com o resultado', `1º: armado ${arm.armado}, tela ${arm.aberta}, mensagens ${arm.msgs}; 2º: tm3d:fim ${fim.tem}, relógio ${fim.estado}`, 'simular, aberta, sem fim; fim, fim', arm.armado === 'simular' && arm.aberta && !arm.msgs.includes('tm3d:fim') && fim.tem && fim.estado === 'fim');
      } else if (ped === PED_PEN) {
        // o [<] "Voltar ao Total Match" (2 toques) antes do Bater: volta SEM resultado — 'tm3d:sair' (a escolha dos times), nunca a
        // disputa simulada com 'tm3d:fim' (revisão A2: o TM mostrava o vencedor de uma disputa que ninguém jogou)
        const canto = () => pg.evaluate(() => document.querySelector('#prepartida [data-pp="canto"]')?.click());
        await canto(); await canto();
        await pg.waitForFunction(() => window.__golaco.tm.mensagens.some(m => m.tipo === 'tm3d:fim' || m.tipo === 'tm3d:sair'), null, { timeout: 120000 }).catch(() => {});
        await pg.waitForTimeout(500);
        const msgs = await pg.evaluate(() => window.__golaco.tm.mensagens.map(m => m.tipo + (m.resultado?.penaltis ? `(${m.resultado.penaltis.placar})` : '')));
        meta('E14 Pênaltis 3D do TM: o [<] "Voltar ao Total Match" (2º toque) antes do Bater volta sem resultado (tm3d:sair, nenhum tm3d:fim)', `abas ${e.pp.abas}; mensagens ${msgs.join(', ')}`,
          'jogar,adversario; tm3d:pronto, tm3d:sair', e.pp.abas.join() === 'jogar,adversario' && msgs.includes('tm3d:sair') && !msgs.some(m => m.startsWith('tm3d:fim')));
      } else {
        meta('E14 Rumo ao Estrelato: sem Personalizar (Jogar · Visão tática · Simular), a ficha "VOCÊ"', `abas ${e.pp.abas}; fichas VOCÊ ${voce}`, 'jogar,visao,simular; 1', e.pp.abas.join() === 'jogar,visao,simular' && voce === 1);
      }
      meta(`S1 0 erros (${nome})`, erros.slice(0, 3).join(' | ') || '0', '0', erros.length === 0);
    } finally { await navegador.close(); }
  }
}

// ================================================================================================ online: duas abas pelo BroadcastChannel
if (faz('online')) {
  const ESPERA = Math.max(10, +arg('--espera', 10));
  const t0on = Date.now();
  const passo = t => { if (args.includes('--log')) console.error(`  [online ${((Date.now() - t0on) / 1000).toFixed(1)} s] ${t}`); };
  const textoAviso = p => p.evaluate(() => { const a = document.getElementById('online-aviso'); return a && !a.hidden ? a.textContent : ''; });
  const on = p => p.evaluate(() => { const g = window.__golaco, o = g.online; return o ? { n: o.n, D: o.D, fase: o.fase, faseRemota: o.faseRemota, encerrado: o.encerrado, hashes: o.hashes, aberta: !!g.prepartida?.aberta, fechadaEm: g.prepartida?.fechadaEm ?? null, pp: g.prepartida?.estado ?? null, editor: g.editor.aberto, tick: g.mundo.tick } : null; });
  const comparar = (x, y) => { const mx = new Map(x.hashes), comuns = y.hashes.filter(([n]) => mx.has(n)); return { comuns: comuns.length, difs: comuns.filter(([n, h]) => mx.get(n) !== h).length, ate: comuns.length ? Math.max(...comuns.map(([n]) => n)) : 0 }; };
  const ate = (p, n, ms = 240000) => p.waitForFunction(k => (window.__golaco.online?.n ?? 0) >= k, n, { timeout: ms }).then(() => true, () => false);
  const espera = ms => new Promise(r => setTimeout(r, ms));
  /** Um par de abas na mesma sala; perda = a fração dos pacotes do JOGO descartados ao sair (o canal de controle é confiável). */
  async function abrirPar(extra, perda = 0) {
    const ctx = await abrir({ largura: 960, altura: 540, dpr: 1 });
    if (perda) await ctx.contexto.addInitScript(f => {
      let k = 0x2545f491, perdidos = 0, total = 0;
      const orig = BroadcastChannel.prototype.postMessage;
      BroadcastChannel.prototype.postMessage = function (m) {
        if (m && m.t === 'j') {
          total++;
          k = (Math.imul(k, 1664525) + 1013904223) >>> 0;
          const fora = k / 4294967296 < f;
          if (fora) perdidos++;
          window.__perda = { perdidos, total };
          if (fora) return undefined;
        }
        return orig.call(this, m);
      };
    }, perda);
    const sala = `pp${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const url = lado => `${srv.url}index.html?online=${sala}&transporte=bc&lado=${lado}&ia=1&semente=7&min=0.25&${Q}&D=4&prepartida=1${extra}`;
    const A = ctx.pagina, B = await ctx.contexto.newPage();
    // (nenhuma ação espera para sempre: um clique que não acha o alvo reprova em 20 s)
    for (const p of [A, B]) p.setDefaultTimeout(20000);
    const erros = [];
    for (const [p, nome] of [[A, 'A'], [B, 'B']]) {
      p.on('pageerror', e => erros.push(`${nome}: ${e.message}`));
      p.on('console', m => { if (m.type() === 'error') erros.push(`${nome}: ${m.text()}`); });
    }
    await Promise.all([A.goto(url(0), { waitUntil: 'load' }), B.goto(url(1), { waitUntil: 'load' })]);
    await Promise.all([A, B].map(p => p.waitForFunction(() => window.__golaco?.pronto && window.__golaco.online, null, { timeout: 240000 })));
    return { ctx, A, B, erros };
  }
  /** A saída conjunta: o 2º Pronto (em B, com a hora) → as duas telas fechadas; devolve os ms até a última fechar. */
  async function saidaConjunta(A, B) {
    // o intervalo entre quadros de A antes (o relógio do ambiente: duas abas com o 3D sem GPU)
    const quadroA = await A.evaluate(() => new Promise(ok => { const t = []; const f = x => { t.push(x); if (t.length < 6) requestAnimationFrame(f); else ok((t[5] - t[0]) / 5); }; requestAnimationFrame(f); setTimeout(() => ok(null), 10000); }));
    const t0 = await B.evaluate(() => { const t = Date.now(); document.querySelector('#prepartida [data-aba="pronto"]').click(); return t; });
    const fim = await Promise.all([A, B].map(p => p.waitForFunction(() => !window.__golaco.prepartida.aberta && window.__golaco.prepartida.fechadaEm, null, { timeout: 15000 }).then(h => h.jsonValue(), () => null)));
    const ok = fim.every(x => x != null);
    return { ms: ok ? Math.max(...fim) - t0 : null, a: fim[0] != null ? fim[0] - t0 : null, b: fim[1] != null ? fim[1] - t0 : null, quadroA };
  }
  const textoSaida = x => x.ms == null ? 'não saíram em 15 s' : `${x.ms} ms (A ${x.a} ms, B ${x.b} ms; o quadro de A antes: ${x.quadroA == null ? '—' : x.quadroA.toFixed(0)} ms)`;

  // ---- par 1: O3, O1, O5, O2, O4 e os hashes (com o pré-jogo curto)
  {
    const { ctx, A, B, erros } = await abrirPar('&prejogo=curto');
    try {
      let a = await on(A), b = await on(B);
      const telas = !!(a?.aberta && b?.aberta);
      meta('E1 online: a tela nos dois lados (Pronto e Visão tática; sem o Personalizar)', `A ${a?.aberta} ${JSON.stringify(a?.pp?.abas ?? null)} · B ${b?.aberta} ${JSON.stringify(b?.pp?.abas ?? null)}`, 'as duas abertas, [pronto, visao]',
        telas && a.pp.abas.join() === 'pronto,visao' && b.pp.abas.join() === 'pronto,visao' && a.pp.modo === 'online');
      if (telas) {
        const avisos = new Set();
        const olhar = async () => { for (const [p, k] of [[A, 'A'], [B, 'B']]) { const t = await textoAviso(p); if (t) avisos.add(`${k}: ${t}`); } };
        // O3: A mexe na tela (o time, a vista, as Opções) com B parado nela
        await A.bringToFront();
        passo('O3: teclas em A');
        await tecla(A, 'KeyE'); await tecla(A, 'KeyQ');
        await A.evaluate(() => document.querySelector('#prepartida [data-aba="visao"]').focus());
        await tecla(A, 'Enter'); await tecla(A, 'Enter'); await tecla(A, 'Escape');
        passo('O3: o ≡ de A');
        await A.click('#prepartida [data-pp="menu"]');
        await quadros(A, 3);
        const menuA = await A.evaluate(() => window.__golaco.estado().menuAberto);
        // (as Opções pelo click do DOM: com duas abas e o 3D sem GPU cada quadro leva ~0,5 s e a espera de "estável" do Playwright
        // estourava o prazo; o que se testa aqui é a simulação, não o clique)
        const clicar = sel => A.evaluate(sel => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return false; e.click(); return true; }, sel);
        const cliques = [await clicar('#btn-opcoes')];
        await quadros(A, 2);
        cliques.push(await clicar('[data-grupo="qualidade"] [data-valor="media"]'), await clicar('[data-grupo="hora"] [data-valor="noite"]'));
        passo(`O3: cliques ${cliques.join(',')}`);
        await quadros(A, 2);
        const hora = await A.evaluate(() => document.documentElement.classList.contains('noite'));
        await tecla(A, 'Escape'); await tecla(A, 'Escape');
        await quadros(A, 3);
        await olhar();
        a = await on(A); b = await on(B);
        const o3 = { menu: menuA, noite: hora, aberta: a.aberta, foco: a.pp.foco, nA: a.n, nB: b.n, editor: a.editor };
        passo('O1: A pronto');
        // O1 + O5: A pronto (o clique de verdade) e B na tela por ESPERA s
        await A.click('#prepartida [data-aba="pronto"]');
        const tA = Date.now();
        let maxN = 0, wo = false;
        while (Date.now() - tA < ESPERA * 1000) {
          await espera(1000);
          await olhar();
          const [x, y] = await Promise.all([on(A), on(B)]);
          maxN = Math.max(maxN, x.n, y.n);
          if (!x.aberta || !y.aberta) break;
        }
        wo = [...avisos].some(t => /W\.O\./.test(t));
        a = await on(A); b = await on(B);
        const botaoA = await A.evaluate(() => document.querySelector('#prepartida [data-aba="pronto"] .pp-aba-txt')?.textContent ?? '');
        const parou = [...avisos].filter(t => /conexão parou/i.test(t));
        meta('O1* A pronto e B na tela: nenhum passo, nenhum "A conexão parou" nem W.O.; A diz "Aguardando {B}…"',
          `${ESPERA} s: passos (máx.) ${maxN}; A "${botaoA}" (fase ${a.fase}), B fase ${b.fase} vê A na fase ${b.faseRemota}; telas ${a.aberta}/${b.aberta}; avisos ${avisos.size ? [...avisos].join(' | ') : 'nenhum'}`,
          '0 passos; "Aguardando Lado 1…"; as duas abertas; nenhum "conexão parou"', maxN === 0 && botaoA === 'Aguardando Lado 1…' && a.fase === 1 && b.faseRemota === 1 && a.aberta && b.aberta && !parou.length && !wo);
        meta(`O5 B ${ESPERA} s na tela com A esperando: nenhum W.O. oferecido (os pacotes chegando)${ESPERA >= 60 ? '; aos 60 s o Sair de A em destaque' : ''}`,
          `W.O. ${wo ? 'oferecido' : 'não'}; destaque do Sair ${a.pp.destaqueCanto}`, `nenhum${ESPERA >= 60 ? '; destaque' : ''}`, !wo && (ESPERA < 60 || a.pp.destaqueCanto));
        passo('O2: B pronto');
        // O2: B pronto → os dois saem juntos
        const sai = await saidaConjunta(A, B);
        meta('O2 B pronto: os dois saem juntos (do 2º Pronto até a última tela fechar)', textoSaida(sai), '≤ 500 ms', sai.ms != null && sai.ms <= 500);
        passo('O4: A pula o pré-jogo');
        // O4: A pula o pré-jogo (Esc) e B assiste
        await A.waitForFunction(() => window.__golaco.prejogo?.ativo, null, { timeout: 30000 }).catch(() => {});
        await espera(1500);
        await A.bringToFront();
        await tecla(A, 'Escape');
        await ate(A, 4, 60000);
        // (o aviso de espera sai com 0,9 s parado, contados nos quadros de A — ~1 s cada aqui, com duas abas sem GPU: espera até 20 s)
        const tAv = Date.now();
        await A.waitForFunction(() => { const e = document.getElementById('online-aviso'); return e && !e.hidden && /ainda está no pré-jogo/.test(e.textContent); }, null, { timeout: 20000 }).catch(() => {});
        await espera(1000);
        a = await on(A); b = await on(B);
        const sAv = ((Date.now() - tAv) / 1000 - 1).toFixed(1);
        const avA = await textoAviso(A);
        meta('O4 A pula o pré-jogo e B assiste: A parado em n = D com "{B} ainda está no pré-jogo"', `A n ${a.n} (D ${a.D}), vê B na fase ${a.faseRemota}; B n ${b.n}, fase ${b.fase}; aviso de A "${avA}" (em ${sAv} s)`,
          'n = D; "Lado 1 ainda está no pré-jogo"', a.n === a.D && b.n === 0 && b.fase === 2 && /Lado 1 ainda está no pré-jogo/.test(avA) && !/conexão parou/i.test(avA));
        passo('B pula; até 1200 passos');
        // B pula também; os dois até 1200 passos
        await B.bringToFront();
        await tecla(B, 'Escape');
        const chegou = (await Promise.all([ate(A, 1210), ate(B, 1210)])).every(Boolean);
        await olhar();
        a = await on(A); b = await on(B);
        const c = comparar(a, b);
        const pausados = [...avisos].filter(t => /Pausado por/.test(t));
        meta('O2/O3 os hashes iguais em todos os HASH_CADA até 1200 passos (com o time, a vista e as Opções mudados antes em A); nenhum "Pausado por"',
          `${chegou ? '' : 'não chegaram a 1200 · '}${c.difs} diferentes de ${c.comuns} em comum (até o passo ${c.ate}); antes do Pronto: ${JSON.stringify(o3)}; "Pausado por" ${pausados.length}`,
          '0 diferentes, ≥ 20 em comum até ≥ 1140; a pausa e a noite abertas em A, a tela de volta no Jogar; 0',
          chegou && c.difs === 0 && c.comuns >= 20 && c.ate >= 1140 && o3.menu && o3.noite && o3.aberta && o3.nA === 0 && o3.nB === 0 && !o3.editor && !pausados.length);
      }
      meta('S5 0 erros no console (online, par 1)', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
    } finally { await ctx.navegador.close(); }
  }

  // ---- par 2: O6 (sem Personalizar; o Sair só no 2º toque e o abandono do outro lado)
  {
    const { ctx, A, B, erros } = await abrirPar('&prejogo=0');
    try {
      let a = await on(A), b = await on(B);
      if (a?.aberta && b?.aberta) {
        await A.bringToFront();
        await tecla(A, 'KeyY');
        await A.mouse.click(480, 270);
        await quadros(A, 3);
        a = await on(A);
        const semEditor = !a.editor && a.aberta && !a.pp.abas.includes('personalizar');
        await A.click('#prepartida [data-pp="canto"]');
        await quadros(A, 2);
        const um = await on(A), umB = await on(B);
        await espera(3500);
        await A.click('#prepartida [data-pp="canto"]');
        await quadros(A, 2);
        const dois = await on(A);
        const t0 = Date.now();
        await A.click('#prepartida [data-pp="canto"]');
        const recebeu = await B.waitForFunction(() => window.__golaco.online.encerrado, null, { timeout: 10000 }).then(() => Date.now() - t0, () => null);
        a = await on(A); b = await on(B);
        meta('O6 sem Personalizar no online (Y e o toque no campinho não abrem o editor); "Sair da partida" só no 2º toque (3 s); o outro recebe o abandono',
          `editor ${!semEditor ? 'abriu' : 'não'}; 1º toque: A ${um.encerrado ? 'saiu' : `armado ${um.pp.armado}`}, B ${umB.encerrado ? 'recebeu' : 'nada'}; passados 3,5 s, outro toque: ${dois.encerrado ? 'saiu' : `armado ${dois.pp.armado}`}; 2º toque: A ${a.encerrado ? 'saiu' : 'não'}, B ${recebeu == null ? 'não recebeu' : `recebeu em ${recebeu} ms`}`,
          'não abre; armado, nada; armado de novo; saiu e o outro recebe',
          semEditor && !um.encerrado && um.pp.armado === 'canto' && !umB.encerrado && !dois.encerrado && dois.pp.armado === 'canto' && a.encerrado && recebeu != null);
      } else meta('O6 sem Personalizar no online; o Sair só no 2º toque', 'sem a tela', 'a tela nos dois lados', false);
      meta('S6 0 erros no console (online, par 2)', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
    } finally { await ctx.navegador.close(); }
  }

  // ---- par 3: O7 (20% dos pacotes do jogo perdidos)
  {
    const { ctx, A, B, erros } = await abrirPar('&prejogo=0', 0.2);
    try {
      const a = await on(A), b = await on(B);
      if (a?.aberta && b?.aberta) {
        await A.click('#prepartida [data-pp="aba"][data-aba="pronto"]');
        await espera(2000);
        const sai = await saidaConjunta(A, B);
        const perda = await Promise.all([A, B].map(p => p.evaluate(() => window.__perda ?? null)));
        const andou = (await Promise.all([ate(A, 120, 60000), ate(B, 120, 60000)])).every(Boolean);
        meta('O7 20% dos pacotes do jogo descartados: a saída conjunta em ≤ 1 s (e o jogo anda nos dois)',
          `${textoSaida(sai)}; descartados ${perda.map(x => x ? `${x.perdidos}/${x.total}` : '—').join(' e ')}; 120 passos nos dois ${andou}`,
          '≤ 1000 ms; ~20%; sim', sai.ms != null && sai.ms <= 1000 && andou && perda.every(x => x && x.perdidos > 0));
      } else meta('O7 a saída conjunta com 20% de perda', 'sem a tela', 'a tela nos dois lados', false);
      meta('S7 0 erros no console (online, par 3)', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
    } finally { await ctx.navegador.close(); }
  }
}

// ================================================================================================ download
if (faz('carga')) {
  const fs = await import('node:fs'), zlib = await import('node:zlib');
  // o que a página pediu ao nosso servidor (o caminho → o tamanho no disco e o comprimido: o GitHub Pages serve js/css/svg com gzip)
  const medir = async q => {
    const s = await servidor(0, RAIZ);
    const { navegador, pagina: pg } = await abrir({ largura: 1280, altura: 720 });
    const ped = new Map();
    pg.on('request', r => { const u = r.url(); if (u.startsWith(s.url)) { const k = u.slice(s.url.length).split('?')[0]; try { const b = fs.readFileSync(path.join(RAIZ, k)); ped.set(k, { cru: b.length, gz: /\.(js|css|svg|json|html)$/.test(k) ? zlib.gzipSync(b, { level: 6 }).length : b.length }); } catch (_) { /* fora da pasta */ } } });
    try {
      await pg.goto(s.url + '?' + q);
      await pg.waitForFunction(() => window.__golaco?.pronto, null, { timeout: 240000 });
      await pg.waitForTimeout(2500);
      return ped;
    } finally { await navegador.close(); await s.fechar(); }
  };
  const com = await medir(`${Q}&prepartida=1`), sem = await medir(`${Q}&prepartida=0`);
  const extra = [...com].filter(([k]) => !sem.has(k));
  const cru = extra.reduce((a, [, v]) => a + v.cru, 0) / 1024, gz = extra.reduce((a, [, v]) => a + v.gz, 0) / 1024;
  const cond = [...com.keys()].filter(k => /tmcond/.test(k)), condSem = [...sem.keys()].filter(k => /tmcond/.test(k));
  meta('E16 download: o que a tela baixa a mais até +2,5 s ≤ 140 KB transferidos (js/css/svg com gzip, como o GitHub Pages; as fontes woff2 cruas); a TM Cond só com a tela',
    `+${gz.toFixed(1)} KB transferidos (+${cru.toFixed(1)} KB crus): ${extra.map(([k, v]) => `${k.split('/').pop()} ${(v.gz / 1024).toFixed(1)}`).join(', ')}; TM Cond sem a tela: ${condSem.join(', ') || '—'}`,
    '≤ 140 KB; a TM Cond só com a tela', gz <= 140 && cond.length >= 1 && condSem.length === 0);
}

await srv.fechar();
const falhas = res.filter(r => !r.ok);
console.log(`\n${res.length - falhas.length}/${res.length} metas`);
console.log(falhas.length ? `teste-prepartida-tela: REPROVOU (${falhas.length})` : 'teste-prepartida-tela: PASSOU');
process.exit(falhas.length ? 1 : 0);
