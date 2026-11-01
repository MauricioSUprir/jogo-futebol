// Cadeiras e torcida nos 524 estádios (item 69 da FILA, PR 4 de 4: "os 523 estádios e o padrão, com a calibração";
// contrato "Os 523 estádios (item 69, PR 4)" no CONTRATOS.md; PESQUISA-ESTADIO.md §17). Percorre o Estádio Golaço (o padrão:
// a edição pública, o jogo neutro e a geometria dos 418 sem forma), o Maracanã (js/estadio-planta.js), as 104 genéricas
// (js/estadio-generico.js) e os campos de cadeira de TODOS os 523 da base, com as MESMAS funções puras do jogo
// (render/cadeiras-dados.js, render/torcida-dados.js, render/impostor-dados.js, as plantas, estadio-forma.js, identidade.js).
// Na f1b59c19 (o PR 3) este teste reprova: E1 (a escada de 0,66 m na frente), E3 (34% das cadeiras acima de 34°), E4 (as
// fileiras de 5 cm), E5 (o túnel e o refletor do Golaço, o arco do Dragão), E6 (a escala até 1,52), E8 (as cores) e E9.
//   E1) escadas: a escada radial de cada fileira das genéricas entre 1,1 e 1,8 m (Green Guide 5ª ed. §12.9b/§8.5: 1,1 m
//       mínimo, 1,2 recomendado, 1,8 máximo) em ≥ 99% delas e nunca abaixo de 1,0; o Golaço (1,0 m, 2 células da textura) e
//       o Maracanã (0,45–1,18 m, a textura aprovada nas rodadas da prévia) ficam como estão (decisão do dono, "Depende do
//       dono" 11) — aqui só não podem ficar mais estreitas;
//   E2) cadeiras entre escadas (FIFA 2022 §5.2, Green Guide §12.16): ≤ 28 com escada dos dois lados, ≤ 14 com escada de um
//       lado só (o outro lado é o túnel, a ponta da arquibancada, um vão), em todos;
//   E3) caimento ≤ 34° (Green Guide §11/§12.11) em TODA cadeira das 105 plantas e do Golaço;
//   E4) a fileira: nenhuma cadeira 3D sobreposta (nem lado a lado nem à da fileira de trás), a fileira ≥ 0,6 m em toda
//       cadeira (o encosto não passa do espelho de trás além de 4 cm) e ≥ 0,7 m (Green Guide §12.13: o mínimo) em ≥ 99%;
//   E5) fora do lugar: 0 cadeira fora do piso do degrau, 0 em cima da escada (a borda da cadeira 3D na faixa da escada), 0
//       dentro de um sólido da planta (o assento, a cabeça sentado, de pé e no pulo: o refletor, o arco, a arquibancada);
//   E6) a torcida: cada torcedor numa cadeira da grade (o piso, o assento), nenhuma cadeira com dois, e a escala de todos
//       dentro da do impostor (IMPOSTOR.escala 0,9–1,25: a troca do quadro pelo impostor não pula de tamanho);
//   E7) a densidade real perto (PR 3: público × 96% nos blocos das cadeiras 3D) em todas as plantas: os blocos da frente
//       de lá com o público 1 chegam a ≥ 90% de gente por cadeira;
//   E8) as cores e o padrão da cadeira 3D (= a textura: o MESMO pintor) iguais aos da base (cadeiras_cor, cadeiras_cor2,
//       cadeiras_padrao) em todos: nas 104 genéricas a forma = a base; nos sem forma a 2ª cor da base aparece (não 'liso'
//       com 2ª cor); o Maracanã com as cores da base (ΔE₀₀ < 10) e o padrão 'misto' (o tigela-maracana é o misto dele);
//   E9) a capacidade: a grade ÷ a capacidade real por família (mediana 0,8–1,25 nas genéricas) e, nos sem forma, a torcida
//       pela lotação (a capacidade da base ÷ a da grade do Golaço): a Alta com o público 1 desenha no máximo os lugares de
//       verdade mais as fileiras da frente (a TV); o homônimo da mesma cidade com a forma da entrada principal.
//   node tools/teste-cadeiras-estadios.mjs [--js <pasta js>] [--so chave1,chave2] [--rapido (1 em 6 genéricas)] [--lista]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const pastaJs = path.resolve(arg('--js', path.join(path.dirname(new URL(import.meta.url).pathname), '../js')));
const SO = arg('--so', null)?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const RAPIDO = args.includes('--rapido');
// as genéricas em linhas de execução paralelas (o padrão: até 3, os núcleos da máquina − 1)
const PAR = Math.max(1, Math.min(3, Number(arg('--par', Math.max(1, (os.availableParallelism?.() ?? os.cpus().length) - 1))) || 1));
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const DEG = 180 / Math.PI;
const pct = (v, q) => { const s = [...v].filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))] : NaN; };
const t0 = performance.now();

