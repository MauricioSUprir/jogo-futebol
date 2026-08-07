/* ================= TOTAL MATCH — interface e roteador ================= */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var app = null;
  var routes = {};

  /* ---------- helpers de criação de elementos ---------- */
  function el(tag, opts, children) {
    var e = document.createElement(tag);
    opts = opts || {};
    Object.keys(opts).forEach(function (k) {
      if (k === "class") e.className = opts[k];
      else if (k === "html") e.innerHTML = opts[k];
      else if (k === "text") e.textContent = opts[k];
      else if (k === "on") Object.keys(opts.on).forEach(function (ev) { e.addEventListener(ev, opts.on[ev]); });
      else if (k === "style") e.setAttribute("style", opts[k]);
      else if (k === "data") Object.keys(opts.data).forEach(function (d) { e.dataset[d] = opts.data[d]; });
      else e.setAttribute(k, opts[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- roteador ---------- */
  function register(name, renderFn) { routes[name] = renderFn; }
  var current = null;
  function go(name, params) {
    if (!routes[name]) { console.warn("rota inexistente:", name); return; }
    current = name;
    clear(app);
    var screen = el("section", { class: "screen is-active" });
    app.appendChild(screen);
    routes[name](screen, params || {});
    window.scrollTo(0, 0);
  }

  /* ---------- componentes reutilizáveis ---------- */
  // barra de topo com título e botão voltar
  function topbar(title, onBack, right) {
    return el("header", { class: "topbar" }, [
      onBack ? el("button", { class: "tb-back", text: "←", on: { click: onBack } }) : el("span", { class: "tb-back-spacer" }),
      el("h2", { class: "tb-title", text: title }),
      right || el("span", { class: "tb-right" })
    ]);
  }

  function ovBadge(overall) {
    var cls = overall >= 85 ? "ov-elite" : overall >= 78 ? "ov-high" : overall >= 68 ? "ov-mid" : "ov-low";
    return el("span", { class: "ov " + cls, text: overall });
  }

  // linha de jogador reutilizável
  function playerRow(player, opts) {
    opts = opts || {};
    var club = TM.data.club(player.clubId);
    var row = el("div", { class: "player-row" + (opts.compact ? " compact" : "") }, [
      TM.img.playerImg(player, "prow-face"),
      el("div", { class: "prow-info" }, [
        el("div", { class: "prow-name", text: player.name }),
        el("div", { class: "prow-sub", text: player.pos + " · " + player.age + " anos · " + player.nationName })
      ]),
      ovBadge(player.overall)
    ]);
    if (opts.onClick) { row.classList.add("clickable"); row.addEventListener("click", function () { opts.onClick(player); }); }
    return row;
  }

  function button(label, onClick, cls) {
    return el("button", { class: cls || "btn", text: label, on: { click: onClick } });
  }

  // pequeno toast
  function toast(msg) {
    var t = el("div", { class: "toast", text: msg });
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  // modal de detalhes do jogador (qualidades, potencial, valor, desenvolvimento)
  function showPlayer(p, opts) {
    opts = opts || {};
    var sym = opts.moneySym || "€";
    var mult = opts.moneyMult || 1;
    var overlay = el("div", { class: "modal-overlay", on: { click: function (e) { if (e.target === overlay) overlay.remove(); } } });
    var a = p.attrs || {};
    function bar(label, v) {
      return el("div", { class: "attr" }, [
        el("span", { class: "attr-label", text: label }),
        el("div", { class: "attr-bar" }, [ el("div", { class: "attr-fill", style: "width:" + v + "%" }) ]),
        el("span", { class: "attr-val", text: v })
      ]);
    }
    function info(label, val, cls) { return el("div", { class: "pd-item" }, [ el("div", { class: "pd-val " + (cls || ""), text: val }), el("div", { class: "pd-lbl", text: label }) ]); }

    var potential = p.potential || p.overall;
    var value = TM.data.marketValue ? TM.data.marketValue(p) : p.overall;
    var dev = TM.data.devRate ? TM.data.devRate(p) : "—";

    overlay.appendChild(el("div", { class: "modal" }, [
      el("button", { class: "modal-close", text: "×", on: { click: function () { overlay.remove(); } } }),
      el("div", { class: "modal-head" }, [
        (p.photo ? el("img", { src: p.photo, class: "modal-face" }) : TM.img.playerImg(p, "modal-face")),
        el("div", {}, [
          el("div", { class: "modal-name", text: p.name }),
          el("div", { class: "modal-sub", text: p.pos + " · " + p.age + " anos · " + p.nationName }),
          el("div", { class: "modal-sub", text: (p.height || "?") + " cm · " + (p.weight || "?") + " kg" })
        ]),
        ovBadge(p.overall)
      ]),
      el("div", { class: "player-detail-grid" }, [
        info("Overall", p.overall),
        info("Potencial", potential, potential > p.overall ? "up" : ""),
        info("Valor", sym + " " + Math.round(value * mult) + "M"),
        info("Desenvolvimento", dev)
      ]),
      el("h4", { class: "pd-section", text: "Qualidades" }),
      el("div", { class: "attrs" }, [
        bar("Velocidade", a.pac || 50), bar("Finalização", a.sho || 50), bar("Passe", a.pas || 50),
        bar("Drible", a.dri || 50), bar("Defesa", a.def || 50), bar("Físico", a.phy || 50)
      ])
    ]));
    document.body.appendChild(overlay);
  }

  // menu de opções (bottom sheet) — usado nos três-pontinhos das carreiras
  function optionsMenu(title, items) {
    var overlay = el("div", { class: "sheet-overlay", on: { click: function (e) { if (e.target === overlay) overlay.remove(); } } });
    var sheet = el("div", { class: "sheet" }, [ el("div", { class: "sheet-title", text: title }) ]);
    items.forEach(function (it) {
      sheet.appendChild(el("button", { class: "sheet-item" + (it.danger ? " danger" : ""), text: it.label, on: { click: function () { overlay.remove(); it.fn(); } } }));
    });
    sheet.appendChild(el("button", { class: "sheet-item cancel", text: "Cancelar", on: { click: function () { overlay.remove(); } } }));
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }

  TM.ui = {
    init: function () { app = document.getElementById("app"); },
    el: el, clear: clear, register: register, go: go,
    topbar: topbar, playerRow: playerRow, ovBadge: ovBadge, button: button, toast: toast,
    showPlayer: showPlayer, optionsMenu: optionsMenu,
    current: function () { return current; }
  };

  /* emblema/logo reutilizável (badge dourado com bola, prancheta, louros e estrela) */
  var EMBLEM =
    '<svg viewBox="0 0 200 210" role="img" aria-label="Total Match">' +
    '<defs>' +
    '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ef0a0"/><stop offset="0.5" stop-color="#22c55e"/><stop offset="1" stop-color="#118a44"/></linearGradient>' +
    '<radialGradient id="inner" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="#1c1c1c"/><stop offset="1" stop-color="#0a0a0a"/></radialGradient>' +
    '</defs>' +
    // estrela no topo
    '<path d="M100 6 l6 12 13 2 -9.5 9 2.3 13 -11.8-6.2 -11.8 6.2 2.3-13 -9.5-9 13-2 z" fill="url(#gold)"/>' +
    // louros
    '<g fill="url(#gold)" opacity="0.95">' +
    laurel(-1) + laurel(1) +
    '</g>' +
    // badge externo
    '<circle cx="100" cy="112" r="66" fill="url(#gold)"/>' +
    '<circle cx="100" cy="112" r="60" fill="url(#inner)"/>' +
    '<circle cx="100" cy="112" r="60" fill="none" stroke="#2e7d46" stroke-width="1.5" opacity="0.5"/>' +
    // prancheta atrás
    '<g transform="translate(100 112) rotate(-10)">' +
    '<rect x="-30" y="-34" width="60" height="74" rx="6" fill="#181818" stroke="url(#gold)" stroke-width="2"/>' +
    '<line x1="0" y1="-34" x2="0" y2="40" stroke="#2e7d46" stroke-width="1.4" opacity="0.7"/>' +
    '<circle cx="0" cy="3" r="10" fill="none" stroke="#2e7d46" stroke-width="1.4" opacity="0.7"/></g>' +
    // bola por cima
    '<g transform="translate(108 122)"><circle r="26" fill="#0a0a0a" stroke="url(#gold)" stroke-width="2.5"/>' +
    '<path d="M0,-18 L11,-5.5 L6.8,10 L-6.8,10 L-11,-5.5 Z" fill="url(#gold)"/>' +
    '<path d="M0,-26 L0,-18 M11,-5.5 L21,-12 M6.8,10 L16,18 M-6.8,10 L-16,18 M-11,-5.5 L-21,-12" stroke="url(#gold)" stroke-width="1.8" fill="none"/></g>' +
    '</svg>';

  function laurel(dir) {
    // ramo de louros de um lado (dir = -1 esquerda, 1 direita)
    var cx = 100 + dir * 58, out = "";
    var leaves = [[ -2, 168, 18 ], [ -10, 150, 40 ], [ -14, 132, 55 ], [ -14, 114, 68 ], [ -10, 96, 78 ]];
    leaves.forEach(function (lf) {
      var x = 100 + dir * lf[1] * 0 + dir * (66 + lf[0]); // aproximação ao longo do arco
      var px = 100 + dir * (58 + lf[0]);
      var py = lf[1] - 40;
      out += '<ellipse cx="' + px + '" cy="' + py + '" rx="4.5" ry="9" transform="rotate(' + (dir * (60 - lf[2] * 0.6)) + ' ' + px + ' ' + py + ')"/>';
    });
    return out;
  }

  function statChip(icon, text) {
    return el("div", { class: "stat-chip" }, [ el("span", { class: "chip-ic", text: icon }), el("span", { text: text }) ]);
  }

  /* =================== TELA: SPLASH =================== */
  register("splash", function (screen) {
    screen.id = "screen-splash";
    screen.appendChild(el("div", { class: "pitch-lines", "aria-hidden": "true" }));

    var content = el("div", { class: "splash-content" }, [
      el("div", { class: "emblem", "aria-hidden": "true", html: EMBLEM }),
      el("h1", { class: "game-title", html: '<span class="title-total">TOTAL</span><span class="title-match">MATCH</span>' }),
      el("p", { class: "tagline", text: "Simulação & Gestão de Futebol" }),
      el("div", { class: "stat-chips" }, [
        statChip("🎮", "4 modos de jogo"),
        statChip("🏆", "10 ligas + copas"),
        statChip("🌍", "48 seleções"),
        statChip("🎥", "Partidas ao vivo")
      ])
    ]);

    // acesso rápido a carreiras salvas
    var quick = el("div", { class: "quick-continue" });
    if (TM.storage.coachCareer()) quick.appendChild(el("button", { class: "continue-btn", html: "🎯 Continuar como treinador", on: { click: function () { go("coach-hub"); } } }));
    if (TM.storage.playerCareer()) quick.appendChild(el("button", { class: "continue-btn", html: "⭐ Continuar como jogador", on: { click: function () { go("player-hub"); } } }));
    if (quick.children.length) content.appendChild(quick);

    content.appendChild(el("button", { class: "btn-start", text: "TOQUE PARA COMEÇAR", on: { click: function () { go("modes"); } } }));
    content.appendChild(el("p", { class: "version", text: "v0.3 — protótipo jogável" }));
    screen.appendChild(content);
  });

  /* curiosidades de futebol + dicas do jogo (rotativas no menu) */
  var FACTS = [
    { t: "⚽ Total Match", d: "Um simulador de futebol com foco em gestão e carreira — do banco de reservas ao título continental." },
    { t: "🏆 Champions League", d: "O Real Madrid é o maior campeão da história, com 15 títulos." },
    { t: "🌎 Copa do Mundo", d: "O Brasil é o único país pentacampeão mundial (1958, 62, 70, 94 e 2002)." },
    { t: "🥇 Bola de Ouro", d: "Lionel Messi é o maior vencedor da história, com 8 troféus." },
    { t: "🇧🇷 Libertadores", d: "O Flamengo é tricampeão da Libertadores: 1981, 2019 e 2022." },
    { t: "👑 Rei Pelé", d: "Pelé é o único jogador tricampeão do mundo por uma seleção." },
    { t: "🔥 Artilharia", d: "Cristiano Ronaldo é o maior goleador da história do futebol." },
    { t: "💡 Dica do jogo", d: "No Realismo baixo, rolam mais gols e zebras. No alto, os melhores vencem mais." },
    { t: "💡 Dica de mercado", d: "Na carreira, negocie primeiro com o clube e depois acerte com o jogador." },
    { t: "🇮🇹 Milan & Liverpool", d: "Milan (7) e Liverpool (6) estão entre os maiores campeões europeus." },
    { t: "⭐ Seleções", d: "A cada 4 anos rola a Copa do Mundo — fique de olho na convocação!" }
  ];

  register("modes", function (screen) {
    var MODES = [
      { icon: "⚡", name: "Partida Rápida", route: "quick", desc: "Simule uma partida na hora" },
      { icon: "🎯", name: "Carreira de Treinador", route: "coach", desc: "Comande um clube ou seleção" },
      { icon: "⭐", name: "Carreira de Jogador", route: "player", desc: "Viva a carreira do seu craque" },
      { icon: "⚙️", name: "Configurações", route: "settings", desc: "Dificuldade, realismo e mais" }
    ];

    screen.appendChild(el("header", { class: "modes-topbar" }, [
      el("div", { class: "modes-emblem", html: EMBLEM }),
      el("div", {}, [ el("div", { class: "mini-logo", html: 'TOTAL<span>MATCH</span>' }), el("div", { class: "modes-sub", text: "Escolha um modo" }) ]),
      el("button", { class: "btn-back small-back", text: "←", on: { click: function () { go("splash"); } } })
    ]));

    var layout = el("div", { class: "modes-layout" });
    var sidebar = el("nav", { class: "modes-sidebar" });
    MODES.forEach(function (m) {
      sidebar.appendChild(el("button", { class: "side-item", on: { click: function () { go(m.route); } } }, [
        el("span", { class: "side-ic", text: m.icon }),
        el("span", { class: "side-info" }, [ el("span", { class: "side-name", text: m.name }), el("span", { class: "side-desc", text: m.desc }) ]),
        el("span", { class: "side-arrow", text: "→" })
      ]));
    });

    // painel de curiosidades rotativas
    var factCard = el("div", { class: "fact-card" });
    var factTitle = el("div", { class: "fact-title" });
    var factText = el("div", { class: "fact-text" });
    factCard.appendChild(el("div", { class: "fact-eyebrow", text: "VOCÊ SABIA?" }));
    factCard.appendChild(factTitle);
    factCard.appendChild(factText);
    var dots = el("div", { class: "fact-dots" });
    factCard.appendChild(dots);

    var idx = 0;
    function showFact(i) {
      var f = FACTS[i];
      factCard.classList.remove("fade"); void factCard.offsetWidth; factCard.classList.add("fade");
      factTitle.textContent = f.t; factText.textContent = f.d;
    }
    showFact(0);
    var timer = setInterval(function () {
      if (!screen.isConnected) { clearInterval(timer); return; }
      idx = (idx + 1) % FACTS.length; showFact(idx);
    }, 4500);

    layout.appendChild(sidebar);
    layout.appendChild(factCard);
    screen.appendChild(layout);
  });
})(window);
