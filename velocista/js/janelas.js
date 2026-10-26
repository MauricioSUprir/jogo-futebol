// SALAS ATRÁS DAS JANELAS (dono, 26/10: "melhore as texturas dos prédios, bota umas texturas mais realistas"): o "interior
// mapping" (Joost van Dongen, 2007/2008; o mesmo truque dos prédios de Nova York em Marvel's Spider-Man): cada janela vira
// uma sala de verdade — o raio da câmera entra pelo vidro e bate na parede do fundo, no piso, no teto ou numa parede do
// lado, e a cor sai de onde ele bateu. Sem um triângulo a mais: tudo no shader da fachada (onBeforeCompile do
// MeshStandardMaterial). As salas seguem a grade das janelas da textura (colunas × andares por repetição de 16 m); cada
// uma sorteia a cor da parede, o piso, um quadro ou uma estante, a luminária e um móvel num plano no meio da sala (sofá,
// mesa ou planta). De dia o fundo fica mais escuro que a rua (como numa foto de verdade); à noite a sala acende quando a
// janela está acesa no mapa de brilho de sempre e o resto fica escuro. O vidro reflete o céu (pouca aspereza).
// Só no PC (no celular a cidade usa MeshLambert, sem isto).

const GLSL = /* glsl */ `
uniform sampler2D tJanela;
uniform vec2 jGrade;
uniform float jProf;
uniform float jEspelho;
uniform float jReflexo;
float jHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 jParede(float h) {
  vec3 a = vec3(0.86, 0.80, 0.70), b = vec3(0.70, 0.78, 0.82), c = vec3(0.90, 0.88, 0.84), d = vec3(0.68, 0.74, 0.62), e = vec3(0.82, 0.66, 0.58);
  return h < 0.25 ? a : h < 0.45 ? b : h < 0.7 ? c : h < 0.85 ? d : e;
}
// a sala atrás do vidro: devolve a cor (sem luz) e, em lum, quanto a luminária ilumina (para o brilho de noite)
// (as derivadas vêm de fora: dentro de um if elas não valem)
vec3 jSala(vec2 uv, vec3 p, vec3 dp1, vec3 dp2, vec2 du1, vec2 du2, out float lum) {
  vec3 N = normalize(cross(dp1, dp2)); if (dot(N, p) > 0.0) N = -N;            // a face da fachada, virada para a câmera
  vec3 dp2p = cross(dp2, N), dp1p = cross(N, dp1);
  float det = dot(dp1, dp2p);
  vec3 gu = (dp2p * du1.x + dp1p * du2.x) / det, gv = (dp2p * du1.y + dp1p * du2.y) / det;   // gradientes de u e v (por metro)
  vec3 d = normalize(p);
  vec3 dr = vec3(dot(d, gu) * jGrade.x, dot(d, gv) * jGrade.y, max(1e-3, -dot(d, N)) / jProf);
  dr.xy += sign(dr.xy) * 1e-5 + 1e-6;
  vec2 cel = uv * jGrade, id = floor(cel);
  vec3 r = vec3(fract(cel), 0.0);
  float tx = ((dr.x > 0.0 ? 1.0 : 0.0) - r.x) / dr.x, ty = ((dr.y > 0.0 ? 1.0 : 0.0) - r.y) / dr.y, tz = 1.0 / dr.z;
  float t = min(min(tx, ty), tz);
  vec3 h = r + dr * t;
  float s1 = jHash(id + 0.37), s2 = jHash(id * 1.7 + 4.1), s3 = jHash(id * 0.61 + 9.3);
  vec3 parede = jParede(s1);
  vec3 c;
  lum = 0.0;
  if (t == tz) {                                             // a parede do fundo: quadro, estante ou porta
    c = parede;
    vec2 q = h.xy;
    if (s2 < 0.35 && abs(q.x - 0.5) < 0.17 && abs(q.y - 0.56) < 0.11) c = abs(q.x - 0.5) > 0.15 || abs(q.y - 0.56) > 0.09 ? vec3(0.12, 0.09, 0.07) : mix(vec3(0.25, 0.42, 0.55), vec3(0.85, 0.62, 0.3), q.y * 1.6 - 0.6);
    else if (s2 < 0.62 && abs(q.x - 0.3) < 0.18 && q.y < 0.78) c = fract(q.y * 6.0) < 0.12 ? vec3(0.25, 0.17, 0.1) : mix(vec3(0.42, 0.3, 0.2), vec3(0.6, 0.2 + 0.3 * s3, 0.15), step(0.5, fract(q.x * 23.0 + s3)));
    else if (s2 < 0.75 && abs(q.x - 0.72) < 0.1 && q.y < 0.62) c = vec3(0.45, 0.33, 0.24);
  } else if (t == ty) {
    if (dr.y < 0.0) {                                        // o piso: tábuas, carpete ou cerâmica
      vec2 q = h.xz;
      c = s3 < 0.45 ? mix(vec3(0.42, 0.28, 0.17), vec3(0.5, 0.35, 0.22), step(0.5, fract(q.x * 7.0))) * (fract(q.y * 11.0 + floor(q.x * 7.0) * 0.37) < 0.04 ? 0.7 : 1.0)
        : s3 < 0.75 ? vec3(0.32, 0.33, 0.36) : (fract(q.x * 4.0) < 0.04 || fract(q.y * 4.0) < 0.04 ? vec3(0.55) : vec3(0.78, 0.76, 0.72));
    } else {                                                 // o teto com a luminária no meio
      c = vec3(0.86, 0.86, 0.84);
      float l = 1.0 - smoothstep(0.08, 0.13, max(abs(h.x - 0.5), abs(h.z - 0.45) * 1.6));
      c = mix(c, vec3(1.6, 1.5, 1.3), l); lum = l;
    }
  } else c = parede * 0.86;                                  // as paredes do lado
  c *= mix(1.0, 0.62, h.z) * (0.85 + 0.15 * smoothstep(0.0, 0.08, min(min(h.x, 1.0 - h.x), min(h.y, 1.0 - h.y))));   // fundo e cantos mais escuros
  // um móvel num plano no meio da sala (antes da parede, se o raio passar por ele)
  float tm = 0.5 / dr.z;
  if (tm < t) {
    vec2 m = (r + dr * tm).xy;
    if (s3 < 0.33 && abs(m.x - 0.5) < 0.3 && (m.y < 0.16 || (m.y < 0.27 && abs(m.x - 0.5) > 0.25))) c = vec3(0.22, 0.24, 0.3) * (0.7 + 0.5 * s1);
    else if (s3 >= 0.33 && s3 < 0.66 && abs(m.x - 0.5) < 0.24 && m.y < 0.2 && m.y > 0.17 - step(0.2, abs(m.x - 0.5)) * 0.2) c = vec3(0.3, 0.2, 0.13);
    else if (s3 >= 0.66 && (length(m - vec2(0.2, 0.3)) < 0.1 || (abs(m.x - 0.2) < 0.05 && m.y < 0.2))) c = m.y < 0.2 ? vec3(0.35, 0.22, 0.15) : vec3(0.16, 0.36, 0.14);
  }
  // persiana baixada em parte das janelas (no vidro, antes da sala)
  if (s1 > 0.78 && r.y > 1.0 - (0.25 + 0.5 * s2)) c = mix(vec3(0.78, 0.76, 0.7), vec3(0.6, 0.58, 0.54), step(0.5, fract(r.y * 40.0)));
  return c;
}
`;

