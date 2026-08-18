/* ===== views/flashcards.js — criação, geração com IA e sessão de revisão ===== */
import { h, iso, today, daysBetween, parseISO, norm, round } from '../util.js';
import { st, novoFlashcard, atualizar, remover, nomeMateria, emojiMateria, conteudo as getConteudo, registrarSessao } from '../store.js';
import { proximaRevisao, venceHoje, ganharXP, tocarStreak, verificarConquistas, recalcularDominios } from '../engine.js';
import { titulo, cartao, kpi, vazio, modal, fecharModal, toast, campo, inp, sel, txtarea, segmento, confirmar, barra, paywall } from '../ui.js';
import { formFlashcard, opcoesMaterias, opcoesConteudos, selMateria, tagMateria } from './comum.js';
import { temIA, gerarFlashcards, flashcardsLocais } from '../ai.js';

let filtro = '';

export function render(el, { params }) {
  const pintar = () => { el.replaceChildren(); montar(el, params, pintar); };
  if (params.get('materia')) filtro = params.get('materia');
  montar(el, params, pintar);
  if (params.get('rev')) setTimeout(() => estudar(vencidos()), 60);
}

const todos = () => st().flashcards.filter((f) => !filtro || f.materiaId === filtro);
const vencidos = () => todos().filter((f) => venceHoje(f.srs));

function montar(el, params, pintar) {
  const s = st();
  const lista = todos();
  const venc = vencidos();

  el.append(titulo('🃏 Flashcards', 'Pergunta na frente, resposta no verso — com revisão espaçada.',
    h('button', { class: 'btn', onclick: () => formFlashcard(null, pintar, { materiaId: filtro }) }, '➕ Criar'),
    h('button', { class: 'btn btn--p', onclick: () => abrirGerador(pintar) }, '✨ Criar com IA')));

  el.append(h('div', { class: 'grid g4 keep2 mb' },
    kpi(lista.length, 'flashcards'),
    kpi(venc.length, 'para revisar hoje'),
    kpi(lista.filter((f) => (f.srs?.repeticoes || 0) === 0).length, 'nunca revisados'),
    kpi(lista.filter((f) => (f.srs?.passo || 0) >= 4).length, 'na memória longa')));

  el.append(h('div', { class: 'grid g2 mb' },
    cartao(h('b', {}, '🔁 Revisão de hoje'),
      h('p', { class: 'muted small' }, venc.length ? `${venc.length} card(s) venceram. A revisão espaçada funciona melhor quando você faz no dia certo.` : 'Nenhum card vencido. Você está em dia!'),
      h('button', { class: 'btn btn--p btn--blk', disabled: !venc.length || null, onclick: () => estudar(venc) }, venc.length ? `▶ Revisar ${venc.length} cards` : 'Nada para revisar')),
    cartao(h('b', {}, '🎲 Estudo livre'),
      h('p', { class: 'muted small' }, 'Embaralha os cards da seleção atual, sem mexer no cronograma de revisão.'),
      h('button', { class: 'btn btn--blk', disabled: !lista.length || null, onclick: () => estudar([...lista].sort(() => Math.random() - .5).slice(0, 20), { livre: true }) }, '▶ Estudo livre'))));

  const selMat = sel([{ v: '', t: 'Todas as matérias' }, ...opcoesMaterias(false)], filtro, { style: { maxWidth: '220px' } });
  selMat.addEventListener('change', () => { filtro = selMat.value; pintar(); });

  const box = cartao(h('div', { class: 'flexb mb' }, h('b', {}, '🗂️ Seus cards'), h('span', { class: 'sp' }, selMat)));
  if (!lista.length) {
    box.append(vazio('Nenhum flashcard', 'Crie manualmente ou gere a partir de um resumo.',
      h('button', { class: 'btn btn--p', onclick: () => abrirGerador(pintar) }, '✨ Criar com IA')));
  } else {
    box.append(h('div', { class: 'list' }, ...lista.slice(0, 60).map((f) => h('div', { class: 'row' },
      h('span', { class: 'lead', style: { background: venceHoje(f.srs) ? '#fbbf24' : '#34d399' } }),
      h('div', { class: 'grow', style: { cursor: 'pointer' }, onclick: () => formFlashcard(f, pintar) },
        h('div', { class: 'ttl' }, f.frente),
        h('div', { class: 'sub' }, tagMateria(f.materiaId),
          f.conteudoId ? h('span', { class: 'chip' }, getConteudo(f.conteudoId)?.nome || '') : null,
          h('span', { class: 'chip' }, f.srs?.proxima ? `próxima: ${f.srs.proxima}` : 'nova'))),
      h('button', { class: 'icon-btn', onclick: () => { atualizar('flashcards', f.id, { favorito: !f.favorito }); pintar(); } }, f.favorito ? '⭐' : '☆')))));
    if (lista.length > 60) box.append(h('p', { class: 'tiny muted center mt' }, `mostrando 60 de ${lista.length}`));
  }
  el.append(box);
}

