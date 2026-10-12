// Corpo humano dos jogadores (Etapa 5.1, atrás de ?corpo=novo; o padrão continua o manequim de render/jogador3d.js).
// MESMA interface do manequim: atualizar(lista, camera), definirSombras, definirTela, medida, tipo.
//
// Desenho (PESQUISA-ETAPA5.md §3):
//  - Um corpo humano inteiro (MakeHuman CC0, assets/jogador/corpo.bin) com 22 ossos, vestindo a pose de 19 juntas que
//    a animação pura já calcula (render/esqueleto.js: retarget por direção + ajuste final de pés e mãos).
//  - PELE NA PLACA DE VÍDEO, os ossos de TODOS os jogadores numa textura só (RGBA32F; uma linha por jogador: 22 ossos ×
//    3 texels com a matriz 3×4 + 1 texel com o tom de pele e o uniforme), lida no vertex shader pelo número do
//    jogador (atributo por instância). É a conta do SkinnedMesh do three.js (skinning_vertex), só que com todos os
//    corpos numa chamada (GPU Gems 3, cap. 2, "Animated Crowd Rendering"): o teste-pele confere pixel a pixel.
//  - 3 níveis de detalhe que dividem os vértices (meshoptimizer): uma malha por nível, cada jogador no nível pela
//    altura na tela, com um teto de triângulos por qualidade (Baixa 25 mil, Média 50 mil, Alta 120 mil: os menores na
//    tela perdem detalhe primeiro). A SOMBRA usa sempre o nível leve (onBeforeShadow troca a faixa do índice).
//  - Uniforme provisório pintado por região (as cores de hoje, KITS), decidido por pixel pela posição de REPOUSO do
//    vértice (a região não "escorrega" com a pele); o goleiro com manga comprida e luva; olhos.
//  - Cabelo = a calota de hoje, presa no osso da cabeça; mancha de contato e indicadores iguais aos do manequim.
// Chamadas: até 3 corpos (1 por nível em uso; na câmera de TV, 1 ou 2) + cabelo + mancha (+ indicadores); sombra: 1 por
// nível em uso, todos no leve. Nada é alocado por quadro.
import * as THREE from 'three';
import { J } from '../anim.js';
import { criarEsqueleto, inversoRepouso, NO, O, FLOATS_POR_JOGADOR } from './esqueleto.js';
import { KITS, PELES, CABELOS, sorteio, criarIndicadores, criarMedida, triInstancias } from './jogador3d.js';
import { texMancha } from './texturas.js';

const NOMES_KIT = Object.keys(KITS);
const CORES_KIT = ['camisa', 'calcao', 'meiao', 'chuteira', 'acento', 'sola', 'luva'];
const LARG = FLOATS_POR_JOGADOR / 4;           // texels por linha (30 ossos × 3 + 1 = 91)
// altura na tela (px físicos) para subir de nível e teto de triângulos por qualidade
const LOD_QUALIDADE = {
  baixa: { perto: Infinity, medio: 150, teto: 25000 },
  media: { perto: 260, medio: 95, teto: 50000 },
  alta: { perto: 200, medio: 70, teto: 120000 },
};
const HIST = 0.15;                              // histerese da troca de nível
// quem está fora da câmera (com folga para a sombra: sol a ≥ 48° de dia, o goleiro de braços para cima faz ~2,3 m de
// sombra) não calcula o esqueleto nem entra no desenho: esfera de 3,5 m em volta da pelve contra o tronco de visão
const FOLGA_VISTA = 3.5;

