// Desenho do estádio de FORMA GENÉRICA (three.js; sob demanda: só na edição pro do Total Match com um estádio da base que
// tem `forma` de uma das famílias de estadio-generico.js — tigela, inglesa, arena, pista, pequeno; o Maracanã continua em
// render/estadio-real.js). As contas (onde fica cada fileira, a cobertura, a fachada, o entorno) são as da planta
// (estadio-generico.js, pura): o desenho, a torcida, os sólidos da câmera e os trilhos do pré-jogo usam as MESMAS. Só
// desenho: a simulação não muda.
//
// O jogo (render/campo.js criarCampo → criarTigela): as arquibancadas em 3 malhas com os MESMOS nomes do Maracanã (o lado
// de lá; os fundos com a pista de atletismo; o lado de cá com o túnel, os bancos e a cobertura dele — sai do desenho com a
// câmera de TV dentro dele) e a cobertura em 2 (a chapa e a estrutura: treliça, pilares, mastros, cabos, arco, telões e as
// torres de refletor quando não há cobertura). Nos cantos abertos cada arquibancada termina numa empena reta.
// O pré-jogo (render/estadio-fora.js criarEstadioFora → criarForaForma): a fachada pelo estilo da pesquisa (a mesma
// textura de render/fachada-estilos.js), a placa com o nome, as marcas próprias (o arco, as torres com rampa em espiral,
// os mastros, a estátua, o ginásio de cúpula) e o entorno pelo tipo (cidade densa, bairro, parque, galpões, campo, orla,
// campus; morros ou montanhas no horizonte; rio, lago ou mar).
// Orçamento: no jogo as mesmas 5 chamadas do Maracanã (3 das arquibancadas + 2 da cobertura); no pré-jogo ≤ 14 peças de fora.
import * as THREE from 'three';
import { ESTADIO, CAMPO } from '../config.js';
import { criarCanvas, texturaCanvas, gerador, juntarGeometrias } from './util.js';
import { definirForma } from '../estadio-forma.js';
import { definirLadoDeCa } from './torcida-dados.js';
import { definirFormaBandeiras } from './bandeiras-dados.js';
import { PONTOS_SINALIZADOR } from './festa.js';
import { CAMERA_GERAL } from './camera.js';
import { texFachadaEstilo, fachadaPorDentro } from './fachada-estilos.js';
import { PISTA } from '../estadio-generico.js';

