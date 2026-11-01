// Torcedor 3D de perto (three.js; SOB DEMANDA — chega junto do render/cadeiras3d.js, que o cria; o modelo,
// assets/torcedor/torcedor.bin, só é baixado fora da qualidade Baixa). Item 69 da FILA, PR 2 de 4. Nos blocos de cadeiras
// 3D mais perto da câmera (render/cadeiras-dados.js escolherBlocos; render/torcedor-dados.js escolherTorcedores: px da
// cadeira na tela com histerese e teto de triângulos por qualidade; e o ORÇAMENTO de triângulos do quadro, que divide o que
// sobra entre as pessoas e as cadeiras: cadeiras-dados.js orcamentoPerto), os torcedores do quadro de hoje (render/torcida.js)
// viram um corpo 3D (homem ou mulher, ~300 ou ~125 triângulos) sentado NA cadeira, virado para o campo (o rumo dela). A
// pose é a MESMA do quadro no mesmo instante (render/torcedor-pose.js ESTADO_GLSL, com os uniforms do ânimo da própria
// torcida.js: os mesmos objetos) e o corpo dela vem da textura de animação (VAT, torcedor-dados.js): uma linha por pose,
// uma coluna por vértice (gl_VertexID). As cores são as do torcedor do quadro (camisa, pele, cabelo, o cachecol na cor do
// time); a calça e o tênis pela semente. Luz do sol de dia e dos refletores à noite (uma conta no shader, como o quadro) e
// a luz FALSA dos sinalizadores (luz-falsa.js: uniform, nunca PointLight). Na TV de jogo, nada (a cadeira 3D também não).
// Uma malha por (variação, nível): até 4 chamadas, só com algum bloco perto; o quadro dos que estão em 3D sai do desenho
// (torcida.ocultar). Só desenho: o hash não muda.
import * as THREE from 'three';
import { TORCEDOR3D, lerModelo, vatDados, variacaoDe, TORCEDOR_GLSL, escolherTorcedores, pxCadeira } from './torcedor-dados.js';
import { ESTADO_GLSL } from './torcedor-pose.js';
import { preencherBloco, IMPOSTOR } from './impostor-dados.js';
import { LUZ_FALSA_GLSL, UNIFORMS_LUZ } from './luz-falsa.js';

