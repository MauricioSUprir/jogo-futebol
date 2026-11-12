// Os TEXTOS dos shaders das SILHUETAS por recorte (item 45, C10; a revisão do bloco 3, `PLANO-GRAFICOS.md`): o quadro da
// torcida (e o ramo do impostor dentro dele), as bandeiras e o recorte dos letreiros. Puro (sem three.js nem DOM, fora do
// fecho do hash), como o render/gramado-shader.js: os módulos do render montam os materiais com eles e o tools/teste-gramado
// confere o shader MONTADO sem GPU — as derivadas (fwidth/dFdx/dFdy) e as leituras de textura com mip implícito antes de
// qualquer desvio do main() e nenhuma nas funções (a lição do PR #631: derivada dentro de desvio é indefinida e o SwiftShader
// do CI não acusa), o `?gfx=antigo` com o MESMO texto da main (bit a bit: o hash gravado da main e41aa791) e a troca que não
// acha o trecho avisando.
//
// O `?gfx=antigo` (a escolha D7 do dono: tudo o que é imagem do item 45 desligado) devolve os textos de antes: sem o varying
// `centroid`, a leitura pela derivada implícita, o descarte sem a compensação de alfa nas bandeiras e o alfa 1 escrito.
import { TORCIDA, CAIXA_POSE } from './torcida-dados.js';
import { ESTADO_GLSL } from './torcedor-pose.js';
import { LUZ_FALSA_GLSL } from './luz-falsa.js';
import { BANDEIRAS, BANDEIRA_GLSL, BANDEIRAO_GLSL, SOB_GLSL, LENTE_GLSL } from './bandeiras-dados.js';

/** Quanto o alfa sobe por nível do mip (a cobertura de longe): o MESMO nas bandeiras e no quadro da torcida. */
export const COMPENSA_MIP = 0.22;

// a cópia centroid da UV do quadro da torcida (o vertex do HEAD; no `?gfx=antigo`, nada)
const SILHUETA_VERT_TORCIDA = `  // a UV da amostra (centroid) é a mesma; no ramo do impostor o vUv é o canto na foto 0 (render/impostor.js: a derivada dele)
  vUvC = vUv;
`;

/**
 * Os shaders do quadro da torcida (o atlas SDF; render/torcida.js). imp (o impostor octaédrico do item 69, PR 3:
 * render/impostor-dados.js GLSL_IMPOSTOR, sob demanda) = {vertPars, vertMain, fragPars, fragTopo (no topo do main, fora de
 * desvio: o nível do mip das fotos), fragMain, antigo (os mesmos, de antes do item 45)}: o MESMO programa com um ramo por
 * torcedor (aLod: 0 o quadro, 1 o impostor) — o quadro SDF continua igual (lido no topo, pelo nível do mip da cópia sem
 * centroid); sem imp (o programa de hoje, a única coisa que a TV do celular desenha), nada do impostor. antigo
 * (`?gfx=antigo`): o texto da main, com o ramo de antes do impostor (imp.antigo). Devolve {vert, frag}.
 * A A2C do quadro (com MSAA, render/torcida.js definirAA) é uma TROCA, medida na revisão do bloco 3 (teste-graficos-pagina com
 * a cena ASSENTADA — o torcedor 3D e o impostor já chegados —, sem ela × com ela): as franjas da torcida na TV na bola (K1) 1,95 →
 * 0,33%, a A2 0,75 / 0,58 → 0,69 / 0,47 e a cintilação da silhueta com a câmera andando 0,25 px (K3) × 1,32 → × 1,28 do SSAA
 * (cobertura 0,928 → 0,934) — e, em troca, as franjas das bandeiras NA FRENTE dela (K1) 2,22 → 2,43% na TV na bola e 0,26 →
 * 0,65% com o gol no foco, e 1 px de franja da torcida com o gol no foco (0 → 0,06%). (O "× 1,20 → × 0,88" do C10 era a cena
 * antes do torcedor 3D chegar.) A derivada do alfa da A2C vem da leitura na UV centroid; a variante pela leitura na vUv (sem
 * a imprecisão de borda do centroid, uma leitura a mais) foi medida na revisão do bloco 3 e não ganha: K3 igual (0,934, 5,87%),
 * A2 da TV na bola E 0,0624 → 0,0626 e as franjas das bandeiras 2,43 → 2,49%.
 */
