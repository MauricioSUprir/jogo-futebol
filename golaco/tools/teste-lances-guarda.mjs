// O GUARDADOR DE LANCES (cenas das paradas, PR 3: o intervalo e o fim tocam os lances da partida inteira; PLANO-CENAS.md
// §4.2 e §4.6, R9, R20; contrato "Cenas das paradas" §7.3): render/lances-guarda.js — a cópia comprimida do anel do replay
// (30 Hz, pose em Int16 relativa ao jogador a 1/4000 m) para LANCES_GUARDA.lances vagas fixas e o mini-anel de tocar
// (60 Hz, os passos do meio interpolados).
//   G1 memória: os bytes do guardador e do mini-anel iguais antes e depois de guardar e tocar 100 lances (as mesmas
//      memórias); nada alocado em guardar nem em tocar (o heap, com gc, não cresce);
//   G2 quantização: erro ≤ 2 mm por junta e ≤ 1 mm na bola nos quadros guardados, em todos os lances das partidas; nenhuma
//      junta saturada no pior caso medido em TODOS os passos das partidas (mergulho do goleiro, cabeceio: o maior |junta −
//      x/z do jogador| e o y ≤ 8,19 m);
//   G3 tocar: o lerQuadro do mini-anel = o do anel original no mesmo tick nos quadros guardados (≤ 2 mm; os mesmos jogadores
//      em todo tick); a bola e o relógio exatos em TODO tick (guardados a 60 Hz: ≤ 1 mm); os jogadores dos ticks do meio = a
//      interpolação dos dois vizinhos do anel (≤ 2 mm: a conta 30 → 60 está certa) e a PERDA dos 30 Hz contra o anel por
//      junta: mediana ≤ 1 cm e p95 ≤ 2 cm (o próprio desenho tem movimento de 1 passo — o pé que planta, o chute: medido no
//      anel, o ponto do meio fica a ~1,7 mm da média dos vizinhos na mediana e a ~16 mm no p95 —, então o "≤ 1 cm" do plano
//      vale na mediana; o pior fica na tabela); e as batidas da rede da janela no mini.ondas (os mesmos t0);
//   G4 prioridade: o gol nunca sai por uma parada; cheio, sai o de menor peso; o mais antigo desempata; o novo de menor peso
//      que todos fica de fora; a mesma parada só troca por uma mais forte; e a escolha para as cenas (escolherLances: os gols
//      do tempo primeiro, na ordem do jogo, depois a parada mais forte; o teto de lances e de segundos; a ordem do jogo);
//   G5 custo (CPU do processo): guardar ≤ 2 ms e tocar ≤ 6 ms (mediana; a janela inteira de 6 s);
//   G6 janelas: em 24 partidas IA × IA (metade com os replays desligados: "Replays: Desligado"), TODO gol fica guardado (só
//      outro gol o tira); toda parada A/B classificada chega ao ponto de guardar (o passo antes da montagem ou o fim do tempo);
//      a guardada tem a janela inteira até o desfecho + 0,5 s (ou o ateMax do expulso; no fim do tempo, até o fim do anel
//      daquele instante), a chave dentro e nenhum corte dentro dela.
//      Sem janela só a parada com a chave mais velha que o anel (o cartão da falta com vantagem longa, Regra 12.3).
// Na versão sem o guardador reprova (render/lances-guarda.js não existe).
//   node tools/teste-lances-guarda.mjs [--js <pasta da lógica>] [--n 24] [--sem0 1] [--par 4]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : String(v));

/**
 * Erros de um tick entre duas leituras (lerQuadro de `a` e de `b`): o pior de junta (m, a maior diferença de coordenada) e de
 * bola e se os jogadores são os mesmos; com `hist`, cada junta (distância 3D) entra no histograma (0,1 mm por casa).
 */
