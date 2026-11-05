// GOLAÇO — a TELA ANTES DO JOGO (item 64; dono, 23/10: "quero que fique NESSE NÍVEL; só altere para o Total Match com cores e
// etc, mas é do mesmo nível" — a pré-partida da carreira do EA FC 24; contrato "Tela antes do jogo (item 64)" no CONTRATOS.md):
// a parte DOM. De cima para baixo: a competição e o ≡ | a barra com o controle de quem joga, as camisas, os escudos e o horário |
// a linha estádio · data · árbitro · duração · período | o campinho GRANDE em perspectiva com as fichas (moldura chanfrada na
// cor da raridade, o busto vestido na cor da camisa, a nota e o nome) na formação, o selo da tática e o geral nos cantos de
// baixo | as abas (Jogar partida · Visão tática · Personalizar; por modo) | a linha dos comandos (PC). As contas são de
// js/prepartida.js (puro); os dados vêm do main.js (dadosPrepartida: a tela nunca lê o mundo). Sob demanda (main.js, só com a
// tela ligada) com o css/prepartida.css e a TM Cond.
//
// Diálogo modal (role=dialog, aria-modal, o resto inert pelo main.js): o Tab preso (a barra de abas é UMA parada, foco
// itinerante — APG Toolbar; depois os dois times, o ≡ e o canto [<]); ←/→ nas abas e na barra de cima, ↑/↓ entre as duas (e
// nos discos da Visão tática); Enter/Espaço agem; Esc volta um nível; Q/E o time mostrado; P o ≡. O controle chega pelas ações
// menu-* (entrada.js lerMenuPad) e o resto aqui no atualizar(): Y Personalizar, X/R3 a vista, LB/RB o time, Start o ≡ ('pausa').
import { layoutPrepartida, linhasCampinho, layoutVisao, pontosVisao, linhaInfo, textoTatica, textoClassico, PREPARTIDA, SEP_INFO } from './prepartida.js';
import { aoTocar, engolirClique } from './toque-botao.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = v => Math.round(v * 10) / 10;
const txtClassico = textoClassico;

// ícones (SVG de linha; nada de emoji)
const IC = {
  marca: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.2l3.7 2.7-1.4 4.3H9.7L8.3 9.9z" fill="currentColor"/></svg>',
  jogar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8.2v7.6l6-3.8z" fill="currentColor"/></svg>',
  tatica: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4v16M6.5 9l3 3M9.5 9l-3 3M14.5 15l3-3m0 0h-2.5m2.5 0v2.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  editar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3c-.6 1.4-2 2.2-3 2.2S8.6 4.4 8 3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  simular: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5v11l7.5-5.5zM12.5 6.5v11l7.5-5.5z" fill="currentColor"/></svg>',
  jogadores: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="16.5" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M3 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14 14.6c.8-.4 1.6-.6 2.5-.6 2.3 0 4 1.5 4.5 4.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="13" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 11l5-3v8l-5-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  pronto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lista: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ctl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10a5 5 0 0 1 4.6 7l-1.3 3.1a2 2 0 0 1-3.3.6L15 16H9l-2 1.7a2 2 0 0 1-3.3-.6L2.4 14A5 5 0 0 1 7 7z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 10v3M5.5 11.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16.5" cy="11" r="1.1" fill="currentColor"/><circle cx="18" cy="13" r="1.1" fill="currentColor"/></svg>',
};
// o ícone de cada selo da tática
const IC_SELO = {
  pressaoAlta: '<path d="M3 12h6m12 0h-6M6 9l3 3-3 3M18 9l-3 3 3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  retranca: '<path d="M12 3 5 6v5c0 4.4 3 8 7 10 4-2 7-5.6 7-10V6z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>',
  contra: '<path d="M5 19 19 5M10 5h9v9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  pontas: '<path d="M9 12H3m18 0h-6M6 9l-3 3 3 3M18 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  ofensiva: '<path d="M12 20V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  dentro: '<path d="M12 4v16M8 8l4 4-4 4M16 8l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  equilibrada: '<path d="M4 9h16M4 15h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
};
const icSelo = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC_SELO[id] ?? IC_SELO.equilibrada}</svg>`;

/** A luminância relativa (WCAG) de "#rrggbb" (inválida: 1, a clara). */
function luminancia(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!m) return 1;
  const v = parseInt(m[1], 16);
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(v >> 16) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
}
/** A camisa escura (o Golaço FC, #15191b; azul-marinho, preto) some no fundo preto da tela e da carta: < 2,2:1 contra ele. */
const escura = hex => luminancia(hex) < 0.07;
/** "#rrggbb" misturado com o cinza claro (t de 0 a 1): o ombro da camisa escura aparece sem mudar de cor. */
function clarear(hex, t) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!m) return hex;
  const v = parseInt(m[1], 16), c = [v >> 16, (v >> 8) & 255, v & 255].map(x => Math.round(x + (0xc9 - x) * t));
  return `#${c.map(x => x.toString(16).padStart(2, '0')).join('')}`;
}
/** A camisa (SVG 24×24): o corpo na cor da camisa, a gola e os punhos no acento, o contorno branco a 55%; a escura com um disco
 * claro atrás (sem ele sobrava só o contorno: revisão V12). */
