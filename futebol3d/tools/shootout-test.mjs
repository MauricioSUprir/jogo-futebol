// Força empate num mata-mata para testar prorrogação e pênaltis (node tools/shootout-test.mjs [home|away|none])
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const side = process.argv[2] || 'none';
const m = new Match({ home: TEAMS[1], away: TEAMS[2], userSide: side, knockout: true, settings: { ...DEFAULT_SETTINGS, halfMinutes: 1 } });
m.headless = true;
const cmd = { mx: 0, mz: 0, press: {}, release: {}, held: {}, hold: {}, rx: 0, rz: 0 };
let t = 0; const log = [];
let lastPhase = '';
while (m.phase !== 'ended' && t < 1200) {
  for (const k of ['press', 'release', 'held', 'hold']) cmd[k] = {};
  if (side !== 'none' && m.phase === 'setpiece' && m.sp && m.sp.team === m.userTeam && Math.random() < 0.02) { cmd.release.shoot = true; cmd.hold.shoot = Math.random() * 0.8; cmd.mx = 0; cmd.mz = Math.random() - 0.5; }
  if (side !== 'none' && m.sp && m.sp.type === 'penalty' && m.sp.team !== m.userTeam) { cmd.mz = Math.random() < 0.5 ? 1 : -1; }
  m.step(1 / 60, cmd); t += 1 / 60;
  if (!m.shootout && m.clock > 60 * 118) { m.teams[0].score = m.teams[1].score; }
  if (!m.shootout && m.half === 2 && m.clock > 60 * 88) { m.teams[0].score = m.teams[1].score; }
  for (const e of m.events) { if (e.type === 'replay') m.replayFinished(); if (['banner', 'penaltyGoal', 'penaltyMiss', 'ended'].includes(e.type)) log.push(`${(m.clock / 60).toFixed(0)}' ${e.type} ${e.text || ''} ${e.side ?? ''}`); }
  m.events.length = 0;
  if (m.phase !== lastPhase) { lastPhase = m.phase; }
}
console.log(log.filter(l => !/FALTA|LATERAL|TIRO DE META|ESCANTEIO|VANTAGEM|IMPEDIMENTO|DEFESA/.test(l)).join('\n'));
console.log('fim', m.phase, 'placar', m.teams.map(x => x.score), 'pens', JSON.stringify(m.pens), 'cobranças', m.shootout && m.shootout.kicks.map(k => k.map(v => v ? 'O' : 'x').join('')).join(' / '), 't', t.toFixed(0));
if (m.phase !== 'ended' || !m.pens) process.exit(1);
