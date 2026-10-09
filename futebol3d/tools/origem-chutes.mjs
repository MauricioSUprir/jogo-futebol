// De onde saem os chutes e os gols (IA x IA, configurações padrão): por faixa de distância do gol e pela origem —
//   jogada                         — o normal
//   erro do rival                  — o chute sai até 3 s depois de um passe/lançamento/corte do adversário
//   erro do rival após tiro de meta — idem, até 8 s depois de um tiro de meta (a saída de bola roubada na área)
// Mostra também os totais sem os lances "após tiro de meta": a comparação justa com a versão publicada, em que o
// adversário ficava dentro da área na cobrança (Regra 16) e ~0,9 gol por partida saía de roubar a saída de bola.
// node tools/origem-chutes.mjs [partidas=24] [--ini k] [--base pasta] [--json]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && ['--base', '--ini'].includes(A[i - 1])));
const N = +(pos[0] || 24), INI = +arg('ini', 0);
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
const SHOTS = new Set(['shot', 'finesse', 'chip', 'volley', 'header']);
const R = { chutes: {}, gols: {} };
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
for (let k = INI; k < INI + N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  let ant = null, golAnt = 0, ult = null, tmT = -99;
  const ak = m.afterKick.bind(m);
  m.afterKick = (p, kind, tg, rec) => {
    if (SHOTS.has(kind)) {
      const d = Math.hypot(m.goalX(p.team) - p.x, p.z);
      const faixa = d < 12 ? '< 12 m' : d < 18 ? '12–18 m' : d < 25 ? '18–25 m' : '25+ m';
      const erro = ant && ant.team !== p.team && m.time - ant.t < 3 && kind !== 'header';
      const key = faixa + (erro ? (m.time - tmT < 8 ? ' | erro do rival após tiro de meta' : ' | erro do rival') : ' | jogada');
      inc(R.chutes, key); ult = key;
    }
    ant = { kind, team: p.team, t: m.time };
    return ak(p, kind, tg, rec);
  };
  for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) if (e.type === 'replay') m.replayFinished();
    m.events.length = 0;
    if (m.phase === 'setpiece' && m.sp && m.sp.type === 'goalkick') tmT = m.time;
    const g = m.teams[0].score + m.teams[1].score;
    if (g > golAnt) { golAnt = g; if (ult) inc(R.gols, ult); ult = null; }
  }
}
if (process.argv.includes('--json')) { console.log(JSON.stringify({ N, ...R })); process.exit(0); }
const soma = (o, f = () => true) => Object.entries(o).filter(([k]) => f(k)).reduce((s, [, v]) => s + v, 0) / N;
const tm = (k) => k.includes('tiro de meta');
console.log(`${N} partidas | chutes ${soma(R.chutes).toFixed(1)} | gols ${soma(R.gols).toFixed(2)} por partida`);
console.log(`após tiro de meta (saída de bola roubada): chutes ${soma(R.chutes, tm).toFixed(2)}, gols ${soma(R.gols, tm).toFixed(2)} | sem eles: chutes ${soma(R.chutes, k => !tm(k)).toFixed(1)}, gols ${soma(R.gols, k => !tm(k)).toFixed(2)}`);
for (const k of Object.keys(R.chutes).sort((a, c) => R.chutes[c] - R.chutes[a])) console.log(`  ${k.padEnd(42)} ${(R.chutes[k] / N).toFixed(2)} chutes · ${((R.gols[k] || 0) / N).toFixed(2)} gols`);
