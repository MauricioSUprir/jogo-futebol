// Passada natural de quem anda FORA da partida (item 61 da FILA; dono, 23/10, com print: no túnel e na fila "parecem que
// estão marchando, parecendo NPC"; js/marcha.js, js/cortejo.js, js/cena-atores.js, js/substituicao.js, js/tecnicos.js).
// Mede na pose DESENHADA (o manequim: cortejo.js poseAndante / a.atu das cenas) e no CORPO NOVO (render/esqueleto.js
// postura + juntasDesenho, o que o humano3d.js desenha), contra a pesquisa (as fontes no cabeçalho do js/marcha.js):
//  C — o cortejo do pré-jogo (semente 7, 50 s; regime = andando 1,2–2,2 m/s antes da vaga):
//   C1 pares lado a lado (o k-ésimo do mandante × o do visitante) no mesmo pé (|Δfase| < 0,05 passo) ≤ 25% das amostras
//      (casais lado a lado sincronizam em ~1/3 das caminhadas, nunca travados — Zivotofsky & Hausdorff 2007);
//   C2 os 3 árbitros: R da passada (mediana no tempo) ≤ 0,85;  C3 vizinhos na coluna: o Δfase com desvio ≥ 0,2 passo (não
//      uma onda fixa);  C4 pares a ≤ 2,5 m no mesmo pé (|Δ| < 0,1 passo) ≤ 20% (ao acaso 10%);  C5 o 1º pé: cada lado ≥ 30%;
//   C6 cadência por jogador: o desvio entre jogadores 3–8% (walk ratio ~10%, Sekiya 1996), todas em 1,7–2,2 passos/s e o
//      passo em 0,62–0,82 m;  C7 a saída do parado: a pelve ≥ 0,82 m nos 2 s depois de sair (no regime ela desce a ~0,85) e
//      ≥ 1,2 s até 90% da velocidade (a mediana; 3–5 passos até o regime);  C8 as chegadas na fila no MESMO tempo (o roteiro
//      do pré-jogo não atrasa): os times a ±0,1 s da base 7cb052ad (CHEGADA_BASE), os árbitros até +1,1 s;
//  B — o braço e o tronco (no regime do cortejo), nos DOIS corpos:
//   B1 o braço oposto à perna do mesmo lado: correlação braço E × coxa D (e D × E) no mesmo instante ≥ +0,7 (mediana);
//   B2 a amplitude do braço ±8–18° (mediana; ROM do ombro 20–35°) e o desvio entre jogadores ≥ 10%;
//   B3 o cotovelo: excursão ≥ 12° (ROM ~30 ± 10°, CiSE 2023) e mais dobrado à frente (correlação dobra × braço ≥ +0,5,
//      manequim);  B4 a pelve ±3–6° com a perna da frente (correlação rotação × coxa D ≤ −0,6);  B5 o tórax ±2–5° ao
//      contrário da pelve (correlação ≤ −0,6);
//  G — guardas: G1 a camada não mexe nos tornozelos (≤ 1 mm) nem nos ossos (≤ 5 mm), 0 NaN e o pé plantado desenhado
//      ≤ 0,05 m/s;  G2 a mão por tick com a camada ≤ a sem ela + 1 cm (cortejo e cenas, a mesma locomoção);  G3 parado com
//      a fase 0 (os treinadores no jogo, a fila montada) a camada não muda nada;  G4 custo ≤ 3 µs por boneco;
//  S — as cenas (a mesma locomoção num mundo à parte): S1 intervalo (o funil para o túnel) e fim de jogo: pares a ≤ 2,5 m
//      no mesmo pé ≤ 25%;  S2 braço × perna oposta ≥ +0,5 (mediana dos atores andando, os gestos de cada cena por cima) no
//      intervalo, no fim, na substituição e no cartão.
// Na base (7cb052ad: sem marcha.js) reprova C1–C7, B1–B5 e S1–S2. --sem-cenas: só C, B e G (~5 s).
//   node tools/teste-marcha.mjs [--js <pasta js>] [--sem-cenas]
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';
import { criarMedidor, serie, ampRobusta, correl, rCircular, pct, difFase } from './lib/marcha-medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const RAIZ = path.resolve(pastaJs, '..');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
const SEM_CENAS = args.includes('--sem-cenas');

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const f1 = v => fmt(v, 1), f2 = v => fmt(v, 2), pc = v => `${fmt(100 * v, 1)}%`;

