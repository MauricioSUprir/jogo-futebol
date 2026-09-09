/* ================= TOTAL MATCH — Perfil (conta + sincronização) ================= */
/* Criar conta (e-mail + senha), personalizar (nome + foto) e sincronizar as
   carreiras salvas entre aparelhos pela nuvem (Firebase). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var N = function () { return TM.net; };

  var SYNC_KEYS = ["coach", "player", "compmode", "saves", "buildchallenge", "settings"];
  function snapshot() { var o = {}; SYNC_KEYS.forEach(function (k) { var v = TM.storage.read(k, null); if (v != null) o[k] = v; }); return o; }
  function restore(o) { SYNC_KEYS.forEach(function (k) { if (o && o[k] != null) TM.storage.write(k, o[k]); }); }
  function profile() { return TM.storage.read("profile", null); }        // { email, name, photo }
  function setProfile(p) { if (p) TM.storage.write("profile", p); else TM.storage.remove("profile"); }
  TM.account = { profile: profile };

  // auto-sync: quando logado, sobe as carreiras (debounce de 3s)
  var upTimer = null;
  TM._onSave = function (key) {
    var p = profile(); if (!p) return;
    if (SYNC_KEYS.indexOf(key) < 0) return;
    if (upTimer) clearTimeout(upTimer);
    upTimer = setTimeout(function () { if (N().ready) N().cloudSave(p.email, snapshot()); }, 3000);
  };

  // avatar do perfil (foto ou iniciais)
  function avatar(p, cls) {
    var fr = (p && p.frame === "gold") ? " frame-gold" : "";
    if (p && p.photo) return el("img", { src: p.photo, class: cls + fr });
    var initials = ((p && p.name) || "?").trim().slice(0, 1).toUpperCase();
    return el("div", { class: cls + " prof-initials" + fr, text: initials });
  }
  // seletor de foto (redimensiona p/ 160px)
  function pickPhoto(cb) {
    var input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
    input.onchange = function () {
      var f = input.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement("canvas"), sc = Math.min(1, 160 / Math.max(img.width, img.height));
          cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          cb(cv.toDataURL("image/jpeg", 0.8));
        };
        img.src = ev.target.result;
      };
      r.readAsDataURL(f);
    };
    input.click();
  }
  TM.account.avatar = avatar; // p/ a topbar de modos

  /* ---------- TELA PERFIL ---------- */
  TM.ui.register("profile", function (screen) {
    screen.appendChild(TM.ui.topbar("👤 Perfil", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    N().init();
    if (!N().available) { body.appendChild(el("div", { class: "next-match" }, [ el("div", { class: "nm-label", text: "🚫 Sem conexão" }), el("p", { class: "intro-text", style: "text-align:center", text: "O perfil precisa de internet para sincronizar. Tente de novo online." }) ])); return; }
    var load = el("div", { class: "next-match" }, [ el("div", { class: "nm-label", text: "⏳ Conectando…" }) ]);
    body.appendChild(load);
    var done = false;
    setTimeout(function () { if (!done && body.isConnected) { TM.ui.clear(body); body.appendChild(el("p", { class: "intro-text", text: "Não foi possível conectar. Verifique a internet." })); } }, 9000);
    N().onReady(function () { done = true; if (!body.isConnected) return; TM.ui.clear(body); var p = profile(); if (p) renderLoggedIn(body, p); else renderLoggedOut(body); });
  });

  function renderLoggedIn(body, p) {
    var me = N().me || {};
    var number = me.number || null;
    // cartão da conta: foto, nome, e-mail, NÚMERO DA CONTA (para receber coins / adicionar amigos)
    var pcard = el("div", { class: "prof-card acct-card" }, [
      avatar(p, "prof-photo-lg"),
      el("div", { class: "acct-info" }, [
        el("div", { class: "prof-hi", text: "👋 Olá, " + p.name + "!" }),
        el("div", { class: "prof-email", text: p.email }),
        el("div", { class: "acct-number" }, [
          el("span", { class: "acct-lbl", text: "Nº da conta" }),
          el("span", { class: "acct-num", text: number || "…" }),
          number ? el("button", { class: "acct-copy", title: "Copiar", on: { click: function () { try { navigator.clipboard.writeText(number); TM.ui.toast("Número copiado: " + number); } catch (e) { TM.ui.toast(number); } } } }, [ el("span", { text: "⧉" }) ]) : null
        ].filter(Boolean)),
        el("div", { class: "acct-status" + (me.uid ? " on" : ""), text: me.uid ? "● online" : "○ offline" })
      ])
    ]);
    body.appendChild(pcard);
    body.appendChild(el("div", { class: "setting-hint", text: "Seu número é como os outros te encontram: para adicionar como amigo e para receber Total Coins." }));

    // administrador: atalho para gerenciar contas e coins
    if (TM.coins && TM.coins.isAdmin && TM.coins.isAdmin()) {
      body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("👑 Gerenciar contas e coins", function () { TM.ui.go("coins"); }, "btn primary") ]));
    }
    // moldura dourada (compra com Total Coins)
    if (TM.coins) {
      body.appendChild(el("div", { class: "actions" }, [
        p.frame === "gold"
          ? TM.ui.button("🥇 Moldura dourada ativa", function () { TM.ui.toast("Sua foto já tem a moldura dourada."); }, "btn ghost small")
          : TM.ui.button("🥇 Moldura dourada por " + TM.coins.COST.goldFrame + " 🪙", function () {
              TM.coins.pay(TM.coins.COST.goldFrame, "Moldura dourada", function () {
                var np = { email: p.email, name: p.name, photo: p.photo || null, frame: "gold" }; setProfile(np);
                try { N().cloudSaveProfile(np.email, np, function () {}); } catch (e) {}
                try { if (N().updateProfile) N().updateProfile({ frame: "gold" }, function () {}); } catch (e) {}
                TM.ui.toast("Moldura dourada ativada! 🥇"); TM.ui.go("profile");
              });
            }, "btn ghost small")
      ]));
    }
    // Total Coins / Total Points
    if (TM.coins) {
      var cs = TM.coins.state();
      body.appendChild(el("div", { class: "acct-stats" }, [
        el("button", { class: "acct-stat", on: { click: function () { TM.ui.go("coins"); } } }, [ el("div", { class: "acct-stat-v", text: cs.bal + " 🪙" }), el("div", { class: "acct-stat-l", text: "Total Coins" }) ]),
        el("button", { class: "acct-stat", on: { click: function () { TM.ui.go("coins"); } } }, [ el("div", { class: "acct-stat-v", text: String(cs.earned || 0) }), el("div", { class: "acct-stat-l", text: "Total Points" }) ]),
        el("button", { class: "acct-stat", on: { click: function () { TM.ui.go("coins"); } } }, [ el("div", { class: "acct-stat-v", text: String(cs.best || 0) }), el("div", { class: "acct-stat-l", text: "Melhor sequência" }) ])
      ]));
    }

    // perfil online: clube do coração, bio, partidas online, amigos
    var onl = el("div", { class: "prof-card pblock acct-online" }, [ el("div", { class: "prof-card-h", text: "PERFIL ONLINE" }), el("div", { class: "setting-hint", text: "Carregando…" }) ]);
    body.appendChild(onl);
    if (me.uid && N().getProfile) {
      N().getProfile(me.uid, function (op) {
        if (!onl.isConnected) return;
        TM.ui.clear(onl);
        onl.appendChild(el("div", { class: "prof-card-h", text: "PERFIL ONLINE" }));
        var fav = op.favClub && TM.data.club(op.favClub);
        onl.appendChild(el("div", { class: "acct-row" }, [
          fav ? TM.img.clubImg(fav, "pf-crest") : el("span", { class: "pf-crest-empty", text: "❤" }),
          el("div", {}, [ el("div", { class: "pf-lbl", text: "Clube do coração" }), el("div", { class: "pf-name", text: fav ? fav.name : "não escolhido" }) ])
        ]));
        if (op.bio) onl.appendChild(el("div", { class: "profile-bio", text: "“" + op.bio + "”" }));
        var winPct = op.played ? Math.round((op.wins / op.played) * 100) : 0;
        onl.appendChild(el("div", { class: "acct-stats" }, [
          el("div", { class: "acct-stat" }, [ el("div", { class: "acct-stat-v", text: String(op.played || 0) }), el("div", { class: "acct-stat-l", text: "Jogos online" }) ]),
          el("div", { class: "acct-stat" }, [ el("div", { class: "acct-stat-v", text: String(op.wins || 0) }), el("div", { class: "acct-stat-l", text: "Vitórias" }) ]),
          el("div", { class: "acct-stat" }, [ el("div", { class: "acct-stat-v", text: winPct + "%" }), el("div", { class: "acct-stat-l", text: "Aproveitamento" }) ])
        ]));
        onl.appendChild(el("div", { class: "hub-actions" }, [
          el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-profile-edit", { back: "profile" }); } } }, [ el("span", { class: "hub-ic", text: "✏️" }), el("span", { text: "Editar" }) ]),
          el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-profile", { uid: me.uid, back: "profile" }); } } }, [ el("span", { class: "hub-ic", text: "👁️" }), el("span", { text: "Ver público" }) ]),
          el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-friends"); } } }, [ el("span", { class: "hub-ic", text: "👥" }), el("span", { text: "Amigos" }) ]),
          el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("online-ranking"); } } }, [ el("span", { class: "hub-ic", text: "🏅" }), el("span", { text: "Ranking" }) ])
        ]));
      });
    } else {
      TM.ui.clear(onl); onl.appendChild(el("div", { class: "prof-card-h", text: "PERFIL ONLINE" })); onl.appendChild(el("div", { class: "setting-hint", text: "Conecte-se para ver seu perfil online." }));
    }

    // carreiras neste aparelho
    try {
      var cc = TM.storage.coachCareer();
      if (cc && cc.teamName) {
        body.appendChild(el("div", { class: "prof-card pblock" }, [
          el("div", { class: "prof-card-h", text: "CARREIRA" }),
          el("div", { class: "acct-row" }, [ TM.data.club(cc.teamId) ? TM.img.clubImg(TM.data.club(cc.teamId), "pf-crest") : el("span"), el("div", {}, [ el("div", { class: "pf-lbl", text: "Master League" }), el("div", { class: "pf-name", text: cc.teamName + (cc.season ? " · temporada " + cc.season : "") }) ]) ]),
          el("div", { class: "actions" }, [ TM.ui.button("▶ Continuar carreira", function () { TM.ui.go("coach-hub"); }, "btn small") ])
        ]));
      }
    } catch (e) {}

    // editar perfil (foto + nome)
    body.appendChild(el("div", { class: "list-head", text: "Personalizar" }));
    var draft = { name: p.name, photo: p.photo || null };
    var photoBox = el("button", { class: "photo-drop small", on: { click: function () { pickPhoto(function (d) { draft.photo = d; TM.ui.clear(photoBox); photoBox.appendChild(el("img", { src: d, class: "photo-img" })); }); } } });
    if (draft.photo) photoBox.appendChild(el("img", { src: draft.photo, class: "photo-img" })); else photoBox.appendChild(el("span", { text: "📷 Foto" }));
    var nameIn = el("input", { class: "select", type: "text", maxlength: "20", value: p.name, placeholder: "seu nome" });
    body.appendChild(el("div", { class: "prof-edit" }, [ photoBox, nameIn ]));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("💾 Salvar perfil", function () {
        var np = { email: p.email, name: (nameIn.value || "").trim() || p.name, photo: draft.photo || null, frame: p.frame || null };
        setProfile(np); N().cloudSaveProfile(np.email, np, function () {}); TM.ui.toast("Perfil salvo! ✅"); TM.ui.go("profile");
      }, "btn primary")
    ]));

    // carreiras (nuvem)
    body.appendChild(el("div", { class: "list-head", text: "Sincronização (nuvem)" }));
    body.appendChild(el("p", { class: "intro-text", text: "Sua conta guarda tudo: carreiras (treinador, jogador e competições) sobem sozinhas, e seu perfil online — número, amigos e conversas — segue com a conta em qualquer aparelho. Ao entrar em outro celular, o progresso é restaurado automaticamente." }));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("☁️ Salvar carreiras na nuvem agora", function () { N().cloudSave(p.email, snapshot(), function (ok) { TM.ui.toast(ok ? "Carreiras salvas! ✅" : "Erro ao salvar"); }); }, "btn"),
      TM.ui.button("⬇️ Baixar carreiras da nuvem", function () {
        TM.ui.confirm("Baixar da nuvem?", "Substitui as carreiras deste aparelho pelas salvas nesta conta.", "Baixar", function () {
          N().cloudLoad(p.email, function (data) { if (!data) { TM.ui.toast("Nenhuma carreira na nuvem ainda."); return; } restore(data); TM.ui.toast("Carreiras baixadas! ✅"); TM.ui.go("modes"); });
        }, true);
      }, "btn"),
      TM.ui.button("Sair da conta", function () { setProfile(null); if (N().unlinkAccount) N().unlinkAccount(); TM.ui.toast("Você saiu da conta."); TM.ui.go("profile"); }, "btn ghost")
    ]));
  }

  function renderLoggedOut(body) {
    body.appendChild(el("p", { class: "intro-text", text: "Crie uma conta para guardar suas carreiras na nuvem e jogá-las de qualquer aparelho. Depois você personaliza com nome e foto." }));
    var nameIn = el("input", { class: "select", type: "text", maxlength: "20", placeholder: "seu nome (para criar conta)" });
    var mailIn = el("input", { class: "select", type: "email", placeholder: "e-mail" });
    var passIn = el("input", { class: "select", type: "password", maxlength: "32", placeholder: "senha (mín. 4)" });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Nome" }), nameIn ]));
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "E-mail" }), mailIn ]));
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Senha" }), passIn ]));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Entrar", function () {
        N().login(mailIn.value, passIn.value, function (acc, err) {
          if (err) { TM.ui.toast(err); return; }
          setProfile({ email: acc.email, name: acc.name, photo: acc.photo || null });
          // traz tudo automaticamente: carreiras (offline) já baixam; online segue pela conta
          if (acc.saves) { restore(acc.saves); TM.ui.toast("Bem-vindo, " + acc.name + "! Progresso restaurado ✅"); }
          else { TM.ui.toast("Bem-vindo, " + acc.name + "! ✅"); }
          TM.ui.go("modes");
        });
      }, "btn primary"),
      TM.ui.button("Criar conta nova", function () {
        N().createAccount(mailIn.value, passIn.value, nameIn.value, function (acc, err) {
          if (err) { TM.ui.toast(err); return; }
          setProfile({ email: acc.email, name: acc.name, photo: null });
          N().cloudSave(acc.email, snapshot(), function () {});
          TM.ui.toast("Conta criada! Bem-vindo, " + acc.name + " ✅");
          TM.ui.go("profile");
        });
      }, "btn"),
      el("div", { class: "setting-hint", text: "Dica: anote seu e-mail e senha. Como é um jogo casual, use uma senha simples (não uma senha importante sua)." })
    ]));
  }
})(window);
