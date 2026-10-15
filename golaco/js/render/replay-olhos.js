// Olhos do REPLAY do gol (pedidos do dono de 12/10: "uma 3ª e uma 4ª câmera de replay, onde uma é a visão em 1ª pessoa
// do jogador fazendo o gol" e "a 4ª pode ser a visão do treinador"). PURO (sem three.js nem DOM), no molde do
// replay-saot.js: lê o anel (render/replay-anel.js), que já tem todos os passos do plano — por isso suaviza SEM atraso
// (filtros de fase zero, centrados no passo) — e devolve, por passo do plano, onde fica o olho e para onde ele olha. O
// diretor (render/replay.js) só interpola entre dois passos. Testado em Node (tools/teste-replay-anel.mjs G6–G10).
//
// 1ª PESSOA (cam 'primeira'; REPLAY.primeira; PESQUISA-ESTADIO.md §13):
//  - olho bruto = a cabeça gravada + frente·0,085 + cima·0,03 (frente = horizontal, da linha dos ombros, como jogador3d
//    frente());
//  - x/z por gaussiana σ 0,08 s, presa a ≤ 2 cm do olho bruto na horizontal (≤ 6 cm depois da esfera, abaixo); y por
//    média móvel de 0,33 s (um passo) e gaussiana σ 0,26 s (15/10: era 0,22 — a postura que desce antes do chute deixava
//    1 cm de balanço; 0,26 deixa 0,8): a cabeça do manequim sobe e desce até ±9 cm correndo e o
//    cérebro estabiliza o olhar (Pozzo & Berthoz 1991); rolagem sempre 0; nada de balançar no ritmo da passada (Nesky,
//    GDC 2014 #44; Oculus: "do not use head bobbing"); presa a [cabeça − 0,14, cabeça + 0,16] e, por fim, dentro da
//    esfera de 0,148 m em volta do centro da cabeça (com a cabeça longe na vertical, o olho recua na horizontal até 3,5 cm
//    do centro — a altura não treme — e, passando disso, a altura é que fica presa: o olho a ≤ 5 cm do olho bruto);
//  - olhar (15/10, frente "replay robusto": tudo em ÂNGULO — rumo e arfagem por passo, suavizados e com o limite do giro;
//    antes, os pontos eram suavizados em posição e o ponto longe do gol se misturava com a bola no pé): até chute − 0,48 s a
//    bola puxada 60% para o centro da boca do gol (o autor vê o gol antes de bater), sem descer mais que 18° e com o rumo a
//    ≤ 32° do centro dela (a boca no quadro de 90° também com a bola cruzada de lado), já baixando até −20° nos 0,3 s antes;
//    de chute − 0,48 s a chute − 0,07 s o olhar desce em linha para o ponto do contato (a bola no passo do chute) e fica
//    nele até chute + 0,05 s; depois a bola, até chute + 0,2 s, e a bola puxada 35% para o gol (cabeceio: puxada 60% até
//    0,15 s antes do contato e 50% perto dele); o alvo nunca a < 0,6 m à frente do olho na direção do gol (a bola no pé
//    atrás do olho ou por cima da cabeça: o rumo dela é ruído); gaussiana σ 0,10 s (0,14 no cabeceio; 0,03 s em volta do
//    chute, senão o olhar do pé subia com a bola que já sai); arfagem em [−60°, +15°]; o GIRO com LIMITE de 85°/s no tempo
//    do replay (limitarGiro: ida e volta, a média — sem atraso) e gaussiana de 0,05 s por cima (arXiv 1611.06292: incomoda
//    a duração da mudança, não o tamanho: giros curtos e lentos);
//  - campo de visão HORIZONTAL de 90° fixo no plano (Nesky #41/#42; a faixa de conforto é dada em graus horizontais);
//    plano de recorte próximo de 0,10 m; a bola some a < 0,35 m do olho; os passos RUINS — outro corpo a < 0,3 m da lente
//    no quadro, a lente a < 0,12 m de algo sólido (o gol, as placas...) ou perto do chão, o próprio quadril/pernas a < 0,25 m
//    dela — cortam o plano (replay-roteiro.js planosExtrasGol: depois do chute acaba antes, antes do chute começa depois;
//    fica se sobrar ≥ 1,2 s reais; senão o plano sai).
// TREINADOR (cam 'treinador'; REPLAY.treinador): um plano com um CORTE no meio:
//  - parte 1 (o que ele vê): o olho na cabeça gravada do treinador (gaussiana σ 0,1 s, presa a ≤ 4 cm do olho bruto), o
//    olhar a meio caminho da bola e do centro da boca do gol (a bola sempre a ≤ 0,8 da meia largura do quadro), σ 0,12 s;
//    teleobjetiva FIXA no plano (o quadro com 30 m de largura na distância do gol, como a câmera 3 baixa da UEFA), sem
//    zoom dentro do plano (Nesky #42); ele sai da lista de desenho;
//  - parte 2 (ele reagindo): corte seco para uma câmera parada no gramado (z = meioZ − 0,7, 1,5 m de altura), que só gira
//    (gaussiana σ 0,25 s) para mantê-lo no terço esquerdo, inteiro no quadro, com a área técnica, o banco e a torcida de cá
//    atrás; o lugar dela é o de menos gente na frente dele no anel (como escolherGiroReacao da comemoração), fora dos
//    sólidos (estadio-forma.js solidoEm) e a ≥ 0,6 m de qualquer corpo.
import { REPLAY, CAMPO, PASSO } from '../config.js';
import { J, RAIO_CABECA, SEGMENTOS } from '../anim.js';
import { juntaNoTick, bolaNoTick, jogadorNoTick, poseNoTick } from './replay-anel.js';
import { solidoEm } from '../estadio-forma.js';
import { afastarDeTecnicos } from '../tecnicos.js';

const GRAU = Math.PI / 180;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const suave01 = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const s60 = s => Math.round(s * 60);
const ALTURA_GOL = CAMPO.gol.altura;

// ------------------------------------------------------------------------------------------------ utilidades
/** Suaviza `dim` componentes de n amostras (src) por gaussiana de σ `sig` passos, de fase zero (bordas repetidas). */
const _pesos = new Map();
function pesosGauss(sig) {
  let w = _pesos.get(sig);
  if (!w) {
    const R = Math.max(1, Math.ceil(3 * sig));
    w = new Float64Array(2 * R + 1);
    let s = 0;
    for (let k = -R; k <= R; k++) { w[k + R] = Math.exp(-(k * k) / (2 * sig * sig)); s += w[k + R]; }
    for (let k = 0; k < w.length; k++) w[k] /= s;
    _pesos.set(sig, w);
  }
  return w;
}
function gaussiana(src, n, dim, sig, out) {
  const w = pesosGauss(sig), R = (w.length - 1) >> 1;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < dim; c++) {
      let s = 0;
      for (let k = -R; k <= R; k++) { const j = i + k < 0 ? 0 : i + k > n - 1 ? n - 1 : i + k; s += src[j * dim + c] * w[k + R]; }
      out[i * dim + c] = s;
    }
  }
  return out;
}
/** Gaussiana de 1 componente com o σ (passos) de CADA amostra (sigs[i]), de fase zero (bordas repetidas). */
function gaussianaVar(src, n, sigs, out) {
  for (let i = 0; i < n; i++) {
    const sg = Math.max(0.3, sigs[i]), R = Math.max(1, Math.ceil(3 * sg));
    let s = 0, w = 0;
    for (let k = -R; k <= R; k++) { const j = i + k < 0 ? 0 : i + k > n - 1 ? n - 1 : i + k, p = Math.exp(-(k * k) / (2 * sg * sg)); s += src[j] * p; w += p; }
    out[i] = s / w;
  }
  return out;
}
/** Média móvel centrada de `janela` passos da componente c (bordas repetidas). */
function mediaMovel(src, n, dim, c, janela, out) {
  const R = Math.max(0, Math.floor(janela / 2));
  for (let i = 0; i < n; i++) {
    let s = 0, w = 0;
    for (let k = -R; k <= R; k++) { const j = clamp(i + k, 0, n - 1); s += src[j * dim + c]; w++; }
    out[i * dim + c] = s / w;
  }
  return out;
}

