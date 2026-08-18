/* ===== views/provas.js — central de provas, plano automático e modo recuperação ===== */
import { h, iso, today, addDays, fmtMin, fmtData, daysBetween, parseISO, DIAS } from '../util.js';
import { st, prova as getProva, conteudo, nomeMateria, emojiMateria, atualizar, remover } from '../store.js';
import { preparoProva, gerarPlanoProva, planoEmergencia, semaforo, iconeStatus, ganharXP } from '../engine.js';
import { titulo, cartao, kpi, barra, vazio, modal, fecharModal, toast, campo, inp, confirmar, gAnel, progresso } from '../ui.js';
import { formProva, tagMateria } from './comum.js';

export function render(el, { id }) {
  const pintar = () => { el.replaceChildren(); id ? detalhe(el, id, pintar) : lista(el, pintar); };
  pintar();
}

/* ==========================================================
   LISTA
   ========================================================== */
function lista(el, pintar) {
  const s = st();
  const futuras = s.provas.filter((p) => p.data >= iso()).sort((a, b) => a.data.localeCompare(b.data));
  const passadas = s.provas.filter((p) => p.data < iso()).sort((a, b) => b.data.localeCompare(a.data));

  el.append(titulo('🎯 Central de provas', 'Quanto falta, o que cai e se você já está pronto.',
    h('button', { class: 'btn btn--p', onclick: () => formProva(null, pintar) }, '➕ Nova prova')));

  if (!futuras.length && !passadas.length) {
    el.append(vazio('Nenhuma prova cadastrada', 'Cadastre uma prova e o StudyLab monta o plano de estudo sozinho.',
      h('button', { class: 'btn btn--p', onclick: () => formProva(null, pintar) }, '➕ Cadastrar prova')));
    return;
  }

  if (futuras.length) {
    el.append(h('div', { class: 'grid g2' }, ...futuras.map((p) => cardProva(p))));
  }
  if (passadas.length) {
    el.append(h('h3', { class: 'mt2 mb' }, 'Provas passadas'));
    el.append(h('div', { class: 'list' }, ...passadas.map((p) => h('a', {
      class: 'row', href: `#/provas/${p.id}`, style: { color: 'inherit' },
    },
      h('span', {}, emojiMateria(p.materiaId)),
      h('span', { class: 'grow' }, h('div', { class: 'ttl' }, p.titulo),
        h('div', { class: 'sub' }, h('span', { class: 'chip' }, fmtData(p.data)))),
      p.nota !== null && p.nota !== undefined ? h('span', { class: 'chip ok' }, `nota ${p.nota}`) : h('span', { class: 'chip' }, 'sem nota')))));
  }
}

function cardProva(p) {
  const pr = preparoProva(p);
  const cor = pr.preparo >= 70 ? 'ok' : pr.preparo >= 45 ? 'warn' : 'bad';
  return h('a', { href: `#/provas/${p.id}`, style: { color: 'inherit' } }, cartao(
    h('div', { class: 'flexb mb' },
      tagMateria(p.materiaId),
      h('span', { class: `chip sp ${pr.dias <= 3 ? 'bad' : pr.dias <= 7 ? 'warn' : ''}` },
        pr.dias === 0 ? '⏰ é hoje!' : `⏳ ${pr.dias} dia${pr.dias > 1 ? 's' : ''}`)),
    h('div', { style: { fontWeight: 800, fontSize: '16px' } }, p.titulo),
    h('div', { class: 'tiny muted mb' }, `${fmtData(p.data)} · vale ${p.valor} pontos`),
    progresso('Preparação', pr.preparo, { cls: cor }),
    h('div', { class: 'chips mt' }, ...pr.conteudos.slice(0, 5).map((c) =>
      h('span', { class: `chip ${semaforo(c.dominio || 0).cls}` }, `${semaforo(c.dominio || 0).emoji} ${c.nome}`)))));
}

/* ==========================================================
   DETALHE
   ========================================================== */
