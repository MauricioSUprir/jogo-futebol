/* ================= TOTAL MATCH — Partida Rápida ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  function shortNm(name) {
    var a = String(name || "").trim().split(/\s+/);
    return a.length > 1 ? a[0][0] + ". " + a[a.length - 1] : (a[0] || "");
  }

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
      TM.ui.button("📋 Escalar meu time", function () {
        if (!setup.teamA || !setup.teamB || setup.teamA === setup.teamB) { TM.ui.toast("Escolha dois times diferentes"); return; }
        TM.ui.go("quick-lineup", { side: 0 });
      }, "btn primary big"),
      TM.ui.button("▶ Simular direto", function () {
        if (!setup.teamA || !setup.teamB || setup.teamA === setup.teamB) { TM.ui.toast("Escolha dois times diferentes"); return; }
        TM.ui.go("quick-match", { a: teamObj(setup.teamA), b: teamObj(setup.teamB) });
      }, "btn ghost")
    ]));
  });

  /* ---------- Tela 1b: escalação pré-jogo (formação, tática, titulares e banco) ---------- */
  var QL = { key: null, A: null, B: null, pick: null };   // estado da escalação da partida rápida
  function qTeamPlayers(id) { return setup.source === "nation" ? TM.data.nationSquad(id) : TM.data.clubPlayers(id); }
  function qEnsure() {
    var key = setup.source + ":" + setup.teamA + ":" + setup.teamB;
    if (QL.key !== key) {
      QL.key = key; QL.pick = null;
      QL.A = { formation: "4-4-2", tactic: "equilibrado", lu: TM.comp.buildLineup(qTeamPlayers(setup.teamA), "4-4-2") };
      QL.B = { formation: "4-4-2", tactic: "equilibrado", lu: TM.comp.buildLineup(qTeamPlayers(setup.teamB), "4-4-2") };
    }
  }
  function qTeam(side) {
    var id = side === 0 ? setup.teamA : setup.teamB, st = side === 0 ? QL.A : QL.B;
    var all = qTeamPlayers(id), byId = {}; all.forEach(function (p) { byId[p.id] = p; });
    var xi = st.lu.starters.map(function (pid) { return byId[pid]; }).filter(Boolean);
    var inXi = {}; xi.forEach(function (p) { inXi[p.id] = 1; });
    var rest = all.filter(function (p) { return !inXi[p.id]; }).sort(function (a, b) { return b.overall - a.overall; });
    var t = setup.source === "nation" ? TM.engine.teamFromNation(id, xi.concat(rest)) : TM.engine.teamFromClub(id, xi.concat(rest));
    t.formation = st.formation; t.tactic = st.tactic;
    return t;
  }
  TM.ui.register("quick-lineup", function (screen, params) {
    if (!setup.teamA || !setup.teamB) { TM.ui.go("quick"); return; }
    qEnsure();
    var side = (params && params.side) || 0, st = side === 0 ? QL.A : QL.B, id = side === 0 ? setup.teamA : setup.teamB;
    var all = qTeamPlayers(id), byId = {}; all.forEach(function (p) { byId[p.id] = p; });
    var name = setup.source === "nation" ? TM.data.nation(id).name : TM.data.club(id).name;
    if (!st.pos) st.pos = {};
    screen.appendChild(TM.ui.topbar("📋 Escalação · " + name, function () { QL.pick = null; TM.ui.go("quick"); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);

    // casa / visitante
    var seg = el("div", { class: "segmented full" });
    [[0, "🏠 " + (setup.source === "nation" ? TM.data.nation(setup.teamA).name : TM.data.club(setup.teamA).name)], [1, "✈️ " + (setup.source === "nation" ? TM.data.nation(setup.teamB).name : TM.data.club(setup.teamB).name)]].forEach(function (o) {
      seg.appendChild(el("button", { class: "seg-btn" + (side === o[0] ? " active" : ""), text: o[1], on: { click: function () { QL.pick = null; TM.ui.go("quick-lineup", { side: o[0] }); } } }));
    });
    body.appendChild(seg);

    var ovrEl = el("div", { class: "market-budget" });
    body.appendChild(ovrEl);
    body.appendChild(TM.ui.dropdown("Formação", Object.keys(TM.comp.FORMATIONS), st.formation, function (f) {
      st.formation = f; st.lu = TM.comp.buildLineup(all, f); st.pos = {}; QL.pick = null; TM.ui.go("quick-lineup", { side: side });
    }));
    body.appendChild(TM.ui.dropdown("Tática", TM.engine.TACTICS, st.tactic, function (t) { st.tactic = t; }));
    body.appendChild(el("div", { class: "actions two" }, [
      TM.ui.button("✨ Melhor time automático", function () { st.lu = TM.comp.buildLineup(all, st.formation); st.pos = {}; QL.pick = null; renderBoard(); }, "btn ghost small"),
      TM.ui.button("🔍 Analisar", function () { TM.ui.go("scout", { teamId: id, isNation: setup.source === "nation", back: function () { TM.ui.go("quick-lineup", { side: side }); } }); }, "btn ghost small")
    ]));

    // campinho + reservas (atualizado em lugar, sem recarregar a tela)
    var board = el("div", { class: "lineup-board" });
    screen.appendChild(board);
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("▶ Iniciar partida", function () { QL.pick = null; TM.ui.go("quick-match", { a: qTeam(0), b: qTeam(1) }); }, "btn primary big")
    ]));
    renderBoard();

    // o goleiro fica no fundo e os atacantes não invadem a área: mesma régua da carreira
    function fieldY(sy) { return Math.round((20 + (sy - 15) * (88 - 20) / (88 - 15)) * 10) / 10; }

    function renderBoard() {
      board.innerHTML = "";
      var slots = TM.comp.FORMATIONS[st.formation] || TM.comp.FORMATIONS["4-4-2"];
      var xi = st.lu.starters.map(function (pid) { return byId[pid]; });
      var live = xi.filter(Boolean);
      ovrEl.textContent = "⭐ Força do time titular: " + Math.round(live.reduce(function (a, p) { return a + p.overall; }, 0) / Math.max(1, live.length));

      var pitch = el("div", { class: "pitch" });
      pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
      pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
      st.lu.starters.forEach(function (pid, i) {
        var p = byId[pid]; if (!p) return;
        var baseSlot = slots[i] || [null, 50, 50];
        var cp = st.pos[i];
        var x = cp ? cp[0] : baseSlot[1], y = cp ? cp[1] : fieldY(baseSlot[2]);
        var slot = cp ? TM.comp.fieldSlot(x, y) : baseSlot;
        var chip = el("button", { class: "pl-chip" + (QL.pick === i ? " picked" : "") + (cp ? " custom" : ""),
          style: "left:" + x + "%;top:" + y + "%" },
          TM.ui.chipKids(p, slot, { name: shortNm(p.name), age: false })
        );
        attachChipDrag(chip, i, pitch);
        pitch.appendChild(chip);
      });
      board.appendChild(pitch);

      board.appendChild(el("div", { class: "lineup-hint", text: QL.pick != null
        ? "Toque em OUTRO titular para trocar, ou num reserva para substituir. ✋ Arraste para mover livre."
        : "👆 Toque para trocar/substituir · ✋ Arraste o jogador pelo campo para posicioná-lo livremente." }));
      if (Object.keys(st.pos).length) {
        board.appendChild(TM.ui.button("↩️ Redefinir posições da formação", function () { st.pos = {}; renderBoard(); }, "btn ghost small"));
      }
      board.appendChild(TM.ui.posPanel(st.lu.starters.map(function (pid, i) {
        var cp = st.pos[i];
        return { player: byId[pid], slot: cp ? TM.comp.fieldSlot(cp[0], cp[1]) : (slots[i] || null) };
      }).filter(function (e) { return e.player; })));

      var inXi = {}; st.lu.starters.forEach(function (pid) { inXi[pid] = 1; });
      var benchWrap = el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Reservas" }) ]);
      all.filter(function (p) { return !inXi[p.id]; }).sort(function (a, b) { return b.overall - a.overall; }).forEach(function (p) {
        var row = TM.ui.playerRow(p, {});
        row.classList.add("clickable");
        if (QL.pick != null) row.classList.add("row-target");
        row.addEventListener("click", function () {
          if (QL.pick == null) { TM.ui.toast("Toque primeiro no titular que vai sair."); return; }
          st.lu.starters[QL.pick] = p.id; QL.pick = null; renderBoard();
        });
        benchWrap.appendChild(row);
      });
      board.appendChild(benchWrap);
    }

    function onStarterClick(i) {
      if (QL.pick == null) { QL.pick = i; }
      else if (QL.pick === i) { QL.pick = null; }
      else {
        var t = st.lu.starters[QL.pick]; st.lu.starters[QL.pick] = st.lu.starters[i]; st.lu.starters[i] = t;
        // a posição arrastada acompanha o jogador
        var pa = st.pos[QL.pick], pb = st.pos[i];
        if (pa) st.pos[i] = pa; else delete st.pos[i];
        if (pb) st.pos[QL.pick] = pb; else delete st.pos[QL.pick];
        QL.pick = null;
      }
      renderBoard();
    }

    // arrastar o jogador livremente pelo campo
    function attachChipDrag(chip, i, pitch) {
      var sx = null, sy = null, dragging = false, pid = null, nx = null, ny = null;
      chip.style.touchAction = "none";
      chip.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; dragging = false; pid = e.pointerId; nx = ny = null; });
      chip.addEventListener("pointermove", function (e) {
        if (sx == null) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (!dragging && (dx * dx + dy * dy) > 36) { dragging = true; try { chip.setPointerCapture(pid); } catch (er) {} chip.classList.add("dragging"); }
        if (dragging) {
          var r = pitch.getBoundingClientRect();
          nx = Math.max(5, Math.min(95, (e.clientX - r.left) / r.width * 100));
          ny = Math.max(6, Math.min(95, (e.clientY - r.top) / r.height * 100));
          chip.style.left = nx + "%"; chip.style.top = ny + "%";
        }
      });
      function done() {
        if (sx == null) return;
        var wasDrag = dragging; sx = sy = null; dragging = false;
        chip.classList.remove("dragging");
        try { chip.releasePointerCapture(pid); } catch (er) {}
        if (wasDrag) { if (nx != null) { st.pos[i] = [Math.round(nx * 10) / 10, Math.round(ny * 10) / 10]; } renderBoard(); }
        else { onStarterClick(i); }
      }
      chip.addEventListener("pointerup", done);
      chip.addEventListener("pointercancel", done);
    }
  });

  /* ---------- Tela 2: partida ao vivo (imersiva) ---------- */
  TM.ui.register("quick-match", function (screen, params) {
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: setup.source === "nation" };
    if (params.a && params.a.tactic) { simOpts.tactic = params.a.tactic; simOpts.tacticSide = 0; }   // tática escolhida na escalação
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
