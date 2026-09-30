// Campeonato (pontos corridos, turno único) — lógica pura, sem DOM.
import { TEAMS, teamById } from './teams.js';
import { hashStr } from './rng.js';

export const SEASON_VERSION = 1;
export const LEAGUE_NAME = 'Liga das Serras';

/** Tabela de rodadas pelo método do círculo. Alterna mando para ninguém jogar sempre em casa. */
export function roundRobin(ids) {
  const list = [...ids];
  if (list.length % 2) list.push(null);
  const n = list.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const games = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a && b) games.push((i === 0 ? r % 2 === 0 : i % 2 === 0) ? [a, b] : [b, a]);
    }
    rounds.push(games);
    list.splice(1, 0, list.pop()); // gira mantendo o primeiro fixo
  }
  return rounds;
}

export function createSeason(userTeamId, seed = Date.now() % 1e9) {
  if (!teamById(userTeamId)) throw new Error('Time inválido');
  const ids = TEAMS.map((t) => t.id);
  // embaralha a ordem com a semente para cada temporada ter uma tabela diferente
  let h = hashStr(String(seed));
  const shuffled = ids.map((id) => ({ id, k: (h = Math.imul(h ^ hashStr(id), 2654435761) >>> 0) })).sort((a, b) => a.k - b.k).map((x) => x.id);
  return { v: SEASON_VERSION, seed, user: userTeamId, teams: ids, rounds: roundRobin(shuffled), round: 0, results: [], scorers: {}, done: false, created: Date.now() };
}

/** Semente determinística de cada jogo da temporada. */
export function matchSeed(season, roundIdx, gameIdx) {
  return (hashStr(`${season.seed}:${roundIdx}:${gameIdx}`) % 2147483647) || 1;
}

export function userGame(season) {
  const games = season.rounds[season.round];
  if (!games) return null;
  const gi = games.findIndex(([h, a]) => h === season.user || a === season.user);
  return gi < 0 ? null : { gi, home: games[gi][0], away: games[gi][1] };
}

/** Registra os resultados de uma rodada inteira (lista na ordem dos jogos). */
export function applyRound(season, results) {
  const games = season.rounds[season.round];
  if (!games || results.length !== games.length) throw new Error('Rodada incompleta');
  results.forEach((r, i) => {
    if (r.home !== games[i][0] || r.away !== games[i][1]) throw new Error('Resultado não corresponde ao jogo');
  });
  season.results.push(results.map((r) => ({ home: r.home, away: r.away, hs: r.hs, as: r.as, scorers: r.scorers || [] })));
  for (const r of results) {
    for (const s of r.scorers || []) {
      if (!s.playerId || s.og) continue;
      const k = s.playerId;
      season.scorers[k] = (season.scorers[k] || 0) + 1;
    }
  }
  season.round++;
  if (season.round >= season.rounds.length) season.done = true;
  return season;
}

export function table(season) {
  const rows = new Map(season.teams.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }]));
  for (const round of season.results) {
    for (const r of round) {
      const h = rows.get(r.home), a = rows.get(r.away);
      if (!h || !a) continue;
      h.p++; a.p++; h.gf += r.hs; h.ga += r.as; a.gf += r.as; a.ga += r.hs;
      if (r.hs > r.as) { h.w++; a.l++; h.pts += 3; h.form.push('V'); a.form.push('D'); }
      else if (r.hs < r.as) { a.w++; h.l++; a.pts += 3; a.form.push('V'); h.form.push('D'); }
      else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('E'); a.form.push('E'); }
    }
  }
  const list = [...rows.values()];
  for (const r of list) { r.gd = r.gf - r.ga; r.form = r.form.slice(-5); }
  // critérios: pontos, vitórias, saldo, gols pró, nome
  list.sort((x, y) => y.pts - x.pts || y.w - x.w || y.gd - x.gd || y.gf - x.gf || teamById(x.id).name.localeCompare(teamById(y.id).name, 'pt-BR'));
  return list;
}

export function topScorers(season, n = 10) {
  const byId = new Map();
  for (const t of TEAMS) for (const p of t.players) byId.set(p.id, { p, team: t });
  return Object.entries(season.scorers)
    .map(([id, g]) => ({ id, goals: g, ...byId.get(id) }))
    .filter((x) => x.p)
    .sort((a, b) => b.goals - a.goals || a.p.name.localeCompare(b.p.name, 'pt-BR'))
    .slice(0, n);
}

/** Valida um objeto de temporada vindo do armazenamento (pode estar corrompido ou ser de outra versão). */
export function validateSeason(s) {
  try {
    if (!s || typeof s !== 'object' || s.v !== SEASON_VERSION) return false;
    if (!teamById(s.user)) return false;
    if (!Array.isArray(s.teams) || s.teams.length !== TEAMS.length || s.teams.some((id) => !teamById(id))) return false;
    if (!Array.isArray(s.rounds) || s.rounds.length !== TEAMS.length - 1) return false;
    if (!Number.isInteger(s.round) || s.round < 0 || s.round > s.rounds.length) return false;
    if (!Array.isArray(s.results) || s.results.length !== s.round) return false;
    for (let i = 0; i < s.results.length; i++) {
      const rs = s.results[i], gs = s.rounds[i];
      if (!Array.isArray(rs) || rs.length !== gs.length) return false;
      for (let j = 0; j < rs.length; j++) {
        const r = rs[j];
        if (r.home !== gs[j][0] || r.away !== gs[j][1]) return false;
        if (!Number.isInteger(r.hs) || !Number.isInteger(r.as) || r.hs < 0 || r.as < 0 || r.hs > 30 || r.as > 30) return false;
      }
    }
    if (typeof s.scorers !== 'object' || s.scorers === null) return false;
    return true;
  } catch { return false; }
}
