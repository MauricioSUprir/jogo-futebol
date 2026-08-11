/* ================= TOTAL MATCH — 2 Jogadores (mesmo aparelho) ================= */
/* Amistoso local: dois jogadores escolhem um time cada e assistem ao confronto.
   100% offline (não precisa de internet nem servidor). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  var vs = { source: "club", p1: { name: "", league: "br", team: null }, p2: { name: "", league: "es", team: null } };

  function teamOptions(leagueId) {
    if (vs.source === "nation") {
      return TM.data.world().nations.map(function (n) { return { id: n.id, name: n.name }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
    }
    return TM.data.league(leagueId).clubIds.map(function (id) { var c = TM.data.club(id); return { id: id, name: c.name }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function teamObj(id) { return vs.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id); }
  function crestOf(id, cls) { return vs.source === "nation" ? TM.img.nationImg(TM.data.nation(id), cls) : TM.img.clubImg(TM.data.club(id), cls); }
  function seatName(seat, def) { return (vs[seat].name || "").trim() || def; }

  TM.ui.register("versus", function (screen) {
    screen.appendChild(TM.ui.topbar("📱 2 Jogadores", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Dois jogadores no mesmo aparelho. Cada um digita seu nome e escolhe um time — depois é só assistir ao confronto juntos!" }));

    // fonte compartilhada: clubes ou seleções
    var srcSeg = el("div", { class: "segmented full" });
    [["club", "Clubes"], ["nation", "Seleções"]].forEach(function (o) {
      srcSeg.appendChild(el("button", { class: "seg-btn" + (vs.source === o[0] ? " active" : ""), text: o[1],
        on: { click: function () { vs.source = o[0]; vs.p1.team = vs.p2.team = null; TM.ui.go("versus"); } } }));
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Tipo de time" }), srcSeg ]));

    function seatPicker(seat, emoji, defName, accent) {
      var s = vs[seat];
      var kids = [ el("div", { class: "seat-head", style: "color:" + accent }, [ el("span", { class: "seat-emoji", text: emoji }), el("span", { text: "Jogador " + (seat === "p1" ? "1" : "2") }) ]) ];
      var nameIn = el("input", { class: "select", type: "text", maxlength: "16", value: s.name, placeholder: defName });
      nameIn.addEventListener("input", function () { s.name = nameIn.value; });
      kids.push(nameIn);
      if (vs.source === "club") {
        var lgSel = el("select", { class: "select" });
        TM.data.world().leagues.forEach(function (lg) { var o = el("option", { value: lg.id, text: lg.name }); if (lg.id === s.league) o.selected = true; lgSel.appendChild(o); });
        lgSel.addEventListener("change", function () { s.league = lgSel.value; s.team = null; TM.ui.go("versus"); });
        kids.push(lgSel);
      }
      var tSel = el("select", { class: "select" });
      tSel.appendChild(el("option", { value: "", text: "— escolha o time —" }));
      teamOptions(s.league).forEach(function (t) { var o = el("option", { value: t.id, text: t.name }); if (s.team === t.id) o.selected = true; tSel.appendChild(o); });
      tSel.addEventListener("change", function () { s.team = tSel.value || null; refreshPrev(); });
      kids.push(tSel);
      return el("div", { class: "seat" }, kids);
    }

    body.appendChild(seatPicker("p1", "🔵", "Jogador 1", "#3a9bff"));
    body.appendChild(el("div", { class: "vs-divider", text: "VS" }));
    body.appendChild(seatPicker("p2", "🔴", "Jogador 2", "#ff5a3c"));

    var prev = el("div", { class: "match-preview" });
    body.appendChild(prev);
    function refreshPrev() {
      TM.ui.clear(prev);
      if (!vs.p1.team || !vs.p2.team) return;
      if (vs.p1.team === vs.p2.team) { prev.appendChild(el("p", { class: "warn", text: "Escolham times diferentes." })); return; }
      function badge(seat, def, accent) {
        var id = vs[seat].team, t = teamObj(id);
        var rating = Math.round(t.players.slice(0, 11).reduce(function (s, p) { return s + p.overall; }, 0) / 11);
        return el("div", { class: "prev-team" }, [ crestOf(id, "prev-crest"),
          el("div", { class: "prev-name", text: t.name }),
          el("div", { class: "seat-owner", style: "color:" + accent, text: seatName(seat, def) }),
          TM.ui.ovBadge(rating) ]);
      }
      prev.appendChild(el("div", { class: "prev-row" }, [ badge("p1", "Jogador 1", "#3a9bff"), el("div", { class: "prev-x", text: "×" }), badge("p2", "Jogador 2", "#ff5a3c") ]));
    }
    refreshPrev();

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("▶ Iniciar confronto", function () {
        if (!vs.p1.team || !vs.p2.team || vs.p1.team === vs.p2.team) { TM.ui.toast("Escolham dois times diferentes"); return; }
        TM.ui.go("versus-match");
      }, "btn primary big")
    ]));
  });

  TM.ui.register("versus-match", function (screen) {
    if (!vs.p1.team || !vs.p2.team) { TM.ui.go("versus"); return; }
    var a = teamObj(vs.p1.team), b = teamObj(vs.p2.team);
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: true };
    var result = TM.engine.simulate(a, b, simOpts);
    TM.matchview.play(screen, {
      teamA: a, teamB: b, result: result, settings: settings,
      title: seatName("p1", "Jogador 1") + " × " + seatName("p2", "Jogador 2"),
      pauseSide: null, simOpts: simOpts,
      onBack: function () { TM.ui.go("versus"); },
      onDone: function () { TM.ui.go("versus-result", { a: a, b: b, result: result }); }
    });
  });

  TM.ui.register("versus-result", function (screen, params) {
    var r = params.result, a = params.a, b = params.b;
    var hs = r.score[0], as = r.score[1];
    var n1 = seatName("p1", "Jogador 1"), n2 = seatName("p2", "Jogador 2");
    var winnerName = hs > as ? n1 : as > hs ? n2 : null;
    screen.appendChild(TM.ui.topbar("Resultado", function () { TM.ui.go("versus"); }));
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [
        el("span", { class: "rs-team", text: a.name }),
        el("span", { class: "rs-num", text: hs + " × " + as }),
        el("span", { class: "rs-team", text: b.name })
      ]),
      el("div", { class: "result-tag", text: winnerName ? "🏆 " + winnerName + " venceu!" : "🤝 Empate!" })
    ]));
    screen.appendChild(el("div", { class: "vs-names" }, [
      el("span", { style: "color:#3a9bff", text: "🔵 " + n1 }),
      el("span", { text: " vs " }),
      el("span", { style: "color:#ff5a3c", text: "🔴 " + n2 })
    ]));
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("↻ Revanche", function () { TM.ui.go("versus-match"); }, "btn primary"),
      TM.ui.button("Trocar times", function () { TM.ui.go("versus"); }, "btn ghost")
    ]));
  });

})(window);
