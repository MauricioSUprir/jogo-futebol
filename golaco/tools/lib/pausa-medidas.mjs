// A régua da pausa do item 58 (tools/teste-pausa-tela.mjs; vem do mapa/medir-pausa.mjs do "antes"): as funções que rodam NA
// PÁGINA (serializadas pelo page.evaluate: nada de fora delas) e as tabelas (a ordem do 1º nível por modo, os comandos e o caminho
// de cada um). Medem a pausa como ela está na tela: caixas, rolagem, alvos, letras, encostos, cortes, o topo (marca + competição),
// a pílula, o X, o cartão do time e o que ficou fora da área segura. Funcionam na base (a pausa de antes): o que não existe lá
// volta null e a meta reprova.

/** A ordem do 1º nível por modo (contrato "Pausa (item 58)"; o 'par' é a linha Recomeçar | Bola no meu pé do Livre). */
export const ORDEM = {
  partida: ['continuar', 'editar-time', 'estatisticas', 'replay', 'opcoes', 'modos', 'ajuda', 'reiniciar-partida'],
  fim: ['reiniciar-partida', 'editar-time', 'estatisticas', 'replay', 'opcoes', 'modos', 'ajuda'],
  ataque: ['continuar', 'recomecar', 'maquina', 'opcoes', 'modos', 'ajuda'],
  conducao: ['continuar', 'recomecar', 'maquina', 'marcador', 'opcoes', 'modos', 'ajuda'],
  livre: ['continuar', 'livre-jogadores', 'livre-camera', 'par', 'replay', 'opcoes', 'modos', 'ajuda'],
  penaltis: ['continuar', 'replay', 'opcoes', 'modos', 'ajuda', 'reiniciar-partida'],
  tmPartida: ['continuar', 'editar-time', 'estatisticas', 'replay', 'opcoes', 'modos', 'ajuda', 'simular-resto'],
  tmFim: ['voltar-tm', 'editar-time', 'estatisticas', 'replay', 'opcoes', 'modos', 'ajuda'],
  tmTrava: ['continuar', 'estatisticas', 'replay', 'opcoes', 'modos', 'ajuda', 'simular-resto'],
  tmLivre: ['continuar', 'livre-jogadores', 'livre-camera', 'par', 'replay', 'opcoes', 'ajuda', 'voltar-tm'],
  tmPenaltis: ['continuar', 'replay', 'opcoes', 'ajuda', 'simular-resto'],
  online: ['continuar', 'online-pausar', 'editar-time', 'estatisticas', 'opcoes', 'ajuda', 'online-sair'],
};

/** A margem M (da borda útil ao texto) do celular deitado pela largura: 844 → 16, 667/640 → 14, 568 → 12. */
export const margemCelular = W => (W > 760 ? 16 : W > 600 ? 14 : 12);

/**
 * Os comandos da pausa: nome, seletor, sub = o item que abre o submenu dele (null: no 1º nível), c/v = o que tem de chegar ao
 * comando() do main.js, so = em que sessão existe ('partida' | 'treino' | 'conducao' | 'livre' | 'toque' — este só com os controles
 * de toque). secos: os que o teste só registra (o main.js não executa: __golaco.secarComandos), para não trocar o modo no meio.
 */
