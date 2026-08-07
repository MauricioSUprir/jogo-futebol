/* ================= TOTAL MATCH — visão imersiva da partida ================= */
/* Reproduz a partida como uma transmissão: o relógio corre minuto a minuto e
   os lances vão surgindo embaixo em tempo real. Usada na Partida Rápida e nas
   carreiras. Chama onDone() ao terminar. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var el = null;
  function E() { el = TM.ui.el; }

  var SPEED = { instantaneo: 0, rapido: 35, normal: 110, lento: 300 };

  function play(screen, cfg) {
    E();
    var a = cfg.teamA, b = cfg.teamB, result = cfg.result;
    var settings = cfg.settings || TM.storage.settings();
    var onDone = cfg.onDone || function () {};
    var delay = SPEED[settings.matchSpeed] != null ? SPEED[settings.matchSpeed] : 62;

    screen.appendChild(TM.ui.topbar(cfg.title || "Ao vivo", cfg.onBack || null));

    var score = [0, 0];
    var scoreEl = el("div", { class: "live-score", text: "0 - 0" });
    var clockEl = el("div", { class: "live-min", text: "0'" });
    var progressFill = el("div", { class: "bc-progress-fill" });
    function coachOf(t) { return (t.club && t.club.coach) || (t.nation && t.nation.coach) || null; }
    function teamCol(t) {
      var kids = [ el("div", { class: "bc-team-name", text: t.name }) ];
      var co = coachOf(t);
      if (co) kids.push(el("div", { class: "bc-coach", text: "Téc. " + co }));
      return el("div", { class: "bc-team" }, kids);
    }
    screen.appendChild(el("div", { class: "broadcast" }, [
      el("div", { class: "bc-top" }, [
        teamCol(a),
        el("div", { class: "bc-center" }, [ scoreEl, clockEl ]),
        teamCol(b)
      ]),
      el("div", { class: "bc-progress" }, [ progressFill ])
    ]));

    var feed = el("div", { class: "broadcast-feed" });
    screen.appendChild(feed);

    var actions = el("div", { class: "actions" });
    // botão de pausa (só quando há um lado controlável e a partida está animada)
    var canPause = cfg.pauseSide != null && delay > 0;
    var userTactic = (cfg.simOpts && cfg.simOpts.tactic) || "equilibrado";
    var subsUsed = 0;
    if (canPause) actions.appendChild(TM.ui.button("⏸ Pausar", function () { openPause(); }, "btn"));
    // um único handler: durante o jogo "Pular" encerra; depois "Ver resultado" avança (uma vez só)
    var skipBtn = TM.ui.button("Pular ⏭", function () { onSkip(); }, "btn ghost");
    actions.appendChild(skipBtn);
    screen.appendChild(actions);
    var proceeded = false, paused = false;
    function onSkip() {
      if (!done) { finishNow(); return; }   // ainda rolando -> encerra a animação
      if (proceeded) return;                 // já avançou -> ignora cliques repetidos
      proceeded = true; onDone();
    }

    /* ---- pausa: táticas + substituições, re-simula o restante ---- */
    function myTeam() { return cfg.pauseSide === 0 ? a : b; }
    function openPause() {
      if (done || paused) return;
      paused = true;
      var team = myTeam();
      var overlay = el("div", { class: "pause-overlay" });
      var box = el("div", { class: "pause-box" });
      overlay.appendChild(box);
      box.appendChild(el("div", { class: "pause-head", text: "⏸ " + minute + "'  ·  " + a.name + " " + score[0] + " x " + score[1] + " " + b.name }));
      box.appendChild(el("div", { class: "pause-sub-team", text: "Ajustes de " + team.name }));

      // tática
      var tacRow = el("div", { class: "segmented full" });
      [["defensivo", "Defensivo"], ["equilibrado", "Equilibrado"], ["ofensivo", "Ofensivo"], ["contra-ataque", "Contra"]].forEach(function (o) {
        tacRow.appendChild(el("button", { class: "seg-btn" + (userTactic === o[0] ? " active" : ""), text: o[1], on: { click: function () { userTactic = o[0]; tacRow.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); this.classList.add("active"); } } }));
      });
      box.appendChild(el("div", { class: "pause-field" }, [ el("label", { text: "Tática" }), tacRow ]));

      // substituições
      box.appendChild(el("div", { class: "pause-field" }, [ el("label", { text: "Substituições (" + subsUsed + "/3)" }) ]));
      var subArea = el("div", { class: "sub-area" });
      box.appendChild(subArea);
      var selOut = { idx: null };
      function renderSubs() {
        TM.ui.clear(subArea);
        var xiCol = el("div", { class: "sub-col" }, [ el("div", { class: "sub-col-h", text: "Em campo" }) ]);
        team.players.slice(0, 11).forEach(function (pl, i) {
          xiCol.appendChild(el("button", { class: "sub-chip" + (selOut.idx === i ? " sel" : ""), on: { click: function () { selOut.idx = (selOut.idx === i ? null : i); renderSubs(); } } }, [
            el("span", { class: "sc-pos", text: TM.data.posLabel(pl) }), el("span", { class: "sc-name", text: shortP(pl.name) }), el("span", { class: "sc-ov", text: pl.overall })
          ]));
        });
        var beCol = el("div", { class: "sub-col" }, [ el("div", { class: "sub-col-h", text: "Reservas" }) ]);
        team.players.slice(11, 24).forEach(function (pl, bi) {
          beCol.appendChild(el("button", { class: "sub-chip bench", on: { click: function () {
            if (selOut.idx == null) { return; }
            if (subsUsed >= 3) { return; }
            var oi = selOut.idx, bidx = 11 + bi;
            var tmp = team.players[oi]; team.players[oi] = team.players[bidx]; team.players[bidx] = tmp;
            subsUsed++; selOut.idx = null;
            box.querySelector(".pause-field label").textContent; // noop
            renderSubs();
            box.querySelectorAll(".pause-field label")[1].textContent = "Substituições (" + subsUsed + "/3)";
          } } }, [
            el("span", { class: "sc-pos", text: TM.data.posLabel(pl) }), el("span", { class: "sc-name", text: shortP(pl.name) }), el("span", { class: "sc-ov", text: pl.overall })
          ]));
        });
        subArea.appendChild(xiCol); subArea.appendChild(beCol);
      }
      renderSubs();

      box.appendChild(el("div", { class: "pause-hint", text: "Toque num titular e depois num reserva para trocar." }));
      box.appendChild(TM.ui.button("▶ Retomar partida", function () {
        overlay.remove();
        resimRest();
        paused = false; step();
      }, "btn primary"));
      document.body.appendChild(overlay);
    }
    function shortP(n) { var p = n.split(" "); return p.length > 1 ? p[0][0] + ". " + p[p.length - 1] : n; }

    function resimRest() {
      var o = {};
      if (cfg.simOpts) Object.keys(cfg.simOpts).forEach(function (k) { o[k] = cfg.simOpts[k]; });
      o.startMinute = minute; o.startScore = score.slice();
      o.tacticSide = cfg.pauseSide; o.tactic = userTactic;
      var partial = TM.engine.simulate(a, b, o);
      Object.keys(byMin).forEach(function (k) { if (+k >= minute) delete byMin[k]; });
      partial.events.forEach(function (ev) { if (ev.minute >= minute) (byMin[ev.minute] = byMin[ev.minute] || []).push(ev); });
      var before = result.events.filter(function (e) { return e.minute < minute; });
      result.events = before.concat(partial.events);
      result.score = partial.score; result.stats = partial.stats;
      result.injuries = partial.injuries; result.sentOff = partial.sentOff;
      if (result.focus && partial.focus) result.focus = partial.focus;
    }

    // indexa eventos por minuto
    var byMin = {};
    result.events.forEach(function (ev) { (byMin[ev.minute] = byMin[ev.minute] || []).push(ev); });

    var minute = 0, done = false;

    function addLine(ev) {
      var cls = "bc-line bc-" + ev.type;
      var node;
      if (ev.type === "goal" || ev.type === "pengoal") {
        node = el("div", { class: cls }, [
          el("span", { class: "bc-badge goal", text: "⚽ GOL" }),
          el("div", { class: "bc-line-body" }, [
            el("div", { class: "bc-scorer", text: ev.player }),
            el("div", { class: "bc-detail", text: (ev.minute) + "' · " + a.name + " " + ev.score[0] + " x " + ev.score[1] + " " + b.name })
          ])
        ]);
      } else if (ev.type === "penalty") {
        node = lineWith("🎯 PÊNALTI", ev.text, "pen");
      } else if (ev.type === "penmiss") {
        node = lineWith("❌ PERDEU", ev.text, "miss");
      } else if (ev.type === "red") {
        node = lineWith("🟥 VERMELHO", ev.text.replace("🟥 ", ""), "red");
      } else if (ev.type === "injury") {
        node = lineWith("🚑 LESÃO", ev.text.replace("🚑 ", ""), "injury");
      } else if (ev.type === "yellow") {
        node = lineWith("🟨", ev.text, "yellow");
      } else if (ev.type === "half") {
        node = el("div", { class: "bc-line bc-sep", text: "⏸️ Intervalo — " + ev.score[0] + " x " + ev.score[1] });
      } else if (ev.type === "kickoff") {
        node = el("div", { class: "bc-line bc-sep", text: "🟢 Bola rolando!" });
      } else if (ev.type === "full") {
        node = el("div", { class: "bc-line bc-sep", text: "🔚 Fim de jogo — " + ev.score[0] + " x " + ev.score[1] });
      } else {
        node = el("div", { class: "bc-line bc-chance", text: ev.minute + "' " + ev.text });
      }
      feed.appendChild(node);
      feed.scrollTop = feed.scrollHeight;
    }
    function lineWith(badge, text, kind) {
      return el("div", { class: "bc-line bc-evt " + kind }, [
        el("span", { class: "bc-badge " + kind, text: badge }),
        el("div", { class: "bc-line-body" }, [ el("div", { class: "bc-detail strong", text: text }) ])
      ]);
    }

    function renderMinute(mm) {
      clockEl.textContent = mm + "'";
      if (progressFill) progressFill.style.width = Math.min(100, mm / 90 * 100) + "%";
      (byMin[mm] || []).forEach(function (ev) {
        if ((ev.type === "goal" || ev.type === "pengoal") && ev.team != null) {
          score = ev.score.slice(); scoreEl.textContent = score[0] + " - " + score[1];
          scoreEl.classList.remove("flash"); void scoreEl.offsetWidth; scoreEl.classList.add("flash");
        }
        addLine(ev);
      });
    }

    function step() {
      if (done) return;
      if (paused) return; // retoma via openPause -> step()
      if (!screen.isConnected) { done = true; return; } // usuário saiu da tela
      if (minute > 90) { end(); return; }
      var hasGoal = (byMin[minute] || []).some(function (e) { return e.type === "goal" || e.type === "pengoal" || e.type === "penalty"; });
      renderMinute(minute);
      minute++;
      setTimeout(step, hasGoal ? delay * 7 : delay);
    }

    function end() {
      if (done) return; done = true;
      skipBtn.textContent = "Ver resultado ▶";
      skipBtn.className = "btn primary";
    }
    function finishNow() {
      if (!done) { for (var mm = minute; mm <= 90; mm++) renderMinute(mm); end(); }
    }

    if (delay === 0) { for (var mm = 0; mm <= 90; mm++) renderMinute(mm); end(); }
    else { setTimeout(step, 400); }
  }

  TM.matchview = { play: play };
})(window);
