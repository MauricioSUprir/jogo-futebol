// Testes do motor, dos times e do campeonato (Node, sem navegador).
// Uso: node tools/engine-test.mjs
import { Match, baseXG, threat, passSpeed } from '../js/engine.js';
import { TEAMS, pickLineup, matchKits, colorDistance, crestSVG, teamStars } from '../js/teams.js';
import { FORMATIONS, FORMATION_KEYS, PITCH, SIM } from '../js/config.js';
import { roundRobin, createSeason, applyRound, table, validateSeason, userGame, matchSeed, topScorers } from '../js/league.js';
import { createRng } from '../js/rng.js';
import { FrameMonitor, autoLevel } from '../js/quality.js';

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.error('FALHOU:', msg); } };
const section = (s) => console.log('—', s);

// ---------- RNG ----------
section('RNG');
{
  const a = createRng(42), b = createRng(42);
  const xs = Array.from({ length: 50 }, () => a.next()), ys = Array.from({ length: 50 }, () => b.next());
  ok(xs.every((x, i) => x === ys[i]), 'mesma semente → mesma sequência');
  ok(xs.every((x) => x >= 0 && x < 1), 'valores em [0,1)');
  const r = createRng('abc'); let lo = 0, hi = 0;
  for (let i = 0; i < 1000; i++) { const v = r.int(1, 3); if (v === 1) lo++; if (v === 3) hi++; ok(v >= 1 && v <= 3, 'int no intervalo'); }
  ok(lo > 250 && hi > 250, 'int razoavelmente uniforme');
}

// ---------- times ----------
section('Times');
{
  ok(TEAMS.length === 12, '12 clubes');
  ok(new Set(TEAMS.map((t) => t.id)).size === 12, 'ids únicos');
  for (const t of TEAMS) {
    ok(t.players.length === 20, `${t.name}: 20 jogadores`);
    ok(new Set(t.players.map((p) => p.name)).size === 20, `${t.name}: nomes únicos no elenco`);
    ok(new Set(t.players.map((p) => p.number)).size === 20, `${t.name}: números únicos`);
    ok(t.players.filter((p) => p.pos === 'GOL').length >= 2, `${t.name}: 2 goleiros`);
    for (const f of FORMATION_KEYS) {
      const xi = pickLineup(t, f);
      ok(xi.length === 11 && xi.every(Boolean), `${t.name} ${f}: 11 titulares`);
      ok(new Set(xi.map((p) => p.id)).size === 11, `${t.name} ${f}: sem repetição`);
      ok(xi[0].pos === 'GOL', `${t.name} ${f}: goleiro na vaga 1`);
      ok(xi[0].number === 1, `${t.name} ${f}: goleiro titular veste a 1`);
    }
    ok(crestSVG(t).startsWith('<svg') && crestSVG(t).includes(t.primary), `${t.name}: escudo SVG`);
    const s = teamStars(t); ok(s >= 0.5 && s <= 5, `${t.name}: estrelas`);
  }
  for (const h of TEAMS) for (const a of TEAMS) {
    if (h === a) continue;
    const [hk, ak] = matchKits(h, a);
    ok(colorDistance(hk.fill, ak.fill) >= 150, `uniformes distinguíveis ${h.short} x ${a.short}`);
    ok(colorDistance(hk.fill, '#217c3e') >= 150 && colorDistance(ak.fill, '#217c3e') >= 150, `uniformes visíveis na grama ${h.short} x ${a.short}`);
  }
}

// ---------- modelos ----------
section('Modelos');
{
  ok(baseXG(52.5 - 6, 0) > baseXG(52.5 - 11, 0), 'xG maior mais perto');
  ok(baseXG(52.5 - 11, 0) > baseXG(52.5 - 11, 15), 'xG maior no centro');
  ok(baseXG(52.5 - 30, 0) < 0.08, 'chute de 30 m tem xG baixo');
  ok(threat(40, 0) > threat(0, 0), 'ameaça cresce perto do gol');
  ok(passSpeed(5) >= 9 && passSpeed(60) <= 23, 'velocidade de passe limitada');
}

