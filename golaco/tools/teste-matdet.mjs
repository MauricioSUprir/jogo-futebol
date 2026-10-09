// Matemática determinística (js/matdet.js): precisão contra o Math nativo (erro em ulps) e
// tempo. Reprova se algum erro passar do limite.
//   node tools/teste-matdet.mjs
import { MD } from '../js/matdet.js';

const dv = new DataView(new ArrayBuffer(8));
/** distância em ulps entre dois doubles finitos */
function ulps(a, b) {
  if (a === b) return 0;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  const ord = v => { dv.setFloat64(0, v); const hi = dv.getInt32(0), lo = dv.getUint32(4); const n = hi * 4294967296 + lo; return hi < 0 ? -(n & 0x7fffffffffffffff) - 0 : n; };
  // para valores de sinais iguais, diferença relativa / épsilon é uma boa medida
  const e = Math.abs(a - b) / Math.max(Math.abs(b), 2.2250738585072014e-308);
  void ord;
  return e / Number.EPSILON;
}

function gerar(n, a, b, semente) {
  let s = semente >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: n }, () => a + (b - a) * r());
}

const N = 200000;
const casos = [
  { nome: 'sin', f: MD.sin, ref: Math.sin, xs: gerar(N, -50, 50, 1), lim: 2, abs: true },
  { nome: 'cos', f: MD.cos, ref: Math.cos, xs: gerar(N, -50, 50, 2), lim: 2, abs: true },
  { nome: 'atan', f: MD.atan, ref: Math.atan, xs: gerar(N, -20, 20, 3), lim: 2 },
  { nome: 'atan2', f2: MD.atan2, ref2: Math.atan2, xs: gerar(N, -10, 10, 4), ys: gerar(N, -10, 10, 5), lim: 2 },
  { nome: 'asin', f: MD.asin, ref: Math.asin, xs: gerar(N, -0.999, 0.999, 6), lim: 4 },
  { nome: 'acos', f: MD.acos, ref: Math.acos, xs: gerar(N, -0.999, 0.999, 7), lim: 4 },
  { nome: 'exp', f: MD.exp, ref: Math.exp, xs: gerar(N, -40, 40, 8), lim: 2 },
  { nome: 'log', f: MD.log, ref: Math.log, xs: gerar(N, 1e-9, 1e4, 9), lim: 2 },
  { nome: 'pow (x^1,35)', f: x => MD.pow(x, 1.35), ref: x => Math.pow(x, 1.35), xs: gerar(N, 0.001, 40, 10), lim: 8 },
  { nome: 'pow (x^0,73)', f: x => MD.pow(x, 0.73), ref: x => Math.pow(x, 0.73), xs: gerar(N, 0.001, 40, 11), lim: 8 },
  { nome: 'hypot', f2: MD.hypot, ref2: Math.hypot, xs: gerar(N, -100, 100, 12), ys: gerar(N, -100, 100, 13), lim: 2 },
];

let falhas = 0;
console.log('função          erro máx (ulp)   médio (ulp)   limite   tempo det/nativo');
for (const c of casos) {
  let max = 0, soma = 0, pior = null;
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < N; i++) acc += c.f ? c.f(c.xs[i]) : c.f2(c.ys[i], c.xs[i]);
  const tDet = performance.now() - t0;
  const t1 = performance.now();
  for (let i = 0; i < N; i++) acc += c.ref ? c.ref(c.xs[i]) : c.ref2(c.ys[i], c.xs[i]);
  const tNat = performance.now() - t1;
  for (let i = 0; i < N; i++) {
    const a = c.f ? c.f(c.xs[i]) : c.f2(c.ys[i], c.xs[i]);
    const b = c.ref ? c.ref(c.xs[i]) : c.ref2(c.ys[i], c.xs[i]);
    // seno/cosseno perto de zero: erro absoluto em ulps de 1 (o resultado é pequeno)
    const e = c.abs ? Math.abs(a - b) / Number.EPSILON : ulps(a, b);
    soma += e;
    if (e > max) { max = e; pior = c.f ? [c.xs[i], a, b] : [c.ys[i], c.xs[i], a, b]; }
  }
  const ok = max <= c.lim;
  if (!ok) falhas++;
  console.log(`${c.nome.padEnd(15)} ${max.toFixed(2).padStart(10)}   ${(soma / N).toFixed(3).padStart(11)}   ${String(c.lim).padStart(6)}   ${(tDet / Math.max(tNat, 0.01)).toFixed(1).padStart(6)}×  ${ok ? 'PASSOU' : 'REPROVOU ' + JSON.stringify(pior)}${acc === 0.123 ? '' : ''}`);
}
// casos especiais
const esp = [
  ['atan2(0, 0)', MD.atan2(0, 0), Math.atan2(0, 0)], ['atan2(0, -1)', MD.atan2(0, -1), Math.atan2(0, -1)],
  ['atan2(1, 0)', MD.atan2(1, 0), Math.atan2(1, 0)], ['atan2(-1, 0)', MD.atan2(-1, 0), Math.atan2(-1, 0)],
  ['atan2(-0, 1)', MD.atan2(-0, 1), Math.atan2(-0, 1)], ['sin(0)', MD.sin(0), 0], ['cos(0)', MD.cos(0), 1],
  ['exp(0)', MD.exp(0), 1], ['log(1)', MD.log(1), 0], ['pow(0, 1.35)', MD.pow(0, 1.35), 0], ['sin(π)', MD.sin(Math.PI), Math.sin(Math.PI)],
];
for (const [n, a, b] of esp) {
  const ok = Object.is(a, b) || Math.abs(a - b) < 1e-15;
  if (!ok) falhas++;
  console.log(`${n.padEnd(15)} ${String(a).padStart(22)}  nativo ${b}  ${ok ? 'PASSOU' : 'REPROVOU'}`);
}
console.log(falhas ? `\nteste-matdet: REPROVOU (${falhas})` : '\nteste-matdet: PASSOU');
process.exit(falhas ? 1 : 0);
