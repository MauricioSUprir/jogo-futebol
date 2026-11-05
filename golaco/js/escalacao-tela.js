// GOLAÇO — escalação do PRÉ-JOGO (DOM). Pedido do dono de 11/10: "aparece a escalação dos dois times em um campinho:
// primeiro um time, aparece grande na tela, com o mesmo fundo, uns 10 seg, aí sai da tela, e entra a escalação do outro
// time, da mesma forma". Cada time numa folha que ocupa a tela: a coluna do time (faixa na cor do uniforme, o nome e a
// formação) e o campinho grande com as 11 cartas (número, nome de camisa e posição de cada titular) — os dados da
// escalação (m.times, lidos antes do 1º passo: só leitura), nenhum outro texto (sem narração).
//
// O campinho EM PÉ (item 29; dono, 17/10: "o campinho da escalação do jogo EM PÉ (retrato), não deitado"): o campo inteiro com o
// GOL EMBAIXO, a caixa mais alta que larga (L/A 0,80 da Globo 2025, até 0,85 quando o nome mais largo pede), as marcas no tamanho
// real (o círculo redondo; só a distância entre as laterais estica, como no FM26: campinho.js svgCampinho(true, largura)) e as
// cartas das pontas ~9% para dentro das laterais (no aperto, sobre a linha). O nome de camisa em TM Cond 800 (a letra das fichas
// da tela antes do jogo), medido pela tabela de avanços (letra-cond.js: a conta não espera a fonte chegar); a letra mínima do
// PESQUISA-ESTADIO §7.4/§7.5 (celular: nome e posição ≥ 11 px, ≥ 10 em 568×320; PC: nome ≥ 13). A conta é a mesma nas duas
// folhas (os 22 titulares; a mesma altura): o campo tem o mesmo tamanho e o mesmo topo nas duas. tools/teste-prejogo.mjs (itens 4,
// 4b e 15) e tools/teste-escalacao-campo.mjs conferem; contrato "Pré-jogo" no CONTRATOS.md.
//
// O movimento sai do relógio do roteiro (prejogo-roteiro.js escalacaoEm: entrando/saindo 0–1), não de transição do
// CSS: com o relógio manual dos testes e prints a tela fica no mesmo ponto que o 3D. Entra deslizando da esquerda
// (cubic-bezier(.2,.8,.2,1)), as cartas em cascata de 40 ms do goleiro ao ataque (de baixo para cima); sai para a direita
// enquanto a outra entra. Com "reduzir movimento" do sistema: só esmaece.
import { ELENCOS, fichaDe } from './elenco.js';
import { FORMACOES } from './formacoes.js';
import { svgCampinho } from './campinho.js';
import { larguraCond, larguraCondInteira } from './letra-cond.js';

// cor da faixa do time pelo uniforme de linha (fictícios: o Golaço FC preto e verde, o Ventania FC branco); a pausa usa a mesma
// no cartão do time (js/pausa-tela.js, pelo main.js)
export const COR_UNIFORME = { linha0: '#19e07a', linha1: '#e9ecee' };
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reduz = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (a, v, b) => (v < a ? a : v > b ? b : v);

/** Curva de saída rápida e chegada suave (o cubic-bezier(.2, .8, .2, 1) do CSS, aproximado). */
function entrada(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return 1 - Math.pow(1 - x, 3.2); }

/**
 * As constantes da escalação em pé (item 29; fora do config.js, que é do fecho do hash). la/laMax: L/A do campo (Globo 2025 e o
 * teto: nunca quadrado); kPasso: o passo-alvo entre colunas × a altura (as pontas ~9% para dentro com L/A 0,80); folga: entre
 * cartas vizinhas (px); a carta: largura até cwTeto, altura chMin–chMax; o nome (k × ch, máx., mínimos do celular, de 568×320 e
 * do PC, a entrelinha que não corta os traços de baixo, a largura máxima na carta); a posição (celular, 568×320, PC k × ch);
 * celular = altura da tela ≤ celularMaxH (o corte do PREPARTIDA do item 64); pequena = altura < pequenaH (568×320).
 */
