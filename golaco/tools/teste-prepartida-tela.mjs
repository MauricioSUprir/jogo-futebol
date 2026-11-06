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
//       info nunca cortada pelo CSS: revisão A3; as abas sem "…" e com o ícone igual na barra: A4/V3/V15) e o Rumo ao Estrelato, também
//       no regime mínimo (640×304, 568×280) e no PC; E5b a letra do resto nesses modos (o VOCÊ, a ordem, a competição: A5)
//   E5  a letra: nome ≥ 10 px (568×320), ≥ 11 (outros celulares), ≥ 13 (PC ≥ 720); info ≥ 11; abas ≥ 13; o resto ≥ 11/12
//   E6  os alvos: abas ≥ 177 × 40 (568), ≥ 200 × 44 (640+); ≡ ≥ 34/40/44; os times ≥ 30 × 56 (568) e 36 × 64; nada sob o entalhe
//   E7* toques até o jogo: partida com o pré-jogo 2 (Jogar + Pular); sem pré-jogo 1 → o apito; Pênaltis 1; o requestFullscreen
//       chamado DENTRO do handler do Jogar (toque)
//   E9  o som: o toque no Jogar liga o contexto em ≤ 1 s; o apito só depois
//   E10* teclado: o foco inicial no Jogar; ←/→; 40 Tabs presos; Enter na Visão tática e no Personalizar NÃO começa; Esc e P nunca
//       levam ao jogo (na base, Esc no pré-jogo = o jogo); Q/E trocam o time; o ≡ abre a pausa "antes do jogo" — a tela some atrás
//       dela, só o véu (V6) — e volta à tela
//   E11* controle (getGamepads falso): a cruz anda; Ⓐ na Visão tática não começa; Ⓑ volta; Ⓨ abre o Personalizar; LB/RB; Start = ≡
//   E11b* com o pré-jogo: o Ⓐ segurado 6 quadros no Jogar começa as cenas do 1º plano (não pula o bloco; revisão A1)
//   E12 leitor de tela: o diálogo com nome e aria-modal; a barra de ferramentas; a lista com a nota; o fundo inert; E12b o disco da
//       Visão tática com o foco fora do aria-hidden, com papel e nome, e o Esc devolvendo o foco à aba; E12c no toque, sem o anel de
//       foco ao abrir (revisão A6)
//   E13* Personalizar: abre o editor "antes do jogo" sem a tela atrás dele (V5); o PRONTO volta à tela no Personalizar; a escalação (9 → 22, 1 → 12, 4-4-2)
//       sem substituição (feitas 0, saiu vazio), o reserva na ficha, o hash = Node criarPartida({times}); com o pré-jogo, o reserva
//       no cortejo e o lado de fora NÃO remontado
//   E14 por modo: TM "Simular partida" só no 2º toque → 'tm3d:sair' {motivo: 'simular'} em ≤ 2 s, nenhum tm3d:fim e o mundo
//       parado no tick 0 (item 124, dono 05/11: a tela no lugar da janela "Jogar em 3D / Simular" — o Simular dela é o da janela: o
//       TM simula lance a lance; na base o motor 3D simulava do tick 0 e mandava tm3d:fim); Rumo ao Estrelato sem Personalizar,
//       com "VOCÊ", e o Simular dele igual (tm3d:sair 'simular'); Livre: Jogadores volta à tela e o N contra M aparece; Pênaltis: a
//       fila e a disputa só anda depois do Bater;
//       Pênaltis 3D do TM: o [<] "Voltar ao Total Match" antes do Bater volta SEM resultado (tm3d:sair; revisão A2)
//   E14r (revisão do item 124, o TM num quadro): R1* em pé (390×844, toque) a tela "Gire o celular" cobre a tela antes do jogo e tem
//       o "Simular partida" (o ponto do meio é dele) → tm3d:sair {motivo: 'simular'} com os 11 + 11 titulares, tick 0, e o toque nele
//       não liga o som nem baixa os sons; R2* (PC) os toques na Visão tática e no 1º do Simular não ligam o som nem baixam os
//       sons da torcida — o Jogar liga (≤ 1 s); R3* o 2º toque do Simular feito dentro dos 3 s vale pela HORA DO TOQUE com o
//       quadro preso 3,6 s (na base ele armava de novo); R4* a reserva (o módulo da tela bloqueado: a abertura de texto) tem o
//       "Simular partida" no canto de baixo, sem encostar no texto da abertura → tm3d:sair 'simular', tick 0. Na base reprovam
//   E15 desenho (celular Média): ≤ 40 chamadas e ≤ 130 mil triângulos com a tela; ≤ 31 desenhos 3D por segundo
//   E16 download: os bytes até +2,5 s com a tela ≤ os sem ela + 140 KB; a TM Cond só com a tela
//   E17 contraste: a luminância (mediana) atrás da info e da barra ≤ 50/255, de dia e de noite, nos dois fundos
//   E18 em pé: o #girar cobre, o fundo para; deitado de novo, o mesmo foco
//   E19 voltas: "Jogar de novo" mostra a tela; "Reiniciar partida" no meio não; a troca de modo mostra a do modo novo; E19b o
//       "Pré-jogo da partida" mudado pelo ≡ vale no Jogar (desligado = o apito; curto = o curto; com o webdriver de um usuário)
//   E20 as proporções do FC 24 no PC 16:9 (±1,5 ponto)
//   E21 a reserva: com o módulo bloqueado, a abertura de texto de hoje (e o jogo começa como hoje)
//   E22 (item 31) a FOTO da edição pro nas fichas (o PED_A pro com as fotos pela rota /__fotos/ — JPGs de verdade do TM —, um titular
//       de cada lado SEM foto): E22a em 844×390 com toque e 1280×720, em ≤ 3 s depois do pronto, 10/11 fichas do time mostrado com a
//       foto (naturalWidth > 0) no miolo (a caixa da foto = a do miolo ± 1 px), a sem foto com o busto e sem <img>; o outro time
//       (Q/E) igual; nada encosta (E4) com as fotos; E22b a 1ª foto pedida DEPOIS do pronto; E22c o mesmo pedido PÚBLICO: 0 fotos
//       nas fichas e 0 pedidos às fotos; E22d as fotos em 404: todas com o busto, nenhuma <img> visível, nenhum erro de página
//       além dos 404 delas. Na base E22a/b reprovam.
//   E23 (item 33) a dificuldade na linha de informação: ?dif=dificil → "Difícil" no celular (844×390 e 568×320, com toque) e
//       "Dificuldade: Difícil" no PC (1280×720), com a duração, sem a linha passar (o CSS não corta); o Livre e os Pênaltis sem nível
//       (o online: no E1 online)
//   E24 (item 33) ≡ → "Modo de jogo" → Duração até 6 e Dificuldade até Lenda → volta: a linha diz "2 × 6 min | … | Lenda"; o Jogar
//       começa com ticksPorTempo 21 600 e m.dificuldade "lenda"; E24b o mesmo depois de um Personalizar (o mundo recriado leva os
//       ajustes). Na base reprovam (sem o ciclo nem o nível)
//   Online (§8.3; duas abas do mesmo Chromium pelo BroadcastChannel, ?online=<sala>&transporte=bc&lado=0|1&ia=1&D=4):
//   O1* A pronto e B na tela: nenhum passo nos dois, nenhum "A conexão parou" nem W.O.; A diz "Aguardando {B}…"
//   O2  B pronto: os dois saem em ≤ 0,5 s; os hashes iguais em todos os HASH_CADA até 1200 passos
//   O3  antes do Pronto, A troca o time mostrado, a vista e as Opções (qualidade, horário): hashes iguais, nenhum "Pausado por"
//   O4  A pula o pré-jogo e B assiste: A parado em n = D com "{B} ainda está no pré-jogo"
//   O5  B na tela enquanto A espera (padrão 10 s; --espera 100 = os 100 s da especificação): nenhum W.O. oferecido
//   O6  sem Personalizar no online (nem o Y, nem o toque no campinho); "Sair da partida" só no 2º toque → o outro recebe o abandono
//   O7  20% dos pacotes do jogo descartados de propósito: a saída conjunta em ≤ 1 s
//   node tools/teste-prepartida-tela.mjs [--raiz <pasta golaco>] [--so pc,cel,telas,modos,pad,tm,ajustes,online,fotos,carga] [--espera <s>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ as RAIZ_PADRAO } from './lib/navegador.mjs';
import { PED_A, PED_B, comFotos } from './lib/pedidos-tm.mjs';

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

