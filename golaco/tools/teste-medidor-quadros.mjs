// O medidor do painel ?perf / ?qps (item 45, `golaco/PLANO-GRAFICOS.md` passo 6: D14 e N3; js/render/medidor-quadros.js, puro e
// sob demanda), sem navegador:
//  M1 N3: um rAF de 60 Hz que desenha 1 quadro em 2 (a tela antes do jogo: o main.js quadroPrepartida desenha a 30 qps pelo
//     instante do rAF) = 30 qps e o p50 33,3 ms; o refresh 60 Hz. O jeito de antes (o dt de 1 quadro do navegador somado por
//     desenho) daria 60 — a conta antiga é refeita aqui para provar que a régua separa as duas. Também 60 de 60, 72 de 144 (1 em 2),
//     e o rAF com tremor (o p50 do refresh fica no meio)
//  M2 p50, p95 e "pior 1%" (o p99) do anel = os de um oráculo independente (ordenar a lista dos últimos 240 intervalos), em 3
//     sorteios com pausas, também com o anel ainda incompleto; a CPU p50/p95 idem
//  M3 fases: o acumulado por fase (desenhos, qps médio, p50/p95/p99 do intervalo e a CPU p95) = o oráculo de cada fase dentro de
//     uma caixa do histograma (0,25 ms no intervalo, 0,1 ms na CPU); a fase do resumo é a do último desenho (ou a pedida); só as
//     fases com desenho aparecem; o rótulo de cada uma
//  M4 quebra: um intervalo > 1 s (a aba escondida, o celular em pé) não entra nas contas (os percentis e o qps não o veem), conta
//     em `quebras`, e o qps a mais de 1 s do último desenho é 0; o qps conta o tempo parado desde o último desenho
//  M5 o histograma: o percentil interpolado na caixa, o maior visto na última caixa, nada fora (NaN, negativo)
//  M6 o cronômetro da GPU (um contexto WebGL de mentira): sem a extensão, nada (disponível false, nenhuma consulta, resumo.gpu
//     null); com ela, o resultado chega quadros depois com a fase do quadro, o GPU_DISJOINT descarta, o quadro que não desenhou não
//     guarda, no máximo 4 consultas no ar (sem criar uma por quadro), o contexto trocado zera, o fechar com o contexto trocado não
//     quebra; o contexto RESTAURADO (o mesmo objeto: as consultas da geração perdida nunca respondem) volta a medir depois do
//     reiniciar() (a revisão do bloco 4: sem ele, 0 resultados em 200 quadros)
//  M7 o modo provável do AA (sem MSAA, SwiftShader, iPhone/Safari, Firefox, Android, Mac, Windows, o resto), o nome curto da GPU
//     (ANGLE do CI, Adreno, Mali, Apple, NVIDIA no Windows, vazio) e a leitura da GPU (o UNMASKED_RENDERER_WEBGL; o gl.RENDERER no
//     Firefox e sem a extensão)
//  M8 o texto do painel: o qps, p95, a fase, o AA, o buffer W×H, a GPU, o refresh em Hz (os mesmos padrões do teste-graficos-
//     pagina P2), o "—" do teto (C13), da queda (C12) e da GPU sem cronômetro; com eles, "1 a cada 2" e "Média → Baixa"; vírgula
//     decimal; o relatorio() serializa (JSON) e leva p95, fase, aa, buffer, gpu e refresh (o do rAF medido aqui em rafHz); o
//     refresh dito "rAF" (numa página lenta é o ritmo dela, não o da tela); as 7 fases com a GPU e os números grandes (a página
//     lenta do SwiftShader) em linhas ≤ 60 letras, e o percentil que cai na caixa de cima do histograma dito "> 51" / "> 128"
//     (a revisão do bloco 4)
//  M9 pureza e sob demanda: o módulo sem import, sem DOM, sem three e fora do fecho do hash; o main.js o importa só por import()
//     (nunca estático) e não soma mais o dt do rAF por desenho (o medirQps antigo saiu); o zerar()
// Sem o módulo REPROVA (o import dentro de try/catch vira REPROVOU, não exceção).
//   node tools/teste-medidor-quadros.mjs [--js <pasta js>]   (--js: mede outra cópia, ex.: a base)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ia = process.argv.indexOf('--js');
const JS = ia > 0 ? path.resolve(process.argv[ia + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const ARQ = path.join(JS, 'render', 'medidor-quadros.js');
let M = null, erroImport = null;
try { M = await import(pathToFileURL(ARQ).href); } catch (e) { erroImport = e.code ?? e.message.split('\n')[0]; }

const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : String(v));
const perto = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

// o oráculo: percentil interpolado de uma lista comum (ordenada à parte)
function oraculo(lista, p) {
  const a = lista.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return NaN;
  const x = p * (a.length - 1), i0 = Math.floor(x), i1 = Math.min(a.length - 1, i0 + 1);
  return a[i0] + (a[i1] - a[i0]) * (x - i0);
}
// sorteio determinístico (mulberry32)
function rng(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

if (!M) {
  for (const n of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9']) meta(`${n} (o módulo js/render/medidor-quadros.js)`, `não existe (${erroImport})`, 'o módulo', false);
} else {
  const { criarMedidor, criarHistograma, criarCronometroGpu, modoAA, nomeCurtoGpu, lerGpu, textoPainel, FASES, ROTULO_FASE, MEDIDOR } = M;

  // ---------------------------------------------------------------- M1: N3 (30 desenhos num rAF de 60 = 30)
  {
    /** Um rAF a `hz` por `s` segundos que desenha quando o desenho de quem chama aceita (tela: a cada ≥ 1000/30 − 4 ms). */
    const rodar = (hz, s, desenha, tremor = null) => {
      const med = criarMedidor();
      let t = 1000, ultimoDes = -1e9, antigoN = 0, antigoSoma = 0, dtAnt = null;
      const passo = 1000 / hz;
      for (let k = 0; k < hz * s; k++) {
        t += passo * (tremor ? tremor[k % tremor.length] : 1);
        med.raf(t);
        const dtReal = dtAnt == null ? passo : t - dtAnt;
        dtAnt = t;
        if (desenha(t, ultimoDes, k)) {
          ultimoDes = t;
          med.desenho(t, 2, 'tela');
          // (a conta de antes: o medirQps somava o dtReal — o intervalo do rAF — de cada quadro que desenhou)
          antigoN++; antigoSoma += dtReal / 1000;
        }
      }
      return { r: med.resumo(t), antigo: antigoN / antigoSoma };
    };
    const tela = (t, u) => t - u >= 1000 / 30 - 4;
    const a = rodar(60, 3, tela);
    meta('M1 N3: a tela antes do jogo (rAF 60 Hz, desenha a 30 qps pelo instante) = 30 qps, p50 33,3 ms, refresh 60 Hz; o jeito de antes daria 60',
      `qps ${f(a.r.qps, 1)} · p50 ${f(a.r.ms.p50, 1)} ms · refresh ${f(a.r.refresh.hz, 1)} Hz · o de antes ${f(a.antigo, 1)}`,
      '30 ± 0,5; 33,3 ± 0,2; 60 ± 0,5; o de antes 60 ± 1',
      perto(a.r.qps, 30, 0.5) && perto(a.r.ms.p50, 33.33, 0.2) && perto(a.r.refresh.hz, 60, 0.5) && perto(a.antigo, 60, 1));
    const b = rodar(60, 3, () => true), c = rodar(144, 3, (t, u, k) => k % 2 === 1);
    const d = rodar(60, 3, tela, [0.8, 1.2, 1.0, 0.9, 1.1]);
    meta('M1 outros ritmos: 60 de 60; 72 de 144 (1 em 2, refresh 144); o rAF com tremor ±20% (o refresh pela mediana)',
      `60 Hz todo quadro: ${f(b.r.qps, 1)} qps · 144 Hz 1 em 2: ${f(c.r.qps, 1)} qps, refresh ${f(c.r.refresh.hz, 1)} · tremor: ${f(d.r.qps, 1)} qps, refresh ${f(d.r.refresh.hz, 1)} Hz`,
      '60 ± 0,5; 72 ± 0,5 e 144 ± 1; o qps 25–35 e o refresh 60 ± 3',
      perto(b.r.qps, 60, 0.5) && perto(c.r.qps, 72, 0.5) && perto(c.r.refresh.hz, 144, 1) && d.r.qps >= 25 && d.r.qps <= 35 && perto(d.r.refresh.hz, 60, 3));
  }

  // ---------------------------------------------------------------- M2: p50, p95 e pior 1% do anel = o oráculo
  {
    let ruins = [], casos = 0;
    for (const semente of [1, 2, 3]) {
      for (const total of [37, 240, 900]) {
        const r = rng(semente * 1000 + total), med = criarMedidor();
        let t = 0;
        const ivs = [], cpus = [];
        for (let k = 0; k < total; k++) {
          // intervalos de 8 a 40 ms com uns picos de 60–200 ms (nunca uma quebra: ≤ 1 s)
          const iv = r() < 0.04 ? 60 + r() * 140 : 8 + r() * 32;
          t += iv;
          const cpu = 1 + r() * 6 + (r() < 0.03 ? 20 : 0);
          med.desenho(t, cpu, 'jogo');
          if (k > 0) ivs.push(iv);
          cpus.push(cpu);
        }
        const s = med.resumo(t);
        const ultimos = ivs.slice(-(MEDIDOR.anel - 1)), cpuU = cpus.slice(-MEDIDOR.anel);
        // (o anel guarda os últimos 240 DESENHOS: com o anel cheio, os 240 intervalos que chegaram a eles — o do mais velho
        // também, se ele não foi o 1º desenho)
        const ivAnel = total > MEDIDOR.anel ? ivs.slice(-MEDIDOR.anel) : ultimos;
        const exp = { p50: oraculo(ivAnel, 0.5), p95: oraculo(ivAnel, 0.95), pior1: oraculo(ivAnel, 0.99), c50: oraculo(cpuU, 0.5), c95: oraculo(cpuU, 0.95) };
        casos++;
        // (o resumo arredonda a 0,1 ms no intervalo e a 0,01 na CPU)
        if (!perto(s.ms.p50, exp.p50, 0.051) || !perto(s.ms.p95, exp.p95, 0.051) || !perto(s.ms.pior1, exp.pior1, 0.051) || !perto(s.cpu.p50, exp.c50, 0.006) || !perto(s.cpu.p95, exp.c95, 0.006)) {
          ruins.push(`semente ${semente}, ${total} desenhos: p95 ${f(s.ms.p95)} × ${f(exp.p95)}, p99 ${f(s.ms.pior1)} × ${f(exp.pior1)}, CPU p95 ${f(s.cpu.p95)} × ${f(exp.c95)}`);
        }
      }
    }
    meta('M2 o anel (os últimos 240 desenhos): p50, p95, pior 1% (p99) do intervalo e a CPU p50/p95 = o oráculo (ordenar a lista), anel cheio e incompleto',
      ruins.length ? ruins.slice(0, 2).join(' | ') : `${casos} de ${casos} iguais`, 'todos iguais (± o arredondamento)', !ruins.length);
  }

  // ---------------------------------------------------------------- M3: o acumulado por fase
  {
    const r = rng(77), med = criarMedidor();
    const por = {}, cpuPor = {};
    let t = 0, faseAnt = null;
    const roteiro = [['tela', 300, 33.3], ['prejogo', 200, 16.7], ['jogo', 1200, 16.7], ['pausa', 150, 16.7], ['replay', 400, 16.7], ['comemoracao', 300, 16.7], ['cena', 200, 20], ['jogo', 600, 16.7]];
    for (const [fase, n, base] of roteiro) {
      for (let k = 0; k < n; k++) {
        const iv = base * (0.85 + 0.3 * r()) + (r() < 0.02 ? 30 : 0);
        t += iv;
        const cpu = 2 + 4 * r();
        med.desenho(t, cpu, fase);
        if (faseAnt !== null) (por[fase] ??= []).push(iv);
        (cpuPor[fase] ??= []).push(cpu);
        faseAnt = fase;
      }
    }
    const s = med.resumo(t);
    const ruins = [];
    for (const fase of Object.keys(cpuPor)) {
      const a = s.fases[fase], ivs = por[fase] ?? [];
      const exp = { n: cpuPor[fase].length, qps: (ivs.length * 1000) / ivs.reduce((x, y) => x + y, 0), p50: oraculo(ivs, 0.5), p95: oraculo(ivs, 0.95), p99: oraculo(ivs, 0.99), c95: oraculo(cpuPor[fase], 0.95) };
      if (!a || a.desenhos !== exp.n || !perto(a.qps, exp.qps, 0.06) || !perto(a.p50, exp.p50, 0.3) || !perto(a.p95, exp.p95, 0.3) || !perto(a.pior1, exp.p99, 0.3) || !perto(a.cpuP95, exp.c95, 0.11)) {
        ruins.push(`${fase}: ${a ? `${a.desenhos} desenhos, qps ${f(a.qps, 1)}, p95 ${f(a.p95)} × ${f(exp.p95)}, p99 ${f(a.pior1)} × ${f(exp.p99)}, CPU ${f(a.cpuP95)} × ${f(exp.c95)}` : 'faltou'}`);
      }
    }
    const fasesVistas = Object.keys(s.fases);
    const ordem = fasesVistas.every((x, k) => k === 0 || FASES.indexOf(fasesVistas[k - 1]) < FASES.indexOf(x));
    const s2 = med.resumo(t, 'pausa');
    meta('M3 o acumulado de cada fase (desenhos, qps médio, p50/p95/p99, CPU p95) = o oráculo dentro de uma caixa do histograma; as 7 fases na ordem do painel',
      ruins.length ? ruins.slice(0, 2).join(' | ') : `${fasesVistas.length} fases iguais (${fasesVistas.join(', ')}); jogo ${s.fases.jogo.desenhos} desenhos, p95 ${f(s.fases.jogo.p95)}`,
      'todas iguais; 7 fases na ordem', !ruins.length && fasesVistas.length === 7 && ordem && FASES.length === 7);
    const so = criarMedidor();
    so.desenho(0, 1, 'jogo'); so.desenho(16.7, 1, 'jogo');
    meta('M3 a fase do resumo: a do último desenho (ou a pedida); só as fases com desenho; os rótulos',
      `último: ${s.fase} (${s.faseRotulo}) · pedida: ${s2.fase} (${s2.faseRotulo}) · só jogo: ${Object.keys(so.resumo(16.7).fases).join(', ')} · tela = "${ROTULO_FASE.tela}", comemoracao = "${ROTULO_FASE.comemoracao}", prejogo = "${ROTULO_FASE.prejogo}"`,
      'jogo; pausa; jogo; "tela antes do jogo", "comemoração", "pré-jogo"',
      s.fase === 'jogo' && s.faseRotulo === 'jogo' && s2.fase === 'pausa' && s2.faseRotulo === 'pausa' && Object.keys(so.resumo(16.7).fases).join() === 'jogo'
      && ROTULO_FASE.tela === 'tela antes do jogo' && ROTULO_FASE.comemoracao === 'comemoração' && ROTULO_FASE.prejogo === 'pré-jogo');
  }

  // ---------------------------------------------------------------- M4: a quebra e o tempo parado
  {
    const med = criarMedidor();
    let t = 0;
    for (let k = 0; k < 120; k++) { t += 16.667; med.desenho(t, 3, 'jogo'); }
    const antes = med.resumo(t);
    const qpsParado = med.qps(t + 500), qpsLonge = med.qps(t + 1500);
    t += 5000; // a aba escondida 5 s
    med.desenho(t, 3, 'jogo');
    for (let k = 0; k < 30; k++) { t += 33.333; med.desenho(t, 3, 'jogo'); }
    const depois = med.resumo(t);
    meta('M4 a quebra (5 s sem desenho): fora dos percentis e do qps, conta em quebras; o qps conta o tempo parado (0,5 s depois) e é 0 a mais de 1 s',
      `antes: ${f(antes.qps, 1)} qps · parado 0,5 s: ${f(qpsParado, 1)} · 1,5 s: ${f(qpsLonge, 1)} · depois: ${f(depois.qps, 1)} qps, pior 1% ${f(depois.ms.pior1, 1)} ms, p95 ${f(depois.ms.p95, 1)}, quebras ${depois.quebras}, fase jogo p95 ${f(depois.fases.jogo.pior1, 1)}`,
      '60; ~30 (30 desenhos no último 1 s: 29–31); 0; 30; pior 1% ≤ 34; 1 quebra; o acumulado sem os 5 s',
      perto(antes.qps, 60, 0.5) && qpsParado >= 29 && qpsParado <= 31 && qpsLonge === 0 && perto(depois.qps, 30, 0.5) && depois.ms.pior1 <= 34 && depois.quebras === 1 && depois.fases.jogo.pior1 <= 34);
    const um = criarMedidor();
    um.desenho(0, 1, 'jogo');
    meta('M4 com 1 desenho só: o qps e os percentis ficam "—" (NaN/null), sem erro', `qps ${um.resumo(0).qps} · p95 ${um.resumo(0).ms.p95}`, 'null; null', um.resumo(0).qps === null && um.resumo(0).ms.p95 === null);
  }

  // ---------------------------------------------------------------- M5: o histograma
  {
    const h = criarHistograma(0.25, 8); // até 2 ms
    const vals = [0.1, 0.3, 0.3, 0.6, 1.2, NaN, -1, 7.5];
    for (const v of vals) h.add(v);
    const bons = vals.filter(v => Number.isFinite(v) && v >= 0);
    const p0 = h.percentil(0), p50 = h.percentil(0.5), p100 = h.percentil(1), vazio = criarHistograma(1).percentil(0.5);
    const o0 = oraculo(bons, 0), o50 = oraculo(bons, 0.5);
    meta('M5 o histograma: n sem NaN e negativo; o percentil pela definição do percentil() (o oráculo) dentro de uma caixa; na última caixa, o maior visto (7,5)',
      `n ${h.n} · max ${h.max} · p0 ${f(p0)} (oráculo ${f(o0)}) · p50 ${f(p50)} (oráculo ${f(o50)}) · p100 ${f(p100)} · vazio ${vazio}`,
      'n 6; max 7,5; p0 e p50 a ≤ 0,25 do oráculo; p100 7,5; vazio NaN',
      h.n === 6 && h.max === 7.5 && perto(p0, o0, 0.25) && perto(p50, o50, 0.25) && p100 === 7.5 && Number.isNaN(vazio));
  }

  // ---------------------------------------------------------------- M6: o cronômetro da GPU (um contexto de mentira)
  {
    const glFalso = ({ ext = true, perdido = false } = {}) => {
      const g = {
        RENDERER: 0x1f01, QUERY_RESULT: 0x8866, QUERY_RESULT_AVAILABLE: 0x8867,
        criadas: 0, abertas: 0, fila: [], disjunto: false, perdido,
        isContextLost() { return this.perdido; },
        getExtension(n) { return n === 'EXT_disjoint_timer_query_webgl2' && ext ? { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb } : null; },
        createQuery() { this.criadas++; return { id: this.criadas, pronto: -1, ns: 0 }; },
        beginQuery(alvo, q) { if (this.abertas) throw new Error('consulta aninhada'); this.abertas++; this.atual = q; },
        endQuery() { if (!this.abertas) throw new Error('endQuery sem begin'); this.abertas--; this.fila.push(this.atual); this.atual = null; },
        getParameter(p) { return p === 0x8fbb ? this.disjunto : 'GPU'; },
        getQueryParameter(q, p) { return p === this.QUERY_RESULT_AVAILABLE ? q.pronto >= 0 : q.ns; },
        // a GPU "termina" as consultas da fila com `ms` cada
        terminar(ms) { for (const q of this.fila) { q.pronto = 1; q.ns = ms * 1e6; } this.fila = []; },
      };
      return g;
    };
    // sem a extensão
    const g0 = glFalso({ ext: false });
    const c0 = criarCronometroGpu(() => g0), m0 = criarMedidor();
    for (let k = 0; k < 10; k++) { c0.antes(); c0.depois(true, 'jogo'); c0.colher((ms, fz) => m0.gpu(ms, fz)); m0.desenho(k * 16.7, 1, 'jogo'); }
    meta('M6 sem o EXT_disjoint_timer_query_webgl2: nada (disponível false, nenhuma consulta, gpu null no resumo e "—" no painel)',
      `disponível ${c0.disponivel} · consultas ${g0.criadas} · gpu ${JSON.stringify(m0.resumo(167).gpu)}`, 'false; 0; null',
      c0.disponivel === false && g0.criadas === 0 && m0.resumo(167).gpu === null);
    // com a extensão: o resultado chega 2 quadros depois
    const g = glFalso();
    let gl = g;
    const c = criarCronometroGpu(() => gl), m = criarMedidor();
    const colhidos = [];
    const fases = ['jogo', 'jogo', 'replay', 'replay', 'jogo', 'jogo', 'jogo', 'jogo'];
    for (let k = 0; k < fases.length; k++) {
      c.antes(); c.depois(k !== 3, fases[k]);
      if (k >= 2) g.terminar(4 + k);
      c.colher((ms, fz) => { colhidos.push([ms, fz]); m.gpu(ms, fz); });
    }
    g.terminar(20);
    c.colher((ms, fz) => { colhidos.push([ms, fz]); m.gpu(ms, fz); });
    const fasesOk = colhidos.every(([ms, fz]) => typeof fz === 'string');
    meta('M6 com a extensão: os resultados chegam depois com a fase de cada quadro; o quadro que não desenhou não guarda; nada aninhado',
      `${colhidos.length} resultados (de ${fases.length} quadros, 1 sem desenho): ${colhidos.map(([ms, fz]) => `${ms} ${fz}`).join(', ')} · consultas criadas ${g.criadas}`,
      '7 resultados, as fases dos quadros, ≤ 4 consultas criadas',
      colhidos.length === 7 && fasesOk && colhidos[0][1] === 'jogo' && colhidos.some(([, fz]) => fz === 'replay') && g.criadas <= MEDIDOR.gpuVoando);
    // o disjunto descarta; no máximo 4 no ar
    const g2 = glFalso();
    const c2 = criarCronometroGpu(() => g2);
    for (let k = 0; k < 10; k++) { c2.antes(); c2.depois(true, 'jogo'); }
    const noAr = g2.fila.length;
    g2.disjunto = true; g2.terminar(5);
    let n2 = 0;
    c2.colher(() => { n2++; });
    g2.disjunto = false;
    c2.antes(); c2.depois(true, 'jogo'); g2.terminar(5);
    let n3 = 0;
    c2.colher(() => { n3++; });
    meta('M6 o GPU_DISJOINT descarta os resultados; no máximo 4 consultas no ar (10 quadros sem a GPU responder = 4 consultas)',
      `no ar ${noAr} · com o disjunto ${n2} colhidos · depois ${n3} · criadas ${g2.criadas}`, '4; 0; 1; 4', noAr === MEDIDOR.gpuVoando && n2 === 0 && n3 === 1 && g2.criadas === MEDIDOR.gpuVoando);
    // o contexto trocado (a recriação da qualidade) no meio do quadro e entre quadros
    const ga = glFalso(), gb = glFalso();
    let atual = ga;
    const c3 = criarCronometroGpu(() => atual);
    c3.antes(); c3.depois(true, 'jogo');
    c3.antes(); atual = gb; c3.depois(true, 'jogo'); // (trocou no meio: fecha no velho, descarta)
    ga.terminar(3);
    let n4 = 0;
    c3.colher(() => { n4++; });
    c3.antes(); c3.depois(true, 'jogo'); gb.terminar(6);
    const col = [];
    c3.colher(ms => col.push(ms));
    const perdido = glFalso({ perdido: true }), c4 = criarCronometroGpu(() => perdido);
    c4.antes(); c4.depois(true, 'jogo');
    meta('M6 o contexto trocado no meio do quadro fecha no velho e descarta; o novo começa limpo; o contexto perdido não abre consulta',
      `velho: abertas ${ga.abertas}, colhidos ${n4} · novo: ${col.join(', ')} · perdido: ${perdido.criadas} consultas`, '0; 0; 6; 0',
      ga.abertas === 0 && n4 === 0 && col.length === 1 && col[0] === 6 && perdido.criadas === 0 && gb.abertas === 0);
    // o contexto RESTAURADO (a revisão do bloco 4): o mesmo objeto; as consultas da geração perdida nunca respondem
    const gR = glFalso(), cR = criarCronometroGpu(() => gR);
    let antesPerda = 0;
    for (let k = 0; k < 20; k++) { cR.antes(); cR.depois(true, 'jogo'); gR.terminar(5); cR.colher(() => { antesPerda++; }); }
    cR.antes(); cR.depois(true, 'jogo'); cR.antes(); cR.depois(true, 'jogo'); // (2 no ar quando o contexto se perde)
    gR.perdido = true;
    for (let k = 0; k < 5; k++) { cR.antes(); cR.depois(true, 'jogo'); cR.colher(() => {}); }
    gR.perdido = false; gR.fila = []; // (restaurado: as consultas velhas nunca ficam prontas)
    const depoisSem = (() => { let n = 0; for (let k = 0; k < 200; k++) { cR.antes(); cR.depois(true, 'jogo'); gR.terminar(5); cR.colher(() => { n++; }); } return n; })();
    const temReiniciar = typeof cR.reiniciar === 'function';
    if (temReiniciar) cR.reiniciar();
    const depoisCom = (() => { let n = 0; for (let k = 0; k < 20; k++) { cR.antes(); cR.depois(true, 'jogo'); gR.terminar(5); cR.colher(() => { n++; }); } return n; })();
    meta('M6 o contexto RESTAURADO (o mesmo objeto, as consultas velhas nunca respondem): volta a medir depois do reiniciar() (o gancho do main.js)',
      `antes da perda ${antesPerda} em 20 · restaurado sem reiniciar ${depoisSem} em 200 · ${temReiniciar ? `com o reiniciar() ${depoisCom} em 20` : 'sem o reiniciar()'}`,
      '20; (informativo); ≥ 15 em 20', antesPerda === 20 && temReiniciar && depoisCom >= 15);
    // o SwiftShader do CI: a extensão existe e toda consulta devolve 2^63 ns — lixo, descartado e contado
    const gl5 = glFalso(), c5 = criarCronometroGpu(() => gl5);
    let n5 = 0;
    for (let k = 0; k < 6; k++) { c5.antes(); c5.depois(true, 'jogo'); for (const q of gl5.fila) { q.pronto = 1; q.ns = 2n ** 63n - 1n; } gl5.fila = []; c5.colher(() => { n5++; }); }
    c5.antes(); c5.depois(true, 'jogo'); gl5.terminar(0); c5.colher(() => { n5++; });
    const t5 = textoPainel(criarMedidor().relatorio(0, { gpu: { nome: 'x', timer: true, invalidos: c5.invalidos } }));
    meta('M6 o resultado fora de (0; 1000 ms] é lixo (o SwiftShader do CI: 2^63 ns; e o 0): descartado, contado, e o painel diz',
      `colhidos ${n5} · inválidos ${c5.invalidos} · "${t5.split('\n')[1]}"`, '0; 7; "GPU p95 — (o cronômetro devolve lixo)"',
      n5 === 0 && c5.invalidos === 7 && /GPU p95 — \(o cronômetro devolve lixo\)/.test(t5));
    const r = m.resumo(100);
    meta('M6 o resumo com a GPU: p50/p95 do anel e o acumulado da fase', `gpu ${JSON.stringify(r.gpu)} · jogo GPU p95 ${r.fases.jogo?.gpuP95} · replay ${r.fases.replay?.gpuP95}`,
      'p95 > 0 e as duas fases', r.gpu && r.gpu.p95 > 0 && r.fases.jogo?.gpuP95 > 0 && r.fases.replay?.gpuP95 > 0);
  }

  // ---------------------------------------------------------------- M7: o modo do AA, o nome da GPU
  {
    const ANGLE_CI = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
    const UA = {
      android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
      iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1',
      macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      firefox: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
      linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
    };
    const casos = [
      [{ antialias: false, amostras: 0, gpu: ANGLE_CI, ua: UA.linux }, /sem MSAA/],
      [{ antialias: true, amostras: 0, gpu: 'Adreno', ua: UA.android }, /sem MSAA/],
      [{ antialias: true, amostras: 4, gpu: ANGLE_CI, ua: UA.linux }, /implícito emulado/],
      [{ antialias: true, amostras: 4, gpu: 'Apple GPU', ua: UA.iphone }, /separado \(Safari\)/],
      [{ antialias: true, amostras: 4, gpu: 'Apple GPU', ua: UA.iphoneChrome }, /separado \(Safari\)/],
      [{ antialias: true, amostras: 4, gpu: 'Apple M1', ua: UA.macSafari }, /separado \(Safari\)/],
      [{ antialias: true, amostras: 4, gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', ua: UA.macChrome }, /separado \(Graphite, Mac\)/],
      [{ antialias: true, amostras: 4, gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)', ua: UA.win }, /separado \(Graphite, Windows\)/],
      [{ antialias: true, amostras: 4, gpu: 'ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)', ua: UA.android }, /implícito \(Ganesh\)/],
      [{ antialias: true, amostras: 4, gpu: 'Mali-G78', ua: UA.firefox }, /não deduzido \(Firefox\)/],
      [{ antialias: true, amostras: 4, gpu: 'Mesa Intel UHD', ua: UA.linux }, /^não deduzido$/],
    ];
    const ruins = casos.filter(([e, re]) => !re.test(modoAA(e))).map(([e]) => `${e.gpu.slice(0, 20)}/${e.ua.slice(13, 30)} → ${modoAA(e)}`);
    meta('M7 o modo provável do MSAA (sem MSAA, SwiftShader, iPhone/Safari, Mac e Windows com o Graphite, Android com o Ganesh, Firefox, o resto)',
      ruins.length ? ruins.join(' | ') : `${casos.length} de ${casos.length}`, 'todos', !ruins.length);
    const nomes = [
      [ANGLE_CI, 'Vulkan 1.3.0 (SwiftShader Device (Subzero))'],
      ['ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)', 'Adreno 650'],
      ['Mali-G78 MC14', 'Mali-G78 MC14'],
      ['Apple GPU', 'Apple GPU'],
      ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'NVIDIA GeForce RTX 3060'],
      ['', '—'],
    ];
    const longo = nomeCurtoGpu('x'.repeat(80));
    const rn = nomes.filter(([e, s]) => nomeCurtoGpu(e) !== s).map(([e, s]) => `"${e.slice(0, 30)}" → "${nomeCurtoGpu(e)}" (esperado "${s}")`);
    meta('M7 o nome curto da GPU (o renderizador do ANGLE sem ids, o Direct3D e os (TM); ≤ 48 letras com "…")',
      rn.length ? rn.join(' | ') : `${nomes.length} de ${nomes.length}; o longo com ${longo.length} letras`, 'todos; 48', !rn.length && longo.length === MEDIDOR.gpuMaxNome && longo.endsWith('…'));
    const glDbg = ext => ({ RENDERER: 0x1f01, getExtension: n => (n === 'WEBGL_debug_renderer_info' && ext ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null), getParameter: p => (p === 0x9246 ? 'NÃO MASCARADO' : p === 0x1f01 ? 'COMUM' : null) });
    const lidos = [lerGpu(glDbg(true), UA.android), lerGpu(glDbg(true), UA.firefox), lerGpu(glDbg(false), UA.android), lerGpu(null, UA.android)];
    meta('M7 a GPU lida: o UNMASKED_RENDERER_WEBGL; no Firefox e sem a extensão, o gl.RENDERER; sem contexto, vazio',
      lidos.map(s => `"${s}"`).join(', '), '"NÃO MASCARADO", "COMUM", "COMUM", ""', lidos.join('|') === 'NÃO MASCARADO|COMUM|COMUM|');
  }

  // ---------------------------------------------------------------- M8: o texto do painel e o relatorio
  {
    const med = criarMedidor();
    let t = 1000;
    for (let k = 0; k < 200; k++) { t += 16.667; med.raf(t); if (k % 2) med.desenho(t, 3.25, 'tela'); }
    const info = {
      chamadas: 31, triangulos: 92044, qualidade: { escolha: 'auto', atual: 'media' },
      aa: { pedido: true, antialias: true, amostras: 4 }, buffer: { w: 1266, h: 585, pixelRatio: 1.5, tetoTablet: false },
      gpu: { nome: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', timer: false },
      ua: 'HeadlessChrome/141', teto: null, queda: { sessao: null, gravada: null },
    };
    const rel = med.relatorio(t, info, 'tela');
    const txt = textoPainel(rel), linha = txt.replace(/\s+/g, ' ');
    // (os padrões da P2 do teste-graficos-pagina)
    const falta = [['p95', /p95/i], ['fase', /fase|tela|jogo|replay|pausa|pré-jogo|cena/i], ['AA', /\bAA\b|MSAA|SAMPLES|amostras/i], ['buffer', /\d+\s*[×x]\s*\d+/], ['GPU', /SwiftShader|ANGLE|GPU|Mali|Adreno|Apple/i], ['refresh', /Hz/i]].filter(([, re]) => !re.test(linha)).map(([k]) => k);
    const qps = (txt.match(/(\d+(?:[.,]\d+)?)\s*qps/i) || [])[1];
    meta('M8 o texto: o qps primeiro, p95, a fase, o AA (MSAA 4×, SAMPLES, o modo), o buffer 1266×585, a GPU, o refresh em Hz; vírgula decimal',
      `"${linha.slice(0, 150)}…"${falta.length ? ` · falta: ${falta.join(', ')}` : ''}`, `tudo; o qps 30; "MSAA 4×"; "1266×585"; "pr 1,50"; "60 Hz"; "fase tela antes do jogo"; cada linha ≤ 60 letras (o 568×320)`,
      !falta.length && +qps === 30 && /MSAA 4×/.test(txt) && /1266×585/.test(txt) && /pr 1,50/.test(txt) && /60 Hz/.test(txt) && /fase tela antes do jogo/.test(txt) && /SwiftShader/.test(txt) && /implícito emulado/.test(txt)
      && txt.split('\n').every(l => l.length <= 60));
    meta('M8 os campos dos outros passos com "—": o teto (C13), a queda (C12), a GPU sem cronômetro',
      txt.split('\n').filter(l => /teto|queda|GPU p95/.test(l)).join(' | '), '"teto —", "sessão — · gravada —", "GPU p95 —"',
      /teto —/.test(txt) && /sessão — · gravada —/.test(txt) && /GPU p95 —/.test(txt));
    const rel2 = med.relatorio(t, { ...info, teto: 2, refreshHz: 120, queda: { sessao: { de: 'media', para: 'baixa' }, gravada: { de: 'media', para: 'baixa' } }, buffer: { ...info.buffer, tetoTablet: true }, aa: { pedido: false, antialias: false, amostras: 0 }, qualidade: { escolha: 'media', atual: 'media' } }, 'jogo');
    const txt2 = textoPainel(rel2);
    meta('M8 com eles: "1 a cada 2", o refresh do ritmo (120 Hz) por cima do medido, "Média → Baixa" nas duas quedas, o teto dos tablets, "AA não", a qualidade fixa sem o "agora"',
      txt2.split('\n').filter(l => /teto|queda|AA|buffer|qualidade/.test(l)).join(' | '),
      'tudo ao lado', /rAF 120 Hz · teto 1 a cada 2/.test(txt2) && /sessão Média → Baixa · gravada Média → Baixa/.test(txt2) && /teto dos tablets/.test(txt2) && /AA não/.test(txt2) && /qualidade Média · buffer/.test(txt2));
    let json = null;
    try { json = JSON.parse(JSON.stringify(rel)); } catch (_) { json = null; }
    const chaves = json ? JSON.stringify(json).toLowerCase() : '';
    meta('M8 o relatorio() (o __golaco.perf()) serializa e leva p95, fase, aa, buffer, gpu e refresh (as chaves da P2), o acumulado da fase',
      json ? `chaves: ${Object.keys(json).join(', ')} · fases: ${Object.keys(json.fases).join(', ')}` : 'não serializa',
      'tudo', !!json && ['p95', 'fase', 'aa', 'buffer', 'gpu', 'refresh'].every(k => chaves.includes(k)) && json.fase === 'tela' && json.fases.tela?.desenhos === 100 && json.aa.modo && json.gpu.curto && json.refresh.teto === null);
    meta('M8 o refresh do rAF medido aqui fica em rafHz (o do ritmo do C13 passa por cima no hz); o texto diz "rAF", não "tela"',
      `hz ${rel2.refresh.hz} · rafHz ${rel2.refresh.rafHz} · "${txt2.split('\n').find(l => /Hz/.test(l))}"`, 'hz 120; rafHz 60; "rAF 120 Hz"',
      rel2.refresh.hz === 120 && Math.abs(rel2.refresh.rafHz - 60) <= 1 && /^rAF 120 Hz/m.test(txt2) && !/^tela \d/m.test(txt2));
    // a página lenta (o SwiftShader com o render de verdade, a 120 Hz): as 7 fases, a GPU, os números grandes; o percentil acima do
    // teto do histograma (51,2 ms na CPU e na GPU, 128 no intervalo) dito "> 51" / "> 128", nunca o maior visto (39651,3)
    const lento = criarMedidor();
    let tl = 0;
    const fasesL = ['jogo', 'replay', 'comemoracao', 'cena', 'prejogo', 'tela', 'pausa'];
    for (let k = 0; k < 700; k++) {
      tl += k % 7 === 0 ? 799.9 : 333.3;
      lento.raf(tl);
      const fz = fasesL[k % 7];
      lento.desenho(tl, k % 5 === 0 ? 39651.3 : 348.4, fz);
      lento.gpu(k % 3 === 0 ? 582.1 : 99.9, fz);
    }
    const relL = lento.relatorio(tl, { ...info, chamadas: 9999, triangulos: 1234567, gpu: { nome: 'ANGLE (Qualcomm, Adreno (TM) 740 OpenGL ES 3.2 V@0615.0 (GIT@1c8bd5b, I6ba4eb47d4, 1699971547) (Date:11/14/23), OpenGL ES 3.2)', timer: true },
      qualidade: { escolha: 'auto', atual: 'baixa' }, teto: 2, refreshHz: 119.5, queda: { sessao: { de: 'media', para: 'baixa' }, gravada: { de: 'media', para: 'baixa' } } }, 'comemoracao');
    const txtL = textoPainel(relL), linhasL = txtL.split('\n');
    const maior = linhasL.reduce((a, l) => (l.length > a.length ? l : a), '');
    const porFase = linhasL.filter(l => /^ \S.*qps/.test(l));
    meta('M8 a página lenta (7 fases, a GPU, números grandes): cada linha ≤ 60 letras; nas fases, a CPU e a GPU acima do teto do histograma ditas "> 51", nunca o maior visto',
      `${linhasL.length} linhas, a maior ${maior.length} letras ("${maior}") · ${porFase.length} linhas de fase · "${porFase.find(l => /comemor/.test(l)) ?? ''}"`,
      '≤ 60 em todas; 7 de fase; "> 51"; sem 39651',
      linhasL.every(l => l.length <= 60) && porFase.length === 7 && porFase.every(l => /CPU > 51/.test(l) && /GPU > 51/.test(l) && !/39651/.test(l)));
  }

  // ---------------------------------------------------------------- M9: pureza e sob demanda; zerar
  {
    const fonte = fs.readFileSync(ARQ, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const importa = /\bimport\b/.test(fonte), dom = /\b(document|window|THREE|three|navigator|performance|requestAnimationFrame)\b/.test(fonte);
    let noFecho = null;
    const fh = path.join(JS, '..', 'tools', 'fecho-hash.mjs');
    if (fs.existsSync(fh)) noFecho = /medidor-quadros\.js/.test(execFileSync(process.execPath, [fh], { encoding: 'utf8' }));
    const main = fs.readFileSync(path.join(JS, 'main.js'), 'utf8');
    const estatico = /^\s*import\s[^;]*medidor-quadros/m.test(main), dinamico = /import\(\s*['"]\.\/render\/medidor-quadros\.js['"]\s*\)/.test(main);
    // (o medirQps de antes somava o dtReal do rAF por desenho: N3)
    const antigo = /medirQps\s*\(\s*dtReal/.test(main);
    meta('M9 pureza e sob demanda: o módulo sem import, DOM, three nem relógio próprio e fora do fecho do hash; o main.js só por import() e sem o medirQps(dtReal) de antes',
      `import ${importa ? 'SIM' : 'nenhum'}; DOM/three/relógio ${dom ? 'SIM' : 'não'}; no fecho ${noFecho === null ? '(sem a ferramenta)' : noFecho ? 'SIM' : 'não'}; main.js: estático ${estatico ? 'SIM' : 'não'}, import() ${dinamico ? 'sim' : 'NÃO'}, medirQps(dtReal) ${antigo ? 'SIM' : 'não'}`,
      'nenhum; não; não; não, sim, não', !importa && !dom && noFecho === false && !estatico && dinamico && !antigo);
    const med = criarMedidor();
    for (let k = 0; k < 50; k++) { med.raf(k * 16.7); med.desenho(k * 16.7, 2, 'jogo'); med.gpu(1, 'jogo'); }
    med.zerar();
    const z = med.resumo(0);
    meta('M9 o zerar() limpa tudo (anel, fases, GPU, refresh, quebras)', JSON.stringify({ d: z.desenhos, f: Object.keys(z.fases).length, g: z.gpu, r: z.refresh.hz, q: z.quebras }), '{d: 0, f: 0, g: null, r: null, q: 0}',
      z.desenhos === 0 && Object.keys(z.fases).length === 0 && z.gpu === null && z.refresh.hz === null && z.quebras === 0);
  }
}

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-medidor-quadros: PASSOU' : '\nteste-medidor-quadros: REPROVOU');
process.exit(ok ? 0 : 1);