const DECL_V = `
uniform highp sampler2D uOssos;
uniform vec4 uInv[${NO * 3}];
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute float iJog;
mat4 ossoCorpo(const in float i, const in int y) {
  int x = int(i + 0.5) * 3;
  vec4 a = texelFetch(uOssos, ivec2(x, y), 0);
  vec4 b = texelFetch(uOssos, ivec2(x + 1, y), 0);
  vec4 c = texelFetch(uOssos, ivec2(x + 2, y), 0);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0);
}
mat4 invCorpo(const in float i) {
  int x = int(i + 0.5) * 3;
  vec4 a = uInv[x], b = uInv[x + 1], c = uInv[x + 2];
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0);
}
`;
// a textura guarda o QUADRO de cada osso (com a escala); o inverso do repouso é constante (uniforme): pele = quadro ×
// inverso, aplicada ao vértice em dois passos (o inverso primeiro)
const BASE_V = `
  int yJog = int(iJog + 0.5);
  mat4 boneMatX = ossoCorpo(skinIndex.x, yJog);
  mat4 boneMatY = ossoCorpo(skinIndex.y, yJog);
  mat4 boneMatZ = ossoCorpo(skinIndex.z, yJog);
  mat4 boneMatW = ossoCorpo(skinIndex.w, yJog);
  mat4 invX = invCorpo(skinIndex.x);
  mat4 invY = invCorpo(skinIndex.y);
  mat4 invZ = invCorpo(skinIndex.z);
  mat4 invW = invCorpo(skinIndex.w);
`;
const NORMAL_V = `
  {
    vec4 n0 = vec4(objectNormal, 0.0);
    objectNormal = (skinWeight.x * (boneMatX * (invX * n0)) + skinWeight.y * (boneMatY * (invY * n0)) + skinWeight.z * (boneMatZ * (invZ * n0)) + skinWeight.w * (boneMatW * (invW * n0))).xyz;
  }
`;
const PELE_V = `
  {
    vec4 v0 = vec4(transformed, 1.0);
    transformed = (skinWeight.x * (boneMatX * (invX * v0)) + skinWeight.y * (boneMatY * (invY * v0)) + skinWeight.z * (boneMatZ * (invZ * v0)) + skinWeight.w * (boneMatW * (invW * v0))).xyz;
  }
`;

/**
 * Injeta a pele instanciada (textura de ossos) num material do three.js (posição e normal; a normal só conta nos
 * materiais que a usam). cor = também pinta o uniforme por região (uni = os uniformes das cores). Exportada para o
 * teste-pele, que veste outros materiais (normal, profundidade) com a mesma conta.
 */
export function injetarPele(mat, tex, cor, uni) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uOssos = { value: tex.valor };
    sh.uniforms.uInv = tex.inv;
    tex.uniformes.push(sh.uniforms.uOssos);
    if (cor) Object.assign(sh.uniforms, uni);
    let v = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + DECL_V + (cor ? 'varying vec3 vRest;\nvarying vec4 vDados;\n' : ''))
      .replace('#include <skinbase_vertex>', BASE_V + (cor ? 'vRest = position;\nvDados = texelFetch(uOssos, ivec2(' + (LARG - 1) + ', yJog), 0);\n' : ''))
      .replace('#include <skinning_vertex>', PELE_V)
      .replace('#include <skinnormal_vertex>', NORMAL_V);
    sh.vertexShader = v;
    if (cor) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + DECL_F)
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = corCorpo(vRest, vDados);');
    }
  };
  mat.customProgramCacheKey = () => (cor ? 'corpo-pele-cor-v3' : 'corpo-pele-v3');
}

