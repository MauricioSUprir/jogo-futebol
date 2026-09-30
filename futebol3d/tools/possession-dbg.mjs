// Diagnóstico da IA: posse controlada, tipos de chute, passes certos (node tools/possession-dbg.mjs [segundos])
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const secs = +(process.argv[2] || 120);
const m = new Match({ home: TEAMS[0], away: TEAMS[3], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 3 } });
m.headless = true;
const c = {}; let own = 0, last = null, changes = 0;
for (let i = 0; i < 60 * secs; i++) {
  m.step(1 / 60, null);
  for (const e of m.events) { if (e.type === 'kick' && e.kind === 'long') { const kk = 'L ' + e.src + '/' + e.role + '/' + e.sp; c[kk] = (c[kk] || 0) + 1; } const k = e.type + ':' + (e.kind || ''); c[k] = (c[k] || 0) + 1; if (e.type === 'replay') m.replayFinished(); }
  m.events.length = 0;
  if (m.owner) own++;
  const ot = m.owner ? m.owner.team.i : null;
  if (ot !== null && ot !== last) { changes++; last = ot; }
}
const pick = k => c[k] || 0;
console.log(`passe ${pick('kick:pass')} longo ${pick('kick:long')} cabeceio ${pick('kick:header')} chute ${pick('kick:shot')} bloqueio ${pick('block:')} desarme ${pick('tackle:')} gols ${pick('goal:')} defesas ${pick('save:parry') + pick('save:catch')}`);
console.log('trocas de posse', changes, 'posse controlada %', (own / (secs * 0.6)).toFixed(0), 'passes (feitos/certos)', m.teams.map(t => t.stats.passes + '/' + t.stats.passOk).join(' '));
console.log(Object.entries(c).filter(([k]) => k.startsWith('L ')).map(([k, v]) => k + '=' + v).join('  '));
