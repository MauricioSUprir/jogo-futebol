// Texturas procedurais (canvas) da cidade de RELÂMPAGO: fachadas (cor + janelas acesas), asfalto, calçada, grama, telhado.
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

// ----- fachadas: [cor, emissiva] em 512×512 -----
const ESTILOS = [
  function vidro(g, e, S) {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#4d7396'); gr.addColorStop(1, '#1f3550'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const cols = 8, lin = 4, cw = S / cols, ch = S / lin;
    for (let a = 0; a < cols; a++) for (let b = 0; b < lin; b++) {
      const x = a * cw, y = b * ch, ref = g.createLinearGradient(x, y, x + cw, y + ch);
      ref.addColorStop(0, `rgba(190,225,255,${r(0.12, 0.4)})`); ref.addColorStop(1, 'rgba(10,20,40,0.35)');
      g.fillStyle = ref; g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      if (rnd() < 0.42) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.5, 0.95); e.fillRect(x + 4, y + 4, cw - 8, ch - 8); e.globalAlpha = 1; }
    }
    g.strokeStyle = '#121c2b'; g.lineWidth = 3;
    for (let a = 0; a <= cols; a++) { g.beginPath(); g.moveTo(a * cw, 0); g.lineTo(a * cw, S); g.stroke(); }
    for (let b = 0; b <= lin; b++) { g.beginPath(); g.moveTo(0, b * ch); g.lineTo(S, b * ch); g.stroke(); }
  },
  function tijolo(g, e, S) {
    g.fillStyle = '#7a3f31'; g.fillRect(0, 0, S, S);
    for (let y = 0, k = 0; y < S; y += 14, k++) for (let x = -(k % 2) * 16; x < S; x += 32) {
      const t = r(-14, 14); g.fillStyle = `rgb(${138 + t},${68 + t * 0.6},${52 + t * 0.5})`; g.fillRect(x + 1, y + 1, 30, 12);
    }
    const cols = 5, lin = 4, cw = S / cols, ch = S / lin;
    for (let a = 0; a < cols; a++) for (let b = 0; b < lin; b++) {
      const x = a * cw + cw * 0.2, y = b * ch + ch * 0.18, w = cw * 0.6, h = ch * 0.62;
      g.fillStyle = '#d8c9a6'; g.fillRect(x - 5, y - 5, w + 10, h + 12);          // moldura de pedra
      g.fillStyle = '#1b2433'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(160,190,220,0.25)'; g.fillRect(x, y, w, h * 0.4);
      g.fillStyle = '#2a2f3a'; g.fillRect(x + w / 2 - 1.5, y, 3, h); g.fillRect(x, y + h / 2 - 1.5, w, 3);
      if (rnd() < 0.45) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.55, 0.95); e.fillRect(x + 2, y + 2, w - 4, h - 4); e.globalAlpha = 1; }
    }
  },
  function concreto(g, e, S) {
    g.fillStyle = '#9b9da1'; g.fillRect(0, 0, S, S);
    const lin = 4, ch = S / lin;
    for (let b = 0; b < lin; b++) {
      const y = b * ch + ch * 0.28, h = ch * 0.44;
      g.fillStyle = '#18222f'; g.fillRect(0, y, S, h);
      g.fillStyle = 'rgba(140,180,215,0.28)'; g.fillRect(0, y, S, h * 0.45);
      for (let x = 0; x < S; x += 64) {
        g.fillStyle = '#7d8084'; g.fillRect(x, y, 4, h);
        if (rnd() < 0.4) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.5, 0.9); e.fillRect(x + 6, y + 3, 52, h - 6); e.globalAlpha = 1; }
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, b * ch + ch - 6, S, 6);                // laje
    }
  },
  function escritorio(g, e, S) {
    g.fillStyle = pick(['#cbb89a', '#c2b59f', '#d0c4aa']); g.fillRect(0, 0, S, S);
    const cols = 8, lin = 4, cw = S / cols, ch = S / lin;
    for (let a = 0; a < cols; a++) for (let b = 0; b < lin; b++) {
      const x = a * cw + cw * 0.17, y = b * ch + ch * 0.17, w = cw * 0.66, h = ch * 0.62;
      g.fillStyle = '#6a5e4c'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#6f93b3'); gr.addColorStop(1, '#2a3b4f'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = '#6a5e4c'; g.fillRect(x + w / 2 - 1, y, 2, h);
      if (rnd() < 0.45) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.55, 0.95); e.fillRect(x, y, w, h); e.globalAlpha = 1; }
    }
  },
  function residencial(g, e, S) {
    g.fillStyle = pick(['#d9b8a0', '#cfd6b0', '#b9c8d6', '#e0c9b0']); g.fillRect(0, 0, S, S);
    const cols = 4, lin = 4, cw = S / cols, ch = S / lin;
    for (let a = 0; a < cols; a++) for (let b = 0; b < lin; b++) {
      const x = a * cw + cw * 0.22, y = b * ch + ch * 0.12, w = cw * 0.56, h = ch * 0.56;
      g.fillStyle = '#f2ece0'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
      g.fillStyle = '#25303f'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(150,185,215,0.3)'; g.fillRect(x, y, w, h * 0.45);
      g.fillStyle = '#5b6470'; g.fillRect(x - 10, y + h + 6, w + 20, 12);                  // sacada
      g.fillStyle = '#3d4550'; for (let k = 0; k < 8; k++) g.fillRect(x - 8 + k * ((w + 16) / 7), y + h + 6, 2, 12);
      g.fillStyle = pick(['#3d6b4a', '#7a3b3b', '#3b5a7a']); g.fillRect(x - 6, y, 7, h);   // persiana
      if (rnd() < 0.5) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.5, 0.9); e.fillRect(x + 4, y, w - 4, h); e.globalAlpha = 1; }
    }
  },
  function decor(g, e, S) {
    g.fillStyle = '#5b5648'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 64) {
      g.fillStyle = '#7a7261'; g.fillRect(x, 0, 14, S); g.fillStyle = '#403c32'; g.fillRect(x + 14, 0, 3, S);
      const w = 26, jx = x + 22;
      for (let y = 10; y < S; y += 32) {
        g.fillStyle = '#12161d'; g.fillRect(jx, y, w, 20);
        g.fillStyle = 'rgba(140,175,205,0.25)'; g.fillRect(jx, y, w, 8);
        if (rnd() < 0.42) { e.fillStyle = pick(QUENTE); e.globalAlpha = r(0.5, 0.9); e.fillRect(jx + 1, y + 1, w - 2, 18); e.globalAlpha = 1; }
      }
    }
    g.fillStyle = '#c9a24a'; for (let b = 0; b < 4; b++) g.fillRect(0, b * 128 + 124, S, 4);   // friso dourado
  },
];

