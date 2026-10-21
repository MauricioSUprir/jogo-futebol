// Desenho do estádio com FORMA PRÓPRIA (three.js; sob demanda: só na edição pro do Total Match com um estádio da base
// que tem `forma` — hoje o Maracanã; render/identidade-pagina.js baixa este módulo e estadio-planta.js). As contas
// (onde fica cada fileira, a cobertura, a fachada, as rampas, o entorno) são as da planta (estadio-planta.js, pura):
// o desenho, a torcida, os sólidos da câmera e os trilhos do pré-jogo usam as MESMAS. Só desenho: a simulação não muda.
//
// O jogo (render/campo.js criarCampo → criarTigela): a tigela em 3 malhas com os MESMOS nomes de hoje (o lado de lá,
// os fundos com o piso azul em volta das placas, o lado de cá com o túnel e os bancos — sai do desenho com a câmera
// de TV dentro dele, como antes) e a cobertura (a membrana branca por cima e creme translúcida por baixo, as 60
// nervuras e o zigue-zague dos losangos; a passarela técnica, os mastros, os cabos e os 4 telões). Sem torres de
// refletor: a luz fica na borda de dentro da cobertura.
// O pré-jogo (render/estadio-fora.js criarEstadioFora → criarForaForma): a fachada de 1950 (60 costelas em gancho,
// as lajes, o colar de almofadas brancas, o vão até a cobertura), as 2 rampas retas sobre pilares com os pórticos
// "ESTÁDIO MÁRIO FILHO", e o entorno (esplanada com palmeiras, Maracanãzinho, Bellini, parque aquático, trilhos e o
// metrô elevado, o Morro da Mangueira, a Tijuca e o maciço com o Cristo no Corcovado).
// Orçamento: no jogo as mesmas 5 chamadas de antes (3 da tigela + 2 da cobertura no lugar das 2 das torres; à noite −4
// brilhos); no pré-jogo ≤ 13 peças de fora (como antes).
import * as THREE from 'three';
import { ESTADIO } from '../config.js';
import { criarCanvas, texturaCanvas, gerador } from './util.js';
import { GRAMA } from './texturas.js';
import { definirForma } from '../estadio-forma.js';
import { definirLadoDeCa } from './torcida-dados.js';
import { definirFormaBandeiras } from './bandeiras-dados.js';
import { PONTOS_SINALIZADOR } from './festa.js';
import { CAMERA_GERAL } from './camera.js';

const RAD = Math.PI / 180;
const cor = h => new THREE.Color(h);
const BRANCO = cor(0xffffff);

/** Liga a forma nos módulos do desenho que já estão carregados (sólidos, lado de cá, festa, plano geral). */
export function ligarForma(P) {
  definirForma(P);
  definirLadoDeCa(P.cameraNoLadoDeCa);
  definirFormaBandeiras(P);
  const s = P.sinalizadores();
  for (const k of ['organizada', 'quinas', 'visitante']) s[k].forEach((p, i) => { if (PONTOS_SINALIZADOR[k][i]) PONTOS_SINALIZADOR[k][i].splice(0, 3, ...p); });
  const G = P.cameraGeral;
  CAMERA_GERAL.de.splice(0, 3, ...G.de); CAMERA_GERAL.para.splice(0, 3, ...G.para); CAMERA_GERAL.fov = G.fov;
}