/** As peças da tela que se veem (visibility e caixa): com a pausa ou o editor por cima, nenhuma (só o véu; revisões V5/V6). */
const SEL_ATRAS = ['.pp-menu', '.pp-comp', '.pp-barra', '#pp-info', '.pp-campo .pp-ficha', '.pp-abas', '.pp-cmd', '.pp-canto-esq'];
const telaAtras = pg => pg.evaluate(sels => sels.filter(sel => { const e = document.querySelector('#prepartida ' + sel); return e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'; }), SEL_ATRAS);
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
  if (compTxt) {
    // (o ícone pode ter saído: a competição longa no celular)
    const r = R(compTxt), icEl = raiz.querySelector('.pp-comp > svg'), ic = icEl && icEl.getClientRects().length ? R(icEl) : r;
    pecas.comp = { x: ic.x, r: r.r, y: Math.min(ic.y, r.y), b: Math.max(ic.b, r.b) };
    // o nome nunca cortado (revisão V11: "BRASILEIRÃO S…" em 568×320)
    if (compTxt.scrollWidth > compTxt.clientWidth + 0.5 || compTxt.scrollHeight > compTxt.clientHeight + 0.5) prob.push(`competição cortada ("${compTxt.textContent}")`);
  }
  const pares = [['comp', 'barra'], ['menu', 'barra'], ['canto', 'barra'], ['canto', 'comp'], ['menu', 'comp'], ['barra', 'info'], ['info', 'abas'], ['campo', 'abas'], ['abas', 'cmd'], ['esq', 'abas'], ['dir', 'abas'], ['esq', 'dir'], ['info', 'menu'], ['info', 'canto']];
  for (const [a, b] of pares) if (pecas[a] && pecas[b] && sob(pecas[a], pecas[b], 1, 1)) prob.push(`${a}×${b}`);
  const cantosTxt = [...raiz.querySelectorAll('.pp-canto-esq > *, .pp-canto-dir > *')].map(R).filter(r => r.w > 0);
  for (const k of cantosTxt) for (const f of fichas) if (sob(k, f, 3, 1)) prob.push(`canto×${f.v}`);
  // o texto dos cantos dentro do campinho: a borda inclinada do trapézio (o polígono do SVG) não atravessa as letras (revisão V4)
  const gram = raiz.querySelector('.pp-gramado');
  if (gram) {
    const P = gram.getAttribute('points').trim().split(/\s+/).map(q => q.split(',').map(Number));
    const borda = (a, b, y) => a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
    const rg = document.createRange();
    for (const [sel, lado] of [['.pp-canto-esq > *', 0], ['.pp-canto-dir > *', 1]]) for (const e of raiz.querySelectorAll(sel)) {
      rg.selectNodeContents(e);
      const q = rg.getBoundingClientRect();
      if (!q.width) continue;
      // contorno: [baixo-esq, cima-esq, cima-dir, baixo-dir]; a borda mais para dentro no alto da caixa
      const d = lado === 0 ? borda(P[0], P[1], q.top) - q.left : q.right - borda(P[3], P[2], q.top);
      if (d > -1) prob.push(`canto ${lado ? 'direito' : 'esquerdo'} × a borda do campinho ("${e.textContent.trim()}", ${d.toFixed(1)} px)`);
    }
  }
  // a info cortada pelo CSS (o corte por prioridade evita: só pode o estádio com "…" da conta)
  for (const l of raiz.querySelectorAll('.pp-info-l')) if (l.scrollWidth > l.clientWidth + 1) prob.push('info cortada pelo CSS');
  // o texto das abas nunca cortado; o ícone igual na barra inteira (revisões A4/V3/V15)
  for (const b of raiz.querySelectorAll('.pp-aba')) { const t = b.querySelector('.pp-aba-txt'); if (t && t.scrollWidth > t.clientWidth + 0.5) prob.push(`aba ${b.dataset.aba} cortada ("${t.textContent}")`); }
  if (new Set([...raiz.querySelectorAll('.pp-aba')].map(b => getComputedStyle(b.querySelector('svg') ?? b).display === 'none')).size > 1) prob.push('o ícone em umas abas e não em outras');
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
  // (também o VOCÊ, a ordem dos cobradores e as teclas da linha dos comandos: revisão A5)
  for (const e of raiz.querySelectorAll('.pp-comp-txt, .pp-hora, .pp-forma, .pp-selo, .pp-geral, .pp-tnome b, .pp-tnome i, .pp-cmd span, .pp-cmd kbd, .pp-filete span, .pp-ordem')) if (e.getClientRects().length) menorResto = Math.min(menorResto, parseFloat(getComputedStyle(e).fontSize));
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
      // E12b (revisão A6): ↑ das abas leva o foco a um disco da Visão tática — fora de qualquer aria-hidden, com papel e nome — e o Esc
      // (a escalação: os discos somem) devolve o foco à aba, não ao body
      await tecla(pg, 'ArrowUp');
      const disco = await pg.evaluate(() => { const a = document.activeElement; return { disco: !!a?.classList?.contains('pp-disco'), escondido: !!a?.closest?.('[aria-hidden="true"]'), role: a?.getAttribute('role') ?? null, nome: a?.getAttribute('aria-label') ?? '' }; });
      await tecla(pg, 'Escape'); e = await estado(pg); k.push(['Esc', e.pp.visao]);
      meta('E12b leitor de tela na Visão tática: o disco com o foco fora do aria-hidden, com papel e nome; o Esc devolve o foco à aba', `${JSON.stringify(disco)}; depois do Esc: ${e.pp.visao}, foco ${e.foco}`,
        'disco, não escondido, button, "N Nome, POS"; escalacao, foco visao', disco.disco && !disco.escondido && disco.role === 'button' && /^\S+ .+, [A-Z]{2,3}$/.test(disco.nome) && e.pp.visao === 'escalacao' && e.foco === 'visao');
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
      pausa.atras = await telaAtras(pg);
      await tecla(pg, 'Escape');
      await avancar(pg, 100);
      e = await estado(pg);
      const atrasDepois = await telaAtras(pg);
      k.push(['P → pausa', JSON.stringify(pausa)], ['Esc na pausa', `menu ${e.menu}, aberta ${e.aberta}, tick ${e.tick}, foco ${e.foco}, a tela à vista ${atrasDepois.join(',') || 'nada'}`]);
      // (com a pausa aberta a tela some atrás dela — só o véu; fechada, tudo volta: revisão V6)
      const okPausa = pausa.aberta && pausa.antes === '1' && pausa.voltar === 'Voltar' && !pausa.editar && !pausa.replay && pausa.atras.length === 0 && !e.menu && e.aberta && e.tick === 0 && e.foco === 'menu' && atrasDepois.length >= 5;
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
      await avancar(pg, 50);
      const ed = await pg.evaluate(() => ({ aberto: window.__golaco.editor.aberto, contagem: document.querySelector('#editar-time .ed-contagem')?.textContent ?? '', tick: window.__golaco.mundo.tick, aberta: window.__golaco.prepartida.aberta }));
      ed.atras = await telaAtras(pg);
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
        `editor ${ed.aberto} ("${ed.contagem}"), tick ${ed.tick}, a tela à vista atrás dele: ${ed.atras.join(',') || 'nada'}; depois: aberta ${e.aberta}, foco ${e.foco}; escalação: feitas ${depois.feitas}, saiu ${depois.saiu}, pendente ${depois.pendente}, GOL ${depois.gol}, 22 em campo ${depois.em22} e na ficha ${depois.ficha22 && depois.fichaDom}, ${depois.forma}; hash ${hexa(depois.hash)} × Node ${hexa(nodeE.h0)}`,
        'editor aberto "Antes do jogo…", tick 0, nada da tela atrás; foco personalizar; 0, 0, null, 12, true, 4-4-2, iguais',
        ed.aberto && /Antes do jogo/.test(ed.contagem) && ed.tick === 0 && ed.aberta && ed.atras.length === 0 && e.aberta && e.foco === 'personalizar' && depois.ok && depois.feitas === 0 && depois.saiu === 0 && depois.pendente === null && depois.gol === 12 && depois.em22 && depois.ficha22 && depois.fichaDom && depois.forma === '4-4-2' && depois.hash === nodeE.h0);
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
      // E12c (revisão A6): no toque não há anel de foco (especificação §5: o verde da aba do foco basta)
      const anel = await pg.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { foco: a?.dataset?.aba ?? a?.tagName, estilo: cs.outlineStyle, largura: cs.outlineWidth, meio: document.getElementById('prepartida').dataset.meio }; });
      meta('E12c no toque, sem anel de foco ao abrir (o foco no Jogar, só o verde da aba)', JSON.stringify(anel), 'jogar, sem contorno', anel.foco === 'jogar' && (anel.estilo === 'none' || anel.largura === '0px'));
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
  // clássico, a competição e o estádio longos (4 abas, as duas vistas e o Simular armado) — a linha de informação sem o corte do
  // CSS (A3), o texto das abas inteiro (também o "Toque de novo: simular": V2), o ícone igual na barra toda (A4/V3/V15) e a
  // competição sem "…" (V11)
  const PED_PRO = { ...PED_A, id: 'tProPP', edicao: 'pro', home: { ...PED_A.home, stadium: 'Estadio Municipal El Molinón – Enrique Castro "Quini"' }, partida: { ...PED_A.partida, classico: true, nomeClassico: 'Clássico das Multidões', competicao: 'Campeonato Brasileiro Série A' } };
  const MODOS_TELA = [
    ['Pênaltis', { q: `${Q}&prepartida=1&modo=penaltis&semente=5&hora=noite` }, ['meu', 'outro']],
    ['TM pro com o clássico', { q: `${Q}&prepartida=1&tm=${PED_PRO.id}&hora=noite`, pedido: PED_PRO }, ['meu', 'sem', 'com', 'armado']],
    ['Rumo ao Estrelato', { q: `${Q}&prepartida=1&tm=${PED_B.id}&hora=dia`, pedido: PED_B }, ['meu']],
  ];
  // (as 4 do celular, o regime mínimo — o Android antes da tela cheia — e o PC 1280×720 para a letra do PC)
  const TELAS_B = [[844, 390], [667, 375], [640, 360], [568, 320], [640, 304], [568, 280], [1280, 720]];
  for (const [nome, o, vistas] of MODOS_TELA) {
    const { navegador, pagina: pg, erros } = await abrirPagina({ w: 844, h: 390, toque: true, ...o });
    try {
      if (!(await temTela(pg))) { meta(`E4b ${nome}`, 'sem tela', 'a tela', false); continue; }
      await pg.evaluate(() => document.fonts.ready);
      const falhas = [], letras = [];
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
          // (o Simular partida armado: o 1º toque; o Esc desarma depois da medida)
          if (v === 'armado') await pg.evaluate(() => document.querySelector('#prepartida [data-aba="simular"]').click());
          await quadros(pg, 1);
          const m = await pg.evaluate(MEDIR);
          if (v === 'armado') {
            const arm = await pg.evaluate(() => window.__golaco.prepartida.estado.armado);
            if (arm !== 'simular') falhas.push(`${w}×${h} armado: o Simular não armou (${arm})`);
            await tecla(pg, 'Escape');
          }
          casos++;
          for (const p of m.prob) falhas.push(`${w}×${h} ${v}: ${p}`);
          if (v === 'meu') letras.push({ tela: `${w}×${h}`, pc: h > 480, resto: m.letras.resto });
        }
      }
      const ruins = letras.filter(l => l.resto < (l.pc ? 12 : 11) - 0.01);
      meta(`E5b a letra do resto (${nome}: o VOCÊ, a ordem, a competição, as teclas)`, letras.map(l => `${l.tela} ${l.resto.toFixed(1)}`).join(' · '), '≥ 11 no celular, ≥ 12 no PC', ruins.length === 0);
      // (os problemas agrupados pelo tipo, com as telas de cada um)
      const tipos = new Map();
      for (const f of falhas) { const i = f.indexOf(': '); const k = f.slice(i + 2); tipos.set(k, [...(tipos.get(k) ?? []), f.slice(0, i)]); }
      meta(`E4b nada encosta nem é cortado pelo CSS (${nome}: ${TELAS_B.length - 1} telas do celular e o PC)`, falhas.length ? `${falhas.length}: ${[...tipos].map(([k, v]) => `${k} [${v.join(', ')}]`).join(' · ')}` : `0 em ${casos} casos`, '0', falhas.length === 0);
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
    // E19b (revisão A7) o "Pré-jogo da partida" mudado pelo ≡ com a tela aberta vale no Jogar: desligado = o apito (o jogo anda, sem
    // pré-jogo); curto = o pré-jogo curto. Com o navigator.webdriver de um usuário (false) e sem ?prejogo — com o parâmetro a
    // preferência não vale e, com o webdriver, o pré-jogo fica desligado
    const r19 = [];
    let ok19 = true;
    for (const alvo of ['desligado', 'curto']) {
      const s = await abrir({ largura: 1280, altura: 720 });
      try {
        await s.contexto.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
        await s.pagina.goto(srv.url + `index.html?${Q}&prepartida=1&semente=3`);
        await s.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
        const pg = s.pagina;
        const a = await pg.evaluate(() => ({ wd: navigator.webdriver, tela: !!window.__golaco.prepartida?.aberta, fundo: window.__golaco.prepartida?.estado?.fundo, pre: window.__golaco.prejogo?.fase }));
        await tecla(pg, 'KeyP');
        const ciclo = await pg.evaluate(async alvo => {
          document.querySelector('#btn-modos')?.click();
          await new Promise(r => setTimeout(r, 100));
          const b = document.querySelector('#menu [data-cmd="prejogo-ciclo"]'), est = () => document.getElementById('estado-prejogo')?.textContent;
          const out = [est()];
          for (let i = 0; i < 4 && est() !== alvo; i++) { b.click(); out.push(est()); }
          return out;
        }, alvo);
        await tecla(pg, 'Escape'); await tecla(pg, 'Escape');
        await quadros(pg, 3);
        await pg.evaluate(() => document.querySelector('#prepartida [data-aba="jogar"]').focus());
        await tecla(pg, 'Enter');
        await pg.waitForTimeout(1500);
        const d = await pg.evaluate(() => ({ tela: !!window.__golaco.prepartida.aberta, pre: window.__golaco.prejogo.ativo, modo: window.__golaco.prejogo.modo, tick: window.__golaco.mundo.tick }));
        r19.push(`${alvo}: antes ${JSON.stringify(a)}; ${ciclo.join('→')}; depois do Jogar ${JSON.stringify(d)}`);
        const bom = a.wd === false && a.tela && a.fundo === 'abertura' && ciclo[ciclo.length - 1] === (alvo === 'desligado' ? 'desligado' : 'curto') && !d.tela
          && (alvo === 'desligado' ? !d.pre && d.tick > 0 : d.pre && d.modo === 'curto' && d.tick === 0);
        if (!bom || s.erros.length) { ok19 = false; if (s.erros.length) r19.push(`erros: ${s.erros.slice(0, 2).join(' | ')}`); }
      } finally { await s.navegador.close(); }
    }
    meta('E19b o "Pré-jogo da partida" mudado pelo ≡ com a tela aberta vale no Jogar (desligado = o apito e o jogo anda; curto = o pré-jogo curto)', r19.join(' · '),
      'webdriver false, tela na abertura; desligado → sem pré-jogo, tick > 0; curto → pré-jogo curto, tick 0', ok19);
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
/**
 * (item 124) "Simular partida" da tela no TM (2 toques): o 1º arma (a tela fica, nenhuma mensagem de saída), o 2º manda
 * 'tm3d:sair' {motivo: 'simular'} — o TM fecha o 3D e simula lance a lance — sem 'tm3d:fim' e sem andar o mundo.
 */
