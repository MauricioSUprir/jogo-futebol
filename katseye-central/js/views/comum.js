/* ===== views/comum.js — peças compartilhadas entre telas =====
   Formulários de compromisso e tarefa, as linhas de lista e a captura
   rápida em linguagem natural. Início e Agenda usam os dois.              */

import { h, iso, hoje, fmtData, addDias, cortar } from '../util.js';
import {
  st, novoEvento, novaTarefa, concluirTarefa, set, registrar,
  TIPOS_EVENTO, tipoEvento, integrantes,
} from '../store.js';
import { interpretar, notaPrioridade, corPrioridade, EXEMPLOS } from '../engine.js';
import {
  modal, fecharModal, campo, inp, txtarea, sel, segmento, toast,
  confirmar, monograma, tremer, entrada,
} from '../ui.js';

const opcoesIntegrantes = () => [{ v: '', t: 'Ninguém em específico' },
  ...integrantes().map((m) => ({ v: m.id, t: m.nome }))];

/* ==========================================================
   FORMULÁRIO DE COMPROMISSO
   ========================================================== */
export function abrirFormEvento(evento = null, aoSalvar = () => {}) {
  const e = evento || { titulo: '', data: iso(hoje()), hora: '', tipo: 'outro', local: '', integranteId: '', nota: '', repete: '' };
  const cTitulo = inp({ value: e.titulo, placeholder: 'Ex.: ensaio geral' });
  const cData = inp({ type: 'date', value: e.data });
  const cHora = inp({ type: 'time', value: e.hora });
  const cLocal = inp({ value: e.local, placeholder: 'Ex.: estúdio, São Paulo, online' });
  const cMembro = sel(opcoesIntegrantes(), e.integranteId);
  const cNota = txtarea({ value: e.nota, placeholder: 'Detalhes, links, quem confirma…', rows: 3 });
  const cRepete = sel([
    { v: '', t: 'Não repete' }, { v: 'diario', t: 'Todo dia' },
    { v: 'semanal', t: 'Toda semana' }, { v: 'mensal', t: 'Todo mês' },
  ], e.repete);

  let tipo = e.tipo;
  const corpo = h('div', {},
    campo('O que é', cTitulo),
    h('label', { class: 'f' }, h('span', {}, 'Tipo'),
      segmento(TIPOS_EVENTO.map((t) => ({ v: t.id, t: `${t.emoji} ${t.nome.split(' / ')[0]}` })), tipo, (v) => { tipo = v; })),
    h('div', { class: 'f-row' }, campo('Data', cData), campo('Hora (opcional)', cHora)),
    campo('Onde', cLocal),
    h('div', { class: 'f-row' }, campo('Integrante envolvida', cMembro), campo('Repetição', cRepete)),
    campo('Observações', cNota),
    h('div', { class: 'flexb mt' },
      evento ? h('button', {
        class: 'btn btn--d',
        onclick: () => confirmar('Apagar compromisso?', `"${e.titulo}" sai da agenda.`, () => {
          set((s) => { s.eventos = s.eventos.filter((x) => x.id !== e.id); });
          fecharModal(); toast('Compromisso apagado'); aoSalvar();
        }),
      }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p',
        onclick: () => {
          const titulo = cTitulo.value.trim();
          if (!titulo) { tremer(cTitulo); cTitulo.focus(); return; }
          const dados = {
            titulo, data: cData.value || iso(hoje()), hora: cHora.value, tipo,
            local: cLocal.value.trim(), integranteId: cMembro.value,
            nota: cNota.value.trim(), repete: cRepete.value,
          };
          if (evento) {
            set((s) => { const o = s.eventos.find((x) => x.id === e.id); if (o) Object.assign(o, dados); });
            registrar(tipoEvento(tipo).emoji, 'Compromisso atualizado', titulo, '#/agenda');
            toast('Compromisso atualizado', 'good');
          } else {
            novoEvento(dados);
            toast('Compromisso na agenda', 'good');
          }
          fecharModal(); aoSalvar();
        },
      }, evento ? 'Salvar' : 'Adicionar')));

  modal(evento ? '✏️ Editar compromisso' : '📅 Novo compromisso', corpo);
}

/* ==========================================================
   FORMULÁRIO DE TAREFA
   ========================================================== */
