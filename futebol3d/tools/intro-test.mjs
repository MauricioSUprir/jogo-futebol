// Abertura: times saem do túnel, perfilam e vão para o pontapé; também testa o pular.
import { Match, INTRO_TIMES } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', intro: true, settings: { ...DEFAULT_SETTINGS } });
m.headless = true;
const ev = [];
let lineErr = null;
for (let i = 0; i < 60 * 40 && m.phase === 'intro'; i++) {
  m.step(1 / 60, null);
  for (const e of m.events) if (e.type === 'intro') ev.push(`${(m.intro ? m.intro.t : 99).toFixed(1)}s ${e.stage}`);
  m.events.length = 0;
  if (m.intro && Math.abs(m.intro.t - (INTRO_TIMES.lineDone + 2)) < 0.01) {
    lineErr = Math.max(...m.players.map(p => Math.hypot(p.x - p.introLine.x, p.z - p.introLine.z)));
  }
}
console.log('eventos:', ev.join(' | '));
console.log('maior distância do lugar no perfilamento:', lineErr?.toFixed(2), 'm | fase final:', m.phase, '| sp:', m.sp && m.sp.type);
const m2 = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', intro: true, settings: { ...DEFAULT_SETTINGS } });
m2.headless = true; m2.step(1 / 60, null); m2.skipIntro();
console.log('pular: fase', m2.phase, 'sp', m2.sp && m2.sp.type);
if (lineErr > 1 || m.phase !== 'setpiece' || m2.phase !== 'setpiece') process.exit(1);
