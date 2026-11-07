/* ===== apresentacoes-desenho.js — desenha os slides e exporta para PowerPoint =====
   O MESMO modelo de slide serve para a prévia, para o modo apresentar, para o PDF
   (impressão) e para o PowerPoint (PptxGenJS, carregado só na hora de baixar). */
import { h } from './util.js';

export const TEMAS = {
  cartaz: { nome: 'Cartaz', bg: '0a0b10', txt: 'f0ead9', dim: 'b2ac9c', acc: '3ec9f5', sec: 'f1d794', caixa: '14161d' },
  papel: { nome: 'Papel', bg: 'f6e7bd', txt: '191511', dim: '5f584a', acc: '1689c2', sec: '8a6d1f', caixa: 'fdf6e0' },
  neon: { nome: 'Neon', bg: '3ec9f5', txt: '07202c', dim: '0d4a63', acc: '0a0b10', sec: 'fdf6e0', caixa: 'ffffff' },
};
export const TIPOS_SLIDE = [
  { v: 'capa', t: 'Capa' }, { v: 'topicos', t: 'Tópicos' }, { v: 'duas_colunas', t: 'Duas colunas' },
  { v: 'destaque', t: 'Destaque' }, { v: 'pergunta', t: 'Pergunta' }, { v: 'fim', t: 'Encerramento' },
];

const MARCA = 'M64 22c-8-6-20-5-26 2-8-2-15 3-17 11-7 3-10 12-6 19-5 6-4 15 2 20-2 8 3 15 11 17 2 8 10 13 18 11 5 6 13 7 18 2 5 5 13 4 18-2 8 2 16-3 18-11 8-2 13-9 11-17 6-5 7-14 2-20 4-7 1-16-6-19-2-8-9-13-17-11-6-7-18-8-26-2zM34 76 50 60l12 10 16-20 16 12';
function logo(cor) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 128 128'); s.setAttribute('class', 'sld__logo'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<path d="${MARCA}" fill="none" stroke="#${cor}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  return s;
}

const lista = (itens, cls = '') => h('ul', { class: `sld__lista ${cls}` }, ...(itens || []).filter(Boolean).map((t) => h('li', {}, t)));

/** Um slide 16:9. O tamanho do texto acompanha a largura (unidades cqw). */
export function desenharSlide(sl, ap, i, total) {
  const T = TEMAS[ap.tema] || TEMAS.cartaz;
  // variáveis CSS do tema (texto, pois style={} não aceita propriedades --personalizadas)
  const cor = `--s-bg:#${T.bg};--s-txt:#${T.txt};--s-dim:#${T.dim};--s-acc:#${T.acc};--s-sec:#${T.sec};--s-caixa:#${T.caixa}`;
  const rodape = h('div', { class: 'sld__rodape' }, h('span', {}, ap.autor || ''), h('span', {}, total ? `${i + 1}/${total}` : ''));
  let miolo;
  switch (sl.tipo) {
    case 'capa':
      miolo = [logo(T.acc), h('div', { class: 'sld__capa' },
        ap.materia ? h('span', { class: 'sld__selo' }, ap.materia) : null,
        h('h1', {}, sl.titulo || ap.titulo), h('p', {}, sl.texto || ap.subtitulo || ''))];
      break;
    case 'duas_colunas':
      miolo = [h('h2', {}, sl.titulo), h('div', { class: 'sld__cols' },
        h('div', { class: 'sld__col' }, h('b', {}, sl.rotuloEsquerda || ''), lista(sl.esquerda)),
        h('div', { class: 'sld__col' }, h('b', {}, sl.rotuloDireita || ''), lista(sl.direita)))];
      break;
    case 'destaque':
      miolo = [h('div', { class: 'sld__destaque' }, h('span', {}, sl.titulo), h('strong', {}, sl.texto || ''))];
      break;
    case 'pergunta':
      miolo = [h('div', { class: 'sld__pergunta' }, h('i', {}, '?'), h('div', {}, h('h2', {}, sl.titulo), h('p', {}, sl.texto || '')))];
      break;
    case 'fim':
      miolo = [logo(T.acc), h('div', { class: 'sld__capa sld__fim' }, h('h1', {}, sl.titulo || 'Obrigado!'), h('p', {}, sl.texto || ''))];
      break;
    default:
      miolo = [h('h2', {}, sl.titulo), sl.texto ? h('p', { class: 'sld__lead' }, sl.texto) : null, lista(sl.topicos)];
  }
  return h('div', { class: `sld sld--${sl.tipo || 'topicos'}`, style: cor }, h('div', { class: 'sld__in' }, ...miolo.filter(Boolean), rodape));
}

/* ---------- PowerPoint ---------- */
let carregando = null;
function carregarPptx() {
  if (window.PptxGenJS) return Promise.resolve();
  if (!carregando) {
    carregando = new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = new URL('../vender/pptxgen.bundle.js', import.meta.url).href;
      s.onload = () => ok(); s.onerror = () => { carregando = null; erro(new Error('Não consegui carregar o gerador de PowerPoint. Verifique a internet.')); };
      document.head.append(s);
    });
  }
  return carregando;
}