/**
 * Limite de velocidade angular do olhar (rumo `yaw` desenrolado e arfagem `arf`, rad, por passo; L = rad por passo): ida
 * (cada passo anda no máximo L na direção do alvo, medindo o rumo pelo cos da arfagem) e volta, e a média das duas, em
 * yaw/arf (no lugar).
 */
export function limitarGiro(yaw, arf, n, L) {
  if (n < 2) return;
  const fy = new Float64Array(n), fp = new Float64Array(n), by = new Float64Array(n), bp = new Float64Array(n);
  const passo = (sy, sp, ty, tp, o, k) => {
    const dy = (ty - sy) * Math.cos(sp), dp = tp - sp, m = Math.hypot(dy, dp), e = m > L ? L / m : 1;
    o[0][k] = sy + (ty - sy) * e; o[1][k] = sp + dp * e;
  };
  fy[0] = yaw[0]; fp[0] = arf[0];
  for (let i = 1; i < n; i++) passo(fy[i - 1], fp[i - 1], yaw[i], arf[i], [fy, fp], i);
  by[n - 1] = yaw[n - 1]; bp[n - 1] = arf[n - 1];
  for (let i = n - 2; i >= 0; i--) passo(by[i + 1], bp[i + 1], yaw[i], arf[i], [by, bp], i);
  for (let i = 0; i < n; i++) { yaw[i] = (fy[i] + by[i]) / 2; arf[i] = (fp[i] + bp[i]) / 2; }
}

/** fov vertical (graus) de um campo de visão horizontal fovH (graus) numa tela de aspecto a. */
export function fovVerticalDe(fovH, a) { return 2 * Math.atan(Math.tan((fovH * GRAU) / 2) / a) / GRAU; }

/**
 * Projeção (a mesma conta da three.js PerspectiveCamera + lookAt com "cima" = y): ponto (px, py, pz) visto da câmera em
 * (cx, cy, cz) olhando (lx, ly, lz), fov vertical `fov`° e aspecto a. out = {x, y (NDC: −1 a 1 dentro do quadro), z
 * (profundidade ao longo do olhar, m)}.
 */
export function projetar(cx, cy, cz, lx, ly, lz, fov, a, px, py, pz, out = { x: 0, y: 0, z: 0 }) {
  let fx = lx - cx, fy = ly - cy, fz = lz - cz;
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // direita da câmera = cima × (−frente) = (−fz, 0, fx); cima da câmera = (−frente) × direita
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = -fy * rz, uy = -(fz * rx - fx * rz), uz = fy * rx;
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  const zf = dx * fx + dy * fy + dz * fz, xr = dx * rx + dz * rz, yu = dx * ux + dy * uy + dz * uz;
  const t = Math.tan((fov * GRAU) / 2);
  out.z = zf; out.x = zf > 1e-6 ? xr / (zf * t * a) : Infinity; out.y = zf > 1e-6 ? yu / (zf * t) : Infinity;
  return out;
}
const dentroQuadro = (p, m = 1) => p.z > 0.05 && Math.abs(p.x) <= m && Math.abs(p.y) <= m;

// cabeça e ombros do jogador `id` no passo (null se não está no anel)
const _c = { x: 0, y: 0, z: 0 }, _oe = { x: 0, y: 0, z: 0 }, _od = { x: 0, y: 0, z: 0 };
/** Olho bruto (a cabeça gravada + frente·`frente` + cima·`cima`) em out; null se o jogador não está no passo. */
function olhoBruto(anel, tick, id, frente, cima, out) {
  if (!juntaNoTick(anel, tick, id, J.cabeca, _c) || !juntaNoTick(anel, tick, id, J.ombroE, _oe) || !juntaNoTick(anel, tick, id, J.ombroD, _od)) return null;
  const rx = _od.x - _oe.x, rz = _od.z - _oe.z, l = Math.hypot(rx, rz) || 1;
  const fx = rz / l, fz = -rx / l;
  out.x = _c.x + fx * frente; out.y = _c.y + cima; out.z = _c.z + fz * frente; out.cx = _c.x; out.cy = _c.y; out.cz = _c.z;
  return out;
}

/** O intervalo [de, ate] de passos do anel em volta de [a, b] (± margem) sem atravessar corte. */
function janelaValida(anel, a, b, margem) {
  let de = Math.max(anel.primeiro, a - margem), ate = Math.min(anel.ultimo, b + margem);
  const c0 = anel.ultimoCorte(de + 1, a); if (c0 != null) de = c0;
  const c1 = anel.primeiroCorte(b + 1, ate); if (c1 != null) ate = c1 - 1;
  return [de, ate];
}

const _o = { x: 0, y: 0, z: 0 }, _b = { x: 0, y: 0, z: 0 }, _p = { x: 0, y: 0, z: 0 };

// ------------------------------------------------------------------------------------------------ 1ª pessoa
/**
 * Enquadramento da 1ª pessoa do plano p = {de, ate, autor, chuteTick, golTick, lado, tipoChute}: para cada passo de de a
 * ate, o olho (suavizado), o olhar (um ponto para onde olhar), a bola escondida (perto da lente) e o olho bruto e a cabeça
 * (testes). Null se o autor não está no anel no plano.
 */