const CD = await imp('render/cadeiras-dados.js');
const TD = await imp('render/torcida-dados.js');
const IMP = await imp('render/impostor-dados.js');
const GE = await imp('estadio-generico.js');
const PL = await imp('estadio-planta.js');
const EF = await imp('estadio-forma.js');
const IDT = await imp('identidade.js');
const { CADEIRA, NO_PISO } = CD;
const BASE = JSON.parse(fs.readFileSync(path.join(pastaJs, '../assets/tm/estadios.json'), 'utf8'));
const LARG3D = CADEIRA.assento.largura;
const ESC_IMP = IMP.IMPOSTOR.escala;
const ALTURAS = [0.45, 1.3, 1.85, 2.15];   // o assento, a cabeça sentado, de pé e no pulo
const lim = (G, r, th) => (G.limites ? G.limites(r, th) : [r.s0, r.s1, r.sAssento]);
const corredorDe = (G, r, h) => (G.corredorDe ? G.corredorDe(r, h) : G.corredor);
const nhDe = (r, h) => (r.nh ? r.nh[h] : r.n);

// ------------------------------------------------------------------ a medida de uma geometria (as cadeiras)
/**
 * Todas as medidas de cadeira de uma planta (P: a genérica ou o Maracanã; null: o Estádio Golaço). Devolve os contadores e
 * as amostras (escada, entre escadas, caimento, fileira, sobrepostas, fora do degrau, na escada, sólidos).
 */