function svgCamisa(c) {
  const corpo = c?.corpo ?? '#e9ecee', ac = c?.acento ?? '#15191b';
  return `<svg class="pp-cam" viewBox="0 0 24 24" aria-hidden="true">${escura(corpo) ? '<circle cx="12" cy="12" r="11.5" fill="rgba(255,255,255,.14)"/>' : ''}<path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3c-.6 1.4-2 2.2-3 2.2S8.6 4.4 8 3z" fill="${esc(corpo)}" stroke="rgba(255,255,255,.55)" stroke-width=".9" stroke-linejoin="round"/>`
    + `<path d="M9.4 3.6c.8 1.1 1.7 1.6 2.6 1.6s1.8-.5 2.6-1.6" fill="none" stroke="${esc(ac)}" stroke-width="1.3" stroke-linecap="round"/>`
    + `<path d="M3.5 7.3l1.7 3.4M20.5 7.3l-1.7 3.4" stroke="${esc(ac)}" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}
/** O escudo: o <symbol> do sprite (sem ?tm) ou a imagem do TM; reserva = a sigla. */
function htmlEscudo(e, sigla) {
  if (e?.url) return `<img class="pp-esc" alt="" decoding="async" src="${esc(e.url)}">`;
  if (e?.simbolo) return `<svg class="pp-esc" viewBox="0 0 20 22" aria-hidden="true"><use href="#${esc(e.simbolo)}"/></svg>`;
  return `<span class="pp-esc pp-esc-sigla" aria-hidden="true">${esc(sigla)}</span>`;
}
/** O busto da ficha (a silhueta da carta do TM, ultimate.js silhueta) com os ombros vestidos na cor da camisa; a camisa escura
 * clareia 32% e ganha um contorno mais forte (sumia no miolo preto e sobrava uma cabeça solta: revisão V12). */
function svgBusto(c) {
  const corpo0 = c?.corpo ?? '#2a2f33', ac = c?.acento ?? '#4ade80';
  const esc0 = escura(corpo0), corpo = esc0 ? clarear(corpo0, 0.32) : corpo0;
  return `<svg class="pp-busto" viewBox="0 0 100 120" aria-hidden="true"><ellipse cx="50" cy="43" rx="18.5" ry="22.5" fill="currentColor"/>`
    + `<path d="M6 120C8 93 27 81 50 81S92 93 94 120Z" fill="${esc(corpo)}" stroke="rgba(255,255,255,${esc0 ? '.6' : '.4'})" stroke-width="${esc0 ? 4 : 2}"/>`
    + `<path d="M40 82l10 13 10-13" fill="none" stroke="${esc(ac)}" stroke-width="5" stroke-linejoin="round"/></svg>`;
}

/**
 * Cria a tela (escondida). opc = {aoAcao(id, v) — as ações que são da página ('jogar', 'personalizar', 'opcoes', 'simular',
 * 'canto', 'jogadores', 'camera', 'pronto'); ocupado() — a pausa, a Ajuda ou o editor estão por cima (a tela não age);
 * comToque(); meio() — o último meio ('teclado' | 'pad' | 'toque')}.
 */
export function criarPrepartida(opc) {
  const raiz = document.createElement('div');
  raiz.id = 'prepartida';
  raiz.className = 'pp';
  raiz.hidden = true;
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-labelledby', 'pp-titulo');
  document.body.appendChild(raiz);
  const sonda = document.createElement('i');
  sonda.setAttribute('aria-hidden', 'true');
  sonda.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:var(--sa-t,0px) var(--sa-r,0px) var(--sa-b,0px) var(--sa-l,0px)';
  document.body.appendChild(sonda);
  const st = {
    aberta: false, modo: 'partida', fundo: 'jogo', dados: null, abas: [], canto: null, meu: 0, time: 0, visao: 'escalacao',
    foco: 0, linhaFoco: 'abas', armado: null, armadoAte: 0, discoFoco: -1, L: null, V: null, aguardando: null, padAntes: [],
    saindo: null, nomeMostrado: null, ultimaChave: '', destaqueCanto: false,
  };
  const medidor = document.createElement('canvas').getContext('2d');
  const medir = (t, px, peso = 600) => { medidor.font = `${peso} ${px}px "Inter TM", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`; return medidor.measureText(t).width; };
  // ---- o texto das abas (revisões A4/V3/V15): o ícone é decidido para a BARRA inteira pelo rótulo mais longo que cada aba pode
  // mostrar (a vista "Sem a bola ⇄" saía cortada com 4 abas em 568: o ícone era decidido só pelo "Visão tática"); a vista encurta se
  // nem sem o ícone couber; o glifo do controle (Ⓐ/Ⓨ no celular) sai da aba onde não cabe
  const VISTAS = { sem: ['Sem a bola ⇄', 'Sem a bola', 'Sem bola'], com: ['Com a bola ⇄', 'Com a bola', 'Com bola'] };
  /** O espaço (px) para o texto numa aba: a aba menos o padding (0,6 em × 2) e a borda; com o ícone, ele (1,3 em) e o vão (0,5 em);
   * com o glifo, ele (1,35 × 0,7 em) e o vão. */
  function espacoTexto(icone, glifo) {
    const A = st.L.abas;
    return A.larguraAba - 1.2 * A.letra - 2 - (icone ? 1.8 * A.letra : 0) - (glifo ? 1.45 * A.letra : 0) - 1;
  }
  const cabeAba = (t, icone, glifo = false) => medir(t, st.L.abas.letra, 800) <= espacoTexto(icone, glifo);
  /** O 1º rótulo da lista que cabe (nenhum: o último, com o "…" do CSS). */
  const rotuloQueCabe = (lista, icone) => lista.find(t => cabeAba(t, icone)) ?? lista[lista.length - 1];

  // ------------------------------------------------------------------------------------------------ montagem
  function montar() {
    const d = st.dados, L = st.L, T = d.times;
    const mostrado = T[st.time];
    const nAbas = st.abas.length;
    const pc = L.pc;
    raiz.dataset.regime = L.regime;
    raiz.dataset.visao = st.visao;
    raiz.dataset.modo = st.modo;
    let h = '<div class="pp-veu" aria-hidden="true"></div>';
    h += `<h1 id="pp-titulo" class="pp-sr">Antes do jogo: ${esc(T[0].nome)} × ${esc(T[1].nome)}, ${esc(d.hora)}</h1>`;
    // a competição (o chip do clássico no PC; no celular entra no começo da info)
    const comp = d.competicao + (pc && d.classico ? '' : '');
    h += `<div class="pp-comp" style="left:${r1(L.comp.x)}px;top:${r1(L.comp.y)}px;height:${r1(L.comp.h)}px;font-size:${r1(L.comp.letra)}px${L.comp.centro ? ';right:0;justify-content:center' : ''}">${IC.marca}<span class="pp-comp-txt">${esc(comp)}</span>${pc && d.classico ? `<span class="pp-classico">${esc(txtClassico(d.classico))}</span>` : ''}</div>`;
    // o ≡ e o canto [<]
    h += `<button type="button" class="pp-menu pp-btn" data-pp="menu" aria-label="Opções" style="left:${r1(L.menu.x)}px;top:${r1(L.menu.y)}px;width:${L.menu.lado}px;height:${L.menu.lado}px">${IC.menu}</button>`;
    if (st.canto && L.canto) h += `<button type="button" class="pp-canto pp-btn" data-pp="canto" aria-label="${esc(st.canto.texto)}" style="left:${r1(L.canto.x)}px;top:${r1(L.canto.y)}px;width:${L.canto.lado}px;height:${L.canto.lado}px">${IC.voltar}</button>`;
    // a barra: [CTL][CAM]|[ESC] HORA [ESC]|[CAM][CTL] — cada [ESC][CAM] é um botão que mostra aquele time no campinho
    const B = L.barra;
    const pessoa = t => (T[t].pessoa ? `, ${T[t].pessoa}` : '');
    const rotuloBarra = `${T[0].nome} contra ${T[1].nome}, ${d.hora}; ${T.filter(x => x.humano).map(x => `controla o ${x.nome}${x.pessoa ? ` (${x.pessoa})` : ''}`).join('; ')}`;
    const lado = t => {
      const nome = pc ? `<span class="pp-tnome"><b>${esc(T[t].nome)}</b><i>${t === 0 ? icSelo(T[t].selo.id) : ''}${esc(T[t].selo.nome)}${t === 1 ? icSelo(T[t].selo.id) : ''}</i></span>` : '';
      const partes = [svgCamisa(T[t].camisa), '<i class="pp-sep" aria-hidden="true"></i>', htmlEscudo(T[t].escudo, T[t].sigla), nome];
      if (t === 1) partes.reverse();
      return `<button type="button" class="pp-time pp-btn${st.time === t ? ' ativo' : ''}" data-pp="time" data-t="${t}" aria-pressed="${st.time === t}" aria-label="Mostrar ${esc(T[t].nome)}${pessoa(t)}" style="height:${r1(L.botaoTime.h)}px">${partes.join('')}</button>`;
    };
    const ctl = t => `<span class="pp-ctl${T[t].humano ? '' : ' vazio'}" aria-hidden="true" style="width:${r1(B.ctl)}px;height:${r1(B.ctl)}px">${IC.ctl}</span>`;
    h += `<div class="pp-barra" role="group" aria-label="${esc(rotuloBarra)}" style="--g:${B.g}px;--esc:${r1(B.escudo)}px;--cam:${r1(B.camisa)}px;top:${r1(B.y)}px;height:${r1(B.h)}px;left:${r1(L.campo.cx)}px${pc ? `;--nome:${r1(B.letraNome)}px` : ''}">`
      + `${ctl(0)}${lado(0)}<span class="pp-hora" style="font-size:${r1(B.hora)}px">${esc(d.hora)}</span>${lado(1)}${ctl(1)}</div>`;
    // a info (a Visão tática troca pelas 4 escolhas da tática)
    h += `<div class="pp-info" id="pp-info" style="left:${r1(L.info.x)}px;width:${r1(L.info.w)}px;top:${r1(L.info.y)}px;font-size:${r1(L.info.letra)}px${L.info.linhas ? '' : ';display:none'}"></div>`;
    // o campinho
    const C = L.campo, F = L.ficha;
    h += `<div class="pp-campo" data-pp="campo" style="--hc:${L.hc}px;--rosto:${F.rosto}px;--mold:${Math.round(F.rosto * 0.9)}px;--nota:${F.nota}px;--nome:${F.nome}px;--linha:${F.linha}px;--filete:${F.filete}px;--ficha:${F.largura}px;--chanfro:${F.chanfro}px">`;
    h += `<svg class="pp-linhas" aria-hidden="true" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}"></svg>`;
    h += '<div class="pp-fichas" aria-hidden="true"></div>';
    h += `<div class="pp-canto-esq" style="left:${r1(L.cantos.esq.x)}px;top:${r1(L.cantos.y)}px"></div>`;
    h += `<div class="pp-canto-dir" style="right:${r1(L.W - L.cantos.dir.x)}px;top:${r1(L.cantos.y)}px"></div>`;
    h += '<ul class="pp-sr pp-lista"></ul></div>';
    // as abas (UMA parada no Tab: a barra de ferramentas com o foco itinerante)
    const A = L.abas;
    h += `<div class="pp-abas" role="toolbar" aria-label="Ações da partida" style="left:${r1(A.x)}px;top:${r1(A.y)}px;width:${r1(A.w)}px;height:${r1(A.h)}px;gap:${A.vao}px">`;
    st.comIcone = st.abas.every(a => [a.texto, ...(a.id === 'visao' ? [VISTAS.sem[0], VISTAS.com[0]] : [])].every(t => cabeAba(t, true)));
    st.abas.forEach((a, i) => {
      h += `<button type="button" class="pp-aba pp-btn${a.primaria ? ' primaria' : ''}${st.comIcone ? '' : ' sem-icone'}" data-pp="aba" data-aba="${esc(a.id)}" data-i="${i}" tabindex="-1" style="font-size:${r1(A.letra)}px"`
        + `${a.id === 'visao' || a.id === 'adversario' ? ' aria-pressed="false"' : ''}>${IC[a.icone] ?? ''}<span class="pp-aba-txt">${esc(a.texto)}</span>`
        + `<i class="pp-glifo pp-g-a" aria-hidden="true">A</i>${a.id === 'personalizar' ? '<i class="pp-glifo pp-g-y" aria-hidden="true">Y</i>' : ''}</button>`;
    });
    h += '</div>';
    // a linha dos comandos (só no PC, pelo último meio)
    if (L.cmd) {
      const temP = st.abas.some(a => a.id === 'personalizar');
      h += `<div class="pp-cmd" aria-hidden="true" style="left:${r1(L.cmd.x)}px;top:${r1(L.cmd.y)}px;font-size:${r1(L.cmd.letra)}px">`
        + '<span class="pc-pad"><b>A</b>Selecionar</span><span class="pc-pad"><b>B</b>Voltar</span>' + (temP ? '<span class="pc-pad"><b>Y</b>Personalizar</span>' : '')
        + '<span class="pc-pad"><b>X</b>Vista</span><span class="pc-pad"><b>LB RB</b>Adversário</span><span class="pc-pad"><b>≡</b>Opções</span>'
        + '<span class="pc-tec"><kbd>Enter</kbd>Selecionar</span><span class="pc-tec"><kbd>Esc</kbd>Voltar</span><span class="pc-tec"><kbd>Q</kbd><kbd>E</kbd>Adversário</span><span class="pc-tec"><kbd>P</kbd>Opções</span></div>';
    }
    h += '<div class="pp-sr" aria-live="polite" id="pp-vivo"></div>';
    h += '<div class="pp-aviso" id="pp-aviso" hidden></div>';
    raiz.innerHTML = h;
    // a competição nunca encosta na barra (no celular: a largura até a borda da barra)
    if (!pc) {
      const b = raiz.querySelector('.pp-barra').getBoundingClientRect();
      const c = raiz.querySelector('.pp-comp');
      c.style.maxWidth = `${Math.max(0, b.left - L.comp.x - 8)}px`;
    }
    ajustarComp();
    ligar();
    desenharCampo();
    escreverInfo();
    marcarAbas();
    marcarMeio();
    st.ultimaChave = chave();
    void mostrado;
  }
  const chave = () => `${st.L.W}x${st.L.H}|${st.time}|${st.visao}`;
  /**
   * A competição no celular sem o "…" (revisão V11: "BRASILEIRÃO S…" em 568×320): não cabendo, as letras apertam (0,02 em), o ícone
   * sai e, por fim, o nome quebra em 2 linhas (a altura da barra comporta); só com as 2 linhas cheias sobra o "…".
   */
  function ajustarComp() {
    const c = raiz.querySelector('.pp-comp'), t = c?.querySelector('.pp-comp-txt');
    if (!t) return;
    c.classList.remove('aperta', 'sem-icone', 'duas');
    if (st.L.pc) return;
    const corta = () => t.scrollWidth > t.clientWidth + 0.5 || t.scrollHeight > t.clientHeight + 0.5;
    for (const k of ['aperta', 'sem-icone', 'duas']) { if (!corta()) break; c.classList.add(k); }
  }

  /** A info (1 linha no celular, 2 no PC) com o corte por prioridade; na Visão tática, as 4 escolhas da tática. */
  function escreverInfo() {
    const el = raiz.querySelector('#pp-info');
    if (!el) return;
    const d = st.dados, L = st.L;
    const sep = '<span class="pp-s" aria-hidden="true">|</span>';
    if (st.visao !== 'escalacao') {
      const T = d.times[st.time];
      const partes = [st.visao === 'sem' ? 'Sem a bola' : 'Com a bola', ...textoTatica(T.tatica)];
      el.innerHTML = `<span class="pp-info-l"><b>${esc(partes[0])}</b>${partes.slice(1).map(p => sep + esc(p)).join('')}</span>`;
      el.setAttribute('aria-label', partes.join(', '));
      return;
    }
    const pc = L.pc;
    const campos = {
      estadio: (!pc && d.classico ? `${txtClassico(d.classico)} · ` : '') + d.estadio,
      data: d.data ? (pc ? d.data.longa : d.data.curta) : null, arbitro: d.arbitro,
      duracao: pc ? d.duracao.longa : d.duracao.curta, periodo: d.periodo, dificuldade: d.dificuldade,
    };
    const fonte = t => medir(t, L.info.letra, 600);
    // o separador como ele é DESENHADO: a barra com a margem de 0,45 em de cada lado (.pp-s) — revisão A3
    const sepW = fonte('|') + 0.9 * L.info.letra;
    // a conta e depois a conferência no DOM (a letra de verdade): passou da linha, a conta corta de novo com o que sobrou a menos
    let w = L.info.w, r = null;
    for (let k = 0; k < 4; k++) {
      r = linhaInfo(campos, w, fonte, pc ? 2 : 1, sepW);
      el.innerHTML = r.linhas.map(l => `<span class="pp-info-l">${l.map(esc).join(sep)}</span>`).join('');
      let excesso = 0;
      for (const l of el.querySelectorAll('.pp-info-l')) excesso = Math.max(excesso, l.scrollWidth - l.clientWidth);
      if (excesso <= 0.5) break;
      w -= Math.ceil(excesso) + 1;
    }
    el.removeAttribute('aria-label');
    el.dataset.cortes = r.cortes.join(' ');
  }

  /** O campinho: as linhas, as fichas (ou os discos da Visão tática, ou a fila da disputa), os cantos e a lista do leitor de tela. */
  function desenharCampo() {
    const L = st.L, d = st.dados, T = d.times[st.time];
    const campo = raiz.querySelector('.pp-campo');
    const fichasEl = raiz.querySelector('.pp-fichas');
    const svg = raiz.querySelector('.pp-linhas');
    let janela = null;
    st.V = null;
    if (st.visao !== 'escalacao' && !d.disputa) {
      const vagas = T.fichas.map(f => ({ id: f.vaga }));
      const forma = T.formacao;
      // (o Livre: só quem está em campo)
      const pts = pontosVisao(forma, T.tatica, st.visao, null).filter(p => vagas.some(v => v.id === p.vaga));
      st.V = layoutVisao(L, pts);
      janela = st.V.janela;
    }
    const ln = linhasCampinho(L, janela);
    const pts = a => a.map(p => `${r1(p[0])},${r1(p[1])}`).join(' ');
    let s = `<polygon class="pp-gramado" points="${pts(ln.contorno)}"/>`;
    for (const l of ln.linhas) s += `<line x1="${r1(l[0])}" y1="${r1(l[1])}" x2="${r1(l[2])}" y2="${r1(l[3])}"/>`;
    for (const [p, fechado] of ln.polis) s += fechado ? `<polygon points="${pts(p)}"/>` : `<polyline points="${pts(p)}"/>`;
    svg.innerHTML = s;
    let h = '';
    const ce = raiz.querySelector('.pp-canto-esq'), cd = raiz.querySelector('.pp-canto-dir');
    if (st.V) {
      // a Visão tática: discos na cor do uniforme com o número; o nome só do disco com o foco (ou tocado)
      const V = st.V;
      T.fichas.forEach((f, i) => {
        const q = V.discos.find(x => x.vaga === f.vaga);
        if (!q) return;
        const cam = f.gol ? T.camisaGol : T.camisa;
        // (o disco recebe o foco do teclado e do controle: papel e nome para o leitor de tela — revisão A6)
        h += `<div class="pp-disco${f.gol ? ' gol' : ''}${st.discoFoco === i ? ' com-nome' : ''}" role="button" tabindex="-1" aria-label="${esc(`${f.num} ${f.nome}, ${f.pos}`)}" data-vaga="${esc(f.vaga)}" data-i="${i}" style="left:${r1(q.x)}px;top:${r1(q.y)}px;--d:${V.d}px;--dl:${V.letra}px;--cor:${esc(cam?.corpo ?? '#22c55e')};--cor-txt:${esc(cam?.texto ?? '#050807')}">`
          + `<b>${esc(f.num)}</b><span class="pp-etq">${esc(f.nome)}</span></div>`;
      });
      ce.innerHTML = ''; cd.innerHTML = '';
    } else if (d.disputa) {
      // os Pênaltis: a fila — o goleiro e os 5 cobradores numerados (no lugar da formação)
      const fila = d.disputa.fila[st.time];
      const porId = new Map(T.fichas.map(f => [f.id, f]));
      const itens = [];
      const gk = porId.get(fila.goleiro);
      if (gk) itens.push({ f: gk, fila: 0, col: 0, ordem: null });
      fila.cobradores.forEach((id, k) => { const f = porId.get(id); if (f) itens.push({ f, fila: 3, col: k - 2, ordem: k + 1 }); });
      const Lp = layoutDisputa(itens);
      itens.forEach((it, i) => { h += htmlFicha(it.f, Lp.fichas[i], T, i, it.ordem); });
      ce.innerHTML = `<div class="pp-forma pp-forma-txt">Cobranças</div><div class="pp-selo">${esc(st.time === d.disputa.comeca ? 'Começa batendo' : 'Bate depois')}</div>`;
      cd.innerHTML = '';
    } else {
      const porVaga = new Map(L.fichas.map(f => [f.vaga, f]));
      T.fichas.forEach((f, i) => { const p = porVaga.get(f.vaga); if (p) h += htmlFicha(f, p, T, i, null); });
      ce.innerHTML = `<div class="pp-forma${T.texto ? ' pp-forma-txt' : ''}">${esc(T.texto ?? T.formacao)}</div>`
        + (T.texto ? '' : `<div class="pp-selo">${icSelo(T.selo.id)}<span>${esc(T.selo.nome)}</span></div>`);
      cd.innerHTML = T.texto ? '' : `<div class="pp-geral">GERAL ${T.geral}</div><div class="pp-est" aria-hidden="true">${estrelasTxt(T.estrelas)}</div>`;
    }
    fichasEl.innerHTML = h;
    // as fichas são só desenho (a lista .pp-lista diz o mesmo ao leitor de tela); os discos da Visão tática recebem o foco: fora do
    // aria-hidden, num grupo com o nome da vista (revisão A6: o foco caía dentro de um bloco aria-hidden)
    if (st.V) {
      fichasEl.removeAttribute('aria-hidden');
      fichasEl.setAttribute('role', 'group');
      fichasEl.setAttribute('aria-label', `${st.visao === 'sem' ? 'Sem a bola' : 'Com a bola'}: ${T.nome}`);
    } else {
      fichasEl.setAttribute('aria-hidden', 'true');
      fichasEl.removeAttribute('role'); fichasEl.removeAttribute('aria-label');
    }
    campo.style.setProperty('--fs-forma', `${L.cantos.forma}px`);
    campo.style.setProperty('--fs-selo', `${L.cantos.selo}px`);
    campo.classList.toggle('editavel', st.visao === 'escalacao' && st.abas.some(a => a.id === 'personalizar'));
    // a lista do leitor de tela
    const ul = raiz.querySelector('.pp-lista');
    const grupos = [['Goleiro', f => f.fila === 0], ['Defesa', f => f.fila === 1], ['Meio-campo', f => f.fila >= 2 && f.fila < 4], ['Ataque', f => f.fila >= 4]];
    let li = `<li>${esc(T.nome)}: ${esc(T.texto ?? T.formacao)}${T.texto ? '' : `, ${esc(T.selo.nome)}, geral ${T.geral}`}.</li>`;
    if (d.disputa) {
      const fila = d.disputa.fila[st.time], porId = new Map(T.fichas.map(f => [f.id, f]));
      li += `<li>Goleiro: ${esc(porId.get(fila.goleiro)?.nome ?? '')}.</li>`;
      li += `<li>Cobradores: ${fila.cobradores.map((id, k) => `${k + 1}º ${esc(porId.get(id)?.nome ?? '')}`).join(', ')}.</li>`;
    } else {
      for (const [nome, pred] of grupos) {
        const fs = T.fichas.filter(pred);
        if (fs.length) li += `<li>${nome}: ${fs.map(f => `${esc(f.num)} ${esc(f.nome)}, nota ${f.nota}${f.voce ? ', você' : ''}`).join('; ')}.</li>`;
      }
    }
    ul.innerHTML = li;
    ul.setAttribute('aria-label', `Escalação do ${T.nome}`);
  }
  function estrelasTxt(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += n >= i ? '★' : n >= i - 0.5 ? '<span class="meia">★</span>' : '<span class="vazia">★</span>';
    return s;
  }
  /** O layout da fila da disputa (o goleiro na fila 0 e os cobradores na 3: as mesmas contas das fichas). */
  function layoutDisputa(itens) {
    const L = st.L;
    const vagas = itens.map((it, i) => ({ id: `F${i}`, fila: it.fila, col: it.col }));
    return layoutPrepartida(L.W, L.H, L.sa, '4-3-3', st.abas.length, { vagas, canto: !!st.canto });
  }
  function htmlFicha(f, p, T, i, ordem) {
    const cam = f.gol ? T.camisaGol : T.camisa;
    return `<div class="pp-ficha r-${f.raridade}${f.voce ? ' voce' : ''}" data-vaga="${esc(f.vaga)}" data-id="${f.id}" style="left:${r1(p.x)}px;top:${r1(p.y)}px;--i:${i}">`
      + `<div class="pp-cab">${st.L.ficha.semRosto ? '' : `<div class="pp-mold"><div class="pp-miolo">${svgBusto(cam)}</div>${ordem ? `<i class="pp-ordem">${ordem}º</i>` : ''}</div>`}`
      + `<b class="pp-nota">${f.nota}</b></div>`
      + `<i class="pp-filete">${f.voce ? '<span>VOCÊ</span>' : ''}</i><span class="pp-nome">${esc(f.nome)}</span></div>`;
  }

  // ------------------------------------------------------------------------------------------------ foco e navegação
  const abasEl = () => [...raiz.querySelectorAll('.pp-aba')];
  const barraEl = () => [...raiz.querySelectorAll('[data-pp="canto"], .pp-time, [data-pp="menu"]')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const discosEl = () => [...raiz.querySelectorAll('.pp-disco')];
  function marcarAbas() {
    abasEl().forEach((b, i) => {
      const a = st.abas[i];
      b.tabIndex = i === st.foco ? 0 : -1;
      b.classList.toggle('foco', i === st.foco);
      if (a.id === 'visao') {
        b.setAttribute('aria-pressed', String(st.visao !== 'escalacao'));
        const t = st.visao === 'escalacao' ? a.texto : rotuloQueCabe(VISTAS[st.visao], st.comIcone);
        b.querySelector('.pp-aba-txt').textContent = t;
        if (st.visao === 'escalacao') b.removeAttribute('aria-label'); else b.setAttribute('aria-label', `${a.texto}: ${st.visao === 'sem' ? 'sem a bola' : 'com a bola'}`);
      }
      if (a.id === 'adversario') b.setAttribute('aria-pressed', String(st.time !== st.meu));
      if (a.armar) {
        const armado = st.armado === a.id && performance.now() < st.armadoAte;
        b.classList.toggle('armado', armado);
        // (armada: o 1º rótulo que cabe — o leitor de tela lê o inteiro)
        b.querySelector('.pp-aba-txt').textContent = armado ? rotuloQueCabe([a.armar, ...(a.armarCurto ?? [])], st.comIcone) : a.texto;
        b.setAttribute('aria-label', armado ? a.armar : a.texto);
      }
      // (o Pronto esperando: aria-disabled, não disabled — o foco fica nele e o leitor de tela lê "Aguardando {nome}…")
      if (st.aguardando && a.id === 'pronto') {
        b.setAttribute('aria-disabled', 'true'); b.classList.add('aguardando');
        b.querySelector('.pp-aba-txt').textContent = `Aguardando ${st.aguardando}…`;
      }
      // o glifo do controle (o celular com o controle: o Ⓐ na aba do foco, o Ⓨ no Personalizar) sai onde o texto não caberia com ele
      const glifo = raiz.dataset.meio === 'pad' && !st.L.pc && (i === st.foco || a.id === 'personalizar');
      b.classList.toggle('sem-glifo', glifo && !cabeAba(b.querySelector('.pp-aba-txt').textContent, st.comIcone, true));
    });
    const c = raiz.querySelector('[data-pp="canto"]');
    if (c && st.canto) {
      const armado = st.armado === 'canto' && performance.now() < st.armadoAte;
      c.classList.toggle('armado', armado);
      c.classList.toggle('destaque', !!st.destaqueCanto && !armado);
      c.setAttribute('aria-label', armado ? st.canto.armar : st.canto.texto);
      const ct = raiz.querySelector('.pp-comp-txt'), txt = armado ? st.canto.armar : st.dados.competicao;
      if (ct && ct.textContent !== txt) { ct.textContent = txt; ajustarComp(); }
    }
  }
  function focarEl(el) { if (el) { el.focus({ preventScroll: true }); } }
  function focarAba(i) {
    const n = st.abas.length;
    st.foco = ((i % n) + n) % n;
    st.linhaFoco = 'abas';
    marcarAbas();
    focarEl(abasEl()[st.foco]);
  }
  /** O foco de volta à tela (depois da pausa, do editor; ou ao abrir): no alvo pedido, senão onde estava. */
  function focar(alvo = null) {
    if (!st.aberta) return;
    if (alvo === 'menu') { focarEl(raiz.querySelector('[data-pp="menu"]')); return; }
    if (alvo) { const i = st.abas.findIndex(a => a.id === alvo); if (i >= 0) { focarAba(i); return; } }
    if (st.linhaFoco === 'abas') focarAba(st.foco);
    else focarAba(st.foco);
  }
  function mover(dir) {
    const ativo = document.activeElement;
    const abas = abasEl(), barra = barraEl(), discos = discosEl();
    const naBarra = barra.includes(ativo), noDisco = discos.includes(ativo);
    if (noDisco) {
      const v = vizinho(discos, ativo, dir);
      if (v) { mostrarNomeDisco(v, false); focarEl(v); return; }
      if (dir === 'cima') { st.linhaFoco = 'barra'; focarEl(barra.find(b => b.classList.contains('pp-time')) ?? barra[0]); limparNomeDisco(); return; }
      if (dir === 'baixo') { limparNomeDisco(); focarAba(st.foco); }
      return;
    }
    if (naBarra) {
      const i = barra.indexOf(ativo);
      if (dir === 'esq' && i > 0) focarEl(barra[i - 1]);
      else if (dir === 'dir' && i < barra.length - 1) focarEl(barra[i + 1]);
      else if (dir === 'baixo') {
        if (discos.length) { const v = maisPerto(discos, ativo); mostrarNomeDisco(v, false); focarEl(v); } else focarAba(st.foco);
      }
      return;
    }
    // nas abas (ou o foco fora: volta às abas)
    if (!abas.includes(ativo)) { focarAba(st.foco); return; }
    if (dir === 'esq') focarAba(st.foco - 1);
    else if (dir === 'dir') focarAba(st.foco + 1);
    else if (dir === 'cima') {
      if (discos.length) { const v = maisPerto(discos, ativo); mostrarNomeDisco(v, false); focarEl(v); return; }
      st.linhaFoco = 'barra';
      focarEl(maisPerto(barra, ativo));
    }
  }
  function maisPerto(lista, de) {
    const r0 = de.getBoundingClientRect(), cx = (r0.left + r0.right) / 2;
    let m = null, dm = Infinity;
    for (const b of lista) { const r = b.getBoundingClientRect(), dd = Math.abs((r.left + r.right) / 2 - cx); if (dd < dm) { dm = dd; m = b; } }
    return m;
  }
  /** O vizinho espacial (o da pausa, hud.js vizinho): na direção, o mais perto pelo eixo e depois pelo outro. */
  function vizinho(lista, at, dir) {
    const r0 = at.getBoundingClientRect(), x0 = (r0.left + r0.right) / 2, y0 = (r0.top + r0.bottom) / 2;
    let m = null, best = Infinity;
    for (const b of lista) {
      if (b === at) continue;
      const r = b.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
      const dx = x - x0, dy = y - y0;
      const ok = dir === 'cima' ? dy < -4 : dir === 'baixo' ? dy > 4 : dir === 'esq' ? dx < -4 : dx > 4;
      if (!ok) continue;
      const prim = dir === 'cima' || dir === 'baixo' ? Math.abs(dy) : Math.abs(dx), sec = dir === 'cima' || dir === 'baixo' ? Math.abs(dx) : Math.abs(dy);
      const c = prim + 2 * sec;
      if (c < best) { best = c; m = b; }
    }
    return m;
  }
  /** O nome do disco à vista; anunciar = false quando o foco vai a ele (o leitor de tela já lê o aria-label do disco). */
  function mostrarNomeDisco(el, anunciar = true) {
    for (const d of discosEl()) d.classList.toggle('com-nome', d === el);
    st.discoFoco = el ? +el.dataset.i : -1;
    if (el && anunciar) viva(`${el.querySelector('b').textContent} ${el.querySelector('.pp-etq').textContent}`);
  }
  function limparNomeDisco() { for (const d of discosEl()) d.classList.remove('com-nome'); st.discoFoco = -1; }
  function viva(t) { const v = raiz.querySelector('#pp-vivo'); if (v) v.textContent = t; }

  /** O Tab preso: a barra de abas (uma parada), os dois times, o ≡ e o canto [<] — dá a volta. */
  function tab(volta) {
    const lista = [abasEl()[st.foco], ...barraEl().filter(b => b.classList.contains('pp-time')), raiz.querySelector('[data-pp="menu"]'), raiz.querySelector('[data-pp="canto"]')].filter(Boolean);
    const i = lista.indexOf(document.activeElement);
    const k = i < 0 ? 0 : (i + (volta ? -1 : 1) + lista.length) % lista.length;
    if (lista[k].classList.contains('pp-aba')) st.linhaFoco = 'abas'; else st.linhaFoco = 'barra';
    focarEl(lista[k]);
  }

  // ------------------------------------------------------------------------------------------------ ações
  function acionarAba(i) {
    const a = st.abas[i];
    if (!a || st.saindo) return;
    focarAba(i);
    if (a.id === 'visao') { proximaVista(); return; }
    // o Pronto é final (sem cancelar): esperando o outro, nada
    if (a.id === 'pronto' && st.aguardando) return;
    if (a.id === 'adversario') { trocarTime(st.time === st.meu ? 1 - st.meu : st.meu); return; }
    if (a.armar) {
      const agora = performance.now();
      if (st.armado === a.id && agora < st.armadoAte) { st.armado = null; marcarAbas(); opc.aoAcao(a.id); return; }
      st.armado = a.id; st.armadoAte = agora + PREPARTIDA.armadoMs;
      marcarAbas();
      viva(a.armar);
      return;
    }
    opc.aoAcao(a.id);
  }
  function acionarCanto() {
    if (!st.canto) return;
    const agora = performance.now();
    if (st.armado === 'canto' && agora < st.armadoAte) { st.armado = null; marcarAbas(); opc.aoAcao('canto'); return; }
    st.armado = 'canto'; st.armadoAte = agora + PREPARTIDA.armadoMs;
    marcarAbas();
    viva(st.canto.armar);
  }
  function proximaVista() {
    if (st.dados?.disputa) return;
    // (o foco num disco que vai sumir volta à aba: não cai no body — revisão A6)
    const noDisco = !!document.activeElement?.classList?.contains('pp-disco');
    st.visao = st.visao === 'escalacao' ? 'sem' : st.visao === 'sem' ? 'com' : 'escalacao';
    st.discoFoco = -1;
    raiz.dataset.visao = st.visao;
    desenharCampo(); escreverInfo(); marcarAbas();
    if (noDisco) focarAba(st.foco);
    viva(st.visao === 'escalacao' ? 'Escalação' : `${st.visao === 'sem' ? 'Sem a bola' : 'Com a bola'}: ${textoTatica(st.dados.times[st.time].tatica).join(', ')}`);
  }
  function trocarTime(t) {
    if (t !== 0 && t !== 1 || t === st.time) return;
    st.time = t;
    st.discoFoco = -1;
    // (o layout é o da formação do time mostrado: refaz tudo e o foco fica onde estava)
    refazer();
    viva(`Mostrando ${st.dados.times[t].nome}`);
  }
  /** Esc / Ⓑ: volta um nível (a vista → a escalação; o adversário → o meu time; no 1º nível: o Simular no TM, senão nada). */
  function voltar() {
    if (st.armado) { st.armado = null; marcarAbas(); return; }
    if (st.visao !== 'escalacao') { st.visao = 'com'; proximaVista(); return; }
    if (st.time !== st.meu) { trocarTime(st.meu); return; }
    const i = st.abas.findIndex(a => a.id === 'simular');
    if (i >= 0) focarAba(i);
  }

  /**
   * Refaz a tela inteira (o layout pela formação do time mostrado e a área segura de agora) e devolve o foco ao mesmo lugar
   * (a aba itinerante, o time, o ≡, o canto); manter = false: sem mexer no foco (a abertura foca depois).
   */
  function refazer(manter = true) {
    if (!st.aberta || !st.dados) return;
    // a área segura de verdade (o env() das variáveis --sa-* só se resolve numa propriedade de verdade: a sonda)
    const cs = getComputedStyle(sonda);
    const px = v => parseFloat(v) || 0;
    const sa = { l: px(cs.paddingLeft), r: px(cs.paddingRight), t: px(cs.paddingTop), b: px(cs.paddingBottom) };
    const T = st.dados.times[st.time];
    st.L = layoutPrepartida(window.innerWidth, window.innerHeight, sa, T.formacao, st.abas.length, { canto: !!st.canto });
    const ativo = document.activeElement;
    const dentro = raiz.contains(ativo) && ativo !== raiz;
    const qual = !dentro ? null : ativo.classList.contains('pp-aba') ? ['aba'] : ativo.classList.contains('pp-time') ? ['time', ativo.dataset.t] : ativo.dataset.pp ? [ativo.dataset.pp] : ['aba'];
    montar();
    if (!manter || !qual) return;
    if (qual[0] === 'time') focarEl(raiz.querySelector(`.pp-time[data-t="${qual[1]}"]`));
    else if (qual[0] === 'menu' || qual[0] === 'canto') focarEl(raiz.querySelector(`[data-pp="${qual[0]}"]`));
    else focarAba(st.foco);
  }

  // os ouvintes (a cada montagem: o innerHTML é novo)
  function ligar() {
    abasEl().forEach((b, i) => aoTocar(b, () => { if (!opc.ocupado()) acionarAba(i); }));
    for (const b of raiz.querySelectorAll('.pp-time')) aoTocar(b, () => { if (!opc.ocupado()) { st.linhaFoco = 'barra'; trocarTime(+b.dataset.t); } });
    aoTocar(raiz.querySelector('[data-pp="menu"]'), () => { if (!opc.ocupado() && !st.saindo) opc.aoAcao('opcoes'); });
    aoTocar(raiz.querySelector('[data-pp="canto"]'), () => { if (!opc.ocupado()) acionarCanto(); });
    // tocar no campinho = Personalizar (só na escalação e onde é editável); na Visão tática, tocar num disco mostra o nome
    const campo = raiz.querySelector('.pp-campo');
    campo.addEventListener('pointerdown', e => {
      if (opc.ocupado() || st.saindo) return;
      const disco = e.target.closest?.('.pp-disco');
      if (disco) { mostrarNomeDisco(disco); return; }
      if (st.visao === 'escalacao' && campo.classList.contains('editavel') && e.target.closest?.('.pp-ficha, .pp-linhas')) {
        e.preventDefault();
        engolirClique(e);
        const i = st.abas.findIndex(a => a.id === 'personalizar');
        if (i >= 0) { focarAba(i); opc.aoAcao('personalizar'); }
      }
    });
    // o foco que cai num botão (mouse) acompanha o itinerante
    raiz.querySelector('.pp-abas').addEventListener('focusin', e => { const b = e.target.closest?.('.pp-aba'); if (b) { st.foco = +b.dataset.i; st.linhaFoco = 'abas'; marcarAbas(); } });
  }

  // o teclado (na captura da janela, antes da entrada; só com a tela aberta e nada por cima)
  window.addEventListener('keydown', e => {
    if (!st.aberta) return;
    if (!st.teclaVista) { st.teclaVista = true; marcarMeio(); }
    if (st.saindo || opc.ocupado() || e.ctrlKey || e.altKey || e.metaKey) return;
    const c = e.code;
    let usado = true;
    if (c === 'Tab') tab(e.shiftKey);
    else if (c === 'ArrowLeft') mover('esq');
    else if (c === 'ArrowRight') mover('dir');
    else if (c === 'ArrowUp') mover('cima');
    else if (c === 'ArrowDown') mover('baixo');
    else if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') { if (!e.repeat) ativar(document.activeElement); }
    else if (c === 'Escape') { if (!e.repeat) voltar(); }
    else if (c === 'KeyQ') trocarTime(0);
    else if (c === 'KeyE') trocarTime(1);
    else if (c === 'KeyP') { if (!e.repeat) opc.aoAcao('opcoes'); }
    else usado = false;
    if (usado) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  /** Enter / Espaço / Ⓐ: o botão em foco (fora da tela: a aba itinerante). */
  function ativar(el) {
    if (!raiz.contains(el) || el === raiz) { acionarAba(st.foco); return; }
    if (el.classList.contains('pp-aba')) acionarAba(+el.dataset.i);
    else if (el.classList.contains('pp-time')) trocarTime(+el.dataset.t);
    else if (el.dataset.pp === 'menu') opc.aoAcao('opcoes');
    else if (el.dataset.pp === 'canto') acionarCanto();
    else if (el.classList.contains('pp-disco')) mostrarNomeDisco(el);
    else acionarAba(st.foco);
  }

  function marcarMeio() {
    // (no aparelho de toque, antes de qualquer tecla, o meio é o toque — a entrada começa em 'teclado' — e o toque não tem o anel de
    // foco: a especificação §5, "o verde da aba do foco fica no Jogar"; revisão A6)
    const m0 = opc.meio?.() ?? 'teclado';
    const m = m0 === 'teclado' && !st.teclaVista && opc.comToque?.() ? 'toque' : m0;
    if (raiz.dataset.meio !== m) { raiz.dataset.meio = m; if (st.L) marcarAbas(); }
  }

  // ------------------------------------------------------------------------------------------------ interface
  return {
    raiz,
    get aberta() { return st.aberta; },
    /**
     * Abre: {modo, fundo ('abertura' | 'jogo'), dados (prepartida.js dadosDaPartida), abas: [{id, texto, icone, primaria, armar}],
     * canto: {texto, armar} | null, meu: o meu time, foco: o id da aba com o foco (padrão a 1ª)}.
     */
    abrir(o) {
      st.modo = o.modo; st.fundo = o.fundo; st.dados = o.dados; st.abas = o.abas; st.canto = o.canto ?? null;
      st.meu = o.meu ?? 0; st.time = st.meu; st.visao = 'escalacao'; st.armado = null; st.aguardando = null; st.destaqueCanto = false; st.discoFoco = -1;
      st.saindo = null;
      st.foco = Math.max(0, st.abas.findIndex(a => a.id === (o.foco ?? st.abas[0]?.id)));
      st.aberta = true;
      raiz.hidden = false;
      raiz.classList.remove('saindo', 'coberta');
      raiz.classList.add('entrando');
      document.documentElement.classList.add('prepartida');
      refazer(false);
      // a cascata das fichas só na abertura
      raiz.querySelector('.pp-campo')?.classList.add('cascata');
      requestAnimationFrame(() => raiz.classList.remove('entrando'));
      focarAba(st.foco);
      viva(`Antes do jogo. ${st.dados.times[0].nome} contra ${st.dados.times[1].nome}.`);
    },
    /** Os dados novos (Personalizar, o Livre, as opções): refaz com o mesmo time, a mesma vista e o mesmo foco. */
    dados(d) {
      if (!st.aberta) return;
      st.dados = d;
      refazer();
    },
    /** Fecha: com fade (250 ms; reduced-motion: na hora). imediato = sem fade (a troca de modo, o Simular). */
    fechar(imediato = false) {
      if (!st.aberta) return;
      st.aberta = false;
      st.saindo = true;
      raiz.classList.remove('coberta');
      document.documentElement.classList.remove('prepartida');
      if (raiz.contains(document.activeElement)) document.activeElement.blur();
      const fim = () => { raiz.hidden = true; raiz.classList.remove('saindo'); raiz.innerHTML = ''; st.saindo = null; };
      const reduz = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (imediato || reduz) { fim(); return; }
      raiz.classList.add('saindo');
      setTimeout(fim, 260);
    },
    /** Refaz o layout (resize, a fonte que chegou). */
    layout() { refazer(); },
    /**
     * A pausa, a Ajuda, o editor ou um submenu do Livre por cima (true): a tela some e fica só o véu sobre o 3D — as duas camadas
     * de interface brigavam (o ✕ da pausa sobre o ≡, duas linhas de comandos, a competição duas vezes, o texto da tela atrás do
     * editor: revisões V5/V6). false: de volta (antes do foco).
     */
    cobrir(v) { raiz.classList.toggle('coberta', !!v); },
    get coberta() { return raiz.classList.contains('coberta'); },
    /** Uma vez por quadro: o controle (Y, X, R3, LB, RB) e o armado que expira. */
    atualizar() {
      if (!st.aberta || st.saindo) return;
      marcarMeio();
      if (st.armado && performance.now() >= st.armadoAte) { st.armado = null; marcarAbas(); }
      const lista = navigator.getGamepads ? navigator.getGamepads() : null;
      if (!lista) return;
      for (let i = 0; i < lista.length; i++) {
        const g = lista[i];
        if (!g || !g.connected) continue;
        const ap = k => !!(g.buttons[k] && (g.buttons[k].pressed || g.buttons[k].value > 0.5));
        const antes = st.padAntes[i] ?? (st.padAntes[i] = []);
        const borda = k => { const p = ap(k), b = p && !antes[k]; antes[k] = p; return b; };
        const y = borda(3), x = borda(2), r3 = borda(11), lb = borda(4), rb = borda(5);
        if (opc.ocupado()) continue;
        if (y) { const k = st.abas.findIndex(a => a.id === 'personalizar'); if (k >= 0) acionarAba(k); }
        if (x || r3) { const k = st.abas.findIndex(a => a.id === 'visao'); if (k >= 0) acionarAba(k); }
        if (lb) trocarTime(0);
        if (rb) trocarTime(1);
      }
    },
    /** As ações da entrada (main.js tratarAcao): menu-* (o controle) e 'pausa' (Start: o ≡). */
    acao(a) {
      if (!st.aberta || st.saindo) return;
      if (a === 'menu-cima') mover('cima');
      else if (a === 'menu-baixo') mover('baixo');
      else if (a === 'menu-esq') mover('esq');
      else if (a === 'menu-dir') mover('dir');
      else if (a === 'menu-ok') ativar(document.activeElement);
      else if (a === 'menu-voltar') voltar();
      else if (a === 'pausa') opc.aoAcao('opcoes');
    },
    focar,
    /** Online: o "Pronto" vira "Aguardando {nome}…" (desabilitado). */
    aguardando(nome) { st.aguardando = nome; marcarAbas(); viva(`Aguardando ${nome}`); },
    /** Online: 60 s esperando o outro — o [<] "Sair da partida" ganha destaque (nada automático). */
    destacarCanto(v = true) {
      if (!!st.destaqueCanto === !!v) return;
      st.destaqueCanto = !!v; marcarAbas();
      if (v && st.canto) viva(`Se ${st.aguardando ?? 'o outro'} não voltar, você pode usar ${st.canto.texto}.`);
    },
    /** Um aviso discreto no canto por `ms` (o som que não ligou pelo controle). */
    aviso(texto, ms = 2000) {
      const a = raiz.querySelector('#pp-aviso');
      if (!a) return;
      a.textContent = texto; a.hidden = false;
      clearTimeout(this._av); this._av = setTimeout(() => { a.hidden = true; }, ms);
    },
    /** O estado (testes): aberta, modo, fundo, regime, abas, foco, time, visão, armado, layout. */
    get estado() {
      return {
        aberta: st.aberta, modo: st.modo, fundo: st.fundo, regime: st.L?.regime ?? null, abas: st.abas.map(a => a.id),
        foco: st.abas[st.foco]?.id ?? null, focoDom: document.activeElement?.closest?.('#prepartida') ? (document.activeElement.dataset.aba ?? document.activeElement.dataset.pp ?? document.activeElement.className) : null,
        time: st.time, meu: st.meu, visao: st.visao, armado: st.armado, aguardando: st.aguardando, disco: st.discoFoco,
        destaqueCanto: !!st.destaqueCanto,
      };
    },
    get layoutAtual() { return st.L; },
    get visaoAtual() { return st.V ? { d: st.V.d, letra: st.V.letra, afastamento: st.V.afastamento, janela: { ...st.V.janela } } : null; },
    trocarTime, proximaVista,
    get sepInfo() { return SEP_INFO; },
  };
}
