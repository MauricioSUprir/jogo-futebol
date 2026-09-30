// Teste do tournament.js em Node: node futebol3d/tools/tournament-test.mjs
// Simula Liga e Copa completas (jogo do usuário com placar aleatório), confere a tabela,
// o campeão, a persistência em localStorage (stub) e a recuperação de dados corrompidos.
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k),
};

const T = await import('../js/tournament.js');
const { TEAMS, kitClash, resolveKits, FORMATIONS } = { ...(await import('../js/teams.js')), ...(await import('../js/config.js')) };

function rngFrom(seed) { let a = seed; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- times ----------
assert.equal(TEAMS.length, 8);
for (const t of TEAMS) {
  assert.equal(t.players.length, 18, t.id);
  assert.equal(t.players[0].pos, 'GOL');
  assert.equal(t.players.filter(p => p.pos === 'GOL').length, 2);
  assert.ok(FORMATIONS[t.formation]);
  assert.equal(new Set(t.players.map(p => p.num)).size, 18, 'números únicos ' + t.id);
  assert.equal(new Set(t.players.map(p => p.name)).size, 18, 'nomes únicos ' + t.id);
  for (const p of t.players) { assert.ok(p.look.height >= 1.68 && p.look.height <= 1.96); for (const v of Object.values(p.attrs)) assert.ok(v >= 0 && v <= 99); }
}
for (const a of TEAMS) for (const b of TEAMS) if (a !== b) assert.ok(!resolveKits(a, b).clash, `uniformes ${a.id} x ${b.id}`);
assert.ok(kitClash(TEAMS[0].kits.home, TEAMS[0].kits.home));

// ---------- liga ----------
for (let seed = 1; seed <= 30; seed++) {
  const rng = rngFrom(seed);
  mem.clear();
  const user = TEAMS[seed % 8].id;
  let st = T.createLeague(user, { rng });
  assert.equal(st.rounds.length, 7);
  // cada par se enfrenta exatamente uma vez
  const pairs = new Set();
  for (const r of st.rounds) { assert.equal(r.fixtures.length, 4); const seen = new Set(); for (const f of r.fixtures) { assert.ok(!seen.has(f.home) && !seen.has(f.away)); seen.add(f.home); seen.add(f.away); pairs.add([f.home, f.away].sort().join()); } }
  assert.equal(pairs.size, 28);
  let guard = 0;
  while (!T.isFinished(st) && guard++ < 20) {
    const uf = T.nextUserFixture(st);
    assert.ok(uf, 'usuário sempre joga na liga');
    T.recordResult(st, uf.id, T.simulateMatch(TEAMS.find(t => t.id === uf.home), TEAMS.find(t => t.id === uf.away), { rng }));
    T.simulateRound(st, { rng });
    st = T.loadTournament();          // ida e volta pelo localStorage a cada rodada
    assert.ok(st);
  }
  assert.ok(st.champion);
  const tab = T.standings(st);
  assert.equal(tab[0].id, st.champion);
  let pts = 0, gp = 0, gc = 0, draws = 0, games = 0;
  for (const row of tab) {
    assert.equal(row.J, 7); assert.equal(row.V + row.E + row.D, 7); assert.equal(row.P, row.V * 3 + row.E); assert.equal(row.SG, row.GP - row.GC);
    pts += row.P; gp += row.GP; gc += row.GC;
  }
  for (const r of st.rounds) for (const f of r.fixtures) { games++; if (f.hg === f.ag) draws++; assert.equal(f.scorers.length, f.hg + f.ag); }
  assert.equal(games, 28); assert.equal(gp, gc); assert.equal(pts, 28 * 3 - draws);
  const goals = T.topScorers(st, 999).reduce((s, x) => s + x.goals, 0);
  assert.equal(goals, gp);
  for (let i = 1; i < tab.length; i++) assert.ok(tab[i - 1].P >= tab[i].P);
}
console.log('liga ok');

// ---------- copa ----------
const champs = {};
for (let seed = 1; seed <= 200; seed++) {
  const rng = rngFrom(seed * 7);
  mem.clear();
  let st = T.createCup(TEAMS[seed % 8].id, { rng });
  assert.equal(new Set(st.rounds[0].fixtures.flatMap(f => [f.home, f.away])).size, 8);
  let guard = 0;
  while (!T.isFinished(st) && guard++ < 10) {
    const uf = T.nextUserFixture(st);
    if (uf) {
      // resultado "do motor": pode empatar, mas com pênaltis
      const hg = Math.floor(rng() * 4), ag = Math.floor(rng() * 4);
      T.recordResult(st, uf.id, { homeGoals: hg, awayGoals: ag, pens: hg === ag ? { home: 4, away: rng() < 0.5 ? 3 : 5 } : undefined,
        scorers: [...Array(hg)].map((_, i) => ({ side: 'home', name: 'Teste', minute: 10 + i })).concat([...Array(ag)].map((_, i) => ({ side: 'away', name: 'Teste', minute: 20 + i }))), stats: {} });
    } else assert.ok(T.userEliminated(st), 'sem jogo do usuário só se eliminado');
    T.simulateRound(st, { rng, includeUser: T.userEliminated(st) });
    st = T.loadTournament();
  }
  assert.ok(st.champion, 'copa tem campeão');
  assert.equal(st.rounds[1].fixtures.length, 2); assert.equal(st.rounds[2].fixtures.length, 1);
  for (const r of st.rounds) for (const f of r.fixtures) { assert.ok(f.played); assert.ok(T.fixtureWinner(f), 'mata-mata tem vencedor'); }
  assert.equal(T.fixtureWinner(st.rounds[2].fixtures[0]), st.champion);
  if (T.userEliminated(st)) assert.notEqual(st.champion, st.user);
  champs[st.champion] = (champs[st.champion] || 0) + 1;
}
console.log('copa ok — campeões em 200 copas:', champs);

// ---------- dados corrompidos ----------
mem.set(T.STORAGE_KEY, '{isto não é json');
assert.equal(T.loadTournament(), null); assert.ok(!mem.has(T.STORAGE_KEY));
mem.set(T.STORAGE_KEY, JSON.stringify({ v: 1, type: 'liga', user: 'nao-existe', rounds: [], current: 0 }));
assert.equal(T.loadTournament(), null);
const st = T.createCup(TEAMS[0].id); st.rounds[0].fixtures[0].home = 'xyz'; T.saveTournament(st);
assert.equal(T.loadTournament(), null);
delete globalThis.localStorage;
assert.equal(T.loadTournament(), null);          // sem armazenamento: não quebra
T.createLeague(TEAMS[1].id);
console.log('persistência ok');

// ---------- plausibilidade do simulador ----------
const rng = rngFrom(99); let tot = 0, strong = 0, N = 4000;
for (let i = 0; i < N; i++) { const r = T.simulateMatch(TEAMS[0], TEAMS[7], { rng }); tot += r.homeGoals + r.awayGoals; strong += r.homeGoals > r.awayGoals; }
console.log(`média de gols ${(tot / N).toFixed(2)}, favorito (86 x 70, em casa) vence ${(strong / N * 100).toFixed(0)}%`);
console.log('TODOS OS TESTES PASSARAM');
