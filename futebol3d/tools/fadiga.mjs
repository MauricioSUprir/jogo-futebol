// Fadiga (seção 34): desgaste no fim da partida por faixa do atributo fôlego, fôlego
// médio e erro de passe no 1º × último quarto do jogo (IA x IA). node tools/fadiga.mjs [partidas]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 4);
const bins = {}, pas = { ini: [0, 0], fim: [0, 0] };
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % 8], away: TEAMS[(k + 3) % 8], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6 } });
  m.headless = true;
  let last = null;
  for (let i = 0; i < 60 * 60 * 30 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) if (e.type === 'replay') m.replayFinished();
    m.events.length = 0;
    // passes: completos por quarto do jogo (pelo relógio)
    const lk = m.lastKick;
    if (lk && lk !== last && lk.kind === 'pass') { last = lk; lk._q = m.clock < 22.5 * 60 ? 'ini' : m.clock > 67.5 * 60 ? 'fim' : null; }
    if (last && last._q && !last._done && m.owner) { last._done = true; pas[last._q][0]++; if (m.owner.team === last.p.team) pas[last._q][1]++; }
  }
  for (const p of m.players) { if (p.isGK) continue; const b = p.a.sta >= 80 ? 'fôlego 80+' : p.a.sta >= 70 ? 'fôlego 70-79' : 'fôlego <70'; (bins[b] ||= []).push(p.fatigue); }
}
for (const [k, v] of Object.entries(bins).sort()) console.log(k.padEnd(13), `desgaste no fim: média ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} | máx ${Math.max(...v).toFixed(2)} (n ${v.length})`);
console.log(`passes completos: 1º quarto ${(100 * pas.ini[1] / pas.ini[0]).toFixed(0)}% (${pas.ini[0]}) | último quarto ${(100 * pas.fim[1] / pas.fim[0]).toFixed(0)}% (${pas.fim[0]})`);
