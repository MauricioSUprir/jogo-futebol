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
const TEXELS_KIT = 32;

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
varying vec4 vMembro; // pesos: braço + antebraço (abaixo da clavícula), mão, canela+pé, coxa
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
// x: o braço abaixo da clavícula (braço, antebraço e o ajudante do cotovelo) — a manga comprida do goleiro e do técnico cobre o
// braço inteiro, como no manequim (R2 da revisão do item 77: só com o antebraço sobrava uma faixa de pele entre o punho da
// manga curta e o cotovelo, que abria quando a IK da mão de apoio dobrava o braço no carrinho)
vMembro = vec4(pesoEm(7.0, 11.0) + pesoEm(6.0, 10.0) + pesoEm(21.0, 22.0), pesoEm(8.0, 12.0), pesoEm(14.0, 17.0) + pesoEm(15.0, 18.0) + pesoEm(19.0, 20.0), pesoEm(13.0, 16.0));
`;
const DECL_F = `
uniform highp sampler2D tKits;
uniform sampler2D tReg;
uniform sampler2D tCabeca;
uniform highp sampler2DArray tRostos;
uniform highp sampler2DArray tLogos;
uniform sampler2D tDigitos;
uniform vec4 uNumero; // caixa do número das costas na UV (u0, v0, u1, v1)
varying vec3 vRest;
varying float vParte;
varying float vSlot;
varying vec4 vMembro;
vec4 kit(int i) { return texelFetch(tKits, ivec2(i, int(vSlot + 0.5)), 0); }
// SEM DERIVADA DENTRO DE DESVIO (item 63, "retângulos tracejados brancos em volta dos números e patrocínios"): a derivada
// implícita (texture() com mipmap, dFdx, fwidth) dentro de fluxo NÃO UNIFORME é indefinida (GLSL ES 3.00 §8.9) — a região
// pela máscara, a caixa do decalque e a célula do dígito mudam de pixel para pixel, e a GPU de verdade (celular, ANGLE
// sobre D3D/Metal) que achata o desvio pega um mip qualquer nos quads da borda: o traço de 2 px, um quad sim, outro não,
// na cor do logo ou do número. As derivadas saem no TOPO do COR_F (fluxo uniforme) e as leituras com mipmap vão por
// textureGrad com o gradiente de cada projeção (todas afins na posição de repouso ou na UV; a cabeça, por textureLod com o
// nível da mesma derivada: lodUv). As mesmas leituras de antes (nenhuma a mais).
// (Stack Overflow 53734640, "get the derivatives outside"; Khronos, VK_KHR_shader_quad_control: o LoD indefinido dentro
// do if não uniforme)
vec3 gRx, gRy; // dFdx/dFdy da posição de repouso
vec2 gUx, gUy; // dFdx/dFdy da UV
float fwR(vec3 k) { return abs(dot(k, gRx)) + abs(dot(k, gRy)); } // fwidth(dot(k, vRest)) sem derivada no desvio
// o nível do mip de uma textura de lado tam lida pela UV (a conta do GLSL ES 3.00 §3.8.10: λ = log2 ρ, ρ = o maior
// comprimento da derivada da UV em texels): a CABEÇA (todo pixel dela; o rosto e a cabeça não têm anisotropia) lê por
// textureLod com ele — o textureGrad é mais lento que o texture() e o textureLod nas GPUs de celular (Arm, "Texture
// sampling performance": "do not use textureGrad() unless necessary"); os logos e os dígitos (poucos pixels, o logo com
// anisotropia 4) ficam no textureGrad (R1-1 da revisão)
float lodUv(vec2 tam) { vec2 a = gUx * tam, b = gUy * tam; return 0.5 * log2(max(max(dot(a, a), dot(b, b)), 1e-12)); }
float aa(float x, float w) { return smoothstep(-w, w, x); }
// padrões da camisa pela posição de repouso (x = frente, y = cima, z = direita; a camisa vai da barra em y 1,03 à gola em
// 1,50, com ~0,2 m de meia largura)
float padrao(float tipo, float n, float larg) {
  vec3 p = vRest;
  if (tipo < 0.5) return 0.0;
  if (tipo < 1.5) {                      // listras verticais: n listras da 2ª cor de frente, largura larg do tronco
    float per = 0.40 / max(n, 1.0);
    float x = p.z / per;                 // 0 no meio do peito
    float f = abs(fract(x + 0.5) - 0.5); // 0 no meio da faixa da 1ª cor... (o meio do peito é da 1ª cor)
    float w = clamp(larg * 0.40 / per, 0.05, 0.95) * 0.5;
    float fw = fwR(vec3(0.0, 0.0, 1.0 / per)) + 1e-4;
    return aa(f - (0.5 - w), fw);
  }
  if (tipo < 2.5) {                      // aros: a camisa (barra → ombro) em 2n + 1 faixas iguais, a 2ª cor nas ímpares
    float k = (2.0 * max(n, 1.0) + 1.0) / 0.44;
    float t = (p.y - 1.03) * k;
    float m = mod(t, 2.0), a = fwR(vec3(0.0, k, 0.0)) + 1e-4;
    float c = smoothstep(1.0 - a, 1.0 + a, m) * (1.0 - smoothstep(2.0 - a, 2.0, m));
    // o corte de cima fica a meia rampa ANTES do fim: no t → 2n + 1 o m → 1⁻ começava a faixa seguinte (c ≈ 0,5) e
    // sobrava um fio de 1 px da 2ª cor no alto das costas
    return t < 0.0 || t > 2.0 * max(n, 1.0) + 1.0 - a ? 0.0 : c;
  }
  if (tipo < 3.5) {                      // faixa diagonal: do ombro esquerdo (z < 0, alto) ao quadril direito
    float d = ((p.y - 1.25) + 1.0 * p.z) * 0.7071;
    float w = max(larg, 0.08) * 0.20;
    return aa(w - abs(d), fwR(vec3(0.0, 0.7071, 0.7071)) + 1e-4);
  }
  if (tipo < 4.5) {                      // faixa horizontal no peito
    float d = p.y - 1.32;
    float w = max(larg, 0.08) * 0.25;
    return aa(w - abs(d), fwR(vec3(0.0, 1.0, 0.0)) + 1e-4);
  }
  return aa(p.z, fwR(vec3(0.0, 0.0, 1.0)) + 1e-4);    // metades (direita na 2ª cor)
}
// q em [0, 1]² dentro da célula do dígito (y para cima); dx, dy: a derivada de q na tela
float digito(float d, vec2 q, vec2 dx, vec2 dy) {
  return textureGrad(tDigitos, vec2((d + q.x) / 10.0, q.y), dx * vec2(0.1, 1.0), dy * vec2(0.1, 1.0)).r;
}
// PATROCÍNIOS (só a versão de teste da edição pro): até 6 decalques por uniforme nas linhas 17–28 do kit — A = [camada do
// logo, posição, largura (m), largura ÷ altura], B = [cor, lado]. Projeção plana na posição de REPOUSO (x frente, y cima,
// z direita do jogador), só na face virada para o plano (a normal de repouso pela derivada da tela); a máscara do logo
// (512 × 256, o desenho centrado e encaixado) pinta a cor do patrocínio na camisa. dx, dy: a derivada de uv na tela (a
// leitura vai por textureGrad: ver "SEM DERIVADA DENTRO DE DESVIO")
float decalLogo(vec4 A, vec2 uv, vec2 dx, vec2 dy) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  float asp = max(A.w, 0.05);
  vec2 kk = vec2(min(1.0, asp / 2.0), min(1.0, 2.0 / asp));
  return textureGrad(tLogos, vec3(0.5 + (uv - 0.5) * kk, A.x), dx * kk, dy * kk).r;
}
vec3 decais(vec3 cor, int reg) {
  vec3 p = vRest;
  vec3 nR = normalize(cross(gRx, gRy));
  for (int i = 0; i < 6; i++) {
    vec4 A = kit(17 + 2 * i);
    if (A.x < 0.5) continue;
    vec4 B = kit(18 + 2 * i);
    int pos = int(A.y + 0.5), lado = int(B.w + 0.5);
    float w = A.z, h = A.z / max(A.w, 0.05);
    float m = 0.0;
    if (pos == 3) {                                   // manga: a face de fora do braço (no repouso o braço desce ~45°)
      if (reg != 2) continue;
      float s = p.z >= 0.0 ? 1.0 : -1.0;
      if ((lado == 1 && s > 0.0) || ((lado == 0 || lado == 2) && s < 0.0)) continue;
      vec3 eixo = normalize(vec3(0.0, -0.22, 0.21 * s)), fora = normalize(vec3(0.0, 0.69, 0.72 * s));
      if (dot(nR, fora) < 0.2) continue;
      vec3 c = vec3(0.0, 1.375, 0.215 * s), d = p - c;
      m = decalLogo(A, vec2(0.5 + s * d.x / w, 0.5 - dot(d, eixo) / h),
        vec2(s * gRx.x / w, -dot(gRx, eixo) / h), vec2(s * gRy.x / w, -dot(gRy, eixo) / h));
    } else if (pos == 5 || pos == 6) {                // costas: em cima e embaixo do número
      if (reg != 1 || nR.x > -0.25) continue;
      float cy = pos == 5 ? 1.43 : 1.09;
      m = decalLogo(A, vec2(0.5 + p.z / w, 0.5 + (p.y - cy) / h), vec2(gRx.z / w, gRx.y / h), vec2(gRy.z / w, gRy.y / h));
    } else {                                          // de frente: peito, ombro, barra, calção, fornecedor
      if (nR.x < 0.25) continue;
      if (pos == 7) { if (reg != 5) continue; } else if (reg != 1) continue;
      float cy = pos == 1 ? 1.27 : pos == 2 ? 1.44 : pos == 4 ? 1.12 : pos == 7 ? 0.95 : 1.40;
      float cz = 0.0;
      if (pos == 2) cz = (lado == 1 ? -0.085 : lado == 2 ? 0.085 : (p.z >= 0.0 ? 0.085 : -0.085));
      if (pos == 7) cz = lado == 2 ? 0.085 : -0.085;  // o calção: na perna esquerda (o padrão)
      if (pos == 8) cz = 0.085;                       // a marca do fornecedor: no peito direito (o escudo fica no esquerdo)
      m = decalLogo(A, vec2(0.5 - (p.z - cz) / w, 0.5 + (p.y - cy) / h), vec2(-gRx.z / w, gRx.y / h), vec2(-gRy.z / w, gRy.y / h));
    }
    cor = mix(cor, B.rgb, m);
  }
  return cor;
}
`;
const COR_F = `
{
  gRx = dFdx(vRest); gRy = dFdy(vRest); gUx = dFdx(vUv); gUy = dFdy(vUv); // no fluxo uniforme (item 63)
  vec3 cor;
  if (vParte > 0.5) {
    float camada = kit(13).w;
    if (camada > 0.5) {
      cor = textureLod(tRostos, vec3(vUv, camada), lodUv(vec2(textureSize(tRostos, 0).xy))).rgb; // o rosto do próprio jogador (a foto levada à pele da cabeça)
    } else {
      vec4 tc = textureLod(tCabeca, vUv, lodUv(vec2(textureSize(tCabeca, 0))));
      vec3 pele = kit(11).rgb, tomRB = vec3(0.78, 0.55, 0.43);
      // a pele da cabeça do Rocketbox no tom do jogador (o cabelo e as sobrancelhas escuros quase não mudam)
      float lum = dot(tc.rgb, vec3(0.299, 0.587, 0.114));
      float ehPele = smoothstep(0.18, 0.32, lum);
      cor = mix(tc.rgb, tc.rgb * pele / tomRB, ehPele);
    }
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
      else cor = decais(cor, 1);
      // número das costas
      if (vRest.x < -0.02 && est.z > 0.5 && vUv.x > uNumero.x && vUv.x < uNumero.z && vUv.y > uNumero.y && vUv.y < uNumero.w) {
        vec2 sz = uNumero.zw - uNumero.xy;
        vec2 q = 1.0 - (vUv - uNumero.xy) / sz;           // o número do original está de cabeça para baixo na UV
        vec2 dx = -gUx / sz * vec2(2.0, 1.0), dy = -gUy / sz * vec2(2.0, 1.0); // a derivada da célula (2 por caixa)
        float num = est.z, dz = floor(num / 10.0), un = num - dz * 10.0;
        float t = 0.0;
        if (dz > 0.5) {
          if (q.x < 0.5) t = digito(dz, vec2(q.x * 2.0, q.y), dx, dy); else t = digito(un, vec2(q.x * 2.0 - 1.0, q.y), dx, dy);
        } else if (q.x > 0.25 && q.x < 0.75) t = digito(un, vec2((q.x - 0.25) * 2.0, q.y), dx, dy);
        cor = mix(cor, kit(14).rgb, t);
      }
    } else if (r == 2) cor = decais(mix(kit(2).rgb, k1.rgb, pad.w > 0.5 ? padrao(pad.x, pad.y, pad.z) : 0.0), 2);
    else if (r == 3) cor = kit(3).rgb;
    else if (r == 4) cor = kit(4).rgb;
    else if (r == 5) cor = decais(kit(5).rgb, 5);
    else if (r == 6) cor = kit(6).rgb;
    else if (r == 7) {                                    // meião (a faixa do meio do cano, se houver)
      cor = kit(7).rgb;
      vec4 md = kit(16);
      if (md.a > 0.5) cor = mix(cor, md.rgb, aa(0.035 - abs(vRest.y - 0.30), fwR(vec3(0.0, 1.0, 0.0)) + 1e-4));
    }
    else if (r == 8) cor = kit(8).rgb;
    else cor = kit(15).rgb;                               // sola
  }
  diffuseColor.rgb = cor;
}
`;

// A CABEÇA sem o mapa de normais do PANO (item 62, "linha escura na nuca"): o pano-normal.webp é o do corpo do Rocketbox;
// lido pela UV da cabeça, as costuras e dobras do molde do corpo viravam vincos nela — um arco escuro de orelha a orelha,
// uma faixa e um "V" na nuca, rugas no rosto. O onBeforeCompile vê o shader com os #include ainda FECHADOS (o
// WebGLProgram os abre depois: a troca de 'mapN.xy *= normalScale;' no texto do material não achava nada e passava calada),
// então o include inteiro sai pelo trecho aberto, com a normal da malha na cabeça (mapN = (0, 0, 1): normal = tbn[2] = N).
// (fórum do three.js, "How to change size of normalMap": a mesma troca do include pelo trecho expandido)
const NORMAL_MAPS_F = trocar(THREE.ShaderChunk.normal_fragment_maps, 'mapN.xy *= normalScale;',
  'mapN.xy *= normalScale;\n\tmapN = mix(mapN, vec3(0.0, 0.0, 1.0), vParte); // a cabeça: a normal da malha', 'normal_fragment_maps');

/** texto.replace(de, para) que AVISA no console quando `de` não está no texto (a troca que falha calada: item 62). */
function trocar(texto, de, para, onde) {
  if (!texto.includes(de)) console.error(`humano3d: a troca de "${de}" não achou o trecho (${onde}) — o shader do corpo saiu sem ela`);
  return texto.replace(de, para);
}

function remendo(sh, uniforms, cor) {
  Object.assign(sh.uniforms, uniforms);
  let v = sh.vertexShader;
  v = trocar(v, '#include <common>', '#include <common>\n' + DECL_V, 'vertex');
  v = trocar(v, '#include <beginnormal_vertex>', NORMAL_V, 'vertex');
  // a sombra (MeshDepthMaterial) só tem a normal com displacementMap: a pele entra junto com a posição
  v = trocar(v, '#include <begin_vertex>', cor ? POS_V : PELE_V + POS_V, 'vertex');
  sh.vertexShader = v;
  if (cor) {
    let f = sh.fragmentShader;
    f = trocar(f, '#include <common>', '#include <common>\n' + DECL_F, 'fragment');
    f = trocar(f, '#include <color_fragment>', '#include <color_fragment>\n' + COR_F, 'fragment');
    f = trocar(f, '#include <normal_fragment_maps>', NORMAL_MAPS_F, 'fragment');
    sh.fragmentShader = f;
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
    tCabeca: { value: opc.cabeca ?? null }, tDigitos: { value: atlasDigitos() }, tRostos: { value: null }, tLogos: { value: null },
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
  mat.customProgramCacheKey = () => 'humano-v3';
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
  // rostos reais (edição pro): uma DataArrayTexture com uma camada por jogador da partida (a 0 fica vazia: a cabeça do
  // Rocketbox); a camada entra quando a imagem chega (versaoRostos muda e a fachada reescreve as linhas do uniforme)
  const LADO_R = opc.qualidade === 'alta' ? 512 : 256, CAMADAS = 40;
  const rost = { indice: null, camadas: new Map(), pendentes: new Set(), prox: 1, versao: 0, dados: null, tex: null };
  function texRostos() {
    if (rost.tex) return rost.tex;
    rost.dados = new Uint8Array(LADO_R * LADO_R * 4 * CAMADAS);
    rost.tex = new THREE.DataArrayTexture(rost.dados, LADO_R, LADO_R, CAMADAS);
    rost.tex.colorSpace = THREE.SRGBColorSpace;
    rost.tex.generateMipmaps = true;
    rost.tex.minFilter = THREE.LinearMipmapLinearFilter; rost.tex.magFilter = THREE.LinearFilter;
    rost.tex.needsUpdate = true;
    uniforms.tRostos.value = rost.tex;
    return rost.tex;
  }
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  // patrocínios (versão de teste): as máscaras dos logos (512 × 256, um canal) numa DataArrayTexture, uma camada por logo
  // dos uniformes da partida (a 0 fica vazia); a camada entra quando a imagem chega (versaoLogos)
  const LW = 512, LH = 256, CAM_LOGOS = 40;
  const logos = { camadas: new Map(), pendentes: new Set(), prox: 1, versao: 0, dados: null, tex: null };
  function texLogos() {
    if (logos.tex) return logos.tex;
    logos.dados = new Uint8Array(LW * LH * CAM_LOGOS);
    logos.tex = new THREE.DataArrayTexture(logos.dados, LW, LH, CAM_LOGOS);
    logos.tex.format = THREE.RedFormat; logos.tex.type = THREE.UnsignedByteType;
    logos.tex.generateMipmaps = true; logos.tex.unpackAlignment = 1;
    logos.tex.minFilter = THREE.LinearMipmapLinearFilter; logos.tex.magFilter = THREE.LinearFilter;
    logos.tex.anisotropy = 4;
    logos.tex.needsUpdate = true;
    uniforms.tLogos.value = logos.tex;
    return logos.tex;
  }
  async function carregarLogo(url, camada) {
    const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
    if (!cv) return;
    cv.width = LW; cv.height = LH;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, LW, LH);
    g.setTransform(1, 0, 0, -1, 0, LH); // a linha 0 dos dados é o v = 0 (embaixo)
    g.drawImage(img, 0, 0, LW, LH);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const px = g.getImageData(0, 0, LW, LH).data;
    texLogos();
    const o = camada * LW * LH;
    for (let i = 0; i < LW * LH; i++) logos.dados[o + i] = px[i * 4 + 3];
    if (logos.tex.addLayerUpdate) logos.tex.addLayerUpdate(camada);
    logos.tex.needsUpdate = true;
    logos.camadas.set(url, camada);
    logos.versao++;
  }
  async function carregarRosto(chave, url, camada) {
    const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
    if (!cv) return;
    cv.width = cv.height = LADO_R;
    const g = cv.getContext('2d', { willReadFrequently: true });
    // a DataArrayTexture não vira a imagem (sem flipY em 3D): a linha 0 dos dados é o v = 0 (embaixo)
    g.setTransform(1, 0, 0, -1, 0, LADO_R);
    g.drawImage(img, 0, 0, LADO_R, LADO_R);
    const px = g.getImageData(0, 0, LADO_R, LADO_R).data;
    texRostos();
    rost.dados.set(px, camada * LADO_R * LADO_R * 4);
    // só a camada nova sobe para a GPU (sem isso, cada rosto que chegava subia as 40 camadas: ~42 MB por rosto na Alta)
    if (rost.tex.addLayerUpdate) rost.tex.addLayerUpdate(camada);
    rost.tex.needsUpdate = true;
    rost.camadas.set(chave, camada);
    rost.versao++;
  }
  const estLod = criarEstadoLod();
  const centro = new THREE.Vector3();
  const OCULTA_OSSOS_TRONCO = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 21, 22];
  let tri = 0;

  return {
    niveis,
    get triangulos() { return tri; },
    /**
     * itens: [{pose, kit: Float32Array(16 × 4) já linear, ocultar, chave, v (m/s), postura (0–1)}] — o slot é a posição na
     * lista (v e postura: a postura do desenho, esqueleto.js pele). alturaPx: a
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
        E.pele(po, ossosF, off, it.v, it.postura);
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
    /** As juntas DESENHADAS da pose po (a postura do desenho por cima: esqueleto.js postura), em out (NJ·3). */
    postura(po, v, peso, out) { return E.postura(po, v, peso, out); },
    /** O índice dos rostos reais ({chave: {nome, pele, foto}}) e a pasta das texturas (edição pro). */
    definirRostos(indice, base) { rost.indice = indice; rost.base = base; },
    /** A pele (o tom da foto) do rosto real desta chave, ou null. */
    peleDe(chave) { return (chave && rost.indice?.[chave]?.pele) || null; },
    /** A camada do rosto real desta chave (0 = ainda não chegou ou não há; pede a carga na 1ª vez). */
    camadaDe(chave) {
      if (!chave || !rost.indice?.[chave]) return 0;
      const c = rost.camadas.get(chave);
      if (c != null) return c;
      if (!rost.pendentes.has(chave) && rost.prox < CAMADAS) {
        rost.pendentes.add(chave);
        const camada = rost.prox++;
        carregarRosto(chave, new URL(chave + '.webp', rost.base).href, camada).catch(e => console.warn('rosto', chave, e));
      }
      return 0;
    },
    get versaoRostos() { return rost.versao; },
    /** A camada da máscara do logo desta URL (0 = ainda não chegou; pede a carga na 1ª vez). Versão de teste da pro. */
    logoDe(url) {
      if (!url) return 0;
      const c = logos.camadas.get(url);
      if (c != null) return c;
      if (!logos.pendentes.has(url) && logos.prox < CAM_LOGOS) {
        logos.pendentes.add(url);
        carregarLogo(url, logos.prox++).catch(e => console.warn('patrocínio', url, e));
      }
      return 0;
    },
    get versaoLogos() { return logos.versao; },
    get logos() { return { carregados: logos.camadas.size, pedidos: logos.pendentes.size }; },
    get rostos() { return { indice: !!rost.indice, carregados: rost.camadas.size, pedidos: rost.pendentes.size }; },
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
