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
    function crestOf(t) {
      if (t.club) return TM.img.clubImg(t.club, "bc-crest");
      if (t.nation) return TM.img.nationImg(t.nation, "bc-crest");
      return null;
    }
    function teamCol(t) {
      var kids = [];
      var cr = crestOf(t);
      if (cr) kids.push(cr);
      kids.push(el("div", { class: "bc-team-name", text: t.name }));
      var co = coachOf(t);
      if (co) kids.push(el("div", { class: "bc-coach", text: "Téc. " + co }));
      return el("div", { class: "bc-team" }, kids);
    }
    var broadcastEl = el("div", { class: "broadcast" }, [
      el("div", { class: "bc-top" }, [
        teamCol(a),
        el("div", { class: "bc-center" }, [ scoreEl, clockEl ]),
        teamCol(b)
      ]),
      el("div", { class: "bc-progress" }, [ progressFill ])
    ]);
    screen.appendChild(broadcastEl);

    // estádio do jogo (foto + nome) — mandante = time A; em jogo neutro, mostra como sede
    var stadBannerEl = null;
    var homeClub = a.club || null;
    if (homeClub && TM.ui.stadiumBanner) {
      var neutral = cfg.simOpts && cfg.simOpts.neutral;
      var sb = TM.ui.stadiumBanner(homeClub, { compact: true, label: neutral ? "Sede da partida" : (TM.data.stadium(homeClub).capacity ? Math.round(TM.data.stadium(homeClub).capacity / 1000) + " mil lugares · casa do " + a.name : "casa do " + a.name) });
      if (sb) { screen.appendChild(sb); stadBannerEl = sb; }
    }

    var feed = el("div", { class: "broadcast-feed" });
    screen.appendChild(feed);

    // ---- Campo 2D (alterna com o tradicional a qualquer momento) ----
    var pitch = null, pitchOn = false, liveMult = 1;
    var pitchHost = el("div", { class: "p2d-host", style: "display:none" });
    screen.appendChild(pitchHost);
    if (TM.pitch2d && delay > 0) {
      try {
        pitch = TM.pitch2d.create({ a: a, b: b, formationA: cfg.formation || "4-4-2", formationB: "4-4-2" });
        pitchHost.appendChild(pitch.el);
        pitch.onSpeed = function (m) { liveMult = m; };
      } catch (e) { pitch = null; }
    }
    function toggleView() {
      if (!pitch) { TM.ui.toast("Campo 2D indisponível nesta partida"); return; }
      pitchOn = !pitchOn;
      pitchHost.style.display = pitchOn ? "" : "none";
      broadcastEl.style.display = pitchOn ? "none" : "";
      feed.style.display = pitchOn ? "none" : "";
      if (stadBannerEl) stadBannerEl.style.display = pitchOn ? "none" : "";
      viewBtn.textContent = pitchOn ? "📋 Tradicional" : "🎥 Campo 2D";
      if (pitchOn) { pitch.start(); pitch.setScore(score); pitch.setClock(minute); pitch.tick(minute, byMin[minute] || []); }
      else { pitch.stop(); liveMult = 1; }
    }

    var actions = el("div", { class: "actions" });
    // botão de pausa (só quando há um lado controlável e a partida está animada)
    var canPause = cfg.pauseSide != null && delay > 0;
    var userTactic = (cfg.simOpts && cfg.simOpts.tactic) || "equilibrado";
    var subsUsed = 0;
    if (canPause) actions.appendChild(TM.ui.button("⏸ Pausar", function () { openPause(); }, "btn"));
    // alternar visão Tradicional <-> Campo 2D
    var viewBtn = TM.ui.button("🎥 Campo 2D", function () { toggleView(); }, "btn");
    actions.appendChild(viewBtn);
    // um único handler: durante o jogo "Pular" encerra; depois "Ver resultado" avança (uma vez só)
    var skipBtn = TM.ui.button("Pular ⏭", function () { onSkip(); }, "btn ghost");
    actions.appendChild(skipBtn);
    screen.appendChild(actions);
    var proceeded = false, paused = false, flashing = false, animating = true;

    // ---- flash de cartão / vermelho / lesão (pausa a partida, mostra o jogador) ----
    function playerOfEvent(ev) {
      var team = ev.team === 0 ? a : b, found = null;
      (team.players || []).forEach(function (p) { if (!found && (p.id === ev.playerId || p.name === ev.player)) found = p; });
      return found;
    }
    function showCardFlash(ev) {
      var pl = playerOfEvent(ev), kind = ev.type;
      var label = kind === "red" ? "CARTÃO VERMELHO" : kind === "yellow" ? "CARTÃO AMARELO" : "LESÃO";
      var mark = kind === "injury" ? el("div", { class: "cf-injury", text: "🚑" }) : el("div", { class: "cf-card cf-" + kind });
      var overlay = el("div", { class: "card-flash cf-bg-" + kind }, [
        el("div", { class: "cf-inner" }, [
          mark,
          (pl ? TM.img.playerImg(pl, "cf-face") : el("div", { class: "cf-face cf-noface" })),
          el("div", { class: "cf-min", text: ev.minute + "'" }),
          el("div", { class: "cf-label", text: label }),
          el("div", { class: "cf-name", text: (pl && pl.name) || ev.player || "" }),
          el("div", { class: "cf-team", text: (ev.team === 0 ? a.name : b.name) })
        ])
      ]);
      document.body.appendChild(overlay);
      flashing = true;
      var dismissed = false;
      function dismiss() { if (dismissed) return; dismissed = true; overlay.classList.add("out"); setTimeout(function () { overlay.remove(); }, 220); flashing = false; if (!done && !paused && !proceeded) step(); }
      overlay.addEventListener("click", dismiss);
      setTimeout(dismiss, 2000);
    }
    // VAR imersivo e interativo: pausa a partida, "analisa" o lance e revela o veredito.
    function showVarReview(ev, after) {
      var annulled = ev.decision === "annulled";
      flashing = true;
      var overlay = el("div", { class: "var-review" });
      var stage = el("div", { class: "var-stage" });
      // mini-campo estilo VAR: linha do defensor (vermelha) e do atacante (azul).
      // impedido (annulled) -> atacante à frente do defensor (mais perto do gol, à direita).
      var defX = 48, atkX = annulled ? 60 : 44;   // % da largura
      var mini = el("div", { class: "var-mini" }, [
        el("div", { class: "var-goal" }),
        el("div", { class: "var-cal def", style: "left:" + defX + "%" }, [ el("span", { class: "var-cal-dot" }) ]),
        el("div", { class: "var-cal atk", style: "left:" + atkX + "%" }, [ el("span", { class: "var-cal-dot" }) ]),
        el("div", { class: "var-gap" + (annulled ? " off" : " on"), style: "left:" + Math.min(defX, atkX) + "%;width:" + Math.abs(atkX - defX) + "%" })
      ]);
      var head = el("div", { class: "var-title" }, [ el("span", { class: "var-tv", text: "📺" }), el("span", { text: "REVISÃO DO VAR" }) ]);
      var sub = el("div", { class: "var-sub", text: "Checando o lance…" });
      var bar = el("div", { class: "var-bar" }, [ el("i") ]);
      stage.appendChild(head); stage.appendChild(mini); stage.appendChild(sub); stage.appendChild(bar);
      var actionWrap = el("div", { class: "var-action" });
      stage.appendChild(actionWrap);
      overlay.appendChild(stage);
      document.body.appendChild(overlay);

      var done2 = false;
      function finishVar() {
        if (done2) return; done2 = true;
        overlay.classList.add("out");
        setTimeout(function () { overlay.remove(); }, 260);
        flashing = false;
        after && after();                         // mostra o gol (se confirmado) / segue o lance
        if (!done && !paused && !proceeded) step();
      }
      function reveal() {
        sub.textContent = annulled ? ev.reason : ev.reason;
        var verdict = el("div", { class: "var-verdict " + (annulled ? "no" : "ok") }, [
          el("div", { class: "var-stamp", text: annulled ? "GOL ANULADO" : "GOL VALIDADO" }),
          el("div", { class: "var-reason", text: ev.reason })
        ]);
        stage.insertBefore(verdict, actionWrap);
        actionWrap.innerHTML = "";
        actionWrap.appendChild(TM.ui.button("Continuar ▶", finishVar, "btn primary"));
      }
      // interativo: o usuário toca em "Ver decisão" para revelar o veredito
      actionWrap.appendChild(TM.ui.button("🔍 Ver decisão do VAR", function () { bar.classList.add("full"); reveal(); }, "btn"));
      // avança sozinho se ninguém tocar (não trava a partida)
      setTimeout(function () { if (!done2 && !stage.querySelector(".var-verdict")) { bar.classList.add("full"); reveal(); } }, 3200);
    }
    function onSkip() {
      if (proceeded) return;                 // ignora cliques repetidos
      if (!done) finishNow();                // ainda rolando -> encerra a animação na hora
      proceeded = true; onDone();            // e já avança para o resultado (um clique só)
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

      // tática (dropdown compacto)
      box.appendChild(el("div", { class: "pause-field" }, [ TM.ui.dropdown("Tática", TM.engine.TACTICS, userTactic, function (v) { userTactic = v; }) ]));

      // substituições — campinho (igual à tela de elenco)
      var counterLabel = el("label", { text: "Substituições (" + subsUsed + "/3)" });
      box.appendChild(el("div", { class: "pause-field" }, [ counterLabel ]));
      var subArea = el("div", { class: "pause-lineup" });
      box.appendChild(subArea);
      var selOut = { idx: null };
      var FORMS = (TM.comp && TM.comp.FORMATIONS) || {};
      var formation = cfg.formation || "4-4-2";
      function renderSubs() {
        TM.ui.clear(subArea);
        var slots = FORMS[formation] || FORMS["4-4-2"] || [];
        var pitch = el("div", { class: "pitch" });
        pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
        pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
        team.players.slice(0, 11).forEach(function (pl, i) {
          var slot = slots[i] || [null, 50, 50];
          pitch.appendChild(el("button", { class: "pl-chip" + (selOut.idx === i ? " picked" : ""), style: "left:" + slot[1] + "%;top:" + slot[2] + "%",
            on: { click: function () { selOut.idx = (selOut.idx === i ? null : i); renderSubs(); } } },
            TM.ui.chipKids(pl, slot, { name: shortP(pl.name), age: pl.age ? true : false })
          ));
        });
        subArea.appendChild(pitch);
        subArea.appendChild(el("div", { class: "lineup-hint", text: selOut.idx != null ? "Toque num reserva para colocá-lo no lugar do titular." : "Toque num titular e depois num reserva para trocar." }));
        var benchWrap = el("div", { class: "pause-bench" }, [ el("div", { class: "sub-col-h", text: "Reservas" }) ]);
        team.players.slice(11, 24).forEach(function (pl, bi) {
          var row = TM.ui.playerRow(pl, {});
          row.classList.add("clickable");
          row.addEventListener("click", function () {
            if (selOut.idx == null) { TM.ui.toast("Selecione um titular primeiro"); return; }
            if (subsUsed >= 3) { TM.ui.toast("Você já fez 3 substituições"); return; }
            var oi = selOut.idx, bidx = 11 + bi;
            var tmp = team.players[oi]; team.players[oi] = team.players[bidx]; team.players[bidx] = tmp;
            subsUsed++; selOut.idx = null;
            counterLabel.textContent = "Substituições (" + subsUsed + "/3)";
            renderSubs();
          });
          benchWrap.appendChild(row);
        });
        subArea.appendChild(benchWrap);
      }
      renderSubs();
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
      } else if (ev.type === "sub") {
        node = lineWith("🔄 SUBSTITUIÇÃO", (ev["in"] + " ⬆  " + ev.out + " ⬇"), "sub");
      } else if (ev.type === "var") {
        node = lineWith(ev.decision === "annulled" ? "📺 VAR — GOL ANULADO" : "📺 VAR — GOL CONFIRMADO",
          ev.reason + (ev.player ? " · " + ev.player : ""), ev.decision === "annulled" ? "red" : "sub");
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

    function processEvents(evs) {
      evs.forEach(function (ev) {
        if ((ev.type === "goal" || ev.type === "pengoal") && ev.team != null) {
          score = ev.score.slice(); scoreEl.textContent = score[0] + " - " + score[1];
          scoreEl.classList.remove("flash"); void scoreEl.offsetWidth; scoreEl.classList.add("flash");
        }
        addLine(ev);
      });
    }
    function renderMinute(mm) {
      clockEl.textContent = mm + "'";
      if (progressFill) progressFill.style.width = Math.min(100, mm / 90 * 100) + "%";
      if (pitch && pitchOn) pitch.tick(mm, byMin[mm] || []);
      var evs = byMin[mm] || [];
      if (animating && delay > 0) {
        var fev = null, varEv = null;
        for (var _i = 0; _i < evs.length; _i++) {
          var _e = evs[_i];
          if (!fev && (_e.type === "yellow" || _e.type === "red" || _e.type === "injury")) fev = _e;
          if (!varEv && _e.type === "var") varEv = _e;
        }
        // VAR imersivo: pausa, revisa e só então mostra o resto do lance (o gol, se confirmado)
        if (varEv) { showVarReview(varEv, function () { processEvents(evs); }); return; }
        if (fev) showCardFlash(fev);
      }
      processEvents(evs);
    }

    function step() {
      if (done) return;
      if (paused) return; // retoma via openPause -> step()
      if (flashing) return; // retoma via dismiss do flash de cartão
      if (!screen.isConnected) { done = true; return; } // usuário saiu da tela
      if (minute > 90) { end(); return; }
      var hasGoal = (byMin[minute] || []).some(function (e) { return e.type === "goal" || e.type === "pengoal" || e.type === "penalty"; });
      renderMinute(minute);
      minute++;
      if (flashing) return; // um cartão/lesão pausou: retoma depois
      // no Campo 2D o ritmo é mais lento (assistível); botões 1x/2x/4x aceleram
      var base = (pitch && pitchOn) ? 360 : delay;
      var d = (hasGoal ? base * (pitch && pitchOn ? 3 : 7) : base) / (liveMult || 1);
      setTimeout(step, d);
    }

    function end() {
      if (done) return; done = true;
      if (pitch) pitch.tick(90, [{ type: "full", score: score }]);
      skipBtn.textContent = "Ver resultado ▶";
      skipBtn.className = "btn primary";
    }
    function finishNow() {
      if (!done) { animating = false; for (var mm = minute; mm <= 90; mm++) renderMinute(mm); end(); }
    }

    if (delay === 0) { for (var mm = 0; mm <= 90; mm++) renderMinute(mm); end(); }
    else { setTimeout(step, 400); }
  }

  /* ---------- disputa de pênaltis (visual) ----------
     cfg: { teamA, teamB, shoot (resultado de TM.engine.shootout), title, onDone(winnerSide) } */
  function crestOf(t, cls) { return t.club ? TM.img.clubImg(t.club, cls) : (t.nation ? TM.img.nationImg(t.nation, cls) : el("span", { class: cls })); }
  function playShootout(screen, cfg) {
    E();
    var a = cfg.teamA, b = cfg.teamB, shoot = cfg.shoot;
    var onDone = cfg.onDone || function () {};
    screen.appendChild(TM.ui.topbar(cfg.title || "Disputa de pênaltis", null));

    var scoreA = el("span", { class: "pk-score-num", text: "0" });
    var scoreB = el("span", { class: "pk-score-num", text: "0" });
    screen.appendChild(el("div", { class: "pk-head" }, [
      el("div", { class: "pk-team" }, [ crestOf(a, "pk-crest"), el("div", { class: "pk-team-name", text: a.name }) ]),
      el("div", { class: "pk-score" }, [ scoreA, el("span", { class: "pk-score-x", text: "×" }), scoreB ]),
      el("div", { class: "pk-team" }, [ crestOf(b, "pk-crest"), el("div", { class: "pk-team-name", text: b.name }) ])
    ]));

    var colA = el("div", { class: "pk-col" }), colB = el("div", { class: "pk-col" });
    screen.appendChild(el("div", { class: "pk-grid" }, [ colA, colB ]));
    var statusLine = el("div", { class: "pk-status", text: "Batendo..." });
    screen.appendChild(statusLine);
    var actions = el("div", { class: "actions" });
    screen.appendChild(actions);

    var run = [0, 0]; // placar corrente
    var i = 0;
    function step() {
      if (i >= shoot.kicks.length) { finish(); return; }
      var k = shoot.kicks[i]; i++;
      var col = k.side === 0 ? colA : colB;
      if (k.scored) run[k.side]++;
      scoreA.textContent = run[0]; scoreB.textContent = run[1];
      var row = el("div", { class: "pk-kick" }, [
        (k.player ? TM.img.playerImg(k.player, "pk-face") : el("span", { class: "pk-face" })),
        el("span", { class: "pk-dot " + (k.scored ? "ok" : "miss") }),
        el("span", { class: "pk-kicker", text: k.name }),
        el("span", { class: "pk-mark", text: k.scored ? "⚽" : "✖" })
      ]);
      col.appendChild(row);
      // efeito de entrada
      row.style.opacity = "0"; row.style.transform = "translateY(6px)";
      requestAnimationFrame(function () { row.style.transition = "all .25s ease"; row.style.opacity = "1"; row.style.transform = "none"; });
      setTimeout(step, 780);
    }
    function finish() {
      var winner = shoot.winner === 0 ? a : b;
      statusLine.className = "pk-status done";
      statusLine.textContent = "🏆 " + winner.name + " venceu nos pênaltis (" + shoot.score[0] + "–" + shoot.score[1] + ")";
      actions.appendChild(TM.ui.button("Continuar", function () { onDone(shoot.winner); }, "btn primary"));
    }
    setTimeout(step, 500);
  }

  TM.ui.register("pen-shootout", function (screen, params) {
    if (!params || !params.shoot) { TM.ui.go((params && params.back) || "modes"); return; }
    if (params.compId) TM.ui.applyCompTheme(screen, params.compId);
    playShootout(screen, params);
  });

  TM.matchview = { play: play, playShootout: playShootout };
})(window);
