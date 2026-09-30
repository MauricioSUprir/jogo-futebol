// Competições do GOLAÇO: Copa (mata-mata de 8) e Liga (turno único, 7 rodadas).
//
// O estado é um objeto JSON simples, salvo em localStorage ('golaco.torneio'):
//   { v, type:'copa'|'liga', user:<id do time>, teams:[ids], rounds:[Round], current, champion, createdAt }
//   Round   = { name, fixtures:[Fixture] }
//   Fixture = { id, home, away, played, hg, ag, pens?:{home,away}, scorers:[{side,name,minute}], sim? }
//
// API:
//   createCup(userTeamId, { rng? })     sorteio aleatório -> quartas; semi e final são montadas ao avançar
//   createLeague(userTeamId, { rng? })  tabela de turno único (método do círculo), mando alternado
//   loadTournament() / saveTournament(st) / clearTournament()   (dados corrompidos -> null e chave removida)
//   currentRound(st)                    rodada atual (ou null se acabou)
//   nextUserFixture(st)                 partida do usuário ainda não jogada na rodada atual (ou null)
//   recordResult(st, fixtureId, result) grava um Result do motor (ou do simulador); ignora se já jogada
//   simulateRound(st, { includeUser?, rng? })  simula os jogos restantes da rodada (o do usuário só se
//                                       includeUser ou se ele já foi eliminado) e avança se completa
//   advance(st)                         avança a rodada se todos os jogos terminaram (monta a próxima fase)
//   simulateMatch(home, away, { knockout?, rng? }) -> Result   (Poisson por nota + mando de campo)
//   standings(st)                       linhas { id, P, J, V, E, D, GP, GC, SG } ordenadas
//   topScorers(st, n)                   [{ name, team, goals }]
//   fixtureWinner(fx)                   id do vencedor (pênaltis contam) ou null em empate
//   userEliminated(st), isFinished(st), roundLabel(st, i)
import { TEAMS, teamById } from './teams.js';

export const STORAGE_KEY = 'golaco.torneio';
const VERSION = 1;

const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fx = (id, home, away) => ({ id, home, away, played: false, hg: 0, ag: 0, scorers: [] });

// ---------- criação ----------
export function createCup(userTeamId, { rng = Math.random } = {}) {
  const ids = shuffle(TEAMS.map(t => t.id), rng);
  const fixtures = [];
  for (let i = 0; i < 8; i += 2) fixtures.push(fx(`c0-${i / 2}`, ids[i], ids[i + 1]));
  const st = { v: VERSION, type: 'copa', user: userTeamId, teams: TEAMS.map(t => t.id), current: 0, champion: null, createdAt: Date.now(),
    rounds: [{ name: 'Quartas de final', fixtures }, { name: 'Semifinal', fixtures: [] }, { name: 'Final', fixtures: [] }] };
  saveTournament(st);
  return st;
}

export function createLeague(userTeamId, { rng = Math.random } = {}) {
  const ids = shuffle(TEAMS.map(t => t.id), rng);
  const n = ids.length, rounds = [];
  const rot = ids.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const order = [ids[0], ...rot];
    const fixtures = [];
    for (let i = 0; i < n / 2; i++) {
      let h = order[i], a = order[n - 1 - i];
      if ((i === 0 && r % 2) || (i > 0 && (r + i) % 2)) [h, a] = [a, h];   // alterna mando
      fixtures.push(fx(`l${r}-${i}`, h, a));
    }
    rounds.push({ name: `Rodada ${r + 1}`, fixtures });
    rot.unshift(rot.pop());
  }
  const st = { v: VERSION, type: 'liga', user: userTeamId, teams: TEAMS.map(t => t.id), current: 0, champion: null, createdAt: Date.now(), rounds };
  saveTournament(st);
  return st;
}

// ---------- persistência ----------
export function saveTournament(st) {
  const s = store(); if (!s) return false;
  try { s.setItem(STORAGE_KEY, JSON.stringify(st)); return true; } catch { return false; }
}
export function clearTournament() { try { store()?.removeItem(STORAGE_KEY); } catch { /* sem armazenamento */ } }

function valid(st) {
  if (!st || typeof st !== 'object' || st.v !== VERSION || !['copa', 'liga'].includes(st.type)) return false;
  if (!teamById(st.user) || !Array.isArray(st.rounds) || !Number.isInteger(st.current)) return false;
  if (st.current < 0 || st.current > st.rounds.length) return false;
  const need = st.type === 'copa' ? 3 : TEAMS.length - 1;
  if (st.rounds.length !== need) return false;
  for (const r of st.rounds) {
    if (!r || typeof r.name !== 'string' || !Array.isArray(r.fixtures)) return false;
    for (const f of r.fixtures) {
      if (!f || typeof f.id !== 'string' || !teamById(f.home) || !teamById(f.away) || typeof f.played !== 'boolean') return false;
      if (f.played && !(Number.isInteger(f.hg) && Number.isInteger(f.ag))) return false;
      if (!Array.isArray(f.scorers)) return false;
    }
  }
  if (st.champion !== null && !teamById(st.champion)) return false;
  return true;
}

