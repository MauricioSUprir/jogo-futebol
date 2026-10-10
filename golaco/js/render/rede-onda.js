// Rede que balança (desenho): conta PURA (sem three.js nem DOM) da deformação da rede do gol, usada
// igual pelo vertex shader da rede (campo.js, REDE_GLSL gerado daqui com as mesmas constantes) e pelos
// testes em Node (tools/teste-rede.mjs).
//
// A física da bola (bola.js) trata cada pano da rede como um plano fino que segura a bola e devolve só
// 2% da velocidade (BOLA.amortecimentoRede) — a bola "morre" no plano. O desenho completa o que a
// física não mostra: no impacto a rede estufa no ponto da batida e balança com mola-amortecimento
// (uma bolsa que sobe rápido, passa do ponto e volta) e uma onda que se espalha pelo pano e morre em
// ~1,5 s. A bola DESENHADA vai junto no bojo (empurraoBola): parece que ela entrou na rede e a rede a
// devolveu — o ponto da física (e o hash) não muda.
//
// Modelo (pesquisa em PESQUISA-ESTADIO.md): oscilador amortecido subamortecido com velocidade inicial
// (resposta ao impulso: x(τ) = e^(−ζωτ)·sin(ω_d τ), normalizada para o pico = 1) × gaussiana no
// espaço (a bolsa), mais uma onda de Ricker que anda a c m/s a partir do ponto (o "balanço" que corre
// pelo pano). Panos presos na armação: a deformação vai a zero nas bordas (fixo()). Mesma ideia das
// redes de jogos de futebol (malha de partículas com molas e Verlet — patente EA US 8.000.947), aqui
// sem simular partículas: a resposta analítica no shader custa poucos ciclos por vértice e é a mesma
// em todo quadro (sem estado na GPU).
//
// Coordenadas do mundo (x = comprimento, y para cima, z = largura). 8 panos: índice = (lado > 0 ? 4 : 0)
// + k, k: 0 = fundo, 1 = teto, 2 = lateral do lado z−, 3 = lateral do lado z+. Normal de cada pano
// para FORA do gol; deslocamento positivo = estufa para fora (batida por dentro), negativo = afunda
// para dentro (batida por fora).
import { CAMPO, BOLA, PASSO } from '../config.js';

export const REDE = {
  maxImpactos: 4,       // impactos guardados ao mesmo tempo (uniforms do shader)
  freq: 2.0,            // Hz — frequência natural da bolsa
  amort: 0.3,           // ζ — passa do ponto ~37% e para em ~1 s
  ampMax: 0.7,          // m — bolsa máxima (chute forte; a rede do fundo tem folga)
  vRef: 14,             // m/s — saturação: amp = ampMax·(1 − e^(−v/vRef)); 25 m/s → 0,58 m, 5 m/s → 0,21 m
  vMin: 0.8,            // m/s — batida mais lenta que isto não mexe a rede
  sigma: 0.75,          // m — raio da bolsa (gaussiana)
  ondaVel: 6.5,         // m/s — a onda corre pelo pano
  ondaLarg: 0.42,       // m — largura da frente da onda (Ricker)
  ondaAmp: 0.32,        // fração do impacto na onda
  ondaDecai: 0.45,      // s — a onda some com e^(−τ/ondaDecai)
  duracao: 1.6,         // s — depois disso o impacto não conta (janela suave a partir de 80%)
  borda: 0.6,           // m — perto da armação a rede não se mexe (perfil seno até a borda)
  bordaChao: 0.25,      // m — na barra do chão o pano é mais solto (o chute rasteiro também estufa)
  margemBolsa: 0.55,    // m — a bolsa se forma na parte solta do pano: o centro fica a ≥ isto da armação
  margemChao: 0.3,      // m — idem, da barra do chão
  outrosPanos: 0.3,     // fração que chega aos outros panos do mesmo gol (o tecido é um só)
  tol: 0.05,            // m — folga para achar a bola encostada no plano
};

