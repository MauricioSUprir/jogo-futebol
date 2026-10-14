// HUD (DOM): placar (com o relógio da partida), velocidade e modo do jogador controlado, posição
// dele, minimapa, barra de força do passe/chute perto do jogador, avisos curtos de eventos, "GOL!"
// grande, faixa do intervalo e do fim de jogo, menu de pausa (itens por modo: Editar time e
// Reiniciar partida na partida; Recomeçar, Máquina e Marcador só nos treinos; "Modo de jogo" com a
// partida e os treinos), ajuda, contador de qps e tela de carregamento. Só mexe no DOM; quem
// decide é o main.js. Lê o mundo só para desenhar (placar, minimapa) e tolera campos que ainda não
// existem. Tela limpa (dono, 11/10): na partida o "1º T" só aparece no intervalo, no fim e nos acréscimos
// (.com-tempo), a barra de força não escreve o tipo (o CSS esconde o rótulo), a dica de teclas do PC some em 8 s
// e o minimapa é opção da pausa (escondido = não redesenha).

import { aoTocar, engolirClique } from './toque-botao.js';

// prio: um aviso não apaga outro de prioridade MAIOR que ainda está na tela (a substituição e o
// resultado da edição do time saem no mesmo passo do recomeço e não podem sumir debaixo dele)
// Sem narração na tela (dono, 10/10: "não quero narração em cima"): os lances (passe, chute,
// defesa, troca, lateral, escanteio, bola fora...) não viram texto — o jogo mostra a jogada, não a
// descreve. Ficam só os avisos de COMANDO (menu, treino, edição do time); o gol tem o efeito próprio.
const TEXTO_EVENTO = {
  maquina: { t: 'Máquina: passe a caminho', ms: 1200 },
  marcadorLigado: { t: 'Marcador de treino ligado', ms: 1400 },
  marcadorDesligado: { t: 'Marcador de treino desligado', ms: 1400 },
  recomecar: { t: 'Bola no pé', ms: 900 },
  semMarcador: { t: 'Marcador só no treino de condução', ms: 1400 },
  soTreino: { t: 'Só nos treinos (menu, Modo de jogo)', ms: 1600 },
  // partida (Etapa 3): respostas à edição do time feita na pausa
  timeEditado: { t: 'Time atualizado', ms: 1600, forte: true, prio: 2 },
  edicaoRecusada: { t: 'Mudança no time recusada', ms: 2400, prio: 3 },
  // (a substituição feita não vira aviso de texto: a faixa ENTRA/SAI de TV — faixaSubst — mostra quem entra e quem sai)
  reinicio: { t: 'Partida reiniciada', ms: 1200 },
};
// faixa ENTRA/SAI (pedido do dono de 12/10: "embaixo, no modelo, a informação de quem entra e quem sai"; a exceção dele à
// regra sem narração: só sigla, ▲/▼, ENTRA/SAI, número e nome). Tempos em s (config.js SUBST.faixa).
const FAIXA_SUB = { min: 4.0, porPar: 2.5, porParMuitos: 1.8, teto: 10 };
// Selos da decisão da análise semiautomática do replay (terço de baixo): exatamente estes textos, sem nome nem minuto.
const SELOS = { impedimento: 'IMPEDIMENTO', legal: 'POSIÇÃO LEGAL' };
// bandeira do assistente (ícone do selo, na cor da decisão pelo CSS)
const ICONE_BANDEIRA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3.5"/><path d="M6 4h12.5l-3.2 4.2 3.2 4.3H6z"/></svg>';
// rótulo da barra de força por tipo de carga (fica no DOM; na partida o CSS esconde: tela limpa, 11/10)
const ROTULO_CARGA = {
  passe: 'PASSE', enfiada: 'ENFIADA', enfiadaAlta: 'ENFIADA ALTA', lancamento: 'LANÇAMENTO', cruzamento: 'CRUZAMENTO',
  chute: 'CHUTE', colocado: 'COLOCADO', cavadinha: 'CAVADINHA',
};
// cores do minimapa (pelos uniformes — fictícios). O visitante joga de branco, mas no minimapa
// fica cinza-azulado: branco é a cor da BOLA (com o mesmo branco, bola e visitante se confundiam)
const COR_MAPA = {
  t0: '#19e07a', t0gol: '#c6ff3d', t1: '#93a3ae', t1gol: '#d0631f', bola: '#ffffff',
};
// times fictícios: siglas e escudos do placar (treino; na partida vêm do elenco por definirTimes). O escudo é o id de um
// <symbol id="escudo-..."> do index.html (desenhados lá, fictícios); o visitante do treino veste o branco do Ventania
const TIMES_TREINO = [{ sigla: 'GLÇ', nome: 'Golaço', escudo: 'golaco' }, { sigla: 'VIS', nome: 'Visitante', escudo: 'ventania' }];
const ESCUDOS = new Set(['golaco', 'ventania']);
const NOME_TEMPO = { 1: '1º T', 2: '2º T' };

