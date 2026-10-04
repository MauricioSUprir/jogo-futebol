// De onde saem os chutes e os gols (IA x IA): faixas de distância ao gol, conversão
// e quantos chutes tinham defensor perto do chutador. node tools/chutes-mapa.mjs [partidas]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 6);
const bins = {}; const faixa = (d) => d < 11 ? '<11 m' : d < 17 ? '11-17 m' : d < 25 ? '17-25 m' : '25+ m';
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % 8], away: TEAMS[(k + 3) % 8], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6 } });
  m.headless = true;
  let last = null;
  for (let i = 0; i < 60 * 60 * 30 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) {
      if (e.type === 'replay') m.replayFinished();
      if (e.type === 'shot' && m.lastShot) {
        const p = m.lastShot.p, d = Math.hypot(m.goalX(p.team) - p.x, p.z);
        const pr = Math.min(...p.team.opp.players.filter(q => !q.isGK).map(q => Math.hypot(q.x - p.x, q.z - p.z)));
        last = { f: faixa(d), livre: pr > 2.5 };
        const b = (bins[last.f] ||= { chutes: 0, gols: 0, livres: 0 }); b.chutes++; if (last.livre) b.livres++;
      }
      if (e.type === 'goal' && last) { bins[last.f].gols++; last = null; }
    }
    m.events.length = 0;
  }
}
for (const [k, v] of Object.entries(bins).sort()) console.log(k.padEnd(8), `chutes/partida ${(v.chutes / N).toFixed(1)} | gols/partida ${(v.gols / N).toFixed(1)} | conversão ${(100 * v.gols / v.chutes).toFixed(0)}% | sem marcador a 2,5 m ${(100 * v.livres / v.chutes).toFixed(0)}%`);
