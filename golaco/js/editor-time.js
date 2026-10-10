// GOLAÇO — tela "Editar time" (DOM; Etapa 3). Sobreposição aberta pela pausa da partida, no estilo
// do "Gerenciar equipe" do EA FC: abas Escalação (campinho com os 11 + reservas; tocar em dois
// troca), Formação (6 formações com o encaixe automático) e Táticas (mentalidade, pressão, largura
// e altura da linha, com a prévia desenhada pela MESMA posicaoTatica da IA). Especificação: tela
// "Editar time" §2–§8 (PESQUISA-ETAPA3.md §11).
//
// A tela NUNCA escreve no mundo: ela mexe num rascunho (escalacao.js, puro) e, no PRONTO (‹, Esc ou o
// botão), entrega a EDIÇÃO {tipo: 'editarTime', ...} para o main.js pôr na fila do próximo passo
// (aoPronto(ed | null)). As regras (dois toques, validar, desfazer) são as de escalacao.js — a tela
// só desenha o resultado. O "estado do jogo" para o Desfazer tudo e para saber se houve mudança é o
// time no mundo (com as substituições pendentes), não a edição que está na fila.
//
// Entrada: toque/clique (o click só sai se o dedo não arrastou: rolar a lista não escolhe ninguém),
// teclado (Tab entre as regiões, setas dentro delas, Q/E trocam de aba, Enter/Espaço escolhem,
// Backspace desfaz, Esc desmarca ou aplica) e o Start do controle (main.js chama voltar()). Com o
// editor aberto, NENHUMA tecla chega ao jogo (o teclado é lido na captura, antes da entrada).
// Layout: PC (altura ≥ 560 e largura ≥ 900), celular deitado (altura < 560) e em pé; as cartas do
// campinho são posicionadas pela fila/coluna da vaga (tela §5) e recalculadas a cada mudança de tamanho.

import * as ESC from './escalacao.js';
import { ELENCOS, POSICOES, fichaDe, atributosDe, notaNaPosicao, encaixeNaVaga, numerosCarta, notaTime, estrelas } from './elenco.js';
import { FORMACOES, ORDEM_FORMACOES } from './formacoes.js';
import { posicaoTatica } from './tatica.js';
import { PARTIDA, TATICA, CAMPO } from './config.js';

const ABAS = ['escalacao', 'formacao', 'taticas'];
const NOME_ABA = { escalacao: 'Escalação', formacao: 'Formação', taticas: 'Táticas' };
// ordem das reservas (tela §3.1): posição e depois número
const ORDEM_POS = ['GOL', 'ZAG', 'LD', 'LE', 'ADD', 'ADE', 'VOL', 'MC', 'MEI', 'MD', 'ME', 'PD', 'PE', 'SA', 'ATA'];
const ALTURA_LINHA = TATICA?.linhaAltura ?? [26, 32.5, 40];

// Os 4 controles da tática (tela §7.5): níveis, rótulos e textos curtos
const CONTROLES = [
  {
    chave: 'mentalidade', nome: 'Mentalidade', min: -2, max: 2, menos: 'Menos ofensiva', mais: 'Mais ofensiva',
    niveis: {
      '-2': ['Ultradefensiva', 'Todos atrás da bola; contra-ataque com 2.'],
      '-1': ['Defensiva', 'Bloco baixo; laterais seguram a posição.'],
      0: ['Equilibrada', 'Ataca e defende com o time compacto.'],
      1: ['Ofensiva', 'Time sobe; um lateral apoia; 3–4 na área.'],
      2: ['Ultraofensiva', 'Tudo no ataque; 5 na área; risco atrás.'],
    },
  },
  {
    chave: 'pressao', nome: 'Pressão', min: 0, max: 2, menos: 'Menos pressão', mais: 'Mais pressão',
    niveis: {
      0: ['Baixa', 'Espera no bloco; só aperta perto da área.'],
      1: ['Média', 'Aperta nos gatilhos: toque longo, passe para trás, de costas.'],
      2: ['Alta', 'Aperta sempre e logo depois de perder a bola.'],
    },
  },
  {
    chave: 'largura', nome: 'Largura', min: 0, max: 2, menos: 'Mais estreita', mais: 'Mais aberta',
    niveis: {
      0: ['Estreita', 'Fecha o meio; deixa os lados.'],
      1: ['Normal', 'Ocupa os lados sem abrir o meio.'],
      2: ['Aberta', 'Usa as pontas; abre espaço no meio.'],
    },
  },
  {
    chave: 'linha', nome: 'Altura da linha', min: 0, max: 2, menos: 'Linha mais baixa', mais: 'Linha mais alta',
    niveis: {
      0: ['Baixa', `Linha a ~${Math.round(ALTURA_LINHA[0])} m do gol: protege as costas.`],
      1: ['Média', `Linha a ~${Math.round(ALTURA_LINHA[1])} m do gol.`],
      2: ['Alta', `Linha a ~${Math.round(ALTURA_LINHA[2])} m do gol: encurta o campo; risco nas costas.`],
    },
  },
];

// Ícones (SVG em linha, currentColor; nada de emoji)
const SVG = {
  voltar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  entra: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10.5V2M2.5 5.2 6 1.7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sai: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5V10M2.5 6.8 6 10.3l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  estrela: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.6 9.4l6.5-.8z" fill="currentColor"/></svg>',
};

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const altura = cm => `${(cm / 100).toFixed(2).replace('.', ',')} m`;
const nomePos = p => (POSICOES[p]?.nome ?? p).toLowerCase();

/** Modo da tela pelo tamanho da janela (tela §5): 'pc' | 'deitado' | 'empe'. */
export function modoDaTela(w, h) {
  if (h >= 560 && w >= 900) return 'pc';
  if (h < 560 && w > h) return 'deitado';
  return 'empe';
}

/**
 * Posição (px, centro) de cada vaga no campinho de largura W × altura H para cartas cw × ch
 * (tela §5): deitado/PC na horizontal (gol à esquerda; col positivo embaixo = lado direito do time);
 * em pé na vertical (gol embaixo; col positivo à direita). Pura (o teste de layout pode chamar).
 */
export function posicaoNaTela(vaga, W, H, cw, ch, vertical) {
  const Wc = W - 12, Hc = H - 12;
  if (!vertical) return { x: 6 + cw / 2 + vaga.fila * (Wc - cw) / 4, y: 6 + ch / 2 + (vaga.col + 2) * (Hc - ch) / 4 };
  return { x: 6 + cw / 2 + (vaga.col + 2) * (Wc - cw) / 4, y: Hc + 6 - ch / 2 - vaga.fila * (Hc - ch) / 4 };
}