export function enquadrarPrimeira(anel, p) {
  const F = REPLAY.primeira, cab = p.tipoChute === 'cabeceio';
  const sigO = (cab ? F.sigmaCabeceio : F.sigmaOlhar) * 60;
  const M = Math.ceil(3 * Math.max(F.sigmaXZ * 60, sigO)) + Math.ceil(F.mediaY * 30) + 2;
  const [w0, w1] = janelaValida(anel, p.de, p.ate, M);
  const n = w1 - w0 + 1;
  if (n <= 0) return null;
  const bruto = new Float64Array(n * 3), cabeca = new Float64Array(n * 3);
  const gx = (p.lado >= 0 ? 1 : -1) * MX, gy = ALTURA_GOL / 2;
  let ultimo = -1;
  for (let i = 0; i < n; i++) {
    const t = w0 + i;
    const o = olhoBruto(anel, t, p.autor, F.frente, F.cima, _o);
    if (!o) { if (ultimo < 0) continue; for (let c = 0; c < 3; c++) { bruto[i * 3 + c] = bruto[ultimo * 3 + c]; cabeca[i * 3 + c] = cabeca[ultimo * 3 + c]; } }
    else { bruto[i * 3] = o.x; bruto[i * 3 + 1] = o.y; bruto[i * 3 + 2] = o.z; cabeca[i * 3] = o.cx; cabeca[i * 3 + 1] = o.cy; cabeca[i * 3 + 2] = o.cz; if (ultimo < 0) for (let k = 0; k < i; k++) for (let c = 0; c < 3; c++) { bruto[k * 3 + c] = o[c === 0 ? 'x' : c === 1 ? 'y' : 'z']; cabeca[k * 3 + c] = c === 0 ? o.cx : c === 1 ? o.cy : o.cz; } ultimo = i; }
  }
  if (ultimo < 0) return null;
  // olho: x/z gaussiana (σ sigmaXZ) presa a ≤ prendeXZ m do olho bruto na horizontal (nunca sai da cabeça); y média
  // móvel de um passo (mediaY s: o balanço da passada some) presa a [cabeça + yMin, cabeça + yMax] (no pé de apoio
  // mais fundo e no chute ela acompanha a cabeça)
  const olho = new Float64Array(n * 3);
  gaussiana(bruto, n, 3, F.sigmaXZ * 60, olho);
  mediaMovel(bruto, n, 3, 1, Math.round(F.mediaY * 60), olho);
  if (F.sigmaY > 0) { const ys = new Float64Array(n), yo = new Float64Array(n); for (let i = 0; i < n; i++) ys[i] = olho[i * 3 + 1]; gaussiana(ys, n, 1, F.sigmaY * 60, yo); for (let i = 0; i < n; i++) olho[i * 3 + 1] = yo[i]; }
  for (let i = 0; i < n; i++) {
    const dx = olho[i * 3] - bruto[i * 3], dz = olho[i * 3 + 2] - bruto[i * 3 + 2], d = Math.hypot(dx, dz);
    if (d > F.prendeXZ) { const k = F.prendeXZ / d; olho[i * 3] = bruto[i * 3] + dx * k; olho[i * 3 + 2] = bruto[i * 3 + 2] + dz * k; }
    const cy = cabeca[i * 3 + 1];
    olho[i * 3 + 1] = clamp(olho[i * 3 + 1], cy + F.yMin, cy + F.yMax);
    // dentro da esfera de raio `raioCabeca` em volta do centro da cabeça: com a cabeça longe na vertical (o balanço da
    // passada), o olho recua na horizontal para o centro dela (a altura fica estável)
    // (15/10: o recuo na horizontal vai até `olhoHMin` m do centro — sem limite, o olho ia a 5,7 cm do olho bruto, G6: ≤ 6;
    // com o limite em 6 cm, a altura presa balançava com a passada, 1,4 cm, G6: ≤ 1 —; passando, a altura é que fica presa
    // na esfera)
    const hx = olho[i * 3] - cabeca[i * 3], hz = olho[i * 3 + 2] - cabeca[i * 3 + 2], hy = olho[i * 3 + 1] - cy, R = F.raioCabeca;
    if (hx * hx + hy * hy + hz * hz > R * R) {
      const hh = Math.hypot(hx, hz);
      let dyA = Math.min(Math.abs(hy), R * 0.98);
      const hMax = Math.max(Math.min(hh, F.olhoHMin), Math.sqrt(R * R - dyA * dyA));
      if (hh > hMax) { olho[i * 3] = cabeca[i * 3] + hx * hMax / hh; olho[i * 3 + 2] = cabeca[i * 3 + 2] + hz * hMax / hh; }
      dyA = Math.min(dyA, Math.sqrt(Math.max(0, R * R - Math.min(hh, hMax) ** 2)));
      if (Math.abs(hy) > dyA) olho[i * 3 + 1] = cy + Math.sign(hy) * dyA;
    }
  }
  // olhar bruto por passo (antes da suavização). Antes do chute (até chute − baixaAntes) o olhar vai da bola para a boca
  // do gol (puxaAntes: o autor levanta a cabeça e vê o gol antes de bater), sem descer mais que arfagemAntes° (a boca do
  // gol fica no quadro também no celular deitado); no chute, a bola e o pé; depois, a bola puxada puxaGol para o gol
  const ch = p.chuteTick;
  // o alvo de antes do chute: a bola puxada puxaAntes para o gol, sem descer mais que arfagemAntes°, e a boca do gol sempre
  // no quadro (o rumo a ≤ golAngMax° do centro dela; 15/10: a bola cruzada de lado, a 120° do gol, puxada 60% para ele,
  // deixava os dois fora dos 90° do quadro)
  const antes = (i, b, o) => {
    let x = b.x + (gx - b.x) * F.puxaAntes, y = b.y + (gy - b.y) * F.puxaAntes, z = b.z + (0 - b.z) * F.puxaAntes;
    const ox = olho[i * 3], oy = olho[i * 3 + 1], oz = olho[i * 3 + 2], dh = Math.max(0.5, Math.hypot(x - ox, z - oz));
    if (!cab) { const yMin = oy + dh * Math.tan(F.arfagemAntes * GRAU); if (y < yMin) y = yMin; }
    const yg = Math.atan2(-oz, gx - ox);
    let d = Math.atan2(z - oz, x - ox) - yg;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > F.golAngMax * GRAU) { const yN = yg + Math.sign(d) * F.golAngMax * GRAU; x = ox + Math.cos(yN) * dh; z = oz + Math.sin(yN) * dh; }
    o.x = x; o.y = y; o.z = z;
    return o;
  };
  const _a = { x: 0, y: 0, z: 0 };
  // depois do chute (de chute + baixaDepois em diante) o mesmo limite: o rumo do alvo a ≤ golAngMax° do centro da boca do
  // gol, à mesma distância (contraprova 15/10: o autor que cabeceia perto do gol e segue correndo atrás da bola via a bola
  // puxada 35% a 45–50° do centro da boca, e ela saía do quadro de 90° antes do gol — cabeceio-ia, semente 80)
  const noGol = (i, o) => {
    const ox = olho[i * 3], oz = olho[i * 3 + 2], dh = Math.hypot(o.x - ox, o.z - oz), yg = Math.atan2(-oz, gx - ox);
    let d = Math.atan2(o.z - oz, o.x - ox) - yg;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > F.golAngMax * GRAU) { const yN = yg + Math.sign(d) * F.golAngMax * GRAU; o.x = ox + Math.cos(yN) * dh; o.z = oz + Math.sin(yN) * dh; }
    return o;
  };
  // o ponto (x, y, z) visto do olho i em rumo/arfagem (piso à frente — 15/10: no referencial do gol, a = para o gol, o alvo
  // nunca fica a menos de `pisoFrente` m à frente do olho; a bola no pé, atrás do olho com o corpo inclinado, ou passando
  // por cima da cabeça tem o rumo de ruído e o limite do giro dava a volta inteira para segui-lo — e a arfagem presa)
  const ang = (i, x, y, z, o) => {
    const ox = olho[i * 3], oy = olho[i * 3 + 1], oz = olho[i * 3 + 2], ux = gx - ox, uz = -oz, ul = Math.hypot(ux, uz) || 1, fx = ux / ul, fz = uz / ul;
    const a = (x - ox) * fx + (z - oz) * fz;
    if (a < F.pisoFrente) { x += fx * (F.pisoFrente - a); z += fz * (F.pisoFrente - a); }
    o[0] = Math.atan2(z - oz, x - ox);
    o[1] = clamp(Math.atan2(y - oy, Math.hypot(x - ox, z - oz) || 1e-6), F.arfagem[0] * GRAU, F.arfagem[1] * GRAU);
    return o;
  };
  const _g1 = [0, 0], _g2 = [0, 0];
  // a descida do olhar para a bola e o pé (chute): de chute − desce[0] a chute − desce[1] s, o olhar vai do alvo de antes
  // para a bola (smoothstep, em ÂNGULO) — 15/10: a troca seca a chute − 0,3 s, suavizada em posição (o ponto longe de antes
  // com a bola no pé e com a bola que já sobe), deixava o olhar a −35° com a bola a −70°: abaixo do quadro no chute
  // (o fim da descida e até chute + `pe` s: o ponto do contato — a bola no passo do chute —, sem o olhar subir com a bola
  // que já sai antes dela sair: a suavização em volta do chute via a bola subindo e deixava a do pé abaixo do quadro)
  const d0 = ch - s60(F.desce[0]), d1 = ch - s60(F.desce[1]);
  const bc = { ...(bolaNoTick(anel, ch, {}) ?? { x: gx, y: 0.11, z: 0 }) };
  const yaw = new Float64Array(n), arfA = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = w0 + i, b = bolaNoTick(anel, t, _b) ?? _b;
    let x = b.x, y = b.y, z = b.z;
    if (cab) {
      // cabeceio: na bola até cabeceioOlhaGol s antes do contato; depois a bola a meio caminho do gol (puxaCabeceio) e,
      // passado o contato, como no chute (a bola que sobe da cabeça fica no quadro)
      // (15/10: do contato a contato + baixaDepois, a bola mesma, como no chute — a cabeçada para o chão, puxada 50% para o
      // gol, deixava a bola que quica no pé abaixo do quadro)
      if (t > ch + s60(F.baixaDepois)) { x += (gx - x) * F.puxaGol; y += (gy - y) * F.puxaGol; z += (0 - z) * F.puxaGol; _a.x = x; _a.z = z; noGol(i, _a); x = _a.x; z = _a.z; }
      else if (t >= ch) { /* a bola */ }
      else if (t >= ch - s60(F.cabeceioOlhaGol)) { x += (gx - x) * F.puxaCabeceio; y += (gy - y) * F.puxaCabeceio; z += (0 - z) * F.puxaCabeceio; }
      else if (t < ch - s60(F.baixaAntes)) { antes(i, b, _a); x = _a.x; y = _a.y; z = _a.z; }
      else { x += (gx - x) * F.puxaAntes; y += (gy - y) * F.puxaAntes; z += (0 - z) * F.puxaAntes; }
      ang(i, x, y, z, _g1);
    } else if (t > ch + s60(F.baixaDepois)) {
      x += (gx - x) * F.puxaGol; y += (gy - y) * F.puxaGol; z += (0 - z) * F.puxaGol;
      _a.x = x; _a.z = z; noGol(i, _a);
      ang(i, _a.x, y, _a.z, _g1);
    } else if (t < d1) {
      antes(i, b, _a);
      ang(i, _a.x, _a.y, _a.z, _g1);
      // chegando a chute − desce[0], o olhar já vem baixando até arfagemDesce° (a boca do gol ainda no alto do quadro): a
      // descida depois cabe no limite do giro
      const ua = clamp((t - (d0 - s60(F.desceAntes))) / Math.max(1, s60(F.desceAntes)), 0, 1);
      _g1[1] = Math.min(_g1[1], F.arfagem[1] * GRAU + (F.arfagemDesce - F.arfagem[1]) * GRAU * ua);
      if (t > d0) {
        const u = clamp((t - d0) / Math.max(1, d1 - d0), 0, 1);
        ang(i, bc.x, bc.y, bc.z, _g2);
        let dy = _g2[0] - _g1[0];
        while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        _g1[0] += dy * u; _g1[1] += (_g2[1] - _g1[1]) * u;
      }
    } else if (t <= ch + s60(F.pe)) ang(i, bc.x, bc.y, bc.z, _g1);
    else ang(i, x, y, z, _g1);
    yaw[i] = _g1[0]; arfA[i] = _g1[1];
    if (i) { while (yaw[i] - yaw[i - 1] > Math.PI) yaw[i] -= 2 * Math.PI; while (yaw[i] - yaw[i - 1] < -Math.PI) yaw[i] += 2 * Math.PI; }
  }
  // depois do fim do plano, o olhar fica o do último passo dele (contraprova 15/10: os passos depois do fim — o autor já
  // dentro do gol, passando pela bola, o "para o gol" virado para trás — puxavam o olhar de dentro do plano pela suavização
  // e pelo limite do giro, que anda para trás: ele girou até 107° da boca do gol)
  for (let i = Math.max(1, p.ate - w0 + 1); i < n; i++) { yaw[i] = yaw[i - 1]; arfA[i] = arfA[i - 1]; }
  // suavizado em ângulo (σ sigmaOlhar; sigmaCabeceio no cabeceio); no chute (±sigmaChute[1] s, entrando até ±sigmaChute[2]),
  // σ sigmaChute[0] s: a σ de 0,1 s levava o olhar do pé (−60°, uns 8 passos) para −48° e a bola do chute saía por baixo
  {
    const sigs = new Float64Array(n), q0 = s60(F.sigmaChute[1]), q1 = s60(F.sigmaChute[2]);
    for (let i = 0; i < n; i++) {
      const dt = Math.abs(w0 + i - ch), u = cab && w0 + i < ch ? 0 : dt <= q0 ? 1 : dt >= q1 ? 0 : 1 - (dt - q0) / (q1 - q0);
      sigs[i] = sigO + (F.sigmaChute[0] * 60 - sigO) * u;
    }
    const y2 = gaussianaVar(yaw, n, sigs, new Float64Array(n)), a2 = gaussianaVar(arfA, n, sigs, new Float64Array(n));
    yaw.set(y2); arfA.set(a2);
  }
  // giro com LIMITE de velocidade angular (giroMax °/s no tempo do replay, a vel ×): uma passada para a frente e uma para
  // trás, a média das duas (sem atraso; a média de duas curvas que respeitam o limite também respeita) e uma gaussiana
  // curta por cima (a aceleração suave)
  limitarGiro(yaw, arfA, n, F.giroMax * GRAU / (60 * F.vel));
  const yawS = gaussiana(yaw, n, 1, F.sigmaGiro * 60, new Float64Array(n)), arfS = gaussiana(arfA, n, 1, F.sigmaGiro * 60, new Float64Array(n));
  const dir = new Float64Array(n * 3), bolaSome = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    dir[i * 3] = Math.cos(yawS[i]) * Math.cos(arfS[i]); dir[i * 3 + 1] = Math.sin(arfS[i]); dir[i * 3 + 2] = Math.sin(yawS[i]) * Math.cos(arfS[i]);
    const b = bolaNoTick(anel, w0 + i, _b);
    if (b && Math.hypot(b.x - olho[i * 3], b.y - olho[i * 3 + 1], b.z - olho[i * 3 + 2]) < F.bolaSome) bolaSome[i] = 1;
  }
  return { tipo: 'primeira', de: p.de, ate: p.ate, w0, n, olho, dir, bruto, cabeca, bolaSome, fovH: F.fovH, perto: F.perto, autor: p.autor };
}