export function loadTournament() {
  const s = store(); if (!s) return null;
  let raw;
  try { raw = s.getItem(STORAGE_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const st = JSON.parse(raw);
    if (valid(st)) return st;
  } catch { /* JSON inválido */ }
  clearTournament();
  return null;
}

// ---------- consultas ----------
export const currentRound = (st) => st.rounds[st.current] || null;
export const isFinished = (st) => !!st.champion;
export const roundLabel = (st, i = st.current) => st.rounds[i]?.name || '';

export function fixtureWinner(f) {
  if (!f.played) return null;
  if (f.hg !== f.ag) return f.hg > f.ag ? f.home : f.away;
  if (f.pens && f.pens.home !== f.pens.away) return f.pens.home > f.pens.away ? f.home : f.away;
  return null;
}

export function userEliminated(st) {
  if (st.type !== 'copa') return false;
  for (const r of st.rounds) {
    if (!r.fixtures.length) break;
    const f = r.fixtures.find(x => x.home === st.user || x.away === st.user);
    if (!f || (f.played && fixtureWinner(f) !== st.user)) return true;
  }
  return false;
}

export function nextUserFixture(st) {
  if (st.champion) return null;
  const r = currentRound(st);
  return r?.fixtures.find(f => !f.played && (f.home === st.user || f.away === st.user)) || null;
}

// ---------- simulação (Poisson) ----------
function poisson(lambda, rng) {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
const SCORE_W = { CA: 6, ATA: 6, PD: 3.6, PE: 3.6, MEI: 2.8, MD: 2, ME: 2, MC: 1.5, ALD: 1.1, ALE: 1.1, VOL: 0.8, ZAG: 0.6, LD: 0.5, LE: 0.5, GOL: 0 };
function pickScorer(team, rng) {
  const pool = team.players.map((p, i) => ({ p, w: (SCORE_W[p.pos] ?? 1) * (i < 11 ? 1 : 0.18) * (0.6 + p.attrs.sho / 120) }));
  let x = rng() * pool.reduce((s, e) => s + e.w, 0);
  for (const e of pool) { x -= e.w; if (x <= 0) return e.p.name; }
  return pool[0].p.name;
}

export function simulateMatch(home, away, { knockout = false, rng = Math.random } = {}) {
  const diff = (home.rating - away.rating) * 0.045;
  const lh = 1.3 * Math.exp(diff) * 1.12, la = 1.3 * Math.exp(-diff) / 1.12;
  let hg = poisson(lh, rng), ag = poisson(la, rng);
  const minutes = [];
  for (let i = 0; i < hg; i++) minutes.push({ side: 'home', minute: 1 + Math.floor(rng() * 90) });
  for (let i = 0; i < ag; i++) minutes.push({ side: 'away', minute: 1 + Math.floor(rng() * 90) });
  let pens;
  if (knockout && hg === ag) {               // prorrogação: um terço do ritmo
    const eh = poisson(lh / 3, rng), ea = poisson(la / 3, rng);
    for (let i = 0; i < eh; i++) minutes.push({ side: 'home', minute: 91 + Math.floor(rng() * 30) });
    for (let i = 0; i < ea; i++) minutes.push({ side: 'away', minute: 91 + Math.floor(rng() * 30) });
    hg += eh; ag += ea;
    if (hg === ag) {
      let ph = 0, pa = 0;
      for (let i = 0; i < 5; i++) { ph += rng() < 0.76; pa += rng() < 0.76; }
      while (ph === pa) { ph += rng() < 0.72; pa += rng() < 0.72; }
      pens = { home: ph, away: pa };
    }
  }
  minutes.sort((a, b) => a.minute - b.minute);
  const scorers = minutes.map(m => ({ side: m.side, minute: m.minute, name: pickScorer(m.side === 'home' ? home : away, rng) }));
  const poss = Math.round(50 + (home.rating - away.rating) * 0.8 + (rng() - 0.5) * 12);
  const shots = [hg * 2 + 4 + Math.floor(rng() * 7), ag * 2 + 3 + Math.floor(rng() * 7)];
  const r2 = () => Math.floor(rng() * 3);
  return { homeGoals: hg, awayGoals: ag, ...(pens ? { pens } : {}), scorers,
    stats: { possession: [poss, 100 - poss], shots, onTarget: [Math.min(shots[0], hg + 1 + r2()), Math.min(shots[1], ag + 1 + r2())],
      fouls: [8 + Math.floor(rng() * 8), 8 + Math.floor(rng() * 8)], corners: [2 + Math.floor(rng() * 7), 1 + Math.floor(rng() * 6)],
      offsides: [r2(), r2()], yellow: [r2(), r2()], red: [rng() < 0.06 ? 1 : 0, rng() < 0.06 ? 1 : 0] } };
}

// ---------- gravação / avanço ----------
export function recordResult(st, fixtureId, result, { sim = false } = {}) {
  const f = st.rounds.flatMap(r => r.fixtures).find(x => x.id === fixtureId);
  if (!f || f.played) return st;
  f.hg = Math.max(0, result.homeGoals | 0); f.ag = Math.max(0, result.awayGoals | 0);
  if (result.pens && f.hg === f.ag) f.pens = { home: result.pens.home | 0, away: result.pens.away | 0 };
  // mata-mata precisa de vencedor: se o motor não mandou pênaltis, decide na moeda (não deve acontecer)
  if (st.type === 'copa' && f.hg === f.ag && (!f.pens || f.pens.home === f.pens.away)) f.pens = Math.random() < 0.5 ? { home: 5, away: 4 } : { home: 4, away: 5 };
  f.scorers = (result.scorers || []).filter(s => s && (s.side === 'home' || s.side === 'away'))
    .map(s => ({ side: s.side, name: String(s.name || '?'), minute: s.minute | 0 }));
  f.played = true;
  if (sim) f.sim = true;
  advance(st);
  saveTournament(st);
  return st;
}

export function advance(st) {
  const r = currentRound(st);
  if (!r || st.champion || !r.fixtures.length || r.fixtures.some(f => !f.played)) return false;
  if (st.type === 'copa') {
    const winners = r.fixtures.map(fixtureWinner);
    if (st.current === st.rounds.length - 1) st.champion = winners[0];
    else {
      const next = st.rounds[st.current + 1];
      next.fixtures = [];
      for (let i = 0; i < winners.length; i += 2) next.fixtures.push(fx(`c${st.current + 1}-${i / 2}`, winners[i], winners[i + 1]));
    }
  } else if (st.current === st.rounds.length - 1) st.champion = standings(st)[0].id;
  st.current++;
  return true;
}

export function simulateRound(st, { includeUser = false, rng = Math.random } = {}) {
  const r = currentRound(st);
  if (!r || st.champion) return [];
  const out = [];
  for (const f of r.fixtures) {
    if (f.played) continue;
    const isUser = f.home === st.user || f.away === st.user;
    if (isUser && !includeUser) continue;
    const res = simulateMatch(teamById(f.home), teamById(f.away), { knockout: st.type === 'copa', rng });
    recordResult(st, f.id, res, { sim: true });
    out.push(f);
  }
  advance(st);
  saveTournament(st);
  return out;
}

// ---------- tabela e artilharia ----------
export function standings(st) {
  const rows = new Map(st.teams.map(id => [id, { id, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0 }]));
  const h2h = new Map();   // confronto direto: "a|b" -> pontos de a contra b
  for (const r of st.rounds) for (const f of r.fixtures) {
    if (!f.played) continue;
    const h = rows.get(f.home), a = rows.get(f.away);
    h.J++; a.J++; h.GP += f.hg; h.GC += f.ag; a.GP += f.ag; a.GC += f.hg;
    const ph = f.hg > f.ag ? 3 : f.hg === f.ag ? 1 : 0, pa = f.ag > f.hg ? 3 : f.hg === f.ag ? 1 : 0;
    h.P += ph; a.P += pa;
    if (ph === 3) { h.V++; a.D++; } else if (pa === 3) { a.V++; h.D++; } else { h.E++; a.E++; }
    h2h.set(`${f.home}|${f.away}`, (h2h.get(`${f.home}|${f.away}`) || 0) + ph);
    h2h.set(`${f.away}|${f.home}`, (h2h.get(`${f.away}|${f.home}`) || 0) + pa);
  }
  const list = [...rows.values()];
  for (const x of list) x.SG = x.GP - x.GC;
  // critérios: pontos, vitórias, saldo, gols pró, confronto direto, nota do time, nome
  return list.sort((a, b) => b.P - a.P || b.V - a.V || b.SG - a.SG || b.GP - a.GP
    || (h2h.get(`${b.id}|${a.id}`) || 0) - (h2h.get(`${a.id}|${b.id}`) || 0)
    || teamById(b.id).rating - teamById(a.id).rating || a.id.localeCompare(b.id));
}

export function topScorers(st, n = 10) {
  const m = new Map();
  for (const r of st.rounds) for (const f of r.fixtures) for (const s of f.scorers || []) {
    const team = s.side === 'home' ? f.home : f.away;
    const k = `${team}|${s.name}`;
    const e = m.get(k) || { name: s.name, team, goals: 0 };
    e.goals++; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, n);
}
