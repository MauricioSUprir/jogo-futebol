/* ===== views/desempenho.js — analytics, notas, simulador e metas ===== */
import { h, fmtMin, iso, round, sum, avg, DIAS_S, parseISO, fmtData, nf, addDays, today, daysBetween } from '../util.js';
import { st, set, nomeMateria, emojiMateria, corMateria, atualizar, remover, novaMeta } from '../store.js';
import {
  resumoPeriodo, serieDiaria, desempenhoPorMateria, mediaMateria, mediaGeral, simularNota, seTirar,
  dominioMateria, semaforo, nivelDe, atividadeDoDia,
} from '../engine.js';
import {
  titulo, cartao, kpi, vazio, modal, fecharModal, toast, campo, inp, sel, segmento, confirmar,
  gBarras, gLinha, gBarrasH, gAnel, gPizza, legenda, barra, progresso,
} from '../ui.js';
import { formNota, opcoesMaterias, selMateria, tagMateria } from './comum.js';

let aba = 'geral';
let periodo = 7;

export function render(el, { params }) {
  if (params.get('aba')) aba = params.get('aba');
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  el.append(titulo('📊 Desempenho', 'Números reais do seu estudo — sem achismo.'));
  el.append(h('div', { class: 'mb' }, segmento([
    { v: 'geral', t: '📈 Visão geral' }, { v: 'graficos', t: '📊 Gráficos' },
    { v: 'notas', t: '🎓 Notas' }, { v: 'metas', t: '🎯 Metas' },
  ], aba, (v) => { aba = v; pintar(); })));

  if (aba === 'geral') abaGeral(el, pintar);
  if (aba === 'graficos') abaGraficos(el, pintar);
  if (aba === 'notas') abaNotas(el, pintar);
  if (aba === 'metas') abaMetas(el, pintar);
}