function medirGeometria(P) {
  const G = P ? P.grade : CD.gradeGolaco();
  const anel = G.tipo === 'anel';
  const N = { cadeiras: 0, fil12: 0, caim34: 0, caimMax: 0, fil06: 0, fil07: 0, filMin: Infinity, foraDegrau: 0, naEscada: 0, solidos: 0, solEx: new Map(), sobrepostas: 0, escadas: [], runs2: 0, runs1: 0, violRuns: [] };
  const solido = !P ? (x, y, z) => { EF.definirForma(null); return EF.solidoEm(x, y, z, 0, true); } : (x, y, z) => P.solido(x, y, z, 0, true, false);
  const FL = CD.fileirasGolaco('lado'), FF = CD.fileirasGolaco('fundo'), nFG = CD.ARQ_GOLACO.fileiras;
  const xs = [], ys = [], zs = [], rs = [], ws = [], fila = [];
  const filas = new Map();   // as cadeiras de cada fileira na ordem: as corridas entre escadas
  let idx = 0;
  G.iterar(c => {
    N.cadeiras++;
    let prof, esp;
    if (anel) {
      const r = G.fileiras[c.k], L = lim(G, r, c.th);
      const [x0, z0] = P.ponto(c.th, L[0]), [x1, z1] = P.ponto(c.th, L[1]);
      const nx = Math.cos(c.rumo), nz = Math.sin(c.rumo);
      prof = Math.abs((x1 - x0) * nx + (z1 - z0) * nz);
      const y0 = P.perfil.length > 1 ? P.perfil(L[0], c.th) : P.perfil(L[0]);
      esp = (P.perfil.length > 1 ? P.perfil(L[1], c.th) : P.perfil(L[1])) - y0;
      if (Math.abs(c.y - y0) > 0.01) N.foraDegrau++;
      // em cima da escada: a borda da cadeira 3D (1 cm para dentro) na faixa da escada da metade dela
      const ti = P.trechoDe ? P.trechoDe(c.x, c.z) : 0, tr = G.trechos[ti];
      const w = (LARG3D * CD.escalaLargura(c.larg)) / 2 - 0.01, tx = -Math.sin(c.rumo), tz = Math.cos(c.rumo);
      for (const sg of [-1, 1]) {
        const ex = c.x + sg * w * tx, ez = c.z + sg * w * tz;
        const u = tr.uDe(Math.atan2(ez, ex), c.s), fr = u - Math.floor(u), hh = fr >= 0.5 ? 1 : 0, qq = (fr - hh / 2) * 2;
        if (qq < corredorDe(G, r, hh)) { N.naEscada++; break; }
      }
      const ch = ti * 100000 + c.k;
      let l = filas.get(ch); if (!l) filas.set(ch, l = []);
      l.push({ t: c.t, h: c.h, i: c.i, n: c.n, th: c.th, s: c.s, k: c.k });
      fila.push(ch);
      // a escada à esquerda da 1ª cadeira da metade (a escada começa a metade): a largura na fileira, no assento
      if (c.i === 0 && corredorDe(G, r, c.h) > 0) {
        const u0 = c.t + c.h / 2, u1 = u0 + corredorDe(G, r, c.h) / 2;
        if (u0 >= tr.u0 && u1 <= tr.u1) {
          // (o ponto da fileira em cada ângulo: por metro, o s dela muda com o ângulo)
          const naFileira = t => P.ponto(t, (lim(G, r, t) ?? [0, 0, c.s])[2]);
          const [ax, az] = naFileira(tr.thDe(u0, c.s)), [bx, bz] = naFileira(tr.thDe(u1, c.s));
          N.escadas.push(Math.hypot(bx - ax, bz - az));
        }
      }
    } else {
      const j = nFG - 1 - c.f, r = c.setor === 0 || c.setor === 3 ? FL[j] : FF[j];
      prof = r.p; esp = r.h;
      if (Math.abs(c.y - r.y) > 0.01) N.foraDegrau++;
      const ch = c.setor * 1000 + c.f;
      let l = filas.get(ch); if (!l) filas.set(ch, l = []);
      l.push({ a: c.a });
      fila.push(ch);
    }
    const cm = Math.atan2(esp, prof) * DEG;
    N.caimMax = Math.max(N.caimMax, cm);
    if (cm > CADEIRA.caimentoMax + 0.05) N.caim34++;
    N.filMin = Math.min(N.filMin, prof);
    if (prof < 0.6) N.fil06++;
    if (prof < 0.7) N.fil07++;
    if (prof > 1.2) N.fil12++;
    xs.push(c.x); ys.push(c.y); zs.push(c.z); rs.push(c.rumo); ws.push(LARG3D * CD.escalaLargura(c.larg));
    // dentro de um sólido (f = 0): o assento, a cabeça sentado, de pé e no pulo (1 em cada 3 cadeiras: os sólidos que
    // pegam cadeira são grandes — o refletor, o arco, o perfil liso)
    // (a "arquibancada" na altura do assento é a rampa LISA de longe passando pelos assentos: numa fileira de 34° e mais de
    // 1 m ela chega a 0,45 m; quem cuida do caimento é o E3)
    if (idx++ % 3 === 0) for (const h of ALTURAS) { const s = solido(c.x, c.y + h, c.z); if (s && !(s === 'arquibancada' && h < 1)) { N.solidos++; N.solEx.set(s, (N.solEx.get(s) ?? 0) + 1); break; } }
  });
  // as corridas de cadeiras entre escadas, por fileira (Golaço: as células; anel: as metades de ladrilho)
  if (anel) {
    for (const [ch, l] of filas) {
      const r = G.fileiras[ch % 100000], tr = G.trechos[Math.floor(ch / 100000)];
      l.sort((a, b) => a.t - b.t || a.h - b.h || a.i - b.i);
      let ini = 0;
      for (let q = 1; q <= l.length; q++) {
        const a = l[q - 1], b = l[q];
        if (b && b.t === a.t && b.h === a.h && b.i === a.i + 1) continue;
        // a corrida l[ini..q−1]: escada à esquerda se começa na 1ª cadeira de uma metade com escada; à direita se acaba na
        // última e a metade seguinte (dentro do trecho) começa com escada
        const p = l[ini], u = a, n = q - ini;
        // (um vão de ≥ 3 cadeiras no meio da metade — o vomitório do Maracanã, a boca de uma saída — também é saída)
        const ant = l[ini - 1], vaoEsq = ant && ant.t === p.t && ant.h === p.h && p.i - ant.i - 1 >= 3;
        const vaoDir = b && b.t === u.t && b.h === u.h && b.i - u.i - 1 >= 3;
        const esq = (p.i === 0 && corredorDe(G, r, p.h) > 0) || vaoEsq;
        const hN = u.h === 0 ? 1 : 0, tN = u.h === 0 ? u.t : u.t + 1;
        // (a volta inteira — os cantos fechados e o Maracanã — continua do outro lado da emenda em θ = ±π)
        const dir = (u.i === nhDe(r, u.h) - 1 && corredorDe(G, r, hN) > 0 && (tN + hN / 2 < tr.u1 - 1e-9 || G.trechos.length === 1)) || vaoDir;
        if (esq && dir) { N.runs2 = Math.max(N.runs2, n); if (n > 28) N.violRuns.push(`2 lados ${n}`); }
        else { N.runs1 = Math.max(N.runs1, n); if (n > 14) N.violRuns.push(`1 lado ${n} (fileira ${r.k})`); }
        ini = q;
      }
    }
  } else {
    for (const [ch, l] of filas) {
      const st = Math.floor(ch / 1000), f = ch % 1000;
      const esc = a => (G.escadaEm ? G.escadaEm(st, f, a) : a % CD.ARQ_GOLACO.corredor < 2);
      l.sort((a, b) => a.a - b.a);
      let ini = 0;
      for (let q = 1; q <= l.length; q++) {
        if (l[q] && l[q].a === l[q - 1].a + 1) continue;
        const n = q - ini, a0 = l[ini].a, a1 = l[q - 1].a;
        const dosDois = esc(a0 - 1) && esc(a1 + 1);
        if (dosDois) { N.runs2 = Math.max(N.runs2, n); if (n > 28) N.violRuns.push(`2 lados ${n}`); }
        else { N.runs1 = Math.max(N.runs1, n); if (n > 14) N.violRuns.push(`1 lado ${n} (setor ${Math.floor(ch / 1000)}, fileira ${ch % 1000})`); }
        ini = q;
      }
    }
  }
  // sobrepostas: o passo entre duas cadeiras vizinhas menor que as duas cadeiras 3D (lado a lado e com a de trás)
  {
    const n = xs.length, CEL = 0.5, mapa = new Map();
    const chv = (i, j) => (i + 8192) * 16384 + (j + 8192);
    for (let k = 0; k < n; k++) { const kk = chv(Math.floor(xs[k] / CEL), Math.floor(zs[k] / CEL)); const l = mapa.get(kk); if (l) l.push(k); else mapa.set(kk, [k]); }
    const marca = new Uint8Array(n);
    for (let a = 0; a < n; a++) {
      const ci = Math.floor(xs[a] / CEL), cj = Math.floor(zs[a] / CEL), tx = -Math.sin(rs[a]), tz = Math.cos(rs[a]);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const l = mapa.get(chv(ci + di, cj + dj));
        if (!l) continue;
        for (const b of l) {
          if (b <= a || Math.abs(ys[b] - ys[a]) > 0.3) continue;
          const dx = xs[b] - xs[a], dz = zs[b] - zs[a];
          const ao = Math.abs(dx * tx + dz * tz), tr = Math.abs(dx * tz - dz * tx);
          if (ao < (ws[a] + ws[b]) / 2 - 0.005 && tr < CADEIRA.assento.fundo) { marca[a] = 1; marca[b] = 1; }
        }
      }
    }
    for (let k = 0; k < n; k++) N.sobrepostas += marca[k];
  }
  return N;
}

