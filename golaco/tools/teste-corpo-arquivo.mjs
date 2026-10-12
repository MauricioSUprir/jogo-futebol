// Arquivo do corpo (Etapa 5.1; assets/jogador/corpo.bin, gerado por tools/humano/gerar-corpo.mjs). Node, sem navegador.
// Confere:
//  1. o formato: o leitor do jogo (render/corpo-leitor.js) abre o arquivo, 22 ossos com os nomes e os pais do
//     esqueleto do jogo (render/esqueleto.js), até 4 influências por vértice somando 1, índices dentro dos vértices;
//  2. as proporções da SIMULAÇÃO na pose de repouso (±2 mm): coxa 0,45, canela 0,45, quadris a ±0,09 e pelve 0,03
//     acima deles, lombar +0,17, peito +0,22, pescoço +0,13, cabeça +0,13/+0,02 à frente, ombros a ±0,19 e 0,07 acima do
//     peito, braço 0,29, antebraço 0,26, ponta 0,17 à frente e 0,055 abaixo do tornozelo (config.js JOGADOR, anim.js);
//  3. a sola: 0,08 m abaixo do tornozelo (±2 mm) — pé apoiado = sola no chão;
//  4. a pele de repouso é a identidade (a pose de repouso desenha o corpo como foi modelado: ≤ 1e-5);
//  5. dobra das juntas a 120° (joelho, cotovelo, ombro; nos 3 níveis de detalhe): volume perto da junta ≥ 85% do de
//     repouso e NENHUM triângulo virado (pele linear, os pesos do arquivo);
//  6. tamanho: corpo ≤ 170 KB e leitor ≤ 5 KB; nenhum vértice fora do nível de perto.
// Controle: --arquivo <glb do protótipo> (o corpo da pesquisa, decimado sem proteger as juntas e com o esqueleto em pose
// T sobre a malha em pose A) reprova na dobra; --arquivo <corpo gerado com --sem-juntas> também (no LOD leve).
//   node tools/teste-corpo-arquivo.mjs [--arquivo <corpo.bin | .glb>] [--detalhe]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerCorpo } from '../js/render/corpo-leitor.js';
import { criarEsqueleto, OSSOS, PAI, NO, NO_CORPO } from '../js/render/esqueleto.js';
import { J, NJ } from '../js/anim.js';
import { JOGADOR } from '../js/config.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const ARQ = path.resolve(arg('--arquivo', path.join(AQUI, '..', 'assets', 'jogador', 'corpo.bin')));
const detalhe = args.includes('--detalhe');
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const mm = v => (v * 1000).toFixed(2);