/** Câmera da 1ª pessoa no passo fracionário t: out {x, y, z, lx, ly, lz (ponto do olhar), fovH, bolaSome}. */
export function cameraPrimeira(e, t, out = {}) {
  const u = clamp(t - e.w0, 0, e.n - 1), i0 = Math.floor(u), i1 = Math.min(e.n - 1, i0 + 1), f = u - i0;
  const L = (a, c) => a[i0 * 3 + c] + (a[i1 * 3 + c] - a[i0 * 3 + c]) * f;
  out.x = L(e.olho, 0); out.y = L(e.olho, 1); out.z = L(e.olho, 2);
  let dx = L(e.dir, 0), dy = L(e.dir, 1), dz = L(e.dir, 2);
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  out.lx = out.x + dx * 10; out.ly = out.y + dy * 10; out.lz = out.z + dz * 10;
  out.fovH = e.fovH; out.bolaSome = !!e.bolaSome[Math.round(u)];
  return out;
}

// corpos (cápsulas) de um jogador gravado: distância do ponto à superfície mais perto (e o ponto dela)
const _pose = new Float32Array(57), _xz = { x: 0, z: 0 };
function distCorpo(pose, px, py, pz, perto) {
  let dm = Infinity;
  for (const [a, b, ra, rb] of SEGMENTOS) {
    const ax = pose[a * 3], ay = pose[a * 3 + 1], az = pose[a * 3 + 2], bx = pose[b * 3], by = pose[b * 3 + 1], bz = pose[b * 3 + 2];
    const vx = bx - ax, vy = by - ay, vz = bz - az, l2 = vx * vx + vy * vy + vz * vz || 1e-9;
    const t = clamp(((px - ax) * vx + (py - ay) * vy + (pz - az) * vz) / l2, 0, 1);
    const qx = ax + vx * t, qy = ay + vy * t, qz = az + vz * t;
    const d = Math.hypot(px - qx, py - qy, pz - qz) - (ra + (rb - ra) * t);
    if (d < dm) { dm = d; if (perto) { perto.x = qx; perto.y = qy; perto.z = qz; } }
  }
  const ic = J.cabeca * 3, d = Math.hypot(px - pose[ic], py - pose[ic + 1], pz - pose[ic + 2]) - RAIO_CABECA;
  if (d < dm) { dm = d; if (perto) { perto.x = pose[ic]; perto.y = pose[ic + 1]; perto.z = pose[ic + 2]; } }
  return dm;
}

