/* ===== util.js — helpers gerais: datas, números, DOM e texto =====
   Sem dependências. Tudo que aparece em mais de um módulo mora aqui.          */

/* ---------- identificadores e números ---------- */
export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const round = (n, c = 0) => { const p = 10 ** c; return Math.round(n * p) / p; };
export const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
export const avg = (a) => (a.length ? sum(a) / a.length : 0);
export const pct = (n) => `${Math.round(n)}%`;
export const nf = (n, c = 0) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
export const precoBR = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ---------- datas (horário local do aparelho) ---------- */
export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_S = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_S = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function hoje() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function iso(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y) return null;
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const t = String(s).slice(11, 16);
  if (t) { const [hh, mm] = t.split(':').map(Number); dt.setHours(hh || 0, mm || 0, 0, 0); }
  return dt;
}
export const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMeses = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
export const inicioSemana = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
export const inicioMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export function diasEntre(a, b) {
  const x = new Date(a); x.setHours(12, 0, 0, 0);
  const y = new Date(b); y.setHours(12, 0, 0, 0);
  return Math.round((y - x) / 86400000);
}
export function horasAte(dataISO, hora = '') {
  const d = parseISO(dataISO); if (!d) return 9999;
  if (hora) { const [hh, mm] = hora.split(':').map(Number); d.setHours(hh || 0, mm || 0, 0, 0); }
  else d.setHours(23, 59, 0, 0);          // prazo sem hora vale até o fim do dia
  return (d - new Date()) / 3600000;
}
export function fmtData(s, { curto = false, relativo = true } = {}) {
  const d = parseISO(s); if (!d) return '—';
  const n = diasEntre(hoje(), d);
  if (relativo) {
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    if (n > 1 && n <= 6) return DIAS[d.getDay()].toLowerCase();
    if (n < 0 && n >= -6) return `${Math.abs(n)} dias atrás`;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return curto ? `${dd}/${mm}` : `${dd}/${mm}/${d.getFullYear()}`;
}
export function fmtDataLonga(s) {
  const d = parseISO(s); if (!d) return '—';
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}
export function fmtPrazo(s) {
  const d = parseISO(s); if (!d) return { txt: 'sem data', cls: '' };
  const n = diasEntre(hoje(), d);
  if (n < 0) return { txt: `atrasado ${Math.abs(n)}d`, cls: 'bad' };
  if (n === 0) return { txt: 'hoje', cls: 'bad' };
  if (n === 1) return { txt: 'amanhã', cls: 'alert' };
  if (n <= 3) return { txt: `em ${n} dias`, cls: 'warn' };
  if (n <= 30) return { txt: `em ${n} dias`, cls: '' };
  return { txt: fmtData(s, { relativo: false }), cls: '' };
}
export function fmtMin(m) {
  m = Math.round(m || 0);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}
export function fmtQuando(isoCompleto) {
  const d = new Date(isoCompleto);
  if (Number.isNaN(+d)) return '—';
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const dias = Math.round(hrs / 24);
  if (dias < 7) return `${dias}d atrás`;
  return fmtData(iso(d), { relativo: false, curto: true });
}
export function saudacao() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
/** Hora atual em outro fuso, sem biblioteca — Intl resolve o horário de verão. */
export function horaEmFuso(fuso, { comSegundos = false } = {}) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: fuso, hour: '2-digit', minute: '2-digit',
      ...(comSegundos ? { second: '2-digit' } : {}), hour12: false,
    }).format(new Date());
  } catch { return '--:--'; }
}
export function diaEmFuso(fuso) {
  try {
    const p = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'short', day: '2-digit', month: '2-digit' })
      .formatToParts(new Date());
    const g = (t) => p.find((x) => x.type === t)?.value || '';
    return `${g('weekday').replace('.', '')} ${g('day')}/${g('month')}`;
  } catch { return ''; }
}
/** Hora cheia (0-23) naquele fuso — usada para saber se é dia ou noite lá. */
export function horaNumericaEmFuso(fuso) {
  const h = Number(horaEmFuso(fuso).slice(0, 2));
  return Number.isNaN(h) ? 12 : h;
}

/* ---------- DOM ---------- */
/**
 * Cria um elemento. `h('div', {class:'card'}, 'texto', outroEl)`
 * Atributos especiais: class, html, style (objeto), on<Evento> (função).
 */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(9)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const SVGNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const kid of kids.flat(9)) if (kid) el.append(kid);
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Baixa um arquivo gerado no navegador (blob ou dataURL). */
export function baixar(nome, conteudo, tipo = 'application/octet-stream') {
  const url = typeof conteudo === 'string' && conteudo.startsWith('data:')
    ? conteudo
    : URL.createObjectURL(conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo }));
  const a = h('a', { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  if (!url.startsWith('data:')) setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Lê um <input type=file> como dataURL. */
export function lerArquivo(file) {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => erro(new Error('Não consegui ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

/* ---------- texto ---------- */
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const inicial = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();
export const iniciais = (s) => String(s || '')
  .trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';
export const titulizar = (s) => String(s || '').replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1));
export function cortar(s, n = 90) {
  const t = String(s || '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
/** Marcação mínima para respostas do conselheiro: **negrito**, ## título, - lista. */
export function textoRico(txt) {
  const linhas = String(txt || '').split('\n');
  const out = []; let lista = null;
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  for (const l of linhas) {
    const t = l.trim();
    if (/^[-•*]\s+/.test(t)) { (lista ??= []).push(inline(t.replace(/^[-•*]\s+/, ''))); continue; }
    if (lista) { out.push(`<ul>${lista.map((i) => `<li>${i}</li>`).join('')}</ul>`); lista = null; }
    if (!t) { out.push(''); continue; }
    if (/^#{1,4}\s+/.test(t)) out.push(`<h4>${inline(t.replace(/^#{1,4}\s+/, ''))}</h4>`);
    else out.push(inline(t));
  }
  if (lista) out.push(`<ul>${lista.map((i) => `<li>${i}</li>`).join('')}</ul>`);
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/* ---------- cores ---------- */
/** Mistura duas cores hex. t=0 devolve a, t=1 devolve b. */
export function misturar(a, b, t = 0.5) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a); const [r2, g2, b2] = p(b);
  const m = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}
/** Preto ou branco — o que tiver mais contraste sobre a cor dada. */
export function contraste(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.42 ? '#12101f' : '#ffffff';
}

/* ---------- agendamento ---------- */
/** Adia a execução até parar de ser chamada por `ms`. */
export function debounce(fn, ms = 200) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export const proximoQuadro = () => new Promise((r) => requestAnimationFrame(() => r()));
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