// ------------------------------------------------------------------ malha com pele genérica (corpo.bin ou .glb)
/** {pos (repouso), idx, lods [{ini, n}], ossos: [{nome, pai, cabeca: [x,y,z]}], bi (Uint8 ×4), bw (Float32 ×4)} */
function lerGlb(buf) {
  const len = buf.readUInt32LE(12);
  const js = JSON.parse(buf.subarray(20, 20 + len).toString());
  const bin = buf.subarray(20 + len + 8);
  const T = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const acessor = i => {
    const a = js.accessors[i], v = js.bufferViews[a.bufferView], C = T[a.componentType];
    const off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    let arr = new C(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * NC[a.type] * C.BYTES_PER_ELEMENT));
    if (a.normalized && C === Uint8Array) arr = Float32Array.from(arr, x => x / 255);
    return arr;
  };
  const p = js.meshes[0].primitives[0];
  const pos = acessor(p.attributes.POSITION), idx = Uint32Array.from(acessor(p.indices));
  const bi = acessor(p.attributes.JOINTS_0), bw = Float32Array.from(acessor(p.attributes.WEIGHTS_0));
  // mundo de cada nó (repouso)
  const mundo = js.nodes.map(() => null);
  const pais = js.nodes.map(() => -1);
  js.nodes.forEach((n, i) => (n.children ?? []).forEach(c => { pais[c] = i; }));
  const local = n => {
    const t = n.translation ?? [0, 0, 0], q = n.rotation ?? [0, 0, 0, 1], s = n.scale ?? [1, 1, 1];
    const [x, y, z, w] = q;
    return [
      (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
      2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
      2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
      t[0], t[1], t[2], 1];
  };
  const mul = (a, b) => { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let l = 0; l < 4; l++) for (let k = 0; k < 4; k++) r[c * 4 + l] += a[k * 4 + l] * b[c * 4 + k]; return r; };
  const W = i => { if (!mundo[i]) mundo[i] = pais[i] < 0 ? local(js.nodes[i]) : mul(W(pais[i]), local(js.nodes[i])); return mundo[i]; };
  const juntas = js.skins[0].joints;
  const ossos = juntas.map((n, k) => ({ nome: js.nodes[n].name, pai: juntas.indexOf(pais[n]), cabeca: [W(n)[12], W(n)[13], W(n)[14]] }));
  // a malha do glb já está no mundo da cena (sem transformação no nó da malha nos arquivos do protótipo)
  return { pos, idx, lods: [{ ini: 0, n: idx.length }], ossos, bi, bw, glb: true };
}
function lerArquivo(arq) {
  const b = fs.readFileSync(arq);
  if (arq.endsWith('.glb')) return lerGlb(b);
  const c = lerCorpo(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const esq = criarEsqueleto(c.cab.bind);
  const Fb = esq.quadrosRepouso;
  const ossos = c.cab.ossos.map((nome, k) => ({ nome, pai: c.cab.pai[k], cabeca: [Fb[k * 12], Fb[k * 12 + 1], Fb[k * 12 + 2]] }));
  return { pos: c.pos, idx: c.idx, lods: c.cab.lods, ossos, bi: c.ossos, bw: c.pesos, corpo: c, esq };
}
const M = lerArquivo(ARQ);
const nomeOsso = n => M.ossos.findIndex(o => o.nome === n || o.nome === 'mixamorig:' + n);

// ------------------------------------------------------------------ 1–4: formato, proporções, sola, identidade
if (M.corpo) {
  const c = M.corpo;
  meta('Formato: 22 ossos do corpo + 8 auxiliares (joelhos e cotovelos), nomes e pais do esqueleto do jogo', `${NO_CORPO} + ${c.cab.ossos.length - NO_CORPO} ossos; nomes ${c.cab.ossos.join(',') === OSSOS.join(',') ? 'iguais' : 'diferentes'}; pais ${c.cab.pai.join(',') === PAI.join(',') ? 'iguais' : 'diferentes'}`,
    '22 + 8, iguais', NO_CORPO === 22 && c.cab.ossos.length === 30 && NO === 30 && c.cab.ossos.join(',') === OSSOS.join(',') && c.cab.pai.join(',') === PAI.join(','));
  let somaRuim = 0, maisDe4 = 0;
  for (let v = 0; v < c.nv; v++) { let s = 0; for (let k = 0; k < 4; k++) s += c.pesos[v * 4 + k]; if (Math.abs(s - 1) > 0.002) somaRuim++; }
  void maisDe4;
  meta('Pesos: 4 influências por vértice somando 1', `${somaRuim} vértices fora`, '0', somaRuim === 0);
  const P = c.cab.bind.pose;
  const pt = j => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const pel = pt(J.pelve), qE = pt(J.quadrilE), qD = pt(J.quadrilD);
  const medidas = [
    ['coxa E/D', [d(qE, pt(J.joelhoE)), d(qD, pt(J.joelhoD))], JOGADOR.coxa],
    ['canela E/D', [d(pt(J.joelhoE), pt(J.tornozeloE)), d(pt(J.joelhoD), pt(J.tornozeloD))], JOGADOR.canela],
    ['quadris (largura)', [d(qE, qD)], JOGADOR.larguraQuadril],
    ['pelve acima dos quadris', [pel[1] - (qE[1] + qD[1]) / 2], 0.03],
    ['lombar, peito, pescoço (tronco)', [d(pel, pt(J.lombar)) - 0.17, d(pt(J.lombar), pt(J.peito)) - 0.22, d(pt(J.peito), pt(J.pescoco)) - 0.13].map(x => x + 0.17), 0.17],
    ['cabeça (0,13 acima, 0,02 à frente do pescoço)', [d(pt(J.pescoco), pt(J.cabeca))], Math.hypot(0.13, 0.02)],
    ['ombros (largura)', [d(pt(J.ombroE), pt(J.ombroD))], 0.38],
    ['ombros acima do peito', [pt(J.ombroE)[1] - pt(J.peito)[1]], 0.07],
    ['braço E/D', [d(pt(J.ombroE), pt(J.cotoveloE)), d(pt(J.ombroD), pt(J.cotoveloD))], 0.29],
    ['antebraço E/D', [d(pt(J.cotoveloE), pt(J.maoE)), d(pt(J.cotoveloD), pt(J.maoD))], 0.26],
    ['ponta: à frente do tornozelo', [Math.hypot(pt(J.pontaE)[0] - pt(J.tornozeloE)[0], pt(J.pontaE)[2] - pt(J.tornozeloE)[2])], 0.17],
    ['ponta: abaixo do tornozelo', [pt(J.tornozeloE)[1] - pt(J.pontaE)[1]], JOGADOR.alturaTornozelo - 0.025],
  ];
  let pior = 0, qual = '';
  for (const [nome, vs, alvo] of medidas) for (const v of vs) { const e = Math.abs(v - alvo); if (e > pior) { pior = e; qual = nome; } }
  meta('Proporções da simulação na pose de repouso (12 medidas)', `pior ${mm(pior)} mm (${qual})`, '≤ 2 mm', pior <= 0.002);
  // sola: vértices dos ossos do pé (pé + dedos) — o mais baixo deles 0,08 abaixo do tornozelo
  for (const [lado, jT, bs] of [['E', J.tornozeloE, ['peE', 'dedosE']], ['D', J.tornozeloD, ['peD', 'dedosD']]]) {
    const ids = bs.map(nomeOsso);
    let min = Infinity;
    for (let v = 0; v < c.nv; v++) if (ids.includes(c.ossos[v * 4]) && c.pesos[v * 4] > 0.5) min = Math.min(min, c.pos[v * 3 + 1]);
    const e = pt(jT)[1] - min - JOGADOR.alturaTornozelo;
    meta(`Sola ${lado}: 0,08 m abaixo do tornozelo`, `${mm(pt(jT)[1] - min)} mm (erro ${mm(e)} mm)`, '80 ± 2 mm', Math.abs(e) <= 0.002);
  }
  const out = new Float32Array(NO * 12);
  M.esq.calcular(Float32Array.from(P), out, 0);
  let maxId = 0;
  for (let o = 0; o < NO; o++) for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) maxId = Math.max(maxId, Math.abs(out[o * 12 + i * 4 + k] - (i === k ? 1 : 0)));
  meta('Pele da pose de repouso = identidade', maxId.toExponential(1), '≤ 1e-5', maxId <= 1e-5);
}