const MX = CAMPO.meioX;
const G = CAMPO.gol;
const ZL = G.largura / 2, HG = G.altura, PROF = G.profundidade;
const R = BOLA.raio;
const RC = R + G.raioPoste;   // centro da bola encostada na trave/travessão
const W = 2 * Math.PI * REDE.freq;
const ZW = REDE.amort * W;
const WD = W * Math.sqrt(1 - REDE.amort * REDE.amort);
const T_PICO = Math.atan2(WD, ZW) / WD;
const PICO = Math.exp(-ZW * T_PICO) * Math.sin(WD * T_PICO);

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

/** Normal (para fora do gol) do pano i. */
export function normalPano(i, out = { x: 0, y: 0, z: 0 }) {
  const s = i >= 4 ? 1 : -1, k = i & 3;
  out.x = k === 0 ? s : 0; out.y = k === 1 ? 1 : 0; out.z = k === 2 ? -1 : k === 3 ? 1 : 0;
  return out;
}

/** Tempo (s depois da batida) em que a bolsa chega ao máximo. */
export const TEMPO_PICO = T_PICO;

/**
 * Quanto o ponto (x, y, z) do pano i pode se mexer (0 na armação, 1 no meio): seno até `borda` de
 * cada aresta. A geometria da rede (campo.js) grava isto num atributo por vértice.
 */
export function fixo(i, x, y, z) {
  const s = i >= 4 ? 1 : -1, k = i & 3;
  const X = s * x - MX; // profundidade atrás da linha
  let u, U, v, V;
  if (k === 0) { u = z + ZL; U = 2 * ZL; v = y; V = HG; }
  else if (k === 1) { u = z + ZL; U = 2 * ZL; v = X; V = PROF; }
  else { u = X; U = PROF; v = y; V = HG; }
  // fundo e laterais: v = altura, a aresta de baixo é a barra do chão (mais solta)
  const bv = k !== 1 && v < V - v ? REDE.bordaChao : REDE.borda;
  const du = clamp(Math.min(u, U - u) / REDE.borda, 0, 1), dv = clamp(Math.min(v, V - v) / bv, 0, 1);
  return Math.sin(du * Math.PI / 2) * Math.sin(dv * Math.PI / 2);
}

/** Resposta da bolsa no tempo τ (s) depois da batida: 0 em τ = 0, 1 no pico, oscila e some. */
export function mola(tau) {
  if (tau <= 0) return 0;
  return Math.exp(-ZW * tau) * Math.sin(WD * tau) / PICO;
}

/** Perfil de um impacto de amplitude 1 a r m do ponto, τ s depois (antes da fixação da borda). */
export function perfil(r, tau) {
  if (tau <= 0 || tau >= REDE.duracao) return 0;
  const sg = r / REDE.sigma;
  const bojo = mola(tau) * Math.exp(-sg * sg);
  const q = (r - REDE.ondaVel * tau) / REDE.ondaLarg;
  const onda = REDE.ondaAmp * Math.exp(-tau / REDE.ondaDecai) * (1 - Math.exp(-tau / 0.06)) * Math.exp(-q * q) * (1 - q * q);
  return (bojo + onda) * (1 - suave(0.8 * REDE.duracao, REDE.duracao, tau));
}

/** Amplitude (m) de uma batida com a velocidade normal v (m/s). */
export function amplitude(v) {
  return v < REDE.vMin ? 0 : REDE.ampMax * (1 - Math.exp(-v / REDE.vRef));
}

/** Estado das ondas: impactos guardados (no máximo REDE.maxImpactos). */
export function criarOndas() {
  const imp = [];
  for (let i = 0; i < REDE.maxImpactos; i++) imp.push({ ativo: false, t0: 0, x: 0, y: 0, z: 0, plano: 0, amp: 0 });
  return { imp, total: 0 };
}

/** Esquece todos os impactos (mundo novo). */
export function limparOndas(est) {
  for (const i of est.imp) i.ativo = false;
}

/** Energia que ainda resta de um impacto no tempo t (para escolher qual substituir). */
function restante(i, t) {
  const tau = t - i.t0;
  return !i.ativo || tau >= REDE.duracao ? 0 : Math.abs(i.amp) * Math.exp(-ZW * Math.max(0, tau));
}