// ---------- partida: invariantes passo a passo ----------
section('Partida (invariantes)');
{
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], seed: 123 });
  let bad = null, lastEv = 0, steps = 0;
  while (!m.finished && steps < 60000) {
    if (m.phase === 'halftime') {
      ok(m.period === 1, 'intervalo no fim do 1º tempo');
      m.resumeSecondHalf();
      lastEv = 45; // o 2º tempo recomeça no 45'
      continue;
    }
    m.step(); steps++;
    const b = m.ball;
    if (![b.x, b.y, b.z, b.vx, b.vy, b.vz].every(Number.isFinite)) { bad = 'bola NaN no passo ' + steps; break; }
    if (Math.abs(b.x) > PITCH.halfL + 4 || Math.abs(b.y) > PITCH.halfW + 4 || b.z < 0 || b.z > 40) { bad = `bola fora dos limites (${b.x.toFixed(1)}, ${b.y.toFixed(1)}, ${b.z.toFixed(1)}) passo ${steps}`; break; }
    for (const t of m.teams) {
      if (t.onPitch.length + t.out.filter((p) => p.off).length !== 11) { bad = 'contagem de jogadores inválida'; break; }
      if (t.onPitch.filter((p) => p.isGK).length > 1) { bad = 'dois goleiros'; break; }
      for (const p of t.onPitch) {
        if (![p.x, p.y, p.vx, p.vy, p.energy].every(Number.isFinite)) { bad = 'jogador NaN'; break; }
        if (Math.abs(p.x) > PITCH.halfL + 2.01 || Math.abs(p.y) > PITCH.halfW + 1.51) { bad = 'jogador fora do campo'; break; }
        if (Math.hypot(p.vx, p.vy) > 11) { bad = `jogador rápido demais: ${Math.hypot(p.vx, p.vy).toFixed(1)} m/s`; break; }
        if (p.energy < 0.3 || p.energy > 1) { bad = 'energia fora de [0,3; 1]'; break; }
      }
    }
    if (b.owner && !b.owner.team.onPitch.includes(b.owner)) { bad = 'dono da bola fora de campo'; break; }
    if (m.events.length && m.events[m.events.length - 1].type !== 'halftime' && m.events[m.events.length - 1].minute + 1e-9 < lastEv) { bad = 'eventos fora de ordem'; break; }
    if (m.events.length && m.events[m.events.length - 1].type !== 'halftime') lastEv = m.events[m.events.length - 1].minute;
    if (bad) break;
  }
  ok(!bad, bad || 'invariantes ok');
  ok(m.finished, 'partida termina');
  ok(m.period === 2, 'dois tempos');
  const goals = m.events.filter((e) => e.type === 'goal');
  ok(goals.filter((e) => e.side === 0).length === m.teams[0].score, 'placar = eventos de gol (mandante)');
  ok(goals.filter((e) => e.side === 1).length === m.teams[1].score, 'placar = eventos de gol (visitante)');
  const [p0, p1] = m.possession();
  ok(p0 + p1 === 100 && p0 > 20 && p1 > 20, `posse soma 100 e é plausível (${p0}/${p1})`);
  for (const t of m.teams) {
    ok(t.stats.onTarget <= t.stats.shots, 'no alvo ≤ chutes');
    ok(t.stats.goals <= t.stats.onTarget, 'gols ≤ no alvo');
    ok(t.stats.passOk <= t.stats.passes, 'passes certos ≤ passes');
    ok(t.stats.crossOk <= t.stats.crosses, 'cruzamentos certos ≤ cruzamentos');
    ok(t.subsLeft >= 0 && t.subsLeft <= SIM.maxSubs, 'substituições no limite');
    const goalsBy = [...t.onPitch, ...t.out].reduce((s, p) => s + p.st.goals, 0);
    ok(goalsBy === t.score, 'gols dos jogadores = placar');
    for (const p of [...t.onPitch, ...t.out]) {
      const r = m.rating(p);
      ok(r === null || (r >= 3 && r <= 10), 'nota em [3,10]');
    }
  }
  ok(m.added[0] >= 1 && m.added[1] >= 1 && m.added[1] <= SIM.maxAddedMin, 'acréscimos plausíveis');
  ok(/^\d+\+\d+'$|^\d+'$/.test(m.clockLabel), 'rótulo do relógio');
  ok(m.manOfTheMatch() !== null, 'melhor em campo');
  ok(m.events[m.events.length - 1].type === 'fulltime', 'último evento é o apito final');
}

