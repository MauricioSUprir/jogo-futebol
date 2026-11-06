// Passada natural de quem anda FORA da partida (item 61 da FILA; dono, 23/10, com print: no túnel e na fila "parecem que
// estão marchando, parecendo NPC"; js/marcha.js, js/cortejo.js, js/cena-atores.js, js/substituicao.js, js/tecnicos.js e a
// comemoração pelo main.js — marcha.js avancarComMarcha). Mede na pose DESENHADA (o manequim: cortejo.js poseAndante / a.atu
// das cenas) e no CORPO NOVO (render/esqueleto.js postura + juntasDesenho, o que o humano3d.js desenha), contra a pesquisa
// (as fontes no cabeçalho do js/marcha.js):
//  C — o cortejo do pré-jogo (semente 7, 50 s; regime = andando 1,2–2,2 m/s antes da vaga):
//   C0 pares lado a lado nos 3 s depois de os dois saírem no mesmo pé (|Δfase| < 0,1 passo) ≤ 30% (a fase inicial de cada
//      um: sem ela, o k-ésimo do mandante e o do visitante saem juntos e só o ritmo os separa, devagar);
//   C1 pares lado a lado (o k-ésimo do mandante × o do visitante) no mesmo pé (|Δfase| < 0,05 passo) ≤ 25% das amostras
//      (casais lado a lado sincronizam em ~1/3 das caminhadas, nunca travados — Zivotofsky & Hausdorff 2007);
//   C2 os 3 árbitros: R da passada (mediana no tempo) ≤ 0,85;  C3 vizinhos na coluna: o Δfase com desvio ≥ 0,2 passo (não
//      uma onda fixa);  C4 pares a ≤ 2,5 m no mesmo pé (|Δ| < 0,1 passo) ≤ 20% (ao acaso 10%);  C5 o 1º pé: cada lado ≥ 30%;
//   C6 cadência por jogador: o desvio entre jogadores 1,5–8%, todas em 1,7–2,2 passos/s e o walk ratio (passo ÷ cadência)
//      de cada um em 0,0054–0,0072 m/(passos/min) — a média da tabela do jogo (0,0063, a de Sekiya 1996) ± 1,5 desvio
//      entre pessoas (~0,0006): o ritmo só ACELERA a passada (jogador.js passoPassada), então quem tem ritmo alto dá passos
//      mais curtos (o walk ratio cai com o quadrado do ritmo; com 1,12 ia a 0,0050, 2 desvios abaixo);
//   C7 a saída do parado: a pelve ≥ 0,82 m nos 2 s depois de sair (no regime ela desce a ~0,85) e ≥ 1,2 s até 90% da
//      velocidade (a mediana; 3–5 passos até o regime);  C8 as chegadas na fila no MESMO tempo (o roteiro do pré-jogo não
//      atrasa): os times a ±0,1 s da base 7cb052ad (CHEGADA_BASE), os árbitros até +0,25 s;
//   C9 o trio de arbitragem na frente das colunas no plano 'entrada' (6–12 s do cortejo): os assistentes ≥ 3,0 m à frente da
//      cabeça de cada coluna (base 3,42 m);  C10 o trio em linha: a diferença ao longo do caminho ≤ 0,3 m (mediana);
//  B — o braço e o tronco (no regime do cortejo), nos DOIS corpos:
//   B1 o braço oposto à perna do mesmo lado: correlação braço E × coxa D (e D × E) no mesmo instante ≥ +0,7 (mediana);
//   B2 a amplitude do braço ±8–18° (mediana; ROM do ombro 20–35°) e o desvio entre jogadores ≥ 10%;
//   B3 o cotovelo: excursão ≥ 12° (ROM ~30 ± 10°, CiSE 2023) e mais dobrado à frente (correlação dobra × braço ≥ +0,5,
//      manequim);  B4 a pelve ±3–6° com a perna da frente (correlação rotação × coxa D ≤ −0,6);  B5 o tórax ±2–5° ao
//      contrário da pelve (correlação ≤ −0,6);  B6 o cotovelo do corpo novo: p5 ≤ 20° e p95 em 40–55° (o real: ~15–20° atrás,
//      ~40–50° à frente; antes, com o ombro do desenho descido e a mão do jogo no lugar, 48–63° a passada inteira);
//  G — guardas: G1 a camada não mexe nos tornozelos (≤ 1 mm) nem nos ossos (≤ 5 mm), 0 NaN e o pé plantado desenhado
//      ≤ 0,05 m/s;  G2 o tranco da mão (a 2ª diferença por tick: um salto de posição dá o tamanho dele, o balanço natural
//      ~0,1 cm/tick²) com a camada ≤ o sem ela + 2,5 cm/tick², POR boneco e por tick, desde o 1º quadro (cortejo e cenas, a
//      mesma locomoção — a 1ª diferença não serve: a mão da camada e a da pose correm em fases diferentes do balanço);  G3 parado com a fase 0 (os treinadores no jogo, a fila montada) a camada não muda
//      nada;  G4 custo ≤ o da pose do jogo (anim.js pose, em blocos alternados: a carga da máquina pesa nas duas; medido
//      ~0,4–0,8 × 1,2 µs com a máquina cheia — a folga cobre o ruído da carga);  G5 a mão
//      ou o antebraço dentro da coxa (raios do manequim): com a camada ≤ sem ela (cortejo, os dois corpos);  G6 na curva
//      (|giro| > 0,5 rad/s) a mão na frente da virilha: com ≤ sem + 0,5 ponto (os dois corpos);  G7 o contrato da `saida` só
//      com o ritmo (jogador.js passoPassada com {ritmoVoo}, sem pe/em: a do cortejo e a das cenas): andando, com o ritmo
//      natural, a passada sai igual BIT A BIT à sem `saida` (com os dois pés no chão também);  G8 a conferência: com o braço
//      fora da passada (o lateral, o seguimento do arremesso, um gesto por cima), a camada não muda nada (≤ 0,1 mm);  G9 a
//      faixa de saída (MARCHA.vSai, a camada virando a pose do jogo): a amplitude do braço não cai no meio dela;
//  T — os treinadores no jogo (passoTecnicos, 150 s): andando para a frente, a pelve gira com a perna da frente (correlação
//      ≤ −0,6) — os braços ficam nas posturas deles (mãos nas costas, cruzados, na cintura: informativo);
//  S — as cenas (a mesma locomoção num mundo à parte): S1 intervalo (o funil para o túnel) e fim de jogo: pares a ≤ 2,5 m
//      no mesmo pé ≤ 25%;  S2 braço × perna oposta ≥ +0,5 (mediana dos atores andando com o braço livre, os gestos de cada
//      cena por cima) no intervalo, no fim, na substituição e no cartão; na substituição também só quem SAI (2,2 ± 0,2 m/s);
//      na comemoração (quase todos com um gesto: o braço livre é de instantes — ~0,5 s nas 4 cenas), ≥ 20 instantes andando
//      com o braço livre E o desenho da camada (sem a camada no passo da página, 0);  S3 o 1º quadro de cada cena com × sem a camada ≤ 0,1 mm (a cena começa na pose do jogo);  S4 a mão
//      ou o antebraço dentro da coxa: com ≤ sem + 0,3 ponto, por cena.
// Na base (7cb052ad: sem marcha.js) reprova C0–C7, B1–B6, G3/G4, T1, S1–S2 (24); na 1ª versão do item 61 (80b0e50d), C6, C8,
// C9, B6, G5, G6, G9, o G2 de 4 cenas, o S4 da substituição e do cartão e o S2 da comemoração (14). --sem-cenas: só C, B, G e
// T (~15 s).
//   node tools/teste-marcha.mjs [--js <pasta js>] [--sem-cenas]
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';
import { criarMedidor, serie, ampRobusta, correl, rCircular, pct, difFase, folgaMaoCoxa, maoNaVirilha } from './lib/marcha-medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const RAIZ = path.resolve(pastaJs, '..');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
const SEM_CENAS = args.includes('--sem-cenas');
const LIB = path.dirname(new URL(import.meta.url).pathname) + '/lib/';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok, info = false) { linhas.push([nome, medido, meta, info ? 'INFO' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; }
const f1 = v => fmt(v, 1), f2 = v => fmt(v, 2), pc = v => `${fmt(100 * v, 1)}%`;

const A = await imp('anim.js');
const { pose, J, NJ, SEGMENTOS } = A;
const C = await imp('config.js');
const { PASSO } = C;
const P = await imp('partida.js');
const CJ = await imp('cortejo.js');
const JG = await imp('jogador.js');
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
const difMax = (o, q) => { let d = 0; for (let i = 0; i < NJ; i++) d = Math.max(d, dif3(o, q, i)); return d; };
const maoTick = (o, q) => Math.max(dif3(o, q, J.maoE), dif3(o, q, J.maoD));
/** O tranco da mão: a maior 2ª diferença (m/tick²) das duas mãos, com as poses o (agora), p (antes) e q (antes de p). */
const tranco = (o, p, q) => { let d = 0; for (const i of [J.maoE, J.maoD]) d = Math.max(d, Math.hypot(o[i * 3] - 2 * p[i * 3] + q[i * 3], o[i * 3 + 1] - 2 * p[i * 3 + 1] + q[i * 3 + 1], o[i * 3 + 2] - 2 * p[i * 3 + 2] + q[i * 3 + 2])); return d; };
/** O corpo novo da pose (a postura e as juntas do desenho do humano3d.js). */
const _PSn = new Float64Array(NJ * 3);
function corpoNovo(Pd, v, out) { E.postura(Pd, v, 1, _PSn); return E.juntasDesenho(_PSn, out); }

// chegadas na fila na base 7cb052ad (semente 7; a mesma para os dois times, pela posição k na coluna) e a dos árbitros
const CHEGADA_BASE = [38.98, 39.32, 39.65, 40.02, 40.35, 40.70, 41.03, 41.40, 41.77, 42.17, 42.43];
const CHEGADA_ARB_BASE = 29.27;

/** Séries de um andante no regime (manequim e corpo novo). */
function novoRegistro() {
  return { v: [], cad: [], bE: [], bD: [], cE: [], cD: [], kE: [], kD: [], q: [], o: [], nbE: [], nbD: [], ncE: [], ncD: [] };
}
const _ins = {};
function registrar(r, Pd, j, v, df, D = null) {
  const ins = M.instante(Pd, j.rumo, _ins);
  r.v.push(v); r.cad.push(df);
  r.bE.push(ins.bracoE); r.bD.push(ins.bracoD); r.cE.push(ins.cotE); r.cD.push(ins.cotD);
  r.kE.push(ins.coxaE); r.kD.push(ins.coxaD); r.q.push(ins.quadril); r.o.push(ins.ombro);
  if (D) {
    const n = M.instante(D, j.rumo, _ins);
    r.nbE.push(n.bracoE); r.nbD.push(n.bracoD); r.ncE.push(n.cotE); r.ncD.push(n.cotD);
  }
}
/** Medidas de um andante (séries do regime). */
function medidas(r) {
  const exc = xs => pct(xs, 0.95) - pct(xs, 0.05);
  const cotN = r.ncE.length ? r.ncE.concat(r.ncD) : [];
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
    ncot5: cotN.length ? pct(cotN, 0.05) : NaN, ncot95: cotN.length ? pct(cotN, 0.95) : NaN,
    cot5: pct(r.cE.concat(r.cD), 0.05), cot50: pct(r.cE.concat(r.cD), 0.5), cot95: pct(r.cE.concat(r.cD), 0.95),
  };
}

// ================================================================================================ C, B, G: o cortejo
{
  const m = P.criarPartida({ semente: 7 });
  const c = CJ.criarCortejo(m.times);
  const N = c.andantes.length;
  const desenha = CJ.poseAndante ? (a, o) => CJ.poseAndante(c, a, o) : (a, o) => pose(a.j, c.mini, o);
  const Pd = new Float32Array(NJ * 3), P0 = new Float32Array(NJ * 3);
  const Dn = new Float64Array(NJ * 3), D0 = new Float64Array(NJ * 3);
  const reg0 = c.andantes.map(() => novoRegistro());
  const st = c.andantes.map(a => ({ fase: a.j.fase, ini: null, pelMin: Infinity, t90: null, primeiro: null, ant: null, ant0: null, ant2: null, ant02: null, pl: [null, null], torn: null }));
  const instantes = [];
  let nan = 0, maxTorn = 0, maxOsso = 0, maxPlant = 0, g2 = -Infinity, g2Max = 0, g2Sem = 0;
  // mão na coxa (andando) e na virilha (na curva), com e sem a camada, nos dois corpos
  const cx = { n: 0, com: 0, sem: 0, comN: 0, semN: 0 }, cv = { n: 0, com: 0, sem: 0, comN: 0, semN: 0 };
  // C0: os pares nos 3 s depois de os dois saírem; C9/C10: o trio no plano 'entrada'
  let c0N = 0, c0Ig = 0;
  const trioFrente = [], trioLinha = [];
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
      // o tranco da mão (2ª diferença), com e sem a camada (a mesma locomoção), POR boneco e por tick
      if (s.ant2) {
        const dc = tranco(Pd, s.ant, s.ant2), ds = tranco(P0, s.ant0, s.ant02);
        if (dc - ds > g2) { g2 = dc - ds; g2Max = dc; g2Sem = ds; }
      }
      s.ant2 = s.ant; s.ant02 = s.ant0;
      s.ant = Float32Array.from(Pd); s.ant0 = Float32Array.from(P0);
      // a saída do parado
      if (s.ini != null && t - s.ini <= 2) s.pelMin = Math.min(s.pelMin, Pd[J.pelve * 3 + 1]);
      if (s.ini != null && s.t90 == null && v >= 0.9 * vel) s.t90 = t - s.ini;
      // a mão na coxa (andando) e na virilha (na curva), nos dois corpos
      const anda = v >= 0.8 && v <= 2.2 && a.chegou == null;
      if (anda) {
        corpoNovo(Pd, v, Dn); corpoNovo(P0, v, D0);
        cx.n++;
        if (folgaMaoCoxa(Pd, J) < 0) cx.com++;
        if (folgaMaoCoxa(P0, J) < 0) cx.sem++;
        if (folgaMaoCoxa(Dn, J) < 0) cx.comN++;
        if (folgaMaoCoxa(D0, J) < 0) cx.semN++;
        if (Math.abs(j.giro) > 0.5) {
          cv.n++;
          if (maoNaVirilha(Pd, J, j.rumo)) cv.com++;
          if (maoNaVirilha(P0, J, j.rumo)) cv.sem++;
          if (maoNaVirilha(Dn, J, j.rumo)) cv.comN++;
          if (maoNaVirilha(D0, J, j.rumo)) cv.semN++;
        }
      }
      if (v >= 1.2 && v <= 2.2 && a.chegou == null) {
        if (!anda) corpoNovo(Pd, v, Dn);
        registrar(reg0[k], Pd, j, v, df, Dn);
        fs_.push({ k, fase: j.fase, x: j.x, z: j.z });
      }
    });
    if (fs_.length >= 6 && i % 6 === 0) instantes.push(fs_);
    // C0: os pares lado a lado nos 3 s depois de os dois saírem
    for (let k = 0; k < N; k++) {
      const a = c.andantes[k];
      if (a.arb || a.time !== 0) continue;
      const k2 = c.andantes.findIndex(b => !b.arb && b.time === 1 && b.k === a.k);
      if (k2 < 0 || st[k].ini == null || st[k2].ini == null) continue;
      if (t - Math.max(st[k].ini, st[k2].ini) > 3) continue;
      c0N++;
      if (difFase(a.j.fase, c.andantes[k2].j.fase) < 0.1) c0Ig++;
    }
    // C9/C10: o trio no plano 'entrada' (6–12 s): os assistentes à frente da cabeça de cada coluna (o caminho anda em z −)
    if (t >= 6 && t <= 12) {
      const arb = c.andantes.filter(a => a.arb), ass = arb.filter(a => a.k > 0), cab = c.andantes.filter(a => !a.arb && a.k === 0);
      let d = Infinity;
      for (const h of cab) for (const q of ass) d = Math.min(d, h.j.z - q.j.z);
      trioFrente.push(d);
      const zs = arb.map(a => a.j.z);
      trioLinha.push(Math.max(...zs) - Math.min(...zs));
    }
  }

  // ---- C0–C5: as fases
  const c0 = c0Ig / Math.max(1, c0N);
  reg('C0 Cortejo: pares lado a lado nos 3 s depois de os dois saírem, no mesmo pé (|Δ| < 0,1 passo)', `${pc(c0)} (${c0Ig}/${c0N}; ao acaso 10%)`, '≤ 30%', c0 <= 0.3 && c0N > 0);
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
  const wr = meds.map(o => o.v / o.cad / (o.cad * 60));
  const cv6 = 100 * sc.dp / sc.med;
  reg('C6 Cortejo: cadência por jogador (desvio entre jogadores; faixa), o passo e o walk ratio de cada um', `CV ${fmt(cv6, 1)}%; ${f2(sc.min)}–${f2(sc.max)} passos/s; passo ${f2(Math.min(...passos))}–${f2(Math.max(...passos))} m; walk ratio ${fmt(Math.min(...wr), 5)}–${fmt(Math.max(...wr), 5)} (${meds.length} jogadores)`,
    'CV 1,5–8%; 1,7–2,2; walk ratio 0,0054–0,0072', cv6 >= 1.5 && cv6 <= 8 && sc.min >= 1.7 && sc.max <= 2.2 && Math.min(...wr) >= 0.0054 && Math.max(...wr) <= 0.0072);

  // ---- C7: a saída do parado
  const pelMin = Math.min(...st.map(s => s.pelMin)), t90 = pct(st.map(s => s.t90 ?? 99), 0.5);
  reg('C7 Cortejo: a saída do parado — pelve mínima nos 2 s depois de sair; tempo até 90% da velocidade (mediana)', `${fmt(pelMin, 3)} m; ${f2(t90)} s`, '≥ 0,82 m; ≥ 1,2 s', pelMin >= 0.82 && t90 >= 1.2);

  // ---- C8–C10: as chegadas na fila e o trio na entrada
  let dTimes = 0, dArb = -Infinity, ultimo = 0;
  for (const a of c.andantes) {
    ultimo = Math.max(ultimo, a.chegou ?? 99);
    if (a.arb) dArb = Math.max(dArb, (a.chegou ?? 99) - CHEGADA_ARB_BASE);
    else dTimes = Math.max(dTimes, Math.abs((a.chegou ?? 99) - CHEGADA_BASE[a.k]));
  }
  reg('C8 Cortejo: as chegadas na fila no mesmo tempo (o roteiro não atrasa)', `times ±${f2(dTimes)} s da base; árbitros ${dArb >= 0 ? '+' : ''}${f2(dArb)} s; o último aos ${f2(ultimo)} s`,
    'times ≤ 0,1 s; árbitros ≤ +0,25 s', dTimes <= 0.1 && dArb <= 0.25);
  const tf = pct(trioFrente, 0.5), tl = pct(trioLinha, 0.5);
  reg('C9 Cortejo: o trio na frente das colunas no plano \'entrada\' (6–12 s): assistentes × cabeça de cada coluna (mediana)', `${f2(tf)} m (mín ${f2(Math.min(...trioFrente))} m; base 3,42)`, '≥ 3,0 m', tf >= 3.0);
  reg('C10 Cortejo: o trio em linha no plano \'entrada\' (a diferença ao longo do caminho, mediana)', `${f2(tl)} m`, '≤ 0,3 m', tl <= 0.3);

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
  reg('B6 Cotovelo do corpo novo: a dobra p5 e p95 (mediana dos jogadores; o manequim p5/p50/p95 ao lado)', `${f1(md('ncot5'))}° / ${f1(md('ncot95'))}° (manequim ${f1(md('cot5'))}/${f1(md('cot50'))}/${f1(md('cot95'))}°)`,
    'p5 ≤ 20°; p95 40–55°', md('ncot5') <= 20 && md('ncot95') >= 40 && md('ncot95') <= 55);

  // ---- G
  reg('G1 Camada: tornozelos, ossos, NaN e o pé plantado desenhado (cortejo, 25 × 50 s)', `tornozelo ${fmt(maxTorn * 1000, 2)} mm; osso ${fmt(maxOsso * 1000, 2)} mm; ${nan} NaN; pé ${fmt(maxPlant, 4)} m/s`,
    '≤ 1 mm; ≤ 5 mm; 0; ≤ 0,05 m/s', maxTorn <= 0.001 && maxOsso <= 0.005 && nan === 0 && maxPlant <= 0.05);
  reg('G2 Cortejo: o tranco da mão (2ª diferença por tick) com a camada × sem ela, por boneco e por tick (a maior diferença)', `+${fmt(g2 * 100, 2)} cm/tick² (${fmt(g2Max * 100, 2)} × ${fmt(g2Sem * 100, 2)})`, '≤ +2,5 cm/tick²', g2 <= 0.025);
  reg('G5 Cortejo: a mão ou o antebraço dentro da coxa, andando (manequim / corpo novo; com × sem a camada)', `${pc(cx.com / cx.n)} × ${pc(cx.sem / cx.n)} / ${pc(cx.comN / cx.n)} × ${pc(cx.semN / cx.n)} (${cx.n} amostras)`,
    'com ≤ sem nos dois', cx.com <= cx.sem && cx.comN <= cx.semN);
  reg('G6 Cortejo: na curva (|giro| > 0,5 rad/s), a mão na frente da virilha (manequim / corpo novo; com × sem)', `${pc(cv.com / cv.n)} × ${pc(cv.sem / cv.n)} / ${pc(cv.comN / cv.n)} × ${pc(cv.semN / cv.n)} (${cv.n} amostras)`,
    'com ≤ sem + 0,5 ponto nos dois', cv.n > 0 && cv.com / cv.n <= cv.sem / cv.n + 0.005 && cv.comN / cv.n <= cv.semN / cv.n + 0.005);
  if (MA) {
    // G3: parado com a fase 0 (criarJogador) a camada não muda nada; G4: custo
    const mz = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 } }, jogadores: [] };
    let dMax = 0;
    for (const id of [210, 211, 7, 105]) {
      const j = JG.criarJogador(id, 3, -38, -Math.PI / 2, {}, 0);
      j.posicao = 'MEI';
      pose(j, mz, P0); Pd.set(P0);
      MA.marchar(Pd, j, MA.parametrosMarcha(id), 1);
      for (let q = 0; q < Pd.length; q++) dMax = Math.max(dMax, Math.abs(Pd[q] - P0[q]));
    }
    reg('G3 Parado com a fase 0 (treinadores no jogo, a fila montada): a camada não muda nada', `${fmt(dMax * 1000, 4)} mm`, '≤ 0,001 mm', dMax <= 1e-6);
    // G4: a camada × a pose do jogo do mesmo boneco, medidas juntas (a carga da máquina pesa nas duas), o melhor de 5
    const aMed = c.andantes[3];
    const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
    let melhorM = Infinity, melhorP = Infinity;
    const jj = structuredClone(aMed.j);
    jj.vx = 1.45 * Math.cos(jj.rumo); jj.vz = 1.45 * Math.sin(jj.rumo); jj.fase = 0.37;
    pose(jj, c.mini, P0);
    const mp = aMed.mp ?? MA.parametrosMarcha(aMed.id);
    // (em blocos alternados — 12 de 10 mil —, o melhor de cada: a carga da máquina pega as duas igual)
    for (let r = 0; r < 12; r++) {
      let c0_ = cpu();
      for (let q = 0; q < 10000; q++) { jj.fase = 0.37 + q * 1e-4; pose(jj, c.mini, Pd); }
      melhorP = Math.min(melhorP, (cpu() - c0_) / 10000 * 1000);
      c0_ = cpu();
      for (let q = 0; q < 10000; q++) { Pd.set(P0); jj.fase = 0.37 + q * 1e-4; MA.marchar(Pd, jj, mp, 1); }
      melhorM = Math.min(melhorM, (cpu() - c0_) / 10000 * 1000);
    }
    reg('G4 Custo da camada por boneco × o da pose do jogo (Node, CPU do fio, o melhor de 12 blocos alternados)', `${fmt(melhorM, 2)} µs × ${fmt(melhorP, 2)} µs (${fmt(100 * melhorM / melhorP, 0)}%)`, '≤ o da pose (a camada não dobra o desenho)', melhorM <= melhorP);
  } else {
    reg('G3/G4 A camada (js/marcha.js)', 'não existe', 'existe', false);
  }
}