export function shaderTorcida(imp = null, { antigo = false } = {}) {
  if (antigo && imp) imp = imp.antigo ?? imp;
  const vert = /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec4 aPos;
attribute vec4 aCamisa;
attribute vec4 aPele;
attribute vec4 aCabelo;
attribute vec4 aInfo;
attribute float aOculto;
uniform vec4 uLuz;
uniform vec3 uCamPos;
uniform vec3 uAcento0;
uniform vec3 uAcento1;
varying vec2 vUv;
${antigo ? '' : 'centroid varying vec2 vUvC;\n'}varying vec3 vCamisa;
varying vec3 vPele;
varying vec3 vCabelo;
varying vec3 vAcento;
varying float vLuz;
varying float vAltura;
varying vec3 vFlare;
vec3 lin(vec3 c) { return c * c * (0.3 + 0.7 * c); }
${ESTADO_GLSL}
${LUZ_FALSA_GLSL}
const vec2 CAIXA[${CAIXA_POSE.length}] = vec2[${CAIXA_POSE.length}](${CAIXA_POSE.map(([w, h]) => `vec2(${w.toFixed(3)}, ${h.toFixed(3)})`).join(', ')});
${imp ? imp.vertPars : ''}
void main() {
  // o torcedor desenhado em 3D (render/torcedor3d.js, os blocos perto da câmera) sai do quadro: nada a rasterizar
  if (aOculto > 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float time = step(0.5, aInfo.x);
  float setor = floor(aInfo.y * 3.0 + 0.5);
  float h = aPele.w;
  float h2 = aInfo.w;
  // a pose, o pulo e o balanço: a MESMA conta do torcedor 3D (render/torcedor-pose.js ESTADO_GLSL: a regra de
  // torcida-dados.js POSE_REGRA, a ola de festa.js e o bandeirão de bandeiras-dados.js; a organizada no relógio da
  // batucada — pula no surdo da gravação quando o som toca)
  vec3 est = torcedorEstado(aPos.xyz, h, aInfo);
  float pose = est.x;
  float pulo = est.y;
  float bal = est.z;
  vCamisa = lin(aCamisa.rgb);
  vPele = lin(aPele.rgb);
  vCabelo = lin(aCabelo.rgb);
  vAcento = time > 0.5 ? uAcento1 : uAcento0;
  vFlare = luzFalsa(aPos.xyz + vec3(0.0, 1.2, 0.0));
  vec4 mvPosition;
  ${imp ? `vImpModo = step(0.5, aLod);
  if (aLod > 0.5) {
${imp.vertMain}
  } else {` : '{'}
    // virado para a câmera, girando só em volta do eixo vertical
    vec3 paraCam = uCamPos - aPos.xyz;
    paraCam.y = 0.0;
    vec3 dir = normalize(paraCam + vec3(1e-4, 0.0, 0.0));
    vec3 dirX = vec3(dir.z, 0.0, -dir.x);
    float esc = aPos.w;
    // o quadro encolhe para a caixa da pose (fração da célula): qx em −w/2…w/2, qy em 0…h
    vec2 cx = CAIXA[int(pose + 0.5)];
    float qx = position.x * cx.x;
    float qy = position.y * cx.y;
    vec3 p = aPos.xyz + dirX * (qx * ${TORCIDA.largura.toFixed(3)} * esc + bal)
           + vec3(0.0, qy * ${TORCIDA.altura.toFixed(3)} * esc + pulo, 0.0)
           + dir * (h2 - 0.5) * 0.08;
    mvPosition = viewMatrix * vec4(p, 1.0);
    vUv = vec2((pose + qx + 0.5) / ${TORCIDA.quadros}.0, qy);
    float luz = setor < 0.5 ? uLuz.x : (setor < 1.5 ? uLuz.y : (setor < 2.5 ? uLuz.z : uLuz.w));
    vLuz = luz * (0.88 + 0.24 * fract(h * 7.31));
    vAltura = qy;
  }
${antigo ? '' : SILHUETA_VERT_TORCIDA}  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
  const frag = antigo ? /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uAtlas;
uniform vec2 uTamAtlas;
varying vec2 vUv;
varying vec3 vCamisa;
varying vec3 vPele;
varying vec3 vCabelo;
varying vec3 vAcento;
varying float vLuz;
varying float vAltura;
varying vec3 vFlare;
${imp ? imp.fragPars : ''}
void main() {
  vec3 cor;
  ${imp ? `if (vImpModo > 0.5) {
${imp.fragMain}
  } else {` : '{'}
    vec4 t = texture2D(uAtlas, vUv);
    // cobertura preservada de longe (mipmap tira opacidade das partes finas): sobe o alfa pelo nível do
    // mipmap (Castaño, "Computing Alpha Mipmaps"; Golus, "Anti-aliased Alpha Test")
    vec2 d = fwidth(vUv * uTamAtlas);
    float nivel = max(0.0, log2(max(max(d.x, d.y), 1e-4)));
    float a = t.a * (1.0 + 0.22 * nivel);
    if (a < 0.5) discard;
    vec3 w = t.rgb / max(t.a, 0.004);
    float ac = max(0.0, 1.0 - w.r - w.g - w.b);
    cor = w.r * vCamisa + w.g * vPele + w.b * vCabelo + ac * vAcento;
    // a fileira da frente faz sombra nas pernas; o resto pela luz do setor
    cor *= vLuz * (0.68 + 0.32 * smoothstep(0.08, 0.7, vAltura)) + vFlare;
  }
  gl_FragColor = vec4(cor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
` : /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uAtlas;
uniform vec2 uTamAtlas;
varying vec2 vUv;
centroid varying vec2 vUvC;
varying vec3 vCamisa;
varying vec3 vPele;
varying vec3 vCabelo;
varying vec3 vAcento;
varying float vLuz;
varying float vAltura;
varying vec3 vFlare;
${imp ? imp.fragPars : ''}
void main() {
  // (item 45, C10; PLANO-GRAFICOS.md passo 5) a SILHUETA com MSAA: o pixel da borda é sombreado no centro dele, que pode ficar
  // fora do triângulo (a UV extrapolada sai da caixa da pose e lê o vizinho do atlas: o N11). A UV da AMOSTRA vem num varying
  // centroid (vUvC: dentro da parte coberta do pixel) e as DERIVADAS (o nível do mip da compensação e o da leitura) da cópia SEM
  // centroid (vUv). Medido (teste-graficos-pagina, a A2 por categoria): lida pela derivada IMPLÍCITA da entrada centroid, a
  // torcida da TV ficava mais longe do SSAA (os quadros de 2×2 com um pixel de borda deslocado erram o mip). As derivadas e a
  // leitura no TOPO, fora de qualquer desvio (a lição do PR #631), pelo nível dado (textureLod: o atlas é isotrópico, a conta é a
  // do GL — ρ = o maior comprimento das derivadas em texels —, e o textureGrad pesa no celular).
  // A cobertura preservada de longe (o mipmap tira opacidade das partes finas): sobe o alfa pelo nível do mipmap (Castaño,
  // "Computing Alpha Mipmaps"; Golus, "Anti-aliased Alpha Test")
  vec2 d = fwidth(vUv * uTamAtlas);
  float nivel = max(0.0, log2(max(max(d.x, d.y), 1e-4)));
  vec2 dSx = dFdx(vUv * uTamAtlas), dSy = dFdy(vUv * uTamAtlas);
  vec4 tSdf = textureLod(uAtlas, vUvC, 0.5 * log2(max(max(dot(dSx, dSx), dot(dSy, dSy)), 1e-8)));
  float aSdf = tSdf.a * (1.0 + ${COMPENSA_MIP.toFixed(2)} * nivel);
  float saidaA = 1.0;
  #ifdef ALPHA_TO_COVERAGE
  // com MSAA (definirAA), o alfa para cobertura afiado pela derivada do próprio alfa (Golus, "Anti-aliased Alpha Test": a borda
  // de ~1 px em volta do limiar 0,5 vira fração das amostras): medido na seção K, a cintilação da silhueta com a câmera andando
  // 0,25 px cai (2,25 → 1,62%, abaixo da do SSAA) sem a cobertura cair
  float cobSdf = (aSdf - 0.5) / max(fwidth(aSdf), 1e-4) + 0.5;
  #endif
${imp ? (imp.fragTopo ?? '') : ''}
  vec3 cor;
  ${imp ? `if (vImpModo > 0.5) {
${imp.fragMain}
  } else {` : '{'}
    vec4 t = tSdf;
    #ifdef ALPHA_TO_COVERAGE
    if (cobSdf <= 0.0) discard;
    saidaA = clamp(cobSdf, 0.0, 1.0);
    #else
    if (aSdf < 0.5) discard;
    #endif
    vec3 w = t.rgb / max(t.a, 0.004);
    float ac = max(0.0, 1.0 - w.r - w.g - w.b);
    cor = w.r * vCamisa + w.g * vPele + w.b * vCabelo + ac * vAcento;
    // a fileira da frente faz sombra nas pernas; o resto pela luz do setor
    cor *= vLuz * (0.68 + 0.32 * smoothstep(0.08, 0.7, vAltura)) + vFlare;
  }
  gl_FragColor = vec4(cor, saidaA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
  return { vert, frag };
}

// (item 45, C10) A SILHUETA das bandeiras com MSAA: o pixel da borda é sombreado no CENTRO dele, que pode ficar fora do
// triângulo — a UV de lá sai do retângulo da peça e lia a célula vizinha do atlas (a linha verde-clara no alto das faixas da
// mureta: o N11). A UV da AMOSTRA vem num varying `centroid` (dentro da parte coberta do pixel; GLSL ES 3.00 §4.3) e as
// DERIVADAS (a da leitura e o nível do mip da compensação) da cópia SEM centroid. Medido (teste-graficos-pagina K1, as franjas
// da borda na TV na bola): 13,4% sem centroid; 11,8% com a UV centroid lida pela derivada IMPLÍCITA dela (o quadro de 2×2 com
// um pixel de borda deslocado erra o mip: a faixa ganhava uma linha escura em cima); 2,2% com a derivada da cópia sem centroid.
// textureGrad (e não textureLod): o atlas tem anisotropia 4 (as faixas dos fundos vistas de lado). A leitura com mip e as
// derivadas no TOPO, fora de qualquer desvio (a lição do PR #631). A COBERTURA de longe: como a torcida, o alfa sobe pelo nível
// do mip (Castaño, "Computing Alpha Mipmaps"; Golus, "Anti-aliased Alpha Test") — sem isso a bandeira e o mastro somem aos
// pedaços de longe — e a cor sai da média do mip sem o preto das células vazias do atlas (o canvas guarda o transparente como
// preto: o mip da borda é a cor × a cobertura). uCompensa 0 = a peça "física" (o gancho dos testes: graficos.fisico, as
// referências SSAA). O alfa ESCRITO é 1 (a revisão do bloco 3): a peça é opaca (o descarte faz o recorte, sem mistura nem
// A2C), e o buffer do canvas TEM alfa — o three r170 pede o contexto sempre com alpha true (o `alpha: false` do renderizador
// só vale para a limpeza) e um alfa < 1 escrito deixava translúcida qualquer cópia do canvas (o png dos testes, toDataURL).
// O alfa para cobertura (a fórmula do Golus, como no quadro da torcida) não tem efeito medido aqui (a revisão do bloco 3:
// com a A2C nas bandeiras a K1, a K2 e a A2 saíram iguais em todos os dígitos; as bordas destas peças são as do retângulo, a
// geometria que o MSAA já trata). A piora das franjas das bandeiras do C10 (K1 2,22 → 2,43% na TV na bola e 0,26 → 0,61%
// com o gol no foco) vem da A2C do QUADRO DA TORCIDA atrás delas, a troca que ela faz (render/torcida.js).
/** Os shaders das faixas, bandeiras e bandeirões (render/bandeiras.js). antigo (`?gfx=antigo`): o texto da main. {vert, frag}. */
export function shaderBandeiras({ antigo = false } = {}) {
  const vert = /* glsl */`
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
uniform vec4 uLente;
varying vec2 vUv;
${antigo ? '' : 'centroid varying vec2 vUvC;\n'}varying float vLuz;
varying vec3 vFlare;
${BANDEIRA_GLSL}
${BANDEIRAO_GLSL}
${SOB_GLSL}
${LENTE_GLSL}
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
    // perto da lente da câmera da bola parada ela também abaixa (bandeiras-dados.js alturaPelaLente; uLente.w 0 fora dela)
    l *= (1.0 - sob) * alturaPelaLente(position, uLente);
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
${antigo ? '' : '  vUvC = uv;\n'}  vLuz = uLuz.x + uLuz.y * abs(dot(n, uSol));
  vFlare = luzFalsa(p);
  #include <fog_vertex>
}
`;
  const frag = antigo ? /* glsl */`
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
` : /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uAtlas;
uniform vec2 uTamAtlas;
uniform float uCompensa;
varying vec2 vUv;
centroid varying vec2 vUvC;
varying float vLuz;
varying vec3 vFlare;
void main() {
  vec2 gx = dFdx(vUv), gy = dFdy(vUv);
  vec4 t = textureGrad(uAtlas, vUvC, gx, gy);
  vec2 d = abs(gx * uTamAtlas) + abs(gy * uTamAtlas);
  float nivel = max(0.0, log2(max(max(d.x, d.y), 1e-4)));
  float a = t.a * (1.0 + ${COMPENSA_MIP.toFixed(2)} * nivel * uCompensa);
  if (a < 0.5) discard;
  gl_FragColor = vec4(t.rgb / max(t.a, 0.004) * (vLuz + vFlare), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
  return { vert, frag };
}

/**
 * A troca do alphatest_fragment do r170 (onBeforeCompile: os #include ainda FECHADOS, a lição do PR #631) pelo alfa para
 * cobertura CENTRADO no limiar (Golus, "Anti-aliased Alpha Test": a = (a − limiar) / fwidth(a) + 0,5 — metade das amostras no
 * limiar, como o descarte), limitado a [0, 1] como o do r170 (o smoothstep); sem ALPHA_TO_COVERAGE, o descarte de sempre. Dentro
 * do `#ifdef USE_ALPHATEST`, como o pedaço do r170: com o alphaTest a 0 o uniform `alphaTest` nem existe (a revisão do bloco 3).
 * A derivada fica fora de desvio de execução (o #ifdef é do pré-processador).
 */
export const TROCA_RECORTE = Object.freeze([['#include <alphatest_fragment>', `#ifdef USE_ALPHATEST
  #ifdef ALPHA_TO_COVERAGE
  diffuseColor.a = clamp((diffuseColor.a - alphaTest) / max(fwidth(diffuseColor.a), 1e-4) + 0.5, 0.0, 1.0);
  if (diffuseColor.a == 0.0) discard;
  #else
  if (diffuseColor.a < alphaTest) discard;
  #endif
#endif`]]);
