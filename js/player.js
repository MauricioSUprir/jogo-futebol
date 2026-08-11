/* ================= TOTAL MATCH — Carreira de Jogador ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  var CUR_YEAR = 2026;

  /* ---------- momento / opinião sobre o jogador ---------- */
  // momentum vive em [-5, 5]; sobe com boas notas, cai com ruins, com decaimento suave.
  function updateMomentum(c, rating) {
    if (c.momentum == null) c.momentum = 0;
    var d;
    if (rating >= 8.0) d = 1.6; else if (rating >= 7.2) d = 1.0; else if (rating >= 6.4) d = 0.4;
    else if (rating >= 5.6) d = -0.2; else if (rating >= 5.0) d = -1.0; else d = -1.7;
    c.momentum = Math.max(-5, Math.min(5, c.momentum * 0.82 + d));
    c.recentRatings = (c.recentRatings || []).concat(+rating.toFixed(1)).slice(-5);
  }
  // opinião pública + modificadores aplicados em campo
  function momentumInfo(c) {
    var m = c.momentum || 0;
    var mod = +(m * 0.06).toFixed(2);   // ± até 0.30 na sua nota
    var mult = 1 + m * 0.05;            // ± até 25% no peso de finalização
    if (m >= 3)  return { emoji: "🔥", label: "Em grande fase",  css: "mom-hot",     text: "Imprensa e torcida rasgam elogios — você entra em campo com confiança total.", mod: mod, mult: mult };
    if (m >= 1)  return { emoji: "📈", label: "Em alta",         css: "mom-up",      text: "Boas atuações recentes mantêm o ambiente a seu favor.", mod: mod, mult: mult };
    if (m > -1)  return { emoji: "➖", label: "Momento neutro",  css: "mom-neutral", text: "Fase regular. Uma boa atuação muda o clima rapidamente.", mod: mod, mult: mult };
    if (m > -3)  return { emoji: "📉", label: "Sob pressão",     css: "mom-down",    text: "A cobrança aumentou — precisa reagir logo para virar o jogo.", mod: mod, mult: mult };
    return       { emoji: "❄️", label: "Fase ruim",        css: "mom-cold",    text: "Muita crítica por fora. A insegurança pesa dentro de campo.", mod: mod, mult: mult };
  }

  /* helpers de liga (locais para o modo) */
  function roundRobin(ids) {
    var n = ids.length, arr = ids.slice(), rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var round = [];
      for (var i = 0; i < n / 2; i++) round.push(r % 2 === 0 ? [arr[i], arr[n - 1 - i]] : [arr[n - 1 - i], arr[i]]);
      rounds.push(round); arr.splice(1, 0, arr.pop());
    }
    return rounds;
  }
  function emptyTable(ids) { var t = {}; ids.forEach(function (id) { t[id] = { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }); return t; }
  function applyResult(t, h, a, hs, as) {
    var H = t[h], A = t[a]; H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; A.l++; H.pts += 3; } else if (hs < as) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  function standings(t) { return Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga); }); }

  function makeAttrs(base, pos) {
    var a = { pac: base, sho: base, pas: base, dri: base, def: base, phy: base };
    if (pos === "GK") { a.def = base + 6; a.sho = base - 25; }
    if (pos === "DF") { a.def += 6; a.sho -= 8; }
    if (pos === "FW") { a.sho += 8; a.def -= 12; a.pac += 4; }
    if (pos === "MF") { a.pas += 6; }
    Object.keys(a).forEach(function (k) { a[k] = Math.max(20, Math.min(99, a[k])); });
    return a;
  }
  function overallFrom(attrs, pos) {
    var w = pos === "GK" ? { def: .7, phy: .2, pas: .1 } : pos === "DF" ? { def: .5, phy: .25, pac: .15, pas: .1 }
      : pos === "FW" ? { sho: .4, pac: .2, dri: .25, phy: .1, pas: .05 } : { pas: .3, dri: .25, phy: .15, def: .15, sho: .1, pac: .05 };
    var s = 0; Object.keys(w).forEach(function (k) { s += (attrs[k] || 0) * w[k]; });
    return Math.round(s);
  }

  function startSeasonFixtures(career) {
    var league = TM.data.league(TM.data.club(career.clubId).leagueId);
    career.leagueId = league.id;
    career.fixtures = roundRobin(league.clubIds.slice());
    career.round = 0;
    career.table = emptyTable(league.clubIds);
    // meta da temporada
    if (career.pos === "FW") career.objective = { desc: "Marcar 12 gols na temporada", type: "goals", target: 12 };
    else if (career.pos === "GK" || career.pos === "DF") career.objective = { desc: "Nota média 7.0+ na temporada", type: "rating", target: 7.0 };
    else career.objective = { desc: "Dar 8 assistências (participações) e nota 7.0+", type: "rating", target: 7.0 };
    career.seasonGoals = 0; career.seasonApps = 0; career.seasonRatingSum = 0;
  }

  /* ---------- entrada ---------- */
  TM.ui.register("player", function (screen) {
    var saved = TM.storage.playerCareer();
    if (saved) { TM.ui.go("player-hub"); return; }
    screen.appendChild(TM.ui.topbar("⭐ Rumo ao Estrelato", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Crie o seu jogador do zero ou assuma a carreira de um jogador já existente." }));
    body.appendChild(el("div", { class: "big-choice" }, [
      el("button", { class: "choice-card", on: { click: function () { TM.ui.go("player-create"); } } }, [
        el("span", { class: "cc-ic", text: "🧑‍🎨" }), el("span", { class: "cc-t", text: "Criar meu jogador" }),
        el("span", { class: "cc-d", text: "Foto, país, físico e clube inicial" })
      ]),
      el("button", { class: "choice-card", on: { click: function () { TM.ui.go("player-existing"); } } }, [
        el("span", { class: "cc-ic", text: "🔎" }), el("span", { class: "cc-t", text: "Assumir jogador existente" }),
        el("span", { class: "cc-d", text: "Escolha alguém do mundo do jogo" })
      ])
    ]));
  });

  /* ---------- criação ---------- */
  TM.ui.register("player-create", function (screen) {
    screen.appendChild(TM.ui.topbar("Criar jogador", function () { TM.ui.go("player"); }));
    var form = { name: "", photo: null, nationId: "nat0", year: 2004, month: 6, day: 15, height: 180, weight: 75, pos: "FW", clubId: null };
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // foto
    var photoPreview = el("div", { class: "photo-drop" }, [ el("span", { text: "📷 Adicionar foto" }) ]);
    var fileInput = el("input", { type: "file", accept: "image/*", style: "display:none" });
    photoPreview.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        // redimensiona para no máx 256px para caber no armazenamento
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement("canvas");
          var scale = Math.min(1, 256 / Math.max(img.width, img.height));
          canvas.width = img.width * scale; canvas.height = img.height * scale;
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          form.photo = canvas.toDataURL("image/jpeg", 0.82);
          TM.ui.clear(photoPreview);
          photoPreview.appendChild(el("img", { src: form.photo, class: "photo-img" }));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    body.appendChild(el("div", { class: "setting center" }, [ photoPreview, fileInput ]));

    function field(label, input) { return el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: label }), input ]); }

    var nameInput = el("input", { class: "text-input", type: "text", placeholder: "Nome do jogador", maxlength: "24" });
    nameInput.addEventListener("input", function () { form.name = nameInput.value; });
    body.appendChild(field("Nome", nameInput));

    // país
    var natSel = el("select", { class: "select" });
    TM.data.world().nations.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (n) { natSel.appendChild(el("option", { value: n.id, text: n.name })); });
    natSel.value = form.nationId;
    natSel.addEventListener("change", function () { form.nationId = natSel.value; });
    body.appendChild(field("País de nascimento", natSel));

    // data de nascimento
    var dob = el("div", { class: "dob-row" });
    var daySel = numberSelect(1, 28, form.day), monthSel = numberSelect(1, 12, form.month), yearSel = numberSelect(1988, 2010, form.year);
    daySel.addEventListener("change", function () { form.day = +daySel.value; });
    monthSel.addEventListener("change", function () { form.month = +monthSel.value; });
    yearSel.addEventListener("change", function () { form.year = +yearSel.value; refreshAge(); });
    dob.appendChild(daySel); dob.appendChild(monthSel); dob.appendChild(yearSel);
    var ageLabel = el("span", { class: "age-label" });
    body.appendChild(field("Data de nascimento", el("div", {}, [ dob, ageLabel ])));
    function refreshAge() { ageLabel.textContent = "Idade: " + (CUR_YEAR - form.year) + " anos"; }
    refreshAge();

    // altura / peso
    var hInput = rangeInput(160, 205, form.height, "cm", function (v) { form.height = v; });
    var wInput = rangeInput(55, 100, form.weight, "kg", function (v) { form.weight = v; });
    body.appendChild(field("Altura", hInput.node));
    body.appendChild(field("Peso", wInput.node));

    // posição
    var posSeg = el("div", { class: "segmented full" });
    [["GK", "Goleiro"], ["DF", "Defensor"], ["MF", "Meia"], ["FW", "Atacante"]].forEach(function (o) {
      var b = el("button", { class: "seg-btn" + (form.pos === o[0] ? " active" : ""), text: o[1], on: { click: function () {
        form.pos = o[0]; posSeg.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active");
      } } });
      posSeg.appendChild(b);
    });
    body.appendChild(field("Posição", posSeg));

    // clube inicial
    var leagueSel = el("select", { class: "select" });
    TM.data.world().leagues.forEach(function (lg) { leagueSel.appendChild(el("option", { value: lg.id, text: lg.name })); });
    var clubSel = el("select", { class: "select" });
    function fillClubs() {
      TM.ui.clear(clubSel);
      TM.data.league(leagueSel.value).clubIds.map(TM.data.club).sort(function (a, b) { return a.name.localeCompare(b.name); })
        .forEach(function (c) { clubSel.appendChild(el("option", { value: c.id, text: c.name })); });
      form.clubId = clubSel.value;
    }
    leagueSel.addEventListener("change", fillClubs);
    clubSel.addEventListener("change", function () { form.clubId = clubSel.value; });
    fillClubs();
    body.appendChild(field("Liga inicial", leagueSel));
    body.appendChild(field("Clube inicial", clubSel));

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Começar carreira", function () {
        if (!form.name.trim()) { TM.ui.toast("Digite um nome"); return; }
        var age = CUR_YEAR - form.year;
        var base = age <= 20 ? 66 : age <= 26 ? 72 : 70; // talento inicial
        var attrs = makeAttrs(base, form.pos);
        var player = {
          id: "me", name: form.name.trim(), photo: form.photo, clubId: form.clubId,
          pos: form.pos, pos2: ({ GK: "GOL", DF: "ZAG", MF: "MEI", FW: "CA" })[form.pos] || form.pos, age: age, birth: { d: form.day, m: form.month, y: form.year },
          height: form.height, weight: form.weight, nationId: form.nationId,
          nationName: TM.data.nation(form.nationId).name, attrs: attrs, overall: overallFrom(attrs, form.pos)
        };
        var career = Object.assign({}, player, {
          created: true, season: 1, careerGoals: 0, careerApps: 0, offers: [], calledUp: false, history: [],
          notifications: [], skillPoints: 0, injured: 0, momentum: 0, recentRatings: []
        });
        startSeasonFixtures(career);
        TM.storage.savePlayerCareer(career);
        TM.ui.go("player-hub");
      }, "btn primary big")
    ]));

    function numberSelect(min, max, val) {
      var s = el("select", { class: "select mini" });
      for (var i = min; i <= max; i++) { var o = el("option", { value: i, text: i }); if (i === val) o.selected = true; s.appendChild(o); }
      return s;
    }
    function rangeInput(min, max, val, unit, cb) {
      var out = el("span", { class: "range-val", text: val + " " + unit });
      var inp = el("input", { type: "range", min: min, max: max, value: val, class: "slider" });
      inp.addEventListener("input", function () { out.textContent = inp.value + " " + unit; cb(+inp.value); });
      return { node: el("div", { class: "range-wrap" }, [ inp, out ]) };
    }
  });

  /* ---------- assumir existente ---------- */
  TM.ui.register("player-existing", function (screen) {
    screen.appendChild(TM.ui.topbar("Assumir jogador", function () { TM.ui.go("player"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var leagueSel = el("select", { class: "select" });
    TM.data.world().leagues.forEach(function (lg) { leagueSel.appendChild(el("option", { value: lg.id, text: lg.name })); });
    var clubSel = el("select", { class: "select" });
    var listWrap = el("div", { class: "squad-list" });
    function fillClubs() { TM.ui.clear(clubSel); TM.data.league(leagueSel.value).clubIds.map(TM.data.club).forEach(function (c) { clubSel.appendChild(el("option", { value: c.id, text: c.name })); }); fillPlayers(); }
    function fillPlayers() {
      TM.ui.clear(listWrap);
      TM.data.clubPlayers(clubSel.value).forEach(function (p) {
        listWrap.appendChild(TM.ui.playerRow(p, { onClick: function (pl) { takeover(pl); } }));
      });
    }
    leagueSel.addEventListener("change", fillClubs);
    clubSel.addEventListener("change", fillPlayers);
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Liga" }), leagueSel ]));
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Clube" }), clubSel ]));
    body.appendChild(listWrap);
    fillClubs();

    function takeover(p) {
      var career = Object.assign({}, p, {
        created: false, photo: null, birth: { d: 1, m: 1, y: CUR_YEAR - p.age },
        season: 1, careerGoals: 0, careerApps: 0, offers: [], calledUp: false, history: [],
        notifications: [], skillPoints: 0, injured: 0
      });
      startSeasonFixtures(career);
      TM.storage.savePlayerCareer(career);
      TM.ui.go("player-hub");
    }
  });

  /* ---------- foto do jogador (usa upload se houver) ---------- */
  function myFace(career, cls) {
    if (career.photo) return el("img", { src: career.photo, class: cls });
    return TM.img.playerImg(career, cls);
  }

  /* ---------- central do jogador ---------- */
  TM.ui.register("player-hub", function (screen) {
    var c = TM.storage.playerCareer();
    if (!c) { TM.ui.go("player"); return; }
    // migração de carreiras antigas
    if (!c.notifications) c.notifications = [];
    if (c.skillPoints == null) c.skillPoints = 0;
    if (c.injured == null) c.injured = 0;
    if (c.momentum == null) c.momentum = 0;
    if (!c.recentRatings) c.recentRatings = [];
    if (c.penDuty == null) c.penDuty = false;
    TM.storage.savePlayerCareer(c);
    var club = TM.data.club(c.clubId);

    var unread = TM.notify.unread(c);
    var bell = el("button", { class: "tb-bell", on: { click: function () { TM.ui.go("player-notifications"); } } }, [
      el("span", { text: "🔔" }), unread ? el("span", { class: "bell-badge", text: unread > 9 ? "9+" : unread }) : null
    ]);
    var dots = el("button", { class: "tb-menu", text: "⋯", on: { click: function () {
      TM.ui.optionsMenu("Opções da carreira", [
        { label: "💾 Salvar (continuar jogando)", fn: function () { TM.storage.savePlayerCareer(c); TM.ui.toast("✔ Carreira salva"); } },
        { label: "📤 Salvar e sair", fn: function () { TM.saves.park("player"); TM.ui.toast("Carreira guardada em Minhas Carreiras"); TM.ui.go("modes"); } },
        { label: "🏠 Voltar ao menu (sem sair)", fn: function () { TM.ui.go("modes"); } },
        { label: "🎽 Aposentar-se", fn: function () { TM.ui.confirm("Se aposentar agora?", "Encerra sua carreira como jogador.", "Aposentar", function () { TM.ui.go("player-retire", { manual: true }); }, true); } },
        { label: "🗑️ Finalizar carreira", danger: true, fn: function () {
          TM.ui.confirm("Finalizar esta carreira?", "O progresso será apagado permanentemente.", "Finalizar", function () { TM.storage.clearPlayerCareer(); TM.ui.go("modes"); }, true);
        } }
      ]);
    } } });
    screen.appendChild(TM.ui.topbar("Minha Carreira", function () { TM.ui.go("modes"); }, el("div", { class: "tb-actions" }, [ bell, dots ])));

    // cartão do jogador
    screen.appendChild(el("div", { class: "player-card" }, [
      myFace(c, "pc-face"),
      el("div", { class: "pc-info" }, [
        el("div", { class: "pc-name", text: c.name }),
        el("div", { class: "pc-sub", text: TM.data.posLabel(c) + " · " + c.age + " anos · " + c.nationName }),
        el("div", { class: "pc-club" }, [ TM.img.clubImg(club, "pc-crest"), el("span", { text: club.name }) ])
      ]),
      TM.ui.ovBadge(c.overall)
    ]));

    if (c.calledUp && c.natSeason) {
      var isWCn = c.natSeason.type === "wc";
      screen.appendChild(el("div", { class: "callup-banner clickable", on: { click: function () { TM.ui.go("player-nation"); } } }, [
        el("span", { text: (isWCn ? "🏆 Convocado para a Copa do Mundo por " : "🌍 Convocado pela seleção de ") + c.nationName + "! " }),
        el("span", { class: "sp-go", text: "Entrar em campo →" })
      ]));
    } else if (c.calledUp) {
      screen.appendChild(el("div", { class: "callup-banner", text: "🌍 Você foi convocado pela seleção de " + c.nationName + "!" }));
    }

    // estatísticas da temporada
    var avg = c.seasonApps ? (c.seasonRatingSum / c.seasonApps).toFixed(1) : "—";
    screen.appendChild(el("div", { class: "stat-tiles" }, [
      tile("Temporada", c.season), tile("Jogos", c.seasonApps), tile("Gols", c.seasonGoals), tile("Nota média", avg)
    ]));

    // opinião / momento do jogador
    var mi = momentumInfo(c);
    var recent = (c.recentRatings || []);
    var momCard = el("div", { class: "moment-card " + mi.css }, [
      el("div", { class: "moment-emoji", text: mi.emoji }),
      el("div", { class: "moment-body" }, [
        el("div", { class: "moment-head" }, [
          el("span", { class: "moment-label", text: mi.label }),
          el("span", { class: "moment-eff", text: (mi.mod >= 0 ? "+" : "") + mi.mod.toFixed(2) + " em campo" })
        ]),
        el("div", { class: "moment-text", text: mi.text }),
        recent.length ? el("div", { class: "moment-recent" }, [
          el("span", { class: "mr-lbl", text: "Últimas notas:" })
        ].concat(recent.map(function (r) {
          return el("span", { class: "mr-dot rating-" + ratingClass(r), text: r.toFixed(1) });
        }))) : null
      ])
    ]);
    screen.appendChild(momCard);
    if (c.penDuty) screen.appendChild(el("div", { class: "pen-duty-tag", text: "🎯 Você é o batedor de pênaltis do time" }));

    // meta
    var prog = c.objective.type === "goals" ? c.seasonGoals + "/" + c.objective.target
      : (c.seasonApps ? (c.seasonRatingSum / c.seasonApps).toFixed(1) : "0.0") + " / " + c.objective.target.toFixed(1);
    screen.appendChild(el("div", { class: "objective" }, [
      el("span", { class: "obj-ic", text: "🎯" }),
      el("div", {}, [ el("div", { class: "obj-desc", text: c.objective.desc }), el("div", { class: "obj-prog", text: "Progresso: " + prog }) ])
    ]));

    // pontos de habilidade
    if (c.skillPoints > 0) {
      screen.appendChild(el("div", { class: "sp-banner", on: { click: function () { TM.ui.go("player-attrs"); } } }, [
        el("span", { text: "⭐ Você tem " + c.skillPoints + " ponto(s) de habilidade para gastar!" }),
        el("span", { class: "sp-go", text: "Evoluir →" })
      ]));
    }
    if (c.injured > 0) screen.appendChild(el("div", { class: "callup-banner injured", text: "🚑 Você está lesionado — fora por " + c.injured + " jogo(s)." }));

    // próximo jogo
    var nextFix = null;
    if (c.round < c.fixtures.length) c.fixtures[c.round].forEach(function (m) { if (m[0] === c.clubId || m[1] === c.clubId) nextFix = m; });
    if (nextFix) {
      var isHome = nextFix[0] === c.clubId, opp = TM.data.club(isHome ? nextFix[1] : nextFix[0]);
      var compId = "lg-" + (club.leagueId || "br");
      var homeClubP = isHome ? club : opp;
      var card = el("div", { class: "next-match" }, [
        el("div", { class: "nm-label", text: "Rodada " + (c.round + 1) + "/" + c.fixtures.length + (isHome ? " · Em casa" : " · Fora") }),
        el("div", { class: "nm-teams" }, [ el("span", { text: isHome ? club.name : opp.name }), el("span", { class: "nm-x", text: "×" }), el("span", { text: isHome ? opp.name : club.name }) ]),
        TM.ui.stadiumBanner(homeClubP, { compact: true, label: "Mandante: " + homeClubP.name }),
        TM.ui.button(c.injured > 0 ? "▶ Avançar (lesionado)" : "▶ Jogar", function () { playMatch(c); }, "btn primary")
      ]);
      TM.ui.applyCompTheme(card, compId);
      var pbn = TM.ui.compBanner(compId, isHome ? "Em casa" : "Fora"); if (pbn) card.insertBefore(pbn, card.firstChild);
      screen.appendChild(card);
    } else {
      screen.appendChild(el("div", { class: "next-match season-end" }, [
        el("div", { class: "nm-label", text: "🏁 Fim da temporada " + c.season },),
        TM.ui.button("Nova temporada", function () {
          var avg = c.seasonApps ? c.seasonRatingSum / c.seasonApps : 6;
          c.history.push({ season: c.season, clubId: c.clubId, apps: c.seasonApps, goals: c.seasonGoals });
          c.careerGoals += c.seasonGoals; c.careerApps += c.seasonApps; c.season++; c.age++; c.calledUp = false; c.natSeason = null; c.injured = 0;
          // aposentadoria: idade avançada (ou veterano em queda)
          var retire = c.age >= 39 || (c.age >= 35 && c.overall < 70 && Math.random() < 0.5) || (c.age >= 37 && Math.random() < 0.5);
          if (retire) { TM.storage.savePlayerCareer(c); TM.ui.go("player-retire", {}); return; }
          // pontos de habilidade de fim de temporada
          var spGain = 2 + (avg >= 7.5 ? 1 : 0);
          c.skillPoints += spGain;
          // evolução do overall conforme a fase e a idade
          // 14-29: ainda sobe (com boa fase) | 30-33: quase não mexe, só cai bem devagar | 34+: só cai
          var before = c.overall;
          if (c.age <= 29) {
            if (avg >= 7.2) c.overall = Math.min(97, c.overall + 1);
            else if (avg < 5.5) c.overall = Math.max(50, c.overall - 1);
          } else if (c.age <= 33) {
            if (avg < 6.5 && Math.random() < 0.5) c.overall = Math.max(50, c.overall - 1);
          } else {
            c.overall = Math.max(50, c.overall - 1);
          }
          if (c.age >= 35) TM.notify.push(c, { icon: "🎽", title: "Reta final", text: "Aos " + c.age + " anos, a aposentadoria se aproxima." });
          TM.notify.push(c, { icon: "📅", title: "Nova temporada", text: "Temporada encerrada (média " + avg.toFixed(1) + "). +" + spGain + " pontos de habilidade." + (c.overall !== before ? " Seu overall foi para " + c.overall + "." : "") });
          startSeasonFixtures(c); TM.storage.savePlayerCareer(c); TM.ui.go("player-hub");
        }, "btn primary")
      ]));
    }

    // propostas
    if (c.offers && c.offers.length) {
      var offBox = el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "📨 Propostas" }) ]);
      c.offers.forEach(function (off, i) {
        var oc = TM.data.club(off.clubId);
        offBox.appendChild(el("div", { class: "offer" }, [
          TM.img.clubImg(oc, "offer-crest"),
          el("div", { class: "offer-info" }, [ el("div", { text: oc.name }), el("div", { class: "offer-sub", text: "Overall do clube: " + TM.data.clubRating(off.clubId) }) ]),
          TM.ui.button("Aceitar", function () {
            c.clubId = off.clubId; c.offers = []; TM.storage.savePlayerCareer(c);
            TM.ui.toast("✔ Você assinou com " + oc.name); TM.ui.go("player-hub");
          }, "btn primary small"),
          TM.ui.button("Recusar", function () { c.offers.splice(i, 1); TM.storage.savePlayerCareer(c); TM.ui.go("player-hub"); }, "btn ghost small")
        ]));
      });
      screen.appendChild(offBox);
    }

    // atalhos
    var evoBtn = el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("player-attrs"); } } }, [
      el("span", { class: "hub-ic", text: "📈" }), el("span", { text: "Evolução" }),
      c.skillPoints > 0 ? el("span", { class: "bell-badge sp-badge", text: c.skillPoints }) : null
    ]);
    screen.appendChild(el("div", { class: "hub-actions" }, [
      evoBtn,
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("player-table"); } } }, [ el("span", { class: "hub-ic", text: "📊" }), el("span", { text: "Tabela" }) ]),
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("player-history"); } } }, [ el("span", { class: "hub-ic", text: "🗂️" }), el("span", { text: "Histórico" }) ])
    ]));

    function tile(label, val) { return el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: val }), el("div", { class: "tile-lbl", text: label }) ]); }
  });

  function realPlayerObj(c) {
    return { name: c.name, pos: c.pos, age: c.age, nationName: c.nationName, height: c.height, weight: c.weight, overall: c.overall, attrs: c.attrs, clubId: c.clubId, id: c.id };
  }

  // constrói o time com o jogador garantido no XI
  function buildTeam(clubId, me) {
    var club = TM.data.club(clubId);
    var others = TM.data.clubPlayers(clubId).filter(function (p) { return p.id !== me.id; });
    return { id: clubId, name: club.name, players: [me].concat(others), club: club };
  }

  function playMatch(c) {
    var settings = TM.storage.settings();
    var injuredThisGame = c.injured > 0;
    var me = realPlayerObj(c);
    var round = c.fixtures[c.round];
    var myFix = null;
    round.forEach(function (m) { if (m[0] === c.clubId || m[1] === c.clubId) myFix = m; });
    var iAmHome = myFix[0] === c.clubId;
    var oppId = iAmHome ? myFix[1] : myFix[0];

    // se lesionado, o jogador não entra em campo (não é foco), mas o clube joga
    var myTeam = injuredThisGame ? TM.engine.teamFromClub(c.clubId) : buildTeam(c.clubId, me);
    var oppTeam = TM.engine.teamFromClub(oppId);
    var teamA = iAmHome ? myTeam : oppTeam, teamB = iAmHome ? oppTeam : myTeam;

    var mi = momentumInfo(c);
    var mySide = iAmHome ? 0 : 1;
    var result = TM.engine.simulate(teamA, teamB, injuredThisGame ? { realism: settings.realism } : { realism: settings.realism, difficulty: settings.difficulty, focusPlayerId: "me", focusForm: mi.mod, focusFormMult: mi.mult, userSide: mySide, penTakerId: c.penDuty ? "me" : null });

    // transmissão ao vivo; o pós-jogo só é aplicado ao final (onComplete)
    var compId = "lg-" + (TM.data.club(c.clubId).leagueId || "br");
    TM.ui.go("player-live", {
      teamA: teamA, teamB: teamB, result: result, iAmHome: iAmHome, sat: injuredThisGame, compId: compId,
      title: TM.data.club(c.clubId).name + " · Rodada " + (c.round + 1), back: "player-hub",
      onComplete: function () {
        if (injuredThisGame) { finishClubMatch(c, teamA, teamB, result, iAmHome, injuredThisGame, round); return; }
        TM.ui.go("player-moments", { c: c, teamA: teamA, teamB: teamB, result: result, iAmHome: iAmHome, round: round, compId: compId });
      }
    });
  }

  function finishClubMatch(c, teamA, teamB, result, iAmHome, injuredThisGame, round) {
    var settings = TM.storage.settings();
    round.forEach(function (m) {
      if (m[0] === c.clubId || m[1] === c.clubId) {
        applyResult(c.table, teamA.id, teamB.id, result.score[0], result.score[1]);
      } else {
        var rr = TM.engine.simulate(TM.engine.teamFromClub(m[0]), TM.engine.teamFromClub(m[1]), { realism: settings.realism });
        applyResult(c.table, m[0], m[1], rr.score[0], rr.score[1]);
      }
    });
    c.round++;

    if (injuredThisGame) {
      c.injured--;
      if (c.injured <= 0) TM.notify.push(c, { icon: "💪", title: "Recuperado", text: "Você se recuperou da lesão e está à disposição." });
      TM.storage.savePlayerCareer(c);
      TM.ui.go("player-match", { teamA: teamA, teamB: teamB, result: result, iAmHome: iAmHome, sat: true });
      return;
    }

    // desempenho
    var f = result.focus;
    c.seasonApps++; c.seasonGoals += f.goals; c.seasonRatingSum += f.rating;
    updateMomentum(c, f.rating);

    // lesão do jogador
    if (f.injured) {
      c.injured = f.injured;
      TM.notify.push(c, { icon: "🚑", title: "Você se lesionou", text: "Ficará fora por cerca de " + f.injured + " jogo(s)." });
    }
    // pontos de habilidade por boa atuação
    var gained = 0;
    if (f.rating >= 8.5) gained = 2; else if (f.rating >= 7.3) gained = 1;
    if (f.goals >= 2) gained += 1;
    if (gained > 0) { c.skillPoints += gained; TM.notify.push(c, { icon: "⭐", title: "Pontos de habilidade", text: "Ótima atuação (nota " + f.rating.toFixed(1) + ")! +" + gained + " ponto(s) para gastar em atributos." }); }
    // feedback do técnico
    if (f.rating < 5.6 && Math.random() < 0.5) TM.notify.push(c, { icon: "😬", title: "Cobrança do técnico", text: "O técnico não gostou da sua atuação. Melhore nos próximos jogos." });
    else if (f.rating >= 8.5 && Math.random() < 0.5) TM.notify.push(c, { icon: "🤝", title: "Elogio do técnico", text: "O técnico está muito satisfeito e conta com você como titular." });

    // designação de batedor de pênaltis pelo técnico
    var seasonAvg = c.seasonApps ? c.seasonRatingSum / c.seasonApps : 6;
    if (!c.penDuty) {
      if (((c.attrs && c.attrs.sho >= 78) || seasonAvg >= 7.3) && Math.random() < 0.14) {
        c.penDuty = true;
        TM.notify.push(c, { icon: "🎯", title: "Você é o batedor de pênaltis!", text: "O técnico te escolheu como cobrador oficial de pênaltis do time. Aproveite pra fazer mais gols!" });
      }
    } else if (seasonAvg < 6.0 && Math.random() < 0.09) {
      c.penDuty = false;
      TM.notify.push(c, { icon: "🎯", title: "Cobrança de pênaltis", text: "O técnico passou a cobrança de pênaltis para outro jogador por ora." });
    }

    maybeOffer(c, f);
    maybeCallup(c);

    TM.storage.savePlayerCareer(c);
    TM.ui.go("player-match", { teamA: teamA, teamB: teamB, result: result, iAmHome: iAmHome, compId: "lg-" + (TM.data.club(c.clubId).leagueId || "br") });
  }

  /* ---------- decisões no meio do jogo (carreira de jogador) ---------- */
  var MOMENTS = [
    { q: "Você recebe livre na entrada da área. O que faz?", opts: ["Finalizar no ângulo", "Tocar pro melhor posicionado", "Dominar e driblar"] },
    { q: "Pênalti a seu favor! Onde bate?", opts: ["No canto esquerdo", "No meio do gol", "No canto direito"] },
    { q: "Contra-ataque 2 contra 1. Qual a decisão?", opts: ["Passar pro companheiro livre", "Finalizar você mesmo", "Segurar e esperar apoio"] },
    { q: "Falta perigosa na entrada da área. O que faz?", opts: ["Chutar direto no gol", "Cruzar na cabeça do atacante", "Bater rápido pro lado"] },
    { q: "A bola sobra na área após escanteio. Como resolve?", opts: ["Finalizar de primeira", "Ajeitar e depois chutar", "Cabecear no canto"] },
    { q: "Marcado de perto, sem espaço. Como sai da marcação?", opts: ["Drible curto", "Passe de primeira", "Proteger e girar"] },
    { q: "O goleiro adversário saiu mal do gol. O que faz?", opts: ["Cavar por cima", "Chutar rasteiro no canto", "Cortar pra dentro"] },
    { q: "Você tem espaço para conduzir. Qual escolha?", opts: ["Acelerar em velocidade", "Passe vertical no meio", "Abrir na ponta"] },
    { q: "Cruzamento vindo da direita. Como ataca a bola?", opts: ["Antecipar no primeiro pau", "Esperar no segundo pau", "Recuar para a entrada"] },
    { q: "Jogo truncado, time precisa de inspiração. O que tenta?", opts: ["Jogada individual ousada", "Tabela rápida com o meia", "Chute de fora da área"] }
  ];
  function momShuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  TM.ui.register("player-moments", function (screen, params) {
    if (!params || !params.result) { TM.ui.go("player-hub"); return; }
    var c = params.c, result = params.result;
    if (params.compId) TM.ui.applyCompTheme(screen, params.compId);
    screen.appendChild(TM.ui.topbar("⚡ Momentos decisivos", null));
    var picks = momShuffle(MOMENTS).slice(0, 3);
    // rola qual opção é a "certa" de cada momento (o técnico avalia sua leitura de jogo)
    var correct = picks.map(function (m) { return Math.floor(Math.random() * m.opts.length); });
    var panel = el("div", { class: "panel-narrow moment-play" });
    screen.appendChild(panel);
    var idx = 0, hits = 0, ratingDelta = 0;

    function render() {
      panel.innerHTML = "";
      if (idx >= picks.length) { finish(); return; }
      panel.appendChild(el("div", { class: "press-progress" }, [ el("span", { text: "Lance " + (idx + 1) + " de 3" }), el("span", { class: "press-vs", text: hits + " acerto(s)" }) ]));
      var m = picks[idx];
      panel.appendChild(el("div", { class: "press-reporter" }, [ el("span", { class: "press-mic", text: "⚽" }), el("div", { class: "press-q", text: m.q }) ]));
      var opts = el("div", { class: "press-opts" });
      m.opts.forEach(function (txt, i) {
        opts.appendChild(el("button", { class: "press-opt", on: { click: function () {
          var ok = i === correct[idx];
          if (ok) { hits++; ratingDelta += 0.45; } else { ratingDelta -= 0.25; }
          panel.innerHTML = "";
          panel.appendChild(el("div", { class: "press-answer" }, [ el("span", { class: "press-you", text: "Você:" }), el("span", { text: " " + txt } ) ]));
          panel.appendChild(el("div", { class: "press-react " + (ok ? "good" : "bad"), text: ok ? "✅ Boa decisão! Jogada certa." : "❌ Não era a melhor escolha (o ideal era: " + m.opts[correct[idx]] + ")." }));
          panel.appendChild(el("div", { class: "actions" }, [ TM.ui.button(idx < 2 ? "Próximo lance →" : "Ver resultado", function () { idx++; render(); }, "btn primary") ]));
        } } }, [ el("span", { text: txt }) ]));
      });
      panel.appendChild(opts);
    }
    function finish() {
      if (result.focus) result.focus.rating = Math.max(4.5, Math.min(10, Math.round((result.focus.rating + ratingDelta) * 10) / 10));
      if (hits === 3) { c.skillPoints = (c.skillPoints || 0) + 1; TM.notify.push(c, { icon: "🧠", title: "Leitura de jogo", text: "O técnico elogiou suas decisões em campo! +1 ponto de habilidade." }); }
      else if (hits === 0) TM.notify.push(c, { icon: "😕", title: "Decisões", text: "O técnico achou que você errou as escolhas nos momentos decisivos." });
      var emoji = hits >= 2 ? "😎" : hits === 1 ? "😐" : "😬";
      panel.innerHTML = "";
      panel.appendChild(el("div", { class: "press-summary " + (hits >= 2 ? "good" : hits === 0 ? "bad" : "") }, [
        el("div", { class: "press-sum-emoji", text: emoji }),
        el("div", { class: "press-sum-txt", text: hits + "/3 decisões certas · " + (ratingDelta >= 0 ? "+" : "") + ratingDelta.toFixed(2) + " na sua nota" })
      ]));
      panel.appendChild(el("div", { class: "actions" }, [ TM.ui.button("Continuar", function () {
        finishClubMatch(c, params.teamA, params.teamB, result, params.iAmHome, false, params.round);
      }, "btn primary big") ]));
    }
    render();
  });

  /* ---------- transmissão ao vivo (carreira de jogador — sem modo pausa) ---------- */
  TM.ui.register("player-live", function (screen, params) {
    if (!params || !params.result) { TM.ui.go("player-hub"); return; }
    if (params.compId) TM.ui.applyCompTheme(screen, params.compId);
    TM.matchview.play(screen, {
      teamA: params.teamA, teamB: params.teamB, result: params.result,
      title: params.title || "Ao vivo",
      onBack: function () { TM.ui.go(params.back || "player-hub"); },
      onDone: function () { if (params.onComplete) params.onComplete(); }
    });
  });

  function maybeOffer(c, f) {
    if (c.offers.length >= 2) return;
    var avg = c.seasonApps ? c.seasonRatingSum / c.seasonApps : 6;
    // ocasional: mais chance jogando bem, mas às vezes rola mesmo sem grande fase
    var chance = avg >= 7.2 ? 0.30 : avg >= 6.6 ? 0.16 : 0.06;
    if (Math.random() >= chance) return;
    var world = TM.data.world();
    // jogando bem -> clubes maiores; regular -> clubes de nível parecido
    var minRating = avg >= 7.0 ? c.overall : c.overall - 5;
    var candidates = world.clubs.filter(function (cl) { return cl.id !== c.clubId && TM.data.clubRating(cl.id) >= minRating; });
    if (!candidates.length) return;
    var pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (!c.offers.some(function (o) { return o.clubId === pick.id; })) {
      c.offers.push({ clubId: pick.id });
      TM.notify.push(c, { icon: "📨", title: "Proposta de clube", text: pick.name + " está interessado em você! Veja em Propostas no seu hub." });
    }
  }
  function maybeCallup(c) {
    if (c.calledUp) return;
    var avg = c.seasonApps ? c.seasonRatingSum / c.seasonApps : 0;
    if (c.seasonApps >= 4 && avg >= 7.2) {
      c.calledUp = true;
      setupPlayerNatSeason(c);
      var isWC = c.natSeason && c.natSeason.type === "wc";
      TM.notify.push(c, { icon: "🌍", title: "Convocação!", text: "Você foi convocado para a seleção de " + c.nationName + "!" + (isWC ? " É ano de Copa do Mundo — vá em Seleção e entre em campo!" : " Os jogos da seleção estão liberados no seu hub.") });
    }
  }

  /* ================= SELEÇÃO NACIONAL (carreira de jogador) ================= */
  // monta a seleção do jogador com ele garantido no XI
  function myNationTeam(c) {
    var nat = TM.data.nation(c.nationId);
    var squad = TM.data.nationSquad(c.nationId).filter(function (p) { return p.id !== c.id; });
    return { id: nat.id, name: nat.name, players: [realPlayerObj(c)].concat(squad), nation: nat };
  }
  function natCtx(c) {
    return {
      sim: function (aId, bId) {
        var A = aId === c.nationId ? myNationTeam(c) : TM.engine.teamFromNation(aId);
        var B = bId === c.nationId ? myNationTeam(c) : TM.engine.teamFromNation(bId);
        return TM.engine.simulate(A, B, { realism: TM.storage.settings().realism, neutral: true });
      },
      rating: function (id) { return TM.comp.natRating(id); }
    };
  }
  // Copa do Mundo (a cada 4 temporadas, igual ao treinador) ou amistosos
  function setupPlayerNatSeason(c) {
    if (c.season % 4 === 1) {
      // formato 2026: 48 seleções, 12 grupos, 2 por grupo + 8 melhores 3os
      var teams = TM.data.world().nations.map(function (n) { return n.id; });
      c.natSeason = { type: "wc", tour: TM.tournament.create(teams, { groups: 12, perGroup: 4, advance: 2, bestThirds: 8, userId: c.nationId }), matchNo: 0 };
    } else {
      var others = TM.data.world().nations.filter(function (n) { return n.id !== c.nationId; });
      var games = [];
      for (var i = 0; i < 3; i++) { var o = others[Math.floor(Math.random() * others.length)]; games.push({ oppId: o.id, played: false, hs: 0, as: 0 }); }
      c.natSeason = { type: "friendly", games: games };
    }
  }
  // aplica a atuação do jogador em jogo da seleção (estatísticas, lesão, pontos)
  function applyNatPerf(c, f) {
    if (!f) return;
    c.natApps = (c.natApps || 0) + 1;
    c.natGoals = (c.natGoals || 0) + f.goals;
    updateMomentum(c, f.rating);
    if (f.injured) { c.injured = f.injured; TM.notify.push(c, { icon: "🚑", title: "Lesão na seleção", text: "Você se lesionou servindo a seleção. Fora por ~" + f.injured + " jogo(s)." }); }
    var gained = 0; if (f.rating >= 8.5) gained = 2; else if (f.rating >= 7.3) gained = 1; if (f.goals >= 2) gained += 1;
    if (gained > 0) { c.skillPoints += gained; TM.notify.push(c, { icon: "⭐", title: "Pontos de habilidade", text: "Boa atuação pela seleção (nota " + f.rating.toFixed(1) + ")! +" + gained + " ponto(s)." }); }
  }
  function playNationMatch(c) {
    var settings = TM.storage.settings();
    var ns = c.natSeason;
    if (ns.type === "wc") {
      var ctx = natCtx(c);
      var m = TM.tournament.nextUserMatch(ns.tour, ctx);
      if (m.end) { TM.storage.savePlayerCareer(c); TM.ui.go("player-nation"); return; }
      var userHome = m.homeId === c.nationId;
      var mine = myNationTeam(c), opp = TM.engine.teamFromNation(userHome ? m.awayId : m.homeId);
      var teamA = userHome ? mine : opp, teamB = userHome ? opp : mine;
      var label = TM.comp.wcRoundLabel(null, m);
      var miN = momentumInfo(c);
      var result = TM.engine.simulate(teamA, teamB, { realism: settings.realism, neutral: true, focusPlayerId: "me", focusForm: miN.mod, focusFormMult: miN.mult });
      TM.ui.go("player-live", {
        teamA: teamA, teamB: teamB, result: result, iAmHome: userHome, title: "Copa do Mundo · " + label, back: "player-nation", compId: "nat-world",
        onComplete: function () {
          var hs = result.score[0], as = result.score[1];
          var penCtx = hs === as && TM.tournament.userPenContext ? TM.tournament.userPenContext(ns.tour, hs, as, ctx) : null;
          function finish(penWinnerId) {
            TM.tournament.applyUserMatch(ns.tour, hs, as, ctx, penWinnerId);
            ns.matchNo++;
            applyNatPerf(c, result.focus);
            TM.notify.push(c, { icon: "🏆", title: "Copa do Mundo · " + label, text: c.nationName + " " + (userHome ? hs + "x" + as : as + "x" + hs) + " · você fez " + (result.focus ? result.focus.goals : 0) + " gol(s), nota " + (result.focus ? result.focus.rating.toFixed(1) : "-") + "." });
            TM.storage.savePlayerCareer(c);
            TM.ui.go("player-match", { teamA: teamA, teamB: teamB, result: result, iAmHome: userHome, nat: true, back: "player-nation", title: "Copa do Mundo · " + label, compId: "nat-world", penWinnerId: penWinnerId });
          }
          if (penCtx) {
            var tA = TM.engine.teamFromNation(penCtx.aId), tB = TM.engine.teamFromNation(penCtx.bId);
            var shoot = TM.engine.shootout(tA, tB);
            var winId = shoot.winner === 0 ? penCtx.aId : penCtx.bId;
            TM.ui.go("pen-shootout", { teamA: tA, teamB: tB, shoot: shoot, compId: "nat-world", title: "Pênaltis · Copa do Mundo", onDone: function () { finish(winId); } });
          } else { finish(null); }
        }
      });
      return;
    }
    var g = null; for (var i = 0; i < ns.games.length; i++) { if (!ns.games[i].played) { g = ns.games[i]; break; } }
    if (!g) { TM.ui.go("player-nation"); return; }
    var mine2 = myNationTeam(c), opp2 = TM.engine.teamFromNation(g.oppId);
    var miN2 = momentumInfo(c);
    var result2 = TM.engine.simulate(mine2, opp2, { realism: settings.realism, neutral: true, focusPlayerId: "me", focusForm: miN2.mod, focusFormMult: miN2.mult });
    TM.ui.go("player-live", {
      teamA: mine2, teamB: opp2, result: result2, iAmHome: true, title: "Amistoso da seleção", back: "player-nation",
      onComplete: function () {
        g.played = true; g.hs = result2.score[0]; g.as = result2.score[1];
        applyNatPerf(c, result2.focus);
        TM.notify.push(c, { icon: "🌍", title: "Amistoso da seleção", text: c.nationName + " " + result2.score[0] + "x" + result2.score[1] + " " + TM.data.nation(g.oppId).name + " · você fez " + (result2.focus ? result2.focus.goals : 0) + " gol(s)." });
        TM.storage.savePlayerCareer(c);
        TM.ui.go("player-match", { teamA: mine2, teamB: opp2, result: result2, iAmHome: true, nat: true, back: "player-nation", title: "Amistoso da seleção" });
      }
    });
  }

  /* ---------- central da seleção (jogador) ---------- */
  TM.ui.register("player-nation", function (screen) {
    var c = TM.storage.playerCareer();
    if (!c) { TM.ui.go("player"); return; }
    if (!c.calledUp || !c.natSeason) { TM.ui.go("player-hub"); return; }
    var nat = TM.data.nation(c.nationId);
    var ns = c.natSeason, isWC = ns.type === "wc";
    screen.appendChild(TM.ui.topbar(isWC ? "🏆 Seleção · Copa do Mundo" : "🌍 Seleção", function () { TM.ui.go("player-hub"); }));
    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.nationImg(nat, "ch-crest"),
      el("div", {}, [ el("div", { class: "ch-name", text: "Seleção de " + c.nationName }),
        el("div", { class: "ch-sub", text: (isWC ? "Copa do Mundo" : "Amistosos internacionais") + " · " + (c.natApps || 0) + " jogos · " + (c.natGoals || 0) + " gols pela seleção" }) ]),
      el("button", { class: "date-cal-btn", text: "🔄 Voltar ao clube", on: { click: function () { TM.ui.go("player-hub"); } } })
    ]));
    if (isWC) renderPlayerWC(screen, c); else renderPlayerFriendlies(screen, c);
  });

  function renderPlayerWC(screen, c) {
    var ns = c.natSeason, t = ns.tour;
    var m = TM.tournament.nextUserMatch(t, natCtx(c));
    TM.storage.savePlayerCareer(c);
    if (m.end) {
      var champ = m.championId || t.championId, won = champ === c.nationId;
      screen.appendChild(el("div", { class: "next-match" }, [
        el("div", { class: "nm-label", text: won ? "🏆 CAMPEÃO DO MUNDO!" : "Copa do Mundo encerrada" }),
        el("div", { class: "nm-teams" }, [ el("span", { text: "Campeão: " + (champ ? TM.data.nation(champ).name : "—") }) ]),
        el("p", { class: "intro-text", style: "text-align:center", text: won ? "Você foi campeão do mundo com " + c.nationName + "! Que feito." : "Sua seleção caiu nesta Copa. A próxima é daqui a 4 temporadas." })
      ]));
    } else {
      var label = TM.comp.wcRoundLabel(null, m);
      var hN = TM.data.nation(m.homeId), aN = TM.data.nation(m.awayId);
      screen.appendChild(el("div", { class: "next-match" }, [
        el("div", { class: "nm-label", text: "🏆 " + label }),
        el("div", { class: "nm-teams" }, [ el("span", { text: hN.name }), el("span", { class: "nm-x", text: "×" }), el("span", { text: aN.name }) ]),
        TM.ui.button("▶ Jogar", function () { playNationMatch(c); }, "btn primary")
      ]));
    }
    screen.appendChild(el("div", { class: "hub-actions" }, [
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("player-nation-view"); } } }, [ el("span", { class: "hub-ic", text: "📊" }), el("span", { text: "Grupos & Chaveamento" }) ])
    ]));
  }

  function renderPlayerFriendlies(screen, c) {
    var ns = c.natSeason, next = null;
    ns.games.forEach(function (g) { if (!next && !g.played) next = g; });
    if (!next) {
      screen.appendChild(el("div", { class: "next-match" }, [ el("div", { class: "nm-label", text: "Sem amistosos restantes nesta temporada." }) ]));
    } else {
      var opp = TM.data.nation(next.oppId);
      screen.appendChild(el("div", { class: "next-match" }, [
        el("div", { class: "nm-label", text: "🤝 Amistoso Internacional" }),
        el("div", { class: "nm-teams" }, [ el("span", { text: c.nationName }), el("span", { class: "nm-x", text: "×" }), el("span", { text: opp.name }) ]),
        TM.ui.button("▶ Jogar amistoso", function () { playNationMatch(c); }, "btn primary")
      ]));
    }
    var done = ns.games.filter(function (g) { return g.played; });
    if (done.length) {
      var box = el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Amistosos disputados" }) ]);
      done.forEach(function (g) { var o = TM.data.nation(g.oppId); box.appendChild(el("div", { class: "hist-line" }, [ el("span", { text: c.nationName + "  " + g.hs + " × " + g.as + "  " + o.name }) ])); });
      screen.appendChild(box);
    }
  }

  /* ---------- grupos & chaveamento da Copa (jogador) ---------- */
  TM.ui.register("player-nation-view", function (screen) {
    var c = TM.storage.playerCareer();
    if (!c || !c.natSeason || c.natSeason.type !== "wc") { TM.ui.go("player-nation"); return; }
    var t = c.natSeason.tour;
    screen.appendChild(TM.ui.topbar("🏆 Copa do Mundo", function () { TM.ui.go("player-nation"); }));
    if (t.championId) screen.appendChild(el("div", { class: "champion-banner", text: "🏆 Campeão: " + TM.data.nation(t.championId).name }));
    renderNatGroups(screen, c, t);
    if (t.phase !== "group") renderNatBracket(screen, c, t.ko);
  });

  function renderNatGroups(screen, c, t) {
    var wrap = el("div", { class: "panel-narrow" });
    t.groups.forEach(function (g, gi) {
      wrap.appendChild(el("div", { class: "group-title", text: "Grupo " + String.fromCharCode(65 + gi) }));
      var st = TM.tournament.standings(g.table), tb = el("tbody");
      st.forEach(function (row, i) {
        var n = TM.data.nation(row.id);
        tb.appendChild(el("tr", { class: (row.id === c.nationId ? "me " : "") + (i < 2 ? "qualify" : "") }, [
          el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.nationImg(n, "lt-crest"), el("span", { text: n.name }) ]),
          el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
        ]));
      });
      wrap.appendChild(el("div", { class: "table-wrap" }, [ el("table", { class: "league-table" }, [ el("thead", {}, [ el("tr", {}, ["#", "Seleção", "P", "J", "SG"].map(function (h, i) { return el("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]), tb ]) ]));
    });
    screen.appendChild(wrap);
  }
  function renderNatBracket(screen, c, ko) {
    var wrap = el("div", { class: "bracket" });
    ko.rounds.forEach(function (round) {
      if (!round) return;
      var rd = el("div", { class: "bracket-round" }, [ el("div", { class: "br-round-title", text: TM.tournament.koTitle(round.length * 2) }) ]);
      round.forEach(function (tie) {
        var mine = tie[0] === c.nationId || tie[1] === c.nationId, played = tie[4] != null;
        var hN = TM.data.nation(tie[0]), aN = TM.data.nation(tie[1]);
        rd.appendChild(el("div", { class: "tie" + (mine ? " mine" : "") }, [
          el("div", { class: "tie-team" + (played && tie[4] === tie[0] ? " win" : played ? " lose" : "") }, [ TM.img.nationImg(hN, "tie-crest"), el("span", { text: hN.name }) ]),
          el("div", { class: "tie-score", text: played ? tie[2] + " - " + tie[3] : "vs" }),
          el("div", { class: "tie-team away" + (played && tie[4] === tie[1] ? " win" : played ? " lose" : "") }, [ el("span", { text: aN.name }), TM.img.nationImg(aN, "tie-crest") ])
        ]));
      });
      wrap.appendChild(rd);
    });
    screen.appendChild(wrap);
  }

  /* ---------- resultado da minha partida ---------- */
  TM.ui.register("player-match", function (screen, params) {
    var r = params.result, a = params.teamA, b = params.teamB, f = r.focus;
    var back = params.back || "player-hub";
    if (params.compId) TM.ui.applyCompTheme(screen, params.compId);
    screen.appendChild(TM.ui.topbar(params.title || "Partida", function () { TM.ui.go(back); }));
    var win = r.score[0] > r.score[1] ? a.name : r.score[1] > r.score[0] ? b.name : null;
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [
        el("span", { class: "rs-team", text: a.name }), el("span", { class: "rs-num", text: r.score[0] + " × " + r.score[1] }), el("span", { class: "rs-team", text: b.name })
      ]),
      el("div", { class: "result-tag", text: win ? "🏆 " + win : "🤝 Empate" })
    ]));

    // seu desempenho (ou aviso de lesão)
    if (params.sat || !f) {
      screen.appendChild(el("div", { class: "callup-banner injured", text: "🚑 Você ficou de fora por lesão nesta partida." }));
    } else {
      screen.appendChild(el("div", { class: "my-perf" }, [
        el("div", { class: "perf-item" }, [ el("div", { class: "perf-val", text: f.goals }), el("div", { class: "perf-lbl", text: "Seus gols" }) ]),
        el("div", { class: "perf-item big" }, [ el("div", { class: "perf-val rating-" + ratingClass(f.rating), text: f.rating.toFixed(1) }), el("div", { class: "perf-lbl", text: "Sua nota" }) ])
      ]));
    }

    var feed = el("div", { class: "commentary-feed static" });
    r.events.filter(function (e) { return e.type === "goal"; }).forEach(function (e) { feed.appendChild(el("div", { class: "cm-line cm-goal", text: e.text })); });
    if (feed.children.length) screen.appendChild(el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Gols da partida" }), feed ]));

    screen.appendChild(el("div", { class: "actions" }, [ TM.ui.button("Continuar", function () { TM.ui.go(back); }, "btn primary") ]));
  });
  function ratingClass(r) { return r >= 8 ? "great" : r >= 7 ? "good" : r >= 6 ? "ok" : "bad"; }

  /* ---------- tabela da liga do jogador ---------- */
  var _leagueTblCache = {};
  // tabela de uma liga: a do jogador vem ao vivo (c.table); as outras são simuladas até a mesma rodada (cacheadas)
  function tableForLeague(c, leagueId) {
    var myLeague = TM.data.club(c.clubId).leagueId;
    if (leagueId === myLeague) return standings(c.table);
    var key = leagueId + "@" + c.season + "@" + (c.round || 0);
    if (_leagueTblCache[key]) return _leagueTblCache[key];
    var lg = TM.data.league(leagueId), ids = lg.clubIds.slice();
    var single = roundRobin(ids);
    var full = single.concat(single.map(function (rd) { return rd.map(function (m) { return [m[1], m[0]]; }); }));
    var table = emptyTable(ids), settings = TM.storage.settings();
    var upto = Math.min(c.round || 0, full.length);
    for (var r = 0; r < upto; r++) full[r].forEach(function (m) {
      var res = TM.engine.simulate(TM.engine.teamFromClub(m[0]), TM.engine.teamFromClub(m[1]), { realism: settings.realism });
      applyResult(table, m[0], m[1], res.score[0], res.score[1]);
    });
    var st = standings(table);
    _leagueTblCache[key] = st;
    return st;
  }

  TM.ui.register("player-table", function (screen, params) {
    var c = TM.storage.playerCareer();
    var myLeague = TM.data.club(c.clubId).leagueId;
    var sel = (params && params.leagueId) || myLeague;
    screen.appendChild(TM.ui.topbar("📊 Classificação", function () { TM.ui.go("player-hub"); }));

    // seletor de campeonato
    var leagueSel = el("select", { class: "select" });
    TM.data.world().leagues.forEach(function (lg) {
      var o = el("option", { value: lg.id, text: lg.name + (lg.id === myLeague ? " (seu campeonato)" : "") });
      if (lg.id === sel) o.selected = true;
      leagueSel.appendChild(o);
    });
    leagueSel.addEventListener("change", function () { TM.ui.go("player-table", { leagueId: leagueSel.value }); });
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Campeonato" }), leagueSel ]) ]));

    if (sel !== myLeague) screen.appendChild(el("div", { class: "setting-hint", style: "max-width:620px", text: "Classificação simulada dos outros campeonatos (na mesma rodada do seu)." }));

    var st = tableForLeague(c, sel);
    var table = el("table", { class: "league-table" }, [
      el("thead", {}, [ el("tr", {}, ["#", "Clube", "P", "J", "SG"].map(function (h, i) { return el("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ])
    ]);
    var tb = el("tbody");
    st.forEach(function (row, i) {
      var club = TM.data.club(row.id);
      tb.appendChild(el("tr", { class: row.id === c.clubId ? "me" : "" }, [
        el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.clubImg(club, "lt-crest"), el("span", { text: club.name }) ]),
        el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
      ]));
    });
    table.appendChild(tb);
    screen.appendChild(el("div", { class: "table-wrap" }, [ table ]));
  });

  /* ---------- histórico ---------- */
  TM.ui.register("player-history", function (screen) {
    var c = TM.storage.playerCareer();
    screen.appendChild(TM.ui.topbar("🗂️ Histórico", function () { TM.ui.go("player-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    body.appendChild(el("div", { class: "career-totals", text: "Total na carreira: " + (c.careerApps + c.seasonApps) + " jogos · " + (c.careerGoals + c.seasonGoals) + " gols" }));
    if (!c.history.length) body.appendChild(el("p", { class: "intro-text", text: "Complete uma temporada para ver seu histórico." }));
    c.history.slice().reverse().forEach(function (h) {
      body.appendChild(el("div", { class: "hist-line" }, [
        el("span", { text: "Temp. " + h.season }),
        el("span", { text: TM.data.club(h.clubId).name }),
        el("span", { text: h.apps + "J · " + h.goals + "G" })
      ]));
    });
    screen.appendChild(body);
  });

  /* ---------- central de notificações do jogador ---------- */
  TM.ui.register("player-notifications", function (screen) {
    var c = TM.storage.playerCareer();
    screen.appendChild(TM.ui.topbar("🔔 Avisos", function () { TM.notify.markAllRead(c); TM.storage.savePlayerCareer(c); TM.ui.go("player-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var notes = c.notifications || [];
    if (!notes.length) body.appendChild(el("p", { class: "intro-text", text: "Nenhum aviso no momento. Jogue partidas para receber avisos." }));
    notes.forEach(function (n) {
      body.appendChild(el("div", { class: "note" + (n.read ? "" : " unread") }, [
        el("div", { class: "note-ic", text: n.icon || "•" }),
        el("div", { class: "note-body" }, [ el("div", { class: "note-title", text: n.title }), el("div", { class: "note-text", text: n.text }) ])
      ]));
    });
    TM.notify.markAllRead(c); TM.storage.savePlayerCareer(c);
  });

  /* ---------- evolução: atributos + pontos de habilidade ---------- */
  TM.ui.register("player-attrs", function (screen) {
    var c = TM.storage.playerCareer();
    screen.appendChild(TM.ui.topbar("📈 Evolução", function () { TM.ui.go("player-hub"); }));

    var head = el("div", { class: "evo-head" }, [
      el("div", {}, [ el("div", { class: "evo-ov", text: c.overall }), el("div", { class: "evo-ov-lbl", text: "Overall" }) ]),
      el("div", {}, [ el("div", { class: "evo-sp", text: c.skillPoints }), el("div", { class: "evo-ov-lbl", text: "Pontos disponíveis" }) ]),
      el("div", {}, [ el("div", { class: "evo-pot", text: c.potential || c.overall }), el("div", { class: "evo-ov-lbl", text: "Potencial" }) ])
    ]);
    screen.appendChild(head);
    screen.appendChild(el("p", { class: "intro-text", style: "max-width:620px", text: "Gaste seus pontos de habilidade nos atributos. Cada ponto sobe +1 no atributo — e, dependendo do peso na sua posição, o overall pode ou não subir." }));

    var cap = Math.min(99, (c.potential || 99) + 2);
    var ATTRS = [["pac", "Velocidade"], ["sho", "Finalização"], ["pas", "Passe"], ["dri", "Drible"], ["def", "Defesa"], ["phy", "Físico"]];
    var list = el("div", { class: "panel-narrow" });
    ATTRS.forEach(function (at) {
      var key = at[0];
      var valEl = el("span", { class: "attr-val", text: c.attrs[key] });
      var plus = el("button", { class: "attr-plus", text: "+", on: { click: function () {
        if (c.skillPoints <= 0) { TM.ui.toast("Sem pontos disponíveis"); return; }
        if (c.attrs[key] >= cap) { TM.ui.toast("Atributo no limite (" + cap + ")"); return; }
        c.attrs[key]++; c.skillPoints--;
        var before = c.overall;
        c.overall = overallFrom(c.attrs, c.pos);
        TM.storage.savePlayerCareer(c);
        if (c.overall > before) TM.ui.toast("⬆ Overall subiu para " + c.overall + "!");
        TM.ui.go("player-attrs");
      } } });
      list.appendChild(el("div", { class: "attr evo-attr" }, [
        el("span", { class: "attr-label", text: at[1] }),
        el("div", { class: "attr-bar" }, [ el("div", { class: "attr-fill", style: "width:" + c.attrs[key] + "%" }) ]),
        valEl,
        c.skillPoints > 0 && c.attrs[key] < cap ? plus : el("span", { class: "attr-plus disabled", text: "+" })
      ]));
    });
    screen.appendChild(list);
  });

  /* ---------- aposentadoria ---------- */
  TM.ui.register("player-retire", function (screen) {
    var c = TM.storage.playerCareer();
    if (!c) { TM.ui.go("player"); return; }
    screen.appendChild(TM.ui.topbar("🎽 Aposentadoria", null));
    var totalApps = c.careerApps + (c.seasonApps || 0);
    var totalGoals = c.careerGoals + (c.seasonGoals || 0);
    var clubsPlayed = {};
    (c.history || []).forEach(function (h) { clubsPlayed[h.clubId] = 1; }); clubsPlayed[c.clubId] = 1;
    screen.appendChild(el("div", { class: "result-hero" }, [
      myFace(c, "pc-face"),
      el("div", { class: "result-tag", text: c.name + " pendura as chuteiras" }),
      el("div", { class: "obj-prog", text: c.age + " anos · fim de uma bela carreira" })
    ]));
    screen.appendChild(el("div", { class: "stat-tiles" }, [
      el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: c.season }), el("div", { class: "tile-lbl", text: "Temporadas" }) ]),
      el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: totalApps }), el("div", { class: "tile-lbl", text: "Jogos" }) ]),
      el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: totalGoals }), el("div", { class: "tile-lbl", text: "Gols" }) ]),
      el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: Object.keys(clubsPlayed).length }), el("div", { class: "tile-lbl", text: "Clubes" }) ])
    ]));
    if (c.natApps) {
      screen.appendChild(el("div", { class: "panel-narrow" }, [ el("div", { class: "career-totals", text: "🌍 Pela seleção de " + c.nationName + ": " + c.natApps + " jogos · " + (c.natGoals || 0) + " gols" }) ]));
    }
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("p", { class: "intro-text", style: "text-align:center", text: "Que carreira! Obrigado por tudo, craque. 👏 E agora, qual o próximo passo?" }) ]));

    var goCoach = function () {
      var info = { name: c.name, photo: c.photo || null };
      TM.storage.clearPlayerCareer();
      if (TM.coach && TM.coach.startFromPlayer) { TM.coach.startFromPlayer(info); }
      else { TM.ui.go("coach"); }
    };
    var startCoach = function () {
      if (TM.storage.coachCareer()) {
        TM.ui.confirm("Você já tem uma Master League em andamento.", "Começar como treinador vai substituí-la. Deseja continuar?", "Substituir", function () { TM.storage.clearCoachCareer(); goCoach(); }, true);
      } else { goCoach(); }
    };
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("🎯 Virar treinador (Master League)", startCoach, "btn primary big"),
      TM.ui.button("Encerrar carreira", function () { TM.storage.clearPlayerCareer(); TM.ui.go("modes"); }, "btn ghost")
    ]));
  });
})(window);
