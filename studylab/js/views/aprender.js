/* ===== views/aprender.js — me explica, professor socrático, resumos, mapas e arquivos ===== */
import { h, iso, uid, esc, round } from '../util.js';
import { st, nomeMateria, novoMaterial, novoFlashcard, novaQuestao, conteudo as getConteudo } from '../store.js';
import { titulo, cartao, vazio, modal, fecharModal, toast, campo, inp, sel, txtarea, segmento, barra, paywall } from '../ui.js';
import { opcoesMaterias, opcoesConteudos, selMateria, formMaterial } from './comum.js';
import {
  temIA, explicar, socratico, resumir, resumoLocal, mapaMental, mapaLocal, lerArquivo,
  MODOS_EXPLICACAO, TIPOS_RESUMO, gerarFlashcards, flashcardsLocais, gerarQuestoes,
} from '../ai.js';

let aba = 'explicar';

export function render(el, { params }) {
  const pintar = () => { el.replaceChildren(); montar(el, params, pintar); };
  montar(el, params, pintar);
}

function montar(el, params, pintar) {
  el.append(titulo('🧠 Aprender', 'Explicações, resumos, mapas mentais e leitura de material.'));

  if (!temIA()) {
    el.append(h('div', { class: 'mb' }, paywall('Explicações com IA são do Pro',
      'Me explica, professor socrático, mapa mental com IA e leitura de PDF/foto fazem parte do plano Pro. '
      + 'O resumo continua funcionando de graça, em modo local: ele destaca as frases mais importantes do seu texto.')));
  }

  el.append(h('div', { class: 'mb' }, segmento([
    { v: 'explicar', t: '💬 Me explica' }, { v: 'socratico', t: '🎓 Socrático' },
    { v: 'resumo', t: '📖 Resumos' }, { v: 'mapa', t: '🗺️ Mapa mental' }, { v: 'arquivo', t: '📄 PDF e foto' },
  ], aba, (v) => { aba = v; pintar(); })));

  if (aba === 'explicar') abaExplicar(el, params);
  if (aba === 'socratico') abaSocratico(el);
  if (aba === 'resumo') abaResumo(el);
  if (aba === 'mapa') abaMapa(el);
  if (aba === 'arquivo') abaArquivo(el);
}

/* ==========================================================
   ME EXPLICA
   ========================================================== */
function abaExplicar(el, params) {
  const temaInicial = params.get('tema') ? decodeURIComponent(params.get('tema')) : '';
  const f = {};
  f.tema = inp({ placeholder: 'Ex.: Bloqueio Continental, equação do 2º grau, crase…', value: temaInicial });
  f.materia = selMateria(params.get('materia') || '');
  let modo = 'normal';
  const saida = h('div', { class: 'mt2' });

  const btn = h('button', {
    class: 'btn btn--p btn--blk', onclick: async () => {
      const tema = f.tema.value.trim();
      if (!tema) return toast('Escreva o que você quer entender', 'bad');
      if (!temIA()) return toast('Isso é do StudyLab Pro — veja em ✨ Planos', 'bad');
      btn.disabled = true; btn.textContent = 'Explicando…';
      saida.replaceChildren(h('p', { class: 'muted small' }, '🤖 Preparando a explicação…'));
      try {
        const txt = await explicar(tema, modo, nomeMateria(f.materia.value));
        saida.replaceChildren(caixaResultado(txt, {
          titulo: `💬 ${tema}`,
          materiaId: f.materia.value || null,
          tituloMaterial: `Explicação — ${tema}`,
        }));
      } catch (e) { saida.replaceChildren(h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message)); }
      btn.disabled = false; btn.textContent = '💬 Explicar';
    },
  }, '💬 Explicar');

  el.append(cartao(
    h('b', {}, '💬 Modo "me explica"'),
    h('p', { class: 'tiny muted' }, 'O Study AI conhece suas matérias e seu desempenho — a explicação sai no seu nível.'),
    h('div', { class: 'f-row mt' }, campo('O que você quer entender', f.tema), campo('Matéria', f.materia)),
    h('label', { class: 'f' }, h('span', {}, 'Como você quer a explicação'),
      segmento(MODOS_EXPLICACAO.map((m) => ({ v: m.id, t: m.rot })), modo, (v) => { modo = v; })),
    btn, saida));
}

