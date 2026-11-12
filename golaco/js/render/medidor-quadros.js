// O medidor dos quadros do painel ?perf / ?qps (item 45, `golaco/PLANO-GRAFICOS.md` passo 6: D14 e N3; contrato no PR). PURO —
// sem three.js nem DOM (o contexto WebGL só chega por parâmetro, no nome da GPU e no cronômetro dela) — e SOB DEMANDA: o main.js
// só o importa com o painel à vista (F3, ?qps=1 ou ?perf=1), nunca no download inicial nem na pré-carga ociosa (o
// tools/teste-carga.mjs, a lista "só com o painel").
//
// O que mede:
//  - os intervalos entre DESENHOS: o instante do rAF de cada quadro que desenhou o 3D, não o de todo quadro do navegador. A tela
//    antes do jogo desenha 30 por segundo num rAF de 60, e o painel de antes somava o dt de 1 quadro do navegador por desenho:
//    mostrava 60 (N3). O intervalo maior que MEDIDOR.quebra (a aba escondida, o celular em pé, a carga) não entra nas contas:
//    começa outra série;
//  - a CPU do quadro: o quadro() inteiro no fio principal (a simulação, o JS do desenho e o HUD), só nos quadros que desenharam;
//  - o tempo de GPU, só com o EXT_disjoint_timer_query_webgl2 (0,43% dos Android e 0,22% dos iOS: web3dsurvey); sem ele, null
//    ("—" no painel);
//  - o refresh da tela: a mediana dos últimos MEDIDOR.refreshN intervalos do rAF (todos, desenhados ou não).
// O anel guarda os últimos MEDIDOR.anel desenhos (o p50, o p95 e o "pior 1%" = o p99 do intervalo) e cada fase (jogo, replay,
// comemoração, cena, pré-jogo, tela antes do jogo, pausa) acumula desde a carga em histogramas fixos: nada é alocado por quadro.
//
// Os campos que outros passos preenchem (o main.js os passa em `info` e o painel mostra "—" sem eles):
//  - info.teto: o n do teto de quadros (desenha 1 a cada n quadros da tela; o C13, render/ritmo-desenho.js); null = "—";
//  - info.refreshHz: o refresh medido pelo ritmo do C13 (passa por cima do medido aqui); sem ele, o daqui;
//  - info.queda = {sessao, gravada}: a queda automática da qualidade na sessão e a gravada nas preferências (o C12), cada uma
//    {de, para} ou null.

export const MEDIDOR = Object.freeze({
  anel: 240,         // desenhos no anel (4 s a 60 qps, 8 s a 30)
  janelaQps: 1000,   // ms: o qps mostrado = os desenhos do último segundo
  quebra: 1000,      // ms: intervalo entre desenhos maior que isto não entra nas contas (começa outra série)
  refreshN: 30,      // intervalos do rAF na mediana do refresh
  caixas: 512,       // caixas de cada histograma das fases (a última junta tudo o que passa dela)
  passoIvl: 0.25,    // ms por caixa do histograma do intervalo (até 128 ms)
  passoCpu: 0.1,     // ms por caixa dos histogramas da CPU e da GPU (até 51,2 ms)
  gpuVoando: 4,      // consultas do cronômetro da GPU esperando o resultado (a GPU responde quadros depois)
  gpuMaxNome: 48,    // letras do nome curto da GPU no painel (o nome inteiro fica no __golaco.perf())
  // ms: o resultado do cronômetro acima disto (ou ≤ 0) é lixo e é descartado (contado em `invalidos`): o SwiftShader do CI expõe
  // a extensão e devolve 2^63 ns em toda consulta (o painel mostrava "GPU p95 9223372036854,8 ms")
  gpuMaxMs: 1000,
});

/** As fases, na ordem do painel, e o rótulo de cada uma. */
export const FASES = Object.freeze(['jogo', 'replay', 'comemoracao', 'cena', 'prejogo', 'tela', 'pausa']);
export const ROTULO_FASE = Object.freeze({
  jogo: 'jogo', replay: 'replay', comemoracao: 'comemoração', cena: 'cena', prejogo: 'pré-jogo', tela: 'tela antes do jogo', pausa: 'pausa',
});

