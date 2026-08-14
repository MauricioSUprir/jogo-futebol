/* ================= TOTAL MATCH — Competição em Grupo (online) ================= */
/* Torneio com fase de grupos + mata-mata, até 32 times. Você escolhe seu time,
   convida amigos (cada um entra e escolhe um time) e/ou completa as vagas com
   clubes (manual ou aleatório). Depois descobre quem é o campeão.
   Reaproveita o motor de torneio do "Jogar Competição" (compmode). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var N = function () { return TM.net; };

  var gc = null; // { size, myTeam, added:[ids], online:{code}|null, players:{} }
  var gcStop = null;

  function allClubIds() { var out = []; TM.data.world().clubs.forEach(function (c) { out.push(c.id); }); return out; }
  function friendTeams() { // times dos amigos no lobby (exceto o host, com time escolhido)
    if (!gc.online || !gc.players) return [];
    var me = N().me ? N().me.uid : null, out = [];
    Object.keys(gc.players).forEach(function (uid) { if (uid !== me && gc.players[uid] && gc.players[uid].teamId) out.push(gc.players[uid].teamId); });
    return out;
  }
  function assembled() {
    var ids = [gc.myTeam].concat(gc.added).concat(friendTeams());
    var seen = {}, out = [];
    ids.forEach(function (id) { if (id && !seen[id]) { seen[id] = 1; out.push(id); } });
    return out.slice(0, gc.size);
  }
  function remaining() { return gc.size - assembled().length; }

  function autoFill() {
    var used = {}; assembled().forEach(function (id) { used[id] = 1; });
    var pool = allClubIds().filter(function (id) { return !used[id]; });
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    while (remaining() > 0 && pool.length) { gc.added.push(pool.shift()); }
  }

  function startComp() {
    var teamIds = assembled();
    if (teamIds.length < gc.size) { TM.ui.toast("Faltam times (" + teamIds.length + "/" + gc.size + ")"); return; }
    var doStart = function () {
      var s = { name: "Competição em Grupo", isNation: false, kind: "tournament", userId: gc.myTeam, catKey: "group", compId: null };
      s.tour = TM.tournament.create(teamIds, { groups: gc.size / 4, perGroup: 4, advance: 2, userId: gc.myTeam });
      if (gc.online) { N().startGroupComp(gc.online.code, teamIds); if (gcStop) { gcStop(); gcStop = null; } }
      TM.storage.write("compmode", s);
      gc = null;
      TM.ui.go("compmode-hub");
    };
    if (TM.storage.read("compmode", null)) {
      TM.ui.confirm("Substituir competição atual?", "Você tem uma competição em andamento em 'Jogar Competição'. Começar esta vai substituí-la.", "Substituir", doStart, true);
    } else doStart();
  }

  /* ---------- BUILDER ---------- */
  TM.ui.register("groupcomp", function (screen) {
    if (!gc) gc = { size: 16, myTeam: null, added: [], online: null, players: {} };
    screen.appendChild(TM.ui.topbar("🏆 Competição em Grupo", function () { if (gcStop) { gcStop(); gcStop = null; } if (gc && gc.online) N().leaveGroupComp(gc.online.code); gc = null; TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // tamanho
    var sizeRow = el("div", { class: "segmented full" });
    [8, 16, 32].forEach(function (n) {
      sizeRow.appendChild(el("button", { class: "seg-btn" + (gc.size === n ? " active" : ""), text: n + " times", on: { click: function () {
        gc.size = n; if (gc.added.length > n - 1) gc.added = gc.added.slice(0, n - 1); TM.ui.go("groupcomp");
      } } }));
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Tamanho (grupos de 4 + mata-mata)" }), sizeRow ]));

    // seu time
    body.appendChild(el("div", { class: "list-head", text: "Seu time" }));
    if (gc.myTeam) {
      var c = TM.data.club(gc.myTeam);
      body.appendChild(el("div", { class: "chosen-team", on: { click: openMyPick } }, [
        TM.img.clubImg(c, "chosen-crest"),
        el("div", { class: "chosen-info" }, [ el("div", { class: "chosen-name", text: c.name }), el("div", { class: "chosen-sub", text: "toque para trocar" }) ]),
        TM.ui.ovBadge(TM.data.clubRating(gc.myTeam))
      ]));
    } else {
      body.appendChild(el("button", { class: "chosen-team empty", on: { click: openMyPick } }, [ el("span", { text: "➕ Escolher seu time" }) ]));
    }

    // contador
    var filled = assembled().length;
    body.appendChild(el("div", { class: "gc-counter" + (filled === gc.size ? " full" : "") }, [ el("span", { text: "Vagas preenchidas: " }), el("b", { text: filled + " / " + gc.size }) ]));

    // amigos (online)
    if (gc.online) {
      body.appendChild(el("div", { class: "list-head", text: "Amigos (online)" }));
      var url = location.origin + location.pathname + "?joingc=" + gc.online.code;
      var qrBox = el("div", { class: "qr-box" }); try { qrBox.innerHTML = qrSvg(url); } catch (e) { qrBox.textContent = gc.online.code; }
      body.appendChild(el("div", { class: "room-share" }, [
        el("div", { class: "share-lbl", text: "Amigo escaneia o QR ou entra com o código:" }), qrBox,
        el("div", { class: "share-code", text: gc.online.code }),
        TM.ui.button("📋 Copiar código", function () { try { navigator.clipboard.writeText(gc.online.code); } catch (e) {} TM.ui.toast("Código copiado!"); }, "btn ghost small")
      ]));
      var plist = el("div", { class: "friend-list" });
      var me = N().me ? N().me.uid : null;
      Object.keys(gc.players || {}).forEach(function (uid) {
        var pl = gc.players[uid];
        plist.appendChild(el("div", { class: "friend-row" }, [
          el("span", { class: "online-dot on" }),
          el("div", { class: "friend-info" }, [ el("div", { class: "friend-name", text: pl.name + (uid === me ? " (você)" : "") }),
            el("div", { class: "friend-sub", text: pl.teamId ? ("Time: " + TM.data.club(pl.teamId).name) : "escolhendo o time…" }) ])
        ]));
      });
      body.appendChild(plist);
    }

    // times adicionados manualmente
    if (gc.added.length) {
      body.appendChild(el("div", { class: "list-head", text: "Times adicionados" }));
      var list = el("div", { class: "friend-list" });
      gc.added.forEach(function (id, i) {
        var cl = TM.data.club(id);
        list.appendChild(el("div", { class: "friend-row" }, [
          TM.img.clubImg(cl, "prev-crest-sm"),
          el("div", { class: "friend-info" }, [ el("div", { class: "friend-name", text: cl.name }) ]),
          TM.ui.ovBadge(TM.data.clubRating(id)),
          TM.ui.button("✕", function () { gc.added.splice(i, 1); TM.ui.go("groupcomp"); }, "btn ghost small")
        ]));
      });
      body.appendChild(list);
    }

    // ações
    var acts = el("div", { class: "actions" });
    acts.appendChild(TM.ui.button("➕ Adicionar time", function () {
      if (remaining() <= 0) { TM.ui.toast("As vagas já estão cheias"); return; }
      TM.ui.pickTeam({ source: "club", title: "Adicionar time", back: function () { TM.ui.go("groupcomp"); },
        onPick: function (id) { if (assembled().indexOf(id) < 0) gc.added.push(id); TM.ui.go("groupcomp"); } });
    }, "btn"));
    acts.appendChild(TM.ui.button("🎲 Preencher aleatoriamente", function () { autoFill(); TM.ui.go("groupcomp"); }, "btn"));
    if (!gc.online) {
      acts.appendChild(TM.ui.button("📲 Convidar amigos (online)", function () { hostLobby(); }, "btn ghost"));
    }
    acts.appendChild(TM.ui.button(filled === gc.size ? "▶ Começar competição" : "▶ Começar (" + filled + "/" + gc.size + ")", function () {
      if (!gc.myTeam) { TM.ui.toast("Escolha seu time primeiro"); return; }
      if (remaining() > 0) { TM.ui.confirm("Completar com clubes?", "Faltam " + remaining() + " vaga(s). Preencher com clubes aleatórios e começar?", "Preencher e começar", function () { autoFill(); startComp(); }); return; }
      startComp();
    }, filled === gc.size ? "btn primary big" : "btn primary"));
    body.appendChild(acts);
  });

  function openMyPick() {
    TM.ui.pickTeam({ source: "club", title: "Seu time", current: gc.myTeam, back: function () { TM.ui.go("groupcomp"); },
      onPick: function (id) { gc.myTeam = id; if (gc.online) N().setGroupTeam(gc.online.code, id); TM.ui.go("groupcomp"); } });
  }
  function qrSvg(text) { var qr = global.qrcode(0, "M"); qr.addData(text); qr.make(); return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }

  function hostLobby() {
    if (!N().available) { TM.ui.toast("Online indisponível (sem internet?)"); return; }
    N().onReady(function () {
      N().createGroupComp(gc.size, gc.myTeam, function (code) {
        if (!code) { TM.ui.toast("Erro ao criar sala"); return; }
        gc.online = { code: code };
        if (gcStop) gcStop();
        gcStop = N().listenGroupComp(code, function (v) {
          if (!v) return;
          gc.players = v.players || {};
          if (TM.ui.current() === "groupcomp") TM.ui.go("groupcomp");
        });
        TM.ui.go("groupcomp");
      });
    });
  }

  // amigo entra num lobby (via ?joingc= ou código)
  TM.ui.register("groupcomp-join", function (screen, params) {
    screen.appendChild(TM.ui.topbar("🏆 Entrar na competição", function () { TM.ui.go("online"); }));
    if (!N().available) { screen.appendChild(el("p", { class: "intro-text", text: "Online indisponível." })); return; }
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    N().onReady(function () {
      var code = (params && params.code || "").toUpperCase();
      var codeIn = el("input", { class: "select big-code", type: "text", maxlength: "5", placeholder: "CÓDIGO", value: code });
      body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Código da competição" }), codeIn ]));
      body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("Entrar", function () { doJoin(codeIn.value.trim().toUpperCase()); }, "btn primary big") ]));
      if (code && params.auto) doJoin(code);
    });
  });
  function doJoin(code) {
    if (!code) { TM.ui.toast("Digite o código"); return; }
    N().joinGroupComp(code, function (c, err) { if (c) enterGuestLobby(c); else TM.ui.toast(err || "Não encontrada"); });
  }
  function enterGuestLobby(code) { TM.ui.go("groupcomp-guest", { code: code }); }

  // tela do amigo no lobby: escolhe seu time e aguarda o host começar
  var guestStop = null;
  TM.ui.register("groupcomp-guest", function (screen, params) {
    var code = params.code;
    screen.appendChild(TM.ui.topbar("🏆 Competição " + code, function () { if (guestStop) { guestStop(); guestStop = null; } N().leaveGroupComp(code); TM.ui.go("online"); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    if (guestStop) guestStop();
    guestStop = N().listenGroupComp(code, function (v) {
      if (!body.isConnected) { if (guestStop) { guestStop(); guestStop = null; } return; }
      TM.ui.clear(body);
      if (!v) { body.appendChild(el("p", { class: "intro-text", text: "A competição foi encerrada pelo organizador." })); return; }
      if (v.status === "started") {
        // amigo joga a MESMA competição no aparelho dele, controlando o próprio time
        var me = N().me.uid; var myTeam = v.players && v.players[me] ? v.players[me].teamId : (v.teamIds && v.teamIds[0]);
        if (guestStop) { guestStop(); guestStop = null; }
        var s = { name: "Competição em Grupo", isNation: false, kind: "tournament", userId: myTeam, catKey: "group", compId: null,
          tour: TM.tournament.create(v.teamIds.slice(), { groups: v.size / 4, perGroup: 4, advance: 2, userId: myTeam }) };
        TM.storage.write("compmode", s);
        TM.ui.go("compmode-hub");
        return;
      }
      var me2 = N().me.uid; var mine = v.players && v.players[me2] ? v.players[me2].teamId : null;
      body.appendChild(el("p", { class: "intro-text", text: "Escolha seu time e aguarde o organizador começar." }));
      body.appendChild(el("div", { class: "list-head", text: "Seu time" }));
      if (mine) {
        var c = TM.data.club(mine);
        body.appendChild(el("div", { class: "chosen-team", on: { click: function () { pickGuest(code); } } }, [ TM.img.clubImg(c, "chosen-crest"),
          el("div", { class: "chosen-info" }, [ el("div", { class: "chosen-name", text: c.name }), el("div", { class: "chosen-sub", text: "toque para trocar" }) ]), TM.ui.ovBadge(TM.data.clubRating(mine)) ]));
      } else {
        body.appendChild(el("button", { class: "chosen-team empty", on: { click: function () { pickGuest(code); } } }, [ el("span", { text: "➕ Escolher meu time" }) ]));
      }
      var n = v.players ? Object.keys(v.players).length : 0;
      body.appendChild(el("div", { class: "waiting-line", text: "👥 " + n + "/" + v.size + " jogadores · aguardando o organizador iniciar…" }));
    });
  });
  function pickGuest(code) {
    if (guestStop) { guestStop(); guestStop = null; }
    TM.ui.pickTeam({ source: "club", title: "Meu time", back: function () { TM.ui.go("groupcomp-guest", { code: code }); },
      onPick: function (id) { N().setGroupTeam(code, id); TM.ui.go("groupcomp-guest", { code: code }); } });
  }

})(window);