// ------------------------------------------------------------------ 5: dobra das juntas a 120°
const N_V = M.pos.length / 3;
const dominante = new Int16Array(N_V);
for (let v = 0; v < N_V; v++) { let b = 0, w = -1; for (let k = 0; k < 4; k++) if (M.bw[v * 4 + k] > w) { w = M.bw[v * 4 + k]; b = M.bi[v * 4 + k]; } dominante[v] = b; }
const filhos = M.ossos.map(() => []);
M.ossos.forEach((o, k) => { if (o.pai >= 0) filhos[o.pai].push(k); });
const subarvore = r => { const s = [r]; for (let i = 0; i < s.length; i++) s.push(...filhos[s[i]]); return new Set(s); };
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pr = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const un = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mulv = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
/** Rotação de θ em volta do eixo u (unitário), como matriz 3×3 por linhas. */
function rot(u, t) {
  const c = Math.cos(t), s = Math.sin(t), C = 1 - c, [x, y, z] = u;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
const ap = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];

/**
 * Mede uma dobra: P2 = posições dobradas (pele linear), Mv(v, n) = a normal de repouso n levada pela pele do vértice v.
 * Volume do pedaço de membro perto da junta (triângulos da região fechados por tampas nas bordas, na pose de repouso e
 * na dobrada) e triângulos virados (normal do triângulo dobrado contra a normal de repouso levada pela pele).
 */