const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute float aReg;
attribute vec4 aPos;
attribute vec4 aCad;
attribute vec4 aCamisa;
attribute vec4 aPele;
attribute vec4 aCabelo;
attribute vec4 aInfo;
uniform vec3 uAcento0;
uniform vec3 uAcento1;
uniform vec3 uCalca[${TORCEDOR3D.calca.length}];
uniform vec3 uSapato[${TORCEDOR3D.sapato.length}];
uniform vec3 uSol;
uniform float uNoite;
varying vec3 vCor;
vec3 lin(vec3 c) { return c * c * (0.3 + 0.7 * c); }
${ESTADO_GLSL}
${LUZ_FALSA_GLSL}
${TORCEDOR_GLSL}
void main() {
  float h = aPele.w;
  // a pose, o pulo e o balanço do quadro (o mesmo lugar aPos e as mesmas sementes): o mesmo instante, a mesma pose
  vec3 est = torcedorEstado(aPos.xyz, h, aInfo);
  vec3 nl;
  vec3 q = torcedorLocal(gl_VertexID, est.x, aPos.w, est.y, est.z, nl);
  vec3 p = torcedorMundo(q, aCad, aPos.y);
  vec3 n = normalize(torcedorNormal(nl, aCad));
  int r = int(aReg + 0.5);
  vec3 c;
  if (r == 0) c = lin(aCamisa.rgb);
  else if (r == 1) c = lin(aPele.rgb);
  else if (r == 2) c = lin(aCabelo.rgb);
  else if (r == 3) c = uCalca[int(fract(h * 13.13) * ${TORCEDOR3D.calca.length}.0)];
  else if (r == 4) c = uSapato[int(fract(h * 5.71) * ${TORCEDOR3D.sapato.length}.0)];
  else c = aInfo.x > 0.5 ? uAcento1 : uAcento0;
  // o sol de dia (a mesma luz do quadro: 0,62 + 0,42·N·L com a normal de verdade) e os refletores à noite (de cima)
  float luz = uNoite > 0.5 ? 0.33 + 0.17 * (0.5 + 0.5 * n.y) : 0.6 + 0.44 * max(0.0, dot(n, uSol));
  // cada um com a sua luz (como o quadro) e a fileira da frente fazendo sombra nas pernas
  float piv = est.x < ${TORCEDOR3D.sentadas}.0 - 0.5 ? ${TORCEDOR3D.assento.toFixed(2)} : 0.0;
  luz *= (0.88 + 0.24 * fract(h * 7.31)) * (0.7 + 0.3 * smoothstep(0.05, 0.75, q.y - piv * 0.5));
  vCor = c * (luz + luzFalsa(p));
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
varying vec3 vCor;
void main() {
  gl_FragColor = vec4(vCor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
// o sol do dia (o mesmo do quadro: render/torcida.js SOL_DIA)
const SOL = (() => { const s = [-0.42, 0.74, 0.52], l = Math.hypot(...s); return new THREE.Vector3(s[0] / l, s[1] / l, s[2] / l); })();
const ATRIB = [['aPos', 4, Float32Array, false], ['aCad', 4, Float32Array, false], ['aCamisa', 4, Uint8Array, true], ['aPele', 4, Uint8Array, true], ['aCabelo', 4, Uint8Array, true], ['aInfo', 4, Uint8Array, true]];

/**
 * Cria os torcedores 3D. opc = {grupo (THREE.Group do estádio), grade (a das cadeiras), torcida (render/torcida.js: dados,
 * uniforms, ocultar), qualidade, hora}. O modelo é baixado na 1ª qualidade que o desenha (não na Baixa). Devolve
 * {desejo(lista, cam, anteriores), aplicarEscolha(escolha), definirQualidade(q), definirHora(h), carregado, torcedores,
 * blocos, triangulos, desenhados, tri, lods, malhas, modelo, vat, dispose()} — quem decide quantos é o orçamento do quadro
 * (render/cadeiras3d.js com render/cadeiras-dados.js orcamentoPerto).
 */
export function criarTorcedores3D(opc) {
  const { grade, torcida } = opc;
  const U = torcida.uniforms;
  let qualidade = opc.qualidade ?? 'media', hora = opc.hora ?? 'dia';
  let modelo = null, vat = null, tex = null, malhas = null, carga = null, falhou = false;
  let chave = '', nTor = 0, nTri = 0, nBlocos = 0, lods = [0, 0], precarga = 0, nPerto = 0, nPessoas = 0;
  const porBloco = new Map();
  let hash = null;
  const calca = TORCEDOR3D.calca.map(c => new THREE.Color(c));
  const sapato = TORCEDOR3D.sapato.map(c => new THREE.Color(c));
  const uSol = { value: SOL.clone() }, uNoite = { value: hora === 'noite' ? 1 : 0 };
  const tri = () => (malhas ? [0, 1].map(l => Math.max(...malhas.map(pv => pv[l].userData.tri))) : [Infinity, Infinity]);
  const qIdx = () => Math.max(0, ['baixa', 'media', 'alta'].indexOf(qualidade));
  const opcQ = () => TORCEDOR3D.qual[qualidade] ?? TORCEDOR3D.qual.media;

  function baixar() {
    if (carga || falhou || !(opcQ().teto > 0)) return;
    const url = new URL('../../' + TORCEDOR3D.arquivo, import.meta.url);
    carga = fetch(url).then(r => { if (!r.ok) throw new Error('torcedor.bin ' + r.status); return r.arrayBuffer(); })
      .then(buf => { if (malhas === null && !descartado) montar(lerModelo(buf)); })
      .catch(() => { falhou = true; });
  }
  let descartado = false;
  /** As malhas (uma por variação e nível) com a VAT: o modelo chegou. */
  function montar(m) {
    modelo = m;
    vat = vatDados(m);
    tex = new THREE.DataTexture(vat.dados, vat.largura, vat.altura, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    const teto = TORCEDOR3D.qual.alta.teto;
    malhas = m.malhas.map((pv, v) => pv.map((mm, l) => {
      const cap = Math.ceil(teto / mm.nTri) + 32;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setIndex(new THREE.BufferAttribute(mm.indice, 1));
      geo.setAttribute('position', new THREE.BufferAttribute(mm.pos.slice(0, 3 * mm.nV), 3));
      geo.setAttribute('aReg', new THREE.BufferAttribute(Float32Array.from(mm.regiao), 1));
      for (const [nome, k, Tipo, normal] of ATRIB) {
        const at = new THREE.InstancedBufferAttribute(new Tipo(cap * k), k, normal);
        at.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute(nome, at);
      }
      geo.instanceCount = 0;
      const uni = {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTempo: U.uTempo, uTempoOrg: U.uTempoOrg, uAnimada: U.uAnimada, uExcita: U.uExcita, uTensao: U.uTensao,
        uLamento: U.uLamento, uPalmas: U.uPalmas, uOla: U.uOla, uBandA: U.uBandA, uBandU: U.uBandU, uBandV: U.uBandV,
        uAbre: U.uAbre, uAcento0: U.uAcento0, uAcento1: U.uAcento1,
        uFlare: UNIFORMS_LUZ.uFlare, uFlareN: UNIFORMS_LUZ.uFlareN,
        uVat: { value: tex }, uLinha: { value: vat.linha(v, l) },
        uCalca: { value: calca }, uSapato: { value: sapato }, uSol, uNoite,
      };
      const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, fog: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `torcedor3d-${v ? 'mulher' : 'homem'}-${l}`;
      mesh.frustumCulled = false;      // a escolha já é pelo cone da câmera (os blocos fora dele não entram)
      mesh.visible = false;
      mesh.userData = { cap, k: 0, tri: mm.nTri, v, l };
      opc.grupo.add(mesh);
      return mesh;
    }));
    chave = '';
  }

  // ---------------------------------------------------------------- quem senta em cada bloco
  /** A torcida inteira num mapa por célula de 0,5 m (x, z): para achar o torcedor de cada cadeira. */
  const celula = (x, z) => (Math.floor(x * 2) + 4096) * 8192 + (Math.floor(z * 2) + 4096);
  function montarHash() {
    const d = torcida.dados;
    hash = new Map();
    for (let i = 0; i < d.n; i++) {
      const k = celula(d.pos[4 * i], d.pos[4 * i + 2]);
      const l = hash.get(k);
      if (l) l.push(i); else hash.set(k, [i]);
    }
  }
  /** O torcedor sentado na cadeira c (o lugar dele é a cadeira, com ± 6 cm de sorteio em x), ou −1. */
  function torcedorDa(c) {
    const d = torcida.dados;
    let melhor = -1, dm = Infinity;
    for (const dx of [-0.07, 0, 0.07]) for (const dz of [-0.02, 0.02]) {
      const l = hash.get(celula(c.x + dx, c.z + dz));
      if (!l) continue;
      for (const i of l) {
        const ex = Math.abs(d.pos[4 * i] - c.x), ez = Math.abs(d.pos[4 * i + 2] - c.z), ey = Math.abs(d.pos[4 * i + 1] - c.y);
        if (ex <= 0.07 && ez <= 0.02 && ey <= 0.02 && ex + ez < dm) { dm = ex + ez; melhor = i; }
      }
    }
    return melhor;
  }
  /**
   * As PESSOAS do bloco i com a densidade real (item 69, PR 3: render/impostor-dados.js preencherBloco — 1 por cadeira
   * ocupada: os desenhados, os da torcida de nível acima e gente nova perto deles) e as fileiras delas: {P (as pessoas:
   * origem, pos, camisa, pele, cabelo, info), rumo: Int8Array (cos e sen da cadeira × 127), linhas: [{chave
   * ('bloco:fileira'), ent: Int32Array (as pessoas da fileira), cad: Float32Array (x, z, cos e sen do rumo de cada
   * cadeira), c: [x, y, z] (o meio da fileira)}]}. Por qualidade (os desenhados mudam com ela).
   */
  function doBloco(i) {
    const q = qIdx(), ch = i + ':' + q;
    let b = porBloco.get(ch);
    if (b) return b;
    if (!hash) montarHash();
    const as = grade.assentosDoBloco(i);
    const ocup = new Int32Array(as.length);
    for (let j = 0; j < as.length; j++) ocup[j] = torcedorDa(as[j]);
    const cx = grade.blocos[i].caixa;
    const P = preencherBloco(as, ocup, torcida.dados, q, cx ? cx.eixo : [1, 0]);
    const rumo = new Int8Array(2 * P.n), por = new Map();
    for (let e = 0; e < P.n; e++) {
      const c = as[P.assento[e]], cr = Math.cos(c.rumo), sr = Math.sin(c.rumo);
      rumo[2 * e] = Math.round(cr * 127); rumo[2 * e + 1] = Math.round(sr * 127);
      let f = por.get(c.f);
      if (!f) por.set(c.f, f = { ent: [], cad: [], sx: 0, sy: 0, sz: 0 });
      f.ent.push(e); f.cad.push(c.x, c.z, cr, sr);
      f.sx += c.x; f.sy += c.y; f.sz += c.z;
    }
    const linhas = [...por].map(([fi, f]) => ({ chave: i + ':' + fi, ent: Int32Array.from(f.ent), cad: Float32Array.from(f.cad), c: [f.sx / f.ent.length, f.sy / f.ent.length + 0.8, f.sz / f.ent.length] }));
    b = { P, rumo, linhas };
    porBloco.set(ch, b);
    return b;
  }
  const quantos = f => f.ent.length;

  /**
   * Escreve as instâncias das fileiras escolhidas (Map chave → nível) e a DENSIDADE REAL dos blocos das cadeiras 3D
   * (`blocos`): as fileiras em 3D viram o corpo 3D; as outras, a malha perto da torcida (o impostor ou o quadro, na escala
   * de verdade); os desenhados desses blocos saem do quadro (aOculto).
   */
  function aplicar(escolha, blocos) {
    const ocultos = [];
    for (const pv of malhas) for (const m of pv) m.userData.k = 0;
    nTor = 0; nTri = 0; lods = [0, 0];
    const comTor = new Set();
    // a malha perto: quantos lugares (as pessoas das fileiras sem 3D)
    let nx = 0;
    const Bs = [...blocos].map(i => doBloco(i));
    for (const B of Bs) for (const L of B.linhas) if (!escolha.has(L.chave)) nx += L.ent.length;
    const X = { n: 0, pos: new Float32Array(4 * nx), camisa: new Uint8Array(4 * nx), pele: new Uint8Array(4 * nx), cabelo: new Uint8Array(4 * nx), info: new Uint8Array(4 * nx), rumo: new Int8Array(2 * nx) };
    const [e0, e1] = IMPOSTOR.perto.escala;
    for (const B of Bs) {
      const P = B.P;
      for (let e = 0; e < P.n; e++) if (P.origem[e] >= 0) ocultos.push(P.origem[e]);
      for (const L of B.linhas) {
        const l = escolha.get(L.chave);
        for (let j = 0; j < L.ent.length; j++) {
          const e = L.ent[j];
          if (l === undefined) {
            const k = X.n++;
            X.pos.set(P.pos.subarray(4 * e, 4 * e + 4), 4 * k);
            X.pos[4 * k + 3] = Math.min(e1, Math.max(e0, X.pos[4 * k + 3]));
            X.camisa.set(P.camisa.subarray(4 * e, 4 * e + 4), 4 * k); X.pele.set(P.pele.subarray(4 * e, 4 * e + 4), 4 * k);
            X.cabelo.set(P.cabelo.subarray(4 * e, 4 * e + 4), 4 * k); X.info.set(P.info.subarray(4 * e, 4 * e + 4), 4 * k);
            X.rumo.set(B.rumo.subarray(2 * e, 2 * e + 2), 2 * k);
            continue;
          }
          const v = variacaoDe(P.pele[4 * e + 3] / 255, P.info[4 * e + 3] / 255);
          const m = malhas[Math.min(v, malhas.length - 1)][l], k = m.userData.k;
          if (k >= m.userData.cap) continue;
          const A = m.geometry.attributes;
          A.aPos.array.set(P.pos.subarray(4 * e, 4 * e + 4), 4 * k);
          A.aCad.array.set(L.cad.subarray(4 * j, 4 * j + 4), 4 * k);
          A.aCamisa.array.set(P.camisa.subarray(4 * e, 4 * e + 4), 4 * k);
          A.aPele.array.set(P.pele.subarray(4 * e, 4 * e + 4), 4 * k);
          A.aCabelo.array.set(P.cabelo.subarray(4 * e, 4 * e + 4), 4 * k);
          A.aInfo.array.set(P.info.subarray(4 * e, 4 * e + 4), 4 * k);
          m.userData.k = k + 1;
          comTor.add(L.chave.split(':')[0]);
          nTor++; nTri += m.userData.tri; lods[l]++;
        }
      }
    }
    for (const pv of malhas) for (const m of pv) {
      const A = m.geometry.attributes, k = m.userData.k;
      for (const [nome] of ATRIB) { A[nome].clearUpdateRanges?.(); A[nome].addUpdateRange?.(0, k * A[nome].itemSize); A[nome].needsUpdate = true; }
      m.geometry.instanceCount = k;
    }
    nBlocos = comTor.size; nPerto = X.n; nPessoas = nTor + X.n;
    torcida.ocultar(ocultos);
    torcida.definirPerto?.(X.n ? X : null);
  }
  const comTorcida = () => (torcida.mesh ? torcida.mesh.visible !== false : true);

  return {
    get carregado() { return !!malhas; },
    get torcedores() { return nTor; },
    get triangulos() { return nTri; },
    get blocos() { return nBlocos; },
    /** As pessoas da densidade real fora do 3D (a malha perto da torcida) e todas (3D + perto) neste quadro. */
    get perto() { return nPerto; },
    get pessoas() { return nPessoas; },
    /** Os triângulos da malha perto que vão ser desenhados (2 por pessoa; nada com a torcida escondida). */
    get trianguloPerto() { return comTorcida() ? 2 * nPerto : 0; },
    /** As pessoas de um bloco com a densidade real (testes: render/impostor-dados.js preencherBloco). */
    pessoasDoBloco(i) { return doBloco(i); },
    get lods() { return lods.slice(); },
    get malhas() { return malhas ? malhas.flat() : []; },
    get modelo() { return modelo; },
    get vat() { return vat; },
    /** Pede o modelo (fora da Baixa), se ainda não veio: a cada quadro, também na TV (chega antes do 1º plano de perto). */
    preparar() { if (!malhas) baixar(); },
    /** Desenha alguém agora? (o modelo chegou, a qualidade tem torcedor 3D e a torcida está no desenho) */
    get pronto() { return !!malhas && opcQ().teto > 0 && comTorcida(); },
    /** Os triângulos de um torcedor em cada nível (o maior das variações): [nível 0, nível 1]. */
    get tri() { return tri(); },
    /** Os triângulos que as malhas visíveis desenham agora (o gasto do torcedor 3D neste quadro). */
    get desenhados() { let s = 0; if (malhas) for (const pv of malhas) for (const m of pv) if (m.visible) s += m.geometry.instanceCount * m.userData.tri; return s; },
    /**
     * O que o torcedor 3D QUER neste quadro: as fileiras dos blocos de cadeira 3D candidatos (`lista`, de escolherBlocos) com
     * a câmera dele (cam = {x, y, z, fov, alturaPx}), pelos px da cadeira no meio de cada uma, no teto da qualidade e com a
     * histerese contra `anteriores` (Map chave → nível do que está desenhado; vazio no corte) — escolherTorcedores. Devolve
     * {fileiras: [{chave, bloco, px, n, nivel}], tri}. Sem o modelo (pede o download), na Baixa e com a torcida escondida, nada.
     */
    desejo(lista, cam, anteriores = new Map()) {
      if (!malhas) { baixar(); return { fileiras: [], tri: [0, 0] }; }
      const O = opcQ(), unidades = [];
      if (O.teto > 0 && comTorcida()) {
        for (const i of lista) for (const f of doBloco(i).linhas) {
          const d = Math.hypot(f.c[0] - cam.x, f.c[1] - cam.y, f.c[2] - cam.z);
          unidades.push({ chave: f.chave, bloco: i, px: pxCadeira(d, cam), n: quantos(f) });
        }
      }
      const t = tri();
      const r = escolherTorcedores(unidades, anteriores, { ...O, tri: t });
      const fileiras = [];
      for (const u of unidades) { const l = r.escolha.get(u.chave); if (l !== undefined) fileiras.push({ ...u, nivel: l }); }
      return { fileiras, tri: t };
    },
    /**
     * Desenha as fileiras escolhidas (Map chave → nível: o plano do orçamento, render/cadeiras-dados.js orcamentoPerto) e
     * a densidade real dos blocos das cadeiras 3D do plano (`blocos`: Set; as fileiras sem 3D na malha perto da torcida) —
     * as instâncias só mudam quando a escolha muda — e a pré-carga das malhas.
     */
    aplicarEscolha(escolha, blocos = new Set()) {
      if (!malhas) return;
      const k = qualidade + '|' + [...blocos].sort((a, b) => a - b).join(',') + '|' + [...escolha].map(([c, l]) => c + '=' + l).sort().join(',');
      if (k !== chave) { chave = k; aplicar(escolha, blocos); }
      // pré-carga: nos 4 primeiros quadros depois de chegar, uma malha por quadro vai para a GPU com 0 instâncias (o
      // programa — o mesmo nas 4 — compila no 1º e a geometria de cada uma sobe antes do 1º plano de perto: 1 chamada a
      // mais por quadro, nunca 4 de uma vez); depois, só as que têm alguém. No desenho só junto com a torcida (os testes
      // escondem a torcida inteira: torcida.mesh.visible)
      const vis = comTorcida();
      const todas = malhas.flat(), pre = precarga < todas.length ? todas[precarga] : null;
      for (const m of todas) m.visible = vis && (m === pre || m.userData.k > 0);
      if (pre && vis) precarga++;
    },
    definirQualidade(q) { if (TORCEDOR3D.qual[q]) { qualidade = q; chave = ''; baixar(); } },
    definirHora(h) { hora = h; uNoite.value = h === 'noite' ? 1 : 0; },
    dispose() {
      descartado = true;
      if (malhas) for (const pv of malhas) for (const m of pv) { opc.grupo.remove(m); m.geometry.dispose(); m.material.dispose(); }
      tex?.dispose();
      torcida.ocultar([]);
      torcida.definirPerto?.(null);
    },
  };
}
