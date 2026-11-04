// HUD (DOM): placar (com o relógio da partida), velocidade e modo do jogador controlado, posição
// dele, minimapa, barra de força do passe/chute perto do jogador, avisos curtos de eventos, "GOL!"
// grande, faixa do intervalo e do fim de jogo, menu de pausa (itens por modo: Editar time e
// Reiniciar partida na partida; Recomeçar, Máquina e Marcador só nos treinos; "Modo de jogo" com a
// partida e os treinos), ajuda, contador de qps e tela de carregamento. Só mexe no DOM; quem
// decide é o main.js. Lê o mundo só para desenhar (placar, minimapa) e tolera campos que ainda não
// existem. Tela limpa (dono, 11/10): na partida o relógio do placar é MM:SS (item 32), o "+N" ao lado dele só nos
// acréscimos (.com-tempo) e "Intervalo"/"Fim" no lugar dele com o bloco parado (.parado); a barra de força não escreve o
// tipo (o CSS esconde o rótulo), a dica de teclas do PC some em 8 s
// e o minimapa é opção da pausa (escondido = não redesenha). A faixa de baixo (itens 59 e 60, dono 23/10): no celular o
// minimapa fica EMBAIXO no meio, entre o analógico e os botões (ajustarBaixo; no PC ele já ficava), e o nome do jogador com a
// bola fica nos CANTOS de baixo — o do time da esquerda do placar à esquerda, o da direita à direita (nomeCanto).

import { aoTocar, engolirClique } from './toque-botao.js';
// o texto do relógio do placar em MM:SS (item 32): a conta pura, fora do fecho do hash
import { textoRelogio } from './relogio-placar.js';

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
  // disputa de pênaltis (modo Pênaltis): o comando da vez, na 1ª vez que o humano bate e que defende
  penaltisBate: { t: 'Sua vez: mire e segure o CHUTE', ms: 3600, forte: true },
  penaltisDefende: { t: 'Defenda: esquerda ou direita antes do chute', ms: 3600, forte: true },
  reinicioDisputa: { t: 'Disputa reiniciada', ms: 1200 },
  // Modo Livre: a mudança de jogadores feita ("5 contra 3": o texto vem do livre-pagina.js)
  livreAjuste: { t: 'Jogadores atualizados', ms: 1600, forte: true, prio: 2 },
  livreCamera: { t: 'Câmera', ms: 1200, prio: 2 },
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
// (com ?tm as cores dos times vêm da identidade — definirTimes — e voltam a estas sem ela)
const COR_MAPA_PADRAO = { ...COR_MAPA };
// times fictícios: siglas e escudos do placar (treino; na partida vêm do elenco por definirTimes). O escudo é o id de um
// <symbol id="escudo-..."> do index.html (desenhados lá, fictícios); o visitante do treino veste o branco do Ventania
const TIMES_TREINO = [{ sigla: 'GLÇ', nome: 'Golaço', escudo: 'golaco' }, { sigla: 'VIS', nome: 'Visitante', escudo: 'ventania' }];
const ESCUDOS = new Set(['golaco', 'ventania']);

const NOMES_Q = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const CAMPO_MX = 52.5, CAMPO_MZ = 34;
// A faixa de baixo no celular (itens 59 e 60; contrato "Faixa de baixo" no CONTRATOS.md). Constantes fora do config.js (que
// está no fecho do hash): é só desenho. O minimapa: o maior dos tamanhos que cabe com a base a `base` px da borda segura, a
// ≥ `folga` px do analógico em repouso e de TODAS as vagas do arco (as duas fases: não pula na troca de posse), no meio ou
// deslizando até `desvio`·W para o lado do vão; nenhum serviu = html.mapa-sem-lugar (some sozinho, a opção da pausa fica).
const MAPA_BAIXO = { tamanhos: [[92, 60], [84, 55], [76, 50]], folga: 8, desvio: 0.12, base: 3 };
// O nome nos cantos: a caixa de `alt` px com a base a `base` px e a `borda` px da borda segura; a largura livre de cada canto
// (a ≥ `folgaBotao` px de todo círculo e a ≥ `folgaMapa` do minimapa) vira o --nome-livre-esq/dir (o max-width do CSS não
// passa dele); abaixo de `minimo` (número + 3 letras + margens), html.nome-sem-lugar-esq/dir (só a 140% em telas pequenas)
const NOME_BAIXO = { alt: 15, base: 3, borda: 8, folgaBotao: 4, folgaMapa: 8, minimo: 56 };

/**
 * opc = {aoComando(cmd, valor)}. Comandos: continuar, recomecar, maquina, marcador, ajuda,
 * fechar-ajuda, qualidade, hora, camera, toqueTamanho, toqueOpacidade, editar-time,
 * reiniciar-partida, modos, modos-voltar, modo (valor: partida | ataque | conducao), som (ligado |
 * desligado), volume (0–1), minimapa e nomes (sem valor: alterna; tela limpa, 11/10), replay (o "Replay" da pausa),
 * replay-pular, replayAuto (ligado | desligado), comemoracao-pular, substituicao-pular, subst-ciclo (a opção "Cena de
 * substituição" do "Modo de jogo": ligada ↔ só a faixa), cena-pular (a cena do cartão) e cenas-ciclo (a opção "Cenas"
 * do "Modo de jogo": ligadas ↔ desligadas).
 */
