// A câmera de TV do jogo (item 66 da FILA; pedido do dono, 23/10: "a câmera não acompanha a bola e não dá pra ver a área
// completamente ... afastar muito pouco mais e centralizar mais"; contrato "Câmera de TV (item 66)" no CONTRATOS.md). Em
// Node, sem three: só os módulos puros (render/enquadramento.js).
//   G4) a projeção fechada da TV (projetarTV) contra uma projeção de referência em matriz 4×4 feita aqui (lookAt +
//       perspectiva), nas duas telas: ≤ 1e-6.
//   node tools/teste-camera.mjs [--js <pasta js>] [--so G]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PASTA_JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const SO = arg('--so', null);
const imp = f => import(pathToFileURL(path.join(PASTA_JS, f)).href);
const EQ = await imp('render/enquadramento.js');

const TELAS = [
  { nome: 'celular 844×390', chave: 'cel', w: 844, h: 390 },
  { nome: 'PC 1280×720', chave: 'pc', w: 1280, h: 720 },
];
for (const T of TELAS) { T.asp = T.w / T.h; T.pequena = Math.min(T.w, T.h) < 520; }

const linhas = [['medida', 'medido', 'meta', '']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '–');

// ------------------------------------------------------------------------------------------------ G4: a projeção
/** NDC de referência: lookAt (o da câmera do three: z = olho − alvo, x = cima × z, y = z × x) e perspectiva, em 4×4. */
function ndcReferencia(de, para, fov, asp, p) {
  let zx = de[0] - para[0], zy = de[1] - para[1], zz = de[2] - para[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx; // (0, 1, 0) × z
  l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  // a matriz de vista (a inversa da do mundo da câmera) e a de projeção (near 0,5, far 900, como a camera.js)
  const V = [
    [xx, xy, xz, -(xx * de[0] + xy * de[1] + xz * de[2])],
    [yx, yy, yz, -(yx * de[0] + yy * de[1] + yz * de[2])],
    [zx, zy, zz, -(zx * de[0] + zy * de[1] + zz * de[2])],
    [0, 0, 0, 1],
  ];
  const n = 0.5, fa = 900, f = 1 / Math.tan((fov * Math.PI) / 360);
  const P = [[f / asp, 0, 0, 0], [0, f, 0, 0], [0, 0, (fa + n) / (n - fa), (2 * fa * n) / (n - fa)], [0, 0, -1, 0]];
  const v = [p[0], p[1], p[2], 1];
  const mul = (M, a) => M.map(r => r[0] * a[0] + r[1] * a[1] + r[2] * a[2] + r[3] * a[3]);
  const c = mul(P, mul(V, v));
  return { x: c[0] / c[3], y: c[1] / c[3] };
}
if (!SO || SO === 'G') {
  for (const T of TELAS) {
    const p = EQ.perfilCamera({}, 0, T.asp, T.pequena), g = EQ.geometriaTV({}, p, T.asp, T.pequena), pose = {};
    let pior = 0, n = 0;
    const o = {};
    for (const fx of [-44.5, -20, 0, 30, 44.5]) for (const fz of [-22, -5, 0, 10, 23]) {
      EQ.poseTV(p, fx, fz, T.asp, T.pequena, pose);
      for (let x = -55; x <= 55; x += 11) for (const y of [0, 1.8, 2.44, 8]) for (let z = -36; z <= 36; z += 8) {
        const r = ndcReferencia(pose.de, pose.para, pose.fov, T.asp, [x, y, z]);
        EQ.projetarTV(g, fx, fz, x, y, z, o);
        if (!o.ok) continue;
        pior = Math.max(pior, Math.abs(r.x - o.x), Math.abs(r.y - o.y)); n++;
      }
    }
    reg(`G4 ${T.nome}: projetarTV × a projeção 4×4 (${n} pontos)`, pior.toExponential(1), '≤ 1e-6', pior <= 1e-6);
  }
}

const larg = [];
for (const l of linhas) l.forEach((c, i) => { larg[i] = Math.max(larg[i] ?? 0, String(c).length); });
console.log(linhas.map(l => l.map((c, i) => String(c).padEnd(larg[i])).join('  ')).join('\n'));
console.log(falhas ? `\nteste-camera: REPROVOU (${falhas})` : '\nteste-camera: PASSOU');
process.exit(falhas ? 1 : 0);