async function simularDaTela(pg) {
  await pg.evaluate(() => document.querySelector('#prepartida [data-aba="simular"]').click());
  const arm = await pg.evaluate(() => ({ armado: window.__golaco.prepartida.estado.armado, aberta: window.__golaco.prepartida.aberta, msgs: window.__golaco.tm.mensagens.map(m => m.tipo) }));
  const t0 = Date.now();
  await pg.evaluate(() => document.querySelector('#prepartida [data-aba="simular"]').click());
  await pg.waitForFunction(() => window.__golaco.tm.mensagens.some(m => m.tipo === 'tm3d:fim' || m.tipo === 'tm3d:sair'), null, { timeout: 20000 }).catch(() => {});
  const s = +((Date.now() - t0) / 1000).toFixed(2);
  // (meio segundo a mais: um tm3d:fim atrasado — o motor 3D simulando — apareceria aqui)
  await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => ({ msgs: window.__golaco.tm.mensagens.map(m => m.tipo + (m.motivo ? '/' + m.motivo : '')), tick: window.__golaco.mundo.tick, passos: window.__golaco.passos }));
  const ok = arm.armado === 'simular' && arm.aberta && !arm.msgs.some(m => m === 'tm3d:fim' || m === 'tm3d:sair')
    && r.msgs.includes('tm3d:sair/simular') && !r.msgs.some(m => m.startsWith('tm3d:fim')) && s <= 2 && r.tick === 0;
  return { arm, s, ...r, ok };
}
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
        const sim = await simularDaTela(pg);
        meta('E14 TM: "Simular partida" arma no 1º toque e no 2º volta ao TM SEM resultado do 3D → tm3d:sair {motivo: "simular"} em ≤ 2 s, nenhum tm3d:fim, o mundo no tick 0 (item 124: o TM simula lance a lance)',
          `1º: armado ${sim.arm.armado}, tela ${sim.arm.aberta}, mensagens ${sim.arm.msgs}; 2º: ${sim.msgs.join(', ')} em ${sim.s} s, tick ${sim.tick}, passos ${sim.passos}`,
          'simular, aberta, sem sair/fim; tm3d:sair/simular, ≤ 2 s, sem tm3d:fim, tick 0', sim.ok);
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
        const sim = await simularDaTela(pg);
        meta('E14 Rumo ao Estrelato: "Simular partida" (2 toques) → tm3d:sair {motivo: "simular"}, nenhum tm3d:fim, tick 0 (item 124: a simulação do Estrelato)',
          `1º: armado ${sim.arm.armado}, tela ${sim.arm.aberta}; 2º: ${sim.msgs.join(', ')} em ${sim.s} s, tick ${sim.tick}`, 'simular, aberta; tm3d:sair/simular, sem tm3d:fim, tick 0', sim.ok);
      }
      meta(`S1 0 erros (${nome})`, erros.slice(0, 3).join(' | ') || '0', '0', erros.length === 0);
    } finally { await navegador.close(); }
  }
}

