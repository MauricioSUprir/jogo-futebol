// Faixas, bandeiras de mastro e bandeirões da torcida (three.js; pedido de 11/10: "coloca mais torcida no estádio,
// bandeirões..."). Tudo numa malha só (1 chamada de desenho): as faixas paradas na mureta, as bandeiras com a onda do
// pano e o balanço do mastro no VERTEX SHADER (a conta de bandeiras-dados.js, BANDEIRA_GLSL) e os dois bandeirões,
// que abrem na saída de cada tempo e no gol da casa (festa.js aberturaBandeirao) com uma onda correndo na largura.
// Opaco e desenhado ANTES da torcida (renderOrder −1): o bandeirão aberto esconde quem está embaixo e o teste de
// profundidade descarta esses torcedores antes do fragment shader. Debaixo do pano aberto ninguém fura: as bandeiras
// de mastro abaixam (sobBandeirao) e os torcedores seguram o pano sem pular (torcida.js). Atlas desenhado por código
// (nomes FICTÍCIOS).
// Qualidade: o que desenhar é um prefixo da malha (Baixa ⊂ Média ⊂ Alta: 8/10/12 faixas, 6/16/32 bandeiras); na Baixa
// nada mexe (sem onda nem balanço). Luz dos refletores à noite e a luz falsa dos sinalizadores (luz-falsa.js).
import * as THREE from 'three';
import { BANDEIRAS, faixas, bandeiras, bandeiroes, BANDEIRA_GLSL, BANDEIRAO_GLSL, SOB_GLSL } from './bandeiras-dados.js';
import { aberturaBandeirao } from './festa.js';
import { LUZ_FALSA_GLSL, UNIFORMS_LUZ } from './luz-falsa.js';
import { criarCanvas, texturaCanvas } from './util.js';
import { desenharEscudo, imagemEscudo } from './escudo-desenho.js';

const ATLAS = 1024;
const SLOT_FAIXA = 48;                       // px de altura de cada faixa no atlas
const Y_BANDEIRA = 576, BAND_W = 182, BAND_H = 128;
const Y_BANDEIRAO = 704;
const BANDEIRAO_PX = [[0, Y_BANDEIRAO, 512, 128], [512, Y_BANDEIRAO, 512, 298]];
const MASTRO_PX = [8, 1012, 8, 8];

