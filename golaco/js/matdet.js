// Matemática DETERMINÍSTICA para a lógica do jogo: o mesmo resultado, bit a bit, em qualquer
// motor JavaScript (Node, Chrome, Safari, Firefox, versões diferentes).
//
// Por quê: Math.sin, Math.cos e Math.pow NÃO são iguais entre motores nem entre versões do
// mesmo motor (medido: Node 22 / V8 12.4 × Chromium 141 / V8 14.1 diferem no último bit em
// ~3–10% dos valores). Uma diferença de 1 bit na velocidade da bola vira outra jogada alguns
// segundos depois — e o replay / a comparação Node × navegador quebra. Aqui só entram + − × ÷,
// Math.sqrt, Math.round, Math.abs e Math.floor, que o IEEE 754 obriga a darem o mesmo resultado.
//
// Algoritmos e coeficientes do fdlibm (Sun Microsystems, domínio público com aviso; os mesmos do
// FreeBSD msun): seno/cosseno com redução de Cody–Waite + polinômios de núcleo, atan/atan2,
// exp e log. Precisão ~1 ulp (conferida contra Math em tools/teste-matdet.mjs). pow = exp(y·log x).

const ABS = Math.abs, SQRT = Math.sqrt, ROUND = Math.round;

// ------------------------------------------------------------------ seno e cosseno
const INVPIO2 = 6.36619772367581382433e-01;
const PIO2_1 = 1.57079632673412561417e+00;   // primeiros 33 bits de π/2
const PIO2_1T = 6.07710050650619224932e-11;  // π/2 − PIO2_1
const PIO4 = 7.85398163397448278999e-01;

const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04;
const S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05;
const C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;