// ------------------------------------------------------------------ construtor de malha indexada (posição, uv, cor)
function malha(alfa = false) {
  const pos = [], uv = [], cr = [], idx = [];
  let n = 0, a = 1;
  return {
    v(x, y, z, u = 0, w = 0, c = BRANCO) { pos.push(x, y, z); uv.push(u, w); cr.push(c.r, c.g, c.b); if (alfa) cr.push(a); return n++; },
    /** Opacidade dos próximos vértices (só com alfa: o material usa alphaHash, sem ordenar nem chamada a mais). */
    set alfa(v) { a = v; },
    tri(a, b, c) { idx.push(a, b, c); },
    quad(a, b, c, d) { idx.push(a, b, c, a, c, d); },
    /** Quadrilátero solto (vértices próprios: aresta viva). */
    q4(p0, p1, p2, p3, c = BRANCO, uvs = null) {
      const a = this.v(...p0, ...(uvs ? uvs[0] : [0.7, 0.005]), c), b = this.v(...p1, ...(uvs ? uvs[1] : [0.75, 0.005]), c);
      const d = this.v(...p2, ...(uvs ? uvs[2] : [0.75, 0.008]), c), e = this.v(...p3, ...(uvs ? uvs[3] : [0.7, 0.008]), c);
      this.quad(a, b, d, e);
    },
    /** Caixa alinhada a um rumo h (cx, cy, cz no centro; w ao longo do rumo, a na altura, d de lado). */
    caixa(cx, cy, cz, w, a, d, h, c, faces = 6) {
      const ch = Math.cos(h), sh = Math.sin(h);
      const P = (i, j, k) => [cx + ch * i * w / 2 - sh * k * d / 2, cy + j * a / 2, cz + sh * i * w / 2 + ch * k * d / 2];
      const F = [[[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
        [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
        [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]];
      for (let f = 0; f < faces; f++) this.q4(...F[f].map(p => P(...p)), c);
    },
    /** Cilindro de lados retos (n lados) de (x, y0, z) a y1, raio r. */
    coluna(x, y0, z, y1, r, c, n = 6) {
      for (let i = 0; i < n; i++) {
        const a0 = (2 * Math.PI * i) / n, a1 = (2 * Math.PI * (i + 1)) / n;
        const p = (a, y) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
        this.q4(p(a0, y0), p(a1, y0), p(a1, y1), p(a0, y1), c);
      }
    },
    geo() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cr, alfa ? 4 : 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    },
    get n() { return n; },
  };
}

// ------------------------------------------------------------------ texturas
/**
 * Cadeiras da tigela: uma fatia de 12° (2 corredores radiais) × o perfil inteiro (v: a mureta, as 24 fileiras de baixo,
 * o vidro dos camarotes, a laje, as ~60 fileiras de cima e o parapeito). Mosaico "pontilhado" de amarelo, azul e branco
 * (mais amarelo e branco embaixo, mais azul em cima). v < 0,012 é branco puro: retalho para as peças por cor de vértice.
 */
function texCadeiras(P, q, aniso) {
  const W = q === 'baixa' ? 256 : 512, H = q === 'baixa' ? 512 : 1024;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  const yPx = v => (1 - v) * H;
  const r = gerador(160216);
  const [AM, AZ, BR] = P.forma.cadeiras.length >= 3 ? P.forma.cadeiras : [P.forma.cadeiras[0], P.forma.cadeiras[1], '#e9e9e4'];
  const escolhe = (pesos) => { const x = r(); return x < pesos[0] ? AM : x < pesos[0] + pesos[1] ? AZ : BR; };
  g.fillStyle = '#ffffff'; g.fillRect(0, yPx(0.012), W, H - yPx(0.012));
  // mureta (concreto) e o parapeito de cima
  g.fillStyle = '#9d9c97'; g.fillRect(0, yPx(0.04), W, yPx(0.012) - yPx(0.04));
  g.fillStyle = '#c8c6c0'; g.fillRect(0, yPx(0.04), W, 3);
  g.fillStyle = '#b8b6af'; g.fillRect(0, 0, W, yPx(0.97));
  g.fillStyle = '#8d8b85'; g.fillRect(0, yPx(0.97) - 2, W, 2);
  // camarotes (vidro escuro com caixilhos) e a laje
  // (rodada 1: uma LINHA fina de vidro entre os anéis, não uma faixa escura grossa — a bacia é contínua)
  const gv = g.createLinearGradient(0, yPx(0.40), 0, yPx(0.36));
  gv.addColorStop(0, '#5d6a74'); gv.addColorStop(1, '#3a454e');
  g.fillStyle = gv; g.fillRect(0, yPx(0.40), W, yPx(0.36) - yPx(0.40));
  g.fillStyle = '#8d979f';
  for (let x = 0; x < W; x += W / 24) g.fillRect(x, yPx(0.40), 1.5, yPx(0.36) - yPx(0.40));
  g.fillStyle = '#dedcd5'; g.fillRect(0, yPx(0.42), W, yPx(0.40) - yPx(0.42));
  // fileiras: [v0, v1, n, pesos (amarelo, azul, branco)]
  const tiers = [[0.04, 0.36, 24, [0.46, 0.24, 0.30]], [0.42, 0.97, 60, [0.27, 0.52, 0.21]]];
  const corr = P.forma.corredorU / 2;   // a textura tem 2 fatias: corredor no começo de cada uma
  for (const [v0, v1, n, pesos] of tiers) {
    const hRow = (yPx(v0) - yPx(v1)) / n;
    for (let k = 0; k < n; k++) {
      const yb = yPx(v0) - k * hRow;           // base da fileira k (da frente para trás)
      g.fillStyle = '#5e5d59'; g.fillRect(0, yb - hRow, W, hRow);   // o degrau (espelho na sombra)
      g.fillStyle = '#8c8a84'; g.fillRect(0, yb - hRow * 0.32, W, hRow * 0.32);  // o piso do degrau
      for (const lado of [0, 0.5]) {
        const x0 = (lado + corr) * W, x1 = (lado + 0.5) * W, nS = 16, w = (x1 - x0) / nS;
        for (let s = 0; s < nS; s++) {
          g.fillStyle = escolhe(pesos);
          // a cadeira ocupa quase a fileira toda (de longe o mosaico amarelo/azul/branco aparece; o degrau cinza não o apaga)
          g.fillRect(x0 + s * w + w * 0.06, yb - hRow * 0.96, w * 0.88, hRow * 0.78);
          g.fillStyle = 'rgba(0,0,0,0.16)';
          g.fillRect(x0 + s * w + w * 0.06, yb - hRow * 0.26, w * 0.88, hRow * 0.08);
        }
      }
    }
    // corredores (escada de concreto)
    for (const lado of [0, 0.5]) {
      // as escadas radiais escuras (os "raios" da bacia no panorama de 2021)
      g.fillStyle = '#5c5b57'; g.fillRect(lado * W, yPx(v1), corr * W, yPx(v0) - yPx(v1));
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 2 * n; k++) g.fillRect(lado * W, yPx(v0) - k * (yPx(v0) - yPx(v1)) / (2 * n), corr * W, 1);
    }
  }
  const t = texturaCanvas(c, { aniso, repetir: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Membrana da cobertura, uma baia (6°): u 0 = a nervura (eixo), 0,5 = o cabo de vale; v 0 = a borda de fora. */
function texCobertura(P, emissiva) {
  const W = 128, H = 512;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  const y = v => (1 - v) * H;
  const vm = P.uMastro;
  if (!emissiva) {
    const gr = g.createLinearGradient(0, y(0), 0, y(1));
    gr.addColorStop(0, '#f1f1ed'); gr.addColorStop(1, '#fbfbf8');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // costuras dos painéis em losango (deltoide): da nervura na linha dos mastros ao vale nas duas bordas
    g.strokeStyle = 'rgba(120,124,126,0.55)'; g.lineWidth = 1.2;
    const linha = (u0, v0, u1, v1) => { g.beginPath(); g.moveTo(u0 * W, y(v0)); g.lineTo(u1 * W, y(v1)); g.stroke(); };
    for (const u of [0, 1]) { linha(u, vm, 0.5, 0.06); linha(u, vm, 0.5, 0.995); }
    // as nervuras (o cabo de cada eixo; por baixo são os "raios" escuros da ref-07) e o cabo de vale
    g.strokeStyle = 'rgba(112,116,120,0.9)'; g.lineWidth = 3.5;
    linha(0, 0, 0, 1); linha(1, 0, 1, 1);
    g.strokeStyle = 'rgba(150,154,156,0.7)'; g.lineWidth = 2;
    linha(0.5, 0.05, 0.5, 1);
    // o nó escuro do mastro (o "colar" na linha dos mastros)
    g.fillStyle = '#3b4146'; g.beginPath(); g.arc(1, y(vm), 4.5, 0, 2 * Math.PI); g.arc(0, y(vm), 4.5, 0, 2 * Math.PI); g.fill();
    // painéis solares (azul-marinho) na borda de fora e o anel de compressão cinza
    g.fillStyle = '#1f2b45'; g.fillRect(0, y(0.05), W, y(0.012) - y(0.05));
    g.fillStyle = 'rgba(160,170,190,0.45)';
    for (let x = 0; x < W; x += 8) g.fillRect(x, y(0.05), 1, y(0.012) - y(0.05));
    g.fillStyle = '#b9bdc0'; g.fillRect(0, y(0.012), W, H - y(0.012));
    // a borda de dentro: o cabo e a fileira de refletores
    // a borda de dentro: a treliça escura do anel de tração com a fileira contínua de refletores
    g.fillStyle = '#4a5056'; g.fillRect(0, 0, W, y(0.978));
    g.fillStyle = '#f4f6f8'; for (let x = 2; x < W; x += 8) g.fillRect(x, 2, 5, 5);
  } else {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff6e0'; for (let x = 3; x < W; x += 10) g.fillRect(x, 0, 6, 5);
  }
  const t = texturaCanvas(c, { aniso: 4, repetir: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/**
 * Atlas das letras (2048 × 256): em cima o letreiro dos pórticos (letras de forma azul-marinho, espaçadas, na faixa branca);
 * embaixo as 4 placas amarelas dos acessos ("ACESSO NORTE E", "ACESSO SUL C", "ACESSO LESTE D", "ACESSO OESTE A"; ref-04).
 */
const PLACAS_ACESSO = ['ACESSO NORTE  E', 'ACESSO SUL  C', 'ACESSO LESTE  D', 'ACESSO OESTE  A'];
function texLetreiro(texto) {
  const W = 2048, H = 256, h = 128;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#eeebe4'; g.fillRect(0, 0, W, h);
  g.fillStyle = '#1e2f5e';
  g.font = '700 80px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  g.textBaseline = 'middle';
  const letras = [...texto], esp = 26, tot = letras.reduce((s2, l) => s2 + g.measureText(l).width + esp, -esp);
  const k = Math.min(1, (W * 0.86) / tot);
  g.save(); g.translate(W / 2, h / 2 + 3); g.scale(k, 1);
  let x = -tot / 2;
  g.textAlign = 'left';
  for (const l of letras) { g.fillText(l, x, 0); x += g.measureText(l).width + esp; }
  g.restore();
  PLACAS_ACESSO.forEach((t, i) => {
    const x0 = i * 512;
    g.fillStyle = '#f2c21b'; g.fillRect(x0, h, 512, h);
    g.fillStyle = '#d9a90e'; g.fillRect(x0, h, 512, 6); g.fillRect(x0, H - 6, 512, 6);
    g.fillStyle = '#2a2a2a'; g.font = '800 58px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(t).width, kk = Math.min(1, 470 / w);
    g.save(); g.translate(x0 + 256, h + h / 2 + 2); g.scale(kk, 1); g.fillText(t, 0, 0); g.restore();
  });
  return texturaCanvas(c, { aniso: 4 });
}

// o sol do dia (render/cena.js HORAS.dia solDir): a sombra de um ponto a h m de altura cai SOMBRA·h m no chão
const SOL = (() => { const v = [-0.42, 0.74, 0.52], l = Math.hypot(...v); return v.map(c => c / l); })();
const SOMBRA = [-SOL[0] / SOL[1], -SOL[2] / SOL[1]];

/**
 * A esplanada do Maracanã (±M m): concreto CINZA com as juntas e o asfalto (rodada 1: "piso cinza, não bege"), praças e
 * gramados com as palmeiras, a praça do Bellini, o parque aquático (a piscina azul ao ar livre), a pista vermelha do
 * Célio de Barros, os trilhos com a Av. Radial Oeste, e as SOMBRAS do sol duro do Rio pintadas no chão (a fachada, as
 * rampas, os pórticos, o Maracanãzinho, as palmeiras).
 */
function texEsplanada(P, S, aniso) {
  const M = P.entorno.esplanada, k = S / (2 * M), E = P.entorno;
  const c = criarCanvas(S, S), g = c.getContext('2d');
  const px = x => (x + M) * k, pz = z => (z + M) * k;
  const ret = (x0, z0, x1, z1) => g.fillRect(px(x0), pz(z0), (x1 - x0) * k, (z1 - z0) * k);
  const circ = (x, z, r) => { g.beginPath(); g.arc(px(x), pz(z), r * k, 0, 2 * Math.PI); g.fill(); };
  const elip = (x, z, a, b) => { g.beginPath(); g.ellipse(px(x), pz(z), a * k, b * k, 0, 0, 2 * Math.PI); g.fill(); };
  g.fillStyle = '#a19f9a'; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let v = -M; v <= M; v += 6) { g.fillRect(px(v), 0, Math.max(1, 0.12 * k), S); g.fillRect(0, pz(v), S, Math.max(1, 0.12 * k)); }
  // o anel de circulação em volta da fachada (concreto mais claro, 14 m)
  g.fillStyle = '#b3b1ab'; elip(0, 0, P.forma.fachada.a + 16, P.forma.fachada.b + 16);
  // gramados e canteiros (com as palmeiras) e o verde em volta do Maracanãzinho
  g.fillStyle = '#5b8743';
  const Mz = E.maracanazinho;
  circ(Mz.x, Mz.z, Mz.r + 18);
  for (const [x0, z0, x1, z1] of E.gramados) ret(x0, z0, x1, z1);
  // as vias de serviço da esplanada (asfalto) até o anel de circulação
  g.fillStyle = '#56595b';
  ret(-M, -8, -P.forma.fachada.a - 14, 8); ret(P.forma.fachada.a + 14, -8, M, 8);
  // calçada do Maracanãzinho, praça do Bellini (pedra clara) e a calçada dos pórticos
  g.fillStyle = '#b8b5ad'; circ(Mz.x, Mz.z, Mz.r + 6);
  g.fillStyle = '#c4c0b6'; circ(E.bellini.x, E.bellini.z, 34);
  ret(-40, 238, 40, 300); ret(-40, -300, 40, -238);
  // parque aquático Júlio Delamare: a piscina olímpica ao ar livre (azul) com o deque claro
  const Aq = E.aquatico;
  g.fillStyle = '#d9d6cd'; ret(Aq.x + 6, Aq.z - 22, Aq.x + 70, Aq.z + 22);
  g.fillStyle = '#2f8fd0'; ret(Aq.x + 14, Aq.z - 12.5, Aq.x + 64, Aq.z + 12.5);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let l = 1; l < 10; l++) ret(Aq.x + 15, Aq.z - 12.5 + l * 2.5 - 0.06, Aq.x + 63, Aq.z - 12.5 + l * 2.5 + 0.06);
  // Célio de Barros: a pista vermelha de 8 raias com o gramado no meio
  const Ce = E.celio;
  g.fillStyle = '#b2483a'; elip(Ce.x, Ce.z, Ce.a, Ce.b);
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = Math.max(1, 0.1 * k);
  for (let l = 0; l <= 8; l++) { g.beginPath(); g.ellipse(px(Ce.x), pz(Ce.z), (Ce.a - 1.22 * l) * k, (Ce.b - 1.22 * l) * k, 0, 0, 2 * Math.PI); g.stroke(); }
  g.fillStyle = '#4f8a3c'; elip(Ce.x, Ce.z, Ce.a - 10.5, Ce.b - 10.5);
  // avenida em volta (asfalto) e o rio Maracanã canalizado no lado de cá
  g.fillStyle = '#4a4d50';
  ret(-M, -M, M, -M + 14); ret(-M, M - 14, M, M); ret(-M, -M, -M + 14, M); ret(M - 14, -M, M, M);
  g.fillStyle = '#566468'; ret(-60, M - 30, 260, M - 16);
  // trilhos (SuperVia): o leito de brita e os trilhos, e a Av. Radial Oeste do lado do estádio
  const T = E.trilhos;
  g.save();
  g.translate(px(T.p[0]), pz(T.p[1]));
  g.rotate(Math.atan2(T.d[1], T.d[0]));
  g.fillStyle = '#4a4d50'; g.fillRect(-1200 * k, (-T.larg / 2 - 24) * k, 2400 * k, 18 * k);
  g.fillStyle = '#6d675d'; g.fillRect(-1200 * k, -T.larg / 2 * k, 2400 * k, T.larg * k);
  g.fillStyle = '#3a342d';
  for (let o = -T.larg / 2 + 4; o < T.larg / 2 - 2; o += 4.6) g.fillRect(-1200 * k, o * k, 2400 * k, Math.max(1, 0.5 * k));
  g.restore();
  // ---- as sombras (uma camada preta, composta com alfa: onde duas se cruzam não escurece duas vezes)
  const cs = criarCanvas(S, S), gs = cs.getContext('2d');
  gs.fillStyle = '#000';
  const D = h => [SOMBRA[0] * h, SOMBRA[1] * h];
  const poli = pts => { gs.beginPath(); pts.forEach(([x, z], i) => (i ? gs.lineTo(px(x), pz(z)) : gs.moveTo(px(x), pz(z)))); gs.closePath(); gs.fill(); };
  const caixaS = (x0, z0, x1, z1, h) => { const [dx, dz] = D(h); for (let f = 0; f <= 1; f += 0.125) poli([[x0 + dx * f, z0 + dz * f], [x1 + dx * f, z0 + dz * f], [x1 + dx * f, z1 + dz * f], [x0 + dx * f, z1 + dz * f]]); };
  // a fachada e a cobertura (~30 m): a elipse arrastada pela sombra
  const Fa = P.forma.fachada;
  for (let f = 0; f <= 1; f += 0.05) { const [dx, dz] = D(29 * f); gs.beginPath(); gs.ellipse(px(dx), pz(dz), (Fa.a + 2) * k, (Fa.b + 2) * k, 0, 0, 2 * Math.PI); gs.fill(); }
  // o Maracanãzinho
  for (let f = 0; f <= 1; f += 0.1) { const [dx, dz] = D((Mz.parede + Mz.cupula) * f); gs.beginPath(); gs.arc(px(Mz.x + dx), pz(Mz.z + dz), (Mz.r + 1.5 - 18 * f * f) * k, 0, 2 * Math.PI); gs.fill(); }
  // as rampas (o tabuleiro sobre os pilares: a faixa da sombra deslocada pela altura de cada ponto) e os pórticos
  const R = P.forma.rampas, z0 = Fa.b + 1.5;
  for (const lado of [1, -1]) {
    for (const [xa, xb] of [[-R.larg / 2, -2], [2, R.larg / 2]]) {
      const [ax, az] = D(P.yRampa(z0)), [bx, bz] = D(P.yRampa(R.zFim));
      poli([[xa + ax, lado * z0 + az], [xb + ax, lado * z0 + az], [xb + bx, lado * R.zFim + bz], [xa + bx, lado * R.zFim + bz]]);
    }
    const Pt = R.portico, meia = Pt.larg / 2 / Pt.r, thC = lado > 0 ? Math.PI / 2 : -Math.PI / 2, [dx, dz] = D(Pt.alt + 0.6);
    const pts = [];
    for (let i = 0; i <= 12; i++) { const th = thC - meia + (2 * meia * i) / 12; pts.push([(Pt.r - 7) * Math.cos(th) + dx, (Pt.r - 7) * Math.sin(th) + dz]); }
    for (let i = 12; i >= 0; i--) { const th = thC - meia + (2 * meia * i) / 12; pts.push([(Pt.r + 7) * Math.cos(th) + dx, (Pt.r + 7) * Math.sin(th) + dz]); }
    poli(pts);
  }
  // o parque aquático (o prédio coberto) e as palmeiras (a copa e o tronco)
  caixaS(Aq.x - 30, Aq.z - 17, Aq.x + 2, Aq.z + 17, 12);
  for (const p of P.palmeiras()) {
    const [dx, dz] = D(p.h);
    gs.beginPath(); gs.ellipse(px(p.x + dx), pz(p.z + dz), 3.4 * k, 2.6 * k, Math.atan2(SOMBRA[1], SOMBRA[0]), 0, 2 * Math.PI); gs.fill();
    gs.lineWidth = Math.max(1, 0.5 * k); gs.strokeStyle = '#000'; gs.beginPath(); gs.moveTo(px(p.x), pz(p.z)); gs.lineTo(px(p.x + dx * 0.92), pz(p.z + dz * 0.92)); gs.stroke();
  }
  g.globalAlpha = 0.42; g.drawImage(cs, 0, 0); g.globalAlpha = 1;
  return texturaCanvas(c, { aniso });
}

/**
 * O chão do bairro (±B m) pintado: as quadras tortas de bairro.quadras (telhados de barro e lajes cinza das casas, copas
 * de árvore, praças), as ruas entre elas, o leito dos trilhos com a Av. Radial Oeste, a favela no Morro da Mangueira
 * (o morro usa este mesmo mapa, projetado de cima) e as sombras dos prédios.
 */
function texBairro(P, S, aniso) {
  const E = P.entorno, M = E.bairro, k = S / (2 * M);
  const c = criarCanvas(S, S), g = c.getContext('2d');
  const px = x => (x + M) * k, pz = z => (z + M) * k;
  const r = gerador(7316);
  g.fillStyle = '#6b6c69'; g.fillRect(0, 0, S, S);
  const TELHA = ['#9a6450', '#a8735a', '#8c5f4c', '#b07e62'], LAJE = ['#a7a49c', '#bcb8ae', '#8f8c86', '#d8d4ca', '#c9bfae', '#e2dfd8'];
  const VERDE = ['#3f6b33', '#4b7a3a', '#365e2c', '#557f41'];
  for (const q of P.bairro().quadras) {
    g.save(); g.translate(px(q.x), pz(q.z)); g.rotate(q.rumo);
    const l = q.l * k;
    if (q.tipo === 'verde') {
      g.fillStyle = '#5d8445'; g.fillRect(-l / 2, -l / 2, l, l);
      for (let i = 0; i < 14; i++) { g.fillStyle = VERDE[i % 4]; g.beginPath(); g.arc((r() - 0.5) * l, (r() - 0.5) * l, (2 + r() * 3) * k, 0, 2 * Math.PI); g.fill(); }
    } else {
      // os lotes: telhados de casas e lajes (no prédio, a laje fica embaixo da caixa)
      const n = 3;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const w = l / n;
        g.fillStyle = r() < (q.tipo === 'casas' ? 0.42 : 0.18) ? TELHA[Math.floor(r() * 4)] : LAJE[Math.floor(r() * 6)];
        g.fillRect(-l / 2 + a * w + 0.6 * k, -l / 2 + b * w + 0.6 * k, w - 1.2 * k, w - 1.2 * k);
      }
      if (r() < 0.55) { g.fillStyle = VERDE[Math.floor(r() * 4)]; g.beginPath(); g.arc((r() - 0.5) * l, (r() - 0.5) * l, (3 + r() * 3) * k, 0, 2 * Math.PI); g.fill(); }
    }
    g.restore();
  }
  // a favela da Mangueira no morro (casas pequenas coladas, tijolo, laranja, branco) e a mata no alto
  const Mg = E.mangueira;
  // a favela (ref-09): casas de bloco e reboco — muito cinza e branco, tijolo aqui e ali, e o verde no meio
  const CORES = ['#a3553a', '#d9c9b0', '#b9b5ad', '#e2ddd2', '#c99a63', '#8f8c86', '#e9e6df', '#9b7a62', '#c7c2b8', '#b5a089'];
  g.fillStyle = '#857565'; g.beginPath(); g.arc(px(Mg.x), pz(Mg.z), Mg.r * 1.05 * k, 0, 2 * Math.PI); g.fill();
  for (let i = 0; i < 14000; i++) {
    const a = r() * 2 * Math.PI, d = Math.sqrt(r()) * Mg.r * 1.04, x = Mg.x + d * Math.cos(a), z = Mg.z + d * Math.sin(a);
    if (d < Mg.r * (0.22 + r() * 0.12) || r() < 0.2) { g.fillStyle = r() < 0.7 ? '#3f6a32' : '#4f7a3c'; g.fillRect(px(x), pz(z), 4 * k, 4 * k); continue; }
    g.fillStyle = CORES[Math.floor(r() * CORES.length)];
    g.fillRect(px(x), pz(z), (2 + r() * 4) * k, (2 + r() * 3) * k);
  }
  // os trilhos (o pátio da SuperVia, largo) e a Av. Radial Oeste
  const T = E.trilhos;
  g.save(); g.translate(px(T.p[0]), pz(T.p[1])); g.rotate(Math.atan2(T.d[1], T.d[0]));
  g.fillStyle = '#4a4d50'; g.fillRect(-3000 * k, (-T.larg / 2 - 26) * k, 6000 * k, 20 * k);
  g.fillStyle = '#6d675d'; g.fillRect(-3000 * k, -(T.larg / 2 + 4) * k, 6000 * k, (T.larg + 8) * k);
  g.fillStyle = '#3a342d';
  for (let o = -T.larg / 2 + 2; o < T.larg / 2 + 2; o += 4.6) g.fillRect(-3000 * k, o * k, 6000 * k, Math.max(1, 0.6 * k));
  g.restore();
  // o rio Maracanã e a avenida (lado de cá)
  g.fillStyle = '#4a4d50'; g.fillRect(px(-M), pz(352), S, 22 * k);
  g.fillStyle = '#566468'; g.fillRect(px(-M), pz(376), S, 12 * k);
  // as sombras dos prédios
  const cs = criarCanvas(S, S), gs = cs.getContext('2d');
  gs.fillStyle = '#000';
  for (const p of P.bairro().predios) {
    const [dx, dz] = [SOMBRA[0] * p.h, SOMBRA[1] * p.h], cr = Math.cos(p.rumo), sr = Math.sin(p.rumo);
    const cant = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [p.x + cr * a * p.lx / 2 - sr * b * p.lz / 2, p.z + sr * a * p.lx / 2 + cr * b * p.lz / 2]);
    for (let f = 0; f <= 1; f += 0.2) { gs.beginPath(); cant.forEach(([x, z], i) => (i ? gs.lineTo(px(x + dx * f), pz(z + dz * f)) : gs.moveTo(px(x + dx * f), pz(z + dz * f)))); gs.closePath(); gs.fill(); }
  }
  g.globalAlpha = 0.4; g.drawImage(cs, 0, 0); g.globalAlpha = 1;
  return texturaCanvas(c, { aniso });
}

// ------------------------------------------------------------------ a tigela (o jogo e o pré-jogo)
/**
 * A tigela e a cobertura. opc = {aniso, qualidade, ident, comLuzFalsa (render/campo.js)}. Devolve o grupo com as malhas
 * 'arquibancada-lado' (setor 0), 'arquibancada-fundos' (setores 1 e 2 + o piso azul), 'arquibancada-ca' (setor 3, o
 * túnel e os bancos; userData.caixas), 'cobertura' e 'cobertura-estrutura'; userData {materiais, ladoDeCa, definirHora}.
 */
export function criarTigela(P, opc = {}) {
  const q = opc.qualidade ?? 'media', aniso = opc.aniso ?? 4;
  const Pf = P.forma.perfil, T = ESTADIO.tunel;
  const K = q === 'alta' ? 160 : q === 'baixa' ? 84 : 104;
  const dTh = (2 * Math.PI) / K;
  const tex = texCadeiras(P, q, aniso);
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, alphaHash: true });
  if (opc.comLuzFalsa) opc.comLuzFalsa(mat, 'tigela');
  const uDe = th => th / (12 * RAD);
  // anéis do perfil: [s, y, v]
  const mt = T.largura / 2 + 0.4, ti = T.largura / 2, ya = T.altura, ytt = T.altura + T.laje;
  const sT = Pf.sInf * (ytt + 0.3 - Pf.y0) / (Pf.yInf - Pf.y0);     // o degrau passa do teto do túnel aqui
  const aneis = [[0, 0, 0.012], [0, Pf.y0, 0.04], [sT, P.perfil(sT), P.vDe(sT)]];
  for (const [s, y, v] of P.nos.slice(1)) aneis.push([s, y, v]);
  aneis.push([1, Pf.yTopo + Pf.parapeito, 1.0]);
  const thA = Math.atan2(T.z, mt), thB = Math.atan2(T.z, -mt);      // as paredes do túnel na 1ª fileira
  const [d0, d1, d2, d3] = P.thDivisa;     // (+x,−z) (+x,+z) (−x,+z) (−x,−z)
  const setores = [[d3, d0], [d0, d1], [d2, d3 + 2 * Math.PI], [d1, d2]];   // 0 lá, 1 fundo +x, 2 fundo −x, 3 cá
  const colunas = (a, b, extras = []) => {
    const m = Math.max(2, Math.ceil((b - a) / dTh));
    const l = Array.from({ length: m + 1 }, (_, j) => a + ((b - a) * j) / m);
    for (const e of extras) if (e > a && e < b && !l.some(x => Math.abs(x - e) < 1e-6)) l.push(e);
    return l.sort((p, q2) => p - q2);
  };
  function faixas(L, ths, pular = null) {
    for (let k = 0; k + 1 < aneis.length; k++) {
      const [s0, y0, v0] = aneis[k], [s1, y1, v1] = aneis[k + 1];
      const i0 = [], i1 = [];
      for (const th of ths) {
        const [x0, z0] = P.ponto(th, s0), [x1, z1] = P.ponto(th, s1), u = uDe(th);
        i0.push(L.v(x0, y0, z0, u, v0)); i1.push(L.v(x1, y1, z1, u, v1));
      }
      for (let j = 0; j + 1 < ths.length; j++) if (!(pular && pular(k, ths[j], ths[j + 1]))) L.quad(i0[j], i0[j + 1], i1[j + 1], i1[j]);
    }
  }
  const g = new THREE.Group();
  g.name = 'tigela';
  const malhas = [];
  // lado de lá
  {
    const L = malha();
    faixas(L, colunas(...setores[0]));
    const m = new THREE.Mesh(L.geo(), mat); m.name = 'arquibancada-lado'; malhas.push(m);
  }
  // fundos + o piso azul em volta das placas (o anel todo: a câmera de TV dentro do lado de cá também o vê)
  {
    const L = malha();
    faixas(L, colunas(...setores[1]));
    faixas(L, colunas(...setores[2]));
    const azul = cor(0x2e62a6), hx = GRAMA.lx / 2, hz = GRAMA.lz / 2;
    const ths = colunas(-Math.PI, Math.PI);
    const ii = [], oo = [];
    for (const th of ths) {
      const c = Math.cos(th), s = Math.sin(th);
      const ri = Math.min(Math.abs(c) > 1e-6 ? hx / Math.abs(c) : 1e9, Math.abs(s) > 1e-6 ? hz / Math.abs(s) : 1e9);
      const ro = P.rF(th);
      ii.push(L.v(ri * c, 0.012, ri * s, 0.7, 0.005, azul)); oo.push(L.v(ro * c, 0.012, ro * s, 0.75, 0.006, azul));
    }
    for (let j = 0; j + 1 < ths.length; j++) L.quad(ii[j], ii[j + 1], oo[j + 1], oo[j]);
    const m = new THREE.Mesh(L.geo(), mat); m.name = 'arquibancada-fundos'; malhas.push(m);
  }
  // lado de cá: o túnel no meio (as cadeiras cortadas em cima da boca), os bancos de reservas
  let ca;
  {
    const L = malha(true);
    const ths = colunas(setores[3][0], setores[3][1], [thA, thB]);
    faixas(L, ths, (k, a, b) => k < 2 && a >= thA - 1e-9 && b <= thB + 1e-9);
    const conc = cor(0xb9b7b0), escuro = c2 => cor(0x9d9c97).multiplyScalar(c2);
    const time = cor(opc.ident?.fachada?.tunel ?? '#c4161c');
    const sC = Pf.sInf * (ytt - Pf.y0) / (Pf.yInf - Pf.y0);
    const pt = (th, s, y) => { const [x, z] = P.ponto(th, s); return [x, y, z]; };
    // a laje (teto do túnel saliente) e o espelho atrás dela
    L.q4(pt(thA, 0, ytt), pt(thB, 0, ytt), pt(thB, sT, ytt), pt(thA, sT, ytt), conc);
    L.q4(pt(thA, sT, ytt), pt(thB, sT, ytt), pt(thB, sT, P.perfil(sT)), pt(thA, sT, P.perfil(sT)), escuro(0.8));
    for (const th of [thA, thB]) {
      const a = L.v(...pt(th, 0, Pf.y0), 0.7, 0.005, conc), b = L.v(...pt(th, 0, ytt), 0.7, 0.008, conc), c = L.v(...pt(th, sC, ytt), 0.75, 0.008, conc);
      L.tri(a, b, c);
    }
    // a boca: moldura na cor do mandante e a verga
    const z0 = T.z;
    for (const s of [-1, 1]) L.q4([s * ti, 0, z0], [s * mt, 0, z0], [s * mt, ytt, z0], [s * ti, ytt, z0], time);
    L.q4([-ti, ya, z0], [ti, ya, z0], [ti, ytt, z0], [-ti, ytt, z0], time);
    // por dentro: o concreto escurecendo e o fundo quase preto
    const zf = z0 + T.profundidade;
    for (const s of [-1, 1]) L.q4([s * ti, 0, z0], [s * ti, 0, zf], [s * ti, ya, zf], [s * ti, ya, z0], escuro(0.45));
    L.q4([-ti, ya, z0], [ti, ya, z0], [ti, ya, zf], [-ti, ya, zf], escuro(0.32));
    L.q4([-ti, 0.02, z0], [ti, 0.02, z0], [ti, 0.02, zf], [-ti, 0.02, zf], escuro(0.55));
    L.q4([-ti, 0, zf], [ti, 0, zf], [ti, ya, zf], [-ti, ya, zf], escuro(0.1));
    // bancos de reservas (config.js ESTADIO.bancos): a CÁPSULA curva de acrílico transparente com os arcos de metal (ref-07;
    // rodada 1: "caixotes com teto chapado") — transparência pelo alfa do vértice com alphaHash (sem chamada a mais)
    const B = ESTADIO.bancos, [za, zb] = B.z;
    const assento = cor(0x2b3442), acril = cor(0xcfe0ea), metal = cor(0x8b9399);
    const zc = (za + zb) / 2 + 0.1, yc = 0.4, RC = 1.5, NA = 10, a0 = -10 * RAD, a1 = 150 * RAD;
    const arcoC = k => { const a = a0 + ((a1 - a0) * k) / NA; return [zc + RC * Math.cos(a), yc + RC * Math.sin(a)]; };
    for (const s of [-1, 1]) {
      const xa = s * B.x[0], xb = s * B.x[1], xc = (xa + xb) / 2, larg = Math.abs(xb - xa);
      L.caixa(xc, 0.25, zb - 0.6, larg, 0.5, 1.2, 0, conc, 5);
      L.caixa(xc, 0.62, zb - 0.6, larg - 0.4, 0.22, 0.9, 0, assento, 5);
      L.caixa(xc, 0.95, zb - 0.12, larg - 0.4, 0.7, 0.12, 0, assento, 5);
      L.alfa = 0.32;
      for (let k = 0; k < NA; k++) { const [z0, y0] = arcoC(k), [z1, y1] = arcoC(k + 1); L.q4([xa, y0, z0], [xb, y0, z0], [xb, y1, z1], [xa, y1, z1], acril); }
      L.alfa = 1;
      for (let xm = Math.min(xa, xb); xm <= Math.max(xa, xb) + 0.01; xm += larg / 7) {
        for (let k = 0; k < NA; k++) { const [z0, y0] = arcoC(k), [z1, y1] = arcoC(k + 1); L.q4([xm - 0.05, y0 + 0.01, z0], [xm + 0.05, y0 + 0.01, z0], [xm + 0.05, y1 + 0.01, z1], [xm - 0.05, y1 + 0.01, z1], metal); }
      }
    }
    ca = new THREE.Mesh(L.geo(), mat);
    ca.name = 'arquibancada-ca';
    ca.frustumCulled = false;
    // as caixas de corte (a faixa da frente, a de cima e os bancos): o mesmo uso de render/campo.js atualizar()
    const xs = [], zs = [];
    for (const th of ths) for (const s of [0, 0.3, 1]) { const [x, z] = P.ponto(th, s); xs.push(x); zs.push(z); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), zMeio = P.ponto(Math.PI / 2, 0.3)[1];
    ca.userData.caixas = [
      new THREE.Box3(new THREE.Vector3(x0 - 0.5, -0.5, T.z - 0.6), new THREE.Vector3(x1 + 0.5, P.perfil(0.3) + 0.5, zMeio + 0.5)),
      new THREE.Box3(new THREE.Vector3(x0 - 0.5, P.perfil(0.3) - 0.5, zMeio - 0.5), new THREE.Vector3(x1 + 0.5, Pf.yTopo + Pf.parapeito + 0.6, Math.max(...zs) + 0.6)),
      new THREE.Box3(new THREE.Vector3(-B.x[1] - 0.5, -0.1, B.z[0] - 0.8), new THREE.Vector3(B.x[1] + 0.5, Math.max(B.altura, yc + RC) + 0.4, T.z)),
    ];
    malhas.push(ca);
  }
  for (const m of malhas) { m.castShadow = false; m.receiveShadow = false; g.add(m); }
  const cob = criarCobertura(P, q);
  g.add(cob.membrana, cob.estrutura);
  g.userData.materiais = [mat, cob.estrutura.material];
  g.userData.ladoDeCa = ca;
  g.userData.definirHora = h => cob.definirHora(h);
  return g;
}

// ------------------------------------------------------------------ cobertura (membrana + estrutura)
function criarCobertura(P, q) {
  const C = P.forma.cobertura;
  const N = q === 'baixa' ? C.eixos : 2 * C.eixos;      // colunas: a nervura e o meio da baia
  const us = [0, 0.05, 0.3, P.uMastro, (P.uMastro + 1) / 2, 1];
  // o relevo dos deltoides (pequeno: de perto do chão a borda é uma LINHA, sem "dentes" no céu — rodada 1)
  const amp = u => Math.pow(Math.sin(Math.PI * u), 0.6);
  const AMP_N = 0.25, AMP_V = -0.6;
  // membrana: por cima branca, por baixo creme translúcida (gl_FrontFacing; o lado de cima é a frente)
  const L = malha();
  const linhas = us.map(() => []);
  for (let j = 0; j <= N; j++) {
    const th = -Math.PI + (2 * Math.PI * j) / N, nerv = j % (N / C.eixos) === 0;
    us.forEach((u, k) => {
      const [x, z] = P.pontoCob(th, u);
      const y = P.alturaCob(u) + (q === 'baixa' ? 0 : amp(u) * (nerv ? AMP_N : AMP_V));
      linhas[k].push(L.v(x, y, z, (th / (2 * Math.PI)) * C.eixos, u));
    });
  }
  for (let k = 0; k + 1 < us.length; k++) for (let j = 0; j < N; j++) L.quad(linhas[k][j], linhas[k + 1][j], linhas[k + 1][j + 1], linhas[k][j + 1]);
  // a face do anel de compressão (cinza-claro, 2 m) por fora
  const fora0 = [], fora1 = [];
  for (let j = 0; j <= N; j++) {
    const th = -Math.PI + (2 * Math.PI * j) / N, r = P.rCobFora(th) + 0.4;
    fora0.push(L.v(r * Math.cos(th), C.yFora - (C.anel ?? 1.6), r * Math.sin(th), (th / (2 * Math.PI)) * C.eixos, 0.004));
    fora1.push(L.v(r * Math.cos(th), C.yFora + 0.05, r * Math.sin(th), (th / (2 * Math.PI)) * C.eixos, 0.006));
  }
  for (let j = 0; j < N; j++) L.quad(fora0[j], fora0[j + 1], fora1[j + 1], fora1[j]);
  const geo = L.geo();
  geo.deleteAttribute('color');
  const uCreme = { value: new THREE.Color(0xeee8d8) }, uTransl = { value: 0.85 };
  const matM = new THREE.MeshLambertMaterial({ map: texCobertura(P, false), emissiveMap: texCobertura(P, true), emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide, flatShading: q !== 'baixa' });
  matM.onBeforeCompile = sh => {
    sh.uniforms.uCreme = uCreme; sh.uniforms.uTransl = uTransl;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCreme;\nuniform float uTransl;')
      // por baixo: o creme translúcido com as nervuras, as costuras e a treliça da borda escurecendo (a luminância da textura)
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat fSob = 1.0;\nif (!gl_FrontFacing && vMapUv.y > 0.012) { fSob = mix(0.38, 1.0, smoothstep(0.35, 0.92, dot(sampledDiffuseColor.rgb, vec3(0.3333)))); diffuseColor.rgb = uCreme * fSob; }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (!gl_FrontFacing && vMapUv.y > 0.012) totalEmissiveRadiance += uCreme * uTransl * fSob * fSob;');
  };
  matM.customProgramCacheKey = () => 'cobertura-membrana';
  const membrana = new THREE.Mesh(geo, matM);
  membrana.name = 'cobertura';
  // estrutura: a passarela técnica (com os refletores), os mastros em losango, os cabos de baixo e os 4 telões
  const E = malha();
  const cinza = cor(0x7d848a), cabo = cor(0xa3a9ad), escuro = cor(0x3d4349), luz = cor(0xdfe4e8), tela = cor(0x14181c);
  const yP = C.yPassarela, NK = q === 'baixa' ? 60 : 120;
  const anel = (u, y0, y1, c, rd = 0) => {
    const a = [], b = [];
    for (let j = 0; j <= NK; j++) {
      const th = -Math.PI + (2 * Math.PI * j) / NK, [x, z, r] = P.pontoCob(th, u), k = (r + rd) / r;
      a.push(E.v(x * k, y0, z * k, 0.7, 0.005, c)); b.push(E.v(x * k, y1, z * k, 0.7, 0.008, c));
    }
    for (let j = 0; j < NK; j++) E.quad(a[j], a[j + 1], b[j + 1], b[j]);
  };
  // a passarela: face de dentro (a treliça escura com a fileira de refletores claros embaixo), de fora e o fundo
  anel(P.uMastro, yP - 0.25, yP + 1.4, escuro, -1.2);
  anel(P.uMastro, yP - 0.6, yP - 0.25, luz, -1.2);
  anel(P.uMastro, yP - 0.6, yP + 1.4, escuro, 1.2);
  {
    const a = [], b = [];
    for (let j = 0; j <= NK; j++) {
      const th = -Math.PI + (2 * Math.PI * j) / NK, [x, z, r] = P.pontoCob(th, P.uMastro);
      a.push(E.v(x * (r - 1.2) / r, yP - 0.6, z * (r - 1.2) / r, 0.7, 0.005, escuro)); b.push(E.v(x * (r + 1.2) / r, yP - 0.6, z * (r + 1.2) / r, 0.7, 0.005, escuro));
    }
    for (let j = 0; j < NK; j++) E.quad(a[j], a[j + 1], b[j + 1], b[j]);
  }
  const fita = (p0, p1, larg, c, lateral = false) => {
    // fita fina entre dois pontos (de lado: no plano vertical que passa pelos dois; senão deitada)
    const dx = p1[0] - p0[0], dz = p1[2] - p0[2], l = Math.hypot(dx, dz) || 1;
    const ox = lateral ? 0 : (-dz / l) * larg / 2, oz = lateral ? 0 : (dx / l) * larg / 2, oy = lateral ? larg / 2 : 0;
    E.q4([p0[0] - ox, p0[1] - oy, p0[2] - oz], [p0[0] + ox, p0[1] + oy, p0[2] + oz], [p1[0] + ox, p1[1] + oy, p1[2] + oz], [p1[0] - ox, p1[1] - oy, p1[2] - oz], c);
  };
  for (let k = 0; k < C.eixos; k++) {
    const th = -Math.PI + (2 * Math.PI * k) / C.eixos;
    const p = (u, y, dr = 0) => { const [x, z, r] = P.pontoCob(th, u), f = (r + dr) / r; return [x * f, y, z * f]; };
    const yTopo = P.alturaCob(P.uMastro) - 0.2;
    // o mastro (losango de 13,5 m): de baixo ao meio, abrindo, e do meio ao alto
    const yM = (yP + 0.6 + yTopo) / 2;
    for (const dr of [-1.6, 1.6]) { fita(p(P.uMastro, yP + 0.6), p(P.uMastro, yM, dr), 0.4, cinza, true); fita(p(P.uMastro, yM, dr), p(P.uMastro, yTopo), 0.4, cinza, true); }
    // os cabos de baixo: do anel de compressão à passarela e dela à borda de dentro
    if (q !== 'baixa') { fita(p(0.02, C.yFora - (C.anel ?? 1.6)), p(P.uMastro, yP - 0.6), 0.16, cabo); fita(p(P.uMastro, yP - 0.6), p(0.995, C.yDentro - 0.4), 0.16, cabo); }
    // o "colar" de nós escuros na linha dos mastros (o círculo pontilhado das aéreas) e os cabos radiais por cima
    const yM2 = P.alturaCob(P.uMastro) + amp(P.uMastro) * AMP_N;
    const [cxm, czm] = P.pontoCob(th, P.uMastro);
    E.caixa(cxm, yM2 + 0.12, czm, 1.8, 0.3, 1.8, th, cor(0x4f565c));
    if (q !== 'baixa') {
      const us2 = [0.035, 0.3, P.uMastro, (P.uMastro + 1) / 2, 0.985];
      for (let i = 0; i + 1 < us2.length; i++) fita(p(us2[i], P.alturaCob(us2[i]) + amp(us2[i]) * AMP_N + 0.14), p(us2[i + 1], P.alturaCob(us2[i + 1]) + amp(us2[i + 1]) * AMP_N + 0.14), 0.32, cinza);
      // a treliça da passarela (diagonais na face de dentro)
      const thN = -Math.PI + (2 * Math.PI * (k + 1)) / C.eixos, thM = (th + thN) / 2;
      const pp = (t2, y) => { const [x, z, r] = P.pontoCob(t2, P.uMastro), f = (r - 1.25) / r; return [x * f, y, z * f]; };
      fita(pp(th, yP - 0.2), pp(thM, yP + 1.3), 0.22, cabo, true); fita(pp(thM, yP + 1.3), pp(thN, yP - 0.2), 0.22, cabo, true);
    }
  }
  // os 4 telões perto dos cantos, pendurados e virados para o campo
  for (const t of P.TELOES) {
    const h = t.th + Math.PI / 2;
    E.caixa(t.x, t.y, t.z, t.larg + 0.6, t.alt + 0.6, 1.2, h, escuro);
    const nx = -Math.cos(t.th), nz = -Math.sin(t.th), ex = Math.cos(h), ez = Math.sin(h);
    const cx = t.x + nx * 0.62, cz = t.z + nz * 0.62;
    E.q4([cx - ex * t.larg / 2, t.y - t.alt / 2, cz - ez * t.larg / 2], [cx + ex * t.larg / 2, t.y - t.alt / 2, cz + ez * t.larg / 2], [cx + ex * t.larg / 2, t.y + t.alt / 2, cz + ez * t.larg / 2], [cx - ex * t.larg / 2, t.y + t.alt / 2, cz - ez * t.larg / 2], tela);
    for (const s of [-1, 1]) fita([t.x + ex * s * 4, t.y + t.alt / 2 + 0.3, t.z + ez * s * 4], [t.x + ex * s * 4, P.alturaCob(0.88) - 0.5, t.z + ez * s * 4], 0.2, cinza, true);
  }
  const matE = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const estrutura = new THREE.Mesh(E.geo(), matE);
  estrutura.name = 'cobertura-estrutura';
  return {
    membrana, estrutura,
    definirHora(h) {
      const noite = h === 'noite';
      matM.emissiveIntensity = noite ? 1.4 : 0;
      matM.color.setScalar(noite ? 0.5 : 1);
      uTransl.value = noite ? 0.28 : 0.85;
    },
  };
}

// ------------------------------------------------------------------ o lado de fora (o pré-jogo)
/**
 * A fachada, as rampas e os pórticos (uma malha com cor por vértice). Eixos pelo parâmetro da elipse da fachada (os 60
 * vãos iguais); o perfil das costelas e das lajes vem da planta (P.COSTELA, P.nFachada).
 */
function criarEstrutura(P, q) {
  const Fa = P.forma.fachada, C = P.forma.cobertura, R = P.forma.rampas;
  const L = malha();
  const A = Fa.a, B = Fa.b, NE = Fa.eixos;
  const base = t => [A * Math.cos(t), B * Math.sin(t)];
  const normal = t => { const nx = Math.cos(t) / A, nz = Math.sin(t) / B, l = Math.hypot(nx, nz); return [nx / l, nz / l]; };
  const pt = (t, n, y) => { const [x, z] = base(t), [nx, nz] = normal(t); return [x + nx * n, y, z + nz * n]; };
  // concreto aparente CINZA (rodada 1: o fundo azul-marinho parecia vidro): costelas e lajes cinza-médio, as paredes
  // recuadas bege-claras atrás das lajes e vãos escuros só nos acessos (ref-03, ref-04)
  const conc = cor(0x9a9c9c), concClaro = cor(0xbdbcb6), concEsc = cor(0x85878a), fundo = cor(0xc4bdaf), terreo = cor(0xa9a69e);
  const almof = cor(0xf4f3ee), lajeTopo = cor(0x8d8e8c), vao = cor(0x2f3439), grade = cor(0x9aa1a6);
  const KT = q === 'alta' ? 180 : q === 'baixa' ? 90 : 120;
  const ts = Array.from({ length: KT + 1 }, (_, j) => (2 * Math.PI * j) / KT);
  // parede recuada escura (o fundo dos vãos) e o térreo
  const faixa = (n0, y0, n1, y1, c, recuo = 0) => {
    const a = [], b = [];
    for (const t of ts) { a.push(L.v(...pt(t, n0 - recuo, y0), 0.7, 0.005, c)); b.push(L.v(...pt(t, n1 - recuo, y1), 0.7, 0.008, c)); }
    for (let j = 0; j < KT; j++) L.quad(a[j], a[j + 1], b[j + 1], b[j]);
  };
  faixa(P.nFachada(0), 0, P.nFachada(5), 5, terreo, 2.6);
  faixa(P.nFachada(5), 5, P.nFachada(Fa.cinta), Fa.cinta, fundo, 2.6);
  // as lajes com guarda-corpo (frente e topo) e a cinta
  const lajes = q === 'baixa' ? [9.5, 17.5, Fa.cinta] : [9.5, 13.5, 17.5, Fa.cinta];
  for (const y of lajes) {
    const n = P.nFachada(y) - 0.25, alt = y === Fa.cinta ? 1.5 : 1.05;
    faixa(n, y - alt, n, y, y === Fa.cinta ? conc : concClaro);
    faixa(n, y, n - 2.4, y, concEsc);
    faixa(n, y - alt, n - 2.4, y - alt, cor(0xa9a7a0));
  }
  // marquise do anel de circulação (+5 m) avançando 3 m
  faixa(3.2, 5.25, 3.2, 4.65, concClaro);
  faixa(3.2, 5.25, 0, 5.25, concEsc);
  // a laje do topo (de dentro da fachada até a parede de trás da tigela), escura, e o friso amarelo dos acessos no térreo
  {
    const a = [], b = [];
    for (const t of ts) {
      const [x, , z] = pt(t, 1.2, 0), th = Math.atan2(z, x), rB = P.rB(th) + 0.5;
      a.push(L.v(x, P.forma.perfil.laje, z, 0.7, 0.005, lajeTopo)); b.push(L.v(rB * Math.cos(th), P.forma.perfil.laje, rB * Math.sin(th), 0.7, 0.008, lajeTopo));
    }
    for (let j = 0; j < KT; j++) L.quad(a[j], a[j + 1], b[j + 1], b[j]);
  }
  // costelas (gancho) e almofadas, por eixo
  const NS = q === 'baixa' ? 5 : 8;
  const perfilC = P.COSTELA.filter((_, i) => q !== 'baixa' || i % 2 === 0 || i === P.COSTELA.length - 1);
  for (let k = 0; k < NE; k++) {
    const t = (2 * Math.PI * (k + 0.5)) / NE;
    const [nx, nz] = normal(t), ex = -nz, ez = nx;
    const [bx, bz] = base(t);
    const w = 0.85;
    const P3 = (n, y, e) => [bx + nx * n + ex * e, y, bz + nz * n + ez * e];
    for (let i = 0; i + 1 < perfilC.length; i++) {
      const [n0, y0] = perfilC[i], [n1, y1] = perfilC[i + 1];
      const d0 = y0 > Fa.cinta ? 1.4 : 2.4, d1 = y1 > Fa.cinta ? 1.4 : 2.4;
      // face de fora, os dois lados e (no gancho) a de dentro
      L.q4(P3(n0, y0, -w), P3(n0, y0, w), P3(n1, y1, w), P3(n1, y1, -w), conc);
      L.q4(P3(n0, y0, w), P3(n0 - d0, y0, w), P3(n1 - d1, y1, w), P3(n1, y1, w), concEsc);
      L.q4(P3(n0 - d0, y0, -w), P3(n0, y0, -w), P3(n1, y1, -w), P3(n1 - d1, y1, -w), concEsc);
      if (y0 >= Fa.cinta - 0.1) L.q4(P3(n0 - d0, y0, w), P3(n0 - d0, y0, -w), P3(n1 - d1, y1, -w), P3(n1 - d1, y1, w), concEsc);
    }
    // almofada: painel convexo branco entre esta costela e a próxima (meio cilindro deitado)
    const t0 = t + (0.9 / A), t1 = (2 * Math.PI * (k + 1.5)) / NE - (0.9 / A);
    const NU = q === 'baixa' ? 2 : 4, perfilA = q === 'baixa' ? [[1.6, 21.5], [2.9, 23.7], [0.9, 26]] : [[1.6, 21.4], [2.85, 22.5], [2.95, 24.5], [1.0, 26.2]];
    const grade = [];
    for (let iu = 0; iu <= NU; iu++) {
      const tt = t0 + ((t1 - t0) * iu) / NU;
      grade.push(perfilA.map(([n, y]) => L.v(...pt(tt, n, y), 0.7, 0.005, almof)));
    }
    for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv + 1 < perfilA.length; iv++) L.quad(grade[iu][iv], grade[iu + 1][iv], grade[iu + 1][iv + 1], grade[iu][iv + 1]);
    // a fachada envidraçada (escadas e elevadores novos) só no vão do meio de cada rampa (ref-03): o céu refletido no alto
    const tm = t + Math.PI / NE;
    if (Math.abs(Math.cos(tm)) < 0.05) {
      const ta = t + 0.7 / A, tb = (2 * Math.PI * (k + 1.5)) / NE - 0.7 / A;
      const vb = cor(0x55697a), vc = cor(0x9cb6c8);
      for (const [y0, y1] of [[0, 7], [7, 14], [14, Fa.cinta - 0.6]]) {
        const a = L.v(...pt(ta, 0.7, y0), 0.7, 0.005, y0 ? vc : vb), b = L.v(...pt(tb, 0.7, y0), 0.7, 0.005, y0 ? vc : vb);
        const c = L.v(...pt(tb, 0.7, y1), 0.7, 0.008, y1 > 10 ? vc : vb), d = L.v(...pt(ta, 0.7, y1), 0.7, 0.008, y1 > 10 ? vc : vb);
        L.quad(a, b, c, d);
        for (const yy of [y1 - 0.12]) L.q4(pt(ta, 0.75, yy), pt(tb, 0.75, yy), pt(tb, 0.75, yy + 0.25), pt(ta, 0.75, yy + 0.25), concEsc);
      }
    }
    // os acessos: o vão escuro do portão, a placa amarela "ACESSO ..." (no letreiro, com textura) e os gradis de fila
    if (k % 5 === 1) {
      const ta = t + 1.2 / A, tb = t + 9 / A;
      L.q4(pt(ta, -2.5, 0.05), pt(tb, -2.5, 0.05), pt(tb, -2.5, 3.2), pt(ta, -2.5, 3.2), vao);
      if (q !== 'baixa') {
        const ga = t - 2 / A, gb = t + 12 / A, ng = 8;
        for (const yy of [0.12, 1.02]) L.q4(pt(ga, 7, yy), pt(gb, 7, yy), pt(gb, 7, yy + 0.07), pt(ga, 7, yy + 0.07), grade);
        for (let i = 0; i <= ng; i++) { const tt = ga + ((gb - ga) * i) / ng; L.q4(pt(tt - 0.04 / A, 7, 0), pt(tt + 0.04 / A, 7, 0), pt(tt + 0.04 / A, 7, 1.1), pt(tt - 0.04 / A, 7, 1.1), grade); }
      }
    }
  }
  // ---- rampas (2 pistas sobre pilares) e pórticos, nos dois lados compridos. A rampa SOBE até o 2º pavimento (~11 m)
  // sobre pilares redondos grossos, com a borda da laje e o guarda-corpo maciço de concreto (ref-01, ref-06)
  const deck = cor(0xc9c6bd), deckBaixo = cor(0x77756f), pilar = cor(0xcdcac2), poste = cor(0x5f6468), coluna = cor(0xeeebe4);
  const borda = cor(0xd9d7d0), guarda = cor(0xcfccc4);
  const z0 = Fa.b + 1.5;
  for (const lado of [1, -1]) {
    const Z = z => lado * z;
    for (const [xa, xb] of [[-R.larg / 2, -2], [2, R.larg / 2]]) {
      const yA = P.yRampa(z0), yB = P.yRampa(R.zFim);
      // tabuleiro: topo, fundo (na sombra), a borda da laje (1,3 m) e o guarda-corpo (1,1 m) com o topo dele
      L.q4([xa, yA, Z(z0)], [xb, yA, Z(z0)], [xb, yB, Z(R.zFim)], [xa, yB, Z(R.zFim)], deck);
      L.q4([xa, yA - 1.3, Z(z0)], [xb, yA - 1.3, Z(z0)], [xb, yB - 1.3, Z(R.zFim)], [xa, yB - 1.3, Z(R.zFim)], deckBaixo);
      for (const [x, dx] of [[xa, 0.25], [xb, -0.25]]) {
        L.q4([x, yA - 1.3, Z(z0)], [x, yA + 1.1, Z(z0)], [x, yB + 1.1, Z(R.zFim)], [x, yB - 1.3, Z(R.zFim)], borda);
        L.q4([x + dx, yA, Z(z0)], [x + dx, yA + 1.1, Z(z0)], [x + dx, yB + 1.1, Z(R.zFim)], [x + dx, yB, Z(R.zFim)], guarda);
        L.q4([x, yA + 1.1, Z(z0)], [x + dx, yA + 1.1, Z(z0)], [x + dx, yB + 1.1, Z(R.zFim)], [x, yB + 1.1, Z(R.zFim)], borda);
      }
      // pilares redondos a cada ~10 m
      for (let z = z0 + 9; z < R.zFim - 6; z += 10) {
        const y = P.yRampa(z) - 1.3;
        if (y < 1) continue;
        for (const x of [xa + 2.8, xb - 2.8]) L.coluna(x, 0, Z(z), y, 0.75, pilar, q === 'baixa' ? 5 : 8);
      }
      // postes de luz
      if (q !== 'baixa') for (let z = z0 + 14; z < R.zFim; z += 22) {
        const y = P.yRampa(z);
        for (const x of [xa + 0.5, xb - 0.5]) { L.caixa(x, y + 4, Z(z), 0.2, 8, 0.2, 0, poste, 4); L.caixa(x, y + 8, Z(z), 1.3, 0.28, 0.45, 0, poste, 6); }
      }
    }
    // pórtico "ESTÁDIO MÁRIO FILHO" (ref-05): concêntrico, colunas CILÍNDRICAS brancas e grossas em duas fileiras, a laje de
    // cima com as nervuras (vigas) por baixo e os postes altos, o beiral branco CURVO a ~5 m (as letras ficam nele) e o
    // leque de degraus largos descendo para a praça
    const Pt = R.portico, meia = Pt.larg / 2 / Pt.r, yb = Pt.base ?? 0.6;
    const thC = lado > 0 ? Math.PI / 2 : -Math.PI / 2;
    const NA = 9, NSeg = 16, sombra = cor(0xb9b6ae), nervura = cor(0xc8c5bd);
    const arco = (rr, th, y) => [rr * Math.cos(th), y, rr * Math.sin(th)];
    const thI = (i, n, k = 1) => thC - meia * k + (2 * meia * k * i) / n;
    for (let i = 0; i < NSeg; i++) {
      // a plataforma (na altura do fim da rampa) e os degraus em leque (mais largos que o pórtico)
      const a0 = thI(i, NSeg, 1.05), a1 = thI(i + 1, NSeg, 1.05), b0 = thI(i, NSeg, 1.14), b1 = thI(i + 1, NSeg, 1.14);
      L.q4(arco(Pt.r - 8, a0, yb), arco(Pt.r - 8, a1, yb), arco(Pt.r + 7, a1, yb), arco(Pt.r + 7, a0, yb), concClaro);
      for (let d = 0; d < 4; d++) {
        const r0 = Pt.r + 7 + d * 1.3, r1 = r0 + 1.3, y0 = yb * (1 - d / 4), y1 = yb * (1 - (d + 1) / 4);
        L.q4(arco(r0, b0, y1), arco(r0, b1, y1), arco(r0, b1, y0), arco(r0, b0, y0), concEsc);
        L.q4(arco(r0, b0, y1), arco(r0, b1, y1), arco(r1, b1, y1), arco(r1, b0, y1), concClaro);
      }
      // a laje de cima: topo, fundo, as duas bordas
      const c0 = thI(i, NSeg, 1.04), c1 = thI(i + 1, NSeg, 1.04), r0 = Pt.r - 7, r1 = Pt.r + 7, y0 = Pt.alt, y1 = Pt.alt + 1.3;
      L.q4(arco(r0, c0, y1), arco(r0, c1, y1), arco(r1, c1, y1), arco(r1, c0, y1), concClaro);
      L.q4(arco(r0, c0, y0), arco(r0, c1, y0), arco(r1, c1, y0), arco(r1, c0, y0), sombra);
      for (const rr of [r0, r1]) L.q4(arco(rr, c0, y0), arco(rr, c1, y0), arco(rr, c1, y1), arco(rr, c0, y1), coluna);
      // o beiral curvo das letras (de fora da fileira de colunas de fora até 1,5 m além dela)
      const e0 = thI(i, NSeg, 1.0), e1 = thI(i + 1, NSeg, 1.0), ra = Pt.r + 5.0, rb = Pt.r + 7.0;
      L.q4(arco(ra, e0, 4.4), arco(ra, e1, 4.4), arco(rb, e1, 4.4), arco(rb, e0, 4.4), sombra);
      L.q4(arco(ra, e0, 6.6), arco(ra, e1, 6.6), arco(rb, e1, 6.6), arco(rb, e0, 6.6), concClaro);
      L.q4(arco(rb, e0, 4.4), arco(rb, e1, 4.4), arco(rb, e1, 6.6), arco(rb, e0, 6.6), coluna);
      L.q4(arco(ra, e0, 4.4), arco(ra, e1, 4.4), arco(ra, e1, 6.6), arco(ra, e0, 6.6), coluna);
    }
    // as nervuras da laje de cima (vigas radiais por baixo), as colunas e os postes
    for (let i = 0; i <= 2 * (NA - 1); i++) {
      const th = thI(i, 2 * (NA - 1)), ex = -Math.sin(th) * 0.22, ez = Math.cos(th) * 0.22;
      const A0 = arco(Pt.r - 7, th, Pt.alt - 0.75), A1 = arco(Pt.r + 7, th, Pt.alt - 0.75);
      const sd = (p2, s2, y) => [p2[0] + ex * s2, y, p2[2] + ez * s2];
      for (const s2 of [-1, 1]) L.q4(sd(A0, s2, Pt.alt - 0.75), sd(A1, s2, Pt.alt - 0.75), sd(A1, s2, Pt.alt), sd(A0, s2, Pt.alt), nervura);
      L.q4(sd(A0, -1, Pt.alt - 0.75), sd(A1, -1, Pt.alt - 0.75), sd(A1, 1, Pt.alt - 0.75), sd(A0, 1, Pt.alt - 0.75), sombra);
    }
    for (const rr of [Pt.r - 5.5, Pt.r + 5.5]) for (let i = 0; i < NA; i++) {
      const th = thI(i, NA - 1);
      L.coluna(rr * Math.cos(th), yb, rr * Math.sin(th), Pt.alt, 0.62, coluna, q === 'baixa' ? 6 : 12);
    }
    if (q !== 'baixa') for (let i = 0; i < 6; i++) {
      const th = thI(i + 0.5, 6, 0.9), [x, , z] = arco(Pt.r - 5.5, th, 0), cp = cor(0x8e9498);
      L.caixa(x, Pt.alt + 1.3 + 4, z, 0.16, 8, 0.16, 0, cp, 4);
      L.caixa(x, Pt.alt + 1.3 + 8.1, z, 1.1, 0.26, 0.45, th, cp, 6);
    }
    // os portões (gradis altos) entre as colunas de dentro
    if (q !== 'baixa') {
      const gr = Pt.r - 5.5, NG = 60;
      for (const yy of [yb + 0.1, yb + 1.25, yb + 2.3]) for (let i = 0; i < 12; i++) L.q4(arco(gr, thI(i, 12), yy), arco(gr, thI(i + 1, 12), yy), arco(gr, thI(i + 1, 12), yy + 0.08), arco(gr, thI(i, 12), yy + 0.08), grade);
      for (let i = 0; i <= NG; i++) { const th = thI(i, NG), dx = -Math.sin(th) * 0.04, dz = Math.cos(th) * 0.04, [x, , z] = arco(gr, th, 0); L.q4([x - dx, yb, z - dz], [x + dx, yb, z + dz], [x + dx, yb + 2.38, z + dz], [x - dx, yb + 2.38, z - dz], grade); }
    }
  }
  // as 4 rampas menores, tangentes à fachada perto dos "cantos" (B, C do sul; E, F do norte)
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const t = Math.atan2(sz * 0.62, sx * 0.79), [nx, nz] = normal(t), ex = -nz, ez = nx;
    const [bx, bz] = base(t);
    const c0 = [bx + nx * 9, bz + nz * 9];
    const yA = 5.2, yB = 0.4, len = 52, wl = 7;
    const p = (e, n, y) => [c0[0] + ex * e + nx * n, y, c0[1] + ez * e + nz * n];
    L.q4(p(-len / 2, -wl, yA), p(-len / 2, wl, yA), p(len / 2, wl, yB), p(len / 2, -wl, yB), deck);
    for (const n of [-wl, wl]) L.q4(p(-len / 2, n, yA - 0.7), p(-len / 2, n, yA + 1), p(len / 2, n, yB + 1), p(len / 2, n, Math.max(0, yB - 0.7)), concClaro);
    for (const e of [-18, 0]) for (const n of [-4, 4]) { const [x, , z] = p(e, n, 0); L.coluna(x, 0, z, yA - (yA - yB) * ((e + len / 2) / len) - 0.6, 0.4, pilar, 4); }
  }
  // o rebate da esplanada clara: a face virada para baixo (o teto do pórtico, o fundo das rampas e das lajes) recebe luz
  // de baixo (a luz do hemisfério de baixo é a da grama, escura e verde: o teto do pórtico ficava verde-escuro)
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const uRebate = { value: 0.5 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uRebate = uRebate;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRebate;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 nW = inverseTransformDirection(normal, viewMatrix); totalEmissiveRadiance += diffuseColor.rgb * uRebate * max(0.0, -nW.y); }');
  };
  mat.customProgramCacheKey = () => 'fachada-rebate';
  const m = new THREE.Mesh(L.geo(), mat);
  m.name = 'fora-fachada';
  m.userData.uRebate = uRebate;
  return m;
}