/**
 * Centro da bolsa de uma batida no ponto (x, y, z) do pano i: o próprio ponto, puxado para dentro do pano
 * até margemBolsa da armação (margemChao da barra do chão) — batida no canto faz a bolsa na parte solta,
 * não uma dobra encostada na trave. Escreve em out {x, y, z}.
 */
export function centroBolsa(i, x, y, z, out) {
  const s = i >= 4 ? 1 : -1, k = i & 3, M = REDE.margemBolsa;
  const yc = clamp(y, Math.min(REDE.margemChao, HG / 2), HG - M);
  if (k === 0) { out.x = x; out.y = yc; out.z = clamp(z, -ZL + M, ZL - M); }
  else if (k === 1) { out.x = s * (MX + clamp(s * x - MX, M, PROF - M)); out.y = y; out.z = clamp(z, -ZL + M, ZL - M); }
  else { out.x = s * (MX + clamp(s * x - MX, M, PROF - M)); out.y = yc; out.z = z; }
  return out;
}

/**
 * Guarda a batida imp = {plano, x, y, z, vel, sinal} no tempo t0 (s, no relógio do desenho). Ocupa um
 * espaço livre ou o do impacto que menos se mexe agora. Devolve o impacto guardado (ou null: lenta).
 */
export function registrarImpacto(est, imp, t0) {
  const a = amplitude(imp.vel);
  if (a <= 0) return null;
  let alvo = est.imp[0], menor = Infinity;
  for (const i of est.imp) {
    const e = restante(i, t0);
    if (e < menor) { menor = e; alvo = i; }
  }
  centroBolsa(imp.plano, imp.x, imp.y, imp.z, alvo);
  alvo.ativo = true; alvo.t0 = t0; alvo.plano = imp.plano;
  alvo.amp = a * (imp.sinal < 0 ? -1 : 1);
  est.total++;
  return alvo;
}

/**
 * Deslocamento (m, ao longo da normal do pano, + = para fora) do ponto (x, y, z) do pano `plano` no
 * tempo t, SEM a fixação da borda (o shader multiplica pelo atributo; aqui use fixo()). A mesma conta
 * do REDE_GLSL.
 */
export function deslocamento(est, plano, x, y, z, t) {
  let d = 0;
  for (const i of est.imp) {
    if (!i.ativo) continue;
    const tau = t - i.t0;
    if (tau <= 0 || tau >= REDE.duracao) continue;
    // só o gol da batida (os dois gols ficam a 105 m: o outro não sente nada)
    if ((i.plano >= 4) !== (plano >= 4)) continue;
    const r = Math.hypot(x - i.x, y - i.y, z - i.z);
    d += i.amp * perfil(r, tau) * (i.plano === plano ? 1 : REDE.outrosPanos);
  }
  return d;
}

/** Algum impacto ainda mexendo a rede no tempo t? (o desenho desliga os uniforms quando não) */
export function redeAtiva(est, t) {
  for (const i of est.imp) if (i.ativo && t - i.t0 < REDE.duracao && t - i.t0 > -1) return true;
  return false;
}

/**
 * Batidas da bola na rede neste passo: bola no começo (p0, v0) e no fim (p1, v1) do passo. Uma batida
 * = a bola encostada no plano de um pano, chegando a ≥ vMin na direção dele e perdendo ≥ metade dessa
 * velocidade no passo (a rede devolve só 2%). Por dentro → sinal +1 (estufa para fora); por fora
 * (bola atrás do gol, por cima do teto, de fora da lateral) → −1. Escreve em `out` (lista reaproveitada)
 * e devolve quantas achou. Traves e travessão ficam de fora (o centro da bola tem de estar a ≥ RC
 * atrás da linha para os panos do teto e das laterais).
 */
