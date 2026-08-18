/* ===== views/materias.js — central de matérias + mapa do conhecimento ===== */
import { h, iso, fmtMin, round, avg } from '../util.js';
import {
  st, set, materia as getMateria, conteudo as getConteudo, novaMateria, novoConteudo,
  atualizar, remover, nomeMateria, emojiMateria, corMateria,
} from '../store.js';
import { dominioMateria, semaforo, iconeStatus, mediaMateria, calcularDominio, recalcularDominios } from '../engine.js';
import { titulo, cartao, kpi, barra, vazio, modal, fecharModal, toast, campo, inp, sel, txtarea, confirmar, gAnel, progresso, segmento } from '../ui.js';
import { tagMateria, formFlashcard } from './comum.js';

const EMOJIS = ['📖', '📐', '🏛️', '🌎', '🌐', '🔬', '⚗️', '🧬', '🎨', '🎵', '⚽', '💻', '📊', '🧮', '🗿', '📜', '🧠', '🌱'];
const CORES = ['#7c5cff', '#60a5fa', '#22d3ee', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#f472b6', '#a78bfa'];

export function render(el, { id }) {
  const pintar = () => { el.replaceChildren(); id ? detalhe(el, id, pintar) : lista(el, pintar); };
  pintar();
}

/* ---------- lista ---------- */
function lista(el, pintar) {
  const s = st();
  el.append(titulo('📚 Matérias', 'Cada matéria com seus conteúdos, domínio e média.',
    h('button', { class: 'btn', onclick: () => { recalcularDominios(); toast('Domínios recalculados', 'good'); pintar(); } }, '🔄 Recalcular'),
    h('button', { class: 'btn btn--p', onclick: () => formMateria(null, pintar) }, '➕ Nova matéria')));

  if (!s.materias.length) {
    el.append(vazio('Sem matérias', 'Cadastre suas matérias para começar.',
      h('button', { class: 'btn btn--p', onclick: () => formMateria(null, pintar) }, '➕ Nova matéria')));
    return;
  }
  el.append(h('div', { class: 'grid g3' }, ...s.materias.filter((m) => !m.arquivada).map((m) => cardMateria(m))));

  const arq = s.materias.filter((m) => m.arquivada);
  if (arq.length) {
    el.append(h('h3', { class: 'mt2 mb' }, 'Arquivadas'));
    el.append(h('div', { class: 'chips' }, ...arq.map((m) => h('a', { class: 'chip', href: `#/materias/${m.id}` }, `${m.emoji} ${m.nome}`))));
  }
}

function cardMateria(m) {
  const dom = dominioMateria(m.id);
  const sm = semaforo(dom);
  const media = mediaMateria(m.id);
  const cs = st().conteudos.filter((c) => c.materiaId === m.id);
  return h('a', { href: `#/materias/${m.id}`, style: { color: 'inherit' } }, cartao(
    h('div', { class: 'flexb mb' },
      h('span', { style: { fontSize: '26px' } }, m.emoji),
      h('div', { class: 'grow' },
        h('b', {}, m.nome),
        h('div', { class: 'tiny muted' }, m.professor ? `prof. ${m.professor}` : 'sem professor')),
      h('span', { class: `chip ${sm.cls}` }, sm.emoji)),
    h('div', { class: 'flexb mb' },
      h('div', {}, h('div', { class: 'tiny muted' }, 'média'), h('b', { style: { fontSize: '20px' } }, media ?? '—')),
      h('div', { class: 'sp right' }, h('div', { class: 'tiny muted' }, 'meta'), h('b', {}, m.meta ?? '—'))),
    progresso('Domínio da matéria', dom, { cls: sm.cls }),
    h('div', { class: 'tiny muted mt' }, `${cs.length} conteúdo(s) · ${cs.filter((c) => (c.dominio || 0) >= 80).length} dominado(s)`)));
}

/* ---------- detalhe ---------- */
function detalhe(el, id, pintar) {
  const m = getMateria(id);
  if (!m) { el.append(vazio('Matéria não encontrada', '', h('a', { class: 'btn', href: '#/materias' }, 'Voltar'))); return; }
  const s = st();
  const cs = s.conteudos.filter((c) => c.materiaId === m.id);
  const dom = dominioMateria(m.id);
  const media = mediaMateria(m.id);

  el.append(h('a', { class: 'chip mb', href: '#/materias', style: { display: 'inline-flex' } }, '‹ todas as matérias'));
  el.append(titulo(`${m.emoji} ${m.nome}`, `${m.professor ? 'prof. ' + m.professor + ' · ' : ''}${cs.length} conteúdos`,
    h('button', { class: 'btn', onclick: () => formMateria(m, pintar) }, '✏️ Editar'),
    h('button', { class: 'btn btn--p', onclick: () => formConteudo(null, m.id, null, pintar) }, '➕ Conteúdo')));

  el.append(h('div', { class: 'grid g4 keep2 mb' },
    kpi(media ?? '—', 'média atual', `meta ${m.meta ?? '—'}`),
    kpi(`${dom}%`, 'domínio', semaforo(dom).rot),
    kpi(cs.filter((c) => (c.dominio || 0) >= 80).length, 'dominados'),
    kpi(cs.filter((c) => (c.dominio || 0) < 40 && c.status !== 'novo').length, 'na faixa vermelha')));

  /* mapa do conhecimento */
  const raizes = cs.filter((c) => !c.paiId);
  const mapa = cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🗺️ Mapa do conhecimento'),
      h('span', { class: 'chip sp' }, 'clique para editar')),
    h('div', { class: 'chips mb' },
      h('span', { class: 'chip ok' }, '🟢 80–100 dominado'), h('span', { class: 'chip warn' }, '🟡 60–79 revisar'),
      h('span', { class: 'chip alert' }, '🟠 40–59 atenção'), h('span', { class: 'chip bad' }, '🔴 0–39 prioridade')),
    raizes.length ? arvore(raizes, cs, m.id, pintar) : h('p', { class: 'muted small' }, 'Nenhum conteúdo cadastrado ainda.'));
  el.append(mapa);

  /* ações */
  el.append(h('div', { class: 'grid g4 mt2' },
    h('a', { class: 'btn btn--blk', href: `#/questoes?materia=${m.id}` }, '📝 Questões'),
    h('a', { class: 'btn btn--blk', href: `#/flashcards?materia=${m.id}` }, '🃏 Flashcards'),
    h('a', { class: 'btn btn--blk', href: `#/aprender?materia=${m.id}` }, '🧠 Aprender'),
    h('button', { class: 'btn btn--blk', onclick: () => abrirDiagnostico(m) }, '🧪 Diagnóstico')));
}

