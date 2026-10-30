// Texturas procedurais (canvas) da cidade de THE FLASH: fachadas (cor + janelas acesas + a máscara do vidro, para as salas
// de janelas.js), asfalto, calçada, grama, telhado. Cada estilo de fachada desenha em `g` (cor), `e` (janelas acesas à
// noite) e `m` (branco = vidro); as fachadas têm peitoris com sombra, molduras com relevo e o escorrido de sujeira que a
// chuva deixa embaixo de cada janela.
import * as THREE from 'three';
import { CELL, RUA } from './cidade.js';

export const FACHADA_M = 16;               // uma repetição da fachada = 16 m × 16 m
export const TELHADO_M = 8;
export const CALCADA_M = 6;
export const GRAMA_M = 6;

let semente = 12345;
const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };
const r = (a, b) => a + rnd() * (b - a);
const pick = (v) => v[Math.floor(rnd() * v.length)];

function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
// o RELEVO (bumpMap) de cada textura sai do mesmo desenho, num canvas cinza à parte (claro sobe, escuro afunda); no celular
// o relevo não é usado e o desenho vai para um contexto que não faz nada
const NADA = new Proxy(function () {}, { get: () => NADA, set: () => true, apply: () => NADA });
function relevo(S, alta) { if (!alta) return [null, NADA]; const [c, g] = tela(S, S); g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); return [c, g]; }
function granulado(g, w, h, n, alfa = 0.07) {
  for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${alfa * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
}
function sujeira(g, w, h) {                // escorrido de sujeira no pé de cada andar
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function textura(canvas, { cor = true, repete = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  if (repete) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
const QUENTE = ['#ffe2a0', '#ffd27a', '#fff0c8', '#ffc66b', '#bfe3ff'];
// peitoril de pedra embaixo da janela (com a sombra) e o escorrido de sujeira que desce dos cantos dele
function peitoril(g, x, y, w, cor = '#d9d2c2') {
  g.fillStyle = cor; g.fillRect(x - 5, y, w + 10, 5);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x - 5, y + 5, w + 10, 3);
  for (const ex of [x - 3, x + w + 1]) { const gr = g.createLinearGradient(0, y + 8, 0, y + 8 + r(18, 46)); gr.addColorStop(0, 'rgba(30,25,20,0.28)'); gr.addColorStop(1, 'rgba(30,25,20,0)'); g.fillStyle = gr; g.fillRect(ex, y + 8, r(3, 7), 46); }
}
// moldura com relevo: luz em cima e à esquerda, sombra embaixo e à direita (o sol da cidade vem de cima)
function moldura(g, x, y, w, h, l = 4) {
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x - l, y - l, w + 2 * l, l); g.fillRect(x - l, y - l, l, h + 2 * l);
  g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(x - l, y + h, w + 2 * l, l); g.fillRect(x + w, y - l, l, h + 2 * l);
}

// ----- fachadas: [cor, emissiva] em 512×512 -----
const ESTILOS = [
  function vidro(g, e, S, m, rv) {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#4d7396'); gr.addColorStop(1, '#1f3550'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const cols = 8, lin = 4, cw = S / cols, ch = S / lin;
    for (let a = 0; a < cols; a++) for (let b = 0; b < lin; b++) {
      const x = a * cw, y = b * ch, ref = g.createLinearGradient(x, y, x + cw, y + ch);
      ref.addColorStop(0, `rgba(190,225,255,${r(0.12, 0.4)})`); ref.addColorStop(1, 'rgba(10,20,40,0.35)');
      g.fillStyle = ref; g.fillRect(x + 2, y + 2, cw - 4, ch - 4); m.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      if (rnd() < 0.42) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.5, 0.95); e.fillRect(x + 2, y + 2, cw - 4, ch - 4); e.globalAlpha = 1; }
    }
    g.strokeStyle = '#121c2b'; g.lineWidth = 3; rv.fillStyle = '#d0d0d0';
    for (let a = 0; a <= cols; a++) rv.fillRect(a * cw - 2, 0, 4, S); for (let k = 0; k <= lin; k++) rv.fillRect(0, k * ch - 2, S, 4);
    for (let a = 0; a <= cols; a++) { g.beginPath(); g.moveTo(a * cw, 0); g.lineTo(a * cw, S); g.stroke(); }
    for (let b = 0; b <= lin; b++) { g.beginPath(); g.moveTo(0, b * ch); g.lineTo(S, b * ch); g.stroke(); }
  },
  function tijolo(g, e, S, m, rv) {
    g.fillStyle = '#6e3a2e'; g.fillRect(0, 0, S, S); rv.fillStyle = '#505050'; rv.fillRect(0, 0, S, S);
    for (let y = 0, k = 0; y < S; y += 14, k++) for (let x = -(k % 2) * 16; x < S; x += 32) {
      const t = r(-14, 14), q = rnd() < 0.08 ? -22 : 0; g.fillStyle = `rgb(${138 + t + q},${68 + t * 0.6 + q * 0.5},${52 + t * 0.5 + q * 0.4})`; g.fillRect(x + 1, y + 1, 30, 12);
      g.fillStyle = 'rgba(255,230,210,0.08)'; g.fillRect(x + 1, y + 1, 30, 2);                 // a quina de cima do tijolo pega luz
      rv.fillStyle = `rgb(${150 + t},${150 + t},${150 + t})`; rv.fillRect(x + 1.5, y + 1.5, 29, 11);
    }
    const cols = 5, lin = 4, cw = S / cols, ch = S / lin;
    for (let a = 0; a < cols; a++) for (let b = 0; b < lin; b++) {
      const x = a * cw + cw * 0.2, y = b * ch + ch * 0.18, w = cw * 0.6, h = ch * 0.62;
      g.fillStyle = '#d8c9a6'; g.fillRect(x - 5, y - 5, w + 10, h + 12);          // moldura de pedra
      rv.fillStyle = '#c8c8c8'; rv.fillRect(x - 5, y - 5, w + 10, h + 12); rv.fillStyle = '#e8e8e8'; rv.fillRect(x - 9, y + h + 6, w + 18, 6);
      moldura(g, x - 1, y - 1, w + 2, h + 2, 4);
      g.fillStyle = '#1b2433'; g.fillRect(x, y, w, h); m.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(160,190,220,0.25)'; g.fillRect(x, y, w, h * 0.4);
      g.fillStyle = '#e8e2d4'; g.fillRect(x + w / 2 - 1.5, y, 3, h); g.fillRect(x, y + h / 2 - 1.5, w, 3);   // caixilho branco
      m.fillStyle = '#000'; m.fillRect(x + w / 2 - 1.5, y, 3, h); m.fillRect(x, y + h / 2 - 1.5, w, 3); m.fillStyle = '#fff';
      peitoril(g, x, y + h + 7, w, '#e2d8c0');
      if (rnd() < 0.45) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.55, 0.95); e.fillRect(x + 2, y + 2, w - 4, h - 4); e.globalAlpha = 1; }
    }
  },
  function concreto(g, e, S, m, rv) {
    g.fillStyle = '#9b9da1'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 128) for (let y = 0; y < S; y += 64) { g.fillStyle = `rgba(${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},0.025)`; g.fillRect(x, y, 128, 64); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 128, 1.5); g.fillRect(x, y, 1.5, 64); rv.fillStyle = '#404040'; rv.fillRect(x, y, 128, 2); rv.fillRect(x, y, 2, 64); }   // placas pré-moldadas
    const lin = 4, ch = S / lin;
    for (let b = 0; b < lin; b++) {
      const y = b * ch + ch * 0.28, h = ch * 0.44;
      g.fillStyle = '#18222f'; g.fillRect(0, y, S, h); m.fillRect(0, y, S, h);
      g.fillStyle = 'rgba(140,180,215,0.28)'; g.fillRect(0, y, S, h * 0.45);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, y - 4, S, 4); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y + h, S, 3);
      for (let x = 0; x < S; x += 64) {
        g.fillStyle = '#7d8084'; g.fillRect(x, y, 4, h); m.fillStyle = '#000'; m.fillRect(x, y, 4, h); m.fillStyle = '#fff';
        const gr = g.createLinearGradient(0, y + h + 3, 0, y + h + 40); gr.addColorStop(0, 'rgba(40,35,30,0.22)'); gr.addColorStop(1, 'rgba(40,35,30,0)'); g.fillStyle = gr; g.fillRect(x + r(8, 50), y + h + 3, r(3, 8), 40);
        if (rnd() < 0.4) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.5, 0.9); e.fillRect(x + 6, y + 3, 52, h - 6); e.globalAlpha = 1; }
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, b * ch + ch - 6, S, 6);                // laje
      rv.fillStyle = '#e0e0e0'; rv.fillRect(0, b * ch + ch - 8, S, 8);
    }
  },
  function escritorio(g, e, S, m, rv) {
    g.fillStyle = pick(['#cbb89a', '#c2b59f', '#d0c4aa']); g.fillRect(0, 0, S, S);
    const cols = 8, lin = 4, cw = S / cols, ch = S / lin;
    for (let a = 0; a < cols; a++) for (let b = 0; b < lin; b++) {
      const x = a * cw + cw * 0.17, y = b * ch + ch * 0.17, w = cw * 0.66, h = ch * 0.62;
      g.fillStyle = '#6a5e4c'; g.fillRect(x - 3, y - 3, w + 6, h + 6); moldura(g, x - 3, y - 3, w + 6, h + 6, 3);
      rv.fillStyle = '#c0c0c0'; rv.fillRect(x - 6, y - 6, w + 12, h + 12); rv.fillStyle = '#e4e4e4'; rv.fillRect(x - 8, y + h + 3, w + 16, 6);
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#6f93b3'); gr.addColorStop(1, '#2a3b4f'); g.fillStyle = gr; g.fillRect(x, y, w, h); m.fillRect(x, y, w, h);
      g.fillStyle = '#6a5e4c'; g.fillRect(x + w / 2 - 1, y, 2, h); m.fillStyle = '#000'; m.fillRect(x + w / 2 - 1, y, 2, h); m.fillStyle = '#fff';
      peitoril(g, x, y + h + 3, w, '#bdb29c');
      if (rnd() < 0.45) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.55, 0.95); e.fillRect(x, y, w, h); e.globalAlpha = 1; }
    }
  },
  function residencial(g, e, S, m, rv) {
    g.fillStyle = pick(['#d9b8a0', '#cfd6b0', '#b9c8d6', '#e0c9b0']); g.fillRect(0, 0, S, S);
    const cols = 4, lin = 4, cw = S / cols, ch = S / lin;
    for (let a = 0; a < cols; a++) for (let b = 0; b < lin; b++) {
      const x = a * cw + cw * 0.22, y = b * ch + ch * 0.12, w = cw * 0.56, h = ch * 0.56;
      g.fillStyle = '#f2ece0'; g.fillRect(x - 4, y - 4, w + 8, h + 8); moldura(g, x - 4, y - 4, w + 8, h + 8, 3);
      g.fillStyle = '#25303f'; g.fillRect(x, y, w, h); m.fillRect(x + 1, y, w - 1, h);
      g.fillStyle = 'rgba(150,185,215,0.3)'; g.fillRect(x, y, w, h * 0.45);
      g.fillStyle = '#5b6470'; g.fillRect(x - 10, y + h + 6, w + 20, 12);                  // sacada
      rv.fillStyle = '#d0d0d0'; rv.fillRect(x - 7, y - 7, w + 14, h + 14); rv.fillStyle = '#f0f0f0'; rv.fillRect(x - 10, y + h + 6, w + 20, 12);
      g.fillStyle = '#3d4550'; for (let k = 0; k < 8; k++) g.fillRect(x - 8 + k * ((w + 16) / 7), y + h + 6, 2, 12);
      g.fillStyle = pick(['#3d6b4a', '#7a3b3b', '#3b5a7a']); g.fillRect(x - 6, y, 7, h);   // persiana
      if (rnd() < 0.3) { g.fillStyle = '#c9cdd2'; g.fillRect(x + w - 26, y + h - 20, 24, 16); g.fillStyle = '#7d838b'; for (let k = 0; k < 5; k++) g.fillRect(x + w - 24, y + h - 18 + k * 3, 20, 1.5); m.fillStyle = '#000'; m.fillRect(x + w - 26, y + h - 20, 24, 16); m.fillStyle = '#fff'; }   // ar-condicionado
      if (rnd() < 0.5) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.5, 0.9); e.fillRect(x + 4, y, w - 4, h); e.globalAlpha = 1; }
    }
  },
  function decor(g, e, S, m, rv) {
    g.fillStyle = '#5b5648'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 64) {
      g.fillStyle = '#7a7261'; g.fillRect(x, 0, 14, S); g.fillStyle = '#403c32'; g.fillRect(x + 14, 0, 3, S);
      rv.fillStyle = '#e6e6e6'; rv.fillRect(x, 0, 14, S); rv.fillStyle = '#505050'; rv.fillRect(x + 14, 0, 3, S);
      const w = 26, jx = x + 22;
      for (let y = 10; y < S; y += 32) {
        g.fillStyle = '#12161d'; g.fillRect(jx, y, w, 20); m.fillRect(jx, y, w, 20);
        g.fillStyle = 'rgba(140,175,205,0.25)'; g.fillRect(jx, y, w, 8);
        if (rnd() < 0.42) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.5, 0.9); e.fillRect(jx + 1, y + 1, w - 2, 18); e.globalAlpha = 1; }
      }
    }
    g.fillStyle = '#c9a24a'; for (let k = 0; k < 4; k++) { g.fillRect(0, k * 128 + 124, S, 4); rv.fillStyle = '#f0f0f0'; rv.fillRect(0, k * 128 + 122, S, 7); }   // friso dourado
  },
];

