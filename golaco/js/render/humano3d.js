// Corpo humano realista (Etapa 5): o Rocketbox Sports_Male_02 (MIT) encaixado nas medidas do jogo (tools/humano/), com a
// pele na GPU. SÓ DESENHO, por cima da simulação (o hash não muda): cada boneco é a pose do jogo (anim.js, as 19 juntas)
// levada aos 25 ossos por render/esqueleto.js, e as matrizes de pele de todos vão numa DataTexture (3 texels por osso,
// uma linha por boneco). Os bonecos saem em 4 níveis de detalhe pela altura na tela, um desenho (Mesh com
// InstancedBufferGeometry) por nível: o vertex shader lê os 4 ossos do vértice e faz a pele linear; o fragment pinta o
// uniforme por REGIÃO (assets/jogador/regioes.png: camisa, manga, gola, punho, calção, barra, meião, chuteira, sola) com
// as cores do time (os KITS do jogo e os da identidade do Total Match) e os padrões (listras, aros, faixa, metades) pela
// posição de REPOUSO do vértice (frente e costas coerentes, sem costura da UV), o número das costas de um atlas de dígitos
// e as dobras do pano pelo mapa de normais do Rocketbox (sem o logotipo nem o número do original).
// A cabeça ainda é a do Rocketbox, no tom de pele de cada um (o rosto de cada jogador é a etapa seguinte).
// Carregado sob demanda pela fachada render/jogador3d.js (com ?corpo=humano).
import * as THREE from 'three';
import { criarEsqueleto, NOSSOS } from './esqueleto.js';
import { lerCorpo } from './corpo-dados.js';
import { escolherLods, criarEstadoLod } from './lod-humano.js';

const BASE = new URL('../../assets/jogador/', import.meta.url);
const TEXELS_KIT = 16;

/** Carrega o corpo (índice, dados, máscara, normais). */
export async function carregarHumano() {
  const [ind, bin, reg] = await Promise.all([
    fetch(new URL('corpo.json', BASE)).then(r => r.json()),
    fetch(new URL('corpo.bin', BASE)).then(r => r.arrayBuffer()),
    fetch(new URL('regioes.json', BASE)).then(r => r.json()),
  ]);
  const tl = new THREE.TextureLoader();
  const carregarTex = arq => new Promise((ok, falha) => tl.load(new URL(arq, BASE).href, ok, undefined, falha));
  const [texReg, texNormal] = await Promise.all([carregarTex('regioes.png'), carregarTex('pano-normal.webp')]);
  return { corpo: lerCorpo(ind, bin), regioes: reg, texReg, texNormal };
}