// ================================================================================================ o TM: a revisão do item 124
if (faz('tm')) {
  // o TM num quadro (como o de verdade: fora dele o sairTM navegaria de volta ao TM); o frame do jogo e a sessão
  async function tmNoQuadro({ w, h, toque = false, bloquear = null, extra = '' }) {
    const ped = { ...PED_A, id: 'tRev' + w + 'x' + h + (bloquear ? 'r' : '') };
    const s = await abrir({ largura: w, altura: h, toque, dpr: toque ? 2 : 1 });
    if (bloquear) await s.contexto.route(bloquear, r => r.abort());
    const url = `index.html?tm=${ped.id}&${Q}&prepartida=1${toque ? '&toque=1' : ''}${extra}`;
    const json = JSON.stringify(JSON.stringify(ped)).replace(/</g, '\\u003c');
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>TM</title></head><body style="margin:0;background:#000"><script>
localStorage.setItem('tm3d:pedido:' + ${JSON.stringify(ped.id)}, ${json});
const f = document.createElement('iframe'); f.id = 'q'; f.src = ${JSON.stringify(url)};
f.allow = 'fullscreen; autoplay; gamepad'; f.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
document.body.appendChild(f);
</script></body></html>`;
    const u = `${srv.url}__quadro-rev-${ped.id}.html`;
    await s.contexto.route(u, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    await s.pagina.goto(u, { waitUntil: 'load' });
    let fr = null;
    for (let i = 0; i < 400 && !fr; i++) { fr = s.pagina.frames().find(f => /[?&]tm=/.test(f.url())); if (!fr) await s.pagina.waitForTimeout(50); }
    if (!fr) throw new Error('o quadro do jogo não abriu');
    await fr.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
    await quadros(fr, 3);
    return { s, fr };
  }
  const msgsTM = fr => fr.evaluate(() => window.__golaco.tm.mensagens.map(m => ({ tipo: m.tipo, motivo: m.motivo ?? null, nCasa: m.titulares?.home?.length ?? 0, nFora: m.titulares?.away?.length ?? 0 })));
  const saiuSimular = ms => ms.some(m => m.tipo === 'tm3d:sair' && m.motivo === 'simular' && m.nCasa === 11 && m.nFora === 11) && !ms.some(m => m.tipo === 'tm3d:fim');
  const somDoQuadro = fr => fr.evaluate(() => ({ ctx: window.__golaco.estadio?.som?.contexto ?? null, sons: performance.getEntriesByType('resource').filter(e => /\/assets\/sons\//.test(e.name)).length }));

  // R1* em pé
  {
    const { s, fr } = await tmNoQuadro({ w: 390, h: 844, toque: true });
    try {
      const v = await fr.evaluate(() => {
        const g = document.getElementById('girar'), b = g && g.querySelector('.tm-simular');
        const r = b && !b.hidden ? b.getBoundingClientRect() : null;
        const no = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
        return { girar: !!g && getComputedStyle(g).display !== 'none', botao: !!r && r.width > 0, texto: b ? b.textContent.trim() : null, meio: !!no && (no === b || b.contains(no)),
          x: r ? r.left + r.width / 2 : 0, y: r ? r.top + r.height / 2 : 0, tela: !!window.__golaco.prepartida.aberta };
      });
      if (v.botao) await s.pagina.touchscreen.tap(v.x, v.y);
      await fr.waitForFunction(() => window.__golaco.tm.mensagens.some(m => m.tipo === 'tm3d:sair'), null, { timeout: 5000 }).catch(() => {});
      await fr.waitForTimeout(300);
      const ms = await msgsTM(fr), som = await somDoQuadro(fr), tick = await fr.evaluate(() => window.__golaco.mundo.tick);
      meta('E14r R1* TM em pé (390×844): o "Gire o celular" cobre a tela antes do jogo e tem o "Simular partida" (revisão A1) → tm3d:sair "simular" com os titulares, tick 0, sem ligar o som',
        `${JSON.stringify(v)}; ${ms.map(m => m.tipo + '/' + (m.motivo ?? '') + (m.nCasa ? `(${m.nCasa}+${m.nFora})` : '')).join(', ')}; tick ${tick}; som ${som.ctx}, ${som.sons} sons`,
        'girar com o botão no meio; tm3d:sair/simular(11+11); tick 0; sem contexto, 0 sons', v.girar && v.botao && v.meio && v.tela && v.texto === 'Simular partida' && saiuSimular(ms) && tick === 0 && som.ctx == null && som.sons === 0);
      meta('S1 0 erros (TM em pé)', s.erros.slice(0, 3).join(' | ') || '0', '0', s.erros.length === 0);
    } finally { await s.navegador.close(); }
  }
  // R2* e R3* (PC): o som só no Jogar; o 2º toque do Simular pela hora do toque com o quadro preso
  {
    const { s, fr } = await tmNoQuadro({ w: 1280, h: 720 });
    try {
      await fr.click('#prepartida [data-aba="visao"]');
      await quadros(fr, 2);
      await fr.click('#prepartida [data-aba="simular"]');
      // (lido logo: com a máquina carregada, 2 quadros podiam passar dos 3 s e o rótulo voltava sozinho)
      const arm = await fr.evaluate(() => window.__golaco.prepartida.estado.armado);
      const som1 = await somDoQuadro(fr);
      // o quadro preso 3,6 s (o laço do jogo pesado) e o 2º toque DURANTE: o clique sai pelo CDP 0,2 s depois (o navegador o carimba na
      // hora) e o quadro só o processa quando solta — a hora do processamento passa dos 3 s do armado, a do toque não
      await fr.evaluate(() => {
        window.__tsToque = null;
        document.addEventListener('click', e => { if (e.target.closest?.('[data-aba="simular"]')) window.__tsToque = { ts: e.timeStamp, proc: performance.now() }; }, { capture: true, once: true });
        setTimeout(() => { const t = performance.now(); while (performance.now() - t < 3600); }, 20);
      });
      const r = await fr.evaluate(() => { const b = document.querySelector('#prepartida [data-aba="simular"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      await s.pagina.waitForTimeout(200);
      const cdp = await s.contexto.newCDPSession(s.pagina);
      const t = Date.now() / 1000;
      await Promise.all([
        cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1, timestamp: t }),
        cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1, timestamp: t + 0.05 }),
      ]);
      await fr.waitForFunction(() => window.__golaco.tm.mensagens.some(m => m.tipo === 'tm3d:sair'), null, { timeout: 5000 }).catch(() => {});
      const ms = await msgsTM(fr), ts = await fr.evaluate(() => window.__tsToque);
      const tick = await fr.evaluate(() => window.__golaco.mundo.tick);
      meta('E14r R2* TM (PC): a Visão tática e o 1º toque do Simular não ligam o som nem baixam os sons da torcida (revisão A4)', `armado ${arm}; som ${som1.ctx}, ${som1.sons} sons`, 'simular; sem contexto, 0 sons', arm === 'simular' && som1.ctx == null && som1.sons === 0);
      meta('E14r R3* o 2º toque do Simular dentro dos 3 s vale pela hora do toque com o quadro preso 3,6 s (revisão A5)',
        `toque ${ts ? `carimbado ${(ts.proc - ts.ts).toFixed(0)} ms antes de processado` : '—'}; ${ms.map(m => m.tipo + '/' + (m.motivo ?? '')).join(', ')}; tick ${tick}`,
        'tm3d:sair/simular (11+11), tick 0', saiuSimular(ms) && tick === 0);
      // o Jogar (depois do Simular o TM fecharia o quadro; aqui o quadro fica): é o gesto que liga o som
      await fr.click('#prepartida [data-aba="jogar"]');
      const t0 = Date.now();
      await fr.waitForFunction(() => window.__golaco.estadio?.som?.contexto === 'running', null, { timeout: 3000 }).catch(() => {});
      const som2 = await somDoQuadro(fr);
      meta('E14r R2b o Jogar da tela no TM liga o som (≤ 1,5 s)', `${som2.ctx} em ${((Date.now() - t0) / 1000).toFixed(2)} s`, 'running ≤ 1,5 s', som2.ctx === 'running' && Date.now() - t0 <= 1500);
      meta('S1 0 erros (TM, PC)', s.erros.slice(0, 3).join(' | ') || '0', '0', s.erros.length === 0);
    } finally { await s.navegador.close(); }
  }
  // R4* a reserva da tela (o módulo bloqueado): a abertura de texto com o "Simular partida"
  {
    const { s, fr } = await tmNoQuadro({ w: 1024, h: 600, bloquear: /prepartida-tela\.js/, extra: '&prejogo=1' });
    try {
      const v = await fr.evaluate(() => {
        const b = document.querySelector('.tm-simular-abertura'), R = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; };
        const rb = b && !b.hidden ? R(b) : null;
        const textos = ['.pj-ab-marca', '.pj-ab-jogo', '.pj-ab-estadio', '.pj-ab-chama'].map(sel => document.querySelector(sel)).filter(e => e && e.getClientRects().length).map(R);
        const encosta = !!rb && textos.some(t => t.x < rb.r && rb.x < t.r && t.y < rb.b && rb.y < t.b);
        const no = rb ? document.elementFromPoint((rb.x + rb.r) / 2, (rb.y + rb.b) / 2) : null;
        return { tela: !!window.__golaco.prepartida?.aberta, fase: window.__golaco.prejogo?.fase, botao: !!rb, dentro: !!rb && rb.r <= innerWidth && rb.b <= innerHeight, encosta, meio: !!no && (no === b || b.contains(no)),
          x: rb ? (rb.x + rb.r) / 2 : 0, y: rb ? (rb.y + rb.b) / 2 : 0 };
      });
      if (v.botao) await s.pagina.mouse.click(v.x, v.y);
      await fr.waitForFunction(() => window.__golaco.tm.mensagens.some(m => m.tipo === 'tm3d:sair'), null, { timeout: 5000 }).catch(() => {});
      const ms = await msgsTM(fr), est = await fr.evaluate(() => ({ tick: window.__golaco.mundo.tick, fase: window.__golaco.prejogo?.fase }));
      meta('E14r R4* a reserva no TM (o módulo da tela bloqueado): a abertura de texto com o "Simular partida" no canto, sem encostar no texto (revisão A6) → tm3d:sair "simular", tick 0',
        `${JSON.stringify(v)}; ${ms.map(m => m.tipo + '/' + (m.motivo ?? '')).join(', ')}; ${JSON.stringify(est)}`, 'sem tela, abertura, botão dentro e livre; tm3d:sair/simular (11+11); tick 0',
        !v.tela && v.fase === 'abertura' && v.botao && v.dentro && !v.encosta && v.meio && saiuSimular(ms) && est.tick === 0);
    } finally { await s.navegador.close(); }
  }
}

// ================================================================================================ online: duas abas pelo BroadcastChannel
// ================================================================================================ o tempo e a dificuldade (item 33)
if (faz('ajustes')) {
  /** As linhas da info (o texto de cada .pp-info-l) e se alguma passa do lugar dela (o CSS cortaria). */
  const info = pg => pg.evaluate(() => {
    const ls = [...document.querySelectorAll('#prepartida .pp-info-l')].filter(l => l.getClientRects().length);
    return { linhas: ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()), passa: ls.some(l => l.scrollWidth > l.clientWidth + 1) };
  });
  // E23: celular (curta) e PC (longa); o Livre e os Pênaltis sem nível
  {
    const out = [];
    let ok = true;
    for (const [w, h, toque, quer] of [[844, 390, true, 'Difícil'], [568, 320, true, 'Difícil'], [1280, 720, false, 'Dificuldade: Difícil']]) {
      const { navegador, pagina: pg } = await abrirPagina({ w, h, toque, q: `${Q}&prepartida=1&semente=3&dif=dificil` });
      try {
        await quadros(pg, 3);
        const r = await info(pg);
        const tudo = r.linhas.join(' / ');
        const partes = tudo.split(/\s*[|/]\s*/);
        const tem = partes.includes(quer) && (quer !== 'Difícil' || !tudo.includes('Dificuldade'));
        const dur = toque ? tudo.includes('2 × 4 min') : tudo.includes('2 tempos de 4 min');
        const mundo = await pg.evaluate(() => window.__golaco.mundo.dificuldade ?? null);
        out.push(`${w}×${h}: "${tudo}"${r.passa ? ' (PASSA)' : ''}; mundo ${mundo}`);
        if (!tem || !dur || r.passa || mundo !== 'dificil') ok = false;
      } finally { await navegador.close(); }
    }
    for (const [nome, q] of [['Livre', `${Q}&prepartida=1&modo=livre&dif=dificil`], ['Pênaltis', `${Q}&prepartida=1&modo=penaltis&dif=dificil&semente=3`]]) {
      const { navegador, pagina: pg } = await abrirPagina({ w: 844, h: 390, toque: true, q });
      try {
        await quadros(pg, 3);
        const r = await info(pg);
        const tudo = r.linhas.join(' / ');
        out.push(`${nome}: "${tudo}"`);
        if (/Difícil|Normal|Fácil|Lenda|Dificuldade/.test(tudo)) ok = false;
      } finally { await navegador.close(); }
    }
    meta('E23 a dificuldade na linha de informação (item 33): "Difícil" no celular, "Dificuldade: Difícil" no PC, com a duração e sem passar da linha; o Livre e os Pênaltis sem nível',
      out.join(' · '), 'o nível certo em cada tela; nenhum nível no Livre e nos Pênaltis', ok);
  }
  // E24 e E24b: pelo ≡ (a pausa "antes do jogo") → Modo de jogo → Duração 6 e Dificuldade Lenda
  for (const personalizar of [false, true]) {
    const { navegador, pagina: pg, erros } = await abrirPagina({ w: 844, h: 390, toque: true, q: `${Q}&prepartida=1&semente=3` });
    let txt = '', ok = false;
    try {
      await quadros(pg, 3);
      await tecla(pg, 'KeyP');
      const ciclo = await pg.evaluate(async () => {
        document.querySelector('#btn-modos')?.click();
        await new Promise(r => setTimeout(r, 100));
        const bd = document.getElementById('btn-duracao'), bf = document.getElementById('btn-dificuldade');
        const d = () => document.getElementById('estado-duracao')?.textContent, f = () => document.getElementById('estado-dificuldade')?.textContent;
        if (!bd || !bf) return { falta: true };
        const out = [d() + '/' + f()];
        for (let i = 0; i < 7 && d() !== '2 × 6 min'; i++) bd.click();
        for (let i = 0; i < 5 && f() !== 'Lenda'; i++) bf.click();
        out.push(d() + '/' + f());
        return { out };
      });
      await tecla(pg, 'Escape'); await tecla(pg, 'Escape');
      await quadros(pg, 3);
      const r = await info(pg);
      const tudo = r.linhas.join(' / ');
      let antes = await pg.evaluate(() => ({ ticks: window.__golaco.mundo.partida.ticksPorTempo, dif: window.__golaco.mundo.dificuldade ?? null, tick: window.__golaco.mundo.tick, aberta: !!window.__golaco.prepartida.aberta }));
      if (personalizar) {
        // o Personalizar recria o mundo do tick 0 (a escalação mudada): a duração e a dificuldade da página vão junto
        const ESC = await imp('escalacao.js');
        const mx = criarPartida({ semente: 3 });
        let ra = ESC.rascunhoDe(structuredClone(mx.times[0]), null, 0);
        for (const id of [9, 22]) ra = ESC.tocar(ra, id).rasc;
        const ed = ESC.edicaoDe(ra);
        antes = { ...antes, ...(await pg.evaluate(ed => { const g = window.__golaco; const ok2 = g.prepartida.escalar(ed); return { escalou: ok2, ticks: g.mundo.partida.ticksPorTempo, dif: g.mundo.dificuldade ?? null, em22: g.mundo.jogadores.some(j => j.id === 22) }; }, ed)) };
        await quadros(pg, 3);
      }
      await pg.evaluate(() => document.querySelector('#prepartida [data-aba="jogar"]').focus());
      await tecla(pg, 'Enter');
      await pg.waitForTimeout(800);
      const dep = await pg.evaluate(() => { const g = window.__golaco; g.rodarPassos(60, 'demo'); return { aberta: !!g.prepartida.aberta, ticks: g.mundo.partida.ticksPorTempo, dif: g.mundo.dificuldade ?? null, tick: g.mundo.tick }; });
      txt = `${ciclo.falta ? 'sem a linha' : ciclo.out.join(' → ')}; a info "${tudo}"; antes do Jogar ${JSON.stringify(antes)}; depois ${JSON.stringify(dep)}${erros.length ? `; erros ${erros.slice(0, 2).join(' | ')}` : ''}`;
      ok = !ciclo.falta && ciclo.out[1] === '2 × 6 min/Lenda' && tudo.split(/\s*[|/]\s*/).includes('2 × 6 min') && tudo.split(/\s*[|/]\s*/).includes('Lenda') && !r.passa
        && antes.ticks === 21600 && antes.dif === 'lenda' && antes.tick === 0 && antes.aberta && (!personalizar || (antes.escalou && antes.em22))
        && !dep.aberta && dep.ticks === 21600 && dep.dif === 'lenda' && dep.tick > 0 && !erros.length;
    } finally { await navegador.close(); }
    meta(personalizar ? 'E24b depois de um Personalizar (o mundo recriado) a duração e a dificuldade escolhidas pelo ≡ continuam' : 'E24 ≡ → Modo de jogo → Duração 6 e Dificuldade Lenda: a linha diz "2 × 6 min | Lenda" e o Jogar começa com 21 600 ticks e o Lenda',
      txt, '2 × 6 min/Lenda; a info com os dois; 21600 e lenda antes e depois do Jogar', ok);
  }
}

if (faz('online')) {
  const ESPERA = Math.max(10, +arg('--espera', 10));
  const t0on = Date.now();
  const passo = t => { if (args.includes('--log')) console.error(`  [online ${((Date.now() - t0on) / 1000).toFixed(1)} s] ${t}`); };
  const textoAviso = p => p.evaluate(() => { const a = document.getElementById('online-aviso'); return a && !a.hidden ? a.textContent : ''; });
  const on = p => p.evaluate(() => { const g = window.__golaco, o = g.online; return o ? { n: o.n, D: o.D, fase: o.fase, faseRemota: o.faseRemota, encerrado: o.encerrado, hashes: o.hashes, aberta: !!g.prepartida?.aberta, fechadaEm: g.prepartida?.fechadaEm ?? null, pp: g.prepartida?.estado ?? null, editor: g.editor.aberto, tick: g.mundo.tick } : null; });
  const comparar = (x, y) => { const mx = new Map(x.hashes), comuns = y.hashes.filter(([n]) => mx.has(n)); return { comuns: comuns.length, difs: comuns.filter(([n, h]) => mx.get(n) !== h).length, ate: comuns.length ? Math.max(...comuns.map(([n]) => n)) : 0 }; };
  const ate = (p, n, ms = 240000) => p.waitForFunction(k => (window.__golaco.online?.n ?? 0) >= k, n, { timeout: ms }).then(() => true, () => false);
  const espera = ms => new Promise(r => setTimeout(r, ms));
  /**
   * Até `n` passos, reprovando só quando o online.n PARA de andar por `semAndar` ms (teto `teto`): o prazo fixo de 240 s reprovou o
   * O2/O3 com a máquina carregada (as duas abas sem GPU a ~1 quadro por segundo pararam em 1140–1199, todos os hashes iguais; na
   * repetição sozinha, o trecho levou 125 s) — tempo, não defeito.
   */
  async function ateAndando(p, n, semAndar = 90000, teto = 900000) {
    const t0 = Date.now();
    let ultimo = -1, desde = t0;
    while (Date.now() - t0 < teto) {
      const k = await p.evaluate(() => window.__golaco.online?.n ?? 0).catch(() => -1);
      if (k >= n) return true;
      if (k > ultimo) { ultimo = k; desde = Date.now(); } else if (Date.now() - desde > semAndar) return false;
      await espera(2000);
    }
    return false;
  }
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
      // E23 (item 33) no online: a linha de informação sem o nível (duas pessoas: não há dificuldade)
      const infoOn = await A.evaluate(() => [...document.querySelectorAll('#prepartida .pp-info-l')].map(l => l.textContent.replace(/\s+/g, ' ').trim()).join(' / ')).catch(() => '');
      meta('E23 online: a linha de informação sem a dificuldade (item 33)', `"${infoOn}"`, 'sem Fácil/Normal/Difícil/Lenda', !!infoOn && !/Difícil|Normal|Fácil|Lenda|Dificuldade/.test(infoOn));
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
        const chegou = (await Promise.all([ateAndando(A, 1210), ateAndando(B, 1210)])).every(Boolean);
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
        // (a hora de cada toque no [<], pelo relógio da página: no CI sem GPU o quadro passa de 0,5 s e o A.click() com as
        // checagens do Playwright — dois quadros estáveis — mais os quadros entre os toques passavam dos 3 s do armado: o 2º toque
        // re-armava em vez de sair. Os toques vão com force (sem esperar quadros) e, se mesmo assim o intervalo passar do armado,
        // o par se repete — até 3 vezes — antes de reprovar.)
        await A.evaluate(() => {
          window.__toquesCanto = [];
          document.addEventListener('click', e => { if (e.target?.closest?.('#prepartida [data-pp="canto"]')) window.__toquesCanto.push(performance.now()); }, { capture: true });
        });
        const ARMADO_MS = 3000;
        let dois = null, intervalo = null, tentativas = 0;
        const t0 = Date.now();
        while (tentativas < 3) {
          // (cada tentativa começa desarmada: a anterior, lenta demais, re-armou no 2º toque — espera o armado vencer)
          if (tentativas > 0) await espera(ARMADO_MS + 300);
          tentativas++;
          await A.click('#prepartida [data-pp="canto"]', { force: true });
          const d = await on(A);
          if (!dois) dois = d;
          await A.click('#prepartida [data-pp="canto"]', { force: true });
          intervalo = await A.evaluate(() => { const t = window.__toquesCanto; return t.length >= 2 ? Math.round(t[t.length - 1] - t[t.length - 2]) : null; });
          if (intervalo != null && intervalo < ARMADO_MS) break;
          if ((await on(A)).encerrado) break;
        }
        const recebeu = await B.waitForFunction(() => window.__golaco.online.encerrado, null, { timeout: 10000 }).then(() => Date.now() - t0, () => null);
        a = await on(A); b = await on(B);
        meta('O6 sem Personalizar no online (Y e o toque no campinho não abrem o editor); "Sair da partida" só no 2º toque (3 s); o outro recebe o abandono',
          `editor ${!semEditor ? 'abriu' : 'não'}; 1º toque: A ${um.encerrado ? 'saiu' : `armado ${um.pp.armado}`}, B ${umB.encerrado ? 'recebeu' : 'nada'}; passados 3,5 s, outro toque: ${dois.encerrado ? 'saiu' : `armado ${dois.pp.armado}`}; 2º toque (${intervalo} ms depois, ${tentativas} tentativa${tentativas > 1 ? 's' : ''}): A ${a.encerrado ? 'saiu' : 'não'}, B ${recebeu == null ? 'não recebeu' : `recebeu em ${recebeu} ms`}`,
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

// ================================================================================================ fotos da edição pro (item 31)
if (faz('fotos')) {
  const fs = await import('node:fs');
  const ORIGEM = new URL(srv.url).origin;
  const PASTA = path.resolve(RAIZ, '../legacy-total-match/assets/jogadores');
  const JPGS = fs.existsSync(PASTA) ? fs.readdirSync(PASTA).filter(f => /^br-.*\.jpg$/.test(f)).sort().slice(0, 80) : [];
  const jpgDe = k => { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return fs.readFileSync(path.join(PASTA, JPGS[h % JPGS.length])); };
  // um titular de cada lado SEM foto (o 4º do mandante e o 6º do visitante)
  const SEM = ['home:3', 'away:5'];
  const abrirFotos = async (ped, w, h, toque, f404 = false) => {
    const ctx = await abrir({ largura: w, altura: h, toque, dpr: toque ? 2 : 1 });
    const fotos = { pedidos: 0, consoles404: 0 };
    await ctx.contexto.addInitScript(([id, json]) => { try { localStorage.setItem('tm3d:pedido:' + id, json); } catch (_) { /* */ } }, [ped.id, JSON.stringify(ped)]);
    await ctx.contexto.route('**/__fotos/**', r => { fotos.pedidos++; if (f404 || !JPGS.length) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'cache-control': 'max-age=600' }, body: jpgDe(new URL(r.request().url()).pathname) }); });
    ctx.pagina.on('console', m => { if (m.type() === 'error' && /\/__fotos\//.test(m.location()?.url ?? '')) fotos.consoles404++; });
    await ctx.pagina.goto(`${srv.url}?${Q}&prepartida=1&tm=${ped.id}&corpo=manequim${toque ? '&toque=1&entalhe=1' : ''}`);
    await ctx.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
    ctx.fotos = fotos;
    ctx.t0 = Date.now();
    return ctx;
  };
  // as fichas do time mostrado: com foto carregada (e a caixa = a do miolo), com <img> sem carregar, só com o busto
  const fichasFoto = pg => pg.evaluate(() => {
    const out = { n: 0, comFoto: 0, imgs: 0, busto: 0, fora: [], semFotoIds: [] };
    for (const f of document.querySelectorAll('#prepartida .pp-ficha')) {
      const m = f.querySelector('.pp-miolo');
      if (!m) continue;
      out.n++;
      const im = m.querySelector('img.pp-foto');
      if (im) out.imgs++;
      if (m.querySelector('.pp-busto')) out.busto++;
      if (im && im.complete && im.naturalWidth > 0 && im.getClientRects().length) {
        out.comFoto++;
        // (a caixa do LAYOUT: o leve aproximar da foto é um transform, recortado pelo miolo)
        if (im.offsetParent !== m || Math.abs(im.offsetLeft) > 1 || Math.abs(im.offsetTop) > 1 || Math.abs(im.offsetWidth - m.clientWidth) > 1 || Math.abs(im.offsetHeight - m.clientHeight) > 1) out.fora.push(f.dataset.vaga);
      } else out.semFotoIds.push(+f.dataset.id);
    }
    return out;
  });
  for (const [w, h, toque] of [[844, 390, true], [1280, 720, false]]) {
    const ped = comFotos({ ...PED_A, id: `f31pp${w}` }, ORIGEM, { sem: SEM });
    const ctx = await abrirFotos(ped, w, h, toque);
    const pg = ctx.pagina;
    try {
      if (!(await temTela(pg))) { meta(`E22a ${w}×${h}`, 'sem tela', 'a tela', false); continue; }
      const ate = await pg.waitForFunction(() => { const n = document.querySelectorAll('#prepartida .pp-ficha img.pp-foto').length; return [...document.querySelectorAll('#prepartida .pp-ficha img.pp-foto')].filter(i => i.complete && i.naturalWidth > 0).length >= 10 && n >= 10; }, null, { timeout: 3000, polling: 50 })
        .then(() => (Date.now() - ctx.t0) / 1000).catch(() => null);
      const linhas = [];
      let ok = ate != null;
      for (const t of [0, 1]) {
        if (t === 1) { await pg.evaluate(() => window.__golaco.prepartida.adversario(1)); await pg.waitForTimeout(400); }
        const f = await fichasFoto(pg);
        // o titular sem foto deste time: o busto e nenhuma <img>
        const semId = t === 0 ? 1004 : 2006;
        const semOk = await pg.evaluate(id => { const m = document.querySelector(`#prepartida .pp-ficha[data-id="${id}"] .pp-miolo`); return !!m && !!m.querySelector('.pp-busto') && !m.querySelector('img'); }, semId);
        const med = await pg.evaluate(MEDIR);
        const okT = f.n === 11 && f.comFoto === 10 && f.imgs === 10 && f.busto === 11 && f.fora.length === 0 && f.semFotoIds.join() === String(semId) && semOk && med && med.prob.length === 0;
        if (!okT) ok = false;
        linhas.push(`time ${t}: ${f.comFoto}/${f.n} com foto (${f.imgs} <img>), busto ${f.busto}, foto fora do miolo [${f.fora}], sem foto [${f.semFotoIds}] ${semOk ? 'com o busto' : 'ERRADO'}; E4 ${med ? med.prob.length ? med.prob.slice(0, 3).join(', ') : 'nada encosta' : 'sem medida'}`);
      }
      meta(`E22a ${w}×${h}${toque ? ' com toque' : ''}: em ≤ 3 s depois do pronto, 10/11 fichas com a foto no miolo (o sem foto com o busto), os dois times; nada encosta`, `${ate != null ? `${ate.toFixed(2)} s` : 'não chegou em 3 s'}; ${linhas.join(' · ')}`, '≤ 3 s; 10/11 nos dois; nada encosta', ok);
      const ft = await pg.evaluate(() => { const f = window.__golaco.tm?.fotos; return f ? { primeiraEm: f.primeiraEm, prontoEm: f.prontoEm, pedidas: f.pedidas } : null; });
      meta(`E22b ${w}×${h}: a 1ª foto pedida DEPOIS do pronto`, ft ? `pronto ${ft.prontoEm?.toFixed(0)} ms, 1ª pedida ${ft.primeiraEm?.toFixed(0)} ms (${ft.pedidas} pedidas; rota ${ctx.fotos.pedidos})` : 'sem a API das fotos', '1ª ≥ pronto', !!ft && ft.prontoEm != null && ft.primeiraEm != null && ft.primeiraEm >= ft.prontoEm && ft.pedidas >= 20);
    } finally { await ctx.navegador.close(); }
  }
  // E22c o mesmo pedido PÚBLICO
  {
    const ped = comFotos({ ...PED_A, id: 'f31ppPub' }, ORIGEM, { sem: SEM, edicao: 'public' });
    const ctx = await abrirFotos(ped, 844, 390, true);
    try {
      await ctx.pagina.waitForTimeout(3000);
      const f = await fichasFoto(ctx.pagina);
      meta('E22c o mesmo pedido PÚBLICO: 0 fotos nas fichas, 0 pedidos às fotos (o busto em todas)', `${f.imgs} <img>, ${f.busto}/${f.n} com o busto; pedidos às fotos ${ctx.fotos.pedidos}`, '0; 11/11; 0', f.n === 11 && f.imgs === 0 && f.busto === 11 && ctx.fotos.pedidos === 0);
    } finally { await ctx.navegador.close(); }
  }
  // E22d as fotos em 404
  {
    const ped = comFotos({ ...PED_A, id: 'f31pp404' }, ORIGEM, { sem: SEM });
    const ctx = await abrirFotos(ped, 1280, 720, false, true);
    try {
      await ctx.pagina.waitForFunction(() => { const f = window.__golaco.tm?.fotos; return !f || (f.pedidas >= 20 && f.erros >= f.pedidas); }, null, { timeout: 15000 }).catch(() => {});
      await ctx.pagina.waitForTimeout(300);
      const f = await fichasFoto(ctx.pagina);
      const errs = ctx.erros.filter(e => !/Failed to load resource/.test(e));
      const n404 = ctx.erros.length - errs.length;
      meta('E22d as fotos em 404: todas com o busto, nenhuma <img> visível; nenhum erro além dos 404 das fotos', `${f.comFoto} fotos visíveis, ${f.imgs} <img>, busto ${f.busto}/${f.n}; 404 no console ${n404} (das fotos ${ctx.fotos.consoles404}); outros erros ${errs.length}${errs.length ? ': ' + errs[0].slice(0, 80) : ''}`,
        '0; 0; 11/11; 0', f.n === 11 && f.comFoto === 0 && f.imgs === 0 && f.busto === 11 && errs.length === 0 && n404 <= ctx.fotos.consoles404);
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
