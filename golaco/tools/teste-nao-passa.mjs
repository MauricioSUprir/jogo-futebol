// O jogador que chega na bola quase dominada não passa por cima dela (pedido do dono, 15/10: "jogadores passam da bola
// quando estão com ela praticamente dominada, ajeite").
//
// Medido na partida de verdade (18 partidas de 2 × 3 min, sementes fixas): a IA joga pelos dois times em 6 delas e, nas
// outras 12, o controlado do time 0 é o humano roteirizado como no celular deitado (30 qps, sem o MOD; com a bola vindo
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
// (Fica para depois: logo depois do domínio a bola ao lado do pé, fora do alcance da frente do pé — ele vai buscá-la e
// corre ao lado dela a ~0,6 m até passar, lado 1102 t 19824 #107. O toque com a parte de dentro/fora do pé resolvia, mas
// tirava os chutes de fora da área no painel: 39 → 32–34%, abaixo da meta de 35–40%.)
//
// Metas:
//  1. "passou da bola" ≤ 0,5 por partida (todos os jogadores; a publicada: 0,89 nestas 18, 1,33 em 24 de 2 × 4 min);
//  2. bola de passe para outro, lenta, colada (≤ 0,6 m) no pé de quem não é o recebedor por ≥ 0,2 s sem ele tocar: 0
//     (a publicada: 5);
//  3. depois de passar da bola, o adversário fica com ela: 0 (a publicada: 6).
//   node tools/teste-nao-passa.mjs [--js <pasta js>] [--detalhe]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const detalhe = args.includes('--detalhe');
const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
// (medir-passa.mjs lê o mesmo --js da linha de comando)
const MP = await import(pathToFileURL(path.join(AQUI, 'medir-passa.mjs')).href);

const MIN = 3;
const CENAS = [['ia', [2101, 2118, 2135, 2152, 2305, 2322]], ['frente', [2169, 2186, 2203, 2220, 2339, 2356]], ['lado', [2237, 2254, 2271, 2288, 2373, 2390]]];
const res = [];
let n = 0;
for (const [cena, sems] of CENAS) {
  for (const sem of sems) {
    const r = MP.rodarPartida(P, sem, cena, MIN, { qps30: cena !== 'ia' });
    const cs = r.casos.filter(MP.contaPassou);
    res.push({ cena, sem, cs, bl: r.bloqueios });
    n++;
  }
}
const todos = res.flatMap(r => r.cs), bloq = res.flatMap(r => r.bl);
const perdeu = todos.filter(c => c.perdeu);
const lin = [['cena', 'partidas', 'passou da bola', 'do controlado', 'perdeu a bola', 'bola atrás p50 / máx (m)', 'passe colado no pé de outro']];
for (const [cena] of CENAS) {
  const rr = res.filter(r => r.cena === cena), cs = rr.flatMap(r => r.cs), at = cs.map(c => c.atras).sort((a, b) => a - b);
  lin.push([cena, rr.length, cs.length, cs.filter(c => c.hum).length, cs.filter(c => c.perdeu).length, at.length ? `${fmt(at[Math.floor(at.length / 2)], 2)} / ${fmt(at[at.length - 1], 2)}` : '—', rr.flatMap(r => r.bl).length]);
}
console.log(`"Passou da bola" na partida — lógica de ${path.relative(process.cwd(), JS) || '.'} (${n} partidas de 2 × ${MIN} min)`);
console.log(tabelaTexto(lin));
if (detalhe) for (const c of todos) console.log(`  ${c.sem} t0 ${c.t0} → ${c.tick} #${c.id}${c.hum ? ' (controlado)' : ''} ${MP.SITS[c.sit]} s ${fmt(c.s, 1)} vb ${fmt(c.vb, 1)} ${c.tocou != null ? `tocou ${c.tocou} ticks antes (${c.tipoUlt})` : 'sem tocar'} analógico ${c.aX == null ? 'solto' : fmt(c.aX * 180 / Math.PI, 0) + '°'} atrás ${fmt(c.atras, 2)} m${c.perdeu ? ' PERDEU' : ''}`);
if (detalhe) for (const x of bloq) console.log(`  colada: sem ${x.sem} t ${x.tick} #${x.id} — passe para #${x.para}, bola ${fmt(x.vb, 1)} m/s`);
const porPartida = todos.length / n;
const metas = [
  ['"passou da bola" por partida (todos)', `${fmt(porPartida, 2)} (${todos.length} em ${n})`, '≤ 0,5', porPartida <= 0.5],
  ['passe lento colado no pé de quem não é o recebedor, sem tocar (≥ 0,2 s)', `${bloq.length}`, '0', bloq.length === 0],
  ['passou da bola e o adversário ficou com ela', `${perdeu.length}`, '0', perdeu.length === 0],
];
console.log('\n' + tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(x => [x[0], x[1], x[2], x[3] ? 'PASSOU' : 'REPROVOU'])]));
process.exit(metas.every(x => x[3]) ? 0 : 1);
