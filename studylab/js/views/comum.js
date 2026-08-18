/* ===== views/comum.js — peças compartilhadas entre telas ===== */
import { h, iso, today, addDays, fmtPrazo, fmtMin } from '../util.js';
import {
  st, nomeMateria, emojiMateria, corMateria, novaTarefa, novaProva,
  atualizar, remover, novoFlashcard, novaNota, novoMaterial,
} from '../store.js';
import {
  prioridade, faixaPrioridade, dividirTarefa, ganharXP, verificarConquistas, tocarStreak,
  gerarPlanoProva, iconeStatus,
} from '../engine.js';
import { modal, fecharModal, toast, campo, inp, sel, txtarea, confirmar, barra } from '../ui.js';
import { temIA, dividirComIA } from '../ai.js';

/* ---------- seletores ---------- */
export const opcoesMaterias = (comVazio = true) => [
  ...(comVazio ? [{ v: '', t: '— sem matéria —' }] : []),
  ...st().materias.filter((m) => !m.arquivada).map((m) => ({ v: m.id, t: `${m.emoji} ${m.nome}` })),
];
export const opcoesConteudos = (materiaId, comVazio = true) => [
  ...(comVazio ? [{ v: '', t: '— geral —' }] : []),
  ...st().conteudos.filter((c) => !materiaId || c.materiaId === materiaId)
    .map((c) => ({ v: c.id, t: `${iconeStatus(c.status)} ${c.nome}` })),
];
export const ESCALA = [1, 2, 3, 4, 5].map((n) => ({ v: n, t: '★'.repeat(n) }));
export function selMateria(valor, attrs = {}) { return sel(opcoesMaterias(), valor, attrs); }

/* ---------- etiqueta de matéria ---------- */
export function tagMateria(mid) {
  if (!mid) return h('span', { class: 'chip' }, '📌 Geral');
  return h('span', { class: 'chip', style: { borderColor: corMateria(mid) + '66', color: corMateria(mid) } },
    `${emojiMateria(mid)} ${nomeMateria(mid)}`);
}

/* ==========================================================
   LINHA DE TAREFA
   ========================================================== */
export const STATUS_TAREFA = [
  { v: 'aberto', t: '⚪ Não iniciado' }, { v: 'andamento', t: '🔵 Em andamento' },
  { v: 'quase', t: '🟡 Quase terminado' }, { v: 'concluido', t: '🟢 Concluído' },
];

export function linhaTarefa(t, { aoMudar, mostrarPrioridade = true } = {}) {
  const p = prioridade(t);
  const f = faixaPrioridade(p.nota);
  const pr = fmtPrazo(t.prazo);
  const feito = t.status === 'concluido';
  const subFeitas = (t.subtarefas || []).filter((s) => s.feito).length;

  return h('div', { class: `row ${feito ? 'dim' : ''}` },
    h('span', { class: 'lead', style: { background: feito ? '#34d399' : f.cor } }),
    h('button', {
      class: 'icon-btn', title: feito ? 'Reabrir' : 'Concluir',
      onclick: () => { concluirTarefa(t.id, !feito); aoMudar?.(); },
    }, feito ? '↩️' : '✓'),
    h('div', {
      class: 'grow', style: { cursor: 'pointer' },
      onclick: () => formTarefa(t, aoMudar),
    },
      h('div', { class: 'ttl', style: feito ? { textDecoration: 'line-through' } : {} }, t.titulo),
      h('div', { class: 'sub' },
        tagMateria(t.materiaId),
        h('span', { class: `chip ${pr.cls}` }, `📅 ${pr.txt}`),
        h('span', { class: 'chip' }, `⏱️ ${fmtMin(t.minutos)}`),
        t.valor ? h('span', { class: 'chip' }, `🎓 vale ${t.valor}`) : null,
        (t.subtarefas || []).length ? h('span', { class: 'chip' }, `🧩 ${subFeitas}/${t.subtarefas.length}`) : null)),
    mostrarPrioridade && !feito
      ? h('button', {
        class: 'prio', title: 'Ver como a prioridade foi calculada',
        style: { background: 'none', border: 0, cursor: 'pointer', color: f.cor },
        onclick: (e) => { e.stopPropagation(); explicarPrioridade(t); },
      }, h('span', { class: 'dot-s', style: { background: f.cor } }), String(p.nota))
      : null);
}

