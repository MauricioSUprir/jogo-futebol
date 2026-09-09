/* ================= TOTAL MATCH — Olheiros (scouting) ================= */
/* Contrate olheiros, mande em missões por região/liga/posição e receba relatórios
   com recomendações — jogadores descobertos ganham selo no Mercado e na Central. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function money(c, v) { return C().fmtMoney(c, v); }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var REGIONS = {
    br: { label: "Brasil", leagues: ["br", "br2", "br3"], names: ["Carlos Alberto Prado", "Márcio Bittencourt", "Renato Vasques", "Júlio Sena", "Edmilson Farias", "Wagner Louzada"] },
    sa: { label: "América do Sul", leagues: ["ar", "uy", "py", "co", "ec"], names: ["Gustavo Ferraro", "Diego Latorre", "Néstor Aguirre", "Sebastián Quiroga", "Álvaro Recoba", "Mauricio Pellegrino"] },
    eu: { label: "Europa (5 grandes)", leagues: ["en", "es", "it", "de", "fr"], names: ["Piero Ausilio", "Marc Overmars", "Ralf Bergmann", "Michel Tessier", "Iñaki Zubizarreta", "Steve Rowley"] },
    eu2: { label: "Europa (outras ligas)", leagues: ["pt", "nl", "be", "ch", "tr", "ru", "rus", "en2", "es2", "it2", "fr2", "de2"], names: ["Luís Campos", "Sven Mislintat", "Tiago Pinto", "Kees Vos", "Dirk Baumann", "Mehmet Yıldırım"] },
    na: { label: "América do Norte", leagues: ["us", "mx"], names: ["Claudio Reyna", "Rafael Ortega", "Kevin Payne", "Hugo Sánchez Jr.", "Brian McBride"] },
    asia: { label: "Ásia & Oriente Médio", leagues: ["sa", "jp"], names: ["Hiroshi Kagawa", "Faisal Al-Dossari", "Kenji Morita", "Tarek Al-Hamad"] },
    af: { label: "África", leagues: ["ma"], names: ["Youssef Benali", "Kwame Osei", "Rachid Amrani", "Samuel Eto'o Jr."] }
  };
  var REGION_ORDER = ["br", "sa", "eu", "eu2", "na", "asia", "af"];
  function regionOfLeague(lg) { for (var r in REGIONS) if (REGIONS[r].leagues.indexOf(lg) >= 0) return r; return "eu2"; }
  var DUR = { 3: "Rápida (3 jogos)", 6: "Padrão (6 jogos)", 10: "Profunda (10 jogos)" };
  var POS_LBL = { "": "qualquer posição", GK: "goleiros", DF: "defensores", MF: "meio-campistas", FW: "atacantes" };

  function hireFeeEur(stars) { return [0.3, 0.6, 1.2, 2.2, 3.5][stars - 1] || 1; }
  function fee(c, stars) { return Math.round(hireFeeEur(stars) * mult(c) * 10) / 10; }
  function salary(c, stars) { return Math.round(hireFeeEur(stars) * 0.8 * mult(c) * 10) / 10; }
  function missionCost(c, stars, dur) { return Math.round((0.15 + 0.05 * stars) * (dur / 3) * mult(c) * 10) / 10; }

  function ensure(c) {
    if (!c.scouts) c.scouts = [];
    if (!c.scoutReports) c.scoutReports = [];
    if (!c.scoutCands || c.scoutCands.season !== (c.season || 1)) c.scoutCands = { season: c.season || 1, list: genCandidates(c) };
    return c;
  }
  function genCandidates(c) {
    var out = [], used = {};
    for (var i = 0; i < 6; i++) {
      var r = REGION_ORDER[(i + (c.season || 1)) % REGION_ORDER.length];
      var nm = pick(REGIONS[r].names); if (used[nm]) continue; used[nm] = 1;
      var stars = Math.max(2, Math.min(5, rnd(2, 5)));
      out.push({ id: "sc" + Date.now().toString(36) + i, name: nm, region: r, stars: stars, age: rnd(34, 62) });
    }
    return out;
  }
  function seasonTick(c) {
    ensure(c);
    var tot = 0; c.scouts.forEach(function (s) { tot += salary(c, s.stars); });
    if (tot) { c.budget -= tot; TM.notify.push(c, { icon: "🔭", title: "Salários dos olheiros", text: "Pagos " + money(c, tot) + " em salários da equipe de olheiros nesta temporada." }); }
    c.scoutCands = { season: c.season || 1, list: genCandidates(c) };
  }

  /* ---------- missões ---------- */
  function poolFor(c, m) {
    var W = TM.data.world(), lgs = m.league ? [m.league] : (REGIONS[m.region] || REGIONS.eu).leagues;
    var lgSet = {}; lgs.forEach(function (l) { lgSet[l] = 1; });
    var mine = {}; (c.roster || []).forEach(function (id) { mine[id] = 1; });
    var out = [];
    Object.keys(W.playersById).forEach(function (id) {
      var p = W.playersById[id]; if (!p || mine[id] || p.freeAgent || !p.clubId || p.clubId === "free") return;
      var cl = TM.data.club(p.clubId); if (!cl || !lgSet[cl.leagueId]) return;
      if (m.pos && p.pos !== m.pos) return;
      if (m.ageMax && p.age > m.ageMax) return;
      out.push(p);
    });
    return out;
  }
  var NOTES = {
    gem: ["Joia escondida: potencial muito acima do que o mercado enxerga.", "Vale cada centavo — pode dobrar de valor em duas temporadas.", "Pouca exposição, muito talento. Recomendo agir antes que os grandes apareçam."],
    star: ["Titular imediato no nosso time. Diferença de nível clara.", "Decide jogos sozinho. Investimento alto, retorno garantido.", "Pronto para o nível mais alto. Negociação vai ser dura."],
    solid: ["Jogador confiável, regular, sem grandes oscilações.", "Encaixa no elenco como reserva de luxo.", "Custo-benefício bom para a posição."],
    young: ["Muito jovem, ainda cru, mas o teto é altíssimo.", "Ganharia com minutos: hoje reserva, em dois anos titular.", "Físico e técnica acima da idade. Acompanhar de perto."],
    vet: ["Experiente, ideal para dar liderança ao vestiário.", "Passou do auge, mas ainda entrega em jogos grandes.", "Contrato curto e salário razoável: solução imediata."]
  };
  function noteFor(p, stars) {
    var pot = p.potential || p.overall, gap = pot - p.overall;
    var k = p.age <= 21 && gap >= 6 ? "young" : gap >= 5 && stars >= 4 ? "gem" : p.overall >= 82 ? "star" : p.age >= 31 ? "vet" : "solid";
    return pick(NOTES[k]);
  }
  function finishMission(c, s) {
    var m = s.mission, pool = poolFor(c, m), myR = TM.data.clubRating(c.teamId);
    if (!pool.length) { TM.notify.push(c, { icon: "🔭", title: "Missão sem resultados", text: s.name + " não encontrou jogadores com esse perfil." }); s.mission = null; return; }
    var n = 4 + Math.round(m.dur / 3) + s.stars;
    var noise = Math.max(0.5, 3.5 - s.stars * 0.6);
    var scored = pool.map(function (p) {
      var pot = p.potential || p.overall, val = TM.data.marketValue(p);
      var sc = pot * 0.55 + p.overall * 0.45 + (pot - p.overall) * 0.6 + (Math.random() - 0.5) * noise * 2;
      if (p.overall >= myR - 4) sc += 2;                 // útil para o nosso nível
      if (val <= (c.budget || 0)) sc += 1.5;             // cabe no orçamento
      if (m.dur >= 10 && pot - p.overall >= 8) sc += 2;  // missão profunda acha joias
      return { p: p, sc: sc };
    }).sort(function (a, b) { return b.sc - a.sc; });
    var picked = [], clubsUsed = {};
    for (var i = 0; i < scored.length && picked.length < n; i++) {
      var p = scored[i].p, cnt = clubsUsed[p.clubId] || 0; if (cnt >= 2) continue; clubsUsed[p.clubId] = cnt + 1;
      var stars = Math.max(1, Math.min(5, Math.round(((p.potential || p.overall) - myR + 6) / 3)));
      picked.push({ pid: p.id, stars: stars, note: noteFor(p, stars) });
    }
    var rep = { id: "rp" + Date.now().toString(36), season: c.season || 1, day: c.currentDay || 0, scout: s.name, scoutStars: s.stars, region: m.region, league: m.league || "", pos: m.pos || "", ageMax: m.ageMax, dur: m.dur, players: picked, seen: false };
    c.scoutReports.unshift(rep); if (c.scoutReports.length > 15) c.scoutReports = c.scoutReports.slice(0, 15);
    c.scouted = c.scouted || {}; picked.forEach(function (x) { c.scouted[x.pid] = rep.id; });
    s.mission = null; s.done = (s.done || 0) + 1;
    TM.notify.push(c, { icon: "🔭", title: "Relatório de olheiro", news: true, text: s.name + " voltou de " + missionLabel(rep) + " com " + picked.length + " indicação(ões). Veja em Olheiros." });
  }
  function missionLabel(m) { return (m.league ? (TM.data.league(m.league) || {}).name : (REGIONS[m.region] || {}).label) + " · " + POS_LBL[m.pos || ""] + (m.ageMax && m.ageMax < 40 ? " até " + m.ageMax + " anos" : ""); }
  // chamado após cada jogo do usuário
  function tick(c) {
    ensure(c);
    c.scouts.forEach(function (s) { if (s.mission) { s.mission.left--; if (s.mission.left <= 0) finishMission(c, s); } });
  }
  function isScouted(c, pid) { return !!(c && c.scouted && c.scouted[pid]); }
  function stars(n) { var s = ""; for (var i = 0; i < 5; i++) s += i < n ? "★" : "☆"; return s; }

  /* ================= TELA: OLHEIROS ================= */
  TM.ui.register("coach-scouting", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; } ensure(c);
    var back = (params && params.from) || "coach-hub";
    screen.appendChild(TM.ui.topbar("🔭 Olheiros", function () { TM.ui.go(back); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    body.appendChild(el("div", { class: "market-budget", text: "💰 Caixa: " + money(c, c.budget) + " · " + c.scouts.length + "/3 olheiros" }));

    // equipe atual
    body.appendChild(el("h3", { class: "section-title", text: "🧑‍💼 Minha equipe de olheiros" }));
    if (!c.scouts.length) body.appendChild(el("p", { class: "intro-text", text: "Você ainda não tem olheiros. Contrate abaixo e mande em missões: eles voltam com relatórios de jogadores que encaixam no seu perfil." }));
    c.scouts.forEach(function (s) {
      var card = el("div", { class: "scout-card" });
      card.appendChild(el("div", { class: "sc-head" }, [
        el("div", { class: "sc-ava", text: "🧑‍💼" }),
        el("div", { class: "sc-info" }, [
          el("div", { class: "sc-name", text: s.name }),
          el("div", { class: "sc-sub", text: stars(s.stars) + " · " + REGIONS[s.region].label + " · " + s.age + " anos · " + money(c, salary(c, s.stars)) + "/temp" })
        ])
      ]));
      if (s.mission) {
        var m = s.mission, pct = Math.round(((m.dur - m.left) / m.dur) * 100);
        card.appendChild(el("div", { class: "sc-mission" }, [
          el("div", { class: "sc-mtx", text: "🚌 Em missão: " + missionLabel(m) + " — volta em " + m.left + " jogo(s)" }),
          el("div", { class: "sc-bar" }, [ el("div", { class: "sc-fill", style: "width:" + pct + "%" }) ])
        ]));
      } else {
        card.appendChild(el("div", { class: "sc-mtx muted", text: "Disponível" + (s.done ? " · " + s.done + " missão(ões) concluída(s)" : "") }));
      }
      card.appendChild(el("div", { class: "note-actions" }, [
        (s.mission && TM.coins) ? TM.ui.button("⚡ Entregar agora (" + TM.coins.COST.scoutRush + " 🪙)", function () {
          TM.coins.pay(TM.coins.COST.scoutRush, "Missão de olheiro acelerada", function () { finishMission(c, s); TM.storage.saveCoachCareer(c); TM.ui.toast("Relatório entregue! 📋"); TM.ui.go("coach-scouting", { from: back }); });
        }, "btn primary small") : null,
        s.mission ? TM.ui.button("Cancelar missão", function () { s.mission = null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-scouting", { from: back }); }, "btn ghost small")
                  : TM.ui.button("🧭 Nova missão", function () { TM.ui.go("coach-scout-mission", { sid: s.id, from: back }); }, "btn primary small"),
        TM.ui.button("Dispensar", function () { TM.ui.confirm("Dispensar " + s.name + "?", "Sem multa. Os relatórios ficam guardados.", "Dispensar", function () { c.scouts = c.scouts.filter(function (x) { return x.id !== s.id; }); TM.storage.saveCoachCareer(c); TM.ui.go("coach-scouting", { from: back }); }, true); }, "btn ghost small")
      ].filter(Boolean)));
      body.appendChild(card);
    });

    // contratar
    if (c.scouts.length < 3) {
      body.appendChild(el("h3", { class: "section-title", text: "📋 Olheiros disponíveis nesta temporada" }));
      body.appendChild(el("div", { class: "setting-hint", text: "Mais estrelas = relatórios mais precisos, mais indicações e mais chance de achar joias. Salário pago por temporada." }));
      c.scoutCands.list.filter(function (k) { return !c.scouts.some(function (s) { return s.id === k.id; }); }).forEach(function (k) {
        var f = fee(c, k.stars), afford = c.budget >= f;
        body.appendChild(el("div", { class: "scout-card cand" }, [
          el("div", { class: "sc-head" }, [
            el("div", { class: "sc-ava", text: "🕵️" }),
            el("div", { class: "sc-info" }, [ el("div", { class: "sc-name", text: k.name }), el("div", { class: "sc-sub", text: stars(k.stars) + " · especialista em " + REGIONS[k.region].label + " · " + k.age + " anos" }) ]),
            el("div", { class: "sc-fee", text: money(c, f) })
          ]),
          el("div", { class: "note-actions" }, [ TM.ui.button(afford ? "Contratar (" + money(c, f) + " + " + money(c, salary(c, k.stars)) + "/temp)" : "Caixa insuficiente", function () {
            if (!afford) { TM.ui.toast("Caixa insuficiente."); return; }
            c.budget -= f; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + f;
            c.scouts.push({ id: k.id, name: k.name, region: k.region, stars: k.stars, age: k.age, mission: null, done: 0 });
            TM.notify.push(c, { icon: "🔭", title: "Olheiro contratado", text: k.name + " (" + stars(k.stars) + ") entrou para a equipe. Mande-o em uma missão." });
            TM.storage.saveCoachCareer(c); TM.ui.toast("Olheiro contratado!"); TM.ui.go("coach-scouting", { from: back });
          }, "btn " + (afford ? "primary" : "ghost") + " small") ])
        ]));
      });
    }

    // relatórios
    body.appendChild(el("h3", { class: "section-title", text: "📑 Relatórios" }));
    if (!c.scoutReports.length) body.appendChild(el("p", { class: "intro-text", text: "Nenhum relatório ainda. Os olheiros entregam o relatório ao fim da missão." }));
    c.scoutReports.forEach(function (r) {
      var row = el("button", { class: "scout-report" + (r.seen ? "" : " new"), on: { click: function () { TM.ui.go("coach-scout-report", { id: r.id, from: back }); } } }, [
        el("div", { class: "sr-title", text: (r.seen ? "📄 " : "🆕 ") + missionLabel(r) }),
        el("div", { class: "sr-sub", text: r.scout + " · " + stars(r.scoutStars) + " · " + r.players.length + " indicação(ões) · temp. " + r.season })
      ]);
      body.appendChild(row);
    });
  });

  /* ================= TELA: NOVA MISSÃO ================= */
  TM.ui.register("coach-scout-mission", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; } ensure(c);
    var back = (params && params.from) || "coach-hub";
    var s = c.scouts.filter(function (x) { return x.id === (params && params.sid); })[0];
    if (!s) { TM.ui.go("coach-scouting", { from: back }); return; }
    screen.appendChild(TM.ui.topbar("🧭 Missão de " + s.name, function () { TM.ui.go("coach-scouting", { from: back }); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    var m = { region: s.region, league: "", pos: "", ageMax: 40, dur: 6 };
    body.appendChild(el("div", { class: "setting-hint", text: "Fora da especialidade (" + REGIONS[s.region].label + ") o olheiro rende um pouco menos. Missões profundas acham mais joias." }));

    var regSel = el("select", { class: "select" });
    REGION_ORDER.forEach(function (r) { regSel.appendChild(el("option", { value: r, text: REGIONS[r].label + (r === s.region ? " (especialidade)" : ""), selected: r === m.region })); });
    var lgSel = el("select", { class: "select" });
    function fillLeagues() {
      TM.ui.clear(lgSel); lgSel.appendChild(el("option", { value: "", text: "Toda a região" }));
      REGIONS[m.region].leagues.forEach(function (l) { var L = TM.data.league(l); if (L) lgSel.appendChild(el("option", { value: l, text: L.name })); });
    }
    regSel.addEventListener("change", function () { m.region = regSel.value; m.league = ""; fillLeagues(); upd(); });
    lgSel.addEventListener("change", function () { m.league = lgSel.value; upd(); });
    fillLeagues();
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Região" }), regSel ]));
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Liga (opcional)" }), lgSel ]));

    var posRow = el("div", { class: "segmented full" });
    [["", "Todas"], ["GK", "GOL"], ["DF", "DEF"], ["MF", "MEI"], ["FW", "ATA"]].forEach(function (o) {
      posRow.appendChild(el("button", { class: "seg-btn" + (m.pos === o[0] ? " active" : ""), text: o[1], on: { click: function () { m.pos = o[0]; posRow.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); this.classList.add("active"); upd(); } } }));
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Posição" }), posRow ]));

    var ageVal = el("span", { class: "range-val", text: "até 40 anos" });
    var ageInp = el("input", { type: "range", min: 17, max: 40, value: 40, class: "slider" });
    ageInp.addEventListener("input", function () { m.ageMax = parseInt(ageInp.value, 10); ageVal.textContent = m.ageMax >= 40 ? "qualquer idade" : "até " + m.ageMax + " anos"; upd(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode("Idade máxima "), ageVal ]), ageInp ]));

    var durRow = el("div", { class: "segmented full" });
    [3, 6, 10].forEach(function (d) {
      durRow.appendChild(el("button", { class: "seg-btn" + (m.dur === d ? " active" : ""), text: DUR[d], on: { click: function () { m.dur = d; durRow.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); this.classList.add("active"); upd(); } } }));
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Duração" }), durRow ]));

    var summary = el("div", { class: "market-budget" }); body.appendChild(summary);
    function upd() { var n = poolFor(c, m).length; summary.textContent = "🔎 " + n + " jogador(es) no radar · custo da missão " + money(c, missionCost(c, s.stars, m.dur)); }
    upd();
    body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("🚌 Enviar olheiro", function () {
      var cost = missionCost(c, s.stars, m.dur);
      if (c.budget < cost) { TM.ui.toast("Caixa insuficiente para a missão."); return; }
      c.budget -= cost; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + cost;
      s.mission = { region: m.region, league: m.league, pos: m.pos, ageMax: m.ageMax, dur: m.dur, left: m.dur };
      TM.notify.push(c, { icon: "🚌", title: "Olheiro em missão", text: s.name + " viajou para " + missionLabel(s.mission) + ". Relatório em " + m.dur + " jogos." });
      TM.storage.saveCoachCareer(c); TM.ui.toast("Missão iniciada!"); TM.ui.go("coach-scouting", { from: back });
    }, "btn primary") ]));
  });

  /* ================= TELA: RELATÓRIO ================= */
  TM.ui.register("coach-scout-report", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; } ensure(c);
    var back = (params && params.from) || "coach-hub";
    var r = c.scoutReports.filter(function (x) { return x.id === (params && params.id); })[0];
    if (!r) { TM.ui.go("coach-scouting", { from: back }); return; }
    r.seen = true; TM.storage.saveCoachCareer(c);
    screen.appendChild(TM.ui.topbar("📑 Relatório", function () { TM.ui.go("coach-scouting", { from: back }); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "🔭 " + r.scout + " (" + stars(r.scoutStars) + ") — " + missionLabel(r) }),
      el("div", { class: "setting-hint", text: "Estrelas = quanto o jogador agrega ao seu elenco hoje/no futuro. Toque para negociar; ☆ manda para a Central de transferências." })
    ]));
    c.shortlist = c.shortlist || [];
    r.players.forEach(function (x) {
      var p = TM.data.player(x.pid); if (!p || (c.roster || []).indexOf(p.id) >= 0) return;
      var row = TM.ui.playerRow(p, { showClub: true }); row.classList.add("clickable");
      var inl = c.shortlist.indexOf(p.id) >= 0;
      var star = el("button", { class: "shortlist-star" + (inl ? " on" : ""), text: inl ? "★" : "☆", on: { click: function (e) {
        e.stopPropagation(); var i = c.shortlist.indexOf(p.id); if (i >= 0) c.shortlist.splice(i, 1); else c.shortlist.push(p.id); TM.storage.saveCoachCareer(c);
        var on = c.shortlist.indexOf(p.id) >= 0; star.classList.toggle("on", on); star.textContent = on ? "★" : "☆"; TM.ui.toast(on ? "⭐ Na Central de transferências" : "Removido da Central");
      } } });
      row.appendChild(star);
      row.appendChild(el("div", { class: "price-tag" }, [ el("span", { text: money(c, TM.data.marketValue(p) * mult(c)) }), el("span", { class: "price-note", text: "valor" }) ]));
      row.addEventListener("click", function () { TM.ui.go("coach-nego-club", { pid: p.id }); });
      body.appendChild(el("div", { class: "scout-pick" }, [ row, el("div", { class: "sp-note" }, [ el("span", { class: "sp-stars", text: stars(x.stars) }), el("span", { text: " " + x.note }) ]) ]));
    });
  });

  TM.scouting = { ensure: ensure, tick: tick, seasonTick: seasonTick, isScouted: isScouted, REGIONS: REGIONS, REGION_ORDER: REGION_ORDER, regionOfLeague: regionOfLeague };
})(window);