/** O letreiro "ESTÁDIO MÁRIO FILHO" no beiral curvo dos dois pórticos e as placas amarelas dos acessos (uma malha, o atlas). */
function criarLetreiro(P) {
  const R = P.forma.rampas, Pt = R.portico, meia = (Pt.larg / 2 / Pt.r) * 0.62, r = Pt.r + 7.06, NSeg = 12;
  const pos = [], uv = [], idx = [];
  for (const lado of [1, -1]) {
    const thC = lado > 0 ? Math.PI / 2 : -Math.PI / 2, b = pos.length / 3;
    for (let i = 0; i <= NSeg; i++) {
      // visto de fora, a esquerda de quem lê fica em −x no lado de cá (+z) e em +x no de lá (−z)
      const u = i / NSeg, th = thC + meia * (1 - 2 * u);
      for (const [y, v] of [[4.85, 0.5], [6.15, 1]]) { pos.push(r * Math.cos(th), y, r * Math.sin(th)); uv.push(u, v); }
    }
    for (let i = 0; i < NSeg; i++) { const a = b + 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  // as placas dos acessos (a cada 5 eixos, embaixo da marquise do anel de circulação)
  const Fa = P.forma.fachada, A = Fa.a, B = Fa.b, NE = Fa.eixos;
  const pt = (t, n, y) => { let nx = Math.cos(t) / A, nz = Math.sin(t) / B; const l = Math.hypot(nx, nz); nx /= l; nz /= l; return [A * Math.cos(t) + nx * n, y, B * Math.sin(t) + nz * n]; };
  for (let k = 1; k < NE; k += 5) {
    const t = (2 * Math.PI * (k + 0.5)) / NE, ta = t + 1.2 / A, tb = t + 9 / A;
    const [x, , z] = pt(t, 0, 0), g = Math.atan2(z, x) / RAD;
    const i = Math.abs(g) <= 45 ? 0 : Math.abs(g) >= 135 ? 1 : g > 0 ? 2 : 3;
    const b = pos.length / 3;
    for (const [tt, u] of [[tb, i / 4], [ta, (i + 1) / 4]]) for (const [y, v] of [[3.35, 0], [4.35, 0.5]]) { pos.push(...pt(tt, 3.27, y)); uv.push(u, v); }
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: texLetreiro(P.forma.letreiro), side: THREE.DoubleSide }));
  m.name = 'fora-placa';
  return m;
}

