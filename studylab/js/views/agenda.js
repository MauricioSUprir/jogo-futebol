/* ===== views/agenda.js — calendário, horário escolar, semana e mochila digital ===== */
import {
  h, iso, today, addDays, startOfWeek, daysBetween, parseISO, fmtData, fmtMin,
  DIAS, DIAS_S, MESES,
} from '../util.js';
import { st, set, nomeMateria, emojiMateria, corMateria, novoEvento, remover, atualizar } from '../store.js';
import { agendaDoDia, aulasDoDia, filaTarefas, preparoProva, filaRevisao, ordemRecomendada } from '../engine.js';
import { titulo, cartao, kpi, vazio, modal, fecharModal, toast, campo, inp, sel, segmento, confirmar } from '../ui.js';
import { opcoesMaterias, selMateria, formTarefa, formProva, linhaTarefa } from './comum.js';

const CORES_EV = { aula: '#60a5fa', prova: '#f87171', trabalho: '#a78bfa', atividade: '#34d399', revisao: '#fbbf24', simulado: '#22d3ee', tarefa: '#34d399', plano: '#7c5cff' };
const ICONES_EV = { aula: '📙', prova: '📕', trabalho: '📘', atividade: '📗', revisao: '📓', simulado: '🧪', tarefa: '📗', plano: '🗓️' };

let modo = 'mes';
let refData = new Date();

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  el.append(titulo('📅 Agenda', 'Aulas, provas, trabalhos e revisões — tudo no mesmo lugar.',
    h('button', { class: 'btn', onclick: () => formEvento(null, pintar) }, '➕ Evento'),
    h('button', { class: 'btn btn--p', onclick: () => abrirSemana() }, '📆 Planejar semana')));

  el.append(h('div', { class: 'flexb mb' },
    segmento([{ v: 'dia', t: 'Dia' }, { v: 'semana', t: 'Semana' }, { v: 'mes', t: 'Mês' }], modo, (v) => { modo = v; pintar(); }),
    h('span', { class: 'sp' }),
    h('button', { class: 'icon-btn', onclick: () => { refData = addDays(refData, modo === 'mes' ? -30 : modo === 'semana' ? -7 : -1); pintar(); } }, '‹'),
    h('button', { class: 'btn btn--sm', onclick: () => { refData = new Date(); pintar(); } }, 'hoje'),
    h('button', { class: 'icon-btn', onclick: () => { refData = addDays(refData, modo === 'mes' ? 30 : modo === 'semana' ? 7 : 1); pintar(); } }, '›')));

  if (modo === 'mes') el.append(vistaMes(pintar));
  if (modo === 'semana') el.append(vistaSemana(pintar));
  if (modo === 'dia') el.append(vistaDia(iso(refData), pintar));

  el.append(h('div', { class: 'grid g2 mt2' }, cardHorario(pintar), cardMochila()));
}

/* ---------- coleta de eventos por dia ---------- */
export function eventosDoDia(dataISO) {
  const s = st(); const out = [];
  const d = parseISO(dataISO);
  for (const a of (s.horario[d.getDay()] || [])) out.push({ tipo: 'aula', hora: a.hora, titulo: nomeMateria(a.materiaId), materiaId: a.materiaId });
  for (const t of s.tarefas.filter((t) => t.prazo === dataISO)) out.push({ tipo: 'tarefa', hora: '', titulo: t.titulo, materiaId: t.materiaId, id: t.id, feito: t.status === 'concluido' });
  for (const p of s.provas.filter((p) => p.data === dataISO)) out.push({ tipo: 'prova', hora: '', titulo: p.titulo, materiaId: p.materiaId, id: p.id });
  for (const p of s.provas) for (const b of (p.plano || []).filter((b) => b.data === dataISO)) out.push({ tipo: 'plano', hora: '', titulo: b.titulo, materiaId: p.materiaId, feito: b.feito });
  for (const e of s.eventos.filter((e) => e.data === dataISO)) out.push({ tipo: e.tipo, hora: e.hora, titulo: e.titulo, materiaId: e.materiaId, id: e.id, evento: true });
  return out.sort((a, b) => (a.hora || 'zz').localeCompare(b.hora || 'zz'));
}

