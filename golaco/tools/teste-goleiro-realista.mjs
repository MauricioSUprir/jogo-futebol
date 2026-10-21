// Goleiro realista (pedido do dono, 15/10: "os goleiros se movimentando melhor e as espalmas e as seguradas de bola mais
// realistas, ele defende mais bolas difíceis do que fáceis"; e a pendência #114: sair no 1×1 e no cruzamento). Só na
// PARTIDA (GOLEIRO.realista; o treino não muda). Mede com o canhão do goleiro (lib/goleiro-canhao.mjs, o mesmo do
// medir-goleiro.mjs): partidas IA × IA, cópias do mundo no MEIO delas (a bola no pé de um atacante a 8–32 m do gol) e,
// de cada cópia, chutes no gol a 14–30 m/s com a mira uniforme ('natural': na hora; 'perto': a 6–16,5 m) e escanteios.
// Dificuldade pela FÍSICA, independente da conta do jogo: a distância lateral da bola ao goleiro no plano dele e o tempo
// de voo até lá ("exige" = (lateral − 0,5 m) ÷ (voo − 0,2 s de reação), m/s).
//  A. Defesa pela dificuldade:
//    A1. a bola no corpo (< 0,5 m de lado): ≥ 90% defendida (a fácil quase sempre);
//    A2. no corpo de perto (voo até ele < 0,45 s): ≥ 85% (na versão anterior 66%: a conta só olhava a distância);
//    A3. a curva cai com a dificuldade: corpo > exige < 2 m/s > 2–5 m/s > ≥ 5 m/s, cada degrau ≥ 5 pontos;
//    A4. longe e com tempo (≥ 2,5 m de lado, voo ≥ 1 s) defendida em 50–80% e ao menos 15 pontos MENOS que a do corpo de
//        perto (StatsBomb, medido aqui: 64,8% a ≥ 2,5 m de lado com o chute a ≥ 22 m do goleiro × 85,5% no corpo a < 8 m;
//        na main a de longe era defendida MAIS que a do corpo de perto: 68 × 62% e 76 × 53% em duas rodadas);
//    A5. nenhum gol PELO CORPO (a bola cruzando o plano dele a < 0,25 m do centro — dentro do tronco/pernas, com o raio
//        da bola — e abaixo de 1,7 m, sem desvio nem bola por cima dele): antes o sorteio que falhava deixava a bola
//        atravessar o goleiro (na versão anterior, 41 gols assim em 16 sementes; a 0,25–0,35 m a bola passa ao lado do pé).
//  B. Segurar × espalmar (StatsBomb, 1.893 defesas: segura 47%; em pé 52%; mergulho 28%; mergulho alto 4%; a bola no corpo,
//     729 defesas: segura 32% de < 12 m, 40% de 12–16,5 m, 59% de 16,5–25 m e 79% de ≥ 25 m):
//    B1. no corpo, chute de ≥ 16,5 m: segura (encaixe ou pega) em 50–80% (real 64,9%, 319);
//    B2. no corpo, chute de < 12 m: segura em 20–45% (real 32,0%, 241; a versão de 16/10 encaixava 72%, sem fonte);
//    B3. mergulho alto (≥ 1,2 m de lado e ≥ 1,8 m de altura; sem a bola por cima dele): encaixa ≤ 15% (espalma);
//    B4. nenhuma espalmada entra no próprio gol sem ninguém tocar nela (antes 1,6%);
//    B5. rebote: o ataque fica com a bola em 8–30% das espalmadas (StatsBomb: 18% das defesas vão para um adversário;
//        antes 1,6% — toda espalmada ia para fora).
//  C. Movimento (os chutes naturais das partidas e o goleiro posicionando):
//    C1. "set" com o chute armado — parado (< 0,5 m/s) e com os dois pés no chão em ≥ 55% dos ticks em que o dono da bola
//        adversário carrega o CHUTE a até 30 m do gol (StatsBomb: "Set" em 88,9% dos chutes no alvo; no instante do chute,
//        só ~40 chutes por rodada: informativo);
//    C2. sem saltos de posição (> 0,13 m num tick) nem de rumo (> 20° num tick);
//    C3. pés cruzados no passo lateral ≤ 10% dos passos de lado;
//    C4. pose (anim.js): o quadril não pula mais de 3 cm no passo em que a bola entra ou sai da mão dele (a base de
//        goleiro ia de ~1 a 0 num passo: 7–8 cm; na main, 0).
//  D. 1×1 e bola solta (partidas): o goleiro sai no 1×1 (≥ 0,5 por partida; antes nunca saía) e vai na bola solta da
//     área que pega antes dos atacantes (≥ 1 por partida; o "Keeper Sweeper" da StatsBomb: ~1 por goleiro por partida) —
//     só a bola sem dono de verdade (D3: nenhuma "bola solta" com a finalização do adversário no ar ou com a defesa dessa
//     bola já lida; a versão de 16/10 contava 19 assim em 8 partidas, e era por elas que o D2 passava).
//  E. Cruzamento (canhão de escanteios): o goleiro sai no alto e encaixa ou soca em ≥ 2% dos escanteios (StatsBomb:
//     toca em 10,7% dos escanteios longos; antes nunca saía); guarda: o gol de escanteio fica em ≤ 10% (neste canhão a
//     versão anterior dá 7,5–8,0% e esta 4,8–9,3% conforme as sementes — a diferença não passa do sorteio; Copa 2022:
//     2,6%. O que falta é do duelo pelo alto, não do goleiro: CONTRATOS.md).
//  F. Finalizações que não são cruzamento (canhão de cópias do meio da partida: o chute colocado — MOD + CHUTE — de 16–28 m
//     e a cavadinha de 10–18 m pelo executarAcao de verdade, só o atacante e o goleiro no lance): o goleiro nunca "sai no
//     cruzamento" num chute nem troca a leitura do chute por outro plano (a versão de 16/10: 85 e 66 em 85 colocados).
//  G. Contra-ataque 1×1 (o mesmo canhão da revisão: o dono da bola a 20–26 m do gol, os outros 12–22 m atrás, a IA decide):
//    G1. sem a cavadinha da IA (como o humano): defesa dos chutes no alvo ≥ 53% (a main neste canhão: 53,7%; a versão de
//        16/10, que corria até 5,5 m da linha: 45,3%; StatsBomb 1×1: 63%);
//    G2. com a cavadinha da IA: cavadinhas ≤ 10% dos chutes (a de 16/10: 47% — o goleiro passava dos 5 m da linha).
//   node tools/teste-goleiro-realista.mjs [--js <pasta js>] [--sementes 8] [--par 4] [--detalhe]
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medirSemente, emParalelo, servirFilho } from './lib/goleiro-canhao.mjs';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const NSEM = +arg('--sementes', 8), SEM0 = +arg('--sem0', 1001);
const PAR = +arg('--par', Math.min(4, os.cpus().length));
const OPC = { js: JS, estados: 12, k: 10, kp: 10, ke: 3, kf: 2, k1: 6, k1c: 2, min: 4 };
const G1_MIN = 53; // (a main neste canhão, 8 sementes 1001–1008: 53,7% de 419)

