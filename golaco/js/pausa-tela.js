// GOLAÇO — a pausa do item 58 (dono, 23/10: "quero ele igual ao do FIFA ... só quero que tenha que aparecer o campinho do time no
// canto direito"; contrato "Pausa (item 58)" no CONTRATOS.md): o CARTÃO do meu time no canto direito e a tabela das ESTATÍSTICAS.
// DOM, sem three.js; não toca no mundo — o main.js manda os dados (dadosPausaTime / dadosPausaEst: o time que VAI valer, pelo
// escalacao.js rascunhoDe, com a edição na fila). Sob demanda (main.js SOB.pausa, com o css/pausa.css e a fonte): a lista da pausa
// funciona sem ele; o cartão aparece quando ele chega (data-pronto no #pausa-time).
//
// O cartão: o cabeçalho (escudo, nome, formação e, com lugar, a mentalidade; no Livre "N contra M") e o MEU MEIO CAMPO EM PÉ, como
// o FIFA 23 — o campinho.js de sempre (svgCampinho(true)) com o viewBox recortado do meio-campo até a linha de fundo e as fichas
// pela posicaoNaTela(…, true): o goleiro embaixo, o ataque em cima. Cada ficha: o disco na cor do time (o goleiro na camisa do
// kit dele) com o número, o nome de camisa embaixo ("…" sem lugar), o amarelo, o ↑ de quem entra (substituição na fila), o anel
// de "você" (o controlado, ou o travado do Rumo ao Estrelato); o expulso é a vaga VAZIA (o buraco que o jogo deixa). Quem está
// com a bola, o fôlego e o capitão: não (o jogo está congelado atrás; o jogo não tem fôlego dinâmico nem capitão).
import { svgCampinho, posicaoNaTela } from './campinho.js';
// os rótulos das estatísticas: a MESMA fonte da cena do intervalo (cenas-tela.js não tem efeito na importação)
import { ROTULOS_EST } from './cenas-tela.js';

const NS = 'http://www.w3.org/2000/svg';
// o meu meio campo em pé: do meio-campo (y 52,5) até a linha de fundo (105), com 1,5 m de folga em cima (a linha do meio e o meio
// círculo no alto, a área e o gol embaixo)
export const VIEWBOX_MEIO = '0 51 68 54.5';
const PROPORCAO = 54.5 / 68;
const ICONE_ENTRA = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10.5V2M2.5 5.2 6 1.6l3.5 3.6"/></svg>';
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const GRUPOS = [['Goleiro', v => v === 0], ['Defesa', v => v > 0 && v < 2], ['Meio', v => v >= 2 && v < 4], ['Ataque', v => v >= 4]];

/** Luminância relativa (WCAG) de uma cor #rrggbb. */
function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return 0.2;
  const c = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/** O número sobre o disco: preto ou branco, o que der mais contraste (≥ 4,5:1 nas cores dos times). */
export const textoSobre = hex => ((lum(hex) + 0.05) / 0.05 >= 1.05 / (lum(hex) + 0.05) ? '#050807' : '#ffffff');

/**
 * Os tamanhos do campinho do cartão numa área W × H (px; W = a largura do campo, H = a altura que sobra) — item 125 (dono, 05/11:
 * "o campinho um pouco maior"): o campo na proporção do meio campo (68:54,5) com 6% a mais de altura (as 5 filas e os nomes); o
 * disco pela largura (18–40 px: ~8 + 6,2% de W), limitado pelo passo das filas (5 fichas na altura, com a linha do nome); a largura
 * máxima do nome ⌊(W − 24)/5⌋ (o passo de 4 colunas encostadas); a letra do nome — a TM Cond 800 em caixa alta, ~0,47 em por letra
 * de camisa — pelo disco e pelo que cabe ("ALBUQUERQU", 10 letras, + os 6 px da plaquinha): 11–18 px, 10 só se o passo das filas
 * não couber com 11 (o 568×320); o número no disco a 0,56 do disco. Pura (o teste chama).
 */