/**
 * Liga as salas no material da fachada. `mascara`: a textura do vidro (branco = vidro), na mesma UV do mapa; `grade`:
 * [colunas, andares] numa repetição; `profundidade` da sala em m; `espelho` (0..1): vidro espelhado (cortina de vidro);
 * `reflexo`: quanto o reflexo do céu no vidro sobe em relação ao resto da fachada (o envMapIntensity é um só no material).
 */
export function salasAtrasDasJanelas(material, { mascara, grade, profundidade = 6, espelho = 0, reflexo = 1 }) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.tJanela = { value: mascara }; sh.uniforms.jGrade = { value: { x: grade[0], y: grade[1] } };
    sh.uniforms.jProf = { value: profundidade }; sh.uniforms.jEspelho = { value: espelho }; sh.uniforms.jReflexo = { value: reflexo };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float jVid = texture2D(tJanela, vMapUv).r, jLum = 0.0, jAcesa = 0.0;
        vec3 jCor = vec3(0.0), jP = -vViewPosition, jdp1 = dFdx(jP), jdp2 = dFdy(jP);
        vec2 jdu1 = dFdx(vMapUv), jdu2 = dFdy(vMapUv);
        #ifdef USE_EMISSIVEMAP
          jAcesa = dot(texture2D(emissiveMap, vMapUv).rgb, vec3(0.333));
        #endif
        if (jVid > 0.02) {
          jCor = jSala(vMapUv, jP, jdp1, jdp2, jdu1, jdu2, jLum);
          float jNoite = clamp(emissive.r, 0.0, 1.0);
          // de dia a sala é mais escura que a rua; à noite, só a sala acesa aparece (a luz vem pelo emissivo)
          vec3 jDia = jCor * 0.62, jNoiteCor = jCor * mix(0.03, 0.12, step(0.15, jAcesa));
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(mix(jDia, jNoiteCor, jNoite), diffuseColor.rgb * 0.6, jEspelho), jVid);
        }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.06, jVid); metalnessFactor = mix(metalnessFactor, 0.45 * jEspelho, jVid);`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        #if defined( RE_IndirectSpecular )
          radiance *= mix(1.0, jReflexo, jVid);              // o vidro reflete o céu mais que a parede
        #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= mix(1.0, 0.25 + 0.9 * dot(jCor, vec3(0.333)) + 0.8 * jLum, jVid * (1.0 - jEspelho * 0.5));`);
  };
  material.customProgramCacheKey = () => `salas-${grade[0]}x${grade[1]}-${espelho}`;
  material.needsUpdate = true;
  return material;
}
