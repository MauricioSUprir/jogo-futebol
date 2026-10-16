// medir-goleiro (diagnóstico, informativo; pedido do dono, 15/10: "os goleiros se movimentando melhor e as espalmas e as
// seguradas de bola mais realistas, ele defende mais bolas difíceis do que fáceis"). Só mede — não muda nada do jogo.
//
// Fontes de chute:
//  1. canhão com estados do MEIO da partida (estados de saída enganam): partidas IA × IA rodam e guardam cópias do
//     mundo com a bola no pé de um atacante a 8–32 m do gol (≥ 1 min de jogo, ≥ 3 s entre cópias). De cada cópia saem
//     chutes de dois jeitos (só a IA nos dois times):
//       'natural' — o chute sai de onde a bola está, NA HORA (o goleiro como a IA o deixou: andando, fora da bissetriz…);
//       'perto'   — bola e chutador levados a 6–16,5 m do gol, a bola parada 0,75 s (o goleiro se arruma) e o chute.
//     Mira uniforme no gol (z ±3,5 m, y 0,12–2,3 m), 14–30 m/s, sem giro, pela física do jogo (bola.js).
//  2. os chutes naturais das próprias partidas (o que a IA chuta de verdade).
// Mede: defesa por faixa de dificuldade (física: distância lateral da bola ao goleiro no plano dele × tempo de voo;
// e pelo p da logística do jogo), encaixe × espalmada × "pegou" por tipo de bola, para onde vai a espalmada e quem
// pega o rebote, o goleiro no instante do chute (parado? pés no chão? na bissetriz?), o movimento dele durante o jogo
// (velocidade, vai-e-volta, pés cruzados, saltos de posição/rumo), 1×1 e escanteios/cruzamentos.
//
//   node golaco/tools/medir-goleiro.mjs                    (8 sementes, 1001…; 4 processos)
//   node golaco/tools/medir-goleiro.mjs --sementes 16 --estados 14 --k 10 --kp 10 --par 4
//   --js <pasta js> (outra cópia da lógica)   --json <arquivo> (grava os registros)   --min 4 (min reais por tempo)
import { medirSemente, emParalelo, servirFilho } from './lib/goleiro-canhao.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const NSEM = +arg('--sementes', 8), SEM0 = +arg('--sem0', 1001);
const NEST = +arg('--estados', 12), K = +arg('--k', 10), KP = +arg('--kp', 10), KE = +arg('--ke', 2);
const MIN = +arg('--min', 4);
const PAR = +arg('--par', Math.min(4, os.cpus().length));

// ===================================================================================================== pai
if (process.argv.includes('--filho')) {
  servirFilho(sem => medirSemente(sem, { js: JS, estados: NEST, k: K, kp: KP, ke: KE, min: MIN }));
} else {
  const sems = Array.from({ length: NSEM }, (_, i) => SEM0 + i);
  const res = await emParalelo(fileURLToPath(import.meta.url), sems, PAR, args);
  const out = arg('--json', null);
  if (out) fs.writeFileSync(out, JSON.stringify(res));
  relatorio(res);
}

