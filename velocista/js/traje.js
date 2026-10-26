// Traje do herói desenhado no shader, pela posição de repouso de cada ponto do corpo (x = frente, y = cima, z = direita;
// medidas de assets/humano/corpo.json): nada depende do mapa UV (que é o de um uniforme de futebol). Desenho original:
// vermelho profundo com microgomos, peitoral em escudo com friso dourado, duas faixas douradas paralelas que descem do
// sovaco até a bota pela lateral (estilo macacão de corrida), friso no alto dos braços, cinto grafite com fivela dourada,
// luvas e botas em vermelho-escuro com aro dourado, costuras em relevo (abdômen, coluna, joelheiras, ombreiras).
// Na cabeça: máscara inteira com abertura para a boca e o queixo, olhos recortados e friso dourado na borda e no alto.
// A altura das costuras e frisos vira relevo pela derivada na tela (a mesma conta do bumpMap do three.js).

const COMUM = /* glsl */ `
varying vec3 vRep;
varying vec2 vUv0;
float tLinha(float d, float w) { float f = fwidth(d) * 1.2 + 1e-5; return 1.0 - smoothstep(w * 0.5, w * 0.5 + f, abs(d)); }
vec3 tSeg(vec3 p, vec3 a, vec3 b, out float t) { vec3 ab = b - a; t = dot(p - a, ab) / dot(ab, ab); return a + ab * clamp(t, 0.0, 1.0); }
// microgomos hexagonais (relevo fino do tecido)
float tHex(vec2 u) {
  vec2 r = vec2(1.0, 1.732), h = r * 0.5;
  vec2 a = mod(u, r) - h, b = mod(u - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  return smoothstep(0.32, 0.48, max(abs(g.x) * 0.866 + abs(g.y) * 0.5, abs(g.y)));
}
vec3 TR_COR; float TR_RUG; float TR_MET; float TR_ALT;
void tPerturba(inout vec3 n, float h) {
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  n = normalize(abs(det) * n - grad);
}
`;

// paletas: a mesma forma do traje com outras cores (herói, e os dois vilões, com desenho próprio)
// T_VERM = tecido, T_VESC = luvas/botas, T_OURO = frisos, T_GRAF = cinto/sola, T_BRILHO = quanto os frisos acendem
const PALETAS = {
  heroi: { verm: [0.24, 0.010, 0.016], vesc: [0.085, 0.005, 0.008], ouro: [0.92, 0.56, 0.10], graf: [0.028, 0.026, 0.028], brilho: 0, olho: [0, 0, 0], mascaraFechada: false },
  zoom: { verm: [0.010, 0.010, 0.013], vesc: [0.004, 0.004, 0.006], ouro: [0.08, 0.32, 1.0], graf: [0.02, 0.03, 0.05], brilho: 0.9, olho: [0.2, 0.55, 2.2], mascaraFechada: true },
  reverso: { verm: [0.62, 0.40, 0.015], vesc: [0.22, 0.12, 0.006], ouro: [0.75, 0.02, 0.02], graf: [0.03, 0.02, 0.015], brilho: 0.35, olho: [2.0, 0.08, 0.05], mascaraFechada: false },
  // Savitar: armadura de aço escovado com as costuras acesas em azul-branco e o capacete fechado (met/rug = metal e aspereza do tecido)
  savitar: { verm: [0.40, 0.42, 0.46], vesc: [0.07, 0.075, 0.09], ouro: [0.5, 1.3, 2.6], graf: [0.035, 0.035, 0.045], brilho: 1.0, olho: [1.4, 2.0, 2.8], mascaraFechada: true, met: 0.85, rug: 0.3 },
};
const v3 = (c) => `vec3(${c.map((x) => x.toFixed(4)).join(', ')})`;
const cores = (P) => /* glsl */ `
const vec3 T_VERM = ${v3(P.verm)};
const vec3 T_VESC = ${v3(P.vesc)};
const vec3 T_OURO = ${v3(P.ouro)};
const vec3 T_GRAF = ${v3(P.graf)};
const float T_BRILHO = ${P.brilho.toFixed(3)};
const float T_MET0 = ${(P.met ?? 0.06).toFixed(3)};
const float T_RUG0 = ${(P.rug ?? 0.46).toFixed(3)};
const vec3 T_OLHO = ${v3(P.olho)};
${P.mascaraFechada ? '#define MASCARA_FECHADA' : ''}
vec3 TR_EMIS = vec3(0.0);
`;