// ================================================================================================ G7, G8: contratos da camada
{
  // G7: a `saida` só com o ritmo ({ritmoVoo}, sem pe/em; cortejo.js e cena-atores.js) — andando, com o ritmo natural, a
  // passada sai igual bit a bit à sem `saida`; com os dois pés no chão também (lá o jogador.js trata `saida` como `pedido`:
  // sem `pe`, nada pode acontecer). Uma refatoração do jogador.js que mude isso reprova aqui.
  const mz = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 }, v: { x: 0, y: 0, z: 0 } }, jogadores: [] };
  let n = 0, nDois = 0, dif = 0, primeiro = null;
  for (const [id, vel] of [[7, 1.0], [105, 1.45], [200, 1.8]]) {
    const j = JG.criarJogador(id, 0, 0, 0, {}, 0);
    j.posicao = 'MEI';
    mz.jogadores = [j];
    for (let t = 0; t < 240; t++) {
      JG.passoCorpo(j, 1, 0, Math.min(vel, 0.2 + t * 0.03), 0, j.par, PASSO, false);
      const v = Math.hypot(j.vx, j.vz);
      if (v > 0.5 && v < 1.9) {
        const a = structuredClone(j), b = structuredClone(j);
        JG.passoPassada(a, false, PASSO, null, { ritmoVoo: JG.freqPassada(v, false) });
        JG.passoPassada(b, false, PASSO, null, null);
        n++;
        if (j.pes[0].apoio && j.pes[1].apoio) nDois++;
        if (JSON.stringify(a) !== JSON.stringify(b)) { dif++; primeiro ??= `id ${id} t ${t}`; }
      }
      JG.passoPassada(j, false, PASSO, null, null);
      JG.passoPeDesenhado(j, mz, PASSO);
      mz.tick++;
      j.quadril = A.alturaQuadril(j, mz);
    }
  }
  reg('G7 Contrato: passoPassada com {ritmoVoo} (o ritmo natural, sem pe/em) × sem `saida`, andando', `${dif} diferentes de ${n} (${nDois} com os dois pés no chão)${primeiro ? `; 1º: ${primeiro}` : ''}`,
    '0 (≥ 20 com os dois pés no chão)', dif === 0 && nDois >= 20);
}
if (MA) {
  // G8: com o braço fora da passada, a camada não muda nada (a conferência: o lateral, o seguimento do arremesso, um gesto
  // da cena por cima — a comemoração aplica a camada DEPOIS dos gestos)
  const CMm = await imp('comemoracao.js');
  const P0 = new Float32Array(NJ * 3), Pd = new Float32Array(NJ * 3);
  let pior = 0;
  const casos = [];
  for (const caso of ['lateral', 'segue', 'cintura', 'ceu']) {
    const j = JG.criarJogador(9, 0, 0, 0.3, {}, 0);
    j.posicao = 'MEI';
    const m = { tick: 100, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0.2, y: 2.1, z: 0 }, v: { x: 0, y: 0, z: 0 } }, jogadores: [j] };
    j.vx = 1.4 * Math.cos(j.rumo); j.vz = 1.4 * Math.sin(j.rumo); j.fase = 0.63;
    if (caso === 'lateral') m.parada = { tipo: 'lateral', rolou: false, cobrador: j.id };
    if (caso === 'segue') j.arremesso = { tick: 95, rumo: j.rumo };
    pose(j, m, P0);
    if (caso === 'cintura') { CMm.gesto(P0, j.rumo, -1, CMm.G_CINTURA, CMm.G_CINTURA, 0, 1); CMm.gesto(P0, j.rumo, 1, CMm.G_CINTURA, CMm.G_CINTURA, 0, 1); }
    if (caso === 'ceu') { CMm.gesto(P0, j.rumo, -1, CMm.G_CEU, CMm.G_CEU, 0, 1); CMm.gesto(P0, j.rumo, 1, CMm.G_CEU, CMm.G_CEU, 0, 1); }
    Pd.set(P0);
    MA.marchar(Pd, j, MA.parametrosMarcha(j.id), 1);
    const d = difMax(Pd, P0);
    pior = Math.max(pior, d);
    casos.push(`${caso} ${fmt(d * 1000, 3)} mm`);
  }
  reg('G8 Conferência: o braço fora da passada (lateral, seguimento do arremesso, mãos na cintura, braços para o céu) — a camada não muda nada', casos.join('; '), '≤ 0,1 mm em todos', pior <= 1e-4);
}