/* ---------- mês ---------- */
function vistaMes(pintar) {
  const ano = refData.getFullYear(), mes = refData.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const inicio = addDays(primeiro, -primeiro.getDay());
  const grade = h('div', { class: 'cal' });
  for (const d of DIAS_S) grade.append(h('div', { class: 'h' }, d));
  for (let i = 0; i < 42; i++) {
    const dia = addDays(inicio, i);
    const dISO = iso(dia);
    const evs = eventosDoDia(dISO);
    const cel = h('div', {
      class: `d ${dia.getMonth() !== mes ? 'out' : ''} ${dISO === iso() ? 'today' : ''}`,
      onclick: () => { refData = dia; modo = 'dia'; pintar(); },
    }, h('b', {}, dia.getDate()));
    for (const e of evs.slice(0, 3)) {
      cel.append(h('div', {
        class: 'ev', style: { background: (CORES_EV[e.tipo] || '#7c5cff') + '28', color: CORES_EV[e.tipo] || '#aaa', opacity: e.feito ? .45 : 1 },
      }, `${ICONES_EV[e.tipo] || '•'} ${e.titulo}`));
    }
    if (evs.length > 3) cel.append(h('div', { class: 'tiny muted' }, `+${evs.length - 3}`));
    grade.append(cel);
  }
  return cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, `${MESES[mes]} de ${ano}`),
      h('span', { class: 'chip sp' }, `${st().provas.filter((p) => p.data.startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}`)).length} provas no mês`)),
    grade,
    h('div', { class: 'chips mt' }, ...Object.entries(ICONES_EV).map(([k, v]) =>
      h('span', { class: 'chip', style: { color: CORES_EV[k] } }, `${v} ${k}`))));
}

/* ---------- semana ---------- */
function vistaSemana(pintar) {
  const ini = startOfWeek(refData);
  const box = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' } });
  for (let i = 0; i < 7; i++) {
    const d = addDays(ini, i), dISO = iso(d);
    const evs = eventosDoDia(dISO);
    box.append(cartao(
      h('div', { class: 'flexb mb' },
        h('b', { style: { color: dISO === iso() ? 'var(--acc)' : 'inherit' } }, `${DIAS_S[d.getDay()]} ${d.getDate()}`),
        h('span', { class: 'chip sp tiny' }, evs.length)),
      evs.length ? h('div', { class: 'list' }, ...evs.map((e) => h('div', {
        class: 'row row--flat', style: { padding: '6px 8px', opacity: e.feito ? .5 : 1 },
      },
        h('span', { class: 'tiny' }, ICONES_EV[e.tipo] || '•'),
        h('span', { class: 'grow tiny' }, e.titulo))))
        : h('p', { class: 'tiny muted' }, 'livre')));
  }
  return box;
}

/* ---------- dia ---------- */
function vistaDia(dataISO, pintar) {
  const evs = eventosDoDia(dataISO);
  const d = parseISO(dataISO);
  const box = cartao(
    h('div', { class: 'flexb mb' },
      h('b', {}, `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`),
      h('span', { class: 'chip sp' }, fmtData(dataISO))),
    evs.length ? h('div', { class: 'list' }, ...evs.map((e) => h('div', { class: `row ${e.feito ? 'dim' : ''}` },
      h('span', { class: 'lead', style: { background: CORES_EV[e.tipo] || '#7c5cff' } }),
      h('span', {}, ICONES_EV[e.tipo] || '•'),
      h('span', { class: 'grow' },
        h('div', { class: 'ttl' }, e.titulo),
        h('div', { class: 'sub' }, e.hora ? h('span', { class: 'chip' }, `🕐 ${e.hora}`) : null,
          e.materiaId ? h('span', { class: 'chip' }, nomeMateria(e.materiaId)) : null,
          h('span', { class: 'chip' }, e.tipo))),
      e.evento ? h('button', { class: 'icon-btn', onclick: () => confirmar('Apagar evento?', e.titulo, () => { remover('eventos', e.id); pintar(); }) }, '✕') : null)))
      : h('p', { class: 'muted small' }, 'Nada marcado nesse dia.'));

  if (dataISO === iso()) {
    const { blocos } = ordemRecomendada();
    box.append(h('div', { class: 'hr' }));
    box.append(h('b', { class: 'small' }, '☀️ Plano de estudo sugerido para hoje'));
    box.append(blocos.length
      ? h('div', { class: 'list mt' }, ...blocos.filter((b) => !b.pausa).map((b, i) =>
        h('a', { class: 'row row--flat', href: `#/foco?tarefa=${b.tarefaId}&min=${b.minutos}`, style: { color: 'inherit' } },
          h('b', { style: { width: '16px' } }, i + 1),
          h('span', { class: 'grow small' }, b.titulo),
          h('span', { class: 'chip' }, fmtMin(b.minutos)))))
      : h('p', { class: 'tiny muted' }, 'Sem tarefas em aberto.'));
  }
  return box;
}

