/* ===== ui.js — as peças de interface reutilizáveis =====
   Se um componente aparece em duas telas, ele mora aqui. Nada de biblioteca:
   os gráficos são SVG escrito à mão e o lightbox é DOM puro.                */

import { h, $, svg, clamp, round, esc, textoRico, iniciais } from './util.js';
import { entrada, cascata, crescer, contar, tremer } from './motion.js';

/* ==========================================================
   AVISOS FLUTUANTES
   ========================================================== */
export function toast(txt, tipo = '') {
  const el = h('div', { class: `toast ${tipo}` }, txt);
  $('#toasts').append(el);
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 2700);
  setTimeout(() => el.remove(), 3100);
  return el;
}

/* ==========================================================
   MODAL
   ========================================================== */
let aoFecharAtual = null;
export function modal(titulo, corpo, { largo = false, aoFechar = null } = {}) {
  const m = $('#modal');
  m.classList.toggle('modal--wide', !!largo);
  $('#modalTitle').textContent = titulo;
  const corpoEl = $('#modalBody');
  corpoEl.replaceChildren(corpo);
  m.hidden = false;
  aoFecharAtual = aoFechar;
  document.body.style.overflow = 'hidden';
  const primeiro = corpoEl.querySelector('input,select,textarea,button');
  if (primeiro && window.innerWidth > 980) setTimeout(() => primeiro.focus(), 60);
  return fecharModal;
}
export function fecharModal() {
  const m = $('#modal');
  if (!m || m.hidden) return;
  m.hidden = true;
  document.body.style.overflow = '';
  const f = aoFecharAtual; aoFecharAtual = null;
  if (typeof f === 'function') f();
}
export function confirmar(titulo, texto, aoConfirmar, { perigo = true, ok = 'Confirmar' } = {}) {
  modal(titulo, h('div', {},
    h('p', { class: 'muted small' }, texto),
    h('div', { class: 'flexb mt2' },
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: `btn ${perigo ? 'btn--d' : 'btn--p'}`,
        onclick: () => { fecharModal(); aoConfirmar(); },
      }, ok))));
}
/** Pergunta um texto e devolve por callback. Valida vazio com uma tremida. */
export function perguntar(titulo, rotulo, valor, aoOk, { multilinha = false, ok = 'Salvar' } = {}) {
  const campoEl = multilinha ? txtarea({ value: valor || '' }) : inp({ value: valor || '' });
  modal(titulo, h('div', {},
    campo(rotulo, campoEl),
    h('div', { class: 'flexb mt' },
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p',
        onclick: () => {
          const v = campoEl.value.trim();
          if (!v) { tremer(campoEl); return; }
          fecharModal(); aoOk(v);
        },
      }, ok))));
}

/* ==========================================================
   BLOCOS
   ========================================================== */
export const cartao = (...kids) => h('div', { class: 'card' }, ...kids);

export function painel(tituloTxt, { acao = null, icone = '' } = {}, ...kids) {
  return h('div', { class: 'card' },
    h('div', { class: 'card__h' },
      icone ? h('span', { style: { fontSize: '16px' } }, icone) : null,
      h('h3', {}, tituloTxt),
      acao ? h('span', { class: 'sp' }, acao) : null),
    ...kids);
}

export function kpi(valor, rotulo, extra = '', { animar = true, formato = (v) => String(Math.round(v)) } = {}) {
  const b = h('b', {}, typeof valor === 'number' ? '0' : valor);
  const el = h('div', { class: 'kpi' }, b, h('span', {}, rotulo), extra ? h('small', {}, extra) : null);
  if (typeof valor === 'number' && animar) requestAnimationFrame(() => contar(b, 0, valor, { formato }));
  return el;
}

export function barra(v, cls = '', { animar = true } = {}) {
  const i = h('i', { style: { width: animar ? '0%' : `${clamp(v, 0, 100)}%` } });
  const el = h('div', { class: `bar ${cls}` }, i);
  if (animar) requestAnimationFrame(() => crescer(i, v));
  return el;
}

export function progresso(rotulo, v, { cls = '', sufixo = '%' } = {}) {
  return h('div', {},
    h('div', { class: 'flexb tiny mb' },
      h('span', { class: 'muted' }, rotulo),
      h('b', { class: 'sp' }, `${round(v)}${sufixo}`)),
    barra(v, cls));
}