/** Tamanho das cartas do campinho W × H (tela §5): nada encosta (passo ≥ carta + 6 px de folga). */
export function tamanhoCarta(modo, W, H) {
  const Wc = W - 12, Hc = H - 12;
  const lim = modo === 'pc' ? [104, 64] : modo === 'deitado' ? [76, 48] : [96, 64];
  const minH = modo === 'empe' ? 52 : 48;
  const cw = Math.max(56, Math.min(lim[0], Math.floor((Wc - 24) / 5), modo === 'empe' ? Math.floor((W - 44) / 5) : Infinity));
  const ch = Math.max(48, Math.min(lim[1], Math.max(minH, Math.floor((Hc - 24) / 5))));
  return { cw, ch };
}

/**
 * Cria a tela. opc = {raiz (o #editar-time), aoPronto(ed | null), aoFechar()}.
 * Devolve {abrir(snapshot), voltar(), esc(), fechar(), aberto, rascunho, aba}.
 * snapshot = {time: cópia de m.times[t], fila: edição na fila | null, timeId: t}.
 */
export function criarEditorTime(opc) {
  const raiz = opc.raiz;
  const st = {
    aberto: false, montado: false, aba: 'escalacao', modo: 'deitado', rasc: null, timeEstado: null, timeId: 0,
    info: null, hover: null, fase: 'sem', roving: { campo: null, reserva: null, forma: null }, ultimoFoco: null,
  };
  const el = {};
  const cartasCampo = new Map();   // vagaId → button
  const cartasReserva = new Map(); // id → button
  let formacaoDesenhada = null;
  let observador = null;

  // ------------------------------------------------------------------------------- montagem
  function montar() {
    if (st.montado) return;
    st.montado = true;
    const abas = ABAS.map(a => `<button type="button" class="ed-aba" role="tab" id="ed-aba-${a}" data-aba="${a}" aria-controls="ed-painel" aria-selected="false" tabindex="-1">${NOME_ABA[a]}</button>`).join('');
    const forms = ORDEM_FORMACOES.map(f => `<button type="button" class="ed-forma" data-formacao="${f}" aria-pressed="false" tabindex="-1">${miniDiagrama(f)}<span class="ed-forma-nome">${f}</span></button>`).join('');
    const passos = CONTROLES.map(c => `
      <div class="ed-passo" role="group" aria-labelledby="ed-passo-${c.chave}" data-grupo="${c.chave}">
        <span class="ed-passo-nome" id="ed-passo-${c.chave}">${c.nome}</span>
        <div class="ed-passo-linha">
          <button type="button" class="ed-passo-bt" data-tatica="${c.chave}" data-passo="-1" aria-label="${esc(c.menos)}">${SVG.menos}</button>
          <output class="ed-passo-nivel" aria-live="polite" data-nivel="${c.chave}"></output>
          <button type="button" class="ed-passo-bt" data-tatica="${c.chave}" data-passo="+1" aria-label="${esc(c.mais)}">${SVG.mais}</button>
        </div>
        <p class="ed-passo-desc"><span class="ed-pontos" aria-hidden="true" data-pontos="${c.chave}"></span><span data-desc="${c.chave}"></span></p>
      </div>`).join('');
    raiz.innerHTML = `
      <div class="ed-janela">
        <header class="ed-topo">
          <button type="button" class="ed-voltar" data-ed="voltar" aria-label="Voltar (aplica as mudanças)">${SVG.voltar}</button>
          <h2 class="ed-titulo" id="ed-titulo">Editar time</h2>
          <div class="ed-abas" role="tablist" aria-label="Editar time">${abas}</div>
          <div class="ed-nota" data-ed-nota></div>
        </header>
        <div class="ed-corpo" id="ed-painel" role="tabpanel" aria-labelledby="ed-aba-escalacao">
          <section class="ed-principal">
            <div class="campinho" data-ed-campinho>
              <svg class="campinho-linhas" aria-hidden="true" preserveAspectRatio="none"></svg>
              <span class="campinho-rotulo" aria-hidden="true"></span>
            </div>
            <div class="ed-passos">${passos}</div>
          </section>
          <section class="ed-coluna">
            <div class="ed-info" aria-live="polite" data-ed-info></div>
            <div class="ed-rotulo" data-ed-rotulo></div>
            <div class="ed-lista" data-ed-lista>
              <div class="ed-reservas" role="group" aria-label="Reservas"></div>
              <div class="ed-forms" role="group" aria-label="Formações">${forms}</div>
              <div class="ed-previa">
                <div class="ed-fases" role="group" aria-label="Prévia">
                  <button type="button" class="ed-seg" data-previa="sem" aria-pressed="true">Sem a bola</button>
                  <button type="button" class="ed-seg" data-previa="com" aria-pressed="false">Com a bola</button>
                </div>
                <canvas class="ed-canvas" aria-hidden="true"></canvas>
              </div>
            </div>
          </section>
        </div>
        <footer class="ed-acoes">
          <button type="button" class="ed-btn" data-ed="desfazer-tudo">Desfazer tudo</button>
          <button type="button" class="ed-btn ed-primario" data-ed="pronto">Pronto</button>
        </footer>
      </div>`;
    el.janela = raiz.querySelector('.ed-janela');
    el.corpo = raiz.querySelector('.ed-corpo');
    el.nota = raiz.querySelector('[data-ed-nota]');
    el.campinho = raiz.querySelector('[data-ed-campinho]');
    el.linhas = raiz.querySelector('.campinho-linhas');
    el.rotuloCampo = raiz.querySelector('.campinho-rotulo');
    el.info = raiz.querySelector('[data-ed-info]');
    el.rotulo = raiz.querySelector('[data-ed-rotulo]');
    el.lista = raiz.querySelector('[data-ed-lista]');
    el.reservas = raiz.querySelector('.ed-reservas');
    el.forms = raiz.querySelector('.ed-forms');
    el.canvas = raiz.querySelector('.ed-canvas');
    el.abas = [...raiz.querySelectorAll('[data-aba]')];
    raiz.addEventListener('click', aoClicar);
    raiz.addEventListener('pointerover', aoPassar);
    raiz.addEventListener('pointerout', aoSair);
    raiz.addEventListener('focusin', aoFocar);
  }

  /** Minidiagrama de 11 pontos da formação (SVG pela fila/coluna das vagas). */
  function miniDiagrama(f) {
    const pts = FORMACOES[f].vagas.map(v => {
      const x = 4 + v.fila * 9, y = 14 + v.col * 5.2;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.1"/>`;
    }).join('');
    return `<svg class="ed-forma-mini" viewBox="0 0 44 28" aria-hidden="true">${pts}</svg>`;
  }

  // ------------------------------------------------------------------------------- dados do rascunho
  const R = () => st.rasc;
  const forma = () => FORMACOES[R().formacao];
  const vagaDe = id => { for (const k in R().vagas) if (R().vagas[k] === id) return k; return null; };
  const parDe = id => R().substituicoes.find(s => s.sai === id || s.entra === id) ?? null;
  const camisa = id => fichaDe(id)?.camisa ?? String(id);
  /** Situação do jogador no rascunho: titular | reserva | sai | saiu (tela §3.1). */
  function situacao(id) {
    if (R().saiu.includes(id)) return 'saiu';
    if (vagaDe(id) != null) return 'titular';
    const p = parDe(id);
    if (p && p.sai === id) return 'sai';
    return 'reserva';
  }
  function notaNaVaga(id, pos) { const j = fichaDe(id); return j ? notaNaPosicao(atributosDe(j), pos) : 0; }
  function notaNatural(id) { const j = fichaDe(id); return j ? notaNaPosicao(atributosDe(j), j.pos) : 0; }
  function substContagem() {
    const r = R();
    return `Subst. ${r.subs.feitas + r.substituicoes.length}/${PARTIDA.subsMax} · paradas ${r.subs.paradas}/${PARTIDA.paradasMax}`;
  }

  // ------------------------------------------------------------------------------- desenho
  function render() {
    if (!st.montado || !st.rasc) return;
    raiz.classList.remove('ed-aba-escalacao', 'ed-aba-formacao', 'ed-aba-taticas');
    raiz.classList.add('ed-aba-' + st.aba);
    raiz.classList.toggle('tem-escolha', R().escolhido != null);
    for (const b of el.abas) {
      const sel = b.dataset.aba === st.aba;
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
    }
    el.corpo.setAttribute('aria-labelledby', `ed-aba-${st.aba}`);
    renderNota();
    renderCampo();
    renderReservas();
    renderFormas();
    renderPassos();
    renderInfo();
    layout();
    desenharPrevia();
  }

  function estrelasHtml(n) {
    let h = '';
    for (let i = 0; i < 5; i++) {
      const f = Math.max(0, Math.min(1, n - i));
      h += `<span class="ed-estrela">${SVG.estrela}<span class="ed-estrela-cheia" style="width:${f * 100}%">${SVG.estrela}</span></span>`;
    }
    return h;
  }
  function renderNota() {
    const r = R();
    const agora = notaTime(r.vagas, forma());
    const antes = notaTime(r.original.vagas, FORMACOES[r.original.formacao]);
    const est = estrelas(agora.geral);
    const muda = agora.geral !== antes.geral;
    el.nota.innerHTML = `<span class="ed-estrelas" aria-hidden="true">${estrelasHtml(est)}</span>`
      + `<b class="ed-nota-num">${muda ? `<span class="ed-nota-antes">${antes.geral}</span><svg class="ed-seta" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8M7 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}${agora.geral}</b>`
      + `<span class="ed-nota-linhas">ATA ${agora.ata} · MEI ${agora.mei} · DEF ${agora.def}</span>`;
    el.nota.setAttribute('aria-label', `Nota do time ${agora.geral}${muda ? ` (antes ${antes.geral})` : ''}, ${String(est).replace('.', ',')} estrelas`);
    el.nota.setAttribute('role', 'img');
  }

  function textoCarta(id, posVaga, comVaga) {
    const j = fichaDe(id);
    if (!j) return '';
    const nota = comVaga ? notaNaVaga(id, posVaga) : notaNatural(id);
    const pos = comVaga ? posVaga : j.pos;
    const enc = comVaga ? encaixeNaVaga(j, posVaga) : 'natural';
    const encTxt = enc === 'natural' ? 'na posição dele' : enc === 'alternativa' ? 'posição alternativa' : 'fora de posição';
    return { nota, pos, enc, aria: `${j.nome}, número ${j.num}, ${nomePos(j.pos)}${comVaga ? `, na vaga ${posVaga}` : ''}, nota ${nota}${comVaga ? `, ${encTxt}` : ''}` };
  }

  /** Conteúdo de uma carta (campinho ou reservas). */
  function preencher(bt, id, posVaga, noCampo) {
    const j = fichaDe(id);
    const r = R();
    const t = textoCarta(id, posVaga, noCampo);
    const sit = situacao(id);
    const par = parDe(id);
    const entra = !!par && par.entra === id && sit === 'titular';
    const sai = sit === 'sai';
    const saiu = sit === 'saiu';
    const muitoFora = noCampo && t.enc === 'fora' && t.nota <= notaNatural(id) - 10;
    bt.dataset.jogador = String(id);
    bt.className = `carta ${noCampo ? 'no-campo' : 'na-lista'} enc-${t.enc}${muitoFora ? ' muito-fora' : ''}${entra ? ' entra' : ''}${sai ? ' sai' : ''}${saiu ? ' saiu' : ''}`;
    bt.setAttribute('aria-pressed', String(r.escolhido === id));
    if (saiu) bt.setAttribute('aria-disabled', 'true'); else bt.removeAttribute('aria-disabled');
    let selo = '';
    if (entra) selo = `<span class="c-selo c-entra" title="Entra na próxima parada">${SVG.entra}</span>`;
    else if (sai) selo = `<span class="c-selo c-sai" title="Sai na próxima parada">${SVG.sai}</span>`;
    else if (t.enc === 'fora') selo = '<span class="c-selo c-fora" title="Fora de posição">!</span>';
    const alt = t.enc === 'alternativa' ? '<span class="c-alt" aria-hidden="true">°</span>' : '';
    bt.innerHTML = `<span class="c-topo"><span class="c-nota">${t.nota}${alt}</span><span class="c-dir">${selo}<span class="c-pos">${t.pos}</span></span></span>`
      + `<span class="c-base"><span class="c-nome">${esc(j.camisa)}</span><span class="c-num">${j.num}</span></span>`;
    let aria = t.aria;
    if (entra) aria += `, entra no lugar de ${camisa(par.sai)} na próxima parada`;
    if (sai) aria += `, sai na próxima parada (entra ${camisa(par.entra)})`;
    if (saiu) aria += ', já substituído';
    else aria += r.escolhido === id ? '. Escolhido: toque em outro para trocar.' : '. Toque para escolher.';
    bt.setAttribute('aria-label', aria);
  }

  function renderCampo() {
    const f = forma();
    if (formacaoDesenhada !== f.id) {
      for (const bt of cartasCampo.values()) bt.remove();
      cartasCampo.clear();
      for (const v of f.vagas) {
        const bt = document.createElement('button');
        bt.type = 'button';
        bt.dataset.vaga = v.id;
        bt.tabIndex = -1;
        el.campinho.appendChild(bt);
        cartasCampo.set(v.id, bt);
      }
      formacaoDesenhada = f.id;
    }
    // a carta que recebe o Tab (as setas andam entre as outras)
    if (!cartasCampo.has(st.roving.campo)) st.roving.campo = f.vagas[0].id;
    for (const v of f.vagas) {
      const bt = cartasCampo.get(v.id);
      preencher(bt, R().vagas[v.id], v.pos, true);
      bt.tabIndex = v.id === st.roving.campo ? 0 : -1;
    }
  }

  /** Reservas na ordem da tela §3.1: disponíveis, "↓ Saem na próxima parada" e "Substituídos". */
  function listaReservas() {
    const r = R();
    const todos = ELENCOS[r.elenco].jogadores;
    const ordem = (a, b) => (ORDEM_POS.indexOf(a.pos) - ORDEM_POS.indexOf(b.pos)) || (a.num - b.num);
    const disp = [], saem = [], sairam = [];
    for (const j of todos) {
      const s = situacao(j.id);
      if (s === 'reserva') disp.push(j); else if (s === 'sai') saem.push(j); else if (s === 'saiu') sairam.push(j);
    }
    return { disp: disp.sort(ordem), saem: saem.sort(ordem), sairam: sairam.sort(ordem) };
  }
  function renderReservas() {
    const { disp, saem, sairam } = listaReservas();
    const ids = [...disp, ...saem, ...sairam].map(j => j.id);
    // reaproveita os botões (o foco não se perde ao redesenhar)
    for (const [id, bt] of cartasReserva) if (!ids.includes(id)) { bt.remove(); cartasReserva.delete(id); }
    const frag = [];
    const titulo = (txt, cls) => { const d = document.createElement('div'); d.className = 'ed-grupo ' + cls; d.textContent = txt; return d; };
    for (const j of disp) frag.push(cartaReserva(j.id));
    if (saem.length) { frag.push(titulo('Saem na próxima parada', 'ed-grupo-sai')); for (const j of saem) frag.push(cartaReserva(j.id)); }
    if (sairam.length) { frag.push(titulo('Substituídos', 'ed-grupo-saiu')); for (const j of sairam) frag.push(cartaReserva(j.id)); }
    el.reservas.replaceChildren(...frag);
    if (!cartasReserva.has(st.roving.reserva)) st.roving.reserva = ids[0] ?? null;
    for (const [id, bt] of cartasReserva) bt.tabIndex = id === st.roving.reserva ? 0 : -1;
    st.nReservas = disp.length;
  }
  function cartaReserva(id) {
    let bt = cartasReserva.get(id);
    if (!bt) { bt = document.createElement('button'); bt.type = 'button'; cartasReserva.set(id, bt); }
    preencher(bt, id, null, false);
    return bt;
  }

  function renderFormas() {
    for (const b of el.forms.querySelectorAll('[data-formacao]')) {
      const sel = b.dataset.formacao === R().formacao;
      b.setAttribute('aria-pressed', String(sel));
      b.setAttribute('aria-label', `Formação ${b.dataset.formacao}${sel ? ', escolhida' : ''}`);
    }
    if (!ORDEM_FORMACOES.includes(st.roving.forma)) st.roving.forma = R().formacao;
    for (const b of el.forms.querySelectorAll('[data-formacao]')) b.tabIndex = b.dataset.formacao === st.roving.forma ? 0 : -1;
  }

  function renderPassos() {
    const t = R().tatica;
    for (const c of CONTROLES) {
      const n = t[c.chave];
      const [rot, desc] = c.niveis[n] ?? ['', ''];
      raiz.querySelector(`[data-nivel="${c.chave}"]`).textContent = rot;
      raiz.querySelector(`[data-desc="${c.chave}"]`).textContent = desc;
      let pts = '';
      for (let k = c.min; k <= c.max; k++) pts += `<i class="${k <= n ? 'on' : ''}"></i>`;
      raiz.querySelector(`[data-pontos="${c.chave}"]`).innerHTML = pts;
      const menos = raiz.querySelector(`[data-tatica="${c.chave}"][data-passo="-1"]`);
      const mais = raiz.querySelector(`[data-tatica="${c.chave}"][data-passo="+1"]`);
      menos.disabled = n <= c.min; mais.disabled = n >= c.max;
    }
    for (const b of raiz.querySelectorAll('[data-previa]')) b.setAttribute('aria-pressed', String(b.dataset.previa === st.fase));
  }

  // painel de informação (tela §3.5)
  function renderInfo() {
    const r = R();
    const pc = st.modo === 'pc';
    const toque = pc ? 'Clique' : 'Toque';
    let html = '';
    const linha = (t, cls = '') => `<p class="ed-info-linha ${cls}">${t}</p>`;
    const botao = (ed, txt, extra = '') => `<button type="button" class="ed-btn ed-btn-info" data-ed="${ed}"${extra}>${txt}</button>`;
    if (st.aba === 'formacao') {
      const fora = [];
      for (const v of forma().vagas) {
        const id = r.vagas[v.id];
        const j = fichaDe(id);
        if (j && encaixeNaVaga(j, v.pos) === 'fora') fora.push(`${esc(j.camisa)} como ${v.pos} (${notaNaVaga(id, v.pos)})`);
      }
      html = fora.length
        ? linha(`<b>${r.formacao}</b> · ${fora.length} fora de posição: ${fora.join(', ')}`) + linha('Troque com um reserva na aba Escalação.', 'fraca')
        : linha(`<b>${r.formacao}</b> · ninguém fora de posição`) + linha('Toque numa formação: cada um vai para a vaga em que rende mais.', 'fraca');
    } else if (st.aba === 'taticas') {
      html = linha('A prévia usa a mesma conta da IA: bola no meio do campo.', 'fraca');
    } else if (st.hover) {
      html = linha(st.hover);
    } else {
      const ev = st.info;
      const esc0 = r.escolhido;
      if (esc0 != null) {
        const j = fichaDe(esc0);
        const a = atributosDe(j);
        const vg = vagaDe(esc0);
        const posV = vg ? forma().porId[vg].pos : null;
        html = linha(`<b>${esc(j.camisa)}</b> · ${j.num} · ${j.pos} · pé ${j.pe} · ${altura(a.altura)}`);
        html += posV ? linha(`Nesta vaga (${posV}): <b>${notaNaVaga(esc0, posV)}</b> · como ${j.pos}: ${notaNatural(esc0)}`)
          : linha(`Nota como ${j.pos}: <b>${notaNatural(esc0)}</b> · ${toque.toLowerCase()} num titular para substituir`);
        if (pc) {
          const n = j.pos === 'GOL'
            ? { REF: a.reflexo, MER: a.mergulho, POS: a.posicionamento, ELA: a.impulsao, PAS: a.passeLongo, RIT: Math.round(0.55 * a.velocidade + 0.45 * a.aceleracao) }
            : numerosCarta(a);
          html += `<p class="ed-info-linha ed-numeros">${Object.entries(n).map(([k, v]) => `<span>${k === 'FIS' ? 'FÍS' : k} <b>${v}</b></span>`).join('')}</p>`;
        }
      } else if (ev && ev.tipo === 'trocou') {
        html = linha(`${esc(camisa(ev.a))} ↔ ${esc(camisa(ev.b))} trocaram de vaga${ev.gol ? ' (com o goleiro: vale na próxima parada)' : ''}.`) + botao('desfazer', 'Desfazer');
      } else if (ev && ev.tipo === 'substituiu') {
        html = linha(`Sai ${esc(camisa(ev.a))}, entra ${esc(camisa(ev.b))} (na próxima parada).`) + botao('desfazer', 'Desfazer');
      } else if (ev && ev.tipo === 'recusou') {
        html = linha(esc(ev.texto ?? textoRecusa(ev)), 'alerta');
      } else if (ev && ev.tipo === 'pendente') {
        html = linha(`${esc(camisa(ev.b))} entra no lugar de ${esc(camisa(ev.a))} na próxima parada.`) + botao('cancelar-sub', 'Cancelar substituição', ` data-id="${ev.a}"`);
      } else if (ev && ev.tipo === 'invalida') {
        html = linha(`Não dá para aplicar: ${esc(ev.texto)}`, 'alerta');
      } else if (ev && ev.tipo === 'tudo') {
        html = linha('Tudo como está no jogo.');
      } else {
        html = linha(`${toque} em um jogador e depois em outro para trocar. Titular com reserva = substituição, que vale na próxima parada.`);
        if (pc) html += linha('Setas · Enter escolhe · Esc volta', 'fraca');
      }
      html += linha(substContagem(), 'ed-contagem');
    }
    el.info.innerHTML = html;
    // rótulo da lista
    if (st.aba === 'escalacao') el.rotulo.textContent = `Reservas (${st.nReservas ?? 0})`;
    else if (st.aba === 'formacao') el.rotulo.textContent = 'Formações';
    else el.rotulo.textContent = 'Prévia';
  }
  function textoRecusa(ev) {
    if (ev.motivo === 'saiu') return `${camisa(ev.a)} já saiu e não pode voltar`;
    if (ev.motivo === 'limite') return `Limite de ${PARTIDA.subsMax} substituições`;
    if (ev.motivo === 'paradas') return `Sem paradas para substituir (${PARTIDA.paradasMax}/${PARTIDA.paradasMax})`;
    return 'Esta troca não pode ser feita';
  }

  // ------------------------------------------------------------------------------- layout
  function atualizarModoTela() {
    const m = modoDaTela(window.innerWidth, window.innerHeight);
    st.modo = m;
    raiz.classList.toggle('ed-pc', m === 'pc');
    raiz.classList.toggle('ed-deitado', m === 'deitado');
    raiz.classList.toggle('ed-empe', m === 'empe');
  }
  function linhasCampo(vertical) {
    // campo de 105 × 68 (deitado: gol à esquerda; em pé: gol embaixo), traço fino que não escala
    const L = CAMPO.meioX * 2, A = CAMPO.meioZ * 2;
    const ar = 16.5, al = 40.32, pr = 5.5, pl = 18.32, rc = 9.15;
    if (!vertical) {
      el.linhas.setAttribute('viewBox', `0 0 ${L} ${A}`);
      el.linhas.innerHTML = `<rect x="0.5" y="0.5" width="${L - 1}" height="${A - 1}"/><line x1="${L / 2}" y1="0.5" x2="${L / 2}" y2="${A - 0.5}"/>`
        + `<ellipse cx="${L / 2}" cy="${A / 2}" rx="${rc}" ry="${rc}"/>`
        + `<rect x="0.5" y="${(A - al) / 2}" width="${ar}" height="${al}"/><rect x="${L - ar - 0.5}" y="${(A - al) / 2}" width="${ar}" height="${al}"/>`
        + `<rect x="0.5" y="${(A - pl) / 2}" width="${pr}" height="${pl}"/><rect x="${L - pr - 0.5}" y="${(A - pl) / 2}" width="${pr}" height="${pl}"/>`;
    } else {
      el.linhas.setAttribute('viewBox', `0 0 ${A} ${L}`);
      el.linhas.innerHTML = `<rect x="0.5" y="0.5" width="${A - 1}" height="${L - 1}"/><line x1="0.5" y1="${L / 2}" x2="${A - 0.5}" y2="${L / 2}"/>`
        + `<ellipse cx="${A / 2}" cy="${L / 2}" rx="${rc}" ry="${rc}"/>`
        + `<rect x="${(A - al) / 2}" y="0.5" width="${al}" height="${ar}"/><rect x="${(A - al) / 2}" y="${L - ar - 0.5}" width="${al}" height="${ar}"/>`
        + `<rect x="${(A - pl) / 2}" y="0.5" width="${pl}" height="${pr}"/><rect x="${(A - pl) / 2}" y="${L - pr - 0.5}" width="${pl}" height="${pr}"/>`;
    }
  }
  function layout() {
    if (!st.aberto) return;
    raiz.classList.toggle('ed-estreito', (el.janela.clientWidth || window.innerWidth) < 700);
    const W = el.campinho.clientWidth, H = el.campinho.clientHeight;
    if (W > 0 && H > 0) {
      const vertical = st.modo === 'empe';
      if (el.linhas.dataset.vertical !== String(vertical)) { linhasCampo(vertical); el.linhas.dataset.vertical = String(vertical); }
      el.rotuloCampo.textContent = vertical ? '↑ ATAQUE' : 'ATAQUE →';
      const { cw, ch } = tamanhoCarta(st.modo, W, H);
      el.campinho.style.setProperty('--cw', `${cw}px`);
      el.campinho.style.setProperty('--ch', `${ch}px`);
      for (const v of forma().vagas) {
        const bt = cartasCampo.get(v.id);
        const p = posicaoNaTela(v, W, H, cw, ch, vertical);
        const s = bt.style;
        s.left = `${(p.x - cw / 2).toFixed(1)}px`; s.top = `${(p.y - ch / 2).toFixed(1)}px`;
        s.width = `${cw}px`; s.height = `${ch}px`;
      }
    }
    ajustarNomes();
  }
  /**
   * Nome de camisa e nível da tática sempre inteiros: diminui a letra do que não couber (até 8 px no
   * nome da carta e 10 px no nível).
   */
  function ajustarNomes() {
    for (const n of raiz.querySelectorAll('.c-nome, .ed-passo-nivel')) {
      if (n.offsetParent === null) continue;
      n.style.fontSize = '';
      const min = n.classList.contains('c-nome') ? 8 : 10;
      let fs = parseFloat(getComputedStyle(n).fontSize) || 11;
      for (let k = 0; k < 16 && n.scrollWidth > n.clientWidth + 0.5 && fs > min; k++) { fs -= 0.5; n.style.fontSize = `${fs}px`; }
    }
  }

  // prévia: os 11 pontos pela MESMA posicaoTatica da IA, bola no centro (tela §3.3 e §7.5)
  const _p = { x: 0, z: 0 };
  function desenharPrevia() {
    if (!st.aberto || st.aba !== 'taticas') return;
    const c = el.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (w < 4 || h < 4) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const vertical = st.modo === 'empe';
    const L = CAMPO.meioX * 2, A = CAMPO.meioZ * 2;
    const m = 8;
    // escala uniforme (o campo mantém a proporção) e centralizado
    const esc0 = vertical ? Math.min((w - 2 * m) / A, (h - 2 * m) / L) : Math.min((w - 2 * m) / L, (h - 2 * m) / A);
    const cw = (vertical ? A : L) * esc0, chh = (vertical ? L : A) * esc0;
    const ox = (w - cw) / 2, oy = (h - chh) / 2;
    // mundo (x ao longo do campo, z na largura) → tela; o time ataca para +x (direita / para cima)
    const tela = (x, z) => (vertical ? [ox + (z + A / 2) * esc0, oy + (L / 2 - x) * esc0] : [ox + (x + L / 2) * esc0, oy + (z + A / 2) * esc0]);
    g.fillStyle = '#0b2416';
    g.fillRect(ox, oy, cw, chh);
    g.strokeStyle = 'rgba(25, 224, 122, 0.4)';
    g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, cw - 1, chh - 1);
    g.beginPath();
    let [a0, b0] = tela(0, -A / 2), [a1, b1] = tela(0, A / 2);
    g.moveTo(a0, b0); g.lineTo(a1, b1); g.stroke();
    const [cx, cy] = tela(0, 0);
    g.beginPath(); g.arc(cx, cy, 9.15 * esc0, 0, Math.PI * 2); g.stroke();
    for (const lado of [-1, 1]) {
      const [p0x, p0y] = tela(lado * L / 2, -20.16), [p1x, p1y] = tela(lado * (L / 2 - 16.5), 20.16);
      g.strokeRect(Math.min(p0x, p1x), Math.min(p0y, p1y), Math.abs(p1x - p0x), Math.abs(p1y - p0y));
    }
    // linha de defesa (altura) tracejada, para a mudança da tática ficar visível
    const r = R();
    const f = forma();
    const pts = [];
    for (const v of f.vagas) {
      posicaoTatica(r.formacao, v, r.tatica, { x: 0, z: 0 }, st.fase, 1, _p);
      pts.push({ v, x: _p.x, z: _p.z });
    }
    const def = pts.filter(p => p.v.grupo === 'def');
    if (def.length) {
      const xl = Math.min(...def.map(p => p.x));
      g.setLineDash([4, 4]);
      g.strokeStyle = 'rgba(255, 181, 71, 0.55)';
      g.beginPath();
      [a0, b0] = tela(xl, -A / 2); [a1, b1] = tela(xl, A / 2);
      g.moveTo(a0, b0); g.lineTo(a1, b1); g.stroke();
      g.setLineDash([]);
    }
    const raio = Math.max(3.5, Math.min(7, esc0 * 1.3));
    for (const p of pts) {
      const [x, y] = tela(p.x, p.z);
      g.fillStyle = p.v.pos === 'GOL' ? '#c6ff3d' : '#19e07a';
      g.beginPath(); g.arc(x, y, raio, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#07090a'; g.lineWidth = 1.2; g.stroke();
    }
    // bola no centro
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(cx, cy, raio * 0.7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#07090a'; g.lineWidth = 1; g.stroke();
  }

  // ------------------------------------------------------------------------------- ações
  function mudar(r, info = undefined) {
    st.rasc = r;
    if (info !== undefined) st.info = info;
    st.hover = null;
    render();
  }
  function tocar(id) {
    const out = ESC.tocar(R(), id);
    const r = out?.rasc ?? R();
    const ev = out?.evento ?? null;
    mudar(r, ev && (ev.tipo === 'escolheu' || ev.tipo === 'desmarcou') ? null : ev ?? st.info);
    if (ev && ev.tipo === 'recusou') tremer(ev.a);
  }
  function tremer(id) {
    for (const bt of [...cartasCampo.values(), ...cartasReserva.values()]) {
      if (bt.dataset.jogador !== String(id)) continue;
      bt.classList.remove('treme'); void bt.offsetWidth; bt.classList.add('treme');
      setTimeout(() => bt.classList.remove('treme'), 200);
    }
  }
  function desmarcar() {
    if (R().escolhido == null) return false;
    mudar({ ...R(), escolhido: null }, null);
    return true;
  }
  function desfazer() {
    const antes = R();
    const r = ESC.desfazer(antes);
    if (r === antes) return;
    mudar(r, null);
  }
  function cancelarSub(id) {
    let r;
    if (typeof ESC.cancelarSubstituicao === 'function') r = ESC.cancelarSubstituicao(R(), id);
    else {
      // sem a função pronta na lógica: quem sairia volta para a vaga de quem entraria
      const par = parDe(id);
      if (!par) return;
      const vg = vagaDe(par.entra);
      r = { ...R(), vagas: { ...R().vagas }, substituicoes: R().substituicoes.filter(s => s !== par), escolhido: null, historico: [...R().historico] };
      if (vg) r.vagas[vg] = par.sai;
    }
    mudar(r, null);
  }
  function trocarAba(a, focar = false) {
    if (!ABAS.includes(a)) return;
    st.aba = a;
    st.hover = null;
    if (a !== 'escalacao') st.info = null;
    render();
    if (focar) raiz.querySelector(`[data-aba="${a}"]`)?.focus({ preventScroll: true });
  }
  function passoTatica(chave, d) {
    const c = CONTROLES.find(x => x.chave === chave);
    if (!c) return;
    const n = Math.max(c.min, Math.min(c.max, R().tatica[chave] + d));
    if (n === R().tatica[chave]) return;
    mudar(ESC.mudarTatica(R(), chave, n));
  }
  function pronto() {
    const ed = ESC.edicaoDe(R());
    if (ed) {
      const v = ESC.validarEdicao(st.timeEstado, ed, st.timeEstado.elenco);
      if (!v || !v.ok) {
        st.info = { tipo: 'invalida', texto: v?.motivo ?? 'edição inválida' };
        if (st.aba !== 'escalacao') st.aba = 'escalacao';
        render();
        return false;
      }
    }
    fechar();
    opc.aoPronto?.(ed);
    return true;
  }

  function aoClicar(e) {
    const alvo = e.target.closest('[data-aba], [data-jogador], [data-formacao], [data-tatica], [data-previa], [data-ed]');
    if (!alvo) {
      // área vazia do campinho: desmarca
      if (e.target.closest('[data-ed-campinho]')) desmarcar();
      return;
    }
    if (alvo.dataset.aba) { trocarAba(alvo.dataset.aba); return; }
    if (alvo.dataset.jogador) {
      const id = +alvo.dataset.jogador;
      if (alvo.closest('.ed-reservas')) st.roving.reserva = id; else st.roving.campo = alvo.dataset.vaga;
      tocar(id);
      return;
    }
    if (alvo.dataset.formacao) { st.roving.forma = alvo.dataset.formacao; mudar(ESC.mudarFormacao(R(), alvo.dataset.formacao), null); return; }
    if (alvo.dataset.tatica) { passoTatica(alvo.dataset.tatica, +alvo.dataset.passo); return; }
    if (alvo.dataset.previa) { st.fase = alvo.dataset.previa === 'com' ? 'com' : 'sem'; renderPassos(); desenharPrevia(); return; }
    const ed = alvo.dataset.ed;
    if (ed === 'pronto' || ed === 'voltar') pronto();
    else if (ed === 'desfazer-tudo') { mudar(ESC.desfazerTudo(R()), { tipo: 'tudo' }); }
    else if (ed === 'desfazer') { desfazer(); focarRoving('campo'); }
    else if (ed === 'cancelar-sub') { cancelarSub(+alvo.dataset.id); focarRoving('campo'); }
  }

  // mouse: com uma carta escolhida, passar por outra mostra a comparação (tela §4.2)
  function aoPassar(e) {
    if (e.pointerType !== 'mouse' || st.aba !== 'escalacao') return;
    const bt = e.target.closest('[data-jogador]');
    const esc0 = R()?.escolhido;
    if (!bt || esc0 == null) return;
    const id = +bt.dataset.jogador;
    if (id === esc0) return;
    const vgE = vagaDe(esc0), vgB = vagaDe(id);
    const j = fichaDe(id), jE = fichaDe(esc0);
    let txt = null;
    if (vgE && vgB) {
      const pE = forma().porId[vgE].pos;
      txt = `${esc(j.camisa)} (${j.pos} ${notaNatural(id)}) → na vaga ${pE}: <b>${notaNaVaga(id, pE)}</b> · ${esc(jE.camisa)} → ${forma().porId[vgB].pos}: <b>${notaNaVaga(esc0, forma().porId[vgB].pos)}</b>`;
    } else if (vgE || vgB) {
      const vg = vgE ?? vgB, quem = vgE ? id : esc0, pos = forma().porId[vg].pos;
      txt = `${esc(fichaDe(quem).camisa)} (${fichaDe(quem).pos} ${notaNatural(quem)}) → na vaga ${pos}: <b>${notaNaVaga(quem, pos)}</b>`;
    }
    if (txt) { st.hover = txt; renderInfo(); }
  }
  function aoSair(e) {
    if (e.pointerType !== 'mouse' || !st.hover) return;
    if (e.relatedTarget && e.relatedTarget.closest?.('[data-jogador]') === e.target.closest('[data-jogador]')) return;
    st.hover = null;
    renderInfo();
  }
  function aoFocar(e) {
    const t = e.target;
    if (t.matches?.('.no-campo')) st.roving.campo = t.dataset.vaga;
    else if (t.matches?.('.na-lista')) st.roving.reserva = +t.dataset.jogador;
    else if (t.matches?.('[data-formacao]')) st.roving.forma = t.dataset.formacao;
    else return;
    atualizarRoving();
  }
  function atualizarRoving() {
    for (const [vg, bt] of cartasCampo) bt.tabIndex = vg === st.roving.campo ? 0 : -1;
    for (const [id, bt] of cartasReserva) bt.tabIndex = id === st.roving.reserva ? 0 : -1;
    for (const b of el.forms.querySelectorAll('[data-formacao]')) b.tabIndex = b.dataset.formacao === st.roving.forma ? 0 : -1;
  }
  function focarRoving(qual) {
    const bt = qual === 'campo' ? cartasCampo.get(st.roving.campo) : cartasReserva.get(st.roving.reserva);
    if (bt && bt.offsetParent !== null) bt.focus({ preventScroll: false });
  }

  // ------------------------------------------------------------------------------- teclado
  const visivel = e => e && !e.disabled && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden';
  function focaveis() {
    return [...raiz.querySelectorAll('button, [tabindex]')].filter(e => e.tabIndex >= 0 && visivel(e));
  }
  /** Foco preso no diálogo (Tab e Shift+Tab dão a volta). */
  function prenderFoco(e) {
    const f = focaveis();
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  }
  /** Carta mais perto na direção (custo = distância + 2 × desvio lateral; tela §4.3). */
  function vizinhaNaDirecao(atual, lista, dx, dy) {
    const a = atual.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let melhor = null, custo = Infinity;
    for (const b of lista) {
      if (b === atual || !visivel(b)) continue;
      const r = b.getBoundingClientRect();
      const vx = r.left + r.width / 2 - ax, vy = r.top + r.height / 2 - ay;
      const frente = vx * dx + vy * dy;
      if (frente <= 1) continue;
      const lado = Math.abs(vx * dy - vy * dx);
      const c = Math.hypot(vx, vy) + 2 * lado;
      if (c < custo) { custo = c; melhor = b; }
    }
    return melhor;
  }
  function vizinhaNaGrade(atual, lista, grade, dx, dy) {
    const vis = lista.filter(visivel);
    const i = vis.indexOf(atual);
    if (i < 0) return null;
    const cols = Math.max(1, getComputedStyle(grade).gridTemplateColumns.split(' ').filter(Boolean).length);
    const j = dy ? i + dy * cols : i + dx;
    return vis[Math.max(0, Math.min(vis.length - 1, j))] ?? null;
  }
  function setas(e) {
    const k = e.key;
    const dx = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0, dy = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0;
    const at = document.activeElement;
    if (!at || !raiz.contains(at)) return;
    if (at.matches('[role="tab"]')) {
      if (!dx) return;
      e.preventDefault();
      trocarAba(ABAS[(ABAS.indexOf(st.aba) + dx + ABAS.length) % ABAS.length], true);
      return;
    }
    if (at.matches('.no-campo')) {
      e.preventDefault();
      const v = vizinhaNaDirecao(at, [...cartasCampo.values()], dx, dy);
      if (v) v.focus();
      return;
    }
    if (at.matches('.na-lista')) {
      e.preventDefault();
      const v = vizinhaNaGrade(at, [...el.reservas.querySelectorAll('.carta')], el.reservas, dx, dy);
      if (v) { v.focus(); v.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    if (at.matches('[data-formacao]')) {
      e.preventDefault();
      const v = vizinhaNaGrade(at, [...el.forms.querySelectorAll('[data-formacao]')], el.forms, dx, dy);
      if (v) v.focus();
      return;
    }
    const grupo = at.closest('.ed-passo');
    if (grupo && dx) {
      e.preventDefault();
      passoTatica(grupo.dataset.grupo, dx);
      // o botão da ponta fica desabilitado: o foco vai para o outro lado do mesmo controle
      if (at.disabled) grupo.querySelector(`[data-passo="${dx > 0 ? '-1' : '+1'}"]`)?.focus();
      return;
    }
    if (at.matches('[data-previa]') && dx) {
      e.preventDefault();
      st.fase = dx > 0 ? 'com' : 'sem';
      renderPassos(); desenharPrevia();
      raiz.querySelector(`[data-previa="${st.fase}"]`)?.focus();
    }
  }
  function teclado(e) {
    if (!st.aberto) return;
    // nada do teclado chega ao jogo com o editor aberto (J, K, R, M, H, C...)
    e.stopPropagation();
    if (e.type !== 'keydown') return;
    const k = e.key;
    if (k === 'Tab') { prenderFoco(e); return; }
    if (k === 'Escape') { e.preventDefault(); if (!e.repeat) escTecla(); return; }
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      e.preventDefault();
      trocarAba(ABAS[(ABAS.indexOf(st.aba) + (e.code === 'KeyE' ? 1 : -1) + ABAS.length) % ABAS.length], true);
      return;
    }
    if (k === 'Backspace') { e.preventDefault(); desfazer(); focarRoving('campo'); return; }
    if (k.startsWith('Arrow')) { setas(e); return; }
    // Enter e Espaço: o botão focado faz o clique (padrão do navegador); o resto não faz nada
    if (k !== 'Enter' && k !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey && k.length === 1) e.preventDefault();
  }
  function escTecla() { if (!desmarcar()) pronto(); }

  function aoRedimensionar() {
    if (!st.aberto) return;
    atualizarModoTela();
    renderInfo();
    layout();
    desenharPrevia();
  }

  // ------------------------------------------------------------------------------- abrir e fechar
  function abrir(snap) {
    montar();
    st.timeEstado = snap.time;
    st.timeId = snap.timeId ?? 0;
    const r = ESC.rascunhoDe(snap.time, snap.fila ?? null, st.timeId);
    // "estado do jogo" = o time no mundo (com as substituições pendentes): é com ele que se decide se
    // houve mudança e para onde o Desfazer tudo volta (tela §0); a edição na fila só abre a tela
    r.original = ESC.rascunhoDe(snap.time, null, st.timeId).original;
    st.rasc = r;
    st.aba = 'escalacao';
    st.info = null; st.hover = null; st.fase = 'sem';
    st.roving = { campo: null, reserva: null, forma: r.formacao };
    st.ultimoFoco = document.activeElement;
    st.aberto = true;
    atualizarModoTela();
    raiz.hidden = false;
    window.addEventListener('keydown', teclado, true);
    window.addEventListener('keyup', teclado, true);
    window.addEventListener('resize', aoRedimensionar);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', aoRedimensionar);
    if (!observador && typeof ResizeObserver === 'function') observador = new ResizeObserver(() => { if (st.aberto) { layout(); desenharPrevia(); } });
    observador?.observe(el.campinho);
    observador?.observe(el.canvas);
    render();
    raiz.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  }
  function fechar() {
    if (!st.aberto) return;
    st.aberto = false;
    raiz.hidden = true;
    window.removeEventListener('keydown', teclado, true);
    window.removeEventListener('keyup', teclado, true);
    window.removeEventListener('resize', aoRedimensionar);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', aoRedimensionar);
    observador?.disconnect();
    opc.aoFechar?.();
  }

  return {
    abrir,
    /** PRONTO (‹, o botão e o Start do controle): aplica as mudanças e fecha (se forem válidas). */
    voltar: pronto,
    /** Esc: com uma carta escolhida, desmarca; senão, PRONTO. */
    esc: escTecla,
    fechar,
    get aberto() { return st.aberto; },
    get aba() { return st.aba; },
    get modo() { return st.modo; },
    /** Cópia do rascunho (testes). */
    get rascunho() { return st.rasc ? { ...st.rasc, vagas: { ...st.rasc.vagas }, tatica: { ...st.rasc.tatica }, substituicoes: st.rasc.substituicoes.map(s => ({ ...s })) } : null; },
  };
}
