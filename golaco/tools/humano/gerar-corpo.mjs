// Gera o corpo humano do jogo (Etapa 5.1): assets/jogador/corpo.bin. Ferramenta OFFLINE (não roda no CI; a saída
// entra no repositório e o teste-corpo-arquivo confere o que importa).
//
// Fontes (todas CC0 1.0 — MakeHuman/MPFB2, seção C de LICENSE.md: "The base mesh, targets, rigs, ... have been
// released under CC0"): a malha base hm08 (3dobjs/base.obj), os alvos macro do homem jovem por etnia
// (targets/macrodetails/*-male-young.target.gz), o esqueleto "mixamo" do MPFB2 (rigs/standard/rig.mixamo.json, só as
// regras de onde fica cada junta) e os pesos dele (weights.mixamo.json, "license": "CC0"). NENHUMA linha do código do
// MPFB2 (GPLv3): só os DADOS, lidos por este script. Nada do Mixamo da Adobe: só o nome do esqueleto é o mesmo.
//
// O que faz:
//  1) corpo masculino adulto = malha base + média dos alvos "homem jovem" das 3 etnias (1/3 cada);
//  2) juntas do modelo pelas regras do rig (média de vértices ou do cubo da junta);
//  3) pose de repouso do JOGO: a pose A do modelo com as proporções da simulação (config.js JOGADOR e anim.js:
//     quadris a ±0,09 m e 0,98 m de altura, pelve 0,03 m acima, lombar +0,17, peito +0,39, pescoço +0,52, cabeça
//     +0,13 (+0,02 à frente), ombros a ±0,19 e 0,07 acima do peito, braço 0,29 + 0,26, coxa 0,45, canela 0,45,
//     tornozelo a 0,08 m do chão, ponta 0,17 à frente e 0,055 abaixo do tornozelo);
//  4) "refit": cada osso do modelo vai para o osso do jogo (translação + escala só ao longo do osso, sem girar),
//     misturado pelos pesos (pele linear) — o corpo fica com as proporções da simulação sem mexer na espessura;
//     o pé ganha escala vertical para a sola ficar a 0,08 m abaixo do tornozelo (sola no chão no apoio);
//  5) 52 ossos do mixamo → 22 do jogo (dedos → mão), até 4 influências por vértice;
//  6) 3 níveis de detalhe que DIVIDEM os vértices (meshoptimizer simplify, MIT): perto, médio e longe;
//  7) quantiza (posição int16, normal int8, ossos e pesos uint8) e grava o formato próprio (render/corpo-leitor.js).
//
//   node golaco/tools/humano/gerar-corpo.mjs [--baixar] [--dados <pasta>] [--meshopt <pasta do pacote meshoptimizer>]
//        [--saida golaco/assets/jogador/corpo.bin] [--lods 8000,2000,1000] [--sem-juntas] [--glb <arquivo>]
//   --baixar: baixa os dados do MPFB2 (commit fixo, sha256 conferido) para a pasta de dados.
//   meshoptimizer: npm i --prefix golaco/tools/humano meshoptimizer@0.22.0 (fica em node_modules/, fora do git).
//   --sem-juntas: decima sem proteger as juntas (só para mostrar o defeito que o teste-corpo-arquivo pega).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DADOS = path.resolve(arg('--dados', path.join(AQUI, '.dados')));
const MESHOPT = path.resolve(arg('--meshopt', path.join(AQUI, 'node_modules', 'meshoptimizer')));
const SAIDA = path.resolve(arg('--saida', path.join(RAIZ, 'assets', 'jogador', 'corpo.bin')));
const LODS = arg('--lods', '8000,2000,1000').split(',').map(Number);
const SEM_JUNTAS = args.includes('--sem-juntas');

