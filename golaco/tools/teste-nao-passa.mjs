// O jogador que chega na bola quase dominada não passa por cima dela (pedido do dono, 15/10: "jogadores passam da bola
// quando estão com ela praticamente dominada, ajeite").
//
// Medido na partida de verdade (42 partidas de 2 × 3 min, sementes fixas): a IA joga pelos dois times em 14 delas e, nas
// outras 28, o controlado do time 0 é o humano roteirizado como no celular deitado (30 qps, sem o MOD; com a bola vindo
// para ele o analógico vai para a frente — o ataque ±30° — ou para um lado sorteado e fica lá até ele dominar e por mais
// 0,8 s). "Passou da bola" (tools/medir-passa.mjs, a mesma conta): o jogador que é da bola — o condutor, o recebedor do
// passe ou com o domínio marcado, ou o mais perto da bola solta — chega a ≤ 1 m dela, no chão e a ≤ 4 m/s, correndo
// (≥ 2 m/s) com ela à frente; e o corpo passa por ela sem ninguém mais tocar: a bola fica ≥ 0,3 m atrás do quadril no
// sentido em que ele vinha, a ≤ 0,8 m de lado, com ele ainda indo para a frente (≥ 1 m/s), sem a bola ter sido mandada
// para trás. Fora da conta o corte ou a inversão pedidos (analógico a mais de 60° do sentido em que ele vinha), a não ser
// que a bola fique mais de 1 m atrás.
//
// Casos reais da versão publicada (d3725f55) que nasceram a correção (reprise pareada das fotos do mundo, 48 casos em 24
// partidas; detalhes no PESQUISA.md §"Passou da bola"):
//  A. o recebedor de um passe lento só com o domínio MARCADO tirava a vez de todo mundo (sim.js bolaLivre): o defensor com
//     a bola entre os pés passava por ela (frente 1034 t 16989 #5, frente 1102 t 24196 #9: 1,45 m e perdeu);
//  B. a IA domina embalada com a entrada da recepção (chegar devagar ao ponto do encontro) e no tick seguinte a do
//     condutor: o 1º toque planejado para o corpo que ia frear deixava a bola parada e ele passava dela (ia 1051 t 16134
//     #106, ia 1136 t 18096 #106, ...);
//  C. a proteção (MOD com o marcador perto) em disparada: a bola posta onde o corpo estaria andando devagar (ia 1034 t
//     1106 #9: 6,5 m/s, 2,09 m);
//  D. (contraprova, 15/10) o companheiro de quem passou, com o passe lento entre os pés, também o deixava correr colado
//     (só o adversário tinha a vez): ia 3135 t 15397 #10, passe para #4 a 3,0 m/s;
//  E. (final, 15/10) a IA que dominava embalada pedia no tick seguinte o rumo da condução (em volta do gol adversário)
//     90–155° da corrida, a 5–7 m/s: o toque mandava a bola na linha nova e o corpo passava 1–2 m dela (ia 3169 t 6141
//     #110: 6,3 m/s, 119°, 1,77 m e perdeu) — agora ela vira no limite do embalo e freia (ia-ataque.js viradaComEmbalo);
//  F. (contraprova da rodada final, 15/10) o domínio marcado de um passe ou de uma bola livre que outro jogador já tinha
//     dominado (ou que o goleiro já tinha na mão) seguia guiando o corpo — só a bola livre refazia ou apagava o plano: em
//     corrida o corpo ia reto até o ponto do toque, de frente ou assistido a ≤ 1 m/s (12118 t 11047 #109, nas sementes
//     novas: 7 m/s reto 0,6 s para o ponto de um passe que o humano já tinha dominado, 3,67 m além da bola) — agora a
//     partida apaga o plano assim que a bola é de outro (sim.js);
//  G. (depois da junção com a #471, 15/10) fora da conta, listados à parte: quem acabou de ter a bola roubada e ainda não
//     pode dominar (o bote da #471 manda a bola para o lado ou para trás no caminho do condutor: 3169 t 6291 #10 e 2220
//     t 17834 #7, 2 m "atrás" e o adversário com ela) e quem foi empurrado por trombada (2220 t 5359 #105: parado com a
//     bola dominada, empurrado a 3,7 m/s para longe dela por quem pressionava — a carga é da frente das faltas, #480);
// (Fica para depois: logo depois do domínio a bola ao lado do pé, fora do alcance da frente do pé — ele vai buscá-la e
// corre ao lado dela a ~0,6 m até passar, lado 1102 t 19824 #107. O toque com a parte de dentro/fora do pé resolvia, mas
// tirava os chutes de fora da área no painel: 39 → 32–34%, abaixo da meta de 35–40%.)
//
// Metas (a publicada, c2f76d69, nestas 42: 0,81 / 12 / 7; nas 18 primeiras: 0,89 / 5 / 6; sem o E: 0,43 / 0 / 1;
// com o E: 0,29 / 0 / 0 — da IA 14 → 5 casos, nenhuma virada a mais de 60°; do humano roteirizado 7, 0 perdidos):
//  1. "passou da bola" ≤ 0,5 por partida (todos os jogadores; a publicada: 1,33 em 24 de 2 × 4 min);
//  2. bola de passe para outro, lenta, colada (≤ 0,6 m) no pé de quem não é o recebedor por ≥ 0,2 s sem ele tocar: 0
//     (o adversário de quem passou ou o companheiro dele);
//  3. depois de passar da bola, o adversário fica com ela: 0;
//  4. (contraprova da rodada final) domínio marcado que sobra com a bola no pé de outro por ≥ 2 passos: 0 (antes da
//     correção F, nestas 42: 290, 93 do controlado; com o F e a junção com a #471: 0 — e 0,38 / 0 / 0 nas metas 1–3,
//     com o G; ver o PESQUISA.md §6).
//   node tools/teste-nao-passa.mjs [--js <pasta js>] [--detalhe] [--par 3] [--json casos.json]
// (uma partida por processo, até --par ao mesmo tempo: as 42 partidas levavam 687 s no CI num processo só)
import { fork } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const detalhe = args.includes('--detalhe');
// (medir-passa.mjs lê o mesmo --js da linha de comando; só os SITS e o contaPassou são usados aqui no pai)
const MP = await import(pathToFileURL(path.join(AQUI, 'medir-passa.mjs')).href);

