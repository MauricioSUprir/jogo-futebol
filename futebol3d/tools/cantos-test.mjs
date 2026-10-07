// Motor de cantos (§31): roteiro de 80 s — canto nasce, espalha, ataque perigoso
// interrompe, "UUUH!", palmas, canto volta, gol da casa vira festa. node tools/cantos-test.mjs
import { ChantEngine, SECTORS, clubLibrary } from '../js/chants.js';
const e = new ChantEngine('serrano', 'nordhafen');
let last = '';
const log = [];
for (let i = 0; i < 80 * 10; i++) {
  const t = i / 10;
  const threat = t > 34 && t < 38 ? 0.85 : t > 38 && t < 40 ? 0.2 : 0.15;
  const goal = Math.abs(t - 62) < 0.05 ? 'home' : null;
  const o = e.update(0.1, { phase: 'play', threat, homeScore: t > 62 ? 1 : 0, awayScore: 0, minute: 30 + t / 60, homeIntensity: 0.5, goal });
  const secs = o.sectors.map((v, k) => (v > 0.3 ? SECTORS[k].nome : null)).filter(Boolean).join(', ') || '—';
  const line = `${o.state.padEnd(12)} canto ${String(o.song).padEnd(6)} setores: ${secs}${o.event ? '  ← ' + o.event.toUpperCase() : ''}`;
  if (line !== last) { log.push(`${t.toFixed(1).padStart(5)} s  ${line}`); last = line; }
}
console.log(log.join('\n'));
console.log('bibliotecas:', JSON.stringify(clubLibrary('serrano')), JSON.stringify(clubLibrary('nordhafen')));
