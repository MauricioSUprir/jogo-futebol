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
    if (p && p.photo) return el("img", { src: p.photo, class: cls });
    var initials = ((p && p.name) || "?").trim().slice(0, 1).toUpperCase();
    return el("div", { class: cls + " prof-initials", text: initials });
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
    // boas-vindas + foto
    var pcard = el("div", { class: "prof-card" }, [
      avatar(p, "prof-photo-lg"),
      el("div", {}, [
        el("div", { class: "prof-hi", text: "👋 Olá, " + p.name + "!" }),
        el("div", { class: "prof-email", text: p.email })
      ])
    ]);
    body.appendChild(pcard);

    // editar perfil (foto + nome)
    body.appendChild(el("div", { class: "list-head", text: "Personalizar" }));
    var draft = { name: p.name, photo: p.photo || null };
    var photoBox = el("button", { class: "photo-drop small", on: { click: function () { pickPhoto(function (d) { draft.photo = d; TM.ui.clear(photoBox); photoBox.appendChild(el("img", { src: d, class: "photo-img" })); }); } } });
    if (draft.photo) photoBox.appendChild(el("img", { src: draft.photo, class: "photo-img" })); else photoBox.appendChild(el("span", { text: "📷 Foto" }));
    var nameIn = el("input", { class: "select", type: "text", maxlength: "20", value: p.name, placeholder: "seu nome" });
    body.appendChild(el("div", { class: "prof-edit" }, [ photoBox, nameIn ]));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("💾 Salvar perfil", function () {
        var np = { email: p.email, name: (nameIn.value || "").trim() || p.name, photo: draft.photo || null };
        setProfile(np); N().cloudSaveProfile(np.email, np, function () {}); TM.ui.toast("Perfil salvo! ✅"); TM.ui.go("profile");
      }, "btn primary")
    ]));

    // carreiras (nuvem)
    body.appendChild(el("div", { class: "list-head", text: "Carreiras (nuvem)" }));
    body.appendChild(el("p", { class: "intro-text", text: "Suas carreiras sobem automaticamente. Em outro aparelho, entre com esta conta e toque em Baixar." }));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("☁️ Salvar carreiras na nuvem agora", function () { N().cloudSave(p.email, snapshot(), function (ok) { TM.ui.toast(ok ? "Carreiras salvas! ✅" : "Erro ao salvar"); }); }, "btn"),
      TM.ui.button("⬇️ Baixar carreiras da nuvem", function () {
        TM.ui.confirm("Baixar da nuvem?", "Substitui as carreiras deste aparelho pelas salvas nesta conta.", "Baixar", function () {
          N().cloudLoad(p.email, function (data) { if (!data) { TM.ui.toast("Nenhuma carreira na nuvem ainda."); return; } restore(data); TM.ui.toast("Carreiras baixadas! ✅"); TM.ui.go("modes"); });
        }, true);
      }, "btn"),
      TM.ui.button("Sair da conta", function () { setProfile(null); TM.ui.toast("Você saiu da conta."); TM.ui.go("profile"); }, "btn ghost")
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
          TM.ui.toast("Bem-vindo, " + acc.name + "! Toque em Baixar para trazer as carreiras.");
          TM.ui.go("profile");
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