const A = await imp('anim.js');
const { pose, J, NJ, SEGMENTOS } = A;
const { PASSO } = await imp('config.js');
const P = await imp('partida.js');
const CJ = await imp('cortejo.js');
let MA = null;
try { MA = await imp('marcha.js'); } catch (e) { MA = null; }
const ES = await imp('render/esqueleto.js');
const CD = await imp('render/corpo-dados.js');
const indice = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets/jogador/corpo.json'), 'utf8'));
const buf = fs.readFileSync(path.join(RAIZ, 'assets/jogador/corpo.bin'));
const E = ES.criarEsqueleto(CD.lerCorpo(indice, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)).repouso);
const M = criarMedidor(J);
// os ossos que a camada não pode esticar (as linhas dos ombros e dos quadris giram: não são ossos)
const OSSOS = SEGMENTOS.filter(([a, b]) => !(a === J.ombroE && b === J.ombroD) && !(a === J.quadrilE && b === J.quadrilD));
const dist3 = (o, a, b) => Math.hypot(o[a * 3] - o[b * 3], o[a * 3 + 1] - o[b * 3 + 1], o[a * 3 + 2] - o[b * 3 + 2]);
const dif3 = (o, q, i) => Math.hypot(o[i * 3] - q[i * 3], o[i * 3 + 1] - q[i * 3 + 1], o[i * 3 + 2] - q[i * 3 + 2]);

// chegadas na fila na base 7cb052ad (semente 7; a mesma para os dois times, pela posição k na coluna) e a dos árbitros
const CHEGADA_BASE = [38.98, 39.32, 39.65, 40.02, 40.35, 40.70, 41.03, 41.40, 41.77, 42.17, 42.43];
const CHEGADA_ARB_BASE = 29.27;

/** Séries de um andante no regime (manequim e corpo novo). */
function novoRegistro() {
  return { v: [], cad: [], bE: [], bD: [], cE: [], cD: [], kE: [], kD: [], q: [], o: [], nbE: [], nbD: [], ncE: [], ncD: [] };
}
const _PS = new Float64Array(NJ * 3), _D = new Float64Array(NJ * 3), _ins = {};
function registrar(r, Pd, j, v, df, corpo) {
  const ins = M.instante(Pd, j.rumo, _ins);
  r.v.push(v); r.cad.push(df);
  r.bE.push(ins.bracoE); r.bD.push(ins.bracoD); r.cE.push(ins.cotE); r.cD.push(ins.cotD);
  r.kE.push(ins.coxaE); r.kD.push(ins.coxaD); r.q.push(ins.quadril); r.o.push(ins.ombro);
  if (corpo) {
    E.postura(Pd, v, 1, _PS);
    E.juntasDesenho(_PS, _D);
    const n = M.instante(_D, j.rumo, _ins);
    r.nbE.push(n.bracoE); r.nbD.push(n.bracoD); r.ncE.push(n.cotE); r.ncD.push(n.cotD);
  }
}
/** Medidas de um andante (séries do regime). */
function medidas(r) {
  const exc = xs => pct(xs, 0.95) - pct(xs, 0.05);
  return {
    v: pct(r.v, 0.5), cad: pct(r.cad, 0.5),
    braco: (ampRobusta(r.bE) + ampRobusta(r.bD)) / 2,
    coord: (correl(r.bE, r.kD) + correl(r.bD, r.kE)) / 2,
    cot: (exc(r.cE) + exc(r.cD)) / 2,
    dobra: (correl(r.cE, r.bE) + correl(r.cD, r.bD)) / 2,
    pelve: ampRobusta(r.q), pelveCoxa: correl(r.q, r.kD),
    torax: ampRobusta(r.o), toraxPelve: correl(r.o, r.q),
    nbraco: r.nbE.length ? (ampRobusta(r.nbE) + ampRobusta(r.nbD)) / 2 : NaN,
    ncoord: r.nbE.length ? (correl(r.nbE, r.kD) + correl(r.nbD, r.kE)) / 2 : NaN,
    ncot: r.ncE.length ? (exc(r.ncE) + exc(r.ncD)) / 2 : NaN,
  };
}

