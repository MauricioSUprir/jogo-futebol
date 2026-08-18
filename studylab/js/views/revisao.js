/* ===== views/revisao.js — revisão espaçada + banco de erros ===== */
import { h, iso, daysBetween, parseISO, fmtData, round } from '../util.js';
import { st, atualizar, nomeMateria, emojiMateria, conteudo as getConteudo, registrarTentativa } from '../store.js';
import {
  filaRevisao, bancoDeErros, proximaRevisao, PASSOS, semaforo, recalcularDominios,
  ganharXP, tocarStreak, venceHoje,
} from '../engine.js';
import { titulo, cartao, kpi, vazio, modal, fecharModal, toast, segmento, barra, progresso, gBarrasH } from '../ui.js';
import { estudar } from './flashcards.js';
import { iniciarSessao } from './questoes.js';
import { tagMateria } from './comum.js';

let aba = 'hoje';

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  const fila = filaRevisao();
  const erros = bancoDeErros();
  const pendentes = erros.filter((e) => !e.superado);

  el.append(titulo('🔁 Revisão', 'A revisão espaçada faz você lembrar por muito mais tempo.',
    h('button', { class: 'btn btn--p', disabled: !fila.total || null, onclick: () => revisarTudo(fila, pintar) }, `▶ Revisar tudo (${fila.total})`)));

  el.append(h('div', { class: 'grid g4 keep2 mb' },
    kpi(fila.cards.length, 'flashcards vencidos'),
    kpi(fila.conteudos.length, 'conteúdos a revisar'),
    kpi(pendentes.length, 'erros não superados'),
    kpi(s.conteudos.filter((c) => (c.dominio || 0) >= 80).length, 'conteúdos dominados')));

  el.append(h('div', { class: 'mb' }, segmento([
    { v: 'hoje', t: '📅 Hoje' }, { v: 'erros', t: '❌ Banco de erros' },
    { v: 'agenda', t: '🗓️ Próximas revisões' }, { v: 'como', t: 'ℹ️ Como funciona' },
  ], aba, (v) => { aba = v; pintar(); })));

  if (aba === 'hoje') abaHoje(el, fila, pintar);
  if (aba === 'erros') abaErros(el, erros, pintar);
  if (aba === 'agenda') abaAgenda(el);
  if (aba === 'como') abaComo(el);
}

/* ---------- hoje ---------- */
function abaHoje(el, fila, pintar) {
  if (!fila.total) {
    el.append(vazio('Tudo revisado 🎉', 'Nada venceu hoje. Volte amanhã — ou faça um estudo livre de flashcards.',
      h('a', { class: 'btn', href: '#/flashcards' }, '🃏 Ir para flashcards')));
    return;
  }
  el.append(h('div', { class: 'grid g3' },
    cartao(h('b', {}, '🃏 Flashcards'),
      h('div', { style: { fontSize: '30px', fontWeight: 800 } }, fila.cards.length),
      h('p', { class: 'tiny muted' }, 'cards que venceram hoje'),
      h('button', { class: 'btn btn--blk', disabled: !fila.cards.length || null, onclick: () => estudar(fila.cards) }, 'Revisar cards')),
    cartao(h('b', {}, '📚 Conteúdos'),
      h('div', { style: { fontSize: '30px', fontWeight: 800 } }, fila.conteudos.length),
      h('p', { class: 'tiny muted' }, 'assuntos na hora certa de rever'),
      h('button', {
        class: 'btn btn--blk', disabled: !fila.conteudos.length || null,
        onclick: () => listarConteudos(fila.conteudos, pintar),
      }, 'Ver lista')),
    cartao(h('b', {}, '❌ Erros'),
      h('div', { style: { fontSize: '30px', fontWeight: 800 } }, fila.erros.length),
      h('p', { class: 'tiny muted' }, 'questões erradas prontas para voltar'),
      h('button', {
        class: 'btn btn--blk', disabled: !fila.erros.length || null,
        onclick: () => iniciarSessao(fila.erros.map((e) => e.questao), { modo: 'treino', titulo: 'Revisão de erros' }),
      }, 'Refazer erros'))));
}