const RAD = Math.PI / 180;
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
const cor = h => new THREE.Color(h);
const BRANCO = cor(0xffffff);
const mistura = (a, b, t) => cor(a).lerp(cor(b), t);

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
// uv 0,7/0,005 é o branco puro do atlas das cadeiras (e o "normal" do atlas da estrutura): as peças por cor de vértice
const UV_BRANCO = [0.72, 0.006];
function malha() {
  const pos = [], uv = [], cr = [], idx = [];
  let n = 0;
  return {
    v(x, y, z, u = UV_BRANCO[0], w = UV_BRANCO[1], c = BRANCO) { pos.push(x, y, z); uv.push(u, w); cr.push(c.r, c.g, c.b); return n++; },
    tri(a, b, c) { idx.push(a, b, c); },
    quad(a, b, c, d) { idx.push(a, b, c, a, c, d); },
    /** Quadrilátero solto (vértices próprios: aresta viva); uvs: [[u, v] × 4] ou um par para os 4. */
    q4(p0, p1, p2, p3, c = BRANCO, uvs = null) {
      const U = uvs && Array.isArray(uvs[0]) ? uvs : [uvs ?? UV_BRANCO, uvs ?? UV_BRANCO, uvs ?? UV_BRANCO, uvs ?? UV_BRANCO];
      const a = this.v(...p0, ...U[0], c), b = this.v(...p1, ...U[1], c), d = this.v(...p2, ...U[2], c), e = this.v(...p3, ...U[3], c);
      this.quad(a, b, d, e);
    },
    /** Caixa alinhada a um rumo h (cx, cy, cz no centro; w ao longo do rumo, a na altura, d de lado). */
    caixa(cx, cy, cz, w, a, d, h, c, faces = 6, uvs = null) {
      const ch = Math.cos(h), sh = Math.sin(h);
      const P = (i, j, k) => [cx + ch * i * w / 2 - sh * k * d / 2, cy + j * a / 2, cz + sh * i * w / 2 + ch * k * d / 2];
      const F = [[[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
        [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
        [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]];
      for (let f = 0; f < faces; f++) this.q4(...F[f].map(p => P(...p)), c, uvs);
    },
    /** Barra de seção quadrada (lado e) de a até b. */
    barra(a, b, e, c, uvs = null) {
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
      if (L < 1e-6) return;
      const t = d.map(v => v / L);
      const up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let n1 = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
      const l1 = Math.hypot(...n1); n1 = n1.map(v => (v / l1) * e / 2);
      const n2 = [t[1] * n1[2] - t[2] * n1[1], t[2] * n1[0] - t[0] * n1[2], t[0] * n1[1] - t[1] * n1[0]];
      const Q = (p, s1, s2) => [p[0] + n1[0] * s1 + n2[0] * s2, p[1] + n1[1] * s1 + n2[1] * s2, p[2] + n1[2] * s1 + n2[2] * s2];
      const cs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
      for (let i = 0; i < 4; i++) { const [a1, a2] = cs[i], [b1, b2] = cs[(i + 1) % 4]; this.q4(Q(a, a1, a2), Q(a, b1, b2), Q(b, b1, b2), Q(b, a1, a2), c, uvs); }
    },
    /** Cilindro liso (vértices compartilhados: normal redonda) de (x, y0, z) a y1, raio r (r1 em cima). */
    cilindro(x, y0, z, y1, r, c, n = 14, r1 = r, uvs = UV_BRANCO) {
      const b = [];
      for (let i = 0; i <= n; i++) { const a = (2 * Math.PI * i) / n; b.push(this.v(x + r * Math.cos(a), y0, z + r * Math.sin(a), uvs[0], uvs[1], c), this.v(x + r1 * Math.cos(a), y1, z + r1 * Math.sin(a), uvs[0], uvs[1], c)); }
      for (let i = 0; i < n; i++) this.quad(b[2 * i], b[2 * i + 2], b[2 * i + 3], b[2 * i + 1]);
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
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hexDe = c => '#' + c.map(v => clampN(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const tom = (h, k) => hexDe(rgb(h).map(v => v * k));
/**
 * As cadeiras: o ladrilho de 12 m (2 corredores de 1,2 m, u) × a profundidade inteira (v 0,04 → 0,97: 40 fileiras), nas
 * cores e no padrão da pesquisa (liso, misto: as cadeiras sorteadas entre as cores; faixas: uma cor por anel; mosaico:
 * blocos). v < 0,012 é branco puro: o retalho das peças por cor de vértice (faces, corredores, mureta, empenas).
 */
function texCadeiras(P, q, aniso) {
  const W = q === 'baixa' ? 256 : 512, H = q === 'baixa' ? 512 : 1024;
  const c = criarCanvas(W, H), g = c.getContext('2d');
  const yPx = v => (1 - v) * H;
  const r = gerador(P.forma.semente || 7);
  const cs = P.forma.cadeiras, padrao = P.forma.padrao;
  const pal = cs.length >= 2 ? cs : [cs[0], tom(cs[0], 0.82)];
  g.fillStyle = '#ffffff'; g.fillRect(0, yPx(0.012), W, H - yPx(0.012));
  g.fillStyle = '#9d9c97'; g.fillRect(0, yPx(0.04), W, yPx(0.012) - yPx(0.04));
  g.fillStyle = '#b8b6af'; g.fillRect(0, 0, W, yPx(0.97));
  const NR = 40, v0 = 0.04, v1 = 0.97, hRow = (yPx(v0) - yPx(v1)) / NR;
  const corr = 0.1;      // 1,2 m de 12 m
  const corDe = (k, s, xs) => {
    if (padrao === 'misto') { const x = r(); return x < 0.56 ? pal[0] : x < 0.86 ? pal[1] : pal[2] ?? pal[0]; }
    if (padrao === 'faixas') return pal[Math.min(pal.length - 1, Math.floor((k / NR) * Math.min(3, pal.length)))];
    if (padrao === 'mosaico') return ((Math.floor(xs * 4) + Math.floor(k / 5)) % 3 === 0) ? pal[1] : pal[0];
    const x = r(); return x < 0.9 ? pal[0] : tom(pal[0], 0.86);
  };
  for (let k = 0; k < NR; k++) {
    const yb = yPx(v0) - k * hRow;
    g.fillStyle = '#5e5d59'; g.fillRect(0, yb - hRow, W, hRow);
    g.fillStyle = '#8c8a84'; g.fillRect(0, yb - hRow * 0.3, W, hRow * 0.3);
    for (const lado of [0, 0.5]) {
      const x0 = (lado + corr) * W, x1 = (lado + 0.5) * W, nS = 9, w = (x1 - x0) / nS;
      for (let s = 0; s < nS; s++) {
        g.fillStyle = corDe(k, s, lado + (s / nS) * 0.5);
        g.fillRect(x0 + s * w + w * 0.07, yb - hRow * 0.95, w * 0.86, hRow * 0.76);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(x0 + s * w + w * 0.07, yb - hRow * 0.26, w * 0.86, hRow * 0.08);
      }
    }
  }
  for (const lado of [0, 0.5]) {
    g.fillStyle = '#76746e'; g.fillRect(lado * W, yPx(v1), corr * W, yPx(v0) - yPx(v1));
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let k = 0; k < 2 * NR; k++) g.fillRect(lado * W, yPx(v0) - k * (yPx(v0) - yPx(v1)) / (2 * NR), corr * W, 1.5);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect((lado + corr) * W - 1.5, yPx(v1), 1.5, yPx(v0) - yPx(v1));
  }
  const t = texturaCanvas(c, { aniso, repetir: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
/** Atlas 8 × 8 da estrutura: metade esquerda normal (branca), metade direita acesa à noite (as lâmpadas, o telão). */
function texEstrutura(emissiva) {
  const c = criarCanvas(8, 8), g = c.getContext('2d');
  g.fillStyle = emissiva ? '#000000' : '#ffffff'; g.fillRect(0, 0, 4, 8);
  g.fillStyle = emissiva ? '#fff4dc' : '#ffffff'; g.fillRect(4, 0, 4, 8);
  const t = texturaCanvas(c);
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}
const UV_NORMAL = [0.25, 0.5], UV_ACESO = [0.75, 0.5];

// ------------------------------------------------------------------ as arquibancadas
/**
 * As arquibancadas do jogo: um THREE.Group com as malhas 'arquibancada-lado' (setor 0), 'arquibancada-fundos' (setores 1
 * e 2 + a pista), 'arquibancada-ca' (setor 3, o túnel, os bancos e a cobertura do lado de cá; userData.caixas),
 * 'cobertura' e 'cobertura-estrutura'; userData {materiais, ladoDeCa, definirHora}.
 */
export function criarTigela(P, opc = {}) {
  const q = opc.qualidade ?? 'media', aniso = opc.aniso ?? 4;
  const F = P.forma, T = ESTADIO.tunel, LD = ['la', 'fa', 'fb', 'ca'].map(k => F.lados[k]);
  const NCOL = q === 'alta' ? 176 : q === 'baixa' ? 96 : 128;
  const tex = texCadeiras(P, q, aniso);
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide });
  if (opc.comLuzFalsa) opc.comLuzFalsa(mat, 'tigela');
  const fa = F.fachada;
  const concreto = cor(0xb9b7b0), concretoEsc = cor(0x8f8d88), mureta = cor(0x9d9c97);
  const vidro = cor(0x52677a), piso = cor(0x9f9d97);
  const empena = mistura(fa.cor, '#a9a7a1', 0.45);
  const SOMBRA = new THREE.Color().setScalar(0.55);
  const sombra = (x, y, z) => (P.luzDoSol(x, y + 0.3, z) < 1 ? SOMBRA : BRANCO);
  const mt = T.largura / 2 + 0.4, ti = T.largura / 2, ya = T.altura, ytt = T.altura + T.laje;
  const vDe = s => 0.04 + 0.93 * clampN(s, 0, 1);
  // a fileira onde o degrau do lado de cá passa do teto do túnel (as cadeiras em cima da boca começam ali)
  const sTunel = (() => { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (P.perfilLado(3, m) < ytt + 0.3) lo = m; else hi = m; } return (lo + hi) / 2; })();
  /** Uma arquibancada (um trecho da planta) na malha L: as faixas do perfil, a mureta, o parapeito, as empenas. */
  function arquibancada(L, tr) {
    const k = tr.k;
    let aneis = (tr.fechado ? P.sAneis : P.nos[k].map(n => n[0])).slice();
    if (k === 3) aneis.push(sTunel);
    aneis = [...new Set(aneis.map(s => Math.round(s * 1e5) / 1e5))].sort((a, b) => a - b);
    const yEm = (s, th) => (tr.fechado ? P.perfil(s, th) : P.perfilLado(k, s));
    const tipoEm = (s, th) => P.tipoEm(tr.fechado ? P.ladoEm(th) : k, s);
    // as colunas de cada anel (nos cantos abertos mudam de anel para anel: a ponta é uma reta)
    let cols0 = tr.cols(0);
    if (k === 3 && tr.fechado) {
      const thA = Math.atan2(T.z, mt), thB = Math.atan2(T.z, -mt);
      for (const e of [thA, thB]) if (!cols0.some(x => Math.abs(x - e) < 1e-6)) cols0.push(e);
      cols0.sort((a, b) => a - b);
    }
    const colsDe = s => {
      if (tr.fechado) return cols0;
      const l = tr.cols(s);
      if (k !== 3) return l;
      // o lado de cá aberto: as paredes do túnel também viram colunas (x = ±mt)
      const xs = l.map(th => P.ponto(th, s)[0]);
      const out = [];
      for (let j = 0; j < l.length; j++) {
        out.push(l[j]);
        if (j + 1 < l.length) for (const xe of [mt, -mt]) if ((xs[j] - xe) * (xs[j + 1] - xe) < 0) out.push(thAlvoX(s, xe));
      }
      return out;
    };
    const thAlvoX = (s, xe) => { let lo = 1e-6, hi = Math.PI - 1e-6; for (let i = 0; i < 44; i++) { const m = (lo + hi) / 2; if (xe - P.ponto(m, s)[0] < 0) lo = m; else hi = m; } return (lo + hi) / 2; };
    const colunas = aneis.map(colsDe);
    const nCol = colunas[0].length;
    if (colunas.some(c => c.length !== nCol)) { for (let i = 0; i < colunas.length; i++) colunas[i] = tr.fechado ? cols0 : tr.cols(aneis[i]); }
    const pt = (i, j) => { const s = aneis[i], th = colunas[i][j], [x, z] = P.ponto(th, s); return [x, yEm(s, th), z]; };
    // o u (em ladrilhos de 12 m): nos fechados pelo arco no meio, contínuo pela volta (as colunas do fundo −x passam de π)
    const uAbs = (i, j) => { const th = colunas[i][j]; if (tr.fechado) return P.uTh(th) / 12; const [x, z] = P.ponto(th, aneis[i]); return P.uDe(x, z, k) / 12; };
    // em cima da boca do túnel (entre as paredes, abaixo da fileira que passa do teto): sem cadeira
    const xCol = (i, j) => (tr.fechado ? pt(0, j)[0] : pt(i, j)[0]);
    const sobreTunel = (i, j) => k === 3 && aneis[i] < sTunel - 1e-6 && Math.max(Math.abs(xCol(i, j)), Math.abs(xCol(i, j + 1))) <= mt + 1e-3;
    for (let i = 0; i + 1 < aneis.length; i++) {
      const sm = (aneis[i] + aneis[i + 1]) / 2;
      for (let j = 0; j + 1 < nCol; j++) {
        if (sobreTunel(i, j)) continue;
        const thm = (colunas[i][j] + colunas[i][j + 1]) / 2;
        const tp = tipoEm(sm, thm);
        const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j);
        if (tp === 0) {
          const ua = uAbs(i, j), ub = uAbs(i, j + 1), uc = uAbs(i + 1, j + 1), ud = uAbs(i + 1, j);
          const va = vDe(aneis[i]), vc = vDe(aneis[i + 1]);
          L.q4(a, b, c, d, sombra(...a), [[ua, va], [ub, va], [uc, vc], [ud, vc]]);
        } else {
          const ld = tr.fechado ? P.ladoEm(thm) : k;
          L.q4(a, b, c, d, (tp === 1 ? (LD[ld].camarotes ? vidro : concretoEsc) : piso).clone().multiply(sombra(...a)));
        }
      }
    }
    // a mureta (de y = 0 até a 1ª fileira) e o parapeito (1,2 m em cima da última) com a parede de trás
    const nA = aneis.length - 1;
    for (let j = 0; j + 1 < nCol; j++) {
      const a = pt(0, j), b = pt(0, j + 1);
      if (!(k === 3 && Math.max(Math.abs(a[0]), Math.abs(b[0])) <= mt + 1e-3)) L.q4([a[0], 0, a[2]], [b[0], 0, b[2]], b, a, mureta);
      const c = pt(nA, j), d = pt(nA, j + 1);
      L.q4(c, d, [d[0], d[1] + 1.2, d[2]], [c[0], c[1] + 1.2, c[2]], concreto.clone().multiply(sombra(...c)));
      // a parede de trás até o chão (no pré-jogo a fachada cobre; nos cantos abertos ela é a cara da arquibancada)
      L.q4([d[0], d[1] + 1.2, d[2]], [c[0], c[1] + 1.2, c[2]], [c[0], 0, c[2]], [d[0], 0, d[2]], concretoEsc);
    }
    // as empenas das pontas (cantos abertos): a parede lateral da arquibancada, do perfil até o chão
    if (!tr.fechado) {
      for (const j of [0, nCol - 1]) {
        for (let i = 0; i < nA; i++) {
          const a = pt(i, j), b = pt(i + 1, j);
          L.q4([a[0], 0, a[2]], [b[0], 0, b[2]], b, a, empena);
        }
      }
    }
    return { colunas, aneis, pt };
  }
  const g = new THREE.Group();
  g.name = 'tigela';
  const trs = P.trechos(NCOL);
  const malhas = [];
  // lado de lá
  {
    const L = malha();
    for (const tr of trs) if (tr.k === 0) arquibancada(L, tr);
    const m = new THREE.Mesh(L.geo(), mat); m.name = 'arquibancada-lado'; malhas.push(m);
  }
  // fundos (+ a pista de atletismo no chão)
  {
    const L = malha();
    for (const tr of trs) if (tr.k === 1 || tr.k === 2) arquibancada(L, tr);
    if (F.pista) pistaAtletismo(L);
    else if (F.piso) pisoEmVolta(L);
    const m = new THREE.Mesh(L.geo(), mat); m.name = 'arquibancada-fundos'; malhas.push(m);
  }
  // lado de cá: o túnel no meio, os bancos e a cobertura dele (some junto com a câmera de TV dentro)
  let ca;
  const caixasCa = [];
  {
    const L = malha();
    let info = null;
    for (const tr of trs) if (tr.k === 3) info = arquibancada(L, tr);
    tunelEBancos(L);
    cobertura(L, null, k => k === 3);
    ca = new THREE.Mesh(L.geo(), mat);
    ca.name = 'arquibancada-ca';
    ca.frustumCulled = false;
    const xs = [], zs = [], ys = [];
    const p = ca.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { xs.push(p.getX(i)); ys.push(p.getY(i)); zs.push(p.getZ(i)); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z1 = Math.max(...zs), yTop = Math.max(...ys);
    const zMeio = P.ponto(Math.PI / 2, 0.3)[1], yMeio = P.perfilLado(3, 0.3);
    caixasCa.push(
      new THREE.Box3(new THREE.Vector3(x0 - 0.5, -0.5, T.z - 0.6), new THREE.Vector3(x1 + 0.5, yMeio + 0.5, zMeio + 0.5)),
      new THREE.Box3(new THREE.Vector3(x0 - 0.5, yMeio - 0.5, zMeio - 0.5), new THREE.Vector3(x1 + 0.5, yTop + 0.6, z1 + 0.6)),
      new THREE.Box3(new THREE.Vector3(-ESTADIO.bancos.x[1] - 0.5, -0.1, ESTADIO.bancos.z[0] - 0.8), new THREE.Vector3(ESTADIO.bancos.x[1] + 0.5, 2.6, T.z)),
    );
    ca.userData.caixas = caixasCa;
    void info;
    malhas.push(ca);
  }
  for (const m of malhas) { m.castShadow = false; m.receiveShadow = false; g.add(m); }
  // a cobertura dos outros lados e a estrutura
  const texE = texEstrutura(false), texEm = texEstrutura(true);
  // a chapa da cobertura: um pouco de brilho próprio (por baixo a luz que chega é a do chão, verde: sem ele o forro
  // ficava verde-escuro)
  const matCob = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, emissive: 0x3a3c3e });
  const matEst = new THREE.MeshLambertMaterial({ map: texE, emissiveMap: texEm, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, side: THREE.DoubleSide });
  {
    const Lc = malha(), Le = malha();
    cobertura(Lc, Le, k => k !== 3);
    estruturaExtra(Le);
    const mc = new THREE.Mesh(Lc.geo(), matCob); mc.name = 'cobertura';
    const me = new THREE.Mesh(Le.geo(), matEst); me.name = 'cobertura-estrutura';
    for (const m of [mc, me]) { m.castShadow = false; m.receiveShadow = false; g.add(m); }
  }
  g.userData.materiais = [mat, matCob];
  g.userData.ladoDeCa = ca;
  g.userData.definirHora = h => { const n = h === 'noite'; matEst.emissiveIntensity = n ? 1 : 0; matEst.color.setScalar(n ? 0.5 : 1); matCob.emissive.setHex(n ? 0x1a1b1c : 0x3a3c3e); };
  return g;

  // ---------------------------------------------------------------- peças
  /** A pista de atletismo (8 raias, a borda e as linhas) no chão, entre o gramado e a 1ª fileira. */
  function pistaAtletismo(L) {
    const Pi = PISTA, Lr = Pi.meiaReta, R0 = Pi.raio, R1 = R0 + Pi.raias * Pi.raia, Rf = F.frente.R;
    const tartan = cor(F.pistaCor), linha = cor(0xf2efe8), borda = cor(F.pistaCor).multiplyScalar(0.8);
    const N = 160;
    const curva = (R, i) => {
      // a curva de atletismo parametrizada pelo comprimento (as 2 retas e os 2 semicírculos), N pontos
      const per = 4 * Lr + 2 * Math.PI * R, s = (per * i) / N;
      const seg = [2 * Lr, Math.PI * R, 2 * Lr, Math.PI * R];
      let t = s, k = 0;
      while (k < 3 && t > seg[k]) { t -= seg[k]; k++; }
      if (k === 0) return [-Lr + t, -R];
      if (k === 1) { const a = -Math.PI / 2 + t / R; return [Lr + R * Math.cos(a), R * Math.sin(a)]; }
      if (k === 2) return [Lr - t, R];
      const a = Math.PI / 2 + t / R; return [-Lr + R * Math.cos(a), R * Math.sin(a)];
    };
    const faixa = (Ra, Rb, y, c) => {
      for (let i = 0; i < N; i++) {
        const a0 = curva(Ra, i), a1 = curva(Ra, i + 1), b0 = curva(Rb, i), b1 = curva(Rb, i + 1);
        L.q4([a0[0], y, a0[1]], [a1[0], y, a1[1]], [b1[0], y, b1[1]], [b0[0], y, b0[1]], c);
      }
    };
    faixa(R0 - 0.3, R1 + 0.4, 0.014, tartan);
    faixa(R1 + 0.4, Math.max(R1 + 0.6, Rf - 0.2), 0.013, borda);
    for (let k = 0; k <= Pi.raias; k++) { const R = R0 + k * Pi.raia; faixa(R - 0.025, R + 0.025, 0.017, linha); }
    // o meio-fio de dentro (concreto branco) — a pista passa por baixo das placas (as placas são as do jogo)
    faixa(R0 - 0.45, R0 - 0.3, 0.02, cor(0xdedbd2));
  }
  /** O piso em volta do gramado até a 1ª fileira (a antiga pista pintada, o tartan): o anel todo, no chão. */
  function pisoEmVolta(L) {
    const c = cor(F.piso), hx = CAMPO.meioX + CAMPO.entorno, hz = CAMPO.meioZ + CAMPO.entorno, N = 144;
    for (let i = 0; i < N; i++) {
      const pts = [i, i + 1].map(k => {
        const th = -Math.PI + (2 * Math.PI * k) / N, cc = Math.cos(th), ss = Math.sin(th);
        const ri = Math.min(Math.abs(cc) > 1e-6 ? hx / Math.abs(cc) : 1e9, Math.abs(ss) > 1e-6 ? hz / Math.abs(ss) : 1e9), ro = P.rF(th);
        return [[ri * cc, 0.012, ri * ss], [ro * cc, 0.012, ro * ss]];
      });
      L.q4(pts[0][0], pts[1][0], pts[1][1], pts[0][1], c);
    }
  }
  /** O túnel (a boca, a laje, o corredor; na pista, a caixa por cima da pista até a arquibancada) e os bancos. */
  function tunelEBancos(L) {
    const z0 = T.z, conc = cor(0xb9b7b0), escuro = c2 => cor(0x9d9c97).multiplyScalar(c2), moldura = cor(0x55585b);
    const zf = z0 + T.profundidade;
    // a laje (o teto do túnel saliente) e a frente dela
    const zFr = F.frente.ca;
    const yT = P.perfilLado(3, sTunel), [, zT] = P.ponto(Math.PI / 2, sTunel);
    L.q4([-mt, ytt, z0], [mt, ytt, z0], [mt, ytt, zT], [-mt, ytt, zT], cor(zFr > z0 + 0.5 ? 0x6f7275 : 0x8a8c8e));
    if (zFr > z0 + 0.5) {
      // a caixa de concreto por cima da pista (as paredes de fora)
      for (const s of [-1, 1]) L.q4([s * mt, 0, z0], [s * mt, 0, zFr], [s * mt, ytt, zFr], [s * mt, ytt, z0], cor(0x8a8c8e));
    }
    for (const s of [-1, 1]) L.q4([s * ti, 0, z0], [s * mt, 0, z0], [s * mt, ytt, z0], [s * ti, ytt, z0], moldura);
    L.q4([-ti, ya, z0], [ti, ya, z0], [ti, ytt, z0], [-ti, ytt, z0], moldura);
    for (const s of [-1, 1]) L.q4([s * ti, 0, z0], [s * ti, 0, zf], [s * ti, ya, zf], [s * ti, ya, z0], escuro(0.45));
    L.q4([-ti, ya, z0], [ti, ya, z0], [ti, ya, zf], [-ti, ya, zf], escuro(0.32));
    L.q4([-ti, 0.02, z0], [ti, 0.02, z0], [ti, 0.02, zf], [-ti, 0.02, zf], escuro(0.55));
    L.q4([-ti, 0, zf], [ti, 0, zf], [ti, ya, zf], [-ti, ya, zf], escuro(0.1));
    // a frente do degrau em cima da boca (o espelho da laje até o degrau que passa do teto)
    L.q4([-mt, ytt, zT], [mt, ytt, zT], [mt, yT, zT], [-mt, yT, zT], escuro(0.8));
    for (const s of [-1, 1]) {
      const [, za] = P.ponto(Math.PI / 2, 0);
      const a = L.v(s * mt, P.perfilLado(3, 0), za, ...UV_BRANCO, conc), b = L.v(s * mt, ytt, za, ...UV_BRANCO, conc), c = L.v(s * mt, ytt, zT, ...UV_BRANCO, conc);
      L.tri(a, b, c);
    }
    // os bancos de reservas (config.js ESTADIO.bancos): a cápsula de acrílico com os arcos de metal
    const B = ESTADIO.bancos, [za, zb] = B.z;
    const assento = cor(0x2b3442), acril = cor(0xa7bccb), metal = cor(0x8b9399);
    const zc = (za + zb) / 2 + 0.1, yc = 0.4, RC = 1.5, NA = 8, a0 = -10 * RAD, a1 = 150 * RAD;
    const arcoC = kk => { const a = a0 + ((a1 - a0) * kk) / NA; return [zc + RC * Math.cos(a), yc + RC * Math.sin(a)]; };
    for (const s of [-1, 1]) {
      const xa = s * B.x[0], xb = s * B.x[1], xc = (xa + xb) / 2, larg = Math.abs(xb - xa);
      L.caixa(xc, 0.25, zb - 0.6, larg, 0.5, 1.2, 0, conc, 5);
      L.caixa(xc, 0.62, zb - 0.6, larg - 0.4, 0.22, 0.9, 0, assento, 5);
      L.caixa(xc, 0.95, zb - 0.12, larg - 0.4, 0.7, 0.12, 0, assento, 5);
      for (let kk = 0; kk < NA; kk++) { const [z1, y1] = arcoC(kk), [z2, y2] = arcoC(kk + 1); L.q4([xa, y1, z1], [xb, y1, z1], [xb, y2, z2], [xa, y2, z2], acril); }
      for (let xm = Math.min(xa, xb); xm <= Math.max(xa, xb) + 0.01; xm += larg / 6) {
        for (let kk = 0; kk < NA; kk++) { const [z1, y1] = arcoC(kk), [z2, y2] = arcoC(kk + 1); L.q4([xm - 0.05, y1 + 0.01, z1], [xm + 0.05, y1 + 0.01, z1], [xm + 0.05, y2 + 0.01, z2], [xm - 0.05, y2 + 0.01, z2], metal); }
      }
    }
  }
  /**
   * A cobertura dos setores escolhidos (`quais(k)`): a chapa pela planta (cobEm: da borda de fora, atrás da última
   * fileira, até a borda de dentro), a testeira na frente com as lâmpadas e, em Le (a estrutura), a sustentação.
   */
  function cobertura(Lc, Le, quais) {
    const C = F.cobertura;
    if (C.tipo === 'nenhuma') return;
    const corTopo = cor(C.cor), corMat = C.mat === 'membrana' ? cor(0xf1f0ec) : C.mat === 'policarbonato' ? mistura(C.cor, '#e8eef2', 0.5) : C.mat === 'vidro' ? mistura(C.cor, '#a9bccb', 0.5) : corTopo;
    const testeira = mistura(C.cor, '#2c3135', 0.55), lamp = cor(0xf4f6f8);
    const estr = cor(C.estr ?? '#9aa1a6'), escuraE = cor(0x4a5056);
    // as colunas: nos cantos abertos, as do trecho (a ponta reta); nos fechados, pelo ângulo
    for (const tr of trs) {
      if (!quais(tr.k)) continue;
      const k = tr.k;
      if (!P.cobContinua && !LD[k].coberta) continue;
      const cols = tr.fechado ? tr.cols(0) : tr.cols(1);
      const pts = [];
      for (const th of cols) {
        const c = P.cobEm(th);
        if (!c) { pts.push(null); continue; }
        // nos cantos abertos a chapa acompanha a ponta reta: a coluna do trecho na fileira 1 (fora) e na 0 (dentro)
        let fo, de;
        if (tr.fechado) { fo = [c.fora * Math.cos(th), c.fora * Math.sin(th)]; de = [c.dentro * Math.cos(th), c.dentro * Math.sin(th)]; }
        else {
          const j = cols.indexOf(th), th0 = tr.cols(0)[j];
          const [xb, zb] = P.ponto(th, 1), [xf, zf] = P.ponto(th0, 0);
          const nx = xb - xf, nz = zb - zf, l = Math.hypot(nx, nz) || 1;
          fo = [xb + (nx / l) * 1.6, zb + (nz / l) * 1.6];
          const sd = P.cobContinua ? 0 : 0;
          const D = l;
          de = [xf - (nx / l) * 1.5 + (nx / l) * D * sd, zf - (nz / l) * 1.5 + (nz / l) * D * sd];
        }
        pts.push({ fo, de, yf: c.yFora, yd: c.yDentro, th });
      }
      for (let j = 0; j + 1 < pts.length; j++) {
        const a = pts[j], b = pts[j + 1];
        if (!a || !b) continue;
        const A = [a.fo[0], a.yf, a.fo[1]], B = [b.fo[0], b.yf, b.fo[1]], Cc = [b.de[0], b.yd, b.de[1]], D = [a.de[0], a.yd, a.de[1]];
        // a chapa em 3 faixas (a borda de fora, o meio e a de dentro) com as nervuras escuras entre as baias
        const mid = (p, q2, t) => p.map((v, i) => v + (q2[i] - v) * t);
        const fx = [0, 0.08, 0.92, 1];
        for (let f = 0; f < 3; f++) {
          const c0 = f === 1 ? corMat : mistura('#' + corMat.getHexString(), '#9aa0a4', 0.25);
          Lc.q4(mid(A, D, fx[f]), mid(B, Cc, fx[f]), mid(B, Cc, fx[f + 1]), mid(A, D, fx[f + 1]), c0);
        }
        // a testeira da borda de dentro (1,6 m, a cor da cobertura mais escura) e a fileira de lâmpadas embaixo dela
        Lc.q4(D, Cc, [Cc[0], Cc[1] - 1.6, Cc[2]], [D[0], D[1] - 1.6, D[2]], testeira);
        if (Le) Le.q4([D[0], D[1] - 1.62, D[2]], [Cc[0], Cc[1] - 1.62, Cc[2]], [Cc[0], Cc[1] - 1.95, Cc[2]], [D[0], D[1] - 1.95, D[2]], lamp, UV_ACESO);
        else Lc.q4([D[0], D[1] - 1.62, D[2]], [Cc[0], Cc[1] - 1.62, Cc[2]], [Cc[0], Cc[1] - 1.95, Cc[2]], [D[0], D[1] - 1.95, D[2]], lamp);
        // a borda de fora (o fechamento até o topo da parede de trás)
        Lc.q4(A, B, [B[0], B[1] - 2.2, B[2]], [A[0], A[1] - 2.2, A[2]], mistura('#' + corMat.getHexString(), '#6d7276', 0.4));
        const E = Le ?? Lc, uvE = Le ? UV_NORMAL : UV_BRANCO;
        // a sustentação
        const sust = C.sust;
        if (j % 3 === 0) E.barra(mid(A, D, 0.02), mid(A, D, 0.98), 0.45, escuraE, uvE);   // a nervura de baixo
        if ((sust === 'trelica') && Le) {
          // a treliça da borda de dentro: banzo de baixo e as diagonais em zigue-zague
          const D2 = [D[0], D[1] - 3.4, D[2]], C2 = [Cc[0], Cc[1] - 3.4, Cc[2]];
          E.barra(D2, C2, 0.35, estr, uvE);
          E.barra(j % 2 ? D : [D[0], D[1] - 1.6, D[2]], j % 2 ? C2 : Cc, 0.22, estr, uvE);
        }
        if (sust === 'pilares' && j % 5 === 0) {
          // os pilares no meio da arquibancada (a cobertura antiga, quase plana: a planta abaixa a borda de dentro)
          const pm = mid(A, D, 0.62), s = clampN(P.sDe(pm[0], pm[2]), 0.02, 0.98), th = Math.atan2(pm[2], pm[0]);
          const yb = tr.fechado ? P.perfil(s, th) : P.perfilLado(k, s);
          E.cilindro(pm[0], yb, pm[2], pm[1] - 0.3, 0.28, estr, 8, 0.28, uvE);
        }
        if ((sust === 'anel_compressao' || sust === 'cabos') && j % 2 === 0) {
          // os cabos radiais por cima e o anel de compressão na borda de fora
          E.barra([A[0], A[1] + 0.25, A[2]], [D[0], D[1] + 0.25, D[2]], 0.12, escuraE, uvE);
        }
        if (sust === 'anel_compressao' || sust === 'cabos') E.barra([A[0], A[1] - 0.4, A[2]], [B[0], B[1] - 0.4, B[2]], 1.1, estr, uvE);
        if (sust === 'mastros' && j % 6 === 3 && !P.marcas.some(mm => mm.tipo === 'mastros')) {
          // o mastro atrás da arquibancada e os dois cabos até a frente da cobertura
          const ex = A[0] - D[0], ez = A[2] - D[2], l = Math.hypot(ex, ez) || 1;
          const M0 = [A[0] + (ex / l) * 4, 0, A[2] + (ez / l) * 4], M1 = [M0[0], A[1] + 16, M0[2]];
          E.cilindro(M0[0], 0, M0[2], M1[1], 0.55, estr, 8, 0.35, uvE);
          E.barra(M1, D, 0.1, escuraE, uvE);
          E.barra(M1, mid(A, D, 0.5), 0.1, escuraE, uvE);
        }
      }
      // o arco por cima da arquibancada (a sustentação em arco, de ponta a ponta)
      if (C.sust === 'arco') {
        const La = Le ?? Lc, uvA = Le ? UV_NORMAL : UV_BRANCO;
        const va = pts.filter(Boolean);
        if (va.length > 3) {
          const p0 = va[0], p1 = va[va.length - 1];
          const meio = (p0.yd + p1.yd) / 2, alto = meio + 14;
          const N = 18, arco = [];
          for (let i = 0; i <= N; i++) {
            const t = i / N, pp = va[Math.round(t * (va.length - 1))];
            const x = pp.de[0] * 0.5 + pp.fo[0] * 0.5, z = pp.de[1] * 0.5 + pp.fo[1] * 0.5;
            arco.push([x, lerpN(meio - 2, alto, 1 - (2 * t - 1) ** 2), z]);
          }
          for (let i = 0; i < N; i++) La.barra(arco[i], arco[i + 1], 1.6, cor(C.estr ?? '#e9eaea'), uvA);
          for (let i = 2; i < N - 1; i += 3) La.barra(arco[i], [arco[i][0], meio, arco[i][2]], 0.12, escuraE, uvA);
        }
      }
    }
  }
  /** As torres de refletor (sem cobertura), os telões e o arco das marcas. */
  function estruturaExtra(Le) {
    const estr = cor(F.cobertura.estr ?? '#8f969b'), cab = cor(0x3b4146), lamp = cor(0xf4f6f8);
    for (const t of P.torres) {
      if (t.poste) {
        // o poste de refletores no alto da arquibancada descoberta (a cabeça virada para o meio do campo)
        const h = Math.atan2(-t.z, -t.x), yb = t.alto - 14;
        Le.cilindro(t.x, yb, t.z, t.alto - 1, 0.22, estr, 6, 0.16, UV_NORMAL);
        Le.caixa(t.x, t.alto - 0.6, t.z, 0.5, 1.6, 3.6, h, cab, 6, UV_NORMAL);
        const nx = Math.cos(h), nz = Math.sin(h);
        for (const jj of [-1, 0, 1]) Le.caixa(t.x + nx * 0.28 - nz * jj * 1.1, t.alto - 0.6, t.z + nz * 0.28 + nx * jj * 1.1, 0.06, 1.2, 0.9, h, lamp, 1, UV_ACESO);
        continue;
      }
      if (t.larga) {
        // a estrutura de refletores por cima do lado comprido (duas colunas e a viga com a fileira de luz)
        for (const s of [-1, 1]) Le.cilindro(s * 62, 0, t.z, t.alto, 1.4, estr, 6, 0.9, UV_NORMAL);
        Le.caixa(0, t.alto - 2, t.z, 128, 4, 2.2, 0, cab, 6, UV_NORMAL);
        const nz = -Math.sign(t.z);
        for (let x = -56; x <= 56; x += 4) Le.caixa(x, t.alto - 2.2, t.z + nz * 1.15, 3, 2.6, 0.1, 0, lamp, 1, UV_ACESO);
        continue;
      }
      Le.cilindro(t.x, 0, t.z, t.alto - 3, 0.9, estr, 6, 0.45, UV_NORMAL);
      // a cabeça virada para o meio do campo
      const h = Math.atan2(-t.z, -t.x);
      Le.caixa(t.x, t.alto - 1.5, t.z, 1.0, 4.2, 8, h, cab, 6, UV_NORMAL);
      const nx = Math.cos(h), nz = Math.sin(h);
      for (let i = -1; i <= 1; i++) for (let jj = -2; jj <= 2; jj++) {
        const cx = t.x + nx * 0.55 - nz * jj * 1.5, cz = t.z + nz * 0.55 + nx * jj * 1.5, cy = t.alto - 1.5 + i * 1.3;
        Le.caixa(cx, cy, cz, 0.1, 1.0, 1.2, h, lamp, 1, UV_ACESO);
      }
    }
    for (const m of P.marcas) {
      if (m.tipo === 'vigas') {
        // o retângulo de vigas-treliça por cima da cobertura (banzo de cima, de baixo e as diagonais), as pontas para fora
        const c = cor(m.cor), y1 = m.y, y0 = m.y - m.alto;
        const lados = [[[-m.hx - 22, -m.hz], [m.hx + 22, -m.hz]], [[-m.hx - 22, m.hz], [m.hx + 22, m.hz]], [[-m.hx, -m.hz - 22], [-m.hx, m.hz + 22]], [[m.hx, -m.hz - 22], [m.hx, m.hz + 22]]];
        for (const [a, b] of lados) {
          Le.barra([a[0], y1, a[1]], [b[0], y1, b[1]], 1.4, c, UV_NORMAL);
          Le.barra([a[0], y0, a[1]], [b[0], y0, b[1]], 1.1, c, UV_NORMAL);
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / 8);
          for (let i = 0; i < n; i++) {
            const t0 = i / n, t1 = (i + 1) / n, p = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            const [x0, z0] = p(t0), [x1, z1] = p(t1);
            Le.barra([x0, i % 2 ? y0 : y1, z0], [x1, i % 2 ? y1 : y0, z1], 0.5, c, UV_NORMAL);
          }
        }
        continue;
      }
      if (m.tipo === 'telao') {
        Le.caixa(m.x, m.y, m.z, m.larg, m.alt, 1.2, m.th + Math.PI / 2, cab, 6, UV_NORMAL);
        const nx = -Math.cos(m.th), nz = -Math.sin(m.th);
        Le.caixa(m.x + nx * 0.62, m.y, m.z + nz * 0.62, m.larg - 0.6, m.alt - 0.6, 0.05, m.th + Math.PI / 2, cor(0x6a90b8), 1, UV_ACESO);
        // nos postes (em cima da arquibancada) ou nos tirantes até a cobertura (pendurado)
        for (const s of [-1, 1]) m.pendurado ? Le.barra([m.x - nz * s * m.larg * 0.35, m.y + m.alt / 2, m.z + nx * s * m.larg * 0.35], [m.x - nz * s * m.larg * 0.35, m.y + m.alt / 2 + 1.9, m.z + nx * s * m.larg * 0.35], 0.15, cab, UV_NORMAL)
          : Le.cilindro(m.x - nz * s * m.larg * 0.35, m.y - m.alt / 2 - 1.6, m.z + nx * s * m.larg * 0.35, m.y - m.alt / 2, 0.25, estr, 6, 0.25, UV_NORMAL);
      } else if (m.tipo === 'arco') {
        // o arco das marcas (Wembley): treliça tubular de ponta a ponta, por cima da arquibancada
        const N = 28, pts = [];
        for (let i = 0; i <= N; i++) {
          const t = -1 + (2 * i) / N, ao = t * m.meia, ya = Math.max(0, m.alto * (1 - t * t));
          const lado = [-1, 1, -1, 1][m.k];
          pts.push(m.lado ? [ao, ya, lado * m.dist] : [lado * m.dist, ya, ao]);
        }
        for (let i = 0; i < N; i++) Le.barra(pts[i], pts[i + 1], m.raio * 2, cor(m.cor), UV_NORMAL);
        for (let i = 3; i < N - 2; i += 2) {
          const p = pts[i], th = Math.atan2(p[2], p[0]), c = P.cobEm(th);
          if (c) Le.barra(p, [p[0], (c.yFora + c.yDentro) / 2, p[2]], 0.12, cab, UV_NORMAL);
        }
      }
    }
  }
}
function lerpN(a, b, t) { return a + (b - a) * t; }

// ------------------------------------------------------------------ o lado de fora (pré-jogo)
function texChao(P, q, aniso, tipo) {
  // o chão do entorno: quadras de 44 m (as ruas de 9 m em cinza-asfalto, as calçadas, o miolo pelo tipo do bairro)
  const W = q === 'baixa' ? 128 : 256, c = criarCanvas(W, W), g = c.getContext('2d');
  const miolo = { urbano_denso: '#8c8a84', residencial: '#7f7a69', parque: '#4f7a3c', industrial: '#8a8a86', campo_aberto: '#6f7f45', orla: '#878275', campus: '#6b8452' }[tipo] ?? '#7f7a69';
  g.fillStyle = '#4a4c4e'; g.fillRect(0, 0, W, W);
  const k = W / 44, rua = 9 * k / 2;
  g.fillStyle = '#a8a59d'; g.fillRect(rua - 2 * k, rua - 2 * k, W - 2 * rua + 4 * k, W - 2 * rua + 4 * k);
  g.fillStyle = miolo; g.fillRect(rua, rua, W - 2 * rua, W - 2 * rua);
  const r = gerador(P.forma.semente + 5);
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${tipo === 'parque' ? '40,80,30' : '60,58,52'},${0.12 + 0.2 * r()})`; const s = (4 + r() * 10) * k; g.fillRect(rua + r() * (W - 2 * rua - s), rua + r() * (W - 2 * rua - s), s, s); }
  g.fillStyle = '#d9d4c3'; for (let x = 0; x < W; x += 6 * k) { g.fillRect(x, W - rua / 2, 2 * k, 1); g.fillRect(W - rua / 2, x, 1, 2 * k); }
  const t = texturaCanvas(c, { aniso, repetir: true });
  return t;
}
function texEsplanada(P, q, aniso) {
  // a esplanada: concreto com juntas, os canteiros e as vagas pintadas dos estacionamentos (no mundo: 1 px = 1 m)
  const R = P.rEsplanada, W = q === 'baixa' ? 512 : 1024, c = criarCanvas(W, W), g = c.getContext('2d');
  const X = x => ((x + R) / (2 * R)) * W;
  g.fillStyle = '#a7a49b'; g.fillRect(0, 0, W, W);
  const r = gerador(P.forma.semente + 6);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${0.02 + 0.04 * r()})`; g.fillRect(r() * W, r() * W, 2 + r() * 8, 2 + r() * 8); }
  g.strokeStyle = 'rgba(70,68,62,0.25)'; g.lineWidth = 1;
  for (let x = -R; x <= R; x += 8) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), W); g.stroke(); g.beginPath(); g.moveTo(0, X(x)); g.lineTo(W, X(x)); g.stroke(); }
  for (const e of P.estacionamentos()) {
    g.fillStyle = '#4d4f51'; g.fillRect(X(e.x[0]), X(e.z[0]), X(e.x[1]) - X(e.x[0]), X(e.z[1]) - X(e.z[0]));
    g.fillStyle = '#e8e6df';
    for (let z = e.z[0] + 4; z < e.z[1] - 2; z += 6.5) for (let x = e.x[0] + 1; x < e.x[1]; x += 2.7) g.fillRect(X(x), X(z), 1, X(z + 4.8) - X(z));
  }
  for (const v of P.canteiros()) { g.fillStyle = '#4f7a3c'; g.beginPath(); g.arc(X(v.x), X(v.z), (v.r / (2 * R)) * W, 0, 2 * Math.PI); g.fill(); }
  return texturaCanvas(c, { aniso });
}