export function tamanhoCampinhoPausa(W, H) {
  const h = Math.min(H, W * PROPORCAO * 1.06);
  let disco = Math.max(18, Math.min(40, Math.round(8 + W * 0.062)));
  const cw = Math.max(30, Math.floor((W - 24) / 5));
  let letra = Math.max(11, Math.min(18, Math.round(disco * 0.44), Math.floor((cw - 6) / 4.8)));
  const linhaNome = () => Math.ceil(letra * 1.15) + 2;
  // o passo das filas (a grade de 5 da posicaoNaTela, com as margens): o disco + o nome + 4 px de folga cabem nele
  const passo = (h - 20) / 5;
  if (disco + 2 + linhaNome() + 2 > passo) disco = Math.max(18, Math.floor(passo - 4 - linhaNome()));
  if (disco + 2 + linhaNome() + 2 > passo) { letra = 10; disco = Math.max(16, Math.min(disco, Math.floor(passo - 4 - linhaNome()))); }
  return { campo: { w: Math.round(W), h: Math.round(h) }, disco, num: Math.max(10, Math.round(disco * 0.56)), nome: letra, cw, ch: disco + 2 + linhaNome() };
}

/**
 * Cria o cartão em `cartao` (o #pausa-time) e a tabela em `est` (a <table class="pausa-est"> do submenu Estatísticas).
 * Devolve {time(d | null), estatisticas(d | null), layout(), estado}.
 *  d (time) = {nome, sigla, escudo (o href do <use> do sprite), cor, corGol, formacao, mentalidade, texto (no Livre: "N contra M"),
 *    editavel, fichas: [{vaga, fila, col, id, num, nome, gol, amarelos, expulso, entra, voce}]}
 *  d (estatísticas) = {titulo, times: [{sigla, nome, escudo, cor1}], itens, valores} (o mesmo formato do painel da cena)
 */
