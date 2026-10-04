// Dividida (desarme em pé) do jogador humano: em N lances, o atacante adversário conduz
// e o defensor controlado, a uma distância inicial, aperta a dividida. Mede quantas vezes
// a bola foi roubada, só tirada (ficou solta), virou falta ou o desarme furou.
// node tools/dividida-test.mjs [lances] [distância inicial m]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 200), D0 = +(process.argv[3] || 1.8), PRESS = +(process.argv[4] || 2);
const res = { roubou: 0, tirou: 0, falta: 0, furou: 0, semDesarme: 0 };
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
  m.headless = true;
  // chega ao jogo corrido
  let guard = 0;
  while (m.phase !== 'play' && guard++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  const us = m.userTeam, opp = us.opp;
  const att = opp.players[8], def = us.players[4];
  // posiciona: atacante conduzindo rumo ao gol do usuário; defensor de frente
  const dir = Math.sign(m.ownGoalX(us)) || -1;
  att.x = 0; att.z = 0; att.heading = dir > 0 ? 0 : Math.PI;
  const ang = (Math.random() - 0.5) * 1.2;
  def.x = att.x + dir * D0 * Math.cos(ang); def.z = att.z + D0 * Math.sin(ang);
  m.ball.place(att.x + att.fx * 0.35, 0.11, att.z + att.fz * 0.35); m.ball.v.x = m.ball.v.z = 0;
  m.takeBall(att, 'control');
  // atacante já em corrida rumo ao gol (condução de verdade, não parado)
  att.vx = dir * 5; att.vz = 0; m.ball.v.x = dir * 5;
  def.heading = Math.atan2(att.z - def.z, att.x - def.x);
  m.setControlled(def);
  let fouls = us.stats.fouls;
  let started = false, out = null;
  for (let i = 0; i < 90; i++) {
    const press = i === PRESS ? { tackle: true } : {};
    const cmd = { mx: 0, mz: 0, held: {}, press, release: {}, hold: {}, rx: 0, rz: 0 };
    m.step(1 / 60, cmd);
    m.events.length = 0;
    if (def.action && def.action.type === 'tackle') started = true;
    if (m.phase !== 'play') { out = 'falta'; break; }
    if (m.owner === def) { out = 'roubou'; break; }
    if (started && !def.action && m.owner !== att) { out = m.owner ? 'roubou' : 'tirou'; break; }
    if (started && !def.action) { out = 'furou'; break; }
  }
  if (!out) out = started ? (m.owner === att ? 'furou' : 'tirou') : 'semDesarme';
  if (us.stats.fouls > fouls) out = 'falta';
  res[out]++;
}
const pct = (v) => (100 * v / N).toFixed(0) + '%';
console.log(`dividida a ${D0} m em ${N} lances:`, Object.entries(res).map(([k, v]) => `${k} ${pct(v)}`).join(' | '));
