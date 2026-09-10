/* ================= TOTAL MATCH — Arena Coins (modos que gastam Total Coins) ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  // custos e prêmios dos modos da Arena
  var A = {
    blitz: { entry: 15, win: 10, sweep: 50 },      // Desafio Relâmpago: 3 jogos seguidos
    boss: { entry: 25, win: 80, draw: 20 },         // Chefão: Time das Lendas
    bet: { stakes: [5, 10, 20], mult: 2, multDraw: 3 } // Palpite: aposta no resultado
  };
  var KEY = "totalmatch:arena";
  function key() { var ed = "public"; try { ed = TM.storage.edition ? TM.storage.edition() : "public"; } catch (e) {} return KEY + ":" + ed; }
  function load() { try { return JSON.parse(localStorage.getItem(key()) || "null"); } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(key(), JSON.stringify(s)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(key()); } catch (e) {} }
  function coins() { return TM.coins || null; }
  function needAcct() {
    if (!coins()) return true;
    if (coins().hasAccount()) return true;
    TM.ui.confirm("Precisa de conta", "Os modos da Arena usam Total Coins, e coins ficam guardados na sua conta. Crie ou entre na sua conta para jogar.", "Ir para o perfil", function () { TM.ui.go("profile"); });
    return false;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function allClubs() { return TM.data.world().clubs.filter(function (c) { return TM.data.clubPlayers(c.id).length >= 11; }); }
  function fmtC(n) { return n + " 🪙"; }

  function rule(ic, tx, v) { return el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: ic }), el("span", { class: "coin-rule-tx", text: tx }), el("span", { class: "coin-rule-v", text: v }) ]); }
  function modeCard(ic, name, desc, cost, prize, onGo) {
    return el("button", { class: "arena-card", on: { click: onGo } }, [
      el("span", { class: "arena-ic", text: ic }),
      el("span", { class: "arena-txt" }, [
        el("span", { class: "arena-name", text: name }),
        el("span", { class: "arena-desc", text: desc }),
        el("span", { class: "arena-meta" }, [ el("span", { class: "arena-cost", text: "Custa " + cost }), el("span", { class: "arena-prize", text: "Prêmio " + prize }) ])
      ]),
      el("span", { class: "side-arrow", text: "→", style: "opacity:1" })
    ]);
  }

  /* ---------- HUB ---------- */
  TM.ui.register("arena", function (screen) {
    screen.appendChild(TM.ui.topbar("🪙 Arena Coins", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "coin-entry" }, [ coins() ? coins().badge() : el("span"), el("span", { class: "coin-entry-tx", text: "Modos que custam Total Coins e pagam de volta quem vence." }) ]));
    var s = load();
    if (s && s.kind === "blitz" && !s.ended) {
      body.appendChild(el("div", { class: "invite-banner" }, [
        el("div", { class: "inv-txt", text: "⚡ Desafio Relâmpago em andamento — jogo " + (s.results.length + 1) + " de 3" }),
        el("div", { class: "inv-acts" }, [ TM.ui.button("▶ Continuar", function () { TM.ui.go("arena-blitz"); }, "btn primary small") ])
      ]));
    }
    body.appendChild(modeCard("⚡", "Desafio Relâmpago", "Escolha seu clube e vença 3 adversários seguidos, cada um mais forte. Perdeu, acabou.", fmtC(A.blitz.entry), "+" + A.blitz.win + " por vitória · +" + A.blitz.sweep + " nos 3", function () {
      if (!needAcct()) return;
      var cur = load();
      if (cur && cur.kind === "blitz" && !cur.ended) { TM.ui.go("arena-blitz"); return; }
      TM.ui.pickTeam({ source: "club", title: "Seu clube no Relâmpago", current: null, back: function () { TM.ui.go("arena"); }, onPick: function (pid) {
        coins().pay(A.blitz.entry, "Entrada · Desafio Relâmpago", function () { startBlitz(pid); });
      } });
    }));
    body.appendChild(modeCard("👑", "Chefão: Time das Lendas", "Um jogo só contra o melhor XI do mundo inteiro. Escolha seu clube e tente derrubar as lendas.", fmtC(A.boss.entry), "+" + A.boss.win + " vitória · +" + A.boss.draw + " empate", function () {
      if (!needAcct()) return;
      TM.ui.pickTeam({ source: "club", title: "Seu clube contra as Lendas", current: null, back: function () { TM.ui.go("arena"); }, onPick: function (pid) {
        coins().pay(A.boss.entry, "Entrada · Chefão das Lendas", function () { TM.ui.go("arena-boss", { clubId: pid }); });
      } });
    }));
    body.appendChild(modeCard("🎯", "Palpite", "Dois clubes sorteados. Aposte no vencedor (ou no empate) e veja o jogo. Acertou, dobra; empate paga o triplo.", A.bet.stakes.join(" / ") + " 🪙", "×" + A.bet.mult + " · ×" + A.bet.multDraw + " no empate", function () {
      if (!needAcct()) return;
      TM.ui.go("arena-bet");
    }));
    body.appendChild(el("div", { class: "list-head", text: "Regras" }));
    body.appendChild(el("div", { class: "coin-rules" }, [
      rule("⚡", "Relâmpago: entrada", "−" + A.blitz.entry + " 🪙"),
      rule("✔", "Relâmpago: cada vitória / vencer os 3", "+" + A.blitz.win + " / +" + A.blitz.sweep + " 🪙"),
      rule("👑", "Chefão: entrada / vitória / empate", "−" + A.boss.entry + " / +" + A.boss.win + " / +" + A.boss.draw + " 🪙"),
      rule("🎯", "Palpite: acertou o vencedor / acertou o empate", "×" + A.bet.mult + " / ×" + A.bet.multDraw)
    ]));
  });

  /* ---------- DESAFIO RELÂMPAGO ---------- */
  function startBlitz(clubId) {
    var mine = TM.data.clubRating(clubId);
    var pool = allClubs().filter(function (c) { return c.id !== clubId; });
    // 3 adversários: um mais fraco/igual, um parecido, um mais forte (o "chefe")
    function band(lo, hi) { var b = pool.filter(function (c) { var r = TM.data.clubRating(c.id); return r >= lo && r <= hi; }); return b.length ? b : pool; }
    var c1 = pick(band(mine - 8, mine - 1)), c2 = pick(band(mine - 2, mine + 3).filter(function (c) { return c.id !== c1.id; }) || pool), c3 = pick(band(mine + 2, 99).filter(function (c) { return c.id !== c1.id && c.id !== c2.id; }));
    if (!c2) c2 = pick(pool); if (!c3) c3 = pick(pool);
    var s = { kind: "blitz", clubId: clubId, oppIds: [c1.id, c2.id, c3.id], results: [], ended: false, earned: 0 };
    save(s); TM.ui.go("arena-blitz");
  }

  TM.ui.register("arena-blitz", function (screen) {
    var s = load(); if (!s || s.kind !== "blitz") { TM.ui.go("arena"); return; }
    screen.appendChild(TM.ui.topbar("⚡ Desafio Relâmpago", function () {
      if (s.ended) { clear(); TM.ui.go("arena"); return; }
      TM.ui.confirm("Desistir do desafio?", "A entrada não volta e a sequência é perdida.", "Desistir", function () { clear(); TM.ui.go("arena"); }, true);
    }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var club = TM.data.club(s.clubId);
    body.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [ el("div", { class: "ch-name", text: club.name }), el("div", { class: "ch-sub", text: "Força " + TM.data.clubRating(club.id) + " · vença os 3 seguidos" }) ]),
      coins() ? el("div", { class: "ch-coins" }, [ coins().badge() ]) : el("span")
    ]));
    var done = s.results.length;
    var ladder = el("div", { class: "ladder" });
    s.oppIds.forEach(function (oid, i) {
      var oc = TM.data.club(oid);
      var st = i < done ? s.results[i].res : (i === done && !s.ended ? "next" : "lock");
      ladder.appendChild(el("div", { class: "ladder-row " + (st === "V" ? "win" : st === "D" ? "loss" : st === "E" ? "draw" : st === "next" ? "next" : "lock") }, [
        el("span", { class: "ladder-n", text: (i + 1) }),
        TM.img.clubImg(oc, "ladder-crest"),
        el("div", { class: "ladder-info" }, [
          el("div", { class: "ladder-name", text: oc.name + (i === 2 ? " 👑" : "") }),
          el("div", { class: "ladder-sub", text: i < done ? ("Resultado: " + s.results[i].label) : ("Força " + TM.data.clubRating(oid)) })
        ]),
        el("span", { class: "ladder-tag", text: st === "V" ? "✔" : st === "D" ? "✖" : st === "E" ? "=" : st === "next" ? "▶" : "🔒" })
      ]));
    });
    body.appendChild(ladder);
    if (s.ended) {
      var wins = s.results.filter(function (r) { return r.res === "V"; }).length;
      body.appendChild(el("div", { class: "next-match season-end" }, [
        el("div", { class: "nm-label", text: wins === 3 ? "🏆 VENCEU OS 3!" : "✖ FIM DO DESAFIO" }),
        el("div", { class: "nm-teams", text: wins + " vitória(s) · ganhou " + s.earned + " 🪙" }),
        TM.ui.button("🔁 Jogar de novo (" + A.blitz.entry + " 🪙)", function () {
          TM.ui.pickTeam({ source: "club", title: "Seu clube no Relâmpago", current: s.clubId, back: function () { TM.ui.go("arena-blitz"); }, onPick: function (pid) { coins().pay(A.blitz.entry, "Entrada · Desafio Relâmpago", function () { startBlitz(pid); }); } });
        }, "btn primary"),
        TM.ui.button("Voltar à Arena", function () { clear(); TM.ui.go("arena"); }, "btn ghost")
      ]));
      return;
    }
    var next = TM.data.club(s.oppIds[done]);
    body.appendChild(el("div", { class: "next-match" }, [
      el("div", { class: "nm-label", text: "Jogo " + (done + 1) + " de 3" + (done === 2 ? " · CHEFE 👑" : "") }),
      el("div", { class: "nm-teams" }, [ el("span", { text: club.name }), el("span", { class: "nm-x", text: "×" }), el("span", { text: next.name }) ]),
      TM.ui.button("🔍 Analisar adversário", function () { TM.ui.go("scout", { teamId: next.id, isNation: false, compId: null, back: function () { TM.ui.go("arena-blitz"); } }); }, "btn ghost"),
      TM.ui.button("▶ Jogar", function () { TM.ui.go("arena-blitz-play"); }, "btn primary")
    ]));
  });

  TM.ui.register("arena-blitz-play", function (screen) {
    var s = load(); if (!s || s.kind !== "blitz" || s.ended) { TM.ui.go("arena"); return; }
    var done = s.results.length;
    var teamA = TM.engine.teamFromClub(s.clubId), teamB = TM.engine.teamFromClub(s.oppIds[done]);
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: true };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, settings: settings, title: "⚡ Relâmpago · Jogo " + (done + 1),
      pauseSide: 0, simOpts: simOpts, formation: "4-3-3",
      onBack: function () { TM.ui.go("arena-blitz"); },
      onDone: function () {
        var hs = result.score[0], as = result.score[1];
        var res = hs > as ? "V" : as > hs ? "D" : "E";
        s.results.push({ res: res, label: hs + "×" + as + " (" + teamB.name + ")" });
        if (res === "V") {
          coins() && coins().earn(A.blitz.win, "Vitória · Relâmpago"); s.earned += A.blitz.win;
          if (s.results.length === 3) { coins() && coins().earn(A.blitz.sweep, "Venceu os 3 · Relâmpago"); s.earned += A.blitz.sweep; s.ended = true; }
        } else { s.ended = true; }
        save(s); TM.ui.go("arena-blitz");
      }
    });
  });

  /* ---------- CHEFÃO: TIME DAS LENDAS ---------- */
  function legendsTeam() {
    var W = TM.data.world(), all = Object.keys(W.playersById || {}).map(function (k) { return W.playersById[k]; }).filter(function (p) { return p && p.clubId; });
    function top(pos, n) { return all.filter(function (p) { return p.pos === pos; }).sort(function (a, b) { return (b.overall || 0) - (a.overall || 0); }).slice(0, n); }
    var xi = top("GK", 1).concat(top("DF", 4), top("MF", 3), top("FW", 3));
    var bench = top("GK", 2).slice(1).concat(top("DF", 6).slice(4), top("MF", 5).slice(3), top("FW", 5).slice(3));
    return { id: "legends", name: "Time das Lendas", players: xi.concat(bench) };
  }
  TM.ui.register("arena-boss", function (screen, params) {
    if (!params || !params.clubId) { TM.ui.go("arena"); return; }
    var teamA = TM.engine.teamFromClub(params.clubId), teamB = legendsTeam();
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: true };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    var finished = false;
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, settings: settings, title: "👑 Chefão das Lendas",
      pauseSide: 0, simOpts: simOpts, formation: "4-3-3",
      onBack: function () { if (!finished) TM.ui.confirm("Sair do jogo?", "A entrada não volta.", "Sair", function () { TM.ui.go("arena"); }, true); else TM.ui.go("arena"); },
      onDone: function () {
        finished = true;
        var hs = result.score[0], as = result.score[1];
        var msg, gain = 0;
        if (hs > as) { gain = A.boss.win; msg = "🏆 DERRUBOU AS LENDAS!"; }
        else if (hs === as) { gain = A.boss.draw; msg = "= Segurou o empate"; }
        else msg = "✖ As Lendas venceram";
        if (gain && coins()) coins().earn(gain, hs > as ? "Derrubou as Lendas · Chefão" : "Empate · Chefão");
        TM.ui.confirm(msg, teamA.name + " " + hs + " × " + as + " " + teamB.name + (gain ? " · +" + gain + " 🪙" : ""), "Voltar à Arena", function () { TM.ui.go("arena"); });
      }
    });
  });

  /* ---------- PALPITE ---------- */
  var bet = null; // { a, b, stake, pick }
  function newBetPair() {
    var lgs = TM.data.world().leagues.filter(function (l) { return l.clubIds && l.clubIds.length >= 4; });
    var lg = pick(lgs), ids = shuffle(lg.clubIds).slice(0, 2);
    bet = { league: lg.id, a: ids[0], b: ids[1], stake: A.bet.stakes[0], pick: null };
  }
  TM.ui.register("arena-bet", function (screen) {
    screen.appendChild(TM.ui.topbar("🎯 Palpite", function () { TM.ui.go("arena"); }));
    if (!bet) newBetPair();
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "coin-entry" }, [ coins() ? coins().badge() : el("span"), el("span", { class: "coin-entry-tx", text: "Acertou o vencedor: ×" + A.bet.mult + " · acertou o empate: ×" + A.bet.multDraw }) ]));
    var ca = TM.data.club(bet.a), cb = TM.data.club(bet.b), lg = TM.data.league(bet.league);
    body.appendChild(el("div", { class: "list-head", text: lg.name + " · campo neutro" }));
    function side(c, tag) {
      return el("button", { class: "bet-side" + (bet.pick === tag ? " on" : ""), on: { click: function () { bet.pick = tag; TM.ui.go("arena-bet"); } } }, [
        TM.img.clubImg(c, "bet-crest"), el("span", { class: "bet-name", text: c.name }), el("span", { class: "bet-ov", text: "Força " + TM.data.clubRating(c.id) })
      ]);
    }
    body.appendChild(el("div", { class: "bet-board" }, [
      side(ca, "A"),
      el("button", { class: "bet-side draw" + (bet.pick === "X" ? " on" : ""), on: { click: function () { bet.pick = "X"; TM.ui.go("arena-bet"); } } }, [ el("span", { class: "bet-x", text: "X" }), el("span", { class: "bet-name", text: "Empate" }), el("span", { class: "bet-ov", text: "paga ×" + A.bet.multDraw }) ]),
      side(cb, "B")
    ]));
    body.appendChild(el("div", { class: "list-head", text: "Quanto apostar" }));
    var seg = el("div", { class: "segmented full" });
    A.bet.stakes.forEach(function (v) { seg.appendChild(el("button", { class: "seg-btn" + (bet.stake === v ? " active" : ""), text: v + " 🪙", on: { click: function () { bet.stake = v; TM.ui.go("arena-bet"); } } })); });
    body.appendChild(seg);
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("🔀 Sortear outros clubes", function () { newBetPair(); TM.ui.go("arena-bet"); }, "btn ghost"),
      TM.ui.button(bet.pick ? "🎯 Apostar " + bet.stake + " 🪙 e ver o jogo" : "Escolha um palpite", function () {
        if (!bet.pick) { TM.ui.toast("Escolha o vencedor ou o empate"); return; }
        if (!needAcct()) return;
        coins().pay(bet.stake, "Aposta · Palpite", function () { TM.ui.go("arena-bet-play"); });
      }, "btn primary big")
    ]));
  });
  TM.ui.register("arena-bet-play", function (screen) {
    if (!bet || !bet.pick) { TM.ui.go("arena-bet"); return; }
    var b = bet; bet = null;
    var teamA = TM.engine.teamFromClub(b.a), teamB = TM.engine.teamFromClub(b.b);
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: true };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    var finished = false;
    function settle() {
      if (finished) return; finished = true;
      var hs = result.score[0], as = result.score[1];
      var out = hs > as ? "A" : as > hs ? "B" : "X";
      var hit = out === b.pick, gain = hit ? b.stake * (out === "X" ? A.bet.multDraw : A.bet.mult) : 0;
      if (gain && coins()) coins().earn(gain, "Acertou o palpite");
      TM.ui.confirm(hit ? "🎯 ACERTOU!" : "✖ Errou o palpite", teamA.name + " " + hs + " × " + as + " " + teamB.name + (hit ? " · +" + gain + " 🪙" : " · perdeu " + b.stake + " 🪙"), "Novo palpite", function () { TM.ui.go("arena-bet"); });
    }
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, settings: settings, title: "🎯 Palpite: " + (b.pick === "A" ? teamA.name : b.pick === "B" ? teamB.name : "Empate"),
      simOpts: simOpts, formation: "4-3-3",
      onBack: function () { settle(); },
      onDone: function () { settle(); }
    });
  });

  TM.arena = { COST: A };
})(window);
