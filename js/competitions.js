/* ================= TOTAL MATCH — competições e calendário ================= */
/* Modela a temporada da Carreira de Treinador com múltiplos campeonatos:
   Liga (pontos corridos) + Copa nacional (mata-mata) + Continental (mata-mata,
   só times classificados). Um calendário intercala as partidas. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  var CUP_NAME = {
    br: "Copa do Brasil", en: "Copa da Inglaterra", es: "Copa da Espanha", it: "Copa da Itália",
    de: "Copa da Alemanha", fr: "Copa da França", pt: "Copa de Portugal", nl: "Copa da Holanda",
    ar: "Copa da Argentina", us: "Copa dos EUA"
  };
  var REGION = { br: "sa", ar: "sa", en: "eu", es: "eu", it: "eu", de: "eu", fr: "eu", pt: "eu", nl: "eu", us: "na" };
  var CONT_NAME = { sa: "Libertadores", eu: "Champions League", na: "Copa dos Campeões (Am. do Norte)" };
  var REGION_LEAGUES = { sa: ["br", "ar"], eu: ["en", "es", "it", "de", "fr", "pt", "nl"], na: ["us"] };

  function realism() { return TM.storage.settings().realism; }

  /* ---------- tabela de liga ---------- */
  function roundRobin(ids) {
    var n = ids.length, arr = ids.slice(), rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var round = [];
      for (var i = 0; i < n / 2; i++) round.push(r % 2 === 0 ? [arr[i], arr[n - 1 - i]] : [arr[n - 1 - i], arr[i]]);
      rounds.push(round); arr.splice(1, 0, arr.pop());
    }
    return rounds;
  }
  function emptyTable(ids) { var t = {}; ids.forEach(function (id) { t[id] = { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }); return t; }
  function applyResult(t, h, a, hs, as) {
    var H = t[h], A = t[a]; H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; A.l++; H.pts += 3; } else if (hs < as) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  function standings(t) { return Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf; }); }

  /* ---------- elencos com transferências da carreira ---------- */
  function idsToPlayers(ids) { return ids.map(TM.data.player).filter(Boolean).sort(function (a, b) { return b.overall - a.overall; }); }
  function userSquad(career) { return idsToPlayers(career.roster); }
  function oppPlayers(career, clubId) {
    return TM.data.clubPlayers(clubId).filter(function (p) { return !(career.signedFrom[p.id] === clubId); });
  }
  function userTeam(career) { var c = TM.data.club(career.teamId); return { id: c.id, name: c.name, players: userSquad(career), club: c }; }
  function oppTeam(career, clubId) { var c = TM.data.club(clubId); return { id: c.id, name: c.name, players: oppPlayers(career, clubId), club: c }; }
  function anyTeam(career, clubId) { return clubId === career.teamId ? userTeam(career) : oppTeam(career, clubId); }

  function simMatch(career, homeId, awayId, neutral) {
    return TM.engine.simulate(anyTeam(career, homeId), anyTeam(career, awayId), { realism: realism(), neutral: neutral });
  }

  /* ---------- mata-mata ---------- */
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buildKO(teamIds, name, key) {
    return { type: "ko", key: key, name: name, teamIds: shuffle(teamIds), rounds: [], roundIndex: 0, aliveUser: true, championId: null };
  }
  function ensureKORound(ko) {
    if (ko.rounds[ko.roundIndex]) return;
    var teams;
    if (ko.roundIndex === 0) teams = ko.teamIds;
    else teams = ko.rounds[ko.roundIndex - 1].map(function (t) { return t[4]; }); // vencedores
    var ties = [];
    for (var i = 0; i < teams.length; i += 2) ties.push([teams[i], teams[i + 1], null, null, null]);
    ko.rounds[ko.roundIndex] = ties;
  }
  function penaltyWinner(a, b) {
    var ra = TM.data.clubRating(a), rb = TM.data.clubRating(b);
    return Math.random() < ra / (ra + rb) ? a : b;
  }
  function resolveTie(career, tie, neutral) {
    var res = simMatch(career, tie[0], tie[1], neutral);
    var hs = res.score[0], as = res.score[1];
    var winner = hs > as ? tie[0] : as > hs ? tie[1] : penaltyWinner(tie[0], tie[1]);
    tie[2] = hs; tie[3] = as; tie[4] = winner;
    return res;
  }
  function userTieIn(ko, teamId) {
    var round = ko.rounds[ko.roundIndex];
    if (!round) return null;
    for (var i = 0; i < round.length; i++) if (round[i][0] === teamId || round[i][1] === teamId) return round[i];
    return null;
  }
  function resolveKORoundAuto(career, ko) {
    ensureKORound(ko);
    var round = ko.rounds[ko.roundIndex];
    round.forEach(function (tie) { if (tie[4] == null) resolveTie(career, tie, true); });
    if (round.length === 1) ko.championId = round[0][4];
    ko.roundIndex++;
  }

  /* ---------- criação de carreira ---------- */
  function topClubs(leagueId, n) {
    return TM.data.league(leagueId).clubIds.slice()
      .sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); }).slice(0, n);
  }
  function pow2Floor(n) { var p = 1; while (p * 2 <= n) p *= 2; return p; }

  function buildDomesticCup(teamId, leagueId) {
    var pool = topClubs(leagueId, 16);
    if (pool.indexOf(teamId) < 0) { pool[pool.length - 1] = teamId; } // garante o usuário
    return buildKO(pool, CUP_NAME[leagueId] || "Copa Nacional", "cup");
  }
  function buildContinental(teamId, leagueId) {
    var region = REGION[leagueId] || "eu";
    var leagues = REGION_LEAGUES[region] || [leagueId];
    var pool = [];
    leagues.forEach(function (lg) { pool = pool.concat(topClubs(lg, 4)); });
    pool = pool.filter(function (id, i) { return pool.indexOf(id) === i; });
    pool.sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
    var size = Math.min(16, pow2Floor(pool.length));
    pool = pool.slice(0, size);
    if (pool.indexOf(teamId) < 0 && pool.length) pool[pool.length - 1] = teamId; // usuário sempre entra (temp. 1)
    if (pool.length < 2) return null;
    return buildKO(pool, CONT_NAME[region] || "Continental", "cont");
  }

  function buildOrder(hasCont) {
    // 17 rodadas de liga, com copa e continental intercaladas
    var order = [], cupAt = [2, 6, 10, 14], contAt = [4, 8, 12, 16], cupN = 0, contN = 0;
    for (var lr = 1; lr <= 17; lr++) {
      order.push("league");
      if (cupAt.indexOf(lr) >= 0 && cupN < 4) { order.push("cup"); cupN++; }
      if (hasCont && contAt.indexOf(lr) >= 0 && contN < 4) { order.push("cont"); contN++; }
    }
    while (cupN < 4) { order.push("cup"); cupN++; }
    while (hasCont && contN < 4) { order.push("cont"); contN++; }
    return order;
  }

  function seasonSetup(career) {
    var leagueId = career.leagueId;
    var league = TM.data.league(leagueId);
    var cont = buildContinental(career.teamId, leagueId);
    career.comps = {
      league: { type: "league", name: league.name, fixtures: roundRobin(league.clubIds.slice()), round: 0, table: emptyTable(league.clubIds) },
      cup: buildDomesticCup(career.teamId, leagueId),
      cont: cont
    };
    career.order = buildOrder(!!cont);
    career.orderIndex = 0;
    career.pending = null;
  }

  var CURRENCIES = {
    eur: { key: "eur", code: "EUR", sym: "€",   mult: 1 },
    brl: { key: "brl", code: "BRL", sym: "R$",  mult: 5.5 },
    usd: { key: "usd", code: "USD", sym: "US$", mult: 1.1 },
    jpy: { key: "jpy", code: "JPY", sym: "¥",   mult: 165 }
  };

  function newClubCareer(clubId, opts) {
    opts = opts || {};
    var money = CURRENCIES[opts.currency] || CURRENCIES.eur;
    var club = TM.data.club(clubId);
    var baseEur = 30 + Math.round(TM.data.clubRating(clubId) / 3);
    var career = {
      type: "club", teamId: clubId, teamName: club.name, leagueId: club.leagueId, season: 1,
      money: money,
      budget: Math.round(baseEur * money.mult) + (opts.injection || 0),
      roster: TM.data.clubPlayers(clubId).map(function (p) { return p.id; }),
      signedFrom: {}, honours: []
    };
    seasonSetup(career);
    return career;
  }

  function newSeason(career) {
    career.season++;
    seasonSetup(career);
  }

  /* ---------- scheduler ---------- */
  function findUserFixture(league, teamId) {
    var round = league.fixtures[league.round];
    for (var i = 0; i < round.length; i++) if (round[i][0] === teamId || round[i][1] === teamId) return round[i];
    return round[0];
  }

  // resolve slots automáticos e para na próxima partida do usuário. Idempotente.
  function advanceToUserMatch(career) {
    var guard = 0;
    while (guard++ < 200) {
      if (career.orderIndex >= career.order.length) { career.pending = { seasonEnd: true }; TM.storage.saveCoachCareer(career); return career.pending; }
      var key = career.order[career.orderIndex];
      if (key === "league") {
        var lg = career.comps.league;
        var fix = findUserFixture(lg, career.teamId);
        career.pending = { key: "league", name: lg.name, homeId: fix[0], awayId: fix[1] };
        TM.storage.saveCoachCareer(career);
        return career.pending;
      }
      var ko = career.comps[key];
      if (!ko) { career.orderIndex++; continue; }
      if (ko.championId) { career.orderIndex++; continue; }
      ensureKORound(ko);
      var tie = userTieIn(ko, career.teamId);
      if (ko.aliveUser && tie) {
        career.pending = { key: key, name: ko.name, homeId: tie[0], awayId: tie[1], ko: true };
        TM.storage.saveCoachCareer(career);
        return career.pending;
      }
      // usuário não está nesta fase: resolve automaticamente e segue
      resolveKORoundAuto(career, ko);
      career.orderIndex++;
    }
    career.pending = { seasonEnd: true };
    return career.pending;
  }

  // aplica o resultado da partida do usuário (placar do ponto de vista real das equipes)
  function applyUserResult(career, homeScore, awayScore) {
    var p = career.pending;
    if (!p || p.seasonEnd) return;
    if (p.key === "league") {
      var lg = career.comps.league;
      applyResult(lg.table, p.homeId, p.awayId, homeScore, awayScore);
      lg.fixtures[lg.round].forEach(function (fix) {
        if (fix[0] === p.homeId || fix[1] === p.homeId) return; // já é a do usuário
        var res = simMatch(career, fix[0], fix[1], false);
        applyResult(lg.table, fix[0], fix[1], res.score[0], res.score[1]);
      });
      lg.round++;
    } else {
      var ko = career.comps[p.key];
      var round = ko.rounds[ko.roundIndex];
      var tie = userTieIn(ko, career.teamId);
      var winner = homeScore > awayScore ? tie[0] : awayScore > homeScore ? tie[1] : penaltyWinner(tie[0], tie[1]);
      tie[2] = homeScore; tie[3] = awayScore; tie[4] = winner;
      if (winner !== career.teamId) ko.aliveUser = false;
      round.forEach(function (t) { if (t[4] == null) resolveTie(career, t, true); });
      if (round.length === 1) ko.championId = round[0][4];
      ko.roundIndex++;
    }
    career.orderIndex++;
    career.pending = null;
    // registra títulos ao fim da temporada
    checkHonours(career);
    TM.storage.saveCoachCareer(career);
  }

  function checkHonours(career) {
    if (career.orderIndex < career.order.length) return;
    var c = career.comps;
    var st = standings(c.league.table);
    var already = career.honours.some(function (h) { return h.season === career.season; });
    if (already) return;
    var champ = st[0];
    career.honours.push({
      season: career.season,
      leaguePos: st.findIndex(function (r) { return r.id === career.teamId; }) + 1,
      leagueChampion: champ.id === career.teamId,
      cupChampion: c.cup && c.cup.championId === career.teamId,
      contChampion: c.cont && c.cont.championId === career.teamId
    });
  }

  TM.comp = {
    newClubCareer: newClubCareer, newSeason: newSeason,
    advanceToUserMatch: advanceToUserMatch, applyUserResult: applyUserResult,
    standings: standings, userTeam: userTeam, oppTeam: oppTeam, anyTeam: anyTeam,
    userSquad: userSquad, simMatch: simMatch, CURRENCIES: CURRENCIES,
    CUP_NAME: CUP_NAME, CONT_NAME: CONT_NAME, REGION: REGION
  };
})(window);