/**
 * O estádio de fora no pré-jogo: a fachada pelo estilo, a placa, o túnel, as marcas e o entorno. A mesma interface de
 * render/estadio-fora.js criarEstadioFora: {grupo, modoFora, definirHora, atualizar, dispose, info}.
 */
export function criarForaForma(cena, opc, P, pecas) {
  const q = opc.qualidade ?? 'media', aniso = opc.aniso ?? 4;
  const ident = opc.identidade, F = P.forma;
  const uNoite = { value: 0 };
  const grupo = new THREE.Group();
  grupo.name = 'estadio-fora';
  const fa = {
    // a 2ª cor (as faixas, a base, os montantes) puxada para a 1ª: a revisão contra as fotos achou faixas e bases vermelhas
    // e vinho onde a fachada de verdade é de uma cor só — a cor do clube fica nas cadeiras e nas marcas
    ...(ident?.fachada ?? {}), estilo: F.fachada.estilo, cor: F.fachada.cor, cor2: '#' + cor(F.fachada.cor2).lerp(cor(F.fachada.cor), 0.45).getHexString(),
    ledCor: F.fachada.led ?? (F.marcas.some(m => m.tipo === 'pele_led') ? F.marcas.find(m => m.tipo === 'pele_led').cor : null),
    aneis: Math.max(...Object.values(F.lados).map(l => l.aneis)),
  };
  const fachada = criarFachada(P, aniso, fa, q);
  const placa = criarPlacaG(P, pecas.texPlaca(ident));
  const estrutura = [fachada, placa, ...pecas.criarTunel(ident?.fachada ?? fa)];
  // as marcas próprias, a água e os morros numa malha só (o pré-jogo do celular tem ≤ 40 chamadas por plano)
  const comEntorno = opc.entorno !== false;
  const corClube = ident?.times?.[0]?.cores?.primaria ?? '#c8102e', corClube2 = ident?.times?.[0]?.cores?.secundaria ?? '#ffffff';
  const marcas = criarMarcas(P, comEntorno, corClube, corClube2);
  if (marcas) estrutura.push(marcas);
  const entorno = [];
  if (comEntorno) {
    entorno.push(criarChaoEsplanada(P, q, aniso), criarChaoBairro(P, q, aniso));
    if (q !== 'baixa') {
      entorno.push(criarPrediosG(uNoite, P.predios()), criarArvoresG(P.arvores(), P.forma.semente));
      const cs = P.carros(); if (cs.length) entorno.push(pecas.criarCarros(cs));
      const t = pecas.criarTorcedores(opc.materialTorcida, ident?.torcedoresFora, P.torcedoresFora());
      if (t) entorno.push(t);
    }
  }
  for (const m of [...estrutura, ...entorno]) { m.castShadow = false; m.receiveShadow = false; grupo.add(m); }
  cena.add(grupo);
  function definirHora(h) {
    const noite = h === 'noite';
    uNoite.value = noite ? 1 : 0;
    fachada.material.emissiveIntensity = noite ? 0.9 : 0;
    fachada.material.color.setScalar(noite ? 0.6 : 1);
    placa.material.color.setScalar(noite ? 0.75 : 1);
    if (marcas) { marcas.material.color.setScalar(noite ? 0.45 : 1); marcas.material.emissiveIntensity = noite ? 1 : 0; }
    for (const m of entorno) if (m.name === 'fora-esplanada' || m.name === 'fora-chao') m.material.color.setScalar(noite ? 0.28 : 1);
  }
  definirHora(opc.hora ?? 'dia');
  let disposto = false;
  return {
    grupo,
    // de dentro a tigela tapa a fachada (nos cantos abertos ela aparece pelo vão: fica)
    modoFora(v) { for (const m of entorno) m.visible = !!v; fachada.visible = !!v || P.abertos; placa.visible = !!v; if (marcas) marcas.visible = !!v; },
    definirHora,
    atualizar() { /* nada por quadro */ },
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
      return { pecas: pecasN, entorno: comEntorno, triangulos: Math.round(tri), predios: P.predios().length, arvores: P.arvores().length, carros: P.carros().length, torcedores: P.torcedoresFora().length, forma: P.familia };
    },
  };
}