// ---------- determinismo ----------
section('Determinismo');
{
  const run = (seed) => { const m = new Match({ home: TEAMS[2], away: TEAMS[7], seed }); m.runToEnd(); return JSON.stringify([m.result(), m.teams.map((t) => t.stats)]); };
  ok(run(99) === run(99), 'mesma semente → mesma partida');
  ok(run(99) !== run(100), 'sementes diferentes → partidas diferentes');
  // ordens do usuário também são reproduzíveis
  const withOrders = () => {
    const m = new Match({ home: TEAMS[3], away: TEAMS[4], seed: 5, userSide: 0 });
    let did = false;
    while (!m.finished) {
      if (m.phase === 'halftime') { m.resumeSecondHalf(); continue; }
      m.step();
      if (!did && m.minuteFloat > 30) { did = true; m.setTactics(0, { mentality: 2, formation: '4-3-3' }); }
    }
    return JSON.stringify(m.result());
  };
  ok(withOrders() === withOrders(), 'mesmas ordens → mesmo resultado');
}

// ---------- API de táticas e substituições ----------
section('Táticas e substituições');
{
  const m = new Match({ home: TEAMS[0], away: TEAMS[5], seed: 8, userSide: 0 });
  for (let i = 0; i < 200; i++) m.step();
  const t = m.teams[0];
  ok(m.setTactics(0, { mentality: 9, pressing: -3, tempo: 7 }), 'setTactics aceita');
  ok(t.tactics.mentality === 2 && t.tactics.pressing === 0 && t.tactics.tempo === 2, 'valores fora da faixa são limitados');
  m.setTactics(0, { formation: 'inexistente' });
  ok(t.tactics.formation === '4-3-3' || FORMATIONS[t.tactics.formation], 'formação inválida ignorada');
  for (const f of FORMATION_KEYS) {
    m.setTactics(0, { formation: f });
    const slots = t.onPitch.filter((p) => !p.isGK).map((p) => `${p.au},${p.av}`);
    ok(new Set(slots).size === 10, `${f}: 10 vagas distintas`);
  }
  const outP = t.onPitch.find((p) => !p.isGK);
  const benchField = t.bench.find((b) => b.d.pos !== 'GOL');
  const benchGK = t.bench.find((b) => b.d.pos === 'GOL');
  ok(!m.substitute(0, outP.d.id, benchGK.d.id).ok, 'goleiro reserva não entra na linha');
  ok(!m.substitute(0, 'nao-existe', benchField.d.id).ok, 'jogador inexistente');
  const r = m.substitute(0, outP.d.id, benchField.d.id);
  ok(r.ok, 'substituição válida');
  ok(!t.onPitch.includes(outP) && t.onPitch.some((p) => p.d.id === benchField.d.id), 'troca aplicada');
  ok(!m.substitute(0, t.onPitch[3].d.id, benchField.d.id).ok, 'reserva já usado não entra de novo');
  ok(!m.substitute(0, outP.d.id, t.bench.find((b) => !b.used && b.d.pos !== 'GOL').d.id).ok, 'quem saiu não sai de novo');
  let n = 1;
  for (const b of t.bench) if (!b.used && b.d.pos !== 'GOL' && n < 5) { if (m.substitute(0, t.onPitch.find((p) => !p.isGK && p.entered === 0).d.id, b.d.id).ok) n++; }
  ok(t.subsLeft === 0, '5 substituições usadas');
  const extra = t.bench.find((b) => !b.used);
  ok(!m.substitute(0, t.onPitch[1].d.id, extra.d.id).ok, 'sexta substituição bloqueada');
  ok(m.events.filter((e) => e.type === 'sub' && e.side === 0).length === 5, '5 eventos de substituição');
}

