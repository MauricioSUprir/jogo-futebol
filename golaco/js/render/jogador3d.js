// Manequim provisório (o modelo humano realista é a Etapa 5), desenhado a partir das juntas
// da animação pura (anim.js). Cada SEGMENTO vira uma cápsula afunilada entre as juntas A e B,
// e TODAS as cápsulas de TODOS os jogadores saem num único InstancedMesh (1 draw call + 1 na
// sombra): o afunilamento, o comprimento e o achatamento vêm de atributos por instância e são
// aplicados no vertex shader; as cores (camisa, pele, detalhes verdes) e os padrões (manga,
// gola, listras, meião, sola) são resolvidos no fragment shader. Cabeça e cabelo: mais dois
// InstancedMesh. Indicador do jogador controlado: anel com seta no chão + seta acima da cabeça;
// o "próximo da troca" ganha um anel menor e discreto. Qualquer número de jogadores dos dois
// times (a capacidade cresce sozinha). Goleiro (posicao 'GOL') com uniforme próprio, manga
// comprida e luvas.
import * as THREE from 'three';
import { SEGMENTOS, RAIO_CABECA, J } from '../anim.js';
import { texMancha, texIndicador, texIndicadorPressao } from './texturas.js';

const NSEG = SEGMENTOS.length;

