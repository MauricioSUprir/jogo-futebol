// Os TEXTOS do shader do gramado, do chão de fora e das linhas do campo (item 45; a revisão do C4–C8, `PLANO-GRAFICOS.md`):
// puro (sem three.js nem DOM, fora do fecho do hash), para o `render/campo.js` montar os materiais e o `tools/teste-gramado.mjs`
// conferir o shader MONTADO sem GPU — as derivadas (explícitas, fwidth/dFdx/dFdy, e implícitas, a leitura de textura com mip)
// antes de qualquer desvio (a lição do PR #631: derivada dentro de desvio é indefinida e o SwiftShader do CI não acusa), o
// `?gfx=antigo` com o MESMO texto e a mesma chave da main (bit a bit) e as chaves do cache distintas.
//
// Cada montagem devolve as TROCAS no texto do three (`vertex` e `fragment`: listas de [de, para], aplicadas em ordem, a 1ª
// ocorrência de cada `de`, como o `String.replace` de antes) e a `chave` do `customProgramCacheKey`. `aplicarTrocas` faz as
// trocas e AVISA no console quando não acha o trecho: nunca um replace calado (um `#include` renomeado numa versão nova do
// three deixaria o shader sem a troca, em silêncio).
import { CAMPO } from '../config.js';
import { GRAMADO_GLSL, glslTopoGramado, GRAMADO_GASTO, GRAMADO_ENTORNO, PROFUNDIDADE_GLSL } from './gramado.js';

/** O poço de luz da noite (o gramado, o entorno e as linhas): mais claro no meio e caindo para as bordas. `tools/lib/cor-aces.mjs`
 *  tem a cópia e o `--auto` a confere pelo texto deste arquivo. */
export const LUZ_NOITE_GLSL = `
  float luzNoite(vec2 p) {
    vec2 q = vec2(p.x / 62.0, p.y / 41.0);
    float r2 = q.x * q.x * 0.75 + q.y * q.y;
    return mix(1.04, 0.5, smoothstep(0.3, 1.35, r2));
  }`;

const glf = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const glv3 = a => `vec3(${a.map(glf).join(', ')})`;

/** O x e o z do mundo no fragment (o vertex do gramado, do chão de fora e, com o aCruz, das linhas). */
const VERTEX_MUNDO = Object.freeze([
  ['#include <common>', '#include <common>\nvarying vec2 vMundoXZ;'],
  ['#include <project_vertex>', '#include <project_vertex>\nvMundoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'],
]);

/** O grão (a textura de detalhe em duas escalas) e o poço de luz da noite, por cima da cor (o fim do bloco do map_fragment). */
const GRAO_E_NOITE = `
          float d1 = texture2D(uDetalhe, vMundoXZ * 0.55).r;
          float d2 = texture2D(uDetalhe, vMundoXZ * 0.137 + 0.31).r;
          float d = d1 * d2 * 4.0;
          diffuseColor.rgb *= mix(1.0, d, uForca);
          diffuseColor.rgb *= mix(1.0, luzNoite(vMundoXZ), uNoite);`;

/**
 * O gramado e o chão de fora de ANTES do item 45 (só o `?gfx=antigo`): o grão e o poço de luz da noite por cima da cor do
 * material/textura. O MESMO texto de shader e a mesma chave da main (o teste-gramado confere pelo hash gravado da main).
 */
export function shaderGramadoAntigo(forca) {
  return {
    vertex: VERTEX_MUNDO,
    fragment: [
      ['#include <common>', '#include <common>\nuniform sampler2D uDetalhe;\nuniform float uForca;\nuniform float uNoite;\nvarying vec2 vMundoXZ;' + LUZ_NOITE_GLSL],
      ['#include <map_fragment>', `#include <map_fragment>
        {${GRAO_E_NOITE}
        }`],
    ],
    chave: 'grama-detalhe-' + forca,
  };
}

/**
 * O gramado no shader (item 45, passos 2 e 3 do plano): o grão e o poço da noite de antes e, com `faixas`, a cor inteira do
 * gramado pela conta (render/gramado.js) — as 18 faixas da UEFA pelo x do mundo (o filtro de caixa sobre o degrau), o desgaste
 * (o G da textura das manchas leva a cor para a do desgaste), as manchas (o R: × (1 + uManchas·(n − 0,5)), só luminância) e o
 * entorno fora das linhas ×0,88 (filtrado pela pegada do pixel). As derivadas (o `fwidth(vMundoXZ)`, uma vez só) no TOPO do
 * bloco, antes de qualquer conta, e o bloco sem desvio. Sem `faixas` (o chão de fora), só o grão e a noite por cima da cor do
 * material. Com `profundidade` (no gramado e no chão de fora, o MESMO texto: sem emenda nos cantos), no fim do bloco, a
 * profundidade relativa ao foco (render/gramado.js PROFUNDIDADE_GLSL), sem derivada nem desvio.
 */
