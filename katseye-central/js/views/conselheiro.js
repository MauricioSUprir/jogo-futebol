/* ===== views/conselheiro.js — Conselheiro Estratégico =====
   O agente que conversa. Com IA ligada, fala com a Claude; sem IA, responde
   pelo motor local — e a tela DIZ em qual dos dois está, mensagem por
   mensagem. Também lê a resposta em voz alta, se o navegador tiver voz.    */

import { h, textoRico, fmtQuando, cortar, esperar } from '../util.js';
import {
  st, set, novaConversa, addMensagem, removerConversa, conversa as acharConversa, registrar,
} from '../store.js';
import {
  perguntar, contexto, modoIA, motivoIA, PRESETS, usoHoje,
  falar, pararDeFalar, temVoz, provedor,
} from '../ia.js';
import {
  tituloPagina, painel, vazio, toast, modal, confirmar, txtarea, inp,
  cascata, entrada, aviso, campo, tremer,
} from '../ui.js';

let conversaAtual = null;
let ocupado = false;

export function render(alvo) {
  const s = st();
  if (!conversaAtual || !acharConversa(conversaAtual)) {
    conversaAtual = s.conversas[0]?.id || null;
  }
  const recarregar = () => { alvo.replaceChildren(); render(alvo); };
  const modo = modoIA();
  const motivo = motivoIA();

  /* ---------- barra de estado ---------- */
  const selo = h('span', { class: `chip ${motivo.ok ? 'ok' : 'warn'}` },
    modo === 'servidor' ? '🛰️ servidor' : modo === 'chave' ? '🔑 chave local' : '🧩 motor local');

  /* ---------- lista de conversas ---------- */
  const listaConversas = painel('Conversas', {
    icone: '💬',
    acao: h('button', {
      class: 'btn btn--xs btn--p',
      onclick: () => { const c = novaConversa(); conversaAtual = c.id; recarregar(); },
    }, '+ nova'),
  }, s.conversas.length
    ? h('div', { class: 'list' }, ...s.conversas.slice(0, 20).map((c) => h('div', {
      class: `row row--btn ${c.id === conversaAtual ? 'card--acc' : ''}`,
      onclick: () => { conversaAtual = c.id; recarregar(); },
    },
      h('span', { class: 'grow' },
        h('div', { class: 'ttl' }, cortar(c.titulo, 28)),
        h('div', { class: 'sub' }, h('span', {}, `${c.mensagens.length} mensagens · ${fmtQuando(c.em)}`))),
      h('button', {
        class: 'btn btn--xs btn--d',
        onclick: (ev) => {
          ev.stopPropagation();
          confirmar('Apagar conversa?', 'O histórico dela some.', () => {
            removerConversa(c.id);
            if (conversaAtual === c.id) conversaAtual = null;
            recarregar();
          });
        },
      }, '✕'))))
    : vazio('Nenhuma conversa', 'Comece por um atalho ao lado.', null, '💬'));

  /* ---------- atalhos ---------- */
  const atalhos = painel('Comece por aqui', { icone: '⚡' },
    h('div', { class: 'shortcuts' }, ...PRESETS.map((p) => h('button', {
      class: 'shortcut',
      onclick: () => enviarTexto(p.p),
    }, h('span', { class: 'em' }, p.emoji), h('b', {}, p.t)))));

  /* ---------- chat ---------- */
  const chat = h('div', { class: 'chat' });
  const c = conversaAtual ? acharConversa(conversaAtual) : null;

  function pintarChat() {
    chat.replaceChildren();
    const atual = conversaAtual ? acharConversa(conversaAtual) : null;
    if (!atual || !atual.mensagens.length) {
      chat.append(h('div', { class: 'msg sys' },
        motivo.ok
          ? 'Pergunte qualquer coisa sobre o projeto — ele recebe sua agenda, suas tarefas e suas peças como contexto.'
          : 'Modo local: respondo com o motor do app sobre semana, prioridades, ideias, evento, bloqueio e diagnóstico.'));
      return;
    }
    for (const m of atual.mensagens) {
      const bolha = h('div', { class: `msg ${m.de === 'me' ? 'me' : 'ia'}` });
      if (m.de === 'me') bolha.textContent = m.txt;
      else bolha.innerHTML = textoRico(m.txt);
      chat.append(bolha);
      if (m.de === 'ia') {
        chat.append(h('div', { class: 'flexb tiny dim2', style: { marginTop: '-4px' } },
          m.local ? h('span', { class: 'chip warn' }, 'motor local — não é IA') : h('span', { class: 'chip ok' }, 'resposta da IA'),
          temVoz() ? h('button', {
            class: 'btn btn--xs',
            onclick: () => { if (!falar(m.txt)) toast('Este navegador não tem voz', 'bad'); },
          }, '🔊 ouvir') : null,
          temVoz() ? h('button', { class: 'btn btn--xs', onclick: pararDeFalar }, '⏹') : null));
      }
    }
    chat.scrollIntoView?.({ block: 'end' });
  }

  const composer$ = txtarea({ placeholder: 'Escreva sua pergunta…', rows: 1 });
  composer$.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); enviarTexto(composer$.value); }
  });
  composer$.addEventListener('input', () => {
    composer$.style.height = 'auto';
    composer$.style.height = `${Math.min(170, composer$.scrollHeight)}px`;
  });

  const botaoEnviar = h('button', {
    class: 'btn btn--p',
    onclick: () => enviarTexto(composer$.value),
  }, '➤');

  async function enviarTexto(txt) {
    const pergunta = String(txt || '').trim();
    if (!pergunta || ocupado) return;

    if (!conversaAtual || !acharConversa(conversaAtual)) {
      const nova = novaConversa();
      conversaAtual = nova.id;
    }
    addMensagem(conversaAtual, 'me', pergunta);
    composer$.value = '';
    composer$.style.height = 'auto';
    pintarChat();

    ocupado = true;
    botaoEnviar.disabled = true;
    const pensando = h('div', { class: 'msg ia typing' }, h('i'), h('i'), h('i'));
    chat.append(pensando);
    pensando.scrollIntoView?.({ block: 'end' });

    const historico = acharConversa(conversaAtual).mensagens.slice(0, -1);
    const inicio = Date.now();
    let r;
    try {
      r = await perguntar(historico, pergunta);
    } catch (e) {
      r = { texto: `⚠️ Erro inesperado: ${e.message}`, local: true };
    }
    // um respiro mínimo: resposta instantânea demais parece que não fez nada
    if (Date.now() - inicio < 260) await esperar(260);

    pensando.remove();
    addMensagem(conversaAtual, 'ia', r.texto);
    // marca de onde veio a resposta, para a etiqueta abaixo dela ficar certa
    set((s2) => {
      const conv = s2.conversas.find((x) => x.id === conversaAtual);
      const ultima = conv?.mensagens[conv.mensagens.length - 1];
      if (ultima) ultima.local = !!r.local;
    });

    ocupado = false;
    botaoEnviar.disabled = false;
    pintarChat();
    registrar('🧠', 'Conselheiro consultado', cortar(pergunta, 60), '#/conselheiro');
  }

  pintarChat();

  const painelChat = painel(c ? cortar(c.titulo, 40) : 'Conselheiro Estratégico', {
    icone: '🧠',
    acao: h('div', { class: 'flexb' },
      selo,
      h('button', {
        class: 'btn btn--xs',
        onclick: () => modal('👁️ O que ele sabe', h('div', {},
          h('p', { class: 'small muted mb' },
            'Este é exatamente o texto enviado junto com a sua pergunta. Nada além disto sai do aparelho.'),
          h('pre', {
            class: 'mono small',
            style: {
              whiteSpace: 'pre-wrap', background: 'var(--panel2)', padding: '14px',
              borderRadius: '12px', border: '1px solid var(--line)', maxHeight: '52dvh', overflow: 'auto',
            },
          }, contexto())), { largo: true }),
      }, '👁️ o que ele sabe')),
  },
    chat,
    h('div', { class: 'composer' }, composer$, botaoEnviar),
    h('div', { class: 'tiny dim2 mt' },
      motivo.ok
        ? `${usoHoje()} pergunta(s) enviadas hoje · Enter envia, Shift+Enter quebra linha.`
        : 'Enter envia, Shift+Enter quebra linha.'));

  const raiz = h('div', { class: 'flexc', style: { gap: '18px' } },
    motivo.ok ? null : ligarGemini(recarregar),
    h('div', { class: 'grid g-side' },
      painelChat,
      h('div', { class: 'flexc' }, atalhos, listaConversas)));

  alvo.replaceChildren(
    tituloPagina('Conselheiro Estratégico',
      'Um sócio para pensar junto: análise da sua semana, ideias, plano de evento e desbloqueio criativo.',
      h('a', { class: 'btn btn--sm', href: '#/config' }, '⚙️ Ligar a IA')),
    raiz);
  cascata(raiz.children, { passo: 60 });

  // ao sair da tela, cala a voz
  return () => pararDeFalar();
}