function geometriaDoLod(lod) {
  const c = lod.partes.corpo, h = lod.partes.cabeca;
  const nv = c.nv + h.nv;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const ossos = new Uint8Array(nv * 4), pesos = new Uint8Array(nv * 4), parte = new Float32Array(nv);
  pos.set(c.pos); pos.set(h.pos, c.nv * 3);
  nor.set(c.nor); nor.set(h.nor, c.nv * 3);
  uv.set(c.uv); uv.set(h.uv, c.nv * 2);
  ossos.set(c.ossos); ossos.set(h.ossos, c.nv * 4);
  pesos.set(c.pesos); pesos.set(h.pesos, c.nv * 4);
  parte.fill(1, c.nv);
  const idx = new Uint16Array((c.ntri + h.ntri) * 3);
  idx.set(c.idx);
  for (let i = 0; i < h.ntri * 3; i++) idx[c.ntri * 3 + i] = h.idx[i] + c.nv;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aOssos', new THREE.BufferAttribute(ossos, 4));
  g.setAttribute('aPesos', new THREE.BufferAttribute(pesos, 4, true));
  g.setAttribute('aParte', new THREE.BufferAttribute(parte, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}

// ---------------------------------------------------------------------------------------------------- shaders
const DECL_V = `
attribute vec4 aOssos;
attribute vec4 aPesos;
attribute float aParte;
attribute float iSlot;
uniform highp sampler2D tOssos;
uniform highp sampler2D tKits;
varying vec3 vRest;
varying float vParte;
varying float vSlot;
varying vec4 vMembro; // pesos: antebraço, mão, canela+pé, coxa
mat4 ossoPele(float b) {
  int x = int(b + 0.5) * 3, y = int(iSlot + 0.5);
  vec4 r0 = texelFetch(tOssos, ivec2(x, y), 0), r1 = texelFetch(tOssos, ivec2(x + 1, y), 0), r2 = texelFetch(tOssos, ivec2(x + 2, y), 0);
  return mat4(vec4(r0.x, r1.x, r2.x, 0.0), vec4(r0.y, r1.y, r2.y, 0.0), vec4(r0.z, r1.z, r2.z, 0.0), vec4(r0.w, r1.w, r2.w, 1.0));
}
float pesoEm(float a, float b) {
  float s = 0.0;
  for (int k = 0; k < 4; k++) { float o = aOssos[k]; if (abs(o - a) < 0.5 || abs(o - b) < 0.5) s += aPesos[k]; }
  return s;
}
`;
const PELE_V = `
mat4 _S = aPesos.x * ossoPele(aOssos.x) + aPesos.y * ossoPele(aOssos.y) + aPesos.z * ossoPele(aOssos.z) + aPesos.w * ossoPele(aOssos.w);
`;
const NORMAL_V = `
${PELE_V}
vec3 objectNormal = normalize(mat3(_S) * normal);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;
const POS_V = `
vec3 transformed = (_S * vec4(position, 1.0)).xyz;
vRest = position; vParte = aParte; vSlot = iSlot;
vMembro = vec4(pesoEm(7.0, 11.0), pesoEm(8.0, 12.0), pesoEm(14.0, 17.0) + pesoEm(15.0, 18.0) + pesoEm(19.0, 20.0), pesoEm(13.0, 16.0));
`;
const DECL_F = `
uniform highp sampler2D tKits;
uniform sampler2D tReg;
uniform sampler2D tCabeca;
uniform sampler2D tDigitos;
uniform vec4 uNumero; // caixa do número das costas na UV (u0, v0, u1, v1)
varying vec3 vRest;
varying float vParte;
varying float vSlot;
varying vec4 vMembro;
vec4 kit(int i) { return texelFetch(tKits, ivec2(i, int(vSlot + 0.5)), 0); }
float aa(float x, float w) { return smoothstep(-w, w, x); }
// padrões da camisa pela posição de repouso (x = frente, y = cima, z = direita; o tronco tem ~0,2 m de meia largura)
float padrao(float tipo, float n, float larg) {
  vec3 p = vRest;
  if (tipo < 0.5) return 0.0;
  if (tipo < 1.5) {                      // listras verticais: n listras da 2ª cor de frente, largura larg do tronco
    float per = 0.40 / max(n, 1.0);
    float x = p.z / per;                 // 0 no meio do peito
    float f = abs(fract(x + 0.5) - 0.5); // 0 no meio da faixa da 1ª cor... (o meio do peito é da 1ª cor)
    float w = clamp(larg * 0.40 / per, 0.05, 0.95) * 0.5;
    float fw = fwidth(x) + 1e-4;
    return aa(f - (0.5 - w), fw);
  }
  if (tipo < 2.5) {                      // aros (listras horizontais)
    float per = 0.40 / max(n, 1.0);
    float y = (p.y - 1.0) / per;
    float f = abs(fract(y) - 0.5);
    float w = clamp(larg * 0.40 / per, 0.05, 0.95) * 0.5;
    return aa(w - f, fwidth(y) + 1e-4);
  }
  if (tipo < 3.5) {                      // faixa diagonal: do ombro esquerdo (z < 0, alto) ao quadril direito
    float d = (p.y - 1.16) + 0.75 * p.z;
    float w = max(larg, 0.08) * 0.20;
    return aa(w - abs(d), fwidth(d) + 1e-4);
  }
  if (tipo < 4.5) {                      // faixa horizontal no peito
    float d = p.y - 1.27;
    float w = max(larg, 0.08) * 0.25;
    return aa(w - abs(d), fwidth(d) + 1e-4);
  }
  return aa(p.z, fwidth(p.z) + 1e-4);    // metades (direita na 2ª cor)
}
float digito(float d, vec2 q) { // q em [0, 1]² dentro da célula do dígito (y para cima)
  return texture(tDigitos, vec2((d + q.x) / 10.0, q.y)).r;
}
`;
const COR_F = `
{
  vec3 cor;
  if (vParte > 0.5) {
    vec4 tc = texture(tCabeca, vUv);
    vec3 pele = kit(11).rgb, tomRB = vec3(0.78, 0.55, 0.43);
    // a pele da cabeça do Rocketbox no tom do jogador (o cabelo e as sobrancelhas escuros quase não mudam)
    float lum = dot(tc.rgb, vec3(0.299, 0.587, 0.114));
    float ehPele = smoothstep(0.18, 0.32, lum);
    cor = mix(tc.rgb, tc.rgb * pele / tomRB, ehPele);
  } else {
    int r = int(texture(tReg, vUv).r * 255.0 + 0.5);
    vec4 k0 = kit(0), k1 = kit(1), pad = kit(12), est = kit(13);
    bool goleiro = est.x > 0.5, tecnico = est.y > 0.5;
    if (r == 0) {
      cor = kit(11).rgb;                                  // pele
      if ((goleiro || tecnico) && vMembro.x > 0.5) cor = kit(2).rgb; // manga comprida
      if (goleiro && vMembro.y > 0.5) cor = kit(10).rgb;  // luva
      if (tecnico && (vMembro.z > 0.3 || vMembro.w > 0.3)) cor = kit(5).rgb; // calça
    } else if (r == 1 || r == 10) {
      cor = mix(k0.rgb, k1.rgb, padrao(pad.x, pad.y, pad.z));
      if (r == 10) cor = kit(9).rgb;
      // número das costas
      if (vRest.x < -0.02 && est.z > 0.5 && vUv.x > uNumero.x && vUv.x < uNumero.z && vUv.y > uNumero.y && vUv.y < uNumero.w) {
        vec2 q = vec2((vUv.x - uNumero.x) / (uNumero.z - uNumero.x), (vUv.y - uNumero.y) / (uNumero.w - uNumero.y));
        q = 1.0 - q;                                      // o número do original está de cabeça para baixo na UV
        float num = est.z, dz = floor(num / 10.0), un = num - dz * 10.0;
        float t = 0.0;
        if (dz > 0.5) {
          if (q.x < 0.5) t = digito(dz, vec2(q.x * 2.0, q.y)); else t = digito(un, vec2(q.x * 2.0 - 1.0, q.y));
        } else if (q.x > 0.25 && q.x < 0.75) t = digito(un, vec2((q.x - 0.25) * 2.0, q.y));
        cor = mix(cor, kit(14).rgb, t);
      }
    } else if (r == 2) cor = mix(kit(2).rgb, k1.rgb, pad.w > 0.5 ? padrao(pad.x, pad.y, pad.z) : 0.0);
    else if (r == 3) cor = kit(3).rgb;
    else if (r == 4) cor = kit(4).rgb;
    else if (r == 5) cor = kit(5).rgb;
    else if (r == 6) cor = kit(6).rgb;
    else if (r == 7) cor = kit(7).rgb;
    else if (r == 8) cor = kit(8).rgb;
    else cor = kit(15).rgb;                               // sola
  }
  diffuseColor.rgb = cor;
}
`;

function remendo(sh, uniforms, cor) {
  Object.assign(sh.uniforms, uniforms);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + DECL_V)
    .replace('#include <beginnormal_vertex>', NORMAL_V)
    // a sombra (MeshDepthMaterial) só tem a normal com displacementMap: a pele entra junto com a posição
    .replace('#include <begin_vertex>', cor ? POS_V : PELE_V + POS_V);
  if (cor) {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL_F)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + COR_F)
      .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1.0 - vParte);');
  }
}

// ---------------------------------------------------------------------------------------------------- desenhador
/**
 * dados: o de carregarHumano(). opc: {qualidade, cabeca (THREE.Texture da cabeça)}. Devolve {atualizar(itens, camera,
 * alturaPx), definirSombras, triangulos, dispose}. itens: [{pose, slot, kit (linear), ocultar}] já com a cor por slot.
 */
export function criarHumano3D(cena, dados, opc = {}) {
  const { corpo, regioes, texReg, texNormal } = dados;
  texReg.magFilter = texReg.minFilter = THREE.NearestFilter;
  texReg.generateMipmaps = false;
  texReg.colorSpace = THREE.NoColorSpace;
  texNormal.colorSpace = THREE.NoColorSpace;
  const E = criarEsqueleto(corpo.repouso);
  let CAP = 0, texOssos, ossosF, texKits, kitsF;
  const uniforms = {
    tOssos: { value: null }, tKits: { value: null }, tReg: { value: texReg },
    tCabeca: { value: opc.cabeca ?? null }, tDigitos: { value: atlasDigitos() },
    uNumero: { value: new THREE.Vector4() },
  };
  // a caixa do número na UV (regioes.json: na imagem, y para baixo; a UV sobe com o flipY)
  const nb = regioes.numero;
  if (nb) uniforms.uNumero.value.set(nb[0], 1 - nb[3], nb[2], 1 - nb[1]);
  function capacidade(n) {
    if (n <= CAP) return;
    CAP = Math.max(n, 32);
    texOssos?.dispose(); texKits?.dispose();
    ossosF = new Float32Array(NOSSOS * 3 * 4 * CAP);
    texOssos = new THREE.DataTexture(ossosF, NOSSOS * 3, CAP, THREE.RGBAFormat, THREE.FloatType);
    texOssos.magFilter = texOssos.minFilter = THREE.NearestFilter;
    kitsF = new Float32Array(TEXELS_KIT * 4 * CAP);
    texKits = new THREE.DataTexture(kitsF, TEXELS_KIT, CAP, THREE.RGBAFormat, THREE.FloatType);
    texKits.magFilter = texKits.minFilter = THREE.NearestFilter;
    uniforms.tOssos.value = texOssos; uniforms.tKits.value = texKits;
    for (const n of niveis) {
      n.slot = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
      n.slot.setUsage(THREE.DynamicDrawUsage);
      n.geo.setAttribute('iSlot', n.slot);
    }
  }
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, normalMap: texNormal, normalScale: new THREE.Vector2(0.8, 0.8) });
  mat.defines = { USE_UV: '' }; // o vUv (máscara de regiões, cabeça, número) sem um mapa de cor
  mat.onBeforeCompile = sh => remendo(sh, uniforms, true);
  mat.customProgramCacheKey = () => 'humano-v1';
  const matSombra = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  matSombra.onBeforeCompile = sh => remendo(sh, uniforms, false);
  matSombra.customProgramCacheKey = () => 'humano-sombra-v1';
  const niveis = corpo.lods.map((l, i) => {
    const geo = geometriaDoLod(l);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.customDepthMaterial = matSombra;
    mesh.frustumCulled = false;
    mesh.name = `humano-lod${i}`;
    geo.instanceCount = 0;
    cena.add(mesh);
    return { geo, mesh, tri: l.triangulos, slot: null };
  });
  capacidade(32);
  const estLod = criarEstadoLod();
  const centro = new THREE.Vector3();
  const OCULTA_OSSOS_TRONCO = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 21, 22];
  let tri = 0;

  return {
    niveis,
    get triangulos() { return tri; },
    /**
     * itens: [{pose, kit: Float32Array(16 × 4) já linear, ocultar, chave}] — o slot é a posição na lista. alturaPx: a
     * altura da tela em px reais; teto: o teto de triângulos da qualidade.
     */
    atualizar(itens, camera, alturaPx, teto) {
      capacidade(itens.length);
      const n = itens.length;
      const k = alturaPx / (2 * Math.tan((camera.fov * Math.PI) / 360));
      const alturas = estLod.alturas;
      if (alturas.length < n) estLod.alturas = new Float32Array(n * 2);
      for (let p = 0; p < n; p++) {
        const it = itens[p], po = it.pose;
        centro.set(po[3], po[4], po[5]);
        const d = Math.max(0.5, camera.position.distanceTo(centro));
        estLod.alturas[p] = (1.8 * k) / d;
        const off = p * NOSSOS * 12;
        E.pele(po, ossosF, off);
        const ocu = it.ocultar | 0;
        if (ocu) {
          const D = E.desenho;
          // escala 0 em volta de uma junta (a cabeça no pescoço; o tronco e os braços no peito): os vértices vão para a
          // junta, sem esticar até a origem do mundo
          const zerar = b => {
            const o = off + b * 12, jj = (b === 4 || b === 3 ? 3 : 2) * 3;
            ossosF[o] = ossosF[o + 1] = ossosF[o + 2] = 0; ossosF[o + 4] = ossosF[o + 5] = ossosF[o + 6] = 0; ossosF[o + 8] = ossosF[o + 9] = ossosF[o + 10] = 0;
            ossosF[o + 3] = D[jj]; ossosF[o + 7] = D[jj + 1]; ossosF[o + 11] = D[jj + 2];
          };
          if (ocu & 2) zerar(4);
          if (ocu & 4) for (const b of OCULTA_OSSOS_TRONCO) zerar(b);
        }
        kitsF.set(it.kit, p * TEXELS_KIT * 4);
      }
      texOssos.needsUpdate = true;
      texKits.needsUpdate = true;
      const esc = escolherLods(estLod, n, itens, niveis.map(nv => nv.tri), teto);
      const cont = [0, 0, 0, 0];
      for (let p = 0; p < n; p++) {
        const l = esc[p];
        niveis[l].slot.array[cont[l]++] = p;
      }
      tri = 0;
      for (let l = 0; l < niveis.length; l++) {
        niveis[l].geo.instanceCount = cont[l];
        niveis[l].mesh.visible = cont[l] > 0;
        niveis[l].slot.needsUpdate = true;
        tri += cont[l] * niveis[l].tri;
      }
    },
    definirSombras(ligadas) { for (const nv of niveis) nv.mesh.castShadow = ligadas; },
    definirCabeca(tex) { uniforms.tCabeca.value = tex; },
    dispose() {
      for (const nv of niveis) { cena.remove(nv.mesh); nv.geo.dispose(); }
      mat.dispose(); matSombra.dispose(); texOssos?.dispose(); texKits?.dispose();
    },
  };
}

/** Atlas dos dígitos 0–9 (canvas; fonte condensada e grossa, como a das camisas). */
function atlasDigitos() {
  const W = 64, H = 96;
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!cv) return null;
  cv.width = W * 10; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${H * 0.92}px "Barlow Condensed", "Arial Narrow", "Roboto Condensed", Impact, sans-serif`;
  for (let d = 0; d < 10; d++) {
    g.save(); g.translate(W * d + W / 2, H / 2 + 2); g.scale(0.82, 1); g.fillText(String(d), 0, 0); g.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