export function shaderGramado(forca, { faixas = false, profundidade = false } = {}) {
  const cor = faixas ? `
          vec2 gramadoFw = fwidth(vMundoXZ);
          ${glslTopoGramado('vMundoXZ.x', 'gramadoFw.x')}
          float gramadoFora = clamp(max((abs(vMundoXZ.x) - ${glf(CAMPO.meioX)}) / max(gramadoFw.x, 1e-4), (abs(vMundoXZ.y) - ${glf(CAMPO.meioZ)}) / max(gramadoFw.y, 1e-4)) + 0.5, 0.0, 1.0);
          vec3 gramadoCor = mix(mix(uClara, uEscura, gramadoT), ${glv3(GRAMADO_GASTO)}, sampledDiffuseColor.g);
          diffuseColor.rgb = gramadoCor * (1.0 + uManchas * (sampledDiffuseColor.r - 0.5)) * mix(1.0, ${glf(GRAMADO_ENTORNO)}, gramadoFora);` : '';
  const prof = profundidade ? `
          diffuseColor.rgb = gramadoProfundidade(diffuseColor.rgb, gramadoG(cameraPosition, vMundoXZ), uGFoco, uRasante);` : '';
  return {
    vertex: VERTEX_MUNDO,
    fragment: [
      ['#include <common>', '#include <common>\nuniform sampler2D uDetalhe;\nuniform float uForca;\nuniform float uNoite;\nvarying vec2 vMundoXZ;'
        + LUZ_NOITE_GLSL + (faixas || profundidade ? GRAMADO_GLSL : '') + (profundidade ? PROFUNDIDADE_GLSL : '')],
      // o sampledDiffuseColor é a textura das manchas (R manchas, G desgaste) que o map_fragment do three acabou de ler
      ['#include <map_fragment>', `#include <map_fragment>
        {${cor}${GRAO_E_NOITE}${prof}
        }`],
    ],
    chave: 'grama-detalhe-' + forca + (faixas ? '-faixas' : '') + (profundidade ? '-prof' : '') + '-v2',
  };
}

/**
 * As linhas do campo (um mesh só, antisserrilhado analítico pela distância ao eixo, `vCruz`). `branco` = as linhas mais
 * brancas do item 45 (o C7: × uBrancoLinha no albedo; o ACES do r170 acinzentava o branco). Sem `branco` (o `?gfx=antigo`), o
 * texto e a chave da main. Com `branco`, a leitura do grão vem ANTES do `discard` (a revisão do C4–C8: a leitura de textura com
 * mip deriva a UV na quadra de pixels, e depois de um `discard` condicional isso é indefinido no GLSL ES 3.00 — o ANGLE no
 * Vulkan traduz o `discard` por OpKill); o resultado de cada pixel que fica é o mesmo.
 */
export function shaderLinhas({ branco = false } = {}) {
  const cobertura = `
          // cobertura analítica da linha no pixel; abaixo de ~1,5 px a linha não afina mais,
          // só fica mais transparente (não some nem pisca à distância)
          float w = max(fwidth(vCruz), 1e-5);
          float hw = max(uMeia, 0.75 * w);
          float cob = clamp((hw - abs(vCruz)) / w + 0.5, 0.0, 1.0) * (uMeia / hw);
          diffuseColor.a *= cob;`;
  const bloco = branco ? `
        {${cobertura}
          float d = texture2D(uDetalhe, vMundoXZ * 0.55).r * 2.0;
          if (diffuseColor.a < 0.004) discard;
          diffuseColor.rgb *= mix(1.0, d, 0.35);
          diffuseColor.rgb *= mix(1.0, luzNoite(vMundoXZ), uNoite);
          diffuseColor.rgb *= uBrancoLinha;
        }
        #include <alphatest_fragment>` : `
        {${cobertura}
          if (diffuseColor.a < 0.004) discard;
          float d = texture2D(uDetalhe, vMundoXZ * 0.55).r * 2.0;
          diffuseColor.rgb *= mix(1.0, d, 0.35);
          diffuseColor.rgb *= mix(1.0, luzNoite(vMundoXZ), uNoite);
        }
        #include <alphatest_fragment>`;
  return {
    vertex: [
      ['#include <common>', '#include <common>\nattribute float aCruz;\nvarying float vCruz;\nvarying vec2 vMundoXZ;'],
      ['#include <project_vertex>', '#include <project_vertex>\nvCruz = aCruz;\nvMundoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'],
    ],
    fragment: [
      ['#include <common>', '#include <common>\nuniform float uMeia;\nuniform sampler2D uDetalhe;\nuniform float uNoite;\nvarying float vCruz;\nvarying vec2 vMundoXZ;'
        + (branco ? '\nuniform float uBrancoLinha;' : '') + LUZ_NOITE_GLSL],
      ['#include <alphatest_fragment>', bloco],
    ],
    chave: branco ? 'linhas-aa-branco' : 'linhas-aa',
  };
}

/** Aplica as trocas [de, para] em ordem (a 1ª ocorrência de cada `de`) e AVISA (`avisar`, padrão console.error) quando não
 *  acha o trecho: o shader sai sem aquela troca, mas nunca em silêncio. */
export function aplicarTrocas(texto, trocas, onde, avisar = msg => console.error(msg)) {
  let t = texto;
  for (const [de, para] of trocas) {
    if (!t.includes(de)) avisar(`campo: a troca de "${de}" não achou o trecho (${onde}) — o shader saiu sem ela`);
    t = t.replace(de, () => para);
  }
  return t;
}
