/* ================= TOTAL MATCH — Modo "Jogar Competição" ================= */
/* Escolha uma competição (liga/copa de clubes, ou copa de seleções) e comande
   um time/seleção só nela. Copas continentais e de seleções têm fase de grupos
   + mata-mata (via TM.tournament); copas nacionais são mata-mata puro. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = function () { return TM.ui.el; };

  /* ---------- catálogo de competições ---------- */
  // seleções por confederação (nomes reais existentes no jogo)
  var NAT_GROUPS = {
    world:   { name: "Copa do Mundo",           size: 48, groups: 12, all: true, bestThirds: 8 },
    america: { name: "Copa América",            size: 8,  groups: 2, list: ["Brazil", "Argentina", "Uruguay", "Colombia", "Chile", "Peru", "Ecuador", "Paraguay"] },
    euro:    { name: "Eurocopa",                size: 16, groups: 4, list: ["France", "England", "Spain", "Germany", "Portugal", "Netherlands", "Italy", "Belgium", "Croatia", "Switzerland", "Denmark", "Poland", "Serbia", "Austria", "Turkey", "Ukraine"] },
    africa:  { name: "Copa Africana de Nações",  size: 8,  groups: 2, list: ["Senegal", "Morocco", "Nigeria", "Egypt", "Cameroon", "Ghana", "Ivory Coast", "Algeria"] }
  };
  var CONT_CLUB = {
    libertadores: { name: "Libertadores",     leagues: ["br", "ar"],                         size: 32, groups: 8, dbl: true, twoLeg: true },
    champions:    { name: "Champions League", leagues: ["en", "es", "it", "de", "fr", "pt", "nl"], size: 32, groups: 8, dbl: true, twoLeg: true },
    mundial:      { name: "Mundial de Clubes", allLeagues: true,                              size: 32, groups: 8, dbl: false, twoLeg: false } // formato Copa do Mundo (jogo único)
  };

  // mapeia a competição do modo-jogar para o id do logo (registro de COMPETITIONS)
  function compImgId(catKey, id) {
    if (catKey === "league") return "lg-" + id;
    if (catKey === "domestic") return "cup-" + id;
    if (catKey === "continental") return id === "champions" ? "cont-eu" : id === "libertadores" ? "cont-sa" : id === "mundial" ? "cwc-world" : null;
    if (catKey === "nation") return "nat-" + id; // world/america/euro/africa
    return null;
  }

  function topClubs(leagueId, n) {
    return TM.data.league(leagueId).clubIds.slice().sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); }).slice(0, n);
  }
  function natRating(natId) { var sq = TM.data.nationSquad(natId).slice(0, 11); return Math.round(sq.reduce(function (s, p) { return s + p.overall; }, 0) / (sq.length || 1)); }
  function natIdByName(name) { var n = TM.data.nationByName(name); return n ? n.id : null; }

  // { name, isNation, kind: 'league'|'ko'|'tournament', teamIds, groups?, perGroup? }
  function buildCompetition(catKey, id) {
    if (catKey === "league") {
      var lg = TM.data.league(id);
      return { name: lg.name, isNation: false, kind: "league", teamIds: lg.clubIds.slice() };
    }
    if (catKey === "domestic") {
      return { name: (TM.comp.CUP_NAME[id] || "Copa"), isNation: false, kind: "ko", teamIds: topClubs(id, 16) };
    }
    if (catKey === "continental") {
      var def = CONT_CLUB[id], pool = [];
      if (def.allLeagues) { TM.data.world().leagues.forEach(function (L) { pool = pool.concat(topClubs(L.id, 6)); }); }
      else { def.leagues.forEach(function (l) { pool = pool.concat(topClubs(l, Math.ceil(def.size / def.leagues.length) + 2)); }); }
      pool = pool.filter(function (x, i) { return pool.indexOf(x) === i; }).sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); }).slice(0, def.size);
      return { name: def.name, isNation: false, kind: "tournament", teamIds: pool, groups: def.groups, perGroup: 4, dbl: !!def.dbl, twoLeg: !!def.twoLeg };
    }
    if (catKey === "nation") {
      var def2 = NAT_GROUPS[id], ids;
      if (def2.all) ids = TM.data.world().nations.map(function (n) { return n.id; }).sort(function (a, b) { return natRating(b) - natRating(a); }).slice(0, def2.size);
      else ids = def2.list.map(natIdByName).filter(Boolean).slice(0, def2.size);
      return { name: def2.name, isNation: true, kind: "tournament", teamIds: ids, groups: def2.groups, perGroup: 4, bestThirds: def2.bestThirds || 0 };
    }
  }

  /* ---------- helpers ---------- */
  function realism() { return TM.storage.settings().realism; }
  // elenco do time do usuário (para o campinho)
  function userPlayerList(s) { return s.isNation ? TM.data.nationSquad(s.userId) : TM.data.clubPlayers(s.userId); }
  function ensureLineup(s) { if (!s.lineup) s.lineup = TM.comp.buildLineup(userPlayerList(s), "4-4-2"); return s.lineup; }
  // ordem escolhida pelo usuário (titulares primeiro), como objetos de jogador
  function userRoster(s) {
    if (!s.lineup) return null;
    var ids = s.lineup.starters.concat(s.lineup.bench);
    var seen = {}; var ordered = ids.map(function (id) { seen[id] = 1; return TM.data.player(id); }).filter(Boolean);
    // completa com quem ficou de fora da escalação (segurança)
    userPlayerList(s).forEach(function (p) { if (!seen[p.id]) ordered.push(p); });
    return ordered;
  }
  function teamFor(s, cid) {
    if (cid === s.userId && s.lineup) {
      var roster = userRoster(s);
      return s.isNation ? TM.engine.teamFromNation(cid, roster) : TM.engine.teamFromClub(cid, roster);
    }
    return s.isNation ? TM.engine.teamFromNation(cid) : TM.engine.teamFromClub(cid);
  }
  function nameFor(s, cid) { return s.isNation ? TM.data.nation(cid).name : TM.data.club(cid).name; }
  function ratingFor(s, cid) { return s.isNation ? natRating(cid) : TM.data.clubRating(cid); }
  function imgFor(s, cid, cls) { return s.isNation ? TM.img.nationImg(TM.data.nation(cid), cls) : TM.img.clubImg(TM.data.club(cid), cls); }
  function simTeams(s, a, b) { return TM.engine.simulate(teamFor(s, a), teamFor(s, b), { realism: realism(), neutral: true }); }
  function ctxFor(s) { return { sim: function (a, b) { return simTeams(s, a, b); }, rating: function (id) { return ratingFor(s, id); } }; }

  function roundRobin(ids) {
    var n = ids.length, arr = ids.slice(), rounds = [];
    for (var r = 0; r < n - 1; r++) { var rd = []; for (var i = 0; i < n / 2; i++) rd.push(r % 2 === 0 ? [arr[i], arr[n - 1 - i]] : [arr[n - 1 - i], arr[i]]); rounds.push(rd); arr.splice(1, 0, arr.pop()); }
    return rounds;
  }
  function doubleRoundRobin(ids) {
    var first = roundRobin(ids);
    return first.concat(first.map(function (rd) { return rd.map(function (m) { return [m[1], m[0]]; }); }));
  }
  function emptyTable(ids) { var t = {}; ids.forEach(function (id) { t[id] = { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }); return t; }
  function applyRes(t, h, a, hs, as) { var H = t[h], A = t[a]; H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs; if (hs > as) { H.w++; A.l++; H.pts += 3; } else if (hs < as) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; } }
  function standings(t) { return Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function save(s) { TM.storage.write("compmode", s); }
  function load() { return TM.storage.read("compmode", null); }
  function clear() { TM.storage.remove("compmode"); }

  function newComp(catKey, id, userId) {
    var built = buildCompetition(catKey, id);
    var s = { name: built.name, isNation: built.isNation, kind: built.kind, userId: userId };
    if (built.kind === "league") { s.teamIds = built.teamIds; s.fixtures = doubleRoundRobin(built.teamIds); s.round = 0; s.table = emptyTable(built.teamIds); }
    else if (built.kind === "ko") { s.teamIds = shuffle(built.teamIds); s.rounds = []; s.roundIndex = 0; s.aliveUser = true; s.championId = null; s.twoLeg = true; } // copas nacionais: ida e volta
    else { s.tour = TM.tournament.create(built.teamIds, { groups: built.groups, perGroup: built.perGroup, advance: 2, doubleGroups: !!built.dbl, bestThirds: built.bestThirds || 0, twoLeg: !!built.twoLeg, userId: userId }); }
    return s;
  }

  /* ---- mata-mata puro (copas nacionais) — ida e volta ---- */
  function ensureKO(s) {
    if (s.rounds[s.roundIndex]) return;
    var teams = s.roundIndex === 0 ? s.teamIds : s.rounds[s.roundIndex - 1].map(function (t) { return t[4]; });
    var ties = [];
    for (var i = 0; i < teams.length; i += 2) {
      ties.push(s.twoLeg ? [teams[i], teams[i + 1], null, null, null, null, null, null, null, 0]
                         : [teams[i], teams[i + 1], null, null, null]);
    }
    s.rounds[s.roundIndex] = ties;
  }
  function penWin(s, a, b) { var ra = ratingFor(s, a), rb = ratingFor(s, b); return Math.random() < ra / (ra + rb) ? a : b; }
  function resolveTie(s, tie) { var r = simTeams(s, tie[0], tie[1]); var hs = r.score[0], as = r.score[1]; tie[2] = hs; tie[3] = as; tie[4] = hs > as ? tie[0] : as > hs ? tie[1] : penWin(s, tie[0], tie[1]); return r; }
  function decideTwoLeg(s, tie, forced) {
    var aggA = tie[5] + tie[8], aggB = tie[6] + tie[7]; tie[2] = aggA; tie[3] = aggB;
    if (aggA !== aggB) { tie[4] = aggA > aggB ? tie[0] : tie[1]; return; }
    var awayA = tie[8], awayB = tie[6];
    tie[4] = awayA > awayB ? tie[0] : awayB > awayA ? tie[1] : (forced || penWin(s, tie[0], tie[1]));
  }
  // pênaltis na competição avulsa? { aId, bId } ou null
  function userPenContextComp(s, hs, as) {
    if (s.kind === "ko") {
      var tie = userTieKO(s); if (!tie) return null;
      if (s.twoLeg) {
        if (tie[9] !== 1) return null;
        var aggA = tie[5] + as, aggB = tie[6] + hs;
        if (aggA !== aggB) return null;
        return as === tie[6] ? { aId: tie[0], bId: tie[1] } : null;
      }
      return hs === as ? { aId: tie[0], bId: tie[1] } : null;
    }
    if (s.tour) return TM.tournament.userPenContext ? TM.tournament.userPenContext(s.tour, hs, as, ctxFor(s)) : null;
    return null;
  }
  function resolveTieTwoLeg(s, tie) {
    var l1 = simTeams(s, tie[0], tie[1]); tie[5] = l1.score[0]; tie[6] = l1.score[1];
    var l2 = simTeams(s, tie[1], tie[0]); tie[7] = l2.score[0]; tie[8] = l2.score[1];
    tie[9] = 2; decideTwoLeg(s, tie);
  }
  function userTieKO(s) { var rd = s.rounds[s.roundIndex]; if (!rd) return null; for (var i = 0; i < rd.length; i++) if (rd[i][0] === s.userId || rd[i][1] === s.userId) return rd[i]; return null; }

  // devolve a próxima partida do usuário (avança auto-sims)
  function advance(s) {
    if (s.kind === "league") {
      if (s.round >= s.fixtures.length) return { end: true };
      var rd = s.fixtures[s.round], fix = null;
      rd.forEach(function (m) { if (m[0] === s.userId || m[1] === s.userId) fix = m; });
      return { homeId: fix[0], awayId: fix[1] };
    }
    if (s.kind === "ko") {
      var guard = 0;
      while (guard++ < 40) {
        if (s.championId) return { end: true };
        ensureKO(s);
        var tie = userTieKO(s);
        var base = TM.tournament.koTitle(s.rounds[s.roundIndex].length * 2);
        if (s.aliveUser && tie) {
          if (s.twoLeg) {
            if (tie[9] === 0) return { homeId: tie[0], awayId: tie[1], ko: true, label: base + " · Ida" };
            if (tie[9] === 1) return { homeId: tie[1], awayId: tie[0], ko: true, label: base + " · Volta" };
          } else {
            return { homeId: tie[0], awayId: tie[1], ko: true, label: base };
          }
        }
        s.rounds[s.roundIndex].forEach(function (t) { if (t[4] == null) (s.twoLeg ? resolveTieTwoLeg : resolveTie)(s, t); });
        if (s.rounds[s.roundIndex].length === 1) s.championId = s.rounds[s.roundIndex][0][4];
        s.roundIndex++;
      }
      return { end: true };
    }
    // tournament (grupos + mata-mata)
    var nx = TM.tournament.nextUserMatch(s.tour, ctxFor(s));
    if (nx.end) return { end: true };
    var label = nx.phase === "group" ? "Grupos · Rodada " + (nx.groupRound + 1) : TM.tournament.koTitle(nx.round);
    return { homeId: nx.homeId, awayId: nx.awayId, ko: nx.phase === "ko", label: label };
  }

  function applyUser(s, hs, as, penWinnerId) {
    if (s.kind === "league") {
      var rd = s.fixtures[s.round];
      rd.forEach(function (m) { if (m[0] === s.userId || m[1] === s.userId) applyRes(s.table, m[0], m[1], hs, as); else { var r = simTeams(s, m[0], m[1]); applyRes(s.table, m[0], m[1], r.score[0], r.score[1]); } });
      s.round++;
    } else if (s.kind === "ko") {
      var tie = userTieKO(s);
      if (s.twoLeg) {
        if (tie[9] === 0) { tie[5] = hs; tie[6] = as; tie[9] = 1; return; }   // ida; aguarda a volta
        tie[7] = hs; tie[8] = as; tie[9] = 2; decideTwoLeg(s, tie, penWinnerId);
        if (tie[4] !== s.userId) s.aliveUser = false;
        s.rounds[s.roundIndex].forEach(function (t) { if (t[4] == null) resolveTieTwoLeg(s, t); });
      } else {
        tie[2] = hs; tie[3] = as; tie[4] = hs > as ? tie[0] : as > hs ? tie[1] : (penWinnerId || penWin(s, tie[0], tie[1]));
        if (tie[4] !== s.userId) s.aliveUser = false;
        s.rounds[s.roundIndex].forEach(function (t) { if (t[4] == null) resolveTie(s, t); });
      }
      if (s.rounds[s.roundIndex].length === 1) s.championId = s.rounds[s.roundIndex][0][4];
      s.roundIndex++;
    } else {
      TM.tournament.applyUserMatch(s.tour, hs, as, ctxFor(s), penWinnerId);
    }
  }
  function champId(s) { return s.kind === "league" ? standings(s.table)[0].id : s.kind === "ko" ? s.championId : s.tour.championId; }
  function koTitle(n) { return TM.tournament.koTitle(n); }

  /* =================== TELAS =================== */
  TM.ui.register("compmode", function (screen) {
    var E = el();
    if (load()) { TM.ui.go("compmode-hub"); return; }
    screen.appendChild(TM.ui.topbar("🏆 Jogar Competição", function () { TM.ui.go("modes"); }));
    var body = E("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(E("p", { class: "intro-text", text: "Escolha uma competição e comande um time ou seleção apenas nela." }));
    function catCard(icon, title, sub, fn) { return E("button", { class: "choice-card", on: { click: fn } }, [ E("span", { class: "cc-ic", text: icon }), E("span", { class: "cc-t", text: title }), E("span", { class: "cc-d", text: sub }) ]); }
    body.appendChild(E("div", { class: "big-choice" }, [
      catCard("🏟️", "Ligas de Clubes", "Dispute uma das 10 ligas nacionais", function () { TM.ui.go("compmode-list", { cat: "league" }); }),
      catCard("🏆", "Copas de Clubes", "Copa nacional, Libertadores ou Champions", function () { TM.ui.go("compmode-list", { cat: "clubcup" }); }),
      catCard("🌍", "Copas de Seleções", "Copa do Mundo, América, Eurocopa, Africana", function () { TM.ui.go("compmode-list", { cat: "natcup" }); })
    ]));
  });

  TM.ui.register("compmode-list", function (screen, params) {
    var E = el();
    screen.appendChild(TM.ui.topbar("Escolha a competição", function () { TM.ui.go("compmode"); }));
    var body = E("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var items = [];
    if (params.cat === "league") {
      TM.data.world().leagues.forEach(function (lg) { items.push({ catKey: "league", id: lg.id, name: lg.name, sub: "Liga · 18 clubes" }); });
    } else if (params.cat === "clubcup") {
      TM.data.world().leagues.forEach(function (lg) { items.push({ catKey: "domestic", id: lg.id, name: TM.comp.CUP_NAME[lg.id] || "Copa", sub: "Mata-mata · 16 clubes" }); });
      Object.keys(CONT_CLUB).forEach(function (k) { items.push({ catKey: "continental", id: k, name: CONT_CLUB[k].name, sub: CONT_CLUB[k].size + " clubes · grupos + mata-mata" }); });
    } else {
      Object.keys(NAT_GROUPS).forEach(function (k) { items.push({ catKey: "nation", id: k, name: NAT_GROUPS[k].name, sub: NAT_GROUPS[k].size + " seleções · grupos + mata-mata" }); });
    }
    items.forEach(function (it) {
      var cid = compImgId(it.catKey, it.id);
      var kids = [];
      if (cid) kids.push(TM.img.compImg(cid, "cli-logo"));
      kids.push(E("div", { class: "cli-text" }, [ E("div", { class: "cli-name", text: it.name }), E("div", { class: "cli-sub", text: it.sub }) ]));
      body.appendChild(E("button", { class: "comp-list-item", on: { click: function () { TM.ui.go("compmode-team", it); } } }, [
        E("div", { class: "cli-left" }, kids),
        E("span", { class: "side-arrow", text: "→", style: "opacity:1" })
      ]));
    });
  });

  TM.ui.register("compmode-team", function (screen, params) {
    var E = el();
    screen.appendChild(TM.ui.topbar("Escolha seu time", function () { TM.ui.go("compmode-list", { cat: params.catKey === "league" ? "league" : params.catKey === "nation" ? "natcup" : "clubcup" }); }));
    var built = buildCompetition(params.catKey, params.id);
    var body = E("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(E("p", { class: "intro-text", text: built.name + " — escolha quem você vai comandar:" }));
    var grid = E("div", { class: "club-grid" });
    body.appendChild(grid);
    var pick = null;
    built.teamIds.slice().sort(function (a, b) { return ratingFor(built, b) - ratingFor(built, a); }).forEach(function (id) {
      var card = E("div", { class: "club-pick" }, [ imgFor(built, id, "cp-crest"), E("div", { class: "cp-name", text: nameFor(built, id) }), TM.ui.ovBadge(ratingFor(built, id)) ]);
      card.addEventListener("click", function () { pick = id; grid.querySelectorAll(".club-pick").forEach(function (x) { x.classList.remove("selected"); }); card.classList.add("selected"); });
      grid.appendChild(card);
    });
    screen.appendChild(E("div", { class: "actions" }, [
      TM.ui.button("Começar", function () { if (!pick) { TM.ui.toast("Escolha um time"); return; } save(newComp(params.catKey, params.id, pick)); TM.ui.go("compmode-hub"); }, "btn primary big")
    ]));
  });

  TM.ui.register("compmode-hub", function (screen) {
    var E = el();
    var s = load(); if (!s) { TM.ui.go("compmode"); return; }
    var right = E("button", { class: "tb-menu", text: "⋯", on: { click: function () {
      TM.ui.optionsMenu("Opções", [
        { label: "📤 Salvar e sair", fn: function () { TM.saves.park("comp"); TM.ui.toast("Competição guardada em Minhas Carreiras"); TM.ui.go("modes"); } },
        { label: "🏠 Voltar ao menu (sem sair)", fn: function () { TM.ui.go("modes"); } },
        { label: "🗑️ Encerrar competição", danger: true, fn: function () { TM.ui.confirm("Encerrar esta competição?", "O progresso será apagado.", "Encerrar", function () { clear(); TM.ui.go("modes"); }, true); } }
      ]);
    } } });
    screen.appendChild(TM.ui.topbar(s.name, function () { TM.ui.go("modes"); }, right));
    screen.appendChild(E("div", { class: "club-header" }, [
      imgFor(s, s.userId, "ch-crest"),
      E("div", {}, [ E("div", { class: "ch-name", text: nameFor(s, s.userId) }), E("div", { class: "ch-sub", text: s.name + (s.isNation ? " · Seleção" : "") }) ])
    ]));

    var nx = advance(s); save(s);
    if (nx.end) {
      var cid = champId(s), won = cid === s.userId;
      screen.appendChild(E("div", { class: "next-match season-end" }, [
        E("div", { class: "nm-label", text: won ? "🏆 CAMPEÃO!" : "🏁 Competição encerrada" }),
        E("div", { class: "nm-teams", text: won ? "Você venceu a " + s.name + "!" : "Campeão: " + nameFor(s, cid) }),
        TM.ui.button("Nova competição", function () { clear(); TM.ui.go("compmode"); }, "btn primary")
      ]));
    } else {
      screen.appendChild(E("div", { class: "next-match" }, [
        E("div", { class: "nm-label", text: nx.label || (s.kind === "league" ? "Rodada " + (s.round + 1) + "/" + s.fixtures.length : "") }),
        E("div", { class: "nm-teams" }, [ E("span", { text: nameFor(s, nx.homeId) }), E("span", { class: "nm-x", text: "×" }), E("span", { text: nameFor(s, nx.awayId) }) ]),
        TM.ui.button("▶ Jogar", function () { TM.ui.go("compmode-play"); }, "btn primary")
      ]));
    }
    screen.appendChild(E("div", { class: "hub-actions" }, [
      E("button", { class: "hub-btn", on: { click: function () { TM.ui.go("compmode-view"); } } }, [ E("span", { class: "hub-ic", text: s.kind === "league" ? "📊" : "🏆" }), E("span", { text: s.kind === "league" ? "Tabela" : (s.kind === "tournament" ? "Grupos / Chave" : "Chaveamento") }) ]),
      E("button", { class: "hub-btn", on: { click: function () { TM.ui.go("compmode-lineup"); } } }, [ E("span", { class: "hub-ic", text: "📋" }), E("span", { text: "Escalação" }) ])
    ]));
  });

  // ---- gerenciar elenco (campinho) no modo competição ----
  TM.ui.register("compmode-lineup", function (screen) {
    var E = el();
    var s = load(); if (!s) { TM.ui.go("compmode"); return; }
    ensureLineup(s); save(s);
    pickSlot = null;
    screen.appendChild(TM.ui.topbar("📋 Escalação", function () { pickSlot = null; TM.ui.go("compmode-hub"); }));

    // formação
    var formRow = E("div", { class: "segmented full" });
    Object.keys(TM.comp.FORMATIONS).forEach(function (f) {
      formRow.appendChild(E("button", { class: "seg-btn" + (s.lineup.formation === f ? " active" : ""), text: f, on: { click: function () {
        s.lineup = TM.comp.buildLineup(userPlayerList(s), f); pickSlot = null; save(s); renderBoard();
      } } }));
    });
    screen.appendChild(E("div", { class: "panel-narrow" }, [ E("div", { class: "setting" }, [ E("div", { class: "setting-label", text: "Formação" }), formRow ]) ]));

    // atualiza EM LUGAR (não recarrega a tela nem reseta o scroll)
    var board = E("div", { class: "lineup-board" });
    screen.appendChild(board);

    function renderBoard() {
      board.innerHTML = "";
      var slots = TM.comp.FORMATIONS[s.lineup.formation];
      var pitch = E("div", { class: "pitch" });
      pitch.appendChild(E("div", { class: "pitch-mark center-circle" }));
      pitch.appendChild(E("div", { class: "pitch-mark mid-line" }));
      s.lineup.starters.forEach(function (id, i) {
        var p = TM.data.player(id); if (!p) return;
        var slot = slots[i] || [null, 50, 50];
        var chip = E("button", { class: "pl-chip" + (pickSlot === i ? " picked" : ""), style: "left:" + slot[1] + "%;top:" + slot[2] + "%",
          on: { click: function () { onStarterClick(i); } } }, [
          E("div", { class: "chip-face-wrap" }, [ TM.img.playerImg(p, "chip-face"), E("span", { class: "chip-ov", text: p.overall }) ]),
          E("span", { class: "chip-name", text: shortNm(p.name) }),
          E("span", { class: "chip-age", text: p.age + " anos" })
        ]);
        pitch.appendChild(chip);
      });
      board.appendChild(pitch);
      board.appendChild(E("div", { class: "lineup-hint", text: pickSlot != null ? "Toque em OUTRO titular para trocar as posições, ou num reserva para substituir. Toque no mesmo para cancelar." : "Toque num titular e depois em outro titular (troca de posição) ou num reserva (substituição)." }));

      var benchWrap = E("div", { class: "panel-narrow" }, [ E("h3", { class: "block-title", text: "Reservas" }) ]);
      (s.lineup.bench || []).forEach(function (id) {
        var p = TM.data.player(id); if (!p) return;
        var row = TM.ui.playerRow(p, {});
        row.classList.add("clickable");
        if (pickSlot != null) row.classList.add("row-target");
        row.addEventListener("click", function () { onBenchClick(id); });
        benchWrap.appendChild(row);
      });
      board.appendChild(benchWrap);
    }
    function onStarterClick(i) {
      if (pickSlot == null) { pickSlot = i; }
      else if (pickSlot === i) { pickSlot = null; }
      else {
        var tmp = s.lineup.starters[pickSlot];
        s.lineup.starters[pickSlot] = s.lineup.starters[i];
        s.lineup.starters[i] = tmp;
        pickSlot = null; save(s);
      }
      renderBoard();
    }
    function onBenchClick(benchId) {
      if (pickSlot == null) { TM.ui.toast("Selecione um titular primeiro"); return; }
      var starterId = s.lineup.starters[pickSlot], bi = s.lineup.bench.indexOf(benchId);
      s.lineup.starters[pickSlot] = benchId; s.lineup.bench[bi] = starterId;
      pickSlot = null; save(s); renderBoard();
    }
    renderBoard();
  });
  var pickSlot = null;
  function shortNm(name) { var parts = name.split(" "); return parts.length > 1 ? parts[0][0] + ". " + parts[parts.length - 1] : name; }

  TM.ui.register("compmode-play", function (screen) {
    var s = load(); var nx = advance(s);
    if (nx.end) { TM.ui.go("compmode-hub"); return; }
    var teamA = teamFor(s, nx.homeId), teamB = teamFor(s, nx.awayId);
    var userSide = nx.homeId === s.userId ? 0 : 1;
    var simOpts = { realism: realism(), neutral: true };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: s.name,
      pauseSide: userSide, simOpts: simOpts, formation: s.lineup ? s.lineup.formation : "4-4-2",
      onBack: function () { TM.ui.go("compmode-hub"); },
      onDone: function () {
        var hs = result.score[0], as = result.score[1];
        var penCtx = hs === as ? userPenContextComp(s, hs, as) : null;
        function finish(penWinnerId) {
          applyUser(s, hs, as, penWinnerId); save(s);
          TM.ui.go("compmode-result", { a: teamA.name, b: teamB.name, hs: hs, as: as, ko: nx.ko, penWinName: penWinnerId ? (penWinnerId === nx.homeId ? teamA.name : teamB.name) : null });
        }
        if (penCtx) {
          var tA = teamFor(s, penCtx.aId), tB = teamFor(s, penCtx.bId);
          var shoot = TM.engine.shootout(tA, tB);
          var winId = shoot.winner === 0 ? penCtx.aId : penCtx.bId;
          TM.ui.go("pen-shootout", { teamA: tA, teamB: tB, shoot: shoot, title: "Pênaltis · " + s.name, onDone: function () { finish(winId); } });
        } else { finish(null); }
      }
    });
  });

  TM.ui.register("compmode-result", function (screen, p) {
    var E = el();
    screen.appendChild(TM.ui.topbar("Resultado", function () { TM.ui.go("compmode-hub"); }));
    var win = p.hs > p.as ? p.a : p.as > p.hs ? p.b : null;
    screen.appendChild(E("div", { class: "result-hero" }, [
      E("div", { class: "result-score" }, [ E("span", { class: "rs-team", text: p.a }), E("span", { class: "rs-num", text: p.hs + " × " + p.as }), E("span", { class: "rs-team", text: p.b }) ]),
      E("div", { class: "result-tag", text: win ? "🏆 " + win + " venceu" : p.penWinName ? "🎯 " + p.penWinName + " venceu nos pênaltis" : (p.ko ? "Empate — decidido nos pênaltis" : "🤝 Empate") })
    ]));
    screen.appendChild(E("div", { class: "actions" }, [ TM.ui.button("Continuar", function () { TM.ui.go("compmode-hub"); }, "btn primary") ]));
  });

  TM.ui.register("compmode-view", function (screen) {
    var E = el();
    var s = load();
    screen.appendChild(TM.ui.topbar(s.kind === "league" ? "📊 Classificação" : "🏆 Chaveamento", function () { TM.ui.go("compmode-hub"); }));
    if (s.kind === "league") { renderLeagueTable(screen, s, s.table); return; }
    if (s.kind === "ko") { renderBracketKO(screen, s, s); return; }
    // tournament: grupos + chave
    var t = s.tour;
    if (t.phase === "group") {
      var wrap = E("div", { class: "panel-narrow" });
      t.groups.forEach(function (g, gi) {
        wrap.appendChild(E("div", { class: "group-title", text: "Grupo " + String.fromCharCode(65 + gi) }));
        wrap.appendChild(miniTable(s, g.table, s.userId));
      });
      screen.appendChild(wrap);
    } else {
      renderBracketKO(screen, s, t.ko);
      var champ = t.championId;
      if (champ) screen.insertBefore(E("div", { class: "champion-banner", text: "🏆 Campeão: " + nameFor(s, champ) }), screen.children[1]);
    }
  });

  function miniTable(s, table, userId) {
    var E = el();
    var tb = E("tbody");
    standings(table).forEach(function (row, i) {
      tb.appendChild(E("tr", { class: (row.id === userId ? "me " : "") + (i < 2 ? "qualify" : "") }, [
        E("td", { text: i + 1 }), E("td", { class: "lt-club" }, [ imgFor(s, row.id, "lt-crest"), E("span", { text: nameFor(s, row.id) }) ]),
        E("td", { class: "lt-pts", text: row.pts }), E("td", { text: row.p }), E("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
      ]));
    });
    return E("div", { class: "table-wrap" }, [ E("table", { class: "league-table" }, [ E("thead", {}, [ E("tr", {}, ["#", "Time", "P", "J", "SG"].map(function (h, i) { return E("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]), tb ]) ]);
  }
  function renderLeagueTable(screen, s, table) {
    var E = el();
    var tb = E("tbody");
    standings(table).forEach(function (row, i) {
      tb.appendChild(E("tr", { class: row.id === s.userId ? "me" : "" }, [
        E("td", { text: i + 1 }), E("td", { class: "lt-club" }, [ imgFor(s, row.id, "lt-crest"), E("span", { text: nameFor(s, row.id) }) ]),
        E("td", { class: "lt-pts", text: row.pts }), E("td", { text: row.p }), E("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
      ]));
    });
    screen.appendChild(E("div", { class: "table-wrap" }, [ E("table", { class: "league-table" }, [ E("thead", {}, [ E("tr", {}, ["#", "Time", "P", "J", "SG"].map(function (h, i) { return E("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]), tb ]) ]));
  }
  function renderBracketKO(screen, s, ko) {
    var E = el();
    if (ko.championId) screen.appendChild(E("div", { class: "champion-banner", text: "🏆 Campeão: " + nameFor(s, ko.championId) }));
    var wrap = E("div", { class: "bracket" });
    ko.rounds.forEach(function (rd) {
      if (!rd) return;
      var box = E("div", { class: "bracket-round" }, [ E("div", { class: "br-round-title", text: koTitle(rd.length * 2) }) ]);
      rd.forEach(function (tie) {
        var played = tie[4] != null, mine = tie[0] === s.userId || tie[1] === s.userId;
        box.appendChild(E("div", { class: "tie" + (mine ? " mine" : "") }, [
          E("div", { class: "tie-team" + (played && tie[4] === tie[0] ? " win" : played ? " lose" : "") }, [ imgFor(s, tie[0], "tie-crest"), E("span", { text: nameFor(s, tie[0]) }) ]),
          E("div", { class: "tie-score", text: played ? tie[2] + " - " + tie[3] : "vs" }),
          E("div", { class: "tie-team away" + (played && tie[4] === tie[1] ? " win" : played ? " lose" : "") }, [ E("span", { text: nameFor(s, tie[1]) }), imgFor(s, tie[1], "tie-crest") ])
        ]));
      });
      wrap.appendChild(box);
    });
    if (!ko.rounds.length) wrap.appendChild(E("p", { class: "intro-text", text: "Mata-mata ainda não começou." }));
    screen.appendChild(wrap);
  }
})(window);
