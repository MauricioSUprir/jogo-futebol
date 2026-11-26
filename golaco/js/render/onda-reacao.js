// A ONDA da reação da torcida (item 47 da FILA; conta PURA, sem three.js nem DOM): no gol e na chance a reação não chega
// a todos no mesmo instante — nasce no lance e anda pelo estádio. O estado (os lances em andamento, com a origem, a idade e
// os níveis de ANTES de cada um) é de emocao.js (est.ondas, uniformsOnda); aqui fica a conta de CADA torcedor, a mesma em
// JS (niveisPelaOnda: testes) e no vertex shader (ONDA_GLSL, dentro de render/torcedor-pose.js ESTADO_GLSL — o quadro de
// hoje, o ramo do impostor e o torcedor 3D chamam a mesma torcedorEstado()):
//   atraso = reação (pela semente: 0,18–0,4 s) + distância (no chão) do lugar ao lance / vel (100 m/s);
//   a onda mais nova JÁ CHEGOU (idade ≥ atraso): os níveis de agora, vistos com o atraso dele — os que só caem (excita
//     depois de segurar, lamento, palmas: e^(−t/τ) do emocao.js) voltam e^(atraso/τ) (a reação dele é a de quem acabou de
//     ver o lance, não a de quem viu atrasado); depois de chegar, o atraso some em `recupera` s (o tempo dele anda um
//     pouco mais depressa até alcançar o de todos: sem pulo); a tensão (que sobe e desce pela bola) fica a de agora;
//   não chegou: os níveis de ANTES dela — da mais nova que já chegou nele, ou os de antes da mais velha.
// Vaga sem onda (w = 0) = já chegou em todos (com os uniforms zerados — o padrão da GPU — nada muda).
// Fontes (PESQUISA-ESTADIO.md §6.4): o tempo de reação visual (~180–200 ms; Thompson et al., em Jain et al. 2015) e o
// sonoro (~140–160 ms); a velocidade do som (343 m/s: o grito de quem está perto do gol chega ao outro lado em ~0,4 s); a
// ola de Farkas, Helbing e Vicsek (Nature 419, 2002: ~12 m/s, ~20 cadeiras/s — a ola é COMBINADA, cada um espera o
// vizinho; o gol é estímulo direto, mais rápido); a animação por instância com dados de baixa frequência em constantes
// (GPU Gems 3, cap. 2; Gosselin, Sander e Mitchell, "Drawing a Crowd", ShaderX3): o lance em uniforms, nada por torcedor
// na CPU.
import { EMOCAO } from './emocao.js';

const fract = x => x - Math.floor(x);
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
// a semente do tempo de reação: misturada das duas do torcedor (h decide quem levanta com menos ânimo e h2 o gesto; a
// reação fica sem ligação com elas)
const MISTURA = [3.17, 11.3];

/** O tempo de reação (s) do torcedor de sementes h e h2 (0–1). */
export function reacaoTorcedor(h, h2) {
  const R = EMOCAO.onda.reacao;
  return R[0] + (R[1] - R[0]) * fract(h * MISTURA[0] + h2 * MISTURA[1]);
}

/** O atraso (s) do torcedor em (x, z) para o lance em (ox, oz): a reação + a distância / vel. */
export function atrasoOnda(x, z, ox, oz, r) {
  return r + Math.hypot(x - ox, z - oz) / EMOCAO.onda.vel;
}

/**
 * Os níveis que o torcedor em (x, z), de sementes h e h2, do time `time` (0 | 1), vê agora: n = [excita, tensão,
 * lamento, palmas] do time dele (os de agora); O e A = os uniforms da onda (emocao.js uniformsOnda: Float32Array 4·vagas
 * e 8·vagas). Devolve out = [excita, tensão, lamento, palmas]. A MESMA conta de ONDA_GLSL (torcidaOnda).
 */
