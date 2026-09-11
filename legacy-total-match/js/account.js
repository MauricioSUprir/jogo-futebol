/* ================= TOTAL MATCH — Perfil (conta + sincronização) ================= */
/* Criar conta (e-mail + senha), personalizar (nome + foto) e sincronizar as
   carreiras salvas entre aparelhos pela nuvem (Firebase). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var N = function () { return TM.net; };

  var SYNC_KEYS = ["coach", "player", "compmode", "saves", "buildchallenge", "settings"];
  var EDS = ["public", "pro"];
  function profile() { return TM.storage.read("profile", null); }        // { email, name, photo }
  function setProfile(p) { if (p) TM.storage.write("profile", p); else TM.storage.remove("profile"); }
  // conta excluída pelo administrador em outro aparelho: derruba o login local ao abrir o jogo
  function verifyProfile() {
    var p = profile(); if (!p || !p.email) return;
    try {
      var n = N(); if (!n || !n._db || !n.acctKey) return;
      n._db.ref("accounts/" + n.acctKey(p.email)).once("value").then(function (s) {
        if (s.val()) return;
        setProfile(null); if (n.unlinkAccount) n.unlinkAccount();
        TM.ui.toast("Esta conta foi excluída pelo administrador.");
        try { if (document.getElementById("screen-modes") || document.querySelector(".acct-card")) TM.ui.go("modes"); } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- SINCRONIZAÇÃO v2 (por edição e por chave, com data de modificação; tempo real) ----------
     nuvem: accounts/<conta>/sync/<public|pro>/<chave> = { t: carimbo, v: dados (null = apagado) }
     regra: o mais novo vence; cada chave sobe/desce separada (um aparelho nunca apaga a carreira do outro). */
  var dirty = {}, upTimer = null, watching = null, lastSync = 0, pulling = false, pushFails = 0;
  TM._onSave = function (key, ed) {
    if (!profile()) return;
    if (SYNC_KEYS.indexOf(key) < 0) return;
    dirty[(ed || TM.storage.edition()) + "|" + key] = true;
    schedulePush();
  };
  function schedulePush() { if (upTimer) clearTimeout(upTimer); upTimer = setTimeout(function () { push(false); }, 4000); }
  function push(all, cb) {
    var p = profile(); if (!p || !N().ready) { cb && cb(false); return; }
    var patch = {}, n = 0;
    EDS.forEach(function (ed) { SYNC_KEYS.forEach(function (k) {
      var id = ed + "|" + k; if (!all && !dirty[id]) return;
      var t = TM.storage.tsRaw(ed, k), v = TM.storage.readRaw(ed, k);
      if (v == null && !t) return;                       // nunca existiu neste aparelho
      patch["sync/" + ed + "/" + k] = { t: t || 1, v: v == null ? null : v }; n++;
    }); });
    if (!n) { cb && cb(true); return; }
    N().cloudPatch(p.email, patch, function (ok) {
      if (ok) { pushFails = 0; Object.keys(patch).forEach(function (pk) { var parts = pk.split("/"); delete dirty[parts[1] + "|" + parts[2]]; }); lastSync = Date.now(); }
      else { pushFails++; if (pushFails <= 4) { if (upTimer) clearTimeout(upTimer); upTimer = setTimeout(function () { push(false); }, 4000 * pushFails); } }
      cb && cb(ok);
    });
  }
  // aplica uma entrada da nuvem se for mais nova que a local (ou à força)
  function applyEntry(ed, k, e, force) {
    if (!e || typeof e !== "object" || !("t" in e || "v" in e)) return false;
    var lt = TM.storage.tsRaw(ed, k), lv = TM.storage.readRaw(ed, k), ct = e.t || 1;
    if (!force && ct <= lt) return false;
    if (!force && lv != null && !lt && ct <= 1) return false;   // os dois são antigos (sem carimbo): mantém o local
    if (e.v == null) { if (lv == null) { TM.storage.touchRaw(ed, k, ct); return false; } TM.storage.removeRaw(ed, k, ct); }
    else TM.storage.writeRaw(ed, k, e.v, ct);
    return true;
  }
  function pull(cb, force) {
    var p = profile(); if (!p || !N().ready || !N().syncRef) { cb && cb(0); return; }
    if (pulling) { cb && cb(0); return; } pulling = true;
    var changed = [];
    function finish() {
      pulling = false; lastSync = Date.now();
      if (Object.keys(dirty).length) schedulePush();
      if (changed.length) notifyChanged(changed);
      cb && cb(changed.length);
    }
    N().syncRef(p.email).once("value").then(function (s) {
      var v = s.val();
      if (!v) {
        // formato antigo (um pacote só): trata como dados antigos da edição atual
        N().cloudLoad(p.email, function (old) {
          if (old) { var ed = TM.storage.edition(); SYNC_KEYS.forEach(function (k) { if (old[k] != null && applyEntry(ed, k, { t: 1, v: old[k] }, force)) changed.push(ed + "/" + k); }); }
          EDS.forEach(function (ed2) { SYNC_KEYS.forEach(function (k) { if (TM.storage.readRaw(ed2, k) != null) dirty[ed2 + "|" + k] = true; }); });
          finish();
        });
        return;
      }
      EDS.forEach(function (ed) {
        var node = v[ed] || {};
        SYNC_KEYS.forEach(function (k) {
          var e = node[k];
          if (e && applyEntry(ed, k, e, force)) changed.push(ed + "/" + k);
          else if (e && (e.t || 1) < TM.storage.tsRaw(ed, k)) dirty[ed + "|" + k] = true;   // local mais novo: sobe
          else if (!e && TM.storage.readRaw(ed, k) != null) dirty[ed + "|" + k] = true;     // só existe aqui: sobe
        });
      });
      finish();
    }).catch(function () { pulling = false; cb && cb(0); });
  }
  // tempo real: mudanças salvas em outro aparelho chegam na hora
  function watch() {
    var p = profile(); if (!p || !N().ready || !N().syncRef) return;
    if (watching === p.email) return;
    unwatch(); watching = p.email;
    EDS.forEach(function (ed) {
      var ref = N().syncRef(p.email, ed);
      var h = function (snap) { var k = snap.key; if (SYNC_KEYS.indexOf(k) < 0) return; if (applyEntry(ed, k, snap.val(), false)) notifyChanged([ed + "/" + k]); };
      ref.on("child_added", h); ref.on("child_changed", h);
    });
  }
  function unwatch() {
    if (!watching) return;
    try { EDS.forEach(function (ed) { N().syncRef(watching, ed).off(); }); } catch (e) {}
    watching = null;
  }
  var LIVE_SCREENS = ["modes", "coach", "coach-hub", "profile", "saves", "player", "player-hub", "compmode"];
  function notifyChanged(list) {
    var careers = list.some(function (x) { return /\/(coach|player|compmode|saves|buildchallenge)$/.test(x); });
    try { TM.ui.toast(careers ? "☁️ Progresso atualizado de outro aparelho" : "☁️ Configurações sincronizadas"); } catch (e) {}
    try { var cur = TM.ui.current && TM.ui.current(); if (cur && LIVE_SCREENS.indexOf(cur) >= 0) TM.ui.go(cur); } catch (e) {}
  }
  function syncNow(cb) { pull(function (n) { push(true, function (ok) { watch(); cb && cb(n, ok); }); }, false); }
  // ao abrir o jogo (logado): baixa o que está mais novo na nuvem, sobe o que está mais novo aqui e fica ouvindo
  try { if (N()) N().onReady(function () { setTimeout(verifyProfile, 800); setTimeout(function () { syncNow(); }, 300); }); } catch (e) {}
  try { document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && profile()) pull(function () { watch(); }); }); } catch (e) {}
  TM.account = { profile: profile, sync: syncNow, pull: pull, push: push };
  function snapshot() { var o = {}; SYNC_KEYS.forEach(function (k) { var v = TM.storage.read(k, null); if (v != null) o[k] = v; }); return o; }
  function lastSyncTxt() { if (!lastSync) return "ainda não sincronizado nesta sessão"; var d = new Date(lastSync); return "última sincronização " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

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
    body.appendChild(el("p", { class: "intro-text", text: "Suas carreiras (treinador, jogador, competições e saves) sobem sozinhas e chegam em tempo real nos outros aparelhos com a mesma conta. As duas edições (pública e Season Update) são guardadas separadas. Quando o mesmo save é alterado em dois aparelhos, vale o mais recente." }));
    var syncSt = el("div", { class: "setting-hint", text: "☁️ " + lastSyncTxt() });
    body.appendChild(syncSt);
    try {
      N().syncRef(p.email).once("value").then(function (s) {
        var v = s.val() || {}; var parts = [];
        EDS.forEach(function (ed) { var cc2 = v[ed] && v[ed].coach && v[ed].coach.v; if (cc2 && cc2.teamName) parts.push((ed === "pro" ? "Season Update" : "Pública") + ": " + cc2.teamName + (cc2.season ? " · temp. " + cc2.season : "") + " (" + new Date(v[ed].coach.t || 0).toLocaleDateString("pt-BR") + ")"); });
        if (syncSt.isConnected) syncSt.textContent = "☁️ " + lastSyncTxt() + (parts.length ? " · na nuvem: " + parts.join(" | ") : " · nenhuma carreira de treinador na nuvem ainda");
      });
    } catch (e) {}
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("🔄 Sincronizar agora", function () { syncNow(function (n, ok) { TM.ui.toast(ok ? (n ? "Sincronizado: " + n + " item(ns) atualizado(s) ✅" : "Tudo sincronizado ✅") : "Erro ao enviar para a nuvem"); TM.ui.go("profile"); }); }, "btn primary"),
      TM.ui.button("⬆️ Forçar envio deste aparelho", function () {
        TM.ui.confirm("Enviar este aparelho?", "As carreiras DESTE aparelho passam a valer na nuvem e nos outros aparelhos, mesmo que lá estejam mais recentes.", "Enviar", function () {
          var now = Date.now(); EDS.forEach(function (ed) { SYNC_KEYS.forEach(function (k) { if (TM.storage.readRaw(ed, k) != null) TM.storage.touchRaw(ed, k, now); }); });
          push(true, function (ok) { TM.ui.toast(ok ? "Enviado! ✅" : "Erro ao enviar"); TM.ui.go("profile"); });
        }, true);
      }, "btn"),
      TM.ui.button("⬇️ Forçar download da nuvem", function () {
        TM.ui.confirm("Baixar da nuvem?", "Substitui as carreiras deste aparelho pelas que estão na nuvem, mesmo que as daqui sejam mais recentes.", "Baixar", function () {
          pull(function (n) { TM.ui.toast(n ? "Baixado: " + n + " item(ns) ✅" : "Nada diferente na nuvem."); TM.ui.go("modes"); }, true);
        }, true);
      }, "btn"),
      TM.ui.button("Sair da conta", function () { push(false, function () { unwatch(); setProfile(null); if (N().unlinkAccount) N().unlinkAccount(); TM.ui.toast("Você saiu da conta."); TM.ui.go("profile"); }); }, "btn ghost")
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
          // traz tudo automaticamente: baixa o que está mais novo na nuvem, sobe o que só existe aqui e fica ouvindo
          syncNow(function (n) { TM.ui.toast("Bem-vindo, " + acc.name + "!" + (n ? " Progresso restaurado ✅" : " ✅")); TM.ui.go("modes"); });
        });
      }, "btn primary"),
      TM.ui.button("Criar conta nova", function () {
        N().createAccount(mailIn.value, passIn.value, nameIn.value, function (acc, err) {
          if (err) { TM.ui.toast(err); return; }
          setProfile({ email: acc.email, name: acc.name, photo: null });
          push(true, function () { watch(); });
          TM.ui.toast("Conta criada! Bem-vindo, " + acc.name + " ✅");
          TM.ui.go("profile");
        });
      }, "btn"),
      el("div", { class: "setting-hint", text: "Dica: anote seu e-mail e senha. Como é um jogo casual, use uma senha simples (não uma senha importante sua)." })
    ]));
  }
})(window);