/**
 * Primeiro passo do plano em que outro corpo fica a < `dmin` m da lente dentro do quadro (1ª pessoa; aspecto mais largo
 * que vai à tela: 16:9 e o celular), ou −1. sem = ids que não contam (o próprio autor). Com `todos` (uma lista), põe nela
 * TODOS os passos assim (e devolve o primeiro).
 */
export function corpoNaLente(anel, e, dmin, sem, todos = null) {
  const _cam = {}, perto = { x: 0, y: 0, z: 0 }, pr = { x: 0, y: 0, z: 0 };
  let primeiro = -1;
  for (let t = e.de; t <= e.ate; t++) {
    cameraPrimeira(e, t, _cam);
    const s = anel.slot(t);
    if (s < 0) continue;
    let ruim = false;
    for (let v = 0; v < anel.nVagas[s] && !ruim; v++) {
      const i = s * anel.vagas + v, id = anel.ids[i];
      if (id < 0 || id === sem) continue;
      const cx = anel.dados[i * anel.K + anel.P], cz = anel.dados[i * anel.K + anel.P + 1];
      if (Math.hypot(cx - _cam.x, cz - _cam.z) > 2.2) continue;
      poseNoTick(anel, t, id, _pose);
      const d = distCorpo(_pose, _cam.x, _cam.y, _cam.z, perto);
      if (d >= dmin) continue;
      // no quadro (o ponto do corpo mais perto, com a folga do raio)
      for (const a of [16 / 9, 844 / 390]) {
        projetar(_cam.x, _cam.y, _cam.z, _cam.lx, _cam.ly, _cam.lz, fovVerticalDe(e.fovH, a), a, perto.x, perto.y, perto.z, pr);
        if (pr.z > -0.3 && Math.abs(pr.x) <= 1.3 && Math.abs(pr.y) <= 1.3) { ruim = true; break; }
      }
    }
    if (!ruim) continue;
    if (primeiro < 0) primeiro = t;
    if (!todos) return t;
    todos.push(t);
  }
  return primeiro;
}

// a 1ª pessoa DESENHA do próprio autor só o quadril e as pernas (render/jogador3d.js OCULTA_TRONCO tira a cabeça, o
// pescoço, o peito, os ombros e os braços: a mesma regra, pelo nome das juntas)
const NOME_J = Object.fromEntries(Object.entries(J).map(([n, i]) => [i, n]));
const VISIVEL_1P = SEGMENTOS.map(([a, b]) => !(/pescoco|peito|ombro|cotovelo|mao|cabeca/.test(NOME_J[a] + ' ' + NOME_J[b]) || (NOME_J[a] === 'lombar' && NOME_J[b] === 'peito')));

/**
 * Primeiro passo do plano da 1ª pessoa (de e.de a e.ate, também no meio dos passos: o desenho interpola) com a LENTE
 * dentro de algo sólido do estádio (estadio-forma.js solidoEm com `folga` m: o gol inteiro — a estrutura e o vão —, as
 * placas, os bancos...; o chão a < e.perto + folga) ou com o que se vê do próprio autor (o quadril e as pernas) a < `proprio`
 * m dela; −1 se nenhum. (15/10: o autor que segue para dentro do gol depois de marcar levava a lente para dentro da trave e
 * da rede.)
 */
export function lenteRuimPrimeira(anel, e, folga, proprio, todos = null) {
  const c = {};
  let primeiro = -1;
  for (let t2 = 2 * e.de; t2 <= 2 * e.ate + 1; t2++) {
    const t = Math.min(e.ate, t2 / 2), ti = Math.floor(t);
    if (todos && todos.length && todos[todos.length - 1] === ti) continue;
    cameraPrimeira(e, t, c);
    let ruim = c.y < e.perto + folga;
    if (!ruim) { const so = solidoEm(c.x, c.y, c.z, folga, false); ruim = !!so && so !== 'chão'; }
    if (!ruim && t2 % 2 === 0 && poseNoTick(anel, ti, e.autor, _pose)) {
      for (let si = 0; si < SEGMENTOS.length && !ruim; si++) {
        if (!VISIVEL_1P[si]) continue;
        const [ja, jb, ra, rb] = SEGMENTOS[si];
        const ax = _pose[ja * 3], ay = _pose[ja * 3 + 1], az = _pose[ja * 3 + 2], vx = _pose[jb * 3] - ax, vy = _pose[jb * 3 + 1] - ay, vz = _pose[jb * 3 + 2] - az;
        const l2 = vx * vx + vy * vy + vz * vz || 1e-9, u = clamp(((c.x - ax) * vx + (c.y - ay) * vy + (c.z - az) * vz) / l2, 0, 1);
        if (Math.hypot(c.x - ax - vx * u, c.y - ay - vy * u, c.z - az - vz * u) - (ra + (rb - ra) * u) < proprio) ruim = true;
      }
    }
    if (!ruim) continue;
    if (primeiro < 0) primeiro = ti;
    if (!todos) return ti;
    todos.push(ti);
  }
  return primeiro;
}

