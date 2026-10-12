// Som do estádio (Web Audio API; DOM — fica em js/render/ como o resto do que é da página). Camadas:
//   - LEITO (laços contínuos): murmúrio (torcida-ambiente) e estádio agitado (torcida-agito: sobe com a bola
//     perto do gol) — audível o jogo todo;
//   - CANTOS (laços longos, um de cada vez): a agenda de festa.js diz qual canto, quando entra e quando sai;
//     decodificados SOB DEMANDA (no máximo SOM.cantosNaMemoria ao mesmo tempo: o que toca e o próximo);
//   - BATUCADA da organizada (laço, fundo +x: lado direito da câmera de TV);
//   - REAÇÕES de uma vez: explosão do gol, "uuuh", palmas, vaia, apitos — gravações livres
//     (assets/sons/CREDITOS.md);
//   - sintetizados (sem arquivo): o "chuá" da bola na rede e a batida do chute (ruído filtrado com envelope).
// Os níveis vêm de mixagem.js (conta pura do ânimo de emocao.js e da agenda de festa.js); cada gravação é nivelada
// para MIXAGEM.alvoLufs pelo ganho de nivelamento (o LUFS medido de cada arquivo fica em SOM.arquivos). No fim da
// cadeia, um LIMITADOR (limiar −6,5 dBFS, razão 20, ataque 2 ms; com a compensação automática do nó): nada passa de −1 dBFS. O setor visitante sai à esquerda
// e abafado; a organizada e a batucada à direita (StereoPannerNode, o lado da câmera de TV).
//
// Política de reprodução automática (MDN, "Autoplay guide for media and Web Audio APIs"; Chrome, "Autoplay
// policy"): o AudioContext só é criado e retomado (resume) dentro de um gesto do usuário — toque, clique ou
// tecla. Até lá nada toca e nada é criado (sem aviso no console). Os arquivos baixam DEPOIS da página abrir
// (atrasoCarga ou no primeiro gesto, o que vier antes). Os laços tocam de loopInicio a loopFim (margem periódica
// do MP3: sem buraco nem estalo na volta). Página escondida: o contexto suspende. Pausa: a torcida abaixa e fica
// abafada (filtro passa-baixas).
// LIBERAÇÃO ROBUSTA (pedido de 11/10; WebKit 237322 e 276016, PESQUISA-ESTADIO.md §6):
//   - iPhone: com o som ligado, navigator.audioSession.type = 'playback' antes de criar/retomar o contexto (o
//     padrão 'ambient' deixa a chave de silencioso calar o jogo); som desligado volta a 'auto';
//   - o contexto pode sair de 'running' sem a página pedir (tela bloqueada, ligação, outro app tocando: 'suspended'
//     ou 'interrupted'): o ouvinte de 'statechange' atualiza o estado e RELIGA os ouvintes de gesto — o próximo
//     toque retoma (antes eles eram removidos de vez e o jogo ficava mudo, com o estado dizendo "rodando");
//   - página visível de novo: resume() (e, se não voltar, suspend()+resume() — receita do iOS); se ainda assim não
//     voltar, o próximo toque retoma;
//   - som.info.estado é sempre o estado REAL do contexto.
// Som DESLIGADO (menu, salvo): nada de Web Audio — o gesto não cria o contexto, os arquivos não baixam e, se o som
// for desligado com o contexto rodando, ele é SUSPENSO depois de abaixar. Ligar de novo (o clique no menu é um
// gesto) cria/retoma o contexto na hora.
// Apito do início (contraprova I5): o 'saida' do começo da partida chega antes de qualquer gesto (sem contexto
// ainda); o apito fica PENDENTE e toca quando o som for liberado, se isso acontecer em até SOM.apitoPendente ms.
import { MIXAGEM, alvosMixagem, nivelamento } from './mixagem.js';

