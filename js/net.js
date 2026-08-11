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

  function hasSDK() { return typeof global.firebase !== "undefined" && global.firebase.initializeApp; }

  function genNumber() {
    var a = Math.floor(1000 + Math.random() * 9000);
    var b = Math.floor(1000 + Math.random() * 9000);
    return a + "-" + b;
  }
  function localName() { try { return localStorage.getItem("tm_online_name") || ""; } catch (e) { return ""; } }
  function saveLocalName(n) { try { localStorage.setItem("tm_online_name", n); } catch (e) {} }

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
  net.createMatch = function (source, cb, tries) {
    tries = tries || 0;
    var code = genCode();
    var ref = net._db.ref("matches/" + code);
    ref.transaction(function (cur) {
      if (cur === null) return { host: net.me.uid, hostName: net.me.name, source: source || "club", createdAt: firebaseNow(), status: "waiting" };
      return;
    }, function (err, committed) {
      if (!err && committed) { ref.onDisconnect().remove(); cb(code); }
      else if (tries < 6) net.createMatch(source, cb, tries + 1);
      else cb(null);
    });
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

  TM.net = net;
})(window);
