/* ===== views/apresentacoes.js — slides para os trabalhos da escola =====
   1) O MindTrack AI monta a apresentação inteira numa chamada só (plano pago);
      sem plano dá para começar em branco.
   2) O aluno edita cada slide (texto, tipo, falas) e muda o tema.
   3) Apresenta em tela cheia, baixa em PowerPoint (abre no Canva, no Google
      Slides e no PowerPoint) ou salva em PDF pela impressão.
   Tudo fica no aparelho (st().apresentacoes).                                */
import { h, uid, iso, fmtData } from '../util.js';
import { st, set, nomeMateria } from '../store.js';
import { titulo, vazio, toast, confirmar, inp, txtarea, sel, segmento, campo, paywall, liberado } from '../ui.js';
import { opcoesMaterias } from './comum.js';
import { temIA, gerarApresentacao } from '../ai.js';
import { TEMAS, TIPOS_SLIDE, desenharSlide, baixarPowerPoint } from '../apresentacoes-desenho.js';

const lista = () => st().apresentacoes || [];
const achar = (id) => lista().find((a) => a.id === id);
const autor = () => st().perfil?.nome || '';
/** textarea com texto inicial (o value de textarea não vai por atributo) */
const area = (attrs, valor = '') => { const t = txtarea(attrs); t.value = valor; return t; };
function salvarAp(ap) {
  set((s) => {
    s.apresentacoes = s.apresentacoes || [];
    const i = s.apresentacoes.findIndex((x) => x.id === ap.id);
    ap.editadaEm = new Date().toISOString();
    if (i >= 0) s.apresentacoes[i] = ap; else s.apresentacoes.unshift(ap);
  });
}

export function render(el, { id } = {}) {
  if (id) {
    const ap = achar(id);
    if (ap) return editor(el, structuredClone(ap));
  }
  telaInicial(el);
}