// a grade das salas de cada estilo (colunas × andares numa repetição de 16 m) e quanto o vidro espelha (janelas.js)
const SALAS = [{ grade: [8, 4], espelho: 0.55 }, { grade: [5, 4], espelho: 0 }, { grade: [8, 4], espelho: 0.15 }, { grade: [8, 4], espelho: 0.1 }, { grade: [4, 4], espelho: 0 }, { grade: [8, 4], espelho: 0 }];
/** As fachadas: [{mapa, emissiva, mascara, relevo, grade, espelho}]. `alta`: desenhadas em 1024 px (no PC; o desenho é o
 *  mesmo) e com o RELEVO à parte (a argamassa e as juntas afundam, molduras, peitoris e frisos sobem, o vidro fica fundo
 *  na janela); antes o relevo era a própria cor (o vidro escuro "afundava" e o reflexo claro "subia"). */
export function criarFachadas(aniso = 8, { alta = false } = {}) {
  const out = [];
  const S = 512, R = alta ? 1024 : 512, k0 = R / S;
  for (let k = 0; k < ESTILOS.length; k++) {
    semente = 1000 + k * 77;
    const [c, g] = tela(R, R), [ce, e] = tela(R, R), [cm, m] = tela(256, 256), [cr, rv] = relevo(512, alta);
    for (const x of [g, e]) x.setTransform(k0, 0, 0, k0, 0, 0);
    m.setTransform(0.5, 0, 0, 0.5, 0, 0);
    e.fillStyle = '#000'; e.fillRect(0, 0, S, S); m.fillStyle = '#000'; m.fillRect(0, 0, S, S); m.fillStyle = '#fff';
    ESTILOS[k](g, e, S, m, rv);
    granulado(g, S, S, 5000 * k0, 0.09); sujeira(g, S, S);
    let relevoTex = null;
    if (cr) {
      // o vidro fundo na janela: onde a máscara é vidro, o relevo afunda (a máscara tem metade da resolução)
      rv.globalCompositeOperation = 'multiply'; rv.drawImage(inverter(cm), 0, 0, 512, 512); rv.globalCompositeOperation = 'source-over';
      granulado(rv, 512, 512, 9000, 0.12);
      relevoTex = textura(cr, { cor: false, aniso });
    }
    out.push({ mapa: textura(c, { aniso }), emissiva: textura(ce, { aniso }), mascara: textura(cm, { cor: false, aniso }), relevo: relevoTex, ...SALAS[k] });
  }
  return out;
}
// a máscara do vidro ao contrário (parede = branco, vidro = cinza escuro): multiplicada no relevo, o vidro afunda
function inverter(cm) {
  const [c, g] = tela(cm.width, cm.height), d = cm.getContext('2d').getImageData(0, 0, cm.width, cm.height), o = g.createImageData(cm.width, cm.height);
  for (let i = 0; i < d.data.length; i += 4) { const v = 255 - d.data[i] * 0.7; o.data[i] = o.data[i + 1] = o.data[i + 2] = v; o.data[i + 3] = 255; }
  g.putImageData(o, 0, 0); return c;
}

