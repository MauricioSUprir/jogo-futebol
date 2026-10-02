/* ================= TOTAL MATCH — 10 menus para escolher =================
   Cada um é a tela inicial de verdade, com os dados reais (clubes, moedas,
   perfil, save em andamento). Abra com ?menu=1 ... ?menu=10 ou pelas telas
   menu1..menu10. Depois que você escolher, o escolhido vira o menu e este
   arquivo sai do jogo. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var MB = "assets/menu/";

  /* ---------- conteúdo (igual para os 10) ---------- */
  function temSave() { try { return !!TM.storage.coachCareer(); } catch (e) { return false; } }
  function nomeSave() { try { var c = TM.storage.coachCareer(); return (c && c.teamName) || ""; } catch (e) { return ""; } }
  function mundo() {
    var o = { clubes: 0, jogadores: 0, ligas: 0 };
    try { var W = TM.data.world(); o.clubes = (W.clubs || []).length; o.jogadores = Object.keys(W.playersById || {}).length; o.ligas = (W.leagues || []).length; } catch (e) {}
    return o;
  }
  function versao() { try { return TM.versao ? TM.versao() : ""; } catch (e) { return ""; } }

  var MODOS = [
    { id: "coach",    cat: "CARREIRA", nome: "Carreira de Treinador", curto: "Treinador", ic: "🎯", tag: "Do banco ao topo do mundo", bg: MB + "coach.jpg" },
    { id: "rae",      cat: "CARREIRA", nome: "Rumo ao Estrelato",     curto: "Jogador",   ic: "🌟", tag: "A semana é o jogo",          bg: MB + "trophy.jpg" },
    { id: "quick",    cat: "JOGAR",    nome: "Partida Rápida",        curto: "Rápida",    ic: "⚡", tag: "Dois times, agora",          bg: MB + "match.jpg" },
    { id: "compmode", cat: "JOGAR",    nome: "Competições",           curto: "Copas",     ic: "🏆", tag: "Ligas, copas e seleções",    bg: MB + "trophy.jpg" },
    { id: "ut",       cat: "CARTAS",   nome: "Total Ultimate",        curto: "Ultimate",  ic: "🃏", tag: "Pacotes, química, divisões", bg: MB + "director.jpg" },
    { id: "online",   cat: "ONLINE",   nome: "Online",                curto: "Online",    ic: "🌐", tag: "Desafie pelo seu número",    bg: MB + "online.jpg" },
    { id: "copa",     cat: "ONLINE",   nome: "Copa Online",           curto: "Copa",      ic: "🏅", tag: "Entra por código, bot completa", bg: MB + "online.jpg" }
  ];
  var MAIS = [
    { id: "dream", ic: "💎", nome: "Dream Team" }, { id: "draft", ic: "🎲", nome: "Draft" },
    { id: "arena", ic: "🪙", nome: "Arena" },      { id: "groupcomp", ic: "🏟️", nome: "Grupo" },
    { id: "editor", ic: "✏️", nome: "Editor" },    { id: "saves", ic: "💾", nome: "Carreiras" },
    { id: "competicoes", ic: "🎖️", nome: "Info" }, { id: "settings", ic: "⚙️", nome: "Config" },
    { id: "profile", ic: "👤", nome: "Perfil" }
  ];

  function vai(rota) { return function () { TM.ui.go(rota); }; }
  function topo(screen, classe) {
    var m = mundo();
    screen.appendChild(el("div", { class: "mt-topo " + (classe || "") }, [
      el("div", { class: "mt-marca" }, [
        el("img", { class: "mt-logo", src: (global.TM_LOGO || "assets/logo.png"), alt: "Total Match" }),
        el("div", {}, [
          el("div", { class: "mt-nome", text: "TOTAL MATCH" }),
          el("div", { class: "mt-sub", text: temSave() ? "Carreira: " + (nomeSave() || "em andamento") : m.ligas + " ligas · " + m.clubes + " clubes · " + versao() })
        ])
      ]),
      el("div", { class: "mt-acoes" }, [
        (TM.coins ? TM.coins.badge("mt-coins") : el("span")),
        el("button", { class: "mt-ic", text: "👤", title: "Perfil", on: { click: vai("profile") } }),
        el("button", { class: "mt-ic", text: "⚙️", title: "Configurações", on: { click: vai("settings") } })
      ])
    ]));
  }
  function rodape(screen, n, nome) {
    screen.appendChild(el("div", { class: "mt-rodape", text: "Modelo " + n + " — " + nome }));
  }
  function grade(lista, classe) {
    return el("div", { class: classe || "mt-mais" }, lista.map(function (x) {
      return el("button", { class: "mt-mais-b", on: { click: vai(x.id) } }, [
        el("span", { class: "mt-mais-ic", text: x.ic }), el("span", { text: x.nome })
      ]);
    }));
  }

  /* ================== COM IMAGEM ================== */

  /* 1 — CARTAZ: uma foto por vez, ocupando a tela, tipografia de cartaz */
  TM.ui.register("menu1", function (screen) {
    screen.classList.add("mt", "mt1");
    var i = 0;
    var palco = el("div", { class: "mt1-palco" });
    screen.appendChild(palco);
    topo(screen, "sobre");
    function desenha() {
      TM.ui.clear(palco);
      var m = MODOS[i];
      palco.appendChild(el("div", { class: "mt1-foto", style: "background-image:url(" + m.bg + ")" }));
      palco.appendChild(el("div", { class: "mt1-veu" }));
      palco.appendChild(el("div", { class: "mt1-txt" }, [
        el("div", { class: "mt1-num", text: String(i + 1).padStart(2, "0") + " / " + String(MODOS.length).padStart(2, "0") }),
        el("div", { class: "mt1-cat", text: m.cat }),
        el("div", { class: "mt1-nome", text: m.nome }),
        el("div", { class: "mt1-tag", text: m.tag }),
        el("button", { class: "mt1-cta", text: "JOGAR", on: { click: vai(m.id) } })
      ]));
      palco.appendChild(el("div", { class: "mt1-setas" }, [
        el("button", { class: "mt1-seta", text: "‹", on: { click: function () { i = (i - 1 + MODOS.length) % MODOS.length; desenha(); } } }),
        el("div", { class: "mt1-pontos" }, MODOS.map(function (_, k) { return el("span", { class: "mt1-ponto" + (k === i ? " on" : "") }); })),
        el("button", { class: "mt1-seta", text: "›", on: { click: function () { i = (i + 1) % MODOS.length; desenha(); } } })
      ]));
    }
    desenha();
    screen.appendChild(grade(MAIS.slice(0, 6), "mt-mais fino"));
    rodape(screen, 1, "Cartaz");
  });

  /* 2 — MOSAICO: um destaque grande e o resto em peças de tamanhos diferentes */
  TM.ui.register("menu2", function (screen) {
    screen.classList.add("mt", "mt2");
    topo(screen);
    var g = el("div", { class: "mt2-grade" });
    MODOS.forEach(function (m, k) {
      g.appendChild(el("button", { class: "mt2-peca p" + k, style: "background-image:url(" + m.bg + ")", on: { click: vai(m.id) } }, [
        el("span", { class: "mt2-veu" }),
        el("span", { class: "mt2-cat", text: m.cat }),
        el("span", { class: "mt2-nome", text: k === 0 ? m.nome : m.curto }),
        k === 0 ? el("span", { class: "mt2-tag", text: m.tag }) : null
      ].filter(Boolean)));
    });
    screen.appendChild(g);
    screen.appendChild(grade(MAIS));
    rodape(screen, 2, "Mosaico");
  });

  /* 3 — REVISTA: capa com manchete e os modos como pauta numerada */
  TM.ui.register("menu3", function (screen) {
    screen.classList.add("mt", "mt3");
    topo(screen);
    var capa = MODOS[0];
    screen.appendChild(el("div", { class: "mt3-capa", style: "background-image:url(" + capa.bg + ")" }, [
      el("div", { class: "mt3-faixa" }, [
        el("div", { class: "mt3-chapeu", text: "EDIÇÃO " + (versao() || "") }),
        el("div", { class: "mt3-manchete", text: capa.nome }),
        el("div", { class: "mt3-linha", text: capa.tag }),
        el("button", { class: "mt3-cta", text: "COMEÇAR →", on: { click: vai(capa.id) } })
      ])
    ]));
    var lista = el("div", { class: "mt3-pauta" });
    MODOS.slice(1).forEach(function (m, k) {
      lista.appendChild(el("button", { class: "mt3-item", on: { click: vai(m.id) } }, [
        el("span", { class: "mt3-n", text: String(k + 2).padStart(2, "0") }),
        el("span", { class: "mt3-mini", style: "background-image:url(" + m.bg + ")" }),
        el("span", { class: "mt3-info" }, [
          el("span", { class: "mt3-nome", text: m.nome }),
          el("span", { class: "mt3-tag", text: m.tag })
        ]),
        el("span", { class: "mt3-seta", text: "→" })
      ]));
    });
    screen.appendChild(lista);
    screen.appendChild(grade(MAIS));
    rodape(screen, 3, "Revista");
  });

  /* 4 — INGRESSO: cada modo é um bilhete de estádio, com picote e canhoto */
  TM.ui.register("menu4", function (screen) {
    screen.classList.add("mt", "mt4");
    topo(screen);
    var caixa = el("div", { class: "mt4-pilha" });
    MODOS.forEach(function (m, k) {
      caixa.appendChild(el("button", { class: "mt4-bilhete", on: { click: vai(m.id) } }, [
        el("span", { class: "mt4-canhoto", style: "background-image:url(" + m.bg + ")" }, [ el("span", { class: "mt4-ic", text: m.ic }) ]),
        el("span", { class: "mt4-picote" }),
        el("span", { class: "mt4-corpo" }, [
          el("span", { class: "mt4-cat", text: m.cat + " · SETOR " + String.fromCharCode(65 + k) }),
          el("span", { class: "mt4-nome", text: m.nome }),
          el("span", { class: "mt4-tag", text: m.tag }),
          el("span", { class: "mt4-cod", text: "TM-" + String(1000 + k * 37) })
        ])
      ]));
    });
    screen.appendChild(caixa);
    screen.appendChild(grade(MAIS));
    rodape(screen, 4, "Ingresso");
  });

  /* 5 — VITRINE: carrossel na horizontal com as cartas inclinadas */
  TM.ui.register("menu5", function (screen) {
    screen.classList.add("mt", "mt5");
    topo(screen);
    var i = 0;
    var trilho = el("div", { class: "mt5-trilho" });
    var legenda = el("div", { class: "mt5-legenda" });
    function desenha() {
      TM.ui.clear(trilho); TM.ui.clear(legenda);
      MODOS.forEach(function (m, k) {
        var d = k - i;
        trilho.appendChild(el("button", { class: "mt5-carta" + (d === 0 ? " centro" : ""),
          style: "background-image:url(" + m.bg + ");transform:translateX(" + (d * 62) + "%) scale(" + (d === 0 ? 1 : 0.78) + ") rotateY(" + (d * -16) + "deg);z-index:" + (20 - Math.abs(d)) + ";opacity:" + (Math.abs(d) > 2 ? 0 : 1),
          on: { click: function () { if (d === 0) TM.ui.go(m.id); else { i = k; desenha(); } } } }, [
          el("span", { class: "mt5-veu" }), el("span", { class: "mt5-ic", text: m.ic })
        ]));
      });
      var m = MODOS[i];
      legenda.appendChild(el("div", { class: "mt5-cat", text: m.cat }));
      legenda.appendChild(el("div", { class: "mt5-nome", text: m.nome }));
      legenda.appendChild(el("div", { class: "mt5-tag", text: m.tag }));
      legenda.appendChild(el("button", { class: "mt5-cta", text: "ENTRAR", on: { click: vai(m.id) } }));
      legenda.appendChild(el("div", { class: "mt5-nav" }, MODOS.map(function (_, k) {
        return el("button", { class: "mt5-p" + (k === i ? " on" : ""), on: { click: function () { i = k; desenha(); } } });
      })));
    }
    screen.appendChild(el("div", { class: "mt5-palco" }, [ trilho ]));
    screen.appendChild(legenda);
    desenha();
    screen.appendChild(grade(MAIS));
    rodape(screen, 5, "Vitrine");
  });

  /* ================== SEM IMAGEM ================== */

  /* 6 — PLACAR: painel de LED, números grandes, modos como tabela de jogos */
  TM.ui.register("menu6", function (screen) {
    screen.classList.add("mt", "mt6");
    topo(screen, "led");
    var m = mundo();
    screen.appendChild(el("div", { class: "mt6-painel" }, [
      el("div", { class: "mt6-linha" }, [ el("span", { class: "mt6-lbl", text: "LIGAS" }), el("span", { class: "mt6-num", text: String(m.ligas).padStart(3, "0") }) ]),
      el("div", { class: "mt6-linha" }, [ el("span", { class: "mt6-lbl", text: "CLUBES" }), el("span", { class: "mt6-num", text: String(m.clubes).padStart(3, "0") }) ]),
      el("div", { class: "mt6-linha" }, [ el("span", { class: "mt6-lbl", text: "ATLETAS" }), el("span", { class: "mt6-num", text: String(Math.round(m.jogadores / 1000)).padStart(3, "0") + "K" }) ])
    ]));
    var tab = el("div", { class: "mt6-tab" });
    MODOS.forEach(function (x, k) {
      tab.appendChild(el("button", { class: "mt6-jogo", on: { click: vai(x.id) } }, [
        el("span", { class: "mt6-h", text: String(k + 1).padStart(2, "0") }),
        el("span", { class: "mt6-nm", text: x.nome.toUpperCase() }),
        el("span", { class: "mt6-cat", text: x.cat }),
        el("span", { class: "mt6-go", text: "▶" })
      ]));
    });
    screen.appendChild(tab);
    screen.appendChild(grade(MAIS));
    rodape(screen, 6, "Placar");
  });

  /* 7 — TÁTICO: quadro de pranchetas, os modos posicionados em campo */
  TM.ui.register("menu7", function (screen) {
    screen.classList.add("mt", "mt7");
    topo(screen, "prancheta");
    var campo = el("div", { class: "mt7-campo" }, [
      el("div", { class: "mt7-meio" }), el("div", { class: "mt7-circ" }),
      el("div", { class: "mt7-area cima" }), el("div", { class: "mt7-area baixo" })
    ]);
    var POS = [[50, 14], [22, 32], [78, 32], [50, 45], [22, 62], [78, 62], [50, 80]];
    MODOS.forEach(function (m, k) {
      var p = POS[k] || [50, 50];
      campo.appendChild(el("button", { class: "mt7-pino", style: "left:" + p[0] + "%;top:" + p[1] + "%", on: { click: vai(m.id) } }, [
        el("span", { class: "mt7-bola", text: m.ic }),
        el("span", { class: "mt7-rot", text: m.curto })
      ]));
    });
    screen.appendChild(campo);
    screen.appendChild(el("div", { class: "mt7-nota", text: "Toque numa posição para entrar no modo." }));
    screen.appendChild(grade(MAIS));
    rodape(screen, 7, "Tático");
  });

  /* 8 — BRUTALISTA: tipografia gigante, blocos duros, nada de canto redondo */
  TM.ui.register("menu8", function (screen) {
    screen.classList.add("mt", "mt8");
    topo(screen, "duro");
    var l = el("div", { class: "mt8-lista" });
    MODOS.forEach(function (m, k) {
      l.appendChild(el("button", { class: "mt8-faixa" + (k % 3 === 0 ? " verde" : k % 3 === 1 ? " clara" : ""), on: { click: vai(m.id) } }, [
        el("span", { class: "mt8-n", text: String(k + 1) }),
        el("span", { class: "mt8-nome", text: m.nome.toUpperCase() }),
        el("span", { class: "mt8-tag", text: m.tag })
      ]));
    });
    screen.appendChild(l);
    screen.appendChild(grade(MAIS, "mt-mais duro"));
    rodape(screen, 8, "Brutalista");
  });

  /* 9 — TERMINAL: o jogo como sistema, fonte monoespaçada e cursor piscando */
  TM.ui.register("menu9", function (screen) {
    screen.classList.add("mt", "mt9");
    var m = mundo();
    screen.appendChild(el("div", { class: "mt9-janela" }, [
      el("div", { class: "mt9-barra" }, [
        el("span", { class: "mt9-pt r" }), el("span", { class: "mt9-pt a" }), el("span", { class: "mt9-pt v" }),
        el("span", { class: "mt9-tit", text: "total-match " + (versao() || "") })
      ]),
      el("div", { class: "mt9-corpo" }, [
        el("div", { class: "mt9-l", text: "$ totalmatch --status" }),
        el("div", { class: "mt9-o", text: "ligas " + m.ligas + "  clubes " + m.clubes + "  atletas " + m.jogadores }),
        el("div", { class: "mt9-o", text: temSave() ? "carreira em andamento: " + (nomeSave() || "sim") : "nenhuma carreira em andamento" }),
        el("div", { class: "mt9-l", text: "$ totalmatch --modos" })
      ].concat(MODOS.map(function (x, k) {
        return el("button", { class: "mt9-cmd", on: { click: vai(x.id) } }, [
          el("span", { class: "mt9-seta", text: "›" }),
          el("span", { class: "mt9-cmd-n", text: x.nome.toLowerCase().replace(/\s+/g, "-") }),
          el("span", { class: "mt9-cmd-d", text: "# " + x.tag })
        ]);
      })).concat([ el("div", { class: "mt9-l cursor", text: "$ " }) ]))
    ]));
    screen.appendChild(grade(MAIS, "mt-mais mono"));
    rodape(screen, 9, "Terminal");
  });

  /* 10 — CARTELA: cartões limpos, ícone grande e uma cor por categoria */
  TM.ui.register("menu10", function (screen) {
    screen.classList.add("mt", "mt10");
    topo(screen, "claro");
    if (temSave()) {
      screen.appendChild(el("button", { class: "mt10-retomar", on: { click: vai("coach-hub") } }, [
        el("span", { class: "mt10-r-ic", text: "▶" }),
        el("span", {}, [ el("span", { class: "mt10-r-t", text: "Continuar carreira" }), el("span", { class: "mt10-r-s", text: nomeSave() || "de onde você parou" }) ])
      ]));
    }
    var g = el("div", { class: "mt10-grade" });
    MODOS.forEach(function (m) {
      g.appendChild(el("button", { class: "mt10-cart c-" + m.cat.toLowerCase(), on: { click: vai(m.id) } }, [
        el("span", { class: "mt10-ic", text: m.ic }),
        el("span", { class: "mt10-nome", text: m.nome }),
        el("span", { class: "mt10-tag", text: m.tag }),
        el("span", { class: "mt10-cat", text: m.cat })
      ]));
    });
    screen.appendChild(g);
    screen.appendChild(grade(MAIS));
    rodape(screen, 10, "Cartela");
  });

  // abrir direto por ?menu=N
  try {
    var q = new global.URLSearchParams(global.location.search);
    var n = parseInt(q.get("menu") || "", 10);
    if (n >= 1 && n <= 10) {
      var antes = TM.ui.go;
      TM.ui.go = function (nome, p) { return antes(nome === "modes" ? ("menu" + n) : nome, p); };
    }
  } catch (e) {}
})(window);
