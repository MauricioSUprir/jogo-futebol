// Rede que balança (desenho) — rede VÉU DE NOIVA (forma em ../rede-forma.js, a mesma da física da bola): conta
// PURA (sem three.js nem DOM) da deformação da rede, usada igual pelo vertex shader (campo.js, REDE_GLSL gerado
// daqui com as mesmas constantes) e pelos testes em Node (tools/teste-rede.mjs, teste-rede-veu.mjs).
//
// A física da bola (bola.js) segura a bola no véu e devolve só 2% da velocidade normal (BOLA.amortecimentoRede): a
// bola "morre" na rede e escorrega até a cunha do fundo. O desenho completa o que a física não mostra: no impacto a
// rede estufa no ponto da batida e balança (mola-amortecimento: sobe rápido, passa do ponto e volta) e uma onda corre
// pelo tecido e morre em ~1,9 s. A bola DESENHADA vai junto no bojo (empurraoBola) — o ponto da física (e o hash) não
// muda. Modelo e fontes em PESQUISA-ESTADIO.md (oscilador subamortecido × gaussiana + onda de Ricker; a ideia das
// redes de jogos de futebol — patente EA US 8.000.947 — sem simular partículas: a resposta analítica no shader é a
// mesma em todo quadro, sem estado na GPU).
//
// O que mudou da rede-caixote: a deformação é um CAMPO VETORIAL no espaço — cada batida empurra os pontos perto
// dela na direção da normal do véu (ou da lateral) NO PONTO DA BATIDA, com a mesma resposta no tempo (mola
// subamortecida + onda de Ricker que corre pela rede). Como é função só da posição, o véu e as laterais (um tecido
// só, sem armação na emenda) se mexem juntos, sem rasgar na dobra. A fixação (0 na armação) também é função da
// posição: postes, travessão, as duas hastes de cima e as estacas do chão (fundo do véu e pé das laterais).
//
// Panos (para as batidas e a bola desenhada): índice = (lado > 0 ? 4 : 0) + k, k: 0 = véu (faixa de cima + a
// curva até o chão), 2 = lateral do lado z−, 3 = lateral do lado z+ (o 1, teto da caixa, não existe mais).
import { CAMPO, BOLA, PASSO } from '../config.js';
import { VEU, profundidadeVeu, pertoPerfil, pontoPerfil, COMPRIMENTO_PERFIL } from '../rede-forma.js';

export const REDE = {
  maxImpactos: 4,       // impactos guardados ao mesmo tempo (uniforms do shader)
  freq: 1.6,            // Hz — o véu é mais solto que a caixa: balança mais devagar e mais fundo
  amort: 0.24,          // ζ — passa do ponto ~45% e para em ~1,3 s
  ampMax: 0.85,         // m — bolsa máxima (chute forte; o véu tem folga)
  vRef: 14,             // m/s — saturação: amp = ampMax·(1 − e^(−v/vRef))
  vMin: 0.8,            // m/s — batida mais lenta que isto não mexe a rede
  sigma: 0.8,           // m — raio da bolsa (gaussiana)
  ondaVel: 5.5,         // m/s — a onda corre pela rede
  ondaLarg: 0.45,       // m — largura da frente da onda (Ricker)
  ondaAmp: 0.38,        // fração do impacto na onda
  ondaDecai: 0.5,       // s — a onda some com e^(−τ/ondaDecai)
  duracao: 1.9,         // s — depois disso o impacto não conta (janela suave a partir de 80%)
  borda: 0.45,          // m — perto da armação (postes, travessão, hastes) a rede não se mexe
  bordaChao: 0.25,      // m — idem, das estacas do chão
  margemBolsa: 0.5,     // m — o centro da bolsa fica a ≥ isto da armação
  margemChao: 0.35,     // m — idem, das estacas (ao longo do véu)
  tol: 0.05,            // m — folga para achar a bola encostada
};
/** Marca da rede em véu (testes: a versão publicada não tem). */
export const VEU_DESENHO = { haste: VEU.haste, fundo: VEU.fundo, comprimento: COMPRIMENTO_PERFIL };

