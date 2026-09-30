// Utilitários de interface (DOM): criação de elementos, diálogos acessíveis, avisos.
import { crestSVG, teamStars } from './teams.js';

/** h('div.cls#id', {attrs}, ...filhos) */
export function h(tag, attrs, ...kids) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag);
  const el = document.createElement(m[1] || 'div');
  for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function crest(team, size = 40) {
  return h('span.crest', { html: crestSVG(team, size), 'aria-hidden': 'true' });
}

export function stars(team) {
  const s = teamStars(team);
  const el = h('span.stars', { 'aria-label': `${s} estrelas` });
  let txt = '';
  for (let i = 1; i <= 5; i++) txt += s >= i ? '★' : s >= i - 0.5 ? '⯪' : '☆';
  el.textContent = txt;
  return el;
}

export function kitDots(kit) {
  return h('span.kitdots', { 'aria-hidden': 'true' }, h('i', { style: { background: kit.fill, borderColor: kit.trim } }));
}

export function ratingColor(r) {
  if (r == null) return 'transparent';
  if (r >= 8) return '#3ddc84';
  if (r >= 7) return '#b6e86a';
  if (r >= 6) return '#e8d36a';
  if (r >= 5) return '#f0a15a';
  return '#f06a5a';
}
export function ratingBadge(r) {
  return h('span.rating', { style: { background: ratingColor(r), color: '#111' } }, r == null ? '–' : r.toFixed(1));
}

let toastTimer = null;
export function toast(msg, err = false, ms = 2600) {
  document.querySelector('.toast')?.remove();
  const el = h('div.toast', { role: err ? 'alert' : 'status' }, msg);
  if (err) el.classList.add('err');
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

/**
 * Diálogo modal acessível: prende o foco, fecha com Esc (se permitido) e devolve o foco ao sair.
 * Retorna { el, close }.
 */
export function modal(content, { label = 'Diálogo', onClose = null, dismissable = true } = {}) {
  const prev = document.activeElement;
  const sheet = h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, content);
  const ov = h('div.overlay', null, sheet);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    ov.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose?.();
    if (prev && prev.focus && document.contains(prev)) prev.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...sheet.querySelectorAll('button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    e.stopPropagation();
  };
  if (dismissable) ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(ov);
  requestAnimationFrame(() => (sheet.querySelector('[autofocus]') || sheet.querySelector('button:not([disabled])'))?.focus());
  return { el: sheet, close };
}

/** Controle segmentado (grupo de botões com aria-pressed). */
export function segmented(options, value, onChange, { wide = false, label = '' } = {}) {
  const el = h('div.seg', { role: 'group', 'aria-label': label });
  if (wide) el.classList.add('wide');
  const set = (v) => { for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); };
  for (const o of options) {
    el.appendChild(h('button', { type: 'button', dataset: { v: String(o.v) }, 'aria-pressed': String(String(o.v) === String(value)), title: o.title || null, onclick: () => { set(o.v); onChange(o.v); } }, o.label));
  }
  el.setValue = set;
  return el;
}

export function switchInput(label, checked, onChange, hint) {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label.opt-row', null, h('span.l', null, label, hint ? h('small', null, hint) : null), h('span.switch', null, input));
}

/** Espera o próximo quadro (para não travar a interface em cálculos longos). */
export const nextFrame = () => new Promise((r) => setTimeout(r, 0));
