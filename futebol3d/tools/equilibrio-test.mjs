// Equilíbrio das partidas IA x IA (auditoria, Fase 3): em N partidas (padrão 24, tempos de
// 6 min — escala do jogo), médias por partida e alvos:
//   gols 2,3–3,5 · conversão (gols/chutes) 9–14% · acerto de passe 75–88% · impedimentos ≥ 1
// Também mostra chutes, passes, faltas e posse. Reprova (saída 1) fora dos alvos.
// node tools/equilibrio-test.mjs [partidas=24] [minutos por tempo=6]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 24), half = +(process.argv[3] || 6);
const S = { gols: 0, chutes: 0, noAlvo: 0, passes: 0, passesCertos: 0, impedimentos: 0, faltas: 0, escanteios: 0 };
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: half, intro: false } });
  m.headless = true;
  for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) if (e.type === 'replay') m.replayFinished();
    m.events.length = 0;
  }
  for (const t of m.teams) {
    const st = t.stats;
    S.gols += t.score; S.chutes += st.shots; S.noAlvo += st.onTarget || 0;
    S.passes += st.passes || 0; S.passesCertos += st.passOk || 0;
    S.impedimentos += st.offsides || 0; S.faltas += st.fouls || 0; S.escanteios += st.corners || 0;
  }
}
const g = S.gols / N, conv = S.gols / Math.max(1, S.chutes), pa = S.passesCertos / Math.max(1, S.passes), imp = S.impedimentos / N;
console.log(`partidas ${N} | chutes/partida ${(S.chutes / N).toFixed(1)} (no alvo ${(S.noAlvo / N).toFixed(1)}) | passes/partida ${(S.passes / N).toFixed(0)} | faltas ${(S.faltas / N).toFixed(1)} | escanteios ${(S.escanteios / N).toFixed(1)}`);
const r = [
  [g >= 2.3 && g <= 3.5, `gols por partida ${g.toFixed(2)} (alvo 2,3–3,5)`],
  [conv >= 0.09 && conv <= 0.14, `conversão ${(conv * 100).toFixed(1)}% (alvo 9–14%)`],
  [pa >= 0.75 && pa <= 0.88, `acerto de passe ${(pa * 100).toFixed(1)}% (alvo 75–88%)`],
  [imp >= 1, `impedimentos por partida ${imp.toFixed(2)} (alvo ≥ 1)`],
];
for (const [ok, txt] of r) console.log(`${ok ? 'PASSOU' : 'FALHOU'} | ${txt}`);
process.exit(r.every(x => x[0]) ? 0 : 1);