const MX = CAMPO.meioX;
const G = CAMPO.gol;
const ZL = G.largura / 2, HG = G.altura, F = VEU.fundo, H = VEU.haste;
const R = BOLA.raio;
const RC = R + G.raioPoste;
const W = 2 * Math.PI * REDE.freq;
const ZW = REDE.amort * W;
const WD = W * Math.sqrt(1 - REDE.amort * REDE.amort);
const T_PICO = Math.atan2(WD, ZW) / WD;
const PICO = Math.exp(-ZW * T_PICO) * Math.sin(WD * T_PICO);

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
const rampa = x => Math.sin(clamp(x, 0, 1) * Math.PI / 2);

/** Tempo (s depois da batida) em que a bolsa chega ao máximo. */
export const TEMPO_PICO = T_PICO;

/** Resposta da bolsa no tempo τ (s) depois da batida: 0 em τ = 0, 1 no pico, oscila e some. */
export function mola(tau) {
  if (tau <= 0) return 0;
  return Math.exp(-ZW * tau) * Math.sin(WD * tau) / PICO;
}

/** Perfil de um impacto de amplitude 1 a r m do ponto, τ s depois (antes da fixação). */
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

/**
 * Quanto o ponto (x, y, z) da rede pode se mexer (0 na armação, 1 longe dela). Armação: postes (X = 0, |z| = ZL),
 * travessão (X = 0, y = HG), hastes (y = HG, |z| = ZL, X até a haste) e as estacas do chão (pé das laterais e o
 * fundo do véu). Aceita também (plano, x, y, z) (a assinatura antiga).
 */
export function fixo(a, b, c, d) {
  let x = a, y = b, z = c;
  if (d !== undefined) { x = b; y = c; z = d; }
  const X = (x >= 0 ? x : -x) - MX, az = z < 0 ? -z : z;
  const dz = az - ZL, dzf = dz > 0 ? dz : 0, dy = y > HG ? y - HG : 0;
  const dPoste = Math.hypot(X, dy, dz);
  const dTrav = Math.hypot(X, y - HG, dzf);
  const dHaste = Math.hypot(X - clamp(X, 0, H), y - HG, dz);
  const dPe = Math.hypot(X - clamp(X, 0, F), y, dz);
  const dFundo = Math.hypot(X - F, y, dzf);
  const dArm = Math.min(dPoste, dTrav, dHaste), dChao = Math.min(dPe, dFundo);
  return rampa(dArm / REDE.borda) * rampa(dChao / REDE.bordaChao);
}

/** Estado das ondas: impactos guardados (no máximo REDE.maxImpactos). */
export function criarOndas() {
  const imp = [];
  for (let i = 0; i < REDE.maxImpactos; i++) imp.push({ ativo: false, t0: 0, x: 0, y: 0, z: 0, plano: 0, amp: 0, dx: 0, dy: 0, dz: 0 });
  return { imp, total: 0 };
}

/** Esquece todos os impactos (mundo novo). */
export function limparOndas(est) {
  for (const i of est.imp) i.ativo = false;
}

function restante(i, t) {
  const tau = t - i.t0;
  return !i.ativo || tau >= REDE.duracao ? 0 : Math.abs(i.amp) * Math.exp(-ZW * Math.max(0, tau));
}

const _pp = { X: 0, y: 0, nx: 0, ny: 0, d: 0, s: 0 };
/**
 * Centro e direção da bolsa de uma batida no pano i em (x, y, z): no véu, o ponto do perfil puxado para a parte
 * solta (≥ margemBolsa do travessão/hastes ao longo do véu, ≥ margemChao das estacas) e a normal do véu nele; nas
 * laterais, o ponto puxado para dentro do pano e a normal ±z. Escreve em out {x, y, z, dx, dy, dz}.
 */