// ------------------------------------------------------------------------------------------------ treinador
/**
 * Enquadramento da visão do treinador do plano p = {de, corte, ate, tecnico (id), golTick, chuteTick, lado}: a parte 1 (o
 * olho na cabeça dele e o olhar entre a bola e o gol; o campo de visão horizontal FIXO pela distância ao gol) e a parte 2
 * (a câmera parada no gramado escolhida aqui, girando para mantê-lo no terço esquerdo). Null sem o treinador no anel. Sem
 * lugar para a câmera da parte 2, devolve só a parte 1 (e2.ok = false).
 */
export function enquadrarTreinador(anel, p, opc = {}) {
  const Tr = REPLAY.treinador;
  const id = p.tecnico, gx = (p.lado >= 0 ? 1 : -1) * MX, gy = ALTURA_GOL / 2;
  const fim1 = p.corte ?? p.ate;
  const M = Math.ceil(3 * Math.max(Tr.sigmaOlho, Tr.sigmaOlhar, Tr.sigmaGiro) * 60) + 2;
  const [w0, w1] = janelaValida(anel, p.de, p.ate, M);
  const n = w1 - w0 + 1;
  if (n <= 0 || !jogadorNoTick(anel, p.golTick, id)) return null;
  // parte 1: olho e olhar
  const bruto = new Float64Array(n * 3), cabeca = new Float64Array(n * 3), bola = new Float64Array(n * 3);
  let ultimo = -1;
  for (let i = 0; i < n; i++) {
    const t = w0 + i, o = olhoBruto(anel, t, id, Tr.frente, Tr.cima, _o);
    if (o) { bruto[i * 3] = o.x; bruto[i * 3 + 1] = o.y; bruto[i * 3 + 2] = o.z; cabeca[i * 3] = o.cx; cabeca[i * 3 + 1] = o.cy; cabeca[i * 3 + 2] = o.cz; if (ultimo < 0) for (let k = 0; k < i; k++) for (let c = 0; c < 3; c++) { bruto[k * 3 + c] = bruto[i * 3 + c]; cabeca[k * 3 + c] = cabeca[i * 3 + c]; } ultimo = i; }
    else if (ultimo >= 0) for (let c = 0; c < 3; c++) { bruto[i * 3 + c] = bruto[ultimo * 3 + c]; cabeca[i * 3 + c] = cabeca[ultimo * 3 + c]; }
    const b = bolaNoTick(anel, t, _b);
    if (b) { bola[i * 3] = b.x; bola[i * 3 + 1] = b.y; bola[i * 3 + 2] = b.z; } else if (i > 0) for (let c = 0; c < 3; c++) bola[i * 3 + c] = bola[(i - 1) * 3 + c];
  }
  if (ultimo < 0) return null;
  const olho = gaussiana(bruto, n, 3, Tr.sigmaOlho * 60, new Float64Array(n * 3));
  // presa a ≤ prende m do olho bruto (15/10: a cabeça dele correndo, agachando e levantando na reação ao gol — mais depressa
  // que a gaussiana acompanha — levava o olho a 0,19 m da cabeça gravada)
  for (let i = 0; i < n; i++) {
    const dx = olho[i * 3] - bruto[i * 3], dy = olho[i * 3 + 1] - bruto[i * 3 + 1], dz = olho[i * 3 + 2] - bruto[i * 3 + 2], d = Math.hypot(dx, dy, dz);
    if (d > Tr.prende) { const k = Tr.prende / d; olho[i * 3] = bruto[i * 3] + dx * k; olho[i * 3 + 1] = bruto[i * 3 + 1] + dy * k; olho[i * 3 + 2] = bruto[i * 3 + 2] + dz * k; }
  }
  // lente: o quadro com `largura` m na distância do gol (no passo do gol), fixa no plano
  const ig = clamp(p.golTick - w0, 0, n - 1);
  const dGol = Math.hypot(gx - olho[ig * 3], 0 - olho[ig * 3 + 2]);
  const fovH = 2 * Math.atan(Tr.largura / 2 / Math.max(5, dGol)) / GRAU;
  const meiaT = Math.tan((fovH * GRAU) / 2) * Tr.bolaNdc;
  // olhar: a meio caminho da bola (suavizada) e do gol, em ângulo; a bola nunca além de bolaNdc da meia largura
  const bolaS = gaussiana(bola, n, 3, Tr.sigmaOlhar * 60, new Float64Array(n * 3));
  const yaw = new Float64Array(n), arf = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ox = olho[i * 3], oy = olho[i * 3 + 1], oz = olho[i * 3 + 2];
    const yb = Math.atan2(bolaS[i * 3 + 2] - oz, bolaS[i * 3] - ox), yg = Math.atan2(0 - oz, gx - ox);
    let d = yg - yb; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    let y = yb + d * Tr.puxaGol;
    const lim = Math.atan(meiaT);
    if (Math.abs(y - yb) > lim) y = yb + Math.sign(y - yb) * lim;
    yaw[i] = y;
    const db = Math.hypot(bolaS[i * 3] - ox, bolaS[i * 3 + 2] - oz), dg = Math.hypot(gx - ox, oz);
    const ab = Math.atan2(bolaS[i * 3 + 1] - oy, db), ag = Math.atan2(gy - oy, dg);
    arf[i] = ab + (ag - ab) * Tr.puxaGol;
  }
  // gaussiana nos ângulos (yaw desenrolado)
  for (let i = 1; i < n; i++) { while (yaw[i] - yaw[i - 1] > Math.PI) yaw[i] -= 2 * Math.PI; while (yaw[i] - yaw[i - 1] < -Math.PI) yaw[i] += 2 * Math.PI; }
  const yawS = gaussiana(yaw, n, 1, Tr.sigmaOlhar * 60, new Float64Array(n)), arfS = gaussiana(arf, n, 1, Tr.sigmaOlhar * 60, new Float64Array(n));
  const dir = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) { dir[i * 3] = Math.cos(yawS[i]) * Math.cos(arfS[i]); dir[i * 3 + 1] = Math.sin(arfS[i]); dir[i * 3 + 2] = Math.sin(yawS[i]) * Math.cos(arfS[i]); }
  const e = { tipo: 'treinador', de: p.de, ate: p.ate, corte: p.corte, w0, n, olho, dir, bruto, cabeca, fovH, tecnico: id, dGol, parte2: null };
  if (p.corte != null && p.ate > p.corte) e.parte2 = parte2Treinador(anel, p, opc);
  return e;
}

