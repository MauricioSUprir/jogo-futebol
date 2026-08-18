/* ===== ui.js — peças de interface reutilizáveis + gráficos em SVG puro ===== */
import { h, $, clamp, round, esc } from './util.js';

/* ---------- toast ---------- */
export function toast(txt, tipo = '') {
  const el = h('div', { class: `toast ${tipo}` }, txt);
  $('#toasts').append(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ---------- modal ---------- */
let fecharAtual = null;
export function modal(titulo, corpo, { largo = false, aoFechar = null } = {}) {
  const m = $('#modal');
  m.classList.toggle('modal--wide', !!largo);
  $('#modalTitle').textContent = titulo;
  const body = $('#modalBody');
  body.replaceChildren(corpo);
  m.hidden = false;
  fecharAtual = aoFechar;
  document.body.style.overflow = 'hidden';
  const primeiro = body.querySelector('input,select,textarea,button');
  if (primeiro && window.innerWidth > 900) setTimeout(() => primeiro.focus(), 40);
  return fecharModal;
}
export function fecharModal() {
  const m = $('#modal'); if (m.hidden) return;
  m.hidden = true; document.body.style.overflow = '';
  const f = fecharAtual; fecharAtual = null;
  if (typeof f === 'function') f();
}
export function confirmar(titulo, texto, aoConfirmar, { perigo = true, ok = 'Confirmar' } = {}) {
  modal(titulo, h('div', {},
    h('p', { class: 'muted', style: { marginTop: 0 } }, texto),
    h('div', { class: 'flexb', style: { marginTop: '14px' } },
      h('button', { class: 'btn', onclick: fecharModal }, 'Cancelar'),
      h('button', { class: `btn ${perigo ? 'btn--d' : 'btn--p'}`, onclick: () => { fecharModal(); aoConfirmar(); } }, ok))));
}

/* ---------- blocos ---------- */
export const cartao = (...kids) => h('div', { class: 'card' }, ...kids);
export function kpi(valor, rotulo, extra = '') {
  return h('div', { class: 'kpi' }, h('b', {}, valor), h('span', {}, rotulo), extra ? h('small', {}, extra) : null);
}
export function barra(v, cls = '') {
  return h('div', { class: `bar ${cls}` }, h('i', { style: { width: `${clamp(v, 0, 100)}%` } }));
}
export function titulo(t, sub = '', ...acoes) {
  return h('div', { class: 'page-h' },
    h('div', {}, h('h1', {}, t), sub ? h('p', {}, sub) : null),
    acoes.filter(Boolean).length ? h('div', { class: 'sp' }, ...acoes.filter(Boolean)) : null);
}
export const vazio = (tit, txt, acao = null) =>
  h('div', { class: 'empty' }, h('b', {}, tit), h('span', {}, txt), acao ? h('div', { class: 'mt' }, acao) : null);

export function campo(rot, input) { return h('label', { class: 'f' }, h('span', {}, rot), input); }
export function inp(attrs = {}) { return h('input', { class: 'inp', ...attrs }); }
export function txtarea(attrs = {}) { return h('textarea', { class: 'inp', ...attrs }); }
export function sel(opcoes, valor, attrs = {}) {
  const s = h('select', { class: 'inp', ...attrs });
  for (const o of opcoes) {
    const op = h('option', { value: o.v }, o.t);
    if (String(o.v) === String(valor)) op.selected = true;
    s.append(op);
  }
  return s;
}
export function segmento(opcoes, valor, aoTrocar) {
  const box = h('div', { class: 'seg' });
  for (const o of opcoes) {
    const b = h('button', {
      class: String(o.v) === String(valor) ? 'on' : '',
      onclick: () => {
        [...box.children].forEach((c) => c.classList.remove('on'));
        b.classList.add('on'); aoTrocar(o.v);
      },
    }, o.t);
    box.append(b);
  }
  return box;
}

/* ==========================================================
   GRÁFICOS (SVG, sem biblioteca)
   ========================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  return el;
}

/** Barras verticais. dados = [{rot, v, cor?}] */
export function gBarras(dados, { alt = 150, cor = '#7c5cff', formato = (v) => v, mostrarRot = true } = {}) {
  const larg = 320, pad = { t: 12, b: mostrarRot ? 20 : 6, l: 4, r: 4 };
  const max = Math.max(1, ...dados.map((d) => d.v));
  const s = svg('svg', { class: 'chart', viewBox: `0 0 ${larg} ${alt}`, preserveAspectRatio: 'none' });
  const bw = (larg - pad.l - pad.r) / Math.max(1, dados.length);
  dados.forEach((d, i) => {
    const hh = ((alt - pad.t - pad.b) * d.v) / max;
    const x = pad.l + i * bw + bw * 0.18, w = bw * 0.64;
    s.append(svg('rect', { x, y: alt - pad.b - hh, width: w, height: Math.max(d.v > 0 ? 2 : 0, hh), rx: 3, fill: d.cor || cor, opacity: d.dim ? .4 : .95 }));
    if (mostrarRot) {
      const t = svg('text', { x: x + w / 2, y: alt - 6, 'text-anchor': 'middle', 'font-size': 8.5, fill: '#8c93ad' });
      t.textContent = d.rot; s.append(t);
    }
    if (d.v > 0) {
      const t2 = svg('text', { x: x + w / 2, y: alt - pad.b - hh - 3, 'text-anchor': 'middle', 'font-size': 8, fill: '#a3aac2' });
      t2.textContent = formato(d.v); s.append(t2);
    }
  });
  return s;
}

/** Linha com área. dados = [{rot, v}] */
export function gLinha(dados, { alt = 150, cor = '#22d3ee', formato = (v) => v } = {}) {
  const larg = 320, pad = { t: 12, b: 20, l: 6, r: 6 };
  const max = Math.max(1, ...dados.map((d) => d.v));
  const s = svg('svg', { class: 'chart', viewBox: `0 0 ${larg} ${alt}` });
  const px = (i) => pad.l + (i * (larg - pad.l - pad.r)) / Math.max(1, dados.length - 1);
  const py = (v) => alt - pad.b - ((alt - pad.t - pad.b) * v) / max;
  const pts = dados.map((d, i) => `${px(i)},${py(d.v)}`).join(' ');
  const grad = svg('linearGradient', { id: 'gl' + Math.random().toString(36).slice(2, 7), x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(svg('stop', { offset: 0, 'stop-color': cor, 'stop-opacity': .35 }), svg('stop', { offset: 1, 'stop-color': cor, 'stop-opacity': 0 }));
  const defs = svg('defs'); defs.append(grad); s.append(defs);
  s.append(svg('polygon', { points: `${pad.l},${alt - pad.b} ${pts} ${larg - pad.r},${alt - pad.b}`, fill: `url(#${grad.id})` }));
  s.append(svg('polyline', { points: pts, fill: 'none', stroke: cor, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  dados.forEach((d, i) => {
    s.append(svg('circle', { cx: px(i), cy: py(d.v), r: 2.4, fill: cor }));
    if (dados.length <= 16) {
      const t = svg('text', { x: px(i), y: alt - 6, 'text-anchor': 'middle', 'font-size': 8, fill: '#8c93ad' });
      t.textContent = d.rot; s.append(t);
    }
  });
  return s;
}

/** Barras horizontais com rótulo. dados = [{rot, v, max?, cor?}] */
export function gBarrasH(dados, { formato = (v) => v } = {}) {
  const box = h('div', { class: 'list' });
  const max = Math.max(1, ...dados.map((d) => d.max ?? d.v));
  for (const d of dados) {
    box.append(h('div', {},
      h('div', { class: 'flexb tiny', style: { marginBottom: '4px' } },
        h('span', {}, d.rot), h('b', { class: 'sp' }, formato(d.v))),
      h('div', { class: 'bar' }, h('i', { style: { width: `${clamp((d.v / max) * 100, 0, 100)}%`, background: d.cor || undefined } }))));
  }
  return box;
}

/** Rosca / anel de progresso (0..1). */
export function gAnel(p, { tam = 92, larguraTraco = 9, cor = '#7c5cff', texto = null, corFundo = '#242a3d' } = {}) {
  const r = (tam - larguraTraco) / 2, c = 2 * Math.PI * r;
  const s = svg('svg', { viewBox: `0 0 ${tam} ${tam}`, width: tam, height: tam });
  s.append(svg('circle', { cx: tam / 2, cy: tam / 2, r, fill: 'none', stroke: corFundo, 'stroke-width': larguraTraco }));
  s.append(svg('circle', {
    cx: tam / 2, cy: tam / 2, r, fill: 'none', stroke: cor, 'stroke-width': larguraTraco, 'stroke-linecap': 'round',
    'stroke-dasharray': `${c * clamp(p, 0, 1)} ${c}`, transform: `rotate(-90 ${tam / 2} ${tam / 2})`,
  }));
  if (texto !== null) {
    const t = svg('text', { x: tam / 2, y: tam / 2 + 4, 'text-anchor': 'middle', 'font-size': tam / 4.2, 'font-weight': 800, fill: 'currentColor' });
    t.textContent = texto; s.append(t);
  }
  return s;
}

/** Pizza simples. dados = [{rot, v, cor}] */
export function gPizza(dados, { tam = 120 } = {}) {
  const total = dados.reduce((a, b) => a + b.v, 0) || 1;
  const s = svg('svg', { viewBox: `0 0 ${tam} ${tam}`, width: tam, height: tam });
  let ang = -Math.PI / 2;
  const cx = tam / 2, cy = tam / 2, r = tam / 2 - 2;
  for (const d of dados) {
    const a2 = ang + (d.v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const grande = a2 - ang > Math.PI ? 1 : 0;
    s.append(svg('path', { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${grande} 1 ${x2},${y2} Z`, fill: d.cor, opacity: .9 }));
    ang = a2;
  }
  s.append(svg('circle', { cx, cy, r: r * 0.55, fill: 'var(--panel)' }));
  return s;
}
export function legenda(dados) {
  return h('div', { class: 'legend' }, ...dados.map((d) =>
    h('span', {}, h('i', { style: { background: d.cor } }), `${d.rot}${d.extra ? ' · ' + d.extra : ''}`)));
}

/* ---------- barra de progresso rotulada ---------- */
export function progresso(rot, v, { cls = '', sufixo = '%' } = {}) {
  return h('div', {},
    h('div', { class: 'flexb tiny mb' }, h('span', {}, rot), h('b', { class: 'sp' }, `${round(v)}${sufixo}`)),
    barra(v, cls));
}

/* ==========================================================
   PLANO PAGO — já modelado, ainda desligado.
   Vire COBRANCA_ATIVA para true quando o Pro entrar no ar:
   as telas passam a respeitar limites e a mostrar o selo PRO.
   ========================================================== */
export const COBRANCA_ATIVA = false;

/** O que cada plano entrega. `pro:true` = exclusivo do plano pago. */
export const RECURSOS = [
  { id: 'motor', nome: 'Prioridades, revisão espaçada, domínio e planos de prova', pro: false },
  { id: 'estudo', nome: 'Tarefas, provas, matérias, foco, flashcards e desempenho', pro: false },
  { id: 'jogo', nome: 'XP, níveis, conquistas, sequência e StudyCoins', pro: false },
  { id: 'ia_propria', nome: 'Study AI com a sua própria chave da Claude API', pro: false },
  { id: 'ia_inclusa', nome: 'Study AI incluso — sem precisar de chave nem cartão', pro: true },
  { id: 'ia_ilimitada', nome: 'Sem limite diário de perguntas e gerações', pro: true },
  { id: 'arquivos', nome: 'Leitura ilimitada de PDF e foto de atividade', pro: true },
  { id: 'redacao', nome: 'Correção de redação com nota por competência', pro: true },
  { id: 'sync', nome: 'Sincronizar celular e computador + backup na nuvem', pro: true },
  { id: 'responsavel', nome: 'Relatório semanal para o responsável', pro: true },
  { id: 'longo_prazo', nome: 'Cronograma de longo prazo (ENEM/vestibular)', pro: true },
  { id: 'banco', nome: 'Banco de questões pronto por série e matéria', pro: true },
  { id: 'relatorios', nome: 'Relatórios avançados e exportação em PDF', pro: true },
  { id: 'temas', nome: 'Temas, avatares e personalizações exclusivas', pro: true },
];

/** Limites do plano gratuito (só valem quando COBRANCA_ATIVA = true). */
export const LIMITES_FREE = { iaPorDia: 20, arquivosPorDia: 3, simuladosIaPorSemana: 2 };

export const ehPro = (estado) => estado?.conta?.plano === 'pro';

/**
 * Porteiro único do app. Enquanto a cobrança está desligada devolve sempre {ok:true},
 * então nenhuma tela precisa saber se o Pro existe ou não.
 * @returns {{ok:boolean, motivo?:string}}
 */
export function liberado(estado, recursoId) {
  if (!COBRANCA_ATIVA || ehPro(estado)) return { ok: true };
  const r = RECURSOS.find((x) => x.id === recursoId);
  if (!r || !r.pro) return { ok: true };
  return { ok: false, motivo: r.nome };
}

/** Checagem de cota diária de IA no plano gratuito. */
export function dentroDaCota(estado) {
  if (!COBRANCA_ATIVA || ehPro(estado)) return { ok: true };
  const usadas = estado?.ia?.usoHoje || 0;
  return usadas < LIMITES_FREE.iaPorDia
    ? { ok: true, restam: LIMITES_FREE.iaPorDia - usadas }
    : { ok: false, motivo: `Você usou as ${LIMITES_FREE.iaPorDia} chamadas de IA do plano gratuito hoje.` };
}

export const selo = () => h('span', { class: 'pro-tag' }, 'PRO');