// Uniformes (cores) por time e função. Tudo fictício.
// Time 0 (GOLAÇO): preto com detalhes verdes; goleiro verde-limão com preto.
// Time 1 (visitante): branco/cinza com detalhes pretos; goleiro laranja escuro com cinza.
// Na partida (Etapa 3) o uniforme vem do elenco (ELENCOS[id].uniforme = {linha, goleiro}, chaves
// destes KITS): a lista do desenho traz `kit`; sem ele (treino), vale o do time.
export const KITS = {
  linha0: { camisa: '#15191b', calcao: '#0e1112', meiao: '#15191b', chuteira: '#19e07a', acento: '#19e07a', sola: '#0b0d0e', luva: '#19e07a' },
  goleiro0: { camisa: '#b8f02e', calcao: '#101314', meiao: '#b8f02e', chuteira: '#101314', acento: '#101314', sola: '#0b0d0e', luva: '#101314' },
  linha1: { camisa: '#e9ecee', calcao: '#b9bfc4', meiao: '#e9ecee', chuteira: '#15191b', acento: '#15191b', sola: '#d5d9dc', luva: '#15191b' },
  goleiro1: { camisa: '#c4561c', calcao: '#4b5257', meiao: '#c4561c', chuteira: '#2a2e31', acento: '#8f979c', sola: '#1d2023', luva: '#8f979c' },
  // árbitros (pré-jogo): azul-royal com calção preto — não confunde com o preto/verde do mandante, o branco do
  // visitante, o lima do goleiro 0 nem o laranja do goleiro 1
  arbitro: { camisa: '#2459d6', calcao: '#0e1112', meiao: '#0e1112', chuteira: '#0e1112', acento: '#e9ecee', sola: '#0b0d0e', luva: '#2459d6' },
  // treinadores (12/10; fictícios): o do Golaço FC de terno grafite com a gola da camisa branca; o do Ventania FC de
  // agasalho cinza-chumbo com faixas brancas e tênis branco. 7 dos 8 uniformes que a chave de cor aceita
  tecnico0: { camisa: '#2b3034', calcao: '#23272a', meiao: '#23272a', chuteira: '#0e1112', acento: '#e9ecee', sola: '#0b0d0e', luva: '#2b3034' },
  tecnico1: { camisa: '#3a4046', calcao: '#2a2f33', meiao: '#2a2f33', chuteira: '#e9ecee', acento: '#e9ecee', sola: '#d5d9dc', luva: '#3a4046' },
};
// Pele e cabelo variam por jogador (sorteio fixo pelo id): elenco com cara de elenco.
const PELES = ['#f0c8a4', '#e3b088', '#c99067', '#b9825c', '#a06a46', '#8d5d3f', '#6e452c', '#5a3824'];
const CABELOS = ['#16100c', '#1c1410', '#2a1e16', '#3b2a1c', '#5a3f26', '#7a5532', '#a07a48', '#0e0d0c'];
function sorteio(id, s) {
  let h = Math.imul((id | 0) + 0x9e37, 0x85ebca6b) ^ Math.imul(s, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

// Padrões (ver o fragment shader). 2 = antebraço do goleiro (manga comprida e luva).
const P = { liso: 0, manga: 1, luva: 2, tronco: 3, gola: 4, coxa: 5, meiao: 6, chuteira: 7 };
// padrão da camisa (uniformes do Total Match; identidade.js PADROES): somado ao iPad do tronco e da gola
const PADRAO_FRAC = { plain: 0, stripes: 0.1, halves: 0.2, sash: 0.3, hoops: 0.4 };

function nomeJ(i) { return Object.keys(J).find(k => J[k] === i) ?? ''; }

/** Estilo de cada segmento pelo nome das juntas (robusto a mudanças na ordem de SEGMENTOS). */
function estilo(seg) {
  const a = nomeJ(seg[0]), b = nomeJ(seg[1]), parte = seg[4];
  const tem = (x, y) => (a === x && b === y) || (a === y && b === x);
  // raios r: [A, B] substituem os de SEGMENTOS só no desenho (quadril e pelve mais enxutos: a
  // calota da pelve e a do quadril não fazem mais um "volume" de fralda abaixo do calção)
  if (tem('pelve', 'lombar')) return { achata: 0.74, pad: P.liso, c: ['calcao', 'pele', 'acento'], sup: false, r: [0.118, 0.13] };
  if (tem('lombar', 'peito')) return { achata: 0.68, pad: P.tronco, c: ['camisa', 'pele', 'acento'], sup: true };
  if (tem('peito', 'pescoco')) return { achata: 0.78, pad: P.gola, c: ['camisa', 'pele', 'acento'], sup: true };
  if (tem('ombroE', 'ombroD')) return { achata: 0.85, pad: P.liso, c: ['camisa', 'pele', 'acento'], sup: true };
  // manga: a cor da manga do uniforme (`manga`; os uniformes sem ela caem na camisa em escreverCores)
  if (/^ombro/.test(a) && /^cotovelo/.test(b)) return { achata: 1, pad: P.manga, c: ['manga', 'pele', 'acento'], sup: true };
  if (tem('quadrilE', 'quadrilD')) return { achata: 0.84, pad: P.liso, c: ['calcao', 'pele', 'acento'], sup: false, r: [0.088, 0.088] };
  if (/^quadril/.test(a) && /^joelho/.test(b)) return { achata: 1, pad: P.coxa, c: ['calcao', 'pele', 'acento'], sup: false };
  if (/^joelho/.test(a) && /^tornozelo/.test(b)) return { achata: 1, pad: P.meiao, c: ['meiao', 'pele', 'acento'], sup: false };
  if (/^tornozelo/.test(a) && /^ponta/.test(b)) return { achata: 0.8, pad: P.chuteira, c: ['chuteira', 'pele', 'sola'], sup: false };
  const sup = !/quadril|joelho|tornozelo|ponta|pelve/.test(a + b);
  return { achata: 1, pad: P.liso, c: [parte, 'pele', 'acento'], sup };
}
const ESTILOS = SEGMENTOS.map(estilo);
/** Goleiro: manga comprida (braço inteiro na cor da camisa) e luva na mão. */
function estiloGoleiro(seg, base) {
  const a = nomeJ(seg[0]), b = nomeJ(seg[1]);
  if (/^ombro/.test(a) && /^cotovelo/.test(b)) return { ...base, pad: P.liso, c: ['camisa', 'pele', 'acento'] };
  if (/^cotovelo/.test(a) && /^mao/.test(b)) return { ...base, pad: P.luva, c: ['camisa', 'luva', 'acento'], r: [0.046, 0.05] };
  return base;
}
const ESTILOS_GOL = SEGMENTOS.map((sg, i) => estiloGoleiro(sg, ESTILOS[i]));
/**
 * Treinador (com os padrões que já existem, sem shader novo): o tronco liso (sem as listras do uniforme) com a gola na cor
 * de acento (a gola branca da camisa sob o paletó; a do agasalho), o braço inteiro na cor do paletó/agasalho e o antebraço
 * no padrão da luva com a mão de pele (a manga até o punho, o punho na cor de acento), a coxa, a canela e o meião lisos
 * na cor da calça.
 */
function estiloTecnico(seg, base) {
  const a = nomeJ(seg[0]), b = nomeJ(seg[1]);
  if (/^ombro/.test(a) && /^cotovelo/.test(b)) return { ...base, pad: P.liso, c: ['camisa', 'pele', 'acento'] };
  if (/^cotovelo/.test(a) && /^mao/.test(b)) return { ...base, pad: P.luva, c: ['camisa', 'pele', 'acento'] };
  if (base.pad === P.tronco) return { ...base, pad: P.liso };
  if (/^quadril/.test(a) && /^joelho/.test(b)) return { ...base, pad: P.liso, c: ['calcao', 'pele', 'acento'] };
  if (/^joelho/.test(a) && /^tornozelo/.test(b)) return { ...base, pad: P.liso, c: ['calcao', 'pele', 'acento'] };
  return base;
}
const ESTILOS_TECNICO = SEGMENTOS.map((sg, i) => estiloTecnico(sg, ESTILOS[i]));
const estilosDe = jg => (jg.tecnico ? ESTILOS_TECNICO : jg.goleiro ? ESTILOS_GOL : ESTILOS);
// `ocultar` (1ª pessoa do replay: o autor não pode se ver por dentro): bit1 (2) = cabeça e cabelo com escala 0; bit2 (4) =
// as cápsulas do pescoço, do peito, da lombar, dos ombros e dos braços com raio e comprimento 0. Ficam a pelve e as pernas.
export const OCULTA = { cabeca: 2, tronco: 4 };
const OCULTA_TRONCO = new Uint8Array(NSEG);
SEGMENTOS.forEach((sg, i) => {
  const a = nomeJ(sg[0]), b = nomeJ(sg[1]), nomes = a + ' ' + b;
  if (/pescoco|peito|ombro|cotovelo|mao|cabeca/.test(nomes) || (a === 'lombar' && b === 'peito')) OCULTA_TRONCO[i] = 1;
});

/** Cápsula unitária: anéis do cilindro (aAnel = 1) + calotas; aFim = 0 no lado A, 1 no B. */
function geoCapsula(nr, nc) {
  const linhas = [];
  for (let i = 0; i <= nc; i++) { const f = (i / nc) * Math.PI / 2; linhas.push({ y: -Math.cos(f), r: Math.sin(f), fim: 0, anel: 0 }); }
  linhas.push({ y: 0, r: 1, fim: 0, anel: 1 });
  linhas.push({ y: 0, r: 1, fim: 1, anel: 1 });
  for (let i = nc; i >= 0; i--) { const f = (i / nc) * Math.PI / 2; linhas.push({ y: Math.cos(f), r: Math.sin(f), fim: 1, anel: 0 }); }
  const pos = [], nrm = [], fim = [], anel = [], idx = [];
  for (const l of linhas) {
    for (let k = 0; k <= nr; k++) {
      const t = (k / nr) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      pos.push(c * l.r, l.y, s * l.r);
      if (l.anel) nrm.push(c, 0, s); else nrm.push(c * l.r, l.y, s * l.r);
      fim.push(l.fim); anel.push(l.anel);
    }
  }
  const W = nr + 1;
  for (let i = 0; i < linhas.length - 1; i++) {
    for (let k = 0; k < nr; k++) {
      const a = i * W + k, b = (i + 1) * W + k, c = a + 1, d = b + 1;
      idx.push(a, b, c, c, b, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aFim', new THREE.Float32BufferAttribute(fim, 1));
  g.setAttribute('aAnel', new THREE.Float32BufferAttribute(anel, 1));
  g.setIndex(idx);
  return g;
}

const DECL_V = `
attribute float aFim;
attribute float aAnel;
attribute vec4 iDim;   // raio A, raio B, comprimento, achatamento (frente–trás)
attribute vec3 iC1;
attribute vec3 iC2;
attribute vec3 iC3;
attribute float iPad;
varying vec3 vC1;
varying vec3 vC2;
varying vec3 vC3;
varying float vPad;
varying float vT;
varying vec2 vLocal;
`;
const CORPO_V = `
float _r = mix(iDim.x, iDim.y, aFim);
float _len = max(iDim.z, 1e-3);
vec3 transformed = vec3(position.x * _r, aFim * iDim.z + position.y * _r, position.z * _r * iDim.w);
vT = (aFim * iDim.z + position.y * _r) / _len;
vLocal = position.xz;
vC1 = iC1; vC2 = iC2; vC3 = iC3; vPad = iPad;
`;

function materialSegmentos() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + DECL_V)
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = normalize(vec3(normal.x,
          normal.y + aAnel * (iDim.x - iDim.y) / max(iDim.z, 1e-3),
          normal.z / max(iDim.w, 0.2)));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', CORPO_V);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vC1;
        varying vec3 vC2;
        varying vec3 vC3;
        varying float vPad;
        varying float vT;
        varying vec2 vLocal;
        float faixa(float t, float a, float w) { return smoothstep(a - w, a + w, t); }
        // padrões dos uniformes do Total Match (iPad do tronco/gola: +0.1 listras verticais, +0.2 metades, +0.3 faixa
        // diagonal, +0.4 aros); 1 = a 2ª cor. L = (lado, frente) na seção da cápsula; t ao longo do segmento
        float padraoCamisa(float q, vec2 L, float t, bool tronco) {
          float sl = clamp(L.x / max(length(L), 1e-3), -1.0, 1.0);
          if (q < 0.15) {
            float x = asin(sl) * 1.5915;           // 5 pares de listras de um lado ao outro do peito
            float tri = abs(fract(x) - 0.5);
            float aa = fwidth(x) * 0.75 + 0.02;
            return smoothstep(0.25 - aa, 0.25 + aa, tri);
          } else if (q < 0.25) {
            float aa = fwidth(sl) + 0.02;
            return smoothstep(-aa, aa, sl);
          } else if (q < 0.35) {
            float d = sl * 0.9 + (t - 0.5) * (tronco ? 1.2 : 0.35) - (tronco ? 0.0 : 0.55);
            float aa = fwidth(d) + 0.02;
            return 1.0 - smoothstep(0.22 - aa, 0.22 + aa, abs(d));
          }
          if (!tronco) return 0.0;
          float x = t * 2.6;
          float tri = abs(fract(x) - 0.5);
          float aa = fwidth(x) * 0.75 + 0.02;
          return smoothstep(0.25 - aa, 0.25 + aa, tri);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 cor = vC1;
          float t = vT;
          float w = fwidth(t) * 0.75 + 0.004;
          // lado = |cos| do ângulo em volta do eixo (1 = bem do lado): medido pelo ângulo e não
          // pela posição, para a listra não "rasgar" nas calotas (lá o raio diminui)
          float lado = abs(vLocal.x) / max(length(vLocal), 1e-3);
          float wl = fwidth(lado) * 0.75 + 0.01;
          // só no trecho cilíndrico (0 < t < 1): nas calotas a listra some com suavidade
          float meio = faixa(t, 0.03, w) * (1.0 - faixa(t, 0.97, w));
          float p = vPad;
          if (p > 0.5 && p < 1.5) {            // manga curta: camisa, punho verde, braço
            cor = mix(cor, vC3, faixa(t, 0.54, w));
            cor = mix(cor, vC2, faixa(t, 0.63, w));
          } else if (p > 1.5 && p < 2.5) {     // goleiro: manga comprida, punho e luva
            cor = mix(cor, vC3, faixa(t, 0.66, w));
            cor = mix(cor, vC2, faixa(t, 0.74, w));
          } else if (p > 2.5 && p < 3.5) {     // tronco: listras laterais (liso) ou o padrão do uniforme (2ª cor)
            float q = p - 3.0;
            if (q < 0.05) cor = mix(cor, vC3, faixa(lado, 0.94, wl) * meio);
            else cor = mix(cor, vC3, padraoCamisa(q, vLocal, t, true));
          } else if (p > 3.5 && p < 4.5) {     // gola e pescoço
            float q = p - 4.0;
            if (q > 0.05) cor = mix(cor, vC3, padraoCamisa(q, vLocal, t, false) * (1.0 - faixa(t, 0.6, w)));
            cor = mix(cor, vC3, faixa(t, 0.62, w));
            cor = mix(cor, vC2, faixa(t, 0.78, w));
          } else if (p > 4.5 && p < 5.5) {     // coxa: calção com listra, depois a pele
            cor = mix(cor, vC3, faixa(lado, 0.95, wl) * faixa(t, 0.03, w) * (1.0 - faixa(t, 0.5, w)));
            cor = mix(cor, vC2, faixa(t, 0.5, w));
          } else if (p > 5.5 && p < 6.5) {     // meião: joelho, faixa verde, meião
            cor = mix(vC2, vC3, faixa(t, 0.06, w));
            cor = mix(cor, vC1, faixa(t, 0.17, w));
          } else if (p > 6.5) {                // chuteira: sola
            cor = mix(cor, vC3, 1.0 - faixa(vLocal.y, -0.35, 0.08));
          }
          diffuseColor.rgb = cor;
        }`);
  };
  mat.customProgramCacheKey = () => 'manequim-v4';
  return mat;
}

function materialSombraSegmentos() {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + DECL_V)
      .replace('#include <begin_vertex>', CORPO_V);
  };
  mat.customProgramCacheKey = () => 'manequim-sombra-v1';
  return mat;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

// Corpo humano (Etapa 5, ?corpo=humano): render/humano3d.js sob demanda; até chegar (e se falhar), o manequim desenha.
// Linha do uniforme na textura do humano: 20 texels RGBA por boneco (ver humano3d.js COR_F).
const TIPO_PADRAO = { plain: 0, liso: 0, stripes: 1, listras_verticais: 1, hoops: 2, listras_horizontais: 2, sash: 3, faixa_diagonal: 3, band: 4, faixa_horizontal_peito: 4, halves: 5, metades: 5 };
const TETO_TRI = { baixa: 3e4, media: 6e4, alta: 1.2e5 };

export function criarJogadores3D(cena, qualidade, opc = {}) {
  const alta = qualidade === 'alta';
  const geo = geoCapsula(alta ? 14 : 9, alta ? 4 : 2);
  const geoCab = new THREE.SphereGeometry(1, alta ? 24 : 14, alta ? 16 : 10);
  const geoCabelo = new THREE.SphereGeometry(1, alta ? 20 : 12, alta ? 8 : 5, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const gm = new THREE.PlaneGeometry(1, 1);
  gm.rotateX(-Math.PI / 2);
  const matSeg = materialSegmentos();
  const matSegSombra = materialSombraSegmentos();
  const matCab = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const matCabelo = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const matMancha = new THREE.MeshBasicMaterial({
    map: texMancha(), color: 0x000000, transparent: true, depthWrite: false, opacity: 0.5,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
  let sombras = true;

  // Instâncias para `cap` jogadores (recriadas maiores se entrar mais gente).
  let cap = 0, segs, cabecas, cabelos, manchas, aDim, aC1, aC2, aC3, aPad;
  function montar(n) {
    if (segs) {
      for (const im of [segs, cabecas, cabelos, manchas]) { cena.remove(im); im.dispose(); }
      segs.geometry.dispose();
    }
    cap = n;
    const ni = cap * NSEG;
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = geo.index;
    for (const k of Object.keys(geo.attributes)) ig.setAttribute(k, geo.attributes[k]);
    aDim = new THREE.InstancedBufferAttribute(new Float32Array(ni * 4), 4);
    aC1 = new THREE.InstancedBufferAttribute(new Float32Array(ni * 3), 3);
    aC2 = new THREE.InstancedBufferAttribute(new Float32Array(ni * 3), 3);
    aC3 = new THREE.InstancedBufferAttribute(new Float32Array(ni * 3), 3);
    aPad = new THREE.InstancedBufferAttribute(new Float32Array(ni), 1);
    aDim.setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute('iDim', aDim);
    ig.setAttribute('iC1', aC1);
    ig.setAttribute('iC2', aC2);
    ig.setAttribute('iC3', aC3);
    ig.setAttribute('iPad', aPad);
    segs = new THREE.InstancedMesh(ig, matSeg, ni);
    segs.customDepthMaterial = matSegSombra;
    segs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    segs.frustumCulled = false;
    segs.count = 0;
    segs.name = 'jogadores-segmentos';
    cena.add(segs);
    // cabeça e cabelo
    cabecas = new THREE.InstancedMesh(geoCab, matCab, cap);
    cabelos = new THREE.InstancedMesh(geoCabelo, matCabelo, cap);
    for (const im of [cabecas, cabelos]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.count = 0;
      cena.add(im);
    }
    cabecas.name = 'jogadores-cabecas';
    cabelos.name = 'jogadores-cabelos';
    // sombra de contato (mancha) sob cada jogador
    manchas = new THREE.InstancedMesh(gm, matMancha, cap);
    manchas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    manchas.frustumCulled = false;
    manchas.count = 0;
    manchas.renderOrder = 3;
    manchas.name = 'jogadores-manchas';
    cena.add(manchas);
    segs.castShadow = cabecas.castShadow = cabelos.castShadow = sombras;
    vagaDe.clear();
  }

  // indicador do jogador controlado: anel no chão e o triângulo acima da cabeça. A seta no chão saiu (tela limpa,
  // 11/10: o rumo se lê pelo corpo, como no EA FC; uma chamada de desenho a menos)
  const verde = 0x19e07a;
  const anelGeo = new THREE.RingGeometry(0.46, 0.56, 48);
  const anelTodo = new THREE.Group();
  const matAnel = new THREE.MeshBasicMaterial({
    color: verde, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  const anel = new THREE.Mesh(anelGeo, matAnel);
  anel.rotation.x = -Math.PI / 2;
  anelTodo.add(anel);
  anel.renderOrder = 4;
  anelTodo.visible = false;
  anelTodo.name = 'indicador';
  cena.add(anelTodo);
  const marca = new THREE.Sprite(new THREE.SpriteMaterial({ map: texIndicador(), depthWrite: false, transparent: true }));
  marca.visible = false;
  marca.renderOrder = 5;
  cena.add(marca);
  // companheiro chamado pelo PRESSÃO (pedido do dono, 11/10: "o botão de pressão não funciona" — nada na tela mostrava
  // quem ia): setas âmbar acima da cabeça, sem texto
  const marcaPressao = new THREE.Sprite(new THREE.SpriteMaterial({ map: texIndicadorPressao(), depthWrite: false, transparent: true }));
  marcaPressao.visible = false;
  marcaPressao.renderOrder = 5;
  marcaPressao.name = 'indicador-pressao';
  cena.add(marcaPressao);
  // Regra 12.3 (pedido do dono, 11/10): nos últimos 5 s dos 8 com a bola nas mãos, um anel âmbar sob o goleiro que se
  // esvazia (a contagem que o árbitro faz com a mão; sem texto). O anel é desenhado em pedaços (drawRange)
  const SEG_OITO = 48;
  const geoOito = new THREE.RingGeometry(0.62, 0.74, SEG_OITO, 1);
  const anelOito = new THREE.Mesh(geoOito, new THREE.MeshBasicMaterial({
    color: 0xffc23a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  }));
  anelOito.rotation.x = -Math.PI / 2;
  anelOito.renderOrder = 4;
  anelOito.visible = false;
  anelOito.name = 'anel-oito';
  cena.add(anelOito);
  // "próximo da troca": anel fino, menor e translúcido (discreto)
  const matProx = new THREE.MeshBasicMaterial({
    color: 0xd8ffe9, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  // largura de 9 cm: fina o bastante para ser discreta e grossa o bastante para não serrilhar
  // (sem antisserrilhado, um anel de 5 cm vira tracejado na câmera de TV)
  const anelProx = new THREE.Mesh(new THREE.RingGeometry(0.37, 0.46, 40), matProx);
  anelProx.rotation.x = -Math.PI / 2;
  anelProx.renderOrder = 4;
  anelProx.visible = false;
  anelProx.name = 'indicador-proximo';
  cena.add(anelProx);

  // ---- corpo humano (sob demanda)
  let humano = null, humanoErro = null;
  const kitsBrutos = { ...KITS };
  if (opc.corpo === 'humano') {
    (async () => {
      const H = await import('./humano3d.js');
      const dados = await H.carregarHumano();
      const cab = await new Promise((ok, falha) => new THREE.TextureLoader().load(new URL('../../assets/jogador/cabeca-rb.webp', import.meta.url).href, ok, undefined, falha));
      cab.colorSpace = THREE.SRGBColorSpace;
      humano = H.criarHumano3D(cena, dados, { qualidade, cabeca: cab });
      humano.definirSombras(sombras);
    })().catch(e => { humanoErro = String(e?.message ?? e); console.error('corpo humano:', e); });
  }
  const linhasKit = new Map(); // chave da vaga → Float32Array(80)
  const _c = new THREE.Color();
  function linhaKit(jg) {
    const nome = NOMES_KIT[kitIdx(jg)];
    const kb = kitsBrutos[nome] ?? KITS.linha0;
    const pele = pelesLin[Math.floor(sorteio(jg.id, 1) * pelesLin.length)];
    const num = jg.num ?? (jg.id > 0 && jg.id % 100 > 0 && jg.id % 100 < 100 ? jg.id % 100 : 0);
    const ch = `${nome}|${jg.id}|${jg.goleiro ? 1 : 0}|${jg.tecnico ? 1 : 0}`;
    let L = linhasKit.get(ch);
    if (L) return L;
    L = new Float32Array(80);
    const put = (i, hex, alt) => { _c.set(hex ?? alt ?? '#888888'); L[i * 4] = _c.r; L[i * 4 + 1] = _c.g; L[i * 4 + 2] = _c.b; L[i * 4 + 3] = 1; };
    put(0, kb.camisa); put(1, kb.segunda ?? kb.camisa2, kb.acento); put(2, kb.manga, kb.camisa); put(3, kb.gola, kb.acento);
    put(4, kb.punho, kb.acento); put(5, kb.calcao); put(6, kb.barra, kb.calcao); put(7, kb.meiao); put(8, kb.chuteira);
    put(9, kb.acabamento, kb.acento); put(10, kb.luva, kb.acento);
    L[44] = pele.r; L[45] = pele.g; L[46] = pele.b; L[47] = 1;
    const tipo = TIPO_PADRAO[kb.padrao] ?? 0;
    const n = kb.padraoN ?? (tipo === 1 ? 4 : tipo === 2 ? 5 : 0);
    L[48] = tipo; L[49] = n; L[50] = kb.padraoLargura ?? (n ? 0.5 / n : 0.5); L[51] = kb.mangaPadrao ? 1 : 0;
    L[52] = jg.goleiro ? 1 : 0; L[53] = jg.tecnico ? 1 : 0; L[54] = jg.tecnico ? 0 : num;
    _c.set(kb.camisa ?? '#888888');
    const lum = 0.2126 * _c.r + 0.7152 * _c.g + 0.0722 * _c.b;
    put(14, kb.numero, lum > 0.25 ? '#15191b' : '#f2f4f5');
    put(15, kb.sola, '#0b0d0e');
    // a faixa do meião (camisas reais): a cor e a = 1 quando existe
    if (kb.meiaoDetalhe) put(16, kb.meiaoDetalhe); else L[67] = 0;
    linhasKit.set(ch, L);
    return L;
  }
  const itensH = [];

  // cores lineares de cada uniforme (só os campos '#rrggbb'); `padrao` (o do Total Match: listras, metades, faixa,
  // aros) vira a fração do iPad do tronco e da gola (PADRAO_FRAC; liso = 0, os uniformes de hoje)
  const linKit = kit => {
    const o = {};
    for (const [nome, v] of Object.entries(kit)) if (typeof v === 'string' && v[0] === '#') o[nome] = new THREE.Color(v);
    o.padrao = PADRAO_FRAC[kit.padrao] ?? 0;
    return o;
  };
  const kitsLin = Object.fromEntries(Object.entries(KITS).map(([k, kit]) => [k, linKit(kit)]));
  // índice do uniforme (sem alocar no quadro): o do elenco, se vier; senão o do time e da função
  const NOMES_KIT = Object.keys(KITS);
  const IDX_KIT = Object.fromEntries(NOMES_KIT.map((k, i) => [k, i]));
  const PADRAO_KIT = [[IDX_KIT.linha0, IDX_KIT.goleiro0], [IDX_KIT.linha1, IDX_KIT.goleiro1]];
  const kitIdx = jg => IDX_KIT[jg.kit] ?? PADRAO_KIT[jg.time === 1 ? 1 : 0][jg.goleiro ? 1 : 0];
  const pelesLin = PELES.map(h => new THREE.Color(h));
  const cabelosLin = CABELOS.map(h => new THREE.Color(h));
  const vagaDe = new Map(); // vaga → chave (id, time, goleiro) das cores escritas
  // 32 vagas de uma vez (22 em campo + os 2 treinadores + quem entra + o 4º árbitro + folga): nada é remontado no meio de uma
  // cena (o cortejo do pré-jogo tem 25 e a substituição 26)
  montar(32);

  function escreverCores(vaga, jg) {
    const kit = kitsLin[NOMES_KIT[kitIdx(jg)]];
    const est = estilosDe(jg);
    const pele = pelesLin[Math.floor(sorteio(jg.id, 1) * pelesLin.length)];
    const cab = cabelosLin[Math.floor(sorteio(jg.id, 2) * cabelosLin.length)];
    const cor = nome => (nome === 'pele' ? pele : kit[nome]);
    for (let s = 0; s < NSEG; s++) {
      const e = est[s];
      const i = vaga * NSEG + s;
      const c1 = cor(e.c[0]) ?? kit.camisa, c2 = cor(e.c[1]) ?? pele, c3 = cor(e.c[2]) ?? kit.acento;
      aC1.setXYZ(i, c1.r, c1.g, c1.b);
      aC2.setXYZ(i, c2.r, c2.g, c2.b);
      aC3.setXYZ(i, c3.r, c3.g, c3.b);
      aPad.setX(i, e.pad === P.tronco || e.pad === P.gola ? e.pad + kit.padrao : e.pad);
    }
    aC1.needsUpdate = aC2.needsUpdate = aC3.needsUpdate = aPad.needsUpdate = true;
    cabecas.setColorAt(vaga, pele);
    cabelos.setColorAt(vaga, cab);
    if (cabecas.instanceColor) cabecas.instanceColor.needsUpdate = true;
    if (cabelos.instanceColor) cabelos.instanceColor.needsUpdate = true;
  }

  const fSup = new THREE.Vector3(), fInf = new THREE.Vector3(), fCab = new THREE.Vector3();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), X = new THREE.Vector3();
  const CIMA = new THREE.Vector3(0, 1, 0);

  /**
   * "Frente" do corpo pelos ombros (ou quadris). De pé (tronco a menos de ~30° da vertical) é a conta de
   * sempre, no plano do chão — nada muda para os jogadores de linha. Com o tronco bem inclinado (o goleiro
   * mergulhando, deitado de lado), a direita fica quase vertical e a frente sai de cima × direita, em 3D (as
   * cápsulas não torcem); entre ~30° e ~45° as duas se misturam, sem salto.
   */
  function frente(pose, iE, iD, out) {
    const rx = pose[iD * 3] - pose[iE * 3], ry = pose[iD * 3 + 1] - pose[iE * 3 + 1], rz = pose[iD * 3 + 2] - pose[iE * 3 + 2];
    const l0 = Math.hypot(rx, rz) || 1;
    const ip = J.pelve * 3, in_ = J.pescoco * 3;
    const ux = pose[in_] - pose[ip], uy = pose[in_ + 1] - pose[ip + 1], uz = pose[in_ + 2] - pose[ip + 2];
    const k = Math.min(1, Math.max(0, (0.87 - uy / (Math.hypot(ux, uy, uz) || 1)) / 0.16));
    if (k === 0) return out.set(rz / l0, 0, -rx / l0);
    // cima × direita
    let fx = uy * rz - uz * ry, fy = uz * rx - ux * rz, fz = ux * ry - uy * rx;
    let l = Math.hypot(fx, fy, fz);
    if (l < 1e-6) { fx = rz; fy = 0; fz = -rx; l = l0; }
    fx = (rz / l0) * (1 - k) + (fx / l) * k; fy = (fy / l) * k; fz = (-rx / l0) * (1 - k) + (fz / l) * k;
    l = Math.hypot(fx, fy, fz) || 1;
    return out.set(fx / l, fy / l, fz / l);
  }

  return {
    get segs() { return segs; },
    get cabecas() { return cabecas; },
    get cabelos() { return cabelos; },
    get capacidade() { return cap; },
    /** Triângulos de UM boneco (as cápsulas dos segmentos, a cabeça, o cabelo e a mancha de contato). */
    get triangulosPorBoneco() {
      if (humano && itensH.length) return humano.triangulos / itensH.length + 2;
      const t = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
      return t(segs.geometry) * NSEG + t(cabecas.geometry) + t(cabelos.geometry) + t(manchas.geometry);
    },
    /** Marcas da partida (testes de navegador): a do PRESSÃO e o anel dos 8 s — posição e quanto do anel aparece. */
    get indicadores() {
      return {
        pressao: marcaPressao.visible ? { x: marcaPressao.position.x, y: marcaPressao.position.y, z: marcaPressao.position.z } : null,
        oito: anelOito.visible ? { x: anelOito.position.x, z: anelOito.position.z, segmentos: Math.round(geoOito.drawRange.count / 6), total: SEG_OITO } : null,
      };
    },
    /**
     * Garante lugar para n jogadores desenhados já (sem remontar no meio de uma cena: a cena de substituição desenha os
     * 22 + quem entra + o quarto árbitro; remontar ali subia um buffer novo para a GPU no meio dela).
     */
    reservar(n) { if (n > cap) montar(n); },
    /**
     * Uniformes da partida (identidade.js, só com ?tm): reescreve as chaves que já existem (linha0, goleiro0, linha1,
     * goleiro1, arbitro) com as cores resolvidas sem confusão — o elenco do Total Match aponta para elas (a chave do
     * cache por vaga não muda de tamanho) — e reescreve as cores de todas as vagas no próximo quadro.
     */
    definirKits(mapa) {
      for (const [k, kit] of Object.entries(mapa || {})) if (kit && IDX_KIT[k] != null) { kitsLin[k] = linKit(kit); kitsBrutos[k] = kit; }
      vagaDe.clear();
      linhasKit.clear();
    },
    /** O corpo humano (?corpo=humano): pronto, erro, triângulos do último quadro, níveis em uso. */
    get humano() {
      return { pedido: opc.corpo === 'humano', pronto: !!humano, erro: humanoErro, triangulos: humano ? humano.triangulos : 0,
        niveis: humano ? humano.niveis.map(n => n.geo.instanceCount) : null, bonecos: humano ? itensH.length : 0 };
    },
    /**
     * lista: [{id, time, goleiro, kit?, pose (Float32Array já interpolada), controlado, proximo, pressiona, x, z, rumo,
     * tecnico?, ocultar?}]
     * (pressiona: o companheiro chamado pelo botão PRESSÃO — a marca âmbar acima da cabeça; relogio: 0–1 dos últimos 5 s
     * dos 8 com a bola nas mãos — o anel âmbar sob o goleiro, Regra 12.3; −1 ou ausente = nada)
     * (kit: chave dos KITS pelo uniforme do elenco; sem ele, o do time; tecnico: o estilo do treinador; ocultar:
     * OCULTA.cabeca | OCULTA.tronco, a 1ª pessoa do replay)
     * camera: para o tamanho constante da seta acima da cabeça.
     */
    atualizar(lista, camera) {
      if (lista.length > cap) montar(Math.ceil(lista.length * 1.25));
      const nj = lista.length;
      const mat = segs.instanceMatrix.array;
      const dim = aDim.array;
      let controlado = null, proximo = null, pressiona = null, relogio = null;
      for (let p = 0; p < nj; p++) {
        const jg = lista[p];
        // cores fixas por vaga (só reescreve quando a vaga muda de dono/time/função/uniforme)
        const chave = ((jg.id * 8 + kitIdx(jg)) * 2 + (jg.time === 1 ? 1 : 0)) * 2 + (jg.goleiro ? 1 : 0);
        if (vagaDe.get(p) !== chave) { vagaDe.set(p, chave); escreverCores(p, jg); }
        const est = estilosDe(jg);
        const pose = jg.pose;
        const ocu = jg.ocultar | 0;
        frente(pose, J.ombroE, J.ombroD, fSup);
        frente(pose, J.quadrilE, J.quadrilD, fInf);
        for (let s = 0; s < NSEG; s++) {
          const sg = SEGMENTOS[s], e = est[s];
          const ia = sg[0] * 3, ib = sg[1] * 3;
          A.set(pose[ia], pose[ia + 1], pose[ia + 2]);
          B.set(pose[ib], pose[ib + 1], pose[ib + 2]);
          Y.subVectors(B, A);
          let len = Y.length();
          if (len < 1e-5) { Y.set(0, 1, 0); len = 1e-5; } else Y.multiplyScalar(1 / len);
          // referência "frente" perpendicular ao eixo; perto de paralela, mistura com "cima"
          const ref = e.sup ? fSup : fInf;
          const dp = Math.abs(ref.dot(Y));
          const k = Math.min(1, Math.max(0, (dp - 0.6) / 0.3));
          Z.copy(ref).multiplyScalar(1 - k).addScaledVector(CIMA, k);
          Z.addScaledVector(Y, -Z.dot(Y));
          if (Z.lengthSq() < 1e-8) Z.set(1, 0, 0).addScaledVector(Y, -Y.x);
          Z.normalize();
          X.crossVectors(Y, Z);
          const i = p * NSEG + s;
          const o = i * 16;
          mat[o] = X.x; mat[o + 1] = X.y; mat[o + 2] = X.z; mat[o + 3] = 0;
          mat[o + 4] = Y.x; mat[o + 5] = Y.y; mat[o + 6] = Y.z; mat[o + 7] = 0;
          mat[o + 8] = Z.x; mat[o + 9] = Z.y; mat[o + 10] = Z.z; mat[o + 11] = 0;
          mat[o + 12] = A.x; mat[o + 13] = A.y; mat[o + 14] = A.z; mat[o + 15] = 1;
          dim[i * 4] = e.r ? e.r[0] : sg[2]; dim[i * 4 + 1] = e.r ? e.r[1] : sg[3]; dim[i * 4 + 2] = len; dim[i * 4 + 3] = e.achata;
          if ((ocu & 4) && OCULTA_TRONCO[s]) { dim[i * 4] = 0; dim[i * 4 + 1] = 0; dim[i * 4 + 2] = 0; }
        }
        // cabeça: "cima" pelo pescoço, "frente" média de ombros e quadris
        const ic = J.cabeca * 3, ip = J.pescoco * 3;
        A.set(pose[ic], pose[ic + 1], pose[ic + 2]);
        Y.set(pose[ic] - pose[ip], pose[ic + 1] - pose[ip + 1], pose[ic + 2] - pose[ip + 2]).normalize();
        fCab.copy(fSup).add(fInf);
        Z.copy(fCab).addScaledVector(Y, -fCab.dot(Y)).normalize();
        X.crossVectors(Y, Z);
        const R = RAIO_CABECA;
        _m.makeBasis(X, Y, Z);
        _q.setFromRotationMatrix(_m);
        const kc = ocu & 2 ? 0 : 1;
        _s.set(R * 0.92 * kc, R * 1.1 * kc, R * 1.0 * kc);
        _m.compose(A, _q, _s);
        cabecas.setMatrixAt(p, _m);
        _v.copy(A).addScaledVector(Y, R * 0.12).addScaledVector(Z, -R * 0.1);
        _s.set(R * 0.98 * kc, R * 1.08 * kc, R * 1.08 * kc);
        _m.compose(_v, _q, _s);
        cabelos.setMatrixAt(p, _m);
        // mancha de contato (no meio dos pés; o goleiro deitado leva a mancha junto)
        const ang = Math.atan2(fInf.z, fInf.x);
        _q.setFromAxisAngle(CIMA, -ang);
        const pl = J.pelve * 3;
        _m.compose(_v.set(pose[pl], 0.016, pose[pl + 2]), _q, _s.set(1.15, 1, 0.85));
        manchas.setMatrixAt(p, _m);
        if (jg.controlado) controlado = jg;
        else if (jg.proximo) proximo = jg;
        if (jg.pressiona && !jg.controlado) pressiona = jg;
        if (jg.relogio != null && jg.relogio >= 0) relogio = jg;
      }
      segs.count = nj * NSEG;
      cabecas.count = cabelos.count = manchas.count = nj;
      if (humano) {
        // o corpo humano no lugar do manequim (a mancha de contato e as marcas continuam daqui)
        segs.count = 0; cabecas.count = cabelos.count = 0;
        itensH.length = nj;
        for (let p = 0; p < nj; p++) {
          const jg = lista[p];
          const it = itensH[p] ?? (itensH[p] = { pose: null, kit: null, ocultar: 0, chave: 0 });
          it.pose = jg.pose; it.kit = linhaKit(jg); it.ocultar = jg.ocultar | 0; it.chave = jg.id;
        }
        const altura = (globalThis.innerHeight || 720) * (globalThis.devicePixelRatio || 1);
        humano.atualizar(itensH, camera, altura, TETO_TRI[qualidade] ?? 6e4);
      }
      segs.instanceMatrix.needsUpdate = true;
      aDim.needsUpdate = true;
      cabecas.instanceMatrix.needsUpdate = true;
      cabelos.instanceMatrix.needsUpdate = true;
      manchas.instanceMatrix.needsUpdate = true;
      // indicador
      if (controlado) {
        anelTodo.visible = true;
        anelTodo.position.set(controlado.x, 0.02, controlado.z);
        anelTodo.rotation.y = -controlado.rumo;
        const ic2 = J.cabeca * 3;
        const pose = controlado.pose;
        marca.visible = true;
        marca.position.set(pose[ic2], pose[ic2 + 1] + 0.42, pose[ic2 + 2]);
        if (camera) {
          // tamanho constante na tela (~2,2% do menor lado da tela; era 2,6% antes da tela limpa)
          const d = camera.position.distanceTo(marca.position);
          const k = 2 * Math.tan((camera.fov * Math.PI) / 360) * d * 0.022 * Math.min(1, camera.aspect);
          marca.scale.set(k, k, 1);
          marca.position.y += k * 0.3;
        }
      } else {
        anelTodo.visible = false;
        marca.visible = false;
      }
      if (pressiona) {
        const ic3 = J.cabeca * 3, pz = pressiona.pose;
        marcaPressao.visible = true;
        marcaPressao.position.set(pz[ic3], pz[ic3 + 1] + 0.42, pz[ic3 + 2]);
        if (camera) {
          // o mesmo tamanho na tela da seta do controlado (~2,6% do menor lado)
          const d = camera.position.distanceTo(marcaPressao.position);
          const k = 2 * Math.tan((camera.fov * Math.PI) / 360) * d * 0.026 * Math.min(1, camera.aspect);
          marcaPressao.scale.set(k, k, 1);
          marcaPressao.position.y += k * 0.3;
        }
      } else marcaPressao.visible = false;
      if (relogio) {
        anelOito.visible = true;
        anelOito.position.set(relogio.x, 0.021, relogio.z);
        geoOito.setDrawRange(0, Math.max(1, Math.round(relogio.relogio * SEG_OITO)) * 6);
      } else anelOito.visible = false;
      if (proximo) {
        anelProx.visible = true;
        anelProx.position.set(proximo.x, 0.019, proximo.z);
      } else anelProx.visible = false;
    },
    definirSombras(ligadas) {
      sombras = ligadas;
      humano?.definirSombras(ligadas);
      segs.castShadow = cabecas.castShadow = cabelos.castShadow = ligadas;
      matMancha.opacity = ligadas ? 0.32 : 0.5;
    },
  };
}