/* ==================== lista + criar ==================== */
function telaInicial(el) {
  el.append(titulo('🎤 Apresentações', 'Slides prontos para os trabalhos da escola: edite, apresente e baixe em PowerPoint.'));

  const tema = inp({ placeholder: 'Ex.: Revolução Industrial, ciclo da água, Modernismo no Brasil…', 'aria-label': 'Tema' });
  const materia = sel(opcoesMaterias(), '', { 'aria-label': 'Matéria' });
  let qtd = 8, publico = 'turma', estilo = 'cartaz';
  const detalhes = txtarea({ placeholder: 'O que o professor pediu? (opcional: tópicos obrigatórios, tempo, critérios)', style: { minHeight: '70px' } });
  const porta = liberado('ia_apresentacao');
  const criar = h('button', {
    class: 'btn btn--p', onclick: async () => {
      if (!tema.value.trim()) { tema.focus(); return toast('Escreva o tema da apresentação.', 'bad'); }
      criar.disabled = true; criar.textContent = 'Montando os slides…';
      try {
        const nomeMat = materia.value ? nomeMateria(materia.value) : '';
        const r = await gerarApresentacao({ tema: tema.value.trim(), materia: nomeMat, qtd, publico, detalhes: detalhes.value.trim() });
        const ap = { id: uid('apr'), ...r, materia: nomeMat, autor: autor(), tema: estilo, criadaEm: iso(), origem: 'ia' };
        salvarAp(ap);
        toast(`${ap.slides.length} slides prontos ✨ Confira e edite o que quiser.`, 'good');
        location.hash = `#/apresentacoes/${ap.id}`;
      } catch (e) { toast(e.message, 'bad'); criar.disabled = false; criar.textContent = '✨ Criar com o MindTrack AI'; }
    },
  }, '✨ Criar com o MindTrack AI');
  const emBranco = h('button', {
    class: 'btn', onclick: () => {
      const t = tema.value.trim() || 'Minha apresentação';
      const nomeMat = materia.value ? nomeMateria(materia.value) : '';
      const ap = {
        id: uid('apr'), titulo: t, subtitulo: '', materia: nomeMat, autor: autor(), tema: estilo, criadaEm: iso(), origem: 'manual',
        slides: [
          { tipo: 'capa', titulo: t, texto: '' },
          { tipo: 'topicos', titulo: 'Introdução', topicos: ['Primeiro ponto', 'Segundo ponto', 'Terceiro ponto'], notas: '' },
          { tipo: 'fim', titulo: 'Obrigado!', texto: 'Perguntas?' },
        ],
      };
      salvarAp(ap);
      location.hash = `#/apresentacoes/${ap.id}`;
    },
  }, 'Começar em branco');

  el.append(h('div', { class: 'card apr-nova' },
    h('h3', { class: 'apr-h3' }, 'Nova apresentação'),
    campo('Tema', tema),
    h('div', { class: 'f-row' },
      campo('Matéria', materia),
      campo('Slides', segmento([6, 8, 10].map((n) => ({ v: n, t: String(n) })), qtd, (v) => { qtd = v; }))),
    h('div', { class: 'f-row' },
      campo('Para quem', segmento([{ v: 'turma', t: 'A turma' }, { v: 'professor', t: 'O professor' }], publico, (v) => { publico = v; })),
      campo('Estilo', segmento(Object.entries(TEMAS).map(([v, x]) => ({ v, t: x.nome })), estilo, (v) => { estilo = v; }))),
    campo('Detalhes', detalhes),
    porta.ok && temIA()
      ? h('div', { class: 'flexb' }, criar, emBranco, h('span', { class: 'tiny muted' }, 'Gasta 1 pergunta do seu plano.'))
      : h('div', {},
        h('div', { class: 'flexb mb' }, emBranco,
          h('span', { class: 'tiny muted' }, porta.ok ? 'O MindTrack AI ainda está sendo ligado no servidor.' : 'Montar com a IA é dos planos pagos.')),
        porta.ok ? null : paywall('Apresentação pronta em segundos', 'O MindTrack AI escreve os slides e as falas do seu trabalho — você só revisa, apresenta e baixa em PowerPoint.', porta.precisa))));

  const aps = lista();
  el.append(h('h3', { class: 'apr-h3 mt2' }, `Suas apresentações${aps.length ? ` (${aps.length})` : ''}`));
  if (!aps.length) {
    el.append(vazio('Nenhuma apresentação ainda', 'Crie a primeira aqui em cima. Ela fica salva neste aparelho.'));
    return;
  }
  el.append(h('div', { class: 'apr-grade' }, ...aps.map((ap) => h('div', { class: 'apr-item' },
    h('a', { href: `#/apresentacoes/${ap.id}`, class: 'apr-mini', 'aria-label': `Abrir ${ap.titulo}` }, desenharSlide(ap.slides[0], ap, 0, 0)),
    h('div', { class: 'flexb' },
      h('div', { class: 'grow', style: { minWidth: 0 } },
        h('b', { class: 'apr-nome' }, ap.titulo),
        h('div', { class: 'tiny muted' }, [`${ap.slides.length} slides`, ap.materia, fmtData((ap.editadaEm || ap.criadaEm || iso()).slice(0, 10), { curto: true })].filter(Boolean).join(' · '))),
      h('button', {
        class: 'btn btn--sm btn--d', 'aria-label': 'Apagar',
        onclick: () => confirmar('Apagar a apresentação?', `"${ap.titulo}" sai deste aparelho.`, () => {
          set((s) => { s.apresentacoes = s.apresentacoes.filter((x) => x.id !== ap.id); });
          el.replaceChildren(); telaInicial(el);
        }),
      }, 'Apagar'))))));
}

