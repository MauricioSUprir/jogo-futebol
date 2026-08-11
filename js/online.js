/* ================= TOTAL MATCH — Online (amigos, chat, partida) ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var N = function () { return TM.net; };

  function offlineCard(screen, msg) {
    screen.appendChild(el("div", { class: "next-match" }, [
      el("div", { class: "nm-label", text: "🚫 Online indisponível" }),
      el("p", { class: "intro-text", style: "text-align:center", text: msg || "Não foi possível conectar. Verifique sua internet e tente novamente." }),
      TM.ui.button("↻ Tentar de novo", function () { TM.ui.go("online"); }, "btn primary")
    ]));
  }
  function loadingCard(screen) {
    var c = el("div", { class: "next-match" }, [ el("div", { class: "nm-label", text: "⏳ Conectando…" }), el("p", { class: "intro-text", style: "text-align:center", text: "Entrando na sua conta online." }) ]);
    screen.appendChild(c);
    return c;
  }
  function onlineDot(on) { return el("span", { class: "online-dot" + (on ? " on" : "") }); }

  /* ---------- HUB ---------- */
  TM.ui.register("online", function (screen) {
    screen.appendChild(TM.ui.topbar("🌐 Online", function () { TM.ui.go("modes"); }));
    N().init();
    if (!N().available) { offlineCard(screen, N().error); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var load = loadingCard(body);
    var done = false;
    setTimeout(function () {
      if (done || !body.isConnected) return;
      TM.ui.clear(body);
      offlineCard(body, N().error || "Não foi possível conectar à conta online. No Firebase, confira se o Login Anônimo está ativado e se o Realtime Database foi criado.");
    }, 9000);
    N().onReady(function (me) {
      done = true;
      if (!body.isConnected) return;
      TM.ui.clear(body);
      // cartão de identidade
      var nameIn = el("input", { class: "select", type: "text", maxlength: "16", value: me.name });
      nameIn.addEventListener("change", function () { N().setName(nameIn.value); TM.ui.toast("Nome salvo"); });
      body.appendChild(el("div", { class: "id-card" }, [
        el("div", { class: "id-row" }, [ el("span", { class: "id-lbl", text: "Seu nome" }), nameIn ]),
        el("div", { class: "id-num-wrap" }, [
          el("div", { class: "id-num-lbl", text: "Seu número (compartilhe com amigos)" }),
          el("div", { class: "id-num", text: "#" + me.number }),
          TM.ui.button("📋 Copiar número", function () { copy(me.number); TM.ui.toast("Número copiado!"); }, "btn ghost small")
        ])
      ]));
      // convite pendente?
      renderInviteBanner(body);
      N().onInvite(function () { if (body.isConnected) { /* re-render banner */ var old = body.querySelector(".invite-banner"); if (old) old.remove(); renderInviteBanner(body); } });
      // ações
      body.appendChild(el("div", { class: "hub-actions" }, [
        el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-friends"); } } }, [ el("span", { class: "hub-ic", text: "👥" }), el("span", { text: "Central de amigos" }) ]),
        el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-play"); } } }, [ el("span", { class: "hub-ic", text: "⚔️" }), el("span", { text: "Partida online" }) ])
      ]));
    });
  });

  function renderInviteBanner(body) {
    var inv = N()._invite;
    if (!inv) return;
    var banner = el("div", { class: "invite-banner" }, [
      el("div", { class: "inv-txt", text: "⚔️ " + (inv.fromName || "Um amigo") + " te convidou para jogar!" }),
      el("div", { class: "inv-acts" }, [
        TM.ui.button("Entrar", function () { N().clearInvite(); N().joinMatch(inv.code, function (code, err) { if (code) { TM.ui.go("online-room", { code: code, side: "guest" }); } else TM.ui.toast(err || "Sala indisponível"); }); }, "btn primary small"),
        TM.ui.button("Ignorar", function () { N().clearInvite(); banner.remove(); }, "btn ghost small")
      ])
    ]);
    body.insertBefore(banner, body.firstChild.nextSibling);
  }

  function copy(t) { try { navigator.clipboard.writeText(t); } catch (e) {} }

  /* ---------- CENTRAL DE AMIGOS ---------- */
  var friendsStop = null;
  TM.ui.register("online-friends", function (screen) {
    screen.appendChild(TM.ui.topbar("👥 Amigos", function () { if (friendsStop) { friendsStop(); friendsStop = null; } TM.ui.go("online"); }));
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    // adicionar por número
    body.appendChild(el("div", { class: "list-head", text: "Adicionar amigo pelo número" }));
    var addIn = el("input", { class: "select", type: "text", placeholder: "ex.: 4827-1093" });
    var addRow = el("div", { class: "add-friend-row" }, [ addIn, TM.ui.button("🔎 Buscar", function () {
      var num = addIn.value.replace(/[^0-9-]/g, "");
      if (!num) { TM.ui.toast("Digite o número"); return; }
      N().findByNumber(num, function (p) {
        if (!p) { TM.ui.toast("Ninguém encontrado com #" + num); return; }
        TM.ui.confirm("Adicionar amigo", p.name + " (#" + p.number + ")", "Adicionar", function () {
          N().addFriend(p.uid, function () { TM.ui.toast(p.name + " adicionado!"); addIn.value = ""; });
        });
      });
    }, "btn primary small") ]);
    body.appendChild(addRow);
    // lista
    body.appendChild(el("div", { class: "list-head", text: "Meus amigos" }));
    var list = el("div", { class: "friend-list" });
    body.appendChild(list);
    if (friendsStop) { friendsStop(); }
    friendsStop = N().listenFriends(function (friends) {
      if (!list.isConnected) { if (friendsStop) { friendsStop(); friendsStop = null; } return; }
      list.innerHTML = "";
      if (!friends.length) { list.appendChild(el("p", { class: "intro-text", text: "Você ainda não tem amigos. Adicione pelo número acima!" })); return; }
      friends.sort(function (a, b) { return (b.online ? 1 : 0) - (a.online ? 1 : 0); });
      friends.forEach(function (f) {
        list.appendChild(el("div", { class: "friend-row" }, [
          onlineDot(f.online),
          el("div", { class: "friend-info" }, [ el("div", { class: "friend-name", text: f.name }), el("div", { class: "friend-sub", text: "#" + f.number + " · " + (f.online ? "online" : "offline") }) ]),
          TM.ui.button("💬", function () { if (friendsStop) { friendsStop(); friendsStop = null; } TM.ui.go("online-chat", { fuid: f.uid, name: f.name }); }, "btn ghost small"),
          TM.ui.button("⚔️", function () { inviteFriend(f); }, "btn primary small")
        ]));
      });
    });
  });

  function inviteFriend(f) {
    if (!f.online) { TM.ui.toast(f.name + " está offline"); return; }
    N().createMatch("club", function (code) {
      if (!code) { TM.ui.toast("Erro ao criar sala"); return; }
      N().sendInvite(f.uid, code);
      TM.ui.toast("Convite enviado a " + f.name);
      if (friendsStop) { friendsStop(); friendsStop = null; }
      TM.ui.go("online-room", { code: code, side: "host" });
    });
  }

  /* ---------- CHAT ---------- */
  var chatStop = null;
  var EMOJIS = "😀 😁 😂 🤣 😅 😊 😍 😎 😉 😜 🤔 😏 😐 😴 😢 😭 😡 🤬 😱 🥳 🤯 🥶 🤩 😇 🙃 😬 🤗 🙏 👍 👎 👏 🙌 💪 🤝 👊 ✌️ 🤞 🔥 💥 ⭐ ✨ 💯 ⚽ 🏆 🥇 🎯 🧤 🥅 🚀 ❤️ 💔 😤 🤦 🤷 😅 🐐 🤡 👀 🎉".split(" ");
  var STICKERS = ["⚽🔥", "🏆🎉", "🐐", "😂😂😂", "👏👏", "😱", "💪😎", "😭😭", "🥳🎊", "⚽🥅 GOOOL!", "🤡", "💯🔥", "😤⚽", "🙏", "🚀", "👑"];
  TM.ui.register("online-chat", function (screen, params) {
    if (!params || !params.fuid) { TM.ui.go("online-friends"); return; }
    screen.appendChild(TM.ui.topbar("💬 " + params.name, function () { if (chatStop) { chatStop(); chatStop = null; } TM.ui.go("online-friends"); }));
    var thread = el("div", { class: "chat-thread big" });
    screen.appendChild(thread);

    // painéis de emoji / figurinhas (escondidos até tocar)
    var emojiPanel = el("div", { class: "emoji-panel hidden" });
    EMOJIS.forEach(function (e) { emojiPanel.appendChild(el("button", { class: "emoji-btn", text: e, on: { click: function () { barIn.value += e; barIn.focus(); } } })); });
    var stickerPanel = el("div", { class: "sticker-panel hidden" });
    STICKERS.forEach(function (s) { stickerPanel.appendChild(el("button", { class: "sticker-btn", text: s, on: { click: function () { N().sendMessage(params.fuid, s, "sticker"); hidePanels(); } } })); });

    var barIn = el("input", { class: "select chat-in", type: "text", maxlength: "300", placeholder: "Mensagem…" });
    function send() { var t = barIn.value.trim(); if (!t) return; N().sendMessage(params.fuid, t, "text"); barIn.value = ""; hidePanels(); }
    barIn.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
    function hidePanels() { emojiPanel.classList.add("hidden"); stickerPanel.classList.add("hidden"); }
    function toggle(panel) { var wasHidden = panel.classList.contains("hidden"); hidePanels(); if (wasHidden) panel.classList.remove("hidden"); }

    screen.appendChild(emojiPanel);
    screen.appendChild(stickerPanel);
    screen.appendChild(el("div", { class: "chat-bar" }, [
      el("button", { class: "chat-ic-btn", text: "😀", on: { click: function () { toggle(emojiPanel); } } }),
      el("button", { class: "chat-ic-btn", text: "🎉", on: { click: function () { toggle(stickerPanel); } } }),
      barIn,
      TM.ui.button("➤", send, "btn primary small")
    ]));

    if (chatStop) { chatStop(); }
    chatStop = N().listenChat(params.fuid, function (m) {
      if (!thread.isConnected) { if (chatStop) { chatStop(); chatStop = null; } return; }
      var isSticker = m.kind === "sticker";
      thread.appendChild(el("div", { class: "chat-bubble " + (m.mine ? "me" : "coach") + (isSticker ? " sticker-msg" : "") }, [ el("div", { class: isSticker ? "chat-sticker" : "chat-text", text: m.text }) ]));
      thread.scrollTop = thread.scrollHeight;
    });
  });

  /* ---------- PARTIDA ONLINE: criar/entrar ---------- */
  TM.ui.register("online-play", function (screen) {
    screen.appendChild(TM.ui.topbar("⚔️ Partida online", function () { TM.ui.go("online"); }));
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Crie uma sala e mostre o QR code (ou o código) para o amigo entrar, ou entre numa sala com o código." }));
    var seg = el("div", { class: "preset-msgs" });
    seg.appendChild(el("button", { class: "preset-msg", on: { click: function () { pickSourceThenCreate(); } } }, [ el("span", { class: "preset-ic", text: "➕" }), el("span", { class: "preset-tx", text: "Criar sala (você convida)" }), el("span", { class: "preset-mood", text: "→" }) ]));
    seg.appendChild(el("button", { class: "preset-msg", on: { click: function () { TM.ui.go("online-join", {}); } } }, [ el("span", { class: "preset-ic", text: "🔑" }), el("span", { class: "preset-tx", text: "Entrar com código" }), el("span", { class: "preset-mood", text: "→" }) ]));
    body.appendChild(seg);
  });

  function pickSourceThenCreate() {
    TM.ui.optionsMenu("Tipo de time", [
      { label: "⚽ Clubes", fn: function () { doCreate("club"); } },
      { label: "🌍 Seleções", fn: function () { doCreate("nation"); } }
    ]);
  }
  function doCreate(source) {
    N().createMatch(source, function (code) {
      if (!code) { TM.ui.toast("Erro ao criar sala"); return; }
      TM.ui.go("online-room", { code: code, side: "host" });
    });
  }

  TM.ui.register("online-join", function (screen, params) {
    screen.appendChild(TM.ui.topbar("🔑 Entrar na sala", function () { TM.ui.go("online-play"); }));
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var codeIn = el("input", { class: "select big-code", type: "text", maxlength: "5", placeholder: "CÓDIGO", value: (params && params.code) || "" });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Código da sala" }), codeIn ]));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Entrar", function () {
        var code = codeIn.value.trim().toUpperCase();
        if (code.length < 4) { TM.ui.toast("Digite o código"); return; }
        N().joinMatch(code, function (c, err) { if (c) TM.ui.go("online-room", { code: c, side: "guest" }); else TM.ui.toast(err || "Sala não encontrada"); });
      }, "btn primary big")
    ]));
    if (params && params.code && params.auto) {
      N().joinMatch(params.code, function (c, err) { if (c) TM.ui.go("online-room", { code: c, side: "guest" }); else TM.ui.toast(err || "Sala não encontrada"); });
    }
  });

  /* ---------- SALA DA PARTIDA ---------- */
  var roomStop = null, roomComputed = false;
  function teamObj(source, id) { return source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id); }
  function teamOptions(source, leagueId) {
    if (source === "nation") return TM.data.world().nations.map(function (n) { return { id: n.id, name: n.name }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    return TM.data.league(leagueId).clubIds.map(function (id) { return { id: id, name: TM.data.club(id).name }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  var roomLeague = "br";

  TM.ui.register("online-room", function (screen, params) {
    if (!params || !params.code) { TM.ui.go("online-play"); return; }
    var code = params.code, side = params.side;
    roomComputed = false;
    screen.appendChild(TM.ui.topbar("Sala " + code, function () { leaveRoom(code, side); TM.ui.go("online"); }));
    var wrap = el("div", { class: "panel-narrow" });
    screen.appendChild(wrap);
    if (roomStop) { roomStop(); roomStop = null; }

    roomStop = N().listenMatch(code, function (m) {
      if (!wrap.isConnected) { if (roomStop) { roomStop(); roomStop = null; } return; }
      if (!m) { TM.ui.clear(wrap); wrap.appendChild(el("p", { class: "intro-text", text: "A sala foi encerrada." })); return; }
      // resultado pronto → todos vão para a partida
      if (m.result) { if (roomStop) { roomStop(); roomStop = null; } TM.ui.go("online-match", { code: code, side: side, match: m }); return; }
      renderRoom(wrap, code, side, m);
      // host calcula o resultado quando os dois times estão definidos
      if (side === "host" && m.hostTeam && m.guestTeam && !m.result && !roomComputed) {
        roomComputed = true;
        var a = teamObj(m.source, m.hostTeam), b = teamObj(m.source, m.guestTeam);
        var settings = TM.storage.settings();
        var result = TM.engine.simulate(a, b, { realism: settings.realism, neutral: true });
        // empate → pênaltis direto (host calcula e compartilha para os dois verem igual)
        if (result.score[0] === result.score[1]) { result.shootout = TM.engine.shootout(a, b); }
        N().setMatchResult(code, result);
      }
    });
  });

  function renderRoom(wrap, code, side, m) {
    TM.ui.clear(wrap);
    var mySide = side, oppSide = side === "host" ? "guest" : "host";
    var myTeam = side === "host" ? m.hostTeam : m.guestTeam;
    var oppTeam = side === "host" ? m.guestTeam : m.hostTeam;
    var oppName = side === "host" ? (m.guestName || null) : (m.hostName || null);

    // QR + código (só o host precisa divulgar)
    if (side === "host" && !m.guest) {
      var url = joinUrl(code);
      var qrBox = el("div", { class: "qr-box" });
      try { qrBox.innerHTML = qrSvg(url); } catch (e) { qrBox.textContent = code; }
      wrap.appendChild(el("div", { class: "room-share" }, [
        el("div", { class: "share-lbl", text: "Peça para o amigo escanear o QR com a câmera, ou digitar o código:" }),
        qrBox,
        el("div", { class: "share-code", text: code }),
        TM.ui.button("📋 Copiar código", function () { copy(code); TM.ui.toast("Código copiado!"); }, "btn ghost small"),
        el("div", { class: "waiting-line", text: "⏳ Aguardando o adversário entrar…" })
      ]));
      return;
    }

    // status dos dois jogadores
    wrap.appendChild(el("div", { class: "room-status" }, [
      seatChip("🔵", m.hostName || "Anfitrião", !!m.hostTeam),
      el("span", { class: "vs-mini", text: "×" }),
      seatChip("🔴", m.guestName || "Convidado…", !!m.guestTeam)
    ]));

    if (!m.guest) { wrap.appendChild(el("div", { class: "waiting-line", text: "⏳ Aguardando o adversário…" })); }

    // meu seletor de time (visual, com escudos e overall)
    wrap.appendChild(el("div", { class: "list-head", text: "Escolha seu time (" + (m.source === "nation" ? "seleção" : "clube") + ")" }));
    var openPicker = function () {
      TM.ui.pickTeam({ source: m.source, title: "Escolha seu time", current: myTeam, back: function () { TM.ui.go("online-room", { code: code, side: side }); },
        onPick: function (pid) { N().setMatchTeam(code, mySide, pid); TM.ui.go("online-room", { code: code, side: side }); } });
    };
    if (myTeam) {
      var mc = teamPreview(m.source, myTeam, "Você (toque p/ trocar)"); mc.classList.add("clickable"); mc.addEventListener("click", openPicker);
      wrap.appendChild(mc);
    } else {
      wrap.appendChild(el("button", { class: "chosen-team empty", on: { click: openPicker } }, [ el("span", { text: "➕ Escolher meu time" }) ]));
    }
    if (oppTeam) wrap.appendChild(teamPreview(m.source, oppTeam, oppName || "Adversário"));
    else if (m.guest) wrap.appendChild(el("div", { class: "waiting-line", text: "⏳ Adversário escolhendo o time…" }));

    if (myTeam && oppTeam) wrap.appendChild(el("div", { class: "waiting-line", text: "✅ Tudo pronto! Iniciando a partida…" }));
  }

  function seatChip(emoji, name, ready) {
    return el("div", { class: "seat-chip" + (ready ? " ready" : "") }, [ el("span", { text: emoji }), el("span", { class: "seat-chip-nm", text: name }), el("span", { class: "seat-chip-st", text: ready ? "✔" : "…" }) ]);
  }
  function teamPreview(source, id, owner) {
    var t = teamObj(source, id);
    var rating = Math.round(t.players.slice(0, 11).reduce(function (s, p) { return s + p.overall; }, 0) / 11);
    var crest = source === "nation" ? TM.img.nationImg(TM.data.nation(id), "prev-crest-sm") : TM.img.clubImg(TM.data.club(id), "prev-crest-sm");
    return el("div", { class: "team-preview-row" }, [ crest, el("div", {}, [ el("div", { class: "tp-owner", text: owner }), el("div", { class: "tp-name", text: t.name }) ]), TM.ui.ovBadge(rating) ]);
  }

  function joinUrl(code) { return location.origin + location.pathname + "?join=" + code; }
  function qrSvg(text) { var qr = global.qrcode(0, "M"); qr.addData(text); qr.make(); return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  function leaveRoom(code, side) { if (roomStop) { roomStop(); roomStop = null; } if (side === "host") N().leaveMatch(code); }

  /* ---------- PARTIDA ONLINE (replay do resultado compartilhado) ---------- */
  TM.ui.register("online-match", function (screen, params) {
    if (!params || !params.match || !params.match.result) { TM.ui.go("online"); return; }
    var m = params.match, side = params.side;
    var a = teamObj(m.source, m.hostTeam), b = teamObj(m.source, m.guestTeam);
    var result = sanitize(m.result);
    var settings = TM.storage.settings();
    function toResult(penWinnerSide) {
      TM.ui.go("online-result", { a: a, b: b, result: result, hostName: m.hostName, guestName: m.guestName, penWinnerSide: penWinnerSide });
    }
    TM.matchview.play(screen, {
      teamA: a, teamB: b, result: result, settings: settings,
      title: (m.hostName || "Anfitrião") + " × " + (m.guestName || "Convidado"),
      pauseSide: null, simOpts: { realism: settings.realism, neutral: true },
      onBack: function () { TM.ui.go("online"); },
      onDone: function () {
        // empate → cai direto na disputa de pênaltis (mesmo resultado nos dois celulares)
        if (result.shootout) {
          TM.ui.go("pen-shootout", { teamA: a, teamB: b, shoot: result.shootout, title: "Pênaltis · Online",
            onDone: function () { toResult(result.shootout.winner); } });
        } else { toResult(null); }
      }
    });
  });
  function sanitize(r) {
    r = r || {};
    r.events = r.events || [];
    r.injuries = r.injuries || []; r.sentOff = r.sentOff || [];
    r.stats = r.stats || { possession: [50, 50], shots: [0, 0], onTarget: [0, 0] };
    r.score = r.score || [0, 0];
    return r;
  }

  TM.ui.register("online-result", function (screen, params) {
    var r = params.result, a = params.a, b = params.b, hs = r.score[0], as = r.score[1];
    var pen = params.penWinnerSide != null;
    var winner = pen ? (params.penWinnerSide === 0 ? (params.hostName || a.name) : (params.guestName || b.name))
                     : hs > as ? (params.hostName || a.name) : as > hs ? (params.guestName || b.name) : null;
    screen.appendChild(TM.ui.topbar("Resultado", function () { TM.ui.go("online"); }));
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [ el("span", { class: "rs-team", text: a.name }), el("span", { class: "rs-num", text: hs + " × " + as }), el("span", { class: "rs-team", text: b.name }) ]),
      el("div", { class: "result-tag", text: winner ? (pen ? "🎯 " + winner + " venceu nos pênaltis!" : "🏆 " + winner + " venceu!") : "🤝 Empate!" })
    ]));
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Voltar ao online", function () { TM.ui.go("online"); }, "btn primary"),
      TM.ui.button("Central de amigos", function () { TM.ui.go("online-friends"); }, "btn ghost")
    ]));
  });

})(window);
