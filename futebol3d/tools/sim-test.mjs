// Simulação sem gráficos: partida inteira CPU x CPU (e com humano aleatório)
// para achar bugs de regra, NaN, travamentos e bola fora do mundo.
// Uso: node tools/sim-test.mjs [minutosPorTempo] [lado humano: home|away|none] [seed]
import { Match } from '../js/match.js';
import { FORMATIONS, DEFAULT_SETTINGS } from '../js/config.js';

const halfMin = +(process.argv[2] || 4);
const userSide = process.argv[3] || 'none';
let TEAMS;
try { TEAMS = (await import('../js/teams.js')).TEAMS; } catch { TEAMS = null; }
function stubTeam(name, formation, rating) {
  const roles = FORMATIONS[formation];
  const players = [];
  for (let i = 0; i < 18; i++) {
    const role = roles[Math.min(i, 10)][0];
    const r = rating + (Math.random() * 10 - 5);
    players.push({ name: name[0] + '. J' + i, num: i + 1, pos: role, foot: Math.random() < 0.25 ? 'E' : 'D',
      attrs: { pac: r, sho: role === 'ATT' ? r + 5 : r - 10, pas: r, dri: r, def: role === 'DEF' ? r + 5 : r - 15, phy: r, gk: role === 'GK' ? r + 5 : 20 },
      look: { skin: '#a0785a', hair: 'short', hairColor: '#222', height: 1.8, build: 0.5, beard: false } });
  }
  return { id: name, name, short: name.slice(0, 3).toUpperCase(), formation, rating, style: { press: 0.6, width: 0.5, tempo: 0.5, directness: 0.5 }, players, kits: {} };
}
const home = TEAMS ? TEAMS[0] : stubTeam('Aurora', '4-3-3', 80);
const away = TEAMS ? TEAMS[3] : stubTeam('Brisa', '4-4-2', 78);
const settings = { ...DEFAULT_SETTINGS, halfMinutes: halfMin };
const m = new Match({ mode: 'amistoso', home, away, homeKit: {}, awayKit: {}, homeGK: {}, awayGK: {}, userSide, knockout: process.argv[5] === 'ko', settings });
m.headless = true;

const counts = {};
const dt = 1 / 60;
let t = 0, maxT = halfMin * 60 * 2 * 1.6 + 300;
let lastPhase = '', phaseSince = 0, stuck = 0;
const cmd = { mx: 0, mz: 0, press: {}, release: {}, held: {}, hold: {}, rx: 0, rz: 0 };
let err = null;
while (t < maxT && m.phase !== 'ended') {
  // humano "aleatório": corre para a bola e aperta botões
  if (userSide !== 'none') {
    for (const k of ['press', 'release', 'held', 'hold']) cmd[k] = {};
    const p = m.controlled;
    if (p) {
      const dx = m.ball.p.x - p.x, dz = m.ball.p.z - p.z, d = Math.hypot(dx, dz) || 1;
      const gx = m.goalX(m.userTeam);
      const owner = m.owner === p;
      cmd.mx = owner ? (gx - p.x) / Math.hypot(gx - p.x, p.z) : dx / d; cmd.mz = owner ? -p.z / Math.hypot(gx - p.x, p.z) : dz / d;
      cmd.held.sprint = Math.random() < 0.5;
      const r = Math.random();
      if (r < 0.01) { cmd.release.pass = true; cmd.hold.pass = Math.random() * 0.6; }
      else if (r < 0.013) { cmd.release.shoot = true; cmd.hold.shoot = Math.random(); }
      else if (r < 0.016) { cmd.release.long = true; cmd.hold.long = Math.random(); }
      else if (r < 0.018) { cmd.release.through = true; cmd.hold.through = 0.4; }
      else if (r < 0.02) cmd.press.switch = true;
      else if (r < 0.022) cmd.press.shoot = true;
      else if (r < 0.024) cmd.press.skill = true;
      if (Math.random() < 0.3) cmd.held.pass = true;
    }
  }
  try { m.step(dt, cmd); } catch (e) { err = e; break; }
  t += dt;
  for (const e of m.events) counts[e.type + (e.kind ? ':' + e.kind : '') + (e.text ? ':' + e.text : '')] = (counts[e.type + (e.kind ? ':' + e.kind : '') + (e.text ? ':' + e.text : '')] || 0) + 1;
  for (const e of m.events) if (e.type === 'replay') m.replayFinished();
  m.events.length = 0;
  const b = m.ball.p;
  if (!isFinite(b.x + b.y + b.z) || m.players.some(p => !isFinite(p.x + p.z + p.heading))) { err = new Error('NaN em t=' + t.toFixed(1)); break; }
  if (Math.abs(b.x) > 70 || Math.abs(b.z) > 55 || b.y < 0.05) { err = new Error(`bola fora do mundo ${b.x},${b.y},${b.z}`); break; }
  if (m.phase !== lastPhase) { lastPhase = m.phase; phaseSince = t; }
  if (t - phaseSince > 40 && m.phase !== 'play') { err = new Error('travado na fase ' + m.phase + ' sp=' + (m.sp && m.sp.type)); break; }
  if (m.phase === 'play' && m.ball.hspeed() < 0.05 && !m.owner && !m.ball.held) { stuck += dt; if (stuck > 20) { err = new Error('bola parada sem ninguém por 20 s em ' + b.x.toFixed(1) + ',' + b.z.toFixed(1)); break; } } else stuck = 0;
}
const r = m.result();
console.log(`${home.name} ${r.homeGoals} x ${r.awayGoals} ${away.name}`, r.pens ? `(pên ${r.pens.home}x${r.pens.away})` : '', 'fase', m.phase, 'tempo real', t.toFixed(0) + 's', 'relógio', (m.clock / 60).toFixed(1));
console.log('gols', r.scorers.map(s => `${s.minute}' ${s.name}`).join(', '));
console.log('stats', JSON.stringify(r.stats));
console.log('eventos', JSON.stringify(Object.fromEntries(Object.entries(counts).filter(([k]) => /banner|whistle|goal|save|card|post|bar|block|tackle|shot|catch|setpiece/.test(k)).sort())));
if (err) { console.error('ERRO:', err.stack || err); process.exit(1); }
