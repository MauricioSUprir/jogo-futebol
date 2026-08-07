/* ================= TOTAL MATCH — Partida Rápida ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  // Estado local da configuração de partida
  var setup = { source: "club", leagueId: "br", teamA: null, teamB: null };

  /* ---------- Tela 1: escolha dos times ---------- */
  TM.ui.register("quick", function (screen) {
    screen.appendChild(TM.ui.topbar("⚡ Partida Rápida", function () { TM.ui.go("modes"); }));

    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // fonte: clubes ou seleções
    var srcSeg = el("div", { class: "segmented full" });
    [["club", "Clubes"], ["nation", "Seleções"]].forEach(function (o) {
      srcSeg.appendChild(el("button", {
        class: "seg-btn" + (setup.source === o[0] ? " active" : ""),
        text: o[1], on: { click: function () { setup.source = o[0]; setup.teamA = setup.teamB = null; TM.ui.go("quick"); } }
      }));
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Tipo de time" }), srcSeg ]));

    // opções de time conforme a fonte
    function teamOptions() {
      if (setup.source === "nation") {
        return TM.data.world().nations.map(function (n) { return { id: n.id, name: n.name }; })
          .sort(function (a, b) { return a.name.localeCompare(b.name); });
      }
      var league = TM.data.league(setup.leagueId);
      return league.clubIds.map(function (id) { var c = TM.data.club(id); return { id: id, name: c.name }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
    }

    // seletor de liga (só para clubes)
    if (setup.source === "club") {
      var leagueSel = el("select", { class: "select" });
      TM.data.world().leagues.forEach(function (lg) {
        var o = el("option", { value: lg.id, text: lg.name });
        if (lg.id === setup.leagueId) o.selected = true;
        leagueSel.appendChild(o);
      });
      leagueSel.addEventListener("change", function () {
        setup.leagueId = leagueSel.value; setup.teamA = setup.teamB = null; TM.ui.go("quick");
      });
      body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Liga" }), leagueSel ]));
    }

    function teamPicker(label, key) {
      var sel = el("select", { class: "select" });
      sel.appendChild(el("option", { value: "", text: "— escolha —" }));
      teamOptions().forEach(function (t) {
        var o = el("option", { value: t.id, text: t.name });
        if (setup[key] === t.id) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { setup[key] = sel.value || null; updatePreview(); });
      return el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: label }), sel ]);
    }

    body.appendChild(teamPicker("Time da casa", "teamA"));
    body.appendChild(el("div", { class: "vs-divider", text: "VS" }));
    body.appendChild(teamPicker("Time visitante", "teamB"));

    var preview = el("div", { class: "match-preview" });
    body.appendChild(preview);

    function teamObj(id) {
      return setup.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id);
    }
    function updatePreview() {
      TM.ui.clear(preview);
      if (!setup.teamA || !setup.teamB) return;
      if (setup.teamA === setup.teamB) { preview.appendChild(el("p", { class: "warn", text: "Escolha times diferentes." })); return; }
      var a = teamObj(setup.teamA), b = teamObj(setup.teamB);
      function badge(t) {
        var img = t.club ? TM.img.clubImg(t.club, "prev-crest") : TM.img.nationImg(t.nation, "prev-crest");
        var rating = Math.round(t.players.slice(0, 11).reduce(function (s, p) { return s + p.overall; }, 0) / 11);
        return el("div", { class: "prev-team" }, [ img, el("div", { class: "prev-name", text: t.name }), TM.ui.ovBadge(rating) ]);
      }
      preview.appendChild(el("div", { class: "prev-row" }, [ badge(a), el("div", { class: "prev-x", text: "×" }), badge(b) ]));
    }
    updatePreview();

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("▶ Simular partida", function () {
        if (!setup.teamA || !setup.teamB || setup.teamA === setup.teamB) { TM.ui.toast("Escolha dois times diferentes"); return; }
        TM.ui.go("quick-match", { a: teamObj(setup.teamA), b: teamObj(setup.teamB) });
      }, "btn primary big")
    ]));
  });

  /* ---------- Tela 2: partida ao vivo (imersiva) ---------- */
  TM.ui.register("quick-match", function (screen, params) {
    var settings = TM.storage.settings();
    var result = TM.engine.simulate(params.a, params.b, {
      realism: settings.realism, neutral: setup.source === "nation"
    });
    TM.matchview.play(screen, {
      teamA: params.a, teamB: params.b, result: result, settings: settings,
      onBack: function () { TM.ui.go("quick"); },
      onDone: function () { TM.ui.go("quick-result", { a: params.a, b: params.b, result: result }); }
    });
  });

  /* ---------- Tela 3: resultado ---------- */
  TM.ui.register("quick-result", function (screen, params) {
    var r = params.result, a = params.a, b = params.b;
    screen.appendChild(TM.ui.topbar("Resultado", function () { TM.ui.go("quick"); }));

    var winner = r.score[0] > r.score[1] ? a.name : r.score[1] > r.score[0] ? b.name : null;
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [
        el("span", { class: "rs-team", text: a.name }),
        el("span", { class: "rs-num", text: r.score[0] + " × " + r.score[1] }),
        el("span", { class: "rs-team", text: b.name })
      ]),
      el("div", { class: "result-tag", text: winner ? "🏆 Vitória do " + winner : "🤝 Empate" })
    ]));

    function statRow(label, va, vb) {
      var total = va + vb || 1;
      return el("div", { class: "stat-row" }, [
        el("span", { class: "stat-a", text: va }),
        el("div", { class: "stat-mid" }, [
          el("div", { class: "stat-label", text: label }),
          el("div", { class: "stat-bar" }, [
            el("div", { class: "stat-fill a", style: "width:" + (va / total * 100) + "%" }),
            el("div", { class: "stat-fill b", style: "width:" + (vb / total * 100) + "%" })
          ])
        ]),
        el("span", { class: "stat-b", text: vb })
      ]);
    }
    var s = r.stats;
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      statRow("Posse de bola (%)", s.possession[0], s.possession[1]),
      statRow("Finalizações", s.shots[0], s.shots[1]),
      statRow("No gol", s.onTarget[0], s.onTarget[1])
    ]));

    // gols
    var goals = r.events.filter(function (e) { return e.type === "goal"; });
    if (goals.length) {
      var list = el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Gols" }) ]);
      goals.forEach(function (g) { list.appendChild(el("div", { class: "goal-line", text: g.text.replace("⚽ ", "⚽ ") })); });
      screen.appendChild(list);
    }

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("↻ Jogar de novo", function () {
        TM.ui.go("quick-match", { a: TM.engine[a.club ? "teamFromClub" : "teamFromNation"](a.id), b: TM.engine[b.club ? "teamFromClub" : "teamFromNation"](b.id) });
      }, "btn primary"),
      TM.ui.button("Trocar times", function () { TM.ui.go("quick"); }, "btn ghost")
    ]));
  });
})(window);