/* ---------- horário escolar ---------- */
function cardHorario(pintar) {
  const s = st();
  const box = cartao(h('div', { class: 'flexb mb' }, h('b', {}, '🏫 Horário escolar'),
    h('button', { class: 'btn btn--sm sp', onclick: () => editarHorario(pintar) }, '✏️ Editar')));
  const hoje = new Date().getDay();
  for (let d = 1; d <= 5; d++) {
    const aulas = s.horario[d] || [];
    box.append(h('div', { class: 'flexb', style: { padding: '5px 0', borderBottom: '1px solid var(--line)' } },
      h('b', { class: 'tiny', style: { width: '46px', color: d === hoje ? 'var(--acc)' : 'var(--dim)' } }, DIAS_S[d]),
      h('div', { class: 'chips grow' }, ...(aulas.length ? aulas.map((a) =>
        h('span', { class: 'chip', title: a.hora }, `${emojiMateria(a.materiaId)} ${nomeMateria(a.materiaId).slice(0, 10)}`))
        : [h('span', { class: 'tiny muted' }, 'sem aulas')]))));
  }
  return box;
}

function editarHorario(aoSalvar) {
  const s = st();
  const rascunho = JSON.parse(JSON.stringify(s.horario || {}));
  const corpo = h('div', {});
  const pintarDia = (d) => {
    const wrap = h('div', { class: 'mb' }, h('b', { class: 'small' }, DIAS[d]));
    const lista = h('div', { class: 'list mt' });
    const redraw = () => {
      lista.replaceChildren(...(rascunho[d] || []).map((a, i) => {
        const hora = inp({ type: 'time', value: a.hora, style: { maxWidth: '110px' } });
        hora.addEventListener('change', () => { rascunho[d][i].hora = hora.value; });
        const mat = selMateria(a.materiaId);
        mat.addEventListener('change', () => { rascunho[d][i].materiaId = mat.value || null; });
        return h('div', { class: 'row row--flat' }, hora, h('span', { class: 'grow' }, mat),
          h('button', { class: 'icon-btn', onclick: () => { rascunho[d].splice(i, 1); redraw(); } }, '✕'));
      }));
      lista.append(h('button', {
        class: 'btn btn--sm', onclick: () => { (rascunho[d] ||= []).push({ hora: '07:00', materiaId: null }); redraw(); },
      }, '+ aula'));
    };
    redraw();
    wrap.append(lista);
    return wrap;
  };
  for (let d = 1; d <= 6; d++) corpo.append(pintarDia(d));
  corpo.append(h('div', { class: 'flexb mt2' },
    h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
    h('button', {
      class: 'btn btn--p', onclick: () => {
        set((x) => { x.horario = rascunho; });
        fecharModal(); toast('Horário salvo', 'good'); aoSalvar?.();
      },
    }, 'Salvar horário')));
  modal('🏫 Horário escolar', corpo, { largo: true });
}

/* ---------- mochila digital ---------- */
function cardMochila() {
  const s = st();
  const hoje = aulasDoDia();
  const materiasHoje = [...new Set(hoje.map((a) => a.materiaId))].filter(Boolean);
  return cartao(
    h('b', {}, '🎒 Mochila digital'),
    h('p', { class: 'tiny muted' }, 'O que você precisa hoje, em um lugar só.'),
    h('div', { class: 'mb' },
      h('div', { class: 'tiny muted mb' }, 'Matérias de hoje'),
      h('div', { class: 'chips' }, ...(materiasHoje.length ? materiasHoje.map((m) =>
        h('a', { class: 'chip', href: `#/materias/${m}` }, `${emojiMateria(m)} ${nomeMateria(m)}`))
        : [h('span', { class: 'tiny muted' }, 'sem aulas hoje')]))),
    h('div', { class: 'grid g2 keep2' },
      h('a', { class: 'btn btn--blk', href: '#/biblioteca' }, '📂 Materiais'),
      h('a', { class: 'btn btn--blk', href: '#/desempenho?aba=notas' }, '📊 Notas'),
      h('a', { class: 'btn btn--blk', href: '#/tarefas' }, '✅ Tarefas'),
      h('a', { class: 'btn btn--blk', href: '#/provas' }, '🎯 Provas')));
}