/** O percentil p (0–1) dos `n` primeiros valores FINITOS de `v` (ordena uma cópia em `tmp`); NaN sem valores. Interpolado. */
export function percentil(v, n, p, tmp = null) {
  const t = tmp && tmp.length >= n ? tmp : new Float64Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) if (Number.isFinite(v[i])) t[k++] = v[i];
  if (!k) return NaN;
  const a = t.subarray(0, k).sort();
  const x = p * (k - 1), i0 = Math.floor(x), i1 = Math.min(k - 1, i0 + 1);
  return a[i0] + (a[i1] - a[i0]) * (x - i0);
}

/**
 * Um histograma de caixas fixas: add(v) e o percentil p pela MESMA definição do percentil() (a posição p·(n − 1) entre os dois
 * vizinhos ordenados), com cada valor ordenado estimado dentro da caixa dele (as amostras de uma caixa espalhadas por igual; na
 * última caixa, o maior visto): o erro fica dentro de uma caixa.
 */
export function criarHistograma(passo, caixas = MEDIDOR.caixas) {
  const h = new Uint32Array(caixas);
  let n = 0, soma = 0, max = 0;
  /** O k-ésimo valor ordenado (0 = o menor), estimado na caixa dele. */
  const posto = k => {
    let acum = 0;
    for (let c = 0; c < caixas; c++) {
      if (!h[c]) continue;
      if (acum + h[c] > k) return c === caixas - 1 ? max : Math.min(max, (c + (k - acum + 0.5) / h[c]) * passo);
      acum += h[c];
    }
    return max;
  };
  return {
    add(v) {
      if (!Number.isFinite(v) || v < 0) return;
      h[Math.min(caixas - 1, Math.floor(v / passo))]++;
      n++; soma += v; if (v > max) max = v;
    },
    get n() { return n; },
    get soma() { return soma; },
    get max() { return max; },
    percentil(p) {
      if (!n) return NaN;
      const x = p * (n - 1), i0 = Math.floor(x);
      const v0 = posto(i0);
      return i0 + 1 < n && x > i0 ? v0 + (posto(i0 + 1) - v0) * (x - i0) : v0;
    },
  };
}

/** A GPU pelo contexto: o UNMASKED_RENDERER_WEBGL do WEBGL_debug_renderer_info; no Firefox o gl.RENDERER comum (lá a extensão
 *  está obsoleta e avisa no console; o RENDERER já traz a GPU). '' sem contexto. */