export function centroBolsa(i, x, y, z, out) {
  const s = i >= 4 ? 1 : -1, k = i & 3, M = REDE.margemBolsa;
  if (k === 0 || k === 1) {
    pertoPerfil(s * x - MX, y, _pp);
    const sc = clamp(_pp.s, M + 0.1, COMPRIMENTO_PERFIL - REDE.margemChao);
    pontoPerfil(sc, _pp);
    out.x = s * (MX + _pp.X); out.y = _pp.y; out.z = clamp(z, -ZL + 0.3, ZL - 0.3);
    out.dx = s * _pp.nx; out.dy = _pp.ny; out.dz = 0;
  } else {
    const tz = k === 2 ? -1 : 1;
    const yc = clamp(y, Math.min(REDE.margemChao, HG / 2), HG - M);
    const Xmax = Math.max(M, profundidadeVeu(yc) - 0.25);
    out.x = s * (MX + clamp(s * x - MX, Math.min(M, Xmax), Xmax)); out.y = yc; out.z = tz * ZL;
    out.dx = 0; out.dy = 0; out.dz = tz;
  }
  return out;
}

/**
 * Guarda a batida imp = {plano, x, y, z, vel, sinal} no tempo t0 (s, relógio do desenho: o FIM do passo da batida,
 * quando a bola desenhada — interpolada do começo ao fim do passo — encosta na rede). Ocupa um espaço livre ou o do
 * impacto que menos se mexe agora. Devolve o impacto guardado (ou null: lenta).
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

/** Deslocamento (vetor, m) do ponto (x, y, z) da rede no tempo t, SEM a fixação (o shader multiplica por aFixo). */
export function deslocamentoVetor(est, x, y, z, t, out) {
  let dx = 0, dy = 0, dz = 0;
  for (const i of est.imp) {
    if (!i.ativo) continue;
    const tau = t - i.t0;
    if (tau <= 0 || tau >= REDE.duracao) continue;
    if ((i.x > 0) !== (x > 0)) continue; // o outro gol (a 105 m) não sente nada
    const k = i.amp * perfil(Math.hypot(x - i.x, y - i.y, z - i.z), tau);
    dx += k * i.dx; dy += k * i.dy; dz += k * i.dz;
  }
  out.x = dx; out.y = dy; out.z = dz;
  return out;
}

const _n = { x: 0, y: 0, z: 0 }, _dv = { x: 0, y: 0, z: 0 };
/** Normal (para FORA do gol) do pano `plano` no ponto (x, y, z). */
export function normalNoPonto(plano, x, y, z, out = { x: 0, y: 0, z: 0 }) {
  const s = plano >= 4 ? 1 : -1, k = plano & 3;
  if (k === 2 || k === 3) { out.x = 0; out.y = 0; out.z = k === 2 ? -1 : 1; return out; }
  pertoPerfil(s * x - MX, y, _pp);
  out.x = s * _pp.nx; out.y = _pp.ny; out.z = 0;
  return out;
}
/** Compatível com a versão da caixa: normal de um pano no meio dele. */
export function normalPano(i, out = { x: 0, y: 0, z: 0 }) {
  const s = i >= 4 ? 1 : -1;
  return normalNoPonto(i, s * (MX + 1.3), 1.0, 0, out);
}

/** Deslocamento (m, pela normal do pano no ponto, + = para fora) SEM a fixação. */
export function deslocamento(est, plano, x, y, z, t) {
  deslocamentoVetor(est, x, y, z, t, _dv);
  normalNoPonto(plano, x, y, z, _n);
  return _dv.x * _n.x + _dv.y * _n.y + _dv.z * _n.z;
}

/** Algum impacto ainda mexendo a rede no tempo t? */
export function redeAtiva(est, t) {
  for (const i of est.imp) if (i.ativo && t - i.t0 < REDE.duracao && t - i.t0 > -1) return true;
  return false;
}