// o telhado: manta asfáltica em faixas com as emendas, cascalho, manchas de água parada e a platibanda
export function texturaTelhado(aniso = 8, { alta = false } = {}) {
  semente = 4242;
  const S = alta ? 512 : 256, k = S / 256, [c, g] = tela(S, S), [cr, rv] = relevo(S, alta);
  g.fillStyle = '#6d6f73'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 32 * k) { const v = r(-8, 8); g.fillStyle = `rgb(${109 + v},${111 + v},${115 + v})`; g.fillRect(0, y, S, 32 * k); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, S, 1.5 * k); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, y + 1.5 * k, S, 1 * k); rv.fillStyle = '#b0b0b0'; rv.fillRect(0, y, S, 3 * k); }
  for (let i = 0; i < 9000 * k * k; i++) { const v = rnd() < 0.5 ? r(60, 95) : r(140, 190); g.fillStyle = `rgba(${v},${v},${v - 4},0.5)`; const x = rnd() * S, y = rnd() * S, t = r(0.6, 1.8) * k; g.fillRect(x, y, t, t); rv.fillStyle = `rgba(${v + 20},${v + 20},${v + 20},0.6)`; rv.fillRect(x, y, t, t); }
  for (let i = 0; i < 7; i++) { const x = r(20, S - 20), y = r(20, S - 20), w = r(20, 60) * k, h = r(12, 40) * k, gr = g.createRadialGradient(x, y, 0, x, y, w); gr.addColorStop(0, 'rgba(30,32,36,0.3)'); gr.addColorStop(1, 'rgba(30,32,36,0)'); g.fillStyle = gr; g.fillRect(x - w, y - h, 2 * w, 2 * h); }
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2 * k; g.strokeRect(2 * k, 2 * k, S - 4 * k, S - 4 * k);         // platibanda
  const t = textura(c, { aniso }); if (cr) t.userData.relevo = textura(cr, { cor: false, aniso }); return t;
}