const CORPO = /* glsl */ `
void traje(vec3 p) {
  vec3 q = vec3(p.x, p.y, abs(p.z));                              // simetria esquerda/direita
  vec3 cor = T_VERM; float rug = T_RUG0, met = T_MET0, alt = 0.0;
  float ouro = 0.0, escuro = 0.0, graf = 0.0, cost = 0.0, painel = 0.0;

  // ---- braços (ombro → cotovelo → mão, em repouso) ----
  vec3 S = vec3(0.0, 1.4658, 0.19), E = vec3(0.0453, 1.2564, 0.3802), W = vec3(0.1014, 1.0467, 0.5714);
  float tA, tB; vec3 cA = tSeg(q, S, E, tA), cB = tSeg(q, E, W, tB);
  float dA = length(q - cA), dB = length(q - cB);
  bool braco = q.y > 0.9 && (dB < 0.075 || (dA < 0.085 && tA > 0.22));
  // ---- pernas (quadril → joelho → tornozelo) ----
  vec3 H = vec3(0.0, 0.9758, 0.09), K = vec3(0.0183, 0.5277, 0.1138), A = vec3(-0.0166, 0.08, 0.1222);
  float tC, tD; vec3 cC = tSeg(q, H, K, tC), cD = tSeg(q, K, A, tD);
  bool perna = !braco && q.y < 0.96;

  if (braco) {
    bool ante = dB < dA;
    vec3 c = ante ? cB : cA, u = normalize(ante ? W - E : E - S);
    vec3 r = q - c, cima = normalize(vec3(0.0, 1.0, 0.0) - u * u.y), lado = normalize(cross(u, cima));
    vec3 rn = normalize(r);
    // friso dourado no alto do braço, do ombro até a luva
    ouro = max(ouro, tLinha(dot(rn, lado), 0.16) * step(0.0, dot(rn, cima)) * (ante ? step(tB, 0.8) : step(0.32, tA)));
    // luva: depois do punho, vermelho-escuro com aro dourado
    if (ante && tB > 0.82) escuro = 1.0;
    if (ante) ouro = max(ouro, tLinha(tB - 0.815, 0.022));
    // costura da cotoveleira
    cost = max(cost, tLinha(length((q - E) * vec3(1.0, 1.0, 1.0)) - 0.055, 0.004) * step(0.0, dot(q - E, vec3(-1.0, 0.0, 0.0))));
    // ombreira (costura em arco em volta do ombro)
    cost = max(cost, tLinha(length(q - S) - 0.105, 0.004));
  } else if (perna) {
    bool canela = q.y < K.y;
    vec3 c = canela ? cD : cC, u = normalize(canela ? A - K : K - H);
    vec3 r = q - c; r -= u * dot(r, u);
    vec2 rn = normalize(vec2(r.x, r.z));
    // as duas faixas da lateral externa
    float fora = step(0.35, rn.y);
    ouro = max(ouro, fora * max(tLinha(rn.x - 0.16, 0.065), tLinha(rn.x + 0.16, 0.065)) * step(0.42, q.y));
    // joelheira
    float dk = length((q - K) * vec3(1.0, 0.75, 1.0));
    if (rn.x > 0.25 && dk < 0.07) painel = 1.0;
    cost = max(cost, tLinha(dk - 0.07, 0.004) * step(0.2, rn.x));
    // bota: vermelho-escuro, aro dourado com bico na frente, sola grafite
    float aro = 0.40 + 0.035 * smoothstep(0.3, 1.0, rn.x);
    if (q.y < aro) escuro = 1.0;
    ouro = max(ouro, tLinha(q.y - aro - 0.006, 0.012));
    if (q.y < 0.028) graf = 1.0;
    // costura de trás da coxa
    cost = max(cost, tLinha(rn.y, 0.035) * step(rn.x, -0.5) * step(0.6, q.y));
  } else {
    // ---- tronco ----
    vec2 rn = normalize(vec2(q.x, q.z));
    // faixas laterais (continuam as das pernas)
    float lado = step(0.35, rn.y) * step(q.y, 1.39);
    ouro = max(ouro, lado * max(tLinha(rn.x - 0.16, 0.065), tLinha(rn.x + 0.16, 0.065)));
    // peitoral em escudo com friso dourado
    float w = 0.125 - max(0.0, 1.32 - q.y) * 1.25;
    float sd = q.z - w;
    float frente = step(0.035, q.x);
    if (frente > 0.0 && sd < 0.0 && q.y > 1.22 && q.y < 1.445) painel = 1.0;
    ouro = max(ouro, frente * tLinha(sd, 0.0075) * step(1.22, q.y) * step(q.y, 1.445));
    ouro = max(ouro, frente * tLinha(q.y - 1.445, 0.0075) * step(q.z, 0.125));
    // costuras: abdômen (centro e duas transversais), coluna, gola
    cost = max(cost, frente * tLinha(q.z, 0.0035) * step(1.04, q.y) * step(q.y, 1.225));
    cost = max(cost, frente * step(q.z, 0.075) * max(tLinha(q.y - 1.115, 0.0035), tLinha(q.y - 1.17, 0.0035)));
    cost = max(cost, step(q.x, -0.03) * tLinha(q.z, 0.0035) * step(1.04, q.y));
    cost = max(cost, tLinha(q.y - 1.485, 0.004));
    // cinto grafite com fivela dourada
    if (q.y > 0.985 && q.y < 1.03) {
      graf = 1.0;
      if (q.x > 0.05 && q.z < 0.042) { ouro = 1.0; cost = max(cost, tLinha(max(q.z - 0.03, abs(q.y - 1.0075) - 0.012), 0.003)); }
    }
    cost = max(cost, max(tLinha(q.y - 0.985, 0.003), tLinha(q.y - 1.03, 0.003)));
  }

  // microgomos no tecido vermelho
  // os microgomos somem quando ficam menores que um pixel (senão viram purpurina)
  vec2 uh = vUv0 * vec2(200.0, 200.0);
  float nitido = 1.0 - smoothstep(0.25, 0.6, length(fwidth(uh)));
  float hx = tHex(uh) * nitido;
  if (escuro > 0.5) cor = T_VESC;
  if (painel > 0.5) cor *= 1.18;
  cor *= 0.95 + 0.05 * (1.0 - hx);
  alt = -0.1 * hx + 0.35 * painel;
  if (graf > 0.5) { cor = T_GRAF; rug = 0.32; met = 0.2; alt = 0.1; }
  cor = mix(cor, cor * 0.35, cost); rug = mix(rug, 0.85, cost); alt -= cost * 1.0;
  cor = mix(cor, T_OURO, ouro); rug = mix(rug, 0.24, ouro); met = mix(met, 0.9, ouro); alt = mix(alt, 0.8, ouro);
  TR_COR = cor; TR_RUG = rug; TR_MET = met; TR_ALT = alt;
  TR_EMIS = T_OURO * ouro * T_BRILHO;
}
`;

