// Contas de cor do desenho (item 45; plano em `golaco/PLANO-GRAFICOS.md`, pesquisa em `PESQUISA-ESTADIO.md` §19). Puro (sem
// three nem DOM), só para as ferramentas e os testes:
// - sRGB ↔ linear e OKLab/OKLCh (Ottosson, https://bottosson.github.io/posts/oklab/);
// - a luz Lambert do three r170: radiância = albedo × E/π, com E = Σ max(N·d, 0)·cor·intensidade (as direcionais) +
//   mix(chão, céu, 0,5·N·cima + 0,5)·intensidade (o hemisfério); BRDF_Lambert = albedo/π (`common`), sem o π antigo (r155+).
//   As luzes do dia e da noite são CÓPIAS do `HORAS` de `js/render/cena.js` e o poço de luz da noite é a cópia do
//   `LUZ_NOITE_GLSL` de `js/render/campo.js` (o `--auto` confere as duas pelo texto dos arquivos);
// - os tons do r170 (`tonemapping_pars_fragment`), na MESMA ordem das contas do shader: ACES (o ajuste do Hill, com o ×1/0,6
//   do PR #19696), AgX (o do Filament #7236, PRs #27366 e #27413) e o Khronos PBR Neutral (PR #27668);
// - a inversa EXATA do ACES do r170 (por canal, a raiz não negativa da quadrática do RRTAndODTFit, na forma estável): o
//   albedo que dá uma cor de saída.
// No fim do shader do three a ordem é tom → `colorspace_fragment` (sRGB) → névoa. As funções devolvem a cor LINEAR depois do
// tom (a que o OKLab mede); a névoa não entra (de dia começa a 150 m, fora do campo; à noite a 55 m: medir na página).
// Matrizes no formato do GLSL (por COLUNAS): `mat3(c0, c1, c2) * v` = c0·v.x + c1·v.y + c2·v.z.
// Auto-teste: `node golaco/tools/lib/cor-aces.mjs --auto` (ida e volta, os números do plano e as cópias conferidas).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ sRGB e OKLab

/** sRGB (0–1) → linear. */
export const decSrgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
/** Linear → sRGB (0–1). */
export const encSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
/** 0xRRGGBB (como o `Color.setHex` do three, que converte de sRGB) → [r, g, b] linear. */
export const linearDeHex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255].map(v => decSrgb(v / 255));
/** [r, g, b] em 0–255 (sRGB) → linear. */
export const linearDeSrgb8 = rgb => rgb.map(v => decSrgb(v / 255));
/** Linear → [r, g, b] em 0–255 (sRGB, arredondado e limitado). */
export const srgb8DeLinear = lin => lin.map(x => Math.round(Math.min(1, Math.max(0, encSrgb(x))) * 255));
/** Linear → '#rrggbb'. */
export const hexDeLinear = lin => '#' + srgb8DeLinear(lin).map(v => v.toString(16).padStart(2, '0')).join('');

/** Linear sRGB → OKLab {L, a, b} e OKLCh {C, h (graus, 0–360)}. */
export function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { L, a: A, b: B, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}

/** OKLab → linear sRGB (sem limitar à gama). */
export function linearDeOklab(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

/** OKLCh (h em graus) → linear sRGB (sem limitar à gama). */
export const linearDeOklch = (L, C, h) => linearDeOklab(L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180));

