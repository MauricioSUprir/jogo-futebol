/* ================= TOTAL MATCH — Torneios de pré-temporada =================
   No início de cada temporada (antes da 1ª rodada) chegam 3 convites de torneios internacionais
   (grupo de 4 clubes do mundo todo, 3 jogos). Aceite um (ou recuse todos): cota de participação
   garantida + prêmio pequeno para o campeão (e menor para o vice). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function money(c, v) { return C().fmtMoney(c, v); }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function R(n) { return Math.round(n * 100) / 100; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function save(c) { TM.storage.saveCoachCareer(c); }
  function note(c, n) { return TM.notify.push(c, n); }
  function season(c) { return c.season || 1; }

  // sedes e nomes (fictícios, mas com cara de torneio de verão de verdade)
  var HOSTS = [
    { city: "Miami", country: "Estados Unidos", flag: "🇺🇸" }, { city: "Orlando", country: "Estados Unidos", flag: "🇺🇸" }, { city: "Lisboa", country: "Portugal", flag: "🇵🇹" },
    { city: "Dubai", country: "Emirados Árabes", flag: "🇦🇪" }, { city: "Tóquio", country: "Japão", flag: "🇯🇵" }, { city: "Munique", country: "Alemanha", flag: "🇩🇪" },
    { city: "Amsterdã", country: "Holanda", flag: "🇳🇱" }, { city: "Montevidéu", country: "Uruguai", flag: "🇺🇾" }, { city: "Cidade do México", country: "México", flag: "🇲🇽" },
    { city: "Riade", country: "Arábia Saudita", flag: "🇸🇦" }, { city: "Singapura", country: "Singapura", flag: "🇸🇬" }, { city: "Los Angeles", country: "Estados Unidos", flag: "🇺🇸" },
    { city: "Barcelona", country: "Espanha", flag: "🇪🇸" }, { city: "Londres", country: "Inglaterra", flag: "🏴" }, { city: "Buenos Aires", country: "Argentina", flag: "🇦🇷" },
    { city: "Hong Kong", country: "China", flag: "🇭🇰" }, { city: "Marrakech", country: "Marrocos", flag: "🇲🇦" }, { city: "Sydney", country: "Austrália", flag: "🇦🇺" }
  ];
  var NAMES = ["Copa Internacional de {city}", "Troféu {city}", "{city} Summer Cup", "Torneio Internacional de {city}", "Challenge de {city}", "Copa das Nações de {city}", "Taça {city} de Verão", "{city} Champions Tour"];
  var TIERS = [
    { id: "regional", label: "Regional", desc: "Clubes de porte parecido ou menor. Prêmio modesto, viagem curta.", diff: [-9, -1], prizeMult: 0.6, icon: "🥉" },
    { id: "internacional", label: "Internacional", desc: "Clubes do mundo todo, do seu nível. Prêmio intermediário.", diff: [-4, 4], prizeMult: 1.0, icon: "🥈" },
    { id: "elite", label: "Elite", desc: "Gigantes convidados. Difícil de vencer, mas a cota e o prêmio são maiores.", diff: [1, 9], prizeMult: 1.7, icon: "🥇" }
  ];
  function prizeBase(c) { var r = TM.data.clubRating(c.teamId); return R((1.2 + Math.max(0, r - 60) * 0.18) * mult(c)); }

  function makeOffer(c, tier, used) {
    var myR = TM.data.clubRating(c.teamId), W = TM.data.world();
    var myLg = (TM.data.club(c.teamId) || {}).leagueId;
    var pool = W.clubs.filter(function (cl) {
      if (cl.id === c.teamId || used[cl.id]) return false;
      var r = TM.data.clubRating(cl.id); return r >= myR + tier.diff[0] && r <= myR + tier.diff[1] && TM.data.clubPlayers(cl.id).length >= 14;
    });
    // variedade: no máximo 1 clube da minha liga e, de preferência, países/regiões diferentes
    var opps = [], lgs = {}; pool.sort(function () { return Math.random() - 0.5; });
    pool.forEach(function (cl) {
      if (opps.length >= 3) return;
      if (cl.leagueId === myLg && opps.some(function (o) { return o.leagueId === myLg; })) return;
      if (lgs[cl.leagueId] && opps.length < 2) return;
      opps.push(cl); lgs[cl.leagueId] = 1; used[cl.id] = 1;
    });
    if (opps.length < 3) { pool.forEach(function (cl) { if (opps.length < 3 && opps.indexOf(cl) < 0) { opps.push(cl); used[cl.id] = 1; } }); }
    if (opps.length < 3) return null;
    var host = pick(HOSTS), base = prizeBase(c) * tier.prizeMult;
    return { id: "pre" + season(c) + tier.id, tier: tier.id, name: pick(NAMES).replace("{city}", host.city), host: host, oppIds: opps.map(function (o) { return o.id; }),
      fee: R(base * 0.35), prize: R(base), runnerUp: R(base * 0.3), avgR: Math.round(opps.reduce(function (s, o) { return s + TM.data.clubRating(o.id); }, 0) / 3) };
  }
  function tierOf(id) { return TIERS.filter(function (t) { return t.id === id; })[0] || TIERS[1]; }

  // início da temporada: antes da 1ª rodada chegam os 3 convites
  function tick(c) {
    if (!c || c.unemployed) return;
    if (c.preseason && !c.preseason.done && (c.matchNo || 0) > 0) { finishAuto(c); return; }   // a liga começou: encerra o que faltava
    if ((c.matchNo || 0) > 0) return;
    if (c.preOffers && c.preOffers.season === season(c)) return;
    if (c.preseason && c.preseason.season === season(c)) return;
    var used = {}; var list = TIERS.map(function (t) { return makeOffer(c, t, used); }).filter(Boolean);
    if (!list.length) return;
    c.preOffers = { season: season(c), list: list, decided: false };
    note(c, { icon: "🏖️", title: "Convites de pré-temporada", news: true, preseason: true, text: list.length + " torneios internacionais convidaram o " + TM.data.club(c.teamId).name + " para a pré-temporada (3 jogos, grupo de 4). Cota garantida e prêmio para o campeão. Responda antes da 1ª rodada." });
    save(c);
  }
  function accept(c, offerId) {
    var o = (c.preOffers && c.preOffers.list || []).filter(function (x) { return x.id === offerId; })[0]; if (!o) return false;
    var ids = [c.teamId].concat(o.oppIds);
    // grupo de 4: 3 rodadas, 2 jogos por rodada (round-robin)
    var rounds = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    c.preseason = { id: o.id, season: season(c), name: o.name, host: o.host, tier: o.tier, teamIds: ids, fee: o.fee, prize: o.prize, runnerUp: o.runnerUp,
      rounds: rounds.map(function (r) { return r.map(function (m) { return { a: ids[m[0]], b: ids[m[1]], score: null }; }); }), round: 0, done: false, place: null };
    c.preOffers.decided = true;
    c.budget = R(c.budget + o.fee); c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.prizeM = R((c.finc.prizeM || 0) + o.fee);
    note(c, { icon: "🏖️", title: "Pré-temporada confirmada", news: true, text: TM.data.club(c.teamId).name + " vai disputar o " + o.name + " (" + o.host.city + "). Cota de participação de " + money(c, o.fee) + " já no caixa. Campeão leva mais " + money(c, o.prize) + "." });
    try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: "🏖️", title: "Pré-temporada", text: TM.data.club(c.teamId).name + " confirmado no " + o.name + ", em " + o.host.city + "." }); } catch (e) {}
    save(c); return true;
  }
  function declineAll(c) { if (c.preOffers) c.preOffers.decided = true; note(c, { icon: "🏖️", title: "Sem pré-temporada", text: "Você recusou os convites. O elenco treina em casa até a 1ª rodada." }); save(c); }

  function myMatch(c) {
    var p = c.preseason; if (!p || p.done) return null;
    var r = p.rounds[p.round]; if (!r) return null;
    return r.filter(function (m) { return m.a === c.teamId || m.b === c.teamId; })[0] || null;
  }
  function otherMatch(c) { var r = c.preseason.rounds[c.preseason.round]; return r.filter(function (m) { return m.a !== c.teamId && m.b !== c.teamId; })[0]; }
  function simOther(c, m) {
    if (m.score) return;
    var res = TM.engine.simulate(C().anyTeam(c, m.a), C().anyTeam(c, m.b), { realism: TM.storage.settings().realism, neutral: true });
    m.score = res.score.slice();
  }
  // aplica o resultado do meu jogo da rodada, simula o outro e avança
  function applyRound(c, myScore) {
    var p = c.preseason, m = myMatch(c); if (!m) return;
    m.score = myScore.slice();
    simOther(c, otherMatch(c));
    p.round++;
    if (p.round >= p.rounds.length) finish(c);
    save(c);
  }
  function finishAuto(c) {
    var p = c.preseason;
    while (!p.done) { var m = myMatch(c); if (!m) break; simOther(c, m); simOther(c, otherMatch(c)); p.round++; if (p.round >= p.rounds.length) finish(c); }
    if (!p.done) { p.done = true; }
    note(c, { icon: "🏖️", title: "Pré-temporada encerrada", text: "Os jogos que faltavam do " + p.name + " foram disputados com o time reserva (a liga começou)." });
    save(c);
  }
  function table(c) {
    var p = c.preseason, rows = {};
    p.teamIds.forEach(function (id) { rows[id] = { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
    p.rounds.forEach(function (r) { r.forEach(function (m) {
      if (!m.score) return; var A = rows[m.a], B = rows[m.b]; A.p++; B.p++; A.gf += m.score[0]; A.ga += m.score[1]; B.gf += m.score[1]; B.ga += m.score[0];
      if (m.score[0] > m.score[1]) { A.w++; B.l++; A.pts += 3; } else if (m.score[0] < m.score[1]) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
    }); });
    return p.teamIds.map(function (id) { return rows[id]; }).sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf; });
  }
  function finish(c) {
    var p = c.preseason; p.done = true;
    var t = table(c), place = t.findIndex(function (r) { return r.id === c.teamId; }) + 1; p.place = place;
    var won = place === 1 ? p.prize : place === 2 ? p.runnerUp : 0;
    if (won) { c.budget = R(c.budget + won); c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.prizeM = R((c.finc.prizeM || 0) + won); }
    c.popularity = Math.max(3, Math.min(100, (c.popularity || 40) + (place === 1 ? 2 : place === 4 ? -1 : 0)));
    c.preHistory = c.preHistory || []; c.preHistory.push({ season: p.season, name: p.name, place: place, won: won });
    var champ = TM.data.club(t[0].id);
    note(c, { icon: place === 1 ? "🏆" : "🏖️", title: place === 1 ? "Campeão da pré-temporada!" : "Pré-temporada encerrada", news: true,
      text: (place === 1 ? TM.data.club(c.teamId).name + " conquistou o " + p.name + " e embolsou " + money(c, p.prize) + "." : place === 2 ? "Vice no " + p.name + ": " + money(c, p.runnerUp) + " de prêmio. Campeão: " + champ.name + "." : TM.data.club(c.teamId).name + " terminou em " + place + "º no " + p.name + ". Campeão: " + champ.name + ".") + " Agora é foco na temporada." });
    try { if (TM.social && TM.social.marketPost && place === 1) TM.social.marketPost(c, { icon: "🏆", title: "Pré-temporada", text: TM.data.club(c.teamId).name + " é campeão do " + p.name + "!" }); } catch (e) {}
  }

  /* ---------- cartão no hub ---------- */
  function card(c) {
    var po = c.preOffers;
    if (po && po.season === season(c) && !po.decided && (c.matchNo || 0) === 0) {
      return el("div", { class: "next-match pre-card" }, [
        el("div", { class: "nm-label", text: "🏖️ Convites de pré-temporada" }),
        el("div", { class: "setting-hint", text: po.list.length + " torneios internacionais te convidaram. Escolha um antes da 1ª rodada (ou recuse todos)." }),
        el("div", { class: "actions" }, [ TM.ui.button("Ver os torneios", function () { TM.ui.go("coach-preseason"); }, "btn primary") ])
      ]);
    }
    var p = c.preseason; if (!p || p.done || p.season !== season(c)) return null;
    var m = myMatch(c); if (!m) return null;
    var oppId = m.a === c.teamId ? m.b : m.a, opp = TM.data.club(oppId);
    return el("div", { class: "next-match pre-card" }, [
      el("div", { class: "nm-label", text: "🏖️ " + p.name + " · " + p.host.flag + " " + p.host.city + " · jogo " + (p.round + 1) + "/3" }),
      el("div", { class: "pre-vs" }, [ TM.img.clubImg(TM.data.club(c.teamId), "pre-crest"), el("span", { class: "pre-x", text: "×" }), TM.img.clubImg(opp, "pre-crest"), el("span", { class: "pre-opp", text: opp.name + " (" + TM.data.clubRating(opp.id) + ")" }) ]),
      el("div", { class: "actions" }, [
        TM.ui.button("▶ Jogar amistoso", function () { TM.ui.go("coach-preseason-match"); }, "btn primary"),
        TM.ui.button("📊 Tabela", function () { TM.ui.go("coach-preseason"); }, "btn ghost small")
      ])
    ]);
  }

  /* ---------- tela: convites / tabela ---------- */
  TM.ui.register("coach-preseason", function (screen) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    screen.appendChild(TM.ui.topbar("🏖️ Pré-temporada", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    var p = c.preseason, po = c.preOffers;
    if (p && p.season === season(c)) {
      body.appendChild(el("div", { class: "saf-hero" }, [ el("div", { class: "saf-hero-name", text: p.name }), el("div", { class: "saf-text", text: p.host.flag + " " + p.host.city + ", " + p.host.country + " · " + tierOf(p.tier).label + " · cota " + money(c, p.fee) + " · campeão " + money(c, p.prize) + " · vice " + money(c, p.runnerUp) + (p.done ? " · encerrado — " + (p.place === 1 ? "🏆 campeão!" : p.place + "º lugar") : "") }) ]));
      body.appendChild(el("div", { class: "list-head", text: "Classificação" }));
      var tb = el("table", { class: "table pre-table" }); tb.appendChild(el("tr", {}, [ el("th", { text: "#" }), el("th", { text: "Clube" }), el("th", { text: "J" }), el("th", { text: "V" }), el("th", { text: "E" }), el("th", { text: "D" }), el("th", { text: "SG" }), el("th", { text: "P" }) ]));
      table(c).forEach(function (r, i) { var cl = TM.data.club(r.id); tb.appendChild(el("tr", { class: r.id === c.teamId ? "mine" : "" }, [ el("td", { text: String(i + 1) }), el("td", {}, [ TM.img.clubImg(cl, "tbl-crest"), el("span", { text: " " + cl.name }) ]), el("td", { text: r.p }), el("td", { text: r.w }), el("td", { text: r.d }), el("td", { text: r.l }), el("td", { text: (r.gf - r.ga) }), el("td", { text: r.pts }) ])); });
      body.appendChild(tb);
      body.appendChild(el("div", { class: "list-head", text: "Jogos" }));
      p.rounds.forEach(function (r, ri) { r.forEach(function (m) {
        var A = TM.data.club(m.a), B = TM.data.club(m.b);
        body.appendChild(el("div", { class: "pre-fix" + ((m.a === c.teamId || m.b === c.teamId) ? " mine" : "") }, [ el("span", { class: "pre-fix-r", text: "R" + (ri + 1) }), el("span", { text: A.name }), el("span", { class: "pre-fix-s", text: m.score ? m.score[0] + " × " + m.score[1] : "×" }), el("span", { text: B.name }) ]));
      }); });
      if (!p.done && myMatch(c)) body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("▶ Jogar próximo amistoso", function () { TM.ui.go("coach-preseason-match"); }, "btn primary") ]));
      return;
    }
    if (!po || po.season !== season(c) || po.decided || (c.matchNo || 0) > 0) {
      body.appendChild(el("p", { class: "intro-text", text: "Nenhum convite pendente. Os torneios de pré-temporada chegam no início de cada temporada, antes da 1ª rodada." }));
      if (c.preHistory && c.preHistory.length) { body.appendChild(el("div", { class: "list-head", text: "Histórico" })); c.preHistory.slice().reverse().forEach(function (h) { body.appendChild(el("div", { class: "pre-fix" }, [ el("span", { class: "pre-fix-r", text: "T" + h.season }), el("span", { text: h.name }), el("span", { class: "pre-fix-s", text: h.place === 1 ? "🏆" : h.place + "º" }), el("span", { text: h.won ? money(c, h.won) : "—" }) ])); }); }
      return;
    }
    body.appendChild(el("p", { class: "intro-text", text: "Três torneios internacionais te convidaram. Grupo de 4 clubes, 3 jogos em campo neutro, antes da 1ª rodada. A cota de participação entra no caixa na hora; o prêmio vai para o campeão (e uma parte para o vice)." }));
    po.list.forEach(function (o) {
      var t = tierOf(o.tier);
      var box = el("div", { class: "pre-opt" }, [
        el("div", { class: "pre-opt-h" }, [ el("span", { class: "pre-opt-ic", text: t.icon }), el("div", {}, [ el("div", { class: "pre-opt-name", text: o.name }), el("div", { class: "pre-opt-sub", text: o.host.flag + " " + o.host.city + ", " + o.host.country + " · " + t.label + " · média OVR " + o.avgR }) ]) ]),
        el("div", { class: "setting-hint", text: t.desc }),
        el("div", { class: "pre-opp-row" }, o.oppIds.map(function (id) { var cl = TM.data.club(id); return el("div", { class: "pre-opp-tile" }, [ TM.img.clubImg(cl, "pre-crest"), el("div", { class: "pre-opp-n", text: cl.name }), el("div", { class: "pre-opp-r", text: "OVR " + TM.data.clubRating(id) + " · " + ((TM.data.league(cl.leagueId) || {}).nation || "") }) ]); })),
        el("div", { class: "pre-money" }, [ el("span", { text: "Cota: " + money(c, o.fee) }), el("span", { text: "Campeão: +" + money(c, o.prize) }), el("span", { text: "Vice: +" + money(c, o.runnerUp) }) ]),
        el("div", { class: "actions" }, [ TM.ui.button("✅ Aceitar " + o.name, function () { TM.ui.confirm("Aceitar o convite?", o.name + " em " + o.host.city + ": 3 jogos antes da 1ª rodada. Cota de " + money(c, o.fee) + " garantida.", "Aceitar", function () { accept(c, o.id); TM.ui.go("coach-preseason"); }); }, "btn primary") ])
      ]);
      body.appendChild(box);
    });
    body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("Recusar todos", function () { TM.ui.confirm("Recusar os convites?", "Sem pré-temporada nesta temporada.", "Recusar", function () { declineAll(c); TM.ui.go("coach-hub"); }, true); }, "btn ghost") ]));
  });

  /* ---------- tela: jogo da pré-temporada ---------- */
  TM.ui.register("coach-preseason-match", function (screen) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    var m = myMatch(c); if (!m) { TM.ui.go("coach-preseason"); return; }
    var home = m.a === c.teamId, oppId = home ? m.b : m.a;
    var teamA = C().anyTeam(c, home ? c.teamId : oppId), teamB = C().anyTeam(c, home ? oppId : c.teamId);
    var userSide = home ? 0 : 1;
    var simOpts = { realism: TM.storage.settings().realism, neutral: true, tacticSide: userSide, tactic: c.tactic, userSide: userSide, difficulty: TM.storage.settings().difficulty };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: "🏖️ " + c.preseason.name + " · jogo " + (c.preseason.round + 1) + "/3", pauseSide: userSide, simOpts: simOpts, formation: c.lineup && c.lineup.formation,
      onBack: function () { TM.ui.go("coach-hub"); },
      onDone: function () {
        var cc = TM.storage.coachCareer();
        applyRound(cc, result.score.slice());   // teamA é sempre o mandante do confronto (m.a)
        TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result, back: "coach-preseason" });
      }
    });
  });

  TM.pre = { tick: tick, card: card, accept: accept, declineAll: declineAll, applyRound: applyRound, table: table, myMatch: myMatch, TIERS: TIERS };
})(window);
