// Cenas de CARTÃO e de FIM DE TEMPO e o corte da TORCIDA no gol, no navegador (Chromium; pedido do dono de 12/10). Na
// página de verdade (main.js, js/cena-cartao.js, js/cena-fim.js, render/cartao3d.js, hud.js), ?cenas=1, relógio manual a
// 60 qps:
//   1) console sem erros;
//   2) hash e laço: a falta de teste no mesmo tick com ?cenas=1 e ?cenas=0 dá o MESMO hashMundo no tick N; durante a cena
//      de cartão e a do intervalo (até o plano geral) o tick não anda; depois da cena a simulação continua do mesmo tick;
//   3) cartão (amarelo, vermelho, 2º amarelo, pênalti com amarelo, goleiro expulso): a cena abre no quadro do evento; o
//      cartão 3D com ≥ 14 px de altura no PC (≥ 10 no celular) e a cor certa no pixel do meio (ΔE ≤ 15); no 2º amarelo
//      o amarelo e depois o vermelho; o #cartao-icone invisível durante e depois (com ?cenas=0 ele aparece, como antes);
//   4) o punido com ≥ 100 px de altura (e dentro da tela) em ≥ 85% dos quadros dos planos do árbitro e da reação;
//   5) HUD: só o placar (e o "Pular" com toque) visíveis; nenhum texto novo;
//   6) pular: antes de 0,5 s nada; uma tecla segurada de antes não pula; um aperto novo pula exatamente UMA cena; depois,
//      entrada neutra até soltar (a bola parada e a posse não mudam);
//   7) ordem: falta → cartão → montagem do tiro livre; comemoração sem replay (?replay=0) com um cartão na fila → o
//      cartão abre (antes ficava preso); o intervalo de verdade → cena (laço parado) → faixa "Intervalo" com o laço solto
//      → a saída do 2º tempo acaba a cena (hash igual a ?cenas=0 depois); o fim do jogo → cena → faixa "Fim de jogo" +
//      "Jogar de novo";
//   8) celular 844×390 deitado: o cartão ≥ 10 px; o "Pular" ≥ 48 px; tocar pula; em pé ("Gire o celular") a cena congela
//      e continua ao voltar;
//   9) gol (gol roteirizado): o corte da torcida acontece (plano de cinema 'torcida'); à noite a luma média do corte fica
//      ≥ 60% da do mesmo corte de dia e nenhum quadro tem > 25% dos pixels abaixo de 20/255; o relógio do estádio
//      (bandeiras) anda durante a cena com o laço segurado;
//  10) desempenho: p95 da CPU do quadro durante as cenas ≤ p95 do jogo + 1 ms (PC);
//  11) capturas (uma por plano do amarelo, do vermelho, do intervalo e do fim; PC e celular) no scratchpad, para quem
//      implementa olhar (nada é enviado ao dono).
// Na versão sem as cenas (--raiz <cópia da main>) reprova (as cenas não existem).
//   node tools/teste-cenas-tela.mjs [--raiz <pasta do jogo>] [--capturas <pasta>]
import path from 'node:path';
import fs from 'node:fs';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const pastaCap = args.includes('--capturas') ? path.resolve(args[args.indexOf('--capturas') + 1]) : null;
if (pastaCap) fs.mkdirSync(pastaCap, { recursive: true });
const res = [];
const meta = (nome, medido, alvo, ok, info = false) => { res.push({ nome, medido, alvo, ok: !!ok, info }); };
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const errosTodos = [];
const srv = await servidor(0, raiz);

async function pagina(q, opc = {}) {
  const nav = await abrir({ largura: opc.largura ?? 1280, altura: opc.altura ?? 720, dpr: opc.dpr ?? 1, toque: opc.toque });
  await nav.pagina.goto(srv.url + q, { waitUntil: 'load' });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await nav.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return { ...nav, fechar: async () => { errosTodos.push(...nav.erros); await nav.navegador.close(); } };
}