if (MA) {
  // G9: a faixa de saída (a camada → a pose do jogo, MARCHA.vSai): a velocidade fixa, um ciclo da fase, a amplitude do braço
  // (manequim) — sem cancelamento: em nenhuma velocidade da faixa ela cai abaixo da menor das duas pontas (misturar dois
  // balanços 1/4 de ciclo fora um do outro a encolhia no meio: a revisão R7). Os pés parados (só o braço e a fase importam).
  const mz = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 } }, jogadores: [] };
  const Pz = new Float32Array(NJ * 3), oz = {}, [v0, v1] = MA.MARCHA.vSai;
  const amps = [];
  for (let v = v0 - 0.4; v <= v1 + 0.4 + 1e-9; v += 0.05) {
    const j = JG.criarJogador(105, 0, 0, 0, {}, 0);
    j.posicao = 'MEI'; j.vx = v; j.vz = 0;
    const mp = MA.parametrosMarcha(105), bs = [];
    for (let f = 0; f < 2; f += 0.02) { j.fase = 10 + f; pose(j, mz, Pz); MA.marchar(Pz, j, mp, 1); M.instante(Pz, 0, oz); bs.push(oz.bracoD); }
    amps.push({ v, a: (Math.max(...bs) - Math.min(...bs)) / 2 });
  }
  const pontas = Math.min(amps[0].a, amps[amps.length - 1].a), pior = amps.reduce((x, y) => (y.a < x.a ? y : x));
  reg('G9 A faixa de saída (a camada vira a pose do jogo): a amplitude do braço não cai no meio (sem cancelamento)', `mínima ±${f1(pior.a)}° a ${f2(pior.v)} m/s; pontas ±${f1(amps[0].a)}° / ±${f1(amps[amps.length - 1].a)}° (faixa ${f2(v0)}–${f2(v1)} m/s)`,
    '≥ 97% da menor ponta', pior.a >= 0.97 * pontas);
}

