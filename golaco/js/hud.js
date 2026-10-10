// HUD (DOM): placar (com o relógio da partida), velocidade e modo do jogador controlado, posição
// dele, minimapa, barra de força do passe/chute perto do jogador, avisos curtos de eventos, "GOL!"
// grande, faixa do intervalo e do fim de jogo, menu de pausa (itens por modo: Editar time e
// Reiniciar partida na partida; Recomeçar, Máquina e Marcador só nos treinos; "Modo de jogo" com a
// partida e os treinos), ajuda, contador de qps e tela de carregamento. Só mexe no DOM; quem
// decide é o main.js. Lê o mundo só para desenhar (placar, minimapa) e tolera campos que ainda não
// existem.

const TEXTO_EVENTO = {
  fora: { t: 'Bola fora', ms: 1300 },
  roubada: { t: 'Roubada!', ms: 1300 },
  perda: { t: 'Bola perdida', ms: 1300 },
  maquina: { t: 'Máquina: passe a caminho', ms: 1200 },
  marcadorLigado: { t: 'Marcador de treino ligado', ms: 1400 },
  marcadorDesligado: { t: 'Marcador de treino desligado', ms: 1400 },
  recomecar: { t: 'Bola no pé', ms: 900 },
  passe: { t: 'Passe', ms: 900 },
  chute: { t: 'Chute', ms: 1100, forte: true },
  cabeceio: { t: 'Cabeceio', ms: 1100, forte: true },
  defesa: { t: 'Defesa do goleiro', ms: 1500, forte: true },
  repor: { t: 'Bola na mão: PASSE ou LANÇAMENTO', ms: 2600, forte: true },
  troca: { t: 'Troca de jogador', ms: 800 },
  saidaGoleiro: { t: 'Goleiro saiu do gol', ms: 1200 },
  recomeco: { t: 'Recomeço da jogada', ms: 1000 },
  semMarcador: { t: 'Marcador só no treino de condução', ms: 1400 },
  soTreino: { t: 'Só nos treinos (menu, Modo de jogo)', ms: 1600 },
  // partida (Etapa 3)
  saida: { t: 'Saída de bola', ms: 1100 },
  lateral: { t: 'Lateral', ms: 1100 },
  escanteio: { t: 'Escanteio', ms: 1300, forte: true },
  tiroDeMeta: { t: 'Tiro de meta', ms: 1100 },
  timeEditado: { t: 'Time atualizado', ms: 1600, forte: true },
  edicaoRecusada: { t: 'Mudança no time recusada', ms: 2400 },
  substituicao: { t: 'Substituição', ms: 2000, forte: true },
  reinicio: { t: 'Partida reiniciada', ms: 1200 },
};
// subtipos (o tipo do passe/chute vem no evento ou em m.voo.tipo)
const NOME_ACAO = {
  passe: 'Passe', enfiada: 'Enfiada', enfiadaAlta: 'Enfiada pelo alto', lancamento: 'Lançamento',
  cruzamento: 'Cruzamento', chute: 'Chute', colocado: 'Chute colocado', cavadinha: 'Cavadinha', cabeceio: 'Cabeceio',
};
const NOME_DEFESA = { encaixe: 'Defesa: encaixou', espalmada: 'Defesa: espalmou', pegou: 'O goleiro pegou' };
// rótulo da barra de força por tipo de carga
const ROTULO_CARGA = {
  passe: 'PASSE', enfiada: 'ENFIADA', enfiadaAlta: 'ENFIADA ALTA', lancamento: 'LANÇAMENTO', cruzamento: 'CRUZAMENTO',
  chute: 'CHUTE', colocado: 'COLOCADO', cavadinha: 'CAVADINHA',
};
// cores do minimapa (pelos uniformes — fictícios). O visitante joga de branco, mas no minimapa
// fica cinza-azulado: branco é a cor da BOLA (com o mesmo branco, bola e visitante se confundiam)
const COR_MAPA = {
  t0: '#19e07a', t0gol: '#c6ff3d', t1: '#93a3ae', t1gol: '#d0631f', bola: '#ffffff',
};
// times fictícios: siglas do placar (treino; na partida vêm do elenco por definirTimes)
const TIMES_TREINO = [{ sigla: 'GLÇ', nome: 'Golaço' }, { sigla: 'VIS', nome: 'Visitante' }];
const NOME_TEMPO = { 1: '1º T', 2: '2º T' };