export function tituloPagina(t, sub = '', ...acoes) {
  const uteis = acoes.filter(Boolean);
  return h('div', { class: 'page-h' },
    h('div', {}, h('h1', {}, t), sub ? h('p', {}, sub) : null),
    uteis.length ? h('div', { class: 'sp' }, ...uteis) : null);
}

export const vazio = (tit, txt, acao = null, emoji = '✨') =>
  h('div', { class: 'empty' },
    h('span', { class: 'em' }, emoji),
    h('b', {}, tit),
    h('span', {}, txt),
    acao ? h('div', { class: 'mt' }, acao) : null);

export const aviso = (txt, tipo = '') =>
  h('div', { class: `aviso ${tipo ? `aviso--${tipo}` : ''}` }, h('span', {}, 'ⓘ'), h('span', { html: textoRico(txt) }));

/* ---------- estados de carregamento ---------- */
export const esqueleto = (linhas = 3) =>
  h('div', {}, ...Array.from({ length: linhas }, (_, i) =>
    h('div', { class: 'skel skel--t', style: { width: `${100 - i * 12}%` } })));

export const carregando = (txt = 'Carregando…') =>
  h('div', { class: 'loading' }, h('span', { class: 'spin' }), h('span', {}, txt));

/* ==========================================================
   FORMULÁRIO
   ========================================================== */
export function campo(rotulo, input, dica = '') {
  return h('label', { class: 'f' },
    h('span', {}, rotulo), input, dica ? h('small', {}, dica) : null);
}
export const inp = (attrs = {}) => h('input', { class: 'inp', ...attrs });
export const txtarea = (attrs = {}) => h('textarea', { class: 'inp', ...attrs });
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
      type: 'button',
      class: String(o.v) === String(valor) ? 'on' : '',
      onclick: () => {
        [...box.children].forEach((c) => c.classList.remove('on'));
        b.classList.add('on');
        aoTrocar(o.v);
      },
    }, o.t);
    box.append(b);
  }
  return box;
}
export function chave(titulo, descricao, ligado, aoTrocar) {
  const input = h('input', { type: 'checkbox', onchange: (e) => aoTrocar(e.target.checked) });
  input.checked = !!ligado;
  return h('label', { class: 'switch' },
    h('span', { class: 'switch__t' }, h('b', {}, titulo), h('span', {}, descricao)),
    input);
}
export function seletorDeArquivo(rotulo, aceita, aoEscolher) {
  const input = h('input', {
    type: 'file', accept: aceita, hidden: true,
    onchange: (e) => { const f = e.target.files?.[0]; if (f) aoEscolher(f); e.target.value = ''; },
  });
  const b = h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, rotulo);
  return h('span', {}, b, input);
}

/* ==========================================================
   MARCA / INTEGRANTES
   ========================================================== */