export function detectarImpactos(p0, v0, p1, v1, out) {
  let n = 0;
  const tolV = n2 => Math.max(REDE.tol, Math.abs(n2) * PASSO + 0.03);
  const poe = (plano, x, y, z, vel, sinal) => {
    const o = out[n] ?? (out[n] = { plano: 0, x: 0, y: 0, z: 0, vel: 0, sinal: 1 });
    o.plano = plano; o.x = x; o.y = y; o.z = z; o.vel = vel; o.sinal = sinal;
    n++;
  };
  for (let s = -1; s <= 1; s += 2) {
    const X1 = s * p1.x - MX;
    if (X1 < -R || X1 > PROF + R + 0.4) continue;
    const base = s > 0 ? 4 : 0;
    // fundo (por dentro só com o centro da bola abaixo da barra de trás: a bola rolando em cima do teto que
    // bate na barra de trás não é batida "por dentro" — estufava a rede para fora, contraprova M6)
    if (Math.abs(p1.z) <= ZL + R && p1.y <= HG + R) {
      const a = s * v0.x, b = s * v1.x, tol = tolV(b);
      const yc = clamp(p1.y, 0, HG), zc = clamp(p1.z, -ZL, ZL), xc = s * (MX + PROF);
      if (X1 >= PROF - R - tol && X1 <= PROF && p1.y <= HG && a > REDE.vMin && b < 0.5 * a) poe(base, xc, yc, zc, a, 1);
      else if (X1 > PROF && X1 <= PROF + R + tol && a < -REDE.vMin && b > 0.5 * a) poe(base, xc, yc, zc, -a, -1);
    }
    if (X1 < RC || X1 > PROF + R) continue;
    const xc = s * (MX + clamp(X1, 0, PROF));
    // teto
    if (Math.abs(p1.z) <= ZL + R) {
      const a = v0.y, b = v1.y, tol = tolV(b), zc = clamp(p1.z, -ZL, ZL);
      if (p1.y >= HG - R - tol && p1.y <= HG && a > REDE.vMin && b < 0.5 * a) poe(base + 1, xc, HG, zc, a, 1);
      else if (p1.y > HG && p1.y <= HG + R + tol && a < -REDE.vMin && b > 0.5 * a) poe(base + 1, xc, HG, zc, -a, -1);
    }
    // laterais
    if (p1.y <= HG + R) {
      for (let t = -1; t <= 1; t += 2) {
        const w = t * p1.z, a = t * v0.z, b = t * v1.z, tol = tolV(b), yc = clamp(p1.y, 0, HG);
        const plano = base + (t < 0 ? 2 : 3);
        if (w >= ZL - R - tol && w <= ZL && p1.y <= HG && a > REDE.vMin && b < 0.5 * a) poe(plano, xc, yc, t * ZL, a, 1);
        else if (w > ZL && w <= ZL + R + tol && a < -REDE.vMin && b > 0.5 * a) poe(plano, xc, yc, t * ZL, -a, -1);
      }
    }
  }
  return n;
}

const _n = { x: 0, y: 0, z: 0 };
const _g = { px: 0, py: 0, pz: 0, dist: 0, dentro: false };
/**
 * Geometria do ponto p em relação ao pano k do gol do lado s: ponto do pano em frente a p (px, py, pz),
 * distância com sinal ao plano parado (+ = do lado de fora do gol) e se p está na área do pano. Em out.
 */
function geoPano(s, k, p, out) {
  const X = s * p.x - MX;
  if (k === 0) { out.px = s * (MX + PROF); out.py = clamp(p.y, 0, HG); out.pz = clamp(p.z, -ZL, ZL); out.dist = X - PROF; out.dentro = Math.abs(p.z) <= ZL && p.y <= HG; }
  else if (k === 1) { out.px = s * (MX + clamp(X, 0, PROF)); out.py = HG; out.pz = clamp(p.z, -ZL, ZL); out.dist = p.y - HG; out.dentro = X >= 0 && X <= PROF && Math.abs(p.z) <= ZL; }
  else {
    const tz = k === 2 ? -1 : 1;
    out.px = s * (MX + clamp(X, 0, PROF)); out.py = clamp(p.y, 0, HG); out.pz = tz * ZL; out.dist = tz * p.z - ZL; out.dentro = X >= 0 && X <= PROF && p.y <= HG;
  }
  return out;
}
const _pd = { x: 0, y: 0, z: 0 };
// panos em que a bola da física encosta (até 8 por quadro) e de que lado (dentro/fora): a restrição usa os mesmos
const _encosta = new Int8Array(8), _ladoFora = new Uint8Array(8);
/**
 * Empurrão da bola DESENHADA pela rede (m, no mundo), escrito em out {x, y, z}: com a bola encostada
 * (folga < ~0,35 m) a bolsa que estufa leva a bola junto; e a rede que volta nunca passa por dentro
 * dela (se a rede afunda mais que a folga, a bola vai junto). Longe da rede: zero.
 * Depois, a RESTRIÇÃO (contraprova M1): a superfície da bola desenhada, na posição FINAL, não passa de
 * nenhum pano deformado em que a bola da física encosta (do mesmo lado que ela está) — no canto o empurrão
 * de um pano levava a bola para onde o outro quase não se mexe (perto da armação) e ela furava esse outro
 * em até 6,7 cm. Três passadas de projeção (como as restrições de distância de uma malha de pano).
 */
