/* ================= TOTAL MATCH — Carreira de Treinador ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };

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
      TM.ui.button("Começar carreira", function () {
        if (!pickClub) { TM.ui.toast("Escolha um clube"); return; }
        TM.storage.saveCoachCareer(C().newClubCareer(pickClub));
        TM.ui.go("coach-hub");
      }, "btn primary big")
    ]));
  });

  /* ---------- hub ---------- */
  TM.ui.register("coach-hub", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    var club = TM.data.club(c.teamId);
    var right = el("button", { class: "tb-menu", text: "⋯", on: { click: function () {
      if (confirm("Encerrar esta carreira? O progresso será apagado.")) { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }
    } } });
    screen.appendChild(TM.ui.topbar("Carreira", function () { TM.ui.go("modes"); }, right));

    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [
        el("div", { class: "ch-name", text: club.name }),
        el("div", { class: "ch-sub", text: TM.data.league(c.leagueId).name + " · Temporada " + c.season }),
        el("div", { class: "ch-budget", text: "💰 Orçamento: € " + c.budget + "M" })
      ])
    ]));

    var pending = C().advanceToUserMatch(c);
    if (pending.seasonEnd) {
      renderSeasonEnd(screen, c);
    } else {
      var homeClub = TM.data.club(pending.homeId), awayClub = TM.data.club(pending.awayId);
      var badge = pending.key === "cup" ? "cup" : pending.key === "cont" ? "cont" : "league";
      screen.appendChild(el("div", { class: "next-match" }, [
        el("div", { class: "nm-label" }, [ document.createTextNode(pending.name), el("span", { class: "comp-badge " + badge, text: pending.ko ? "Mata-mata" : "Liga" }) ]),
        el("div", { class: "nm-teams" }, [ el("span", { text: homeClub.name }), el("span", { class: "nm-x", text: "×" }), el("span", { text: awayClub.name }) ]),
        TM.ui.button("▶ Jogar", function () { TM.ui.go("coach-play"); }, "btn primary")
      ]));
    }

    screen.appendChild(el("div", { class: "hub-actions" }, [
      hubBtn("👥", "Elenco", function () { TM.ui.go("coach-squad"); }),
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
    if (c.comps.cont && c.comps.cont.championId === c.teamId) titles.push("🏆 Campeão da " + c.comps.cont.name);
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
    var result = TM.engine.simulate(teamA, teamB, { realism: TM.storage.settings().realism, neutral: p.ko });
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: p.name,
      onBack: function () { TM.ui.go("coach-hub"); },
      onDone: function () {
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
    else renderBracket(screen, c, c.comps[active]);
  });

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
      list.appendChild(TM.ui.playerRow(p, { onClick: function (pl) { TM.ui.showPlayer(pl); } }));
    });
    screen.appendChild(list);
  });

  /* ---------- mercado: busca ---------- */
  TM.ui.register("coach-market", function (screen, params) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🔁 Mercado", function () { TM.ui.go("coach-hub"); }));
    screen.appendChild(el("div", { class: "market-budget", text: "💰 Orçamento: € " + c.budget + "M" }));

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
      results = all.filter(function (p) { return !rosterSet[p.id] && p.name.toLowerCase().indexOf(q) >= 0; });
    } else {
      // sem busca: jogadores que cabem no orçamento (melhores primeiro)
      results = all.filter(function (p) { return !rosterSet[p.id] && askingPrice(p) <= c.budget; });
    }
    results.sort(function (a, b) { return b.overall - a.overall; });
    results = results.slice(0, 40);

    if (!query.trim()) body.appendChild(el("p", { class: "intro-text", text: "Jogadores dentro do seu orçamento. Use a busca para procurar qualquer jogador pelo nome." }));
    if (!results.length) body.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador encontrado." }));
    results.forEach(function (p) {
      var row = TM.ui.playerRow(p, {});
      row.classList.add("clickable");
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
    var asking = askingPrice(p);
    var state = { bid: Math.round(asking * 0.8), rounds: 0, agreed: false };

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
    var quote = el("div", { class: "nego-quote", text: sellClub.name + ": “Pedimos € " + asking + "M por " + p.name + ".”" });
    var bidVal = el("span", { class: "range-val", text: "€ " + state.bid + "M" });
    var slider = el("input", { type: "range", min: 1, max: c.budget, value: Math.min(state.bid, c.budget), class: "slider" });
    slider.addEventListener("input", function () { state.bid = parseInt(slider.value, 10); bidVal.textContent = "€ " + state.bid + "M"; });

    var actionWrap = el("div", { class: "actions", style: "margin-top:6px" });
    var offerBtn = TM.ui.button("Fazer proposta", function () {
      state.rounds++;
      if (state.bid > c.budget) { quote.className = "nego-quote angry"; quote.textContent = "Seu orçamento é de apenas € " + c.budget + "M."; return; }
      if (state.bid >= asking * 0.95) {
        quote.className = "nego-quote happy"; quote.textContent = sellClub.name + ": “Aceito! " + p.name + " é seu por € " + state.bid + "M. Agora acerte com o jogador.”";
        state.agreed = true;
        actionWrap.querySelector(".next-step").style.display = "block";
        offerBtn.disabled = true;
      } else if (state.bid >= asking * 0.78) {
        asking = Math.round(asking * 0.93);
        quote.className = "nego-quote"; quote.textContent = sellClub.name + ": “Está perto... aceitamos por € " + asking + "M.”";
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
    var demand = wageDemand(p);
    var terms = { wage: demand, years: 3, role: "titular", release: false };

    screen.appendChild(TM.ui.topbar("Negociação", function () { TM.ui.go("coach-market"); }));
    screen.appendChild(el("div", { class: "nego-step" }, [
      el("div", { class: "nego-dot done", text: "1. Com o clube ✓" }),
      el("div", { class: "nego-dot active", text: "2. Com o jogador" })
    ]));

    var panel = el("div", { class: "nego-panel" });
    screen.appendChild(panel);
    var quote = el("div", { class: "nego-quote", text: p.name + ": “Quero cerca de € " + demand + "M por ano e um papel de destaque.”" });
    panel.appendChild(quote);

    // salário
    var wageVal = el("span", { class: "range-val", text: "€ " + terms.wage + "M/ano" });
    var wageSlider = el("input", { type: "range", min: 1, max: demand * 3, value: terms.wage, class: "slider" });
    wageSlider.addEventListener("input", function () { terms.wage = parseInt(wageSlider.value, 10); wageVal.textContent = "€ " + terms.wage + "M/ano"; });
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
        quote.className = "nego-quote angry"; quote.textContent = p.name + ": “Salário insuficiente. Quero pelo menos € " + demand + "M/ano.”";
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
})(window);