const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec2 aLocal;
attribute vec4 aMeta;
uniform float uTempo;
uniform float uAnimada;
uniform vec2 uAbre;
uniform vec3 uBandA[2];
uniform vec3 uBandU[2];
uniform vec3 uBandV[2];
uniform vec3 uBandN[2];
uniform vec2 uBandLarg;
uniform vec3 uSol;
uniform vec2 uLuz;
varying vec2 vUv;
varying float vLuz;
varying vec3 vFlare;
${BANDEIRA_GLSL}
${BANDEIRAO_GLSL}
${SOB_GLSL}
${LUZ_FALSA_GLSL}
void main() {
  float tipo = aMeta.x;
  vec3 p;
  vec3 n;
  if (tipo < 0.5) {
    p = position;
    n = vec3(aMeta.z, 0.0, aMeta.w);
  } else if (tipo < 2.5) {
    vec3 e = vec3(aMeta.z, 0.0, aMeta.w);
    n = vec3(-e.z, 0.0, e.x);
    vec3 l;
    if (tipo < 1.5) l = bandeiraPonto(aLocal.x, aLocal.y, aMeta.y, uTempo, uAnimada);
    else {
      float th = uAnimada > 0.5 ? ${BANDEIRAS.onda.bal.toFixed(3)} * sin(${(2 * Math.PI * BANDEIRAS.onda.balHz).toFixed(5)} * uTempo + aMeta.y) : 0.0;
      float c = cos(th), s = sin(th);
      l = vec3(c * aLocal.x - s * aLocal.y, s * aLocal.x + c * aLocal.y, 0.0);
    }
    // debaixo do bandeirão aberto a bandeira abaixa (some na mão): nada de mastro furando o pano
    vec2 mb = vec2(${BANDEIRAS.sob.bandeira.map(v => v.toFixed(2)).join(', ')});
    float sob = max(sobBandeirao(position, uBandA[0], uBandU[0], uBandV[0], uAbre.x, mb), sobBandeirao(position, uBandA[1], uBandU[1], uBandV[1], uAbre.y, mb));
    l *= 1.0 - sob;
    p = position + e * l.x + vec3(0.0, l.y, 0.0) + n * l.z;
  } else {
    bool k0 = tipo < 3.5;
    float ab = k0 ? uAbre.x : uAbre.y;
    float v = min(aLocal.y, ab);
    float larg = k0 ? uBandLarg.x : uBandLarg.y;
    n = k0 ? uBandN[0] : uBandN[1];
    float dz = ondaBandeirao(aLocal.x, v, larg, uTempo, uAnimada) * ab;
    p = (k0 ? uBandA[0] : uBandA[1]) + (k0 ? uBandU[0] : uBandU[1]) * aLocal.x + (k0 ? uBandV[0] : uBandV[1]) * v + n * dz;
  }
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = uv;
  vLuz = uLuz.x + uLuz.y * abs(dot(n, uSol));
  vFlare = luzFalsa(p);
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uAtlas;
varying vec2 vUv;
varying float vLuz;
varying vec3 vFlare;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.5) discard;
  gl_FragColor = vec4(t.rgb * (vLuz + vFlare), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/**
 * Atlas (1024²): as faixas (uma linha de 48 px cada), 4 desenhos de bandeira, os 2 bandeirões e o mastro. festa (só com
 * ?tm; identidade.js festa): as cores do mandante no lugar do verde/preto/branco, o nome dele no bandeirão do lado de
 * lá e o escudo (escudo = a imagem decodificada; sem ela, a sigla) no da organizada e numa bandeira de mastro.
 */
function atlasFesta(lista, festa = null, escudo = null) {
  const c = criarCanvas(ATLAS, ATLAS);
  const g = c.getContext('2d');
  g.clearRect(0, 0, ATLAS, ATLAS);
  const fonte = (peso, tam) => `${peso} ${tam}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
  // faixas
  for (const f of lista) {
    const y0 = f.slot * SLOT_FAIXA, w = Math.min(ATLAS, Math.round(SLOT_FAIXA * f.larg / BANDEIRAS.faixaAlt)), h = SLOT_FAIXA;
    g.fillStyle = f.fundo; g.fillRect(0, y0, w, h);
    if (f.detalhe === 'borda') { g.strokeStyle = f.letra; g.lineWidth = 3; g.strokeRect(3, y0 + 3, w - 6, h - 6); }
    if (f.detalhe === 'listras') { g.fillStyle = f.letra; g.fillRect(0, y0 + 3, w, 3); g.fillRect(0, y0 + h - 6, w, 3); }
    if (f.detalhe === 'verde') { g.fillStyle = f.detalheCor ?? '#19e07a'; g.fillRect(0, y0, 10, h); g.fillRect(w - 10, y0, 10, h); }
    g.save();
    g.beginPath(); g.rect(0, y0, w, h); g.clip();
    g.fillStyle = f.letra; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = fonte(900, 34);
    const larg = g.measureText(f.texto).width, alvo = w * 0.86;
    g.translate(w / 2, y0 + h / 2 + 2);
    g.scale(Math.min(1.25, alvo / Math.max(1, larg)), 1);
    g.fillText(f.texto, 0, 0);
    g.restore();
  }
  // bandeiras (Golaço FC): metades, faixa diagonal, estrela e listras
  const { VERDE, PRETO, BRANCO, VERDE2 } = festa ? festa.cores : { VERDE: '#19e07a', PRETO: '#07090a', BRANCO: '#f2f4f3', VERDE2: '#0d8447' };
  const letra = festa ? festa.letra : 'G', nomeBand = festa ? festa.texto : 'GOLAÇO';
  // a letra/escudo no círculo (bandeira 2 e bandeirão da organizada): o escudo do mandante, se veio; senão a letra
  const noCirculo = (cx, cy, r, tamLetra, cor) => {
    if (escudo && desenharEscudo(g, escudo, cx - r * 0.82, cy - r * 0.82, r * 1.64, r * 1.64)) return;
    g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = fonte(900, tamLetra);
    g.fillText(letra, cx, cy + tamLetra * 0.06);
  };
  for (let d = 0; d < 4; d++) {
    const x0 = d * 256, y0 = Y_BANDEIRA, w = BAND_W, h = BAND_H;
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    if (d === 0) { g.fillStyle = PRETO; g.fillRect(x0, y0, w / 2, h); g.fillStyle = VERDE; g.fillRect(x0 + w / 2, y0, w / 2, h); }
    else if (d === 1) { g.fillStyle = PRETO; g.fillRect(x0, y0, w, h); g.fillStyle = VERDE; g.beginPath(); g.moveTo(x0, y0 + h); g.lineTo(x0 + w * 0.3, y0 + h); g.lineTo(x0 + w, y0 + h * 0.15); g.lineTo(x0 + w, y0); g.lineTo(x0 + w * 0.7, y0); g.lineTo(x0, y0 + h * 0.85); g.closePath(); g.fill(); }
    else if (d === 2) {
      g.fillStyle = VERDE2; g.fillRect(x0, y0, w, h);
      g.fillStyle = PRETO; g.beginPath(); g.arc(x0 + w / 2, y0 + h / 2, h * 0.36, 0, Math.PI * 2); g.fill();
      if (festa) noCirculo(x0 + w / 2, y0 + h / 2, h * 0.36, 66, festa.corLetra);
      else { g.fillStyle = VERDE; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = fonte(900, 66); g.fillText('G', x0 + w / 2, y0 + h / 2 + 4); }
    } else { for (let k = 0; k < 5; k++) { g.fillStyle = [VERDE, PRETO, BRANCO, PRETO, VERDE][k]; g.fillRect(x0, y0 + k * h / 5, w, h / 5 + 1); } }
    g.restore();
  }
  // bandeirão do lado de lá (40 × 10 m): GOLAÇO grande no verde com as faixas pretas
  {
    const [x0, y0, w, h] = BANDEIRAO_PX[0];
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    g.fillStyle = VERDE; g.fillRect(x0, y0, w, h);
    g.fillStyle = PRETO;
    for (let k = -2; k < 9; k++) { g.beginPath(); g.moveTo(x0 + k * 64, y0 + h); g.lineTo(x0 + k * 64 + 24, y0 + h); g.lineTo(x0 + k * 64 + 24 + h * 0.5, y0); g.lineTo(x0 + k * 64 + h * 0.5, y0); g.closePath(); g.fill(); }
    g.fillStyle = PRETO; g.fillRect(x0 + 40, y0 + 18, w - 80, h - 36);
    g.fillStyle = festa ? festa.corLetra : VERDE; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = fonte(900, 80);
    const larg = g.measureText(nomeBand).width;
    g.translate(x0 + w / 2, y0 + h / 2 + 4); g.scale(Math.min(1.2, (w - 120) / larg), 1); g.fillText(nomeBand, 0, 0);
    g.restore();
  }
  // bandeirão da organizada (24 × 14 m): listras verdes e pretas (qualquer pedaço dele lê como a bandeira do time — a
  // câmera do gol pega só um canto, e a metade preta inteira de antes virava uma mancha escura), o G no círculo e as 3
  // estrelas
  {
    const [x0, y0, w, h] = BANDEIRAO_PX[1];
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    const NL = 8;
    for (let k = 0; k < NL; k++) { g.fillStyle = k % 2 ? PRETO : VERDE; g.fillRect(x0 + Math.round(k * w / NL), y0, Math.ceil(w / NL) + 1, h); }
    g.fillStyle = BRANCO; g.beginPath(); g.arc(x0 + w / 2, y0 + h / 2, h * 0.34, 0, Math.PI * 2); g.fill();
    g.fillStyle = PRETO; g.beginPath(); g.arc(x0 + w / 2, y0 + h / 2, h * 0.3, 0, Math.PI * 2); g.fill();
    if (festa) noCirculo(x0 + w / 2, y0 + h / 2, h * 0.3, 150, festa.corLetra);
    else { g.fillStyle = VERDE; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = fonte(900, 150); g.fillText('G', x0 + w / 2, y0 + h / 2 + 10); }
    const estrela = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    g.fillStyle = BRANCO;
    for (let k = -1; k <= 1; k++) estrela(x0 + w / 2 + k * 46, y0 + 30, 15);
    g.restore();
  }
  // mastro (cinza-claro)
  g.fillStyle = '#c9ced1'; g.fillRect(...MASTRO_PX);
  return texturaCanvas(c, { cor: true, aniso: 4 });
}

const u = x => x / ATLAS, v = y => 1 - y / ATLAS;   // canvas → uv (flipY)

/**
 * Cria a malha. opc = {qualidade, hora, identidade (identidade.js; só a do Total Match muda os textos e as cores)}.
 * Devolve {mesh, atualizar(festa, t), definirQualidade(q), definirHora(h), contagem}.
 */
export function criarBandeiras(cena, opc = {}) {
  const ident = opc.identidade && opc.identidade.tm ? opc.identidade : null;
  const lFaixas = ident ? faixas(ident.faixas) : faixas(), lBand = bandeiras(), lBand2 = bandeiroes();
  const pos = [], uv = [], loc = [], meta = [];
  const B = BANDEIRAS;
  function vert(p, t, l, m) { pos.push(p[0], p[1], p[2]); uv.push(t[0], t[1]); loc.push(l[0], l[1]); meta.push(m[0], m[1], m[2], m[3]); }
  function quad(a, b, c, d) { vert(...a); vert(...b); vert(...c); vert(...a); vert(...c); vert(...d); }
  function faixa(f) {
    const A = B.faixaAlt, y0 = B.faixaY, y1 = y0 + A;
    const w = Math.min(ATLAS, Math.round(SLOT_FAIXA * f.larg / A));
    const t0 = [0, v(f.slot * SLOT_FAIXA + SLOT_FAIXA - 1)], t1 = [u(w), v(f.slot * SLOT_FAIXA + 1)];
    // de frente para o campo, 3 cm à frente da mureta
    let p0, p1, p2, p3, nx, nz;
    if (f.setor === 0) { const z = f.z + 0.03, xa = f.centro - f.larg / 2, xb = f.centro + f.larg / 2; p0 = [xa, y0, z]; p1 = [xb, y0, z]; p2 = [xb, y1, z]; p3 = [xa, y1, z]; nx = 0; nz = 1; }
    else {
      const s = f.setor === 1 ? 1 : -1, x = f.x - s * 0.03;
      // visto do campo, a esquerda do fundo +x é −z (e a do fundo −x é +z)
      const za = f.centro - s * f.larg / 2, zb = f.centro + s * f.larg / 2;
      p0 = [x, y0, za]; p1 = [x, y0, zb]; p2 = [x, y1, zb]; p3 = [x, y1, za]; nx = -s; nz = 0;
    }
    const m = [0, 0, nx, nz];
    quad([p0, [t0[0], t0[1]], [0, 0], m], [p1, [t1[0], t0[1]], [0, 0], m], [p2, [t1[0], t1[1]], [0, 0], m], [p3, [t0[0], t1[1]], [0, 0], m]);
  }
  function bandeira(bd) {
    const NA = 8, NB = 4, W = B.largura, H = B.altura;
    const x0 = bd.desenho * 256;
    const base = [bd.x, bd.y, bd.z];
    const m1 = [1, bd.fase, bd.ex, bd.ez], m2 = [2, bd.fase, bd.ex, bd.ez];
    for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) {
      const a0 = W * i / NA, a1 = W * (i + 1) / NA, b0 = H * j / NB, b1 = H * (j + 1) / NB;
      const tu = a => u(x0 + 1 + (BAND_W - 2) * a / W), tv = b => v(Y_BANDEIRA + 1 + (BAND_H - 2) * b / H);
      quad([base, [tu(a0), tv(b0)], [a0, b0], m1], [base, [tu(a1), tv(b0)], [a1, b0], m1], [base, [tu(a1), tv(b1)], [a1, b1], m1], [base, [tu(a0), tv(b1)], [a0, b1], m1]);
    }
    const tm = [u(MASTRO_PX[0] + 4), v(MASTRO_PX[1] + 4)], r = 0.035, h = B.mastro + 0.1;
    quad([base, tm, [-r, 0], m2], [base, tm, [r, 0], m2], [base, tm, [r, h], m2], [base, tm, [-r, h], m2]);
  }
  function bandeirao(bd) {
    const [NU, NV] = B.bandeirao.divisoes, [x0, y0, w, h] = BANDEIRAO_PX[bd.slot];
    const m = [3 + bd.slot, 0, 0, 0];
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a0 = i / NU, a1 = (i + 1) / NU, b0 = j / NV, b1 = (j + 1) / NV;
      // o desenho: a largura (u) da esquerda para a direita; a profundidade (v) de baixo (frente) para cima
      const tu = a => u(x0 + 1 + (w - 2) * a), tv = b => v(y0 + h - 1 - (h - 2) * b);
      const o = [0, 0, 0];
      quad([o, [tu(a0), tv(b0)], [a0, b0], m], [o, [tu(a1), tv(b0)], [a1, b0], m], [o, [tu(a1), tv(b1)], [a1, b1], m], [o, [tu(a0), tv(b1)], [a0, b1], m]);
    }
  }
  // ordem por qualidade (prefixos): Baixa, depois o que a Média acrescenta, depois o da Alta
  const cont = {};
  const Q = ['baixa', 'media', 'alta'];
  let fi = 0, bi = 0;
  for (let k = 0; k < Q.length; k++) {
    const q = Q[k];
    for (; fi < B.faixas[q]; fi++) faixa(lFaixas[fi]);
    for (; bi < B.bandeiras[q]; bi++) bandeira(lBand[bi]);
    if (k === 0) for (const b of lBand2) if (!b.vazio) bandeirao(b);
    cont[q] = pos.length / 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aLocal', new THREE.Float32BufferAttribute(loc, 2));
  geo.setAttribute('aMeta', new THREE.Float32BufferAttribute(meta, 4));
  const tex = ident ? atlasFesta(lFaixas, ident.festa, imagemEscudo(ident, ident.festa.escudo ?? 0)) : atlasFesta(lFaixas);
  const uni = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uAtlas: { value: tex }, uTempo: { value: 0 }, uAnimada: { value: 1 }, uAbre: { value: new THREE.Vector2(0, 0) },
    uBandA: { value: lBand2.map(b => new THREE.Vector3(...b.A)) }, uBandU: { value: lBand2.map(b => new THREE.Vector3(...b.U)) },
    uBandV: { value: lBand2.map(b => new THREE.Vector3(...b.V)) }, uBandN: { value: lBand2.map(b => new THREE.Vector3(...b.N)) },
    uBandLarg: { value: new THREE.Vector2(lBand2[0].larg, lBand2[1].larg) },
    uSol: { value: new THREE.Vector3(-0.42, 0.74, 0.52).normalize() }, uLuz: { value: new THREE.Vector2(0.62, 0.42) },
    uFlare: UNIFORMS_LUZ.uFlare, uFlareN: UNIFORMS_LUZ.uFlareN,
  };
  const material = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, fog: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'festa-bandeiras';
  mesh.frustumCulled = false;   // a mureta do lado de lá está em todo quadro do jogo; o resto mexe no shader
  mesh.renderOrder = -1;        // antes da torcida (o bandeirão esconde quem está embaixo)
  cena.add(mesh);
  let qualidade = null;
  const api = {
    mesh, uniforms: uni,
    contagem: { faixas: B.faixas, bandeiras: B.bandeiras, vertices: cont },
    /** festa (festa.js) e t no relógio dela (emocao.t). */
    atualizar(festa, t) {
      uni.uTempo.value = t % 3600;
      if (festa) uni.uAbre.value.set(aberturaBandeirao(festa, t), aberturaBandeirao(festa, t));
    },
    definirQualidade(q) {
      if (q === qualidade || !cont[q]) return;
      qualidade = q;
      geo.setDrawRange(0, cont[q]);
      uni.uAnimada.value = q === 'baixa' ? 0 : 1;
    },
    definirHora(h) { uni.uLuz.value.set(h === 'noite' ? 0.36 : 0.62, h === 'noite' ? 0.12 : 0.42); },
    dispose() { cena.remove(mesh); geo.dispose(); material.dispose(); tex.dispose(); },
  };
  api.definirQualidade(opc.qualidade ?? 'media');
  api.definirHora(opc.hora ?? 'dia');
  return api;
}