// a calçada: placas de concreto de 1,5 m com as juntas de dilatação, o acabamento vassourado, rachaduras, chiclete e manchas
export function texturaCalcada(aniso = 8, { alta = false } = {}) {
  semente = 777;
  const S = alta ? 1024 : 512, k = S / 512, [c, g] = tela(S, S), [cr, rv] = relevo(S, alta);
  g.fillStyle = '#9fa1a5'; g.fillRect(0, 0, S, S);
  const n = 4, s = S / n, j = 3 * k;
  for (let a = 0; a < n; a++) for (let q = 0; q < n; q++) {
    const x0 = a * s, y0 = q * s, v = r(-12, 10), hor = rnd() < 0.5;
    g.fillStyle = `rgb(${167 + v},${169 + v},${172 + v})`; g.fillRect(x0 + j / 2, y0 + j / 2, s - j, s - j);
    rv.fillStyle = '#a8a8a8'; rv.fillRect(x0 + j / 2, y0 + j / 2, s - j, s - j);
    for (let t = 0; t < s; t += r(2, 4) * k) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${r(0.02, 0.05)})`; if (hor) g.fillRect(x0 + j, y0 + t, s - 2 * j, 1); else g.fillRect(x0 + t, y0 + j, 1, s - 2 * j); }   // vassourado
    const gr = g.createLinearGradient(x0, y0, x0 + s, y0 + s); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.06)'); g.fillStyle = gr; g.fillRect(x0, y0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2 * k; g.strokeRect(x0 + j + 3 * k, y0 + j + 3 * k, s - 2 * j - 6 * k, s - 2 * j - 6 * k);   // a borda alisada da placa
    if (rnd() < 0.35) { g.strokeStyle = 'rgba(40,40,44,0.55)'; rv.strokeStyle = '#303030'; g.lineWidth = rv.lineWidth = 1.2 * k; let x = x0 + rnd() * s, y = y0 + j; g.beginPath(); rv.beginPath(); g.moveTo(x, y); rv.moveTo(x, y); for (let p = 0; p < 7; p++) { x += r(-14, 14) * k; y += s / 7; g.lineTo(x, Math.min(y, y0 + s - j)); rv.lineTo(x, Math.min(y, y0 + s - j)); } g.stroke(); rv.stroke(); }
  }
  granulado(g, S, S, 9000 * k * k, 0.12);
  for (let i = 0; i < 70 * k; i++) { g.fillStyle = `rgba(${rnd() < 0.7 ? '50,50,55' : '220,220,215'},${r(0.25, 0.5)})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, r(1.2, 3.2) * k, 0, 6.3); g.fill(); }   // chiclete
  for (let i = 0; i < 6; i++) { const x = rnd() * S, y = rnd() * S, w = r(30, 90) * k, gr = g.createRadialGradient(x, y, 0, x, y, w); gr.addColorStop(0, 'rgba(60,55,50,0.14)'); gr.addColorStop(1, 'rgba(60,55,50,0)'); g.fillStyle = gr; g.fillRect(x - w, y - w, 2 * w, 2 * w); }
  g.fillStyle = 'rgba(40,40,45,0.6)'; rv.fillStyle = '#202020';
  for (let a = 0; a <= n; a++) { g.fillRect(a * s - j / 2, 0, j, S); g.fillRect(0, a * s - j / 2, S, j); rv.fillRect(a * s - j / 2, 0, j, S); rv.fillRect(0, a * s - j / 2, S, j); }
  const t = textura(c, { aniso }); if (cr) t.userData.relevo = textura(cr, { cor: false, aniso }); return t;
}

