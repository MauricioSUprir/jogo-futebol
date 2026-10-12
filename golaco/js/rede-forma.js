// Forma da rede do gol "VÉU DE NOIVA" (lógica PURA: sem three.js nem DOM; só + − × ÷ e Math.sqrt — igual,
// bit a bit, em todo motor JS, como o matdet.js pede para a lógica).
//
// A rede "véu de noiva" dos estádios brasileiros (Maracanã até 2013 e de novo desde 2022): sem caixa e sem
// suportes atrás. Duas hastes curtas (~40 cm) nos cantos de cima seguram a faixa de cima da rede logo atrás do
// travessão; dali a rede CAI em curva longa até o chão, onde é presa por estacas bem atrás do gol — a bola
// "estufa a costura e vai morrer no fundo do gol". As laterais são panos verticais do poste até a curva.
//
// Perfil (plano X × y; X = profundidade atrás da linha do gol, y = altura):
//   faixa de cima: y = HG de X = 0 (travessão) a X = haste;
//   véu: parábola tangente ao chão no fundo — y = HG·((fundo − X)/(fundo − haste))², de (haste, HG) a (fundo, 0)
//   (a corrente pendurada com carga uniforme na horizontal; quase igual à catenária, sem cosh/acosh).
// Normal do perfil para FORA do gol (para trás e para cima). Na largura o perfil é o mesmo (|z| ≤ ZL).
// Quem usa: bola.js (colisão), sim.js (verificarGol), treino.js (dentroDoGol), render/rede-onda.js e render/campo.js.
// Pesquisa e fontes: PESQUISA-ESTADIO.md, "Rede véu de noiva e branca".
import { CAMPO } from './config.js';

/**
 * Medidas do véu (config.js CAMPO.gol.veu): haste = recuo de cima (hastes dos cantos; Maracanã ~40 cm), fundo = recuo
 * de baixo (onde a rede chega ao chão, nas estacas), segmentos = polilinha da curva (física, colisão e desenho usam a
 * MESMA).
 */
export const VEU = CAMPO.gol.veu;

const HG = CAMPO.gol.altura;
const ZL = CAMPO.gol.largura / 2;
const H = VEU.haste, F = VEU.fundo, LV = F - H;

/** Profundidade (m atrás da linha) do véu na altura y: fundo no chão, haste em cima. */
export function profundidadeVeu(y) {
  if (y <= 0) return F;
  if (y >= HG) return H;
  return F - LV * Math.sqrt(y / HG);
}

/** Altura do véu na profundidade X (faixa de cima: HG até a haste; depois do fundo: 0). */
export function alturaVeu(X) {
  if (X <= H) return HG;
  if (X >= F) return 0;
  const t = (F - X) / LV;
  return HG * t * t;
}

/** Ponto (X, y) dentro do gol, por baixo do véu e da faixa de cima (e entre as laterais, |z| < ZL). */
export function dentroDoVeu(X, y, z) {
  return X >= 0 && y < HG && Math.abs(z) < ZL && X < profundidadeVeu(y);
}

// Polilinha do perfil: travessão → haste → véu até o chão, com o comprimento acumulado (s).
const N = VEU.segmentos;
const PX = [0], PY = [HG];
for (let i = 0; i <= N; i++) { const t = 1 - i / N; PX.push(F - LV * t); PY.push(HG * t * t); }
const NP = PX.length;
const PS = new Float64Array(NP);
const NX = new Float64Array(NP - 1), NY = new Float64Array(NP - 1), TL = new Float64Array(NP - 1);
for (let i = 0; i < NP - 1; i++) {
  const dx = PX[i + 1] - PX[i], dy = PY[i + 1] - PY[i], l = Math.sqrt(dx * dx + dy * dy);
  TL[i] = l; PS[i + 1] = PS[i] + l;
  NX[i] = -dy / l; NY[i] = dx / l;   // (dx > 0, dy ≤ 0): para trás e para cima = para FORA
}
/** Comprimento do perfil (m, do travessão ao chão). */
export const COMPRIMENTO_PERFIL = PS[NP - 1];
/** Pontos do perfil (cópias): X, y, s. */
export const PERFIL = { X: PX.slice(), y: PY.slice(), s: Array.from(PS) };

/**
 * Ponto do perfil mais perto de (X, y), em out {X, y, nx, ny, d, s}: o ponto, a normal para FORA do gol nele, a
 * distância com sinal (+ = do lado de fora: atrás/por cima da rede) e o comprimento s do perfil até o ponto.
 */
export function pertoPerfil(X, y, out) {
  let melhor = Infinity, iM = 0, uM = 0;
  for (let i = 0; i < NP - 1; i++) {
    const dx = PX[i + 1] - PX[i], dy = PY[i + 1] - PY[i];
    let u = ((X - PX[i]) * dx + (y - PY[i]) * dy) / (TL[i] * TL[i]);
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = PX[i] + dx * u - X, qy = PY[i] + dy * u - y, d2 = qx * qx + qy * qy;
    if (d2 < melhor) { melhor = d2; iM = i; uM = u; }
  }
  const cx = PX[iM] + (PX[iM + 1] - PX[iM]) * uM, cy = PY[iM] + (PY[iM + 1] - PY[iM]) * uM;
  // normal: a do segmento; num vértice (u = 0 ou 1), a média com o vizinho (sem quina na normal)
  let nx = NX[iM], ny = NY[iM];
  if (uM === 0 && iM > 0) { nx += NX[iM - 1]; ny += NY[iM - 1]; } else if (uM === 1 && iM < NP - 2) { nx += NX[iM + 1]; ny += NY[iM + 1]; }
  const ln = Math.sqrt(nx * nx + ny * ny); nx /= ln; ny /= ln;
  const dist = Math.sqrt(melhor);
  const lado = (X - cx) * nx + (y - cy) * ny;
  out.X = cx; out.y = cy; out.nx = nx; out.ny = ny; out.d = lado < 0 ? -dist : dist;
  out.s = PS[iM] + TL[iM] * uM;
  return out;
}

/** Ponto do perfil no comprimento s (0 = travessão; COMPRIMENTO_PERFIL = chão), com a normal para fora. */
export function pontoPerfil(s, out) {
  let i = 0;
  while (i < NP - 2 && PS[i + 1] < s) i++;
  const u = Math.max(0, Math.min(1, (s - PS[i]) / TL[i]));
  out.X = PX[i] + (PX[i + 1] - PX[i]) * u; out.y = PY[i] + (PY[i + 1] - PY[i]) * u;
  out.nx = NX[i]; out.ny = NY[i]; out.s = s;
  return out;
}

/**
 * Até onde vai (X) o centro de uma bola de raio r apoiada no chão (centro a y = r) por baixo do véu: a cunha do
 * fundo, onde a bola "morre". Bisseção na distância ao perfil (determinística).
 */
export function fundoDaCunha(r) {
  const o = { X: 0, y: 0, nx: 0, ny: 0, d: 0, s: 0 };
  let lo = 0.5, hi = F;
  for (let it = 0; it < 50; it++) {
    const m = (lo + hi) / 2;
    pertoPerfil(m, r, o);
    if (o.d < -r) lo = m; else hi = m;
  }
  return lo;
}
