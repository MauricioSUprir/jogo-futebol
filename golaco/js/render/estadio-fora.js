// Lado de FORA do estádio e o que falta por dentro para o PRÉ-JOGO (desenho: three.js; só existe no pré-jogo e é
// descartado no fim — o estádio do jogo continua o de sempre, porque a câmera de TV fica DENTRO da arquibancada do lado
// de cá e a cobertura entraria no quadro dela). As formas e as posições vêm de estadio-forma.js (puro: o teste dos
// trilhos usa as mesmas): a fachada em volta de tudo (brises, a faixa de LED verde e os portões), a placa "ESTÁDIO
// GOLAÇO" (fictício) sobre a entrada principal, a cobertura em anel, os cantos do lado de cá, o túnel por dentro
// (paredes claras, luzes no teto e a faixa verde), a esplanada (praça, estacionamentos e gramados), o bairro (ruas por
// textura e prédios instanciados com as janelas no shader), árvores, carros e torcedores chegando (o mesmo material
// da torcida). Texturas desenhadas por código (nada a baixar); à noite a faixa de LED, a placa e as janelas acendem.
//
// Estádio real do mandante (TM pro): fachada, face de dentro e marquise por render/fachada-estilos.js (baixado só aí).
//
// Orçamento (PESQUISA-PREJOGO.md §3): ≤ 13 chamadas de desenho e ~20 mil triângulos a mais nos planos de fora (no
// pior, o aéreo: ≤ 40 chamadas e ≤ 130 mil triângulos na Média); nos planos de dentro só a fachada, a cobertura, os
// cantos e o túnel (modoFora(false)). Na Baixa: sem prédios, árvores, carros e torcedores. Nada projeta sombra.
import * as THREE from 'three';
import { ESTADIO } from '../config.js';
import { FORA, predios, arvores, carros, torcedoresFora } from '../estadio-forma.js';
import { ARQUIBANCADA as A } from './torcida-dados.js';
import { criarCanvas, texturaCanvas, gerador, juntarGeometrias } from './util.js';
import { texArquibancada } from './texturas.js';
import { desenharEscudo, imagemEscudo } from './escudo-desenho.js';

// cores do lado de fora (as de hoje; com ?tm, as do mandante: identidade.js fachada)
const FACHADA_PADRAO = { led: '#11a85b', ledNoite: '#19e07a', letreiro: '#19e07a', testeira: '#0d3a25', testeiraFriso: '#19e07a', tunel: '#19e07a', simbolo: '#19e07a' };

// ------------------------------------------------------------------ contorno do retângulo de cantos arredondados
/**
 * Pontos do contorno (hx, hz, raio r) em ordem, com a normal para fora: 4 retas de nReta trechos e 4 arcos de nArco —
 * dois contornos com os mesmos n têm pontos correspondentes (a cobertura liga o de dentro ao de fora).
 */
function contorno(hx, hz, r, nReta = 8, nArco = 10) {
  const cx = hx - r, cz = hz - r;
  const pts = [];
  const reta = (ax, az, bx, bz, nx, nz) => { for (let k = 0; k < nReta; k++) { const t = k / nReta; pts.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, nx, nz }); } };
  const arco = (ox, oz, a0) => { for (let k = 0; k < nArco; k++) { const a = (a0 + 90 * k / nArco) * Math.PI / 180; pts.push({ x: ox + r * Math.cos(a), z: oz + r * Math.sin(a), nx: Math.cos(a), nz: Math.sin(a) }); } };
  reta(hx, -cz, hx, cz, 1, 0); arco(cx, cz, 0);
  reta(cx, hz, -cx, hz, 0, 1); arco(-cx, cz, 90);
  reta(-hx, cz, -hx, -cz, -1, 0); arco(-cx, -cz, 180);
  reta(-cx, -hz, cx, -hz, 0, -1); arco(cx, -cz, 270);
  pts.push({ ...pts[0] });
  let s = 0;
  pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = s; });
  return pts;
}

