/* ===== views/aprovacao.js — "Para passar de ano": como é a nota de cada matéria e quanto falta =====
   O aluno conta como a escola dá a nota (quanto vale o teste, a prova, o trabalho; média ou soma de
   pontos; quanto precisa para passar) e o app calcula sozinho: quanto já tem, quanto falta e quanto
   precisa tirar em cada avaliação que ainda vai acontecer. A conta mora em engine.js (situacaoAprovacao). */
import { h, iso, uid } from '../util.js';
import { st, set, atualizar, remover, novaNota } from '../store.js';
import { situacaoAprovacao, NOME_PERIODO } from '../engine.js';
import { cartao, modal, fecharModal, toast, campo, inp, sel, segmento, confirmar, progresso } from '../ui.js';

const fmt = (v) => (v === null || v === undefined ? '—' : String(Math.round(v * 100) / 100).replace('.', ','));
const num = (x) => Number(String(x).replace(',', '.'));

/** Modelos prontos para começar rápido (dá para mudar tudo depois). */
const MODELOS = [
  { nome: 'Teste 3 + Prova 5 + Trabalho 2 · média 6', c: { tipo: 'media', minimo: 6, periodos: 4, itens: [['Teste', 3], ['Prova', 5], ['Trabalho', 2]] } },
  { nome: 'Teste 4 + Prova 6 · média 7', c: { tipo: 'media', minimo: 7, periodos: 4, itens: [['Teste', 4], ['Prova', 6]] } },
  { nome: 'Só prova (vale 10) · média 6', c: { tipo: 'media', minimo: 6, periodos: 4, itens: [['Prova', 10]] } },
  { nome: '25 pontos por bimestre · passa com 60', c: { tipo: 'pontos', minimo: 60, periodos: 4, itens: [['Teste', 10], ['Prova', 15]] } },
  { nome: 'Trimestres: AV1 4 + AV2 6 · média 6', c: { tipo: 'media', minimo: 6, periodos: 3, itens: [['AV1', 4], ['AV2', 6]] } },
];
const deModelo = (c) => ({ ...c, pesos: Array(c.periodos).fill(1), itens: c.itens.map(([nome, vale]) => ({ id: uid('it'), nome, vale })) });

