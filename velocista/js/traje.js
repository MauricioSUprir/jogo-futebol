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
float tSeg2(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * t); }
// o RAIO no meio da máscara (dono, 26/10: "esse capacete não tá legal, no meio, tem que ter um raio"): do alto da testa até
// entre os olhos, em zigue-zague, mais grosso em cima e afinando na ponta; continua no friso que passa por cima da cabeça
float tRaioTesta(vec3 p) {
  if (p.x < 0.03 || p.y < 1.668 || p.y > 1.8) return 0.0;
  vec2 s = vec2(p.z, p.y);
  float d = min(min(tSeg2(s, vec2(0.017, 1.795), vec2(-0.012, 1.731)), tSeg2(s, vec2(-0.012, 1.731), vec2(0.012, 1.724))), tSeg2(s, vec2(0.012, 1.724), vec2(-0.005, 1.671)));
  float w = 0.0045 + (p.y - 1.671) * 0.045, f = fwidth(d) * 1.2 + 1e-5;
  return 1.0 - smoothstep(w - f, w + f, d);
}
// EDIÇÃO PESSOAL (estilo da série): costura em losangos (o couro acolchoado), some quando a célula fica menor que um pixel
float tLosangos(vec2 u, float w) {
  vec2 s = vec2(u.x + u.y, u.x - u.y), a = abs(fract(s + 0.5) - 0.5), f = fwidth(s) * 1.2 + 1e-5;
  vec2 l = 1.0 - smoothstep(vec2(w), vec2(w) + f, a);
  return max(l.x, l.y) * (1.0 - smoothstep(0.15, 0.35, max(f.x, f.y)));
}
// EDIÇÃO PESSOAL: os RAIOS DAS ORELHAS do capuz (de cada lado da cabeça, por cima da orelha: um zigue-zague deitado que
// sai da têmpora e aponta para trás e um pouco para cima; grosso na frente, fino na ponta)
float tOrelha(vec3 q) {
  if (q.z < 0.05) return 0.0;
  vec2 s = vec2(q.x, q.y);
  float d = min(min(tSeg2(s, vec2(0.042, 1.664), vec2(-0.012, 1.645)), tSeg2(s, vec2(-0.012, 1.645), vec2(0.0, 1.667))), tSeg2(s, vec2(0.0, 1.667), vec2(-0.074, 1.692)));
  float w = 0.0032 + max(0.0, q.x + 0.074) * 0.055, f = fwidth(d) * 1.2 + 1e-5;
  return (1.0 - smoothstep(w - f, w + f, d)) * smoothstep(0.05, 0.066, q.z);
}
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
  heroi: { verm: [0.24, 0.010, 0.016], vesc: [0.085, 0.005, 0.008], ouro: [0.92, 0.56, 0.10], graf: [0.028, 0.026, 0.028], brilho: 0, olho: [0, 0, 0], mascaraFechada: false, raioTesta: true },
  zoom: { verm: [0.010, 0.010, 0.013], vesc: [0.004, 0.004, 0.006], ouro: [0.08, 0.32, 1.0], graf: [0.02, 0.03, 0.05], brilho: 0.9, olho: [0.2, 0.55, 2.2], mascaraFechada: true },
  reverso: { verm: [0.62, 0.40, 0.015], vesc: [0.22, 0.12, 0.006], ouro: [0.75, 0.02, 0.02], graf: [0.03, 0.02, 0.015], brilho: 0.35, olho: [2.0, 0.08, 0.05], mascaraFechada: false },
  // Savitar: armadura de aço escovado com as costuras acesas em azul-branco e o capacete fechado (met/rug = metal e aspereza do tecido)
  savitar: { verm: [0.40, 0.42, 0.46], vesc: [0.07, 0.075, 0.09], ouro: [0.5, 1.3, 2.6], graf: [0.035, 0.035, 0.045], brilho: 1.0, olho: [1.4, 2.0, 2.8], mascaraFechada: true, met: 0.85, rug: 0.3 },
  // o TRAJE NOVO do herói (dono, 26/10: "melhora o traje, o melhor possível"; desenho próprio, em aprovação: traje.html):
  // vermelho mais profundo, painéis escuros nervurados, veias de raio douradas que acendem, divisas no peito
  // Barry à paisana (as missões da vida dele): a roupa toda no desenho 'civil' (as cores daqui não valem)
  // o VULTO da noite do raio (a armação de alguém misterioso): preto fosco, frisos quase apagados, máscara fechada e um brilho
  // vermelho fraco nos olhos (quem ele é só aparece no capítulo 5)
  vulto: { verm: [0.014, 0.012, 0.013], vesc: [0.006, 0.005, 0.006], ouro: [0.035, 0.03, 0.03], graf: [0.01, 0.009, 0.01], brilho: 0, olho: [0.9, 0.03, 0.02], mascaraFechada: true, rug: 0.75 },
  // os VILÕES DO DIA A DIA (rivais.js), desenhos próprios: o Capitão Bumerangue (casaco azul e branco), o Trapaceiro
  // (arlequim vermelho e amarelo), o Mestre dos Espelhos (verde com prata e visor), o Pião (verde e laranja) e a Peek-a-Boo
  // (branco e preto)
  bumerangue: { verm: [0.03, 0.06, 0.2], vesc: [0.5, 0.5, 0.52], ouro: [0.85, 0.85, 0.9], graf: [0.05, 0.04, 0.03], brilho: 0, olho: [0, 0, 0], mascaraFechada: false, rug: 0.7 },
  trapaceiro: { verm: [0.42, 0.03, 0.03], vesc: [0.75, 0.55, 0.04], ouro: [0.95, 0.75, 0.08], graf: [0.05, 0.02, 0.02], brilho: 0.1, olho: [0, 0, 0], mascaraFechada: false },
  espelhos: { verm: [0.03, 0.2, 0.08], vesc: [0.02, 0.06, 0.03], ouro: [0.75, 0.78, 0.82], graf: [0.03, 0.04, 0.05], brilho: 0.25, olho: [0.4, 1.6, 1.4], mascaraFechada: true, met: 0.5 },
  piao: { verm: [0.05, 0.25, 0.1], vesc: [0.6, 0.22, 0.02], ouro: [0.95, 0.45, 0.05], graf: [0.03, 0.03, 0.03], brilho: 0.15, olho: [0, 0, 0], mascaraFechada: false },
  peekaboo: { verm: [0.7, 0.7, 0.72], vesc: [0.02, 0.02, 0.025], ouro: [0.05, 0.05, 0.06], graf: [0.02, 0.02, 0.02], brilho: 0, olho: [1.4, 0.3, 1.6], mascaraFechada: true },
  // o Corredor Negro: preto fosco da cabeça aos pés, frisos cor de cinza e os olhos brancos (Parte 2)
  negro: { verm: [0.007, 0.007, 0.008], vesc: [0.002, 0.002, 0.0025], ouro: [0.11, 0.11, 0.12], graf: [0.004, 0.004, 0.005], brilho: 0.15, olho: [2.2, 2.25, 2.5], mascaraFechada: true, rug: 0.92 },
  // o Godspeed: branco-prata com os frisos dourados e os olhos de ouro, armadura metálica (Parte 2, Ato 8)
  godspeed: { verm: [0.62, 0.62, 0.64], vesc: [0.16, 0.16, 0.17], ouro: [0.95, 0.72, 0.22], graf: [0.05, 0.05, 0.055], brilho: 0.6, olho: [2.4, 1.9, 0.7], mascaraFechada: true, met: 0.75, rug: 0.32 },
  civil: { verm: [0, 0, 0], vesc: [0, 0, 0], ouro: [0, 0, 0], graf: [0, 0, 0], brilho: 0, olho: [0, 0, 0], desenho: 'civil' },
  // EDIÇÃO PESSOAL (js/edicao.js; recriação de fã no estilo da série, desenhada aqui): o couro vinho acolchoado, sem as faixas
  // douradas, o capuz com os raios nas orelhas; o emblema é o raio no círculo claro (humano.js). Só com a senha.
  heroiSerie: { verm: [0.15, 0.0075, 0.011], vesc: [0.075, 0.0045, 0.0065], ouro: [0.95, 0.62, 0.12], graf: [0.06, 0.004, 0.006], brilho: 0.05, olho: [0, 0, 0], mascaraFechada: false, serie: true, orelhas: true, rug: 0.4, met: 0.1 },
  novoSerie: { verm: [0.34, 0.012, 0.016], vesc: [0.10, 0.005, 0.008], ouro: [0.98, 0.66, 0.13], graf: [0.03, 0.02, 0.022], brilho: 0.12, veia: 0.35, olho: [1.0, 0.5, 0.08], mascaraFechada: false, desenho: 'novo', orelhas: true, rug: 0.38 },
  reversoSerie: { verm: [0.78, 0.44, 0.012], vesc: [0.30, 0.14, 0.006], ouro: [0.62, 0.02, 0.02], graf: [0.05, 0.01, 0.01], brilho: 0.3, olho: [2.4, 0.06, 0.04], mascaraFechada: false, serie: true, orelhas: true, rug: 0.42, met: 0.08 },
  novo: { verm: [0.30, 0.011, 0.018], vesc: [0.075, 0.004, 0.008], ouro: [0.95, 0.60, 0.11], graf: [0.022, 0.02, 0.024], brilho: 0.08, veia: 0.55, olho: [1.2, 0.55, 0.08], mascaraFechada: false, desenho: 'novo', raioTesta: true },
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
const float T_VEIA = ${(P.veia ?? 0).toFixed(3)};
${P.mascaraFechada ? '#define MASCARA_FECHADA' : ''}
${P.raioTesta ? '#define RAIO_TESTA' : ''}
${P.serie ? '#define SERIE' : ''}
${P.orelhas ? '#define ORELHAS' : ''}
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
#ifdef SERIE
    // série: o alto do braço em couro acolchoado (losangos costurados, do ombro ao cotovelo) e a luva com costura no punho
    float ang = atan(dot(rn, lado), dot(rn, cima));
    if (!ante && tA > 0.3 && abs(ang) < 1.25) cost = max(cost, tLosangos(vec2(tA * 0.29, ang * 0.06) / 0.026, 0.05));
    cost = max(cost, tLinha(abs(ang) - 1.25, 0.05) * (ante ? step(tB, 0.8) : step(0.3, tA)));
    if (ante && tB > 0.82) escuro = 1.0;
    if (ante) cost = max(cost, tLinha(tB - 0.815, 0.016));
