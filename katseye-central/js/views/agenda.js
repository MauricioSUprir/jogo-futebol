/* ===== views/agenda.js — Agenda inteligente e planner executivo =====
   Calendário (mês / semana / dia), captura em linguagem natural, tarefas com
   prioridade calculada, filtros e resumos automáticos.                     */

import {
  h, iso, hoje, addDias, addMeses, parseISO, inicioSemana, inicioMes,
  diasEntre, fmtData, fmtDataLonga, textoRico, DIAS_S, MESES, norm,
} from '../util.js';
import { st, set, tipoEvento, TIPOS_EVENTO, integrantes } from '../store.js';
import {
  eventosNoDia, ordemDoDia, notaPrioridade, corPrioridade, metricas,
  resumoDoDia, resumoDaSemana, proximosEventos,
} from '../engine.js';
import {
  tituloPagina, painel, segmento, vazio, modal, toast, kpi, inp, sel,
  cascata, entrada,
} from '../ui.js';
import { capturaRapida, linhaTarefa, linhaEvento, abrirFormEvento, abrirFormTarefa } from './comum.js';

/* estado só da tela (não entra no store: é navegação, não dado) */
let visao = 'mes';
let cursor = iso(hoje());
let filtro = 'abertas';
let ordem = 'prioridade';
let busca = '';

