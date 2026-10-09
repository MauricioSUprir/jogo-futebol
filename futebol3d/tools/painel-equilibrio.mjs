// Painel de equilíbrio (um só passe por partida): números do teste oficial + origem/faixa dos chutes e gols +
// defesas do goleiro por faixa + tipos de passe + posses (último terço, recuo). Para comparar versões.
// node tools/painel-equilibrio.mjs [partidas=48] [--par 4] [--base pasta]   (amostra de 48 varia ±0,25 gol: decidir com 144+)
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1].startsWith('--')));
const N = +(pos[0] || 48), PAR = +arg('par', 4);
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const worker = arg('worker', null);
const KINDS = new Set(['pass', 'gk_pass', 'through', 'long', 'cross', 'gk_throw', 'hpass']);
const SHOTS = new Set(['shot', 'finesse', 'chip', 'volley', 'header']);
const PASSES = new Set(['pass', 'through', 'long', 'cross', 'hpass', 'gk_pass', 'gk_throw']);
const faixa = (d) => d < 12 ? 'a<12' : d < 16.5 ? 'b12-16' : d < 25 ? 'c16-25' : 'd25+';
async function roda(ini, fim) {
  const { Match } = await import(path.join(base, 'js/match.js'));
  const { DEFAULT_SETTINGS } = await import(path.join(base, 'js/config.js'));
  const { TEAMS } = await import(path.join(base, 'js/teams.js'));
  const S = { partidas: 0, gols: 0, chutes: 0, noAlvo: 0, passes: 0, passesCertos: 0, impedimentos: 0, faltas: 0, escanteios: 0,
    tipos: {}, chF: {}, golF: {}, defF: {}, golTm: 0, chTm: 0, posses: 0, terco: 0, recuo: 0, frente: 0, pLinha: 0, golContraMao: 0 };
  const inc = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
  for (let k = ini; k < fim; k++) {
    const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
    m.headless = true;
    let aberto = null, ant = null, ult = null, tmT = -99, maoT = -9, maoTime = null, posse = null;
    const ak = m.afterKick.bind(m);
    m.afterKick = (p, kind, tg, rec) => {
      if (aberto && p !== aberto.p && p.team === aberto.p.team) S.passesCertos++;
      aberto = KINDS.has(kind) ? { p } : null; if (aberto) S.passes++;
      inc(S.tipos, kind);
      if (SHOTS.has(kind)) {
        const d = Math.hypot(m.goalX(p.team) - p.x, p.z), f = faixa(d);
        const erroTm = ant && ant.team !== p.team && m.time - ant.t < 3 && kind !== 'header' && m.time - tmT < 8;
        inc(S.chF, f); if (erroTm) S.chTm++;
        ult = { f, erroTm };
      }
      if (PASSES.has(kind) && rec && rec.team === p.team && !p.isGK) {
        S.pLinha++;
        const dl = m.lx(p.team, rec.x) - m.lx(p.team, p.x);
        if (rec.isGK || dl < -5) S.recuo++; else if (dl > 5) S.frente++;
      }
      if (kind === 'gk_throw') { maoT = m.time; maoTime = p.team; }
      ant = { kind, team: p.team, t: m.time };
      return ak(p, kind, tg, rec);
    };
    const tc = m.touch.bind(m);
    m.touch = (p, how) => {
      if (aberto && p !== aberto.p && how !== 'kick') { if (p.team === aberto.p.team) S.passesCertos++; aberto = null; }
      return tc(p, how);
    };
    const emit = m.emit.bind(m);
    m.emit = (type, d = {}) => {
      if (type === 'save' && ult) { inc(S.defF, ult.f); ult = null; }
      if (type === 'goal') {
        if (ult) { inc(S.golF, ult.f); if (ult.erroTm) S.golTm++; }
        if (m.time - maoT < 1.5 && maoTime && d.side === maoTime.opp.i && d.own) S.golContraMao++;
        ult = null;
      }
      return emit(type, d);
    };
    for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
      m.step(1 / 60, null);
      for (const e of m.events) if (e.type === 'replay') m.replayFinished();
      m.events.length = 0;
      if (m.phase !== 'play') { if (aberto) aberto = null; ult = ult && m.phase === 'stopped' ? ult : null; posse = null; }
      if (m.phase === 'setpiece' && m.sp && m.sp.type === 'goalkick') tmT = m.time;
      const o = m.owner;
      if (m.phase === 'play' && o) {
        if (!posse || posse.t !== o.team) { posse = { t: o.team, terco: false }; S.posses++; }
        if (!posse.terco && m.lx(o.team, o.x) > 17.5) { posse.terco = true; S.terco++; }
      }
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
  process.send(await roda(Math.floor(N * i / P), Math.floor(N * (i + 1) / P)));
  process.exit(0);
}
const parts = await Promise.all(Array.from({ length: PAR }, (_, i) => new Promise((res, rej) => {
  const c = fork(fileURLToPath(import.meta.url), [String(N), '--base', base, '--worker', `${i}/${PAR}`]);
  c.on('message', res); c.on('error', rej);
})));
const S = parts.reduce((a, s) => {
  for (const k in s) {
    if (typeof s[k] === 'object') { a[k] = a[k] || {}; for (const j in s[k]) a[k][j] = (a[k][j] || 0) + s[k][j]; }
    else a[k] = (a[k] || 0) + s[k];
  }
  return a;
}, {});
const n = S.partidas, f1 = (x) => (x / n).toFixed(1), f2 = (x) => (x / n).toFixed(2), pc = (a, b) => (a / Math.max(1, b) * 100).toFixed(0) + '%';
const F = ['a<12', 'b12-16', 'c16-25', 'd25+'];
const gf = (f) => S.golF[f] || 0, df = (f) => S.defF[f] || 0;
const golFora = gf('c16-25') + gf('d25+'), defFora = df('c16-25') + df('d25+');
console.log(`${path.basename(path.dirname(base)) + '/' + path.basename(base)} — ${n} partidas`);
console.log(`chutes ${f1(S.chutes)} (no alvo ${f1(S.noAlvo)}) | gols ${f2(S.gols)} | conversão ${pc(S.gols, S.chutes)} | passe ${(S.passesCertos / S.passes * 100).toFixed(1)}% | impedimentos ${f2(S.impedimentos)} | escanteios ${f1(S.escanteios)} | faltas ${f1(S.faltas)}`);
console.log(`por faixa (chutes/gols): ` + F.map(f => `${f.slice(1)} ${f1(S.chF[f] || 0)}/${f2(gf(f))}`).join(' · ') + ` | gols de fora da área ${pc(golFora, S.gols)} | defesas de fora ${pc(defFora, defFora + golFora)} | defesas 6–16 ${pc(df('b12-16') + df('a<12') * 0, df('b12-16') + gf('b12-16'))} | defesas no total ${pc(Object.values(S.defF).reduce((a, b) => a + b, 0), Object.values(S.defF).reduce((a, b) => a + b, 0) + S.gols)}`);
console.log(`após tiro de meta (erro do rival): chutes ${f2(S.chTm)} gols ${f2(S.golTm)} | sem eles: chutes ${f1(S.chutes - S.chTm)} gols ${f2(S.gols - S.golTm)} | gol contra na reposição com a mão ${S.golContraMao}`);
console.log(`posses ${f1(S.posses)} | chegam ao último terço ${pc(S.terco, S.posses)} | passes de linha: para frente ${pc(S.frente, S.pLinha)} recuo ${pc(S.recuo, S.pLinha)} | tipos: ` + ['pass', 'through', 'long', 'cross', 'hpass', 'hclear', 'clear', 'volley', 'header'].map(k => `${k} ${f1(S.tipos[k] || 0)}`).join(' · '));