export function empurraoBola(est, p, t, out) {
  out.x = 0; out.y = 0; out.z = 0;
  let algum = false;
  for (const i of est.imp) if (i.ativo && t - i.t0 > 0 && t - i.t0 < REDE.duracao) { algum = true; break; }
  if (!algum) return out;
  let nEnc = 0;
  for (let s = -1; s <= 1; s += 2) {
    const X = s * p.x - MX;
    if (X < -R || X > PROF + R + 0.8) continue;
    const base = s > 0 ? 4 : 0;
    for (let k = 0; k < 4; k++) {
      const plano = base + k;
      const g = geoPano(s, k, p, _g);
      if (!g.dentro || Math.abs(g.dist) > R + 0.9) continue;
      _encosta[nEnc] = plano; _ladoFora[nEnc] = g.dist > 0 ? 1 : 0; nEnc++;
      const d = deslocamento(est, plano, g.px, g.py, g.pz, t) * fixo(plano, g.px, g.py, g.pz);
      if (d === 0) continue;
      const dist = g.dist;
      const folga = Math.abs(dist) - R; // espaço entre a superfície da bola e o pano parado
      let e = 0;
      if (dist <= 0) {
        // bola por dentro: a bolsa para fora leva a bola encostada; a rede que volta empurra para dentro
        if (d > 0) e = d * (1 - suave(0.05, 0.35, folga));
        else if (d + folga < 0) e = d + folga;
      } else {
        // bola por fora: espelho
        if (d < 0) e = d * (1 - suave(0.05, 0.35, folga));
        else if (d - folga > 0) e = d - folga;
      }
      if (e === 0) continue;
      normalPano(plano, _n);
      out.x += _n.x * e; out.y += _n.y * e; out.z += _n.z * e;
    }
  }
  // restrição na posição final da bola desenhada (só nos panos em que a física encosta)
  for (let it = 0; it < 3; it++) {
    let mexeu = false;
    for (let q = 0; q < nEnc; q++) {
      const plano = _encosta[q], s = plano >= 4 ? 1 : -1, k = plano & 3;
      _pd.x = p.x + out.x; _pd.y = p.y + out.y; _pd.z = p.z + out.z;
      const g = geoPano(s, k, _pd, _g);
      const d = deslocamento(est, plano, g.px, g.py, g.pz, t) * fixo(plano, g.px, g.py, g.pz);
      // por dentro: superfície da bola ≤ pano deformado; por fora: ≥ (espelho)
      const viol = _ladoFora[q] ? d - (g.dist - R) : g.dist + R - d;
      if (viol <= 0.001) continue;
      normalPano(plano, _n);
      const sg = _ladoFora[q] ? 1 : -1;
      out.x += sg * _n.x * viol; out.y += sg * _n.y * viol; out.z += sg * _n.z * viol;
      mexeu = true;
    }
    if (!mexeu) break;
  }
  return out;
}

