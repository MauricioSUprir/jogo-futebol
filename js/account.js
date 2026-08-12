/* ================= TOTAL MATCH — Conta (sincroniza carreiras) ================= */
/* Cria conta / entra em qualquer aparelho e sincroniza as carreiras salvas
   pela nuvem (Firebase). Requer internet; usa a conexão anônima já existente. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var N = function () { return TM.net; };

  var SYNC_KEYS = ["coach", "player", "compmode", "saves", "buildchallenge", "settings"];
  function snapshot() { var o = {}; SYNC_KEYS.forEach(function (k) { var v = TM.storage.read(k, null); if (v != null) o[k] = v; }); return o; }
  function restore(o) { SYNC_KEYS.forEach(function (k) { if (o && o[k] != null) TM.storage.write(k, o[k]); }); }
  function currentUser() { try { return localStorage.getItem("tm_account") || null; } catch (e) { return null; } }
  function setUser(u) { try { if (u) localStorage.setItem("tm_account", u); else localStorage.removeItem("tm_account"); } catch (e) {} }
  TM.account = { user: currentUser };

  // auto-sync: quando logado, sobe as carreiras (debounce de 3s)
  var upTimer = null;
  TM._onSave = function (key) {
    var u = currentUser(); if (!u) return;
    if (SYNC_KEYS.indexOf(key) < 0) return;
    if (upTimer) clearTimeout(upTimer);
    upTimer = setTimeout(function () { if (N().ready) N().cloudSave(u, snapshot()); }, 3000);
  };

  TM.ui.register("account", function (screen) {
    screen.appendChild(TM.ui.topbar("👤 Conta", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    N().init();
    if (!N().available) { body.appendChild(el("div", { class: "next-match" }, [ el("div", { class: "nm-label", text: "🚫 Sem conexão" }), el("p", { class: "intro-text", style: "text-align:center", text: "A conta precisa de internet para sincronizar. Tente de novo online." }) ])); return; }
    var load = el("div", { class: "next-match" }, [ el("div", { class: "nm-label", text: "⏳ Conectando…" }) ]);
    body.appendChild(load);
    var done = false;
    setTimeout(function () { if (!done && body.isConnected) { TM.ui.clear(body); body.appendChild(el("p", { class: "intro-text", text: "Não foi possível conectar. Verifique a internet." })); } }, 9000);
    N().onReady(function () {
      done = true;
      if (!body.isConnected) return;
      TM.ui.clear(body);
      var u = currentUser();
      if (u) renderLoggedIn(body, u); else renderLoggedOut(body);
    });
  });

  function renderLoggedIn(body, u) {
    body.appendChild(el("div", { class: "id-card" }, [
      el("div", { class: "id-num-lbl", text: "Conectado como" }),
      el("div", { class: "id-num", text: "@" + u })
    ]));
    body.appendChild(el("p", { class: "intro-text", text: "Suas carreiras são salvas na nuvem automaticamente. Em outro celular, entre com esta conta e toque em “Baixar” para trazê-las." }));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("☁️ Salvar carreiras na nuvem agora", function () {
        N().cloudSave(u, snapshot(), function (ok) { TM.ui.toast(ok ? "Carreiras salvas na nuvem! ✅" : "Erro ao salvar"); });
      }, "btn primary"),
      TM.ui.button("⬇️ Baixar carreiras da nuvem", function () {
        TM.ui.confirm("Baixar da nuvem?", "Isso substitui as carreiras deste aparelho pelas que estão salvas nesta conta.", "Baixar", function () {
          N().cloudLoad(u, function (data) {
            if (!data) { TM.ui.toast("Nenhuma carreira salva na nuvem ainda."); return; }
            restore(data); TM.ui.toast("Carreiras baixadas! ✅"); TM.ui.go("modes");
          });
        }, true);
      }, "btn"),
      TM.ui.button("Sair da conta", function () { setUser(null); TM.ui.toast("Você saiu da conta."); TM.ui.go("account"); }, "btn ghost")
    ]));
  }

  function renderLoggedOut(body) {
    body.appendChild(el("p", { class: "intro-text", text: "Crie uma conta para guardar suas carreiras na nuvem e acessá-las de qualquer celular — ou entre numa conta que você já tem." }));
    var userIn = el("input", { class: "select", type: "text", maxlength: "16", placeholder: "usuário (letras e números)" });
    var passIn = el("input", { class: "select", type: "password", maxlength: "32", placeholder: "senha (mín. 4)" });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Usuário" }), userIn ]));
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Senha" }), passIn ]));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Entrar", function () {
        N().login(userIn.value, passIn.value, function (acc, err) {
          if (err) { TM.ui.toast(err); return; }
          setUser(acc.user);
          TM.ui.toast("Conectado como @" + acc.user + (acc.saves ? " — toque em Baixar para trazer as carreiras." : ""));
          TM.ui.go("account");
        });
      }, "btn primary"),
      TM.ui.button("Criar conta nova", function () {
        N().createAccount(userIn.value, passIn.value, function (acc, err) {
          if (err) { TM.ui.toast(err); return; }
          setUser(acc.user);
          N().cloudSave(acc.user, snapshot(), function () {});
          TM.ui.toast("Conta @" + acc.user + " criada! Carreiras já na nuvem. ✅");
          TM.ui.go("account");
        });
      }, "btn"),
      el("div", { class: "setting-hint", text: "Dica: anote seu usuário e senha. A senha não pode ser recuperada." })
    ]));
  }
})(window);