/**
 * Parte 2 da visão do treinador: a câmera parada no gramado que o mostra reagindo. Candidatos em z = meioZ − recuoZ (e um
 * pouco mais para dentro) e x dos dois lados dele; vale o que o mantém INTEIRO no quadro no terço esquerdo em todos os
 * passos, fora dos sólidos, a ≥ 0,6 m de qualquer corpo, sem nada a < 2 m da lente no quadro, com o menos tempo de gente
 * na frente da cabeça e do peito dele. Null se nenhum serve.
 */
export function parte2Treinador(anel, p, opc = {}) {
  const Tr = REPLAY.treinador, id = p.tecnico;
  const de = p.corte, ate = p.ate, n = ate - de + 1;
  if (n < 2) return null;
  // o treinador (centro) por passo, suavizado (σ sigmaGiro)
  const cx = new Float64Array(n * 3);
  const _j = { x: 0, z: 0 };
  for (let i = 0; i < n; i++) {
    const j = jogadorNoTick(anel, de + i, id, _j);
    if (j) { cx[i * 3] = j.x; cx[i * 3 + 2] = j.z; } else if (i) { cx[i * 3] = cx[(i - 1) * 3]; cx[i * 3 + 2] = cx[(i - 1) * 3 + 2]; } else return null;
    cx[i * 3 + 1] = 0.92;
  }
  const alvo = gaussiana(cx, n, 3, Tr.sigmaGiro * 60, new Float64Array(n * 3));
  let mx = 0, mz = 0;
  for (let i = 0; i < n; i++) { mx += cx[i * 3]; mz += cx[i * 3 + 2]; }
  mx /= n; mz /= n;
  // amostras (a cada `cada` passos e o último) com os outros corpos de cada uma (x, z) e os pontos do corpo DELE que têm de
  // caber no quadro (o alto da cabeça, os tornozelos e as pontas dos pés: correndo, o pé da frente vai mais perto da
  // câmera que o centro), lidos do anel uma vez
  const cada = 2, ns = Math.floor((n - 1) / cada) + 1 + ((n - 1) % cada ? 1 : 0);
  const amostra = new Int32Array(ns), nCorpos = new Uint8Array(ns), corpos = new Float64Array(ns * anel.vagas * 2);
  const PONTOS = [J.cabeca, J.tornozeloE, J.tornozeloD, J.pontaE, J.pontaD], pts = new Float64Array(ns * PONTOS.length * 3);
  for (let a = 0; a < ns; a++) {
    const i = Math.min(n - 1, a * cada); amostra[a] = i;
    const s = anel.slot(de + i);
    if (s < 0) continue;
    if (poseNoTick(anel, de + i, id, _pose)) {
      for (let q = 0; q < PONTOS.length; q++) {
        const o = (a * PONTOS.length + q) * 3, k = PONTOS[q] * 3;
        pts[o] = _pose[k]; pts[o + 1] = _pose[k + 1] + (q === 0 ? RAIO_CABECA * 1.1 : 0); pts[o + 2] = _pose[k + 2];
      }
    } else for (let q = 0; q < PONTOS.length; q++) { const o = (a * PONTOS.length + q) * 3; pts[o] = cx[i * 3]; pts[o + 1] = q === 0 ? 1.82 : 0.03; pts[o + 2] = cx[i * 3 + 2]; }
    for (let v = 0; v < anel.nVagas[s]; v++) {
      const k = s * anel.vagas + v;
      if (anel.ids[k] < 0 || anel.ids[k] === id) continue;
      const o = (a * anel.vagas + nCorpos[a]) * 2;
      corpos[o] = anel.dados[k * anel.K + anel.P]; corpos[o + 1] = anel.dados[k * anel.K + anel.P + 1];
      nCorpos[a]++;
    }
  }
  // telas que o quadro tem de servir: PC 16:9 e os celulares deitados (fov × 0,88); por tela, o fov e o desvio do olhar
  const telas = opc.telas ?? [[16 / 9, false], [844 / 390, true], [568 / 320, true]];
  const T = telas.map(([a, peq]) => {
    let f = Tr.fov * (peq ? 0.88 : 1);
    if (a < 16 / 9) f = 2 * Math.atan(Math.tan((f * GRAU) / 2) * (16 / 9) / a) / GRAU;
    return { a, f, desv: Math.atan(Math.tan((f * GRAU) / 2) * a * (1 - 2 * Tr.terco)) };
  });
  const pr = { x: 0, y: 0, z: 0 };
  let melhor = null;
  // candidatos na ordem de preferência (a ~4,5 m dele, dos dois lados; depois mais longe ou mais para dentro do campo)
  const cands = [];
  for (const zc of [MZ - Tr.recuoZ, MZ - Tr.recuoZ - 1.2, MZ - Tr.recuoZ - 2.4]) for (const ox of [3.5, -3.5, 2.5, -2.5, 4.5, -4.5, 5.5, -5.5, 1.5, -1.5, 6.5, -6.5]) cands.push([mx + ox, zc]);
  for (const [camX, camZ] of cands) {
    const cam = { x: camX, y: Tr.altura, z: camZ };
    const dist0 = Math.hypot(cam.x - mx, cam.z - mz);
    if (dist0 < Tr.dist[0] - 0.01 || dist0 > Tr.dist[1]) continue;
    if (solidoEm(cam.x, cam.y, cam.z, 0.3, false)) continue;
    let ok = true, ocl = 0;
    for (let a = 0; a < ns && ok; a++) {
      const i = amostra[a], ax = alvo[i * 3], az = alvo[i * 3 + 2], d = Math.hypot(ax - cam.x, az - cam.z);
      if (d < Tr.dist[0] - 0.3) { ok = false; break; }
      const yc = Math.atan2(az - cam.z, ax - cam.x);
      // o corpo inteiro (os pés e o alto da cabeça) no quadro em cada tela (em x ele fica no terço esquerdo por construção)
      let lx0 = 0, lz0 = 0;
      for (let q = 0; q < T.length && ok; q++) {
        const ya = yc + T[q].desv, lx = cam.x + Math.cos(ya) * d, lz = cam.z + Math.sin(ya) * d;
        if (q === 0) { lx0 = lx; lz0 = lz; }
        for (let k = 0; k < PONTOS.length; k++) {
          const o = (a * PONTOS.length + k) * 3;
          projetar(cam.x, cam.y, cam.z, lx, 0.92, lz, T[q].f, T[q].a, pts[o], pts[o + 1], pts[o + 2], pr);
          if (!(pr.z > 0.1 && Math.abs(pr.y) <= 0.97 && Math.abs(pr.x) <= 0.97)) { ok = false; break; }
        }
      }
      if (!ok) break;
      // os outros corpos: a ≥ corpoMin da câmera, nada a < 2 m dela no quadro, gente na frente da cabeça e do peito dele
      const tx = cx[i * 3] - cam.x, tz = cx[i * 3 + 2] - cam.z, tl2 = tx * tx + tz * tz;
      for (let c = 0; c < nCorpos[a]; c++) {
        const o = (a * anel.vagas + c) * 2, bx = corpos[o], bz = corpos[o + 1];
        const dc = Math.hypot(bx - cam.x, bz - cam.z);
        if (dc < Tr.corpoMin + 0.35) { ok = false; break; }
        if (dc < 2.4) {
          projetar(cam.x, cam.y, cam.z, lx0, 0.92, lz0, T[0].f, T[0].a, bx, 1.0, bz, pr);
          if (pr.z > 0 && Math.abs(pr.x) < 1.3) { ok = false; break; }
        }
        const u = ((bx - cam.x) * tx + (bz - cam.z) * tz) / tl2;
        if (u > 0.02 && u < 0.98 && Math.hypot(bx - cam.x - tx * u, bz - cam.z - tz * u) < 0.45) ocl++;
      }
    }
    if (!ok) continue;
    const custo = ocl / ns;
    if (!melhor || custo < melhor.custo - 1e-9) melhor = { custo, cam };
    if (custo === 0) break;  // ninguém na frente: o de preferência fica
  }
  if (!melhor) return null;
  return { de, ate, n, cam: melhor.cam, alvo, ocl: melhor.custo, fov: Tr.fov, terco: Tr.terco };
}