// Regiões do uniforme pela posição de repouso (pose A do modelo, lado esquerdo em +x; o direito é o espelho):
// braço (pela distância ao eixo do braço/antebraço) → manga, punho, pele/luva; o resto pela altura: sola, chuteira,
// meião (com a faixa), joelho, calção, camisa (gola mais baixa na frente) e pele (pescoço e cabeça); olhos.
export const DECL_F = `
varying vec3 vRest;
varying vec4 vDados;
uniform vec3 uKit[40];
uniform vec4 uReg0;    // sola, chuteira, topo do meião, largura da faixa do meião
uniform vec4 uReg1;    // barra do calção, cintura, gola (atrás), quanto a gola desce na frente
uniform vec2 uPesc;    // centro do pescoço em z, raio da gola
uniform vec3 uOmbro;
uniform vec3 uCotovelo;
uniform vec3 uMao;
uniform vec4 uManga;   // manga curta, punho, (livre), (livre)
uniform vec4 uOlho;    // centro do olho esquerdo + raio
vec3 corCorpo(vec3 p, vec4 d) {
  float k = mod(d.a, 8.0);
  int b = int(k + 0.5) * 8;
  float gol = step(7.5, d.a);
  vec3 q = vec3(abs(p.x), p.y, p.z);
  vec3 dO = q - uOlho.xyz;
  float lo = length(dO);
  if (lo < uOlho.w * 1.04) {
    float fr = dO.z / max(lo, 1e-4);
    return fr > 0.86 ? vec3(0.025, 0.018, 0.014) : fr > 0.72 ? vec3(0.16, 0.10, 0.06) : vec3(0.72, 0.69, 0.64);
  }
  vec3 aB = uCotovelo - uOmbro; float LB = length(aB); aB /= LB;
  vec3 aA = uMao - uCotovelo; float LA = length(aA); aA /= LA;
  vec3 rB = q - uOmbro; float tB = dot(rB, aB); float dB = length(rB - aB * tB);
  vec3 rA = q - uCotovelo; float tA = dot(rA, aA); float dA = length(rA - aA * tA);
  bool ante = tA > -0.02 && tA < LA + 0.26 && dA < 0.075;
  bool braco = tB > 0.0 && tB < LB + 0.03 && dB < 0.09;
  if (ante || braco) {
    float s = ante ? LB + tA : tB;
    float fim = mix(uManga.x, LB + LA - 0.035, gol);
    if (s < fim) return uKit[b];
    if (s < fim + uManga.y) return uKit[b + 4];
    return gol > 0.5 ? uKit[b + 6] : d.rgb;
  }
  if (p.y < uReg0.x) return uKit[b + 5];
  if (p.y < uReg0.y) return uKit[b + 3];
  if (p.y < uReg0.z - uReg0.w) return uKit[b + 2];
  if (p.y < uReg0.z) return uKit[b + 4];
  if (p.y < uReg1.x) return d.rgb;
  if (p.y < uReg1.y) return uKit[b + 1];
  // pescoço e cabeça: acima da gola (mais baixa na frente) e dentro do raio dela; a gola é um anel em volta
  float rN = length(vec2(q.x, q.z - uPesc.x));
  float gola = uReg1.z - uReg1.w * smoothstep(0.0, 0.07, q.z - uPesc.x);
  if (p.y > gola && (rN < uPesc.y || p.y > gola + 0.06)) return d.rgb;
  if (p.y > gola - 0.016 && rN < uPesc.y + 0.016) return uKit[b + 4];
  return uKit[b];
}
`;

const _pv = new THREE.Matrix4(), _vista = new THREE.Frustum(), _esf = new THREE.Sphere(new THREE.Vector3(), FOLGA_VISTA);

/**
 * corpo = o resultado de lerCorpo (render/corpo-leitor.js). Devolve a mesma interface de criarJogadores3D.
 */
