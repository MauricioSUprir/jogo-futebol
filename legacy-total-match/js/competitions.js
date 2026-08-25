/* ================= TOTAL MATCH — competições e calendário ================= */
/* Modela a temporada da Carreira de Treinador com múltiplos campeonatos:
   Liga (pontos corridos) + Copa nacional (mata-mata) + Continental (mata-mata,
   só times classificados). Um calendário intercala as partidas. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  function rivalryOn() { try { return TM.storage.settings().rivalry !== false; } catch (e) { return true; } }

  var CUP_NAME = {
    br: "Copa Nacional", en: "Copa Nacional", es: "Copa Nacional", it: "Copa Nacional",
    de: "Copa Nacional", fr: "Copa Nacional", pt: "Copa Nacional", nl: "Copa Nacional",
    ar: "Copa Nacional", us: "Copa Nacional",
    mx: "Copa Nacional", sa: "Copa Nacional", tr: "Copa Nacional",
    ec: "Copa Nacional", uy: "Copa Nacional", ru: "Copa Nacional", co: "Copa Nacional",
    br2: "Copa Nacional", en2: "Copa Nacional", it2: "Copa Nacional", es2: "Copa Nacional"
  };
  var REGION = { co: "sa", br: "sa", ar: "sa", ec: "sa", uy: "sa", en: "eu", es: "eu", it: "eu", de: "eu", fr: "eu", pt: "eu", nl: "eu", tr: "eu", ru: "eu", us: "na", mx: "na", sa: "as" };
  var CONT_NAME = { sa: "Copa Continental Sul", eu: "Copa Continental Europa", na: "Copa Continental Norte", as: "Copa Continental Ásia" };
  var REGION_LEAGUES = { sa: ["br", "ar", "ec", "uy", "co"], eu: ["en", "es", "it", "de", "fr", "pt", "nl", "tr", "ru"], na: ["us", "mx"], as: ["sa"] };

  /* ---------- Confederações + Eliminatórias da Copa ---------- */
  // Copa do Mundo com 32 seleções. Cada confederação classifica um número de vagas.
  var WC_TEAMS = 32;
  var CONFED = {
    // Europa (UEFA)
    France: "UEFA", England: "UEFA", Spain: "UEFA", Germany: "UEFA", Portugal: "UEFA",
    Netherlands: "UEFA", Italy: "UEFA", Belgium: "UEFA", Croatia: "UEFA", Switzerland: "UEFA",
    Denmark: "UEFA", Poland: "UEFA", Sweden: "UEFA", Austria: "UEFA", Serbia: "UEFA",
    Norway: "UEFA", Scotland: "UEFA", Turkey: "UEFA", Ukraine: "UEFA", Wales: "UEFA",
    Bosnia: "UEFA", Greece: "UEFA", "Czech Republic": "UEFA", Hungary: "UEFA", Romania: "UEFA", Ireland: "UEFA",
    // América do Sul (CONMEBOL)
    Brazil: "CONMEBOL", Argentina: "CONMEBOL", Uruguay: "CONMEBOL", Colombia: "CONMEBOL",
    Ecuador: "CONMEBOL", Peru: "CONMEBOL", Chile: "CONMEBOL", Paraguay: "CONMEBOL", Venezuela: "CONMEBOL",
    // América do Norte/Central (CONCACAF)
    Mexico: "CONCACAF", USA: "CONCACAF", Canada: "CONCACAF", "Costa Rica": "CONCACAF", Jamaica: "CONCACAF",
    // África (CAF)
    Senegal: "CAF", Morocco: "CAF", Nigeria: "CAF", Ghana: "CAF", Cameroon: "CAF",
    "Ivory Coast": "CAF", Egypt: "CAF", "Cape Verde": "CAF", Tunisia: "CAF", Algeria: "CAF",
    "South Africa": "CAF", "DR Congo": "CAF",
    // Ásia + Oceania (AFC)
    Japan: "AFC", "South Korea": "AFC", "Saudi Arabia": "AFC", Qatar: "AFC", Iran: "AFC", Australia: "AFC"
  };
  var CONFED_NAME = { UEFA: "Europa (UEFA)", CONMEBOL: "América do Sul (CONMEBOL)", CONCACAF: "Am. do Norte (CONCACAF)", CAF: "África (CAF)", AFC: "Ásia/Oceania (AFC)" };
  // vagas por confederação (soma = 32)
  var CONFED_SLOTS = { UEFA: 13, CONMEBOL: 6, CAF: 5, AFC: 4, CONCACAF: 4 };

  function realism() { return TM.storage.settings().realism; }

  function confedOf(natId) { var n = TM.data.nation(natId); return n ? (CONFED[n.key] || "UEFA") : "UEFA"; }
  function natsInConfed(code) {
    return TM.data.world().nations.filter(function (n) { return (CONFED[n.key] || "UEFA") === code; }).map(function (n) { return n.id; });
  }
  // temporada-alvo da Copa a partir de uma temporada de eliminatórias
  function targetCopaSeason(season) {
    var r = season % 4, d = (1 - r + 4) % 4; if (d === 0) d = 4; return season + d;
  }

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
  // turno e returno (pontos corridos completo) — cada dupla joga 2x, mandos invertidos
  function doubleRoundRobin(ids) {
    var first = roundRobin(ids);
    var second = first.map(function (round) { return round.map(function (m) { return [m[1], m[0]]; }); });
    return first.concat(second);
  }
  // distribui `count` slots ao longo de `total` rodadas
  function spread(count, total) { var a = []; for (var i = 1; i <= count; i++) a.push(Math.round(i * total / (count + 1))); return a; }

  /* ---------- calendário (datas reais) ---------- */
  var MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function matchDay(i) { return 3 + i * 4; }            // dia (offset) do i-ésimo jogo do usuário
  // início da temporada por região: América do Sul começa em JANEIRO; Europa (e demais) em AGOSTO
  var SOUTHAM = { Brazil: 1, Argentina: 1, Ecuador: 1, Uruguay: 1, Colombia: 1, Paraguay: 1, Peru: 1, Chile: 1, Bolivia: 1, Venezuela: 1 };
  function seasonStartMonth(career) {
    try {
      if (career._startMonth != null) return career._startMonth;
      var club = TM.data.club(career.teamId), lg = club && TM.data.league(club.leagueId);
      var m = (lg && SOUTHAM[lg.nation]) ? 0 : 7;          // 0 = Jan, 7 = Ago
      career._startMonth = m; return m;
    } catch (e) { return 7; }
  }
  function dateOf(career, offset) {                      // converte offset de dias -> data (início regional)
    var sm = seasonStartMonth(career);
    var y = career.seasonYear || 2026, m = sm, d = (sm === 0 ? 20 : 10) + offset;
    while (true) { var dim = MONTHS[m]; if (d <= dim) break; d -= dim; m++; if (m > 11) { m = 0; y++; } }
    return { d: d, m: m + 1, y: y, short: pad(d) + "/" + pad(m + 1), full: pad(d) + "/" + pad(m + 1) + "/" + y };
  }
  // registra uma movimentação (contratação/venda/empréstimo) com a data atual da carreira
  function logDeal(career, rec) {
    career.deals = career.deals || [];
    var dt = dateOf(career, career.currentDay || 0);
    rec.season = career.season; rec.day = career.currentDay || 0;
    rec.date = dt.full; rec.dateShort = dt.short;
    career.deals.unshift(rec);                 // mais recentes primeiro
    if (career.deals.length > 300) career.deals.length = 300;
  }
  // próximos jogos do usuário (somente leitura) para a aba Calendário
  function peekSchedule(career, n) {
    var out = [], mi = career.matchNo || 0, oi = career.orderIndex, guard = 0;
    var leagueCursor = career.comps.league.round;
    while (out.length < n && oi < career.order.length && guard++ < 400) {
      var key = career.order[oi]; oi++;
      if (key === "league") {
        if (leagueCursor >= career.comps.league.fixtures.length) continue;
        var rd = career.comps.league.fixtures[leagueCursor]; leagueCursor++;
        var fix = null; rd.forEach(function (m) { if (m[0] === career.teamId || m[1] === career.teamId) fix = m; });
        if (fix) { out.push({ key: "league", name: career.comps.league.name, homeId: fix[0], awayId: fix[1], day: matchDay(mi) }); mi++; }
      } else {
        var comp = career.comps[key]; if (!comp) continue;
        var done = comp.type === "tournament" ? (comp.tour.championId || !comp.tour.aliveUser) : (comp.championId || !comp.aliveUser);
        if (done) continue;
        out.push({ key: key, name: comp.name, homeId: null, awayId: null, day: matchDay(mi), tbd: true }); mi++;
      }
    }
    return out;
  }
  function emptyTable(ids) { var t = {}; ids.forEach(function (id) { t[id] = { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }); return t; }
  function applyResult(t, h, a, hs, as) {
    var H = t[h], A = t[a]; H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; A.l++; H.pts += 3; } else if (hs < as) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  function standings(t) { return Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf; }); }

  /* ---------- formações (campinho) ---------- */
  var FORMATIONS = {
    "4-4-2":     [["GK",50,88],["DF",16,68],["DF",39,72],["DF",61,72],["DF",84,68],["MF",16,44],["MF",39,48],["MF",61,48],["MF",84,44],["FW",38,20],["FW",62,20]],
    "4-4-1-1":   [["GK",50,88],["DF",16,70],["DF",39,73],["DF",61,73],["DF",84,70],["MF",14,48],["MF",38,50],["MF",62,50],["MF",86,48],["FW",50,32],["FW",50,15]],
    "4-3-3":     [["GK",50,88],["DF",16,68],["DF",39,72],["DF",61,72],["DF",84,68],["MF",30,48],["MF",50,52],["MF",70,48],["FW",20,22],["FW",50,16],["FW",80,22]],
    "4-5-1":     [["GK",50,88],["DF",16,70],["DF",39,72],["DF",61,72],["DF",84,70],["MF",10,48],["MF",32,50],["MF",50,45],["MF",68,50],["MF",90,48],["FW",50,16]],
    "4-2-3-1":   [["GK",50,88],["DF",16,68],["DF",39,72],["DF",61,72],["DF",84,68],["MF",38,56],["MF",62,56],["MF",24,36],["MF",50,32],["MF",76,36],["FW",50,16]],
    "4-1-4-1":   [["GK",50,88],["DF",16,70],["DF",39,72],["DF",61,72],["DF",84,70],["MF",50,58],["MF",14,42],["MF",38,44],["MF",62,44],["MF",86,42],["FW",50,15]],
    "4-1-2-1-2": [["GK",50,88],["DF",16,70],["DF",39,72],["DF",61,72],["DF",84,70],["MF",50,60],["MF",26,47],["MF",74,47],["MF",50,33],["FW",38,17],["FW",62,17]],
    "4-2-2-2":   [["GK",50,88],["DF",16,70],["DF",39,72],["DF",61,72],["DF",84,70],["MF",34,54],["MF",66,54],["MF",30,34],["MF",70,34],["FW",38,17],["FW",62,17]],
    "4-2-4":     [["GK",50,88],["DF",16,70],["DF",39,72],["DF",61,72],["DF",84,70],["MF",38,50],["MF",62,50],["FW",14,24],["FW",39,16],["FW",61,16],["FW",86,24]],
    "3-5-2":     [["GK",50,88],["DF",30,70],["DF",50,73],["DF",70,70],["MF",12,46],["MF",34,50],["MF",50,42],["MF",66,50],["MF",88,46],["FW",38,18],["FW",62,18]],
    "3-4-3":     [["GK",50,88],["DF",28,70],["DF",50,73],["DF",72,70],["MF",12,48],["MF",38,50],["MF",62,50],["MF",88,48],["FW",22,20],["FW",50,15],["FW",78,20]],
    "3-4-1-2":   [["GK",50,88],["DF",28,70],["DF",50,73],["DF",72,70],["MF",12,50],["MF",38,52],["MF",62,52],["MF",88,50],["MF",50,33],["FW",38,17],["FW",62,17]],
    "3-4-2-1":   [["GK",50,88],["DF",28,70],["DF",50,73],["DF",72,70],["MF",12,50],["MF",38,52],["MF",62,52],["MF",88,50],["FW",34,30],["FW",66,30],["FW",50,15]],
    "5-3-2":     [["GK",50,88],["DF",10,64],["DF",30,72],["DF",50,74],["DF",70,72],["DF",90,64],["MF",30,46],["MF",50,50],["MF",70,46],["FW",38,18],["FW",62,18]],
    "5-4-1":     [["GK",50,88],["DF",10,66],["DF",30,72],["DF",50,74],["DF",70,72],["DF",90,66],["MF",16,48],["MF",39,50],["MF",61,50],["MF",84,48],["FW",50,17]],
    "5-2-3":     [["GK",50,88],["DF",10,66],["DF",30,72],["DF",50,74],["DF",70,72],["DF",90,66],["MF",38,50],["MF",62,50],["FW",22,22],["FW",50,17],["FW",78,22]]
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

  /* ---------- posições: variabilidade + penalidade por jogar fora de posição ---------- */
  var POS_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };
  // posição secundária "confortável" sugerida pela posição específica (pos2)
  var VERSA_CAND = {
    ZAG: ["MF"], LD: ["MF"], LE: ["MF"],
    VOL: ["DF"], MC: ["DF", "FW"], MEI: ["FW"], MD: ["FW"], ME: ["FW"],
    PD: ["MF"], PE: ["MF"], SA: ["MF"], CA: ["MF"], GOL: []
  };
  function hashStr(s) { s = String(s || ""); var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  // grupos onde o jogador também atua sem perder overall — ~a maioria (mas nem todos; goleiros não)
  function playerVersa(p) {
    if (!p) return [];
    if (p._versa) return p._versa;
    var cands = VERSA_CAND[p.pos2] || [], h = hashStr(p.id), out = [];
    if (cands.length && (h % 100) < 66) { out.push(cands[0]); if (cands.length > 1 && (h % 100) < 20) out.push(cands[1]); }
    try { p._versa = out; } catch (e) {}
    return out;
  }
  // quanto o jogador perde de overall ao atuar no grupo `slotGroup`
  function posPenalty(playerPos, slotGroup, p) {
    if (playerPos === slotGroup) return 0;
    if (playerVersa(p).indexOf(slotGroup) >= 0) return 0;         // posição secundária confortável
    if (playerPos === "GK" || slotGroup === "GK") return 16;      // goleiro é único
    var d = Math.abs((POS_ORDER[playerPos] == null ? 2 : POS_ORDER[playerPos]) - (POS_ORDER[slotGroup] == null ? 2 : POS_ORDER[slotGroup]));
    return d >= 2 ? 9 : 4;                                        // 2 grupos (DEF<->ATA): -9 ; adjacente: -4
  }
  // overall efetivo do jogador num slot: { ov, off (fora de posição), drop }
  function effOverall(p, slotGroup) {
    var pen = p ? posPenalty(p.pos, slotGroup, p) : 0;
    return { ov: Math.max(40, (p ? p.overall : 60) - pen), off: pen > 0, drop: pen };
  }
  // rótulo específico da posição do slot (a partir das coordenadas da formação)
  function slotPos(slot) {
    if (!slot) return "?";
    var g = slot[0], x = slot[1], y = slot[2];
    if (g === "GK") return "GOL";
    if (g === "DF") { if (x <= 22) return "LE"; if (x >= 78) return "LD"; return "ZAG"; }
    if (g === "MF") { if (x <= 20) return "ME"; if (x >= 80) return "MD"; if (y >= 53) return "VOL"; if (y <= 37) return "MEI"; return "MC"; }
    if (x <= 30) return "PE"; if (x >= 70) return "PD"; return "CA";
  }
  // devolve o jogador ajustado ao slot: se estiver fora de posição, vira o grupo do slot com atributos reduzidos
  function adjustForSlot(p, slot) {
    if (!p || !slot) return p;
    var pen = posPenalty(p.pos, slot[0], p);
    if (pen <= 0) return p;
    var a = p.attrs || {}, na = {};
    Object.keys(a).forEach(function (k) { na[k] = Math.max(20, (a[k] || 50) - pen); });
    return Object.assign({}, p, { pos: slot[0], attrs: na, overall: Math.max(40, (p.overall || 60) - pen), _off: true });
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
    var formation = (career.lineup && career.lineup.formation) || "4-4-2";
    var slots = FORMATIONS[formation] || FORMATIONS["4-4-2"];
    var xi = xiIds.map(function (id, i) { var p = resolvePlayer(career, id); return p ? adjustForSlot(p, slots[i]) : null; }).filter(Boolean);
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
  function buildKO(teamIds, name, key, twoLeg) {
    return { type: "ko", key: key, name: name, teamIds: shuffle(teamIds), rounds: [], roundIndex: 0, aliveUser: true, championId: null, twoLeg: !!twoLeg };
  }
  function ensureKORound(ko) {
    if (ko.rounds[ko.roundIndex]) return;
    var teams;
    if (ko.roundIndex === 0) teams = ko.teamIds;
    else teams = ko.rounds[ko.roundIndex - 1].map(function (t) { return t[4]; }); // vencedores
    var ties = [];
    for (var i = 0; i < teams.length; i += 2) {
      ties.push(ko.twoLeg ? [teams[i], teams[i + 1], null, null, null, null, null, null, null, 0]
                          : [teams[i], teams[i + 1], null, null, null]);
    }
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
  function decideTwoLeg(tie, forcedPenWinner) {
    var aggA = tie[5] + tie[8], aggB = tie[6] + tie[7]; tie[2] = aggA; tie[3] = aggB;
    if (aggA !== aggB) { tie[4] = aggA > aggB ? tie[0] : tie[1]; return; }
    var awayA = tie[8], awayB = tie[6];
    tie[4] = awayA > awayB ? tie[0] : awayB > awayA ? tie[1] : (forcedPenWinner || penaltyWinner(tie[0], tie[1]));
  }
  function resolveTieTwoLeg(career, tie) {
    var l1 = simMatch(career, tie[0], tie[1], true); tie[5] = l1.score[0]; tie[6] = l1.score[1];
    var l2 = simMatch(career, tie[1], tie[0], true); tie[7] = l2.score[0]; tie[8] = l2.score[1];
    tie[9] = 2; decideTwoLeg(tie);
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
    round.forEach(function (tie) { if (tie[4] == null) (ko.twoLeg ? resolveTieTwoLeg : resolveTie)(career, tie, true); });
    if (round.length === 1) ko.championId = round[0][4];
    ko.roundIndex++;
  }

  /* ---------- criação de carreira ---------- */
  function topClubs(leagueId, n) {
    return TM.data.league(leagueId).clubIds.slice()
      .sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); }).slice(0, n);
  }
  function pow2Floor(n) { var p = 1; while (p * 2 <= n) p *= 2; return p; }

  // copas nacionais que reúnem 1ª e 2ª divisão do país
  var CUP_DIVS = {
    br: ["br", "br2", "br3"], br2: ["br", "br2", "br3"], br3: ["br", "br2", "br3"], en: ["en", "en2"], en2: ["en", "en2"],
    it: ["it", "it2"], it2: ["it", "it2"], es: ["es", "es2"], es2: ["es", "es2"]
  };
  function buildDomesticCup(teamId, leagueId) {
    var divs = CUP_DIVS[leagueId] || [leagueId];
    var pool = [];
    // mantém o chaveamento em potência de 2 (32) incluindo todas as divisões
    if (divs.length >= 3) { pool = topClubs(divs[0], 16).concat(topClubs(divs[1], 8)).concat(topClubs(divs[2], 8)); } // 16+8+8 = 32
    else if (divs.length === 2) { pool = topClubs(divs[0], 16).concat(topClubs(divs[1], 16)); } // 32
    else { pool = topClubs(leagueId, 16); }
    if (pool.indexOf(teamId) < 0) { pool[pool.length - 1] = teamId; } // garante o usuário
    return buildKO(pool, CUP_NAME[divs[0]] || "Copa Nacional", "cup", true); // nome pela 1ª divisão; ida e volta
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
      tour: TM.tournament.create(field, { groups: groups, perGroup: 4, advance: 2, doubleGroups: true, twoLeg: true, userId: career.teamId }) };
  }

  // Mundial de Clubes (carreira): 32 melhores clubes de todas as ligas, formato Copa
  // do Mundo (grupos + mata-mata em jogo único). Acontece 1 ano antes da Copa (season % 4 === 0).
  function buildMundial(career) {
    // representa TODAS as 1ª divisões (inclui as ligas novas); exclui as 2ª divisões
    var firstDivs = TM.data.world().leagues.map(function (L) { return L.id; }).filter(function (id) { return !DIV_UP[id]; });
    var field = [];
    firstDivs.forEach(function (lg) { field = field.concat(topClubs(lg, 2)); }); // top 2 de cada liga
    field = field.filter(function (id, i) { return field.indexOf(id) === i; });
    if (field.length > 32) {
      // mantém pelo menos o melhor de cada liga; corta os excedentes mais fracos
      field.sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
      field = field.slice(0, 32);
    } else if (field.length < 32) {
      var extra = [];
      firstDivs.forEach(function (lg) { extra = extra.concat(topClubs(lg, 6)); });
      extra.sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
      for (var i = 0; i < extra.length && field.length < 32; i++) { if (field.indexOf(extra[i]) < 0) field.push(extra[i]); }
    }
    if (field.indexOf(career.teamId) < 0) field[field.length - 1] = career.teamId; // garante o clube do usuário
    return { type: "tournament", key: "mundial", name: "Mundial de Clubes",
      tour: TM.tournament.create(field, { groups: 8, perGroup: 4, advance: 2, doubleGroups: false, twoLeg: false, userId: career.teamId }) };
  }

  function buildOrder(leagueRounds, contSlots, mundialSlots) {
    // liga em turno e returno; copa nacional (ida e volta), continental
    // (grupos de ida/volta + mata-mata) e Mundial de Clubes intercalados na temporada
    var cupAt = spread(8, leagueRounds), contAt = spread(contSlots, leagueRounds), mundAt = spread(mundialSlots || 0, leagueRounds);
    var order = [], cupI = 0, contI = 0, mundI = 0;
    for (var lr = 1; lr <= leagueRounds; lr++) {
      order.push("league");
      while (cupI < cupAt.length && cupAt[cupI] === lr) { order.push("cup"); cupI++; }
      while (contI < contAt.length && contAt[contI] === lr) { order.push("cont"); contI++; }
      while (mundI < mundAt.length && mundAt[mundI] === lr) { order.push("mundial"); mundI++; }
    }
    while (cupI < cupAt.length) { order.push("cup"); cupI++; }
    while (contI < contAt.length) { order.push("cont"); contI++; }
    while (mundI < mundAt.length) { order.push("mundial"); mundI++; }
    return order;
  }

  function seasonSetup(career) {
    var leagueId = career.leagueId;
    var league = TM.data.league(leagueId);
    var cont = buildContinental(career);
    var fixtures = doubleRoundRobin(league.clubIds.slice()); // turno e returno (34 rodadas p/ 18 clubes)
    // Mundial de Clubes: 1 ano antes da Copa do Mundo (temporadas 4, 8, 12, ... — a Copa é em 1, 5, 9, ...)
    var mundial = (career.season % 4 === 0) ? buildMundial(career) : null;
    career.comps = {
      league: { type: "league", name: league.name, fixtures: fixtures, round: 0, table: emptyTable(league.clubIds) },
      cup: buildDomesticCup(career.teamId, leagueId),
      cont: cont,
      mundial: mundial
    };
    // continental: 6 rodadas de grupo (ida/volta) + até 8 de mata-mata (ida e volta) = ~14 (folga p/ 20)
    // Mundial: 3 rodadas de grupo + 4 de mata-mata = 7 (folga p/ 10)
    career.order = buildOrder(fixtures.length, cont ? 20 : 0, mundial ? 10 : 0);
    // Intercontinental: jogo único no fim da temporada (campeão da Liberta x campeão da Champions)
    career.order.push("inter");
    career.interChampion = null; career.interMatch = null;
    career.orderIndex = 0;
    career.pending = null;
    // calendário
    career.seasonYear = 2025 + career.season;
    career.currentDay = 0;
    career.matchNo = 0;
    career.pstats = {};            // estatísticas por jogador zeram a cada temporada
    career.pendingWorldDeals = [];
    buildWindows(career);
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
      var jewel = Math.random() < 0.08;              // joia rara na base
      var pot = jewel ? Math.min(93, ov + 22 + Math.floor(Math.random() * 11))
                      : Math.min(89, ov + 8 + Math.floor(Math.random() * 20));
      youth.push({
        id: "y" + clubId + "-" + i, name: TM.data.randomName(culture), clubId: clubId, pos: pos, pos2: TM.data.randomSpecificPos(pos),
        age: age, overall: ov, potential: pot, attrs: youthAttrs(ov, pos),
        nationId: nat.id, nationName: nat.name, height: 165 + Math.floor(Math.random() * 28),
        weight: 58 + Math.floor(Math.random() * 26), youth: true, hiddenPot: true, jewel: jewel
      });
    });
    return youth;
  }

  // orçamento inicial realista (milhões de euro) conforme o porte do clube (overall)
  function baseBudgetEur(rating) {
    if (rating >= 89) return 200;
    if (rating >= 87) return 150;
    if (rating >= 85) return 110;
    if (rating >= 83) return 75;
    if (rating >= 81) return 50;
    if (rating >= 79) return 33;
    if (rating >= 77) return 20;
    if (rating >= 75) return 12;
    if (rating >= 73) return 7;
    if (rating >= 70) return 4;
    return 2;
  }
  function newClubCareer(clubId, opts) {
    opts = opts || {};
    var money = CURRENCIES[opts.currency] || CURRENCIES.eur;
    var club = TM.data.club(clubId);
    var baseEur = baseBudgetEur(TM.data.clubRating(clubId));
    var career = {
      type: "club", teamId: clubId, teamName: club.name, leagueId: club.leagueId, season: 1,
      coachName: (opts.coachName || "").trim() || "Treinador", coachPhoto: opts.coachPhoto || null, coachId: opts.coachId || null,
      board: opts.board || "intermediaria", role: opts.role || "treinador",
      recentForm: [], lastBoardCall: 0,
      reputation: 18, careerStats: { p: 0, w: 0 }, sackCount: 0,
      money: money,
      budget: Math.round(baseEur * money.mult) + (opts.injection || 0),
      roster: TM.data.clubPlayers(clubId).map(function (p) { return p.id; }),
      signedFrom: {}, honours: [],
      objective: generateObjective(clubId),
      tactic: "equilibrado",
      injuries: {}, suspensions: {}, notifications: [],
      youth: generateYouth(clubId)
    };
    career.lineup = buildLineup(rosterPlayers(career), "4-4-2");
    career.nation = opts.nationId ? buildNation(opts.nationId) : null;
    setupNationSeason(career);
    seasonSetup(career);
    TM.notify.push(career, { icon: "🎉", title: "Bem-vindo!", text: "Você assumiu o comando do " + club.name + ". Boa sorte na temporada!" });
    if (career.nation) TM.notify.push(career, { icon: "🌍", title: "Seleção", text: "Você também comandará a seleção de " + career.nation.name + ". Faça a convocação a tempo!" });
    return career;
  }

  // ---- troca de clube (aceitar proposta de outro clube / recomeçar após demissão) ----
  function switchUserClub(career, clubId) {
    var club = TM.data.club(clubId); if (!club) return career;
    if (!career.clubHistory) career.clubHistory = [];
    career.clubHistory.push({ clubId: career.teamId, clubName: career.teamName, season: career.season, seasonYear: career.seasonYear, left: "trocou de clube" });
    // reset ligado ao clube (mantém histórico, treinador, moeda, seleção, honours)
    career.teamId = clubId;
    career.teamName = club.name;
    career.leagueId = club.leagueId;
    career.roster = TM.data.clubPlayers(clubId).map(function (p) { return p.id; });
    career.signedFrom = {};
    career.objective = generateObjective(clubId);
    career.budget = Math.round(baseBudgetEur(TM.data.clubRating(clubId)) * (career.money ? career.money.mult : 1));
    career.tactic = "equilibrado";
    career.injuries = {}; career.suspensions = {}; career.confidence = {};
    career.recentForm = []; career.stats = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    career.youth = generateYouth(clubId);
    career.lineup = buildLineup(rosterPlayers(career), "4-4-2");
    career.jobOffers = [];
    career.unemployed = false;
    career.matchNo = 0; career.currentDay = 0;
    seasonSetup(career);
    TM.notify.push(career, { icon: "🤝", title: "Novo desafio", news: true, title2: club.name, text: "Você assumiu o comando do " + club.name + "! Uma nova história começa." });
    return career;
  }

  // ---- REPUTAÇÃO do treinador (0-100): desconhecido -> lenda ----
  function computeReputation(career) {
    var h = (career.honours || []).length;
    var cs = career.careerStats || { p: 0, w: 0 };
    var wr = cs.p >= 5 ? cs.w / cs.p : 0.42;
    var rep = 8 + h * 7 + ((career.season || 1) - 1) * 2 + Math.round(wr * 24) - (career.sackCount || 0) * 5;
    return Math.max(3, Math.min(100, Math.round(rep)));
  }
  function reputationLabel(r) {
    return r >= 90 ? "Lenda" : r >= 76 ? "Elite mundial" : r >= 60 ? "Renomado" : r >= 42 ? "Respeitado" : r >= 25 ? "Promissor" : "Desconhecido";
  }

  // ---- propostas de emprego de outros clubes (gera de acordo com o desempenho) ----
  function generateJobOffers(career) {
    if (career.type === "director") return;              // dirigente não recebe proposta de técnico
    if (!career.jobOffers) career.jobOffers = [];
    var matchNo = career.matchNo || 0;
    var unemployed = !!career.unemployed;
    // limpa propostas velhas (mais de ~6 jogos)
    career.jobOffers = career.jobOffers.filter(function (o) { return unemployed || (matchNo - (o.matchNo || 0)) <= 6; });
    var throttle = unemployed ? 0 : 3;
    if (!unemployed && (matchNo - (career._lastOfferGen || 0)) < throttle) return;
    // reputação do treinador: títulos + desempenho na temporada
    var honours = (career.honours || []).length;
    var st = career.stats || { p: 0, w: 0 };
    var winRate = st.p >= 3 ? st.w / st.p : 0.4;
    var rep = computeReputation(career); // reputação do treinador (0..100)
    // chance de surgir proposta
    var chance = unemployed ? 0.9 : (winRate > 0.6 ? 0.5 : winRate > 0.45 ? 0.28 : 0.12);
    if (Math.random() > chance) { career._lastOfferGen = matchNo; return; }
    if (career.jobOffers.length >= 4) { career._lastOfferGen = matchNo; return; }
    // escolhe um clube pretendente (melhor quanto maior a reputação); evita o clube atual
    var W = TM.data.world();
    var pool = W.clubs.filter(function (cl) { return cl.id !== career.teamId; });
    var myRating = TM.data.clubRating(career.teamId);
    var targetBand = myRating + Math.min(8, Math.round(rep / 4)); // clubes um pouco melhores
    pool = pool.map(function (cl) { return { cl: cl, r: TM.data.clubRating(cl.id) }; })
      .filter(function (o) { return o.r <= targetBand + 4 && o.r >= targetBand - 10; });
    if (!pool.length) { career._lastOfferGen = matchNo; return; }
    // não repete clube já com proposta aberta
    var open = {}; career.jobOffers.forEach(function (o) { open[o.clubId] = true; });
    pool = pool.filter(function (o) { return !open[o.cl.id]; });
    if (!pool.length) { career._lastOfferGen = matchNo; return; }
    pool.sort(function (a, b) { return b.r - a.r; });
    var pick = pool[Math.floor(Math.random() * Math.min(pool.length, 5))];
    var cl = pick.cl;
    var lg = TM.data.league(cl.leagueId);
    var descs = [
      "vê em você o perfil ideal para o projeto",
      "acaba de demitir o treinador e quer você no comando",
      "prepara uma reformulação e sonha com o seu trabalho",
      "tem ambições grandes e quer você para liderar o elenco"
    ];
    var wage = Math.round(baseBudgetEur(pick.r) * (career.money ? career.money.mult : 1) * 0.02);
    career.jobOffers.unshift({
      id: "job-" + cl.id + "-" + matchNo + "-" + Math.floor(Math.random() * 999),
      clubId: cl.id, clubName: cl.name, leagueName: lg ? lg.name : "",
      rating: pick.r, desc: descs[Math.floor(Math.random() * descs.length)],
      wage: wage, matchNo: matchNo, season: career.season, seen: false
    });
    career._lastOfferGen = matchNo;
    TM.notify.push(career, { icon: "💼", title: "Proposta recebida", news: true, text: "O " + cl.name + " sondou você para ser o novo treinador. Veja em Propostas." });
  }

  /* ---------- processa o pós-jogo do usuário: lesões, suspensões, avisos ---------- */
  // ---- Overall dinâmico: confiança que sobe/desce por desempenho ----
  function steadyPlayer(id) { var s = String(id || ""), h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100) < 28; } // ~28% constantes (bem distribuído)
  function dynamicInfo(career, p) {
    var on = TM.storage.settings().dynamicOverall;
    if (!on || !p) return { on: false, delta: 0, dir: null };
    if (steadyPlayer(p.id)) return { on: true, delta: 0, dir: 0 };
    var c = (career && career.confidence && career.confidence[p.id]) || 0;
    var d = Math.max(-4, Math.min(4, Math.round(c)));
    return { on: true, delta: d, dir: d > 0 ? 1 : d < 0 ? -1 : 0 };
  }
  function updateConfidence(career, result, userSide) {
    if (!TM.storage.settings().dynamicOverall) return;
    if (!career.confidence) career.confidence = {};
    var win = result.score[userSide] > result.score[1 - userSide];
    var loss = result.score[userSide] < result.score[1 - userSide];
    rosterPlayers(career).forEach(function (p) {
      if (steadyPlayer(p.id)) return;
      var cur = career.confidence[p.id] || 0;
      var drift = (win ? 0.7 : loss ? -0.7 : 0.1) + (Math.random() - 0.5) * 0.9;
      cur = Math.max(-5, Math.min(5, cur * 0.92 + drift)); // leve retorno à média + variação
      career.confidence[p.id] = cur;
    });
  }
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
      career.yellows && (career.yellows[so.id] = 0);
      TM.notify.push(career, { icon: "🟥", title: "Suspensão", text: so.name + " foi expulso e está suspenso do próximo jogo." });
    });
    // cartões amarelos acumulados: a cada 3, suspensão automática de 1 jogo
    if (!career.yellows) career.yellows = {};
    (result.events || []).forEach(function (ev) {
      if (ev.type !== "yellow" || ev.team !== userSide || !ev.playerId) return;
      if (!inRoster(career, ev.playerId)) return;
      career.yellows[ev.playerId] = (career.yellows[ev.playerId] || 0) + 1;
      if (career.yellows[ev.playerId] >= 3) {
        career.yellows[ev.playerId] = 0;
        career.suspensions[ev.playerId] = 1;
        TM.notify.push(career, { icon: "🟨", title: "Suspensão por cartões", text: (ev.player || "Um jogador") + " levou o 3º amarelo e está suspenso do próximo jogo." });
      }
    });
    // interesse de outro clube em um jogador seu (ocasional)
    maybeIncomingOffer(career);
    // registra o resultado e avalia uma possível chamada da diretoria
    if (result && result.score) {
      var gf = result.score[userSide], ga = result.score[1 - userSide];
      var res = gf > ga ? "V" : (gf < ga ? "D" : "E");
      if (!career.recentForm) career.recentForm = [];
      career.recentForm.push(res);
      if (career.recentForm.length > 8) career.recentForm = career.recentForm.slice(-8);
      // currículo (estatísticas de carreira)
      if (!career.stats) career.stats = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
      career.stats.p++; career.stats.gf += gf; career.stats.ga += ga;
      if (res === "V") career.stats.w++; else if (res === "D") career.stats.l++; else career.stats.d++;
      if (!career.careerStats) career.careerStats = { p: 0, w: 0 };
      career.careerStats.p++; if (res === "V") career.careerStats.w++;
      maybeBoardCall(career);
    }
    updateConfidence(career, result, userSide); // overall dinâmico
  }
  function inRoster(career, id) { return career.roster.indexOf(id) >= 0; }

  // ---- estatísticas por JOGADOR na temporada (jogos, gols, assist, nota, forma) ----
  function posRankOf(p) { return p.pos === "FW" ? 3 : p.pos === "MF" ? 2 : p.pos === "DF" ? 1 : 0; }
  function clampRating(r) { return Math.max(3.5, Math.min(10, Math.round(r * 10) / 10)); }
  function recordPlayerStats(career, result, userSide, oppName) {
    if (!result || !result.score) return;
    if (!career.pstats) career.pstats = {};
    var gf = result.score[userSide], ga = result.score[1 - userSide];
    var res = gf > ga ? "V" : gf < ga ? "D" : "E";
    var scoreStr = gf + "×" + ga;
    var starters = ((career.lineup && career.lineup.starters) || []).slice();
    var onField = starters.map(function (id) { return resolvePlayer(career, id); }).filter(Boolean);
    if (!onField.length) return;
    // gols do meu time por NOME do artilheiro (eventos guardam o nome)
    var goalByName = {};
    (result.events || []).forEach(function (ev) {
      if ((ev.type === "goal" || ev.type === "pengoal") && ev.team === userSide && ev.player) goalByName[ev.player] = (goalByName[ev.player] || 0) + 1;
    });
    // assistências sintéticas (o motor não gera): ~50% dos gols têm um assistente companheiro
    var goalsList = [];
    onField.forEach(function (p) { var g = goalByName[p.name] || 0; for (var k = 0; k < g; k++) goalsList.push(p.id); });
    var assistCount = {};
    goalsList.forEach(function (scorerId) {
      if (Math.random() < 0.5) {
        var mates = onField.filter(function (p) { return p.id !== scorerId; }).sort(function (a, b) { return posRankOf(b) - posRankOf(a); });
        var cand = mates[Math.floor(Math.random() * Math.min(5, mates.length))];
        if (cand) assistCount[cand.id] = (assistCount[cand.id] || 0) + 1;
      }
    });
    onField.forEach(function (p) {
      var st = career.pstats[p.id] || (career.pstats[p.id] = { apps: 0, goals: 0, assists: 0, rsum: 0, rn: 0, form: [], noScore: 0, best: null, last: null });
      var g = goalByName[p.name] || 0, a = assistCount[p.id] || 0;
      var r = 6.0 + (Math.random() * 1.2 - 0.6) + g * 0.85 + a * 0.45 + (res === "V" ? 0.35 : res === "D" ? -0.35 : 0);
      if ((p.pos === "GK" || p.pos === "DF") && ga === 0) r += 0.4;
      if ((p.pos === "GK" || p.pos === "DF") && ga >= 3) r -= 0.5;
      r = clampRating(r);
      st.apps++; st.goals += g; st.assists += a; st.rsum += r; st.rn++;
      st.form.push(res); if (st.form.length > 5) st.form = st.form.slice(-5);
      if (g > 0) st.noScore = 0; else if (p.pos === "FW" || p.pos === "MF") st.noScore++;
      st.last = { rating: r, opp: oppName || "Adversário", score: scoreStr, res: res, goals: g, assists: a };
      if (!st.best || r > st.best.rating) st.best = { rating: r, opp: oppName || "Adversário", score: scoreStr };
    });
    // ---- fadiga: titulares cansam, reservas recuperam ----
    career.fatigue = career.fatigue || {};
    var startedNow = {};
    onField.forEach(function (p) {
      startedNow[p.id] = true;
      var base = (p.age || 24) >= 31 ? 26 : (p.age || 24) <= 21 ? 16 : 20;   // veteranos cansam mais
      career.fatigue[p.id] = Math.min(100, (career.fatigue[p.id] || 0) + base);
    });
    (career.roster || []).forEach(function (id) {
      if (startedNow[id]) return;
      career.fatigue[id] = Math.max(0, (career.fatigue[id] || 0) - 34);        // quem não jogou descansa
    });
  }

  /* ---------- chamadas da diretoria ---------- */
  // exigência: quantas derrotas seguidas até a diretoria cobrar / quantas vitórias para elogiar
  var BOARD_CFG = {
    aceitavel:     { badStreak: 4, goodStreak: 4, cooldown: 4, sackStreak: 7, tone: "tranquila" },
    intermediaria: { badStreak: 3, goodStreak: 3, cooldown: 3, sackStreak: 6, tone: "equilibrada" },
    rigorosa:      { badStreak: 2, goodStreak: 3, cooldown: 2, sackStreak: 4, tone: "rigorosa" }
  };
  function boardLabel(career) {
    var club = TM.data.club(career.teamId);
    return "A diretoria do " + (club ? club.name : "clube");
  }
  function maybeBoardCall(career) {
    var cfg = BOARD_CFG[career.board] || BOARD_CFG.intermediaria;
    var matchNo = career.matchNo || 0;
    if (matchNo - (career.lastBoardCall || 0) < cfg.cooldown) return; // respeita o intervalo entre chamadas
    var f = career.recentForm || [];
    // conta a sequência atual de vitórias e de derrotas
    var winStreak = 0, lossStreak = 0;
    for (var i = f.length - 1; i >= 0; i--) { if (f[i] === "V") winStreak++; else break; }
    for (var j = f.length - 1; j >= 0; j--) { if (f[j] === "D") lossStreak++; else break; }

    // fase ruim → cobrança (e, se muito ruim numa diretoria rigorosa, ameaça de demissão)
    if (lossStreak >= cfg.sackStreak) {
      career.lastBoardCall = matchNo;
      TM.notify.push(career, { icon: "☎️", title: "Chamada da diretoria", boardCall: true,
        text: boardLabel(career) + " está muito insatisfeita: " + lossStreak + " derrotas seguidas. O seu cargo está por um fio — vença os próximos jogos ou será demitido." });
      return;
    }
    if (lossStreak >= cfg.badStreak) {
      career.lastBoardCall = matchNo;
      var press = career.board === "rigorosa" ? "Precisamos de uma reação imediata." : "Confiamos no seu trabalho, mas queremos ver evolução.";
      TM.notify.push(career, { icon: "☎️", title: "Chamada da diretoria", boardCall: true,
        text: boardLabel(career) + " chamou para conversar após " + lossStreak + " derrotas seguidas. " + press });
      return;
    }
    // boa fase → elogio / meta de bônus
    if (winStreak >= cfg.goodStreak) {
      career.lastBoardCall = matchNo;
      TM.notify.push(career, { icon: "🤝", title: "Chamada da diretoria", boardCall: true,
        text: boardLabel(career) + " parabeniza pela sequência de " + winStreak + " vitórias. Mantenha o ritmo e o clube fará novos investimentos." });
      return;
    }
  }

  function maybeIncomingOffer(career) {
    // jogadores na lista de transferências recebem MUITO mais propostas
    var listed = (career.transferList || []).filter(function (id) { return career.roster.indexOf(id) >= 0 && !(career.loanedIn && career.loanedIn[id]); });
    var wantListed = listed.length > 0 && Math.random() < 0.6;
    if (!wantListed && Math.random() > 0.30) return;
    var target;
    if (wantListed) {
      target = resolvePlayer(career, listed[Math.floor(Math.random() * listed.length)]);
    } else {
      // não recebe propostas por jogadores que eu mesmo peguei emprestado
      var mine = rosterPlayers(career).filter(function (p) { return p.overall >= 66 && !(career.loanedIn && career.loanedIn[p.id]); }).sort(function (a, b) { return b.overall - a.overall; });
      if (!mine.length) return;
      target = mine[Math.floor(Math.random() * Math.min(8, mine.length))];
    }
    if (!target) return;
    var val = TM.data.marketValue(target), mult = career.money ? career.money.mult : 1;
    var kind = Math.random(); // 0.55 compra · 0.28 empréstimo · 0.17 empréstimo c/ opção
    if (kind < 0.55) {
      var buyers = TM.data.world().clubs.filter(function (cl) { return cl.id !== career.teamId && TM.data.clubRating(cl.id) >= target.overall - 2; });
      if (!buyers.length) return;
      var buyer = buyers[Math.floor(Math.random() * buyers.length)];
      var fee = Math.round(val * (0.8 + Math.random() * 0.6) * mult);
      TM.notify.push(career, {
        icon: "📨", title: "Proposta recebida",
        text: buyer.name + " ofereceu " + fmtMoney(career, fee) + " por " + target.name + ".",
        offer: { playerId: target.id, buyerId: buyer.id, fee: fee }
      });
    } else {
      // clubes de porte parecido ou menor pedem por empréstimo
      var lbuyers = TM.data.world().clubs.filter(function (cl) {
        var r = TM.data.clubRating(cl.id);
        return cl.id !== career.teamId && r >= target.overall - 12 && r <= target.overall + 4;
      });
      if (!lbuyers.length) return;
      var lb = lbuyers[Math.floor(Math.random() * lbuyers.length)];
      var loanFee = Math.round(Math.max(1, val * 0.08) * mult);
      var withOption = kind >= 0.83;
      var termYears = [0.5, 1, 1, 1.5][Math.floor(Math.random() * 4)];
      var buyPrice = withOption ? Math.round(val * (1.1 + Math.random() * 0.4) * mult) : 0;
      TM.notify.push(career, {
        icon: withOption ? "🔁" : "🔄",
        title: withOption ? "Empréstimo c/ opção" : "Pedido de empréstimo",
        text: lb.name + " quer " + target.name + " por empréstimo" + (withOption ? " com opção de compra de " + fmtMoney(career, buyPrice) : "") + " (" + loanTermLabel(termYears) + ", taxa " + fmtMoney(career, loanFee) + ").",
        loanOffer: { playerId: target.id, buyerId: lb.id, loanFee: loanFee, buyOption: withOption, buyPrice: buyPrice, termYears: termYears }
      });
    }
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
      career.finc = career.finc || { prizeM: 0, spentM: 0, soldM: 0 }; career.finc.soldM += off.fee;
      logDeal(career, { type: "out", kind: "sale", pid: off.playerId, name: player.name, pos: player.pos, ov: player.overall, fee: off.fee, other: TM.data.club(off.buyerId).name });
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

  // teto que o clube comprador está disposto a pagar (quanto mais forte/rico, mais paga)
  function buyerCeiling(career, note) {
    var off = note.offer;
    var target = resolvePlayer(career, off.playerId);
    var mult = career.money ? career.money.mult : 1;
    var val = Math.round(TM.data.marketValue(target) * mult);
    var rating = TM.data.clubRating(off.buyerId);
    var richness = 1.12 + Math.max(0, rating - 70) * 0.02; // 70→1.12, 90→1.52
    return Math.round(Math.max(off.fee, val) * richness);
  }
  // contraproposta numa proposta de compra recebida. demand em milhões (moeda da carreira)
  function counterIncomingOffer(career, note, demand) {
    var off = note.offer;
    var target = resolvePlayer(career, off.playerId);
    var buyer = TM.data.club(off.buyerId);
    if (off.finalOffer) return { status: "final", fee: off.fee, text: buyer.name + " já fez a proposta final." };
    if (demand <= off.fee) return { status: "aceita", fee: off.fee, text: "Valor já coberto pela proposta atual." };
    var ceil = buyerCeiling(career, note);
    if (demand <= ceil) {
      off.fee = demand;
      note.text = buyer.name + " aceitou pagar " + fmtMoney(career, demand) + " por " + target.name + ".";
      return { status: "aceita", fee: demand, text: buyer.name + " topou " + fmtMoney(career, demand) + "!" };
    }
    if (demand <= ceil * 1.15) {
      var meet = Math.round((demand + ceil) / 2);
      off.fee = meet; off.finalOffer = true;
      note.text = buyer.name + " subiu para " + fmtMoney(career, meet) + " por " + target.name + " (proposta final).";
      return { status: "final", fee: meet, text: buyer.name + " chegou até " + fmtMoney(career, meet) + " — é a proposta final." };
    }
    // exagero: pode fazer o clube desistir
    if (Math.random() < 0.5) {
      TM.notify.remove(career, note.id);
      return { status: "retirada", text: buyer.name + " achou o pedido abusivo e retirou o interesse." };
    }
    return { status: "recusada", fee: off.fee, text: buyer.name + " recusou e manteve a proposta de " + fmtMoney(career, off.fee) + "." };
  }

  /* ---------- empréstimos ---------- */
  // contraproposta num pedido de empréstimo recebido
  function counterLoanOffer(career, note, want) {
    // want: { loanFee, askOption (bool), buyPrice }
    var lo = note.loanOffer;
    var target = resolvePlayer(career, lo.playerId);
    var buyer = TM.data.club(lo.buyerId);
    var mult = career.money ? career.money.mult : 1;
    var val = Math.round(TM.data.marketValue(target) * mult);
    var rating = TM.data.clubRating(lo.buyerId);
    if (lo.finalOffer) return { status: "final", text: buyer.name + " já fez a proposta final." };
    var maxLoanFee = Math.round(Math.max(lo.loanFee, val * 0.15) * (1 + Math.max(0, rating - 70) * 0.015));
    var changed = false, refused = false;
    // taxa de empréstimo
    if (want.loanFee != null && want.loanFee > lo.loanFee) {
      if (want.loanFee <= maxLoanFee) { lo.loanFee = want.loanFee; changed = true; }
      else { refused = true; }
    }
    // exigir opção de compra
    if (!refused && want.askOption && !lo.buyOption) {
      if (Math.random() < 0.6) {
        lo.buyOption = true;
        lo.buyPrice = Math.max(want.buyPrice || 0, Math.round(val * 1.15));
        changed = true;
      } else { refused = true; }
    } else if (!refused && want.askOption && lo.buyOption && want.buyPrice && want.buyPrice > lo.buyPrice) {
      // pedir um preço de compra maior
      if (want.buyPrice <= Math.round(val * 1.6)) { lo.buyPrice = want.buyPrice; changed = true; }
      else { refused = true; }
    }
    // atualiza o texto do aviso
    lo && (note.text = buyer.name + " quer " + target.name + " por empréstimo" + (lo.buyOption ? " com opção de compra de " + fmtMoney(career, lo.buyPrice) : "") + " (" + loanTermLabel(lo.termYears) + ", taxa " + fmtMoney(career, lo.loanFee) + ").");
    if (refused) { lo.finalOffer = true; return { status: "final", text: buyer.name + " não aceitou melhorar mais e fez a proposta final." }; }
    if (changed) return { status: "aceita", text: buyer.name + " aceitou os novos termos." };
    return { status: "aceita", text: "Termos mantidos." };
  }

  function fmtMoney(career, v) {
    var sym = (career.money && career.money.sym) || "€", sign = v < 0 ? "-" : "", n = Math.abs(v);
    if (n >= 1) { var m = n < 10 ? Math.round(n * 10) / 10 : Math.round(n); return sign + sym + " " + m + "M"; }
    var k = Math.round(n * 1000);
    return k <= 0 ? sym + " 0" : sign + sym + " " + k + " mil";
  }
  function loanTermLabel(y) { return y === 0.5 ? "6 meses" : y === 1 ? "1 ano" : y === 1.5 ? "1 ano e meio" : "2 anos"; }

  // postura do clube dono quanto a emprestar/vender — estável por jogador (hash do id)
  function clubStance(p) {
    var squad = TM.data.clubPlayers(p.clubId).slice().sort(function (a, b) { return b.overall - a.overall; });
    var rank = 0; for (var i = 0; i < squad.length; i++) { if (squad[i].id === p.id) { rank = i; break; } }
    var isKey = rank < 5, isFringe = rank >= 13;
    var young = p.age <= 21, prime = p.age >= 23 && p.age <= 31;
    var h = 2166136261, s = String(p.id);
    for (var j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = (h * 16777619) >>> 0; }
    var r1 = (h & 1023) / 1023, r2 = ((h >>> 10) & 1023) / 1023, r3 = ((h >>> 20) & 1023) / 1023;
    var loanBase = isKey ? 0.06 : young ? 0.55 : isFringe ? 0.62 : prime ? 0.16 : 0.34;
    var willLoan = r1 < loanBase;
    var willBuyOption = willLoan && !isKey && (young ? r2 < 0.55 : r2 < 0.32);
    var willSell = r3 < (isKey ? 0.3 : isFringe ? 0.9 : 0.68);
    var priceMult = isKey ? 1.5 : rank < 9 ? 1.22 : 1.08;
    return { willLoan: willLoan, willBuyOption: willBuyOption, willSell: willSell, isKey: isKey, isFringe: isFringe, rank: rank, priceMult: priceMult };
  }

  // empréstimo de entrada (jogador que EU pego emprestado)
  function signLoan(career, p, opts) {
    career.loanedIn = career.loanedIn || {};
    if (career.roster.indexOf(p.id) < 0) career.roster.push(p.id);
    career.signedFrom[p.id] = opts.parentClubId;
    career.loanedIn[p.id] = {
      parentClubId: opts.parentClubId, buyOption: !!opts.buyOption, buyPrice: opts.buyPrice || 0,
      termYears: opts.termYears || 1, seasonsLeft: Math.max(1, Math.round(opts.termYears || 1)), wage: opts.wage || 0
    };
    career.budget -= (opts.loanFee || 0);
    career.finc = career.finc || { prizeM: 0, spentM: 0, soldM: 0 }; career.finc.spentM += (opts.loanFee || 0);
    logDeal(career, { type: "in", kind: opts.buyOption ? "loanBuy" : "loan", pid: p.id, name: p.name, pos: p.pos, ov: p.overall, fee: opts.loanFee || 0, other: TM.data.club(opts.parentClubId) ? TM.data.club(opts.parentClubId).name : "" });
    syncLineup(career);
  }
  function returnLoanIn(career, pid) {
    career.roster = (career.roster || []).filter(function (id) { return id !== pid; });
    delete career.signedFrom[pid];
    if (career.loanedIn) delete career.loanedIn[pid];
    if (career.lineup) {
      career.lineup.starters = career.lineup.starters.filter(function (id) { return id !== pid; });
      career.lineup.bench = career.lineup.bench.filter(function (id) { return id !== pid; });
    }
    syncLineup(career);
  }
  function exerciseLoanBuy(career, pid, price) {
    career.budget -= price;
    career.finc = career.finc || { prizeM: 0, spentM: 0, soldM: 0 }; career.finc.spentM += (price || 0);
    var bp = resolvePlayer(career, pid);
    if (bp) logDeal(career, { type: "in", kind: "buy", pid: pid, name: bp.name, pos: bp.pos, ov: bp.overall, fee: price || 0, other: "opção de compra" });
    if (career.loanedIn) delete career.loanedIn[pid]; // deixa de ser empréstimo, vira contratação
    syncLineup(career);
  }

  // empréstimo de saída (jogador MEU que eu cedo a outro clube)
  function loanOutPlayer(career, off) {
    career.loanedOut = career.loanedOut || {};
    career.budget += (off.loanFee || 0);
    career.roster = career.roster.filter(function (id) { return id !== off.playerId; });
    if (career.lineup) {
      career.lineup.starters = career.lineup.starters.filter(function (id) { return id !== off.playerId; });
      career.lineup.bench = career.lineup.bench.filter(function (id) { return id !== off.playerId; });
    }
    career.loanedOut[off.playerId] = {
      toClubId: off.buyerId, buyOption: !!off.buyOption, buyPrice: off.buyPrice || 0,
      seasonsLeft: Math.max(1, Math.round(off.termYears || 1))
    };
    syncLineup(career);
  }
  function resolveLoanOffer(career, note, accept) {
    var lo = note.loanOffer;
    var player = resolvePlayer(career, lo.playerId);
    TM.notify.remove(career, note.id);
    if (!accept) {
      TM.notify.push(career, { icon: "🚫", title: "Empréstimo recusado", text: "Você recusou emprestar " + (player ? player.name : "o jogador") + "." });
      return "recusada";
    }
    loanOutPlayer(career, lo);
    var club = TM.data.club(lo.buyerId);
    TM.notify.push(career, { icon: "🤝", title: "Empréstimo fechado", text: (player ? player.name : "Jogador") + " foi emprestado ao " + (club ? club.name : "clube") + (lo.buyOption ? " com opção de compra" : "") + "." });
    return "emprestado";
  }

  // processa expiração de empréstimos ao virar a temporada
  function processLoans(career) {
    if (career.loanedIn) Object.keys(career.loanedIn).forEach(function (pid) {
      var ln = career.loanedIn[pid]; ln.seasonsLeft--;
      if (ln.seasonsLeft > 0) return;
      var p = TM.data.player(pid), nm = p ? p.name : "Jogador";
      if (ln.buyOption) {
        TM.notify.push(career, { icon: "🔁", title: "Opção de compra",
          text: "O empréstimo de " + nm + " terminou. Exercer a opção de compra por " + fmtMoney(career, ln.buyPrice) + "?",
          buyOption: { pid: pid, price: ln.buyPrice } });
      } else {
        var parent = TM.data.club(ln.parentClubId);
        returnLoanIn(career, pid);
        TM.notify.push(career, { icon: "↩️", title: "Fim de empréstimo", text: nm + " retornou ao " + (parent ? parent.name : "clube de origem") + "." });
      }
    });
    if (career.loanedOut) Object.keys(career.loanedOut).forEach(function (pid) {
      var lo = career.loanedOut[pid]; lo.seasonsLeft--;
      if (lo.seasonsLeft > 0) return;
      var p = TM.data.player(pid), nm = p ? p.name : "Jogador", club = TM.data.club(lo.toClubId);
      if (lo.buyOption && Math.random() < 0.55) {
        career.budget += lo.buyPrice;
        TM.notify.push(career, { icon: "💰", title: "Opção exercida", text: (club ? club.name : "O clube") + " exerceu a opção de compra de " + nm + " por " + fmtMoney(career, lo.buyPrice) + "." });
        delete career.loanedOut[pid];
      } else {
        if (career.roster.indexOf(pid) < 0) career.roster.push(pid);
        delete career.loanedOut[pid];
        syncLineup(career);
        TM.notify.push(career, { icon: "↩️", title: "Retorno de empréstimo", text: nm + " retornou do empréstimo ao " + (club ? club.name : "clube") + "." });
      }
    });
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
    syncLineup(career);
    return true;
  }

  // garante que TODO jogador do elenco apareça na escalação (titular ou reserva)
  // e remove da escalação quem não está mais no elenco. Corrige contratados sumidos.
  function syncLineup(career) {
    if (!career.roster) return career.lineup;
    if (!career.lineup) { career.lineup = buildLineup(rosterPlayers(career), "4-4-2"); return career.lineup; }
    var lu = career.lineup;
    if (!lu.starters) lu.starters = [];
    if (!lu.bench) lu.bench = [];
    if (!lu.excluded) lu.excluded = [];   // "não relacionados": no elenco, mas fora da partida
    var inRoster = {}; career.roster.forEach(function (id) { inRoster[id] = true; });
    // remove da escalação quem saiu do elenco
    lu.starters = lu.starters.filter(function (id) { return inRoster[id]; });
    lu.bench = lu.bench.filter(function (id) { return inRoster[id]; });
    lu.excluded = lu.excluded.filter(function (id) { return inRoster[id] && lu.starters.indexOf(id) < 0; });
    var placed = {}; lu.starters.forEach(function (id) { placed[id] = true; }); lu.bench.forEach(function (id) { placed[id] = true; }); lu.excluded.forEach(function (id) { placed[id] = true; });
    // completa os 11 titulares puxando do banco, se algum saiu (e, em último caso, dos não relacionados)
    while (lu.starters.length < 11 && lu.bench.length) { lu.starters.push(lu.bench.shift()); }
    while (lu.starters.length < 11 && lu.excluded.length) { lu.starters.push(lu.excluded.shift()); }
    // adiciona ao banco qualquer jogador do elenco que ainda não esteja escalado (ex.: contratados)
    career.roster.forEach(function (id) { if (!placed[id]) { lu.bench.push(id); placed[id] = true; } });
    // ordena o banco por overall (melhores primeiro)
    lu.bench.sort(function (a, b) { var pa = resolvePlayer(career, a), pb = resolvePlayer(career, b); return (pb ? pb.overall : 0) - (pa ? pa.overall : 0); });
    return lu;
  }

  /* ---------- metas da diretoria (clube) ---------- */
  function clubRankInLeague(clubId) {
    var lg = TM.data.club(clubId).leagueId;
    var ranked = TM.data.league(lg).clubIds.slice().sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
    return ranked.indexOf(clubId) + 1;
  }
  function generateObjective(clubId) {
    var rank = clubRankInLeague(clubId);
    if (rank <= 2) return { desc: "Ser campeão ou vice da liga", maxPos: 2 };
    if (rank <= 6) return { desc: "Terminar entre os 6 primeiros", maxPos: 6 };
    if (rank <= 12) return { desc: "Terminar na primeira metade (top 9)", maxPos: 9 };
    return { desc: "Não ser rebaixado (fora dos 4 últimos)", maxPos: 14 };
  }
  function currentPosition(career) {
    var st = standings(career.comps.league.table);
    return st.findIndex(function (r) { return r.id === career.teamId; }) + 1;
  }
  function evaluateObjective(career) {
    var pos = currentPosition(career);
    return { met: pos <= career.objective.maxPos, pos: pos, target: career.objective.maxPos, desc: career.objective.desc };
  }

  /* ---------- comando de seleção (junto com o clube) ---------- */
  function natRating(natId) { var sq = TM.data.nationSquad(natId).slice(0, 11); return Math.round(sq.reduce(function (s, p) { return s + p.overall; }, 0) / (sq.length || 1)); }

  /* ===== Eliminatórias: tabela de pontos por confederação ===== */
  // round-robin (método do círculo); devolve lista de rodadas [[a,b],...] (bye = null)
  function confedSchedule(ids) {
    var arr = ids.slice();
    if (arr.length % 2 === 1) arr.push(null); // folga
    var n = arr.length, rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var rd = [];
      for (var i = 0; i < n / 2; i++) {
        var a = arr[i], b = arr[n - 1 - i];
        if (a != null && b != null) rd.push([a, b]);
      }
      rounds.push(rd);
      arr.splice(1, 0, arr.pop()); // rotaciona mantendo o 1º fixo
    }
    return rounds;
  }
  function emptyQualiRow(id) { return { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }
  // resultado leve (sem simular partida cheia) p/ os jogos entre seleções da IA
  function simQuali(aId, bId) {
    var ra = natRating(aId), rb = natRating(bId), diff = (ra - rb) / 6;
    var ea = Math.max(0.2, 1.35 + diff), eb = Math.max(0.2, 1.35 - diff);
    function pois(l) { var L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
    return [Math.min(6, pois(ea)), Math.min(6, pois(eb))];
  }
  function applyQualiRow(table, a, b, ga, gb) {
    var A = table[a], B = table[b]; if (!A || !B) return;
    A.p++; B.p++; A.gf += ga; A.ga += gb; B.gf += gb; B.ga += ga;
    if (ga > gb) { A.w++; B.l++; A.pts += 3; } else if (ga < gb) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
  }
  function qualiStandings(table) {
    return Object.keys(table).map(function (k) { return table[k]; })
      .sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || natRating(b.id) - natRating(a.id); });
  }
  // garante a estrutura das eliminatórias p/ o ciclo atual (reinicia a cada nova Copa)
  function ensureQuali(career) {
    if (!career.nation) return null;
    var copa = targetCopaSeason(career.season);
    var confed = confedOf(career.nation.id);
    if (career.quali && career.quali.copa === copa && career.quali.confed === confed) return career.quali;
    var ids = natsInConfed(confed);
    var table = {}; ids.forEach(function (id) { table[id] = emptyQualiRow(id); });
    career.quali = { copa: copa, confed: confed, table: table, sched: confedSchedule(ids), ptr: 0 };
    return career.quali;
  }
  // gera as 4 janelas de eliminatórias da temporada (cada janela = 1 rodada)
  function genNationWindows(natId, career) {
    var q = ensureQuali(career);
    var days = [28, 66, 104, 142];
    var windows = [];
    for (var i = 0; i < days.length; i++) {
      if (!q.sched.length) break;
      var round = q.sched[q.ptr % q.sched.length]; q.ptr++;
      // acha o adversário do usuário nesta rodada (se estiver de folga, escolhe outro par)
      var oppId = null, userPair = null;
      for (var j = 0; j < round.length; j++) {
        if (round[j][0] === natId) { oppId = round[j][1]; userPair = j; break; }
        if (round[j][1] === natId) { oppId = round[j][0]; userPair = j; break; }
      }
      if (oppId == null) {
        // usuário de folga nesta rodada: joga um amistoso-eliminatório contra o líder livre
        var others = natsInConfed(q.confed).filter(function (x) { return x !== natId; });
        oppId = others[Math.floor(Math.random() * others.length)];
      }
      var fd = days[i];
      windows.push({ friendlyDay: fd, openDay: fd - 14, deadlineDay: fd - 5, oppId: oppId, convoked: false, played: false, hs: 0, as: 0, round: round, userPair: userPair });
    }
    return windows;
  }
  // aplica o resultado do usuário + simula o resto da rodada na tabela
  function applyQualiResult(career, w) {
    var q = career.quali; if (!q || !w) return;
    var natId = career.nation.id;
    // jogo do usuário
    if (q.table[natId] && q.table[w.oppId]) applyQualiRow(q.table, natId, w.oppId, w.hs, w.as);
    // demais jogos da rodada (IA)
    (w.round || []).forEach(function (pair) {
      if (pair[0] === natId || pair[1] === natId) return;
      var r = simQuali(pair[0], pair[1]);
      applyQualiRow(q.table, pair[0], pair[1], r[0], r[1]);
    });
  }

  function buildNation(natId) {
    var nat = TM.data.nation(natId);
    var squad = TM.data.nationSquad(natId).map(function (p) { return p.id; }); // 23 melhores
    var players = squad.map(TM.data.player);
    return { id: natId, name: nat.name, squad: squad, lineup: buildLineup(players, "4-4-2"), tactic: "equilibrado", windows: [], wc: null, fired: false };
  }
  // seleções classificadas para a Copa (32): usa a tabela das eliminatórias da confederação
  // do usuário (real, acumulada) e o rating para as demais confederações.
  function qualifiedTeams(career) {
    var userConfed = career.quali && career.quali.copa === career.season ? career.quali.confed : confedOf(career.nation.id);
    var out = [];
    Object.keys(CONFED_SLOTS).forEach(function (code) {
      var slots = CONFED_SLOTS[code], ranked;
      if (code === userConfed && career.quali && career.quali.copa === career.season) {
        ranked = qualiStandings(career.quali.table).map(function (r) { return r.id; });
      } else {
        ranked = natsInConfed(code).sort(function (a, b) { return natRating(b) - natRating(a); });
      }
      out = out.concat(ranked.slice(0, slots));
    });
    return out;
  }
  function userQualified(career) {
    if (!career.quali || career.quali.copa !== career.season) return true; // 1ª Copa sem eliminatórias: entra
    var ranked = qualiStandings(career.quali.table).map(function (r) { return r.id; });
    var slots = CONFED_SLOTS[career.quali.confed] || 4;
    return ranked.slice(0, slots).indexOf(career.nation.id) >= 0;
  }
  // Copa do Mundo: 32 seleções classificadas, 8 grupos de 4, passam 2 → oitavas
  function buildWorldCup(natId, teams) {
    var field = (teams && teams.length ? teams.slice() : TM.data.world().nations.map(function (n) { return n.id; })).slice(0, WC_TEAMS);
    if (field.indexOf(natId) < 0) { field[field.length - 1] = natId; } // garante a seleção do usuário
    return { tour: TM.tournament.create(field, { groups: 8, perGroup: 4, advance: 2, bestThirds: 0, userId: natId }),
      openDay: 100, deadlineDay: 112, matchDays: [116, 121, 126, 132, 138, 144, 150], wcMatchNo: 0, convoked: false };
  }
  // define o "calendário" da seleção na temporada: Copa do Mundo (ano da Copa) ou eliminatórias
  function setupNationSeason(career) {
    if (!career.nation) return;
    career.nation.eliminated = false;
    if (career.season % 4 === 1) {
      // ano da Copa: só disputa se tiver se classificado nas eliminatórias
      if (userQualified(career)) {
        career.nation.wc = buildWorldCup(career.nation.id, qualifiedTeams(career));
        career.nation.windows = [];
      } else {
        career.nation.wc = null; career.nation.windows = []; career.nation.eliminated = true;
        TM.notify.push(career, { icon: "😞", title: "Fora da Copa do Mundo", text: career.nation.name + " não se classificou nas Eliminatórias. Nesta temporada não há Copa para a seleção — foco nas próximas Eliminatórias." });
      }
    } else {
      career.nation.wc = null; career.nation.windows = genNationWindows(career.nation.id, career);
    }
  }
  function nationNextWindow(career) {
    if (!career.nation) return null;
    for (var i = 0; i < career.nation.windows.length; i++) if (!career.nation.windows[i].played) return career.nation.windows[i];
    return null;
  }
  function checkNationDeadlines(career) {
    if (!career.nation || career.nation.fired) return;
    var wc = career.nation.wc;
    if (wc) {
      if (!wc.convoked && career.currentDay > wc.deadlineDay) {
        var nmc = career.nation.name;
        career.nation = null;
        TM.notify.push(career, { icon: "🚫", title: "Demitido da seleção", text: "Você não convocou " + nmc + " para a Copa do Mundo a tempo. Perdeu o cargo na seleção e segue apenas no clube." });
      }
      return;
    }
    var w = nationNextWindow(career);
    if (w && !w.convoked && career.currentDay > w.deadlineDay) {
      var nm = career.nation.name;
      career.nation = null;
      TM.notify.push(career, { icon: "🚫", title: "Demitido da seleção", text: "Você não enviou a convocação de " + nm + " a tempo. Perdeu o cargo na seleção e segue apenas no clube." });
    }
  }
  // contexto do torneio da Copa do Mundo: sim entre duas seleções + rating
  function wcTeam(career, natId) {
    return natId === career.nation.id ? nationTeam(career) : oppNationTeam(natId);
  }
  function wcContext(career) {
    return {
      sim: function (aId, bId) { return TM.engine.simulate(wcTeam(career, aId), wcTeam(career, bId), { realism: realism(), neutral: true }); },
      rating: function (id) { return natRating(id); }
    };
  }
  // avança a Copa do Mundo simulando todos os jogos até o próximo da seleção do usuário (ou fim)
  function advanceWorldCup(career) {
    var wc = career.nation.wc;
    return TM.tournament.nextUserMatch(wc.tour, wcContext(career));
  }
  function applyWorldCupResult(career, hs, as) {
    var wc = career.nation.wc;
    TM.tournament.applyUserMatch(wc.tour, hs, as, wcContext(career));
    wc.wcMatchNo++;
  }
  // rótulo da próxima partida da Copa (grupo/mata-mata) sem mutar o torneio
  function wcRoundLabel(career, m) {
    if (!m || m.end) return "";
    if (m.phase === "group") return "Fase de Grupos · Rodada " + (m.groupRound + 1);
    return TM.tournament.koTitle(m.round);
  }
  // status resumido da seleção para o botão de troca no hub (não muta estado)
  function nationPending(career) {
    if (!career.nation) return null;
    var n = career.nation;
    if (n.wc) {
      var wc = n.wc;
      if (!wc.convoked) return { wc: true, needConvoke: career.currentDay >= wc.openDay, readyMatch: false };
      var done = TM.tournament.isDone(wc.tour), alive = wc.tour.aliveUser, md = wc.matchDays[wc.wcMatchNo];
      return { wc: true, needConvoke: false, readyMatch: !done && alive && md != null && career.currentDay >= md };
    }
    var w = nationNextWindow(career);
    return { wc: false,
      needConvoke: !!(w && !w.convoked && career.currentDay >= w.openDay),
      readyMatch: !!(w && w.convoked && !w.played && career.currentDay >= w.friendlyDay) };
  }
  function nationSquadPlayers(career) { return career.nation.squad.map(TM.data.player).filter(Boolean); }
  function nationTeam(career) {
    var nat = TM.data.nation(career.nation.id), lu = career.nation.lineup;
    var xi = lu.starters.map(TM.data.player).filter(Boolean);
    var inxi = {}; xi.forEach(function (p) { inxi[p.id] = 1; });
    var rest = career.nation.squad.map(TM.data.player).filter(function (p) { return p && !inxi[p.id]; });
    return { id: nat.id, name: nat.name, players: xi.concat(rest), nation: nat };
  }
  function oppNationTeam(natId) { var n = TM.data.nation(natId); return { id: n.id, name: n.name, players: TM.data.nationSquad(natId), nation: n }; }

  // convite de seleção (se foi bem e ainda não comanda nenhuma)
  function maybeNationInvite(career) {
    if (career.nation) return;
    var last = career.honours[career.honours.length - 1];
    if (!last) return;
    var good = last.leagueChampion || last.cupChampion || last.contChampion || last.leaguePos <= 3;
    if (!good || Math.random() > 0.6) return;
    var nat = TM.data.nationByName(TM.data.league(career.leagueId).nation);
    if (!nat) return;
    TM.notify.push(career, { icon: "🌍", title: "Convite de seleção", text: "A seleção de " + nat.name + " quer você como treinador! Responda em Avisos.", nationInvite: nat.id });
  }

  // evolução de 1 jogador por temporada, conforme a idade:
  // 14-29 ainda sobe rumo ao potencial | 30-33 quase não mexe (só cai devagar) | 34+ só cai
  function evoFactor() {
    try { var r = TM.storage.settings().evoRate; return r === "rapida" ? 1.4 : r === "demorada" ? 0.65 : 1; } catch (e) { return 1; }
  }
  function ageWorldPlayer(p) {
    p.age = (p.age || 25) + 1;
    var pot = p.potential || p.overall, a = p.age;
    if (a <= 29) {
      if (p.overall < pot) {
        var ch = a <= 20 ? 0.85 : a <= 23 ? 0.65 : a <= 26 ? 0.45 : 0.28;
        ch = Math.max(0.06, Math.min(0.95, ch * evoFactor()));   // taxa de evolução (config), sem exageros
        if (Math.random() < ch) p.overall = Math.min(pot, p.overall + 1);
        // evolução rápida pode dar +2 num salto para os bem jovens (raro, limitado)
        if (a <= 19 && evoFactor() > 1.2 && Math.random() < 0.10) p.overall = Math.min(pot, p.overall + 1);
      }
    } else if (a <= 33) {
      if (Math.random() < 0.25) p.overall = Math.max(45, p.overall - 1);
    } else {
      p.overall = Math.max(45, p.overall - (a >= 37 ? 2 : 1));
    }
  }
  // envelhece TODO o mundo uma temporada e guarda o estado na carreira (persiste no save)
  function ageWorld(career) {
    var pb = TM.data.world().playersById;
    career.worldEvo = career.worldEvo || {};
    Object.keys(pb).forEach(function (id) {
      ageWorldPlayer(pb[id]);
      career.worldEvo[id] = { age: pb[id].age, overall: pb[id].overall };
    });
  }
  // reaplica o envelhecimento guardado (ao recarregar a carreira, o mundo é regerado do zero)
  function applyWorldEvo(career) {
    if (!career || !career.worldEvo) return;
    var pb = TM.data.world().playersById;
    Object.keys(career.worldEvo).forEach(function (id) {
      var p = pb[id], e = career.worldEvo[id];
      if (p) { p.age = e.age; p.overall = e.overall; }
    });
  }

  /* ---------- REGENERAÇÃO: aposentadorias + newgens (joias com potencial oculto) ---------- */
  function makeNewgen(career, clubId, pos) {
    var club = TM.data.club(clubId);
    var culture = TM.data.cultureOfLeague(club.leagueId);
    var natName = TM.data.league(club.leagueId).nation;
    var nat = TM.data.nationByName(natName) || TM.data.world().nations[0];
    career.newgenSeq = (career.newgenSeq || 0) + 1;
    var id = "ng" + (career.season || 1) + "-" + career.newgenSeq + "-" + clubId;
    var age = 16 + Math.floor(Math.random() * 3);   // 16-18
    var ov = 46 + Math.floor(Math.random() * 15);   // 46-60
    var jewel = Math.random() < 0.07;               // ~7% joia rara
    var pot = jewel ? Math.min(94, ov + 24 + Math.floor(Math.random() * 11))
                    : Math.min(87, ov + 6 + Math.floor(Math.random() * 20));
    return {
      id: id, name: TM.data.randomName(culture), clubId: clubId, pos: pos, pos2: TM.data.randomSpecificPos(pos),
      age: age, overall: ov, potential: pot, attrs: youthAttrs(ov, pos),
      nationId: nat.id, nationName: nat.name, height: 168 + Math.floor(Math.random() * 25),
      weight: 60 + Math.floor(Math.random() * 24), newgen: true, hiddenPot: true, jewel: jewel
    };
  }
  // no fim da temporada: veteranos se aposentam e um garoto da base surge no lugar (mundo estável)
  function retireAndRegen(career) {
    var W = TM.data.world(), pb = W.playersById;
    career.retired = career.retired || {};
    career.newgens = career.newgens || {};
    var userRetired = [], stars = [];
    Object.keys(pb).forEach(function (id) {
      if (career.retired[id]) return;
      var p = pb[id]; if (!p) return;
      var a = p.age || 25;
      var chance = a >= 40 ? 1 : a >= 38 ? 0.6 : a >= 36 ? 0.32 : a >= 34 ? 0.11 : 0;
      if (p.pos === "GK") chance *= 0.7;   // goleiros duram mais
      if (chance <= 0 || Math.random() >= chance) return;
      career.retired[id] = true;
      if (career.worldEvo) delete career.worldEvo[id];
      var clubId = p.clubId, cl = clubId && TM.data.club(clubId);
      if (cl) {
        var ng = makeNewgen(career, clubId, p.pos || "MF");
        career.newgens[ng.id] = ng; pb[ng.id] = ng;
        if (cl.playerIds.indexOf(ng.id) < 0) cl.playerIds.push(ng.id);
        cl.playerIds = cl.playerIds.filter(function (x) { return x !== id; });
      }
      delete pb[id];
      if (career.roster.indexOf(id) >= 0) { career.roster = career.roster.filter(function (x) { return x !== id; }); userRetired.push(p.name); }
      else if ((p.overall || 0) >= 84) stars.push(p);
    });
    syncLineup(career);
    if (userRetired.length) {
      TM.notify.push(career, { icon: "👋", title: "Aposentadoria no elenco", news: true,
        text: userRetired.join(", ") + (userRetired.length > 1 ? " penduraram as chuteiras — garotos da base assumem as vagas." : " pendurou as chuteiras. Um garoto da base assume a vaga.") });
    }
    stars.sort(function (a, b) { return b.overall - a.overall; });
    stars.slice(0, 4).forEach(function (p) {
      TM.notify.push(career, { icon: "🎖️", title: "Craque se aposenta", news: true,
        text: p.name + " (" + TM.data.posLabel(p) + ", overall " + p.overall + ") encerrou a carreira aos " + p.age + " anos." });
    });
  }
  // ao recarregar: remove aposentados do mundo regenerado e reinjeta os newgens
  function applyRegen(career) {
    if (!career) return;
    var pb = TM.data.world().playersById;
    if (career.retired) Object.keys(career.retired).forEach(function (id) {
      var p = pb[id];
      if (p && p.clubId && TM.data.club(p.clubId)) { var cl = TM.data.club(p.clubId); cl.playerIds = cl.playerIds.filter(function (x) { return x !== id; }); }
      delete pb[id];
    });
    if (career.newgens) Object.keys(career.newgens).forEach(function (id) {
      var ng = career.newgens[id]; if (!ng) return;
      pb[id] = ng;
      var cl = ng.clubId && TM.data.club(ng.clubId);
      if (cl && cl.playerIds.indexOf(id) < 0) cl.playerIds.push(id);
    });
  }

  /* ---------- janelas de transferências ---------- */
  // offset (em dias a partir de 10/ago) para uma data (mês 1-12, dia) dentro da temporada
  function offsetOfDate(career, month1, day) {
    for (var o = 0; o < 330; o++) { var dt = dateOf(career, o); if (dt.m === month1 && dt.d === day) return o; }
    return -1;
  }
  function buildWindows(career) {
    // verão: aberta desde o início (10/ago) até 01/out · inverno: 04/jan a 28/fev
    career.windows = [
      { name: "Janela de Verão", openDay: 0, closeDay: offsetOfDate(career, 10, 1), openedNotified: true, closedNotified: false },
      { name: "Janela de Inverno", openDay: offsetOfDate(career, 1, 4), closeDay: offsetOfDate(career, 2, 28), openedNotified: false, closedNotified: false }
    ];
  }
  function windowOpenNow(career) {
    var d = career.currentDay || 0;
    return (career.windows || []).some(function (w) { return d >= w.openDay && d < w.closeDay; });
  }
  function currentWindow(career) {
    var d = career.currentDay || 0;
    return (career.windows || []).filter(function (w) { return d >= w.openDay && d < w.closeDay; })[0] || null;
  }
  function nextWindowOpenDay(career) {
    var d = career.currentDay || 0, best = null;
    (career.windows || []).forEach(function (w) { if (w.openDay > d && (best == null || w.openDay < best)) best = w.openDay; });
    return best;
  }

  /* ---------- mover jogadores no mundo (transferências da IA) ---------- */
  function moveWorldPlayer(pid, toClubId) {
    var W = TM.data.world(); var p = W.playersById[pid]; if (!p) return false;
    var fromId = p.clubId; if (fromId === toClubId) return false;
    var oc = TM.data.club(fromId), nc = TM.data.club(toClubId);
    if (!nc) return false;
    if (oc && oc.playerIds) oc.playerIds = oc.playerIds.filter(function (x) { return x !== pid; });
    // se era agente livre, sai do mercado de livres (também ao reaplicar no recarregamento)
    if (p.freeAgent || fromId === "free") {
      if (W.freeAgents) W.freeAgents = W.freeAgents.filter(function (x) { return x !== pid; });
      p.freeAgent = false;
    }
    if (nc.playerIds.indexOf(pid) < 0) nc.playerIds.push(pid);
    p.clubId = toClubId;
    return true;
  }
  function executeWorldTransfer(career, pid, toClubId) {
    if (moveWorldPlayer(pid, toClubId)) { career.worldTransfers = career.worldTransfers || {}; career.worldTransfers[pid] = toClubId; return true; }
    return false;
  }
  function applyWorldTransfers(career) {
    if (!career || !career.worldTransfers) return;
    Object.keys(career.worldTransfers).forEach(function (pid) { moveWorldPlayer(pid, career.worldTransfers[pid]); });
  }
  // encontra um negócio plausível: comprador que pode pagar, vendedor que topa liberar (raramente um craque)
  // grupo de posição (GK/DF/MF/FW) e efetivo ideal por grupo — usado para contratação por necessidade
  var POS_TARGET = { GK: 3, DF: 8, MF: 8, FW: 5 };
  function posGroup(p) { var g = p.pos || "MF"; return (g === "GK" || g === "DF" || g === "MF" || g === "FW") ? g : "MF"; }
  // retorna a posição em que o clube está mais carente (poucos jogadores ou fracos), ou null
  function squadNeed(clubId) {
    var squad = TM.data.clubPlayers(clubId);
    var cnt = { GK: 0, DF: 0, MF: 0, FW: 0 }, best = { GK: 0, DF: 0, MF: 0, FW: 0 };
    squad.forEach(function (p) { var g = posGroup(p); cnt[g]++; if (p.overall > best[g]) best[g] = p.overall; });
    var clubRat = TM.data.clubRating(clubId), needs = [];
    ["GK", "DF", "MF", "FW"].forEach(function (g) {
      var deficit = POS_TARGET[g] - cnt[g];               // falta gente nesse setor?
      var weak = best[g] < clubRat - 3;                   // ou o melhor do setor é fraco pro nível do clube
      if (deficit > 0 || weak) needs.push({ g: g, score: deficit * 2 + (weak ? 2 : 0) });
    });
    if (!needs.length) return null;
    needs.sort(function (a, b) { return b.score - a.score; });
    return needs[0].g;
  }
  function findAiDeal(career) {
    var clubs = TM.data.world().clubs.filter(function (cl) { return cl.id !== career.teamId; });
    if (clubs.length < 4) return null;
    var buyer = clubs[Math.floor(Math.random() * clubs.length)];
    var buyerRating = TM.data.clubRating(buyer.id), buyerBudget = baseBudgetEur(buyerRating);
    var need = squadNeed(buyer.id);                        // posição carente do comprador
    for (var t = 0; t < 28; t++) {
      var sc = clubs[Math.floor(Math.random() * clubs.length)];
      if (sc.id === buyer.id) continue;
      var squad = TM.data.clubPlayers(sc.id);
      if (squad.length < 15) continue;
      var startIdx = Math.random() < 0.88 ? 2 : 0;         // na maioria das vezes preserva as 2 estrelas do clube
      var pool = squad.slice(startIdx).filter(function (p) {
        return career.roster.indexOf(p.id) < 0
          && !(career.loanedIn && career.loanedIn[p.id]) && !(career.loanedOut && career.loanedOut[p.id])
          && !(career.worldTransfers && career.worldTransfers[p.id]);
      });
      // contratação por necessidade: nas primeiras tentativas exige a posição carente do comprador
      if (need && t < 20) { var np = pool.filter(function (p) { return posGroup(p) === need; }); if (np.length) pool = np; else continue; }
      if (!pool.length) continue;
      var target = pool[Math.floor(Math.random() * pool.length)];
      var val = TM.data.marketValue(target), sellRating = TM.data.clubRating(sc.id);
      if (val > buyerBudget) continue;                      // comprador precisa ter caixa
      if (buyerRating < target.overall - 5) continue;       // clube fraco não atrai jogador melhor
      if (target.overall >= 80 && buyerRating < sellRating - 4) continue; // estrela não desce para clube bem pior
      // rivalidade: jogador dificilmente troca direto entre rivais (~92% das vezes recusa)
      if (rivalryOn() && TM.data.areRivals(sc.id, buyer.id) && Math.random() < 0.985) continue;
      return { pid: target.id, name: target.name, ov: target.overall, fromId: sc.id, fromName: sc.name, toId: buyer.id, toName: buyer.name, val: Math.round(val), need: need && posGroup(target) === need };
    }
    return null;
  }
  // CRISE FINANCEIRA de um clube da IA: é obrigado a vender seu craque para um clube rico
  function findFireSaleDeal(career) {
    var clubs = TM.data.world().clubs.filter(function (cl) { return cl.id !== career.teamId; });
    if (clubs.length < 6) return null;
    // clube pequeno/médio em apuros (rating mais baixo tem mais chance de crise)
    var seller = null;
    for (var s = 0; s < 20; s++) {
      var cand = clubs[Math.floor(Math.random() * clubs.length)];
      var r = TM.data.clubRating(cand.id);
      if (r <= 82 && Math.random() < 0.7) { seller = cand; break; }
    }
    if (!seller) return null;
    var squad = TM.data.clubPlayers(seller.id).filter(function (p) {
      return career.roster.indexOf(p.id) < 0 && !(career.worldTransfers && career.worldTransfers[p.id]);
    });
    if (squad.length < 12) return null;
    var star = squad[0];                                   // o craque do clube
    if (!star || star.overall < 76) return null;
    var val = TM.data.marketValue(star), sellRating = TM.data.clubRating(seller.id);
    // comprador rico que se encaixa
    var buyers = clubs.filter(function (cl) {
      return cl.id !== seller.id && TM.data.clubRating(cl.id) >= sellRating && baseBudgetEur(TM.data.clubRating(cl.id)) >= val * 0.8
        && !(rivalryOn() && TM.data.areRivals(cl.id, seller.id));
    });
    if (!buyers.length) return null;
    var buyer = buyers[Math.floor(Math.random() * buyers.length)];
    return { pid: star.id, name: star.name, ov: star.overall, fromId: seller.id, fromName: seller.name, toId: buyer.id, toName: buyer.name, val: Math.round(val * 0.85), fireSale: true };
  }
  // um clube da IA contrata um jogador que está livre no mercado (sem clube)
  function findAiFreeAgentDeal(career) {
    var W = TM.data.world();
    var fas = (W.freeAgents || []).map(function (id) { return W.playersById[id]; }).filter(function (p) {
      return p && p.freeAgent && career.roster.indexOf(p.id) < 0 && !(career.worldTransfers && career.worldTransfers[p.id]);
    });
    if (!fas.length) return null;
    var target = fas[Math.floor(Math.random() * fas.length)];
    // clubes que fazem sentido para o nível do jogador (não o do usuário)
    var clubs = W.clubs.filter(function (cl) { return cl.id !== career.teamId && TM.data.clubRating(cl.id) >= target.overall - 4; });
    if (!clubs.length) return null;
    var buyer = clubs[Math.floor(Math.random() * clubs.length)];
    return { pid: target.id, name: target.name, ov: target.overall, fromId: "free", fromName: "sem clube", toId: buyer.id, toName: buyer.name, val: 0, free: true };
  }
  function freeAgentNews(career, deal) {
    var onShort = (career.shortlist || []).indexOf(deal.pid) >= 0;
    if (onShort) {
      TM.notify.push(career, { icon: "⭐", title: "Alvo da Central assinou", news: true,
        text: "Perdeu a corrida: o " + deal.toName + " contratou " + deal.name + " (" + deal.ov + "), que estava livre e era um dos seus alvos na Central." });
    } else {
      TM.notify.push(career, { icon: "✍️", title: "Livre no mercado assinou", news: true,
        text: deal.toName + " acertou com " + deal.name + " (" + deal.ov + "), que estava sem clube. Contratação a custo zero." });
    }
  }
  function dealNews(career, deal, arrived) {
    var onShort = (career.shortlist || []).indexOf(deal.pid) >= 0;
    if (onShort) {
      TM.notify.push(career, { icon: "⭐", title: "Alvo da Central contratado",
        text: "Atenção: o " + deal.toName + " " + (arrived ? "fechou" : "acertou") + " a contratação de " + deal.name + " (" + deal.ov + "), um dos seus alvos na Central de Transferências." });
    } else {
      TM.notify.push(career, { icon: "🔁", title: "Mercado da bola", news: true,
        text: deal.toName + " " + (arrived ? "contratou" : "acertou") + " " + deal.name + " (" + deal.ov + ") do " + deal.fromName + " por " + fmtMoney(career, deal.val) + (arrived ? "." : " — chega quando a janela abrir.") });
    }
  }
  function fireSaleNews(career, deal) {
    TM.notify.push(career, { icon: "🚨", title: "Crise financeira", news: true,
      text: "Em apuros no caixa, o " + deal.fromName + " foi obrigado a vender seu craque " + deal.name + " (" + deal.ov + ") ao " + deal.toName + " por " + fmtMoney(career, deal.val) + ". Venda relâmpago para equilibrar as contas." });
  }
  // CRISE FINANCEIRA DO USUÁRIO: caixa muito negativo -> diretoria cobra venda de um titular
  function checkUserFinancialCrisis(career) {
    if (career.role === "dirigente") return;
    var mult = career.money ? career.money.mult : 1;
    var threshold = -15 * mult;                 // ~ -15M de rombo
    if ((career.budget || 0) >= threshold) { career._crisisNoted = false; return; }
    if (career._crisisNoted) return;
    career._crisisNoted = true;
    var mine = rosterPlayers(career).filter(function (p) { return p.overall >= 74 && !(career.loanedIn && career.loanedIn[p.id]); });
    mine.sort(function (a, b) { return TM.data.marketValue(b) - TM.data.marketValue(a); });
    var star = mine[0];
    career.transferList = career.transferList || [];
    if (star && career.transferList.indexOf(star.id) < 0) career.transferList.push(star.id);
    TM.notify.push(career, { icon: "🚨", title: "Diretoria: crise no caixa", news: true,
      text: "O clube está no vermelho (" + fmtMoney(career, career.budget) + "). A diretoria exige uma venda para equilibrar as contas" + (star ? " — " + star.name + " foi colocado na lista de transferências." : ".") });
  }
  // notificação de INTERESSE de um clube num jogador (antes/independente de uma proposta concreta)
  function maybeInterest(career) {
    // escolhe entre um alvo da Central e um jogador do seu elenco
    var shortlist = (career.shortlist || []).filter(function (id) { return career.roster.indexOf(id) < 0; });
    var useShort = shortlist.length > 0 && Math.random() < 0.5;
    var player, headline, icon, title;
    if (useShort) {
      player = resolvePlayer(career, shortlist[Math.floor(Math.random() * shortlist.length)]);
      if (!player) return;
      var suitors = TM.data.world().clubs.filter(function (cl) {
        return cl.id !== career.teamId && cl.id !== player.clubId && TM.data.clubRating(cl.id) >= player.overall - 3 && baseBudgetEur(TM.data.clubRating(cl.id)) >= TM.data.marketValue(player);
      });
      if (!suitors.length) return;
      var s1 = suitors[Math.floor(Math.random() * suitors.length)];
      icon = "👀"; title = "Interesse no seu alvo";
      headline = "O " + s1.name + " está de olho em " + player.name + " (" + player.overall + "), um dos seus alvos na Central. Feche antes que ele saia do mercado.";
    } else {
      // um jogador de destaque do seu elenco desperta interesse
      var mine = rosterPlayers(career).filter(function (p) { return p.overall >= 70 && !(career.loanedIn && career.loanedIn[p.id]); });
      if (!mine.length) return;
      player = mine[Math.floor(Math.random() * mine.length)];
      var buyers = TM.data.world().clubs.filter(function (cl) {
        return cl.id !== career.teamId && TM.data.clubRating(cl.id) >= player.overall - 2;
      });
      if (!buyers.length) return;
      var b1 = buyers[Math.floor(Math.random() * buyers.length)];
      icon = "👀"; title = "Interesse no seu jogador";
      headline = "O " + b1.name + " monitora " + player.name + " (" + player.overall + "). Uma proposta pode chegar a qualquer momento.";
    }
    TM.notify.push(career, { icon: icon, title: title, news: true, text: headline });
  }
  // roda a cada visita ao hub: transições de janela, negócios pendentes e atividade de mercado da IA
  function processCalendar(career) {
    if (!career.windows) buildWindows(career);
    career.pendingWorldDeals = career.pendingWorldDeals || [];
    var d = career.currentDay || 0;
    // transições de abertura/fechamento das janelas
    (career.windows || []).forEach(function (w) {
      if (d >= w.openDay && !w.openedNotified) {
        w.openedNotified = true;
        TM.notify.push(career, { icon: "🟢", title: w.name + " aberta", text: "A " + w.name.toLowerCase() + " está aberta até " + dateOf(career, w.closeDay).full + ". Reforce o elenco!" });
        // conclui os acordos que estavam pendentes aguardando a janela
        var still = [];
        career.pendingWorldDeals.forEach(function (dl) {
          if (executeWorldTransfer(career, dl.pid, dl.toId)) dealNews(career, dl, true);
          else still.push(dl);
        });
        career.pendingWorldDeals = still;
      }
      if (d >= w.closeDay && !w.closedNotified) {
        w.closedNotified = true;
        TM.notify.push(career, { icon: "🔴", title: w.name + " fechada", text: "A " + w.name.toLowerCase() + " fechou. Novas transferências só na próxima janela." });
      }
    });
    // atividade de mercado da IA — só quando o dia avança (evita repetir a cada re-render do hub)
    if (career._lastCalDay === d) return;
    career._lastCalDay = d;
    var open = windowOpenNow(career);
    if (open) {
      if (Math.random() < 0.45) {
        var deal = findAiDeal(career);
        if (deal) { if (executeWorldTransfer(career, deal.pid, deal.toId)) dealNews(career, deal, true); }
      }
      // clubes também assinam quem está livre no mercado (custo zero) — aos poucos
      if (Math.random() < 0.06) {
        var fdeal = findAiFreeAgentDeal(career);
        if (fdeal && executeWorldTransfer(career, fdeal.pid, fdeal.toId)) freeAgentNews(career, fdeal);
      }
    } else {
      if (Math.random() < 0.14) {
        var deal2 = findAiDeal(career);
        if (deal2) { career.pendingWorldDeals.push(deal2); dealNews(career, deal2, false); }
      }
      // passe livre pode ser fechado a qualquer momento, mesmo fora da janela (raro)
      if (Math.random() < 0.02) {
        var fdeal2 = findAiFreeAgentDeal(career);
        if (fdeal2 && executeWorldTransfer(career, fdeal2.pid, fdeal2.toId)) freeAgentNews(career, fdeal2);
      }
    }
    // crise financeira: um clube da IA faz venda relâmpago do craque (raro, mais provável na janela)
    if (Math.random() < (open ? 0.05 : 0.02)) {
      var fs = findFireSaleDeal(career);
      if (fs) { if (open) { if (executeWorldTransfer(career, fs.pid, fs.toId)) fireSaleNews(career, fs); } else { career.pendingWorldDeals.push(fs); fireSaleNews(career, fs); } }
    }
    // crise financeira do próprio clube (caixa no vermelho)
    checkUserFinancialCrisis(career);
    // sondagens de interesse (independem de proposta concreta)
    if (Math.random() < 0.28) maybeInterest(career);
  }

  /* ---------- rebaixamento / acesso (1ª <-> 2ª divisão) ---------- */
  var DIV_DOWN = { br: "br2", br2: "br3", en: "en2", it: "it2", es: "es2", fr: "fr2", de: "de2" };  // rebaixa para
  var DIV_UP = { br2: "br", br3: "br2", en2: "en", it2: "it", es2: "es", fr2: "fr", de2: "de" };    // sobe para
  var RELEG_N = 4, PROMO_N = 4;
  function moveClubToLeague(fromLg, toLg, clubId) {
    var from = TM.data.league(fromLg), to = TM.data.league(toLg);
    if (!from || !to) return;
    from.clubIds = from.clubIds.filter(function (id) { return id !== clubId; });
    if (to.clubIds.indexOf(clubId) < 0) to.clubIds.push(clubId);
    var club = TM.data.club(clubId); if (club) club.leagueId = toLg;
  }
  function swapDivisions(career, userLg, targetLg) {
    var cands = TM.data.league(targetLg).clubIds.filter(function (id) { return id !== career.teamId; });
    cands.sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
    var counterpart = cands[0];
    moveClubToLeague(userLg, targetLg, career.teamId);
    if (counterpart) moveClubToLeague(targetLg, userLg, counterpart);
    career.divSwaps = career.divSwaps || [];
    career.divSwaps.push({ user: career.teamId, counterpart: counterpart, userLg: userLg, targetLg: targetLg });
    career.leagueId = targetLg;
  }
  function applyDivSwaps(career) {
    (career.divSwaps || []).forEach(function (s) {
      moveClubToLeague(s.userLg, s.targetLg, s.user);
      if (s.counterpart) moveClubToLeague(s.targetLg, s.userLg, s.counterpart);
    });
  }
  function applyPromRel(career) {
    var lg = career.leagueId, st = career.lastStanding || [];
    if (!st.length) return;
    var pos = st.indexOf(career.teamId) + 1, N = st.length;
    if (pos <= 0) return;
    if (DIV_DOWN[lg] && pos > N - RELEG_N) {
      var toL = DIV_DOWN[lg]; swapDivisions(career, lg, toL);
      TM.notify.push(career, { icon: "⬇️", title: "Rebaixamento", text: career.teamName + " terminou em " + pos + "º e foi rebaixado para a " + TM.data.league(toL).name + "." });
    } else if (DIV_UP[lg] && pos <= PROMO_N) {
      var toU = DIV_UP[lg]; swapDivisions(career, lg, toU);
      TM.notify.push(career, { icon: "⬆️", title: "Acesso!", text: career.teamName + " terminou em " + pos + "º e conquistou o acesso à " + TM.data.league(toU).name + "!" });
    }
  }

  function newSeason(career) {
    // fotografa o elenco antes do envelhecimento para narrar a evolução
    var before = {};
    rosterPlayers(career).forEach(function (p) { before[p.id] = { ov: p.overall, age: p.age, name: p.name }; });
    career.season++;
    career.yellows = {}; // zera cartões amarelos a cada nova temporada
    // contratos: passa uma temporada; avisa expirados
    if (career.contracts) {
      var expiring = [];
      Object.keys(career.contracts).forEach(function (id) { var ct = career.contracts[id]; ct.years = Math.max(0, (ct.years || 1) - 1); if (ct.years === 0 && career.roster.indexOf(id) >= 0) expiring.push(id); });
      if (expiring.length) {
        var nm = expiring.slice(0, 3).map(function (id) { var p = TM.data.player(id); return p ? p.name : ""; }).filter(Boolean).join(", ");
        TM.notify.push(career, { icon: "📜", title: "Contratos a vencer", news: true, text: expiring.length + " jogador(es) com contrato encerrado (" + nm + (expiring.length > 3 ? "…" : "") + "). Renove ou pode perdê-los de graça." });
      }
    }
    ageWorld(career);
    retireAndRegen(career); // veteranos se aposentam; newgens surgem no lugar
    ageYouth(career);
    processLoans(career);
    applyPromRel(career); // rebaixa/promove antes de montar a nova temporada
    // verba de fim de temporada (independente de títulos)
    var mult = career.money ? career.money.mult : 1;
    var bonus = Math.round(20 * mult);
    career.budget += bonus;
    career.finc = { prizeM: bonus, spentM: 0, soldM: 0 }; // zera o balanço da temporada; a verba entra como receita
    TM.notify.push(career, { icon: "💰", title: "Verba da diretoria", text: "A diretoria liberou +" + fmtMoney(career, bonus) + " de verba para a nova temporada." });
    // resumo da evolução do elenco
    seasonEvoSummary(career, before);
    seasonSetup(career);
    // classificação continental (pelas primeiras posições da liga)
    if (career.comps.cont && career.comps.cont.name) {
      TM.notify.push(career, { icon: "🌍", title: "Classificado!", text: "Pela campanha na liga, " + career.teamName + " disputará a " + career.comps.cont.name + " nesta temporada." });
    }
    career.objective = generateObjective(career.teamId);
    maybeNationInvite(career);
    // renova o calendário da seleção (Copa do Mundo de 4 em 4 anos, senão amistosos)
    if (career.nation && !career.nation.fired) setupNationSeason(career);
  }
  // envelhece e evolui os jogadores da base (não estão no mundo global)
  function ageYouth(career) {
    (career.youth || []).forEach(function (y) { ageWorldPlayer(y); });
    Object.keys(career.customPlayers || {}).forEach(function (id) { ageWorldPlayer(career.customPlayers[id]); });
  }
  function seasonEvoSummary(career, before) {
    var risers = [], aged = [];
    rosterPlayers(career).forEach(function (p) {
      var b = before[p.id]; if (!b) return;
      if (p.overall > b.ov) risers.push({ name: p.name, from: b.ov, to: p.overall, d: p.overall - b.ov });
      else if (p.overall < b.ov && p.age >= 32) aged.push({ name: p.name, to: p.overall, age: p.age });
    });
    risers.sort(function (a, b) { return b.d - a.d; });
    if (risers.length) {
      var top = risers.slice(0, 3).map(function (r) { return r.name + " " + r.from + "→" + r.to; }).join(", ");
      TM.notify.push(career, { icon: "📈", title: "Evolução do elenco", text: "Destaques que evoluíram: " + top + (risers.length > 3 ? " e mais " + (risers.length - 3) + "." : ".") });
    }
    if (aged.length) {
      var old = aged.slice(0, 3).map(function (r) { return r.name + " (" + r.age + " anos, " + r.to + ")"; }).join(", ");
      TM.notify.push(career, { icon: "📉", title: "Veteranos em queda", text: "Perderam rendimento com a idade: " + old + "." });
    }
  }

  // preenche campos novos em carreiras antigas (salvas antes destes recursos)
  function migrateCareer(career) {
    if (!career) return career;
    // save de versão antiga sem a estrutura de competições atual → reconstrói a temporada
    if (!career.comps || !career.comps.league || !career.comps.league.fixtures || !career.order || career.orderIndex == null) {
      try { seasonSetup(career); } catch (e) { /* deixa o roteador tratar */ }
    }
    if (!career.money) career.money = CURRENCIES.eur;
    if (!career.loanedIn) career.loanedIn = {};
    if (!career.loanedOut) career.loanedOut = {};
    if (!career.injuries) career.injuries = {};
    if (!career.suspensions) career.suspensions = {};
    if (!career.notifications) career.notifications = [];
    if (!career.honours) career.honours = [];
    if (!career.tactic) career.tactic = "equilibrado";
    if (!career.objective) career.objective = generateObjective(career.teamId);
    if (!career.coachName) career.coachName = "Treinador";
    if (!career.board) career.board = "intermediaria";
    if (!career.role) career.role = "treinador";
    if (!career.recentForm) career.recentForm = [];
    if (career.lastBoardCall == null) career.lastBoardCall = 0;
    if (career.currentDay == null) career.currentDay = 0;
    if (career.matchNo == null) career.matchNo = 0;
    if (!career.seasonYear) career.seasonYear = 2025 + (career.season || 1);
    if (!career.youth || !career.youth.length) career.youth = generateYouth(career.teamId);
    if (!career.lineup) career.lineup = buildLineup(rosterPlayers(career), "4-4-2");
    if (!career.windows) buildWindows(career);
    if (!career.pendingWorldDeals) career.pendingWorldDeals = [];
    applyRegen(career); // remove aposentados e reinjeta newgens ANTES de escalar/reaplicar evolução
    syncLineup(career); // reincorpora contratados que faltavam no banco
    applyWorldEvo(career); // reaplica envelhecimento/evolução do mundo (world regenera determinístico)
    applyWorldTransfers(career); // reaplica transferências da IA (mundo regenera determinístico)
    applyDivSwaps(career); // reaplica rebaixamentos/acessos (mundo regenera determinístico)
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
      if (career.orderIndex >= career.order.length) { checkHonours(career); career.pending = { seasonEnd: true }; TM.storage.saveCoachCareer(career); return career.pending; }
      var key = career.order[career.orderIndex];
      if (key === "inter") {
        var reg = REGION[career.leagueId];
        var contWon = career.comps.cont && career.comps.cont.tour && career.comps.cont.tour.championId === career.teamId;
        if ((reg !== "sa" && reg !== "eu") || !contWon || (career.interMatch && career.interMatch.done)) { career.orderIndex++; continue; }
        if (!career.interMatch) {
          var otherLeagues = reg === "sa" ? REGION_LEAGUES.eu : REGION_LEAGUES.sa, best = null, bestR = -1;
          otherLeagues.forEach(function (lg2) { TM.data.league(lg2).clubIds.forEach(function (id) { var r = TM.data.clubRating(id); if (r > bestR) { bestR = r; best = id; } }); });
          career.interMatch = { oppId: best, done: false };
        }
        career.pending = { key: "inter", name: "Intercontinental", homeId: career.teamId, awayId: career.interMatch.oppId, ko: true, label: "Final · jogo único" };
        TM.storage.saveCoachCareer(career);
        return career.pending;
      }
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
        career.pending = { key: key, name: comp.name, homeId: nx.homeId, awayId: nx.awayId, ko: nx.ko, tour: true, leg: nx.leg,
          label: nx.phase === "group" ? "Grupos · Rodada " + (nx.groupRound + 1) : (TM.tournament.koTitle(nx.round) + (nx.leg ? (nx.leg === 1 ? " · Ida" : " · Volta") : "")) };
        TM.storage.saveCoachCareer(career);
        return career.pending;
      }
      var ko = comp;
      if (ko.championId) { career.orderIndex++; continue; }
      ensureKORound(ko);
      var tie = userTieIn(ko, career.teamId);
      if (ko.aliveUser && tie) {
        var koLabel = TM.tournament.koTitle(ko.rounds[ko.roundIndex].length * 2);
        if (ko.twoLeg) {
          if (tie[9] === 0) career.pending = { key: key, name: ko.name, homeId: tie[0], awayId: tie[1], ko: true, leg: 1, label: koLabel + " · Ida" };
          else career.pending = { key: key, name: ko.name, homeId: tie[1], awayId: tie[0], ko: true, leg: 2, label: koLabel + " · Volta" };
        } else {
          career.pending = { key: key, name: ko.name, homeId: tie[0], awayId: tie[1], ko: true, label: koLabel };
        }
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

  // detecta se a partida do usuário recém-jogada vai para os pênaltis (empate em mata-mata).
  // Retorna { aId, bId } dos dois times, ou null. Não altera estado.
  function userPenContext(career, homeScore, awayScore) {
    var p = career.pending;
    if (!p || p.seasonEnd) return null;
    if (p.key === "inter") return homeScore === awayScore ? { aId: p.homeId, bId: p.awayId } : null;
    if (p.key === "league") return null;
    if (p.tour) return TM.tournament.userPenContext ? TM.tournament.userPenContext(career.comps[p.key].tour, homeScore, awayScore, contCtx(career)) : null;
    var ko = career.comps[p.key];
    var tie = userTieIn(ko, career.teamId);
    if (!tie) return null;
    if (ko.twoLeg) {
      if (tie[9] !== 1) return null; // só decide na volta
      var aggA = tie[5] + awayScore, aggB = tie[6] + homeScore; // volta: mandante é tie[1]
      if (aggA !== aggB) return null;
      var awayA = awayScore, awayB = tie[6];
      return awayA === awayB ? { aId: tie[0], bId: tie[1] } : null;
    }
    return homeScore === awayScore ? { aId: tie[0], bId: tie[1] } : null;
  }

  // aplica o resultado da partida do usuário (placar do ponto de vista real das equipes)
  function applyUserResult(career, homeScore, awayScore, penWinnerId) {
    var p = career.pending;
    if (!p || p.seasonEnd) return;
    if (p.key === "inter") {
      var iw = homeScore > awayScore ? p.homeId : awayScore > homeScore ? p.awayId : (penWinnerId || penaltyWinner(p.homeId, p.awayId));
      career.interChampion = iw;
      if (career.interMatch) career.interMatch.done = true;
    } else if (p.key === "league") {
      var lg = career.comps.league;
      applyResult(lg.table, p.homeId, p.awayId, homeScore, awayScore);
      lg.fixtures[lg.round].forEach(function (fix) {
        if (fix[0] === p.homeId || fix[1] === p.homeId) return; // já é a do usuário
        var res = simMatch(career, fix[0], fix[1], false);
        applyResult(lg.table, fix[0], fix[1], res.score[0], res.score[1]);
      });
      lg.round++;
    } else if (p.tour) {
      TM.tournament.applyUserMatch(career.comps[p.key].tour, homeScore, awayScore, contCtx(career), penWinnerId);
    } else {
      var ko = career.comps[p.key];
      var round = ko.rounds[ko.roundIndex];
      var tie = userTieIn(ko, career.teamId);
      if (ko.twoLeg) {
        if (tie[9] === 0) {                       // ida — registra e aguarda a volta (só consome o slot do calendário)
          tie[5] = homeScore; tie[6] = awayScore; tie[9] = 1;
          career.orderIndex++; career.pending = null;
          career.currentDay = Math.max(career.currentDay || 0, matchDay(career.matchNo || 0));
          career.matchNo = (career.matchNo || 0) + 1;
          TM.storage.saveCoachCareer(career);
          return;
        }
        tie[7] = homeScore; tie[8] = awayScore; tie[9] = 2; decideTwoLeg(tie, penWinnerId);
        if (tie[4] !== career.teamId) ko.aliveUser = false;
        round.forEach(function (t) { if (t[4] == null) resolveTieTwoLeg(career, t); });
      } else {
        var winner = homeScore > awayScore ? tie[0] : awayScore > homeScore ? tie[1] : (penWinnerId || penaltyWinner(tie[0], tie[1]));
        tie[2] = homeScore; tie[3] = awayScore; tie[4] = winner;
        if (winner !== career.teamId) ko.aliveUser = false;
        round.forEach(function (t) { if (t[4] == null) resolveTie(career, t, true); });
      }
      if (round.length === 1) ko.championId = round[0][4];
      ko.roundIndex++;
    }
    career.orderIndex++;
    career.pending = null;
    // avança o calendário (o jogo aconteceu na sua data)
    career.currentDay = Math.max(career.currentDay || 0, matchDay(career.matchNo || 0));
    career.matchNo = (career.matchNo || 0) + 1;
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
    var mundialChamp = c.mundial && c.mundial.tour && c.mundial.tour.championId === career.teamId;
    career.honours.push({
      season: career.season,
      leaguePos: st.findIndex(function (r) { return r.id === career.teamId; }) + 1,
      leagueChampion: champ.id === career.teamId,
      cupChampion: c.cup && c.cup.championId === career.teamId,
      contChampion: contChamp,
      mundialChampion: mundialChamp,
      interChampion: career.interChampion === career.teamId
    });
  }

  TM.comp = {
    newClubCareer: newClubCareer, newSeason: newSeason, migrateCareer: migrateCareer,
    switchUserClub: switchUserClub, generateJobOffers: generateJobOffers,
    computeReputation: computeReputation, reputationLabel: reputationLabel,
    evaluateObjective: evaluateObjective, currentPosition: currentPosition,
    matchDay: matchDay, dateOf: dateOf, logDeal: logDeal, peekSchedule: peekSchedule, offsetOfDate: offsetOfDate,
    processCalendar: processCalendar, windowOpenNow: windowOpenNow, currentWindow: currentWindow, nextWindowOpenDay: nextWindowOpenDay,
    retireAndRegen: retireAndRegen, applyRegen: applyRegen,
    buildNation: buildNation, nationNextWindow: nationNextWindow, checkNationDeadlines: checkNationDeadlines,
    nationSquadPlayers: nationSquadPlayers, nationTeam: nationTeam, oppNationTeam: oppNationTeam,
    setupNationSeason: setupNationSeason, natRating: natRating, nationPending: nationPending,
    applyQualiResult: applyQualiResult, qualiStandings: qualiStandings, ensureQuali: ensureQuali,
    userQualified: userQualified, qualifiedTeams: qualifiedTeams, confedOf: confedOf,
    CONFED: CONFED, CONFED_NAME: CONFED_NAME, CONFED_SLOTS: CONFED_SLOTS,
    advanceWorldCup: advanceWorldCup, applyWorldCupResult: applyWorldCupResult, wcRoundLabel: wcRoundLabel,
    advanceToUserMatch: advanceToUserMatch, applyUserResult: applyUserResult, userPenContext: userPenContext,
    standings: standings, userTeam: userTeam, oppTeam: oppTeam, anyTeam: anyTeam,
    userSquad: userSquad, simMatch: simMatch, CURRENCIES: CURRENCIES,
    CUP_NAME: CUP_NAME, CONT_NAME: CONT_NAME, REGION: REGION,
    FORMATIONS: FORMATIONS, buildLineup: buildLineup, resolvePlayer: resolvePlayer,
    playerVersa: playerVersa, posPenalty: posPenalty, effOverall: effOverall, slotPos: slotPos, adjustForSlot: adjustForSlot,
    available: available, effectiveXI: effectiveXI, rosterPlayers: rosterPlayers, syncLineup: syncLineup,
    processUserMatch: processUserMatch, recordPlayerStats: recordPlayerStats, dynamicInfo: dynamicInfo, resolveIncomingOffer: resolveIncomingOffer,
    counterIncomingOffer: counterIncomingOffer, counterLoanOffer: counterLoanOffer,
    promoteYouth: promoteYouth, generateYouth: generateYouth,
    clubStance: clubStance, signLoan: signLoan, exerciseLoanBuy: exerciseLoanBuy, returnLoanIn: returnLoanIn,
    resolveLoanOffer: resolveLoanOffer, loanTermLabel: loanTermLabel, fmtMoney: fmtMoney,
    baseBudgetEur: baseBudgetEur
  };
})(window);
