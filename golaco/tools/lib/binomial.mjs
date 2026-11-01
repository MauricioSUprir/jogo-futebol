// Contagens binomiais para as metas que reprovam quando a contagem PROVA (p < 5%, unilateral): a regra do projeto para as
// amostras pequenas (CLAUDE.md; item 70, P2). Exata pela soma dos termos em log (n até alguns milhares).

/** log Γ(x) (Lanczos, g = 7). */
export function lgam(x) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgam(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
const lbin = (n, k, p) => lgam(n + 1) - lgam(k + 1) - lgam(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p);
/** P(X ≤ x), X ~ Binomial(n, p). */
export function cdfBaixo(x, n, p) { let s = 0; for (let k = 0; k <= x; k++) s += Math.exp(lbin(n, k, p)); return s; }
/** P(X ≥ x), X ~ Binomial(n, p). */
export function cdfAlto(x, n, p) { let s = 0; for (let k = Math.max(0, x); k <= n; k++) s += Math.exp(lbin(n, k, p)); return s; }
/** A contagem x de n PROVA (p < `alfa`, unilateral) que a taxa está abaixo de lo ou acima de hi? (lo/hi null: sem esse lado) */
export function provaFora(x, n, lo, hi, alfa = 0.05) {
  return (lo != null && lo > 0 && cdfBaixo(x, n, lo) < alfa) || (hi != null && hi < 1 && cdfAlto(x, n, hi) < alfa);
}