function listarConteudos(cs, pintar) {
  modal('📚 Conteúdos para revisar hoje', h('div', { class: 'list' }, ...cs.map((c) => h('div', { class: 'row row--flat' },
    h('span', { class: 'dot-s', style: { background: semaforo(c.dominio || 0).cor } }),
    h('span', { class: 'grow' }, h('div', { class: 'small', style: { fontWeight: 700 } }, c.nome),
      h('div', { class: 'tiny muted' }, `${nomeMateria(c.materiaId)} · domínio ${c.dominio || 0}%`)),
    h('button', {
      class: 'btn btn--sm', onclick: () => {
        atualizar('conteudos', c.id, { srs: proximaRevisao(c.srs, 2) });
        toast(`"${c.nome}" marcado como revisado`, 'good');
        recalcularDominios(); tocarStreak(); ganharXP(15, 'revisão');
        fecharModal(); pintar?.();
      },
    }, '✓ revisei')))));
}

function revisarTudo(fila, pintar) {
  if (fila.cards.length) return estudar(fila.cards);
  if (fila.erros.length) return iniciarSessao(fila.erros.map((e) => e.questao), { modo: 'treino', titulo: 'Revisão de erros' });
  listarConteudos(fila.conteudos, pintar);
}

/* ---------- banco de erros ---------- */
function abaErros(el, erros, pintar) {
  if (!erros.length) {
    el.append(vazio('Nenhum erro registrado', 'Quando você errar uma questão, ela aparece aqui automaticamente — e volta depois de alguns dias.'));
    return;
  }
  const pendentes = erros.filter((e) => !e.superado);
  const superados = erros.filter((e) => e.superado);

  el.append(cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '❌ Erros para superar'),
      h('button', {
        class: 'btn btn--sm sp', disabled: !pendentes.length || null,
        onclick: () => iniciarSessao(pendentes.map((e) => e.questao), { modo: 'treino', titulo: 'Banco de erros' }),
      }, '▶ Refazer todas')),
    pendentes.length
      ? h('div', { class: 'list' }, ...pendentes.map((e) => linhaErro(e)))
      : h('p', { class: 'muted small' }, 'Você superou todos os erros registrados. 👏')));

  if (superados.length) {
    el.append(h('div', { class: 'mt2' }, cartao(
      h('b', {}, '✅ Erros já superados'),
      h('p', { class: 'tiny muted' }, 'Você errou, mas depois acertou a mesma questão.'),
      h('div', { class: 'list' }, ...superados.slice(0, 15).map((e) => linhaErro(e, true))))));
  }
}

function linhaErro(e, superado = false) {
  const q = e.questao;
  const ultima = e.respostas[e.respostas.length - 1];
  const suaResposta = q.alternativas?.length && ultima?.resposta !== undefined && ultima.resposta !== ''
    ? q.alternativas[Number(ultima.resposta)] : (ultima?.resposta || '— em branco —');
  return h('div', { class: `row ${superado ? 'dim' : ''}`, style: { alignItems: 'flex-start', cursor: 'pointer' },
    onclick: () => verErro(e) },
    h('span', { class: 'lead', style: { background: superado ? '#34d399' : '#f87171' } }),
    h('div', { class: 'grow' },
      h('div', { class: 'ttl' }, q.enunciado.length > 100 ? q.enunciado.slice(0, 97) + '…' : q.enunciado),
      h('div', { class: 'sub' }, tagMateria(q.materiaId),
        q.conteudoId ? h('span', { class: 'chip' }, getConteudo(q.conteudoId)?.nome || '') : null,
        h('span', { class: 'chip bad' }, `errou ${e.vezes}×`),
        h('span', { class: 'chip' }, fmtData(e.ultima.slice(0, 10))))),
    h('span', {}, '›'));
}