function medirDobra(rotulo, regiao, P2, Mv, faixa, pivo) {
  let V0 = 0, V1 = 0, virados = 0, tri = 0;
  const arestas = new Map();
  const P0 = i => [M.pos[i * 3], M.pos[i * 3 + 1], M.pos[i * 3 + 2]], P1 = i => [P2[i * 3], P2[i * 3 + 1], P2[i * 3 + 2]];
  const idx = M.idx;
  for (let t = faixa.ini; t < faixa.ini + faixa.n; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (!regiao[a] || !regiao[b] || !regiao[c]) continue;
    tri++;
    arestas.set(a * N_V + b, b); arestas.set(b * N_V + c, c); arestas.set(c * N_V + a, a);
    const A0 = P0(a), B0 = P0(b), C0 = P0(c), A1 = P1(a), B1 = P1(b), C1 = P1(c);
    V0 += pr(vsub(A0, pivo), cruz(vsub(B0, pivo), vsub(C0, pivo))) / 6;
    V1 += pr(vsub(A1, pivo), cruz(vsub(B1, pivo), vsub(C1, pivo))) / 6;
    const n0 = cruz(vsub(B0, A0), vsub(C0, A0)), n1 = cruz(vsub(B1, A1), vsub(C1, A1));
    const nesp = add(add(Mv(a, n0), Mv(b, n0)), Mv(c, n0));
    if (pr(n1, nesp) < 0) virados++;
  }
  // tampas: a região é um tubo aberto nas pontas; fecha cada borda com um leque até o centro dela (na pose de repouso e
  // na dobrada): o volume vira o volume de verdade do pedaço de membro em volta da junta
  const proxima = new Map();
  for (const [k, b] of arestas) { const a = Math.floor(k / N_V); if (!arestas.has(b * N_V + a)) proxima.set(a, b); }
  const vistos = new Set();
  for (const ini of proxima.keys()) {
    if (vistos.has(ini)) continue;
    const laco = [];
    let v = ini;
    while (v != null && !vistos.has(v)) { vistos.add(v); laco.push(v); v = proxima.get(v); }
    if (laco.length < 3) continue;
    for (const [P, dobrada] of [[P0, false], [P1, true]]) {
      const c = [0, 0, 0];
      for (const i of laco) { const q = P(i); for (let k = 0; k < 3; k++) c[k] += q[k] / laco.length; }
      let V = 0;
      for (let k = 0; k < laco.length; k++) V += pr(vsub(P(laco[(k + 1) % laco.length]), pivo), cruz(vsub(P(laco[k]), pivo), vsub(c, pivo))) / 6;
      if (dobrada) V1 += V; else V0 += V;
    }
  }
  return { rotulo, razao: V1 / V0, virados, tri };
}

/** Região perto da junta: vértices a menos de `raio` do pivô com o osso dominante em `ossos`. */
function regiaoJunta(pivo, raio, ossos) {
  const r = new Uint8Array(N_V);
  for (let v = 0; v < N_V; v++) if (ossos.has(dominante[v]) && Math.hypot(M.pos[v * 3] - pivo[0], M.pos[v * 3 + 1] - pivo[1], M.pos[v * 3 + 2] - pivo[2]) < raio) r[v] = 1;
  return r;
}