// ---------------------------------------------------------------- dados (MPFB2, commit fixo)
const COMMIT = 'd0a32e57a7f915cb2f2b95410e2117648c7bbb7e';
const BASE_URL = `https://raw.githubusercontent.com/makehumancommunity/mpfb2/${COMMIT}/src/mpfb/data/`;
const ARQUIVOS = {
  'base.obj': ['3dobjs/base.obj', '8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c'],
  'rig.mixamo.json': ['rigs/standard/rig.mixamo.json', 'b4e491bacdcae797e53b7692169cf6a160c50fcc1eda5f0982e92fac1561ae56'],
  'weights.mixamo.json': ['rigs/standard/weights.mixamo.json', '4561be4d7c0093d70e3dba4fbacbbbb6d66781573779fb12a0509cefa181b8ae'],
  'african-male-young.target.gz': ['targets/macrodetails/african-male-young.target.gz', '05ed84d6df36e788cdfa8da0be15376850524b960cf2f17f3e592b9cf7d21c85'],
  'asian-male-young.target.gz': ['targets/macrodetails/asian-male-young.target.gz', '0928ed8b9f08f60afb9884cf9e9f33a939ed3a85d7f136de9ccc88a76981d6d7'],
  'caucasian-male-young.target.gz': ['targets/macrodetails/caucasian-male-young.target.gz', 'ffe69537e53148edff2776204ba48cf3bf1f3cbc72966592c8a562ab80b07333'],
};
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
if (args.includes('--baixar')) {
  fs.mkdirSync(DADOS, { recursive: true });
  for (const [nome, [rel]] of Object.entries(ARQUIVOS)) {
    const dest = path.join(DADOS, nome);
    if (!fs.existsSync(dest)) execFileSync('curl', ['-sSfL', '--retry', '3', '-o', dest, BASE_URL + rel], { stdio: 'inherit' });
  }
}
for (const [nome, [, h]] of Object.entries(ARQUIVOS)) {
  const f = path.join(DADOS, nome);
  if (!fs.existsSync(f)) { console.error(`falta ${f} (rode com --baixar)`); process.exit(1); }
  const s = sha(f);
  if (s !== h) { console.error(`sha256 diferente em ${nome}: ${s}`); process.exit(1); }
}

const { MeshoptSimplifier } = await import(pathToFileURL(path.join(MESHOPT, 'index.module.js')).href);
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
const { J, NJ } = await import(pathToFileURL(path.join(RAIZ, 'js', 'anim.js')).href);
const { OSSOS, PAI, NO, AUXILIARES } = await import(pathToFileURL(path.join(RAIZ, 'js', 'render', 'esqueleto.js')).href);
const { JOGADOR } = await import(pathToFileURL(path.join(RAIZ, 'js', 'config.js')).href);

// ---------------------------------------------------------------- malha base + alvos
const linhas = fs.readFileSync(path.join(DADOS, 'base.obj'), 'utf8').split('\n');
const V = [], FACES = [], GRUPO = [];
let grupo = null;
for (const l of linhas) {
  if (l.startsWith('v ')) { const p = l.trim().split(/\s+/); V.push([+p[1], +p[2], +p[3]]); }
  else if (l.startsWith('g ')) grupo = l.slice(2).trim();
  else if (l.startsWith('f ')) { FACES.push(l.trim().split(/\s+/).slice(1).map(c => +c.split('/')[0] - 1)); GRUPO.push(grupo); }
}
function lerAlvo(nome) {
  const m = new Map();
  for (const l of zlib.gunzipSync(fs.readFileSync(path.join(DADOS, nome))).toString().split('\n')) {
    if (!l.trim() || l.startsWith('#')) continue;
    const [i, x, y, z] = l.trim().split(/\s+/).map(Number); m.set(i, [x, y, z]);
  }
  return m;
}
// OBJ do MakeHuman: decímetros, Y para cima, +Z para a frente, +X para a esquerda do corpo (os eixos do modelo do jogo)
const PM = V.map(v => v.slice());
for (const e of ['african', 'asian', 'caucasian']) for (const [i, d] of lerAlvo(`${e}-male-young.target.gz`)) for (let k = 0; k < 3; k++) PM[i][k] += d[k] / 3;
for (const p of PM) for (let k = 0; k < 3; k++) p[k] *= 0.1;
const membros = {};
FACES.forEach((f, i) => { (membros[GRUPO[i]] ??= new Set()); for (const v of f) membros[GRUPO[i]].add(v); });
const media = idx => { const s = [0, 0, 0]; for (const i of idx) for (let k = 0; k < 3; k++) s[k] += PM[i][k]; return s.map(x => x / idx.length); };
const RIG = JSON.parse(fs.readFileSync(path.join(DADOS, 'rig.mixamo.json'))).bones;
const posJunta = e => (e.strategy === 'CUBE' ? media([...membros[e.cube_name]]) : media(e.vertex_indices));
const MJ = {};
for (const [n, b] of Object.entries(RIG)) MJ[n.replace('mixamorig:', '')] = { h: posJunta(b.head), t: posJunta(b.tail) };
// chão: a sola do modelo em y = 0
let y0 = Infinity;
for (const i of membros.body) y0 = Math.min(y0, PM[i][1]);
for (const p of PM) p[1] -= y0;
for (const b of Object.values(MJ)) { b.h[1] -= y0; b.t[1] -= y0; }