const _e0 = { X: 0, y: 0, nx: 0, ny: 0, d: 0, s: 0 }, _e1 = { X: 0, y: 0, nx: 0, ny: 0, d: 0, s: 0 };
/**
 * Batidas da bola na rede neste passo (bola no começo p0, v0 e no fim p1, v1): encostada no véu ou numa lateral,
 * chegando a ≥ vMin na direção da normal e perdendo ≥ metade dessa velocidade no passo. Por dentro → sinal +1;
 * por fora → −1. Escreve em `out` e devolve quantas achou. Traves e travessão ficam de fora.
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
    const X1 = s * p1.x - MX, X0 = s * p0.x - MX;
    if (X1 < -R || X1 > F + R + 0.4) continue;
    const base = s > 0 ? 4 : 0;
    // véu (faixa de cima + curva)
    if (X1 >= 0 && Math.abs(p1.z) <= ZL + R && p1.y <= HG + R) {
      pertoPerfil(X0, p0.y, _e0); pertoPerfil(X1, p1.y, _e1);
      const nx = s * _e1.nx, ny = _e1.ny;
      const a = v0.x * nx + v0.y * ny, b = v1.x * nx + v1.y * ny, tol = tolV(b);
      const zc = clamp(p1.z, -ZL, ZL);
      if (_e0.d < 0 && _e1.d >= -R - tol && a > REDE.vMin && b < 0.5 * a) poe(base, s * (MX + _e1.X), _e1.y, zc, a, 1);
      else if (_e0.d > 0 && _e1.d <= R + tol && a < -REDE.vMin && b > 0.5 * a) poe(base, s * (MX + _e1.X), _e1.y, zc, -a, -1);
    }
    // laterais (do poste até o véu)
    if (X1 >= RC && p1.y <= HG + R) {
      const yc = clamp(p1.y, 0, HG);
      if (X1 <= profundidadeVeu(yc) + R) {
        const xc = s * (MX + Math.min(X1, profundidadeVeu(yc)));
        for (let t = -1; t <= 1; t += 2) {
          const w = t * p1.z, a = t * v0.z, b = t * v1.z, tol = tolV(b);
          const plano = base + (t < 0 ? 2 : 3);
          if (w >= ZL - R - tol && w <= ZL && p1.y <= HG && a > REDE.vMin && b < 0.5 * a) poe(plano, xc, yc, t * ZL, a, 1);
          else if (w > ZL && w <= ZL + R + tol && a < -REDE.vMin && b > 0.5 * a) poe(plano, xc, yc, t * ZL, -a, -1);
        }
      }
    }
  }
  return n;
}

const _g = { px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0, dist: 0, dentro: false };
/** Geometria do ponto p em relação ao pano k do gol do lado s (ponto em frente, normal, distância com sinal). */
function geoPano(s, k, p, out) {
  const X = s * p.x - MX;
  if (k === 0) {
    pertoPerfil(X, p.y, _pp);
    out.px = s * (MX + _pp.X); out.py = _pp.y; out.pz = clamp(p.z, -ZL, ZL);
    out.nx = s * _pp.nx; out.ny = _pp.ny; out.nz = 0; out.dist = _pp.d;
    out.dentro = Math.abs(p.z) <= ZL && X >= -R;
  } else {
    const tz = k === 2 ? -1 : 1, yc = clamp(p.y, 0, HG);
    out.px = s * (MX + clamp(X, 0, profundidadeVeu(yc))); out.py = yc; out.pz = tz * ZL;
    out.nx = 0; out.ny = 0; out.nz = tz; out.dist = tz * p.z - ZL;
    out.dentro = X >= 0 && X <= profundidadeVeu(yc) && p.y <= HG;
  }
  return out;
}
function deslNormal(est, g, t) {
  deslocamentoVetor(est, g.px, g.py, g.pz, t, _dv);
  return (_dv.x * g.nx + _dv.y * g.ny + _dv.z * g.nz) * fixo(g.px, g.py, g.pz);
}
const _pd = { x: 0, y: 0, z: 0 };
const _encosta = new Int8Array(8), _ladoFora = new Uint8Array(8);
/**
 * Empurrão da bola DESENHADA pela rede (m, no mundo), em out {x, y, z}: com a bola encostada a bolsa que estufa
 * leva a bola junto e a rede que volta nunca passa por dentro dela; depois, 3 passadas de restrição na posição
 * final contra cada pano em que a bola encosta (Müller et al., Position Based Dynamics).
 */
