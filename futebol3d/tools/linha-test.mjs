// Linha de defesa (auditoria, Fase 3 item 3: "defesa sobe em bloco"): em partidas IA x IA, a cada
// 0,25 s com a bola em jogo e o adversário atacando, mede a linha de 4 de quem defende:
//   - alinhamento: distância entre o zagueiro mais adiantado e o mais recuado (alvo mediana ≤ 6 m);
//   - acompanha a bola: inclinação da altura da linha (2º zagueiro mais fundo, metros até o próprio
//     gol) pela distância da bola ao gol (alvo 0,35–0,8: anda junto, sem colar no gol nem na bola);
//   - sobe em bloco: quando a bola volta ≥ 10 m em até 1,5 s (recuo ou chutão), está a 25 m ou mais
//     do gol e a linha está ≥ 3 m abaixo da altura que ela mesma usa para aquela posição da bola (a
//     reta medida acima), ela sobe
//     ≥ 3 m em até 1,5 s com os quatro juntos (≤ 8 m entre o mais adiantado e o mais recuado)
//     (alvo ≥ 60% das vezes).
// Reprova (saída 1) fora dos alvos. node tools/linha-test.mjs [partidas=16] [--base pasta]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const here = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(arg('base', path.join(here, '..')));
const N = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 16);
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS, PITCH } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
const HL = PITCH.length / 2;
const amostras = [];          // { k, t, df, bola, linha, abertura }
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  let trecho = 0;             // trecho contínuo de bola rolando
  for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) if (e.type === 'replay') m.replayFinished();
    m.events.length = 0;
    if (m.phase !== 'play') { trecho++; continue; }
    if (i % 15) continue;
    const at = m.owner ? m.owner.team : m.lastTouch ? m.lastTouch.team : null;
    if (!at) continue;
    const df = at.opp, zs = df.players.filter(p => p.role === 'DEF' && !p.sentOff);
    if (zs.length < 3) continue;
    const xs = zs.map(p => HL + df.dir * p.x).sort((a, b) => a - b);   // metros até o próprio gol
    amostras.push({ k, trecho, t: m.time, df: df.i, bola: HL + df.dir * m.ball.p.x, linha: xs[1], abertura: xs[xs.length - 1] - xs[0] });
  }
}
const ab = amostras.map(a => a.abertura).sort((a, b) => a - b), med = ab[ab.length >> 1] ?? 99;
// reta da altura da linha pela posição da bola (bola a até 70 m do gol de quem defende)
const P = amostras.filter(a => a.bola < 70);
const mb = P.reduce((s, a) => s + a.bola, 0) / P.length, ml = P.reduce((s, a) => s + a.linha, 0) / P.length;
const incl = P.reduce((s, a) => s + (a.bola - mb) * (a.linha - ml), 0) / P.reduce((s, a) => s + (a.bola - mb) ** 2, 0);
const esperada = (b) => ml + incl * (Math.min(b, 70) - mb);
// subidas: a bola voltou ≥ 10 m em até 1,5 s, com o mesmo time defendendo no mesmo trecho de jogo
let subidas = 0, emBloco = 0, ultimo = { k: -1, t: 0 };
for (let i = 0; i < amostras.length; i++) {
  const a = amostras[i];
  if (a.k === ultimo.k && a.t - ultimo.t < 1.5) continue;
  let j = i - 1, voltou = false;
  while (j >= 0 && amostras[j].k === a.k && amostras[j].trecho === a.trecho && amostras[j].df === a.df && a.t - amostras[j].t <= 1.5) { if (a.bola - amostras[j].bola >= 10) { voltou = true; break; } j--; }
  // (com a bola a menos de 25 m do gol a linha está presa perto da área: não há o que subir)
  if (!voltou || a.bola < 25 || esperada(a.bola) - a.linha < 3) continue;
  ultimo = { k: a.k, t: a.t }; subidas++;
  for (let n = i + 1; n < amostras.length; n++) {
    const b = amostras[n];
    if (b.k !== a.k || b.trecho !== a.trecho || b.t - a.t > 1.5) break;
    if (b.df !== a.df) continue;          // a posse trocou por um instante: segue olhando a mesma linha
    if (b.linha - a.linha >= 3 && b.abertura <= 8) { emBloco++; break; }
  }
}
const fr = subidas ? emBloco / subidas : 0;
const r = [
  [med <= 6, `linha alinhada: distância entre o zagueiro mais adiantado e o mais recuado, mediana ${med.toFixed(1)} m (alvo ≤ 6 m)`],
  [incl >= 0.35 && incl <= 0.8, `acompanha a bola: a linha anda ${incl.toFixed(2)} m por metro de bola (alvo 0,35–0,8); altura média ${ml.toFixed(1)} m do gol com a bola a ${mb.toFixed(1)} m`],
  [subidas >= 20 && fr >= 0.6, `sobe em bloco: com a linha ≥ 3 m abaixo do lugar depois de a bola voltar ≥ 10 m, subiu ≥ 3 m junta em até 1,5 s em ${(fr * 100).toFixed(0)}% de ${subidas} vezes (alvo ≥ 60%)`],
];
for (const [ok, txt] of r) console.log(`${ok ? 'PASSOU' : 'FALHOU'} | ${txt}`);
process.exit(r.every(x => x[0]) ? 0 : 1);