// ================================================================================================ C, B, G: o cortejo
{
  const m = P.criarPartida({ semente: 7 });
  const c = CJ.criarCortejo(m.times);
  const N = c.andantes.length;
  const desenha = CJ.poseAndante ? (a, o) => CJ.poseAndante(c, a, o) : (a, o) => pose(a.j, c.mini, o);
  const Pd = new Float32Array(NJ * 3), P0 = new Float32Array(NJ * 3);
  const reg0 = c.andantes.map(() => novoRegistro());
  const st = c.andantes.map(a => ({ fase: a.j.fase, ini: null, pelMin: Infinity, t90: null, primeiro: null, ant: null, ant0: null, pl: [null, null], torn: null }));
  const instantes = [];
  let nan = 0, maxTorn = 0, maxOsso = 0, maxPlant = 0, maoCom = 0, maoSem = 0;
  const vel = CJ.CORTEJO.vel;
  for (let i = 0; i < 50 / PASSO; i++) {
    const apoioAntes = c.andantes.map(a => [a.j.pes[0].apoio, a.j.pes[1].apoio]);
    CJ.passoCortejo(c);
    const t = c.tick * PASSO;
    const fs_ = [];
    c.andantes.forEach((a, k) => {
      const j = a.j, s = st[k], v = Math.hypot(j.vx, j.vz);
      const df = (j.fase - s.fase) / PASSO;
      s.fase = j.fase;
      if (s.ini == null && v > 0.2) s.ini = t;
      if (s.primeiro == null) for (let p = 0; p < 2; p++) if (apoioAntes[k][p] && !j.pes[p].apoio && s.primeiro == null) s.primeiro = p;
      desenha(a, Pd);
      pose(j, c.mini, P0);
      for (let q = 0; q < Pd.length; q++) if (!Number.isFinite(Pd[q])) { nan++; break; }
      maxTorn = Math.max(maxTorn, dif3(Pd, P0, J.tornozeloE), dif3(Pd, P0, J.tornozeloD));
      for (const [ia, ib] of OSSOS) maxOsso = Math.max(maxOsso, Math.abs(dist3(Pd, ia, ib) - dist3(P0, ia, ib)));
      // pé plantado (no mesmo ponto) no desenho: o tornozelo parado
      for (let p = 0; p < 2; p++) {
        const it = p ? J.tornozeloD : J.tornozeloE, chave = j.pes[p].apoio ? `${j.pes[p].x},${j.pes[p].z}` : null;
        if (s.torn && chave && chave === s.pl[p]) maxPlant = Math.max(maxPlant, Math.hypot(Pd[it * 3] - s.torn[p * 3], Pd[it * 3 + 1] - s.torn[p * 3 + 1], Pd[it * 3 + 2] - s.torn[p * 3 + 2]) / PASSO);
        s.pl[p] = chave;
      }
      s.torn = [Pd[J.tornozeloE * 3], Pd[J.tornozeloE * 3 + 1], Pd[J.tornozeloE * 3 + 2], Pd[J.tornozeloD * 3], Pd[J.tornozeloD * 3 + 1], Pd[J.tornozeloD * 3 + 2]];
      // a mão por tick, com e sem a camada (a mesma locomoção)
      if (s.ant) for (const im of [J.maoE, J.maoD]) { maoCom = Math.max(maoCom, dif3(Pd, s.ant, im)); maoSem = Math.max(maoSem, dif3(P0, s.ant0, im)); }
      s.ant = Float32Array.from(Pd); s.ant0 = Float32Array.from(P0);
      // a saída do parado
      if (s.ini != null && t - s.ini <= 2) s.pelMin = Math.min(s.pelMin, Pd[J.pelve * 3 + 1]);
      if (s.ini != null && s.t90 == null && v >= 0.9 * vel) s.t90 = t - s.ini;
      if (v >= 1.2 && v <= 2.2 && a.chegou == null) {
        registrar(reg0[k], Pd, j, v, df, true);
        fs_.push({ k, fase: j.fase, x: j.x, z: j.z });
      }
    });
    if (fs_.length >= 6 && i % 6 === 0) instantes.push(fs_);
  }

  // ---- C1–C5: as fases
  let ladoN = 0, ladoIg = 0, pertoN = 0, pertoIg = 0;
  const Rarb = [], dviz = [];
  for (const fs_ of instantes) {
    const arb = fs_.filter(o => c.andantes[o.k].arb);
    if (arb.length >= 2) Rarb.push(rCircular(arb.map(o => Math.PI * ((((o.fase % 2) + 2) % 2)))));
    const porK = new Map();
    for (const o of fs_) {
      const a = c.andantes[o.k];
      if (a.arb) continue;
      if (!porK.has(a.k)) porK.set(a.k, {});
      porK.get(a.k)[a.time] = o.fase;
      const viz = fs_.find(q => !c.andantes[q.k].arb && c.andantes[q.k].time === a.time && c.andantes[q.k].k === a.k + 1);
      if (viz) dviz.push((((o.fase - viz.fase) % 2) + 2) % 2);
    }
    for (const [, p] of porK) if (p[0] != null && p[1] != null) { ladoN++; if (difFase(p[0], p[1]) < 0.05) ladoIg++; }
    for (let i = 0; i < fs_.length; i++) for (let q = i + 1; q < fs_.length; q++) {
      if (Math.hypot(fs_[i].x - fs_[q].x, fs_[i].z - fs_[q].z) > 2.5) continue;
      pertoN++;
      if (difFase(fs_[i].fase, fs_[q].fase) < 0.1) pertoIg++;
    }
  }
  const lado = ladoIg / Math.max(1, ladoN), perto = pertoIg / Math.max(1, pertoN), rArb = pct(Rarb, 0.5), sViz = serie(dviz);
  reg('C1 Cortejo: pares lado a lado (k do mandante × k do visitante) no mesmo pé', `${pc(lado)} das amostras (${ladoIg}/${ladoN})`, '≤ 25%', lado <= 0.25);
  reg('C2 Cortejo: os 3 árbitros — R da passada (mediana no tempo)', f2(rArb), '≤ 0,85 (1 = juntos)', rArb <= 0.85);
  reg('C3 Cortejo: vizinhos na coluna — desvio do Δfase', `${fmt(sViz.dp, 3)} passo (Δ médio ${fmt(sViz.med, 2)})`, '≥ 0,2 (não uma onda fixa)', sViz.dp >= 0.2);
  reg('C4 Cortejo: pares a ≤ 2,5 m no mesmo pé (|Δ| < 0,1 passo)', `${pc(perto)} (${pertoIg}/${pertoN}; ao acaso 10%)`, '≤ 20%', perto <= 0.2);
  const pe0 = st.filter(s => s.primeiro === 0).length, pe1 = st.filter(s => s.primeiro === 1).length;
  reg('C5 Cortejo: o 1º pé que sai (E / D)', `${pe0} / ${pe1} de ${N}`, 'cada lado ≥ 30%', pe0 >= 0.3 * N && pe1 >= 0.3 * N);

  // ---- C6: cadência e passo de cada um
  const meds = reg0.map(r => (r.v.length >= 120 ? medidas(r) : null)).filter(Boolean);
  const cads = meds.map(o => o.cad), passos = meds.map(o => o.v / o.cad), sc = serie(cads);
  const cv = 100 * sc.dp / sc.med;
  reg('C6 Cortejo: cadência por jogador (desvio entre jogadores; faixa) e o passo', `CV ${fmt(cv, 1)}%; ${f2(sc.min)}–${f2(sc.max)} passos/s; passo ${f2(Math.min(...passos))}–${f2(Math.max(...passos))} m (${meds.length} jogadores)`,
    'CV 3–8%; 1,7–2,2; 0,62–0,82 m', cv >= 3 && cv <= 8 && sc.min >= 1.7 && sc.max <= 2.2 && Math.min(...passos) >= 0.62 && Math.max(...passos) <= 0.82);

  // ---- C7: a saída do parado
  const pelMin = Math.min(...st.map(s => s.pelMin)), t90 = pct(st.map(s => s.t90 ?? 99), 0.5);
  reg('C7 Cortejo: a saída do parado — pelve mínima nos 2 s depois de sair; tempo até 90% da velocidade (mediana)', `${fmt(pelMin, 3)} m; ${f2(t90)} s`, '≥ 0,82 m; ≥ 1,2 s', pelMin >= 0.82 && t90 >= 1.2);

  // ---- C8: as chegadas na fila
  let dTimes = 0, dArb = -Infinity, ultimo = 0;
  for (const a of c.andantes) {
    ultimo = Math.max(ultimo, a.chegou ?? 99);
    if (a.arb) dArb = Math.max(dArb, (a.chegou ?? 99) - CHEGADA_ARB_BASE);
    else dTimes = Math.max(dTimes, Math.abs((a.chegou ?? 99) - CHEGADA_BASE[a.k]));
  }
  reg('C8 Cortejo: as chegadas na fila no mesmo tempo (o roteiro não atrasa)', `times ±${f2(dTimes)} s da base; árbitros +${f2(dArb)} s; o último aos ${f2(ultimo)} s`,
    'times ≤ 0,1 s; árbitros ≤ +1,1 s', dTimes <= 0.1 && dArb <= 1.1);

  // ---- B: braço e tronco nos dois corpos
  const md = k => pct(meds.map(o => o[k]), 0.5);
  const braco = md('braco'), nbraco = md('nbraco'), cvBraco = 100 * serie(meds.map(o => o.braco)).dp / serie(meds.map(o => o.braco)).med;
  reg('B1 Braço oposto à perna do mesmo lado: correlação braço × coxa oposta (manequim / corpo novo)', `${f2(md('coord'))} / ${f2(md('ncoord'))}`, '≥ +0,7 nos dois', md('coord') >= 0.7 && md('ncoord') >= 0.7);
  reg('B2 Amplitude do braço (manequim / corpo novo) e o desvio entre jogadores', `±${f1(braco)}° / ±${f1(nbraco)}°; CV ${f1(cvBraco)}%`, '±8–18° nos dois; ≥ 10%',
    braco >= 8 && braco <= 18 && nbraco >= 8 && nbraco <= 18 && cvBraco >= 10);
  reg('B3 Cotovelo: excursão (manequim / corpo novo) e mais dobrado à frente (manequim)', `${f1(md('cot'))}° / ${f1(md('ncot'))}°; correlação ${f2(md('dobra'))}`, '≥ 12° nos dois; ≥ +0,5',
    md('cot') >= 12 && md('ncot') >= 12 && md('dobra') >= 0.5);
  reg('B4 Pelve: rotação com a perna da frente', `±${f1(md('pelve'))}°; correlação com a coxa D ${f2(md('pelveCoxa'))}`, '±3–6°; ≤ −0,6', md('pelve') >= 3 && md('pelve') <= 6 && md('pelveCoxa') <= -0.6);
  reg('B5 Tórax: rotação ao contrário da pelve', `±${f1(md('torax'))}°; correlação com a pelve ${f2(md('toraxPelve'))}`, '±2–5°; ≤ −0,6', md('torax') >= 2 && md('torax') <= 5 && md('toraxPelve') <= -0.6);

  // ---- G
  reg('G1 Camada: tornozelos, ossos, NaN e o pé plantado desenhado (cortejo, 25 × 50 s)', `tornozelo ${fmt(maxTorn * 1000, 2)} mm; osso ${fmt(maxOsso * 1000, 2)} mm; ${nan} NaN; pé ${fmt(maxPlant, 4)} m/s`,
    '≤ 1 mm; ≤ 5 mm; 0; ≤ 0,05 m/s', maxTorn <= 0.001 && maxOsso <= 0.005 && nan === 0 && maxPlant <= 0.05);
  reg('G2 Cortejo: a mão por tick com a camada × sem ela (a mesma locomoção)', `${fmt(maoCom * 100, 2)} × ${fmt(maoSem * 100, 2)} cm`, '≤ sem + 1 cm', maoCom <= maoSem + 0.01);
  if (MA) {
    // G3: parado com a fase 0 (criarJogador) a camada não muda nada; G4: custo
    const mz = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 } }, jogadores: [] };
    const { criarJogador } = await imp('jogador.js');
    let dMax = 0;
    for (const id of [210, 211, 7, 105]) {
      const j = criarJogador(id, 3, -38, -Math.PI / 2, {}, 0);
      j.posicao = 'MEI';
      pose(j, mz, P0); Pd.set(P0);
      MA.marchar(Pd, j, MA.parametrosMarcha(id), 1);
      for (let q = 0; q < Pd.length; q++) dMax = Math.max(dMax, Math.abs(Pd[q] - P0[q]));
    }
    reg('G3 Parado com a fase 0 (treinadores no jogo, a fila montada): a camada não muda nada', `${fmt(dMax * 1000, 4)} mm`, '≤ 0,001 mm', dMax <= 1e-6);
    const aMed = c.andantes[3];
    const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
    let melhor = Infinity;
    const jj = structuredClone(aMed.j);
    jj.vx = 1.45 * Math.cos(jj.rumo); jj.vz = 1.45 * Math.sin(jj.rumo); jj.fase = 0.37;
    pose(jj, c.mini, P0);
    for (let r = 0; r < 3; r++) {
      const c0 = cpu();
      for (let q = 0; q < 20000; q++) { Pd.set(P0); jj.fase = 0.37 + q * 1e-4; MA.marchar(Pd, jj, aMed.mp ?? MA.parametrosMarcha(aMed.id), 1); }
      melhor = Math.min(melhor, (cpu() - c0) / 20000 * 1000);
    }
    reg('G4 Custo da camada por boneco (Node, CPU do fio, melhor de 3)', `${fmt(melhor, 2)} µs`, '≤ 3 µs', melhor <= 3);
  } else {
    reg('G3/G4 A camada (js/marcha.js)', 'não existe', 'existe', false);
  }
}

