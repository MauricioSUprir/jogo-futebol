// Teste de carga da página (navegador, PC 1280×720):
//   1) carrega sem erro no console;
//   2) o canvas não está vazio (print sem o HUD: variação de cor e gramado verde);
//   3) download inicial (nosso servidor + CDN) ≤ 4 MB;
//   4) laço de passo fixo: 1 s de relógio manual a 60, 120 e 144 Hz = 60 passos;
//   5) determinismo Node = Chromium: 600 passos com o MESMO roteiro de entradas (correr,
//      modificador, pedalada, marcador e máquina de passes) dão o mesmo hashMundo nos dois;
//      e a matemática determinística (js/matdet.js) dá os mesmos bits nos dois motores;
//   6) interpolação: a 144 Hz o jogador desenhado anda a passos regulares (sem o "anda, para,
//      anda" de quem desenha só o último passo de simulação).
// Saída com PASSOU/REPROVOU e código de saída 1 se reprovar.
//   node tools/teste-carga.mjs [--url http://...]   (sem --url sobe o servidor da pasta)
import { servidor, abrir } from './lib/navegador.mjs';
import { criarTreino, passoTreino } from '../js/sessao.js';
import { hashMundo } from '../js/sim.js';
import { BOTAO } from '../js/config.js';
import { MD } from '../js/matdet.js';

const LIMITE_BYTES = 4 * 1024 * 1024;
const N_PASSOS = 600;
const SEMENTE = 7;
const args = process.argv.slice(2);
const urlExterna = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;

/** Roteiro determinístico: curva suave, arrancada, modificador, pedalada, marcador e máquina. */
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
    const e = { x: Math.cos(ang) * mag, z: Math.sin(ang) * mag, botoes };
    if (i === 300) e.acoes = ['marcador'];
    if (i === 520) e.acoes = ['maquina'];
    r.push(e);
  }
  return r;
}

function hashesNode(rot) {
  const m = criarTreino({ semente: SEMENTE });
  const hs = [hashMundo(m)];
  for (let i = 0; i < rot.length; i++) {
    const e = rot[i];
    passoTreino(m, { x: e.x, z: e.z, botoes: e.botoes }, e.acoes ?? null);
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

const resultados = [];
let hexa = h => (h >>> 0).toString(16).padStart(8, '0');
function meta(nome, medido, alvo, ok) { resultados.push({ nome, medido, alvo, ok }); }

const srv = urlExterna ? null : await servidor();
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
    const hs = [g.reiniciar({ semente })];
    for (let k = 0; k < rot.length; k += 100) hs.push(g.rodarPassos(100, rot.slice(k, k + 100)));
    const m = g.mundo;
    const r = { hs, posse: m.posse, tick: m.tick, stats: { ...m.stats } };
    g.pausar(false);
    return r;
  }, { rot, semente: SEMENTE });
  let divergeEm = -1;
  for (let i = 0; i < node.hs.length; i++) if (node.hs[i] !== nav.hs[i]) { divergeEm = i * 100; break; }
  meta('Hash após 600 passos (Node = Chromium)', `Node ${hexa(node.hs.at(-1))} · Chromium ${hexa(nav.hs.at(-1))}${divergeEm >= 0 ? ` (diverge até o passo ${divergeEm})` : ''}`, 'iguais', divergeEm < 0);
  meta('Roteiro exercitado', `tick ${nav.tick}, posse ${nav.posse}, roubadas ${nav.stats.roubadas}, perdas ${nav.stats.perdas}`, 'tick 600', nav.tick === N_PASSOS);

  const matNode = assinaturaMat(MD);
  const matNav = await pagina.evaluate(async src => {
    const { MD } = await import('./js/matdet.js');
    return new Function('MD', 'return (' + src + ')(MD)')(MD);
  }, assinaturaMat.toString());
  meta('matdet.js igual nos dois motores (30 mil valores)', `Node ${hexa(matNode)} · Chromium ${hexa(matNav)}`, 'iguais', matNode === matNav);

  // 6) interpolação a 144 Hz: deslocamento do jogador DESENHADO por quadro, correndo reto
  const interp = await pagina.evaluate(() => {
    const g = window.__golaco;
    g.reiniciar({ semente: 3 });
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