/** Diferença de matiz a − b em graus, no intervalo (−180, 180]. */
export function difMatiz(a, b) {
  let d = ((a - b) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export const fmt = o => `L ${o.L.toFixed(3)} C ${o.C.toFixed(3)} h ${o.h.toFixed(1)}°`;

// ------------------------------------------------------------------ matrizes (por colunas, como no GLSL)

const mulCol = (M, v) => [0, 1, 2].map(i => M[0][i] * v[0] + M[1][i] * v[1] + M[2][i] * v[2]);

function inversaCol(M) {
  // linhas R[i][j] = M[j][i]; inversa pelos cofatores; de volta às colunas
  const [[a, d, g], [b, e, h], [c, f, i]] = M; // a b c / d e f / g h i em linhas
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const R = [
    [A, -(b * i - c * h), b * f - c * e],
    [B, a * i - c * g, -(a * f - c * d)],
    [C, -(a * h - b * g), a * e - b * d],
  ].map(l => l.map(x => x / det));
  return [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
}

const sat = x => Math.min(1, Math.max(0, x));

// ------------------------------------------------------------------ ACES do r170 e a inversa exata

const ACES_ENTRADA = [[0.59719, 0.07600, 0.02840], [0.35458, 0.90834, 0.13383], [0.04823, 0.01566, 0.83777]];
const ACES_SAIDA = [[1.60475, -0.10208, -0.00327], [-0.53108, 1.10813, -0.07276], [-0.07367, -0.00605, 1.07602]];
const ACES_ENTRADA_INV = inversaCol(ACES_ENTRADA), ACES_SAIDA_INV = inversaCol(ACES_SAIDA);
const rrtOdt = v => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
/** Os limites do RRTAndODTFit para v ≥ 0: rrtOdt(0) e a assíntota (v → ∞). */
export const ACES_FAIXA = { min: rrtOdt(0), max: 1 / 0.983729 };

/** O ACESFilmicToneMapping do r170: radiância linear → saída linear (0–1). */
export function aces(rad, exposicao = 1) {
  const v = mulCol(ACES_ENTRADA, rad.map(x => x * exposicao / 0.6)).map(rrtOdt);
  return mulCol(ACES_SAIDA, v).map(sat);
}

/**
 * A inversa do RRTAndODTFit para v ≥ 0: y(0,983729v² + 0,432951v + 0,238081) = v² + 0,0245786v − 0,000090537, ou seja
 * A·v² + B·v + C = 0 com A = 1 − 0,983729y, B = 0,0245786 − 0,432951y, C = −0,000090537 − 0,238081y (A > 0 e C ≤ 0 na faixa:
 * as raízes têm sinais opostos). A raiz não negativa pela forma estável (q = −(B + sinal(B)·√Δ)/2).
 */
function rrtOdtInversa(y) {
  if (!(y >= ACES_FAIXA.min - 1e-12 && y < ACES_FAIXA.max)) {
    throw new RangeError(`cor-aces: ${y} fora da faixa do RRTAndODTFit [${ACES_FAIXA.min}, ${ACES_FAIXA.max}) — a cor não sai do ACES com radiância ≥ 0`);
  }
  const A = 1 - 0.983729 * y, B = 0.0245786 - 0.432951 * y, C = -0.000090537 - 0.238081 * y;
  const raiz = Math.sqrt(Math.max(0, B * B - 4 * A * C));
  if (B > 0) { const q = -0.5 * (B + raiz); return q === 0 ? 0 : Math.max(0, C / q); }
  return 0.5 * (-B + raiz) / A;
}

/**
 * A inversa exata do ACES do r170: saída linear → radiância antes do tom (com a mesma exposição). Exata enquanto o `saturate`
 * do fim não cortou (a saída dentro de 0–1 sem ter batido nos limites). Lança RangeError se a cor não sai do ACES.
 */
export function acesInversa(saida, exposicao = 1) {
  const v = mulCol(ACES_SAIDA_INV, saida).map(rrtOdtInversa);
  return mulCol(ACES_ENTRADA_INV, v).map(x => x * 0.6 / exposicao);
}

// ------------------------------------------------------------------ AgX e Neutral do r170

const SRGB_PARA_2020 = [[0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.0880], [0.0433, 0.0113, 0.8956]];
const R2020_PARA_SRGB = [[1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]];
const AGX_ENTRADA = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const AGX_SAIDA = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];
const AGX_MIN_EV = -12.47393, AGX_MAX_EV = 4.026069;
const agxContraste = x => {
  const x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
};

/** O AgXToneMapping do r170: radiância linear → saída linear (0–1). */
export function agx(rad, exposicao = 1) {
  let v = mulCol(AGX_ENTRADA, mulCol(SRGB_PARA_2020, rad.map(x => x * exposicao)));
  v = v.map(x => sat((Math.log2(Math.max(x, 1e-10)) - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV))).map(agxContraste);
  v = mulCol(AGX_SAIDA, v).map(x => Math.pow(Math.max(0, x), 2.2));
  return mulCol(R2020_PARA_SRGB, v).map(sat);
}

/** O NeutralToneMapping do r170 (Khronos PBR Neutral): radiância linear → saída linear. */
export function neutral(rad, exposicao = 1) {
  const inicio = 0.8 - 0.04, dessatura = 0.15;
  let v = rad.map(x => x * exposicao);
  const x = Math.min(...v);
  const desloc = x < 0.08 ? x - 6.25 * x * x : 0.04;
  v = v.map(y => y - desloc);
  const pico = Math.max(...v);
  if (pico < inicio) return v;
  const d = 1 - inicio, novoPico = 1 - d * d / (pico + d - inicio);
  v = v.map(y => y * novoPico / pico);
  const g = 1 - 1 / (dessatura * (pico - novoPico) + 1);
  return v.map(y => y + (novoPico - y) * g);
}

export const TONS = { aces, agx, neutral };

// ------------------------------------------------------------------ a luz do jogo (cópias do cena.js e do campo.js)

/** Cópia do `HORAS` de `js/render/cena.js` (só o que ilumina; o `--auto` confere pelo texto). */
export const LUZES = {
  dia: {
    solDir: [-0.42, 0.74, 0.52], hemiCeu: 0xc4dcff, hemiChao: 0x55703c, hemiInt: 1.45, luzCor: 0xfff3e2, luzInt: 3.3,
    extraInt: 0, extraDir: [0.5, 0.7, -0.5], exposicao: 1.0,
  },
  noite: {
    solDir: [0.26, 0.9, 0.36], hemiCeu: 0x7f93b8, hemiChao: 0x0c180c, hemiInt: 0.32, luzCor: 0xe2ecff, luzInt: 2.9,
    extraInt: 1.25, extraDir: [-0.5, 0.75, -0.45], exposicao: 0.98,
  },
};
/** A cor da luz extra (os refletores do outro lado), fixa no `aplicarHora` do cena.js. */
export const COR_EXTRA = 0xdfe8ff;

const unit = v => { const n = Math.hypot(...v); return v.map(x => x / n); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * E/π da luz Lambert do r170 numa superfície de normal `normal` (o fator que multiplica o albedo linear): o sol (a direção do
 * `luz` é o `solDir`, posta a 80 m do foco), a extra (a posição `extraDir` × 60 olhando a origem) e o hemisfério (para cima).
 */
export function luzLambert(normal = [0, 1, 0], hora = 'dia') {
  const H = LUZES[hora] ?? LUZES.dia;
  const N = unit(normal);
  const sol = linearDeHex(H.luzCor).map(x => x * H.luzInt * Math.max(dot(N, unit(H.solDir)), 0));
  const extra = linearDeHex(COR_EXTRA).map(x => x * H.extraInt * Math.max(dot(N, unit(H.extraDir)), 0));
  const w = 0.5 * N[1] + 0.5;
  const ceu = linearDeHex(H.hemiCeu), chao = linearDeHex(H.hemiChao);
  const hemi = ceu.map((c, i) => (chao[i] + (c - chao[i]) * w) * H.hemiInt);
  return sol.map((x, i) => (x + extra[i] + hemi[i]) / Math.PI);
}

/** E/π no chão (normal para cima). */
export const luzChao = (hora = 'dia') => luzLambert([0, 1, 0], hora);

/** Cópia do `luzNoite` (o poço de luz da noite no gramado e no entorno) do `LUZ_NOITE_GLSL` de `js/render/campo.js`. */
export function pocoNoite(x, z) {
  const qx = x / 62.0, qz = z / 41.0;
  const r2 = qx * qx * 0.75 + qz * qz;
  const t = Math.min(1, Math.max(0, (r2 - 0.3) / (1.35 - 0.3)));
  return 1.04 + (0.5 - 1.04) * t * t * (3 - 2 * t);
}

/**
 * A cor linear na tela (antes do sRGB, a que o OKLab mede) de um albedo linear no chão: albedo × E/π × `fator` → tom.
 * `fator` leva o que o shader do gramado multiplica a mais (o poço da noite, a profundidade, as manchas).
 */
export function corNaTela(albedo, { hora = 'dia', tom = 'aces', exposicao, fator = 1, normal } = {}) {
  const E = normal ? luzLambert(normal, hora) : luzChao(hora);
  const exp = exposicao ?? (LUZES[hora] ?? LUZES.dia).exposicao;
  const f = TONS[tom];
  if (!f) throw new Error(`cor-aces: tom desconhecido "${tom}"`);
  return f(albedo.map((x, i) => x * E[i] * fator), exp);
}

/** O albedo linear no chão que, sob o ACES e a luz da hora, sai na tela com o OKLCh pedido (a inversa exata). */
export function albedoPara(L, C, h, { hora = 'dia', exposicao, fator = 1 } = {}) {
  const exp = exposicao ?? (LUZES[hora] ?? LUZES.dia).exposicao;
  const E = luzChao(hora);
  return acesInversa(linearDeOklch(L, C, h), exp).map((x, i) => x / E[i] / fator);
}

// ------------------------------------------------------------------ auto-teste

function autoTeste() {
  const AQUI = path.dirname(fileURLToPath(import.meta.url));
  const GOLACO = path.resolve(AQUI, '..', '..');
  const falhas = [];
  let ok = 0;
  const conferir = (cond, msg) => { if (cond) ok++; else falhas.push(msg); };
  const perto = (v, alvo, tol, msg) => conferir(Math.abs(v - alvo) <= tol, `${msg}: ${v} (alvo ${alvo} ± ${tol})`);
  const maxDif = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));

  // 1. sRGB: ida e volta nos 256 níveis
  let pior = 0;
  for (let v = 0; v < 256; v++) pior = Math.max(pior, Math.abs(encSrgb(decSrgb(v / 255)) * 255 - v));
  conferir(pior < 1e-9, `sRGB ida e volta: pior ${pior}`);
  conferir(hexDeLinear(linearDeHex(0x6b7f45)) === '#6b7f45', 'hex → linear → hex');

  // 2. OKLab: os valores de referência (CSS Color 4: o vermelho, o verde e o azul do sRGB; o branco) e a ida e volta
  const ref = [
    [[1, 0, 0], 0.627955, 0.257683, 29.2339],
    [[0, 1, 0], 0.866440, 0.294827, 142.4953],
    [[0, 0, 1], 0.452014, 0.313214, 264.052],
  ];
  for (const [lin, L, C, h] of ref) {
    const o = oklab(lin);
    conferir(Math.abs(o.L - L) < 5e-4 && Math.abs(o.C - C) < 5e-4 && Math.abs(difMatiz(o.h, h)) < 0.05,
      `OKLab de ${lin}: ${fmt(o)} (referência L ${L} C ${C} h ${h})`);
  }
  const branco = oklab([1, 1, 1]);
  conferir(Math.abs(branco.L - 1) < 1e-4 && branco.C < 1e-4, `OKLab do branco: ${fmt(branco)}`);
  pior = 0;
  for (let r = 0; r <= 10; r++) for (let g = 0; g <= 10; g++) for (let b = 0; b <= 10; b++) {
    const lin = [r / 10, g / 10, b / 10], o = oklab(lin);
    pior = Math.max(pior, maxDif(linearDeOklab(o.L, o.a, o.b), lin));
  }
  // as matrizes do Ottosson vêm com 10 casas (a ida e a volta não são inversas exatas): ~3e-7 no linear
  conferir(pior < 1e-6, `OKLab ida e volta: pior ${pior}`);

  // 3. ACES: radiância → saída → radiância (sem o saturate cortar) e saída → radiância → saída
  const niveis = [0.002, 0.01, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2];
  let casos = 0;
  pior = 0;
  for (const exp of [1, 0.98, 1.4]) {
    for (const r of niveis) for (const g of niveis) for (const b of niveis) {
      const rad = [r, g, b], out = aces(rad, exp);
      if (!out.every(x => x > 1e-6 && x < 1 - 1e-6)) continue;
      const vd = acesInversa(out, exp);
      pior = Math.max(pior, ...vd.map((x, i) => Math.abs(x - rad[i]) / Math.max(rad[i], 1e-3)));
      casos++;
    }
  }
  conferir(casos >= 300 && pior < 1e-9, `ACES ida e volta (radiância): ${casos} casos, pior erro relativo ${pior}`);
  casos = 0;
  pior = 0;
  for (let L = 0.15; L <= 0.951; L += 0.05) for (const C of [0, 0.04, 0.08, 0.12]) for (let h = 0; h < 360; h += 30) {
    const out = linearDeOklch(L, C, h);
    if (!out.every(x => x > 1e-4 && x < 0.999)) continue;
    let rad;
    try { rad = acesInversa(out); } catch { continue; }
    pior = Math.max(pior, maxDif(aces(rad), out));
    casos++;
  }
  conferir(casos >= 200 && pior < 1e-9, `ACES volta e ida (saída): ${casos} casos, pior ${pior}`);
  let lancou = false;
  try { acesInversa([1, 1, 1].map(x => x * 1.2)); } catch (e) { lancou = e instanceof RangeError; }
  conferir(lancou, 'a inversa recusa a cor que o ACES não dá');

  // 4. Os números do plano (PLANO-GRAFICOS.md §1.3 e §2; PESQUISA-ESTADIO.md §19): a luz do dia no chão, o gramado de hoje
  //    sob os três tons, a linha e os albedos-alvo pela inversa
  const E = luzChao('dia');
  conferir(maxDif(E, [1.034, 1.029, 1.054]) < 0.001, `E/π do dia no chão: ${E.map(x => x.toFixed(4)).join(' ')} (1,034 1,029 1,054)`);
  const claro = linearDeSrgb8([96, 138, 64]), escuro = linearDeSrgb8([74, 114, 50]), linha = linearDeHex(0xf3f6f1);
  const medirFaixas = (tom, exp, a = claro, b = escuro) => {
    const oa = oklab(corNaTela(a, { tom, exposicao: exp })), ob = oklab(corNaTela(b, { tom, exposicao: exp }));
    return { dL: oa.L - ob.L, L: (oa.L + ob.L) / 2, C: (oa.C + ob.C) / 2, h: (oa.h + ob.h) / 2 };
  };
  const hoje = medirFaixas('aces');
  perto(hoje.dL, 0.104, 0.0015, 'ACES, ΔL das faixas de hoje');
  perto(hoje.L, 0.579, 0.0015, 'ACES, L do gramado de hoje');
  perto(hoje.C, 0.128, 0.0015, 'ACES, C do gramado de hoje');
  perto(hoje.h, 134.8, 0.3, 'ACES, h do gramado de hoje');
  perto(oklab(corNaTela(linha)).L, 0.908, 0.0015, 'ACES, pico da linha de hoje');
  perto(oklab(corNaTela(linha, { fator: 1.8 })).L, 0.952, 0.0015, 'ACES, a linha × 1,8');
  const agxHoje = medirFaixas('agx');
  perto(agxHoje.dL, 0.069, 0.0015, 'AgX, ΔL das faixas de hoje');
  perto(agxHoje.C, 0.090, 0.0015, 'AgX, C do gramado de hoje');
  perto(agxHoje.h, 130, 1, 'AgX, h do gramado de hoje');
  perto(oklab(corNaTela(linha, { tom: 'agx' })).L, 0.832, 0.0015, 'AgX, a linha de hoje');
  const neuHoje = medirFaixas('neutral');
  perto(neuHoje.dL, 0.079, 0.0015, 'Neutral, ΔL das faixas de hoje');
  perto(neuHoje.C, 0.130, 0.0015, 'Neutral, C do gramado de hoje');
  perto(neuHoje.L, 0.515, 0.0015, 'Neutral, L do gramado de hoje');
  perto(oklab(corNaTela(linha, { tom: 'neutral' })).L, 0.945, 0.0015, 'Neutral, a linha de hoje');
  // os albedos-alvo (h 124°, C 0,10, ΔL 0,056 em volta de L 0,579): a inversa dá os valores e os hex do plano
  const alvoClaro = albedoPara(0.607, 0.10, 124), alvoEscuro = albedoPara(0.551, 0.10, 124);
  conferir(maxDif(alvoClaro, [0.1485, 0.2112, 0.0594]) < 0.0005 && hexDeLinear(alvoClaro) === '#6b7f45',
    `albedo da faixa clara: ${alvoClaro.map(x => x.toFixed(4)).join(' ')} ${hexDeLinear(alvoClaro)} (0,1485 0,2112 0,0594 #6b7f45)`);
  conferir(maxDif(alvoEscuro, [0.1191, 0.1683, 0.0420]) < 0.0005 && hexDeLinear(alvoEscuro) === '#61723a',
    `albedo da faixa escura: ${alvoEscuro.map(x => x.toFixed(4)).join(' ')} ${hexDeLinear(alvoEscuro)} (0,1191 0,1683 0,0420 #61723a)`);
  const alvoFora = albedoPara(0.404, 0.09, 124);
  conferir(hexDeLinear(alvoFora) === '#47541d', `albedo do chão de fora: ${hexDeLinear(alvoFora)} (#47541d)`);
  const novo = medirFaixas('aces', 1, alvoClaro, alvoEscuro);
  perto(novo.dL, 0.056, 1e-6, 'ACES, ΔL das faixas-alvo (a inversa é exata)');
  perto(novo.C, 0.10, 1e-6, 'ACES, C das faixas-alvo');
  perto(novo.h, 124, 1e-4, 'ACES, h das faixas-alvo');
  const neuNovo = medirFaixas('neutral', 1.40, alvoClaro, alvoEscuro);
  perto(neuNovo.L, 0.579, 0.005, 'Neutral × 1,40, L das faixas-alvo');
  perto(neuNovo.dL, 0.051, 0.0015, 'Neutral × 1,40, ΔL das faixas-alvo');
  perto(oklab(corNaTela(linha, { tom: 'neutral', exposicao: 1.40 })).L, 0.972, 0.0015, 'Neutral × 1,40, a linha de hoje');
  const agxNovo = medirFaixas('agx', 1.01, alvoClaro, alvoEscuro);
  perto(agxNovo.dL, 0.037, 0.0015, 'AgX × 1,01, ΔL das faixas-alvo');
  perto(agxNovo.C, 0.070, 0.0015, 'AgX × 1,01, C das faixas-alvo');
  perto(oklab(corNaTela(linha, { tom: 'agx', exposicao: 1.01, fator: 1.8 })).L, 0.893, 0.0015, 'AgX × 1,01, a linha × 1,8');
  // a noite: o poço de luz no meio e a luz no chão (só a conferência de que a conta roda e é coerente)
  perto(pocoNoite(0, 0), 1.04, 1e-12, 'poço da noite no meio');
  perto(pocoNoite(200, 0), 0.5, 1e-12, 'poço da noite longe');
  const En = luzChao('noite');
  conferir(En.every(x => x > 0) && En[2] / En[0] > E[2] / E[0], `E/π da noite no chão: ${En.map(x => x.toFixed(4)).join(' ')} (mais azul que a do dia)`);

  // 5. As cópias conferidas pelo texto: o HORAS do cena.js e o luzNoite do campo.js
  const ler = arq => { try { return fs.readFileSync(path.join(GOLACO, ...arq), 'utf8'); } catch { falhas.push(`não li ${arq.join('/')}`); return ''; } };
  const cena = ler(['js', 'render', 'cena.js']);
  for (const [hora, H] of Object.entries(LUZES)) {
    const ini = cena.indexOf(`${hora}: {`), fim = cena.indexOf('},', ini);
    const bloco = ini >= 0 && fim > ini ? cena.slice(ini, fim) : '';
    conferir(bloco !== '', `cena.js: o bloco "${hora}" do HORAS`);
    for (const [chave, valor] of Object.entries(H)) {
      const m = bloco.match(new RegExp(`\\b${chave}:\\s*(\\[[^\\]]*\\]|[^,\\n]+)`));
      const lido = m ? (m[1].startsWith('[') ? JSON.parse(m[1]) : Number(m[1].trim())) : undefined;
      conferir(JSON.stringify(lido) === JSON.stringify(valor), `cena.js HORAS.${hora}.${chave}: ${JSON.stringify(lido)} × a cópia ${JSON.stringify(valor)}`);
    }
  }
  conferir(cena.includes(`extra.color.setHex(0x${COR_EXTRA.toString(16)})`), 'cena.js: a cor da luz extra');
  conferir(cena.includes('THREE.ACESFilmicToneMapping'), 'cena.js: o tom é o ACES');
  conferir(/luz\.position\.copy\(foco\)\.addScaledVector\(dirLuz, \d+\)/.test(cena), 'cena.js: o sol na direção do solDir');
  const campo = ler(['js', 'render', 'campo.js']);
  conferir(campo.includes('vec2 q = vec2(p.x / 62.0, p.y / 41.0);') && campo.includes('float r2 = q.x * q.x * 0.75 + q.y * q.y;')
    && campo.includes('return mix(1.04, 0.5, smoothstep(0.3, 1.35, r2));'), 'campo.js: o luzNoite igual à cópia');

  // 6. As fórmulas do r170 conferidas no three do cache do CDN (o mesmo que a página baixa), quando ele está aqui
  const three = path.join(GOLACO, 'tools', '.cache-cdn', 'https___cdn.jsdelivr.net_npm_three_0.170.0_build_three.module.min.js');
  let notaThree = '';
  if (fs.existsSync(three)) {
    const t = fs.readFileSync(three, 'utf8');
    const trechos = [
      'vec3( 0.59719, 0.07600, 0.02840 )', 'vec3( 0.35458, 0.90834, 0.13383 )', 'vec3( 0.04823, 0.01566, 0.83777 )',
      'vec3(  1.60475, -0.10208, -0.00327 )', 'vec3( -0.53108,  1.10813, -0.07276 )', 'vec3( -0.07367, -0.00605,  1.07602 )',
      'v * ( v + 0.0245786 ) - 0.000090537', 'v * ( 0.983729 * v + 0.4329510 ) + 0.238081', 'toneMappingExposure / 0.6',
      'vec3( 0.6274, 0.0691, 0.0164 )', 'vec3( 1.6605, - 0.1246, - 0.0182 )', '0.856627153315983', '1.2519364065950405',
      'AgxMinEv = - 12.47393', 'AgxMaxEv = 4.026069', '15.5 * x4 * x2', '- 40.14 * x4 * x', '- 0.00232',
      '0.8 - 0.04', 'Desaturation = 0.15', 'x - 6.25 * x * x : 0.04',
      'hemiDiffuseWeight = 0.5 * dotNL + 0.5', 'RECIPROCAL_PI * diffuseColor', 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) )',
    ];
    for (const s of trechos) conferir(t.includes(s), `three r170 (cache do CDN): falta o trecho "${s}"`);
  } else {
    notaThree = ' (o three r170 não está no cache do CDN: a conferência das fórmulas pelo texto dele foi pulada)';
  }

  if (falhas.length) {
    console.log(`cor-aces --auto: ${falhas.length} FALHA(S), ${ok} ok${notaThree}`);
    for (const f of falhas) console.log('  FALHOU: ' + f);
    return false;
  }
  console.log(`cor-aces --auto: ${ok} conferências ok${notaThree}`);
  console.log(`  hoje (ACES): ΔL ${hoje.dL.toFixed(3)}, gramado ${fmt(hoje)}, linha L ${oklab(corNaTela(linha)).L.toFixed(3)}`);
  console.log(`  alvo (ACES): claro ${hexDeLinear(alvoClaro)}, escuro ${hexDeLinear(alvoEscuro)}, fora ${hexDeLinear(alvoFora)}; ΔL ${novo.dL.toFixed(3)}, ${fmt(novo)}`);
  return true;
}

const principal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (principal) {
  if (process.argv.includes('--auto')) process.exit(autoTeste() ? 0 : 1);
  console.log('uso: node golaco/tools/lib/cor-aces.mjs --auto   (auto-teste; o módulo é para ser importado pelas ferramentas)');
}