function detalhe(el, id, pintar) {
  const p = getProva(id);
  if (!p) { el.append(vazio('Prova não encontrada', 'Ela pode ter sido apagada.', h('a', { class: 'btn', href: '#/provas' }, 'Voltar'))); return; }
  const pr = preparoProva(p);

  el.append(h('a', { class: 'chip mb', href: '#/provas', style: { display: 'inline-flex' } }, '‹ voltar para provas'));
  el.append(titulo(`${emojiMateria(p.materiaId)} ${p.titulo}`,
    `${nomeMateria(p.materiaId)} · ${fmtData(p.data)} · vale ${p.valor} pontos`,
    h('button', { class: 'btn', onclick: () => formProva(p, pintar) }, '✏️ Editar'),
    h('button', { class: 'btn btn--p', onclick: () => abrirRecuperacao(p) }, '😵‍💫 Estou atrasado')));

  /* topo: contagem regressiva + preparo */
  el.append(h('div', { class: 'grid g3 mb' },
    cartao(h('div', { class: 'center' },
      h('div', { style: { fontSize: '44px', fontWeight: 800, lineHeight: 1 } }, pr.dias < 0 ? '—' : pr.dias),
      h('div', { class: 'muted small' }, pr.dias === 0 ? 'é hoje!' : pr.dias < 0 ? 'já passou' : `dia${pr.dias > 1 ? 's' : ''} restante${pr.dias > 1 ? 's' : ''}`))),
    cartao(h('div', { class: 'flexb' },
      h('div', { style: { color: pr.preparo >= 70 ? 'var(--ok)' : pr.preparo >= 45 ? 'var(--warn)' : 'var(--bad)' } },
        gAnel(pr.preparo / 100, { tam: 78, texto: `${pr.preparo}%`, cor: 'currentColor' })),
      h('div', { class: 'grow' }, h('b', {}, 'Preparação'),
        h('p', { class: 'tiny muted', style: { margin: 0 } },
          `domínio médio ${pr.dominioMedio}% + ${pr.feitos}/${pr.totalPlano} blocos do plano feitos`)))),
    cartao(h('b', {}, 'Conteúdos que caem'),
      h('div', { class: 'chips mt' }, ...(pr.conteudos.length ? pr.conteudos.map((c) =>
        h('span', { class: `chip ${semaforo(c.dominio || 0).cls}` }, `${semaforo(c.dominio || 0).emoji} ${c.nome} ${c.dominio || 0}%`))
        : [h('span', { class: 'tiny muted' }, 'Nenhum conteúdo marcado. Edite a prova para escolher.')])))));

  /* plano automático */
  const planoBox = cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🗓️ Plano automático até a prova'),
      h('button', {
        class: 'btn btn--sm sp', onclick: () => {
          if (!p.conteudoIds?.length) return toast('Escolha os conteúdos da prova primeiro', 'bad');
          atualizar('provas', p.id, { plano: gerarPlanoProva(getProva(p.id)) });
          toast('Plano recalculado', 'good'); pintar();
        },
      }, '🔄 Gerar/refazer plano')));

  if (!(p.plano || []).length) {
    planoBox.append(h('p', { class: 'muted small' },
      'Sem plano ainda. Clique em "Gerar plano" — o StudyLab distribui os conteúdos pelos dias, dando mais tempo ao que você domina menos, e reserva simulado + revisão final.'));
  } else {
    const porDia = {};
    for (const b of p.plano) (porDia[b.data] ||= []).push(b);
    for (const [data, blocos] of Object.entries(porDia).sort()) {
      const d = parseISO(data);
      const feitosDia = blocos.filter((b) => b.feito).length;
      planoBox.append(h('div', { class: 'mt' },
        h('div', { class: 'flexb tiny muted mb' },
          h('b', { style: { color: 'var(--txt)', textTransform: 'uppercase', letterSpacing: '.5px' } },
            `${DIAS[d.getDay()]} · ${fmtData(data, { curto: true })}`),
          h('span', { class: 'sp' }, `${feitosDia}/${blocos.length}`)),
        h('div', { class: 'list' }, ...blocos.map((b) => h('div', { class: `row row--flat ${b.feito ? 'dim' : ''}` },
          h('input', {
            type: 'checkbox', checked: b.feito || null,
            onchange: (e) => {
              atualizar('provas', p.id, (o) => {
                const bl = o.plano.find((x) => x.id === b.id); if (bl) bl.feito = e.target.checked; return o;
              });
              if (e.target.checked) { ganharXP(15, 'bloco do plano'); toast('Bloco concluído · +15 XP', 'good'); }
              pintar();
            },
          }),
          h('span', {}, { estudo: '📖', simulado: '🧪', revisao: '🔁', questoes: '📝' }[b.tipo] || '•'),
          h('span', { class: 'grow small' }, b.titulo),
          h('span', { class: 'chip' }, fmtMin(b.minutos)),
          !b.feito ? h('a', { class: 'btn btn--sm', href: `#/foco?min=${b.minutos}&titulo=${encodeURIComponent(b.titulo)}` }, '▶') : null)))));
    }
  }
  el.append(planoBox);

  /* ações rápidas */
  el.append(h('div', { class: 'grid g3 mt2' },
    h('a', { class: 'btn btn--blk', href: `#/questoes?prova=${p.id}&modo=simulado` }, '🧪 Fazer simulado desta prova'),
    h('a', { class: 'btn btn--blk', href: `#/questoes?prova=${p.id}` }, '📝 Treinar questões'),
    h('a', { class: 'btn btn--blk', href: `#/materias/${p.materiaId || ''}` }, '📚 Abrir a matéria')));

  /* nota depois da prova */
  const notaInp = inp({ type: 'number', step: .1, min: 0, value: p.nota ?? '' , placeholder: 'ex.: 8.5' });
  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '📊 Depois da prova'),
    h('p', { class: 'tiny muted' }, 'Registre a nota para o StudyLab acompanhar sua evolução e recalcular médias.'),
    h('div', { class: 'flexb' }, notaInp,
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const v = Number(notaInp.value);
          if (Number.isNaN(v)) return toast('Digite um número', 'bad');
          atualizar('provas', p.id, { nota: v });
          toast('Nota registrada', 'good'); pintar();
        },
      }, 'Salvar nota')))));
}