/* ==========================================================
   PROFESSOR SOCRÁTICO
   ========================================================== */
function abaSocratico(el) {
  const f = {};
  f.tema = inp({ placeholder: 'Ex.: Por que a Revolução Francesa aconteceu?' });
  f.materia = selMateria('');
  const chat = h('div', { class: 'chat mt2' });
  let historico = [];

  const enviar = async (txt) => {
    if (txt) { historico.push({ autor: 'me', txt }); pintarChat(); }
    const pensando = h('div', { class: 'msg ai typing' }, h('i'), h('i'), h('i'));
    chat.append(pensando); chat.scrollTop = chat.scrollHeight;
    try {
      const r = await socratico(historico, f.tema.value.trim() || 'conteúdo escolar', nomeMateria(f.materia.value));
      pensando.remove();
      historico.push({ autor: 'ai', txt: r }); pintarChat();
    } catch (e) { pensando.remove(); toast(e.message, 'bad'); }
  };

  const entrada = inp({ placeholder: 'Sua resposta…' });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && entrada.value.trim()) { const v = entrada.value; entrada.value = ''; enviar(v); }
  });

  function pintarChat() {
    chat.replaceChildren(...historico.map((m) => h('div', { class: `msg ${m.autor === 'me' ? 'me' : 'ai'}` }, m.txt)));
    chat.scrollTop = chat.scrollHeight;
  }

  el.append(cartao(
    h('b', {}, '🎓 Professor socrático'),
    h('p', { class: 'tiny muted' }, 'Aqui a IA não entrega a resposta: ela pergunta até você chegar sozinho. É mais lento — e fixa muito mais.'),
    h('div', { class: 'f-row mt' }, campo('Tema', f.tema), campo('Matéria', f.materia)),
    h('button', {
      class: 'btn btn--p', onclick: () => {
        if (!temIA()) return toast('Isso é do StudyLab Pro — veja em ✨ Planos', 'bad');
        if (!f.tema.value.trim()) return toast('Escreva o tema', 'bad');
        historico = []; pintarChat(); enviar('');
      },
    }, '▶ Começar conversa'),
    chat,
    h('div', { class: 'flexb mt' }, entrada,
      h('button', { class: 'btn btn--p', onclick: () => { if (entrada.value.trim()) { const v = entrada.value; entrada.value = ''; enviar(v); } } }, 'Enviar'))));
}

/* ==========================================================
   RESUMOS
   ========================================================== */
function abaResumo(el) {
  const f = {};
  f.texto = txtarea({ placeholder: 'Cole aqui o texto do livro, a anotação da aula, o conteúdo do slide…', style: { minHeight: '180px' } });
  f.materia = selMateria('');
  let tipo = 'completo';
  const saida = h('div', { class: 'mt2' });

  const btn = h('button', {
    class: 'btn btn--p btn--blk', onclick: async () => {
      const texto = f.texto.value.trim();
      if (texto.length < 60) return toast('Cole um texto um pouco maior', 'bad');
      if (!temIA()) {
        const r = resumoLocal(texto, tipo === 'rapido' ? 4 : 8);
        saida.replaceChildren(
          h('p', { class: 'tiny', style: { color: 'var(--warn)' } }, '⚠️ Resumo local (sem IA): escolhi as frases mais representativas do seu texto, sem reescrever nada.'),
          caixaResultado(r, { titulo: '📖 Resumo local', materiaId: f.materia.value || null, tituloMaterial: 'Resumo' }));
        return;
      }
      btn.disabled = true; btn.textContent = 'Resumindo…';
      saida.replaceChildren(h('p', { class: 'muted small' }, '🤖 Lendo e resumindo…'));
      try {
        const txt = await resumir(texto, tipo, nomeMateria(f.materia.value));
        saida.replaceChildren(caixaResultado(txt, {
          titulo: `📖 ${TIPOS_RESUMO.find((t) => t.id === tipo)?.rot}`,
          materiaId: f.materia.value || null, tituloMaterial: 'Resumo', material: texto,
        }));
      } catch (e) { saida.replaceChildren(h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message)); }
      btn.disabled = false; btn.textContent = '📖 Resumir';
    },
  }, '📖 Resumir');

  el.append(cartao(
    h('b', {}, '📖 Resumos inteligentes'),
    h('div', { class: 'f-row mt' }, campo('Matéria', f.materia), h('div')),
    h('label', { class: 'f' }, h('span', {}, 'Tipo de resumo'),
      segmento(TIPOS_RESUMO.map((t) => ({ v: t.id, t: t.rot })), tipo, (v) => { tipo = v; })),
    campo('Material', f.texto),
    btn, saida));
}

