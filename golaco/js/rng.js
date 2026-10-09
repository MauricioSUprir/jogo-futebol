// Gerador de números com semente (sfc32, de Chris Doty-Humphrey / PractRand).
// O estado são 4 inteiros de 32 bits guardados no próprio mundo, então copiar o mundo
// copia o gerador e a partida continua igual bit a bit. Nunca use Math.random na lógica.

function splitmix32(a) {
  return function () {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

/** Cria o estado do gerador a partir de uma semente inteira. */
export function criarRng(semente) {
  const sm = splitmix32(semente >>> 0);
  const s = [sm(), sm(), sm(), sm()];
  const r = { s };
  for (let i = 0; i < 12; i++) proximoU32(r); // aquece
  return r;
}

/** Próximo inteiro sem sinal de 32 bits. */
export function proximoU32(r) {
  const s = r.s;
  let a = s[0] | 0, b = s[1] | 0, c = s[2] | 0, d = s[3] | 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  s[0] = a; s[1] = b; s[2] = c; s[3] = d;
  return t >>> 0;
}

/** Uniforme em [0, 1). */
export function uniforme(r) {
  return proximoU32(r) / 4294967296;
}

/** Uniforme em [a, b). */
export function entre(r, a, b) {
  return a + (b - a) * uniforme(r);
}

/** Normal padrão (Box–Muller; usa dois sorteios). */
export function normal(r) {
  let u = uniforme(r);
  if (u < 1e-12) u = 1e-12;
  const v = uniforme(r);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function copiarRng(r) {
  return { s: r.s.slice() };
}
