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

  /* ---------- formações (campinho) ---------- */
  var FORMATIONS = {
    "4-4-2":   [["GK",50,88],["DF",16,68],["DF",39,72],["DF",61,72],["DF",84,68],["MF",16,44],["MF",39,48],["MF",61,48],["MF",84,44],["FW",38,20],["FW",62,20]],
    "4-3-3":   [["GK",50,88],["DF",16,68],["DF",39,72],["DF",61,72],["DF",84,68],["MF",30,48],["MF",50,52],["MF",70,48],["FW",20,22],["FW",50,16],["FW",80,22]],
    "3-5-2":   [["GK",50,88],["DF",30,70],["DF",50,73],["DF",70,70],["MF",12,46],["MF",34,50],["MF",50,42],["MF",66,50],["MF",88,46],["FW",38,18],["FW",62,18]],
    "4-2-3-1": [["GK",50,88],["DF",16,68],["DF",39,72],["DF",61,72],["DF",84,68],["MF",38,56],["MF",62,56],["MF",24,36],["MF",50,32],["MF",76,36],["FW",50,16]],
    "5-3-2":   [["GK",50,88],["DF",10,64],["DF",30,72],["DF",50,74],["DF",70,72],["DF",90,64],["MF",30,46],["MF",50,50],["MF",70,46],["FW",38,18],["FW",62,18]]
  };

  /* ---------- resolução de jogadores (mundo + base) ---------- */
  function youthMapOf(career) { var m = {}; (career.youth || []).forEach(function (y) { m[y.id] = y; }); return m; }
  function resolvePlayer(career, id) {
    if (!id) return null;
    if (id[0] === "y") {
      if (career.customPlayers && career.customPlayers[id]) return career.customPlayers[id];
      return youthMapOf(career)[id] || null;
    }
    return TM.data.player(id);
  }
  function rosterPlayers(career) { return career.roster.map(function (id) { return resolvePlayer(career, id); }).filter(Boolean); }

  /* ---------- elencos com transferências, lesões e escalação ---------- */
  function available(career, id) { return !(career.injuries && career.injuries[id] > 0) && !(career.suspensions && career.suspensions[id] > 0); }
  function userSquad(career) { return rosterPlayers(career).sort(function (a, b) { return b.overall - a.overall; }); }
  function oppPlayers(career, clubId) {
    return TM.data.clubPlayers(clubId).filter(function (p) { return !(career.signedFrom[p.id] === clubId); });
  }

  function buildLineup(playerObjs, formation) {
    var slots = FORMATIONS[formation] || FORMATIONS["4-4-2"];
    var used = {}, starters = [];
    slots.forEach(function (slot) {
      var role = slot[0];
      var cand = playerObjs.filter(function (p) { return !used[p.id] && p.pos === role; });
      if (!cand.length) cand = playerObjs.filter(function (p) { return !used[p.id]; });
      cand.sort(function (a, b) { return b.overall - a.overall; });
      var pk = cand[0]; if (pk) { used[pk.id] = true; starters.push(pk.id); }
    });
    var bench = playerObjs.filter(function (p) { return !used[p.id]; }).sort(function (a, b) { return b.overall - a.overall; }).map(function (p) { return p.id; });
    return { formation: formation, starters: starters, bench: bench };
  }

  // escalação efetiva: substitui lesionados/suspensos por reservas disponíveis
  function effectiveXI(career) {
    var lu = career.lineup;
    if (!lu) return userSquad(career).slice(0, 11).map(function (p) { return p.id; });
    var benchAvail = lu.bench.filter(function (id) { return available(career, id); });
    return lu.starters.map(function (id) {
      if (available(career, id)) return id;
      var out = resolvePlayer(career, id);
      var repl = null;
      for (var i = 0; i < benchAvail.length; i++) { if (resolvePlayer(career, benchAvail[i]).pos === (out && out.pos)) { repl = benchAvail[i]; break; } }
      if (!repl && benchAvail.length) repl = benchAvail[0];
      if (repl) { benchAvail = benchAvail.filter(function (x) { return x !== repl; }); return repl; }
      return id;
    });
  }

  function userTeam(career) {
    var club = TM.data.club(career.teamId);
    var xiIds = effectiveXI(career);
    var xi = xiIds.map(function (id) { return resolvePlayer(career, id); }).filter(Boolean);
    var inXi = {}; xi.forEach(function (p) { inXi[p.id] = 1; });
    var rest = rosterPlayers(career).filter(function (p) { return !inXi[p.id]; }).sort(function (a, b) { return b.overall - a.overall; });
    return { id: club.id, name: club.name, players: xi.concat(rest), club: club };
  }
  function oppTeam(career, clubId) { var c = TM.data.club(clubId); return { id: c.id, name: c.name, players: oppPlayers(career, clubId), club: c }; }
  function anyTeam(career, clubId) { return clubId === career.teamId ? userTeam(career) : oppTeam(career, clubId); }

  function simMatch(career, homeId, awayId, neutral) {
    var opts = { realism: realism(), neutral: neutral };
    if (homeId === career.teamId) { opts.tacticSide = 0; opts.tactic = career.tactic; }
    else if (awayId === career.teamId) { opts.tacticSide = 1; opts.tactic = career.tactic; }
    return TM.engine.simulate(anyTeam(career, homeId), anyTeam(career, awayId), opts);
  }
  // contexto para o motor de torneio (continental)
  function contCtx(career) {
    return { sim: function (a, b) { return simMatch(career, a, b, true); }, rating: function (id) { return TM.data.clubRating(id); } };
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
  // ranking de uma liga: pela posição final da temporada passada (só a liga do
  // usuário é simulada); as demais ligas usam o overall como critério
  function rankLeague(career, lg) {
    if (lg === career.leagueId && career.lastStanding && career.lastStanding.length) return career.lastStanding.slice();
    return TM.data.league(lg).clubIds.slice().sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
  }

  // Continental com fase de grupos. Só clubes bem colocados na liga se classificam
  // (top 4 de cada liga da região). Retorna null se o usuário não se classificar.
  function buildContinental(career) {
    var region = REGION[career.leagueId] || "eu";
    var leagues = REGION_LEAGUES[region] || [career.leagueId];
    var size = leagues.length >= 4 ? 32 : 16;          // Europa: 32; Am. do Sul / outros: 16
    var perLeague = Math.ceil(size / leagues.length);   // vagas por liga (top-N da tabela)
    // classificados: melhores colocados de cada liga
    var initial = [];
    leagues.forEach(function (lg) { initial = initial.concat(rankLeague(career, lg).slice(0, perLeague)); });
    initial = initial.filter(function (id, i) { return initial.indexOf(id) === i; });
    if (initial.indexOf(career.teamId) < 0) return null; // usuário não se classificou
    var field = initial.slice();
    if (field.length > size) {
      field.sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
      field = field.slice(0, size);
      if (field.indexOf(career.teamId) < 0) field[field.length - 1] = career.teamId; // garante o usuário
    }
    while (field.length < size) { // completa com próximos melhores da região
      var pad = null, best = -1;
      leagues.forEach(function (lg) {
        TM.data.league(lg).clubIds.forEach(function (id) { if (field.indexOf(id) < 0 && TM.data.clubRating(id) > best) { best = TM.data.clubRating(id); pad = id; } });
      });
      if (!pad) break; field.push(pad);
    }
    var groups = size === 32 ? 8 : 4;
    return { type: "tournament", key: "cont", name: CONT_NAME[region] || "Continental",
      tour: TM.tournament.create(field, { groups: groups, perGroup: 4, advance: 2, userId: career.teamId }) };
  }

  function buildOrder(hasCont) {
    // 17 rodadas de liga; copa nacional (4 jogos) e continental (até 7: 3 de
    // grupos + 4 de mata-mata) intercaladas ao longo da temporada
    var order = [], cupAt = [3, 7, 11, 15], contAt = [2, 4, 6, 8, 10, 12, 14], cupN = 0, contN = 0;
    var contMax = hasCont ? 7 : 0;
    for (var lr = 1; lr <= 17; lr++) {
      order.push("league");
      if (cupAt.indexOf(lr) >= 0 && cupN < 4) { order.push("cup"); cupN++; }
      if (contAt.indexOf(lr) >= 0 && contN < contMax) { order.push("cont"); contN++; }
    }
    while (cupN < 4) { order.push("cup"); cupN++; }
    while (contN < contMax) { order.push("cont"); contN++; }
    return order;
  }

  function seasonSetup(career) {
    var leagueId = career.leagueId;
    var league = TM.data.league(leagueId);
    var cont = buildContinental(career);
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

  /* ---------- categorias de base ---------- */
  function youthAttrs(base, pos) {
    var a = { pac: base, sho: base, pas: base, dri: base, def: base, phy: base - 4 };
    if (pos === "GK") { a.def = base + 5; a.sho = base - 22; }
    if (pos === "DF") { a.def += 5; a.sho -= 8; }
    if (pos === "FW") { a.sho += 6; a.def -= 10; a.pac += 3; }
    if (pos === "MF") { a.pas += 5; }
    Object.keys(a).forEach(function (k) { a[k] = Math.max(20, Math.min(85, a[k] + Math.floor(Math.random() * 7 - 3))); });
    return a;
  }
  function generateYouth(clubId) {
    var club = TM.data.club(clubId);
    var culture = TM.data.cultureOfLeague(club.leagueId);
    var natName = TM.data.league(club.leagueId).nation;
    var nat = TM.data.nationByName(natName) || TM.data.world().nations[0];
    var roles = ["GK", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW", "GK", "DF", "MF", "FW"];
    var youth = [];
    roles.forEach(function (pos, i) {
      var age = 14 + Math.floor(Math.random() * 5); // 14 a 18
      var ov = 47 + Math.floor(Math.random() * 15);  // 47 a 61
      var pot = Math.min(91, ov + 8 + Math.floor(Math.random() * 22));
      youth.push({
        id: "y" + clubId + "-" + i, name: TM.data.randomName(culture), clubId: clubId, pos: pos,
        age: age, overall: ov, potential: pot, attrs: youthAttrs(ov, pos),
        nationId: nat.id, nationName: nat.name, height: 165 + Math.floor(Math.random() * 28),
        weight: 58 + Math.floor(Math.random() * 26), youth: true
      });
    });
    return youth;
  }

  function newClubCareer(clubId, opts) {
    opts = opts || {};
    var money = CURRENCIES[opts.currency] || CURRENCIES.eur;
    var club = TM.data.club(clubId);
    var baseEur = 30 + Math.round(TM.data.clubRating(clubId) / 3);
    var career = {
      type: "club", teamId: clubId, teamName: club.name, leagueId: club.leagueId, season: 1,
      coachName: (opts.coachName || "").trim() || "Treinador", coachPhoto: opts.coachPhoto || null,
      money: money,
      budget: Math.round(baseEur * money.mult) + (opts.injection || 0),
      roster: TM.data.clubPlayers(clubId).map(function (p) { return p.id; }),
      signedFrom: {}, honours: [],
      tactic: "equilibrado",
      injuries: {}, suspensions: {}, notifications: [],
      youth: generateYouth(clubId)
    };
    career.lineup = buildLineup(rosterPlayers(career), "4-4-2");
    seasonSetup(career);
    TM.notify.push(career, { icon: "🎉", title: "Bem-vindo!", text: "Você assumiu o comando do " + club.name + ". Boa sorte na temporada!" });
    return career;
  }

  /* ---------- processa o pós-jogo do usuário: lesões, suspensões, avisos ---------- */
  function processUserMatch(career, result, userSide) {
    // um jogo passou: reduz contadores
    ["injuries", "suspensions"].forEach(function (k) {
      Object.keys(career[k]).forEach(function (id) { career[k][id]--; if (career[k][id] <= 0) delete career[k][id]; });
    });
    // novas lesões do meu time
    (result.injuries || []).forEach(function (inj) {
      if (inj.side !== userSide) return;
      if (!inRoster(career, inj.id)) return;
      career.injuries[inj.id] = inj.weeks;
      TM.notify.push(career, { icon: "🚑", title: "Lesão", text: inj.name + " se lesionou e ficará fora por ~" + inj.weeks + " jogo(s)." });
    });
    // suspensões (cartão vermelho)
    (result.sentOff || []).forEach(function (so) {
      if (so.side !== userSide) return;
      if (!inRoster(career, so.id)) return;
      career.suspensions[so.id] = 1;
      TM.notify.push(career, { icon: "🟥", title: "Suspensão", text: so.name + " foi expulso e está suspenso do próximo jogo." });
    });
    // interesse de outro clube em um jogador seu (ocasional)
    maybeIncomingOffer(career);
  }
  function inRoster(career, id) { return career.roster.indexOf(id) >= 0; }

  function maybeIncomingOffer(career) {
    if (Math.random() > 0.28) return;
    var mine = rosterPlayers(career).filter(function (p) { return p.overall >= 70; }).sort(function (a, b) { return b.overall - a.overall; });
    if (!mine.length) return;
    var target = mine[Math.floor(Math.random() * Math.min(6, mine.length))];
    // um clube forte de fora
    var buyers = TM.data.world().clubs.filter(function (cl) { return cl.id !== career.teamId && TM.data.clubRating(cl.id) >= target.overall - 2; });
    if (!buyers.length) return;
    var buyer = buyers[Math.floor(Math.random() * buyers.length)];
    var fee = Math.round(TM.data.marketValue(target) * (0.8 + Math.random() * 0.6) * (career.money ? career.money.mult : 1));
    TM.notify.push(career, {
      icon: "📨", title: "Proposta recebida",
      text: buyer.name + " ofereceu " + (career.money ? career.money.sym : "€") + " " + fee + "M por " + target.name + ".",
      offer: { playerId: target.id, buyerId: buyer.id, fee: fee }
    });
  }

  // resolve uma proposta recebida (aceitar = vende; jogador pode ou não topar)
  function resolveIncomingOffer(career, note, accept) {
    var off = note.offer;
    var player = resolvePlayer(career, off.playerId);
    if (!accept) {
      TM.notify.remove(career, note.id);
      TM.notify.push(career, { icon: "🚫", title: "Proposta recusada", text: "Você recusou a proposta por " + player.name + "." });
      return "recusada";
    }
    // o jogador decide se topa sair (clubes maiores atraem mais)
    var buyerRating = TM.data.clubRating(off.buyerId), myRating = TM.data.clubRating(career.teamId);
    var playerWants = Math.random() < 0.4 + Math.max(0, (buyerRating - myRating)) * 0.05;
    TM.notify.remove(career, note.id);
    if (playerWants) {
      career.budget += off.fee;
      career.roster = career.roster.filter(function (id) { return id !== off.playerId; });
      if (career.lineup) {
        career.lineup.starters = career.lineup.starters.filter(function (id) { return id !== off.playerId; });
        career.lineup.bench = career.lineup.bench.filter(function (id) { return id !== off.playerId; });
      }
      TM.notify.push(career, { icon: "✅", title: "Negócio fechado", text: "Clube e jogador aceitaram: " + player.name + " foi vendido por " + (career.money ? career.money.sym : "€") + " " + off.fee + "M." });
      return "vendido";
    } else {
      TM.notify.push(career, { icon: "🙅", title: "Jogador recusou", text: "Você aceitou, mas " + player.name + " não quis deixar o clube. Negócio cancelado." });
      return "jogador_recusou";
    }
  }

  function promoteYouth(career, youthId) {
    var yp = resolvePlayer(career, youthId);
    if (!yp || yp.age < 15) return false;
    career.youth = career.youth.filter(function (y) { return y.id !== youthId; });
    career.youthMap = null;
    // vira parte do elenco (mantém como objeto customizado, id 'y' resolve nele)
    if (!career.customPlayers) career.customPlayers = {};
    yp.youth = false;
    career.customPlayers[youthId] = yp;
    career.roster.push(youthId);
    if (career.lineup) career.lineup.bench.push(youthId);
    return true;
  }

  function newSeason(career) {
    career.season++;
    seasonSetup(career);
  }

  // preenche campos novos em carreiras antigas (salvas antes destes recursos)
  function migrateCareer(career) {
    if (!career) return career;
    if (!career.money) career.money = CURRENCIES.eur;
    if (!career.injuries) career.injuries = {};
    if (!career.suspensions) career.suspensions = {};
    if (!career.notifications) career.notifications = [];
    if (!career.honours) career.honours = [];
    if (!career.tactic) career.tactic = "equilibrado";
    if (!career.coachName) career.coachName = "Treinador";
    if (!career.youth || !career.youth.length) career.youth = generateYouth(career.teamId);
    if (!career.lineup) career.lineup = buildLineup(rosterPlayers(career), "4-4-2");
    return career;
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
      var comp = career.comps[key];
      if (!comp) { career.orderIndex++; continue; }
      if (comp.type === "tournament") {
        var nx = TM.tournament.nextUserMatch(comp.tour, contCtx(career));
        if (nx.end) { career.orderIndex++; continue; }
        career.pending = { key: key, name: comp.name, homeId: nx.homeId, awayId: nx.awayId, ko: nx.ko, tour: true,
          label: nx.phase === "group" ? "Grupos · Rodada " + (nx.groupRound + 1) : TM.tournament.koTitle(nx.round) };
        TM.storage.saveCoachCareer(career);
        return career.pending;
      }
      var ko = comp;
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
    } else if (p.tour) {
      TM.tournament.applyUserMatch(career.comps[p.key].tour, homeScore, awayScore, contCtx(career));
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
    // guarda a classificação final da liga (usada para classificar à continental)
    career.lastStanding = st.map(function (r) { return r.id; });
    var already = career.honours.some(function (h) { return h.season === career.season; });
    if (already) return;
    var champ = st[0];
    var contChamp = c.cont && c.cont.tour && c.cont.tour.championId === career.teamId;
    career.honours.push({
      season: career.season,
      leaguePos: st.findIndex(function (r) { return r.id === career.teamId; }) + 1,
      leagueChampion: champ.id === career.teamId,
      cupChampion: c.cup && c.cup.championId === career.teamId,
      contChampion: contChamp
    });
  }

  TM.comp = {
    newClubCareer: newClubCareer, newSeason: newSeason, migrateCareer: migrateCareer,
    advanceToUserMatch: advanceToUserMatch, applyUserResult: applyUserResult,
    standings: standings, userTeam: userTeam, oppTeam: oppTeam, anyTeam: anyTeam,
    userSquad: userSquad, simMatch: simMatch, CURRENCIES: CURRENCIES,
    CUP_NAME: CUP_NAME, CONT_NAME: CONT_NAME, REGION: REGION,
    FORMATIONS: FORMATIONS, buildLineup: buildLineup, resolvePlayer: resolvePlayer,
    available: available, effectiveXI: effectiveXI, rosterPlayers: rosterPlayers,
    processUserMatch: processUserMatch, resolveIncomingOffer: resolveIncomingOffer,
    promoteYouth: promoteYouth, generateYouth: generateYouth
  };
})(window);
