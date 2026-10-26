// apoio-faixa (D7, item 24; PESQUISA-CATEGORIA-D.md §9): a conta do "à frente / de lado / atrás" do teste-apoio por FAIXA
// de 10 m do portador, ao lado da mesma conta na Metrica (tools/pesquisa/apoio_metrica.py), com quem conduz em cada faixa e o
// "à frente" por posição de quem conduz. IA × IA (entradaDemoPartida), 2 tempos de 4 min, amostra a cada 0,1 s de bola rolando.
//   node tools/apoio-faixa.mjs [--js <pasta>] [--sementes 8] [--sem0 1] [--set CONST.caminho=JSON ...]
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const SETS = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
const faixa = u => Math.max(0, Math.min(10, Math.floor((u + 52.5) / 10)));

// Metrica (Sample Game 1 e 2), por faixa: [n, à frente %, de lado %, atrás %, à frente por instante, mais à frente (qualquer
// distância), quem conduz]. As funções da Metrica saem da posição média (4 de trás, 3 do meio, 3 da frente: ATA = pontas e
// centroavante juntos)
const METRICA = {
  '-47.5': [194, 46.0, 50.2, 3.9, 3.19, 7.68, 'ZAG 61 LAT 13 MEI 12 ATA 12'],
  '-37.5': [677, 45.4, 44.7, 10.0, 2.52, 7.04, 'ZAG 38 LAT 35 MEI 19 ATA 7'],
  '-27.5': [1342, 41.4, 39.0, 19.7, 2.49, 6.29, 'ZAG 38 LAT 28 MEI 25 ATA 5'],
  '-17.5': [2113, 40.7, 36.0, 23.3, 2.44, 6.10, 'ZAG 35 MEI 29 LAT 25 ATA 7'],
  '-7.5': [3031, 40.7, 35.2, 24.1, 2.58, 5.67, 'MEI 34 ZAG 30 LAT 21 ATA 12'],
  '2.5': [2624, 38.2, 32.7, 29.2, 2.40, 5.06, 'MEI 36 LAT 23 ZAG 18 ATA 14'],
  '12.5': [2817, 30.1, 35.5, 34.5, 1.87, 4.24, 'MEI 38 ATA 28 LAT 19 ZAG 9'],
  '22.5': [2172, 22.7, 38.7, 38.6, 1.30, 3.44, 'ATA 38 MEI 34 LAT 15 ZAG 3'],
  '32.5': [1447, 10.6, 47.1, 42.3, 0.50, 2.33, 'ATA 50 MEI 22 LAT 13 ZAG 1'],
  '42.5': [648, 1.9, 53.6, 44.5, 0.08, 1.10, 'ATA 54 MEI 15 LAT 13 ZAG 0'],
  '52.5': [84, 0.3, 27.4, 72.3, 0.01, 0.20, 'ATA 71 MEI 13 LAT 6 ZAG 2'],
};

if (args.includes('--filho')) {
  const C = await import(pathToFileURL(path.join(JS, 'config.js')).href);
  for (const s of SETS) {
    const [k, v] = s.split(/=(.*)/s), p = k.split('.');
    let o = C[p[0]];
    for (const q of p.slice(1, -1)) o = o[q];
    o[p.at(-1)] = JSON.parse(v);
  }
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const m = P.criarPartida({ semente: +arg('--s', 1), minutosPorTempo: 4 });
  const R = Array.from({ length: 11 }, () => ({ n: 0, fr: 0, la: 0, at: 0, adiante: 0, port: {}, porPos: {} }));
  for (let i = 0; i < 8 * 3600 + 1200; i++) {
    P.passoPartida(m, P.entradaDemoPartida(m));
    if (m.partida.estado === 'fim') break;
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    if (!rolando || i % 6) continue;
    const dono = M.donoDaBola(m);
    if (!dono || dono.posicao === 'GOL' || m.naMao != null) continue;
    const p = M.portador(m);
    if (!p) continue;
    const lado = m.ataca[p.time], up = p.x * lado, r = R[faixa(up)];
    r.n++;
    r.port[p.posicao] = (r.port[p.posicao] ?? 0) + 1;
    const pp = (r.porPos[p.posicao] ??= [0, 0]);
    pp[0]++;
    for (const o of m.jogadores) {
      if (o.time !== p.time || o === p || o.posicao === 'GOL') continue;
      const du = (o.x - p.x) * lado, dw = (o.z - p.z) * lado, a = Math.abs(Math.atan2(dw, du));
      if (du > 0) r.adiante++;
      if (Math.hypot(du, dw) > 30) continue;
      if (a < Math.PI / 3) { r.fr++; pp[1]++; } else if (a > 2 * Math.PI / 3) r.at++; else r.la++;
    }
  }
  process.send(R);
  process.exit(0);
}