// ------------------------------------------------------------------ a torcida de uma geometria
/** Cada torcedor numa cadeira (o piso, o assento ± 6 cm de sorteio no Golaço), um por cadeira, e a escala de todos. */
function medirTorcida(P) {
  const G = P ? P.grade : CD.gradeGolaco();
  const R = TD.gerarTorcidaNiveis(null, null, P ? P.lugares : null);
  let fora = 0, dois = 0, eMax = 0, eMin = Infinity;
  const usadas = new Set();
  for (let i = 0; i < R.n; i++) {
    const x = R.pos[4 * i], y = R.pos[4 * i + 1], z = R.pos[4 * i + 2], w = R.pos[4 * i + 3];
    eMax = Math.max(eMax, w); eMin = Math.min(eMin, w);
    let c = null;
    if (P) {
      // o lugar das plantas: x com o sorteio de ± 6 cm (torcida-dados.js cadeira: x + (r6 − 0,5)·0,12) — a cadeira da
      // grade mais perto na mesma fileira
      for (const dx of [0, -0.06, 0.06]) {
        const xx = x + dx, th = Math.atan2(z, xx), q = G.assentoEm(th, P.sDe(xx, z), P.trechoDe ? P.trechoDe(xx, z) : 0);
        if (q && Math.hypot(q.x - x, q.z - z) <= 0.07 && Math.abs(q.y - y) < 1e-3) { c = q; break; }
      }
    } else {
      const st = Math.round(R.info[4 * i + 1] / 85);
      for (const dx of [0, -0.25, 0.25]) { const q = G.assentoEm(x + dx, z, st); if (q && Math.hypot(q.x - x, q.z - z) <= 0.07 && Math.abs(q.y - y) < 1e-3) { c = q; break; } }
    }
    if (!c) { fora++; continue; }
    if (usadas.has(c.chave)) dois++;
    usadas.add(c.chave);
  }
  return { n: R.n, fora, dois, eMax, eMin, dados: R };
}

// ------------------------------------------------------------------ a densidade real perto
/** Os blocos da frente do lado de lá (o centro, os cantos) com o público 1: a fração de cadeiras com gente na Alta. */
function medirDensidade(P, R) {
  const G = P ? P.grade : CD.gradeGolaco();
  const celula = (x, z) => (Math.floor(x * 2) + 4096) * 8192 + (Math.floor(z * 2) + 4096);
  const hash = new Map();
  for (let i = 0; i < R.n; i++) { const k = celula(R.pos[4 * i], R.pos[4 * i + 2]); const l = hash.get(k); if (l) l.push(i); else hash.set(k, [i]); }
  const torcedorDa = c => {
    let melhor = -1, dm = Infinity;
    for (const dx of [-0.07, 0, 0.07]) for (const dz of [-0.02, 0.02]) {
      const l = hash.get(celula(c.x + dx, c.z + dz));
      if (!l) continue;
      for (const i of l) { const ex = Math.abs(R.pos[4 * i] - c.x), ez = Math.abs(R.pos[4 * i + 2] - c.z); if (ex <= 0.07 && ez <= 0.02 && Math.abs(R.pos[4 * i + 1] - c.y) <= 0.02 && ex + ez < dm) { dm = ex + ez; melhor = i; } }
    }
    return melhor;
  };
  // os blocos do lado de lá (setor 0) mais perto do campo, perto do meio e dos dois lados
  const cand = G.blocos.map((b, i) => ({ b, i })).filter(o => o.b.setor === 0).sort((a, b) => Math.abs(a.b.c[2]) - Math.abs(b.b.c[2]) || a.i - b.i);
  const escolha = [];
  for (const alvoX of [0, -25, 25]) { const o = cand.slice(0, 60).sort((a, b) => Math.abs(a.b.c[0] - alvoX) - Math.abs(b.b.c[0] - alvoX))[0]; if (o && !escolha.includes(o)) escolha.push(o); }
  const fr = [];
  for (const o of escolha) {
    const as = G.assentosDoBloco(o.i);
    if (as.length < 8) continue;
    const ocup = new Int32Array(as.length);
    for (let j = 0; j < as.length; j++) ocup[j] = torcedorDa(as[j]);
    const cx = G.blocos[o.i].caixa;
    const Pp = IMP.preencherBloco(as, ocup, R, 2, cx ? cx.eixo : [1, 0]);
    fr.push(Pp.n / as.length);
  }
  return fr;
}

