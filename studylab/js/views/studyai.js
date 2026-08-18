/* ===== views/studyai.js — o assistente que conhece seus dados ===== */
import { h, iso, uid, fmtMin } from '../util.js';
import { st, set, nomeMateria, nivelPlano } from '../store.js';
import { resumoPeriodo, filaRevisao, filaTarefas, preparoProva, nivelDe } from '../engine.js';
import { titulo, cartao, vazio, modal, fecharModal, toast, campo, inp, txtarea, confirmar, paywall, liberado, selo } from '../ui.js';
import { temIA, motivoIA, chat, contextoDoAluno, observacoesLocais, corrigirRedacao, planoSemanaIA } from '../ai.js';
import { LIMITES_PLANO } from '../produto.js';
import { comprimirImagem, dataUrlParaBloco, fotosDaMateria } from '../fotos.js';

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
      ? paywall('O Study AI é dos planos Pro e Plus',
        'Ele conhece suas matérias, suas provas, seus erros e seu calendário — e responde com base nos seus dados de verdade, '
        + 'não em achismo. Pergunte "o que eu estudo agora?" e veja a diferença.')
      : paywall('Study AI ainda não foi ligado',
        'Sua assinatura está ativa, mas o servidor do StudyLab ainda não está no ar — é ele que guarda a chave e '
        + 'conversa com a inteligência artificial. Se este app é seu: publique o studylab-server e informe o '
        + 'endereço em ⚙️ Configurações → Área do criador.')));

    if (porQue !== 'PRO') {
      el.append(h('div', { class: 'mb' }, h('a', { class: 'btn btn--p', href: '#/config' }, '⚙️ Abrir a Área do criador')));
    }
    el.append(cartao(
      h('b', {}, '🤔 O que ele responderia com os seus dados'),
      h('p', { class: 'tiny muted' }, 'Exemplos reais do que o Study AI usa quando é liberado:'),
      h('div', { class: 'chips' }, ...SUGESTOES.map((sg) => h('span', { class: 'chip' }, sg))),
      porQue === 'PRO' ? h('a', { class: 'btn btn--p mt', href: '#/planos' }, '✨ Ver planos') : null));

    el.append(h('div', { class: 'mt2' }, cartaoObservacoes()));
    return;
  }

  /* ---------- chat ---------- */
  let historico = s.conversas?.length ? [...s.conversas] : [];
  const limites = LIMITES_PLANO[nivelPlano()] || LIMITES_PLANO.pro;
  let anexos = [];   // fotos escolhidas para a PRÓXIMA pergunta (dataURLs)
  const chatBox = h('div', { class: 'chat card', style: { minHeight: '46dvh', maxHeight: '60dvh', overflowY: 'auto' } });
  const entrada = txtarea({ placeholder: 'Pergunte qualquer coisa sobre seus estudos…', style: { minHeight: '52px' } });

  /* ---------- fotos anexadas ---------- */
  const tiraAnexos = h('div', { class: 'chips', style: { display: 'none' } });
  function pintarAnexos() {
    tiraAnexos.style.display = anexos.length ? '' : 'none';
    tiraAnexos.replaceChildren(...anexos.map((a, i) => h('span', {
      class: 'chip', style: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px' },
    },
    h('img', { src: a, alt: `foto ${i + 1}`, style: { width: '28px', height: '28px', objectFit: 'cover', borderRadius: '6px' } }),
    h('button', {
      class: 'icon-btn', style: { width: '20px', height: '20px', fontSize: '11px' },
      onclick: () => { anexos.splice(i, 1); pintarAnexos(); },
    }, '✕'))),
    h('span', { class: 'tiny muted' }, `${anexos.length}/${limites.fotosPergunta} foto(s)`));
  }

  const arquivoFoto = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  arquivoFoto.addEventListener('change', async () => {
    const escolhidas = [...(arquivoFoto.files || [])];
    arquivoFoto.value = '';
    for (const f of escolhidas) {
      if (anexos.length >= limites.fotosPergunta) {
        toast(`Seu plano manda até ${limites.fotosPergunta} foto(s) por pergunta${nivelPlano() === 'pro' ? ' — no Plus são 4' : ''}.`, 'bad');
        break;
      }
      try { anexos.push(await comprimirImagem(f)); } catch (e) { toast(e.message, 'bad'); }
    }
    pintarAnexos();
  });

  async function escolherDaEscola() {
    const materias = st().materias;
    const grupos = [];
    for (const m of materias) {
      const fotos = await fotosDaMateria(m.id).catch(() => []);
      if (fotos.length) grupos.push({ m, fotos });
    }
    if (!grupos.length) {
      return modal('🏫 Sem fotos na Minha Escola', h('div', {},
        h('p', { class: 'small' }, 'Você ainda não guardou fotos por lá. Na aba Minha Escola dá para juntar fotos do caderno por matéria — e depois anexar aqui.'),
        h('a', { class: 'btn btn--p', href: '#/escola', onclick: fecharModal }, '🏫 Abrir a Minha Escola')));
    }
    const corpo = h('div', {});
    for (const g of grupos) {
      corpo.append(h('b', { class: 'small' }, `${g.m.emoji || '📘'} ${g.m.nome}`));
      corpo.append(h('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px', margin: '8px 0 14px' },
      }, ...g.fotos.map((f) => h('img', {
        src: f.dataUrl, alt: `foto de ${g.m.nome}`,
        style: { width: '100%', height: '72px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer' },
        onclick: () => {
          if (anexos.length >= limites.fotosPergunta) return toast(`Máximo de ${limites.fotosPergunta} foto(s) por pergunta.`, 'bad');
          anexos.push(f.dataUrl); pintarAnexos(); fecharModal();
          toast('Foto anexada à próxima pergunta 📎', 'good');
        },
      }))));
    }
    modal('🏫 Fotos da Minha Escola', corpo, { largo: true });
  }

  function abrirFotos() {
    const porta = liberado('ia_fotos');
    if (!porta.ok) return modal('📸 Fotos no Study AI', paywall('Mandar fotos é dos planos pagos', '', porta.precisa));
    modal('📸 Anexar foto', h('div', {},
      h('p', { class: 'small muted', style: { marginTop: 0 } },
        `Mande a foto da questão, do caderno ou do quadro. Seu plano: até ${limites.fotosPergunta} por pergunta, ${limites.fotosDia} por dia.`),
      h('div', { class: 'grid g2' },
        h('button', { class: 'btn btn--blk', onclick: () => { fecharModal(); arquivoFoto.click(); } }, '📷 Câmera ou galeria'),
        h('button', { class: 'btn btn--blk', onclick: () => { fecharModal(); escolherDaEscola(); } }, '🏫 Da Minha Escola'))));
  }

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
    if (!pergunta && !anexos.length) return;
    const fotos = anexos.map((a) => dataUrlParaBloco(a));
    const rotulo = anexos.length ? `📸 [${anexos.length} foto(s)] ` : '';
    anexos = []; pintarAnexos();
    entrada.value = '';
    historico.push({ autor: 'me', txt: rotulo + (pergunta || 'O que você vê nessa(s) foto(s)?') });
    pintarChat();
    const pensando = h('div', { class: 'msg ai typing' }, h('i'), h('i'), h('i'));
    chatBox.append(pensando); chatBox.scrollTop = chatBox.scrollHeight;
    try {
      const r = await chat(historico.slice(0, -1), pergunta || 'Explique o que está nessa(s) foto(s) e me ajude com isso.', fotos);
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
  el.append(h('div', { class: 'mt' }, tiraAnexos));
  el.append(h('div', { class: 'flexb mt' },
    h('button', { class: 'btn', title: 'Anexar foto', onclick: abrirFotos }, '📸'),
    entrada,
    h('button', { class: 'btn btn--p', onclick: () => enviar() }, 'Enviar')));
  el.append(arquivoFoto);
  el.append(h('div', { class: 'chips mt' }, ...SUGESTOES.map((sg) =>
    h('button', { class: 'chip', style: { cursor: 'pointer' }, onclick: () => enviar(sg) }, sg))));
  el.append(h('p', { class: 'tiny muted center mt' },
    '⚠️ O Study AI pode errar. Confira datas, contas e fórmulas no seu material.'));
  el.append(h('div', { class: 'flexb mt' },
    h('button', {
      class: 'btn btn--sm', onclick: () => confirmar('Limpar conversa?', 'O histórico desta conversa será apagado.', () => {
        historico = []; set((x) => { x.conversas = []; }); pintarChat();
      }),
    }, '🗑️ Limpar conversa'),
    h('span', { class: 'tiny muted sp' }, `${s.ia.usoHoje || 0} de ${limites.dia} perguntas hoje`)));
  el.append(h('div', { class: 'grid g2 mt2' }, cartaoRedacao(), cartaoPlanoSemana()));
  el.append(h('div', { class: 'mt2' }, cartaoObservacoes()));
  pintarChat();
}

