// Modo Livre — a parte da PÁGINA (DOM): a escolha de quantos jogadores (salva em localStorage golaco.livre.v1), o submenu
// Jogadores e os recomeços na pausa, a fila da mudança (entra no 1º passo depois da pausa, como a edição do time) e a API
// dos testes (__golaco.livre). Carregado por import dinâmico junto com livre.js (main.js carregarLivre): sem o Livre nada
// disto entra no download (teste-carga). A lógica (pura) é a do livre.js; contrato "Modo Livre" no CONTRATOS.md.
//
// A pausa do Livre: o HTML (os botões data-so="livre", os submenus #menu-livre e #menu-camera-livre, o botão da câmera nas
// Opções) e o CSS são postos aqui na 1ª vez — fora do download sem o Livre. O 1º nível (a pausa do item 58: 8 linhas, cabe sem
// rolar de 844×390 a 568×320, tools/teste-livre-tela.mjs e teste-pausa-tela.mjs): Voltar ao jogo; Jogadores; Câmera;
// Recomeçar | Bola no meu pé (a única linha com dois); Replay; Opções; Modo de jogo (com ?tm, "Voltar ao Total Match" por
// último); Ajuda. O Editar time, as Estatísticas e o Reiniciar não aparecem (data-so).
// Submenu Jogadores: o total de cada lado com −/+ e o goleiro (vale ao sair da pausa). Submenu Câmera: as 6 câmeras
// (render/camera-livre.js) e Altura/Distância 0–20; nas Opções o segmentado TV | Aproximada dá lugar a um botão com o nome
// da câmera que abre o submenu. A câmera, a Altura e a Distância ficam nas prefs da página
// (golaco.prefs.v1: cameraLivre, cameraAjuste); a da partida (prefs.camera) não muda. C/R3 = a próxima câmera.
//
// A escolha fica na visão do HUMANO ([meu time, adversário]); o mundo usa os índices dos TIMES (escolhaParaTimes troca os
// dois quando o humano é o time 1, o visitante do Total Match).

import { aoTocar } from './toque-botao.js';
import { LIVRE } from './config.js';
import { CAMERAS_LIVRE, NOME_CAMERA, AJUSTE, criarCameraLivre, fatorAjuste } from './render/camera-livre.js';