function compararTick(RA, a, b, t, la, lb, ba, bb, qa, qb, hist = null) {
  const na = RA.lerQuadro(a, t, la, ba, qa), nb = RA.lerQuadro(b, t, lb, bb, qb);
  let junta = 0, mesmos = na === nb && na > 0;
  for (const ia of la) {
    const ib = lb.find(q => q.id === ia.id);
    if (!ib) { mesmos = false; continue; }
    for (let k = 0; k < ia.pose.length; k += 3) {
      const dx = ia.pose[k] - ib.pose[k], dy = ia.pose[k + 1] - ib.pose[k + 1], dz = ia.pose[k + 2] - ib.pose[k + 2];
      junta = Math.max(junta, Math.abs(dx), Math.abs(dy), Math.abs(dz));
      if (hist) hist[Math.min(hist.length - 1, Math.floor(Math.hypot(dx, dy, dz) * 1e4))]++;
    }
    junta = Math.max(junta, Math.abs(ia.x - ib.x), Math.abs(ia.z - ib.z));
  }
  const bola = Math.hypot(ba.x - bb.x, ba.y - bb.y, ba.z - bb.z);
  return { junta, bola, mesmos };
}
/** O meio de dois quadros do anel (t − 1 e t + 1) contra o tick t do mini-anel: o pior de junta (m). */
function contraMeio(RA, a, mini, t, l0, l1, lm, b0, b1, bm, q0, q1, qm) {
  RA.lerQuadro(a, t - 1, l0, b0, q0); RA.lerQuadro(a, t + 1, l1, b1, q1); RA.lerQuadro(mini, t, lm, bm, qm);
  let junta = 0;
  for (const im of lm) {
    const i0 = l0.find(q => q.id === im.id), i1 = l1.find(q => q.id === im.id);
    if (!i0 || !i1) continue;
    for (let k = 0; k < im.pose.length; k++) junta = Math.max(junta, Math.abs(im.pose[k] - (i0.pose[k] + i1.pose[k]) / 2));
  }
  return { junta };
}
/** O quantil q (0–1) de um histograma de casas de 0,1 mm, em m. */
function quantilHist(h, q) {
  let n = 0;
  for (const c of h) n += c;
  if (!n) return 0;
  let acc = 0;
  for (let i = 0; i < h.length; i++) { acc += h[i]; if (acc >= q * n) return (i + 1) / 1e4; }
  return h.length / 1e4;
}

