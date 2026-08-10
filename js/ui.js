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
    try {
      routes[name](screen, params || {});
    } catch (err) {
      // evita "tela preta": qualquer erro ao renderizar vira uma tela de recuperação
      console.error("Erro ao abrir a tela '" + name + "':", err);
      clear(screen);
      var isCoach = name.indexOf("coach") === 0, isPlayer = name.indexOf("player") === 0;
      screen.appendChild(el("div", { class: "route-error" }, [
        el("div", { class: "re-emoji", text: "⚠️" }),
        el("h2", { text: "Não foi possível abrir esta tela" }),
        el("p", { text: "Isso costuma acontecer com um jogo salvo de uma versão anterior. Você pode voltar ao menu ou reiniciar esta carreira." }),
        el("p", { class: "re-detail", text: (err && err.message) ? String(err.message) : "" }),
        el("button", { class: "btn primary big", text: "🏠 Voltar ao menu", on: { click: function () { go("modes"); } } }),
        (isCoach ? el("button", { class: "btn danger big", text: "🗑️ Reiniciar carreira de treinador", on: { click: function () { try { TM.storage.clearCoachCareer(); } catch (e) {} go("modes"); } } }) : null),
        (isPlayer ? el("button", { class: "btn danger big", text: "🗑️ Reiniciar carreira de jogador", on: { click: function () { try { TM.storage.clearPlayerCareer && TM.storage.clearPlayerCareer(); } catch (e) {} go("modes"); } } }) : null)
      ]));
    }
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

  // linha de jogador reutilizável (com bandeira placeholder da nacionalidade)
  function playerRow(player, opts) {
    opts = opts || {};
    var nation = player.nationId ? TM.data.nation(player.nationId) : null;
    var subKids = [
      el("span", { class: "prow-pos pos-" + (player.pos || "MF"), text: TM.data.posLabel(player) }),
      document.createTextNode(" · " + player.age + " anos")
    ];
    var natEl = el("span", { class: "prow-nat" }, [
      nation ? TM.img.nationImg(nation, "prow-flag") : null,
      el("span", { text: player.nationName || (nation && nation.name) || "" })
    ]);
    var kids = [
      TM.img.playerImg(player, "prow-face"),
      el("div", { class: "prow-info" }, [
        el("div", { class: "prow-name", text: player.name }),
        el("div", { class: "prow-sub" }, subKids),
        natEl
      ])
    ];
    // escudo do clube atual (mercado, central de transferências, etc.)
    if (opts.showClub && player.clubId) {
      var club = TM.data.club(player.clubId);
      if (club) kids.push(el("div", { class: "prow-club" }, [ TM.img.clubImg(club, "prow-club-crest") ]));
    }
    kids.push(ovBadge(player.overall));
    var row = el("div", { class: "player-row" + (opts.compact ? " compact" : "") }, kids);
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
          el("div", { class: "modal-sub", text: TM.data.posLabel(p) + " · " + p.age + " anos · " + p.nationName }),
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

  // confirmação própria (window.confirm costuma ser bloqueado em páginas publicadas)
  function confirmSheet(title, message, confirmLabel, onYes, danger) {
    var overlay = el("div", { class: "sheet-overlay", on: { click: function (e) { if (e.target === overlay) overlay.remove(); } } });
    var sheet = el("div", { class: "sheet" }, [
      el("div", { class: "sheet-title", text: title }),
      message ? el("div", { class: "sheet-msg", text: message }) : null,
      el("button", { class: "sheet-item" + (danger ? " danger" : ""), text: confirmLabel, on: { click: function () { overlay.remove(); onYes(); } } }),
      el("button", { class: "sheet-item cancel", text: "Cancelar", on: { click: function () { overlay.remove(); } } })
    ]);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }

  function applyTheme(theme) {
    if (!theme) { try { theme = TM.storage.settings().theme; } catch (e) { theme = "dark"; } }
    document.body.classList.toggle("theme-light", theme === "light");
  }

  /* ---------- tema por competição (cor de destaque + logo) ---------- */
  var COMP_ACCENT = {
    "lg-br": "#2fe86b", "lg-en": "#b14bff", "lg-es": "#ff5a3c", "lg-it": "#3aa0ff", "lg-de": "#ff3b3b", "lg-fr": "#dfe600",
    "lg-pt": "#2ee6a0", "lg-nl": "#ff7a1a", "lg-ar": "#7ec8ff", "lg-us": "#d6b24a", "lg-mx": "#2ee66b", "lg-sa": "#20c98a",
    "lg-tr": "#ff4d4d", "lg-ec": "#ffd21a", "lg-uy": "#7ec8ff", "lg-ru": "#5a86ff",
    "cont-sa": "#f2c21a", "cont-eu": "#2f8bff", "cont-na": "#00c2b8", "cont-as": "#00d4c2",
    "cwc-world": "#e8c65a", "cwc-inter": "#c9a24a",
    "nat-world": "#e8c65a", "nat-america": "#2fe86b", "nat-euro": "#2f8bff", "nat-africa": "#2ee66b"
  };
  function compAccent(compId) {
    if (!compId) return null;
    if (COMP_ACCENT[compId]) return COMP_ACCENT[compId];
    if (compId.indexOf("cup-") === 0 && COMP_ACCENT["lg-" + compId.slice(4)]) return COMP_ACCENT["lg-" + compId.slice(4)];
    var comp = TM.data.competition(compId);
    return comp && comp.colors ? comp.colors.primary : null;
  }
  function shade(hex, p) { // p<0 escurece, p>0 clareia
    hex = String(hex).replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (x) { return x + x; }).join("");
    var n = parseInt(hex, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p))); }
    return "#" + [f(r), f(g), f(b)].map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("");
  }
  function applyCompTheme(elm, compId) {
    var col = compAccent(compId);
    if (!col || !elm) return null;
    elm.style.setProperty("--gold", col);
    elm.style.setProperty("--gold-light", shade(col, 0.22));
    elm.style.setProperty("--gold-dark", shade(col, -0.28));
    return col;
  }
  function compBanner(compId, subtitle) {
    var comp = TM.data.competition(compId);
    if (!comp) return null;
    var banner = el("div", { class: "comp-banner" }, [
      TM.img.compImg(comp, "comp-banner-logo"),
      el("div", { class: "comp-banner-txt" }, [
        el("div", { class: "comp-banner-name", text: comp.name }),
        subtitle ? el("div", { class: "comp-banner-sub", text: subtitle }) : null
      ])
    ]);
    applyCompTheme(banner, compId);
    return banner;
  }

  TM.ui = {
    init: function () { app = document.getElementById("app"); applyTheme(); },
    el: el, clear: clear, register: register, go: go,
    topbar: topbar, playerRow: playerRow, ovBadge: ovBadge, button: button, toast: toast,
    showPlayer: showPlayer, optionsMenu: optionsMenu, confirm: confirmSheet,
    applyTheme: applyTheme, compAccent: compAccent, applyCompTheme: applyCompTheme, compBanner: compBanner,
    current: function () { return current; }
  };

  /* emblema/logo — escudo moderno com bola e estrela */
  var EMBLEM =
    '<svg viewBox="0 0 200 210" role="img" aria-label="Total Match">' +
    '<defs>' +
    '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ef0a0"/><stop offset="0.5" stop-color="#22c55e"/><stop offset="1" stop-color="#0f8a42"/></linearGradient>' +
    '<linearGradient id="inner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1a1a"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient>' +
    '<radialGradient id="glow" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="rgba(34,197,94,0.35)"/><stop offset="1" stop-color="rgba(34,197,94,0)"/></radialGradient>' +
    '</defs>' +
    '<ellipse cx="100" cy="112" rx="86" ry="92" fill="url(#glow)"/>' +
    // estrela no topo
    '<path d="M100 8 l5 11 12 1.6 -8.8 8.4 2.2 12 -10.6-5.8 -10.6 5.8 2.2-12 -8.8-8.4 12-1.6 z" fill="url(#gold)"/>' +
    // escudo externo (borda verde)
    '<path d="M100 26 L170 46 V106 C170 152 138 180 100 194 C62 180 30 152 30 106 V46 Z" fill="url(#gold)"/>' +
    // escudo interno (fundo escuro)
    '<path d="M100 37 L159 54 V106 C159 145 132 169 100 181 C68 169 41 145 41 106 V54 Z" fill="url(#inner)"/>' +
    // faixa superior
    '<path d="M100 37 L159 54 V70 H41 V54 Z" fill="#22c55e" opacity="0.22"/>' +
    // arco de gramado sutil
    '<path d="M55 150 A 55 44 0 0 1 145 150" fill="none" stroke="#22c55e" stroke-width="1.5" opacity="0.25"/>' +
    // bola
    '<g transform="translate(100 108)"><circle r="30" fill="#0a0a0a" stroke="url(#gold)" stroke-width="3"/>' +
    '<path d="M0,-20 L13,-6.2 L7.6,11 L-7.6,11 L-13,-6.2 Z" fill="url(#gold)"/>' +
    '<path d="M0,-30 L0,-20 M13,-6.2 L24,-14 M7.6,11 L18,20 M-7.6,11 L-18,20 M-13,-6.2 L-24,-14" stroke="url(#gold)" stroke-width="2" fill="none"/>' +
    '<circle cx="0" cy="-25" r="2.2" fill="url(#gold)"/><circle cx="22" cy="-8" r="2.2" fill="url(#gold)"/><circle cx="14" cy="17" r="2.2" fill="url(#gold)"/><circle cx="-14" cy="17" r="2.2" fill="url(#gold)"/><circle cx="-22" cy="-8" r="2.2" fill="url(#gold)"/></g>' +
    // sigla
    '<text x="100" y="168" font-family="Arial" font-size="15" font-weight="800" fill="#22c55e" text-anchor="middle" letter-spacing="1">TM</text>' +
    '</svg>';

  function statChip(icon, text) {
    return el("div", { class: "stat-chip" }, [ el("span", { class: "chip-ic", text: icon }), el("span", { text: text }) ]);
  }

  /* =================== TELA: SPLASH =================== */
  register("splash", function (screen) {
    screen.id = "screen-splash";
    screen.appendChild(el("div", { class: "pitch-lines", "aria-hidden": "true" }));

    var content = el("div", { class: "splash-content" }, [
      el("img", { class: "splash-logo", src: (global.TM_LOGO || "assets/logo.png"), alt: "Total Match" }),
      el("h1", { class: "game-title", html: '<span class="title-total">TOTAL</span><span class="title-match">MATCH</span>' }),
      el("div", { class: "stat-chips" }, [
        statChip("🎮", "4 modos de jogo"),
        statChip("🏆", "10 ligas + copas"),
        statChip("🌍", "48 seleções"),
        statChip("🎥", "Partidas ao vivo")
      ])
    ]);

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
      { icon: "⚡", name: "Partida Rápida", route: "quick" },
      { icon: "🎯", name: "Master League", route: "coach" },
      { icon: "⭐", name: "Rumo ao Estrelato", route: "player" },
      { icon: "🏆", name: "Jogar Competição", route: "compmode" },
      { icon: "🎖️", name: "Informações", route: "competicoes" },
      { icon: "💾", name: "Minhas Carreiras", route: "saves" },
      { icon: "⚙️", name: "Configurações", route: "settings" }
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
        el("span", { class: "side-info" }, [ el("span", { class: "side-name", text: m.name }) ]),
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

  /* ---------- Galeria de Competições (espaço para os logos) ---------- */
  register("competicoes", function (screen) {
    screen.appendChild(topbar("🎖️ Informações", function () { go("modes"); }));
    screen.appendChild(el("p", { class: "intro-text", style: "text-align:center", text: "Todas as competições do jogo. Clique numa competição e depois num time para ver o elenco." }));
    var groups = [
      ["liga", "🏟️ Ligas Nacionais"],
      ["copa", "🏆 Copas Nacionais"],
      ["continental", "🌍 Continentais de Clubes"],
      ["mundial", "🌎 Mundiais de Clubes"],
      ["selecao", "🏳️ Copas de Seleções"]
    ];
    var comps = TM.data.competitions();
    groups.forEach(function (g) {
      var list = comps.filter(function (c) { return c.type === g[0]; });
      if (!list.length) return;
      screen.appendChild(el("h3", { class: "block-title comp-group", text: g[1] }));
      var grid = el("div", { class: "comp-grid" });
      list.forEach(function (c) {
        grid.appendChild(el("div", { class: "comp-card", on: { click: function () { go("competicao-times", { id: c.id }); } } }, [
          TM.img.compImg(c, "comp-logo"),
          el("div", { class: "comp-name", text: c.name })
        ]));
      });
      screen.appendChild(grid);
    });
  });

  // times que disputam uma competição
  register("competicao-times", function (screen, params) {
    var comp = TM.data.competition(params.id);
    if (!comp) { go("competicoes"); return; }
    screen.appendChild(topbar(comp.name, function () { go("competicoes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "comp-head", style: "justify-content:center" }, [ TM.img.compImg(comp, "comp-head-logo") ]));
    var info = TM.data.competitionTeams(comp.id);
    if (info.dynamic || (!info.teamIds.length)) {
      body.appendChild(el("p", { class: "intro-text", style: "text-align:center", text: comp.id === "cwc-inter"
        ? "Sem clubes fixos. É disputado no fim da temporada, em jogo único, entre o campeão da Libertadores e o campeão da Champions League — jogável nos modos Carreira."
        : "Nenhum clube nesta competição ainda." }));
      return;
    }
    var teams = info.teamIds.map(function (id) {
      return info.isNation
        ? { id: id, name: TM.data.nation(id).name, img: TM.img.nationImg(TM.data.nation(id), "cp-crest"), rating: null }
        : { id: id, name: TM.data.club(id).name, img: TM.img.clubImg(TM.data.club(id), "cp-crest"), rating: TM.data.clubRating(id) };
    });
    if (!info.isNation) teams.sort(function (a, b) { return b.rating - a.rating; });
    else teams.sort(function (a, b) { return a.name.localeCompare(b.name); });
    body.appendChild(el("p", { class: "intro-text", style: "text-align:center", text: teams.length + (info.isNation ? " seleções" : " clubes") + " nesta competição." }));
    var grid = el("div", { class: "club-grid" });
    teams.forEach(function (t) {
      var kids = [ t.img, el("div", { class: "cp-name", text: t.name }) ];
      if (t.rating != null) kids.push(TM.ui.ovBadge(t.rating));
      grid.appendChild(el("div", { class: "club-pick clickable", on: { click: function () { go("competicao-elenco", { comp: params.id, teamId: t.id, isNation: info.isNation }); } } }, kids));
    });
    body.appendChild(grid);
  });

  // elenco de um time dentro da competição (clube ou seleção)
  register("competicao-elenco", function (screen, params) {
    var isNation = params.isNation;
    var team = isNation ? TM.data.nation(params.teamId) : TM.data.club(params.teamId);
    if (!team) { go("competicao-times", { id: params.comp }); return; }
    screen.appendChild(topbar(team.name, function () { go("competicao-times", { id: params.comp }); }));
    screen.appendChild(el("div", { class: "club-header" }, [
      isNation ? TM.img.nationImg(team, "ch-crest") : TM.img.clubImg(team, "ch-crest"),
      el("div", {}, [ el("div", { class: "ch-name", text: team.name }) ])
    ]));
    var ids = isNation ? (team.players || []) : team.playerIds;
    var players = ids.map(function (id) { return TM.data.player(id); }).filter(Boolean);
    if (!players.length) { screen.appendChild(el("p", { class: "intro-text", style: "text-align:center", text: "Elenco não disponível." })); return; }
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    players.sort(function (a, b) { return (order[a.pos] - order[b.pos]) || (b.overall - a.overall); });
    var list = el("div", { class: "panel-narrow squad-list" });
    var lastPos = null;
    players.forEach(function (p) {
      if (p.pos !== lastPos) { list.appendChild(el("div", { class: "pos-header", text: ({ GK: "Goleiros", DF: "Defensores", MF: "Meio-campistas", FW: "Atacantes" })[p.pos] })); lastPos = p.pos; }
      list.appendChild(playerRow(p, { onClick: function (pl) { showPlayer(pl, { moneySym: "€", moneyMult: 1 }); } }));
    });
    screen.appendChild(list);
  });
})(window);