export function niveisPelaOnda(x, z, h, h2, time, n, O, A, out = [0, 0, 0, 0]) {
  const E = EMOCAO, V = E.onda.vagas;
  const r = reacaoTorcedor(h, h2);
  const d0 = atrasoOnda(x, z, O[0], O[1], r);
  if (O[3] < 0.5 || O[2] >= d0) {
    // a mais nova chegou: o de agora, com o atraso dele (que some em `recupera` s depois de chegar)
    const dl = O[3] < 0.5 ? 0 : d0 * clamp01(1 - (O[2] - d0) / E.onda.recupera);
    out[0] = Math.min(1, n[0] * Math.exp(dl / E.golCai));
    out[1] = n[1];
    out[2] = Math.min(1, n[2] * Math.exp(dl / E.lamentoTau));
    out[3] = Math.min(1, n[3] * Math.exp(dl / E.palmasTau));
    return out;
  }
  // não chegou: o "antes" da mais nova que ainda não chegou nele (a seguinte, mais velha, já chegou — ou é a última)
  let k = V - 1;
  for (let j = 1; j < V; j++) {
    if (O[4 * j + 3] < 0.5 || O[4 * j + 2] >= atrasoOnda(x, z, O[4 * j], O[4 * j + 1], r)) { k = j - 1; break; }
  }
  const t = time >= 0.5 ? 1 : 0;
  out[0] = A[8 * k + t]; out[1] = A[8 * k + 2 + t]; out[2] = A[8 * k + 4 + t]; out[3] = A[8 * k + 6 + t];
  return out;
}

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/**
 * Os uniforms e vec4 torcidaOnda(vec2 xz, float h, float h2, float time, vec4 n) → (excita, tensão, lamento, palmas):
 * a MESMA conta de niveisPelaOnda. uOndaO[vagas] = (x, z, idade, ativa) e uOndaA[2·vagas] = os níveis de antes.
 */
export const ONDA_GLSL = (() => {
  const E = EMOCAO, O = E.onda, V = O.vagas, R = O.reacao;
  // o "antes" da vaga k que ainda não chegou: do mais novo (k = 0) ao mais velho
  const ramos = [];
  for (let j = 1; j < V; j++) {
    ramos.push(`${j > 1 ? 'else ' : ''}if (uOndaO[${j}].w < 0.5 || uOndaO[${j}].z >= r + length(xz - uOndaO[${j}].xy) / ${g(O.vel)}) { a = uOndaA[${2 * (j - 1)}]; b = uOndaA[${2 * (j - 1) + 1}]; }`);
  }
  ramos.push(`else { a = uOndaA[${2 * (V - 1)}]; b = uOndaA[${2 * (V - 1) + 1}]; }`);
  return `
uniform vec4 uOndaO[${V}];
uniform vec4 uOndaA[${2 * V}];
vec4 torcidaOnda(vec2 xz, float h, float h2, float time, vec4 n) {
  float r = ${g(R[0])} + ${g(R[1] - R[0])} * fract(h * ${g(MISTURA[0])} + h2 * ${g(MISTURA[1])});
  float d0 = r + length(xz - uOndaO[0].xy) / ${g(O.vel)};
  if (uOndaO[0].w < 0.5 || uOndaO[0].z >= d0) {
    float dl = uOndaO[0].w < 0.5 ? 0.0 : d0 * clamp(1.0 - (uOndaO[0].z - d0) / ${g(O.recupera)}, 0.0, 1.0);
    return vec4(min(1.0, n.x * exp(dl / ${g(E.golCai)})), n.y, min(1.0, n.z * exp(dl / ${g(E.lamentoTau)})), min(1.0, n.w * exp(dl / ${g(E.palmasTau)})));
  }
  vec4 a, b;
  ${ramos.join('\n  ')}
  return vec4(mix(a.x, a.y, time), mix(a.z, a.w, time), mix(b.x, b.y, time), mix(b.z, b.w, time));
}
`;
})();
