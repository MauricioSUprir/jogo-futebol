/* ================= TOTAL MATCH — Analisar Adversário (Scout) ================= */
/* Tela reutilizável mostrada antes dos jogos em TODOS os modos.
   Mostra a provável escalação do adversário, formação, táticas, modo de jogo,
   jogadores-chave e informações gerais. É apenas leitura (não altera nada). */
(function (global) {
  var TM = global.TM;
  var el = TM.ui.el;

  function slug(name) {
    return String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  // hash determinístico simples a partir de um id/string
  function hashStr(s) { s = String(s || ""); var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function avg(list) { return list.length ? list.reduce(function (a, b) { return a + b; }, 0) / list.length : 0; }

  var FORMS = ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "5-3-2"];

  // escolhe uma formação "provável" a partir do perfil do elenco (determinística)
  function chooseFormation(players) {
    var fw = players.filter(function (p) { return p.pos === "FW"; }).length;
    var df = players.filter(function (p) { return p.pos === "DF"; }).length;
    var seed = hashStr(players.map(function (p) { return p.id; }).join(""));
    // enviesa pela composição, mas mantém variedade determinística
    if (fw >= 6 && seed % 2 === 0) return "4-3-3";
    if (df >= 9 && seed % 2 === 0) return "5-3-2";
    return FORMS[seed % FORMS.length];
  }

  // deriva o "modo de jogo" a partir dos atributos dos titulares
  function derivePlaystyle(starters) {
    var atk = [], dfn = [], pace = [], pass = [];
    starters.forEach(function (p) {
      var a = p.attrs || {};
      if (p.pos === "FW" || p.pos === "MF") { atk.push(a.sho || p.overall); atk.push(a.dri || p.overall); }
      if (p.pos === "DF" || p.pos === "MF") dfn.push(a.def || p.overall);
      pace.push(a.pac || p.overall);
      pass.push(a.pas || p.overall);
    });
    var aA = avg(atk), aD = avg(dfn), aP = avg(pace), aPas = avg(pass);
    var style, desc;
    var diff = aA - aD;
    if (diff > 4) { style = "Ofensivo"; desc = "Pressão alta e transições rápidas, buscando o gol a todo momento."; }
    else if (diff < -4) { style = "Defensivo"; desc = "Bloco baixo, marcação compacta e perigo no contra-ataque."; }
    else { style = "Equilibrado"; desc = "Controle de posse e equilíbrio entre defender e atacar."; }
    var tempo = aP >= 78 ? "Ritmo intenso" : aP >= 72 ? "Ritmo moderado" : "Ritmo cadenciado";
    var build = aPas >= 78 ? "Saída de bola trabalhada" : aPas >= 72 ? "Construção mista" : "Jogo mais direto";
    return { style: style, desc: desc, tempo: tempo, build: build };
  }

  // descrição da tática a partir da formação
  function tacticText(form) {
    var map = {
      "4-4-2": "Duas linhas de quatro, dois atacantes de referência. Sólido e clássico.",
      "4-3-3": "Trio ofensivo aberto, alas avançados e meio-campo dinâmico.",
      "3-5-2": "Três zagueiros, alas que sobem muito e meio-campo povoado.",
      "4-2-3-1": "Dois volantes de proteção, meia armador e um centroavante fixo.",
      "5-3-2": "Cinco defensores, prioriza segurança e sai em velocidade."
    };
    return map[form] || "Esquema equilibrado.";
  }

  function coachObjFor(teamId, isNation) {
    if (isNation) { var n = TM.data.nation(teamId); return n ? { name: n.coach, photoKey: n.coachPhotoKey || slug(n.coach) } : null; }
    var c = TM.data.club(teamId);
    return c && c.coach ? { name: c.coach, photoKey: slug(c.coach) } : null;
  }

  function playersFor(teamId, isNation) {
    return isNation ? TM.data.nationSquad(teamId).slice() : TM.data.clubPlayers(teamId).slice();
  }
  function ratingFor(teamId, isNation) { return isNation ? TM.comp.natRating(teamId) : TM.data.clubRating(teamId); }
  function crestFor(teamId, isNation, cls) {
    return isNation ? TM.img.nationImg(TM.data.nation(teamId), cls) : TM.img.clubImg(TM.data.club(teamId), cls);
  }
  function nameFor(teamId, isNation) { return isNation ? TM.data.nation(teamId).name : TM.data.club(teamId).name; }

  function shortNm(name) { var parts = String(name).split(" "); return parts.length > 1 ? parts[0][0] + ". " + parts[parts.length - 1] : name; }

  // params: { teamId, isNation, compId, back(fn), meName }
  TM.ui.register("scout", function (screen, params) {
    params = params || {};
    var teamId = params.teamId, isNation = !!params.isNation;
    var back = typeof params.back === "function" ? params.back : function () { TM.ui.go("modes"); };
    if (!teamId) { back(); return; }

    screen.appendChild(TM.ui.topbar("🔍 Analisar adversário", back));

    var players = playersFor(teamId, isNation).sort(function (a, b) { return b.overall - a.overall; });
    var form = chooseFormation(players);
    var lu = TM.comp.buildLineup(players, form);
    var starters = lu.starters.map(function (id) { return players.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
    var slots = TM.comp.FORMATIONS[form];
    var rating = ratingFor(teamId, isNation);
    var ages = players.slice(0, 23).map(function (p) { return p.age; });
    var avgAge = ages.length ? (avg(ages)).toFixed(1) : "—";
    var ps = derivePlaystyle(starters);
    var coach = coachObjFor(teamId, isNation);

    var root = el("div", { class: "scout-wrap" });
    if (params.compId) TM.ui.applyCompTheme(root, params.compId);

    // cabeçalho do adversário
    var head = el("div", { class: "scout-head" }, [
      crestFor(teamId, isNation, "scout-crest"),
      el("div", { class: "scout-head-info" }, [
        el("div", { class: "scout-name", text: nameFor(teamId, isNation) }),
        el("div", { class: "scout-sub", text: (isNation ? "Seleção" : "Clube") + " · Força geral " }),
        TM.ui.ovBadge(rating)
      ])
    ]);
    root.appendChild(head);

    if (coach) {
      root.appendChild(el("div", { class: "scout-coach" }, [
        TM.img.coachImg(coach, "scout-coach-img"),
        el("div", {}, [ el("div", { class: "scout-coach-lbl", text: "Treinador" }), el("div", { class: "scout-coach-nm", text: coach.name }) ])
      ]));
    }

    // provável escalação (campinho só-leitura)
    root.appendChild(el("h3", { class: "block-title", text: "Provável escalação · " + form }));
    var pitch = el("div", { class: "pitch scout-pitch" });
    pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
    pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
    starters.forEach(function (p, i) {
      var slot = slots[i] || [null, 50, 50];
      pitch.appendChild(el("div", { class: "pl-chip scout-chip", style: "left:" + slot[1] + "%;top:" + slot[2] + "%" },
        TM.ui.chipKids(p, slot, { name: shortNm(p.name) })
      ));
    });
    root.appendChild(el("div", { class: "lineup-board" }, [pitch]));

    // táticas + modo de jogo
    root.appendChild(el("div", { class: "scout-cards" }, [
      el("div", { class: "scout-card" }, [
        el("div", { class: "scout-card-t", text: "🎯 Tática (" + form + ")" }),
        el("div", { class: "scout-card-d", text: tacticText(form) })
      ]),
      el("div", { class: "scout-card" }, [
        el("div", { class: "scout-card-t", text: "⚔️ Modo de jogo: " + ps.style }),
        el("div", { class: "scout-card-d", text: ps.desc }),
        el("div", { class: "scout-tags" }, [
          el("span", { class: "scout-tag", text: ps.tempo }),
          el("span", { class: "scout-tag", text: ps.build })
        ])
      ])
    ]));

    // jogadores-chave (top 3)
    root.appendChild(el("h3", { class: "block-title", text: "Jogadores-chave" }));
    var keyWrap = el("div", { class: "scout-keys" });
    players.slice(0, 3).forEach(function (p) {
      keyWrap.appendChild(el("div", { class: "scout-key", on: { click: function () { TM.ui.showPlayer(p); } } }, [
        TM.img.playerImg(p, "scout-key-face"),
        el("div", { class: "scout-key-info" }, [
          el("div", { class: "scout-key-nm", text: p.name }),
          el("div", { class: "scout-key-pos", text: (p.pos2 || p.pos) + " · " + p.age + " anos" })
        ]),
        TM.ui.ovBadge(p.overall)
      ]));
    });
    root.appendChild(keyWrap);

    // informações gerais
    var strengths = [];
    var byPos = { DF: [], MF: [], FW: [] };
    starters.forEach(function (p) { if (byPos[p.pos]) byPos[p.pos].push(p.overall); });
    var lineRatings = [
      { k: "Defesa", v: avg(byPos.DF) },
      { k: "Meio-campo", v: avg(byPos.MF) },
      { k: "Ataque", v: avg(byPos.FW) }
    ].filter(function (x) { return x.v; }).sort(function (a, b) { return b.v - a.v; });
    var best = lineRatings[0], worst = lineRatings[lineRatings.length - 1];

    root.appendChild(el("div", { class: "scout-info" }, [
      el("div", { class: "scout-info-row" }, [ el("span", { text: "Força do elenco" }), el("b", { text: String(rating) }) ]),
      el("div", { class: "scout-info-row" }, [ el("span", { text: "Idade média" }), el("b", { text: avgAge + " anos" }) ]),
      best ? el("div", { class: "scout-info-row" }, [ el("span", { text: "Setor mais forte" }), el("b", { text: best.k } ) ]) : null,
      worst && lineRatings.length > 1 ? el("div", { class: "scout-info-row" }, [ el("span", { text: "Setor mais vulnerável" }), el("b", { text: worst.k }) ]) : null
    ]));

    // dica tática contra o adversário
    var tip;
    if (worst && worst.k === "Defesa") tip = "A defesa deles é o ponto fraco — invista em velocidade e cruzamentos.";
    else if (worst && worst.k === "Meio-campo") tip = "O meio deles é frágil — pressione a saída de bola e domine o centro.";
    else if (ps.style === "Ofensivo") tip = "Eles se lançam ao ataque — cuidado com os espaços nas costas da defesa.";
    else if (ps.style === "Defensivo") tip = "Vão se fechar atrás — tenha paciência e finalizações de fora da área.";
    else tip = "Time equilibrado — controle o meio-campo para levar vantagem.";
    root.appendChild(el("div", { class: "scout-tip", text: "💡 " + tip }));

    screen.appendChild(root);
  });
})(window);