/* ==========================================================
   SESSÃO DE ESTUDO
   ========================================================== */
export function estudar(cards, { livre = false } = {}) {
  if (!cards.length) return toast('Nenhum card para estudar', 'bad');
  let i = 0, virado = false, acertos = 0;
  const inicio = Date.now();
  const tela = h('div', { class: 'focus-full', style: { alignContent: 'start', paddingTop: '20px' } });
  document.body.append(tela); document.body.style.overflow = 'hidden';

  const sair = () => { tela.remove(); document.body.style.overflow = ''; };

  function pintar() {
    if (i >= cards.length) return fim();
    const c = cards[i];
    tela.replaceChildren(h('div', { style: { width: 'min(620px,100%)', textAlign: 'left' } },
      h('div', { class: 'flexb mb' },
        h('button', { class: 'icon-btn', onclick: sair }, '✕'),
        h('b', { class: 'small' }, livre ? '🎲 Estudo livre' : '🔁 Revisão'),
        h('span', { class: 'sp chip' }, `${i + 1}/${cards.length}`)),
      barra((i / cards.length) * 100),
      h('div', {
        class: `fc mt2 ${virado ? 'flip' : ''}`, onclick: () => { virado = !virado; pintar(); },
      }, h('div', { class: 'fc__in' },
        h('div', { class: 'fc__f' }, h('div', {}, h('div', { class: 'tiny muted mb' }, nomeMateria(c.materiaId)), c.frente)),
        h('div', { class: 'fc__b' }, h('div', {}, c.verso)))),
      h('p', { class: 'tiny muted center mt' }, virado ? 'Como foi?' : 'toque no card para virar'),
      virado
        ? h('div', { class: 'grid g4 keep2 mt' },
          h('button', { class: 'btn', style: { borderColor: '#f8717166' }, onclick: () => avaliar(0) }, '😵 Errei'),
          h('button', { class: 'btn', style: { borderColor: '#fb923c66' }, onclick: () => avaliar(1) }, '😕 Difícil'),
          h('button', { class: 'btn', style: { borderColor: '#fbbf2466' }, onclick: () => avaliar(2) }, '🙂 Ok'),
          h('button', { class: 'btn', style: { borderColor: '#34d39966' }, onclick: () => avaliar(3) }, '😎 Fácil'))
        : h('button', { class: 'btn btn--p btn--blk btn--xl mt', onclick: () => { virado = true; pintar(); } }, 'Mostrar resposta')));
  }

  function avaliar(q) {
    const c = cards[i];
    if (!livre) {
      const srs = proximaRevisao(c.srs, q);
      atualizar('flashcards', c.id, { srs });
      if (c.conteudoId) {
        const ct = getConteudo(c.conteudoId);
        if (ct) atualizar('conteudos', ct.id, { srs: proximaRevisao(ct.srs, q) });
      }
    }
    if (q >= 2) acertos++;
    i++; virado = false; pintar();
  }

  function fim() {
    const minutos = Math.max(1, Math.round((Date.now() - inicio) / 60000));
    registrarSessao({ tipo: 'flashcards', minutos, materiaId: cards[0]?.materiaId || null });
    const g = ganharXP(Math.min(60, cards.length * 3), 'flashcards');
    tocarStreak(); recalcularDominios();
    const novas = verificarConquistas();
    tela.replaceChildren(h('div', { style: { width: 'min(560px,100%)' } },
      h('div', { style: { fontSize: '46px' } }, '🃏'),
      h('h2', {}, 'Sessão concluída'),
      h('p', { class: 'muted' }, `${cards.length} cards · ${acertos} bem lembrados · ${minutos} min · +${g.qtd} XP`),
      ...novas.map((c) => h('div', { class: 'card card--flat mb' }, `${c.emoji} Conquista: ${c.nome}`)),
      h('button', { class: 'btn btn--p btn--blk mt', onclick: sair }, 'Voltar')));
  }
  pintar();
}