const CABECA = /* glsl */ `
float MASCARA;
void traje(vec3 p) {
  vec3 q = vec3(p.x, p.y, abs(p.z));
  // abertura da boca e do queixo (frente, abaixo do nariz), e os olhos
  // boca e queixo: uma elipse na frente do rosto (sem pegar a garganta)
  float sdRosto = (length(vec2(q.z / 0.057, (q.y - 1.573) / 0.043)) - 1.0) * 0.043;
  sdRosto = max(sdRosto, 0.062 + max(0.0, 1.556 - q.y) * 2.0 - q.x);
  vec2 o = vec2((q.z - 0.032) / 0.021, (q.y - 1.661) / 0.0115);
  float sdOlho = (length(o) - 1.0) * 0.0115;
#ifdef MASCARA_FECHADA
  sdRosto = 1.0;                                                   // máscara fechada: só os olhos, que acendem
#endif
  float sd = min(sdRosto, q.x > 0.08 ? sdOlho : 1.0);
  float f = fwidth(sd) * 1.2 + 1e-5;
  MASCARA = smoothstep(-f, f, sd);
  float ouro = tLinha(sdRosto - 0.0035, 0.0045) * step(0.06, q.x);
  ouro = max(ouro, tLinha(q.z, 0.006) * step(1.69, q.y) * step(q.x, 0.14));     // friso no alto da cabeça, da testa à nuca
  float cost = tLinha(sdOlho - 0.004, 0.003) * step(0.08, q.x);
  vec2 uh = vUv0 * vec2(240.0, 240.0);
  float hx = tHex(uh) * (1.0 - smoothstep(0.25, 0.6, length(fwidth(uh))));
  vec3 cor = T_VERM * (0.95 + 0.05 * (1.0 - hx));
  cor = mix(cor, cor * 0.35, cost); cor = mix(cor, T_OURO, ouro);
  TR_COR = cor;
  TR_RUG = mix(mix(0.42, 0.85, cost), 0.24, ouro);
  TR_MET = mix(0.06, 0.9, ouro);
  TR_ALT = mix(-0.1 * hx - cost, 0.8, ouro) * MASCARA;
  TR_EMIS = T_OURO * ouro * T_BRILHO * MASCARA;
  // olhos: nos vilões, um brilho na abertura (fechada no Zoom; em volta do olho no outro)
  float olho = (1.0 - smoothstep(-0.002, 0.003, sdOlho)) * step(0.08, q.x);
  TR_EMIS += T_OLHO * olho * 0.6;
#ifdef MASCARA_FECHADA
  if (olho > 0.0) { MASCARA = 1.0; TR_COR = mix(TR_COR, vec3(0.0), olho); }
#endif
}
`;