export const SOM = {
  // lufs: sonoridade integrada medida (EBU R128, tools/sons/fazer_sons.py); o jogo nivela cada um para MIXAGEM.alvoLufs
  arquivos: {
    ambiente: { arq: 'torcida-ambiente.mp3', laco: [0.25, 18.25], lufs: -20.9 },
    agito: { arq: 'torcida-agito.mp3', laco: [0.25, 13.25], lufs: -20.2 },
    // cantos (a ordem de SOM.cantos é a de festa.js FESTA.cantos.papeis)
    canto: { arq: 'torcida-canto.mp3', laco: [0.25, 14.25], lufs: -20.0, canto: true },
    cantoB: { arq: 'torcida-canto-b.mp3', laco: [0.25, 24.25], lufs: -21.0, canto: true },
    cantoC: { arq: 'torcida-canto-c.mp3', laco: [0.25, 26.25], lufs: -19.2, canto: true },
    cantoD: { arq: 'torcida-canto-d.mp3', laco: [0.25, 24.25], lufs: -16.4, canto: true },
    // batucada: 153,6 batidas/min (o surdo a 76,8: o pulo da organizada), laço de 42 batidas; a 1ª a 0,341 s do laço
    batucada: { arq: 'torcida-batucada.mp3', laco: [0.25, 16.6561], lufs: -19.7, bpm: 76.8, batida0: 0.341 },
    gol: { arq: 'torcida-gol.mp3' },
    uuuh: { arq: 'torcida-uuuh.mp3' },
    uuuh2: { arq: 'torcida-uuuh-2.mp3', lufs: -16.4 },
    palmas: { arq: 'torcida-palmas.mp3' },
    vaia: { arq: 'torcida-vaia.mp3', lufs: -16.3 },
    apito: { arq: 'apito.mp3' },
    apitoIntervalo: { arq: 'apito-intervalo.mp3' },
    apitoFim: { arq: 'apito-fim.mp3' },
  },
  cantos: ['canto', 'cantoB', 'cantoC', 'cantoD'],
  cantosNaMemoria: 2,     // cantos decodificados ao mesmo tempo (o que toca e o próximo)
  volumePadrao: 0.8,
  atrasoCarga: 4000,      // ms depois da página pronta (se ninguém tocar antes)
  pausaGanho: 0.35,       // a torcida na pausa
  pausaFiltro: 900,       // Hz do passa-baixas na pausa
  apitoPendente: 6000,    // ms — o apito da saída que chegou antes do primeiro gesto ainda toca até isto
  desligaSuspende: 300,   // ms — som desligado: abaixa (τ 0,05 s) e depois suspende o contexto
  // limitador no fim da cadeia: o DynamicsCompressorNode aplica um ganho de compensação automático (makeup, spec do
  // Web Audio: 0,6 × a redução em 0 dBFS = +3,7 dB aqui) — o limiar −6,5 com razão 20 segura o pico abaixo de −1 dBFS
  // mesmo com a soma das camadas passando de 0 dBFS no grito do gol (medido no teste-som-jogo, M10). Contraprova de
  // 12/10: com −5,5 o pico medido foi −1,1 a −1,4 dBFS — a 0,1 dB da meta, o CI reprovaria por sorteio; −6,5 dá ~1 dB de folga
  limitador: { limiar: -6.5, razao: 20, joelho: 0, ataque: 0.002, solta: 0.25 },
  pan: { organizada: 0.35, visitante: -0.35 },
  visitanteFiltro: 1700,  // Hz — o setor visitante, longe e do outro lado do campo
  cantoSolta: 3,          // s com o canto em silêncio: a fonte para (CPU) e o buffer pode sair da memória
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
const LEITO = ['ambiente', 'agito', 'batucada'];   // laços de fundo (ordem fixa)

/**
 * opc = {base (pasta dos sons, ex. 'assets/sons/'), ligado, volume, aoMudar(estado)}.
 * Devolve {iniciar(), atualizar(emocao, pausado, t), tocar(disparo), definir({ligado, volume}), estado,
 * tocados, ligado, volume, contexto, info, relogioBatida}.
 */
export function criarSom(opc = {}) {
  const base = opc.base ?? 'assets/sons/';
  const Ctx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  let ctx = null;
  let ligado = opc.ligado !== false;
  let volume = clamp(opc.volume ?? SOM.volumePadrao, 0, 1);
  const bytes = {};       // nome → ArrayBuffer baixado (os cantos guardam o MP3: decodificados sob demanda)
  const buffers = {};     // nome → AudioBuffer
  const decodificando = {};
  const tocados = {};     // tipo → quantas vezes tocou (testes)
  const cantosTocados = new Set(); // clipes de canto que já tocaram (testes)
  let baixando = null;
  let mestre = null, bus = null, filtro = null, pre = null, limitador = null;
  const lacos = {};       // nome → {fonte, ganho, inicio}
  const cantos = {};      // nome → {fonte, ganho, lp, pan, lado, mudo (s em silêncio)}
  let usoCantos = [];     // nomes dos cantos decodificados, do mais recente para o mais antigo
  let ruido = null;
  const ultimoAlvo = { ambiente: -1, agito: -1, batucada: -1, pausa: -1 };
  const _mix = {};
  let estado = !Ctx ? 'sem-audio' : ligado ? 'sem-contexto' : 'desligado';
  let pendente = null;    // apito que chegou antes do som liberado: {tipo, quando (ms)}
  let cenaPre = null;     // pré-jogo: {ganho, filtro} do plano (cena())
  let timerSuspende = null;
  let ouvindo = false;
  let ultimoT = null;
  const ouvintes = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
  // sorteios do som (pontos de partida, qual "uuuh"): gerador próprio, nada do mundo
  let semente = 987654321;
  const sorteio = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };

  function mudou() { if (opc.aoMudar) opc.aoMudar(estado); }
  const trim = nome => nivelamento(SOM.arquivos[nome]?.lufs);

  /** iPhone: 'playback' com o som ligado (a chave de silencioso não cala o jogo); 'auto' desligado. */
  function sessao(tipo) {
    try {
      const s = typeof navigator !== 'undefined' ? navigator.audioSession : null;
      if (s && s.type !== tipo) s.type = tipo;
    } catch (_) { /* navegador sem audioSession */ }
  }
  /** Liga/desliga os ouvintes do gesto que retoma o contexto (ficam ligados enquanto ele não estiver rodando). */
  function ouvirGestos(v) {
    if (v === ouvindo || typeof window === 'undefined') return;
    ouvindo = v;
    for (const o of ouvintes) {
      if (v) window.addEventListener(o, desbloquear, { capture: true, passive: true });
      else window.removeEventListener(o, desbloquear, true);
    }
  }

  /** Baixa os arquivos (uma vez; depois da página abrir). */
  function baixar() {
    if (baixando || !Ctx) return baixando;
    baixando = Promise.all(Object.entries(SOM.arquivos).map(async ([nome, a]) => {
      try {
        const r = await fetch(base + a.arq);
        if (!r.ok) return;
        bytes[nome] = await r.arrayBuffer();
        if (!a.canto) decodificar(nome);
      } catch (_) { /* sem rede: segue sem esta camada */ }
    }));
    return baixando;
  }
  function decodificar(nome) {
    if (!ctx || !bytes[nome] || buffers[nome] || decodificando[nome]) return;
    const a = SOM.arquivos[nome];
    // decodeAudioData esvazia o ArrayBuffer: os cantos guardam o MP3 e decodificam uma cópia
    const dados = a.canto ? bytes[nome].slice(0) : bytes[nome];
    if (!a.canto) bytes[nome] = null;
    decodificando[nome] = true;
    let feito = false;
    const fim = b => {
      if (feito) return;
      feito = true; decodificando[nome] = false;
      if (!b) return;
      buffers[nome] = b;
      if (a.canto) usarCanto(nome);
      else if (a.laco) iniciarLaco(nome);
      tentarPendente();
    };
    try {
      const p = ctx.decodeAudioData(dados, fim, () => { decodificando[nome] = false; });
      if (p && p.then) p.then(fim, () => { decodificando[nome] = false; });
    } catch (_) { decodificando[nome] = false; /* formato não suportado: sem esta camada */ }
  }

  function montarGrafo() {
    const L = SOM.limitador;
    limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = L.limiar; limitador.knee.value = L.joelho; limitador.ratio.value = L.razao;
    limitador.attack.value = L.ataque; limitador.release.value = L.solta;
    mestre = ctx.createGain();
    mestre.gain.value = ligado ? volume : 0;
    pre = ctx.createGain();
    pre.gain.value = 1;
    filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 18000; filtro.Q.value = 0.5;
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(filtro); filtro.connect(pre); pre.connect(mestre); mestre.connect(limitador); limitador.connect(ctx.destination);
    // ruído branco (2 s) para os sons feitos por código
    const n = Math.floor(ctx.sampleRate * 2);
    ruido = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
  }
  /** Pan estéreo (o lado do setor na câmera de TV); sem StereoPannerNode, nada. */
  function criarPan(v) {
    if (!ctx.createStereoPanner) return null;
    const p = ctx.createStereoPanner();
    p.pan.value = v;
    return p;
  }
  /** Uma fonte em laço de loopInicio a loopFim, começando em `desde` s do laço. */
  function fonteLaco(nome, desde) {
    const a = SOM.arquivos[nome], b = buffers[nome];
    const fonte = ctx.createBufferSource();
    fonte.buffer = b;
    fonte.loop = true;
    fonte.loopStart = a.laco[0];
    fonte.loopEnd = Math.min(a.laco[1], b.duration);
    const per = Math.max(0.1, fonte.loopEnd - fonte.loopStart);
    const t0 = ctx.currentTime + 0.05;
    fonte.start(t0, a.laco[0] + (desde % per));
    return { fonte, inicio: t0 - (desde % per), periodo: per };
  }

  function iniciarLaco(nome) {
    if (!ctx || lacos[nome] || !buffers[nome]) return;
    // cada laço começa num ponto diferente (não soam juntos na emenda)
    const f = fonteLaco(nome, nome === 'agito' ? 4.1 : nome === 'batucada' ? 0 : 0.6);
    const ganho = ctx.createGain();
    ganho.gain.value = 0;
    f.fonte.connect(ganho);
    let saida = ganho;
    if (nome === 'batucada') { const p = criarPan(SOM.pan.organizada); if (p) { ganho.connect(p); saida = p; } }
    saida.connect(bus);
    lacos[nome] = { ...f, ganho };
    ultimoAlvo[nome] = -1;
  }

  // ---------------------------------------------------------------- cantos sob demanda
  function usarCanto(nome) {
    usoCantos = [nome, ...usoCantos.filter(n => n !== nome)];
  }
  /** O canto decodificado (ou pede a decodificação). */
  function garantirCanto(nome) {
    if (!nome) return false;
    if (buffers[nome]) { usarCanto(nome); return true; }
    decodificar(nome);
    return false;
  }
  /** Tira da memória os cantos além dos SOM.cantosNaMemoria mais recentes que não estejam tocando. */
  function liberarCantos(manter) {
    let n = 0;
    for (const nome of [...usoCantos]) {
      if (!buffers[nome]) continue;
      n++;
      if (n <= SOM.cantosNaMemoria || manter.includes(nome) || cantos[nome]) continue;
      buffers[nome] = null;
      usoCantos = usoCantos.filter(x => x !== nome);
    }
  }
  function iniciarCanto(nome, lado) {
    const f = fonteLaco(nome, sorteio() * 30);
    const ganho = ctx.createGain();
    ganho.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.value = lado ? SOM.visitanteFiltro : 18000;
    const pan = criarPan(lado ? SOM.pan.visitante : 0);
    f.fonte.connect(ganho); ganho.connect(lp);
    if (pan) { lp.connect(pan); pan.connect(bus); } else lp.connect(bus);
    cantos[nome] = { ...f, ganho, lp, pan, lado, mudo: 0, alvo: -1 };
    cantosTocados.add(nome);
  }
  function pararCanto(nome) {
    const c = cantos[nome];
    if (!c) return;
    try { c.fonte.stop(); } catch (_) { /* já parada */ }
    try { c.fonte.disconnect(); c.ganho.disconnect(); c.lp.disconnect(); if (c.pan) c.pan.disconnect(); } catch (_) { /* nada */ }
    delete cantos[nome];
  }

  /** Primeiro gesto (e depois de uma interrupção): cria/retoma o contexto (política de reprodução automática). */
  function desbloquear() {
    // som desligado: o gesto não cria nada (nem baixa os arquivos)
    if (!Ctx || !ligado) return;
    try {
      sessao('playback');
      if (!ctx) {
        // (o webkitAudioContext do Safari antigo não aceita opções)
        try { ctx = new Ctx({ latencyHint: 'interactive' }); } catch (_) { ctx = new Ctx(); }
        if (ctx.addEventListener) ctx.addEventListener('statechange', atualizarEstado);
        else ctx.onstatechange = atualizarEstado;
        montarGrafo();
        baixar();
        for (const nome of Object.keys(bytes)) if (!SOM.arquivos[nome].canto) decodificar(nome);
      }
      if (ctx.state !== 'running' && !document.hidden) {
        const p = ctx.resume();
        if (p && p.then) p.then(atualizarEstado, () => {});
      }
    } catch (_) { estado = 'sem-audio'; }
    atualizarEstado();
  }
  /** Estado = o do contexto, sempre (contraprova do diagnóstico de 11/10: dizia "rodando" com ele suspenso). */
  function atualizarEstado() {
    const novo = !Ctx ? 'sem-audio' : !ligado ? 'desligado' : !ctx ? 'sem-contexto' : ctx.state === 'running' ? 'rodando' : 'suspenso';
    if (novo !== estado) { estado = novo; mudou(); }
    if (estado === 'rodando') { ouvirGestos(false); tentarPendente(); }
    else if (ligado && Ctx) ouvirGestos(true);   // interrompido, suspenso ou sem contexto: o próximo toque retoma
    else ouvirGestos(false);
  }
  /** Página visível de novo: retoma; no iOS, suspend()+resume() quando o resume() sozinho não volta. */
  function voltar() {
    if (!ctx || !ligado || document.hidden) return;
    sessao('playback');
    const ok = () => { atualizarEstado(); if (ctx.state !== 'running') ctx.suspend().then(() => ctx.resume()).then(atualizarEstado, atualizarEstado); };
    try { ctx.resume().then(ok, ok); } catch (_) { atualizarEstado(); }
  }
  /** O apito pendente (chegou antes do som liberado) toca agora, se ainda vale. */
  function tentarPendente() {
    if (!pendente || !ligado || !ctx || ctx.state !== 'running' || !buffers[pendente.tipo]) return;
    const p = pendente;
    pendente = null;
    if (performance.now() - p.quando <= SOM.apitoPendente) api.tocar({ tipo: p.tipo, grupo: -1, forca: 1, pendente: true });
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
      saida.connect(lp); saida = lp;
    }
    if (opc2.pan) { const p = criarPan(opc2.pan); if (p) { saida.connect(p); saida = p; } }
    f.connect(g); saida.connect(opc2.semBus ? pre : bus);
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
    f.connect(bp); bp.connect(g); g.connect(pre);
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
    o.connect(go); go.connect(pre);
    o.start(t); o.stop(t + 0.16);
    const n = ctx.createBufferSource();
    n.buffer = ruido;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.12 + 0.15 * forca, t + 0.003);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(lp); lp.connect(gn); gn.connect(pre);
    n.start(t, sorteio() * 1.5, 0.08);
    return true;
  }
  /** Escreve um ganho só quando muda (arredondado a 0,005): nada de Web Audio à toa por quadro. */
  function alvoGanho(param, v, chave, tau = 0.35) {
    const r = Math.round(v * 200) / 200;
    if (chave.alvo === r) return;
    chave.alvo = r;
    const agora = ctx.currentTime;
    param.cancelScheduledValues(agora);
    param.setTargetAtTime(r, agora, tau);
  }
  const _chaves = { ambiente: { alvo: -1 }, agito: { alvo: -1 }, batucada: { alvo: -1 } };

  const api = {
    /** Registra os ouvintes do primeiro gesto e agenda o download (depois da página abrir). */
    iniciar() {
      if (!Ctx) { estado = 'sem-audio'; mudou(); return; }
      if (ligado) ouvirGestos(true);
      setTimeout(() => {
        if (!ligado) return; // desligado: não baixa (baixa quando ligar)
        const vai = () => baixar();
        if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(vai, { timeout: 2000 }); else vai();
      }, SOM.atrasoCarga);
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend().then(atualizarEstado, () => {});
        else voltar();
      });
      window.addEventListener('pageshow', () => voltar());
    },
    /** Uma vez por quadro: os níveis das camadas pela mixagem (só escreve na Web Audio quando muda). */
    atualizar(emocao, pausado, t) {
      const dtq = ultimoT == null ? 0 : clamp(t - ultimoT, 0, 0.25);
      ultimoT = t;
      if (!ctx || ctx.state !== 'running' || !emocao) return;
      const a = alvosMixagem(emocao, _mix);
      _mix.t = emocao.t;
      for (const nome of LEITO) {
        const l = lacos[nome];
        if (!l) continue;
        alvoGanho(l.ganho.gain, a[nome] * trim(nome), _chaves[nome]);
      }
      // cantos: o da agenda sobe; os outros descem e, calados por SOM.cantoSolta s, param
      const atual = a.cantoClipe >= 0 ? SOM.cantos[a.cantoClipe] : null;
      const prox = a.proximoCanto >= 0 ? SOM.cantos[a.proximoCanto] : null;
      if (atual && garantirCanto(atual) && !cantos[atual]) iniciarCanto(atual, a.cantoLado);
      if (prox && prox !== atual) garantirCanto(prox);
      for (const nome of Object.keys(cantos)) {
        const c = cantos[nome];
        const v = nome === atual ? a.canto : 0;
        if (nome === atual && c.lado !== a.cantoLado) {
          // o mesmo canto, agora do outro setor: troca o filtro e o lado
          c.lado = a.cantoLado;
          c.lp.frequency.setTargetAtTime(c.lado ? SOM.visitanteFiltro : 18000, ctx.currentTime, 0.2);
          if (c.pan) c.pan.pan.setTargetAtTime(c.lado ? SOM.pan.visitante : 0, ctx.currentTime, 0.2);
        }
        alvoGanho(c.ganho.gain, v * trim(nome), c, 0.25);
        c.mudo = v > 0.002 ? 0 : c.mudo + dtq;
        if (c.mudo > SOM.cantoSolta) pararCanto(nome);
      }
      liberarCantos([atual, prox].filter(Boolean));
      // pausa (a torcida abaixa e abafa) ou o plano do pré-jogo (cena(): de fora e no túnel, abafada)
      const gAlvo = cenaPre ? cenaPre.ganho : pausado ? SOM.pausaGanho : 1;
      const fAlvo = cenaPre ? cenaPre.filtro : pausado ? SOM.pausaFiltro : 18000;
      const p = Math.round(gAlvo * 100) * 100000 + Math.round(fAlvo);
      if (p !== ultimoAlvo.pausa) {
        const agora = ctx.currentTime;
        ultimoAlvo.pausa = p;
        bus.gain.cancelScheduledValues(agora);
        bus.gain.setTargetAtTime(gAlvo, agora, 0.12);
        filtro.frequency.cancelScheduledValues(agora);
        filtro.frequency.setTargetAtTime(fAlvo, agora, 0.12);
      }
    },
    /**
     * Pré-jogo (render/prejogo.js): o ganho e o passa-baixas do barramento da torcida no plano ({ganho, filtro: Hz |
     * null}) — de fora do estádio e no túnel ela soa abafada e mais baixa. null: volta ao jogo (a pausa de sempre).
     */
    cena(o) { cenaPre = o ? { ganho: clamp(o.ganho ?? 1, 0, 1.2), filtro: o.filtro == null ? 18000 : clamp(o.filtro, 200, 18000) } : null; },
    get cenaPre() { return cenaPre ? { ...cenaPre } : null; },
    /** Um disparo de emocao.js ({tipo, grupo, forca}). Devolve true se tocou. */
    tocar(d) {
      if (!ligado) return false;
      if (!ctx || ctx.state !== 'running' || (d.tipo === 'apito' && !buffers.apito)) {
        // o apito da saída antes do primeiro gesto (ou antes do arquivo pronto): fica pendente
        if (d.tipo === 'apito') pendente = { tipo: d.tipo, quando: performance.now() };
        return false;
      }
      const M = MIXAGEM, vis = d.grupo === 1;
      let ok = false;
      switch (d.tipo) {
        // gol da casa: o estádio inteiro; do visitante: só o setor deles (mais baixo, abafado, longe e à esquerda)
        case 'gol': ok = vis ? umaVez('gol', 0.5, { passaBaixa: 1600, taxa: 1.04, pan: SOM.pan.visitante }) : umaVez('gol', 0.95); break;
        case 'uuuh': {
          // duas gravações (a do Mineirão entra em 40% das vezes): o mesmo "uuuh" sempre cansa
          const nome = buffers.uuuh2 && sorteio() < 0.4 ? 'uuuh2' : 'uuuh';
          const g = ((vis ? 0.25 : 0.4) + 0.45 * d.forca) * (nome === 'uuuh2' ? trim('uuuh2') * 0.85 : 1);
          ok = umaVez(nome, g, vis ? { passaBaixa: 1800, pan: SOM.pan.visitante } : {});
          break;
        }
        case 'palmas': ok = umaVez('palmas', (vis ? 0.18 : 0.28) + 0.25 * d.forca, vis ? { passaBaixa: 2000, pan: SOM.pan.visitante } : {}); break;
        case 'vaia': ok = umaVez('vaia', M.vaia * trim('vaia') * (0.7 + 0.3 * d.forca)); break;
        case 'apito': ok = umaVez('apito', M.apito, { semBus: true }); break;
        case 'apitoIntervalo': ok = umaVez('apitoIntervalo', M.apitoIntervalo, { semBus: true }); break;
        case 'apitoFim': ok = umaVez('apitoFim', M.apitoFim, { semBus: true }); break;
        case 'rede': ok = chua(d.forca); break;
        case 'chute': ok = batida(d.forca); break;
        default: break;
      }
      if (ok) tocados[d.tipo] = (tocados[d.tipo] ?? 0) + 1;
      return ok;
    },
    /** Liga/desliga e volume (0–1). */
    definir(o = {}) {
      const antes = ligado;
      if (typeof o.ligado === 'boolean') ligado = o.ligado;
      if (typeof o.volume === 'number') volume = clamp(o.volume, 0, 1);
      if (!ligado) { pendente = null; sessao('auto'); }
      // ligou agora (o clique no menu é um gesto): cria/retoma o contexto e baixa os sons
      if (ligado && !antes && Ctx) { desbloquear(); if (!baixando) baixar(); }
      if (ctx && mestre) {
        const agora = ctx.currentTime;
        mestre.gain.cancelScheduledValues(agora);
        mestre.gain.setTargetAtTime(ligado ? volume : 0, agora, 0.05);
        clearTimeout(timerSuspende);
        if (!ligado) {
          // desligou: abaixa e SUSPENDE (nada de Web Audio rodando em silêncio)
          timerSuspende = setTimeout(() => { if (!ligado && ctx.state === 'running') ctx.suspend().then(atualizarEstado, () => {}); }, SOM.desligaSuspende);
        } else if (ctx.state !== 'running' && !document.hidden) ctx.resume().then(atualizarEstado, () => {});
      }
      atualizarEstado();
    },
    get estado() { return estado; },
    get ligado() { return ligado; },
    get volume() { return volume; },
    get tocados() { return { ...tocados }; },
    /**
     * Relógio da batucada (s) para o pulo da organizada no ritmo dela: um tempo t em que sin(2π·bpm/60·t) tem o
     * pico na batida da gravação (torcida.js). null sem som ou sem a batucada tocando.
     */
    get relogioBatida() {
      const l = lacos.batucada;
      if (!ctx || ctx.state !== 'running' || !l) return null;
      const a = SOM.arquivos.batucada;
      const hz = a.bpm / 60;
      // a 1ª batida do laço em batida0 s; o pico do seno em ¼ de período
      return ((ctx.currentTime - l.inicio - a.batida0) % l.periodo + l.periodo) % l.periodo + 0.25 / hz;
    },
    /** Estado real, camadas prontas, níveis da mixagem (em unidades de −16 LUFS) e memória dos sons (testes). */
    get info() {
      let bytesPcm = 0;
      for (const b of Object.values(buffers)) if (b) bytesPcm += b.length * b.numberOfChannels * 4;
      const niveis = {};
      if (ctx && ctx.state === 'running') {
        niveis.ambiente = Math.round((_mix.ambiente ?? 0) * 1000) / 1000;
        niveis.agito = Math.round((_mix.agito ?? 0) * 1000) / 1000;
        niveis.canto = Math.round((_mix.canto ?? 0) * 1000) / 1000;
        niveis.batucada = Math.round((_mix.batucada ?? 0) * 1000) / 1000;
      }
      return {
        estado, ligado, volume, ganhoMestre: mestre ? mestre.gain.value : null,
        decodificados: Object.keys(buffers).filter(k => buffers[k]).sort(),
        lacos: Object.keys(lacos).sort(),
        cantosTocando: Object.keys(cantos).sort(),
        cantos: [...cantosTocados].sort(),
        cantoAgora: _mix.cantoClipe >= 0 ? SOM.cantos[_mix.cantoClipe] : null,
        niveis,
        contexto: ctx ? ctx.state : null, baixando: !!baixando, pendente: pendente ? pendente.tipo : null,
        sessao: typeof navigator !== 'undefined' && navigator.audioSession ? navigator.audioSession.type : null,
        ouvindoGesto: ouvindo,
        memoriaMiB: Math.round(bytesPcm / 1048576 * 10) / 10,
      };
    },
    /**
     * Envelope de uma gravação decodificada (testes): RMS em janelas de `jan` s a cada `passo` s →
     * {duracao, picoDb, tPico, t6dB (1ª janela a ≤ 6 dB do pico), media0a2_5Db (RMS dos primeiros 2,5 s)}.
     */
    analisar(nome, jan = 0.25, passo = 0.05) {
      const b = buffers[nome];
      if (!b) return null;
      const d = b.getChannelData(0), sr = b.sampleRate, J = Math.round(jan * sr), P = Math.round(passo * sr);
      const env = [];
      for (let i = 0; i + J <= d.length; i += P) { let s = 0; for (let k = i; k < i + J; k++) s += d[k] * d[k]; env.push(10 * Math.log10(s / J + 1e-12)); }
      let pico = -Infinity, iPico = 0;
      env.forEach((v, i) => { if (v > pico) { pico = v; iPico = i; } });
      const i6 = env.findIndex(v => v >= pico - 6);
      let s25 = 0;
      const n25 = Math.min(d.length, Math.round(2.5 * sr));
      for (let k = 0; k < n25; k++) s25 += d[k] * d[k];
      const r = x => Math.round(x * 100) / 100;
      return { duracao: r(b.duration), picoDb: r(pico), tPico: r(iPico * passo), t6dB: r(i6 * passo), media0a2_5Db: r(10 * Math.log10(s25 / Math.max(1, n25) + 1e-12)) };
    },
    get contexto() { return ctx; },
    /** Força o download agora (testes). */
    baixar,
  };
  return api;
}