/** O monograma circular ou quadrado de uma integrante, com o gradiente dela. */
export function monograma(m, { tamanho = 44, raio = 14, foto = null } = {}) {
  const el = h('div', {
    style: {
      width: `${tamanho}px`, height: `${tamanho}px`, flex: `0 0 ${tamanho}px`,
      borderRadius: `${raio}px`, display: 'grid', placeItems: 'center', overflow: 'hidden',
      position: 'relative', color: '#fff', fontWeight: '800',
      fontSize: `${Math.round(tamanho / 2.6)}px`, letterSpacing: '-.5px',
      background: `linear-gradient(135deg, ${m?.cor || '#a855f7'}, ${m?.cor2 || '#ff4f8b'})`,
    },
  }, m?.monograma || iniciais(m?.nome));
  if (foto) el.prepend(h('img', { src: foto, alt: '', style: { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' } }));
  return el;
}

/* ==========================================================
   LIGHTBOX (galeria em tela cheia)
   ========================================================== */
let lbEstado = null;
export function lightbox(itens, indice = 0) {
  fecharLightbox();
  if (!itens?.length) return;
  const img = h('img', { src: itens[indice].src, alt: itens[indice].legenda || '' });
  const cap = h('div', { class: 'lbox__cap' });
  const box = h('div', { class: 'lbox', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'lbox__bar' },
      h('span', { class: 'sp' }),
      h('button', { class: 'icon-btn', onclick: fecharLightbox, 'aria-label': 'Fechar' }, '✕')),
    img, cap,
    itens.length > 1 ? h('button', { class: 'lbox__nav prev', onclick: (e) => { e.stopPropagation(); mover(-1); }, 'aria-label': 'Anterior' }, '‹') : null,
    itens.length > 1 ? h('button', { class: 'lbox__nav next', onclick: (e) => { e.stopPropagation(); mover(1); }, 'aria-label': 'Próxima' }, '›') : null);

  box.addEventListener('click', (e) => { if (e.target === box) fecharLightbox(); });

  function pintar() {
    const it = itens[indice];
    img.src = it.src;
    img.alt = it.legenda || '';
    cap.textContent = `${indice + 1} / ${itens.length}${it.legenda ? ` · ${it.legenda}` : ''}`;
    entrada(img, { de: 'escala', duracao: 200 });
  }
  function mover(n) { indice = (indice + n + itens.length) % itens.length; pintar(); }
  function tecla(e) {
    if (e.key === 'Escape') fecharLightbox();
    if (e.key === 'ArrowLeft') mover(-1);
    if (e.key === 'ArrowRight') mover(1);
  }

  document.body.append(box);
  document.body.style.overflow = 'hidden';
  addEventListener('keydown', tecla);
  lbEstado = { box, tecla };
  pintar();
}
export function fecharLightbox() {
  if (!lbEstado) return;
  removeEventListener('keydown', lbEstado.tecla);
  lbEstado.box.remove();
  document.body.style.overflow = '';
  lbEstado = null;
}

/* ==========================================================
   GRÁFICOS (SVG puro)
   ========================================================== */
/** Barras verticais. dados = [{rot, v, cor?, dim?}] */
export function gBarras(dados, { alt = 160, cor = '#a855f7', formato = (v) => v, rotulos = true } = {}) {
  const larg = 320; const pad = { t: 14, b: rotulos ? 20 : 6, l: 4, r: 4 };
  const max = Math.max(1, ...dados.map((d) => d.v));
  const s = svg('svg', { class: 'chart', viewBox: `0 0 ${larg} ${alt}`, role: 'img' });
  const bw = (larg - pad.l - pad.r) / Math.max(1, dados.length);
  dados.forEach((d, i) => {
    const hh = ((alt - pad.t - pad.b) * d.v) / max;
    const x = pad.l + i * bw + bw * 0.2; const w = bw * 0.6;
    const r = svg('rect', {
      x, y: alt - pad.b - hh, width: w, height: Math.max(d.v > 0 ? 3 : 0, hh),
      rx: 4, fill: d.cor || cor, opacity: d.dim ? 0.35 : 0.95,
    });
    s.append(r);
    if (rotulos) {
      const t = svg('text', { x: x + w / 2, y: alt - 6, 'text-anchor': 'middle', 'font-size': 8.5, fill: 'currentColor', opacity: .55 });
      t.textContent = d.rot; s.append(t);
    }
    if (d.v > 0) {
      const t2 = svg('text', { x: x + w / 2, y: alt - pad.b - hh - 4, 'text-anchor': 'middle', 'font-size': 8.5, fill: 'currentColor', opacity: .75, 'font-weight': 700 });
      t2.textContent = formato(d.v); s.append(t2);
    }
  });
  return s;
}

/** Linha com área preenchida. dados = [{rot, v}] */
export function gLinha(dados, { alt = 160, cor = '#54e0e6' } = {}) {
  const larg = 320; const pad = { t: 14, b: 20, l: 6, r: 6 };
  const max = Math.max(1, ...dados.map((d) => d.v));
  const s = svg('svg', { class: 'chart', viewBox: `0 0 ${larg} ${alt}`, role: 'img' });
  const px = (i) => pad.l + (i * (larg - pad.l - pad.r)) / Math.max(1, dados.length - 1);
  const py = (v) => alt - pad.b - ((alt - pad.t - pad.b) * v) / max;
  const pts = dados.map((d, i) => `${px(i)},${py(d.v)}`).join(' ');
  const gid = `gl${Math.random().toString(36).slice(2, 7)}`;
  const grad = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: 0, 'stop-color': cor, 'stop-opacity': .38 }),
    svg('stop', { offset: 1, 'stop-color': cor, 'stop-opacity': 0 }));
  s.append(svg('defs', {}, grad));
  s.append(svg('polygon', { points: `${pad.l},${alt - pad.b} ${pts} ${larg - pad.r},${alt - pad.b}`, fill: `url(#${gid})` }));
  s.append(svg('polyline', { points: pts, fill: 'none', stroke: cor, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  dados.forEach((d, i) => {
    s.append(svg('circle', { cx: px(i), cy: py(d.v), r: 2.6, fill: cor }));
    if (dados.length <= 16) {
      const t = svg('text', { x: px(i), y: alt - 6, 'text-anchor': 'middle', 'font-size': 8, fill: 'currentColor', opacity: .55 });
      t.textContent = d.rot; s.append(t);
    }
  });
  return s;
}

/** Barras horizontais rotuladas. dados = [{rot, v, max?, cor?}] */
export function gBarrasH(dados, { formato = (v) => v } = {}) {
  const box = h('div', { class: 'list' });
  const max = Math.max(1, ...dados.map((d) => d.max ?? d.v));
  for (const d of dados) {
    const i = h('i', { style: { width: '0%', background: d.cor || undefined } });
    box.append(h('div', {},
      h('div', { class: 'flexb tiny', style: { marginBottom: '5px' } },
        h('span', { class: 'muted' }, d.rot), h('b', { class: 'sp' }, formato(d.v))),
      h('div', { class: 'bar' }, i)));
    requestAnimationFrame(() => crescer(i, (d.v / max) * 100));
  }
  return box;
}

/** Anel de progresso (0..1). */
export function gAnel(p, { tam = 96, traco = 9, cor = '#a855f7', texto = null, fundo = 'rgba(255,255,255,.08)' } = {}) {
  const r = (tam - traco) / 2; const c = 2 * Math.PI * r;
  const s = svg('svg', { viewBox: `0 0 ${tam} ${tam}`, width: tam, height: tam, role: 'img' });
  s.append(svg('circle', { cx: tam / 2, cy: tam / 2, r, fill: 'none', stroke: fundo, 'stroke-width': traco }));
  s.append(svg('circle', {
    cx: tam / 2, cy: tam / 2, r, fill: 'none', stroke: cor, 'stroke-width': traco, 'stroke-linecap': 'round',
    'stroke-dasharray': `${c * clamp(p, 0, 1)} ${c}`, transform: `rotate(-90 ${tam / 2} ${tam / 2})`,
  }));
  if (texto !== null) {
    const t = svg('text', {
      x: tam / 2, y: tam / 2 + tam / 12, 'text-anchor': 'middle',
      'font-size': tam / 3.8, 'font-weight': 800, fill: 'currentColor',
    });
    t.textContent = texto; s.append(t);
  }
  return s;
}

/** Rosca. dados = [{rot, v, cor}] */
export function gPizza(dados, { tam = 130, furo = 0.58 } = {}) {
  const total = dados.reduce((a, b) => a + b.v, 0) || 1;
  const s = svg('svg', { viewBox: `0 0 ${tam} ${tam}`, width: tam, height: tam, role: 'img' });
  let ang = -Math.PI / 2;
  const cx = tam / 2; const cy = tam / 2; const r = tam / 2 - 2;
  for (const d of dados) {
    if (!d.v) continue;
    const a2 = ang + (d.v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(ang); const y1 = cy + r * Math.sin(ang);
    const x2 = cx + r * Math.cos(a2); const y2 = cy + r * Math.sin(a2);
    const grande = a2 - ang > Math.PI ? 1 : 0;
    s.append(svg('path', { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${grande} 1 ${x2},${y2} Z`, fill: d.cor, opacity: .92 }));
    ang = a2;
  }
  s.append(svg('circle', { cx, cy, r: r * furo, fill: 'var(--panel)' }));
  return s;
}

export const legenda = (dados) =>
  h('div', { class: 'legend' }, ...dados.map((d) =>
    h('span', {}, h('i', { style: { background: d.cor } }), `${d.rot}${d.extra ? ` · ${d.extra}` : ''}`)));

/* ==========================================================
   ANIMAÇÃO — reexporta o que as telas mais usam
   ========================================================== */
export { entrada, cascata, contar, tremer };
export const animarLista = (container, passo = 40) => cascata(container?.children, { passo });
export { esc };