// ================================================================================================ T: os treinadores no jogo
{
  const TEC = await imp('tecnicos.js');
  const LC = await import(pathToFileURL(LIB + 'cenas-node.mjs').href);
  const L = await LC.carregarCenas(pastaJs);
  const base = LC.estadoDoMeio(L, 3, 900);
  /** 150 s dos treinadores com o mundo de agora; séries de quem anda para a frente (0,6–2,0 m/s). */
  function rodarTec() {
    const T = TEC.criarTecnicos(base.times, 3);
    const Ld = TEC.leituraDoMundo(base, []);
    const r = novoRegistro(), ant = new Map();
    for (let k = 0; k < 9000; k++) {
      TEC.passoTecnicos(T, Ld);
      for (const tc of T.tecs) {
        const j = tc.j, v = Math.hypot(j.vx, j.vz), vf = j.vx * Math.cos(j.rumo) + j.vz * Math.sin(j.rumo);
        const df = (j.fase - (ant.get(tc.id) ?? j.fase)) / PASSO;
        ant.set(tc.id, j.fase);
        if (v >= 0.6 && v <= 2.0 && vf >= 0.9 * v && df > 0.3) registrar(r, tc.atu, j, v, df);
      }
    }
    return r;
  }
  const com = rodarTec();
  let sem = null;
  if (MA) { MA.MARCHA.ligada = false; try { sem = rodarTec(); } finally { MA.MARCHA.ligada = true; } }
  const mc = medidas(com), ms = sem ? medidas(sem) : null;
  reg('T1 Treinadores no jogo, andando para a frente: a pelve gira com a perna da frente (com × sem a camada)', `±${f1(mc.pelve)}°, correlação ${f2(mc.pelveCoxa)}${ms ? ` × ±${f1(ms.pelve)}°, ${f2(ms.pelveCoxa)}` : ''} (${com.v.length} amostras)`,
    '≤ −0,6 com a camada (≥ 200 amostras)', mc.pelveCoxa <= -0.6 && com.v.length >= 200);
  reg('T2 Treinadores: o braço × a perna oposta (as posturas por cima: mãos nas costas, cruzados, na cintura)', `${f2(mc.coord)}${ms ? ` × ${f2(ms.coord)} sem` : ''}; amplitude ±${f1(mc.braco)}°`, 'informativo (os braços são das posturas)', true, true);
}

