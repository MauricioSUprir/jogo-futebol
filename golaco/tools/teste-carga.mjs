// Teste de carga da página (navegador, PC 1280×720):
//   1) carrega sem erro no console;
//   2) o canvas não está vazio (print sem o HUD: variação de cor e gramado verde);
//   3) download inicial (nosso servidor + CDN) ≤ 4 MB;
//   4) laço de passo fixo: 1 s de relógio manual a 60, 120 e 144 Hz = 60 passos;
//   5) determinismo Node = Chromium: 600 passos com o MESMO roteiro de entradas (correr,
//      modificador, pedalada, passe, chute, marcador e máquina de passes) no treino de ataque
//      (modo explícito: a página abre na partida) dão o mesmo hashMundo nos dois; o mesmo na
//      PARTIDA 11×11 (Etapa 3): 600 passos com uma edição do time no meio (troca de vaga, tática e
//      uma substituição, que entra no intervalo de um tempo curto) e a troca de lado; e a matemática
//      determinística (js/matdet.js) dá os mesmos bits nos dois motores;
//   6) interpolação: a 144 Hz o jogador desenhado anda a passos regulares (sem o "anda, para,
//      anda" de quem desenha só o último passo de simulação) — modo condução;
//   7) câmera sem tremor a 144 Hz (posição lisa, sem vai-e-volta) conduzindo em curva — modo
//      condução (sem adversário para roubar a bola no meio da medida).
// Saída com PASSOU/REPROVOU e código de saída 1 se reprovar.
//   node tools/teste-carga.mjs [--url http://...] [--raiz <pasta do jogo>] [--semente N]
//   (sem --url sobe o servidor da pasta; --raiz mede outra cópia, ex.: a base, com a lógica dela)
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const LIMITE_BYTES = 4 * 1024 * 1024;
const N_PASSOS = 600;
const args = process.argv.slice(2);
const urlExterna = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const imp = f => import(pathToFileURL(path.join(raiz, 'js', f)).href);
// --semente N: soma N às sementes (outro conjunto, para as 5 rodadas seguidas)
const DS = args.includes('--semente') ? Math.max(0, Math.floor(+args[args.indexOf('--semente') + 1] || 0)) : 0;
const SEMENTE = 7 + DS;
const { criarTreino, passoTreino } = await imp('sessao.js');
const { hashMundo } = await imp('sim.js');
const { BOTAO } = await imp('config.js');
const { MD } = await imp('matdet.js');
const P = await imp('partida.js').catch(() => null);
const ESC = await imp('escalacao.js').catch(() => null);
const SEMENTE_PARTIDA = 11 + DS;
const MIN_PARTIDA = 0.1; // tempo de 6 s: o intervalo (com a substituição) cai dentro dos 600 passos

/**
 * Entrada no formato POR TIME ({0: {x, z, botoes}}), com x/z/botoes também no próprio objeto
 * (não enumeráveis) — o mesmo que main.js entrega ao passoTreino (os dois formatos valem).
 */
function entradaDoTime(e) {
  const t = { 0: { x: e.x, z: e.z, botoes: e.botoes } };
  Object.defineProperties(t, { x: { value: e.x }, z: { value: e.z }, botoes: { value: e.botoes } });
  return t;
}

/** Roteiro determinístico: curva, arrancada, modificador, pedalada, passe, chute, marcador e máquina. */
function roteiro(n) {
  const r = [];
  for (let i = 0; i < n; i++) {
    const t = i / 60;
    const ang = 0.5 * Math.sin(t * 0.8) + (i >= 330 ? 1.3 : 0);
    const mag = i < 60 ? 0.45 : 0.92;
    let botoes = 0;
    if (i >= 140 && i < 250) botoes |= BOTAO.CORRER;
    if (i >= 360 && i < 430) botoes |= BOTAO.MOD;
    // dois toques rápidos no modificador = pedalada
    if ((i >= 470 && i < 476) || (i >= 482 && i < 488)) botoes |= BOTAO.MOD;
    // passe (segurado ~0,3 s) e chute (~0,5 s): exercitam a carga, o pedido e o voo da Etapa 2
    if (i >= 100 && i < 118) botoes |= BOTAO.PASSE;
    if (i >= 540 && i < 570) botoes |= BOTAO.CHUTE;
    const e = { x: Math.cos(ang) * mag, z: Math.sin(ang) * mag, botoes };
    if (i === 300) e.acoes = ['marcador'];
    if (i === 520) e.acoes = ['maquina'];
    r.push(e);
  }
  return r;
}

