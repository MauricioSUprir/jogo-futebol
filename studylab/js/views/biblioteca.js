/* ===== views/biblioteca.js — materiais, anotações de aula, favoritos e arquivo escolar ===== */
import { h, iso, norm, fmtData, parseISO } from '../util.js';
import { st, set, nomeMateria, emojiMateria, atualizar, remover, novoMaterial } from '../store.js';
import { titulo, cartao, kpi, vazio, modal, fecharModal, toast, campo, inp, sel, txtarea, segmento, confirmar } from '../ui.js';
import { formMaterial, TIPOS_MATERIAL, opcoesMaterias, selMateria, tagMateria } from './comum.js';
import { temIA, resumir, resumoLocal } from '../ai.js';

let aba = 'tudo', filtroMateria = '', busca = '';

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  el.append(titulo('📂 Biblioteca', 'Resumos, anotações de aula, listas e arquivos — por matéria e por ano.',
    h('button', { class: 'btn', onclick: () => abrirAnotacao(pintar) }, '📝 Anotação de aula'),
    h('button', { class: 'btn btn--p', onclick: () => formMaterial(null, pintar, { materiaId: filtroMateria }) }, '➕ Novo material')));

  el.append(h('div', { class: 'grid g4 keep2 mb' },
    kpi(s.biblioteca.length, 'materiais'),
    kpi(s.biblioteca.filter((m) => m.favorito).length, 'favoritos'),
    kpi(s.biblioteca.filter((m) => m.tipo === 'anotacao').length, 'anotações de aula'),
    kpi(new Set(s.biblioteca.map((m) => (m.criadoEm || '').slice(0, 4))).size, 'anos arquivados')));

  const inpBusca = inp({ placeholder: '🔍 Buscar no conteúdo…', value: busca });
  inpBusca.addEventListener('input', () => { busca = inpBusca.value; pintarLista(); });
  const selMat = sel([{ v: '', t: 'Todas as matérias' }, ...opcoesMaterias(false)], filtroMateria, { style: { maxWidth: '210px' } });
  selMat.addEventListener('change', () => { filtroMateria = selMat.value; pintarLista(); });

  el.append(cartao(
    h('div', { class: 'flexb mb' }, inpBusca, selMat),
    segmento([
      { v: 'tudo', t: 'Tudo' }, { v: 'favorito', t: '⭐ Favoritos' }, { v: 'anotacao', t: '📝 Aulas' },
      { v: 'resumo', t: '📖 Resumos' }, { v: 'mapa', t: '🗺️ Mapas' }, { v: 'pdf', t: '📄 Arquivos' }, { v: 'ano', t: '🗃️ Por ano' },
    ], aba, (v) => { aba = v; pintarLista(); })));

  const box = h('div', { class: 'mt2' });
  el.append(box);

  function pintarLista() {
    const s2 = st();
    let ms = [...s2.biblioteca];
    if (aba === 'favorito') ms = ms.filter((m) => m.favorito);
    else if (['anotacao', 'resumo', 'mapa', 'pdf'].includes(aba)) ms = ms.filter((m) => m.tipo === aba);
    if (filtroMateria) ms = ms.filter((m) => m.materiaId === filtroMateria);
    if (busca) ms = ms.filter((m) => norm(m.titulo + ' ' + (m.conteudo || '')).includes(norm(busca)));
    ms.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));

    box.replaceChildren();
    if (!ms.length) {
      box.append(vazio('Nada aqui', 'Salve resumos, anotações e materiais para reencontrar tudo depois.',
        h('button', { class: 'btn btn--p', onclick: () => formMaterial(null, pintar) }, '➕ Novo material')));
      return;
    }
    if (aba === 'ano') {
      const anos = {};
      for (const m of ms) (anos[(m.criadoEm || iso()).slice(0, 4)] ||= []).push(m);
      for (const [ano, lista] of Object.entries(anos).sort((a, b) => b[0].localeCompare(a[0]))) {
        box.append(h('h3', { class: 'mb mt2' }, `🗃️ ${ano}`));
        box.append(h('div', { class: 'list' }, ...lista.map((m) => linha(m, pintar))));
      }
      return;
    }
    box.append(h('div', { class: 'list' }, ...ms.map((m) => linha(m, pintar))));
  }
  pintarLista();
}

const ICONE = { anotacao: '📝', resumo: '📖', pdf: '📄', lista: '📋', mapa: '🗺️', link: '🔗', imagem: '🖼️' };