/* ==========================================================
   MAPA MENTAL
   ========================================================== */
function abaMapa(el) {
  const f = {};
  f.tema = inp({ placeholder: 'Tema central (ex.: Revolução Francesa)' });
  f.texto = txtarea({ placeholder: 'Cole o conteúdo que vira o mapa…', style: { minHeight: '150px' } });
  f.materia = selMateria('');
  const saida = h('div', { class: 'mt2' });

  const desenhar = (mapa) => {
    const lista = h('ul', { class: 'mind' }, ...mapa.ramos.map((r) =>
      h('li', {}, h('b', {}, r.titulo), h('ul', {}, ...r.itens.map((i) => h('li', {}, i))))));
    const txt = `${mapa.centro}\n` + mapa.ramos.map((r) => `- ${r.titulo}\n` + r.itens.map((i) => `  - ${i}`).join('\n')).join('\n');
    saida.replaceChildren(cartao(
      h('div', { class: 'center mb' },
        h('span', { class: 'chip chip--on', style: { fontSize: '15px', padding: '8px 16px' } }, mapa.centro)),
      lista,
      h('div', { class: 'flexb mt' },
        h('button', {
          class: 'btn btn--sm', onclick: () => {
            novoMaterial({ tipo: 'mapa', titulo: `Mapa mental — ${mapa.centro}`, conteudo: txt, materiaId: f.materia.value || null });
            toast('Mapa salvo na Biblioteca', 'good');
          },
        }, '💾 Salvar na biblioteca'),
        h('button', { class: 'btn btn--sm sp', onclick: () => { navigator.clipboard?.writeText(txt); toast('Copiado'); } }, '📋 Copiar'))));
  };

  const btn = h('button', {
    class: 'btn btn--p btn--blk', onclick: async () => {
      const texto = f.texto.value.trim();
      if (texto.length < 60) return toast('Cole um texto um pouco maior', 'bad');
      if (!temIA()) { desenhar(mapaLocal(texto, f.tema.value.trim() || 'Tema')); toast('Mapa montado localmente (sem IA)'); return; }
      btn.disabled = true; btn.textContent = 'Montando…';
      try { desenhar(await mapaMental(texto, f.tema.value.trim())); }
      catch (e) { saida.replaceChildren(h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message)); }
      btn.disabled = false; btn.textContent = '🗺️ Gerar mapa';
    },
  }, '🗺️ Gerar mapa');

  el.append(cartao(
    h('b', {}, '🗺️ Mapas mentais'),
    h('p', { class: 'tiny muted' }, 'Transforma capítulo, resumo ou anotação em uma estrutura de conceitos.'),
    h('div', { class: 'f-row mt' }, campo('Tema central', f.tema), campo('Matéria', f.materia)),
    campo('Conteúdo', f.texto),
    btn, saida));
}

/* ==========================================================
   PDF E FOTO
   ========================================================== */
