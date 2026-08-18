/* ===== views/studyai.js — o assistente que conhece seus dados ===== */
import { h, iso, uid, fmtMin } from '../util.js';
import { st, set, nomeMateria } from '../store.js';
import { resumoPeriodo, filaRevisao, filaTarefas, preparoProva, nivelDe } from '../engine.js';
import { titulo, cartao, vazio, modal, fecharModal, toast, campo, inp, txtarea, confirmar, paywall } from '../ui.js';
import { temIA, motivoIA, chat, contextoDoAluno, observacoesLocais } from '../ai.js';

const SUGESTOES = [
  'O que eu estudo agora?',
  'Monte meu plano de estudo para hoje',
  'Estou pronto para a próxima prova?',
  'Quais são meus pontos mais fracos?',
  'Explique meu pior conteúdo de forma simples',
  'Como eu organizo a semana com essas tarefas?',
];

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  el.append(titulo('🤖 Study AI', 'Ele conhece suas matérias, provas, erros e calendário.',
    h('button', { class: 'btn', onclick: () => verContexto() }, '👁️ O que ele sabe'),
    h('button', { class: 'btn', onclick: () => abrirMemoria(pintar) }, '🧠 Memória')));

  if (!temIA()) {
    const porQue = motivoIA();
    el.append(h('div', { class: 'mb' }, porQue === 'PRO'
      ? paywall('O Study AI é do plano Pro',
        'Ele conhece suas matérias, suas provas, seus erros e seu calendário — e responde com base nos seus dados de verdade, '
        + 'não em achismo. Pergunte "o que eu estudo agora?" e veja a diferença.')
      : paywall('Study AI temporariamente indisponível',
        'Sua assinatura está ativa, mas o servidor do Study AI ainda não foi configurado. Avise o suporte do StudyLab.')));

    el.append(cartao(
      h('b', {}, '🤔 O que ele responderia com os seus dados'),
      h('p', { class: 'tiny muted' }, 'Exemplos reais do que o Study AI usa quando é liberado:'),
      h('div', { class: 'chips' }, ...SUGESTOES.map((sg) => h('span', { class: 'chip' }, sg))),
      h('a', { class: 'btn btn--p mt', href: '#/planos' }, '✨ Ver planos')));

    el.append(h('div', { class: 'mt2' }, cartaoObservacoes()));
    return;
  }

  /* ---------- chat ---------- */
  let historico = s.conversas?.length ? [...s.conversas] : [];
  const chatBox = h('div', { class: 'chat card', style: { minHeight: '46dvh', maxHeight: '60dvh', overflowY: 'auto' } });
  const entrada = txtarea({ placeholder: 'Pergunte qualquer coisa sobre seus estudos…', style: { minHeight: '52px' } });

  function pintarChat() {
    chatBox.replaceChildren();
    if (!historico.length) {
      chatBox.append(h('div', { class: 'msg sys' }, 'Comece perguntando alguma coisa — ou escolha uma sugestão abaixo.'));
    }
    for (const m of historico) chatBox.append(h('div', { class: `msg ${m.autor === 'me' ? 'me' : 'ai'}` }, m.txt));
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function enviar(txt) {
    const pergunta = (txt ?? entrada.value).trim();
    if (!pergunta) return;
    entrada.value = '';
    historico.push({ autor: 'me', txt: pergunta });
    pintarChat();
    const pensando = h('div', { class: 'msg ai typing' }, h('i'), h('i'), h('i'));
    chatBox.append(pensando); chatBox.scrollTop = chatBox.scrollHeight;
    try {
      const r = await chat(historico.slice(0, -1), pergunta);
      pensando.remove();
      historico.push({ autor: 'ai', txt: r });
      set((x) => { x.conversas = historico.slice(-40); });
      pintarChat();
    } catch (e) {
      pensando.remove();
      historico.push({ autor: 'ai', txt: `⚠️ ${e.message}` });
      pintarChat();
    }
  }

  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
  });

  el.append(chatBox);
  el.append(h('div', { class: 'flexb mt' },
    entrada,
    h('button', { class: 'btn btn--p', onclick: () => enviar() }, 'Enviar')));
  el.append(h('div', { class: 'chips mt' }, ...SUGESTOES.map((sg) =>
    h('button', { class: 'chip', style: { cursor: 'pointer' }, onclick: () => enviar(sg) }, sg))));
  el.append(h('div', { class: 'flexb mt' },
    h('button', {
      class: 'btn btn--sm', onclick: () => confirmar('Limpar conversa?', 'O histórico desta conversa será apagado.', () => {
        historico = []; set((x) => { x.conversas = []; }); pintarChat();
      }),
    }, '🗑️ Limpar conversa'),
    h('span', { class: 'tiny muted sp' }, `${s.ia.usoHoje || 0} chamadas hoje · modelo ${s.ia.modelo}`)));
  el.append(h('div', { class: 'mt2' }, cartaoObservacoes()));
  pintarChat();
}

/* ---------- memória / observações ---------- */
function cartaoObservacoes() {
  const obs = observacoesLocais();
  const s = st();
  return cartao(
    h('b', {}, '🧠 O que o StudyLab já percebeu'),
    h('p', { class: 'tiny muted' }, 'Padrões calculados a partir do seu próprio histórico — sem IA, sem achismo.'),
    obs.length ? h('div', { class: 'list mt' }, ...obs.map((o) => h('div', { class: 'row row--flat' },
      h('span', {}, '💡'), h('span', { class: 'grow small' }, o))))
      : h('p', { class: 'muted small' }, 'Ainda não há histórico suficiente. Depois de algumas sessões e questões, isto aqui se preenche sozinho.'),
    s.ia.memoria?.length
      ? h('div', { class: 'mt' }, h('b', { class: 'small' }, '📌 Anotações que você fixou'),
        h('div', { class: 'list mt' }, ...s.ia.memoria.map((m) => h('div', { class: 'row row--flat' }, h('span', { class: 'grow small' }, m)))))
      : null);
}

function abrirMemoria(aoSalvar) {
  const s = st();
  const nova = inp({ placeholder: 'Ex.: eu me confundo com datas; prefiro exemplos práticos' });
  const lista = h('div', { class: 'list' });
  const pintar = () => {
    lista.replaceChildren(...(st().ia.memoria || []).map((m, i) => h('div', { class: 'row row--flat' },
      h('span', { class: 'grow small' }, m),
      h('button', { class: 'icon-btn', onclick: () => { set((x) => x.ia.memoria.splice(i, 1)); pintar(); } }, '✕'))));
    if (!st().ia.memoria?.length) lista.append(h('p', { class: 'tiny muted' }, 'Nada anotado ainda.'));
  };
  pintar();
  modal('🧠 Memória do assistente', h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } },
      'Coisas que o Study AI deve lembrar sobre como você aprende. Elas entram em toda conversa.'),
    h('div', { class: 'flexb mb' }, nova,
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const v = nova.value.trim(); if (!v) return;
          set((x) => { (x.ia.memoria ||= []).push(v); }); nova.value = ''; pintar(); aoSalvar?.();
        },
      }, 'Adicionar')),
    lista));
}

function verContexto() {
  modal('👁️ O que o Study AI recebe', h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } },
      'Isto é exatamente o texto enviado junto de cada pergunta. Nada além disso sai do seu aparelho.'),
    h('pre', {
      class: 'card card--flat small',
      style: { whiteSpace: 'pre-wrap', maxHeight: '50dvh', overflow: 'auto', fontSize: '11.5px', lineHeight: 1.5 },
    }, contextoDoAluno())), { largo: true });
}
