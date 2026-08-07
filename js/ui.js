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

  /* =================== TELA: SPLASH =================== */
  register("splash", function (screen) {
    screen.id = "screen-splash";
    screen.appendChild(el("div", { class: "pitch-lines", "aria-hidden": "true" }));
    var logo = el("div", { class: "logo", "aria-hidden": "true", html:
      '<svg viewBox="0 0 240 240" width="150" height="150" role="img" aria-label="Total Match">' +
      '<g transform="rotate(-8 120 120)">' +
      '<rect x="58" y="42" width="124" height="156" rx="10" fill="#141414" stroke="url(#gold)" stroke-width="3"/>' +
      '<rect x="96" y="34" width="48" height="16" rx="5" fill="#141414" stroke="url(#gold)" stroke-width="3"/>' +
      '<line x1="120" y1="52" x2="120" y2="188" stroke="#2e7d46" stroke-width="2" opacity="0.7"/>' +
      '<circle cx="120" cy="120" r="20" fill="none" stroke="#2e7d46" stroke-width="2" opacity="0.7"/>' +
      '<rect x="88" y="52" width="64" height="22" fill="none" stroke="#2e7d46" stroke-width="2" opacity="0.55"/>' +
      '<rect x="88" y="166" width="64" height="22" fill="none" stroke="#2e7d46" stroke-width="2" opacity="0.55"/></g>' +
      '<g transform="translate(150 150)"><circle r="42" fill="#0a0a0a" stroke="url(#gold)" stroke-width="3"/>' +
      '<path d="M0,-30 L18,-9 L11,17 L-11,17 L-18,-9 Z" fill="url(#gold)"/>' +
      '<path d="M0,-42 L0,-30 M18,-9 L34,-20 M11,17 L26,30 M-11,17 L-26,30 M-18,-9 L-34,-20" stroke="url(#gold)" stroke-width="2.5" fill="none"/></g>' +
      '<defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d879"/>' +
      '<stop offset="0.5" stop-color="#d4af37"/><stop offset="1" stop-color="#b8860b"/></linearGradient></defs></svg>' });

    screen.appendChild(el("div", { class: "splash-content" }, [
      logo,
      el("h1", { class: "game-title", html: '<span class="title-total">TOTAL</span><span class="title-match">MATCH</span>' }),
      el("p", { class: "tagline", text: "Simulação & Gestão de Futebol" }),
      el("button", { class: "btn-start", text: "TOQUE PARA COMEÇAR", on: { click: function () { go("modes"); } } }),
      el("p", { class: "version", text: "v0.2 — protótipo jogável" })
    ]));
  });

  /* =================== TELA: MENU DE MODOS =================== */
  register("modes", function (screen) {
    screen.classList.add("screen-centered");
    var MODES = [
      { icon: "⚡", name: "Partida Rápida", desc: "Simule uma partida na hora", route: "quick" },
      { icon: "🎯", name: "Carreira de Treinador", desc: "Comande um clube ou seleção", route: "coach" },
      { icon: "⭐", name: "Carreira de Jogador", desc: "Crie e viva a carreira do seu craque", route: "player" },
      { icon: "⚙️", name: "Configurações", desc: "Dificuldade, realismo e mais", route: "settings" }
    ];
    screen.appendChild(el("header", { class: "modes-header" }, [
      el("div", { class: "mini-logo", html: 'TOTAL<span>MATCH</span>' }),
      el("h2", { text: "Escolha um modo" })
    ]));
    var grid = el("div", { class: "modes-grid" });
    MODES.forEach(function (mode) {
      grid.appendChild(el("button", { class: "mode-card", on: { click: function () { go(mode.route); } } }, [
        el("span", { class: "mode-icon", text: mode.icon }),
        el("span", { class: "mode-name", text: mode.name }),
        el("span", { class: "mode-desc", text: mode.desc })
      ]));
    });
    screen.appendChild(grid);
    screen.appendChild(el("button", { class: "btn-back", text: "← Voltar", on: { click: function () { go("splash"); } } }));
  });
})(window);
