// Som do estádio (Web Audio API; DOM — fica em js/render/ como o resto do que é da página). Camadas:
//   - laços contínuos: murmúrio (torcida-ambiente), estádio agitado (torcida-agito: sobe com a bola no terço
//     final) e a torcida cantando ao fundo (torcida-canto: vai e volta devagar, mais forte com o time bem);
//   - reações de uma vez: explosão do gol (longa), "uuuh" (chance perdida), palmas, apitos (saída, intervalo,
//     fim) — gravações livres (assets/sons/CREDITOS.md);
//   - sintetizados (sem arquivo): o "chuá" da bola na rede e a batida do chute (ruído filtrado com envelope).
// O nível de cada camada vem de emocao.js (o mesmo ânimo que move a torcida 3D).
//
// Política de reprodução automática (MDN, "Autoplay guide for media and Web Audio APIs"; Chrome, "Autoplay
// policy"): o AudioContext só é criado e retomado (resume) dentro de um gesto do usuário — toque, clique ou
// tecla. Até lá nada toca e nada é criado (sem aviso no console). Os arquivos baixam DEPOIS da página abrir
// (atrasoCarga ou no primeiro gesto, o que vier antes) e são decodificados quando o contexto existe. Os
// laços tocam de loopInicio a loopFim (margem periódica do MP3: sem buraco nem estalo na volta). Página
// escondida: o contexto suspende. Pausa: a torcida abaixa e fica abafada (filtro passa-baixas).

