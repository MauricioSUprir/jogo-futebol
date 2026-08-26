/* ================= TOTAL MATCH — licença / cadeado de venda =================
   Modelo: a pessoa compra no Kiwify -> recebe uma CHAVE única -> ativa aqui.
   A chave é validada por um servidor grátis (Cloudflare Worker) que marca a
   chave como usada e a "amarra" a este aparelho. Depois de ativado, fica
   destravado localmente (não precisa de internet toda vez).

   >>> ENQUANTO PAYWALL = false, o jogo fica 100% aberto (nada trava).
   Ligue PAYWALL = true só quando o Kiwify + o Worker estiverem prontos. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  var CONFIG = {
    PAYWALL: true,                                    // cadeado LIGADO — venda no ar
    API: "https://tm-license.onrender.com",           // servidor de licenças (Render) — já no ar
    BUY_URL: "https://pay.kiwify.com.br/q8ROOrh",     // checkout do produto no Kiwify
    PRICE_LABEL: "R$ 9,90",                           // texto na tela (ajuste se mudar o preço no Kiwify)
    // telas livres (utilidades — não são jogo): config, perfil, salvos, infos
    FREE_ROUTES: { settings: 1, profile: 1, saves: 1, competicoes: 1 },
    // TODOS os modos de jogo exigem compra (sem demo grátis)
    PAID_ROUTES: { coach: 1, online: 1, dream: 1, draft: 1, groupcomp: 1, editor: 1, quick: 1, compmode: 1 }
  };
  TM.LICENSE_CONFIG = CONFIG;

  var LS_DEVICE = "totalmatch:device";
  var LS_LIC = "totalmatch:license";

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function deviceId() {
    var d = lsGet(LS_DEVICE);
    if (!d) {
      d = "dev_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
      lsSet(LS_DEVICE, d);
    }
    return d;
  }

  function state() {
    try { var raw = lsGet(LS_LIC); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function saveState(s) { lsSet(LS_LIC, JSON.stringify(s)); }

  function isUnlocked() {
    if (!CONFIG.PAYWALL) return true;                 // cadeado desligado = tudo liberado
    var s = state();
    return !!(s && s.token);
  }
  function isPaidRoute(route) {
    if (!route) return false;
    return !!CONFIG.PAID_ROUTES[route];
  }

  // ativa a chave contra o servidor (Cloudflare Worker)
  function activate(key, cb) {
    key = (key || "").trim().toUpperCase();
    if (!key) { cb({ ok: false, error: "Digite a chave." }); return; }
    if (!CONFIG.API) { cb({ ok: false, error: "Servidor de licença não configurado." }); return; }
    var url = CONFIG.API.replace(/\/+$/, "") + "/activate";
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key, device: deviceId() })
      }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "Resposta inválida do servidor." }; }); })
        .then(function (data) {
          if (data && data.ok && data.token) {
            saveState({ key: key, token: data.token, device: deviceId(), ts: Date.now() });
            cb({ ok: true });
          } else {
            cb({ ok: false, error: (data && data.error) || "Chave inválida ou já usada em outro aparelho." });
          }
        })
        .catch(function () { cb({ ok: false, error: "Sem conexão com o servidor. Tente de novo." }); });
    } catch (e) { cb({ ok: false, error: "Falha ao validar. Tente de novo." }); }
  }

  // recupera a chave pelo e-mail da compra e já ativa (comprador nem vê a chave)
  function recoverByEmail(email, cb) {
    email = (email || "").trim();
    if (!email) { cb({ ok: false, error: "Digite o e-mail da compra." }); return; }
    if (!CONFIG.API) { cb({ ok: false, error: "Servidor não configurado." }); return; }
    var url = CONFIG.API.replace(/\/+$/, "") + "/key?email=" + encodeURIComponent(email);
    try {
      fetch(url).then(function (r) { return r.json().catch(function () { return { ok: false, error: "Resposta inválida." }; }); })
        .then(function (d) {
          if (d && d.ok && d.key) { activate(d.key, cb); }   // achou a compra -> ativa a chave automaticamente
          else { cb({ ok: false, error: (d && d.error) || "Nenhuma compra encontrada com esse e-mail." }); }
        })
        .catch(function () { cb({ ok: false, error: "Sem conexão com o servidor. Tente de novo." }); });
    } catch (e) { cb({ ok: false, error: "Falha ao recuperar. Tente de novo." }); }
  }

  // ponto central: navega para um modo, respeitando o cadeado
  function enter(route, params) {
    if (CONFIG.PAYWALL && isPaidRoute(route) && !isUnlocked()) {
      TM.ui.go("paywall", { route: route });
      return;
    }
    TM.ui.go(route, params);
  }

  TM.license = {
    config: CONFIG,
    deviceId: deviceId,
    isUnlocked: isUnlocked,
    isPaidRoute: isPaidRoute,
    activate: activate,
    recoverByEmail: recoverByEmail,
    enter: enter,
    state: state
  };

  /* ---------- tela de compra / ativação ---------- */
  if (TM.ui && TM.ui.register) {
    var el = TM.ui.el;
    TM.ui.register("paywall", function (screen, params) {
      screen.appendChild(TM.ui.topbar("Desbloquear o Total Match", function () { TM.ui.go("modes"); }));
      var wrap = el("div", { class: "pw-wrap" });

      wrap.appendChild(el("div", { class: "pw-hero" }, [
        el("img", { class: "pw-logo", src: (global.TM_LOGO || "assets/logo.png"), alt: "Total Match" }),
        el("div", { class: "pw-h1", text: "Desbloqueie o Total Match" }),
        el("div", { class: "pw-sub", text: "Acesso completo ao jogo" + (CONFIG.PRICE_LABEL ? " por " + CONFIG.PRICE_LABEL : "") + " — pagamento único." })
      ]));

      wrap.appendChild(el("div", { class: "pw-cols pw-cols-1" }, [
        el("div", { class: "pw-col pw-col-pro" }, [
          el("div", { class: "pw-col-h", text: "⭐ O que você recebe" + (CONFIG.PRICE_LABEL ? " · " + CONFIG.PRICE_LABEL : "") }),
          el("ul", { class: "pw-list" }, [
            el("li", { text: "Carreira de Treinador e de Dirigente" }),
            el("li", { text: "Partida Rápida e Competições (ligas, copas, seleções)" }),
            el("li", { text: "Modo Online com amigos" }),
            el("li", { text: "Dream Team, Draft, Grupo e Editor" }),
            el("li", { text: "Todas as atualizações futuras" })
          ])
        ])
      ]));

      // botão comprar
      var buy = el("button", { class: "btn primary big pw-buy", text: "🛒 Comprar agora" + (CONFIG.PRICE_LABEL ? " · " + CONFIG.PRICE_LABEL : ""), on: { click: function () {
        if (CONFIG.BUY_URL) { try { global.open(CONFIG.BUY_URL, "_blank"); } catch (e) { global.location.href = CONFIG.BUY_URL; } }
        else { TM.ui.toast("Link de compra ainda não configurado."); }
      } } });
      wrap.appendChild(buy);

      var msg = el("div", { class: "pw-msg" });
      function done(res, okText) {
        if (res.ok) {
          msg.className = "pw-msg ok"; msg.textContent = okText || "✔ Desbloqueado! Aproveite.";
          setTimeout(function () { TM.ui.go(params && params.route ? params.route : "modes"); }, 800);
        } else {
          msg.className = "pw-msg err"; msg.textContent = res.error || "Não foi possível desbloquear.";
        }
      }

      // ---- PRINCIPAL: já comprou? recupera pelo e-mail (sem precisar da chave) ----
      wrap.appendChild(el("div", { class: "pw-key-h", text: "Já comprou? Desbloqueie com seu e-mail" }));
      var mail = el("input", { class: "pw-input", type: "email", placeholder: "e-mail usado na compra", autocomplete: "email", spellcheck: "false" });
      var rec = el("button", { class: "btn primary pw-activate", text: "Desbloquear", on: { click: function () {
        msg.className = "pw-msg"; msg.textContent = "Buscando sua compra…"; rec.disabled = true;
        recoverByEmail(mail.value, function (res) { rec.disabled = false; done(res); });
      } } });
      mail.addEventListener("keydown", function (e) { if (e.key === "Enter") rec.click(); });
      wrap.appendChild(el("div", { class: "pw-key-row" }, [ mail, rec ]));

      // ---- SECUNDÁRIO: ativar por código (chave) ----
      var keyWrap = el("div", { class: "pw-alt" });
      var toggle = el("button", { class: "pw-alt-toggle", text: "Tenho um código de chave", on: { click: function () { keyWrap.classList.toggle("open"); } } });
      var input = el("input", { class: "pw-input", type: "text", placeholder: "TM-XXXX-XXXX-XXXX-XXXX", maxlength: "40", autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
      var act = el("button", { class: "btn pw-activate", text: "Ativar", on: { click: function () {
        msg.className = "pw-msg"; msg.textContent = "Validando…"; act.disabled = true;
        activate(input.value, function (res) { act.disabled = false; done(res); });
      } } });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") act.click(); });
      keyWrap.appendChild(el("div", { class: "pw-key-row" }, [ input, act ]));
      wrap.appendChild(toggle);
      wrap.appendChild(keyWrap);

      wrap.appendChild(msg);
      wrap.appendChild(el("div", { class: "pw-fine", text: "Funciona em 1 aparelho. Use o mesmo e-mail da compra (pode levar 1 min após pagar). Problemas? Suporte pelo Kiwify." }));

      screen.appendChild(wrap);
    });
  }
})(window);
