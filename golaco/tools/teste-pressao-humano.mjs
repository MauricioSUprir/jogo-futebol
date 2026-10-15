// PRESSÃO do humano PERCEPTÍVEL (pedido do dono, 11/10: "o botão de pressão não funciona"; o EA FC "teammate pressure":
// segurar o botão manda o companheiro que chega primeiro PERSEGUIR o condutor de forma agressiva, com uma marca em cima
// dele; com o 1º defensor da IA já apertando, vem o segundo). Medida PAREADA (tools/lib/pressao-pareada.mjs): a cada posse
// nova do adversário na partida IA × IA, o mundo é copiado e roda 2 s em dois ramos com a mesma entrada do humano — A sem
// o botão, B com PRESSÃO segurado. Modelos do humano alternados por partida: 'persegue' (analógico na bola) e 'parado'.
// O teste antigo do teste-defesa-humano ("um companheiro a ≤ 2 m em ≤ 2 s") passava SEM o botão (79%).
// Metas (casos "longos": o condutor ≥ 1,5 s com a bola nos dois ramos e um companheiro a ≤ 12 m no começo):
//  M0 os dois ramos começam bit a bit iguais (100%);
//  M1 o mais perto: mediana da distância do companheiro mais perto ao condutor em 1,5 s, com ≤ sem − 1,0 m;
//  M2 (guarda) com o botão, um companheiro chega a ≤ 2 m do condutor em ≤ 1,5 s em ≥ 60% (o diagnóstico pedia 70%: do
//     parado o corpo anda ~6,4 m em 1,5 s, e o companheiro mais perto começa a ~7,5 m na mediana);
//  M3 um a MAIS na pressão: mediana da distância do 2º companheiro mais perto ao condutor em 2 s, com ≤ sem − 1,5 m;
//  M4 sem abuso: faltas do time 0 com o botão ≤ 1,5 × as de sem o botão + 2 (todos os casos);
//  M5 corre de verdade: o escolhido a mais de 4 m do condutor, ≥ 1 s depois de escolhido (o tempo de acelerar: do
//     parado a 6 m/s leva ~1,1 s no perfil de aceleração do jogo), a ≥ vCorrida em ≥ 80% dos ticks;
//  M6 marca visível: com o pedido valendo e um condutor adversário, o escolhido existe para o desenho (defesa.js
//     pressionadorVisivel) em 100% dos ticks;
//  M7 dobra a marcação: com o 1º homem da IA (≠ controlado) já apertando por conta própria, o escolhido é OUTRO em ≥ 95%.
// AMOSTRA (15/10): 32 partidas (sementes 7001–7032, modelos alternados como antes), uma por processo filho (--par, padrão
// 3). Com 8, a mesma lógica passava ou reprovava pelo sorteio dos lances: na main (c2f76d69), em 16 conjuntos disjuntos
// de 8 partidas (sementes 7001–7032, 7101–7132, 7201–7232, 7301–7332), o M1 ia de 0,80 a 2,02 m, o M2 de 48 a 73%, a
// folga do M4 de −3,5 a 7 e o M5 de 77 a 83% — só 5 dos 16 passavam em tudo (7001–7008, a do CI, era um deles); qualquer
// mudança da simulação que não mexe na pressão troca os lances e o resultado. As 128 partidas juntas: M1 Δ 1,38 m, M2 63%,
// M3 Δ 2,74 m, M4 110 → 174 faltas (1,58×: no limite, ver abaixo), M5 80,6%, M6 e M7 100%.
// Decisão: a conta direta de cada meta, sem mudar nenhuma, na amostra 4× maior. Reamostrando as 128 partidas (bootstrap por
// partida, 1000 amostras), a chance de reprovar só pelo sorteio cai no M1 de 11% (8 partidas) para 0,7% (32), no M2 de 30%
// para 13% e no M3 de 7% para 0,1%. O M4 e o M5 NÃO melhoram com a amostra porque a main está no limite deles (é o jogo, não
// a amostra): M4 110 → 174 nas 128 (a meta deixa 167; 1,58× — o bote do chamado 7 → 34 e a carga 101 → 137) e M5 80,6%
// (meta 80%). Por isso, até o jogo ganhar margem nesses dois, a reprovação por sorteio segue em ~69% nas 32 partidas (73%
// nas 8). Testado e NÃO adotado: reprovar só quando a amostra prova a meta furada (como os cartões do teste-faltas) deixava
// a main estável (~9%), mas a lógica de antes do PRESSÃO novo (#470) passava em M2, M4 e M5 (58%, 1,89× as faltas, 78%):
// com 32 partidas a prova não tem força para separar o limite de um defeito — seria afrouxar as metas.
// O erro-padrão entre as partidas aparece no "medido" (M2, M4, M5) só para dizer se o resultado está dentro do sorteio.
// Informativos: as metas do diagnóstico que a física do jogo não deixa cumprir (o mais perto ≥ 2 m mais perto em 1,0 s —
// do parado o corpo anda ~3,2 m no 1º segundo; bola ao alcance do bote em ≥ 15% de TODAS as posses — só ~1/5 delas dura
// ≥ 1 s), o alcance do bote nos casos longos e os dois modelos do humano.
//   node tools/teste-pressao-humano.mjs                       (lógica do repositório)
//   node tools/teste-pressao-humano.mjs --js <pasta js>       (outra cópia da lógica, ex.: a base)
//   node tools/teste-pressao-humano.mjs --partidas 32 --sem 7001 --min 4 --par 3   (amostra: partidas de 2 × min minutos)
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const JS = args.includes('--js') ? path.resolve(arg('--js')) : path.resolve(AQUI, '../js');
const NP = +arg('--partidas', 32), MIN = +arg('--min', 4), SEM0 = +arg('--sem', 7001);
const MODELOS = ['persegue', 'parado'];
const PASSO = 1 / 60;
const K2 = Math.round(2 / PASSO);
const seg2 = o => Object.values(o ?? {}).sort((a, b) => a - b)[1];