export function criarHud(opc) {
  /** Tira o foco de dentro de `caixa` (a pausa ou a Ajuda que fechou): nenhum botão escondido fica com o Enter/Espaço. */
  const soltarFoco = caixa => { const at = document.activeElement; if (caixa && at && at !== document.body && caixa.contains(at)) at.blur(); };
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
    faixaBotao2: $('faixa-botao2'), faixaBotoes: $('faixa-botoes'),
    acoes: $('menu-acoes'), modos: $('menu-modos'), estadoModo: $('estado-modo'), continuar: $('btn-continuar'),
    reiniciarPartida: $('btn-reiniciar-partida'), dica: $('dica'), replay: $('replay'), replayFaixa: $('replay-faixa'),
    comemoracao: $('comemoracao'), substituicao: $('substituicao'), faixaSub: $('faixa-subst'), cena: $('cena'),
    terco: $('terco'), nome: $('nome-condutor'), chipMapa: $('chip-minimapa'),
    // a pausa do item 58: os submenus novos, a faixa, o topo (a competição), a pílula do placar e o cartão do meu time
    opcoes: $('menu-opcoes'), estat: $('menu-estatisticas'), competicao: $('pausa-competicao'), pausaPlacar: $('pausa-placar'),
    pausaTime: $('pausa-time'),
  };
  el.janelaMenu = el.menu?.querySelector('.janela-menu') ?? null;
  el.faixaPausa = el.menu?.querySelector('.pausa-faixa') ?? null;
  const nomeEl = el.nome ? { cor: el.nome.querySelector('.nc-cor'), num: el.nome.querySelector('.nc-num'), nome: el.nome.querySelector('.nc-nome') } : null;
  let nomeChave = null; // time|num|nome|apagado escrito no DOM (null = escondido): só escreve quando muda
  const cmd = (c, v) => opc.aoComando && opc.aoComando(c, v);
  let ultimoHud = -1, tercoTipo = null;
  const ultimoTexto = { vel: '', modo: '', posicao: null, forte: false };
  let timerAviso = null, timerGol = null;
  // o "GOL!" dura o mesmo que a animação do CSS (2,4 s: some antes da saída de bola, PARTIDA.golPausa 2,5 s)
  const golDuracaoMs = 2400;
  let prints = false;
  const placarVisto = [null, null];
  let times = TIMES_TREINO;
  // o relógio escrito no DOM (item 32): a chave do quadro anterior (segundo, estado, anúncio; o {minuto} de antes) e o texto,
  // o "+N" e o formato de agora — só escreve o que muda
  const relogioVisto = { visivel: null, seg: null, est: null, an: null, min: null, dec: null, texto: null, extra: null, formato: null };
  let timerFaixa = null;
  let modoAtual = null, fimDeJogo = false;
  let ajudaDaPausa = false; // a Ajuda foi aberta pela pausa: fechar volta para ela
  const NOME_MODO = { partida: 'partida', ataque: 'treino de ataque', conducao: 'treino de condução', penaltis: 'pênaltis', livre: 'modo livre' };
  /** Sigla, escudo e nome (só para leitores de tela: nenhum texto novo na tela) de cada time no placar. */
  function escreverTimes() {
    times.forEach((t, i) => {
      if (el.siglas[i]) el.siglas[i].textContent = t.sigla;
      // Total Match (t.escudoUrl, identidade.js extrasPlacar): o escudo-imagem num <symbol> próprio e a cor do time
      if (el.escudos[i]) el.escudos[i].setAttribute('href', t.escudoUrl ? `#${simboloEscudoTm(i, t.escudoUrl)}` : `#escudo-${ESCUDOS.has(t.escudo) ? t.escudo : TIMES_TREINO[i].escudo}`);
      const faixaCor = el.timesPlacar[i]?.querySelector('.placar-cor');
      if (faixaCor && (t.cor || faixaCor.style.background)) faixaCor.style.background = t.cor ?? '';
      if (el.timesPlacar[i]) {
        if (t.cor) el.timesPlacar[i].style.setProperty('--cor-time', t.cor); else if (el.timesPlacar[i].style.getPropertyValue('--cor-time')) el.timesPlacar[i].style.removeProperty('--cor-time');
        el.timesPlacar[i].setAttribute('aria-label', t.nome ?? t.sigla);
      }
    });
    // o nome do condutor escreve a cor do time de novo (a faixa da cor é a do placar)
    nomeChave = nomeChave === null ? null : '';
    // cores do minimapa: as do time (Total Match) ou as de sempre
    const m0 = times[0]?.mapa, m1 = times[1]?.mapa;
    Object.assign(COR_MAPA, m0 && m1 ? { t0: m0.lin, t0gol: m0.gol, t1: m1.lin, t1gol: m1.gol } : COR_MAPA_PADRAO);
  }
  /** <symbol id="escudo-tm-i"> com a imagem do escudo (o mesmo viewBox dos escudos desenhados) no sprite do index.html. */
  function simboloEscudoTm(i, url) {
    const id = `escudo-tm-${i}`;
    let sb = document.getElementById(id);
    if (!sb) {
      const ns = 'http://www.w3.org/2000/svg';
      const sprite = document.querySelector('svg.sprite') ?? document.body.appendChild(document.createElementNS(ns, 'svg'));
      sb = document.createElementNS(ns, 'symbol');
      sb.id = id;
      sb.setAttribute('viewBox', '0 0 20 22');
      const im = document.createElementNS(ns, 'image');
      im.setAttribute('x', '0'); im.setAttribute('y', '0'); im.setAttribute('width', '20'); im.setAttribute('height', '22');
      im.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      sb.appendChild(im);
      sprite.appendChild(sb);
    }
    const im = sb.firstChild;
    if (im.getAttribute('href') !== url) im.setAttribute('href', url);
    return id;
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
  // o "fundo" fecha (o click do mesmo toque não cai no ≡ que fica embaixo e reabre a pausa): na Ajuda, o véu em volta da janela;
  // na pausa (item 58), o jogo à vista — a área do degradê, o canto direito e a pílula do placar (que não pega toque) —, nunca a
  // faixa da lista (tocar nela fora dos itens não fecha por engano)
  const fundoPausa = new Set([el.menu, el.janelaMenu, el.menu?.querySelector('.pausa-direita'), el.menu?.querySelector('.pausa-topo-dir')].filter(Boolean));
  el.menu?.addEventListener('pointerdown', e => {
    if (fundoPausa.has(e.target)) { engolirClique(e); cmd('continuar'); }
  });
  el.ajuda?.addEventListener('pointerdown', e => {
    if (e.target === el.ajuda) { engolirClique(e); cmd('fechar-ajuda'); }
  });
  // o cartão do meu time (js/pausa-tela.js): tocar nele (ou clicar) abre o Editar time, o mesmo comando do item da lista —
  // menos com a trava do Rumo ao Estrelato e onde não há editor (data-editavel). Fora da ordem do foco: o teclado e o controle
  // usam o item "Editar time"
  aoTocar(el.pausaTime, () => { if (el.pausaTime?.dataset.editavel === '1' && !el.menu.hidden) cmd('editar-time'); });
  el.tam?.addEventListener('input', () => { cmd('toqueTamanho', +el.tam.value / 100); });
  // tela cheia (Android/PC; o iPhone não deixa a página pedir): uma linha liga/desliga nas Opções (aria-pressed)
  const btTela = $('btn-tela-cheia');
  if (btTela && document.fullscreenEnabled) {
    btTela.hidden = false;
    const rotulo = () => { btTela.setAttribute('aria-pressed', String(!!document.fullscreenElement)); };
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
  // cena do cartão (js/cena-cartao.js): a mesma camada (qualquer toque pula depois de 0,5 s — quem decide é o main.js). Na
  // cena do fim de tempo (js/cena-fim.js, o intervalo) o toque na camada é o PRÓXIMO BLOCO ('cena-toque'), o "Pular" vai à
  // saída ('cena-pular') e o botão da pausa ('cena-menu') abre a pausa (o "Editar time" do intervalo)
  el.cena?.addEventListener('pointerdown', e => {
    e.preventDefault(); engolirClique(e);
    if (e.target.closest?.('#cena-menu')) { cmd('cena-menu'); return; }
    cmd(e.target.closest?.('#cena-pular') ? 'cena-pular' : 'cena-toque');
  });

  function marcarGrupo(grupo, valor) {
    document.querySelectorAll(`.segmentado[data-grupo="${grupo}"] button`).forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.valor === valor));
    });
  }

  // Topo do HUD no celular deitado: placar | painel (treinos) | menu numa linha só (o minimapa foi para baixo: itens 59 e 60).
  // Em tela estreita (ou com entalhe) eles encostariam: primeiro sai a marca do placar, depois o texto do modo (fica o ponto
  // de estado e a posição). Medido de verdade (texto do modo muda de largura).
  const raiz = document.documentElement;
  const caixasTopo = [$('hud')?.querySelector('.placar'), $('hud')?.querySelector('.painel-jogo')];
  function encostaTopo() {
    const [pl, pa] = caixasTopo.map(e => e?.getBoundingClientRect());
    if (!pl || !pa) return false;
    // caixa escondida (o painel some na partida) não encosta em nada
    const enc = (a, b) => a.width > 0 && b.width > 0 && a.left < b.right + 6 && b.left < a.right + 6 && a.top < b.bottom + 4 && b.top < a.bottom + 4;
    // o botão de menu também conta: no celular em pé, o placar com o relógio da partida chega nele
    // (a largura depende da fonte do aparelho — no CI encostava e aqui não)
    const mn = $('btn-menu')?.getBoundingClientRect();
    return enc(pl, pa) || (mn && mn.width > 0 && enc(pl, mn));
  }
  /**
   * Algum botão de toque (de QUALQUER fase: a posição de cada vaga vem do style que a entrada
   * escreve) encosta no placar ou no painel? Com o arco grande (140%) e os 5 botões da
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
    if (raiz.classList.contains('com-toque')) {
      // o painel (modo e posição) desce para baixo do placar, à esquerda, se o arco chega nele
      if (botaoNoTopo()) raiz.classList.add('topo-desce');
      apertarTopo();
      // o orçamento do HUD no celular (H1 do teste-hud-minimo, item 32): na partida, cada dígito a mais que o placar mais largo
      // de todo dia (gols de 1 dígito e "97:13 +10") — gols ≥ 10, o relógio ≥ 100:00 (só na pausa de um gol depois dos
      // acréscimos) — aperta o placar pelos MESMOS passos do aperto, mesmo sem encostar: com um, os espaços (passo 4); com dois
      // ou mais, também o "+N" (passo 3, o último a sair). As fontes não mudam
      if (raiz.classList.contains('em-partida')) {
        const extra = digitosExtra();
        if (extra >= 1) raiz.classList.add('topo-c4');
        if (extra >= 2) raiz.classList.add('topo-c3');
      }
      // nos treinos a marca do GOLAÇO só fica de fora se fizer falta: quem encosta costuma ser o painel, e apertar o painel
      // (passo 2) já resolve (contraprova de 13/10: em 568 e 667 px ela saía com 40–90 px livres à direita do placar)
      if (raiz.classList.contains('topo-c1') && !raiz.classList.contains('em-partida')) {
        raiz.classList.remove('topo-c1');
        if (encostaTopo()) raiz.classList.add('topo-c1');
      }
    }
    // a faixa de baixo (o minimapa e os nomes): todo lugar que refaz o topo refaz ela também (resize, layout dos botões,
    // "Tamanho", o botão Minimapa, as fontes do TM); no PC, o nome da esquerda com a dica na tela (janela estreita)
    ajustarBaixo();
    nomeComDica();
  }
  /**
   * Os passos do aperto, em ordem, até nada encostar (ajustarTopo). Na partida o "+N" dos acréscimos (item 32) é o último
   * a sair: os espaços do placar apertam antes (passo 4) — com o minimapa embaixo, na partida o topo é só placar e menu e
   * nada encosta nas telas medidas.
   */
  function apertarTopo() {
    const ordem = raiz.classList.contains('em-partida') ? ['topo-c1', 'topo-c2', 'topo-c4', 'topo-c3'] : ['topo-c1', 'topo-c2', 'topo-c3', 'topo-c4'];
    for (const c of ordem) { if (!encostaTopo()) return; raiz.classList.add(c); }
  }
  /** Dígitos do placar além do "1 dígito nos gols e MM:SS" (ajustarTopo): os gols de 2 dígitos e o relógio de 3 nos minutos. */
  function digitosExtra() {
    let n = 0;
    for (const g of placarVisto) if (g != null && g >= 10) n++;
    const v = relogioVisto;
    if (v.visivel && v.formato !== 'parado' && (v.texto?.length ?? 0) > 5) n++;
    return n;
  }

  // ---------------------------------------------------------------- a faixa de baixo (itens 59 e 60)
  // O minimapa embaixo no meio e a largura livre dos cantos para o nome, pelos controles de toque (opc.layoutToque: a
  // entrada.js — as vagas de TODAS as fases e o analógico em repouso). Só no celular (html.com-toque); no PC o CSS decide
  // (o minimapa no meio embaixo, como sempre, e os nomes nos cantos).
  const baixoVisto = { cx: null, w: null, h: null, semLugar: null, livreE: null, livreD: null, semE: null, semD: null, chave: '' };
  function ajustarBaixo() {
    const st = raiz.style;
    const lt = raiz.classList.contains('com-toque') ? opc.layoutToque?.() : null;
    if (!lt) {
      if (baixoVisto.cx !== null || baixoVisto.semLugar || baixoVisto.livreE !== null) {
        for (const v of ['--mapa-cx', '--mapa-w', '--mapa-h', '--nome-livre-esq', '--nome-livre-dir']) st.removeProperty(v);
        raiz.classList.remove('mapa-sem-lugar', 'nome-sem-lugar-esq', 'nome-sem-lugar-dir');
        Object.assign(baixoVisto, { cx: null, w: null, h: null, semLugar: null, livreE: null, livreD: null, semE: null, semD: null, chave: '' });
        marcarChipMapa(false);
      }
      return;
    }
    const { W, H, sa, botoes } = lt;
    // a mesma geometria (e o minimapa ligado ou não) de antes: nada a refazer (o ajustarTopo roda a cada texto novo do painel)
    const an = lt.analogico;
    let chave = `${W},${H},${sa.l},${sa.r},${sa.b},${an ? `${an.x.toFixed(1)},${an.y.toFixed(1)},${an.r}` : '-'},${raiz.classList.contains('mapa-ligado')}`;
    for (const b of botoes) chave += `;${b.x.toFixed(1)},${b.y.toFixed(1)},${b.d}`;
    if (chave === baixoVisto.chave) { mapaSobFaixa(); return; }
    baixoVisto.chave = chave;
    const circ = lt.analogico ? [...botoes, { x: lt.analogico.x, y: lt.analogico.y, d: 2 * lt.analogico.r }] : botoes;
    const dist = (q, c) => Math.hypot(c.x - Math.max(q[0], Math.min(c.x, q[2])), c.y - Math.max(q[1], Math.min(c.y, q[3]))) - c.d / 2;
    // o minimapa: o maior tamanho que cabe, o mais perto do meio (de 1 em 1 px até desvio·W para os dois lados)
    let mapa = null;
    const bm = H - sa.b - MAPA_BAIXO.base;
    for (const [w, h] of MAPA_BAIXO.tamanhos) {
      const cabe = cx => cx - w / 2 >= sa.l && cx + w / 2 <= W - sa.r && circ.every(c => dist([cx - w / 2, bm - h, cx + w / 2, bm], c) >= MAPA_BAIXO.folga);
      const lim = MAPA_BAIXO.desvio * W;
      for (let d = 0; d <= lim && !mapa; d++) {
        for (const sinal of d ? [-1, 1] : [1]) { const cx = Math.round(W / 2) + sinal * d; if (cabe(cx)) { mapa = { cx, w, h }; break; } }
      }
      if (mapa) break;
    }
    if (mapa) {
      if (mapa.cx !== baixoVisto.cx) st.setProperty('--mapa-cx', `${mapa.cx}px`);
      if (mapa.w !== baixoVisto.w) st.setProperty('--mapa-w', `${mapa.w}px`);
      if (mapa.h !== baixoVisto.h) st.setProperty('--mapa-h', `${mapa.h}px`);
      Object.assign(baixoVisto, { cx: mapa.cx, w: mapa.w, h: mapa.h });
    }
    const semLugar = !mapa;
    if (semLugar !== baixoVisto.semLugar) { raiz.classList.toggle('mapa-sem-lugar', semLugar); baixoVisto.semLugar = semLugar; marcarChipMapa(semLugar); }
    // os cantos: a largura livre de cada um (o minimapa conta só ligado e com lugar)
    const mapaLigado = !!mapa && raiz.classList.contains('mapa-ligado') && !raiz.classList.contains('mapa-desligado');
    const qm = mapaLigado ? [mapa.cx - mapa.w / 2, bm - mapa.h, mapa.cx + mapa.w / 2, bm] : null;
    const bn = H - sa.b - NOME_BAIXO.base, tn = bn - NOME_BAIXO.alt;
    const livre = esq => {
      let lo = 0, hi = W / 2;
      for (let i = 0; i < 24; i++) {
        const w = (lo + hi) / 2;
        const q = esq ? [sa.l + NOME_BAIXO.borda, tn, sa.l + NOME_BAIXO.borda + w, bn] : [W - sa.r - NOME_BAIXO.borda - w, tn, W - sa.r - NOME_BAIXO.borda, bn];
        const okMapa = !qm || Math.max(q[0] - qm[2], qm[0] - q[2]) >= NOME_BAIXO.folgaMapa;
        if (okMapa && circ.every(c => dist(q, c) >= NOME_BAIXO.folgaBotao)) lo = w; else hi = w;
      }
      return Math.floor(lo);
    };
    for (const [esq, k, kSem, v, cls] of [[true, 'livreE', 'semE', '--nome-livre-esq', 'nome-sem-lugar-esq'], [false, 'livreD', 'semD', '--nome-livre-dir', 'nome-sem-lugar-dir']]) {
      const l = livre(esq);
      if (l !== baixoVisto[k]) { st.setProperty(v, `${l}px`); baixoVisto[k] = l; }
      const sem = l < NOME_BAIXO.minimo;
      if (sem !== baixoVisto[kSem]) { raiz.classList.toggle(cls, sem); baixoVisto[kSem] = sem; }
    }
    mapaSobFaixa();
  }
  /**
   * Uma faixa do meio da tela (intervalo, "Você foi expulso", "Simulando…") que chega ao minimapa embaixo esconde ele enquanto
   * está na tela (html.mapa-sob-faixa; a do fim de jogo, com os botões, já o esconde: html.fim-faixa). Nas telas baixas a
   * faixa com o botão desce até ele (a do TM é ancorada embaixo do aviso).
   */
  function mapaSobFaixa() {
    if (!el.mapa) return;
    let sob = false;
    if (el.faixa && !el.faixa.hidden) {
      raiz.classList.remove('mapa-sob-faixa');
      const a = el.faixa.getBoundingClientRect(), b = el.mapa.getBoundingClientRect();
      sob = a.width > 0 && b.width > 0 && a.left < b.right + 4 && b.left < a.right + 4 && a.top < b.bottom + 4 && b.top < a.bottom + 4;
    }
    raiz.classList.toggle('mapa-sob-faixa', sob);
  }
  /** O botão "Minimapa" da pausa diz por que ele sumiu (continua ligado: volta sozinho quando o tamanho ou a tela mudam). */
  function marcarChipMapa(semLugar) {
    const c = el.chipMapa;
    if (!c) return;
    if (semLugar) { c.title = 'Sem espaço entre o analógico e os botões neste tamanho'; c.setAttribute('aria-description', c.title); }
    else if (c.hasAttribute('aria-description')) { c.removeAttribute('title'); c.removeAttribute('aria-description'); }
  }
  window.addEventListener('resize', () => requestAnimationFrame(ajustarTopo));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => requestAnimationFrame(ajustarTopo));

  /**
   * A dica de teclas do PC aparece de novo e some 8 s depois (CSS .dica: animação que começa ao ser reposta). Enquanto ela
   * está na tela, html.dica-visivel e --dica-w (a largura dela): o nome da esquerda fica na mesma linha, à DIREITA dela (em
   * cima dela encostava na faixa ENTRA/SAI do jogo, que mora logo acima); o fim da animação tira as duas e ESCONDE a dica
   * (.dica.vista) até a próxima vez que ela for mostrada — sem isso, cada camada (replay, comemoração, cena, substituição)
   * que a escondia com display:none fazia a animação recomeçar na saída e ela voltava por 8 s, sem o dica-visivel, debaixo
   * do nome da esquerda (revisão dos itens 59 e 60).
   */
  function mostrarDica() {
    if (!el.dica) return;
    el.dica.classList.remove('vista');
    el.dica.style.animation = 'none';
    const w = el.dica.offsetWidth;
    el.dica.style.animation = '';
    if (w > 0) raiz.style.setProperty('--dica-w', `${Math.ceil(w)}px`);
    raiz.classList.add('dica-visivel');
    nomeComDica();
  }
  /**
   * Janela de PC estreita com a dica na tela: o nome da esquerda, à direita dela, fica entre a dica e o minimapa do meio (a
   * conta do max-width do estilo.css: até W/2 − 56 − 8); abaixo de NOME_BAIXO.minimo ele não cabe e some enquanto ela está na
   * tela (html.nome-sem-lugar-dica; em 560 px sobrava uma lasca de 8 px — só o padding — por cima do minimapa).
   */
  function nomeComDica() {
    if (!el.dica) return;
    let sem = false;
    if (raiz.classList.contains('dica-visivel') && !raiz.classList.contains('com-toque')) {
      const d = el.dica.getBoundingClientRect();
      if (!(d.width > 0)) return; // escondida por uma camada agora: fica como estava
      sem = innerWidth / 2 - 56 - 8 - (d.right + 8) < NOME_BAIXO.minimo;
    }
    if (raiz.classList.contains('nome-sem-lugar-dica') !== sem) raiz.classList.toggle('nome-sem-lugar-dica', sem);
  }
  // (só o FIM da animação: a reposta acima cancela a anterior, e o cancelamento chega depois da classe nova)
  el.dica?.addEventListener('animationend', e => {
    if (e.target !== el.dica) return;
    el.dica.classList.add('vista');
    raiz.classList.remove('dica-visivel', 'nome-sem-lugar-dica');
  });
  /** Itens do menu pelo modo (partida × treinos) e pelo fim de jogo. */
  function aplicarModoNoMenu() {
    // a disputa de pênaltis (modo Pênaltis) é um jogo como a partida: o topo e a pausa dela (data-so "partida penaltis":
    // Replay e Reiniciar; o Editar time é só da partida)
    const penaltis = modoAtual === 'penaltis';
    // o Modo Livre também é um jogo (o placar de TV, sem o relógio; data-so "livre": Jogadores e os recomeços dele)
    const livre = modoAtual === 'livre';
    const partida = modoAtual === 'partida' || penaltis || livre;
    // na partida o topo fica só com placar, minimapa e menu (sem o painel "Conduzindo"/posição/km/h:
    // é narração na tela); nos treinos o painel continua (é o retorno do exercício)
    raiz.classList.toggle('em-partida', partida);
    raiz.classList.toggle('em-penaltis', penaltis);
    raiz.classList.toggle('em-livre', livre);
    const so = livre ? 'livre' : penaltis ? 'penaltis' : partida ? 'partida' : 'treino';
    document.querySelectorAll('#menu [data-so]').forEach(b => { b.hidden = !b.dataset.so.split(' ').includes(so); });
    // marcador de treino só no treino de condução (no de ataque a defesa já marca)
    if (el.marcador && !partida) el.marcador.closest('button').hidden = modoAtual === 'ataque';
    if (el.estadoModo) el.estadoModo.textContent = NOME_MODO[modoAtual] ?? '';
    el.modos?.querySelectorAll('[data-cmd="modo"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.valor === modoAtual)));
    // fim de jogo: "Jogar de novo" no lugar de Continuar
    const fim = partida && fimDeJogo;
    if (el.continuar) el.continuar.hidden = fim;
    if (el.reiniciarPartida) {
      // (o texto mora no <span class="item-txt"> do item: o "…" de segurança da pausa)
      const tx = el.reiniciarPartida.querySelector('.item-txt') ?? el.reiniciarPartida;
      const t = fim ? 'Jogar de novo' : penaltis ? 'Reiniciar disputa' : 'Reiniciar partida';
      if (tx.textContent !== t) tx.textContent = t;
      el.reiniciarPartida.classList.toggle('btn-primario', fim);
    }
    // Total Match (?tm): a partida é a do TM — sem Reiniciar nem a troca para os treinos (voltariam ao Golaço ×
    // Ventania), com "Simular o resto" (até o apito) e, no fim, "Voltar ao Total Match"; com a trava ("só o meu
    // jogador"), sem Editar time. O submenu vira "Cenas da partida": só o pré-jogo e a cena de substituição
    if (opc.tm) {
      if (el.reiniciarPartida) el.reiniciarPartida.hidden = true;
      const modos = $('btn-modos');
      const txModos = modos?.querySelector('.item-txt');
      if (txModos && txModos.textContent !== 'Cenas da partida') txModos.textContent = 'Cenas da partida';
      const tit = $('titulo-modos');
      if (tit && tit.textContent !== 'Cenas da partida') tit.textContent = 'Cenas da partida';
      if (el.estadoModo) { el.estadoModo.hidden = true; el.estadoModo.style.display = 'none'; }
      if (el.modos) el.modos.querySelectorAll('[data-cmd="modo"]').forEach(b => { b.hidden = true; if (b.parentElement?.classList.contains('linha-cenas')) b.parentElement.hidden = true; });
      const sim = $('btn-simular-resto'), volta = $('btn-voltar-tm');
      if (sim) {
        sim.hidden = !partida || fim || livre;
        const sm = sim.querySelector('small');
        if (sm) sm.textContent = penaltis ? 'até o fim da disputa' : 'até o apito final';
      }
      // a disputa de pênaltis do TM não tem pré-jogo nem substituição: sem o submenu "Cenas da partida" (nem o Livre)
      if (modos) modos.hidden = penaltis || livre;
      // no Livre o "Voltar ao Total Match" fica sempre (no lugar do Modo de jogo): o treino não tem fim
      if (volta) { volta.hidden = !fim && !livre; volta.classList.toggle('btn-primario', fim); }
      if (opc.tm.trava) document.querySelectorAll('#menu [data-cmd="editar-time"]').forEach(b => { b.hidden = true; });
    }
    // Online 1×1 (com ou sem o TM): nada que mexa no jogo de um lado só — sem Replay da pausa, Simular o resto, Reiniciar,
    // Modo de jogo/Cenas; "Voltar ao Total Match" só no fim (a pausa e o "Sair da partida" vêm do online-pagina.js)
    if (opc.online) {
      for (const sel of ['[data-cmd="replay"]', '#btn-simular-resto', '#btn-reiniciar-partida', '#btn-modos']) document.querySelectorAll('#menu ' + sel).forEach(b => { b.hidden = true; });
      const volta = $('btn-voltar-tm');
      if (volta) volta.hidden = !fimDeJogo || !opc.tm;
    }
    ordenarFim(fim);
    marcarNivel();
  }
  // ---- os níveis da pausa (item 58): o 1º (#menu-acoes) e os submenus no lugar dele; os do Livre (Jogadores e Câmera) são do
  // livre-pagina.js, que chama marcarNivel ao trocar
  const fecharSubLivre = () => document.querySelectorAll('.submenu-livre').forEach(e => { e.hidden = true; });
  // submenu → [id do submenu, id do item que o abre]
  const SUBMENUS = { modos: ['menu-modos', 'btn-modos'], opcoes: ['menu-opcoes', 'btn-opcoes'], estatisticas: ['menu-estatisticas', 'btn-estatisticas'] };
  let subAberto = null;
  // a âncora <!--fim--> do #menu-acoes: o Reiniciar, o Simular o resto e o Voltar ao TM moram antes dela (o 1º nível na ordem
  // do FC 24); no fim de jogo o primário do fim (Jogar de novo ou Voltar ao TM) sobe para o 1º lugar e volta depois
  const ancoraFim = el.acoes ? [...el.acoes.childNodes].find(n => n.nodeType === 8 && n.data.trim() === 'fim') ?? null : null;
  function ordenarFim(fim) {
    if (!el.acoes || !ancoraFim) return;
    const sim = $('btn-simular-resto'), volta = $('btn-voltar-tm');
    const prim = fim ? [el.reiniciarPartida, volta].find(b => b && !b.hidden && b.classList.contains('btn-primario')) ?? null : null;
    const ordem = [el.reiniciarPartida, sim, volta].filter(b => b && b !== prim);
    const ativo = document.activeElement;
    // (só mexe no DOM se a ordem mudou: mover o botão com o foco tira o foco dele)
    let n = ancoraFim, igual = true;
    for (let i = ordem.length - 1; i >= 0 && igual; i--) { let q = n.previousSibling; while (q && q.nodeType !== 1) q = q.previousSibling; igual = q === ordem[i]; n = q; }
    if (!igual) ancoraFim.before(...ordem);
    if (prim && el.acoes.firstElementChild !== prim) el.acoes.prepend(prim);
    if (ativo && ativo !== document.activeElement && el.menu.contains(ativo) && !el.menu.hidden) ativo.focus({ preventScroll: true });
  }
  /** O nível na janela (data-nivel="sub" com um submenu à vista, data-sub = o id dele): o CSS da faixa larga no celular. */
  function marcarNivel() {
    if (!el.janelaMenu) return;
    const vis = [...el.menu.querySelectorAll('.menu-acoes')].find(e => !e.hidden && e.id !== 'menu-acoes');
    const nivel = vis ? 'sub' : '1';
    if (el.janelaMenu.dataset.nivel !== nivel) el.janelaMenu.dataset.nivel = nivel;
    if (vis) { if (el.janelaMenu.dataset.sub !== vis.id) el.janelaMenu.dataset.sub = vis.id; } else delete el.janelaMenu.dataset.sub;
  }
  /** Os botões e deslizantes à vista (não desligados) dentro de `r`, na ordem do DOM. */
  const visiveis = r => (r ? [...r.querySelectorAll('button, input[type="range"]')] : [])
    .filter(b => !b.disabled && !b.hidden && b.getClientRects().length > 0 && getComputedStyle(b).visibility !== 'hidden');
  /** Os focáveis do nível da pausa à vista (a .menu-acoes visível); comX: mais o X (o Tab passa por ele; o controle e as setas não). */
  function focaveisDoNivel(comX) {
    const nivel = [...el.menu.querySelectorAll('.menu-acoes')].find(e => !e.hidden && e.getClientRects().length > 0);
    const l = visiveis(nivel);
    if (comX) { const x = el.menu.querySelector('.pausa-topo-dir .btn-fechar'); if (x && x.getClientRects().length) l.push(x); }
    return l;
  }
  const focar = b => { b.focus({ preventScroll: true }); b.scrollIntoView?.({ block: 'nearest' }); };
  /**
   * O vizinho de `at` na direção (navegação ESPACIAL, como o FC: o controle e as setas): cima/baixo = o focável cujo topo está
   * além da base do atual (ou o contrário), pelo menor Δy e depois pelo menor |Δx| entre os centros — sem nenhum, dá a volta (o
   * 1º ou o último na ordem do DOM: numa coluna, ±1 com a volta); esq/dir = o da MESMA linha (sobreposição vertical ≥ 50% da
   * menor altura) mais perto naquele sentido, ou nada (nunca anda na vertical).
   */
  function vizinho(lista, at, acao) {
    const r0 = at.getBoundingClientRect(), cx0 = (r0.left + r0.right) / 2;
    let melhor = null, m1 = Infinity, m2 = Infinity;
    if (acao === 'cima' || acao === 'baixo') {
      const desce = acao === 'baixo';
      for (const b of lista) {
        if (b === at) continue;
        const r = b.getBoundingClientRect();
        const dy = desce ? r.top - r0.bottom : r0.top - r.bottom;
        if (dy < -1) continue;
        const dx = Math.abs((r.left + r.right) / 2 - cx0);
        if (dy < m1 - 0.5 || (Math.abs(dy - m1) <= 0.5 && dx < m2)) { melhor = b; m1 = dy; m2 = dx; }
      }
      return melhor ?? (desce ? lista[0] : lista[lista.length - 1]);
    }
    const dir = acao === 'dir';
    for (const b of lista) {
      if (b === at) continue;
      const r = b.getBoundingClientRect();
      const sob = Math.min(r.bottom, r0.bottom) - Math.max(r.top, r0.top);
      if (sob < 0.5 * Math.min(r.height, r0.height)) continue;
      const dc = dir ? (r.left + r.right) / 2 - cx0 : cx0 - (r.left + r.right) / 2;
      if (dc > 1 && dc < m1) { m1 = dc; melhor = b; }
    }
    return melhor;
  }
  /** Volta um nível (o B do controle e o Esc): a Ajuda fecha (volta à pausa se veio dela), o submenu volta ao 1º nível, o 1º fecha. */
  function voltarNivel() {
    if (!el.ajuda.hidden) { cmd('fechar-ajuda'); return; }
    if (el.menu.hidden) return;
    if (document.querySelector('.submenu-livre:not([hidden])')) { cmd('livre-voltar'); return; }
    for (const [nome, [id]] of Object.entries(SUBMENUS)) { const e = $(id); if (e && !e.hidden) { cmd(nome + '-voltar'); return; } }
    cmd('continuar');
  }
  /**
   * Um submenu ('modos' | 'opcoes' | 'estatisticas') no lugar do 1º nível, ou de volta (null). Abrindo, o foco vai ao escolhido
   * (aria-pressed) ou ao 1º controle; voltando, ao item que abriu.
   */
  function submenu(nome) {
    if (!el.acoes) return;
    fecharSubLivre(); // (os submenus Jogadores e Câmera do Livre: livre-pagina.js)
    const volta = subAberto;
    subAberto = SUBMENUS[nome] ? nome : null;
    el.acoes.hidden = !!subAberto;
    for (const [k, [id]] of Object.entries(SUBMENUS)) { const e = $(id); if (e) e.hidden = k !== subAberto; }
    marcarNivel();
    let alvo = null;
    if (subAberto) {
      const l = visiveis($(SUBMENUS[subAberto][0])), semVoltar = l.filter(b => !b.classList.contains('btn-voltar'));
      alvo = semVoltar.find(b => b.getAttribute('aria-pressed') === 'true') ?? semVoltar[0] ?? l[0] ?? null;
    } else if (volta) alvo = $(SUBMENUS[volta][1]);
    if (alvo && alvo.getClientRects().length) alvo.focus({ preventScroll: true });
  }
  const mostrarSubmenu = v => submenu(v ? 'modos' : null);

  // ---- com a pausa (ou a Ajuda) aberta: o HUD do jogo sai (html.pausa-aberta) e fica inert (o Tab e o leitor de tela não chegam)
  const ATRAS = ['hud', 'toque', 'cena'].map($).filter(Boolean);
  function marcarAberta() {
    const aberta = !el.menu.hidden || !el.ajuda.hidden;
    if (raiz.classList.contains('pausa-aberta') !== aberta) raiz.classList.toggle('pausa-aberta', aberta);
    for (const e of ATRAS) if (e.inert !== aberta) e.inert = aberta;
  }
  // o Tab preso na pausa (o nível à vista mais o X, na ordem do DOM) e na Ajuda: dá a volta, nunca sai para o jogo
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
    const aberta = !el.ajuda.hidden ? el.ajuda : !el.menu.hidden ? el.menu : null;
    if (!aberta) return;
    const lista = aberta === el.menu ? focaveisDoNivel(true) : visiveis(aberta);
    if (!lista.length) return;
    e.preventDefault();
    const i = lista.indexOf(document.activeElement);
    const k = i < 0 ? (e.shiftKey ? lista.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + lista.length) % lista.length;
    focar(lista[k]);
  }, true);
  // o destaque segue o foco (classe .selecionado: também no toque, sem :focus-visible, há sempre um item em destaque, como no FC)
  let selecionado = null;
  el.menu?.addEventListener('focusin', e => {
    const b = e.target;
    if (selecionado && selecionado !== b) selecionado.classList.remove('selecionado');
    selecionado = b;
    b.classList?.add('selecionado');
  });
  // o toque que troca de nível (o ≡ que abre, um item que entra ou sai de um submenu, o X e o fundo que fecham): o navegador ainda
  // gera o mousedown de compatibilidade DEPOIS do pointerup, no ponto do dedo — e o mousedown dá o foco ao que ficou embaixo dele
  // no nível NOVO (o X no lugar do ≡, um controle das Opções) ou o tira (o fundo vazio): o foco que o nível escolheu ("Voltar ao
  // jogo", o escolhido do submenu, o item que o abriu) se perdia, e o destaque com ele (revisão do item 58, F4). O mousedown de um
  // toque só dá o foco se a pausa continua no nível em que o dedo desceu (tocar num controle do mesmo nível continua focando ele)
  let nivelNoToque = null, fimDoToque = -1e9;
  const nivelAgora = () => (el.menu.hidden ? (el.ajuda.hidden ? '-' : 'ajuda') : `${el.janelaMenu?.dataset.nivel ?? ''}:${el.janelaMenu?.dataset.sub ?? ''}`);
  window.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') nivelNoToque = nivelAgora(); }, true);
  window.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') fimDoToque = performance.now(); }, true);
  window.addEventListener('mousedown', e => {
    if (nivelNoToque === null) return;
    // (o Chromium marca o mouse que vem do toque; sem a marca — Safari, Firefox —, o que chega logo depois de um toque)
    const caps = e.sourceCapabilities;
    const doToque = caps ? caps.firesTouchEvents : performance.now() - fimDoToque < 800;
    if (doToque && nivelAgora() !== nivelNoToque) e.preventDefault();
  }, true);
  // o mouse em cima de um item dá o foco a ele (como o FC no PC: um só item em destaque)
  el.menu?.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const b = e.target.closest?.('button, input[type="range"]');
    if (b && el.menu.contains(b) && !b.disabled && document.activeElement !== b) b.focus({ preventScroll: true });
  });

  // ---- a pílula do placar da pausa: o espelho do placar do HUD (as siglas, os gols, os escudos e o relógio), escrito ao abrir e,
  // com ela aberta, nas mesmas funções que escrevem o placar (no online o jogo anda por baixo); nos treinos não aparece
  function espelharPlacar() {
    const p = el.pausaPlacar;
    if (!p) return;
    const mostra = modoAtual === 'partida' || modoAtual === 'penaltis' || modoAtual === 'livre';
    if (p.hidden === mostra) p.hidden = !mostra;
    if (!mostra) return;
    const usos = p.querySelectorAll('.pp-escudo use'), siglas = p.querySelectorAll('.pp-sigla'), gols = p.querySelectorAll('.pp-gols b');
    const nomes = [];
    for (let i = 0; i < 2; i++) {
      const h = el.escudos[i]?.getAttribute('href');
      if (h && usos[i] && usos[i].getAttribute('href') !== h) usos[i].setAttribute('href', h);
      const sg = el.siglas[i]?.textContent ?? '', g = el.gols[i]?.textContent ?? '0';
      if (siglas[i] && siglas[i].textContent !== sg) siglas[i].textContent = sg;
      if (gols[i] && gols[i].textContent !== g) gols[i].textContent = g;
      nomes.push(`${times[i]?.nome ?? sg} ${g}`);
    }
    const rel = p.querySelector('.pp-relogio');
    const relVis = !!el.relogio && !el.relogio.hidden;
    if (rel) {
      rel.hidden = !relVis;
      const t = relVis ? `${el.minuto?.textContent ?? ''}${el.tempo?.textContent ? ' ' + el.tempo.textContent : ''}` : '';
      if (rel.textContent !== t) rel.textContent = t;
      if (relVis) nomes.push(t);
    }
    const rot = `Placar: ${nomes.join(', ')}`;
    if (p.getAttribute('aria-label') !== rot) p.setAttribute('aria-label', rot);
  }
  /** Sem lugar entre o topo da faixa e o X, a pílula perde o relógio e depois os escudos (nunca encosta no topo da faixa). */
  function ajustarPilula() {
    const p = el.pausaPlacar;
    if (!p || p.hidden || el.menu.hidden) return;
    p.classList.remove('sem-relogio', 'sem-escudo');
    const topo = el.menu.querySelector('.janela-topo')?.getBoundingClientRect();
    if (!topo || !(topo.width > 0)) return;
    const lim = topo.right + 8;
    if (p.getBoundingClientRect().left >= lim) return;
    p.classList.add('sem-relogio');
    if (p.getBoundingClientRect().left >= lim) return;
    p.classList.add('sem-escudo');
  }
  const pausaAtualizar = () => { if (!el.menu.hidden) { espelharPlacar(); ajustarPilula(); } };
  window.addEventListener('resize', () => requestAnimationFrame(ajustarPilula));

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
  // visto[i] = s que a página i já ficou na tela; no jogo (depois da cena, ou sem ela) passam primeiro as páginas vistas
  // por menos de 0,6·porPar (fila, a partir de tj), cada uma porPar s, e a faixa vai até fim (≥ dur) — contraprova de
  // 14/10: com 4 e 5 trocas o relógio desde o começo da cena pulava um par, que nunca aparecia
  const fs = { pares: null, t0: 0, dur: 0, porPar: FAIXA_SUB.porPar, pagina: -1, modo: null, destaque: null, visto: [], ultimo: 0, fila: [], tj: 0, fim: 0 };
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
    // o tempo desde o quadro anterior conta para a página que estava na tela
    if (fs.pagina >= 0) fs.visto[fs.pagina] += Math.max(0, (agora - fs.ultimo) / 1000);
    fs.ultimo = agora;
    const n = fs.pares.length, pp = fs.porPar;
    const modo = cena ? 'cena' : 'jogo';
    if (modo === 'jogo' && fs.modo !== 'jogo') {
      fs.tj = t;
      fs.fila = [];
      for (let i = 0; i < n; i++) if (fs.visto[i] < 0.6 * pp) fs.fila.push(i);
      // (a última página da cena que ainda está na fila vem primeiro: ela continua, sem piscar)
      const k = fs.fila.indexOf(fs.pagina);
      if (k > 0) { fs.fila.splice(k, 1); fs.fila.unshift(fs.pagina); }
      fs.fim = Math.max(fs.dur, t + fs.fila.length * pp);
    }
    if (!cena && t >= fs.fim) { esconderFaixaSub(); return; }
    let pg;
    if (cena && cena.pagina != null) pg = Math.max(0, Math.min(n - 1, cena.pagina));
    else {
      const u = t - fs.tj;
      pg = u >= 0 && u < fs.fila.length * pp ? fs.fila[Math.floor(u / pp)] : Math.floor(Math.max(0, t) / pp) % n;
    }
    if (pg !== fs.pagina) paginaFaixa(pg);
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
      // controlado: ponto maior com anel branco (na cor do time dele: com o Total Match o humano pode ser o visitante)
      g.fillStyle = ctrl.time === 1 ? COR_MAPA.t1 : COR_MAPA.t0;
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
      pausaAtualizar();
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
    /**
     * O controle e as setas na pausa ou na Ajuda (main.js, ações 'menu-*'): cima/baixo/esq/dir movem o foco pela navegação
     * ESPACIAL entre os focáveis do nível à vista (vizinho; o X fica de fora: o B faz o papel dele); no deslizante em foco,
     * esquerda/direita mudam o valor; ok aperta o botão em foco; voltar volta um nível (voltarNivel).
     */
    navegarPad(acao) {
      const raizAberta = !el.ajuda.hidden ? el.ajuda : !el.menu.hidden ? el.menu : null;
      if (!raizAberta) return;
      if (acao === 'voltar') { voltarNivel(); return; }
      const lista = raizAberta === el.menu ? focaveisDoNivel(false) : visiveis(raizAberta);
      if (!lista.length) return;
      const at = document.activeElement, i = lista.indexOf(at);
      if (acao === 'ok') {
        if (i >= 0 && at.tagName === 'BUTTON') at.click();
        else if (i < 0) focar(lista[0]);
        return;
      }
      if ((acao === 'esq' || acao === 'dir') && i >= 0 && at.type === 'range') {
        const st = +at.step || 1;
        at.value = String(+at.value + (acao === 'dir' ? st : -st));
        at.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (i < 0) { focar(lista[0]); return; }
      const alvo = vizinho(lista, at, acao);
      if (alvo) focar(alvo);
    },
    /**
     * Abre a pausa no 1º nível; foco: seletor do botão que recebe o foco (padrão: o primário visível — Voltar ao jogo, ou o do
     * fim). O HUD do jogo sai (marcarAberta), a pílula copia o placar e o main.js refaz o cartão do time (opc.aoAbrirMenu).
     */
    abrirMenu(forcar = false, foco = null) {
      if (prints && !forcar) return;
      el.ajuda.hidden = true; el.menu.hidden = false;
      if (el.acoes) el.acoes.hidden = false;
      for (const [, [id]] of Object.entries(SUBMENUS)) { const e = $(id); if (e) e.hidden = true; }
      subAberto = null;
      fecharSubLivre();
      marcarNivel();
      marcarAberta();
      espelharPlacar();
      opc.aoAbrirMenu?.();
      ajustarPilula();
      const prim = el.acoes ? visiveis(el.acoes) : [];
      const alvo = (foco && el.menu.querySelector(foco)) || prim.find(b => b.classList.contains('btn-primario')) || prim[0];
      if (alvo && alvo.getClientRects().length) alvo.focus({ preventScroll: true });
    },
    // (fechando, o foco sai do botão que ficou escondido: com ele lá, o Enter seguinte — que no jogo é o 'pular' — também
    // CLICAVA o botão escondido, e abrir e fechar a pausa com Esc deixava o foco no "Reiniciar partida". O padrão do APG
    // devolveria o foco ao ≡, mas aí o Enter seguinte reabriria a pausa: de propósito, o foco sai)
    fecharMenu() { el.menu.hidden = true; soltarFoco(el.menu); marcarAberta(); },
    /** Um submenu da pausa ('modos' | 'opcoes' | 'estatisticas') ou de volta ao 1º nível (null). */
    submenu,
    /** O nível da pausa agora: 'acoes' (o 1º) ou o id do submenu à vista sem o "menu-" ('opcoes', 'modos', 'livre'...); null fechada. */
    get nivelMenu() {
      if (el.menu.hidden) return null;
      const vis = [...el.menu.querySelectorAll('.menu-acoes')].find(e => !e.hidden);
      return vis ? vis.id.replace(/^menu-/, '') : null;
    },
    /** Recalcula o nível (o livre-pagina.js chama depois de trocar os submenus dele). */
    marcarNivel,
    /** O nome da competição no topo da faixa (TM: a do pedido; sem ele, o modo: "Amistoso", "Modo Livre"...). */
    definirCompeticao(t) { if (el.competicao && el.competicao.textContent !== t) el.competicao.textContent = t; },
    /** O último meio usado ('teclado' | 'pad' | 'toque'): a linha dos comandos do PC mostra as teclas ou os botões do controle. */
    definirEntrada(meio) { if (el.menu && el.menu.dataset.entrada !== meio) el.menu.dataset.entrada = meio; },
    /** Lista "Modo de jogo" (partida e treinos) no lugar das ações do menu (true) ou de volta (false). */
    submenuModos: mostrarSubmenu,
    /** Siglas, nomes e escudos ({sigla, nome, escudo: id do elenco}) dos dois times (partida: do elenco) ou null (treino). */
    definirTimes(t) {
      times = t ?? TIMES_TREINO;
      escreverTimes();
      ajustarTopo();
      pausaAtualizar();
    },
    get times() { return times; },
    /**
     * Relógio da partida no placar (item 32; dono, 17/10: "o relógio com os SEGUNDOS além dos minutos"): r = {segundo,
     * tempo (1|2), estado, acrescimo: {anunciado, decorrido} | null} (o {minuto} de antes continua aceito) ou null (treino,
     * Livre, disputa: some). MM:SS no bloco verde ("34:12"); nos acréscimos o relógio continua ("47:13") com o "+4" ao lado,
     * dentro do bloco; no intervalo e no fim, "Intervalo"/"Fim" no lugar do relógio, no bloco parado (relogio-placar.js
     * textoRelogio). Saída rápida pela chave do quadro anterior (nada aloca); escreve no DOM só o que muda (~11 vezes por
     * segundo) e refaz o topo só na troca de formato, do "+N" ou do número de caracteres (os dígitos têm largura fixa).
     */
    relogio(r) {
      if (!el.relogio) return;
      const v = relogioVisto, vis = !!r;
      if (vis !== v.visivel) { el.relogio.hidden = !vis; v.visivel = vis; v.seg = null; ajustarTopo(); pausaAtualizar(); }
      if (!r) return;
      const ac = r.acrescimo, seg = r.segundo ?? -1, min = r.minuto ?? -1, an = ac ? ac.anunciado : -1, dec = ac ? ac.decorrido : -1;
      if (seg === v.seg && r.estado === v.est && an === v.an && min === v.min && dec === v.dec) return;
      v.seg = seg; v.est = r.estado; v.an = an; v.min = min; v.dec = dec;
      const t = textoRelogio(r);
      let topo = false;
      if (t.formato !== v.formato) {
        el.relogio.classList.toggle('com-tempo', t.formato === 'acrescimo');
        el.relogio.classList.toggle('parado', t.formato === 'parado');
        v.formato = t.formato; topo = true;
      }
      if (t.texto !== v.texto) {
        // 99:59 → 100:00 (um gol nos acréscimos máximos do 2º tempo) ou o relógio → "Intervalo": o placar muda de largura
        if ((v.texto ?? '').length !== t.texto.length) topo = true;
        el.minuto.textContent = t.texto; v.texto = t.texto;
      }
      if (t.extra !== v.extra) { el.tempo.textContent = t.extra; v.extra = t.extra; topo = true; }
      if (topo) ajustarTopo();
      pausaAtualizar();
    },
    /**
     * Faixa no meio da tela: f = {titulo, placar, ms?, botao?, botaoTexto?, botaoCmd?, botao2?, botao2Texto?, botao2Cmd?}
     * (botao = "Jogar de novo"; com o Total Match, "Voltar ao Total Match" / "Simular o resto" pelo texto e o comando;
     * botao2 = o 2º botão, "Melhores momentos" no fim da cena do pós-jogo; final = a faixa do fim de jogo: sem os controles
     * de toque enquanto ela está na tela, html.fim-faixa) ou null.
     * Sem ms, fica até ser trocada (fim de jogo). No modo de prints só aparece com forcar.
     */
    faixa(f, forcar = false) {
      if (!el.faixa) return;
      clearTimeout(timerFaixa);
      // a faixa FINAL (f.final: o fim de jogo, com os botões): os controles de toque saem enquanto ela está na tela (depois do
      // apito final não comandam nada; no celular o arco de botões encostava nos botões dela e a zona do analógico, por baixo,
      // ficava com o toque da metade esquerda deles). Qualquer outra faixa (ou nenhuma) os traz de volta (aoFaixaFinal).
      const final = !!f?.final && !(prints && !forcar);
      if (raiz.classList.contains('fim-faixa') !== final) { raiz.classList.toggle('fim-faixa', final); opc?.aoFaixaFinal?.(final); }
      if (!f || (prints && !forcar)) { el.faixa.hidden = true; el.faixa.classList.remove('forcada'); mapaSobFaixa(); return; }
      el.faixaTitulo.textContent = f.titulo ?? '';
      el.faixaPlacar.textContent = f.placar ?? '';
      el.faixaBotao.textContent = f.botaoTexto ?? 'Jogar de novo';
      el.faixaBotao.dataset.cmd = f.botaoCmd ?? 'reiniciar-partida';
      el.faixaBotao.hidden = !f.botao;
      if (el.faixaBotao2) {
        el.faixaBotao2.textContent = f.botao2Texto ?? 'Melhores momentos';
        el.faixaBotao2.dataset.cmd = f.botao2Cmd ?? 'melhores-momentos';
        el.faixaBotao2.hidden = !f.botao2;
      }
      if (el.faixaBotoes) el.faixaBotoes.hidden = !f.botao && !f.botao2;
      el.faixa.classList.toggle('forcada', !!forcar);
      el.faixa.hidden = false;
      mapaSobFaixa();
      if (f.ms) timerFaixa = setTimeout(() => { el.faixa.hidden = true; mapaSobFaixa(); }, f.ms);
    },
    get faixaVisivel() { return !!el.faixa && !el.faixa.hidden; },
    /** O título da faixa na tela (null escondida): quem vai trocá-la sabe qual é (main.js guardarFaixaExpulso). */
    get faixaTitulo() { return el.faixa && !el.faixa.hidden ? el.faixaTitulo.textContent : null; },
    /** Abre a Ajuda; aberta pela pausa, fechar volta para a pausa (antes o jogo recomeçava sem aviso). */
    abrirAjuda(forcar = false) {
      if (prints && !forcar) return;
      ajudaDaPausa = !el.menu.hidden;
      el.menu.hidden = true; el.ajuda.hidden = false;
      soltarFoco(el.menu);
      marcarAberta();
    },
    fecharAjuda() {
      el.ajuda.hidden = true; soltarFoco(el.ajuda);
      marcarAberta();
      if (ajudaDaPausa) { ajudaDaPausa = false; this.abrirMenu(true, '#menu-acoes [data-cmd="ajuda"]'); }
    },
    /** Recalcula o topo do HUD e a faixa de baixo (os controles de toque apareceram ou a tela mudou). */
    ajustarTopo,
    /**
     * O nome do jogador com a bola nos cantos de baixo (item 60, dono 23/10; a exceção escrita à "sem narração": só número e
     * nome): n = null (some) | {time: 0|1, num, nome, apagado} — o time 0 (à esquerda no placar) no canto de baixo à
     * esquerda, o 1 à direita, a faixa da cor do time no placar; apagado = a bola solta (main.js marcarCondutor). Só escreve
     * no DOM quando muda (texto puro, nunca HTML).
     */
    nomeCanto(n) {
      if (!el.nome || !nomeEl) return;
      const chave = n ? `${n.time === 1 ? 1 : 0}|${n.num ?? ''}|${n.nome ?? ''}|${n.apagado ? 1 : 0}` : null;
      if (chave === nomeChave) return;
      nomeChave = chave;
      if (!n) { el.nome.hidden = true; return; }
      const t = n.time === 1 ? 1 : 0;
      el.nome.classList.toggle('dir', t === 1);
      el.nome.classList.toggle('apagado', !!n.apagado);
      const num = n.num != null ? String(n.num) : '';
      if (nomeEl.num.textContent !== num) nomeEl.num.textContent = num;
      const nome = String(n.nome ?? '');
      if (nomeEl.nome.textContent !== nome) nomeEl.nome.textContent = nome;
      // a cor da faixa: a do placar daquele time (o Total Match manda a do time; sem ela, a do CSS: verde × claro)
      const cor = times[t]?.cor ?? '';
      if (nomeEl.cor.style.background !== cor) nomeEl.cor.style.background = cor;
      el.nome.hidden = false;
    },
    /** O nome dos cantos agora (testes): {visivel, lado: 'esq' | 'dir' | null, texto, apagado}. */
    get nomeCantoEstado() {
      const v = !!el.nome && !el.nome.hidden;
      return { visivel: v, lado: v ? (el.nome.classList.contains('dir') ? 'dir' : 'esq') : null, texto: v ? `${nomeEl.num.textContent} ${nomeEl.nome.textContent}`.trim() : '', apagado: v && el.nome.classList.contains('apagado') };
    },
    /** Estado das opções no menu. */
    definirEstado(e) {
      // itens do menu por modo (partida × treinos) e pelo fim de jogo
      if (e.modoTreino !== undefined || e.fim !== undefined) {
        // modo novo: a dica de teclas do PC aparece de novo por 8 s
        if (e.modoTreino !== undefined && modoAtual !== null && e.modoTreino !== modoAtual) mostrarDica();
        if (e.modoTreino !== undefined) modoAtual = e.modoTreino;
        if (e.fim !== undefined) fimDeJogo = !!e.fim;
        aplicarModoNoMenu();
        pausaAtualizar();
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
     * Cena das paradas (o cartão; PLANO-CENAS.md §1.4) ligada/desligada (html.em-cena): do HUD de jogo fica só o placar (a
     * tarja de identificação é da tela das cenas, js/cenas-tela.js); minimapa, menu, avisos, barra de força, ícone do
     * cartão (o cartão está na mão do árbitro), faixas e botões de toque somem; a camada pega qualquer toque (pular) e o
     * "Pular" aparece só com toque.
     */
    cena(ativo, tipo = 'cartao') {
      ativo = !!ativo;
      // (o fim de tempo: o botão da pausa na camada e o rótulo do "Pular")
      // (tipo 'fim' = o intervalo; 'posjogo' = o pós-jogo — os dois com o botão da pausa na camada)
      if (el.cena) {
        const fim = ativo && (tipo === 'fim' || tipo === 'posjogo');
        el.cena.classList.toggle('fim-tempo', fim);
        const b = el.cena.querySelector('#cena-pular');
        if (b) b.setAttribute('aria-label', tipo === 'posjogo' ? 'Pular para o fim de jogo' : fim ? 'Pular o intervalo' : 'Pular a cena do cartão');
      }
      if (raiz.classList.contains('em-cena') === ativo) return;
      raiz.classList.toggle('em-cena', ativo);
      if (el.cena) el.cena.hidden = !ativo;
    },
    get cenaVisivel() { return !!el.cena && !el.cena.hidden; },
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
      fs.visto = pares.map(() => 0); fs.ultimo = agora; fs.fila = []; fs.tj = 0; fs.fim = fs.dur;
      el.faixaSub.hidden = false;
      el.faixaSub.classList.remove('visivel'); void el.faixaSub.offsetWidth; el.faixaSub.classList.add('visivel');
      quadroFaixaSub(agora, cena);
    },
    /** Um quadro da faixa (página, modo, destaque, fim). cena = {pagina, destaque} durante a cena; null no jogo. */
    faixaSubstQuadro: quadroFaixaSub,
    /** Estado da faixa (testes): {visivel, modo, pagina, n, texto, restante (s)}. */
    faixaSubstEstado(agora) {
      const vis = !!el.faixaSub && !el.faixaSub.hidden && !!fs.pares;
      const fim = fs.modo === 'jogo' ? fs.fim : fs.dur;
      return { visivel: vis, modo: fs.modo, pagina: fs.pagina, n: fs.pares?.length ?? 0, texto: el.faixaSub?.dataset.texto ?? '', restante: vis ? fim - (agora - fs.t0) / 1000 : 0, dur: fim };
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
      marcarAberta();
      el.carregando.hidden = true;
    },
  };
}