/** Núcleo do seno em [−π/4, π/4]; x + y é o argumento (y = cauda da redução). */
function kSen(x, y) {
  const z = x * x, v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (y === 0) return x + v * (S1 + z * r);
  return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

/** Núcleo do cosseno em [−π/4, π/4]. */
function kCos(x, y) {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  const hz = 0.5 * z;
  const w = 1 - hz;
  return w + (((1 - w) - hz) + (z * r - x * y));
}

// redução: x = n·π/2 + (y0 + y1); exata para |n| < 2^20 (|x| < ~1,6 milhão)
let RY0 = 0, RY1 = 0;
function reduzir(x) {
  const n = ROUND(x * INVPIO2);
  const r = x - n * PIO2_1;
  const w = n * PIO2_1T;
  RY0 = r - w;
  RY1 = (r - RY0) - w;
  return n;
}

export function sin(x) {
  if (ABS(x) <= PIO4) return kSen(x, 0);
  const n = reduzir(x) & 3;
  if (n === 0) return kSen(RY0, RY1);
  if (n === 1) return kCos(RY0, RY1);
  if (n === 2) return -kSen(RY0, RY1);
  return -kCos(RY0, RY1);
}

export function cos(x) {
  if (ABS(x) <= PIO4) return kCos(x, 0);
  const n = reduzir(x) & 3;
  if (n === 0) return kCos(RY0, RY1);
  if (n === 1) return -kSen(RY0, RY1);
  if (n === 2) return -kCos(RY0, RY1);
  return kSen(RY0, RY1);
}

// ------------------------------------------------------------------ arco-tangente
const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT0 = 3.33333333333329318027e-01, AT1 = -1.99999999998764832476e-01, AT2 = 1.42857142725034663711e-01;
const AT3 = -1.11111104054623557880e-01, AT4 = 9.09088713343650656196e-02, AT5 = -7.69187620504482999495e-02;
const AT6 = 6.66107313738753120669e-02, AT7 = -5.83357013379057348645e-02, AT8 = 4.97687799461593236017e-02;
const AT9 = -3.65315727442169155270e-02, AT10 = 1.62858201153657823623e-02;

export function atan(x) {
  if (x !== x) return x;
  const neg = x < 0;
  let a = neg ? -x : x;
  if (a >= 7.378697629483821e19) { const z = ATANHI[3] + ATANLO[3]; return neg ? -z : z; } // 2^66
  let id = -1;
  if (a < 0.4375) {
    if (a < 1.862645149230957e-9) return x; // 2^-29
  } else if (a < 1.1875) {
    if (a < 0.6875) { id = 0; a = (2 * a - 1) / (2 + a); } else { id = 1; a = (a - 1) / (a + 1); }
  } else if (a < 2.4375) { id = 2; a = (a - 1.5) / (1 + 1.5 * a); } else { id = 3; a = -1 / a; }
  const z = a * a, w = z * z;
  const s1 = z * (AT0 + w * (AT2 + w * (AT4 + w * (AT6 + w * (AT8 + w * AT10)))));
  const s2 = w * (AT1 + w * (AT3 + w * (AT5 + w * (AT7 + w * AT9))));
  if (id < 0) { const r = a - a * (s1 + s2); return neg ? -r : r; }
  const r = ATANHI[id] - ((a * (s1 + s2) - ATANLO[id]) - a);
  return neg ? -r : r;
}

const PI = 3.14159265358979311600e+00, PI_LO = 1.2246467991473531772e-16, PI_O2 = 1.57079632679489655800e+00;

export function atan2(y, x) {
  if (x !== x || y !== y) return NaN;
  if (y === 0) {
    if (x > 0 || (x === 0 && 1 / x > 0)) return y;      // atan2(±0, +x) = ±0
    return 1 / y > 0 ? PI : -PI;                          // atan2(±0, −x) = ±π
  }
  if (x === 0) return y > 0 ? PI_O2 : -PI_O2;
  if (x === 1) return atan(y);
  const q = ABS(y / x);
  let z;
  if (q > 1.152921504606847e18) z = PI_O2 + 0.5 * PI_LO;            // |y/x| > 2^60
  else if (x < 0 && q < 8.673617379884035e-19) z = 0;                // |y/x| < 2^-60
  else z = atan(q);
  if (x > 0) return y > 0 ? z : -z;
  return y > 0 ? PI - (z - PI_LO) : (z - PI_LO) - PI;
}

export function asin(x) {
  if (!(ABS(x) <= 1)) return NaN;
  return atan2(x, SQRT((1 - x) * (1 + x)));
}

export function acos(x) {
  if (!(ABS(x) <= 1)) return NaN;
  return atan2(SQRT((1 - x) * (1 + x)), x);
}

// ------------------------------------------------------------------ exp e log
const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, INVLN2 = 1.44269504088896338700e+00;
const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05;
const P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;

// potências de 2 exatas (construídas por duplicação, que é exata)
const POT2 = new Float64Array(2100);
{
  let v = 1;
  for (let k = 0; k <= 1023; k++) { POT2[k + 1075] = v; v *= 2; }
  v = 1;
  for (let k = 0; k >= -1074; k--) { POT2[k + 1075] = v; v /= 2; }
}
function escala2(y, k) {
  if (k >= -1022 && k <= 1023) return y * POT2[k + 1075];
  const k1 = k >> 1;
  return y * POT2[k1 + 1075] * POT2[k - k1 + 1075];
}

export function exp(x) {
  if (x !== x) return x;
  if (x > 709.782712893383973096) return Infinity;
  if (x < -745.13321910194110842) return 0;
  if (ABS(x) < 3.725290298461914e-9) return 1 + x; // 2^-28
  const k = ROUND(x * INVLN2);
  const hi = x - k * LN2_HI;   // exata: LN2_HI tem 32 bits
  const lo = k * LN2_LO;
  const r = hi - lo;
  const t = r * r;
  const c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  const y = 1 - ((lo - (r * c) / (2 - c)) - hi);
  return k === 0 ? y : escala2(y, k);
}

const LG1 = 6.666666666666735130e-01, LG2 = 3.999999999940941908e-01, LG3 = 2.857142874366239149e-01;
const LG4 = 2.222219843214978396e-01, LG5 = 1.818357216161805012e-01, LG6 = 1.531383769920937332e-01;
const LG7 = 1.479819860511658591e-01;
const DV = new DataView(new ArrayBuffer(8));

export function log(x) {
  if (x !== x || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return x;
  let k = 0;
  if (x < 2.2250738585072014e-308) { x *= 18014398509481984; k = -54; } // subnormal: × 2^54 (exato)
  DV.setFloat64(0, x);
  let hx = DV.getUint32(0);
  k += (hx >>> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  DV.setUint32(0, hx | (i ^ 0x3ff00000));   // mantissa em [√2/2, √2)
  k += i >>> 20;
  const f = DV.getFloat64(0) - 1;
  const hfsq = 0.5 * f * f;
  const s = f / (2 + f);
  const z = s * s, w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const R = t2 + t1;
  if (k === 0) return f - (hfsq - s * (hfsq + R));
  return k * LN2_HI - ((hfsq - (s * (hfsq + R) + k * LN2_LO)) - f);
}

/** x^y (x ≥ 0, ou x < 0 com y inteiro). Erro ~|y·ln x|·2⁻⁵³ relativo. */
export function pow(x, y) {
  if (y === 0) return 1;
  if (y === 1) return x;
  if (y === 2) return x * x;
  if (x !== x || y !== y) return NaN;
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (x < 0) {
    if (Math.floor(y) !== y) return NaN;
    const r = exp(y * log(-x));
    return (y % 2 === 0) ? r : -r;
  }
  if (x === 1) return 1;
  return exp(y * log(x));
}

/** Hipotenusa (sem a proteção contra estouro do Math.hypot, que varia entre motores). */
export function hypot(a, b, c) {
  if (c === undefined) return SQRT(a * a + b * b);
  return SQRT(a * a + b * b + c * c);
}

/** Mesmo formato do Math, para trocar `Math.sin(` por `MD.sin(` na lógica. */
export const MD = Object.freeze({ sin, cos, atan, atan2, asin, acos, exp, log, pow, hypot, PI });
