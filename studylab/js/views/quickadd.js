/* ===== views/quickadd.js — o botão ➕ da barra superior ===== */
import { h, iso } from '../util.js';
import { st, novaNota } from '../store.js';
import { modal, fecharModal, toast } from '../ui.js';
import { formTarefa, formProva, formFlashcard, formNota, formMaterial } from './comum.js';
import { abrirAnotacao } from './biblioteca.js';
import { formEvento } from './agenda.js';
import { formQuestao } from './questoes.js';

const OPCOES = [
  { i: '✅', t: 'Tarefa', d: 'dever, atividade, lista', ac: () => formTarefa() },
  { i: '🎯', t: 'Prova', d: 'cria o plano de estudo junto', ac: () => formProva() },
  { i: '📘', t: 'Trabalho', d: 'tarefa grande, com passos', ac: () => formTarefa(null, null, { minutos: 180, importancia: 5, titulo: 'Trabalho de ' }) },
  { i: '📊', t: 'Nota', d: 'lançar uma avaliação', ac: () => formNota() },
  { i: '📅', t: 'Evento', d: 'aula, revisão, simulado', ac: () => formEvento() },
  { i: '🃏', t: 'Flashcard', d: 'pergunta e resposta', ac: () => formFlashcard() },
  { i: '📝', t: 'Questão', d: 'para treinar depois', ac: () => formQuestao() },
  { i: '📂', t: 'Material', d: 'resumo, PDF, link', ac: () => formMaterial() },
  { i: '🗒️', t: 'Anotação de aula', d: 'escreve agora, organiza depois', ac: () => abrirAnotacao() },
  { i: '⏱️', t: 'Sessão de estudo', d: 'ir direto para o foco', ac: () => { fecharModal(); location.hash = '#/foco'; } },
];

export function abrirQuickAdd() {
  modal('➕ Adicionar', h('div', {},
    h('p', { class: 'muted small', style: { marginTop: 0 } }, 'O que você quer registrar?'),
    h('div', { class: 'grid g2 keep2' }, ...OPCOES.map((o) =>
      h('button', {
        class: 'card card--flat', style: { cursor: 'pointer', textAlign: 'left' },
        onclick: () => { fecharModal(); setTimeout(o.ac, 40); },
      },
        h('div', { style: { fontSize: '20px' } }, o.i),
        h('b', { class: 'small' }, o.t),
        h('div', { class: 'tiny muted' }, o.d))))));
}
