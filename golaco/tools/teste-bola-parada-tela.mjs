// teste-bola-parada-tela: a câmera atrás do cobrador e a mira da cobrança mirada no navegador (pedido do dono, 16/10, com a
// imagem do EA FC; render/plano-bola-parada.js, render/bola-parada.js, js/mira.js, js/mira-linha.js; contratos "Cobrança mirada"
// e "Câmera da bola parada" no CONTRATOS.md). Relógio manual (o laço da página, quadro a quadro). Em PC 1280×720, celular 844×390
// e 568×320 com o entalhe (toque; a tela em que o painel antigo da mira encostava no CORRER):
//  1  Nos 4 tipos (escanteio, tiro livre, tiro de meta, pênalti) do humano e no pênalti CONTRA: a câmera vai para trás do
//     cobrador (a lente do lado de trás da bola, a 2–8 m dela, a 1,8–4 m de altura; no escanteio, alta — item 66,
//     render/plano-bola-parada.js CAMERA_ESCANTEIO —: a 8–18 m dela e a 5–10 m de altura), o cobrador inteiro no quadro e
//     na metade de baixo (a cabeça abaixo de 40% da altura), o alvo (a área / o gol) no quadro e fora da caixa do cobrador.
//  2  Nada sólido na lente: fora de placas, gol, arquibancada (estadio-forma.js solidoEm, folga 0,3 m) e a ≥ 0,8 m de
//     todo jogador.
//  3  A mira: visível no escanteio, no tiro livre e no tiro de meta (não no pênalti), mexe ≥ 150 px do quadro (com × sem
//     ela) e custa ≤ +1 chamada de desenho; sem painel e sem texto na tela (item 65: o rótulo ALTA/CHUTE saiu) e o minimapa
//     escondido (html.mira-visivel); some no chute.
//  4  A volta para a TV no chute: a mistura cai até 0 em ≤ 1,3 s, sem salto (nenhum quadro anda mais que 2,5 m nem 3× a
//     mediana dos passos da câmera).
//  5  Controles: no PC (teclado, a entrada da página) D gira a mira para a direita da tela e X/Z põem curva (2 apertos = 0,5)
//     e o arco verde junto da bola mostra 56° no MESMO quadro em que o mundo muda; no celular (item 65) a curva é o ARRASTO no
//     CHUTE e no LANÇAMENTO, com toque de verdade (CDP): +40 px = 0,75, de volta = 0, só o lado conta (80 px na vertical = 0),
//     −60 px no LANÇAMENTO = −1, a borda da tela repete (844×390: o toque a 20 px dela), soltar bate com a curva mostrada (nada
//     muda depois); os chevrons só na cobrança mirada (curva-arrasto) e nenhum botão CURVA; tiro de meta e pênalti sem arrasto;
//     o CHUTE apertado na montagem da falta (antes da mira e dos chevrons) e arrastado +40 px depois deles = 0,75.
//  6  Nenhum erro no console.
//  7  (item 65) A mira nova, medida pelos pixels (q=media; celular dpr 2 com o entalhe; dia e noite; com × sem a mira no
//     MESMO quadro) — L1 largura da linha pela máscara (tiras de 6 px ao longo da parte cheia: área ÷ comprimento) p95 ≤ 4,8 px
//     no celular e ≤ 7,5 px no PC; L2 constante (p95/p5 ≤ 1,35 por tipo); L4 a área da mira ≤ 75% da de antes no escanteio e
//     no tiro de meta e ≤ 110% na falta no 844×390 e no PC (as de antes: o mapa do item 65, 2a13ca14, a mesma régua; em
//     568×320, informativo, ≤ 100%); L5 o miolo (o pixel mais claro da tira) × o mesmo ponto sem a mira, sobre o gramado, ≥ 3:1
//     em ≥ 95% das tiras, e L5b em qualquer fundo o miolo ou o contorno ≥ 3:1; L6 nenhum pixel amarelo nem azul que a mira tenha
//     posto; A2 o anel do alvo no escanteio ≥ 20 × 6 px e ≥ 95% fora do HUD; C1 com curva 0 nenhum pixel verde junto da bola,
//     e o arco cresce ≥ 4 px (celular) / 8 px (PC) por degrau; ≤ +1 chamada, ≤ +500 triângulos e nenhum programa WebGL novo
//     quando a mira aparece pela 1ª vez (compilado na carga do módulo: a 1ª contagem com a mira nunca desenhada, a 2ª com ela
//     acesa).
//  0  O módulo (render/bola-parada.js) não está no download inicial: carregado sob demanda.
//   node tools/teste-bola-parada-tela.mjs [--prints <pasta>] [--raiz <pasta do jogo>] [--so 7]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PRINTS = args.includes('--prints') ? path.resolve(arg('--prints')) : null;
const RAIZ_JOGO = path.resolve(arg('--raiz', RAIZ));
const SO = arg('--so', null);
const res = [];
const meta = (nome, medido, ok) => { res.push({ nome, medido, ok: !!ok }); console.log(`${ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome} — ${medido}`); };
const srv = await servidor(0, RAIZ_JOGO);
const f1 = v => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(1).replace('.', ','));
const f2 = v => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2).replace('.', ','));
const TELAS = [
  { nome: 'PC 1280×720', largura: 1280, altura: 720, toque: false, q: 'baixa' },
  { nome: 'celular 844×390', largura: 844, altura: 390, toque: true, q: 'baixa' },
  // (com o entalhe: em 568×320 o painel antigo da mira encostava no CORRER, −11 px)
  { nome: 'celular 568×320 com entalhe', largura: 568, altura: 320, toque: true, q: 'baixa', entalhe: true },
];
const TIPOS = ['escanteio', 'falta', 'meta', 'penalti', 'contra'];
const AVANCAR = k => { const g = window.__golaco; for (let i = 0; i < k; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.mundo.parada?.mira?.curva ?? null; };

/** Monta a bola parada `tipo` (os ganchos de teste da página) e anda até a câmera estar atrás do cobrador. */
async function montar(pg, tipo) {
  return pg.evaluate(tipo => {
    const g = window.__golaco;
    g.forcarEntrada(null);
    if (tipo === 'escanteio') g.bolaParadaDeTeste('escanteio', { lado: 'ca' });
    else if (tipo === 'meta') g.bolaParadaDeTeste('tiroDeMeta');
    else if (tipo === 'falta') g.faltaDeTeste({ u: 22, w: 4 });
    else if (tipo === 'penalti') g.faltaDeTeste({ area: true });
    else g.faltaDeTeste({ doMeu: true, area: true });
    let e = null;
    for (let i = 0; i < 600; i++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      e = g.bolaParada.estado;
      const pronta = g.mundo.parada && g.mundo.tick >= g.mundo.parada.pronta;
      if (e.ativa && e.mistura >= 1 && pronta) break;
    }
    for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 11 });
    return g.bolaParada.estado;
  }, tipo);
}
/** Termina a cobrança (LANÇAMENTO segurado e solto) e deixa o jogo andar (a próxima montagem começa com a bola rolando). */
async function terminar(pg) {
  await pg.evaluate(() => { const g = window.__golaco; g.forcarEntrada({ x: 0, z: 0, botoes: 16 }); for (let i = 0; i < 20; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.forcarEntrada(null); for (let i = 0; i < 200; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
}
/** Medidas do quadro: lente, cobrador, alvo, sólidos e jogadores perto (na página). */
async function medir(pg) {
  return pg.evaluate(async () => {
    const g = window.__golaco, e = g.bolaParada.estado;
    const { solidoEm } = await import('./js/estadio-forma.js');
    const W = window.innerWidth, H = window.innerHeight, c = e.camera;
    const m = g.mundo, pr = m.parada;
    const cob = m.jogadores.find(o => o.id === pr.cobrador);
    const cab = g.naTela(cob.x, 1.85, cob.z), pes = g.naTela(cob.x, 0.03, cob.z);
    const lados = [-0.35, 0.35].map(d => g.naTela(cob.x + d * Math.cos(e.yaw + Math.PI / 2), 1, cob.z + d * Math.sin(e.yaw + Math.PI / 2)));
    const ty = pr.tipo === 'penalti' || (pr.tipo === 'tiroLivre' && pr.direto) ? 1.0 : 0;
    const alvo = g.naTela(e.alvo.x, ty, e.alvo.z);
    const bx = { l: Math.min(...lados.map(p => p.x), cab.x, pes.x) - 4, r: Math.max(...lados.map(p => p.x), cab.x, pes.x) + 4, t: cab.y - 4, b: pes.y + 4 };
    let perto = Infinity;
    for (const o of m.jogadores) perto = Math.min(perto, Math.hypot(o.x - c.x, o.z - c.z) + Math.max(0, c.y - 1.9));
    const dxB = c.x - e.bola.x, dzB = c.z - e.bola.z, dxA = e.alvo.x - e.bola.x, dzA = e.alvo.z - e.bola.z;
    return {
      W, H, tipo: pr.tipo, atras: (dxB * dxA + dzB * dzA) < 0, dist: Math.hypot(dxB, dzB), altura: c.y,
      cab, pes, alvo, caixa: bx, solido: solidoEm(c.x, c.y, c.z, 0.3, false), perto,
      linha: e.linha, classe: e.classe,
    };
  });
}
/**
 * No navegador: o que a cobrança mostra no HUD — o painel antigo, texto visível no #hud fora do placar, do nome e da dica de
 * teclas do PC (#dica: aparece no começo da partida e some sozinha; não é da cobrança — teste-hud-minimo H5), o minimapa.
 */
const HUD_COBRANCA = () => {
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const txt = [];
  for (const e of document.querySelectorAll('#hud *')) {
    if (!vis(e) || e.closest('.placar') || e.closest('#nome-condutor') || e.closest('#dica')) continue;
    for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) txt.push(n.textContent.trim());
  }
  const mm = document.querySelector('.minimapa');
  return { painel: !!document.getElementById('mira'), texto: [...new Set(txt)], minimapa: vis(mm), miraVisivel: document.documentElement.classList.contains('mira-visivel') };
};

if (!SO || SO.split(',').some(x => x !== '7')) for (const tela of TELAS) {
  const s = await abrir({ largura: tela.largura, altura: tela.altura, toque: tela.toque });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?semente=5&q=${tela.q}&replay=0&comemoracao=0${tela.entalhe ? '&entalhe=1' : ''}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
  // o módulo da bola parada é carregado sob demanda (fora do download inicial): antes, nada dele na página
  const antes = await pg.evaluate(() => ({ mod: performance.getEntriesByType('resource').some(r => /bola-parada\.js/.test(r.name)), painel: !!document.getElementById('mira') }));
  await pg.evaluate(() => window.__golaco.bolaParada.carregar());
  await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 300; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  meta(`0 ${tela.nome}: o módulo da bola parada fica fora do download inicial (sob demanda)`, `antes: módulo ${antes.mod ? 'baixado' : 'não'}, painel ${antes.painel ? 'existe' : 'não'}`, !antes.mod && !antes.painel);
  const q1 = [], q2 = [], q3 = [];
  for (const tipo of TIPOS) {
    const e = await montar(pg, tipo);
    if (!e.ativa) { q1.push(`${tipo}: câmera não veio`); continue; }
    const md = await medir(pg);
    const dentro = (p, f = 0) => !p.atras && p.x >= f * md.W && p.x <= (1 - f) * md.W && p.y >= f * md.H && p.y <= (1 - f) * md.H;
    // (a régua da lente por tipo: o escanteio alto do item 66; os outros como antes)
    const R = tipo === 'escanteio' ? { d: [8, 18], h: [5, 10] } : { d: [2, 8], h: [1.8, 4] };
    const okCam = md.atras && md.dist >= R.d[0] && md.dist <= R.d[1] && md.altura >= R.h[0] && md.altura <= R.h[1];
    const okCob = dentro(md.cab) && dentro(md.pes) && md.cab.y >= 0.4 * md.H && md.pes.y <= 0.985 * md.H;
    const okAlvo = dentro(md.alvo, 0.03) && !(md.alvo.x > md.caixa.l && md.alvo.x < md.caixa.r && md.alvo.y > md.caixa.t && md.alvo.y < md.caixa.b);
    q1.push(`${tipo}: ${okCam && okCob && okAlvo ? 'ok' : `câmera ${okCam ? 'ok' : `atrás ${md.atras} ${f1(md.dist)} m alt ${f1(md.altura)}`} · cobrador ${okCob ? 'ok' : `cabeça ${f1(md.cab.y / md.H * 100)}% pés ${f1(md.pes.y / md.H * 100)}%`} · alvo ${okAlvo ? 'ok' : JSON.stringify(md.alvo)}`}`);
    q2.push(`${tipo}: ${md.solido ?? 'livre'}, jogador a ${f1(md.perto)} m`);
    if (!(okCam && okCob && okAlvo)) q1.ok = false;
    if (md.solido || md.perto < 0.8) q2.ok = false;
    // 3) a mira (não no pênalti) e o HUD da cobrança
    const comLinha = tipo !== 'penalti' && tipo !== 'contra';
    const px = await pg.evaluate(HC => {
      const g = window.__golaco, cv = document.querySelector('canvas');
      const off = document.createElement('canvas'); off.width = Math.round(cv.width / 2); off.height = Math.round(cv.height / 2);
      const cx = off.getContext('2d', { willReadFrequently: true });
      const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
      g.bolaParada.linha(true); g.relogio.avancar(1000 / 60); const a = ler(); const ca = g.estado().desenhoChamadas;
      g.bolaParada.linha(false); g.relogio.avancar(1000 / 60); const b = ler(); const cb = g.estado().desenhoChamadas;
      g.bolaParada.linha(true); g.relogio.avancar(1000 / 60);
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 18) n++;
      return { n: n * 4, ca, cb, vis: g.bolaParada.estado.linha.visivel, hud: eval(HC)() };
    }, HUD_COBRANCA.toString());
    // prints (a linha acende em 0,15 s depois de religada: 20 quadros)
    if (PRINTS && (tela.largura === 844 || tela.largura === 1280) && (tipo === 'escanteio' || tipo === 'falta')) {
      await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 20; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 19 }); });
      await pg.screenshot({ path: path.join(PRINTS, `bola-parada-${tipo}-${tela.largura}x${tela.altura}.png`) });
    }
    // chute (LANÇAMENTO; no pênalti o CHUTE; no contra o goleiro espera) e a volta para a TV
    const volta = await pg.evaluate(tipo => {
      const g = window.__golaco, B = tipo === 'penalti' ? 32 : 16;
      const pos = [], mist = [];
      if (tipo !== 'contra') { g.forcarEntrada({ x: 0, z: 0, botoes: B }); for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.forcarEntrada({ x: 0, z: 0, botoes: 0 }); }
      let chute = -1, linhaDepois = null, cortou = false;
      for (let i = 0; i < 600; i++) {
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const e = g.bolaParada.estado;
        if (chute < 0 && (!e.ativa)) { chute = i; linhaDepois = e.linha.visivel; }
        // (o gol corta para a câmera do gol: um corte de propósito — a medida da volta para ali)
        if (chute >= 0 && g.estadio.planoCamera !== 'jogo') { cortou = true; break; }
        if (chute >= 0) { pos.push([e.camera.x, e.camera.y, e.camera.z]); mist.push(e.mistura); if (e.mistura === 0 && pos.length > 5) break; }
      }
      g.forcarEntrada(null);
      for (let i = 0; i < 200; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      return { pos, mist, chute, linhaDepois, cortou };
    }, tipo);
    const passos = volta.pos.slice(1).map((p, i) => Math.hypot(p[0] - volta.pos[i][0], p[1] - volta.pos[i][1], p[2] - volta.pos[i][2]));
    const med = [...passos].sort((a, b) => a - b)[Math.floor(passos.length / 2)] ?? 0;
    const maxP = Math.max(0, ...passos);
    const tVolta = volta.mist.findIndex(x => x === 0) / 60;
    q3.push({ tipo, comLinha, px, volta: { t: tVolta, maxP, med, chute: volta.chute, linhaDepois: volta.linhaDepois, cortou: volta.cortou, passos: passos.length } });
  }
  meta(`1 ${tela.nome}: câmera atrás do cobrador, o cobrador inteiro na metade de baixo, o alvo no quadro e livre dele`, q1.join(' · '), q1.ok !== false && q1.length === TIPOS.length);
  meta(`2 ${tela.nome}: nada sólido na lente e nenhum jogador a < 0,8 m`, q2.join(' · '), q2.ok !== false && q2.length === TIPOS.length);
  // (sem o painel e sem texto: o rótulo ALTA/CHUTE e as teclas Z/X saíram com o item 65; o minimapa sai com a mira)
  const okHud = h => !h.painel && h.texto.length === 0 && !h.minimapa && h.miraVisivel;
  const l = q3.map(x => `${x.tipo}: ${x.comLinha ? `${x.px.vis ? 'visível' : 'não'} ${x.px.n} px +${x.px.ca - x.px.cb} chamada; painel ${x.px.hud.painel ? 'sim' : 'não'}, texto ${x.px.hud.texto.length ? JSON.stringify(x.px.hud.texto) : 'nenhum'}, minimapa ${x.px.hud.minimapa ? 'visível' : 'escondido'}` : (x.px.vis ? 'linha no pênalti!' : 'sem linha')}; some no chute ${x.volta.linhaDepois === false ? 'sim' : 'não'}`);
  meta(`3 ${tela.nome}: a mira (visível ≥ 150 px, ≤ +1 chamada; sem painel nem texto, o minimapa escondido; nada no pênalti) e some no chute`, l.join(' · '),
    q3.every(x => (x.comLinha ? x.px.vis && x.px.n >= 150 && x.px.ca - x.px.cb <= 1 && okHud(x.px.hud) : !x.px.vis) && x.volta.linhaDepois === false));
  // (a cobrança que vira gol corta para a câmera do gol antes do fim da volta: conta o que andou até o corte, ≥ 3 sem gol)
  const semCorte = q3.filter(x => !x.volta.cortou);
  meta(`4 ${tela.nome}: a volta para a TV no chute sem salto`, q3.map(x => `${x.tipo}: ${x.volta.cortou ? `gol (corte) depois de ${x.volta.passos} quadros, ` : `${f1(x.volta.t)} s, `}maior passo ${f1(x.volta.maxP)} m (mediana ${f1(x.volta.med)})`).join(' · '),
    semCorte.length >= 3 && q3.every(x => (x.volta.cortou || (x.volta.t > 0 && x.volta.t <= 1.3)) && x.volta.maxP <= 2.5 && x.volta.maxP <= Math.max(3 * x.volta.med, 0.3)));
  // 5) controles
  if (!tela.toque) {
    await montar(pg, 'escanteio');
    const a0 = await pg.evaluate(() => window.__golaco.bolaParada.estado.mira);
    await pg.keyboard.down('KeyD');
    await pg.evaluate(AVANCAR, 30);
    await pg.keyboard.up('KeyD');
    // X duas vezes; o arco no MESMO quadro em que o mundo muda (quadro a quadro, desenhando)
    const lat = [];
    for (let k = 0; k < 2; k++) {
      await pg.keyboard.down('KeyX');
      lat.push(await pg.evaluate(() => {
        const g = window.__golaco, c0 = g.mundo.parada.mira.curva;
        for (let i = 1; i <= 6; i++) {
          g.relogio.avancar(1000 / 60, { desenhar: true });
          const c = g.mundo.parada.mira.curva, a = g.bolaParada.estado.linha.arco;
          if (c !== c0) return { q: i, mundo: c, arco: a ? a.curva : 0 };
        }
        return { q: -1 };
      }));
      await pg.keyboard.up('KeyX'); await pg.evaluate(AVANCAR, 3);
    }
    const r = await pg.evaluate(HC => {
      const g = window.__golaco, e = g.bolaParada.estado;
      g.relogio.avancar(1000 / 60, { desenhar: true });
      return { mira: e.mira, arco: g.bolaParada.estado.linha.arco, hud: eval(HC)() };
    }, HUD_COBRANCA.toString());
    const giro = r.mira.ang - a0.ang;
    meta(`5 ${tela.nome}: D gira a mira para a direita da tela, X põe curva (2 apertos = 0,5) e o arco verde junto da bola mostra 56° no quadro em que o mundo muda; sem painel nem texto`,
      `giro ${f1(giro * 180 / Math.PI)}° · curva ${r.mira.curva} · arco ${r.arco ? `${f1(r.arco.graus)}° à ${r.arco.lado} (raio ${f1(r.arco.raioPx)} px)` : 'nenhum'} · latência ${lat.map(x => `${x.q} quadro (mundo ${x.mundo}, arco ${x.arco})`).join(', ')} · painel ${r.hud.painel ? 'sim' : 'não'}, texto ${r.hud.texto.length}`,
      giro > 0.25 && giro < 0.45 && r.mira.curva === 0.5 && r.arco && Math.abs(r.arco.graus - 56) < 1e-6 && r.arco.lado === 'direita'
      && lat.length === 2 && lat.every(x => x.q === 1 && x.arco === x.mundo) && !r.hud.painel && r.hud.texto.length === 0);
    await terminar(pg);
  } else {
    // o toque de verdade (CDP Input.dispatchTouchEvent: o Chromium gera pointerdown/move/up com pointerType touch)
    const cdp = await s.contexto.newCDPSession(pg);
    const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const centro = id => pg.evaluate(id => { const b = document.getElementById(id); return { x: b.offsetLeft + b.offsetWidth / 2, y: b.offsetTop + b.offsetHeight / 2, r: b.offsetWidth / 2 }; }, id);
    const chevrons = () => pg.evaluate(() => {
      const ch = id => { const b = document.getElementById(id), a = getComputedStyle(b, '::before'), d = getComputedStyle(b, '::after'); return a.content !== 'none' && a.display !== 'none' && d.content !== 'none' && getComputedStyle(b).display !== 'none'; };
      return { classe: document.getElementById('toque').classList.contains('curva-arrasto'), chute: ch('btn-chute'), lanc: ch('btn-lancamento'), curvas: document.querySelectorAll('[id^="btn-efeito"]').length };
    });
    const arrastar = async (x0, y0, x1, y1, passos = 4) => { for (let k = 1; k <= passos; k++) { await toque('touchMove', x0 + (x1 - x0) * k / passos, y0 + (y1 - y0) * k / passos); await pg.evaluate(AVANCAR, 1); } };
    const fora = await chevrons();
    const passos = [];
    // A) escanteio, o CHUTE: +40 px = 0,75; de volta = 0; 80 px na vertical = 0; +52 px = 1; soltar: a batida com a curva mostrada
    await montar(pg, 'escanteio');
    const na = await chevrons();
    const c = await centro('btn-chute');
    await toque('touchStart', c.x, c.y); await pg.evaluate(AVANCAR, 2);
    const ativo = await pg.evaluate(() => window.__golaco.bolaParada.arrasto);
    await arrastar(c.x, c.y, c.x + 40, c.y); const c40 = await pg.evaluate(AVANCAR, 8);
    await arrastar(c.x + 40, c.y, c.x, c.y); const c0 = await pg.evaluate(AVANCAR, 8);
    await arrastar(c.x, c.y, c.x, c.y - 80, 8); const cv = await pg.evaluate(AVANCAR, 8);
    await arrastar(c.x, c.y - 80, c.x + 52, c.y, 6); const c52 = await pg.evaluate(AVANCAR, 10);
    const mostrada = await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: true }); return { mundo: g.mundo.parada.mira.curva, arco: g.bolaParada.estado.linha.arco?.curva ?? 0 }; });
    await toque('touchEnd');
    const depois = await pg.evaluate(() => { const g = window.__golaco, v = []; for (let i = 0; i < 40 && g.mundo.parada && !g.mundo.parada.rolou; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); v.push(g.mundo.parada?.mira?.curva); } return { v: [...new Set(v.filter(x => x != null))], corrida: document.getElementById('toque').classList.contains('curva-arrasto') }; });
    passos.push(`CHUTE: ${ativo ? 'arrasto ligado' : 'SEM arrasto'}; +40 px ${c40} · de volta ${c0} · 80 px na vertical ${cv} · +52 px ${c52}; mostrada ${mostrada.mundo} (arco ${mostrada.arco}) → depois de soltar ${depois.v.join(', ')}${depois.corrida ? ' (chevrons na corrida!)' : ''}`);
    const okA = !!ativo && c40 === 0.75 && c0 === 0 && cv === 0 && c52 === 1 && mostrada.arco === mostrada.mundo && depois.v.length <= 1 && (depois.v[0] ?? mostrada.mundo) === mostrada.mundo && !depois.corrida;
    await pg.evaluate(AVANCAR, 240);
    // B) o LANÇAMENTO, −60 px = −1
    await montar(pg, 'escanteio');
    const l = await centro('btn-lancamento');
    await toque('touchStart', l.x, l.y); await pg.evaluate(AVANCAR, 2);
    await arrastar(l.x, l.y, l.x - 60, l.y, 6); const cl = await pg.evaluate(AVANCAR, 10);
    await toque('touchEnd'); await pg.evaluate(AVANCAR, 240);
    passos.push(`LANÇAMENTO −60 px ${cl}`);
    // C) a borda: o toque perto da borda direita, o dedo nela (≤ 8 px): o degrau repete a cada 0,15 s até +1
    await montar(pg, 'escanteio');
    const W = await pg.evaluate(() => innerWidth);
    const xb = Math.min(W - 20, c.x + c.r - 4);
    await toque('touchStart', xb, c.y); await pg.evaluate(AVANCAR, 2);
    await toque('touchMove', W - 3, c.y);
    const borda = await pg.evaluate(() => { const g = window.__golaco; for (let i = 1; i <= 60; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.mundo.parada.mira.curva === 1) return i / 60; } return null; });
    const nivel0 = Math.min(4, Math.floor((W - 3 - xb - 10) / 14) + 1);
    await toque('touchEnd'); await pg.evaluate(AVANCAR, 240);
    passos.push(`borda: toque a ${f1(W - xb)} px dela, +1 em ${borda == null ? '-' : f2(borda)} s (${4 - nivel0} degraus da borda)`);
    // (os degraus da borda a cada 0,15 s; os pulsos a 30 por s; + 3 quadros)
    const okBorda = borda != null && borda <= Math.max(0.15 * (4 - nivel0), 4 * 2 / 60) + 3 / 60;
    // D) tiro de meta e pênalti: sem arrasto, sem chevrons
    const semArrasto = [];
    for (const tp of ['meta', 'penalti']) {
      await montar(pg, tp);
      const ch = await chevrons();
      const b = await centro('btn-chute');
      await toque('touchStart', b.x, b.y); await pg.evaluate(AVANCAR, 2);
      await arrastar(b.x, b.y, b.x - 50, b.y);
      const r = await pg.evaluate(() => ({ arrasto: window.__golaco.bolaParada.arrasto, curva: window.__golaco.mundo.parada?.mira?.curva ?? null }));
      await toque('touchEnd'); await pg.evaluate(AVANCAR, 300);
      semArrasto.push(`${tp}: arrasto ${r.arrasto ? 'LIGADO' : 'não'}, chevrons ${ch.classe ? 'SIM' : 'não'}, curva ${r.curva ?? '-'}`);
      if (r.arrasto || ch.classe || (r.curva ?? 0) !== 0) semArrasto.ok = false;
    }
    // E) o CHUTE apertado na MONTAGEM da falta e arrastado depois que os chevrons aparecem: o arrasto começa do ponto onde o dedo
    // está quando a cobrança liga (entrada.js definirCurva). Antes ele não começava com o dedo já no botão: a curva ficava em 0
    // com os chevrons no botão segurado, e soltar batia. A falta sofrida com a bola do meu time (a fase visível 'ataque': aqui, a
    // 2ª falta seguida — sem a posse antes, os botões da montagem são os da defesa até o cobrador pegar a bola, ~1 s): o dedo
    // no CHUTE no 2º quadro, antes da mira e dos chevrons (~1 s; com o dedo no botão a fase visível não troca)
    await montar(pg, 'falta');
    const tarde = await pg.evaluate(() => {
      const g = window.__golaco, t = document.getElementById('toque');
      g.forcarEntrada(null); g.faltaDeTeste({ u: 22, w: 4 });
      for (let i = 0; i < 2; i++) g.relogio.avancar(1000 / 60, { desenhar: true });
      return { fase: t.dataset.fase, classe: t.classList.contains('curva-arrasto'), mira: !!g.mundo.parada?.mira };
    });
    const ce = await centro('btn-chute');
    await toque('touchStart', ce.x, ce.y);
    const ligou = await pg.evaluate(() => { const g = window.__golaco; for (let i = 1; i <= 300; i++) { g.relogio.avancar(1000 / 60, { desenhar: true }); if (document.getElementById('toque').classList.contains('curva-arrasto')) return { q: i, segurado: document.getElementById('btn-chute').classList.contains('ativo') }; } return null; });
    await pg.evaluate(AVANCAR, 2);
    await arrastar(ce.x, ce.y, ce.x + 40, ce.y); const cTarde = await pg.evaluate(AVANCAR, 8);
    const arrTarde = await pg.evaluate(() => window.__golaco.bolaParada.arrasto);
    await toque('touchEnd'); await pg.evaluate(AVANCAR, 300);
    const okTarde = tarde.fase === 'ataque' && !tarde.classe && !tarde.mira && !!ligou?.segurado && cTarde === 0.75 && !!arrTarde;
    passos.push(`CHUTE apertado na montagem da falta (fase ${tarde.fase}, chevrons ${tarde.classe ? 'já' : 'ainda não'}), os chevrons ${ligou ? `${ligou.q} quadros depois${ligou.segurado ? ' com ele segurado' : ' (SOLTO?)'}` : 'NÃO vieram'}, +40 px depois deles ${cTarde} (arrasto ${arrTarde ? 'ligado' : 'NÃO'})`);
    meta(`5 ${tela.nome}: a curva por arrasto no CHUTE e no LANÇAMENTO (toque de verdade): os chevrons só na cobrança mirada e nenhum botão CURVA; tiro de meta e pênalti sem arrasto; o CHUTE segurado desde antes dos chevrons também arrasta`,
      `fora da cobrança: chevrons ${fora.classe || fora.chute ? 'SIM' : 'não'}; na cobrança: chevrons ${na.classe && na.chute && na.lanc ? 'no CHUTE e no LANÇAMENTO' : JSON.stringify(na)}, botões CURVA ${na.curvas} · ${passos.join(' · ')} · ${semArrasto.join(' · ')}`,
      !fora.classe && !fora.chute && na.classe && na.chute && na.lanc && na.curvas === 0 && okA && cl === -1 && okBorda && semArrasto.ok !== false && semArrasto.length === 2 && okTarde);
  }
  meta(`6 ${tela.nome}: nenhum erro no console`, s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', !s.erros.length);
  await s.navegador.close();
}

