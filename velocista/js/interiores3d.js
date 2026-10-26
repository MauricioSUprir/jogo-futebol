// O desenho dos INTERIORES dos lugares da cidade (interiores.js é o plano): paredes, piso, teto e luzes, os móveis por tipo
// e os detalhes de cada lugar (o quadro de evidências e o laboratório de perícia do Barry na Delegacia, o balcão e o
// cardápio do Jitters, os telões da redação do Picture News, as fotos e a cozinha da casa dos West). Geometria própria
// juntada por material (uma chamada por material); texturas de canvas feitas uma vez só. THREE passado por parâmetro.
// O grupo só aparece com o herói lá dentro (interiores3d não decide isso: o jogo liga grupo.visible).
import { INTERIORES, Y0, PE, PORTA_H, paredesDoInterior } from './interiores.js';

const PI = Math.PI;
const cacheTex = new Map(), cacheMat = new Map();
function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let sem = 7; const rnd = () => { sem = (sem * 1664525 + 1013904223) >>> 0; return sem / 4294967296; };
function textura(THREE, chave, w, h, pinta, repete = true) {
  if (cacheTex.has(chave)) return cacheTex.get(chave);
  const [c, g] = tela(w, h); pinta(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repete) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cacheTex.set(chave, t); return t;
}
const ruido = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } };
const texto = (g, s, x, y, px, cor, peso = 'bold', alinha = 'left') => { g.fillStyle = cor; g.font = `${peso} ${px}px Arial, Helvetica, sans-serif`; g.textAlign = alinha; g.textBaseline = 'middle'; g.fillText(s, x, y); };

