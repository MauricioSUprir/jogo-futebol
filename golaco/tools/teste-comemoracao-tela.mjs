// Comemoração do gol no navegador (Chromium; pedido do dono de 11/10: "não tem cena de comemoração!!!"). Na página de
// verdade (main.js + js/comemoracao.js + camera.js + hud.js), relógio manual a 60 qps:
//   A) gol ROTEIRIZADO do time 0 (tools/lib/gol-roteirizado.mjs) no PC 1280×720:
//      A1 as fases rede → corrida → final → abraço → reação, em 6–8,5 s;
//      A2 o autor DENTRO do quadro em ≥ 85% dos quadros da corrida e da finalização, com ≥ 100 px de altura (a caixa da
//         pose desenhada pela câmera de verdade; sem cena, a do autor da simulação) — antes: 0 quadros;
//      A3 durante a cena a simulação não passa do passo antes da saída (gol + 149) e o relógio da partida não anda
//         depois que ela para ali;
//      A4 a ordem gol → comemoração → replay → saída: o replay do gol começa quando a cena acaba e a saída sai no MESMO
//         tick de sempre (gol + 150) com o mesmo hash que sem a comemoração (?comemoracao=0) no tick gol + 600;
//      A5 só o placar, o "GOL!" até o 1º corte e o cartão do autor depois dele (item 31) na tela: minimapa, menu, avisos e
//         painel escondidos; o "GOL!" sai no 1º corte;
//      A6 no contraplano do abraço a torcida enche ≥ 30% do quadro (o mesmo quadro com e sem a torcida; com ?autorGol=0);
//   B) pular (PC, teclado): K antes de 0,5 s não pula; K depois de 0,5 s acaba a cena em ≤ 2 quadros; a saída sai no
//      mesmo tick (os passos que faltavam rodam na cortina) com o mesmo hash; o K ainda segurado NÃO pula o replay, um
//      2º aperto pula (dois apertos: comemoração e replay);
//   C) celular 844×390 com toque: botões de toque e minimapa escondidos na cena; "Pular" (≥ 48 px, dentro da tela, sem
//      encostar no placar nem no "GOL!"); toque antes de 0,5 s não pula, depois pula; os botões voltam no fim; C3/C4
//      (contraprova) o analógico de descanso volta ao canto de baixo depois da cena — pulada pelo toque com o replay
//      inteiro, e com a janela mudando de tamanho no meio dela (antes ia para o alto da tela, embaixo do placar);
//   D) gol NATURAL (IA × IA, achado em Node com a entrada da página): a cena inteira (fases, autor no quadro);
//   E) treino (condução): gol sem cena (o efeito do treino de sempre) e o mesmo hash com e sem ?comemoracao;
//   F) CPU do quadro durante a cena (sem o desenho) ≤ p95 do quadro do jogo + 1 ms;
//   G) console sem erros.
//   H) (item 31) o CARTÃO DO AUTOR (#autor-gol; a fase pelo DOM — hidden/saindo —, nunca pela animação):
//      H1 (o gol do A, PC 1280×720 sem ?tm) aparece com t ∈ [1,55; 1,75] s, fica ≥ 3,0 s, com o número e o nome da ficha do
//         autor e SEM foto; 0 quadros com o "GOL!" junto, 0 no plano da rede; some ≥ 0,4 s antes do replay; 0 quadros no replay
//         nem depois da cena até o gol + 600;
//      H2 nada encosta: a ≥ 8 px do placar e do "Pular" (com toque), dentro da janela e da área segura; e não cobre o autor (a
//         pose desenhada: comemoracao.naTela) em nenhum quadro — no A, no H3, no H4 e no D;
//      H3 celular 844×390 com toque e entalhe, ?tm PRO com as fotos (a rota /__fotos/ servindo JPGs de verdade do TM): a foto do
//         tmId do autor no pedido (naturalWidth > 0 no 1º quadro do cartão: a <img> já decodificada), 88–96 px, número ≥ 22 px e
//         nome (o da camisa) ≥ 14 px; um gol CONTRA no mesmo mundo: nenhum cartão (estado.cartao null, 0 quadros);
//      H4 celular 568×320 com toque, ?tm PÚBLICO com as mesmas fotos no pedido: sem foto, 0 pedidos às fotos, letras ≥ 22 / ≥ 14,
//         nada encosta;
//      H5 a cena curta (o gol do time 1, PC): aparece, ≥ 2,2 s, some antes do replay;
//      H6 pular com o cartão na tela (K em t ≈ 2,2 s, PC): some em ≤ 1 quadro; 0 quadros na cortina e no replay;
//      H7 PC 1366×600, ?tm PRO com as fotos todas em 404: o cartão sem foto; erros = 22; nenhum erro de página além dos 404 delas;
//      H8 ?autorGol=0 (a página do A6): a cena sem cartão (estado.cartao null, 0 quadros);
//      H9 o "Replay" da pausa pedido com o cartão na tela (a página do H5): o cartão escondido com a pausa aberta e o replay
//         inteiro (0 quadros com o cartão e o replay juntos, nunca cruzando a marca REPLAY); depois a cena continua (antes da
//         correção R1 da revisão: o cartão congelado por cima da jogada e da marca REPLAY em todos os quadros);
//      H10 (revisão V1) o nome COMPLETO da ficha também no celular, sem reticências (os pedidos do H3 e do H4 com o último nome de 11
//         letras: o de camisa do tm-times o corta em 10 — "Albuquerqu");
//      H11 (revisão V3) o nome é a linha principal (letra maior que a do número, que vai na pílula com a sigla) e, com foto, a
//         coluna centrada na altura dela (± 3 px);
//      H12 (revisão V4) sem foto, o cartão de uma linha na altura do placar (os topos e os pés a ± 1 px) — 568×320 e PC.
// Na versão sem a cena (--raiz <cópia da main>) reprova: A2 (o autor fica fora do quadro) e o resto que pede a cena. Na versão
// sem o cartão (a base do item 31) reprovam H1–H7 e H9–H12; antes das correções da revisão (b719f4ed) reprovam H9–H12.
//   node tools/teste-comemoracao-tela.mjs [--raiz <pasta do jogo>] [--so A,B,C,D,E,F,H]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import fs from 'node:fs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';
import { acharGol } from './lib/acha-gol.mjs';
import { PED_A, comFotos, urlFoto } from './lib/pedidos-tm.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const SO = args.includes('--so') ? args[args.indexOf('--so') + 1].split(',') : null;
const faz = x => !SO || SO.includes(x);
const res = [];
const meta = (nome, medido, alvo, ok, info = false) => { res.push({ nome, medido, alvo, ok: !!ok, info }); };
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const errosTodos = [];
const srv = await servidor(0, raiz);

