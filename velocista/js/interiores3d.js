// O desenho dos INTERIORES dos lugares da cidade (interiores.js é o plano): paredes, piso, teto e luzes, os móveis por tipo
// e os detalhes de cada lugar (o quadro de evidências e o laboratório de perícia do Barry na Delegacia, o balcão e o
// cardápio do Jitters, os telões da redação do Picture News, as fotos e a cozinha da casa dos West). Geometria própria
// juntada por material (uma chamada por material); texturas de canvas feitas uma vez só, e só as do lugar que é montado.
// THREE passado por parâmetro. O grupo só aparece com o herói lá dentro (interiores3d não decide isso: o jogo liga
// grupo.visible).
// Visual (dono, 30/10: "melhore MUITO a qualidade dos lugares da cidade que eu posso entrar ... ta estranho"): texturas de
// 1024 px no PC com RELEVO (bumpMap: rejunte, tábuas, tijolos, lambri), paredes que repetem sem faixas (o lambri, o rodapé
// e a sanca são peças em cada face, sem passar por cima das portas), sombra de contato no pé das paredes e debaixo dos
// móveis, poças de luz debaixo das lâmpadas, JANELAS com a rua lá fora (de dia e de noite; persiana nos escritórios,
// cortina na casa, vitrine no café) e mais objetos (placas, relógio, plantas, banco de espera, armários do laboratório).
import { INTERIORES, Y0, PE, PORTA_H, paredesDoInterior } from './interiores.js';

const PI = Math.PI;
const cacheTex = new Map(), cacheMat = new Map();
const OPC = { alta: true, aniso: 4 };
function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
// um contexto que não faz nada (o relevo no celular): qualquer chamada ou propriedade devolve ele mesmo
const NADA = new Proxy(function () {}, { get: () => NADA, set: () => true, apply: () => NADA });
let sem = 7; const rnd = () => { sem = (sem * 1664525 + 1013904223) >>> 0; return sem / 4294967296; };
const semear = (s) => { sem = 7; for (const ch of s) sem = (sem * 31 + ch.charCodeAt(0)) >>> 0; };
const texto = (g, s, x, y, px, cor, peso = 'bold', alinha = 'left') => { g.fillStyle = cor; g.font = `${peso} ${px}px Arial, Helvetica, sans-serif`; g.textAlign = alinha; g.textBaseline = 'middle'; g.fillText(s, x, y); };
const ruido = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } };
// mancha macia que dá a volta nas bordas (a textura continua repetindo sem emenda)
function mancha(g, w, h, x, y, r, cor) {
  for (const dx of [0, -w, w]) for (const dy of [0, -h, h]) {
    const cx = x + dx, cy = y + dy; if (cx < -r || cx > w + r || cy < -r || cy > h + r) continue;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, cor); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}