export function concluirTarefa(id, concluir = true) {
  const t = st().tarefas.find((x) => x.id === id); if (!t) return;
  atualizar('tarefas', id, { status: concluir ? 'concluido' : 'andamento', concluidaEm: concluir ? iso() : null });
  if (concluir) {
    const g = ganharXP(20 + Math.round((t.minutos || 30) / 3), 'tarefa concluída');
    toast(`✅ Tarefa concluída · +${g.qtd} XP`, 'good');
    if (g.subiu) toast(`🎉 Você subiu para o nível ${g.nivel}!`, 'good');
    tocarStreak();
    for (const c of verificarConquistas()) toast(`${c.emoji} Conquista: ${c.nome}`, 'good');
  }
}

export function explicarPrioridade(t) {
  const p = prioridade(t);
  modal(`Prioridade — ${t.titulo}`, h('div', {},
    h('p', { class: 'muted small', style: { marginTop: 0 } },
      'A nota vai de 0 a 100 e mistura cinco fatores. Quanto maior, mais cedo essa tarefa deveria ser feita.'),
    h('div', { class: 'flexb', style: { margin: '10px 0 16px' } },
      h('b', { style: { fontSize: '30px', color: faixaPrioridade(p.nota).cor } }, p.nota),
      h('span', { class: 'muted' }, `/100 · ${faixaPrioridade(p.nota).rot}${p.atrasada ? ' · ATRASADA' : ''}`)),
    ...p.partes.map((x) => h('div', { class: 'mb' },
      h('div', { class: 'flexb tiny' }, h('span', {}, x.rot),
        h('b', { class: 'sp' }, `${Math.round(x.v * 100)}% × peso ${Math.round(x.w * 100)}%`)),
      barra(x.v * 100))),
    h('p', { class: 'tiny muted' }, 'Tarefas atrasadas recebem nota mínima 90 automaticamente.')));
}

/* ==========================================================
   FORMULÁRIO DE TAREFA
   ========================================================== */
const tarefaEmBranco = () => ({
  titulo: '', materiaId: '', prazo: iso(addDays(today(), 1)), minutos: 30, valor: 0,
  importancia: 3, dificuldade: 3, status: 'aberto', descricao: '', subtarefas: [],
});