// ---------------------------------------------------------------- pose de repouso do jogo (proporções da simulação)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => mul(a, 1 / (len(a) || 1));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const COXA = JOGADOR.coxa, CANELA = JOGADOR.canela, TORN = JOGADOR.alturaTornozelo, MQ = JOGADOR.larguraQuadril / 2;
const BRACO = 0.29, ANTEBRACO = 0.26;
const yQuad = TORN + COXA + CANELA;                  // 0,98: o quadril com a perna esticada
const mhQuadMeio = mul(add(MJ.LeftUpLeg.h, MJ.RightUpLeg.h), 0.5);
const desl = [0, yQuad - mhQuadMeio[1], -mhQuadMeio[2]]; // o modelo inteiro sobe (e centra os quadris em z = 0)
const pose = new Array(NJ);
const pel = [0, yQuad + 0.03, 0];
pose[J.pelve] = pel;
pose[J.quadrilE] = [MQ, yQuad, 0]; pose[J.quadrilD] = [-MQ, yQuad, 0];
pose[J.lombar] = add(pel, [0, 0.17, 0]);
pose[J.peito] = add(pose[J.lombar], [0, 0.22, 0]);
pose[J.pescoco] = add(pose[J.peito], [0, 0.13, 0]);
pose[J.cabeca] = add(pose[J.pescoco], [0, 0.13, 0.02]);
const yOmbro = pose[J.peito][1] + 0.07;
for (const [lado, sx, nm] of [[J.ombroE, 1, 'Left'], [J.ombroD, -1, 'Right']]) {
  pose[lado] = [sx * 0.19, yOmbro, 0];
  const dB = unit(sub(MJ[nm + 'Arm'].t, MJ[nm + 'Arm'].h)), dA = unit(sub(MJ[nm + 'ForeArm'].t, MJ[nm + 'ForeArm'].h));
  const jc = lado === J.ombroE ? J.cotoveloE : J.cotoveloD, jm = lado === J.ombroE ? J.maoE : J.maoD;
  pose[jc] = add(pose[lado], mul(dB, BRACO));
  pose[jm] = add(pose[jc], mul(dA, ANTEBRACO));
}
for (const [jq, nm] of [[J.quadrilE, 'Left'], [J.quadrilD, 'Right']]) {
  const dC = unit(sub(MJ[nm + 'UpLeg'].t, MJ[nm + 'UpLeg'].h)), dK = unit(sub(MJ[nm + 'Leg'].t, MJ[nm + 'Leg'].h));
  const e = jq === J.quadrilE;
  const jj = e ? J.joelhoE : J.joelhoD, jt = e ? J.tornozeloE : J.tornozeloD, jp = e ? J.pontaE : J.pontaD;
  pose[jj] = add(pose[jq], mul(dC, COXA));
  pose[jt] = add(pose[jj], mul(dK, CANELA));
  // ponta: 0,17 à frente (na direção horizontal do pé do modelo) e 0,055 abaixo do tornozelo (anim.js, pé apoiado)
  const pf = sub(MJ[nm + 'ToeBase'].t, MJ[nm + 'Foot'].h);
  const fh = unit([pf[0], 0, pf[2]]);
  pose[jp] = add(pose[jt], [fh[0] * 0.17, -(TORN - 0.025), fh[2] * 0.17]);
}

