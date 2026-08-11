/* ================= TOTAL MATCH — Carreira de Dirigente ================= */
/* O dirigente cuida da gestão interna do clube: contrata/demite técnicos,
   cuida das finanças (caixa, dívidas, folha salarial), melhora o CT, influencia
   nas contratações e assiste os resultados — os jogos são comandados pelo
   técnico contratado (auto-simulados). Não escala nem define tática. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function money(c, v) { return C().fmtMoney(c, v); }
  function mult(c) { return c.money ? c.money.mult : 1; }

  /* ---------- economia dos técnicos ---------- */
  var ELITE = {
    "Pep Guardiola": 92, "Carlo Ancelotti": 90, "Jürgen Klopp": 90, "Luis Enrique": 88, "Diego Simeone": 88,
    "Antonio Conte": 87, "Zinedine Zidane": 87, "José Mourinho": 86, "Hansi Flick": 86, "Xabi Alonso": 85,
    "Arne Slot": 85, "Mikel Arteta": 85, "Marcelo Gallardo": 85, "Julian Nagelsmann": 85, "Mauricio Pochettino": 84,
    "Unai Emery": 84, "Abel Ferreira": 84, "Vincent Kompany": 83, "Roberto De Zerbi": 83, "Rúben Amorim": 83,
    "Massimiliano Allegri": 82, "Luciano Spalletti": 82, "Tite": 82, "Niko Kovač": 81, "Enzo Maresca": 81,
    "Jorge Sampaoli": 81, "Ange Postecoglou": 80, "Marco Silva": 80, "Simone Inzaghi": 84, "Sérgio Conceição": 80
  };
  function hashName(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function coachRating(co) {
    if (ELITE[co.name] != null) return ELITE[co.name];
    var base = 63 + (hashName(co.name) % 16); // 63..78
    if (co.age >= 58 && co.age <= 66) base += 1; // experiência
    return Math.max(60, Math.min(83, base));
  }
  // custo de contratação (compensação ao clube atual) — em euros milhões, antes da moeda
  function hireCostEur(r) {
    if (r >= 90) return 55; if (r >= 87) return 38; if (r >= 84) return 24; if (r >= 81) return 15;
    if (r >= 78) return 9; if (r >= 74) return 5; if (r >= 70) return 2.5; return 1;
  }
  // salário por temporada — em euros milhões
  function salaryEur(r) {
    if (r >= 90) return 20; if (r >= 87) return 14; if (r >= 84) return 9; if (r >= 81) return 6;
    if (r >= 78) return 4; if (r >= 74) return 2.4; if (r >= 70) return 1.3; return 0.7;
  }
  function coachHireCost(c, r) { return Math.round(hireCostEur(r) * mult(c)); }
  function coachSalary(c, r) { return Math.round(salaryEur(r) * mult(c)); }
  function makeContract(c, co, months) {
    var r = coachRating(co);
    return { id: co.id, name: co.name, rating: r, salaryM: coachSalary(c, r), contractMonths: months, photoKey: co.photoKey, age: co.age };
  }
  function interino(c) {
    return { id: "interino", name: "Técnico interino", rating: 68, salaryM: Math.round(0.6 * mult(c)), contractMonths: 6, photoKey: null, age: 50, isInterino: true };
  }

  /* ---------- CT (centro de treinamento) ---------- */
  var CT_UP_EUR = { 2: 12, 3: 28, 4: 55, 5: 95 };     // custo p/ chegar ao nível (euros M)
  function ctUpgradeCost(c, toLevel) { return Math.round((CT_UP_EUR[toLevel] || 0) * mult(c)); }
  function ctUpkeep(c, level) { return Math.round(level * 1.2 * mult(c)); }
  function ctDesc(level) {
    return ["", "Básico", "Modesto", "Bom", "Excelente", "Elite mundial"][level] || "—";
  }

  /* ---------- folha salarial / receita ---------- */
  function seasonWageBill(career) {
    var sum = 0;
    C().rosterPlayers(career).forEach(function (p) { sum += TM.data.marketValue(p) * 0.075; });
    return Math.round(sum * mult(career));
  }
  function seasonBaseIncomeEur(clubId) {
    var r = TM.data.clubRating(clubId);
    return 15 + Math.max(0, (r - 60)) * 3.4; // 60→15, 75→66, 90→117 (euros M)
  }
  function matchesPerSeason(career) { return Math.max(30, (career.order || []).length); }

  /* ---------- edge do técnico + CT nos resultados ---------- */
  function teamEdge(career) {
    var co = career.coach || interino(career);
    var e = (co.rating - 72) / 6 + (career.ctLevel - 2) * 0.4;
    return Math.max(-3, Math.min(3, e));
  }

  /* ---------- criar a carreira de dirigente ---------- */
  function start(clubId, opts) {
    var career = C().newClubCareer(clubId, opts);
    career.type = "director";
    career.role = "dirigente";
    var club = TM.data.club(clubId);
    var initial = club.coachId ? TM.data.coaches().filter(function (x) { return x.id === club.coachId; })[0] : null;
    if (!initial) { var all = TM.data.coaches(); initial = all[hashName(clubId) % all.length]; }
    career.coach = makeContract(career, initial, 24);
    career.ctLevel = 2;
    career.wagesM = seasonWageBill(career);
    career.fin = { incomeM: 0, expenseM: 0 };      // acumulado da temporada
    career.aporteUsedSeason = false;
    career._lastSim = null;
    TM.notify.push(career, { icon: "🧑‍💼", title: "Novo dirigente", text: "Você assumiu a gestão do " + club.name + ". Comande as finanças, o CT e o comando técnico." });
    TM.notify.push(career, { icon: "👔", title: "Técnico do elenco", text: career.coach.name + " (" + career.coach.rating + ") comanda o time. Contrato de 24 meses." });
    TM.storage.saveCoachCareer(career);
    return career;
  }

  function ensureDirector(career) {
    if (!career) return career;
    if (career.ctLevel == null) career.ctLevel = 2;
    if (!career.coach) career.coach = interino(career);
    if (!career.fin) career.fin = { incomeM: 0, expenseM: 0 };
    if (career.wagesM == null) career.wagesM = seasonWageBill(career);
    if (career.aporteUsedSeason == null) career.aporteUsedSeason = false;
    return career;
  }

  /* ---------- avançar um jogo (o técnico comanda) ---------- */
  function advance(career) {
    var p = C().advanceToUserMatch(career);
    if (p.seasonEnd) return { seasonEnd: true };
    var teamA = C().anyTeam(career, p.homeId), teamB = C().anyTeam(career, p.awayId);
    var userSide = p.homeId === career.teamId ? 0 : 1;
    var opts = { realism: TM.storage.settings().realism, neutral: p.ko, moraleBoost: teamEdge(career), moraleSide: userSide };
    var result = TM.engine.simulate(teamA, teamB, opts);
    C().processUserMatch(career, result, userSide);
    var hs = result.score[0], as = result.score[1], penWinnerId = null;
    if (hs === as) {
      var ctx = C().userPenContext(career, hs, as);
      if (ctx) { var sh = TM.engine.shootout(C().anyTeam(career, ctx.aId), C().anyTeam(career, ctx.bId)); penWinnerId = sh.winner === 0 ? ctx.aId : ctx.bId; }
    }
    // finanças do jogo
    var mps = matchesPerSeason(career);
    var incomeMatch = Math.round(seasonBaseIncomeEur(career.teamId) / mps * mult(career));
    var homeBonus = userSide === 0 ? Math.round(seasonBaseIncomeEur(career.teamId) / mps * 0.4 * mult(career)) : 0;
    var income = incomeMatch + homeBonus;
    var expense = Math.round((career.wagesM + career.coach.salaryM + ctUpkeep(career, career.ctLevel)) / mps);
    career.budget += income - expense;
    career.fin.incomeM += income; career.fin.expenseM += expense;
    // contrato do técnico corre
    career.coach.contractMonths = Math.max(0, career.coach.contractMonths - 12 / mps);
    if (career.coach.contractMonths <= 0 && !career.coach._expiredNotified) {
      career.coach._expiredNotified = true;
      TM.notify.push(career, { icon: "⌛", title: "Contrato encerrado", text: "O contrato de " + career.coach.name + " chegou ao fim. Renove ou contrate um novo técnico em 🧑‍💼 Técnico." });
    }
    C().applyUserResult(career, hs, as, penWinnerId);
    var meScore = result.score[userSide], opScore = result.score[1 - userSide];
    career._lastSim = {
      oppName: TM.data.club(userSide === 0 ? p.awayId : p.homeId).name,
      oppId: userSide === 0 ? p.awayId : p.homeId,
      me: meScore, op: opScore, home: userSide === 0, compName: p.name,
      res: meScore > opScore ? "V" : meScore < opScore ? "D" : "E",
      penWin: penWinnerId ? (penWinnerId === career.teamId) : null
    };
    TM.storage.saveCoachCareer(career);
    return { ok: true };
  }

  /* ================= HUB ================= */
  TM.ui.register("director-hub", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    if (c.type !== "director") { TM.ui.go("coach-hub"); return; }
    C().migrateCareer(c); ensureDirector(c); C().processCalendar(c); TM.storage.saveCoachCareer(c);
    var club = TM.data.club(c.teamId);

    var unread = TM.notify.unread(c);
    var bell = el("button", { class: "tb-bell", on: { click: function () { TM.ui.go("coach-notifications"); } } }, [
      el("span", { text: "🔔" }), unread ? el("span", { class: "bell-badge", text: unread > 9 ? "9+" : unread }) : null
    ]);
    var dots = el("button", { class: "tb-menu", text: "⋯", on: { click: function () {
      TM.ui.optionsMenu("Opções da carreira", [
        { label: "💾 Salvar (continuar jogando)", fn: function () { TM.storage.saveCoachCareer(c); TM.ui.toast("✔ Carreira salva"); } },
        { label: "📤 Salvar e sair", fn: function () { TM.saves.park("coach"); TM.ui.toast("Carreira guardada em Minhas Carreiras"); TM.ui.go("modes"); } },
        { label: "🏠 Voltar ao menu (sem sair)", fn: function () { TM.ui.go("modes"); } },
        { label: "🗑️ Finalizar carreira", danger: true, fn: function () {
          TM.ui.confirm("Finalizar esta carreira?", "O progresso será apagado permanentemente.", "Finalizar", function () { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }, true);
        } }
      ]);
    } } });
    screen.appendChild(TM.ui.topbar("Dirigente", function () { TM.ui.go("modes"); }, el("div", { class: "tb-actions" }, [ bell, dots ])));

    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [
        el("div", { class: "ch-name", text: club.name }),
        el("div", { class: "ch-sub", text: TM.data.league(c.leagueId).name + " · Temporada " + c.season }),
        el("div", { class: "ch-budget" + (c.budget < 0 ? " debt" : ""), text: (c.budget < 0 ? "🔴 Dívida: " : "💰 Caixa: ") + money(c, c.budget) })
      ]),
      el("div", { class: "dir-badge", text: "🧑‍💼 Dirigente" })
    ]));

    // resumo financeiro rápido
    var saldo = c.fin.incomeM - c.fin.expenseM;
    screen.appendChild(el("div", { class: "stat-tiles dir-fin" }, [
      finTile("Caixa", money(c, c.budget), c.budget < 0 ? "bad" : ""),
      finTile("Saldo da temporada", (saldo >= 0 ? "+" : "") + money(c, saldo), saldo < 0 ? "bad" : "good"),
      finTile("Folha (temp.)", money(c, c.wagesM), ""),
      finTile("CT", "Nível " + c.ctLevel, "")
    ]));

    // técnico atual
    var co = c.coach;
    var months = Math.round(co.contractMonths);
    screen.appendChild(el("button", { class: "dir-coach-card", on: { click: function () { TM.ui.go("director-coach"); } } }, [
      coachFace(co, "dc-face"),
      el("div", { class: "dc-info" }, [
        el("div", { class: "dc-name", text: "👔 " + co.name + (co.isInterino ? " (interino)" : "") }),
        el("div", { class: "dc-sub", text: "Overall " + co.rating + " · salário " + money(c, co.salaryM) + "/temp · contrato " + months + " mês(es)" })
      ]),
      TM.ui.ovBadge(co.rating)
    ]));

    // meta da diretoria
    var pos = C().currentPosition(c);
    screen.appendChild(el("div", { class: "objective" }, [
      el("span", { class: "obj-ic", text: "🎯" }),
      el("div", {}, [
        el("div", { class: "obj-desc", text: "Meta: " + c.objective.desc }),
        el("div", { class: "obj-prog", text: "Posição atual: " + pos + "º" + (pos <= c.objective.maxPos ? " ✓" : " ⚠") })
      ])
    ]));

    // último resultado + próximo jogo (auto-simulado pelo técnico)
    var pend = C().advanceToUserMatch(c);
    if (pend.seasonEnd) {
      directorSeasonEnd(screen, c);
    } else {
      if (c._lastSim) {
        var ls = c._lastSim;
        var cls = ls.res === "V" ? "good" : ls.res === "D" ? "bad" : "";
        screen.appendChild(el("div", { class: "dir-last " + cls }, [
          el("span", { class: "dl-lbl", text: "Último jogo · " + ls.compName }),
          el("span", { class: "dl-score" }, [
            el("span", { text: club.name + " " }),
            el("strong", { text: ls.home ? (ls.me + " × " + ls.op) : (ls.op + " × " + ls.me) }),
            el("span", { text: " " + ls.oppName })
          ]),
          el("span", { class: "dl-tag", text: ls.penWin === true ? "✔ venceu nos pênaltis" : ls.penWin === false ? "✖ perdeu nos pênaltis" : (ls.res === "V" ? "Vitória" : ls.res === "D" ? "Derrota" : "Empate") })
        ]));
      }
      var homeClub = TM.data.club(pend.homeId), awayClub = TM.data.club(pend.awayId);
      var card = el("div", { class: "next-match" }, [
        el("div", { class: "nm-label", text: "Próximo jogo · " + (pend.label || pend.name) }),
        el("div", { class: "nm-teams" }, [
          TM.img.clubImg(homeClub, "nm-crest"), el("span", { text: homeClub.name }),
          el("span", { class: "nm-x", text: "×" }),
          el("span", { text: awayClub.name }), TM.img.clubImg(awayClub, "nm-crest")
        ]),
        el("div", { class: "setting-hint", style: "text-align:center", text: "🎥 O técnico " + co.name + " comanda a equipe." }),
        TM.ui.button("▶ Avançar jogo", function () {
          var r = advance(c);
          if (r.seasonEnd) { TM.storage.saveCoachCareer(c); }
          TM.ui.go("director-hub");
        }, "btn primary")
      ]);
      var compId = TM.coachCompId ? TM.coachCompId(c, pend.key) : null;
      if (compId) { TM.ui.applyCompTheme(card, compId); var banner = TM.ui.compBanner(compId, pend.label || pend.name); if (banner) card.insertBefore(banner, card.firstChild); }
      screen.appendChild(card);
    }

    // ações do dirigente (sem escalação/tática/jogar)
    screen.appendChild(el("div", { class: "hub-actions six" }, [
      dbtn("🧑‍💼", "Técnico", "director-coach"),
      dbtn("💰", "Finanças", "director-finance"),
      dbtn("🏟️", "CT", "director-ct"),
      dbtn("🔁", "Mercado", "coach-market"),
      dbtn("👥", "Elenco", "coach-squad"),
      dbtn("🏆", "Competições", "coach-comps"),
      dbtn("📅", "Calendário", "coach-calendar"),
      dbtn("🗂️", "Títulos", "coach-honours")
    ]));
    function dbtn(icon, label, route) { return el("button", { class: "hub-btn", on: { click: function () { TM.ui.go(route); } } }, [ el("span", { class: "hub-ic", text: icon }), el("span", { text: label }) ]); }
  });

  function finTile(label, val, cls) {
    return el("div", { class: "tile " + (cls || "") }, [ el("div", { class: "tile-val", text: val }), el("div", { class: "tile-lbl", text: label }) ]);
  }
  function coachFace(co, cls) {
    if (co.photoKey) { var fake = { id: co.id, name: co.name, photoKey: co.photoKey }; return TM.img.coachImg(fake, cls); }
    return el("div", { class: cls + " placeholder", text: "👔" });
  }

  function directorSeasonEnd(screen, c) {
    var st = C().standings(c.comps.league.table);
    var pos = st.findIndex(function (r) { return r.id === c.teamId; }) + 1;
    var ev = C().evaluateObjective(c);
    var saldo = c.fin.incomeM - c.fin.expenseM;
    var box = el("div", { class: "next-match season-end" }, [
      el("div", { class: "nm-label", text: "🏁 Fim da temporada " + c.season }),
      el("div", { class: "nm-teams", text: pos + "º na liga" }),
      el("div", { class: "obj-desc", text: "Balanço financeiro: " + (saldo >= 0 ? "+" : "") + money(c, saldo) + " · Caixa final: " + money(c, c.budget) })
    ]);
    if (ev.met) {
      box.appendChild(el("div", { class: "obj-result good", text: "✔ Meta cumprida: " + c.objective.desc }));
      box.appendChild(TM.ui.button("Iniciar próxima temporada", function () {
        C().newSeason(c);
        c.wagesM = seasonWageBill(c); c.fin = { incomeM: 0, expenseM: 0 }; c.aporteUsedSeason = false; c._lastSim = null;
        TM.storage.saveCoachCareer(c); TM.ui.go("director-hub");
      }, "btn primary"));
    } else {
      box.appendChild(el("div", { class: "obj-result bad", text: "✖ Meta NÃO cumprida (" + c.objective.desc + ")" }));
      box.classList.add("fired");
      box.appendChild(el("div", { class: "fired-msg", text: "🚪 A diretoria decidiu encerrar o seu ciclo como dirigente." }));
      box.appendChild(TM.ui.button("Encerrar carreira", function () { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }, "btn primary"));
    }
    screen.appendChild(box);
  }

  /* ================= TÉCNICO: contratar / demitir ================= */
  function fireFine(c) {
    var co = c.coach; if (!co || co.isInterino) return 0;
    if (co.contractMonths <= 6) return 0;
    return Math.round(co.salaryM * (co.contractMonths / 12) * 0.6);
  }
  TM.ui.register("director-coach", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("🧑‍💼 Comando técnico", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // técnico atual
    var co = c.coach, months = Math.round(co.contractMonths), fine = fireFine(c);
    body.appendChild(el("div", { class: "player-card" }, [
      coachFace(co, "pc-face"),
      el("div", { class: "pc-info" }, [
        el("div", { class: "pc-name", text: co.name + (co.isInterino ? " (interino)" : "") }),
        el("div", { class: "pc-sub", text: co.age + " anos · salário " + money(c, co.salaryM) + "/temp · contrato " + months + " mês(es)" })
      ]),
      TM.ui.ovBadge(co.rating)
    ]));
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: fine > 0
        ? "⚠️ Demitir agora custa uma multa rescisória de " + money(c, fine) + " (contrato com mais de 6 meses)."
        : "Sem multa: o contrato tem 6 meses ou menos." }),
      TM.ui.button("🚪 Demitir técnico", function () {
        TM.ui.confirm("Demitir " + co.name + "?", fine > 0 ? "Você pagará " + money(c, fine) + " de multa. Um interino assume até você contratar." : "Um interino assume até você contratar.", "Demitir", function () {
          if (fine > 0) { c.budget -= fine; c.fin.expenseM += fine; }
          TM.notify.push(c, { icon: "🚪", title: "Técnico demitido", text: co.name + " foi demitido" + (fine > 0 ? " (multa de " + money(c, fine) + ")" : "") + ". Um interino assume o comando." });
          c.coach = interino(c);
          TM.storage.saveCoachCareer(c); TM.ui.go("director-coach");
        }, true);
      }, "btn ghost")
    ]));

    // mercado de técnicos
    body.appendChild(el("div", { class: "list-head", text: "Contratar novo técnico" }));
    var search = el("input", { class: "text-input", type: "text", placeholder: "🔎 Buscar técnico…" });
    body.appendChild(search);
    var list = el("div", { class: "coach-hire-list" });
    body.appendChild(list);

    var pool = TM.data.coaches().filter(function (x) { return x.id !== co.id; })
      .map(function (x) { return { co: x, r: coachRating(x) }; })
      .sort(function (a, b) { return b.r - a.r; });
    function render(q) {
      TM.ui.clear(list);
      pool.filter(function (o) { return !q || o.co.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 60).forEach(function (o) {
        var cost = coachHireCost(c, o.r), sal = coachSalary(c, o.r);
        var afford = c.budget >= cost;
        var row = el("div", { class: "coach-hire" }, [
          coachFace(o.co, "chh-face"),
          el("div", { class: "chh-info" }, [
            el("div", { class: "chh-name", text: o.co.name }),
            el("div", { class: "chh-sub", text: "Custo " + money(c, cost) + " · salário " + money(c, sal) + "/temp" })
          ]),
          TM.ui.ovBadge(o.r),
          TM.ui.button("Contratar", function () {
            if (!afford) { TM.ui.toast("Caixa insuficiente para a contratação"); return; }
            TM.ui.confirm("Contratar " + o.co.name + "?", "Custo de " + money(c, cost) + " + salário de " + money(c, sal) + "/temporada. Contrato de 24 meses.", "Contratar", function () {
              c.budget -= cost; c.fin.expenseM += cost;
              c.coach = makeContract(c, o.co, 24);
              TM.notify.push(c, { icon: "✍️", title: "Novo técnico", text: o.co.name + " (" + o.r + ") foi contratado por " + money(c, cost) + " (salário " + money(c, sal) + "/temp)." });
              TM.storage.saveCoachCareer(c); TM.ui.go("director-hub");
            });
          }, "btn " + (afford ? "primary" : "ghost") + " small")
        ]);
        list.appendChild(row);
      });
    }
    search.addEventListener("input", function () { render(search.value.trim().toLowerCase()); });
    render("");
  });

  /* ================= FINANÇAS ================= */
  TM.ui.register("director-finance", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("💰 Finanças", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    body.appendChild(el("div", { class: "market-budget" + (c.budget < 0 ? " debt" : ""), text: (c.budget < 0 ? "🔴 Dívida atual: " : "💰 Caixa: ") + money(c, c.budget) }));

    function line(label, val, cls) { return el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: label }), el("span", { class: "deal-val " + (cls || ""), text: val }) ]); }
    var saldo = c.fin.incomeM - c.fin.expenseM;
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "📊 Balanço da temporada " + c.season }),
      line("Receitas (bilheteria, TV, prêmios)", money(c, c.fin.incomeM), "good"),
      line("Despesas (salários, técnico, CT)", "-" + money(c, c.fin.expenseM), "bad"),
      line("Saldo da temporada", (saldo >= 0 ? "+" : "") + money(c, saldo), saldo >= 0 ? "good" : "bad"),
      line("Folha salarial do elenco (temp.)", money(c, c.wagesM)),
      line("Salário do técnico (temp.)", money(c, c.coach.salaryM)),
      line("Manutenção do CT (temp.)", money(c, ctUpkeep(c, c.ctLevel)))
    ]));

    // pedir aporte à diretoria
    var aporte = el("div", { class: "nego-panel" });
    aporte.appendChild(el("div", { class: "nego-quote", text: "🏦 Peça um aporte à diretoria para reforçar o caixa (uma vez por temporada)." }));
    if (c.aporteUsedSeason) {
      aporte.appendChild(el("div", { class: "setting-hint", text: "Você já solicitou um aporte nesta temporada." }));
    } else {
      aporte.appendChild(TM.ui.button("Pedir aporte à diretoria", function () {
        var pos = C().currentPosition(c);
        var boardMood = c.board === "aceitavel" ? 1 : c.board === "rigorosa" ? -1 : 0;
        var chance = 0.5 + (pos <= (c.objective.maxPos || 6) ? 0.25 : -0.15) + boardMood * 0.1;
        c.aporteUsedSeason = true;
        if (Math.random() < chance) {
          var baseEur = 20 + Math.max(0, (TM.data.clubRating(c.teamId) - 60)) * 1.5;
          var grant = Math.round(baseEur * (0.6 + Math.random() * 0.8) * mult(c));
          c.budget += grant; c.fin.incomeM += grant;
          TM.notify.push(c, { icon: "🏦", title: "Aporte aprovado", text: "A diretoria liberou " + money(c, grant) + " de aporte para o clube." });
          TM.ui.toast("Aporte aprovado: " + money(c, grant));
        } else {
          TM.notify.push(c, { icon: "🚫", title: "Aporte negado", text: "A diretoria negou o pedido de aporte neste momento." });
          TM.ui.toast("A diretoria negou o aporte.");
        }
        TM.storage.saveCoachCareer(c); TM.ui.go("director-finance");
      }, "btn primary"));
    }
    body.appendChild(aporte);
  });

  /* ================= CT (centro de treinamento) ================= */
  TM.ui.register("director-ct", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("🏟️ Centro de Treinamento", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    body.appendChild(el("div", { class: "ct-level" }, [
      el("div", { class: "ct-badge", text: "Nível " + c.ctLevel }),
      el("div", {}, [ el("div", { class: "ct-name", text: ctDesc(c.ctLevel) + " CT" }), el("div", { class: "setting-hint", text: "Um CT melhor dá um empurrão nos resultados do time (o elenco rende mais). Quanto maior o nível, mais forte o efeito." }) ])
    ]));

    // barra de níveis
    var bar = el("div", { class: "ct-bar" });
    for (var i = 1; i <= 5; i++) bar.appendChild(el("div", { class: "ct-seg" + (i <= c.ctLevel ? " on" : "") }));
    body.appendChild(bar);

    if (c.ctLevel >= 5) {
      body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "🏆 Seu CT já é elite mundial — nível máximo." }));
    } else {
      var next = c.ctLevel + 1, cost = ctUpgradeCost(c, next), afford = c.budget >= cost;
      body.appendChild(el("div", { class: "nego-panel" }, [
        el("div", { class: "nego-quote", text: "Melhorar para o nível " + next + " (" + ctDesc(next) + ") custa " + money(c, cost) + "." }),
        TM.ui.button("🏗️ Melhorar CT (" + money(c, cost) + ")", function () {
          if (!afford) { TM.ui.toast("Caixa insuficiente para a obra"); return; }
          TM.ui.confirm("Investir no CT?", "Custo de " + money(c, cost) + " para chegar ao nível " + next + ".", "Investir", function () {
            c.budget -= cost; c.fin.expenseM += cost; c.ctLevel = next;
            TM.notify.push(c, { icon: "🏟️", title: "CT melhorado", text: "O CT foi elevado ao nível " + next + " (" + ctDesc(next) + ")." });
            TM.storage.saveCoachCareer(c); TM.ui.go("director-ct");
          });
        }, "btn " + (afford ? "primary" : "ghost"))
      ]));
    }
  });

  TM.director = { start: start, ensureDirector: ensureDirector, coachRating: coachRating };
})(window);
