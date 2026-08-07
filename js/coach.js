/* ================= TOTAL MATCH — Carreira de Treinador ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };

  function sym(c) { return c.money ? c.money.sym : "€"; }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function curVal(c, eur) { return Math.round(eur * mult(c)); }          // euro -> moeda da carreira
  function money(c, cur) { return sym(c) + " " + cur + "M"; }            // valor já na moeda da carreira

  function roundTitle(nTies) { return ({ 8: "Oitavas de final", 4: "Quartas de final", 2: "Semifinal", 1: "Final" })[nTies] || (nTies * 2 + " times"); }

  /* ---------- entrada ---------- */
  TM.ui.register("coach", function (screen) {
    if (TM.storage.coachCareer()) { TM.ui.go("coach-hub"); return; }
    screen.appendChild(TM.ui.topbar("🎯 Carreira de Treinador", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Escolha um clube. Você disputa a liga, a copa nacional e (se classificado) a competição continental." }));

    var pickLeague = "br", pickClub = null;
    var leagueSel = el("select", { class: "select" });
    TM.data.world().leagues.forEach(function (lg) { leagueSel.appendChild(el("option", { value: lg.id, text: lg.name })); });
    leagueSel.addEventListener("change", function () { pickLeague = leagueSel.value; pickClub = null; renderClubs(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Liga" }), leagueSel ]));

    var clubGrid = el("div", { class: "club-grid" });
    body.appendChild(clubGrid);
    function renderClubs() {
      TM.ui.clear(clubGrid);
      TM.data.league(pickLeague).clubIds.map(TM.data.club).sort(function (a, b) { return TM.data.clubRating(b.id) - TM.data.clubRating(a.id); })
        .forEach(function (club) {
          var card = el("div", { class: "club-pick" + (pickClub === club.id ? " selected" : "") }, [
            TM.img.clubImg(club, "cp-crest"), el("div", { class: "cp-name", text: club.name }), TM.ui.ovBadge(TM.data.clubRating(club.id))
          ]);
          card.addEventListener("click", function () {
            pickClub = club.id; clubGrid.querySelectorAll(".club-pick").forEach(function (x) { x.classList.remove("selected"); }); card.classList.add("selected");
          });
          clubGrid.appendChild(card);
        });
    }
    renderClubs();
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Continuar →", function () {
        if (!pickClub) { TM.ui.toast("Escolha um clube"); return; }
        TM.ui.go("coach-setup", { clubId: pickClub });
      }, "btn primary big")
    ]));
  });

  /* ---------- opções pré-carreira: moeda + aporte ---------- */
  TM.ui.register("coach-setup", function (screen, params) {
    var clubId = params.clubId;
    var club = TM.data.club(clubId);
    var opts = { currency: "eur", injection: 0 };

    screen.appendChild(TM.ui.topbar("Opções da carreira", function () { TM.ui.go("coach"); }));
    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [ el("div", { class: "ch-name", text: club.name }), el("div", { class: "ch-sub", text: TM.data.league(club.leagueId).name } ) ])
    ]));

    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // moeda
    var curWrap = el("div", { class: "segmented full" });
    var CUR = C().CURRENCIES;
    [["eur", "Euro €"], ["brl", "Real R$"], ["usd", "Dólar US$"], ["jpy", "Iene ¥"]].forEach(function (o) {
      var b = el("button", { class: "seg-btn" + (opts.currency === o[0] ? " active" : ""), text: o[1], on: { click: function () {
        opts.currency = o[0]; curWrap.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active"); updateInfo();
      } } });
      curWrap.appendChild(b);
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Moeda do jogo" }), curWrap ]));

    // aporte financeiro
    var injVal = el("span", { class: "range-val" });
    var injSlider = el("input", { type: "range", min: 0, max: 700, step: 10, value: 0, class: "slider" });
    injSlider.addEventListener("input", function () { opts.injection = parseInt(injSlider.value, 10); updateInfo(); });
    body.appendChild(el("div", { class: "setting" }, [
      el("div", { class: "setting-label" }, [ document.createTextNode("Aporte financeiro (opcional)"), injVal ]),
      injSlider,
      el("div", { class: "setting-hint", text: "Uma injeção de dinheiro no seu orçamento, até 700 milhões. A moeda afeta os valores dos jogadores nas contratações." })
    ]));

    var summary = el("div", { class: "market-budget" });
    body.appendChild(summary);
    function updateInfo() {
      var m = CUR[opts.currency];
      injVal.textContent = m.sym + " " + opts.injection + "M";
      var baseEur = 30 + Math.round(TM.data.clubRating(clubId) / 3);
      var total = Math.round(baseEur * m.mult) + opts.injection;
      summary.textContent = "💰 Orçamento inicial: " + m.sym + " " + total + "M";
    }
    updateInfo();

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Começar carreira", function () {
        TM.storage.saveCoachCareer(C().newClubCareer(clubId, opts));
        TM.ui.go("coach-hub");
      }, "btn primary big")
    ]));
  });

  /* ---------- hub ---------- */
  TM.ui.register("coach-hub", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    C().migrateCareer(c); TM.storage.saveCoachCareer(c);
    var club = TM.data.club(c.teamId);
    var unread = TM.notify.unread(c);
    var bell = el("button", { class: "tb-bell", on: { click: function () { TM.ui.go("coach-notifications"); } } }, [
      el("span", { text: "🔔" }), unread ? el("span", { class: "bell-badge", text: unread > 9 ? "9+" : unread }) : null
    ]);
    var dots = el("button", { class: "tb-menu", text: "⋯", on: { click: function () {
      TM.ui.optionsMenu("Opções da carreira", [
        { label: "💾 Salvar carreira", fn: function () { TM.storage.saveCoachCareer(c); TM.ui.toast("✔ Carreira salva"); } },
        { label: "🏠 Voltar ao menu", fn: function () { TM.ui.go("modes"); } },
        { label: "🗑️ Finalizar carreira", danger: true, fn: function () {
          if (confirm("Finalizar esta carreira? O progresso será apagado.")) { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }
        } }
      ]);
    } } });
    var right = el("div", { class: "tb-actions" }, [ bell, dots ]);
    screen.appendChild(TM.ui.topbar("Carreira", function () { TM.ui.go("modes"); }, right));

    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [
        el("div", { class: "ch-name", text: club.name }),
        el("div", { class: "ch-sub", text: TM.data.league(c.leagueId).name + " · Temporada " + c.season }),
        el("div", { class: "ch-budget", text: "💰 Orçamento: " + money(c, c.budget) })
      ])
    ]));

    var pending = C().advanceToUserMatch(c);
    if (pending.seasonEnd) {
      renderSeasonEnd(screen, c);
    } else {
      var homeClub = TM.data.club(pending.homeId), awayClub = TM.data.club(pending.awayId);
      var badge = pending.key === "cup" ? "cup" : pending.key === "cont" ? "cont" : "league";
      var badgeText = pending.label ? pending.label : (pending.ko ? "Mata-mata" : "Liga");
      screen.appendChild(el("div", { class: "next-match" }, [
        el("div", { class: "nm-label" }, [ document.createTextNode(pending.name + "  "), el("span", { class: "comp-badge " + badge, text: badgeText }) ]),
        el("div", { class: "nm-teams" }, [ el("span", { text: homeClub.name }), el("span", { class: "nm-x", text: "×" }), el("span", { text: awayClub.name }) ]),
        TM.ui.button("▶ Jogar", function () { TM.ui.go("coach-play"); }, "btn primary")
      ]));
    }

    screen.appendChild(el("div", { class: "hub-actions six" }, [
      hubBtn("👥", "Elenco", function () { TM.ui.go("coach-squad"); }),
      hubBtn("📋", "Escalação", function () { TM.ui.go("coach-lineup"); }),
      hubBtn("🌱", "Base", function () { TM.ui.go("coach-youth"); }),
      hubBtn("🏆", "Competições", function () { TM.ui.go("coach-comps"); }),
      hubBtn("🔁", "Mercado", function () { TM.ui.go("coach-market"); }),
      hubBtn("🗂️", "Títulos", function () { TM.ui.go("coach-honours"); })
    ]));
    function hubBtn(icon, label, fn) { return el("button", { class: "hub-btn", on: { click: fn } }, [ el("span", { class: "hub-ic", text: icon }), el("span", { text: label }) ]); }
  });

  function renderSeasonEnd(screen, c) {
    var st = C().standings(c.comps.league.table);
    var pos = st.findIndex(function (r) { return r.id === c.teamId; }) + 1;
    var titles = [];
    if (st[0].id === c.teamId) titles.push("🏆 Campeão da " + c.comps.league.name);
    if (c.comps.cup && c.comps.cup.championId === c.teamId) titles.push("🏆 Campeão da " + c.comps.cup.name);
    if (c.comps.cont && c.comps.cont.tour && c.comps.cont.tour.championId === c.teamId) titles.push("🏆 Campeão da " + c.comps.cont.name);
    var box = el("div", { class: "next-match season-end" }, [
      el("div", { class: "nm-label", text: "🏁 Fim da temporada " + c.season }),
      el("div", { class: "nm-teams", text: pos + "º na liga" })
    ]);
    titles.forEach(function (t) { box.appendChild(el("div", { class: "obj-desc", text: t })); });
    box.appendChild(TM.ui.button("Iniciar próxima temporada", function () { C().newSeason(c); TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }, "btn primary"));
    screen.appendChild(box);
  }

  /* ---------- jogar a partida pendente ---------- */
  TM.ui.register("coach-play", function (screen) {
    var c = TM.storage.coachCareer();
    var p = c.pending && !c.pending.seasonEnd ? c.pending : C().advanceToUserMatch(c);
    if (p.seasonEnd) { TM.ui.go("coach-hub"); return; }
    var teamA = C().anyTeam(c, p.homeId), teamB = C().anyTeam(c, p.awayId);
    var userSide = p.homeId === c.teamId ? 0 : 1;
    var result = TM.engine.simulate(teamA, teamB, {
      realism: TM.storage.settings().realism, neutral: p.ko,
      tacticSide: userSide, tactic: c.tactic
    });
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: p.name,
      onBack: function () { TM.ui.go("coach-hub"); },
      onDone: function () {
        C().processUserMatch(c, result, userSide);
        C().applyUserResult(c, result.score[0], result.score[1]);
        TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result, ko: p.ko });
      }
    });
  });

  TM.ui.register("coach-match", function (screen, params) {
    var r = params.result, a = params.teamA, b = params.teamB;
    screen.appendChild(TM.ui.topbar("Sua partida", function () { TM.ui.go("coach-hub"); }));
    var win = r.score[0] > r.score[1] ? a.name : r.score[1] > r.score[0] ? b.name : null;
    var tag = win ? "🏆 " + win + " venceu" : (params.ko ? "Empate — decidido nos pênaltis" : "🤝 Empate");
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [
        el("span", { class: "rs-team", text: a.name }), el("span", { class: "rs-num", text: r.score[0] + " × " + r.score[1] }), el("span", { class: "rs-team", text: b.name })
      ]),
      el("div", { class: "result-tag", text: tag })
    ]));
    var feed = el("div", { class: "commentary-feed static" });
    r.events.filter(function (e) { return /goal|red|penalty/.test(e.type); }).forEach(function (e) {
      feed.appendChild(el("div", { class: "cm-line cm-" + (e.type.indexOf("goal") >= 0 ? "goal" : "card"), text: (e.minute) + "' " + (e.player ? "⚽ " + e.player : e.text) }));
    });
    if (!feed.children.length) feed.appendChild(el("div", { class: "cm-line", text: "Partida sem gols." }));
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Lances" }), feed ]));
    screen.appendChild(el("div", { class: "actions" }, [ TM.ui.button("Continuar", function () { TM.ui.go("coach-hub"); }, "btn primary") ]));
  });

  /* ---------- competições ---------- */
  TM.ui.register("coach-comps", function (screen, params) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🏆 Competições", function () { TM.ui.go("coach-hub"); }));
    var tabs = [ { key: "league", label: c.comps.league.name } ];
    if (c.comps.cup) tabs.push({ key: "cup", label: c.comps.cup.name });
    if (c.comps.cont) tabs.push({ key: "cont", label: c.comps.cont.name });
    var active = (params && params.tab) || "league";

    var tabRow = el("div", { class: "comp-tabs" });
    tabs.forEach(function (t) {
      tabRow.appendChild(el("button", { class: "comp-tab" + (active === t.key ? " active" : ""), on: { click: function () { TM.ui.go("coach-comps", { tab: t.key }); } } }, [
        el("span", { class: "ct-name", text: t.label })
      ]));
    });
    screen.appendChild(tabRow);

    if (active === "league") renderLeague(screen, c);
    else if (c.comps[active].type === "tournament") renderTournament(screen, c, c.comps[active]);
    else renderBracket(screen, c, c.comps[active]);
  });

  // continental (grupos + mata-mata)
  function renderTournament(screen, c, comp) {
    var t = comp.tour;
    if (t.championId) screen.appendChild(el("div", { class: "champion-banner", text: "🏆 Campeão: " + TM.data.club(t.championId).name }));
    if (t.phase === "group") {
      var wrap = el("div", { class: "panel-narrow" });
      t.groups.forEach(function (g, gi) {
        wrap.appendChild(el("div", { class: "group-title", text: "Grupo " + String.fromCharCode(65 + gi) }));
        var st = C().standings(g.table), tb = el("tbody");
        st.forEach(function (row, i) {
          var club = TM.data.club(row.id);
          tb.appendChild(el("tr", { class: (row.id === c.teamId ? "me " : "") + (i < 2 ? "qualify" : "") }, [
            el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.clubImg(club, "lt-crest"), el("span", { text: club.name }) ]),
            el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
          ]));
        });
        wrap.appendChild(el("div", { class: "table-wrap" }, [ el("table", { class: "league-table" }, [ el("thead", {}, [ el("tr", {}, ["#", "Clube", "P", "J", "SG"].map(function (h, i) { return el("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]), tb ]) ]));
      });
      screen.appendChild(wrap);
    } else {
      renderBracket(screen, c, t.ko);
    }
  }

  function renderLeague(screen, c) {
    var st = C().standings(c.comps.league.table);
    var table = el("table", { class: "league-table" }, [ el("thead", {}, [ el("tr", {}, ["#", "Clube", "P", "J", "V", "E", "D", "SG"].map(function (h, i) { return el("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]) ]);
    var tb = el("tbody");
    st.forEach(function (row, i) {
      var club = TM.data.club(row.id);
      tb.appendChild(el("tr", { class: row.id === c.teamId ? "me" : "" }, [
        el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.clubImg(club, "lt-crest"), el("span", { text: club.name }) ]),
        el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: row.w }), el("td", { text: row.d }), el("td", { text: row.l }),
        el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
      ]));
    });
    table.appendChild(tb);
    screen.appendChild(el("div", { class: "table-wrap" }, [ table ]));
  }

  function renderBracket(screen, c, ko) {
    if (ko.championId) {
      var champ = TM.data.club(ko.championId);
      screen.appendChild(el("div", { class: "champion-banner", text: "🏆 Campeão: " + champ.name }));
    }
    var wrap = el("div", { class: "bracket" });
    ko.rounds.forEach(function (round, ri) {
      if (!round) return;
      var rd = el("div", { class: "bracket-round" }, [ el("div", { class: "br-round-title", text: roundTitle(round.length) }) ]);
      round.forEach(function (tie) {
        var mine = tie[0] === c.teamId || tie[1] === c.teamId;
        var played = tie[4] != null;
        var hClub = TM.data.club(tie[0]), aClub = TM.data.club(tie[1]);
        rd.appendChild(el("div", { class: "tie" + (mine ? " mine" : "") }, [
          el("div", { class: "tie-team" + (played && tie[4] === tie[0] ? " win" : played ? " lose" : "") }, [ TM.img.clubImg(hClub, "tie-crest"), el("span", { text: hClub.name }) ]),
          el("div", { class: "tie-score", text: played ? tie[2] + " - " + tie[3] : "vs" }),
          el("div", { class: "tie-team away" + (played && tie[4] === tie[1] ? " win" : played ? " lose" : "") }, [ el("span", { text: aClub.name }), TM.img.clubImg(aClub, "tie-crest") ])
        ]));
      });
      wrap.appendChild(rd);
    });
    if (!ko.rounds.length) wrap.appendChild(el("p", { class: "intro-text", text: "Competição ainda não começou." }));
    screen.appendChild(wrap);
  }

  /* ---------- títulos ---------- */
  TM.ui.register("coach-honours", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🗂️ Títulos & Histórico", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    if (!c.honours.length) body.appendChild(el("p", { class: "intro-text", text: "Complete uma temporada para registrar seu histórico." }));
    c.honours.slice().reverse().forEach(function (h) {
      var wins = [];
      if (h.leagueChampion) wins.push("🏆 Liga");
      if (h.cupChampion) wins.push("🏆 Copa");
      if (h.contChampion) wins.push("🏆 Continental");
      body.appendChild(el("div", { class: "hist-line" }, [
        el("span", { text: "Temporada " + h.season }),
        el("span", { text: h.leaguePos + "º na liga" }),
        el("span", { text: wins.length ? wins.join("  ") : "—" })
      ]));
    });
    screen.appendChild(body);
  });

  /* ---------- elenco ---------- */
  TM.ui.register("coach-squad", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("👥 Central do Elenco", function () { TM.ui.go("coach-hub"); }));
    var players = C().userSquad(c);
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    players.sort(function (a, b) { return order[a.pos] - order[b.pos] || b.overall - a.overall; });
    var list = el("div", { class: "panel-narrow squad-list" });
    var lastPos = null;
    players.forEach(function (p) {
      if (p.pos !== lastPos) { list.appendChild(el("div", { class: "pos-header", text: ({ GK: "Goleiros", DF: "Defensores", MF: "Meio-campistas", FW: "Atacantes" })[p.pos] })); lastPos = p.pos; }
      list.appendChild(TM.ui.playerRow(p, { onClick: function (pl) { TM.ui.showPlayer(pl, { moneySym: sym(c), moneyMult: mult(c) }); } }));
    });
    screen.appendChild(list);
  });

  /* ---------- mercado: busca ---------- */
  TM.ui.register("coach-market", function (screen, params) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🔁 Mercado", function () { TM.ui.go("coach-hub"); }));
    screen.appendChild(el("div", { class: "market-budget", text: "💰 Orçamento: " + money(c, c.budget) }));

    var query = (params && params.q) || "";
    var input = el("input", { class: "text-input", type: "text", placeholder: "Pesquisar jogador pelo nome...", value: query });
    var searchBtn = TM.ui.button("Buscar", function () { TM.ui.go("coach-market", { q: input.value }); }, "btn");
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") TM.ui.go("coach-market", { q: input.value }); });
    screen.appendChild(el("div", { class: "search-bar" }, [ input, searchBtn ]));

    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    var world = TM.data.world();
    var rosterSet = {}; c.roster.forEach(function (id) { rosterSet[id] = true; });
    var all = Object.keys(world.playersById).map(function (id) { return world.playersById[id]; });
    var results;
    if (query.trim()) {
      var q = query.trim().toLowerCase();
      results = all.filter(function (p) { return !rosterSet[p.id] && p.name.toLowerCase().indexOf(q) >= 0; })
        .sort(function (a, b) { return b.overall - a.overall; }).slice(0, 50);
    } else {
      // sem busca: VITRINE variada — jovens promessas, estrelas e veteranos (todos os níveis)
      var pool = all.filter(function (p) { return !rosterSet[p.id]; });
      var buckets = { u20: [], p24: [], p29: [], vet: [] };
      pool.forEach(function (p) {
        var k = p.age <= 20 ? "u20" : p.age <= 24 ? "p24" : p.age <= 29 ? "p29" : "vet";
        buckets[k].push(p);
      });
      results = [];
      Object.keys(buckets).forEach(function (k) {
        buckets[k].sort(function (a, b) { return b.overall - a.overall; });
        results = results.concat(buckets[k].slice(0, 16));
      });
      results.sort(function (a, b) { return b.overall - a.overall; });
    }

    if (!query.trim()) body.appendChild(el("p", { class: "intro-text", text: "Vitrine de reforços — jovens promessas, estrelas e veteranos. Nem todos cabem no orçamento; a checagem é na negociação. Use a busca para achar qualquer jogador." }));
    if (!results.length) body.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador encontrado." }));
    results.forEach(function (p) {
      var price = curVal(c, askingPrice(p));
      var afford = price <= c.budget;
      var row = TM.ui.playerRow(p, {});
      row.classList.add("clickable");
      row.appendChild(el("div", { class: "price-tag" + (afford ? "" : " over") }, [
        el("span", { text: money(c, price) }),
        el("span", { class: "price-note", text: afford ? "no orçamento" : "acima" })
      ]));
      row.addEventListener("click", function () { TM.ui.go("coach-nego-club", { pid: p.id }); });
      body.appendChild(row);
    });
  });

  /* ---------- negociação: com o clube ---------- */
  function askingPrice(p) { return Math.max(1, Math.round(Math.pow(Math.max(1, p.overall - 50), 1.8) / 7 * (p.age < 24 ? 1.3 : p.age > 31 ? 0.6 : 1))); }
  function wageDemand(p) { return Math.max(5, Math.round(Math.pow(Math.max(1, p.overall - 55), 1.5) / 3)); }

  TM.ui.register("coach-nego-club", function (screen, params) {
    var c = TM.storage.coachCareer();
    var p = TM.data.player(params.pid);
    var sellClub = TM.data.club(p.clubId);
    var asking = curVal(c, askingPrice(p));
    var state = { bid: Math.min(Math.round(asking * 0.8), c.budget), rounds: 0, agreed: false };

    screen.appendChild(TM.ui.topbar("Negociação", function () { TM.ui.go("coach-market"); }));
    screen.appendChild(el("div", { class: "nego-step" }, [
      el("div", { class: "nego-dot active", text: "1. Com o clube" }),
      el("div", { class: "nego-dot", text: "2. Com o jogador" })
    ]));

    screen.appendChild(el("div", { class: "player-card" }, [
      TM.img.playerImg(p, "pc-face"),
      el("div", { class: "pc-info" }, [ el("div", { class: "pc-name", text: p.name }), el("div", { class: "pc-sub", text: p.pos + " · " + p.age + " anos · " + sellClub.name }) ]),
      TM.ui.ovBadge(p.overall)
    ]));

    var panel = el("div", { class: "nego-panel" });
    screen.appendChild(panel);
    var quote = el("div", { class: "nego-quote", text: sellClub.name + ": “Pedimos " + money(c, asking) + " por " + p.name + ".”" });
    var bidVal = el("span", { class: "range-val", text: money(c, state.bid) });
    var slider = el("input", { type: "range", min: 1, max: c.budget, value: Math.min(state.bid, c.budget), class: "slider" });
    slider.addEventListener("input", function () { state.bid = parseInt(slider.value, 10); bidVal.textContent = money(c, state.bid); });

    var actionWrap = el("div", { class: "actions", style: "margin-top:6px" });
    var offerBtn = TM.ui.button("Fazer proposta", function () {
      state.rounds++;
      if (state.bid > c.budget) { quote.className = "nego-quote angry"; quote.textContent = "Seu orçamento é de apenas " + money(c, c.budget) + "."; return; }
      if (state.bid >= asking * 0.95) {
        quote.className = "nego-quote happy"; quote.textContent = sellClub.name + ": “Aceito! " + p.name + " é seu por " + money(c, state.bid) + ". Agora acerte com o jogador.”";
        state.agreed = true;
        actionWrap.querySelector(".next-step").style.display = "block";
        offerBtn.disabled = true;
      } else if (state.bid >= asking * 0.78) {
        asking = Math.round(asking * 0.93);
        quote.className = "nego-quote"; quote.textContent = sellClub.name + ": “Está perto... aceitamos por " + money(c, asking) + ".”";
      } else {
        quote.className = "nego-quote angry"; quote.textContent = sellClub.name + ": “Muito baixo. Nem pensar.”";
        if (state.rounds >= 4) { quote.textContent = sellClub.name + " encerrou a conversa. Tente outro valor mais alto."; }
      }
    }, "btn primary");
    var nextBtn = TM.ui.button("Negociar com o jogador →", function () {
      NEGO = { pid: p.id, oldClubId: p.clubId, fee: state.bid };
      TM.ui.go("coach-nego-player");
    }, "btn primary next-step");
    nextBtn.style.display = "none";

    panel.appendChild(quote);
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Sua proposta pela transferência" }), el("div", { class: "range-wrap" }, [ slider, bidVal ]) ]));
    actionWrap.appendChild(offerBtn);
    actionWrap.appendChild(nextBtn);
    screen.appendChild(actionWrap);
  });

  var NEGO = null;

  /* ---------- negociação: com o jogador ---------- */
  TM.ui.register("coach-nego-player", function (screen) {
    var c = TM.storage.coachCareer();
    if (!NEGO) { TM.ui.go("coach-market"); return; }
    var p = TM.data.player(NEGO.pid);
    var demand = curVal(c, wageDemand(p));
    var terms = { wage: demand, years: 3, role: "titular", release: false };

    screen.appendChild(TM.ui.topbar("Negociação", function () { TM.ui.go("coach-market"); }));
    screen.appendChild(el("div", { class: "nego-step" }, [
      el("div", { class: "nego-dot done", text: "1. Com o clube ✓" }),
      el("div", { class: "nego-dot active", text: "2. Com o jogador" })
    ]));

    var panel = el("div", { class: "nego-panel" });
    screen.appendChild(panel);
    var quote = el("div", { class: "nego-quote", text: p.name + ": “Quero cerca de " + money(c, demand) + " por ano e um papel de destaque.”" });
    panel.appendChild(quote);

    // salário
    var wageVal = el("span", { class: "range-val", text: money(c, terms.wage) + "/ano" });
    var wageSlider = el("input", { type: "range", min: 1, max: demand * 3, value: terms.wage, class: "slider" });
    wageSlider.addEventListener("input", function () { terms.wage = parseInt(wageSlider.value, 10); wageVal.textContent = money(c, terms.wage) + "/ano"; });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Salário anual" }), el("div", { class: "range-wrap" }, [ wageSlider, wageVal ]) ]));

    // tempo de contrato
    var yearsSeg = seg(["1", "2", "3", "4", "5"], "3", function (v) { terms.years = parseInt(v, 10); });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Tempo de contrato (anos)" }), yearsSeg ]));

    // função no elenco
    var roleSeg = seg([["estrela", "Estrela"], ["titular", "Titular"], ["rodizio", "Rodízio"], ["promessa", "Promessa"]], "titular", function (v) { terms.role = v; });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Função no elenco" }), roleSeg ]));

    // cláusula de rescisão
    var relBtn = el("button", { class: "switch" + (terms.release ? " on" : ""), on: { click: function () { terms.release = !terms.release; relBtn.classList.toggle("on", terms.release); } } }, [ el("span", { class: "switch-knob" }) ]);
    panel.appendChild(el("div", { class: "nego-field", style: "flex-direction:row;justify-content:space-between;align-items:center" }, [ el("label", { text: "Incluir cláusula de rescisão" }), relBtn ]));

    var actionWrap = el("div", { class: "actions" });
    var proposeBtn = TM.ui.button("Oferecer contrato", function () {
      // avaliação do jogador
      var roleScore = { estrela: 1.2, titular: 1.0, rodizio: 0.7, promessa: 0.6 }[terms.role];
      var wageOk = terms.wage >= demand * (terms.role === "promessa" || terms.role === "rodizio" ? 1.15 : 0.9);
      var roleOk = !((p.overall >= 80 && (terms.role === "rodizio" || terms.role === "promessa")));
      if (wageOk && roleOk) {
        // fechado!
        c.budget -= NEGO.fee;
        c.roster.push(p.id);
        c.signedFrom[p.id] = NEGO.oldClubId;
        TM.storage.saveCoachCareer(c);
        quote.className = "nego-quote happy"; quote.textContent = "✔ " + p.name + " assinou com o " + TM.data.club(c.teamId).name + "!";
        actionWrap.innerHTML = "";
        actionWrap.appendChild(TM.ui.button("Voltar ao mercado", function () { NEGO = null; TM.ui.go("coach-market"); }, "btn primary"));
      } else if (!roleOk) {
        quote.className = "nego-quote angry"; quote.textContent = p.name + ": “Sou titular indiscutível. Não aceito função de reserva.”";
      } else {
        quote.className = "nego-quote angry"; quote.textContent = p.name + ": “Salário insuficiente. Quero pelo menos " + money(c, demand) + "/ano.”";
      }
    }, "btn primary");
    actionWrap.appendChild(proposeBtn);
    screen.appendChild(actionWrap);

    function seg(options, def, cb) {
      var wrap = el("div", { class: "segmented full" });
      options.forEach(function (o) {
        var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o;
        var b = el("button", { class: "seg-btn" + (val === def ? " active" : ""), text: lab, on: { click: function () { cb(val); wrap.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active"); } } });
        wrap.appendChild(b);
      });
      return wrap;
    }
  });

  /* ---------- central de notificações ---------- */
  TM.ui.register("coach-notifications", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🔔 Avisos", function () { TM.notify.markAllRead(c); TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var notes = c.notifications || [];
    if (!notes.length) { body.appendChild(el("p", { class: "intro-text", text: "Nenhum aviso no momento." })); }
    notes.forEach(function (n) {
      var card = el("div", { class: "note" + (n.read ? "" : " unread") }, [
        el("div", { class: "note-ic", text: n.icon || "•" }),
        el("div", { class: "note-body" }, [ el("div", { class: "note-title", text: n.title }), el("div", { class: "note-text", text: n.text }) ])
      ]);
      if (n.offer) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("Analisar proposta", function () { TM.ui.go("coach-offer", { noteId: n.id }); }, "btn primary small")
        ]));
      }
      body.appendChild(card);
    });
    // marca como lido ao visualizar
    TM.notify.markAllRead(c); TM.storage.saveCoachCareer(c);
  });

  /* ---------- analisar proposta recebida ---------- */
  TM.ui.register("coach-offer", function (screen, params) {
    var c = TM.storage.coachCareer();
    var note = TM.notify.get(c, params.noteId);
    if (!note || !note.offer) { TM.ui.go("coach-notifications"); return; }
    var off = note.offer;
    var player = C().resolvePlayer(c, off.playerId);
    var buyer = TM.data.club(off.buyerId);

    screen.appendChild(TM.ui.topbar("Analisar proposta", function () { TM.ui.go("coach-notifications"); }));
    screen.appendChild(el("div", { class: "player-card" }, [
      TM.img.playerImg(player, "pc-face"),
      el("div", { class: "pc-info" }, [ el("div", { class: "pc-name", text: player.name }), el("div", { class: "pc-sub", text: player.pos + " · " + player.age + " anos · " + player.nationName }) ]),
      TM.ui.ovBadge(player.overall)
    ]));

    function line(label, val, cls) { return el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: label }), el("span", { class: "deal-val " + (cls || ""), text: val }) ]); }
    var value = curVal(c, TM.data.marketValue(player));
    screen.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "🏟️ " + buyer.name + " quer contratar " + player.name + "." }),
      line("Clube interessado", buyer.name),
      line("Overall do clube", TM.data.clubRating(off.buyerId)),
      line("Valor de mercado", money(c, value)),
      line("Proposta oferecida", money(c, off.fee), off.fee >= value ? "good" : "bad"),
      line("Diferença", (off.fee - value >= 0 ? "+" : "") + money(c, off.fee - value), off.fee >= value ? "good" : "bad"),
      el("div", { class: "setting-hint", text: off.fee >= value ? "A proposta está acima do valor de mercado — bom negócio." : "A proposta está abaixo do valor de mercado." })
    ]));

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("✅ Aceitar proposta", function () {
        var r = C().resolveIncomingOffer(c, note, true); TM.storage.saveCoachCareer(c);
        TM.ui.toast(r === "vendido" ? "Jogador vendido!" : "O jogador recusou sair."); TM.ui.go("coach-notifications");
      }, "btn primary"),
      TM.ui.button("❌ Recusar", function () { C().resolveIncomingOffer(c, note, false); TM.storage.saveCoachCareer(c); TM.ui.go("coach-notifications"); }, "btn ghost")
    ]));
  });

  /* ---------- escalação (campinho) ---------- */
  var pickSlot = null; // índice de titular selecionado para troca
  TM.ui.register("coach-lineup", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.lineup) c.lineup = C().buildLineup(C().rosterPlayers(c), "4-4-2");
    screen.appendChild(TM.ui.topbar("📋 Escalação", function () { pickSlot = null; TM.ui.go("coach-hub"); }));

    // formação
    var formRow = el("div", { class: "segmented full" });
    Object.keys(C().FORMATIONS).forEach(function (f) {
      formRow.appendChild(el("button", { class: "seg-btn" + (c.lineup.formation === f ? " active" : ""), text: f, on: { click: function () {
        c.lineup = C().buildLineup(C().rosterPlayers(c), f); pickSlot = null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-lineup");
      } } }));
    });
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Formação" }), formRow ]) ]));

    // tática
    var tacRow = el("div", { class: "segmented full" });
    [["defensivo", "Defensivo"], ["equilibrado", "Equilibrado"], ["ofensivo", "Ofensivo"], ["contra-ataque", "Contra-ataque"]].forEach(function (o) {
      tacRow.appendChild(el("button", { class: "seg-btn" + (c.tactic === o[0] ? " active" : ""), text: o[1], on: { click: function () { c.tactic = o[0]; TM.storage.saveCoachCareer(c); TM.ui.go("coach-lineup"); } } }));
    });
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Tática" }), tacRow ]) ]));

    // campinho
    var slots = C().FORMATIONS[c.lineup.formation];
    var pitch = el("div", { class: "pitch" });
    pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
    pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
    c.lineup.starters.forEach(function (id, i) {
      var p = C().resolvePlayer(c, id); if (!p) return;
      var slot = slots[i] || [null, 50, 50];
      var unavail = !C().available(c, id);
      var chip = el("button", { class: "pl-chip" + (pickSlot === i ? " picked" : "") + (unavail ? " unavail" : ""),
        style: "left:" + slot[1] + "%;top:" + slot[2] + "%",
        on: { click: function () { onStarterClick(i); } } }, [
        el("span", { class: "chip-ov", text: p.overall }),
        el("span", { class: "chip-name", text: shortName(p.name) }),
        unavail ? el("span", { class: "chip-flag", text: c.injuries[id] ? "🚑" : "🟥" }) : null
      ]);
      pitch.appendChild(chip);
    });
    screen.appendChild(pitch);

    screen.appendChild(el("div", { class: "lineup-hint", text: pickSlot != null ? "Toque num reserva para colocar no lugar do titular selecionado." : "Toque num titular e depois num reserva para trocar." }));

    // reservas
    var benchWrap = el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Reservas" }) ]);
    c.lineup.bench.forEach(function (id) {
      var p = C().resolvePlayer(c, id); if (!p) return;
      var unavail = !C().available(c, id);
      var row = TM.ui.playerRow(p, {});
      row.classList.add("clickable");
      if (unavail) row.classList.add("row-unavail");
      row.addEventListener("click", function () { onBenchClick(id); });
      benchWrap.appendChild(row);
    });
    screen.appendChild(benchWrap);

    function onStarterClick(i) { pickSlot = (pickSlot === i ? null : i); TM.ui.go("coach-lineup"); }
    function onBenchClick(benchId) {
      if (pickSlot == null) { TM.ui.toast("Selecione um titular primeiro"); return; }
      var starterId = c.lineup.starters[pickSlot];
      var bi = c.lineup.bench.indexOf(benchId);
      c.lineup.starters[pickSlot] = benchId;
      c.lineup.bench[bi] = starterId;
      pickSlot = null;
      TM.storage.saveCoachCareer(c);
      TM.ui.go("coach-lineup");
    }
  });
  function shortName(name) { var parts = name.split(" "); return parts.length > 1 ? parts[0][0] + ". " + parts[parts.length - 1] : name; }

  /* ---------- categorias de base ---------- */
  TM.ui.register("coach-youth", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🌱 Categorias de Base", function () { TM.ui.go("coach-hub"); }));
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("p", { class: "intro-text", text: "Elenco da base do seu clube. Promova jogadores de 15 anos ou mais para o profissional, ou dispute uma partida de base." }),
      TM.ui.button("⚽ Disputar partida de base", function () { TM.ui.go("coach-youth-match"); }, "btn primary")
    ]));

    var list = el("div", { class: "panel-narrow squad-list" });
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    (c.youth || []).slice().sort(function (a, b) { return order[a.pos] - order[b.pos] || b.potential - a.potential; }).forEach(function (p) {
      var row = TM.ui.playerRow(p, { onClick: function (pl) { TM.ui.showPlayer(pl, { moneySym: sym(c), moneyMult: mult(c) }); } });
      var canPromote = p.age >= 15;
      row.appendChild(el("button", { class: "buy-btn" + (canPromote ? "" : " disabled"), text: canPromote ? "Subir ↑" : p.age + " anos", on: { click: function (e) {
        e.stopPropagation();
        if (!canPromote) { TM.ui.toast("Mínimo de 15 anos para promover"); return; }
        if (C().promoteYouth(c, p.id)) { TM.storage.saveCoachCareer(c); TM.ui.toast("✔ " + p.name + " promovido ao profissional!"); TM.ui.go("coach-youth"); }
      } } }));
      list.appendChild(row);
    });
    if (!(c.youth || []).length) list.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador na base (todos promovidos)." }));
    screen.appendChild(list);
  });

  TM.ui.register("coach-youth-match", function (screen) {
    var c = TM.storage.coachCareer();
    var club = TM.data.club(c.teamId);
    var myYouth = (c.youth || []).slice().sort(function (a, b) { return b.overall - a.overall; });
    if (myYouth.length < 7) { TM.ui.toast("Base insuficiente para jogar"); TM.ui.go("coach-youth"); return; }
    // adversário: base gerada de outro clube da liga
    var others = TM.data.league(c.leagueId).clubIds.filter(function (id) { return id !== c.teamId; });
    var oppId = others[Math.floor(Math.random() * others.length)];
    var oppYouth = C().generateYouth(oppId).sort(function (a, b) { return b.overall - a.overall; });
    var teamA = { id: "myb", name: club.name + " Sub-19", players: myYouth, club: club };
    var teamB = { id: "opb", name: TM.data.club(oppId).name + " Sub-19", players: oppYouth, club: TM.data.club(oppId) };
    var result = TM.engine.simulate(teamA, teamB, { realism: TM.storage.settings().realism });
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: "Partida de Base",
      onBack: function () { TM.ui.go("coach-youth"); },
      onDone: function () { TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result }); }
    });
  });
})(window);