// ---------------------------------------------------------------- transformações modelo → jogo, por osso do jogo
// cada uma: p' = c' + Q·(p − c), Q = escala s ao longo do eixo u (e escala vertical k no pé); p e c no espaço do
// modelo (antes do deslocamento), c' na pose de repouso do jogo
function mapa(c, c2, u = null, s = 1, kVert = 1) {
  return p => {
    let v = sub(p, c);
    if (u && s !== 1) { const a = dot(v, u); v = add(v, mul(u, a * (s - 1))); }
    if (kVert !== 1) v[1] *= kVert;
    return add(c2, v);
  };
}
const dTodos = p => add(p, desl);
const T = new Array(NO);
const O = Object.fromEntries(OSSOS.map((n, i) => [n, i]));
for (const n of ['quadril', 'lombar', 'peito', 'torax', 'pescoco', 'cabeca']) T[O[n]] = dTodos;
for (const [lado, nm] of [['E', 'Left'], ['D', 'Right']]) {
  const jo = lado === 'E' ? J.ombroE : J.ombroD, jc = lado === 'E' ? J.cotoveloE : J.cotoveloD, jm = lado === 'E' ? J.maoE : J.maoD;
  const mO = MJ[nm + 'Arm'].h, mC = MJ[nm + 'ForeArm'].h, mM = MJ[nm + 'Hand'].h;
  const uB = unit(sub(mC, mO)), uA = unit(sub(mM, mC));
  T[O['clavicula' + lado]] = mapa(mO, pose[jo]);
  T[O['braco' + lado]] = mapa(mO, pose[jo], uB, BRACO / len(sub(mC, mO)));
  T[O['antebraco' + lado]] = mapa(mC, pose[jc], uA, ANTEBRACO / len(sub(mM, mC)));
  T[O['mao' + lado]] = mapa(mM, pose[jm]);
  const jq = lado === 'E' ? J.quadrilE : J.quadrilD, jj = lado === 'E' ? J.joelhoE : J.joelhoD, jt = lado === 'E' ? J.tornozeloE : J.tornozeloD;
  const mQ = MJ[nm + 'UpLeg'].h, mJ = MJ[nm + 'Leg'].h, mT = MJ[nm + 'Foot'].h;
  T[O['coxa' + lado]] = mapa(mQ, pose[jq], unit(sub(mJ, mQ)), COXA / len(sub(mJ, mQ)));
  T[O['canela' + lado]] = mapa(mJ, pose[jj], unit(sub(mT, mJ)), CANELA / len(sub(mT, mJ)));
  // pé: sola 0,08 abaixo do tornozelo (no modelo, a sola fica a MJ.Foot.h[1] abaixo)
  const k = TORN / MJ[nm + 'Foot'].h[1];
  T[O['pe' + lado]] = mapa(mT, pose[jt], null, 1, k);
  T[O['dedos' + lado]] = T[O['pe' + lado]];
}