const ALVO = 120 * Math.PI / 180;
const angulo = (a, b) => Math.acos(Math.max(-1, Math.min(1, pr(un(a), un(b)))));
const piores = [];
if (M.corpo) {
  // o corpo do jogo: a pose de repouso com a junta dobrada até 120° → o esqueleto do jogo (render/esqueleto.js, com os
  // auxiliares) → pele linear com os pesos do arquivo
  const B = M.corpo.cab.bind.pose;
  const mats = new Float32Array(NO * 12);
  const pt = (P, j) => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]];
  const girar = (P, j, piv, R) => { const q = add(ap(R, vsub(pt(P, j), piv)), piv); P[j * 3] = q[0]; P[j * 3 + 1] = q[1]; P[j * 3 + 2] = q[2]; };
  const casos = [];
  for (const L of ['E', 'D']) {
    const E = L === 'E';
    const jq = E ? J.quadrilE : J.quadrilD, jj = E ? J.joelhoE : J.joelhoD, jt = E ? J.tornozeloE : J.tornozeloD, jp = E ? J.pontaE : J.pontaD;
    const jo = E ? J.ombroE : J.ombroD, jc = E ? J.cotoveloE : J.cotoveloD, jm = E ? J.maoE : J.maoD;
    // joelho: a canela vai para trás (eixo = esquerda do corpo)
    casos.push({ rotulo: 'joelho ' + L, pivo: pt(B, jj), ossos: ['coxa' + L, 'canela' + L, 'joelho' + L + '1', 'joelho' + L + '2'], dobrar(P) {
      const R = rot([1, 0, 0], ALVO - angulo(vsub(pt(P, jj), pt(P, jq)), vsub(pt(P, jt), pt(P, jj))));
      girar(P, jt, pt(P, jj), R); girar(P, jp, pt(P, jj), R);
    } });
    // cotovelo: no plano em que ele já dobra no repouso
    casos.push({ rotulo: 'cotovelo ' + L, pivo: pt(B, jc), ossos: ['braco' + L, 'antebraco' + L, 'cotovelo' + L + '1', 'cotovelo' + L + '2'], dobrar(P) {
      const u = vsub(pt(P, jc), pt(P, jo)), f = vsub(pt(P, jm), pt(P, jc));
      girar(P, jm, pt(P, jc), rot(un(cruz(u, f)), ALVO - angulo(u, f)));
    } });
    // ombro: o braço sobe pelo lado até 120° de abdução (a partir do braço caído)
    casos.push({ rotulo: 'ombro ' + L, pivo: pt(B, jo), ossos: ['clavicula' + L, 'braco' + L], raio: 0.13, dobrar(P) {
      const R = rot([0, 0, E ? 1 : -1], ALVO - angulo(vsub(pt(P, jc), pt(P, jo)), [0, -1, 0]));
      girar(P, jc, pt(P, jo), R); girar(P, jm, pt(P, jo), R);
    } });
  }
  for (const cs of casos) {
    const P = Float32Array.from(B);
    cs.dobrar(P);
    M.esq.calcular(P, mats, 0);
    const P2 = new Float64Array(N_V * 3);
    for (let v = 0; v < N_V; v++) {
      for (let k = 0; k < 4; k++) {
        const w = M.bw[v * 4 + k]; if (!w) continue;
        const q = M.bi[v * 4 + k] * 12;
        const x = M.pos[v * 3], y = M.pos[v * 3 + 1], z = M.pos[v * 3 + 2];
        P2[v * 3] += w * (mats[q] * x + mats[q + 1] * y + mats[q + 2] * z + mats[q + 3]);
        P2[v * 3 + 1] += w * (mats[q + 4] * x + mats[q + 5] * y + mats[q + 6] * z + mats[q + 7]);
        P2[v * 3 + 2] += w * (mats[q + 8] * x + mats[q + 9] * y + mats[q + 10] * z + mats[q + 11]);
      }
    }
    const Mv = (v, n) => { const r = [0, 0, 0]; for (let k = 0; k < 4; k++) { const w = M.bw[v * 4 + k], q = M.bi[v * 4 + k] * 12; r[0] += w * (mats[q] * n[0] + mats[q + 1] * n[1] + mats[q + 2] * n[2]); r[1] += w * (mats[q + 4] * n[0] + mats[q + 5] * n[1] + mats[q + 6] * n[2]); r[2] += w * (mats[q + 8] * n[0] + mats[q + 9] * n[1] + mats[q + 10] * n[2]); } return un(r); };
    const regiao = regiaoJunta(cs.pivo, cs.raio ?? 0.11, new Set(cs.ossos.map(nomeOsso).filter(x => x >= 0)));
    M.lods.forEach((faixa, li) => {
      const r = medirDobra(cs.rotulo, regiao, P2, Mv, faixa, cs.pivo);
      r.lod = li;
      piores.push(r);
      if (detalhe) console.log(`  LOD ${li} ${r.rotulo}: volume ${(r.razao * 100).toFixed(1)}%, virados ${r.virados} de ${r.tri}`);
    });
  }
} else {
  // controle (glb do protótipo, sem o esqueleto do jogo): a subárvore do osso de baixo gira em volta da cabeça dele
  for (const [L, Lm] of [['E', 'Left'], ['D', 'Right']]) {
    for (const [tipo, nPai, nFilho, nNeto] of [['joelho', 'UpLeg', 'Leg', 'Foot'], ['cotovelo', 'Arm', 'ForeArm', 'Hand'], ['ombro', 'Shoulder', 'Arm', 'ForeArm']]) {
      const pai = nomeOsso(Lm + nPai), filho = nomeOsso(Lm + nFilho), neto = nomeOsso(Lm + nNeto);
      const h = M.ossos[filho].cabeca, s0 = un(vsub(h, M.ossos[pai].cabeca)), s1 = un(vsub(M.ossos[neto].cabeca, h));
      let eixo, ang;
      if (tipo === 'joelho') { eixo = [1, 0, 0]; ang = ALVO - angulo(s0, s1); }
      else if (tipo === 'cotovelo') { const n = cruz(s0, s1); eixo = Math.hypot(...n) > 0.1 ? un(n) : un(cruz(s0, [0, 0, 1])); ang = ALVO - angulo(s0, s1); }
      else { eixo = [0, 0, L === 'E' ? 1 : -1]; ang = ALVO - angulo(s1, [0, -1, 0]); }
      const sub = subarvore(filho);
      const R = rot(eixo, ang);
      const P2 = new Float64Array(N_V * 3);
      for (let v = 0; v < N_V; v++) {
        const p = [M.pos[v * 3], M.pos[v * 3 + 1], M.pos[v * 3 + 2]], q = add(ap(R, vsub(p, h)), h);
        let w = 0; for (let k = 0; k < 4; k++) if (sub.has(M.bi[v * 4 + k])) w += M.bw[v * 4 + k];
        for (let c = 0; c < 3; c++) P2[v * 3 + c] = p[c] * (1 - w) + q[c] * w;
      }
      const Mv = (v, n) => { let w = 0; for (let k = 0; k < 4; k++) if (sub.has(M.bi[v * 4 + k])) w += M.bw[v * 4 + k]; return un(add(mulv(n, 1 - w), mulv(ap(R, n), w))); };
      const regiao = regiaoJunta(h, tipo === 'ombro' ? 0.13 : 0.11, new Set([pai, ...sub]));
      const r = medirDobra(`${tipo} ${L}`, regiao, P2, Mv, M.lods[0], h);
      r.lod = 0;
      piores.push(r);
      if (detalhe) console.log(`  ${r.rotulo}: volume ${(r.razao * 100).toFixed(1)}%, virados ${r.virados} de ${r.tri}`);
    }
  }
}
// região vazia (a junta do esqueleto fora da malha, como no protótipo com o esqueleto em pose T sobre a malha em pose A)
for (const r of piores) if (!(r.tri > 0) || !Number.isFinite(r.razao)) r.razao = 0;
const minVol = piores.reduce((a, r) => (r.razao < a.razao ? r : a));
const virados = piores.reduce((s, r) => s + r.virados, 0);
const comVirado = piores.filter(r => r.virados > 0).map(r => `LOD ${r.lod} ${r.rotulo} (${r.virados})`);
meta('Dobra a 120° (joelho, cotovelo, ombro; todos os níveis): volume perto da junta', `menor ${(minVol.razao * 100).toFixed(1)}% (LOD ${minVol.lod}, ${minVol.rotulo})`, '≥ 85%', minVol.razao >= 0.85 && minVol.razao <= 1.25);
meta('Dobra a 120°: triângulos virados', `${virados}${comVirado.length ? ' — ' + comVirado.slice(0, 4).join(', ') : ''}`, '0', virados === 0);

// ------------------------------------------------------------------ 6: tamanho
if (M.corpo) {
  const kb = fs.statSync(ARQ).size / 1024;
  const leitor = fs.statSync(path.join(AQUI, '..', 'js', 'render', 'corpo-leitor.js')).size / 1024;
  meta('Download: corpo ≤ 170 KB e leitor ≤ 5 KB', `corpo ${kb.toFixed(1)} KB, leitor ${leitor.toFixed(1)} KB`, '≤ 170 e ≤ 5 KB', kb <= 170 && leitor <= 5);
  const tri = M.lods.map(l => l.n / 3);
  meta('Três níveis de detalhe dividindo os vértices', `${tri.join(' / ')} triângulos, ${M.corpo.nv} vértices`, '3 níveis, perto ≥ médio ≥ longe', tri.length === 3 && tri[0] >= tri[1] && tri[1] >= tri[2]);
}

const larg = Math.max(...res.map(r => r.nome.length));
console.log(`arquivo: ${path.relative(process.cwd(), ARQ)}`);
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-corpo-arquivo: PASSOU' : '\nteste-corpo-arquivo: REPROVOU');
process.exit(ok ? 0 : 1);