// ---------------------------------------------------------------------------------------------------------------- 7
// A mira nova pelos pixels (item 65; a régua do mapa do item 65: com × sem a mira no MESMO quadro — g.desenhar() não avança
// nada —, a máscara = a diferença média > 10 nos canais).
const MEDIR_MIRA = async () => {
  const g = window.__golaco, cv = document.querySelector('canvas');
  const W = innerWidth, H = innerHeight, CW = cv.width, CH = cv.height, k = CW / W;
  const off = document.createElement('canvas'); off.width = CW; off.height = CH;
  const cx = off.getContext('2d', { willReadFrequently: true });
  const ler = () => { cx.clearRect(0, 0, CW, CH); cx.drawImage(cv, 0, 0); return cx.getImageData(0, 0, CW, CH).data; };
  g.bolaParada.linha(true); g.desenhar(); g.desenhar(); g.desenhar();
  const A = ler(), eA = g.estado(), est = g.bolaParada.estado, L = est.linha;
  const pts = g.bolaParada.pontos();
  g.bolaParada.linha(false); g.desenhar(); g.desenhar();
  const B = ler(), eB = g.estado();
  // (a mira religada acende em 0,15 s do relógio: g.desenhar() não anda o tempo)
  g.bolaParada.linha(true); for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
  const dif = i => (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (D, i) => 0.2126 * lin(D[i]) + 0.7152 * lin(D[i + 1]) + 0.0722 * lin(D[i + 2]);
  const hsv = (D, i) => {
    const r = D[i] / 255, gg = D[i + 1] / 255, b = D[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn;
    let h = 0;
    if (d > 0) h = mx === r ? 60 * (((gg - b) / d) % 6) : mx === gg ? 60 * ((b - r) / d + 2) : 60 * ((r - gg) / d + 4);
    return { h: (h + 360) % 360, s: mx ? d / mx : 0, v: mx };
  };
  // L4 e L6: a máscara inteira
  let nm = 0, amAz = 0;
  const amarelaAzul = c => c.s > 0.35 && ((c.h >= 40 && c.h <= 70) || (c.h >= 190 && c.h <= 230));
  // (amarelo/azul POSTO pela mira: a cor nova, não o fundo escurecido pelo contorno — o preto a α 0,8 sobre a pele ou a camisa
  // laranja muda a matiz uns graus no sRGB)
  const difH = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  for (let i = 0; i < A.length; i += 4) {
    if (dif(i) <= 10) continue;
    nm++;
    const ca = hsv(A, i), cb = hsv(B, i);
    if (amarelaAzul(ca) && !amarelaAzul(cb) && (cb.s < 0.15 || difH(ca.h, cb.h) > 20)) amAz++;
  }
  // L1, L2, L5: tiras de 6 px de comprimento ao longo da parte cheia da linha (do fim da entrada + 0,2 m ao começo do
  // esmaecimento − 0,2 m)
  // (a mira de antes do item 65 não tem o plano: a linha inteira — a régua mede a base com --raiz)
  const fv = L.fimVisivel ?? { inicio: 0, esmaece: Infinity }, s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const tiras = [];
  const META = 3, LADO = 9;
  for (let i = 1; i < pts.length - 1; i++) {
    if (s[i] < fv.inicio + 0.35 + 0.2 || s[i] > fv.esmaece - 0.2) continue;
    const p = g.naTela(...pts[i]), q = g.naTela(...pts[i + 1]);
    if (p.atras || q.atras) continue;
    let tx = q.x - p.x, ty = q.y - p.y; const tl = Math.hypot(tx, ty); if (tl < 1e-3) continue; tx /= tl; ty /= tl;
    const nx = -ty, ny = tx;
    if (p.x < LADO || p.y < LADO || p.x > W - LADO || p.y > H - LADO) continue;
    const x0 = Math.floor((p.x - LADO - META) * k), x1 = Math.ceil((p.x + LADO + META) * k), y0 = Math.floor((p.y - LADO - META) * k), y1 = Math.ceil((p.y + LADO + META) * k);
    let n = 0, borda = false, melhor = -1, contraste = 0, maxC = 0, grama = true;
    for (let y = Math.max(0, y0); y < Math.min(CH, y1); y++) for (let x = Math.max(0, x0); x < Math.min(CW, x1); x++) {
      const ux = (x + 0.5) / k - p.x, uy = (y + 0.5) / k - p.y, al = ux * tx + uy * ty, at = ux * nx + uy * ny;
      if (Math.abs(al) > META || Math.abs(at) > LADO) continue;
      const i = (y * CW + x) * 4;
      if (dif(i) <= 10) continue;
      n++;
      if (Math.abs(at) > LADO - 1.5) borda = true;
      const la = lum(A, i), lb = lum(B, i), c = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
      // o miolo: o pixel mais claro da tira × o fundo dele sem a mira; maxC: o maior contraste de um pixel da mira com o próprio
      // fundo (o miolo OU o contorno: o "casing"); grama: o fundo da tira inteira é gramado (não a barreira, as placas, as linhas)
      if (la > melhor) { melhor = la; contraste = c; }
      if (c > maxC) maxC = c;
      const f = hsv(B, i);
      if (!(f.h >= 60 && f.h <= 140 && f.s >= 0.2 && f.v >= 0.12 && f.v <= 0.8)) grama = false;
    }
    if (!n || borda) continue;
    tiras.push({ larg: n / (k * k) / (2 * META), contraste, maxC, grama });
  }
  // A2: o anel (os pontos do anel na tela, a caixa com o traço) e a parte dele fora do HUD
  let anel = null;
  if (L.anel) {
    const ps = [];
    for (let j = 0; j < 32; j++) { const t = j / 32 * 2 * Math.PI; ps.push(g.naTela(L.anel.x + L.anel.raio * Math.cos(t), 0.03, L.anel.z + L.anel.raio * Math.sin(t))); }
    const tr = 2 * (L.verdePx.miolo / 2 + L.verdePx.contorno);
    const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
    const formas = [];
    for (const e of document.querySelectorAll('#toque:not([hidden]) .btn-toque')) if (getComputedStyle(e).display !== 'none' && e.offsetWidth) formas.push({ c: [e.offsetLeft + e.offsetWidth / 2, e.offsetTop + e.offsetHeight / 2, e.offsetWidth / 2] });
    for (const e of document.querySelectorAll('#hud [data-caixa]')) { const r = e.getBoundingClientRect(); if (r.width > 1 && r.height > 1 && getComputedStyle(e).display !== 'none') formas.push({ r: [r.left, r.top, r.right, r.bottom] }); }
    const noHud = p => formas.some(f => (f.c ? Math.hypot(p.x - f.c[0], p.y - f.c[1]) <= f.c[2] : p.x >= f.r[0] && p.x <= f.r[2] && p.y >= f.r[1] && p.y <= f.r[3]));
    const naTela = ps.filter(p => !p.atras && p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H);
    anel = { w: Math.max(...xs) - Math.min(...xs) + tr, h: Math.max(...ys) - Math.min(...ys) + tr, fora: naTela.filter(p => !noHud(p)).length / 32 };
  }
  return {
    W, H, k, nm: nm / (k * k), pct: nm / (CW * CH), amAz, tiras, anel, linha: L,
    chamadas: eA.desenhoChamadas - eB.desenhoChamadas, triangulos: eA.desenhoTriangulos - eB.desenhoTriangulos, programas: eA.programas,
    hora: document.documentElement.classList.contains('noite') ? 'noite' : 'dia',
  };
};
/** C1: pixels verdes que a mira põe num anel em volta da bola (raio ≤ 3× o do arco) com a curva c (o mundo restaurado depois). */
const VERDE_BOLA = async curvas => {
  const g = window.__golaco, cv = document.querySelector('canvas');
  const W = innerWidth, CW = cv.width, CH = cv.height, k = CW / W;
  const off = document.createElement('canvas'); off.width = CW; off.height = CH;
  const cx = off.getContext('2d', { willReadFrequently: true });
  const ler = () => { cx.clearRect(0, 0, CW, CH); cx.drawImage(cv, 0, 0); return cx.getImageData(0, 0, CW, CH).data; };
  const mi = g.mundo.parada.mira, c0 = mi.curva, b = g.mundo.bola.p, out = [];
  for (const c of curvas) {
    mi.curva = c;
    // (a mira religada acende em 0,15 s do relógio: g.desenhar() não anda o tempo)
    g.bolaParada.linha(true); for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    g.desenhar(); g.desenhar();
    const A = ler(), arco = g.bolaParada.estado.linha.arco, L = g.bolaParada.estado.linha;
    g.bolaParada.linha(false); g.desenhar();
    const Bq = ler();
    g.bolaParada.linha(true);
    const p = g.naTela(b.x, b.y, b.z), R = 3 * Math.max(arco?.raioPx ?? 0, 0.026 * innerHeight);
    let n = 0;
    for (let y = Math.max(0, Math.floor((p.y - R) * k)); y < Math.min(CH, Math.ceil((p.y + R) * k)); y++) for (let x = Math.max(0, Math.floor((p.x - R) * k)); x < Math.min(CW, Math.ceil((p.x + R) * k)); x++) {
      if (Math.hypot((x + 0.5) / k - p.x, (y + 0.5) / k - p.y) > R) continue;
      const i = (y * CW + x) * 4;
      if ((Math.abs(A[i] - Bq[i]) + Math.abs(A[i + 1] - Bq[i + 1]) + Math.abs(A[i + 2] - Bq[i + 2])) / 3 <= 10) continue;
      const r = A[i] / 255, gg = A[i + 1] / 255, bb = A[i + 2] / 255, mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      if (mx === gg && mx - mn > 0.35 * mx && mx > 0.35) { const h = 60 * ((bb - r) / (mx - mn) + 2); if (h >= 120 && h <= 165) n++; }
    }
    out.push({ curva: c, px: n / (k * k), arco: arco ?? null, miolo: L.verdePx?.miolo ?? 2.5 });
  }
  mi.curva = c0; for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
  return out;
};
// as áreas de antes (o mapa do item 65 na 2a13ca14, q=media, celular dpr 2 com entalhe: a máscara com × sem, % da tela)
const AREA_ANTES = { pc: { escanteio: 0.42, falta: 0.15, meta: 0.40 }, 844: { escanteio: 0.34, falta: 0.13, meta: 0.33 }, 568: { escanteio: 0.42, falta: 0.16, meta: 0.40 } };
const TELAS7 = [
  { id: 'pc', nome: 'PC 1280×720', largura: 1280, altura: 720, dpr: 1, toque: false },
  { id: '844', nome: 'celular 844×390', largura: 844, altura: 390, dpr: 2, toque: true },
  { id: '568', nome: 'celular 568×320', largura: 568, altura: 320, dpr: 2, toque: true },
];
const pct = (v, p) => { const o = [...v].sort((a, b) => a - b); return o.length ? o[Math.min(o.length - 1, Math.floor(p * (o.length - 1) + 0.5))] : NaN; };
if (!SO || SO.split(',').includes('7')) for (const T of TELAS7) {
  const s = await abrir({ largura: T.largura, altura: T.altura, dpr: T.dpr, toque: T.toque });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?semente=5&q=media&replay=0&comemoracao=0${T.toque ? '&toque=1&entalhe=1' : ''}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 240000 });
  await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  // a 1ª cobrança mirada: os programas WebGL antes e depois de a mira aparecer (compilada na carga do módulo — main.js
  // carregarBP, renderer.compileAsync —: nenhum novo). A mira fica DESLIGADA da carga até a 1ª contagem (nenhum quadro a desenha
  // antes dela: o montar desenha um quadro) e depois liga e ACENDE (0,15 s do relógio: g.desenhar() não anda o tempo, os quadros
  // andam). Antes a mira desenhada no montar já tinha compilado o programa e a meta passava também sem o compileAsync
  await pg.evaluate(() => window.__golaco.bolaParada.linha(false));
  await pg.evaluate(() => window.__golaco.bolaParada.carregar());
  await pg.evaluate(async () => { const g = window.__golaco; for (let i = 0; i < 30; i++) { g.relogio.avancar(1000 / 60, { desenhar: true }); await new Promise(ok => setTimeout(ok, 5)); } });
  await montar(pg, 'escanteio');
  const prog = await pg.evaluate(() => {
    const g = window.__golaco;
    g.desenhar(); g.desenhar(); const p1 = g.estado().programas, vis1 = g.bolaParada.estado.linha.visivel;
    g.bolaParada.linha(true); for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: true });
    const p2 = g.estado().programas, vis2 = g.bolaParada.estado.linha.visivel;
    return { p1, p2, vis1, vis2 };
  });
  await terminar(pg);
  const L = [], arcos = [];
  for (const hora of ['dia', 'noite']) {
    await pg.evaluate(h => window.__golaco.definirHora(h), hora);
    for (const tipo of ['escanteio', 'falta', 'meta']) {
      const e = await montar(pg, tipo);
      if (!e.ativa) { L.push({ hora, tipo, erro: 'a câmera não veio' }); continue; }
      await pg.evaluate(AVANCAR, 20);
      const r = await pg.evaluate(MEDIR_MIRA);
      L.push({ hora, tipo, ...r });
      if (PRINTS) await pg.evaluate(() => window.__golaco.desenhar()), await pg.screenshot({ path: path.join(PRINTS, `mira-${tipo}-${T.id}-${hora}.png`) });
      if (tipo === 'escanteio' && hora === 'dia') arcos.push(...await pg.evaluate(VERDE_BOLA, [0, 0.25, 0.5, 0.75, 1, -0.25]));
      await terminar(pg);
    }
  }
  await pg.evaluate(() => window.__golaco.definirHora('dia'));
  const cel = T.toque, lim = cel ? 4.8 : 7.5;
  const okL = L.filter(x => !x.erro);
  // L1/L2
  const larg = okL.flatMap(x => x.tiras.map(t => t.larg));
  const porTipo = ['escanteio', 'falta', 'meta'].map(tp => { const v = okL.filter(x => x.tipo === tp).flatMap(x => x.tiras.map(t => t.larg)); return { tp, n: v.length, p5: pct(v, 0.05), p95: pct(v, 0.95) }; });
  meta(`7 L1 ${T.nome}: a largura da linha pela máscara (tiras de 6 px na parte cheia; 3 tipos, dia e noite), p95`,
    porTipo.map(x => `${x.tp} ${f1(x.p95)} px (${x.n} tiras)`).join(' · '), okL.length === 6 && porTipo.every(x => x.n >= 10 && x.p95 <= lim));
  meta(`7 L2 ${T.nome}: a largura constante ao longo da linha (p95 / p5 por tipo)`,
    porTipo.map(x => `${x.tp} ${f2(x.p95 / x.p5)} (${f1(x.p5)}–${f1(x.p95)} px)`).join(' · '), porTipo.every(x => x.n >= 10 && x.p95 / x.p5 <= 1.35));
  // L4 (a meta da especificação é a do 844×390 — e o PC —; em 568×320 a linha de largura fixa em px ocupa mais da tela pequena:
  // informativo, só ≥ 150 px e ≤ 100% da de antes)
  const area = okL.filter(x => x.hora === 'dia').map(x => { const a0 = AREA_ANTES[T.id][x.tipo], f = x.pct * 100 / a0; return { tp: x.tipo, pct: x.pct * 100, f, px: x.nm, ok: x.nm >= 150 && f <= (T.id === '568' ? 1.0 : x.tipo === 'falta' ? 1.10 : 0.75) }; });
  meta(`7 L4 ${T.nome}: a área da mira (linha + anel + arco) / tela, dia: ${T.id === '568' ? '≤ 100% da de antes (informativo: a meta é a do 844×390 e do PC)' : '≤ 75% da de antes no escanteio e no tiro de meta, ≤ 110% na falta'}, ≥ 150 px`,
    area.map(x => `${x.tp} ${f2(x.pct)}% (${Math.round(x.f * 100)}% da de antes; ${Math.round(x.px)} px)`).join(' · '), area.length === 3 && area.every(x => x.ok));
  // L5 (o miolo sobre o GRAMADO, a régua da especificação) e L5b (em qualquer fundo — a barreira, as placas, a torcida, as
  // linhas do campo —: o miolo OU o contorno ≥ 3:1, o "casing")
  const fr = okL.map(x => {
    const g = x.tiras.filter(t => t.grama);
    return { rot: `${x.tipo} ${x.hora}`, n: g.length, ok: g.filter(t => t.contraste >= 3).length / Math.max(1, g.length), min: Math.min(...g.map(t => t.contraste)),
      nb: x.tiras.length, okb: x.tiras.filter(t => t.maxC >= 3).length / Math.max(1, x.tiras.length), minb: Math.min(...x.tiras.map(t => t.maxC)) };
  });
  meta(`7 L5 ${T.nome}: o contraste do miolo (o pixel mais claro da tira × o mesmo ponto sem a mira) sobre o gramado (a tira inteira) ≥ 3:1 em ≥ 95% das tiras, dia e noite`,
    fr.map(x => `${x.rot} ${Math.round(x.ok * 100)}% de ${x.n} (pior ${f2(x.min)}:1)`).join(' · '), fr.length === 6 && fr.every(x => x.n >= 3 && x.ok >= 0.95));
  meta(`7 L5b ${T.nome}: em qualquer fundo (a barreira, as placas, a torcida, as linhas do campo), algum pixel da mira (o miolo ou o contorno) ≥ 3:1 com o próprio fundo em ≥ 95% das tiras`,
    fr.map(x => `${x.rot} ${Math.round(x.okb * 100)}% de ${x.nb} (pior ${f2(x.minb)}:1)`).join(' · '), fr.length === 6 && fr.every(x => x.nb >= 5 && x.okb >= 0.95));
  // L6
  meta(`7 L6 ${T.nome}: nenhum pixel amarelo nem azul que a mira tenha posto (matiz 40–70° ou 190–230°, saturação > 0,35)`,
    okL.map(x => `${x.tipo} ${x.hora} ${x.amAz}`).join(' · '), okL.length === 6 && okL.every(x => x.amAz === 0));
  // A2 (só no celular 844×390)
  if (T.id === '844') {
    const an = okL.filter(x => x.tipo === 'escanteio').map(x => x.anel);
    meta(`7 A2 ${T.nome}: o anel do alvo no escanteio ≥ 20 × 6 px e ≥ 95% fora do HUD (dia e noite)`,
      an.map(a => (a ? `${f1(a.w)} × ${f1(a.h)} px, ${Math.round(a.fora * 100)}% fora do HUD` : 'sem anel')).join(' · '), an.length === 2 && an.every(a => a && a.w >= 20 && a.h >= 6 && a.fora >= 0.95));
  }
  // C1
  {
    const z = arcos.find(a => a.curva === 0), por = arcos.filter(a => a.curva > 0).sort((a, b) => a.curva - b.curva);
    // (os pixels verdes são o miolo do traço: o comprimento do arco ≈ pixels ÷ a largura do miolo)
    const cresc = por.slice(1).map((a, i) => (a.px - por[i].px) / a.miolo);
    const minC = cel ? 4 : 8, esq = arcos.find(a => a.curva < 0);
    meta(`7 C1 ${T.nome}: com curva 0 nenhum pixel verde junto da bola; o arco cresce ≥ ${minC} px por degrau (os pixels verdes ÷ o miolo do traço) e vai para o lado da curva`,
      `curva 0: ${f1(z?.px)} px verdes · ${por.map(a => `${a.curva}: ${f1(a.px)} px (${a.arco ? `${f1(a.arco.graus)}°, raio ${f1(a.arco.raioPx)} px` : 'sem arco'})`).join(' · ')} · por degrau ${cresc.map(f1).join(', ')} px · −0,25 à ${esq?.arco?.lado ?? '-'}`,
      !!z && z.px === 0 && por.length === 4 && cresc.length === 3 && cresc.every(c => c >= minC) && esq?.arco?.lado === 'esquerda' && por.every(a => a.arco?.lado === 'direita'));
  }
  // custo
  meta(`7 custo ${T.nome}: ≤ +1 chamada e ≤ +500 triângulos com a mira; nenhum programa WebGL novo quando ela aparece pela 1ª vez (compilado na carga do módulo)`,
    `${okL.map(x => `${x.tipo} ${x.hora} +${x.chamadas}/+${x.triangulos}`).join(' · ')} · programas ${prog.p1} (a mira ${prog.vis1 ? 'JÁ desenhada' : 'nunca desenhada'}) → ${prog.p2} (a mira ${prog.vis2 ? 'desenhada' : 'NÃO desenhada'})`,
    okL.length === 6 && okL.every(x => x.chamadas <= 1 && x.triangulos <= 500) && !prog.vis1 && prog.vis2 && prog.p2 === prog.p1);
  meta(`7 ${T.nome}: nenhum erro no console`, s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', !s.erros.length);
  await s.navegador.close();
}
await srv.fechar?.();
const falhas = res.filter(r => !r.ok).length;
console.log(falhas ? `\nteste-bola-parada-tela: REPROVOU (${falhas} de ${res.length})` : `\nteste-bola-parada-tela: PASSOU (${res.length})`);
process.exit(falhas ? 1 : 0);