/* ==========================================================
   LIGAR O GEMINI SEM SAIR DA TELA
   ==========================================================
   Antes era preciso ir até Sistema só para colar a chave. Como esta é a
   tela em que a falta dela aparece, o campo mora aqui também — as duas
   telas escrevem no mesmo lugar do estado.                              */
function ligarGemini(recarregar) {
  const p = provedor('gemini');
  const campoChave = inp({
    type: 'password',
    placeholder: 'Cole aqui a chave do Google AI Studio (AIza…)',
    autocomplete: 'off',
  });

  const botao = h('button', {
    class: 'btn btn--p',
    onclick: async () => {
      const valor = campoChave.value.trim();
      if (!valor) { tremer(campoChave); campoChave.focus(); return; }
      set((x) => { x.ia.chaveGemini = valor; x.ia.provedor = 'gemini'; x.ia.modo = 'chave'; });

      botao.disabled = true;
      const antes = botao.textContent;
      botao.textContent = 'testando…';
      const r = await perguntar([], 'Responda apenas: ok');
      botao.disabled = false;
      botao.textContent = antes;

      if (r.local) {
        // a chave não funcionou: desliga de volta para não deixar o app
        // num estado que finge estar conectado
        set((x) => { x.ia.modo = 'local'; });
        toast(`Não consegui conectar: ${r.erro || 'a chave foi recusada'}`, 'bad');
        recarregar();
        return;
      }
      registrar('🔌', 'Gemini conectado', 'pela tela do Conselheiro', '#/conselheiro');
      toast('Gemini conectado — pode perguntar 🎉', 'good');
      recarregar();
    },
  }, 'Ligar');

  campoChave.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') botao.click(); });

  return h('div', { class: 'card card--acc' },
    h('div', { class: 'card__h' },
      h('span', { style: { fontSize: '16px' } }, '🔌'),
      h('h3', {}, 'Ligar o chatbot de verdade'),
      h('span', { class: 'chip sp' }, 'camada gratuita')),
    h('p', { class: 'small muted mb' },
      'Agora ele responde pelo motor do próprio app — útil, mas não é IA. '
      + 'Com uma chave do Google AI Studio, quem responde é o Gemini, '
      + 'com os seus dados do app como contexto.'),
    h('div', { class: 'f-row', style: { gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'end' } },
      campo('Chave do Gemini', campoChave),
      h('div', { style: { marginBottom: '12px' } }, botao)),
    h('div', { class: 'flexb' },
      h('a', { class: 'btn btn--sm', href: p.ondePegar, target: '_blank', rel: 'noopener' },
        '🔗 Pegar a chave (é grátis)'),
      h('a', { class: 'btn btn--sm', href: '#/config' }, '⚙️ Outras opções')),
    h('p', { class: 'tiny dim2 mt' },
      'A chave fica só no armazenamento deste navegador e vai direto para o Google — '
      + 'nenhum servidor meu no meio. Se você for publicar o app para outras pessoas, '
      + 'use o modo servidor em Sistema, senão a sua chave roda na máquina delas.'));
}