/** Marcos do entorno (cor por vértice): Maracanãzinho, Bellini, parque aquático, metrô elevado, trens, leito dos trilhos. */
function criarMarcos(P, q) {
  const L = malha(), E = P.entorno;
  const branco = cor(0xecebe6), cinzaC = cor(0xc9c8c2), escuro = cor(0x50565b), bronze = cor(0x6b5034), pedra = cor(0xb9b4a6);
  // Maracanãzinho (ref-10): o anel de pilares de concreto com o vidro escuro entre eles, a borda saliente, a cúpula branca
  // baixa com as nervuras radiais e a lanterna do óculo no meio
  {
    const M = E.maracanazinho, N = q === 'baixa' ? 24 : 48, NR = 6;
    const pilarC = cor(0xc9c7c0), vidroM = cor(0x3e464d), nerv = cor(0xd9d8d2);
    const P2 = (r, a, y) => [M.x + r * Math.cos(a), y, M.z + r * Math.sin(a)];
    for (let j = 0; j < N; j++) {
      const a0 = (2 * Math.PI * j) / N, a1 = (2 * Math.PI * (j + 1)) / N, am = (a0 + a1) / 2;
      L.q4(P2(M.r - 0.6, a0, 0), P2(M.r - 0.6, a1, 0), P2(M.r - 0.6, a1, M.parede), P2(M.r - 0.6, a0, M.parede), vidroM);
      L.q4(P2(M.r + 1.2, am - 0.012, 0), P2(M.r + 1.2, am + 0.012, 0), P2(M.r + 1.2, am + 0.012, M.parede), P2(M.r + 1.2, am - 0.012, M.parede), pilarC);
    }
    const anel = (r, y, c) => Array.from({ length: N + 1 }, (_, j) => { const a = (2 * Math.PI * j) / N; return L.v(M.x + r * Math.cos(a), y, M.z + r * Math.sin(a), 0.7, 0.005, c); });
    let prev = anel(M.r + 1.6, M.parede + 1.4, branco);
    for (let k = 1; k <= NR; k++) {
      const f = k / NR, r = (M.r + 1.6) * Math.cos(f * Math.PI / 2 * 0.9), y = M.parede + 1.4 + (M.cupula - 1.4) * Math.sin(f * Math.PI / 2 * 0.9);
      const cur = anel(Math.max(r, 9), y, branco);
      for (let j = 0; j < N; j++) L.quad(prev[j], prev[j + 1], cur[j + 1], cur[j]);
      prev = cur;
    }
    // nervuras radiais (fitas claras por cima da cúpula)
    for (let j = 0; j < N; j += 2) {
      const a = (2 * Math.PI * j) / N, dx = -Math.sin(a) * 0.35, dz = Math.cos(a) * 0.35;
      for (let k = 0; k < NR; k++) {
        const f0 = k / NR, f1 = (k + 1) / NR;
        const r0 = (M.r + 1.6) * Math.cos(f0 * Math.PI / 2 * 0.9), r1 = Math.max(9, (M.r + 1.6) * Math.cos(f1 * Math.PI / 2 * 0.9));
        const y0 = M.parede + 1.5 + (M.cupula - 1.4) * Math.sin(f0 * Math.PI / 2 * 0.9), y1 = M.parede + 1.5 + (M.cupula - 1.4) * Math.sin(f1 * Math.PI / 2 * 0.9);
        const A0 = P2(r0, a, y0), A1 = P2(r1, a, y1);
        L.q4([A0[0] - dx, y0, A0[2] - dz], [A0[0] + dx, y0, A0[2] + dz], [A1[0] + dx, y1, A1[2] + dz], [A1[0] - dx, y1, A1[2] - dz], nerv);
      }
    }
    // a lanterna do óculo e a borda saliente
    const yT = M.parede + M.cupula;
    const l0 = anel(9, yT - 0.6, cinzaC), l1 = anel(9, yT + 2.6, escuro), l2 = anel(4, yT + 4.2, cinzaC);
    for (let j = 0; j < N; j++) { L.quad(l0[j], l0[j + 1], l1[j + 1], l1[j]); L.quad(l1[j], l1[j + 1], l2[j + 1], l2[j]); }
    const fr0 = anel(M.r + 2.2, M.parede - 0.3, cinzaC), fr1 = anel(M.r + 2.2, M.parede + 1.5, cinzaC);
    for (let j = 0; j < N; j++) L.quad(fr0[j], fr0[j + 1], fr1[j + 1], fr1[j]);
  }
  // Bellini (o capitão de 1958 erguendo a taça) no pedestal, no eixo da rampa de cá
  {
    const { x, z } = E.bellini;
    L.caixa(x, 1.6, z, 4.2, 3.2, 4.2, 0, pedra);
    L.caixa(x, 4.6, z, 1.1, 2.8, 0.7, 0, bronze);        // corpo
    L.caixa(x, 6.4, z, 0.5, 0.6, 0.5, 0, bronze);        // cabeça
    for (const s of [-1, 1]) L.caixa(x + s * 0.45, 7.0, z, 0.25, 1.9, 0.25, 0, bronze);  // braços para cima
    L.caixa(x, 8.3, z, 0.7, 0.9, 0.5, 0, bronze);        // a taça
  }
  // parque aquático Júlio Delamare: o prédio coberto e, ao lado, a piscina ao ar livre (pintada no chão) com a arquibancada
  {
    const { x, z } = E.aquatico;
    L.caixa(x - 14, 6, z, 32, 12, 34, 0, cinzaC, 5);
    L.q4([x - 30, 12.05, z - 17], [x + 2, 12.05, z - 17], [x + 2, 12.05, z + 17], [x - 30, 12.05, z + 17], cor(0xd8d6cf));
    for (let d = 0; d < 4; d++) L.caixa(x + 39, 0.5 + d * 0.8, z - 15.5 - d * 1.1, 50, 1 + d * 1.6, 1.1, 0, branco, 5);
  }
  // Célio de Barros: a tribuna coberta ao longo da reta
  {
    const Ce = E.celio, zt = Ce.z - Ce.b - 8;
    for (let d = 0; d < 5; d++) L.caixa(Ce.x, 0.6 + d * 0.9, zt - d * 1.4, 70, 1.2 + d * 1.8, 1.4, 0, cinzaC, 5);
    L.caixa(Ce.x, 11, zt - 4, 74, 0.5, 10, 0, branco, 6);
    for (const dx of [-30, -10, 10, 30]) L.coluna(Ce.x + dx, 0, zt - 8.5, 11, 0.3, cinzaC, 4);
  }
  // os postes altos de luz da esplanada
  if (q !== 'baixa') for (let i = 0; i < 16; i++) {
    const a = (2 * Math.PI * (i + 0.5)) / 16, rr = 1.0, F = P.forma.fachada;
    const x = (F.a + 46) * Math.cos(a) * rr, z = (F.b + 46) * Math.sin(a) * rr;
    if (Math.abs(x) < 24) continue;
    L.coluna(x, 0, z, 24, 0.35, cor(0x8e9498), 5);
    L.caixa(x, 24.6, z, 3.2, 1.2, 1.0, a, cor(0x5f6468), 6);
  }
  // o metrô elevado (viga e pilares) ao lado dos trilhos e dois trens da SuperVia no leito
  {
    const T = E.trilhos, [dx, dz] = T.d, nx = dz, nz = -dx;
    const ponto = (t, o, y) => [T.p[0] + dx * t + nx * o, y, T.p[1] + dz * t + nz * o];
    const o = T.larg / 2 + 14;
    L.q4(ponto(-1000, o - 4.5, 10.5), ponto(1000, o - 4.5, 10.5), ponto(1000, o + 4.5, 10.5), ponto(-1000, o + 4.5, 10.5), cinzaC);
    for (const s of [-1, 1]) L.q4(ponto(-1000, o + s * 4.5, 8.8), ponto(1000, o + s * 4.5, 8.8), ponto(1000, o + s * 4.5, 10.5), ponto(-1000, o + s * 4.5, 10.5), cor(0xb3b1ab));
    for (let t = -700; t <= 700; t += 40) { const [x, , z] = ponto(t, o, 0); L.coluna(x, 0, z, 8.8, 1.1, cor(0xbab8b1), 4); }
    // trens
    const h = Math.atan2(dz, dx);
    for (const [t0, off, n] of [[-180, -6, 8], [140, 6, 6]]) for (let i = 0; i < n; i++) {
      const [x, , z] = ponto(t0 + i * 23, off, 0);
      L.caixa(x, 2.2, z, 22, 3.6, 3.1, h, branco, 5);
      L.caixa(x, 2.6, z, 22.05, 0.5, 3.15, h, cor(0xb8232b), 4);
    }
    // o leito dos trilhos fora da esplanada (sobre o bairro)
    for (const [ta, tb] of [[-1100, -300], [300, 1100]]) L.q4(ponto(ta, -T.larg / 2, -0.2), ponto(tb, -T.larg / 2, -0.2), ponto(tb, T.larg / 2, -0.2), ponto(ta, T.larg / 2, -0.2), cor(0x6d675d));
  }
  const m = new THREE.Mesh(L.geo(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.name = 'fora-marcos';
  return m;
}

/**
 * O chão do bairro (±B m) e o Morro da Mangueira numa malha só, com o mapa pintado (texBairro, projetado de cima): uma
 * chamada para o bairro inteiro com a favela no morro.
 */
function criarChaoBairro(P, aniso, q) {
  const E = P.entorno, M = E.bairro, Mg = E.mangueira, y0 = -0.3;
  const pos = [M * -1, y0, -M, M, y0, -M, M, y0, M, -M, y0, M], idx = [0, 2, 1, 0, 3, 2];
  const NA = 36, NR = 7;
  const b = pos.length / 3;
  for (let k = 0; k <= NR; k++) {
    const f = k / NR;
    for (let j = 0; j <= NA; j++) {
      const a = (2 * Math.PI * j) / NA, irreg = 1 + 0.12 * Math.sin(3 * a + 1) + 0.07 * Math.sin(7 * a);
      const r = Mg.r * f * irreg, y = Mg.h * (1 - f * f) * (0.9 + 0.1 * Math.sin(5 * a)) - 0.3;
      pos.push(Mg.x + r * Math.cos(a), y, Mg.z + r * Math.sin(a));
    }
  }
  for (let k = 0; k < NR; k++) for (let j = 0; j < NA; j++) { const a = b + k * (NA + 1) + j, c = a + NA + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  const uv = [];
  for (let i = 0; i < pos.length; i += 3) uv.push((pos[i] + M) / (2 * M), 1 - (pos[i + 2] + M) / (2 * M));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: texBairro(P, q === 'alta' ? 2048 : 1024, aniso) }));
  m.name = 'fora-bairro';
  return m;
}