// (item 31) as fotos do TM pela rota /__fotos/<lado>/<tmId>.jpg: JPGs de verdade do TM (legacy-total-match/assets/jogadores),
// um por tmId; com f404, todas em 404 (o "Failed to load resource" delas sai dos erros do G — só o delas)
const PASTA_FOTOS = path.resolve(raiz, '../legacy-total-match/assets/jogadores');
const JPGS = fs.existsSync(PASTA_FOTOS) ? fs.readdirSync(PASTA_FOTOS).filter(f => /^br-.*\.jpg$/.test(f)).sort().slice(0, 80) : [];
const jpgDe = k => { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return fs.readFileSync(path.join(PASTA_FOTOS, JPGS[h % JPGS.length])); };
async function pagina(url, opc = {}) {
  const nav = await abrir({ largura: opc.largura ?? 1280, altura: opc.altura ?? 720, dpr: opc.dpr ?? 1, toque: opc.toque });
  const fotos = { pedidos: 0, n404: 0, consoles404: 0 };
  if (opc.pedido) await nav.contexto.addInitScript(([id, json]) => { try { localStorage.setItem('tm3d:pedido:' + id, json); } catch (_) { /* */ } }, [opc.pedido.id, JSON.stringify(opc.pedido)]);
  await nav.contexto.route('**/__fotos/**', r => {
    fotos.pedidos++;
    if (opc.f404 || !JPGS.length) { fotos.n404++; return r.fulfill({ status: 404, body: '' }); }
    return r.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'cache-control': 'max-age=600' }, body: jpgDe(new URL(r.request().url()).pathname) });
  });
  nav.pagina.on('console', m => { if (m.type() === 'error' && /\/__fotos\//.test(m.location()?.url ?? '')) fotos.consoles404++; });
  await nav.pagina.goto(srv.url + url, { waitUntil: 'load' });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
  await nav.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return {
    ...nav, fotos,
    fechar: async () => {
      // os 404 das fotos de propósito (H7): o texto do Chromium não tem o endereço — sai um por 404 visto na rota
      let tirar = fotos.consoles404;
      const errs = nav.erros.filter(e => !(tirar > 0 && /Failed to load resource/.test(e) && tirar--));
      errosTodos.push(...errs);
      await nav.navegador.close();
    },
  };
}


/**
 * Anda a página quadro a quadro (1/60 s, sem desenhar) do gol até o tick gol + 600 (ou maxQ quadros), amostrando a
 * cena: fase, plano, o autor na tela, a simulação, o relógio, o replay e o HUD. Com `pular` = {em: t, tecla}, aperta a
 * tecla quando a cena passa de t s.
 */
async function acompanhar(pg, gol, opc = {}) {
  return pg.evaluate(({ gol, opc }) => {
    const g = window.__golaco, m = g.mundo, temC = !!g.comemoracao;
    const desde = m.partida.desde;
    const out = { q: [], saidaTick: null, hash: null, replay: null, replayDepois: null, fimCena: null, golAte: null, n: 0 };
    const vis = id => { const e = document.getElementById(id) ?? document.querySelector(id); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; };
    // autor na tela sem a cena (a versão antiga): a caixa dos pés à cabeça do jogador da simulação
    const autorSim = () => {
      const j = m.jogadores.find(q => q.id === gol.autor);
      if (!j) return null;
      const a = g.naTela(j.x, 0, j.z), b = g.naTela(j.x, 1.85, j.z);
      const W = window.innerWidth, H = window.innerHeight;
      return { altura: Math.abs(a.y - b.y), dentro: a.x > 0 && a.x < W && b.y > 0 && a.y < H };
    };
    let tick0 = null, minuto0 = null;
    const alvo = gol.golTick + 600;
    // (item 31) o cartão do autor: por quadro na cena (caixa, foto, letras, a do autor) e depois dela (só se aparece)
    const cartao = g => { const a = g.comemoracao && g.comemoracao.cartaoTela; return a && a.visivel ? a : null; };
    const caixaDe = s => { const e = document.querySelector(s); const r = e?.getBoundingClientRect(); return r && r.width > 0 && getComputedStyle(e).display !== 'none' ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null; };
    out.cartaoDepois = 0; out.cartaoReplay = 0; out.geo = null;
    while (out.n < (opc.maxQ ?? 3000)) {
      g.relogio.avancar(1000 / 60, { desenhar: false }); out.n++;
      const e = temC ? g.comemoracao.estado : null, rp = g.replay?.estado;
      if (e) {
        const tela = g.comemoracao.naTela();
        const parada = m.partida.estado === 'gol' && m.tick + 1 - desde >= 150;
        if (parada && tick0 == null) { tick0 = m.tick; minuto0 = g.estado().relogio.minuto; }
        const ag = cartao(g);
        if (ag && !out.geo) {
          const s = document.createElement('i');
          s.style.cssText = 'position:fixed;padding:var(--sa-t,0px) var(--sa-r,0px) var(--sa-b,0px) var(--sa-l,0px)';
          document.body.appendChild(s); const cs = getComputedStyle(s);
          out.geo = { W: innerWidth, H: innerHeight, sa: { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 }, placar: caixaDe('#hud .placar'), pular: caixaDe('#comemoracao-pular') };
          s.remove();
        }
        out.q.push({ t: e.t, fase: e.fase, plano: e.plano, estado: e.estado, tick: m.tick, alt: tela ? tela.altura : 0, dentro: !!(tela && tela.dentro), minuto: g.estado().relogio.minuto, parada,
          gol: document.getElementById('gol-tela').classList.contains('visivel'), mapa: vis('minimapa'), menu: vis('btn-menu'), painel: vis('#hud .painel-jogo'), placar: vis('#hud .placar'),
          n: out.n, rp: !!rp?.ativo, ca: e.cartao ?? null, co: !!e.contra, cu: !!e.curta, ag: ag ? { saindo: ag.saindo, foto: ag.foto, fotoSrc: ag.fotoSrc, num: ag.num, nome: ag.nome, caixa: ag.caixa, fotoCaixa: ag.fotoCaixa, letraNum: ag.letraNum, letraNome: ag.letraNome, cortado: ag.cortado, textoCaixa: ag.textoCaixa } : null,
          ab: tela && !tela.atras ? { x0: tela.x0, y0: tela.y0, x1: tela.x1, y1: tela.y1 } : null });
        if (opc.pular && e.estado === 'rodando' && e.t >= opc.pular.em && !out.apertou) { out.apertou = { t: e.t, n: out.n }; window.__aperta = true; break; }
      } else if (m.partida.estado === 'gol' && !out.q.length) {
        // sem cena (versão antiga): o pós-gol na câmera do jogo
        const a = autorSim();
        out.q.push({ t: (m.tick - gol.golTick) / 60, fase: 'sem cena', plano: g.estadio.planoCamera, tick: m.tick, alt: a ? a.altura : 0, dentro: !!(a && a.dentro), semCena: true });
      } else if (m.partida.estado === 'gol') {
        const a = autorSim();
        out.q.push({ t: (m.tick - gol.golTick) / 60, fase: 'sem cena', plano: g.estadio.planoCamera, tick: m.tick, alt: a ? a.altura : 0, dentro: !!(a && a.dentro), semCena: true });
      }
      if (out.fimCena == null && out.q.length && !e && !out.q[out.q.length - 1].semCena) out.fimCena = { n: out.n, tick: m.tick };
      if (!e && cartao(g)) { out.cartaoDepois++; if (rp?.ativo) out.cartaoReplay++; }
      if (rp?.ativo && !out.replay) out.replay = { tipo: rp.tipo, tick: m.tick, n: out.n };
      if (out.replay && !rp?.ativo && !out.replayDepois) out.replayDepois = { n: out.n, tick: m.tick };
      if (out.saidaTick == null && m.partida.estado !== 'gol' && m.tick > gol.golTick + 10) out.saidaTick = m.tick;
      if (m.tick >= alvo) { out.hash = g.hash(); break; }
    }
    out.tickParada = tick0; out.minuto0 = minuto0; out.desde = desde;
    return out;
  }, { gol, opc });
}

/**
 * (item 31) O cartão do autor num acompanhar: entra (t do 1º quadro visível), fica (s até o 1º quadro saindo ou escondido),
 * quadros com o "GOL!" junto, no plano da rede, no replay e depois da cena, a folga até o replay (s), cobre o autor (quadros com
 * a caixa dele cruzando a do cartão) e a 1ª amostra visível (foto, letras, caixa).
 */
function avaliarCartao(r) {
  const q = r.q.filter(x => !x.semCena);
  const vis = q.filter(x => x.ag);
  const i0 = q.findIndex(x => x.ag);
  let fica = 0;
  if (i0 >= 0) { let k = i0; while (k < q.length && q[k].ag && !q[k].ag.saindo) k++; fica = (k - i0) / 60; }
  const ultimo = vis.length ? vis[vis.length - 1].n : null;
  const cruza = (a, b) => !!a && !!b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  return {
    n: vis.length, entra: i0 >= 0 ? q[i0].t : null, fica, comGol: vis.filter(x => x.gol).length, naRede: vis.filter(x => x.plano === 'rede' || x.fase === 'rede').length,
    noReplay: vis.filter(x => x.rp).length + (r.cartaoReplay ?? 0), depois: r.cartaoDepois ?? 0,
    folga: ultimo != null && r.replay ? (r.replay.n - ultimo) / 60 : null, cobre: vis.filter(x => cruza(x.ag.caixa, x.ab)).length,
    a: i0 >= 0 ? q[i0].ag : null, ca: q.find(x => x.ca)?.ca ?? null, semEstado: q.every(x => x.ca == null),
  };
}
/** (revisão V4) H12: o cartão sem foto na altura do placar, na mesma linha (o topo e o pé a ± 1 px dos dele). */
function alinhadoAoPlacar(r, c) {
  const p = r.geo?.placar, cx = c.a?.caixa;
  if (!p || !cx) return { ok: false, texto: 'sem cartão ou sem placar' };
  const dTopo = cx.y0 - p.y0, dPe = cx.y1 - p.y1;
  return { ok: Math.abs(dTopo) <= 1 && Math.abs(dPe) <= 1, texto: `cartão ${Math.round(cx.y0)}–${Math.round(cx.y1)} × placar ${Math.round(p.y0)}–${Math.round(p.y1)} (topo ${f2(dTopo)}, pé ${f2(dPe)} px)` };
}
/** (item 31) H2: o cartão a ≥ 8 px do placar e do "Pular", dentro da janela e da área segura (a 1ª amostra visível e a geometria). */
function encostos(r, c) {
  const g = r.geo, cx = c.a?.caixa;
  if (!g || !cx) return { ok: false, texto: 'sem cartão' };
  const longe = (a, b, d) => !a || !b || a.x0 >= b.x1 + d || b.x0 >= a.x1 + d || a.y0 >= b.y1 + d || b.y0 >= a.y1 + d;
  const dentro = cx.x0 >= g.sa.l - 0.5 && cx.y0 >= g.sa.t - 0.5 && cx.x1 <= g.W - g.sa.r + 0.5 && cx.y1 <= g.H - g.sa.b + 0.5;
  const ok = dentro && longe(cx, g.placar, 8) && longe(cx, g.pular, 8);
  const r0 = v => Math.round(v);
  return { ok, texto: `caixa ${r0(cx.x0)}–${r0(cx.x1)} × ${r0(cx.y0)}–${r0(cx.y1)} em ${g.W}×${g.H}; placar até x ${g.placar ? r0(g.placar.x1) : '-'}; pular ${g.pular ? `${r0(g.pular.x0)},${r0(g.pular.y0)}` : '-'}; dentro ${dentro}` };
}

// ------------------------------------------------------------------------------------------------ A (PC, roteirizado)
let hashSem = null, saidaSem = null;
if (faz('A') || faz('B')) {
  const P = await pagina('?q=baixa&hora=dia&semente=5&comemoracao=0');
  try {
    const gol = await golRoteirizado(P.pagina, { semente: 5, time: 0 });
    const r = await acompanhar(P.pagina, gol);
    hashSem = r.hash; saidaSem = r.saidaTick - r.desde;
  } finally { await P.fechar(); }
}
let A = null;
if (faz('A')) {
  const P = await pagina('?q=alta&hora=dia&semente=5');
  try {
    const pg = P.pagina;
    const temC = await pg.evaluate(() => !!window.__golaco.comemoracao);
    const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
    const r = await acompanhar(pg, gol);
    A = { gol, r, temC };
    const q = r.q.filter(x => !x.semCena && x.estado === 'rodando');
    const fases = [];
    for (const x of q) if (fases[fases.length - 1] !== x.fase) fases.push(x.fase);
    const dur = q.length / 60;
    meta('A1 fases da cena e duração', temC ? `${fases.join(' → ') || '-'}; ${f2(dur)} s` : 'sem cena', 'rede → corrida → final → abraço → reação; 6–8,5 s',
      fases.join(',') === 'rede,corrida,final,abraco,reacao' && dur >= 6 && dur <= 8.5);
    const cf = temC ? q.filter(x => x.fase === 'corrida' || x.fase === 'final') : r.q;
    const bons = cf.filter(x => x.dentro && x.alt >= 100).length;
    meta('A2 o autor no quadro (corrida e finalização; ≥ 100 px a 720 p)', `${bons}/${cf.length} quadros (${f2(100 * bons / Math.max(1, cf.length))}%); altura mediana ${f2(cf.map(x => x.alt).sort((a, b) => a - b)[cf.length >> 1])} px`, '≥ 85%',
      cf.length > 0 && bons / cf.length >= 0.85);
    const maxTick = Math.max(...q.map(x => x.tick), -1);
    const parados = q.filter(x => x.parada);
    const minutoAnda = parados.some(x => x.minuto !== r.minuto0);
    meta('A3 a simulação espera no passo antes da saída; o relógio da partida não anda', temC ? `tick máx na cena ${maxTick} (gol + ${maxTick - r.desde}); parada em ${parados.length} quadros; minuto ${r.minuto0}${minutoAnda ? ' ANDOU' : ' parado'}` : 'sem cena',
      'gol + 149; minuto parado', temC && maxTick - r.desde <= 149 && parados.length > 60 && !minutoAnda);
    meta('A4 ordem gol → comemoração → replay → saída; mesmo tick e hash', `replay ${r.replay ? `${r.replay.tipo} no quadro ${r.replay.n} (cena acabou no ${r.fimCena?.n ?? '-'})` : 'nenhum'}; saída gol + ${r.saidaTick - r.desde} (sem a cena: + ${saidaSem}); hash ${r.hash} × ${hashSem}`,
      'replay logo depois da cena; + 150; iguais', temC && r.replay?.tipo === 'gol' && r.fimCena && r.replay.n - r.fimCena.n <= 2 && r.saidaTick - r.desde === 150 && saidaSem === 150 && r.hash === hashSem && r.hash != null);
    const corte = q.findIndex(x => x.fase !== 'rede');
    const golNaRede = q.slice(0, Math.max(1, corte)).some(x => x.gol), golDepois = q.slice(corte + 2).some(x => x.gol);
    const hudMau = q.filter(x => x.mapa || x.menu || x.painel || !x.placar).length;
    meta('A5 tela da cena: só o placar, o "GOL!" até o 1º corte e o cartão do autor depois dele', temC ? `"GOL!" na rede ${golNaRede}, depois do corte ${golDepois}; quadros com minimapa/menu/painel ou sem placar: ${hudMau}` : 'sem cena',
      '"GOL!" só na rede; 0', temC && golNaRede && !golDepois && hudMau === 0);
    // H1/H2 (item 31): o cartão do autor neste mesmo gol
    const c = avaliarCartao(r);
    const ficha = await pg.evaluate(async id => { const { fichaDe } = await import('./js/elenco.js'); const f = fichaDe(id); return f ? { num: String(f.num), nome: f.nome } : null; }, gol.autor);
    meta('H1 o cartão do autor (PC, sem ?tm): entra 1,55–1,75 s, fica ≥ 3,0 s, o número e o nome da ficha, sem foto', c.a ? `entra ${f2(c.entra)} s, fica ${f2(c.fica)} s; ${c.a.num} ${c.a.nome} (ficha ${ficha?.num} ${ficha?.nome}); foto ${c.a.foto}, caixa da foto ${!!c.a.fotoCaixa}` : 'nenhum cartão',
      '1,55–1,75; ≥ 3,0; iguais; sem foto', !!c.a && c.entra >= 1.55 && c.entra <= 1.75 && c.fica >= 3.0 && c.a.num === ficha?.num && c.a.nome === ficha?.nome && !c.a.foto && !c.a.fotoCaixa);
    meta('H1 nunca com o "GOL!" nem no plano da rede; some ≥ 0,4 s antes do replay; 0 quadros no replay e depois da cena (até o gol + 600)', c.n ? `com o GOL! ${c.comGol}; na rede ${c.naRede}; folga até o replay ${f2(c.folga)} s; no replay ${c.noReplay}; depois da cena ${c.depois}` : 'nenhum cartão',
      '0; 0; ≥ 0,4 s; 0; 0', c.n > 0 && c.comGol === 0 && c.naRede === 0 && c.folga != null && c.folga >= 0.4 && c.noReplay === 0 && c.depois === 0);
    const e = encostos(r, c);
    meta('H2 PC 1280×720: o cartão a ≥ 8 px do placar, na tela; não cobre o autor (a pose desenhada) em nenhum quadro', `${e.texto}; cobre o autor em ${c.cobre}/${c.n} quadros`, 'sem encostar; 0', e.ok && c.n > 0 && c.cobre === 0);
  } finally { await P.fechar(); }
}
// A6: o contraplano do abraço com e sem a torcida (pixels); com ?autorGol=0 (H8: a cena sem o cartão do autor)
if (faz('A')) try {
  const P = await pagina('?q=media&hora=dia&semente=5&autorGol=0');
  try {
    const pg = P.pagina;
    const temC = await pg.evaluate(() => !!window.__golaco.comemoracao);
    if (!temC) meta('A6 contraplano: a torcida enche o quadro', 'sem cena', '≥ 30%', false);
    else {
      await golRoteirizado(pg, { semente: 5, time: 0 });
      const h8 = { q: 0, vis: 0, cartao: 0 };
      const ok = await pg.evaluate(h8 => { const g = window.__golaco; for (let i = 0; i < 900; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); const e = g.comemoracao.estado; if (e) { h8.q++; if (e.cartao) h8.cartao++; const a = g.comemoracao.cartaoTela; if (a && a.visivel) h8.vis++; } if (e && e.fase === 'abraco' && e.plano === 'contraplano' && e.t > e.kFimFinal / 60 + 0.4) return { ok: true, h8 }; } return { ok: false, h8 }; }, h8)
        .then(x => { Object.assign(h8, x.h8); return x.ok; });
      meta('H8 ?autorGol=0: a cena sem o cartão do autor', `${h8.q} quadros da cena: estado.cartao em ${h8.cartao}, visível em ${h8.vis}`, '0; 0', h8.q > 60 && h8.cartao === 0 && h8.vis === 0);
      await pg.evaluate(() => { const g = window.__golaco; g.desenhar(); document.documentElement.classList.add('sem-hud'); g.desenhar(); });
      const com = await pg.screenshot({ type: 'png' });
      await pg.evaluate(() => { const g = window.__golaco; g.estadio.mostrarTorcida(false); g.estadio.mostrarFesta(false); g.desenhar(); });
      const sem = await pg.screenshot({ type: 'png' });
      await pg.evaluate(() => { const g = window.__golaco; g.estadio.mostrarTorcida(true); g.estadio.mostrarFesta(true); document.documentElement.classList.remove('sem-hud'); });
      const aux = await P.contexto.newPage();
      await aux.setContent('<canvas id="c"></canvas>');
      const frac = await aux.evaluate(async ({ a, b }) => {
        const ler = async src => { const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode(); return i; };
        const [ia, ib] = [await ler(a), await ler(b)];
        const c = document.getElementById('c'); c.width = ia.width; c.height = ia.height;
        const g = c.getContext('2d');
        g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
        g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
        let mud = 0, n = 0;
        for (let i = 0; i < da.length; i += 4) { const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3; n++; if (d > 20) mud++; }
        return mud / n;
      }, { a: com.toString('base64'), b: sem.toString('base64') });
      await aux.close();
      meta('A6 contraplano do abraço: a torcida enche o quadro', ok ? `${f2(frac * 100)}% da tela é torcida` : 'o contraplano não chegou', '≥ 30%', ok && frac >= 0.3);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('A6 execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ B (pular no PC)
if (faz('B')) try {
  const P = await pagina('?q=baixa&hora=dia&semente=5');
  try {
    const pg = P.pagina;
    const temC = await pg.evaluate(() => !!window.__golaco.comemoracao);
    const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
    if (!temC) meta('B pular a comemoração (teclado)', 'sem cena', '-', false);
    else {
      // K antes de 0,5 s: nada
      await pg.evaluate(() => { const g = window.__golaco; while (g.comemoracao.estado.t < 0.25) g.relogio.avancar(1000 / 60, { desenhar: false }); });
      await pg.keyboard.down('KeyK');
      const cedo = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 4; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.comemoracao.estado?.estado ?? null; });
      await pg.keyboard.up('KeyK');
      await pg.evaluate(() => { const g = window.__golaco; while (g.comemoracao.estado && g.comemoracao.estado.t < 0.8) g.relogio.avancar(1000 / 60, { desenhar: false }); });
      const t0 = await pg.evaluate(() => ({ t: window.__golaco.comemoracao.estado.t, tick: window.__golaco.mundo.tick, desde: window.__golaco.mundo.partida.desde }));
      await pg.keyboard.down('KeyK');
      const pulo = await pg.evaluate(() => { const g = window.__golaco; let q = 0; while (q < 10 && g.comemoracao.estado?.estado === 'rodando') { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; } return { q, estado: g.comemoracao.estado?.estado ?? 'saiu', rapida: g.comemoracao.estado?.rapida ?? null }; });
      // a cortina: até o replay do gol, com o K ainda segurado
      const rep = await pg.evaluate(desde => { const g = window.__golaco, m = g.mundo; let q = 0; while (q < 60 && !g.replay.estado.ativo) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; } const tick = m.tick; for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return { q, ativo: g.replay.estado.ativo, tipo: g.replay.estado.tipo, tick, desde }; }, t0.desde);
      await pg.keyboard.up('KeyK');
      await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
      await pg.keyboard.down('KeyK');
      const seg = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return { ativo: g.replay.estado.ativo, carga: !!g.estado().jogador?.carga }; });
      await pg.keyboard.up('KeyK');
      const fim = await acompanhar(pg, gol);
      meta('B1 K antes de 0,5 s não pula', `estado ${cedo}`, 'rodando', cedo === 'rodando');
      meta('B2 K depois de 0,5 s acaba a cena em ≤ 2 quadros', `t ${f2(t0.t)} s: ${pulo.q} quadro(s), estado ${pulo.estado}, cortina ${pulo.rapida}`, '≤ 2', pulo.q <= 2 && pulo.estado !== 'rodando');
      meta('B3 a saída no mesmo tick (os passos da cortina) e o replay do gol depois; o K segurado não pula o replay', `replay ${rep.tipo} em ${rep.q} quadros, no tick gol + ${rep.tick - rep.desde}; 30 quadros depois ainda ${rep.ativo}`, 'gol + 150; ainda ativo', rep.tipo === 'gol' && rep.tick - rep.desde === 150 && rep.ativo);
      meta('B4 um 2º aperto pula o replay (e não vira chute)', JSON.stringify(seg), 'ativo false, carga false', !seg.ativo && !seg.carga);
      meta('B5 hash no gol + 600 igual ao de sem a comemoração', `${fim.hash} × ${hashSem}`, 'iguais', fim.hash != null && fim.hash === hashSem);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('B execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ C (celular)
if (faz('C')) try {
  const P = await pagina('?q=media&hora=noite&semente=5&toque=1&entalhe=1', { largura: 844, altura: 390, dpr: 1, toque: true });
  try {
    const pg = P.pagina;
    const temC = await pg.evaluate(() => !!window.__golaco.comemoracao);
    await golRoteirizado(pg, { semente: 5, time: 0 });
    if (!temC) meta('C celular', 'sem cena', '-', false);
    else {
      await pg.evaluate(() => { const g = window.__golaco; while (g.comemoracao.estado.t < 0.2) g.relogio.avancar(1000 / 60, { desenhar: false }); g.relogio.avancar(1000 / 60, { desenhar: true }); });
      const tela = await pg.evaluate(() => {
        const vis = id => { const e = document.getElementById(id) ?? document.querySelector(id); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'; };
        const cx = id => { const e = document.getElementById(id) ?? document.querySelector(id); const r = e?.getBoundingClientRect(); return r && r.width > 0 ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null; };
        const p = cx('comemoracao-pular'), pl = cx('#hud .placar'), gt = cx('gol-tela');
        const enc = (a, b) => !!a && !!b && a.x0 < b.x1 + 4 && b.x0 < a.x1 + 4 && a.y0 < b.y1 + 4 && b.y0 < a.y1 + 4;
        // o "GOL!" grande: o texto (a faixa de fundo atravessa a tela por baixo de tudo, não pega toque)
        const gtTexto = document.querySelector('#gol-tela .gol-palavra');
        const gr = gtTexto?.getBoundingClientRect();
        const gx = gr && gr.width > 0 ? { x0: gr.left, y0: gr.top, x1: gr.right, y1: gr.bottom } : gt;
        return { pular: vis('comemoracao-pular'), toque: getComputedStyle(document.getElementById('toque')).display !== 'none', mapa: vis('minimapa'), caixa: p, dentro: !!p && p.x0 >= 0 && p.y0 >= 0 && p.x1 <= innerWidth && p.y1 <= innerHeight, h: p ? p.y1 - p.y0 : 0, encPlacar: enc(p, pl), encGol: enc(p, gx) };
      });
      meta('C1 celular: botões de toque e minimapa escondidos; "Pular" ≥ 48 px na tela sem encostar no placar nem no "GOL!"', JSON.stringify({ ...tela, caixa: undefined }), 'pular sim; toque e mapa não; ≥ 48 px; sem encostar',
        tela.pular && !tela.toque && !tela.mapa && tela.h >= 48 && tela.dentro && !tela.encPlacar && !tela.encGol);
      await pg.touchscreen.tap(400, 200);
      const cedo = await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: false }); return g.comemoracao.estado?.estado ?? null; });
      await pg.evaluate(() => { const g = window.__golaco; while (g.comemoracao.estado && g.comemoracao.estado.t < 0.9) g.relogio.avancar(1000 / 60, { desenhar: false }); });
      await pg.touchscreen.tap(400, 200);
      const pulou = await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: false }); return g.comemoracao.estado?.estado ?? 'saiu'; });
      const volta = await pg.evaluate(() => { const g = window.__golaco; let q = 0; while (q < 1500 && (g.comemoracao.ativa || g.replay.estado.ativo)) { if (g.replay.estado.ativo) g.replay.pular(); g.relogio.avancar(1000 / 60, { desenhar: false }); q++; } return { q, toque: getComputedStyle(document.getElementById('toque')).display !== 'none', em: document.documentElement.classList.contains('em-comemoracao') }; });
      meta('C2 celular: toque antes de 0,5 s não pula; depois pula; os botões voltam', `antes ${cedo}; depois ${pulou}; botões de volta ${volta.toque} (em ${volta.q} quadros)`, 'rodando; solta; true', cedo === 'rodando' && pulou !== 'rodando' && volta.toque && !volta.em);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('C execução', e.message.split('\n')[0], 'sem exceção', false); }
