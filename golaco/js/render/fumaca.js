// Fumaça dos sinalizadores (dados): conta PURA (sem three.js nem DOM) do caminho de cada partícula — nasce no fogo
// enquanto ele queima, sobe ~1 m/s, o vento leva para FORA do campo, cresce de 0,8 para 3,6 m e some. A MESMA conta no
// JS (testes: nenhuma partícula entra no campo) e no vertex shader (FUMACA_GLSL; sinalizadores.js), a partir só de
// (sinalizador, índice, tempo): nada é simulado na CPU por quadro. Referência (PESQUISA-ESTADIO.md §6): a fumaça em
// quadros instanciados do fórum do three.js ("Smoke Effect - InstancedMesh2"), aqui com o nascimento e o caminho no
// shader; overdraw contido (Arm Mali: cada camada translúcida custa um pixel inteiro) — poucas partículas, alfa ≤ 0,4.

export const FUMACA = {
  vida: 7,                      // s de cada partícula
  sobe: 1.0,                    // m/s
  vento: 0.9,                   // m/s para fora do campo (na direção do centro do campo → sinalizador)
  tam: [0.8, 3.6],              // m (nasce → morre)
  alfa: 0.4,
  porQualidade: { baixa: 0, media: 10, alta: 14 },
  fogo: 1.9,                    // m acima da base do torcedor
  // o fogo (sinalizadores.js): o NÚCLEO num quadro de nucleo·(0,85 + 0,25·força) m e o HALO num quadro de halo m, os dois
  // centrados no fogo (a luz falsa: luz-falsa.js LUZ_FALSA.altura)
  nucleo: 0.9, halo: 6,
  // perto da LENTE da câmera da bola parada (render/plano-bola-parada.js; a do escanteio sobe 8 m atrás do cobrador, até em
  // cima das fileiras da frente da arquibancada de lá — item 66, onde ficam as quinas da festa.js): cada quadro (o núcleo, o
  // halo e cada partícula de fumaça) com a borda a menos de `raio` m da lente some, e de `raio` a `raio` + `folga` volta aos
  // poucos (a força do fogo e o alfa da fumaça) — só nesse plano (main.js; forcaPelaLente). Revisão R2 do item 65, como as
  // bandeiras de mastro (bandeiras-dados.js BANDEIRAS.lente): no Golaço a quina ficava a 3–4 m da lente e a fumaça dela
  // passava por ela (um véu em todo o quadro, por cima da bola); com 9 + 3 o que sobra fica a ≥ 9,5 m e ≤ 4,1% do quadro
  // nos 106 estádios × 4 cantos × corrida (teste-camera G5; com 9 + 2, como as bandeiras, o halo de 6 m passava de 5%)
  lente: { raio: 9, folga: 3 },
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function frac(x) { return x - Math.floor(x); }

/**
 * Quanto um quadro do sinalizador (o núcleo, o halo ou uma partícula de fumaça: centro c = [x, y, z], raio r m) fica com a
 * lente L = [x, y, z, liga] da câmera da bola parada: 1 inteiro, 0 apagado (multiplica a força do fogo / o alfa da fumaça).
 * liga ≤ 0 (fora desse plano): 1. A MESMA conta de LENTE_FUMACA_GLSL.
 */
export function forcaPelaLente(c, r, L) {
  if (!L || !(L[3] > 0)) return 1;
  const { raio, folga } = FUMACA.lente, d = Math.hypot(c[0] - L[0], c[1] - L[1], c[2] - L[2]);
  return clamp((d - r - raio) / folga, 0, 1);
}

/**
 * Partícula p (0…P−1) da fumaça do sinalizador s ({ativo, t0, dur, x, y, z, semente}) no tempo t: {x, y, z, tam,
 * alfa} ou null (ainda não nasceu, já sumiu ou o sinalizador apagou antes de ela nascer).
 */
export function fumacaParticula(s, p, P, t) {
  if (!s || !s.ativo || P <= 0) return null;
  const F = FUMACA, L = F.vida;
  const off = (p / P) * L;
  const rel = t - s.t0 - off;
  if (rel < 0) return null;
  const nasc = s.t0 + off + Math.floor(rel / L) * L;
  if (nasc > s.t0 + s.dur) return null;
  const idade = t - nasc;
  if (idade < 0 || idade >= L) return null;
  const k = idade / L;
  const h = frac(Math.sin((p + 1) * 12.9898 + s.semente * 78.233) * 43758.5453);
  // para fora: do centro do campo para o sinalizador
  const d = Math.hypot(s.x, s.z) || 1;
  const vx = s.x / d, vz = s.z / d;
  const lat = (h - 0.5) * 0.6;
  const dist = F.vento * idade * (0.8 + 0.4 * h);
  return {
    x: s.x + vx * dist - vz * lat * idade,
    y: s.y + F.fogo + F.sobe * idade * (1 - 0.25 * k),
    z: s.z + vz * dist + vx * lat * idade,
    tam: F.tam[0] + (F.tam[1] - F.tam[0]) * Math.sqrt(k),
    alfa: F.alfa * clamp(idade / 0.6, 0, 1) * (1 - k) * (1 - k),
  };
}

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/**
 * vec4 fumacaParticula(vec4 s (x, y, z, t0), vec4 sb (dur, cor, semente, ativo), float p, float P, float t, out float
 * alfa) → (x, y, z, tam); tam 0 = não existe. A MESMA conta.
 */
export const FUMACA_GLSL = (() => {
  const F = FUMACA;
  return `
vec4 fumacaParticula(vec4 s, vec4 sb, float p, float P, float t, out float alfa) {
  alfa = 0.0;
  if (sb.w < 0.5 || P <= 0.0) return vec4(0.0);
  float L = ${g(F.vida)};
  float off = (p / P) * L;
  float rel = t - s.w - off;
  if (rel < 0.0) return vec4(0.0);
  float nasc = s.w + off + floor(rel / L) * L;
  if (nasc > s.w + sb.x) return vec4(0.0);
  float idade = t - nasc;
  if (idade < 0.0 || idade >= L) return vec4(0.0);
  float k = idade / L;
  float h = fract(sin((p + 1.0) * 12.9898 + sb.z * 78.233) * 43758.5453);
  float d = max(length(s.xz), 1.0);
  vec2 vv = s.xz / d;
  float lat = (h - 0.5) * 0.6;
  float dist = ${g(F.vento)} * idade * (0.8 + 0.4 * h);
  alfa = ${g(F.alfa)} * clamp(idade / 0.6, 0.0, 1.0) * (1.0 - k) * (1.0 - k);
  return vec4(s.x + vv.x * dist - vv.y * lat * idade,
              s.y + ${g(F.fogo)} + ${g(F.sobe)} * idade * (1.0 - 0.25 * k),
              s.z + vv.y * dist + vv.x * lat * idade,
              ${g(F.tam[0])} + ${g(F.tam[1] - F.tam[0])} * sqrt(k));
}
`;
})();

/** float forcaPelaLente(vec3 c, float r, vec4 L): a MESMA conta. */
export const LENTE_FUMACA_GLSL = `
float forcaPelaLente(vec3 c, float r, vec4 L) {
  if (!(L.w > 0.0)) return 1.0;
  return clamp((distance(c, L.xyz) - r - ${FUMACA.lente.raio.toFixed(2)}) / ${FUMACA.lente.folga.toFixed(2)}, 0.0, 1.0);
}
`;