// ------------------------------------------------------------------ o filho: uma semente
if (args.includes('--filho')) {
  const { criarSimGuarda } = await import(pathToFileURL(path.join(AQUI, 'lib/guarda-node.mjs')).href);
  const GN = await criarSimGuarda(JS);
  const RA = await imp('render/replay-anel.js');
  const { REDE } = GN.RO;
  const s = +arg('--s', 1), ligado = arg('--ligado', '1') === '1';
  const S = GN.novaPartida(s, { ligado });
  const out = { s, ligado, gols: [], paradas: [], classificados: 0, chegaram: 0, g2: { junta: 0, bola: 0 },
    g3: { exato: 0, nMeio: 0, interpJunta: 0, bolaMeio: 0, tempo: 0, perdaMax: 0, hist: null, ruins: [], bat: [] },
    pior: 0, piorOnde: null, golsFora: [], ticks: 0, saturou: 0, chaveFora: 0 };
  const la = [], lb = [], ba = { x: 0, y: 0, z: 0 }, bb = { x: 0, y: 0, z: 0 }, qa = { x: 0, y: 0, z: 0, w: 1 }, qb = { x: 0, y: 0, z: 0, w: 1 };
  const l0 = [], l1 = [], lm = [], b0 = { x: 0, y: 0, z: 0 }, b1 = { x: 0, y: 0, z: 0 }, bm = { x: 0, y: 0, z: 0 };
  const q0 = { x: 0, y: 0, z: 0, w: 1 }, q1 = { x: 0, y: 0, z: 0, w: 1 }, qm = { x: 0, y: 0, z: 0, w: 1 };
  const hist = new Float64Array(1001);   // a perda por junta nos ticks do meio: 0,1 mm por casa até 10 cm (a última: além)
  const golSeq = [];   // a seq do guardador de cada gol guardado
  const A = S.a, K = A.K, P = A.P;
  for (let i = 0; i < 40000 && S.m.partida.estado !== 'fim'; i++) {
    const r = GN.passo(S);
    if (r.lance) out.classificados++;
    // o pior caso de TODOS os passos (G2): o maior |junta − x/z| (e o y) no passo gravado agora
    const sl = A.slot(A.ultimo);
    if (sl >= 0) for (let v = 0; v < A.nVagas[sl]; v++) {
      const ii = sl * A.vagas + v;
      if (A.ids[ii] < 0) continue;
      const o = ii * K, x = A.dados[o + P], z = A.dados[o + P + 1];
      for (let j = 0; j < P; j += 3) {
        const m = Math.max(Math.abs(A.dados[o + j] - x), Math.abs(A.dados[o + j + 1]), Math.abs(A.dados[o + j + 2] - z));
        if (m > out.pior) { out.pior = m; out.piorOnde = { tick: A.ultimo, id: A.ids[ii], goleiro: (A.info[ii] & 2) !== 0, junta: j / 3 }; }
      }
    }
    for (const g of r.guardou) {
      const l = g.lance, jan = g.jan, falhas = [];
      const fimL = Math.max(l.chave, l.fim ?? l.chave);
      if (g.quando === 'parada') out.chegaram++;
      // a falta com vantagem longa: o cartão sai na parada seguinte (Regra 12.3) com a chave mais velha que o anel —
      // sem janela e sem guardar é o certo; sem janela com a chave DENTRO do anel é defeito
      const chaveFora = g.quando === 'parada' && l.chave < g.anel.primeiro;
      if (!jan) { if (chaveFora) out.chaveFora++; else falhas.push('sem janela'); }
      else if (chaveFora) falhas.push(`janela com a chave ${l.chave} antes do anel ${g.anel.primeiro}`);
      else {
        // G6: a janela inteira, a chave dentro, nenhum corte dentro
        const alvo = Math.min(fimL + 30, l.ateMax ?? Infinity);
        const ateEsperado = g.pred === 'fimDoTempo' ? Math.min(alvo, g.anel.ultimo) : alvo;
        if (g.quando === 'parada' && jan.ate !== ateEsperado) {
          const c = A.primeiroCorte(fimL + 1, ateEsperado);
          falhas.push(`janela até ${jan.ate}, esperado ${ateEsperado}${c != null ? ' (corte ' + c + ')' : ''}`);
        }
        if (g.quando === 'gol' && !(jan.de <= fimL && jan.ate === fimL + 30)) falhas.push(`gol: janela [${jan.de}, ${jan.ate}] sem o gol ${fimL} + 0,5 s`);
        if (g.quando === 'parada' && jan.de > l.chave) falhas.push(`chave ${l.chave} antes da janela ${jan.de}`);
        const cd = A.primeiroCorte(jan.de + 1, jan.ate);
        if (cd != null) falhas.push(`corte ${cd} dentro de [${jan.de}, ${jan.ate}]`);
      }
      if (g.quando === 'gol') { out.gols.push({ tick: l.fim, k: g.k, falhas, tempo: l.tempo }); if (g.k >= 0) golSeq.push(S.G.metas[g.k].seq); }
      else out.paradas.push({ tick: g.tick, tipo: l.tipo, classe: l.classe, k: g.k, pred: g.pred, falhas });
      // G2/G3: tocar e comparar com o anel tick a tick
      if (g.k >= 0 && jan) {
        const mt = GN.LG.tocar(S.G, g.k, S.mini);
        for (let t = jan.de; t <= jan.ate; t++) {
          const meio = (t - jan.de) % S.G.pq !== 0;
          const c = compararTick(RA, A, S.mini, t, la, lb, ba, bb, qa, qb, meio ? hist : null);
          if (!c.mesmos && out.g3.ruins.length < 5) out.g3.ruins.push(`s${s} t${t}: outros jogadores`);
          // o relógio do estádio de todo tick (a rede do replay balança por ele)
          out.g3.tempo = Math.max(out.g3.tempo, Math.abs(RA.tempoEstadio(A, t) - RA.tempoEstadio(S.mini, t)));
          if (!meio) { out.g2.junta = Math.max(out.g2.junta, c.junta); out.g2.bola = Math.max(out.g2.bola, c.bola); out.g3.exato++; continue; }
          // o meio: a bola exata, os jogadores = a interpolação dos vizinhos (a conta) e a perda dos 30 Hz (contra o anel)
          const im = contraMeio(RA, A, S.mini, t, l0, l1, lm, b0, b1, bm, q0, q1, qm);
          out.g3.interpJunta = Math.max(out.g3.interpJunta, im.junta); out.g3.bolaMeio = Math.max(out.g3.bolaMeio, c.bola);
          out.g3.perdaMax = Math.max(out.g3.perdaMax, c.junta); out.g3.nMeio++;
        }
        if (S.mini.primeiro !== jan.de || S.mini.ultimo !== jan.ate) out.g3.ruins.push(`s${s}: mini [${S.mini.primeiro}, ${S.mini.ultimo}] ≠ janela [${jan.de}, ${jan.ate}]`);
        // as batidas da rede da janela (as que balançam nela) no mini.ondas
        const t0 = A.tEst[A.slot(jan.de)] - REDE.duracao, t1 = A.tEst[A.slot(jan.ate)];
        const esper = S.bat.filter(b => b.ativo && b.t0 >= t0 && b.t0 <= t1).map(b => b.t0).sort((x, y) => y - x).slice(0, REDE.maxImpactos).sort((x, y) => x - y);
        const got = S.mini.ondas.imp.filter(q => q.ativo).map(q => q.t0).sort((x, y) => x - y);
        if (esper.length || got.length) out.g3.bat.push({ tipo: l.tipo, esper: esper.length, got: got.length, igual: esper.length === got.length && esper.every((v, q) => Math.abs(v - got[q]) < 1e-9), nBat: mt.nBat });
      }
    }
    out.ticks++;
  }
  // todo gol guardado ainda está lá (só outro gol o tira)
  const vivos = new Set(S.G.metas.filter(q => q.ocupado).map(q => q.seq));
  const golsNoFim = S.G.metas.filter(q => q.ocupado && q.tipo === 'gol').length;
  for (const sq of golSeq) if (!vivos.has(sq) && golsNoFim < S.G.L) out.golsFora.push(sq);
  out.saturou = S.G.saturou;
  out.g3.hist = Array.from(hist);
  process.send(out);
  process.exit(0);
}

