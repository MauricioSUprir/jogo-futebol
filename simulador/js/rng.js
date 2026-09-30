// RNG com semente (mulberry32). Toda a aleatoriedade do motor passa por aqui,
// então a mesma semente + as mesmas ordens do usuário reproduzem a mesma partida.

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function createRng(seed) {
  let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** número em [a, b) */
    range: (lo, hi) => lo + (hi - lo) * next(),
    /** inteiro em [a, b] */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** normal aproximada (soma de 3 uniformes), média 0, desvio ~1 */
    gauss: () => (next() + next() + next() - 1.5) * 2,
    /** estado para salvar/retomar */
    get state() { return a; },
    set state(v) { a = v | 0; },
  };
}