function abaArquivo(el) {
  const f = {};
  f.materia = selMateria('');
  const arquivo = h('input', { type: 'file', accept: 'image/*,application/pdf', class: 'inp', style: { paddingTop: '8px' } });
  const previa = h('div', { class: 'mt' });
  const saida = h('div', { class: 'mt2' });
  let base64 = null, mime = null, nome = '';

  arquivo.addEventListener('change', () => {
    const file = arquivo.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast('Arquivo muito grande (máx. 8 MB)', 'bad');
    nome = file.name; mime = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    const fr = new FileReader();
    fr.onload = () => {
      base64 = String(fr.result).split(',')[1];
      previa.replaceChildren(mime.startsWith('image/')
        ? h('img', { src: fr.result, style: { maxWidth: '100%', borderRadius: '12px', maxHeight: '260px' } })
        : h('p', { class: 'small' }, `📄 ${nome} carregado (${Math.round(file.size / 1024)} KB)`));
    };
    fr.readAsDataURL(file);
  });

  const acao = async (pergunta, rotulo) => {
    if (!base64) return toast('Escolha um arquivo primeiro', 'bad');
    if (!temIA()) return toast('Leitura de arquivos precisa do Study AI configurado', 'bad');
    saida.replaceChildren(h('p', { class: 'muted small' }, `🤖 ${rotulo}…`));
    try {
      const txt = await lerArquivo({ base64, mime, pergunta, nomeArquivo: nome });
      saida.replaceChildren(caixaResultado(txt, { titulo: `📄 ${rotulo}`, materiaId: f.materia.value || null, tituloMaterial: `${rotulo} — ${nome}`, material: txt }));
    } catch (e) { saida.replaceChildren(h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message)); }
  };

  el.append(cartao(
    h('b', {}, '📄 Escanear atividade / ler PDF'),
    h('p', { class: 'tiny muted' }, 'Fotografe a atividade ou envie o PDF do material. O Study AI lê e transforma em explicação, resumo, questões ou flashcards.'),
    h('div', { class: 'f-row mt' }, campo('Arquivo (imagem ou PDF)', arquivo), campo('Matéria', f.materia)),
    previa,
    h('div', { class: 'grid g2 keep2 mt' },
      h('button', { class: 'btn', onclick: () => acao('Explique o conteúdo deste material de forma clara, no nível escolar do aluno.', 'Explicando') }, '💬 Explicar'),
      h('button', { class: 'btn', onclick: () => acao('Resolva as questões deste material passo a passo, mostrando o raciocínio (não só a resposta).', 'Resolvendo junto') }, '🧩 Resolver junto'),
      h('button', { class: 'btn', onclick: () => acao('Resuma este material para prova: definições, datas, fórmulas e o que costuma cair.', 'Resumindo') }, '📖 Resumir'),
      h('button', { class: 'btn', onclick: () => acao('Crie 5 questões parecidas com as deste material, com gabarito e explicação ao final.', 'Criando questões parecidas') }, '📝 Questões parecidas')),
    saida));
}

/* ==========================================================
   CAIXA DE RESULTADO (com ações de salvar/derivar)
   ========================================================== */
function caixaResultado(texto, { titulo: tit = 'Resultado', materiaId = null, tituloMaterial = 'Material', material = '' } = {}) {
  const extra = h('div', { class: 'mt' });
  return cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, tit),
      h('button', { class: 'btn btn--sm sp', onclick: () => { navigator.clipboard?.writeText(texto); toast('Copiado'); } }, '📋')),
    h('p', { style: { whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 } }, texto),
    h('div', { class: 'flexb mt' },
      h('button', {
        class: 'btn btn--sm', onclick: () => {
          novoMaterial({ tipo: 'resumo', titulo: tituloMaterial, conteudo: texto, materiaId });
          toast('Salvo na Biblioteca', 'good');
        },
      }, '💾 Salvar na biblioteca'),
      h('button', {
        class: 'btn btn--sm', onclick: async (e) => {
          e.target.disabled = true;
          try {
            const cards = temIA()
              ? await gerarFlashcards({ texto: material || texto, quantidade: 6, materiaNome: nomeMateria(materiaId) })
              : flashcardsLocais(material || texto, 6);
            if (!cards.length) throw new Error('Não consegui extrair flashcards deste texto.');
            for (const c of cards) novoFlashcard({ frente: c.frente, verso: c.verso, materiaId });
            toast(`${cards.length} flashcards criados`, 'good');
          } catch (err) { toast(err.message, 'bad'); }
          e.target.disabled = false;
        },
      }, '🃏 Virar flashcards'),
      h('a', { class: 'btn btn--sm sp', href: `#/questoes?materia=${materiaId || ''}&gerar=1` }, '📝 Gerar questões')),
    extra);
}