/* ==================== editor ==================== */
function editor(el, ap) {
  let atual = 0;
  let timer = null;
  const guardar = () => { clearTimeout(timer); timer = setTimeout(() => salvarAp(structuredClone(ap)), 300); };

  const previa = h('div', { class: 'apr-previa' });
  const tiras = h('div', { class: 'apr-tiras', role: 'listbox', 'aria-label': 'Slides' });
  const form = h('div', { class: 'apr-form' });

  function pintarPrevia() { previa.replaceChildren(desenharSlide(ap.slides[atual], ap, atual, ap.slides.length)); }
  function pintarTiras() {
    tiras.replaceChildren(...ap.slides.map((sl, i) => h('button', {
      class: `apr-tira${i === atual ? ' on' : ''}`, role: 'option', 'aria-selected': String(i === atual), 'aria-label': `Slide ${i + 1}: ${sl.titulo}`,
      onclick: () => { atual = i; tudo(); },
    }, desenharSlide(sl, ap, i, 0), h('span', {}, String(i + 1)))),
    h('button', { class: 'apr-tira apr-tira--mais', 'aria-label': 'Novo slide', onclick: () => {
      ap.slides.splice(atual + 1, 0, { tipo: 'topicos', titulo: 'Novo slide', topicos: ['Tópico'], notas: '' });
      atual++; guardar(); tudo();
    } }, '+'));
    tiras.children[atual]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  function pintarForm() {
    const sl = ap.slides[atual];
    const mudou = () => { guardar(); pintarPrevia(); pintarTirasLeve(); };
    const linhas = (arr) => (arr || []).join('\n');
    const deLinhas = (v) => v.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8);
    const campoTexto = (rot, chave) => campo(rot, inp({
      value: sl[chave] || '', oninput: (e) => { sl[chave] = e.target.value; mudou(); },
    }));
    const campoLista = (rot, chave, dica) => campo(rot, area({
      placeholder: dica, style: { minHeight: '96px' },
      oninput: (e) => { sl[chave] = deLinhas(e.target.value); mudou(); },
    }, linhas(sl[chave])));
    const partes = [
      h('div', { class: 'f-row' },
        campo('Tipo do slide', sel(TIPOS_SLIDE, sl.tipo || 'topicos', { onchange: (e) => { sl.tipo = e.target.value; guardar(); tudo(); } })),
        campoTexto('Título', 'titulo')),
    ];
    if (['capa', 'destaque', 'pergunta', 'fim', 'topicos'].includes(sl.tipo || 'topicos')) {
      partes.push(campoTexto(sl.tipo === 'destaque' ? 'A frase de destaque' : sl.tipo === 'topicos' ? 'Frase de apoio (opcional)' : 'Texto', 'texto'));
    }
    if ((sl.tipo || 'topicos') === 'topicos') partes.push(campoLista('Tópicos (um por linha)', 'topicos', 'Um tópico por linha'));
    if (sl.tipo === 'duas_colunas') {
      partes.push(h('div', { class: 'f-row' },
        h('div', {}, campoTexto('Nome da coluna 1', 'rotuloEsquerda'), campoLista('Itens da coluna 1', 'esquerda', 'Um por linha')),
        h('div', {}, campoTexto('Nome da coluna 2', 'rotuloDireita'), campoLista('Itens da coluna 2', 'direita', 'Um por linha'))));
    }
    partes.push(campo('O que eu falo neste slide (só você vê)', area({
      style: { minHeight: '80px' }, oninput: (e) => { sl.notas = e.target.value; guardar(); },
    }, sl.notas || '')));
    partes.push(h('div', { class: 'flexb' },
      h('button', { class: 'btn btn--sm', disabled: atual === 0, onclick: () => mover(-1) }, '← Mover'),
      h('button', { class: 'btn btn--sm', disabled: atual === ap.slides.length - 1, onclick: () => mover(1) }, 'Mover →'),
      h('button', { class: 'btn btn--sm', onclick: () => { ap.slides.splice(atual + 1, 0, structuredClone(sl)); atual++; guardar(); tudo(); } }, 'Duplicar'),
      h('button', {
        class: 'btn btn--sm btn--d sp', disabled: ap.slides.length <= 1,
        onclick: () => { ap.slides.splice(atual, 1); atual = Math.max(0, atual - 1); guardar(); tudo(); },
      }, 'Apagar slide')));
    form.replaceChildren(...partes);
  }
  function pintarTirasLeve() {
    const b = tiras.children[atual];
    if (b) b.replaceChildren(desenharSlide(ap.slides[atual], ap, atual, 0), h('span', {}, String(atual + 1)));
  }
  function mover(d) {
    const j = atual + d;
    [ap.slides[atual], ap.slides[j]] = [ap.slides[j], ap.slides[atual]];
    atual = j; guardar(); tudo();
  }
  function tudo() { pintarPrevia(); pintarTiras(); pintarForm(); }

  const nome = inp({ value: ap.titulo, class: 'inp apr-titulo', 'aria-label': 'Nome da apresentação',
    oninput: (e) => { ap.titulo = e.target.value; guardar(); } });
  const baixar = h('button', {
    class: 'btn btn--p', onclick: async () => {
      baixar.disabled = true; baixar.textContent = 'Gerando…';
      try { salvarAp(structuredClone(ap)); const arq = await baixarPowerPoint(ap); toast(`${arq} baixado ✅ Abra no PowerPoint, Canva ou Google Slides.`, 'good'); }
      catch (e) { toast(e.message, 'bad'); }
      baixar.disabled = false; baixar.textContent = '⬇ PowerPoint';
    },
  }, '⬇ PowerPoint');

  el.append(
    h('div', { class: 'apr-barra' },
      h('a', { class: 'btn btn--sm', href: '#/apresentacoes' }, '← Voltar'),
      nome,
      h('div', { class: 'flexb' },
        segmento(Object.entries(TEMAS).map(([v, x]) => ({ v, t: x.nome })), ap.tema || 'cartaz', (v) => { ap.tema = v; guardar(); tudo(); }),
        h('button', { class: 'btn', onclick: () => apresentar(ap, atual) }, '▶ Apresentar'),
        baixar,
        h('button', { class: 'btn', onclick: () => imprimir(ap), title: 'Salvar em PDF ou imprimir' }, 'PDF'))),
    h('div', { class: 'apr-editor' }, h('div', {}, previa, tiras), h('div', { class: 'card' }, form)),
    ap.origem === 'ia' ? h('p', { class: 'tiny muted mt' }, '⚠️ Feito pelo MindTrack AI: confira datas, nomes e números antes de apresentar.') : null);
  tudo();
  return () => { clearTimeout(timer); salvarAp(structuredClone(ap)); };
}

