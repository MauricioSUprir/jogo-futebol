// Proteção da bola (seção 9): o atacante (humano, parado com a bola, sem apertar nada)
// tem um defensor da IA colado; mede faltas sofridas e em quanto tempo perde a bola com o
// defensor ATRÁS (o corpo do atacante entre ele e a bola), DE LADO e DE FRENTE.
// node tools/protecao-test.mjs [lances]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 60);
const idle = { mx: 0, mz: 0, held: {}, press: {}, release: {}, hold: {}, rx: 0, rz: 0 };
for (const [nome, ang] of [['atrás', Math.PI], ['de lado', Math.PI / 2], ['de frente', 0]]) {
  let tot = 0, perdeu = 0, emUm = 0, faltas = 0;
  for (let k = 0; k < N; k++) {
    const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
    m.headless = true;
    let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
    const us = m.userTeam, A = us.players[9], D = us.opp.players[4];
    for (const q of m.players) if (q !== A && q !== D && !q.isGK) { q.x = (q.team === us ? -1 : 1) * 30; q.z = (q.idx % 11) * 5 - 25; }
    A.x = 0; A.z = 0; A.heading = 0; A.vx = A.vz = 0;
    m.ball.place(0.4, 0.11, 0); m.ball.v.x = m.ball.v.z = 0; m.takeBall(A, 'control'); m.setControlled(A);
    D.x = Math.cos(ang) * 0.95 + (ang === 0 ? 0.4 : 0); D.z = Math.sin(ang) * 0.95; D.heading = Math.atan2(-D.z, 0.4 - D.x);
    let t = 0;
    for (; t < 4; t += 1 / 60) { m.step(1 / 60, idle); m.events.length = 0; if (m.owner !== A) break; }
    tot += t; if (m.phase !== 'play') faltas++; else if (m.owner !== A) { perdeu++; if (t < 1) emUm++; }
  }
  console.log(`defensor ${nome.padEnd(9)} | sofreu falta ${(100 * faltas / N).toFixed(0)}% | perdeu em 4 s: ${(100 * perdeu / N).toFixed(0)}% | perdeu no 1º segundo: ${(100 * emUm / N).toFixed(0)}% | tempo médio com a bola ${(tot / N).toFixed(2)} s`);
}

