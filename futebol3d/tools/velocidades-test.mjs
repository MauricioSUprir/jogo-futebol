// Velocidades dos jogadores de linha (auditoria, Fase 2 item 4), IA x IA, só bola em jogo:
// ≥ 35% do tempo abaixo de 7 km/h (1,94 m/s) e ≤ 5% acima de 25 km/h (6,94 m/s).
// Mostra também a distribuição por faixa (parado/andando/trote/corrida/arrancada).
// node tools/velocidades-test.mjs [partidas=2] [minutos por tempo=6]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 2), HM = +(process.argv[3] || 6);
const faixas = [['parado <1,2', 0, 1.2], ['andando 1,2–2', 1.2, 2], ['2–2,5', 2, 2.5], ['trote 2,5–4', 2.5, 4], ['4–4,5', 4, 4.5], ['corrida 4,5–6', 4.5, 6], ['6–7,5', 6, 7.5], ['arrancada 7,5–9,3', 7.5, 9.3], ['>9,3', 9.3, 99]];
const cont = faixas.map(() => 0);
const modos = {};
let tot = 0, abaixo7 = 0, acima25 = 0, vmax = 0;
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: HM, intro: false } });
  m.headless = true;
  let g = 0;
  while (m.phase !== 'ended' && g++ < 60 * 60 * HM * 3) {
    m.step(1 / 60, null); m.events.length = 0;
    if (m.phase !== 'play') continue;
    for (const p of m.players) {
      if (p.isGK || p.sentOff) continue;
      const v = Math.hypot(p.vx, p.vz);
      tot++; if (v < 1.944) abaixo7++; if (v > 6.944) acima25++; vmax = Math.max(vmax, v);
      cont[faixas.findIndex(f => v >= f[1] && v < f[2])]++;
      const md = p.aiMode || '?'; modos[md] = modos[md] || [0, 0, 0]; modos[md][0]++; if (v < 1.944) modos[md][1]++; if (v > 6.944) modos[md][2]++;
    }
  }
}
faixas.forEach((f, i) => console.log(`${f[0].padEnd(20)} ${(cont[i] / tot * 100).toFixed(1).padStart(5)}%`));
for (const [k, c] of Object.entries(modos)) console.log(`  ${k.padEnd(12)} ${(c[0] / tot * 100).toFixed(1).padStart(5)}% do tempo | <7 km/h ${(c[1] / c[0] * 100).toFixed(0)}% | >25 km/h ${(c[2] / c[0] * 100).toFixed(0)}%`);
const a = abaixo7 / tot, b = acima25 / tot;
console.log(`velocidade máxima ${vmax.toFixed(2)} m/s`);
const ok1 = a >= 0.35, ok2 = b <= 0.05;
console.log(`${ok1 ? 'PASSOU' : 'FALHOU'} | tempo abaixo de 7 km/h: ${(a * 100).toFixed(1)}% (alvo ≥ 35%)`);
console.log(`${ok2 ? 'PASSOU' : 'FALHOU'} | tempo acima de 25 km/h: ${(b * 100).toFixed(1)}% (alvo ≤ 5%)`);
process.exit(ok1 && ok2 ? 0 : 1);
