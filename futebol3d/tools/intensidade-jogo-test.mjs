// Intensidade e organização do time em partidas IA x IA (pedido do dono: "mais intensidade e movimentação, dos
// dois times"; análise da movimentação, etapa 6). Alvos (reprova com saída 1):
//   bloco sem a bola: largura ≤ 40 m e meio–ataque ≤ 14,5 m (Bundesliga, Forcher 2024: ~37 m e ~13 m;
//                      antes desta etapa: 44 m e 16 m — o time não fechava o lado da bola)
//   pressão: condutor com marcador a ≤ 3 m em ≥ 40% do tempo (antes 33%; sem referência pública — meta de projeto)
// Amostra a cada 0,25 s com a bola rolando e dona definida:
//   bloco sem a bola   — comprimento e largura dos 10 de linha, distância defesa–meio e meio–ataque
//   bloco com a bola   — idem para quem ataca
//   perto da bola      — jogadores a até 20 m da bola: % parados (< 1 m/s), % correndo (> 4 m/s), por time
//   pressão no condutor — distância do marcador mais perto; % do tempo com marcador a ≤ 3 m
//   corridas de ataque — atacantes sem a bola no último terço correndo para frente > 5 m/s (por minuto, por time)
// node tools/intensidade-jogo-test.mjs [partidas=12] [--ini k] [--base pasta]   (com 6 partidas a largura oscilava ±1 m)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && ['--base', '--ini'].includes(A[i - 1])));
const N = +(pos[0] || 12), INI = +arg('ini', 0);
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN;
const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
const R = { semC: [], semL: [], semDM: [], semMA: [], comC: [], comL: [], comDM: [], comMA: [], perto: 0, parado: 0, correndo: 0,
  marc: [], marc3: 0, amostras: 0, corridas: 0, min: 0 };
for (let k = INI; k < INI + N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  let acc = 0;
  const correndo = new Set();
  for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) if (e.type === 'replay') m.replayFinished();
    m.events.length = 0;
    if (m.phase !== 'play') continue;
    const o = m.owner;
    acc += 1 / 60;
    if (acc < 0.25) continue;
    acc = 0;
    if (!o) continue;
    R.min += 0.25 / 60;
    const A = o.team, D = A.opp, b = m.ball.p;
    for (const [T, pre] of [[D, 'sem'], [A, 'com']]) {
      const ps = T.players.filter(q => !q.sentOff && !q.isGK);
      const lx = ps.map(q => m.lx(T, q.x)), zs = ps.map(q => q.z);
      R[pre + 'C'].push(Math.max(...lx) - Math.min(...lx));
      R[pre + 'L'].push(Math.max(...zs) - Math.min(...zs));
      const linha = (r) => { const v = ps.filter(q => q.role === r).map(q => m.lx(T, q.x)); return v.length ? avg(v) : null; };
      const dd = linha('DEF'), mm = linha('MID'), aa = linha('ATT');
      if (dd != null && mm != null) R[pre + 'DM'].push(mm - dd);
      if (mm != null && aa != null) R[pre + 'MA'].push(aa - mm);
      for (const q of ps) {
        if (Math.hypot(q.x - b.x, q.z - b.z) > 20 || q === o) continue;
        R.perto++;
        if (q.speed < 1) R.parado++;
        if (q.speed > 4) R.correndo++;
      }
    }
    const dm = Math.min(...D.players.filter(q => !q.sentOff && !q.isGK).map(q => Math.hypot(q.x - o.x, q.z - o.z)));
    R.marc.push(dm); R.amostras++; if (dm <= 3) R.marc3++;
    // corridas para frente no último terço (atacante sem a bola, > 5 m/s, velocidade para o gol)
    for (const q of A.players) {
      if (q === o || q.isGK || q.sentOff) continue;
      const fx = Math.sign(m.goalX(A)) * q.vx;
      const run = m.lx(A, q.x) > 52.5 / 3 && fx > 5;
      if (run && !correndo.has(q)) { R.corridas++; correndo.add(q); }
      if (!run) correndo.delete(q);
    }
  }
}
const f = (x) => x.toFixed(1);
console.log(`${N} partidas IA x IA (padrão), ${f(R.min / N)} min de bola dominada por partida`);
console.log(`bloco SEM a bola: comprimento ${f(med(R.semC))} m, largura ${f(med(R.semL))} m, defesa–meio ${f(med(R.semDM))} m, meio–ataque ${f(med(R.semMA))} m (medianas)`);
console.log(`bloco COM a bola: comprimento ${f(med(R.comC))} m, largura ${f(med(R.comL))} m, defesa–meio ${f(med(R.comDM))} m, meio–ataque ${f(med(R.comMA))} m`);
console.log(`perto da bola (≤ 20 m, sem o condutor): parados ${f(R.parado / R.perto * 100)}% | correndo > 4 m/s ${f(R.correndo / R.perto * 100)}% | ${f(R.perto / R.amostras)} jogadores em média`);
console.log(`marcador mais perto do condutor: mediana ${f(med(R.marc))} m | a ≤ 3 m em ${f(R.marc3 / R.amostras * 100)}% do tempo`);
console.log(`corridas para frente no último terço (> 5 m/s, sem a bola): ${f(R.corridas / R.min / 2)} por minuto por time`);
const largura = med(R.semL), ma = med(R.semMA), p3 = R.marc3 / R.amostras;
const ok = largura <= 40 && ma <= 14.5 && p3 >= 0.40;
console.log(`${largura <= 40 ? 'PASSOU' : 'FALHOU'} | largura do bloco sem a bola ${f(largura)} m (alvo ≤ 40; Bundesliga ~37)`);
console.log(`${ma <= 14.5 ? 'PASSOU' : 'FALHOU'} | meio–ataque sem a bola ${f(ma)} m (alvo ≤ 14,5; Bundesliga ~13)`);
console.log(`${p3 >= 0.40 ? 'PASSOU' : 'FALHOU'} | condutor com marcador a ≤ 3 m em ${f(p3 * 100)}% do tempo (alvo ≥ 40%)`);
process.exit(ok ? 0 : 1);
