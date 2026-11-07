/* ===== views/busca.js — pesquisa global (tudo que existe no app) ===== */
import { h, norm, fmtData, esc } from '../util.js';
import { st, nomeMateria, conteudo as getConteudo } from '../store.js';
import { modal, fecharModal, inp, vazio } from '../ui.js';
import { semaforo, iconeStatus } from '../engine.js';

export function abrirBusca() {
  const campo = inp({ placeholder: 'Buscar matérias, tarefas, questões, flashcards, resumos…', autofocus: true });
  const res = h('div', { class: 'mt2' });

  const buscar = () => {
    const q = norm(campo.value.trim());
    res.replaceChildren();
    if (q.length < 2) {
      res.append(h('p', { class: 'muted small center' }, 'Digite pelo menos 2 letras.'));
      return;
    }
    const s = st();
    const grupos = [];
    const bate = (...campos) => norm(campos.filter(Boolean).join(' ')).includes(q);

    const mats = s.materias.filter((m) => bate(m.nome, m.professor));
    if (mats.length) grupos.push({ t: '📚 Matérias', itens: mats.map((m) => ({ txt: `${m.emoji} ${m.nome}`, sub: m.professor ? `prof. ${m.professor}` : '', rota: `#/materias/${m.id}` })) });

    const cnt = s.conteudos.filter((c) => bate(c.nome));
    if (cnt.length) grupos.push({ t: '🗺️ Conteúdos', itens: cnt.map((c) => ({ txt: `${iconeStatus(c.status)} ${c.nome}`, sub: `${nomeMateria(c.materiaId)} · domínio ${c.dominio || 0}%`, rota: `#/materias/${c.materiaId}` })) });

    const tar = s.tarefas.filter((t) => bate(t.titulo, t.descricao));
    if (tar.length) grupos.push({ t: '✅ Tarefas', itens: tar.map((t) => ({ txt: t.titulo, sub: `${nomeMateria(t.materiaId)} · ${fmtData(t.prazo)}`, rota: '#/tarefas' })) });

    const prv = s.provas.filter((p) => bate(p.titulo));
    if (prv.length) grupos.push({ t: '🎯 Provas', itens: prv.map((p) => ({ txt: p.titulo, sub: fmtData(p.data), rota: `#/provas/${p.id}` })) });

    const qs = s.questoes.filter((x) => bate(x.enunciado, x.explicacao));
    if (qs.length) grupos.push({ t: '📝 Questões', itens: qs.slice(0, 12).map((x) => ({ txt: x.enunciado.slice(0, 90), sub: `${nomeMateria(x.materiaId)}${x.conteudoId ? ' · ' + (getConteudo(x.conteudoId)?.nome || '') : ''}`, rota: '#/questoes' })) });

    const fc = s.flashcards.filter((x) => bate(x.frente, x.verso));
    if (fc.length) grupos.push({ t: '🃏 Flashcards', itens: fc.slice(0, 12).map((x) => ({ txt: x.frente, sub: x.verso.slice(0, 70), rota: '#/flashcards' })) });

    const bib = s.biblioteca.filter((x) => bate(x.titulo, x.conteudo));
    if (bib.length) grupos.push({ t: '📂 Biblioteca', itens: bib.map((x) => ({ txt: x.titulo, sub: `${x.tipo} · ${nomeMateria(x.materiaId)}`, rota: '#/biblioteca' })) });

    const err = s.tentativas.filter((t) => !t.acertou).map((t) => s.questoes.find((x) => x.id === t.questaoId)).filter(Boolean);
    const errU = [...new Map(err.filter((x) => bate(x.enunciado)).map((x) => [x.id, x])).values()];
    if (errU.length) grupos.push({ t: '❌ Erros', itens: errU.slice(0, 8).map((x) => ({ txt: x.enunciado.slice(0, 90), sub: 'questão que você errou', rota: '#/revisao' })) });

    if (!grupos.length) { res.append(vazio('Nada encontrado', `Nenhum resultado para "${campo.value}".`)); return; }

    for (const g of grupos) {
      res.append(h('div', { class: 'mb' },
        h('b', { class: 'tiny muted' }, `${g.t} (${g.itens.length})`),
        h('div', { class: 'list mt' }, ...g.itens.slice(0, 8).map((i) =>
          h('a', { class: 'row row--flat', href: i.rota, style: { color: 'inherit' }, onclick: fecharModal },
            h('span', { class: 'grow' },
              h('div', { class: 'small', style: { fontWeight: 600 } }, i.txt),
              i.sub ? h('div', { class: 'tiny muted' }, i.sub) : null),
            h('span', {}, '›'))))));
    }
  };

  campo.addEventListener('input', buscar);
  modal('🔍 Pesquisa global', h('div', {}, campo, res), { largo: true });
  setTimeout(() => campo.focus(), 60);
  buscar();
}