export function render(alvo, { params } = {}) {
  if (params?.get('dia')) cursor = params.get('dia');
  const recarregar = () => { alvo.replaceChildren(); render(alvo, { params }); };
  const m = metricas();

  /* ---------- números ---------- */
  const numeros = h('div', { class: 'grid g4 keep2' },
    kpi(m.paraHoje, 'vencem hoje'),
    kpi(m.atrasadas, 'atrasadas'),
    kpi(m.abertas, 'tarefas abertas'),
    kpi(m.eventosSemana, 'compromissos na semana'));

  /* ---------- calendário ---------- */
  const calendario = painel('Calendário', {
    icone: '📅',
    acao: segmento([
      { v: 'mes', t: 'Mês' }, { v: 'semana', t: 'Semana' }, { v: 'dia', t: 'Dia' },
    ], visao, (v) => { visao = v; recarregar(); }),
  }, montarCalendario(recarregar));

  /* ---------- dia selecionado ---------- */
  const doDia = eventosNoDia(cursor);
  const painelDia = painel(fmtDataLonga(cursor), {
    icone: '🗓️',
    acao: h('button', {
      class: 'btn btn--xs btn--p',
      onclick: () => abrirFormEvento({
        titulo: '', data: cursor, hora: '', tipo: 'outro', local: '', integranteId: '', nota: '', repete: '',
      }, recarregar),
    }, '+ compromisso'),
  }, doDia.length
    ? h('div', { class: 'list' }, ...doDia.map((e) => linhaEvento(e, recarregar, { data: cursor })))
    : vazio('Dia livre', 'Nada marcado para esta data.', null, '🌤️'));

  /* ---------- tarefas ---------- */
  const campoBusca = inp({ value: busca, placeholder: '🔎 Filtrar por texto…' });
  campoBusca.addEventListener('input', () => {
    busca = campoBusca.value;
    pintarTarefas();
  });

  const listaTarefas = h('div', { class: 'list' });
  function pintarTarefas() {
    const s = st();
    let lista = s.tarefas.map((t) => ({ ...t, nota: notaPrioridade(t) }));

    if (filtro === 'abertas') lista = lista.filter((t) => t.status !== 'concluida');
    else if (filtro === 'hoje') lista = lista.filter((t) => t.status !== 'concluida' && t.prazo === iso(hoje()));
    else if (filtro === 'semana') {
      lista = lista.filter((t) => t.status !== 'concluida'
        && diasEntre(hoje(), parseISO(t.prazo) || hoje()) <= 7
        && diasEntre(hoje(), parseISO(t.prazo) || hoje()) >= 0);
    } else if (filtro === 'atrasadas') {
      lista = lista.filter((t) => t.status !== 'concluida' && diasEntre(hoje(), parseISO(t.prazo) || hoje()) < 0);
    } else if (filtro === 'feitas') lista = lista.filter((t) => t.status === 'concluida');

    if (busca.trim()) {
      const b = norm(busca);
      lista = lista.filter((t) => norm(t.titulo).includes(b)
        || (t.tags || []).some((x) => norm(x).includes(b))
        || norm(t.nota || '').includes(b));
    }

    if (ordem === 'prioridade') lista.sort((a, b) => b.nota - a.nota);
    else if (ordem === 'prazo') lista.sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)));
    else lista.sort((a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm)));

    listaTarefas.replaceChildren();
    if (!lista.length) {
      listaTarefas.append(vazio(
        busca ? 'Nada com esse texto' : 'Nenhuma tarefa aqui',
        busca ? 'Tente outra palavra.' : 'Use a captura rápida acima ou o botão de nova tarefa.',
        h('button', { class: 'btn btn--p', onclick: () => abrirFormTarefa(null, recarregar) }, '+ Nova tarefa'),
        '✅',
      ));
      return;
    }
    for (const t of lista) listaTarefas.append(linhaTarefa(t, () => { pintarTarefas(); }));
    cascata(listaTarefas.children, { passo: 26, distancia: 8 });
  }

  const painelTarefas = painel('Tarefas', {
    icone: '✅',
    acao: h('button', { class: 'btn btn--xs btn--p', onclick: () => abrirFormTarefa(null, recarregar) }, '+ tarefa'),
  },
    h('div', { class: 'flexc mb' },
      segmento([
        { v: 'abertas', t: 'Abertas' }, { v: 'hoje', t: 'Hoje' },
        { v: 'semana', t: '7 dias' }, { v: 'atrasadas', t: 'Atrasadas' },
        { v: 'feitas', t: 'Concluídas' }, { v: 'tudo', t: 'Tudo' },
      ], filtro, (v) => { filtro = v; pintarTarefas(); }),
      h('div', { class: 'f-row' },
        campoBusca,
        sel([
          { v: 'prioridade', t: 'Ordenar por prioridade' },
          { v: 'prazo', t: 'Ordenar por prazo' },
          { v: 'recentes', t: 'Mais recentes' },
        ], ordem, { onchange: (e) => { ordem = e.target.value; pintarTarefas(); } }))),
    listaTarefas);
  pintarTarefas();

  /* ---------- resumos ---------- */
  const resumos = painel('Resumos automáticos', {
    icone: '📓',
    acao: h('span', { class: 'tiny dim2' }, 'calculado no aparelho'),
  },
    h('p', { class: 'small muted mb' },
      'Gerados pelo motor do app com os seus dados — sem IA, sem internet.'),
    h('div', { class: 'flexb' },
      h('button', {
        class: 'btn btn--sm',
        onclick: () => modal('📓 Resumo do dia',
          h('div', { class: 'msg ia', style: { maxWidth: '100%' }, html: textoRico(resumoDoDia()) })),
      }, 'Resumo do dia'),
      h('button', {
        class: 'btn btn--sm',
        onclick: () => modal('🗓️ Resumo da semana',
          h('div', { class: 'msg ia', style: { maxWidth: '100%' }, html: textoRico(resumoDaSemana()) })),
      }, 'Resumo da semana'),
      h('a', { class: 'btn btn--sm sp', href: '#/conselheiro' }, '🧠 Pedir análise ao Conselheiro')));

  /* ---------- próximos ---------- */
  const prox = proximosEventos(6, 90);
  const painelProx = painel('Próximos compromissos', { icone: '⏭️' },
    prox.length
      ? h('div', { class: 'list' }, ...prox.map((e) => linhaEvento(e, recarregar, { data: e.dataEfetiva })))
      : vazio('Agenda vazia adiante', 'Nada marcado nos próximos 90 dias.', null, '⏭️'));

  const raiz = h('div', { class: 'flexc', style: { gap: '18px' } },
    numeros,
    painel('Captura rápida', { icone: '⚡' }, capturaRapida(recarregar)),
    calendario,
    h('div', { class: 'grid g-side' },
      h('div', { class: 'flexc' }, painelTarefas),
      h('div', { class: 'flexc' }, painelDia, painelProx, resumos)));

  alvo.replaceChildren(
    tituloPagina('Agenda', 'Calendário, tarefas e prioridades — tudo salvo no aparelho.',
      h('button', { class: 'btn btn--sm', onclick: () => { cursor = iso(hoje()); recarregar(); } }, 'Hoje'),
      h('button', { class: 'btn btn--p btn--sm', onclick: () => abrirFormEvento(null, recarregar) }, '+ Compromisso')),
    raiz);
  cascata(raiz.children, { passo: 55 });
  return null;
}