// ΔE76 (CIELAB) entre duas cores sRGB 0–255
function lab([r, g, b]) {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const COR = { amarelo: [0xf5, 0xc5, 0x18], vermelho: [0xe5, 0x48, 0x4d] };

/** Pixels de uma captura (px CSS): a média de 3×3 em volta de (x, y). */
async function pixel(pg, x, y) {
  const png = await pg.screenshot({ type: 'png' });
  return pg.evaluate(async ({ src, x, y }) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const k = c.getContext('2d'); k.drawImage(i, 0, 0);
    const s = i.width / window.innerWidth, px = Math.round(x * s), py = Math.round(y * s);
    const d = k.getImageData(px - 1, py - 1, 3, 3).data;
    const m = [0, 0, 0]; for (let q = 0; q < 9; q++) for (let ch = 0; ch < 3; ch++) m[ch] += d[q * 4 + ch] / 9;
    return m;
  }, { src: png.toString('base64'), x, y });
}
/** Luma média (0–255) e a fração de pixels abaixo de 20 de uma captura. */
async function luma(pg) {
  const png = await pg.screenshot({ type: 'png' });
  return pg.evaluate(async src => {
    const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const k = c.getContext('2d'); k.drawImage(i, 0, 0);
    const d = k.getImageData(0, 0, i.width, i.height).data;
    let s = 0, esc = 0, n = 0;
    for (let q = 0; q < d.length; q += 16) { const l = 0.2126 * d[q] + 0.7152 * d[q + 1] + 0.0722 * d[q + 2]; s += l; if (l < 20) esc++; n++; }
    return { media: s / n, escuros: esc / n };
  }, png.toString('base64'));
}
async function capturar(pg, nome) { if (pastaCap) await pg.screenshot({ path: path.join(pastaCap, nome + '.png') }); }

// no navegador: os textos visíveis fora do placar e do "Pular" (nada de texto novo nas cenas)
const TEXTOS = () => {
  const vis = e => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return e.getClientRects().length > 0; };
  const out = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('.placar') || e.closest('#comemoracao') || e.closest('.carregando')) continue;
    const txt = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (txt && vis(e)) out.push(txt.slice(0, 24));
  }
  return out;
};

/**
 * Anda a cena de cartão quadro a quadro (sem desenhar) até ela acabar, medindo: o tick (parado?), o punido na tela nos
 * planos 'arbitro'/'reacao', o cartão 3D (a maior altura e o instante dela por cor), o ícone, os textos e os planos.
 */
async function andarCartao(pg) {
  return pg.evaluate(TXT => {
    const g = window.__golaco, textos = eval(TXT);
    const ic = document.getElementById('cartao-icone') ?? document.querySelector('.cartao-icone');
    const icVis = () => !!ic && ic.classList.contains('visivel') && getComputedStyle(ic).display !== 'none';
    const tick0 = g.mundo.tick;
    const out = { tick0, tickMudou: 0, quadros: 0, assunto: { n: 0, ok: 0 }, cartao: {}, icone: 0, textos: new Set(), planos: [], ativoNoInicio: g.cenas.ativo, cor: g.cenas.estado?.cor, segundo: g.cenas.estado?.segundo, variante: g.cenas.estado?.variante };
    while (g.cenas.ativo && out.quadros < 1500) {
      g.relogio.avancar(1000 / 60, { desenhar: false }); out.quadros++;
      if (!g.cenas.ativo) break;
      if (g.mundo.tick !== tick0) out.tickMudou++;
      const e = g.cenas.estado, pl = e.plano;
      if (out.planos[out.planos.length - 1] !== pl) out.planos.push(pl);
      if (pl === 'arbitro' || pl === 'reacao') {
        const t = g.cenas.naTela();
        out.assunto.n++;
        if (t && !t.atras && t.altura >= 100 && t.x1 > 0 && t.x0 < window.innerWidth && t.y0 < window.innerHeight && t.y1 > 0) out.assunto.ok++;
      }
      const c3 = g.cenas.cartao3d;
      if (c3 && c3.visivel && pl === 'arbitro') {
        const nt = g.cenas.naTela('cartao');
        const q = out.cartao[c3.cor] ?? (out.cartao[c3.cor] = { max: 0, t: null, ordem: Object.keys(out.cartao).length });
        if (nt && nt.altura > q.max) { q.max = nt.altura; q.t = e.tempo; }
      }
      if (icVis()) out.icone++;
      for (const s of textos()) out.textos.add(s);
    }
    // depois da cena: 3 s de jogo (o ícone de quem levou o cartão não aparece; o tick anda a partir do de antes)
    const tickFim = g.mundo.tick;
    let iconeDepois = 0;
    for (let i = 0; i < 180; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (icVis()) iconeDepois++; }
    out.tickFim = tickFim; out.tickDepois = g.mundo.tick; out.iconeDepois = iconeDepois; out.textos = [...out.textos];
    return out;
  }, `(${TEXTOS.toString()})`);
}

