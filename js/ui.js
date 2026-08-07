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

  TM.ui = {
    init: function () { app = document.getElementById("app"); },
    el: el, clear: clear, register: register, go: go,
    topbar: topbar, playerRow: playerRow, ovBadge: ovBadge, button: button, toast: toast,
    current: function () { return current; }
  };

  /* emblema/logo reutilizável (badge dourado com bola, prancheta, louros e estrela) */
  var EMBLEM =
    '<svg viewBox="0 0 200 210" role="img" aria-label="Total Match">' +
    '<defs>' +
    '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8e08a"/><stop offset="0.5" stop-color="#d4af37"/><stop offset="1" stop-color="#a9781a"/></linearGradient>' +
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

  /* =================== TELA: MENU DE MODOS (menu lateral) =================== */
  register("modes", function (screen) {
    var MODES = [
      { icon: "⚡", name: "Partida Rápida", route: "quick", tagline: "Jogue já", desc: "Escolha dois times — clubes ou seleções — e assista à simulação da partida ao vivo, com narração minuto a minuto, gols, pênaltis e cartões.", cta: "Simular partida" },
      { icon: "🎯", name: "Carreira de Treinador", route: "coach", tagline: "Comande um clube", desc: "Assuma um clube e dispute a Liga, a Copa nacional e a competição continental (Libertadores/Champions). Gerencie o elenco e contrate reforços negociando com clubes e jogadores.", cta: "Iniciar carreira" },
      { icon: "⭐", name: "Carreira de Jogador", route: "player", tagline: "Seja o craque", desc: "Crie seu jogador (com foto, país e físico) ou assuma um existente. Ganhe notas, marque gols, cumpra metas, receba propostas e seja convocado para a seleção.", cta: "Criar jogador" },
      { icon: "⚙️", name: "Configurações", route: "settings", tagline: "Ajustes", desc: "Defina dificuldade, nível de realismo, velocidade das partidas e narração. Suas preferências ficam salvas no navegador.", cta: "Abrir ajustes" }
    ];
    var selected = 0;

    screen.appendChild(el("header", { class: "modes-topbar" }, [
      el("div", { class: "modes-emblem", html: EMBLEM }),
      el("div", {}, [ el("div", { class: "mini-logo", html: 'TOTAL<span>MATCH</span>' }), el("div", { class: "modes-sub", text: "Escolha um modo" }) ]),
      el("button", { class: "btn-back small-back", text: "←", on: { click: function () { go("splash"); } } })
    ]));

    var layout = el("div", { class: "modes-layout" });
    var sidebar = el("nav", { class: "modes-sidebar" });
    var preview = el("div", { class: "mode-preview" });
    layout.appendChild(sidebar);
    layout.appendChild(preview);
    screen.appendChild(layout);

    function renderPreview() {
      var m = MODES[selected];
      TM.ui.clear(preview);
      preview.appendChild(el("div", { class: "mp-icon", text: m.icon }));
      preview.appendChild(el("div", { class: "mp-tagline", text: m.tagline }));
      preview.appendChild(el("h3", { class: "mp-name", text: m.name }));
      preview.appendChild(el("p", { class: "mp-desc", text: m.desc }));
      preview.appendChild(el("button", { class: "btn primary big mp-cta", text: m.cta + " →", on: { click: function () { go(m.route); } } }));
    }

    MODES.forEach(function (m, i) {
      var item = el("button", { class: "side-item" + (i === selected ? " active" : ""), on: { click: function () {
        selected = i;
        sidebar.querySelectorAll(".side-item").forEach(function (x) { x.classList.remove("active"); });
        item.classList.add("active");
        renderPreview();
      } } }, [
        el("span", { class: "side-ic", text: m.icon }),
        el("span", { class: "side-name", text: m.name })
      ]);
      sidebar.appendChild(item);
    });
    renderPreview();
  });
})(window);