export function abrirFormTarefa(tarefa = null, aoSalvar = () => {}) {
  const t = tarefa || {
    titulo: '', prazo: iso(addDias(hoje(), 2)), importancia: 3, esforco: 2,
    integranteId: '', nota: '', tags: [],
  };
  const cTitulo = inp({ value: t.titulo, placeholder: 'Ex.: fechar o cartaz do evento' });
  const cPrazo = inp({ type: 'date', value: t.prazo });
  const cMembro = sel(opcoesIntegrantes(), t.integranteId);
  const cTags = inp({ value: (t.tags || []).join(', '), placeholder: 'campanha, urgente, design' });
  const cNota = txtarea({ value: t.nota || '', placeholder: 'O que precisa acontecer para isso ficar pronto?', rows: 3 });

  let importancia = t.importancia;
  let esforco = t.esforco;

  const corpo = h('div', {},
    campo('A tarefa', cTitulo),
    campo('Prazo', cPrazo),
    h('label', { class: 'f' }, h('span', {}, 'Importância'),
      segmento([
        { v: 1, t: 'Baixa' }, { v: 2, t: 'Média-' }, { v: 3, t: 'Média' },
        { v: 4, t: 'Alta' }, { v: 5, t: 'Crítica' },
      ], importancia, (v) => { importancia = Number(v); })),
    h('label', { class: 'f' }, h('span', {}, 'Esforço'),
      segmento([
        { v: 1, t: 'Minutos' }, { v: 2, t: 'Uma hora' },
        { v: 3, t: 'Meio dia' }, { v: 4, t: 'Dias' },
      ], esforco, (v) => { esforco = Number(v); })),
    h('div', { class: 'f-row' }, campo('Integrante envolvida', cMembro), campo('Etiquetas', cTags)),
    campo('Observações', cNota),
    h('div', { class: 'flexb mt' },
      tarefa ? h('button', {
        class: 'btn btn--d',
        onclick: () => confirmar('Apagar tarefa?', `"${t.titulo}" some da lista.`, () => {
          set((s) => { s.tarefas = s.tarefas.filter((x) => x.id !== t.id); });
          fecharModal(); toast('Tarefa apagada'); aoSalvar();
        }),
      }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p',
        onclick: () => {
          const titulo = cTitulo.value.trim();
          if (!titulo) { tremer(cTitulo); cTitulo.focus(); return; }
          const dados = {
            titulo, prazo: cPrazo.value || iso(hoje()), importancia, esforco,
            integranteId: cMembro.value, nota: cNota.value.trim(),
            tags: cTags.value.split(',').map((x) => x.trim()).filter(Boolean),
          };
          if (tarefa) {
            set((s) => { const o = s.tarefas.find((x) => x.id === t.id); if (o) Object.assign(o, dados); });
            toast('Tarefa atualizada', 'good');
          } else {
            novaTarefa(dados);
            toast('Tarefa criada', 'good');
          }
          fecharModal(); aoSalvar();
        },
      }, tarefa ? 'Salvar' : 'Criar')));

  modal(tarefa ? '✏️ Editar tarefa' : '✅ Nova tarefa', corpo);
}

/* ==========================================================
   LINHAS DE LISTA
   ========================================================== */
export function linhaTarefa(t, aoMudar = () => {}, { compacta = false } = {}) {
  const nota = notaPrioridade(t);
  const p = corPrioridade(nota);
  const feita = t.status === 'concluida';
  const membro = integrantes().find((m) => m.id === t.integranteId);

  const marcar = h('button', {
    class: 'icon-btn',
    title: feita ? 'Reabrir' : 'Concluir',
    onclick: (ev) => {
      ev.stopPropagation();
      concluirTarefa(t.id, !feita);
      if (!feita) { registrar('✅', 'Tarefa concluída', t.titulo, '#/agenda'); toast('Feito 🎉', 'good'); }
      aoMudar();
    },
  }, feita ? '↩️' : '○');

  return h('div', {
    class: `row ${feita ? 'dim' : ''}`,
    onclick: () => abrirFormTarefa(t, aoMudar),
    style: { cursor: 'pointer' },
  },
    h('span', { class: 'lead', style: { background: feita ? 'var(--line)' : p.cor } }),
    marcar,
    h('span', { class: 'grow' },
      h('div', { class: 'ttl', style: feita ? { textDecoration: 'line-through' } : {} },
        t.titulo,
        !feita && nota >= 90 ? h('span', { class: 'chip bad' }, 'atrasada') : null),
      compacta ? null : h('div', { class: 'sub' },
        h('span', {}, `📅 ${fmtData(t.prazo)}`),
        membro ? h('span', {}, `${membro.bandeira || '👤'} ${membro.nome}`) : null,
        ...(t.tags || []).slice(0, 2).map((tag) => h('span', {}, `#${tag}`)))),
    feita ? null : h('span', { class: `chip ${p.cls}` }, p.rot));
}

export function linhaEvento(e, aoMudar = () => {}, { data = null } = {}) {
  const tipo = tipoEvento(e.tipo);
  const membro = integrantes().find((m) => m.id === e.integranteId);
  return h('div', {
    class: 'row',
    style: { cursor: 'pointer' },
    onclick: () => abrirFormEvento(e, aoMudar),
  },
    h('span', { class: 'lead', style: { background: tipo.cor } }),
    h('span', { style: { fontSize: '17px' } }, tipo.emoji),
    h('span', { class: 'grow' },
      h('div', { class: 'ttl' }, e.titulo, e.repete ? h('span', { class: 'chip' }, '🔁') : null),
      h('div', { class: 'sub' },
        h('span', {}, `${fmtData(data || e.data)}${e.hora ? ` · ${e.hora}` : ''}`),
        e.local ? h('span', {}, `📍 ${cortar(e.local, 24)}`) : null,
        membro ? h('span', {}, `${membro.bandeira || '👤'} ${membro.nome}`) : null)),
    membro ? monograma(membro, { tamanho: 30, raio: 9 }) : null);
}