// ------------------------------------------------------------------ os estádios
const genericas = [], semForma = [];
let maracana = null;
for (const [k, e] of Object.entries(BASE.estadios)) {
  const fb = e.forma && typeof e.forma === 'object' && !Array.isArray(e.forma) ? e.forma : null;
  if (fb && fb.entorno === 'maracana') maracana = [k, e];
  else if (fb && GE.validarFormaGenerica(fb)) genericas.push([k, e]);
  else semForma.push([k, e]);
}
const amostraG = genericas.filter(([k], i) => (!SO || SO.includes(k)) && (!RAPIDO || i % 6 === 0));
if (!isMainThread) {
  // a linha de execução de uma fatia das genéricas: mede e devolve (o resto do teste roda na principal)
  const medir = ([k, e]) => { const P = GE.criarPlantaGenerica(GE.validarFormaGenerica(e.forma)); const N = medirGeometria(P), T = medirTorcida(P), d = medirDensidade(P, T.dados); return [P.familia, k, N, { n: T.n, fora: T.fora, dois: T.dois, eMax: T.eMax, eMin: T.eMin }, d, N.cadeiras / e.capacidade]; };
  parentPort.postMessage(workerData.chaves.map(k => medir([k, BASE.estadios[k]])));
  process.exit(0);
}
const R = { familias: new Map() };
const ac = fam => { let a = R.familias.get(fam); if (!a) R.familias.set(fam, a = { n: 0, cad: 0, caim34: 0, caimMax: 0, fil06: 0, fil07: 0, filMin: Infinity, fora: 0, naEscada: 0, solidos: 0, sobre: 0, escadas: [], runs2: 0, runs1: 0, viol: [], solEx: new Map(), tFora: 0, tDois: 0, eMax: 0, eMin: Infinity, dens: [], razoes: [], piores: [] }); return a; };
function juntar(fam, chave, N, T, dens, razao) {
  const a = ac(fam);
  a.n++; a.cad += N.cadeiras; a.fil12 = (a.fil12 ?? 0) + N.fil12; a.caim34 += N.caim34; a.caimMax = Math.max(a.caimMax, N.caimMax); a.fil06 += N.fil06; a.fil07 += N.fil07;
  a.filMin = Math.min(a.filMin, N.filMin); a.fora += N.foraDegrau; a.naEscada += N.naEscada; a.solidos += N.solidos; a.sobre += N.sobrepostas;
  for (const e of N.escadas) a.escadas.push(e);
  a.runs2 = Math.max(a.runs2, N.runs2); a.runs1 = Math.max(a.runs1, N.runs1);
  for (const v of N.violRuns.slice(0, 2)) a.viol.push(`${chave}: ${v}`);
  for (const [s, c] of N.solEx) a.solEx.set(`${chave} (${s})`, c);
  if (T) { a.tFora += T.fora; a.tDois += T.dois; a.eMax = Math.max(a.eMax, T.eMax); a.eMin = Math.min(a.eMin, T.eMin); }
  if (dens) for (const d of dens) a.dens.push(d);
  if (razao != null) a.razoes.push([chave, razao]);
  if (N.caim34 || N.sobrepostas || N.fil06 || N.solidos || N.naEscada || N.foraDegrau) a.piores.push(`${chave} (${[N.caim34 && `${N.caim34} > 34° (máx ${fmt(N.caimMax, 1)}°)`, N.sobrepostas && `${N.sobrepostas} sobrepostas`, N.fil06 && `${N.fil06} fileira < 0,6 m (mín ${fmt(N.filMin, 2)})`, N.solidos && `${N.solidos} em sólido`, N.naEscada && `${N.naEscada} na escada`, N.foraDegrau && `${N.foraDegrau} fora do degrau`].filter(Boolean).join(', ')})`);
}
// o Estádio Golaço (o padrão e a geometria dos 418 sem forma)
{
  const N = medirGeometria(null), T = medirTorcida(null), d = medirDensidade(null, T.dados);
  juntar('golaço (padrão e os sem forma)', 'padrão', N, T, d, null);
}
// o Maracanã
if (maracana && (!SO || SO.includes('maracana'))) {
  const P = PL.criarPlanta(PL.validarForma(maracana[1].forma));
  const N = medirGeometria(P), T = medirTorcida(P), d = medirDensidade(P, T.dados);
  juntar('maracanã', 'maracana', N, T, d, N.cadeiras / maracana[1].capacidade);
}
// as genéricas (em PAR linhas de execução: cada uma mede a sua fatia e devolve as medidas)
const medirGenerica = ([k, e]) => {
  const P = GE.criarPlantaGenerica(GE.validarFormaGenerica(e.forma));
  const N = medirGeometria(P), T = medirTorcida(P), d = medirDensidade(P, T.dados);
  return [P.familia, k, N, { n: T.n, fora: T.fora, dois: T.dois, eMax: T.eMax, eMin: T.eMin }, d, N.cadeiras / e.capacidade];
};
if (PAR > 1 && amostraG.length > 6) {
  const fatias = Array.from({ length: PAR }, (_, w) => amostraG.filter((_, i) => i % PAR === w).map(([k]) => k));
  const res = await Promise.all(fatias.map(ch => new Promise((ok, erro) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { chaves: ch }, argv: args.filter((a, i) => a !== '--par' && args[i - 1] !== '--par').concat(['--par', '1']) });
    w.once('message', ok); w.once('error', erro);
  })));
  let n = 0;
  for (const lista of res) for (const r of lista) { juntar(...r); n++; }
  if (n !== amostraG.length) reg('as linhas de execução devolveram todas as genéricas', `${n} de ${amostraG.length}`, 'todas', false);
} else for (const g of amostraG) juntar(...medirGenerica(g));
const todas = [...R.familias.values()];
const soma = f => todas.reduce((t, a) => t + f(a), 0);
const nomeFam = [...R.familias.keys()];

