// Intensidade (§17): mesma partida a partir dos 75', com o time da casa EMPATANDO,
// PERDENDO por 1 ou GANHANDO por 1. Mede o nível de intensidade, a altura média do bloco
// (sem a bola), quantos pressionam o portador (a menos de 6 m) e o desgaste ganho.
// node tools/intensidade-test.mjs [partidas]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
import { INTENSITY_LEVELS, intensityLevel } from '../js/tactics.js';
const N = +(process.argv[2] || 6);
for (const [nome, diff] of [['empatando', 0], ['perdendo por 1', -1], ['ganhando por 1', 1]]) {
  let inten = 0, ni = 0, alt = 0, na = 0, press = 0, np = 0, fat = 0;
  for (let k = 0; k < N; k++) {
    const m = new Match({ home: TEAMS[k % 8], away: TEAMS[(k + 3) % 8], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6 } });
    m.headless = true;
    let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
    const t = m.teams[0];
    m.clock = 75 * 60; t.score = Math.max(0, diff); t.opp.score = Math.max(0, -diff);
    const f0 = t.players.reduce((s, p) => s + p.fatigue, 0);
    for (let i = 0; i < 60 * 60; i++) {
      m.step(1 / 60, null);
      for (const e of m.events) if (e.type === 'replay') m.replayFinished();
      m.events.length = 0;
      if (m.phase !== 'play') continue;
      t.score = Math.max(0, diff); t.opp.score = Math.max(0, -diff);   // mantém o cenário
      inten += t.intensity; ni++;
      if (m.owner && m.owner.team !== t) {
        const xs = t.players.filter(p => !p.isGK && !p.sentOff).map(p => m.lx(t, p.x));
        alt += xs.reduce((a, b) => a + b, 0) / xs.length; na++;
        press += t.players.filter(p => !p.isGK && Math.hypot(p.x - m.owner.x, p.z - m.owner.z) < 6).length; np++;
      }
    }
    fat += (t.players.reduce((s, p) => s + p.fatigue, 0) - f0) / 11;
  }
  const iv = inten / ni;
  console.log(`${nome.padEnd(15)} | intensidade ${iv.toFixed(2)} (${INTENSITY_LEVELS[intensityLevel(iv)]}) | bloco sem a bola ${(alt / na).toFixed(1)} m | pressionando o portador ${(press / np).toFixed(2)} | desgaste ganho ${(fat / N).toFixed(3)}`);
}
