// Luz FALSA dos sinalizadores (desenho): sem three.js nem DOM. Uma PointLight de verdade mudaria a chave de
// programa de TODOS os materiais iluminados do three.js r170 (WebGLPrograms: numPointLights entra na chave) e
// recompilaria os shaders no meio do gol; aqui a luz vermelha é uma conta no shader da torcida, da arquibancada e das
// bandeiras, com as posições num uniform vec4[8] (xyz e a força; força negativa = sinalizador branco, o do setor
// visitante). Sem sinalizador aceso, uFlareN = 0 e a conta nem roda.
import { FESTA, fogoSinalizador } from './festa.js';

export const LUZ_FALSA = {
  max: FESTA.sinalizadores.max,
  raio: 7,                        // m — a luz cai à metade a esta distância
  forca: 1.5,
  altura: 1.9,                    // m acima da base do torcedor (o fogo na mão levantada)
  vermelho: [1.0, 0.3, 0.12], branco: [0.95, 0.93, 0.9],
};

/** Uniforms compartilhados (o mesmo objeto em todos os materiais): uFlare (vec4[8]) e uFlareN (quantos acesos). */
export const UNIFORMS_LUZ = { uFlare: { value: new Float32Array(4 * LUZ_FALSA.max) }, uFlareN: { value: 0 } };

/** Escreve a luz dos sinalizadores acesos agora (festa.js) nos uniforms. Devolve quantos estão acesos. */
export function atualizarLuzFalsa(festa, t, alvo = UNIFORMS_LUZ.uFlare.value) {
  let n = 0;
  const fl = festa ? festa.flares : [];
  for (let k = 0; k < LUZ_FALSA.max; k++) {
    const s = fl[k];
    const f = s ? fogoSinalizador(s, t) : 0;
    alvo[4 * k] = s ? s.x : 0; alvo[4 * k + 1] = s ? s.y + LUZ_FALSA.altura : 0; alvo[4 * k + 2] = s ? s.z : 0;
    alvo[4 * k + 3] = f > 0 ? (s.cor ? -f : f) : 0;
    if (f > 0) n++;
  }
  if (alvo === UNIFORMS_LUZ.uFlare.value) UNIFORMS_LUZ.uFlareN.value = n;
  return n;
}

/** Luz (rgb) que chega num ponto p — a MESMA conta do GLSL. */
export function luzFalsaEm(uFlare, p) {
  const L = LUZ_FALSA, out = [0, 0, 0];
  for (let k = 0; k < L.max; k++) {
    const w = uFlare[4 * k + 3];
    if (w === 0) continue;
    const dx = p[0] - uFlare[4 * k], dy = p[1] - uFlare[4 * k + 1], dz = p[2] - uFlare[4 * k + 2];
    const a = Math.abs(w) / (1 + (dx * dx + dy * dy + dz * dz) / (L.raio * L.raio)) * L.forca;
    const c = w > 0 ? L.vermelho : L.branco;
    out[0] += a * c[0]; out[1] += a * c[1]; out[2] += a * c[2];
  }
  return out;
}

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/** uniform vec4 uFlare[8]; uniform float uFlareN; vec3 luzFalsa(vec3 p). */
export const LUZ_FALSA_GLSL = (() => {
  const L = LUZ_FALSA;
  return `
uniform vec4 uFlare[${L.max}];
uniform float uFlareN;
vec3 luzFalsa(vec3 p) {
  vec3 c = vec3(0.0);
  if (uFlareN < 0.5) return c;
  for (int i = 0; i < ${L.max}; i++) {
    vec4 f = uFlare[i];
    if (f.w == 0.0) continue;
    vec3 d = p - f.xyz;
    float a = abs(f.w) / (1.0 + dot(d, d) / ${g(L.raio * L.raio)}) * ${g(L.forca)};
    c += a * (f.w > 0.0 ? vec3(${L.vermelho.map(g).join(', ')}) : vec3(${L.branco.map(g).join(', ')}));
  }
  return c;
}
`;
})();
