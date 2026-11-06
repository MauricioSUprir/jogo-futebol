// A régua da passada (item 61; tools/teste-marcha.mjs): ângulos de uma pose de 19 juntas (anim.js J) no referencial do
// rumo h do corpo — o braço (ombro → cotovelo) no plano da frente (> 0 = à frente), a dobra do cotovelo (0 = reto), a coxa
// (quadril → joelho, > 0 = à frente) e a rotação da linha dos quadris e da dos ombros em relação à direita do rumo
// ((−sen h, cos h); > 0 = o lado D para trás) — e as contas das séries (média/amplitude, correlação, R circular, percentil).
export const GRAU = 180 / Math.PI;
export function difAng(a, b) { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }

/** Medidor para o índice de juntas J (anim.js). instante(P, h) → {bracoE, bracoD, cotE, cotD, coxaE, coxaD, quadril, ombro, pelveY}. */
export function criarMedidor(J) {
  const g = (P, j, k) => P[j * 3 + k];
  function instante(P, h, o = {}) {
    const fx = Math.cos(h), fz = Math.sin(h);
    let ux = g(P, J.pescoco, 0) - g(P, J.pelve, 0), uy = g(P, J.pescoco, 1) - g(P, J.pelve, 1), uz = g(P, J.pescoco, 2) - g(P, J.pelve, 2);
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const braco = (iO, iC, iM, k) => {
      const bx = g(P, iC, 0) - g(P, iO, 0), by = g(P, iC, 1) - g(P, iO, 1), bz = g(P, iC, 2) - g(P, iO, 2);
      o[k ? 'bracoD' : 'bracoE'] = Math.atan2(bx * fx + bz * fz, -(bx * ux + by * uy + bz * uz)) * GRAU;
      const ax = g(P, iM, 0) - g(P, iC, 0), ay = g(P, iM, 1) - g(P, iC, 1), az = g(P, iM, 2) - g(P, iC, 2);
      const cos = (bx * ax + by * ay + bz * az) / ((Math.hypot(bx, by, bz) * Math.hypot(ax, ay, az)) || 1);
      o[k ? 'cotD' : 'cotE'] = Math.acos(Math.max(-1, Math.min(1, cos))) * GRAU;
    };
    braco(J.ombroE, J.cotoveloE, J.maoE, 0);
    braco(J.ombroD, J.cotoveloD, J.maoD, 1);
    const coxa = (iQ, iK) => {
      const bx = g(P, iK, 0) - g(P, iQ, 0), by = g(P, iK, 1) - g(P, iQ, 1), bz = g(P, iK, 2) - g(P, iQ, 2);
      return Math.atan2(bx * fx + bz * fz, -by) * GRAU;
    };
    o.coxaE = coxa(J.quadrilE, J.joelhoE); o.coxaD = coxa(J.quadrilD, J.joelhoD);
    const linha = (a, b) => difAng(h + Math.PI / 2, Math.atan2(g(P, b, 2) - g(P, a, 2), g(P, b, 0) - g(P, a, 0))) * GRAU;
    o.quadril = linha(J.quadrilE, J.quadrilD); o.ombro = linha(J.ombroE, J.ombroD);
    o.pelveY = g(P, J.pelve, 1);
    return o;
  }
  return { instante };
}

/** Média, mínimo, máximo, amplitude ((máx − mín)/2) e desvio de uma série. */
export function serie(xs) {
  const n = xs.length;
  if (!n) return { n: 0, med: NaN, min: NaN, max: NaN, amp: NaN, dp: NaN };
  let s = 0, mn = Infinity, mx = -Infinity;
  for (const x of xs) { s += x; if (x < mn) mn = x; if (x > mx) mx = x; }
  const med = s / n;
  let v = 0;
  for (const x of xs) v += (x - med) ** 2;
  return { n, med, min: mn, max: mx, amp: (mx - mn) / 2, dp: Math.sqrt(v / n) };
}
/** Amplitude robusta: (p95 − p5) / 2 (um pico de um quadro não manda). */
export function ampRobusta(xs) { return (pct(xs, 0.95) - pct(xs, 0.05)) / 2; }
export function correl(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / (Math.sqrt(saa * sbb) || 1);
}
/** R de Rayleigh (comprimento do vetor médio) de ângulos em rad: 1 = todos juntos; ~1/√N = espalhados. */
export function rCircular(angs) {
  if (!angs.length) return NaN;
  let c = 0, s = 0;
  for (const a of angs) { c += Math.cos(a); s += Math.sin(a); }
  return Math.hypot(c, s) / angs.length;
}
export function pct(xs, p) {
  if (!xs.length) return NaN;
  const a = Float64Array.from(xs).sort();
  return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))];
}
/** Diferença de fase da passada (mod 2) entre dois jogadores, em passos: 0 = no mesmo pé, 1 = com o pé trocado. */
export function difFase(a, b) { const d = (((a - b) % 2) + 2) % 2; return Math.min(d, 2 - d); }