/* ==========================================================
   MODO RECUPERAÇÃO
   ========================================================== */
export function abrirRecuperacao(p) {
  const minInp = inp({ type: 'number', min: 15, step: 15, value: 120 });
  const saida = h('div', { class: 'mt2' });
  modal('😵‍💫 Modo recuperação', h('div', {},
    h('p', { class: 'muted small', style: { marginTop: 0 } },
      `Prova de ${nomeMateria(p.materiaId)} em ${preparoProva(p).dias} dia(s). Quanto tempo você tem HOJE?`),
    campo('Minutos disponíveis hoje', minInp),
    h('button', {
      class: 'btn btn--p btn--blk', onclick: () => {
        const { blocos, cortados } = planoEmergencia(p, Number(minInp.value) || 60);
        saida.replaceChildren(
          h('b', {}, 'Plano de emergência'),
          h('p', { class: 'tiny muted' }, 'Priorizamos o que você domina menos. O resto fica de fora — é uma escolha consciente.'),
          h('div', { class: 'list' }, ...blocos.map((b, i) => h('div', { class: 'row row--flat' },
            h('b', { style: { width: '16px' } }, i + 1),
            h('span', { class: 'grow small' }, h('div', {}, b.titulo), h('div', { class: 'tiny muted' }, b.foco)),
            h('span', { class: 'chip' }, fmtMin(b.minutos)),
            h('a', { class: 'btn btn--sm', href: `#/foco?min=${b.minutos}&titulo=${encodeURIComponent(b.titulo)}`, onclick: fecharModal }, '▶')))),
          cortados.length
            ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, `⚠️ Ficaram de fora (sem tempo hábil): ${cortados.join(', ')}.`)
            : h('p', { class: 'small', style: { color: 'var(--ok)' } }, '✅ Deu para cobrir todos os conteúdos.'));
      },
    }, 'Montar plano de emergência'),
    saida));
}
