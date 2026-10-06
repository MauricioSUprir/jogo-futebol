// Contato de corpo (seção 25): duelo ombro a ombro — quem conduz corre a 7 m/s e o
// defensor fecha de lado (ou por trás) a 8 m/s. Só o modelo de contato (match.bodies).
// Mede quantas vezes o condutor perde a bola e quantas vira falta, por perfil físico.
// node tools/contato-test.mjs [lances]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 300);
const FORTE = { str: 92, bal: 85, phy: 90 }, FRACO = { str: 58, bal: 70, phy: 60 };
const GRANDE = { height: 1.9, build: 0.9 }, PEQUENO = { height: 1.70, build: 0.3 };
function duelo(cond, def, deTras) {
  let perdeu = 0, falta = 0;
  for (let k = 0; k < N; k++) {
    const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
    m.headless = true;
    let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
    const C = m.teams[0].players[9], D = m.teams[1].players[4];
    for (const [p, at, lk] of [[C, cond.at, cond.lk], [D, def.at, def.lk]]) { p.a = { ...p.a, ...at }; p.data = { ...p.data, look: { ...p.data.look, ...lk } }; p._mass = undefined; p.fatigue = 0; }
    C.x = 0; C.z = 0; C.heading = 0; m.owner = C; m.ball.place(0.5, 0.11, 0);
    const side = Math.random() < 0.5 ? 1 : -1;
    if (deTras) { D.x = -1.6; D.z = 0; } else { D.x = -0.1; D.z = side * 1.15; }
    const f0 = m.teams[1].stats.fouls;
    for (let i = 0; i < 40; i++) {
      C.vx = 7; C.vz = 0; C.x += C.vx / 60; m.ball.p.x = C.x + 0.5;
      // de lado: corre junto e fecha o ombro; por trás: chega mais rápido na mesma linha
      if (deTras) { D.vx = 9.5; D.vz = (C.z - D.z) * 3; } else { D.vx = 7.2; D.vz = -side * 2.6; }
      D.x += D.vx / 60; D.z += D.vz / 60;
      D.heading = Math.atan2(D.vz, D.vx);
      m.bodies(1 / 60); m.events.length = 0;
      if (m.owner !== C) break;
    }
    if (m.teams[1].stats.fouls > f0) falta++; else if (m.owner !== C) perdeu++;
  }
  return `perde a bola ${(100 * perdeu / N).toFixed(0)}% | falta ${(100 * falta / N).toFixed(0)}%`;
}
const P = (nome, at, lk) => ({ nome, at, lk });
const fortes = P('forte/grande', FORTE, GRANDE), fracos = P('fraco/pequeno', FRACO, PEQUENO);
for (const [c, d] of [[fortes, fracos], [fortes, fortes], [fracos, fracos], [fracos, fortes]]) console.log(`conduz ${c.nome.padEnd(14)} × defende ${d.nome.padEnd(14)} (de lado) | ${duelo(c, d, false)}`);
console.log(`conduz ${'médio'.padEnd(14)} × defende ${'forte/grande'.padEnd(14)} (por trás) | ${duelo(P('médio', { str: 75, bal: 78, phy: 75 }, { height: 1.8, build: 0.55 }), fortes, true)}`);