export function formTarefa(tarefa = null, aoSalvar = null, padrao = {}) {
  const t = tarefa || { ...tarefaEmBranco(), ...padrao };
  const nova = !tarefa;
  const f = {};

  f.titulo = inp({ value: t.titulo, placeholder: 'Ex.: Lista de exercícios — página 84' });
  f.materiaId = selMateria(t.materiaId);
  f.prazo = inp({ type: 'date', value: t.prazo });
  f.minutos = inp({ type: 'number', min: 5, step: 5, value: t.minutos });
  f.importancia = sel(ESCALA, t.importancia);
  f.dificuldade = sel(ESCALA, t.dificuldade);
  f.valor = inp({ type: 'number', min: 0, step: .5, value: t.valor });
  f.status = sel(STATUS_TAREFA, t.status);
  f.descricao = txtarea({ placeholder: 'Detalhes, o que o professor pediu…', style: { minHeight: '70px' } });
  f.descricao.value = t.descricao || '';

  const subBox = h('div', { class: 'list' });
  let subs = [...(t.subtarefas || [])];
  const pintarSubs = () => {
    subBox.replaceChildren(...subs.map((s, i) => h('div', { class: 'row row--flat' },
      h('input', { type: 'checkbox', checked: s.feito || null, onchange: (e) => { subs[i].feito = e.target.checked; } }),
      h('span', { class: 'grow small' }, s.titulo),
      h('span', { class: 'chip' }, fmtMin(s.minutos)),
      h('button', { class: 'icon-btn', onclick: () => { subs.splice(i, 1); pintarSubs(); } }, '✕'))));
    if (!subs.length) subBox.append(h('p', { class: 'tiny muted' }, 'Tarefa grande demais? Divida em passos pequenos.'));
  };
  pintarSubs();

  const btnDividir = h('button', {
    class: 'btn btn--sm', onclick: async () => {
      const titulo = f.titulo.value.trim() || 'Tarefa';
      const min = Number(f.minutos.value) || 60;
      if (temIA()) {
        btnDividir.disabled = true; btnDividir.textContent = 'Dividindo…';
        try { subs = await dividirComIA(titulo, min, nomeMateria(f.materiaId.value)); }
        catch (e) { toast(e.message, 'bad'); subs = dividirTarefa(titulo, min); }
        btnDividir.disabled = false; btnDividir.textContent = '✨ Dividir em passos';
      } else {
        subs = dividirTarefa(titulo, min);
        toast('Dividido com o modelo padrão (ative o Study AI para uma divisão sob medida)');
      }
      pintarSubs();
    },
  }, '✨ Dividir em passos');

  modal(nova ? '➕ Nova tarefa' : '✏️ Editar tarefa', h('div', {},
    campo('Título', f.titulo),
    h('div', { class: 'f-row' }, campo('Matéria', f.materiaId), campo('Prazo', f.prazo)),
    h('div', { class: 'f-row' }, campo('Tempo estimado (min)', f.minutos), campo('Vale quantos pontos?', f.valor)),
    h('div', { class: 'f-row' }, campo('Importância', f.importancia), campo('Dificuldade', f.dificuldade)),
    campo('Status', f.status),
    campo('Descrição', f.descricao),
    h('div', { class: 'flexb mb' }, h('b', { class: 'small' }, '🧩 Subtarefas'), h('span', { class: 'sp' }, btnDividir)),
    subBox,
    h('div', { class: 'flexb mt2' },
      !nova ? h('button', {
        class: 'btn btn--d',
        onclick: () => confirmar('Apagar tarefa?', `"${t.titulo}" será removida.`, () => { remover('tarefas', t.id); fecharModal(); aoSalvar?.(); }),
      }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const dados = {
            titulo: f.titulo.value.trim() || 'Sem título',
            materiaId: f.materiaId.value || null,
            prazo: f.prazo.value || iso(),
            minutos: Number(f.minutos.value) || 30,
            valor: Number(f.valor.value) || 0,
            importancia: Number(f.importancia.value) || 3,
            dificuldade: Number(f.dificuldade.value) || 3,
            status: f.status.value,
            descricao: f.descricao.value,
            subtarefas: subs,
          };
          if (dados.status === 'concluido' && t.status !== 'concluido') dados.concluidaEm = iso();
          if (nova) novaTarefa(dados); else atualizar('tarefas', t.id, dados);
          fecharModal(); toast(nova ? 'Tarefa criada' : 'Tarefa atualizada', 'good'); aoSalvar?.();
        },
      }, nova ? 'Criar tarefa' : 'Salvar'))));
}

/* ==========================================================
   FORMULÁRIO DE PROVA
   ========================================================== */
