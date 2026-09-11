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
    // olheiros da BASE (garotos de 15 a 19 anos para as categorias de base)
    if (!c.yscouts) c.yscouts = [];
    if (!c.yscoutReports) c.yscoutReports = [];
    if (!c.yscoutCands || c.yscoutCands.season !== (c.season || 1)) c.yscoutCands = { season: c.season || 1, list: genCandidates(c, true) };
    return c;
  }
  var YNAMES = ["Zé Roberto Lima", "Ademir Fonseca", "Toninho Cerezo Jr.", "Paulo Autuori Neto", "Ricardo Gomes", "Sérgio Manoel", "Marcelo Veiga", "Jorge Sampaoli Jr.", "Oscar Tabárez Neto", "Juan Román Vidal", "Pep Segura", "Albert Capellas", "Jan Olde Riekerink", "Ernst Middendorp", "Tom Saintfiet", "Kenta Hasegawa"];
  function genCandidates(c, youth) {
    var out = [], used = {};
    for (var i = 0; i < 6; i++) {
      var r = REGION_ORDER[(i + (c.season || 1) + (youth ? 3 : 0)) % REGION_ORDER.length];
      var nm = youth ? pick(YNAMES) : pick(REGIONS[r].names); if (used[nm]) continue; used[nm] = 1;
      var stars = Math.max(2, Math.min(5, rnd(2, 5)));
      out.push({ id: (youth ? "ysc" : "sc") + Date.now().toString(36) + i, name: nm, region: r, stars: stars, age: rnd(34, 62), kind: youth ? "youth" : "pro" });
    }
    return out;
  }
  function seasonTick(c) {
    ensure(c);
    var tot = 0; c.scouts.forEach(function (s) { tot += salary(c, s.stars); }); c.yscouts.forEach(function (s) { tot += salary(c, s.stars) * 0.6; });
    tot = Math.round(tot * 100) / 100;
    if (tot) { c.budget -= tot; TM.notify.push(c, { icon: "🔭", title: "Salários dos olheiros", text: "Pagos " + money(c, tot) + " em salários da equipe de olheiros (profissional e base) nesta temporada." }); }
    c.scoutCands = { season: c.season || 1, list: genCandidates(c) };
    c.yscoutCands = { season: c.season || 1, list: genCandidates(c, true) };
  }

  /* ---------- olheiros da base: geram garotos (15-19) de uma região para você contratar para a base ---------- */
  function genProspect(c, m, s) {
    var lgs = m.league ? [m.league] : (REGIONS[m.region] || REGIONS.br).leagues;
    var lg = pick(lgs), L = TM.data.league(lg);
    var culture = TM.data.cultureOfLeague(lg);
    var nat = (L && TM.data.nationByName(L.nation)) || TM.data.world().nations[0];
    var pos = m.pos || pick(["GK", "DF", "DF", "MF", "MF", "FW"]);
    var age = m.dur >= 10 ? rnd(15, 18) : rnd(16, 19);
    var ov = 44 + rnd(0, 12) + s.stars + (age - 15);
    var jewel = Math.random() < 0.05 * s.stars + (m.dur >= 10 ? 0.06 : 0);
    var pot = jewel ? Math.min(92, ov + 16 + rnd(0, 12)) : Math.min(80, ov + 4 + rnd(0, 12));
    var est = Math.max(1, Math.min(5, Math.round((pot - 58) / 6)));       // estrelas = estimativa do olheiro (com ruído)
    if (s.stars <= 3 && Math.random() < 0.35) est = Math.max(1, Math.min(5, est + (Math.random() < 0.5 ? -1 : 1)));
    var cost = Math.round((0.04 + Math.max(0, pot - 60) * 0.012 + (jewel ? 0.15 : 0)) * mult(c) * 100) / 100;
    return { id: "ys" + Date.now().toString(36) + rnd(100, 999) + rnd(0, 9), name: TM.data.randomName(culture), clubId: c.teamId, pos: pos, pos2: TM.data.randomSpecificPos(pos),
      age: age, overall: ov, potential: pot, attrs: C().youthAttrs ? C().youthAttrs(ov, pos) : null, nationId: nat.id, nationName: nat.name,
      height: 160 + rnd(0, 30), weight: 52 + rnd(0, 26), youth: true, hiddenPot: true, jewel: jewel, est: est, cost: cost, from: L ? L.name : (REGIONS[m.region] || {}).label, scoutedBy: s.name,
      note: pick(jewel && s.stars >= 4 ? ["Joia. Não deixe outro clube chegar antes.", "Melhor garoto que vi em anos nessa idade.", "Técnica rara; com minutos, vira craque."] : pot - ov >= 12 ? ["Cru, mas o teto é alto.", "Físico ainda em formação; a leitura de jogo impressiona.", "Precisa de dois anos de base, mas vale."] : ["Jogador de base sólido, sem grandes riscos.", "Encaixa nas categorias de base; pode virar reserva útil.", "Regular; bom para completar a turma."]) };
  }
  function finishYouthMission(c, s) {
    var m = s.mission;
    var n = 2 + Math.round(m.dur / 3) + Math.round(s.stars / 2), list = [];
    for (var i = 0; i < n; i++) list.push(genProspect(c, m, s));
    list.sort(function (a, b) { return b.est - a.est || b.potential - a.potential; });
    var rep = { id: "yrp" + Date.now().toString(36), season: c.season || 1, day: c.currentDay || 0, scout: s.name, scoutStars: s.stars, region: m.region, league: m.league || "", pos: m.pos || "", dur: m.dur, players: list, seen: false, youth: true };
    c.yscoutReports.unshift(rep); if (c.yscoutReports.length > 12) c.yscoutReports = c.yscoutReports.slice(0, 12);
    s.mission = null; s.done = (s.done || 0) + 1;
    TM.notify.push(c, { icon: "🌱", title: "Relatório da base", news: true, text: s.name + " voltou de " + missionLabel(rep) + " com " + list.length + " garoto(s) para a base" + (list.some(function (x) { return x.jewel && s.stars >= 4; }) ? " — inclusive uma possível joia" : "") + ". Veja em Olheiros → Base." });
  }
  function signProspect(c, rep, x) {
    if (c.budget < x.cost) { TM.ui.toast("Caixa insuficiente (" + money(c, x.cost) + ")."); return false; }
    if ((c.youth || []).length >= 30) { TM.ui.toast("A base está lotada (30). Suba ou dispense alguém."); return false; }
    c.budget -= x.cost; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + x.cost;
    var y = {}; Object.keys(x).forEach(function (k) { y[k] = x[k]; }); delete y.cost; delete y.est; delete y.note; y.signedSeason = c.season || 1;
    if (!y.attrs && C().youthAttrs) y.attrs = C().youthAttrs(y.overall, y.pos);
    c.youth = c.youth || []; c.youth.push(y); c.youthMap = null;
    x.signed = true;
    TM.notify.push(c, { icon: "🌱", title: "Reforço na base", text: y.name + " (" + y.pos + ", " + y.age + " anos) foi contratado para as categorias de base por " + money(c, x.cost) + ", indicado por " + (y.scoutedBy || "olheiro") + "." });
    TM.storage.saveCoachCareer(c);
    return true;
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
    c.yscouts.forEach(function (s) { if (s.mission) { s.mission.left--; if (s.mission.left <= 0) finishYouthMission(c, s); } });
  }
  function isScouted(c, pid) { return !!(c && c.scouted && c.scouted[pid]); }
  function stars(n) { var s = ""; for (var i = 0; i < 5; i++) s += i < n ? "★" : "☆"; return s; }

  /* ================= TELA: OLHEIROS ================= */
  var scoutTab = "pro";
  TM.ui.register("coach-scouting", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; } ensure(c);
    var back = (params && params.from) || "coach-hub";
    if (params && params.tab) scoutTab = params.tab;
    screen.appendChild(TM.ui.topbar("🔭 Olheiros", function () { TM.ui.go(back); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    var tabs = el("div", { class: "segmented full scout-kind-tabs" }, [
      el("button", { class: "seg-btn" + (scoutTab === "pro" ? " active" : ""), text: "⚽ Profissional (" + c.scouts.length + "/3)", on: { click: function () { scoutTab = "pro"; TM.ui.go("coach-scouting", { from: back }); } } }),
      el("button", { class: "seg-btn" + (scoutTab === "youth" ? " active" : ""), text: "🌱 Base (" + c.yscouts.length + "/2)", on: { click: function () { scoutTab = "youth"; TM.ui.go("coach-scouting", { from: back }); } } })
    ]);
    body.appendChild(tabs);
    if (scoutTab === "youth") { renderYouthScouting(c, body, back); return; }
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
    var s = c.scouts.concat(c.yscouts).filter(function (x) { return x.id === (params && params.sid); })[0];
    if (!s) { TM.ui.go("coach-scouting", { from: back }); return; }
    var isY = s.kind === "youth";
    screen.appendChild(TM.ui.topbar("🧭 Missão de " + s.name, function () { TM.ui.go("coach-scouting", { from: back, tab: isY ? "youth" : "pro" }); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    var m = { region: s.region, league: "", pos: "", ageMax: isY ? 19 : 40, dur: 6 };
    body.appendChild(el("div", { class: "setting-hint", text: isY ? "Olheiro da base: volta com garotos de 15 a 19 anos de escolinhas e bases da região, que você pode contratar para as suas categorias de base. Missões profundas acham garotos mais novos e mais joias." : "Fora da especialidade (" + REGIONS[s.region].label + ") o olheiro rende um pouco menos. Missões profundas acham mais joias." }));

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

    if (!isY) {
      var ageVal = el("span", { class: "range-val", text: "até 40 anos" });
      var ageInp = el("input", { type: "range", min: 17, max: 40, value: 40, class: "slider" });
      ageInp.addEventListener("input", function () { m.ageMax = parseInt(ageInp.value, 10); ageVal.textContent = m.ageMax >= 40 ? "qualquer idade" : "até " + m.ageMax + " anos"; upd(); });
      body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode("Idade máxima "), ageVal ]), ageInp ]));
    }

    var durRow = el("div", { class: "segmented full" });
    [3, 6, 10].forEach(function (d) {
      durRow.appendChild(el("button", { class: "seg-btn" + (m.dur === d ? " active" : ""), text: DUR[d], on: { click: function () { m.dur = d; durRow.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); this.classList.add("active"); upd(); } } }));
    });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Duração" }), durRow ]));

    var summary = el("div", { class: "market-budget" }); body.appendChild(summary);
    function upd() { if (isY) { summary.textContent = "🌱 Garotos de 15 a 19 anos · custo da missão " + money(c, missionCost(c, s.stars, m.dur) * 0.7); return; } var n = poolFor(c, m).length; summary.textContent = "🔎 " + n + " jogador(es) no radar · custo da missão " + money(c, missionCost(c, s.stars, m.dur)); }
    upd();
    body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("🚌 Enviar olheiro", function () {
      var cost = Math.round(missionCost(c, s.stars, m.dur) * (isY ? 0.7 : 1) * 100) / 100;
      if (c.budget < cost) { TM.ui.toast("Caixa insuficiente para a missão."); return; }
      c.budget -= cost; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + cost;
      s.mission = { region: m.region, league: m.league, pos: m.pos, ageMax: m.ageMax, dur: m.dur, left: m.dur };
      TM.notify.push(c, { icon: "🚌", title: "Olheiro em missão", text: s.name + " viajou para " + missionLabel(s.mission) + ". Relatório em " + m.dur + " jogos." });
      TM.storage.saveCoachCareer(c); TM.ui.toast("Missão iniciada!"); TM.ui.go("coach-scouting", { from: back, tab: isY ? "youth" : "pro" });
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

  function renderYouthScouting(c, body, back) {
    body.appendChild(el("div", { class: "market-budget", text: "💰 Caixa: " + money(c, c.budget) + " · " + c.yscouts.length + "/2 olheiros da base · " + (c.youth || []).length + "/30 na base" }));
    body.appendChild(el("h3", { class: "section-title", text: "🌱 Olheiros da base" }));
    if (!c.yscouts.length) body.appendChild(el("p", { class: "intro-text", text: "Olheiros da base descobrem garotos de 15 a 19 anos em escolinhas e bases de outras regiões. Você contrata os melhores para as suas categorias de base e sobe ao profissional quando estiverem prontos (até os 21 anos)." }));
    c.yscouts.forEach(function (s) {
      var card = el("div", { class: "scout-card" });
      card.appendChild(el("div", { class: "sc-head" }, [
        el("div", { class: "sc-ava", text: "🌱" }),
        el("div", { class: "sc-info" }, [ el("div", { class: "sc-name", text: s.name }), el("div", { class: "sc-sub", text: stars(s.stars) + " · " + REGIONS[s.region].label + " · " + s.age + " anos · " + money(c, salary(c, s.stars) * 0.6) + "/temp" }) ])
      ]));
      if (s.mission) {
        var m = s.mission, pct = Math.round(((m.dur - m.left) / m.dur) * 100);
        card.appendChild(el("div", { class: "sc-mission" }, [ el("div", { class: "sc-mtx", text: "🚌 Em missão: " + missionLabel(m) + " — volta em " + m.left + " jogo(s)" }), el("div", { class: "sc-bar" }, [ el("div", { class: "sc-fill", style: "width:" + pct + "%" }) ]) ]));
      } else card.appendChild(el("div", { class: "sc-mtx muted", text: "Disponível" + (s.done ? " · " + s.done + " missão(ões)" : "") }));
      card.appendChild(el("div", { class: "note-actions" }, [
        (s.mission && TM.coins) ? TM.ui.button("⚡ Entregar agora (" + TM.coins.COST.scoutRush + " 🪙)", function () { TM.coins.pay(TM.coins.COST.scoutRush, "Missão de olheiro acelerada", function () { finishYouthMission(c, s); TM.storage.saveCoachCareer(c); TM.ui.go("coach-scouting", { from: back, tab: "youth" }); }); }, "btn primary small") : null,
        s.mission ? TM.ui.button("Cancelar missão", function () { s.mission = null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-scouting", { from: back, tab: "youth" }); }, "btn ghost small")
                  : TM.ui.button("🧭 Nova missão", function () { TM.ui.go("coach-scout-mission", { sid: s.id, from: back }); }, "btn primary small"),
        TM.ui.button("Dispensar", function () { TM.ui.confirm("Dispensar " + s.name + "?", "Sem multa.", "Dispensar", function () { c.yscouts = c.yscouts.filter(function (x) { return x.id !== s.id; }); TM.storage.saveCoachCareer(c); TM.ui.go("coach-scouting", { from: back, tab: "youth" }); }, true); }, "btn ghost small")
      ].filter(Boolean)));
      body.appendChild(card);
    });
    if (c.yscouts.length < 2) {
      body.appendChild(el("h3", { class: "section-title", text: "📋 Olheiros de base disponíveis" }));
      c.yscoutCands.list.filter(function (k) { return !c.yscouts.some(function (s) { return s.id === k.id; }); }).forEach(function (k) {
        var f = Math.round(fee(c, k.stars) * 0.6 * 100) / 100, afford = c.budget >= f;
        body.appendChild(el("div", { class: "scout-card cand" }, [
          el("div", { class: "sc-head" }, [ el("div", { class: "sc-ava", text: "🕵️" }), el("div", { class: "sc-info" }, [ el("div", { class: "sc-name", text: k.name }), el("div", { class: "sc-sub", text: stars(k.stars) + " · base de " + REGIONS[k.region].label + " · " + k.age + " anos" }) ]), el("div", { class: "sc-fee", text: money(c, f) }) ]),
          el("div", { class: "note-actions" }, [ TM.ui.button(afford ? "Contratar (" + money(c, f) + ")" : "Caixa insuficiente", function () {
            if (!afford) { TM.ui.toast("Caixa insuficiente."); return; }
            c.budget -= f; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + f;
            c.yscouts.push({ id: k.id, name: k.name, region: k.region, stars: k.stars, age: k.age, kind: "youth", mission: null, done: 0 });
            TM.notify.push(c, { icon: "🌱", title: "Olheiro da base contratado", text: k.name + " (" + stars(k.stars) + ") vai garimpar garotos para a base. Mande-o em uma missão." });
            TM.storage.saveCoachCareer(c); TM.ui.go("coach-scouting", { from: back, tab: "youth" });
          }, "btn " + (afford ? "primary" : "ghost") + " small") ])
        ]));
      });
    }
    body.appendChild(el("h3", { class: "section-title", text: "📑 Relatórios da base" }));
    if (!c.yscoutReports.length) body.appendChild(el("p", { class: "intro-text", text: "Nenhum relatório ainda." }));
    c.yscoutReports.forEach(function (r) {
      var left = r.players.filter(function (x) { return !x.signed; }).length;
      body.appendChild(el("button", { class: "scout-report" + (r.seen ? "" : " new"), on: { click: function () { TM.ui.go("coach-yscout-report", { id: r.id, from: back }); } } }, [
        el("div", { class: "sr-title", text: (r.seen ? "📄 " : "🆕 ") + missionLabel(r) }),
        el("div", { class: "sr-sub", text: r.scout + " · " + stars(r.scoutStars) + " · " + r.players.length + " garoto(s), " + left + " disponível(is) · temp. " + r.season })
      ]));
    });
  }
  TM.ui.register("coach-yscout-report", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; } ensure(c);
    var back = (params && params.from) || "coach-hub";
    var r = c.yscoutReports.filter(function (x) { return x.id === (params && params.id); })[0];
    if (!r) { TM.ui.go("coach-scouting", { from: back, tab: "youth" }); return; }
    r.seen = true; TM.storage.saveCoachCareer(c);
    screen.appendChild(TM.ui.topbar("🌱 Relatório da base", function () { TM.ui.go("coach-scouting", { from: back, tab: "youth" }); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "🌱 " + r.scout + " (" + stars(r.scoutStars) + ") — " + missionLabel(r) }),
      el("div", { class: "setting-hint", text: "Estrelas = potencial estimado pelo olheiro (quanto mais estrelas o olheiro, mais confiável). Contrate para a base e suba ao profissional quando estiver pronto." })
    ]));
    body.appendChild(el("div", { class: "market-budget", text: "💰 Caixa: " + money(c, c.budget) + " · base " + (c.youth || []).length + "/30" }));
    r.players.forEach(function (x) {
      var row = el("div", { class: "ys-pros" + (x.jewel && r.scoutStars >= 4 ? " jewel" : "") }, [
        el("div", { class: "ys-face", text: x.pos === "GK" ? "🧤" : "🧒" }),
        el("div", { class: "ys-info" }, [
          el("div", { class: "ys-name", text: x.name + (x.jewel && r.scoutStars >= 4 ? " 💎" : "") }),
          el("div", { class: "ys-sub", text: (TM.data.posLabel ? TM.data.posLabel(x) : x.pos) + " · " + x.age + " anos · OVR " + x.overall + " · " + (x.nationName || "") + " · " + (x.from || "") }),
          el("div", { class: "ys-note" }, [ el("span", { class: "sp-stars", text: stars(x.est) }), el("span", { text: " " + x.note }) ])
        ]),
        x.signed ? el("span", { class: "price-tag" }, [ el("span", { text: "Na base ✔" }) ])
                 : TM.ui.button(money(c, x.cost), function () { if (signProspect(c, r, x)) { TM.ui.toast("🌱 " + x.name + " na base!"); TM.ui.go("coach-yscout-report", { id: r.id, from: back }); } }, "btn primary small")
      ]);
      body.appendChild(row);
    });
  });

  TM.scouting = { ensure: ensure, tick: tick, seasonTick: seasonTick, isScouted: isScouted, REGIONS: REGIONS, REGION_ORDER: REGION_ORDER, regionOfLeague: regionOfLeague, signProspect: signProspect };
})(window);