function verErro(e) {
  const q = e.questao;
  const ultima = e.respostas[e.respostas.length - 1];
  const suaResposta = q.alternativas?.length && ultima?.resposta !== '' && ultima?.resposta !== undefined
    ? `${q.alternativas[Number(ultima.resposta)] ?? '—'}` : (ultima?.resposta || '— em branco —');
  const motivo = e.vezes >= 3 ? '🔴 Você erra sempre esta — provavelmente o conceito não ficou claro.'
    : e.vezes === 2 ? '🟡 Confusão entre conceitos parecidos.'
      : '🟠 Pode ter sido desatenção ou conteúdo pouco revisado.';
  modal('❌ Questão errada', h('div', {},
    h('p', { style: { marginTop: 0, fontWeight: 600 } }, q.enunciado),
    h('div', { class: 'card card--flat mb' },
      h('div', { class: 'small' }, h('b', {}, 'Sua resposta: '), suaResposta),
      h('div', { class: 'small' }, h('b', {}, 'Resposta correta: '), q.alternativas?.length ? q.alternativas[q.correta] : (q.resposta || '—'))),
    h('div', { class: 'card card--flat mb' }, h('b', { class: 'small' }, 'Motivo provável'), h('p', { class: 'small', style: { marginBottom: 0 } }, motivo)),
    q.explicacao ? h('div', { class: 'card card--flat mb' }, h('b', { class: 'small' }, '💡 Explicação'), h('p', { class: 'small', style: { marginBottom: 0 } }, q.explicacao)) : null,
    h('div', { class: 'flexb mt' },
      h('a', { class: 'btn', href: `#/aprender?tema=${encodeURIComponent(q.enunciado.slice(0, 80))}`, onclick: fecharModal }, '🧠 Me explica isso'),
      h('button', { class: 'btn btn--p sp', onclick: () => { fecharModal(); iniciarSessao([q], { modo: 'treino' }); } }, '▶ Tentar de novo'))));
}

/* ---------- agenda de revisões ---------- */
function abaAgenda(el) {
  const s = st();
  const dias = {};
  for (const f of s.flashcards) { const d = f.srs?.proxima || iso(); (dias[d] ||= { cards: 0, conteudos: 0 }).cards++; }
  for (const c of s.conteudos) { if (c.status === 'novo') continue; const d = c.srs?.proxima || iso(); (dias[d] ||= { cards: 0, conteudos: 0 }).conteudos++; }
  const linhas = Object.entries(dias).sort().slice(0, 21).map(([d, v]) => ({
    rot: `${fmtData(d, { curto: true })} ${daysBetween(new Date(), parseISO(d)) <= 0 ? '(vencido)' : ''}`,
    v: v.cards + v.conteudos,
    cor: daysBetween(new Date(), parseISO(d)) <= 0 ? '#f87171' : '#7c5cff',
  }));
  el.append(cartao(
    h('b', {}, '🗓️ Próximas revisões'),
    h('p', { class: 'tiny muted' }, 'Quantos itens cada dia vai pedir. Dias muito cheios? Antecipe um pouco.'),
    linhas.length ? h('div', { class: 'mt' }, gBarrasH(linhas, { formato: (v) => `${v} itens` }))
      : h('p', { class: 'muted small' }, 'Nada agendado ainda.')));
}

/* ---------- como funciona ---------- */
function abaComo(el) {
  el.append(cartao(
    h('b', {}, '🧠 Como a revisão espaçada funciona aqui'),
    h('p', { class: 'small' }, 'Você não precisa revisar tudo todo dia. O StudyLab reapresenta cada assunto pouco antes de você esquecer:'),
    h('div', { class: 'chips mb' }, ...PASSOS.map((p, i) => h('span', { class: 'chip chip--on' }, `${i + 1}ª revisão: +${p} dia${p > 1 ? 's' : ''}`))),
    h('ul', { class: 'small' },
      h('li', {}, 'Se você acerta com facilidade, o intervalo aumenta (e você revisa menos).'),
      h('li', {}, 'Se erra, o assunto volta no mesmo dia e recomeça a escada.'),
      h('li', {}, 'Depois da 5ª revisão o intervalo dobra a cada acerto — 60, 120 dias…'),
      h('li', {}, 'O índice de domínio cai sozinho com o tempo sem revisar: é o esquecimento sendo levado a sério.')),
    h('div', { class: 'hr' }),
    h('b', { class: 'small' }, '📉 Como o domínio é calculado'),
    h('p', { class: 'small', style: { marginBottom: 0 } },
      'Acerto recente nas questões (peso maior para as últimas), quantas questões e flashcards diferentes você já viu do assunto, '
      + 'a força atual na escada de revisão e quanto tempo passou desde a última vez. Sem evidência, vale o que você marcou à mão.')));
}