export const COMANDOS = [
  { nome: 'Voltar ao jogo', sel: '#btn-continuar', c: 'continuar', so: 'todos' },
  { nome: 'Editar time', sel: '#menu-acoes [data-cmd="editar-time"]', c: 'editar-time', so: 'partida' },
  { nome: 'Estatísticas', sel: '#btn-estatisticas', c: 'estatisticas', so: 'partida' },
  { nome: 'Replay', sel: '#menu-acoes [data-cmd="replay"]', c: 'replay', so: 'partida' },
  { nome: 'Opções', sel: '#btn-opcoes', c: 'opcoes', so: 'todos' },
  { nome: 'Modo de jogo', sel: '#btn-modos', c: 'modos', so: 'todos' },
  { nome: 'Ajuda e controles', sel: '#menu-acoes [data-cmd="ajuda"]', c: 'ajuda', so: 'todos' },
  { nome: 'Reiniciar partida', sel: '#btn-reiniciar-partida', c: 'reiniciar-partida', so: 'partida' },
  { nome: 'Qualidade → Alta', sub: '#btn-opcoes', sel: '#menu .segmentado[data-grupo="qualidade"] [data-valor="alta"]', c: 'qualidade', v: 'alta', so: 'todos' },
  { nome: 'Câmera → Aproximada', sub: '#btn-opcoes', sel: '#menu .segmentado[data-grupo="camera"] [data-valor="aproximada"]', c: 'camera', v: 'aproximada', so: 'todos' },
  { nome: 'Minimapa', sub: '#btn-opcoes', sel: '#chip-minimapa', c: 'minimapa', so: 'todos' },
  { nome: 'Replays automáticos → Desligado', sub: '#btn-opcoes', sel: '#menu .segmentado[data-grupo="replayAuto"] [data-valor="desligado"]', c: 'replayAuto', v: 'desligado', so: 'todos' },
  { nome: 'Horário → Noite', sub: '#btn-opcoes', sel: '#menu .segmentado[data-grupo="hora"] [data-valor="noite"]', c: 'hora', v: 'noite', so: 'todos' },
  { nome: 'Som → Desligado', sub: '#btn-opcoes', sel: '#menu .segmentado[data-grupo="som"] [data-valor="desligado"]', c: 'som', v: 'desligado', so: 'todos' },
  { nome: 'Volume', sub: '#btn-opcoes', sel: '#som-volume', c: 'volume', range: true, so: 'todos' },
  { nome: 'Nomes nos botões', sub: '#btn-opcoes', sel: '#chip-nomes', c: 'nomes', so: 'toque' },
  { nome: 'Tamanho dos botões', sub: '#btn-opcoes', sel: '#toque-tamanho', c: 'toqueTamanho', range: true, so: 'todos' },
  { nome: 'Transparência', sub: '#btn-opcoes', sel: '#toque-opacidade', c: 'toqueOpacidade', range: true, so: 'todos' },
  { nome: 'Modo de jogo → Ataque', sub: '#btn-modos', sel: '#menu-modos [data-cmd="modo"][data-valor="ataque"]', c: 'modo', v: 'ataque', so: 'todos' },
  { nome: 'Modo de jogo → Pênaltis', sub: '#btn-modos', sel: '#menu-modos [data-cmd="modo"][data-valor="penaltis"]', c: 'modo', v: 'penaltis', so: 'todos' },
  { nome: 'Modo de jogo → Modo Livre', sub: '#btn-modos', sel: '#btn-modo-livre', c: 'modo', v: 'livre', so: 'todos' },
  { nome: 'Pré-jogo (ciclo)', sub: '#btn-modos', sel: '#btn-prejogo', c: 'prejogo-ciclo', so: 'todos' },
  { nome: 'Substituição (ciclo)', sub: '#btn-modos', sel: '#btn-subst', c: 'subst-ciclo', so: 'todos' },
  { nome: 'Cenas (ciclo)', sub: '#btn-modos', sel: '#btn-cenas', c: 'cenas-ciclo', so: 'todos' },
  // (item 33: a duração e a dificuldade, só na partida)
  { nome: 'Duração (ciclo)', sub: '#btn-modos', sel: '#btn-duracao', c: 'duracao-ciclo', so: 'partida' },
  { nome: 'Dificuldade (ciclo)', sub: '#btn-modos', sel: '#btn-dificuldade', c: 'dificuldade-ciclo', so: 'partida' },
  { nome: 'Treino: Recomeçar', sel: '#menu-acoes [data-cmd="recomecar"]', c: 'recomecar', so: 'treino' },
  { nome: 'Treino: Máquina de passes', sel: '#menu-acoes [data-cmd="maquina"]', c: 'maquina', so: 'treino' },
  { nome: 'Treino: Marcador', sel: '#menu-acoes [data-cmd="marcador"]', c: 'marcador', so: 'conducao' },
  { nome: 'Livre: Jogadores', sel: '#btn-livre-jogadores', c: 'livre-jogadores', so: 'livre' },
  { nome: 'Livre: Câmera', sel: '#btn-livre-camera', c: 'livre-camera', so: 'livre' },
  { nome: 'Livre: Recomeçar (meio)', sel: '#btn-livre-meio', c: 'livre-recomecar', v: 'meio', so: 'livre' },
  { nome: 'Livre: Bola no meu pé', sel: '#btn-livre-pe', c: 'livre-recomecar', v: 'pe', so: 'livre' },
];
/** Os comandos só registrados (o mundo não muda no meio do teste: modo, replay, editor, qualidade, horário, cenas...). */
export const SECOS = ['editar-time', 'replay', 'ajuda', 'reiniciar-partida', 'qualidade', 'camera', 'minimapa', 'replayAuto', 'hora', 'som', 'volume', 'nomes',
  'toqueTamanho', 'toqueOpacidade', 'modo', 'prejogo-ciclo', 'subst-ciclo', 'cenas-ciclo', 'duracao-ciclo', 'dificuldade-ciclo', 'recomecar', 'maquina', 'marcador', 'livre-jogadores', 'livre-camera',
  'livre-recomecar', 'simular-resto', 'voltar-tm', 'tela-cheia'];