export const ESCALACAO = Object.freeze({
  la: 0.80, laMax: 0.85, kPasso: 0.164, folga: 10, cwTeto: 120, chMin: 44, chMax: 76,
  num: 0.34,
  nome: Object.freeze({ k: 0.19, max: 15, minCel: 11, minPequena: 10, minPc: 13, linha: 1.25, largura: 0.94 }),
  pos: Object.freeze({ cel: 11, pequena: 10, k: 0.15, minPc: 11, maxPc: 12 }),
  // borda da carta (3 em cima + 1 embaixo) e os 2 vãos de 2 px entre as linhas: a conta da linha da posição
  bordaV: 4, vaos: 4,
  celularMaxH: 480, pequenaH: 350,
  // a janela de PC em pé: até 3 refeitas com a altura menor quando a largura não dá
  refazMax: 3,
});

/**
 * Tamanho do campo em pé e das cartas (px) — pura (os testes chamam). W = a largura máxima do grupo do campo, H = a altura da
 * área; larguraNome(px) = a largura (TM Cond 800, caixa normal) do nome mais largo dos 22 titulares; alturaTela = innerHeight
 * (celular ≤ 480; 568×320 < 350). Devolve {w, h, cw, ch, passo, inset, fora, fonteNome, fontePos, comPos, largura, teto}:
 * w × h o campo; passo entre as colunas; inset = do centro das cartas das pontas (col ±2) até a lateral; fora = quanto a carta
 * da ponta passa da lateral; largura = a largura desenhada em metros (dentro da borda de 1 px do campo); teto = o nome mais largo
 * não coube nem no teto de L/A (os que não cabem saem com "…").
 */
export function tamanhoEscalacao(W, H, { larguraNome = null, alturaTela = H } = {}) {
  const E = ESCALACAO;
  const celular = alturaTela <= E.celularMaxH, pequena = alturaTela < E.pequenaH;
  const minNome = celular ? (pequena ? E.nome.minPequena : E.nome.minCel) : E.nome.minPc;
  const larg = typeof larguraNome === 'function' ? larguraNome : () => 0;
  // Wc: o teto da largura do grupo (o campo + as pontas), só na última refeita da janela em pé
  const conta = (altura, Wc = Infinity) => {
    const h = Math.max(1, Math.floor(altura));
    const ch = clamp(E.chMin, Math.floor((h - 12 - 4 * E.folga) / 5), E.chMax);
    const fontePos = celular ? (pequena ? E.pos.pequena : E.pos.cel) : clamp(E.pos.minPc, +(E.pos.k * ch).toFixed(2), E.pos.maxPc);
    let fonteNome = clamp(minNome, +(E.nome.k * ch).toFixed(2), E.nome.max);
    const wMax = Math.floor(E.laMax * h), wAlvo = Math.round(E.la * h);
    const cartaDe = fn => {
      const cwNome = Math.ceil(larg(fn) / E.nome.largura) + 2;
      const cw = Math.min(E.cwTeto, Math.max(cwNome, Math.floor(E.kPasso * h - E.folga)));
      return { cw, passo: Math.max(cw + E.folga, E.kPasso * h) };
    };
    let { cw, passo } = cartaDe(fonteNome), teto = false;
    // o que cede quando não cabe: 1) a letra do nome até o mínimo da tela; 2) o passo no teto de L/A (o nome com "…"); 3) na
    // janela em pé estreita, as 5 cartas + 4 folgas na largura Wc
    if ((4 * passo > wMax || 4 * passo + cw > Wc) && fonteNome > minNome) { fonteNome = minNome; ({ cw, passo } = cartaDe(fonteNome)); }
    if (4 * passo > wMax) { passo = wMax / 4; cw = Math.floor(passo - E.folga); teto = true; }
    if (4 * passo + cw > Wc) { cw = Math.max(1, Math.floor((Wc - 4 * E.folga) / 5)); passo = cw + E.folga; teto = true; }
    // o campo alarga de 0,80 até 0,85 para as cartas das pontas caberem inteiras; além disso elas ficam sobre a lateral
    const w = Math.min(wMax, Math.floor(Wc), Math.max(wAlvo, Math.ceil(4 * passo + cw)));
    const inset = (w - 4 * passo) / 2, fora = Math.max(0, cw / 2 - inset);
    const comPos = E.num * ch + E.nome.linha * fonteNome + fontePos + E.vaos + E.bordaV <= ch;
    const largura = +(105 * Math.max(1, w - 2) / Math.max(1, h - 2)).toFixed(2);
    return { w, h, cw, ch, passo, inset, fora, fonteNome, fontePos, comPos, largura, teto };
  };
  let r = conta(H);
  // janela de PC em pé: a largura não dá → a altura desce na mesma proporção (o campo fica centrado na vertical)
  const largo = x => Number.isFinite(W) && W > 0 && x.w + 2 * x.fora > W + 0.5;
  for (let i = 0; i < E.refazMax && largo(r); i++) r = conta(r.h * W / (r.w + 2 * r.fora));
  // (a altura não resolve quando o nome mais largo segura a carta: a letra ao mínimo e as cartas pela largura)
  if (largo(r)) r = conta(r.h, W);
  return r;
}