/* ==========================================================
   CALENDÁRIO
   ========================================================== */
function montarCalendario(recarregar) {
  if (visao === 'dia') return vistaDia(recarregar);
  if (visao === 'semana') return vistaSemana(recarregar);
  return vistaMes(recarregar);
}

function cabecalho(titulo, aoAnterior, aoProximo) {
  return h('div', { class: 'flexb mb' },
    h('button', { class: 'icon-btn', onclick: aoAnterior, 'aria-label': 'Anterior' }, '‹'),
    h('b', { style: { fontSize: '15px' } }, titulo),
    h('button', { class: 'icon-btn', onclick: aoProximo, 'aria-label': 'Próximo' }, '›'),
    h('span', { class: 'sp' }));
}

function vistaMes(recarregar) {
  const foco = parseISO(cursor) || hoje();
  const primeiro = inicioMes(foco);
  const inicio = addDias(primeiro, -primeiro.getDay());
  const grade = h('div', { class: 'cal' },
    ...DIAS_S.map((d) => h('div', { class: 'h' }, d)));

  for (let i = 0; i < 42; i += 1) {
    const d = addDias(inicio, i);
    const dISO = iso(d);
    const fora = d.getMonth() !== foco.getMonth();
    const evs = eventosNoDia(dISO);
    const tarefas = st().tarefas.filter((t) => t.prazo === dISO && t.status !== 'concluida');

    grade.append(h('button', {
      class: `d ${fora ? 'out' : ''} ${dISO === iso(hoje()) ? 'hoje' : ''} ${dISO === cursor ? 'sel' : ''}`,
      onclick: () => { cursor = dISO; recarregar(); },
      ondblclick: () => abrirFormEvento({
        titulo: '', data: dISO, hora: '', tipo: 'outro', local: '', integranteId: '', nota: '', repete: '',
      }, recarregar),
    },
      h('b', {}, d.getDate()),
      ...evs.slice(0, 3).map((e) => h('div', {
        class: 'ev',
        style: { background: `${tipoEvento(e.tipo).cor}30`, color: tipoEvento(e.tipo).cor },
      }, `${e.hora ? `${e.hora} ` : ''}${e.titulo}`)),
      tarefas.length ? h('div', { class: 'ev', style: { background: 'rgba(255,107,107,.18)', color: '#ff6b6b' } },
        `✅ ${tarefas.length} tarefa${tarefas.length > 1 ? 's' : ''}`) : null,
      evs.length > 3 ? h('div', { class: 'tiny dim2' }, `+${evs.length - 3}`) : null));
  }

  return h('div', {},
    cabecalho(`${MESES[foco.getMonth()]} de ${foco.getFullYear()}`,
      () => { cursor = iso(addMeses(foco, -1)); recarregar(); },
      () => { cursor = iso(addMeses(foco, 1)); recarregar(); }),
    grade,
    h('p', { class: 'tiny dim2 mt' }, 'Um toque seleciona o dia · dois toques criam um compromisso nele.'));
}