/**
 * A linha "Duração | Dificuldade" do "Modo de jogo" (item 33; o P11 do teste-pausa-tela): abre o submenu e mede se ela aparece,
 * se o RÓTULO de cada botão (o nó de texto antes do <small>) cabe dentro do conteúdo dele (até a borda menos o padding), se o
 * <small> corta, e a altura do nível com ela e sem ela (escondida só na hora da medida: no celular deitado ela mora na célula
 * vazia da grade de 2 colunas e não pode mudar a altura). Roda NA PÁGINA.
 */
export const LINHA_AJUSTES = () => {
  const g = window.__golaco;
  g.fecharMenu(); g.abrirMenu();
  const bm = document.getElementById('btn-modos');
  if (!bm || bm.hidden || !bm.getClientRects().length) return { submenu: false, visivel: false };
  bm.click();
  const linha = document.getElementById('linha-ajustes');
  const vis = e => !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const nivel = document.getElementById('menu-modos');
  const alturaNivel = () => { const f = [...nivel.children].filter(vis); const r = nivel.getBoundingClientRect(); return f.length ? Math.max(...f.map(x => x.getBoundingClientRect().bottom)) - r.top : 0; };
  if (!vis(linha)) return { submenu: true, visivel: false, existe: !!linha, h: alturaNivel() };
  const btns = [...linha.querySelectorAll('.btn')].map(bt => {
    const r = bt.getBoundingClientRect(), s = bt.querySelector('small'), cs = getComputedStyle(bt);
    const rg = document.createRange(); rg.selectNodeContents(bt.firstChild); const rt = rg.getBoundingClientRect();
    return { id: bt.id, w: +r.width.toFixed(1), h: +r.height.toFixed(1), rotulo: bt.firstChild.textContent.trim(), rotuloW: +rt.width.toFixed(1),
      cabe: rt.right <= r.right - parseFloat(cs.paddingRight) + 0.5 && rt.left >= r.left + parseFloat(cs.paddingLeft) - 0.5,
      small: s ? s.textContent : null, smallCorta: s ? s.scrollWidth > s.clientWidth + 0.5 : null };
  });
  const com = alturaNivel();
  linha.style.display = 'none';
  const sem = alturaNivel();
  linha.style.display = '';
  return { submenu: true, visivel: true, btns, h: +com.toFixed(1), hSem: +sem.toFixed(1), titulo: document.getElementById('titulo-modos')?.textContent ?? null };
};