const NOMES_Q = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const CAMPO_MX = 52.5, CAMPO_MZ = 34;

/**
 * opc = {aoComando(cmd, valor)}. Comandos: continuar, recomecar, maquina, marcador, ajuda,
 * fechar-ajuda, qualidade, hora, camera, toqueTamanho, toqueOpacidade, editar-time,
 * reiniciar-partida, modos, modos-voltar, modo (valor: partida | ataque | conducao), som (ligado |
 * desligado), volume (0–1), minimapa e nomes (sem valor: alterna; tela limpa, 11/10), replay (o "Replay" da pausa),
 * replay-pular, replayAuto (ligado | desligado), comemoracao-pular, substituicao-pular, subst-ciclo (a opção "Cena de
 * substituição" do "Modo de jogo": ligada ↔ só a faixa).
 */
export function criarHud(opc) {
  const $ = id => document.getElementById(id);
  const el = {
    vel: $('vel'), modo: $('modo'), posicao: $('posicao'), aviso: $('aviso'), qps: $('qps'), menu: $('menu'), ajuda: $('ajuda'),
    carregando: $('carregando'), msg: $('carregando-msg'), marcador: $('estado-marcador'), infoQ: $('info-qualidade'),
    tam: $('toque-tamanho'), opa: $('toque-opacidade'), saidaTam: $('saida-tamanho'), saidaOpa: $('saida-opacidade'),
    gols: [$('gols-0'), $('gols-1')], siglas: [$('sigla-0'), $('sigla-1')], golTela: $('gol-tela'),
    escudos: [$('escudo-0'), $('escudo-1')], timesPlacar: [$('placar-time-0'), $('placar-time-1')],
    somVol: $('som-volume'), saidaVol: $('saida-volume'), infoSom: $('info-som'),
    mapa: $('minimapa'), cartao: $('cartao-icone'), carga: $('carga'), cargaTipo: $('carga-tipo'), cargaNivel: $('carga-nivel'),
    relogio: $('placar-relogio'), minuto: $('relogio'), tempo: $('relogio-tempo'),
    faixa: $('faixa'), faixaTitulo: $('faixa-titulo'), faixaPlacar: $('faixa-placar'), faixaBotao: $('faixa-botao'),
    acoes: $('menu-acoes'), modos: $('menu-modos'), estadoModo: $('estado-modo'), continuar: $('btn-continuar'),
    reiniciarPartida: $('btn-reiniciar-partida'), dica: $('dica'), replay: $('replay'), replayFaixa: $('replay-faixa'),
    comemoracao: $('comemoracao'), substituicao: $('substituicao'), faixaSub: $('faixa-subst'),
    terco: $('terco'),
  };
  const cmd = (c, v) => opc.aoComando && opc.aoComando(c, v);
  let ultimoHud = -1, tercoTipo = null;
  const ultimoTexto = { vel: '', modo: '', posicao: null, forte: false };
  let timerAviso = null, timerGol = null;
  // o "GOL!" dura o mesmo que a animação do CSS (2,4 s: some antes da saída de bola, PARTIDA.golPausa 2,5 s)
  const golDuracaoMs = 2400;
  let prints = false;
  const placarVisto = [null, null];
  let times = TIMES_TREINO;
  const relogioVisto = { minuto: null, tempo: null, visivel: null, comTempo: null };
  let timerFaixa = null;
  let modoAtual = null, fimDeJogo = false;
  let ajudaDaPausa = false; // a Ajuda foi aberta pela pausa: fechar volta para ela
  const NOME_MODO = { partida: 'partida', ataque: 'treino de ataque', conducao: 'treino de condução' };
  /** Sigla, escudo e nome (só para leitores de tela: nenhum texto novo na tela) de cada time no placar. */
  function escreverTimes() {
    times.forEach((t, i) => {
      if (el.siglas[i]) el.siglas[i].textContent = t.sigla;
      if (el.escudos[i]) el.escudos[i].setAttribute('href', `#escudo-${ESCUDOS.has(t.escudo) ? t.escudo : TIMES_TREINO[i].escudo}`);
      if (el.timesPlacar[i]) el.timesPlacar[i].setAttribute('aria-label', t.nome ?? t.sigla);
    });
  }
  escreverTimes();

  // botões com data-cmd (menu, ajuda e faixa); data-valor vai junto (modo de jogo). Pelo toque age no pointerup do mesmo
  // dedo (aoTocar): com outro dedo na tela (o polegar no analógico, um dedo parado na janela) o click não vem
  document.querySelectorAll('[data-cmd]').forEach(b => {
    aoTocar(b, () => cmd(b.dataset.cmd, b.dataset.valor));
  });
  // grupos segmentados
  document.querySelectorAll('.segmentado').forEach(g => {
    aoTocar(g, e => {
      const b = e.target.closest('button[data-valor]');
      if (b) cmd(g.dataset.grupo, b.dataset.valor);
    });
  });
  // fundo escuro fecha a janela (o click do mesmo toque não cai no ≡ que fica embaixo e reabre a pausa)
  for (const s of [el.menu, el.ajuda]) {
    s?.addEventListener('pointerdown', e => {
      if (e.target === s) { engolirClique(e); cmd(s === el.menu ? 'continuar' : 'fechar-ajuda'); }
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
  el.somVol?.addEventListener('input', () => { cmd('volume', +el.somVol.value / 100); });
  // replay: a camada cobre a tela inteira — qualquer toque ou clique pula (o "Pular" do toque é só o alvo visível)
  // (o click do mesmo toque é engolido: no canto de cima à direita ele caía no ≡ e abria a pausa)
  el.replay?.addEventListener('pointerdown', e => { e.preventDefault(); engolirClique(e); cmd('replay-pular'); });
  // comemoração do gol: a mesma camada (qualquer toque ou clique pula, depois de 0,5 s — quem decide é o main.js)
  el.comemoracao?.addEventListener('pointerdown', e => { e.preventDefault(); engolirClique(e); cmd('comemoracao-pular'); });
  // cena de substituição: a mesma camada (qualquer toque ou clique pula, depois de 0,5 s — quem decide é o main.js)
  el.substituicao?.addEventListener('pointerdown', e => { e.preventDefault(); engolirClique(e); cmd('substituicao-pular'); });

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
    // caixa escondida (o painel some na partida) não encosta em nada
    const enc = (a, b) => a.width > 0 && b.width > 0 && a.left < b.right + 6 && b.left < a.right + 6 && a.top < b.bottom + 4 && b.top < a.bottom + 4;
    // o botão de menu também conta: no celular em pé, o placar com o relógio da partida chega nele
    // (a largura depende da fonte do aparelho — no CI encostava e aqui não)
    const mn = $('btn-menu')?.getBoundingClientRect();
    return enc(pl, mp) || enc(pa, mp) || enc(pl, pa) || (mn && mn.width > 0 && enc(pl, mn));
  }
  /**
   * Algum botão de toque (de QUALQUER fase: a posição de cada vaga vem do style que a entrada
   * escreve) encosta no placar, no minimapa ou no painel? Com o arco grande (140%) e os 5 botões da
   * defesa da Etapa 3, a vaga de cima chega à faixa do topo.
   */
  function botaoNoTopo() {
    const caixas = caixasTopo.map(e => e?.getBoundingClientRect()).filter(r => r && r.width > 0);
    for (const b of document.querySelectorAll('#toque .btn-toque[style]')) {
      const d = parseFloat(b.style.width), x = parseFloat(b.style.left) + d / 2, y = parseFloat(b.style.top) + d / 2;
      if (!(d > 0)) continue;
      for (const r of caixas) {
        const qx = Math.max(r.left, Math.min(x, r.right)), qy = Math.max(r.top, Math.min(y, r.bottom));
        if (Math.hypot(x - qx, y - qy) < d / 2 + 8) return true;
      }
    }
    return false;
  }
  function ajustarTopo() {
    raiz.classList.remove('topo-c1', 'topo-c2', 'topo-c3', 'topo-c4', 'topo-desce');
    if (el.mapa) { el.mapa.style.left = ''; el.mapa.style.transform = ''; }
    if (!raiz.classList.contains('com-toque')) return;
    // o painel (modo e posição) desce para baixo do placar, à esquerda, se o arco chega nele
    if (botaoNoTopo()) raiz.classList.add('topo-desce');
    apertarTopo();
    // nos treinos a marca do GOLAÇO só fica de fora se fizer falta: quem encosta costuma ser o painel, e apertar o painel
    // (passo 2) já resolve (contraprova de 13/10: em 568 e 667 px ela saía com 40–90 px livres à direita do placar)
    if (raiz.classList.contains('topo-c1') && !raiz.classList.contains('em-partida') && !el.mapa?.style.left) {
      raiz.classList.remove('topo-c1');
      if (encostaTopo()) raiz.classList.add('topo-c1');
    }
  }
  /** Os passos do aperto, em ordem, até nada encostar (ajustarTopo). */
  function apertarTopo() {
    if (!encostaTopo()) return;
    raiz.classList.add('topo-c1');
    if (!encostaTopo()) return;
    raiz.classList.add('topo-c2');
    if (!encostaTopo()) return;
    // na partida o tempo escrito ("1º T +4", "Intervalo", "Fim") só sai se nem com o minimapa encostado à direita do
    // placar couber (contraprova de 13/10: em 667 e 568 px ele saía antes, com espaço sobrando depois do minimapa)
    const partida = raiz.classList.contains('em-partida');
    if (!partida) { raiz.classList.add('topo-c3'); if (!encostaTopo()) return; }
    raiz.classList.add('topo-c4');
    if (!encostaTopo() || !el.mapa) return;
    // 5) celular bem estreito (568 px com entalhe): o minimapa sai do meio e encosta à direita do placar
    mapaAoLado();
    if (!partida || !encostaTopo()) return;
    raiz.classList.add('topo-c3');
    mapaAoLado();
  }
  function mapaAoLado() {
    const pl = caixasTopo[0]?.getBoundingClientRect();
    if (pl && pl.width > 0) { el.mapa.style.left = `${Math.round(pl.right + 8)}px`; el.mapa.style.transform = 'none'; }
  }
  window.addEventListener('resize', () => requestAnimationFrame(ajustarTopo));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => requestAnimationFrame(ajustarTopo));

  /** A dica de teclas do PC aparece de novo e some 8 s depois (CSS .dica: animação que começa ao ser reposta). */
  function mostrarDica() {
    if (!el.dica) return;
    el.dica.style.animation = 'none';
    void el.dica.offsetWidth;
    el.dica.style.animation = '';
  }
  /** Itens do menu pelo modo (partida × treinos) e pelo fim de jogo. */
  function aplicarModoNoMenu() {
    const partida = modoAtual === 'partida';
    // na partida o topo fica só com placar, minimapa e menu (sem o painel "Conduzindo"/posição/km/h:
    // é narração na tela); nos treinos o painel continua (é o retorno do exercício)
    raiz.classList.toggle('em-partida', partida);
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

  const avisoAtual = { tipo: null, prio: 0, ate: 0, texto: '' };
  function mostrarAviso(texto, ms, cls = '', prio = 1, tipo = null) {
    const agora = performance.now();
    const vivo = el.aviso.classList.contains('visivel') && agora < avisoAtual.ate;
    if (vivo && avisoAtual.prio > prio) return;
    el.aviso.textContent = texto;
    el.aviso.className = 'aviso visivel' + (cls ? ' ' + cls : '');
    Object.assign(avisoAtual, { tipo, prio, ate: agora + ms, texto });
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { el.aviso.classList.remove('visivel'); }, ms);
  }

  // ---------------------------------------------------------------- faixa ENTRA/SAI (lower third de TV)
  // pares = [{time, sigla, nomeTime, cor, corTexto, entra: {num, nome, camisa}, sai: {...}}]. Um par por página: na cena a
  // página vem do main.js (o par do plano); no jogo ela passa pelo tempo (porPar s), sem recomeçar a contagem. Fica
  // ≥ FAIXA_SUB.min s (mesmo com a cena pulada), até FAIXA_SUB.teto; na cena, até ela acabar. O relógio é o do laço
  // (agora, ms): o mesmo dos testes com o relógio manual.
  const fsEl = el.faixaSub ? (() => {
    const linha = sel => { const l = el.faixaSub.querySelector(sel); return { l, num: l.querySelector('.fs-num'), nome: l.querySelector('.fs-nome-completo'), curto: l.querySelector('.fs-nome-curto') }; };
    return { sigla: el.faixaSub.querySelector('.fs-sigla'), sr: el.faixaSub.querySelector('.fs-sr'), conta: el.faixaSub.querySelector('.fs-conta'), entra: linha('.fs-entra'), sai: linha('.fs-sai') };
  })() : null;
  const fs = { pares: null, t0: 0, dur: 0, porPar: FAIXA_SUB.porPar, pagina: -1, modo: null, destaque: null };
  const textoPar = p => `${p.nomeTime}: entra ${p.entra.num} ${p.entra.nome}, sai ${p.sai.num} ${p.sai.nome}`;
  function paginaFaixa(i) {
    const p = fs.pares[i];
    fsEl.sigla.textContent = p.sigla;
    el.faixaSub.style.setProperty('--cor-time', p.cor);
    el.faixaSub.style.setProperty('--cor-time-texto', p.corTexto);
    for (const k of ['entra', 'sai']) { const q = fsEl[k]; q.num.textContent = String(p[k].num ?? ''); q.nome.textContent = p[k].nome; q.curto.textContent = p[k].camisa; }
    fsEl.conta.textContent = fs.pares.length > 1 ? `${i + 1}/${fs.pares.length}` : '';
    const t = textoPar(p);
    el.faixaSub.dataset.texto = t;
    fsEl.sr.textContent = t;
    fs.pagina = i;
  }
  function esconderFaixaSub() {
    fs.pares = null; fs.pagina = -1; fs.modo = null;
    if (!el.faixaSub) return;
    el.faixaSub.hidden = true;
    el.faixaSub.classList.remove('visivel', 'cena', 'jogo');
    el.faixaSub.dataset.texto = '';
    raiz.classList.remove('faixa-subst-topo');
  }
  function quadroFaixaSub(agora, cena) {
    if (!fs.pares || !el.faixaSub) return;
    const t = (agora - fs.t0) / 1000;
    if (!cena && t >= fs.dur) { esconderFaixaSub(); return; }
    const n = fs.pares.length;
    const pg = cena && cena.pagina != null ? Math.max(0, Math.min(n - 1, cena.pagina)) : Math.floor(Math.max(0, t) / fs.porPar) % n;
    if (pg !== fs.pagina) paginaFaixa(pg);
    const modo = cena ? 'cena' : 'jogo';
    if (modo !== fs.modo) {
      fs.modo = modo;
      el.faixaSub.classList.toggle('cena', modo === 'cena');
      el.faixaSub.classList.toggle('jogo', modo === 'jogo');
      // celular, no jogo: a linha compacta fica no lugar do aviso (o aviso desce para baixo dela)
      raiz.classList.toggle('faixa-subst-topo', modo === 'jogo');
    }
    const d = cena ? cena.destaque ?? null : null;
    if (d !== fs.destaque) {
      fs.destaque = d;
      fsEl.entra.l.classList.toggle('destaque', !d || d === 'entra');
      fsEl.sai.l.classList.toggle('destaque', !d || d === 'sai');
    }
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
    let ctrl = null, prox = null;
    const js = mundo.jogadores ?? [];
    // um preenchimento por cor (4 no total, não um por jogador): com 22 em campo o minimapa era o
    // item mais caro do HUD no celular
    for (let cor = 0; cor < 4; cor++) {
      const t = cor >> 1, gol = (cor & 1) === 1;
      g.fillStyle = t === 1 ? (gol ? COR_MAPA.t1gol : COR_MAPA.t1) : (gol ? COR_MAPA.t0gol : COR_MAPA.t0);
      g.beginPath();
      for (let k = 0; k < js.length; k++) {
        const j = js[k];
        if ((j.time === 1 ? 1 : 0) !== t || (j.posicao === 'GOL') !== gol) continue;
        const x = X(j.x), z = Z(j.z);
        g.moveTo(x + r, z); g.arc(x, z, r, 0, Math.PI * 2);
        if (j.id === idControlado) ctrl = j; else if (j.id === idProximo) prox = j;
      }
      g.fill();
    }
    if (prox) {
      g.strokeStyle = 'rgba(255, 255, 255, 0.55)'; g.lineWidth = dpr * 0.8;
      g.beginPath(); g.arc(X(prox.x), Z(prox.z), r + 1.4 * dpr, 0, Math.PI * 2); g.stroke();
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
      let largura = false;
      for (let i = 0; i < 2; i++) {
        if (v[i] === placarVisto[i] || !el.gols[i]) continue;
        // 9 → 10: o placar alarga e, apertado com o minimapa ao lado, encostaria nele (contraprova de 13/10)
        if (String(v[i]).length !== String(placarVisto[i] ?? 0).length) largura = true;
        el.gols[i].textContent = String(v[i]);
        if (placarVisto[i] !== null) {
          el.gols[i].classList.remove('mudou');
          void el.gols[i].offsetWidth; // reinicia a animação
          el.gols[i].classList.add('mudou');
        }
        placarVisto[i] = v[i];
      }
      if (largura) ajustarTopo();
    },
    /**
     * Minimapa (no máximo ~30 vezes por segundo; 20 com os controles de toque, no celular). Escondido (opção da
     * pausa; o padrão do celular) não redesenha nada.
     */
    minimapa(agoraMs, mundo, idControlado, idProximo) {
      const toque = raiz.classList.contains('com-toque');
      if (raiz.classList.contains('mapa-desligado') || (toque && !raiz.classList.contains('mapa-ligado'))) return;
      const intervalo = toque ? 50 : 33;
      if (agoraMs - mapa.ultimo < intervalo && agoraMs >= mapa.ultimo) return;
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
    /** Cartão em cima de quem levou: c = null (some) ou {x, y (px CSS, a cabeça), cor: 'amarelo' | 'vermelho'}. */
    cartao(c) {
      if (!el.cartao) return;
      if (!c) { if (el.cartao.classList.contains('visivel')) el.cartao.classList.remove('visivel'); return; }
      const x = Math.min(Math.max(c.x, 20), window.innerWidth - 20);
      const y = Math.min(Math.max(c.y, 80), window.innerHeight - 20);
      el.cartao.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.cartao.classList.toggle('amarelo', c.cor === 'amarelo');
      el.cartao.classList.toggle('vermelho', c.cor === 'vermelho');
      el.cartao.classList.add('visivel');
    },
    /** Evento (tipo ou o objeto do evento): gol → "GOL!" grande; comando → aviso curto; lance → nada. */
    evento(ev, extra = {}, forcar = false) {
      if (prints && !forcar) return;
      const tipo = typeof ev === 'string' ? ev : ev?.tipo;
      if (tipo === 'gol') {
        // só o efeito: "GOL!", a faixa e o placar pulsando — autor e minuto escritos seriam narração
        // na tela (dono, 10/10: "não quero narração em cima")
        // reinicia a animação (gol logo depois de outro, ou o print forçado)
        el.golTela?.classList.remove('visivel');
        // extra.fixo (prints de conferência): o aviso FICA na tela — sem o apagar do fim da animação nem o
        // tempo (antes só o tempo saía e a animação apagava em 2,4 s; contraprova M10)
        el.golTela?.classList.toggle('fixo', !!extra.fixo);
        void el.golTela?.offsetWidth;
        el.golTela?.classList.add('visivel');
        clearTimeout(timerGol);
        if (!extra.fixo) timerGol = setTimeout(() => { el.golTela?.classList.remove('visivel'); }, golDuracaoMs);
        // placar pulsando
        const pl = el.golTela ? $('hud')?.querySelector('.placar') : null;
        if (pl) { pl.classList.remove('gol-pulso'); void pl.offsetWidth; pl.classList.add('gol-pulso'); }
        el.aviso.classList.remove('visivel');
        return;
      }
      const d = TEXTO_EVENTO[tipo];
      if (!d) return;
      const texto = extra.texto ?? d.t;
      mostrarAviso(texto, d.ms, d.forte ? 'forte' : '', d.prio ?? 1, tipo);
    },
    get menuAberto() { return !el.menu.hidden; },
    get ajudaAberta() { return !el.ajuda.hidden; },
    /** Abre a pausa; foco: seletor do botão que recebe o foco (padrão: o primário visível). */
    /**
     * Controle na pausa ou na Ajuda (main.js, ações 'menu-*'): cima/esquerda e baixo/direita movem o foco entre os botões
     * visíveis (no deslizante em foco, esquerda/direita mudam o valor), ok aperta o botão em foco e voltar fecha a
     * Ajuda, sai do "Modo de jogo" ou fecha a pausa.
     */
    navegarPad(acao) {
      const raizAberta = !el.ajuda.hidden ? el.ajuda : !el.menu.hidden ? el.menu : null;
      if (!raizAberta) return;
      if (acao === 'voltar') {
        if (raizAberta === el.ajuda) cmd('fechar-ajuda');
        else if (el.modos && !el.modos.hidden) cmd('modos-voltar');
        else cmd('continuar');
        return;
      }
      const lista = [...raizAberta.querySelectorAll('button, input[type="range"]')]
        .filter(b => !b.disabled && !b.hidden && b.getClientRects().length > 0 && getComputedStyle(b).visibility !== 'hidden');
      if (!lista.length) return;
      const at = document.activeElement, i = lista.indexOf(at);
      if (acao === 'ok') {
        if (i >= 0 && at.tagName === 'BUTTON') at.click();
        else if (i < 0) lista[0].focus({ preventScroll: false });
        return;
      }
      if ((acao === 'esq' || acao === 'dir') && i >= 0 && at.type === 'range') {
        const st = +at.step || 1;
        at.value = String(+at.value + (acao === 'dir' ? st : -st));
        at.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      const passo = acao === 'cima' || acao === 'esq' ? -1 : 1;
      const k = i < 0 ? 0 : (i + passo + lista.length) % lista.length;
      lista[k].focus({ preventScroll: false });
      lista[k].scrollIntoView?.({ block: 'nearest' });
    },
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
    /** Siglas, nomes e escudos ({sigla, nome, escudo: id do elenco}) dos dois times (partida: do elenco) ou null (treino). */
    definirTimes(t) {
      times = t ?? TIMES_TREINO;
      escreverTimes();
      ajustarTopo();
    },
    get times() { return times; },
    /**
     * Relógio da partida no placar: r = {minuto (0–90), tempo (1|2), estado, acrescimo: {anunciado, decorrido} |
     * null} ou null (treino: some). Nos acréscimos: "45+2'" e o anúncio ao lado do tempo ("1º T +4"), como na TV.
     * Só escreve no DOM quando muda.
     */
    relogio(r) {
      if (!el.relogio) return;
      const vis = !!r;
      if (vis !== relogioVisto.visivel) { el.relogio.hidden = !vis; relogioVisto.visivel = vis; ajustarTopo(); }
      if (!r) return;
      const ac = r.acrescimo;
      const min = ac && ac.decorrido > 0 ? `${r.minuto}+${ac.decorrido}'` : `${r.minuto}'`;
      const tempo = r.estado === 'intervalo' ? 'Intervalo' : r.estado === 'fim' ? 'Fim' : `${NOME_TEMPO[r.tempo] ?? ''}${ac ? ` +${ac.anunciado}` : ''}`;
      // o tempo escrito ao lado do minuto só no intervalo, no fim e nos acréscimos ("1º T +4", como na TV): no resto
      // da partida o placar fica só com o minuto (tela limpa; o texto continua no DOM)
      const comTempo = r.estado === 'intervalo' || r.estado === 'fim' || !!ac;
      if (comTempo !== relogioVisto.comTempo) {
        el.relogio.classList.toggle('com-tempo', comTempo); relogioVisto.comTempo = comTempo;
        ajustarTopo();
      }
      if (min !== relogioVisto.minuto) {
        // 9' → 10': o placar alarga (a compactação do topo é refeita só quando muda o número de dígitos)
        const largura = (relogioVisto.minuto ?? '').length !== min.length;
        el.minuto.textContent = min; relogioVisto.minuto = min;
        if (largura) ajustarTopo();
      }
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
    /** Abre a Ajuda; aberta pela pausa, fechar volta para a pausa (antes o jogo recomeçava sem aviso). */
    abrirAjuda(forcar = false) {
      if (prints && !forcar) return;
      ajudaDaPausa = !el.menu.hidden;
      el.menu.hidden = true; el.ajuda.hidden = false;
    },
    fecharAjuda() {
      el.ajuda.hidden = true;
      if (ajudaDaPausa) { ajudaDaPausa = false; this.abrirMenu(true, '[data-cmd="ajuda"]'); }
    },
    /** Recalcula o topo do HUD (os controles de toque apareceram ou a tela mudou). */
    ajustarTopo,
    /** Estado das opções no menu. */
    definirEstado(e) {
      // itens do menu por modo (partida × treinos) e pelo fim de jogo
      if (e.modoTreino !== undefined || e.fim !== undefined) {
        // modo novo: a dica de teclas do PC aparece de novo por 8 s
        if (e.modoTreino !== undefined && modoAtual !== null && e.modoTreino !== modoAtual) mostrarDica();
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
      // tela limpa: minimapa e nomes nos botões nos botões de liga/desliga da pausa (o estado que vale agora,
      // escolhido ou o padrão do aparelho)
      if (typeof e.minimapa === 'boolean') $('chip-minimapa')?.setAttribute('aria-pressed', String(e.minimapa));
      if (typeof e.nomes === 'boolean') $('chip-nomes')?.setAttribute('aria-pressed', String(e.nomes));
      if (typeof e.marcador === 'boolean' && el.marcador) {
        el.marcador.textContent = e.marcador ? 'ligado' : 'desligado';
        el.marcador.closest('button')?.setAttribute('aria-pressed', String(e.marcador));
      }
      if (typeof e.toqueTamanho === 'number' && el.tam) {
        el.tam.value = String(Math.round(e.toqueTamanho * 100));
        el.saidaTam.textContent = `${Math.round(e.toqueTamanho * 100)}%`;
      }
      if (typeof e.som === 'boolean') marcarGrupo('som', e.som ? 'ligado' : 'desligado');
      if (typeof e.replayAuto === 'boolean') marcarGrupo('replayAuto', e.replayAuto ? 'ligado' : 'desligado');
      if (typeof e.volume === 'number' && el.somVol) {
        el.somVol.value = String(Math.round(e.volume * 100));
        el.saidaVol.textContent = `${Math.round(e.volume * 100)}%`;
      }
      if (typeof e.somEstado === 'string' && el.infoSom) {
        el.infoSom.textContent = e.somEstado === 'sem-audio' ? 'Este navegador não tem Web Audio: sem som.'
          : e.somEstado === 'desligado' ? 'Som desligado'
            : e.somEstado === 'rodando' ? 'Torcida, apito e rede' : 'Toque na tela ou aperte uma tecla para o som começar';
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
      mostrarDica(); // os 8 s da dica contam a partir de quando o jogo aparece
      el.carregando.classList.add('sumir');
      setTimeout(() => { el.carregando.hidden = true; }, 400);
    },
    erro(msg) {
      el.carregando.hidden = false;
      el.carregando.classList.remove('sumir');
      el.carregando.classList.add('erro');
      if (el.msg) el.msg.textContent = msg;
    },
    /**
     * Replay ligado/desligado: a marca "REPLAY" no canto (marca da transmissão — nenhum lance vira texto), o "Pular"
     * (só com toque) e a camada que pega qualquer toque; o resto do HUD de jogo (minimapa, menu, avisos, botões de
     * toque) some (html.em-replay). Entrando e saindo, a faixa verde cruza a tela (a "vinheta" de replay da TV).
     */
    replay(ativo) {
      ativo = !!ativo;
      if (raiz.classList.contains('em-replay') === ativo) return;
      raiz.classList.toggle('em-replay', ativo);
      if (el.replay) el.replay.hidden = !ativo;
      const f = el.replayFaixa;
      if (f) { f.classList.remove('passa'); void f.offsetWidth; f.classList.add('passa'); }
    },
    get replayVisivel() { return !!el.replay && !el.replay.hidden; },
    /**
     * Comemoração do gol ligada/desligada (html.em-comemoracao): do HUD de jogo fica só o placar (e o "GOL!" até o 1º
     * corte); minimapa, menu, avisos, barra de força, cartão e botões de toque somem (no celular os botões cobriam o
     * autor); a camada pega qualquer toque (pular) e o "Pular" aparece só com toque. Nenhum texto de lance.
     */
    comemoracao(ativo) {
      ativo = !!ativo;
      if (raiz.classList.contains('em-comemoracao') === ativo) return;
      raiz.classList.toggle('em-comemoracao', ativo);
      if (el.comemoracao) el.comemoracao.hidden = !ativo;
    },
    get comemoracaoVisivel() { return !!el.comemoracao && !el.comemoracao.hidden; },
    /**
     * Cena de substituição ligada/desligada (html.em-substituicao): do HUD de jogo fica só o placar (e a faixa ENTRA/SAI);
     * minimapa, menu, avisos, barra de força, cartão e botões de toque somem; a camada pega qualquer toque (pular) e o
     * "Pular" aparece só com toque.
     */
    substituicao(ativo) {
      ativo = !!ativo;
      if (raiz.classList.contains('em-substituicao') === ativo) return;
      raiz.classList.toggle('em-substituicao', ativo);
      if (el.substituicao) el.substituicao.hidden = !ativo;
    },
    get substituicaoVisivel() { return !!el.substituicao && !el.substituicao.hidden; },
    /**
     * Faixa ENTRA/SAI: pares (ver quadroFaixaSub) ou null (some); agora = o relógio do laço (ms). Começa no modo da cena
     * se `cena` vier ({pagina, destaque: 'sai' | 'entra'}); senão no do jogo. Fica ≥ 4 s (2,5 s por par; 1,8 com 4 ou
     * mais; teto 10 s).
     */
    faixaSubst(pares, agora, cena = null) {
      if (!el.faixaSub) return;
      if (!pares || !pares.length) { esconderFaixaSub(); return; }
      const n = pares.length, pp = n >= 4 ? FAIXA_SUB.porParMuitos : FAIXA_SUB.porPar;
      fs.pares = pares; fs.t0 = agora; fs.porPar = pp; fs.dur = Math.min(FAIXA_SUB.teto, Math.max(FAIXA_SUB.min, n * pp));
      fs.pagina = -1; fs.modo = null; fs.destaque = undefined;
      el.faixaSub.hidden = false;
      el.faixaSub.classList.remove('visivel'); void el.faixaSub.offsetWidth; el.faixaSub.classList.add('visivel');
      quadroFaixaSub(agora, cena);
    },
    /** Um quadro da faixa (página, modo, destaque, fim). cena = {pagina, destaque} durante a cena; null no jogo. */
    faixaSubstQuadro: quadroFaixaSub,
    /** Estado da faixa (testes): {visivel, modo, pagina, n, texto, restante (s)}. */
    faixaSubstEstado(agora) {
      const vis = !!el.faixaSub && !el.faixaSub.hidden && !!fs.pares;
      return { visivel: vis, modo: fs.modo, pagina: fs.pagina, n: fs.pares?.length ?? 0, texto: el.faixaSub?.dataset.texto ?? '', restante: vis ? fs.dur - (agora - fs.t0) / 1000 : 0, dur: fs.dur };
    },
    /** A faixa ENTRA/SAI sai já (mundo novo). */
    esconderFaixaSubst: esconderFaixaSub,
    /** A faixa verde cruza a tela (a cortina da comemoração pulada antes da hora: os passos que faltam rodam por baixo). */
    cortina() {
      const f = el.replayFaixa;
      if (f) { f.classList.remove('passa'); void f.offsetWidth; f.classList.add('passa'); }
    },
    /**
     * Terço de baixo (canto de baixo à esquerda): spec = null (some) | {tipo: 'impedimento'} | {tipo: 'legal'} — o SELO
     * da decisão no quadro final da análise semiautomática do replay ("IMPEDIMENTO" / "POSIÇÃO LEGAL": a única exceção à
     * "sem narração", aprovada pelo dono em 12/10; só o selo, sem nome nem minuto). A cena de substituição acrescenta o
     * tipo dela. Só mexe no DOM quando o tipo muda (chamado a cada quadro do replay).
     */
    terco(spec) {
      const tipo = spec && SELOS[spec.tipo] ? spec.tipo : null;
      if (tipo === tercoTipo) return;
      tercoTipo = tipo;
      const e = el.terco;
      if (!e) return;
      if (!tipo) { e.hidden = true; e.className = 'terco'; e.textContent = ''; return; }
      e.className = `terco terco-${tipo}`;
      e.innerHTML = `<span class="terco-selo">${ICONE_BANDEIRA}<b>${SELOS[tipo]}</b></span>`;
      e.hidden = false;
    },
    /** O tipo do terço de baixo na tela (testes): null, 'impedimento' ou 'legal'. */
    get tercoTipo() { return tercoTipo; },
    /** Tira o "GOL!" já (saída de bola, recomeço do treino, mundo novo). */
    esconderGol() {
      clearTimeout(timerGol);
      el.golTela?.classList.remove('visivel', 'fixo');
    },
    modoPrints() {
      prints = true;
      document.documentElement.classList.add('modo-prints');
      el.menu.hidden = true; el.ajuda.hidden = true;
      el.carregando.hidden = true;
    },
  };
}