/** A fachada: a parede em volta pela planta (nos cantos abertos, atrás de cada arquibancada) com a textura do estilo. */
function criarFachada(P, aniso, fa, q) {
  const pos = [], uv = [], idx = [];
  const H27 = 27.6;
  const faixa = pts => {
    // pts: [{x, z, y (altura)}] em sequência; u pelo comprimento, v pela altura (o ladrilho de 27,6 m, encolhido nas baixas)
    let s = 0;
    const base = pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const k = clampN(pts[i].y / H27, 0.55, 1.5);
      pos.push(pts[i].x, 0, pts[i].z, pts[i].x, pts[i].y, pts[i].z);
      uv.push(s / 12, 0, s / 12, pts[i].y / (H27 * k));
    }
    // a face de fora virada para fora (a de dentro fica escura: fachadaPorDentro)
    for (let i = 0; i + 1 < pts.length; i++) { const a = base + 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  const N = q === 'alta' ? 240 : 160;
  if (P.casca) {
    // a pele: anéis do perfil da casca (do chão à cobertura), u pelo comprimento no chão, v pela altura
    const perfis = [];
    for (let i = 0; i <= N; i++) { const th = -Math.PI + (2 * Math.PI * i) / N; perfis.push({ th, p: P.perfilCasca(th) }); }
    const nA = perfis[0].p.length;
    let s = 0;
    const us = perfis.map((q, i) => { if (i > 0) { const a = perfis[i - 1], r0 = a.p[0][0], r1 = q.p[0][0]; s += Math.hypot(r1 * Math.cos(q.th) - r0 * Math.cos(a.th), r1 * Math.sin(q.th) - r0 * Math.sin(a.th)); } return s / 12; });
    const ytopo = Math.max(...perfis.map(q => q.p[nA - 1][1]));
    const base = 0;
    for (let i = 0; i <= N; i++) for (let k = 0; k < nA; k++) {
      const [r, y] = perfis[i].p[k];
      pos.push(r * Math.cos(perfis[i].th), y, r * Math.sin(perfis[i].th));
      uv.push(us[i], y / Math.max(ytopo, 1));
    }
    for (let i = 0; i < N; i++) for (let k = 0; k + 1 < nA; k++) { const a = base + i * nA + k, b = a + nA; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  } else if (!P.abertos) {
    const pts = [];
    for (let i = 0; i <= N; i++) { const th = -Math.PI + (2 * Math.PI * i) / N, r = P.rFach(th); pts.push({ x: r * Math.cos(th), z: r * Math.sin(th), y: P.yFach(th) }); }
    faixa(pts);
  } else {
    for (const tr of P.trechos(48)) {
      const cols = tr.cols(1), pts = [];
      const cols0 = tr.cols(0);
      for (let j = 0; j < cols.length; j++) {
        const [xb, zb] = P.ponto(cols[j], 1), [xf, zf] = P.ponto(cols0[j], 0);
        const nx = xb - xf, nz = zb - zf, l = Math.hypot(nx, nz) || 1;
        pts.push({ x: xb + (nx / l) * 0.4, z: zb + (nz / l) * 0.4, y: P.perfilLado(tr.k, 1) + 1.2 });
      }
      faixa(pts);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ map: texFachadaEstilo(aniso, false, fa), emissiveMap: texFachadaEstilo(aniso, true, fa), emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide });
  fachadaPorDentro(mat);
  const m = new THREE.Mesh(g, mat);
  m.name = 'fora-fachada';
  return m;
}
/** A placa com o nome do estádio em cima da entrada principal (o lado de cá, +z). */
function criarPlacaG(P, tex) {
  const pc = P.perfilCasca(Math.PI / 2);
  const zF = pc ? pc[2][0] + 0.8 : P.rFach(Math.PI / 2), yF = pc ? pc[2][1] + 4 : P.yFach(Math.PI / 2);
  const larg = clampN(yF * 1.7, 18, 52), alt = larg * 160 / 1024;
  const g = new THREE.PlaneGeometry(larg, alt);
  g.translate(0, clampN(yF - alt / 2 - 1.2, alt / 2 + 3, 40), zF + 0.6);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, depthWrite: false, color: 0xffffff });
  const m = new THREE.Mesh(g, mat);
  m.name = 'fora-placa';
  m.renderOrder = 2;
  return m;
}
/**
 * As marcas próprias de fora (torres com rampa em espiral, mastros e cabos, estátua, ginásio de cúpula) e, com o entorno,
 * a água (rio, canal, lago ou mar) e os morros/montanhas do horizonte: uma malha só (cor por vértice).
 */
