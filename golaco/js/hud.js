// HUD (DOM): placar, velocidade e modo do jogador controlado, posição dele, minimapa, barra de
// força do passe/chute perto do jogador, avisos curtos de eventos, "GOL!" grande, menu de pausa,
// ajuda, contador de qps e tela de carregamento. Só mexe no DOM; quem decide é o main.js.
// Lê o mundo só para desenhar (placar, minimapa) e tolera campos que ainda não existem.

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
  troca: { t: 'Troca de jogador', ms: 800 },
  saidaGoleiro: { t: 'Goleiro saiu do gol', ms: 1200 },
  recomeco: { t: 'Recomeço da jogada', ms: 1000 },
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
// cores do minimapa (iguais aos uniformes — fictícios)
const COR_MAPA = {
  t0: '#19e07a', t0gol: '#c6ff3d', t1: '#dfe4e7', t1gol: '#d0631f', bola: '#ffffff',
};
// times fictícios: siglas do placar
const TIMES = [{ sigla: 'GLÇ', nome: 'Golaço' }, { sigla: 'VIS', nome: 'Visitante' }];

const NOMES_Q = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const CAMPO_MX = 52.5, CAMPO_MZ = 34;

/**
 * opc = {aoComando(cmd, valor)}. Comandos: continuar, recomecar, maquina, marcador, ajuda,
 * fechar-ajuda, qualidade, hora, camera, toqueTamanho, toqueOpacidade.
 */
export function criarHud(opc) {
  const $ = id => document.getElementById(id);
  const el = {
    vel: $('vel'), modo: $('modo'), posicao: $('posicao'), aviso: $('aviso'), qps: $('qps'), menu: $('menu'), ajuda: $('ajuda'),
    carregando: $('carregando'), msg: $('carregando-msg'), marcador: $('estado-marcador'), infoQ: $('info-qualidade'),
    tam: $('toque-tamanho'), opa: $('toque-opacidade'), saidaTam: $('saida-tamanho'), saidaOpa: $('saida-opacidade'),
    gols: [$('gols-0'), $('gols-1')], siglas: [$('sigla-0'), $('sigla-1')], golTela: $('gol-tela'), golQuem: $('gol-quem'),
    mapa: $('minimapa'), carga: $('carga'), cargaTipo: $('carga-tipo'), cargaNivel: $('carga-nivel'),
  };
  const cmd = (c, v) => opc.aoComando && opc.aoComando(c, v);
  let ultimoHud = -1;
  const ultimoTexto = { vel: '', modo: '', posicao: null };
  let timerAviso = null, timerGol = null;
  let prints = false;
  const placarVisto = [null, null];
  TIMES.forEach((t, i) => { if (el.siglas[i]) el.siglas[i].textContent = t.sigla; });

  // botões com data-cmd (menu e ajuda)
  document.querySelectorAll('[data-cmd]').forEach(b => {
    b.addEventListener('click', () => cmd(b.dataset.cmd));
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
    const rotulo = () => { btTela.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; };
    document.addEventListener('fullscreenchange', rotulo);
    rotulo();
  }
  el.opa?.addEventListener('input', () => { cmd('toqueOpacidade', +el.opa.value / 100); });

  function marcarGrupo(grupo, valor) {
    document.querySelectorAll(`.segmentado[data-grupo="${grupo}"] button`).forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.valor === valor));
    });
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
      g.fillStyle = COR_MAPA.bola; g.strokeStyle = '#07090a'; g.lineWidth = dpr;
      g.beginPath(); g.arc(X(b.x), Z(b.z), r * 0.95, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  return {
    /** Velocidade (km/h), modo e posição do controlado; atualiza o DOM no máximo a 10 Hz. */
    atualizar(agoraMs, kmh, modo, forte, posicao = null) {
      // (o relógio manual dos testes pode voltar no tempo: aí atualiza logo)
      if (agoraMs - ultimoHud < 100 && agoraMs >= ultimoHud) return;
      ultimoHud = agoraMs;
      const v = String(Math.round(kmh));
      if (v !== ultimoTexto.vel) { el.vel.textContent = v; ultimoTexto.vel = v; }
      if (modo !== ultimoTexto.modo) {
        el.modo.textContent = modo;
        el.modo.classList.toggle('sem-bola', modo === 'Sem bola');
        ultimoTexto.modo = modo;
      }
      el.modo.classList.toggle('forte', !!forte);
      if (el.posicao && posicao !== ultimoTexto.posicao) {
        el.posicao.hidden = !posicao;
        el.posicao.textContent = posicao ?? '';
        ultimoTexto.posicao = posicao;
      }
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
    /** Barra de força perto do jogador: c = null (some) ou {x, y (px CSS), forca 0–1, tipo}. */
    carga(c) {
      if (!el.carga) return;
      if (!c) { if (el.carga.classList.contains('visivel')) el.carga.classList.remove('visivel', 'cheia'); return; }
      el.carga.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px)`;
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
        if (el.golQuem) el.golQuem.textContent = t === 0 || t === 1 ? TIMES[t].nome : '';
        el.golTela?.classList.add('visivel');
        clearTimeout(timerGol);
        timerGol = setTimeout(() => { el.golTela?.classList.remove('visivel'); }, 2000);
        el.aviso.classList.remove('visivel');
        return;
      }
      const d = TEXTO_EVENTO[tipo];
      if (!d) return;
      let texto = d.t;
      if (typeof ev === 'object' && ev) {
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
    abrirMenu(forcar = false) { if (prints && !forcar) return; el.ajuda.hidden = true; el.menu.hidden = false; el.menu.querySelector('.btn-primario')?.focus({ preventScroll: true }); },
    fecharMenu() { el.menu.hidden = true; },
    abrirAjuda(forcar = false) { if (prints && !forcar) return; el.menu.hidden = true; el.ajuda.hidden = false; },
    fecharAjuda() { el.ajuda.hidden = true; },
    /** Estado das opções no menu. */
    definirEstado(e) {
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