// ---------- texturas ----------
function texturas(THREE) {
  const T = {};
  // paredes: a Delegacia (cinza-azulado com lambri escuro), o laboratório (azulejo branco), o Jitters (tijolo), a redação, a casa (papel de parede)
  T.parede_delegacia = textura(THREE, 'int-par-del', 512, 512, (g, w, h) => { g.fillStyle = '#9fb0bf'; g.fillRect(0, 0, w, h); g.fillStyle = '#3c4d5e'; g.fillRect(0, h * 0.7, w, h * 0.3); g.fillStyle = '#2c3a48'; g.fillRect(0, h * 0.69, w, 6); ruido(g, w, h, 3000, 0.05); });
  T.parede_lab = textura(THREE, 'int-par-lab', 512, 512, (g, w, h) => { g.fillStyle = '#eef3f6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,140,160,0.45)'; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } g.fillStyle = '#2f7fd0'; g.fillRect(0, h * 0.62, w, 10); });
  T.parede_cafe = textura(THREE, 'int-par-cafe', 512, 512, (g, w, h) => { g.fillStyle = '#5a2e22'; g.fillRect(0, 0, w, h); for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const s = 120 + Math.floor(rnd() * 40); g.fillStyle = `rgb(${s},${Math.floor(s * 0.5)},${Math.floor(s * 0.38)})`; g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); } ruido(g, w, h, 4000, 0.08); });
  T.parede_jornal = textura(THREE, 'int-par-jor', 512, 512, (g, w, h) => { g.fillStyle = '#d9dcdf'; g.fillRect(0, 0, w, h); g.fillStyle = '#c42b2b'; g.fillRect(0, h * 0.66, w, 8); ruido(g, w, h, 2500, 0.05); });
  T.parede_casa = textura(THREE, 'int-par-casa', 256, 256, (g, w, h) => { g.fillStyle = '#e8d9b8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(160,120,70,0.18)'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 32 + (y % 2) * 16 + 16, y * 32 + 16, 5, 0, 6.3); g.fill(); } g.fillStyle = '#8a6a48'; g.fillRect(0, h * 0.72, w, h * 0.28); });
  // pisos
  T.piso_granito = textura(THREE, 'int-piso-gra', 512, 512, (g, w, h) => { g.fillStyle = '#8c9096'; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const s = 130 + Math.floor(rnd() * 20); g.fillStyle = `rgb(${s},${s + 3},${s + 7})`; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124); } ruido(g, w, h, 9000, 0.12); });
  T.piso_lab = textura(THREE, 'int-piso-lab', 256, 256, (g, w, h) => { g.fillStyle = '#d7dde2'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(90,100,110,0.4)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } ruido(g, w, h, 2000, 0.05); });
  T.piso_madeira = textura(THREE, 'int-piso-mad', 512, 512, (g, w, h) => { for (let i = 0; i < 16; i++) { const s = 110 + Math.floor(rnd() * 40); g.fillStyle = `rgb(${s},${Math.floor(s * 0.66)},${Math.floor(s * 0.42)})`; g.fillRect(0, i * 32, w, 31); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(Math.floor(rnd() * w), i * 32, 3, 31); } ruido(g, w, h, 6000, 0.08); });
  T.piso_carpete = textura(THREE, 'int-piso-car', 256, 256, (g, w, h) => { g.fillStyle = '#3d4a5c'; g.fillRect(0, 0, w, h); ruido(g, w, h, 12000, 0.14); });
  T.teto = textura(THREE, 'int-teto', 512, 512, (g, w, h) => { g.fillStyle = '#e4e7ea'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,125,130,0.5)'; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } });
  // detalhes
  T.quadro = textura(THREE, 'int-quadro', 1024, 512, (g, w, h) => {
    g.fillStyle = '#a77b4f'; g.fillRect(0, 0, w, h); ruido(g, w, h, 9000, 0.15);
    const fotos = []; for (let i = 0; i < 9; i++) { const x = 60 + (i % 5) * 190 + rnd() * 30, y = 50 + Math.floor(i / 5) * 230 + rnd() * 30; fotos.push([x + 60, y + 70]); g.fillStyle = '#f1f1ee'; g.fillRect(x, y, 120, 150); g.fillStyle = ['#2b3442', '#5a4a3a', '#33433a'][i % 3]; g.fillRect(x + 8, y + 8, 104, 104); g.fillStyle = '#d9c9b0'; g.beginPath(); g.arc(x + 60, y + 50, 22, 0, 6.3); g.fill(); g.fillRect(x + 32, y + 72, 56, 40); texto(g, ['SUSPEITO', 'AMARELO?', 'NÚCLEO', 'TESTEMUNHA', '?', 'RAIO', 'FRIO', 'ZOOM', 'S.T.A.R.'][i], x + 60, y + 132, 15, '#111', 'bold', 'center'); g.fillStyle = '#d22'; g.beginPath(); g.arc(x + 60, y + 6, 6, 0, 6.3); g.fill(); }
    g.strokeStyle = '#d61f1f'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = fotos[i], b = fotos[(i * 3 + 2) % 9]; g.beginPath(); g.moveTo(a[0], a[1] - 60); g.lineTo(b[0], b[1] - 60); g.stroke(); }
  }, false);
  T.lousa = textura(THREE, 'int-lousa', 1024, 512, (g, w, h) => { g.fillStyle = '#f7f8f8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9aa'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    const linhas = ['E = ½ m v²', 'v ≈ 230 m/s ?!', 'raio + química = ?', 'Núcleo Aurora: 11 s', 'amostra 07: positiva', 'ACIDENTE NÃO FOI ACIDENTE']; linhas.forEach((s, i) => texto(g, s, 40, 60 + i * 72, 40, i === 5 ? '#c41e1e' : '#1d3d8f', 'bold')); g.strokeStyle = '#1d3d8f'; g.lineWidth = 4; g.beginPath(); g.ellipse(760, 330, 150, 90, 0, 0, 6.3); g.stroke(); }, false);
  T.menu = textura(THREE, 'int-menu', 1024, 512, (g, w, h) => { g.fillStyle = '#1b1d1c'; g.fillRect(0, 0, w, h); ruido(g, w, h, 8000, 0.1); texto(g, 'JITTERS', w / 2, 70, 76, '#f3e6c4', 'bold', 'center');
    [['Café coado', '6'], ['Expresso duplo', '8'], ['Cappuccino', '10'], ['O Relâmpago (6 doses)', '15'], ['Chocolate quente', '9'], ['Pão de queijo', '5']].forEach(([a, b], i) => { texto(g, a, 90, 170 + i * 52, 34, '#f0f0f0', '600'); texto(g, b, w - 90, 170 + i * 52, 34, '#ffd27a', 'bold', 'right'); }); }, false);
  T.noticias = textura(THREE, 'int-tv', 1024, 576, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d2e4f'); gr.addColorStop(1, '#0b1222'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c41e1e'; g.fillRect(0, h - 150, w, 70); texto(g, 'BORRÃO VERMELHO SALVA MAIS UM', 30, h - 115, 46, '#fff', 'bold'); g.fillStyle = '#ffffff'; g.fillRect(0, h - 80, w, 50); texto(g, 'PICTURE NEWS · AO VIVO · CENTRAL CITY', 30, h - 55, 30, '#111', 'bold');
    g.fillStyle = 'rgba(255,60,60,0.85)'; g.beginPath(); g.moveTo(520, 140); g.lineTo(470, 260); g.lineTo(520, 250); g.lineTo(480, 380); g.lineTo(600, 220); g.lineTo(545, 230); g.lineTo(590, 140); g.closePath(); g.fill(); }, false);
  T.fotos = textura(THREE, 'int-fotos', 1024, 256, (g, w, h) => { g.fillStyle = '#e8d9b8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) { const x = 20 + i * 200; g.fillStyle = '#4a3420'; g.fillRect(x, 30, 170, 200); g.fillStyle = ['#7aa0c8', '#c89a7a', '#8fb58a', '#c8b07a', '#9a8ac8'][i]; g.fillRect(x + 12, 42, 146, 176);
      for (let k = 0; k < (i % 3) + 1; k++) { const px = x + 40 + k * 45; g.fillStyle = '#4a3a30'; g.beginPath(); g.arc(px, 110, 16, 0, 6.3); g.fill(); g.fillRect(px - 18, 128, 36, 70); } } }, false);
  T.computador = textura(THREE, 'int-pc', 256, 160, (g, w, h) => { g.fillStyle = '#0d2236'; g.fillRect(0, 0, w, h); g.fillStyle = '#3fa8e0'; g.fillRect(0, 0, w, 18); for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(180,220,255,${0.4 + rnd() * 0.5})`; g.fillRect(14, 30 + i * 20, 60 + rnd() * 150, 8); } }, false);
  return T;
}

const DEF = {
  delegacia: { parede: 'parede_delegacia', piso: 'piso_granito', mesa: 'madeira' },
  cafe: { parede: 'parede_cafe', piso: 'piso_madeira', mesa: 'madeiraEsc' },
  jornal: { parede: 'parede_jornal', piso: 'piso_carpete', mesa: 'branco' },
  casa: { parede: 'parede_casa', piso: 'piso_madeira', mesa: 'madeira' },
};

function materiais(THREE, T) {
  if (cacheMat.has('mats')) return cacheMat.get('mats');
  const M = {};
  const std = (k, o) => { M[k] = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, ...o }); };
  for (const k of ['parede_delegacia', 'parede_lab', 'parede_cafe', 'parede_jornal', 'parede_casa', 'piso_granito', 'piso_lab', 'piso_madeira', 'piso_carpete']) std(k, { map: T[k], emissive: 0xffffff, emissiveMap: T[k], emissiveIntensity: 0.12 });
  std('teto', { map: T.teto, emissive: 0xffffff, emissiveMap: T.teto, emissiveIntensity: 0.2 });
  std('madeira', { color: 0x8a5a34, roughness: 0.6 }); std('madeiraEsc', { color: 0x4a2c1a, roughness: 0.55 });
  std('branco', { color: 0xe9ecef, roughness: 0.5 }); std('metal', { color: 0xaab2ba, roughness: 0.35, metalness: 0.75 }); std('metalEsc', { color: 0x2a2f36, roughness: 0.5, metalness: 0.5 });
  std('tecido', { color: 0x6b2a2a, roughness: 0.95 }); std('tecido2', { color: 0x3b5a7a, roughness: 0.95 }); std('couro', { color: 0x1c1c1f, roughness: 0.6 });
  std('verde', { color: 0x2f6e3e, roughness: 0.9 }); std('porta', { color: 0x3a2618, roughness: 0.6 });
  M.vidro = new THREE.MeshStandardMaterial({ color: 0x9cc8e8, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  M.luz = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
  M.tela = new THREE.MeshBasicMaterial({ map: T.computador });
  for (const k of ['quadro', 'lousa', 'menu', 'noticias', 'fotos']) M[k] = new THREE.MeshStandardMaterial({ map: T[k], roughness: 0.7, emissive: 0xffffff, emissiveMap: T[k], emissiveIntensity: k === 'noticias' ? 0.9 : 0.15 });
  M.saida = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  cacheMat.set('mats', M); return M;
}

/** Constrói o interior `id` do lugar no quarteirão de centro (cx, cz). Devolve {grupo, geos, atualizar(noite)}. */
export function construirInterior(THREE, id, cx, cz) {
  const I = INTERIORES[id], D = DEF[id], T = texturas(THREE), M = materiais(THREE, T);
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
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    quad(k, [x1, y0, z1], [0, 0, -1], [0, 1, 0], dz, dy, tile); quad(k, [x0, y0, z0], [0, 0, 1], [0, 1, 0], dz, dy, tile);
    quad(k, [x0, y1, z1], [1, 0, 0], [0, 0, -1], dx, dz, tile); quad(k, [x0, y0, z0], [1, 0, 0], [0, 0, 1], dx, dz, tile);
    quad(k, [x0, y0, z1], [1, 0, 0], [0, 1, 0], dx, dy, tile); quad(k, [x1, y0, z0], [-1, 0, 0], [0, 1, 0], dx, dy, tile);
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3(1, 1, 1), n3 = new THREE.Matrix3(), t3 = new THREE.Vector3();
  function prim(k, geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    const b = bk(k), base = b.p.length / 3;
    e4.set(rx, ry, rz); q4.setFromEuler(e4); v4.set(x, y, z); m4.compose(v4, q4, s4); n3.getNormalMatrix(m4);
    const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
    for (let i = 0; i < pa.count; i++) { t3.fromBufferAttribute(pa, i).applyMatrix4(m4); b.p.push(t3.x, t3.y, t3.z); t3.fromBufferAttribute(na, i).applyMatrix3(n3).normalize(); b.n.push(t3.x, t3.y, t3.z); b.u.push(ua ? ua.getX(i) : 0, ua ? ua.getY(i) : 0); }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) b.i.push(base + geo.index.getX(i)); else for (let i = 0; i < pa.count; i++) b.i.push(base + i);
    geo.dispose();
  }
  const cil = (k, x, y, z, r, h, seg = 14, r2 = r) => prim(k, new THREE.CylinderGeometry(r2, r, h, seg), x, y, z);
  const esf = (k, x, y, z, r) => prim(k, new THREE.IcosahedronGeometry(r, 1), x, y, z);
  // um quadro/tela plano na parede: de frente para dir (0: +v, 1: −u, 2: −v, 3: +u)
  const painel = (k, u, y, v, w, h, dir) => {
    const R = [0, 1, 0, 1];
    if (dir === 0) quad(k, [u - w / 2, y, v], [1, 0, 0], [0, 1, 0], w, h, 1, 1, R);
    else if (dir === 2) quad(k, [u + w / 2, y, v], [-1, 0, 0], [0, 1, 0], w, h, 1, 1, R);
    else if (dir === 3) quad(k, [u, y, v + w / 2], [0, 0, -1], [0, 1, 0], w, h, 1, 1, R);
    else quad(k, [u, y, v - w / 2], [0, 0, 1], [0, 1, 0], w, h, 1, 1, R);
  };
  const [u0, u1, v0, v1] = I.sala, H = I.teto;

  // ---------- paredes, piso, teto e luzes ----------
  const corParede = (p) => (id === 'delegacia' && p.id !== 'frente' && p.id !== 'oeste' && p.id !== 'fundo' && p.eixo === 'z' && p.c === 4 ? 'parede_lab' : D.parede);
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
        cursor = b;
      }
      caixa(cursor, s1, 0, H);
    }
    for (const [s0, s1] of vaos) { caixa(s0, s1, PORTA_H, H); caixa(s0 - 0.08, s0, 0, PORTA_H, 'metalEsc'); caixa(s1, s1 + 0.08, 0, PORTA_H, 'metalEsc'); }
  }
  // a porta de saída (fechada, do lado de fora do vão) e a placa SAÍDA em cima
  { const [p0, p1] = I.porta, vp = v0 - PE - 0.04;
    box('porta', p0, p1, 0, PORTA_H, vp - 0.06, vp); box('metal', p0 + 0.2, p0 + 0.35, 1.0, 1.1, vp + 0.0, vp + 0.06);
    box('saida', -0.45, 0.45, PORTA_H + 0.12, PORTA_H + 0.38, v0 + 0.01, v0 + 0.04); }
  const pisoK = D.piso;
  quad(pisoK, [u0, 0.01, v1], [1, 0, 0], [0, 0, -1], u1 - u0, v1 - v0, 3);
  quad('teto', [u0, H, v0], [1, 0, 0], [0, 0, 1], u1 - u0, v1 - v0, 4);
  for (let u = u0 + 3; u < u1 - 1; u += 5) for (let v = v0 + 3; v < v1 - 1; v += 5) box('luz', u - 0.6, u + 0.6, H - 0.04, H - 0.01, v - 0.6, v + 0.6);
  // rodapé escuro
  for (const [a, b, c, eixo] of [[u0, u1, v0 + 0.02, 'x'], [u0, u1, v1 - 0.06, 'x'], [v0, v1, u0 + 0.02, 'z'], [v0, v1, u1 - 0.06, 'z']]) { if (eixo === 'x') box('madeiraEsc', a, b, 0, 0.12, c, c + 0.04); else box('madeiraEsc', c, c + 0.04, 0, 0.12, a, b); }

  // ---------- os móveis por tipo ----------
  const cadeira = (u, v, rumo) => { const c = Math.cos(rumo), s = Math.sin(rumo); box('couro', u - 0.24, u + 0.24, 0.42, 0.5, v - 0.24, v + 0.24); box('couro', u - 0.24 * c - 0.22 * s - 0.03, u - 0.24 * c - 0.22 * s + 0.03 + 0.0, 0.5, 1.0, v - 0.24 * s + 0.22 * c - 0.2, v - 0.24 * s + 0.22 * c + 0.2); cil('metalEsc', u, 0.21, v, 0.04, 0.42, 6); };
  for (const [a, b, c, d, h, tipo] of I.moveis) {
    const um = (a + b) / 2, vm = (c + d) / 2;
    if (tipo === 'mesa') {
      box(D.mesa, a, b, h - 0.05, h, c, d); for (const [x, z] of [[a + 0.05, c + 0.05], [b - 0.1, c + 0.05], [a + 0.05, d - 0.1], [b - 0.1, d - 0.1]]) box('metalEsc', x, x + 0.05, 0, h - 0.05, z, z + 0.05);
      box('metalEsc', um - 0.32, um + 0.32, h, h + 0.42, d - 0.12, d - 0.08); quad('tela', [um + 0.3, h + 0.03, d - 0.125], [-1, 0, 0], [0, 1, 0], 0.6, 0.36, 1, 1, [0, 1, 0, 1]);
      box('metalEsc', um - 0.25, um + 0.25, h, h + 0.02, vm - 0.12, vm + 0.04); cadeira(um, c - 0.45, 0);
    } else if (tipo === 'balcao') {
      box(id === 'cafe' ? 'madeiraEsc' : 'madeira', a, b, 0, h - 0.06, c, d); box(id === 'cafe' ? 'branco' : 'metalEsc', a - 0.05, b + 0.05, h - 0.06, h, c - 0.08, d + 0.05);
      if (id === 'cafe') { box('metal', a + 0.6, a + 1.4, h, h + 0.55, c + 0.1, d - 0.2); cil('metalEsc', a + 0.8, h + 0.6, c + 0.4, 0.06, 0.1, 8); box('vidro', b - 2.6, b - 0.6, h, h + 0.5, c + 0.05, d - 0.05); for (let k = 0; k < 6; k++) esf('madeira', b - 2.4 + k * 0.3, h + 0.08, vm, 0.08); }
      else { box('metalEsc', um - 0.3, um + 0.3, h, h + 0.4, d - 0.15, d - 0.1); quad('tela', [um + 0.28, h + 0.03, d - 0.155], [-1, 0, 0], [0, 1, 0], 0.56, 0.34, 1, 1, [0, 1, 0, 1]); }
    } else if (tipo === 'bancada') {
      box('branco', a, b, h - 0.05, h, c, d); box('metalEsc', a + 0.05, b - 0.05, 0, h - 0.05, c + 0.05, d - 0.05);
      for (let x = a + 0.6; x < b - 0.4; x += 1.1) { cil('vidro', x, h + 0.12, vm + (rnd() - 0.5) * 0.3, 0.05, 0.24, 8); if (rnd() < 0.5) cil('metal', x + 0.4, h + 0.06, vm, 0.08, 0.12, 8); }
      if (b - a < 6) { cil('metalEsc', um, h + 0.2, vm, 0.12, 0.4, 10); cil('metal', um + 0.05, h + 0.5, vm, 0.03, 0.3, 6); box('metalEsc', um - 0.2, um + 0.2, h, h + 0.05, vm - 0.2, vm + 0.2); }
    } else if (tipo === 'estante') {
      box('madeiraEsc', a, b, 0, h, c, d);
      const ladoX = b - a < d - c;
      for (let y = 0.35; y < h - 0.2; y += 0.55) for (let s = 0.1; s < (ladoX ? d - c : b - a) - 0.3; s += 0.24 + rnd() * 0.2) {
        const hh = 0.2 + rnd() * 0.25, k = ['tecido', 'tecido2', 'branco', 'madeira'][Math.floor(rnd() * 4)];
        if (ladoX) box(k, a - 0.12, a + 0.02, y, y + hh, c + s, c + s + 0.16); else box(k, a + s, a + s + 0.16, y, y + hh, c - 0.12, c + 0.02);
      }
    } else if (tipo === 'mesaRedonda') {
      cil('madeiraEsc', um, h - 0.03, vm, 0.45, 0.06, 20); cil('metalEsc', um, h / 2, vm, 0.05, h, 8); cil('metalEsc', um, 0.02, vm, 0.25, 0.04, 14);
      cadeira(um, vm - 0.75, 0); cadeira(um, vm + 0.75, PI); cil('branco', um + 0.12, h + 0.05, vm, 0.05, 0.1, 10);
    } else if (tipo === 'sofa') {
      const k = id === 'casa' ? 'tecido2' : 'tecido';
      box(k, a, b, 0.1, 0.45, c, d); const fundoV = d - c > b - a; if (fundoV) box(k, b - 0.25, b, 0.45, h + 0.1, c, d); else box(k, a, b, 0.45, h + 0.1, d - 0.25, d);
      box(k, a, a + 0.2, 0.45, 0.65, c, d); box(k, b - 0.2, b, 0.45, 0.65, c, d);
    } else if (tipo === 'mesinha') { box('madeira', a, b, h - 0.05, h, c, d); box('madeiraEsc', a + 0.1, b - 0.1, 0, h - 0.05, c + 0.1, d - 0.1); }
    else if (tipo === 'geladeira') { box('branco', a, b, 0, h, c, d); box('metal', a - 0.02, a, 0.9, 1.6, c + 0.2, c + 0.25); }
    else if (tipo === 'escada') { const n = 10; for (let k = 0; k < n; k++) box('madeira', a, b, 0, ((k + 1) / n) * h, c + (k / n) * (d - c), c + ((k + 1) / n) * (d - c)); }
  }

  // ---------- os detalhes de cada lugar ----------
  if (id === 'delegacia') {
    painel('quadro', u0 + 0.03, 1.2, -1.8, 4.6, 2.3, 3);                         // o quadro de evidências (parede oeste)
    painel('lousa', 9.5, 1.1, v1 - 0.03, 4.4, 2.2, 2);                           // a lousa do laboratório da perícia
    box('vidro', 8, 12, H - 0.02, H, -3, 3);                                     // a claraboia (por onde o raio entrou)
    for (const u of [-12.5, -6.5, 0]) painel('fotos', u, 2.4, v1 - 0.03, 2.6, 0.65, 2);
    box('metalEsc', -14.95, -14.6, 0, 2.2, 6, 10.6);                             // arquivo do Joe
    cil('verde', -3.4, 0.5, -10.2, 0.3, 1.0, 10); esf('verde', -3.4, 1.3, -10.2, 0.55);
  } else if (id === 'cafe') {
    painel('menu', -2, 2.3, v1 - 0.04, 5.2, 2.6, 2);
    for (const [u, v] of [[-6.5, -2.5], [-2.5, -4.2], [2, -2.4], [6.5, -4.4], [6.4, 0.6]]) { cil('metalEsc', u, H - 0.5, v, 0.012, 1.0, 4); cil('luz', u, H - 1.05, v, 0.22, 0.14, 12, 0.08); }
    for (const v of [-4, 0, 4]) painel('fotos', u1 - 0.04, 2.0, v, 2.4, 0.6, 1);
    box('verde', u0 + 0.1, u0 + 0.6, 0, 1.2, v1 - 1.2, v1 - 0.2);
  } else if (id === 'jornal') {
    for (const v of [-6, 0]) painel('noticias', u0 + 0.04, 1.5, v, 4.6, 2.6, 3);
    painel('noticias', 0, 2.2, v1 - 0.04, 5.2, 2.0, 2);
    for (let u = -12; u <= 4; u += 4) painel('fotos', u, 3.1, v0 + 0.04, 3.2, 0.8, 0);
    box('metalEsc', 12.4, 13.4, 0, 1.1, -9.6, -8.6);
  } else if (id === 'casa') {
    box('metalEsc', -7.7, -7.6, 1.0, 1.8, -2.6, 0.6); painel('noticias', -7.58, 1.05, -1, 3.0, 0.72, 3);   // a TV
    painel('fotos', 0, 1.5, v1 - 0.04, 4.0, 1.0, 2); painel('fotos', u0 + 0.04, 1.5, -4.2, 2.8, 0.7, 3);
    box('tecido', -6.6, -3.8, 0.011, 0.02, -1.4, 1.4);                            // o tapete
    for (const u of [1.6, 3.4]) { cadeira(u, -1.75, 0); cadeira(u, 1.75, PI); }
    box('branco', 6.8, 7.8, 0.95, 1.0, -5.4, 2.6); box('metal', 7.3, 7.7, 1.0, 1.06, -2, -1.4);
  }

  // ---------- monta as malhas ----------
  for (const [k, b] of Object.entries(B)) {
    if (!b.p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    g.setIndex(b.i); g.computeBoundingSphere(); geos.push(g);
    const m = new THREE.Mesh(g, M[k]); m.name = `int-${id}-${k}`; if (M[k].transparent) m.renderOrder = 2; grupo.add(m);
  }
  const emis = ['parede_delegacia', 'parede_lab', 'parede_cafe', 'parede_jornal', 'parede_casa', 'piso_granito', 'piso_lab', 'piso_madeira', 'piso_carpete', 'teto'];
  return {
    grupo, geos,
    /** à noite as luzes de dentro seguram a sala (as paredes acendem um pouco mais) */
    atualizar(noite = 0) { for (const k of emis) M[k].emissiveIntensity = (k === 'teto' ? 0.25 : 0.14) + 0.35 * noite; },
    dispose() { geos.forEach((g) => g.dispose()); },
  };
}
