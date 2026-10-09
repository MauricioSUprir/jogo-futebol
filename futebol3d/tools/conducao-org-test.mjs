// Condução organizada (dono, 09/10: "a condução melhorou, mas tá muito desorganizada"). Jogador controlado com a bola,
// sem adversário por perto, analógico parado num rumo (reta) ou girando devagar (curva), trotando e em arrancada.
// Numa condução organizada o corpo segue o rumo pedido e a bola vem para o caminho do corpo no toque. Mede:
//   desvio do corpo   — afastamento lateral máximo do corpo em relação à reta pedida (reta)
//   oscilação do rumo — giro médio do rumo de corrida (°/s) com o analógico parado (reta)
//   cortes            — toques de corte ('giro') sem o analógico pedir corte (reta e curva suave de 30°/s): alvo
//                       ≤ 0,25% dos toques (1 em 400; com 64 cenas o toque tem ruído de controle, então "zero" reprovaria
//                       por sorteio — a versão publicada faz ~0,5–0,8%, quase todos na curva em arrancada)
//   bola fora do caminho — desvio lateral da bola em relação à linha do corpo (p95, média das cenas; alvo ≤ 0,3 m)
//   oscilação na curva — giro médio do rumo de corrida na curva suave (alvo ≤ 1,5× o giro pedido = 45°/s)
// 16 cenas por caso (jogadores diferentes), todos os outros jogadores longe
// node tools/conducao-org-test.mjs [--base pasta]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
const ad = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const p95 = (a) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.95)] : NaN;
function cena({ sprint, curva, k }) {
  const m = new Match({ home: TEAMS[k % 8], away: TEAMS[(k + 1) % 8], userSide: 'home', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  const cmd = { mx: 1, mz: 0, press: {}, release: {}, held: {}, hold: {}, rx: 0, rz: 0 };
  let g = 0; while (m.phase !== 'play' && g++ < 4000) { m.step(1 / 60, cmd); m.events.length = 0; }
  const p = m.controlled;
  for (const q of m.players) if (q !== p) { q.x = q.team === p.team ? -30 + q.idx : 45; q.z = 30; q.vx = q.vz = 0; }
  p.x = -30; p.z = 0; p.vx = 0; p.vz = 0; p.heading = 0;
  m.ball.place(-29.6, 0.11, 0.1); m.ball.v.x = m.ball.v.z = 0; m.ball.v.y = 0;
  m.owner = p; m.lastTouch = p;
  let giros = 0, toques = 0, ang = 0, angN = 0, desvio = 0, ultA = null;
  const lat = [], latS = [];
  const dt = m.dribbleTouch.bind(m);
  m.dribbleTouch = (o, modo, sil) => { if (o === p && t > 1.0) { toques++; if (modo === 'giro') giros++; } return dt(o, modo, sil); };
  let t = 0, a0 = 0;
  for (let i = 0; i < 60 * 7; i++) {
    t = i / 60;
    const aPed = curva ? a0 + Math.min(t, 6) * (30 * Math.PI / 180) : 0;
    cmd.mx = Math.cos(aPed); cmd.mz = Math.sin(aPed);
    for (const kk of ['press', 'release', 'held', 'hold']) cmd[kk] = {};
    cmd.held.sprint = sprint;
    // todos os outros longe (companheiros da IA voltavam para a posição e trombavam no condutor no meio da curva)
    for (const q of m.players) if (q !== p) { q.x = q.team === p.team ? -45 : 45; q.z = q.team === p.team ? -30 : 30; q.vx = q.vz = 0; q.dx = q.dz = 0; }
    m.step(1 / 60, cmd);
    for (const e of m.events) if (e.type === 'replay') m.replayFinished();
    m.events.length = 0;
    if (m.owner !== p || m.phase !== 'play') break;
    if (t < 1.5) continue;                     // arrancada inicial
    const v = Math.hypot(p.vx, p.vz);
    if (v > 1) {
      const a = Math.atan2(p.vz, p.vx);
      if (ultA !== null) { ang += Math.abs(ad(a, ultA)); angN++; }
      ultA = a;
      // bola fora do caminho: lateral em relação à linha de corrida do corpo
      const ux = p.vx / v, uz = p.vz / v, bx = m.ball.p.x - p.x, bz = m.ball.p.z - p.z;
      lat.push(Math.abs(-bx * uz + bz * ux)); latS.push(-bx * uz + bz * ux);
    }
    if (!curva) desvio = Math.max(desvio, Math.abs(p.z));
  }
  return { giros, toques, oscil: angN ? ang / angN * 60 * 57.3 : NaN, desvio, lat95: p95(lat), latM: latS.reduce((a, b) => a + b, 0) / Math.max(1, latS.length), lat50: lat.slice().sort((a, b) => a - b)[Math.floor(lat.length / 2)] || 0, dur: t };
}
const R = [];
for (const sprint of [false, true]) for (const curva of [false, true]) {
  const rs = Array.from({ length: 16 }, (_, k) => cena({ sprint, curva, k }));
  const s = (f) => rs.reduce((a, r) => a + r[f], 0) / rs.length;
  const nome = `${sprint ? 'arrancada' : 'trote'}, ${curva ? 'curva suave (30°/s)' : 'reta'}`;
  R.push({ nome, latM: s('latM'), lat50: s('lat50'), sprint, curva, giros: rs.reduce((a, r) => a + r.giros, 0), toques: rs.reduce((a, r) => a + r.toques, 0), oscil: s('oscil'), desvio: s('desvio'), lat95: s('lat95'), dur: Math.min(...rs.map(r => r.dur)) });
}
let ok = true;
for (const r of R) {
  console.log(`info   | ${r.nome.padEnd(32)} cortes ${r.giros} de ${r.toques} toques | oscilação do rumo ${r.oscil.toFixed(0)}°/s | desvio do corpo ${r.desvio.toFixed(2)} m | bola fora do caminho p95 ${r.lat95.toFixed(2)} m (média com sinal ${r.latM.toFixed(2)}, mediana ${r.lat50.toFixed(2)}) | ${r.dur.toFixed(1)} s com a bola`);
}
const reta = R.filter(r => !r.curva), curva = R.filter(r => r.curva);
const totG = R.reduce((a, r) => a + r.giros, 0), totT = R.reduce((a, r) => a + r.toques, 0);
const c1 = reta.every(r => r.oscil <= 12 && r.desvio <= 0.35), c2 = totG / totT <= 0.0025, c3 = R.every(r => r.lat95 <= 0.3), c4 = R.every(r => r.dur >= 6.9);
const c5 = curva.every(r => r.oscil <= 45);
console.log(`${c1 ? 'PASSOU' : 'FALHOU'} | reta: o corpo segue o rumo pedido — oscilação ${reta.map(r => r.oscil.toFixed(0)).join('/')}°/s (alvo ≤ 12), desvio ${reta.map(r => r.desvio.toFixed(2)).join('/')} m (alvo ≤ 0,35)`);
console.log(`${c5 ? 'PASSOU' : 'FALHOU'} | curva suave: o corpo gira no ritmo pedido — oscilação ${curva.map(r => r.oscil.toFixed(0)).join('/')}°/s (alvo ≤ 45; pedido 30)`);
console.log(`${c2 ? 'PASSOU' : 'FALHOU'} | corte sem o analógico pedir: ${totG} em ${totT} toques = ${(totG / totT * 100).toFixed(2)}% (${R.map(r => r.giros).join('/')}; alvo ≤ 0,25%)`);
console.log(`${c3 ? 'PASSOU' : 'FALHOU'} | bola no caminho do corpo: desvio lateral p95 ${R.map(r => r.lat95.toFixed(2)).join('/')} m (alvo ≤ 0,3)`);
console.log(`${c4 ? 'PASSOU' : 'FALHOU'} | não perde a bola sozinho em 7 s (${R.map(r => r.dur.toFixed(1)).join('/')} s)`);
process.exit(c1 && c2 && c3 && c4 && c5 ? 0 : 1);
