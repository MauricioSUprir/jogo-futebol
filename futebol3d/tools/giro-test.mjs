// Giro de 180° e corte de 90° (auditoria, Fase 2 item 3), jogador controlado a ~6 m/s:
//  - 180° (direcional invertido de uma vez, e "pelo lado" em 0,12 s): deriva lateral máxima
//    (quanto sai da linha) ≤ 0,25 m até voltar a correr a 3 m/s no sentido novo. REPROVA se não.
//  - mostra também o quanto passa do ponto (frenagem), o tempo da virada e o corte de 90°.
// node tools/giro-test.mjs
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const DT = 1 / 60;
function corredor() {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], userSide: 'home', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
  m.headless = true;
  const p = m.userTeam.players[7];
  p.x = 0; p.z = 0; p.vx = p.vz = 0; p.heading = 0; p.human = true; p.action = null; p.stun = 0; p.stamina = 1;
  // embala até ~6 m/s rumo a +x
  p.sprint = true;
  for (let i = 0; i < 240 && p.speed < 6; i++) { p.dx = p.sprintSpd; p.dz = 0; p.step(DT); }
  return p;
}
function giro(modo) {
  const p = corredor();
  const v0 = p.speed, x0 = p.x, z0 = p.z;
  let lat = 0, over = 0, t = 0, back = null;
  for (let i = 0; i < 300; i++) {
    t = i * DT;
    let a = Math.PI;
    if (modo === 'lado') a = Math.min(1, t / 0.12) * Math.PI;           // direcional varre pelo lado
    if (modo === '90') a = Math.PI / 2;
    p.sprint = true; p.dx = Math.cos(a) * p.sprintSpd; p.dz = Math.sin(a) * p.sprintSpd;
    p.step(DT);
    if (modo === '90') {
      over = Math.max(over, p.x - x0);                                  // avanço no sentido antigo
      const ang = Math.abs(Math.atan2(p.vz, p.vx) - Math.PI / 2);
      if (back === null && p.speed > 2 && ang < 0.26) back = t;
    } else {
      lat = Math.max(lat, Math.abs(p.z - z0));
      over = Math.max(over, p.x - x0);
      if (back === null && -p.vx > 3) back = t;
      if (back !== null && t > back + 0.3) break;
    }
  }
  return { v0, lat, over, back };
}
let ok = true;
for (const modo of ['direto', 'lado']) {
  const r = giro(modo);
  const pass = r.lat <= 0.25;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASSOU' : 'FALHOU'} | 180° (${modo}) a ${r.v0.toFixed(1)} m/s | deriva lateral ${r.lat.toFixed(2)} m (alvo ≤ 0,25) | passa do ponto ${r.over.toFixed(2)} m | volta a 3 m/s em ${r.back == null ? '—' : r.back.toFixed(2) + ' s'}`);
}
const c = giro('90');
console.log(`info   | corte de 90° a ${c.v0.toFixed(1)} m/s | avança ${c.over.toFixed(2)} m no sentido antigo | direção nova (±15°) em ${c.back == null ? '—' : c.back.toFixed(2) + ' s'}`);
process.exit(ok ? 0 : 1);
