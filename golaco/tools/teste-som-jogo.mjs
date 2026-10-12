// Som da torcida DURANTE O JOGO (pedido do dono de 11/10: "bota som de torcida também, pra durante o jogo"),
// no celular deitado 844×390 (toque, qualidade Média, ?demo=1: a IA joga pelo humano). Um grampo no
// AudioNode.connect liga um AnalyserNode em tudo o que vai para a saída (destination) e registra as fontes que
// começam; o relógio manual anda junto com o relógio real (o som e a simulação andam juntos).
//   M1  o 1º toque deixa o AudioContext 'running' em ≤ 1 s;
//   M2  leito (bola longe do gol: agito ≤ 0,3 e nenhum som de reação nos últimos 4 s): RMS mediano na saída ≥ −22 dBFS;
//   M3  apito (uma falta de teste) − leito ≤ 8 dB (o apito corta a mixagem sem abafá-la);
//   M4  canto: com o jogo rolando, nível do canto ≥ 0,5 × o do murmúrio em ≥ 50% das amostras;
//   M5  variedade: ≥ 3 cantos/batucada diferentes tocam em 60 s;
//   M6  iPhone: depois do toque, navigator.audioSession.type === 'playback' (a chave de silencioso não cala o jogo);
//   M7  interrupção (o contexto suspenso de fora, como o iOS faz com a tela bloqueada) + 1 toque → 'running', e o
//       estado do som igual ao do contexto o tempo todo;
//   M8  memória do áudio decodificado ≤ 30 MiB; M9 sons baixados ≤ 1,5 MB e só depois da página abrir;
//   M10 pico na saída ≤ −1 dBFS (limitador no fim da cadeia), inclusive no grito de um gol roteirizado;
//   M11 o hash do mundo é o mesmo do Node com o som ligado, desligado e sem Web Audio (o som nunca mexe na simulação).
// Na versão publicada antes desta frente: M1 passa e M2–M7 reprovam (diagnóstico de 11/10).
//   node tools/teste-som-jogo.mjs [--raiz <pasta do jogo>] [--segundos 60]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
const SEG = +arg('--segundos', 60);
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : String(v));

/** Grampo de áudio: analisador na saída, fontes que começam, toques e AudioContext criados. */
function grampo() {
  if (!navigator.audioSession) Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto' }, configurable: true });
  const A = window.__aud = { an: null, inicios: [], criados: 0 };
  const C = window.AudioContext;
  if (!C) return;
  window.AudioContext = class extends C {
    constructor(...a) {
      super(...a); A.ctx = this; A.criados++;
      this.addEventListener('statechange', () => { if (this.state === 'running' && A.tRodando == null) A.tRodando = performance.now(); });
      if (this.state === 'running') A.tRodando = performance.now();
    }
  };
  window.addEventListener('touchend', () => { if (A.tGesto == null) A.tGesto = performance.now(); }, true);
  const con = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...r) {
    const out = con.call(this, dest, ...r);
    if (dest instanceof AudioDestinationNode) {
      if (!A.an) { A.an = this.context.createAnalyser(); A.an.fftSize = 16384; A.buf = new Float32Array(A.an.fftSize); }
      con.call(this, A.an);
    }
    return out;
  };
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { A.inicios.push({ t: performance.now(), dur: this.buffer ? Math.round(this.buffer.duration * 100) / 100 : 0, laco: this.loop }); return st.apply(this, a); };
  window.__rms = () => { if (!A.an) return null; A.an.getFloatTimeDomainData(A.buf); let s = 0, p = 0; for (const v of A.buf) { s += v * v; const a = Math.abs(v); if (a > p) p = a; } A.pico = Math.max(A.pico ?? 0, p); return 10 * Math.log10(s / A.buf.length + 1e-12); };
}

// hashes do Node (a mesma partida e o mesmo roteiro): M11
const imp = f => import(pathToFileURL(path.join(raiz, 'js', f)).href);
const { hashMundo } = await imp('sim.js');
const P = await imp('partida.js');
const SEM_H = 7, MIN_H = 0.5, N_H = 600;
const rotH = Array.from({ length: N_H }, (_, i) => { const a = 0.7 * Math.sin(i / 45); return { x: Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, botoes: 0 }; });
const hashNode = (() => {
  const m = P.criarPartida({ semente: SEM_H, minutosPorTempo: MIN_H });
  for (const e of rotH) {
    const ent = { 0: { x: e.x, z: e.z, botoes: e.botoes } };
    Object.defineProperties(ent, { x: { value: e.x }, z: { value: e.z }, botoes: { value: e.botoes } });
    P.passoPartida(m, ent, null);
  }
  return hashMundo(m) >>> 0;
})();
async function hashNaPagina(pg) {
  return pg.evaluate(({ rot, sem, min }) => {
    const g = window.__golaco;
    g.pausar(true);
    g.reiniciar({ modo: 'partida', semente: sem, minutosPorTempo: min });
    let h = 0;
    for (let k = 0; k < rot.length; k += 100) h = g.rodarPassos(100, rot.slice(k, k + 100));
    g.pausar(false);
    return h >>> 0;
  }, { rot: rotH, sem: SEM_H, min: MIN_H });
}