export function lerGpu(gl, ua = '') {
  if (!gl) return '';
  try {
    if (/Firefox\//.test(ua)) return String(gl.getParameter(gl.RENDERER) ?? '');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch (_) { return ''; }
}

/** Divide "a, b (c, d), e" nas vírgulas fora de parênteses. */
function partesNivel0(s) {
  const r = [];
  let prof = 0, ini = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') prof++;
    else if (c === ')') prof = Math.max(0, prof - 1);
    else if (c === ',' && prof === 0) { r.push(s.slice(ini, i).trim()); ini = i + 1; }
  }
  r.push(s.slice(ini).trim());
  return r;
}

/** O nome curto da GPU para o painel: do "ANGLE (fabricante, renderizador, driver)" fica o renderizador, sem os ids (0x…), o
 *  sufixo do Direct3D e os (TM)/(R); no máximo `max` letras. '—' sem nome. */
export function nomeCurtoGpu(s, max = MEDIDOR.gpuMaxNome) {
  let t = String(s || '').trim();
  const m = t.match(/^ANGLE \((.*)\)$/);
  if (m) { const p = partesNivel0(m[1]); if (p.length >= 2 && p[1]) t = p[1]; }
  t = t.replace(/\s*\(0x[0-9a-f]+\)/gi, '').replace(/\s+Direct3D.*$/i, '').replace(/\s*\((TM|R)\)/gi, '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/**
 * O modo PROVÁVEL do MSAA do canvas (PESQUISA-ESTADIO.md §19: o drawing_buffer.cc do Chromium e o ANGLE), deduzido da GPU e do
 * navegador — o painel não tem como ler o modo de verdade:
 *  - sem MSAA (antialias false ou SAMPLES < 2);
 *  - SwiftShader (o CI): o implícito EMULADO (o ANGLE/Vulkan expõe o EXT_multisampled_render_to_texture);
 *  - iPhone/iPad e Safari (WebKit): separado (a média numa passada à parte; o MSAA é memória de verdade);
 *  - Firefox: não deduzido (a preferência webgl.msaa-samples);
 *  - Mac e Windows (Chrome): separado (o Graphite, ligado por padrão no Apple e no Windows);
 *  - Android (Chrome): implícito (o Ganesh faz a média dentro da memória da GPU; o Graphite é experimento em poucos aparelhos);
 *  - o resto: não deduzido.
 */
export function modoAA({ antialias, amostras, gpu = '', ua = '' } = {}) {
  if (!antialias || !(amostras >= 2)) return 'sem MSAA';
  if (/SwiftShader/i.test(gpu)) return 'implícito emulado (SwiftShader)';
  if (/iPhone|iPad|iPod/.test(ua) || (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android|Firefox/.test(ua))) return 'separado (Safari)';
  if (/Firefox\//.test(ua)) return 'não deduzido (Firefox)';
  if (/Android/.test(ua)) return 'implícito (Ganesh)';
  if (/Macintosh|Mac OS X/.test(ua)) return 'separado (Graphite, Mac)';
  if (/Windows/.test(ua)) return 'separado (Graphite, Windows)';
  return 'não deduzido';
}

/**
 * O cronômetro da GPU: uma consulta TIME_ELAPSED em volta de cada quadro (o EXT_disjoint_timer_query_webgl2; nada sem ele).
 * obterGl() devolve o contexto de agora (a recriação da qualidade e o contexto restaurado trocam: as consultas do velho são
 * descartadas). antes() abre a consulta no começo do quadro; depois(valeu, fase) fecha (só guarda o resultado do quadro que
 * desenhou); colher(fn) chama fn(ms, fase) para cada resultado que a GPU já deu (um quadro com o GPU_DISJOINT é descartado; um
 * resultado fora de (0, MEDIDOR.gpuMaxMs] também, contado em `invalidos`).
 */
export function criarCronometroGpu(obterGl, maxVoando = MEDIDOR.gpuVoando) {
  let gl = null, ext = null, livres = [], voando = [], aberta = null, invalidos = 0;
  const preparar = () => {
    const g = obterGl();
    if (g === gl) return !!ext && !(gl.isContextLost && gl.isContextLost());
    gl = g; ext = null; livres = []; voando = []; aberta = null;
    if (!g || (g.isContextLost && g.isContextLost())) return false;
    try { ext = g.getExtension('EXT_disjoint_timer_query_webgl2') || null; } catch (_) { ext = null; }
    return !!ext;
  };
  return {
    /** Há cronômetro neste contexto. */
    get disponivel() { return preparar(); },
    /** Resultados descartados por estarem fora de (0, MEDIDOR.gpuMaxMs] (desde o começo). */
    get invalidos() { return invalidos; },
    antes() {
      if (aberta || !preparar() || voando.length >= maxVoando) return;
      const q = livres.pop() ?? gl.createQuery();
      if (!q) return;
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      aberta = { gl, ext, q, fase: null };
    },
    depois(valeu, fase) {
      if (!aberta) return;
      const a = aberta;
      aberta = null;
      a.gl.endQuery(a.ext.TIME_ELAPSED_EXT);
      if (a.gl !== gl || a.gl !== obterGl()) return; // (o contexto trocou no meio do quadro: a consulta era do velho)
      a.fase = fase ?? null;
      if (valeu) voando.push(a); else livres.push(a.q);
    },
    colher(fn) {
      // (o contexto trocado ou perdido: as consultas do velho são descartadas aqui)
      if (!preparar() || !voando.length) return 0;
      const disjunto = !!gl.getParameter(ext.GPU_DISJOINT_EXT);
      let k = 0;
      while (voando.length) {
        const v = voando[0];
        if (!gl.getQueryParameter(v.q, gl.QUERY_RESULT_AVAILABLE)) break;
        const ns = gl.getQueryParameter(v.q, gl.QUERY_RESULT);
        voando.shift(); livres.push(v.q);
        if (disjunto) continue;
        const ms = Number(ns) / 1e6;
        if (!(ms > 0 && ms <= MEDIDOR.gpuMaxMs)) { invalidos++; continue; }
        fn(ms, v.fase); k++;
      }
      return k;
    },
  };
}

/** Um acumulado de fase: os desenhos, o histograma do intervalo, o da CPU e o da GPU. */
function criarAcumulado() {
  return { desenhos: 0, ivl: criarHistograma(MEDIDOR.passoIvl), cpu: criarHistograma(MEDIDOR.passoCpu), gpu: criarHistograma(MEDIDOR.passoCpu) };
}

/**
 * O medidor. raf(t): todo quadro do navegador (o refresh); desenho(t, cpuMs, fase): todo quadro que desenhou o 3D, com o
 * instante do rAF dele (t, ms), a CPU do quadro e a fase; gpu(ms, fase): um resultado do cronômetro. resumo(agora, fase) e
 * relatorio(agora, info, fase) devolvem o objeto (o __golaco.perf()); textoPainel(relatorio) é o texto do painel.
 */
export function criarMedidor(opc = {}) {
  const N = opc.anel ?? MEDIDOR.anel, quebra = opc.quebra ?? MEDIDOR.quebra, janela = opc.janelaQps ?? MEDIDOR.janelaQps;
  const RN = opc.refreshN ?? MEDIDOR.refreshN;
  const tDes = new Float64Array(N), ivl = new Float64Array(N), cpu = new Float64Array(N), gpuA = new Float64Array(N);
  const tmp = new Float64Array(N);
  let n = 0, i = 0, ultimo = null, total = 0, quebras = 0, ultimaFase = null;
  let ng = 0, ig = 0;
  const rafIvl = new Float64Array(RN), rafTmp = new Float64Array(RN);
  let nr = 0, ir = 0, rafAnt = null;
  const fases = {};
  const acum = f => (fases[f] ??= criarAcumulado());
  const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
  const r2 = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
  const med = {
    raf(t) {
      if (rafAnt != null) {
        const d = t - rafAnt;
        if (d > 0 && d <= quebra) { rafIvl[ir] = d; ir = (ir + 1) % RN; nr = Math.min(RN, nr + 1); }
      }
      rafAnt = t;
    },
    desenho(t, cpuMs, fase = 'jogo') {
      const d = ultimo == null ? NaN : t - ultimo;
      const vale = Number.isFinite(d) && d >= 0 && d <= quebra;
      if (ultimo != null && !vale) quebras++;
      ultimo = t;
      tDes[i] = t; ivl[i] = vale ? d : NaN; cpu[i] = Number.isFinite(cpuMs) ? cpuMs : NaN;
      i = (i + 1) % N; n = Math.min(N, n + 1); total++;
      ultimaFase = fase;
      const a = acum(fase);
      a.desenhos++;
      if (vale) a.ivl.add(d);
      a.cpu.add(cpuMs);
    },
    gpu(ms, fase) {
      if (!Number.isFinite(ms)) return;
      gpuA[ig] = ms; ig = (ig + 1) % N; ng = Math.min(N, ng + 1);
      acum(fase ?? ultimaFase ?? 'jogo').gpu.add(ms);
    },
    /** Desenhos por segundo no último segundo até `agora` (conta o tempo parado desde o último desenho); NaN com < 2 desenhos. */
    qps(agora) {
      if (n < 2) return NaN;
      if (agora == null) agora = ultimo;
      if (agora - ultimo > quebra) return 0;
      // do mais novo para trás até o desenho no começo da janela (ou uma quebra, ou o mais velho do anel)
      let k = 0, idx = (i - 1 + N) % N, tIni = tDes[idx];
      for (let c = 0; c < n - 1; c++) {
        if (!Number.isFinite(ivl[idx])) break;
        const ant = (idx - 1 + N) % N;
        tIni = tDes[ant]; k++;
        idx = ant;
        if (agora - tIni >= janela) break;
      }
      return k > 0 && agora > tIni ? (k * 1000) / (agora - tIni) : NaN;
    },
    /** O refresh medido (Hz): 1000 ÷ a mediana dos últimos intervalos do rAF; NaN antes de 5. */
    refreshHz() { return nr >= 5 ? 1000 / percentil(rafIvl, nr, 0.5, rafTmp) : NaN; },
    resumo(agora, fase) {
      const porFase = {};
      for (const f of FASES) {
        const a = fases[f];
        if (!a) continue;
        porFase[f] = {
          desenhos: a.desenhos,
          qps: a.ivl.n ? r1((a.ivl.n * 1000) / a.ivl.soma) : null,
          p50: r1(a.ivl.percentil(0.5)), p95: r1(a.ivl.percentil(0.95)), pior1: r1(a.ivl.percentil(0.99)),
          cpuP95: r2(a.cpu.percentil(0.95)), gpuP95: a.gpu.n ? r2(a.gpu.percentil(0.95)) : null,
        };
      }
      const f = fase ?? ultimaFase;
      return {
        qps: r1(med.qps(agora)),
        ms: { p50: r1(percentil(ivl, n, 0.5, tmp)), p95: r1(percentil(ivl, n, 0.95, tmp)), pior1: r1(percentil(ivl, n, 0.99, tmp)) },
        cpu: { p50: r2(percentil(cpu, n, 0.5, tmp)), p95: r2(percentil(cpu, n, 0.95, tmp)) },
        gpu: ng ? { p50: r2(percentil(gpuA, ng, 0.5, tmp)), p95: r2(percentil(gpuA, ng, 0.95, tmp)) } : null,
        desenhos: total, quebras, anel: n,
        refresh: { hz: r1(med.refreshHz()) },
        fase: f ?? null, faseRotulo: f ? ROTULO_FASE[f] ?? f : null,
        fases: porFase,
      };
    },
    /**
     * O resumo com o que só a página sabe (`info`, do main.js): {chamadas, triangulos, qualidade: {escolha, atual}, aa: {pedido,
     * antialias, amostras}, buffer: {w, h, pixelRatio, tetoTablet}, gpu: {nome, timer}, ua, teto, refreshHz, queda: {sessao,
     * gravada}}. O modo provável do AA e o nome curto da GPU saem daqui.
     */
    relatorio(agora, info = {}, fase) {
      const r = med.resumo(agora, fase);
      const aa = info.aa ?? {}, gpu = info.gpu ?? {};
      r.chamadas = info.chamadas ?? null;
      r.triangulos = info.triangulos ?? null;
      r.qualidade = { escolha: info.qualidade?.escolha ?? null, atual: info.qualidade?.atual ?? null };
      r.aa = { pedido: aa.pedido ?? null, antialias: aa.antialias ?? null, amostras: aa.amostras ?? null, modo: modoAA({ antialias: aa.antialias, amostras: aa.amostras, gpu: gpu.nome ?? '', ua: info.ua ?? '' }) };
      r.buffer = { w: info.buffer?.w ?? null, h: info.buffer?.h ?? null, pixelRatio: info.buffer?.pixelRatio ?? null, tetoTablet: !!info.buffer?.tetoTablet };
      r.gpu = { nome: gpu.nome ?? '', curto: nomeCurtoGpu(gpu.nome), timer: !!gpu.timer, invalidos: gpu.invalidos ?? 0, p50: r.gpu?.p50 ?? null, p95: r.gpu?.p95 ?? null };
      if (Number.isFinite(info.refreshHz)) r.refresh.hz = r1(info.refreshHz);
      r.refresh.teto = Number.isFinite(info.teto) ? info.teto : null;
      r.queda = { sessao: info.queda?.sessao ?? null, gravada: info.queda?.gravada ?? null };
      return r;
    },
    zerar() {
      n = 0; i = 0; ultimo = null; total = 0; quebras = 0; ng = 0; ig = 0; nr = 0; ir = 0; rafAnt = null;
      for (const f of Object.keys(fases)) delete fases[f];
    },
  };
  return med;
}

const NOME_Q = { auto: 'automática', baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const num = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');
const queda = q => (q && q.de && q.para ? `${NOME_Q[q.de] ?? q.de} → ${NOME_Q[q.para] ?? q.para}` : '—');

/**
 * O texto do painel (linhas com \n; vírgula decimal) a partir do relatorio(). Linhas curtas (≤ ~58 letras): no 568×320 o painel
 * cabe na largura e, com as 7 fases, na altura (11 px por letra, 1,4 de entrelinha).
 */
export function textoPainel(r) {
  const L = [];
  L.push(`${num(r.qps, 0)} qps · p50 ${num(r.ms?.p50)} · p95 ${num(r.ms?.p95)} · pior 1% ${num(r.ms?.pior1)} ms`);
  const gpuP95 = r.gpu?.timer && Number.isFinite(r.gpu?.p95) ? `${num(r.gpu.p95)} ms` : r.gpu?.timer && r.gpu?.invalidos > 0 ? '— (o cronômetro devolve lixo)' : '—';
  L.push(`CPU p95 ${num(r.cpu?.p95)} ms · GPU p95 ${gpuP95}`);
  L.push(`${Number.isFinite(r.chamadas) ? r.chamadas : '—'} chamadas · ${Number.isFinite(r.triangulos) ? Math.round(r.triangulos / 1000) : '—'} mil tri · fase ${r.faseRotulo ?? '—'}`);
  const esc = r.qualidade?.escolha, atu = r.qualidade?.atual, b = r.buffer ?? {};
  L.push(`qualidade ${NOME_Q[esc] ?? esc ?? '—'}${esc === 'auto' || esc !== atu ? ` → ${NOME_Q[atu] ?? atu ?? '—'}` : ''} · buffer ${b.w ?? '—'}×${b.h ?? '—'} · pr ${num(b.pixelRatio, 2)}`);
  const aa = r.aa ?? {}, msaa = aa.antialias && aa.amostras >= 2;
  L.push(`AA ${msaa ? `MSAA ${aa.amostras}×` : aa.antialias ? 'pedido, sem amostras' : 'não'} (SAMPLES ${aa.amostras ?? '—'})${msaa ? ` · ${aa.modo ?? '—'}` : ''}${b.tetoTablet ? ' · teto dos tablets' : ''}`);
  L.push(`GPU ${r.gpu?.curto ?? '—'}`);
  L.push(`tela ${num(r.refresh?.hz, 0)} Hz · teto ${Number.isFinite(r.refresh?.teto) ? `1 a cada ${r.refresh.teto}` : '—'}`);
  L.push(`queda: sessão ${queda(r.queda?.sessao)} · gravada ${queda(r.queda?.gravada)}`);
  for (const f of FASES) {
    const a = r.fases?.[f];
    if (!a) continue;
    L.push(` ${ROTULO_FASE[f]}: ${num(a.qps, 0)} qps · p95 ${num(a.p95)} · CPU ${num(a.cpuP95)}${Number.isFinite(a.gpuP95) ? ` · GPU ${num(a.gpuP95)}` : ''} (${a.desenhos})`);
  }
  return L.join('\n');
}
