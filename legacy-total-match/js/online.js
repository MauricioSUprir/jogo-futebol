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
      // cartão de identidade (com foto do perfil + editar)
      body.appendChild(el("div", { class: "id-card" }, [
        el("div", { class: "id-me clickable", on: { click: function () { TM.ui.go("online-profile", { uid: me.uid, name: me.name, back: "online" }); } } }, [
          el("div", { class: "friend-ava-wrap" }, [ avatarOf(me.name, "profile-ava-sm", me.photo) ]),
          el("div", { class: "id-me-info" }, [
            el("div", { class: "id-me-name", text: me.name }),
            el("div", { class: "id-me-num", text: "#" + me.number }),
            me.favClub && TM.data.club(me.favClub) ? el("div", { class: "id-me-fav", text: "❤ " + TM.data.club(me.favClub).name }) : el("div", { class: "id-me-fav dim", text: "Toque para ver seu perfil" })
          ]),
          el("span", { class: "row-chev", text: "›" })
        ]),
        el("div", { class: "id-me-acts" }, [
          TM.ui.button("✏️ Editar perfil", function () { TM.ui.go("online-profile-edit", { back: "online" }); }, "btn small"),
          TM.ui.button("📋 Copiar número", function () { copy(me.number); TM.ui.toast("Número copiado!"); }, "btn ghost small")
        ])
      ]));
      // reputação de fair play (abandonos)
      if (TM.fairplay) body.appendChild(TM.fairplay.repCard());
      // convite pendente?
      renderInviteBanner(body);
      N().onInvite(function () { if (body.isConnected) { /* re-render banner */ var old = body.querySelector(".invite-banner"); if (old) old.remove(); renderInviteBanner(body); } });
      // ações
      var reqBadge = el("span", { class: "hub-badge", hidden: true });
      body.appendChild(el("div", { class: "hub-actions" }, [
        el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-friends"); } } }, [ el("span", { class: "hub-ic", text: "👥" }), el("span", { text: "Central de amigos" }), reqBadge ]),
        el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-play"); } } }, [ el("span", { class: "hub-ic", text: "⚔️" }), el("span", { text: "Partida online" }) ]),
        el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-ranking"); } } }, [ el("span", { class: "hub-ic", text: "🏅" }), el("span", { text: "Ranking global" }) ])
      ]));
      // badge de solicitações pendentes (atualiza ao vivo enquanto o hub estiver aberto)
      var hubReqStop = N().listenRequests(function (reqs) {
        if (!reqBadge.isConnected) { if (hubReqStop) hubReqStop(); return; }
        reqBadge.hidden = !reqs.length; reqBadge.textContent = reqs.length > 9 ? "9+" : reqs.length;
      });
    });
  });

  function renderInviteBanner(body) {
    var inv = N()._invite;
    if (!inv) return;
    var banner = el("div", { class: "invite-banner" }, [
      el("div", { class: "inv-txt", text: (inv.rematch ? "🔁 " + (inv.fromName || "Um amigo") + " quer a REVANCHE!" : "⚔️ " + (inv.fromName || "Um amigo") + " te convidou para jogar!") }),
      el("div", { class: "inv-acts" }, [
        TM.ui.button("Entrar", function () { N().clearInvite(); N().joinMatch(inv.code, function (code, err) { if (code) { TM.ui.go("online-room", { code: code, side: "guest" }); } else TM.ui.toast(err || "Sala indisponível"); }); }, "btn primary small"),
        TM.ui.button("Ignorar", function () { N().clearInvite(); banner.remove(); }, "btn ghost small")
      ])
    ]);
    body.insertBefore(banner, body.firstChild.nextSibling);
  }

  function copy(t) { try { navigator.clipboard.writeText(t); } catch (e) {} }

  /* ---------- CENTRAL DE AMIGOS ---------- */
  var friendsStop = null, reqStop = null;
  function stopFriendListeners() { if (friendsStop) { friendsStop(); friendsStop = null; } if (reqStop) { reqStop(); reqStop = null; } }
  // avatar: foto personalizada se houver, senão inicial/cor (determinístico pelo nome)
  function avatarOf(name, cls, photo) {
    if (photo) return el("img", { class: cls || "friend-ava", src: photo });
    name = name || "?";
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(' + h + ',58%,48%)"/><stop offset="1" stop-color="hsl(' + ((h + 34) % 360) + ',52%,32%)"/></linearGradient></defs>' +
      '<rect width="48" height="48" rx="24" fill="url(#g)"/><text x="24" y="32" font-family="Arial" font-size="22" font-weight="800" fill="#fff" text-anchor="middle">' +
      name.replace(/[^A-Za-zÀ-ÿ]/g, "").slice(0, 1).toUpperCase() + '</text></svg>';
    return el("img", { class: cls || "friend-ava", src: "data:image/svg+xml;utf8," + encodeURIComponent(svg) });
  }
  function openProfile(uid, name, back) { stopFriendListeners(); TM.ui.go("online-profile", { uid: uid, name: name, back: back || "online-friends" }); }
  // mini-perfil em modal (sem sair da tela atual — ideal para a sala de partida)
  function openProfileSheet(uid, name) {
    if (!uid || (N().me && uid === N().me.uid)) return;
    var overlay = el("div", { class: "modal-overlay", on: { click: function (e) { if (e.target === overlay) overlay.remove(); } } });
    var box = el("div", { class: "cmodal profile-sheet" });
    box.appendChild(el("div", { class: "cmodal-head" }, [ el("span", { text: "Perfil" }), el("button", { class: "cmodal-x", text: "✕", on: { click: function () { overlay.remove(); } } }) ]));
    var content = el("div", { class: "ps-body" }, [ el("p", { class: "intro-text", text: "Carregando…" }) ]);
    box.appendChild(content);
    overlay.appendChild(box); document.body.appendChild(overlay);
    N().getProfile(uid, function (p) {
      if (!content.isConnected) return;
      TM.ui.clear(content);
      var winPct = p.played ? Math.round((p.wins / p.played) * 100) : 0;
      var favClub = p.favClub ? TM.data.club(p.favClub) : null;
      content.appendChild(el("div", { class: "profile-head" }, [
        el("div", { class: "profile-ava-wrap" }, [ avatarOf(p.name, "profile-ava", p.photo), onlineDot(p.online) ]),
        el("div", { class: "profile-id" }, [ el("div", { class: "profile-name", text: p.name }), el("div", { class: "profile-num", text: "#" + (p.number || "----") }), el("div", { class: "profile-status " + (p.online ? "on" : "off"), text: p.online ? "🟢 Online" : ("⚪ " + lastSeenTxt(p.lastSeen)) }) ])
      ]));
      if (favClub) content.appendChild(el("div", { class: "profile-fav" }, [ TM.img.clubImg(favClub, "pf-crest"), el("div", {}, [ el("div", { class: "pf-lbl", text: "Clube do coração" }), el("div", { class: "pf-name", text: favClub.name }) ]) ]));
      if (p.bio) content.appendChild(el("div", { class: "profile-bio", text: "“" + p.bio + "”" }));
      content.appendChild(el("div", { class: "profile-stats" }, [ statTile("Vitórias", p.wins), statTile("Jogos", p.played), statTile("Aproveit.", winPct + "%") ]));
      if (!p.isFriend) {
        var addBtn = TM.ui.button("➕ Enviar solicitação de amizade", function () {
          N().sendFriendRequest(uid, function (ok, msg) {
            if (ok) { TM.ui.toast("Solicitação enviada a " + p.name + "!"); addBtn.textContent = "✅ Enviada"; addBtn.disabled = true; }
            else TM.ui.toast(msg === "já é seu amigo" ? "Vocês já são amigos" : "Não foi possível enviar");
          });
        }, "btn primary");
        content.appendChild(addBtn);
      } else {
        content.appendChild(el("div", { class: "profile-bio", style: "text-align:center", text: "✔ Já é seu amigo" }));
      }
      content.appendChild(TM.ui.button("Abrir perfil completo →", function () { overlay.remove(); openProfile(uid, p.name, "online"); }, "btn ghost small"));
    });
  }
  TM.online = TM.online || {}; TM.online.openProfileSheet = openProfileSheet;

  TM.ui.register("online-friends", function (screen) {
    screen.appendChild(TM.ui.topbar("👥 Amigos", function () { stopFriendListeners(); TM.ui.go("online"); }));
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    // adicionar por número → abre o PERFIL (onde você envia a solicitação)
    body.appendChild(el("div", { class: "list-head", text: "Adicionar amigo pelo número" }));
    var addIn = el("input", { class: "select", type: "text", placeholder: "ex.: 4827-1093" });
    var addRow = el("div", { class: "add-friend-row" }, [ addIn, TM.ui.button("🔎 Buscar", function () {
      var num = addIn.value.replace(/[^0-9-]/g, "");
      if (!num) { TM.ui.toast("Digite o número"); return; }
      N().findByNumber(num, function (p) {
        if (!p) { TM.ui.toast("Ninguém encontrado com #" + num); return; }
        addIn.value = ""; openProfile(p.uid, p.name);
      });
    }, "btn primary small") ]);
    body.appendChild(addRow);

    // --- solicitações recebidas ---
    var reqHead = el("div", { class: "list-head", hidden: true }, [ el("span", { text: "📨 Solicitações de amizade" }) ]);
    var reqList = el("div", { class: "friend-list" });
    body.appendChild(reqHead); body.appendChild(reqList);
    reqStop = N().listenRequests(function (reqs) {
      if (!reqList.isConnected) { if (reqStop) { reqStop(); reqStop = null; } return; }
      reqList.innerHTML = "";
      reqHead.hidden = !reqs.length;
      reqs.forEach(function (r) {
        reqList.appendChild(el("div", { class: "friend-row req-row" }, [
          avatarOf(r.name),
          el("div", { class: "friend-info clickable", on: { click: function () { openProfile(r.uid, r.name); } } }, [ el("div", { class: "friend-name", text: r.name }), el("div", { class: "friend-sub", text: "#" + (r.number || "----") + " · quer ser seu amigo" }) ]),
          TM.ui.button("✓ Aceitar", function () { N().acceptRequest(r.uid, function () { TM.ui.toast(r.name + " agora é seu amigo!"); }); }, "btn primary small"),
          TM.ui.button("✕", function () { N().declineRequest(r.uid, function () { TM.ui.toast("Solicitação recusada"); }); }, "btn ghost small")
        ]));
      });
    });

    // --- lista de amigos ---
    body.appendChild(el("div", { class: "list-head", text: "Meus amigos" }));
    var list = el("div", { class: "friend-list" });
    body.appendChild(list);
    friendsStop = N().listenFriends(function (friends) {
      if (!list.isConnected) { if (friendsStop) { friendsStop(); friendsStop = null; } return; }
      list.innerHTML = "";
      if (!friends.length) { list.appendChild(el("p", { class: "intro-text", text: "Você ainda não tem amigos. Adicione pelo número acima!" })); return; }
      friends.sort(function (a, b) { return (b.online ? 1 : 0) - (a.online ? 1 : 0); });
      friends.forEach(function (f) {
        list.appendChild(el("div", { class: "friend-row" }, [
          el("div", { class: "friend-ava-wrap clickable", on: { click: function () { openProfile(f.uid, f.name); } } }, [ avatarOf(f.name, null, f.photo), onlineDot(f.online) ]),
          el("div", { class: "friend-info clickable", on: { click: function () { openProfile(f.uid, f.name); } } }, [ el("div", { class: "friend-name", text: f.name }), el("div", { class: "friend-sub", text: "#" + f.number + " · " + (f.online ? "online" : "offline") }) ]),
          TM.ui.button("💬", function () { stopFriendListeners(); TM.ui.go("online-chat", { fuid: f.uid, name: f.name }); }, "btn ghost small"),
          TM.ui.button("⚔️", function () { inviteFriend(f); }, "btn primary small")
        ]));
      });
    });
  });

  /* ---------- PERFIL DO JOGADOR ---------- */
  TM.ui.register("online-profile", function (screen, params) {
    if (!params || !params.uid) { TM.ui.go("online-friends"); return; }
    var backTo = params.back || "online-friends";
    screen.appendChild(TM.ui.topbar("Perfil", function () { TM.ui.go(backTo); }));
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var loading = el("p", { class: "intro-text", text: "Carregando perfil…" });
    body.appendChild(loading);
    var meUid = N().me ? N().me.uid : null;
    var isMe = params.uid === meUid;
    N().getProfile(params.uid, function (p) {
      if (!body.isConnected) return;
      TM.ui.clear(body);
      var winPct = p.played ? Math.round((p.wins / p.played) * 100) : 0;
      var favClub = p.favClub ? TM.data.club(p.favClub) : null;
      // cabeçalho
      body.appendChild(el("div", { class: "profile-head" }, [
        el("div", { class: "profile-ava-wrap" }, [ avatarOf(p.name, "profile-ava", p.photo), onlineDot(p.online) ]),
        el("div", { class: "profile-id" }, [
          el("div", { class: "profile-name", text: p.name }),
          el("div", { class: "profile-num", text: "#" + (p.number || "----") }),
          el("div", { class: "profile-status " + (p.online ? "on" : "off"), text: p.online ? "🟢 Online agora" : ("⚪ " + lastSeenTxt(p.lastSeen)) })
        ])
      ]));
      // clube favorito
      if (favClub) {
        body.appendChild(el("div", { class: "profile-fav" }, [
          TM.img.clubImg(favClub, "pf-crest"),
          el("div", {}, [ el("div", { class: "pf-lbl", text: "Clube do coração" }), el("div", { class: "pf-name", text: favClub.name }) ])
        ]));
      }
      // bio
      if (p.bio) body.appendChild(el("div", { class: "profile-bio", text: "“" + p.bio + "”" }));
      // estatísticas online
      body.appendChild(el("div", { class: "profile-stats" }, [
        statTile("Vitórias", p.wins), statTile("Jogos", p.played), statTile("Aproveit.", winPct + "%")
      ]));
      // botão copiar número
      body.appendChild(TM.ui.button("📋 Copiar número", function () { copy(p.number || ""); TM.ui.toast("Número copiado!"); }, "btn ghost small"));

      if (isMe) {
        body.appendChild(TM.ui.button("✏️ Editar meu perfil", function () { TM.ui.go("online-profile-edit", { back: backTo }); }, "btn primary"));
        body.appendChild(el("p", { class: "intro-text", text: "Compartilhe seu número (#" + (p.number || "----") + ") para receber solicitações de amizade." }));
        return;
      }

      // retrospecto entre vocês (se já jogaram)
      var h2h = el("div", { class: "h2h-bar", text: "Retrospecto: carregando…" });
      body.appendChild(h2h);
      N().getH2H(params.uid, function (r) { if (h2h.isConnected) h2h.textContent = "🏆 Você " + r.me + " · " + r.draws + " empate(s) · " + r.them + " " + p.name; });

      // ações conforme o status de amizade
      var acts = el("div", { class: "profile-acts" });
      body.appendChild(acts);
      if (p.isFriend) {
        acts.appendChild(TM.ui.button("💬 Conversar", function () { TM.ui.go("online-chat", { fuid: params.uid, name: p.name }); }, "btn primary"));
        acts.appendChild(TM.ui.button("⚔️ Desafiar", function () { inviteFriend({ uid: params.uid, name: p.name, online: p.online }); }, "btn"));
        acts.appendChild(TM.ui.button("🗑️ Remover amigo", function () {
          TM.ui.confirm("Remover " + p.name + "?", "Vocês deixarão de ser amigos.", "Remover", function () { N().removeFriend(params.uid, function () { TM.ui.toast("Amigo removido"); TM.ui.go("online-friends"); }); }, true);
        }, "btn ghost small"));
      } else {
        var addBtn = TM.ui.button("➕ Enviar solicitação de amizade", function () {
          N().sendFriendRequest(params.uid, function (ok, msg) {
            if (ok) { TM.ui.toast("Solicitação enviada a " + p.name + "!"); addBtn.textContent = "✅ Solicitação enviada"; addBtn.disabled = true; addBtn.classList.add("sent"); }
            else { TM.ui.toast(msg === "já é seu amigo" ? "Vocês já são amigos" : "Não foi possível enviar"); }
          });
        }, "btn primary");
        acts.appendChild(addBtn);
      }
    });
  });
  function statTile(lbl, val) { return el("div", { class: "profile-stat" }, [ el("div", { class: "ps-val", text: val }), el("div", { class: "ps-lbl", text: lbl }) ]); }
  function lastSeenTxt(ts) {
    if (!ts) return "offline";
    var d = Date.now() - ts;
    if (d < 60000) return "visto agora";
    if (d < 3600000) return "visto há " + Math.floor(d / 60000) + " min";
    if (d < 86400000) return "visto há " + Math.floor(d / 3600000) + "h";
    return "visto há " + Math.floor(d / 86400000) + " dia(s)";
  }

  /* ---------- EDITAR MEU PERFIL ---------- */
  TM.ui.register("online-profile-edit", function (screen, params) {
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    var backTo = (params && params.back) || "online";
    screen.appendChild(TM.ui.topbar("✏️ Meu perfil", function () { TM.ui.go(backTo); }));
    var me = N().me;
    var draft = { name: me.name, photo: me.photo || null, favClub: me.favClub || null, bio: me.bio || "" };
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // foto
    var photoBox = el("div", { class: "photo-drop pe-photo" });
    function paintPhoto() { TM.ui.clear(photoBox); if (draft.photo) photoBox.appendChild(el("img", { src: draft.photo, class: "photo-img" })); else photoBox.appendChild(el("span", { text: "📷 Foto" })); }
    var fileIn = el("input", { type: "file", accept: "image/*", style: "display:none" });
    photoBox.addEventListener("click", function () { fileIn.click(); });
    fileIn.addEventListener("change", function () {
      var f = fileIn.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (ev) { var img = new Image(); img.onload = function () {
        var cv = document.createElement("canvas"), sc = Math.min(1, 160 / Math.max(img.width, img.height));
        cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        draft.photo = cv.toDataURL("image/jpeg", 0.8); paintPhoto();
      }; img.src = ev.target.result; };
      r.readAsDataURL(f);
    });
    paintPhoto();
    var photoActs = el("div", { class: "pe-photo-acts" }, [
      TM.ui.button("Trocar foto", function () { fileIn.click(); }, "btn ghost small"),
      draft.photo ? TM.ui.button("Remover", function () { draft.photo = null; paintPhoto(); }, "btn ghost small") : null
    ]);
    body.appendChild(el("div", { class: "setting center" }, [ photoBox, fileIn, photoActs ]));

    // nome
    var nameIn = el("input", { class: "select", type: "text", maxlength: "16", value: draft.name });
    nameIn.addEventListener("input", function () { draft.name = nameIn.value; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Nome" }), nameIn ]));

    // clube favorito (liga -> clube)
    var lgSel = el("select", { class: "select" });
    lgSel.appendChild(el("option", { value: "", text: "— nenhum —" }));
    TM.data.world().leagues.forEach(function (lg) { lgSel.appendChild(el("option", { value: lg.id, text: lg.name })); });
    var clubSel = el("select", { class: "select" });
    function fillClubs(leagueId, sel) {
      TM.ui.clear(clubSel);
      if (!leagueId) { clubSel.appendChild(el("option", { value: "", text: "—" })); clubSel.disabled = true; return; }
      clubSel.disabled = false;
      TM.data.league(leagueId).clubIds.map(TM.data.club).sort(function (a, b) { return a.name.localeCompare(b.name); })
        .forEach(function (c) { var o = el("option", { value: c.id, text: c.name }); if (c.id === sel) o.selected = true; clubSel.appendChild(o); });
    }
    // pré-seleção se já tiver clube favorito
    if (draft.favClub) { var fc = TM.data.club(draft.favClub); if (fc) { lgSel.value = fc.leagueId; fillClubs(fc.leagueId, draft.favClub); } else fillClubs(null); } else fillClubs(null);
    lgSel.addEventListener("change", function () { fillClubs(lgSel.value); draft.favClub = clubSel.value || null; });
    clubSel.addEventListener("change", function () { draft.favClub = clubSel.value || null; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Clube do coração" }), el("div", { class: "cc-name-row" }, [ lgSel, clubSel ]) ]));

    // bio
    var bioIn = el("textarea", { class: "comp-ta", maxlength: "140", placeholder: "Escreva algo sobre você (opcional)…" });
    bioIn.value = draft.bio || "";
    bioIn.addEventListener("input", function () { draft.bio = bioIn.value; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Bio" }), bioIn ]));

    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("💾 Salvar perfil", function () {
        N().updateProfile({ name: draft.name, photo: draft.photo, favClub: draft.favClub, bio: draft.bio }, function (ok) {
          TM.ui.toast(ok ? "✔ Perfil salvo!" : "Não foi possível salvar");
          if (ok) TM.ui.go(backTo);
        });
      }, "btn primary big")
    ]));
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
    var profBtn = el("button", { class: "tb-menu", text: "👤", title: "Ver perfil", on: { click: function () { if (chatStop) { chatStop(); chatStop = null; } TM.ui.go("online-profile", { uid: params.fuid, name: params.name, back: "online-friends" }); } } });
    screen.appendChild(TM.ui.topbar("💬 " + params.name, function () { if (chatStop) { chatStop(); chatStop = null; } TM.ui.go("online-friends"); }, profBtn));
    // retrospecto (placar histórico entre vocês)
    var h2h = el("div", { class: "h2h-bar", text: "Retrospecto: carregando…" });
    screen.appendChild(h2h);
    N().getH2H(params.fuid, function (r) {
      if (!h2h.isConnected) return;
      h2h.textContent = "🏆 Retrospecto — Você " + r.me + " · " + r.draws + " empate(s) · " + r.them + " " + params.name;
    });
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

  /* ---------- PARTIDA ALEATÓRIA (matchmaking) ---------- */
  var mmActive = false;
  TM.ui.register("online-random", function (screen) {
    screen.appendChild(TM.ui.topbar("🔀 Partida aleatória", function () { if (mmActive) { N().cancelFind(); mmActive = false; } TM.ui.go("online-play"); }));
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    if (TM.fairplay && !TM.fairplay.gate(screen)) return; // suspenso por abandono
    var body = el("div", { class: "panel-narrow", style: "text-align:center" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "mm-spinner" }));
    var status = el("div", { class: "mm-status", text: "🔎 Procurando um oponente…" });
    body.appendChild(status);
    body.appendChild(el("p", { class: "intro-text", text: "Você vai ser pareado com outro jogador que também está procurando. Assim que achar, vocês escolhem os times e jogam." }));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Cancelar", function () { if (mmActive) { N().cancelFind(); mmActive = false; } TM.ui.go("online-play"); }, "btn ghost")
    ]));
    mmActive = true;
    N().findMatch(function (code, side, err) {
      if (!screen.isConnected) return;
      mmActive = false;
      if (err || !code) { status.textContent = "❌ " + (err || "Não foi possível parear."); return; }
      if (side === "guest") {
        N().joinMatch(code, function (c, e2) { if (c) TM.ui.go("online-room", { code: c, side: "guest" }); else { status.textContent = "❌ " + (e2 || "Sala sumiu."); } });
      } else {
        TM.ui.go("online-room", { code: code, side: "host" });
      }
    }, function () { if (screen.isConnected) status.textContent = "🔎 Procurando um oponente… (aguarde)"; });
  });

  /* ---------- RANKING GLOBAL (vitórias online) ---------- */
  TM.ui.register("online-ranking", function (screen) {
    screen.appendChild(TM.ui.topbar("🏅 Ranking global", function () { TM.ui.go("online"); }));
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Os que mais venceram partidas online. Toque num jogador para ver o perfil ou adicioná-lo." }));
    var list = el("div", { class: "friend-list" });
    body.appendChild(list);
    list.appendChild(el("p", { class: "intro-text", text: "Carregando…" }));
    N().getRanking(function (arr) {
      if (!list.isConnected) return;
      list.innerHTML = "";
      if (!arr.length) { list.appendChild(el("p", { class: "intro-text", text: "Ainda ninguém no ranking. Seja o primeiro!" })); return; }
      var me = N().me ? N().me.uid : null;
      arr.forEach(function (r, i) {
        var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + "º";
        var isMe = r.uid === me;
        var row = el("div", { class: "friend-row" + (isMe ? " rank-me" : "") + (isMe ? "" : " clickable") }, [
          el("span", { class: "rank-pos", text: medal }),
          avatarOf(r.name),
          el("div", { class: "friend-info" }, [ el("div", { class: "friend-name", text: r.name + (isMe ? " (você)" : "") }), el("div", { class: "friend-sub", text: r.played + " jogo(s)" }) ]),
          el("div", { class: "rank-wins" }, [ el("b", { text: r.wins }), el("span", { text: " vit." }) ]),
          isMe ? null : el("span", { class: "row-chev", text: "›" })
        ]);
        if (!isMe) row.addEventListener("click", function () { openProfile(r.uid, r.name, "online-ranking"); });
        list.appendChild(row);
      });
    });
  });

  /* ---------- PARTIDA ONLINE: criar/entrar ---------- */
  TM.ui.register("online-play", function (screen) {
    screen.appendChild(TM.ui.topbar("⚔️ Partida online", function () { TM.ui.go("online"); }));
    if (!N().available || !N().ready) { TM.ui.go("online"); return; }
    if (TM.fairplay && !TM.fairplay.gate(screen)) return; // suspenso por abandono
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Crie uma sala e mostre o QR code (ou o código) para o amigo entrar, ou entre numa sala com o código." }));
    var seg = el("div", { class: "preset-msgs" });
    seg.appendChild(el("button", { class: "preset-msg", on: { click: function () { pickSourceThenCreate(); } } }, [ el("span", { class: "preset-ic", text: "⚽" }), el("span", { class: "preset-tx", text: "Partida normal (escolher time)" }), el("span", { class: "preset-mood", text: "→" }) ]));
    seg.appendChild(el("button", { class: "preset-msg", on: { click: function () { pickLeagueThenDraft(); } } }, [ el("span", { class: "preset-ic", text: "🎲" }), el("span", { class: "preset-tx", text: "Draft online (montar time por sorteio)" }), el("span", { class: "preset-mood", text: "→" }) ]));
    seg.appendChild(el("button", { class: "preset-msg", on: { click: function () { doCreate({ source: "club", mode: "penalty" }); } } }, [ el("span", { class: "preset-ic", text: "🥅" }), el("span", { class: "preset-tx", text: "Disputa de pênaltis (direto)" }), el("span", { class: "preset-mood", text: "→" }) ]));
    seg.appendChild(el("button", { class: "preset-msg", on: { click: function () { doCreate({ source: "club", mode: "surprise" }); } } }, [ el("span", { class: "preset-ic", text: "🎰" }), el("span", { class: "preset-tx", text: "Time surpresa (sorteio pra cada um)" }), el("span", { class: "preset-mood", text: "→" }) ]));
    seg.appendChild(el("button", { class: "preset-msg", on: { click: function () { TM.ui.go("online-random"); } } }, [ el("span", { class: "preset-ic", text: "🔀" }), el("span", { class: "preset-tx", text: "Partida aleatória (achar oponente)" }), el("span", { class: "preset-mood", text: "→" }) ]));
    seg.appendChild(el("button", { class: "preset-msg", on: { click: function () { TM.ui.go("online-join", {}); } } }, [ el("span", { class: "preset-ic", text: "🔑" }), el("span", { class: "preset-tx", text: "Entrar com código" }), el("span", { class: "preset-mood", text: "→" }) ]));
    body.appendChild(seg);
  });

  function pickSourceThenCreate() {
    TM.ui.optionsMenu("Tipo de time", [
      { label: "⚽ Clubes", fn: function () { doCreate({ source: "club" }); } },
      { label: "🌍 Seleções", fn: function () { doCreate({ source: "nation" }); } }
    ]);
  }
  function pickLeagueThenDraft() {
    var opts = TM.data.world().leagues.map(function (lg) { return { label: lg.name, fn: function () { doCreate({ source: "club", mode: "draft", league: lg.id }); } }; });
    TM.ui.optionsMenu("Draft de qual liga?", opts);
  }
  function doCreate(opts) {
    N().createMatch(opts, function (code) {
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
  function randomClubId() { var cs = TM.data.world().clubs; return cs[Math.floor(Math.random() * cs.length)].id; }
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
      // "time surpresa": sorteia um time aleatório para cada lado automaticamente
      if (m.mode === "surprise" && m.guest) {
        var mySide2 = side === "host" ? "host" : "guest";
        var myT = side === "host" ? m.hostTeam : m.guestTeam;
        if (!myT) { N().setMatchTeam(code, mySide2, randomClubId()); }
      }
      renderRoom(wrap, code, side, m);
      // host calcula o resultado quando os dois lados estão prontos
      var ready = m.mode === "draft" ? (m.hostDraft && m.guestDraft) : (m.hostTeam && m.guestTeam);
      if (side === "host" && ready && !m.result && !roomComputed) {
        roomComputed = true;
        var teams = buildMatchTeams(m), a = teams[0], b = teams[1];
        var settings = TM.storage.settings();
        if (m.mode === "penalty") {
          // disputa de pênaltis direto (sem partida)
          N().setMatchResult(code, { penaltyOnly: true, score: [0, 0], events: [], shootout: TM.engine.shootout(a, b) });
        } else {
          var result = TM.engine.simulate(a, b, { realism: settings.realism, neutral: true });
          if (result.score[0] === result.score[1]) { result.shootout = TM.engine.shootout(a, b); }
          N().setMatchResult(code, result);
        }
      }
    });
  });

  // monta os dois times da partida (normal = escudos; draft = lista de ids sorteados)
  function buildMatchTeams(m) {
    if (m.mode === "draft") {
      var mk = function (ids, name) { return { id: "d", name: name, players: (ids || []).map(function (id) { return TM.data.player(id); }).filter(Boolean) }; };
      return [ mk(m.hostDraft, (m.hostName || "Anfitrião") + " (Draft)"), mk(m.guestDraft, (m.guestName || "Convidado") + " (Draft)") ];
    }
    return [ teamObj(m.source, m.hostTeam), teamObj(m.source, m.guestTeam) ];
  }

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

    var isDraft = m.mode === "draft";
    var myReady = isDraft ? (side === "host" ? !!m.hostDraft : !!m.guestDraft) : !!myTeam;
    var oppReady = isDraft ? (side === "host" ? !!m.guestDraft : !!m.hostDraft) : !!oppTeam;

    // status dos dois jogadores
    wrap.appendChild(el("div", { class: "room-status" }, [
      seatChip("🔵", m.hostName || "Anfitrião", isDraft ? !!m.hostDraft : !!m.hostTeam, m.host),
      el("span", { class: "vs-mini", text: "×" }),
      seatChip("🔴", m.guestName || "Convidado…", isDraft ? !!m.guestDraft : !!m.guestTeam, m.guest)
    ]));

    if (!m.guest) { wrap.appendChild(el("div", { class: "waiting-line", text: "⏳ Aguardando o adversário…" })); }

    // ---- modo DRAFT: cada um monta o time por sorteio ----
    if (isDraft) {
      wrap.appendChild(el("div", { class: "list-head", text: "🎲 Draft — " + TM.data.league(m.league).name }));
      if (myReady) {
        wrap.appendChild(el("div", { class: "team-preview-row" }, [ el("span", { class: "prev-crest-sm", text: "✅" }), el("div", {}, [ el("div", { class: "tp-owner", text: "Você" }), el("div", { class: "tp-name", text: "Time draftado — pronto!" }) ]) ]));
      } else if (m.guest || side === "host") {
        wrap.appendChild(TM.ui.button("🎲 Fazer meu draft", function () { startOnlineDraft(code, side, m.league); }, "btn primary big"));
      }
      wrap.appendChild(el("div", { class: "waiting-line", text: oppReady ? "Adversário: pronto ✔" : (m.guest ? "Adversário: draftando…" : "Aguardando adversário entrar…") }));
      if (myReady && oppReady) wrap.appendChild(el("div", { class: "waiting-line", text: "✅ Tudo pronto! Iniciando a partida…" }));
      return;
    }

    // modo "time surpresa": times sorteados, sem escolha
    if (m.mode === "surprise") {
      wrap.appendChild(el("div", { class: "list-head", text: "🎰 Time surpresa — sorteado pra cada um" }));
      if (myTeam) wrap.appendChild(teamPreview(m.source, myTeam, "Você (sorteado)"));
      else wrap.appendChild(el("div", { class: "waiting-line", text: "🎰 Sorteando seu time…" }));
      if (oppTeam) wrap.appendChild(teamPreview(m.source, oppTeam, oppName || "Adversário (sorteado)"));
      else if (m.guest) wrap.appendChild(el("div", { class: "waiting-line", text: "🎰 Sorteando o adversário…" }));
      if (myTeam && oppTeam) wrap.appendChild(el("div", { class: "waiting-line", text: "✅ Iniciando…" }));
      return;
    }

    // meu seletor de time (visual, com escudos e overall)
    wrap.appendChild(el("div", { class: "list-head", text: m.mode === "penalty" ? "🥅 Escolha seu time (vai direto pros pênaltis)" : "Escolha seu time (" + (m.source === "nation" ? "seleção" : "clube") + ")" }));
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

  function seatChip(emoji, name, ready, uid) {
    var me = N().me ? N().me.uid : null;
    var clickable = uid && uid !== me;
    var chip = el("div", { class: "seat-chip" + (ready ? " ready" : "") + (clickable ? " clickable" : "") }, [ el("span", { text: emoji }), el("span", { class: "seat-chip-nm", text: name }), el("span", { class: "seat-chip-st", text: clickable ? "👤" : (ready ? "✔" : "…") }) ]);
    if (clickable) chip.addEventListener("click", function () { openProfileSheet(uid, name); });
    return chip;
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

  /* ---------- DRAFT ONLINE (cada jogador monta 11 por sorteio 1-de-5) ---------- */
  var odraft = null; // { code, side, league, pool, plan, step, picks, picked, options }
  var OD_PLAN = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
  var OD_ABBR = { GK: "GOL", DF: "ZAG", MF: "MEI", FW: "ATA" };
  var OD_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };
  function odShuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function startOnlineDraft(code, side, league) {
    var pool = [];
    TM.data.league(league).clubIds.forEach(function (cid) { pool = pool.concat(TM.data.clubPlayers(cid)); });
    odraft = { code: code, side: side, league: league, pool: pool, step: 0, picks: [], picked: {}, options: null };
    TM.ui.go("online-draft");
  }
  function odRoll() {
    var pos = OD_PLAN[odraft.step];
    var avail = odraft.pool.filter(function (p) { return !odraft.picked[p.id] && p.pos === pos; });
    odraft.options = odShuffle(avail).slice(0, 5);
  }
  TM.ui.register("online-draft", function (screen) {
    if (!odraft) { TM.ui.go("online"); return; }
    var total = OD_PLAN.length;
    if (odraft.step >= total) { finishOnlineDraft(); return; }
    if (!odraft.options) odRoll();
    var pos = OD_PLAN[odraft.step];
    screen.appendChild(TM.ui.topbar("🎲 Draft " + (odraft.step + 1) + "/" + total, function () {
      TM.ui.confirm("Sair do draft?", "As escolhas serão perdidas.", "Sair", function () { var c = odraft.code, s = odraft.side; odraft = null; TM.ui.go("online-room", { code: c, side: s }); }, true);
    }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "draft-progress" }, [
      el("div", { class: "draft-step-label", text: "Escolha seu " + OD_ABBR[pos] + " — 1 de 5" }),
      el("div", { class: "draft-dots" }, OD_PLAN.map(function (_, i) { return el("span", { class: "ddot " + (i < odraft.step ? "done" : i === odraft.step ? "cur" : "") }); }))
    ]));
    var list = el("div", { class: "build-list draft-opts" });
    odraft.options.forEach(function (p) {
      var club = TM.data.club(p.clubId);
      var card = el("div", { class: "build-card clickable draft-opt", on: { click: function () {
        odraft.picks.push(p); odraft.picked[p.id] = 1; odraft.step++; odraft.options = null; TM.ui.go("online-draft");
      } } }, [
        el("div", { class: "bc-face-wrap" }, [ TM.img.playerImg(p, "bc-face"), el("span", { class: "bc-pos", text: OD_ABBR[p.pos] || p.pos }) ]),
        el("div", { class: "bc-info" }, [ el("div", { class: "bc-name", text: p.name }), el("div", { class: "bc-meta", text: p.age + " anos · " + (club ? club.name : "") }) ]),
        TM.ui.ovBadge(p.overall)
      ]);
      list.appendChild(card);
    });
    body.appendChild(list);
  });
  function finishOnlineDraft() {
    var ids = odraft.picks.slice().sort(function (a, b) { var ra = OD_ORDER[a.pos], rb = OD_ORDER[b.pos]; return (ra == null ? 9 : ra) - (rb == null ? 9 : rb); }).map(function (p) { return p.id; });
    var code = odraft.code, side = odraft.side;
    N().setMatchDraft(code, side, ids);
    odraft = null;
    TM.ui.toast("Draft enviado! Aguardando o adversário…");
    TM.ui.go("online-room", { code: code, side: side });
  }

  /* ---------- PARTIDA ONLINE (replay do resultado compartilhado) ---------- */
  TM.ui.register("online-match", function (screen, params) {
    if (!params || !params.match || !params.match.result) { TM.ui.go("online"); return; }
    var m = params.match, side = params.side;
    var teams = buildMatchTeams(m), a = teams[0], b = teams[1];
    var result = sanitize(m.result);
    var settings = TM.storage.settings();
    function toResult(penWinnerSide) {
      TM.ui.go("online-result", { a: a, b: b, result: result, hostName: m.hostName, guestName: m.guestName, penWinnerSide: penWinnerSide,
        side: side, hostUid: m.host, guestUid: m.guest });
    }
    // disputa de pênaltis direto: pula a partida
    if (result.penaltyOnly && result.shootout) {
      TM.ui.go("pen-shootout", { teamA: a, teamB: b, shoot: result.shootout, title: "Pênaltis · Online",
        onDone: function () { toResult(result.shootout.winner); } });
      return;
    }
    var finished = false;
    TM.matchview.play(screen, {
      teamA: a, teamB: b, result: result, settings: settings,
      title: (m.hostName || "Anfitrião") + " × " + (m.guestName || "Convidado"),
      pauseSide: null, simOpts: { realism: settings.realism, neutral: true },
      onBack: function () {
        // sair no meio = abandono (conta como derrota + eventual suspensão)
        if (finished || !TM.fairplay) { TM.ui.go("online"); return; }
        TM.fairplay.confirmAbandon(function () {
          // registra derrota do abandonador no ranking, se possível
          try {
            var myUid = side === "host" ? m.host : m.guest;
            var oppUid = side === "host" ? m.guest : m.host;
            var oppName = side === "host" ? m.guestName : m.hostName;
            var myName = side === "host" ? m.hostName : m.guestName;
            if (myUid && oppUid) { N().recordResult(m.host, m.guest, oppUid); N().recordWin(oppUid, oppName, myUid, myName); }
          } catch (e) {}
          TM.ui.go("online");
        });
      },
      onDone: function () {
        finished = true;
        // empate → cai direto na disputa de pênaltis (mesmo resultado nos dois celulares)
        if (result.shootout) {
          TM.ui.go("pen-shootout", { teamA: a, teamB: b, shoot: result.shootout, title: "Pênaltis · Online",
            onDone: function () { toResult(result.shootout.winner); } });
        } else { toResult(null); }
      }
    });
    // emotes + ping ao vivo (só em partidas online reais, com código de sala)
    if (params.code && N().available) { setupEmotes(screen, params.code, side); setupPing(screen); }
  });

  /* ---------- EMOTES durante a partida online ---------- */
  var EMOTES = ["👏", "😂", "😮", "😡", "🔥", "😢", "💪", "🤝", "⚽", "🧤"];
  function setupEmotes(screen, code, side) {
    var oppSide = side === "host" ? "guest" : "host";
    // overlay de emote recebido
    var overlay = el("div", { class: "emote-overlay" });
    screen.appendChild(overlay);
    // barra de emotes
    var bar = el("div", { class: "emote-bar" });
    var toggle = el("button", { class: "emote-toggle", text: "😀", on: { click: function () { bar.classList.toggle("open"); } } });
    EMOTES.forEach(function (e) {
      bar.appendChild(el("button", { class: "emote-btn", text: e, on: { click: function () {
        try { N().sendEmote(code, side, e); } catch (err) {}
        flashEmote(overlay, e, "mine"); bar.classList.remove("open");
      } } }));
    });
    var wrap = el("div", { class: "emote-wrap" }, [ bar, toggle ]);
    screen.appendChild(wrap);
    // escuta emotes do oponente
    var lastTs = 0;
    var stop = N().listenEmote(code, function (v) {
      if (!screen.isConnected) { if (stop) stop(); return; }
      if (v.from === oppSide && v.ts !== lastTs) { lastTs = v.ts; flashEmote(overlay, v.emoji, "opp"); }
    });
  }
  function flashEmote(overlay, emoji, who) {
    var e = el("div", { class: "emote-fly " + who, text: emoji });
    overlay.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1800);
  }

  /* ---------- PING (indicador de conexão) ---------- */
  function setupPing(screen) {
    var badge = el("div", { class: "ping-badge" }, [ el("span", { class: "ping-dot" }), el("span", { class: "ping-txt", text: "-- ms" }) ]);
    screen.appendChild(badge);
    var timer = null;
    function tick() {
      if (!screen.isConnected) { if (timer) clearInterval(timer); return; }
      N().measurePing(function (ms) {
        if (!screen.isConnected) return;
        var txt = badge.querySelector(".ping-txt"), dot = badge.querySelector(".ping-dot");
        if (ms == null) { txt.textContent = "offline"; badge.className = "ping-badge bad"; return; }
        txt.textContent = ms + " ms";
        badge.className = "ping-badge " + (ms < 90 ? "good" : ms < 220 ? "ok" : "bad");
      });
    }
    tick(); timer = setInterval(tick, 3000);
  }
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
    // retrospecto entre amigos + ranking global: só o host grava (evita contar 2x)
    if (params.side === "host" && params.hostUid && params.guestUid) {
      var winUid = pen ? (params.penWinnerSide === 0 ? params.hostUid : params.guestUid)
                       : hs > as ? params.hostUid : as > hs ? params.guestUid : null;
      try {
        N().recordResult(params.hostUid, params.guestUid, winUid);
        if (winUid) { var wName = winUid === params.hostUid ? params.hostName : params.guestName; var lUid = winUid === params.hostUid ? params.guestUid : params.hostUid; var lName = winUid === params.hostUid ? params.guestName : params.hostName; N().recordWin(winUid, wName, lUid, lName); }
      } catch (e) {}
    }
    screen.appendChild(TM.ui.topbar("Resultado", function () { TM.ui.go("online"); }));
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [ el("span", { class: "rs-team", text: a.name }), el("span", { class: "rs-num", text: hs + " × " + as }), el("span", { class: "rs-team", text: b.name }) ]),
      el("div", { class: "result-tag", text: winner ? (pen ? "🎯 " + winner + " venceu nos pênaltis!" : "🏆 " + winner + " venceu!") : "🤝 Empate!" })
    ]));
    // revanche imediata: recria a partida com o mesmo adversário (via convite)
    var oppUid = params.side === "host" ? params.guestUid : params.hostUid;
    var oppName = params.side === "host" ? (params.guestName || b.name) : (params.hostName || a.name);
    var acts = [];
    if (N().available && N().ready && oppUid) {
      acts.push(TM.ui.button("👤 Ver perfil do adversário", function () { TM.ui.go("online-profile", { uid: oppUid, name: oppName, back: "online" }); }, "btn"));
      acts.push(TM.ui.button("🔁 Revanche", function () {
        TM.ui.toast("Enviando convite de revanche…");
        N().rematch(oppUid, { source: "club" }, function (code) {
          if (code) { TM.ui.toast("Convite enviado! Aguardando…"); TM.ui.go("online-room", { code: code, side: "host" }); }
          else TM.ui.toast("Não foi possível criar a revanche.");
        });
      }, "btn primary"));
    }
    acts.push(TM.ui.button("Voltar ao online", function () { TM.ui.go("online"); }, N().available && oppUid ? "btn ghost" : "btn primary"));
    acts.push(TM.ui.button("Central de amigos", function () { TM.ui.go("online-friends"); }, "btn ghost"));
    screen.appendChild(el("div", { class: "actions actions-col" }, acts));
  });

})(window);