const CHAVE = 'golaco.livre.v1';
const SETA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// (a pausa do item 58: os botões dos submenus em pílula vêm do estilo.css — bloco "Pausa"; aqui só o que é do Livre)
const CSS = `
/* os submenus Jogadores e Câmera: cada linha com o nome à esquerda e o −/+ (e o Goleiro) à direita */
#menu .livre-time { display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; row-gap: 4px; min-height: 44px; }
#menu .livre-rotulo { flex: 1 1 auto; min-width: 0; font: 800 16px / 1.2 var(--f-disp, var(--p-fonte)); letter-spacing: 0.04em; text-transform: uppercase; color: var(--p-texto); white-space: nowrap; }
#menu .livre-ctrl { display: flex; align-items: center; gap: 6px; flex: none; margin-left: auto; }
#menu .livre-time .btn { flex: none; justify-content: center; min-width: 44px; padding: 0 14px; }
#menu .livre-time .livre-passo { width: 44px; padding: 0; font-size: 20px; }
#menu .livre-n { flex: none; width: 2.2em; text-align: center; font: 800 22px / 1 var(--f-disp, var(--p-fonte)); font-variant-numeric: tabular-nums; color: var(--p-verde-cl); }
#menu .livre-gol[aria-pressed="true"] { border-color: var(--p-verde); color: var(--p-verde-cl); }
#menu .livre-gol[aria-pressed="false"] { opacity: 0.55; }
#menu #menu-livre .btn[aria-disabled="true"], #menu #menu-camera-livre .btn[aria-disabled="true"] { opacity: 0.4; cursor: default; }
/* as 6 câmeras em 2 linhas de 3; a do meio mais larga (Aproximada, Atrás); a escolhida em degradê */
#menu .livre-cameras { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 1fr); gap: 6px; }
#menu .livre-cameras .btn { justify-content: center; min-width: 44px; padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
#menu .livre-cameras .btn[aria-pressed="true"] { background: linear-gradient(120deg, #4ade80, #22c55e); color: var(--p-preto); border-color: transparent; font-weight: 800; }
#menu .submenu-livre .livre-pares { display: flex; flex-direction: column; gap: 6px; }
/* no celular (a faixa larga): Altura | Distância lado a lado; Meu time e Adversário um embaixo do outro (com o Goleiro, o −/+ não
   cabia em meia faixa de 568×320) */
@media (max-height: 480px) {
  #menu #menu-camera-livre .livre-pares { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 20px; row-gap: 6px; }
  #menu .livre-time { min-height: 40px; }
  #menu .livre-n { width: 1.7em; }
}
/* Opções → Câmera: no Livre, o nome da câmera (abre o submenu Câmera) no lugar do segmentado TV | Aproximada */
#menu .btn-camera-livre { display: none; }
html.em-livre #menu .segmentado[data-grupo="camera"] { display: none; }
html.em-livre #menu .btn-camera-livre {
  display: inline-flex; align-items: center; justify-content: center; flex: none; min-width: 44px; height: 32px; padding: 0 14px; cursor: pointer;
  font: 800 13px / 1 var(--p-fonte); color: var(--p-preto); background: linear-gradient(120deg, #4ade80, #22c55e); border: 0; border-radius: 8px;
  white-space: nowrap; outline: 0;
}
html.em-livre #menu .btn-camera-livre:focus-visible, html.em-livre #menu .btn-camera-livre.selecionado { outline: 2px solid var(--p-verde-cl); outline-offset: 1px; }
@media (max-height: 480px) and (max-width: 600px) { html.em-livre #menu .btn-camera-livre { height: 30px; } }`;
const CHAVE_CAM = 'cameraLivre', CHAVE_AJUSTE = 'cameraAjuste';

/** Lê a escolha (visão do humano) e a põe nos limites: meu time 1–10 de linha, o adversário 0–10; goleiros booleanos. */
export function limitarEscolha(e) {
  const P = LIVRE.padrao;
  const n = (v, d, min) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(min, Math.min(LIVRE.linhaMax, x)) : d; };
  const g = (v, d) => (typeof v === 'boolean' ? v : d);
  return { linha: [n(e?.linha?.[0], P.linha[0], 1), n(e?.linha?.[1], P.linha[1], 0)], goleiro: [g(e?.goleiro?.[0], P.goleiro[0]), g(e?.goleiro?.[1], P.goleiro[1])] };
}

/** "N contra M" (os totais: linha + goleiro) de uma escolha. */
export const textoEscolha = e => `${e.linha[0] + (e.goleiro[0] ? 1 : 0)} contra ${e.linha[1] + (e.goleiro[1] ? 1 : 0)}`;

/**
 * ctx = {hud, logica (livre.js), mundo () → o mundo, timeHumano (0|1), pedidoLivre (o `livre` do pedido do TM, nos índices
 * dos times: {linha: [casa, fora], goleiro: [casa, fora]}, ou null), comando (c, v) (o da página), acao (a) (põe a
 * ação-objeto na fila do próximo passo), soltar () (solta a entrada antes da pausa)}.
 */