const NS = +arg('--sementes', 8), S0 = +arg('--sem0', 1), fila = Array.from({ length: NS }, (_, k) => S0 + k), res = [];
const nPar = Math.max(1, Math.min(NS, os.availableParallelism?.() ?? os.cpus().length, 4));
await Promise.all(Array.from({ length: nPar }, async () => {
  while (fila.length) {
    const s = fila.shift();
    res.push(await new Promise((ok, err) => {
      const c = fork(fileURLToPath(import.meta.url), ['--js', JS, '--filho', '--s', String(s), ...SETS.flatMap(x => ['--set', x])]);
      c.on('message', ok); c.on('error', err);
    }));
  }
}));
console.log(`apoio por faixa do portador · ${NS} sementes · ${JS}${SETS.length ? ' · ' + SETS.join(' ') : ''}`);
console.log('faixa  | jogo: à frente / lado / atrás · à frente por instante · mais à frente | Metrica | quem conduz (jogo × Metrica)');
const T = [0, 0, 0], pct = (v, n) => (100 * v / Math.max(1, n)).toFixed(0);
for (let k = 0; k < 11; k++) {
  const a = { n: 0, fr: 0, la: 0, at: 0, adiante: 0, port: {}, porPos: {} };
  for (const r of res) {
    const q = r[k];
    a.n += q.n; a.fr += q.fr; a.la += q.la; a.at += q.at; a.adiante += q.adiante;
    for (const [pp, v] of Object.entries(q.port)) a.port[pp] = (a.port[pp] ?? 0) + v;
    for (const [pp, v] of Object.entries(q.porPos)) { const h = (a.porPos[pp] ??= [0, 0]); h[0] += v[0]; h[1] += v[1]; }
  }
  if (a.n < 20) continue;
  T[0] += a.fr; T[1] += a.la; T[2] += a.at;
  const s = a.fr + a.la + a.at, c = (-52.5 + 10 * k + 5).toFixed(1), mt = METRICA[c.replace(/\.0$/, '')] ?? METRICA[c];
  const port = Object.entries(a.port).sort((x, y) => y[1] - x[1]).map(([pp, v]) => `${pp} ${pct(v, a.n)}`).join(' ');
  const porPos = Object.entries(a.porPos).filter(([, v]) => v[0] >= 30).sort().map(([pp, v]) => `${pp} ${(v[1] / v[0]).toFixed(2)}`).join(' · ');
  console.log(`${c.padStart(6)} | ${(100 * a.fr / s).toFixed(1)} / ${(100 * a.la / s).toFixed(1)} / ${(100 * a.at / s).toFixed(1)}% · ` +
    `${(a.fr / a.n).toFixed(2)} · ${(a.adiante / a.n).toFixed(2)} | ${mt ? `${mt[1]} / ${mt[2]} / ${mt[3]}% · ${mt[4]} · ${mt[5]}` : '—'} | ` +
    `${port} × ${mt ? mt[6] : '—'}\n         à frente por instante, por quem conduz: ${porPos}`);
}
const s = T[0] + T[1] + T[2];
console.log(`total  | ${T.map(v => (100 * v / s).toFixed(1)).join(' / ')}% | Metrica (a mesma conta) 33,4 / 37,5 / 29,2%`);