function linha(m, pintar) {
  return h('div', { class: 'row' },
    h('span', { style: { fontSize: '18px' } }, ICONE[m.tipo] || '📁'),
    h('div', { class: 'grow', style: { cursor: 'pointer' }, onclick: () => ver(m, pintar) },
      h('div', { class: 'ttl' }, m.titulo),
      h('div', { class: 'sub' }, tagMateria(m.materiaId),
        h('span', { class: 'chip' }, TIPOS_MATERIAL.find((t) => t.v === m.tipo)?.t || m.tipo),
        h('span', { class: 'chip' }, fmtData(m.criadoEm)))),
    h('button', { class: 'icon-btn', onclick: () => { atualizar('biblioteca', m.id, { favorito: !m.favorito }); pintar(); } }, m.favorito ? '⭐' : '☆'));
}

function ver(m, pintar) {
  const corpo = h('div', {},
    h('div', { class: 'flexb mb' }, tagMateria(m.materiaId),
      h('span', { class: 'chip' }, fmtData(m.criadoEm)),
      m.url ? h('a', { class: 'chip sp', href: m.url, target: '_blank', rel: 'noopener' }, '🔗 abrir link') : null),
    m.conteudo
      ? h('p', { style: { whiteSpace: 'pre-wrap', lineHeight: 1.6 } }, m.conteudo)
      : h('p', { class: 'muted small' }, 'Sem texto salvo — este material é só um link/referência.'));

  const acoes = h('div', { class: 'flexb mt2' },
    h('button', { class: 'btn btn--d', onclick: () => confirmar('Apagar material?', m.titulo, () => { remover('biblioteca', m.id); fecharModal(); pintar(); }) }, 'Apagar'),
    h('button', { class: 'btn sp', onclick: () => { fecharModal(); formMaterial(m, pintar); } }, '✏️ Editar'));

  if (m.conteudo && m.conteudo.length > 200) {
    acoes.append(h('button', {
      class: 'btn btn--p', onclick: async (e) => {
        e.target.disabled = true; e.target.textContent = 'Resumindo…';
        try {
          const txt = temIA() ? await resumir(m.conteudo, 'prova', nomeMateria(m.materiaId)) : resumoLocal(m.conteudo, 6);
          novoMaterial({ tipo: 'resumo', titulo: `Resumo — ${m.titulo}`, conteudo: txt, materiaId: m.materiaId });
          toast('Resumo criado na biblioteca', 'good'); fecharModal(); pintar();
        } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; e.target.textContent = '✨ Resumir'; }
      },
    }, '✨ Resumir'));
  }
  corpo.append(acoes);
  modal(`${ICONE[m.tipo] || '📁'} ${m.titulo}`, corpo, { largo: true });
}

/* ---------- anotação de aula (com organização por IA) ---------- */
export function abrirAnotacao(aoSalvar) {
  const f = {};
  f.titulo = inp({ placeholder: 'Ex.: Aula 12/08 — Revolução Francesa' });
  f.materia = selMateria('');
  f.texto = txtarea({ placeholder: 'Escreva como der: bagunçado mesmo. Dá para organizar depois.', style: { minHeight: '200px' } });
  const saida = h('div', { class: 'mt' });

  modal('📝 Anotação de aula', h('div', {},
    h('div', { class: 'f-row' }, campo('Título', f.titulo), campo('Matéria', f.materia)),
    campo('Anotações', f.texto),
    h('div', { class: 'flexb' },
      h('button', {
        class: 'btn', onclick: async (e) => {
          const txt = f.texto.value.trim();
          if (txt.length < 40) return toast('Escreva um pouco mais primeiro', 'bad');
          if (!temIA()) {
            f.texto.value = resumoLocal(txt, 10);
            toast('Organizado localmente: destaquei as frases principais.');
            return;
          }
          e.target.disabled = true; e.target.textContent = 'Organizando…';
          try {
            f.texto.value = await resumir(txt, 'topicos', nomeMateria(f.materia.value));
            toast('Anotação organizada', 'good');
          } catch (err) { toast(err.message, 'bad'); }
          e.target.disabled = false; e.target.textContent = '✨ Organizar com IA';
        },
      }, '✨ Organizar com IA'),
      h('button', {
        class: 'btn btn--p sp', onclick: () => {
          if (!f.texto.value.trim()) return toast('Escreva a anotação', 'bad');
          novoMaterial({
            tipo: 'anotacao', titulo: f.titulo.value.trim() || `Aula ${fmtData(iso())}`,
            conteudo: f.texto.value, materiaId: f.materia.value || null,
          });
          fecharModal(); toast('Anotação salva', 'good'); aoSalvar?.();
        },
      }, '💾 Salvar')),
    saida), { largo: true });
}