/** Leva a cena de cartão até o plano do árbitro com o cartão mais alto na tela (desenhando o quadro). */
async function irAoCartao(pg, cor) {
  return pg.evaluate(cor => {
    const g = window.__golaco;
    let melhor = null;
    for (let i = 0; i < 400 && g.cenas.ativo; i++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      const c3 = g.cenas.cartao3d, e = g.cenas.estado;
      if (!e || e.plano !== 'arbitro' || !c3?.visivel || c3.cor !== cor) { if (melhor) break; continue; }
      const nt = g.cenas.naTela('cartao');
      if (nt && (!melhor || nt.altura > melhor.altura + 0.5)) melhor = nt; else if (melhor) break;
    }
    g.relogio.avancar(1000 / 60, { desenhar: true });
    return g.cenas.naTela('cartao');
  }, cor);
}

const MEIO = '?cenas=1&semente=3&q=alta&hora=dia';
const prepararMeio = pg => pg.evaluate(() => { const g = window.__golaco; g.rodarPassos(900, 'demo'); return g.mundo.tick; });

// ------------------------------------------------------------------------------------------------ 2/3/4/5: PC, cartões
let hashCom = null, hashSem = null, tickHash = null;
try {
  const P = await pagina(MEIO);
  try {
    const pg = P.pagina;
    const temCenas = await pg.evaluate(() => !!window.__golaco.cenas);
    if (!temCenas) meta('3 cena de cartão no navegador', 'não existe (só o ícone em cima de quem levou)', 'existe', false);
    else {
      const casos = [
        ['amarelo', { cartao: 'amarelo' }, 'amarelo'],
        ['vermelho', { cartao: 'vermelho', motivo: 'forcaExcessiva' }, 'vermelho'],
        ['2º amarelo', { segundo: true }, 'vermelho'],
        ['pênalti com amarelo', { area: true, cartao: 'amarelo' }, 'amarelo'],
        ['goleiro expulso', { goleiroExpulso: true }, 'vermelho'],
      ];
      for (const [nome, opc, cor] of casos) {
        await pg.evaluate(() => window.__golaco.reiniciar({ modo: 'partida', semente: 3 }));
        const t0 = await prepararMeio(pg);
        const f = await pg.evaluate(o => window.__golaco.faltaDeTeste(o), opc);
        const abriu = await pg.evaluate(() => ({ ativo: window.__golaco.cenas.ativo, est: window.__golaco.cenas.estado }));
        // o cartão no alto: a altura e a cor no pixel do meio (o 2º amarelo: o amarelo primeiro)
        const cores = opc.segundo ? ['amarelo', 'vermelho'] : [cor];
        const px = [];
        for (const cc of cores) {
          const nt = await irAoCartao(pg, cc);
          if (nt) { const p = await pixel(pg, nt.cx, nt.cy); px.push({ cor: cc, altura: nt.altura, dE: deltaE(p, COR[cc]), rgb: p.map(Math.round) }); await capturar(pg, `pc-${nome.replace(/\W+/g, '-')}-${cc}`); }
          else px.push({ cor: cc, altura: 0, dE: 999 });
        }
        const a = await andarCartao(pg);
        const okPx = px.every(q => q.altura >= 14 && q.dE <= 15);
        meta(`3 ${nome}: a cena abre no quadro do evento`, `ativa ${abriu.ativo} (${abriu.est?.cor}${abriu.est?.segundo ? ', 2º amarelo' : ''}, ${abriu.est?.variante}) no tick ${t0}; cartão ${f?.cartao}`, `ativa, ${cor}`, abriu.ativo && abriu.est?.cor === cor && (!opc.segundo || abriu.est.segundo));
        meta(`3 ${nome}: cartão 3D legível e da cor certa`, px.map(q => `${q.cor} ${f2(q.altura)} px ΔE ${f2(q.dE)} [${q.rgb}]`).join('; '), '≥ 14 px, ΔE ≤ 15', okPx);
        meta(`2 ${nome}: o tick não anda durante a cena e continua do mesmo depois`, `tick ${a.tick0}, mudou em ${a.tickMudou}/${a.quadros} quadros; fim ${a.tickFim}, 3 s depois ${a.tickDepois}`, 'parado; depois anda', a.tickMudou === 0 && a.tickFim === a.tick0 && a.tickDepois > a.tick0);
        meta(`4 ${nome}: o punido ≥ 100 px nos planos do árbitro e da reação`, `${f2(100 * a.assunto.ok / Math.max(1, a.assunto.n))}% de ${a.assunto.n} quadros`, '≥ 85%', a.assunto.n > 0 && a.assunto.ok / a.assunto.n >= 0.85);
        meta(`3 ${nome}: #cartao-icone invisível durante e depois`, `${a.icone} quadros durante, ${a.iconeDepois} depois`, '0 e 0', a.icone === 0 && a.iconeDepois === 0);
        meta(`5 ${nome}: só o placar na tela (nenhum texto novo)`, a.textos.length ? a.textos.join(' | ') : 'nenhum', 'nenhum', a.textos.length === 0);
      }
      // 2) hash: a falta no mesmo tick com e sem as cenas → o mesmo hash no tick N
      await pg.evaluate(() => window.__golaco.reiniciar({ modo: 'partida', semente: 3 }));
      await prepararMeio(pg);
      const r = await pg.evaluate(() => {
        const g = window.__golaco;
        g.faltaDeTeste({ cartao: 'amarelo' });
        const N = g.mundo.tick + 600;
        let q = 0;
        while (g.mundo.tick < N && q < 3000) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
        return { tick: g.mundo.tick, hash: g.rodarPassos(0) };
      });
      hashCom = r.hash; tickHash = r.tick;
      // 10) desempenho: o jogo e as cenas (sem desenhar a GPU: a CPU do quadro)
      const d = await pg.evaluate(() => {
        const g = window.__golaco;
        g.reiniciar({ modo: 'partida', semente: 3 }); g.rodarPassos(900, 'demo');
        g.medirQuadro({ zerar: true });
        for (let i = 0; i < 360; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        const jogo = g.medirQuadro({ zerar: true }).cpu.p95;
        g.faltaDeTeste({ cartao: 'vermelho' });
        let q = 0; while (g.cenas.ativo && q < 700) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
        const cena = g.medirQuadro({ zerar: true }).cpu.p95;
        return { jogo, cena, q };
      });
      meta('10 CPU do quadro (p95): cena de cartão × jogo (PC)', `cena ${f2(d.cena)} ms × jogo ${f2(d.jogo)} ms (${d.q} quadros)`, 'cena ≤ jogo + 1 ms', d.cena <= d.jogo + 1);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('PC cartões: execução', e.message.split('\n')[0], 'sem exceção', false); }

// sem as cenas: o mesmo roteiro (o ícone aparece como antes; o hash no mesmo tick)
try {
  const P = await pagina('?cenas=0&semente=3&q=alta&hora=dia');
  try {
    const pg = P.pagina;
    const r = await pg.evaluate(N => {
      const g = window.__golaco;
      g.rodarPassos(900, 'demo');
      g.faltaDeTeste({ cartao: 'amarelo' });
      const ic = document.getElementById('cartao-icone') ?? document.querySelector('.cartao-icone');
      let icone = 0, q = 0;
      while (g.mundo.tick < N && q < 3000) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; if (ic && ic.classList.contains('visivel')) icone++; }
      return { tick: g.mundo.tick, hash: g.rodarPassos(0), icone, cena: !!g.cenas?.ativo };
    }, tickHash ?? 1500);
    hashSem = r.hash;
    meta('3 sem as cenas (?cenas=0): o ícone do cartão aparece como antes', `${r.icone} quadros`, '> 0', r.icone > 0);
    meta('2 hash no tick N igual com ?cenas=1 e ?cenas=0 (a falta no mesmo tick)', `${hashCom} × ${hashSem} no tick ${tickHash}`, 'iguais', hashCom != null && hashCom === hashSem && r.tick === tickHash);
  } finally { await P.fechar(); }
} catch (e) { meta('sem as cenas: execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ 6/7: pular e ordem
try {
  const P = await pagina(MEIO);
  try {
    const pg = P.pagina;
    // 6) pular: a tecla segurada de antes não pula; antes de 0,5 s nada; um aperto novo pula UMA cena
    await prepararMeio(pg);
    await pg.keyboard.down('KeyK');
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: false }); g.faltaDeTeste({ cartao: 'amarelo' }); });
    const segurada = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return { ativo: g.cenas.ativo, t: g.cenas.estado?.tempo }; });
    await pg.keyboard.up('KeyK');
    await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
    // antes de 0,5 s numa cena nova: nada
    await pg.evaluate(() => { const g = window.__golaco; g.cenas.pular(); });
    const antes = await pg.evaluate(() => { const g = window.__golaco; while (g.cenas.ativo) g.relogio.avancar(1000 / 60, { desenhar: false }); for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.faltaDeTeste({ cartao: 'amarelo' }); for (let i = 0; i < 6; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return { t: g.cenas.estado?.tempo }; });
    await pg.keyboard.down('KeyK');
    const cedo = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 4; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.cenas.ativo; });
    await pg.keyboard.up('KeyK');
    await pg.evaluate(() => { const g = window.__golaco; while (g.cenas.estado && g.cenas.estado.tempo < 0.9) g.relogio.avancar(1000 / 60, { desenhar: false }); });
    const est0 = await pg.evaluate(() => { const g = window.__golaco, m = g.mundo; return { tick: m.tick, parada: m.parada?.tipo ?? null, posse: m.posse }; });
    await pg.keyboard.down('KeyK');
    const pulo = await pg.evaluate(() => { const g = window.__golaco; let q = 0; while (q < 10 && g.cenas.ativo) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; } return { q, ativo: g.cenas.ativo }; });
    // com a tecla AINDA segurada: 20 quadros de jogo — nenhum chute/passe sai dela (entrada neutra até soltar)
    const depois = await pg.evaluate(() => { const g = window.__golaco, m = g.mundo; const ev = []; for (let i = 0; i < 20; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); for (const e of m.eventos ?? []) ev.push(e.tipo); } return { tick: m.tick, parada: m.parada?.tipo ?? null, posse: m.posse, chutes: ev.filter(t => t === 'chute' || t === 'passe').length, carga: !!g.estado().jogador?.carga }; });
    await pg.keyboard.up('KeyK');
    meta('6 a tecla segurada de antes não pula a cena', `1 s depois: ativa ${segurada.ativo} (t ${f2(segurada.t)} s)`, 'ativa', segurada.ativo);
    meta('6 aperto antes de 0,5 s não pula', `t ${f2(antes.t)} s: ativa ${cedo}`, 'ativa', cedo);
    meta('6 aperto novo depois de 0,5 s pula a cena em ≤ 2 quadros', `${pulo.q} quadro(s), ativa ${pulo.ativo}`, '≤ 2', pulo.q <= 2 && !pulo.ativo);
    meta('6 depois do pulo: entrada neutra até soltar (nada sai da tecla segurada; a bola parada e a posse ficam)', `tick ${est0.tick} → ${depois.tick}; parada ${est0.parada} → ${depois.parada}; posse ${est0.posse} → ${depois.posse}; chutes/passes ${depois.chutes}; carga ${depois.carga}`, 'nenhum chute, sem carga', depois.chutes === 0 && !depois.carga);
    // 7a) falta → cartão → montagem do tiro livre
    meta('7 falta → cena do cartão → montagem do tiro livre', `bola parada ${est0.parada} durante, ${depois.parada} depois`, 'tiroLivre', est0.parada === 'tiroLivre');
    // 7b) o fim do jogo: cena → faixa "Fim de jogo" + "Jogar de novo"
    const fim = await pg.evaluate(() => {
      const g = window.__golaco;
      g.fimDeTempoDeTeste('fimDeJogo', { 0: 2, 1: 1 });
      const ini = g.cenas.estado;
      const faixa = () => { const f = document.querySelector('.faixa'); return !!f && getComputedStyle(f).display !== 'none' && f.classList.contains('visivel') ? f.innerText.replace(/\s+/g, ' ').trim() : null; };
      let antesGeral = null, q = 0;
      while (g.cenas.ativo && !g.cenas.estado.geral && q < 1500) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; if (antesGeral == null && faixa()) antesGeral = faixa(); }
      for (let i = 0; i < 10; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      return { ini: ini && { tipo: ini.tipo, resultado: ini.resultado, planos: ini.planos }, geral: g.cenas.estado?.geral, q, faixa: faixa(), antesGeral, botao: !!document.querySelector('.faixa button, .faixa [data-cmd]') };
    });
    meta('7 fim do jogo: a cena e depois a faixa "Fim de jogo" + "Jogar de novo" (não antes)', `${JSON.stringify(fim.ini)}; plano geral em ${fim.q} quadros; faixa: ${fim.faixa}; antes: ${fim.antesGeral}`, 'cena; faixa só no fim, com o botão',
      fim.ini?.tipo === 'fim' && fim.geral && /Fim de jogo/i.test(fim.faixa ?? '') && fim.botao && !fim.antesGeral);
  } finally { await P.fechar(); }
} catch (e) { meta('pular e ordem: execução', e.message.split('\n')[0], 'sem exceção', false); }

