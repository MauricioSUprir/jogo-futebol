// Gramado (desenho; item 45, plano em `golaco/PLANO-GRAFICOS.md` passo 2, pesquisa em `PESQUISA-ESTADIO.md` §19): a conta
// PURA (sem three.js nem DOM, fora do fecho do hash) das faixas de corte, usada igual pelo fragment shader do gramado (o
// `GRAMADO_GLSL`, gerado daqui com as MESMAS constantes; o C6 do plano liga no `render/campo.js`) e pelos testes em Node
// (`tools/teste-gramado.mjs`, que avalia o texto GLSL num interpretador mínimo e o compara com as funções JS). O modelo é o
// `render/rede-onda.js` ("a conta pura testada em Node e GPU = JS").
//
// As faixas (UEFA Pitch Quality Guidelines 2025, §4.3.1 "Mowing and pitch presentation", pp. 21–22, Fig. 15): "The first
// four bands of the pitch should always be exactly 5.5m wide. The five remaining bands in each half should then be of a
// uniform width, finishing at the halfway line (on 105m pitches these bands will be 6.10m wide …)". Por metade, a partir
// de cada linha de fundo, as bordas ficam a {0; 5,5; 11; 16,5; 22; 28,1; 34,2; 40,3; 46,4; 52,5} m: a pequena área (5,5),
// a marca do pênalti (11) e a grande área (16,5) caem em bordas. São 18 faixas no campo; a paridade é GLOBAL: a faixa 1
// (junto ao gol da esquerda, x = −52,5) é clara, a 9 (junto da linha do meio, à esquerda) clara, a 10 escura e a 18 (junto
// ao gol da direita) escura. Atrás das linhas de fundo a alternância continua com faixas de 5,5 m (índices −1, −2, … e
// 18, 19, …). As faixas são sempre iguais, sem inverter pela vista (escolha D4 do dono).
//
// O degrau entre as faixas é filtrado por uma CAIXA de largura w = fwidth(x) + uBorda (a pegada do pixel no chão, mais a
// borda macia do corte, `BORDA_CORTE`): t = mix(0,5; p; clamp(2·dB/w; 0; 1)), com p a paridade da faixa (0 clara, 1
// escura) e dB a distância à borda mais perto. É a média exata do degrau na caixa enquanto só uma borda cai nela (w < 5,5 m)
// e 0,5 em cima da borda, dos dois lados: t é contínuo, e a faixa que um arredondamento do float põe do outro lado da borda
// não aparece. No shader as derivadas ficam no TOPO do bloco, fora de qualquer desvio (lição do PR #631: derivada dentro de
// desvio é indefinida); as funções do `GRAMADO_GLSL` não derivam nada, recebem o w pronto (`glslTopoGramado`).
//
// A conta das faixas é sem desvio (step/mix), igual nas duas versões: u = 52,5 − |x| (a distância à linha de fundo do lado
// de x, negativa atrás dela); até 22 m as faixas de 5,5 m, depois as 5 de 6,1 m; o índice dentro da metade m = 0…8 a partir
// da linha de fundo; o global I = m na metade da esquerda (x < 0) e 17 − m na da direita (x ≥ 0).
//
// As cores (passo 2 do plano): albedos LINEARES da faixa clara, da escura e do chão de fora, pela inversa EXATA do ACES do
// r170 (`tools/lib/cor-aces.mjs` `albedoPara`) para a luz do dia no chão: o verde realista (escolha D1 do dono) — na tela
// L 0,58, C 0,10, h 124°, ΔL das faixas 0,056 (a foto). Conferidas pela MEDIDA da página no C6 (`teste-graficos-celular`,
// SwiftShader do CI, celular Média de dia): L 0,575, C 0,100, h 124,0°, ΔL 0,056 perto do foco; os albedos do modelo ficaram
// (com as faixas de antes o modelo dava ΔL 0,104 e a página 0,099; com estas, o modelo 0,0560 e a página 0,056). A noite usa
// o MESMO albedo (a luz dos refletores e o poço mudam a cor na tela; a seção N do `teste-graficos-celular` prevê a noite pelo
// albedo do dia), por isso a tabela é por hora mas as cores são as mesmas.
import { CAMPO } from '../config.js';

/** As faixas da UEFA (§4.3.1, Fig. 15): as primeiras `primeiras` de `primeira` m a partir de cada linha de fundo (também a
 *  largura das faixas atrás dela), o resto da metade em faixas iguais até a linha do meio; `porMetade` faixas por metade. */
export const UEFA_FAIXAS = Object.freeze({ primeira: 5.5, primeiras: 4, porMetade: 9 });

