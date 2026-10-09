// HUD (DOM): velocidade e modo do jogador, avisos curtos de eventos, menu de pausa, ajuda,
// contador de qps e tela de carregamento. Só mexe no DOM; quem decide é o main.js (comandos).

const TEXTO_EVENTO = {
  gol: { t: 'Gol!', cls: 'gol', ms: 1800 },
  fora: { t: 'Bola fora', ms: 1300 },
  roubada: { t: 'Roubada!', ms: 1300 },
  perda: { t: 'Bola perdida', ms: 1300 },
  maquina: { t: 'Máquina: passe a caminho', ms: 1200 },
  marcadorLigado: { t: 'Marcador de treino ligado', ms: 1400 },
  marcadorDesligado: { t: 'Marcador de treino desligado', ms: 1400 },
  recomecar: { t: 'Bola no pé', ms: 900 },
};

const NOMES_Q = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

/**
 * opc = {aoComando(cmd, valor)}. Comandos: continuar, recomecar, maquina, marcador, ajuda,
 * fechar-ajuda, qualidade, hora, camera, toqueTamanho, toqueOpacidade.
 */
export function criarHud(opc) {
  const $ = id => document.getElementById(id);
  const el = {
    vel: $('vel'), modo: $('modo'), aviso: $('aviso'), qps: $('qps'), menu: $('menu'), ajuda: $('ajuda'),
    carregando: $('carregando'), msg: $('carregando-msg'), marcador: $('estado-marcador'), infoQ: $('info-qualidade'),
    tam: $('toque-tamanho'), opa: $('toque-opacidade'), saidaTam: $('saida-tamanho'), saidaOpa: $('saida-opacidade'),
  };
  const cmd = (c, v) => opc.aoComando && opc.aoComando(c, v);
  let ultimoHud = -1;
  let ultimoTexto = { vel: '', modo: '' };
  let timerAviso = null;
  let prints = false;

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

  return {
    /** Velocidade (km/h) e modo; atualiza o DOM no máximo a 10 Hz. */
    atualizar(agoraMs, kmh, modo, forte) {
      if (agoraMs - ultimoHud < 100) return;
      ultimoHud = agoraMs;
      const v = String(Math.round(kmh));
      if (v !== ultimoTexto.vel) { el.vel.textContent = v; ultimoTexto.vel = v; }
      if (modo !== ultimoTexto.modo) {
        el.modo.textContent = modo;
        el.modo.classList.toggle('sem-bola', modo === 'Sem bola');
        ultimoTexto.modo = modo;
      }
      el.modo.classList.toggle('forte', !!forte);
    },
    evento(tipo) {
      if (prints) return;
      const d = TEXTO_EVENTO[tipo];
      if (!d) return;
      el.aviso.textContent = d.t;
      el.aviso.className = 'aviso visivel' + (d.cls ? ' ' + d.cls : '');
      clearTimeout(timerAviso);
      timerAviso = setTimeout(() => { el.aviso.classList.remove('visivel'); }, d.ms);
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