function geometria(pos, nrm, uv, cor = null, idx = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (cor) g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  if (idx) g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------ texturas (canvas)
const TILE_FACHADA = 12;   // m de fachada por repetição da textura
function texFachada(aniso, emissiva, fa = FACHADA_PADRAO, estilos = null) {
  if (estilos) return estilos.texFachadaEstilo(aniso, emissiva, fa);
  const W = 512, H = 512, F = FORA.fachada;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  const yPx = y => H - (y / F.altura) * H;      // y (m) → linha do canvas
  const xPx = x => (x / TILE_FACHADA) * W;
  if (!emissiva) {
    // concreto da base, vidro escuro com brises, faixa de LED, arremate branco
    g.fillStyle = '#30373b'; g.fillRect(0, yPx(4.6), W, H - yPx(4.6));
    const vidro = g.createLinearGradient(0, yPx(24), 0, yPx(5.2));
    vidro.addColorStop(0, '#22303a'); vidro.addColorStop(1, '#152029');
    g.fillStyle = vidro; g.fillRect(0, yPx(24), W, yPx(5.2) - yPx(24));
    // lajes a cada 4,7 m
    g.fillStyle = '#c9d0d3';
    for (let y = 5.2; y < 24; y += 4.7) g.fillRect(0, yPx(y + 0.25), W, yPx(y) - yPx(y + 0.25));
    // brises verticais (0,35 m a cada 1 m)
    for (let x = 0.3; x < TILE_FACHADA; x += 1) {
      g.fillStyle = '#d9dfe2'; g.fillRect(xPx(x), yPx(24), xPx(0.35), yPx(5.2) - yPx(24));
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(xPx(x + 0.3), yPx(24), xPx(0.05), yPx(5.2) - yPx(24));
    }
    // laje branca sobre a base, faixa de LED e arremate
    g.fillStyle = '#e4e8ea'; g.fillRect(0, yPx(5.2), W, yPx(4.6) - yPx(5.2));
    g.fillStyle = fa.led; g.fillRect(0, yPx(25.7), W, yPx(24) - yPx(25.7));
    g.fillStyle = '#e8ecee'; g.fillRect(0, 0, W, yPx(25.7));
    // portão (no meio da repetição): vão escuro e o letreiro verde em cima
    g.fillStyle = '#0b0e10'; g.fillRect(xPx(4.4), yPx(3.6), xPx(3.2), H - yPx(3.6));
    g.fillStyle = fa.letreiro; g.fillRect(xPx(4.6), yPx(4.2), xPx(2.8), yPx(3.85) - yPx(4.2));
    // juntas do concreto
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < TILE_FACHADA; x += 2) g.fillRect(xPx(x), yPx(4.6), 1, H - yPx(4.6));
  } else {
    // mapa de brilho (noite): LED, portão aceso, um pouco de luz atrás do vidro
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0c1820'; g.fillRect(0, yPx(24), W, yPx(5.2) - yPx(24));
    g.fillStyle = fa.ledNoite; g.fillRect(0, yPx(25.7), W, yPx(24) - yPx(25.7));
    g.fillStyle = '#ffd9a0'; g.fillRect(xPx(4.4), yPx(3.6), xPx(3.2), H - yPx(3.6));
    g.fillStyle = fa.letreiro; g.fillRect(xPx(4.6), yPx(4.2), xPx(2.8), yPx(3.85) - yPx(4.2));
  }
  const t = texturaCanvas(c, { aniso, repetir: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/**
 * Placa com o nome do estádio na fachada. Com ?tm (ident): no estádio real, o escudo do mandante e o nome real (com
 * contorno escuro: a fachada pode ser clara); senão o símbolo do TM; nome comprido demais para uma linha → duas linhas.
 */
function texPlaca(ident = null) {
  const W = 1024, H = 160;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const real = !!(ident && ident.estadio && ident.estadio.real);
  const img = real ? imagemEscudo(ident, 0) : null;
  const simbolo = ident && !real ? ident.estadio?.simboloImg ?? null : null;
  if (!(img && desenharEscudo(g, img, 4, 4, 140, 152)) && !(simbolo && desenharEscudo(g, simbolo, 4, 18, 140, 124))) {
    // símbolo da marca (o paralelogramo verde do placar)
    g.fillStyle = ident ? ident.fachada.simbolo : '#19e07a';
    g.beginPath(); g.moveTo(14, 140); g.lineTo(54, 20); g.lineTo(130, 20); g.lineTo(90, 140); g.closePath(); g.fill();
  }
  g.fillStyle = '#ffffff';
  g.font = '900 104px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  g.textBaseline = 'middle';
  if (real) { g.lineWidth = 8; g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,0.55)'; }
  const escrever = (l, x, y) => { if (real) g.strokeText(l, x, y); g.fillText(l, x, y); };
  const texto = ident ? ident.estadio.placa : FORA.placa.texto;
  const larg = g.measureText(texto).width;
  const k = Math.min(1, (W - 170) / larg);
  const meio = texto.length / 2, esp = [...texto.matchAll(/\s/g)].map(m => m.index).sort((a, b) => Math.abs(a - meio) - Math.abs(b - meio))[0];
  if (ident && k < 0.62 && esp != null) {
    g.font = '900 70px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    [texto.slice(0, esp), texto.slice(esp + 1)].forEach((l, i) => {
      const kl = Math.min(1, (W - 170) / g.measureText(l).width);
      g.save(); g.translate(152, H / 2 + (i ? 38 : -34)); g.scale(kl, 1); escrever(l, 0, 0); g.restore();
    });
  } else { g.save(); g.translate(152, H / 2 + 4); g.scale(k, 1); escrever(texto, 0, 0); g.restore(); }
  return texturaCanvas(c, { aniso: 4 });
}

function texCobertura(fa = FACHADA_PADRAO) {
  const W = 256, H = 64;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  const cc = fa.coberturaTons ?? null;   // estádio real (identidade.js)
  grad.addColorStop(0, cc ? cc.claro : '#e9eef0'); grad.addColorStop(1, cc ? cc.escuro : '#c7cfd3');
  g.fillStyle = grad; g.fillRect(0, 0, W, H - 10);
  // nervuras a cada repetição (6 m)
  g.fillStyle = cc ? cc.nervura : '#8f999e'; g.fillRect(0, 0, 10, H - 10);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(10, 0, 4, H - 10);
  // a faixa de baixo do canvas: a testeira da borda de dentro (verde-escura com friso verde)
  g.fillStyle = fa.testeira; g.fillRect(0, H - 10, W, 10);
  g.fillStyle = fa.testeiraFriso; g.fillRect(0, H - 10, W, 2);
  const t = texturaCanvas(c, { aniso: 4, repetir: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Esplanada inteira (±215 m) num canvas: piso, praça, estacionamentos com as vagas, gramados e a via em volta. */
function texEsplanada(S, aniso) {
  const c = criarCanvas(S, S), g = c.getContext('2d');
  const M = FORA.esplanada.meia, k = S / (2 * M);
  const px = x => (x + M) * k, pz = z => (z + M) * k;
  const ret = (x0, z0, x1, z1) => g.fillRect(px(x0), pz(z0), (x1 - x0) * k, (z1 - z0) * k);
  g.fillStyle = '#8c9194'; g.fillRect(0, 0, S, S);
  // placas de concreto a cada 4 m
  g.fillStyle = 'rgba(0,0,0,0.07)';
  for (let v = -M; v <= M; v += 4) { g.fillRect(px(v), 0, Math.max(1, 0.12 * k), S); g.fillRect(0, pz(v), S, Math.max(1, 0.12 * k)); }
  // gramados nos 4 cantos e a via de fora
  g.fillStyle = '#4f7a3c';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ret(sx > 0 ? 150 : -205, sz > 0 ? 160 : -205, sx > 0 ? 205 : -150, sz > 0 ? 205 : -160);
  g.fillStyle = '#3a3e41';
  ret(-M, -M, M, -M + 10); ret(-M, M - 10, M, M); ret(-M, -M, -M + 10, M); ret(M - 10, -M, M, M);
  g.fillStyle = '#d6d0a0';
  for (let v = -M + 5; v < M - 5; v += 9) { ret(v, -M + 4.9, v + 4, -M + 5.1); ret(v, M - 5.1, v + 4, M - 4.9); ret(-M + 4.9, v, -M + 5.1, v + 4); ret(M - 5.1, v, M - 4.9, v + 4); }
  // praça da entrada principal (pedra clara com faixas) e o caminho até a via
  const P = FORA.praca;
  g.fillStyle = '#b3b0a6'; ret(P.x[0], P.z[0] - 4, P.x[1], P.z[1]);
  g.fillStyle = '#a19d92';
  for (let x = P.x[0] + 5; x < P.x[1]; x += 10) ret(x, P.z[0] - 4, x + 1.2, P.z[1]);
  g.fillStyle = '#c9c4b6'; ret(-9, P.z[0] - 4, 9, M - 10);
  // estacionamentos: asfalto e as vagas (as mesmas posições de estadio-forma.js carros)
  for (const e of FORA.estacionamentos) {
    g.fillStyle = '#34383b'; ret(e.x[0], e.z[0], e.x[1], e.z[1]);
    g.fillStyle = '#e4e6e6';
    for (let z = e.z[0] + 4; z < e.z[1] - 3; z += 6.5) {
      for (let x = e.x[0] + 2 - 1.35; x < e.x[1] - 0.6; x += 2.7) ret(x, z - 2.4, x + 0.12, z + 2.4);
    }
  }
  return texturaCanvas(c, { aniso });
}

/** Uma quadra do bairro (64 m): rua de 12 m nas bordas (6 m de cada lado), calçada, miolo. */
function texBairro(aniso) {
  const S = 512, k = S / 64;
  const c = criarCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#5a6b4c'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#7d7f7c'; g.fillRect(6 * k, 6 * k, 52 * k, 52 * k);           // calçada
  g.fillStyle = '#6c7364'; g.fillRect(9 * k, 9 * k, 46 * k, 46 * k);           // miolo (terreno)
  g.fillStyle = '#323538';                                                       // ruas
  g.fillRect(0, 0, S, 6 * k); g.fillRect(0, S - 6 * k, S, 6 * k); g.fillRect(0, 0, 6 * k, S); g.fillRect(S - 6 * k, 0, 6 * k, S);
  g.fillStyle = '#d8d3a6';                                                       // faixa do meio (tracejada)
  for (let v = 2; v < 64; v += 8) { g.fillRect(v * k, 0, 3.5 * k, 0.18 * k); g.fillRect(v * k, S - 0.18 * k, 3.5 * k, 0.18 * k); g.fillRect(0, v * k, 0.18 * k, 3.5 * k); g.fillRect(S - 0.18 * k, v * k, 0.18 * k, 3.5 * k); }
  return texturaCanvas(c, { aniso, repetir: true });
}

// ------------------------------------------------------------------ peças
function criarFachada(aniso, fa = FACHADA_PADRAO, estilos = null) {
  const F = FORA.fachada;
  const pts = contorno(F.hx, F.hz, F.raio);
  const pos = [], nrm = [], uv = [], idx = [];
  for (const p of pts) {
    pos.push(p.x, 0, p.z, p.x, F.altura, p.z);
    nrm.push(p.nx, 0, p.nz, p.nx, 0, p.nz);
    const u = p.s / TILE_FACHADA;
    uv.push(u, 0, u, 1);
  }
  for (let i = 0; i < pts.length - 1; i++) { const a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const mat = new THREE.MeshLambertMaterial({ map: texFachada(aniso, false, fa, estilos), emissiveMap: texFachada(aniso, true, fa, estilos), emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide });
  if (estilos) estilos.fachadaPorDentro(mat);
  const m = new THREE.Mesh(geometria(pos, nrm, uv, null, idx), mat);
  m.name = 'fora-fachada';
  return m;
}

function criarPlaca(ident = null) {
  const F = FORA.fachada, P = FORA.placa;
  const alt = P.largura * 160 / 1024;
  const g = new THREE.PlaneGeometry(P.largura, alt);
  g.translate(0, (P.y[0] + P.y[1]) / 2, F.hz + F.esp / 2 + 0.25);
  const mat = new THREE.MeshBasicMaterial({ map: texPlaca(ident), transparent: true, alphaTest: 0.35, depthWrite: false, color: 0xeaf6ee });
  const m = new THREE.Mesh(g, mat);
  m.name = 'fora-placa';
  m.renderOrder = 2;
  return m;
}

function criarCobertura(fa = FACHADA_PADRAO, tr = null) {
  const F = FORA.fachada, C = FORA.cobertura;
  const fora = contorno(F.hx, F.hz, F.raio), dentro = contorno(C.hx, C.hz, C.raio);
  const beiral = contorno(F.hx + F.beiral, F.hz + F.beiral, F.raio + F.beiral);
  const pos = [], nrm = [], uv = [], idx = [];
  const n = fora.length;
  // 4 anéis: testeira de baixo, borda de dentro (em cima), fachada, beiral — u pela fachada (6 m), v do canvas; com
  // trechos (tr: os do anel que ficam, identidade.js), um 5º: o arremate de 1,6 m em cima da fachada onde não há cobertura
  const aneis = [
    { pts: dentro, y: C.yDentro - 1.6, v: 0.01 }, { pts: dentro, y: C.yDentro, v: 0.15 },
    { pts: fora, y: C.yFora, v: 0.8 }, { pts: beiral, y: C.yFora - 0.25, v: 0.84 },
  ];
  if (tr) aneis.push({ pts: contorno(F.hx - 1.6, F.hz - 1.6, F.raio - 1.6), y: C.yFora, v: 0.8 });
  for (const a of aneis) a.pts.forEach((p, i) => { pos.push(p.x, a.y, p.z); nrm.push(0, 1, 0); uv.push(fora[i].s / 6, a.v); });
  const quad = (r1, r2, i) => { const a = r1 * n + i, b = r2 * n + i; idx.push(a, b, a + 1, a + 1, b, b + 1); };
  if (!tr) { for (let r = 0; r < 3; r++) for (let i = 0; i < n - 1; i++) quad(r, r + 1, i); }
  else for (let i = 0; i < n - 1; i++) {
    if (tr[i]) { quad(0, 1, i); quad(1, 2, i); } else quad(4, 2, i);
    quad(2, 3, i);
  }
  const g = geometria(pos, nrm, uv, null, idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ map: texCobertura(fa), side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat);
  m.name = 'fora-cobertura';
  return m;
}

/** Cantos do lado de cá (z +): degrau de concreto com cadeiras vazias ligando a arquibancada de cá aos fundos. */
function criarCantos(aniso, qualidade, coresArq = null) {
  const K = FORA.canto, N = 6;
  const pos = [], nrm = [], uv = [], idx = [];
  const vMax = A.vMax;
  for (const s of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = i / N, v = j / N;
      const x = s * (K.x[0] + (K.x[1] - K.x[0]) * u), z = K.z[0] + (K.z[1] - K.z[0]) * v;
      const [y00, y10, y01, y11] = K.y;
      const y = (y00 * (1 - u) + y10 * u) * (1 - v) + (y01 * (1 - u) + y11 * u) * v;
      pos.push(x, y, z); nrm.push(0, 1, 0);
      uv.push(0.04 + 0.2 * (v - u + 1) / 2, vMax * Math.max(u, v));
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = base + j * (N + 1) + i, b = a + N + 1;
      if (s > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = geometria(pos, nrm, uv, null, idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ map: texArquibancada(aniso, false, qualidade === 'baixa' ? 1024 : 2048, coresArq), side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat);
  m.name = 'fora-cantos';
  return m;
}

/** O túnel por dentro: paredes claras, piso de borracha, teto, as luzes do teto e a faixa verde (2 malhas). */
function criarTunel(fa = FACHADA_PADRAO) {
  const T = ESTADIO.tunel, ti = T.largura / 2 - 0.03, y1 = T.altura - 0.03, z0 = T.z + 0.15, z1 = T.z + T.profundidade - 0.05;
  const geos = [], cores = [];
  const parede = new THREE.Color(0xc4cbce), teto = new THREE.Color(0x8d969b), piso = new THREE.Color(0x26332d), fundo = new THREE.Color(0x3c4448);
  const quad = (p0, p1, p2, p3) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p0, ...p2, ...p3], 3));
    g.computeVertexNormals();
    return g;
  };
  for (const s of [-1, 1]) {
    geos.push(s < 0 ? quad([-ti, 0, z0], [-ti, 0, z1], [-ti, y1, z1], [-ti, y1, z0]) : quad([ti, 0, z1], [ti, 0, z0], [ti, y1, z0], [ti, y1, z1])); cores.push(parede);
  }
  geos.push(quad([-ti, y1, z0], [-ti, y1, z1], [ti, y1, z1], [ti, y1, z0])); cores.push(teto);
  geos.push(quad([-ti, 0.025, z1], [-ti, 0.025, z0], [ti, 0.025, z0], [ti, 0.025, z1])); cores.push(piso);
  geos.push(quad([ti, 0, z1], [-ti, 0, z1], [-ti, y1, z1], [ti, y1, z1])); cores.push(fundo);
  const lit = new THREE.Mesh(juntarGeometrias(geos, cores), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  lit.name = 'fora-tunel';
  // luzes do teto e a faixa verde das paredes (sem luz: brilham)
  const g2 = [], c2 = [];
  const branco = new THREE.Color(0xf2f7ff), verde = new THREE.Color(fa.tunel);
  for (let z = z0 + 0.9; z < z1 - 0.8; z += 2.2) for (const x of [-0.9, 0.9]) {
    g2.push(quad([x - 0.22, y1 - 0.01, z], [x - 0.22, y1 - 0.01, z + 1.4], [x + 0.22, y1 - 0.01, z + 1.4], [x + 0.22, y1 - 0.01, z])); c2.push(branco);
  }
  for (const s of [-1, 1]) {
    const x = s * (ti - 0.01);
    g2.push(s < 0 ? quad([x, 1.05, z0], [x, 1.05, z1], [x, 1.28, z1], [x, 1.28, z0]) : quad([x, 1.05, z1], [x, 1.05, z0], [x, 1.28, z0], [x, 1.28, z1])); c2.push(verde);
  }
  const brilho = new THREE.Mesh(juntarGeometrias(g2, c2), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  brilho.name = 'fora-tunel-luzes';
  return [lit, brilho];
}

function criarEsplanada(aniso, qualidade) {
  const M = FORA.esplanada.meia;
  const g = new THREE.PlaneGeometry(2 * M, 2 * M);
  g.rotateX(-Math.PI / 2);
  g.translate(0, FORA.esplanada.y, 0);
  const mat = new THREE.MeshLambertMaterial({ map: texEsplanada(qualidade === 'alta' ? 2048 : 1024, aniso) });
  const F = FORA.fachada;
  // dentro da fachada não há esplanada (o chão do estádio continua o de sempre): descarta pela mesma conta do contorno
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMundoFora;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundoFora = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vMundoFora;
      float sdRet(vec2 p, vec2 h, float r) { vec2 q = abs(p) - (h - r); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (sdRet(vMundoFora, vec2(${F.hx.toFixed(2)}, ${F.hz.toFixed(2)}), ${F.raio.toFixed(2)}) < -0.4) discard;`);
  };
  mat.customProgramCacheKey = () => 'fora-esplanada';
  const m = new THREE.Mesh(g, mat);
  m.name = 'fora-esplanada';
  return m;
}

function criarBairro(aniso) {
  const B = FORA.bairro;
  const g = new THREE.PlaneGeometry(2 * B.meia, 2 * B.meia);
  g.rotateX(-Math.PI / 2);
  g.translate(0, B.y, 0);
  const tex = texBairro(aniso);
  const rep = (2 * B.meia) / 64;
  tex.repeat.set(rep, rep);
  // as ruas no meio dos prédios (estadio-forma.js: quadras de 64 m com o centro em x = 64i + 8, z = 64k − 6)
  tex.offset.set((((-B.meia - 40) / 64) % 1 + 1) % 1, (((-B.meia + 26) / 64) % 1 + 1) % 1);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
  m.name = 'fora-bairro';
  return m;
}

/** Prédios: caixas instanciadas; as janelas saem no shader (andar de 3,2 m), acesas à noite por sorteio da janela. */
function criarPredios(uNoite, L = predios()) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uNoite = uNoite;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;\nvarying vec3 vNP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vMP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vNP = normalize(mat3(instanceMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uNoite;
        varying vec3 vMP;
        varying vec3 vNP;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float jan = 0.0; vec2 cel = vec2(0.0);
        if (abs(vNP.y) < 0.5) {
          vec2 t = normalize(vec2(-vNP.z, vNP.x));
          vec2 q = vec2(dot(vMP.xz, t) / 2.7, vMP.y / 3.2);
          cel = floor(q);
          vec2 f = fract(q);
          jan = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.82) * step(1.0, vMP.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.17, 0.2), jan * 0.75);
        } else {
          diffuseColor.rgb *= 0.78;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += jan * uNoite * step(0.62, h21(cel + vMP.xz * 0.013)) * vec3(1.0, 0.82, 0.55) * 0.85;`);
  };
  mat.customProgramCacheKey = () => 'fora-predios';
  const m = new THREE.InstancedMesh(g, mat, L.length);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const tons = [0xb9b4a9, 0x9aa1a6, 0xc9c2b3, 0x7d8790, 0xd8d4cc, 0xa88f78, 0x8c9a9c, 0xc4b8a0].map(h => new THREE.Color(h));
  const r = gerador(FORA.semente + 7);
  L.forEach((p, i) => {
    Q.setFromAxisAngle(Y, -p.rumo);
    M4.compose(P.set(p.x, 0, p.z), Q, S.set(p.lx, p.h, p.lz));
    m.setMatrixAt(i, M4);
    m.setColorAt(i, tons[Math.floor(r() * tons.length)]);
  });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.name = 'fora-predios';
  return m;
}

function criarArvores() {
  const L = arvores();
  const tronco = new THREE.CylinderGeometry(0.035, 0.05, 0.45, 5); tronco.translate(0, 0.225, 0);
  const copa = new THREE.IcosahedronGeometry(0.32, 0); copa.translate(0, 0.68, 0);
  const g = juntarGeometrias([tronco, copa], [new THREE.Color(0x5a4330), new THREE.Color(0x3f7a35)]);
  const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), L.length);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const r = gerador(FORA.semente + 8), C = new THREE.Color();
  L.forEach((a, i) => {
    Q.setFromAxisAngle(Y, r() * 6.28);
    const k = a.raio / 0.32;
    M4.compose(P.set(a.x, 0, a.z), Q, S.set(k, a.h, k));
    m.setMatrixAt(i, M4);
    m.setColorAt(i, C.setHSL(0.27 + r() * 0.06, 0.45, 0.75 + r() * 0.3));
  });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.name = 'fora-arvores';
  return m;
}

function criarCarros(L = carros()) {
  const corpo = new THREE.BoxGeometry(4.3, 0.85, 1.8); corpo.translate(0, 0.62, 0);
  const cabine = new THREE.BoxGeometry(2.3, 0.6, 1.6); cabine.translate(-0.25, 1.33, 0);
  const g = juntarGeometrias([corpo, cabine], [new THREE.Color(1, 1, 1), new THREE.Color(0.18, 0.2, 0.22)]);
  const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }), L.length);
  const cores = [0xe8eaea, 0x1c1f22, 0x8a9399, 0xb21f24, 0x24467a, 0xc9c9c3, 0x3d4a3f, 0xd8b04a].map(h => new THREE.Color(h));
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  L.forEach((c, i) => {
    Q.setFromAxisAngle(Y, -c.rumo);
    M4.compose(P.set(c.x, FORA.esplanada.y, c.z), Q, S);
    m.setMatrixAt(i, M4);
    m.setColorAt(i, cores[c.cor % cores.length]);
  });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.name = 'fora-carros';
  return m;
}

