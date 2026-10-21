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
function malha() {
  const pos = [], uv = [], cr = [], idx = [];
  let n = 0;
  return {
    v(x, y, z, u = 0, w = 0, c = BRANCO) { pos.push(x, y, z); uv.push(u, w); cr.push(c.r, c.g, c.b); return n++; },
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
      g.setAttribute('color', new THREE.Float32BufferAttribute(cr, 3));
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
  const gv = g.createLinearGradient(0, yPx(0.40), 0, yPx(0.36));
  gv.addColorStop(0, '#46525c'); gv.addColorStop(1, '#232b32');
  g.fillStyle = gv; g.fillRect(0, yPx(0.40), W, yPx(0.36) - yPx(0.40));
  g.fillStyle = '#7d8790';
  for (let x = 0; x < W; x += W / 24) g.fillRect(x, yPx(0.40), 1.5, yPx(0.36) - yPx(0.40));
  g.fillStyle = '#c3c1bb'; g.fillRect(0, yPx(0.42), W, yPx(0.40) - yPx(0.42));
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
          g.fillRect(x0 + s * w + w * 0.12, yb - hRow * 0.92, w * 0.76, hRow * 0.62);
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(x0 + s * w + w * 0.12, yb - hRow * 0.36, w * 0.76, hRow * 0.08);
        }
      }
    }
    // corredores (escada de concreto)
    for (const lado of [0, 0.5]) {
      g.fillStyle = '#a3a19b'; g.fillRect(lado * W, yPx(v1), corr * W, yPx(v0) - yPx(v1));
      g.fillStyle = 'rgba(0,0,0,0.22)';
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
    g.strokeStyle = 'rgba(150,154,156,0.7)'; g.lineWidth = 2;
    linha(0, 0, 0, 1); linha(1, 0, 1, 1); linha(0.5, 0.05, 0.5, 1);
    // o nó escuro do mastro (o "colar" na linha dos mastros)
    g.fillStyle = '#3b4146'; g.beginPath(); g.arc(1, y(vm), 4.5, 0, 2 * Math.PI); g.arc(0, y(vm), 4.5, 0, 2 * Math.PI); g.fill();
    // painéis solares (azul-marinho) na borda de fora e o anel de compressão cinza
    g.fillStyle = '#1f2b45'; g.fillRect(0, y(0.05), W, y(0.012) - y(0.05));
    g.fillStyle = 'rgba(160,170,190,0.45)';
    for (let x = 0; x < W; x += 8) g.fillRect(x, y(0.05), 1, y(0.012) - y(0.05));
    g.fillStyle = '#b9bdc0'; g.fillRect(0, y(0.012), W, H - y(0.012));
    // a borda de dentro: o cabo e a fileira de refletores
    g.fillStyle = '#5a6066'; g.fillRect(0, 0, W, y(0.988));
    g.fillStyle = '#e9edf0'; for (let x = 3; x < W; x += 10) g.fillRect(x, 1, 5, 3);
  } else {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff6e0'; for (let x = 3; x < W; x += 10) g.fillRect(x, 0, 6, 5);
  }
  const t = texturaCanvas(c, { aniso: 4, repetir: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** O letreiro dos pórticos: letras de forma azul-marinho numa faixa clara. */
function texLetreiro(texto) {
  const W = 2048, H = 128;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#e4e1d8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c9c5ba'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 8, W, 8);
  g.fillStyle = '#1d2a4d';
  g.font = '800 82px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  g.textBaseline = 'middle'; g.textAlign = 'center';
  const larg = g.measureText(texto).width, k = Math.min(1, (W * 0.7) / larg);
  g.save(); g.translate(W / 2, H / 2 + 3); g.scale(k, 1);
  // espaçado como no pórtico (letras separadas)
  const letras = [...texto], esp = 18, tot = letras.reduce((s, l) => s + g.measureText(l).width + esp, -esp);
  let x = -tot / 2;
  g.textAlign = 'left';
  for (const l of letras) { g.fillText(l, x, 0); x += g.measureText(l).width + esp; }
  g.restore();
  return texturaCanvas(c, { aniso: 4 });
}

/** A esplanada do Maracanã (±M m): concreto claro, gramados, estacionamentos, a praça do Bellini, trilhos e avenidas. */
function texEsplanada(P, S, aniso) {
  const M = P.entorno.esplanada, k = S / (2 * M);
  const c = criarCanvas(S, S), g = c.getContext('2d');
  const px = x => (x + M) * k, pz = z => (z + M) * k;
  const ret = (x0, z0, x1, z1) => g.fillRect(px(x0), pz(z0), (x1 - x0) * k, (z1 - z0) * k);
  const circ = (x, z, r) => { g.beginPath(); g.arc(px(x), pz(z), r * k, 0, 2 * Math.PI); g.fill(); };
  g.fillStyle = '#b4b0a5'; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let v = -M; v <= M; v += 6) { g.fillRect(px(v), 0, Math.max(1, 0.12 * k), S); g.fillRect(0, pz(v), S, Math.max(1, 0.12 * k)); }
  // gramados (com as palmeiras) nas bordas e em volta do Maracanãzinho
  g.fillStyle = '#5f8547';
  const Mz = P.entorno.maracanazinho;
  circ(Mz.x, Mz.z, Mz.r + 18);
  for (const [x0, z0, x1, z1] of [[-M, 150, -230, M], [-M, -M, -200, -260], [120, 250, M, M], [-150, 300, 80, M], [-M, -60, -300, 120]]) ret(x0, z0, x1, z1);
  // o Maracanãzinho por cima do gramado: a calçada em volta
  g.fillStyle = '#c4c0b6'; circ(Mz.x, Mz.z, Mz.r + 6);
  // praça do Bellini (pedra clara) no eixo da rampa de cá e a calçada dos pórticos
  g.fillStyle = '#cfcabd'; circ(P.entorno.bellini.x, P.entorno.bellini.z, 34);
  ret(-40, 238, 40, 300); ret(-40, -300, 40, -238);
  // estacionamentos (asfalto com as vagas)
  for (const e of P.estacionamentos) {
    g.fillStyle = '#3a3e41'; ret(e.x[0], e.z[0], e.x[1], e.z[1]);
    g.fillStyle = '#e4e6e6';
    for (let z = e.z[0] + 4; z < e.z[1] - 3; z += 6.5) for (let x = e.x[0] + 2 - 1.35; x < e.x[1] - 0.6; x += 2.7) ret(x, z - 2.4, x + 0.12, z + 2.4);
  }
  // avenida em volta (asfalto) e o rio Maracanã canalizado no lado de cá
  g.fillStyle = '#3c4043';
  ret(-M, -M, M, -M + 14); ret(-M, M - 14, M, M); ret(-M, -M, -M + 14, M); ret(M - 14, -M, M, M);
  g.fillStyle = '#566468'; ret(-60, M - 30, 260, M - 16);
  // trilhos (SuperVia): o leito de brita e os trilhos
  const T = P.entorno.trilhos;
  g.save();
  g.translate(px(T.p[0]), pz(T.p[1]));
  g.rotate(Math.atan2(T.d[1], T.d[0]));
  g.fillStyle = '#6d675d'; g.fillRect(-1200 * k, -T.larg / 2 * k, 2400 * k, T.larg * k);
  g.fillStyle = '#3a342d';
  for (let o = -T.larg / 2 + 4; o < T.larg / 2 - 2; o += 4.6) g.fillRect(-1200 * k, o * k, 2400 * k, Math.max(1, 0.5 * k));
  g.restore();
  // sombra suave em volta da fachada (o prédio tapa o céu)
  const gr = g.createRadialGradient(px(0), pz(0), 120 * k, px(0), pz(0), 175 * k);
  gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.scale(1, 133 / 152); g.translate(0, (px(0) * (1 - 133 / 152)) / (133 / 152)); g.fillStyle = gr; g.fillRect(0, 0, S, S * 152 / 133); g.restore();
  return texturaCanvas(c, { aniso });
}

/** O Morro da Mangueira: casas pequenas coladas (tijolo, laranja, branco, cinza) e o verde lá em cima. */
function texFavela() {
  const S = 512, c = criarCanvas(S, S), g = c.getContext('2d');
  const r = gerador(1928);
  g.fillStyle = '#7b5a43'; g.fillRect(0, 0, S, S);
  const cores = ['#a3553a', '#c4703f', '#d9c9b0', '#b9b5ad', '#8e4a33', '#e2ddd2', '#c99a63', '#6f7b84', '#9b3f2e', '#d8b27a'];
  for (let i = 0; i < 9000; i++) {
    const x = r() * S, y = r() * S, d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
    if (d > 0.98) continue;
    // o alto do morro (o meio do canvas) tem mata
    if (d < 0.22 + r() * 0.12) { g.fillStyle = r() < 0.7 ? '#3f6a32' : '#4f7a3c'; g.fillRect(x, y, 5, 5); continue; }
    g.fillStyle = cores[Math.floor(r() * cores.length)];
    g.fillRect(x, y, 2 + r() * 4, 2 + r() * 3);
  }
  return texturaCanvas(c, { aniso: 2 });
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
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide });
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
    const L = malha();
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
    // bancos de reservas com a cobertura curva transparente (config.js ESTADIO.bancos)
    const B = ESTADIO.bancos, [za, zb] = B.z, h = B.altura;
    const assento = cor(0x2b3442), vidro = cor(0xa9c3d1);
    for (const s of [-1, 1]) {
      const xa = s * B.x[0], xb = s * B.x[1], xc = (xa + xb) / 2, larg = Math.abs(xb - xa);
      L.caixa(xc, 0.25, zb - 0.6, larg, 0.5, 1.2, 0, conc, 5);
      L.caixa(xc, 0.62, zb - 0.6, larg - 0.4, 0.22, 0.9, 0, assento, 5);
      L.caixa(xc, 0.95, zb - 0.12, larg - 0.4, 0.7, 0.12, 0, assento, 5);
      // o arco (3 painéis) de vidro fosco
      const arco = [[zb, 0.3], [zb + 0.05, h], [zb - 1.2, h + 0.25], [za - 0.2, h - 0.3]];
      for (let k = 0; k + 1 < arco.length; k++) L.q4([xa, arco[k][1], arco[k][0]], [xb, arco[k][1], arco[k][0]], [xb, arco[k + 1][1], arco[k + 1][0]], [xa, arco[k + 1][1], arco[k + 1][0]], vidro);
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
      new THREE.Box3(new THREE.Vector3(-B.x[1] - 0.5, -0.1, B.z[0] - 0.8), new THREE.Vector3(B.x[1] + 0.5, B.altura + 0.4, T.z)),
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
  const amp = u => Math.pow(Math.sin(Math.PI * u), 0.6);
  // membrana: por cima branca, por baixo creme translúcida (gl_FrontFacing; o lado de cima é a frente)
  const L = malha();
  const linhas = us.map(() => []);
  for (let j = 0; j <= N; j++) {
    const th = -Math.PI + (2 * Math.PI * j) / N, nerv = j % (N / C.eixos) === 0;
    us.forEach((u, k) => {
      const [x, z] = P.pontoCob(th, u);
      const y = P.alturaCob(u) + (q === 'baixa' ? 0 : amp(u) * (nerv ? 0.5 : -1.35));
      linhas[k].push(L.v(x, y, z, (th / (2 * Math.PI)) * C.eixos, u));
    });
  }
  for (let k = 0; k + 1 < us.length; k++) for (let j = 0; j < N; j++) L.quad(linhas[k][j], linhas[k + 1][j], linhas[k + 1][j + 1], linhas[k][j + 1]);
  // a face do anel de compressão (cinza-claro, 2 m) por fora
  const fora0 = [], fora1 = [];
  for (let j = 0; j <= N; j++) {
    const th = -Math.PI + (2 * Math.PI * j) / N, r = P.rCobFora(th) + 0.4;
    fora0.push(L.v(r * Math.cos(th), C.yFora - 1.9, r * Math.sin(th), (th / (2 * Math.PI)) * C.eixos, 0.004));
    fora1.push(L.v(r * Math.cos(th), C.yFora + 0.05, r * Math.sin(th), (th / (2 * Math.PI)) * C.eixos, 0.006));
  }
  for (let j = 0; j < N; j++) L.quad(fora0[j], fora0[j + 1], fora1[j + 1], fora1[j]);
  const geo = L.geo();
  geo.deleteAttribute('color');
  const uCreme = { value: new THREE.Color(0xe7e0ce) }, uTransl = { value: 0.62 };
  const matM = new THREE.MeshLambertMaterial({ map: texCobertura(P, false), emissiveMap: texCobertura(P, true), emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide, flatShading: q !== 'baixa' });
  matM.onBeforeCompile = sh => {
    sh.uniforms.uCreme = uCreme; sh.uniforms.uTransl = uTransl;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCreme;\nuniform float uTransl;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (!gl_FrontFacing && vMapUv.y > 0.012) diffuseColor.rgb = uCreme;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (!gl_FrontFacing && vMapUv.y > 0.012) totalEmissiveRadiance += uCreme * uTransl;');
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
  // a passarela: face de dentro (os refletores, claros), de fora e o fundo
  anel(P.uMastro, yP - 0.6, yP + 0.6, luz, -1.2);
  anel(P.uMastro, yP - 0.6, yP + 0.6, escuro, 1.2);
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
    if (q !== 'baixa') { fita(p(0.02, C.yFora - 1.9), p(P.uMastro, yP - 0.6), 0.16, cabo); fita(p(P.uMastro, yP - 0.6), p(0.995, C.yDentro - 0.4), 0.16, cabo); }
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
      uTransl.value = noite ? 0.28 : 0.62;
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
  const conc = cor(0xb3b1aa), concClaro = cor(0xd6d4cd), concEsc = cor(0x96948d), fundo = cor(0x4b5157), terreo = cor(0x5f6366);
  const almof = cor(0xf4f3ee), vidro = cor(0x6a8394), amarelo = cor(0xe8b52a), lajeTopo = cor(0x6f7275);
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
    // torres de vidro (escadas e elevadores novos) em alguns vãos
    if (k % 10 === 3) {
      const ta = t + 0.6 / A, tb = (2 * Math.PI * (k + 1.5)) / NE - 0.6 / A;
      L.q4(pt(ta, 0.6, 0), pt(tb, 0.6, 0), pt(tb, 0.9, Fa.cinta - 1), pt(ta, 0.9, Fa.cinta - 1), vidro);
    }
    // faixas amarelas dos acessos no térreo
    if (k % 5 === 1) L.q4(pt(t + 1.2 / A, 3.25, 3.4), pt(t + 9 / A, 3.25, 3.4), pt(t + 9 / A, 3.25, 4.2), pt(t + 1.2 / A, 3.25, 4.2), amarelo);
  }
  // ---- rampas (2 pistas sobre pilares) e pórticos, nos dois lados compridos
  const deck = cor(0xc6c3ba), deckBaixo = cor(0x8f8c85), pilar = cor(0xd3d0c8), poste = cor(0x6a6f73), coluna = cor(0xe3e0d8);
  const z0 = Fa.b + 1.5;
  for (const lado of [1, -1]) {
    const Z = z => lado * z;
    for (const [xa, xb] of [[-R.larg / 2, -2], [2, R.larg / 2]]) {
      const yA = P.yRampa(z0), yB = P.yRampa(R.zFim);
      // tabuleiro: topo, fundo e as duas bordas; guarda-corpo dos dois lados
      L.q4([xa, yA, Z(z0)], [xb, yA, Z(z0)], [xb, yB, Z(R.zFim)], [xa, yB, Z(R.zFim)], deck);
      L.q4([xa, yA - 0.9, Z(z0)], [xb, yA - 0.9, Z(z0)], [xb, yB - 0.9, Z(R.zFim)], [xa, yB - 0.9, Z(R.zFim)], deckBaixo);
      for (const x of [xa, xb]) {
        L.q4([x, yA - 0.9, Z(z0)], [x, yA + 1.1, Z(z0)], [x, yB + 1.1, Z(R.zFim)], [x, yB - 0.9, Z(R.zFim)], concClaro);
      }
      // pilares redondos a cada ~10 m
      for (let z = z0 + 9; z < R.zFim - 6; z += 10) {
        const y = P.yRampa(z) - 0.9;
        if (y < 1) continue;
        for (const x of [xa + 2.5, xb - 2.5]) L.coluna(x, 0, Z(z), y, 0.45, pilar, q === 'baixa' ? 4 : 6);
      }
      // postes de luz
      if (q !== 'baixa') for (let z = z0 + 14; z < R.zFim; z += 22) {
        const y = P.yRampa(z);
        for (const x of [xa + 0.3, xb - 0.3]) { L.caixa(x, y + 3.5, Z(z), 0.18, 7, 0.18, 0, poste, 4); L.caixa(x, y + 7, Z(z), 1.2, 0.25, 0.4, 0, poste, 6); }
      }
    }
    // pórtico em arco, concêntrico: duas fileiras de colunas, a laje de cima e o leque de degraus
    const Pt = R.portico, meia = Pt.larg / 2 / Pt.r;
    const thC = lado > 0 ? Math.PI / 2 : -Math.PI / 2;
    const NA = 9;
    for (const rr of [Pt.r - 5.5, Pt.r + 5.5]) for (let i = 0; i < NA; i++) {
      const th = thC - meia + (2 * meia * i) / (NA - 1);
      L.coluna(rr * Math.cos(th), 0, rr * Math.sin(th), Pt.alt, 0.55, coluna, q === 'baixa' ? 5 : 8);
    }
    const NSeg = 10, arcoPt = (rr, i, y) => { const th = thC - meia * 1.04 + (2.08 * meia * i) / NSeg; return [rr * Math.cos(th), y, rr * Math.sin(th)]; };
    for (let i = 0; i < NSeg; i++) {
      const r0 = Pt.r - 7, r1 = Pt.r + 7, y0 = Pt.alt, y1 = Pt.alt + 1.3;
      L.q4(arcoPt(r0, i, y1), arcoPt(r0, i + 1, y1), arcoPt(r1, i + 1, y1), arcoPt(r1, i, y1), concClaro);
      L.q4(arcoPt(r0, i, y0), arcoPt(r0, i + 1, y0), arcoPt(r1, i + 1, y0), arcoPt(r1, i, y0), concEsc);
      for (const rr of [r0, r1]) L.q4(arcoPt(rr, i, y0), arcoPt(rr, i + 1, y0), arcoPt(rr, i + 1, y1), arcoPt(rr, i, y1), coluna);
      // a faixa intermediária (as costas do letreiro) e os degraus em leque
      L.q4(arcoPt(Pt.r + 5.4, i, 4.5), arcoPt(Pt.r + 5.4, i + 1, 4.5), arcoPt(Pt.r + 5.4, i + 1, 6.5), arcoPt(Pt.r + 5.4, i, 6.5), concClaro);
      for (let d = 0; d < 3; d++) L.q4(arcoPt(Pt.r + 8 + d * 1.6, i, 0.55 - d * 0.18), arcoPt(Pt.r + 8 + d * 1.6, i + 1, 0.55 - d * 0.18), arcoPt(Pt.r + 9.6 + d * 1.6, i + 1, 0.55 - d * 0.18), arcoPt(Pt.r + 9.6 + d * 1.6, i, 0.55 - d * 0.18), concClaro);
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
  const m = new THREE.Mesh(L.geo(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.name = 'fora-fachada';
  return m;
}

/** O letreiro "ESTÁDIO MÁRIO FILHO" na faixa dos dois pórticos (de frente para fora). */
function criarLetreiro(P) {
  const R = P.forma.rampas, Pt = R.portico, meia = (Pt.larg / 2 / Pt.r) * 0.7, r = Pt.r + 5.95, NSeg = 12;
  const pos = [], uv = [], idx = [];
  for (const lado of [1, -1]) {
    const thC = lado > 0 ? Math.PI / 2 : -Math.PI / 2, b = pos.length / 3;
    for (let i = 0; i <= NSeg; i++) {
      // visto de fora, a esquerda de quem lê fica em −x no lado de cá (+z) e em +x no de lá (−z)
      const u = i / NSeg, th = thC + meia * (1 - 2 * u);
      for (const [y, v] of [[4.75, 0], [6.25, 1]]) { pos.push(r * Math.cos(th), y, r * Math.sin(th)); uv.push(u, v); }
    }
    for (let i = 0; i < NSeg; i++) { const a = b + 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
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
  // Maracanãzinho: a parede de colunas e o domo branco com o óculo
  {
    const M = E.maracanazinho, N = q === 'baixa' ? 24 : 40, NR = 6;
    const anel = (r, y, c) => Array.from({ length: N + 1 }, (_, j) => { const a = (2 * Math.PI * j) / N; return L.v(M.x + r * Math.cos(a), y, M.z + r * Math.sin(a), 0.7, 0.005, c); });
    const a0 = anel(M.r, 0, escuro), a1 = anel(M.r, M.parede, escuro);
    for (let j = 0; j < N; j++) L.quad(a0[j], a0[j + 1], a1[j + 1], a1[j]);
    let prev = anel(M.r + 1.2, M.parede, branco);
    for (let k = 1; k <= NR; k++) {
      const f = k / NR, r = (M.r + 1.2) * Math.cos(f * Math.PI / 2 * 0.93), y = M.parede + M.cupula * Math.sin(f * Math.PI / 2 * 0.93);
      const cur = anel(Math.max(r, 7), y, k === NR ? cinzaC : branco);
      for (let j = 0; j < N; j++) L.quad(prev[j], prev[j + 1], cur[j + 1], cur[j]);
      prev = cur;
    }
    // o óculo (a lanterna de cima)
    const top = anel(7, M.parede + M.cupula + 2.2, cinzaC);
    for (let j = 0; j < N; j++) L.quad(prev[j], prev[j + 1], top[j + 1], top[j]);
    // as nervuras da cúpula (o friso em volta)
    const fr0 = anel(M.r + 1.6, M.parede - 0.2, cinzaC), fr1 = anel(M.r + 1.6, M.parede + 1.2, cinzaC);
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
  // parque aquático: o prédio baixo e a piscina
  {
    const { x, z } = E.aquatico;
    L.caixa(x, 5, z, 60, 10, 34, 0.3, cinzaC, 5);
    L.q4([x - 30, 10.05, z - 14], [x + 30, 10.05, z - 14], [x + 30, 10.05, z + 14], [x - 30, 10.05, z + 14], cor(0xd8d6cf));
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

/** O Morro da Mangueira (o morro com as casas, a NO, depois dos trilhos). */
function criarMorro(P) {
  const M = P.entorno.mangueira, NA = 28, NR = 6;
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= NR; k++) {
    const f = k / NR;
    for (let j = 0; j <= NA; j++) {
      const a = (2 * Math.PI * j) / NA, irreg = 1 + 0.12 * Math.sin(3 * a + 1) + 0.07 * Math.sin(7 * a);
      const r = M.r * f * irreg, y = M.h * (1 - f * f) * (0.9 + 0.1 * Math.sin(5 * a)) - 0.3;
      const x = M.x + r * Math.cos(a), z = M.z + r * Math.sin(a);
      pos.push(x, y, z); uv.push(0.5 + 0.5 * f * Math.cos(a), 0.5 + 0.5 * f * Math.sin(a));
    }
  }
  for (let k = 0; k < NR; k++) for (let j = 0; j < NA; j++) { const a = k * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: texFavela(), side: THREE.DoubleSide }));
  m.name = 'fora-morro';
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
  const perto = cor(0x8fa3a3), longe = cor(0xa9b9bd), base = cor(0xb7c3c4);
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
  const entorno = comEntorno ? [criarEsplanada(P, aniso, q), pecas.criarBairro(aniso), criarMontanhas()] : [];
  if (comEntorno && q !== 'baixa') {
    entorno.push(pecas.criarPredios(uNoite, P.predios()), criarPalmeiras(P), pecas.criarCarros(P.carros()), criarMarcos(P, q), criarMorro(P));
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
    placa.material.color.setScalar(noite ? 0.7 : 1);
    if (esplanada) esplanada.material.color.setScalar(noite ? 0.3 : 1);
    if (bairro) bairro.material.color.setScalar(noite ? 0.26 : 1);
    if (montanhas) montanhas.material.color.setScalar(noite ? 0.12 : 1);
    for (const m of entorno) if (m.name === 'fora-marcos' || m.name === 'fora-morro' || m.name === 'fora-palmeiras') m.material.color.setScalar(noite ? 0.35 : 1);
  }
  definirHora(opc.hora ?? 'dia');
  let disposto = false;
  return {
    grupo,
    // de dentro a tigela e a cobertura tapam a fachada, as rampas e os pórticos (fora do desenho; o túnel fica)
    modoFora(v) { for (const m of entorno) m.visible = !!v; fachada.visible = placa.visible = !!v; },
    definirHora,
    atualizar() {},
    dispose() {
      if (disposto) return;
      disposto = true;
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
      return { pecas: pecasN, entorno: comEntorno, triangulos: Math.round(tri), predios: P.predios().length, palmeiras: P.palmeiras().length, carros: P.carros().length, torcedores: P.torcedoresFora().length, forma: P.familia };
    },
  };
}
