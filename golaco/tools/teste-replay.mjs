// Replay no navegador (Chromium): pedidos do dono de 11/10 — "o replay não funciona" e "quando o jogo parar por
// impedimento, no replay vai mostrar a linha".
//   A) gol ROTEIRIZADO (tools/lib/gol-roteirizado.mjs): o replay começa SOZINHO na saída de bola (nunca antes: a
//      câmera do gol fica no pós-gol), mostra o chute e a bola entrando (ticks do chute até depois do gol), com a
//      simulação parada, em ≥ 2 planos (TV 1× e atrás do gol em câmera lenta), 3–12 s; só a marca "REPLAY" no canto
//      (minimapa, menu e avisos somem; nenhum texto de lance); no fim a câmera de jogo volta e a partida segue; o apito
//      da saída toca DEPOIS do replay;
//      a arquibancada do lado de cá aparece/some pela câmera do replay (atrás do gol: aparece; TV: não);
//   B) hash: o mesmo lance com replay automático × sem replay (?replay=0) [× a versão --base] → o mesmo hash no tick
//      gol + 600 e a saída de bola no mesmo tick (o replay só lê o anel; a simulação só espera);
//   C) impedimento de verdade (IA × IA, a semente achada em Node): no apito o replay é do impedimento; a linha aparece
//      só do quadro do passe em diante, no x do lance, com a câmera alinhada a ela, congela ≥ 1,2 s e, depois do
//      replay, não fica parada no jogo; gols naturais no caminho: replay de 6–12 s (golaço: + a lateral) sem linha;
//      [informativo: quadros com a linha viva no jogo ao vivo — a frente "tela limpa" tira a linha viva];
//   D) "Replay" na pausa: toca os últimos ≤ 10 s com a simulação parada e volta ao jogo; Esc pula sem abrir a pausa;
//      uma tecla do jogo (K) pula e não vira chute; no celular (toque), "Pular" aparece e um toque em qualquer lugar
//      pula; "Replays automáticos: desligado" na pausa é salvo e o gol seguinte não tem replay; sem nada gravado, o
//      "Replay" da pausa não fecha a pausa;
//   E) custos: gravar ≤ 50 µs por passo; quadro do replay (CPU, sem o desenho) ≤ quadro ao vivo; anel ≤ 4 MB; console
//      sem erros;
//   F) a cena SEMIAUTOMÁTICA do impedimento (pedido do dono de 12/10): o selo "IMPEDIMENTO" só no quadro final da análise
//      (≥ 90% dos quadros dele, 0 antes; A10: nenhum selo fora dele em nenhum replay); as caixas do selo, do placar, da
//      marca REPLAY e do "Pular" não se tocam em 568×320, 667×375, 844×390 e 1280×720; só os jogadores do lance na análise
//      (2–3; 22 no P1); parede e plano no x certo, conferidos no anel; a análise de POSIÇÃO LEGAL (saotDeTeste: selo,
//      verde, plano atrás); hash igual com a cena e sem replay (?replay=0); o pulo na análise (some em 1 quadro, o selo
//      some, a tecla não vira jogada); chamadas ≤ o máximo ao vivo nos 120 quadros antes do apito + 1 e triângulos ≤ esse
//      máximo; CPU do quadro da análise ≤ o ao vivo; com o replay desligado: 0 quadro de replay, 0 selo, a linha parada
//      2,2 s como antes.
// Na versão sem replay reprova (A1, C2, D1: não existe replay); na sem a cena semiautomática, C5 (≥ 3,0 s), F1, F3–F5,
// F7 e F8 reprovam.
//   node tools/teste-replay.mjs [--raiz <pasta do jogo>] [--base <pasta do jogo de comparação para o hash>]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';
import { acharImpedimento } from './lib/acha-impedimento.mjs';
import { acharGol } from './lib/acha-gol.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const base = args.includes('--base') ? path.resolve(args[args.indexOf('--base') + 1]) : null;
const res = [];
const meta = (nome, medido, alvo, ok, info = false) => { res.push({ nome, medido, alvo, ok: !!ok, info }); };
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const errosTodos = [];

async function pagina(raizJogo, url, opc = {}) {
  const srv = await servidor(0, raizJogo);
  const nav = await abrir({ largura: opc.largura ?? 1280, altura: opc.altura ?? 720, dpr: opc.dpr, toque: opc.toque });
  await nav.pagina.goto(srv.url + url, { waitUntil: 'load' });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await nav.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return { ...nav, srv, fechar: async () => { errosTodos.push(...nav.erros); await nav.navegador.close(); await srv.fechar(); } };
}

// ------------------------------------------------------------------------------------------------ A + B
/** Gol roteirizado e quadros (1/60 s, sem desenhar) até o tick gol + 600; amostra cada quadro de replay. */
async function rodadaGol(raizJogo, url, clicar = false) {
  const P = await pagina(raizJogo, url);
  try {
    const pg = P.pagina;
    if (clicar) {
      // o som começa no 1º gesto (o apito da saída é medido): espera o apito decodificado (senão ele fica pendente)
      await pg.mouse.click(640, 400);
      await pg.waitForFunction(() => (window.__golaco.estadio.som?.decodificados ?? []).includes('apito'), null, { timeout: 20000 }).catch(() => {});
    }
    await pg.evaluate(() => { for (let i = 0; i < 3; i++) window.__golaco.relogio.avancar(1000 / 60, { desenhar: false }); });
    const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
    const r = await pg.evaluate(golTick => {
      const g = window.__golaco, m = g.mundo, temReplay = !!g.replay;
      const alvo = golTick + 600;
      const amostras = [];
      let saidaTick = null, hash = null, n = 0, antesDaSaida = 0, depois = null, apitoNoReplay = null, apitoDepois = null;
      const apitos = () => g.estadio.som?.tocados?.apito ?? 0;
      const ap0 = apitos();
      const vis = id => { const e = document.getElementById(id) ?? document.querySelector(id); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; };
      const selo = () => { const e = document.getElementById('terco'); return e && !e.hidden && getComputedStyle(e).display !== 'none' ? e.textContent.trim() : null; };
      let hud = null;
      while (n < 3000) {
        g.relogio.avancar(1000 / 60, { desenhar: false }); n++;
        const rp = temReplay ? g.replay.estado : null;
        if (saidaTick == null && m.partida.estado !== 'gol' && m.tick > golTick + 10) saidaTick = m.tick;
        if (rp?.ativo) {
          amostras.push({ tick: m.tick, rt: rp.tick, cam: rp.cam, vel: rp.vel, plano: rp.plano, tipo: rp.tipo, bx: g.render.bola.x, linha: !!g.linhaImpedimento?.visivel, ca: g.estadio.torcida?.ladoDeCa ?? null, cz: g.render.camera.z, cy: g.render.camera.y, checagem: rp.checagem, golaco: rp.golaco, fase: rp.saot?.fase ?? null, selo: selo() });
          if (!hud && amostras.length === 30) {
            const textos = [...document.querySelectorAll('#hud *, #replay *, #terco *')].filter(e => e.children.length === 0 && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && e.textContent.trim()).map(e => e.textContent.trim());
            hud = { marca: vis('replay-marca'), minimapa: vis('minimapa'), menu: vis('btn-menu'), aviso: vis('aviso'), pular: vis('replay-pular'), placar: vis('#hud .placar'), textos };
          }
          if (apitoNoReplay == null && amostras.length === 60) apitoNoReplay = apitos() - ap0;
        } else if (saidaTick == null) antesDaSaida++;
        if (!rp?.ativo && amostras.length && !depois) { depois = { plano: g.estadio.planoCamera, marca: vis('replay-marca'), tick: m.tick }; apitoDepois = apitos() - ap0; }
        if (m.tick >= alvo) { hash = g.hash(); break; }
      }
      // a partida segue depois do replay: a bola rola na saída (o tick anda)
      return { amostras, saidaTick, hash, n, depois, hud, apitoNoReplay, apitoDepois, somEstado: g.estadio.som?.estado ?? null, tickFim: m.tick, custo: temReplay ? g.replay.custo : null, anel: temReplay ? g.replay.anel : null };
    }, gol.golTick);
    return { gol, ...r };
  } finally { await P.fechar(); }
}