function criarMarcas(P, comEntorno = true, corClube = '#c8102e', corClube2 = '#ffffff') {
  const L = malha();
  let tem = false;
  if (comEntorno && aguaNaMalha(L, P)) tem = true;
  if (comEntorno && relevoNaMalha(L, P)) tem = true;
  if (comEntorno) { avenidaNaMalha(L, P); pecasNaMalha(L, P, corClube, corClube2); tem = true; }
  const conc = cor(0xc9c6bd), esc = cor(0x6d7276);
  for (const m of P.marcas) {
    if (m.tipo === 'torres' || m.tipo === 'rampas_espiral') {
      tem = true;
      for (const t of m.torres) {
        L.cilindro(t.x, 0, t.z, t.alto, t.raio * 0.62, cor(m.cor), 16, t.raio * 0.62, UV_NORMAL);
        if (m.espiral) {
          // a rampa helicoidal em volta (a faixa que sobe enrolada, 4 voltas)
          const N = 96, voltas = 4.2, larg = t.raio * 0.38;
          for (let i = 0; i < N; i++) {
            const a0 = (2 * Math.PI * voltas * i) / N, a1 = (2 * Math.PI * voltas * (i + 1)) / N, y0 = (t.alto * i) / N, y1 = (t.alto * (i + 1)) / N;
            const r0 = t.raio * 0.62, r1 = r0 + larg;
            const p = (a, r, y) => [t.x + r * Math.cos(a), y, t.z + r * Math.sin(a)];
            L.q4(p(a0, r0, y0), p(a1, r0, y1), p(a1, r1, y1), p(a0, r1, y0), conc, UV_NORMAL);
            L.q4(p(a0, r1, y0), p(a1, r1, y1), p(a1, r1, y1 + 1.1), p(a0, r1, y0 + 1.1), esc, UV_NORMAL);
          }
        }
      }
    } else if (m.tipo === 'colunas') {
      tem = true;
      // as colunas em volta da fachada: do chão até a borda da cobertura, abrindo para fora no meio (a curva do Castelão)
      const c = cor(m.cor);
      for (const cc of m.colunas) {
        const N = 5, pts = [];
        for (let i = 0; i <= N; i++) { const u = i / N, r = cc.r0 + Math.sin(Math.PI * u) * (cc.alto ? 0 : 2.2) + (cc.alto ? u * 4 : 0), y = cc.y1 * u; pts.push([r * Math.cos(cc.th), y, r * Math.sin(cc.th)]); }
        for (let i = 0; i < N; i++) L.barra(pts[i], pts[i + 1], m.larg, c, UV_NORMAL);
      }
    } else if (m.tipo === 'mastros') {
      tem = true;
      for (const t of m.mastros) {
        // o pilone (uma treliça amarela em pé) e os cabos até a borda da cobertura
        L.cilindro(t.x, 0, t.z, t.alto, 1.2, cor(m.cor), 6, 0.7, UV_NORMAL);
        const c = P.cobEm(t.th);
        if (c) {
          const r = (c.fora + c.dentro) / 2;
          L.barra([t.x, t.alto, t.z], [r * Math.cos(t.th), (c.yFora + c.yDentro) / 2 + 1, r * Math.sin(t.th)], 0.25, esc, UV_NORMAL);
          L.barra([t.x, t.alto, t.z], [c.fora * Math.cos(t.th), c.yFora + 1, c.fora * Math.sin(t.th)], 0.25, esc, UV_NORMAL);
        }
      }
    } else if (m.tipo === 'estatua') {
      tem = true;
      L.caixa(m.x, 1.6, m.z, 4.2, 3.2, 4.2, 0, conc, 6, UV_NORMAL);
      L.cilindro(m.x, 3.2, m.z, 3.2 + m.alto * 0.55, 0.9, cor(0x7b6a4a), 8, 0.7, UV_NORMAL);
      L.cilindro(m.x, 3.2 + m.alto * 0.55, m.z, 3.2 + m.alto * 0.7, 0.6, cor(0x7b6a4a), 8, 0.5, UV_NORMAL);
      L.barra([m.x, 3.2 + m.alto * 0.6, m.z], [m.x + 1.2, 3.2 + m.alto, m.z], 0.45, cor(0x7b6a4a), UV_NORMAL);
    } else if (m.tipo === 'cupula') {
      tem = true;
      L.cilindro(m.x, 0, m.z, m.parede, m.raio, cor(0xd8d6cf), 40, m.raio, UV_NORMAL);
      // a cúpula (anéis de latitude)
      const NL = 8;
      for (let i = 0; i < NL; i++) {
        const a0 = (i / NL) * Math.PI / 2, a1 = ((i + 1) / NL) * Math.PI / 2;
        L.cilindro(m.x, m.parede + m.alto * Math.sin(a0), m.z, m.parede + m.alto * Math.sin(a1), m.raio * Math.cos(a0), cor(0xe9e8e2), 40, m.raio * Math.cos(a1), UV_NORMAL);
      }
    }
  }
  if (!tem) return null;
  const mat = new THREE.MeshLambertMaterial({ map: texEstrutura(false), emissiveMap: texEstrutura(true), emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, side: THREE.DoubleSide });
  const mm = new THREE.Mesh(L.geo(), mat);
  mm.name = 'fora-marcas';
  return mm;
}
function criarChaoEsplanada(P, q, aniso) {
  const R = P.rEsplanada;
  const g = new THREE.PlaneGeometry(2 * R, 2 * R);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.05, 0);
  // o uv do plano já cobre de −R a R (a textura desenha no mundo); o v inverte (o canvas desce em z+)
  const uvA = g.attributes.uv;
  for (let i = 0; i < uvA.count; i++) uvA.setY(i, 1 - uvA.getY(i));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: texEsplanada(P, q, aniso) }));
  m.name = 'fora-esplanada';
  return m;
}
function criarChaoBairro(P, q, aniso) {
  const M = 1300;
  const g = new THREE.PlaneGeometry(2 * M, 2 * M);
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.25, 0);
  const tex = texChao(P, q, aniso, P.forma.entorno.tipo);
  tex.repeat.set((2 * M) / 44, (2 * M) / 44);
  // as ruas entre as quadras de estadio-generico.js predios (centros em 44·i): a quadra centrada no ladrilho
  tex.offset.set(((-M + 22) / 44) % 1, ((-M + 22) / 44) % 1);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
  // as ruas giradas como as quadras (estadio-generico.js predios: o mesmo giro)
  m.rotation.y = -P.forma.giroBairro;
  m.name = 'fora-chao';
  return m;
}
/** A avenida em volta da esplanada: o asfalto em anel, a faixa do meio tracejada e a calçada de fora. */
function avenidaNaMalha(L, P) {
  const A = P.avenida, N = 200, y = 0.075;
  const asf = cor(0x3f4245), faixa = cor(0xe8d36a), calc = cor(0xa9a69e), meio = (A.r0 + A.r1) / 2;
  const p = (th, r, yy = y) => [r * Math.cos(th), yy, r * Math.sin(th)];
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N, b = (2 * Math.PI * (i + 1)) / N, m = (a + b) / 2;
    if (P.naAgua(Math.cos(m) * meio, Math.sin(m) * meio, 2)) continue;
    L.q4(p(a, A.r0), p(b, A.r0), p(b, A.r1), p(a, A.r1), asf, UV_NORMAL);
    L.q4(p(a, A.r1), p(b, A.r1), p(b, A.r1 + 3.2), p(a, A.r1 + 3.2), calc, UV_NORMAL);
    if (i % 2 === 0) L.q4(p(a, meio - 0.12, y + 0.01), p(b, meio - 0.12, y + 0.01), p(b, meio + 0.12, y + 0.01), p(a, meio + 0.12, y + 0.01), faixa, UV_NORMAL);
  }
}
/** As peças da rua e da praça (estadio-generico.js pecasRua) numa malha só. */
function pecasNaMalha(L, P, corClube, corClube2) {
  const metal = cor(0x6b7075), lamp = cor(0xfff1d0), conc = cor(0xbab7af), vidro = cor(0x7d93a3), esc = cor(0x2c3034);
  const lonas = ['#c8102e', '#1d4f91', '#f2c21b', '#1f7a3a', '#f2f2f0'].map(cor), clube = cor(corClube), clube2 = cor(corClube2);
  const ads = ['#e8e5dc', '#1d4f91', '#f2c21b', '#c8102e', '#2b2f33'].map(cor);
  for (const q of P.pecasRua()) {
    const h = q.rumo ?? 0, ch = Math.cos(h), sh = Math.sin(h);
    if (q.tipo === 'poste') {
      L.cilindro(q.x, 0, q.z, q.alto, 0.13, metal, 6, 0.09, UV_NORMAL);
      const hx = q.x + ch * 1.4, hz = q.z + sh * 1.4;
      L.barra([q.x, q.alto, q.z], [hx, q.alto, hz], 0.12, metal, UV_NORMAL);
      L.caixa(hx, q.alto - 0.12, hz, 0.9, 0.22, 0.4, h, lamp, 6, UV_ACESO);
    } else if (q.tipo === 'mastro') {
      L.cilindro(q.x, 0, q.z, q.alto, 0.1, cor(0xd8dadc), 6, 0.07, UV_NORMAL);
      L.q4([q.x, q.alto - 0.2, q.z], [q.x + 3, q.alto - 0.35, q.z + 0.15], [q.x + 3, q.alto - 2.1, q.z + 0.15], [q.x, q.alto - 2.0, q.z], q.faixa ? clube2 : clube, UV_NORMAL);
    } else if (q.tipo === 'bilheteria') {
      L.caixa(q.x, 1.4, q.z, 5, 2.8, 3, h + Math.PI / 2, conc, 5, UV_NORMAL);
      L.caixa(q.x - sh * 0.01, 1.7, q.z + ch * 0.01, 4.2, 0.9, 3.05, h + Math.PI / 2, vidro, 2, UV_NORMAL);
      L.caixa(q.x, 3.0, q.z, 5.6, 0.3, 3.6, h + Math.PI / 2, clube, 6, UV_NORMAL);
    } else if (q.tipo === 'banca') {
      L.caixa(q.x, 1.2, q.z, 2.6, 2.4, 2.2, h, cor(0x2f6b3a), 5, UV_NORMAL);
      L.caixa(q.x, 2.5, q.z, 3.2, 0.2, 2.8, h, cor(0x245a2f), 6, UV_NORMAL);
    } else if (q.tipo === 'barraca') {
      // a barraca de ambulante: 4 pés e a lona em pirâmide na cor dela, o balcão embaixo
      const lona = lonas[q.cor % lonas.length], w = 1.5;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.cilindro(q.x + (a * ch - b * sh) * w, 0, q.z + (a * sh + b * ch) * w, 2.2, 0.05, metal, 4, 0.05, UV_NORMAL);
      const P4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [q.x + (a * ch - b * sh) * (w + 0.3), 2.2, q.z + (a * sh + b * ch) * (w + 0.3)]);
      for (let i = 0; i < 4; i++) { const t = [q.x, 3.1, q.z], a = P4[i], b = P4[(i + 1) % 4]; L.q4(a, b, t, t, lona, UV_NORMAL); }
      L.caixa(q.x, 0.5, q.z, 2.6, 1.0, 1.0, h, cor(0xd8d2c2), 5, UV_NORMAL);
    } else if (q.tipo === 'outdoor') {
      for (const sx of [-1, 1]) L.cilindro(q.x + ch * sx * 3.5, 0, q.z + sh * sx * 3.5, 5, 0.18, metal, 6, 0.18, UV_NORMAL);
      L.caixa(q.x, 6.8, q.z, 10, 3.8, 0.35, h, esc, 6, UV_NORMAL);
      // a arte (fictícia): duas cores do anúncio
      const a1 = ads[q.n % ads.length], a2 = ads[(q.n + 2) % ads.length];
      for (const sz of [-1, 1]) {
        const o = sz * 0.19, ox = -sh * o, oz = ch * o;
        L.q4([q.x - ch * 4.8 + ox, 5.1, q.z - sh * 4.8 + oz], [q.x + ch * 4.8 + ox, 5.1, q.z + sh * 4.8 + oz], [q.x + ch * 4.8 + ox, 8.5, q.z + sh * 4.8 + oz], [q.x - ch * 4.8 + ox, 8.5, q.z - sh * 4.8 + oz], a1, UV_NORMAL);
        L.q4([q.x - ch * 4.8 + ox, 7.6, q.z - sh * 4.8 + oz * 1.02], [q.x + ch * 1.0 + ox, 7.6, q.z + sh * 1.0 + oz * 1.02], [q.x + ch * 1.0 + ox, 8.4, q.z + sh * 1.0 + oz * 1.02], [q.x - ch * 4.8 + ox, 8.4, q.z - sh * 4.8 + oz * 1.02], a2, UV_NORMAL);
      }
    } else if (q.tipo === 'onibus') {
      L.caixa(q.x, 2.6, q.z, 4.2, 0.15, 1.8, h, metal, 6, UV_NORMAL);
      L.caixa(q.x - sh * 0.8, 1.35, q.z + ch * 0.8, 4.0, 2.3, 0.06, h, vidro, 6, UV_NORMAL);
      for (const sx of [-1, 1]) L.cilindro(q.x + ch * sx * 1.9, 0, q.z + sh * sx * 1.9, 2.6, 0.06, metal, 4, 0.06, UV_NORMAL);
      L.caixa(q.x, 0.45, q.z, 2.6, 0.12, 0.45, h, conc, 6, UV_NORMAL);
    } else if (q.tipo === 'ponte') {
      // o tabuleiro sobre o rio, o guarda-corpo dos dois lados e os pilares na água
      L.caixa(q.x, 6, q.z, q.comp, 1.2, 14, h, conc, 6, UV_NORMAL);
      for (const sz of [-1, 1]) L.caixa(q.x - sh * sz * 6.8, 7.1, q.z + ch * sz * 6.8, q.comp, 1.0, 0.25, h, cor(0x8d9094), 6, UV_NORMAL);
      for (const sx of [-0.25, 0.25]) L.caixa(q.x + ch * sx * q.comp, 3, q.z + sh * sx * q.comp, 2.2, 6, 10, h, cor(0x9c998f), 4, UV_NORMAL);
      L.caixa(q.x, 6.62, q.z, q.comp, 0.05, 9, h, cor(0x3f4245), 1, UV_NORMAL);
    }
  }
}
/** Prédios e casas (instanciados; a parede com as janelas no shader, acesas à noite por sorteio) com o telhado de 2
 * águas nas casas (a mesma malha: os vértices do telhado descem até a laje nos prédios de teto plano). */
