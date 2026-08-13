/* ================= TOTAL MATCH — Camada de rede (Firebase) ================= */
/* Contas anônimas + número único, amigos, presença online, chat, convites e
   partida online sincronizada. Tudo opcional: se o Firebase não carregar
   (offline ou SDK indisponível), TM.net.available fica false e o resto do
   jogo continua funcionando normalmente. */
(function (global) {
  "use strict";
  var TM = global.TM;

  // Config pública do projeto (essas chaves são públicas por design).
  var CONFIG = {
    apiKey: "AIzaSyB_v-lSVrc5Jq4KTWxn-WPM5_OH7JXM780",
    authDomain: "total-match-af5e1.firebaseapp.com",
    databaseURL: "https://total-match-af5e1-default-rtdb.firebaseio.com",
    projectId: "total-match-af5e1",
    storageBucket: "total-match-af5e1.firebasestorage.app",
    messagingSenderId: "593024311369",
    appId: "1:593024311369:web:eff64ffea6b97b18469f98"
  };

  var net = {
    available: false, ready: false, me: null, error: null,
    _db: null, _auth: null, _cbReady: [], _invite: null, _onInvite: null
  };

  // === E-mail de segurança (EmailJS) — avisa a pessoa quando cadastra/entra ===
  // Preencha os 3 códigos abaixo com os da sua conta EmailJS (emailjs.com):
  //  1) crie conta grátis  2) conecte um serviço de e-mail (ex.: Gmail)
  //  3) crie um Template com as variáveis {{to_email}} {{to_name}} {{action}} {{when}}
  // Depois cole: Service ID, Template ID e Public Key. Vazio = desligado (não envia nada).
  var EMAILJS = { serviceId: "", templateId: "", publicKey: "" };
  net.emailConfigured = function () { return !!(EMAILJS.serviceId && EMAILJS.templateId && EMAILJS.publicKey); };
  // envia um aviso "foi você?" para o e-mail informado (silencioso; nunca quebra o fluxo)
  net.sendAuthEmail = function (email, name, action) {
    if (!net.emailConfigured() || !email) return;
    try {
      var when = new Date().toLocaleString("pt-BR");
      global.fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: EMAILJS.serviceId, template_id: EMAILJS.templateId, user_id: EMAILJS.publicKey,
          template_params: {
            to_email: email, to_name: name || email,
            action: action === "signup" ? "criou uma conta" : "entrou na conta",
            action_short: action === "signup" ? "cadastro" : "login",
            when: when, app_name: "Total Match"
          }
        })
      }).catch(function () {});
    } catch (e) {}
  };

  function hasSDK() { return typeof global.firebase !== "undefined" && global.firebase.initializeApp; }

  function genNumber() {
    var a = Math.floor(1000 + Math.random() * 9000);
    var b = Math.floor(1000 + Math.random() * 9000);
    return a + "-" + b;
  }
  function localName() { try { return localStorage.getItem("tm_online_name") || ""; } catch (e) { return ""; } }
  function saveLocalName(n) { try { localStorage.setItem("tm_online_name", n); } catch (e) {} }
  // identidade online vinculada a uma conta (mesmo nº/amigos em qualquer aparelho)
  function linkedIdentity() { try { var s = localStorage.getItem("tm_link"); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function saveLink(obj) { try { if (obj) localStorage.setItem("tm_link", JSON.stringify(obj)); else localStorage.removeItem("tm_link"); } catch (e) {} }

  // ---- inicialização ----
  net.init = function () {
    if (net._inited) return;
    net._inited = true;
    if (!hasSDK()) { net.available = false; net.error = "SDK do Firebase não carregou (sem internet?)."; return; }
    try {
      global.firebase.initializeApp(CONFIG);
      net._auth = global.firebase.auth();
      net._db = global.firebase.database();
      net.available = true;
      net._auth.onAuthStateChanged(function (user) {
        if (user) { onSignedIn(user.uid); }
      });
      net._auth.signInAnonymously().catch(function (e) { net.error = e.message; });
    } catch (e) { net.available = false; net.error = e.message; }
  };

  function onSignedIn(uid) {
    var db = net._db;
    // se há uma conta vinculada, adota a identidade dela (número/amigos portáteis)
    var link = linkedIdentity();
    if (link && link.uid) {
      var lname = link.name || localName() || "Jogador";
      db.ref("users/" + link.uid).update({ name: lname, number: link.number || null });
      finishReady(link.uid, link.number, lname);
      return;
    }
    var uref = db.ref("users/" + uid);
    uref.once("value").then(function (snap) {
      var v = snap.val() || {};
      var name = v.name || localName() || "Jogador";
      if (!v.number) {
        claimNumber(uid, function (number) {
          uref.update({ number: number, name: name, createdAt: firebaseNow() });
          finishReady(uid, number, name);
        });
      } else {
        uref.update({ name: name });
        finishReady(uid, v.number, name);
      }
    });
  }

  function claimNumber(uid, cb, tries) {
    tries = tries || 0;
    if (tries > 8) { cb(genNumber()); return; }
    var number = genNumber();
    var nref = net._db.ref("numbers/" + number);
    nref.transaction(function (cur) {
      if (cur === null) return uid;
      return; // abortar (já existe)
    }, function (err, committed) {
      if (!err && committed) cb(number);
      else claimNumber(uid, cb, tries + 1);
    });
  }

  function firebaseNow() { return global.firebase.database.ServerValue.TIMESTAMP; }

  function finishReady(uid, number, name) {
    net.me = { uid: uid, number: number, name: name };
    net.ready = true;
    setupPresence(uid);
    listenInvites(uid);
    var cbs = net._cbReady.slice(); net._cbReady = [];
    cbs.forEach(function (cb) { try { cb(net.me); } catch (e) {} });
  }

  net.onReady = function (cb) {
    if (net.ready) { cb(net.me); return; }
    net._cbReady.push(cb);
    net.init();
  };

  // ---- presença online ----
  function setupPresence(uid) {
    var db = net._db;
    var st = db.ref("users/" + uid + "/online");
    var last = db.ref("users/" + uid + "/lastSeen");
    db.ref(".info/connected").on("value", function (snap) {
      if (snap.val() === true) {
        st.onDisconnect().set(false);
        last.onDisconnect().set(firebaseNow());
        st.set(true);
      }
    });
  }

  // ---- perfil ----
  net.setName = function (name) {
    name = (name || "").trim().slice(0, 16) || "Jogador";
    saveLocalName(name);
    if (net.me) { net.me.name = name; net._db.ref("users/" + net.me.uid + "/name").set(name); }
  };

  // ---- vínculo de conta <-> identidade online ----
  // adota a identidade online da conta neste aparelho (mesmo número + amigos + chats)
  net.linkAccount = function (link) {
    if (!link || !link.uid) return;
    saveLink(link);
    if (!net._db) return;
    var name = link.name || localName() || "Jogador";
    net._db.ref("users/" + link.uid).update({ name: name, number: link.number || null });
    net.me = { uid: link.uid, number: link.number, name: name };
    net.ready = true;
    setupPresence(link.uid);
    listenInvites(link.uid);
  };
  // desvincula (logout) e volta à identidade anônima deste aparelho
  net.unlinkAccount = function () {
    saveLink(null);
    if (net._auth && net._auth.currentUser) onSignedIn(net._auth.currentUser.uid);
  };
  net.currentOnline = function () { return net.me ? { uid: net.me.uid, number: net.me.number, name: net.me.name } : null; };

  // ---- amigos ----
  net.findByNumber = function (number, cb) {
    number = (number || "").trim();
    net._db.ref("numbers/" + number).once("value").then(function (snap) {
      var uid = snap.val();
      if (!uid || uid === net.me.uid) { cb(null); return; }
      net._db.ref("users/" + uid).once("value").then(function (s2) {
        var v = s2.val(); cb(v ? { uid: uid, number: v.number, name: v.name, online: !!v.online } : null);
      });
    }).catch(function () { cb(null); });
  };
  net.addFriend = function (fuid, cb) {
    var me = net.me.uid;
    var updates = {};
    updates["users/" + me + "/friends/" + fuid] = true;
    updates["users/" + fuid + "/friends/" + me] = true;
    net._db.ref().update(updates).then(function () { cb && cb(true); }).catch(function () { cb && cb(false); });
  };
  net.removeFriend = function (fuid, cb) {
    var me = net.me.uid, updates = {};
    updates["users/" + me + "/friends/" + fuid] = null;
    updates["users/" + fuid + "/friends/" + me] = null;
    net._db.ref().update(updates).then(function () { cb && cb(true); });
  };
  // observa a lista de amigos + estado (online/nome) de cada um
  net.listenFriends = function (cb) {
    var me = net.me.uid;
    var friendsRef = net._db.ref("users/" + me + "/friends");
    var perFriend = {};
    friendsRef.on("value", function (snap) {
      var ids = snap.val() ? Object.keys(snap.val()) : [];
      // desliga listeners antigos
      Object.keys(perFriend).forEach(function (id) { if (ids.indexOf(id) < 0) { net._db.ref("users/" + id).off("value", perFriend[id]); delete perFriend[id]; } });
      var state = {};
      function emit() { cb(Object.keys(state).map(function (k) { return state[k]; })); }
      if (!ids.length) { cb([]); return; }
      ids.forEach(function (id) {
        if (perFriend[id]) return;
        var h = net._db.ref("users/" + id).on("value", function (s) {
          var v = s.val() || {};
          state[id] = { uid: id, name: v.name || "Jogador", number: v.number, online: !!v.online, lastSeen: v.lastSeen || 0 };
          emit();
        });
        perFriend[id] = h;
      });
    });
    return function stop() { friendsRef.off(); Object.keys(perFriend).forEach(function (id) { net._db.ref("users/" + id).off("value", perFriend[id]); }); };
  };

  // ---- chat ----
  function chatId(a, b) { return [a, b].sort().join("_"); }
  net.sendMessage = function (fuid, text, kind) {
    text = (text || "").trim().slice(0, 300);
    if (!text) return;
    net._db.ref("chats/" + chatId(net.me.uid, fuid) + "/messages").push({ from: net.me.uid, text: text, kind: kind || "text", ts: firebaseNow() });
  };
  net.listenChat = function (fuid, cb) {
    var ref = net._db.ref("chats/" + chatId(net.me.uid, fuid) + "/messages").limitToLast(80);
    var handler = ref.on("child_added", function (snap) { var v = snap.val(); cb({ from: v.from, text: v.text, kind: v.kind || "text", ts: v.ts, mine: v.from === net.me.uid }); });
    return function stop() { ref.off("child_added", handler); };
  };

  // ---- convites ----
  function listenInvites(uid) {
    net._db.ref("users/" + uid + "/invite").on("value", function (snap) {
      var v = snap.val();
      net._invite = v || null;
      if (v && net._onInvite) net._onInvite(v);
    });
  }
  net.onInvite = function (cb) { net._onInvite = cb; if (net._invite) cb(net._invite); };
  net.clearInvite = function () { if (net.me) net._db.ref("users/" + net.me.uid + "/invite").remove(); };
  net.sendInvite = function (fuid, code) {
    net._db.ref("users/" + fuid + "/invite").set({ from: net.me.uid, fromName: net.me.name, code: code, ts: firebaseNow() });
  };

  // ---- sala de partida online ----
  function genCode() { var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", c = ""; for (var i = 0; i < 5; i++) c += s[Math.floor(Math.random() * s.length)]; return c; }
  net.createMatch = function (opts, cb, tries) {
    if (typeof opts === "string") opts = { source: opts };
    opts = opts || {};
    tries = tries || 0;
    var code = genCode();
    var ref = net._db.ref("matches/" + code);
    ref.transaction(function (cur) {
      if (cur === null) {
        var base = { host: net.me.uid, hostName: net.me.name, source: opts.source || "club", createdAt: firebaseNow(), status: "waiting" };
        if (opts.mode) base.mode = opts.mode;
        if (opts.league) base.league = opts.league;
        return base;
      }
      return;
    }, function (err, committed) {
      if (!err && committed) { ref.onDisconnect().remove(); cb(code); }
      else if (tries < 6) net.createMatch(opts, cb, tries + 1);
      else cb(null);
    });
  };
  net.setMatchDraft = function (code, side, ids) {
    var patch = {}; patch[side === "host" ? "hostDraft" : "guestDraft"] = ids;
    net._db.ref("matches/" + code).update(patch);
  };
  // retrospecto entre dois jogadores (placar histórico) — só o host grava
  function pairKey(a, b) { return [a, b].sort().join("_"); }
  net.recordResult = function (hostUid, guestUid, winnerUid) {
    var ref = net._db.ref("h2h/" + pairKey(hostUid, guestUid));
    var field = winnerUid ? ("wins/" + winnerUid) : "draws";
    ref.child(field).transaction(function (c) { return (c || 0) + 1; });
  };
  net.getH2H = function (fuid, cb) {
    net._db.ref("h2h/" + pairKey(net.me.uid, fuid)).once("value").then(function (snap) {
      var v = snap.val() || {}; var wins = v.wins || {};
      cb({ me: wins[net.me.uid] || 0, them: wins[fuid] || 0, draws: v.draws || 0 });
    }).catch(function () { cb({ me: 0, them: 0, draws: 0 }); });
  };

  // ---- ranking global (vitórias online) ----
  net.recordWin = function (winnerUid, winnerName, loserUid, loserName) {
    var db = net._db;
    if (winnerUid) { db.ref("ranking/" + winnerUid + "/name").set(winnerName || "Jogador"); db.ref("ranking/" + winnerUid + "/wins").transaction(function (c) { return (c || 0) + 1; }); db.ref("ranking/" + winnerUid + "/played").transaction(function (c) { return (c || 0) + 1; }); }
    if (loserUid) { db.ref("ranking/" + loserUid + "/name").set(loserName || "Jogador"); db.ref("ranking/" + loserUid + "/played").transaction(function (c) { return (c || 0) + 1; }); }
  };
  net.getRanking = function (cb) {
    net._db.ref("ranking").orderByChild("wins").limitToLast(30).once("value").then(function (snap) {
      var arr = [];
      snap.forEach(function (ch) { var v = ch.val(); arr.push({ uid: ch.key, name: v.name || "Jogador", wins: v.wins || 0, played: v.played || 0 }); });
      arr.sort(function (a, b) { return b.wins - a.wins || b.played - a.played; });
      cb(arr);
    }).catch(function () { cb([]); });
  };
  net.joinMatch = function (code, cb) {
    code = (code || "").trim().toUpperCase();
    var ref = net._db.ref("matches/" + code);
    ref.once("value").then(function (snap) {
      var v = snap.val();
      if (!v) { cb(null, "Código não encontrado."); return; }
      if (v.guest && v.guest !== net.me.uid) { cb(null, "Essa partida já está cheia."); return; }
      ref.update({ guest: net.me.uid, guestName: net.me.name }).then(function () { cb(code, null); });
    }).catch(function (e) { cb(null, e.message); });
  };
  net.listenMatch = function (code, cb) {
    var ref = net._db.ref("matches/" + code);
    var h = ref.on("value", function (snap) { cb(snap.val()); });
    return function stop() { ref.off("value", h); };
  };
  net.setMatchTeam = function (code, side, teamId) {
    var patch = {}; patch[side === "host" ? "hostTeam" : "guestTeam"] = teamId;
    net._db.ref("matches/" + code).update(patch);
  };
  net.setMatchResult = function (code, payload) {
    net._db.ref("matches/" + code + "/result").set(payload);
  };
  net.leaveMatch = function (code) {
    if (!net.me || !code) return;
    var ref = net._db.ref("matches/" + code);
    ref.once("value").then(function (snap) { var v = snap.val(); if (v && v.host === net.me.uid) ref.remove(); });
  };

  // ---- Competição em Grupo (lobby: amigos entram e escolhem um time) ----
  net.createGroupComp = function (size, myTeamId, cb, tries) {
    tries = tries || 0;
    var code = genCode();
    var ref = net._db.ref("groupcomps/" + code);
    ref.transaction(function (cur) {
      if (cur === null) return { host: net.me.uid, hostName: net.me.name, size: size, status: "lobby", createdAt: firebaseNow(),
        players: { } };
      return;
    }, function (err, committed) {
      if (!err && committed) {
        var pref = ref.child("players/" + net.me.uid);
        pref.set({ name: net.me.name, teamId: myTeamId || null });
        ref.onDisconnect().remove();
        cb(code);
      } else if (tries < 6) net.createGroupComp(size, myTeamId, cb, tries + 1);
      else cb(null);
    });
  };
  net.joinGroupComp = function (code, cb) {
    code = (code || "").trim().toUpperCase();
    var ref = net._db.ref("groupcomps/" + code);
    ref.once("value").then(function (snap) {
      var v = snap.val();
      if (!v) { cb(null, "Competição não encontrada."); return; }
      if (v.status !== "lobby") { cb(null, "A competição já começou."); return; }
      var n = v.players ? Object.keys(v.players).length : 0;
      if (n >= v.size && !(v.players && v.players[net.me.uid])) { cb(null, "Sala cheia."); return; }
      ref.child("players/" + net.me.uid).update({ name: net.me.name }).then(function () { cb(code, null); });
    }).catch(function (e) { cb(null, e.message); });
  };
  net.setGroupTeam = function (code, teamId) { net._db.ref("groupcomps/" + code + "/players/" + net.me.uid + "/teamId").set(teamId); };
  net.listenGroupComp = function (code, cb) {
    var ref = net._db.ref("groupcomps/" + code);
    var h = ref.on("value", function (s) { cb(s.val()); });
    return function stop() { ref.off("value", h); };
  };
  net.startGroupComp = function (code, teamIds) { net._db.ref("groupcomps/" + code).update({ status: "started", teamIds: teamIds }); };
  net.leaveGroupComp = function (code) {
    if (!net.me || !code) return;
    var ref = net._db.ref("groupcomps/" + code);
    ref.once("value").then(function (s) { var v = s.val(); if (v && v.host === net.me.uid) ref.remove(); else ref.child("players/" + net.me.uid).remove(); });
  };

  // ---- Partida Aleatória (matchmaking): acha um oponente na fila ----
  // fila de 1 vaga: quem chega e acha alguém esperando, "pega" e cria a sala;
  // quem chega e a vaga está vazia, espera até ser pego.
  net.findMatch = function (cbMatched, cbWaiting) {
    var db = net._db, wref = db.ref("matchmaking/waiting"), taken = null;
    wref.transaction(function (cur) {
      if (cur === null || cur.uid === net.me.uid) return { uid: net.me.uid, name: net.me.name, ts: firebaseNow() };
      taken = cur; return null; // pega o oponente e esvazia a vaga
    }, function (err, committed) {
      if (err) { cbMatched(null, null, err.message); return; }
      if (taken && taken.uid !== net.me.uid) {
        // peguei alguém -> crio a sala e aviso ele pela "assign"
        net.createMatch({ source: "club", mode: "random" }, function (code) {
          if (!code) { cbMatched(null, null, "erro ao criar sala"); return; }
          db.ref("matchmaking/assign/" + taken.uid).set({ code: code, ts: firebaseNow() });
          cbMatched(code, "host", null);
        });
      } else {
        // fiquei esperando -> escuto minha atribuição
        wref.onDisconnect().remove();
        var aref = db.ref("matchmaking/assign/" + net.me.uid);
        cbWaiting && cbWaiting();
        var h = aref.on("value", function (s) {
          var v = s.val();
          if (v && v.code) { aref.off("value", h); aref.remove(); wref.onDisconnect().cancel(); net._mmA = null; cbMatched(v.code, "guest", null); }
        });
        net._mmA = { ref: aref, h: h };
      }
    });
  };
  net.cancelFind = function () {
    var db = net._db;
    db.ref("matchmaking/waiting").transaction(function (cur) { if (cur && cur.uid === net.me.uid) return null; return cur; });
    if (net._mmA) { net._mmA.ref.off("value", net._mmA.h); net._mmA = null; }
    if (net.me) db.ref("matchmaking/assign/" + net.me.uid).remove();
    db.ref("matchmaking/waiting").onDisconnect().cancel();
  };

  // ---- Contas (login em qualquer aparelho para sincronizar as carreiras) ----
  function sha256hex(str) {
    try {
      var enc = new global.TextEncoder().encode(str);
      return global.crypto.subtle.digest("SHA-256", enc).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      });
    } catch (e) {
      // fallback simples (não-ideal, mas evita quebrar se subtle indisponível)
      var h = 0; for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
      return global.Promise.resolve("f" + (h >>> 0).toString(16));
    }
  }
  function acctKey(email) { return String(email || "").trim().toLowerCase().replace(/[.#$\[\]\/]/g, ","); }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim()); }
  net.createAccount = function (email, pass, name, cb) {
    var e = String(email || "").trim().toLowerCase();
    if (!validEmail(e)) { cb(null, "Digite um e-mail válido."); return; }
    if ((pass || "").length < 4) { cb(null, "Senha: use ao menos 4 caracteres."); return; }
    var dn = (name || "").trim() || e.split("@")[0];
    var onUid = net.me ? net.me.uid : null, onNum = net.me ? net.me.number : null;
    sha256hex(e + ":" + pass + ":totalmatch").then(function (hash) {
      var ref = net._db.ref("accounts/" + acctKey(e));
      ref.transaction(function (cur) { if (cur) return; return { pass: hash, email: e, name: dn, photo: null, onlineUid: onUid, onlineNumber: onNum, createdAt: firebaseNow() }; },
        function (err, committed) {
          if (err) { cb(null, err.message); return; }
          if (!committed) { cb(null, "Já existe uma conta com esse e-mail."); return; }
          // este aparelho passa a ser a identidade online da conta
          if (onUid) net.linkAccount({ uid: onUid, number: onNum, name: dn });
          net.sendAuthEmail(e, dn, "signup"); // aviso de segurança por e-mail
          cb({ email: e, name: dn, photo: null, onlineUid: onUid, onlineNumber: onNum }, null);
        });
    });
  };
  net.login = function (email, pass, cb) {
    var e = String(email || "").trim().toLowerCase();
    sha256hex(e + ":" + pass + ":totalmatch").then(function (hash) {
      net._db.ref("accounts/" + acctKey(e)).once("value").then(function (s) {
        var v = s.val();
        if (!v) { cb(null, "Conta não encontrada."); return; }
        if (v.pass !== hash) { cb(null, "Senha incorreta."); return; }
        var name = v.name || e.split("@")[0];
        // vincula a identidade online: se a conta já tem, adota-a; senão, adota a atual e grava
        if (v.onlineUid) {
          net.linkAccount({ uid: v.onlineUid, number: v.onlineNumber, name: name });
        } else if (net.me) {
          net.linkAccount({ uid: net.me.uid, number: net.me.number, name: name });
          net._db.ref("accounts/" + acctKey(e)).update({ onlineUid: net.me.uid, onlineNumber: net.me.number });
        }
        net.sendAuthEmail(e, name, "login"); // aviso de segurança por e-mail
        cb({ email: e, name: name, photo: v.photo || null, saves: v.saves || null, onlineUid: v.onlineUid || null }, null);
      }).catch(function (er) { cb(null, er.message); });
    });
  };
  net.cloudSaveProfile = function (email, prof, cb) {
    net._db.ref("accounts/" + acctKey(email)).update({ name: prof.name || "", photo: prof.photo || null }).then(function () { cb && cb(true); }).catch(function () { cb && cb(false); });
  };
  net.cloudSave = function (email, data, cb) {
    net._db.ref("accounts/" + acctKey(email) + "/saves").set(data).then(function () { cb && cb(true); }).catch(function () { cb && cb(false); });
  };
  net.cloudLoad = function (email, cb) {
    net._db.ref("accounts/" + acctKey(email) + "/saves").once("value").then(function (s) { cb(s.val()); }).catch(function () { cb(null); });
  };

  TM.net = net;
})(window);