// ---------------------------------------------------------------- pesos: 52 ossos do mixamo → 22 do jogo
const PARA = {
  Hips: 'quadril', Spine: 'lombar', Spine1: 'peito', Spine2: 'torax', Neck: 'pescoco', Head: 'cabeca',
  LeftShoulder: 'claviculaE', LeftArm: 'bracoE', LeftForeArm: 'antebracoE', LeftHand: 'maoE',
  RightShoulder: 'claviculaD', RightArm: 'bracoD', RightForeArm: 'antebracoD', RightHand: 'maoD',
  LeftUpLeg: 'coxaE', LeftLeg: 'canelaE', LeftFoot: 'peE', LeftToeBase: 'dedosE',
  RightUpLeg: 'coxaD', RightLeg: 'canelaD', RightFoot: 'peD', RightToeBase: 'dedosD',
};
function paraJogo(nome) {
  const n = nome.replace('mixamorig:', '');
  if (PARA[n]) return O[PARA[n]];
  const m = n.match(/^(Left|Right)Hand(Index|Middle|Pinky|Ring|Thumb)\d$/);
  if (m) return O['mao' + (m[1] === 'Left' ? 'E' : 'D')];
  if (n === 'HeadTop_End') return O.cabeca;
  throw new Error('osso sem destino: ' + n);
}
const PES = JSON.parse(fs.readFileSync(path.join(DADOS, 'weights.mixamo.json'))).weights;
const W = PM.map(() => new Float64Array(NO));
for (const [nome, lista] of Object.entries(PES)) { const b = paraJogo(nome); for (const [i, w] of lista) W[i][b] += w; }

// ---------------------------------------------------------------- malha do jogo: corpo + olhos
const GRUPOS_USADOS = new Set(['body', 'helper-l-eye', 'helper-r-eye']);
const usados = [...new Set(FACES.flatMap((f, i) => (GRUPOS_USADOS.has(GRUPO[i]) ? f : [])))].sort((a, b) => a - b);
const novo = new Map(usados.map((v, k) => [v, k]));
const nv0 = usados.length;
const pos = new Float32Array(nv0 * 3);
const inf = [];   // 4 maiores influências por vértice
for (let k = 0; k < nv0; k++) {
  const i = usados[k];
  const w = W[i];
  const ord = [...w.keys()].filter(b => w[b] > 0).sort((a, b) => w[b] - w[a]).slice(0, 4);
  let s = 0; for (const b of ord) s += w[b];
  const lista = ord.map(b => [b, w[b] / s]);
  inf.push(lista);
  // refit pela pele linear das transformações por osso (com os pesos já reduzidos)
  let p = [0, 0, 0];
  for (const [b, wb] of lista) p = add(p, mul(T[b](PM[i]), wb));
  pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
}
// auxiliares do joelho e do cotovelo: o peso da junta (osso de cima A + osso de baixo B) vira uma rampa LINEAR pela
// posição ao longo do membro (u = distância à junta na direção da bissetriz dos dois ossos, de −L a +L):
// A → auxiliar 1 (1/3 da dobra) → auxiliar 2 (2/3) → B. Cada trecho gira só θ/3 e, com a rampa larga o bastante, a
// pele do lado de dentro da dobra não dobra sobre si mesma (dobra θ, raio r do membro: precisa L > θ·r/2; a 120°, joelho
// r ≈ 6 cm: L > 6,3 cm).
const RAMPA = { 14: 0.10, 18: 0.10, 7: 0.075, 11: 0.075 };
const JUNTA = { 14: [J.quadrilE, J.joelhoE, J.tornozeloE], 18: [J.quadrilD, J.joelhoD, J.tornozeloD], 7: [J.ombroE, J.cotoveloE, J.maoE], 11: [J.ombroD, J.cotoveloD, J.maoD] };
for (const A of [14, 18, 7, 11]) {
  const aux = AUXILIARES.filter(x => x[1] === A).sort((a, b) => a[3] - b[3]);
  const B = aux[0][2], H1 = aux[0][0], H2 = aux[1][0];
  const [ja, jj, jb] = JUNTA[A];
  const pj = pose[jj], dA = unit(sub(pj, pose[ja])), dB = unit(sub(pose[jb], pj));
  const eixo = unit(add(dA, dB)), L = RAMPA[A];
  for (let k = 0; k < nv0; k++) {
    const l = inf[k];
    let m = 0;
    for (const [b, w] of l) if (b === A || b === B) m += w;
    if (m <= 0) continue;
    const p = [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
    const sb = 3 * Math.min(1, Math.max(0, (dot(sub(p, pj), eixo) + L) / (2 * L)));
    const resto = l.filter(x => x[0] !== A && x[0] !== B);
    const tr = Math.min(2, Math.floor(sb)), fr = sb - tr;
    const ossos = [A, H1, H2, B];
    const novos = [[ossos[tr], m * (1 - fr)], [ossos[tr + 1], m * fr]];
    inf[k] = [...resto, ...novos.filter(x => x[1] > 1e-6)].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const t = inf[k].reduce((a, x) => a + x[1], 0);
    for (const x of inf[k]) x[1] /= t;
  }
}
const tris = [];
FACES.forEach((f, i) => {
  if (!GRUPOS_USADOS.has(GRUPO[i])) return;
  const q = f.map(v => novo.get(v));
  for (let k = 1; k + 1 < q.length; k++) tris.push(q[0], q[k], q[k + 1]);
});
const idx0 = Uint32Array.from(tris);
// normais suaves (área), na pose de repouso já ajustada
const nrm = new Float32Array(nv0 * 3);
for (let t = 0; t < idx0.length; t += 3) {
  const a = idx0[t] * 3, b = idx0[t + 1] * 3, c = idx0[t + 2] * 3;
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const o of [a, b, c]) { nrm[o] += nx; nrm[o + 1] += ny; nrm[o + 2] += nz; }
}
for (let k = 0; k < nv0; k++) { const l = Math.hypot(nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]) || 1; nrm[k * 3] /= l; nrm[k * 3 + 1] /= l; nrm[k * 3 + 2] /= l; }