// ------------------------------------------------------------------ o pai
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const fimTeste = () => { console.log(tabelaTexto(linhas)); console.log(`\nteste-lances-guarda: ${falhas ? 'REPROVOU' : 'PASSOU'}`); process.exit(falhas ? 1 : 0); };

const temModulo = fs.existsSync(path.join(JS, 'render/lances-guarda.js'));
if (!temModulo) {
  for (const k of ['G1 memória', 'G2 quantização', 'G3 tocar', 'G4 prioridade', 'G5 custo', 'G6 janelas'])
    reg(k, 'render/lances-guarda.js não existe nesta versão', 'existe', false);
  fimTeste();
}

const LG = await imp('render/lances-guarda.js');
const { LANCES_GUARDA } = await imp('cenas-config.js');
const RA = await imp('render/replay-anel.js');
const { criarSimGuarda } = await import(pathToFileURL(path.join(AQUI, 'lib/guarda-node.mjs')).href);
const GN = await criarSimGuarda(JS);

// um anel de verdade (a partida IA × IA gravada como a página) para G1, G4 e G5
const S0p = GN.novaPartida(3, { ligado: false });
for (let i = 0; i < 1500; i++) GN.passo(S0p);
const anelR = S0p.a;
const lanceEm = (chave, o = {}) => ({ tipo: 'faltaPerto', classe: 'B', peso: 3, chave, fim: chave, morta: chave + 1, lado: 1, time: 0, ids: [1, 2], x: 30, z: 0, tempo: 1, ...o });
const meio = anelR.ultimo - 300;

