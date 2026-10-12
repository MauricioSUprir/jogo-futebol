// Cortejo do pré-jogo (js/cortejo.js — pedido do dono de 11/10: "jogadores entrando em campo, fazendo a fila"): os 22
// titulares e os 3 árbitros saem do túnel e fazem a fila no meio-campo SÓ com a locomoção pura do jogo, num mundo à
// parte. Metas (PESQUISA-PREJOGO.md §2; as mesmas do teste-patinacao para os pés):
//   1) pé plantado: o tornozelo DESENHADO (pose) parado — ≤ 0,05 m/s enquanto o pé fica no mesmo ponto;
//   2) pé que salta: deslocamento do tornozelo ≤ (2,5·v + 3)·dt em todo quadro (Clark et al. 2023; razão ≤ 1);
//   3) ninguém atravessa ninguém: distância entre os corpos ≥ 0,6 m em todo quadro (e os tornozelos de dois
//      andantes nunca a < 0,15 m);
//   3b) ninguém atravessa o estádio: o corpo (0,25 m) fora dos sólidos do pré-jogo (estadio-forma.js solidoEm: placas,
//      bancos, arquibancada; o corredor do túnel e o vão das placas na frente dele são livres) — na 1ª versão as duas
//      colunas e os árbitros passavam por dentro das placas do lado de cá (z = 40, inteiras de ponta a ponta);
//   4) a fila: erro de vaga ≤ 0,10 m, de frente para a tribuna (rumo ≤ 5°), todos parados até 50 s de cortejo;
//   5) cabe no túnel (o último da coluna antes do fundo, com folga ≥ 0,5 m);
//   6) filaFinal() = o fim da simulação (≤ 0,10 m) e a foto/restauração refaz o mesmo cortejo (determinismo);
//   7) custo ≤ 0,25 ms por passo dos 25 (Node);
//   8) o mundo da partida não muda: hashMundo de criarPartida igual antes e depois do cortejo e 600 passos iguais
//      com e sem o cortejo no mesmo processo.
// Na versão publicada não há cortejo (reprova no import).
//   node tools/teste-cortejo.mjs [--js <pasta js>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

