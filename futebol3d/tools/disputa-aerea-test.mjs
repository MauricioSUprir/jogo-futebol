// Disputa pelo alto (pedido do dono: "cabeceios, disputas de cabeça"): cenário de cruzamento repetido.
// Ponta do time A na linha de fundo cruza para um companheiro que ataca a área (primeiro pau, segundo
// pau ou marca do pênalti); na área, 3 atacantes e 4 defensores na posição de sempre. Mede:
//   disputados — % dos cruzamentos em que jogadores dos DOIS times saltam na bola (alvo ≥ 80%)
//   quem ganha  — ataque / defesa / goleiro / ninguém (informativo; no futebol real ~20–30% dos
//                 cruzamentos acham um companheiro — Opta/StatsBomb: acerto de cruzamento ~22–25%)
//   duelo 1×1   — dois jogadores na mesma bola: o mais alto ganha a maioria (alvo ≥ 65%)
// node tools/disputa-aerea-test.mjs [cruzamentos=60] [--base pasta]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1].startsWith('--')));
const N = +(pos[0] || 60);
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = { disputados: 0, ataque: 0, defesa: 0, goleiro: 0, ninguem: 0, n: 0, duelos: 0, maisAlto: 0 };
const alt = (p) => p.data.look?.height || 1.8;
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % 4], away: TEAMS[(k + 3) % 6], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  const A = m.teams[0], D = A.opp, gx = m.goalX(A), s = Math.sign(gx), lado = rnd() < 0.5 ? 1 : -1;
  const atk = A.players.filter(p => !p.isGK).sort((a, c) => (c.data.look?.height || 1.8) - (a.data.look?.height || 1.8));
  const def = D.players.filter(p => !p.isGK).sort((a, c) => (c.data.look?.height || 1.8) - (a.data.look?.height || 1.8));
  const W = atk.find(p => p.role !== 'DEF' && p.role !== 'ATT') || atk[8];
  const longe = (p, i) => { p.x = -s * 30 + i; p.z = (i % 7) * 6 - 18; p.vx = p.vz = 0; };
  atk.forEach((p, i) => longe(p, i)); def.forEach((p, i) => longe(p, i + 10));
  // ponta com a bola perto da linha de fundo
  W.x = gx - s * (6 + rnd() * 8); W.z = lado * (26 + rnd() * 4); W.heading = Math.atan2(-lado, 0); W.vx = W.vz = 0;
  m.ball.place(W.x, 0.11, W.z - lado * 0.4); m.takeBall(W, 'control');
  // na área: 3 atacantes (os mais altos) e 4 defensores perto deles
  const spots = [[5.5, lado * 2], [7, -lado * 3], [11, 0]];
  const box = atk.filter(p => p !== W).slice(0, 3);
  box.forEach((p, i) => { p.x = gx - s * (spots[i][0] + 3); p.z = spots[i][1] * 0.6; p.vx = s * 2; p.vz = 0; });
  def.slice(0, 4).forEach((p, i) => { const q = box[i % 3]; p.x = q.x + s * (0.8 + (i > 2 ? 2 : 0)); p.z = q.z + (i > 2 ? -lado * 3 : 0.4); p.vx = p.vz = 0; });
  D.gk.x = gx - s * 1; D.gk.z = lado * 1;
  const alvo = box[Math.floor(rnd() * 3)];
  const sp = spots[box.indexOf(alvo)];
  W.startAction('cross', { receiver: alvo, alto: true, target: { x: gx - s * sp[0], z: sp[1] }, power: 0.7, face: Math.atan2(sp[1] - W.z, gx - s * sp[0] - W.x) });
  const times = new Set(), saltou = new Set();
  let quem = 'ninguem', chutado = false;
  for (let i = 0; i < 60 * 3; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) if (e.type === 'replay') m.replayFinished();
    m.events.length = 0;
    if (!chutado) { if (m.lastKick && m.lastKick.p === W) chutado = true; else continue; }
    for (const p of m.players) if (p.action && p.action.type === 'header') { times.add(p.team === A ? 'A' : 'D'); saltou.add(p); }
    const lt = m.lastTouch;
    if (lt && lt !== W) {
      quem = lt.isGK ? 'goleiro' : lt.team === A ? 'ataque' : 'defesa';
      // duelo de verdade: quem ganhou a cabeçada contra os rivais (do outro time) que também saltaram
      const rivais = [...saltou].filter(q => q !== lt && q.team !== lt.team);
      if (saltou.has(lt) && rivais.length) {
        const outro = Math.max(...rivais.map(alt));
        if (Math.abs(alt(lt) - outro) >= 0.05) { R.duelos++; if (alt(lt) > outro) R.maisAlto++; }
      }
      break;
    }
    if (m.phase !== 'play') break;
  }
  if (!chutado) continue;
  R.n++;
  if (times.size === 2) R.disputados++;
  R[quem]++;
}
const pc = (x) => (x / Math.max(1, R.n) * 100).toFixed(0) + '%';
const c1 = R.n >= N * 0.8 && R.disputados / R.n >= 0.8;
console.log(`${c1 ? 'PASSOU' : 'FALHOU'} | ${R.n} cruzamentos na área: disputados de cabeça pelos dois times em ${pc(R.disputados)} (alvo ≥ 80%)`);
console.log(`info   | primeiro toque: ataque ${pc(R.ataque)}, defesa ${pc(R.defesa)}, goleiro ${pc(R.goleiro)}, ninguém ${pc(R.ninguem)} (futebol real: ~20–30% dos cruzamentos acham um companheiro)`);
// DUELO 1×1 controlado: dois jogadores (um de cada time) lado a lado, mesma distância da bola que cai na
// altura da cabeça entre eles; alturas sorteadas com 10–15 cm de diferença. Num duelo de verdade o mais
// alto (e mais forte) ganha a maioria; antes ganhava quem o jogo processava primeiro (~metade)
let duelos = 0, alto = 0;
for (let k = 0; k < 80; k++) {
  const m = new Match({ home: TEAMS[k % 4], away: TEAMS[(k + 3) % 6], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  const P = m.teams[0].players.find(p => p.role === 'MID'), Q = m.teams[1].players.find(p => p.role === 'MID');
  const hp = 1.74 + rnd() * 0.08, dh = (0.1 + rnd() * 0.05) * (rnd() < 0.5 ? 1 : -1);
  P.data = { ...P.data, look: { ...P.data.look, height: hp } }; Q.data = { ...Q.data, look: { ...Q.data.look, height: hp + dh } };
  for (const q of m.players) if (q !== P && q !== Q && !q.isGK) { q.x = -40 + q.idx; q.z = 30; q.vx = q.vz = 0; }
  P.x = 0; P.z = -0.55; Q.x = 0; Q.z = 0.55; P.vx = P.vz = Q.vx = Q.vz = 0; P.heading = 0; Q.heading = Math.PI;
  m.owner = null; m.ball.place(0, 7, 0); m.ball.v.x = m.ball.v.z = 0; m.ball.v.y = 0; m.lastKick = { p: m.teams[0].gk, kind: 'long', t: m.time };
  let quem = null;
  for (let i = 0; i < 90 && !quem; i++) {
    for (const q of m.players) if (q !== P && q !== Q && !q.isGK) { q.stun = 0.3; q.dx = q.dz = 0; }
    m.step(1 / 60, null); m.events.length = 0;
    if (m.lastTouch === P || m.lastTouch === Q) quem = m.lastTouch;
  }
  if (!quem) continue;
  duelos++;
  if (alt(quem) > alt(quem === P ? Q : P)) alto++;
}
const ma = alto / Math.max(1, duelos), c3 = duelos >= 40 && ma >= 0.65;
console.log(`${c3 ? 'PASSOU' : 'FALHOU'} | duelo 1×1 na mesma bola (10–15 cm de diferença): ${duelos} disputas, o mais alto ganhou ${(ma * 100).toFixed(0)}% (alvo ≥ 65%)`);
process.exit(c1 && c3 ? 0 : 1);