if (args.includes('--filho')) {
  // uma partida: os casos da medida pareada, só com o que as metas usam (a mensagem fica pequena)
  const s = +arg('--s');
  const { medirPressaoPareada } = await import(pathToFileURL(path.join(AQUI, 'lib/pressao-pareada.mjs')).href);
  const { casos, PASSO: P } = await medirPressaoPareada(JS, { sementes: [s], min: MIN, T: 2, alcance: 15, modelos: [MODELOS[(s - SEM0) % MODELOS.length]] });
  if (Math.abs(P - PASSO) > 1e-12) throw new Error(`PASSO da lógica ${P} ≠ ${PASSO}`);
  const r = x => ({
    d1: x.d[Math.round(1 / PASSO)], d15: x.d[Math.round(1.5 / PASSO)], t2: x.t2, perdeu: x.perdeu, s2: seg2(x.dj[K2]),
    faltas: x.faltas, alcBote: x.alcBote, rouba: x.rouba, corre: x.corre, correTot: x.correTot, corre1: x.corre1, correTot1: x.correTot1,
    marcaOk: x.marcaOk, marcaTot: x.marcaTot, p1Dobra: x.p1Dobra, p1Tot: x.p1Tot,
  });
  const msg = { s, casos: casos.map(c => ({ sem: c.sem, modelo: c.modelo, d0: c.d0, h0: c.h0, A: r(c.A), B: r(c.B) })) };
  await new Promise(ok => process.send(msg, ok));
  process.exit(0);
}

