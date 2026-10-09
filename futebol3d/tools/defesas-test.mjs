// Defesas do goleiro em partidas IA x IA (pedido do dono: "não vejo o goleiro espalmar, ele não defende tanto").
// Conta os chutes no alvo (chute, colocado, cavadinha, voleio, cabeçada) que acabaram em defesa ou gol, pela
// distância do chute. Futebol real (Premier League, ordem de grandeza): ~70% de defesas no geral; dentro da área
// (fora da pequena) ~60%; de fora da área ~85%. Alvos (reprova com saída 1): geral ≥ 66%, de 6 a 16,5 m ≥ 55%,
// espalmadas ≥ 40% das defesas e nenhum gol contra na reposição do goleiro com a mão.
// node tools/defesas-test.mjs [partidas=24] [--par 4] [--base pasta]
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && ['--base', '--par', '--worker'].includes(A[i - 1])));
const N = +(pos[0] || 24), PAR = +arg('par', 1);
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const worker = arg('worker', null);
const SHOTS = new Set(['shot', 'finesse', 'chip', 'volley', 'header']);
const FX = [['< 6 m', 0, 6], ['6–16,5 m', 6, 16.5], ['> 16,5 m', 16.5, 99]];

async function roda(ini, fim) {
  const { Match } = await import(path.join(base, 'js/match.js'));
  const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
  const { TEAMS } = await import(path.join(base, 'js/teams.js'));
  const S = { partidas: 0, def: [0, 0, 0], gol: [0, 0, 0], catch: 0, parry: 0, golContraMao: 0 };
  for (let k = ini; k < fim; k++) {
    const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
    m.headless = true;
    let ch = null, maoT = -9, maoTime = null;
    const ak = m.afterKick.bind(m);
    m.afterKick = (p, kind, tg, rec) => {
      const r = ak(p, kind, tg, rec);
      ch = SHOTS.has(kind) ? { d: Math.hypot(m.goalX(p.team) - p.x, p.z) } : null;
      if (kind === 'gk_throw') { maoT = m.time; maoTime = p.team; }
      return r;
    };
    const emit = m.emit.bind(m);
    const fx = (d) => FX.findIndex(f => d >= f[1] && d < f[2]);
    m.emit = (type, d = {}) => {
      if (type === 'save') { S[d.kind] = (S[d.kind] || 0) + 1; if (ch) S.def[fx(ch.d)]++; ch = null; }
      if (type === 'goal') {
        if (ch) S.gol[fx(ch.d)]++;
        // gol logo depois de o goleiro repor com a mão, no gol do próprio time: gol contra da reposição
        if (m.time - maoT < 1.5 && maoTime && d.side === maoTime.opp.i && d.own) S.golContraMao++;
        ch = null;
      }
      return emit(type, d);
    };
    for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
      m.step(1 / 60, null);
      for (const e of m.events) if (e.type === 'replay') m.replayFinished();
      m.events.length = 0;
      if (m.phase !== 'play') ch = null;
    }
    S.partidas++;
  }
  return S;
}
if (worker) {
  const [i, P] = worker.split('/').map(Number);
  process.send(await roda(Math.floor(N * i / P), Math.floor(N * (i + 1) / P)));
  process.exit(0);
}
let S;
if (PAR > 1) {
  const parts = await Promise.all(Array.from({ length: PAR }, (_, i) => new Promise((res, rej) => {
    const c = fork(fileURLToPath(import.meta.url), [String(N), '--base', base, '--worker', `${i}/${PAR}`]);
    c.on('message', res); c.on('error', rej);
    c.on('exit', (code) => { if (code) rej(new Error('processo ' + i + ' saiu com ' + code)); });
  })));
  S = parts.reduce((a, s) => { for (const k in s) a[k] = Array.isArray(s[k]) ? s[k].map((v, j) => (a[k]?.[j] || 0) + v) : (a[k] || 0) + s[k]; return a; }, {});
} else S = await roda(0, N);
const pc = (a, b) => (a / Math.max(1, a + b) * 100);
const td = S.def.reduce((a, b) => a + b, 0), tg = S.gol.reduce((a, b) => a + b, 0);
FX.forEach((f, i) => console.log(`info   | ${f[0].padEnd(9)} defesas ${S.def[i]} × gols ${S.gol[i]} → ${pc(S.def[i], S.gol[i]).toFixed(0)}% de defesas`));
const geral = pc(td, tg), meio = pc(S.def[1], S.gol[1]), esp = S.parry / Math.max(1, S.parry + S.catch) * 100;
const r = [
  [geral >= 66, `${S.partidas} partidas: ${geral.toFixed(0)}% de defesas nos chutes no alvo (${td} × ${tg} gols; alvo ≥ 66%, real ~70%)`],
  [meio >= 55, `de 6 a 16,5 m: ${meio.toFixed(0)}% de defesas (alvo ≥ 55%, real ~60%)`],
  [esp >= 40, `espalmadas: ${esp.toFixed(0)}% das defesas (${(S.parry / S.partidas).toFixed(1)} por partida; alvo ≥ 40%)`],
  [S.golContraMao === 0, `gol contra na reposição com a mão: ${S.golContraMao} (alvo 0)`],
];
for (const [ok, txt] of r) console.log(`${ok ? 'PASSOU' : 'FALHOU'} | ${txt}`);
process.exit(r.every(x => x[0]) ? 0 : 1);
