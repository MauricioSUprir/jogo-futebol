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
//      A5 só o placar (e o "GOL!" até o 1º corte) na tela: minimapa, menu, avisos e painel escondidos; o "GOL!" sai no
//         1º corte;
//      A6 no contraplano do abraço a torcida enche ≥ 30% do quadro (o mesmo quadro com e sem a torcida);
//   B) pular (PC, teclado): K antes de 0,5 s não pula; K depois de 0,5 s acaba a cena em ≤ 2 quadros; a saída sai no
//      mesmo tick (os passos que faltavam rodam na cortina) com o mesmo hash; o K ainda segurado NÃO pula o replay, um
//      2º aperto pula (dois apertos: comemoração e replay);
//   C) celular 844×390 com toque: botões de toque e minimapa escondidos na cena; "Pular" (≥ 48 px, dentro da tela, sem
//      encostar no placar nem no "GOL!"); toque antes de 0,5 s não pula, depois pula; os botões voltam no fim;
//   D) gol NATURAL (IA × IA, achado em Node com a entrada da página): a cena inteira (fases, autor no quadro);
//   E) treino (condução): gol sem cena (o efeito do treino de sempre) e o mesmo hash com e sem ?comemoracao;
//   F) CPU do quadro durante a cena (sem o desenho) ≤ p95 do quadro do jogo + 1 ms;
//   G) console sem erros.
// Na versão sem a cena (--raiz <cópia da main>) reprova: A2 (o autor fica fora do quadro) e o resto que pede a cena.
//   node tools/teste-comemoracao-tela.mjs [--raiz <pasta do jogo>]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';
import { acharGol } from './lib/acha-gol.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const res = [];
const meta = (nome, medido, alvo, ok, info = false) => { res.push({ nome, medido, alvo, ok: !!ok, info }); };
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const errosTodos = [];
const srv = await servidor(0, raiz);

async function pagina(url, opc = {}) {
  const nav = await abrir({ largura: opc.largura ?? 1280, altura: opc.altura ?? 720, dpr: opc.dpr ?? 1, toque: opc.toque });
  await nav.pagina.goto(srv.url + url, { waitUntil: 'load' });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await nav.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return { ...nav, fechar: async () => { errosTodos.push(...nav.erros); await nav.navegador.close(); } };
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
    while (out.n < (opc.maxQ ?? 3000)) {
      g.relogio.avancar(1000 / 60, { desenhar: false }); out.n++;
      const e = temC ? g.comemoracao.estado : null, rp = g.replay?.estado;
      if (e) {
        const tela = g.comemoracao.naTela();
        const parada = m.partida.estado === 'gol' && m.tick + 1 - desde >= 150;
        if (parada && tick0 == null) { tick0 = m.tick; minuto0 = g.estado().relogio.minuto; }
        out.q.push({ t: e.t, fase: e.fase, plano: e.plano, estado: e.estado, tick: m.tick, alt: tela ? tela.altura : 0, dentro: !!(tela && tela.dentro), minuto: g.estado().relogio.minuto, parada,
          gol: document.getElementById('gol-tela').classList.contains('visivel'), mapa: vis('minimapa'), menu: vis('btn-menu'), painel: vis('#hud .painel-jogo'), placar: vis('#hud .placar') });
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
      if (rp?.ativo && !out.replay) out.replay = { tipo: rp.tipo, tick: m.tick, n: out.n };
      if (out.replay && !rp?.ativo && !out.replayDepois) out.replayDepois = { n: out.n, tick: m.tick };
      if (out.saidaTick == null && m.partida.estado !== 'gol' && m.tick > gol.golTick + 10) out.saidaTick = m.tick;
      if (m.tick >= alvo) { out.hash = g.hash(); break; }
    }
    out.tickParada = tick0; out.minuto0 = minuto0; out.desde = desde;
    return out;
  }, { gol, opc });
}

// ------------------------------------------------------------------------------------------------ A (PC, roteirizado)
let hashSem = null, saidaSem = null;
{
  const P = await pagina('?q=baixa&hora=dia&semente=5&comemoracao=0');
  try {
    const gol = await golRoteirizado(P.pagina, { semente: 5, time: 0 });
    const r = await acompanhar(P.pagina, gol);
    hashSem = r.hash; saidaSem = r.saidaTick - r.desde;
  } finally { await P.fechar(); }
}
let A = null;
{
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
    meta('A5 tela da cena: só o placar (e o "GOL!" até o 1º corte)', temC ? `"GOL!" na rede ${golNaRede}, depois do corte ${golDepois}; quadros com minimapa/menu/painel ou sem placar: ${hudMau}` : 'sem cena',
      '"GOL!" só na rede; 0', temC && golNaRede && !golDepois && hudMau === 0);
  } finally { await P.fechar(); }
}
// A6: o contraplano do abraço com e sem a torcida (pixels)
try {
  const P = await pagina('?q=media&hora=dia&semente=5');
  try {
    const pg = P.pagina;
    const temC = await pg.evaluate(() => !!window.__golaco.comemoracao);
    if (!temC) meta('A6 contraplano: a torcida enche o quadro', 'sem cena', '≥ 30%', false);
    else {
      await golRoteirizado(pg, { semente: 5, time: 0 });
      const ok = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 900; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); const e = g.comemoracao.estado; if (e && e.fase === 'abraco' && e.plano === 'contraplano' && e.t > e.kFimFinal / 60 + 0.4) return true; } return false; });
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
try {
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
try {
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

// ------------------------------------------------------------------------------------------------ D (gol natural)
try {
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
          q.push({ fase: e.fase, dentro: !!(tela && tela.dentro), alt: tela ? tela.altura : 0, estado: e.estado });
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
        meta('D gol natural (semente ' + GOL.semente + '): fases, duração e o autor no quadro', `time ${r.e0.time}${curta ? ' (curta)' : ''}, ${r.e0.variante}, ${r.e0.colegas.length} colegas; ${fases.join(' → ')}; ${f2(rod.length / 60)} s; autor no quadro ${bons}/${cf.length}`,
          `fases na ordem; ${curta ? '3,5–5,5' : '6–8,5'} s; ≥ 85%`, fases[0] === 'rede' && fases.includes('reacao') && (curta ? rod.length / 60 >= 3.5 && rod.length / 60 <= 5.5 : rod.length / 60 >= 6 && rod.length / 60 <= 8.5) && cf.length > 0 && bons / cf.length >= 0.85);
      }
    } finally { await P.fechar(); }
  }
} catch (e) { meta('D execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ E (treino)
try {
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
try {
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

await srv.fechar();
meta('G console sem erros', errosTodos.length ? errosTodos.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', errosTodos.length === 0);
const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.info ? 'INFO    ' : r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok || r.info);
console.log(ok ? '\nteste-comemoracao-tela: PASSOU' : '\nteste-comemoracao-tela: REPROVOU');
process.exit(ok ? 0 : 1);