export const SOM = {
  arquivos: {
    ambiente: { arq: 'torcida-ambiente.mp3', laco: [0.25, 18.25] },
    agito: { arq: 'torcida-agito.mp3', laco: [0.25, 13.25] },
    canto: { arq: 'torcida-canto.mp3', laco: [0.25, 14.25] },
    gol: { arq: 'torcida-gol.mp3' },
    uuuh: { arq: 'torcida-uuuh.mp3' },
    palmas: { arq: 'torcida-palmas.mp3' },
    apito: { arq: 'apito.mp3' },
    apitoIntervalo: { arq: 'apito-intervalo.mp3' },
    apitoFim: { arq: 'apito-fim.mp3' },
  },
  volumePadrao: 0.8,
  atrasoCarga: 4000,      // ms depois da página pronta (se ninguém tocar antes)
  pausaGanho: 0.35,       // a torcida na pausa
  pausaFiltro: 900,       // Hz do passa-baixas na pausa
  cantoPeriodo: 46,       // s — o canto da torcida vai e volta
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

/**
 * opc = {base (pasta dos sons, ex. 'assets/sons/'), ligado, volume, aoMudar(estado)}.
 * Devolve {iniciar(), atualizar(emocao, pausado, t), tocar(disparo), definir({ligado, volume}), estado,
 * tocados, ligado, volume, contexto}.
 */
export function criarSom(opc = {}) {
  const base = opc.base ?? 'assets/sons/';
  const Ctx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  let ctx = null;
  let ligado = opc.ligado !== false;
  let volume = clamp(opc.volume ?? SOM.volumePadrao, 0, 1);
  const bytes = {};       // nome → ArrayBuffer baixado
  const buffers = {};     // nome → AudioBuffer
  const tocados = {};     // tipo → quantas vezes tocou (testes)
  let baixando = null;
  let mestre = null, bus = null, filtro = null, comp = null;
  const lacos = {};       // nome → {fonte, ganho}
  let ruido = null;
  let ultimoAlvo = { ambiente: -1, agito: -1, canto: -1, pausa: -1 };
  let estado = Ctx ? 'sem-contexto' : 'sem-audio';
  const ouvintes = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
  // ponto de partida dentro do ruído (gerador próprio do som, nada do mundo)
  let semente = 987654321;
  const sorteio = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };

  function mudou() { if (opc.aoMudar) opc.aoMudar(estado); }

  /** Baixa os arquivos (uma vez; depois da página abrir). */
  function baixar() {
    if (baixando || !Ctx) return baixando;
    baixando = Promise.all(Object.entries(SOM.arquivos).map(async ([nome, a]) => {
      try {
        const r = await fetch(base + a.arq);
        if (!r.ok) return;
        bytes[nome] = await r.arrayBuffer();
        decodificar(nome);
      } catch (_) { /* sem rede: segue sem esta camada */ }
    }));
    return baixando;
  }
  function decodificar(nome) {
    if (!ctx || !bytes[nome] || buffers[nome]) return;
    const dados = bytes[nome];
    bytes[nome] = null;
    let feito = false;
    const fim = b => { if (feito || !b) return; feito = true; buffers[nome] = b; if (SOM.arquivos[nome].laco) iniciarLaco(nome); };
    try {
      const p = ctx.decodeAudioData(dados, fim, () => {});
      if (p && p.then) p.then(fim, () => {});
    } catch (_) { /* formato não suportado: sem esta camada */ }
  }

  function montarGrafo() {
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    mestre = ctx.createGain();
    mestre.gain.value = ligado ? volume : 0;
    filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 18000; filtro.Q.value = 0.5;
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(filtro); filtro.connect(comp); comp.connect(mestre); mestre.connect(ctx.destination);
    // ruído branco (2 s) para os sons feitos por código
    const n = Math.floor(ctx.sampleRate * 2);
    ruido = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
  }

  function iniciarLaco(nome) {
    if (!ctx || lacos[nome] || !buffers[nome]) return;
    const a = SOM.arquivos[nome];
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffers[nome];
    fonte.loop = true;
    fonte.loopStart = a.laco[0];
    fonte.loopEnd = Math.min(a.laco[1], buffers[nome].duration);
    const ganho = ctx.createGain();
    ganho.gain.value = 0;
    fonte.connect(ganho); ganho.connect(bus);
    // cada laço começa num ponto diferente (não soam juntos na emenda)
    fonte.start(ctx.currentTime + 0.05, a.laco[0] + (nome === 'agito' ? 4.1 : nome === 'canto' ? 7.3 : 0.6));
    lacos[nome] = { fonte, ganho };
    ultimoAlvo[nome] = -1;
  }

  /** Primeiro gesto: cria/retoma o contexto (política de reprodução automática). */
  function desbloquear() {
    if (!Ctx) return;
    try {
      if (!ctx) {
        // (o webkitAudioContext do Safari antigo não aceita opções)
        try { ctx = new Ctx({ latencyHint: 'interactive' }); } catch (_) { ctx = new Ctx(); }
        montarGrafo();
        baixar();
        for (const nome of Object.keys(bytes)) decodificar(nome);
      }
      if (ctx.state !== 'running' && !document.hidden) {
        const p = ctx.resume();
        if (p && p.then) p.then(() => { atualizarEstado(); }, () => {});
      }
    } catch (_) { estado = 'sem-audio'; }
    atualizarEstado();
  }
  function atualizarEstado() {
    const novo = !ctx ? (Ctx ? 'sem-contexto' : 'sem-audio') : ctx.state === 'running' ? 'rodando' : 'suspenso';
    if (novo !== estado) { estado = novo; mudou(); }
    if (estado === 'rodando') for (const o of ouvintes) window.removeEventListener(o, desbloquear, true);
  }

  function umaVez(nome, ganho, opc2 = {}) {
    if (!ctx || !buffers[nome] || ctx.state !== 'running') return false;
    const f = ctx.createBufferSource();
    f.buffer = buffers[nome];
    if (opc2.taxa) f.playbackRate.value = opc2.taxa;
    const g = ctx.createGain();
    g.gain.value = ganho;
    let saida = g;
    if (opc2.passaBaixa) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = opc2.passaBaixa;
      g.connect(lp); saida = lp;
    }
    f.connect(g); saida.connect(opc2.semBus ? comp : bus);
    f.start(ctx.currentTime + (opc2.atraso ?? 0));
    return true;
  }
  /** "Chuá" da bola na rede: ruído com passa-faixa e envelope curto. */
  function chua(forca) {
    if (!ctx || ctx.state !== 'running' || !ruido) return false;
    const t = ctx.currentTime;
    const f = ctx.createBufferSource();
    f.buffer = ruido;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2200 + 1800 * forca; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 + 0.32 * forca, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28 + 0.25 * forca);
    f.connect(bp); bp.connect(g); g.connect(comp);
    f.start(t, sorteio() * 1.2, 0.6);
    return true;
  }
  /** Batida do chute: grave que cai (seno 110 → 50 Hz) + estalo de ruído. */
  function batida(forca) {
    if (!ctx || ctx.state !== 'running' || !ruido) return false;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    const go = ctx.createGain();
    go.gain.setValueAtTime(0.0001, t);
    go.gain.exponentialRampToValueAtTime(0.25 + 0.3 * forca, t + 0.006);
    go.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(go); go.connect(comp);
    o.start(t); o.stop(t + 0.16);
    const n = ctx.createBufferSource();
    n.buffer = ruido;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.12 + 0.15 * forca, t + 0.003);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(lp); lp.connect(gn); gn.connect(comp);
    n.start(t, sorteio() * 1.5, 0.08);
    return true;
  }

  const api = {
    /** Registra os ouvintes do primeiro gesto e agenda o download (depois da página abrir). */
    iniciar() {
      if (!Ctx) { estado = 'sem-audio'; mudou(); return; }
      for (const o of ouvintes) window.addEventListener(o, desbloquear, { capture: true, passive: true });
      setTimeout(() => {
        const vai = () => baixar();
        if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(vai, { timeout: 2000 }); else vai();
      }, SOM.atrasoCarga);
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend().then(atualizarEstado, () => {});
        else if (ligado) ctx.resume().then(atualizarEstado, () => {});
      });
    },
    /** Uma vez por quadro: os níveis dos laços pelo ânimo (só escreve na Web Audio quando muda). */
    atualizar(emocao, pausado, t) {
      if (!ctx || ctx.state !== 'running' || !emocao) return;
      const casa = emocao.torcida[0];
      const alvo = {
        ambiente: 0.34 + 0.3 * emocao.agito,
        agito: 0.78 * suave(0.38, 0.95, emocao.agito),
        canto: (0.2 + 0.3 * casa.excita + 0.12 * casa.tensao) * (0.62 + 0.38 * Math.sin(t * 2 * Math.PI / SOM.cantoPeriodo)),
      };
      const agora = ctx.currentTime;
      for (const nome of ['ambiente', 'agito', 'canto']) {
        const l = lacos[nome];
        if (!l) continue;
        const v = Math.round(alvo[nome] * 100) / 100;
        if (v === ultimoAlvo[nome]) continue;
        ultimoAlvo[nome] = v;
        l.ganho.gain.cancelScheduledValues(agora);
        l.ganho.gain.setTargetAtTime(v, agora, 0.35);
      }
      const p = pausado ? 1 : 0;
      if (p !== ultimoAlvo.pausa) {
        ultimoAlvo.pausa = p;
        bus.gain.cancelScheduledValues(agora);
        bus.gain.setTargetAtTime(pausado ? SOM.pausaGanho : 1, agora, 0.12);
        filtro.frequency.cancelScheduledValues(agora);
        filtro.frequency.setTargetAtTime(pausado ? SOM.pausaFiltro : 18000, agora, 0.12);
      }
    },
    /** Um disparo de emocao.js ({tipo, grupo, forca}). Devolve true se tocou. */
    tocar(d) {
      if (!ligado || !ctx || ctx.state !== 'running') return false;
      let ok = false;
      switch (d.tipo) {
        // gol da casa: o estádio inteiro; do visitante: só o setor deles (mais baixo e abafado, longe)
        case 'gol': ok = d.grupo === 1 ? umaVez('gol', 0.5, { passaBaixa: 1600, taxa: 1.04 }) : umaVez('gol', 0.95); break;
        case 'uuuh': ok = umaVez('uuuh', (d.grupo === 1 ? 0.25 : 0.4) + 0.45 * d.forca, d.grupo === 1 ? { passaBaixa: 1800 } : {}); break;
        case 'palmas': ok = umaVez('palmas', (d.grupo === 1 ? 0.18 : 0.28) + 0.25 * d.forca, d.grupo === 1 ? { passaBaixa: 2000 } : {}); break;
        case 'apito': ok = umaVez('apito', 0.55, { semBus: true }); break;
        case 'apitoIntervalo': ok = umaVez('apitoIntervalo', 0.6, { semBus: true }); break;
        case 'apitoFim': ok = umaVez('apitoFim', 0.62, { semBus: true }); break;
        case 'rede': ok = chua(d.forca); break;
        case 'chute': ok = batida(d.forca); break;
        default: break;
      }
      if (ok) tocados[d.tipo] = (tocados[d.tipo] ?? 0) + 1;
      return ok;
    },
    /** Liga/desliga e volume (0–1). */
    definir(o = {}) {
      if (typeof o.ligado === 'boolean') ligado = o.ligado;
      if (typeof o.volume === 'number') volume = clamp(o.volume, 0, 1);
      if (ctx && mestre) {
        const agora = ctx.currentTime;
        mestre.gain.cancelScheduledValues(agora);
        mestre.gain.setTargetAtTime(ligado ? volume : 0, agora, 0.05);
        if (ligado && ctx.state !== 'running' && !document.hidden) ctx.resume().then(atualizarEstado, () => {});
      }
    },
    get estado() { return estado; },
    get ligado() { return ligado; },
    get volume() { return volume; },
    get tocados() { return { ...tocados }; },
    /** Ganho que sai agora (0 desligado) e camadas prontas (testes). */
    get info() {
      return {
        estado, ligado, volume, ganhoMestre: mestre ? mestre.gain.value : null,
        decodificados: Object.keys(buffers).sort(), lacos: Object.keys(lacos).sort(),
        niveis: Object.fromEntries(Object.entries(lacos).map(([k, l]) => [k, Math.round(l.ganho.gain.value * 1000) / 1000])),
      };
    },
    get contexto() { return ctx; },
    /** Força o download agora (testes). */
    baixar,
  };
  return api;
}