const srv = await servidor(0, raiz);
const mp3 = [];
const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: 844, altura: 390, toque: true, dpr: 1 });
await contexto.addInitScript(grampo);
let prontoEm = 0;
contexto.on('request', r => { if (/\.mp3(\?|$)/.test(r.url())) mp3.push({ url: r.url().split('/').pop(), t: Date.now() }); });
contexto.on('requestfinished', async r => {
  if (!/\.mp3(\?|$)/.test(r.url())) return;
  try { const s = await r.sizes(); const e = mp3.find(x => r.url().endsWith(x.url) && x.bytes == null); if (e) e.bytes = s.responseBodySize; } catch (_) { /* sem tamanho */ }
});
try {
  await pg.goto(`${srv.url}?q=media&hora=dia&semente=3&demo=1&toque=1`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  prontoEm = Date.now();
  await pg.touchscreen.tap(422, 220);
  await pg.waitForFunction(() => window.__golaco.estadio.som?.estado === 'rodando', null, { timeout: 10000 }).catch(() => {});
  const est = await pg.evaluate(() => window.__golaco.estadio.som?.estado);
  const dt = await pg.evaluate(() => Math.round(window.__aud.tRodando - window.__aud.tGesto));
  meta('M1 o toque deixa o som rodando', `${est} em ${dt} ms`, "'rodando' em ≤ 1000 ms", est === 'rodando' && dt <= 1000);
  const tipo = await pg.evaluate(() => navigator.audioSession?.type);
  meta('M6 iPhone no silencioso: audioSession depois do toque', String(tipo), "'playback'", tipo === 'playback');
  await pg.waitForFunction(() => { const s = window.__golaco.estadio.som; return s.lacos.length >= 3 && s.decodificados.length >= 10; }, null, { timeout: 60000 }).catch(() => {});
  await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
  const am = await pg.evaluate(async SEG => {
    const g = window.__golaco, out = [];
    // SEG segundos de JOGO no ritmo do relógio de verdade; com a máquina carregada o jogo atrasa e o laço continua até
    // completar os SEG s de jogo (no máximo 4× o tempo), para a agenda dos cantos ter o mesmo tempo de jogo sempre
    const t0 = performance.now(); let sim = 0, prox = 0, q = 0, ultTocados = '', ultReacao = -1e9;
    while ((performance.now() - t0 < SEG * 1000 || sim < SEG * 1000) && performance.now() - t0 < 4 * SEG * 1000) {
      const real = performance.now() - t0;
      if (sim < real && sim < SEG * 1000) { const d = Math.min(100, real - sim, SEG * 1000 - sim); g.relogio.avancar(d, { desenhar: (q++ % 8) === 0 }); sim += d; }
      await new Promise(r => setTimeout(r, 1));
      const s = g.estadio.som, tt = JSON.stringify(s.tocados);
      if (tt !== ultTocados) { ultTocados = tt; ultReacao = real; }
      if (real >= prox) {
        prox = real + 400;
        out.push({ t: real, rms: window.__rms(), agito: g.estadio.emocao.agito, niveis: s.niveis, desdeReacao: real - ultReacao, est: g.estado().relogio?.estado, estado: s.estado, contexto: s.contexto });
      }
    }
    return out;
  }, SEG);
  const leito = am.filter(a => a.agito <= 0.3 && a.desdeReacao > 4000 && Number.isFinite(a.rms)).map(a => a.rms).sort((a, b) => a - b);
  const med = leito.length ? leito[Math.floor(leito.length / 2)] : NaN;
  meta('M2 leito da torcida (bola longe do gol)', `${f1(med)} dBFS (${leito.length} amostras de ${am.length})`, '≥ −22 dBFS', med >= -22);
  // apito de referência (uma falta)
  await pg.evaluate(() => window.__golaco.faltaDeTeste({ cartao: null }));
  const apito = await pg.evaluate(async () => { let m = -200; const t0 = performance.now(); while (performance.now() - t0 < 1500) { window.__golaco.relogio.avancar(16.7, { desenhar: false }); m = Math.max(m, window.__rms()); await new Promise(r => setTimeout(r, 30)); } return m; });
  meta('M3 apito − leito', `${f1(apito - med)} dB (apito ${f1(apito)} dBFS)`, '≤ 8 dB', apito - med <= 8);
  const jogo = am.filter(a => a.est === 'jogo' && a.niveis && a.niveis.ambiente > 0);
  const fr = jogo.filter(a => (a.niveis.canto ?? 0) >= 0.5 * a.niveis.ambiente).length / Math.max(1, jogo.length);
  const ex = jogo.slice(0, 3).map(a => `canto ${a.niveis.canto} / murmúrio ${a.niveis.ambiente}`).join('; ');
  meta('M4 canto audível no jogo', `${(100 * fr).toFixed(0)}% das ${jogo.length} amostras (${ex})`, '≥ 50%', fr >= 0.5);
  const som1 = await pg.evaluate(() => window.__golaco.estadio.som);
  const variados = [...som1.cantos, ...(som1.lacos.includes('batucada') ? ['batucada'] : [])];
  meta('M5 cantos e batucada diferentes em 60 s', `${variados.length} (${variados.join(', ')})`, '≥ 3', variados.length >= 3);
  // consistência do estado durante o jogo (nunca "rodando" com o contexto parado)
  const incoerente = am.filter(a => (a.estado === 'rodando') !== (a.contexto === 'running')).length;
  // M7 interrupção vinda de fora
  await pg.evaluate(() => window.__aud.ctx.suspend());
  await pg.waitForTimeout(500);
  const inter = await pg.evaluate(() => ({ ctx: window.__aud.ctx.state, som: window.__golaco.estadio.som.estado }));
  await pg.touchscreen.tap(300, 200);
  await pg.waitForTimeout(800);
  const volta = await pg.evaluate(() => ({ ctx: window.__aud.ctx.state, som: window.__golaco.estadio.som.estado }));
  meta('M7 interrupção + 1 toque: o som volta (e o estado diz a verdade)', `interrompido: contexto ${inter.ctx}, som ${inter.som} · depois de 1 toque: ${volta.ctx}, ${volta.som}; ${incoerente} amostra(s) incoerente(s) no jogo`,
    "suspenso/'suspenso' → running/'rodando'", inter.ctx !== 'running' && inter.som !== 'rodando' && volta.ctx === 'running' && volta.som === 'rodando' && incoerente === 0);
  // M8 memória e M9 download
  meta('M8 memória do áudio decodificado', `${som1.memoriaMiB} MiB (${som1.decodificados.length} gravações na memória; cantos sob demanda)`, '≤ 30 MiB', som1.memoriaMiB <= 30);
  const bytes = mp3.reduce((a, m) => a + (m.bytes ?? 0), 0);
  const antes = mp3.filter(m => m.t < prontoEm).length;
  meta('M9 sons baixados (depois da página abrir)', `${(bytes / 1e6).toFixed(2)} MB em ${mp3.length} arquivos; ${antes} antes da página pronta`, '≤ 1,5 MB e 0 antes', bytes <= 1.5e6 && antes === 0);
  // M10 pico na saída, com um gol roteirizado (o grito mais alto do jogo)
  await pg.evaluate(() => { window.__aud.pico = 0; });
  const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
  await pg.evaluate(async () => { const t0 = performance.now(); while (performance.now() - t0 < 3500) { window.__golaco.relogio.avancar(16.7, { desenhar: false }); window.__rms(); await new Promise(r => setTimeout(r, 20)); } });
  const pico = await pg.evaluate(() => window.__aud.pico);
  const picoDb = 20 * Math.log10(pico + 1e-12);
  meta('M10 pico na saída (limitador), com o grito de um gol', `${f1(picoDb)} dBFS${gol.ok ? '' : ' (o gol roteirizado não saiu)'}`, '≤ −1 dBFS', picoDb <= -1 && gol.ok);
  // M11 hash: som ligado (rodando agora)
  const hLigado = await hashNaPagina(pg);
  await pg.evaluate(() => window.__golaco.definirSom(false));
  await pg.waitForTimeout(400);
  const hDesligado = await hashNaPagina(pg);
  await pg.evaluate(() => window.__golaco.definirSom(true));
  meta('Sem erro no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
  // sem Web Audio (navegador antigo): outro navegador
  const b2 = await abrir({ largura: 844, altura: 390, toque: true, dpr: 1 });
  let hSemAudio = null, estSem = null;
  try {
    await b2.contexto.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
    await b2.pagina.goto(`${srv.url}?q=baixa&semente=3`, { waitUntil: 'load' });
    await b2.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
    estSem = await b2.pagina.evaluate(() => window.__golaco.estadio.som?.estado ?? 'sem som');
    hSemAudio = await hashNaPagina(b2.pagina);
  } catch (e) { estSem = 'erro: ' + e.message.slice(0, 80); } finally { await b2.navegador.close(); }
  const hx = h => (h == null ? '—' : (h >>> 0).toString(16).padStart(8, '0'));
  meta('M11 hash do mundo = Node com o som ligado, desligado e sem Web Audio', `Node ${hx(hashNode)} · ligado ${hx(hLigado)} · desligado ${hx(hDesligado)} · sem Web Audio ${hx(hSemAudio)} (${estSem})`,
    'os 4 iguais', hLigado === hashNode && hDesligado === hashNode && hSemAudio === hashNode);
} catch (e) {
  meta('Execução', e.message, 'sem exceção', false);
} finally { await navegador.close(); await srv.fechar(); }

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(`\n${res.filter(r => r.ok).length}/${res.length} metas`);
console.log(ok ? 'teste-som-jogo: PASSOU' : 'teste-som-jogo: REPROVOU');
process.exit(ok ? 0 : 1);