// ================================================================================================ S: as cenas
if (!SEM_CENAS) {
  const { CAMPO, BOLA } = C;
  const CF = await imp('cena-fim.js');
  const CC = await imp('cena-cartao.js');
  const SU = await imp('substituicao.js');
  const TEC = await imp('tecnicos.js');
  const EL = await imp('elenco.js');
  const CM = await imp('comemoracao.js');
  const LC = await import(pathToFileURL(LIB + 'cenas-node.mjs').href);
  const L = await LC.carregarCenas(pastaJs);
  const GN = await import(pathToFileURL(LIB + 'gol-node.mjs').href);
  const LG = await GN.carregarNode(pastaJs);

  /**
   * Anda uma cena (passo() → false/acabou) registrando quem anda (0,9–2,4 m/s) COM O BRAÇO LIVRE — o desenho dele é a pose
   * da locomoção (+ a camada, com marcha.js): sem gesto da cena por cima (palmas, cumprimento, cartão, mãos na cabeça) — e os
   * pares a ≤ 2,5 m; a mão por tick de cada ator DESDE O 1º QUADRO (em ordem: as duas rodadas, com e sem a camada, andam
   * igual); o 1º quadro de todos; a mão na coxa de quem anda. sai(a): o ator que sai na substituição (S2 só dele).
   */
  const _Pl = new Float32Array(NJ * 3);
  function medirCena(c, passo, atores, acabou, maxTicks, sai = null, minN = 30) {
    const R = new Map(), Rs = new Map(), estado = new Map(), saltos = [];
    const primeiro = new Map();
    for (const a of atores()) if (a.j && a.atu) { primeiro.set(a.id, Float32Array.from(a.atu)); estado.set(a.id, { fase: a.j.fase, ant: Float32Array.from(a.atu), ant2: null }); }
    let pertoN = 0, pertoIg = 0, coxaN = 0, coxa = 0;
    for (let k = 0; k < maxTicks && !acabou(); k++) {
      if (passo() === false) break;
      const fs_ = [];
      for (const a of atores()) {
        if (a.ativo === false || !a.j) continue;
        const j = a.j, v = Math.hypot(j.vx, j.vz);
        let e = estado.get(a.id);
        if (!e) { e = { fase: j.fase, ant: null, ant2: null }; estado.set(a.id, e); }
        const df = (j.fase - e.fase) / PASSO;
        e.fase = j.fase;
        // o tranco da mão (o tick da elipse — o ator recriado noutro lugar — e o seguinte entram como corte; a mão a > 30 cm
        // num tick: um plano novo)
        const cortou = a.recriado != null && (a.recriado === c.k || a.recriado === c.k - 1);
        const d1 = e.ant ? maoTick(a.atu, e.ant) : Infinity;
        saltos.push(e.ant2 && !cortou && d1 <= 0.3 && e.d1 <= 0.3 ? tranco(a.atu, e.ant, e.ant2) : -1);
        e.d1 = d1; e.ant2 = e.ant; e.ant = Float32Array.from(a.atu);
        if (v >= 0.8 && v <= 2.4) { coxaN++; if (folgaMaoCoxa(a.atu, J) < 0) coxa++; }
        // (depois da rampa de entrada da camada, MARCHA.rampa s, e andando PARA A FRENTE — de lado e de costas o balanço é outro;
        // nas duas versões)
        const vFrente = j.vx * Math.cos(j.rumo) + j.vz * Math.sin(j.rumo);
        if (v < 0.9 || v > 2.4 || !(df > 0.3) || !c.mF || c.k * PASSO < (MA ? MA.MARCHA.rampa : 0.4) || vFrente < 0.9 * v) continue;
        // o braço livre: o desenho = a pose da locomoção (+ a camada)
        pose(j, c.mF, _Pl);
        if (MA) MA.marchar(_Pl, j, a.mp ?? MA.parametrosMarcha(a.id), MA.rampaMarcha(c.k * PASSO), a.vm ?? null);
        if (Math.max(dif3(a.atu, _Pl, J.maoE), dif3(a.atu, _Pl, J.maoD), dif3(a.atu, _Pl, J.cotoveloE), dif3(a.atu, _Pl, J.cotoveloD)) > 0.01) continue;
        let r = R.get(a.id);
        if (!r) R.set(a.id, r = novoRegistro());
        registrar(r, a.atu, j, v, df);
        if (sai && sai(a)) { let q = Rs.get(a.id); if (!q) Rs.set(a.id, q = novoRegistro()); registrar(q, a.atu, j, v, df); }
        fs_.push({ fase: j.fase, x: j.x, z: j.z });
      }
      for (let i = 0; i < fs_.length; i++) for (let q = i + 1; q < fs_.length; q++) {
        if (Math.hypot(fs_[i].x - fs_[q].x, fs_[i].z - fs_[q].z) > 2.5) continue;
        pertoN++;
        if (difFase(fs_[i].fase, fs_[q].fase) < 0.1) pertoIg++;
      }
    }
    const coordDe = mp => [...mp.values()].filter(r => r.v.length >= minN).map(r => (correl(r.bE, r.kD) + correl(r.bD, r.kE)) / 2);
    return { pertoN, pertoIg, coords: coordDe(R), coordsSai: coordDe(Rs), saltos, primeiro, coxaN, coxa, livres: [...R.values()].reduce((n, r) => n + r.v.length, 0) };
  }
  /** Roda a montagem com a camada ligada e (com marcha.js) desligada: a mesma locomoção, a mão por tick das duas. */
  function comESem(montar) {
    const com = montar();
    let sem = null;
    if (MA) { MA.MARCHA.ligada = false; try { sem = montar(); } finally { MA.MARCHA.ligada = true; } }
    return { com, sem };
  }
  function juntar(lista) {
    const o = { pertoN: 0, pertoIg: 0, coords: [], coordsSai: [], saltos: [], primeiros: [], coxaN: 0, coxa: 0, livres: 0 };
    for (const x of lista) {
      if (!x) continue;
      o.pertoN += x.pertoN; o.pertoIg += x.pertoIg; o.coxaN += x.coxaN; o.coxa += x.coxa; o.livres += x.livres;
      for (const v of x.coords) o.coords.push(v);
      for (const v of x.coordsSai) o.coordsSai.push(v);
      o.saltos.push(x.saltos); o.primeiros.push(x.primeiro);
    }
    return o;
  }
  /**
   * O tranco da mão, com × sem a camada, no MESMO ator e tick (a locomoção é a mesma), desde o 1º quadro: a maior diferença,
   * fora dos cortes.
   */
  function saltosMao(com, sem) {
    let pior = -Infinity, mc = 0, ms = 0, igual = com.length === sem.length;
    for (let q = 0; q < Math.min(com.length, sem.length); q++) {
      const a = com[q], b = sem[q];
      if (a.length !== b.length) igual = false;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] < 0 || b[i] < 0) continue;
        if (a[i] - b[i] > pior) { pior = a[i] - b[i]; mc = a[i]; ms = b[i]; }
      }
    }
    return { pior, mc, ms, igual };
  }
  /** O 1º quadro de cada ator, com × sem a camada: a maior diferença. */
  function primeiroQuadro(com, sem) {
    let d = 0;
    for (let q = 0; q < Math.min(com.length, sem.length); q++) for (const [id, f] of com[q]) { const g = sem[q].get(id); if (g) d = Math.max(d, difMax(f, g)); }
    return d;
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
      const idsSai = new Set(c.sai.map(a => a.id));
      return medirCena(c, () => SU.passoCenaSubst(c), () => c.atores, () => c.acabou, 6000, a => idsSai.has(a.id));
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
  // ---- comemoração (comemoracao.js é do fecho do hash: a camada entra DEPOIS de cada passo da cena, pela mesma função que
  // a página usa — marcha.js avancarComMarcha; sem ela, o passo da cena puro)
  const comem = [], comemSem = [];
  const gols = [GN.golRoteirizadoNode(LG, { semente: 5, time: 0 }), GN.golRoteirizadoNode(LG, { semente: 7, time: 1 }), GN.golNaturalNode(LG, 9, 6000), GN.golNaturalNode(LG, 13, 6000)].filter(Boolean);
  for (const g of gols) {
    const r = comESem(() => {
      const mm = structuredClone(g.m);
      const c = CM.criarCena(CM.planejarComemoracao(mm, g.gol, { timeHumano: 0 }), mm);
      const passo = MA && MA.avancarComMarcha ? () => MA.avancarComMarcha(c, PASSO, CM.passoCena) > 0 : () => CM.passoCena(c);
      // (na comemoração quase todos andam com um gesto — o punho no ar, as mãos na cintura ou na cabeça — e o braço livre é
      // de poucos instantes: 12 amostras por ator)
      return medirCena(c, passo, () => c.atores, () => c.acabou, 2400, null, 12);
    });
    comem.push(r.com); comemSem.push(r.sem);
  }

  const cenas = [['intervalo', fins.intervalo, finsSem.intervalo], ['fim de jogo', fins.fimDeJogo, finsSem.fimDeJogo], ['substituição', subst, substSem], ['cartão', cartao, cartaoSem], ['comemoração', comem, comemSem]];
  for (const [nome, com, sem] of cenas) {
    const x = juntar(com), y = MA ? juntar(sem) : null;
    const perto = x.pertoIg / Math.max(1, x.pertoN), coord = pct(x.coords, 0.5);
    if (nome === 'intervalo' || nome === 'fim de jogo') {
      reg(`S1 ${nome}: pares a ≤ 2,5 m no mesmo pé (|Δ| < 0,1 passo)`, `${pc(perto)} (${x.pertoIg}/${x.pertoN}; ${com.length} cenas)`, '≤ 25%', perto <= 0.25 && x.pertoN > 0);
    }
    if (nome === 'comemoração') {
      // (na comemoração quase todos andam com um gesto — o punho no ar, as mãos na cintura ou na cabeça —: o braço livre é de
      // instantes curtos, e a correlação de 0,2 s não mede nada. Aqui a camada vem DEPOIS dos gestos — marcha.js
      // avancarComMarcha —: conta-se quantos instantes andando com o braço livre têm o desenho da camada)
      reg(`S2 ${nome}: instantes andando com o braço livre e o desenho da camada (${com.length} cenas); braço × perna oposta informativo`, `${x.livres} (${(x.livres * PASSO).toFixed(1)} s); ${f2(coord)} em ${x.coords.length} atores`, '≥ 20 (sem a camada: 0)', x.livres >= 20);
    } else reg(`S2 ${nome}: braço × perna oposta (mediana de ${x.coords.length} atores andando com o braço livre; ${com.length} cenas)`, f2(coord), '≥ +0,5', coord >= 0.5 && x.coords.length > 0);
    if (nome === 'substituição') {
      const cs = pct(x.coordsSai, 0.5);
      reg('S2 substituição, só quem SAI (2,2 ± 0,2 m/s)', `${f2(cs)} (${x.coordsSai.length} atores)`, '≥ +0,7', cs >= 0.7 && x.coordsSai.length > 0);
    }
    if (y) {
      const pq = primeiroQuadro(x.primeiros, y.primeiros);
      reg(`S3 ${nome}: o 1º quadro com × sem a camada (todos os atores)`, `${fmt(pq * 1000, 3)} mm`, '≤ 0,1 mm', pq <= 1e-4);
      const g = saltosMao(x.saltos, y.saltos);
      reg(`G2 ${nome}: o tranco da mão com × sem a camada, por ator e por tick, desde o 1º quadro (a maior diferença)`, `+${fmt(g.pior * 100, 2)} cm/tick² (${fmt(g.mc * 100, 2)} × ${fmt(g.ms * 100, 2)})${g.igual ? '' : ' (as rodadas andaram diferente!)'}`, '≤ +2,5 cm/tick²', g.pior <= 0.025 && g.igual);
      const cc = x.coxa / Math.max(1, x.coxaN), cs = y.coxa / Math.max(1, y.coxaN);
      reg(`S4 ${nome}: a mão ou o antebraço dentro da coxa (andando 0,8–2,4 m/s; com × sem a camada)`, `${pc(cc)} × ${pc(cs)} (${x.coxaN} amostras)`, 'com ≤ sem + 0,3 ponto', cc <= cs + 0.003);
    }
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-marcha: REPROVOU (${falhas})` : '\nteste-marcha: PASSOU');
process.exit(falhas ? 1 : 0);