/** A pausa como está na tela agora (o nível à vista). ordem/margem: só informam; o teste decide. */
export const MEDIR = () => {
  const est = e => getComputedStyle(e);
  const vis = e => !!e && !e.hidden && e.getClientRects().length > 0 && est(e).visibility !== 'hidden' && est(e).display !== 'none';
  const R = e => { const r = e.getBoundingClientRect(); return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), r: +r.right.toFixed(2), b: +r.bottom.toFixed(2) }; };
  const nome = e => (e.dataset?.cmd ? e.dataset.cmd + (e.dataset.valor ? ':' + e.dataset.valor : '') : '') || (e.id ? e.id.replace(/^btn-/, '') : '')
    || (e.closest('.segmentado') ? `${e.closest('.segmentado').dataset.grupo}:${e.dataset.valor}` : '') || String(e.className || e.tagName).split(' ')[0];
  const chave = e => e.classList.contains('linha-par') ? 'par' : (e.dataset?.cmd ?? (e.id ? e.id.replace(/^btn-/, '') : (e.classList.contains('linha-continuar') ? 'linha-continuar' : String(e.className).split(' ')[0])));
  const menu = document.getElementById('menu');
  if (!menu || menu.hidden) return { aberta: false };
  const cs = getComputedStyle(document.documentElement);
  const sa = ['--sa-t', '--sa-r', '--sa-b', '--sa-l'].map(v => parseFloat(cs.getPropertyValue(v)) || 0);
  const W = innerWidth, H = innerHeight;
  const j = menu.querySelector('.janela-menu'), corpo = menu.querySelector('.menu-corpo');
  const niveis = [...menu.querySelectorAll('.menu-acoes')].filter(vis);
  const nivel = niveis[0] ?? null;
  const rolas = [j ? j.scrollHeight - j.clientHeight : 0, corpo && vis(corpo) ? corpo.scrollHeight - corpo.clientHeight : 0, ...niveis.map(n => n.scrollHeight - n.clientHeight)];
  const rola = Math.max(...rolas);
  const primeiro = nivel && nivel.id === 'menu-acoes';
  const linhas = primeiro ? [...nivel.children].filter(vis).map(e => ({ id: chave(e), ...R(e), texto: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) })) : null;
  const alvos = [...menu.querySelectorAll('button, input[type="range"]')].filter(vis);
  const tam = alvos.map(b => ({ nome: nome(b), ...R(b) }));
  // letras: o texto à vista fora do cartão (≥ 11) e as do cartão (as fichas: ≥ 10, ≥ 11 a partir de 640)
  const cartaoEl = menu.querySelector('.pausa-time');
  const comTexto = [...menu.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !e.closest('.sr, .pt-sr, caption'));
  let fonteMin = null, fonteMinCartao = null;
  for (const e of comTexto) {
    const f = parseFloat(est(e).fontSize), t = e.textContent.replace(/\s+/g, ' ').trim().slice(0, 20);
    if (cartaoEl && cartaoEl.contains(e)) { if (!fonteMinCartao || f < fonteMinCartao.f) fonteMinCartao = { t, f }; } else if (!fonteMin || f < fonteMin.f) fonteMin = { t, f };
  }
  // cortes: o botão da lista transborda (o texto do item tem de caber inteiro; só o .estado ganha "…"), os segmentados e os rótulos
  const cortados = [...menu.querySelectorAll('button, .opcao-rotulo, .livre-rotulo, .sub-titulo')].filter(vis)
    .filter(b => b.scrollWidth > b.clientWidth + 1 && !b.classList.contains('estado')).map(nome);
  // encostos: dois alvos a < 2 px um do outro (sem um conter o outro)
  const enc = [];
  for (let a = 0; a < alvos.length; a++) for (let b = a + 1; b < alvos.length; b++) {
    const A = alvos[a], B = alvos[b];
    if (A.contains(B) || B.contains(A)) continue;
    const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    const gap = Math.max(rb.left - ra.right, ra.left - rb.right, rb.top - ra.bottom, ra.top - rb.bottom);
    if (gap < 2) enc.push(`${nome(A)} × ${nome(B)} (${gap.toFixed(1)})`);
  }
  // fora da área segura: os alvos, o topo, a pílula e o cartão
  const util = { x0: sa[3], x1: W - sa[1], y0: sa[0], y1: H - sa[2] };
  const topo = menu.querySelector('.pausa-faixa .janela-topo') ?? menu.querySelector('.janela-topo');
  const pilula = menu.querySelector('#pausa-placar'), x = menu.querySelector('.btn-fechar[data-cmd="continuar"]');
  const fora = [...alvos, ...[topo, pilula, cartaoEl].filter(vis)].filter(e => { const r = e.getBoundingClientRect(); return r.left < util.x0 - 0.5 || r.right > util.x1 + 0.5 || r.top < util.y0 - 0.5 || r.bottom > util.y1 + 0.5; }).map(nome);
  const item = menu.querySelector('#btn-continuar') ?? alvos[0];
  return {
    aberta: true, W, H, sa, toque: document.documentElement.classList.contains('com-toque'), tm: document.documentElement.classList.contains('tm'),
    nivel: nivel?.id ?? null, rola, rolas, linhas,
    lista: nivel ? R(nivel) : null, topo: topo && vis(topo) ? R(topo) : null, pilula: pilula && vis(pilula) ? { ...R(pilula), classe: pilula.className } : null,
    x: x && vis(x) ? R(x) : null, cartao: cartaoEl && vis(cartaoEl) ? R(cartaoEl) : null,
    alvos: tam, fonteMin, fonteMinCartao, cortados, encosta: enc, fora,
    fonte: item ? est(item).fontFamily : null,
    menuFundo: est(menu).backgroundColor,
  };
};