export function texturaGrama(aniso = 8, { alta = false } = {}) {
  semente = 999;
  const S = alta ? 1024 : 512, k = S / 512, [c, g] = tela(S, S), [cr, rv] = relevo(S, alta);
  g.fillStyle = '#4a7c38'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 14; i++) { const x = rnd() * S, y = rnd() * S, w = r(60, 160) * k, gr = g.createRadialGradient(x, y, 0, x, y, w); gr.addColorStop(0, rnd() < 0.5 ? 'rgba(120,150,60,0.25)' : 'rgba(30,70,30,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - w, y - w, 2 * w, 2 * w); }
  for (let i = 0; i < 11000 * k * k; i++) {
    const v = r(-30, 30), x = rnd() * S, y = rnd() * S, l = r(4, 9) * k;
    g.strokeStyle = `rgba(${70 + v},${130 + v},${52 + v * 0.5},0.6)`; g.lineWidth = r(0.8, 1.6) * k; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r(-2, 2) * k, y - l); g.stroke();
    if (i % 2) { rv.strokeStyle = `rgba(${150 + v * 2},${150 + v * 2},${150 + v * 2},0.6)`; rv.lineWidth = g.lineWidth; rv.beginPath(); rv.moveTo(x, y); rv.lineTo(x, y - l); rv.stroke(); }
  }
  for (let i = 0; i < 40; i++) { const x = rnd() * S, y = rnd() * S; g.fillStyle = 'rgba(70,120,50,0.5)'; for (let f = 0; f < 3; f++) { g.beginPath(); g.arc(x + Math.cos(f * 2.1) * 3 * k, y + Math.sin(f * 2.1) * 3 * k, 3 * k, 0, 6.3); g.fill(); } }   // trevos
  for (let i = 0; i < 260; i++) { g.fillStyle = pick(['#e8d85a', '#f2f2f2', '#e07aa6', '#c9b0e8']); g.beginPath(); g.arc(rnd() * S, rnd() * S, r(1.2, 2.4) * k, 0, 6.3); g.fill(); }
  const t = textura(c, { aniso }); if (cr) t.userData.relevo = textura(cr, { cor: false, aniso }); return t;
}