export function criarPausaTela({ cartao, est }) {
  let dados = null, sz = null;
  const fichasEl = [];
  if (cartao) {
    cartao.innerHTML = `<header class="pt-topo" id="pt-topo"><svg class="pt-escudo" viewBox="0 0 20 22" aria-hidden="true"><use/></svg>`
      + `<b class="pt-nome"></b><span class="pt-forma"></span><span class="pt-ment"></span></header>`
      + `<p class="pt-sr pt-resumo"></p>`
      + `<div class="pt-campo" aria-hidden="true"><svg class="pt-linhas" viewBox="${VIEWBOX_MEIO}" preserveAspectRatio="none">${svgCampinho(true).html}</svg>`
      // (item 125) a formação e a mentalidade grandes DENTRO do campo, no canto de baixo à esquerda
      + `<div class="pt-formacao"><b></b><span></span></div></div>`;
    cartao.setAttribute('role', 'region');
    cartao.setAttribute('aria-labelledby', 'pt-topo');
    cartao.tabIndex = -1;
  }
  const q = s => cartao?.querySelector(s);
  const topo = q('.pt-topo'), campo = q('.pt-campo'), resumo = q('.pt-resumo');

  /** O resumo para o leitor de tela: o time, a formação, a mentalidade e os jogadores por linha, os cartões e "você". */
  function textoResumo(d) {
    const nomeDe = f => `${f.num} ${f.nome}`.trim();
    const partes = [`${d.nome}, ${d.texto ?? d.formacao}${d.mentalidade ? `, mentalidade ${d.mentalidade}` : ''}.`];
    for (const [g, ok] of GRUPOS) {
      const l = d.fichas.filter(f => !f.expulso && ok(f.fila)).sort((a, b) => a.col - b.col).map(nomeDe);
      if (l.length) partes.push(`${g}: ${l.join(', ')}.`);
    }
    const am = d.fichas.filter(f => f.amarelos > 0 && !f.expulso).map(nomeDe);
    if (am.length) partes.push(`Cartão amarelo: ${am.join(', ')}.`);
    const ex = d.fichas.filter(f => f.expulso).map(nomeDe);
    if (ex.length) partes.push(`Vaga vazia, expulso: ${ex.join(', ')}.`);
    const en = d.fichas.filter(f => f.entra && !f.expulso).map(nomeDe);
    if (en.length) partes.push(`Entra na próxima parada: ${en.join(', ')}.`);
    const vc = d.fichas.find(f => f.voce && !f.expulso);
    if (vc) partes.push(`Você: ${nomeDe(vc)}.`);
    return partes.join(' ');
  }

  function montar(d) {
    for (const e of fichasEl) e.remove();
    fichasEl.length = 0;
    if (!cartao) return;
    cartao.style.setProperty('--pt-cor', d.cor);
    cartao.style.setProperty('--pt-cor-txt', textoSobre(d.cor));
    cartao.style.setProperty('--pt-gol', d.corGol ?? d.cor);
    cartao.style.setProperty('--pt-gol-txt', textoSobre(d.corGol ?? d.cor));
    const use = q('.pt-escudo use'), svgE = q('.pt-escudo');
    if (d.escudo) { use.setAttribute('href', d.escudo); svgE.style.display = ''; } else svgE.style.display = 'none';
    q('.pt-nome').textContent = d.nome ?? '';
    q('.pt-forma').textContent = d.texto ?? d.formacao ?? '';
    q('.pt-ment').textContent = d.mentalidade ? `· ${d.mentalidade}` : '';
    q('.pt-formacao b').textContent = d.texto ?? d.formacao ?? '';
    q('.pt-formacao span').textContent = d.mentalidade ?? '';
    resumo.textContent = textoResumo(d);
    cartao.dataset.editavel = d.editavel ? '1' : '0';
    cartao.classList.toggle('editavel', !!d.editavel);
    for (const f of d.fichas) {
      const e = document.createElement('div');
      e.className = `pt-ficha${f.gol ? ' gol' : ''}${f.expulso ? ' vazia' : ''}${f.voce && !f.expulso ? ' voce' : ''}`;
      e.dataset.vaga = f.vaga;
      if (f.id != null) e.dataset.id = String(f.id);
      e.innerHTML = `<span class="pt-disco">${f.expulso ? '' : esc(f.num)}</span>`
        + (f.expulso ? '<i class="pt-vermelho"></i>' : `<span class="pt-nm">${esc(f.nome)}</span>`)
        + (f.amarelos > 0 && !f.expulso ? '<i class="pt-amarelo"></i>' : '')
        + (f.entra && !f.expulso ? `<i class="pt-entra">${ICONE_ENTRA}</i>` : '');
      campo.appendChild(e);
      fichasEl.push(e);
    }
  }

  /** Mede o cartão e põe o campo e as fichas (o ResizeObserver chama sozinho; a tela muda de tamanho). */
  function layout() {
    if (!cartao || cartao.hidden || !dados) return;
    // (item 125) a largura do CSS (o ajuste ao campo da vez anterior sai: a conta parte da largura de verdade)
    cartao.style.width = '';
    const cs = getComputedStyle(cartao);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const W = cartao.clientWidth - padX;
    if (!(W > 0)) return;
    // a altura que sobra para o campo: o máximo do cartão (CSS) menos o cabeçalho, as margens e as bordas. O max-height é um calc()
    // com % ("calc(100% - 99px)": o parseFloat dava NaN e a conta caía no innerHeight — o campo vazava 8 px do cartão em 568×320):
    // resolvido por uma sonda no mesmo pai
    let max = parseFloat(cs.maxHeight);
    if (!/px$/.test(cs.maxHeight) && cartao.parentElement) {
      const sonda = document.createElement('div');
      sonda.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;width:1px;height:${cs.maxHeight}`;
      cartao.parentElement.appendChild(sonda);
      max = sonda.offsetHeight;
      sonda.remove();
    }
    const bordas = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const gap = parseFloat(getComputedStyle(campo).marginTop) || 0;
    const H = Math.max(40, (Number.isFinite(max) && max > 0 ? max : innerHeight) - bordas - padY - topo.offsetHeight - gap);
    // o cartão AJUSTADO ao campo quando a altura é o limite (o celular): sem isso o campo ficava esticado na largura
    const Wfit = Math.min(W, Math.floor(H / PROPORCAO / 1.06));
    sz = tamanhoCampinhoPausa(Wfit, H);
    if (Wfit < W) cartao.style.width = `${Wfit + padX + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)}px`;
    campo.style.width = `${sz.campo.w}px`;
    campo.style.height = `${sz.campo.h}px`;
    cartao.style.setProperty('--pt-disco', `${sz.disco}px`);
    cartao.style.setProperty('--pt-letra', `${sz.nome}px`);
    cartao.style.setProperty('--pt-num', `${sz.num}px`);
    cartao.style.setProperty('--pt-nome-w', `${sz.cw}px`);
    cartao.style.setProperty('--pt-forma-f', `${Math.round(Math.max(18, Math.min(40, sz.campo.w * 0.062)))}px`);
    cartao.style.setProperty('--pt-ment-f', `${Math.round(Math.max(11, Math.min(15, sz.campo.w * 0.03)))}px`);
    // a mentalidade só com lugar (mais de 300 px: o 844×390 e o PC)
    cartao.classList.toggle('largo', cartao.clientWidth > 300);
    dados.fichas.forEach((f, i) => {
      const e = fichasEl[i];
      if (!e) return;
      const p = posicaoNaTela(f, sz.campo.w, sz.campo.h, sz.cw, sz.ch, true);
      e.style.left = `${Math.round(p.x)}px`;
      e.style.top = `${Math.round(p.y - sz.ch / 2)}px`;
    });
  }
  const ro = typeof ResizeObserver === 'function' && cartao ? new ResizeObserver(() => layout()) : null;
  ro?.observe(cartao);

  // ---- as estatísticas: uma tabela (o leitor de tela lê "Posse de bola, GLÇ 55%"); a posse com a barrinha dividida
  function valor(itm, v, t) {
    if (itm === 'cartoes') {
      const a = v.amarelos?.[t] ?? 0, r = v.vermelhos?.[t] ?? 0;
      return `<i class="pe-cartao amarelo" aria-hidden="true"></i><b>${a}</b><span class="pt-sr"> ${a === 1 ? 'amarelo' : 'amarelos'}</span>`
        + (r ? `<i class="pe-cartao vermelho" aria-hidden="true"></i><b>${r}</b><span class="pt-sr"> ${r === 1 ? 'vermelho' : 'vermelhos'}</span>` : '');
    }
    const n = v[itm]?.[t] ?? 0;
    return `<b>${itm === 'posse' ? `${n}%` : n}</b>`;
  }
  const cabTime = (t, lado) => `<th scope="col" class="pe-time pe-${lado}" style="--pt-cor:${esc(t?.cor1 ?? '#22c55e')}">`
    + (lado === 'b' ? `<span>${esc(t?.sigla ?? '')}</span>` : '')
    + (t?.escudo ? `<svg class="pe-escudo" viewBox="0 0 20 22" aria-hidden="true"><use href="${esc(t.escudo)}"/></svg>` : '')
    + (lado === 'a' ? `<span>${esc(t?.sigla ?? '')}</span>` : '')
    + `<span class="pt-sr"> ${esc(t?.nome ?? '')}</span></th>`;
  let chaveEst = null, linhasEst = 0;
  function estatisticas(d) {
    if (!est) return;
    if (!d) { est.innerHTML = ''; chaveEst = null; linhasEst = 0; return; }
    const chave = JSON.stringify([d.titulo, d.times?.map(t => [t.sigla, t.escudo, t.cor1]), d.itens, d.valores]);
    if (chave === chaveEst) return;
    chaveEst = chave;
    const itens = (d.itens ?? []).filter(i => i in ROTULOS_EST);
    const linhas = itens.map(itm => {
      // (item 125) a barrinha da posse na cor de CADA time (a do time da esquerda cresce da esquerda)
      const barra = itm === 'posse' ? `<span class="pe-barra" aria-hidden="true" style="--pe-c0:${esc(d.times?.[0]?.cor1 ?? '#22c55e')};--pe-c1:${esc(d.times?.[1]?.cor1 ?? '#8a9d90')}"><i style="width:${Math.max(0, Math.min(100, d.valores.posse?.[0] ?? 50))}%"></i></span>` : '';
      return `<tr class="pe-${itm}"><td class="pe-a">${valor(itm, d.valores, 0)}</td><th scope="row">${ROTULOS_EST[itm]}${barra}</th><td class="pe-b">${valor(itm, d.valores, 1)}</td></tr>`;
    });
    est.innerHTML = `<caption>${esc(d.titulo ?? 'Estatísticas da partida')}</caption>`
      + `<thead><tr>${cabTime(d.times?.[0], 'a')}<th scope="col" class="pe-meio"><span class="pt-sr">Estatística</span></th>${cabTime(d.times?.[1], 'b')}</tr></thead>`
      + `<tbody>${linhas.join('')}</tbody>`;
    linhasEst = linhas.length;
  }

  return {
    /** O time do cartão (d) ou nada (null: treinos e disputa, sem o cartão). */
    time(d) {
      if (!cartao) return;
      dados = d && d.fichas?.length ? d : null;
      if (!dados) { cartao.hidden = true; for (const e of fichasEl) e.remove(); fichasEl.length = 0; cartao.dataset.pronto = '1'; return; }
      montar(dados);
      cartao.hidden = false;
      layout();
      cartao.dataset.pronto = '1';
    },
    estatisticas,
    layout,
    /** Para os testes: o que está desenhado (caixas em px da página). */
    get estado() {
      const R = e => { const r = e.getBoundingClientRect(); return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
      return {
        pronto: cartao?.dataset.pronto === '1', visivel: !!cartao && !cartao.hidden, formacao: q('.pt-forma')?.textContent ?? null,
        mentalidade: q('.pt-ment')?.textContent ?? null, tamanhos: sz ? { ...sz, campo: { ...sz.campo } } : null,
        campo: campo ? R(campo) : null, cartao: cartao ? R(cartao) : null,
        fichas: fichasEl.map((e, i) => {
          const nm = e.querySelector('.pt-nm'), di = e.querySelector('.pt-disco');
          return {
            vaga: e.dataset.vaga, id: e.dataset.id != null ? +e.dataset.id : null, fila: dados?.fichas[i]?.fila, col: dados?.fichas[i]?.col,
            num: di?.textContent ?? '', nome: nm?.textContent ?? '', nomeCortado: !!nm && nm.scrollWidth > nm.clientWidth + 0.5,
            caixa: R(e), disco: di ? R(di) : null, nomeCaixa: nm ? R(nm) : null, letra: nm ? parseFloat(getComputedStyle(nm).fontSize) : null,
            letraNum: di ? parseFloat(getComputedStyle(di).fontSize) : null,
            vazia: e.classList.contains('vazia'), amarelo: !!e.querySelector('.pt-amarelo'), entra: !!e.querySelector('.pt-entra'), voce: e.classList.contains('voce'),
          };
        }),
        est: est ? { linhas: linhasEst, caption: est.querySelector('caption')?.textContent ?? null } : null,
      };
    },
  };
}
