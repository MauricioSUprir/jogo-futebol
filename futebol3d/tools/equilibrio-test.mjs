// Equilíbrio das partidas IA x IA (auditoria, Fase 3): em N partidas (padrão 24) com as
// configurações padrão do jogo (tempos de 4 min, como na auditoria), médias por partida e alvos:
//   gols 2,3–3,5 · conversão (gols/chutes) 9–14% · acerto de passe 75–88% · impedimentos ≥ 1
// Também mostra chutes, passes, faltas e posse. Reprova (saída 1) fora dos alvos.
// O passe é contado pela própria ferramenta (igual em qualquer versão do jogo): tentativa = passe,
// enfiada, lançamento, cruzamento, passe de cabeça e reposição do goleiro; certo = o próximo a tocar na bola é
// companheiro. Lateral não é passe (como no Opta).
// node tools/equilibrio-test.mjs [partidas=24] [minutos por tempo=padrão] [--par 4] [--base pasta]
//   --par   divide as partidas entre processos (mesmo resultado, mais rápido)
//   --base  pasta do jogo a medir (ex.: outra versão, para o "antes")
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1].startsWith('--')));
const N = +(pos[0] || 24), half = pos[1] ? +pos[1] : null, PAR = +arg('par', 1);
const here = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(arg('base', path.join(here, '..')));
const worker = arg('worker', null);
const KINDS = new Set(['pass', 'gk_pass', 'through', 'long', 'cross', 'gk_throw', 'hpass']);

async function roda(ini, fim) {
  const { Match } = await import(path.join(base, 'js/match.js'));
  const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
  const { TEAMS } = await import(path.join(base, 'js/teams.js'));
  const HM = half ?? DEFAULT_SETTINGS.halfMinutes;
  const S = { tempo: HM, partidas: 0, gols: 0, chutes: 0, noAlvo: 0, passes: 0, passesCertos: 0, impedimentos: 0, faltas: 0, escanteios: 0 };
  for (let k = ini; k < fim; k++) {
    const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: HM, intro: false } });
    m.headless = true;
    let aberto = null;   // passe em andamento: { p }
    const ak = m.afterKick.bind(m);
    m.afterKick = (p, kind, tg, rec) => {
      // passe de primeira de um companheiro também completa o passe anterior
      if (aberto && p !== aberto.p && p.team === aberto.p.team) S.passesCertos++;
      aberto = KINDS.has(kind) ? { p } : null; if (aberto) S.passes++;
      return ak(p, kind, tg, rec);
    };
    const tc = m.touch.bind(m);
    m.touch = (p, how) => {
      if (aberto && p !== aberto.p && how !== 'kick') { if (p.team === aberto.p.team) S.passesCertos++; aberto = null; }
      return tc(p, how);
    };
    for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
      m.step(1 / 60, null);
      for (const e of m.events) if (e.type === 'replay') m.replayFinished();
      m.events.length = 0;
      if (aberto && m.phase !== 'play') aberto = null;   // bola saiu / falta: passe não completado
    }
    S.partidas++;
    for (const t of m.teams) {
      const st = t.stats;
      S.gols += t.score; S.chutes += st.shots; S.noAlvo += st.onTarget || 0;
      S.impedimentos += st.offsides || 0; S.faltas += st.fouls || 0; S.escanteios += st.corners || 0;
    }
  }
  return S;
}

if (worker) {
  const [i, P] = worker.split('/').map(Number);
  const ini = Math.floor(N * i / P), fim = Math.floor(N * (i + 1) / P);
  process.send(await roda(ini, fim));
  process.exit(0);
}

let S;
if (PAR > 1) {
  const parts = await Promise.all(Array.from({ length: PAR }, (_, i) => new Promise((res, rej) => {
    const c = fork(fileURLToPath(import.meta.url), [String(N), ...(half ? [String(half)] : []), '--base', base, '--worker', `${i}/${PAR}`]);
    c.on('message', res); c.on('error', rej);
    c.on('exit', (code) => { if (code) rej(new Error('processo ' + i + ' saiu com ' + code)); });
  })));
  S = parts.reduce((a, s) => { for (const k in s) a[k] = k === 'tempo' ? s[k] : (a[k] || 0) + s[k]; return a; }, {});
} else S = await roda(0, N);

const n = S.partidas;
const g = S.gols / n, conv = S.gols / Math.max(1, S.chutes), pa = S.passesCertos / Math.max(1, S.passes), imp = S.impedimentos / n;
console.log(`partidas ${n} (tempos de ${S.tempo} min) | chutes/partida ${(S.chutes / n).toFixed(1)} (no alvo ${(S.noAlvo / n).toFixed(1)}) | passes/partida ${(S.passes / n).toFixed(0)} | faltas ${(S.faltas / n).toFixed(1)} | escanteios ${(S.escanteios / n).toFixed(1)}`);
const r = [
  [g >= 2.3 && g <= 3.5, `gols por partida ${g.toFixed(2)} (alvo 2,3–3,5)`],
  [conv >= 0.09 && conv <= 0.14, `conversão ${(conv * 100).toFixed(1)}% (alvo 9–14%)`],
  [pa >= 0.75 && pa <= 0.88, `acerto de passe ${(pa * 100).toFixed(1)}% (alvo 75–88%)`],
  [imp >= 1, `impedimentos por partida ${imp.toFixed(2)} (alvo ≥ 1)`],
];
for (const [ok, txt] of r) console.log(`${ok ? 'PASSOU' : 'FALHOU'} | ${txt}`);
process.exit(r.every(x => x[0]) ? 0 : 1);