export function formProva(provaExistente = null, aoSalvar = null, padrao = {}) {
  const p = provaExistente || { titulo: '', materiaId: '', data: iso(addDays(today(), 7)), valor: 10, conteudoIds: [], ...padrao };
  const nova = !provaExistente;
  const f = {};
  f.titulo = inp({ value: p.titulo, placeholder: 'Ex.: Prova de História — 3º bimestre' });
  f.materiaId = selMateria(p.materiaId);
  f.data = inp({ type: 'date', value: p.data });
  f.valor = inp({ type: 'number', min: 0, step: .5, value: p.valor });

  const listaC = h('div', { class: 'chips' });
  let escolhidos = [...(p.conteudoIds || [])];
  const pintarConteudos = () => {
    const mid = f.materiaId.value;
    const cs = st().conteudos.filter((c) => !mid || c.materiaId === mid);
    listaC.replaceChildren(...(cs.length ? cs.map((c) => {
      const on = escolhidos.includes(c.id);
      return h('button', {
        class: `chip ${on ? 'chip--on' : ''}`, style: { cursor: 'pointer' },
        onclick: () => { escolhidos = on ? escolhidos.filter((x) => x !== c.id) : [...escolhidos, c.id]; pintarConteudos(); },
      }, `${iconeStatus(c.status)} ${c.nome} · ${c.dominio || 0}%`);
    }) : [h('p', { class: 'tiny muted' }, 'Essa matéria ainda não tem conteúdos. Cadastre em Matérias.')]));
  };
  pintarConteudos();
  f.materiaId.addEventListener('change', pintarConteudos);

  modal(nova ? '🎯 Nova prova' : '✏️ Editar prova', h('div', {},
    campo('Título', f.titulo),
    h('div', { class: 'f-row' }, campo('Matéria', f.materiaId), campo('Data', f.data)),
    campo('Vale quantos pontos?', f.valor),
    h('label', { class: 'f' }, h('span', {}, 'Conteúdos que caem'), listaC),
    h('div', { class: 'flexb mt2' },
      !nova ? h('button', {
        class: 'btn btn--d',
        onclick: () => confirmar('Apagar prova?', `"${p.titulo}" será removida.`, () => { remover('provas', p.id); fecharModal(); aoSalvar?.(); }),
      }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const dados = {
            titulo: f.titulo.value.trim() || 'Prova',
            materiaId: f.materiaId.value || null,
            data: f.data.value || iso(),
            valor: Number(f.valor.value) || 10,
            conteudoIds: escolhidos,
          };
          if (nova) {
            const criada = novaProva(dados);
            atualizar('provas', criada.id, { plano: gerarPlanoProva({ ...criada, ...dados }) });
          } else atualizar('provas', p.id, dados);
          fecharModal(); toast(nova ? 'Prova criada com plano de estudo' : 'Prova atualizada', 'good'); aoSalvar?.();
        },
      }, nova ? 'Criar prova' : 'Salvar'))));
}

/* ==========================================================
   FORMULÁRIOS CURTOS
   ========================================================== */
export function formFlashcard(card = null, aoSalvar = null, padrao = {}) {
  const c = card || { frente: '', verso: '', materiaId: '', conteudoId: '', ...padrao };
  const f = {};
  f.frente = txtarea({ placeholder: 'Pergunta / frente', style: { minHeight: '70px' } }); f.frente.value = c.frente;
  f.verso = txtarea({ placeholder: 'Resposta / verso', style: { minHeight: '90px' } }); f.verso.value = c.verso;
  f.materiaId = selMateria(c.materiaId);
  let selConteudo = sel(opcoesConteudos(c.materiaId), c.conteudoId);
  const wrapC = h('div', {}, selConteudo);
  f.materiaId.addEventListener('change', () => {
    selConteudo = sel(opcoesConteudos(f.materiaId.value), '');
    wrapC.replaceChildren(selConteudo);
  });
  modal(card ? '✏️ Editar flashcard' : '🃏 Novo flashcard', h('div', {},
    campo('Frente', f.frente), campo('Verso', f.verso),
    h('div', { class: 'f-row' }, campo('Matéria', f.materiaId), campo('Conteúdo', wrapC)),
    h('div', { class: 'flexb mt2' },
      card ? h('button', { class: 'btn btn--d', onclick: () => confirmar('Apagar flashcard?', 'Não dá para desfazer.', () => { remover('flashcards', card.id); fecharModal(); aoSalvar?.(); }) }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const d = { frente: f.frente.value.trim(), verso: f.verso.value.trim(), materiaId: f.materiaId.value || null, conteudoId: selConteudo.value || null };
          if (!d.frente || !d.verso) return toast('Preencha frente e verso', 'bad');
          if (card) atualizar('flashcards', card.id, d); else novoFlashcard(d);
          fecharModal(); toast('Flashcard salvo', 'good'); aoSalvar?.();
        },
      }, 'Salvar'))));
}

