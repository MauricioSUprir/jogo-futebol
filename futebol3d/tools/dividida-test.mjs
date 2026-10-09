// Dividida (desarme em pé) do jogador humano: em N lances, o atacante adversário conduz
// e o defensor controlado, a uma distância inicial, aperta a dividida. Mede quantas vezes
// a bola foi roubada (ficou com o time de quem desarmou), só tirada (ficou solta), virou falta
// ou o desarme furou (o atacante seguiu com ela).
// O atacante só conduz (passe e chute desligados no teste) e os companheiros dele ficam longe: o lance mede
// o desarme, não o passe. Antes desta versão o atacante da IA passava a bola logo depois do aperto e o
// teste contava isso como "roubou" (quando um companheiro dele dominava) ou "tirou" (bola rolando).
// node tools/dividida-test.mjs [lances] [distância inicial m] [quadro do aperto] [--base pasta] [--alvo] [--natural]
//   --natural: lance como no jogo (a IA pode passar); mede a falta do bote que chega depois do passe
//   --alvo: reprova (saída 1) se roubou < 55% ou falta > 10% (com --natural: roubou < 50% ou falta > 15% com
//   o atacante ainda com a bola, ou falta > 8% no bote que chega depois do passe)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1] === '--base'));
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
const NATURAL = process.argv.includes('--natural');
const N = +(pos[0] || 200), D0 = +(pos[1] || 1.8), PRESS = +(pos[2] || 2);
const CHUTES = new Set(['pass', 'long', 'through', 'cross', 'shot', 'chip', 'finesse', 'volley', 'clear', 'hpass', 'hclear']);
const res = { roubou: 0, tirou: 0, falta: 0, furou: 0, semDesarme: 0 };
let passou = 0, faltaTardia = 0;
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
  m.headless = true;
  // chega ao jogo corrido
  let guard = 0;
  while (m.phase !== 'play' && guard++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  const us = m.userTeam, opp = us.opp;
  const att = opp.players[8], def = us.players[4];
  // posiciona: atacante conduzindo rumo ao gol do usuário; defensor de frente
  const dir = Math.sign(m.ownGoalX(us)) || -1;
  // companheiros do atacante longe, atrás dele (sem opção de passe); os outros defensores também longe
  if (!NATURAL) for (const q of opp.players) if (q !== att && !q.isGK) { q.x = -dir * (28 + (q.idx % 5) * 3); q.z = (q.idx % 7) * 8 - 24; q.vx = q.vz = 0; }
  if (!NATURAL) for (const q of us.players) if (q !== def && !q.isGK) { q.x = -dir * 20 + (q.idx % 4); q.z = (q.idx % 2 ? 1 : -1) * (20 + q.idx); q.vx = q.vz = 0; }
  att.x = 0; att.z = 0; att.heading = dir > 0 ? 0 : Math.PI;
  const ang = (Math.random() - 0.5) * 1.2;
  def.x = att.x + dir * D0 * Math.cos(ang); def.z = att.z + D0 * Math.sin(ang);
  m.ball.place(att.x + att.fx * 0.35, 0.11, att.z + att.fz * 0.35); m.ball.v.x = m.ball.v.z = 0;
  m.takeBall(att, 'control'); m.lastKick = null;
  // o atacante só conduz: passe e chute desligados no teste (sob pressão a IA solta a bola na hora, e
  // aí o lance deixa de medir o desarme)
  if (!NATURAL) {
    const sa = att.startAction.bind(att);
    att.startAction = (type, data) => (CHUTES.has(type) ? undefined : sa(type, data));
  }
  // atacante já em corrida rumo ao gol (condução de verdade, não parado)
  att.vx = dir * 5; att.vz = 0; m.ball.v.x = dir * 5;
  def.heading = Math.atan2(att.z - def.z, att.x - def.x);
  m.setControlled(def);
  let fouls = us.stats.fouls;
  let started = false, out = null, chutou = false;
  for (let i = 0; i < 90; i++) {
    const press = i === PRESS ? { tackle: true } : {};
    const cmd = { mx: 0, mz: 0, held: {}, press, release: {}, hold: {}, rx: 0, rz: 0 };
    m.step(1 / 60, cmd);
    m.events.length = 0;
    // o atacante soltou a bola (passe/chute) antes de o bote resolver: não é lance de dividida
    if (m.lastKick && m.lastKick.p === att && (!started || def.action)) { if (!chutou && process.env.DBG) console.log('chute', m.lastKick.kind, i, started); chutou = true; }
    if (def.action && def.action.type === 'tackle') started = true;
    if (m.phase !== 'play') { out = 'falta'; break; }
    if (m.owner === def) { out = 'roubou'; break; }
    if (started && !def.action) {
      if (m.owner === att) out = 'furou';
      else if (m.owner) out = m.owner.team === us ? 'roubou' : 'furou';
      else out = 'tirou';
      break;
    }
  }
  if (!out) out = started ? (m.owner === att ? 'furou' : m.owner && m.owner.team === us ? 'roubou' : 'tirou') : 'semDesarme';
  if (us.stats.fouls > fouls) out = 'falta';
  if (chutou) { passou++; if (out === 'falta') faltaTardia++; if (!NATURAL || out !== 'falta') continue; }
  res[out]++;
}
const n = Object.values(res).reduce((s, v) => s + v, 0);
const pct = (v) => (100 * v / Math.max(1, n)).toFixed(0) + '%';
console.log(`dividida a ${D0} m em ${n} lances:`, Object.entries(res).map(([k, v]) => `${k} ${pct(v)}`).join(' | '),
  passou ? `(fora da conta: ${passou} em que o atacante passou/chutou antes do bote)` : '');
if (NATURAL) console.log(`natural (a IA pode passar): o atacante soltou a bola antes do bote em ${passou} de ${N}; em ${faltaTardia} deles o bote chegou depois e foi falta (${(faltaTardia / Math.max(1, passou) * 100).toFixed(0)}%)`);
if (process.argv.includes('--alvo') && NATURAL) {
  // com o atacante ainda com a bola no bote: desde a Fase 3 a IA protege e o bote "atravessava" o corpo
  const ok = res.roubou / Math.max(1, n) >= 0.5 && res.falta / Math.max(1, n) <= 0.15 && faltaTardia / Math.max(1, passou) <= 0.08;
  console.log(`${ok ? 'PASSOU' : 'FALHOU'} | com a bola no bote (${n} lances): roubou ${pct(res.roubou)} (alvo ≥ 50%), falta ${pct(res.falta)} (alvo ≤ 15%); falta no bote que chega depois do passe ${(faltaTardia / Math.max(1, passou) * 100).toFixed(0)}% (alvo ≤ 8%)`);
  process.exit(ok ? 0 : 1);
}
if (process.argv.includes('--alvo')) {
  const ok = res.roubou / n >= 0.55 && res.falta / n <= 0.10;
  console.log(`${ok ? 'PASSOU' : 'FALHOU'} | roubou ${pct(res.roubou)} (alvo ≥ 55%), falta ${pct(res.falta)} (alvo ≤ 10%)`);
  process.exit(ok ? 0 : 1);
}
