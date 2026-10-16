/* ================= TOTAL MATCH — Pênaltis 3D =================
   Pedido do dono (15/10): "crie uma versão só de jogador de pênaltis" → "modo de pênaltis 3d igual ao golaço, só que
   versão de pênaltis". Escolhe os dois times como na Partida Rápida (clubes ou seleções; o Viverde FC em "Especiais", com a
   senha) e joga só a DISPUTA de pênaltis no GOLAÇO 3D (TM.tm3d.jogarPenaltis: o mesmo quadro e a mesma ponte das partidas
   3D, com modo: "penaltis" no pedido). O usuário é o "Seu time": bate com os cobradores dele e defende com o goleiro dele.
   No fim, a tela de resultado: quem venceu nos pênaltis, o placar e cada cobrança, com "Jogar de novo" e "Voltar".
   Precisa de WebGL 2 (como as partidas 3D): sem ele, o botão avisa e não abre. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  var setup = { source: "club", teamA: null, teamB: null };
  var ultimo = null;   // { a, b, r3 } da última disputa (a tela de resultado)

  function teamObj(id) { return setup.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id); }
  function crestFor(id, cls) { return setup.source === "nation" ? TM.img.nationImg(TM.data.nation(id), cls) : TM.img.clubImg(TM.data.club(id), cls); }
  function nameFor(id) { return setup.source === "nation" ? TM.data.nation(id).name : TM.data.club(id).name; }
  function ratingFor(id) { return setup.source === "nation" ? TM.comp.natRating(id) : TM.data.clubRating(id); }

  /** Abre a disputa 3D com os times escolhidos (o usuário é o time A, o "Seu time"). */
  function jogar() {
    if (!setup.teamA || !setup.teamB || setup.teamA === setup.teamB) { TM.ui.toast("Escolha dois times diferentes", "alerta"); return; }
    if (!TM.tm3d || !TM.tm3d.jogarPenaltis) { TM.ui.toast("O 3D não está disponível.", "alerta"); return; }
    var a = teamObj(setup.teamA), b = teamObj(setup.teamB);
    TM.tm3d.jogarPenaltis({ teamA: a, teamB: b, userSide: 0, title: "Disputa de pênaltis", simOpts: { neutral: true } }, {
      fim: function (r3) { ultimo = { a: a, b: b, r3: r3 }; TM.ui.go("penaltis3d-fim"); },
      sair: function () { TM.ui.go("penaltis3d"); }
    });
  }

  /* ---------- Tela 1: os dois times ---------- */
  TM.ui.register("penaltis3d", function (screen) {
    screen.appendChild(TM.ui.topbar("🥅 Pênaltis 3D", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow pen3d" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text pen3d-intro", text: "Só a disputa de pênaltis, no estádio 3D. Você bate com os cobradores do seu time e defende com o seu goleiro." }));

    var srcSeg = el("div", { class: "segmented full" });
    [["club", "Clubes"], ["nation", "Seleções"]].forEach(function (o) {
      srcSeg.appendChild(el("button", {
        class: "seg-btn" + (setup.source === o[0] ? " active" : ""), type: "button",
        text: o[1], on: { click: function () { setup.source = o[0]; setup.teamA = setup.teamB = null; TM.ui.go("penaltis3d"); } }
      }));
    });
    body.appendChild(el("div", { class: "setting" }, [el("div", { class: "setting-label", text: "Tipo de time" }), srcSeg]));

    function chosenCard(label, teamKey) {
      var id = setup[teamKey];
      var open = function () {
        TM.ui.pickTeam({ source: setup.source, title: label, current: id, back: function () { TM.ui.go("penaltis3d"); }, especiais: setup.source === "club",
          onPick: function (pid) { setup[teamKey] = pid; TM.ui.go("penaltis3d"); } });
      };
      if (!id) return el("button", { class: "chosen-team empty", type: "button", on: { click: open } }, [el("span", { text: "➕ " + label })]);
      return el("div", { class: "chosen-team", on: { click: open } }, [
        crestFor(id, "chosen-crest"),
        el("div", { class: "chosen-info" }, [el("div", { class: "chosen-name", text: nameFor(id) }), el("div", { class: "chosen-sub", text: label + " · toque para trocar" })]),
        TM.ui.ovBadge(ratingFor(id))
      ]);
    }
    body.appendChild(el("div", { class: "setting-label", text: "Seu time" }));
    body.appendChild(chosenCard("Seu time", "teamA"));
    body.appendChild(el("div", { class: "vs-divider", text: "VS" }));
    body.appendChild(el("div", { class: "setting-label", text: "Adversário" }));
    body.appendChild(chosenCard("Adversário", "teamB"));
    if (setup.teamA && setup.teamA === setup.teamB) body.appendChild(el("p", { class: "warn", text: "Escolha times diferentes." }));

    var tem3d = !!(TM.tm3d && TM.tm3d.disponivel && TM.tm3d.disponivel());
    if (!tem3d) body.appendChild(el("p", { class: "warn pen3d-aviso", text: "Este aparelho não tem WebGL 2, que os pênaltis em 3D precisam. Atualize o navegador ou ative a aceleração de hardware." }));
    var pronto = setup.teamA && setup.teamB && setup.teamA !== setup.teamB && tem3d;
    var bt = TM.ui.button("Jogar pênaltis em 3D", jogar, "btn primary big pen3d-jogar");
    bt.type = "button";
    if (!pronto) bt.classList.add("is-off");
    screen.appendChild(el("div", { class: "actions" }, [bt]));
  });

  /* ---------- Tela 2: o resultado ---------- */
  var ROTULO = { gol: "Gol", defesa: "Defendido", fora: "Para fora" };
  TM.ui.register("penaltis3d-fim", function (screen) {
    if (!ultimo || !ultimo.r3 || !ultimo.r3.penaltis) { TM.ui.go("penaltis3d"); return; }
    var a = ultimo.a, b = ultimo.b, p = ultimo.r3.penaltis;
    var venc = p.vencedor === 0 ? a.name : b.name;
    screen.appendChild(TM.ui.topbar("Resultado", function () { TM.ui.go("penaltis3d"); }));
    screen.appendChild(TM.ui.posterFim({ a: a, b: b, hs: p.placar[0], as: p.placar[1], titulo: "Pênaltis 3D",
      res: { cls: "v", txt: venc + " venceu nos pênaltis" }, neutro: true }));
    // as cobranças, na ordem, cada time numa coluna (o nome e o que aconteceu)
    var cols = [0, 1].map(function (lado) {
      var t = lado === 0 ? a : b;
      var lista = p.cobrancas.filter(function (c) { return c.lado === lado; });
      return el("div", { class: "pen3d-col" }, [el("div", { class: "pen3d-col-h", text: t.name })].concat(lista.map(function (c, i) {
        return el("div", { class: "pen3d-cob " + (c.resultado === "gol" ? "ok" : "erro") }, [
          el("span", { class: "pen3d-n", text: String(i + 1) }),
          el("span", { class: "pen3d-nome", text: c.nome || "" }),
          el("span", { class: "pen3d-res", text: ROTULO[c.resultado] || c.resultado })
        ]);
      })));
    });
    screen.appendChild(el("div", { class: "panel-narrow" }, [el("h3", { class: "block-title", text: "Cobranças" }), el("div", { class: "pen3d-cols" }, cols)]));
    screen.appendChild(el("div", { class: "actions two" }, [
      TM.ui.button("Jogar de novo", jogar, "btn primary"),
      TM.ui.button("Voltar", function () { TM.ui.go("modes"); }, "btn ghost")
    ]));
  });

  TM.penaltis3d = { jogar: jogar, setup: setup, get ultimo() { return ultimo; } };
})(window);