const MEIO = CAMPO.meioX;                                   // 52,5: da linha de fundo à do meio
const L1 = UEFA_FAIXAS.primeira;                            // 5,5
const N1 = UEFA_FAIXAS.primeiras;                           // 4
const U0 = N1 * L1;                                         // 22: onde começam as faixas largas
const N2 = UEFA_FAIXAS.porMetade - N1;                      // 5
const L2 = (MEIO - U0) / N2;                                // 6,1 (num campo de 105 m)
const ULTIMO = 2 * UEFA_FAIXAS.porMetade - 1;               // 17: o índice global da faixa junto ao gol da direita

/** As bordas por metade, em m a partir da linha de fundo: {0; 5,5; 11; 16,5; 22; 28,1; 34,2; 40,3; 46,4; 52,5}. */
export const BORDAS_METADE = Object.freeze([
  ...Array.from({ length: N1 + 1 }, (_, k) => k * L1),
  ...Array.from({ length: N2 }, (_, k) => (k === N2 - 1 ? MEIO : U0 + (k + 1) * L2)),
]);

/** O número de faixas no campo (entre as linhas de fundo). */
export const FAIXAS_NO_CAMPO = 2 * UEFA_FAIXAS.porMetade;

/** A borda macia do corte (m): somada à pegada do pixel no filtro de caixa (o uniform `uBorda`). */
export const BORDA_CORTE = 0.10;

/** As bordas das faixas no campo, em x (m), em ordem: −52,5 … 52,5 (19 valores; o 0 é a linha do meio). */
export function bordasX() {
  const esq = BORDAS_METADE.map(b => -MEIO + b);
  const dir = BORDAS_METADE.slice(0, -1).map(b => MEIO - b).reverse();
  return [...esq, ...dir];
}

const step = (borda, v) => (v < borda ? 0 : 1);
const mix = (a, b, t) => a * (1 - t) + b * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, b) => a - b * Math.floor(a / b);

/**
 * A faixa de corte no x (m) do mundo: {indice (global: 0 = a faixa 1, junto ao gol da esquerda; 17 = a 18; < 0 e > 17
 * atrás das linhas de fundo), paridade (0 clara, 1 escura), claro, distBorda (m até a borda mais perto, ≥ 0)}. A MESMA
 * conta do `gramadoFaixa` do `GRAMADO_GLSL`. Em cima de uma borda o índice é o de um dos dois lados (o filtro dá 0,5 nos
 * dois). Escreve em `out` (opcional) e o devolve.
 */
export function faixaEm(x, out = {}) {
  const u = MEIO - Math.abs(x);
  const s = step(U0, u);
  const L = mix(L1, L2, s);
  const u0 = U0 * s;
  // na linha do meio (u = 52,5) a conta daria a 6ª faixa larga: fica na 5ª (o min com 4; as estreitas vão só até 3)
  const k = Math.min(Math.floor((u - u0) / L), N2 - 1);
  const a = u0 + k * L;
  const dB = Math.max(Math.min(u - a, a + L - u), 0);
  const m = k + N1 * s;
  const I = mix(m, ULTIMO - m, step(0, x));
  const p = mod(I, 2);
  out.indice = I;
  out.paridade = p;
  out.claro = p === 0;
  out.distBorda = dB;
  return out;
}

/** O filtro de caixa de largura w sobre o degrau: a fração da faixa ESCURA (0 = só a clara, 1 = só a escura). p = paridade
 *  da faixa do ponto, dB = a distância à borda mais perto. */
export function misturaFaixa(p, dB, w) {
  return mix(0.5, p, clamp(2 * dB / w, 0, 1));
}

const _f = {};
/** t no x (m), com a pegada do pixel `fw` (o fwidth(x) do shader, dado) e a borda macia (padrão `BORDA_CORTE`). */
export function misturaEm(x, fw, borda = BORDA_CORTE) {
  faixaEm(x, _f);
  return misturaFaixa(_f.paridade, _f.distBorda, fw + borda);
}

// ------------------------------------------------------------------ cores e parâmetros por hora

/** Albedos lineares (r, g, b) da faixa clara (#6b7f45), da escura (#61723a) e do chão de fora (#47541d): a inversa do ACES
 *  do r170 com a luz do dia no chão para L 0,607 / 0,551 / 0,404, C 0,10 / 0,10 / 0,09, h 124° (`cor-aces` `albedoPara`). */
const CLARA = Object.freeze([0.148459, 0.211222, 0.059445]);
const ESCURA = Object.freeze([0.119089, 0.168344, 0.042002]);
const FORA = Object.freeze([0.063303, 0.089402, 0.012024]);

