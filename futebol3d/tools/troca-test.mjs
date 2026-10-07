// Indicador do TROCAR depois de uma troca AUTOMÁTICA (bola solta / recepção): a troca grava
// lastSwitchT sem switchIdx e o candidato saía de list[NaN] → TypeError no quadro (achado na
// gravação da auditoria, quadro 154). Reprova (saída 1) se switchCandidate/switchPlayer
// quebrarem ou devolverem vazio logo após uma troca automática.
// node tools/troca-test.mjs
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
import { switchCandidate, switchPlayer } from '../js/human.js';
let ok = true;
for (let k = 0; k < 50; k++) {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
  m.headless = true;
  let guard = 0;
  while (m.phase !== 'play' && guard++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  // troca automática como a de human.js (bola solta) / main.js (recepção): só o horário
  const q = m.userTeam.players[3 + (k % 7)];
  m.setControlled(q); m.lastSwitchT = m.time; delete m.switchIdx;
  try {
    const c = switchCandidate(m);
    if (!c) { ok = false; console.log('FALHOU | candidato vazio logo após troca automática'); break; }
    switchPlayer(m, true);
    if (!m.controlled || m.controlled === q) { ok = false; console.log('FALHOU | TROCAR manual não trocou'); break; }
  } catch (e) { ok = false; console.log('FALHOU | indicador do TROCAR quebrou:', e.message); break; }
}
console.log(ok ? 'PASSOU | TROCAR e indicador após troca automática (50 casos)' : 'TROCA: HÁ FALHAS');
process.exit(ok ? 0 : 1);
