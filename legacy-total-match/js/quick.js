/* ================= TOTAL MATCH — Partida Rápida ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  // Estado local da configuração de partida
  var setup = { source: "club", leagueA: "br", leagueB: "es", teamA: null, teamB: null };

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

    function teamObj(id) {
      return setup.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id);
    }
    function crestFor(id, cls) { return setup.source === "nation" ? TM.img.nationImg(TM.data.nation(id), cls) : TM.img.clubImg(TM.data.club(id), cls); }
    function nameFor(id) { return setup.source === "nation" ? TM.data.nation(id).name : TM.data.club(id).name; }
    function ratingFor(id) { return setup.source === "nation" ? TM.comp.natRating(id) : TM.data.clubRating(id); }

    // cartão de escolha visual (abre o seletor com escudos/overall)
    function chosenCard(label, teamKey) {
      var id = setup[teamKey];
      var open = function () {
        TM.ui.pickTeam({ source: setup.source, title: label, current: id, back: function () { TM.ui.go("quick"); },
          onPick: function (pid) { setup[teamKey] = pid; TM.ui.go("quick"); } });
      };
      if (!id) return el("button", { class: "chosen-team empty", on: { click: open } }, [ el("span", { text: "➕ " + label } ) ]);
      return el("div", { class: "chosen-team", on: { click: open } }, [
        crestFor(id, "chosen-crest"),
        el("div", { class: "chosen-info" }, [ el("div", { class: "chosen-name", text: nameFor(id) }), el("div", { class: "chosen-sub", text: label + " · toque para trocar" }) ]),
        TM.ui.ovBadge(ratingFor(id))
      ]);
    }
    body.appendChild(el("div", { class: "setting-label", text: "🏠 Time da casa" }));
    body.appendChild(chosenCard("Time da casa", "teamA"));
    body.appendChild(el("div", { class: "vs-divider", text: "VS" }));
    body.appendChild(el("div", { class: "setting-label", text: "✈️ Time visitante" }));
    body.appendChild(chosenCard("Time visitante", "teamB"));

    var preview = el("div", { class: "match-preview" });
    body.appendChild(preview);
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
      var isNat = setup.source === "nation";
      preview.appendChild(el("div", { class: "scout-btn-row actions two" }, [
        TM.ui.button("🔍 Analisar " + a.name, function () { TM.ui.go("scout", { teamId: setup.teamA, isNation: isNat, back: function () { TM.ui.go("quick"); } }); }, "btn ghost small"),
        TM.ui.button("🔍 Analisar " + b.name, function () { TM.ui.go("scout", { teamId: setup.teamB, isNation: isNat, back: function () { TM.ui.go("quick"); } }); }, "btn ghost small")
      ]));
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
    var simOpts = { realism: settings.realism, neutral: setup.source === "nation" };
    var result = TM.engine.simulate(params.a, params.b, simOpts);
    TM.matchview.play(screen, {
      teamA: params.a, teamB: params.b, result: result, settings: settings,
      pauseSide: 0, simOpts: simOpts,
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
      el("div", { class: "result-tag", text: winner ? "🏆 Vitória do " + winner : "🤝 Empate" }),
      params.penWinner != null ? el("div", { class: "result-tag pen", text: "🎯 " + (params.penWinner === 0 ? a.name : b.name) + " venceu nos pênaltis" }) : null
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

    var acts = el("div", { class: "actions" });
    // no empate, o jogador pode decidir nos pênaltis
    if (!winner && params.penWinner == null) {
      acts.appendChild(TM.ui.button("🎯 Disputar pênaltis", function () {
        var shoot = TM.engine.shootout(a, b);
        TM.ui.go("pen-shootout", { teamA: a, teamB: b, shoot: shoot, title: "Disputa de pênaltis",
          onDone: function () { TM.ui.go("quick-result", { a: a, b: b, result: r, penWinner: shoot.winner }); } });
      }, "btn primary"));
    }
    acts.appendChild(TM.ui.button("↻ Jogar de novo", function () {
      TM.ui.go("quick-match", { a: TM.engine[a.club ? "teamFromClub" : "teamFromNation"](a.id), b: TM.engine[b.club ? "teamFromClub" : "teamFromNation"](b.id) });
    }, winner || params.penWinner != null ? "btn primary" : "btn ghost"));
    acts.appendChild(TM.ui.button("Trocar times", function () { TM.ui.go("quick"); }, "btn ghost"));
    screen.appendChild(acts);
  });
})(window);