/* ---------- o cartão na tela da matéria ---------- */
export function cartaoAprovacao(m, pintar) {
  const r = situacaoAprovacao(m.id);
  if (!r) {
    return cartao(
      h('div', { class: 'flexb mb' }, h('b', {}, '🎯 Para passar de ano')),
      h('p', { class: 'small muted', style: { margin: '0 0 12px' } },
        `Conte como é a nota de ${m.nome} na sua escola (quanto vale o teste, a prova, o trabalho e quanto precisa para passar). O MindTrack calcula sozinho quanto falta e quanto você precisa tirar em cada avaliação.`),
      h('button', { class: 'btn btn--p', onclick: () => formCriterio(m, pintar) }, '⚙️ Configurar a nota desta matéria'));
  }
  const P = r.nomePeriodo;
  const unidade = r.criterio.tipo === 'pontos' ? 'pontos' : 'de média';

  // a frase principal
  let manchete;
  if (r.status === 'passou') {
    manchete = h('div', { class: 'aprov-manchete ok' }, h('b', {}, '✅ Você já passou de ano nesta matéria!'),
      h('span', {}, `Tem ${fmt(r.atual)} ${unidade} e precisava de ${fmt(r.minimo)}.`));
  } else if (r.status === 'impossivel') {
    manchete = h('div', { class: 'aprov-manchete bad' }, h('b', {}, '⚠️ Só com as notas que faltam não dá mais'),
      h('span', {}, `Mesmo tirando tudo, chega a ${fmt(r.atual + r.faltaMax)} e precisa de ${fmt(r.minimo)}. Converse com o professor sobre recuperação ou trabalho extra.`));
  } else {
    const dif = r.precisaPorcento >= 85 ? 'bad' : r.precisaPorcento >= 65 ? 'warn' : 'ok';
    manchete = h('div', { class: `aprov-manchete ${dif}` },
      h('b', {}, `Faltam ${fmt(r.falta)} ${unidade} para passar`),
      h('span', {}, `Você precisa de ${r.precisaPorcento}% do que ainda vale no ano — a lista abaixo diz quanto tirar em cada avaliação.`));
  }

  // o que fazer agora: as próximas avaliações (do período em andamento e do seguinte)
  const pendentes = r.periodos.filter((p) => p.celulas.some((c) => !c.nota)).slice(0, 2);
  const proximas = r.status === 'precisa' && pendentes.length
    ? h('div', { class: 'aprov-proximas' }, h('div', { class: 'tiny muted mb' }, 'O que você precisa tirar'),
      ...pendentes.map((p) => h('div', { class: 'aprov-prox' },
        h('b', {}, `${p.periodo}º ${P}`),
        h('div', { class: 'chips' }, ...p.celulas.filter((c) => !c.nota).map((c) =>
          h('span', { class: 'chip' }, `${c.item.nome}: ${fmt(c.precisa)} de ${fmt(c.vale)}`))))))
    : null;

  const previsao = r.previsao !== null && r.status !== 'passou'
    ? h('p', { class: 'tiny muted', style: { margin: '8px 0 0' } },
      `No ritmo de agora (${Math.round(r.aproveitamento * 100)}% de acerto) você termina o ano com ${fmt(r.previsao)} ${unidade} — ${r.previsao >= r.minimo ? 'passa ✅' : 'não passa ainda ⚠️'}.`)
    : null;

  // a grade: avaliações × períodos (tocar numa casa lança a nota)
  const grade = h('div', { class: 'scroll-x mt' }, h('table', { class: 'tb aprov-grade' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), ...r.periodos.map((p) => h('th', {}, `${p.periodo}º ${P.slice(0, 3)}.`)))),
    h('tbody', {},
      ...r.criterio.itens.map((item, i) => h('tr', {},
        h('th', {}, item.nome, h('span', { class: 'tiny muted' }, ` (${fmt(item.vale)})`)),
        ...r.periodos.map((p) => {
          const c = p.celulas[i];
          return h('td', {}, h('button', {
            class: `aprov-cel${c.nota ? ' feita' : ''}`, onclick: () => formCelula(m, r, p.periodo, c, pintar),
            'aria-label': `${item.nome} do ${p.periodo}º ${P}`,
          }, c.nota ? fmt(c.pts) : c.precisa !== null ? h('span', { class: 'aprov-precisa' }, `≥ ${fmt(c.precisa)}`) : '+'));
        }))),
      h('tr', { class: 'aprov-total' }, h('th', {}, `Nota do ${P}`, h('span', { class: 'tiny muted' }, ` (${fmt(r.totalPeriodo)})`)),
        ...r.periodos.map((p) => h('td', {}, p.pontos === null ? '—' : fmt(p.pontos)))))));

  return cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🎯 Para passar de ano'),
      h('span', { class: 'chip sp' }, r.criterio.tipo === 'pontos' ? `passa com ${fmt(r.minimo)} pontos` : `passa com média ${fmt(r.minimo)}`),
      h('button', { class: 'btn btn--sm', onclick: () => formCriterio(m, pintar) }, '⚙️ Critério')),
    manchete,
    progresso(`${fmt(r.atual)} de ${fmt(r.minimo)} ${unidade}`, Math.min(100, Math.round((r.atual / (r.minimo || 1)) * 100)),
      { cls: r.status === 'passou' ? 'ok' : r.status === 'impossivel' ? 'bad' : 'warn' }),
    proximas, previsao, grade,
    h('p', { class: 'tiny muted', style: { margin: '8px 0 0' } }, 'Toque numa casa da tabela para lançar a nota daquela avaliação.'));
}

