/* ================= TOTAL MATCH — Carreira de Treinador ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };

  function sym(c) { return c.money ? c.money.sym : "€"; }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function curVal(c, eur) { return Math.round(eur * mult(c)); }          // euro -> moeda da carreira
  function money(c, cur) { return sym(c) + " " + cur + "M"; }            // valor já na moeda da carreira

  function roundTitle(nTies) { return ({ 8: "Oitavas de final", 4: "Quartas de final", 2: "Semifinal", 1: "Final" })[nTies] || (nTies * 2 + " times"); }

  // rascunho da configuração de carreira (persiste ao abrir a lista de treinadores e voltar)
  var pendingSetup = null;
  // avatar do treinador: foto real se existir, senão iniciais em círculo colorido
  function coachAvatar(co, cls) { return TM.img.coachImg(co, cls); }

  /* ---------- entrada ---------- */
  TM.ui.register("coach", function (screen) {
    if (TM.storage.coachCareer()) { TM.ui.go("coach-hub"); return; }
    screen.appendChild(TM.ui.topbar("🎯 Master Liga", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Escolha um clube. Você disputa a liga, a copa nacional e (se classificado) a competição continental." }));

    var pickLeague = "br", pickClub = null;
    var leagueSel = el("select", { class: "select" });
    TM.data.world().leagues.forEach(function (lg) { leagueSel.appendChild(el("option", { value: lg.id, text: lg.name })); });
    leagueSel.addEventListener("change", function () { pickLeague = leagueSel.value; pickClub = null; renderClubs(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Liga" }), leagueSel ]));

    var clubGrid = el("div", { class: "club-grid" });
    body.appendChild(clubGrid);
    function renderClubs() {
      TM.ui.clear(clubGrid);
      TM.data.league(pickLeague).clubIds.map(TM.data.club).sort(function (a, b) { return TM.data.clubRating(b.id) - TM.data.clubRating(a.id); })
        .forEach(function (club) {
          var card = el("div", { class: "club-pick" + (pickClub === club.id ? " selected" : "") }, [
            TM.img.clubImg(club, "cp-crest"), el("div", { class: "cp-name", text: club.name }), TM.ui.ovBadge(TM.data.clubRating(club.id))
          ]);
          card.addEventListener("click", function () {
            pickClub = club.id; clubGrid.querySelectorAll(".club-pick").forEach(function (x) { x.classList.remove("selected"); }); card.classList.add("selected");
          });
          clubGrid.appendChild(card);
        });
    }
    renderClubs();
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Continuar →", function () {
        if (!pickClub) { TM.ui.toast("Escolha um clube"); return; }
        TM.ui.go("coach-setup", { clubId: pickClub });
      }, "btn primary big")
    ]));
  });

  /* ---------- opções pré-carreira: técnico + moeda + aporte ---------- */
  TM.ui.register("coach-setup", function (screen, params) {
    var clubId = params.clubId;
    var club = TM.data.club(clubId);
    // reusa o rascunho ao voltar da lista de treinadores; senão começa novo
    if (!pendingSetup || pendingSetup.clubId !== clubId) {
      pendingSetup = { clubId: clubId, currency: "eur", injection: 0, coachName: "", coachPhoto: null, coachId: null, coachMode: "create", nationId: null, board: "intermediaria", role: "treinador" };
    }
    var opts = pendingSetup;

    screen.appendChild(TM.ui.topbar("Opções da carreira", function () { pendingSetup = null; TM.ui.go("coach"); }));
    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [ el("div", { class: "ch-name", text: club.name }), el("div", { class: "ch-sub", text: TM.data.league(club.leagueId).name } ) ])
    ]));

    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // ---- seu treinador: criar o seu OU escolher um existente ----
    var coachArea = el("div", {});
    // criar o seu (nome + foto)
    var photoBox = el("div", { class: "photo-drop small" }, [ opts.coachPhoto ? el("img", { src: opts.coachPhoto, class: "photo-img" }) : el("span", { text: "📷 Foto" }) ]);
    var fileInput = el("input", { type: "file", accept: "image/*", style: "display:none" });
    photoBox.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement("canvas"), sc = Math.min(1, 256 / Math.max(img.width, img.height));
          cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          opts.coachPhoto = cv.toDataURL("image/jpeg", 0.82);
          TM.ui.clear(photoBox); photoBox.appendChild(el("img", { src: opts.coachPhoto, class: "photo-img" }));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    var nameInput = el("input", { class: "text-input", type: "text", placeholder: "Nome do treinador", maxlength: "24", value: opts.coachMode === "create" ? (opts.coachName || "") : "" });
    nameInput.addEventListener("input", function () { if (opts.coachMode === "create") { opts.coachName = nameInput.value; opts.coachId = null; } });
    var createBox = el("div", { class: "coach-perso", style: opts.coachMode === "create" ? "" : "display:none" }, [ photoBox, fileInput, nameInput ]);
    // escolher existente → abre a tela com todos os treinadores
    var chosen = opts.coachId ? TM.data.coaches().filter(function (c) { return c.id === opts.coachId; })[0] : null;
    var existBox = el("div", { style: opts.coachMode === "existing" ? "" : "display:none" }, [
      el("button", { class: "coach-pick-btn", on: { click: function () { TM.ui.go("coach-pick", { clubId: clubId }); } } },
        chosen ? [ coachAvatar(chosen, "cpb-ava"), el("div", { class: "cpb-info" }, [ el("div", { class: "cpb-name", text: chosen.name }), el("div", { class: "cpb-sub", text: (TM.data.coachClub(chosen.id) ? TM.data.club(TM.data.coachClub(chosen.id)).name + " · " : "") + chosen.age + " anos · tocar para trocar" }) ]), TM.data.coachClub(chosen.id) ? TM.img.clubImg(TM.data.club(TM.data.coachClub(chosen.id)), "cpb-crest") : el("span", { class: "cpb-arrow", text: "›" }) ]
               : [ el("div", { class: "cpb-info" }, [ el("div", { class: "cpb-name", text: "Ver todos os treinadores" }), el("div", { class: "cpb-sub", text: "São ~70 — escolha o seu" }) ]), el("span", { class: "cpb-arrow", text: "›" }) ])
    ]);

    var modeSeg = el("div", { class: "segmented full" });
    [["create", "Criar o meu"], ["existing", "Escolher existente"]].forEach(function (o) {
      var b = el("button", { class: "seg-btn" + (opts.coachMode === o[0] ? " active" : ""), text: o[1], on: { click: function () {
        opts.coachMode = o[0];
        modeSeg.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active");
        createBox.style.display = o[0] === "create" ? "" : "none";
        existBox.style.display = o[0] === "existing" ? "" : "none";
        if (o[0] === "create") { opts.coachName = nameInput.value; opts.coachId = null; }
        else { opts.coachName = chosen ? chosen.name : ""; opts.coachId = chosen ? chosen.id : null; }
      } } });
      modeSeg.appendChild(b);
    });
    coachArea.appendChild(modeSeg);
    coachArea.appendChild(createBox);
    coachArea.appendChild(existBox);
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Seu treinador" }), coachArea ]));

    // moeda
    var curWrap = el("div", { class: "segmented full" });
    var CUR = C().CURRENCIES;
    [["eur", "Euro €"], ["brl", "Real R$"], ["usd", "Dólar US$"], ["jpy", "Iene ¥"]].forEach(function (o) {
      var b = el("button", { class: "seg-btn" + (opts.currency === o[0] ? " active" : ""), text: o[1], on: { click: function () {
        opts.currency = o[0]; curWrap.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active"); updateInfo();
      } } });
      curWrap.appendChild(b);
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Moeda do jogo" }), curWrap ]));

    // aporte financeiro
    var injVal = el("span", { class: "range-val" });
    var injSlider = el("input", { type: "range", min: 0, max: 700, step: 10, value: opts.injection || 0, class: "slider" });
    injSlider.addEventListener("input", function () { opts.injection = parseInt(injSlider.value, 10); updateInfo(); });
    body.appendChild(el("div", { class: "setting" }, [
      el("div", { class: "setting-label" }, [ document.createTextNode("Aporte financeiro (opcional)"), injVal ]),
      injSlider,
      el("div", { class: "setting-hint", text: "Uma injeção de dinheiro no seu orçamento, até 700 milhões. A moeda afeta os valores dos jogadores nas contratações." })
    ]));

    // exigência da diretoria
    var boardWrap = el("div", { class: "segmented full" });
    var BOARD_HINTS = {
      aceitavel: "Diretoria tranquila: dá tempo para o projeto e cobra pouco. Demissão é rara.",
      intermediaria: "Diretoria equilibrada: cobra resultados, mas com bom senso.",
      rigorosa: "Diretoria rigorosa: exige vitórias e títulos. Sequências ruins geram pressão e risco de demissão."
    };
    var boardHint = el("div", { class: "setting-hint", text: BOARD_HINTS[opts.board] });
    [["aceitavel", "Aceitável"], ["intermediaria", "Intermediária"], ["rigorosa", "Rigorosa"]].forEach(function (o) {
      var b = el("button", { class: "seg-btn" + (opts.board === o[0] ? " active" : ""), text: o[1], on: { click: function () {
        opts.board = o[0]; boardWrap.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active");
        boardHint.textContent = BOARD_HINTS[o[0]];
      } } });
      boardWrap.appendChild(b);
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "🏛️ Diretoria" }), boardWrap, boardHint ]));

    // seu cargo no clube
    var roleSel = el("select", { class: "select" });
    [["treinador", "Treinador"], ["principal", "Treinador Principal"], ["diretor", "Treinador-Diretor"], ["manager", "Manager"]].forEach(function (o) {
      roleSel.appendChild(el("option", { value: o[0], text: o[1], selected: opts.role === o[0] }));
    });
    roleSel.addEventListener("change", function () { opts.role = roleSel.value; });
    body.appendChild(el("div", { class: "setting" }, [
      el("div", { class: "setting-label", text: "🧷 Seu cargo no clube" }), roleSel,
      el("div", { class: "setting-hint", text: "Define como você é tratado pela diretoria e como assina os comunicados do clube." })
    ]));

    // comandar também uma seleção
    var natWrap = el("div", { class: "setting" });
    var natToggle = el("button", { class: "switch" + (opts.nationId ? " on" : ""), on: { click: function () {
      if (opts.nationId) { opts.nationId = null; } else { opts.nationId = natSel.value; }
      natToggle.classList.toggle("on", !!opts.nationId); natSel.style.display = opts.nationId ? "block" : "none";
    } } }, [ el("span", { class: "switch-knob" }) ]);
    var natSel = el("select", { class: "select", style: (opts.nationId ? "" : "display:none;") + "margin-top:8px" });
    TM.data.world().nations.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (n) { natSel.appendChild(el("option", { value: n.id, text: n.name, selected: n.id === opts.nationId })); });
    natSel.addEventListener("change", function () { if (opts.nationId) opts.nationId = natSel.value; });
    natWrap.appendChild(el("div", { class: "setting row" }, [ el("div", { class: "setting-label", text: "🌍 Comandar também uma seleção" }), natToggle ]));
    natWrap.appendChild(natSel);
    natWrap.appendChild(el("div", { class: "setting-hint", text: "Você comanda o clube E a seleção ao mesmo tempo, alternando entre eles. Precisa fazer a convocação dentro do prazo, ou é demitido da seleção." }));
    body.appendChild(natWrap);

    var summary = el("div", { class: "market-budget" });
    body.appendChild(summary);
    function updateInfo() {
      var m = CUR[opts.currency];
      injVal.textContent = m.sym + " " + opts.injection + "M";
      var baseEur = 30 + Math.round(TM.data.clubRating(clubId) / 3);
      var total = Math.round(baseEur * m.mult) + opts.injection;
      summary.textContent = "💰 Orçamento inicial: " + m.sym + " " + total + "M";
    }
    updateInfo();

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Começar carreira", function () {
        if (opts.coachMode === "existing" && !opts.coachName) { TM.ui.toast("Escolha um treinador da lista"); return; }
        TM.storage.saveCoachCareer(C().newClubCareer(clubId, opts));
        pendingSetup = null;
        TM.ui.go("coach-hub");
      }, "btn primary big")
    ]));
  });

  /* ---------- lista de treinadores (escolher existente) ---------- */
  TM.ui.register("coach-pick", function (screen, params) {
    var clubId = params.clubId;
    if (!pendingSetup || pendingSetup.clubId !== clubId) pendingSetup = { clubId: clubId, currency: "eur", injection: 0, coachName: "", coachPhoto: null, coachId: null, coachMode: "existing", nationId: null, board: "intermediaria", role: "treinador" };
    screen.appendChild(TM.ui.topbar("Escolha o treinador", function () { TM.ui.go("coach-setup", { clubId: clubId }); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var search = el("input", { class: "text-input", type: "text", placeholder: "🔎 Buscar treinador…" });
    body.appendChild(search);
    var grid = el("div", { class: "coach-grid" });
    body.appendChild(grid);
    var coaches = TM.data.coaches().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    function render(q) {
      TM.ui.clear(grid);
      coaches.filter(function (co) { return !q || co.name.toLowerCase().indexOf(q) >= 0; }).forEach(function (co) {
        var coClubId = TM.data.coachClub(co.id);
        var avaWrap = el("div", { class: "cc-ava-wrap" }, [ coachAvatar(co, "cc-ava") ]);
        if (coClubId) avaWrap.appendChild(TM.img.clubImg(TM.data.club(coClubId), "cc-club-crest"));
        var card = el("div", { class: "coach-card" + (pendingSetup.coachId === co.id ? " selected" : ""), on: { click: function () {
          pendingSetup.coachId = co.id; pendingSetup.coachName = co.name; pendingSetup.coachMode = "existing"; pendingSetup.coachPhoto = null;
          TM.ui.go("coach-setup", { clubId: clubId });
        } } }, [
          avaWrap,
          el("div", { class: "cc-name", text: co.name }),
          el("div", { class: "cc-age", text: (coClubId ? TM.data.club(coClubId).name + " · " : "") + co.age + " anos" })
        ]);
        grid.appendChild(card);
      });
    }
    search.addEventListener("input", function () { render(search.value.trim().toLowerCase()); });
    render("");
  });

  /* ---------- hub ---------- */
  TM.ui.register("coach-hub", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    C().migrateCareer(c);
    C().processCalendar(c); // janelas de transferência + mercado da IA + notificações
    TM.storage.saveCoachCareer(c);
    // se a temporada acabou e há título não comemorado, mostra a tela de parabéns primeiro
    var pnd = C().advanceToUserMatch(c);
    if (pnd.seasonEnd && pendingTitles(c).length) { TM.ui.go("coach-title"); return; }
    var club = TM.data.club(c.teamId);
    var unread = TM.notify.unread(c);
    var bell = el("button", { class: "tb-bell", on: { click: function () { TM.ui.go("coach-notifications"); } } }, [
      el("span", { text: "🔔" }), unread ? el("span", { class: "bell-badge", text: unread > 9 ? "9+" : unread }) : null
    ]);
    var dots = el("button", { class: "tb-menu", text: "⋯", on: { click: function () {
      TM.ui.optionsMenu("Opções da carreira", [
        { label: "💾 Salvar (continuar jogando)", fn: function () { TM.storage.saveCoachCareer(c); TM.ui.toast("✔ Carreira salva"); } },
        { label: "📤 Salvar e sair", fn: function () { TM.saves.park("coach"); TM.ui.toast("Carreira guardada em Minhas Carreiras"); TM.ui.go("modes"); } },
        { label: "🏠 Voltar ao menu (sem sair)", fn: function () { TM.ui.go("modes"); } },
        { label: "🗑️ Finalizar carreira", danger: true, fn: function () {
          TM.ui.confirm("Finalizar esta carreira?", "O progresso será apagado permanentemente.", "Finalizar", function () { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }, true);
        } }
      ]);
    } } });
    var right = el("div", { class: "tb-actions" }, [ bell, dots ]);
    screen.appendChild(TM.ui.topbar("Carreira", function () { TM.ui.go("modes"); }, right));

    var myCoach = c.coachId ? TM.data.coaches().filter(function (x) { return x.id === c.coachId; })[0] : null;
    var coachFace = c.coachPhoto ? el("img", { src: c.coachPhoto, class: "coach-mini" })
      : myCoach ? TM.img.coachImg(myCoach, "coach-mini")
      : el("div", { class: "coach-mini placeholder", text: "👔" });
    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [
        el("div", { class: "ch-name", text: club.name }),
        el("div", { class: "ch-sub", text: TM.data.league(c.leagueId).name + " · Temporada " + c.season }),
        el("div", { class: "ch-budget", text: "💰 Orçamento: " + money(c, c.budget) })
      ]),
      el("div", { class: "coach-tag" }, [ coachFace, el("div", { class: "coach-tag-name", text: c.coachName || "Treinador" }) ])
    ]));

    // seleção: verifica prazo e mostra botão de trocar
    C().checkNationDeadlines(c); TM.storage.saveCoachCareer(c);
    if (c.nation) {
      var np = C().nationPending(c);
      var natNat = TM.data.nation(c.nation.id);
      var nsSub = np.needConvoke ? (np.wc ? "⚠ Convocação da Copa pendente!" : "⚠ Convocação pendente!")
        : np.readyMatch ? (np.wc ? "🏆 Jogo da Copa do Mundo!" : "⚽ Amistoso disponível!")
        : (c.nation.wc ? "🏆 Copa do Mundo →" : "Comandar seleção →");
      screen.appendChild(el("button", { class: "nation-switch" + (np.needConvoke || np.readyMatch ? " alert" : ""), on: { click: function () { TM.ui.go("coach-nation"); } } }, [
        TM.img.nationImg(natNat, "ns-flag"),
        el("div", { class: "ns-info" }, [ el("div", { class: "ns-name", text: "Seleção de " + c.nation.name }),
          el("div", { class: "ns-sub", text: nsSub }) ]),
        el("span", { class: "ns-arrow", text: "🔄" })
      ]));
    }

    // meta da diretoria
    var pos = C().currentPosition(c);
    screen.appendChild(el("div", { class: "objective" }, [
      el("span", { class: "obj-ic", text: "🎯" }),
      el("div", {}, [
        el("div", { class: "obj-desc", text: "Meta: " + c.objective.desc }),
        el("div", { class: "obj-prog", text: "Posição atual: " + pos + "º" + (pos <= c.objective.maxPos ? " ✓ (dentro da meta)" : " ⚠ (abaixo da meta)") })
      ])
    ]));

    var pending = C().advanceToUserMatch(c);
    if (pending.seasonEnd) {
      renderSeasonEnd(screen, c);
    } else {
      var nextDay = C().matchDay(c.matchNo), daysLeft = nextDay - c.currentDay;
      // barra de data / calendário
      screen.appendChild(el("div", { class: "date-bar" }, [
        el("div", { class: "date-now" }, [ el("span", { class: "date-ic", text: "📅" }), el("span", { text: C().dateOf(c, c.currentDay).full }) ]),
        el("button", { class: "date-cal-btn", text: "Calendário →", on: { click: function () { TM.ui.go("coach-calendar"); } } })
      ]));

      var compId = compIdFor(c, pending.key);
      var homeClub = TM.data.club(pending.homeId), awayClub = TM.data.club(pending.awayId);
      var badgeText = pending.label ? pending.label : (pending.ko ? "Mata-mata" : "Liga");
      var matchDate = C().dateOf(c, nextDay);
      var kids = [
        el("div", { class: "nm-date", text: "🗓️ " + matchDate.full + (daysLeft > 0 ? " · faltam " + daysLeft + " dia(s)" : " · é hoje!") }),
        el("div", { class: "nm-teams" }, [ el("span", { text: homeClub.name }), el("span", { class: "nm-x", text: "×" }), el("span", { text: awayClub.name }) ])
      ];
      if (daysLeft > 0) {
        kids.push(el("div", { class: "skip-row" }, [
          TM.ui.button("⏭ Pular 1 dia", function () { c.currentDay++; TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }, "btn ghost small"),
          TM.ui.button("⏩ Avançar até o jogo", function () { c.currentDay = nextDay; TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }, "btn small")
        ]));
      } else {
        if (c.pressDoneFor !== c.matchNo) {
          kids.push(TM.ui.button("🎤 Coletiva de imprensa", function () { TM.ui.go("coach-press"); }, "btn ghost"));
        } else {
          kids.push(el("div", { class: "press-done", text: "🎤 Coletiva realizada" + (c.pressEdge > 0 ? " — elenco confiante" : c.pressEdge < 0 ? " — clima tenso" : "") }));
        }
        kids.push(TM.ui.button("▶ Jogar", function () { TM.ui.go("coach-play"); }, "btn primary"));
      }
      var card = el("div", { class: "next-match" }, kids);
      TM.ui.applyCompTheme(card, compId);
      var banner = TM.ui.compBanner(compId, badgeText);
      if (banner) card.insertBefore(banner, card.firstChild);
      screen.appendChild(card);
    }

    screen.appendChild(el("div", { class: "hub-actions six" }, [
      hubBtn("👥", "Elenco", function () { TM.ui.go("coach-squad"); }),
      hubBtn("📋", "Escalação", function () { TM.ui.go("coach-lineup"); }),
      hubBtn("🌱", "Base", function () { TM.ui.go("coach-youth"); }),
      hubBtn("🏆", "Competições", function () { TM.ui.go("coach-comps"); }),
      hubBtn("🔁", "Mercado", function () { TM.ui.go("coach-market"); }),
      hubBtn("⭐", "Central", function () { TM.ui.go("coach-shortlist"); }),
      hubBtn("📅", "Calendário", function () { TM.ui.go("coach-calendar"); }),
      hubBtn("🗂️", "Títulos", function () { TM.ui.go("coach-honours"); })
    ]));
    function hubBtn(icon, label, fn) { return el("button", { class: "hub-btn", on: { click: fn } }, [ el("span", { class: "hub-ic", text: icon }), el("span", { text: label }) ]); }
  });

  /* ---------- títulos: prêmio em dinheiro + tela de parabéns ---------- */
  var TITLE_PRIZE_EUR = { league: 30, cup: 15, mundial: 60, inter: 25, "cont-sa": 50, "cont-eu": 70, "cont-na": 20, "cont-as": 25 };
  function pendingTitles(c) {
    var shown = c.titlesShown || {}, out = [];
    function add(id, name, prize, compId) { if (!shown[c.season + "-" + id]) out.push({ id: id, name: name, prize: prize, compId: compId }); }
    var st = C().standings(c.comps.league.table);
    if (st[0] && st[0].id === c.teamId) add("league", c.comps.league.name, TITLE_PRIZE_EUR.league, "lg-" + c.leagueId);
    if (c.comps.cup && c.comps.cup.championId === c.teamId) add("cup", c.comps.cup.name, TITLE_PRIZE_EUR.cup, "cup-" + c.leagueId);
    if (c.comps.cont && c.comps.cont.tour && c.comps.cont.tour.championId === c.teamId) { var reg = C().REGION[c.leagueId] || "eu"; add("cont", c.comps.cont.name, TITLE_PRIZE_EUR["cont-" + reg] || 40, "cont-" + reg); }
    if (c.comps.mundial && c.comps.mundial.championId === c.teamId) add("mundial", "Mundial de Clubes", TITLE_PRIZE_EUR.mundial, "cwc-world");
    if (c.interChampion && c.interChampion === c.teamId) add("inter", "Copa Intercontinental", TITLE_PRIZE_EUR.inter, "cwc-inter");
    return out;
  }
  TM.ui.register("coach-title", function (screen) {
    var c = TM.storage.coachCareer();
    var pend = pendingTitles(c);
    if (!pend.length) { TM.ui.go("coach-hub"); return; }
    var t = pend[0];
    c.titlesShown = c.titlesShown || {}; c.titlesShown[c.season + "-" + t.id] = true;
    var prizeCur = Math.round(t.prize * (c.money ? c.money.mult : 1));
    c.budget += prizeCur;
    TM.storage.saveCoachCareer(c);
    TM.ui.applyCompTheme(screen, t.compId);
    screen.appendChild(el("div", { class: "title-celebrate" }, [
      el("div", { class: "tc-trophy", text: "🏆" }),
      TM.img.compImg(t.compId, "tc-logo"),
      el("div", { class: "tc-congrats", text: "PARABÉNS!" }),
      el("div", { class: "tc-name", text: "Campeão da " + t.name + "!" }),
      el("div", { class: "tc-prize", text: "💰 Prêmio: +" + money(c, prizeCur) + " no orçamento" }),
      TM.ui.button(pend.length > 1 ? "Próximo título →" : "Continuar", function () { TM.ui.go("coach-title"); }, "btn primary big")
    ]));
  });

  function renderSeasonEnd(screen, c) {
    var st = C().standings(c.comps.league.table);
    var pos = st.findIndex(function (r) { return r.id === c.teamId; }) + 1;
    var ev = C().evaluateObjective(c);
    var titles = [];
    if (st[0].id === c.teamId) titles.push("🏆 Campeão da " + c.comps.league.name);
    if (c.comps.cup && c.comps.cup.championId === c.teamId) titles.push("🏆 Campeão da " + c.comps.cup.name);
    if (c.comps.cont && c.comps.cont.tour && c.comps.cont.tour.championId === c.teamId) titles.push("🏆 Campeão da " + c.comps.cont.name);

    var box = el("div", { class: "next-match season-end" }, [
      el("div", { class: "nm-label", text: "🏁 Fim da temporada " + c.season }),
      el("div", { class: "nm-teams", text: pos + "º na liga" })
    ]);
    titles.forEach(function (t) { box.appendChild(el("div", { class: "obj-desc", text: t })); });

    if (ev.met) {
      box.appendChild(el("div", { class: "obj-result good", text: "✔ Meta cumprida: " + c.objective.desc }));
      box.appendChild(TM.ui.button("Iniciar próxima temporada", function () { C().newSeason(c); TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }, "btn primary"));
      screen.appendChild(box);
    } else {
      box.appendChild(el("div", { class: "obj-result bad", text: "✖ Meta NÃO cumprida (" + c.objective.desc + ")" }));
      box.classList.add("fired");
      box.appendChild(el("div", { class: "fired-msg", text: "🚪 A diretoria decidiu te demitir por não atingir os objetivos da temporada." }));
      box.appendChild(TM.ui.button("Encerrar carreira", function () { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }, "btn primary"));
      screen.appendChild(box);
    }
  }

  /* ---------- aba Calendário (grade estilo mês) ---------- */
  var MES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var MES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  var WD_PT = ["D", "S", "T", "Q", "Q", "S", "S"];
  function abbr3(name) { return (name || "").replace(/[^A-Za-zÀ-ÿ ]/g, "").trim().slice(0, 3).toUpperCase(); }
  TM.ui.register("coach-calendar", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("📅 Calendário", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow cal-wrap" });
    screen.appendChild(body);

    // barra de status da janela de transferências
    var win = C().currentWindow(c);
    var statusBar;
    if (win) {
      statusBar = el("div", { class: "twin-bar open" }, [ el("span", { text: "🟢 " + win.name + " ABERTA" }), el("span", { class: "twin-sub", text: "fecha em " + C().dateOf(c, win.closeDay).full }) ]);
    } else {
      var nxt = C().nextWindowOpenDay(c);
      statusBar = el("div", { class: "twin-bar closed" }, [ el("span", { text: "🔴 Janela fechada" }), el("span", { class: "twin-sub", text: nxt != null ? "próxima abre em " + C().dateOf(c, nxt).full : "sem janelas restantes" }) ]);
    }
    body.appendChild(statusBar);
    body.appendChild(el("div", { class: "date-now", style: "margin:2px 0 6px" }, [ el("span", { class: "date-ic", text: "📅" }), el("span", { text: "Hoje: " + C().dateOf(c, c.currentDay).full }) ]));

    // dados: jogos futuros + marcadores de janela
    var upcoming = C().peekSchedule(c, 60);
    var matchByOff = {}; upcoming.forEach(function (it) { matchByOff[it.day] = it; });
    var winOpenOff = {}, winCloseOff = {};
    (c.windows || []).forEach(function (w) { winOpenOff[w.openDay] = w.name; winCloseOff[w.closeDay] = w.name; });

    // alcance de meses a exibir: do mês atual até o último evento
    var endOff = c.currentDay;
    upcoming.forEach(function (it) { endOff = Math.max(endOff, it.day); });
    (c.windows || []).forEach(function (w) { endOff = Math.max(endOff, w.closeDay); });
    endOff += 2;
    var offMap = {}; // "y-m-d" -> offset (temporada começa em 10/ago)
    for (var o = 0; o <= endOff; o++) { var dt = C().dateOf(c, o); offMap[dt.y + "-" + dt.m + "-" + dt.d] = o; }

    var start = C().dateOf(c, c.currentDay), last = C().dateOf(c, endOff);
    var todayOff = c.currentDay;
    var ym = start.y * 12 + (start.m - 1), ymEnd = last.y * 12 + (last.m - 1), guard = 0;
    while (ym <= ymEnd && guard++ < 14) {
      var year = Math.floor(ym / 12), month = (ym % 12) + 1; ym++;
      var daysIn = new Date(year, month, 0).getDate();
      var firstWd = new Date(year, month - 1, 1).getDay();
      var monthCard = el("div", { class: "cal-month" });
      monthCard.appendChild(el("div", { class: "cal-mtitle", text: MES_FULL[month - 1] + " " + year }));
      var grid = el("div", { class: "cal-grid" });
      WD_PT.forEach(function (w) { grid.appendChild(el("div", { class: "cal-wd", text: w })); });
      for (var b = 0; b < firstWd; b++) grid.appendChild(el("div", { class: "cal-cell empty" }));
      for (var d = 1; d <= daysIn; d++) {
        var off = offMap[year + "-" + month + "-" + d];
        var cellCls = "cal-cell";
        var kids = [ el("div", { class: "cal-cell-d", text: d }) ];
        var titleAttr = d + "/" + month;
        if (off === todayOff) cellCls += " today";
        var mt = off != null ? matchByOff[off] : null;
        if (mt) {
          if (mt.tbd) {
            cellCls += " has-match cup";
            kids.push(el("div", { class: "cal-cell-ev", text: "🏆" }));
            titleAttr += " · " + mt.name;
          } else {
            var meHome = mt.homeId === c.teamId;
            var opp = TM.data.club(meHome ? mt.awayId : mt.homeId);
            cellCls += " has-match " + (mt.key === "cup" ? "cup" : mt.key === "cont" ? "cont" : "league");
            kids.push(el("div", { class: "cal-cell-ev", text: abbr3(opp.name) }));
            kids.push(el("div", { class: "cal-cell-loc", text: meHome ? "casa" : "fora" }));
            titleAttr += " · " + (meHome ? "vs " : "@ ") + opp.name + " (" + mt.name + ")";
          }
        }
        if (off != null && winOpenOff[off] != null) { cellCls += " win-open"; kids.push(el("div", { class: "cal-cell-win open", text: "🟢 abre" })); titleAttr += " · " + winOpenOff[off] + " abre"; }
        if (off != null && winCloseOff[off] != null) { cellCls += " win-close"; kids.push(el("div", { class: "cal-cell-win close", text: "🔴 fecha" })); titleAttr += " · " + winCloseOff[off] + " fecha"; }
        grid.appendChild(el("div", { class: cellCls, title: titleAttr }, kids));
      }
      monthCard.appendChild(grid);
      body.appendChild(monthCard);
    }

    // legenda
    body.appendChild(el("div", { class: "cal-legend" }, [
      el("span", { class: "leg league", text: "● Liga" }),
      el("span", { class: "leg cup", text: "● Copa" }),
      el("span", { class: "leg cont", text: "● Continental" }),
      el("span", { text: "🟢 janela abre" }),
      el("span", { text: "🔴 janela fecha" }),
      el("span", { class: "leg today", text: "▢ hoje" })
    ]));
  });

  /* ================= SELEÇÃO (junto com o clube) ================= */
  TM.ui.register("coach-nation", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.nation) { TM.ui.go("coach-hub"); return; }
    C().checkNationDeadlines(c); TM.storage.saveCoachCareer(c);
    if (!c.nation) { TM.ui.toast("Você foi demitido da seleção."); TM.ui.go("coach-hub"); return; }
    var nat = TM.data.nation(c.nation.id);
    var isWC = !!c.nation.wc;
    screen.appendChild(TM.ui.topbar(isWC ? "🏆 Seleção · Copa do Mundo" : "🌍 Seleção", function () { TM.ui.go("coach-hub"); }));

    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.nationImg(nat, "ch-crest"),
      el("div", {}, [ el("div", { class: "ch-name", text: "Seleção de " + c.nation.name }), el("div", { class: "ch-sub", text: "Convocados: " + c.nation.squad.length + (isWC ? " · Copa do Mundo " + c.seasonYear : " · Amistosos internacionais") }) ]),
      el("button", { class: "date-cal-btn", text: "🔄 Voltar ao clube", on: { click: function () { TM.ui.go("coach-hub"); } } })
    ]));
    screen.appendChild(el("div", { class: "date-bar" }, [ el("div", { class: "date-now" }, [ el("span", { class: "date-ic", text: "📅" }), el("span", { text: "Hoje: " + C().dateOf(c, c.currentDay).full }) ]) ]));

    if (isWC) { renderWorldCupPanel(screen, c); return; }

    var w = C().nationNextWindow(c);
    if (!w) {
      screen.appendChild(el("div", { class: "next-match" }, [ el("div", { class: "nm-label", text: "Sem amistosos restantes nesta temporada." }) ]));
    } else {
      var opp = TM.data.nation(w.oppId), open = c.currentDay >= w.openDay;
      var fdate = C().dateOf(c, w.friendlyDay), ddate = C().dateOf(c, w.deadlineDay);
      if (!open) {
        screen.appendChild(el("div", { class: "next-match" }, [
          el("div", { class: "nm-label", text: "🔒 Janela de seleção fechada" }),
          el("div", { class: "nm-date", text: "A convocação abre em " + (w.openDay - c.currentDay) + " dia(s) (" + C().dateOf(c, w.openDay).full + ")." }),
          el("p", { class: "intro-text", style: "text-align:center", text: "Volte perto do amistoso para convocar e escalar." })
        ]));
      } else {
        var kids = [
          el("div", { class: "nm-label", text: "🤝 Amistoso Internacional" }),
          el("div", { class: "nm-teams" }, [ el("span", { text: c.nation.name }), el("span", { class: "nm-x", text: "×" }), el("span", { text: opp.name }) ]),
          el("div", { class: "nm-date", text: "🗓️ " + fdate.full })
        ];
        if (!w.convoked) {
          kids.push(el("div", { class: "nm-date", style: "color:#e8a13c", text: "⚠ Convoque até " + ddate.full + " · faltam " + (w.deadlineDay - c.currentDay) + " dia(s), ou é demitido!" }));
          kids.push(el("div", { class: "skip-row" }, [
            TM.ui.button("🔍 Convocar/Scout", function () { TM.ui.go("coach-nation-scout"); }, "btn small"),
            TM.ui.button("✔ Confirmar convocação", function () {
              if (c.nation.squad.length < 11) { TM.ui.toast("Convoque pelo menos 11 jogadores"); return; }
              w.convoked = true; TM.storage.saveCoachCareer(c);
              TM.notify.push(c, { icon: "📋", title: "Convocação enviada", text: "Convocação de " + c.nation.name + " confirmada para o amistoso contra " + opp.name + "." });
              TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation");
            }, "btn primary small")
          ]));
        } else if (c.currentDay >= w.friendlyDay) {
          kids.push(el("div", { class: "nm-date", text: "✔ Convocação confirmada — é dia de jogo!" }));
          kids.push(TM.ui.button("▶ Jogar amistoso", function () { TM.ui.go("coach-nation-play"); }, "btn primary"));
        } else {
          kids.push(el("div", { class: "nm-date", text: "✔ Convocação confirmada. Amistoso em " + (w.friendlyDay - c.currentDay) + " dia(s)." }));
          kids.push(el("p", { class: "intro-text", style: "text-align:center", text: "Avance os dias no clube até a data do amistoso." }));
        }
        screen.appendChild(el("div", { class: "next-match" }, kids));
      }
    }

    screen.appendChild(el("div", { class: "hub-actions" }, [
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-scout"); } } }, [ el("span", { class: "hub-ic", text: "🔍" }), el("span", { text: "Scout / Convocar" }) ]),
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-lineup"); } } }, [ el("span", { class: "hub-ic", text: "📋" }), el("span", { text: "Escalação" }) ])
    ]));
  });

  /* ---------- painel da Copa do Mundo ---------- */
  function renderWorldCupPanel(screen, c) {
    var wc = c.nation.wc;
    var m = C().advanceWorldCup(c); // próxima partida do usuário (auto-sima jogos alheios)
    TM.storage.saveCoachCareer(c);

    if (!wc.convoked) {
      var kids;
      if (c.currentDay < wc.openDay) {
        kids = [
          el("div", { class: "nm-label", text: "🔒 Convocação da Copa fechada" }),
          el("div", { class: "nm-date", text: "Abre em " + (wc.openDay - c.currentDay) + " dia(s) (" + C().dateOf(c, wc.openDay).full + ")." }),
          el("p", { class: "intro-text", style: "text-align:center", text: "Volte perto da abertura para convocar seus 23 e escalar o time." })
        ];
      } else {
        kids = [
          el("div", { class: "nm-label", text: "🏆 Copa do Mundo " + c.seasonYear },),
          el("div", { class: "nm-date", style: "color:#e8a13c", text: "⚠ Convoque até " + C().dateOf(c, wc.deadlineDay).full + " · faltam " + (wc.deadlineDay - c.currentDay) + " dia(s), ou é demitido!" }),
          el("div", { class: "skip-row" }, [
            TM.ui.button("🔍 Convocar/Scout", function () { TM.ui.go("coach-nation-scout"); }, "btn small"),
            TM.ui.button("✔ Confirmar convocação", function () {
              if (c.nation.squad.length < 11) { TM.ui.toast("Convoque pelo menos 11 jogadores"); return; }
              wc.convoked = true;
              TM.notify.push(c, { icon: "🏆", title: "Convocação da Copa", text: "Convocação de " + c.nation.name + " confirmada para a Copa do Mundo!" });
              TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation");
            }, "btn primary small")
          ])
        ];
      }
      screen.appendChild(el("div", { class: "next-match" }, kids));
    } else if (m.end) {
      // Copa encerrada para a seleção
      var champId = m.championId || wc.tour.championId;
      var champName = champId ? TM.data.nation(champId).name : "—";
      var won = champId === c.nation.id;
      screen.appendChild(el("div", { class: "next-match" }, [
        el("div", { class: "nm-label", text: won ? "🏆 CAMPEÃO DO MUNDO!" : "Copa do Mundo encerrada" }),
        el("div", { class: "nm-teams" }, [ el("span", { text: "Campeão: " + champName }) ]),
        el("p", { class: "intro-text", style: "text-align:center", text: won ? "Você levantou a taça com " + c.nation.name + "! Que campanha." : "Sua seleção não foi campeã desta vez. Próxima Copa em 4 anos." })
      ]));
    } else {
      // há uma partida do usuário na Copa
      var md = wc.matchDays[wc.wcMatchNo];
      var homeNat = TM.data.nation(m.homeId), awayNat = TM.data.nation(m.awayId);
      var label = C().wcRoundLabel(c, m);
      var wkids = [
        el("div", { class: "nm-label", text: "🏆 " + label },),
        el("div", { class: "nm-teams" }, [ el("span", { text: homeNat.name }), el("span", { class: "nm-x", text: "×" }), el("span", { text: awayNat.name }) ]),
        el("div", { class: "nm-date", text: "🗓️ " + C().dateOf(c, md).full })
      ];
      if (c.currentDay >= md) {
        wkids.push(TM.ui.button("▶ Jogar", function () { TM.ui.go("coach-nation-wc-play"); }, "btn primary"));
      } else {
        wkids.push(el("div", { class: "nm-date", text: "Faltam " + (md - c.currentDay) + " dia(s)." }));
        wkids.push(el("p", { class: "intro-text", style: "text-align:center", text: "Avance os dias no clube até a data do jogo." }));
      }
      screen.appendChild(el("div", { class: "next-match" }, wkids));
    }

    screen.appendChild(el("div", { class: "hub-actions" }, [
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-wc-view"); } } }, [ el("span", { class: "hub-ic", text: "📊" }), el("span", { text: "Grupos & Chaveamento" }) ]),
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-scout"); } } }, [ el("span", { class: "hub-ic", text: "🔍" }), el("span", { text: "Convocar" }) ]),
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-lineup"); } } }, [ el("span", { class: "hub-ic", text: "📋" }), el("span", { text: "Escalação" }) ])
    ]));
  }

  /* ---------- jogo da Copa do Mundo ---------- */
  TM.ui.register("coach-nation-wc-play", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.nation || !c.nation.wc || !c.nation.wc.convoked) { TM.ui.go("coach-nation"); return; }
    var wc = c.nation.wc;
    var m = C().advanceWorldCup(c);
    if (m.end) { TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation"); return; }
    var md = wc.matchDays[wc.wcMatchNo];
    if (c.currentDay < md) { TM.ui.go("coach-nation"); return; }
    var userHome = m.homeId === c.nation.id;
    var teamA = userHome ? C().nationTeam(c) : C().oppNationTeam(m.homeId);
    var teamB = userHome ? C().oppNationTeam(m.awayId) : C().nationTeam(c);
    var userSide = userHome ? 0 : 1;
    var simOpts = { realism: TM.storage.settings().realism, neutral: true, tacticSide: userSide, tactic: c.nation.tactic };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    var label = C().wcRoundLabel(c, m);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: "Copa do Mundo · " + label, pauseSide: userSide, simOpts: simOpts, formation: c.nation.lineup && c.nation.lineup.formation,
      onBack: function () { TM.ui.go("coach-nation"); },
      onDone: function () {
        C().applyWorldCupResult(c, result.score[0], result.score[1]);
        var us = userHome ? result.score[0] : result.score[1], them = userHome ? result.score[1] : result.score[0];
        var res = us > them ? "Vitória" : us < them ? "Derrota" : "Empate";
        TM.notify.push(c, { icon: "🏆", title: "Copa do Mundo · " + label, text: res + " " + us + "x" + them + " de " + c.nation.name + "." });
        TM.storage.saveCoachCareer(c);
        TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result, ko: m.phase === "ko", back: "coach-nation" });
      }
    });
  });

  /* ---------- grupos & chaveamento da Copa ---------- */
  TM.ui.register("coach-nation-wc-view", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.nation || !c.nation.wc) { TM.ui.go("coach-nation"); return; }
    var t = c.nation.wc.tour;
    screen.appendChild(TM.ui.topbar("🏆 Copa do Mundo " + c.seasonYear, function () { TM.ui.go("coach-nation"); }));
    if (t.championId) screen.appendChild(el("div", { class: "champion-banner", text: "🏆 Campeão: " + TM.data.nation(t.championId).name }));
    if (t.phase === "group") {
      renderWCGroups(screen, c, t);
    } else {
      renderWCGroups(screen, c, t);
      renderWCBracket(screen, c, t.ko);
    }
  });

  function renderWCGroups(screen, c, t) {
    var wrap = el("div", { class: "panel-narrow" });
    t.groups.forEach(function (g, gi) {
      wrap.appendChild(el("div", { class: "group-title", text: "Grupo " + String.fromCharCode(65 + gi) }));
      var st = C().standings(g.table), tb = el("tbody");
      st.forEach(function (row, i) {
        var n = TM.data.nation(row.id);
        tb.appendChild(el("tr", { class: (row.id === c.nation.id ? "me " : "") + (i < 2 ? "qualify" : "") }, [
          el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.nationImg(n, "lt-crest"), el("span", { text: n.name }) ]),
          el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
        ]));
      });
      wrap.appendChild(el("div", { class: "table-wrap" }, [ el("table", { class: "league-table" }, [ el("thead", {}, [ el("tr", {}, ["#", "Seleção", "P", "J", "SG"].map(function (h, i) { return el("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]), tb ]) ]));
    });
    screen.appendChild(wrap);
  }

  function renderWCBracket(screen, c, ko) {
    var wrap = el("div", { class: "bracket" });
    ko.rounds.forEach(function (round) {
      if (!round) return;
      var rd = el("div", { class: "bracket-round" }, [ el("div", { class: "br-round-title", text: TM.tournament.koTitle(round.length * 2) }) ]);
      round.forEach(function (tie) {
        var mine = tie[0] === c.nation.id || tie[1] === c.nation.id;
        var played = tie[4] != null;
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

  /* ---------- scout / convocação ---------- */
  TM.ui.register("coach-nation-scout", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.nation) { TM.ui.go("coach-hub"); return; }
    var nat = TM.data.nation(c.nation.id);
    screen.appendChild(TM.ui.topbar("🔍 Scout · " + c.nation.name, function () { TM.ui.go("coach-nation"); }));
    screen.appendChild(el("div", { class: "market-budget", text: "Convocados: " + c.nation.squad.length + " / 23" }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Jogadores de " + c.nation.name + ". Toque para convocar/remover (máx. 23)." }));

    var squadSet = {}; c.nation.squad.forEach(function (id) { squadSet[id] = true; });
    var pool = nat.players.map(TM.data.player).filter(Boolean).sort(function (a, b) { return b.overall - a.overall; });
    pool.forEach(function (p) {
      var inSquad = squadSet[p.id];
      var row = TM.ui.playerRow(p, {});
      row.classList.add("clickable");
      if (inSquad) row.classList.add("convoked-row");
      row.appendChild(el("button", { class: "buy-btn" + (inSquad ? " ghost-btn" : ""), text: inSquad ? "Remover" : "Convocar", on: { click: function (e) {
        e.stopPropagation();
        if (inSquad) { c.nation.squad = c.nation.squad.filter(function (id) { return id !== p.id; }); }
        else { if (c.nation.squad.length >= 23) { TM.ui.toast("Máximo de 23 convocados"); return; } c.nation.squad.push(p.id); }
        c.nation.lineup = C().buildLineup(c.nation.squad.map(TM.data.player), c.nation.lineup.formation);
        TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation-scout");
      } } }));
      body.appendChild(row);
    });
  });

  /* ---------- campinho da seleção ---------- */
  var natPick = null;
  TM.ui.register("coach-nation-lineup", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.nation) { TM.ui.go("coach-hub"); return; }
    var lu = c.nation.lineup;
    screen.appendChild(TM.ui.topbar("📋 Escalação · " + c.nation.name, function () { natPick = null; TM.ui.go("coach-nation"); }));

    var formRow = el("div", { class: "segmented full" });
    Object.keys(C().FORMATIONS).forEach(function (f) {
      formRow.appendChild(el("button", { class: "seg-btn" + (lu.formation === f ? " active" : ""), text: f, on: { click: function () {
        c.nation.lineup = C().buildLineup(c.nation.squad.map(TM.data.player), f); natPick = null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation-lineup");
      } } }));
    });
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Formação" }), formRow ]) ]));

    var tacRow = el("div", { class: "segmented full wrap" });
    TM.engine.TACTICS.forEach(function (o) {
      tacRow.appendChild(el("button", { class: "seg-btn" + (c.nation.tactic === o[0] ? " active" : ""), text: o[1], on: { click: function () { c.nation.tactic = o[0]; TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation-lineup"); } } }));
    });
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Tática" }), tacRow ]) ]));

    var slots = C().FORMATIONS[lu.formation];
    var pitch = el("div", { class: "pitch" });
    pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
    pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
    lu.starters.forEach(function (id, i) {
      var p = TM.data.player(id); if (!p) return;
      var slot = slots[i] || [null, 50, 50];
      pitch.appendChild(el("button", { class: "pl-chip" + (natPick === i ? " picked" : ""), style: "left:" + slot[1] + "%;top:" + slot[2] + "%", on: { click: function () { natPick = (natPick === i ? null : i); TM.ui.go("coach-nation-lineup"); } } }, [
        el("span", { class: "chip-ov", text: p.overall }), el("span", { class: "chip-name", text: shortName(p.name) })
      ]));
    });
    screen.appendChild(pitch);
    screen.appendChild(el("div", { class: "lineup-hint", text: natPick != null ? "Toque num reserva para colocar no lugar do titular." : "Toque num titular e depois num reserva." }));

    var benchWrap = el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Reservas convocados" }) ]);
    lu.bench.forEach(function (id) {
      var p = TM.data.player(id); if (!p) return;
      var row = TM.ui.playerRow(p, {}); row.classList.add("clickable");
      row.addEventListener("click", function () {
        if (natPick == null) { TM.ui.toast("Selecione um titular primeiro"); return; }
        var si = lu.starters[natPick], bi = lu.bench.indexOf(id);
        lu.starters[natPick] = id; lu.bench[bi] = si; natPick = null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation-lineup");
      });
      benchWrap.appendChild(row);
    });
    screen.appendChild(benchWrap);
  });

  /* ---------- amistoso da seleção ---------- */
  TM.ui.register("coach-nation-play", function (screen) {
    var c = TM.storage.coachCareer();
    var w = C().nationNextWindow(c);
    if (!c.nation || !w || !w.convoked || c.currentDay < w.friendlyDay) { TM.ui.go("coach-nation"); return; }
    var teamA = C().nationTeam(c), teamB = C().oppNationTeam(w.oppId);
    var simOpts = { realism: TM.storage.settings().realism, neutral: true, tacticSide: 0, tactic: c.nation.tactic };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: "Amistoso · " + c.nation.name, pauseSide: 0, simOpts: simOpts, formation: c.nation.lineup && c.nation.lineup.formation,
      onBack: function () { TM.ui.go("coach-nation"); },
      onDone: function () {
        w.played = true; w.hs = result.score[0]; w.as = result.score[1];
        var res = result.score[0] > result.score[1] ? "Vitória" : result.score[0] < result.score[1] ? "Derrota" : "Empate";
        TM.notify.push(c, { icon: "🌍", title: "Amistoso da seleção", text: res + " " + result.score[0] + "x" + result.score[1] + " contra " + teamB.name + "." });
        TM.storage.saveCoachCareer(c);
        TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result });
      }
    });
  });

  /* ---------- jogar a partida pendente ---------- */
  TM.ui.register("coach-play", function (screen) {
    var c = TM.storage.coachCareer();
    var p = c.pending && !c.pending.seasonEnd ? c.pending : C().advanceToUserMatch(c);
    if (p.seasonEnd) { TM.ui.go("coach-hub"); return; }
    var compId = compIdFor(c, p.key);
    TM.ui.applyCompTheme(screen, compId); // botões/detalhes na cor da competição
    var teamA = C().anyTeam(c, p.homeId), teamB = C().anyTeam(c, p.awayId);
    var userSide = p.homeId === c.teamId ? 0 : 1;
    var simOpts = { realism: TM.storage.settings().realism, difficulty: TM.storage.settings().difficulty, neutral: p.ko, tacticSide: userSide, tactic: c.tactic, moraleBoost: (c.pressEdge || 0), moraleSide: userSide, userSide: userSide, penTakerId: c.penTakerId || null, fkTakerId: c.fkTakerId || null };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: p.name,
      pauseSide: userSide, simOpts: simOpts, formation: c.lineup && c.lineup.formation,
      onBack: function () { TM.ui.go("coach-hub"); },
      onDone: function () {
        C().processUserMatch(c, result, userSide);
        var hs = result.score[0], as = result.score[1];
        var penCtx = hs === as ? C().userPenContext(c, hs, as) : null;
        function finish(penWinnerId) {
          C().applyUserResult(c, hs, as, penWinnerId);
          c.pressEdge = 0; // consome o efeito da coletiva
          TM.storage.saveCoachCareer(c);
          TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result, ko: p.ko, compId: compId, penWinnerId: penWinnerId });
        }
        if (penCtx) {
          var tA = C().anyTeam(c, penCtx.aId), tB = C().anyTeam(c, penCtx.bId);
          var shoot = TM.engine.shootout(tA, tB);
          var winId = shoot.winner === 0 ? penCtx.aId : penCtx.bId;
          TM.ui.go("pen-shootout", { teamA: tA, teamB: tB, shoot: shoot, compId: compId, title: "Pênaltis · " + p.name,
            onDone: function () { finish(winId); } });
        } else { finish(null); }
      }
    });
  });

  TM.ui.register("coach-match", function (screen, params) {
    var r = params.result, a = params.teamA, b = params.teamB;
    var back = params.back || "coach-hub";
    if (params.compId) TM.ui.applyCompTheme(screen, params.compId);
    screen.appendChild(TM.ui.topbar("Sua partida", function () { TM.ui.go(back); }));
    if (params.compId) { var bn = TM.ui.compBanner(params.compId); if (bn) screen.appendChild(bn); }
    var win = r.score[0] > r.score[1] ? a.name : r.score[1] > r.score[0] ? b.name : null;
    var penName = params.penWinnerId ? (params.penWinnerId === a.id ? a.name : b.name) : null;
    var tag = win ? "🏆 " + win + " venceu" : penName ? "🎯 " + penName + " venceu nos pênaltis" : (params.ko ? "Empate — decidido nos pênaltis" : "🤝 Empate");
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [
        el("span", { class: "rs-team", text: a.name }), el("span", { class: "rs-num", text: r.score[0] + " × " + r.score[1] }), el("span", { class: "rs-team", text: b.name })
      ]),
      el("div", { class: "result-tag", text: tag })
    ]));
    var feed = el("div", { class: "commentary-feed static" });
    r.events.filter(function (e) { return /goal|red|penalty/.test(e.type); }).forEach(function (e) {
      feed.appendChild(el("div", { class: "cm-line cm-" + (e.type.indexOf("goal") >= 0 ? "goal" : "card"), text: (e.minute) + "' " + (e.player ? "⚽ " + e.player : e.text) }));
    });
    if (!feed.children.length) feed.appendChild(el("div", { class: "cm-line", text: "Partida sem gols." }));
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Lances" }), feed ]));
    screen.appendChild(el("div", { class: "actions" }, [ TM.ui.button("Continuar", function () { TM.ui.go(back); }, "btn primary") ]));
  });

  /* ---------- coletiva de imprensa (pré-jogo) ---------- */
  // Pool de perguntas. {opp}=adversário · {comp}=competição · {team}=seu clube.
  // Cada resposta tem "e" (efeito na moral: +1/0/-1) e "r" (reação da imprensa/vestiário).
  var PRESS_Q = [
    { id: "q1", q: "Como o senhor enxerga o duelo contra o {opp}?", a: [
      { t: "É um rival forte, teremos que jogar muito.", e: 0, r: "A imprensa aprova o respeito ao adversário." },
      { t: "Estamos prontos para vencer em qualquer campo.", e: 1, r: "O elenco vibra com a confiança do treinador." },
      { t: "Sinceramente, o {opp} não me preocupa.", e: -1, r: "A fala vira manchete e serve de combustível ao adversário." } ] },
    { id: "q2", q: "O elenco está preparado fisicamente para esta sequência?", a: [
      { t: "Trabalhamos duro, estão a 100%.", e: 1, r: "Os jogadores gostam do voto de confiança." },
      { t: "Temos alguns desgastes, vamos administrar.", e: 0, r: "Resposta cautelosa, bem recebida." },
      { t: "Sinceramente, estamos exaustos.", e: -1, r: "A declaração passa insegurança ao grupo." } ] },
    { id: "q3", q: "Qual a importância dos três pontos hoje na {comp}?", a: [
      { t: "Cada ponto conta, mas com calma.", e: 0, r: "Discurso equilibrado." },
      { t: "Vencer aqui muda a nossa temporada.", e: 1, r: "A torcida se anima com a ambição." },
      { t: "É só mais um jogo, não muda nada.", e: -1, r: "Torcedores reclamam da falta de ambição." } ] },
    { id: "q4", q: "O que o senhor espera da sua defesa contra o ataque do {opp}?", a: [
      { t: "Confio muito no nosso sistema defensivo.", e: 1, r: "Zagueiros se sentem prestigiados." },
      { t: "Sabemos onde eles são perigosos e vamos anular.", e: 0, r: "Análise tática elogiada." },
      { t: "Nossa defesa tem falhado, é uma preocupação.", e: -1, r: "A exposição pública incomoda a zaga." } ] },
    { id: "q5", q: "Há rumores de propostas por um dos seus titulares. Comentário?", a: [
      { t: "Ele está focado e é peça fundamental.", e: 1, r: "O jogador agradece o apoio nas redes." },
      { t: "Não comento mercado em dia de jogo.", e: 0, r: "Resposta profissional." },
      { t: "Se aparecer proposta boa, cada um cuida da sua vida.", e: -1, r: "O vestiário estranha a frieza." } ] },
    { id: "q6", q: "A arbitragem tem sido tema. O senhor confia no árbitro de hoje?", a: [
      { t: "Confio, é um bom profissional.", e: 0, r: "Postura serena aprovada." },
      { t: "Só peço que apitem igual para os dois lados.", e: 1, r: "A torcida abraça o discurso." },
      { t: "Sempre saímos prejudicados, veremos.", e: -1, r: "A súmula pode 'pesar' após a provocação." } ] },
    { id: "q7", q: "A torcida lotou o estádio. Uma mensagem para ela?", a: [
      { t: "Vamos honrar essa camisa até o fim!", e: 1, r: "A arquibancada promete empurrar o time." },
      { t: "Precisamos deles do primeiro ao último minuto.", e: 1, r: "Clima de festa nas redes." },
      { t: "Espero que não vaiem se as coisas apertarem.", e: -1, r: "A cobrança soa como desconfiança." } ] },
    { id: "q8", q: "Seu time vem de um resultado ruim. Como está a cabeça do grupo?", a: [
      { t: "Viramos a página, o grupo está firme.", e: 1, r: "Mensagem de liderança bem vista." },
      { t: "Foi um tropeço, corrigimos os erros.", e: 0, r: "Autocrítica equilibrada." },
      { t: "Confesso que abalou bastante.", e: -1, r: "A fala expõe a fragilidade emocional." } ] },
    { id: "q9", q: "O {opp} tem um artilheiro em grande fase. Preocupa?", a: [
      { t: "Todo craque para quando marcamos em conjunto.", e: 1, r: "Defensores compram a ideia." },
      { t: "Preparamos a marcação especialmente para ele.", e: 0, r: "Boa leitura tática." },
      { t: "Se ele jogar, estamos perdidos.", e: -1, r: "Declaração derrotista repercute mal." } ] },
    { id: "q10", q: "Qual será a postura do time: pressão alta ou recuado?", a: [
      { t: "Vamos impor nosso jogo lá na frente.", e: 1, r: "Proposta ousada agrada a torcida." },
      { t: "Depende do andamento, seremos inteligentes.", e: 0, r: "Pragmatismo aprovado." },
      { t: "Vamos nos segurar e ver o que dá.", e: -1, r: "A cautela excessiva é criticada." } ] },
    { id: "q11", q: "Um garoto da base pode ganhar chance hoje. Confia nele?", a: [
      { t: "Confio totalmente, é o futuro do clube.", e: 1, r: "A base inteira se inspira." },
      { t: "Ele está pronto quando for preciso.", e: 0, r: "Aposta ponderada." },
      { t: "Só entra se não tiver outro jeito.", e: -1, r: "O jovem se sente desprestigiado." } ] },
    { id: "q12", q: "Este jogo pode valer a liderança. Sente o peso?", a: [
      { t: "Pressão é privilégio de quem briga por títulos.", e: 1, r: "Frase de efeito cai nas graças da imprensa." },
      { t: "Tratamos como uma final, com os pés no chão.", e: 0, r: "Concentração elogiada." },
      { t: "Prefiro nem pensar nisso.", e: -1, r: "A fuga do assunto soa como medo." } ] },
    { id: "q13", q: "O técnico rival provocou nesta semana. Vai responder?", a: [
      { t: "Respondo dentro de campo.", e: 1, r: "A postura firme agrada o vestiário." },
      { t: "Não entro nesse jogo, respeito o colega.", e: 0, r: "Elegância reconhecida." },
      { t: "Ele que se cuide, vou dar o troco.", e: -1, r: "A treta rouba o foco do time." } ] },
    { id: "q14", q: "Como está o clima no vestiário para o clássico contra o {opp}?", a: [
      { t: "Fervendo, todos querem esse jogo.", e: 1, r: "Energia contagia a comissão." },
      { t: "Concentrados, sabemos o que representa.", e: 0, r: "Seriedade aprovada." },
      { t: "Alguns estão nervosos demais.", e: -1, r: "A insegurança vaza para a imprensa." } ] },
    { id: "q15", q: "A diretoria cobrou uma reação. Isso pesa no seu trabalho?", a: [
      { t: "Cobrança faz parte, trabalho tranquilo.", e: 1, r: "Demonstração de segurança." },
      { t: "Estamos todos no mesmo barco.", e: 0, r: "Discurso de união." },
      { t: "Confesso que a pressão está pesada.", e: -1, r: "A fala alimenta rumores de demissão." } ] },
    { id: "q16", q: "Você mexeu na escalação. É uma aposta arriscada?", a: [
      { t: "É a escalação certa para vencer hoje.", e: 1, r: "Convicção transmite confiança." },
      { t: "São ajustes pensados para este adversário.", e: 0, r: "Justificativa tática aceita." },
      { t: "Sinceramente, estou no escuro.", e: -1, r: "A dúvida do treinador assusta o grupo." } ] },
    { id: "q17", q: "O gramado e o clima podem atrapalhar. Preocupado?", a: [
      { t: "Jogamos em qualquer condição.", e: 1, r: "Mentalidade vencedora." },
      { t: "Vamos nos adaptar ao longo do jogo.", e: 0, r: "Flexibilidade elogiada." },
      { t: "Essas condições nos prejudicam muito.", e: -1, r: "Soa como desculpa antecipada." } ] },
    { id: "q18", q: "Um líder do elenco está pendurado. Vai poupá-lo?", a: [
      { t: "Ele joga, precisamos dele agora.", e: 1, r: "O capitão veste a braçadeira orgulhoso." },
      { t: "Vamos avaliar com cuidado.", e: 0, r: "Gestão equilibrada." },
      { t: "Melhor deixá-lo fora, não quero risco.", e: -1, r: "O jogador fica contrariado no banco." } ] },
    { id: "q19", q: "O que a vitória de hoje representaria para a temporada?", a: [
      { t: "Seria um divisor de águas.", e: 1, r: "A torcida sonha alto." },
      { t: "Mais um passo no nosso planejamento.", e: 0, r: "Pé no chão aprovado." },
      { t: "Nada muda muito, honestamente.", e: -1, r: "Desânimo repercute nas arquibancadas." } ] },
    { id: "q20", q: "Sobre o {comp}: até onde este time pode chegar?", a: [
      { t: "Viemos para brigar pelo título.", e: 1, r: "Ambição empolga o torcedor." },
      { t: "Vamos jogo a jogo, sem promessas.", e: 0, r: "Prudência bem recebida." },
      { t: "Sejamos realistas, é difícil.", e: -1, r: "O discurso murcha o ambiente." } ] },
    { id: "q21", q: "Você trocou o esquema tático. Por quê agora?", a: [
      { t: "É o modelo que mais nos favorece.", e: 1, r: "Clareza de ideias elogiada." },
      { t: "Buscamos mais equilíbrio.", e: 0, r: "Ajuste sensato." },
      { t: "Estou tentando qualquer coisa, sinceramente.", e: -1, r: "A falta de rumo preocupa." } ] },
    { id: "q22", q: "A imprensa aponta você como favorito. Concorda?", a: [
      { t: "Favoritismo se confirma em campo.", e: 1, r: "Humildade competitiva aprovada." },
      { t: "Não existe favorito em jogo decisivo.", e: 0, r: "Cautela elogiada." },
      { t: "Claro, vamos passear no jogo.", e: -1, r: "A arrogância pode custar caro." } ] },
    { id: "q23", q: "Um reforço recente estreia hoje. Expectativa?", a: [
      { t: "Ele vai fazer a diferença, confio muito.", e: 1, r: "O reforço se sente abraçado." },
      { t: "Vamos com calma na adaptação dele.", e: 0, r: "Paciência sensata." },
      { t: "Ainda não sei se ele serve.", e: -1, r: "A dúvida pública o abala." } ] },
    { id: "q24", q: "A sequência de jogos fora de casa incomoda?", a: [
      { t: "Fazemos da estrada a nossa força.", e: 1, r: "Mentalidade resiliente." },
      { t: "É difícil, mas estamos preparados.", e: 0, r: "Realismo equilibrado." },
      { t: "Jogar fora sempre nos atrapalha.", e: -1, r: "Desculpa antecipada mal vista." } ] },
    { id: "q25", q: "O que você diria para os torcedores desconfiados?", a: [
      { t: "Peço que confiem, vamos honrá-los.", e: 1, r: "Aproximação com a torcida." },
      { t: "Entendo a cobrança, vamos responder jogando.", e: 0, r: "Diálogo maduro." },
      { t: "Quem não acredita, que fique em casa.", e: -1, r: "O bate-boca esfria o apoio." } ] },
    { id: "q26", q: "Seu adversário está desfalcado. Isso facilita?", a: [
      { t: "Respeitamos qualquer time que entrar.", e: 1, r: "Concentração exemplar." },
      { t: "Aproveitaremos nossas chances.", e: 0, r: "Pragmatismo aceito." },
      { t: "Sem os craques deles, é moleza.", e: -1, r: "O excesso de confiança preocupa." } ] },
    { id: "q27", q: "Como está a sua relação com o grupo neste momento?", a: [
      { t: "Excelente, somos uma família.", e: 1, r: "União transparece nas entrelinhas." },
      { t: "Profissional e de muito respeito.", e: 0, r: "Ambiente saudável." },
      { t: "Tem tido alguns atritos, admito.", e: -1, r: "Rumores de racha ganham força." } ] },
    { id: "q28", q: "Uma palavra sobre o que espera do jogo de hoje?", a: [
      { t: "Entrega — vamos deixar tudo em campo.", e: 1, r: "Palavra de ordem motiva o elenco." },
      { t: "Equilíbrio — jogo inteligente do início ao fim.", e: 0, r: "Mensagem tática clara." },
      { t: "Sorte — vamos precisar dela.", e: -1, r: "Depender de sorte desanima o grupo." } ] }
  ];
  function pressShuffle(arr) { arr = arr.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  TM.ui.register("coach-press", function (screen) {
    var c = TM.storage.coachCareer();
    var p = c.pending && !c.pending.seasonEnd ? c.pending : C().advanceToUserMatch(c);
    if (p.seasonEnd) { TM.ui.go("coach-hub"); return; }
    if (c.pressDoneFor === c.matchNo) { TM.ui.go("coach-hub"); return; } // já feita
    var compId = compIdFor(c, p.key);
    TM.ui.applyCompTheme(screen, compId);
    var oppId = p.homeId === c.teamId ? p.awayId : p.homeId;
    var oppName = TM.data.club(oppId).name;
    var compName = (TM.data.competition(compId) || {}).name || "";
    var myName = TM.data.club(c.teamId).name;
    function fill(t) { return t.replace(/{opp}/g, oppName).replace(/{comp}/g, compName).replace(/{team}/g, myName); }

    screen.appendChild(TM.ui.topbar("🎤 Coletiva de imprensa", function () { TM.ui.go("coach-hub"); }));
    var bn = TM.ui.compBanner(compId, "Entrevista pré-jogo"); if (bn) screen.appendChild(bn);

    // escolhe 4 perguntas ainda não usadas (cicla quando esgota, evitando repetição enquanto houver material)
    c.pressUsed = c.pressUsed || [];
    var pool = PRESS_Q.filter(function (q) { return c.pressUsed.indexOf(q.id) < 0; });
    if (pool.length < 4) { c.pressUsed = []; pool = PRESS_Q.slice(); }
    var picked = pressShuffle(pool).slice(0, 4);

    var panel = el("div", { class: "panel-narrow press-panel" });
    screen.appendChild(panel);
    var idx = 0, edge = 0;

    function render() {
      panel.innerHTML = "";
      if (idx >= 4) { done(); return; }
      panel.appendChild(el("div", { class: "press-progress" }, [ el("span", { text: "Pergunta " + (idx + 1) + " de 4" }), el("span", { class: "press-vs", text: "vs " + oppName }) ]));
      var q = picked[idx];
      panel.appendChild(el("div", { class: "press-reporter" }, [ el("span", { class: "press-mic", text: "🎙️" }), el("div", { class: "press-q", text: fill(q.q) }) ]));
      var opts = el("div", { class: "press-opts" });
      q.a.forEach(function (opt) {
        opts.appendChild(el("button", { class: "press-opt", on: { click: function () {
          edge += opt.e;
          if (c.pressUsed.indexOf(q.id) < 0) c.pressUsed.push(q.id);
          panel.innerHTML = "";
          panel.appendChild(el("div", { class: "press-answer" }, [ el("span", { class: "press-you", text: "Você:" }), el("span", { text: " " + fill(opt.t) }) ]));
          panel.appendChild(el("div", { class: "press-react " + (opt.e > 0 ? "good" : opt.e < 0 ? "bad" : "") , text: opt.r }));
          panel.appendChild(el("div", { class: "actions" }, [ TM.ui.button(idx < 3 ? "Próxima pergunta →" : "Encerrar coletiva", function () { idx++; render(); }, "btn primary") ]));
        } } }, [ el("span", { text: fill(opt.t) }) ]));
      });
      panel.appendChild(opts);
    }
    function done() {
      c.pressEdge = Math.max(-3, Math.min(3, edge));
      c.pressDoneFor = c.matchNo;
      TM.storage.saveCoachCareer(c);
      var good = c.pressEdge > 0, bad = c.pressEdge < 0;
      panel.appendChild(el("div", { class: "press-summary" + (good ? " good" : bad ? " bad" : "") }, [
        el("div", { class: "press-sum-emoji", text: good ? "😎" : bad ? "😬" : "😐" }),
        el("div", { class: "press-sum-txt", text: good ? "O elenco saiu confiante da coletiva — pequeno empurrão para o jogo." : bad ? "A coletiva gerou clima tenso no vestiário — o time entra pressionado." : "Coletiva tranquila, sem grandes repercussões." })
      ]));
      panel.appendChild(el("div", { class: "actions" }, [
        TM.ui.button("▶ Ir para o jogo", function () { TM.ui.go("coach-play"); }, "btn primary"),
        TM.ui.button("Voltar ao hub", function () { TM.ui.go("coach-hub"); }, "btn ghost")
      ]));
    }
    render();
  });

  /* ---------- competições ---------- */
  // id da imagem da competição conforme a aba
  function compIdFor(c, key) {
    if (key === "cup") return "cup-" + c.leagueId;
    if (key === "cont") return "cont-" + (C().REGION[c.leagueId] || "eu");
    if (key === "mundial") return "cwc-world";
    if (key === "inter") return "cwc-inter";
    return "lg-" + c.leagueId;
  }
  TM.coachCompId = compIdFor;
  TM.ui.register("coach-comps", function (screen, params) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🏆 Competições", function () { TM.ui.go("coach-hub"); }));
    var tabs = [ { key: "league", label: c.comps.league.name } ];
    if (c.comps.cup) tabs.push({ key: "cup", label: c.comps.cup.name });
    if (c.comps.cont) tabs.push({ key: "cont", label: c.comps.cont.name });
    if (c.comps.mundial) tabs.push({ key: "mundial", label: c.comps.mundial.name });
    var active = (params && params.tab) || "league";

    var tabRow = el("div", { class: "comp-tabs" });
    tabs.forEach(function (t) {
      tabRow.appendChild(el("button", { class: "comp-tab" + (active === t.key ? " active" : ""), on: { click: function () { TM.ui.go("coach-comps", { tab: t.key }); } } }, [
        TM.img.compImg(compIdFor(c, t.key), "comp-tab-logo"),
        el("span", { class: "ct-name", text: t.label })
      ]));
    });
    screen.appendChild(tabRow);

    // cabeçalho com o logo grande da competição ativa
    var activeTab = tabs.filter(function (t) { return t.key === active; })[0] || tabs[0];
    screen.appendChild(el("div", { class: "comp-head" }, [
      TM.img.compImg(compIdFor(c, active), ""),
      el("div", { class: "ch-name", text: activeTab.label })
    ]));

    if (active === "league") renderLeague(screen, c);
    else if (c.comps[active].type === "tournament") renderTournament(screen, c, c.comps[active]);
    else renderBracket(screen, c, c.comps[active]);
  });

  // continental (grupos + mata-mata)
  function renderTournament(screen, c, comp) {
    var t = comp.tour;
    if (t.championId) screen.appendChild(el("div", { class: "champion-banner", text: "🏆 Campeão: " + TM.data.club(t.championId).name }));
    if (t.phase === "group") {
      var wrap = el("div", { class: "panel-narrow" });
      t.groups.forEach(function (g, gi) {
        wrap.appendChild(el("div", { class: "group-title", text: "Grupo " + String.fromCharCode(65 + gi) }));
        var st = C().standings(g.table), tb = el("tbody");
        st.forEach(function (row, i) {
          var club = TM.data.club(row.id);
          tb.appendChild(el("tr", { class: (row.id === c.teamId ? "me " : "") + (i < 2 ? "qualify" : "") }, [
            el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.clubImg(club, "lt-crest"), el("span", { text: club.name }) ]),
            el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
          ]));
        });
        wrap.appendChild(el("div", { class: "table-wrap" }, [ el("table", { class: "league-table" }, [ el("thead", {}, [ el("tr", {}, ["#", "Clube", "P", "J", "SG"].map(function (h, i) { return el("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]), tb ]) ]));
      });
      screen.appendChild(wrap);
    } else {
      renderBracket(screen, c, t.ko);
    }
  }

  function renderLeague(screen, c) {
    var st = C().standings(c.comps.league.table);
    var table = el("table", { class: "league-table" }, [ el("thead", {}, [ el("tr", {}, ["#", "Clube", "P", "J", "V", "E", "D", "SG"].map(function (h, i) { return el("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]) ]);
    var tb = el("tbody");
    st.forEach(function (row, i) {
      var club = TM.data.club(row.id);
      tb.appendChild(el("tr", { class: row.id === c.teamId ? "me" : "" }, [
        el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.clubImg(club, "lt-crest"), el("span", { text: club.name }) ]),
        el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: row.w }), el("td", { text: row.d }), el("td", { text: row.l }),
        el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
      ]));
    });
    table.appendChild(tb);
    screen.appendChild(el("div", { class: "table-wrap" }, [ table ]));
  }

  function renderBracket(screen, c, ko) {
    if (ko.championId) {
      var champ = TM.data.club(ko.championId);
      screen.appendChild(el("div", { class: "champion-banner", text: "🏆 Campeão: " + champ.name }));
    }
    var wrap = el("div", { class: "bracket" });
    ko.rounds.forEach(function (round, ri) {
      if (!round) return;
      var rd = el("div", { class: "bracket-round" }, [ el("div", { class: "br-round-title", text: roundTitle(round.length) }) ]);
      round.forEach(function (tie) {
        var mine = tie[0] === c.teamId || tie[1] === c.teamId;
        var played = tie[4] != null;
        var hClub = TM.data.club(tie[0]), aClub = TM.data.club(tie[1]);
        rd.appendChild(el("div", { class: "tie" + (mine ? " mine" : "") }, [
          el("div", { class: "tie-team" + (played && tie[4] === tie[0] ? " win" : played ? " lose" : "") }, [ TM.img.clubImg(hClub, "tie-crest"), el("span", { text: hClub.name }) ]),
          el("div", { class: "tie-score", text: played ? tie[2] + " - " + tie[3] : "vs" }),
          el("div", { class: "tie-team away" + (played && tie[4] === tie[1] ? " win" : played ? " lose" : "") }, [ el("span", { text: aClub.name }), TM.img.clubImg(aClub, "tie-crest") ])
        ]));
      });
      wrap.appendChild(rd);
    });
    if (!ko.rounds.length) wrap.appendChild(el("p", { class: "intro-text", text: "Competição ainda não começou." }));
    screen.appendChild(wrap);
  }

  /* ---------- títulos ---------- */
  TM.ui.register("coach-honours", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🗂️ Títulos & Histórico", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    if (!c.honours.length) body.appendChild(el("p", { class: "intro-text", text: "Complete uma temporada para registrar seu histórico." }));
    c.honours.slice().reverse().forEach(function (h) {
      var wins = [];
      if (h.leagueChampion) wins.push("🏆 Liga");
      if (h.cupChampion) wins.push("🏆 Copa");
      if (h.contChampion) wins.push("🏆 Continental");
      if (h.mundialChampion) wins.push("🌎 Mundial");
      if (h.interChampion) wins.push("🌍 Intercontinental");
      body.appendChild(el("div", { class: "hist-line" }, [
        el("span", { text: "Temporada " + h.season }),
        el("span", { text: h.leaguePos + "º na liga" }),
        el("span", { text: wins.length ? wins.join("  ") : "—" })
      ]));
    });
    screen.appendChild(body);
  });

  /* ---------- elenco ---------- */
  TM.ui.register("coach-squad", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("👥 Central do Elenco", function () { TM.ui.go("coach-hub"); }));
    var players = C().userSquad(c);
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    players.sort(function (a, b) { return order[a.pos] - order[b.pos] || b.overall - a.overall; });
    screen.appendChild(el("div", { class: "setting-hint", style: "max-width:620px", text: "Toque num jogador para ver detalhes. Use “Listar” para colocá-lo na lista de transferências (recebe mais propostas)." }));
    var list = el("div", { class: "panel-narrow squad-list" });
    var lastPos = null;
    c.transferList = c.transferList || [];
    players.forEach(function (p) {
      if (p.pos !== lastPos) { list.appendChild(el("div", { class: "pos-header", text: ({ GK: "Goleiros", DF: "Defensores", MF: "Meio-campistas", FW: "Atacantes" })[p.pos] })); lastPos = p.pos; }
      var row = TM.ui.playerRow(p, { onClick: function (pl) { TM.ui.showPlayer(pl, { moneySym: sym(c), moneyMult: mult(c) }); } });
      var listed = c.transferList.indexOf(p.id) >= 0;
      var isLoan = c.loanedIn && c.loanedIn[p.id];
      if (!isLoan) {
        var btn = el("button", { class: "list-toggle" + (listed ? " on" : ""), text: listed ? "🏷️ Listado" : "Listar", title: "Lista de transferências",
          on: { click: function (e) {
            e.stopPropagation(); toggleTransferList(c, p.id);
            var l = c.transferList.indexOf(p.id) >= 0; btn.classList.toggle("on", l); btn.textContent = l ? "🏷️ Listado" : "Listar";
            TM.ui.toast(l ? "🏷️ Na lista de transferências" : "Retirado da lista");
          } } });
        row.appendChild(btn);
      }
      list.appendChild(row);
    });
    screen.appendChild(list);
  });
  function toggleTransferList(c, pid) {
    c.transferList = c.transferList || [];
    var i = c.transferList.indexOf(pid);
    if (i >= 0) c.transferList.splice(i, 1); else c.transferList.push(pid);
    TM.storage.saveCoachCareer(c);
  }

  /* ---------- mercado: busca + filtros + passe livre ---------- */
  var MKT = { q: "", pos: "", nat: "", league: "", club: "", age: 40, ovMin: 0, potMin: 0, free: false, sort: "ov" };
  TM.ui.register("coach-market", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🔁 Mercado", function () { TM.ui.go("coach-hub"); }));
    screen.appendChild(el("div", { class: "market-budget", text: "💰 Orçamento: " + money(c, c.budget) }));

    var world = TM.data.world();
    var rosterSet = {}; c.roster.forEach(function (id) { rosterSet[id] = true; });

    // busca
    var input = el("input", { class: "text-input", type: "text", placeholder: "Pesquisar pelo nome...", value: MKT.q });
    input.addEventListener("input", function () { MKT.q = input.value; renderResults(); });
    screen.appendChild(el("div", { class: "search-bar" }, [ input ]));

    // painel de filtros
    var panel = el("div", { class: "panel-narrow filter-panel" });
    screen.appendChild(panel);

    // passe livre
    var freeToggle = el("button", { class: "switch" + (MKT.free ? " on" : ""), on: { click: function () { MKT.free = !MKT.free; freeToggle.classList.toggle("on", MKT.free); renderResults(); } } }, [ el("span", { class: "switch-knob" }) ]);
    panel.appendChild(el("div", { class: "setting row" }, [ el("div", { class: "setting-label", text: "🆓 Só passes livres (sem clube)" }), freeToggle ]));

    // posição
    var posRow = el("div", { class: "segmented full" });
    [["", "Todas"], ["GK", "GOL"], ["DF", "DEF"], ["MF", "MEI"], ["FW", "ATA"]].forEach(function (o) {
      posRow.appendChild(el("button", { class: "seg-btn" + (MKT.pos === o[0] ? " active" : ""), text: o[1], on: { click: function () { MKT.pos = o[0]; posRow.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); this.classList.add("active"); renderResults(); } } }));
    });
    panel.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Posição" }), posRow ]));

    // ordenação
    var sortRow = el("div", { class: "segmented full" });
    [["ov", "Overall"], ["pot", "Potencial"], ["val", "Valor"], ["age", "Mais jovens"]].forEach(function (o) {
      sortRow.appendChild(el("button", { class: "seg-btn" + (MKT.sort === o[0] ? " active" : ""), text: o[1], on: { click: function () { MKT.sort = o[0]; sortRow.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); this.classList.add("active"); renderResults(); } } }));
    });
    panel.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Ordenar por" }), sortRow ]));

    // país
    var natSel = el("select", { class: "select" });
    natSel.appendChild(el("option", { value: "", text: "Todos os países" }));
    world.nations.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (n) { var o = el("option", { value: n.id, text: n.name }); if (MKT.nat === n.id) o.selected = true; natSel.appendChild(o); });
    natSel.addEventListener("change", function () { MKT.nat = natSel.value; renderResults(); });

    // liga + clube
    var leagueSel = el("select", { class: "select" });
    leagueSel.appendChild(el("option", { value: "", text: "Todas as ligas" }));
    world.leagues.forEach(function (lg) { var o = el("option", { value: lg.id, text: lg.name }); if (MKT.league === lg.id) o.selected = true; leagueSel.appendChild(o); });
    var clubSel = el("select", { class: "select" });
    function fillClubs() {
      TM.ui.clear(clubSel); clubSel.appendChild(el("option", { value: "", text: "Todos os clubes" }));
      if (MKT.league) TM.data.league(MKT.league).clubIds.map(TM.data.club).sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (cl) { var o = el("option", { value: cl.id, text: cl.name }); if (MKT.club === cl.id) o.selected = true; clubSel.appendChild(o); });
    }
    leagueSel.addEventListener("change", function () { MKT.league = leagueSel.value; MKT.club = ""; fillClubs(); renderResults(); });
    clubSel.addEventListener("change", function () { MKT.club = clubSel.value; renderResults(); });
    fillClubs();
    panel.appendChild(el("div", { class: "filter-grid" }, [ natSel, leagueSel, clubSel ]));

    // sliders
    function slider(label, key, min, max, suffix) {
      var val = el("span", { class: "range-val", text: MKT[key] + (suffix || "") });
      var inp = el("input", { type: "range", min: min, max: max, value: MKT[key], class: "slider" });
      inp.addEventListener("input", function () { MKT[key] = parseInt(inp.value, 10); val.textContent = MKT[key] + (suffix || ""); renderResults(); });
      return el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode(label), val ]), inp ]);
    }
    panel.appendChild(slider("Idade máxima", "age", 17, 40, " anos"));
    panel.appendChild(slider("Overall mínimo", "ovMin", 0, 95, ""));
    panel.appendChild(slider("Potencial mínimo", "potMin", 0, 95, ""));

    panel.appendChild(el("button", { class: "btn ghost", text: "Limpar filtros", on: { click: function () { MKT = { q: "", pos: "", nat: "", league: "", club: "", age: 40, ovMin: 0, potMin: 0, free: false }; TM.ui.go("coach-market"); } } }));

    var results = el("div", { class: "panel-narrow" });
    screen.appendChild(results);

    function renderResults() {
      TM.ui.clear(results);
      var pool;
      if (MKT.free) pool = world.freeAgents.map(TM.data.player);
      else pool = Object.keys(world.playersById).map(function (id) { return world.playersById[id]; }).filter(function (p) { return !p.freeAgent && !rosterSet[p.id]; });
      var q = MKT.q.trim().toLowerCase();
      var list = pool.filter(function (p) {
        if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
        if (MKT.pos && p.pos !== MKT.pos) return false;
        if (MKT.nat && p.nationId !== MKT.nat) return false;
        if (MKT.league && (p.clubId === "free" || TM.data.club(p.clubId).leagueId !== MKT.league)) return false;
        if (MKT.club && p.clubId !== MKT.club) return false;
        if (p.age > MKT.age) return false;
        if (p.overall < MKT.ovMin) return false;
        if ((p.potential || p.overall) < MKT.potMin) return false;
        return true;
      }).sort(function (a, b) {
        if (MKT.sort === "pot") return (b.potential || b.overall) - (a.potential || a.overall);
        if (MKT.sort === "val") return TM.data.marketValue(b) - TM.data.marketValue(a);
        if (MKT.sort === "age") return a.age - b.age || b.overall - a.overall;
        return b.overall - a.overall;
      }).slice(0, 120);

      results.appendChild(el("div", { class: "results-count", text: list.length + " jogador(es)" + (MKT.free ? " — passe livre (contrate só negociando com o jogador, sem custo de transferência)" : "") }));
      if (!list.length) { results.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador com esses filtros." })); return; }
      c.shortlist = c.shortlist || [];
      list.forEach(function (p) {
        var row = TM.ui.playerRow(p, { showClub: true });
        row.classList.add("clickable");
        // estrela: adiciona/remove da Central de transferências
        var star = el("button", { class: "shortlist-star" + (c.shortlist.indexOf(p.id) >= 0 ? " on" : ""), text: c.shortlist.indexOf(p.id) >= 0 ? "★" : "☆",
          title: "Central de transferências", on: { click: function (e) {
            e.stopPropagation(); toggleShortlist(c, p.id);
            var inl = c.shortlist.indexOf(p.id) >= 0; star.classList.toggle("on", inl); star.textContent = inl ? "★" : "☆";
            TM.ui.toast(inl ? "⭐ Adicionado à Central de transferências" : "Removido da Central");
          } } });
        row.appendChild(star);
        if (p.freeAgent) {
          row.appendChild(el("div", { class: "price-tag" }, [ el("span", { text: "Livre" }), el("span", { class: "price-note", text: "grátis" }) ]));
          row.addEventListener("click", function () { NEGO = { pid: p.id, oldClubId: null, fee: 0 }; TM.ui.go("coach-nego-player"); });
        } else {
          var price = curVal(c, askingPrice(p)), afford = price <= c.budget;
          row.appendChild(el("div", { class: "price-tag" + (afford ? "" : " over") }, [ el("span", { text: money(c, price) }), el("span", { class: "price-note", text: afford ? "no orçamento" : "acima" }) ]));
          row.addEventListener("click", function () { TM.ui.go("coach-nego-club", { pid: p.id }); });
        }
        results.appendChild(row);
      });
    }
    renderResults();
  });

  /* ---------- central de transferências (alvos / shortlist) ---------- */
  function toggleShortlist(c, pid) {
    c.shortlist = c.shortlist || [];
    var i = c.shortlist.indexOf(pid);
    if (i >= 0) c.shortlist.splice(i, 1); else c.shortlist.push(pid);
    TM.storage.saveCoachCareer(c);
  }
  TM.ui.register("coach-shortlist", function (screen) {
    var c = TM.storage.coachCareer();
    c.shortlist = (c.shortlist || []).filter(function (id) { var p = TM.data.player(id); return p && c.roster.indexOf(id) < 0; });
    TM.storage.saveCoachCareer(c);
    screen.appendChild(TM.ui.topbar("⭐ Central de transferências", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    if (!c.shortlist.length) {
      body.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador na sua central. Vá ao Mercado, toque na ⭐ de um jogador e ele aparece aqui." }));
      body.appendChild(TM.ui.button("🔁 Ir ao Mercado", function () { TM.ui.go("coach-market"); }, "btn primary"));
      return;
    }
    body.appendChild(el("p", { class: "intro-text", text: c.shortlist.length + " alvo(s). Toque num jogador para negociar." }));
    c.shortlist.forEach(function (id) {
      var p = TM.data.player(id); if (!p) return;
      var row = TM.ui.playerRow(p, { showClub: true });
      row.classList.add("clickable");
      row.addEventListener("click", function () {
        if (p.freeAgent) { NEGO = { pid: p.id, oldClubId: null, fee: 0 }; TM.ui.go("coach-nego-player"); }
        else TM.ui.go("coach-nego-club", { pid: p.id });
      });
      row.appendChild(el("button", { class: "shortlist-star on", text: "★", title: "Remover da central", on: { click: function (e) { e.stopPropagation(); toggleShortlist(c, id); TM.ui.go("coach-shortlist"); } } }));
      body.appendChild(row);
    });
  });

  /* ---------- negociação: com o clube ---------- */
  // taxa de transferência ~30% acima do valor de mercado; salário ~15% do valor/ano
  function askingPrice(p) { return Math.max(1, Math.round(TM.data.marketValue(p) * 1.3)); }
  function wageDemand(p) { return Math.max(1, Math.round(TM.data.marketValue(p) * 0.15)); }

  function segCtl(options, def, cb) {
    var wrap = el("div", { class: "segmented full" });
    options.forEach(function (o) {
      var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o;
      var b = el("button", { class: "seg-btn" + (val === def ? " active" : ""), text: lab, on: { click: function () { cb(val); wrap.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active"); } } });
      wrap.appendChild(b);
    });
    return wrap;
  }

  TM.ui.register("coach-nego-club", function (screen, params) {
    var c = TM.storage.coachCareer();
    var p = TM.data.player(params.pid);
    var sellClub = TM.data.club(p.clubId);
    var stance = C().clubStance(p);
    var mval = curVal(c, TM.data.marketValue(p));

    screen.appendChild(TM.ui.topbar("Negociação", function () { TM.ui.go("coach-market"); }));
    screen.appendChild(el("div", { class: "nego-step" }, [
      el("div", { class: "nego-dot active", text: "1. Com o clube" }),
      el("div", { class: "nego-dot", text: "2. Com o jogador" })
    ]));
    screen.appendChild(el("div", { class: "player-card" }, [
      TM.img.playerImg(p, "pc-face"),
      el("div", { class: "pc-info" }, [ el("div", { class: "pc-name", text: p.name }), el("div", { class: "pc-sub", text: TM.data.posLabel(p) + " · " + p.age + " anos · " + sellClub.name }) ]),
      TM.ui.ovBadge(p.overall)
    ]));

    // postura do clube dono
    var stanceLines = [];
    stanceLines.push(stance.willSell ? "• Aberto a vender por um bom valor." : "• Reluta em vender — quer segurar o jogador.");
    stanceLines.push(stance.willLoan ? (stance.willBuyOption ? "• Aceita empréstimo (com ou sem opção de compra)." : "• Aceita apenas empréstimo simples.") : "• Não quer emprestar este jogador.");
    screen.appendChild(el("div", { class: "stance-box" }, [
      el("div", { class: "stance-title", text: "📋 Postura do " + sellClub.name }),
      el("div", { class: "stance-line", text: stanceLines[0] }),
      el("div", { class: "stance-line", text: stanceLines[1] })
    ]));

    // seletor de tipo de negócio
    var types = [["buy", "Comprar"]];
    if (stance.willLoan) types.push(["loan", "Empréstimo"]);
    if (stance.willBuyOption) types.push(["loanBuy", "Empr. c/ opção"]);
    var deal = { type: "buy" };
    var panel = el("div", { class: "nego-panel" });
    screen.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Tipo de negócio" }), segCtl(types, "buy", function (v) { deal.type = v; render(); }) ]));
    screen.appendChild(panel);

    function goPlayer(nego) { NEGO = nego; TM.ui.go("coach-nego-player"); }

    function render() {
      panel.innerHTML = "";
      if (deal.type === "buy") renderBuy();
      else renderLoan(deal.type === "loanBuy");
    }

    /* --- compra definitiva (mais rígida) --- */
    function renderBuy() {
      var asking = Math.round(mval * stance.priceMult * (stance.willSell ? 1 : 1.12));
      var maxPat = stance.isKey ? 4 : 6;
      var st = { bid: Math.min(Math.round(asking * 0.75), c.budget), rounds: 0, patience: maxPat, agreed: false };

      panel.appendChild(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "Valor de mercado" }), el("span", { class: "deal-val", text: money(c, mval) }) ]));

      // paciência do clube (some conforme você insiste com propostas baixas)
      var moodBar = el("div", { class: "nego-mood" });
      panel.appendChild(moodBar);
      function updateMood() {
        moodBar.innerHTML = "";
        moodBar.appendChild(el("span", { class: "mood-lbl", text: "Paciência:" }));
        for (var i = 0; i < maxPat; i++) moodBar.appendChild(el("span", { class: "mood-dot" + (i < st.patience ? " on" : "") }));
      }

      // conversa (vai e volta, estilo chat)
      var thread = el("div", { class: "nego-thread" });
      panel.appendChild(thread);
      function bubble(side, text, tone) {
        thread.appendChild(el("div", { class: "nego-bubble " + side + (tone ? " " + tone : "") }, [ el("span", { text: text }) ]));
        thread.scrollTop = thread.scrollHeight;
      }
      bubble("them", sellClub.name + ": " + (stance.willSell ? "Pedimos " + money(c, asking) + " por " + p.name + "." : p.name + " não está à venda. Só sai por " + money(c, asking) + "."));

      // controles: slider + botões rápidos
      var bidVal = el("span", { class: "range-val", text: money(c, st.bid) });
      var slider = el("input", { type: "range", min: 1, max: Math.max(1, c.budget), value: Math.min(st.bid, c.budget), class: "slider" });
      slider.addEventListener("input", function () { st.bid = parseInt(slider.value, 10); bidVal.textContent = money(c, st.bid); });
      function setBid(v) { st.bid = Math.max(1, Math.min(c.budget, Math.round(v))); slider.value = Math.min(st.bid, c.budget); bidVal.textContent = money(c, st.bid); }
      var quick = el("div", { class: "nego-quick" }, [
        el("button", { class: "chip-btn", text: "−5%", on: { click: function () { setBid(st.bid * 0.95); } } }),
        el("button", { class: "chip-btn", text: "+5%", on: { click: function () { setBid(st.bid * 1.05); } } }),
        el("button", { class: "chip-btn", text: "Igualar pedido", on: { click: function () { setBid(asking); } } })
      ]);
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Sua proposta" }), el("div", { class: "range-wrap" }, [ slider, bidVal ]), quick ]));

      var actionWrap = el("div", { class: "actions", style: "margin-top:6px" });
      var offerBtn = TM.ui.button("💬 Fazer proposta", doOffer, "btn primary");
      var acceptBtn = TM.ui.button("✅ Aceitar contraproposta", function () { setBid(asking); doOffer(); }, "btn primary");
      acceptBtn.style.display = "none";
      var nextBtn = TM.ui.button("Negociar com o jogador →", function () { goPlayer({ pid: p.id, oldClubId: p.clubId, type: "buy", fee: st.bid }); }, "btn primary next-step");
      nextBtn.style.display = "none";

      function lockControls() { offerBtn.disabled = true; slider.disabled = true; acceptBtn.style.display = "none"; quick.querySelectorAll("button").forEach(function (b) { b.disabled = true; }); }
      function doOffer() {
        if (st.agreed || offerBtn.disabled) return;
        st.rounds++;
        bubble("me", "Ofereço " + money(c, st.bid) + ".");
        acceptBtn.style.display = "none";
        if (st.bid > c.budget) { bubble("them", "Seu orçamento é de apenas " + money(c, c.budget) + ".", "angry"); return; }
        if (st.bid >= asking * 0.93) {
          bubble("them", "Fechado! " + p.name + " é seu por " + money(c, st.bid) + ". Agora acerte com o jogador.", "happy");
          st.agreed = true; lockControls(); nextBtn.style.display = "block";
        } else if (st.bid >= asking * 0.78 && st.patience > 0) {
          st.patience--; asking = Math.round((asking + st.bid) / 2);
          bubble("them", "Estamos perto... chegue a " + money(c, asking) + " e fechamos.");
          acceptBtn.textContent = "✅ Aceitar " + money(c, asking); acceptBtn.style.display = "block";
        } else if (st.rounds >= 7 || st.patience <= 0) {
          bubble("them", "Encerramos a conversa por ora. Volte com uma proposta melhor.", "angry"); lockControls();
        } else {
          st.patience--; bubble("them", "Ainda está bem abaixo do que pedimos (" + money(c, asking) + ").", "angry");
        }
        updateMood();
      }

      updateMood();
      actionWrap.appendChild(offerBtn); actionWrap.appendChild(acceptBtn); actionWrap.appendChild(nextBtn);
      panel.appendChild(actionWrap);
    }

    /* --- empréstimo (simples ou com opção de compra) --- */
    function renderLoan(withOption) {
      var d = { termYears: 1, loanFee: Math.max(1, Math.round(mval * 0.08)), buyPrice: Math.round(mval * stance.priceMult * 1.15) };
      var minBuy = Math.round(mval * stance.priceMult); // o clube dono exige no mínimo isso
      var quote = el("div", { class: "nego-quote", text: sellClub.name + ": “" + (withOption ? "Topamos emprestar " + p.name + " com opção — mas a opção não sai por menos de " + money(c, minBuy) + "." : "Podemos emprestar " + p.name + ". Combine a taxa e o tempo.") + "”" });
      panel.appendChild(quote);

      // duração
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Tempo de empréstimo" }),
        segCtl([[0.5, "6 meses"], [1, "1 ano"], [1.5, "1 ano e meio"]], 1, function (v) { d.termYears = parseFloat(v); }) ]));

      // taxa de empréstimo
      var feeVal = el("span", { class: "range-val", text: money(c, d.loanFee) });
      var feeMax = Math.max(2, Math.round(mval * 0.25));
      var feeSlider = el("input", { type: "range", min: 1, max: feeMax, value: Math.min(d.loanFee, feeMax), class: "slider" });
      feeSlider.addEventListener("input", function () { d.loanFee = parseInt(feeSlider.value, 10); feeVal.textContent = money(c, d.loanFee); });
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Taxa de empréstimo" }), el("div", { class: "range-wrap" }, [ feeSlider, feeVal ]) ]));

      // preço da opção de compra
      if (withOption) {
        var bpVal = el("span", { class: "range-val", text: money(c, d.buyPrice) });
        var bpMax = Math.max(minBuy + 1, Math.round(minBuy * 2));
        var bpSlider = el("input", { type: "range", min: 1, max: bpMax, value: Math.min(d.buyPrice, bpMax), class: "slider" });
        bpSlider.addEventListener("input", function () { d.buyPrice = parseInt(bpSlider.value, 10); bpVal.textContent = money(c, d.buyPrice); });
        panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Preço da opção de compra (mín. " + money(c, minBuy) + ")" }), el("div", { class: "range-wrap" }, [ bpSlider, bpVal ]) ]));
      }

      var actionWrap = el("div", { class: "actions", style: "margin-top:6px" });
      var offerBtn = TM.ui.button("Propor empréstimo", function () {
        if (d.loanFee > c.budget) { quote.className = "nego-quote angry"; quote.textContent = "Você não tem orçamento nem para a taxa (" + money(c, c.budget) + ")."; return; }
        if (withOption && d.buyPrice < minBuy) {
          quote.className = "nego-quote angry"; quote.textContent = sellClub.name + ": “A opção de compra é baixa demais. No mínimo " + money(c, minBuy) + ".”"; return;
        }
        quote.className = "nego-quote happy"; quote.textContent = sellClub.name + ": “Acordo de empréstimo encaminhado. Agora convença o jogador.”";
        offerBtn.disabled = true; nextBtn.style.display = "block";
      }, "btn primary");
      var nextBtn = TM.ui.button("Negociar com o jogador →", function () {
        goPlayer({ pid: p.id, oldClubId: p.clubId, type: withOption ? "loanBuy" : "loan", loanFee: d.loanFee, termYears: d.termYears, buyPrice: withOption ? d.buyPrice : 0 });
      }, "btn primary next-step");
      nextBtn.style.display = "none";
      actionWrap.appendChild(offerBtn); actionWrap.appendChild(nextBtn);
      panel.appendChild(actionWrap);
    }

    render();
  });

  var NEGO = null;

  /* ---------- negociação: com o jogador ---------- */
  TM.ui.register("coach-nego-player", function (screen) {
    var c = TM.storage.coachCareer();
    if (!NEGO) { TM.ui.go("coach-market"); return; }
    var p = TM.data.player(NEGO.pid);
    var demand = curVal(c, wageDemand(p));
    var terms = { wage: demand, years: 3, role: "titular", release: false };

    var isFree = !NEGO.oldClubId;
    screen.appendChild(TM.ui.topbar("Negociação", function () { TM.ui.go("coach-market"); }));
    if (isFree) {
      screen.appendChild(el("div", { class: "nego-step" }, [ el("div", { class: "nego-dot active", text: "🆓 Passe livre — acerto direto com o jogador" }) ]));
    } else {
      screen.appendChild(el("div", { class: "nego-step" }, [
        el("div", { class: "nego-dot done", text: "1. Com o clube ✓" }),
        el("div", { class: "nego-dot active", text: "2. Com o jogador" })
      ]));
    }

    var panel = el("div", { class: "nego-panel" });
    screen.appendChild(panel);
    var quote = el("div", { class: "nego-quote", text: p.name + ": “Quero cerca de " + money(c, demand) + " por ano e um papel de destaque.”" });
    panel.appendChild(quote);

    // salário
    var wageVal = el("span", { class: "range-val", text: money(c, terms.wage) + "/ano" });
    var wageSlider = el("input", { type: "range", min: 1, max: demand * 3, value: terms.wage, class: "slider" });
    wageSlider.addEventListener("input", function () { terms.wage = parseInt(wageSlider.value, 10); wageVal.textContent = money(c, terms.wage) + "/ano"; });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Salário anual" }), el("div", { class: "range-wrap" }, [ wageSlider, wageVal ]) ]));

    // tempo de contrato
    var yearsSeg = seg(["1", "2", "3", "4", "5"], "3", function (v) { terms.years = parseInt(v, 10); });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Tempo de contrato (anos)" }), yearsSeg ]));

    // função no elenco
    var roleSeg = seg([["estrela", "Estrela"], ["titular", "Titular"], ["rodizio", "Rodízio"], ["promessa", "Promessa"]], "titular", function (v) { terms.role = v; });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Função no elenco" }), roleSeg ]));

    // cláusula de rescisão
    var relBtn = el("button", { class: "switch" + (terms.release ? " on" : ""), on: { click: function () { terms.release = !terms.release; relBtn.classList.toggle("on", terms.release); } } }, [ el("span", { class: "switch-knob" }) ]);
    panel.appendChild(el("div", { class: "nego-field", style: "flex-direction:row;justify-content:space-between;align-items:center" }, [ el("label", { text: "Incluir cláusula de rescisão" }), relBtn ]));

    var actionWrap = el("div", { class: "actions" });
    var proposeBtn = TM.ui.button("Oferecer contrato", function () {
      // avaliação do jogador
      var roleScore = { estrela: 1.2, titular: 1.0, rodizio: 0.7, promessa: 0.6 }[terms.role];
      var wageOk = terms.wage >= demand * (terms.role === "promessa" || terms.role === "rodizio" ? 1.15 : 0.9);
      var roleOk = !((p.overall >= 80 && (terms.role === "rodizio" || terms.role === "promessa")));
      if (wageOk && roleOk) {
        // fechado!
        var isLoan = NEGO.type === "loan" || NEGO.type === "loanBuy";
        if (isLoan) {
          C().signLoan(c, p, {
            parentClubId: NEGO.oldClubId, buyOption: NEGO.type === "loanBuy",
            buyPrice: NEGO.buyPrice || 0, termYears: NEGO.termYears || 1, loanFee: NEGO.loanFee || 0, wage: terms.wage
          });
        } else {
          c.budget -= (NEGO.fee || 0);
          c.roster.push(p.id);
          c.signedFrom[p.id] = NEGO.oldClubId;
          C().syncLineup(c); // já entra no banco de reservas
        }
        TM.storage.saveCoachCareer(c);
        quote.className = "nego-quote happy";
        quote.textContent = isLoan
          ? "✔ " + p.name + " chega por empréstimo (" + C().loanTermLabel(NEGO.termYears) + ")" + (NEGO.type === "loanBuy" ? " com opção de compra!" : "!")
          : "✔ " + p.name + " assinou com o " + TM.data.club(c.teamId).name + "!";
        actionWrap.innerHTML = "";
        actionWrap.appendChild(TM.ui.button("Voltar ao mercado", function () { NEGO = null; TM.ui.go("coach-market"); }, "btn primary"));
      } else if (!roleOk) {
        quote.className = "nego-quote angry"; quote.textContent = p.name + ": “Sou titular indiscutível. Não aceito função de reserva.”";
      } else {
        quote.className = "nego-quote angry"; quote.textContent = p.name + ": “Salário insuficiente. Quero pelo menos " + money(c, demand) + "/ano.”";
      }
    }, "btn primary");
    actionWrap.appendChild(proposeBtn);
    screen.appendChild(actionWrap);

    function seg(options, def, cb) {
      var wrap = el("div", { class: "segmented full" });
      options.forEach(function (o) {
        var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o;
        var b = el("button", { class: "seg-btn" + (val === def ? " active" : ""), text: lab, on: { click: function () { cb(val); wrap.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active"); } } });
        wrap.appendChild(b);
      });
      return wrap;
    }
  });

  /* ---------- central de notificações ---------- */
  TM.ui.register("coach-notifications", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🔔 Avisos", function () { TM.notify.markAllRead(c); TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var notes = c.notifications || [];
    if (!notes.length) { body.appendChild(el("p", { class: "intro-text", text: "Nenhum aviso no momento." })); }
    notes.forEach(function (n) {
      var card = el("div", { class: "note" + (n.read ? "" : " unread") }, [
        el("div", { class: "note-ic", text: n.icon || "•" }),
        el("div", { class: "note-body" }, [ el("div", { class: "note-title", text: n.title }), el("div", { class: "note-text", text: n.text }) ])
      ]);
      if (n.offer) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("Analisar proposta", function () { TM.ui.go("coach-offer", { noteId: n.id }); }, "btn primary small")
        ]));
      } else if (n.loanOffer) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("Analisar / negociar", function () { TM.ui.go("coach-loan-offer", { noteId: n.id }); }, "btn primary small")
        ]));
      } else if (n.buyOption) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("💳 Comprar", function () {
            C().exerciseLoanBuy(c, n.buyOption.pid, n.buyOption.price); TM.notify.remove(c, n.id);
            TM.storage.saveCoachCareer(c); TM.ui.toast("Opção de compra exercida!"); TM.ui.go("coach-notifications");
          }, "btn primary small"),
          TM.ui.button("Devolver", function () {
            C().returnLoanIn(c, n.buyOption.pid); TM.notify.remove(c, n.id);
            TM.storage.saveCoachCareer(c); TM.ui.go("coach-notifications");
          }, "btn ghost small")
        ]));
      } else if (n.nationInvite) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("Aceitar", function () {
            c.nation = C().buildNation(n.nationInvite); C().setupNationSeason(c); TM.notify.remove(c, n.id);
            TM.notify.push(c, { icon: "🌍", title: "Seleção assumida", text: "Você agora comanda a seleção de " + c.nation.name + "! Faça a convocação a tempo." });
            TM.storage.saveCoachCareer(c); TM.ui.go("coach-notifications");
          }, "btn primary small"),
          TM.ui.button("Recusar", function () { TM.notify.remove(c, n.id); TM.storage.saveCoachCareer(c); TM.ui.go("coach-notifications"); }, "btn ghost small")
        ]));
      }
      body.appendChild(card);
    });
    // marca como lido ao visualizar
    TM.notify.markAllRead(c); TM.storage.saveCoachCareer(c);
  });

  /* ---------- analisar proposta recebida ---------- */
  TM.ui.register("coach-offer", function (screen, params) {
    var c = TM.storage.coachCareer();
    var note = TM.notify.get(c, params.noteId);
    if (!note || !note.offer) { TM.ui.go("coach-notifications"); return; }
    var off = note.offer;
    var player = C().resolvePlayer(c, off.playerId);
    var buyer = TM.data.club(off.buyerId);

    screen.appendChild(TM.ui.topbar("Analisar proposta", function () { TM.ui.go("coach-notifications"); }));
    screen.appendChild(el("div", { class: "player-card" }, [
      TM.img.playerImg(player, "pc-face"),
      el("div", { class: "pc-info" }, [ el("div", { class: "pc-name", text: player.name }), el("div", { class: "pc-sub", text: TM.data.posLabel(player) + " · " + player.age + " anos · " + player.nationName }) ]),
      TM.ui.ovBadge(player.overall)
    ]));

    function line(label, val, cls) { return el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: label }), el("span", { class: "deal-val " + (cls || ""), text: val }) ]); }
    var value = curVal(c, TM.data.marketValue(player));
    screen.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "🏟️ " + buyer.name + " quer contratar " + player.name + "." }),
      line("Clube interessado", buyer.name),
      line("Overall do clube", TM.data.clubRating(off.buyerId)),
      line("Valor de mercado", money(c, value)),
      line("Proposta oferecida", money(c, off.fee), off.fee >= value ? "good" : "bad"),
      line("Diferença", (off.fee - value >= 0 ? "+" : "") + money(c, off.fee - value), off.fee >= value ? "good" : "bad"),
      el("div", { class: "setting-hint", text: off.fee >= value ? "A proposta está acima do valor de mercado — bom negócio." : "A proposta está abaixo do valor de mercado." })
    ]));

    // ---- contraproposta (negociar por mais) ----
    if (!off.finalOffer) {
      var negWrap = el("div", { class: "nego-panel" });
      negWrap.appendChild(el("div", { class: "nego-quote", text: "💬 Faça uma contraproposta — peça um valor maior." }));
      var demandInput = el("input", { class: "text-input", type: "number", min: off.fee + 1, step: 1, value: Math.round(off.fee * 1.2), placeholder: "Valor pedido (milhões)" });
      negWrap.appendChild(el("div", { class: "nego-row" }, [
        el("span", { class: "deal-lbl", text: "Pedir " + sym(c) }), demandInput, el("span", { class: "deal-lbl", text: "M" })
      ]));
      negWrap.appendChild(TM.ui.button("📤 Enviar contraproposta", function () {
        var d = parseInt(demandInput.value, 10);
        if (!d || d <= 0) { TM.ui.toast("Informe um valor válido"); return; }
        var r = C().counterIncomingOffer(c, note, d); TM.storage.saveCoachCareer(c);
        TM.ui.toast(r.text || "");
        if (r.status === "retirada") { TM.ui.go("coach-notifications"); }
        else { TM.ui.go("coach-offer", { noteId: note.id }); }
      }, "btn primary small"));
      screen.appendChild(negWrap);
    } else {
      screen.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "🔒 Proposta final — não é possível negociar mais." }));
    }

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("✅ Aceitar proposta", function () {
        var r = C().resolveIncomingOffer(c, note, true); TM.storage.saveCoachCareer(c);
        TM.ui.toast(r === "vendido" ? "Jogador vendido!" : "O jogador recusou sair."); TM.ui.go("coach-notifications");
      }, "btn primary"),
      TM.ui.button("❌ Recusar", function () { C().resolveIncomingOffer(c, note, false); TM.storage.saveCoachCareer(c); TM.ui.go("coach-notifications"); }, "btn ghost")
    ]));
  });

  /* ---------- analisar/negociar pedido de empréstimo recebido ---------- */
  TM.ui.register("coach-loan-offer", function (screen, params) {
    var c = TM.storage.coachCareer();
    var note = TM.notify.get(c, params.noteId);
    if (!note || !note.loanOffer) { TM.ui.go("coach-notifications"); return; }
    var lo = note.loanOffer;
    var player = C().resolvePlayer(c, lo.playerId);
    var buyer = TM.data.club(lo.buyerId);

    screen.appendChild(TM.ui.topbar("Pedido de empréstimo", function () { TM.ui.go("coach-notifications"); }));
    screen.appendChild(el("div", { class: "player-card" }, [
      TM.img.playerImg(player, "pc-face"),
      el("div", { class: "pc-info" }, [ el("div", { class: "pc-name", text: player.name }), el("div", { class: "pc-sub", text: TM.data.posLabel(player) + " · " + player.age + " anos · " + player.nationName }) ]),
      TM.ui.ovBadge(player.overall)
    ]));

    function line(label, val, cls) { return el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: label }), el("span", { class: "deal-val " + (cls || ""), text: val }) ]); }
    screen.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "🔄 " + buyer.name + " quer " + player.name + " por empréstimo." }),
      line("Clube interessado", buyer.name),
      line("Overall do clube", TM.data.clubRating(lo.buyerId)),
      line("Duração", C().loanTermLabel(lo.termYears)),
      line("Taxa de empréstimo", C().fmtMoney(c, lo.loanFee)),
      line("Opção de compra", lo.buyOption ? C().fmtMoney(c, lo.buyPrice) : "não incluída", lo.buyOption ? "good" : "")
    ]));

    if (!lo.finalOffer) {
      var negWrap = el("div", { class: "nego-panel" });
      negWrap.appendChild(el("div", { class: "nego-quote", text: "💬 Negocie melhores termos com o " + buyer.name + "." }));
      var feeInput = el("input", { class: "text-input", type: "number", min: lo.loanFee, step: 1, value: Math.round(lo.loanFee * 1.5) || 1, placeholder: "Taxa (milhões)" });
      negWrap.appendChild(el("div", { class: "nego-row" }, [ el("span", { class: "deal-lbl", text: "Taxa " + sym(c) }), feeInput, el("span", { class: "deal-lbl", text: "M" }) ]));
      var askOpt = el("button", { class: "switch" + (lo.buyOption ? " on" : ""), on: { click: function () { askOpt.classList.toggle("on"); priceRow.style.display = askOpt.classList.contains("on") ? "" : "none"; } } }, [ el("span", { class: "switch-knob" }) ]);
      negWrap.appendChild(el("div", { class: "setting row" }, [ el("div", { class: "deal-lbl", text: "Exigir opção de compra" }), askOpt ]));
      var priceInput = el("input", { class: "text-input", type: "number", min: 1, step: 1, value: lo.buyPrice || Math.round(curVal(c, TM.data.marketValue(player)) * 1.2), placeholder: "Preço da opção (milhões)" });
      var priceRow = el("div", { class: "nego-row", style: lo.buyOption ? "" : "display:none" }, [ el("span", { class: "deal-lbl", text: "Compra " + sym(c) }), priceInput, el("span", { class: "deal-lbl", text: "M" }) ]);
      negWrap.appendChild(priceRow);
      negWrap.appendChild(TM.ui.button("📤 Enviar contraproposta", function () {
        var want = { loanFee: parseInt(feeInput.value, 10) || lo.loanFee, askOption: askOpt.classList.contains("on"), buyPrice: parseInt(priceInput.value, 10) || 0 };
        var r = C().counterLoanOffer(c, note, want); TM.storage.saveCoachCareer(c);
        TM.ui.toast(r.text || ""); TM.ui.go("coach-loan-offer", { noteId: note.id });
      }, "btn primary small"));
      screen.appendChild(negWrap);
    } else {
      screen.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "🔒 Proposta final — não é possível negociar mais." }));
    }

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("🤝 Aceitar e emprestar", function () {
        C().resolveLoanOffer(c, note, true); TM.storage.saveCoachCareer(c);
        TM.ui.toast("Jogador emprestado."); TM.ui.go("coach-notifications");
      }, "btn primary"),
      TM.ui.button("❌ Recusar", function () { C().resolveLoanOffer(c, note, false); TM.storage.saveCoachCareer(c); TM.ui.go("coach-notifications"); }, "btn ghost")
    ]));
  });

  /* ---------- escalação (campinho) ---------- */
  var pickSlot = null; // índice de titular selecionado para troca
  TM.ui.register("coach-lineup", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.lineup) c.lineup = C().buildLineup(C().rosterPlayers(c), "4-4-2");
    C().syncLineup(c); TM.storage.saveCoachCareer(c); // garante contratados no banco
    screen.appendChild(TM.ui.topbar("📋 Escalação", function () { pickSlot = null; TM.ui.go("coach-hub"); }));

    // formação
    var formRow = el("div", { class: "segmented full" });
    Object.keys(C().FORMATIONS).forEach(function (f) {
      formRow.appendChild(el("button", { class: "seg-btn" + (c.lineup.formation === f ? " active" : ""), text: f, on: { click: function () {
        c.lineup = C().buildLineup(C().rosterPlayers(c), f); pickSlot = null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-lineup");
      } } }));
    });
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Formação" }), formRow ]) ]));

    // tática
    var tacRow = el("div", { class: "segmented full wrap" });
    TM.engine.TACTICS.forEach(function (o) {
      tacRow.appendChild(el("button", { class: "seg-btn" + (c.tactic === o[0] ? " active" : ""), text: o[1], on: { click: function () { c.tactic = o[0]; TM.storage.saveCoachCareer(c); TM.ui.go("coach-lineup"); } } }));
    });
    screen.appendChild(el("div", { class: "panel-narrow" }, [ el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Tática" }), tacRow ]) ]));

    // cobradores de bola parada (pênalti e falta)
    var takerPool = C().rosterPlayers(c).slice().sort(function (a, b) { return (b.attrs.sho || 0) - (a.attrs.sho || 0); });
    function takerSelect(key, label) {
      var selEl = el("select", { class: "select" });
      selEl.appendChild(el("option", { value: "", text: "Automático (melhor em campo)" }));
      takerPool.forEach(function (pl) {
        var o = el("option", { value: pl.id, text: pl.name + " (" + TM.data.posLabel(pl) + " · fin " + (pl.attrs.sho || "-") + ")" });
        if (c[key] === pl.id) o.selected = true;
        selEl.appendChild(o);
      });
      selEl.addEventListener("change", function () { c[key] = selEl.value || null; TM.storage.saveCoachCareer(c); });
      return el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: label }), selEl ]);
    }
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("h3", { class: "block-title", text: "⚽ Cobradores de bola parada" }),
      takerSelect("penTakerId", "Batedor de pênalti"),
      takerSelect("fkTakerId", "Batedor de falta"),
      el("div", { class: "setting-hint", text: "Só valem se o jogador estiver em campo; senão, o melhor finalizador cobra." })
    ]));

    // campinho + reservas (área interativa atualizada EM LUGAR — não recarrega a tela nem reseta o scroll)
    var board = el("div", { class: "lineup-board" });
    screen.appendChild(board);

    function renderBoard() {
      board.innerHTML = "";
      var slots = C().FORMATIONS[c.lineup.formation];
      var pitch = el("div", { class: "pitch" });
      pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
      pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
      c.lineup.starters.forEach(function (id, i) {
        var p = C().resolvePlayer(c, id); if (!p) return;
        var slot = slots[i] || [null, 50, 50];
        var unavail = !C().available(c, id);
        var chip = el("button", { class: "pl-chip" + (pickSlot === i ? " picked" : "") + (unavail ? " unavail" : ""),
          style: "left:" + slot[1] + "%;top:" + slot[2] + "%",
          on: { click: function () { onStarterClick(i); } } }, [
          el("div", { class: "chip-face-wrap" }, [
            TM.img.playerImg(p, "chip-face"),
            el("span", { class: "chip-ov", text: p.overall }),
            unavail ? el("span", { class: "chip-flag", text: c.injuries[id] ? "🚑" : "🟥" }) : null
          ]),
          el("span", { class: "chip-name", text: shortName(p.name) }),
          el("span", { class: "chip-age", text: p.age + " anos" })
        ]);
        pitch.appendChild(chip);
      });
      board.appendChild(pitch);

      board.appendChild(el("div", { class: "lineup-hint", text: pickSlot != null ? "Toque em OUTRO titular para trocar as posições, ou num reserva para substituir. Toque no mesmo para cancelar." : "Toque num titular e depois em outro titular (troca de posição) ou num reserva (substituição)." }));

      var benchWrap = el("div", { class: "panel-narrow" }, [ el("h3", { class: "block-title", text: "Reservas" }) ]);
      (c.lineup.bench || []).forEach(function (id) {
        var p = C().resolvePlayer(c, id); if (!p) return;
        var unavail = !C().available(c, id);
        var row = TM.ui.playerRow(p, {});
        row.classList.add("clickable");
        if (unavail) row.classList.add("row-unavail");
        if (pickSlot != null) row.classList.add("row-target");
        row.addEventListener("click", function () { onBenchClick(id); });
        row.appendChild(el("button", { class: "squad-move-btn cut", text: "Cortar", on: { click: function (e) { e.stopPropagation(); toExcluded(id); } } }));
        benchWrap.appendChild(row);
      });
      board.appendChild(benchWrap);

      // não relacionados (fora da partida)
      var exWrap = el("div", { class: "panel-narrow" }, [
        el("h3", { class: "block-title", text: "Não relacionados" }),
        el("div", { class: "setting-hint", text: "Ficam fora da partida — nem titulares, nem reservas." })
      ]);
      var ex = c.lineup.excluded || [];
      if (!ex.length) exWrap.appendChild(el("p", { class: "intro-text", text: "Ninguém cortado. Toque em “Cortar” num reserva para deixá-lo de fora." }));
      ex.forEach(function (id) {
        var p = C().resolvePlayer(c, id); if (!p) return;
        var row = TM.ui.playerRow(p, {});
        row.classList.add("row-excluded");
        row.appendChild(el("button", { class: "squad-move-btn add", text: "Relacionar", on: { click: function (e) { e.stopPropagation(); toBench(id); } } }));
        exWrap.appendChild(row);
      });
      board.appendChild(exWrap);
    }

    function onStarterClick(i) {
      if (pickSlot == null) { pickSlot = i; }            // seleciona o 1º titular
      else if (pickSlot === i) { pickSlot = null; }       // toque no mesmo cancela
      else {                                              // troca os dois titulares de posição
        var tmp = c.lineup.starters[pickSlot];
        c.lineup.starters[pickSlot] = c.lineup.starters[i];
        c.lineup.starters[i] = tmp;
        pickSlot = null;
        TM.storage.saveCoachCareer(c);
      }
      renderBoard();
    }
    function onBenchClick(benchId) {
      if (pickSlot == null) { TM.ui.toast("Selecione um titular primeiro"); return; }
      var starterId = c.lineup.starters[pickSlot];
      var bi = c.lineup.bench.indexOf(benchId);
      c.lineup.starters[pickSlot] = benchId;
      c.lineup.bench[bi] = starterId;
      pickSlot = null;
      TM.storage.saveCoachCareer(c);
      renderBoard();
    }
    function toExcluded(id) {
      c.lineup.bench = (c.lineup.bench || []).filter(function (x) { return x !== id; });
      c.lineup.excluded = c.lineup.excluded || [];
      if (c.lineup.excluded.indexOf(id) < 0) c.lineup.excluded.push(id);
      TM.storage.saveCoachCareer(c); renderBoard();
    }
    function toBench(id) {
      c.lineup.excluded = (c.lineup.excluded || []).filter(function (x) { return x !== id; });
      if (c.lineup.bench.indexOf(id) < 0) c.lineup.bench.push(id);
      c.lineup.bench.sort(function (a, b) { var pa = C().resolvePlayer(c, a), pb = C().resolvePlayer(c, b); return (pb ? pb.overall : 0) - (pa ? pa.overall : 0); });
      TM.storage.saveCoachCareer(c); renderBoard();
    }

    renderBoard();
  });
  function shortName(name) { var parts = name.split(" "); return parts.length > 1 ? parts[0][0] + ". " + parts[parts.length - 1] : name; }

  /* ---------- categorias de base ---------- */
  TM.ui.register("coach-youth", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🌱 Categorias de Base", function () { TM.ui.go("coach-hub"); }));
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("p", { class: "intro-text", text: "Elenco da base do seu clube. Promova jogadores de 15 anos ou mais para o profissional, ou dispute uma partida de base." }),
      TM.ui.button("⚽ Disputar partida de base", function () { TM.ui.go("coach-youth-match"); }, "btn primary")
    ]));

    var list = el("div", { class: "panel-narrow squad-list" });
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    (c.youth || []).slice().sort(function (a, b) { return order[a.pos] - order[b.pos] || b.potential - a.potential; }).forEach(function (p) {
      var row = TM.ui.playerRow(p, { onClick: function (pl) { TM.ui.showPlayer(pl, { moneySym: sym(c), moneyMult: mult(c) }); } });
      var canPromote = p.age >= 15;
      row.appendChild(el("button", { class: "buy-btn" + (canPromote ? "" : " disabled"), text: canPromote ? "Subir ↑" : p.age + " anos", on: { click: function (e) {
        e.stopPropagation();
        if (!canPromote) { TM.ui.toast("Mínimo de 15 anos para promover"); return; }
        if (C().promoteYouth(c, p.id)) { TM.storage.saveCoachCareer(c); TM.ui.toast("✔ " + p.name + " promovido ao profissional!"); TM.ui.go("coach-youth"); }
      } } }));
      list.appendChild(row);
    });
    if (!(c.youth || []).length) list.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador na base (todos promovidos)." }));
    screen.appendChild(list);
  });

  TM.ui.register("coach-youth-match", function (screen) {
    var c = TM.storage.coachCareer();
    var club = TM.data.club(c.teamId);
    var myYouth = (c.youth || []).slice().sort(function (a, b) { return b.overall - a.overall; });
    if (myYouth.length < 7) { TM.ui.toast("Base insuficiente para jogar"); TM.ui.go("coach-youth"); return; }
    // adversário: base gerada de outro clube da liga
    var others = TM.data.league(c.leagueId).clubIds.filter(function (id) { return id !== c.teamId; });
    var oppId = others[Math.floor(Math.random() * others.length)];
    var oppYouth = C().generateYouth(oppId).sort(function (a, b) { return b.overall - a.overall; });
    var teamA = { id: "myb", name: club.name + " Sub-19", players: myYouth, club: club };
    var teamB = { id: "opb", name: TM.data.club(oppId).name + " Sub-19", players: oppYouth, club: TM.data.club(oppId) };
    var result = TM.engine.simulate(teamA, teamB, { realism: TM.storage.settings().realism });
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: "Partida de Base",
      onBack: function () { TM.ui.go("coach-youth"); },
      onDone: function () { TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result }); }
    });
  });
})(window);