export function criarCorpos3D(cena, qualidade, corpo) {
  const cab = corpo.cab;
  const esq = criarEsqueleto(cab.bind);
  const alta = qualidade === 'alta';
  let LQ = LOD_QUALIDADE[qualidade] ?? LOD_QUALIDADE.media;
  const NL = cab.lods.length;
  const LEVE = NL - 1;
  const TRI = cab.lods.map(l => l.tri);

  // atributos do corpo (divididos pelos níveis de detalhe)
  const aPos = new THREE.BufferAttribute(corpo.pos, 3);
  const aNrm = new THREE.BufferAttribute(corpo.nrm, 3);
  const aOss = new THREE.Uint8BufferAttribute(corpo.ossos, 4);
  const aPes = new THREE.BufferAttribute(corpo.pesos, 4);
  const indice = new THREE.BufferAttribute(corpo.idx, 1);

  // uniformes das cores (uniformes dos KITS em cor linear, como no manequim) e das regiões
  const kitCores = [];
  for (let k = 0; k < 5; k++) {
    const kit = KITS[NOMES_KIT[k]] ?? KITS.linha0;
    for (let c = 0; c < 8; c++) kitCores.push(new THREE.Color(kit[CORES_KIT[c]] ?? kit.camisa));
  }
  const R = cab.regioes;
  const uni = {
    uKit: { value: kitCores },
    uReg0: { value: new THREE.Vector4(R.sola, R.chuteira, R.meiao, R.faixaMeiao) },
    uReg1: { value: new THREE.Vector4(R.calcao, R.cintura, R.gola, R.golaFrente) },
    uPesc: { value: new THREE.Vector2(R.pescocoZ, R.golaRaio) },
    uOmbro: { value: new THREE.Vector3(...R.ombro) },
    uCotovelo: { value: new THREE.Vector3(...R.cotovelo) },
    uMao: { value: new THREE.Vector3(...R.mao) },
    uManga: { value: new THREE.Vector4(R.manga, R.punho, 0, 0) },
    uOlho: { value: new THREE.Vector4(...cab.olhos[0].c, cab.olhos[0].r) },
  };
  // inverso dos quadros de repouso (constante; a placa multiplica pelo quadro de cada osso)
  const INV = inversoRepouso(esq.quadrosRepouso);
  const tex = { valor: null, uniformes: [], inv: { value: INV } };
  const matCorpo = new THREE.MeshStandardMaterial({ roughness: 0.74, metalness: 0 });
  injetarPele(matCorpo, tex, true, uni);
  const matSombra = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  injetarPele(matSombra, tex, false, null);
  const matCabelo = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const matMancha = new THREE.MeshBasicMaterial({
    map: texMancha(), color: 0x000000, transparent: true, depthWrite: false, opacity: 0.5,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
  const geoCabelo = new THREE.SphereGeometry(1, alta ? 20 : 12, alta ? 8 : 5, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const gm = new THREE.PlaneGeometry(1, 1);
  gm.rotateX(-Math.PI / 2);
  // a calota no repouso: centro e raios do arquivo, inclinada para trás (a testa fica de fora)
  const C0 = cab.cabelo;
  const _q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.32);
  const capRepouso = new THREE.Matrix4().compose(new THREE.Vector3(...C0.centro), _q, new THREE.Vector3(...C0.raios));
  // a mesma calota por linhas (3 × [m0, m1, m2, t]): a conta do quadro é escrita direto no buffer das instâncias
  // (com o inverso do repouso da cabeça já multiplicado: na textura vai o quadro da cabeça, não a pele)
  const CAP = new Float64Array(12);
  {
    const ih = O.cabeca * 12, e = capRepouso.elements;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      let v = INV[ih + r * 4] * e[c * 4] + INV[ih + r * 4 + 1] * e[c * 4 + 1] + INV[ih + r * 4 + 2] * e[c * 4 + 2];
      if (c === 3) v += INV[ih + r * 4 + 3];
      CAP[r * 4 + c] = v;
    }
  }
  const medida = criarMedida();
  let sombras = true;
  let alturaTela = 720;

  let cap = 0, dados = null, textura = null, malhas = [], iJogs = [], cabelos = null, manchas = null;
  function montar(n) {
    if (textura) {
      for (const m of [...malhas, cabelos, manchas]) { cena.remove(m); if (m.isInstancedMesh) m.dispose(); }
      for (const m of malhas) m.geometry.dispose();
      textura.dispose();
    }
    cap = n;
    dados = new Float32Array(LARG * 4 * cap);
    textura = new THREE.DataTexture(dados, LARG, cap, THREE.RGBAFormat, THREE.FloatType);
    textura.minFilter = textura.magFilter = THREE.NearestFilter;
    textura.generateMipmaps = false;
    textura.needsUpdate = true;
    tex.valor = textura;
    for (const u of tex.uniformes) u.value = textura;
    malhas = []; iJogs = [];
    for (let k = 0; k < NL; k++) {
      const g = new THREE.InstancedBufferGeometry();
      g.setIndex(indice);
      g.setAttribute('position', aPos); g.setAttribute('normal', aNrm);
      g.setAttribute('skinIndex', aOss); g.setAttribute('skinWeight', aPes);
      const ij = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
      ij.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('iJog', ij);
      g.setDrawRange(cab.lods[k].ini, cab.lods[k].n);
      g.instanceCount = 0;
      const m = new THREE.Mesh(g, matCorpo);
      m.customDepthMaterial = matSombra;
      m.frustumCulled = false;
      m.castShadow = sombras;
      m.visible = false;
      m.name = 'jogadores-corpo-' + ['perto', 'medio', 'longe'][k];
      // sombra sempre no nível leve
      m.onBeforeShadow = () => g.setDrawRange(cab.lods[LEVE].ini, cab.lods[LEVE].n);
      m.onAfterShadow = () => g.setDrawRange(cab.lods[k].ini, cab.lods[k].n);
      medida.ligar(m, triInstancias);
      cena.add(m);
      malhas.push(m); iJogs.push(ij);
    }
    cabelos = new THREE.InstancedMesh(geoCabelo, matCabelo, cap);
    cabelos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cabelos.frustumCulled = false; cabelos.count = 0; cabelos.name = 'jogadores-cabelos';
    cabelos.castShadow = false;
    manchas = new THREE.InstancedMesh(gm, matMancha, cap);
    manchas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    manchas.frustumCulled = false; manchas.count = 0; manchas.renderOrder = 3; manchas.name = 'jogadores-manchas';
    medida.ligar(cabelos, triInstancias); medida.ligar(manchas, triInstancias);
    cena.add(cabelos, manchas);
    vagaDe.fill(-1);
    nivel.fill(LEVE);
  }
  const indicadores = criarIndicadores(cena);
  const IDX_KIT = Object.fromEntries(NOMES_KIT.map((k, i) => [k, i]));
  const PADRAO_KIT = [[IDX_KIT.linha0, IDX_KIT.goleiro0], [IDX_KIT.linha1, IDX_KIT.goleiro1]];
  const kitIdx = jg => IDX_KIT[jg.kit] ?? PADRAO_KIT[jg.time === 1 ? 1 : 0][jg.goleiro ? 1 : 0];
  const pelesLin = PELES.map(h => new THREE.Color(h));
  const cabelosLin = CABELOS.map(h => new THREE.Color(h));
  let vagaDe = new Float64Array(0), nivel = new Int8Array(0), alturaPx = new Float32Array(0), ordem = new Int32Array(0), vis = new Uint8Array(0);
  const contagem = new Int32Array(NL);
  function garantir(n) {
    if (n <= cap) return;
    const c = Math.max(n, Math.ceil(n * 1.25), 24);
    vagaDe = new Float64Array(c); nivel = new Int8Array(c); alturaPx = new Float32Array(c); ordem = new Int32Array(c); vis = new Uint8Array(c);
    montar(c);
  }
  garantir(24);

  function escreverDados(vaga, jg) {
    const pele = pelesLin[Math.floor(sorteio(jg.id, 1) * pelesLin.length)];
    const o = vaga * LARG * 4 + (LARG - 1) * 4;
    dados[o] = pele.r; dados[o + 1] = pele.g; dados[o + 2] = pele.b; dados[o + 3] = kitIdx(jg) + (jg.goleiro ? 8 : 0);
    cabelos.setColorAt(vaga, cabelosLin[Math.floor(sorteio(jg.id, 2) * cabelosLin.length)]);
    if (cabelos.instanceColor) cabelos.instanceColor.needsUpdate = true;
  }

  /** Nível de detalhe de cada jogador: pela altura na tela, com histerese, e o teto de triângulos da qualidade. */
  function escolherNiveis(lista, n, camera) {
    const f = camera ? alturaTela / (2 * Math.tan((camera.fov * Math.PI) / 360)) : 0;
    let total = 0, nv = 0;
    for (let p = 0; p < n; p++) {
      if (!vis[p]) continue;
      let h = 0;
      if (camera) {
        const pose = lista[p].pose, ip = J.pelve * 3;
        const dx = pose[ip] - camera.position.x, dy = pose[ip + 1] - camera.position.y, dz = pose[ip + 2] - camera.position.z;
        h = (1.8 * f) / Math.max(0.3, Math.sqrt(dx * dx + dy * dy + dz * dz));
      }
      alturaPx[p] = h;
      const ant = nivel[p];
      // sobe só passando o limite + histerese; desce só abaixo do limite − histerese
      const limPerto = ant <= 0 ? LQ.perto * (1 - HIST) : LQ.perto * (1 + HIST);
      const limMedio = ant <= 1 ? LQ.medio * (1 - HIST) : LQ.medio * (1 + HIST);
      let k = h >= limPerto ? 0 : h >= limMedio ? 1 : 2;
      if (NL < 3) k = Math.min(k, NL - 1);
      nivel[p] = k;
      total += TRI[k];
      ordem[nv++] = p;
    }
    // teto: os menores na tela perdem um nível de cada vez
    if (total > LQ.teto) {
      // ordem por altura na tela (inserção: ~25 itens, nada alocado)
      for (let i = 1; i < nv; i++) {
        const p = ordem[i], h = alturaPx[p];
        let k = i - 1;
        while (k >= 0 && alturaPx[ordem[k]] > h) { ordem[k + 1] = ordem[k]; k--; }
        ordem[k + 1] = p;
      }
      let mudou = true;
      while (total > LQ.teto && mudou) {
        mudou = false;
        for (let i = 0; i < nv && total > LQ.teto; i++) {
          const p = ordem[i];
          if (nivel[p] < LEVE) { total += TRI[nivel[p] + 1] - TRI[nivel[p]]; nivel[p]++; mudou = true; }
        }
      }
    }
  }

  const api = {
    tipo: 'corpo',
    get capacidade() { return cap; },
    get malhas() { return malhas; },
    get cabelos() { return cabelos; },
    get textura() { return textura; },
    get esqueleto() { return esq; },
    /** Para o teste-pele: os uniformes das cores (mesmos objetos do material), a textura de ossos e a faixa de cada nível. */
    get teste() { return { uni, tex, lods: cab.lods, LARG }; },
    /** Nível de detalhe (0 perto, 1 médio, 2 longe) de cada vaga no último quadro. */
    get niveis() { return nivel; },
    get medida() { return medida.ultimo; },
    /** Altura da tela em pixels físicos (o nível de detalhe sai da altura do jogador na tela). */
    definirTela(h) { if (h > 0) alturaTela = h; },
    /** Qualidade nova (troca automática): muda os limites de nível de detalhe e o teto de triângulos. */
    definirQualidade(q) { LQ = LOD_QUALIDADE[q] ?? LQ; },
    /**
     * lista: [{id, time, goleiro, kit?, pose (Float32Array já interpolada), controlado, proximo, x, z, rumo}];
     * camera: o nível de detalhe e o tamanho da seta do controlado.
     */
    atualizar(lista, camera) {
      const n = lista.length;
      garantir(n);
      let controlado = null, proximo = null;
      // quem aparece (ou faz sombra) nesta câmera
      if (camera) {
        camera.updateMatrixWorld();
        _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _vista.setFromProjectionMatrix(_pv);
      }
      for (let p = 0; p < n; p++) {
        if (!camera) { vis[p] = 1; continue; }
        const pose = lista[p].pose, ip = J.pelve * 3;
        _esf.center.set(pose[ip], pose[ip + 1], pose[ip + 2]);
        vis[p] = _vista.intersectsSphere(_esf) ? 1 : 0;
      }
      escolherNiveis(lista, n, camera);
      contagem.fill(0);
      const mc = cabelos.instanceMatrix.array, mm = manchas.instanceMatrix.array, F = esq.quadros;
      for (let p = 0; p < n; p++) {
        const jg = lista[p];
        const chave = ((jg.id * 8 + kitIdx(jg)) * 2 + (jg.time === 1 ? 1 : 0)) * 2 + (jg.goleiro ? 1 : 0);
        if (vagaDe[p] !== chave) { vagaDe[p] = chave; escreverDados(p, jg); }
        if (jg.controlado) controlado = jg;
        else if (jg.proximo) proximo = jg;
        const o16 = p * 16;
        if (!vis[p]) {
          // fora da câmera: nada de esqueleto; calota e mancha somem (escala 0)
          for (let i = 0; i < 16; i++) { mc[o16 + i] = 0; mm[o16 + i] = 0; }
          continue;
        }
        // os ossos desta vaga na linha p da textura
        const off = p * LARG * 4;
        esq.calcularQuadros(jg.pose, dados, off);
        const k = nivel[p];
        iJogs[k].array[contagem[k]++] = p;
        // calota do cabelo: o quadro da cabeça × (inverso do repouso × a calota no repouso), por colunas no buffer
        const c = off + O.cabeca * 12;
        for (let r = 0; r < 3; r++) {
          const a0 = dados[c + r * 4], a1 = dados[c + r * 4 + 1], a2 = dados[c + r * 4 + 2], a3 = dados[c + r * 4 + 3];
          mc[o16 + r] = a0 * CAP[0] + a1 * CAP[4] + a2 * CAP[8];
          mc[o16 + 4 + r] = a0 * CAP[1] + a1 * CAP[5] + a2 * CAP[9];
          mc[o16 + 8 + r] = a0 * CAP[2] + a1 * CAP[6] + a2 * CAP[10];
          mc[o16 + 12 + r] = a0 * CAP[3] + a1 * CAP[7] + a2 * CAP[11] + a3;
        }
        mc[o16 + 3] = 0; mc[o16 + 7] = 0; mc[o16 + 11] = 0; mc[o16 + 15] = 1;
        // mancha de contato no meio dos pés, girada com os quadris (o goleiro deitado leva a mancha junto): giro em y
        // pelo X da pelve no chão, escala (1,15; 1; 0,85)
        const lx = Math.sqrt(F[5] * F[5] + F[11] * F[11]);
        const cs = lx > 1e-9 ? F[5] / lx : 1, sn = lx > 1e-9 ? -F[11] / lx : 0;
        mm[o16] = cs * 1.15; mm[o16 + 1] = 0; mm[o16 + 2] = -sn * 1.15; mm[o16 + 3] = 0;
        mm[o16 + 4] = 0; mm[o16 + 5] = 1; mm[o16 + 6] = 0; mm[o16 + 7] = 0;
        mm[o16 + 8] = sn * 0.85; mm[o16 + 9] = 0; mm[o16 + 10] = cs * 0.85; mm[o16 + 11] = 0;
        mm[o16 + 12] = F[0]; mm[o16 + 13] = 0.016; mm[o16 + 14] = F[2]; mm[o16 + 15] = 1;
      }
      for (let k = 0; k < NL; k++) {
        const g = malhas[k].geometry;
        g.instanceCount = contagem[k];
        malhas[k].visible = contagem[k] > 0;
        if (contagem[k] > 0) { iJogs[k].needsUpdate = true; iJogs[k].clearUpdateRanges(); iJogs[k].addUpdateRange(0, contagem[k]); }
      }
      textura.needsUpdate = true;
      cabelos.count = manchas.count = n;
      cabelos.instanceMatrix.needsUpdate = true;
      manchas.instanceMatrix.needsUpdate = true;
      indicadores.atualizar(controlado, proximo, camera);
    },
    definirSombras(ligadas) {
      sombras = ligadas;
      for (const m of malhas) m.castShadow = ligadas;
      matMancha.opacity = ligadas ? 0.32 : 0.5;
    },
  };
  return api;
}