export function empurraoBola(est, p, t, out) {
  out.x = 0; out.y = 0; out.z = 0;
  let algum = false;
  for (const i of est.imp) if (i.ativo && t - i.t0 > 0 && t - i.t0 < REDE.duracao) { algum = true; break; }
  if (!algum) return out;
  let nEnc = 0;
  for (let s = -1; s <= 1; s += 2) {
    const X = s * p.x - MX;
    if (X < -R || X > F + R + 0.8) continue;
    const base = s > 0 ? 4 : 0;
    for (const k of [0, 2, 3]) {
      const plano = base + k;
      const g = geoPano(s, k, p, _g);
      if (!g.dentro || Math.abs(g.dist) > R + 0.9) continue;
      _encosta[nEnc] = plano; _ladoFora[nEnc] = g.dist > 0 ? 1 : 0; nEnc++;
      const d = deslNormal(est, g, t);
      if (d === 0) continue;
      const dist = g.dist, folga = Math.abs(dist) - R;
      let e = 0;
      if (dist <= 0) {
        if (d > 0) e = d * (1 - suave(0.05, 0.35, folga));
        else if (d + folga < 0) e = d + folga;
      } else {
        if (d < 0) e = d * (1 - suave(0.05, 0.35, folga));
        else if (d - folga > 0) e = d - folga;
      }
      if (e === 0) continue;
      out.x += g.nx * e; out.y += g.ny * e; out.z += g.nz * e;
    }
  }
  for (let it = 0; it < 3; it++) {
    let mexeu = false;
    for (let q = 0; q < nEnc; q++) {
      const plano = _encosta[q], s = plano >= 4 ? 1 : -1, k = plano & 3;
      _pd.x = p.x + out.x; _pd.y = p.y + out.y; _pd.z = p.z + out.z;
      const g = geoPano(s, k, _pd, _g);
      const d = deslNormal(est, g, t);
      const viol = _ladoFora[q] ? d - (g.dist - R) : g.dist + R - d;
      if (viol <= 0.001) continue;
      const sg = _ladoFora[q] ? 1 : -1;
      out.x += sg * g.nx * viol; out.y += sg * g.ny * viol; out.z += sg * g.nz * viol;
      mexeu = true;
    }
    if (!mexeu) break;
  }
  return out;
}

/** Uniforms do shader: a = [x, y, z, amp]·4 e b = [τ, dx, dy, dz]·4 (τ = t − t0; d = direção da bolsa). */
export function uniformsRede(est, t, a, b) {
  for (let k = 0; k < REDE.maxImpactos; k++) {
    const i = est.imp[k];
    const vivo = i.ativo && t - i.t0 > 0 && t - i.t0 < REDE.duracao;
    a[4 * k] = i.x; a[4 * k + 1] = i.y; a[4 * k + 2] = i.z; a[4 * k + 3] = vivo ? i.amp : 0;
    b[4 * k] = vivo ? t - i.t0 : -1; b[4 * k + 1] = i.dx; b[4 * k + 2] = i.dy; b[4 * k + 3] = i.dz;
  }
}

const f = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/** GLSL da mesma conta: `vec3 redeDesloc(vec3 p)` (sem a fixação: o shader multiplica pelo atributo aFixo). */
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
vec3 redeDesloc(vec3 p) {
  vec3 d = vec3(0.0);
  for (int k = 0; k < ${REDE.maxImpactos}; k++) {
    vec4 a = uRedeA[k];
    vec4 b = uRedeB[k];
    if (a.w == 0.0 || b.x <= 0.0) continue;
    if ((a.x > 0.0) != (p.x > 0.0)) continue;
    d += a.w * redePerfil(length(p - a.xyz), b.x) * b.yzw;
  }
  return d;
}
`;