const NOMES_Q = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const CAMPO_MX = 52.5, CAMPO_MZ = 34;

/**
 * opc = {aoComando(cmd, valor)}. Comandos: continuar, recomecar, maquina, marcador, ajuda,
 * fechar-ajuda, qualidade, hora, camera, toqueTamanho, toqueOpacidade, editar-time,
 * reiniciar-partida, modos, modos-voltar, modo (valor: partida | ataque | conducao).
 */
export function criarHud(opc) {
  const $ = id => document.getElementById(id);
  const el = {
    vel: $('vel'), modo: $('modo'), posicao: $('posicao'), aviso: $('aviso'), qps: $('qps'), menu: $('menu'), ajuda: $('ajuda'),
    carregando: $('carregando'), msg: $('carregando-msg'), marcador: $('estado-marcador'), infoQ: $('info-qualidade'),
    tam: $('toque-tamanho'), opa: $('toque-opacidade'), saidaTam: $('saida-tamanho'), saidaOpa: $('saida-opacidade'),
    gols: [$('gols-0'), $('gols-1')], siglas: [$('sigla-0'), $('sigla-1')], golTela: $('gol-tela'), golQuem: $('gol-quem'),
    mapa: $('minimapa'), carga: $('carga'), cargaTipo: $('carga-tipo'), cargaNivel: $('carga-nivel'),
    relogio: $('placar-relogio'), minuto: $('relogio'), tempo: $('relogio-tempo'),
    faixa: $('faixa'), faixaTitulo: $('faixa-titulo'), faixaPlacar: $('faixa-placar'), faixaBotao: $('faixa-botao'),
    acoes: $('menu-acoes'), modos: $('menu-modos'), estadoModo: $('estado-modo'), continuar: $('btn-continuar'),
    reiniciarPartida: $('btn-reiniciar-partida'),
  };
  const cmd = (c, v) => opc.aoComando && opc.aoComando(c, v);
  let ultimoHud = -1;
  const ultimoTexto = { vel: '', modo: '', posicao: null, forte: false };
  let timerAviso = null, timerGol = null;
  let prints = false;
  const placarVisto = [null, null];
  let times = TIMES_TREINO;
  const relogioVisto = { minuto: null, tempo: null, visivel: null };
  let timerFaixa = null;
  let modoAtual = null, fimDeJogo = false;
  const NOME_MODO = { partida: 'partida', ataque: 'treino de ataque', conducao: 'treino de condução' };
  times.forEach((t, i) => { if (el.siglas[i]) el.siglas[i].textContent = t.sigla; });

  // botões com data-cmd (menu, ajuda e faixa); data-valor vai junto (modo de jogo)
  document.querySelectorAll('[data-cmd]').forEach(b => {
    b.addEventListener('click', () => cmd(b.dataset.cmd, b.dataset.valor));
  });
  // grupos segmentados
  document.querySelectorAll('.segmentado').forEach(g => {
    g.addEventListener('click', e => {
      const b = e.target.closest('button[data-valor]');
      if (b) cmd(g.dataset.grupo, b.dataset.valor);
    });
  });
  // fundo escuro fecha a janela
  for (const s of [el.menu, el.ajuda]) {
    s?.addEventListener('pointerdown', e => {
      if (e.target === s) cmd(s === el.menu ? 'continuar' : 'fechar-ajuda');
    });
  }
  el.tam?.addEventListener('input', () => { cmd('toqueTamanho', +el.tam.value / 100); });
  // tela cheia (Android/PC; o iPhone não deixa a página pedir)
  const btTela = $('btn-tela-cheia');
  if (btTela && document.fullscreenEnabled) {
    btTela.hidden = false;
    const rotulo = () => { const t = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; btTela.setAttribute('aria-label', t); btTela.title = t; };
    document.addEventListener('fullscreenchange', rotulo);
    rotulo();
  }
  el.opa?.addEventListener('input', () => { cmd('toqueOpacidade', +el.opa.value / 100); });

  function marcarGrupo(grupo, valor) {
    document.querySelectorAll(`.segmentado[data-grupo="${grupo}"] button`).forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.valor === valor));
    });
  }

  // Topo do HUD no celular deitado: placar | minimapa | painel numa linha só. Em tela estreita
  // (ou com entalhe) eles encostariam: primeiro sai a marca do placar, depois o texto do modo
  // (fica o ponto de estado e a posição). Medido de verdade (texto do modo muda de largura).
  const raiz = document.documentElement;
  const caixasTopo = [$('hud')?.querySelector('.placar'), $('hud')?.querySelector('.painel-jogo'), el.mapa];
  function encostaTopo() {
    const [pl, pa, mp] = caixasTopo.map(e => e?.getBoundingClientRect());
    if (!pl || !pa || !mp || mp.width === 0) return false;
    const enc = (a, b) => a.left < b.right + 6 && b.left < a.right + 6 && a.top < b.bottom + 4 && b.top < a.bottom + 4;
    return enc(pl, mp) || enc(pa, mp) || enc(pl, pa);
  }
  function ajustarTopo() {
    raiz.classList.remove('topo-c1', 'topo-c2', 'topo-c3');
    if (!raiz.classList.contains('com-toque')) return;
    if (!encostaTopo()) return;
    raiz.classList.add('topo-c1');
    if (!encostaTopo()) return;
    raiz.classList.add('topo-c2');
    if (!encostaTopo()) return;
    raiz.classList.add('topo-c3');
  }
  window.addEventListener('resize', () => requestAnimationFrame(ajustarTopo));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => requestAnimationFrame(ajustarTopo));

  /** Itens do menu pelo modo (partida × treinos) e pelo fim de jogo. */
  function aplicarModoNoMenu() {
    const partida = modoAtual === 'partida';
    document.querySelectorAll('#menu [data-so]').forEach(b => { b.hidden = b.dataset.so !== (partida ? 'partida' : 'treino'); });
    // marcador de treino só no treino de condução (no de ataque a defesa já marca)
    if (el.marcador && !partida) el.marcador.closest('button').hidden = modoAtual === 'ataque';
    if (el.estadoModo) el.estadoModo.textContent = NOME_MODO[modoAtual] ?? '';
    el.modos?.querySelectorAll('[data-cmd="modo"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.valor === modoAtual)));
    // fim de jogo: "Jogar de novo" no lugar de Continuar
    const fim = partida && fimDeJogo;
    if (el.continuar) el.continuar.hidden = fim;
    if (el.reiniciarPartida) {
      el.reiniciarPartida.textContent = fim ? 'Jogar de novo' : 'Reiniciar partida';
      el.reiniciarPartida.classList.toggle('btn-primario', fim);
    }
  }
  function mostrarSubmenu(v) {
    if (!el.acoes || !el.modos) return;
    el.acoes.hidden = v; el.modos.hidden = !v;
    const alvo = v ? el.modos.querySelector('[aria-pressed="true"]') ?? el.modos.querySelector('button') : $('btn-modos');
    alvo?.focus({ preventScroll: true });
  }

  function mostrarAviso(texto, ms, cls = '') {
    el.aviso.textContent = texto;
    el.aviso.className = 'aviso visivel' + (cls ? ' ' + cls : '');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { el.aviso.classList.remove('visivel'); }, ms);
  }

  // ---------------------------------------------------------------- minimapa
  const mapa = { ctx: null, w: 0, h: 0, dpr: 0, ultimo: -1, fundo: null };
  function prepararMapa() {
    const c = el.mapa;
    if (!c) return false;
    const r = c.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w !== mapa.w || h !== mapa.h || dpr !== mapa.dpr || !mapa.ctx) {
      c.width = w; c.height = h;
      mapa.w = w; mapa.h = h; mapa.dpr = dpr;
      mapa.ctx = c.getContext('2d');
      mapa.fundo = desenharFundoMapa(w, h, dpr);
    }
    return true;
  }
  /** Campo (linhas verdes no preto) desenhado uma vez num canvas fora da tela. */
  function desenharFundoMapa(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const m = 3 * dpr;
    const sx = (w - 2 * m) / (2 * CAMPO_MX), sz = (h - 2 * m) / (2 * CAMPO_MZ);
    const X = x => m + (x + CAMPO_MX) * sx, Z = z => m + (z + CAMPO_MZ) * sz;
    g.fillStyle = 'rgba(6, 26, 15, 0.9)';
    g.fillRect(X(-CAMPO_MX), Z(-CAMPO_MZ), 2 * CAMPO_MX * sx, 2 * CAMPO_MZ * sz);
    g.strokeStyle = 'rgba(25, 224, 122, 0.55)';
    g.lineWidth = Math.max(1, dpr * 0.8);
    g.strokeRect(X(-CAMPO_MX), Z(-CAMPO_MZ), 2 * CAMPO_MX * sx, 2 * CAMPO_MZ * sz);
    g.beginPath(); g.moveTo(X(0), Z(-CAMPO_MZ)); g.lineTo(X(0), Z(CAMPO_MZ)); g.stroke();
    g.beginPath(); g.ellipse(X(0), Z(0), 9.15 * sx, 9.15 * sz, 0, 0, Math.PI * 2); g.stroke();
    for (const lado of [-1, 1]) {
      const x0 = lado * CAMPO_MX, x1 = lado * (CAMPO_MX - 16.5);
      g.strokeRect(Math.min(X(x0), X(x1)), Z(-20.16), Math.abs(X(x1) - X(x0)), 40.32 * sz);
      // gol
      g.fillStyle = 'rgba(25, 224, 122, 0.9)';
      g.fillRect(lado > 0 ? X(x0) : X(x0) - 2 * dpr, Z(-3.66), 2 * dpr, 7.32 * sz);
    }
    return c;
  }
  function desenharMapa(mundo, idControlado, idProximo) {
    if (!mundo || !prepararMapa()) return;
    const { ctx: g, w, h, dpr } = mapa;
    g.clearRect(0, 0, w, h);
    g.drawImage(mapa.fundo, 0, 0);
    const m = 3 * dpr;
    const sx = (w - 2 * m) / (2 * CAMPO_MX), sz = (h - 2 * m) / (2 * CAMPO_MZ);
    const X = x => m + (Math.max(-CAMPO_MX - 2, Math.min(CAMPO_MX + 2, x)) + CAMPO_MX) * sx;
    const Z = z => m + (Math.max(-CAMPO_MZ - 2, Math.min(CAMPO_MZ + 2, z)) + CAMPO_MZ) * sz;
    const r = Math.max(1.6, 1.9 * dpr * (w / dpr > 110 ? 1.15 : 1));
    let ctrl = null;
    for (const j of mundo.jogadores ?? []) {
      const gol = j.posicao === 'GOL';
      g.fillStyle = j.time === 1 ? (gol ? COR_MAPA.t1gol : COR_MAPA.t1) : (gol ? COR_MAPA.t0gol : COR_MAPA.t0);
      g.beginPath(); g.arc(X(j.x), Z(j.z), r, 0, Math.PI * 2); g.fill();
      if (j.id === idControlado) ctrl = j;
      else if (j.id === idProximo) {
        g.strokeStyle = 'rgba(255, 255, 255, 0.55)'; g.lineWidth = dpr * 0.8;
        g.beginPath(); g.arc(X(j.x), Z(j.z), r + 1.4 * dpr, 0, Math.PI * 2); g.stroke();
      }
    }
    if (ctrl) {
      // controlado: ponto maior com anel branco
      g.fillStyle = COR_MAPA.t0;
      g.beginPath(); g.arc(X(ctrl.x), Z(ctrl.z), r * 1.35, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = dpr * 1.1;
      g.beginPath(); g.arc(X(ctrl.x), Z(ctrl.z), r * 1.35 + 1.2 * dpr, 0, Math.PI * 2); g.stroke();
    }
    const b = mundo.bola?.p;
    if (b) {
      // bola por cima de tudo: branca, um pouco maior, com contorno escuro
      g.fillStyle = COR_MAPA.bola; g.strokeStyle = '#07090a'; g.lineWidth = dpr * 1.2;
      g.beginPath(); g.arc(X(b.x), Z(b.z), r * 1.1, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  return {
    /**
     * Velocidade (km/h), modo e posição do controlado. Modo e posição mudam na hora (só escreve
     * no DOM quando o texto muda: a troca de jogador aparece no mesmo quadro); o km/h, que muda
     * todo quadro, no máximo a 10 Hz.
     */
    atualizar(agoraMs, kmh, modo, forte, posicao = null) {
      let mudouTopo = false;
      if (modo !== ultimoTexto.modo) {
        el.modo.textContent = modo;
        el.modo.classList.toggle('sem-bola', modo === 'Sem bola');
        ultimoTexto.modo = modo;
        mudouTopo = true;
      }
      if (!!forte !== ultimoTexto.forte) { el.modo.classList.toggle('forte', !!forte); ultimoTexto.forte = !!forte; }
      if (el.posicao && posicao !== ultimoTexto.posicao) {
        el.posicao.hidden = !posicao;
        el.posicao.textContent = posicao ?? '';
        ultimoTexto.posicao = posicao;
        mudouTopo = true;
      }
      if (mudouTopo) ajustarTopo();
      // (o relógio manual dos testes pode voltar no tempo: aí atualiza logo)
      if (agoraMs - ultimoHud < 100 && agoraMs >= ultimoHud) return;
      ultimoHud = agoraMs;
      const v = String(Math.round(kmh));
      if (v !== ultimoTexto.vel) { el.vel.textContent = v; ultimoTexto.vel = v; }
    },
    /** Placar (gols do time 0 e do time 1). */
    placar(a, b) {
      const v = [a | 0, b | 0];
      for (let i = 0; i < 2; i++) {
        if (v[i] === placarVisto[i] || !el.gols[i]) continue;
        el.gols[i].textContent = String(v[i]);
        if (placarVisto[i] !== null) {
          el.gols[i].classList.remove('mudou');
          void el.gols[i].offsetWidth; // reinicia a animação
          el.gols[i].classList.add('mudou');
        }
        placarVisto[i] = v[i];
      }
    },
    /** Minimapa (no máximo ~30 vezes por segundo). */
    minimapa(agoraMs, mundo, idControlado, idProximo) {
      if (agoraMs - mapa.ultimo < 33 && agoraMs >= mapa.ultimo) return;
      mapa.ultimo = agoraMs;
      desenharMapa(mundo, idControlado, idProximo);
    },
    /**
     * Barra de força perto do jogador: c = null (some) ou {x, y (px CSS), forca 0–1, tipo}.
     * Fica sempre na tela (jogador no canto: a barra encosta na borda, não some).
     */
    carga(c) {
      if (!el.carga) return;
      if (!c) { if (el.carga.classList.contains('visivel')) el.carga.classList.remove('visivel', 'cheia'); return; }
      const x = Math.min(Math.max(c.x, 40), window.innerWidth - 40);
      const y = Math.min(Math.max(c.y, 70), window.innerHeight - 34);
      el.carga.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.cargaNivel.style.width = `${(Math.max(0, Math.min(1, c.forca)) * 100).toFixed(1)}%`;
      const rot = ROTULO_CARGA[c.tipo] ?? String(c.tipo ?? '').toUpperCase();
      if (el.cargaTipo.textContent !== rot) el.cargaTipo.textContent = rot;
      el.carga.classList.add('visivel');
      el.carga.classList.toggle('cheia', c.forca >= 0.999);
    },
    /** Evento da simulação (tipo ou o objeto do evento) → aviso curto; gol → "GOL!" grande. */
    evento(ev, extra = {}, forcar = false) {
      if (prints && !forcar) return;
      const tipo = typeof ev === 'string' ? ev : ev?.tipo;
      if (tipo === 'gol') {
        const t = typeof ev === 'object' ? ev.time : undefined;
        if (el.golQuem) el.golQuem.textContent = t === 0 || t === 1 ? times[t].nome : '';
        el.golTela?.classList.add('visivel');
        clearTimeout(timerGol);
        timerGol = setTimeout(() => { el.golTela?.classList.remove('visivel'); }, 2000);
        el.aviso.classList.remove('visivel');
        return;
      }
      const d = TEXTO_EVENTO[tipo];
      if (!d) return;
      let texto = extra.texto ?? d.t;
      if (typeof ev === 'object' && ev && !extra.texto) {
        if (tipo === 'passe' || tipo === 'chute') {
          const sub = ev.acao ?? ev.subtipo ?? ev.modo ?? ev.estilo ?? extra.tipoVoo;
          if (NOME_ACAO[sub]) texto = NOME_ACAO[sub];
        } else if (tipo === 'defesa') {
          const sub = ev.modo ?? ev.subtipo ?? ev.estilo ?? ev.como;
          if (NOME_DEFESA[sub]) texto = NOME_DEFESA[sub];
        }
      }
      mostrarAviso(texto, d.ms, d.forte ? 'forte' : '');
    },
    get menuAberto() { return !el.menu.hidden; },
    get ajudaAberta() { return !el.ajuda.hidden; },
    /** Abre a pausa; foco: seletor do botão que recebe o foco (padrão: o primário visível). */
    abrirMenu(forcar = false, foco = null) {
      if (prints && !forcar) return;
      el.ajuda.hidden = true; el.menu.hidden = false;
      if (el.acoes) el.acoes.hidden = false;
      if (el.modos) el.modos.hidden = true;
      const alvo = (foco && el.menu.querySelector(foco)) || [...el.menu.querySelectorAll('#menu-acoes .btn-primario')].find(b => !b.hidden);
      alvo?.focus({ preventScroll: true });
    },
    fecharMenu() { el.menu.hidden = true; },
    /** Lista "Modo de jogo" (partida e treinos) no lugar das ações do menu (true) ou de volta (false). */
    submenuModos: mostrarSubmenu,
    /** Siglas e nomes dos dois times (partida: do elenco) ou null (treino). */
    definirTimes(t) {
      times = t ?? TIMES_TREINO;
      times.forEach((x, i) => { if (el.siglas[i]) el.siglas[i].textContent = x.sigla; });
      ajustarTopo();
    },
    get times() { return times; },
    /**
     * Relógio da partida no placar: r = {minuto (0–90), tempo (1|2), estado} ou null (treino: some).
     * Só escreve no DOM quando muda.
     */
    relogio(r) {
      if (!el.relogio) return;
      const vis = !!r;
      if (vis !== relogioVisto.visivel) { el.relogio.hidden = !vis; relogioVisto.visivel = vis; ajustarTopo(); }
      if (!r) return;
      const min = `${r.minuto}'`;
      const tempo = r.estado === 'intervalo' ? 'Intervalo' : r.estado === 'fim' ? 'Fim' : NOME_TEMPO[r.tempo] ?? '';
      if (min !== relogioVisto.minuto) { el.minuto.textContent = min; relogioVisto.minuto = min; }
      if (tempo !== relogioVisto.tempo) {
        el.tempo.textContent = tempo; relogioVisto.tempo = tempo;
        el.relogio.classList.toggle('parado', r.estado === 'intervalo' || r.estado === 'fim');
        ajustarTopo();
      }
    },
    /**
     * Faixa no meio da tela: f = {titulo, placar, ms?, botao?} (botao = "Jogar de novo") ou null.
     * Sem ms, fica até ser trocada (fim de jogo). No modo de prints só aparece com forcar.
     */
    faixa(f, forcar = false) {
      if (!el.faixa) return;
      clearTimeout(timerFaixa);
      if (!f || (prints && !forcar)) { el.faixa.hidden = true; el.faixa.classList.remove('forcada'); return; }
      el.faixaTitulo.textContent = f.titulo ?? '';
      el.faixaPlacar.textContent = f.placar ?? '';
      el.faixaBotao.hidden = !f.botao;
      el.faixa.classList.toggle('forcada', !!forcar);
      el.faixa.hidden = false;
      if (f.ms) timerFaixa = setTimeout(() => { el.faixa.hidden = true; }, f.ms);
    },
    get faixaVisivel() { return !!el.faixa && !el.faixa.hidden; },
    abrirAjuda(forcar = false) { if (prints && !forcar) return; el.menu.hidden = true; el.ajuda.hidden = false; },
    fecharAjuda() { el.ajuda.hidden = true; },
    /** Recalcula o topo do HUD (os controles de toque apareceram ou a tela mudou). */
    ajustarTopo,
    /** Estado das opções no menu. */
    definirEstado(e) {
      // itens do menu por modo (partida × treinos) e pelo fim de jogo
      if (e.modoTreino !== undefined || e.fim !== undefined) {
        if (e.modoTreino !== undefined) modoAtual = e.modoTreino;
        if (e.fim !== undefined) fimDeJogo = !!e.fim;
        aplicarModoNoMenu();
      }
      if (e.qualidadeEscolha) marcarGrupo('qualidade', e.qualidadeEscolha);
      if (e.qualidadeAtual && el.infoQ) {
        el.infoQ.textContent = e.qualidadeEscolha === 'auto'
          ? `Agora: ${NOMES_Q[e.qualidadeAtual]} (ajusta sozinha pelo desempenho)`
          : `${NOMES_Q[e.qualidadeAtual]} — ${e.qualidadeAtual === 'alta' ? 'antisserrilhado e sombras finas' : e.qualidadeAtual === 'baixa' ? 'sem sombras, para celular mais simples' : 'sombras simples, boa para celular'}`;
      }
      if (e.hora) marcarGrupo('hora', e.hora);
      if (e.camera) marcarGrupo('camera', e.camera);
      if (typeof e.marcador === 'boolean' && el.marcador) {
        el.marcador.textContent = e.marcador ? 'ligado' : 'desligado';
        el.marcador.closest('button')?.setAttribute('aria-pressed', String(e.marcador));
      }
      if (typeof e.toqueTamanho === 'number' && el.tam) {
        el.tam.value = String(Math.round(e.toqueTamanho * 100));
        el.saidaTam.textContent = `${Math.round(e.toqueTamanho * 100)}%`;
      }
      if (typeof e.toqueOpacidade === 'number' && el.opa) {
        el.opa.value = String(Math.round(e.toqueOpacidade * 100));
        el.saidaOpa.textContent = `${Math.round(e.toqueOpacidade * 100)}%`;
      }
    },
    mostrarQps(v) { el.qps.hidden = !v; },
    get qpsVisivel() { return !el.qps.hidden; },
    qps(texto) { if (!el.qps.hidden) el.qps.textContent = texto; },
    progresso(msg) { if (el.msg) el.msg.textContent = msg; },
    pronto() {
      el.carregando.classList.add('sumir');
      setTimeout(() => { el.carregando.hidden = true; }, 400);
    },
    erro(msg) {
      el.carregando.hidden = false;
      el.carregando.classList.remove('sumir');
      el.carregando.classList.add('erro');
      if (el.msg) el.msg.textContent = msg;
    },
    modoPrints() {
      prints = true;
      document.documentElement.classList.add('modo-prints');
      el.menu.hidden = true; el.ajuda.hidden = true;
      el.carregando.hidden = true;
    },
  };
}
