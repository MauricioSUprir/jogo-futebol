/* ================= TOTAL MATCH — Modo Livre 3D =================
   Pedido do dono (16/10): "adicione tbm um modo livre, como no fifa, um modo de treino, onde pode ter a quantidade de
   jogadores que eu escolher, contra a quantidade de jogadores que eu escolher, pode ser adaptável durante a partida, assim
   como a camera". É a Arena de Treino do GOLAÇO 3D: escolhe os dois times como na Partida Rápida (clubes ou seleções; o
   Viverde FC em "Especiais", com a senha) e treina no estádio 3D (TM.tm3d.jogarLivre: o mesmo quadro e a mesma ponte das
   partidas 3D, com modo: "livre" no pedido). Quantos jogadores ficam em cada time (de 1 a 11, com ou sem goleiro) e a
   câmera se escolhem na pausa do 3D, a qualquer hora (o 3D lembra a última escolha). Sem relógio e sem resultado: ao sair,
   volta a esta tela e nada conta (nem placar, nem estatística, nem carreira).
   Precisa de WebGL 2 (como as partidas 3D): sem ele, o botão avisa e não abre. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  // livre: a escolha inicial de jogadores mandada ao 3D ({ linha: [a, b], goleiro: [bool, bool] }); null = o 3D usa a
  // última escolha que ele mesmo guardou (ou 5 contra 5 na primeira vez)
  var setup = { source: "club", teamA: null, teamB: null, livre: null };

  function teamObj(id) { return setup.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id); }
  function crestFor(id, cls) { return setup.source === "nation" ? TM.img.nationImg(TM.data.nation(id), cls) : TM.img.clubImg(TM.data.club(id), cls); }
  function nameFor(id) { return setup.source === "nation" ? TM.data.nation(id).name : TM.data.club(id).name; }
  function ratingFor(id) { return setup.source === "nation" ? TM.comp.natRating(id) : TM.data.clubRating(id); }

  /** Abre o treino 3D com os times escolhidos (o usuário é o time A, o "Seu time"); ao sair, volta para esta tela. */
  function jogar() {
    if (!setup.teamA || !setup.teamB || setup.teamA === setup.teamB) { TM.ui.toast("Escolha dois times diferentes", "alerta"); return; }
    if (!TM.tm3d || !TM.tm3d.jogarLivre) { TM.ui.toast("O 3D não está disponível.", "alerta"); return; }
    var a = teamObj(setup.teamA), b = teamObj(setup.teamB);
    var volta = function () { TM.ui.go("livre3d"); };
    // o Seu time é o mandante (treina na casa dele); nada é simulado nem registrado na volta
    TM.tm3d.jogarLivre({ teamA: a, teamB: b, userSide: 0, title: "Modo Livre", simOpts: { neutral: false }, livre: setup.livre }, { fim: volta, sair: volta });
  }

  TM.ui.register("livre3d", function (screen) {
    screen.appendChild(TM.ui.topbar("🏋️ Modo Livre 3D", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow livre3d" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text livre3d-intro", text: "Treino livre no estádio 3D, como a Arena de Treino: você escolhe quantos jogadores cada time tem, de 1 a 11, com ou sem goleiro, e muda isso e a câmera na pausa, a qualquer hora. Sem relógio e sem resultado: nada conta." }));

    var srcSeg = el("div", { class: "segmented full" });
    [["club", "Clubes"], ["nation", "Seleções"]].forEach(function (o) {
      srcSeg.appendChild(el("button", {
        class: "seg-btn" + (setup.source === o[0] ? " active" : ""), type: "button",
        text: o[1], on: { click: function () { setup.source = o[0]; setup.teamA = setup.teamB = null; TM.ui.go("livre3d"); } }
      }));
    });
    body.appendChild(el("div", { class: "setting" }, [el("div", { class: "setting-label", text: "Tipo de time" }), srcSeg]));

    function chosenCard(label, teamKey) {
      var id = setup[teamKey];
      var open = function () {
        TM.ui.pickTeam({ source: setup.source, title: label, current: id, back: function () { TM.ui.go("livre3d"); }, especiais: setup.source === "club",
          onPick: function (pid) { setup[teamKey] = pid; TM.ui.go("livre3d"); } });
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
    if (!tem3d) body.appendChild(el("p", { class: "warn livre3d-aviso", text: "Este aparelho não tem WebGL 2, que o Modo Livre 3D precisa. Atualize o navegador ou ative a aceleração de hardware." }));
    var pronto = setup.teamA && setup.teamB && setup.teamA !== setup.teamB && tem3d;
    var bt = TM.ui.button("Treinar em 3D", jogar, "btn primary big livre3d-jogar");
    bt.type = "button";
    if (!pronto) bt.classList.add("is-off");
    screen.appendChild(el("div", { class: "actions" }, [bt]));
  });

  TM.livre3d = { jogar: jogar, setup: setup };
})(window);