#else
    // friso dourado no alto do braço, do ombro até a luva
    ouro = max(ouro, tLinha(dot(rn, lado), 0.16) * step(0.0, dot(rn, cima)) * (ante ? step(tB, 0.8) : step(0.32, tA)));
    // luva: depois do punho, vermelho-escuro com aro dourado
    if (ante && tB > 0.82) escuro = 1.0;
    if (ante) ouro = max(ouro, tLinha(tB - 0.815, 0.022));
#endif
    // costura da cotoveleira
    cost = max(cost, tLinha(length((q - E) * vec3(1.0, 1.0, 1.0)) - 0.055, 0.004) * step(0.0, dot(q - E, vec3(-1.0, 0.0, 0.0))));
    // ombreira (costura em arco em volta do ombro)
    cost = max(cost, tLinha(length(q - S) - 0.105, 0.004));
  } else if (perna) {
    bool canela = q.y < K.y;
    vec3 c = canela ? cD : cC, u = normalize(canela ? A - K : K - H);
    vec3 r = q - c; r -= u * dot(r, u);
    vec2 rn = normalize(vec2(r.x, r.z));
#ifdef SERIE
    // série: o painel acolchoado na lateral de fora da coxa, com a costura em volta
    if (!canela && rn.y > 0.55 && q.y > 0.62) cost = max(cost, tLosangos(vec2(q.y, atan(rn.y, rn.x) * 0.075) / 0.028, 0.05));
    cost = max(cost, tLinha(rn.y - 0.55, 0.05) * step(0.42, q.y));
#else
    // as duas faixas da lateral externa
    float fora = step(0.35, rn.y);
    ouro = max(ouro, fora * max(tLinha(rn.x - 0.16, 0.065), tLinha(rn.x + 0.16, 0.065)) * step(0.42, q.y));
#endif
    // joelheira
    float dk = length((q - K) * vec3(1.0, 0.75, 1.0));
    if (rn.x > 0.25 && dk < 0.07) painel = 1.0;
    cost = max(cost, tLinha(dk - 0.07, 0.004) * step(0.2, rn.x));
    // bota: vermelho-escuro, aro dourado com bico na frente, sola grafite
    float aro = 0.40 + 0.035 * smoothstep(0.3, 1.0, rn.x);
    if (q.y < aro) escuro = 1.0;
#ifdef SERIE
    cost = max(cost, tLinha(q.y - aro - 0.006, 0.008));
#else
    ouro = max(ouro, tLinha(q.y - aro - 0.006, 0.012));
#endif
    if (q.y < 0.028) graf = 1.0;
    // costura de trás da coxa
    cost = max(cost, tLinha(rn.y, 0.035) * step(rn.x, -0.5) * step(0.6, q.y));
  } else {
    // ---- tronco ----
    vec2 rn = normalize(vec2(q.x, q.z));
    // faixas laterais (continuam as das pernas)
#ifdef SERIE
    // série: os flancos e o alto dos ombros em couro acolchoado, com a costura na divisa
    if (rn.y > 0.72 && q.y > 1.0 && q.y < 1.40) cost = max(cost, tLosangos(vec2(q.y, q.x) / 0.028, 0.05));
    cost = max(cost, tLinha(rn.y - 0.72, 0.04) * step(1.0, q.y) * step(q.y, 1.40));
    if (q.y > 1.455 && q.z > 0.07) cost = max(cost, tLosangos(vec2(q.z, q.y) / 0.026, 0.05));
#else
    float lado = step(0.35, rn.y) * step(q.y, 1.39);
    ouro = max(ouro, lado * max(tLinha(rn.x - 0.16, 0.065), tLinha(rn.x + 0.16, 0.065)));
#endif
    // peitoral em escudo com friso dourado
    float w = 0.125 - max(0.0, 1.32 - q.y) * 1.25;
    float sd = q.z - w;
    float frente = step(0.035, q.x);
    if (frente > 0.0 && sd < 0.0 && q.y > 1.22 && q.y < 1.445) painel = 1.0;
#ifdef SERIE
    cost = max(cost, frente * tLinha(sd, 0.005) * step(1.22, q.y) * step(q.y, 1.445));     // o peitoral só costurado
    cost = max(cost, frente * tLinha(q.y - 1.445, 0.005) * step(q.z, 0.125));
#else
    ouro = max(ouro, frente * tLinha(sd, 0.0075) * step(1.22, q.y) * step(q.y, 1.445));
    ouro = max(ouro, frente * tLinha(q.y - 1.445, 0.0075) * step(q.z, 0.125));
#endif
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
#ifdef SERIE
  ouro = 0.0;                                                      // série: sem friso dourado no rosto nem no alto da cabeça
#elif defined(RAIO_TESTA)
  ouro = max(ouro, tLinha(q.z, 0.006) * step(1.69, q.y) * step(q.x, 0.035));    // friso no alto da cabeça, do raio da testa à nuca
  ouro = max(ouro, tRaioTesta(p));
#else
  ouro = max(ouro, tLinha(q.z, 0.006) * step(1.69, q.y) * step(q.x, 0.14));     // friso no alto da cabeça, da testa à nuca
#endif
#ifdef ORELHAS
  ouro = max(ouro, tOrelha(q));                                    // os raios das orelhas
#endif
  float cost = tLinha(sdOlho - 0.004, 0.003) * step(0.08, q.x);
#ifdef SERIE
  cost = max(cost, max(tLinha(sdRosto - 0.0035, 0.0035) * step(0.06, q.x), tLinha(q.z, 0.004) * step(1.7, q.y)));   // costuras do capuz
#endif
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

// ---------- o TRAJE NOVO (desenho 'novo') ----------
const CORPO_NOVO = /* glsl */ `
float tTri(float x) { return abs(fract(x) - 0.5) * 4.0 - 1.0; }      // onda triangular −1..1 (o zigue-zague das veias)
void traje(vec3 p) {
  vec3 q = vec3(p.x, p.y, abs(p.z));                              // simetria esquerda/direita
  vec3 cor = T_VERM; float rug = T_RUG0, met = T_MET0, alt = 0.0;
  float ouro = 0.0, veia = 0.0, escuro = 0.0, graf = 0.0, cost = 0.0, painel = 0.0, nervura = 0.0;

  vec3 S = vec3(0.0, 1.4658, 0.19), E = vec3(0.0453, 1.2564, 0.3802), W = vec3(0.1014, 1.0467, 0.5714);
  float tA, tB; vec3 cA = tSeg(q, S, E, tA), cB = tSeg(q, E, W, tB);
  float dA = length(q - cA), dB = length(q - cB);
  bool braco = q.y > 0.9 && (dB < 0.075 || (dA < 0.085 && tA > 0.22));
  vec3 H = vec3(0.0, 0.9758, 0.09), K = vec3(0.0183, 0.5277, 0.1138), A = vec3(-0.0166, 0.08, 0.1222);
  float tC, tD; vec3 cC = tSeg(q, H, K, tC), cD = tSeg(q, K, A, tD);
  bool perna = !braco && q.y < 0.96;

  if (braco) {
    bool ante = dB < dA;
    vec3 c = ante ? cB : cA, u = normalize(ante ? W - E : E - S);
    vec3 r = q - c, cima = normalize(vec3(0.0, 1.0, 0.0) - u * u.y), lado = normalize(cross(u, cima));
    vec3 rn = normalize(r);
    float tt = ante ? 1.0 + tB : tA;                                // 0 no ombro → 2 na mão
    // por dentro do braço: painel escuro nervurado, com costura na divisa
    float dentro = dot(rn, -cima);
    if (dentro > 0.4) { escuro = 1.0; nervura = 1.0; }
    cost = max(cost, tLinha(dentro - 0.4, 0.05));
    // ombreira em relevo com friso dourado
    float dS = length(q - S);
    if (!ante && dS < 0.118 && dot(rn, cima) > -0.25) painel = 1.0;
    ouro = max(ouro, tLinha(dS - 0.118, 0.008) * step(-0.25, dot(rn, cima)));
    // veia de raio: zigue-zague dourado por fora do braço, do ombro até o punho (acende)
    float zz = dot(rn, lado) - 0.24 * tTri(tt * 3.2);
    veia = max(veia, tLinha(zz, 0.075) * step(-0.1, dot(rn, cima)) * step(0.16, tt) * step(tt, 1.79));
    // luva escura, punho dourado e uma faixa nos nós dos dedos
    if (ante && tB > 0.8) escuro = 1.0;
    if (ante) ouro = max(ouro, max(tLinha(tB - 0.80, 0.024), tLinha(tB - 0.955, 0.012) * step(0.1, dot(rn, cima))));
    cost = max(cost, tLinha(length(q - E) - 0.05, 0.004));          // cotoveleira
  } else if (perna) {
    bool canela = q.y < K.y;
    vec3 c = canela ? cD : cC, u = normalize(canela ? A - K : K - H);
    vec3 r = q - c; r -= u * dot(r, u);
    vec2 rn = normalize(vec2(r.x, r.z));
    float tt = canela ? 1.0 + tD : tC;
    // atrás da perna: painel escuro nervurado
    if (rn.x < -0.45) { escuro = 1.0; nervura = 1.0; }
    cost = max(cost, tLinha(rn.x + 0.45, 0.06) * step(0.42, q.y));
    // veia de raio pela frente da coxa e da canela (some na joelheira e antes da bota)
    float zz = rn.y - 0.26 * tTri(tt * 2.6);
    float dk = length((q - K) * vec3(1.0, 0.75, 1.0));
    veia = max(veia, tLinha(zz, 0.085) * step(0.25, rn.x) * step(0.47, q.y) * step(0.1, tt) * step(0.095, dk));
    // joelheira: reforço escuro em relevo, com costura em volta
    if (rn.x > 0.2 && dk < 0.08) { painel = 1.0; escuro = 1.0; }
    cost = max(cost, tLinha(dk - 0.08, 0.005) * step(0.2, rn.x));
    // bota escura: aro em V na frente, aleta dourada no tornozelo apontando para trás, sola grafite com friso
    float aro = 0.38 + 0.055 * smoothstep(0.2, 1.0, rn.x);
    if (q.y < aro) escuro = 1.0;
    ouro = max(ouro, tLinha(q.y - aro - 0.006, 0.014));
    float ax = rn.x;
    ouro = max(ouro, tLinha(abs(q.y - 0.2) - (ax + 0.3) * 0.16, 0.016) * step(0.2, rn.y) * step(-0.7, ax) * step(ax, 0.35) * step(q.y, aro - 0.02));
    if (q.y < 0.03) graf = 1.0;
    ouro = max(ouro, tLinha(q.y - 0.035, 0.006));
  } else {
    vec2 rn = normalize(vec2(q.x, q.z));
    float frente = step(0.04, q.x);
    // flancos escuros nervurados (das costelas ao quadril)
    if (rn.y > 0.82 && q.y > 1.0 && q.y < 1.40) { escuro = 1.0; nervura = 1.0; }
    cost = max(cost, tLinha(rn.y - 0.82, 0.04) * step(1.0, q.y) * step(q.y, 1.40));
    // divisas douradas em V, dos ombros até o emblema, e uma veia fina paralela por baixo
    vec2 a = vec2(1.458, 0.175), b = vec2(1.318, 0.05), pq = vec2(q.y, q.z), ab = b - a;
    float t = clamp(dot(pq - a, ab) / dot(ab, ab), 0.0, 1.0);
    ouro = max(ouro, frente * tLinha(length(pq - (a + ab * t)), 0.011));
    vec2 a2 = vec2(1.43, 0.185), b2 = vec2(1.30, 0.07), ab2 = b2 - a2;
    float t2 = clamp(dot(pq - a2, ab2) / dot(ab2, ab2), 0.0, 1.0);
    veia = max(veia, frente * tLinha(length(pq - (a2 + ab2 * t2)), 0.005));
    // peitoral em relevo acima das divisas
    if (frente > 0.0 && q.y > mix(1.318, 1.458, clamp((q.z - 0.05) / 0.125, 0.0, 1.0)) + 0.012 && q.y < 1.47 && q.z < 0.17) painel = 1.0;
    // abdômen em gomos
    cost = max(cost, frente * step(q.z, 0.085) * step(1.04, q.y) * step(q.y, 1.25) * max(tLinha(q.z, 0.0035), max(tLinha(q.y - 1.10, 0.0035), max(tLinha(q.y - 1.155, 0.0035), tLinha(q.y - 1.21, 0.0035)))));
    // nas costas, a veia de raio pela coluna
    veia = max(veia, step(q.x, -0.03) * tLinha(q.z - 0.028 * tTri(q.y * 11.0), 0.009) * step(1.05, q.y) * step(q.y, 1.46));
    ouro = max(ouro, tLinha(q.y - 1.49, 0.008));                    // gola
    // cinto de placas douradas com a fivela em losango
    if (q.y > 0.985 && q.y < 1.035) {
      graf = 1.0;
      float seg = fract(atan(q.z, q.x) * 7.0 / 3.14159);
      ouro = max(ouro, step(0.14, seg) * step(seg, 0.86) * 0.9);
      if (q.x > 0.05 && abs(q.z) / 0.04 + abs(q.y - 1.01) / 0.032 < 1.0) { ouro = 1.0; painel = 1.0; }
    }
    cost = max(cost, max(tLinha(q.y - 0.985, 0.003), tLinha(q.y - 1.035, 0.003)));
  }

  // o tecido: microgomos em tudo e nervuras diagonais nos painéis escuros (somem quando ficam menores que um pixel)
  vec2 uh = vUv0 * vec2(200.0, 200.0);
  float nitido = 1.0 - smoothstep(0.25, 0.6, length(fwidth(uh)));
  float hx = tHex(uh) * nitido, nv = 0.0;
  if (nervura > 0.5) { float s = (vUv0.x + vUv0.y) * 300.0; nv = (0.5 + 0.5 * sin(s)) * (1.0 - smoothstep(0.6, 1.6, fwidth(s))); }
  if (escuro > 0.5) cor = T_VESC;
  if (painel > 0.5) cor *= 1.25;
  cor *= 0.94 + 0.06 * (1.0 - hx) - 0.12 * nv;
  alt = -0.1 * hx + 0.45 * painel - 0.3 * nv;
  if (graf > 0.5 && ouro < 0.5) { cor = T_GRAF; rug = 0.3; met = 0.35; alt = 0.1; }
  rug = mix(rug, rug * 0.8, painel);
  cor = mix(cor, cor * 0.3, cost); rug = mix(rug, 0.85, cost); alt -= cost;
  float o2 = max(ouro, veia);
  cor = mix(cor, T_OURO, o2); rug = mix(rug, 0.2, o2); met = mix(met, 0.95, o2); alt = mix(alt, 0.75, o2);
  TR_COR = cor; TR_RUG = rug; TR_MET = met; TR_ALT = alt;
  TR_EMIS = T_OURO * (ouro * T_BRILHO + veia * T_VEIA);
}
`;
const CABECA_NOVO = /* glsl */ `
float MASCARA;
void traje(vec3 p) {
  vec3 q = vec3(p.x, p.y, abs(p.z));
  float sdRosto = (length(vec2(q.z / 0.057, (q.y - 1.573) / 0.043)) - 1.0) * 0.043;
  sdRosto = max(sdRosto, 0.062 + max(0.0, 1.556 - q.y) * 2.0 - q.x);
  vec2 o = vec2((q.z - 0.032) / 0.021, (q.y - 1.661) / 0.0115);
  float sdOlho = (length(o) - 1.0) * 0.0115;
  float sd = min(sdRosto, q.x > 0.08 ? sdOlho : 1.0);
  float f = fwidth(sd) * 1.2 + 1e-5;
  MASCARA = smoothstep(-f, f, sd);
  // friso dourado em volta do rosto e as ASAS pintadas: duas linhas que saem da sobrancelha e varrem para trás pela têmpora
  float ouro = tLinha(sdRosto - 0.0035, 0.0055) * step(0.06, q.x);
  float wy = q.y - (1.676 + (0.10 - q.x) * 0.42);
#ifdef ORELHAS
  float asa = tOrelha(q), raioT = 0.0; ouro = max(ouro, asa);          // edição pessoal: os raios das orelhas no lugar das asas
#else
  float asa = max(tLinha(wy, 0.0065) * step(0.058, q.z) * step(-0.06, q.x) * step(q.x, 0.105), tLinha(wy + 0.024, 0.0045) * step(0.066, q.z) * step(-0.045, q.x) * step(q.x, 0.095));
  ouro = max(ouro, asa);
  float raioT = tRaioTesta(p); ouro = max(ouro, raioT);
#endif
  // o aro dos olhos (lente escura que acende fraco) e a costura do alto do capuz
  float lente = tLinha(sdOlho - 0.0045, 0.0045) * step(0.08, q.x);
  float cost = tLinha(q.z, 0.004) * step(1.7, q.y) * step(q.x, 0.05);
  vec2 uh = vUv0 * vec2(240.0, 240.0);
  float hx = tHex(uh) * (1.0 - smoothstep(0.25, 0.6, length(fwidth(uh))));
  vec3 cor = T_VERM * (0.94 + 0.06 * (1.0 - hx));
  cor = mix(cor, vec3(0.012, 0.004, 0.005), lente); cor = mix(cor, cor * 0.3, cost); cor = mix(cor, T_OURO, ouro);
  TR_COR = cor;
  TR_RUG = mix(mix(mix(0.4, 0.35, lente), 0.85, cost), 0.2, ouro);
  TR_MET = mix(mix(0.06, 0.1, lente), 0.95, ouro);
  TR_ALT = mix(-0.1 * hx - cost + 0.4 * lente, 0.8, ouro) * MASCARA;
  TR_EMIS = (T_OURO * (ouro * T_BRILHO + (asa + raioT) * T_VEIA * 0.6) + T_OLHO * lente * 0.25) * MASCARA;
}
`;

// ---------- BARRY À PAISANA (desenho 'civil'): jaqueta azul-marinho aberta, camisa clara, jeans, sapato marrom, mãos e rosto à mostra ----------
const CORPO_CIVIL = /* glsl */ `
void traje(vec3 p) {
  vec3 q = vec3(p.x, p.y, abs(p.z));
  vec3 JAQ = vec3(0.035, 0.05, 0.11), CAM = vec3(0.62, 0.66, 0.72), JEANS = vec3(0.07, 0.12, 0.24), SAPATO = vec3(0.11, 0.055, 0.025), PELE = vec3(0.62, 0.42, 0.32), CINTO = vec3(0.12, 0.07, 0.035);
  vec3 cor = JAQ; float rug = 0.75, met = 0.0, alt = 0.0, cost = 0.0;
  vec3 S = vec3(0.0, 1.4658, 0.19), E = vec3(0.0453, 1.2564, 0.3802), W = vec3(0.1014, 1.0467, 0.5714);
  float tA, tB; vec3 cA = tSeg(q, S, E, tA), cB = tSeg(q, E, W, tB);
  float dA = length(q - cA), dB = length(q - cB);
  bool braco = q.y > 0.9 && (dB < 0.075 || (dA < 0.085 && tA > 0.22));
  vec3 H = vec3(0.0, 0.9758, 0.09), K = vec3(0.0183, 0.5277, 0.1138), A = vec3(-0.0166, 0.08, 0.1222);
  bool perna = !braco && q.y < 0.96;
  if (braco) {
    bool ante = dB < dA;
    if (ante && tB > 0.84) { cor = PELE; rug = 0.55; }                         // a mão
    else { cost = max(cost, tLinha(tB - 0.8, 0.01) * (ante ? 1.0 : 0.0)); }   // o punho da jaqueta
  } else if (perna) {
    cor = JEANS; rug = 0.85;
    float tw = sin((vUv0.x * 1.2 - vUv0.y) * 900.0);                          // a sarja do jeans
    cor *= 0.92 + 0.08 * tw * (1.0 - smoothstep(0.6, 1.6, fwidth((vUv0.x * 1.2 - vUv0.y) * 900.0)));
    vec3 c = q.y < K.y ? K : H; vec2 rn = normalize(vec2(q.x - c.x, q.z - c.z));
    cost = max(cost, tLinha(rn.y - 0.98, 0.03) * step(0.12, q.y));            // a costura de fora
    if (q.y < 0.115) { cor = SAPATO; rug = 0.35; met = 0.1; }                  // o sapato
    cost = max(cost, tLinha(q.y - 0.115, 0.004) + tLinha(q.y - 0.02, 0.004));
  } else {
    // camisa clara no V da jaqueta aberta, gola, botões; a jaqueta nos lados e nas costas; o cinto
    float abre = 0.035 + max(0.0, q.y - 1.0) * 0.16;
    bool frente = q.x > 0.03;
    if (frente && q.z < abre && q.y > 1.0) { cor = CAM; rug = 0.7; cost = max(cost, tLinha(fract(q.y * 12.0) - 0.5, 0.06) * tLinha(q.z, 0.008)); }
    cost = max(cost, frente ? tLinha(q.z - abre, 0.006) * step(1.0, q.y) : 0.0);
    if (q.y > 1.46 && q.y < 1.5 && frente) cor = mix(cor, CAM, step(q.z, 0.09));    // a gola
    if (q.y > 0.975 && q.y < 1.02) { cor = CINTO; rug = 0.4; if (frente && q.z < 0.025) { cor = vec3(0.6, 0.5, 0.3); met = 0.8; rug = 0.3; } }
    if (q.y > 1.5) { cor = PELE; rug = 0.55; }                                    // o pescoço
    cost = max(cost, frente ? tLinha(q.y - 1.12, 0.004) * step(abre + 0.02, q.z) * step(q.z, abre + 0.09) : 0.0);   // os bolsos
  }
  cor = mix(cor, cor * 0.45, cost);
  TR_COR = cor; TR_RUG = rug; TR_MET = met; TR_ALT = -cost * 0.6; TR_EMIS = vec3(0.0);
}
`;
const CABECA_CIVIL = /* glsl */ `
float MASCARA;
void traje(vec3 p) { MASCARA = 0.0; TR_COR = vec3(1.0); TR_RUG = 0.6; TR_MET = 0.0; TR_ALT = 0.0; TR_EMIS = vec3(0.0); }
`;

/** Liga o traje num material MeshStandard/MeshPhysical do corpo ('corpo') ou da cabeça ('cabeca', mantém a pele do mapa). */
export function aplicarTraje(material, parte, variante = 'heroi') {
  const ehCabeca = parte === 'cabeca', P = PALETAS[variante] || PALETAS.heroi;
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRep;\nvarying vec2 vUv0;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRep = position; vUv0 = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMUM + cores(P) + (P.desenho === 'novo' ? (ehCabeca ? CABECA_NOVO : CORPO_NOVO) : P.desenho === 'civil' ? (ehCabeca ? CABECA_CIVIL : CORPO_CIVIL) : (ehCabeca ? CABECA : CORPO)))
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
