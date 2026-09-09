/* ================= TOTAL MATCH — Total Coins (🪙) ================= */
/* Moeda do jogo: ganha em desafios (Draft / Dream Team), gasta pra entrar no
   Draft e pra ter uma 2ª chance quando perde. Saldo espelhado na nuvem
   (users/{uid}/coins) quando o Firebase está disponível; offline funciona
   com o saldo local. Admin (e-mail abaixo) pode presentear qualquer conta
   pelo número dela. Compartilhado entre as duas edições (chave global). */
(function (global) {
  "use strict";
  var TM = global.TM, el = TM.ui.el;

  var KEY_BASE = "totalmatch:coins:";      // uma carteira por CONTA (e-mail); sem conta, sem coins
  function acctId() {
    try { var p = TM.account && TM.account.profile ? TM.account.profile() : null; return (p && p.email) ? String(p.email).toLowerCase().trim() : null; } catch (e) { return null; }
  }
  function KEY() { var a = acctId(); return a ? KEY_BASE + a : null; }
  var stateAcct = null;   // conta a que o estado carregado pertence
  var ADMIN_EMAILS = ["mauricio@gruposuprir.com", "gui.drodrigues21@gmail.com", "gui.drodrigues21@gnail.com"];
  var START = 100;
  var COST = { draftEntry: 20, draftRetry: 30, draftReroll: 5, dreamBudget: 25, scoutRush: 10, sponsorRenew: 20, morale: 15, goldFrame: 50 };
  var REWARD = {
    draft: { win: 15, draw: 5, final: 40, champion: 100 },
    dream: { win: 6, draw: 2, final: 15, champion: 40 }
  };

  var state = null;   // { bal, earned, spent, best, log:[{t,d,r}], uid }
  var cloudRef = null, cloudUid = null, cloudHandler = null, lastCloud = null;

  function load() {
    var a = acctId();
    if (!a) { state = { bal: 0, earned: 0, spent: 0, best: 0, log: [], none: true }; stateAcct = null; return state; }
    if (state && stateAcct === a && !state.none) return state;
    try { var raw = localStorage.getItem(KEY()); state = raw ? JSON.parse(raw) : null; } catch (e) { state = null; }
    if (!state || typeof state.bal !== "number") state = { bal: START, earned: START, spent: 0, best: 0, log: [{ t: Date.now(), d: START, r: "Bônus de boas-vindas" }] };
    if (!state.log) state.log = [];
    stateAcct = a; return state;
  }
  function save() { var k = KEY(); if (!k || !state || state.none) return; try { localStorage.setItem(k, JSON.stringify(state)); } catch (e) {} }
  function hasAccount() { return !!acctId(); }
  function needAccount(what) {
    TM.ui.confirm("Precisa de uma conta", (what || "Total Coins e o Draft") + " são por conta: cada pessoa tem o seu saldo. Entre ou crie a sua conta no Perfil.", "Ir para o Perfil", function () { TM.ui.go("profile"); });
  }
  function fmt(n) { return (n < 0 ? "−" : "") + Math.abs(n) + " 🪙"; }
  function addLog(d, r) { var s = load(); s.log.unshift({ t: Date.now(), d: d, r: r }); if (s.log.length > 60) s.log.length = 60; }

  function net() { return TM.net || null; }
  function cloudReady() { var n = net(); return !!(n && n.ready && n.me && n._db); }

  // ---- nuvem: users/{uid}/coins é a verdade quando existe ----
  function detach() {
    if (cloudRef && cloudHandler) { try { cloudRef.off("value", cloudHandler); } catch (e) {} }
    cloudRef = null; cloudHandler = null; cloudUid = null; lastCloud = null;
  }
  function attach() {
    if (!cloudReady() || !hasAccount()) return;
    var n = net(), uid = n.me.uid;
    if (cloudUid === uid) return;
    detach();
    cloudUid = uid;
    cloudRef = n._db.ref("users/" + uid + "/coins");
    cloudRef.once("value").then(function (snap) {
      var v = snap.val();
      var s = load();
      if (v == null) { cloudRef.set(s.bal); }           // primeira vez: sobe o saldo local
      else if (typeof v === "number" && v !== s.bal) {     // conta vinda de outro aparelho / presente
        var diff = v - s.bal; s.bal = v;
        if (diff > 0 && lastCloud != null) addLog(diff, "Recebido");
        save(); refreshBadges();
      }
      lastCloud = v == null ? s.bal : v;
      cloudHandler = function (sn) {
        var nv = sn.val(); if (typeof nv !== "number") return;
        var st = load();
        if (nv !== st.bal) {
          var d = nv - st.bal; st.bal = nv;
          if (d > 0) { addLog(d, "Presente recebido"); st.earned += d; TM.ui.toast("Você recebeu " + fmt(d) + "! 🎁"); }
          save(); refreshBadges();
        }
        lastCloud = nv;
      };
      cloudRef.on("value", cloudHandler);
    }).catch(function () {});
  }
  function pushCloud(delta) {
    if (!cloudReady()) return;
    try {
      var n = net();
      n._db.ref("users/" + n.me.uid + "/coins").transaction(function (cur) { return (typeof cur === "number" ? cur : START) + delta; });
    } catch (e) {}
  }
  function logCloud(uid, entry) {
    if (!cloudReady()) return;
    try { net()._db.ref("users/" + uid + "/coinLog").push(entry); } catch (e) {}
  }

  // ---- API ----
  var coins = {
    COST: COST, REWARD: REWARD, START: START,
    balance: function () { return load().bal; },
    state: function () { return load(); },
    fmt: fmt,
    canPay: function (n) { return load().bal >= n; },
    hasAccount: hasAccount,
    earn: function (n, reason) {
      if (!n || n <= 0 || !hasAccount()) return;
      var s = load(); s.bal += n; s.earned += n; addLog(n, reason || "Ganho"); save();
      pushCloud(n); refreshBadges();
      TM.ui.toast("+" + n + " 🪙 " + (reason || ""));
    },
    spend: function (n, reason) {
      var s = load();
      if (!hasAccount() || s.bal < n) return false;
      s.bal -= n; s.spent += n; addLog(-n, reason || "Gasto"); save();
      pushCloud(-n); refreshBadges();
      return true;
    },
    // tenta pagar; se não der, mostra aviso e abre a tela de coins
    pay: function (n, reason, onOk) {
      if (!hasAccount()) { needAccount(); return false; }
      if (coins.spend(n, reason)) { onOk && onOk(); return true; }
      TM.ui.confirm("Total Coins insuficientes", "Você tem " + fmt(load().bal) + " e precisa de " + fmt(n) + ". Ganhe coins vencendo desafios (Draft e Dream Team).", "Ver meus coins", function () { TM.ui.go("coins"); });
      return false;
    },
    noteStreak: function (n) { var s = load(); if (n > (s.best || 0)) { s.best = n; save(); } },
    sync: attach,
    isAdmin: function () {
      var p = (TM.account && TM.account.profile) ? TM.account.profile() : null;
      return !!(p && p.email && ADMIN_EMAILS.indexOf(String(p.email).toLowerCase().trim()) >= 0);
    },
    // admin: dá coins a uma conta pelo número (ex.: 1234-5678)
    give: function (number, amount, note, cb) {
      if (!coins.isAdmin()) { cb && cb(false, "Só o administrador pode dar coins."); return; }
      if (!cloudReady()) { cb && cb(false, "Sem conexão com a nuvem."); return; }
      amount = Math.round(Number(amount) || 0);
      if (!amount) { cb && cb(false, "Quantidade inválida."); return; }
      var n = net();
      n._db.ref("numbers/" + String(number || "").trim()).once("value").then(function (snap) {
        var uid = snap.val();
        if (!uid) { cb && cb(false, "Conta não encontrada."); return; }
        return n._db.ref("users/" + uid + "/coins").transaction(function (cur) { return (typeof cur === "number" ? cur : START) + amount; }).then(function () {
          logCloud(uid, { t: Date.now(), d: amount, r: note || ("Presente de " + (n.me.name || "admin")), from: n.me.number || null });
          if (uid === n.me.uid) { var s = load(); s.bal += amount; addLog(amount, note || "Presente"); save(); refreshBadges(); }
          cb && cb(true, "Enviado " + fmt(amount) + " para a conta " + number + ".");
        });
      }).catch(function () { cb && cb(false, "Falha ao enviar."); });
    },
    badge: function (cls) {
      var has = hasAccount();
      var b = el("button", { class: "coin-badge " + (cls || "") + (has ? "" : " nocct"), title: has ? "Total Coins" : "Entre na conta para ter Total Coins", on: { click: function () { TM.ui.go("coins"); } } }, [
        el("span", { class: "coin-ic", text: "🪙" }), el("span", { class: "coin-val", text: has ? String(load().bal) : "—" })
      ]);
      return b;
    }
  };
  TM.coins = coins;

  function refreshBadges() {
    var v = hasAccount() ? String(load().bal) : "—";
    var els = document.querySelectorAll(".coin-badge .coin-val"); for (var i = 0; i < els.length; i++) els[i].textContent = v;
  }

  // sincroniza quando a rede fica pronta e quando a conta é vinculada/desvinculada
  try {
    var N = net();
    if (N) {
      N.onReady(function () { attach(); });
      if (N.linkAccount) { var _link = N.linkAccount; N.linkAccount = function (l) { _link(l); state = null; stateAcct = null; detach(); setTimeout(function () { attach(); refreshBadges(); }, 300); }; }
      if (N.unlinkAccount) { var _unlink = N.unlinkAccount; N.unlinkAccount = function () { _unlink(); state = null; stateAcct = null; detach(); refreshBadges(); }; }
    }
  } catch (e) {}

  // ---- Tela: meus coins ----
  TM.ui.register("coins", function (screen) {
    var s = load();
    screen.appendChild(TM.ui.topbar("🪙 Total Coins", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    if (!hasAccount()) {
      body.appendChild(el("div", { class: "coin-hero" }, [
        el("div", { class: "coin-hero-lbl", text: "Total Coins" }),
        el("div", { class: "coin-hero-val", text: "🔒" }),
        el("div", { class: "coin-hero-sub", text: "Cada conta tem o seu saldo. Para ter Total Coins e jogar o Draft, entre ou crie a sua conta." })
      ]));
      body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("👤 Entrar / criar conta", function () { TM.ui.go("profile"); }, "btn primary") ]));
      body.appendChild(el("div", { class: "list-head", text: "Como funciona" }));
      body.appendChild(el("div", { class: "coin-rules" }, [
        el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: "🎁" }), el("span", { class: "coin-rule-tx", text: "Conta nova começa com " + START + " 🪙" }), el("span", { class: "coin-rule-v", text: "+" + START }) ]),
        el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: "🎲" }), el("span", { class: "coin-rule-tx", text: "Entrar no Draft" }), el("span", { class: "coin-rule-v", text: "−" + COST.draftEntry + " 🪙" }) ]),
        el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: "✔" }), el("span", { class: "coin-rule-tx", text: "Vitória no Draft" }), el("span", { class: "coin-rule-v", text: "+" + REWARD.draft.win + " 🪙" }) ])
      ]));
      return;
    }

    var n = net(), num = (n && n.me && n.me.number) ? n.me.number : null;
    body.appendChild(el("div", { class: "coin-hero" }, [
      el("div", { class: "coin-hero-lbl", text: "Seu saldo" }),
      el("div", { class: "coin-hero-val", text: s.bal + " 🪙" }),
      el("div", { class: "coin-hero-sub", text: (num ? "Conta nº " + num + " · " : "") + (cloudReady() ? "sincronizado na nuvem" : "salvo neste aparelho") })
    ]));
    body.appendChild(el("div", { class: "coin-stats" }, [
      stat("Total Points", s.earned, "ganhos na vida"), stat("Gastos", s.spent, "em entradas e 2ª chances"), stat("Melhor sequência", s.best || 0, "vitórias seguidas no Draft")
    ]));

    body.appendChild(el("div", { class: "list-head", text: "Como funciona" }));
    body.appendChild(el("div", { class: "coin-rules" }, [
      rule("🎲", "Entrar no Draft", "−" + COST.draftEntry + " 🪙"),
      rule("🔁", "2ª chance após perder no Draft", "−" + COST.draftRetry + " 🪙"),
      rule("✔", "Vitória no Draft / Dream Team", "+" + REWARD.draft.win + " / +" + REWARD.dream.win + " 🪙"),
      rule("=", "Empate no Draft / Dream Team", "+" + REWARD.draft.draw + " / +" + REWARD.dream.draw + " 🪙"),
      rule("👑", "Derrubar o time principal", "+" + REWARD.draft.final + " / +" + REWARD.dream.final + " 🪙"),
      rule("🏆", "Campeão invicto (6 vitórias)", "+" + REWARD.draft.champion + " / +" + REWARD.dream.champion + " 🪙")
    ]));
    body.appendChild(el("div", { class: "list-head", text: "Onde gastar" }));
    body.appendChild(el("div", { class: "coin-rules" }, [
      rule("🎲", "Draft: sortear mais 5 opções (depois do sorteio grátis)", "−" + COST.draftReroll + " 🪙"),
      rule("💎", "Dream Team: +10% de orçamento", "−" + COST.dreamBudget + " 🪙"),
      rule("🔭", "Master League: olheiro entrega a missão agora", "−" + COST.scoutRush + " 🪙"),
      rule("🤝", "Master League: novas propostas de patrocínio", "−" + COST.sponsorRenew + " 🪙"),
      rule("🔥", "Master League: motivação extra para o elenco", "−" + COST.morale + " 🪙"),
      rule("🥇", "Perfil: moldura dourada na foto", "−" + COST.goldFrame + " 🪙")
    ]));

    if (coins.isAdmin()) body.appendChild(adminPanel());

    body.appendChild(el("div", { class: "list-head", text: "Histórico" }));
    var hist = el("div", { class: "coin-log" });
    if (!s.log.length) hist.appendChild(el("div", { class: "setting-hint", text: "Nada ainda." }));
    s.log.slice(0, 40).forEach(function (L) {
      hist.appendChild(el("div", { class: "coin-log-row" }, [
        el("span", { class: "coin-log-r", text: L.r }),
        el("span", { class: "coin-log-t", text: new Date(L.t).toLocaleDateString("pt-BR") }),
        el("span", { class: "coin-log-d " + (L.d >= 0 ? "pos" : "neg"), text: (L.d >= 0 ? "+" : "−") + Math.abs(L.d) })
      ]));
    });
    body.appendChild(hist);

    function stat(lbl, v, sub) { return el("div", { class: "coin-stat" }, [ el("div", { class: "coin-stat-v", text: String(v) }), el("div", { class: "coin-stat-l", text: lbl }), el("div", { class: "coin-stat-s", text: sub }) ]); }
    function rule(ic, txt, val) { return el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: ic }), el("span", { class: "coin-rule-tx", text: txt }), el("span", { class: "coin-rule-v", text: val }) ]); }
  });

  function adminPanel() {
    var box = el("div", { class: "coin-admin" });
    box.appendChild(el("div", { class: "list-head", text: "👑 Administrador · dar Total Coins" }));
    var numIn = el("input", { class: "select", type: "text", placeholder: "número da conta (ex.: 1234-5678)", maxlength: "12" });
    var amtIn = el("input", { class: "select", type: "number", placeholder: "quantidade", min: "1", step: "1" });
    var noteIn = el("input", { class: "select", type: "text", placeholder: "mensagem (opcional)", maxlength: "40" });
    var info = el("div", { class: "setting-hint", text: "Digite o número da conta e clique em buscar para confirmar o nome." });
    var found = null;
    var findBtn = TM.ui.button("🔎 Buscar conta", function () {
      var n = net(); if (!cloudReady()) { info.textContent = "Sem conexão com a nuvem."; return; }
      var num = numIn.value.trim(); if (!num) return;
      info.textContent = "Buscando…";
      n._db.ref("numbers/" + num).once("value").then(function (snap) {
        var uid = snap.val(); if (!uid) { found = null; info.textContent = "Conta " + num + " não encontrada."; return; }
        return n._db.ref("users/" + uid).once("value").then(function (s2) {
          var v = s2.val() || {}; found = { uid: uid, name: v.name || "Jogador", coins: typeof v.coins === "number" ? v.coins : null };
          info.textContent = "✅ " + found.name + " · conta " + num + (found.coins != null ? " · saldo atual " + found.coins + " 🪙" : " · sem saldo na nuvem ainda");
        });
      }).catch(function () { info.textContent = "Falha ao buscar."; });
    }, "btn ghost");
    var sendBtn = TM.ui.button("🎁 Enviar coins", function () {
      var num = numIn.value.trim(), amt = Math.round(Number(amtIn.value) || 0);
      if (!num || !amt) { TM.ui.toast("Informe o número da conta e a quantidade."); return; }
      TM.ui.confirm("Enviar " + fmt(amt) + "?", "Para a conta " + num + (found ? " (" + found.name + ")" : "") + ".", "Enviar", function () {
        sendBtn.disabled = true;
        coins.give(num, amt, noteIn.value.trim() || null, function (ok, msg) {
          sendBtn.disabled = false; info.textContent = msg; TM.ui.toast(ok ? "Enviado! 🎁" : msg);
        });
      });
    }, "btn primary");
    box.appendChild(el("div", { class: "coin-admin-form" }, [ numIn, findBtn, amtIn, noteIn, sendBtn ]));
    box.appendChild(info);
    return box;
  }
})(window);