// 7c) comemoração SEM replay com um cartão na fila: o cartão abre quando ela acaba (antes ficava preso)
try {
  const P = await pagina('?cenas=1&replay=0&q=baixa&hora=dia&semente=5');
  try {
    const pg = P.pagina;
    const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
    const r = await pg.evaluate(() => {
      const g = window.__golaco;
      const out = { comemoracao: g.comemoracao.ativa, fila: null, abriu: null, q: 0, fases: [] };
      for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      g.cenas.cartaoNaFila();
      out.fila = g.cenas.fila;
      while (out.q < 1500 && !g.cenas.ativo) {
        g.relogio.avancar(1000 / 60, { desenhar: false }); out.q++;
        const f = g.comemoracao.estado?.fase ?? 'sem';
        if (out.fases[out.fases.length - 1] !== f) out.fases.push(f);
      }
      out.abriu = g.cenas.estado && { tipo: g.cenas.estado.tipo, cor: g.cenas.estado.cor };
      return out;
    });
    meta('7 comemoração sem replay (?replay=0) e um cartão na fila: o cartão abre depois dela', `gol ${gol?.ok}; fila ${JSON.stringify(r.fila)}; fases ${r.fases.join('→')}; cena ${JSON.stringify(r.abriu)} em ${r.q} quadros`, 'a cena do cartão abre', !!gol?.ok && r.abriu?.tipo === 'cartao');
    meta('9 gol: o corte da torcida na comemoração (cenas ligadas)', r.fases.join('→'), 'com torcida', r.fases.includes('torcida'));
  } finally { await P.fechar(); }
} catch (e) { meta('fila sem replay: execução', e.message.split('\n')[0], 'sem exceção', false); }