function criarPrediosG(uNoite, L) {
  const caixa = new THREE.BoxGeometry(1, 1, 1); caixa.translate(0, 0.5, 0);
  // o telhado: o prisma da cumeeira ao longo de x, de y 1 a 1,38 (× a altura do prédio)
  const tp = [-0.52, 1, -0.54, 0.52, 1, -0.54, 0.52, 1.38, 0, -0.52, 1.38, 0, -0.52, 1, 0.54, 0.52, 1, 0.54];
  const tel = new THREE.BufferGeometry();
  tel.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  tel.setIndex([0, 3, 1, 1, 3, 2, 4, 5, 2, 4, 2, 3, 0, 4, 3, 1, 2, 5]);
  tel.computeVertexNormals();
  const cx = caixa.toNonIndexed(), tx = tel.toNonIndexed();
  const g = new THREE.BufferGeometry();
  const pos = [...cx.attributes.position.array, ...tx.attributes.position.array], nrm = [...cx.attributes.normal.array, ...tx.attributes.normal.array];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aParte', new THREE.Float32BufferAttribute([...new Array(cx.attributes.position.count).fill(0), ...new Array(tx.attributes.position.count).fill(1)], 1));
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uNoite = uNoite;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aParte;\nattribute float aTel;\nattribute vec3 aCorTel;\nvarying vec3 vMP;\nvarying vec3 vNP;\nvarying float vParte;\nvarying vec3 vCorTel;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (aParte > 0.5) transformed.y = 1.0 + (transformed.y - 1.0) * aTel;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vMP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vNP = normalize(mat3(instanceMatrix) * objectNormal);
        vParte = aParte; vCorTel = aCorTel;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uNoite;
        varying vec3 vMP;
        varying vec3 vNP;
        varying float vParte;
        varying vec3 vCorTel;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float jan = 0.0; vec2 cel = vec2(0.0);
        if (vParte > 0.5) diffuseColor.rgb = vCorTel;
        else if (abs(vNP.y) < 0.5) {
          vec2 t = normalize(vec2(-vNP.z, vNP.x));
          vec2 q = vec2(dot(vMP.xz, t) / 2.7, vMP.y / 3.2);
          cel = floor(q);
          vec2 f = fract(q);
          jan = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.8) * step(1.0, vMP.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.17, 0.2), jan * 0.72);
          // a porta/vitrine no térreo e a sombra do pé da parede
          diffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 1.2, vMP.y);
        } else diffuseColor.rgb *= 0.8;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += jan * uNoite * step(0.6, h21(cel + vMP.xz * 0.013)) * vec3(1.0, 0.82, 0.55) * 0.85;`);
  };
  mat.customProgramCacheKey = () => 'fora-predios-telhado';
  const m = new THREE.InstancedMesh(g, mat, L.length);
  const aTel = new Float32Array(L.length), aCor = new Float32Array(3 * L.length);
  const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), Pp = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  L.forEach((p, i) => {
    Qt.setFromAxisAngle(Y, -p.rumo);
    M4.compose(Pp.set(p.x, 0, p.z), Qt, S.set(p.lx, p.h, p.lz));
    m.setMatrixAt(i, M4);
    m.setColorAt(i, C.set(p.cor ?? '#c9c2b3'));
    aTel[i] = p.telhado ? 1 : 0;
    C.set(p.corTel ?? '#8f4a2c'); aCor[3 * i] = C.r; aCor[3 * i + 1] = C.g; aCor[3 * i + 2] = C.b;
  });
  g.setAttribute('aTel', new THREE.InstancedBufferAttribute(aTel, 1));
  g.setAttribute('aCorTel', new THREE.InstancedBufferAttribute(aCor, 3));
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.name = 'fora-predios';
  return m;
}
/** Árvores leves (copa em cone de 7 lados e o tronco), instanciadas, com o verde variando. */
function criarArvoresG(L, semente) {
  const tronco = new THREE.CylinderGeometry(0.06, 0.09, 0.4, 5, 1, true); tronco.translate(0, 0.2, 0);
  const copa = new THREE.ConeGeometry(0.42, 0.75, 7, 1, false); copa.translate(0, 0.72, 0);
  const g = juntarGeometrias([tronco, copa], [cor(0x5a4330), cor(0x3f7a35)]);
  const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), L.length);
  const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), Pp = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  const r = gerador(semente + 8);
  L.forEach((a, i) => {
    Qt.setFromAxisAngle(Y, r() * 6.28);
    const k = a.raio / 0.42;
    M4.compose(Pp.set(a.x, 0, a.z), Qt, S.set(k, a.h, k));
    m.setMatrixAt(i, M4);
    m.setColorAt(i, C.setHSL(0.25 + r() * 0.08, 0.42 + r() * 0.15, 0.62 + r() * 0.3));
  });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.name = 'fora-arvores';
  return m;
}
/** A água na malha das marcas (a −0,1 m: por cima do chão do bairro, −0,25, e por baixo da esplanada, 0,05). */
function aguaNaMalha(L, P) {
  const A = P.agua();
  if (!A) return false;
  const c = cor(0x3f6f86), y = -0.1;
  if (A.tipo === 'lago') {
    const N = 40;
    for (let i = 0; i < N; i++) {
      const a0 = (2 * Math.PI * i) / N, a1 = (2 * Math.PI * (i + 1)) / N;
      L.q4([A.x, y, A.z], [A.x, y, A.z], [A.x + A.raio * Math.cos(a1), y, A.z + A.raio * Math.sin(a1)], [A.x + A.raio * Math.cos(a0), y, A.z + A.raio * Math.sin(a0)], c, UV_NORMAL);
    }
    return true;
  }
  // a faixa (rio/canal) ou o meio-plano (mar) ao longo da perpendicular (nx, nz)
  const d0 = A.d, d1 = A.tipo === 'mar' ? A.d + 2600 : A.d + A.larg, ex = -A.nz, ez = A.nx, M = 1500;
  const p = (t, s2) => [A.nx * t + ex * s2, y, A.nz * t + ez * s2];
  L.q4(p(d0, -M), p(d0, M), p(d1, M), p(d1, -M), c, UV_NORMAL);
  return true;
}
/** Os morros/montanhas do horizonte na malha das marcas (as cristas em fatias de anel, verdes perto e azuladas longe). */
function relevoNaMalha(L, P) {
  const lista = P.relevo();
  if (!lista.length) return false;
  const verde = cor(0x5b7451), longe = cor(0x8193a0);
  for (const h of lista) {
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a0 = h.th - h.larg / 2 + (h.larg * i) / N, a1 = h.th - h.larg / 2 + (h.larg * (i + 1)) / N;
      const f = t => Math.pow(Math.sin(Math.PI * t), 0.8) * (0.8 + 0.2 * Math.sin(17 * t + h.th));
      const y0 = h.alto * f(i / N), y1 = h.alto * f((i + 1) / N);
      const pp = (a, r, y) => [r * Math.cos(a), y, r * Math.sin(a)];
      const c = h.dist > 2000 ? longe : verde;
      L.q4(pp(a0, h.dist, -0.5), pp(a1, h.dist, -0.5), pp(a1, h.dist - 60, y1), pp(a0, h.dist - 60, y0), c, UV_NORMAL);
    }
  }
  return true;
}