// ---------- estatística em lote (faixas amplas: pega regressões grosseiras) ----------
section('Estatística (80 partidas)');
{
  const acc = { g: 0, sh: 0, sot: 0, f: 0, y: 0, off: 0, d: 0, n: 0, favW: 0, favN: 0, ms: 0 };
  for (let i = 0; i < 80; i++) {
    const h = TEAMS[i % 12], a = TEAMS[(i * 7 + 1) % 12];
    if (h === a) continue;
    const t0 = performance.now();
    const m = new Match({ home: h, away: a, seed: 7000 + i });
    m.runToEnd();
    acc.ms += performance.now() - t0;
    const [s0, s1] = m.teams.map((t) => t.stats);
    acc.n++; acc.g += m.teams[0].score + m.teams[1].score; acc.sh += s0.shots + s1.shots; acc.sot += s0.onTarget + s1.onTarget;
    acc.f += s0.fouls + s1.fouls; acc.y += s0.yellow + s1.yellow; acc.off += s0.offsides + s1.offsides;
    if (m.teams[0].score === m.teams[1].score) acc.d++;
    if (Math.abs(h.overall - a.overall) >= 4) { acc.favN++; const f = h.overall > a.overall ? 0 : 1; if (m.teams[f].score > m.teams[1 - f].score) acc.favW++; }
  }
  const avg = (k) => acc[k] / acc.n;
  console.log(`   gols ${avg('g').toFixed(2)}  chutes ${avg('sh').toFixed(1)}  no alvo ${avg('sot').toFixed(1)}  faltas ${avg('f').toFixed(1)}  amarelos ${avg('y').toFixed(1)}  impedimentos ${avg('off').toFixed(1)}  empates ${((acc.d / acc.n) * 100).toFixed(0)}%  favorito vence ${((acc.favW / acc.favN) * 100).toFixed(0)}%  ${(acc.ms / acc.n).toFixed(0)} ms/jogo`);
  ok(avg('g') > 1.8 && avg('g') < 3.8, 'gols por jogo realistas');
  ok(avg('sh') > 14 && avg('sh') < 32, 'chutes por jogo realistas');
  ok(avg('sot') < avg('sh') * 0.65, 'proporção no alvo realista');
  ok(avg('f') > 8 && avg('f') < 32, 'faltas por jogo');
  ok(avg('y') > 1 && avg('y') < 6, 'amarelos por jogo');
  ok(avg('off') > 0.5 && avg('off') < 8, 'impedimentos por jogo');
  ok(acc.d / acc.n > 0.12 && acc.d / acc.n < 0.45, 'taxa de empates');
  ok(acc.favW / acc.favN > 0.35, 'time mais forte vence mais');
  ok(acc.ms / acc.n < 1500, 'simulação instantânea rápida');
}

