// Troca automática de jogador (pedido do dono: "a troca tem que ser mais rápida e mais inteligente").
//   passe — o adversário toca para um companheiro aberto; o nosso controlado está longe dele, pressionando
//           quem passou, e um lateral nosso está entre o recebedor e o gol. A troca para o lateral tem que
//           sair NO PASSE (antes saía só quando o recebedor dominava, ~1 s depois, e só se o controlado
//           estivesse a mais de 12 m). Alvo: troca certa em ≤ 0,2 s em ≥ 90% dos lances.
//   batido — o condutor passou do nosso controlado rumo ao gol e há um zagueiro nosso na frente dele.
//           Alvo: troca para o zagueiro em ≤ 0,8 s em ≥ 90% (antes não trocava: só no botão).
// node tools/troca-auto-test.mjs [lances=60] [--base pasta]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1] === '--base'));
const N = +(pos[0] || 60);
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const parado = { mx: 0, mz: 0, held: {}, press: {}, release: {}, hold: {}, rx: 0, rz: 0 };
function novo() {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
  m.headless = true;
  let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  return m;
}
const longe = (m, ps, dir) => ps.forEach((q, i) => { q.x = -dir * (40 - (i % 3)); q.z = (i % 7) * 7 - 21; q.vx = q.vz = 0; q.action = null; });
// cenário do passe
const P = { certo: 0, tempos: [], n: 0 };
for (let k = 0; k < N; k++) {
  const m = novo(), us = m.userTeam, op = us.opp, dir = Math.sign(m.ownGoalX(us)) || 1, lado = rnd() < 0.5 ? 1 : -1;
  const C = op.players.find(q => q.role === 'MID'), R = op.players.find(q => q.role === 'ATT' || (q.role === 'MID' && q !== C));
  const D1 = us.players.find(q => q.role === 'MID'), D2 = us.players.find(q => q.role === 'DEF');
  longe(m, op.players.filter(q => !q.isGK && q !== C && q !== R), -dir);
  longe(m, us.players.filter(q => !q.isGK && q !== D1 && q !== D2), dir);
  C.x = 0; C.z = 0; C.heading = Math.atan2(lado * 18, dir * 15); C.vx = C.vz = 0;
  R.x = dir * (14 + rnd() * 4); R.z = lado * (16 + rnd() * 4); R.vx = R.vz = 0;
  D1.x = dir * 2; D1.z = lado * 0.5; D1.vx = D1.vz = 0;
  D2.x = R.x + dir * (5 + rnd() * 3); D2.z = R.z - lado * (1 + rnd() * 2); D2.vx = D2.vz = 0;
  m.ball.place(C.x + C.fx * 0.4, 0.11, C.z + C.fz * 0.4); m.ball.v.x = m.ball.v.z = 0; m.takeBall(C, 'control');
  m.setControlled(D1); m.lastSwitchT = m.time - 5; m.lastKick = null;
  C.startAction('pass', { receiver: R, target: { x: R.x, z: R.z }, power: 0.55, face: Math.atan2(R.z - C.z, R.x - C.x) });
  let tChute = null, tTroca = null;
  for (let i = 0; i < 150; i++) {
    m.step(1 / 60, parado); m.events.length = 0;
    if (tChute === null && m.lastKick && m.lastKick.p === C) tChute = m.time;
    if (tChute !== null && m.controlled !== D1) { tTroca = m.time - tChute; break; }
    if (m.phase !== 'play') break;
  }
  if (tChute === null) continue;
  P.n++;
  if (tTroca !== null && m.controlled === D2) { P.tempos.push(tTroca); if (tTroca <= 0.2) P.certo++; }
}
// cenário do marcador batido
const B = { certo: 0, tempos: [], n: 0 };
for (let k = 0; k < N; k++) {
  const m = novo(), us = m.userTeam, op = us.opp, dir = Math.sign(m.ownGoalX(us)) || 1;
  const C = op.players.find(q => q.role === 'ATT') || op.players[9];
  const D1 = us.players.find(q => q.role === 'MID'), D3 = us.players.filter(q => q.role === 'DEF')[1];
  longe(m, op.players.filter(q => !q.isGK && q !== C), -dir);
  longe(m, us.players.filter(q => !q.isGK && q !== D1 && q !== D3), dir);
  const z0 = (rnd() - 0.5) * 16;
  C.x = dir * 18; C.z = z0; C.heading = dir > 0 ? 0 : Math.PI; C.vx = dir * 6; C.vz = 0;
  D1.x = dir * (14.5 - rnd() * 2); D1.z = z0 + (rnd() - 0.5) * 3; D1.vx = dir * 3; D1.vz = 0;
  D3.x = dir * (33 + rnd() * 4); D3.z = z0 * 0.6 + (rnd() - 0.5) * 4; D3.vx = D3.vz = 0;
  m.ball.place(C.x + dir * 0.45, 0.11, C.z); m.ball.v.x = dir * 6; m.ball.v.z = 0; m.takeBall(C, 'control');
  m.setControlled(D1); m.lastSwitchT = m.time - 5; m.lastOwnerKey = C.idx;
  let tTroca = null; const t0 = m.time;
  for (let i = 0; i < 90; i++) {
    m.step(1 / 60, parado); m.events.length = 0;
    if (m.controlled !== D1) { tTroca = m.time - t0; break; }
    if (m.phase !== 'play' || m.owner !== C) break;
  }
  B.n++;
  if (tTroca !== null && m.controlled === D3) { B.tempos.push(tTroca); if (tTroca <= 0.8) B.certo++; }
}
const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)].toFixed(2) + ' s' : '—';
const okP = P.n >= N * 0.8 && P.certo / P.n >= 0.9, okB = B.certo / B.n >= 0.9;
console.log(`${okP ? 'PASSOU' : 'FALHOU'} | passe do adversário: troca para o lateral em ≤ 0,2 s em ${(P.certo / Math.max(1, P.n) * 100).toFixed(0)}% de ${P.n} (alvo ≥ 90%); mediana da troca ${med(P.tempos)} depois do passe`);
console.log(`${okB ? 'PASSOU' : 'FALHOU'} | marcador batido: troca para o zagueiro em ≤ 0,8 s em ${(B.certo / Math.max(1, B.n) * 100).toFixed(0)}% de ${B.n} (alvo ≥ 90%); mediana ${med(B.tempos)}`);
process.exit(okP && okB ? 0 : 1);