// 7d) o intervalo de verdade (?min curto): cena com o laço parado → faixa com o laço solto → a saída acaba a cena; o
// hash depois igual ao de ?cenas=0
const intervalo = async q => {
  const P = await pagina(q);
  try {
    return await P.pagina.evaluate(() => {
      const g = window.__golaco, m = g.mundo;
      let q = 0;
      while (m.partida.estado !== 'intervalo' && q < 20000) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
      const tick0 = m.tick, out = { tick0, cena: g.cenas?.ativo ?? false, parado: true, geral: false, faixa: null, saida: null, planos: [] };
      const faixaTxt = () => { const f = document.querySelector('.faixa'); return f && f.classList.contains('visivel') && getComputedStyle(f).display !== 'none' ? f.innerText.replace(/\s+/g, ' ').trim() : null; };
      while (g.cenas?.ativo && !g.cenas.estado.geral && q < 30000) {
        g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
        if (m.tick !== tick0) out.parado = false;
        const p = g.cenas.estado?.plano; if (p && out.planos[out.planos.length - 1] !== p) out.planos.push(p);
      }
      out.geral = !!g.cenas?.estado?.geral;
      for (let i = 0; i < 20; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      out.faixa = faixaTxt();
      while (m.partida.estado === 'intervalo' && q < 40000) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
      out.saida = { tick: m.tick, cenaDepois: g.cenas?.ativo ?? false };
      const N = m.tick + 300;
      while (m.tick < N && q < 50000) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
      out.hash = g.rodarPassos(0); out.tick = m.tick;
      return out;
    });
  } finally { await P.fechar(); }
};
try {
  const com = await intervalo('?cenas=1&min=0.25&semente=4&q=baixa&demo=0');
  const sem = await intervalo('?cenas=0&min=0.25&semente=4&q=baixa&demo=0');
  meta('7 intervalo: a cena abre no apito com o laço parado até o plano geral', `cena ${com.cena}; planos ${com.planos.join('→')}; parado ${com.parado}`, 'apito → … → geral, parado', com.cena && com.parado && com.geral);
  meta('7 intervalo: a faixa "Intervalo" no plano geral e a saída do 2º tempo acaba a cena', `faixa ${com.faixa}; saída no tick ${com.saida.tick}, cena depois ${com.saida.cenaDepois}`, 'faixa; sem cena depois', /Intervalo/i.test(com.faixa ?? '') && !com.saida.cenaDepois);
  meta('2 intervalo: hash 300 passos depois da saída igual com e sem as cenas', `${com.hash} (tick ${com.tick}) × ${sem.hash} (tick ${sem.tick})`, 'iguais', com.hash === sem.hash && com.tick === sem.tick);
} catch (e) { meta('intervalo: execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ 8: celular
try {
  const P = await pagina('?cenas=1&semente=3&q=media&hora=noite&toque=1', { largura: 844, altura: 390, dpr: 1, toque: true });
  try {
    const pg = P.pagina;
    await prepararMeio(pg);
    await pg.evaluate(() => window.__golaco.faltaDeTeste({ cartao: 'vermelho' }));
    const nt = await irAoCartao(pg, 'vermelho');
    const px = nt ? await pixel(pg, nt.cx, nt.cy) : null;
    await capturar(pg, 'cel-vermelho-arbitro');
    const pular = await pg.evaluate(() => { const b = document.getElementById('comemoracao-pular'); const r = b.getBoundingClientRect(); return { vis: getComputedStyle(b).display !== 'none' && r.width > 0, w: r.width, h: r.height, x: r.x, y: r.y, W: window.innerWidth, H: window.innerHeight }; });
    meta('8 celular: o cartão ≥ 10 px e da cor certa', nt ? `${f2(nt.altura)} px, ΔE ${f2(deltaE(px, COR.vermelho))}` : 'não visível', '≥ 10 px, ΔE ≤ 15', !!nt && nt.altura >= 10 && deltaE(px, COR.vermelho) <= 15);
    meta('8 celular: o "Pular" visível, ≥ 48 px, dentro da tela', JSON.stringify(pular), '≥ 48 px', pular.vis && pular.h >= 48 && pular.x + pular.w <= pular.W && pular.y + pular.h <= pular.H);
    // em pé: congela; deitado de novo: continua
    const t1 = await pg.evaluate(() => window.__golaco.cenas.estado.tempo);
    await pg.setViewportSize({ width: 390, height: 844 });
    const emPe = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return { t: g.cenas.estado?.tempo, girar: !!document.getElementById('girar') && getComputedStyle(document.getElementById('girar')).display !== 'none' }; });
    await pg.setViewportSize({ width: 844, height: 390 });
    const deitado = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.cenas.estado?.tempo; });
    meta('8 celular em pé: a cena congela ("Gire o celular") e continua ao voltar', `t ${f2(t1)} → em pé ${f2(emPe.t)} (girar ${emPe.girar}) → deitado ${f2(deitado)}`, 'parada em pé; anda deitado', Math.abs(emPe.t - t1) < 1e-6 && emPe.girar && deitado > t1 + 0.3);
    // tocar pula
    const b = await pg.evaluate(() => { const r = document.getElementById('comemoracao').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await pg.touchscreen.tap(b.x, b.y);
    const tocou = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.cenas.ativo; });
    meta('8 celular: um toque pula a cena', `ativa depois do toque: ${tocou}`, 'false', tocou === false);
  } finally { await P.fechar(); }
} catch (e) { meta('celular: execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ 9: torcida à noite e relógio
async function corteTorcida(hora) {
  const P = await pagina(`?cenas=1&q=media&hora=${hora}&semente=5`);
  try {
    const pg = P.pagina;
    const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
    const r = await pg.evaluate(() => {
      const g = window.__golaco;
      let q = 0;
      while (q < 900 && g.comemoracao.ativa && g.comemoracao.estado.fase !== 'torcida') { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
      const fase = g.comemoracao.estado?.fase;
      const t0 = g.estadio.festaVisual?.tempoBandeiras;
      for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      g.relogio.avancar(1000 / 60, { desenhar: true });
      const t1 = g.estadio.festaVisual?.tempoBandeiras;
      return { fase, t0, t1, tick: g.mundo.tick, desde: g.mundo.partida.desde, rel: g.estadio.relogio };
    });
    const l = await luma(pg);
    await capturar(pg, `gol-torcida-${hora}`);
    return { gol, ...r, luma: l };
  } finally { await P.fechar(); }
}
try {
  const dia = await corteTorcida('dia'), noite = await corteTorcida('noite');
  meta('9 gol: o corte da torcida (dia e noite)', `${dia.fase} / ${noite.fase}`, 'torcida', dia.fase === 'torcida' && noite.fase === 'torcida');
  meta('9 à noite a torcida clara: luma ≥ 60% da de dia; ≤ 25% de pixels abaixo de 20', `noite ${f2(noite.luma.media)} × dia ${f2(dia.luma.media)} (${f2(100 * noite.luma.media / Math.max(1, dia.luma.media))}%); escuros ${f2(100 * noite.luma.escuros)}%`, '≥ 60%; ≤ 25%', noite.luma.media >= 0.6 * dia.luma.media && noite.luma.escuros <= 0.25);
  meta('9 o relógio do estádio anda com o laço segurado (bandeiras no corte da torcida)', `uTempo ${f2(dia.t0)} → ${f2(dia.t1)}; simulação no gol + ${dia.tick - dia.desde}; segurado ${f2(dia.rel?.tSegurado)} s`, 'muda', Number.isFinite(dia.t0) && dia.t1 > dia.t0);
} catch (e) { meta('torcida no gol: execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ 11: capturas
if (pastaCap) {
  try {
    for (const [larg, alt, cel, hora] of [[1280, 720, false, 'dia'], [844, 390, true, 'noite']]) {
      const P = await pagina(`?cenas=1&semente=3&q=${cel ? 'media' : 'alta'}&hora=${hora}${cel ? '&toque=1' : ''}`, { largura: larg, altura: alt, toque: cel });
      try {
        const pg = P.pagina;
        for (const [nome, prep] of [['amarelo', g => g.faltaDeTeste({ cartao: 'amarelo' })], ['vermelho', g => g.faltaDeTeste({ cartao: 'vermelho' })], ['intervalo', g => g.fimDeTempoDeTeste('intervalo')], ['fim', g => g.fimDeTempoDeTeste('fimDeJogo', { 0: 2, 1: 1 })]]) {
          await pg.evaluate(() => window.__golaco.reiniciar({ modo: 'partida', semente: 3 }));
          await prepararMeio(pg);
          await pg.evaluate(`(${prep.toString()})(window.__golaco)`);
          const vistos = new Set();
          for (let i = 0; i < 40; i++) {
            const pl = await pg.evaluate(() => { const g = window.__golaco; for (let k = 0; k < 20 && g.cenas.ativo; k++) g.relogio.avancar(1000 / 60, { desenhar: false }); const e = g.cenas.estado; if (!e) return null; g.relogio.avancar(1000 / 60, { desenhar: true }); return e.geral ? 'geral' : e.plano; });
            if (!pl) break;
            if (!vistos.has(pl)) { vistos.add(pl); await capturar(pg, `${cel ? 'cel' : 'pc'}-${hora}-${nome}-${pl}`); }
            if (pl === 'geral') break;
          }
        }
      } finally { await P.fechar(); }
    }
    meta('11 capturas por plano (PC dia, celular noite)', pastaCap, 'gravadas', true, true);
  } catch (e) { meta('capturas: execução', e.message.split('\n')[0], 'sem exceção', false); }
}

// ------------------------------------------------------------------------------------------------ 1: console
const erros = errosTodos.filter(e => !/favicon/i.test(e));
meta('1 console sem erros', erros.length ? erros.slice(0, 5).join(' | ') : 'nenhum', 'nenhum', erros.length === 0);

srv.fechar?.();
let falhas = 0;
const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) { if (!r.ok && !r.info) falhas++; console.log(`${r.info ? 'INFO    ' : r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (meta: ${r.alvo})`); }
console.log(falhas ? `\nteste-cenas-tela: REPROVOU (${falhas})` : '\nteste-cenas-tela: PASSOU');
process.exit(falhas ? 1 : 0);