/**
 * Câmera da visão do treinador no passo fracionário t (aspecto a, `pequena` = celular): out {parte (1 | 2), x, y, z, lx, ly,
 * lz, fov (vertical, graus)}.
 */
export function cameraTreinador(e, t, a, pequena, out = {}) {
  const Tr = REPLAY.treinador;
  if (e.parte2 && e.corte != null && t >= e.corte) {
    const q = e.parte2, u = clamp(t - q.de, 0, q.n - 1), i0 = Math.floor(u), i1 = Math.min(q.n - 1, i0 + 1), f = u - i0;
    const ax = q.alvo[i0 * 3] + (q.alvo[i1 * 3] - q.alvo[i0 * 3]) * f, az = q.alvo[i0 * 3 + 2] + (q.alvo[i1 * 3 + 2] - q.alvo[i0 * 3 + 2]) * f;
    let fv = Tr.fov * (pequena ? 0.88 : 1);
    if (a < 16 / 9) fv = 2 * Math.atan(Math.tan((fv * GRAU) / 2) * (16 / 9) / a) / GRAU;
    const th = Math.tan((fv * GRAU) / 2) * a, desv = Math.atan(th * (1 - 2 * q.terco));
    const yc = Math.atan2(az - q.cam.z, ax - q.cam.x), d = Math.hypot(ax - q.cam.x, az - q.cam.z), ya = yc + desv;
    out.parte = 2; out.x = q.cam.x; out.y = q.cam.y; out.z = q.cam.z;
    out.lx = q.cam.x + Math.cos(ya) * d; out.ly = 0.92; out.lz = q.cam.z + Math.sin(ya) * d; out.fov = fv;
    return out;
  }
  const u = clamp(t - e.w0, 0, e.n - 1), i0 = Math.floor(u), i1 = Math.min(e.n - 1, i0 + 1), f = u - i0;
  const L = (arr, c) => arr[i0 * 3 + c] + (arr[i1 * 3 + c] - arr[i0 * 3 + c]) * f;
  out.parte = 1; out.x = L(e.olho, 0); out.y = L(e.olho, 1); out.z = L(e.olho, 2);
  let dx = L(e.dir, 0), dy = L(e.dir, 1), dz = L(e.dir, 2);
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  out.lx = out.x + dx * 40; out.ly = out.y + dy * 40; out.lz = out.z + dz * 40;
  out.fov = clamp(fovVerticalDe(e.fovH, a), Tr.fovMin, Tr.fovMax);
  return out;
}

// ------------------------------------------------------------------------------------------------ lateral do golaço
/**
 * Câmera lateral baixa do golaço (REPLAY.lateral) com o x dela (`cx`) e os treinadores gravados no quadro [{x, z}]: com um
 * deles a < 2 m, ela desce para z = meioZ + 1 (na frente da área técnica, que é só desenho: o roteiro não muda); e sempre a
 * ≥ 0,6 m de qualquer um (tecnicos.js afastarDeTecnicos). out {x, y, z}.
 */
export function cameraLateral(cx, tecnicos, out = { x: 0, y: 0, z: 0 }, z = null) {
  const Lt = REPLAY.lateral;
  out.x = typeof cx === 'number' ? cx : cx.x; out.y = Lt.altura; out.z = z ?? MZ + Lt.fora;
  // `z` dado: o do plano inteiro (zLateralDoPlano); sem ele, a regra de antes, quadro a quadro
  if (z == null && tecnicos) for (const tc of tecnicos) if (Math.hypot(tc.x - out.x, tc.z - out.z) < 2) { out.z = MZ + 1; break; }
  if (tecnicos) afastarDeTecnicos(out, tecnicos, 0.6);
  return out;
}

/**
 * O z da câmera lateral do golaço para o PLANO INTEIRO [de, ate] (o diretor calcula uma vez, no começo dele; contraprova
 * 15/10: decidido a cada quadro, ela pulava 2,5 m no meio do plano ao passar por um treinador): meioZ + fora; com um
 * treinador gravado a < 2 m do caminho dela — o x dela segue a bola com atraso, então fica entre o menor e o maior x da bola
 * − lado·recuo no plano —, meioZ + 1 (na frente da área técnica) o plano todo.
 */
export function zLateralDoPlano(anel, de, ate, lado) {
  const Lt = REPLAY.lateral, s = lado >= 0 ? 1 : -1, z0 = MZ + Lt.fora;
  let x0 = Infinity, x1 = -Infinity;
  for (let t = de; t <= ate; t++) { const b = bolaNoTick(anel, t, _b); if (b) { const x = b.x - s * Lt.recuo; if (x < x0) x0 = x; if (x > x1) x1 = x; } }
  if (!(x1 >= x0)) return z0;
  for (let t = de; t <= ate; t++) {
    const sl = anel.slot(t);
    if (sl < 0) continue;
    for (let v = 0; v < anel.nVagas[sl]; v++) {
      const i = sl * anel.vagas + v;
      if (!(anel.info[i] & 4)) continue;
      const tx = anel.dados[i * anel.K + anel.P], tz = anel.dados[i * anel.K + anel.P + 1];
      const dx = tx < x0 ? x0 - tx : tx > x1 ? tx - x1 : 0;
      if (Math.hypot(dx, tz - z0) < 2) return MZ + 1;
    }
  }
  return z0;
}

/** Os treinadores gravados no passo (ids e x/z) em out [{id, x, z}] (lista reaproveitada). */
export function tecnicosNoTick(anel, tick, out = []) {
  out.length = 0;
  const s = anel.slot(tick);
  if (s < 0) return out;
  for (let v = 0; v < anel.nVagas[s]; v++) {
    const i = s * anel.vagas + v;
    if (!(anel.info[i] & 4)) continue;
    out.push({ id: anel.ids[i], x: anel.dados[i * anel.K + anel.P], z: anel.dados[i * anel.K + anel.P + 1] });
  }
  return out;
}

/**
 * Reação do treinador para outros planos (a comemoração ao vivo, a fila de cenas #104): a mesma escolha da parte 2 para um
 * caminho dele dado por passo ([{x, z}]) e os outros corpos por passo (opcional). Devolve {cam, alvo} ou null.
 */
export function planoReacaoTreinador(anel, p, opc) { return parte2Treinador(anel, p, opc); }