/** Monta o .pptx (16:9) e baixa. Títulos em Anton (existe no Canva e no Google Slides; no PowerPoint sem a fonte, ele troca). */
export async function baixarPowerPoint(ap) {
  await carregarPptx();
  const T = TEMAS[ap.tema] || TEMAS.cartaz;
  const p = new window.PptxGenJS();
  p.layout = 'LAYOUT_WIDE';                 // 13,33 × 7,5 pol
  p.title = ap.titulo; p.author = ap.autor || 'MindTrack AI'; p.company = 'MindTrack AI';
  const TIT = { fontFace: 'Anton', color: T.txt, margin: 0 };
  const TXT = { fontFace: 'Arial', color: T.txt, margin: 0 };
  const total = ap.slides.length;
  ap.slides.forEach((sl, i) => {
    const s = p.addSlide();
    s.background = { color: T.bg };
    const barra = (x, y, w = 1.3) => s.addShape(p.ShapeType.rect, { x, y, w, h: 0.09, fill: { color: T.acc }, line: { color: T.acc } });
    const marcadores = (itens, x, y, w, hh, tam = 24) => s.addText(
      (itens || []).filter(Boolean).map((t) => ({ text: t, options: { bullet: { code: '25A0', indent: 22 }, color: T.txt, breakLine: true } })),
      { ...TXT, x, y, w, h: hh, fontSize: tam, valign: 'top', paraSpaceAfter: 12 });
    switch (sl.tipo) {
      case 'capa':
      case 'fim':
        if (sl.tipo === 'capa' && ap.materia) {
          s.addText(ap.materia.toUpperCase(), { ...TXT, x: 0.8, y: 1.3, w: 4, h: 0.45, fontSize: 14, bold: true, color: T.bg, fill: { color: T.acc }, align: 'center' });
        }
        s.addText((sl.titulo || ap.titulo).toUpperCase(), { ...TIT, x: 0.8, y: 1.9, w: 11.7, h: 3.1, fontSize: sl.tipo === 'fim' ? 80 : 64, valign: 'bottom', fit: 'shrink' });
        barra(0.8, 5.25, 1.6);
        s.addText(sl.texto || (sl.tipo === 'capa' ? ap.subtitulo : '') || '', { ...TXT, x: 0.8, y: 5.5, w: 11.7, h: 0.9, fontSize: 22, color: T.dim, valign: 'top' });
        break;
      case 'duas_colunas':
        s.addText(sl.titulo.toUpperCase(), { ...TIT, x: 0.8, y: 0.55, w: 11.7, h: 0.95, fontSize: 40 });
        barra(0.8, 1.6);
        [[sl.rotuloEsquerda, sl.esquerda, 0.8], [sl.rotuloDireita, sl.direita, 6.9]].forEach(([rot, itens, x]) => {
          s.addShape(p.ShapeType.roundRect, { x, y: 2.0, w: 5.6, h: 4.6, fill: { color: T.caixa }, line: { color: T.caixa }, rectRadius: 0.25 });
          s.addText(rot || '', { ...TXT, x: x + 0.35, y: 2.25, w: 4.9, h: 0.5, fontSize: 20, bold: true, color: T.acc === '0a0b10' ? T.txt : T.acc });
          marcadores(itens, x + 0.35, 2.9, 4.9, 3.5, 20);
        });
        break;
      case 'destaque':
        s.addText(sl.titulo.toUpperCase(), { ...TXT, x: 0.8, y: 1.4, w: 11.7, h: 0.6, fontSize: 18, bold: true, color: T.dim, align: 'center', charSpacing: 4 });
        s.addText(sl.texto || '', { ...TIT, x: 0.8, y: 2.1, w: 11.7, h: 3.6, fontSize: 54, color: T.acc === '0a0b10' ? T.txt : T.acc, align: 'center', valign: 'middle', fit: 'shrink' });
        break;
      case 'pergunta':
        s.addText('?', { ...TIT, x: 0.8, y: 1.3, w: 3.2, h: 4.8, fontSize: 240, color: T.acc, align: 'center' });
        s.addText(sl.titulo.toUpperCase(), { ...TIT, x: 4.3, y: 2.0, w: 8.2, h: 1.6, fontSize: 40, valign: 'bottom' });
        s.addText(sl.texto || '', { ...TXT, x: 4.3, y: 3.8, w: 8.2, h: 2.2, fontSize: 24, color: T.dim, valign: 'top' });
        break;
      default:
        s.addText(sl.titulo.toUpperCase(), { ...TIT, x: 0.8, y: 0.55, w: 11.7, h: 0.95, fontSize: 40 });
        barra(0.8, 1.6);
        if (sl.texto) s.addText(sl.texto, { ...TXT, x: 0.8, y: 1.85, w: 11.7, h: 0.7, fontSize: 20, color: T.dim });
        marcadores(sl.topicos, 0.8, sl.texto ? 2.7 : 2.0, 11.7, sl.texto ? 4.1 : 4.8, 26);
    }
    s.addText(`${ap.autor ? `${ap.autor} · ` : ''}${i + 1}/${total}`, { ...TXT, x: 8.5, y: 6.85, w: 4, h: 0.35, fontSize: 11, color: T.dim, align: 'right' });
    if (sl.notas) s.addNotes(sl.notas);
  });
  const nome = (ap.titulo || 'apresentacao').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'apresentacao';
  await p.writeFile({ fileName: `${nome}.pptx` });
  return `${nome}.pptx`;
}
