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

  // ----- barra de SETORES (abas deslizáveis: emoji + nome) -----
  // items: [{ic, label, route, badge}], active = route atual.
  // Rola horizontalmente, destaca o setor ativo e centraliza-o.
  function sectorBar(items, active) {
    var bar = el("div", { class: "sector-bar" });
    var track = el("div", { class: "sector-track" });
    var activeNode = null;
    items.forEach(function (it) {
      var on = it.route === active;
      var tab = el("button", { class: "sector-tab" + (on ? " on" : ""), on: { click: function () { if (!on) go(it.route, it.params || {}); } } }, [
        el("span", { class: "st-ic", text: it.ic }),
        el("span", { class: "st-lb", text: it.label }),
        it.badge ? el("span", { class: "st-badge", text: it.badge > 9 ? "9+" : it.badge }) : null
      ]);
      if (on) activeNode = tab;
      track.appendChild(tab);
    });
    bar.appendChild(track);
    // centraliza o setor ativo após render
    if (activeNode) requestAnimationFrame(function () {
      try { track.scrollLeft = activeNode.offsetLeft - (bar.clientWidth - activeNode.clientWidth) / 2; } catch (e) {}
    });
    return bar;
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
    function fmtVal(m) { var n = Math.abs(m); if (n >= 1) return sym + " " + (n < 10 ? Math.round(n * 10) / 10 : Math.round(n)) + "M"; var k = Math.round(n * 1000); return k <= 0 ? sym + " 0" : sym + " " + k + " mil"; }
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
        info("Valor", fmtVal(value * mult)),
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

  // banner do estádio (foto + nome + capacidade). opts.label sobrescreve o subtítulo.
  function stadiumBanner(club, opts) {
    if (!club) return null;
    opts = opts || {};
    var st = TM.data.stadium(club);
    var cap = st.capacity ? (Math.round(st.capacity / 1000) + " mil lugares") : "";
    var sub = opts.label || (club.name + (cap ? " · " + cap : ""));
    return el("div", { class: "stadium-banner" + (opts.compact ? " compact" : "") }, [
      TM.img.stadiumImg(club, "stadium-photo"),
      el("div", { class: "stadium-cap" }, [
        el("div", { class: "stadium-name", text: "🏟️ " + st.name }),
        el("div", { class: "stadium-sub", text: sub })
      ])
    ]);
  }

  /* ---------- seletor de time visual (escudos + nome + overall, por liga) ---------- */
  function teamPickerEl(opts) {
    // opts: { source:"club"|"nation", onPick(id), current, leagues? (lista de ids p/ filtrar) }
    var source = opts.source || "club";
    var wrap = el("div", { class: "team-picker" });
    var search = el("input", { class: "select tp-search", type: "text", placeholder: "🔎 buscar time…" });
    var listWrap = el("div", { class: "tp-list" });
    wrap.appendChild(search); wrap.appendChild(listWrap);
    function row(imgEl, name, rating, id) {
      var r = el("button", { class: "tp-row" + (opts.current === id ? " sel" : ""), on: { click: function () { opts.onPick(id); } } }, [
        imgEl, el("span", { class: "tp-name", text: name }), ovBadge(rating)
      ]);
      return r;
    }
    function render() {
      listWrap.innerHTML = "";
      var q = (search.value || "").trim().toLowerCase();
      if (source === "nation") {
        var nats = TM.data.world().nations.slice().filter(function (n) { return !q || n.name.toLowerCase().indexOf(q) >= 0; })
          .sort(function (a, b) { return TM.comp.natRating(b.id) - TM.comp.natRating(a.id); });
        nats.forEach(function (n) { listWrap.appendChild(row(TM.img.nationImg(n, "tp-crest"), n.name, TM.comp.natRating(n.id), n.id)); });
        if (!nats.length) listWrap.appendChild(el("p", { class: "intro-text", text: "Nenhuma seleção encontrada." }));
        return;
      }
      var leagues = TM.data.world().leagues;
      if (opts.leagues) leagues = leagues.filter(function (lg) { return opts.leagues.indexOf(lg.id) >= 0; });
      var any = false;
      leagues.forEach(function (lg) {
        var clubs = lg.clubIds.map(function (id) { return TM.data.club(id); })
          .filter(function (c) { return c && (!q || c.name.toLowerCase().indexOf(q) >= 0); })
          .sort(function (a, b) { return TM.data.clubRating(b.id) - TM.data.clubRating(a.id); });
        if (!clubs.length) return;
        any = true;
        var comp = TM.data.competition("lg-" + lg.id);
        listWrap.appendChild(el("div", { class: "tp-league" }, [
          comp ? TM.img.compImg(comp, "tp-lg-logo") : el("span", {}),
          el("span", { class: "tp-lg-name", text: lg.name })
        ]));
        clubs.forEach(function (c) { listWrap.appendChild(row(TM.img.clubImg(c, "tp-crest"), c.name, TM.data.clubRating(c.id), c.id)); });
      });
      if (!any) listWrap.appendChild(el("p", { class: "intro-text", text: "Nenhum time encontrado." }));
    }
    search.addEventListener("input", render);
    render();
    return wrap;
  }
  // rota de tela cheia para escolher um time (usa um callback guardado)
  var _pickCb = null;
  function pickTeam(o) { _pickCb = o.onPick; go("pick-team", { source: o.source, title: o.title, current: o.current, back: o.back, leagues: o.leagues }); }
  register("pick-team", function (screen, params) {
    screen.appendChild(topbar(params.title || "Escolha o time", function () { if (params.back) params.back(); else go("modes"); }));
    screen.appendChild(teamPickerEl({
      source: params.source, current: params.current, leagues: params.leagues,
      onPick: function (id) { var cb = _pickCb; _pickCb = null; if (cb) cb(id); }
    }));
  });

  TM.ui = {
    init: function () { app = document.getElementById("app"); applyTheme(); },
    el: el, clear: clear, register: register, go: go,
    topbar: topbar, sectorBar: sectorBar, playerRow: playerRow, ovBadge: ovBadge, button: button, toast: toast,
    showPlayer: showPlayer, optionsMenu: optionsMenu, confirm: confirmSheet,
    applyTheme: applyTheme, compAccent: compAccent, applyCompTheme: applyCompTheme, compBanner: compBanner,
    stadiumBanner: stadiumBanner, teamPickerEl: teamPickerEl, pickTeam: pickTeam, chipKids: chipKids, posPanel: posPanel, dropdown: dropdown, arrivalCutscene: arrivalCutscene,
    current: function () { return current; }
  };

  /* emblema/logo — escudo moderno com bola e estrela */
  var EMBLEM =
    '<svg viewBox="0 0 200 210" role="img" aria-label="Total Match">' +
    '<defs>' +
    '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#86efac"/><stop offset="0.5" stop-color="#22c55e"/><stop offset="1" stop-color="#12a150"/></linearGradient>' +
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

  // conteúdo padrão de um chip do campinho: rosto + overall (efetivo) + posição do slot + alerta se fora de posição
  // opts: { flag: elemento extra (lesão/susp), name: nome custom, age: false p/ ocultar idade }
  function chipKids(player, slot, opts) {
    opts = opts || {};
    var C = window.TM.comp;
    var eff = (slot && C && C.effOverall) ? C.effOverall(player, slot[0]) : { ov: player.overall, off: false };
    var posTxt = (slot && C && C.slotPos) ? C.slotPos(slot) : window.TM.data.posLabel(player);
    var dyn = opts.dyn;
    var ovShown = eff.ov + ((dyn && dyn.on && dyn.delta) ? dyn.delta : 0);
    var faceKids = [
      window.TM.img.playerImg(player, "chip-face"),
      el("span", { class: "chip-ov" + (eff.off ? " low" : "") + (dyn && dyn.on && dyn.delta > 0 ? " up" : dyn && dyn.on && dyn.delta < 0 ? " down" : ""), text: ovShown })
    ];
    if (dyn && dyn.on) faceKids.push(el("span", { class: "chip-dyn " + (dyn.dir > 0 ? "up" : dyn.dir < 0 ? "down" : "steady"), title: "Overall dinâmico", text: dyn.dir > 0 ? "▲" : dyn.dir < 0 ? "▼" : "=" }));
    if (eff.off) faceKids.push(el("span", { class: "chip-warn", title: "Fora de posição (−" + eff.drop + ")", text: "!" }));
    if (opts.flag) faceKids.push(opts.flag);
    if (opts.captain) faceKids.push(el("span", { class: "chip-cap", title: "Capitão", text: "C" }));
    // barra de estamina (condição física) — aparece em todos os modos
    var stam = chipStamina(player, opts);
    return [
      el("div", { class: "chip-face-wrap" + (eff.off ? " off" : "") }, faceKids),
      el("span", { class: "chip-pos" + (eff.off ? " off" : ""), text: posTxt }),
      el("span", { class: "chip-name", text: opts.name || player.name }),
      el("div", { class: "chip-stam", title: "Estamina " + stam + "%" }, [ el("i", { class: "chip-stam-fill " + (stam >= 66 ? "ok" : stam >= 33 ? "mid" : "low"), style: "width:" + stam + "%" }) ]),
      (opts.age !== false && player.age) ? el("span", { class: "chip-age", text: player.age + " anos" }) : null
    ];
  }
  // condição física 0-100: usa a da carreira (opts/player.stamina) ou deriva algo estável
  function chipStamina(player, opts) {
    var s = (opts && opts.stamina != null) ? opts.stamina : (player.stamina != null ? player.stamina : null);
    if (s == null) {
      var id = String(player.id || player.name || "x"), h = 0;
      for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
      s = 74 + (h % 27); // 74..100, estável por jogador
    }
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  // ceninha de apresentação de reforço (chegada ao clube)
  function arrivalCutscene(player, club, onDone) {
    var TM = window.TM;
    var overlay = el("div", { class: "arrival" });
    function close() { overlay.classList.add("out"); setTimeout(function () { overlay.remove(); if (onDone) onDone(); }, 280); }
    var stage = el("div", { class: "arrival-stage" }, [
      el("div", { class: "arrival-flash" }),
      el("div", { class: "arrival-eyebrow", text: "✍️ REFORÇO CONFIRMADO" }),
      el("div", { class: "arrival-crestwrap" }, [ TM.img.clubImg(club, "arrival-crest") ]),
      el("div", { class: "arrival-facewrap" }, [ TM.img.playerImg(player, "arrival-face") ]),
      el("div", { class: "arrival-name", text: player.name }),
      el("div", { class: "arrival-meta", text: TM.data.posLabel(player) + "  ·  " + player.overall + " OVR  ·  " + (player.age || "?") + " anos" }),
      el("div", { class: "arrival-welcome", text: "Bem-vindo ao " + club.name + "!" }),
      el("div", { class: "arrival-actions" }, [ button("Continuar ▶", close, "btn primary") ])
    ]);
    overlay.appendChild(stage);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  }

  // seletor compacto (dropdown) no estilo dos cobradores. options: [[valor, texto], ...] ou [valor, ...]
  function dropdown(label, options, current, onChange) {
    var sel = el("select", { class: "select" });
    (options || []).forEach(function (o) {
      var val = Array.isArray(o) ? o[0] : o, txt = Array.isArray(o) ? o[1] : o;
      var op = el("option", { value: val, text: txt });
      if (val === current) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener("change", function () { onChange(sel.value); });
    return el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: label }), sel ]);
  }

  // painel compacto "🧭 Posições" (estilo do bloco de cobradores) — lista quem está fora de posição
  // entries: [{ player, slot }]
  function posPanel(entries) {
    var C = window.TM.comp;
    var off = (entries || []).filter(function (e) { return e.player && e.slot && C.posPenalty(e.player.pos, e.slot[0], e.player) > 0; });
    var body = el("div", { class: "panel-narrow pos-panel" }, [ el("h3", { class: "block-title", text: "🧭 Posições" }) ]);
    if (!off.length) { body.appendChild(el("div", { class: "setting-hint", text: "✅ Todos os titulares estão na posição." })); return body; }
    off.forEach(function (e) {
      var eff = C.effOverall(e.player, e.slot[0]);
      body.appendChild(el("div", { class: "pos-row" }, [
        window.TM.img.playerImg(e.player, "pos-face"),
        el("div", { class: "pos-info" }, [
          el("div", { class: "pos-name", text: e.player.name }),
          el("div", { class: "pos-sub", text: window.TM.data.posLabel(e.player) + " jogando de " + C.slotPos(e.slot) })
        ]),
        el("div", { class: "pos-drop", text: "−" + eff.drop })
      ]));
    });
    body.appendChild(el("div", { class: "setting-hint", text: "Fora de posição o overall cai (mais quanto mais distante). Reposicione ou use quem tem versatilidade." }));
    return body;
  }

  // anima um número de 0 até o alvo (easeOutCubic), com separador de milhar pt-BR
  function animateCount(node, target, dur) {
    var start = null;
    function fmt(v) { return Math.round(v).toLocaleString("pt-BR"); }
    function step(ts) {
      if (start == null) start = ts;
      var t = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - t, 3);
      node.textContent = fmt(target * e);
      if (t < 1) requestAnimationFrame(step); else node.textContent = fmt(target);
    }
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(step);
    else node.textContent = fmt(target);
  }

  // grade de contadores com os números reais do jogo
  function splashCounters() {
    var W = TM.data.world();
    var real = 0; for (var k in W.playersById) { if (W.playersById[k].ph) real++; }
    var comps = 49; try { if (TM.data.competitions) comps = TM.data.competitions().length; } catch (e) {}
    var items = [
      { ic: "🛡️", n: W.clubs.length, lab: "Clubes" },
      { ic: "👥", n: real, lab: "Jogadores reais" },
      { ic: "🏟️", n: 361, lab: "Estádios" },
      { ic: "🏆", n: W.leagues.length, lab: "Ligas e divisões" },
      { ic: "🌍", n: W.nations.length, lab: "Seleções" },
      { ic: "🎖️", n: comps, lab: "Competições" }
    ];
    var grid = el("div", { class: "splash-counters" });
    items.forEach(function (it, i) {
      var num = el("div", { class: "sc-num", text: "0" });
      grid.appendChild(el("div", { class: "sc-item" }, [
        el("div", { class: "sc-ic", text: it.ic }), num, el("div", { class: "sc-lab", text: it.lab })
      ]));
      animateCount(num, it.n, 1300 + i * 90);
    });
    return grid;
  }

  /* =================== TELA: SPLASH =================== */
  register("splash", function (screen) {
    screen.id = "screen-splash";
    // atmosfera imersiva (só a logo protagoniza)
    screen.appendChild(el("div", { class: "pitch-lines", "aria-hidden": "true" }));
    screen.appendChild(el("div", { class: "splash-glow", "aria-hidden": "true" }));
    screen.appendChild(el("div", { class: "splash-vignette", "aria-hidden": "true" }));

    var content = el("div", { class: "splash-content" }, [
      el("img", { class: "splash-logo", src: (global.TM_LOGO || "assets/logo.png"), alt: "Total Match" }),
      el("div", { class: "splash-tap", text: "toque para começar" })
    ]);
    screen.appendChild(content);
    screen.appendChild(el("div", { class: "splash-ver", text: "v0.3" }));

    // a tela inteira inicia o jogo (mais imersivo)
    var started = false;
    screen.addEventListener("click", function () { if (started) return; started = true; go("modes"); });
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

  // ripple tátil de toque nos elementos do menu
  function attachRipple(node) {
    node.addEventListener("pointerdown", function (e) {
      var r = node.getBoundingClientRect();
      var ink = el("span", { class: "ripple-ink" });
      var size = Math.max(r.width, r.height);
      ink.style.width = ink.style.height = size + "px";
      ink.style.left = (e.clientX - r.left - size / 2) + "px";
      ink.style.top = (e.clientY - r.top - size / 2) + "px";
      node.appendChild(ink);
      setTimeout(function () { if (ink.parentNode) ink.parentNode.removeChild(ink); }, 620);
    });
  }

  // ===== MENU VERTICAL estilo FC: um modo por tela, rola pra cima/baixo =====
  register("modes", function (screen) {
    screen.id = "screen-modes";
    screen.classList.add("fcmenu");
    var SB = "assets/estadios/";
    var hasCoachSave = false; try { hasCoachSave = !!TM.storage.coachCareer(); } catch (e) {}

    var SLIDES = [];
    if (hasCoachSave) SLIDES.push({ key: "car", eyebrow: "CONTINUAR", name: "Retomar Carreira", desc: "Volte de onde você parou no comando do seu clube.", cta: "CONTINUAR", route: "coach-hub", bg: SB + "st-270085.jpg" });
    SLIDES.push({ key: "car", eyebrow: "CARREIRA", name: "Carreira de Treinador", desc: "Do banco de reservas ao topo do mundo. Comande o clube e a seleção.", cta: "JOGAR", route: "coach", bg: SB + "st-30651230.jpg" });
    SLIDES.push({ key: "car", eyebrow: "CARREIRA", name: "Carreira de Dirigente", desc: "Gerencie o clube nos bastidores: finanças, contratações e estrutura.", cta: "JOGAR", route: "coach", bg: SB + "st-17071576.jpg" });
    SLIDES.push({ key: "play", eyebrow: "JOGAR", name: "Partida Rápida", desc: "Escolha dois times e jogue agora, sem compromisso.", cta: "JOGAR", route: "quick", bg: SB + "st-17779076.jpg" });
    SLIDES.push({ key: "play", eyebrow: "JOGAR", name: "Competições", desc: "Dispute ligas, copas e torneios de seleções.", cta: "JOGAR", route: "compmode", bg: SB + "st-1171084.jpg" });
    SLIDES.push({ key: "net", eyebrow: "MULTIPLAYER", name: "Online", desc: "Desafie amigos em tempo real pelo seu número.", cta: "ENTRAR", route: "online", bg: SB + "st-399187.jpg" });

    // overlay fixo: logo + engrenagem
    screen.appendChild(el("div", { class: "fc-top" }, [
      el("img", { class: "fc-logo", src: (global.TM_LOGO || "assets/logo.png"), alt: "Total Match" }),
      el("button", { class: "fc-gear", title: "Configurações", on: { click: function () { go("settings"); } } }, [ el("span", { text: "⚙️" }) ])
    ]));

    var scroller = el("div", { class: "fc-scroll" });
    var slideEls = [];
    SLIDES.forEach(function (s, i) {
      var bg = el("span", { class: "fc-bg" }); if (s.bg) bg.style.backgroundImage = "url('" + s.bg + "')";
      var slide = el("section", { class: "fc-slide acc-" + s.key }, [
        bg,
        el("span", { class: "fc-shade" }),
        el("div", { class: "fc-body" }, [
          el("div", { class: "fc-eyebrow", text: s.eyebrow }),
          el("h2", { class: "fc-name", text: s.name }),
          el("p", { class: "fc-desc", text: s.desc }),
          el("button", { class: "fc-cta", on: { click: (function (rt) { return function () { go(rt); }; })(s.route) } }, [ el("span", { text: s.cta }), el("span", { class: "fc-cta-arrow", text: "▶" }) ])
        ])
      ]);
      slideEls.push(slide);
      scroller.appendChild(slide);
    });

    // slide final "diferente": grade de acessos rápidos
    var MORE = [
      { icon: "💎", name: "Dream Team", route: "dream" }, { icon: "🎲", name: "Draft", route: "draft" },
      { icon: "🏟️", name: "Grupo", route: "groupcomp" }, { icon: "✏️", name: "Editor", route: "editor" },
      { icon: "💾", name: "Minhas Carreiras", route: "saves" }, { icon: "🎖️", name: "Informações", route: "competicoes" },
      { icon: "⚙️", name: "Configurações", route: "settings" }, { icon: "👤", name: "Perfil", route: "profile" }
    ];
    var moreGrid = el("div", { class: "fc-more-grid" });
    MORE.forEach(function (m) {
      moreGrid.appendChild(el("button", { class: "fc-more-tile", on: { click: (function (rt) { return function () { go(rt); }; })(m.route) } }, [
        el("span", { class: "fc-more-ic", text: m.icon }), el("span", { class: "fc-more-lb", text: m.name })
      ]));
    });
    var moreSlide = el("section", { class: "fc-slide fc-slide-more" }, [
      el("div", { class: "fc-body fc-more-body" }, [
        el("div", { class: "fc-eyebrow", text: "EXPLORAR" }),
        el("h2", { class: "fc-name", text: "Mais modos" }),
        moreGrid
      ])
    ]);
    slideEls.push(moreSlide);
    scroller.appendChild(moreSlide);
    screen.appendChild(scroller);

    // indicador de posição (dots) + seta "role"
    var dots = el("div", { class: "fc-dots" });
    slideEls.forEach(function (_, i) {
      dots.appendChild(el("button", { class: "fc-dot" + (i === 0 ? " on" : ""), on: { click: (function (idx) { return function () { slideEls[idx].scrollIntoView({ behavior: "smooth" }); }; })(i) } }));
    });
    screen.appendChild(dots);
    var hint = el("div", { class: "fc-scrollhint", html: "role para ver mais <span class='fc-chev'>⌄</span>" });
    screen.appendChild(hint);

    // observa qual slide está ativo → atualiza dots e esconde a dica
    try {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var idx = slideEls.indexOf(en.target);
            dots.querySelectorAll(".fc-dot").forEach(function (d, di) { d.classList.toggle("on", di === idx); });
            if (idx > 0) hint.classList.add("hide"); else hint.classList.remove("hide");
          }
        });
      }, { root: scroller, threshold: 0.6 });
      slideEls.forEach(function (s) { io.observe(s); });
    } catch (e) {}
  });

  register("modes-min-unused", function (screen) {
    screen.id = "screen-modes";
    screen.classList.add("modes-min");
    // fundo escuro com textura de estádio (bem sutil, só ambientação)
    screen.appendChild(el("div", { class: "m2-bg", "aria-hidden": "true" }));
    screen.appendChild(el("div", { class: "m2-vignette", "aria-hidden": "true" }));

    var inner = el("div", { class: "m2-inner" });
    screen.appendChild(inner);

    inner.appendChild(el("img", { class: "m2-logo", src: (global.TM_LOGO || "assets/logo.png"), alt: "Total Match" }));

    var MODES = [
      { ic: "🎯", name: "Carreira", sub: "Master League — Treinador ou Dirigente", route: "coach" },
      { ic: "⚡", name: "Partida Rápida", sub: "Um jogo avulso, na hora", route: "quick" },
      { ic: "🏆", name: "Competições", sub: "Ligas, copas e seleções", route: "compmode" },
      { ic: "🌐", name: "Online", sub: "Jogue com amigos", route: "online" }
    ];
    var list = el("div", { class: "m2-modes" });
    MODES.forEach(function (m) {
      list.appendChild(el("button", { class: "m2-btn", on: { click: function () { go(m.route); } } }, [
        el("span", { class: "m2-ic", text: m.ic }),
        el("span", { class: "m2-txt" }, [ el("span", { class: "m2-name", text: m.name }), el("span", { class: "m2-sub", text: m.sub }) ]),
        el("span", { class: "m2-arrow", text: "▶" })
      ]));
    });
    inner.appendChild(list);

    // links secundários (tudo acessível, sem poluir)
    var SEC = [
      { name: "Minhas Carreiras", route: "saves" }, { name: "Dream Team", route: "dream" },
      { name: "Draft", route: "draft" }, { name: "Grupo", route: "groupcomp" },
      { name: "Informações", route: "competicoes" }, { name: "Editor", route: "editor" },
      { name: "Configurações", route: "settings" }, { name: "Perfil", route: "profile" }
    ];
    var sec = el("div", { class: "m2-secondary" });
    SEC.forEach(function (s, i) {
      if (i) sec.appendChild(el("span", { class: "m2-dot", text: "·" }));
      sec.appendChild(el("button", { class: "m2-link", text: s.name, on: { click: function () { go(s.route); } } }));
    });
    inner.appendChild(sec);

    screen.appendChild(el("div", { class: "m2-footer", text: "TOTAL MATCH • v1.0" }));
  });

  register("modes-rich-unused", function (screen) {
    screen.id = "screen-modes";
    screen.appendChild(el("div", { class: "pitch-lines", "aria-hidden": "true" }));
    screen.appendChild(el("div", { class: "modes-glow", "aria-hidden": "true" }));

    var hasCoachSave = false; try { hasCoachSave = !!TM.storage.coachCareer(); } catch (e) {}
    var carItems = [];
    if (hasCoachSave) carItems.push({ icon: "▶️", name: "Continuar carreira", desc: "Retome de onde você parou", route: "coach-hub", big: true });
    carItems.push({ icon: "🎯", name: "Carreira de Treinador", desc: "Comande o clube e a seleção — Master League", route: "coach", big: !hasCoachSave });
    carItems.push({ icon: "🏛️", name: "Carreira de Dirigente", desc: "Gerencie o clube nos bastidores", route: "coach" });
    carItems.push({ icon: "💾", name: "Minhas carreiras", desc: "Continue outros saves", route: "saves" });
    var CATS = [
      { key: "car", tab: "Carreiras", ic: "⭐", items: carItems },
      { key: "play", tab: "Jogar", ic: "⚡", items: [
        { icon: "⚡", name: "Partida Rápida", desc: "Um jogo avulso, na hora", route: "quick" },
        { icon: "🏆", name: "Competição", desc: "Ligas, copas e seleções", route: "compmode" },
        { icon: "💎", name: "Dream Team", desc: "Monte seu time dos sonhos", route: "dream" },
        { icon: "🎲", name: "Draft", desc: "Sorteie e escale", route: "draft" }
      ] },
      { key: "net", tab: "Online", ic: "🌐", items: [
        { icon: "🌐", name: "Online", desc: "Jogue com amigos", route: "online" },
        { icon: "🏟️", name: "Grupo", desc: "Torneio entre amigos", route: "groupcomp" }
      ] },
      { key: "more", tab: "Mais", ic: "⋯", items: [
        { icon: "🎖️", name: "Informações", desc: "Competições e times", route: "competicoes" },
        { icon: "✏️", name: "Editor", desc: "Edite, crie e transfira jogadores", route: "editor" },
        { icon: "💾", name: "Minhas Carreiras", desc: "Continue de onde parou", route: "saves" },
        { icon: "⚙️", name: "Configurações", desc: "Ajuste o jogo", route: "settings" },
        { icon: "👤", name: "Perfil", desc: "Conta e sincronização", route: "profile" }
      ] }
    ];
    // destaques do carrossel (topo)
    var SB = "assets/estadios/";
    var FEATURED = [
      { icon: "🎯", name: "Master League", tag: "Do banco de reservas ao topo do mundo", route: "coach", acc: "car", bg: SB + "st-270085.jpg" },
      { icon: "🏛️", name: "Seja o Dirigente", tag: "Gerencie o clube nos bastidores", route: "coach", acc: "car", bg: SB + "st-30651230.jpg" },
      { icon: "⚡", name: "Partida Rápida", tag: "Escolha dois times e jogue agora", route: "quick", acc: "play", bg: SB + "st-17779076.jpg" },
      { icon: "🌐", name: "Jogue Online", tag: "Desafie amigos em tempo real", route: "online", acc: "net", bg: SB + "st-399187.jpg" }
    ];

    // ---- header ----
    var prof = (TM.account && TM.account.profile) ? TM.account.profile() : null;
    var right = prof
      ? el("button", { class: "modes-prof", on: { click: function () { go("profile"); } } }, [
          (TM.account.avatar ? TM.account.avatar(prof, "modes-prof-ava") : el("span")),
          el("span", { class: "modes-prof-name", text: prof.name })
        ])
      : el("button", { class: "modes-prof ghost", on: { click: function () { go("profile"); } } }, [ el("span", { text: "Entrar" }) ]);
    var gearBtn = el("button", { class: "modes-gear", title: "Configurações", on: { click: function () { go("settings"); } } }, [ el("span", { text: "⚙️" }) ]);
    screen.appendChild(el("header", { class: "modes-head" }, [
      el("img", { class: "modes-logo", src: (global.TM_LOGO || "assets/logo.png"), alt: "Total Match" }),
      el("div", { class: "modes-head-sp" }),
      gearBtn,
      right
    ]));

    var wrap = el("div", { class: "modes-wrap" });
    screen.appendChild(wrap);

    // ---- carrossel de destaque (interativo: dots + auto-rotate + swipe) ----
    var hero = el("button", { class: "hero-card" });
    var dotsWrap = el("div", { class: "hero-dots" });
    var hIdx = 0, hTimer = null;
    function renderHero(i) {
      hIdx = (i + FEATURED.length) % FEATURED.length;
      var f = FEATURED[hIdx];
      hero.className = "hero-card cinema acc-" + f.acc;
      hero.innerHTML = "";
      var bg = el("span", { class: "hero-bg" }); if (f.bg) bg.style.backgroundImage = "url('" + f.bg + "')";
      hero.appendChild(bg);
      hero.appendChild(el("span", { class: "hero-shade" }));
      hero.appendChild(el("div", { class: "hero-body" }, [
        el("span", { class: "hero-eyebrow" }, [ el("span", { class: "he-ic", text: f.icon }), el("span", { text: "EM DESTAQUE" }) ]),
        el("span", { class: "hero-name", text: f.name }),
        el("span", { class: "hero-tag", text: f.tag }),
        el("span", { class: "hero-cta", text: "JOGAR ▶" })
      ]));
      hero.onclick = function () { go(f.route); };
      dotsWrap.querySelectorAll(".hero-dot").forEach(function (d, di) { d.classList.toggle("on", di === hIdx); });
    }
    FEATURED.forEach(function (f, di) {
      dotsWrap.appendChild(el("button", { class: "hero-dot", on: { click: function () { renderHero(di); restartHero(); } } }));
    });
    function restartHero() { if (hTimer) clearInterval(hTimer); hTimer = setInterval(function () {
      if (!screen.isConnected) { clearInterval(hTimer); return; } renderHero(hIdx + 1);
    }, 4200); }
    // swipe no hero
    var sx = 0;
    hero.addEventListener("pointerdown", function (e) { sx = e.clientX; });
    hero.addEventListener("pointerup", function (e) { var dx = e.clientX - sx; if (Math.abs(dx) > 45) { renderHero(hIdx + (dx < 0 ? 1 : -1)); restartHero(); } });
    wrap.appendChild(hero);
    wrap.appendChild(dotsWrap);
    renderHero(0); restartHero();

    // ---- abas de categoria (sincronizadas com o pager) ----
    var tabsEl = el("div", { class: "cat-tabs" });
    CATS.forEach(function (c, ci) {
      tabsEl.appendChild(el("button", { class: "cat-tab acc-" + c.key, on: { click: function () { goCat(ci); } } }, [
        el("span", { class: "ct-ic", text: c.ic }), el("span", { class: "ct-lbl", text: c.tab })
      ]));
    });
    wrap.appendChild(tabsEl);

    // ---- pager deslizável: arrasta pros lados para trocar de categoria ----
    var pager = el("div", { class: "cat-pager" });
    var track = el("div", { class: "cat-track" });
    pager.appendChild(track);
    CATS.forEach(function (c) {
      var grid = el("div", { class: "cat-grid" });
      c.items.forEach(function (m, mi) {
        var card = el("button", { class: "mode-tile" + (m.big ? " big" : ""), style: "animation-delay:" + (mi * 55) + "ms", on: { click: function () {
          if (justDragged) return; go(m.route);
        } } }, [
          el("span", { class: "mt-orb", text: m.icon }),
          el("span", { class: "mt-info" }, [
            el("span", { class: "mt-name", text: m.name }),
            el("span", { class: "mt-desc", text: m.desc })
          ]),
          el("span", { class: "mt-go", text: "›" })
        ]);
        attachRipple(card);
        grid.appendChild(card);
      });
      track.appendChild(el("div", { class: "cat-page acc-" + c.key }, [ grid ]));
    });
    wrap.appendChild(pager);

    var curCat = 0, justDragged = false;
    function goCat(ci, noAnim) {
      curCat = Math.max(0, Math.min(CATS.length - 1, ci));
      track.style.transition = noAnim ? "none" : "transform .42s cubic-bezier(.22,.61,.36,1)";
      track.style.transform = "translateX(" + (-curCat * 100) + "%)";
      tabsEl.querySelectorAll(".cat-tab").forEach(function (t, ti) { t.classList.toggle("on", ti === curCat); });
      var at = tabsEl.querySelectorAll(".cat-tab")[curCat];
      if (at && at.scrollIntoView) { try { at.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); } catch (e) {} }
      var page = track.children[curCat];
      if (page) { page.classList.remove("in"); void page.offsetWidth; page.classList.add("in"); }
    }

    // gesto de arrastar (pointer). IMPORTANTE: só captura o ponteiro DEPOIS que
    // o arrasto começa — senão um clique simples num tile é "roubado" pelo pager
    // e o botão não abre (bug que travava tudo no PC/mobile).
    var dsx = 0, dsy = 0, dragging = false, moved = false, captured = false, pw = 0, pid = null;
    pager.addEventListener("pointerdown", function (e) {
      dsx = e.clientX; dsy = e.clientY; dragging = true; moved = false; captured = false; pid = e.pointerId; pw = pager.clientWidth || 1;
    });
    pager.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - dsx, dy = e.clientY - dsy;
      if (!moved && Math.abs(dx) < 8) return;                 // ainda pode ser um clique
      if (!moved && Math.abs(dx) < Math.abs(dy)) { dragging = false; return; } // scroll vertical
      moved = true;
      if (!captured) { captured = true; track.style.transition = "none"; try { pager.setPointerCapture(pid); } catch (er) {} }
      var edge = (curCat === 0 && dx > 0) || (curCat === CATS.length - 1 && dx < 0);
      var eff = edge ? dx * 0.35 : dx;
      track.style.transform = "translateX(" + (-curCat * pw + eff) + "px)";
    });
    function endDrag(e) {
      if (!dragging) return; dragging = false;
      if (!moved) return;                                     // clique puro: deixa o tile abrir
      var dx = (e.clientX || dsx) - dsx;
      if (Math.abs(dx) > pw * 0.16) goCat(curCat + (dx < 0 ? 1 : -1)); else goCat(curCat);
      justDragged = true; setTimeout(function () { justDragged = false; }, 80);
    }
    pager.addEventListener("pointerup", endDrag);
    pager.addEventListener("pointercancel", endDrag);
    goCat(0, true);

    // ---- ticker de curiosidades (rodapé slim) ----
    var ticker = el("div", { class: "modes-ticker" }, [ el("span", { class: "mt-eye", text: "VOCÊ SABIA?" }), el("span", { class: "mt-txt" }) ]);
    var mtTxt = ticker.querySelector(".mt-txt");
    var idx = 0;
    function showFact(i) { var f = FACTS[i]; ticker.classList.remove("fade"); void ticker.offsetWidth; ticker.classList.add("fade"); mtTxt.textContent = f.t + " — " + f.d; }
    showFact(0);
    var timer = setInterval(function () { if (!screen.isConnected) { clearInterval(timer); return; } idx = (idx + 1) % FACTS.length; showFact(idx); }, 5000);
    wrap.appendChild(ticker);
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
    if (!isNation) {
      var sb = stadiumBanner(team);
      if (sb) screen.appendChild(el("div", { class: "panel-narrow", style: "padding-top:0" }, [ sb ]));
    }
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