/* ==========================================================
   RECURSOS DO PLUS
   ========================================================== */
function cartaoRedacao() {
  return cartao(
    h('div', { class: 'flexb' }, h('b', {}, '✍️ Corrigir redação'), selo('plus')),
    h('p', { class: 'tiny muted' }, 'Cole o texto ou mande a foto da folha. Volta com nota, competências e o que corrigir primeiro.'),
    h('button', { class: 'btn btn--blk', onclick: abrirRedacao }, 'Corrigir agora'));
}

function abrirRedacao() {
  const porta = liberado('ia_redacao');
  if (!porta.ok) return modal('✍️ Correção de redação', paywall('Correção de redação é do Plus', '', 'plus'));

  const limites = LIMITES_PLANO[nivelPlano()] || LIMITES_PLANO.pro;
  const tema = inp({ placeholder: 'Tema da redação (opcional)' });
  const texto = txtarea({ placeholder: 'Cole sua redação aqui — ou anexe a foto da folha abaixo.', style: { minHeight: '120px' } });
  const estilo = h('select', { class: 'inp' },
    h('option', { value: 'enem' }, 'Estilo ENEM (nota de 0 a 1000)'),
    h('option', { value: 'escola' }, 'Estilo escola (nota de 0 a 10)'));
  let fotos = [];
  const contagem = h('span', { class: 'tiny muted' }, 'Nenhuma foto.');
  const arquivo = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  arquivo.addEventListener('change', async () => {
    for (const f of [...(arquivo.files || [])]) {
      if (fotos.length >= limites.fotosPergunta) { toast(`Até ${limites.fotosPergunta} foto(s) por correção.`, 'bad'); break; }
      try { fotos.push(dataUrlParaBloco(await comprimirImagem(f))); } catch (e) { toast(e.message, 'bad'); }
    }
    arquivo.value = '';
    contagem.textContent = fotos.length ? `${fotos.length} foto(s) anexada(s).` : 'Nenhuma foto.';
  });
  const resultado = h('div', {});

  modal('✍️ Corrigir redação', h('div', {},
    campo('Tema', tema),
    campo('Como corrigir', estilo),
    campo('Texto', texto),
    h('div', { class: 'flexb mb' },
      h('button', { class: 'btn btn--sm', onclick: () => arquivo.click() }, '📸 Anexar foto da folha'), contagem),
    arquivo,
    h('button', {
      class: 'btn btn--p btn--blk', onclick: async (e) => {
        if (!texto.value.trim() && !fotos.length) return toast('Cole o texto ou anexe a foto da redação.', 'bad');
        e.target.disabled = true; e.target.textContent = 'Corrigindo…';
        try {
          const r = await corrigirRedacao({ texto: texto.value, fotos, tema: tema.value.trim(), estilo: estilo.value });
          resultado.replaceChildren(h('div', { class: 'card card--flat mt' },
            h('b', { class: 'small' }, '🤖 Correção do Study AI'),
            h('p', { class: 'small', style: { whiteSpace: 'pre-wrap', marginBottom: 0 } }, r)));
        } catch (err) { toast(err.message, 'bad'); }
        e.target.disabled = false; e.target.textContent = 'Corrigir redação';
      },
    }, 'Corrigir redação'),
    resultado), { largo: true });
}

