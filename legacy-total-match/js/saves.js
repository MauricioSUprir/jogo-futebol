/* ================= TOTAL MATCH — biblioteca de jogos salvos ================= */
/* Guarda várias carreiras de treinador, de jogador e competições, para você
   reabrir quando quiser. "Salvar e sair" estaciona o jogo atual na biblioteca. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = function () { return TM.ui.el; };

  function activeData(type) {
    return type === "coach" ? TM.storage.coachCareer() : type === "player" ? TM.storage.playerCareer() : TM.storage.read("compmode", null);
  }
  function clearActive(type) {
    if (type === "coach") TM.storage.clearCoachCareer();
    else if (type === "player") TM.storage.clearPlayerCareer();
    else TM.storage.remove("compmode");
  }
  function setActive(type, data) {
    if (type === "coach") TM.storage.saveCoachCareer(data);
    else if (type === "player") TM.storage.savePlayerCareer(data);
    else TM.storage.write("compmode", data);
  }
  function hubRoute(type) { return type === "coach" ? "coach-hub" : type === "player" ? "player-hub" : "compmode-hub"; }

  function describe(type, d) {
    try {
      if (type === "coach") { var club = TM.data.club(d.teamId); return { icon: "🎯", name: (d.coachName || "Treinador") + " · " + club.name, subtitle: TM.data.league(d.leagueId).name + " · Temporada " + d.season }; }
      if (type === "player") { var c2 = TM.data.club(d.clubId); return { icon: "⭐", name: d.name, subtitle: (c2 ? c2.name : "") + " · Temp " + d.season + " · " + d.overall + " OVR" }; }
      var nm = d.isNation ? TM.data.nation(d.userId).name : TM.data.club(d.userId).name;
      return { icon: "🏆", name: d.name, subtitle: nm };
    } catch (e) { return { icon: "💾", name: "Jogo salvo", subtitle: "" }; }
  }

  // estaciona o jogo ativo (se houver) na biblioteca e limpa o slot ativo
  function park(type) {
    var d = activeData(type);
    if (!d) return false;
    var meta = describe(type, d);
    TM.storage.saveGame({ type: type, name: meta.name, subtitle: meta.subtitle, icon: meta.icon, data: d });
    clearActive(type);
    return true;
  }

  // carrega um jogo salvo (estaciona o ativo do mesmo tipo antes, pra não perder)
  function loadSave(rec) {
    park(rec.type);
    setActive(rec.type, rec.data);
    TM.storage.removeSave(rec.id);
    TM.ui.go(hubRoute(rec.type));
  }

  TM.saves = { park: park, loadSave: loadSave, describe: describe };

  /* ---------- painel "Minhas Carreiras" ---------- */
  TM.ui.register("saves", function (screen) {
    var E = el();
    screen.appendChild(TM.ui.topbar("💾 Minhas Carreiras", function () { TM.ui.go("modes"); }));
    var body = E("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // jogos ativos (em andamento) — atalho pra continuar
    var active = [];
    if (TM.storage.coachCareer()) active.push({ type: "coach", data: TM.storage.coachCareer() });
    if (TM.storage.playerCareer()) active.push({ type: "player", data: TM.storage.playerCareer() });
    if (TM.storage.read("compmode", null)) active.push({ type: "comp", data: TM.storage.read("compmode", null) });

    if (active.length) {
      body.appendChild(E("h3", { class: "block-title", text: "Em andamento" }));
      active.forEach(function (a) {
        var meta = describe(a.type, a.data);
        body.appendChild(saveCard(meta, "Continuar", function () { TM.ui.go(hubRoute(a.type)); }, null));
      });
    }

    var saves = TM.storage.listSaves();
    body.appendChild(E("h3", { class: "block-title", text: "Salvos (" + saves.length + ")" }));
    if (!saves.length) body.appendChild(E("p", { class: "intro-text", text: "Nenhum jogo salvo ainda. Dentro de uma carreira, use os três pontinhos (⋯) → Salvar e sair." }));
    saves.forEach(function (rec) {
      body.appendChild(saveCard(rec, "Reabrir", function () { TM.saves.loadSave(rec); }, function () {
        TM.ui.confirm("Apagar este save?", rec.name, "Apagar", function () { TM.storage.removeSave(rec.id); TM.ui.go("saves"); }, true);
      }));
    });

    function saveCard(meta, actionLabel, onOpen, onDelete) {
      var kids = [
        E("div", { class: "save-ic", text: meta.icon || "💾" }),
        E("div", { class: "save-info" }, [ E("div", { class: "save-name", text: meta.name }), E("div", { class: "save-sub", text: meta.subtitle }) ]),
        TM.ui.button(actionLabel, onOpen, "btn primary small")
      ];
      if (onDelete) kids.push(TM.ui.button("🗑", onDelete, "btn ghost small"));
      return E("div", { class: "save-card" }, kids);
    }
  });
})(window);