/** Torcedores chegando: o MESMO material (atlas e shader) da torcida, em pé (como a organizada), no chão da esplanada. */
function criarTorcedores(material, tf = null, L = torcedoresFora()) {
  if (!material || !L.length) return null;
  const n = L.length;
  const pos = new Float32Array(4 * n), cam = new Uint8Array(4 * n), pel = new Uint8Array(4 * n), cab = new Uint8Array(4 * n), inf = new Uint8Array(4 * n);
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const casa = tf ? tf.casa.map(rgb) : [[0x15, 0x19, 0x1b], [0x19, 0xe0, 0x7a], [0x10, 0xb8, 0x62], [0xf2, 0xf4, 0xf3], [0x2b, 0x32, 0x38]];
  const fora = tf ? tf.fora.map(rgb) : [[0xe9, 0xec, 0xee], [0xb9, 0xbf, 0xc4], [0x2b, 0x32, 0x38]];
  const peles = [[0xf1, 0xc7, 0xa5], [0xe3, 0xb0, 0x8a], [0xc9, 0x90, 0x69], [0xa8, 0x71, 0x4d], [0x8d, 0x56, 0x36], [0x6b, 0x3e, 0x25], [0x4b, 0x2b, 0x1b]];
  const cabelos = [[0x16, 0x11, 0x0d], [0x2b, 0x1d, 0x14], [0x4a, 0x32, 0x22], [0x26, 0x30, 0x3a], [0x7a, 0x5a, 0x3a]];
  const r = gerador(FORA.semente + 9);
  const sorteia = l => l[Math.floor(r() * l.length) % l.length];
  L.forEach((t, i) => {
    const k = 4 * i;
    pos[k] = t.x; pos[k + 1] = t.y ?? FORA.esplanada.y; pos[k + 2] = t.z; pos[k + 3] = 0.92 + 0.16 * r();
    const c = t.time ? sorteia(fora) : (r() < 0.55 ? casa[0] : sorteia(casa));
    cam[k] = c[0]; cam[k + 1] = c[1]; cam[k + 2] = c[2]; cam[k + 3] = 255;
    const p = sorteia(peles); pel[k] = p[0]; pel[k + 1] = p[1]; pel[k + 2] = p[2]; pel[k + 3] = Math.floor(r() * 255.99);
    const h = sorteia(cabelos); cab[k] = h[0]; cab[k + 1] = h[1]; cab[k + 2] = h[2]; cab[k + 3] = 255;
    // time, setor 3 (a luz do lado de cá), "organizada" (sempre em pé), semente
    inf[k] = t.time * 255; inf[k + 1] = 255; inf[k + 2] = 255; inf[k + 3] = Math.floor(r() * 255.99);
  });
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  geo.setIndex(new THREE.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 4));
  geo.setAttribute('aCamisa', new THREE.InstancedBufferAttribute(cam, 4, true));
  geo.setAttribute('aPele', new THREE.InstancedBufferAttribute(pel, 4, true));
  geo.setAttribute('aCabelo', new THREE.InstancedBufferAttribute(cab, 4, true));
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(inf, 4, true));
  geo.instanceCount = n;
  const m = new THREE.Mesh(geo, material);
  m.frustumCulled = false;
  m.name = 'fora-torcedores';
  return m;
}

