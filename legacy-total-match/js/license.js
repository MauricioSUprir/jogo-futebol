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
    PAYWALL: false,                                   // <<< liga/desliga o cadeado (ligue após configurar o Kiwify)
    API: "https://tm-license.onrender.com",           // servidor de licenças (Render) — já no ar
    BUY_URL: "",                                      // <<< COLE aqui o link do produto no Kiwify
    PRICE_LABEL: "R$ 9,90",                           // texto na tela (ajuste se mudar o preço no Kiwify)
    // modos LIBERADOS na demonstração (o resto pede a chave)
    FREE_ROUTES: { quick: 1, compmode: 1, settings: 1, profile: 1, saves: 1, competicoes: 1 },
    // modos que EXIGEM compra
    PAID_ROUTES: { coach: 1, online: 1, dream: 1, draft: 1, groupcomp: 1, editor: 1 }
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
        el("div", { class: "pw-h1", text: "Versão completa" }),
        el("div", { class: "pw-sub", text: "Você está na demonstração. Desbloqueie o jogo completo com uma chave." })
      ]));

      wrap.appendChild(el("div", { class: "pw-cols" }, [
        el("div", { class: "pw-col" }, [
          el("div", { class: "pw-col-h", text: "🎮 Grátis (demo)" }),
          el("ul", { class: "pw-list" }, [
            el("li", { text: "Partida Rápida" }),
            el("li", { text: "Competições (ligas, copas, seleções)" })
          ])
        ]),
        el("div", { class: "pw-col pw-col-pro" }, [
          el("div", { class: "pw-col-h", text: "⭐ Completo" + (CONFIG.PRICE_LABEL ? " · " + CONFIG.PRICE_LABEL : "") }),
          el("ul", { class: "pw-list" }, [
            el("li", { text: "Carreira de Treinador e de Dirigente" }),
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

      // ativação de chave
      wrap.appendChild(el("div", { class: "pw-key-h", text: "Já comprou? Ative sua chave" }));
      var input = el("input", { class: "pw-input", type: "text", placeholder: "TM-XXXX-XXXX-XXXX-XXXX", maxlength: "40", autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
      var msg = el("div", { class: "pw-msg" });
      var act = el("button", { class: "btn pw-activate", text: "Ativar", on: { click: function () {
        msg.className = "pw-msg"; msg.textContent = "Validando…"; act.disabled = true;
        activate(input.value, function (res) {
          act.disabled = false;
          if (res.ok) {
            msg.className = "pw-msg ok"; msg.textContent = "✔ Desbloqueado! Aproveite.";
            setTimeout(function () { TM.ui.go(params && params.route ? params.route : "modes"); }, 800);
          } else {
            msg.className = "pw-msg err"; msg.textContent = res.error || "Não foi possível ativar.";
          }
        });
      } } });
      wrap.appendChild(el("div", { class: "pw-key-row" }, [ input, act ]));
      wrap.appendChild(msg);
      wrap.appendChild(el("div", { class: "pw-fine", text: "A chave funciona em 1 aparelho. Problemas? Fale com o suporte pelo Kiwify." }));

      screen.appendChild(wrap);
    });
  }
})(window);