// C3/C4 (contraprova): os botões de toque ficam escondidos na cena; o analógico de descanso calculado com eles escondidos
// (o "Pular" solta tudo; a janela muda de tamanho — a barra do navegador do celular) ia para o alto da tela, embaixo do
// placar. Depois da cena (e do replay inteiro, sem pular), ele tem de estar onde um layout novo o põe (o resize de verdade).
for (const caso of faz('C') ? ['C3 pular a cena pelo toque e o replay inteiro', 'C4 a janela muda de tamanho no meio da cena'] : []) {
  try {
    const P = await pagina('?q=media&hora=dia&semente=5&toque=1&entalhe=1', { largura: 844, altura: 390, dpr: 1, toque: true });
    try {
      const pg = P.pagina;
      const temC = await pg.evaluate(() => !!window.__golaco.comemoracao);
      const pos = () => pg.evaluate(() => { const r = document.getElementById('analogico').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
      await golRoteirizado(pg, { semente: 5, time: 0 });
      if (!temC) meta(caso, 'sem cena', '-', false);
      else {
        await pg.evaluate(() => { const g = window.__golaco; while (g.comemoracao.estado.t < 1.0) g.relogio.avancar(1000 / 60, { desenhar: false }); });
        if (caso.startsWith('C3')) await pg.touchscreen.tap(400, 200);
        else await pg.setViewportSize({ width: 800, height: 370 });
        await pg.evaluate(() => { const g = window.__golaco, m = g.mundo; let k = 0; while (k < 3000 && (g.comemoracao.ativa || g.replay.estado.ativo || m.partida.estado !== 'jogo')) { g.relogio.avancar(1000 / 60, { desenhar: false }); k++; } g.relogio.avancar(1000 / 60, { desenhar: true }); });
        const depois = await pos();
        await pg.evaluate(() => window.dispatchEvent(new Event('resize')));
        const certo = await pos();
        const d = Math.hypot(depois.x - certo.x, depois.y - certo.y);
        meta(`${caso}: o analógico de descanso no lugar (canto de baixo)`, `depois da cena (${depois.x}, ${depois.y}); layout novo (${certo.x}, ${certo.y}); ${d.toFixed(0)} px`, '≤ 2 px', d <= 2);
      }
    } finally { await P.fechar(); }
  } catch (e) { meta(`${caso}: execução`, e.message.split('\n')[0], 'sem exceção', false); }
}

// ------------------------------------------------------------------------------------------------ D (gol natural)
if (faz('D')) try {
  const GOL = await acharGol({ pastaJs: path.join(raiz, 'js'), maxTicks: 6000, comoPagina: true });
  if (!GOL) meta('D gol natural (IA × IA) nas sementes 1–40', 'nenhum', '≥ 1', false);
  else {
    const P = await pagina(`?q=baixa&hora=dia&demo=1&semente=${GOL.semente}`);
    try {
      const r = await P.pagina.evaluate(() => {
        const g = window.__golaco, temC = !!g.comemoracao;
        let n = 0;
        while (n < 9000 && !(temC ? g.comemoracao.ativa : g.mundo.partida.estado === 'gol')) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; if (g.replay.estado.ativo) g.replay.pular(); }
        if (!temC) return { semCena: g.mundo.partida.estado === 'gol', n };
        const e0 = g.comemoracao.estado;
        const q = [];
        while (g.comemoracao.ativa && q.length < 700) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          const e = g.comemoracao.estado; if (!e) break;
          const tela = g.comemoracao.naTela();
          // (item 31, H2) o cartão do autor e a caixa do autor no mesmo quadro
          const a = g.comemoracao.cartaoTela, cx = a && a.visivel ? a.caixa : null;
          const cobre = !!cx && !!tela && !tela.atras && cx.x0 < tela.x1 && tela.x0 < cx.x1 && cx.y0 < tela.y1 && tela.y0 < cx.y1;
          q.push({ fase: e.fase, dentro: !!(tela && tela.dentro), alt: tela ? tela.altura : 0, estado: e.estado, cartao: !!cx, cobre });
        }
        return { e0, q, n };
      });
      if (!r.q) meta('D gol natural: a cena', `sem cena (gol no quadro ${r.n}: ${r.semCena})`, 'cena', false);
      else {
        const rod = r.q.filter(x => x.estado === 'rodando');
        const fases = []; for (const x of rod) if (fases[fases.length - 1] !== x.fase) fases.push(x.fase);
        const cf = rod.filter(x => x.fase === 'corrida' || x.fase === 'final');
        const bons = cf.filter(x => x.dentro && x.alt >= 100).length;
        const curta = r.e0.curta;
        const comCartao = r.q.filter(x => x.cartao).length, cobre = r.q.filter(x => x.cobre).length;
        meta('H2 gol natural (D): o cartão do autor não cobre o autor', `cartão em ${comCartao} quadros (${r.e0.contra ? 'gol contra: nenhum' : r.e0.curta ? 'cena curta' : 'cena normal'}); cobre em ${cobre}`,
          r.e0.contra ? '0 quadros (gol contra)' : '> 0; 0', r.e0.contra ? comCartao === 0 : comCartao > 0 && cobre === 0);
        meta('D gol natural (semente ' + GOL.semente + '): fases, duração e o autor no quadro', `time ${r.e0.time}${curta ? ' (curta)' : ''}, ${r.e0.variante}, ${r.e0.colegas.length} colegas; ${fases.join(' → ')}; ${f2(rod.length / 60)} s; autor no quadro ${bons}/${cf.length}`,
          `fases na ordem; ${curta ? '3,5–5,5' : '6–8,5'} s; ≥ 85%`, fases[0] === 'rede' && fases.includes('reacao') && (curta ? rod.length / 60 >= 3.5 && rod.length / 60 <= 5.5 : rod.length / 60 >= 6 && rod.length / 60 <= 8.5) && cf.length > 0 && bons / cf.length >= 0.85);
      }
    } finally { await P.fechar(); }
  }
} catch (e) { meta('D execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ E (treino)
if (faz('E')) try {
  const hs = [];
  for (const q of ['', '&comemoracao=0']) {
    const P = await pagina(`?q=baixa&modo=conducao&semente=5${q}`);
    try {
      hs.push(await P.pagina.evaluate(async () => {
        const g = window.__golaco;
        const { criarBola } = await import('./js/bola.js');
        // a página andou em tempo real até o relógio manual: o treino recomeça do zero (as duas páginas no mesmo ponto)
        g.reiniciar({ modo: 'conducao', semente: 5 });
        for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        const m = g.mundo; m.posse = null; Object.assign(m.bola, criarBola(51.5, 0.5)); m.bola.v.x = 9;
        let cena = 0, efeito = 0;
        for (let i = 0; i < 200; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.comemoracao?.ativa) cena++; if (g.estadio.efeitoCamera) efeito++; }
        return { hash: g.hash(), cena, efeito, tick: m.tick };
      }));
    } finally { await P.fechar(); }
  }
  meta('E treino de condução: o gol sem cena (o efeito de sempre) e o mesmo hash', JSON.stringify(hs), 'cena 0; efeito > 0; hash e tick iguais', hs[0].cena === 0 && hs[0].efeito > 0 && hs[0].hash === hs[1].hash && hs[0].tick === hs[1].tick);
} catch (e) { meta('E execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ F (CPU)
if (faz('F')) try {
  const P = await pagina('?q=baixa&hora=dia&semente=5');
  try {
    const pg = P.pagina;
    const temC = await pg.evaluate(() => !!window.__golaco.comemoracao);
    if (!temC) meta('F CPU do quadro na cena', 'sem cena', '-', false);
    else {
      let medida = null;
      for (let tent = 0; tent < 3; tent++) {
        medida = await pg.evaluate(async () => {
          const g = window.__golaco;
          g.reiniciar({ modo: 'partida', semente: 5 });
          for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
          g.medirQuadro({ zerar: true });
          for (let i = 0; i < 400; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
          const jogo = g.medirQuadro({ zerar: true });
          return jogo;
        });
        const golR = await golRoteirizado(pg, { semente: 5, time: 0, reiniciar: true });
        const cena = await pg.evaluate(() => { const g = window.__golaco; g.medirQuadro({ zerar: true }); g.comemoracao.zerarCusto(); let n = 0; while (g.comemoracao.ativa && g.comemoracao.estado.estado === 'rodando' && n < 700) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; } return { q: g.medirQuadro({ zerar: true }), custo: g.comemoracao.custo, n }; });
        medida = { jogo: medida, cena, gol: golR.ok };
        if (cena.q.cpu.p95 <= medida.jogo.cpu.p95 + 1) break;
      }
      const { jogo, cena } = medida;
      meta('F CPU do quadro na cena (sem o desenho) × jogo', `cena p95 ${f2(cena.q.cpu.p95)} ms (média ${f2(cena.q.cpu.media)}; a cena ${f2(cena.custo.msPorTick)} ms/tick) × jogo p95 ${f2(jogo.cpu.p95)} ms`, 'cena p95 ≤ jogo p95 + 1 ms', cena.q.cpu.p95 <= jogo.cpu.p95 + 1);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('F execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ H (o cartão do autor, item 31)
// H3/H4/H7: o pedido do TM (PED_A) com as fotos pela rota /__fotos/ desta origem
const ORIGEM = new URL(srv.url).origin;
/** Espera as fotos da edição pro assentarem (todas as pedidas prontas ou com erro); null sem a API (a base). */
// (revisão V1) nomes com o último nome de mais de 10 letras: a camisa do tm-times corta em 10 sem reticências ("Albuquerqu") —
// o cartão mostra o nome COMPLETO da ficha também no celular
const PRENOMES = ['Rodrigo', 'Matheus', 'Gabriel', 'Leandro', 'Vinícius', 'Henrique', 'Eduardo', 'Fernando', 'Leonardo', 'Ricardo', 'Augusto', 'Benedito', 'Cristiano', 'Domingos', 'Emanuel', 'Fabrício', 'Gustavo', 'Heitor'];
const nomesLongos = ped => {
  for (const t of [ped.home, ped.away]) t.players.forEach((p, i) => { const n = PRENOMES[i % PRENOMES.length]; p.nomeCompleto = `${n} Albuquerque`; p.name = `${n[0]}. Albuquerque`; });
  return ped;
};
/** A ficha do jogador (o nome completo e a camisa) na página. */
const fichaNaPagina = (pg, id) => pg.evaluate(async id => { const { fichaDe } = await import('./js/elenco.js'); const f = fichaDe(id); return f ? { num: String(f.num), nome: f.nome, camisa: f.camisa } : null; }, id);
const esperarFotos = (pg, ms = 45000) => pg.waitForFunction(() => { const f = window.__golaco.tm?.fotos; return !f || (f.pedidas >= 22 && f.prontas + f.erros >= f.pedidas); }, null, { timeout: ms, polling: 250 })
  .then(() => pg.evaluate(() => { const f = window.__golaco.tm?.fotos; return f ? { n: f.n, pedidas: f.pedidas, prontas: f.prontas, erros: f.erros } : null; })).catch(() => null);
if (faz('H')) {
  // H3 celular 844×390, TM pro com as fotos
  try {
    const ped = nomesLongos(comFotos({ ...PED_A, id: 'f31cel' }, ORIGEM));
    const P = await pagina(`?q=baixa&hora=noite&tm=${ped.id}&corpo=manequim&toque=1&entalhe=1`, { largura: 844, altura: 390, dpr: 1, toque: true, pedido: ped });
    try {
      const pg = P.pagina;
      const fo = await esperarFotos(pg);
      const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
      // até o cartão entrar (o relógio manual: tudo na mesma tarefa) — a foto é a <img> já decodificada da pré-carga: completa
      // no MESMO quadro em que o cartão entra
      const ap = await pg.evaluate(() => { const g = window.__golaco; let n = 0; while (n < 400 && g.comemoracao.ativa && !g.comemoracao.cartaoTela?.visivel) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; } return { n, t: g.comemoracao.estado?.t ?? null }; });
      const a = await pg.evaluate(() => window.__golaco.comemoracao.cartaoTela);
      const pronta = a?.foto ? 0 : null;
      const r = await acompanhar(pg, gol);
      const c = avaliarCartao(r);
      const tm = await pg.evaluate(id => window.__golaco.tm?.mapa?.[id]?.tmId ?? null, gol.autor);
      const esperado = tm ? urlFoto(ORIGEM, 'home', tm) : null;
      const lado = a?.fotoCaixa ? Math.round(a.fotoCaixa.x1 - a.fotoCaixa.x0) : 0;
      meta('H3 celular 844×390, ?tm pro: o cartão COM a foto do autor (a do tmId dele no pedido), 88–96 px; nome ≥ 18 px, número ≥ 14 px', a?.visivel ? `fotos ${JSON.stringify(fo)}; entrou em ${f2(ap.t)} s; foto ${a.foto}${pronta === 0 ? ' no 1º quadro' : ' (não no 1º quadro)'} ${a.fotoSrc === esperado ? '(a do autor)' : `(${a.fotoSrc} ≠ ${esperado})`}, ${lado} px; número ${a.letraNum} px "${a.num}", nome ${a.letraNome} px "${a.nome}"` : `nenhum cartão (fotos ${JSON.stringify(fo)})`,
        'a do autor; 88–96; ≥ 18; ≥ 14', !!a?.visivel && a.foto && a.fotoSrc === esperado && lado >= 88 && lado <= 96 && a.letraNome >= 18 && a.letraNum >= 14);
      // (revisão V3) o nome é a linha principal (o número vai na pílula, junto da sigla) e a coluna fica no meio da altura da foto
      const meioT = a?.textoCaixa ? (a.textoCaixa.y0 + a.textoCaixa.y1) / 2 : NaN, meioF = a?.fotoCaixa ? (a.fotoCaixa.y0 + a.fotoCaixa.y1) / 2 : NaN;
      meta('H11 celular 844×390 (com foto): o nome é a linha principal (letra maior que a do número); a coluna centrada na altura da foto (± 3 px)', a?.visivel ? `nome ${a.letraNome} px × número ${a.letraNum} px; meio da coluna − meio da foto ${f2(meioT - meioF)} px` : 'nenhum cartão',
        'nome > número; ± 3', !!a?.visivel && a.letraNome > a.letraNum && Math.abs(meioT - meioF) <= 3);
      const e = encostos(r, c);
      meta('H2 celular 844×390 com o entalhe (?tm pro): sem encostar no placar nem no "Pular", na área segura; não cobre o autor', `${e.texto}; cobre o autor em ${c.cobre}/${c.n} quadros`, 'sem encostar; 0', e.ok && c.n > 0 && c.cobre === 0);
      const fi = await fichaNaPagina(pg, gol.autor);
      meta('H10 celular 844×390 (com foto): o nome COMPLETO da ficha, sem cortar (não o da camisa, cortado em 10 letras)', a?.visivel ? `"${a.nome}"${a.cortado ? ' CORTADO' : ''} (ficha "${fi?.nome}", camisa "${fi?.camisa}")` : 'nenhum cartão',
        'o completo; sem reticências', !!a?.visivel && !!fi && a.nome === fi.nome && fi.nome !== fi.camisa && !a.cortado);
      // o gol contra no mesmo mundo
      const gc = await golRoteirizado(pg, { semente: 5, time: 0, contra: true });
      const rc = await acompanhar(pg, gc);
      const cc = avaliarCartao(rc);
      const qc = rc.q.filter(x => !x.semCena), contra = qc.length > 0 && qc.every(x => x.co);
      meta('H3 o gol CONTRA: nenhum cartão (estado.cartao null, 0 quadros)', `gol ${gc.ok ? 'contra' : 'NÃO SAIU'} (autor ${gc.autor}, chutou ${gc.chutou}); cena contra ${rc.q.some(x => !x.semCena)}; estado.cartao ${cc.semEstado ? 'null' : JSON.stringify(cc.ca)}; ${cc.n} quadros`,
        'null; 0', gc.ok && gc.contra && contra && cc.semEstado && cc.n === 0 && rc.q.some(x => !x.semCena));
    } finally { await P.fechar(); }
  } catch (e) { meta('H3 execução', e.message.split('\n')[0], 'sem exceção', false); }
  // H4 celular 568×320, TM público com as mesmas fotos no pedido
  try {
    const ped = nomesLongos(comFotos({ ...PED_A, id: 'f31pub' }, ORIGEM, { edicao: 'public' }));
    const P = await pagina(`?q=baixa&hora=dia&tm=${ped.id}&corpo=manequim&toque=1`, { largura: 568, altura: 320, dpr: 1, toque: true, pedido: ped });
    try {
      const pg = P.pagina;
      await pg.waitForTimeout(2500);
      const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
      const r = await acompanhar(pg, gol);
      const c = avaliarCartao(r);
      const a = c.a;
      meta('H4 celular 568×320, ?tm PÚBLICO (com fotos no pedido): sem foto, 0 pedidos às fotos, nome ≥ 15 px (> o número), número ≥ 14 px', a ? `foto ${a.foto} (caixa ${!!a.fotoCaixa}); pedidos às fotos ${P.fotos.pedidos}; nome ${a.letraNome} px "${a.nome}", número ${a.letraNum} px` : `nenhum cartão; pedidos às fotos ${P.fotos.pedidos}`,
        'sem; 0; ≥ 15 e > número; ≥ 14', !!a && !a.foto && !a.fotoCaixa && P.fotos.pedidos === 0 && a.letraNome >= 15 && a.letraNome > a.letraNum && a.letraNum >= 14);
      const e = encostos(r, c);
      meta('H2 celular 568×320: sem encostar no placar nem no "Pular"; não cobre o autor', `${e.texto}; cobre o autor em ${c.cobre}/${c.n} quadros`, 'sem encostar; 0', e.ok && c.n > 0 && c.cobre === 0);
      const fi = await fichaNaPagina(pg, gol.autor);
      meta('H10 celular 568×320 (sem foto): o nome COMPLETO da ficha, sem cortar', a ? `"${a.nome}"${a.cortado ? ' CORTADO' : ''} (ficha "${fi?.nome}", camisa "${fi?.camisa}")` : 'nenhum cartão',
        'o completo; sem reticências', !!a && !!fi && a.nome === fi.nome && fi.nome !== fi.camisa && !a.cortado);
      const al = alinhadoAoPlacar(r, c);
      meta('H12 celular 568×320 (sem foto): o cartão de uma linha na altura do placar, os topos e os pés alinhados (± 1 px)', al.texto, '± 1 px', al.ok);
    } finally { await P.fechar(); }
  } catch (e) { meta('H4 execução', e.message.split('\n')[0], 'sem exceção', false); }
  // H5 a cena curta e H6 pular com o cartão na tela (PC, sem ?tm)
  try {
    const P = await pagina('?q=baixa&hora=dia&semente=5');
    try {
      const pg = P.pagina;
      const g1 = await golRoteirizado(pg, { semente: 5, time: 1 });
      const r1 = await acompanhar(pg, g1);
      const c1 = avaliarCartao(r1);
      const q1 = r1.q.filter(x => !x.semCena), curta = q1.length > 0 && q1.every(x => x.cu);
      meta('H5 a cena curta (o gol da IA contra a pessoa): aparece, ≥ 2,2 s, some antes do replay', c1.n ? `entra ${f2(c1.entra)} s, fica ${f2(c1.fica)} s; folga até o replay ${f2(c1.folga)} s; no replay ${c1.noReplay}` : 'nenhum cartão',
        '≥ 2,2 s; folga > 0; 0', curta && c1.n > 0 && c1.fica >= 2.2 && c1.folga != null && c1.folga > 0 && c1.noReplay === 0 && c1.depois === 0);
      meta('H11 PC 1280×720 (sem foto): o nome é a linha principal (letra maior que a do número)', c1.a ? `nome ${c1.a.letraNome} px × número ${c1.a.letraNum} px` : 'nenhum cartão', 'nome > número', !!c1.a && c1.a.letraNome > c1.a.letraNum);
      const al1 = alinhadoAoPlacar(r1, c1);
      meta('H12 PC 1280×720 (sem foto): o cartão de uma linha na altura do placar, os topos e os pés alinhados (± 1 px)', al1.texto, '± 1 px', al1.ok);
      const g0 = await golRoteirizado(pg, { semente: 5, time: 0 });
      const ate = await pg.evaluate(() => { const g = window.__golaco; let n = 0; while (n < 400 && g.comemoracao.ativa && !(g.comemoracao.estado.t >= 2.2 && g.comemoracao.cartaoTela?.visivel)) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; } return { t: g.comemoracao.estado?.t ?? null, vis: !!g.comemoracao.cartaoTela?.visivel }; });
      await pg.keyboard.down('KeyK');
      const depois1 = await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: false }); return { vis: !!g.comemoracao.cartaoTela?.visivel, hidden: document.getElementById('autor-gol')?.hidden ?? null, estado: g.comemoracao.estado?.estado ?? 'saiu' }; });
      await pg.keyboard.up('KeyK');
      const resto = await acompanhar(pg, g0);
      const visResto = resto.q.filter(x => x.ag).length + resto.cartaoDepois;
      meta('H6 pular com o cartão na tela (K em t ≈ 2,2 s): some em ≤ 1 quadro; 0 quadros na cortina e no replay', `antes t ${f2(ate.t)} s visível ${ate.vis}; 1 quadro depois: visível ${depois1.vis}, hidden ${depois1.hidden}, cena ${depois1.estado}; depois ${visResto} quadros (replay ${resto.replay ? 'sim' : 'não'})`,
        'visível; escondido; 0', ate.vis && !depois1.vis && depois1.hidden === true && visResto === 0 && !!resto.replay);
      // H9 o "Replay" da pausa pedido com o cartão na tela (Esc/Start no meio da cena: o comando replay não espera a cena) — a
      // jogada com a bola rolando: o cartão escondido o replay inteiro, nunca por cima da marca REPLAY (o mesmo canto)
      await golRoteirizado(pg, { semente: 5, time: 0 });
      const h9 = await pg.evaluate(() => {
        const g = window.__golaco, out = { antes: null, botao: false, q: 0, rp: 0, comCartao: 0, cruza: 0, volta: false };
        const cx = id => { const e = document.getElementById(id); if (!e || e.hidden || !e.offsetParent || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width > 0 ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null; };
        for (let i = 0; i < 400 && g.comemoracao.ativa; i++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          const e = g.comemoracao.estado;
          if (e && e.t >= 2.2 && g.comemoracao.cartaoTela?.visivel) { out.antes = { t: e.t, fase: e.cartao?.fase }; break; }
        }
        if (!out.antes) return out;
        g.abrirMenu();
        g.relogio.avancar(1000 / 60, { desenhar: false });
        out.naPausa = !!g.comemoracao.cartaoTela?.visivel;
        const b = document.querySelector('#menu [data-cmd="replay"]');
        out.botao = !!b && !b.hidden;
        b?.click();
        let saiu = false;
        for (let i = 0; i < 900; i++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          out.q++;
          const ativo = !!g.replay?.estado?.ativo;
          if (ativo) {
            out.rp++;
            const a = cx('autor-gol'), m = cx('replay-marca');
            if (g.comemoracao.cartaoTela?.visivel || a) out.comCartao++;
            if (a && m && a.x0 < m.x1 && m.x0 < a.x1 && a.y0 < m.y1 && m.y0 < a.y1) out.cruza++;
          } else if (out.rp > 0) saiu = true;
          // depois do replay a cena continua de onde estava: o cartão volta enquanto a janela dele não acabou
          if (saiu && g.comemoracao.cartaoTela?.visivel) { out.volta = true; break; }
          if (saiu && !g.comemoracao.ativa) break;
        }
        return out;
      });
      meta('H9 o "Replay" da pausa com o cartão na tela: 0 quadros com o cartão e o replay juntos (nunca por cima da marca REPLAY)', h9.antes ? `cartão em t ${f2(h9.antes.t)} s; com a pausa aberta ${h9.naPausa ? 'VISÍVEL' : 'escondido'}; botão Replay ${h9.botao}; ${h9.rp} quadros de replay: com o cartão ${h9.comCartao}, cruzando a marca ${h9.cruza}; depois do replay o cartão ${h9.volta ? 'volta' : 'não volta'}` : 'o cartão não apareceu',
        'replay ≥ 60 quadros; 0; 0', !!h9.antes && h9.botao && !h9.naPausa && h9.rp >= 60 && h9.comCartao === 0 && h9.cruza === 0);
    } finally { await P.fechar(); }
  } catch (e) { meta('H5/H6/H9 execução', e.message.split('\n')[0], 'sem exceção', false); }
  // H7 PC 1366×600, TM pro com as fotos todas em 404
  try {
    const ped = comFotos({ ...PED_A, id: 'f31f404' }, ORIGEM);
    const P = await pagina(`?q=baixa&hora=dia&tm=${ped.id}&corpo=manequim`, { largura: 1366, altura: 600, pedido: ped, f404: true });
    try {
      const pg = P.pagina;
      const fo = await esperarFotos(pg);
      const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
      const r = await acompanhar(pg, gol);
      const c = avaliarCartao(r);
      const erros = P.erros.filter(e => !/Failed to load resource/.test(e));
      meta('H7 PC 1366×600, ?tm pro com as fotos em 404: o cartão sem foto; erros = 22; nenhum erro de página além dos 404 delas', `${c.a ? `foto ${c.a.foto} (caixa ${!!c.a.fotoCaixa})` : 'nenhum cartão'}; fotos ${JSON.stringify(fo)}; 404 ${P.fotos.n404}; outros erros ${erros.length}${erros.length ? ': ' + erros[0].slice(0, 80) : ''}`,
        'sem foto; 22; 0', !!c.a && !c.a.foto && !c.a.fotoCaixa && fo?.erros === 22 && erros.length === 0);
    } finally { await P.fechar(); }
  } catch (e) { meta('H7 execução', e.message.split('\n')[0], 'sem exceção', false); }
}

await srv.fechar();
meta('G console sem erros', errosTodos.length ? errosTodos.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', errosTodos.length === 0);
const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.info ? 'INFO    ' : r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok || r.info);
console.log(ok ? '\nteste-comemoracao-tela: PASSOU' : '\nteste-comemoracao-tela: REPROVOU');
process.exit(ok ? 0 : 1);
