/* ===== util.js — helpers gerais (datas, DOM, formatação) ===== */
export const TZ = 'America/Sao_Paulo';

/* ---------- ids / números ---------- */
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const round = (n, c = 0) => { const p = 10 ** c; return Math.round(n * p) / p; };
export const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
export const avg = (a) => (a.length ? sum(a) / a.length : 0);
export const pct = (n) => `${Math.round(n)}%`;
export const nf = (n, c = 1) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

/* ---------- datas (tudo em horário local do aparelho) ---------- */
export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_S = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function iso(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y) return null;
  const t = String(s).slice(11, 16);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (t) { const [hh, mm] = t.split(':').map(Number); dt.setHours(hh || 0, mm || 0, 0, 0); }
  return dt;
}
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
export function daysBetween(a, b) {
  const x = new Date(a); x.setHours(0, 0, 0, 0);
  const y = new Date(b); y.setHours(0, 0, 0, 0);
  return Math.round((y - x) / 86400000);
}
export function hoursUntil(dateISO) {
  const d = parseISO(dateISO); if (!d) return 9999;
  if (String(dateISO).length <= 10) d.setHours(23, 59, 0, 0); // prazo sem hora = fim do dia
  return (d - new Date()) / 3600000;
}
export function fmtData(s, { curto = false } = {}) {
  const d = parseISO(s); if (!d) return '—';
  const n = daysBetween(today(), d);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n > 1 && n <= 6) return DIAS[d.getDay()].toLowerCase();
  if (n < 0) return `${Math.abs(n)} dias atrás`;
  return curto ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
export function fmtPrazo(s) {
  const n = daysBetween(today(), parseISO(s));
  if (n < 0) return { txt: `atrasado ${Math.abs(n)}d`, cls: 'bad' };
  if (n === 0) return { txt: 'hoje', cls: 'bad' };
  if (n === 1) return { txt: 'amanhã', cls: 'alert' };
  if (n <= 3) return { txt: `em ${n} dias`, cls: 'warn' };
  return { txt: `em ${n} dias`, cls: '' };
}
export function fmtMin(m) {
  m = Math.round(m || 0);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}
export function saudacao() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/* ---------- DOM ---------- */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(9)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- texto ---------- */
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const inicial = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();
export function frases(txt) {
  return String(txt || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])/).map((s) => s.trim()).filter((s) => s.length > 12);
}
export function palavras(txt) {
  return norm(txt).replace(/[^a-z0-9à-ú\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
}
export const STOP = new Set(('para com como onde quando porque tambem mais menos muito pouco entre sobre pelo pela pelos pelas '
  + 'esse essa isso este esta isto aquele aquela aquilo seus suas dele dela deles delas foram sendo pode podem deve devem '
  + 'sera serao tem tinha havia assim ainda apenas cada qual quais toda todo todas todos outro outra outros outras').split(' '));