// Uma célula inteira (CELL × CELL m): asfalto com faixas no eixo das ruas e faixas de pedestre. No PC em 2048 px (27 px por
// metro: as faixas pintadas saem nítidas) e com o relevo à parte: as trilhas dos pneus mais lisas e escuras, a sarjeta de
// concreto junto do meio-fio, remendos, rachaduras, tampas de bueiro e grelhas de boca de lobo, a mancha de óleo no meio
// da faixa e a tinta gasta.
export function texturaAsfalto(aniso = 8, { alta = false } = {}) {
  semente = 31337;
  const S = alta ? 2048 : 1024, k = S / CELL, kp = S / 1024;          // px por metro; e a escala do traço
  const [c, g] = tela(S, S), [cr, rv] = relevo(alta ? 1024 : 8, alta), kr = alta ? 1024 / S : 0;
  const R = (fn) => { if (!cr) return; rv.save(); rv.scale(kr, kr); fn(rv); rv.restore(); };
  g.fillStyle = '#2b2d33'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) { const x = rnd() * S, y = rnd() * S, w = r(4, 14) * k, gr = g.createRadialGradient(x, y, 0, x, y, w); gr.addColorStop(0, rnd() < 0.5 ? 'rgba(80,82,88,0.18)' : 'rgba(10,10,12,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - w, y - w, 2 * w, 2 * w); }
  granulado(g, S, S, 30000 * kp * kp, 0.1);
  const meia = RUA / 2, canto = meia + 1.5;
  // as quatro faixas de rua (cada célula tem meia rua em cada borda): d = distância da borda (o eixo da rua) para dentro
  const faixa = (fn) => { for (let lado = 0; lado < 4; lado++) fn(lado); };
  const emRua = (lado, d0, d1, s0, s1, pinta) => {          // um retângulo na faixa `lado`: d0..d1 da borda, s0..s1 ao longo
    const [x, y, w, h] = lado === 0 ? [s0, d0, s1 - s0, d1 - d0] : lado === 1 ? [s0, CELL - d1, s1 - s0, d1 - d0] : lado === 2 ? [d0, s0, d1 - d0, s1 - s0] : [CELL - d1, s0, d1 - d0, s1 - s0];
    pinta(x * k, y * k, w * k, h * k);
  };
  faixa((lado) => {
    // as trilhas dos pneus (mais escuras e lisas) e o óleo pingado entre elas
    for (const d of [1.6, 4.0]) emRua(lado, d - 0.45, d + 0.45, 0, CELL, (x, y, w, h) => { g.fillStyle = 'rgba(12,12,14,0.16)'; g.fillRect(x, y, w, h); R((b) => { b.fillStyle = 'rgba(160,160,160,0.5)'; b.fillRect(x, y, w, h); }); });
    for (let s = 2; s < CELL - 2; s += r(1.5, 5)) emRua(lado, 2.6, 3.0, s, s + r(0.3, 1.2), (x, y, w, h) => { const gr = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h)); gr.addColorStop(0, 'rgba(5,5,8,0.35)'); gr.addColorStop(1, 'rgba(5,5,8,0)'); g.fillStyle = gr; g.fillRect(x - w, y - h, 3 * w, 3 * h); });
    // a sarjeta de concreto junto do meio-fio (a calçada começa em d = meia)
    emRua(lado, meia - 0.55, meia, 0, CELL, (x, y, w, h) => { g.fillStyle = '#56585c'; g.fillRect(x, y, w, h); R((b) => { b.fillStyle = '#909090'; b.fillRect(x, y, w, h); }); });
    // a boca de lobo perto de cada esquina e a tampa do bueiro na faixa
    for (const s of [meia + 4, CELL - meia - 5]) emRua(lado, meia - 0.5, meia - 0.05, s, s + 1.0, (x, y, w, h) => { g.fillStyle = '#18191b'; g.fillRect(x, y, w, h); g.fillStyle = '#4a4c50'; const n = 7; for (let q = 0; q < n; q++) { if (w > h) g.fillRect(x + (q + 0.3) * w / n, y + h * 0.15, w / n * 0.4, h * 0.7); else g.fillRect(x + w * 0.15, y + (q + 0.3) * h / n, w * 0.7, h / n * 0.4); } R((b) => { b.fillStyle = '#303030'; b.fillRect(x, y, w, h); }); });
    emRua(lado, 2.3, 3.0, CELL * 0.45, CELL * 0.45 + 0.7, (x, y, w, h) => { const cx = x + w / 2, cy = y + h / 2, rr = w / 2;
      g.fillStyle = '#3a3c40'; g.beginPath(); g.arc(cx, cy, rr, 0, 6.3); g.fill(); g.strokeStyle = '#1c1d20'; g.lineWidth = 2 * kp; g.stroke();
      g.strokeStyle = 'rgba(90,92,98,0.9)'; g.lineWidth = 1.2 * kp; for (let q = -3; q <= 3; q++) { g.beginPath(); g.moveTo(cx + q * rr / 4, cy - rr * 0.8); g.lineTo(cx + q * rr / 4, cy + rr * 0.8); g.stroke(); g.beginPath(); g.moveTo(cx - rr * 0.8, cy + q * rr / 4); g.lineTo(cx + rr * 0.8, cy + q * rr / 4); g.stroke(); }
      R((b) => { b.fillStyle = '#c8c8c8'; b.beginPath(); b.arc(cx, cy, rr, 0, 6.3); b.fill(); b.fillStyle = '#a0a0a0'; b.beginPath(); b.arc(cx, cy, rr * 0.85, 0, 6.3); b.fill(); }); });
    // remendos de asfalto novo (mais escuro, com a emenda) e rachaduras
    for (let q = 0; q < 3; q++) { const s = r(meia + 2, CELL - meia - 6), d = r(0.6, meia - 3); emRua(lado, d, d + r(1, 2.6), s, s + r(1.5, 4), (x, y, w, h) => { g.fillStyle = 'rgba(22,23,27,0.85)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(70,72,78,0.6)'; g.lineWidth = 1.5 * kp; g.strokeRect(x, y, w, h); R((b) => { b.strokeStyle = '#404040'; b.lineWidth = 2 * kp; b.strokeRect(x, y, w, h); }); }); }
    for (let q = 0; q < 6; q++) { const s = r(2, CELL - 2), d = r(0.5, meia - 1); emRua(lado, d, d + 0.01, s, s + 0.01, (x, y) => {
      let px = x, py = y; g.strokeStyle = 'rgba(8,8,10,0.75)'; g.lineWidth = r(0.8, 1.8) * kp; g.beginPath(); g.moveTo(px, py); const pts = [[px, py]];
      for (let p = 0; p < 9; p++) { px += r(-18, 18) * kp; py += r(-18, 18) * kp; g.lineTo(px, py); pts.push([px, py]); } g.stroke();
      R((b) => { b.strokeStyle = '#202020'; b.lineWidth = 2 * kp; b.beginPath(); pts.forEach(([a, z], i) => (i ? b.lineTo(a, z) : b.moveTo(a, z))); b.stroke(); }); }); }
  });
  // linha central tracejada amarela nas quatro bordas (cada célula pinta metade), com a tinta gasta
  const tinta = (cor, x, y, w, h) => { g.fillStyle = cor; g.fillRect(x, y, w, h); for (let q = 0; q < w * h / 40; q++) { g.fillStyle = 'rgba(43,45,51,0.55)'; g.fillRect(x + rnd() * w, y + rnd() * h, r(1, 3) * kp, r(1, 3) * kp); } R((b) => { b.fillStyle = '#b4b4b4'; b.fillRect(x, y, w, h); }); };
  for (let m = canto + 2; m < CELL - canto - 2; m += 6) {
    const px = m * k, w = 3.2 * k, t = 0.16 * k;
    tinta('#e6c53a', px, 0, w, t); tinta('#e6c53a', px, S - t, w, t); tinta('#e6c53a', 0, px, t, w); tinta('#e6c53a', S - t, px, t, w);
  }
  // faixas de pedestre antes de cada esquina e a linha de retenção antes delas
  const perto = meia + 1, larg = 3;
  for (const ox of [perto, CELL - perto - larg]) for (let y = 0.4; y < meia - 0.4; y += 0.9) {
    tinta('rgba(240,240,235,0.9)', ox * k, y * k, larg * k, 0.45 * k);                       // rua de cima
    tinta('rgba(240,240,235,0.9)', ox * k, (CELL - y - 0.45) * k, larg * k, 0.45 * k);       // rua de baixo
    tinta('rgba(240,240,235,0.9)', y * k, ox * k, 0.45 * k, larg * k);                       // rua da esquerda
    tinta('rgba(240,240,235,0.9)', (CELL - y - 0.45) * k, ox * k, 0.45 * k, larg * k);       // rua da direita
  }
  for (const ox of [perto + larg + 1.2, CELL - perto - larg - 1.5]) {
    tinta('rgba(240,240,235,0.85)', ox * k, 0.3 * k, 0.3 * k, (meia - 0.9) * k); tinta('rgba(240,240,235,0.85)', ox * k, (CELL - meia + 0.6) * k, 0.3 * k, (meia - 0.9) * k);
    tinta('rgba(240,240,235,0.85)', 0.3 * k, ox * k, (meia - 0.9) * k, 0.3 * k); tinta('rgba(240,240,235,0.85)', (CELL - meia + 0.6) * k, ox * k, (meia - 0.9) * k, 0.3 * k);
  }
  const tx = textura(c, { aniso, repete: false }); if (cr) tx.userData.relevo = textura(cr, { cor: false, aniso, repete: false }); return tx;
}