/* ==================== apresentar em tela cheia ==================== */
function apresentar(ap, inicio = 0) {
  let i = inicio;
  const palco = h('div', { class: 'apr-palco' });
  const contador = h('div', { class: 'apr-cont' });
  const notas = h('div', { class: 'apr-notas', hidden: true });
  const tela = h('div', { class: 'apr-tela', role: 'dialog', 'aria-label': `Apresentando ${ap.titulo}`, tabindex: '-1' },
    palco, notas,
    h('div', { class: 'apr-ctrl' },
      h('button', { 'aria-label': 'Anterior', onclick: (e) => { e.stopPropagation(); ir(-1); } }, '‹'),
      contador,
      h('button', { 'aria-label': 'Próximo', onclick: (e) => { e.stopPropagation(); ir(1); } }, '›'),
      h('button', { onclick: (e) => { e.stopPropagation(); notas.hidden = !notas.hidden; } }, 'Falas'),
      h('button', { 'aria-label': 'Sair', onclick: (e) => { e.stopPropagation(); sair(); } }, '✕')));
  const pintar = () => {
    palco.replaceChildren(desenharSlide(ap.slides[i], ap, i, ap.slides.length));
    contador.textContent = `${i + 1} / ${ap.slides.length}`;
    notas.textContent = ap.slides[i].notas || 'Sem falas neste slide.';
  };
  const ir = (d) => { i = Math.max(0, Math.min(ap.slides.length - 1, i + d)); pintar(); };
  const tecla = (e) => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); ir(1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); ir(-1); }
    else if (e.key === 'Escape') sair();
  };
  function sair() {
    removeEventListener('keydown', tecla, true);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    tela.remove();
  }
  palco.addEventListener('click', (e) => ir(e.clientX > innerWidth / 2 ? 1 : -1));
  addEventListener('keydown', tecla, true);
  document.body.append(tela);
  pintar();
  tela.focus();
  tela.requestFullscreen?.().catch(() => {});
}

/* ==================== PDF (pela impressão do navegador) ==================== */
function imprimir(ap) {
  const caixa = h('div', { class: 'apr-impressao' }, ...ap.slides.map((sl, i) => h('div', { class: 'apr-pagina' }, desenharSlide(sl, ap, i, ap.slides.length))));
  document.body.append(caixa);
  document.body.classList.add('imprimindo');
  const fim = () => { caixa.remove(); document.body.classList.remove('imprimindo'); removeEventListener('afterprint', fim); };
  addEventListener('afterprint', fim);
  setTimeout(() => { window.print(); setTimeout(fim, 1500); }, 150);
}

