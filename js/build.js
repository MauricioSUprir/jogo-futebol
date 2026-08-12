/* ================= TOTAL MATCH — Modos de Construção ================= */
/* 💎 Time dos Sonhos (Fantasy, todas as ligas, com orçamento)
   🎲 Draft (escolhe uma liga, monta o time por sorteio 1-de-5, encara 6 times) */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  /* ---------- utilidades ---------- */
  var SLOTS = [ { pos: "GK", n: 1 }, { pos: "DF", n: 4 }, { pos: "MF", n: 3 }, { pos: "FW", n: 3 } ]; // 4-3-3
  var POS_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };
  var POS_ABBR = { GK: "GOL", DF: "ZAG", MF: "MEI", FW: "ATA" };
  var PITCH_SLOTS = TM.comp.FORMATIONS["4-3-3"];
  function shortNm(name) { var a = String(name).split(" "); return a.length > 1 ? a[0][0] + ". " + a[a.length - 1] : name; }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function teamOverall(players) { var xi = players.slice(0, 11); return Math.round(sum(xi.map(function (p) { return p.overall; })) / (xi.length || 1)); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function posRank(pos) { var r = POS_ORDER[pos]; return r == null ? 9 : r; } // cuidado: GK=0 é falsy
  function orderByPos(list) { return list.slice().sort(function (a, b) { return posRank(a.pos) - posRank(b.pos); }); }
  function cost(p) { return TM.data.marketValue(p); }
  function money(m) { return m >= 1 ? "€" + (m >= 100 ? Math.round(m) : m.toFixed(m < 10 ? 1 : 0)) + "M" : "€" + Math.round(m * 1000) + "k"; }

  var _allPool = null;
  function allLeaguePlayers() {
    if (_allPool) return _allPool;
    // monta a partir dos clubes (garante que todo jogador tem clube válido)
    var out = [];
    TM.data.world().clubs.forEach(function (c) { out = out.concat(TM.data.clubPlayers(c.id)); });
    _allPool = out;
    return _allPool;
  }
  function leaguePlayers(leagueId) {
    var lg = TM.data.league(leagueId), out = [];
    lg.clubIds.forEach(function (cid) { out = out.concat(TM.data.clubPlayers(cid)); });
    return out;
  }

  /* mini-cartão de jogador (foto + nome + ov + posição) */
  function playerCard(p, extra, cls) {
    var kids = [
      el("div", { class: "bc-face-wrap" }, [ TM.img.playerImg(p, "bc-face"), el("span", { class: "bc-pos", text: POS_ABBR[p.pos] || p.pos }) ]),
      el("div", { class: "bc-info" }, [
        el("div", { class: "bc-name", text: shortNm(p.name) }),
        el("div", { class: "bc-meta", text: p.age + " anos" + (extra ? " · " + extra : "") })
      ]),
      TM.ui.ovBadge(p.overall)
    ];
    return el("div", { class: "build-card" + (cls ? " " + cls : "") }, kids);
  }

  /* ============================================================
     LADDER / DESAFIO — usado pelos dois modos (6 jogos em sequência)
     state: { title, accent, myName, myPlayers, oppIds, idx, results:[] }
     ============================================================ */
  function saveCh(s) { TM.storage.write("buildchallenge", s); }
  function loadCh() { return TM.storage.read("buildchallenge", null); }
  function clearCh() { TM.storage.remove("buildchallenge"); }
  function myTeamObj(s) { return { id: "myteam", name: s.myName, players: s.myPlayers }; }

  function startChallenge(opts) {
    // opts: { title, accent, myName, myPlayers, oppIds }
    var s = { title: opts.title, accent: opts.accent || null, myName: opts.myName, myPlayers: opts.myPlayers, oppIds: opts.oppIds, idx: 0, results: [] };
    saveCh(s); TM.ui.go("build-hub");
  }

  TM.ui.register("build-hub", function (screen) {
    var s = loadCh(); if (!s) { TM.ui.go("modes"); return; }
    if (s.accent) TM.ui.applyCompTheme(screen, null); // reset
    screen.appendChild(TM.ui.topbar(s.title, function () {
      TM.ui.confirm("Sair do desafio?", "Seu progresso neste desafio será perdido.", "Sair", function () { clearCh(); TM.ui.go("modes"); }, true);
    }));
    if (s.accent) { screen.style.setProperty("--gold", s.accent); }

    var my = myTeamObj(s);
    // cabeçalho do meu time
    screen.appendChild(el("div", { class: "club-header" }, [
      el("div", { class: "myteam-badge", text: "★" }),
      el("div", {}, [ el("div", { class: "ch-name", text: s.myName }), el("div", { class: "ch-sub", text: "Força geral " + teamOverall(s.myPlayers) + " · " + s.myPlayers.length + " jogadores" }) ])
    ]));

    // campinho do meu time (na central)
    screen.appendChild(xiPitch(s.myPlayers));

    var done = s.results.length, total = s.oppIds.length;
    if (done >= total) { renderChDone(screen, s); return; }

    // escada de adversários
    var ladder = el("div", { class: "ladder" });
    s.oppIds.forEach(function (oid, i) {
      var club = TM.data.club(oid);
      var st = i < done ? (s.results[i].res) : (i === done ? "next" : "lock");
      var row = el("div", { class: "ladder-row " + (st === "V" ? "win" : st === "D" ? "loss" : st === "E" ? "draw" : st === "next" ? "next" : "lock") }, [
        el("span", { class: "ladder-n", text: (i + 1) }),
        TM.img.clubImg(club, "ladder-crest"),
        el("div", { class: "ladder-info" }, [
          el("div", { class: "ladder-name", text: club.name + (i === total - 1 ? " 👑" : "") }),
          el("div", { class: "ladder-sub", text: i < done ? ("Resultado: " + (s.results[i].label)) : ("Força " + TM.data.clubRating(oid)) })
        ]),
        el("span", { class: "ladder-tag", text: st === "V" ? "✔" : st === "D" ? "✖" : st === "E" ? "=" : st === "next" ? "▶" : "🔒" })
      ]);
      ladder.appendChild(row);
    });
    screen.appendChild(ladder);

    var nextClub = TM.data.club(s.oppIds[done]);
    var card = el("div", { class: "next-match" }, [
      el("div", { class: "nm-label", text: "Jogo " + (done + 1) + " de " + total + (done === total - 1 ? " · FINAL 👑" : "") }),
      el("div", { class: "nm-teams" }, [ el("span", { text: s.myName }), el("span", { class: "nm-x", text: "×" }), el("span", { text: nextClub.name }) ]),
      TM.ui.button("🔍 Analisar adversário", function () { TM.ui.go("scout", { teamId: nextClub.id, isNation: false, compId: null, back: function () { TM.ui.go("build-hub"); } }); }, "btn ghost"),
      TM.ui.button("▶ Jogar", function () { TM.ui.go("build-play"); }, "btn primary")
    ]);
    screen.appendChild(card);
    screen.appendChild(el("div", { class: "hub-actions" }, [
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("build-squad"); } } }, [ el("span", { class: "hub-ic", text: "📋" }), el("span", { text: "Meu elenco" }) ])
    ]));
  });

  // campinho (XI) só-leitura — reutilizado no hub e no "Meu elenco"
  function xiPitch(players) {
    var starters = players.slice(0, 11);
    var pitch = el("div", { class: "pitch scout-pitch" });
    pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
    pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
    starters.forEach(function (p, i) {
      var slot = PITCH_SLOTS[i] || [null, 50, 50];
      pitch.appendChild(el("div", { class: "pl-chip scout-chip", style: "left:" + slot[1] + "%;top:" + slot[2] + "%" }, [
        el("div", { class: "chip-face-wrap" }, [ TM.img.playerImg(p, "chip-face"), el("span", { class: "chip-ov", text: p.overall }) ]),
        el("span", { class: "chip-name", text: shortNm(p.name) }),
        el("span", { class: "chip-age", text: p.age + " anos" })
      ]));
    });
    return el("div", { class: "lineup-board" }, [pitch]);
  }

  // ver meu elenco (campinho + reservas) — só leitura
  TM.ui.register("build-squad", function (screen) {
    var s = loadCh(); if (!s) { TM.ui.go("modes"); return; }
    if (s.accent) screen.style.setProperty("--gold", s.accent);
    screen.appendChild(TM.ui.topbar("📋 Meu elenco", function () { TM.ui.go("build-hub"); }));
    var bench = s.myPlayers.slice(11);
    screen.appendChild(xiPitch(s.myPlayers));
    if (bench.length) {
      screen.appendChild(el("h3", { class: "block-title", text: "Reservas" }));
      var bl = el("div", { class: "build-list" });
      orderByPos(bench).forEach(function (p) { bl.appendChild(playerCard(p)); });
      screen.appendChild(bl);
    }
  });

  TM.ui.register("build-play", function (screen) {
    var s = loadCh(); if (!s) { TM.ui.go("modes"); return; }
    var done = s.results.length;
    if (done >= s.oppIds.length) { TM.ui.go("build-hub"); return; }
    var oppId = s.oppIds[done];
    var teamA = myTeamObj(s), teamB = TM.engine.teamFromClub(oppId);
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: true };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, settings: settings, title: s.title,
      pauseSide: 0, simOpts: simOpts, formation: "4-3-3",
      onBack: function () { TM.ui.go("build-hub"); },
      onDone: function () {
        var hs = result.score[0], as = result.score[1];
        var res = hs > as ? "V" : as > hs ? "D" : "E";
        s.results.push({ res: res, label: hs + "×" + as + " (" + teamB.name + ")" });
        saveCh(s);
        TM.ui.go("build-hub");
      }
    });
  });

  function renderChDone(screen, s) {
    var wins = s.results.filter(function (r) { return r.res === "V"; }).length;
    var beatChamp = s.results[s.results.length - 1] && s.results[s.results.length - 1].res === "V";
    var champ = wins === s.oppIds.length;
    screen.appendChild(el("div", { class: "next-match season-end" }, [
      el("div", { class: "nm-label", text: champ ? "🏆 INVICTO E CAMPEÃO!" : beatChamp ? "👑 Você venceu o time principal!" : "🏁 Desafio encerrado" }),
      el("div", { class: "nm-teams", text: s.myName + " — " + wins + " vitória(s) em " + s.oppIds.length + " jogos" }),
      el("p", { class: "intro-text", style: "text-align:center", text: champ ? "Perfeito! Você venceu todos os adversários." : beatChamp ? "Você derrubou o maior time do desafio. Excelente campanha!" : "Bom desafio! Tente de novo montando um time ainda melhor." })
    ]));
    var res = el("div", { class: "ladder" });
    s.results.forEach(function (r, i) {
      var club = TM.data.club(s.oppIds[i]);
      res.appendChild(el("div", { class: "ladder-row " + (r.res === "V" ? "win" : r.res === "D" ? "loss" : "draw") }, [
        el("span", { class: "ladder-n", text: (i + 1) }), TM.img.clubImg(club, "ladder-crest"),
        el("div", { class: "ladder-info" }, [ el("div", { class: "ladder-name", text: club.name }), el("div", { class: "ladder-sub", text: r.label }) ]),
        el("span", { class: "ladder-tag", text: r.res === "V" ? "✔" : r.res === "D" ? "✖" : "=" })
      ]));
    });
    screen.appendChild(res);
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Jogar de novo", function () { clearCh(); TM.ui.go(s.mode === "draft" ? "draft" : "dream"); }, "btn primary"),
      TM.ui.button("Voltar ao menu", function () { clearCh(); TM.ui.go("modes"); }, "btn ghost")
    ]));
  }

  // adversários: 6 clubes de uma lista, do mais fraco ao mais forte
  function ladderFromClubs(clubIds, n) {
    var asc = clubIds.slice().sort(function (a, b) { return TM.data.clubRating(a) - TM.data.clubRating(b); });
    var picks = [], L = asc.length;
    for (var k = 0; k < n; k++) { picks.push(asc[Math.round(k * (L - 1) / (n - 1))]); }
    return picks; // último = mais forte
  }

  /* ============================================================
     💎 TIME DOS SONHOS (Fantasy — todas as ligas, com orçamento)
     ============================================================ */
  var dream = null; // { budget, spent, squad: {slotKey: player} }
  function dreamSlotKeys() { var keys = []; SLOTS.forEach(function (sl) { for (var i = 0; i < sl.n; i++) keys.push(sl.pos + i); }); return keys; }
  function dreamSpent() { return dreamSlotKeys().reduce(function (s, k) { return s + (dream.squad[k] ? cost(dream.squad[k]) : 0); }, 0); }
  function dreamFilled() { return dreamSlotKeys().filter(function (k) { return dream.squad[k]; }).length; }

  TM.ui.register("dream", function (screen) {
    screen.appendChild(TM.ui.topbar("💎 Time dos Sonhos", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Monte o elenco dos seus sonhos com jogadores de TODAS as ligas, dentro de um orçamento. Depois encare os 6 maiores clubes do mundo." }));
    body.appendChild(el("div", { class: "list-head", text: "Escolha o orçamento" }));
    var opts = [
      { k: "lenda", label: "🔥 Lenda", v: 250, sub: "€250M — só dá pra alguns craques" },
      { k: "pro", label: "⭐ Profissional", v: 400, sub: "€400M — equilíbrio" },
      { k: "magnata", label: "💰 Magnata", v: 650, sub: "€650M — quase sem limites" }
    ];
    var seg = el("div", { class: "preset-msgs" });
    opts.forEach(function (o) {
      seg.appendChild(el("button", { class: "preset-msg", on: { click: function () {
        dream = { budget: o.v, squad: {} };
        TM.ui.go("dream-build");
      } } }, [ el("span", { class: "preset-ic", text: o.label.split(" ")[0] }), el("span", { class: "preset-tx", text: o.label.replace(/^\S+\s/, "") + " — " + o.sub }), el("span", { class: "preset-mood", text: "→" }) ]));
    });
    body.appendChild(seg);
  });

  TM.ui.register("dream-build", function (screen) {
    if (!dream) { TM.ui.go("dream"); return; }
    screen.appendChild(TM.ui.topbar("💎 Montar time", function () { TM.ui.go("dream"); }));
    var spent = dreamSpent(), rem = dream.budget - spent;
    // barra de orçamento
    var pct = Math.max(0, Math.min(100, spent / dream.budget * 100));
    screen.appendChild(el("div", { class: "budget-bar" }, [
      el("div", { class: "budget-line" }, [
        el("span", { text: "Gasto: " + money(spent) }),
        el("span", { class: rem < 0 ? "over" : "", text: "Resta: " + money(rem) })
      ]),
      el("div", { class: "budget-track" }, [ el("div", { class: "budget-fill" + (spent > dream.budget ? " over" : ""), style: "width:" + pct + "%" }) ])
    ]));
    // slots por posição
    var keys = dreamSlotKeys();
    var grid = el("div", { class: "build-list" });
    keys.forEach(function (k) {
      var pos = k.replace(/[0-9]/g, ""), p = dream.squad[k];
      if (p) {
        var c = playerCard(p, money(cost(p)), "clickable");
        c.addEventListener("click", function () { delete dream.squad[k]; TM.ui.go("dream-build"); });
        c.appendChild(el("span", { class: "card-x", text: "✕" }));
        grid.appendChild(c);
      } else {
        grid.appendChild(el("button", { class: "slot-empty", on: { click: function () { TM.ui.go("dream-pick", { key: k, pos: pos }); } } }, [
          el("span", { class: "slot-pos", text: POS_ABBR[pos] }), el("span", { class: "slot-add", text: "+ escolher " + POS_ABBR[pos] })
        ]));
      }
    });
    screen.appendChild(grid);
    var filled = dreamFilled();
    var ready = filled === 11 && spent <= dream.budget;
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button(ready ? "⚔️ Iniciar Copa dos Sonhos" : (filled + "/11 escolhidos" + (spent > dream.budget ? " · acima do orçamento!" : "")), function () {
        if (!ready) { TM.ui.toast(filled < 11 ? "Escolha os 11 jogadores" : "Você estourou o orçamento"); return; }
        var players = orderByPos(keys.map(function (k) { return dream.squad[k]; }));
        var strongest = TM.data.world().clubs.map(function (c) { return c.id; }).sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); }).slice(0, 6);
        var oppIds = strongest.slice().reverse(); // do mais fraco (6º) ao mais forte (1º)
        var st = { title: "💎 Copa dos Sonhos", accent: "#39d98a", myName: "Time dos Sonhos", myPlayers: players, oppIds: oppIds, idx: 0, results: [], mode: "dream" };
        saveCh(st); TM.ui.go("build-hub");
      }, ready ? "btn primary big" : "btn big")
    ]));
  });

  TM.ui.register("dream-pick", function (screen, params) {
    if (!dream) { TM.ui.go("dream"); return; }
    var pos = params.pos, key = params.key;
    screen.appendChild(TM.ui.topbar("Escolher " + POS_ABBR[pos], function () { TM.ui.go("dream-build"); }));
    var rem = dream.budget - dreamSpent();
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "setting-hint", text: "Verba disponível: " + money(rem) + ". Busque por nome ou escolha da lista." }));
    var chosenIds = {}; dreamSlotKeys().forEach(function (k) { if (dream.squad[k]) chosenIds[dream.squad[k].id] = 1; });
    var pool = allLeaguePlayers().filter(function (p) { return p.pos === pos && !chosenIds[p.id]; }).sort(function (a, b) { return b.overall - a.overall; });
    var input = el("input", { class: "select", type: "text", placeholder: "🔎 buscar jogador…" });
    body.appendChild(input);
    var list = el("div", { class: "build-list" });
    body.appendChild(list);
    function render() {
      list.innerHTML = "";
      var q = (input.value || "").trim().toLowerCase();
      // sem busca: mostra só quem cabe no orçamento (evita lista cheia de inacessíveis).
      // com busca: mostra todos os que batem o nome (inacessíveis ficam desabilitados).
      var base = q ? pool.filter(function (p) { return p.name.toLowerCase().indexOf(q) >= 0; })
                   : pool.filter(function (p) { return cost(p) <= rem; });
      var view = base.slice(0, 40);
      view.forEach(function (p) {
        var affordable = cost(p) <= rem;
        var c = playerCard(p, money(cost(p)) + " · " + TM.data.club(p.clubId).name, "clickable" + (affordable ? "" : " disabled"));
        c.addEventListener("click", function () {
          if (cost(p) > rem) { TM.ui.toast("Sem verba para " + shortNm(p.name)); return; }
          dream.squad[key] = p; TM.ui.go("dream-build");
        });
        list.appendChild(c);
      });
      if (!view.length) list.appendChild(el("p", { class: "intro-text", text: q ? "Nenhum jogador encontrado." : "Sem verba para nenhum " + POS_ABBR[pos] + ". Remova um jogador caro do time." }));
    }
    input.addEventListener("input", render);
    render();
  });

  /* ============================================================
     🎲 DRAFT (escolhe liga, monta por sorteio 1-de-5, 6 jogos)
     ============================================================ */
  var draft = null; // { leagueId, pool, plan:[{pos, bench}], step, picks:[], options:[] }

  TM.ui.register("draft", function (screen) {
    screen.appendChild(TM.ui.topbar("🎲 Draft", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Escolha uma liga. O sorteio te dá 5 opções por posição — você escolhe 1. Depois monta 10 reservas do mesmo jeito e encara 6 times da liga, do menor até o campeão." }));
    body.appendChild(el("div", { class: "list-head", text: "Escolha a liga" }));
    var list = el("div", { class: "build-list" });
    TM.data.world().leagues.forEach(function (lg) {
      var comp = TM.data.competition("lg-" + lg.id);
      var row = el("button", { class: "comp-list-item", on: { click: function () { startDraft(lg.id); } } }, [
        el("div", { class: "cli-left" }, [
          comp ? TM.img.compImg(comp, "cli-logo") : el("span", {}),
          el("div", { class: "cli-text" }, [ el("div", { class: "cli-name", text: lg.name }), el("div", { class: "cli-sub", text: lg.clubIds.length + " clubes" }) ])
        ]),
        el("span", { class: "side-arrow", text: "→", style: "opacity:1" })
      ]);
      list.appendChild(row);
    });
    body.appendChild(list);
  });

  function startDraft(leagueId) {
    var plan = [];
    SLOTS.forEach(function (sl) { for (var i = 0; i < sl.n; i++) plan.push({ pos: sl.pos, bench: false }); });
    for (var b = 0; b < 10; b++) plan.push({ pos: null, bench: true }); // 10 reservas (qualquer posição)
    draft = { leagueId: leagueId, pool: leaguePlayers(leagueId), plan: plan, step: 0, picks: [], picked: {}, options: null };
    TM.ui.go("draft-pick");
  }

  function rollOptions() {
    var st = draft.plan[draft.step];
    var avail = draft.pool.filter(function (p) { return !draft.picked[p.id] && (st.bench || p.pos === st.pos); });
    draft.options = shuffle(avail).slice(0, 5);
  }

  TM.ui.register("draft-pick", function (screen) {
    if (!draft) { TM.ui.go("draft"); return; }
    var lgComp = "lg-" + draft.leagueId;
    TM.ui.applyCompTheme(screen, lgComp);
    var total = draft.plan.length;
    if (draft.step >= total) { finishDraft(); return; }
    var st = draft.plan[draft.step];
    if (!draft.options) rollOptions();

    screen.appendChild(TM.ui.topbar("🎲 Draft · " + (draft.step + 1) + "/" + total, function () {
      TM.ui.confirm("Sair do draft?", "As escolhas serão perdidas.", "Sair", function () { draft = null; TM.ui.go("draft"); }, true);
    }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var label = st.bench ? ("Reserva " + (draft.step - 10) + " de 10 — escolha 1 (qualquer posição)") : ("Titular · " + POS_ABBR[st.pos] + " — escolha 1 de 5");
    body.appendChild(el("div", { class: "draft-progress" }, [
      el("div", { class: "draft-step-label", text: label }),
      el("div", { class: "draft-dots" }, draft.plan.map(function (pl, i) { return el("span", { class: "ddot " + (i < draft.step ? "done" : i === draft.step ? "cur" : "") }); }))
    ]));
    var list = el("div", { class: "build-list draft-opts" });
    draft.options.forEach(function (p) {
      var c = playerCard(p, TM.data.club(p.clubId).name, "clickable draft-opt");
      c.addEventListener("click", function () {
        draft.picks.push(p); draft.picked[p.id] = 1; draft.step++; draft.options = null;
        TM.ui.go("draft-pick");
      });
      list.appendChild(c);
    });
    body.appendChild(list);
    body.appendChild(el("div", { class: "setting-hint", text: "Dica: às vezes um reserva vem melhor que um titular — faz parte da sorte do draft." }));
    // re-sortear (custa nada, mas só 1 vez por passo para dar tempero)
    if (!draft.rerolled) {
      body.appendChild(el("div", { class: "actions" }, [
        TM.ui.button("🎲 Sortear outras 5 opções", function () { draft.rerolled = true; rollOptions(); TM.ui.go("draft-pick"); }, "btn ghost")
      ]));
    }
  });

  function finishDraft() {
    var starters = orderByPos(draft.picks.slice(0, 11));
    var bench = draft.picks.slice(11);
    var players = starters.concat(bench);
    var lg = TM.data.league(draft.leagueId);
    var oppIds = ladderFromClubs(lg.clubIds, 6);
    var accent = TM.ui.compAccent("lg-" + draft.leagueId);
    var st = { title: "🎲 Draft · " + lg.name, accent: accent, myName: "Meu Draft", myPlayers: players, oppIds: oppIds, idx: 0, results: [], mode: "draft" };
    draft = null;
    saveCh(st); TM.ui.go("build-hub");
  }

})(window);
