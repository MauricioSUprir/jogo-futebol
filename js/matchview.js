/* ================= TOTAL MATCH — visão imersiva da partida ================= */
/* Reproduz a partida como uma transmissão: o relógio corre minuto a minuto e
   os lances vão surgindo embaixo em tempo real. Usada na Partida Rápida e nas
   carreiras. Chama onDone() ao terminar. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var el = null;
  function E() { el = TM.ui.el; }

  var SPEED = { instantaneo: 0, rapido: 22, normal: 62 };

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
    var skipBtn = TM.ui.button("Pular ⏭", function () { finishNow(); }, "btn ghost");
    actions.appendChild(skipBtn);
    screen.appendChild(actions);

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
      skipBtn.onclick = function () { onDone(); };
    }
    function finishNow() {
      if (done) { onDone(); return; }
      // renderiza tudo instantaneamente
      done = true;
      for (var mm = minute; mm <= 90; mm++) renderMinute(mm);
      end();
    }

    if (delay === 0) { for (var mm = 0; mm <= 90; mm++) renderMinute(mm); end(); }
    else { setTimeout(step, 400); }
  }

  TM.matchview = { play: play };
})(window);