export function texturaCopa() {
  semente = 55;
  const [c, g] = tela(128, 128);
  g.fillStyle = '#2f6b2f'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { const v = r(-25, 25); g.fillStyle = `rgba(${50 + v},${110 + v},${45 + v * 0.4},0.6)`; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, r(2, 7), 0, 6.3); g.fill(); }
  return textura(c);
}

// ----- térreo comercial: 16 m × 5 m em 1024×320 (cor + emissiva das vitrines e letreiros) -----
const LOJAS = ['MERCADO', 'FARMÁCIA', 'CAFÉ', 'LIVRARIA', 'PADARIA', 'BANCO', 'ÓTICA', 'ACADEMIA', 'PIZZARIA', 'HOTEL', 'FLORES', 'RESTAURANTE', 'CINEMA', 'LAVANDERIA', 'ELETRÔNICOS'];
const LETREIRO = ['#b3202a', '#1f5fa8', '#2a7f4f', '#c78a1a', '#6a2a8a', '#222a36', '#d0d4da'];
export function criarLojas(aniso = 8) {
  const out = [];
  for (let k = 0; k < 3; k++) {
    semente = 5000 + k * 131;
    const W = 1024, H = 320, [c, g] = tela(W, H), [ce, e] = tela(W, H);
    g.fillStyle = pick(['#8d8f94', '#6f7278', '#9a9488']); g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    granulado(g, W, H, 6000, 0.12);
    let x = 0;
    while (x < W - 60) {
      const w = Math.min(W - x, Math.floor(r(150, 250)));
      // pilar
      g.fillStyle = '#5a5d63'; g.fillRect(x, 0, 12, H);
      const cx = x + 12, cw = w - 12;
      // letreiro
      const cor = pick(LETREIRO), nome = pick(LOJAS);
      g.fillStyle = cor; g.fillRect(cx + 6, 22, cw - 12, 52);
      g.fillStyle = '#f4f4f0'; g.font = `bold ${Math.min(34, Math.floor((cw - 30) / nome.length * 1.55))}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(nome, cx + cw / 2, 49);
      e.fillStyle = '#ffffff'; e.globalAlpha = 0.85; e.font = g.font; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillText(nome, cx + cw / 2, 49); e.globalAlpha = 1;
      // toldo
      if (rnd() < 0.6) { const tc = pick(['#b3202a', '#1f5fa8', '#2a7f4f', '#c78a1a']); for (let s = 0; s < cw - 12; s += 16) { g.fillStyle = (s / 16) % 2 ? tc : '#f1efe6'; g.fillRect(cx + 6 + s, 84, 16, 26); } g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 6, 108, cw - 12, 4); }
      // vitrine e porta
      const vy = 118, vh = H - vy - 18, porta = rnd() < 0.7 ? 56 : 0, vw = cw - 12 - porta - 8;
      const gr = g.createLinearGradient(0, vy, 0, vy + vh); gr.addColorStop(0, '#6b8aa3'); gr.addColorStop(1, '#1a2430'); g.fillStyle = gr; g.fillRect(cx + 6, vy, vw, vh);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(cx + 6, vy + vh); g.lineTo(cx + 6 + vw * 0.55, vy); g.lineTo(cx + 6 + vw * 0.7, vy); g.lineTo(cx + 6 + vw * 0.15, vy + vh); g.fill();
      g.strokeStyle = '#2b2f36'; g.lineWidth = 4; g.strokeRect(cx + 6, vy, vw, vh);
      if (rnd() < 0.8) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.45, 0.85); e.fillRect(cx + 10, vy + 4, vw - 8, vh - 8); e.globalAlpha = 1; }
      // prateleiras / manequins sugeridos
      g.fillStyle = 'rgba(0,0,0,0.35)'; for (let s = 0; s < 3; s++) g.fillRect(cx + 14, vy + 26 + s * 34, vw - 16, 3);
      if (porta) { g.fillStyle = '#20262e'; g.fillRect(cx + 6 + vw + 6, vy - 6, porta - 4, vh + 6); g.fillStyle = 'rgba(150,185,215,0.25)'; g.fillRect(cx + 6 + vw + 10, vy - 2, porta - 12, vh * 0.7); g.fillStyle = '#c9ccd2'; g.fillRect(cx + 6 + vw + porta - 8, vy + vh * 0.45, 3, 22); if (rnd() < 0.7) { e.fillStyle = '#ffe2a0'; e.globalAlpha = 0.5; e.fillRect(cx + 6 + vw + 10, vy - 2, porta - 12, vh * 0.7); e.globalAlpha = 1; } }
      x += w;
    }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, H - 14, W, 14);          // rodapé
    out.push({ mapa: textura(c, { aniso }), emissiva: textura(ce, { aniso }) });
  }
  return out;
}
