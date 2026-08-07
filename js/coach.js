/* ================= TOTAL MATCH — Carreira de Treinador ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  /* ---------- utilidades de temporada (liga em turno único) ---------- */
  // agenda circular (round-robin) para N times pares
  function roundRobin(ids) {
    var n = ids.length, arr = ids.slice(), rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var round = [];
      for (var i = 0; i < n / 2; i++) {
        var home = arr[i], away = arr[n - 1 - i];
        // alterna mando pra variar
        round.push(r % 2 === 0 ? [home, away] : [away, home]);
      }
      rounds.push(round);
      arr.splice(1, 0, arr.pop()); // rotaciona mantendo o primeiro
    }
    return rounds;
  }

  function emptyTable(clubIds) {
    var t = {};
    clubIds.forEach(function (id) { t[id] = { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
    return t;
  }
  function applyResult(table, homeId, awayId, hs, as) {
    var H = table[homeId], A = table[awayId];
    H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; A.l++; H.pts += 3; }
    else if (hs < as) { A.w++; H.l++; A.pts += 3; }
    else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  function standings(table) {
    return Object.keys(table).map(function (k) { return table[k]; }).sort(function (a, b) {
      return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf;
    });
  }

  function newClubCareer(clubId) {
    var club = TM.data.club(clubId);
    var league = TM.data.league(club.leagueId);
    var fixtures = roundRobin(league.clubIds.slice());
    return {
      type: "club", teamId: clubId, teamName: club.name, leagueId: club.leagueId,
      season: 1, round: 0, fixtures: fixtures,
      table: emptyTable(league.clubIds),
      results: {}, // "round" -> array de [h,a,hs,as]
      budget: 25 + Math.round(TM.data.clubRating(clubId) / 4) // milhões fictícios
    };
  }

  /* ---------- entrada do modo ---------- */
  TM.ui.register("coach", function (screen) {
    var saved = TM.storage.coachCareer();
    if (saved) { TM.ui.go("coach-hub"); return; }

    screen.appendChild(TM.ui.topbar("🎯 Carreira de Treinador", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Escolha um clube para comandar na temporada. Você define escalação, disputa o campeonato e movimenta o mercado." }));

    var pickLeague = "br", pickClub = null;
    var leagueSel = el("select", { class: "select" });
    TM.data.world().leagues.forEach(function (lg) {
      leagueSel.appendChild(el("option", { value: lg.id, text: lg.name }));
    });
    leagueSel.addEventListener("change", function () { pickLeague = leagueSel.value; pickClub = null; renderClubs(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Liga" }), leagueSel ]));

    var clubGrid = el("div", { class: "club-grid" });
    body.appendChild(clubGrid);

    function renderClubs() {
      TM.ui.clear(clubGrid);
      var league = TM.data.league(pickLeague);
      league.clubIds.map(TM.data.club).sort(function (a, b) { return TM.data.clubRating(b.id) - TM.data.clubRating(a.id); })
        .forEach(function (club) {
          var card = el("div", { class: "club-pick" + (pickClub === club.id ? " selected" : "") }, [
            TM.img.clubImg(club, "cp-crest"),
            el("div", { class: "cp-name", text: club.name }),
            TM.ui.ovBadge(TM.data.clubRating(club.id))
          ]);
          card.addEventListener("click", function () {
            pickClub = club.id;
            clubGrid.querySelectorAll(".club-pick").forEach(function (x) { x.classList.remove("selected"); });
            card.classList.add("selected");
          });
          clubGrid.appendChild(card);
        });
    }
    renderClubs();

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Começar carreira", function () {
        if (!pickClub) { TM.ui.toast("Escolha um clube"); return; }
        TM.storage.saveCoachCareer(newClubCareer(pickClub));
        TM.ui.go("coach-hub");
      }, "btn primary big")
    ]));
  });

  /* ---------- central (hub) ---------- */
  TM.ui.register("coach-hub", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    var club = TM.data.club(c.teamId);

    var right = el("button", { class: "tb-menu", text: "⋯", on: { click: function () {
      if (confirm("Encerrar esta carreira? O progresso será apagado.")) { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }
    } } });
    screen.appendChild(TM.ui.topbar("Carreira", function () { TM.ui.go("modes"); }, right));

    // cabeçalho do clube
    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [
        el("div", { class: "ch-name", text: club.name }),
        el("div", { class: "ch-sub", text: TM.data.league(c.leagueId).name + " · Temporada " + c.season }),
        el("div", { class: "ch-budget", text: "💰 Orçamento: € " + c.budget + "M" })
      ])
    ]));

    // próximo jogo
    var nextFix = null;
    if (c.round < c.fixtures.length) {
      c.fixtures[c.round].forEach(function (m) { if (m[0] === c.teamId || m[1] === c.teamId) nextFix = m; });
    }
    if (nextFix) {
      var isHome = nextFix[0] === c.teamId;
      var oppId = isHome ? nextFix[1] : nextFix[0];
      var opp = TM.data.club(oppId);
      screen.appendChild(el("div", { class: "next-match" }, [
        el("div", { class: "nm-label", text: "Rodada " + (c.round + 1) + " de " + c.fixtures.length + (isHome ? " · Em casa" : " · Fora") }),
        el("div", { class: "nm-teams" }, [
          el("span", { text: isHome ? club.name : opp.name }),
          el("span", { class: "nm-x", text: "×" }),
          el("span", { text: isHome ? opp.name : club.name })
        ]),
        TM.ui.button("▶ Jogar rodada", function () { playRound(c); }, "btn primary")
      ]));
    } else {
      // fim de temporada
      var st = standings(c.table);
      var pos = st.findIndex(function (r) { return r.id === c.teamId; }) + 1;
      screen.appendChild(el("div", { class: "next-match season-end" }, [
        el("div", { class: "nm-label", text: "🏁 Temporada encerrada" }),
        el("div", { class: "nm-teams", text: pos + "º lugar" }),
        TM.ui.button("Iniciar próxima temporada", function () {
          c.season++; c.round = 0; c.results = {};
          c.table = emptyTable(TM.data.league(c.leagueId).clubIds);
          c.fixtures = roundRobin(TM.data.league(c.leagueId).clubIds.slice());
          TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub");
        }, "btn primary")
      ]));
    }

    // atalhos
    screen.appendChild(el("div", { class: "hub-actions" }, [
      hubBtn("👥", "Elenco", function () { TM.ui.go("coach-squad"); }),
      hubBtn("📊", "Tabela", function () { TM.ui.go("coach-table"); }),
      hubBtn("🔁", "Mercado", function () { TM.ui.go("coach-market"); }),
      hubBtn("📅", "Resultados", function () { TM.ui.go("coach-results"); })
    ]));

    function hubBtn(icon, label, fn) {
      return el("button", { class: "hub-btn", on: { click: fn } }, [
        el("span", { class: "hub-ic", text: icon }), el("span", { text: label })
      ]);
    }
  });

  // joga a rodada: simula o jogo do usuário (com eventos) e os demais (rápido)
  function playRound(c) {
    var league = TM.data.league(c.leagueId);
    var settings = TM.storage.settings();
    var round = c.fixtures[c.round];
    var userMatch = null, userResult = null;
    var roundResults = [];

    round.forEach(function (m) {
      var A = TM.engine.teamFromClub(m[0]), B = TM.engine.teamFromClub(m[1]);
      var res = TM.engine.simulate(A, B, { realism: settings.realism });
      applyResult(c.table, m[0], m[1], res.score[0], res.score[1]);
      roundResults.push([m[0], m[1], res.score[0], res.score[1]]);
      if (m[0] === c.teamId || m[1] === c.teamId) { userMatch = { a: A, b: B }; userResult = res; }
    });
    c.results[c.round] = roundResults;
    c.round++;
    TM.storage.saveCoachCareer(c);

    TM.ui.go("coach-match", { a: userMatch.a, b: userMatch.b, result: userResult });
  }

  /* ---------- resultado do jogo do usuário ---------- */
  TM.ui.register("coach-match", function (screen, params) {
    var r = params.result, a = params.a, b = params.b;
    screen.appendChild(TM.ui.topbar("Sua partida", function () { TM.ui.go("coach-hub"); }));
    var win = r.score[0] > r.score[1] ? a.name : r.score[1] > r.score[0] ? b.name : null;
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [
        el("span", { class: "rs-team", text: a.name }),
        el("span", { class: "rs-num", text: r.score[0] + " × " + r.score[1] }),
        el("span", { class: "rs-team", text: b.name })
      ]),
      el("div", { class: "result-tag", text: win ? "🏆 " + win + " venceu" : "🤝 Empate" })
    ]));
    var feed = el("div", { class: "commentary-feed static" });
    r.events.filter(function (e) { return e.type === "goal" || e.type === "card"; })
      .forEach(function (e) { feed.appendChild(el("div", { class: "cm-line cm-" + e.type, text: e.text })); });
    if (!feed.children.length) feed.appendChild(el("div", { class: "cm-line", text: "Partida sem gols." }));
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Lances" }), feed ]));
    screen.appendChild(el("div", { class: "actions" }, [ TM.ui.button("Continuar", function () { TM.ui.go("coach-hub"); }, "btn primary") ]));
  });

  /* ---------- elenco ---------- */
  TM.ui.register("coach-squad", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("👥 Central do Elenco", function () { TM.ui.go("coach-hub"); }));
    var players = TM.data.clubPlayers(c.teamId);
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    players.sort(function (a, b) { return order[a.pos] - order[b.pos] || b.overall - a.overall; });
    var list = el("div", { class: "panel-narrow squad-list" });
    var lastPos = null;
    players.forEach(function (p) {
      if (p.pos !== lastPos) { list.appendChild(el("div", { class: "pos-header", text: fullPos(p.pos) })); lastPos = p.pos; }
      list.appendChild(TM.ui.playerRow(p, { onClick: function (pl) { showPlayer(pl); } }));
    });
    screen.appendChild(list);
  });

  function fullPos(p) { return { GK: "Goleiros", DF: "Defensores", MF: "Meio-campistas", FW: "Atacantes" }[p] || p; }

  function showPlayer(p) {
    var overlay = el("div", { class: "modal-overlay", on: { click: function (e) { if (e.target === overlay) overlay.remove(); } } });
    var attrs = p.attrs;
    function bar(label, v) {
      return el("div", { class: "attr" }, [
        el("span", { class: "attr-label", text: label }),
        el("div", { class: "attr-bar" }, [ el("div", { class: "attr-fill", style: "width:" + v + "%" }) ]),
        el("span", { class: "attr-val", text: v })
      ]);
    }
    overlay.appendChild(el("div", { class: "modal" }, [
      el("button", { class: "modal-close", text: "×", on: { click: function () { overlay.remove(); } } }),
      el("div", { class: "modal-head" }, [
        TM.img.playerImg(p, "modal-face"),
        el("div", {}, [
          el("div", { class: "modal-name", text: p.name }),
          el("div", { class: "modal-sub", text: p.pos + " · " + p.age + " anos · " + p.nationName }),
          el("div", { class: "modal-sub", text: p.height + " cm · " + p.weight + " kg" })
        ]),
        TM.ui.ovBadge(p.overall)
      ]),
      el("div", { class: "attrs" }, [
        bar("Velocidade", attrs.pac), bar("Finalização", attrs.sho), bar("Passe", attrs.pas),
        bar("Drible", attrs.dri), bar("Defesa", attrs.def), bar("Físico", attrs.phy)
      ])
    ]));
    document.body.appendChild(overlay);
  }
  TM.ui.showPlayer = showPlayer;

  /* ---------- tabela ---------- */
  TM.ui.register("coach-table", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("📊 Classificação", function () { TM.ui.go("coach-hub"); }));
    var st = standings(c.table);
    var table = el("table", { class: "league-table" });
    table.appendChild(el("thead", {}, [ el("tr", {}, [
      el("th", { text: "#" }), el("th", { class: "lt-club", text: "Clube" }),
      el("th", { text: "P" }), el("th", { text: "J" }), el("th", { text: "V" }),
      el("th", { text: "E" }), el("th", { text: "D" }), el("th", { text: "SG" })
    ]) ]));
    var tb = el("tbody");
    st.forEach(function (row, i) {
      var club = TM.data.club(row.id);
      var tr = el("tr", { class: row.id === c.teamId ? "me" : "" }, [
        el("td", { text: (i + 1) }),
        el("td", { class: "lt-club" }, [ TM.img.clubImg(club, "lt-crest"), el("span", { text: club.name }) ]),
        el("td", { class: "lt-pts", text: row.pts }),
        el("td", { text: row.p }), el("td", { text: row.w }), el("td", { text: row.d }),
        el("td", { text: row.l }), el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
      ]);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    screen.appendChild(el("div", { class: "table-wrap" }, [ table ]));
  });

  /* ---------- resultados ---------- */
  TM.ui.register("coach-results", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("📅 Resultados", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    var rounds = Object.keys(c.results).map(Number).sort(function (a, b) { return b - a; });
    if (!rounds.length) body.appendChild(el("p", { class: "intro-text", text: "Nenhuma rodada disputada ainda." }));
    rounds.forEach(function (rn) {
      body.appendChild(el("div", { class: "round-label", text: "Rodada " + (rn + 1) }));
      c.results[rn].forEach(function (m) {
        var isMine = m[0] === c.teamId || m[1] === c.teamId;
        body.appendChild(el("div", { class: "res-line" + (isMine ? " mine" : "") }, [
          el("span", { class: "res-h", text: TM.data.club(m[0]).name }),
          el("span", { class: "res-score", text: m[2] + " - " + m[3] }),
          el("span", { class: "res-a", text: TM.data.club(m[1]).name })
        ]));
      });
    });
    screen.appendChild(body);
  });

  /* ---------- mercado ---------- */
  TM.ui.register("coach-market", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🔁 Mercado", function () { TM.ui.go("coach-hub"); }));
    screen.appendChild(el("div", { class: "market-budget", text: "💰 Orçamento: € " + c.budget + "M" }));

    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Contrate jogadores de outros clubes da liga. O valor sai do seu orçamento." }));

    var league = TM.data.league(c.leagueId);
    var pool = [];
    league.clubIds.forEach(function (cid) {
      if (cid === c.teamId) return;
      TM.data.clubPlayers(cid).slice(0, 6).forEach(function (p) { pool.push(p); });
    });
    pool.sort(function (a, b) { return b.overall - a.overall; });
    pool.slice(0, 40).forEach(function (p) {
      var price = Math.max(1, Math.round(Math.pow(Math.max(1, p.overall - 55), 1.7) / 6));
      var row = TM.ui.playerRow(p, {});
      row.appendChild(el("button", { class: "buy-btn", text: "€ " + price + "M", on: { click: function () {
        if (c.budget < price) { TM.ui.toast("Orçamento insuficiente"); return; }
        // transferência: muda o clube do jogador e recalcula
        c.budget -= price;
        p.clubId = c.teamId;
        var club = TM.data.club(c.teamId);
        // remove do antigo e adiciona no novo (no mundo em memória desta sessão)
        TM.data.world().clubs.forEach(function (cl) {
          var i = cl.playerIds.indexOf(p.id);
          if (i >= 0 && cl.id !== c.teamId) cl.playerIds.splice(i, 1);
        });
        if (club.playerIds.indexOf(p.id) < 0) club.playerIds.push(p.id);
        TM.storage.saveCoachCareer(c);
        TM.ui.toast("✔ " + p.name + " contratado!");
        TM.ui.go("coach-market");
      } } }));
      body.appendChild(row);
    });
  });
})(window);
