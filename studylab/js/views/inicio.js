/* ===== views/inicio.js — Dashboard principal ===== */
import { h, saudacao, iso, today, addDays, fmtMin, daysBetween, parseISO, fmtData, DIAS } from '../util.js';
import { st, nomeMateria, emojiMateria, corMateria } from '../store.js';
import {
  filaTarefas, ordemRecomendada, agoraFaca, faixaPrioridade, filaRevisao, missao5min,
  preparoProva, agendaDoDia, fechamentoDoDia, atividadeDoDia, resumoPeriodo, nivelDe, aulasDoDia,
} from '../engine.js';
import { cartao, kpi, barra, toast, modal, fecharModal, gAnel, progresso } from '../ui.js';
import { linhaTarefa, tagMateria } from './comum.js';
import { formTarefa } from './comum.js';

const ICONE_AGENDA = { aula: '📙', tarefa: '📗', prova: '📕', trabalho: '📘', revisao: '📓', simulado: '🧪', plano: '🗓️' };

export function render(el, ctx) {
  const s = st();
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  const fila = filaTarefas();
  const amanha = iso(addDays(today(), 1));
  const paraAmanha = fila.filter((t) => t.prazo === amanha).length;
  const atrasadas = fila.filter((t) => t._p.atrasada).length;
  const provaMaisProxima = [...s.provas].filter((p) => p.data >= iso()).sort((a, b) => a.data.localeCompare(b.data))[0];
  const rev = filaRevisao();
  const nv = nivelDe(s.jogo.xp);

  /* ---------- saudação ---------- */
  const frases = [];
  if (paraAmanha) frases.push(`${paraAmanha} tarefa${paraAmanha > 1 ? 's' : ''} para amanhã`);
  if (atrasadas) frases.push(`${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}`);
  if (provaMaisProxima) {
    const d = daysBetween(today(), parseISO(provaMaisProxima.data));
    frases.push(`prova de ${nomeMateria(provaMaisProxima.materiaId)} ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`}`);
  }
  if (rev.total) frases.push(`${rev.total} revisõe${rev.total > 1 ? 's' : ''} vencendo`);

  el.append(h('div', { class: 'hero mb' },
    h('h1', {}, `${saudacao()}, ${s.perfil.nome} 👋`),
    h('p', {}, frases.length ? 'Você tem ' + frases.join(', ') + '.' : 'Nada urgente agora. Bom momento para adiantar alguma coisa.'),
    h('div', { class: 'flexb', style: { marginTop: '14px' } },
      h('a', { class: 'btn btn--p', href: '#/foco' }, '▶ Começar a estudar'),
      h('button', { class: 'btn', onclick: () => abrirMissao() }, '⚡ Missão de 5 minutos'),
      h('a', { class: 'btn', href: '#/agenda' }, '📅 Ver meu dia'))));

  /* ---------- assinatura terminando ---------- */
  if (s.conta?.plano === 'pro' && s.conta.proAte) {
    const faltam = daysBetween(today(), parseISO(s.conta.proAte));
    if (faltam <= 5) {
      el.append(h('div', { class: 'card mb', style: { borderColor: faltam < 0 ? '#f8717166' : '#fbbf2466' } },
        h('div', { class: 'flexb' },
          h('span', { style: { fontSize: '22px' } }, faltam < 0 ? '⏳' : '⚠️'),
          h('div', { class: 'grow' },
            h('b', { class: 'small' }, faltam < 0 ? 'Sua assinatura venceu' : faltam === 0 ? 'Seu Pro termina hoje' : `Seu Pro termina em ${faltam} dia(s)`),
            h('div', { class: 'tiny muted' }, faltam < 0
              ? 'O Study AI ficou indisponível. Renove para voltar a usar.'
              : `Renove para não perder o Study AI. Vence em ${fmtData(s.conta.proAte)}.`)),
          h('a', { class: 'btn btn--p', href: '#/planos' }, 'Renovar'))));
    }
  }

  /* ---------- app novo: primeiros passos ---------- */
  if (!s.tarefas.length && !s.provas.length) {
    const feito = (ok, txt, acao) => h('div', { class: 'row row--flat' },
      h('span', {}, ok ? '✅' : '⬜'),
      h('span', { class: 'grow small', style: ok ? { opacity: .55 } : {} }, txt),
      ok ? null : acao);
    el.append(cartao(
      h('b', {}, '🚀 Primeiros passos'),
      h('p', { class: 'tiny muted' }, 'Seu StudyLab começa vazio de propósito. Três minutos e ele já trabalha por você.'),
      h('div', { class: 'list mt' },
        feito(s.materias.length > 0, `Cadastrar suas matérias (${s.materias.length})`,
          h('a', { class: 'btn btn--sm', href: '#/materias' }, 'Matérias')),
        feito(false, 'Anotar a primeira tarefa ou dever',
          h('button', { class: 'btn btn--sm btn--p', onclick: () => formTarefa(null, pintar) }, '➕ Tarefa')),
        feito(false, 'Marcar a próxima prova — o plano de estudo sai pronto',
          h('a', { class: 'btn btn--sm', href: '#/provas' }, 'Provas')),
        feito(Object.keys(s.horario || {}).length > 0, 'Montar o horário escolar',
          h('a', { class: 'btn btn--sm', href: '#/agenda' }, 'Agenda')),
        feito(s.flashcards.length > 0 || s.questoes.length > 0, 'Criar um flashcard ou uma questão',
          h('a', { class: 'btn btn--sm', href: '#/flashcards' }, 'Flashcards')))));
    el.append(h('div', { class: 'mt2' }));
  }

  /* ---------- FAÇA ISSO AGORA (anti-procrastinação) ---------- */
  const agora = agoraFaca();
  el.append(h('div', { class: 'grid g2 mb' },
    cartao(
      h('div', { class: 'flexb mb' }, h('b', {}, '🚫 Modo anti-procrastinação'),
        h('span', { class: 'chip sp' }, 'uma coisa por vez')),
      agora
        ? h('div', {},
          h('p', { class: 'muted small', style: { margin: '0 0 6px' } }, 'Não pense na lista inteira. Faça só isto:'),
          h('div', { style: { fontSize: '19px', fontWeight: 800, marginBottom: '4px' } }, `${emojiMateria(agora.materiaId)} ${agora.titulo}`),
          h('div', { class: 'muted small mb' }, `${nomeMateria(agora.materiaId)} · ⏱️ ${fmtMin(agora.minutos)}`),
          h('a', { class: 'btn btn--p btn--blk btn--xl', href: `#/foco?tarefa=${agora.tarefaId}&min=${agora.minutos}` }, '▶ COMEÇAR'))
        : h('div', { class: 'empty' },
          h('b', {}, s.tarefas.length ? 'Nada na fila 🎉' : 'Sem tarefas ainda'),
          h('span', {}, s.tarefas.length
            ? 'Todas as tarefas estão concluídas.'
            : 'Assim que você anotar a primeira tarefa, o StudyLab diz por onde começar.'),
          s.tarefas.length ? null : h('div', { class: 'mt' },
            h('button', { class: 'btn btn--p', onclick: () => formTarefa(null, pintar) }, '➕ Primeira tarefa')))),
    cartao(
      h('div', { class: 'flexb mb' }, h('b', {}, '🎯 Ordem recomendada de hoje'),
        h('span', { class: 'chip sp' }, `${s.prefs.minutosDia} min`)),
      blocosDoDia())));

  /* ---------- Hoje + Prioridades ---------- */
  el.append(h('div', { class: 'grid g2 mb' }, cardHoje(), cardPrioridades(pintar)));

  /* ---------- Provas + Revisão + Progresso ---------- */
  el.append(h('div', { class: 'grid g3 mb' }, cardProvas(), cardRevisao(rev), cardProgresso(nv)));

  /* ---------- Fechamento do dia ---------- */
  el.append(cardFechamento());
}