function arvore(nos, todos, materiaId, pintar) {
  const ul = h('ul', { class: 'tree' });
  for (const c of nos) {
    const filhos = todos.filter((x) => x.paiId === c.id);
    const sm = semaforo(c.dominio || 0);
    const li = h('li', {},
      h('div', {
        class: 'node', onclick: () => formConteudo(c, materiaId, c.paiId, pintar),
      },
        h('span', {}, iconeStatus(c.status)),
        h('span', { class: 'nm' }, c.nome),
        h('span', { class: 'tiny muted nowrap' }, `${c.dominio || 0}%`),
        h('span', { class: 'dot-s', style: { background: sm.cor } })),
      filhos.length ? arvore(filhos, todos, materiaId, pintar) : null);
    ul.append(li);
  }
  return ul;
}

/* ---------- formulários ---------- */
export function formMateria(m = null, aoSalvar = null) {
  const d = m || { nome: '', emoji: '📘', cor: CORES[0], professor: '', meta: 9, arquivada: false };
  const f = {};
  f.nome = inp({ value: d.nome, placeholder: 'Ex.: História' });
  f.professor = inp({ value: d.professor, placeholder: 'Nome do professor (opcional)' });
  f.meta = inp({ type: 'number', step: .1, min: 0, max: 10, value: d.meta });

  let emoji = d.emoji, cor = d.cor;
  const gradeE = h('div', { class: 'chips' }, ...EMOJIS.map((e) => {
    const b = h('button', { class: `chip ${e === emoji ? 'chip--on' : ''}`, style: { cursor: 'pointer', fontSize: '16px' }, onclick: () => { emoji = e; [...gradeE.children].forEach((c, i) => c.classList.toggle('chip--on', EMOJIS[i] === emoji)); } }, e);
    return b;
  }));
  const gradeC = h('div', { class: 'chips' }, ...CORES.map((c) =>
    h('button', {
      class: 'chip', style: { cursor: 'pointer', background: c, width: '30px', height: '24px', border: c === cor ? '2px solid #fff' : '1px solid transparent' },
      onclick: () => { cor = c; [...gradeC.children].forEach((b, i) => { b.style.border = CORES[i] === cor ? '2px solid #fff' : '1px solid transparent'; }); },
    }, '')));

  modal(m ? '✏️ Editar matéria' : '📚 Nova matéria', h('div', {},
    campo('Nome', f.nome),
    h('div', { class: 'f-row' }, campo('Professor', f.professor), campo('Meta de média', f.meta)),
    h('label', { class: 'f' }, h('span', {}, 'Ícone'), gradeE),
    h('label', { class: 'f' }, h('span', {}, 'Cor'), gradeC),
    h('div', { class: 'flexb mt2' },
      m ? h('button', {
        class: 'btn btn--d', onclick: () => confirmar('Apagar matéria?', 'Os conteúdos dela também serão apagados.', () => {
          set((s) => { s.conteudos = s.conteudos.filter((c) => c.materiaId !== m.id); });
          remover('materias', m.id); fecharModal(); location.hash = '#/materias';
        }),
      }, 'Apagar') : null,
      m ? h('button', { class: 'btn', onclick: () => { atualizar('materias', m.id, { arquivada: !m.arquivada }); fecharModal(); aoSalvar?.(); } }, m.arquivada ? 'Desarquivar' : 'Arquivar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const dados = { nome: f.nome.value.trim() || 'Matéria', professor: f.professor.value.trim(), meta: Number(f.meta.value) || 9, emoji, cor };
          if (m) atualizar('materias', m.id, dados); else novaMateria(dados);
          fecharModal(); toast('Matéria salva', 'good'); aoSalvar?.();
        },
      }, 'Salvar'))));
}