// ===================================================================================================== relatório
function relatorio(res) {
  const f0 = v => (v == null || Number.isNaN(v) ? '—' : v.toFixed(0)), f1 = v => (v == null || Number.isNaN(v) ? '—' : v.toFixed(1).replace('.', ','));
  const f2 = v => (v == null || Number.isNaN(v) ? '—' : v.toFixed(2).replace('.', ','));
  const pct = (a, b) => (b ? 100 * a / b : NaN);
  const tab = (titulo, linhas) => {
    console.log(`\n== ${titulo}`);
    const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
    for (const l of linhas) console.log(l.map((x, c) => String(x).padEnd(larg[c])).join(' | '));
  };
  const canhao = res.flatMap(r => r.canhao.filter(c => c.fonte === 'natural' || c.fonte === 'perto'));
  const nat = res.flatMap(r => r.naturais);
  const valido = c => c.res === 'gol' || c.res === 'defesa';
  // no alvo de verdade (a defesa conta mesmo que a previsão dissesse fora: o goleiro tocou)
  const alvo = c => valido(c) && (c.noAlvo || c.res === 'defesa');
  const sem = canhao.filter(c => c.res === 'semCena').length;
  console.log(`canhão: ${canhao.length} tentativas (${sem} sem cena), ${canhao.filter(alvo).length} no alvo; partidas: ${nat.length} chutes, ${nat.filter(alvo).length} no alvo; gols por partida ${f2(res.reduce((s, r) => s + r.gols[0] + r.gols[1], 0) / res.length)}`);

  const linhaFaixa = (nome, xs) => {
    const a = xs.filter(alvo), d = a.filter(c => c.res === 'defesa');
    const enc = d.filter(c => c.modo === 'encaixe').length, esp = d.filter(c => c.modo === 'espalmada').length, peg = d.filter(c => c.modo === 'pegou').length;
    const reb = a.filter(c => c.rebaixada).length, sorteioOk = a.filter(c => c.dSucesso === true || c.rebaixada).length;
    const pMed = a.filter(c => c.p != null);
    return [nome, a.length, `${f1(pct(d.length, a.length))}%`, `${f1(pct(enc, d.length))}/${f1(pct(esp, d.length))}/${f1(pct(peg, d.length))}`,
      `${f1(pct(sorteioOk, a.length))}%`, `${f1(pct(reb, a.length))}%`, pMed.length ? f2(pMed.reduce((s, c) => s + c.p, 0) / pMed.length) : '—'];
  };
  const cab = ['faixa', 'no alvo', 'defesa', 'encaixe/espalm./pegou % das defesas', 'sorteio deu defesa', 'rebaixada (mão não chega)', 'p médio (logística)'];

  // 1) dificuldade física: lateral no plano do goleiro
  for (const [nome, xs] of [['canhão (natural + perto)', canhao], ['chutes das partidas', nat]]) {
    const L = [cab];
    for (const [a, b] of [[0, 0.5], [0.5, 1], [1, 1.5], [1.5, 2.5], [2.5, 9]]) L.push(linhaFaixa(`lateral ${f1(a)}–${f1(b)} m`, xs.filter(c => c.lat >= a && c.lat < b)));
    tab(`1a. Defesa × distância lateral da bola ao goleiro (no plano dele) — ${nome}`, L);
  }
  {
    const L = [['lateral \\ tempo de voo até o goleiro', '< 0,45 s', '0,45–0,7 s', '0,7–1 s', '≥ 1 s']];
    for (const [a, b] of [[0, 0.5], [0.5, 1], [1, 1.5], [1.5, 2.5], [2.5, 9]]) {
      const lin = [`lateral ${f1(a)}–${f1(b)} m`];
      for (const [t1, t2] of [[0, 0.45], [0.45, 0.7], [0.7, 1], [1, 9]]) {
        const xs = canhao.filter(c => alvo(c) && c.lat >= a && c.lat < b && c.tVoo >= t1 && c.tVoo < t2);
        lin.push(`${f0(pct(xs.filter(c => c.res === 'defesa').length, xs.length))}% (${xs.length})`);
      }
      L.push(lin);
    }
    tab('1b. Defesa % (amostra) por lateral × tempo de voo — canhão', L);
  }
  {
    const L = [cab];
    for (const [a, b] of [[0, 0.15], [0.15, 0.3], [0.3, 0.5], [0.5, 0.7], [0.7, 0.85], [0.85, 1.01]]) L.push(linhaFaixa(`p ${f2(a)}–${f2(b)}`, canhao.filter(c => c.p != null && c.p >= a && c.p < b)));
    tab('1c. Defesa × p da logística do jogo (o que o jogo acha difícil) — canhão', L);
  }
  {
    const L = [cab];
    for (const [a, b] of [[0, 0.5], [0.5, 1.5], [1.5, 9]]) L.push(linhaFaixa(`altura no plano ${f1(a)}–${f1(b)} m`, canhao.filter(c => c.yPl >= a && c.yPl < b)));
    for (const [a, b] of [[0, 0.6], [0.6, 1.5], [1.5, 9]]) L.push(linhaFaixa(`a ${f1(a)}–${f1(b)} m da trave (canto)`, canhao.filter(c => c.dTrave >= a && c.dTrave < b)));
    for (const [a, b] of [[0, 18], [18, 24], [24, 99]]) L.push(linhaFaixa(`bola a ${f0(a)}–${f0(b)} m/s no plano`, canhao.filter(c => c.vPl >= a && c.vPl < b)));
    for (const [a, b] of [[0, 10], [10, 16.5], [16.5, 24], [24, 99]]) L.push(linhaFaixa(`chute de ${f1(a)}–${f1(b)} m`, canhao.filter(c => c.dist >= a && c.dist < b)));
    tab('1d. Defesa × altura, canto, velocidade e distância — canhão', L);
  }
  {
    // fácil = no corpo (≤ 0,5 m), meia altura, ≥ 0,5 s de voo; difícil = ≥ 2 m de lado em < 0,7 s, ou no canto alto
    const facil = c => c.lat < 0.5 && c.yPl > 0.2 && c.yPl < 1.6 && c.tVoo >= 0.5;
    const dificil = c => c.lat >= 2 && c.tVoo < 0.7;
    const angulo = c => c.dTrave < 0.6 && c.yLinha > 1.6;
    tab('1e. Fácil × difícil (definição física, independente do jogo) — canhão', [cab,
      linhaFaixa('FÁCIL: no corpo (< 0,5 m), meia altura, voo ≥ 0,5 s', canhao.filter(facil)),
      linhaFaixa('DIFÍCIL: ≥ 2 m de lado, voo < 0,7 s', canhao.filter(dificil)),
      linhaFaixa('ÂNGULO: < 0,6 m da trave e > 1,6 m de altura', canhao.filter(angulo)),
      linhaFaixa('gols "pelo corpo" (a bola a < 0,35 m do centro dele, < 1,7 m)', canhao.filter(c => c.res === 'gol' && c.peloCorpo)),
    ]);
    const gols = canhao.filter(c => c.res === 'gol' && alvo(c));
    console.log(`gols do canhão: ${gols.length}; passaram PELO CORPO do goleiro (< 0,35 m do centro, < 1,7 m): ${gols.filter(c => c.peloCorpo).length} (${f1(pct(gols.filter(c => c.peloCorpo).length, gols.length))}%); com o sorteio da logística falhando (sucesso=false sem rebaixar): ${gols.filter(c => c.dSucesso === false && !c.rebaixada).length}; rebaixados: ${gols.filter(c => c.rebaixada).length}`);
  }
  {
    // velocidade exigida da mão/corpo depois da reação (0,2 s): o que falta de lado além de 0,5 m (o corpo cobre) ÷ o tempo
    // que sobra; < 0,5 m = no corpo. Independente da conta do jogo (só física)
    const exige = c => (c.lat < 0.5 ? 0 : (c.lat - 0.5) / Math.max(0.05, c.tVoo - 0.2));
    const L = [cab];
    L.push(linhaFaixa('FÁCIL — no corpo (< 0,5 m de lado)', canhao.filter(c => c.lat != null && c.lat < 0.5)));
    for (const [a, b, n] of [[1e-9, 2, 'MÉDIA — exige < 2 m/s'], [2, 5, 'DIFÍCIL — exige 2–5 m/s'], [5, 1e9, 'MUITO DIFÍCIL — exige ≥ 5 m/s']]) L.push(linhaFaixa(n, canhao.filter(c => c.lat != null && c.lat >= 0.5 && exige(c) >= a && exige(c) < b)));
    tab('1f. Faixas principais de dificuldade (velocidade lateral exigida depois de 0,2 s de reação) — canhão', L);
    const L2 = [cab];
    for (const [d1, d2] of [[0, 12], [12, 20], [20, 99]]) {
      L2.push(linhaFaixa(`no corpo, chute de ${f0(d1)}–${f0(d2)} m`, canhao.filter(c => c.lat != null && c.lat < 0.5 && c.dist >= d1 && c.dist < d2)));
      L2.push(linhaFaixa(`exige ≥ 2 m/s, chute de ${f0(d1)}–${f0(d2)} m`, canhao.filter(c => c.lat != null && c.lat >= 0.5 && exige(c) >= 2 && c.dist >= d1 && c.dist < d2)));
    }
    tab('1g. Fácil × difícil na MESMA distância de chute — canhão', L2);
  }
  // 2) encaixe × espalmada por tipo de bola e destino da espalmada
  {
    const L = [['tipo de bola', 'defesas', 'encaixe', 'espalmada', 'pegou', 'tipo desenhado (mergulho/salto/baixa/peito)']];
    const tiposBola = [
      ['no corpo (< 0,5 m), lenta (< 20 m/s)', c => c.lat < 0.5 && c.vPl < 20],
      ['no corpo (< 0,5 m), forte (≥ 20 m/s)', c => c.lat < 0.5 && c.vPl >= 20],
      ['perto (0,5–1,2 m)', c => c.lat >= 0.5 && c.lat < 1.2],
      ['mergulho curto (1,2–2,2 m)', c => c.lat >= 1.2 && c.lat < 2.2],
      ['mergulho longo (≥ 2,2 m)', c => c.lat >= 2.2],
      ['alta (> 1,7 m)', c => c.yPl > 1.7],
      ['ângulo (< 0,6 m da trave e > 1,6 m)', c => c.dTrave < 0.6 && c.yLinha > 1.6],
      ['de longe (≥ 20 m), no corpo', c => c.dist >= 20 && c.lat < 0.7],
      ['de perto (< 12 m), no corpo', c => c.dist < 12 && c.lat < 0.7],
    ];
    for (const [nome, fn] of tiposBola) {
      const d = canhao.filter(c => c.res === 'defesa' && fn(c));
      const tp = t => d.filter(c => c.mTipo === t).length;
      L.push([nome, d.length, `${f1(pct(d.filter(c => c.modo === 'encaixe').length, d.length))}%`, `${f1(pct(d.filter(c => c.modo === 'espalmada').length, d.length))}%`,
        `${f1(pct(d.filter(c => c.modo === 'pegou').length, d.length))}%`, `${tp('mergulho')}/${tp('salto')}/${tp('baixa')}/${tp('peito')}`]);
    }
    tab('2a. Encaixe × espalmada por tipo de bola — canhão (StatsBomb: 48,5% seguradas; em pé 55%, de longe em pé ~60%, mergulho 25%)', L);
    const esp = canhao.filter(c => c.res === 'defesa' && c.modo === 'espalmada');
    const cnt = (k, v) => esp.filter(c => c[k] === v).length;
    tab('2b. Para onde vai a espalmada (3 s) — canhão (StatsBomb: das defesas, 18% rebote para o adversário, 11,7% para o companheiro, 21,8% para fora)', [
      ['espalmadas', 'linha de fundo', 'lateral', 'ataque pega', 'defesa pega', 'goleiro pega de novo', 'rebote vira chute', 'gol de rebote', 'na zona perigosa 1 s depois', 'v média de saída'],
      [esp.length, `${f1(pct(cnt('depois', 'linhaDeFundo'), esp.length))}%`, `${f1(pct(cnt('depois', 'lateral'), esp.length))}%`, `${f1(pct(cnt('pega', 'ataque'), esp.length))}%`,
        `${f1(pct(cnt('pega', 'defesa'), esp.length))}%`, `${f1(pct(cnt('pega', 'goleiro'), esp.length))}%`, `${f1(pct(esp.filter(c => c.reboteChute).length, esp.length))}%`,
        `${f1(pct(esp.filter(c => c.golRebote).length, esp.length))}%`, `${f1(pct(esp.filter(c => c.zona1s).length, esp.length))}%`,
        `${f1(esp.reduce((s, c) => s + (c.vEsp ?? 0), 0) / Math.max(1, esp.length))} m/s`],
    ]);
    const tdN = nat.filter(c => c.res === 'defesa');
    console.log(`partidas: defesas ${tdN.length}: encaixe ${f1(pct(tdN.filter(c => c.modo === 'encaixe').length, tdN.length))}%, espalmada ${f1(pct(tdN.filter(c => c.modo === 'espalmada').length, tdN.length))}%, pegou ${f1(pct(tdN.filter(c => c.modo === 'pegou').length, tdN.length))}%`);
  }
  // 3) o goleiro no instante do chute
  {
    const L = [['fonte', 'chutes no alvo', 'v do goleiro p50 / p90 (m/s)', 'parado (< 0,5 m/s)', '> 2 m/s', 'dois pés no chão', 'erro lateral à bissetriz p50 / p90 (m)', 'profundidade p50 (m)', 'saindo']];
    for (const [nome, xs] of [['canhão natural', canhao.filter(c => c.fonte === 'natural')], ['canhão perto (0,75 s parado)', canhao.filter(c => c.fonte === 'perto')], ['partidas', nat]]) {
      const a = xs.filter(c => alvo(c) && c.pre);
      const vs = a.map(c => c.pre.v).sort((x, y) => x - y), es = a.map(c => Math.abs(c.pre.erroBis)).sort((x, y) => x - y), ps = a.map(c => c.pre.prof).sort((x, y) => x - y);
      const q = (v, f) => v.length ? v[Math.min(v.length - 1, Math.floor(f * v.length))] : NaN;
      L.push([nome, a.length, `${f2(q(vs, 0.5))} / ${f2(q(vs, 0.9))}`, `${f1(pct(a.filter(c => c.pre.v < 0.5).length, a.length))}%`, `${f1(pct(a.filter(c => c.pre.v > 2).length, a.length))}%`,
        `${f1(pct(a.filter(c => c.pre.apoio === 2).length, a.length))}%`, `${f2(q(es, 0.5))} / ${f2(q(es, 0.9))}`, f2(q(ps, 0.5)), `${f1(pct(a.filter(c => c.pre.saindo).length, a.length))}%`]);
    }
    tab('3a. O goleiro no instante do chute', L);
    const L2 = [cab];
    const cn = canhao.filter(c => c.fonte === 'natural');
    for (const [a, b] of [[0, 0.5], [0.5, 1.5], [1.5, 3], [3, 99]]) L2.push(linhaFaixa(`goleiro a ${f1(a)}–${f1(b)} m/s no chute`, cn.filter(c => c.pre && c.pre.v >= a && c.pre.v < b)));
    // andando para o lado errado (contra a bola) × a favor
    L2.push(linhaFaixa('andando > 1 m/s CONTRA o lado da bola', cn.filter(c => c.pre && Math.abs(c.pre.vz) > 1 && Math.sign(c.pre.vz) !== Math.sign((c.zLinha ?? 0) - (c.gz0 ?? 0)))));
    L2.push(linhaFaixa('andando > 1 m/s A FAVOR do lado da bola', cn.filter(c => c.pre && Math.abs(c.pre.vz) > 1 && Math.sign(c.pre.vz) === Math.sign((c.zLinha ?? 0) - (c.gz0 ?? 0)))));
    for (const [a, b] of [[0, 0.3], [0.3, 0.8], [0.8, 99]]) L2.push(linhaFaixa(`fora da bissetriz ${f1(a)}–${f1(b)} m`, cn.filter(c => c.pre && Math.abs(c.pre.erroBis) >= a && Math.abs(c.pre.erroBis) < b)));
    tab('3b. Defesa × estado do goleiro no chute — canhão NATURAL (o goleiro como a IA o deixou)', L2);
    const mv = res.flatMap(r => r.mov);
    const s = k => mv.reduce((x, r) => x + r[k], 0), tk = s('ticks');
    const min = tk / 3600;
    tab('3c. Movimento do goleiro posicionando (partidas, os dois goleiros; sem defesa desenhada, sem a bola)', [
      ['minutos', 'v p50 / p90 / p99 (m/s)', '> 3 m/s', '> 4 m/s', 'vai-e-volta lateral por min', 'pés cruzados no passo lateral', 'saltos de posição (> 0,13 m num tick)', 'saltos de rumo (> 20° num tick)', 'distância média ao alvo da IA'],
      [f1(min), `${f2(mv.reduce((x, r) => x + r.p50, 0) / mv.length)} / ${f2(mv.reduce((x, r) => x + r.p90, 0) / mv.length)} / ${f2(mv.reduce((x, r) => x + r.p99, 0) / mv.length)}`,
        `${f1(pct(s('acimaDe3'), tk))}%`, `${f1(pct(s('acimaDe4'), tk))}%`, f1(s('inv') / min), `${f1(pct(s('cruz'), s('lateral')))}% (${s('lateral')} ticks)`, s('saltoPos'), s('saltoRumo'), `${f2(s('erroAlvo') / Math.max(1, tk))} m`],
    ]);
  }
  // 4) 1×1, escanteio e cruzamento
  {
    const u1 = [...canhao, ...nat].filter(c => c.umXum);
    const L = [cab, linhaFaixa('1×1 (canhão)', canhao.filter(c => c.umXum)), linhaFaixa('1×1 (partidas)', nat.filter(c => c.umXum)), linhaFaixa('não 1×1 na área (canhão)', canhao.filter(c => !c.umXum && c.dist < 16.5))];
    tab('4a. 1×1 (chutador na área, sem defensor no triângulo bola–traves nem a ≤ 2 m) — StatsBomb: 24,8% de gol, 62,8% no alvo', L);
    const prof1 = u1.filter(c => c.pre).map(c => c.pre.prof).sort((a, b) => a - b);
    console.log(`1×1: profundidade do goleiro no chute p50 ${f2(prof1[Math.floor(prof1.length / 2)])} m, p90 ${f2(prof1[Math.floor(prof1.length * 0.9)])} m; saídas (evento saidaGoleiro) nas partidas: 1×1 ${res.reduce((s, r) => s + r.saidas['1x1'], 0)}, cruzamento ${res.reduce((s, r) => s + (r.saidas.cruzamento ?? 0), 0)}, bola solta ${res.reduce((s, r) => s + (r.saidas.bolaSolta ?? 0), 0)}, botão ${res.reduce((s, r) => s + r.saidas.botao, 0)} em ${res.length} partidas`);
    const ce = res.flatMap(r => r.canhao.filter(c => c.fonte === 'escanteio' && c.res === 'ok'));
    const gm = ce.filter(c => c.gkToca);
    const desce = ce.filter(c => c.desce);
    const naPeq = desce.filter(c => c.desce.dLinha < 5.5 && Math.abs(c.desce.z) < 9.16);
    const naPeqAlc = naPeq.filter(c => c.desce.dGk < 4.5);
    const chs = ce.filter(c => c.chute), cabs = ce.filter(c => c.cab);
    const defCab = cabs.filter(c => c.leit && c.leit.dSucesso === true).length;
    tab('4b. Escanteios (canhão de estados do meio; Copa 2022: 2,6% de gol; goleiro intercepta ~10–15% dos cruzamentos na área — "claims")', [
      ['escanteios', 'gol', 'chute', 'cabeceio a gol', 'goleiro toca 1º/algum (defesa/corpo)', 'bola desce na pequena área', '…a < 4,5 m do goleiro', 'goleiro no chute: profundidade p50', 'leitura de defesa nos cabeceios'],
      [ce.length, `${f1(pct(ce.filter(c => c.gol).length, ce.length))}%`, `${f1(pct(chs.length, ce.length))}%`, `${f1(pct(cabs.length, ce.length))}%`, `${f1(pct(gm.length, ce.length))}% (${[...new Set(gm.map(c => c.gkModo))].join(',')})`,
        `${f1(pct(naPeq.length, desce.length))}%`, `${f1(pct(naPeqAlc.length, desce.length))}%`,
        f2(ce.map(c => c.gkPre?.prof ?? 0).sort((a, b) => a - b)[Math.floor(ce.length / 2)]), `${f1(pct(defCab, cabs.length))}% de ${cabs.length}`],
    ]);
    const E = res.reduce((s, r) => ({ n: s.n + r.esc.n, gols: s.gols + r.esc.gols, gk: s.gk + r.esc.gkToca, ch: s.ch + r.esc.chutes }), { n: 0, gols: 0, gk: 0, ch: 0 });
    const C = res.reduce((s, r) => ({ n: s.n + r.cruz.n, gols: s.gols + r.cruz.gols, gk: s.gk + r.cruz.gkToca, ch: s.ch + r.cruz.chutes }), { n: 0, gols: 0, gk: 0, ch: 0 });
    console.log(`partidas: escanteios ${E.n} (gol ${f1(pct(E.gols, E.n))}%, chute ${f1(pct(E.ch, E.n))}%, goleiro defende ${f1(pct(E.gk, E.n))}%); cruzamentos de bola rolando ${C.n} (gol em 5 s ${f1(pct(C.gols, C.n))}%, chute ${f1(pct(C.ch, C.n))}%, goleiro defende ${f1(pct(C.gk, C.n))}%)`);
  }
}