// ---------------------------------------------------------------- níveis de detalhe (vértices compartilhados)
// atributos para o simplificador: normal (forma) e os pesos dos ossos (protege os anéis das juntas: o colapso de uma
// aresta que atravessa a junta muda o peso e custa caro). --sem-juntas: só a posição (o defeito do protótipo).
// (o simplificador aceita até 32 atributos: normal 3 + os 22 ossos do corpo, com o peso de cada auxiliar somado ao
// osso de cima ou de baixo mais perto, + a posição na rampa de cada uma das 4 juntas com auxiliares)
const NC = 22, NA = 3 + NC + 4;
const atr = new Float32Array(nv0 * NA);
const AUX_DE = new Map(AUXILIARES.map(([h, a, b, f]) => [h, { a, b, f }]));
const JUNTAS_AUX = [...new Set(AUXILIARES.map(x => x[1]))];
for (let k = 0; k < nv0; k++) {
  for (let c = 0; c < 3; c++) atr[k * NA + c] = nrm[k * 3 + c];
  for (const [b, w] of inf[k]) {
    const ax = AUX_DE.get(b);
    if (ax) {
      atr[k * NA + 3 + (ax.f < 0.5 ? ax.a : ax.b)] += w;
      atr[k * NA + 3 + NC + JUNTAS_AUX.indexOf(ax.a)] += w * ax.f;
    } else {
      atr[k * NA + 3 + b] += w;
      const j = JUNTAS_AUX.indexOf(AUXILIARES.find(x => x[2] === b)?.[1]);
      if (j >= 0) atr[k * NA + 3 + NC + j] += w;
    }
  }
}
const pesosAtr = [0.25, 0.25, 0.25, ...new Array(NC + 4).fill(1.2)];
function simplificar(ix, alvo) {
  if (alvo * 3 >= ix.length) return [ix, 0];
  if (SEM_JUNTAS) return MeshoptSimplifier.simplify(ix, pos, 3, alvo * 3, 0.2, ['LockBorder']);
  return MeshoptSimplifier.simplifyWithAttributes(ix, pos, 3, atr, NA, pesosAtr, null, alvo * 3, 0.2, ['LockBorder']);
}
const lods = [];
let base = idx0;
for (const alvo of LODS) {
  const [ix, err] = simplificar(base, alvo);
  lods.push({ ix, err: err * MeshoptSimplifier.getScale(pos, 3) });
  base = ix;
}
// vértices na ordem da 1ª ocorrência no LOD de perto (os outros só usam vértices dele)
const ordem = new Int32Array(nv0).fill(-1);
let nv = 0;
for (const v of lods[0].ix) if (ordem[v] < 0) ordem[v] = nv++;
for (const l of lods) for (const v of l.ix) if (ordem[v] < 0) throw new Error('LOD usa vértice fora do LOD de perto');
const idxTodos = new Uint16Array(lods.reduce((s, l) => s + l.ix.length, 0));
const faixas = [];
let oi = 0;
for (const l of lods) { faixas.push({ ini: oi, n: l.ix.length }); for (const v of l.ix) idxTodos[oi++] = ordem[v]; }