/**
 * Por hora: as cores (albedos lineares; a noite com o MESMO albedo do dia), `manchas` (o `uManchas`, só luminância: ±8,5% de
 * albedo nos extremos da textura das manchas; calibrado pela G6 no C6 com o ruído de texturas.js MANCHAS_GRAMADO — σL 0,0101
 * em 58 blocos de 8 m, meta 0,010 ± 0,004; com o ponto de partida 0,10 dava 0,0060 e a textura de antes 0,0054), `rasante`
 * (a profundidade relativa ao foco, o `uRasante`: 0,22 de dia e a metade à noite, calibrado pela G4 no C7) e `brancoLinha`
 * (o fator das linhas, o `uBrancoLinha`: pelo modelo, o pico da linha 0,952 de dia com 1,8 e à noite, no meio do poço de luz,
 * com 1,9; calibrado pela G5 no C7).
 */
export const GRAMADO_HORAS = Object.freeze({
  dia: Object.freeze({ clara: CLARA, escura: ESCURA, fora: FORA, manchas: 0.17, rasante: 0.22, brancoLinha: 1.8 }),
  noite: Object.freeze({ clara: CLARA, escura: ESCURA, fora: FORA, manchas: 0.17, rasante: 0.11, brancoLinha: 1.9 }),
});

/** O desgaste (a boca dos gols, a marca do pênalti, a frente da área e o círculo central; o quanto, no G da textura das
 *  manchas): a cor amarelada para onde o albedo vai, linear (#8c8454: com a força de antes na boca do gol, 0,32, a mesma
 *  mudança da textura de antes na tela — L +0,019, h −7,6° pela luz do dia e o ACES). */
export const GRAMADO_GASTO = Object.freeze([0.262251, 0.230740, 0.088656]);

/** O entorno (fora das linhas): o fator do albedo (a textura de antes punha 12% de verde-escuro por cima; aqui ×0,88 no
 *  albedo, ΔL ~0,03 na tela: a mesma metade do contraste das faixas que o de antes tinha das faixas de antes). */
export const GRAMADO_ENTORNO = 0.88;

/** Os nomes dos uniforms do gramado (os do `GRAMADO_GLSL`). `uGFoco` = o g da profundidade no ponto do chão no meio da
 *  tela, calculado por quadro (C7). */
export const UNIFORMS_GRAMADO = Object.freeze(['uClara', 'uEscura', 'uManchas', 'uRasante', 'uBrancoLinha', 'uBorda', 'uGFoco']);

/** Os valores iniciais dos uniforms numa hora ('dia' | 'noite'): {uClara: [r, g, b], uEscura, uManchas, uRasante,
 *  uBrancoLinha, uBorda, uGFoco}. */
export function valoresGramado(hora = 'dia') {
  const H = GRAMADO_HORAS[hora] ?? GRAMADO_HORAS.dia;
  return {
    uClara: [...H.clara], uEscura: [...H.escura], uManchas: H.manchas, uRasante: H.rasante,
    uBrancoLinha: H.brancoLinha, uBorda: BORDA_CORTE, uGFoco: 0,
  };
}

// ------------------------------------------------------------------ o GLSL (gerado das mesmas constantes)

const f = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/**
 * GLSL da mesma conta (para depois do `#include <common>` do fragment shader): os uniforms e
 * `vec2 gramadoFaixa(float x)` → (índice global, distância à borda) e `float gramadoMistura(vec2 faixa, float w)` → t
 * (0 clara, 1 escura). Nenhuma derivada aqui dentro: o w vem pronto do topo do bloco (`glslTopoGramado`).
 */
export const GRAMADO_GLSL = `
uniform vec3 uClara;
uniform vec3 uEscura;
uniform float uManchas;
uniform float uRasante;
uniform float uBrancoLinha;
uniform float uBorda;
uniform float uGFoco;
vec2 gramadoFaixa(float x) {
  float u = ${f(MEIO)} - abs(x);
  float s = step(${f(U0)}, u);
  float L = mix(${f(L1)}, ${f(L2)}, s);
  float u0 = ${f(U0)} * s;
  float k = min(floor((u - u0) / L), ${f(N2 - 1)});
  float a = u0 + k * L;
  float dB = max(min(u - a, a + L - u), 0.0);
  float m = k + ${f(N1)} * s;
  return vec2(mix(m, ${f(ULTIMO)} - m, step(0.0, x)), dB);
}
float gramadoMistura(vec2 faixa, float w) {
  return mix(0.5, mod(faixa.x, 2.0), clamp(2.0 * faixa.y / w, 0.0, 1.0));
}
`;

/**
 * As linhas do TOPO do bloco do shader (antes de qualquer desvio): a derivada e o t das faixas no x do mundo `x` (uma
 * expressão GLSL, p.ex. 'vMundoXZ.x'). Declaram `gramadoW` e `gramadoT`.
 */
export function glslTopoGramado(x) {
  return `float gramadoW = fwidth(${x}) + uBorda;\nfloat gramadoT = gramadoMistura(gramadoFaixa(${x}), gramadoW);`;
}
