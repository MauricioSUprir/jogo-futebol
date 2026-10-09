// Tiro de meta — Regra 16 (dono, 09/10: "não pode ter gente do outro time na área durante o tiro de meta, isso é
// regra básica"). O adversário fica FORA da área do começo ao fim da cobrança, não só no instante do chute.
//   IA × IA — N partidas com as configurações padrão: em todo quadro de tiro de meta (da montagem da cobrança até a
//             bola rolar) conta os adversários dentro da área de quem cobra. Alvo: 0 quadros.
//   humano  — o jogador controlado pelo humano (como o atacante no "só o meu jogador" do Rumo ao Estrelato) está na
//             marca do pênalti quando a bola sai e segura o analógico para dentro da área durante o tiro de meta da IA.
//             Alvo: fora da área em todos os quadros, e a cobrança acontece (o jogo não trava).
// node tools/tiro-de-meta-test.mjs [partidas=6] [--base pasta]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1].startsWith('--')));
const N = +(pos[0] || 6);
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS, PITCH } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
const BOX_D = PITCH.boxDepth ?? 16.5, BOX_W = PITCH.boxHalfW ?? 20.16;
const naArea = (m, team, x, z) => { const gx = m.ownGoalX(team); return Math.abs(gx - x) < BOX_D && Math.abs(z) < BOX_W && Math.sign(x) === Math.sign(gx); };
const tiroDeMeta = (m) => m.phase === 'setpiece' && m.sp && m.sp.type === 'goalkick';
let ok = true;
const linha = (passou, txt) => { console.log(`${passou ? 'PASSOU' : 'FALHOU'} | ${txt}`); if (!passou) ok = false; };

// ---------- IA × IA
{
  let cobrancas = 0, invadidas = 0, quadros = 0, quadrosInv = 0, maxDentro = 0;
  for (let k = 0; k < N; k++) {
    const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
    m.headless = true;
    let atual = null;
    for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
      m.step(1 / 60, null);
      for (const e of m.events) if (e.type === 'replay') m.replayFinished();
      m.events.length = 0;
      if (tiroDeMeta(m)) {
        if (atual !== m.sp) { atual = m.sp; cobrancas++; atual.inv = false; }
        const dentro = m.sp.team.opp.players.filter(q => !q.sentOff && !q.isGK && naArea(m, m.sp.team, q.x, q.z)).length;
        quadros++;
        if (dentro) { quadrosInv++; maxDentro = Math.max(maxDentro, dentro); if (!atual.inv) { atual.inv = true; invadidas++; } }
      } else atual = null;
    }
  }
  linha(quadrosInv === 0, `IA × IA (${N} partidas): adversário na área durante o tiro de meta em ${invadidas} de ${cobrancas} cobranças, ${quadrosInv} de ${quadros} quadros (até ${maxDentro} jogadores de uma vez; alvo 0 — Regra 16)`);
}

// ---------- humano tentando ficar na área
{
  const L = 12;
  let quadros = 0, quadrosDentro = 0, lancesDentro = 0, cobrados = 0, maxT = 0;
  for (let k = 0; k < L; k++) {
    const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 2) % TEAMS.length], userSide: 'home', settings: { ...DEFAULT_SETTINGS, intro: false } });
    m.headless = true;
    const parado = { mx: 0, mz: 0, held: {}, press: {}, release: {}, hold: {}, rx: 0, rz: 0 };
    let g = 0; while (m.phase !== 'play' && g++ < 4000) { m.step(1 / 60, parado); m.events.length = 0; }
    const us = m.userTeam, them = us.opp;
    const att = us.players.find(p => p.role === 'ATT' && !p.sentOff) || us.players[10];
    const gx = m.ownGoalX(them), s = Math.sign(gx);
    // a bola saiu pela linha de fundo do adversário com o atacante do humano na marca do pênalti
    att.x = gx - s * 11; att.z = (k % 3 - 1) * 4; att.vx = att.vz = 0;
    // "só o meu jogador" (como js/ponte-tm.js): ninguém mais assume o controle
    const troca = m.setControlled.bind(m);
    m.setControlled = (p) => { if (p && p !== att) return; troca(p); };
    troca(att);
    m.stopPlay('out', { type: 'goalkick', team: them, x: s * (52.5 - 5.5), z: 4 }, 1.2);
    let dentroNoLance = false, t = 0;
    for (let i = 0; i < 60 * 16; i++) {
      // ele força o analógico para o meio da área
      const dx = (gx - s * 8) - att.x, dz = -att.z, dl = Math.hypot(dx, dz) || 1;
      m.step(1 / 60, { mx: dx / dl, mz: dz / dl, held: { sprint: true }, press: {}, release: {}, hold: {}, rx: 0, rz: 0 });
      for (const e of m.events) if (e.type === 'replay') m.replayFinished();
      m.events.length = 0;
      if (tiroDeMeta(m)) {
        t += 1 / 60; quadros++;
        if (naArea(m, them, att.x, att.z)) { quadrosDentro++; dentroNoLance = true; }
      } else if (m.phase === 'play' && t > 0) { cobrados++; break; }
    }
    maxT = Math.max(maxT, t);
    if (dentroNoLance) lancesDentro++;
  }
  linha(quadrosDentro === 0, `humano forçando para dentro da área no tiro de meta da IA: dentro em ${lancesDentro} de ${L} lances, ${quadrosDentro} de ${quadros} quadros (alvo 0)`);
  linha(cobrados === L, `o tiro de meta foi cobrado em ${cobrados} de ${L} lances (o mais demorado: ${maxT.toFixed(1)} s; alvo: todos, sem travar)`);
}
process.exit(ok ? 0 : 1);
