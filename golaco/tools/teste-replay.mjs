// Replay no navegador (Chromium): pedidos do dono de 11/10 — "o replay não funciona" e "quando o jogo parar por
// impedimento, no replay vai mostrar a linha".
//   A) gol ROTEIRIZADO (tools/lib/gol-roteirizado.mjs): o replay começa SOZINHO na saída de bola (nunca antes: a
//      câmera do gol fica no pós-gol), mostra o chute e a bola entrando (ticks do chute até depois do gol), com a
//      simulação parada, em ≥ 2 planos (TV 1× e atrás do gol em câmera lenta), 3–12 s; só a marca "REPLAY" no canto
//      (minimapa, menu e avisos somem; nenhum texto de lance); no fim a câmera de jogo volta e a partida segue; o apito
//      da saída toca DEPOIS do replay;
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
//      sem erros.
// Na versão sem replay reprova (A1, C2, D1: não existe replay).
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
      let hud = null;
      while (n < 3000) {
        g.relogio.avancar(1000 / 60, { desenhar: false }); n++;
        const rp = temReplay ? g.replay.estado : null;
        if (saidaTick == null && m.partida.estado !== 'gol' && m.tick > golTick + 10) saidaTick = m.tick;
        if (rp?.ativo) {
          amostras.push({ tick: m.tick, rt: rp.tick, cam: rp.cam, vel: rp.vel, plano: rp.plano, tipo: rp.tipo, bx: g.render.bola.x, linha: !!g.linhaImpedimento?.visivel });
          if (!hud && amostras.length === 30) {
            const textos = [...document.querySelectorAll('#hud *, #replay *')].filter(e => e.children.length === 0 && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && e.textContent.trim()).map(e => e.textContent.trim());
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
  meta('A4 planos do replay', planos.join(', ') || '-', 'tv@1 e atras@0.5', planos.includes('tv@1') && planos.includes('atras@0.5'));
  meta('A5 duração (relógio real)', `${f2(n / 60)} s`, '3–12 s', n / 60 >= 3 && n / 60 <= 12);
  const h = comR.hud;
  meta('A6 tela do replay: só a marca "REPLAY" (sem texto de lance), sem minimapa, menu e avisos', h ? `marca ${h.marca}, placar ${h.placar}, minimapa ${h.minimapa}, menu ${h.menu}, aviso ${h.aviso}, "Pular" (PC) ${h.pular}; textos: ${JSON.stringify(h.textos)}` : '-',
    'marca e placar sim; o resto não; textos só do placar e "REPLAY"',
    h && h.marca && h.placar && !h.minimapa && !h.menu && !h.aviso && !h.pular && h.textos.every(t => /^(REPLAY|[A-ZÇ]{2,4}|\d+|\d+'|\d+\+\d+'|[12]º T( \+\d+)?)$/.test(t)));
  meta('A7 depois do replay a câmera de jogo volta e a partida segue', comR.depois ? `câmera ${comR.depois.plano}, marca ${comR.depois.marca}; tick ${comR.depois.tick} → ${comR.tickFim}` : '-', 'jogo, sem marca, o tick anda',
    comR.depois && comR.depois.plano === 'jogo' && !comR.depois.marca && comR.tickFim > comR.depois.tick);
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
        const ticks = [], cams = new Set(), xs = []; let q = 0, linha = 0; const simTick = m.tick; let andou = false;
        const tipo = rp.tipo, golaco = rp.golaco;
        while (g.replay.estado.ativo && q < 2000) {
          const e = g.replay.estado; ticks.push(e.tick); cams.add(e.cam + '@' + e.vel); xs.push(g.render.bola.x);
          if (g.linhaImpedimento.visivel) linha++;
          g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
          if (m.tick !== simTick && g.replay.estado.ativo) andou = true;
        }
        return { tipo, tick: simTick, s: +(q / 60).toFixed(2), de: Math.min(...ticks), ate: Math.max(...ticks), cams: [...cams], linha, andou, golaco, cruzou: xs.some(x => Math.abs(x) > 52.61) };
      });
      const maxGol = 14.2; // REPLAY.gol.maximoGolaco (+ 0,2 s dos quadros de borda)
      // o lance foi achado em Node com a entrada da página (comoPagina): sem ele aqui, a página divergiu do Node
      if (gn.semGol) meta('C0 replay de um gol NATURAL (IA × IA)', `semente ${GOL.semente}: nenhum replay de gol em ${gn.n} quadros na página (o Node achou o gol no tick ${GOL.golTick})`, 'o gol do Node também na página', false);
      else meta('C0 replay de um gol NATURAL (IA × IA)', `semente ${GOL.semente}, saída no tick ${gn.tick}: ${gn.s} s, ticks ${gn.de.toFixed(0)}–${gn.ate.toFixed(0)}, ${gn.cams.join(' ')}${gn.golaco ? ', golaço' : ''}; bola entra ${gn.cruzou}; linha ${gn.linha}; sim andou ${gn.andou}`,
        `6–${gn.golaco ? f2(maxGol) : 12} s, bola entra, sim parada, sem linha`, gn.s >= 6 && gn.s <= (gn.golaco ? maxGol : 12) && gn.cruzou && !gn.andou && gn.linha === 0);
    } finally { await P.fechar(); }
  }
} catch (e) { meta('C0 execução (gol natural)', e.message, 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ C + D + E
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
          const ticks = [], cams = new Set(); let q = 0, linha = 0; const simTick = m.tick; let andou = false; const golaco = rp.golaco;
          while (g.replay.estado.ativo && q < 2000) {
            const e = g.replay.estado; ticks.push(e.tick); cams.add(e.cam + '@' + e.vel);
            if (g.linhaImpedimento.visivel) linha++;
            g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
            if (m.tick !== simTick && g.replay.estado.ativo) andou = true;
          }
          golsNat.push({ tick: simTick, s: +(q / 60).toFixed(2), de: Math.min(...ticks), ate: Math.max(...ticks), cams: [...cams], linha, andou, golaco });
          continue;
        }
        if (m.eventos.some(e => e.tipo === 'impedimento')) break;
        if (rp?.ativo) continue;
        if (m.partida.estado === 'jogo') { vivo++; if (g.linhaImpedimento.visivel) vivoLinha++; }
      }
      const ev = m.eventos.find(e => e.tipo === 'impedimento') ?? null;
      return { n, vivo, vivoLinha, tick: m.tick, rp: g.replay?.estado ?? { tipo: null, ativo: false }, ev, golsNat };
    });
    const maxGol = 14.2;
    for (const gn of r.golsNat) meta('C0 replay de um gol NATURAL (IA × IA) no caminho', `tick ${gn.tick}: ${gn.s} s, ticks ${gn.de.toFixed(0)}–${gn.ate.toFixed(0)}, ${gn.cams.join(' ')}${gn.golaco ? ', golaço' : ''}; linha ${gn.linha}; sim andou ${gn.andou}`, `6–${gn.golaco ? f2(maxGol) : 12} s, sim parada, sem linha`,
      gn.s >= 6 && gn.s <= (gn.golaco ? maxGol : 12) && !gn.andou && gn.linha === 0);
    meta('C1 [informativo] linha de impedimento AO VIVO (bola rolando, fora do replay)', `${r.vivoLinha} de ${r.vivo} quadros (${f2(100 * r.vivoLinha / Math.max(1, r.vivo))}%)`, '0 quando a frente "tela limpa" entrar', true, true);
    meta('C2 no apito do impedimento o replay começa (tipo impedimento)', `${r.rp.tipo ?? 'nenhum'} no tick ${r.tick}${r.ev ? ` (foto ${r.ev.tickFoto}, linha x ${f2(r.ev.linhaX)})` : ''}`, 'impedimento', !!r.ev && r.rp.ativo && r.rp.tipo === 'impedimento');
    if (r.ev && r.rp.tipo === 'impedimento') {
      const qs = await pg.evaluate(() => {
        const g = window.__golaco, out = [];
        for (let i = 0; i < 1200; i++) {
          const rp = g.replay.estado;
          if (!rp.ativo) break;
          out.push({ rt: rp.tick, cong: rp.congelado, linha: g.linhaImpedimento, cam: { ...g.render.camera }, simTick: g.mundo.tick });
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
      const xOk = com.every(q => Math.abs(q.linha.x - lx) < 0.01), camOk = com.every(q => Math.abs(q.cam.x - lx) < 0.5);
      meta('C4 a linha no x do lance e a câmera alinhada a ela', `linha x ${com[0] ? f2(com[0].linha.x) : '-'} × lance ${f2(lx)}; câmera x ${com[0] ? f2(com[0].cam.x) : '-'}`, '|Δ| < 0,01; câmera ±0,5 m', com.length > 0 && xOk && camOk);
      const cong = qs.filter(q => q.cong).length;
      meta('C5 congela no quadro do passe', `${f2(cong / 60)} s (sim parada: ${qs.every(q => q.simTick === qs[0].simTick)})`, '≥ 1,2 s, sim parada', cong / 60 >= 1.2 && qs.every(q => q.simTick === qs[0].simTick));
      const depois = await pg.evaluate(() => { const g = window.__golaco, t0 = g.mundo.tick; let linha = 0; for (let i = 0; i < 60; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.linhaImpedimento.visivel) linha++; } return { linha, rp: g.replay.estado.ativo, parada: g.mundo.parada?.tipo ?? null, andou: g.mundo.tick - t0 }; });
      meta('C6 depois do replay: a linha não fica parada no jogo e o tiro livre segue', `linha em ${depois.linha} de 60 quadros, replay ${depois.rp}, parada ${depois.parada}, a sim andou ${depois.andou} passos`, 'linha 0, replay não, anda', depois.linha === 0 && !depois.rp && depois.andou > 0);
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
    await pg.touchscreen.tap(300, 200);
    const tocou = await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: false }); return { ativo: g.replay.estado.ativo, toque: getComputedStyle(document.getElementById('toque')).display !== 'none', menu: g.estado().menuAberto }; });
    meta('D6 celular: um toque em qualquer lugar pula (e os botões de toque voltam)', JSON.stringify(tocou), 'ativo false, toque true, menu false', !tocou.ativo && tocou.toque && !tocou.menu);
  } finally { await P.fechar(); }
} catch (e) { meta('D5–D6 execução (celular)', e.message.split('\n')[0], 'sem exceção', false); }
meta('E4 console sem erros', errosTodos.length ? errosTodos.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', errosTodos.length === 0);

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.info ? 'INFO    ' : r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-replay: PASSOU' : '\nteste-replay: REPROVOU');
process.exit(ok ? 0 : 1);