function hashesNode(rot) {
  const m = criarTreino({ semente: SEMENTE, modo: 'ataque' });
  const hs = [hashMundo(m)];
  for (let i = 0; i < rot.length; i++) {
    const e = rot[i];
    passoTreino(m, entradaDoTime(e), e.acoes ?? null);
    if ((i + 1) % 100 === 0) hs.push(hashMundo(m));
  }
  return { hs, posse: m.posse, tick: m.tick, eventos: m.stats };
}

/** Assinatura (FNV-1a dos bits) de 30 mil resultados da matemática determinística. */
function assinaturaMat(MD) {
  const dv = new DataView(new ArrayBuffer(8));
  let h = 2166136261 >>> 0;
  const mis = v => { dv.setFloat64(0, v); for (let i = 0; i < 8; i++) { h ^= dv.getUint8(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (let i = 1; i <= 3000; i++) {
    const x = i * 0.0137 - 20;
    mis(MD.sin(x)); mis(MD.cos(x)); mis(MD.atan2(x, 3.1 - i * 0.001)); mis(MD.exp(x * 0.5)); mis(MD.log(i * 0.37));
    mis(MD.pow(i * 0.011, 1.35)); mis(MD.asin(((i % 1999) / 1000) - 0.999)); mis(MD.hypot(x, i * 0.01)); mis(MD.atan(x)); mis(MD.acos(((i % 1997) / 1000) - 0.998));
  }
  return h >>> 0;
}

/**
 * Roteiro da partida: correr, conduzir, chutar e, no passo 300, uma edição do time 0 (PD ↔ PE,
 * tática mais ofensiva e a substituição 9 → 22, pendente até a parada).
 */
function roteiroPartida(n) {
  const base = ESC ? ESC.estadoInicialTime('golaco') : null;
  const ed = base ? {
    tipo: 'editarTime', time: 0, base: 0, formacao: base.formacao,
    vagas: { ...base.vagas, PD: base.vagas.PE, PE: base.vagas.PD, ATA: 22 },
    substituicoes: [{ sai: base.vagas.ATA, entra: 22 }], tatica: { mentalidade: 1, pressao: 2, largura: 2, linha: 2 },
  } : null;
  const r = [];
  for (let i = 0; i < n; i++) {
    const a = 0.7 * Math.sin(i / 45);
    const e = { x: Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, botoes: (i >= 60 && i < 140 ? BOTAO.CORRER : 0) | (i >= 160 && i < 185 ? BOTAO.CHUTE : 0) | (i >= 470 && i < 490 ? BOTAO.PASSE : 0) };
    if (i === 300 && ed) e.acoes = [ed];
    r.push(e);
  }
  return r;
}
function hashesPartidaNode(rot) {
  if (!P) return null;
  const m = P.criarPartida({ semente: SEMENTE_PARTIDA, minutosPorTempo: MIN_PARTIDA });
  const hs = [hashMundo(m)];
  for (let i = 0; i < rot.length; i++) {
    const e = rot[i];
    P.passoPartida(m, entradaDoTime(e), e.acoes ?? null);
    if ((i + 1) % 100 === 0) hs.push(hashMundo(m));
  }
  return { hs, jogadores: m.jogadores.length };
}

const resultados = [];
let hexa = h => (h >>> 0).toString(16).padStart(8, '0');
function meta(nome, medido, alvo, ok) { resultados.push({ nome, medido, alvo, ok }); }

const srv = urlExterna ? null : await servidor(0, raiz);
const url = urlExterna ?? srv.url;
const { navegador, contexto, pagina, erros, cdnBytes } = await abrir({ largura: 1280, altura: 720 });
try {
  const t0 = Date.now();
  await pagina.goto(url, { waitUntil: 'load' });
  await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
  const tCarga = (Date.now() - t0) / 1000;
  await pagina.waitForTimeout(2500); // alguns quadros no laço real
  const quadrosReais = await pagina.evaluate(() => window.__golaco.render.quadros);

  // 1) erros no console
  meta('Erros no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
  meta('Quadros desenhados no laço real (2,5 s)', String(quadrosReais), '≥ 2', quadrosReais >= 2);

  // 2) canvas não vazio (sem HUD)
  await pagina.evaluate(() => { document.documentElement.classList.add('sem-hud'); document.querySelector('.vinheta')?.remove(); window.__golaco.desenhar(); });
  const png = await pagina.screenshot({ type: 'png' });
  await pagina.evaluate(() => document.documentElement.classList.remove('sem-hud'));
  const aux = await contexto.newPage();
  await aux.setContent('<canvas id="c"></canvas>');
  const est = await aux.evaluate(async b64 => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.getElementById('c');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, soma = 0, soma2 = 0, verdes = 0;
    const cores = new Set();
    for (let i = 0; i < d.length; i += 16) { // 1 a cada 4 pixels
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      soma += l; soma2 += l * l; n++;
      if (gg > r + 15 && gg > b + 15) verdes++;
      cores.add((r >> 3) << 10 | (gg >> 3) << 5 | (b >> 3));
    }
    const media = soma / n;
    return { media, desvio: Math.sqrt(Math.max(0, soma2 / n - media * media)), cores: cores.size, verde: verdes / n };
  }, png.toString('base64'));
  await aux.close();
  const okCanvas = est.desvio > 8 && est.cores > 60 && est.verde > 0.3;
  meta('Canvas não vazio', `desvio ${est.desvio.toFixed(1)}, ${est.cores} cores, ${(est.verde * 100).toFixed(0)}% verde`, 'desvio > 8, > 60 cores, > 30% verde', okCanvas);

  // 3) bytes baixados
  const bytesSrv = srv ? srv.bytes() : 0;
  const bytesCdn = cdnBytes();
  const total = bytesSrv + bytesCdn;
  meta('Download inicial', `${(total / 1048576).toFixed(2)} MB (nosso ${(bytesSrv / 1024).toFixed(0)} KB + CDN ${(bytesCdn / 1024).toFixed(0)} KB)`, '≤ 4 MB', total <= LIMITE_BYTES && (srv ? bytesSrv > 0 : true));

  // 4) passo fixo a 60/120/144 Hz com relógio manual
  const laco = await pagina.evaluate(() => {
    const g = window.__golaco;
    const res = {};
    g.relogio.usarManual(true);
    for (const hz of [60, 120, 144]) {
      g.relogio.avancar(1000 / hz, { desenhar: false }); // primeiro quadro só marca o tempo
      const p0 = g.passos;
      for (let i = 0; i < hz; i++) g.relogio.avancar(1000 / hz, { desenhar: false });
      res[hz] = g.passos - p0;
    }
    g.relogio.usarManual(false);
    return res;
  });
  const okLaco = [60, 120, 144].every(hz => Math.abs(laco[hz] - 60) <= 1);
  meta('Passos em 1 s (60/120/144 Hz)', `${laco[60]} / ${laco[120]} / ${laco[144]}`, '60 ± 1 em todos', okLaco);

  // 5) determinismo Node = Chromium
  const rot = roteiro(N_PASSOS);
  const node = hashesNode(rot);
  const nav = await pagina.evaluate(({ rot, semente }) => {
    const g = window.__golaco;
    g.pausar(true);
    const hs = [g.reiniciar({ semente, modo: 'ataque' })];
    for (let k = 0; k < rot.length; k += 100) hs.push(g.rodarPassos(100, rot.slice(k, k + 100)));
    const m = g.mundo;
    const r = { hs, posse: m.posse, tick: m.tick, stats: { ...m.stats }, jogadores: m.jogadores.length };
    g.pausar(false);
    return r;
  }, { rot, semente: SEMENTE });
  let divergeEm = -1;
  for (let i = 0; i < node.hs.length; i++) if (node.hs[i] !== nav.hs[i]) { divergeEm = i * 100; break; }
  meta('Hash após 600 passos (Node = Chromium)', `Node ${hexa(node.hs.at(-1))} · Chromium ${hexa(nav.hs.at(-1))}${divergeEm >= 0 ? ` (diverge até o passo ${divergeEm})` : ''}`, 'iguais', divergeEm < 0);
  meta('Roteiro exercitado', `tick ${nav.tick}, posse ${nav.posse}, ${nav.jogadores} jogadores, passes ${nav.stats.passes ?? '-'}, chutes ${nav.stats.chutes ?? '-'}, roubadas ${nav.stats.roubadas}, perdas ${nav.stats.perdas}`, 'tick 600', nav.tick === N_PASSOS);

  // 5b) partida 11×11 (Etapa 3): Node = Chromium com edição, substituição, intervalo e troca de lado
  const rotP = roteiroPartida(N_PASSOS);
  const nodeP = hashesPartidaNode(rotP);
  const navP = await pagina.evaluate(({ rot, semente, min }) => {
    const g = window.__golaco;
    g.pausar(true);
    const hs = [g.reiniciar({ modo: 'partida', semente, minutosPorTempo: min })];
    for (let k = 0; k < rot.length; k += 100) hs.push(g.rodarPassos(100, rot.slice(k, k + 100)));
    const m = g.mundo;
    const t = m.times?.[0];
    const r = {
      hs, jogadores: m.jogadores.length, tick: m.tick, modo: m.modo ?? null,
      tempo: m.partida?.tempo ?? null, versao: t?.versao ?? null, saiu: t ? [...t.saiu] : [], pd: t?.vagas?.PD ?? null,
      em22: m.jogadores.some(j => j.id === 22), linha: t?.tatica?.linha ?? null,
    };
    g.pausar(false);
    return r;
  }, { rot: rotP, semente: SEMENTE_PARTIDA, min: MIN_PARTIDA });
  let divergeP = -1;
  if (nodeP) for (let i = 0; i < nodeP.hs.length; i++) if (nodeP.hs[i] !== navP.hs[i]) { divergeP = i * 100; break; }
  meta('Partida 11×11: 22 em campo no Chromium (reiniciar com modo partida)', `${navP.jogadores} jogadores, modo ${navP.modo}`, '22, partida', navP.jogadores === 22 && navP.modo === 'partida');
  meta('Partida: hash após 600 passos com edição e substituição (Node = Chromium)', nodeP
    ? `Node ${hexa(nodeP.hs.at(-1))} · Chromium ${hexa(navP.hs.at(-1))}${divergeP >= 0 ? ` (diverge até o passo ${divergeP})` : ''}`
    : 'sem partida.js na lógica', 'iguais', !!nodeP && divergeP < 0);
  meta('Partida: a edição e a substituição entraram (2º tempo, 9 → 22, PD = 11, linha Alta)', `tempo ${navP.tempo}, versão ${navP.versao}, saiu [${navP.saiu}], 22 em campo ${navP.em22}, PD ${navP.pd}, linha ${navP.linha}`,
    '2º tempo, saiu 9, PD 11, linha 2', navP.tempo === 2 && navP.saiu.includes(9) && navP.em22 && navP.pd === 11 && navP.linha === 2);

  const matNode = assinaturaMat(MD);
  const matNav = await pagina.evaluate(async src => {
    const { MD } = await import('./js/matdet.js');
    return new Function('MD', 'return (' + src + ')(MD)')(MD);
  }, assinaturaMat.toString());
  meta('matdet.js igual nos dois motores (30 mil valores)', `Node ${hexa(matNode)} · Chromium ${hexa(matNav)}`, 'iguais', matNode === matNav);

  // 6) interpolação a 144 Hz: deslocamento do jogador DESENHADO por quadro, correndo reto
  const interp = await pagina.evaluate(() => {
    const g = window.__golaco;
    g.reiniciar({ semente: 3, modo: 'conducao' });
    g.forcarEntrada({ x: 1, z: 0, botoes: 0 });
    g.relogio.usarManual(true);
    for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); // embala (4 s)
    const xs = [];
    for (let i = 0; i < 145; i++) { g.relogio.avancar(1000 / 144, { desenhar: false }); xs.push(g.render.jogador.x); }
    g.relogio.usarManual(false);
    g.forcarEntrada(null);
    const d = [];
    for (let i = 1; i < xs.length; i++) d.push(xs[i] - xs[i - 1]);
    const med = d.reduce((a, b) => a + b, 0) / d.length;
    return { min: Math.min(...d), max: Math.max(...d), med, zeros: d.filter(v => Math.abs(v) < 1e-6).length };
  });
  const okInterp = interp.zeros === 0 && interp.min > interp.med * 0.6 && interp.max < interp.med * 1.4;
  meta('Interpolação a 144 Hz (deslocamento por quadro)', `méd ${(interp.med * 100).toFixed(2)} cm · mín ${(interp.min * 100).toFixed(2)} · máx ${(interp.max * 100).toFixed(2)} · quadros parados ${interp.zeros}`, 'sem quadro parado, ±40% da média', okInterp);

  // 7) câmera sem tremor: conduzindo em curva (com arrancada no meio) a 144 Hz, a posição da
  //    câmera tem que ser lisa — 2ª diferença por quadro pequena perto do quanto ela anda, e
  //    nenhum vai-e-volta curto (inversão de sentido seguida de outra em < 0,25 s)
  const tremor = await pagina.evaluate(() => {
    const g = window.__golaco;
    g.reiniciar({ semente: 5, modo: 'conducao' });
    g.relogio.usarManual(true);
    const cams = [];
    const n = 144 * 5;
    for (let i = 0; i < n; i++) {
      const t = i / 144;
      const a = 0.9 * t;
      g.forcarEntrada({ x: Math.cos(a), z: Math.sin(a), botoes: t > 1.5 && t < 3.2 ? 1 : 0 });
      g.relogio.avancar(1000 / 144, { desenhar: false });
      if (t > 0.5) cams.push({ ...g.render.camera });
    }
    g.forcarEntrada(null);
    g.relogio.usarManual(false);
    let d2 = 0, v = 0;
    const inv = { x: [], z: [] };
    for (let i = 2; i < cams.length; i++) {
      for (const k of ['x', 'z']) {
        d2 = Math.max(d2, Math.abs(cams[i][k] - 2 * cams[i - 1][k] + cams[i - 2][k]));
        const a = cams[i - 1][k] - cams[i - 2][k], b = cams[i][k] - cams[i - 1][k];
        if (Math.abs(a) > 1e-6 && Math.abs(b) > 1e-6 && Math.sign(a) !== Math.sign(b)) inv[k].push(i);
      }
      v += Math.hypot(cams[i].x - cams[i - 1].x, cams[i].z - cams[i - 1].z);
    }
    v /= cams.length - 2;
    let vaivem = 0;
    for (const k of ['x', 'z']) for (let i = 1; i < inv[k].length; i++) if (inv[k][i] - inv[k][i - 1] < 36) vaivem++;
    return { d2, v, vaivem, inversoes: inv.x.length + inv.z.length };
  });
  const okTremor = tremor.v > 0.005 && tremor.d2 < tremor.v * 0.1 && tremor.vaivem === 0;
  meta('Câmera sem tremor a 144 Hz (curva + arrancada)', `2ª dif. máx ${(tremor.d2 * 1000).toFixed(2)} mm/quadro² · anda ${(tremor.v * 1000).toFixed(1)} mm/quadro · vai-e-volta ${tremor.vaivem} (inversões ${tremor.inversoes})`, '2ª dif. < 10% do passo, 0 vai-e-volta', okTremor);

  // a página continua viva depois de tudo
  await pagina.waitForTimeout(500);
  const fim = await pagina.evaluate(() => window.__golaco.render.quadros);
  meta('Sem erro no fim', erros.length ? erros.slice(0, 2).join(' | ') : `0 (carregou em ${tCarga.toFixed(1)} s, ${fim} quadros)`, '0', erros.length === 0);
} catch (e) {
  meta('Execução', e.message, 'sem exceção', false);
} finally {
  await navegador.close();
  if (srv) await srv.fechar();
}

const larg = Math.max(...resultados.map(r => r.nome.length));
for (const r of resultados) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = resultados.length > 0 && resultados.every(r => r.ok);
console.log(ok ? '\nteste-carga: PASSOU' : '\nteste-carga: REPROVOU');
process.exit(ok ? 0 : 1);
