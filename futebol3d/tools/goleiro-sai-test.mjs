// "Sair com o goleiro" (pedido do dono: um botão na defesa para o goleiro sair e ATACAR a bola).
// Atacante adversário sozinho conduzindo para o gol a 18–26 m (cara a cara); o humano defende segurando o botão
// (held.gkrush; o teste também segura 'through', que era o atalho antigo). Mede, por lance:
//   saída   — quanto o goleiro já saiu da linha 1,5 s depois (m)
//   chega   — se ele foi na bola: chegou a ≤ 2,5 m dela (alcance do mergulho), ganhou a bola, ou estava
//             a ≤ 4 m quando o atacante chutou
//             (ataca a bola, não só fecha o ângulo)
//   tenta   — se ele tentou ganhar a bola (abafa nos pés / dividida / agarra / afasta)
// e, sem apertar nada, que o goleiro NÃO corre sozinho no atacante a 28 m (o botão é que manda; parado
// na posição normal ele fica a ~4 m da linha com a bola a essa distância).
// node tools/goleiro-sai-test.mjs [lances=120] [--base pasta]   (com 40 lances a média oscilava ±0,4 m e ±5 pontos)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1] === '--base'));
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
const N = +(pos[0] || 120);
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function lance(botao, dist) {
  const m = new Match({ home: TEAMS[0], away: TEAMS[2], userSide: 'home', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  let g = 0; while (m.phase !== 'play' && g++ < 3000) { m.step(1 / 60, null); m.events.length = 0; }
  const us = m.userTeam, them = us.opp, gk = us.gk, gx = m.ownGoalX(us), s = Math.sign(gx);
  const A = them.players.find(p => p.role === 'ATT' && !p.sentOff) || them.players[10];
  const z0 = (rnd() - 0.5) * 14, x0 = gx - s * dist;
  const fora = () => {
    // só o atacante e o goleiro no lance: o resto parado longe (do outro lado do campo)
    for (const q of m.players) if (q !== A && q !== gk) { q.x = -s * 40 + (q.idx % 5); q.z = (q.idx % 11) * 5 - 25; q.vx = q.vz = 0; q.stun = 0.3; q.dx = q.dz = 0; }
  };
  fora();
  A.x = x0; A.z = z0; A.heading = s > 0 ? 0 : Math.PI; A.vx = s * 4; A.vz = 0;
  gk.x = gx - s * 1.2; gk.z = z0 * 0.15; gk.vx = gk.vz = 0; gk.action = null;
  m.ball.place(A.x + s * 0.4, 0.11, A.z); m.ball.v.x = m.ball.v.z = 0; m.takeBall(A, 'control');
  const ctl = us.players.find(p => !p.isGK);
  m.setControlled(ctl);
  const R = { saida: null, chega: false, tenta: false, fim: 'nada' };
  let chutou = false, dChute = null;
  for (let k = 0; k < 60 * 4.5; k++) {
    fora();
    const held = botao ? { gkrush: true, through: true } : {};
    m.step(1 / 60, { mx: 0, mz: 0, held, press: {}, release: {}, hold: {}, rx: 0, rz: 0 });
    for (const e of m.events) { if (e.type === 'replay') m.replayFinished(); if (!chutou && (e.type === 'shot' || (e.type === 'kick' && (e.kind === 'shot' || e.kind === 'chip')))) { chutou = true; dChute = Math.hypot(m.ball.p.x - gk.x, m.ball.p.z - gk.z); } }
    m.events.length = 0;
    const t = (k + 1) / 60, b = m.ball.p;
    if (R.saida === null && t >= 1.5) R.saida = Math.abs(gx) - Math.abs(gk.x);
    if (!chutou && Math.hypot(b.x - gk.x, b.z - gk.z) <= 2.5) R.chega = true;
    const at = gk.action && gk.action.type;
    if ((at === 'gk_dive' && !(gk.action.data.diveHeight > 0.05)) || at === 'tackle' || at === 'slide' || at === 'gk_catch') R.tenta = true;
    if (m.owner === gk || m.holder === gk || m.lastTouch === gk) { R.tenta = true; R.chega = true; R.fim = 'goleiro'; break; }
    if (m.phase === 'goal') { R.fim = 'gol'; break; }
    if (m.phase !== 'play') { R.fim = chutou ? 'chute' : 'parou'; break; }
  }
  if (dChute !== null && dChute <= 4) R.chega = true;
  if (R.fim === 'nada' && chutou) R.fim = 'chute';
  return R;
}

const linhas = [];
let ok = true;
{
  const R = Array.from({ length: N }, () => lance(true, 18 + rnd() * 8));
  const saida = R.reduce((a, r) => a + (r.saida ?? 0), 0) / N;
  const chega = R.filter(r => r.chega).length / N, tenta = R.filter(r => r.tenta).length / N;
  const fins = {}; for (const r of R) fins[r.fim] = (fins[r.fim] || 0) + 1;
  const c1 = saida >= 7, c2 = chega >= 0.75, c3 = tenta >= 0.6;
  ok = ok && c1 && c2 && c3;
  linhas.push(`${c1 ? 'PASSOU' : 'FALHOU'} | com o botão, 1,5 s depois o goleiro já saiu ${saida.toFixed(1)} m da linha (alvo ≥ 7 m)`);
  linhas.push(`${c2 ? 'PASSOU' : 'FALHOU'} | vai na bola (chega a ≤ 2,5 m, ganha a bola ou está a ≤ 4 m no chute) em ${(chega * 100).toFixed(0)}% dos lances (alvo ≥ 75%)`);
  linhas.push(`${c3 ? 'PASSOU' : 'FALHOU'} | tenta ganhar a bola (abafa, dividida, agarra) em ${(tenta * 100).toFixed(0)}% (alvo ≥ 60%) | fim dos lances: ${JSON.stringify(fins)}`);
}
{
  const R = Array.from({ length: Math.ceil(N / 2) }, () => lance(false, 28));
  const saida = R.reduce((a, r) => a + (r.saida ?? 0), 0) / R.length;
  const c4 = saida <= 5.5;
  ok = ok && c4;
  linhas.push(`${c4 ? 'PASSOU' : 'FALHOU'} | sem o botão, com o atacante a 28 m, o goleiro fica na posição: está a ${saida.toFixed(1)} m da linha 1,5 s depois (alvo ≤ 5,5 m)`);
}
for (const l of linhas) console.log(l);
process.exit(ok ? 0 : 1);