/** O id (pela regra do MEDIR) do elemento em foco e se ele está dentro da pausa. */
export const FOCO = () => {
  const a = document.activeElement;
  if (!a || a === document.body) return { id: 'BODY', dentro: false };
  const id = (a.dataset?.cmd ? a.dataset.cmd + (a.dataset.valor ? ':' + a.dataset.valor : '') : '') || a.id
    || (a.closest?.('.segmentado') ? `${a.closest('.segmentado').dataset.grupo}:${a.dataset.valor}` : '') || a.tagName;
  return { id, dentro: !!document.getElementById('menu')?.contains(a) && !document.getElementById('menu').hidden };
};

/**
 * Cada item do 1º nível COM o foco (a letra cresce de --item-f a --item-f-foco e o peso vai a 800): o texto do item cabe na
 * linha? (o .menu-corpo corta o que passa, sem "…"). Devolve [{id, f, sobra}] — sobra = da borda de dentro do botão (menos o
 * padding da direita) ao fim do texto, ou ao começo do estado à direita quando ele aparece; < 0 = cortado. O foco volta ao que
 * estava.
 */
export const FOCO_LARGURA = () => {
  const menu = document.getElementById('menu');
  if (!menu || menu.hidden) return [];
  const est = e => getComputedStyle(e);
  const vis = e => !!e && !e.hidden && e.getClientRects().length > 0 && est(e).display !== 'none' && est(e).visibility !== 'hidden';
  const nivel = document.getElementById('menu-acoes');
  if (!vis(nivel)) return [];
  const bts = [...nivel.querySelectorAll(':scope > button, :scope > .linha-par > button')].filter(vis);
  const antes = document.activeElement;
  const out = [];
  for (const b of bts) {
    b.focus({ preventScroll: true });
    const cs = est(b), br = b.getBoundingClientRect();
    // o texto do item: os nós de texto fora do estado/descrição (o 1º nó, ou o span dele)
    const nos = [];
    const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.data.trim() && !n.parentElement.closest('small, .sr')) nos.push(n);
    if (!nos.length) continue;
    let dir = -Infinity;
    for (const n of nos) { const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) dir = Math.max(dir, r.right); }
    const estado = [...b.querySelectorAll('small')].find(s => !s.classList.contains('desc') && vis(s) && s.getBoundingClientRect().width > 0.5);
    const lim = estado ? estado.getBoundingClientRect().left : br.right - parseFloat(cs.paddingRight);
    const id = b.dataset.cmd ? b.dataset.cmd + (b.dataset.valor ? ':' + b.dataset.valor : '') : b.id;
    // o que o corpo da lista corta (overflow-x: hidden): o texto também tem de ficar dentro dele
    const corpo = b.closest('.menu-corpo');
    const limCorpo = corpo ? corpo.getBoundingClientRect().right : Infinity;
    out.push({ id, f: parseFloat(cs.fontSize), sobra: +Math.min(lim - dir, limCorpo - dir).toFixed(1) });
  }
  if (antes && antes !== document.body && menu.contains(antes)) antes.focus({ preventScroll: true }); else document.activeElement?.blur?.();
  return out;
};