// G1: memória fixa e nada alocado
{
  v8.setFlagsFromString('--expose_gc');
  const gc = vm.runInNewContext('gc');
  const G = LG.criarGuarda(LANCES_GUARDA, { vagas: anelR.vagas, nj: GN.NJ }), mini = LG.criarMini(G);
  const refs = [G.pose, G.xzr, G.ids, G.bola, mini.dados, mini.bola, mini.ids];
  const b0 = G.bytes + mini.bytes;
  const rodar = n => {
    for (let i = 0; i < n; i++) {
      const c = meio - 150 + (i * 7) % 250;
      const k = LG.guardar(G, anelR, lanceEm(c, { peso: 1 + (i % 7), morta: c + 1 + i }), S0p.bat);
      if (k >= 0) LG.tocar(G, k, mini);
    }
  };
  rodar(40);   // aquece o JIT
  gc(); gc();
  const h0 = process.memoryUsage().heapUsed;
  rodar(100);
  gc(); gc();
  const h1 = process.memoryUsage().heapUsed;
  const b1 = G.bytes + mini.bytes;
  const mesmas = refs.every((r, i) => r === [G.pose, G.xzr, G.ids, G.bola, mini.dados, mini.bola, mini.ids][i]);
  const dh = (h1 - h0) / 1024;
  reg('G1 memória fixa: os bytes e as memórias iguais depois de 100 guardar + tocar; o heap não cresce',
    `guardador ${fmt(G.bytes / 1048576)} MB + mini-anel ${fmt(mini.bytes / 1048576)} MB = ${fmt(b0 / 1048576)} MB; depois ${fmt(b1 / 1048576)} MB, ${mesmas ? 'as mesmas memórias' : 'memórias trocadas'}; heap ${dh >= 0 ? '+' : ''}${fmt(dh, 1)} KB`,
    'iguais; heap < 64 KB', b0 === b1 && mesmas && dh < 64);
}