/**
 * Centro (px) da carta da vaga no campo em pé de `tam` (tamanhoEscalacao), a partir do canto de cima à esquerda do campo: x pelo
 * passo das colunas a partir do inset (col −2 = o lado esquerdo do time), y pela grade de 5 filas do campinho.js posicaoNaTela
 * (o goleiro, fila 0, embaixo). Pura.
 */
export function posicaoCarta(vaga, tam) {
  const { h, ch, passo, inset } = tam;
  return { x: inset + (vaga.col + 2) * passo, y: h - 6 - ch / 2 - vaga.fila * (h - 12 - ch) / 4 };
}

/** Os nomes de camisa dos titulares dos dois times (m.times = {0, 1}: só leitura), na ordem das vagas. */
export function nomesTitulares(times) {
  const nomes = [];
  for (const t of [0, 1]) {
    const tm = times?.[t], f = FORMACOES[tm?.formacao];
    if (!f) continue;
    for (const v of f.vagas) { const j = fichaDe(tm.vagas?.[v.id]); if (j) nomes.push(String(j.camisa ?? '')); }
  }
  return nomes;
}

/**
 * larguraNome(px) dos nomes: o mais largo em TM Cond 800, caixa normal (letra-cond.js) — a maior entre a tabela exata e a dos
 * avanços arredondados ao px (o Chromium sem posição subpixel do texto: até +0,5 px por letra).
 */
export function larguraNomes(nomes) {
  const lista = [...new Set(nomes.map(String))];
  return px => lista.reduce((m, n) => Math.max(m, larguraCond(n, px, false), larguraCondInteira(n, px, false)), 0);
}

/**
 * Cria a escalação dentro de `raiz` (o #prejogo). ident (identidade.js, só com ?tm): a cor de cada time e o escudo dele
 * em cima do nome. Devolve {montar(times), mostrar(e), esconder(), estado, cartas(t), folha(t), campo(t)}.
 * e = prejogo-roteiro.js escalacaoEm(r, t) ({time, entrando, saindo, saiTime, cheia}) mais tau (s desde que a folha
 * começou a entrar) para a cascata das cartas.
 */