export function criarFachadas(aniso = 8) {
  const out = [];
  const S = 512;
  for (let k = 0; k < ESTILOS.length; k++) {
    semente = 1000 + k * 77;
    const [c, g] = tela(S, S), [ce, e] = tela(S, S);
    e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
    ESTILOS[k](g, e, S);
    granulado(g, S, S, 5000, 0.09); sujeira(g, S, S);
    out.push({ mapa: textura(c, { aniso }), emissiva: textura(ce, { aniso }) });
  }
  return out;
}

export function texturaTelhado(aniso = 8) {
  semente = 4242;
  const [c, g] = tela(256, 256);
  g.fillStyle = '#6d6f73'; g.fillRect(0, 0, 256, 256);
  granulado(g, 256, 256, 5000, 0.2);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(2, 2, 252, 252);         // platibanda
  g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 6; i++) g.fillRect(r(10, 200), r(10, 200), r(14, 40), r(14, 40));
  return textura(c, { aniso });
}

export function texturaCalcada(aniso = 8) {
  semente = 777;
  const [c, g] = tela(512, 512);
  g.fillStyle = '#a7a9ad'; g.fillRect(0, 0, 512, 512);
  const n = 4, s = 512 / n;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const v = r(-10, 10); g.fillStyle = `rgb(${167 + v},${169 + v},${173 + v})`; g.fillRect(a * s + 2, b * s + 2, s - 4, s - 4); }
  granulado(g, 512, 512, 6000, 0.12);
  g.strokeStyle = 'rgba(40,40,45,0.45)'; g.lineWidth = 3;
  for (let a = 0; a <= n; a++) { g.beginPath(); g.moveTo(a * s, 0); g.lineTo(a * s, 512); g.stroke(); g.beginPath(); g.moveTo(0, a * s); g.lineTo(512, a * s); g.stroke(); }
  return textura(c, { aniso });
}

export function texturaGrama(aniso = 8) {
  semente = 999;
  const [c, g] = tela(512, 512);
  g.fillStyle = '#4c7f3a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = r(-30, 30); g.fillStyle = `rgba(${70 + v},${130 + v},${55 + v * 0.5},0.5)`; g.fillRect(rnd() * 512, rnd() * 512, 2, 4 + rnd() * 4); }
  for (let i = 0; i < 200; i++) { g.fillStyle = pick(['#e8d85a', '#f2f2f2', '#e07aa6']); g.fillRect(rnd() * 512, rnd() * 512, 3, 3); }
  return textura(c, { aniso });
}

// Uma célula inteira (CELL × CELL m): asfalto com faixas no eixo das ruas e faixas de pedestre.
export function texturaAsfalto(aniso = 8) {
  semente = 31337;
  const S = 1024, k = S / CELL;                   // px por metro
  const [c, g] = tela(S, S);
  g.fillStyle = '#2b2d33'; g.fillRect(0, 0, S, S);
  granulado(g, S, S, 30000, 0.1);
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(rnd() * S, rnd() * S, r(20, 120), r(1, 3)); }   // remendos
  const meia = RUA / 2, canto = meia + 1.5;
  // linha central tracejada amarela nas quatro bordas (cada célula pinta metade)
  g.fillStyle = '#e6c53a';
  for (let m = canto + 2; m < CELL - canto - 2; m += 6) {
    const px = m * k, w = 3.2 * k, t = 0.16 * k;
    g.fillRect(px, 0, w, t); g.fillRect(px, S - t, w, t);
    g.fillRect(0, px, t, w); g.fillRect(S - t, px, t, w);
  }
  // faixas de pedestre antes de cada esquina
  g.fillStyle = 'rgba(240,240,235,0.88)';
  const perto = meia + 1, larg = 3;
  for (const ox of [perto, CELL - perto - larg]) for (let y = 0.4; y < meia - 0.4; y += 0.9) {
    g.fillRect(ox * k, y * k, larg * k, 0.45 * k);                       // rua de cima
    g.fillRect(ox * k, (CELL - y - 0.45) * k, larg * k, 0.45 * k);       // rua de baixo
    g.fillRect(y * k, ox * k, 0.45 * k, larg * k);                       // rua da esquerda
    g.fillRect((CELL - y - 0.45) * k, ox * k, 0.45 * k, larg * k);       // rua da direita
  }
  return textura(c, { aniso, repete: false });
}

export function texturaCopa() {
  semente = 55;
  const [c, g] = tela(128, 128);
  g.fillStyle = '#2f6b2f'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { const v = r(-25, 25); g.fillStyle = `rgba(${50 + v},${110 + v},${45 + v * 0.4},0.6)`; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, r(2, 7), 0, 6.3); g.fill(); }
  return textura(c);
}