/* ---------- blocos ---------- */
function blocosDoDia() {
  const { blocos, minutosPlanejados } = ordemRecomendada();
  if (!blocos.length) return h('p', { class: 'muted small' }, 'Sem tarefas em aberto para planejar.');
  const box = h('div', { class: 'list' });
  let i = 0;
  for (const b of blocos) {
    if (b.pausa) {
      box.append(h('div', { class: 'row row--flat', style: { opacity: .7 } },
        h('span', {}, '☕'), h('span', { class: 'grow small muted' }, 'Pausa'), h('span', { class: 'chip' }, fmtMin(b.minutos))));
      continue;
    }
    i++;
    box.append(h('a', { class: 'row row--flat', href: `#/foco?tarefa=${b.tarefaId}&min=${b.minutos}`, style: { color: 'inherit' } },
      h('span', { class: 'lead', style: { background: faixaPrioridade(b.nota).cor } }),
      h('b', { style: { width: '16px' } }, i),
      h('span', { class: 'grow' },
        h('div', { class: 'small', style: { fontWeight: 700 } }, b.titulo),
        h('div', { class: 'tiny muted' }, nomeMateria(b.materiaId))),
      h('span', { class: 'chip' }, fmtMin(b.minutos))));
  }
  box.append(h('p', { class: 'tiny muted' }, `Total planejado: ${fmtMin(minutosPlanejados)}. A ordem evita ficar horas na mesma matéria.`));
  return box;
}

function cardHoje() {
  const itens = agendaDoDia();
  const box = cartao(h('div', { class: 'flexb mb' }, h('b', {}, '📅 Hoje'),
    h('a', { class: 'chip sp', href: '#/agenda' }, 'ver agenda')));
  if (!itens.length) { box.append(h('p', { class: 'muted small' }, 'Nada marcado para hoje.')); return box; }
  const lista = h('div', { class: 'list' });
  for (const it of itens.slice(0, 8)) {
    lista.append(h('div', { class: 'row row--flat' },
      h('span', {}, ICONE_AGENDA[it.tipo] || '•'),
      h('span', { class: 'grow' },
        h('div', { class: 'small', style: { fontWeight: 600 } }, it.titulo),
        h('div', { class: 'tiny muted' }, [it.hora, it.materiaId ? nomeMateria(it.materiaId) : null].filter(Boolean).join(' · '))),
      h('span', { class: 'chip' }, it.tipo)));
  }
  box.append(lista);
  return box;
}