const seloForaDoFinal = [];   // A10: quadros de replay com o selo fora do quadro final da análise
const comR = await rodadaGol(raiz, '?q=baixa&hora=dia&semente=5', true);
{
  const a = comR.amostras, n = a.length;
  const tks = a.map(x => x.rt);
  const simParada = n > 0 && a.every(x => x.tick === a[0].tick);
  const cruzou = a.some(x => Math.abs(x.bx) > 52.5 + 0.11);
  const planos = [...new Set(a.map(x => `${x.cam}@${x.vel}`))];
  meta('A1 o replay do gol começa sozinho na saída de bola (não antes)', n ? `${n} quadros de replay (${a[0].tipo}), no tick ${a[0].tick}; saída ${comR.saidaTick}; gol ${comR.gol.golTick}` : 'nenhum replay',
    'tipo gol, no tick da saída', n > 0 && a[0].tipo === 'gol' && a[0].tick === comR.saidaTick);
  meta('A2 mostra o chute e a bola entrando', n ? `ticks ${Math.min(...tks).toFixed(0)}–${Math.max(...tks).toFixed(0)} (chute ${comR.gol.tickChute}, gol ${comR.gol.golTick}); bola passa a linha ${cruzou}` : '-',
    '≤ chute + 1 (o roteiro leva a bola no chute: o replay não atravessa o corte), ≥ gol, cruza', n && Math.min(...tks) <= comR.gol.tickChute + 1 && Math.max(...tks) >= comR.gol.golTick && cruzou);
  meta('A3 a simulação fica parada durante o replay', simParada ? `parada no tick ${a[0].tick}` : 'ANDOU', 'mesmo tick em todos os quadros', simParada);
  const chk = n > 0 && a.some(x => x.checagem), golA = n > 0 && a.some(x => x.golaco);
  meta('A4 planos do replay (a análise de posição legal só com a checagem)', `${planos.join(', ') || '-'}${chk ? ' (com checagem)' : ''}`, 'tv@1 e atras@0.5; saot só com checagem', planos.includes('tv@1') && planos.includes('atras@0.5') && (!planos.includes('saot@1') || chk));
  const maxA = chk ? (golA ? 15 : 13) : 12;
  meta('A5 duração (relógio real)', `${f2(n / 60)} s${chk ? ' (com checagem)' : ''}`, `3–${maxA} s`, n / 60 >= 3 && n / 60 <= maxA + 0.1);
  seloForaDoFinal.push(...a.filter(x => x.selo && x.fase !== 'final').map(() => 'gol roteirizado'));
  const h = comR.hud;
  meta('A6 tela do replay: só a marca "REPLAY" (sem texto de lance), sem minimapa, menu e avisos', h ? `marca ${h.marca}, placar ${h.placar}, minimapa ${h.minimapa}, menu ${h.menu}, aviso ${h.aviso}, "Pular" (PC) ${h.pular}; textos: ${JSON.stringify(h.textos)}` : '-',
    'marca e placar sim; o resto não; textos só do placar e "REPLAY"',
    h && h.marca && h.placar && !h.minimapa && !h.menu && !h.aviso && !h.pular && h.textos.every(t => /^(REPLAY|[A-ZÇ]{2,4}|\d+|\d+'|\d+\+\d+'|[12]º T( \+\d+)?)$/.test(t)));
  meta('A7 depois do replay a câmera de jogo volta e a partida segue', comR.depois ? `câmera ${comR.depois.plano}, marca ${comR.depois.marca}; tick ${comR.depois.tick} → ${comR.tickFim}` : '-', 'jogo, sem marca, o tick anda',
    comR.depois && comR.depois.plano === 'jogo' && !comR.depois.marca && comR.tickFim > comR.depois.tick);
  {
    // a arquibancada do lado de cá segue a câmera do REPLAY (antes ficava como no último quadro do jogo: escondida pela
    // câmera de TV, que fica dentro dela — e o plano de trás do gol mostrava o estádio sem o lado de cá)
    const por = {};
    for (const x of a) { const k = `${x.cam}@${x.vel}`; const o = (por[k] ??= { n: 0, ca: 0 }); o.n++; if (x.ca) o.ca++; }
    const tv = por['tv@1'], atras = por['atras@0.5'];
    meta('A9 arquibancada do lado de cá pela câmera do replay', Object.entries(por).map(([k, o]) => `${k}: ${o.ca}/${o.n} quadros com ela desenhada`).join(', ') || '-',
      'TV (dentro dela): 0; atrás do gol: ≥ 1', !!tv && !!atras && tv.ca === 0 && atras.ca > 0);
  }
  if (comR.somEstado === 'rodando') meta('A8 o apito da saída toca DEPOIS do replay', `no replay ${comR.apitoNoReplay}, depois ${comR.apitoDepois}`, '0 e ≥ 1', comR.apitoNoReplay === 0 && comR.apitoDepois >= 1);
  else meta('A8 o apito da saída toca DEPOIS do replay', `som ${comR.somEstado}: não medido`, '-', true, true);
}
const semR = await rodadaGol(raiz, '?q=baixa&hora=dia&semente=5&replay=0');
const pub = base ? await rodadaGol(base, '?q=baixa&hora=dia&semente=5') : null;
meta('B1 hash no tick gol + 600: com replay × sem replay' + (pub ? ' × base' : ''), `${comR.hash} / ${semR.hash}${pub ? ' / ' + pub.hash : ''}`, 'iguais', comR.hash != null && comR.hash === semR.hash && (!pub || pub.hash === semR.hash));
meta('B2 a saída de bola no mesmo tick', `${comR.saidaTick} / ${semR.saidaTick}${pub ? ' / ' + pub.saidaTick : ''}`, 'iguais', comR.saidaTick != null && comR.saidaTick === semR.saidaTick && (!pub || pub.saidaTick === semR.saidaTick));
meta('B3 sem replay (?replay=0): nada de replay', `${semR.amostras.length} quadros de replay`, '0', semR.amostras.length === 0);

