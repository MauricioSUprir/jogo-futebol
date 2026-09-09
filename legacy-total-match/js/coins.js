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
  var pending = 0;   // operações minhas em andamento na nuvem (o listener não trata como presente)
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
      if (v == null) { cloudRef.set(s.bal); }                       // primeira vez nesta conta: sobe o saldo local
      else if (typeof v === "number") { s.bal = v; save(); refreshBadges(); }   // nuvem manda: saldo da conta
      lastCloud = (v == null) ? s.bal : v;
      cloudHandler = function (sn) {
        var nv = sn.val(); if (typeof nv !== "number") return;
        var st = load();
        if (nv !== st.bal) {
          var d = nv - st.bal; st.bal = nv;
          if (pending === 0) {                                          // mudança que não veio de mim: presente/retirada do admin
            if (d > 0) { addLog(d, "Presente recebido"); st.earned += d; TM.ui.toast("Você recebeu " + fmt(d) + "! 🎁"); }
            else { addLog(d, "Retirado pelo administrador"); TM.ui.toast("Foram retirados " + fmt(-d) + " da sua conta."); }
          }
          save(); refreshBadges();
        }
        lastCloud = nv;
      };
      cloudRef.on("value", cloudHandler);
    }).catch(function () {});
  }
  // aplica um delta: a NUVEM é a verdade (transação); local só espelha (e serve offline)
  function applyDelta(delta) {
    var s = load();
    s.bal = Math.max(0, s.bal + delta); save(); refreshBadges();      // resposta imediata na tela
    if (!cloudReady() || !hasAccount()) return;
    try {
      var n = net(); pending++;
      n._db.ref("users/" + n.me.uid + "/coins").transaction(function (cur) { return Math.max(0, (typeof cur === "number" ? cur : START) + delta); }, function (err, committed, snap) {
        pending = Math.max(0, pending - 1);
        if (!err && committed && snap && typeof snap.val() === "number") { var st = load(); st.bal = snap.val(); save(); refreshBadges(); }
      });
    } catch (e) { pending = Math.max(0, pending - 1); }
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
      var s = load(); s.earned += n; addLog(n, reason || "Ganho"); applyDelta(n);
      TM.ui.toast("+" + n + " 🪙 " + (reason || ""));
    },
    spend: function (n, reason) {
      var s = load();
      if (!hasAccount() || s.bal < n) return false;
      s.spent += n; addLog(-n, reason || "Gasto"); applyDelta(-n);
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
    // admin: dá (amount > 0) ou tira (amount < 0) coins de uma conta pelo número (ex.: 1234-5678)
    give: function (number, amount, note, cb) {
      if (!coins.isAdmin()) { cb && cb(false, "Só o administrador pode mexer nos coins."); return; }
      if (!cloudReady()) { cb && cb(false, "Sem conexão com a nuvem."); return; }
      amount = Math.round(Number(amount) || 0);
      if (!amount) { cb && cb(false, "Quantidade inválida."); return; }
      var n = net();
      n._db.ref("numbers/" + String(number || "").trim()).once("value").then(function (snap) {
        var uid = snap.val();
        if (!uid) { cb && cb(false, "Conta não encontrada."); return; }
        var ref = n._db.ref("users/" + uid + "/coins"), after = null;
        return ref.transaction(function (cur) { return Math.max(0, (typeof cur === "number" ? cur : START) + amount); }, function (err, committed, sn) {
          if (err || !committed) { cb && cb(false, "Falha ao aplicar."); return; }
          after = sn ? sn.val() : null;
          logCloud(uid, { t: Date.now(), d: amount, r: note || (amount > 0 ? "Presente de " + (n.me.name || "admin") : "Retirado pelo administrador"), from: n.me.number || null });
          // se for a minha própria conta, o listener já atualiza o saldo local; nada a somar aqui
          cb && cb(true, (amount > 0 ? "Dado " + fmt(amount) : "Retirado " + fmt(-amount)) + " · conta " + number + " agora tem " + (after != null ? after + " 🪙" : "novo saldo") + ".");
        });
      }).catch(function () { cb && cb(false, "Falha ao aplicar."); });
    },
    // admin: lista todas as contas do jogo (e-mail, nome, número, coins, online)
    listAccounts: function (cb) {
      if (!coins.isAdmin()) { cb([], "Só o administrador."); return; }
      if (!cloudReady()) { cb([], "Sem conexão com a nuvem."); return; }
      var n = net(), db = n._db;
      Promise.all([db.ref("accounts").once("value"), db.ref("users").once("value")]).then(function (r) {
        var accts = r[0].val() || {}, users = r[1].val() || {}, out = [], seen = {};
        Object.keys(accts).forEach(function (k) {
          var a = accts[k] || {}; var u = (a.onlineUid && users[a.onlineUid]) || {};
          var num = a.onlineNumber || u.number || null;
          out.push({ email: a.email || k.replace(/,/g, "."), name: a.name || u.name || "Jogador", number: num, uid: a.onlineUid || null, coins: (typeof u.coins === "number") ? u.coins : null, online: !!u.online, lastSeen: u.lastSeen || a.createdAt || 0, account: true });
          if (a.onlineUid) seen[a.onlineUid] = true;
        });
        Object.keys(users).forEach(function (uid) {
          if (seen[uid]) return; var u = users[uid] || {};
          if (!u.number) return;
          out.push({ email: null, name: u.name || "Jogador", number: u.number, uid: uid, coins: (typeof u.coins === "number") ? u.coins : null, online: !!u.online, lastSeen: u.lastSeen || 0, account: false });
        });
        out.sort(function (x, y) { return (y.online - x.online) || ((y.lastSeen || 0) - (x.lastSeen || 0)); });
        cb(out, null);
      }).catch(function (e) { cb([], "Sem permissão para ler a lista (regras do banco)."); });
    },
    // admin: exclui uma conta PARA SEMPRE (conta, identidade online, número, ranking) e bloqueia o e-mail
    deleteAccount: function (entry, cb) {
      if (!coins.isAdmin()) { cb(false, "Só o administrador."); return; }
      if (!cloudReady()) { cb(false, "Sem conexão com a nuvem."); return; }
      var n = net(), db = n._db, upd = {};
      if (entry.uid && n.me && entry.uid === n.me.uid) { cb(false, "Não dá para excluir a própria conta por aqui."); return; }
      var key = entry.email ? n.acctKey(entry.email) : null;
      if (key) { upd["accounts/" + key] = null; upd["banned/" + key] = { email: entry.email, number: entry.number || null, uid: entry.uid || null, t: Date.now(), by: n.me.number || null }; }
      if (entry.uid) { upd["users/" + entry.uid] = null; upd["ranking/" + entry.uid] = null; }
      if (entry.number) { upd["numbers/" + entry.number] = null; upd["bannedNumbers/" + entry.number] = true; }
      db.ref().update(upd).then(function () { cb(true, "Conta excluída para sempre" + (entry.email ? " e e-mail bloqueado" : "") + "."); }).catch(function () { cb(false, "Falha ao excluir (regras do banco)."); });
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

    var adminRef = null;
    if (coins.isAdmin()) { adminRef = adminPanel(); body.appendChild(adminRef); }

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
    if (coins.isAdmin() && adminRef) {
      body.appendChild(el("div", { class: "list-head", text: "👑 Gerenciar contas" }));
      var acc = accountsPanel(adminRef._numIn, adminRef._info, adminRef._setFound);
      body.appendChild(acc);
      setTimeout(function () { var lb = acc.querySelector(".btn"); if (lb) lb.click(); }, 50);   // carrega sozinho
    }

    function stat(lbl, v, sub) { return el("div", { class: "coin-stat" }, [ el("div", { class: "coin-stat-v", text: String(v) }), el("div", { class: "coin-stat-l", text: lbl }), el("div", { class: "coin-stat-s", text: sub }) ]); }
    function rule(ic, txt, val) { return el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: ic }), el("span", { class: "coin-rule-tx", text: txt }), el("span", { class: "coin-rule-v", text: val }) ]); }
  });

  function adminPanel() {
    var box = el("div", { class: "coin-admin" });
    box.appendChild(el("div", { class: "list-head", text: "👑 Administrador · dar Total Coins" }));
    var numIn = el("input", { class: "select", type: "text", placeholder: "número da conta (ex.: 1234-5678)", maxlength: "12" });
    var amtIn = el("input", { class: "select", type: "number", placeholder: "quantidade (só o número)", min: "1", step: "1" });
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
    function doOp(sign) {
      var num = numIn.value.trim(), amt = Math.abs(Math.round(Number(amtIn.value) || 0));
      if (!num || !amt) { TM.ui.toast("Informe o número da conta e a quantidade."); return; }
      var verb = sign > 0 ? "Dar" : "Tirar";
      TM.ui.confirm(verb + " " + fmt(amt) + "?", (sign > 0 ? "Para" : "Da") + " conta " + num + (found ? " (" + found.name + ")" : "") + ".", verb, function () {
        sendBtn.disabled = true; takeBtn.disabled = true;
        coins.give(num, sign * amt, noteIn.value.trim() || null, function (ok, msg) {
          sendBtn.disabled = false; takeBtn.disabled = false; info.textContent = msg; TM.ui.toast(ok ? (sign > 0 ? "Coins enviados! 🎁" : "Coins retirados.") : msg);
        });
      }, sign < 0);
    }
    var sendBtn = TM.ui.button("🎁 Dar coins", function () { doOp(1); }, "btn primary");
    var takeBtn = TM.ui.button("➖ Tirar coins", function () { doOp(-1); }, "btn ghost");
    box.appendChild(el("div", { class: "coin-admin-form" }, [ numIn, findBtn, amtIn, noteIn, el("div", { class: "coin-admin-btns" }, [ sendBtn, takeBtn ]) ]));
    box.appendChild(info);
    box._numIn = numIn; box._info = info; box._setFound = function (f) { found = f; };
    return box;
  }

  function accountsPanel(numIn, info, setFound) {
    var box = el("div", { class: "coin-admin coin-accounts" });
    // ---- diretório de contas ----
    box.appendChild(el("div", { class: "list-head", text: "👥 Contas do jogo" }));
    var dirInfo = el("div", { class: "setting-hint", text: "Todas as contas cadastradas, com número, coins e quem está online." });
    var dirSearch = el("input", { class: "select", type: "text", placeholder: "buscar por nome, e-mail ou número…" });
    var dirList = el("div", { class: "coin-dir" }); var dirData = []; var showAnon = false;
    function renderDir() {
      TM.ui.clear(dirList);
      var q = (dirSearch.value || "").toLowerCase().trim(), shown = 0;
      dirData.forEach(function (a) {
        if (!showAnon && !a.account) return;
        if (q && [a.name, a.email, a.number].join(" ").toLowerCase().indexOf(q) < 0) return;
        shown++;
        dirList.appendChild(el("div", { class: "coin-dir-row" + (a.online ? " on" : "") }, [
          el("span", { class: "coin-dir-dot" }),
          el("div", { class: "coin-dir-main" }, [
            el("div", { class: "coin-dir-name", text: a.name + (a.account ? "" : " · sem conta") }),
            el("div", { class: "coin-dir-sub", text: (a.email ? a.email + " · " : "") + (a.number ? "nº " + a.number : "sem número") })
          ]),
          el("div", { class: "coin-dir-coins", text: a.coins != null ? a.coins + " 🪙" : "—" }),
          el("div", { class: "coin-dir-acts" }, [
            a.number ? el("button", { class: "acct-copy", text: "🪙 usar", on: { click: function () { numIn.value = a.number; setFound({ uid: a.uid, name: a.name, coins: a.coins }); info.textContent = "✅ " + a.name + " · conta " + a.number + (a.coins != null ? " · saldo " + a.coins + " 🪙" : ""); try { numIn.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} } } }) : el("span"),
            el("button", { class: "acct-copy danger", text: "🗑 excluir", on: { click: function () {
              TM.ui.confirm("Excluir " + a.name + "?", "Apaga a conta PARA SEMPRE: perfil, número " + (a.number || "") + ", coins e amigos. O e-mail " + (a.email || "") + " fica bloqueado e não consegue criar conta de novo.", "Excluir para sempre", function () {
                TM.ui.confirm("Tem certeza?", "Não dá para desfazer.", "Sim, excluir", function () {
                  coins.deleteAccount(a, function (ok, msg) { TM.ui.toast(msg); if (ok) { dirData = dirData.filter(function (x) { return x !== a; }); renderDir(); } });
                }, true);
              }, true);
            } } })
          ])
        ]));
      });
      var total = dirData.filter(function (a) { return a.account; }).length, onl = dirData.filter(function (a) { return a.account && a.online; }).length;
      dirInfo.textContent = total + " conta(s) cadastrada(s) · " + onl + " online agora" + (shown < total ? " · mostrando " + shown : "");
    }
    var loadBtn = TM.ui.button("🔄 Carregar contas", function () {
      loadBtn.disabled = true; dirInfo.textContent = "Carregando…";
      coins.listAccounts(function (list, err) {
        loadBtn.disabled = false;
        if (err) { dirInfo.textContent = err; return; }
        dirData = list; renderDir();
      });
    }, "btn ghost small");
    var anonBtn = TM.ui.button("Mostrar aparelhos sem conta", function () { showAnon = !showAnon; anonBtn.textContent = showAnon ? "Esconder aparelhos sem conta" : "Mostrar aparelhos sem conta"; renderDir(); }, "btn ghost small");
    dirSearch.addEventListener("input", renderDir);
    box.appendChild(el("div", { class: "coin-admin-btns" }, [ loadBtn, anonBtn ]));
    box.appendChild(dirInfo); box.appendChild(dirSearch); box.appendChild(dirList);
    return box;
  }
})(window);
