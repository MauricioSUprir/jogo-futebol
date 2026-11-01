// O ESTADO de um torcedor num instante (conta PURA, sem three.js nem DOM; item 69 da FILA, PR 2): a pose (as 8 de
// torcida-dados.js POSE, pela regra POSE_REGRA), o pulo e o balanço — com a OLA (festa.js) e quem fica debaixo do
// BANDEIRÃO aberto (bandeiras-dados.js sobBandeirao). É a MESMA conta no quadro de hoje (render/torcida.js) e no torcedor
// 3D de perto (render/torcedor3d.js): os dois shaders incluem ESTADO_GLSL e chamam torcedorEstado() com o mesmo lugar
// (aPos do torcedor) e as mesmas sementes — o mesmo instante dá a mesma pose no quadro e no 3D. estadoTorcedor() é a
// conta em JS (testes: tools/teste-torcida.mjs G e tools/teste-estadio.mjs 9, a GPU de verdade).
import { POSE, POSE_GLSL, poseDoTorcedor } from './torcida-dados.js';
import { OLA_GLSL, olaPeso } from './festa.js';
import { BANDEIRAS, SOB_GLSL, sobBandeirao } from './bandeiras-dados.js';

// a ola levanta quem está na crista (braços em V) e dá um pulo; debaixo do bandeirão aberto: braços em V, sem pular
export const ESTADO_REGRA = Object.freeze({ olaLevanta: 0.45, olaPulo: 0.3, balAmp: 0.035 });

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/**
 * Os uniforms do ânimo (os mesmos objetos nos dois materiais: torcida.js cria, torcedor3d.js reaproveita) e
 * vec3 torcedorEstado(vec3 lugar, float h, vec4 info) → (pose, pulo, balanço). info = aInfo (time, setor, organizada,
 * h2); h = a semente (aPele.w).
 */
export const ESTADO_GLSL = (() => {
  const R = ESTADO_REGRA, mt = BANDEIRAS.sob.torcedor;
  return `
uniform float uTempo;
uniform float uTempoOrg;
uniform float uAnimada;
uniform vec2 uExcita;
uniform vec2 uTensao;
uniform vec2 uLamento;
uniform vec2 uPalmas;
uniform vec4 uOla;
uniform vec3 uBandA[2];
uniform vec3 uBandU[2];
uniform vec3 uBandV[2];
uniform vec2 uAbre;
${POSE_GLSL}
${OLA_GLSL}
${SOB_GLSL}
vec3 torcedorEstado(vec3 lugar, float h, vec4 info) {
  float time = step(0.5, info.x);
  bool org = info.z > 0.5;
  float h2 = info.w;
  float ex = mix(uExcita.x, uExcita.y, time);
  float te = mix(uTensao.x, uTensao.y, time);
  float la = mix(uLamento.x, uLamento.y, time);
  float pa = mix(uPalmas.x, uPalmas.y, time);
  // a pose e o pulo: a regra de torcida-dados.js (POSE_GLSL, gerado de POSE_REGRA); a organizada no relógio da batucada
  vec2 pp = torcidaPose(ex, te, la, pa, h, h2, org ? 1.0 : 0.0, org ? uTempoOrg : uTempo, uAnimada);
  float pose = pp.x;
  float pulo = pp.y;
  // ola: quem está na crista levanta com os braços em V (festa.js olaPeso)
  float ola = torcidaOla(lugar.xz, uOla);
  if (ola > ${g(R.olaLevanta)}) pose = ${g(POSE.BRACOS_V)};
  pulo += ola * ${g(R.olaPulo)} * uAnimada;
  // debaixo do bandeirão aberto: segura o pano (braços em V, sem pular) — ninguém fura o pano
  vec2 mt = vec2(${mt.map(v => v.toFixed(2)).join(', ')});
  if (max(sobBandeirao(lugar, uBandA[0], uBandU[0], uBandV[0], uAbre.x, mt), sobBandeirao(lugar, uBandA[1], uBandU[1], uBandV[1], uAbre.y, mt)) > 0.5) {
    pose = ${g(POSE.BRACOS_V)};
    pulo = 0.0;
  }
  float bal = uAnimada > 0.5 ? sin(uTempo * (0.8 + h2 * 0.9) + h * 40.0) * ${g(R.balAmp)} : 0.0;
  return vec3(pose, pulo, bal);
}
`;
})();

/**
 * A MESMA conta em JS. niveis = [{excita, tensao, lamento, palmas} do time 0, ... do time 1]; lugar = [x, y, z] (aPos);
 * h = semente; info = [time 0|1, setor, organizada 0|1, h2] (já em 0–1, como o shader lê); u = {tempo, tempoOrg,
 * animada (0|1), ola: {theta, largura, forca, ativa} | null, bandeiroes: [{A, U, V}…2], abre: [a0, a1]}.
 * Devolve {pose, pulo, bal}.
 */
export function estadoTorcedor(niveis, lugar, h, info, u) {
  const R = ESTADO_REGRA;
  const time = info[0] >= 0.5 ? 1 : 0, org = info[2] > 0.5, h2 = info[3];
  const n = niveis[time];
  const r = poseDoTorcedor(n, h, h2, org, org ? u.tempoOrg : u.tempo, u.animada > 0.5);
  let pose = r.pose, pulo = r.pulo;
  const ola = olaPeso(lugar[0], lugar[2], u.ola);
  if (ola > R.olaLevanta) pose = POSE.BRACOS_V;
  pulo += ola * R.olaPulo * (u.animada > 0.5 ? 1 : 0);
  const mt = BANDEIRAS.sob.torcedor;
  if ((u.bandeiroes || []).some((b, k) => sobBandeirao(lugar, b, (u.abre || [0, 0])[k], mt))) { pose = POSE.BRACOS_V; pulo = 0; }
  const bal = u.animada > 0.5 ? Math.sin(u.tempo * (0.8 + h2 * 0.9) + h * 40) * R.balAmp : 0;
  return { pose, pulo, bal };
}
