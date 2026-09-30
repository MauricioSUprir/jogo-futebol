// Simula N partidas e mostra médias por jogo (para calibrar o motor contra números reais).
// Uso: node tools/stats-report.mjs [N]
import { Match } from '../js/engine.js';
import { TEAMS } from '../js/teams.js';

const N = +(process.argv[2] || 60);
const acc = {}; const add = (k, v) => (acc[k] = (acc[k] || 0) + v);
let homeW = 0, draws = 0, favW = 0, favGames = 0;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const h = TEAMS[i % TEAMS.length], a = TEAMS[(i * 5 + 3) % TEAMS.length];
  if (h === a) continue;
  const m = new Match({ home: h, away: a, seed: 1000 + i });
  m.runToEnd();
  const [s0, s1] = m.teams.map((t) => t.stats);
  add('jogos', 1);
  add('gols', m.teams[0].score + m.teams[1].score);
  add('chutes', s0.shots + s1.shots);
  add('noAlvo', s0.onTarget + s1.onTarget);
  add('xg', s0.xg + s1.xg);
  add('passes', s0.passes + s1.passes);
  add('passOk', s0.passOk + s1.passOk);
  add('cruzamentos', s0.crosses + s1.crosses);
  add('cruzCertos', s0.crossOk + s1.crossOk);
  add('faltas', s0.fouls + s1.fouls);
  add('amarelos', s0.yellow + s1.yellow);
  add('vermelhos', s0.red + s1.red);
  add('escanteios', s0.corners + s1.corners);
  add('impedimentos', s0.offsides + s1.offsides);
  add('defesas', s0.saves + s1.saves);
  add('desarmes', s0.tackles + s1.tackles);
  add('penaltis', m.events.filter((e) => e.type === 'penalty').length);
  add('substituicoes', 10 - m.teams[0].subsLeft - m.teams[1].subsLeft);
  add('acrescimo2T', m.added[1]);
  add('possMaior', Math.max(...m.possession()));
  if (m.teams[0].score > m.teams[1].score) homeW++; else if (m.teams[0].score === m.teams[1].score) draws++;
  if (h.overall !== a.overall) { favGames++; const fav = h.overall > a.overall ? 0 : 1; if (m.teams[fav].score > m.teams[1 - fav].score) favW++; }
}
const ms = performance.now() - t0;
const g = acc.jogos;
for (const [k, v] of Object.entries(acc)) if (k !== 'jogos') console.log(k.padEnd(14), (v / g).toFixed(2));
console.log('precisãoPasse'.padEnd(14), ((acc.passOk / acc.passes) * 100).toFixed(1) + '%');
console.log('empates'.padEnd(14), ((draws / g) * 100).toFixed(0) + '%', ' vitória favorito', ((favW / favGames) * 100).toFixed(0) + '%');
console.log('tempo/jogo'.padEnd(14), (ms / g).toFixed(1) + ' ms');