const MIN = 3;
// (contraprova, 15/10: + 8 partidas por cena, 3101–3492 — nas 18 primeiras a correção passava as três metas, nas 24 novas
// reprovava a 2 e a 3; amostra só cresce)
const CENAS = [['ia', [2101, 2118, 2135, 2152, 2305, 2322, 3101, 3118, 3135, 3152, 3169, 3186, 3203, 3220]],
  ['frente', [2169, 2186, 2203, 2220, 2339, 2356, 3237, 3254, 3271, 3288, 3305, 3322, 3339, 3356]],
  ['lado', [2237, 2254, 2271, 2288, 2373, 2390, 3373, 3390, 3407, 3424, 3441, 3458, 3475, 3492]]];
if (args.includes('--filho')) {
  // uma partida: os casos que contam e os passes colados (objetos simples: vão pela mensagem do processo)
  const cena = arg('--cena'), sem = +arg('--s');
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const r = MP.rodarPartida(P, sem, cena, MIN, { qps30: cena !== 'ia' });
  await new Promise(ok => process.send({ cena, sem, cs: r.casos.filter(MP.contaPassou), fo: r.casos.filter(c => c.fora && (!c.inversao || c.atras > 1.0)), bl: r.bloqueios, pv: r.planosVelhos }, ok));
  process.exit(0);
}
const t0 = Date.now();
const FILA = CENAS.flatMap(([cena, sems]) => sems.map(sem => ({ cena, sem })));
const nPar = Math.max(1, Math.min(FILA.length, os.availableParallelism?.() ?? os.cpus().length, +arg('--par', 3)));
const res = [];
let prox = 0;
await Promise.all(Array.from({ length: nPar }, async () => {
  while (prox < FILA.length) {
    const { cena, sem } = FILA[prox++];
    res.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), [...args, '--filho', '--cena', cena, '--s', String(sem)]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', cod => { if (cod) erro(new Error(`${cena} ${sem}: saiu com ${cod}`)); });
    }));
  }
}));
// a mesma ordem do laço de antes (cena, semente), para o --detalhe e o --json
const ordem = new Map(FILA.map((x, k) => [`${x.cena} ${x.sem}`, k]));
res.sort((a, b) => ordem.get(`${a.cena} ${a.sem}`) - ordem.get(`${b.cena} ${b.sem}`));
const n = res.length;
const todos = res.flatMap(r => r.cs), bloq = res.flatMap(r => r.bl), velhos = res.flatMap(r => r.pv);
const perdeu = todos.filter(c => c.perdeu);
const lin = [['cena', 'partidas', 'passou da bola', 'do controlado', 'perdeu a bola', 'bola atrás p50 / máx (m)', 'passe colado no pé de outro', 'domínio velho (do controlado)', 'fora da conta: roubado / empurrado (perdeu)']];
for (const [cena] of CENAS) {
  const rr = res.filter(r => r.cena === cena), cs = rr.flatMap(r => r.cs), at = cs.map(c => c.atras).sort((a, b) => a - b);
  lin.push([cena, rr.length, cs.length, cs.filter(c => c.hum).length, cs.filter(c => c.perdeu).length, at.length ? `${fmt(at[Math.floor(at.length / 2)], 2)} / ${fmt(at[at.length - 1], 2)}` : '—', rr.flatMap(r => r.bl).length, `${rr.flatMap(r => r.pv).length} (${rr.flatMap(r => r.pv).filter(x => x.hum).length})`,
    (fo => `${fo.filter(c => c.fora === 'roubado').length} / ${fo.filter(c => c.fora === 'empurrado').length} (${fo.filter(c => c.perdeu).length})`)(rr.flatMap(r => r.fo))]);
}
console.log(`"Passou da bola" na partida — lógica de ${path.relative(process.cwd(), JS) || '.'} (${n} partidas de 2 × ${MIN} min; ${nPar} processos, ${fmt((Date.now() - t0) / 1000, 0)} s)`);
console.log(tabelaTexto(lin));
if (detalhe) for (const c of todos) console.log(`  ${c.sem} t0 ${c.t0} → ${c.tick} #${c.id}${c.hum ? ' (controlado)' : ''} ${MP.SITS[c.sit]} s ${fmt(c.s, 1)} vb ${fmt(c.vb, 1)} ${c.tocou != null ? `tocou ${c.tocou} ticks antes (${c.tipoUlt})` : 'sem tocar'} analógico ${c.aX == null ? 'solto' : fmt(c.aX * 180 / Math.PI, 0) + '°'} atrás ${fmt(c.atras, 2)} m${c.perdeu ? ' PERDEU' : ''}`);
if (detalhe) for (const c of res.flatMap(r => r.fo)) console.log(`  fora da conta (${c.fora}): ${c.sem} t0 ${c.t0} → ${c.tick} #${c.id}${c.hum ? ' (controlado)' : ''} ${MP.SITS[c.sit]} s ${fmt(c.s, 1)} atrás ${fmt(c.atras, 2)} m${c.perdeu ? ' PERDEU' : ''}`);
if (detalhe) for (const x of bloq) console.log(`  colada: sem ${x.sem} t ${x.tick} #${x.id} — passe para #${x.para}, bola ${fmt(x.vb, 1)} m/s`);
if (detalhe) for (const x of velhos) console.log(`  domínio velho: sem ${x.sem} t ${x.tick} #${x.id}${x.hum ? ' (controlado)' : ''} modo ${x.modo} a ${fmt(x.s, 1)} m/s`);
if (arg('--json', null)) fs.writeFileSync(arg('--json'), JSON.stringify(res, null, 1));
const porPartida = todos.length / n;
const metas = [
  ['"passou da bola" por partida (todos)', `${fmt(porPartida, 2)} (${todos.length} em ${n})`, '≤ 0,5', porPartida <= 0.5],
  ['passe lento colado no pé de quem não é o recebedor, sem tocar (≥ 0,2 s)', `${bloq.length}`, '0', bloq.length === 0],
  ['passou da bola e o adversário ficou com ela', `${perdeu.length}`, '0', perdeu.length === 0],
  ['domínio marcado que sobra com a bola no pé de outro (≥ 2 passos; guiava o corpo)', `${velhos.length}`, '0', velhos.length === 0],
];
console.log('\n' + tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(x => [x[0], x[1], x[2], x[3] ? 'PASSOU' : 'REPROVOU'])]));
process.exit(metas.every(x => x[3]) ? 0 : 1);