function cartaoPlanoSemana() {
  return cartao(
    h('div', { class: 'flexb' }, h('b', {}, '🗓️ Plano da semana'), selo('plus')),
    h('p', { class: 'tiny muted' }, 'A IA olha suas provas, tarefas, revisões e pontos fracos e monta a semana dia a dia.'),
    h('button', { class: 'btn btn--blk', onclick: abrirPlanoSemana }, 'Montar minha semana'));
}

function abrirPlanoSemana() {
  const porta = liberado('ia_plano');
  if (!porta.ok) return modal('🗓️ Plano da semana', paywall('O plano da semana pela IA é do Plus', '', 'plus'));
  const corpo = h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } },
      'O Study AI vai usar suas provas, tarefas, revisões vencidas e pontos fracos — dados de verdade, não achismo.'),
    h('div', { class: 'center' }, h('div', { class: 'msg ai typing' }, h('i'), h('i'), h('i'))));
  modal('🗓️ Meu plano da semana', corpo, { largo: true });
  planoSemanaIA().then((r) => {
    corpo.replaceChildren(h('p', { class: 'small', style: { whiteSpace: 'pre-wrap', marginTop: 0 } }, r));
  }).catch((e) => {
    corpo.replaceChildren(h('p', { class: 'small' }, `⚠️ ${e.message}`));
  });
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