if (args.includes('--filho')) {
  servirFilho(sem => medirSemente(sem, OPC));
} else {
  const sems = Array.from({ length: NSEM }, (_, i) => SEM0 + i);
  const res = await emParalelo(fileURLToPath(import.meta.url), sems, PAR, args, false);
  res.sort((a, b) => a.sem - b.sem);
  process.exit(avaliar(res) ? 0 : 1);
}

function avaliar(res) {
  const pct = (a, b) => (b ? (100 * a) / b : NaN);
  const p1 = v => (Number.isFinite(v) ? `${fmt(v, 1)}%` : '—');
  const linhas = [['teste', 'medido', 'meta', 'resultado']];
  let falhas = 0;
  const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
  const canhao = res.flatMap(r => r.canhao.filter(c => c.fonte === 'natural' || c.fonte === 'perto'));
  const nat = res.flatMap(r => r.naturais);
  const valido = c => c.res === 'gol' || c.res === 'defesa';
  const alvo = c => valido(c) && (c.noAlvo || c.res === 'defesa') && c.lat != null;
  const A = canhao.filter(alvo);
  const taxa = xs => { const d = xs.filter(c => c.res === 'defesa').length; return { v: pct(d, xs.length), n: xs.length, d }; };
  const txt = t => `${p1(t.v)} (${t.n})`;
  // ---------------------------------------------------------------- A
  const exige = c => (c.lat < 0.5 ? 0 : (c.lat - 0.5) / Math.max(0.05, c.tVoo - 0.2));
  const corpo = A.filter(c => c.lat < 0.5);
  const tCorpo = taxa(corpo);
  reg('A1. bola no corpo (< 0,5 m de lado): defendida', txt(tCorpo), '≥ 90%', tCorpo.n >= 60 && tCorpo.v >= 90);
  const tPerto = taxa(corpo.filter(c => c.tVoo < 0.45));
  reg('A2. no corpo de perto (voo < 0,45 s): defendida', txt(tPerto), '≥ 85%', tPerto.n >= 25 && tPerto.v >= 85);
  const faixas = [corpo, A.filter(c => c.lat >= 0.5 && exige(c) < 2), A.filter(c => c.lat >= 0.5 && exige(c) >= 2 && exige(c) < 5), A.filter(c => c.lat >= 0.5 && exige(c) >= 5)].map(taxa);
  const mono = faixas.every((f, i) => i === 0 || f.v <= faixas[i - 1].v - 5);
  reg('A3. a curva cai com a dificuldade (corpo · exige < 2 · 2–5 · ≥ 5 m/s)', faixas.map(txt).join(' · '), 'cada degrau ≥ 5 pontos abaixo', mono && faixas.every(f => f.n >= 20));
  const tLonge = taxa(A.filter(c => c.lat >= 2.5 && c.tVoo >= 1));
  // (StatsBomb, medido aqui: a ≥ 2,5 m de lado com o chute a ≥ 22 m do goleiro — o voo de ~1 s — 64,8% (105); no corpo de
  // perto, a < 8 m, 85,5% (290): 20,7 pontos de diferença)
  reg('A4. longe e com tempo (≥ 2,5 m, voo ≥ 1 s) × no corpo de perto', `${txt(tLonge)} × ${p1(tPerto.v)}`, '50–80% e ≥ 15 pontos menos',
    tLonge.n >= 25 && tLonge.v >= 50 && tLonge.v <= 80 && tLonge.v <= tPerto.v - 15);
  // pelo corpo: a bola cruzou o plano dele a < 0,35 m do centro abaixo de 1,7 m e entrou — sem a leitura dizer "fora"
  // (bola desviada) e sem ser a bola por cima dele (cavadinha: a altura no plano dele acima do alcance)
  const peloCorpo = canhao.filter(c => c.res === 'gol' && c.cruzouGk && c.cruzouGk.d < 0.25 && c.cruzouGk.y < 1.7 && c.dFora === false && !c.recuo);
  const gols = canhao.filter(c => c.res === 'gol').length;
  reg('A5. gols pelo corpo do goleiro (a < 0,25 m do centro dele, abaixo de 1,7 m)', `${peloCorpo.length} de ${gols} gols`, '0', gols >= 50 && peloCorpo.length === 0);
  // ---------------------------------------------------------------- B
  const D = canhao.filter(c => c.res === 'defesa' && c.lat != null);
  const segura = c => c.modo === 'encaixe' || c.modo === 'pegou';
  // (StatsBomb, medido aqui, defesas com a bola a < 0,5 m de lado: segura 64,9% dos chutes de ≥ 16,5 m (319) e 32,0% dos de
  // < 12 m (241); as faixas cobrem o sorteio da amostra do canhão)
  const corpoLonge = D.filter(c => c.lat < 0.5 && c.dist >= 16.5);
  const pLonge = pct(corpoLonge.filter(segura).length, corpoLonge.length);
  reg('B1. no corpo, chute de ≥ 16,5 m: segura (encaixe ou pega)', `${p1(pLonge)} (${corpoLonge.length})`, '50–80% (real 64,9%)', corpoLonge.length >= 40 && pLonge >= 50 && pLonge <= 80);
  const corpoPerto = D.filter(c => c.lat < 0.5 && c.dist < 12);
  const pPerto = pct(corpoPerto.filter(segura).length, corpoPerto.length);
  reg('B2. no corpo, chute de < 12 m: segura (encaixe ou pega)', `${p1(pPerto)} (${corpoPerto.length})`, '20–45% (real 32,0%)', corpoPerto.length >= 25 && pPerto >= 20 && pPerto <= 45);
  const alto = D.filter(c => c.lat >= 1.2 && c.yPl >= 1.8 && !c.recuo);
  reg('B3. mergulho alto (≥ 1,2 m de lado, ≥ 1,8 m): encaixa', `${p1(pct(alto.filter(c => c.modo === 'encaixe').length, alto.length))} (${alto.length})`, '≤ 15%', alto.length >= 20 && pct(alto.filter(c => c.modo === 'encaixe').length, alto.length) <= 15);
  const esp = D.filter(c => c.modo === 'espalmada');
  const entra = esp.filter(c => c.golRebote && !c.reboteChute && c.pega == null);
  reg('B4. espalmada que entra no próprio gol (sem ninguém tocar)', `${entra.length} de ${esp.length}`, '0', esp.length >= 50 && entra.length === 0);
  const ataque = esp.filter(c => c.pega === 'ataque');
  reg('B5. rebote: o ataque fica com a bola espalmada', `${p1(pct(ataque.length, esp.length))} (${esp.length})`, '8–30%', esp.length >= 50 && pct(ataque.length, esp.length) >= 8 && pct(ataque.length, esp.length) <= 30);
  // ---------------------------------------------------------------- C
  const nA = nat.filter(c => alvo(c) && c.pre);
  const set = nA.filter(c => c.pre.v < 0.5 && c.pre.apoio === 2);
  const mv = res.flatMap(r => r.mov);
  const soma = k => mv.reduce((x, r) => x + (r[k] ?? 0), 0);
  reg('C1. "set" (parado, os dois pés no chão) com o CHUTE do adversário armado (≤ 30 m) · no instante do chute (informativo)',
    `${p1(pct(soma('armadoSet'), soma('armado')))} (${soma('armado')} ticks) · ${p1(pct(set.length, nA.length))} (${nA.length} chutes)`, '≥ 55%',
    soma('armado') >= 300 && pct(soma('armadoSet'), soma('armado')) >= 55);
  reg('C2. saltos de posição (> 0,13 m num tick) e de rumo (> 20°)', `${soma('saltoPos')} · ${soma('saltoRumo')} (${fmt(soma('ticks') / 3600, 0)} min)`, '0 · 0', soma('ticks') > 3600 * 30 && soma('saltoPos') === 0 && soma('saltoRumo') === 0);
  reg('C3. pés cruzados no passo lateral', `${p1(pct(soma('cruz'), soma('lateral')))} (${soma('lateral')} ticks de lado)`, '≤ 10%', soma('lateral') > 3000 && pct(soma('cruz'), soma('lateral')) <= 10);
  const po = res.reduce((x, r) => ({ trocas: x.trocas + r.pose.trocas, saltos: x.saltos + r.pose.saltos, max: Math.max(x.max, r.pose.max) }), { trocas: 0, saltos: 0, max: 0 });
  reg('C4. pose: o quadril pula > 3 cm no passo em que a bola entra ou sai da mão dele', `${po.saltos} de ${po.trocas} (máx. ${fmt(100 * po.max, 1)} cm)`, '0', po.trocas >= 10 && po.saltos === 0);
  // ---------------------------------------------------------------- D
  const nP = res.length;
  const s1 = res.reduce((x, r) => x + (r.saidas['1x1'] ?? 0), 0), sB = res.reduce((x, r) => x + (r.saidas.bolaSolta ?? 0), 0);
  const sBc = res.reduce((x, r) => x + (r.saidas.bolaSoltaChute ?? 0), 0);
  reg('D1. o goleiro sai no 1×1 (partidas)', `${fmt(s1 / nP, 2)} por partida (${s1} em ${nP})`, '≥ 0,5', s1 / nP >= 0.5);
  // (só a bola sem dono de verdade: sem a finalização do adversário no ar e sem a defesa dessa bola já lida)
  reg('D2. o goleiro vai na bola solta da área (partidas)', `${fmt(sB / nP, 2)} por partida (${sB})`, '≥ 1', sB / nP >= 1);
  reg('D3. "bola solta" com a finalização do adversário no ar (corria para o caminho do chute antes de reagir)', `${sBc} em ${nP} partidas`, '0', sBc === 0);
  // ---------------------------------------------------------------- E
  const ce = res.flatMap(r => r.canhao.filter(c => c.fonte === 'escanteio' && c.res === 'ok'));
  const sai = ce.filter(c => c.gkAlto);
  const golE = ce.filter(c => c.gol);
  reg('E1. escanteio: o goleiro sai no alto e encaixa/soca', `${p1(pct(sai.length, ce.length))} (${sai.filter(c => c.gkAlto === 'encaixe').length} encaixes, ${sai.filter(c => c.gkAlto === 'soco').length} socos; ${ce.length} escanteios)`, '≥ 2%', ce.length >= 100 && pct(sai.length, ce.length) >= 2);
  reg('E2. escanteio: gol (canhão; guarda)', `${p1(pct(golE.length, ce.length))} (${golE.length} de ${ce.length})`, '≤ 10%', ce.length >= 100 && pct(golE.length, ce.length) <= 10);
  // ---------------------------------------------------------------- F
  const fin = res.flatMap(r => r.finais ?? []);
  const fSai = fin.filter(c => c.saiAlto), fTroca = fin.filter(c => c.trocada);
  const nCol = fin.filter(c => c.tipo === 'colocado').length, nCav = fin.length - nCol;
  reg('F1. colocado (MOD + CHUTE) e cavadinha: o goleiro "sai no cruzamento" · troca a leitura do chute', `${fSai.length} · ${fTroca.length} (${nCol} colocados, ${nCav} cavadinhas)`, '0 · 0',
    nCol >= 40 && nCav >= 40 && fSai.length === 0 && fTroca.length === 0);
  // ---------------------------------------------------------------- G
  const ct = res.flatMap(r => r.contra ?? []);
  const g1 = ct.filter(c => !c.comCav && (c.res === 'gol' || c.res === 'defesa'));
  const g1d = pct(g1.filter(c => c.res === 'defesa').length, g1.length);
  const g2 = ct.filter(c => c.comCav && c.modo != null);
  const g2c = pct(g2.filter(c => c.modo === 'cavadinha').length, g2.length);
  reg('G1. contra-ataque 1×1 (a IA decide; sem a cavadinha da IA, como o humano): defesa dos chutes no alvo', `${p1(g1d)} (${g1.length})`, `≥ ${G1_MIN}%`, g1.length >= 200 && g1d >= G1_MIN);
  reg('G2. contra-ataque 1×1 com a cavadinha da IA: cavadinhas', `${p1(g2c)} (${g2.length} chutes)`, '≤ 10%', g2.length >= 60 && g2c <= 10);
  console.log(`lógica: ${JS} · ${nP} sementes (${SEM0}–${SEM0 + nP - 1}) · canhão: ${canhao.length} chutes, ${A.length} no alvo · partidas: ${nat.length} chutes · ${fmt(res.reduce((x, r) => x + r.gols[0] + r.gols[1], 0) / nP, 2)} gols por partida`);
  console.log(tabelaTexto(linhas));
  console.log(falhas ? `\nteste-goleiro-realista: REPROVOU (${falhas})` : '\nteste-goleiro-realista: PASSOU');
  return falhas === 0;
}
