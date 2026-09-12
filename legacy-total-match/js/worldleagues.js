/* ================= TOTAL MATCH — Ligas do mundo (aba 🌍 Ligas) =================
   Você escolhe uma liga e manda o departamento de análise OBSERVÁ-LA por 8 dias. Só depois consegue
   acompanhar: tabela, resultados da rodada, próximos jogos e artilheiros. As ligas observadas passam a ser
   simuladas dia a dia (rodadas espalhadas pela temporada); as demais não gastam processamento. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  var OBS_DAYS = 8, MAX_OBS = 3, FIRST_DAY = 20, SEASON_SPAN = 270;
  var NATION_PT = { Brazil: "Brasil", England: "Inglaterra", Spain: "Espanha", Italy: "Itália", Germany: "Alemanha", France: "França", Portugal: "Portugal", Netherlands: "Holanda", Turkey: "Turquia", Russia: "Rússia", Switzerland: "Suíça", Belgium: "Bélgica", Argentina: "Argentina", Ecuador: "Equador", Uruguay: "Uruguai", Colombia: "Colômbia", Paraguay: "Paraguai", "United States": "Estados Unidos", USA: "Estados Unidos", Mexico: "México", "Saudi Arabia": "Arábia Saudita", Japan: "Japão", Morocco: "Marrocos", Chile: "Chile", Peru: "Peru", Bolivia: "Bolívia", Venezuela: "Venezuela", Scotland: "Escócia", Greece: "Grécia", Austria: "Áustria", Denmark: "Dinamarca", Poland: "Polônia", Croatia: "Croácia", Ukraine: "Ucrânia", Egypt: "Egito", Australia: "Austrália", China: "China", "South Korea": "Coreia do Sul", Korea: "Coreia do Sul", Qatar: "Catar", "United Arab Emirates": "Emirados Árabes", Nigeria: "Nigéria", "South Africa": "África do Sul", Canada: "Canadá", Norway: "Noruega", Sweden: "Suécia", "Czech Republic": "Tchéquia", Serbia: "Sérvia", Romania: "Romênia", Ireland: "Irlanda", Wales: "País de Gales" };
  var REGION_OF = { Brazil: "América do Sul", Argentina: "América do Sul", Ecuador: "América do Sul", Uruguay: "América do Sul", Colombia: "América do Sul", Paraguay: "América do Sul", Chile: "América do Sul", Peru: "América do Sul", Bolivia: "América do Sul", Venezuela: "América do Sul",
    "United States": "América do Norte", USA: "América do Norte", Mexico: "América do Norte", Canada: "América do Norte",
    "Saudi Arabia": "Ásia & África", Japan: "Ásia & África", Morocco: "Ásia & África", Egypt: "Ásia & África", China: "Ásia & África", "South Korea": "Ásia & África", Korea: "Ásia & África", Qatar: "Ásia & África", "United Arab Emirates": "Ásia & África", Australia: "Ásia & África", Nigeria: "Ásia & África", "South Africa": "Ásia & África" };
  var REGION_ORDER = ["América do Sul", "Europa", "América do Norte", "Ásia & África"];
  function natPt(n) { return NATION_PT[n] || n; }
  function regionOf(nation) { return REGION_OF[nation] || "Europa"; }
  function day(c) { return c.currentDay || 0; }
  function save(c) { TM.storage.saveCoachCareer(c); }
  function st(c) { c.wl = c.wl || { obs: {}, seen: {}, leagues: {} }; c.wl.obs = c.wl.obs || {}; c.wl.seen = c.wl.seen || {}; c.wl.leagues = c.wl.leagues || {}; return c.wl; }
  function allLeagues() { return (TM.data.world().leagues || []).slice(); }
  function leagueOf(lid) { return TM.data.league(lid); }
  function nationOf(lg) { try { return TM.data.nationByName(lg.nation); } catch (e) { return null; } }
  function isMine(c, lid) { return c.leagueId === lid; }

  /* ---------- observação (8 dias) ---------- */
  // -> { status: "mine" | "none" | "watching" | "done", left, pct }
  function obsInfo(c, lid) {
    var s = st(c);
    if (isMine(c, lid)) return { status: "mine", left: 0, pct: 100 };
    if (s.seen[lid]) return { status: "done", left: 0, pct: 100 };
    var o = s.obs[lid];
    if (!o) return { status: "none", left: OBS_DAYS, pct: 0 };
    var left = Math.max(0, o.end - day(c));
    if (left <= 0) return { status: "done", left: 0, pct: 100 };
    return { status: "watching", left: left, pct: Math.round((OBS_DAYS - left) / OBS_DAYS * 100), start: o.start, end: o.end };
  }
  function watching(c) { var s = st(c); return Object.keys(s.obs).filter(function (k) { return !s.seen[k]; }); }
  function startObs(c, lid) {
    var s = st(c), lg = leagueOf(lid);
    if (!lg || isMine(c, lid) || s.seen[lid] || s.obs[lid]) return false;
    if (watching(c).length >= MAX_OBS) { TM.ui.toast("Seu departamento de análise só consegue observar " + MAX_OBS + " ligas ao mesmo tempo."); return false; }
    s.obs[lid] = { start: day(c), end: day(c) + OBS_DAYS };
    TM.notify.push(c, { icon: "🔭", title: "Observando a " + lg.name, text: "Seu departamento de análise começou a observar a " + lg.name + " (" + natPt(lg.nation) + "). Relatório completo em " + OBS_DAYS + " dias — depois você acompanha tabela, rodadas e artilheiros." });
    save(c); return true;
  }
  // roda a cada visita ao hub: conclui observações e simula as rodadas atrasadas das ligas acompanhadas
  function tick(c) {
    var s = st(c), changed = false;
    Object.keys(s.obs).forEach(function (lid) {
      if (s.seen[lid]) return;
      if (day(c) >= s.obs[lid].end) {
        s.seen[lid] = c.season || 1; delete s.obs[lid]; changed = true;
        var lg = leagueOf(lid);
        if (lg) TM.notify.push(c, { icon: "📊", title: "Observação concluída: " + lg.name, text: "Relatório pronto. Agora você acompanha a " + lg.name + " (" + natPt(lg.nation) + ") na aba 🌍 Ligas: tabela, rodadas e artilheiros." });
      }
    });
    Object.keys(s.seen).forEach(function (lid) { try { if (catchUp(c, lid)) changed = true; } catch (e) {} });
    if (changed) save(c);
  }

  /* ---------- simulação das ligas observadas ---------- */
  function roundRobin(ids) {
    var n = ids.length, arr = ids.slice(), rounds = [];
    if (n % 2 === 1) { arr.push(null); n++; }
    for (var r = 0; r < n - 1; r++) {
      var round = [];
      for (var i = 0; i < n / 2; i++) { var a = r % 2 === 0 ? arr[i] : arr[n - 1 - i], b = r % 2 === 0 ? arr[n - 1 - i] : arr[i]; if (a && b) round.push([a, b]); }
      rounds.push(round); arr.splice(1, 0, arr.pop());
    }
    return rounds.concat(rounds.map(function (rd) { return rd.map(function (m) { return [m[1], m[0]]; }); }));
  }
  function emptyTable(ids) { var t = {}; ids.forEach(function (id) { t[id] = { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }); return t; }
  function applyResult(t, h, a, hs, as) {
    var H = t[h], A = t[a]; if (!H || !A) return; H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; A.l++; H.pts += 3; } else if (hs < as) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  function standings(t) { return Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf; }); }
  function spacing(nRounds) { return Math.max(4, Math.floor(SEASON_SPAN / Math.max(1, nRounds - 1))); }
  function roundDay(L, r) { return FIRST_DAY + r * spacing(L.fixtures.length); }
  function ensureLeague(c, lid) {
    var s = st(c), lg = leagueOf(lid); if (!lg) return null;
    var L = s.leagues[lid];
    if (!L || L.season !== (c.season || 1)) {
      var ids = lg.clubIds.slice();
      // sorteio estável por temporada (embaralha a ordem para o calendário não ser sempre igual)
      var seed = (c.season || 1) * 7919 + lid.length * 131;
      for (var i = ids.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; var j = seed % (i + 1); var t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
      L = s.leagues[lid] = { season: c.season || 1, fixtures: roundRobin(ids), round: 0, table: emptyTable(lg.clubIds), scorers: {}, last: [], prev: [] };
    }
    return L;
  }
  function simOne(c, h, a) {
    var opts = { realism: TM.storage.settings().realism };
    try { Object.assign(opts, C().matchContext(c, h, a, false)); } catch (e) {}
    return TM.engine.simulate(C().anyTeam(c, h), C().anyTeam(c, a), opts);
  }
  // simula todas as rodadas cuja data já passou; devolve true se mexeu em algo
  function catchUp(c, lid) {
    var L = ensureLeague(c, lid); if (!L) return false;
    var did = false, guard = 0;
    while (L.round < L.fixtures.length && day(c) >= roundDay(L, L.round) && guard++ < 60) {
      var rd = L.fixtures[L.round], results = [];
      rd.forEach(function (m) {
        var res = simOne(c, m[0], m[1]);
        applyResult(L.table, m[0], m[1], res.score[0], res.score[1]);
        (res.events || []).forEach(function (e) {
          if ((e.type === "goal" || e.type === "pengoal") && e.playerId) L.scorers[e.playerId] = (L.scorers[e.playerId] || 0) + 1;
        });
        try { C().recordForm(c, m[0], m[1], res.score); } catch (e) {}
        results.push([m[0], m[1], res.score[0], res.score[1]]);
      });
      L.prev = L.last; L.last = results; L.lastRound = L.round; L.lastDay = roundDay(L, L.round);
      L.round++; did = true;
    }
    if (did && L.round >= L.fixtures.length && !L.championId) {
      var top = standings(L.table)[0]; L.championId = top && top.id;
      var lg = leagueOf(lid), champ = L.championId && TM.data.club(L.championId);
      if (lg && champ) TM.notify.push(c, { icon: "🏆", title: champ.name + " campeão da " + lg.name, news: true, text: champ.name + " conquistou a " + lg.name + " (" + natPt(lg.nation) + ") com " + top.pts + " pontos." });
    }
    return did;
  }
  function topScorers(L, n) {
    var pb = TM.data.world().playersById;
    return Object.keys(L.scorers).map(function (pid) { return { p: pb[pid], g: L.scorers[pid] }; }).filter(function (x) { return x.p; })
      .sort(function (a, b) { return b.g - a.g || b.p.overall - a.p.overall; }).slice(0, n || 10);
  }

  /* ---------- telas ---------- */
  function dateTxt(c, d) { try { return C().dateOf(c, d).short; } catch (e) { return "dia " + d; } }
  function leagueRow(c, lg) {
    var info = obsInfo(c, lg.id), nat = nationOf(lg);
    var kids = [];
    var lgo = null; try { lgo = TM.img.compImg("lg-" + lg.id, "wl-flag"); } catch (e) {}
    kids.push(lgo || (nat ? TM.img.nationImg(nat, "wl-flag") : el("span", { class: "wl-flag" })));
    var mid = el("div", { class: "wl-mid" }, [ el("div", { class: "wl-name", text: lg.name }), el("div", { class: "wl-sub", text: natPt(lg.nation) + " · " + lg.clubIds.length + " clubes" }) ]);
    if (info.status === "watching") mid.appendChild(el("div", { class: "wl-bar" }, [ el("i", { style: "width:" + info.pct + "%" }) ]));
    kids.push(mid);
    var act;
    if (info.status === "mine") act = TM.ui.button("🏆 Sua liga", function () { TM.ui.go("coach-comps"); }, "btn small ghost");
    else if (info.status === "done") act = TM.ui.button("📊 Acompanhar", function () { TM.ui.go("coach-world-league", { lid: lg.id }); }, "btn small primary");
    else if (info.status === "watching") act = el("span", { class: "wl-chip", text: "🔭 " + info.left + " dia" + (info.left > 1 ? "s" : "") });
    else act = TM.ui.button("🔭 Observar", function () { if (startObs(c, lg.id)) TM.ui.go("coach-world"); }, "btn small");
    kids.push(act);
    return el("div", { class: "wl-row" + (info.status === "done" ? " done" : info.status === "watching" ? " watching" : "") }, kids);
  }
  TM.ui.register("coach-world", function (screen) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    try { tick(c); } catch (e) {}
    screen.appendChild(TM.ui.topbar("🌍 Ligas do mundo", function () { TM.ui.go("coach-hub"); }));
    if (TM.coachUI && TM.coachUI.addBar) TM.coachUI.addBar(screen, "coach-world");
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    var w = watching(c), seen = Object.keys(st(c).seen).length;
    body.appendChild(el("div", { class: "wl-intro" }, [
      el("div", { class: "wl-intro-t", text: "Departamento de análise" }),
      el("div", { class: "wl-intro-s", text: "Para acompanhar uma liga você precisa observá-la primeiro: a observação dura " + OBS_DAYS + " dias e libera tabela, rodadas e artilheiros pelo resto da carreira. Até " + MAX_OBS + " observações ao mesmo tempo." }),
      el("div", { class: "wl-intro-k", text: "🔭 Observando: " + w.length + "/" + MAX_OBS + " · 📊 Ligas acompanhadas: " + seen })
    ]));
    var groups = {};
    allLeagues().forEach(function (lg) { var r = regionOf(lg.nation); (groups[r] = groups[r] || []).push(lg); });
    REGION_ORDER.concat(Object.keys(groups).filter(function (k) { return REGION_ORDER.indexOf(k) < 0; })).forEach(function (r) {
      if (!groups[r]) return;
      body.appendChild(el("h3", { class: "block-title", text: r }));
      groups[r].sort(function (a, b) { return natPt(a.nation).localeCompare(natPt(b.nation)) || a.name.localeCompare(b.name); }).forEach(function (lg) { body.appendChild(leagueRow(c, lg)); });
    });
  });

  TM.ui.register("coach-world-league", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    var lid = params && params.lid, lg = leagueOf(lid);
    if (!lg) { TM.ui.go("coach-world"); return; }
    if (isMine(c, lid)) { TM.ui.go("coach-comps"); return; }
    if (obsInfo(c, lid).status !== "done") { TM.ui.toast("Você ainda não observou essa liga."); TM.ui.go("coach-world"); return; }
    try { tick(c); } catch (e) {}
    var L = ensureLeague(c, lid); try { if (catchUp(c, lid)) save(c); } catch (e) {}
    var tab = (params && params.tab) || "table", nat = nationOf(lg);
    screen.appendChild(TM.ui.topbar(lg.name, function () { TM.ui.go("coach-world"); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    var lgBig = null; try { lgBig = TM.img.compImg("lg-" + lg.id, "wl-flag big"); } catch (e) {}
    body.appendChild(el("div", { class: "wl-head" }, [
      lgBig || (nat ? TM.img.nationImg(nat, "wl-flag big") : null),
      lgBig && nat ? TM.img.nationImg(nat, "wl-flag small") : null,
      el("div", { class: "wl-mid" }, [ el("div", { class: "wl-name", text: lg.name }), el("div", { class: "wl-sub", text: natPt(lg.nation) + " · " + lg.clubIds.length + " clubes · rodada " + Math.min(L.round, L.fixtures.length) + " de " + L.fixtures.length }) ])
    ]));
    if (L.championId) { var ch = TM.data.club(L.championId); if (ch) body.appendChild(el("div", { class: "champion-banner", text: "🏆 Campeão: " + ch.name })); }
    var tabs = [ ["table", "Tabela"], ["round", "Rodada"], ["scorers", "Artilheiros"] ];
    body.appendChild(el("div", { class: "comp-tabs" }, tabs.map(function (t) { return el("button", { class: "comp-tab" + (tab === t[0] ? " active" : ""), on: { click: function () { TM.ui.go("coach-world-league", { lid: lid, tab: t[0] }); } } }, [ el("span", { class: "ct-name", text: t[1] }) ]); })));
    if (tab === "table") {
      var table = el("table", { class: "league-table" }, [ el("thead", {}, [ el("tr", {}, ["#", "Clube", "P", "J", "V", "E", "D", "SG"].map(function (h, i) { return el("th", { class: i === 1 ? "lt-club" : "", text: h }); })) ]) ]);
      var tb = el("tbody");
      standings(L.table).forEach(function (row, i) {
        var club = TM.data.club(row.id); if (!club) return;
        tb.appendChild(el("tr", { class: "clickable", on: { click: function () { TM.ui.go("coach-club-info", { clubId: club.id, back: "coach-world" }); } } }, [
          el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.clubImg(club, "lt-crest"), el("span", { text: club.name }) ]),
          el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: row.w }), el("td", { text: row.d }), el("td", { text: row.l }),
          el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
        ]));
      });
      table.appendChild(tb);
      body.appendChild(el("div", { class: "table-wrap" }, [ table ]));
      if (!L.round) body.appendChild(el("p", { class: "setting-hint", text: "A 1ª rodada acontece em " + dateTxt(c, roundDay(L, 0)) + "." }));
      body.appendChild(el("p", { class: "setting-hint", text: "Toque num clube para ver elenco e informações." }));
    } else if (tab === "round") {
      function resRow(m) {
        var h = TM.data.club(m[0]), a = TM.data.club(m[1]); if (!h || !a) return null;
        return el("div", { class: "wl-res" }, [
          el("div", { class: "wl-team" }, [ TM.img.clubImg(h, "tie-crest"), el("span", { text: h.name }) ]),
          el("div", { class: "wl-score", text: m[2] != null ? m[2] + " - " + m[3] : "vs" }),
          el("div", { class: "wl-team away" }, [ el("span", { text: a.name }), TM.img.clubImg(a, "tie-crest") ])
        ]);
      }
      if (L.last && L.last.length) {
        body.appendChild(el("h3", { class: "block-title", text: "Rodada " + (L.lastRound + 1) + " · " + dateTxt(c, L.lastDay) }));
        L.last.forEach(function (m) { var r = resRow(m); if (r) body.appendChild(r); });
      } else body.appendChild(el("p", { class: "intro-text", text: "Nenhuma rodada disputada ainda." }));
      if (L.round < L.fixtures.length) {
        body.appendChild(el("h3", { class: "block-title", text: "Próxima rodada · " + dateTxt(c, roundDay(L, L.round)) }));
        L.fixtures[L.round].forEach(function (m) { var r = resRow([m[0], m[1]]); if (r) body.appendChild(r); });
      }
    } else {
      var sc = topScorers(L, 15);
      if (!sc.length) body.appendChild(el("p", { class: "intro-text", text: "Ainda não há gols registrados." }));
      sc.forEach(function (x, i) {
        var club = TM.data.club(x.p.clubId);
        body.appendChild(el("div", { class: "wl-scorer clickable", on: { click: function () { if (club) TM.ui.go("coach-club-info", { clubId: club.id, back: "coach-world" }); } } }, [
          el("span", { class: "wl-rank", text: i + 1 }),
          TM.img.playerImg(x.p, "wl-face"),
          el("div", { class: "wl-mid" }, [ el("div", { class: "wl-name", text: x.p.name }), el("div", { class: "wl-sub", text: (club ? club.name + " · " : "") + TM.data.posLabel(x.p) + " · " + x.p.overall + " OVR" }) ]),
          el("span", { class: "wl-goals", text: x.g + " ⚽" })
        ]));
      });
    }
  });

  TM.wl = { tick: tick, obsInfo: obsInfo, startObs: startObs, catchUp: catchUp, ensureLeague: ensureLeague, topScorers: topScorers, OBS_DAYS: OBS_DAYS, MAX_OBS: MAX_OBS };
})(window);
