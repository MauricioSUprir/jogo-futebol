/* ================= TOTAL ULTIMATE — ONLINE (protótipo) =================
   Publique seu elenco, enfrente os elencos de outros jogadores (mesmo
   quando ninguém está online) e dispute duelos ao vivo por código. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  function N() { return TM.net; }
  function U() { return TM.ut; }

  /* ---------- pacote do elenco ----------
     leva um retrato de cada jogador para funcionar entre edições diferentes
     (na edição pública os ids não existem na Season Update e vice-versa) */
  function buildPayload() {
    var s = U().state(); if (!s) return null;
    var ch = U().chemistry(s);
    var xi = [];
    ch.ds.forEach(function (d, i) {
      if (!d) return;
      var a = d.attrs || {};
      xi.push({
        p: d.p.id, n: d.name, o: U().effOv(d.ov, ch.per[i]),
        ps: d.pos, p2: d.pos2 || d.pos, v: d.ver, q: ch.per[i],
        a: [a.pac | 0, a.sho | 0, a.pas | 0, a.dri | 0, a.def | 0, a.phy | 0],
        cl: d.club ? d.club.id : null, na: d.nat || null
      });
    });
    if (xi.length < 11) return null;
    var r = U().squadRating(s);
    var ed = "publica"; try { ed = TM.storage.edition(); } catch (e) {}
    return { c: s.club || "Meu Ultimate", f: s.squad.f, ov: r.ov, chem: r.chem, div: s.riv.div, ed: ed, xi: xi };
  }

  // time jogável a partir do pacote: usa o jogador local quando existe (foto/escudo),
  // senão monta um equivalente com o retrato que veio junto
  function teamFromPayload(pl, idPrefix) {
    var players = (pl.xi || []).map(function (sp, i) {
      var base = null;
      try { base = TM.data.player(sp.p); } catch (e) {}
      if (base && base.name === sp.n) {
        var q = Object.assign({}, base);
        q.overall = sp.o;
        return q;
      }
      return {
        id: (idPrefix || "ut") + "_" + i, name: sp.n, clubId: sp.cl || null,
        pos: sp.ps, pos2: sp.p2, age: 26, overall: sp.o, potential: sp.o,
        attrs: { pac: sp.a[0], sho: sp.a[1], pas: sp.a[2], dri: sp.a[3], def: sp.a[4], phy: sp.a[5] },
        nationId: sp.na, nationName: "", form: 0, goals: 0
      };
    }).filter(Boolean);
    return { id: idPrefix || "ut", name: pl.c || "Ultimate", players: players, formation: pl.f || "4-3-3" };
  }

  /* ---------- hub online ---------- */
  TM.ui.register("ut-online", function (screen) {
    var s = U().state();
    if (!s) { TM.ui.go("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(TM.ui.topbar("Ultimate Online", function () { TM.ui.go("ut"); }));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);

    if (!N() || !N().available) {
      N() && N().init();
    }
    var r = U().squadRating(s);
    var full = s.squad.xi.filter(Boolean).length === 11;

    var card = el("div", { class: "ut-onl-card" }, [
      el("div", { class: "ut-onl-t", text: "SEU ELENCO" }),
      el("div", { class: "ut-onl-row" }, [
        el("div", {}, [
          el("div", { class: "ut-onl-club", text: s.club || "Meu Ultimate" }),
          el("div", { class: "ut-onl-sub", text: "Nota " + (r.ov || "—") + " · Química " + r.chem + " · Divisão " + s.riv.div })
        ]),
        el("div", { class: "ut-onl-badge", id: "utPubState", text: "…" })
      ])
    ]);
    body.appendChild(card);

    var pubBtn = TM.ui.button("Publicar elenco", function () { publish(); }, "btn primary wide");
    body.appendChild(pubBtn);
    if (!full) {
      body.appendChild(el("div", { class: "ut-warn", text: "Complete os 11 titulares antes de publicar." }));
      pubBtn.classList.add("off");
    }

    // estado da publicação
    var stateEl = card.querySelector("#utPubState");
    if (N() && N().available) {
      N().onReady(function () {
        N().utMine(function (v) {
          if (!stateEl.isConnected) return;
          if (v && v.xi) {
            stateEl.textContent = "PUBLICADO";
            stateEl.className = "ut-onl-badge on";
            pubBtn.textContent = "Atualizar elenco publicado";
          } else {
            stateEl.textContent = "NÃO PUBLICADO";
            stateEl.className = "ut-onl-badge off";
          }
        });
      });
    } else {
      stateEl.textContent = "OFFLINE";
      stateEl.className = "ut-onl-badge off";
    }

    body.appendChild(el("div", { class: "ut-sec-t", text: "Jogar" }));
    body.appendChild(el("div", { class: "ut-tiles" }, [
      tile("⚔️", "Elencos do mundo", "Enfrente times de outros jogadores", function () { TM.ui.go("ut-online-list"); }),
      tile("🎮", "Duelo por código", "1 contra 1 ao vivo com um amigo", function () { TM.ui.go("ut-duel"); }),
      tile("🏅", "Ranking Ultimate", "Quem mais vence no modo", function () { TM.ui.go("ut-online-rank"); })
    ]));

    body.appendChild(el("p", { class: "ut-tip", text: "Ao publicar, seu elenco fica disponível para os outros enfrentarem — e você enfrenta os deles a qualquer hora, mesmo com ninguém online. O duelo por código é ao vivo: os dois assistem à mesma partida." }));

    function tile(ic, nm, sub, fn) {
      return el("button", { class: "ut-tile", on: { click: fn } }, [
        el("span", { class: "ut-t-ic", text: ic }),
        el("span", { class: "ut-t-nm", text: nm }),
        el("span", { class: "ut-t-sub", text: sub })
      ]);
    }
    function publish() {
      if (!full) { TM.ui.toast("Complete os 11 titulares"); return; }
      if (!N() || !N().available) { TM.ui.toast("Sem conexão online"); return; }
      var pl = buildPayload();
      if (!pl) { TM.ui.toast("Não foi possível montar o elenco"); return; }
      pubBtn.textContent = "Publicando…";
      N().utPublish(pl, function (ok, err) {
        if (ok) { TM.ui.toast("Elenco publicado!"); TM.ui.go("ut-online"); }
        else { TM.ui.toast("Falhou: " + (err || "tente de novo")); pubBtn.textContent = "Publicar elenco"; }
      });
    }
  });

  /* ---------- lista de elencos publicados ---------- */
  TM.ui.register("ut-online-list", function (screen) {
    var s = U().state(); if (!s) { TM.ui.go("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(TM.ui.topbar("Elencos do mundo", function () { TM.ui.go("ut-online"); }));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "ut-empty-tx", text: "Carregando elencos…" }));

    if (!N() || !N().available) { N() && N().init(); }
    N().onReady(function (me) {
      N().utList(60, function (arr) {
        if (!body.isConnected) return;
        TM.ui.clear(body);
        var mine = me ? me.uid : null;
        var list = arr.filter(function (v) { return v.uid !== mine && (v.xi || []).length >= 11; });
        if (!list.length) {
          body.appendChild(el("div", { class: "ut-empty-tx", text: "Ninguém publicou um elenco ainda. Publique o seu e chame a galera — assim que alguém publicar, aparece aqui." }));
          return;
        }
        var ed = "publica"; try { ed = TM.storage.edition(); } catch (e) {}
        // mesma edição primeiro (os jogadores batem), depois os outros
        list.sort(function (a, b) { return (a.ed === ed ? 0 : 1) - (b.ed === ed ? 0 : 1) || (b.ov || 0) - (a.ov || 0); });
        body.appendChild(el("div", { class: "ut-count", text: list.length + " elencos disponíveis" }));
        list.forEach(function (v) {
          body.appendChild(el("div", { class: "ut-row" }, [
            el("div", { class: "ut-onl-ov" }, [el("b", { text: v.ov || "—" }), el("i", { text: "NOTA" })]),
            el("div", { class: "ut-row-i" }, [
              el("div", { class: "ut-row-n", text: v.c || "Ultimate" }),
              el("div", { class: "ut-row-s", text: (v.owner || "Jogador") + " · química " + (v.chem || 0) + " · div " + (v.div || 10) + (v.ed !== ed ? " · outra edição" : "") })
            ]),
            el("button", { class: "ut-buy", text: "Enfrentar", on: { click: function () { TM.ui.go("ut-online-play", { sq: v }); } } })
          ]));
        });
      });
    });
  });

  /* ---------- partida contra um elenco publicado ---------- */
  TM.ui.register("ut-online-play", function (screen, params) {
    var s = U().state(); if (!s) { TM.ui.go("ut"); return; }
    var sq = (params || {}).sq;
    if (!sq || !sq.xi) { TM.ui.go("ut-online-list"); return; }
    var mine = buildPayload();
    if (!mine) { TM.ui.toast("Complete os 11 titulares"); TM.ui.go("ut-squad"); return; }
    var teamA = teamFromPayload(mine, "me"), teamB = teamFromPayload(sq, "op");
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: true };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, settings: settings,
      title: "Ultimate Online · " + (sq.owner || "Jogador"),
      pauseSide: 0, simOpts: simOpts, formation: teamA.formation, formationB: teamB.formation,
      onBack: function () { TM.ui.go("ut-online-list"); },
      onDone: function () {
        var hs = result.score[0], as = result.score[1];
        var gain = hs > as ? 9000 : hs === as ? 3000 : 1200;
        U().earn(s, gain, "Ultimate Online");
        s.onl = s.onl || { w: 0, d: 0, l: 0 };
        if (hs > as) s.onl.w++; else if (hs === as) s.onl.d++; else s.onl.l++;
        U().save();
        try {
          var me = N() && N().currentOnline ? N().currentOnline() : null;
          if (me && sq.uid) {
            if (hs > as) N().utRecord(me.uid, me.name, sq.uid, sq.owner);
            else if (as > hs) N().utRecord(sq.uid, sq.owner, me.uid, me.name);
          }
        } catch (e) {}
        TM.ui.confirm(hs > as ? "🏆 Vitória!" : hs === as ? "Empate" : "Derrota",
          hs + " × " + as + " contra " + (sq.owner || "Jogador") + ". Você ganhou " + gain + " moedas.",
          "Continuar", function () { TM.ui.go("ut-online-list"); });
      }
    });
  });

  /* ---------- ranking do modo ---------- */
  TM.ui.register("ut-online-rank", function (screen) {
    screen.classList.add("ut-screen");
    screen.appendChild(TM.ui.topbar("Ranking Ultimate", function () { TM.ui.go("ut-online"); }));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "ut-empty-tx", text: "Carregando…" }));
    if (!N() || !N().available) { N() && N().init(); }
    N().onReady(function (me) {
      N().utRanking(function (arr) {
        if (!body.isConnected) return;
        TM.ui.clear(body);
        if (!arr.length) { body.appendChild(el("div", { class: "ut-empty-tx", text: "Ninguém pontuou ainda. Vença uma partida online para entrar." })); return; }
        arr.forEach(function (r, i) {
          body.appendChild(el("div", { class: "ut-row" + (me && r.uid === me.uid ? " me" : "") }, [
            el("div", { class: "ut-onl-ov" }, [el("b", { text: "#" + (i + 1) }), el("i", { text: "LUGAR" })]),
            el("div", { class: "ut-row-i" }, [
              el("div", { class: "ut-row-n", text: r.name }),
              el("div", { class: "ut-row-s", text: r.wins + " vitórias em " + r.played + " jogos" })
            ])
          ]));
        });
      });
    });
  });

  /* ---------- duelo ao vivo por código ---------- */
  TM.ui.register("ut-duel", function (screen) {
    var s = U().state(); if (!s) { TM.ui.go("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(TM.ui.topbar("Duelo por código", function () { TM.ui.go("ut-online"); }));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    if (s.squad.xi.filter(Boolean).length < 11) {
      body.appendChild(el("div", { class: "ut-warn", text: "Complete os 11 titulares antes de duelar." }));
      body.appendChild(TM.ui.button("Ir para a escalação", function () { TM.ui.go("ut-squad"); }, "btn primary wide"));
      return;
    }
    if (!N() || !N().available) { N() && N().init(); }
    body.appendChild(el("p", { class: "ut-tip", text: "Crie uma sala e passe o código para o seu amigo, ou entre no código dele. Os dois assistem à mesma partida, com os elencos de cada um." }));
    body.appendChild(TM.ui.button("Criar sala", function () {
      if (!N().available) { TM.ui.toast("Sem conexão online"); return; }
      N().onReady(function () {
        N().createMatch({ mode: "ut", source: "ut" }, function (code) {
          if (!code) { TM.ui.toast("Não foi possível criar a sala"); return; }
          TM.ui.go("ut-duel-room", { code: code, side: "host" });
        });
      });
    }, "btn primary wide"));
    var inp = el("input", { class: "ut-input", type: "text", maxlength: "8", placeholder: "Código da sala" });
    body.appendChild(el("div", { class: "ut-sec-t", text: "Entrar numa sala" }));
    body.appendChild(inp);
    body.appendChild(TM.ui.button("Entrar", function () {
      var code = (inp.value || "").trim().toUpperCase();
      if (!code) { TM.ui.toast("Digite o código"); return; }
      N().onReady(function () {
        N().joinMatch(code, function (ok, err) {
          if (!ok) { TM.ui.toast(err || "Código inválido"); return; }
          TM.ui.go("ut-duel-room", { code: code, side: "guest" });
        });
      });
    }, "btn wide"));
  });

  TM.ui.register("ut-duel-room", function (screen, params) {
    var s = U().state(); if (!s) { TM.ui.go("ut"); return; }
    var code = (params || {}).code, side = (params || {}).side;
    if (!code) { TM.ui.go("ut-duel"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(TM.ui.topbar("Sala " + code, function () { stopAll(); N().leaveMatch(code); TM.ui.go("ut-duel"); }));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);

    var stop = null, started = false;
    var mine = buildPayload();
    if (!mine) { TM.ui.toast("Complete os 11 titulares"); TM.ui.go("ut-squad"); return; }
    N().setMatchUt(code, side, mine);

    body.appendChild(el("div", { class: "ut-duel-code" }, [
      el("div", { class: "ut-duel-lbl", text: "CÓDIGO DA SALA" }),
      el("div", { class: "ut-duel-v", text: code }),
      TM.ui.button("Copiar código", function () {
        try { navigator.clipboard.writeText(code); TM.ui.toast("Código copiado!"); } catch (e) { TM.ui.toast(code); }
      }, "btn ghost small")
    ]));
    var status = el("div", { class: "ut-duel-status", text: "Esperando o adversário entrar…" });
    body.appendChild(status);
    var vs = el("div", { class: "ut-duel-vs" });
    body.appendChild(vs);

    stop = N().listenMatch(code, function (m) {
      if (!body.isConnected) { stopAll(); return; }
      if (!m) { TM.ui.toast("A sala foi encerrada"); TM.ui.go("ut-duel"); return; }
      render(m);
      // o anfitrião simula assim que os dois elencos estiverem na sala
      if (side === "host" && !started && m.hostUt && m.guestUt && !m.result) {
        started = true;
        var a = teamFromPayload(m.hostUt, "h"), b = teamFromPayload(m.guestUt, "g");
        var settings = TM.storage.settings();
        var res = TM.engine.simulate(a, b, { realism: settings.realism, neutral: true });
        N().setMatchResult(code, res);
      }
      if (m.result && m.hostUt && m.guestUt) { stopAll(); play(m); }
    });

    function render(m) {
      TM.ui.clear(vs);
      var h = m.hostUt, g = m.guestUt;
      status.textContent = !g ? "Esperando o adversário entrar…"
        : (!h || !g) ? "Esperando os dois elencos…" : "Tudo pronto — começando…";
      [[h, m.hostName || "Anfitrião"], [g, m.guestName || "Convidado"]].forEach(function (o, i) {
        var p = o[0];
        vs.appendChild(el("div", { class: "ut-duel-side" + (p ? " on" : "") }, [
          el("div", { class: "ut-duel-nm", text: o[1] }),
          el("div", { class: "ut-duel-sq", text: p ? (p.c + " · nota " + p.ov + " · química " + p.chem) : "aguardando…" })
        ]));
        if (i === 0) vs.appendChild(el("div", { class: "ut-duel-x", text: "×" }));
      });
    }
    function stopAll() { if (stop) { stop(); stop = null; } }
    function play(m) {
      var a = teamFromPayload(m.hostUt, "h"), b = teamFromPayload(m.guestUt, "g");
      var settings = TM.storage.settings();
      var result = m.result || {};
      result.events = result.events || []; result.score = result.score || [0, 0];
      result.stats = result.stats || { possession: [50, 50], shots: [0, 0], onTarget: [0, 0] };
      result.injuries = result.injuries || []; result.sentOff = result.sentOff || [];
      TM.ui.clear(screen);
      TM.matchview.play(screen, {
        teamA: a, teamB: b, result: result, settings: settings,
        title: (m.hostName || "Anfitrião") + " × " + (m.guestName || "Convidado"),
        pauseSide: null, simOpts: { realism: settings.realism, neutral: true },
        formation: a.formation, formationB: b.formation,
        onBack: function () { N().leaveMatch(code); TM.ui.go("ut-duel"); },
        onDone: function () {
          var hs = result.score[0], as = result.score[1];
          var meHost = side === "host";
          var my = meHost ? hs : as, their = meHost ? as : hs;
          var gain = my > their ? 12000 : my === their ? 4000 : 1500;
          U().earn(s, gain, "Duelo Ultimate");
          s.onl = s.onl || { w: 0, d: 0, l: 0 };
          if (my > their) s.onl.w++; else if (my === their) s.onl.d++; else s.onl.l++;
          U().save();
          if (meHost) {
            try {
              if (hs > as) N().utRecord(m.host, m.hostName, m.guest, m.guestName);
              else if (as > hs) N().utRecord(m.guest, m.guestName, m.host, m.hostName);
            } catch (e) {}
          }
          TM.ui.confirm(my > their ? "🏆 Vitória!" : my === their ? "Empate" : "Derrota",
            hs + " × " + as + ". Você ganhou " + gain + " moedas.", "Continuar",
            function () { N().leaveMatch(code); TM.ui.go("ut-duel"); });
        }
      });
    }
  });

  TM.utOnline = { payload: buildPayload, teamFromPayload: teamFromPayload };
})(window);
