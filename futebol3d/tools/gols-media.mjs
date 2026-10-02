// Média de gols, chutes e desarmes em N partidas IA x IA (equilíbrio da jogabilidade).
// node tools/gols-media.mjs [partidas] [minutos por tempo]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 4), half = +(process.argv[3] || 6);
let g = 0, sh = 0, tk = 0, tkOk = 0;
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: half } });
  m.headless = true;
  const orig = m.touch.bind(m);
  m.touch = (p, how) => { if (how === 'tackle') tkOk++; return orig(p, how); };
  for (let i = 0; i < 60 * 60 * 30 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) { if (e.type === 'replay') m.replayFinished(); if (e.type === 'tackle') tk++; }
    m.events.length = 0;
  }
  g += m.teams[0].score + m.teams[1].score; sh += m.teams[0].stats.shots + m.teams[1].stats.shots;
}
console.log(`partidas ${N} | gols/partida ${(g / N).toFixed(1)} | chutes/partida ${(sh / N).toFixed(1)} | desarmes certos/partida ${(tkOk / N).toFixed(1)} | tentativas ${(tk / N).toFixed(1)}`);