/* ---------- lançar a nota de uma casa (avaliação × período) ---------- */
function formCelula(m, r, periodo, cel, pintar) {
  const valor = inp({ type: 'number', step: .1, min: 0, max: cel.vale, value: cel.nota ? cel.pts : '', placeholder: `de 0 a ${fmt(cel.vale)}`, inputmode: 'decimal' });
  const salvar = () => {
    const v = num(valor.value);
    if (valor.value === '' || Number.isNaN(v)) return toast('Digite a nota', 'bad');
    if (v < 0 || v > cel.vale + 1e-9) return toast(`A nota vai de 0 a ${fmt(cel.vale)}`, 'bad');
    const d = { valor: v, maximo: cel.vale, titulo: cel.item.nome };
    if (cel.nota) atualizar('notas', cel.nota.id, d);
    else novaNota({ ...d, materiaId: m.id, peso: 1, bimestre: periodo, itemId: cel.item.id, data: iso() });
    fecharModal(); toast('Nota lançada', 'good'); pintar();
  };
  valor.addEventListener('keydown', (e) => { if (e.key === 'Enter') salvar(); });
  modal(`${cel.item.nome} · ${periodo}º ${r.nomePeriodo}`, h('div', {},
    campo(`Quanto você tirou? (vale ${fmt(cel.vale)})`, valor),
    cel.precisa !== null ? h('p', { class: 'tiny muted' }, `Para passar, você precisa de pelo menos ${fmt(cel.precisa)} aqui.`) : null,
    h('div', { class: 'flexb mt2' },
      cel.nota ? h('button', { class: 'btn btn--d', onclick: () => { remover('notas', cel.nota.id); fecharModal(); pintar(); } }, 'Apagar') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', { class: 'btn btn--p', onclick: salvar }, 'Salvar'))));
  setTimeout(() => valor.focus(), 50);
}

/* ---------- configurar o critério da matéria ---------- */
export function formCriterio(m, aoSalvar) {
  let c = structuredClone(m.criterio || deModelo(MODELOS[0].c));
  const corpo = h('div', {});

  const pintarForm = () => {
    const P = Number(c.periodos);
    c.pesos = Array.from({ length: P }, (_, i) => c.pesos?.[i] || 1);
    const totalPer = c.itens.reduce((s, i) => s + (num(i.vale) || 0), 0);
    const maxAno = c.tipo === 'pontos' ? c.pesos.reduce((s, p) => s + num(p), 0) * totalPer : totalPer;

    const minimo = inp({ type: 'number', step: .1, min: 0, value: c.minimo, inputmode: 'decimal' });
    minimo.addEventListener('input', () => { c.minimo = num(minimo.value) || 0; });
    const periodos = sel([{ v: 4, t: '4 bimestres' }, { v: 3, t: '3 trimestres' }, { v: 2, t: '2 semestres' }], P);
    periodos.addEventListener('change', () => { c.periodos = Number(periodos.value); pintarForm(); });

    const itens = h('div', { class: 'aprov-itens' }, ...c.itens.map((it) => {
      const nome = inp({ value: it.nome, placeholder: 'Ex.: Teste' });
      const vale = inp({ type: 'number', step: .1, min: .1, value: it.vale, inputmode: 'decimal' });
      nome.addEventListener('input', () => { it.nome = nome.value; });
      vale.addEventListener('change', () => { it.vale = num(vale.value) || 0; pintarForm(); });
      return h('div', { class: 'aprov-item' }, nome, h('span', { class: 'tiny muted' }, 'vale'), vale,
        c.itens.length > 1 ? h('button', { class: 'icon-btn', 'aria-label': 'Tirar', onclick: () => { c.itens = c.itens.filter((x) => x !== it); pintarForm(); } }, '✕') : null);
    }));

    const pesos = h('details', { class: 'mt' }, h('summary', { class: 'small' }, `Pesos dos ${NOME_PERIODO[P]}s (se algum vale mais)`),
      h('div', { class: 'aprov-pesos' }, ...c.pesos.map((p, i) => {
        const x = inp({ type: 'number', step: .5, min: .5, value: p, inputmode: 'decimal' });
        x.addEventListener('change', () => { c.pesos[i] = num(x.value) || 1; pintarForm(); });
        return h('label', { class: 'small' }, `${i + 1}º`, x);
      })));

    corpo.replaceChildren(
      h('div', { class: 'tiny muted mb' }, 'Modelos prontos'),
      h('div', { class: 'chips mb' }, ...MODELOS.map((md) => h('button', { class: 'chip', onclick: () => { c = deModelo(md.c); pintarForm(); } }, md.nome))),
      h('div', { class: 'mb' }, h('div', { class: 'tiny muted mb' }, 'Como passa'),
        segmento([{ v: 'media', t: 'Média dos períodos' }, { v: 'pontos', t: 'Soma de pontos no ano' }], c.tipo, (v) => { c.tipo = v; pintarForm(); })),
      h('div', { class: 'f-row' },
        campo(c.tipo === 'pontos' ? 'Pontos para passar' : 'Média para passar', minimo),
        campo('O ano tem', periodos)),
      h('div', { class: 'tiny muted mt mb' }, `Avaliações de cada ${NOME_PERIODO[P]}`),
      itens,
      h('button', { class: 'btn btn--sm mt', onclick: () => { c.itens.push({ id: uid('it'), nome: '', vale: 1 }); pintarForm(); } }, '+ avaliação'),
      h('p', { class: 'small', style: { margin: '10px 0 0' } },
        `Cada ${NOME_PERIODO[P]} vale ${fmt(totalPer)}`, c.tipo === 'pontos' ? ` · o ano vale ${fmt(maxAno)} pontos` : ''),
      c.tipo === 'pontos' && num(c.minimo) > maxAno ? h('p', { class: 'tiny', style: { color: 'var(--bad)' } }, 'O mínimo para passar está maior que o total do ano.') : null,
      pesos,
      h('div', { class: 'flexb mt2' },
        m.criterio ? h('button', { class: 'btn btn--d', onclick: () => confirmar('Tirar o critério?', 'As notas lançadas continuam salvas.', () => { atualizar('materias', m.id, { criterio: null }); fecharModal(); aoSalvar?.(); }) }, 'Tirar critério') : null,
        h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
        h('button', {
          class: 'btn btn--p', onclick: () => {
            c.itens = c.itens.filter((i) => String(i.nome).trim() && num(i.vale) > 0).map((i) => ({ ...i, nome: String(i.nome).trim(), vale: num(i.vale) }));
            if (!c.itens.length) return toast('Coloque pelo menos uma avaliação com o valor', 'bad');
            if (!(num(c.minimo) > 0)) return toast('Diga quanto precisa para passar', 'bad');
            atualizar('materias', m.id, { criterio: { ...c, minimo: num(c.minimo) } });
            fecharModal(); toast('Pronto! Agora o MindTrack calcula quanto falta 🎯', 'good'); aoSalvar?.();
          },
        }, 'Salvar')));
  };
  pintarForm();
  modal(`⚙️ Como é a nota de ${m.nome}`, corpo);
}