// ---------------------------------------------------------------- dados para o desenho
const P2 = new Float32Array(nv * 3), N2 = new Float32Array(nv * 3), B2 = new Uint8Array(nv * 4), W2 = new Uint8Array(nv * 4);
for (let k = 0; k < nv0; k++) {
  const d = ordem[k]; if (d < 0) continue;
  for (let c = 0; c < 3; c++) { P2[d * 3 + c] = pos[k * 3 + c]; N2[d * 3 + c] = nrm[k * 3 + c]; }
  const l = inf[k];
  const wq = l.map(([, w]) => Math.round(w * 255));
  wq[0] += 255 - wq.reduce((a, b) => a + b, 0);
  for (let c = 0; c < 4; c++) { B2[d * 4 + c] = l[c] ? l[c][0] : 0; W2[d * 4 + c] = l[c] ? wq[c] : 0; }
}
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (let k = 0; k < nv; k++) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], P2[k * 3 + c]); mx[c] = Math.max(mx[c], P2[k * 3 + c]); }

// olhos (centro e raio, para a cor) e cabelo (a calota de hoje, presa no osso da cabeça)
function esfera(grupoNome) {
  const vs = [...membros[grupoNome]].map(i => novo.get(i)).filter(k => k != null);
  const c = [0, 0, 0];
  for (const k of vs) for (let q = 0; q < 3; q++) c[q] += pos[k * 3 + q] / vs.length;
  let r = 0; for (const k of vs) r = Math.max(r, Math.hypot(pos[k * 3] - c[0], pos[k * 3 + 1] - c[1], pos[k * 3 + 2] - c[2]));
  return { c, r };
}
const olhos = [esfera('helper-l-eye'), esfera('helper-r-eye')];
// crânio: vértices com peso na cabeça acima dos olhos
const yOlho = (olhos[0].c[1] + olhos[1].c[1]) / 2;
const cr = { mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity] };
for (let k = 0; k < nv0; k++) {
  if (!inf[k].length || inf[k][0][0] !== O.cabeca || pos[k * 3 + 1] < yOlho - 0.01) continue;
  for (let c = 0; c < 3; c++) { cr.mn[c] = Math.min(cr.mn[c], pos[k * 3 + c]); cr.mx[c] = Math.max(cr.mx[c], pos[k * 3 + c]); }
}
const cabelo = {
  // semi-esfera (a mesma geometria de hoje): centro e raios em x, y, z no repouso do jogo
  centro: [0, yOlho + 0.005, (cr.mn[2] + cr.mx[2]) / 2 - 0.004],
  raios: [(cr.mx[0] - cr.mn[0]) / 2 + 0.006, cr.mx[1] - yOlho + 0.004, (cr.mx[2] - cr.mn[2]) / 2 + 0.006],
};
// pescoço (para a gola): centro em z e raio, pelos vértices com o pescoço dominante
let zp = 0, np = 0;
for (let k = 0; k < nv0; k++) if (inf[k].length && inf[k][0][0] === O.pescoco && inf[k][0][1] > 0.5) { zp += pos[k * 3 + 2]; np++; }
zp /= Math.max(1, np);
// regiões do uniforme (alturas na pose de repouso; o desenho decide a cor por pixel pela posição de repouso)
const tE = pose[J.tornozeloE], ombroE = pose[J.ombroE], cotE = pose[J.cotoveloE], maoE = pose[J.maoE];
const regioes = {
  sola: 0.012, chuteira: tE[1] + 0.035, meiao: tE[1] + 0.36, faixaMeiao: 0.035, calcao: yQuad - 0.29,
  cintura: yQuad + 0.02,
  // gola: em volta do pescoço (centro em z, raio), na altura da base do pescoço atrás e mais baixa na frente
  pescocoZ: +zp.toFixed(4), golaRaio: 0.082, gola: pose[J.pescoco][1] + 0.012, golaFrente: 0.05,
  ombro: ombroE, cotovelo: cotE, mao: maoE, manga: 0.15, punho: 0.022,
};