const STATUS_CONTEUDO = [
  { v: 'novo', t: '⚪ Ainda não estudei' }, { v: 'estudando', t: '🔵 Estudando' },
  { v: 'revisar', t: '🟡 Precisa revisar' }, { v: 'dificuldade', t: '🔴 Tenho dificuldade' },
  { v: 'dominado', t: '✅ Dominado' },
];

export function formConteudo(c = null, materiaId = null, paiId = null, aoSalvar = null) {
  const d = c || { nome: '', status: 'novo', dominio: 0, materiaId, paiId };
  const f = {};
  f.nome = inp({ value: d.nome, placeholder: 'Ex.: Revolução Francesa' });
  f.status = sel(STATUS_CONTEUDO, d.status);
  f.dominio = inp({ type: 'range', min: 0, max: 100, value: d.dominio || 0 });
  const vDom = h('b', {}, `${d.dominio || 0}%`);
  f.dominio.addEventListener('input', () => { vDom.textContent = `${f.dominio.value}%`; });
  const irmaos = st().conteudos.filter((x) => x.materiaId === (d.materiaId || materiaId) && x.id !== d.id);
  f.paiId = sel([{ v: '', t: '— conteúdo principal —' }, ...irmaos.map((x) => ({ v: x.id, t: `dentro de: ${x.nome}` }))], d.paiId || '');

  modal(c ? '✏️ Editar conteúdo' : '📗 Novo conteúdo', h('div', {},
    campo('Nome', f.nome),
    campo('Onde encaixa', f.paiId),
    campo('Como você se sente', f.status),
    h('label', { class: 'f' },
      h('span', {}, h('span', {}, 'Domínio estimado '), vDom),
      f.dominio,
      h('p', { class: 'tiny muted', style: { margin: '4px 0 0' } },
        'Esse valor é recalculado sozinho conforme você responde questões e revisa. Ajuste à mão só no começo.')),
    c ? h('p', { class: 'tiny muted' }, `Última revisão: ${c.srs?.ultima || 'nunca'} · próxima: ${c.srs?.proxima || '—'}`) : null,
    h('div', { class: 'flexb mt2' },
      c ? h('button', {
        class: 'btn btn--d', onclick: () => confirmar('Apagar conteúdo?', 'Os sub-conteúdos também somem.', () => {
          set((s) => { s.conteudos = s.conteudos.filter((x) => x.id !== c.id && x.paiId !== c.id); });
          fecharModal(); aoSalvar?.();
        }),
      }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const dados = {
            nome: f.nome.value.trim() || 'Conteúdo', status: f.status.value,
            dominio: Number(f.dominio.value) || 0, paiId: f.paiId.value || null,
            materiaId: d.materiaId || materiaId || null,
          };
          if (c) atualizar('conteudos', c.id, dados); else novoConteudo(dados);
          fecharModal(); toast('Conteúdo salvo', 'good'); aoSalvar?.();
        },
      }, 'Salvar'))));
}

/* ---------- diagnóstico ---------- */
export function abrirDiagnostico(m) {
  const cs = st().conteudos.filter((c) => c.materiaId === m.id);
  const qs = st().questoes.filter((q) => q.materiaId === m.id);
  modal(`🧪 Diagnóstico de ${m.nome}`, h('div', {},
    h('p', { class: 'muted small', style: { marginTop: 0 } },
      'O diagnóstico faz de 10 a 20 questões variadas e mostra onde você está forte e onde está fraco. '
      + 'Depois disso o StudyLab ajusta o domínio de cada conteúdo e sugere o plano.'),
    h('div', { class: 'list mb' },
      h('div', { class: 'row row--flat' }, h('span', { class: 'grow small' }, 'Conteúdos cadastrados'), h('b', {}, cs.length)),
      h('div', { class: 'row row--flat' }, h('span', { class: 'grow small' }, 'Questões disponíveis'), h('b', {}, qs.length))),
    qs.length >= 5
      ? h('a', { class: 'btn btn--p btn--blk', href: `#/questoes?materia=${m.id}&modo=diagnostico`, onclick: fecharModal }, '▶ Começar diagnóstico')
      : h('div', {},
        h('p', { class: 'small', style: { color: 'var(--warn)' } },
          'Você tem poucas questões dessa matéria. Gere questões primeiro (com o Study AI ou manualmente).'),
        h('a', { class: 'btn btn--p btn--blk', href: `#/questoes?materia=${m.id}&gerar=1`, onclick: fecharModal }, '📝 Gerar questões'))));
}