export function criarPaginaLivre(ctx) {
  const { hud, logica, timeHumano: h } = ctx;
  const doc = typeof document !== 'undefined' ? document : null;
  const $ = id => doc?.getElementById(id);
  /** A escolha na visão do humano ↔ nos índices dos times (a mesma troca nos dois sentidos). */
  const trocar = e => ({ linha: h === 0 ? e.linha.slice() : [e.linha[1], e.linha[0]], goleiro: h === 0 ? e.goleiro.slice() : [e.goleiro[1], e.goleiro[0]] });
  // o rascunho (visão do humano): com ?tm, o do pedido; senão a última escolha salva; senão LIVRE.padrao
  let rascunho;
  {
    let e = null;
    if (ctx.pedidoLivre) e = trocar({ linha: ctx.pedidoLivre.linha ?? [], goleiro: ctx.pedidoLivre.goleiro ?? [] });
    else { try { const t = localStorage.getItem(CHAVE); e = t ? JSON.parse(t) : null; } catch (_) { e = null; } }
    rascunho = limitarEscolha(e);
  }
  let naFila = null;

  // ---------------------------------------------------------------- o HTML e o CSS da pausa (uma vez)
  function montarDom() {
    if (!doc || $('menu-livre')) return;
    const st = doc.createElement('style');
    st.id = 'estilo-livre'; st.textContent = CSS;
    doc.head.appendChild(st);
    // o 1º nível (item 58): Jogadores e Câmera soltos e Recomeçar | Bola no meu pé numa linha só (a única exceção da lista: a
    // pausa do Livre fica com 8 linhas e cabe em 568×320), antes dos treinos e do Replay
    const acoes = $('menu-acoes'), ref = acoes?.querySelector('[data-cmd="recomecar"]') ?? acoes?.querySelector('[data-cmd="replay"]');
    if (acoes) {
      const t = doc.createElement('template');
      t.innerHTML = `<button class="btn" type="button" data-cmd="livre-jogadores" id="btn-livre-jogadores" data-so="livre"><span class="item-txt">Jogadores</span> <small class="estado" id="estado-livre"></small></button>
<button class="btn" type="button" data-cmd="livre-camera" id="btn-livre-camera" data-so="livre"><span class="item-txt">Câmera</span> <small class="estado" id="estado-camera-livre"></small></button>
<div class="linha-par" role="group" aria-label="Recomeçar" data-so="livre">
<button class="btn" type="button" data-cmd="livre-recomecar" data-valor="meio" id="btn-livre-meio" aria-describedby="desc-livre-meio"><span class="item-txt">Recomeçar</span> <small class="desc" id="desc-livre-meio">bola no meio</small></button>
<button class="btn" type="button" data-cmd="livre-recomecar" data-valor="pe" id="btn-livre-pe" aria-describedby="desc-livre-pe"><span class="item-txt">Bola no meu pé</span> <small class="desc" id="desc-livre-pe">onde estou</small></button>
</div>`;
      acoes.insertBefore(t.content, ref ?? null);
    }
    const modos = $('menu-modos');
    if (modos) {
      const lado = (id, nome) => `<div class="livre-time livre-lado" role="group" aria-label="${nome}"><span class="livre-rotulo">${nome}</span><span class="livre-ctrl">
<button class="btn livre-passo" type="button" data-cmd="livre-menos" data-valor="${id}" aria-label="Um a menos: ${nome}">−</button>
<output class="livre-n" id="livre-n-${id}" aria-live="polite"></output>
<button class="btn livre-passo" type="button" data-cmd="livre-mais" data-valor="${id}" aria-label="Um a mais: ${nome}">+</button>
<button class="btn livre-gol" type="button" data-cmd="livre-goleiro" data-valor="${id}" aria-pressed="true" aria-label="Goleiro: ${nome}">Goleiro</button></span></div>`;
      const linhaAjuste = (id, nome) => `<div class="livre-time" role="group" aria-label="${nome}"><span class="livre-rotulo">${nome}</span><span class="livre-ctrl">
<button class="btn livre-passo" type="button" data-cmd="livre-ajuste-menos" data-valor="${id}" aria-label="${nome}: menos">−</button>
<output class="livre-n" id="livre-ajuste-${id}" aria-live="polite"></output>
<button class="btn livre-passo" type="button" data-cmd="livre-ajuste-mais" data-valor="${id}" aria-label="${nome}: mais">+</button></span></div>`;
      const t = doc.createElement('template');
      // o submenu Jogadores (abre no lugar da lista de ações, como o "Modo de jogo"): o TOTAL de cada lado (de linha +
      // goleiro), −/+ um de linha e o goleiro liga/desliga; vale ao sair da pausa (Jogar ou Voltar ao jogo), sem recomeçar
      t.innerHTML = `<div class="menu-acoes submenu-livre" id="menu-livre" role="group" aria-labelledby="titulo-livre" hidden>
<div class="sub-topo"><button class="btn btn-voltar" type="button" data-cmd="livre-voltar">${SETA}Voltar</button><h3 class="sub-titulo" id="titulo-livre">Jogadores</h3></div>
<div class="livre-pares">
${lado('meu', 'Meu time')}
${lado('adv', 'Adversário')}
</div>
<button class="btn btn-primario" type="button" data-cmd="livre-jogar" id="btn-livre-jogar">Jogar</button></div>
<div class="menu-acoes submenu-livre" id="menu-camera-livre" role="group" aria-labelledby="titulo-camera-livre" hidden>
<div class="sub-topo"><button class="btn btn-voltar" type="button" data-cmd="livre-voltar">${SETA}Voltar</button><h3 class="sub-titulo" id="titulo-camera-livre">Câmera</h3></div>
<div class="livre-cameras" role="group" aria-label="Câmera">${CAMERAS_LIVRE.map(c => `<button class="btn" type="button" data-cmd="livre-cam" data-valor="${c}" aria-pressed="false">${NOME_CAMERA[c]}</button>`).join('')}</div>
<div class="livre-pares">
${linhaAjuste('altura', 'Altura')}
${linhaAjuste('distancia', 'Distância')}
</div></div>`;
      modos.after(t.content);
    }
    // nas Opções (linha Câmera): o nome da câmera (abre o submenu) no lugar do segmentado TV | Aproximada (só no Livre: CSS)
    const seg = doc.querySelector('#menu .segmentado[data-grupo="camera"]');
    if (seg) {
      const b = doc.createElement('button');
      b.type = 'button'; b.className = 'btn-camera-livre'; b.id = 'opcao-camera-livre'; b.dataset.cmd = 'livre-camera';
      b.setAttribute('aria-label', 'Câmera do Modo Livre');
      seg.after(b);
    }
    for (const b of doc.querySelectorAll('#menu [data-cmd^="livre-"]')) aoTocar(b, () => { if (b.getAttribute('aria-disabled') !== 'true') ctx.comando(b.dataset.cmd, b.dataset.valor); });
  }

  // ---------------------------------------------------------------- a câmera (render/camera-livre.js por cima de camera.js)
  const prefs = ctx.prefs ?? {};
  const lerAjuste = v => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(AJUSTE.min, Math.min(AJUSTE.max, x)) : AJUSTE.padrao; };
  const ajuste = { altura: lerAjuste(prefs[CHAVE_AJUSTE]?.altura), distancia: lerAjuste(prefs[CHAVE_AJUSTE]?.distancia) };
  const camLivre = criarCameraLivre({ dir: () => ctx.dirAtaque?.() ?? 1 });
  camLivre.definirAjuste(ajuste);
  const salvar = () => { try { ctx.salvarPrefs?.(prefs); } catch (_) { /* sem armazenamento */ } };
  /**
   * −/+ no limite fica apagado e não faz nada (aria-disabled; o toque nele é ignorado em montarDom), mas continua com o foco:
   * com `disabled` o foco do controle ia para o <body> e a cruz voltava ao 1º botão da pausa (o A seguinte apertava o
   * Minimapa); passando o foco para o par, o A seguinte voltava o número.
   */
  function desligar(b, v) {
    if (b) b.setAttribute('aria-disabled', String(!!v));
  }
  // a câmera escolhida (o ctx.camera() só existe depois do iniciar() do main.js: aqui nada o lê antes de ligarCamera)
  let modoCam = CAMERAS_LIVRE.includes(prefs[CHAVE_CAM]) ? prefs[CHAVE_CAM] : 'tv';
  /** O botão "Câmera <nome>", o da coluna das opções, as 6 do submenu e Altura/Distância. */
  function marcarCamera() {
    const m = modoCam;
    for (const id of ['estado-camera-livre', 'opcao-camera-livre']) { const e = $(id); if (e) e.textContent = NOME_CAMERA[m]; }
    for (const b of doc?.querySelectorAll('#menu-camera-livre [data-cmd="livre-cam"]') ?? []) b.setAttribute('aria-pressed', String(b.dataset.valor === m));
    for (const k of ['altura', 'distancia']) {
      const o = $(`livre-ajuste-${k}`); if (o) o.textContent = String(ajuste[k]);
      const q = s => $('menu-camera-livre')?.querySelector(`[data-cmd="${s}"][data-valor="${k}"]`);
      const menos = q('livre-ajuste-menos'), mais = q('livre-ajuste-mais');
      desligar(menos, ajuste[k] <= AJUSTE.min);
      desligar(mais, ajuste[k] >= AJUSTE.max);
    }
  }
  // os cantos do lado de cá (render/cantos-livre.js; só no Livre): Atrás e Jogador olham pelo comprimento e deixavam o vão
  // entre o fundo e a arquibancada de cá à vista. O módulo vem na 1ª vez; o material é o dos fundos do jogo, que só existe
  // depois do criarCampo (o iniciar liga a câmera antes): espera ele por alguns quadros
  let cantos = null, cantosPedidos = false;
  function ligarCantos(v) {
    if (!doc) return;
    if (cantos) { cantos.visivel(v && !!ctx.mundo()?.livre); return; }
    if (!v || cantosPedidos) return;
    cantosPedidos = true;
    import('./render/cantos-livre.js').then(M => {
      const tentar = n => {
        const cena = ctx.cena?.(), mat = cena?.getObjectByName('arquibancada-fundos')?.material;
        if (!mat) { if (n < 900) requestAnimationFrame(() => tentar(n + 1)); else cantosPedidos = false; return; }
        cantos = M.criarCantosLivre(cena, mat);
        cantos.visivel(!!ctx.mundo()?.livre);
      };
      tentar(0);
    }).catch(() => { cantosPedidos = false; });
  }
  /** Liga (no Livre) ou desliga a câmera do Livre na câmera da página; desligando, volta a da partida (prefs.camera). */
  function ligarCamera(v) {
    ligarCantos(v);
    const c = ctx.camera?.();
    if (!c) return;
    if (v) {
      c.definirExtra(camLivre);
      const pedida = ctx.cameraPedida;
      c.definirModo(CAMERAS_LIVRE.includes(pedida) ? pedida : CAMERAS_LIVRE.includes(prefs[CHAVE_CAM]) ? prefs[CHAVE_CAM] : c.modo);
      modoCam = c.modo;
      hud.definirEstado({ camera: c.modo });
      marcarCamera();
    } else {
      c.definirExtra(null);
      const m = prefs.camera === 'aproximada' ? 'aproximada' : 'tv';
      c.definirModo(m);
      hud.definirEstado({ camera: m });
    }
  }
  /** Escolhe a câmera do Livre ('proxima' = a seguinte, C/R3). true = tratado (no Livre). */
  function camera(v) {
    const c = ctx.camera?.();
    if (!c || !ctx.mundo()?.livre) return false;
    const m = v === 'proxima' ? CAMERAS_LIVRE[(CAMERAS_LIVRE.indexOf(c.modo) + 1) % CAMERAS_LIVRE.length] : v;
    if (!CAMERAS_LIVRE.includes(m)) return true;
    c.definirModo(m);
    modoCam = c.modo;
    prefs[CHAVE_CAM] = m; salvar();
    hud.definirEstado({ camera: m });
    marcarCamera();
    // pela tecla (fora da pausa): o aviso de comando com o nome (a pausa mostra no botão)
    if (v === 'proxima') hud.evento('livreCamera', { texto: `Câmera: ${NOME_CAMERA[m]}` });
    return true;
  }
  function mudarAjuste(k, passo) {
    if (!(k in ajuste)) return;
    ajuste[k] = lerAjuste(ajuste[k] + passo);
    camLivre.definirAjuste(ajuste);
    prefs[CHAVE_AJUSTE] = { ...ajuste }; salvar();
    marcarCamera();
  }

  /** O submenu e o "N contra M" do botão Jogadores (e o da linha Modo Livre do "Modo de jogo"). */
  function marcar() {
    const L = rascunho;
    ['meu', 'adv'].forEach((lado, k) => {
      const n = $(`livre-n-${lado}`);
      if (n) n.textContent = String(L.linha[k] + (L.goleiro[k] ? 1 : 0));
      const q = s => $('menu-livre')?.querySelector(`[data-cmd="${s}"][data-valor="${lado}"]`);
      q('livre-goleiro')?.setAttribute('aria-pressed', String(L.goleiro[k]));
      const menos = q('livre-menos'), mais = q('livre-mais');
      desligar(menos, L.linha[k] <= (k === 0 ? 1 : 0));
      desligar(mais, L.linha[k] >= LIVRE.linhaMax);
    });
    for (const id of ['estado-livre', 'estado-modo-livre']) { const e = $(id); if (e) e.textContent = textoEscolha(L); }
  }

  /** Um submenu ('jogadores' | 'camera') no lugar das ações, ou de volta (null). */
  let aberto = null;
  function submenu(qual) {
    const acoes = $('menu-acoes'), lv = $('menu-livre'), lc = $('menu-camera-livre');
    if (!acoes || !lv || !lc) return;
    const volta = aberto;
    aberto = qual;
    acoes.hidden = !!qual; lv.hidden = qual !== 'jogadores'; lc.hidden = qual !== 'camera';
    for (const id of ['menu-modos', 'menu-opcoes', 'menu-estatisticas']) { const e = $(id); if (e) e.hidden = true; }
    hud.marcarNivel?.();
    const foco = qual === 'jogadores' ? $('btn-livre-jogar') : qual === 'camera' ? lc.querySelector('[aria-pressed="true"]')
      : volta === 'camera' ? $('btn-livre-camera') : $('btn-livre-jogadores');
    foco?.focus({ preventScroll: true });
  }

  /** A escolha (visão do humano) vira o rascunho, vai para a fila (o 1º passo depois da pausa) e fica salva. */
  function definir(r) {
    rascunho = limitarEscolha(r);
    try { localStorage.setItem(CHAVE, JSON.stringify(rascunho)); } catch (_) { /* sem armazenamento: só nesta sessão */ }
    marcar();
    if (ctx.mundo()?.livre) naFila = { tipo: 'livreAjuste', ...trocar(rascunho) };
  }

  /** Comandos livre-* da pausa (true = tratado). */
  function comando(c, v) {
    const m = ctx.mundo();
    switch (c) {
      case 'livre-jogadores': if (m?.livre) { marcar(); submenu('jogadores'); } return true;
      case 'livre-camera':
        if (!m?.livre) return true;
        marcarCamera();
        // o botão da coluna das opções abre o submenu também com a pausa no submenu Jogadores
        if (!hud.menuAberto) hud.abrirMenu(true);
        submenu('camera');
        return true;
      case 'livre-cam': camera(v); return true;
      case 'livre-ajuste-mais': mudarAjuste(v, 1); return true;
      case 'livre-ajuste-menos': mudarAjuste(v, -1); return true;
      case 'livre-voltar': submenu(null); return true;
      case 'livre-mais': case 'livre-menos': case 'livre-goleiro': {
        if (!m?.livre) return true;
        const k = v === 'adv' ? 1 : 0, r = { linha: rascunho.linha.slice(), goleiro: rascunho.goleiro.slice() };
        if (c === 'livre-mais') r.linha[k]++; else if (c === 'livre-menos') r.linha[k]--; else r.goleiro[k] = !r.goleiro[k];
        definir(r);
        return true;
      }
      case 'livre-jogar': hud.fecharMenu(); return true;
      case 'livre-recomecar':
        hud.fecharMenu();
        if (m?.livre) ctx.acao({ tipo: 'livreRecomecar', onde: v === 'pe' ? 'pe' : 'meio' });
        return true;
      default: return false;
    }
  }

  montarDom();
  marcar();
  marcarCamera();
  return {
    /** A escolha nos índices dos times (para criarLivre). */
    escolhaTimes: () => trocar(rascunho),
    marcar,
    comando,
    /** A ação-objeto da mudança na fila (tirada: entra no passo) ou null. */
    tirarDaFila() { const a = naFila; naFila = null; return a; },
    limparFila() { naFila = null; },
    /** Entrando no Livre: a pausa aberta no submenu Jogadores com o "Jogar" (o rascunho = o que está em campo). */
    abrirJogadores() {
      const m = ctx.mundo();
      if (!m?.livre) return;
      rascunho = limitarEscolha(trocar(logica.escolhaDoMundo(m)));
      marcar();
      ctx.soltar?.();
      hud.abrirMenu(true);
      submenu('jogadores');
    },
    ligarCamera,
    camera,
    marcarCamera,
    /** A mudança feita (evento livreAjuste): o aviso de comando "N contra M", na visão do humano. */
    evento(ev) { hud.evento(ev, { texto: textoEscolha(trocar({ linha: ev.linha, goleiro: ev.goleiro })) }); },
    /** API dos testes (__golaco.livre; índices dos TIMES). */
    api: {
      escolha() {
        const m = ctx.mundo();
        if (!m?.livre) return null;
        return { ...logica.resumoLivre(m), naFila: naFila ? { linha: naFila.linha.slice(), goleiro: naFila.goleiro.slice() } : null };
      },
      ajustar(e) {
        const m = ctx.mundo();
        if (!m?.livre) return null;
        definir(trocar(logica.normalizarEscolha(e, h, logica.escolhaDoMundo(m))));
        return { linha: naFila.linha.slice(), goleiro: naFila.goleiro.slice() };
      },
      recomecar(onde = 'meio') {
        if (!ctx.mundo()?.livre) return null;
        ctx.acao({ tipo: 'livreRecomecar', onde: onde === 'pe' ? 'pe' : 'meio' });
        return true;
      },
      get naFila() { return naFila ? { ...naFila } : null; },
      /** As câmeras do Livre (os nomes de definirCamera). */
      cameras: CAMERAS_LIVRE.slice(),
      /** Os cantos do lado de cá (render/cantos-livre.js): à vista (true), escondidos (false) ou ainda não na cena (null). */
      get cantos() { return cantos ? cantos.mesh.visible : null; },
      /** A câmera do Livre agora: {modo, anterior, transicao, yaw, dir, fa, fd, altura, distancia}. */
      get camera() { return { ...camLivre.resumo(), altura: ajuste.altura, distancia: ajuste.distancia }; },
      /** Altura e Distância (0–20) como na pausa; devolve o ajuste. */
      ajustarCamera(a = {}) {
        for (const k of ['altura', 'distancia']) if (a[k] != null) ajuste[k] = lerAjuste(a[k]);
        camLivre.definirAjuste(ajuste);
        prefs[CHAVE_AJUSTE] = { ...ajuste }; salvar();
        marcarCamera();
        return { altura: ajuste.altura, distancia: ajuste.distancia, fa: fatorAjuste(ajuste.altura), fd: fatorAjuste(ajuste.distancia) };
      },
    },
  };
}
