// Modo Livre — a parte da PÁGINA (DOM): a escolha de quantos jogadores (salva em localStorage golaco.livre.v1), o submenu
// Jogadores e os recomeços na pausa, a fila da mudança (entra no 1º passo depois da pausa, como a edição do time) e a API
// dos testes (__golaco.livre). Carregado por import dinâmico junto com livre.js (main.js carregarLivre): sem o Livre nada
// disto entra no download (teste-carga). A lógica (pura) é a do livre.js; contrato "Modo Livre" no CONTRATOS.md.
//
// A pausa do Livre é o MÍNIMO funcional: o HTML (os botões data-so="livre" e o #menu-livre) e o CSS são postos aqui na 1ª
// vez. (O acabamento da pausa e a Câmera do Livre — Ampla, Alta, Atrás, Jogador, Altura e Distância — entram depois: a
// linha "Jogadores" vira "Jogadores | Câmera" numa .linha-cenas; ver também main.js, comentário "Câmera do Livre".)
//
// A escolha fica na visão do HUMANO ([meu time, adversário]); o mundo usa os índices dos TIMES (escolhaParaTimes troca os
// dois quando o humano é o time 1, o visitante do Total Match).

import { aoTocar } from './toque-botao.js';
import { LIVRE } from './config.js';

const CHAVE = 'golaco.livre.v1';
const SETA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CSS = `
.livre-time { display: flex; align-items: center; gap: 6px; min-height: 48px; }
.livre-rotulo { flex: 1 1 auto; min-width: 0; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.livre-time .btn { flex: none; justify-content: center; padding: 0 10px; }
.livre-passo { width: 44px; font-size: 20px; }
.livre-n { flex: none; width: 2.2em; text-align: center; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.livre-gol[aria-pressed="false"] { opacity: 0.55; }
#menu-livre .btn:disabled { opacity: 0.4; cursor: default; }`;

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
    const acoes = $('menu-acoes'), editar = acoes?.querySelector('[data-cmd="editar-time"]');
    if (acoes) {
      const t = doc.createElement('template');
      t.innerHTML = `<button class="btn" type="button" data-cmd="livre-jogadores" data-so="livre" id="btn-livre-jogadores">Jogadores <small id="estado-livre"></small></button>
<div class="linha-cenas" role="group" aria-label="Recomeçar" data-so="livre">
<button class="btn" type="button" data-cmd="livre-recomecar" data-valor="meio" id="btn-livre-meio">Recomeçar <small>bola no meio</small></button>
<button class="btn" type="button" data-cmd="livre-recomecar" data-valor="pe" id="btn-livre-pe">Bola no meu pé <small>onde estou</small></button>
</div>`;
      acoes.insertBefore(t.content, editar ? editar.nextSibling : acoes.firstChild);
    }
    const modos = $('menu-modos');
    if (modos) {
      const lado = (id, nome) => `<div class="livre-time" role="group" aria-label="${nome}"><span class="livre-rotulo">${nome}</span>
<button class="btn livre-passo" type="button" data-cmd="livre-menos" data-valor="${id}" aria-label="Um a menos: ${nome}">−</button>
<output class="livre-n" id="livre-n-${id}" aria-live="polite"></output>
<button class="btn livre-passo" type="button" data-cmd="livre-mais" data-valor="${id}" aria-label="Um a mais: ${nome}">+</button>
<button class="btn livre-gol" type="button" data-cmd="livre-goleiro" data-valor="${id}" aria-pressed="true" aria-label="Goleiro: ${nome}">Goleiro</button></div>`;
      const t = doc.createElement('template');
      // o submenu Jogadores (abre no lugar da lista de ações, como o "Modo de jogo"): o TOTAL de cada lado (de linha +
      // goleiro), −/+ um de linha e o goleiro liga/desliga; vale ao sair da pausa (Jogar ou Continuar), sem recomeçar
      t.innerHTML = `<div class="menu-acoes" id="menu-livre" hidden>
<button class="btn btn-voltar" type="button" data-cmd="livre-voltar">${SETA}Voltar</button>
${lado('meu', 'Meu time')}
${lado('adv', 'Adversário')}
<button class="btn btn-primario" type="button" data-cmd="livre-jogar" id="btn-livre-jogar">Jogar</button></div>`;
      modos.after(t.content);
    }
    for (const b of doc.querySelectorAll('#menu [data-cmd^="livre-"]')) aoTocar(b, () => ctx.comando(b.dataset.cmd, b.dataset.valor));
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
      if (menos) menos.disabled = L.linha[k] <= (k === 0 ? 1 : 0);
      if (mais) mais.disabled = L.linha[k] >= LIVRE.linhaMax;
    });
    for (const id of ['estado-livre', 'estado-modo-livre']) { const e = $(id); if (e) e.textContent = textoEscolha(L); }
  }

  /** Submenu Jogadores no lugar das ações (true) ou de volta (false). */
  function submenu(v) {
    const acoes = $('menu-acoes'), lv = $('menu-livre');
    if (!acoes || !lv) return;
    acoes.hidden = v; lv.hidden = !v;
    const modos = $('menu-modos'); if (modos) modos.hidden = true;
    (v ? $('btn-livre-jogar') : $('btn-livre-jogadores'))?.focus({ preventScroll: true });
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
      case 'livre-jogadores': if (m?.livre) { marcar(); submenu(true); } return true;
      case 'livre-voltar': submenu(false); return true;
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
      submenu(true);
    },
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
    },
  };
}