const manchas = (g, w, h, n, rMax, claro, escuro) => { for (let i = 0; i < n; i++) mancha(g, w, h, rnd() * w, rnd() * h, rMax * (0.3 + rnd() * 0.7), rnd() < 0.5 ? claro : escuro); };
const varia = (rgb, d) => rgb.map((c) => Math.max(0, Math.min(255, Math.round(c + (rnd() - 0.5) * 2 * d))));
const variaTom = (rgb, d) => { const k = (rnd() - 0.5) * 2 * d; return rgb.map((c) => Math.max(0, Math.min(255, Math.round(c + k)))); };   // (o mesmo desvio nos três canais: sem ladrilho rosado ou esverdeado)
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---------- as texturas (pintor por nome: cor e, no PC, o relevo no mesmo desenho) ----------
// cada pintor recebe (g, b, w, h): g é a cor, b o relevo (cinza 128 = plano; claro sobe, escuro afunda)
const PINTORES = {
  // paredes (2 m por repetição): repetem nas duas direções sem faixas
  parede_delegacia: { relevo: 0.6, pinta(g, b, w, h) {
    g.fillStyle = '#a7b3be'; g.fillRect(0, 0, w, h); manchas(g, w, h, 160, w * 0.09, 'rgba(255,255,255,0.05)', 'rgba(30,40,55,0.05)'); ruido(g, w, h, w * 9, 0.05);
    ruido(b, w, h, w * 14, 0.12); } },
  parede_lab: { relevo: 1.2, pinta(g, b, w, h) {
    const n = 16, t = w / n, j = Math.max(2, w / 340);
    g.fillStyle = '#b6c0c8'; g.fillRect(0, 0, w, h); b.fillStyle = '#3a3a3a'; b.fillRect(0, 0, w, h);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = variaTom([238, 243, 246], 4), gr = g.createLinearGradient(x * t, y * t, x * t + t, y * t + t);
      gr.addColorStop(0, rgb(c.map((k) => Math.min(255, k + 8)))); gr.addColorStop(1, rgb(c.map((k) => k - 6))); g.fillStyle = gr; g.fillRect(x * t + j / 2, y * t + j / 2, t - j, t - j);
      b.fillStyle = '#9a9a9a'; b.fillRect(x * t + j / 2, y * t + j / 2, t - j, t - j); b.fillStyle = '#b0b0b0'; b.fillRect(x * t + j, y * t + j, t - j * 2, t - j * 2);
    } } },
  parede_cafe: { relevo: 1.6, pinta(g, b, w, h) {
    const col = 8, lin = 26, bw = w / col, bh = h / lin, m = Math.max(2, w / 300);
    g.fillStyle = '#b5a693'; g.fillRect(0, 0, w, h); ruido(g, w, h, w * 4, 0.12); b.fillStyle = '#404040'; b.fillRect(0, 0, w, h);
    const cores = []; for (let r = 0; r < lin; r++) { cores.push([]); for (let c = 0; c < col; c++) { const q = rnd(); cores[r].push(q < 0.12 ? varia([92, 46, 34], 10) : q < 0.2 ? varia([170, 98, 70], 10) : varia([142, 70, 50], 16)); } }
    for (let r = 0; r < lin; r++) { const of = (r % 2) * bw / 2; for (let c = -1; c <= col; c++) {
      const x = c * bw + of, y = r * bh, cor = cores[r][((c % col) + col) % col];
      g.fillStyle = rgb(cor); g.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
      const gr = g.createLinearGradient(0, y, 0, y + bh); gr.addColorStop(0, 'rgba(255,230,210,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)'); g.fillStyle = gr; g.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
      for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '40,20,15' : '230,190,160'},${0.15 * rnd()})`; g.fillRect(x + m + rnd() * (bw - m * 2), y + m + rnd() * (bh - m * 2), 1 + rnd() * 3, 1 + rnd() * 2); }
      b.fillStyle = '#a8a8a8'; b.fillRect(x + m / 2, y + m / 2, bw - m, bh - m); b.fillStyle = '#b8b8b8'; b.fillRect(x + m, y + m, bw - m * 2, bh - m * 2);
    } }
    manchas(g, w, h, 30, w * 0.12, 'rgba(255,240,220,0.04)', 'rgba(20,10,5,0.08)'); } },
  parede_jornal: { relevo: 0.5, pinta(g, b, w, h) {
    g.fillStyle = '#d6d9dc'; g.fillRect(0, 0, w, h); manchas(g, w, h, 140, w * 0.08, 'rgba(255,255,255,0.06)', 'rgba(40,45,55,0.04)'); ruido(g, w, h, w * 8, 0.04); ruido(b, w, h, w * 12, 0.1); } },
  parede_casa: { relevo: 0.7, pinta(g, b, w, h) {
    g.fillStyle = '#ebdfc4'; g.fillRect(0, 0, w, h); manchas(g, w, h, 60, w * 0.1, 'rgba(255,250,235,0.05)', 'rgba(120,90,50,0.04)');
    const p = w / 8;
    for (let k = 0; k < 8; k++) { const x = k * p; g.fillStyle = 'rgba(176,146,98,0.22)'; g.fillRect(x + p * 0.08, 0, p * 0.04, h); g.fillRect(x + p * 0.88, 0, p * 0.04, h); b.fillStyle = '#9a9a9a'; b.fillRect(x + p * 0.08, 0, p * 0.04, h); b.fillRect(x + p * 0.88, 0, p * 0.04, h);
      for (let y = 0; y < 8; y++) { const cx = x + p / 2, cy = (y + 0.5) * (h / 8) + (k % 2) * (h / 16);
        g.fillStyle = 'rgba(160,112,72,0.28)'; for (let a = 0; a < 4; a++) { g.beginPath(); g.ellipse(cx + Math.cos(a * PI / 2) * p * 0.09, cy + Math.sin(a * PI / 2) * p * 0.09, p * 0.07, p * 0.04, a * PI / 2, 0, 6.3); g.fill(); }
        g.fillStyle = 'rgba(110,130,90,0.35)'; g.beginPath(); g.arc(cx, cy, p * 0.03, 0, 6.3); g.fill(); b.fillStyle = '#a0a0a0'; b.beginPath(); b.arc(cx, cy, p * 0.12, 0, 6.3); b.fill(); } }
    ruido(g, w, h, w * 4, 0.04); } },
  // lambri (1 m por repetição: a placa inteira na altura)
  lambri_delegacia: { relevo: 2, pinta: (g, b, w, h) => lambriPainel(g, b, w, h, [56, 72, 88]) },
  lambri_cafe: { relevo: 2, pinta: (g, b, w, h) => lambriPainel(g, b, w, h, [74, 44, 28], true) },
  lambri_casa: { relevo: 1.6, pinta(g, b, w, h) {
    g.fillStyle = '#efebe1'; g.fillRect(0, 0, w, h); b.fillStyle = '#b0b0b0'; b.fillRect(0, 0, w, h);
    for (let k = 0; k < 10; k++) { const x = k * w / 10; g.fillStyle = 'rgba(90,80,60,0.28)'; g.fillRect(x, h * 0.12, w / 160, h); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + w / 160, h * 0.12, w / 260, h); b.fillStyle = '#404040'; b.fillRect(x, h * 0.12, w / 140, h); }
    g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, w, h * 0.1); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h * 0.1, w, h * 0.02); b.fillStyle = '#e0e0e0'; b.fillRect(0, 0, w, h * 0.1); ruido(g, w, h, w * 3, 0.03); } },
  // pisos (3 m por repetição)
  piso_granito: { relevo: 1.4, pinta(g, b, w, h) {
    const n = 5, t = w / n, j = Math.max(2, w / 340);
    g.fillStyle = '#6f6b66'; g.fillRect(0, 0, w, h); b.fillStyle = '#404040'; b.fillRect(0, 0, w, h);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const x0 = x * t + j / 2, y0 = y * t + j / 2, s = t - j, c = variaTom([152, 147, 140], 9);
      g.fillStyle = rgb(c); g.fillRect(x0, y0, s, s); b.fillStyle = '#a0a0a0'; b.fillRect(x0, y0, s, s);
      g.save(); g.beginPath(); g.rect(x0, y0, s, s); g.clip();
      for (let k = 0; k < t * t / 70; k++) { const q = rnd(); g.fillStyle = q < 0.5 ? `rgba(92,88,84,${0.12 + rnd() * 0.22})` : q < 0.92 ? `rgba(210,206,198,${0.1 + rnd() * 0.22})` : `rgba(140,110,96,${0.1 + rnd() * 0.15})`; const r = (0.4 + rnd() * 1.2) * w / 1024; g.beginPath(); g.arc(x0 + rnd() * s, y0 + rnd() * s, r * 1.3, 0, 6.3); g.fill(); }
      for (let k = 0; k < 2; k++) { g.strokeStyle = `rgba(235,232,226,${0.1 + rnd() * 0.12})`; g.lineWidth = (1 + rnd() * 2) * w / 1024; g.beginPath(); g.moveTo(x0 + rnd() * s, y0); g.quadraticCurveTo(x0 + rnd() * s, y0 + rnd() * s, x0 + rnd() * s, y0 + s); g.stroke(); }
      const gr = g.createLinearGradient(x0, y0, x0 + s, y0 + s); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.05)'); g.fillStyle = gr; g.fillRect(x0, y0, s, s);
      g.restore();
    } } },
  piso_madeira: { relevo: 1.5, pinta(g, b, w, h) {
    const lin = 20, lh = h / lin; g.fillStyle = '#3b2616'; g.fillRect(0, 0, w, h); b.fillStyle = '#404040'; b.fillRect(0, 0, w, h);
    for (let r = 0; r < lin; r++) {
      const cortes = []; let x = rnd() * w * 0.3; while (x < w) { cortes.push(x); x += w * (0.27 + rnd() * 0.36); }
      for (let k = 0; k < cortes.length; k++) {
        const a = cortes[k], z = k + 1 < cortes.length ? cortes[k + 1] : cortes[0] + w, y = r * lh, c = variaTom([150, 102, 64], 18);
        for (const dx of [0, -w]) {
          const xa = a + dx, xz = z + dx; if (xz < 0 || xa > w) continue;
          g.fillStyle = rgb(c); g.fillRect(xa + 1, y + 1, xz - xa - 2, lh - 2); b.fillStyle = '#a8a8a8'; b.fillRect(xa + 1.5, y + 1.5, xz - xa - 3, lh - 3);
          for (let f = 0; f < 11; f++) { const yy = y + 2 + rnd() * (lh - 4), amp = rnd() * lh * 0.12, fase = rnd() * 6; g.strokeStyle = `rgba(${rnd() < 0.7 ? '70,40,20' : '200,150,100'},${0.08 + rnd() * 0.14})`; g.lineWidth = (0.6 + rnd()) * w / 1024; g.beginPath(); for (let s = 0; s <= 20; s++) { const px = xa + (xz - xa) * s / 20, py = yy + Math.sin(fase + s * 0.7) * amp; if (s) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
          if (rnd() < 0.18) { const kx = xa + (xz - xa) * (0.2 + rnd() * 0.6), ky = y + lh / 2; for (let k2 = 3; k2 >= 1; k2--) { g.fillStyle = `rgba(60,34,16,${0.12 * k2})`; g.beginPath(); g.ellipse(kx, ky, lh * 0.18 * k2, lh * 0.09 * k2, 0, 0, 6.3); g.fill(); } }
          const gr = g.createLinearGradient(0, y, 0, y + lh); gr.addColorStop(0, 'rgba(255,230,190,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)'); g.fillStyle = gr; g.fillRect(xa + 1, y + 1, xz - xa - 2, lh - 2);
        }
      }
    } } },
  piso_carpete: { relevo: 0.8, pinta(g, b, w, h) {
    const n = 6, t = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = variaTom([66, 80, 100], 5), hor = (x + y) % 2 === 0; g.fillStyle = rgb(c); g.fillRect(x * t, y * t, t, t);
      for (let k = 0; k < t; k += Math.max(2, w / 400)) { g.fillStyle = `rgba(${k % 4 < 2 ? '255,255,255' : '0,0,0'},0.05)`; if (hor) g.fillRect(x * t, y * t + k, t, 1); else g.fillRect(x * t + k, y * t, 1, t); }
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x * t, y * t, t, 1); g.fillRect(x * t, y * t, 1, t);
    }
    ruido(g, w, h, w * 30, 0.12); ruido(b, w, h, w * 40, 0.3); } },
  piso_lab: { relevo: 0.8, pinta(g, b, w, h) {
    g.fillStyle = '#d4dadf'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < w * 6; k++) { const q = rnd(); g.fillStyle = q < 0.5 ? 'rgba(120,130,140,0.35)' : q < 0.8 ? 'rgba(255,255,255,0.5)' : 'rgba(70,110,150,0.35)'; g.fillRect(rnd() * w, rnd() * h, (1 + rnd() * 2.5) * w / 1024, (1 + rnd() * 2.5) * w / 1024); }
    g.fillStyle = 'rgba(80,90,100,0.35)'; b.fillStyle = '#404040'; for (let k = 0; k <= 4; k++) { g.fillRect(k * w / 4, 0, w / 700 + 1, h); g.fillRect(0, k * h / 4, w, w / 700 + 1); b.fillRect(k * w / 4, 0, w / 500 + 1, h); b.fillRect(0, k * h / 4, w, w / 500 + 1); } } },
  piso_cozinha: { relevo: 1.4, pinta(g, b, w, h) {
    const n = 10, t = w / n, j = Math.max(2, w / 300); g.fillStyle = '#9a958a'; g.fillRect(0, 0, w, h); b.fillStyle = '#404040'; b.fillRect(0, 0, w, h);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = rgb(variaTom((x + y) % 2 ? [74, 88, 102] : [234, 226, 208], 6)); g.fillRect(x * t + j / 2, y * t + j / 2, t - j, t - j); b.fillStyle = '#a8a8a8'; b.fillRect(x * t + j / 2, y * t + j / 2, t - j, t - j); }
    ruido(g, w, h, w * 6, 0.06); } },
  // tetos
  teto_placas: { relevo: 1.2, pinta(g, b, w, h) {
    const n = 6, t = w / n, gl = Math.max(3, w / 220);
    g.fillStyle = '#e3e5e4'; g.fillRect(0, 0, w, h); b.fillStyle = '#909090'; b.fillRect(0, 0, w, h);
    for (let k = 0; k < w * 10; k++) { g.fillStyle = `rgba(110,110,100,${0.08 + rnd() * 0.2})`; const x = rnd() * w, y = rnd() * h, l = (1 + rnd() * 4) * w / 1024; g.fillRect(x, y, l, w / 1024 + 0.5); b.fillStyle = '#606060'; b.fillRect(x, y, l, w / 1024 + 0.5); }
    for (let k = 0; k <= n; k++) { g.fillStyle = '#f6f6f4'; g.fillRect(k * t - gl / 2, 0, gl, h); g.fillRect(0, k * t - gl / 2, w, gl); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(k * t + gl / 2, 0, gl / 2, h); g.fillRect(0, k * t + gl / 2, w, gl / 2); b.fillStyle = '#d8d8d8'; b.fillRect(k * t - gl / 2, 0, gl, h); b.fillRect(0, k * t - gl / 2, w, gl); } } },
  teto_liso: { relevo: 0.4, pinta(g, b, w, h) { g.fillStyle = '#ece8df'; g.fillRect(0, 0, w, h); manchas(g, w, h, 80, w * 0.1, 'rgba(255,255,255,0.05)', 'rgba(80,70,50,0.04)'); ruido(g, w, h, w * 4, 0.03); ruido(b, w, h, w * 10, 0.1); } },
  teto_cafe: { relevo: 0.6, pinta(g, b, w, h) { g.fillStyle = '#2c2723'; g.fillRect(0, 0, w, h); manchas(g, w, h, 60, w * 0.1, 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.1)'); ruido(g, w, h, w * 8, 0.06); ruido(b, w, h, w * 10, 0.2); } },
};
function lambriPainel(g, b, w, h, cor, veio = false) {
  g.fillStyle = rgb(cor); g.fillRect(0, 0, w, h); b.fillStyle = '#909090'; b.fillRect(0, 0, w, h);
  if (veio) for (let k = 0; k < 90; k++) { const y = rnd() * h; g.strokeStyle = `rgba(20,10,5,${0.08 + rnd() * 0.12})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 20, w * 0.6, y + (rnd() - 0.5) * 20, w, y); g.stroke(); }
  // a régua de cima (o lambri termina com um friso) e a placa almofadada no meio
  g.fillStyle = rgb(cor.map((c) => c + 16)); g.fillRect(0, 0, w, h * 0.09); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h * 0.09, w, h * 0.015);
  b.fillStyle = '#e0e0e0'; b.fillRect(0, 0, w, h * 0.09);
  const x0 = w * 0.1, x1 = w * 0.9, y0 = h * 0.2, y1 = h * 0.88, e = w * 0.03;
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(x0, y0, x1 - x0, e); g.fillRect(x0, y0, e, y1 - y0);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0, y1 - e, x1 - x0, e); g.fillRect(x1 - e, y0, e, y1 - y0);
  g.fillStyle = rgb(cor.map((c) => c + 8)); g.fillRect(x0 + e, y0 + e, x1 - x0 - 2 * e, y1 - y0 - 2 * e);
  b.fillStyle = '#5a5a5a'; b.fillRect(x0, y0, x1 - x0, y1 - y0); b.fillStyle = '#b8b8b8'; b.fillRect(x0 + e, y0 + e, x1 - x0 - 2 * e, y1 - y0 - 2 * e);
  ruido(g, w, h, w * 4, 0.05);
}
function texturaPintada(THREE, k) {
  if (cacheTex.has(k)) return cacheTex.get(k);
  const P = PINTORES[k], S = OPC.alta ? 1024 : 512; semear(k);
  const [c, g] = tela(S, S); let bc = null, b = NADA;
  if (OPC.alta && P.relevo) { [bc, b] = tela(S, S); b.fillStyle = '#808080'; b.fillRect(0, 0, S, S); }
  P.pinta(g, b, S, S);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = OPC.aniso; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  let bump = null; if (bc) { bump = new THREE.CanvasTexture(bc); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.anisotropy = OPC.aniso; }
  const r = { map, bump, relevo: P.relevo }; cacheTex.set(k, r); return r;
}
function textura(THREE, chave, w, h, pinta, repete = false) {
  if (cacheTex.has(chave)) return cacheTex.get(chave);
  semear(chave); const [c, g] = tela(w, h); pinta(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = OPC.aniso;
  if (repete) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cacheTex.set(chave, t); return t;
}

// ---------- os detalhes (quadros, telas, a vista da rua) ----------
const DETALHES = {
  quadro: [1024, 512, (g, w, h) => {
    g.fillStyle = '#a77b4f'; g.fillRect(0, 0, w, h); ruido(g, w, h, 9000, 0.15);
    g.strokeStyle = '#5a3c22'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18);
    const fotos = []; for (let i = 0; i < 9; i++) { const x = 60 + (i % 5) * 190 + rnd() * 30, y = 50 + Math.floor(i / 5) * 230 + rnd() * 30; fotos.push([x + 60, y + 70]); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 6, y + 6, 120, 150); g.fillStyle = '#f1f1ee'; g.fillRect(x, y, 120, 150); g.fillStyle = ['#2b3442', '#5a4a3a', '#33433a'][i % 3]; g.fillRect(x + 8, y + 8, 104, 104); g.fillStyle = '#d9c9b0'; g.beginPath(); g.arc(x + 60, y + 50, 22, 0, 6.3); g.fill(); g.fillRect(x + 32, y + 72, 56, 40); texto(g, ['SUSPEITO', 'AMARELO?', 'NÚCLEO', 'TESTEMUNHA', '?', 'RAIO', 'FRIO', 'ZOOM', 'S.T.A.R.'][i], x + 60, y + 132, 15, '#111', 'bold', 'center'); g.fillStyle = '#d22'; g.beginPath(); g.arc(x + 60, y + 6, 6, 0, 6.3); g.fill(); }
    g.strokeStyle = '#d61f1f'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = fotos[i], b = fotos[(i * 3 + 2) % 9]; g.beginPath(); g.moveTo(a[0], a[1] - 60); g.lineTo(b[0], b[1] - 60); g.stroke(); }
    for (let i = 0; i < 6; i++) { const x = 80 + rnd() * 860, y = 40 + rnd() * 420; g.save(); g.translate(x, y); g.rotate((rnd() - 0.5) * 0.3); g.fillStyle = '#f4ec9c'; g.fillRect(-30, -24, 60, 48); texto(g, ['11 s', '?!', 'onde?', 'raio', '2000', 'quem'][i], 0, 0, 16, '#333', 'bold', 'center'); g.restore(); }
  }],
  lousa: [1024, 512, (g, w, h) => { g.fillStyle = '#f7f8f8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9aa'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    const linhas = ['E = ½ m v²', 'v ≈ 230 m/s ?!', 'raio + química = ?', 'Núcleo Aurora: 11 s', 'amostra 07: positiva', 'ACIDENTE NÃO FOI ACIDENTE']; linhas.forEach((s, i) => texto(g, s, 40, 60 + i * 72, 40, i === 5 ? '#c41e1e' : '#1d3d8f', 'bold')); g.strokeStyle = '#1d3d8f'; g.lineWidth = 4; g.beginPath(); g.ellipse(760, 330, 150, 90, 0, 0, 6.3); g.stroke(); }],
  menu: [1024, 512, (g, w, h) => { g.fillStyle = '#1b1d1c'; g.fillRect(0, 0, w, h); ruido(g, w, h, 8000, 0.1); g.strokeStyle = '#6a4a2a'; g.lineWidth = 22; g.strokeRect(11, 11, w - 22, h - 22); texto(g, 'JITTERS', w / 2, 70, 76, '#f3e6c4', 'bold', 'center');
    [['Café coado', '6'], ['Expresso duplo', '8'], ['Cappuccino', '10'], ['O Relâmpago (6 doses)', '15'], ['Chocolate quente', '9'], ['Pão de queijo', '5']].forEach(([a, b], i) => { texto(g, a, 90, 170 + i * 52, 34, '#f0f0f0', '600'); texto(g, b, w - 90, 170 + i * 52, 34, '#ffd27a', 'bold', 'right'); }); }],
  noticias: [1024, 576, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d2e4f'); gr.addColorStop(1, '#0b1222'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c41e1e'; g.fillRect(0, h - 150, w, 70); texto(g, 'BORRÃO VERMELHO SALVA MAIS UM', 30, h - 115, 46, '#fff', 'bold'); g.fillStyle = '#ffffff'; g.fillRect(0, h - 80, w, 50); texto(g, 'PICTURE NEWS · AO VIVO · CENTRAL CITY', 30, h - 55, 30, '#111', 'bold');
    g.fillStyle = 'rgba(255,60,60,0.85)'; g.beginPath(); g.moveTo(520, 140); g.lineTo(470, 260); g.lineTo(520, 250); g.lineTo(480, 380); g.lineTo(600, 220); g.lineTo(545, 230); g.lineTo(590, 140); g.closePath(); g.fill(); }],
  fotos: [1024, 256, (g, w, h) => { g.clearRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) { const x = 20 + i * 200; g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 6, 36, 170, 200); g.fillStyle = '#4a3420'; g.fillRect(x, 30, 170, 200); g.fillStyle = '#f2ede2'; g.fillRect(x + 8, 38, 154, 184); g.fillStyle = ['#7aa0c8', '#c89a7a', '#8fb58a', '#c8b07a', '#9a8ac8'][i]; g.fillRect(x + 18, 48, 134, 164);
      for (let k = 0; k < (i % 3) + 1; k++) { const px = x + 50 + k * 36; g.fillStyle = '#4a3a30'; g.beginPath(); g.arc(px, 110, 14, 0, 6.3); g.fill(); g.fillRect(px - 15, 126, 30, 70); } } }],
  computador: [256, 160, (g, w, h) => { g.fillStyle = '#0d2236'; g.fillRect(0, 0, w, h); g.fillStyle = '#3fa8e0'; g.fillRect(0, 0, w, 18); for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(180,220,255,${0.4 + rnd() * 0.5})`; g.fillRect(14, 30 + i * 20, 60 + rnd() * 150, 8); } }],
  placa_delegacia: [1024, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c3b4c'); gr.addColorStop(1, '#1a2430'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a24e'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    texto(g, 'DELEGACIA CENTRAL', w / 2, h * 0.42, 92, '#e6c46c', 'bold', 'center'); texto(g, 'POLÍCIA DE CENTRAL CITY · ATENDIMENTO', w / 2, h * 0.76, 34, '#cfd6de', '600', 'center'); }],
  placa_jornal: [1024, 256, (g, w, h) => { g.clearRect(0, 0, w, h); texto(g, 'PICTURE NEWS', w / 2, h * 0.45, 150, '#c42b2b', 'bold', 'center'); g.fillStyle = '#1b1b1b'; g.fillRect(w * 0.12, h * 0.82, w * 0.76, 10); }],
  placa_lab: [512, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f7fd0'; g.fillRect(0, 0, 26, h); texto(g, 'PERÍCIA · LABORATÓRIO', 44, h / 2, 44, '#183a5e', 'bold'); }],
  relogio: [256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(128, 128, 126, 0, 6.3); g.fill(); g.fillStyle = '#f5f3ee'; g.beginPath(); g.arc(128, 128, 112, 0, 6.3); g.fill();
    g.fillStyle = '#222'; for (let k = 0; k < 12; k++) { g.save(); g.translate(128, 128); g.rotate(k * PI / 6); g.fillRect(-3, -104, 6, k % 3 ? 12 : 22); g.restore(); }
    g.strokeStyle = '#111'; g.lineCap = 'round'; g.lineWidth = 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 50 * Math.cos(-1.1), 128 + 50 * Math.sin(-1.1)); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 84 * Math.cos(-2.6), 128 + 84 * Math.sin(-2.6)); g.stroke();
    g.strokeStyle = '#c41e1e'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 92 * Math.cos(0.7), 128 + 92 * Math.sin(0.7)); g.stroke(); }],
  cartaz: [512, 384, (g, w, h) => { g.fillStyle = '#b48a5a'; g.fillRect(0, 0, w, h); ruido(g, w, h, 5000, 0.18); g.strokeStyle = '#4a3420'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    for (let i = 0; i < 9; i++) { const x = 30 + (i % 3) * 155 + rnd() * 20, y = 30 + Math.floor(i / 3) * 112 + rnd() * 12; g.save(); g.translate(x + 60, y + 45); g.rotate((rnd() - 0.5) * 0.2); g.fillStyle = ['#f6f4ee', '#fff7c2', '#e3f0ff'][i % 3]; g.fillRect(-60, -42, 120, 84); for (let l = 0; l < 5; l++) { g.fillStyle = 'rgba(40,40,60,0.5)'; g.fillRect(-48, -28 + l * 13, 70 + rnd() * 26, 4); } g.fillStyle = '#d22'; g.beginPath(); g.arc(0, -38, 5, 0, 6.3); g.fill(); g.restore(); } }],
  tapete: [512, 512, (g, w, h) => { g.fillStyle = '#7a2e2a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b46a'; g.lineWidth = 14; g.strokeRect(24, 24, w - 48, h - 48); g.lineWidth = 4; g.strokeRect(52, 52, w - 104, h - 104);
    g.fillStyle = '#2f3f5a'; for (let k = 0; k < 4; k++) { g.save(); g.translate(w / 2, h / 2); g.rotate(k * PI / 2); g.beginPath(); g.moveTo(0, -150); g.lineTo(60, -40); g.lineTo(0, 0); g.lineTo(-60, -40); g.closePath(); g.fill(); g.restore(); } g.fillStyle = '#d9b46a'; g.beginPath(); g.arc(w / 2, h / 2, 34, 0, 6.3); g.fill(); ruido(g, w, h, 20000, 0.14); }],
  persiana: [256, 512, (g, w, h) => { g.clearRect(0, 0, w, h); const n = 36, p = h / n; for (let k = 0; k < n; k++) { const y = k * p, gr = g.createLinearGradient(0, y, 0, y + p * 0.62); gr.addColorStop(0, 'rgba(236,233,226,0.97)'); gr.addColorStop(1, 'rgba(176,172,164,0.97)'); g.fillStyle = gr; g.fillRect(0, y, w, p * 0.62); }
    g.fillStyle = 'rgba(200,196,188,0.95)'; g.fillRect(w * 0.3, 0, 3, h); g.fillRect(w * 0.7, 0, 3, h); }],
  luz_painel: [256, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,205,215,0.6)'; g.lineWidth = 1; for (let k = 0; k < w; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke(); } for (let k = 0; k < h; k += 8) { g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); } g.strokeStyle = '#c9ccd2'; g.lineWidth = 10; g.strokeRect(0, 0, w, h); }],
  poca: [256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,240,215,1)'); gr.addColorStop(0.45, 'rgba(255,232,200,0.45)'); gr.addColorStop(1, 'rgba(255,225,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }],
  sombra_base: [16, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }],
  sombra_movel: [128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); for (let k = 0; k < 14; k++) { const e = 4 + k * 3; g.fillStyle = 'rgba(0,0,0,0.055)'; g.beginPath(); if (g.roundRect) g.roundRect(e, e, w - 2 * e, h - 2 * e, 20 - k); else g.rect(e, e, w - 2 * e, h - 2 * e); g.fill(); } }],
};
// a rua lá fora, vista pela janela (de dia e de noite): a calçada, o asfalto e os prédios do outro lado
function pintaVista(g, w, h, noite) {
  const ceu = g.createLinearGradient(0, 0, 0, h * 0.7);
  ceu.addColorStop(0, noite ? '#08101f' : '#7fb0e4'); ceu.addColorStop(1, noite ? '#1d2a44' : '#dde9f3'); g.fillStyle = ceu; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w;) { const bw = w * (0.05 + rnd() * 0.08), bh = h * (0.25 + rnd() * 0.3); g.fillStyle = noite ? '#111a2a' : '#a8b8c8'; g.fillRect(x, h * 0.72 - bh, bw, bh);
    if (noite) for (let y = h * 0.72 - bh + 6; y < h * 0.7; y += 9) for (let xx = x + 4; xx < x + bw - 4; xx += 8) if (rnd() < 0.3) { g.fillStyle = 'rgba(255,210,140,0.7)'; g.fillRect(xx, y, 4, 4); }
    x += bw + 2; }
  for (let x = -20; x < w;) { const bw = w * (0.14 + rnd() * 0.12), bh = h * (0.45 + rnd() * 0.4), c = noite ? varia([24, 28, 38], 6) : varia(rnd() < 0.5 ? [190, 168, 140] : [140, 152, 166], 14);
    g.fillStyle = rgb(c); g.fillRect(x, h * 0.74 - bh, bw, bh);
    const jw = bw / 7, jh = h * 0.05;
    for (let y = h * 0.74 - bh + jh * 0.6; y < h * 0.68; y += jh * 1.6) for (let k = 0; k < 5; k++) { const lit = noite && rnd() < 0.45; g.fillStyle = lit ? 'rgba(255,214,150,0.95)' : noite ? 'rgba(10,14,22,0.9)' : `rgba(${rnd() < 0.3 ? '200,220,240' : '70,90,110'},0.9)`; g.fillRect(x + jw * (0.6 + k * 1.25), y, jw * 0.8, jh); }
    x += bw + w * 0.01; }
  g.fillStyle = noite ? '#2a2a2c' : '#8e8a84'; g.fillRect(0, h * 0.74, w, h * 0.05);              // a calçada do outro lado
  g.fillStyle = noite ? '#1a1b1e' : '#45474b'; g.fillRect(0, h * 0.79, w, h * 0.13);              // o asfalto
  g.fillStyle = noite ? 'rgba(240,220,160,0.6)' : 'rgba(240,240,230,0.9)'; for (let x = 0; x < w; x += w / 8) g.fillRect(x, h * 0.85, w / 16, h * 0.008);
  g.fillStyle = noite ? '#3a3a3c' : '#a9a49b'; g.fillRect(0, h * 0.92, w, h * 0.08);              // a calçada de cá
  for (let k = 0; k < 3; k++) { const x = w * (0.15 + k * 0.33 + rnd() * 0.08); g.fillStyle = noite ? '#0d1410' : '#3f6a3a'; for (let f = 0; f < 6; f++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * w * 0.06, h * (0.52 + rnd() * 0.08), w * 0.035, 0, 6.3); g.fill(); } g.fillStyle = noite ? '#141414' : '#4a3626'; g.fillRect(x - 3, h * 0.58, 6, h * 0.34); }
  if (noite) for (let k = 0; k < 3; k++) { const x = w * (0.3 + k * 0.33); const gr = g.createRadialGradient(x, h * 0.46, 0, x, h * 0.46, w * 0.12); gr.addColorStop(0, 'rgba(255,220,150,0.55)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = gr; g.fillRect(x - w * 0.12, h * 0.34, w * 0.24, h * 0.6); g.fillStyle = '#ffe9b0'; g.fillRect(x - 5, h * 0.45, 10, 5); g.fillStyle = '#222'; g.fillRect(x - 2, h * 0.46, 4, h * 0.46); }
}

const DEF = {
  delegacia: { parede: 'parede_delegacia', piso: 'piso_granito', mesa: 'madeira', lambri: 'lambri_delegacia', teto: 'teto_placas', luz: 'painel' },
  cafe: { parede: 'parede_cafe', piso: 'piso_madeiraEsc', mesa: 'madeiraEsc', lambri: 'lambri_cafe', teto: 'teto_cafe', luz: 'pendente' },
  jornal: { parede: 'parede_jornal', piso: 'piso_carpete', mesa: 'branco', lambri: null, teto: 'teto_placas', luz: 'painel' },
  casa: { parede: 'parede_casa', piso: 'piso_madeira', mesa: 'madeira', lambri: 'lambri_casa', teto: 'teto_liso', luz: 'cupula' },
};
// as janelas (só desenho: a parede continua inteira para a colisão): [parede, centro, largura, y0, y1, estilo]
const JANELAS = {
  delegacia: [['frente', -10.5, 2.4, 1.0, 3.2, 'persiana'], ['frente', -6.5, 2.4, 1.0, 3.2, 'persiana'],
    ['oeste', -8, 2.2, 1.0, 3.2, 'persiana'], ['oeste', 2.6, 2.0, 1.0, 3.2, 'persiana'], ['leste', -7.9, 2.2, 1.25, 3.2, 'persiana'], ['leste', 7.9, 2.2, 1.25, 3.2, 'persiana']],
  cafe: [['frente', -5.6, 6.2, 1.05, 3.5, 'vitrine'], ['frente', 5.6, 6.2, 1.05, 3.5, 'vitrine'], ['oeste', -2.2, 3.0, 1.05, 3.2, 'vitrine']],
  jornal: [['leste', 0.5, 2.6, 1.0, 3.4, 'persiana'], ['leste', 6.6, 2.4, 1.0, 3.4, 'persiana'], ['fundo', -10.5, 2.6, 1.0, 3.0, 'persiana'], ['fundo', -6, 2.6, 1.0, 3.0, 'persiana']],
  casa: [['fundo', -4.3, 1.8, 1.05, 2.45, 'cortina'], ['fundo', 3.7, 1.8, 1.05, 2.45, 'cortina'], ['leste', -1.6, 1.6, 1.25, 2.4, 'cortina'], ['frente', -5, 1.6, 1.05, 2.45, 'cortina'], ['frente', 4.6, 1.6, 1.05, 2.45, 'cortina']],
};

function materiais(THREE) {
  if (cacheMat.has('mats')) return cacheMat.get('mats');
  const M = {}, T = (k) => texturaPintada(THREE, k), D = (k) => { const [w, h, p] = DETALHES[k]; return textura(THREE, `int-${k}`, w, h, p); };
  const std = (k, o) => { M[k] = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, ...o }); return M[k]; };
  // os pintados ficam prontos na 1ª vez que um lugar os pede (getter): cada sala só gasta as próprias texturas
  const pintado = (k, o, tex = k) => Object.defineProperty(M, k, { configurable: true, enumerable: true, get() {
    const t = T(tex), m = new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.85, metalness: 0, emissive: 0xffffff, emissiveMap: t.map, emissiveIntensity: 0.05, ...o });
    if (t.bump) { m.bumpMap = t.bump; m.bumpScale = t.relevo; }
    if (o.color !== undefined) m.emissive.setHex(o.color);
    Object.defineProperty(M, k, { value: m, enumerable: true }); return m; } });
  for (const k of ['parede_delegacia', 'parede_lab', 'parede_cafe', 'parede_jornal', 'parede_casa', 'lambri_delegacia', 'lambri_cafe', 'lambri_casa']) pintado(k, {});
  pintado('piso_granito', { roughness: 0.34 }); pintado('piso_lab', { roughness: 0.42 }); pintado('piso_madeira', { roughness: 0.55 }); pintado('piso_madeiraEsc', { roughness: 0.5, color: 0x8f7562 }, 'piso_madeira'); pintado('piso_carpete', { roughness: 0.97 }); pintado('piso_cozinha', { roughness: 0.38 });
  pintado('teto_placas', { roughness: 0.95, emissiveIntensity: 0.16 }); pintado('teto_liso', { roughness: 0.95, emissiveIntensity: 0.16 }); pintado('teto_cafe', { roughness: 0.9, emissiveIntensity: 0.05 });
  std('madeira', { color: 0x8a5a34, roughness: 0.55 }); std('madeiraEsc', { color: 0x4a2c1a, roughness: 0.5 }); std('madeiraClara', { color: 0xb88a5c, roughness: 0.55 });
  std('branco', { color: 0xe9ecef, roughness: 0.45 }); std('sanca', { color: 0xf4f2ec, roughness: 0.8 }); std('metal', { color: 0xaab2ba, roughness: 0.32, metalness: 0.8 }); std('metalEsc', { color: 0x2a2f36, roughness: 0.45, metalness: 0.55 });
  std('tecido', { color: 0x6b2a2a, roughness: 0.95 }); std('tecido2', { color: 0x3b5a7a, roughness: 0.95 }); std('almofada', { color: 0xc9b48a, roughness: 0.95 }); std('cortina', { color: 0x8a6a5a, roughness: 0.95, side: THREE.DoubleSide });
  std('couro', { color: 0x1c1c1f, roughness: 0.55 }); std('papel', { color: 0xf3f1ea, roughness: 0.9 }); std('vaso', { color: 0xb5643a, roughness: 0.7 }); std('folha', { color: 0x2f6e3e, roughness: 0.85 }); std('folha2', { color: 0x3f8a4a, roughness: 0.85 });
  std('verde', { color: 0x2f6e3e, roughness: 0.9 }); std('porta', { color: 0x3a2618, roughness: 0.55 }); std('azulLab', { color: 0x2f7fd0, roughness: 0.5 }); std('fogao', { color: 0x161616, roughness: 0.3, metalness: 0.4 });
  M.vidro = new THREE.MeshStandardMaterial({ color: 0x9cc8e8, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false });
  M.luz = new THREE.MeshBasicMaterial({ color: 0xfff6e0 }); M.lampada = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  M.painel = new THREE.MeshBasicMaterial({ map: D('luz_painel'), color: 0xf4f7ff });
  M.tela = new THREE.MeshBasicMaterial({ map: D('computador') });
  for (const k of ['quadro', 'lousa', 'menu', 'noticias', 'fotos', 'placa_delegacia', 'placa_jornal', 'placa_lab', 'relogio', 'cartaz', 'tapete']) {
    const t = D(k), transp = k === 'fotos' || k === 'placa_jornal' || k === 'relogio';
    M[k] = new THREE.MeshStandardMaterial({ map: t, roughness: k === 'tapete' ? 0.98 : 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: k === 'noticias' ? 0.9 : 0.1, transparent: transp, alphaTest: transp ? 0.4 : 0 });
  }
  const overlay = (k, o) => { M[k] = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...o }); };
  overlay('sombra', { map: D('sombra_base') });
  overlay('sombraMovel', { map: D('sombra_movel') });
  overlay('poca', { map: D('poca'), blending: THREE.AdditiveBlending, opacity: 0.22, color: 0xffe2b8 });
  overlay('pocaJanela', { map: D('poca'), blending: THREE.AdditiveBlending, opacity: 0.18, color: 0xdfeeff });
  overlay('persiana', { map: D('persiana'), depthWrite: true, alphaTest: 0.3, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const vd = textura(THREE, 'int-vista-dia', OPC.alta ? 1024 : 512, OPC.alta ? 512 : 256, (g, w, h) => pintaVista(g, w, h, false));
  const vn = textura(THREE, 'int-vista-noite', OPC.alta ? 1024 : 512, OPC.alta ? 512 : 256, (g, w, h) => pintaVista(g, w, h, true));
  M.vista = new THREE.MeshBasicMaterial({ map: vd }); M.vista.userData = { dia: vd, noite: vn };
  M.saida = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  cacheMat.set('mats', M); return M;
}

/** Constrói o interior `id` do lugar no quarteirão de centro (cx, cz). Devolve {grupo, geos, atualizar(noite)}.
 *  opc: {alta (PC: 1024 px, relevo e sombras), aniso} */
export function construirInterior(THREE, id, cx, cz, opc = {}) {
  if (!cacheMat.has('mats')) Object.assign(OPC, { alta: opc.alta ?? true, aniso: opc.aniso ?? 4 });
  const I = INTERIORES[id], D = DEF[id], M = materiais(THREE);
  semear(`sala-${id}`);
  const grupo = new THREE.Group(); grupo.name = `interior-${id}`; grupo.position.set(cx, Y0, cz); grupo.visible = false;
  const B = {}, geos = [];
  const bk = (k) => B[k] || (B[k] = { p: [], n: [], u: [], i: [] });
  function quad(k, o, du, dv, w, h, tu = 2, tv = tu, rect = null) {
    const b = bk(k), base = b.p.length / 3;
    const nx = du[1] * dv[2] - du[2] * dv[1], ny = du[2] * dv[0] - du[0] * dv[2], nz = du[0] * dv[1] - du[1] * dv[0];
    const P = [o, [o[0] + du[0] * w, o[1] + du[1] * w, o[2] + du[2] * w], null, [o[0] + dv[0] * h, o[1] + dv[1] * h, o[2] + dv[2] * h]];
    P[2] = [P[1][0] + dv[0] * h, P[1][1] + dv[1] * h, P[1][2] + dv[2] * h];
    const UV = rect ? [[rect[0], rect[2]], [rect[1], rect[2]], [rect[1], rect[3]], [rect[0], rect[3]]]
      : P.map((q) => [(q[0] * du[0] + q[1] * du[1] + q[2] * du[2]) / tu, (q[0] * dv[0] + q[1] * dv[1] + q[2] * dv[2]) / tv]);
    for (let i = 0; i < 4; i++) { b.p.push(...P[i]); b.n.push(nx, ny, nz); b.u.push(...UV[i]); }
    b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  function box(k, x0, x1, y0, y1, z0, z1, tile = 2) {
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    quad(k, [x1, y0, z1], [0, 0, -1], [0, 1, 0], dz, dy, tile); quad(k, [x0, y0, z0], [0, 0, 1], [0, 1, 0], dz, dy, tile);
    quad(k, [x0, y1, z1], [1, 0, 0], [0, 0, -1], dx, dz, tile); quad(k, [x0, y0, z0], [1, 0, 0], [0, 0, 1], dx, dz, tile);
    quad(k, [x0, y0, z1], [1, 0, 0], [0, 1, 0], dx, dy, tile); quad(k, [x1, y0, z0], [-1, 0, 0], [0, 1, 0], dx, dy, tile);
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3(1, 1, 1), n3 = new THREE.Matrix3(), t3 = new THREE.Vector3();
  function prim(k, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const b = bk(k), base = b.p.length / 3;
    e4.set(rx, ry, rz); q4.setFromEuler(e4); v4.set(x, y, z); s4.set(sx, sy, sz); m4.compose(v4, q4, s4); n3.getNormalMatrix(m4);
    const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
    for (let i = 0; i < pa.count; i++) { t3.fromBufferAttribute(pa, i).applyMatrix4(m4); b.p.push(t3.x, t3.y, t3.z); t3.fromBufferAttribute(na, i).applyMatrix3(n3).normalize(); b.n.push(t3.x, t3.y, t3.z); b.u.push(ua ? ua.getX(i) : 0, ua ? ua.getY(i) : 0); }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) b.i.push(base + geo.index.getX(i)); else for (let i = 0; i < pa.count; i++) b.i.push(base + i);
    geo.dispose();
  }
  const cil = (k, x, y, z, r, h, seg = 14, r2 = r) => prim(k, new THREE.CylinderGeometry(r2, r, h, seg), x, y, z);
  const esf = (k, x, y, z, r, sx = 1, sy = 1, sz = 1) => prim(k, new THREE.IcosahedronGeometry(r, 1), x, y, z, 0, 0, 0, sx, sy, sz);
  // um quadro/tela plano na parede: de frente para dir (0: +v, 1: −u, 2: −v, 3: +u)
  const painel = (k, u, y, v, w, h, dir, R = [0, 1, 0, 1]) => {
    if (dir === 0) quad(k, [u - w / 2, y, v], [1, 0, 0], [0, 1, 0], w, h, 1, 1, R);
    else if (dir === 2) quad(k, [u + w / 2, y, v], [-1, 0, 0], [0, 1, 0], w, h, 1, 1, R);
    else if (dir === 3) quad(k, [u, y, v + w / 2], [0, 0, -1], [0, 1, 0], w, h, 1, 1, R);
    else quad(k, [u, y, v - w / 2], [0, 0, 1], [0, 1, 0], w, h, 1, 1, R);
  };
  const piso = (k, a, b, c, d, y = 0.01, R = null, tile = 3) => quad(k, [a, y, d], [1, 0, 0], [0, 0, -1], b - a, d - c, tile, tile, R);
  const [u0, u1, v0, v1] = I.sala, H = I.teto;
  const naSala = (u, v) => u > u0 && u < u1 && v > v0 && v < v1;
  const noLab = (u, v) => id === 'delegacia' && u > 4 && naSala(u, v);

  // ---------- as faces das paredes (onde vão o lambri, o rodapé, a sanca e as sombras de contato) ----------
  // F: {eixo, f (o plano da face), l (±1: para onde a face olha), s0, s1}
  function quadFace(F, s0, s1, y0, y1, d, k, R = null, tile = 2) {
    const w = s1 - s0, h = y1 - y0; if (w < 1e-3 || h < 1e-3) return;
    if (F.eixo === 'x') { if (F.l > 0) quad(k, [s0, y0, F.f + d], [1, 0, 0], [0, 1, 0], w, h, tile, tile, R); else quad(k, [s1, y0, F.f - d], [-1, 0, 0], [0, 1, 0], w, h, tile, tile, R); }
    else if (F.l > 0) quad(k, [F.f + d, y0, s1], [0, 0, -1], [0, 1, 0], w, h, tile, tile, R); else quad(k, [F.f - d, y0, s0], [0, 0, 1], [0, 1, 0], w, h, tile, tile, R);
  }
  function caixaFace(F, s0, s1, y0, y1, d0, d1, k, tile = 2) {
    const a = F.f + F.l * d0, b = F.f + F.l * d1;
    if (F.eixo === 'x') box(k, s0, s1, y0, y1, Math.min(a, b), Math.max(a, b), tile); else box(k, Math.min(a, b), Math.max(a, b), y0, y1, s0, s1, tile);
  }
  // o chão diante da face: a faixa de sombra de contato (escura junto da parede)
  function sombraChao(F, s0, s1, larg = 0.5) {
    if (F.eixo === 'x') { const v = F.f; if (F.l > 0) quad('sombra', [s0, 0.014, v + larg], [1, 0, 0], [0, 0, -1], s1 - s0, larg, 1, 1, [0, 1, 1, 0]); else quad('sombra', [s1, 0.014, v - larg], [-1, 0, 0], [0, 0, 1], s1 - s0, larg, 1, 1, [0, 1, 1, 0]); }
    else { const u = F.f; if (F.l > 0) quad('sombra', [u + larg, 0.014, s1], [0, 0, -1], [-1, 0, 0], s1 - s0, larg, 1, 1, [0, 1, 1, 0]); else quad('sombra', [u - larg, 0.014, s0], [0, 0, 1], [1, 0, 0], s1 - s0, larg, 1, 1, [0, 1, 1, 0]); }
  }
  const faces = [];
  for (const p of paredesDoInterior(id)) {
    const t = p.ext ? PE : 0.16, lados = p.ext ? [-p.ext] : [1, -1];
    // (as faixas param no batente das portas: 8 cm de cada lado do vão)
    const vaos = p.vaos.slice().sort((a, b) => a[0] - b[0]), solidos = []; let cur = p.a, bat = 0;
    for (const [s0, s1] of vaos) { solidos.push([cur + bat, s0 - 0.08]); cur = s1; bat = 0.08; } solidos.push([cur + bat, p.b]);
    const [lo, hi] = p.eixo === 'x' ? [u0, u1] : [v0, v1];
    for (const l of lados) for (const [a, b] of solidos) {
      const s0 = Math.max(a, lo), s1 = Math.min(b, hi); if (s1 - s0 < 0.05) continue;
      const f = p.c + l * t / 2, pr = f + l * 0.3, sm = (s0 + s1) / 2, [pu, pv] = p.eixo === 'x' ? [sm, pr] : [pr, sm];
      if (!naSala(pu, pv)) continue;
      // no laboratório (delegacia, u > 4) a face fica de azulejo: corta o pedaço da face em duas partes, se precisar
      const partes = [];
      if (id === 'delegacia' && p.eixo === 'x' && s0 < 4 && s1 > 4) partes.push([s0, 4], [4, s1]); else partes.push([s0, s1]);
      for (const [q0, q1] of partes) { const m = (q0 + q1) / 2, [mu, mv] = p.eixo === 'x' ? [m, pr] : [pr, m]; faces.push({ eixo: p.eixo, f, l, s0: q0, s1: q1, lab: noLab(mu, mv), p, janelas: p.janelas || [], jy: p.jy }); }
    }
  }

  // ---------- paredes, piso, teto ----------
  const corParede = (p) => (id === 'delegacia' && p.eixo === 'z' && p.c === 4 ? 'parede_lab' : D.parede);
  for (const p of paredesDoInterior(id)) {
    const t = p.ext ? PE : 0.16, c0 = p.c - t / 2, c1 = p.c + t / 2, k = corParede(p);
    const caixa = (s0, s1, y0, y1, kk = k) => { if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return; if (p.eixo === 'x') box(kk, s0, s1, y0, y1, c0, c1); else box(kk, c0, c1, y0, y1, s0, s1); };
    const vaos = p.vaos.slice().sort((a, b) => a[0] - b[0]); const solidos = []; let cur = p.a;
    for (const [s0, s1] of vaos) { solidos.push([cur, s0]); cur = s1; } solidos.push([cur, p.b]);
    for (const [s0, s1] of solidos) {
      let cursor = s0;
      for (const [j0, j1] of p.janelas || []) {
        const a = Math.max(s0, j0), b = Math.min(s1, j1); if (b - a < 0.3) continue;
        caixa(cursor, a, 0, H); caixa(a, b, 0, p.jy[0]); caixa(a, b, p.jy[1], H);
        const vm = (c0 + c1) / 2; if (p.eixo === 'x') quad('vidro', [a, p.jy[0], vm], [1, 0, 0], [0, 1, 0], b - a, p.jy[1] - p.jy[0]); else quad('vidro', [vm, p.jy[0], a], [0, 0, 1], [0, 1, 0], b - a, p.jy[1] - p.jy[0]);
        caixa(a, b, p.jy[0] - 0.05, p.jy[0], 'metal'); caixa(a, b, p.jy[1], p.jy[1] + 0.05, 'metal');
        for (let x = a + 1.4; x < b - 0.3; x += 1.4) caixa(x - 0.025, x + 0.025, p.jy[0], p.jy[1], 'metal');          // os montantes do vidro
        cursor = b;
      }
      caixa(cursor, s1, 0, H);
    }
    for (const [s0, s1] of vaos) { caixa(s0, s1, PORTA_H, H); caixa(s0 - 0.08, s0, 0, PORTA_H, 'metalEsc'); caixa(s1, s1 + 0.08, 0, PORTA_H, 'metalEsc'); caixa(s0 - 0.08, s1 + 0.08, PORTA_H, PORTA_H + 0.08, 'metalEsc'); }
  }
  // o lambri, a faixa azul do laboratório, o rodapé, a sanca e as sombras de contato, face por face (sem cobrir as portas)
  const LAMBRI_H = 1.0;
  for (const F of faces) {
    const lambri = !F.lab && D.lambri;
    if (lambri) caixaFace(F, F.s0, F.s1, 0, LAMBRI_H, 0, 0.025, lambri, 1);
    else if (F.lab) { if (!F.janelas.length) quadFace(F, F.s0, F.s1, 0, H, 0.004, 'parede_lab'); caixaFace(F, F.s0, F.s1, 1.15, 1.25, 0, 0.012, 'azulLab'); }   // o laboratório todo de azulejo
    caixaFace(F, F.s0, F.s1, 0, 0.14, 0, lambri ? 0.045 : 0.03, F.lab ? 'branco' : 'madeiraEsc');
    caixaFace(F, F.s0, F.s1, H - 0.12, H, 0, 0.07, 'sanca');
    quadFace(F, F.s0, F.s1, 0.0, 0.42, lambri ? 0.05 : 0.035, 'sombra', [0, 1, 0, 1]);
    quadFace(F, F.s0, F.s1, H - 0.55, H - 0.12, 0.075, 'sombra', [0, 1, 0.95, 0.45]);
    sombraChao(F, F.s0, F.s1, 0.55);
  }
  // a porta de saída (fechada, do lado de fora do vão), com almofadas, maçaneta e a placa SAÍDA em cima
  { const [p0, p1] = I.porta, vp = v0 - PE - 0.04;
    box('porta', p0, p1, 0, PORTA_H, vp - 0.06, vp); box('madeiraEsc', p0 + 0.15, (p0 + p1) / 2 - 0.08, 0.3, PORTA_H - 0.3, vp, vp + 0.015); box('madeiraEsc', (p0 + p1) / 2 + 0.08, p1 - 0.15, 0.3, PORTA_H - 0.3, vp, vp + 0.015);
    box('metal', (p0 + p1) / 2 - 0.2, (p0 + p1) / 2 - 0.05, 1.0, 1.06, vp + 0.0, vp + 0.07); box('metal', (p0 + p1) / 2 + 0.05, (p0 + p1) / 2 + 0.2, 1.0, 1.06, vp + 0.0, vp + 0.07);
    box('saida', -0.45, 0.45, PORTA_H + 0.16, PORTA_H + 0.42, v0 + 0.01, v0 + 0.04); }
  // o piso (por região: o laboratório da Delegacia e a cozinha da casa têm o seu)
  const ladrilho = D.piso;
  if (id === 'delegacia') { piso(ladrilho, u0, 4, v0, v1); piso('piso_lab', 4, u1, v0, v1); }
  else if (id === 'casa') { piso(ladrilho, u0, 4.6, v0, v1); piso('piso_cozinha', 4.6, u1, v0, v1); box('madeiraEsc', 4.58, 4.62, 0.0, 0.012, v0, v1); }
  else piso(ladrilho, u0, u1, v0, v1);
  quad(D.teto, [u0, H, v0], [1, 0, 0], [0, 0, 1], u1 - u0, v1 - v0, 3.6);

  // ---------- as luzes do teto e as poças de luz no chão ----------
  const pocas = [];
  if (D.luz === 'painel') {
    for (let u1_ = u0 + 2.7; u1_ < u1 - 1; u1_ += 3.6) for (let v1_ = v0 + 2.7; v1_ < v1 - 1; v1_ += 3.6) {
      const u = (Math.floor(u1_ / 0.6) + 0.5) * 0.6, v = Math.round(v1_ / 0.6) * 0.6;
      if (id === 'jornal' && Math.abs(u - 6) < 0.6) continue;
      box('metalEsc', u - 0.34, u + 0.34, H - 0.03, H - 0.005, v - 0.64, v + 0.64); quad('painel', [u - 0.3, H - 0.031, v - 0.6], [1, 0, 0], [0, 0, 1], 0.6, 1.2, 1, 1, [0, 1, 0, 1]);
      pocas.push([u, v, 3.4]);
    }
  } else if (D.luz === 'cupula') {
    for (const [u, v] of [[-4.6, 0.6], [2.5, 0], [6, -1.8]]) { cil('metalEsc', u, H - 0.04, v, 0.12, 0.06, 12); esf('lampada', u, H - 0.2, v, 0.28, 1, 0.5, 1); pocas.push([u, v, 3.2]); }
  }
  // ---------- os móveis por tipo ----------
  const sombraMovel = (a, b, c, d, f = 0.28) => quad('sombraMovel', [a - f, 0.013, d + f], [1, 0, 0], [0, 0, -1], b - a + 2 * f, d - c + 2 * f, 1, 1, [0, 1, 0, 1]);
  const cadeira = (u, v, rumo) => {
    const c = Math.cos(rumo), s = Math.sin(rumo), bu = u - 0.22 * s, bv = v - 0.22 * c;
    box('couro', u - 0.24, u + 0.24, 0.42, 0.52, v - 0.24, v + 0.24); cil('metalEsc', u, 0.24, v, 0.03, 0.36, 6);
    box('metalEsc', u - 0.3, u + 0.3, 0.03, 0.06, v - 0.03, v + 0.03); box('metalEsc', u - 0.03, u + 0.03, 0.03, 0.06, v - 0.3, v + 0.3);
    if (Math.abs(s) > 0.7) box('couro', bu - 0.03, bu + 0.03, 0.55, 1.05, bv - 0.21, bv + 0.21); else box('couro', bu - 0.21, bu + 0.21, 0.55, 1.05, bv - 0.03, bv + 0.03);
    sombraMovel(u - 0.3, u + 0.3, v - 0.3, v + 0.3, 0.12);
  };
  for (const [a, b, c, d, h, tipo] of I.moveis) {
    const um = (a + b) / 2, vm = (c + d) / 2;
    sombraMovel(a, b, c, d, tipo === 'estante' || tipo === 'geladeira' ? 0.18 : 0.3);
    if (tipo === 'mesa') {
      box(D.mesa, a, b, h - 0.04, h, c, d); box('metalEsc', a, b, h - 0.07, h - 0.04, c + 0.02, d - 0.02);
      box(D.mesa === 'branco' ? 'metalEsc' : 'madeiraEsc', b - 0.45, b - 0.04, 0, h - 0.07, c + 0.06, d - 0.06);                // o gaveteiro
      for (let y = 0.12; y < h - 0.2; y += 0.22) box('metal', b - 0.3, b - 0.18, y + 0.1, y + 0.12, c + 0.03, c + 0.06);
      box('metalEsc', a + 0.04, a + 0.08, 0, h - 0.07, c + 0.06, d - 0.06); box('metalEsc', a + 0.08, b - 0.45, 0.25, h - 0.1, d - 0.08, d - 0.05);
      box('metalEsc', um - 0.32, um + 0.32, h + 0.08, h + 0.44, d - 0.12, d - 0.08); quad('tela', [um + 0.3, h + 0.1, d - 0.125], [-1, 0, 0], [0, 1, 0], 0.6, 0.33, 1, 1, [0, 1, 0, 1]);
      box('metalEsc', um - 0.03, um + 0.03, h, h + 0.08, d - 0.11, d - 0.09); box('metalEsc', um - 0.12, um + 0.12, h, h + 0.012, d - 0.2, d - 0.06);
      box('metalEsc', um - 0.25, um + 0.25, h, h + 0.02, vm - 0.12, vm + 0.04); box('metalEsc', um + 0.34, um + 0.4, h, h + 0.02, vm - 0.06, vm + 0.04);
      const pa = a + 0.2 + rnd() * 0.3; box('papel', pa, pa + 0.3, h, h + 0.01 + rnd() * 0.05, vm - 0.2, vm + 0.18);
      if (rnd() < 0.6) cil('branco', a + 0.25, h + 0.05, d - 0.25, 0.04, 0.1, 10);
      cadeira(um, c - 0.45, 0);
    } else if (tipo === 'balcao') {
      box(id === 'cafe' ? 'madeiraEsc' : 'madeira', a, b, 0, h - 0.06, c, d); box(id === 'cafe' ? 'branco' : 'metalEsc', a - 0.05, b + 0.05, h - 0.06, h, c - 0.08, d + 0.05);
      for (let x = a + 0.3; x < b - 0.3; x += 1.0) { box(id === 'cafe' ? 'madeira' : 'metalEsc', x, x + 0.04, 0.12, h - 0.16, c - 0.012, c); }
      if (id === 'cafe') {
        box('metal', a + 0.6, a + 1.4, h, h + 0.55, c + 0.1, d - 0.2); cil('metalEsc', a + 0.8, h + 0.6, c + 0.4, 0.06, 0.1, 8); cil('metalEsc', a + 1.2, h + 0.6, c + 0.4, 0.06, 0.1, 8);
        box('vidro', b - 2.6, b - 0.6, h, h + 0.5, c + 0.05, d - 0.05); for (let k = 0; k < 6; k++) esf('madeiraClara', b - 2.4 + k * 0.3, h + 0.08, vm, 0.08, 1, 0.6, 1);
        for (let k = 0; k < 5; k++) { const x = a + 2 + k * 0.32; cil('branco', x, h + 0.06, c + 0.25, 0.045, 0.1, 10); }
        for (let x = a + 0.6; x < b - 0.4; x += 1.2) { cil('metalEsc', x, 0.38, c - 0.5, 0.03, 0.76, 6); cil('couro', x, 0.78, c - 0.5, 0.2, 0.07, 14); cil('metalEsc', x, 0.25, c - 0.5, 0.17, 0.02, 12, 0.17); }      // banquetas
      } else { box('metalEsc', um - 0.3, um + 0.3, h, h + 0.4, d - 0.15, d - 0.1); quad('tela', [um + 0.28, h + 0.03, d - 0.155], [-1, 0, 0], [0, 1, 0], 0.56, 0.34, 1, 1, [0, 1, 0, 1]); box('papel', a + 0.4, a + 0.8, h, h + 0.03, c + 0.1, c + 0.4); }
    } else if (tipo === 'bancada') {
      box('branco', a, b, h - 0.05, h, c, d); box('metalEsc', a + 0.05, b - 0.05, 0, h - 0.05, c + 0.05, d - 0.05);
      for (let x = a + 0.35; x < b - 0.3; x += 0.7) box('metal', x, x + 0.5, 0.1, h - 0.12, c + 0.04, c + 0.05);
      for (let x = a + 0.6; x < b - 0.4; x += 1.1) { cil('vidro', x, h + 0.12, vm + (rnd() - 0.5) * 0.3, 0.05, 0.24, 8); if (rnd() < 0.5) cil('metal', x + 0.4, h + 0.06, vm, 0.08, 0.12, 8); }
      if (b - a < 6) { cil('metalEsc', um, h + 0.2, vm, 0.12, 0.4, 10); cil('metal', um + 0.05, h + 0.5, vm, 0.03, 0.3, 6); box('metalEsc', um - 0.2, um + 0.2, h, h + 0.05, vm - 0.2, vm + 0.2); }
      else {                                                                                   // as de parede: microscópio, monitor e os armários de cima
        const lado = vm < 0 ? -1 : 1, vp = lado < 0 ? c + 0.1 : d - 0.1;
        box('metalEsc', a + 1.0, a + 1.25, h, h + 0.08, vm - 0.12, vm + 0.12); cil('metalEsc', a + 1.12, h + 0.25, vm, 0.03, 0.34, 8); cil('metal', a + 1.12, h + 0.42, vm - lado * 0.05, 0.04, 0.12, 8);
        box('metalEsc', b - 1.6, b - 1.0, h + 0.08, h + 0.44, vp - 0.03, vp + 0.03); quad('tela', [b - 1.03, h + 0.1, vp - lado * 0.035], [-1, 0, 0], [0, 1, 0], 0.54, 0.32, 1, 1, [0, 1, 0, 1]);
        // os armários de cima só na parede sem a lousa (a da frente)
        if (lado < 0) { const z0 = v0, z1 = v0 + 0.38; box('branco', a, b, 1.9, 2.6, z0, z1); for (let x = a + 0.9; x < b - 0.1; x += 0.9) box('metal', x - 0.01, x + 0.01, 1.92, 2.58, z1, z1 + 0.005); }
      }
    } else if (tipo === 'estante') {
      box('madeiraEsc', a, b, 0, h, c, d); box('madeiraEsc', a - 0.04, b + 0.04, h, h + 0.05, c - 0.04, d + 0.04);
      const ladoX = b - a < d - c;
      for (let y = 0.35; y < h - 0.2; y += 0.55) {
        if (ladoX) box('madeira', a - 0.14, a, y - 0.03, y, c + 0.05, d - 0.05); else box('madeira', a + 0.05, b - 0.05, y - 0.03, y, c - 0.14, c);
        for (let s = 0.1; s < (ladoX ? d - c : b - a) - 0.3; s += 0.06 + rnd() * 0.1) {
          const hh = 0.18 + rnd() * 0.25, k = ['tecido', 'tecido2', 'branco', 'madeira', 'almofada', 'couro'][Math.floor(rnd() * 6)], e = 0.04 + rnd() * 0.05;
          if (rnd() < 0.08) { s += 0.2; continue; }
          if (ladoX) box(k, a - 0.13, a + 0.01, y, y + hh, c + s, c + s + e); else box(k, a + s, a + s + e, y, y + hh, c - 0.13, c + 0.01);
          s += e;
        }
      }
    } else if (tipo === 'mesaRedonda') {
      cil('madeiraEsc', um, h - 0.03, vm, 0.45, 0.06, 20); cil('metalEsc', um, h / 2, vm, 0.05, h, 8); cil('metalEsc', um, 0.02, vm, 0.25, 0.04, 14);
      cadeira(um, vm - 0.75, 0); cadeira(um, vm + 0.75, PI); cil('branco', um + 0.12, h + 0.05, vm, 0.05, 0.1, 10); cil('branco', um - 0.1, h + 0.005, vm + 0.08, 0.09, 0.01, 14);
    } else if (tipo === 'sofa') {
      const k = id === 'casa' ? 'tecido2' : 'tecido';
      box(k, a, b, 0.12, 0.45, c, d); const fundoV = d - c > b - a;
      if (fundoV) box(k, b - 0.25, b, 0.45, h + 0.1, c, d); else box(k, a, b, 0.45, h + 0.1, d - 0.25, d);
      box(k, a, a + 0.2, 0.45, 0.68, c, d); box(k, b - 0.2, b, 0.45, 0.68, c, d);
      const n = Math.max(2, Math.round((fundoV ? d - c : b - a) / 1.1));
      for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; if (fundoV) box(k, a + 0.22, b - 0.27, 0.45, 0.55, c + 0.22 + (d - c - 0.44) * t0 + 0.02, c + 0.22 + (d - c - 0.44) * t1 - 0.02); else box(k, a + 0.22 + (b - a - 0.44) * t0 + 0.02, a + 0.22 + (b - a - 0.44) * t1 - 0.02, 0.45, 0.55, c + 0.05, d - 0.27); }
      if (fundoV) { box('almofada', b - 0.42, b - 0.27, 0.55, 0.9, c + 0.3, c + 0.75); box('almofada', b - 0.42, b - 0.27, 0.55, 0.9, d - 0.75, d - 0.3); }
      else { box('almofada', a + 0.3, a + 0.75, 0.55, 0.9, d - 0.42, d - 0.27); box('almofada', b - 0.75, b - 0.3, 0.55, 0.9, d - 0.42, d - 0.27); }
      for (const [x, z] of [[a + 0.08, c + 0.08], [b - 0.08, c + 0.08], [a + 0.08, d - 0.08], [b - 0.08, d - 0.08]]) box('madeiraEsc', x - 0.04, x + 0.04, 0, 0.12, z - 0.04, z + 0.04);
    } else if (tipo === 'mesinha') { box('madeira', a, b, h - 0.05, h, c, d); box('madeiraEsc', a + 0.1, b - 0.1, 0, h - 0.05, c + 0.1, d - 0.1); box('papel', um - 0.2, um + 0.1, h, h + 0.02, vm - 0.15, vm + 0.1); cil('verde', um + 0.35, h + 0.08, vm, 0.06, 0.16, 10); }
    else if (tipo === 'geladeira') { box('branco', a, b, 0, h, c, d); box('metalEsc', a - 0.005, a, 1.25, 1.27, c + 0.02, d - 0.02); box('metal', a - 0.03, a, 1.35, 1.8, c + 0.15, c + 0.2); box('metal', a - 0.03, a, 0.5, 1.15, c + 0.15, c + 0.2); }
    else if (tipo === 'escada') {
      const n = 10; for (let k = 0; k < n; k++) { box('madeira', a, b, 0, ((k + 1) / n) * h, c + (k / n) * (d - c), c + ((k + 1) / n) * (d - c)); box('madeiraEsc', a, b, ((k + 1) / n) * h - 0.01, ((k + 1) / n) * h + 0.015, c + (k / n) * (d - c) - 0.02, c + (k / n) * (d - c) + 0.03); }
      for (let k = 0; k <= 4; k++) { const z = c + (k / 4) * (d - c), y = (k / 4) * h; cil('branco', b - 0.06, y + 0.5, z, 0.02, 1.0, 6); }
      box('madeiraEsc', b - 0.09, b - 0.03, h * 0.5 + 0.98, h * 0.5 + 1.02, c, d);
    }
    else if (tipo === 'planta') { cil('vaso', um, 0.22, vm, 0.2, 0.44, 14, 0.24); for (let k = 0; k < 7; k++) { const a2 = k * 0.9 + rnd(); esf(k % 2 ? 'folha' : 'folha2', um + Math.cos(a2) * 0.18, 0.75 + rnd() * 0.55, vm + Math.sin(a2) * 0.18, 0.2 + rnd() * 0.1, 1, 1.4, 1); } }
    else if (tipo === 'bebedouro') { box('branco', a, b, 0, 1.0, c, d); cil('vidro', um, 1.25, vm, 0.15, 0.5, 14); cil('metal', um, 1.02, vm, 0.12, 0.04, 12); box('metalEsc', um - 0.1, um + 0.1, 0.75, 0.82, c - 0.02, c); }
    else if (tipo === 'banco') { box('madeira', a, b, 0.42, 0.47, c, d); for (const x of [a + 0.1, b - 0.14]) box('metalEsc', x, x + 0.04, 0, 0.42, c + 0.05, d - 0.05); box('madeira', a, b, 0.55, 0.9, c + 0.02, c + 0.06); }
    else if (tipo === 'arquivo') { box('metalEsc', a, b, 0, h, c, d); for (let y = 0.15; y < h - 0.1; y += 0.32) { box('metal', a + 0.02, b - 0.02, y + 0.24, y + 0.26, c - 0.012, c); box('metal', (a + b) / 2 - 0.08, (a + b) / 2 + 0.08, y + 0.12, y + 0.15, c - 0.03, c); } }
  }

  // ---------- as janelas: a rua lá fora, o caixilho, o peitoril e a persiana/cortina ----------
  const FACE_EXT = { frente: { eixo: 'x', f: v0, l: 1 }, fundo: { eixo: 'x', f: v1, l: -1 }, oeste: { eixo: 'z', f: u0, l: 1 }, leste: { eixo: 'z', f: u1, l: -1 } };
  const pocasJanela = [];
  for (const [qual, s, w, y0, y1, estilo] of JANELAS[id] || []) {
    const F = FACE_EXT[qual], s0 = s - w / 2, s1 = s + w / 2, fr = estilo === 'vitrine' ? 0.07 : 0.05;
    let du = 0.5 * w / (y1 - y0), dv = 1; if (du > 0.95) { dv = 0.95 / du; du = 0.95; }
    const r0 = (((s * 0.137 + 0.21) % 1) + 1) % 1 * (1 - du); quadFace(F, s0, s1, y0, y1, 0.012, 'vista', [r0, r0 + du, 0.04, 0.04 + dv * 0.95]);
    quadFace(F, s0, s1, y0, y1, 0.02, 'vidro');
    const km = estilo === 'cortina' ? 'branco' : 'metalEsc';
    caixaFace(F, s0 - fr, s1 + fr, y1, y1 + fr, 0.01, 0.07, km); caixaFace(F, s0 - fr, s0, y0, y1, 0.01, 0.07, km); caixaFace(F, s1, s1 + fr, y0, y1, 0.01, 0.07, km);
    caixaFace(F, s0 - fr - 0.05, s1 + fr + 0.05, y0 - 0.05, y0, 0.0, estilo === 'vitrine' ? 0.08 : 0.16, estilo === 'cortina' ? 'branco' : 'metal');                     // o peitoril
    caixaFace(F, s - 0.025, s + 0.025, y0, y1, 0.01, 0.05, km);                                   // o montante do meio
    if (estilo !== 'vitrine') caixaFace(F, s0, s1, y0 + (y1 - y0) * 0.62, y0 + (y1 - y0) * 0.62 + 0.04, 0.01, 0.05, km);
    if (estilo === 'persiana') { const ate = y0 + (y1 - y0) * (0.25 + rnd() * 0.4); quadFace(F, s0, s1, ate, y1, 0.045, 'persiana', [0, 1, 0, (y1 - ate) / (y1 - y0)]); caixaFace(F, s0 - 0.02, s1 + 0.02, ate - 0.03, ate, 0.03, 0.07, 'branco'); }
    if (estilo === 'cortina') { for (const [a2, b2] of [[s0 - 0.35, s0 + 0.15], [s1 - 0.15, s1 + 0.35]]) for (let k = 0; k < 4; k++) { const x0 = a2 + (b2 - a2) * k / 4; caixaFace(F, x0, x0 + (b2 - a2) / 4 - 0.01, y0 - 0.25, y1 + 0.18, 0.08 + (k % 2) * 0.03, 0.1 + (k % 2) * 0.03, 'cortina'); } caixaFace(F, s0 - 0.45, s1 + 0.45, y1 + 0.2, y1 + 0.24, 0.06, 0.12, 'metal'); }
    // a luz do dia que entra pela janela, no chão diante dela
    const d0 = 1.4, [pu, pv] = F.eixo === 'x' ? [s, F.f + F.l * d0] : [F.f + F.l * d0, s];
    pocasJanela.push([pu, pv, Math.min(4.5, Math.max(2.4, w * 1.2))]);
  }
  for (const [u, v, r] of pocas) quad('poca', [u - r / 2, 0.016, v + r / 2], [1, 0, 0], [0, 0, -1], r, r, 1, 1, [0, 1, 0, 1]);
  for (const [u, v, r] of pocasJanela) quad('pocaJanela', [u - r / 2, 0.017, v + r / 2], [1, 0, 0], [0, 0, -1], r, r, 1, 1, [0, 1, 0, 1]);

  // ---------- os detalhes de cada lugar ----------
  const relogio = (u, y, v, dir) => painel('relogio', u, y, v, 0.42, 0.42, dir);
  if (id === 'delegacia') {
    painel('quadro', u0 + 0.03, 1.2, -1.8, 4.6, 2.3, 3);                         // o quadro de evidências (parede oeste)
    painel('lousa', 9.5, 1.1, v1 - 0.03, 4.4, 2.2, 2);                           // a lousa do laboratório da perícia
    box('vidro', 8, 12, H - 0.02, H, -3, 3); box('metal', 7.95, 12.05, H - 0.04, H - 0.01, -3.05, -2.95); box('metal', 7.95, 12.05, H - 0.04, H - 0.01, 2.95, 3.05);   // a claraboia (por onde o raio entrou)
    for (const u of [-12.5, -6.5, 0]) painel('fotos', u, 2.4, v1 - 0.03, 2.6, 0.65, 2);
    painel('cartaz', -4.2, 1.35, v1 - 0.03, 1.6, 1.2, 2);
    // a placa pendurada sobre o balcão, de frente para quem entra, e a do laboratório sobre a porta de vidro
    cil('metalEsc', -3.5, H - 0.3, -7.1, 0.01, 0.6, 4); cil('metalEsc', -0.5, H - 0.3, -7.1, 0.01, 0.6, 4);
    box('metalEsc', -4.1, 0.1, 3.0, 3.98, -7.14, -7.06); painel('placa_delegacia', -2, 3.02, -7.145, 4.1, 0.94, 2); painel('placa_delegacia', -2, 3.02, -7.055, 4.1, 0.94, 0);
    painel('placa_lab', 3.92, PORTA_H + 0.25, 0, 2.2, 0.5, 1);
    relogio(-8.6, 3.3, v1 - 0.03, 2); relogio(u1 - 0.03, 3.1, 0, 1);
  } else if (id === 'cafe') {
    painel('menu', -2, 2.3, v1 - 0.04, 5.2, 2.6, 2);
    for (const [u, v] of [[-6.5, -2.5], [-2.5, -4.2], [2, -2.4], [6.5, -4.4], [6.4, 0.6], [-4.4, 3.0], [0.2, 3.0]]) { cil('metalEsc', u, H - 0.55, v, 0.008, 1.1, 4); cil('metalEsc', u, H - 1.15, v, 0.24, 0.18, 14, 0.06); esf('lampada', u, H - 1.27, v, 0.07); quad('poca', [u - 1.2, 0.016, v + 1.2], [1, 0, 0], [0, 0, -1], 2.4, 2.4, 1, 1, [0, 1, 0, 1]); }
    for (const v of [-4, 0, 4]) painel('fotos', u1 - 0.04, 2.0, v, 2.4, 0.6, 1);
    for (let u = u0 + 2; u < u1; u += 4) box('madeiraEsc', u - 0.12, u + 0.12, H - 0.3, H, v0, v1);                     // as vigas do teto
    prim('metal', new THREE.CylinderGeometry(0.18, 0.18, u1 - u0 - 0.4, 12), 0, H - 0.45, -2, 0, 0, PI / 2);   // o duto
    piso('tapete', 7.2, 9.6, 1.2, 3.2, 0.018, [0, 1, 0, 1]);
    relogio(u0 + 0.04, 3.0, 4.4, 3);
  } else if (id === 'jornal') {
    for (const v of [-6, 0]) painel('noticias', u0 + 0.04, 1.5, v, 4.6, 2.6, 3);
    painel('noticias', 0, 2.2, v1 - 0.04, 5.2, 2.0, 2);
    painel('placa_jornal', -8.25, 3.2, v1 - 0.04, 5.0, 1.0, 2);
    for (let u = -12; u <= 4; u += 4) painel('fotos', u, 3.1, v0 + 0.04, 3.2, 0.8, 0);
    box('metalEsc', 12.4, 13.4, 0, 1.1, -9.6, -8.6); box('branco', 12.5, 13.3, 1.1, 1.3, -9.5, -8.7); box('papel', 12.6, 13.2, 1.3, 1.32, -9.4, -8.9);   // a impressora
    for (const [u, v] of [[-13.5, -9.5], [13.3, 9.4]]) for (let k = 0; k < 6; k++) box('papel', u - 0.3 + rnd() * 0.04, u + 0.3, 0.06 * k, 0.06 * k + 0.055, v - 0.2, v + 0.2);   // pilhas de jornal
    relogio(4.5, 3.2, v1 - 0.04, 2);
  } else if (id === 'casa') {
    box('metalEsc', -7.7, -7.6, 1.0, 1.8, -2.6, 0.6); painel('noticias', -7.58, 1.05, -1, 3.0, 0.72, 3);   // a TV
    box('madeiraEsc', -7.9, -7.3, 0, 0.55, -2.8, 0.8);                                                // o rack
    painel('fotos', 0, 1.5, v1 - 0.04, 4.0, 1.0, 2); painel('fotos', u0 + 0.04, 1.5, -4.2, 2.8, 0.7, 3);
    piso('tapete', -6.9, -3.5, -1.6, 1.6, 0.018, [0, 1, 0, 1]);                                      // o tapete
    for (const u of [1.6, 3.4]) { cadeira(u, -1.75, 0); cadeira(u, 1.75, PI); }
    box('branco', 6.8, 7.8, 0.95, 1.0, -5.4, 2.6); box('metal', 7.3, 7.7, 1.0, 1.06, -2, -1.4);
    box('fogao', 6.82, 7.78, 0.955, 1.0, -4.9, -4.1); for (const [x, z] of [[7.05, -4.7], [7.5, -4.7], [7.05, -4.3], [7.5, -4.3]]) cil('metalEsc', x, 1.005, z, 0.09, 0.01, 12);
    for (const [a2, b2] of [[-5.4, -2.75], [-0.45, 2.6]]) { box('branco', 7.45, 7.95, 1.75, 2.45, a2, b2); for (let v = a2; v < b2 - 0.3; v += 0.75) box('metal', 7.43, 7.45, 1.8, 2.0, v + 0.3, v + 0.34); }   // os armários de cima
    cil('vaso', 2.5, 0.8, 0, 0.08, 0.14, 12, 0.11); for (let k = 0; k < 5; k++) esf('folha2', 2.5 + (rnd() - 0.5) * 0.14, 0.95 + rnd() * 0.08, (rnd() - 0.5) * 0.14, 0.06);     // o vaso da mesa
    relogio(-1.8, 2.4, v1 - 0.04, 2);
    // o abajur ao lado do sofá
    cil('metalEsc', -2.8, 0.03, 2.7, 0.15, 0.04, 12); cil('metalEsc', -2.8, 0.75, 2.7, 0.015, 1.45, 6); cil('almofada', -2.8, 1.5, 2.7, 0.22, 0.3, 14, 0.14);
  }

  // ---------- monta as malhas ----------
  const SEM_SOMBRA = new Set(['sombra', 'sombraMovel', 'poca', 'pocaJanela', 'persiana', 'vista', 'vidro', 'luz', 'lampada', 'painel', 'saida', 'teto_placas', 'teto_liso', 'teto_cafe', 'tela', 'sanca']);
  const PAREDE = new Set(['parede_delegacia', 'parede_lab', 'parede_cafe', 'parede_jornal', 'parede_casa']);
  for (const [k, b] of Object.entries(B)) {
    if (!b.p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    g.setIndex(b.i); g.computeBoundingSphere(); geos.push(g);
    const mat = M[k];
    const m = new THREE.Mesh(g, mat); m.name = `int-${id}-${k}`;
    if (mat.transparent) m.renderOrder = k === 'vidro' ? 3 : 2;
    // no PC as lâmpadas do teto fazem sombra (o "sol" de dentro, jogo.js): os móveis projetam, o chão e as paredes recebem
    if (OPC.alta && !SEM_SOMBRA.has(k)) { m.receiveShadow = true; m.castShadow = !PAREDE.has(k) && !k.startsWith('piso_'); }
    grupo.add(m);
  }
  const deDia = (noite) => 1 - noite;
  return {
    grupo, geos,
    /** a janela mostra a rua de dia ou de noite; de dia entra luz por ela */
    atualizar(noite = 0) {
      const v = M.vista, t = noite > 0.5 ? v.userData.noite : v.userData.dia; if (v.map !== t) v.map = t;
      v.color.setScalar(0.8 + 0.2 * deDia(noite)); M.pocaJanela.opacity = 0.2 * deDia(noite); M.poca.opacity = 0.16 + 0.12 * noite;
    },
    dispose() { geos.forEach((g) => g.dispose()); },
  };
}