/**
 * Prédios do Rio (caixas instanciadas): paredes bege, brancas, ocre e creme com as janelas pequenas e as varandas no shader
 * (andar de 2,9 m), lajes cinza e telhados de barro nos baixos, as janelas acesas à noite (rodada 1: "caixas de vidro").
 */
const TONS_PREDIO = [0xd8cbb0, 0xebe8e0, 0xc9a46a, 0xe2d6bc, 0xbdb8ae, 0xd2a18a, 0xe6e1d3, 0xcdbb94, 0xf0ece2, 0xb9ad98, 0xd9cdb7, 0x9fb1bd, 0xe0c9a6, 0xc7c2b8, 0xddd3c1, 0xa9a49b];
function criarPrediosRio(uNoite, L) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uNoite = uNoite;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;\nvarying vec3 vNP;\nvarying float vAlt;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vMP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vNP = normalize(mat3(instanceMatrix) * objectNormal);
        vAlt = length(instanceMatrix[1].xyz);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uNoite;
        varying vec3 vMP;
        varying vec3 vNP;
        varying float vAlt;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float jan = 0.0; vec2 cel = vec2(0.0);
        if (abs(vNP.y) < 0.5) {
          vec2 t = normalize(vec2(-vNP.z, vNP.x));
          vec2 q = vec2(dot(vMP.xz, t) / 2.4, vMP.y / 2.9);
          cel = floor(q);
          vec2 f = fract(q);
          jan = step(0.3, f.x) * step(f.x, 0.72) * step(0.38, f.y) * step(f.y, 0.78) * step(3.0, vMP.y) * step(vMP.y, vAlt - 1.0);
          float varanda = step(0.0, f.y) * step(f.y, 0.12) * step(3.0, vMP.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.22, 0.24), jan * 0.6);
          diffuseColor.rgb *= 1.0 - 0.12 * varanda;
        } else {
          // o teto: telhado de barro nos baixos, laje cinza com caixa d'água nos altos
          float s = h21(floor(vMP.xz / 30.0));
          diffuseColor.rgb = vAlt < 16.0 && s < 0.7 ? vec3(0.62, 0.34, 0.24) : vec3(0.56, 0.55, 0.52);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += jan * uNoite * step(0.6, h21(cel + vMP.xz * 0.013)) * vec3(1.0, 0.82, 0.55) * 0.85;`);
  };
  mat.customProgramCacheKey = () => 'fora-predios-rio';
  const m = new THREE.InstancedMesh(g, mat, L.length);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Pv = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  L.forEach((p, i) => {
    Q.setFromAxisAngle(Y, -p.rumo);
    M4.compose(Pv.set(p.x, 0, p.z), Q, S.set(p.lx, p.h, p.lz));
    m.setMatrixAt(i, M4);
    m.setColorAt(i, C.setHex(TONS_PREDIO[p.cor % TONS_PREDIO.length]));
  });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.name = 'fora-predios';
  return m;
}

/** As copas de árvore do bairro (octaedros instanciados, verdes variados, achatados). */
function criarArvoresBairro(L) {
  // a copa redonda: o octaedro com a normal da esfera (sem a facetada de pirâmide)
  const g = new THREE.OctahedronGeometry(1, 0);
  const pa = g.attributes.position, na = g.attributes.normal;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), l = Math.hypot(x, y, z) || 1; na.setXYZ(i, x / l, y / l, z / l); }
  g.scale(1, 0.75, 1); g.translate(0, 1.1, 0);
  const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff }), L.length);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Pv = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  const r = gerador(5151);
  L.forEach((a, i) => {
    Q.setFromAxisAngle(Y, r() * 6.28);
    M4.compose(Pv.set(a.x, 0, a.z), Q, S.set(a.raio, a.raio * (0.9 + r() * 0.5), a.raio));
    m.setMatrixAt(i, M4);
    m.setColorAt(i, C.setHSL(0.26 + r() * 0.06, 0.4, 0.17 + r() * 0.09));
  });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.name = 'fora-arvores';
  return m;
}

/**
 * O maciço da Tijuca ao fundo (S/SO): o Corcovado com o Cristo, o Sumaré e o Pico da Tijuca, na DIREÇÃO real e com o
 * tamanho angular real, a ~2,9 km (dentro do alcance da câmera de fora); sem névoa da cena (a névoa de 1,7 km o
 * apagaria) — a cor já vem com a névoa do ar (perspectiva atmosférica).
 */
function criarMontanhas() {
  const R = 2900, NA = 120, a0 = 92 * RAD, a1 = 214 * RAD;
  const picos = [[124, 420, 2.6, 1.6], [157, 470, 7, 1], [149, 430, 5, 1.1], [134, 300, 6, 1], [110, 210, 9, 1], [178, 320, 10, 1], [196, 260, 8, 1], [101, 160, 6, 1]];
  const alt = a => {
    let h = 90 + 40 * Math.sin(a * 7.3) + 25 * Math.sin(a * 19.1);
    for (const [c, hp, w, ag] of picos) { const d = Math.abs(a / RAD - c) / w; h = Math.max(h, hp * Math.exp(-Math.pow(d, ag > 1.2 ? 1.1 : 2) * (ag > 1.2 ? 1.4 : 0.9))); }
    return h;
  };
  const pos = [], cr = [], idx = [];
  // azul-acinzentado com o recorte nítido (rodada 1: "planos pálidos"), o pé na névoa do ar quente
  const perto = cor(0x6d8790), longe = cor(0x8297a8), base = cor(0xa3b4c0);
  for (let j = 0; j <= NA; j++) {
    const a = a0 + ((a1 - a0) * j) / NA, h = alt(a / RAD * RAD), x = Math.cos(a), z = Math.sin(a);
    const rr = R + 250 * Math.sin(a * 3.1);
    const c = perto.clone().lerp(longe, 0.5 + 0.5 * Math.sin(a * 2.3));
    pos.push(x * rr, -40, z * rr, x * rr, h * 0.45, z * rr, x * (rr + 120), h, z * (rr + 120));
    cr.push(base.r, base.g, base.b, c.r, c.g, c.b, c.r * 0.92, c.g * 0.95, c.b * 0.97);
  }
  for (let j = 0; j < NA; j++) for (let k = 0; k < 2; k++) { const a = 3 * j + k, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // o Cristo Redentor no alto do Corcovado (tamanho real na escala da distância)
  const ac = 124 * RAD, hc = alt(ac), xc = Math.cos(ac) * (R + 250 * Math.sin(ac * 3.1) + 120), zc = Math.sin(ac) * (R + 250 * Math.sin(ac * 3.1) + 120);
  const ex = -Math.sin(ac), ez = Math.cos(ac), b0 = pos.length / 3;
  const quadC = (e0, y0, e1, y1) => { const b = pos.length / 3; for (const [e, y] of [[e0, y0], [e1, y0], [e1, y1], [e0, y1]]) { pos.push(xc + ex * e, hc + y, zc + ez * e); cr.push(0.95, 0.95, 0.93); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  quadC(-2.6, -4, 2.6, 21); quadC(-11, 14.5, 11, 17.5); quadC(-5, -10, 5, -3);
  void b0;
  // os morros verdes mais perto (as encostas da Tijuca e de Vila Isabel, ~1,7 km ao S/SO), mata escura com o pé enevoado
  {
    const RN = 1700, N2 = 60, c0 = 138 * RAD, c1 = 262 * RAD, verde = cor(0x4d6a4a), verde2 = cor(0x5d7a55), pe = cor(0x8d9e9c);
    const b = pos.length / 3;
    for (let j = 0; j <= N2; j++) {
      const a = c0 + ((c1 - c0) * j) / N2, x = Math.cos(a), z = Math.sin(a);
      const h = 55 + 70 * Math.max(0, Math.sin(a * 5.3 + 1)) + 45 * Math.max(0, Math.sin(a * 13.1)) + 30 * Math.sin(a * 2.1);
      const rr = RN + 160 * Math.sin(a * 4.7);
      const cc = verde.clone().lerp(verde2, 0.5 + 0.5 * Math.sin(a * 9.1));
      pos.push(x * rr, -10, z * rr, x * (rr + 60), Math.max(20, h), z * (rr + 60));
      cr.push(pe.r, pe.g, pe.b, cc.r, cc.g, cc.b);
    }
    for (let j = 0; j < N2; j++) { const a = b + 2 * j; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  // a serra ao longe no resto do horizonte (N/L: azul-clara, baixa, com o recorte nítido)
  {
    const RS = 3150, N4 = 90, c0 = 214 * RAD, c1 = 452 * RAD, alto = cor(0x93a8bb), pe = cor(0xaabbc8), b = pos.length / 3;
    for (let j = 0; j <= N4; j++) {
      const a = c0 + ((c1 - c0) * j) / N4, x = Math.cos(a), z = Math.sin(a);
      const h = 35 + 55 * Math.max(0, Math.sin(a * 6.1 + 0.5)) + 35 * Math.max(0, Math.sin(a * 15.7)) + 20 * Math.sin(a * 2.7);
      pos.push(x * RS, -20, z * RS, x * RS, Math.max(12, h), z * RS);
      cr.push(pe.r, pe.g, pe.b, alto.r, alto.g, alto.b);
    }
    for (let j = 0; j < N4; j++) { const a = b + 2 * j; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  // o chão de longe (do fim do bairro pintado ao pé das montanhas): a cidade enevoada, sem bordas
  {
    const N3 = 48, raios = [[1250, 0x7b8079], [2000, 0x8e9690], [3300, 0xa3b2bd]], b = pos.length / 3;
    for (const [rr, hx] of raios) {
      const k = cor(hx);
      for (let j = 0; j <= N3; j++) { const a = (2 * Math.PI * j) / N3; pos.push(rr * Math.cos(a), -0.8, rr * Math.sin(a)); cr.push(k.r, k.g, k.b); }
    }
    for (let i = 0; i < raios.length - 1; i++) for (let j = 0; j < N3; j++) { const a = b + i * (N3 + 1) + j, c = a + N3 + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cr, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat);
  m.name = 'fora-montanhas';
  return m;
}

/** Palmeiras-imperiais instanciadas (tronco fino e alto, copa de folhas caídas). */
function criarPalmeiras(P) {
  const L = P.palmeiras();
  const pos = [], cr = [];
  const tronco = cor(0x9a9488), folha = cor(0x3e6b2f);
  const q = (a, b, c, d, k) => { for (const p of [a, b, c, a, c, d]) { pos.push(...p); cr.push(k.r, k.g, k.b); } };
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * 2 * Math.PI, a1 = ((i + 1) / 4) * 2 * Math.PI, r0 = 0.03, r1 = 0.022;
    q([r0 * Math.cos(a0), 0, r0 * Math.sin(a0)], [r0 * Math.cos(a1), 0, r0 * Math.sin(a1)], [r1 * Math.cos(a1), 0.92, r1 * Math.sin(a1)], [r1 * Math.cos(a0), 0.92, r1 * Math.sin(a0)], tronco);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), px = -sa * 0.05, pz = ca * 0.05;
    q([-px, 0.93, -pz], [px, 0.93, pz], [ca * 0.24 + px * 0.3, 0.86, sa * 0.24 + pz * 0.3], [ca * 0.24 - px * 0.3, 0.86, sa * 0.24 - pz * 0.3], folha);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cr, 3));
  g.computeVertexNormals();
  const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), L.length);
  const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), Pv = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const r = gerador(424), C = new THREE.Color();
  L.forEach((p, i) => {
    Qt.setFromAxisAngle(Y, r() * 6.28);
    M4.compose(Pv.set(p.x, 0, p.z), Qt, S.set(p.h, p.h, p.h));
    m.setMatrixAt(i, M4);
    m.setColorAt(i, C.setHSL(0.27, 0.15, 0.8 + r() * 0.25));
  });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.name = 'fora-palmeiras';
  return m;
}

/** A esplanada (sem nada dentro da fachada: lá dentro o chão é o do estádio). */
function criarEsplanada(P, aniso, q) {
  const M = P.entorno.esplanada, Fa = P.forma.fachada;
  const g = new THREE.PlaneGeometry(2 * M, 2 * M);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.06, 0);
  const mat = new THREE.MeshLambertMaterial({ map: texEsplanada(P, q === 'alta' ? 2048 : 1024, aniso) });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMundoE;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundoE = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMundoE;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (dot(vMundoE / vec2(${(Fa.a - 1).toFixed(2)}, ${(Fa.b - 1).toFixed(2)}), vMundoE / vec2(${(Fa.a - 1).toFixed(2)}, ${(Fa.b - 1).toFixed(2)})) < 1.0) discard;`);
  };
  mat.customProgramCacheKey = () => 'fora-esplanada-forma';
  const m = new THREE.Mesh(g, mat);
  m.name = 'fora-esplanada';
  return m;
}