// ================================================================================================ S: as cenas
if (!SEM_CENAS) {
  const C = await imp('config.js');
  const { CAMPO, BOLA } = C;
  const CF = await imp('cena-fim.js');
  const CC = await imp('cena-cartao.js');
  const SU = await imp('substituicao.js');
  const TEC = await imp('tecnicos.js');
  const EL = await imp('elenco.js');
  const LC = await import(pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname), 'lib/cenas-node.mjs')).href);
  const L = await LC.carregarCenas(pastaJs);

  /**
   * Anda uma cena (passo() → false/acabou) registrando quem anda (0,9–2,4 m/s) COM O BRAÇO LIVRE — o desenho dele é a pose
   * da locomoção (+ a camada, com marcha.js): sem gesto da cena por cima (palmas, cumprimento, cartão, mãos na cabeça) — e os
   * pares a ≤ 2,5 m; e a mão por tick de todos (em ordem: as duas rodadas, com e sem a camada, andam igual).
   */
  const _Pl = new Float32Array(NJ * 3);
  function medirCena(c, passo, atores, acabou, maxTicks) {
    const R = new Map(), estado = new Map(), saltos = [];
    let pertoN = 0, pertoIg = 0;
    for (let k = 0; k < maxTicks && !acabou(); k++) {
      if (passo() === false) break;
      const fs_ = [];
      for (const a of atores()) {
        if (a.ativo === false || !a.j) continue;
        const j = a.j, v = Math.hypot(j.vx, j.vz);
        let e = estado.get(a.id);
        if (!e) { e = { fase: j.fase, ant: null }; estado.set(a.id, e); }
        const df = (j.fase - e.fase) / PASSO;
        e.fase = j.fase;
        // a mão por tick (o tick da elipse — o ator recriado noutro lugar — entra como corte)
        const cortou = a.recriado != null && a.recriado === c.k;
        if (e.ant) { let d = 0; for (const im of [J.maoE, J.maoD]) d = Math.max(d, dif3(a.atu, e.ant, im)); saltos.push(cortou ? -1 : d); }
        e.ant = Float32Array.from(a.atu);
        // (depois da rampa de entrada da camada, 0,4 s, e andando PARA A FRENTE — de lado e de costas o balanço é outro;
        // nas duas versões)
        const vFrente = j.vx * Math.cos(j.rumo) + j.vz * Math.sin(j.rumo);
        if (v < 0.9 || v > 2.4 || !(df > 0.3) || !c.mF || c.k * PASSO < 0.4 || vFrente < 0.9 * v) continue;
        // o braço livre: o desenho = a pose da locomoção (+ a camada)
        pose(j, c.mF, _Pl);
        if (MA) MA.marchar(_Pl, j, a.mp ?? MA.parametrosMarcha(a.id), MA.rampaMarcha(c.k * PASSO), a.vm ?? null);
        if (Math.max(dif3(a.atu, _Pl, J.maoE), dif3(a.atu, _Pl, J.maoD), dif3(a.atu, _Pl, J.cotoveloE), dif3(a.atu, _Pl, J.cotoveloD)) > 0.01) continue;
        let r = R.get(a.id);
        if (!r) R.set(a.id, r = novoRegistro());
        registrar(r, a.atu, j, v, df, false);
        fs_.push({ fase: j.fase, x: j.x, z: j.z });
      }
      for (let i = 0; i < fs_.length; i++) for (let q = i + 1; q < fs_.length; q++) {
        if (Math.hypot(fs_[i].x - fs_[q].x, fs_[i].z - fs_[q].z) > 2.5) continue;
        pertoN++;
        if (difFase(fs_[i].fase, fs_[q].fase) < 0.1) pertoIg++;
      }
    }
    const coords = [...R.values()].filter(r => r.v.length >= 30).map(r => (correl(r.bE, r.kD) + correl(r.bD, r.kE)) / 2);
    return { pertoN, pertoIg, coords, saltos };
  }
  /** Roda a montagem com a camada ligada e (com marcha.js) desligada: a mesma locomoção, a mão por tick das duas. */
  function comESem(montar) {
    const com = montar();
    let sem = null;
    if (MA) { MA.MARCHA.ligada = false; try { sem = montar(); } finally { MA.MARCHA.ligada = true; } }
    return { com, sem };
  }
  function juntar(lista) {
    const o = { pertoN: 0, pertoIg: 0, coords: [], saltos: [] };
    for (const x of lista) { if (!x) continue; o.pertoN += x.pertoN; o.pertoIg += x.pertoIg; for (const v of x.coords) o.coords.push(v); for (const v of x.saltos) o.saltos.push(v); }
    return o;
  }
  /**
   * A mão por tick, com × sem a camada, nos mesmos ticks (a locomoção é a mesma): o maior de cada, fora dos cortes (a
   * elipse, ou a mão a > 30 cm num tick sem a camada: um plano novo, 18 m/s não é gesto).
   */
  function saltosMao(com, sem) {
    let mc = 0, ms = 0;
    const n = Math.min(com.length, sem.length);
    for (let i = 0; i < n; i++) {
      if (com[i] < 0 || sem[i] < 0 || sem[i] > 0.3) continue;
      mc = Math.max(mc, com[i]); ms = Math.max(ms, sem[i]);
    }
    return { mc, ms, igual: com.length === sem.length };
  }

  // ---- intervalo e fim de jogo
  const fins = { intervalo: [], fimDeJogo: [] }, finsSem = { intervalo: [], fimDeJogo: [] };
  for (const [tipo, sems] of [['intervalo', [301, 302, 303]], ['fimDeJogo', [401, 402]]]) {
    for (const sem of sems) {
      const x = tipo === 'intervalo' ? LC.ateIntervalo(L, sem, { min: 0.5 }) : LC.ateFim(L, sem, { min: 0.5 });
      if (!x) continue;
      const r = comESem(() => {
        const plano = CF.planejarFim(structuredClone(x.m), tipo, { placar: x.m.placar, timeHumano: 0, lances: 0, treinadores: null });
        const c = CF.criarCenaFim(plano, structuredClone(x.m));
        return medirCena(c, () => CF.passoCenaFim(c), () => c.atores, () => c.acabou, 6000);
      });
      fins[tipo].push(r.com); finsSem[tipo].push(r.sem);
    }
  }
  // ---- substituição (a lateral com 3 trocas; o mesmo roteiro do medir-cenas da auditoria)
  const MZ = CAMPO.meioZ;
  const emJogo = m => m.partida.estado === 'jogo' && !m.parada && m.naMao == null && !m.voo;
  function edicao(m, t, n) {
    const st = m.times[t], el = EL.ELENCOS[st.elenco];
    const emCampo = new Set(Object.values(st.vagas));
    const gk = st.vagas.GOL;
    const linha = [...emCampo].filter(id => id !== gk && m.jogadores.some(j => j.id === id)).sort((a, b) => a - b);
    const res = el.jogadores.filter(j => !emCampo.has(j.id) && !st.saiu.includes(j.id) && j.pos !== 'GOL').map(j => j.id);
    const subs = linha.slice(0, n).map(id => ({ sai: id, entra: res.shift() }));
    const vagas = { ...st.vagas };
    for (const p of subs) { const v = Object.keys(vagas).find(k => vagas[k] === p.sai); vagas[v] = p.entra; }
    return { tipo: 'editarTime', time: t, base: st.versao, formacao: st.formacao, vagas, substituicoes: subs, tatica: { ...st.tatica } };
  }
  const subst = [], substSem = [];
  for (const s of [3, 5, 7]) {
    const m = P.criarPartida({ semente: s });
    for (let i = 0; i < 1500 || !emJogo(m); i++) { P.passoPartida(m, P.entradaDemoPartida(m), null); if (i > 4000) break; }
    P.passoPartida(m, P.entradaDemoPartida(m), [edicao(m, 0, 2), edicao(m, 1, 1)]);
    const b = m.bola, ult = 1;
    const jj = m.jogadores.find(o => o.time === ult && o.posicao !== 'GOL');
    m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo';
    Object.assign(b.p, { x: Math.max(-44, Math.min(44, b.p.x)), y: BOLA.raio, z: (b.p.z >= 0 ? 1 : -1) * (MZ + 0.5) }); Object.assign(b.v, { x: 0, y: 0, z: 0 });
    m.partida.ultimoTime = ult; m.partida.ultimoId = jj.id; m.partida.ultimoTick = m.tick; m.ultimoToque = { id: jj.id, time: ult, tick: m.tick };
    let antes = new Map(), subs = null;
    for (let i = 0; i < 700 && !subs; i++) {
      antes = new Map(m.jogadores.map(j => [j.id, { x: j.x, z: j.z }]));
      const q = P.passoPartida(m, P.entradaDemoPartida(m), null).filter(e => e.tipo === 'substituicao');
      if (q.length) subs = q;
    }
    if (!subs) continue;
    const r = comESem(() => {
      const mm = structuredClone(m);
      const c = SU.criarCenaSubst(SU.planejarSubstituicao(mm, subs, { timeHumano: 0, posAntes: id => antes.get(id) ?? null }), mm);
      return medirCena(c, () => SU.passoCenaSubst(c), () => c.atores, () => c.acabou, 6000);
    });
    subst.push(r.com); substSem.push(r.sem);
  }
  // ---- cartão (amarelo e vermelho em 2 estados do meio)
  const cartao = [], cartaoSem = [];
  for (const [sem, tk] of [[3, 900], [13, 1900]]) {
    const base = LC.estadoDoMeio(L, sem, tk);
    for (const sit of ['amarelo', 'vermelho']) {
      const ev = LC.forcarCartao(L, structuredClone(base), sit);
      if (!ev) continue;
      const T = TEC.criarTecnicos(ev.m.times, ev.m.semente ?? 1);
      const Ld = TEC.leituraDoMundo(ev.m, []);
      for (let k = 0; k < 360; k++) TEC.passoTecnicos(T, Ld);
      const trein = [TEC.treinadorDoTime(T, 0), TEC.treinadorDoTime(T, 1)];
      const r = comESem(() => {
        const mm = structuredClone(ev.m);
        const c = CC.criarCenaCartao(CC.planejarCartao(mm, CC.escolherCartao(ev.eventos), { treinadores: trein }), mm);
        return medirCena(c, () => CC.passoCenaCartao(c), () => c.atores, () => c.acabou, 4000);
      });
      cartao.push(r.com); cartaoSem.push(r.sem);
    }
  }

  const cenas = [['intervalo', fins.intervalo, finsSem.intervalo], ['fim de jogo', fins.fimDeJogo, finsSem.fimDeJogo], ['substituição', subst, substSem], ['cartão', cartao, cartaoSem]];
  for (const [nome, com, sem] of cenas) {
    const x = juntar(com), y = MA ? juntar(sem) : null;
    const perto = x.pertoIg / Math.max(1, x.pertoN), coord = pct(x.coords, 0.5);
    if (nome === 'intervalo' || nome === 'fim de jogo') {
      reg(`S1 ${nome}: pares a ≤ 2,5 m no mesmo pé (|Δ| < 0,1 passo)`, `${pc(perto)} (${x.pertoIg}/${x.pertoN}; ${com.length} cenas)`, '≤ 25%', perto <= 0.25 && x.pertoN > 0);
    }
    reg(`S2 ${nome}: braço × perna oposta (mediana de ${x.coords.length} atores andando com o braço livre)`, f2(coord), '≥ +0,5', coord >= 0.5 && x.coords.length > 0);
    if (y) {
      const g = saltosMao(x.saltos, y.saltos);
      reg(`G2 ${nome}: a mão por tick com a camada × sem ela (fora dos cortes)`, `${fmt(g.mc * 100, 2)} × ${fmt(g.ms * 100, 2)} cm${g.igual ? '' : ' (as rodadas andaram diferente!)'}`, '≤ sem + 1 cm', g.mc <= g.ms + 0.01 && g.igual);
    }
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-marcha: REPROVOU (${falhas})` : '\nteste-marcha: PASSOU');
process.exit(falhas ? 1 : 0);