// ---------- campeonato ----------
section('Campeonato');
{
  const rr = roundRobin(TEAMS.map((t) => t.id));
  ok(rr.length === 11 && rr.every((r) => r.length === 6), '11 rodadas de 6 jogos');
  const pairs = new Set();
  for (const r of rr) {
    const seen = new Set();
    for (const [h, a] of r) { ok(!seen.has(h) && !seen.has(a), 'ninguém joga duas vezes na rodada'); seen.add(h); seen.add(a); pairs.add([h, a].sort().join('-')); }
  }
  ok(pairs.size === 66, 'todos se enfrentam uma vez');
  const homeCount = {};
  for (const r of rr) for (const [h] of r) homeCount[h] = (homeCount[h] || 0) + 1;
  ok(Object.values(homeCount).every((c) => c >= 4 && c <= 7), 'mando equilibrado');

  const s = createSeason('pampa', 77);
  ok(validateSeason(s), 'temporada nova é válida');
  ok(userGame(s) !== null, 'usuário tem jogo na rodada');
  // joga 2 rodadas instantâneas
  for (let r = 0; r < 2; r++) {
    const res = s.rounds[s.round].map(([h, a], gi) => { const m = new Match({ home: TEAMS.find((t) => t.id === h), away: TEAMS.find((t) => t.id === a), seed: matchSeed(s, s.round, gi) }); m.runToEnd(); return m.result(); });
    applyRound(s, res);
  }
  ok(s.round === 2 && validateSeason(s), 'temporada válida após 2 rodadas');
  const tb = table(s);
  ok(tb.length === 12 && tb.every((r) => r.p === 2), 'todos com 2 jogos');
  ok(tb.reduce((a, r) => a + r.gf, 0) === tb.reduce((a, r) => a + r.ga, 0), 'gols pró = gols contra no total');
  for (let i = 1; i < tb.length; i++) ok(tb[i - 1].pts >= tb[i].pts, 'tabela ordenada por pontos');
  ok(topScorers(s).every((x, i, arr) => i === 0 || arr[i - 1].goals >= x.goals), 'artilharia ordenada');
  const clone = JSON.parse(JSON.stringify(s));
  ok(validateSeason(clone), 'sobrevive a JSON');
  ok(!validateSeason({ ...clone, v: 99 }), 'versão errada rejeitada');
  ok(!validateSeason({ ...clone, round: 5 }), 'rodada inconsistente rejeitada');
  ok(!validateSeason(null) && !validateSeason('lixo'), 'lixo rejeitado');
  const broken = JSON.parse(JSON.stringify(s)); broken.results[0][0].hs = -1;
  ok(!validateSeason(broken), 'placar negativo rejeitado');
  let threw = false; try { applyRound(s, []); } catch { threw = true; }
  ok(threw, 'rodada incompleta rejeitada');
}

// ---------- qualidade adaptativa ----------
section('Qualidade AUTO');
{
  ok(autoLevel({ cores: 4, mem: 2, touch: true, small: true, mobile: true }) === 'baixo', 'celular fraco → baixo');
  ok(autoLevel({ cores: 8, mem: 8, touch: true, small: true, mobile: true }) === 'alto', 'celular forte → alto');
  ok(autoLevel({ cores: 8, mem: 16, mobile: false }) === 'ultra', 'desktop forte → ultra');
  ok(autoLevel({ cores: 8, mem: 8, mobile: false, saveData: true }) === 'baixo', 'economia de dados → baixo');
  // quadros lentos por mais de 3 s: desce um nível
  const mon = new FrameMonitor();
  let t = 0, next = null;
  for (let i = 0; i < 400 && !next; i++) { t += 40; mon.frame(t); if (i % 25 === 0) next = mon.adapt(t, 'alto', 60); }
  ok(next === 'medio', `quadros de 40 ms: alto → médio (${next})`);
  // quadros rápidos: não desce
  const mon2 = new FrameMonitor(); let t2 = 0, n2 = null;
  for (let i = 0; i < 400; i++) { t2 += 16.7; mon2.frame(t2); if (i % 25 === 0) n2 = n2 || mon2.adapt(t2, 'alto', 60); }
  ok(n2 === null, 'quadros de 16,7 ms: mantém');
  ok(Math.abs(mon2.fps - 60) < 1.5, `fps medido ~60 (${mon2.fps.toFixed(1)})`);
}

console.log(`\n${passes} verificações ok, ${fails} falha(s)`);
process.exit(fails ? 1 : 0);