/**
 * O lado de fora com a forma própria (o mesmo contrato de estadio-fora.js criarEstadioFora: {grupo, modoFora,
 * definirHora, atualizar, dispose, info}). pecas: as de estadio-fora.js que servem a qualquer forma (túnel por dentro,
 * bairro, prédios, carros, torcedores chegando).
 */
export function criarForaForma(cena, opc, P, pecas) {
  const q = opc.qualidade ?? 'media', aniso = opc.aniso ?? 4;
  const ident = opc.identidade;
  const uNoite = { value: 0 };
  const grupo = new THREE.Group();
  grupo.name = 'estadio-fora';
  const estrutura = [criarEstrutura(P, q), criarLetreiro(P), ...pecas.criarTunel(ident.fachada)];
  const comEntorno = opc.entorno !== false;
  // o entorno do Rio (rodada 1: sem a grade de prédios de vidro nem os estacionamentos): o bairro pintado com o morro da
  // Mangueira numa malha, os prédios bege/brancos/ocre, as copas de árvore, as palmeiras, os marcos e quem chega
  const entorno = comEntorno ? [criarEsplanada(P, aniso, q), criarChaoBairro(P, aniso, q), criarMontanhas()] : [];
  if (comEntorno && q !== 'baixa') {
    entorno.push(criarPrediosRio(uNoite, P.predios()), criarArvoresBairro(P.bairro().arvores), criarPalmeiras(P), criarMarcos(P, q));
    const t = pecas.criarTorcedores(opc.materialTorcida, ident.torcedoresFora, P.torcedoresFora());
    if (t) entorno.push(t);
  } else if (comEntorno) entorno.push(criarMarcos(P, q));
  for (const m of [...estrutura, ...entorno]) { m.castShadow = false; m.receiveShadow = false; grupo.add(m); }
  cena.add(grupo);
  const [fachada, placa] = estrutura;
  const esplanada = entorno[0], bairro = entorno[1], montanhas = entorno[2];
  function definirHora(h) {
    const noite = h === 'noite';
    uNoite.value = noite ? 1 : 0;
    fachada.material.color.setScalar(noite ? 0.55 : 1);
    fachada.userData.uRebate.value = noite ? 0.12 : 0.5;
    placa.material.color.setScalar(noite ? 0.7 : 1);
    if (esplanada) esplanada.material.color.setScalar(noite ? 0.3 : 1);
    if (bairro) bairro.material.color.setScalar(noite ? 0.26 : 1);
    if (montanhas) montanhas.material.color.setScalar(noite ? 0.12 : 1);
    for (const m of entorno) if (m.name === 'fora-marcos' || m.name === 'fora-arvores' || m.name === 'fora-palmeiras') m.material.color.setScalar(noite ? 0.35 : 1);
    hora = h;
    if (fora) luzDoRio(true);
  }
  // ---- a luz do Rio nos planos de fora, de dia (rodada 1: "céu nublado e esverdeado, sem sombras"): céu azul limpo,
  // sol alto e duro, quase sem névoa (as montanhas com o recorte nítido) e o rebate do chão neutro (concreto, não grama).
  // Só nos planos de fora; de dentro (e no jogo) a luz de render/cena.js volta igual.
  let hora = opc.hora ?? 'dia', fora = false, salvo = null;
  const ceu = cena.getObjectByName('ceu'), hemi = cena.children.find(o => o.isHemisphereLight), sol = cena.children.find(o => o.isDirectionalLight);
  function luzDoRio(v) {
    const liga = v && hora !== 'noite';
    if (liga && !salvo) {
      salvo = {
        topo: ceu?.material.uniforms.uTopo.value.getHex(), hor: ceu?.material.uniforms.uHorizonte.value.getHex(), baixo: ceu?.material.uniforms.uBaixo.value.getHex(),
        nevoa: cena.fog?.color.getHex(), hc: hemi?.color.getHex(), hg: hemi?.groundColor.getHex(), hi: hemi?.intensity, si: sol?.intensity,
      };
      if (ceu) { const U = ceu.material.uniforms; U.uTopo.value.setHex(0x2f73d0); U.uHorizonte.value.setHex(0xa9c8e8); U.uBaixo.value.setHex(0xa3b4c0); }
      if (hemi) { hemi.color.setHex(0xc4d8f0); hemi.groundColor.setHex(0xb0a898); hemi.intensity = 1.5; }
      if (sol) sol.intensity = 3.7;
    } else if (!liga && salvo) {
      if (ceu) { const U = ceu.material.uniforms; U.uTopo.value.setHex(salvo.topo); U.uHorizonte.value.setHex(salvo.hor); U.uBaixo.value.setHex(salvo.baixo); }
      if (cena.fog && salvo.nevoa != null) cena.fog.color.setHex(salvo.nevoa);
      if (hemi) { hemi.color.setHex(salvo.hc); hemi.groundColor.setHex(salvo.hg); hemi.intensity = salvo.hi; }
      if (sol) sol.intensity = salvo.si;
      salvo = null;
    }
    // a névoa do diretor (render/prejogo.js entrarPlano) já foi posta antes de modoFora: aqui ela vai bem mais longe
    if (liga && cena.fog) { cena.fog.color.setHex(0xa9c8e8); cena.fog.near = 900; cena.fog.far = 5200; }
  }
  definirHora(hora);
  let disposto = false;
  return {
    grupo,
    // de dentro a tigela e a cobertura tapam a fachada, as rampas e os pórticos (fora do desenho; o túnel fica)
    modoFora(v) { for (const m of entorno) m.visible = !!v; fachada.visible = placa.visible = !!v; fora = !!v; luzDoRio(fora); },
    definirHora,
    atualizar() {},
    dispose() {
      if (disposto) return;
      disposto = true;
      luzDoRio(false);
      cena.remove(grupo);
      const texs = new Set();
      grupo.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== opc.materialTorcida) {
          for (const k of ['map', 'emissiveMap']) if (o.material[k]) texs.add(o.material[k]);
          o.material.dispose();
        }
        if (o.isInstancedMesh) o.dispose();
      });
      for (const t of texs) t.dispose();
    },
    get info() {
      let tri = 0, pecasN = 0;
      grupo.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        pecasN++;
        const g = o.geometry, b = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        tri += b * (o.isInstancedMesh ? o.count : (g.isInstancedBufferGeometry ? g.instanceCount : 1));
      });
      return { pecas: pecasN, entorno: comEntorno, triangulos: Math.round(tri), predios: P.predios().length, arvores: P.bairro().arvores.length, palmeiras: P.palmeiras().length, carros: 0, torcedores: P.torcedoresFora().length, forma: P.familia };
    },
  };
}