/** Liga o traje num material MeshStandard/MeshPhysical do corpo ('corpo') ou da cabeça ('cabeca', mantém a pele do mapa). */
export function aplicarTraje(material, parte, variante = 'heroi') {
  const ehCabeca = parte === 'cabeca', P = PALETAS[variante] || PALETAS.heroi;
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRep;\nvarying vec2 vUv0;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRep = position; vUv0 = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMUM + cores(P) + (ehCabeca ? CABECA : CORPO))
      .replace('#include <map_fragment>', ehCabeca
        ? '#include <map_fragment>\ntraje(vRep);\ndiffuseColor.rgb = mix(diffuseColor.rgb, TR_COR, MASCARA);'
        : 'traje(vRep);\ndiffuseColor.rgb *= TR_COR;')
      .replace('#include <roughnessmap_fragment>', ehCabeca
        ? '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, TR_RUG, MASCARA);'
        : 'float roughnessFactor = roughness * TR_RUG;')
      .replace('#include <metalnessmap_fragment>', ehCabeca
        ? '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, TR_MET, MASCARA);'
        : 'float metalnessFactor = TR_MET;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\ntPerturba(normal, TR_ALT * 0.0016);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += TR_EMIS;');
  };
  material.customProgramCacheKey = () => `traje-${parte}-${variante}`;
  material.needsUpdate = true;
  return material;
}