const t0 = Date.now();
const SEMENTES = Array.from({ length: NP }, (_, k) => SEM0 + k);
const nPar = Math.max(1, Math.min(SEMENTES.length, os.availableParallelism?.() ?? os.cpus().length, +arg('--par', 3)));
const porPartida = [];
let prox = 0;
await Promise.all(Array.from({ length: nPar }, async () => {
  while (prox < SEMENTES.length) {
    const s = SEMENTES[prox++];
    porPartida.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), [...args, '--filho', '--s', String(s)]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', cod => { if (cod) erro(new Error(`semente ${s}: saiu com ${cod}`)); });
    }));
  }
}));
porPartida.sort((a, b) => a.s - b.s);
const casos = porPartida.flatMap(p => p.casos);

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const med = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const pc = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`;
// erro-padrão da soma de uma grandeza por partida (as partidas são independentes): √(n · var) — só para mostrar se o
// resultado está dentro do sorteio (a decisão é a conta direta da meta)
function epSoma(v) { const n = v.length, mu = v.reduce((s, x) => s + x, 0) / n; return Math.sqrt(n * v.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, n - 1)); }

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok, info = false) => { linhas.push([nome, medido, meta, info ? 'informativo' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; };

const h0 = casos.filter(c => c.h0).length;
reg('M0 os dois ramos começam bit a bit iguais', `${h0}/${casos.length}`, '100%', casos.length > 0 && h0 === casos.length);
const longo = c => (c.A.perdeu == null || c.A.perdeu >= 1.5) && (c.B.perdeu == null || c.B.perdeu >= 1.5) && c.d0 <= 12;
const L = casos.filter(longo);
const NMIN = 20;
const d15A = med(L.map(c => c.A.d15)), d15B = med(L.map(c => c.B.d15));
reg('M1 o mais perto: mediana da distância ao condutor em 1,5 s, sem → com o botão', `${fmt(d15A)} → ${fmt(d15B)} m (Δ ${fmt(d15A - d15B)}; n = ${L.length})`, 'Δ ≥ 1,0 m', L.length >= NMIN && d15A - d15B >= 1.0);
const c2 = L.filter(c => c.B.t2 != null && c.B.t2 <= 1.5).length, c2A = L.filter(c => c.A.t2 != null && c.A.t2 <= 1.5).length;
const ep2 = L.length ? Math.sqrt(c2 / L.length * (1 - c2 / L.length) / L.length) : NaN;
reg('M2 (guarda) com o botão: um companheiro a ≤ 2 m do condutor em ≤ 1,5 s', `${pc(c2, L.length)} (${fmt(100 * c2 / L.length, 1)}% ± ${fmt(100 * ep2, 1)}; sem: ${pc(c2A, L.length)})`, '≥ 60%', L.length >= NMIN && c2 >= 0.6 * L.length);
const L2 = L.filter(c => c.A.s2 != null && c.B.s2 != null);
const s2A = med(L2.map(c => c.A.s2)), s2B = med(L2.map(c => c.B.s2));
reg('M3 um a mais na pressão: 2º companheiro mais perto do condutor em 2 s, sem → com', `${fmt(s2A)} → ${fmt(s2B)} m (Δ ${fmt(s2A - s2B)}; n = ${L2.length})`, 'Δ ≥ 1,5 m', L2.length >= NMIN / 2 && s2A - s2B >= 1.5);
const soma = (cs, f) => cs.reduce((s, c) => s + f(c), 0);
const fA = soma(casos, c => c.A.faltas), fB = soma(casos, c => c.B.faltas);
const ep4 = epSoma(porPartida.map(p => soma(p.casos, c => c.B.faltas - 1.5 * c.A.faltas)));
reg('M4 faltas do time 0 nos 2 s (todos os casos): sem → com o botão', `${fA} → ${fB} (com − 1,5 × sem − 2 = ${fmt(fB - 1.5 * fA - 2, 1)} ± ${fmt(ep4, 1)})`, 'com ≤ 1,5 × sem + 2', fB <= 1.5 * fA + 2);
// (o erro-padrão da fração dos ticks entre as partidas: os ticks de um mesmo lance não são independentes)
const co = soma(casos, c => c.B.corre1), ct = soma(casos, c => c.B.correTot1);
const ep5 = epSoma(porPartida.map(p => soma(p.casos, c => c.B.corre1 - (co / ct) * c.B.correTot1)));
reg('M5 escolhido a > 4 m do condutor, ≥ 1 s depois de escolhido, a ≥ vCorrida', `${pc(co, ct)} (${fmt(100 * co / ct, 1)}% ± ${fmt(100 * ep5 / ct, 1)})`, '≥ 80%', ct > 0 && co >= 0.8 * ct);
const mo = soma(casos, c => c.B.marcaOk), mt = soma(casos, c => c.B.marcaTot);
reg('M6 marca visível: o escolhido existe para o desenho com o pedido valendo', pc(mo, mt), '100%', mt > 0 && mo === mt);
const pd = soma(casos, c => c.B.p1Dobra), pt = soma(casos, c => c.B.p1Tot);
reg('M7 1º homem da IA já apertando: o botão chama OUTRO (dobra a marcação)', pt ? pc(pd, pt) : '— (sem o estado apertaProprio)', '≥ 95%', pt > 0 && pd >= 0.95 * pt);
// informativos
const d1A = med(L.map(c => c.A.d1)), d1B = med(L.map(c => c.B.d1));
reg('(diagnóstico) o mais perto em 1,0 s: sem → com', `${fmt(d1A)} → ${fmt(d1B)} m (Δ ${fmt(d1A - d1B)})`, 'Δ ≥ 2,0 m', true, true);
const bA = casos.filter(c => c.A.alcBote != null).length, bB = casos.filter(c => c.B.alcBote != null).length;
const lbA = L.filter(c => c.A.alcBote != null).length, lbB = L.filter(c => c.B.alcBote != null).length;
reg('(diagnóstico) bola ao alcance do bote em ≤ 2 s: todos · casos longos', `${pc(bA, casos.length)} → ${pc(bB, casos.length)} · ${pc(lbA, L.length)} → ${pc(lbB, L.length)}`, '—', true, true);
const c5 = soma(casos, c => c.B.corre), t5 = soma(casos, c => c.B.correTot);
reg('(diagnóstico) escolhido a > 4 m, ≥ 0,5 s depois de escolhido, a ≥ vCorrida', pc(c5, t5), '—', true, true);
for (const mod of MODELOS) {
  const Lm = L.filter(c => c.modelo === mod), Cm = casos.filter(c => c.modelo === mod);
  const r1 = Cm.filter(c => c.A.rouba).length, r2 = Cm.filter(c => c.B.rouba).length;
  reg(`humano '${mod}': d(1,5 s) sem → com · ≤ 2 m em ≤ 1,5 s · faltas · roubadas`, `${fmt(med(Lm.map(c => c.A.d15)))} → ${fmt(med(Lm.map(c => c.B.d15)))} m · ${pc(Lm.filter(c => c.B.t2 != null && c.B.t2 <= 1.5).length, Lm.length)} · ${soma(Cm, c => c.A.faltas)} → ${soma(Cm, c => c.B.faltas)} · ${r1} → ${r2} em ${Cm.length} casos`, '—', true, true);
}
// a conta direta de antes em blocos de 8 partidas (o que o teste de 8 partidas veria em cada conjunto)
if (porPartida.length >= 16) {
  const blocos = [];
  for (let b = 0; b + 8 <= porPartida.length; b += 8) {
    const cs = porPartida.slice(b, b + 8).flatMap(p => p.casos), Lb = cs.filter(longo);
    const m1 = med(Lb.map(c => c.A.d15)) - med(Lb.map(c => c.B.d15));
    const m2 = Lb.filter(c => c.B.t2 != null && c.B.t2 <= 1.5).length / Lb.length;
    const a4 = soma(cs, c => c.A.faltas), b4 = soma(cs, c => c.B.faltas);
    const m5 = soma(cs, c => c.B.corre1) / soma(cs, c => c.B.correTot1);
    blocos.push(`${porPartida[b].s}: ${fmt(m1)} · ${Math.round(100 * m2)}% · ${a4}→${b4} · ${fmt(100 * m5, 1)}%`);
  }
  reg('(dispersão) blocos de 8 partidas: M1 Δ · M2 · M4 · M5 pela conta direta', blocos.join(' | '), '—', true, true);
}
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(`lógica: ${JS} · ${NP} partidas de 2 × ${MIN} min (sementes ${SEM0}–${SEM0 + NP - 1}, ${nPar} processos) · ${casos.length} casos · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-pressao-humano: REPROVOU (${falhas})` : '\nteste-pressao-humano: PASSOU');
process.exit(falhas ? 1 : 0);