function cardPrioridades(pintar) {
  const fila = filaTarefas().slice(0, 5);
  const box = cartao(h('div', { class: 'flexb mb' }, h('b', {}, '🚨 Prioridades'),
    h('a', { class: 'chip sp', href: '#/tarefas' }, 'ver tudo')));
  if (!fila.length) { box.append(h('p', { class: 'muted small' }, 'Nenhuma tarefa em aberto. 🎉')); return box; }
  const lista = h('div', { class: 'list' });
  for (const t of fila) lista.append(linhaTarefa(t, { aoMudar: pintar }));
  box.append(lista);
  return box;
}

function cardProvas() {
  const s = st();
  const provas = s.provas.filter((p) => p.data >= iso()).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3);
  const box = cartao(h('div', { class: 'flexb mb' }, h('b', {}, '🎯 Próximas provas'),
    h('a', { class: 'chip sp', href: '#/provas' }, 'central')));
  if (!provas.length) { box.append(h('p', { class: 'muted small' }, 'Nenhuma prova marcada.')); return box; }
  for (const p of provas) {
    const pr = preparoProva(p);
    box.append(h('a', { href: `#/provas/${p.id}`, style: { color: 'inherit', display: 'block', marginBottom: '10px' } },
      h('div', { class: 'flexb tiny mb' },
        h('span', {}, `${emojiMateria(p.materiaId)} ${nomeMateria(p.materiaId)}`),
        h('b', { class: 'sp', style: { color: pr.dias <= 3 ? 'var(--bad)' : 'inherit' } }, pr.dias === 0 ? 'hoje!' : `${pr.dias} dias`)),
      barra(pr.preparo, pr.preparo >= 70 ? 'ok' : pr.preparo >= 45 ? 'warn' : 'bad'),
      h('div', { class: 'tiny muted', style: { marginTop: '3px' } }, `preparo ${pr.preparo}%`)));
  }
  return box;
}

function cardRevisao(rev) {
  return cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🔁 Revisão de hoje')),
    h('div', { style: { fontSize: '34px', fontWeight: 800, lineHeight: 1 } }, rev.total),
    h('p', { class: 'muted small' }, `${rev.cards.length} flashcards · ${rev.conteudos.length} conteúdos · ${rev.erros.length} erros`),
    h('a', { class: 'btn btn--blk', href: '#/revisao' }, rev.total ? 'Revisar agora' : 'Ver revisões'));
}

function cardProgresso(nv) {
  const r = resumoPeriodo(7);
  return cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '📈 Sua semana')),
    h('div', { class: 'flexb' },
      h('div', { style: { color: 'var(--acc)' } }, gAnel(nv.progresso, { tam: 66, larguraTraco: 7, texto: String(nv.nivel) })),
      h('div', { class: 'grow' },
        h('div', { class: 'small' }, `${fmtMin(r.minutos)} estudados`),
        h('div', { class: 'small' }, `${r.questoes} questões · ${r.taxa}% acerto`),
        h('div', { class: 'tiny muted' }, `nível ${nv.nivel} — ${nv.titulo}`))),
    h('a', { class: 'btn btn--blk mt', href: '#/desempenho' }, 'Ver desempenho'));
}

function cardFechamento() {
  const f = fechamentoDoDia();
  const linhas = [];
  if (f.minutos) linhas.push(`✅ estudou ${fmtMin(f.minutos)}`);
  if (f.questoes) linhas.push(`✅ respondeu ${f.questoes} questões`);
  if (f.tarefas) linhas.push(`✅ terminou ${f.tarefas} atividade${f.tarefas > 1 ? 's' : ''}`);
  if (f.cards) linhas.push(`✅ revisou ${f.cards} flashcards`);
  return cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🌙 Fechamento do dia'),
      h('span', { class: 'chip sp' }, fmtData(iso()))),
    linhas.length
      ? h('div', { class: 'small' }, ...linhas.map((l) => h('div', {}, l)))
      : h('p', { class: 'muted small', style: { margin: 0 } }, 'Ainda não houve atividade hoje. Dez minutos já contam para a sequência 🔥'),
    f.restantes
      ? h('p', { class: 'small', style: { marginBottom: 0 } }, `Restam ${f.restantes} tarefa(s) com prazo até amanhã.`)
      : null);
}

/* ---------- missão de 5 minutos ---------- */
export function abrirMissao() {
  const ops = missao5min();
  modal('⚡ Missão de 5 minutos', h('div', {},
    h('p', { class: 'muted small', style: { marginTop: 0 } },
      'Sem vontade? Escolha uma coisa pequena. Começar é a parte difícil.'),
    h('div', { class: 'list' }, ...ops.map((o) =>
      h('a', {
        class: 'row', href: o.rota, style: { color: 'inherit' }, onclick: () => fecharModal(),
      }, h('span', { style: { fontSize: '18px' } }, o.icone), h('span', { class: 'grow small' }, o.txt), h('span', {}, '›'))))));
}
