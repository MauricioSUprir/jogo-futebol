// Bola parada com o time todo atordoado (falta seguida de trombada): a cobrança tem de ser montada sem travar.
// Antes a lista de cobradores (só quem está em pé) ficava vazia e o jogo parava com TypeError em setupRestart
// (achado na gravação do vídeo do botão GOLEIRO). Reprova (saída 1) se der erro ou se ninguém for cobrar.
// node tools/cobrador-test.mjs [--base pasta]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
let ok = 0, n = 0;
for (const tipo of ['freekick', 'indirect', 'throwin', 'corner', 'goalkick', 'penalty']) {
  n++;
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  const t = m.teams[0];
  for (const p of t.players) if (!p.isGK) p.stun = 2;
  const gx = m.goalX(t), s = Math.sign(gx);
  const pos = { freekick: [s * 20, 5], indirect: [s * 15, -8], throwin: [0, 34], corner: [s * 52.5, 34], goalkick: [-s * 47, 4], penalty: [s * 41.5, 0] }[tipo];
  try {
    m.stopPlay('foul', { type: tipo, team: t, x: pos[0], z: pos[1] }, 0.3);
    for (let i = 0; i < 60 && m.phase !== 'setpiece'; i++) { m.step(1 / 60, null); m.events.length = 0; }
    if (m.phase === 'setpiece' && m.sp && m.sp.taker) ok++;
    else console.log(`FALHOU | ${tipo}: sem cobrador (fase ${m.phase})`);
  } catch (e) { console.log(`FALHOU | ${tipo}: ${e.message}`); }
}
console.log(`${ok === n ? 'PASSOU' : 'FALHOU'} | bola parada com o time todo atordoado: cobrança montada em ${ok} de ${n} tipos`);
process.exit(ok === n ? 0 : 1);