function vistaSemana(recarregar) {
  const foco = parseISO(cursor) || hoje();
  const inicio = inicioSemana(foco);
  const grade = h('div', { class: 'sem' });

  for (let i = 0; i < 7; i += 1) {
    const d = addDias(inicio, i);
    const dISO = iso(d);
    const evs = eventosNoDia(dISO);
    const tarefas = st().tarefas.filter((t) => t.prazo === dISO && t.status !== 'concluida');

    grade.append(h('div', { class: `sem__d ${dISO === iso(hoje()) ? 'hoje' : ''}` },
      h('b', {}, `${DIAS_S[d.getDay()]} ${d.getDate()}`),
      ...evs.map((e) => h('div', {
        class: 'ev', style: { background: `${tipoEvento(e.tipo).cor}26`, color: tipoEvento(e.tipo).cor, cursor: 'pointer', fontSize: '11px', marginBottom: '4px' },
        onclick: () => abrirFormEvento(e, recarregar),
      }, `${e.hora ? `${e.hora} ` : ''}${e.titulo}`)),
      ...tarefas.map((t) => h('div', {
        class: 'ev', style: { background: 'var(--panel3)', cursor: 'pointer', fontSize: '11px', marginBottom: '4px' },
        onclick: () => abrirFormTarefa(t, recarregar),
      }, `✅ ${t.titulo}`)),
      !evs.length && !tarefas.length ? h('span', { class: 'tiny dim2' }, '—') : null,
      h('button', {
        class: 'btn btn--xs mt',
        onclick: () => abrirFormEvento({
          titulo: '', data: dISO, hora: '', tipo: 'outro', local: '', integranteId: '', nota: '', repete: '',
        }, recarregar),
      }, '+')));
  }

  return h('div', {},
    cabecalho(`Semana de ${fmtData(iso(inicio), { relativo: false, curto: true })}`,
      () => { cursor = iso(addDias(inicio, -7)); recarregar(); },
      () => { cursor = iso(addDias(inicio, 7)); recarregar(); }),
    grade);
}

function vistaDia(recarregar) {
  const foco = parseISO(cursor) || hoje();
  const evs = eventosNoDia(cursor);
  const tarefas = st().tarefas.filter((t) => t.prazo === cursor);

  const horas = h('div', { class: 'list' });
  const comHora = evs.filter((e) => e.hora).sort((a, b) => a.hora.localeCompare(b.hora));
  const semHora = evs.filter((e) => !e.hora);

  if (semHora.length) {
    horas.append(h('div', { class: 'tiny dim2' }, 'SEM HORÁRIO'));
    semHora.forEach((e) => horas.append(linhaEvento(e, recarregar, { data: cursor })));
  }
  if (comHora.length) {
    horas.append(h('div', { class: 'tiny dim2 mt' }, 'AO LONGO DO DIA'));
    comHora.forEach((e) => horas.append(linhaEvento(e, recarregar, { data: cursor })));
  }
  if (tarefas.length) {
    horas.append(h('div', { class: 'tiny dim2 mt' }, 'TAREFAS COM PRAZO HOJE'));
    tarefas.forEach((t) => horas.append(linhaTarefa(t, recarregar)));
  }
  if (!evs.length && !tarefas.length) {
    horas.append(vazio('Dia livre', 'Nada marcado nesta data.',
      h('button', {
        class: 'btn btn--p',
        onclick: () => abrirFormEvento({
          titulo: '', data: cursor, hora: '', tipo: 'outro', local: '', integranteId: '', nota: '', repete: '',
        }, recarregar),
      }, '+ Criar compromisso'), '🌤️'));
  }

  return h('div', {},
    cabecalho(fmtDataLonga(cursor),
      () => { cursor = iso(addDias(foco, -1)); recarregar(); },
      () => { cursor = iso(addDias(foco, 1)); recarregar(); }),
    horas);
}