// ------------------------------------------------------------------ E1 escadas
{
  const g = todas.filter((a, i) => !['golaço (padrão e os sem forma)', 'maracanã'].includes(nomeFam[i]));
  const esc = g.flatMap(a => a.escadas);
  const dentro = esc.filter(e => e >= 1.1 - 1e-6 && e <= 1.8 + 1e-6).length, min = esc.reduce((m, v) => Math.min(m, v), Infinity), max = esc.reduce((m, v) => Math.max(m, v), -Infinity);
  // (na quina da 1ª fileira dos cantos fechados a curva aperta a fileira: a escada ali fica mais estreita — poucas)
  reg(`E1 escadas das genéricas (${amostraG.length}): a radial de cada fileira entre 1,1 e 1,8 m (Green Guide §12.9b/§8.5) em ≥ 99%`,
    `${esc.length} escadas: p1 ${fmt(pct(esc, 0.01), 2)}, p50 ${fmt(pct(esc, 0.5), 2)}, p99 ${fmt(pct(esc, 0.99), 2)} m (mín ${fmt(min, 2)}, máx ${fmt(max, 2)}); ${fmt((100 * dentro) / Math.max(1, esc.length), 2)}% dentro`,
    '≥ 99% em 1,1–1,8; p1 ≥ 1,1', esc.length > 0 && dentro >= 0.99 * esc.length && pct(esc, 0.01) >= 1.1);
  const m = R.familias.get('maracanã');
  if (m) {
    const em = m.escadas;
    reg('E1 Maracanã: a escada da textura aprovada (decisão do dono: fica) não mais estreita que antes', `p1 ${fmt(pct(em, 0.01), 2)}, máx ${fmt(em.reduce((m, v) => Math.max(m, v), 0), 2)} m`, 'p1 ≥ 0,45', pct(em, 0.01) >= 0.449);
  }
}
// ------------------------------------------------------------------ E2 entre escadas
{
  const v = todas.flatMap(a => a.viol);
  reg('E2 cadeiras entre escadas: ≤ 28 com escada dos dois lados, ≤ 14 com um lado só (FIFA 2022 §5.2; Green Guide §12.16)',
    nomeFam.map((f, i) => `${f} ${todas[i].runs2}/${todas[i].runs1}`).join('; ') + (v.length ? `; acima: ${v.slice(0, 4).join('; ')}` : ''),
    '≤ 28 / ≤ 14', !v.length);
}
// ------------------------------------------------------------------ E3 caimento
{
  const n = soma(a => a.caim34), cad = soma(a => a.cad);
  reg('E3 caimento ≤ 34° em toda cadeira (Green Guide §11/§12.11), nas 105 plantas e no Golaço',
    `${n} de ${cad} cadeiras acima (${fmt((100 * n) / cad, 2)}%); máx ${nomeFam.map((f, i) => `${f} ${fmt(todas[i].caimMax, 1)}°`).join(', ')}`,
    '0', n === 0);
}
// ------------------------------------------------------------------ E4 fileira e sobrepostas
{
  // (o Maracanã fica com as fileiras da textura aprovada — 0,56–0,8 m: decisão do dono, "Depende do dono" 11)
  const sem = todas.filter((_, i) => nomeFam[i] !== 'maracanã'), m = R.familias.get('maracanã');
  const sob = soma(a => a.sobre), f6 = sem.reduce((t, a) => t + a.fil06, 0), f7 = sem.reduce((t, a) => t + a.fil07, 0), cad = sem.reduce((t, a) => t + a.cad, 0);
  const f12 = sem.reduce((t, a) => t + a.fil12, 0);
  reg('E4 a fileira: 0 cadeira 3D sobreposta (todas); fora o Maracanã, a fileira ≥ 0,6 m em toda cadeira e ≥ 0,7 m (Green Guide §12.13) em ≥ 99%',
    `${sob} sobrepostas; ${f6} abaixo de 0,6 m; ${f7} abaixo de 0,7 m (${fmt((100 * f7) / cad, 2)}%); acima de 1,2 m ${fmt((100 * f12) / cad, 2)}% (informativo); mín ${nomeFam.map((f, i) => `${f} ${fmt(todas[i].filMin, 2)}`).join(', ')}${m ? `; Maracanã ${fmt((100 * m.fil07) / m.cad, 1)}% abaixo de 0,7 (decisão)` : ''}`,
    '0; 0; ≥ 99%', sob === 0 && f6 === 0 && f7 <= 0.01 * cad);
}
// ------------------------------------------------------------------ E5 fora do lugar
{
  const fd = soma(a => a.fora), ne = soma(a => a.naEscada), so = soma(a => a.solidos);
  const ex = todas.flatMap(a => [...a.solEx]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, c]) => `${k} ${c}`);
  reg('E5 fora do lugar: 0 fora do piso do degrau, 0 em cima da escada, 0 dentro de sólido (o assento, a cabeça sentado/de pé/no pulo; 1 em 3 cadeiras)',
    `${fd} fora do degrau; ${ne} na escada; ${so} em sólido${ex.length ? ' (' + ex.join('; ') + ')' : ''}`, '0; 0; 0', fd === 0 && ne === 0 && so === 0);
  const piores = todas.flatMap(a => a.piores).slice(0, 6);
  if (piores.length) linhas.push(['   (os piores)', piores.join(' · '), '', '']);
}
// ------------------------------------------------------------------ E6 a torcida
{
  const tf = soma(a => a.tFora), td = soma(a => a.tDois), eMax = Math.max(...todas.map(a => a.eMax)), eMin = Math.min(...todas.map(a => a.eMin));
  reg(`E6 a torcida: cada torcedor numa cadeira, nenhuma com dois; a escala dentro da do impostor (${ESC_IMP[0]}–${ESC_IMP[1]})`,
    `${tf} sem cadeira; ${td} cadeiras com dois; escala ${fmt(eMin, 3)}–${fmt(eMax, 3)} (${nomeFam.map((f, i) => `${f} ${fmt(todas[i].eMax, 2)}`).join(', ')})`,
    `0; 0; ${ESC_IMP[0]}–${ESC_IMP[1]}`, tf === 0 && td === 0 && eMax <= ESC_IMP[1] + 1e-6 && eMin >= ESC_IMP[0] - 1e-6);
}
// ------------------------------------------------------------------ E7 a densidade real perto
{
  const d = todas.flatMap(a => a.dens);
  reg('E7 a densidade real perto (PR 3: público × 96%) em todas as plantas: os blocos da frente de lá, público 1, Alta',
    `${d.length} blocos: p5 ${fmt(pct(d, 0.05), 3)}, p50 ${fmt(pct(d, 0.5), 3)}, mín ${fmt(d.reduce((m, v) => Math.min(m, v), Infinity), 3)}`, 'p5 ≥ 0,90', d.length > 0 && pct(d, 0.05) >= 0.9);
}
// ------------------------------------------------------------------ E8 as cores
{
  const iguais = (a, b) => (a ?? null) === (b ?? null);
  const ruinsG = [];
  for (const [k, e] of genericas) {
    const F = GE.validarFormaGenerica(e.forma);
    const c1 = F.cadeiras[0], c2 = F.cadeiras[1] ?? null;
    const b1 = (e.cadeiras_cor ?? '').toLowerCase() || null, b2 = (e.cadeiras_cor2 ?? '').toLowerCase() || null;
    if (!iguais(c1, b1) || !iguais(c2, b2) || F.padrao !== e.cadeiras_padrao) ruinsG.push(`${k} ${c1}/${c2}/${F.padrao} × ${b1}/${b2}/${e.cadeiras_padrao}`);
  }
  reg(`E8 genéricas (${genericas.length}): a cor e o padrão da cadeira 3D (= a textura) iguais aos da base (cadeiras_cor, cadeiras_cor2, cadeiras_padrao)`,
    `${ruinsG.length} diferentes${ruinsG.length ? ': ' + ruinsG.slice(0, 3).join('; ') : ''}`, '0', ruinsG.length === 0);
  const ruinsS = [];
  for (const [k, e] of semForma) {
    const d = IDT.dadosEstadio(e, k);
    if (!d) continue;
    if (d.padrao === 'liso' && d.cadeira2 && IDT.deltaE(d.cadeira2, d.cadeira) >= 10) ruinsS.push(k);
    if (e.cadeiras_padrao && e.cadeiras_padrao !== d.padrao) ruinsS.push(`${k} (padrão ${e.cadeiras_padrao})`);
  }
  reg(`E8 sem forma (${semForma.length}): o padrão da base desenhado e a 2ª cor da base aparece (nada de 'liso' com 2ª cor)`,
    `${ruinsS.length} com a 2ª cor sumida ou o padrão trocado${ruinsS.length ? ': ' + ruinsS.slice(0, 4).join(', ') : ''}`, '0', ruinsS.length === 0);
  if (maracana) {
    const P = PL.criarPlanta(PL.validarForma(maracana[1].forma)), e = maracana[1], cs = P.forma.cadeiras;
    const d1 = IDT.deltaE(cs[0], e.cadeiras_cor), d2 = e.cadeiras_cor2 ? IDT.deltaE(cs[1], e.cadeiras_cor2) : Infinity;
    reg('E8 Maracanã: as cores da base = as da textura aprovada (ΔE₀₀ < 10) e o padrão "misto" (o tigela-maracana)',
      `1ª ΔE ${fmt(d1, 1)}, 2ª ΔE ${fmt(d2, 1)}; padrão da base ${e.cadeiras_padrao}`, '< 10; < 10; misto', d1 < 10 && d2 < 10 && e.cadeiras_padrao === 'misto');
  }
}
// ------------------------------------------------------------------ E9 a capacidade
{
  const fams = nomeFam.map((f, i) => [f, todas[i]]).filter(([f]) => !f.startsWith('golaço'));
  const rs = fams.flatMap(([, a]) => a.razoes.map(r => r[1])).filter(Number.isFinite);
  const gens = fams.filter(([f]) => f !== 'maracanã').flatMap(([, a]) => a.razoes.map(r => r[1]));
  linhas.push(['   (a grade ÷ a capacidade real, por família)', fams.map(([f, a]) => `${f} p50 ${fmt(pct(a.razoes.map(r => r[1]), 0.5), 2)} (${fmt(pct(a.razoes.map(r => r[1]), 0.1), 2)}–${fmt(pct(a.razoes.map(r => r[1]), 0.9), 2)})`).join('; '), '', '']);
  reg('E9 a capacidade das genéricas: a grade ÷ a real com mediana 0,8–1,25', `mediana ${fmt(pct(gens, 0.5), 2)} (p10 ${fmt(pct(gens, 0.1), 2)}, p90 ${fmt(pct(gens, 0.9), 2)}); ${rs.length} plantas`, '0,8–1,25', pct(gens, 0.5) >= 0.8 && pct(gens, 0.5) <= 1.25);
  // os sem forma: a lotação (a capacidade real ÷ a da grade do Golaço) na torcida; a Alta com o público 1 desenha no
  // máximo os lugares de verdade mais as fileiras da frente (a TV)
  const capG = CD.gradeGolaco().capacidade;
  const caps = semForma.map(([, e]) => Number(e.capacidade)).filter(Number.isFinite).sort((a, b) => a - b);
  const testes = [caps[0], pct(caps, 0.25), pct(caps, 0.5), pct(caps, 0.9)];
  const res = [];
  let ok = true;
  const FL = CD.fileirasGolaco('lado');
  for (const cap of testes) {
    const Rr = TD.gerarTorcidaNiveis(null, { capacidade: cap, publico: 1 }, null);
    // as fileiras da frente do lado de lá (TD.TORCIDA.frente: as da TV, cheias) contadas à parte
    let nf = 0, nAlta = 0;
    for (let i = 0; i < Rr.n; i++) {
      if (Rr.nivel[i] > 2) continue;
      nAlta++;
      const st = Math.round(Rr.info[4 * i + 1] / 85), y = Rr.pos[4 * i + 1];
      if (st === 0 && y < FL[TD.TORCIDA.frente].y - 1e-3) nf++;
    }
    const teto = cap + nf;
    res.push(`${cap} lugares: ${nAlta} na Alta (teto ${teto})`);
    if (nAlta > teto || (cap >= 0.9 * capG && nAlta < 0.85 * Math.min(cap, capG))) ok = false;
  }
  reg('E9 os sem forma: a torcida pela lotação (a Alta com o público 1 ≤ os lugares reais + as fileiras da frente)', res.join('; '), '≤ o teto', ok);
  // o homônimo da mesma cidade herda a forma da entrada principal (o clube dele achava a geometria do Golaço)
  const sem = [];
  for (const [k, l] of Object.entries(BASE.homonimos ?? {})) { const t = BASE.estadios[k]; for (const h of l) if (t && h.cidade === t.cidade && t.forma && !h.forma) sem.push(`${k} (${h.cidade})`); }
  reg('E9 o homônimo da mesma cidade tem a forma da entrada principal', sem.length ? sem.join(', ') : 'todos', 'todos', sem.length === 0);
}

if (args.includes('--lista')) for (const l of linhas.slice(1)) console.log(`${l[3] || '  '}  ${l[0]}\n      ${l[1]}${l[2] ? '  [meta: ' + l[2] + ']' : ''}`);
else console.log(tabelaTexto(linhas));
console.log(`\n${amostraG.length + (maracana ? 1 : 0) + 1} geometrias e ${Object.keys(BASE.estadios).length} estádios em ${fmt((performance.now() - t0) / 1000, 1)} s`);
if (falhas) { console.log(`\n${falhas} reprovado(s)`); process.exit(1); }
console.log('\nTodos passaram.');