const bind = { pose: pose.flatMap(p => p.map(x => +x.toFixed(6))), cabecaBase: dTodos(MJ.Head.h).map((x, i) => +(i === 0 ? 0 : x).toFixed(6)) };
for (const [lado, nm] of [['E', 'Left'], ['D', 'Right']]) bind['bola' + lado] = T[O['pe' + lado]](MJ[nm + 'ToeBase'].h).map(x => +x.toFixed(6));

// ---------------------------------------------------------------- gravação
const secoes = [];
function secao(nome, tipo, arr) { secoes.push({ nome, tipo, arr }); }
const pq = new Int16Array(nv * 3);
for (let k = 0; k < nv; k++) for (let c = 0; c < 3; c++) pq[k * 3 + c] = Math.round(((P2[k * 3 + c] - mn[c]) / (mx[c] - mn[c])) * 65535 - 32768);
const nq = new Int8Array(nv * 3);
for (let k = 0; k < nv * 3; k++) nq[k] = Math.round(N2[k] * 127);
secao('pos', 'i16', pq); secao('nrm', 'i8', nq); secao('ossos', 'u8', B2); secao('pesos', 'u8', W2); secao('idx', 'u16', idxTodos);
let off = 0;
const meta = {};
for (const s of secoes) { off = Math.ceil(off / 4) * 4; meta[s.nome] = { off, n: s.arr.length, tipo: s.tipo }; off += s.arr.byteLength; }
const cab = {
  versao: 1, nv, ossos: OSSOS, pai: PAI, min: mn.map(x => +x.toFixed(6)), max: mx.map(x => +x.toFixed(6)),
  lods: faixas.map((f, k) => ({ ...f, tri: f.n / 3, erro: +lods[k].err.toFixed(5) })),
  bind, regioes, cabelo: { centro: cabelo.centro.map(x => +x.toFixed(4)), raios: cabelo.raios.map(x => +x.toFixed(4)) },
  olhos: olhos.map(o => ({ c: o.c.map(x => +x.toFixed(4)), r: +o.r.toFixed(4) })),
  secoes: meta,
  fonte: `MakeHuman/MPFB2 ${COMMIT.slice(0, 7)} (CC0): base.obj hm08, alvos *-male-young, rig/pesos mixamo (CC0); gerado por tools/humano/gerar-corpo.mjs`,
};
let js = Buffer.from(JSON.stringify(cab));
const H = Math.ceil(js.length / 4) * 4;
js = Buffer.concat([js, Buffer.alloc(H - js.length, 0x20)]);
const saida = Buffer.alloc(8 + H + off);
saida.write('GCP1', 0, 'ascii');
saida.writeUInt32LE(H, 4);
js.copy(saida, 8);
for (const s of secoes) Buffer.from(s.arr.buffer, s.arr.byteOffset, s.arr.byteLength).copy(saida, 8 + H + meta[s.nome].off);
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, saida);
console.log(JSON.stringify({
  saida: path.relative(process.cwd(), SAIDA), bytes: saida.length, kb: +(saida.length / 1024).toFixed(1), vertices: nv,
  lods: cab.lods.map(l => `${l.tri} tri (erro ${(l.erro * 1000).toFixed(1)} mm)`),
  modelo: { altura: +(mx[1] - mn[1]).toFixed(3) }, cabelo: cab.cabelo, olhos: cab.olhos, semJuntas: SEM_JUNTAS,
}, null, 1));