/**
 * Monta o lado de fora na cena. opc = {qualidade, hora, aniso, materialTorcida, entorno (padrão true; false: só a
 * estrutura — o pré-jogo sem plano de fora)}. Devolve {grupo, modoFora(v), definirHora(h), atualizar(t, camera),
 * dispose(), info}.
 */
export function criarEstadioFora(cena, opc = {}) {
  // estádio com forma própria (render/estadio-real.js, sob demanda): a estrutura e o entorno dele, com as peças daqui
  const f3 = opc.identidade?.tm && opc.identidade.forma3d;
  if (f3) return f3.real.criarForaForma(cena, opc, f3.planta, { criarTunel, criarBairro, criarPredios, criarCarros, criarTorcedores, texPlaca });
  const q = opc.qualidade ?? 'media', aniso = opc.aniso ?? 4;
  // com ?tm (identidade.js): o nome do estádio e o escudo do mandante na placa, as cores dele na fachada, na cobertura,
  // no túnel e nos cantos, e as camisas de quem chega (só desenho; nenhuma medida muda)
  const ident = opc.identidade && opc.identidade.tm ? opc.identidade : null;
  const fa = ident ? ident.fachada : FACHADA_PADRAO;
  const estilos = ident && ident.estilos && ident.estilos.ESTILOS.has(fa.estilo) ? ident.estilos : null;   // estádio real
  const uNoite = { value: 0 };
  const grupo = new THREE.Group();
  grupo.name = 'estadio-fora';
  // estrutura (vista também de dentro)
  const estrutura = [criarFachada(aniso, fa, estilos), criarPlaca(ident), criarCobertura(fa, estilos && fa.trechos), criarCantos(aniso, q, ident ? ident.arquibancada : null), ...criarTunel(fa)];
  // o entorno (só nos planos de fora)
  const comEntorno = opc.entorno !== false;
  const entorno = comEntorno ? [criarEsplanada(aniso, q), criarBairro(aniso)] : [];
  if (comEntorno && q !== 'baixa') {
    entorno.push(criarPredios(uNoite), criarArvores(), criarCarros());
    const t = criarTorcedores(opc.materialTorcida, ident ? ident.torcedoresFora : null);
    if (t) entorno.push(t);
  }
  for (const m of [...estrutura, ...entorno]) { m.castShadow = false; m.receiveShadow = false; grupo.add(m); }
  cena.add(grupo);
  const marquise = estilos ? estilos.esconderMarquise(cena, fa.cobertura) : null;   // sem cobertura: some no pré-jogo
  const [fachada, placa] = estrutura;
  const cantos = estrutura[3];
  const [esplanada, bairro] = entorno;
  function definirHora(h) {
    const noite = h === 'noite';
    uNoite.value = noite ? 1 : 0;
    fachada.material.emissiveIntensity = noite ? 0.9 : 0;
    if (estilos) fachada.material.color.setScalar(noite ? 0.6 : 1);   // o LED e as luzes de dentro aparecem acesos
    placa.material.color.setHex(noite ? 0xffffff : 0xeaf6ee);
    // à noite o chão de fora só tem a luz que escapa do estádio e da rua (as luzes da cena são as dos refletores)
    cantos.material.color.setScalar(noite ? 0.42 : 1);
    if (esplanada) esplanada.material.color.setScalar(noite ? 0.3 : 1);
    if (bairro) bairro.material.color.setScalar(noite ? 0.26 : 1);
  }
  definirHora(opc.hora ?? 'dia');
  let disposto = false;
  return {
    grupo,
    /** Planos de fora (o entorno inteiro) ou de dentro (só a estrutura: fachada, cobertura, cantos, túnel). */
    modoFora(v) { for (const m of entorno) m.visible = !!v; },
    definirHora,
    atualizar() { /* nada por quadro: os torcedores andam pelo relógio da torcida (uniforms dela) */ },
    dispose() {
      if (disposto) return;
      disposto = true;
      cena.remove(grupo);
      if (marquise) marquise();
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
      let tri = 0, pecas = 0;
      grupo.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        pecas++;
        const g = o.geometry, base = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        tri += base * (o.isInstancedMesh ? o.count : (g.isInstancedBufferGeometry ? g.instanceCount : 1));
      });
      return { pecas, entorno: comEntorno, triangulos: Math.round(tri), predios: predios().length, arvores: arvores().length, carros: carros().length, torcedores: torcedoresFora().length };
    },
  };
}