// G4: prioridade (o anel de verdade; janelas de 3 s)
{
  const G = LG.criarGuarda(LANCES_GUARDA, { vagas: anelR.vagas, nj: GN.NJ });
  const ruins = [];
  let m = 0;
  const g = (peso, tipo = peso >= LG.PESO_GOL ? 'gol' : 'faltaPerto', o = {}) => LG.guardar(G, anelR, lanceEm(meio, { peso, tipo, classe: tipo === 'gol' ? 'gol' : 'B', morta: ++m * 10, ...o }));
  const pesos = () => G.metas.filter(q => q.ocupado).map(q => q.peso).sort((a, b) => a - b).join(',');
  // 4 gols e 2 paradas (1 e 2)
  for (let i = 0; i < 4; i++) g(LG.PESO_GOL);
  g(1); g(2);
  if (pesos() !== `1,2,${LG.PESO_GOL},${LG.PESO_GOL},${LG.PESO_GOL},${LG.PESO_GOL}`) ruins.push(`cheio: ${pesos()}`);
  // um 3: sai o 1
  if (g(3) < 0 || pesos() !== `2,3,${LG.PESO_GOL},${LG.PESO_GOL},${LG.PESO_GOL},${LG.PESO_GOL}`) ruins.push(`+3: ${pesos()}`);
  // um 2 (empate com o menor): sai o 2 mais antigo
  const seq2 = G.metas.find(q => q.ocupado && q.peso === 2).seq;
  if (g(2) < 0 || G.metas.some(q => q.ocupado && q.seq === seq2)) ruins.push('+2: o 2 antigo ficou');
  // um 1 (menor que todos): fica de fora
  if (g(1) >= 0) ruins.push('+1 entrou com tudo maior');
  // a mesma parada: só troca por uma mais forte
  const mm = ++m * 10;
  const kA = LG.guardar(G, anelR, lanceEm(meio, { peso: 5, morta: mm }));
  if (LG.guardar(G, anelR, lanceEm(meio, { peso: 4, morta: mm })) >= 0) ruins.push('a mesma parada trocou por uma mais fraca');
  if (LG.guardar(G, anelR, lanceEm(meio, { peso: 6, morta: mm })) !== kA) ruins.push('a mesma parada não trocou pela mais forte na mesma vaga');
  // cheio de gols: a parada mais forte (pênalti) fica de fora; um gol novo tira o gol mais antigo
  for (let i = 0; i < 6; i++) g(LG.PESO_GOL);
  if (g(7, 'penalti') >= 0 || G.metas.some(q => q.ocupado && q.tipo !== 'gol')) ruins.push('uma parada tirou um gol');
  const maisVelho = Math.min(...G.metas.map(q => q.seq));
  g(LG.PESO_GOL);
  if (G.metas.some(q => q.seq === maisVelho)) ruins.push('o gol novo não tirou o mais antigo');
  // a escolha para as cenas (escolherLances): os gols do tempo primeiro (na ordem do jogo), depois a parada mais forte
  if (LG.escolherLances) {
    LG.limparGuarda(G);
    const ch = [];
    const e = (tipo, peso, tempo, c) => { ch.push(c); return LG.guardar(G, anelR, lanceEm(c, { tipo, classe: tipo === 'gol' ? 'gol' : 'B', peso, tempo, morta: ++m * 10 })); };
    const kP2 = e('espalmada', 2, 1, meio - 40), kG2 = e('gol', LG.PESO_GOL, 1, meio - 20), kP5 = e('trave', 5, 1, meio - 60);
    const kG1 = e('gol', LG.PESO_GOL, 1, meio - 80), kG3 = e('gol', LG.PESO_GOL, 2, meio), kP3 = e('faltaPerto', 3, 2, meio + 20);
    const igual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const casos = [
      [{ tempo: 1, max: 2 }, [kG1, kG2]], [{ tempo: 1, max: 3 }, [kG1, kG2, kP5]], [{ tempo: 2, max: 2 }, [kG3, kP3]],
      [{ tempo: 1, max: 4, cronologica: true }, [kG1, kP5, kP2, kG2]], [{ max: 6 }, [kG1, kG2, kG3, kP5, kP3, kP2]],
      [{ tempo: 1, max: 6, maxSegundos: 3.0 * 2 }, [kG1, kG2]],
    ];
    for (const [o, esp] of casos) { const got = LG.escolherLances(G, o, []); if (!igual(got, esp)) ruins.push(`escolherLances(${JSON.stringify(o)}) = ${got.join(',')} (esperado ${esp.join(',')})`); }
  }
  reg('G4 prioridade: gol nunca sai por parada; cheio, sai o de menor peso; o mais antigo desempata; a mesma parada só por uma mais forte; a escolha das cenas (os gols do tempo, depois a parada mais forte)',
    `${ruins.length} ruins${ruins.length ? ' (' + ruins[0] + ')' : ''}`, '0', ruins.length === 0);
}

// G5: custo (a janela inteira de 6 s; CPU do processo)
{
  const G = LG.criarGuarda(LANCES_GUARDA, { vagas: anelR.vagas, nj: GN.NJ }), mini = LG.criarMini(G);
  // a janela inteira: a chave 5 s antes do desfecho (cortada a LANCES_GUARDA.segundos)
  const l = lanceEm(anelR.ultimo - 330, { fim: anelR.ultimo - 30 });
  const cpu = f => { const c0 = process.cpuUsage(); f(); const c = process.cpuUsage(c0); return (c.user + c.system) / 1000; };
  const mg = [], mt = [];
  let k = -1, jan = null;
  for (let i = 0; i < 60; i++) {
    mg.push(cpu(() => { k = LG.guardar(G, anelR, { ...l, morta: 1000 + i }, S0p.bat); }));
    mt.push(cpu(() => LG.tocar(G, k, mini)));
  }
  jan = LG.janelaDoLance(G, anelR, l, { de: 0, ate: 0 });
  const med = v => { const w = v.slice(10).sort((a, b) => a - b); return w[w.length >> 1]; };
  const g = med(mg), t = med(mt);
  reg('G5 custo: guardar ≤ 2 ms e tocar ≤ 6 ms (mediana, CPU)', `janela ${fmt((jan.ate - jan.de) / 60)} s; guardar ${fmt(g, 3)} ms, tocar ${fmt(t, 3)} ms`, '≤ 2; ≤ 6', g <= 2 && t <= 6);
}