export function formNota(nota = null, aoSalvar = null, padrao = {}) {
  const n = nota || { titulo: '', materiaId: '', valor: 0, maximo: 10, peso: 1, bimestre: 3, data: iso(), ...padrao };
  const f = {};
  f.titulo = inp({ value: n.titulo, placeholder: 'Ex.: Prova 1' });
  f.materiaId = selMateria(n.materiaId);
  f.valor = inp({ type: 'number', step: .1, min: 0, value: n.valor });
  f.maximo = inp({ type: 'number', step: .1, min: .1, value: n.maximo });
  f.peso = inp({ type: 'number', step: .5, min: .5, value: n.peso });
  f.bimestre = sel([1, 2, 3, 4].map((b) => ({ v: b, t: `${b}º bimestre` })), n.bimestre);
  modal(nota ? '✏️ Editar nota' : '📊 Nova nota', h('div', {},
    campo('Avaliação', f.titulo), campo('Matéria', f.materiaId),
    h('div', { class: 'f-row' }, campo('Nota', f.valor), campo('Valia quanto?', f.maximo)),
    h('div', { class: 'f-row' }, campo('Peso', f.peso), campo('Bimestre', f.bimestre)),
    h('div', { class: 'flexb mt2' },
      nota ? h('button', { class: 'btn btn--d', onclick: () => confirmar('Apagar nota?', '', () => { remover('notas', nota.id); fecharModal(); aoSalvar?.(); }) }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const d = {
            titulo: f.titulo.value.trim() || 'Avaliação', materiaId: f.materiaId.value || null,
            valor: Number(f.valor.value) || 0, maximo: Number(f.maximo.value) || 10,
            peso: Number(f.peso.value) || 1, bimestre: Number(f.bimestre.value) || 1,
          };
          if (nota) atualizar('notas', nota.id, d); else novaNota(d);
          fecharModal(); toast('Nota salva', 'good'); aoSalvar?.();
        },
      }, 'Salvar'))));
}

export const TIPOS_MATERIAL = [
  { v: 'anotacao', t: '📝 Anotação de aula' }, { v: 'resumo', t: '📖 Resumo' },
  { v: 'pdf', t: '📄 PDF / arquivo' }, { v: 'lista', t: '📋 Lista de exercícios' },
  { v: 'mapa', t: '🗺️ Mapa mental' }, { v: 'link', t: '🔗 Link' }, { v: 'imagem', t: '🖼️ Imagem' },
];
export function formMaterial(mat = null, aoSalvar = null, padrao = {}) {
  const m = mat || { titulo: '', materiaId: '', tipo: 'anotacao', conteudo: '', url: '', ...padrao };
  const f = {};
  f.titulo = inp({ value: m.titulo, placeholder: 'Título do material' });
  f.materiaId = selMateria(m.materiaId);
  f.tipo = sel(TIPOS_MATERIAL, m.tipo);
  f.url = inp({ value: m.url, placeholder: 'https://… (opcional)' });
  f.conteudo = txtarea({ placeholder: 'Cole aqui o texto, a anotação da aula…', style: { minHeight: '160px' } });
  f.conteudo.value = m.conteudo || '';
  modal(mat ? '✏️ Editar material' : '📂 Novo material', h('div', {},
    campo('Título', f.titulo),
    h('div', { class: 'f-row' }, campo('Matéria', f.materiaId), campo('Tipo', f.tipo)),
    campo('Link (opcional)', f.url),
    campo('Conteúdo', f.conteudo),
    h('div', { class: 'flexb mt2' },
      mat ? h('button', { class: 'btn btn--d', onclick: () => confirmar('Apagar material?', '', () => { remover('biblioteca', mat.id); fecharModal(); aoSalvar?.(); }) }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const d = {
            titulo: f.titulo.value.trim() || 'Material', materiaId: f.materiaId.value || null,
            tipo: f.tipo.value, url: f.url.value.trim(), conteudo: f.conteudo.value,
          };
          if (mat) atualizar('biblioteca', mat.id, d); else novoMaterial(d);
          fecharModal(); toast('Material salvo', 'good'); aoSalvar?.();
        },
      }, 'Salvar'))));
}
