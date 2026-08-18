/* ===== views/tarefas.js — gerenciador de tarefas ===== */
import { h, iso, today, addDays, fmtMin, daysBetween, parseISO, norm } from '../util.js';
import { st, nomeMateria } from '../store.js';
import { filaTarefas, prioridade, ordemRecomendada } from '../engine.js';
import { titulo, cartao, kpi, segmento, inp, vazio, modal, toast } from '../ui.js';
import { linhaTarefa, formTarefa, opcoesMaterias } from './comum.js';

let filtro = { texto: '', materia: '', quando: 'abertas', ordem: 'prioridade' };

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  const abertas = s.tarefas.filter((t) => t.status !== 'concluido');
  const atrasadas = abertas.filter((t) => daysBetween(today(), parseISO(t.prazo)) < 0);
  const hoje = abertas.filter((t) => t.prazo === iso());
  const semana = abertas.filter((t) => { const d = daysBetween(today(), parseISO(t.prazo)); return d >= 0 && d <= 7; });

  el.append(titulo('✅ Tarefas', 'Tudo que precisa ser feito, na ordem certa.',
    h('button', { class: 'btn btn--p', onclick: () => formTarefa(null, pintar) }, '➕ Nova tarefa')));

  el.append(h('div', { class: 'grid g4 keep2 mb' },
    kpi(abertas.length, 'em aberto'),
    kpi(atrasadas.length, 'atrasadas', atrasadas.length ? 'resolva primeiro' : 'tudo em dia'),
    kpi(hoje.length, 'para hoje'),
    kpi(fmtMin(semana.reduce((a, b) => a + (b.minutos || 0), 0)), 'nesta semana')));

  /* filtros */
  const busca = inp({ placeholder: '🔍 Filtrar por título…', value: filtro.texto });
  busca.addEventListener('input', () => { filtro.texto = busca.value; pintarLista(); });
  const selMat = h('select', { class: 'inp', style: { maxWidth: '200px' } });
  for (const o of [{ v: '', t: 'Todas as matérias' }, ...opcoesMaterias(false)]) {
    const op = h('option', { value: o.v }, o.t); if (o.v === filtro.materia) op.selected = true; selMat.append(op);
  }
  selMat.addEventListener('change', () => { filtro.materia = selMat.value; pintarLista(); });

  el.append(cartao(
    h('div', { class: 'flexb mb' }, busca, selMat),
    h('div', { class: 'flexb' },
      segmento([
        { v: 'abertas', t: 'Em aberto' }, { v: 'hoje', t: 'Hoje' }, { v: 'semana', t: 'Semana' },
        { v: 'atrasadas', t: 'Atrasadas' }, { v: 'concluidas', t: 'Concluídas' }, { v: 'todas', t: 'Todas' },
      ], filtro.quando, (v) => { filtro.quando = v; pintarLista(); }),
      h('span', { class: 'sp' }),
      segmento([{ v: 'prioridade', t: '🔥 Prioridade' }, { v: 'prazo', t: '📅 Prazo' }, { v: 'materia', t: '📚 Matéria' }],
        filtro.ordem, (v) => { filtro.ordem = v; pintarLista(); }))));

  const listaBox = h('div', { class: 'mt2' });
  el.append(listaBox);

  function pintarLista() {
    let ts = [...st().tarefas];
    if (filtro.quando === 'abertas') ts = ts.filter((t) => t.status !== 'concluido');
    if (filtro.quando === 'concluidas') ts = ts.filter((t) => t.status === 'concluido');
    if (filtro.quando === 'hoje') ts = ts.filter((t) => t.status !== 'concluido' && t.prazo === iso());
    if (filtro.quando === 'semana') ts = ts.filter((t) => { const d = daysBetween(today(), parseISO(t.prazo)); return t.status !== 'concluido' && d >= 0 && d <= 7; });
    if (filtro.quando === 'atrasadas') ts = ts.filter((t) => t.status !== 'concluido' && daysBetween(today(), parseISO(t.prazo)) < 0);
    if (filtro.materia) ts = ts.filter((t) => t.materiaId === filtro.materia);
    if (filtro.texto) ts = ts.filter((t) => norm(t.titulo).includes(norm(filtro.texto)));

    if (filtro.ordem === 'prioridade') ts.sort((a, b) => prioridade(b).nota - prioridade(a).nota);
    if (filtro.ordem === 'prazo') ts.sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)));
    if (filtro.ordem === 'materia') ts.sort((a, b) => nomeMateria(a.materiaId).localeCompare(nomeMateria(b.materiaId)));

    listaBox.replaceChildren();
    if (!ts.length) {
      listaBox.append(vazio('Nada por aqui', 'Nenhuma tarefa com esses filtros.',
        h('button', { class: 'btn btn--p', onclick: () => formTarefa(null, pintar) }, '➕ Criar tarefa')));
      return;
    }
    const lista = h('div', { class: 'list' });
    for (const t of ts) lista.append(linhaTarefa(t, { aoMudar: pintar }));
    listaBox.append(lista);
    listaBox.append(h('p', { class: 'tiny muted center mt' }, `${ts.length} tarefa(s) · a bolinha à direita é a nota de prioridade (toque para entender)`));
  }
  pintarLista();

  /* plano do dia */
  el.append(h('div', { class: 'mt2' }, cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🧠 Como o StudyLab organizaria seu dia'),
      h('span', { class: 'chip sp' }, `${st().prefs.minutosDia} min disponíveis`)),
    (() => {
      const { blocos } = ordemRecomendada();
      if (!blocos.length) return h('p', { class: 'muted small' }, 'Sem tarefas em aberto.');
      const box = h('div', { class: 'list' });
      let i = 0;
      for (const b of blocos) {
        if (b.pausa) { box.append(h('div', { class: 'row row--flat', style: { opacity: .65 } }, '☕', h('span', { class: 'grow small muted' }, 'Pausa'), h('span', { class: 'chip' }, fmtMin(b.minutos)))); continue; }
        i++;
        box.append(h('a', { class: 'row row--flat', href: `#/foco?tarefa=${b.tarefaId}&min=${b.minutos}`, style: { color: 'inherit' } },
          h('b', { style: { width: '18px' } }, i),
          h('span', { class: 'grow' }, h('div', { class: 'small', style: { fontWeight: 700 } }, b.titulo),
            h('div', { class: 'tiny muted' }, nomeMateria(b.materiaId))),
          h('span', { class: 'chip' }, fmtMin(b.minutos))));
      }
      return box;
    })())));
}