let CJ = null;
try { CJ = await imp('cortejo.js'); } catch (e) { CJ = null; }
if (!CJ) {
  reg('cortejo do pré-jogo (js/cortejo.js)', 'não existe (a partida abre direto na saída de bola)', 'existe', false);
} else {
  const { criarCortejo, passoCortejo, tempoCortejo, fotoCortejo, restaurarCortejo, filaFinal, vagaFinal, chegaram, cabeNoTunel, CORTEJO } = CJ;
  const { pose, J, NJ } = await imp('anim.js');
  const { PASSO } = await imp('config.js');
  const { criarPartida, passoPartida } = await imp('partida.js');
  const { hashMundo } = await imp('sim.js');
  const { solidoEm } = await imp('estadio-forma.js');

  // o mundo da partida antes de tudo (o cortejo lê os times dele, só na criação)
  const mA = criarPartida({ semente: 7 });
  const hA0 = hashMundo(mA);
  const c = criarCortejo(mA.times);
  const N = c.andantes.length;
  reg('Andantes: 22 titulares + 3 árbitros', `${N} (${c.andantes.filter(a => a.arb).length} árbitros, goleiros ${c.andantes.filter(a => a.goleiro).length})`, '25 (3, 2)', N === 25 && c.andantes.filter(a => a.arb).length === 3 && c.andantes.filter(a => a.goleiro).length === 2);
  const tun = cabeNoTunel();
  reg('A coluna cabe no túnel (o último antes do fundo)', `último em z ${fmt(tun.ultimo, 1)}, fundo ${fmt(tun.fundo, 1)} (folga ${fmt(tun.folga, 2)} m); ${fmt(tun.largura, 2)} m até a parede`, 'folga ≥ 0,5 m; ≥ 1,5 m da parede', tun.folga >= 0.5 && tun.largura >= 1.5);

  // ---------------------------------------------------------------- simula e mede (pose de todos a cada passo)
  const out = new Float32Array(NJ * 3);
  const ant = new Map();
  let maxPlantado = 0, maxSalto = 0, nSalto = 0, minCorpo = Infinity, minTorn = Infinity, nan = 0, quemCorpo = '';
  // ninguém atravessa o estádio: o corpo (raio 0,25 m, no joelho e no peito) fora dos sólidos do pré-jogo
  // (estadio-forma.js solidoEm: placas, bancos, arquibancada, paredes; o corredor do túnel é livre)
  const solidos = new Map();
  const T = 50;
  let msPasso = 0;
  const foto0 = fotoCortejo(c);
  let foto20 = null, estado30 = null;
  const torn = new Float64Array(N * 6);
  for (let i = 0; i < T / PASSO; i++) {
    if (i === Math.round(20 / PASSO)) foto20 = fotoCortejo(c);
    const t0 = performance.now();
    passoCortejo(c);
    msPasso += performance.now() - t0;
    if (c.tick === Math.round(30 / PASSO)) estado30 = c.andantes.map(a => [a.j.x, a.j.z, a.j.rumo, a.j.pes[0].x, a.j.pes[1].z]);
    for (let k = 0; k < N; k++) {
      const a = c.andantes[k], j = a.j;
      pose(j, c.mini, out);
      for (let q = 0; q < out.length; q++) if (!Number.isFinite(out[q])) { nan++; break; }
      const v = Math.hypot(j.vx, j.vz);
      const cur = [out[J.tornozeloE * 3], out[J.tornozeloE * 3 + 1], out[J.tornozeloE * 3 + 2], out[J.tornozeloD * 3], out[J.tornozeloD * 3 + 1], out[J.tornozeloD * 3 + 2]];
      for (let q = 0; q < 6; q++) torn[k * 6 + q] = cur[q];
      const pl = [j.pes[0].apoio ? `${j.pes[0].x},${j.pes[0].z}` : null, j.pes[1].apoio ? `${j.pes[1].x},${j.pes[1].z}` : null];
      const an = ant.get(a.id);
      if (an) {
        for (let p = 0; p < 2; p++) {
          const d = Math.hypot(cur[p * 3] - an.cur[p * 3], cur[p * 3 + 1] - an.cur[p * 3 + 1], cur[p * 3 + 2] - an.cur[p * 3 + 2]);
          if (pl[p] && pl[p] === an.pl[p]) maxPlantado = Math.max(maxPlantado, d / PASSO);
          const lim = (2.5 * v + 3) * PASSO;
          if (d > lim + 1e-9) nSalto++;
          maxSalto = Math.max(maxSalto, d / lim);
        }
      }
      ant.set(a.id, { cur, pl });
      for (const y of [0.5, 1.3]) {
        const s = solidoEm(j.x, y, j.z, 0.25, true);
        if (s) { const q = solidos.get(s) ?? { n: 0, ex: '' }; if (!q.n) q.ex = `${a.id} em (${fmt(j.x, 1)}, ${fmt(j.z, 1)}) aos ${fmt(tempoCortejo(c), 1)} s`; q.n++; solidos.set(s, q); }
      }
    }
    // ninguém atravessa ninguém: corpos (centro) e tornozelos de andantes diferentes
    for (let a = 0; a < N; a++) {
      const ja = c.andantes[a].j;
      for (let b = a + 1; b < N; b++) {
        const jb = c.andantes[b].j;
        const d = Math.hypot(ja.x - jb.x, ja.z - jb.z);
        if (d < minCorpo) { minCorpo = d; quemCorpo = `${ja.id}×${jb.id} aos ${fmt(tempoCortejo(c), 1)} s`; }
        for (let p = 0; p < 2; p++) for (let q = 0; q < 2; q++) {
          const dt = Math.hypot(torn[a * 6 + p * 3] - torn[b * 6 + q * 3], torn[a * 6 + p * 3 + 2] - torn[b * 6 + q * 3 + 2]);
          if (dt < minTorn) minTorn = dt;
        }
      }
    }
  }
  reg('Pé plantado: tornozelo desenhado parado (25 andantes, 50 s)', `${fmt(maxPlantado, 4)} m/s`, '≤ 0,05 m/s', maxPlantado <= 0.05);
  reg('Pé que salta: deslocamento ≤ (2,5·v + 3)·dt', `razão máx ${fmt(maxSalto, 3)}; ${nSalto} quadros acima`, '≤ 1; 0', maxSalto <= 1 && nSalto === 0);
  reg('Ninguém atravessa ninguém (centro dos corpos)', `mín ${fmt(minCorpo, 2)} m (${quemCorpo}); tornozelos de dois andantes ≥ ${fmt(minTorn, 2)} m`, '≥ 0,6 m; ≥ 0,15 m', minCorpo >= 0.6 && minTorn >= 0.15);
  reg('Pose sem NaN', `${nan} poses com NaN`, '0', nan === 0);
  reg('Ninguém atravessa o estádio (placas, bancos, arquibancada; o corredor do túnel é livre)',
    solidos.size ? [...solidos].map(([s, q]) => `${s}: ${q.n} (1º: ${q.ex})`).join('; ') : '0 contatos (corpo com 0,25 m de folga, no joelho e no peito)', '0', solidos.size === 0);

  // ---------------------------------------------------------------- a fila
  let errPos = 0, errRumo = 0, vMax = 0, ultimo = 0;
  const q = {};
  c.andantes.forEach((a, i) => {
    vagaFinal(c, i, q);
    errPos = Math.max(errPos, Math.hypot(a.j.x - q.x, a.j.z - q.z));
    const dr = Math.abs(((a.j.rumo - CORTEJO.rumoFila + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    errRumo = Math.max(errRumo, dr);
    vMax = Math.max(vMax, Math.hypot(a.j.vx, a.j.vz));
    ultimo = Math.max(ultimo, a.chegou ?? 99);
  });
  reg('Fila: erro de vaga', `${fmt(errPos, 3)} m`, '≤ 0,10 m', errPos <= 0.1);
  reg('Fila: de frente para a tribuna', `${fmt(errRumo * 180 / Math.PI, 1)}°`, '≤ 5°', errRumo * 180 / Math.PI <= 5);
  reg('Fila: todos parados até 50 s de cortejo', `último aos ${fmt(ultimo, 1)} s; velocidade máx no fim ${fmt(vMax, 3)} m/s; chegaram ${chegaram(c)}`, '≤ 50 s; ≤ 0,05', ultimo <= 50 && vMax <= 0.05 && chegaram(c));
  // a ordem: time 0 à esquerda (x −), time 1 à direita, árbitros no meio
  const xs = t => c.andantes.filter(a => a.time === t).map(a => a.j.x);
  const ordemOk = xs(0).every(x => x < -1.5) && xs(1).every(x => x > 1.5) && xs(2).every(x => Math.abs(x) < 1);
  reg('Fila: mandante à esquerda da TV, visitante à direita, árbitros no meio', `x mandante ${fmt(Math.min(...xs(0)), 1)}…${fmt(Math.max(...xs(0)), 1)}; visitante ${fmt(Math.min(...xs(1)), 1)}…${fmt(Math.max(...xs(1)), 1)}; árbitros ${xs(2).map(x => fmt(x, 2)).join(', ')}`, 'x < 0 | x > 0 | |x| < 1', ordemOk);

  // ---------------------------------------------------------------- filaFinal e foto/restauração
  {
    const c2 = criarCortejo(mA.times);
    filaFinal(c2);
    let d = 0;
    c2.andantes.forEach((a, i) => { d = Math.max(d, Math.hypot(a.j.x - c.andantes[i].j.x, a.j.z - c.andantes[i].j.z)); });
    const parados = c2.andantes.every(a => a.j.pes[0].apoio && a.j.pes[1].apoio && a.j.vx === 0 && a.j.vz === 0);
    // a fila montada fica parada (pés plantados) se a simulação continuar
    const antes = c2.andantes.map(a => [a.j.x, a.j.z]);
    for (let i = 0; i < 120; i++) passoCortejo(c2);
    let mexeu = 0;
    c2.andantes.forEach((a, i) => { mexeu = Math.max(mexeu, Math.hypot(a.j.x - antes[i][0], a.j.z - antes[i][1])); });
    reg('filaFinal() = o fim da simulação (e fica parada)', `diferença máx ${fmt(d, 3)} m; pés plantados ${parados}; anda ${fmt(mexeu, 3)} m em 2 s`, '≤ 0,10 m; sim; ≤ 0,02 m', d <= 0.1 && parados && mexeu <= 0.02);
  }
  {
    // restaurar a foto de 20 s e andar até 30 s dá o mesmo estado da 1ª vez; a foto do começo também
    const c3 = criarCortejo(mA.times);
    restaurarCortejo(c3, foto20);
    while (tempoCortejo(c3) < 30 - 1e-9) passoCortejo(c3);
    let d = 0;
    c3.andantes.forEach((a, i) => { const e = estado30[i]; d = Math.max(d, Math.abs(a.j.x - e[0]), Math.abs(a.j.z - e[1]), Math.abs(a.j.rumo - e[2]), Math.abs(a.j.pes[0].x - e[3]), Math.abs(a.j.pes[1].z - e[4])); });
    restaurarCortejo(c3, foto0);
    const volta = tempoCortejo(c3) === 0 && c3.andantes.every((a, i) => a.j.x === foto0.js[i].x);
    reg('Foto e restauração refazem o mesmo cortejo (20 s → 30 s)', `diferença ${d}; volta ao começo ${volta}`, '0; sim', d === 0 && volta);
  }

  // ---------------------------------------------------------------- custo e o mundo da partida
  const msMedio = msPasso / (T / PASSO);
  reg('Custo do cortejo (25 andantes, Node)', `${fmt(msMedio, 3)} ms por passo`, '≤ 0,25 ms', msMedio <= 0.25);
  const hA1 = hashMundo(mA);
  for (let i = 0; i < 600; i++) passoPartida(mA, { 0: { x: 0, z: 0, botoes: 0 } }, null);
  const mB = criarPartida({ semente: 7 });
  for (let i = 0; i < 600; i++) passoPartida(mB, { 0: { x: 0, z: 0, botoes: 0 } }, null);
  reg('Mundo da partida intocado (hash antes/depois do cortejo; 600 passos com e sem)', `${hA0 === hA1 ? 'igual' : 'DIFERENTE'}; ${hashMundo(mA) === hashMundo(mB) ? 'igual' : 'DIFERENTE'}`, 'igual; igual', hA0 === hA1 && hashMundo(mA) === hashMundo(mB));
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-cortejo: REPROVOU (${falhas})` : '\nteste-cortejo: PASSOU');
process.exit(falhas ? 1 : 0);