/* ==========================================================
   GERADOR COM IA
   ========================================================== */
export function abrirGerador(aoSalvar) {
  const f = {};
  f.materia = selMateria(filtro);
  let selCont = sel(opcoesConteudos(filtro), '');
  const wrapC = h('div', {}, selCont);
  f.materia.addEventListener('change', () => { selCont = sel(opcoesConteudos(f.materia.value), ''); wrapC.replaceChildren(selCont); });
  f.qtd = inp({ type: 'number', min: 2, max: 30, value: 8 });
  f.texto = txtarea({ placeholder: 'Cole aqui o resumo, a anotação da aula ou o texto do livro…', style: { minHeight: '150px' } });

  const saida = h('div', { class: 'mt2' });
  const btn = h('button', {
    class: 'btn btn--p btn--blk', onclick: async () => {
      const texto = f.texto.value.trim();
      if (texto.length < 40) return toast('Cole um texto um pouco maior', 'bad');
      const qtd = Number(f.qtd.value) || 8;
      let cards;
      if (temIA()) {
        btn.disabled = true; btn.textContent = 'Criando…';
        saida.replaceChildren(h('p', { class: 'muted small' }, '✨ Lendo o material e escrevendo os cards…'));
        try {
          cards = await gerarFlashcards({ texto, quantidade: qtd, materiaNome: nomeMateria(f.materia.value), conteudoNome: getConteudo(selCont.value)?.nome || '' });
        } catch (e) { saida.replaceChildren(h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message)); btn.disabled = false; btn.textContent = '✨ Criar flashcards'; return; }
        btn.disabled = false; btn.textContent = '✨ Criar flashcards';
      } else {
        cards = flashcardsLocais(texto, qtd);
        if (!cards.length) { saida.replaceChildren(h('p', { class: 'small', style: { color: 'var(--warn)' } }, 'No plano grátis eu só consigo extrair cards de textos no formato "termo: definição" ou de frases com termos-chave. Com o Pro, o Study AI lê qualquer material e escreve os cards.')); return; }
        toast('Cards extraídos localmente (sem IA)');
      }
      const marcados = new Set(cards.map((_, i) => i));
      saida.replaceChildren(
        h('b', { class: 'small' }, `${cards.length} cards — desmarque o que não quiser`),
        h('div', { class: 'list mt' }, ...cards.map((c, i) => h('label', { class: 'row row--flat', style: { alignItems: 'flex-start' } },
          h('input', { type: 'checkbox', checked: true, onchange: (e) => { e.target.checked ? marcados.add(i) : marcados.delete(i); } }),
          h('div', { class: 'grow' }, h('div', { class: 'small', style: { fontWeight: 700 } }, c.frente),
            h('div', { class: 'tiny muted' }, c.verso))))),
        h('button', {
          class: 'btn btn--p btn--blk mt', onclick: () => {
            let n = 0;
            for (const [i, c] of cards.entries()) {
              if (!marcados.has(i)) continue;
              novoFlashcard({ frente: c.frente, verso: c.verso, materiaId: f.materia.value || null, conteudoId: selCont.value || null });
              n++;
            }
            fecharModal(); toast(`${n} flashcards criados`, 'good'); aoSalvar?.();
          },
        }, '💾 Salvar cards'));
    },
  }, '✨ Criar flashcards');

  modal('✨ Criar flashcards com IA', h('div', {},
    h('div', { class: 'f-row' }, campo('Matéria', f.materia), campo('Conteúdo', wrapC)),
    campo('Quantidade', f.qtd),
    campo('Material', f.texto),
    temIA() ? null : h('div', { class: 'mb' }, paywall('Criar cards com IA é do Pro',
      'Sem o Pro eu ainda tento extrair os cards do seu texto localmente — funciona bem com listas de "termo: definição".')),
    btn, saida), { largo: true });
}