export function criarEscalacaoTela(raiz, ident = null) {
  const folhas = [0, 1].map(t => {
    const s = document.createElement('section');
    s.className = 'pj-esc';
    s.dataset.time = String(t);
    s.hidden = true;
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<div class="pj-esc-info"><i class="pj-esc-faixa"></i><span class="pj-esc-rotulo">Escalação</span><h2 class="pj-esc-nome"></h2><span class="pj-esc-forma"></span></div>`
      + `<div class="pj-esc-area"><div class="pj-esc-campo"><svg class="pj-esc-linhas" preserveAspectRatio="none" aria-hidden="true"></svg></div></div>`;
    raiz.appendChild(s);
    return { s, info: s.querySelector('.pj-esc-info'), campo: s.querySelector('.pj-esc-campo'), area: s.querySelector('.pj-esc-area'), linhas: s.querySelector('.pj-esc-linhas'), cartas: [], vagas: [], largura: null, tam: null, conta: null };
  });
  const estado = { visivel: false, time: null, cheia: null };
  let ultimoTam = '';
  // a largura do nome mais largo dos 22 titulares (as duas folhas pela mesma conta)
  let larguraNome = () => 0;

  function montarFolha(f, tm, t) {
    const el = ELENCOS[tm.elenco];
    f.s.style.setProperty('--cor-time', ident ? ident.hud.placar[t] : COR_UNIFORME[el?.uniforme?.linha] ?? '#19e07a');
    if (ident) {
      // o escudo do time (a mesma imagem do Total Match) em cima da faixa
      let im = f.s.querySelector('.pj-esc-escudo');
      if (!im) {
        im = document.createElement('img');
        im.className = 'pj-esc-escudo';
        im.alt = '';
        im.style.cssText = 'display:block;width:auto;height:clamp(40px,11vh,92px);max-width:100%;object-fit:contain;object-position:left center';
        f.info.prepend(im);
      }
      im.src = ident.times[t].escudo.url;
    }
    f.s.querySelector('.pj-esc-nome').textContent = el?.nome ?? '';
    f.s.querySelector('.pj-esc-forma').textContent = tm.formacao;
    f.s.setAttribute('aria-label', `Escalação: ${el?.nome ?? ''}, ${tm.formacao}`);
    for (const c of f.cartas) c.remove();
    f.cartas = []; f.vagas = [];
    for (const v of FORMACOES[tm.formacao].vagas) {
      const id = tm.vagas[v.id];
      const j = fichaDe(id);
      if (!j) continue;  // vaga vazia (não acontece antes do 1º passo)
      const d = document.createElement('div');
      d.className = 'pj-carta';
      d.dataset.id = String(id);
      d.dataset.vaga = v.id;
      d.setAttribute('aria-label', `${j.num} ${j.camisa}, ${v.pos}`);
      d.innerHTML = `<span class="pj-num">${j.num}</span><span class="pj-nome">${esc(j.camisa)}</span><span class="pj-pos">${esc(v.pos)}</span>`;
      f.campo.appendChild(d);
      f.cartas.push(d);
      f.vagas.push(v);
    }
    f.tam = null;
  }

  /** As medidas da folha: a área (altura da linha da grade) e a largura que sobra para o grupo do campo. */
  function medir(f) {
    const H = f.area.clientHeight, sW = f.s.clientWidth;
    if (!(H > 0 && sW > 0)) return null;
    const iw = f.info.offsetWidth;
    return { H, sW, iw, chave: `${sW}x${H}x${iw}x${window.innerHeight}` };
  }

  function layout(f) {
    if (f.tam !== null) { const md0 = medir(f); if (!md0 || md0.chave === f.tam) return; }
    // a conta de novo, sem os tamanhos de antes: o campo da tela anterior seguraria a linha da grade (e a altura) e o grupo
    // largo espremeria a coluna do time (o nome quebrando letra a letra)
    f.area.style.width = ''; f.campo.style.width = ''; f.campo.style.height = '';
    const md = medir(f);
    if (!md) { f.tam = null; return; }
    const cs = getComputedStyle(f.s);
    const conteudo = md.sW - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const retrato = cs.gridTemplateColumns.trim().split(/\s+/).length < 2;
    const W = retrato ? conteudo : conteudo - md.iw - (parseFloat(cs.columnGap) || 0);
    const T = tamanhoEscalacao(W, md.H, { larguraNome, alturaTela: window.innerHeight });
    f.conta = T;
    const { w, h, cw, ch } = T;
    f.area.style.width = `${Math.ceil(w + 2 * T.fora)}px`;
    f.campo.style.width = `${w}px`; f.campo.style.height = `${h}px`;
    if (f.largura !== T.largura) {
      const s = svgCampinho(true, T.largura);
      f.linhas.setAttribute('viewBox', s.viewBox);
      f.linhas.innerHTML = s.html;
      f.largura = T.largura;
    }
    const st = f.campo.style;
    st.setProperty('--ch', `${ch}px`); st.setProperty('--cw', `${cw}px`);
    st.setProperty('--fn', `${T.fonteNome}px`); st.setProperty('--fp', `${T.fontePos}px`);
    // (as cartas ficam na caixa de dentro da borda de 1 px do campo: a conta é da caixa de fora)
    f.cartas.forEach((d, i) => {
      const p = posicaoCarta(f.vagas[i], T);
      d.style.left = `${(p.x - cw / 2 - 1).toFixed(1)}px`; d.style.top = `${(p.y - ch / 2 - 1).toFixed(1)}px`;
      d.style.width = `${cw}px`; d.style.height = `${ch}px`;
      d.classList.toggle('sem-pos', !T.comPos);
    });
    // a chave com os tamanhos novos no lugar (os quadros seguintes comparam com ela)
    f.tam = medir(f)?.chave ?? null;
  }

  function aplicar(f, mostra, x, tau) {
    const s = f.s;
    if (!mostra) { if (!s.hidden) { s.hidden = true; s.classList.remove('cheia'); } return; }
    if (s.hidden) { s.hidden = false; f.tam = null; }
    layout(f);
    if (reduz()) { s.style.transform = 'none'; s.style.opacity = String(Math.max(0, Math.min(1, 1 - Math.abs(x)))); }
    else { s.style.transform = `translate3d(${(x * 110).toFixed(2)}%, 0, 0)`; s.style.opacity = '1'; }
    // cartas em cascata (40 ms entre uma e outra, do goleiro ao ataque) enquanto a folha entra
    f.cartas.forEach((d, i) => {
      const k = tau == null ? 1 : entrada((tau - 0.12 - i * 0.04) / 0.32);
      const o = reduz() ? 1 : k;
      d.style.opacity = o.toFixed(3);
      d.style.transform = o >= 1 ? '' : `translate3d(0, ${((1 - o) * 14).toFixed(1)}px, 0)`;
    });
  }

  return {
    estado,
    /** Monta as duas folhas com os times da partida (m.times: só leitura); pede a TM Cond dos nomes. */
    montar(times) {
      folhas.forEach((f, t) => montarFolha(f, times[t], t));
      const nomes = nomesTitulares(times);
      larguraNome = larguraNomes(nomes);
      if (typeof document !== 'undefined' && document.fonts && document.fonts.load) document.fonts.load(`800 ${ESCALACAO.nome.minCel}px "TM Cond"`, nomes.join('') || 'A').catch(() => null);
    },
    /**
     * Mostra pelo estado do roteiro: e = {time, entrando, saindo, saiTime, cheia, tau, tauSai}. A que entra vem da
     * esquerda (−110% → 0); a que sai vai para a direita (0 → 110%).
     */
    mostrar(e) {
      const tam = `${window.innerWidth}x${window.innerHeight}`;
      if (tam !== ultimoTam) { ultimoTam = tam; for (const f of folhas) f.tam = null; }
      for (const t of [0, 1]) {
        const f = folhas[t];
        if (e.time === t) aplicar(f, true, -(1 - entrada(e.entrando)), e.tau);
        else if (e.saiTime === t) aplicar(f, true, entrada(e.saindo), null);
        else aplicar(f, false);
        f.s.classList.toggle('cheia', e.cheia === t);
      }
      estado.visivel = e.time != null; estado.time = e.time; estado.cheia = e.cheia;
    },
    esconder() {
      for (const f of folhas) aplicar(f, false);
      estado.visivel = false; estado.time = null; estado.cheia = null;
    },
    /** Cartas da folha do time t (testes): [{id, vaga, num, nome, pos, rect, fonteMin, cortado}]. */
    cartas(t) {
      return folhas[t].cartas.map(d => {
        const r = d.getBoundingClientRect();
        const fonte = Math.min(...[...d.children].filter(c => getComputedStyle(c).display !== 'none').map(c => parseFloat(getComputedStyle(c).fontSize)));
        const nome = d.querySelector('.pj-nome');
        return {
          id: +d.dataset.id, vaga: d.dataset.vaga, num: d.querySelector('.pj-num').textContent, nome: nome.textContent, pos: d.querySelector('.pj-pos').textContent,
          rect: { x: r.left, y: r.top, w: r.width, h: r.height }, fonteMin: fonte, cortado: nome.scrollWidth > nome.clientWidth + 1,
        };
      });
    },
    /** A folha do time t (testes: o retângulo da coluna e do campo). */
    folha(t) { return folhas[t].s; },
    /**
     * O campo da folha t (testes, só leitura): o retângulo na tela, o viewBox das linhas, a largura desenhada (m) e a conta
     * (carta, letras, linha da posição, inset), ou null antes do 1º layout.
     */
    campo(t) {
      const f = folhas[t], T = f.conta;
      if (!T) return null;
      const r = f.campo.getBoundingClientRect();
      return {
        x: r.left, y: r.top, w: r.width, h: r.height, viewBox: f.linhas.getAttribute('viewBox'), largura: T.largura,
        cw: T.cw, ch: T.ch, fonteNome: T.fonteNome, fontePos: T.fontePos, comPos: T.comPos, inset: T.inset, fora: T.fora, teto: T.teto,
      };
    },
  };
}