// ------------------------------------------------------------------------------------------------ C0 (gol natural)
// um gol DE VERDADE da partida IA × IA (a semente achada em Node: acharGol), visto na página: o replay dele inteiro
try {
  const GOL = await acharGol({ pastaJs: path.join(raiz, 'js'), maxTicks: 6000, comoPagina: true });
  if (!GOL) meta('C0 gol natural (IA × IA) nas sementes 1–40 (Node)', 'nenhum', '≥ 1', false);
  else {
    const P = await pagina(raiz, `?q=baixa&hora=dia&demo=1&semente=${GOL.semente}`);
    try {
      const gn = await P.pagina.evaluate(() => {
        const g = window.__golaco, m = g.mundo;
        // a página não refaz passo a passo o laço do Node (o lance é procurado aqui): anda até o 1º replay de GOL (os
        // de impedimento no caminho são pulados)
        let n = 0;
        while (n < 16000) {
          g.relogio.avancar(1000 / 60, { desenhar: false }); n++;
          const e = g.replay?.estado;
          if (e?.ativo && e.tipo === 'gol') break;
          if (e?.ativo) g.replay.pular();
        }
        const rp = g.replay?.estado;
        if (!rp?.ativo) return { semGol: true, n };
        const ticks = [], cams = new Set(), xs = []; let q = 0, linha = 0, seloFora = 0; const simTick = m.tick; let andou = false;
        const tipo = rp.tipo, golaco = rp.golaco, checagem = rp.checagem;
        while (g.replay.estado.ativo && q < 2000) {
          const e = g.replay.estado; ticks.push(e.tick); cams.add(e.cam + '@' + e.vel); xs.push(g.render.bola.x);
          if (g.linhaImpedimento.visivel && e.cam !== 'saot') linha++;
          if (g.replay.planos?.selo && e.saot?.fase !== 'final') seloFora++;
          g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
          if (m.tick !== simTick && g.replay.estado.ativo) andou = true;
        }
        return { tipo, tick: simTick, s: +(q / 60).toFixed(2), de: Math.min(...ticks), ate: Math.max(...ticks), cams: [...cams], linha, andou, golaco, checagem, seloFora, cruzou: xs.some(x => Math.abs(x) > 52.61) };
      });
      // REPLAY.gol.maximoGolaco (+ 0,2 s dos quadros de borda); com a checagem de posição legal, + 1 s
      const maxGol = 14.2 + (gn.checagem ? 1 : 0), maxN = 12 + (gn.checagem ? 1 : 0);
      if (gn.seloFora) seloForaDoFinal.push('gol natural');
      // o lance foi achado em Node com a entrada da página (comoPagina): sem ele aqui, a página divergiu do Node
      if (gn.semGol) meta('C0 replay de um gol NATURAL (IA × IA)', `semente ${GOL.semente}: nenhum replay de gol em ${gn.n} quadros na página (o Node achou o gol no tick ${GOL.golTick})`, 'o gol do Node também na página', false);
      else meta('C0 replay de um gol NATURAL (IA × IA)', `semente ${GOL.semente}, saída no tick ${gn.tick}: ${gn.s} s, ticks ${gn.de.toFixed(0)}–${gn.ate.toFixed(0)}, ${gn.cams.join(' ')}${gn.golaco ? ', golaço' : ''}${gn.checagem ? ', com checagem' : ''}; bola entra ${gn.cruzou}; linha ${gn.linha}; sim andou ${gn.andou}`,
        `6–${gn.golaco ? f2(maxGol) : maxN} s, bola entra, sim parada, sem linha (fora da análise)`, gn.s >= 6 && gn.s <= (gn.golaco ? maxGol : maxN) && gn.cruzou && !gn.andou && gn.linha === 0 && (!gn.cams.includes('saot@1') || gn.checagem));
    } finally { await P.fechar(); }
  }
} catch (e) { meta('C0 execução (gol natural)', e.message, 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ C + D + E (+ F)
const caixasSelo = [];          // F2: caixas do selo, do placar, da marca e do "Pular" (por tamanho de tela)
const analise = [];             // F8/F9: chamadas, triângulos e CPU da análise
const hashImped = { com: null, sem: null };
let apitoP1 = null;
const IMP = await acharImpedimento({ pastaJs: path.join(raiz, 'js'), depoisDe: 900 });
if (!IMP) meta('C impedimento de verdade nas sementes 1–40 (Node)', 'nenhum', '≥ 1', false);
else try {
  const P = await pagina(raiz, `?q=baixa&hora=dia&demo=1&semente=${IMP.semente}`);
  try {
    const pg = P.pagina;
    const r = await pg.evaluate(() => {
      const g = window.__golaco, m = g.mundo;
      let n = 0, vivo = 0, vivoLinha = 0;
      const golsNat = [];
      while (n < 26000) {
        g.relogio.avancar(1000 / 60, { desenhar: false }); n++;
        const rp = g.replay?.estado;
        if (rp?.ativo && rp.tipo === 'gol') {
          const ticks = [], cams = new Set(); let q = 0, linha = 0, seloFora = 0; const simTick = m.tick; let andou = false; const golaco = rp.golaco, checagem = rp.checagem;
          while (g.replay.estado.ativo && q < 2000) {
            const e = g.replay.estado; ticks.push(e.tick); cams.add(e.cam + '@' + e.vel);
            if (g.linhaImpedimento.visivel && e.cam !== 'saot') linha++;
            if (g.replay.planos?.selo && e.saot?.fase !== 'final') seloFora++;
            g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
            if (m.tick !== simTick && g.replay.estado.ativo) andou = true;
          }
          golsNat.push({ tick: simTick, s: +(q / 60).toFixed(2), de: Math.min(...ticks), ate: Math.max(...ticks), cams: [...cams], linha, andou, golaco, checagem, seloFora });
          continue;
        }
        if (m.eventos.some(e => e.tipo === 'impedimento')) break;
        if (rp?.ativo) continue;
        if (m.partida.estado === 'jogo') { vivo++; if (g.linhaImpedimento.visivel) vivoLinha++; }
      }
      const ev = m.eventos.find(e => e.tipo === 'impedimento') ?? null;
      return { n, vivo, vivoLinha, tick: m.tick, rp: g.replay?.estado ?? { tipo: null, ativo: false }, ev, golsNat };
    });
    for (const gn of r.golsNat) {
      const maxGol = 14.2 + (gn.checagem ? 1 : 0), maxN = 12 + (gn.checagem ? 1 : 0);
      if (gn.seloFora) seloForaDoFinal.push('gol natural no caminho');
      meta('C0 replay de um gol NATURAL (IA × IA) no caminho', `tick ${gn.tick}: ${gn.s} s, ticks ${gn.de.toFixed(0)}–${gn.ate.toFixed(0)}, ${gn.cams.join(' ')}${gn.golaco ? ', golaço' : ''}${gn.checagem ? ', com checagem' : ''}; linha ${gn.linha}; sim andou ${gn.andou}`, `6–${gn.golaco ? f2(maxGol) : maxN} s, sim parada, sem linha (fora da análise)`,
        gn.s >= 6 && gn.s <= (gn.golaco ? maxGol : maxN) && !gn.andou && gn.linha === 0 && (!gn.cams.includes('saot@1') || gn.checagem));
    }
    // a tela limpa (11/10) tirou a linha viva do jogo: a linha só aparece no replay do impedimento (e parada no apito)
    meta('C1 linha de impedimento AO VIVO (bola rolando, fora do replay)', `${r.vivoLinha} de ${r.vivo} quadros (${f2(100 * r.vivoLinha / Math.max(1, r.vivo))}%)`, '0', r.vivoLinha === 0);
    meta('C2 no apito do impedimento o replay começa (tipo impedimento)', `${r.rp.tipo ?? 'nenhum'} no tick ${r.tick}${r.ev ? ` (foto ${r.ev.tickFoto}, linha x ${f2(r.ev.linhaX)})` : ''}`, 'impedimento', !!r.ev && r.rp.ativo && r.rp.tipo === 'impedimento');
    if (r.ev && r.rp.tipo === 'impedimento') {
      const qs = await pg.evaluate(() => {
        const g = window.__golaco, out = [];
        const selo = () => { const e = document.getElementById('terco'); return e && !e.hidden && getComputedStyle(e).display !== 'none' ? e.textContent.trim() : null; };
        for (let i = 0; i < 1200; i++) {
          const rp = g.replay.estado;
          if (!rp.ativo) break;
          const pl = g.replay.planos;
          out.push({ rt: rp.tick, cong: rp.congelado, linha: g.linhaImpedimento, cam: { ...g.render.camera }, simTick: g.mundo.tick, plano: rp.cam, fase: rp.saot?.fase ?? null, selo: selo(), desenhados: g.replay.desenhados,
            xParede: pl?.xParede ?? null, xPlano: pl?.xPlano ?? null, corPlano: pl?.corPlano ?? null, planosVis: !!pl?.visivel, lado: rp.saot?.lado ?? null, idDef: rp.saot?.idDef ?? null, idAtac: rp.saot?.idAtac ?? null });
          g.relogio.avancar(1000 / 60, { desenhar: false });
        }
        return out;
      });
      const foto = r.ev.tickFoto, lx = r.ev.linhaX;
      const com = qs.filter(q => q.linha.visivel);
      const antes = qs.filter(q => q.linha.visivel && q.rt < foto - 1e-6).length;
      const apagou = qs.filter(q => !q.linha.visivel && q.rt >= foto).length;
      meta('C3 a linha só do quadro do passe em diante, sem apagar', `${com.length} de ${qs.length} quadros com linha; antes do passe ${antes}; apagou depois ${apagou}; 1º tick com linha ${com[0] ? f2(com[0].rt) : '-'} (passe ${foto})`, 'antes 0, apagou 0, 1º = passe',
        com.length > 0 && antes === 0 && apagou === 0 && Math.abs(com[0].rt - foto) < 1e-6);
      // P1 'linha': a linha no x do lance e a câmera alinhada com ela (na análise a câmera dá a volta)
      const comP1 = com.filter(q => q.plano === 'linha');
      const xOk = com.every(q => Math.abs(q.linha.x - lx) < 0.01), camOk = comP1.every(q => Math.abs(q.cam.x - lx) < 0.5);
      meta('C4 a linha no x do lance e a câmera alinhada a ela (P1)', `linha x ${com[0] ? f2(com[0].linha.x) : '-'} × lance ${f2(lx)}; câmera x ${comP1[0] ? f2(comP1[0].cam.x) : '-'} (${comP1.length} quadros do P1)`, '|Δ| < 0,01; câmera ±0,5 m', comP1.length > 0 && xOk && camOk);
      const p2 = qs.filter(q => q.plano === 'saot');
      const cong = p2.filter(q => q.cong).length;
      meta('C5 a análise congela no quadro do passe (P2)', `${f2(cong / 60)} s em ${p2.length} quadros (sim parada: ${qs.every(q => q.simTick === qs[0].simTick)})`, '≥ 3,0 s, sim parada', cong / 60 >= 3.0 && qs.every(q => q.simTick === qs[0].simTick));
      // ------------------------------------------------ F (cena semiautomática): selo, só os do lance, parede e plano
      const finais = p2.filter(q => q.fase === 'final'), comSelo = finais.filter(q => q.selo === 'IMPEDIMENTO').length;
      const antesSelo = qs.filter(q => q.selo && q.fase !== 'final').length;
      if (antesSelo) seloForaDoFinal.push('impedimento natural');
      meta('F1 o selo "IMPEDIMENTO" só no quadro final da análise', `${comSelo} de ${finais.length} quadros finais; ${antesSelo} quadros com selo antes`, '≥ 90%, 0 antes', finais.length > 0 && comSelo >= 0.9 * finais.length && antesSelo === 0);
      const p1 = qs.filter(q => q.plano === 'linha');
      const d2 = [...new Set(p2.map(q => q.desenhados))], d1 = [...new Set(p1.map(q => q.desenhados))];
      meta('F3 só os jogadores do lance na análise (2–3); todos no P1', `análise ${d2.join('/')}, P1 ${d1.join('/')}`, 'análise 2 ou 3; P1 22', p2.length > 0 && d2.every(n => n >= 2 && n <= 3) && d1.length > 0 && d1.every(n => n === 22));
      const fq = finais[0];
      const noAnel = fq ? await pg.evaluate(({ foto, a, d }) => ({ atac: window.__golaco.replay.noAnel(foto, a), def: d >= 0 ? window.__golaco.replay.noAnel(foto, d) : null }), { foto, a: fq.idAtac, d: fq.idDef }) : null;
      const okX = !!noAnel && !!noAnel.def && Math.abs(fq.xParede - noAnel.def.x) < 1e-4 && Math.abs(fq.xPlano - noAnel.atac.x) < 1e-4 && Math.abs(fq.xParede - lx) < 1e-4;
      const alem = fq ? (fq.xPlano - fq.xParede) * fq.lado : NaN;
      // a cor entra em 0,15 s depois da decisão: o último quadro final já está todo vermelho
      const fu = finais.at(-1);
      meta('F4 parede no x do defensor (= a linha) e plano no x do atacante, conferidos no anel; o plano passa a parede > 0,10 m', fq && noAnel ? `parede ${fq.xParede.toFixed(4)} × defensor ${noAnel.def?.x.toFixed(4)} × linha ${lx.toFixed(4)}; plano ${fq.xPlano.toFixed(4)} × atacante ${noAnel.atac?.x.toFixed(4)}; além ${f2(alem)} m; no fim, plano #${fu.corPlano?.toString(16)}` : '-',
        '|Δ| < 1e-4; > 0,10 m; vermelho (#ff3b30)', okX && alem > 0.10 && fu.corPlano === 0xff3b30 && finais.every(q => q.planosVis && q.xParede === fq.xParede && q.xPlano === fq.xPlano));
      const depois = await pg.evaluate(() => { const g = window.__golaco, t0 = g.mundo.tick; let linha = 0, planos = 0, selo = 0; for (let i = 0; i < 60; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.linhaImpedimento.visivel) linha++; if (g.replay.planos?.visivel) planos++; if (!document.getElementById('terco').hidden) selo++; } return { linha, planos, selo, rp: g.replay.estado.ativo, parada: g.mundo.parada?.tipo ?? null, andou: g.mundo.tick - t0 }; });
      meta('C6 depois do replay: a linha, os planos e o selo não ficam no jogo e o tiro livre segue', `linha em ${depois.linha}, planos em ${depois.planos}, selo em ${depois.selo} de 60 quadros, replay ${depois.rp}, parada ${depois.parada}, a sim andou ${depois.andou} passos`, 'linha 0, planos 0, selo 0, replay não, anda',
        depois.linha === 0 && depois.planos === 0 && depois.selo === 0 && !depois.rp && depois.andou > 0);
      // ---------------------------------------------- F7: pulo na análise; F8/F9 (a análise de novo, com o desenho)
      const f7 = await pg.evaluate(() => {
        const g = window.__golaco;
        if (!g.replay.saotDeTeste('impedimento')) return { semRoteiro: true };
        let q = 0;
        while (q < 900 && g.replay.estado.ativo && !(g.replay.estado.cam === 'saot' && g.replay.estado.saot.fase === 'orbita')) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
        return { ativo: g.replay.estado.ativo, cam: g.replay.estado.cam, tick: g.mundo.tick };
      });
      await pg.keyboard.down('KeyK');
      const f7b = await pg.evaluate(() => {
        const g = window.__golaco;
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const r = { ativo: g.replay.estado.ativo, selo: !document.getElementById('terco').hidden, planos: !!g.replay.planos?.visivel };
        let cargas = 0;
        for (let i = 0; i < 20; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.estado().jogador?.carga) cargas++; }
        r.cargas = cargas;
        return r;
      });
      await pg.keyboard.up('KeyK');
      // o pulo também com o selo na tela (quadro final)
      const f7c = await pg.evaluate(() => {
        const g = window.__golaco;
        if (!g.replay.saotDeTeste('impedimento')) return { semRoteiro: true };
        let q = 0;
        while (q < 900 && g.replay.estado.ativo && !(g.replay.estado.cam === 'saot' && g.replay.estado.saot.fase === 'final' && g.replay.estado.saot.t > 2.3)) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
        const antes = !document.getElementById('terco').hidden;
        const caixa = id => { const e = document.querySelector(id); const b = e?.getBoundingClientRect(); return b && b.width > 0 ? { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom } : null; };
        const caixas = { selo: caixa('#terco .terco-selo'), placar: caixa('#hud .placar'), marca: caixa('#replay-marca'), pular: caixa('#replay-pular') };
        g.replay.pular();
        g.relogio.avancar(1000 / 60, { desenhar: false });
        return { antes, depois: !document.getElementById('terco').hidden, ativo: g.replay.estado.ativo, caixas, w: innerWidth, h: innerHeight };
      });
      meta('F7 o pulo na análise: some em ≤ 1 quadro, o selo some e a tecla não vira jogada', f7.semRoteiro ? 'sem roteiro (o passe saiu do anel)' : `K na órbita: replay ${f7b.ativo}, selo ${f7b.selo}, planos ${f7b.planos}, quadros com carga ${f7b.cargas}; pular no quadro final: selo antes ${f7c.antes} → depois ${f7c.depois}, replay ${f7c.ativo}`,
        'não, não, não, 0; sim → não, não', !f7.semRoteiro && f7.ativo && f7.cam === 'saot' && !f7b.ativo && !f7b.selo && !f7b.planos && f7b.cargas === 0 && f7c.antes && !f7c.depois && !f7c.ativo);
      caixasSelo.push(f7c);
      // F8/F9: a análise de novo, desenhando o quadro final (chamadas, triângulos) e medindo a CPU do quadro da análise
      const f8 = await pg.evaluate(() => {
        const g = window.__golaco;
        if (!g.replay.saotDeTeste('impedimento')) return { semRoteiro: true };
        let q = 0;
        while (q < 900 && g.replay.estado.ativo && g.replay.estado.cam !== 'saot') { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
        g.replay.zerarCusto();
        let cham = 0, tri = 0, nf = 0;
        while (q < 2000 && g.replay.estado.ativo && g.replay.estado.cam === 'saot') {
          const fin = g.replay.estado.saot.fase === 'final' && g.replay.estado.saot.t < 3.4;
          g.relogio.avancar(1000 / 60, { desenhar: fin && nf < 12 });
          if (fin && nf < 12) { const e = g.estado(); cham = Math.max(cham, e.desenhoChamadas); tri = Math.max(tri, e.desenhoTriangulos); nf++; }
          q++;
        }
        const c = g.replay.custo;
        g.replay.pular();
        return { cham, tri, nf, cpu: c.quadroReplayMs, quadros: c.quadros };
      });
      analise.push(f8);
      apitoP1 = r.tick;
      // o hash no tick apito + 600 (a simulação nunca andou durante os replays)
      hashImped.com = await pg.evaluate(alvo => { const g = window.__golaco; let n = 0; while (g.mundo.tick < alvo && n < 4000) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.replay.estado.ativo) g.replay.pular(); n++; } return g.mundo.tick === alvo ? g.hash() : null; }, r.tick + 600);
      // F5: a análise de POSIÇÃO LEGAL pelo saotDeTeste (o passe apertado em posição legal mais apertado do anel; sem
      // nenhum até 1,0 m nesta partida, com outro teto — o desenho é o mesmo)
      const f5 = await pg.evaluate(() => {
        const g = window.__golaco;
        let n = 0, lim = 1.0, mg = null;
        while (n < 3600 && (mg = g.replay.legalMaisApertada(1.0)) == null) { for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.replay.estado.ativo) g.replay.pular(); n += 30; }
        if (mg == null) { lim = 60; for (let k = 0; k < 120 && (mg = g.replay.legalMaisApertada(60)) == null; k++) { for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.replay.estado.ativo) g.replay.pular(); } }
        if (mg == null || !g.replay.saotDeTeste('legal', { limite: lim })) return { nenhum: true, n };
        const selo = () => { const e = document.getElementById('terco'); return e && !e.hidden ? e.textContent.trim() : null; };
        const fin = [];
        let q = 0;
        while (q < 2000 && g.replay.estado.ativo) {
          const e = g.replay.estado;
          if (e.cam === 'saot' && e.saot.fase === 'final') { const pl = g.replay.planos; fin.push({ selo: selo(), cor: pl.corParede, xParede: pl.xParede, xPlano: pl.xPlano, lado: e.saot.lado, plano: pl.plano, margem: e.saot.margem }); }
          if (e.cam === 'saot' && e.saot.fase !== 'final' && selo()) fin.push({ antes: true });
          g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
        }
        return { lim, mg, fin, n };
      });
      if (f5.nenhum) meta('F5 a análise de POSIÇÃO LEGAL (saotDeTeste)', `nenhuma cadeia de passe legal no anel em ${f5.n} quadros`, 'uma cena', false);
      else {
        const fl = f5.fin.filter(q => !q.antes), antesL = f5.fin.filter(q => q.antes).length;
        const okL = fl.length > 0 && fl.filter(q => q.selo === 'POSIÇÃO LEGAL').length >= 0.9 * fl.length && antesL === 0 && fl.at(-1).cor === 0x19e07a && fl.every(q => (q.xPlano - q.xParede) * q.lado <= 0.10 + 1e-9);
        meta('F5 a análise de POSIÇÃO LEGAL (saotDeTeste): selo, verde e o plano atrás da parede', `margem ${f2(f5.mg)} m${f5.lim > 1 ? ` (nenhum passe até 1,0 m nesta partida: teto de teste ${f5.lim} m)` : ''}; ${fl.filter(q => q.selo === 'POSIÇÃO LEGAL').length} de ${fl.length} quadros finais com o selo, ${antesL} antes; parede ${fl.at(-1) ? '#' + fl.at(-1).cor.toString(16) : '-'}; plano ${fl.at(-1) ? f2((fl.at(-1).xPlano - fl.at(-1).xParede) * fl.at(-1).lado) : '-'} m da parede`,
          '≥ 90% com o selo, 0 antes; #19e07a; ≤ +0,10 m', okL);
      }
    }
    // ---------------------------------------------------------------- D (pausa, Esc, tecla, desligar)
    await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 700; i++) { if (g.replay.estado.ativo) g.replay.pular(); g.relogio.avancar(1000 / 60, { desenhar: false }); } });
    await pg.evaluate(() => window.__golaco.abrirMenu());
    const temBotao = await pg.evaluate(() => { const b = document.querySelector('#menu [data-cmd="replay"]'); return !!b && !b.hidden && b.offsetParent !== null; });
    const tickAntes = await pg.evaluate(() => window.__golaco.mundo.tick);
    if (temBotao) await pg.click('#menu [data-cmd="replay"]');
    const em = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return { rp: g.replay.estado, anel: g.replay.anel, tick: g.mundo.tick, menu: g.estado().menuAberto }; });
    meta('D1 "Replay" na pausa toca os últimos ≤ 10 s com a simulação parada', `botão ${temBotao}; tipo ${em.rp.tipo}, plano ${em.rp.de}–${em.rp.ate} (anel ${em.anel.primeiro}–${em.anel.ultimo}), sim parada ${em.tick === tickAntes}, pausa fechada ${!em.menu}`,
      'botão, menu, ≤ 600 ticks, sim parada', temBotao && em.rp.tipo === 'menu' && em.rp.ate - em.rp.de <= 600 && em.tick === tickAntes && !em.menu);
    await pg.keyboard.press('Escape');
    const pulou = await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: false }); return { ativo: g.replay.estado.ativo, menu: g.estado().menuAberto }; });
    meta('D2 Esc pula o replay sem abrir a pausa', JSON.stringify(pulou), 'ativo false, menu false', !pulou.ativo && !pulou.menu);
    // K (chute/dividida) pula e não vira jogada: depois do pulo, nenhuma carga
    await pg.evaluate(() => { const g = window.__golaco; g.reiniciar({ modo: 'partida', semente: 3 }); for (let i = 0; i < 400; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.replay.menu(); g.relogio.avancar(1000 / 60, { desenhar: false }); });
    const antesK = await pg.evaluate(() => window.__golaco.replay.estado.ativo);
    await pg.keyboard.down('KeyK');
    const posK = await pg.evaluate(() => { const g = window.__golaco; const r = []; for (let i = 0; i < 20; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); r.push(!!g.estado().jogador?.carga); } return { ativo: g.replay.estado.ativo, cargas: r.filter(Boolean).length }; });
    await pg.keyboard.up('KeyK');
    meta('D3 uma tecla do jogo (K) pula e não vira chute', `replay antes ${antesK}, depois ${posK.ativo}; quadros com carga depois do pulo ${posK.cargas}`, 'sim → não; 0', antesK && !posK.ativo && posK.cargas === 0);
    // desligar na pausa: salvo; o gol seguinte sem replay
    await pg.evaluate(() => window.__golaco.abrirMenu());
    await pg.click('#menu .segmentado[data-grupo="replayAuto"] button[data-valor="desligado"]');
    const salvo = await pg.evaluate(() => { const g = window.__golaco; g.fecharMenu(); let p = {}; try { p = JSON.parse(localStorage.getItem('golaco.prefs.v1') || '{}'); } catch (_) {} return { auto: g.replay.automatico(), salvo: p.replay, marcado: document.querySelector('#menu .segmentado[data-grupo="replayAuto"] [aria-pressed="true"]')?.dataset.valor }; });
    const gol2 = await golRoteirizado(pg, { semente: 5, time: 0 });
    const semAuto = await pg.evaluate(gt => { const g = window.__golaco; let q = 0; for (let i = 0; i < 260; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.replay.estado.ativo) q++; } return { q, passou: g.mundo.tick - gt }; }, gol2.golTick);
    meta('D4 "Replays automáticos: desligado" na pausa: salvo, e o gol seguinte sem replay', `automático ${salvo.auto}, salvo ${salvo.salvo}, marcado ${salvo.marcado}; ${semAuto.q} quadros de replay em ${semAuto.passou} passos depois do gol`, 'false, false, desligado; 0', salvo.auto === false && salvo.salvo === false && salvo.marcado === 'desligado' && semAuto.q === 0 && gol2.ok);
    // ---------------------------------------------------------------- E (custos)
    await pg.evaluate(() => { const g = window.__golaco; g.replay.automatico(true); g.reiniciar({ modo: 'partida', semente: 4 }); for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.replay.zerarCusto(); g.medirQuadro({ zerar: true }); });
    const vivoM = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 600; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return { q: g.medirQuadro(), c: g.replay.custo }; });
    const rpc = await pg.evaluate(() => { const g = window.__golaco; g.replay.menu(); for (let i = 0; i < 300; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.replay.custo; });
    // em lotes (o relógio da página é grosso para ~10 µs de uma vez); a média passo a passo do jogo vai junto, informativa
    const lote = await pg.evaluate(() => window.__golaco.replay.medirGravacao(120, 7));
    meta('E1 gravar no anel (Chromium, mediana de 7 lotes de 120)', `${f2(lote * 1000)} µs por passo (no jogo, passo a passo: ${f2(vivoM.c.gravarMsPorPasso * 1000)} µs em ${vivoM.c.passos} passos)`, '≤ 50 µs', lote <= 0.05);
    meta('E2 quadro do replay (CPU, sem o desenho) × quadro ao vivo', `${rpc.quadroReplayMs.toFixed(3)} ms × ${vivoM.q.cpu.media.toFixed(3)} ms`, 'replay ≤ ao vivo', rpc.quadros > 0 && rpc.quadroReplayMs <= vivoM.q.cpu.media);
    const anelB = await pg.evaluate(() => window.__golaco.replay.anel.bytes);
    meta('E3 memória do anel (10 s, 24 vagas)', `${f2(anelB / 1048576)} MB`, '≤ 4 MB', anelB > 0 && anelB <= 4 * 1048576);
  } finally { await P.fechar(); }
} catch (e) { meta('C–E execução (impedimento, pausa, custos)', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ D (celular, toque)
try {
  const P = await pagina(raiz, '?q=baixa&hora=dia&semente=4&toque=1&entalhe=1', { largura: 844, altura: 390, dpr: 1, toque: true });
  try {
    const pg = P.pagina;
    // logo no começo (nada gravado ainda): "Replay" na pausa não fecha a pausa nem começa nada
    const vazio = await pg.evaluate(() => { const g = window.__golaco; g.abrirMenu(); document.querySelector('#menu [data-cmd="replay"]').click(); const r = { ativo: g.replay.estado.ativo, menu: g.estado().menuAberto, anel: g.replay.anel.ultimo - g.replay.anel.primeiro + 1 }; g.fecharMenu(); return r; });
    meta('D7 "Replay" na pausa sem nada gravado: a pausa fica aberta, nenhum replay', JSON.stringify(vazio), 'ativo false, menu true', !vazio.ativo && vazio.menu);
    await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 400; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.replay.menu(); g.relogio.avancar(1000 / 60, { desenhar: true }); });
    const tela = await pg.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'; };
      const b = document.getElementById('replay-pular')?.getBoundingClientRect();
      return { ativo: window.__golaco.replay.estado.ativo, pular: vis('replay-pular'), marca: vis('replay-marca'), minimapa: vis('minimapa'), toque: getComputedStyle(document.getElementById('toque')).display !== 'none', pularCaixa: b ? { w: Math.round(b.width), h: Math.round(b.height), dentro: b.right <= window.innerWidth && b.bottom <= window.innerHeight } : null };
    });
    meta('D5 celular: "Pular" (≥ 48 px, na tela) e a marca; botões de toque e minimapa somem', JSON.stringify(tela), 'pular e marca sim; toque e minimapa não', tela.ativo && tela.pular && tela.marca && !tela.minimapa && !tela.toque && tela.pularCaixa && tela.pularCaixa.h >= 48 && tela.pularCaixa.dentro);
    // F2: o selo no terço de baixo com o replay na tela, em 844×390, 667×375 e 568×320 (o "Pular" aparece com toque)
    for (const [w, h] of [[844, 390], [667, 375], [568, 320]]) {
      await pg.setViewportSize({ width: w, height: h });
      caixasSelo.push(await pg.evaluate(() => {
        const g = window.__golaco;
        g.replay.selo('impedimento');
        const caixa = id => { const e = document.querySelector(id); const b = e?.getBoundingClientRect(); return b && b.width > 0 ? { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom } : null; };
        return { caixas: { selo: caixa('#terco .terco-selo'), placar: caixa('#hud .placar'), marca: caixa('#replay-marca'), pular: caixa('#replay-pular') }, w: innerWidth, h: innerHeight };
      }));
    }
    await pg.evaluate(() => window.__golaco.replay.selo(null));
    await pg.setViewportSize({ width: 844, height: 390 });
    await pg.touchscreen.tap(300, 200);
    const tocou = await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: false }); return { ativo: g.replay.estado.ativo, toque: getComputedStyle(document.getElementById('toque')).display !== 'none', menu: g.estado().menuAberto }; });
    meta('D6 celular: um toque em qualquer lugar pula (e os botões de toque voltam)', JSON.stringify(tocou), 'ativo false, toque true, menu false', !tocou.ativo && tocou.toque && !tocou.menu);
  } finally { await P.fechar(); }
} catch (e) { meta('D5–D6 execução (celular)', e.message.split('\n')[0], 'sem exceção', false); }
// ------------------------------------------------------------------------------------------------ F (sem replay)
// a mesma partida com o replay desligado: os 120 quadros ao vivo antes do apito (chamadas, triângulos, CPU), o apito sem
// replay nem selo (a linha parada 2,2 s, como antes) e o hash no tick apito + 600
if (IMP && apitoP1 != null) try {
  const P = await pagina(raiz, `?q=baixa&hora=dia&demo=1&replay=0&semente=${IMP.semente}`);
  try {
    const sem = await P.pagina.evaluate(apito => {
      const g = window.__golaco, m = g.mundo;
      let n = 0;
      while (m.tick < apito - 120 && n < 30000) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; }
      g.medirQuadro({ zerar: true });
      let cham = 0, tri = 0;
      while (m.tick < apito && n < 30000) { g.relogio.avancar(1000 / 60, { desenhar: true }); const e = g.estado(); cham = Math.max(cham, e.desenhoChamadas); tri = Math.max(tri, e.desenhoTriangulos); n++; }
      const cpu = g.medirQuadro({ zerar: true }).cpu.media;
      const ev = m.eventos.find(e => e.tipo === 'impedimento') ?? null;
      let replay = 0, selo = 0, lance = 0;
      for (let i = 0; i < 600; i++) {
        if (g.replay.estado.ativo) replay++;
        if (!document.getElementById('terco').hidden) selo++;
        if (g.linhaImpedimento.lance && g.linhaImpedimento.visivel) lance++;
        g.relogio.avancar(1000 / 60, { desenhar: false });
      }
      return { cham, tri, cpu, ev: !!ev, tick: m.tick, replay, selo, lance, hash: m.tick === apito + 600 ? g.hash() : null };
    }, apitoP1);
    hashImped.sem = sem.hash;
    const ana = analise[0];
    meta('F11 replay desligado: no impedimento, nenhum quadro de replay, nenhum selo e a linha parada ~2,2 s', `impedimento no apito ${sem.ev}; ${sem.replay} quadros de replay, ${sem.selo} com selo, linha do lance em ${sem.lance} quadros (${f2(sem.lance / 60)} s)`, '0, 0, 2,2 s ± 2 quadros',
      sem.ev && sem.replay === 0 && sem.selo === 0 && Math.abs(sem.lance - 132) <= 2);
    meta('F6 hash no tick apito + 600: com a cena × sem replay', `${hashImped.com} / ${hashImped.sem}`, 'iguais', hashImped.com != null && hashImped.com === hashImped.sem);
    if (ana && !ana.semRoteiro) {
      meta('F8 chamadas e triângulos no quadro final da análise ≤ o máximo ao vivo nos 120 quadros antes do apito (+1 chamada)', `análise ${ana.cham} chamadas, ${(ana.tri / 1000).toFixed(1)} mil triângulos (${ana.nf} quadros) × ao vivo ${sem.cham} chamadas, ${(sem.tri / 1000).toFixed(1)} mil`, `≤ ${sem.cham + 1}; ≤ ${(sem.tri / 1000).toFixed(1)} mil`,
        ana.nf > 0 && ana.cham <= sem.cham + 1 && ana.tri <= sem.tri);
      meta('F9 CPU do quadro da análise (sem o desenho) ≤ o quadro ao vivo', `${ana.cpu.toFixed(3)} ms (${ana.quadros} quadros) × ${sem.cpu.toFixed(3)} ms`, 'análise ≤ ao vivo', ana.quadros > 0 && ana.cpu <= sem.cpu);
    } else meta('F8/F9 a análise de novo (saotDeTeste)', 'sem roteiro', 'roteiro', false);
  } finally { await P.fechar(); }
} catch (e) { meta('F6–F11 execução (sem replay)', e.message.split('\n')[0], 'sem exceção', false); }
{
  // F2: as caixas não se tocam (2 px de folga)
  const toca = (a, b) => !!a && !!b && a.x0 < b.x1 + 2 && b.x0 < a.x1 + 2 && a.y0 < b.y1 + 2 && b.y0 < a.y1 + 2;
  const linhas = caixasSelo.filter(c => c && c.caixas).map(c => {
    const k = c.caixas, pares = [['placar', k.placar], ['marca', k.marca], ['pular', k.pular]].filter(([, b]) => b).map(([n, b]) => [n, toca(k.selo, b)]);
    return { tela: `${c.w}×${c.h}`, selo: !!k.selo, dentro: !!k.selo && k.selo.x0 >= 0 && k.selo.y0 >= 0 && k.selo.x1 <= c.w && k.selo.y1 <= c.h, encosta: pares.filter(([, t]) => t).map(([n]) => n), com: pares.map(([n]) => n) };
  });
  meta('F2 o selo não encosta no placar, na marca REPLAY nem no "Pular" (568×320, 667×375, 844×390, 1280×720)', linhas.map(l => `${l.tela}: ${l.selo ? (l.encosta.length ? 'encosta em ' + l.encosta.join('+') : 'livre de ' + l.com.join('+')) : 'sem selo'}${l.dentro ? '' : ' (fora da tela)'}`).join('; ') || '-',
    '4 telas, nada encosta', linhas.length >= 4 && linhas.every(l => l.selo && l.dentro && l.encosta.length === 0) && ['568×320', '667×375', '844×390', '1280×720'].every(t => linhas.some(l => l.tela === t)));
}
meta('A10 o selo nunca fora do quadro final da análise (todos os replays: gol roteirizado, gols naturais, impedimento)', seloForaDoFinal.length ? seloForaDoFinal.join(', ') : '0 quadros', '0', seloForaDoFinal.length === 0);
meta('E4 console sem erros', errosTodos.length ? errosTodos.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', errosTodos.length === 0);

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.info ? 'INFO    ' : r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-replay: PASSOU' : '\nteste-replay: REPROVOU');
process.exit(ok ? 0 : 1);