/* ---------- visão geral ---------- */
function abaGeral(el, pintar) {
  const s = st();
  const r = resumoPeriodo(periodo);
  const ant = resumoPeriodo(periodo * 2);
  const deltaMin = r.minutos - (ant.minutos - r.minutos);
  const deltaTaxa = r.taxa - (ant.taxa || 0);

  el.append(h('div', { class: 'flexb mb' },
    h('b', {}, 'Período'),
    segmento([{ v: 7, t: '7 dias' }, { v: 14, t: '14 dias' }, { v: 30, t: '30 dias' }], periodo, (v) => { periodo = Number(v); pintar(); })));

  el.append(h('div', { class: 'grid g3 mb' },
    kpi(fmtMin(r.minutos), 'tempo estudado', `${deltaMin >= 0 ? '▲' : '▼'} ${fmtMin(Math.abs(deltaMin))} vs. período anterior`),
    kpi(r.questoes, 'questões respondidas'),
    kpi(`${r.taxa}%`, 'taxa de acerto', `${deltaTaxa >= 0 ? '▲' : '▼'} ${Math.abs(round(deltaTaxa))} pontos`),
    kpi(r.dominados, 'conteúdos dominados'),
    kpi(r.sessoes, 'sessões de estudo'),
    kpi(r.tarefas, 'tarefas concluídas')));

  const serie = serieDiaria(Math.min(periodo, 14));
  el.append(h('div', { class: 'grid g2 mb' },
    cartao(h('b', {}, '⏱️ Minutos por dia'),
      h('div', { class: 'mt' }, gBarras(serie.map((d) => ({ rot: DIAS_S[parseISO(d.dia).getDay()], v: d.minutos })), { cor: '#7c5cff' }))),
    cartao(h('b', {}, '📝 Questões por dia'),
      h('div', { class: 'mt' }, gLinha(serie.map((d) => ({ rot: DIAS_S[parseISO(d.dia).getDay()], v: d.questoes })), { cor: '#22d3ee' })))));

  const porMateria = desempenhoPorMateria();
  el.append(cartao(
    h('b', {}, '📚 Por matéria'),
    h('div', { class: 'scroll-x mt' }, h('table', { class: 'tb' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Matéria'), h('th', {}, 'Domínio'), h('th', {}, 'Acerto'), h('th', {}, 'Questões'), h('th', {}, 'Tempo'), h('th', {}, 'Média'))),
      h('tbody', {}, ...porMateria.map((m) => h('tr', {},
        h('td', {}, `${m.materia.emoji} ${m.materia.nome}`),
        h('td', {}, h('div', { style: { minWidth: '90px' } }, barra(m.dominio, semaforo(m.dominio).cls), h('span', { class: 'tiny muted' }, `${m.dominio}%`))),
        h('td', {}, m.questoes ? `${m.taxa}%` : '—'),
        h('td', {}, m.questoes),
        h('td', {}, fmtMin(m.minutos)),
        h('td', {}, m.media ?? '—'))))))));

  /* pontos fortes e fracos */
  const cs = s.conteudos.filter((c) => c.status !== 'novo');
  const fortes = [...cs].sort((a, b) => (b.dominio || 0) - (a.dominio || 0)).slice(0, 5);
  const fracos = [...cs].sort((a, b) => (a.dominio || 0) - (b.dominio || 0)).slice(0, 5);
  el.append(h('div', { class: 'grid g2 mt2' },
    cartao(h('b', {}, '💪 Seus pontos fortes'),
      fortes.length ? h('div', { class: 'list mt' }, ...fortes.map((c) => h('div', { class: 'row row--flat' },
        h('span', {}, semaforo(c.dominio).emoji),
        h('span', { class: 'grow small' }, c.nome, h('div', { class: 'tiny muted' }, nomeMateria(c.materiaId))),
        h('b', {}, `${c.dominio}%`)))) : h('p', { class: 'muted small' }, 'Responda algumas questões para o StudyLab descobrir.')),
    cartao(h('b', {}, '🎯 Onde focar'),
      fracos.length ? h('div', { class: 'list mt' }, ...fracos.map((c) => h('div', { class: 'row row--flat' },
        h('span', {}, semaforo(c.dominio).emoji),
        h('span', { class: 'grow small' }, c.nome, h('div', { class: 'tiny muted' }, nomeMateria(c.materiaId))),
        h('a', { class: 'btn btn--sm', href: `#/questoes?materia=${c.materiaId}` }, 'treinar')))) : h('p', { class: 'muted small' }, '—'))));
}

/* ---------- gráficos ---------- */
function abaGraficos(el, pintar) {
  const s = st();
  const serie = serieDiaria(21);
  const porMateria = desempenhoPorMateria().filter((m) => m.minutos > 0 || m.questoes > 0);

  el.append(h('div', { class: 'grid g2 mb' },
    cartao(h('b', {}, '📈 Horas estudadas (21 dias)'),
      h('div', { class: 'mt' }, gLinha(serie.map((d, i) => ({ rot: i % 3 === 0 ? d.dia.slice(8) : '', v: round(d.minutos / 60, 1) })), { cor: '#7c5cff' })),
      h('p', { class: 'tiny muted' }, `total: ${fmtMin(sum(serie.map((d) => d.minutos)))}`)),
    cartao(h('b', {}, '🎯 Taxa de acerto por dia'),
      h('div', { class: 'mt' }, gLinha(serie.map((d, i) => ({ rot: i % 3 === 0 ? d.dia.slice(8) : '', v: d.questoes ? round((d.acertos / d.questoes) * 100) : 0 })), { cor: '#34d399' })))));

  el.append(h('div', { class: 'grid g2 mb' },
    cartao(h('b', {}, '⏱️ Tempo por matéria'),
      h('div', { class: 'flexb mt' },
        gPizza(porMateria.map((m) => ({ rot: m.materia.nome, v: m.minutos, cor: m.materia.cor })), { tam: 130 }),
        h('div', { class: 'grow' }, legenda(porMateria.map((m) => ({ rot: m.materia.nome, cor: m.materia.cor, extra: fmtMin(m.minutos) })))))),
    cartao(h('b', {}, '📚 Domínio por matéria'),
      h('div', { class: 'mt' }, gBarrasH(porMateria.map((m) => ({ rot: m.materia.nome, v: m.dominio, max: 100, cor: m.materia.cor })), { formato: (v) => `${v}%` })))));

  /* evolução das notas */
  const notas = [...s.notas].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const provasComNota = s.provas.filter((p) => p.nota !== null && p.nota !== undefined);
  el.append(h('div', { class: 'grid g2' },
    cartao(h('b', {}, '🎓 Evolução das notas'),
      notas.length
        ? h('div', { class: 'mt' }, gLinha(notas.map((n) => ({ rot: nomeMateria(n.materiaId).slice(0, 3), v: round((n.valor / (n.maximo || 10)) * 10, 1) })), { cor: '#fbbf24' }))
        : h('p', { class: 'muted small' }, 'Cadastre suas notas na aba Notas.')),
    cartao(h('b', {}, '🔥 Sequência e volume'),
      h('div', { class: 'mt' }, gBarras(serie.slice(-14).map((d) => ({ rot: d.dia.slice(8), v: d.questoes, cor: d.minutos > 0 ? '#22d3ee' : '#242a3d' })), { cor: '#22d3ee' })),
      h('p', { class: 'tiny muted' }, `recorde de sequência: ${s.jogo.recordeStreak || 0} dias · atual: ${s.jogo.streak}`))));
}

/* ---------- notas ---------- */
function abaNotas(el, pintar) {
  const s = st();
  const geral = mediaGeral();
  el.append(h('div', { class: 'flexb mb' },
    h('button', { class: 'btn btn--p', onclick: () => formNota(null, pintar) }, '➕ Nova nota'),
    h('button', { class: 'btn sp', onclick: () => abrirSimulador() }, '🧮 Simulador de notas')));

  el.append(h('div', { class: 'grid g4 keep2 mb' },
    kpi(geral ?? '—', 'média geral'),
    kpi(s.notas.length, 'avaliações lançadas'),
    kpi(s.materias.filter((m) => (mediaMateria(m.id) ?? 0) >= (m.meta || 9)).length, 'matérias na meta'),
    kpi(s.materias.filter((m) => (mediaMateria(m.id) ?? 10) < 6).length, 'em risco')));

  el.append(cartao(h('b', {}, '📋 Médias por matéria'),
    h('div', { class: 'list mt' }, ...s.materias.map((m) => {
      const md = mediaMateria(m.id);
      const meta = m.meta || 9;
      const p = md === null ? 0 : Math.min(100, (md / meta) * 100);
      return h('div', { class: 'row row--flat' },
        h('span', {}, m.emoji),
        h('div', { class: 'grow' },
          h('div', { class: 'flexb tiny' }, h('b', {}, m.nome), h('span', { class: 'sp muted' }, `meta ${meta}`)),
          barra(p, md === null ? '' : md >= meta ? 'ok' : md >= meta - 1 ? 'warn' : 'bad')),
        h('b', { style: { minWidth: '38px', textAlign: 'right' } }, md ?? '—'));
    }))));

  el.append(h('div', { class: 'mt2' }, cartao(h('b', {}, '🗂️ Todas as avaliações'),
    s.notas.length
      ? h('div', { class: 'scroll-x mt' }, h('table', { class: 'tb' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Avaliação'), h('th', {}, 'Matéria'), h('th', {}, 'Nota'), h('th', {}, 'Peso'), h('th', {}, 'Bim.'), h('th', {}, ''))),
        h('tbody', {}, ...[...s.notas].reverse().map((n) => h('tr', {},
          h('td', {}, n.titulo),
          h('td', {}, nomeMateria(n.materiaId)),
          h('td', {}, `${n.valor}/${n.maximo}`),
          h('td', {}, n.peso),
          h('td', {}, `${n.bimestre}º`),
          h('td', {}, h('button', { class: 'btn btn--sm', onclick: () => formNota(n, pintar) }, '✏️')))))))
      : h('p', { class: 'muted small' }, 'Nenhuma nota lançada ainda.'))));
}

/* ---------- simulador ---------- */
export function abrirSimulador() {
  const f = {};
  f.materia = selMateria(st().materias[0]?.id || '');
  f.alvo = inp({ type: 'number', step: .1, min: 0, max: 10, value: 8 });
  f.valor = inp({ type: 'number', step: .5, min: .5, value: 10 });
  f.peso = inp({ type: 'number', step: .5, min: .5, value: 1 });
  const saida = h('div', { class: 'mt2' });

  const calcular = () => {
    const mid = f.materia.value;
    if (!mid) { saida.replaceChildren(h('p', { class: 'small muted' }, 'Escolha uma matéria.')); return; }
    const alvo = Number(f.alvo.value) || 8;
    const r = simularNota({ materiaId: mid, alvo, valorProxima: Number(f.valor.value) || 10, pesoProxima: Number(f.peso.value) || 1 });
    const cenarios = [10, 9, 8, 7, 6, 5].map((n) => ({ n, m: seTirar({ materiaId: mid, nota: n, pesoProxima: Number(f.peso.value) || 1 }) }));
    saida.replaceChildren(
      h('div', { class: 'card card--flat' },
        h('p', { class: 'small', style: { marginTop: 0 } },
          `Média atual em ${nomeMateria(mid)}: `, h('b', {}, r.mediaAtual ?? '—')),
        r.possivel
          ? h('p', { style: { margin: 0 } }, 'Para fechar com média ', h('b', {}, alvo), ' você precisa tirar ',
            h('b', { style: { color: 'var(--acc2)', fontSize: '20px' } }, Math.max(0, r.precisa)),
            r.precisa <= 0 ? ' — já está garantido! 🎉' : ` (equivale a ${Math.max(0, r.emPontos)} dos ${f.valor.value} pontos).`)
          : h('p', { style: { margin: 0, color: 'var(--bad)' } },
            `Não dá para chegar a ${alvo} só com esta avaliação: seria preciso ${r.precisa}. Ajuste a meta ou considere mais avaliações.`)),
      h('b', { class: 'small mt' }, 'E se eu tirar…'),
      h('div', { class: 'list mt' }, ...cenarios.map((c) => h('div', { class: 'row row--flat' },
        h('span', { class: 'grow small' }, `Se eu tirar ${c.n}`),
        h('b', { style: { color: c.m >= 6 ? 'var(--ok)' : 'var(--bad)' } }, `média ${c.m}`)))));
  };
  [f.materia, f.alvo, f.valor, f.peso].forEach((x) => x.addEventListener('input', calcular));
  f.materia.addEventListener('change', calcular);

  modal('🧮 Simulador de notas', h('div', {},
    campo('Matéria', f.materia),
    h('div', { class: 'f-row' }, campo('Média que você quer', f.alvo), campo('A próxima avaliação vale', f.valor)),
    campo('Peso da próxima avaliação', f.peso),
    saida));
  calcular();
}

/* ---------- metas ---------- */
const TIPOS_META = [
  { v: 'academica', t: '📚 Acadêmica (média)' }, { v: 'semanal', t: '📆 Semanal (dias estudando)' },
  { v: 'tempo', t: '⏱️ Tempo (minutos na semana)' }, { v: 'conhecimento', t: '🧠 Conhecimento (domínio %)' },
];

function progressoMeta(m) {
  const s = st();
  if (m.tipo === 'academica') return { atual: mediaMateria(m.materiaId) ?? 0, alvo: m.alvo, sufixo: '' };
  if (m.tipo === 'tempo') {
    const ini = addDays(today(), -6);
    return { atual: sum(s.sessoes.filter((x) => parseISO(x.em.slice(0, 10)) >= ini).map((x) => x.minutos)), alvo: m.alvo, sufixo: ' min' };
  }
  if (m.tipo === 'semanal') {
    const ini = addDays(today(), -6);
    const dias = new Set(s.sessoes.filter((x) => parseISO(x.em.slice(0, 10)) >= ini).map((x) => x.em.slice(0, 10)));
    return { atual: dias.size, alvo: m.alvo, sufixo: ' dias' };
  }
  if (m.tipo === 'conhecimento') return { atual: m.materiaId ? dominioMateria(m.materiaId) : 0, alvo: m.alvo, sufixo: '%' };
  return { atual: 0, alvo: m.alvo, sufixo: '' };
}

function abaMetas(el, pintar) {
  const s = st();
  el.append(h('div', { class: 'flexb mb' },
    h('button', { class: 'btn btn--p', onclick: () => formMeta(null, pintar) }, '➕ Nova meta')));
  if (!s.metas.length) {
    el.append(vazio('Sem metas', 'Metas dão direção: "média 9 em História", "estudar 5 dias por semana".',
      h('button', { class: 'btn btn--p', onclick: () => formMeta(null, pintar) }, '➕ Criar meta')));
    return;
  }
  el.append(h('div', { class: 'grid g2' }, ...s.metas.map((m) => {
    const p = progressoMeta(m);
    const pct = Math.min(100, (p.atual / (p.alvo || 1)) * 100);
    return cartao(
      h('div', { class: 'flexb mb' },
        h('b', {}, m.titulo),
        h('button', { class: 'icon-btn sp', onclick: () => formMeta(m, pintar) }, '✏️')),
      h('div', { class: 'flexb mb' },
        h('span', { class: 'chip' }, TIPOS_META.find((t) => t.v === m.tipo)?.t || m.tipo),
        m.materiaId ? tagMateria(m.materiaId) : null,
        m.prazo ? h('span', { class: 'chip sp' }, `até ${fmtData(m.prazo)}`) : null),
      progresso(`${round(p.atual, 1)}${p.sufixo} de ${p.alvo}${p.sufixo}`, pct, { cls: pct >= 100 ? 'ok' : pct >= 60 ? 'warn' : '' }),
      pct >= 100 ? h('p', { class: 'small', style: { color: 'var(--ok)', marginBottom: 0 } }, '🎉 Meta atingida!') : null);
  })));
}

function formMeta(meta = null, aoSalvar = null) {
  const m = meta || { titulo: '', tipo: 'semanal', alvo: 5, materiaId: '', prazo: '' };
  const f = {};
  f.titulo = inp({ value: m.titulo, placeholder: 'Ex.: Média 9 em História' });
  f.tipo = sel(TIPOS_META, m.tipo);
  f.alvo = inp({ type: 'number', step: .5, value: m.alvo });
  f.materia = selMateria(m.materiaId);
  f.prazo = inp({ type: 'date', value: m.prazo || '' });
  modal(meta ? '✏️ Editar meta' : '🎯 Nova meta', h('div', {},
    campo('Título', f.titulo),
    h('div', { class: 'f-row' }, campo('Tipo', f.tipo), campo('Alvo', f.alvo)),
    h('div', { class: 'f-row' }, campo('Matéria (se aplicar)', f.materia), campo('Prazo (opcional)', f.prazo)),
    h('div', { class: 'flexb mt2' },
      meta ? h('button', { class: 'btn btn--d', onclick: () => confirmar('Apagar meta?', '', () => { remover('metas', meta.id); fecharModal(); aoSalvar?.(); }) }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const d = {
            titulo: f.titulo.value.trim() || 'Meta', tipo: f.tipo.value, alvo: Number(f.alvo.value) || 1,
            materiaId: f.materia.value || null, prazo: f.prazo.value || null,
          };
          if (meta) atualizar('metas', meta.id, d); else novaMeta(d);
          fecharModal(); toast('Meta salva', 'good'); aoSalvar?.();
        },
      }, 'Salvar'))));
}