/* ==========================================================
   CAPTURA RÁPIDA EM LINGUAGEM NATURAL
   ========================================================== */
/**
 * O campo onde se escreve "reunião de pauta sexta 15h" e o app entende.
 * Mostra o que entendeu ANTES de salvar, e deixa trocar entre compromisso e
 * tarefa com um toque — porque o interpretador acerta muito, não sempre.
 */
export function capturaRapida(aoCriar = () => {}) {
  const entrada$ = h('input', {
    class: 'qa__in',
    placeholder: 'Escreva naturalmente: "ensaio sexta 19h no estúdio"',
    'aria-label': 'Adicionar por escrito',
  });
  const previa = h('div', { class: 'qa__prev', hidden: true });
  const botao = h('button', { class: 'btn btn--p qa__go', onclick: () => confirmarCriacao() }, 'Adicionar');

  let leitura = null;

  function atualizar() {
    const txt = entrada$.value.trim();
    if (!txt) { previa.hidden = true; leitura = null; return; }
    leitura = interpretar(txt);
    if (!leitura) { previa.hidden = true; return; }
    const outro = leitura.kind === 'evento' ? 'tarefa' : 'compromisso';
    previa.replaceChildren(
      h('div', { class: 'flexb' },
        h('span', { class: 'grow' },
          h('b', {}, leitura.dados.titulo), h('br'),
          h('span', { class: 'small muted' }, leitura.explicacao)),
        h('button', {
          class: 'btn btn--xs',
          title: `Tratar como ${outro}`,
          onclick: () => { trocarTipo(); },
        }, `↔ virar ${outro}`)));
    if (previa.hidden) { previa.hidden = false; entrada(previa, { duracao: 180 }); }
  }

  function trocarTipo() {
    if (!leitura) return;
    if (leitura.kind === 'evento') {
      leitura = {
        kind: 'tarefa',
        dados: {
          titulo: leitura.dados.titulo, prazo: leitura.dados.data, importancia: 3,
          esforco: 2, integranteId: leitura.dados.integranteId, tags: [],
        },
        explicacao: `Tarefa · prazo ${fmtData(leitura.dados.data)}`,
      };
    } else {
      leitura = {
        kind: 'evento',
        dados: {
          titulo: leitura.dados.titulo, data: leitura.dados.prazo, hora: '',
          tipo: 'outro', local: '', integranteId: leitura.dados.integranteId, repete: '',
        },
        explicacao: `📌 Compromisso · ${fmtData(leitura.dados.prazo)}`,
      };
    }
    const txt = entrada$.value;
    entrada$.value = txt;                       // mantém o texto, troca só a leitura
    const outro = leitura.kind === 'evento' ? 'tarefa' : 'compromisso';
    previa.replaceChildren(
      h('div', { class: 'flexb' },
        h('span', { class: 'grow' },
          h('b', {}, leitura.dados.titulo), h('br'),
          h('span', { class: 'small muted' }, leitura.explicacao)),
        h('button', { class: 'btn btn--xs', onclick: trocarTipo }, `↔ virar ${outro}`)));
  }

  function confirmarCriacao() {
    if (!leitura) { tremer(entrada$); entrada$.focus(); return; }
    if (leitura.kind === 'tarefa') novaTarefa(leitura.dados);
    else novoEvento(leitura.dados);
    toast(leitura.kind === 'tarefa' ? 'Tarefa criada ✅' : 'Compromisso na agenda 📅', 'good');
    entrada$.value = '';
    previa.hidden = true;
    leitura = null;
    aoCriar();
  }

  entrada$.addEventListener('input', atualizar);
  entrada$.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); confirmarCriacao(); }
    if (ev.key === 'Escape') { entrada$.value = ''; previa.hidden = true; leitura = null; }
  });

  const exemplos = h('div', { class: 'qa__hint' },
    h('span', {}, 'Tente:'),
    ...EXEMPLOS.slice(0, 3).map((ex) => h('button', {
      class: 'chip chip--btn',
      onclick: () => { entrada$.value = ex; atualizar(); entrada$.focus(); },
    }, ex)));

  const caixa = h('div', {},
    h('div', { class: 'qa' }, h('span', { class: 'qa__ico' }, '⌨️'), entrada$, botao),
    previa,
    exemplos);
  caixa.focar = () => entrada$.focus();
  return caixa;
}