// G2, G3, G6: as partidas
const N = +arg('--n', 24), S0 = +arg('--sem0', 1);
const SEMENTES = Array.from({ length: N }, (_, k) => S0 + k);
const nPar = Math.max(1, Math.min(N, +arg('--par', Math.min(4, os.availableParallelism?.() ?? os.cpus().length))));
const t0 = Date.now();
const res = [];
let prox = 0;
await Promise.all(Array.from({ length: nPar }, async () => {
  while (prox < SEMENTES.length) {
    const s = SEMENTES[prox++];
    // metade com os replays desligados (os gols e as paradas são guardados igual)
    const lig = s % 2 === 1 ? '1' : '0';
    res.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), ['--filho', '--js', JS, '--s', String(s), '--ligado', lig]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', cod => { if (cod) erro(new Error(`semente ${s}: saiu com ${cod}`)); });
    }));
  }
}));
res.sort((a, b) => a.s - b.s);
console.log(`lógica: ${JS}\n${N} partidas IA × IA (sementes ${S0}–${S0 + N - 1}; metade com os replays desligados), ${nPar} processos, ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`);

// G2
{
  const junta = Math.max(...res.map(r => r.g2.junta)), bola = Math.max(...res.map(r => r.g2.bola));
  const pior = res.reduce((a, r) => (r.pior > a.pior ? r : a), { pior: 0 });
  const sat = res.reduce((a, r) => a + r.saturou, 0);
  const lim = 32767 * LANCES_GUARDA.escala;
  const onde = pior.piorOnde ? ` (s${pior.s} t${pior.piorOnde.tick}, id ${pior.piorOnde.id}${pior.piorOnde.goleiro ? ', goleiro' : ''}, junta ${pior.piorOnde.junta})` : '';
  reg('G2 quantização: ≤ 2 mm por junta e ≤ 1 mm na bola nos quadros guardados; nenhuma junta saturada no pior caso das partidas',
    `junta ${fmt(junta * 1000, 3)} mm, bola ${fmt(bola * 1000, 3)} mm; pior |junta − jogador| de todos os passos ${fmt(pior.pior)} m${onde} (limite ${fmt(lim)} m); ${sat} juntas saturadas nos guardados`,
    '≤ 2 mm; ≤ 1 mm; < limite; 0', junta <= 0.002 && bola <= 0.001 && pior.pior < lim && sat === 0);
}
// G3
{
  const ex = res.reduce((a, r) => a + r.g3.exato, 0), nm = res.reduce((a, r) => a + r.g3.nMeio, 0);
  const iJ = Math.max(...res.map(r => r.g3.interpJunta)), iB = Math.max(...res.map(r => r.g3.bolaMeio)), iT = Math.max(...res.map(r => r.g3.tempo));
  const hist = new Float64Array(1001);
  for (const r of res) r.g3.hist.forEach((c, i) => { hist[i] += c; });
  const med = quantilHist(hist, 0.5), p95 = quantilHist(hist, 0.95), mx = Math.max(...res.map(r => r.g3.perdaMax));
  const ruins = res.flatMap(r => r.g3.ruins);
  const bat = res.flatMap(r => r.g3.bat), batRuim = bat.filter(b => !b.igual), golsComRede = bat.filter(b => b.tipo === 'gol' && b.got > 0).length;
  const nGols = res.reduce((a, r) => a + r.gols.filter(g => g.k >= 0).length, 0);
  reg('G3 tocar: os ticks guardados = o anel (os mesmos jogadores em todo tick); a bola e o relógio exatos em todo tick; os jogadores do meio = a interpolação dos vizinhos',
    `${ex} ticks guardados + ${nm} do meio; no meio: a bola a ${fmt(iB * 1000, 3)} mm do anel, os jogadores a ${fmt(iJ * 1000, 3)} mm da média dos vizinhos; relógio ${fmt(iT * 1e6, 3)} µs; ${ruins.length} ruins${ruins.length ? ' (' + ruins[0] + ')' : ''}`,
    '≤ 1 mm; ≤ 2 mm; ≤ 1 µs; 0 ruins', ex > 0 && nm > 0 && iJ <= 0.002 && iB <= 0.001 && iT <= 1e-6 && ruins.length === 0);
  reg('G3 a perda dos 30 Hz nos ticks do meio (contra o anel, por junta): mediana ≤ 1 cm, p95 ≤ 2 cm',
    `junta: mediana ${fmt(med * 1000, 1)} mm, p95 ${fmt(p95 * 1000, 1)} mm (pior ${fmt(mx * 100, 1)} cm, um passo de pose que pula)`,
    '≤ 10 mm; ≤ 20 mm', nm > 0 && med <= 0.01 && p95 <= 0.02);
  reg('G3 a rede: as batidas da janela no mini.ondas (os mesmos t0)', `${bat.length} lances com batida (${golsComRede} de ${nGols} gols); ${batRuim.length} diferentes`, '0 diferentes; gols com a rede', batRuim.length === 0 && golsComRede > 0);
}
// G6
{
  const gols = res.flatMap(r => r.gols.map(g => ({ ...g, s: r.s, ligado: r.ligado })));
  const golsFora = gols.filter(g => g.k < 0), golsRuins = gols.filter(g => g.falhas.length), sumidos = res.reduce((a, r) => a + r.golsFora.length, 0);
  const golsDesl = gols.filter(g => !g.ligado).length;
  reg('G6 todo gol guardado (também com os replays desligados) e lá até o fim (só outro gol o tira), a janela até o gol + 0,5 s sem corte',
    `${gols.length - golsFora.length}/${gols.length} gols (${golsDesl} com os replays desligados); ${sumidos} sumidos; ${golsRuins.length} janelas ruins${golsRuins.length ? ' (s' + golsRuins[0].s + ': ' + golsRuins[0].falhas[0] + ')' : ''}`,
    'todos; 0; 0', gols.length > 0 && golsFora.length === 0 && sumidos === 0 && golsRuins.length === 0);
  const cl = res.reduce((a, r) => a + r.classificados, 0), ch = res.reduce((a, r) => a + r.chegaram, 0);
  const chF = res.reduce((a, r) => a + r.chaveFora, 0);
  const par = res.flatMap(r => r.paradas.map(p => ({ ...p, s: r.s })));
  const guard = par.filter(p => p.k >= 0), parRuins = par.filter(p => p.falhas.length), fdt = par.filter(p => p.pred === 'fimDoTempo').length;
  const porTipo = {};
  for (const p of guard) porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + 1;
  reg('G6 toda parada A/B chega ao ponto de guardar; a guardada com a janela inteira até o desfecho + 0,5 s, a chave dentro, sem corte',
    `${ch}/${cl} chegaram (${fdt} no fim do tempo); ${guard.length} guardadas (${Object.entries(porTipo).map(([k, v]) => k + ' ' + v).join(', ')}), ${par.length - guard.length - chF} de fora (cheio, peso menor), ${chF} com a falta antes do anel (vantagem longa); ${parRuins.length} ruins${parRuins.length ? ' (s' + parRuins[0].s + ' t' + parRuins[0].tick + ': ' + parRuins[0].falhas[0] + ')' : ''}`,
    'todas; 0 ruins', cl > 0 && ch === cl && guard.length > 0 && parRuins.length === 0);
}

fimTeste();
