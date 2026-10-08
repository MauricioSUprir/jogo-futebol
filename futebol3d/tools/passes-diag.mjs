// Desfecho de cada passe em partidas IA x IA (diagnóstico do acerto de passe, Fase 3):
// por tipo (pass/through/long/cross): tentativas, completados, cortados (e como), fora,
// impedimento; distância média e "abertura" do recebedor (adversário mais perto dele).
// node tools/passes-diag.mjs [partidas=3] [minutos por tempo=padrão do jogo]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 3), HM = +(process.argv[3] || DEFAULT_SETTINGS.halfMinutes);
const R = {};
const add = (tipo, k, v = 1) => { R[tipo] ||= { n: 0, ok: 0, cortado: {}, fora: 0, imp: 0, outro: 0, dist: 0, abert: 0 }; if (k === 'cortado') R[tipo].cortado[v] = (R[tipo].cortado[v] || 0) + 1; else R[tipo][k] += v; };
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: HM, intro: false } });
  m.headless = true;
  let aberto = null;
  const fecha = (k2, v) => { if (!aberto) return; add(aberto.tipo, k2, v); aberto = null; };
  const origT = m.touch.bind(m);
  m.touch = (p, how) => {
    if (aberto && p !== aberto.p && how !== 'kick') {
      if (p.team === aberto.p.team) fecha('ok'); else fecha('cortado', how);
    }
    if (how === 'kick' && p.action && ['pass', 'through', 'long', 'cross'].includes(p.action.type)) {
      fecha('outro');
      const rec = p.action.data?.receiver;
      let ab = 20; if (rec) for (const q of p.team.opp.players) if (!q.sentOff) ab = Math.min(ab, Math.hypot(q.x - rec.x, q.z - rec.z));
      aberto = { p, tipo: p.action.type, t: m.time };
      add(aberto.tipo, 'n'); add(aberto.tipo, 'dist', rec ? Math.hypot(rec.x - p.x, rec.z - p.z) : 0); add(aberto.tipo, 'abert', ab);
    }
    return origT(p, how);
  };
  for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) {
      if (e.type === 'replay') m.replayFinished();
      if (aberto && e.type === 'banner' && e.kind === 'offside') fecha('imp');
      else if (aberto && e.type === 'banner' && /LATERAL|TIRO DE META|ESCANTEIO/.test(e.text || '')) fecha('fora');
    }
    m.events.length = 0;
    if (aberto && m.time - aberto.t > 6) fecha('outro');
  }
}
for (const [tipo, r] of Object.entries(R)) {
  const cort = Object.values(r.cortado).reduce((a, b) => a + b, 0);
  console.log(`${tipo.padEnd(8)} ${(r.n / N).toFixed(1).padStart(5)}/partida | certos ${(r.ok / r.n * 100).toFixed(0)}% | cortados ${(cort / r.n * 100).toFixed(0)}% ${JSON.stringify(r.cortado)} | fora ${(r.fora / r.n * 100).toFixed(0)}% | imped. ${r.imp} | outro ${r.outro} | dist ${(r.dist / r.n).toFixed(1)} m | adversário mais perto do recebedor ${(r.abert / r.n).toFixed(1)} m`);
}