/** Escreve os uniforms do shader: a = [x, y, z, amp]·4 e b = [τ, plano, 0, 0]·4 (τ = t − t0). */
export function uniformsRede(est, t, a, b) {
  for (let k = 0; k < REDE.maxImpactos; k++) {
    const i = est.imp[k];
    const vivo = i.ativo && t - i.t0 > 0 && t - i.t0 < REDE.duracao;
    a[4 * k] = i.x; a[4 * k + 1] = i.y; a[4 * k + 2] = i.z; a[4 * k + 3] = vivo ? i.amp : 0;
    b[4 * k] = vivo ? t - i.t0 : -1; b[4 * k + 1] = i.plano; b[4 * k + 2] = 0; b[4 * k + 3] = 0;
  }
}

const f = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/**
 * GLSL da mesma conta (uniforms uRedeA[4], uRedeB[4]; atributos do vértice: plano e fixo). Define
 * `float redeDesloc(vec3 p, float plano)` — o deslocamento ao longo da normal, já com a fixação NÃO
 * aplicada (o shader multiplica pelo atributo aFixo).
 */
export const REDE_GLSL = `
uniform vec4 uRedeA[${REDE.maxImpactos}];
uniform vec4 uRedeB[${REDE.maxImpactos}];
float redePerfil(float r, float tau) {
  if (tau <= 0.0 || tau >= ${f(REDE.duracao)}) return 0.0;
  float sg = r / ${f(REDE.sigma)};
  float molaV = exp(-${f(ZW)} * tau) * sin(${f(WD)} * tau) / ${f(PICO)};
  float bojo = molaV * exp(-sg * sg);
  float q = (r - ${f(REDE.ondaVel)} * tau) / ${f(REDE.ondaLarg)};
  float onda = ${f(REDE.ondaAmp)} * exp(-tau / ${f(REDE.ondaDecai)}) * (1.0 - exp(-tau / 0.06)) * exp(-q * q) * (1.0 - q * q);
  return (bojo + onda) * (1.0 - smoothstep(${f(0.8 * REDE.duracao)}, ${f(REDE.duracao)}, tau));
}
float redeDesloc(vec3 p, float plano) {
  float d = 0.0;
  for (int k = 0; k < ${REDE.maxImpactos}; k++) {
    vec4 a = uRedeA[k];
    vec4 b = uRedeB[k];
    if (a.w == 0.0 || b.x <= 0.0) continue;
    if ((b.y >= 3.5) != (plano >= 3.5)) continue;
    float peso = abs(b.y - plano) < 0.5 ? 1.0 : ${f(REDE.outrosPanos)};
    d += a.w * redePerfil(length(p - a.xyz), b.x) * peso;
  }
  return d;
}
// a mesma conta de fixo(): 0 na armação, 1 no meio do pano
float redeFixo(vec3 p, float plano) {
  float s = plano >= 3.5 ? 1.0 : -1.0;
  float k = plano - (s > 0.0 ? 4.0 : 0.0);
  float X = s * p.x - ${f(MX)};
  float u; float U; float v; float V;
  if (k < 0.5) { u = p.z + ${f(ZL)}; U = ${f(2 * ZL)}; v = p.y; V = ${f(HG)}; }
  else if (k < 1.5) { u = p.z + ${f(ZL)}; U = ${f(2 * ZL)}; v = X; V = ${f(PROF)}; }
  else { u = X; U = ${f(PROF)}; v = p.y; V = ${f(HG)}; }
  float bv = (k < 0.5 || k > 1.5) && v < V - v ? ${f(REDE.bordaChao)} : ${f(REDE.borda)};
  float du = clamp(min(u, U - u) / ${f(REDE.borda)}, 0.0, 1.0);
  float dv = clamp(min(v, V - v) / bv, 0.0, 1.0);
  return sin(du * 1.5707963) * sin(dv * 1.5707963);
}
// normal do pano (para FORA do gol)
vec3 redeNormal(float plano) {
  float s = plano >= 3.5 ? 1.0 : -1.0;
  float k = plano - (s > 0.0 ? 4.0 : 0.0);
  if (k < 0.5) return vec3(s, 0.0, 0.0);
  if (k < 1.5) return vec3(0.0, 1.0, 0.0);
  return vec3(0.0, 0.0, k < 2.5 ? -1.0 : 1.0);
}
`;