/* ---------- planejamento semanal ---------- */
export function abrirSemana() {
  const s = st();
  const ini = startOfWeek(new Date()), fim = addDays(ini, 6);
  const dentro = (d) => d >= iso(ini) && d <= iso(fim);
  const provas = s.provas.filter((p) => dentro(p.data));
  const tarefas = s.tarefas.filter((t) => dentro(t.prazo) && t.status !== 'concluido');
  const trabalhos = tarefas.filter((t) => (t.minutos || 0) >= 90);
  const minutos = tarefas.reduce((a, b) => a + (b.minutos || 0), 0);
  const capacidade = (s.prefs.minutosDia || 90) * 7;

  modal('📆 Planejamento da semana', h('div', {},
    h('div', { class: 'grid g4 keep2 mb' },
      h('div', { class: 'kpi' }, h('b', {}, provas.length), h('span', {}, 'provas')),
      h('div', { class: 'kpi' }, h('b', {}, trabalhos.length), h('span', {}, 'trabalhos')),
      h('div', { class: 'kpi' }, h('b', {}, tarefas.length), h('span', {}, 'atividades')),
      h('div', { class: 'kpi' }, h('b', {}, fmtMin(minutos)), h('span', {}, 'de trabalho'))),
    h('p', { class: 'small' }, minutos > capacidade
      ? `⚠️ A semana pede ${fmtMin(minutos)} e seu ritmo atual cobre ${fmtMin(capacidade)}. Considere começar hoje pelas tarefas de maior nota de prioridade — ou aumentar o tempo diário nas Configurações.`
      : `✅ Cabe: ${fmtMin(minutos)} de trabalho para ${fmtMin(capacidade)} de capacidade na semana.`),
    h('div', { class: 'hr' }),
    h('b', { class: 'small' }, 'Ordem sugerida'),
    h('div', { class: 'list mt' }, ...filaTarefas().filter((t) => dentro(t.prazo)).slice(0, 8).map((t, i) =>
      h('div', { class: 'row row--flat' },
        h('b', { style: { width: '18px' } }, i + 1),
        h('span', { class: 'grow small' }, t.titulo,
          h('div', { class: 'tiny muted' }, `${nomeMateria(t.materiaId)} · ${fmtData(t.prazo)}`)),
        h('span', { class: 'chip' }, `${t._p.nota}`))))));
}

/* ---------- evento avulso ---------- */
export function formEvento(ev = null, aoSalvar = null) {
  const e = ev || { tipo: 'atividade', titulo: '', data: iso(), hora: '', materiaId: '' };
  const f = {};
  f.titulo = inp({ value: e.titulo, placeholder: 'Ex.: Entrega do trabalho de Artes' });
  f.tipo = sel([
    { v: 'aula', t: '📙 Aula' }, { v: 'prova', t: '📕 Prova' }, { v: 'trabalho', t: '📘 Trabalho' },
    { v: 'atividade', t: '📗 Atividade' }, { v: 'revisao', t: '📓 Revisão' }, { v: 'simulado', t: '🧪 Simulado' },
  ], e.tipo);
  f.data = inp({ type: 'date', value: e.data });
  f.hora = inp({ type: 'time', value: e.hora });
  f.materiaId = selMateria(e.materiaId);
  modal(ev ? '✏️ Editar evento' : '📅 Novo evento', h('div', {},
    campo('Título', f.titulo),
    h('div', { class: 'f-row' }, campo('Tipo', f.tipo), campo('Matéria', f.materiaId)),
    h('div', { class: 'f-row' }, campo('Data', f.data), campo('Hora (opcional)', f.hora)),
    h('div', { class: 'flexb mt2' },
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const d = { titulo: f.titulo.value.trim() || 'Evento', tipo: f.tipo.value, data: f.data.value, hora: f.hora.value, materiaId: f.materiaId.value || null };
          if (ev) atualizar('eventos', ev.id, d); else novoEvento(d);
          fecharModal(); toast('Evento salvo', 'good'); aoSalvar?.();
        },
      }, 'Salvar'))));
}
