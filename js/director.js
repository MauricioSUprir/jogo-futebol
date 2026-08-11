/* ================= TOTAL MATCH — Carreira de Dirigente ================= */
/* O dirigente cuida da gestão interna do clube: contrata/demite técnicos,
   cuida das finanças (caixa, dívidas, folha salarial), melhora o CT, influencia
   nas contratações e assiste os resultados — os jogos são comandados pelo
   técnico contratado (auto-simulados). Não escala nem define tática. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function money(c, v) { return C().fmtMoney(c, v); }
  function mult(c) { return c.money ? c.money.mult : 1; }

  /* ---------- economia dos técnicos ---------- */
  var ELITE = {
    "Pep Guardiola": 92, "Carlo Ancelotti": 90, "Jürgen Klopp": 90, "Luis Enrique": 88, "Diego Simeone": 88,
    "Antonio Conte": 87, "Zinedine Zidane": 87, "José Mourinho": 86, "Hansi Flick": 86, "Xabi Alonso": 85,
    "Arne Slot": 85, "Mikel Arteta": 85, "Marcelo Gallardo": 85, "Julian Nagelsmann": 85, "Mauricio Pochettino": 84,
    "Unai Emery": 84, "Abel Ferreira": 84, "Vincent Kompany": 83, "Roberto De Zerbi": 83, "Rúben Amorim": 83,
    "Massimiliano Allegri": 82, "Luciano Spalletti": 82, "Tite": 82, "Niko Kovač": 81, "Enzo Maresca": 81,
    "Jorge Sampaoli": 81, "Ange Postecoglou": 80, "Marco Silva": 80, "Simone Inzaghi": 84, "Sérgio Conceição": 80
  };
  function hashName(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function coachRating(co) {
    if (ELITE[co.name] != null) return ELITE[co.name];
    var base = 63 + (hashName(co.name) % 16); // 63..78
    if (co.age >= 58 && co.age <= 66) base += 1; // experiência
    return Math.max(60, Math.min(83, base));
  }
  // custo de contratação (compensação ao clube atual) — em euros milhões, antes da moeda
  function hireCostEur(r) {
    if (r >= 90) return 55; if (r >= 87) return 38; if (r >= 84) return 24; if (r >= 81) return 15;
    if (r >= 78) return 9; if (r >= 74) return 5; if (r >= 70) return 2.5; return 1;
  }
  // salário por temporada — em euros milhões
  function salaryEur(r) {
    if (r >= 90) return 20; if (r >= 87) return 14; if (r >= 84) return 9; if (r >= 81) return 6;
    if (r >= 78) return 4; if (r >= 74) return 2.4; if (r >= 70) return 1.3; return 0.7;
  }
  function coachHireCost(c, r) { return Math.round(hireCostEur(r) * mult(c)); }
  function coachSalary(c, r) { return Math.round(salaryEur(r) * mult(c)); }
  function makeContract(c, co, months) {
    var r = coachRating(co);
    return { id: co.id, name: co.name, rating: r, salaryM: coachSalary(c, r), contractMonths: months, photoKey: co.photoKey, age: co.age };
  }
  function interino(c) {
    return { id: "interino", name: "Técnico interino", rating: 68, salaryM: Math.round(0.6 * mult(c)), contractMonths: 6, photoKey: null, age: 50, isInterino: true };
  }

  /* ---------- CT (centro de treinamento) ---------- */
  var CT_UP_EUR = { 2: 12, 3: 28, 4: 55, 5: 95 };     // custo p/ chegar ao nível (euros M)
  function ctUpgradeCost(c, toLevel) { return Math.round((CT_UP_EUR[toLevel] || 0) * mult(c)); }
  function ctUpkeep(c, level) { return Math.round(level * 1.2 * mult(c)); }
  function ctDesc(level) {
    return ["", "Básico", "Modesto", "Bom", "Excelente", "Elite mundial"][level] || "—";
  }

  /* ---------- folha salarial / receita ---------- */
  function seasonWageBill(career) {
    var sum = 0;
    C().rosterPlayers(career).forEach(function (p) { sum += TM.data.marketValue(p) * 0.075; });
    return Math.round(sum * mult(career));
  }
  function seasonBaseIncomeEur(clubId) {
    var r = TM.data.clubRating(clubId);
    return 15 + Math.max(0, (r - 60)) * 3.4; // 60→15, 75→66, 90→117 (euros M)
  }
  function matchesPerSeason(career) { return Math.max(30, (career.order || []).length); }

  /* ---------- patrocínios ---------- */
  function sponsorOffers(c) {
    var r = TM.data.clubRating(c.teamId), m = mult(c);
    var base = 6 + Math.max(0, (r - 60)) * 0.7; // euros M
    return [
      { id: "master", name: "Patrocínio Master", bonusM: Math.round(base * 1.4 * m), seasonM: Math.round(base * 1.9 * m), desc: "Maior receita por temporada." },
      { id: "padrao", name: "Patrocínio Padrão", bonusM: Math.round(base * 1.3 * m), seasonM: Math.round(base * 1.2 * m), desc: "Equilibrado: bônus e receita." },
      { id: "cash", name: "Patrocínio Bônus", bonusM: Math.round(base * 3.2 * m), seasonM: Math.round(base * 0.5 * m), desc: "Grande bônus imediato para contratar já." }
    ];
  }

  /* ---------- investidor / SAF (raro, a cada janela de transferências) ---------- */
  function maybeSafOffer(c) {
    if (!c.windows) return;
    var d = c.currentDay || 0;
    if (c.safOffer && d >= c.safOffer.closeDay) c.safOffer = null; // proposta expirou (janela fechou)
    c.windows.forEach(function (w) {
      var open = d >= w.openDay && d < w.closeDay;
      if (!open || w.safRolled) return;
      w.safRolled = true;
      if (c.safOffer || Math.random() >= 0.12) return;              // muito raro
      var r = TM.data.clubRating(c.teamId), m = mult(c);
      var base = Math.round((40 + Math.max(0, r - 60) * 6) * m);     // porte do clube
      var fromCash = Math.round(Math.max(0, c.budget) * 0.25);       // quanto maior o caixa do diretor, maior o aporte
      var amount = base + fromCash;
      c.safOffer = { amountM: amount, closeDay: w.closeDay, windowName: w.name };
      TM.notify.push(c, { icon: "💼", title: "Interesse de investidor (SAF)", saf: true,
        text: "Um grupo quer investir no clube (SAF) e injetar " + money(c, amount) + " no caixa nesta " + w.name + ". Decida no seu painel de diretor." });
    });
  }

  /* ---------- estádio (capacidade / receita) ---------- */
  var STAD_UP_EUR = { 1: 20, 2: 45, 3: 85 };
  function stadUpgradeCost(c, to) { return Math.round((STAD_UP_EUR[to] || 0) * mult(c)); }
  function stadIncomeMult(c) { return 1 + 0.14 * (c.stadiumUp || 0); }

  /* ---------- o técnico usa a verba de transferências para reforçar o elenco ---------- */
  function autoSign(career, capM) {
    var m = mult(career), rosterSet = {};
    career.roster.forEach(function (id) { rosterSet[id] = 1; });
    var POS = ["GK", "DF", "MF", "FW"], TARGET = { GK: 3, DF: 8, MF: 8, FW: 6 };
    // candidatos por posição (fora do clube, não no elenco), do melhor para o pior
    var poolByPos = { GK: [], DF: [], MF: [], FW: [] };
    var pb = TM.data.world().playersById;
    Object.keys(pb).forEach(function (id) {
      if (rosterSet[id]) return;
      var p = pb[id];
      if (!p || p.overall < 66 || p.clubId === career.teamId || !poolByPos[p.pos]) return;
      var cost = Math.round(TM.data.marketValue(p) * m);
      if (cost < 1 || cost > capM) return;
      poolByPos[p.pos].push({ p: p, cost: cost });
    });
    POS.forEach(function (k) { poolByPos[k].sort(function (a, b) { return b.p.overall - a.p.overall; }); });
    // situação do elenco por posição: melhor titular + quantidade
    var squad = {};
    POS.forEach(function (pos) {
      var ovs = C().rosterPlayers(career).filter(function (p) { return p.pos === pos; }).map(function (p) { return p.overall; }).sort(function (a, b) { return b - a; });
      squad[pos] = { best: ovs[0] || 0, count: ovs.length };
    });
    var spent = 0, signed = [], perPos = { GK: 0, DF: 0, MF: 0, FW: 0 };
    for (var iter = 0; iter < 6; iter++) {
      // ataca sempre a posição com o titular mais fraco que ainda tenha reforço viável
      var order = POS.slice().sort(function (a, b) { return squad[a].best - squad[b].best; });
      var made = false;
      for (var oi = 0; oi < order.length && !made; oi++) {
        var pos = order[oi];
        if (perPos[pos] >= 2) continue;
        var cands = poolByPos[pos];
        for (var i = 0; i < cands.length; i++) {
          var cd = cands[i];
          if (rosterSet[cd.p.id] || spent + cd.cost > capM) continue;
          var upgrade = cd.p.overall > squad[pos].best + 2;                       // melhora o titular
          var depth = squad[pos].count < TARGET[pos] && cd.p.overall >= squad[pos].best - 3; // completa o elenco
          if (!upgrade && !depth) continue;
          career.roster.push(cd.p.id); career.signedFrom[cd.p.id] = cd.p.clubId; rosterSet[cd.p.id] = 1;
          spent += cd.cost; perPos[pos]++; squad[pos].count++;
          if (cd.p.overall > squad[pos].best) squad[pos].best = cd.p.overall;
          signed.push({ name: cd.p.name, ov: cd.p.overall, cost: cd.cost, pos: pos });
          made = true; break;
        }
      }
      if (!made) break;
    }
    C().syncLineup(career);
    career.budget -= spent; career.fin.expenseM += spent;
    return { signed: signed, spent: spent };
  }

  /* ---------- humor do técnico (muda com os recados do diretor) ---------- */
  var MOOD = {
    empolgado: { mod: 0.8, emoji: "🤩", label: "Empolgado" },
    animado: { mod: 0.6, emoji: "😃", label: "Animado" },
    feliz: { mod: 0.5, emoji: "🙂", label: "Feliz" },
    motivado: { mod: 0.6, emoji: "💪", label: "Motivado" },
    neutro: { mod: 0, emoji: "😐", label: "Neutro" },
    angustiado: { mod: -0.4, emoji: "😰", label: "Angustiado" },
    triste: { mod: -0.7, emoji: "😔", label: "Triste" },
    raiva: { mod: -0.9, emoji: "😠", label: "Com raiva" }
  };
  function moodOf(c) { return (c.coach && MOOD[c.coach.mood]) ? c.coach.mood : "neutro"; }
  function classifyMessage(msg) {
    var t = (" " + msg + " ").toLowerCase();
    function has(ws) { return ws.some(function (w) { return t.indexOf(w) >= 0; }); }
    var insult = has(["vergonha", "péssimo", "pessimo", "horrível", "horrivel", "incompetente", "fraco", "ridículo", "ridiculo", "lixo", "burro", "inútil", "inutil", "nojo", "medíocre", "mediocre"]);
    var threat = has(["demitir", "demissão", "demissao", "rua", "última chance", "ultima chance", "ou você", "ou voce", "se não", "se nao", "acabou", "não aceito", "nao aceito", "tá fora", "ta fora"]);
    var criticize = has(["ruim", "precisa melhorar", "abaixo", "decepção", "decepcao", "decepcionou", "cobrar", "errado", "fraca", "vexame"]);
    var pressure = has(["pressão", "pressao", "tem que ganhar", "precisa ganhar", "não pode perder", "nao pode perder", "resultado já", "resultado ja", "é obrigado", "e obrigado", "responsabilidade"]);
    var energize = has(["vamos", "força", "forca", "bora", "pra cima", "juntos", "garra", "raça", "raca", "foco", "luta", "determinação", "determinacao", "acredita", "com tudo"]);
    var praise = has(["parabéns", "parabens", "ótimo", "otimo", "excelente", "orgulho", "obrigado", "confio", "acredito em você", "acredito em voce", "feliz", "incrível", "incrivel", "fantástico", "fantastico", "brilhante", "mandou bem", "muito bom", "gênio", "genio", "melhor"]);
    if (insult || threat) return "raiva";
    if (criticize) return "triste";
    if (pressure) return "angustiado";
    if (energize) return "empolgado";
    if (praise) return "feliz";
    return "neutro";
  }
  var COACH_REPLY = {
    raiva: ["Não concordo com essa cobrança, diretor. Isso me irrita — mas vou responder em campo.", "Do jeito que veio, me deixou com raiva. Me cobre trabalho, não com ameaças.", "Fico revoltado com esse tom. Vamos ver quem tem razão no gramado."],
    triste: ["Confesso que fiquei abatido com isso, diretor.", "Essa mensagem me desanimou, mas prometo reagir.", "Fiquei triste com a crítica — esperava outro tom."],
    angustiado: ["Sinto o peso dessa pressão... espero corresponder.", "A responsabilidade é grande. Vou fazer o possível.", "Entendi o recado. A cobrança aperta, mas seguimos."],
    empolgado: ["Pode deixar, diretor! Estou empolgado, vamos com tudo!", "Isso me anima demais — o time vai sentir essa energia!", "Bora! Recebi a mensagem e estou fervendo pra jogar."],
    feliz: ["Obrigado, diretor! Fico muito feliz com o reconhecimento.", "Que bom ouvir isso! Vou retribuir dentro de campo.", "Fico honrado com a confiança. Muito obrigado!"],
    neutro: ["Entendido, diretor. Seguimos trabalhando.", "Recebido. Foco total no próximo jogo.", "Certo. Vamos manter o trabalho firme."]
  };
  // detecta o assunto da mensagem para a resposta ter a ver com o que foi dito
  var REPLY_TOPICS = [
    { re: /defes|defensiv|zaga|gol sofrid|tomand[o]? gol|segurar atr|marca[çc]/, say: "vou apertar a marcação e segurar melhor a defesa" },
    { re: /ataqu|marcar gol|finaliza|pontaria|criar chance|no gol advers/, say: "vamos ser mais agressivos no ataque e criar mais chances" },
    { re: /vit[oó]ria|ganhar|vencer|3 pontos|tr[eê]s pontos|pr[oó]ximo jogo|resultado/, say: "o foco é buscar a vitória no próximo jogo" },
    { re: /t[ií]tulo|campe[aã]|ta[çc]a|trof[eé]u|copa/, say: "o título é o nosso objetivo, pode confiar" },
    { re: /torcida|torcedor|arquibancad|torcedores/, say: "vou entregar um time à altura da torcida" },
    { re: /esfor[çc]o|entrega|ra[çc]a|garra|luta[r]?|correr|dedica/, say: "o time vai deixar tudo em campo" },
    { re: /refor[çc]o|contrata|elenco|jogador|verba/, say: "com os reforços certos o elenco fica mais forte" },
    { re: /t[aá]tica|esquema|forma[çc][aã]o|posi[çc]/, say: "vou ajustar a tática para o time render mais" },
    { re: /base|jovem|garot|revela|categoria/, say: "vou dar chance à base e revelar as joias do clube" },
    { re: /calm|tranquil|paci[eê]ncia|tempo|confia|acredit/, say: "obrigado pela confiança, isso faz diferença" }
  ];
  function composeReply(c, msg, mood) {
    var t = " " + (msg || "").toLowerCase() + " ";
    var pool = COACH_REPLY[mood] || COACH_REPLY.neutro;
    var opener = pool[Math.floor(Math.random() * pool.length)];
    var topic = null;
    for (var i = 0; i < REPLY_TOPICS.length; i++) { if (REPLY_TOPICS[i].re.test(t)) { topic = REPLY_TOPICS[i].say; break; } }
    if (!topic) return opener;
    return opener + " " + topic.charAt(0).toUpperCase() + topic.slice(1) + ".";
  }

  /* ---------- edge do técnico + CT + humor nos resultados ---------- */
  function teamEdge(career) {
    var co = career.coach || interino(career);
    var e = (co.rating - 72) / 6 + (career.ctLevel - 2) * 0.4 + (MOOD[co.mood] ? MOOD[co.mood].mod : 0);
    return Math.max(-3, Math.min(3, e));
  }

  /* ---------- criar a carreira de dirigente ---------- */
  function start(clubId, opts) {
    var career = C().newClubCareer(clubId, opts);
    career.type = "director";
    career.role = "dirigente";
    var club = TM.data.club(clubId);
    var initial = club.coachId ? TM.data.coaches().filter(function (x) { return x.id === club.coachId; })[0] : null;
    if (!initial) { var all = TM.data.coaches(); initial = all[hashName(clubId) % all.length]; }
    career.coach = makeContract(career, initial, 24);
    career.ctLevel = 2;
    career.wagesM = seasonWageBill(career);
    career.fin = { incomeM: 0, expenseM: 0 };      // acumulado da temporada
    career.aporteUsedSeason = false;
    career._lastSim = null;
    TM.notify.push(career, { icon: "🧑‍💼", title: "Novo dirigente", text: "Você assumiu a gestão do " + club.name + ". Comande as finanças, o CT e o comando técnico." });
    TM.notify.push(career, { icon: "👔", title: "Técnico do elenco", text: career.coach.name + " (" + career.coach.rating + ") comanda o time. Contrato de 24 meses." });
    TM.storage.saveCoachCareer(career);
    return career;
  }

  function ensureDirector(career) {
    if (!career) return career;
    if (career.ctLevel == null) career.ctLevel = 2;
    if (!career.coach) career.coach = interino(career);
    if (!career.fin) career.fin = { incomeM: 0, expenseM: 0 };
    if (career.wagesM == null) career.wagesM = seasonWageBill(career);
    if (career.aporteUsedSeason == null) career.aporteUsedSeason = false;
    if (career.stadiumUp == null) career.stadiumUp = 0;
    return career;
  }

  /* ---------- avançar um jogo (o técnico comanda) ---------- */
  function advance(career) {
    var p = C().advanceToUserMatch(career);
    if (p.seasonEnd) return { seasonEnd: true };
    var teamA = C().anyTeam(career, p.homeId), teamB = C().anyTeam(career, p.awayId);
    var userSide = p.homeId === career.teamId ? 0 : 1;
    var opts = { realism: TM.storage.settings().realism, neutral: p.ko, moraleBoost: teamEdge(career), moraleSide: userSide };
    var result = TM.engine.simulate(teamA, teamB, opts);
    C().processUserMatch(career, result, userSide);
    var hs = result.score[0], as = result.score[1], penWinnerId = null;
    if (hs === as) {
      var ctx = C().userPenContext(career, hs, as);
      if (ctx) { var sh = TM.engine.shootout(C().anyTeam(career, ctx.aId), C().anyTeam(career, ctx.bId)); penWinnerId = sh.winner === 0 ? ctx.aId : ctx.bId; }
    }
    // finanças do jogo
    var mps = matchesPerSeason(career);
    var stadM = stadIncomeMult(career);
    var incomeMatch = Math.round(seasonBaseIncomeEur(career.teamId) / mps * mult(career) * stadM);
    var homeBonus = userSide === 0 ? Math.round(seasonBaseIncomeEur(career.teamId) / mps * 0.4 * mult(career) * stadM) : 0;
    var sponsorMatch = career.sponsor ? Math.round(career.sponsor.seasonM / mps) : 0;
    var income = incomeMatch + homeBonus + sponsorMatch;
    var expense = Math.round((career.wagesM + career.coach.salaryM + ctUpkeep(career, career.ctLevel)) / mps);
    career.budget += income - expense;
    career.fin.incomeM += income; career.fin.expenseM += expense;
    // contrato do técnico corre
    career.coach.contractMonths = Math.max(0, career.coach.contractMonths - 12 / mps);
    if (career.coach.contractMonths <= 0 && !career.coach._expiredNotified) {
      career.coach._expiredNotified = true;
      TM.notify.push(career, { icon: "⌛", title: "Contrato encerrado", text: "O contrato de " + career.coach.name + " chegou ao fim. Renove ou contrate um novo técnico em 🧑‍💼 Técnico." });
    }
    C().applyUserResult(career, hs, as, penWinnerId);
    var meScore = result.score[userSide], opScore = result.score[1 - userSide];
    career._lastSim = {
      oppName: TM.data.club(userSide === 0 ? p.awayId : p.homeId).name,
      oppId: userSide === 0 ? p.awayId : p.homeId,
      me: meScore, op: opScore, home: userSide === 0, compName: p.name,
      res: meScore > opScore ? "V" : meScore < opScore ? "D" : "E",
      penWin: penWinnerId ? (penWinnerId === career.teamId) : null
    };
    career.results = career.results || [];
    career.results.push(career._lastSim);
    if (career.results.length > 15) career.results = career.results.slice(-15);
    TM.storage.saveCoachCareer(career);
    return { ok: true };
  }

  /* ================= HUB ================= */
  TM.ui.register("director-hub", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    if (c.type !== "director") { TM.ui.go("coach-hub"); return; }
    C().migrateCareer(c); ensureDirector(c); C().processCalendar(c); maybeSafOffer(c); TM.storage.saveCoachCareer(c);
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
    screen.appendChild(TM.ui.topbar("Dirigente", function () { TM.ui.go("modes"); }, el("div", { class: "tb-actions" }, [ bell, dots ])));

    screen.appendChild(el("div", { class: "club-header" }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", {}, [
        el("div", { class: "ch-name", text: club.name }),
        el("div", { class: "ch-sub", text: TM.data.league(c.leagueId).name + " · Temporada " + c.season }),
        el("div", { class: "ch-budget" + (c.budget < 0 ? " debt" : ""), text: (c.budget < 0 ? "🔴 Dívida: " : "💰 Caixa: ") + money(c, c.budget) })
      ]),
      el("div", { class: "dir-badge", text: "🧑‍💼 Dirigente" })
    ]));

    // resumo financeiro rápido
    var saldo = c.fin.incomeM - c.fin.expenseM;
    screen.appendChild(el("div", { class: "stat-tiles dir-fin" }, [
      finTile("Caixa", money(c, c.budget), c.budget < 0 ? "bad" : ""),
      finTile("Saldo da temporada", (saldo >= 0 ? "+" : "") + money(c, saldo), saldo < 0 ? "bad" : "good"),
      finTile("Folha (temp.)", money(c, c.wagesM), ""),
      finTile("CT", "Nível " + c.ctLevel, "")
    ]));

    // técnico atual
    var co = c.coach;
    var months = Math.round(co.contractMonths);
    screen.appendChild(el("button", { class: "dir-coach-card", on: { click: function () { TM.ui.go("director-coach"); } } }, [
      coachFace(co, "dc-face"),
      el("div", { class: "dc-info" }, [
        el("div", { class: "dc-name", text: "👔 " + co.name + (co.isInterino ? " (interino)" : "") + "  " + MOOD[moodOf(c)].emoji }),
        el("div", { class: "dc-sub", text: "Humor: " + MOOD[moodOf(c)].label + " · overall " + co.rating + " · contrato " + months + " mês(es)" })
      ]),
      TM.ui.ovBadge(co.rating)
    ]));

    // meta da diretoria
    var pos = C().currentPosition(c);
    screen.appendChild(el("div", { class: "objective" }, [
      el("span", { class: "obj-ic", text: "🎯" }),
      el("div", {}, [
        el("div", { class: "obj-desc", text: "Meta: " + c.objective.desc }),
        el("div", { class: "obj-prog", text: "Posição atual: " + pos + "º" + (pos <= c.objective.maxPos ? " ✓" : " ⚠") })
      ])
    ]));

    // proposta de investidor / SAF (rara)
    if (c.safOffer) {
      screen.appendChild(el("div", { class: "saf-card" }, [
        el("div", { class: "saf-title", text: "💼 Interesse de investidor (SAF)" }),
        el("div", { class: "saf-text", text: "Um grupo quer investir no clube (SAF) e injetar " + money(c, c.safOffer.amountM) + " no caixa nesta " + (c.safOffer.windowName || "janela") + ". Você pode usar essa verba para liberar reforços." }),
        el("div", { class: "note-actions" }, [
          TM.ui.button("✅ Aceitar " + money(c, c.safOffer.amountM), function () {
            c.budget += c.safOffer.amountM; c.fin.incomeM += c.safOffer.amountM;
            TM.notify.push(c, { icon: "💼", title: "SAF fechada", text: "O investidor injetou " + money(c, c.safOffer.amountM) + " no clube. Libere a verba para o técnico reforçar o elenco." });
            c.safOffer = null; TM.storage.saveCoachCareer(c); TM.ui.toast("Investimento aceito!"); TM.ui.go("director-hub");
          }, "btn primary small"),
          TM.ui.button("Recusar", function () {
            TM.notify.push(c, { icon: "🚫", title: "Proposta recusada", text: "Você recusou a proposta de investimento (SAF)." });
            c.safOffer = null; TM.storage.saveCoachCareer(c); TM.ui.go("director-hub");
          }, "btn ghost small")
        ])
      ]));
    }

    // último resultado + próximo jogo (auto-simulado pelo técnico)
    var pend = C().advanceToUserMatch(c);
    if (pend.seasonEnd) {
      directorSeasonEnd(screen, c);
    } else {
      // barra de data + pular dias (avança o calendário: janelas, SAF, mercado)
      var nextDay = C().matchDay(c.matchNo), daysLeft = nextDay - c.currentDay;
      screen.appendChild(el("div", { class: "date-bar" }, [
        el("div", { class: "date-now" }, [ el("span", { class: "date-ic", text: "📅" }), el("span", { text: C().dateOf(c, c.currentDay).full }) ]),
        el("button", { class: "date-cal-btn", text: "Calendário →", on: { click: function () { TM.ui.go("coach-calendar"); } } })
      ]));
      if (daysLeft > 0) {
        screen.appendChild(el("div", { class: "skip-row" }, [
          TM.ui.button("⏭ Pular 1 dia", function () { c.currentDay++; TM.storage.saveCoachCareer(c); TM.ui.go("director-hub"); }, "btn ghost small"),
          TM.ui.button("⏩ Avançar até o jogo", function () { c.currentDay = nextDay; TM.storage.saveCoachCareer(c); TM.ui.go("director-hub"); }, "btn small")
        ]));
      }
      if (c._lastSim) {
        var ls = c._lastSim;
        var cls = ls.res === "V" ? "good" : ls.res === "D" ? "bad" : "";
        screen.appendChild(el("div", { class: "dir-last " + cls }, [
          el("span", { class: "dl-lbl", text: "Último jogo · " + ls.compName }),
          el("span", { class: "dl-score" }, [
            el("span", { text: club.name + " " }),
            el("strong", { text: ls.home ? (ls.me + " × " + ls.op) : (ls.op + " × " + ls.me) }),
            el("span", { text: " " + ls.oppName })
          ]),
          el("span", { class: "dl-tag", text: ls.penWin === true ? "✔ venceu nos pênaltis" : ls.penWin === false ? "✖ perdeu nos pênaltis" : (ls.res === "V" ? "Vitória" : ls.res === "D" ? "Derrota" : "Empate") })
        ]));
      }
      var homeClub = TM.data.club(pend.homeId), awayClub = TM.data.club(pend.awayId);
      var card = el("div", { class: "next-match" }, [
        el("div", { class: "nm-label", text: "Próximo jogo · " + (pend.label || pend.name) }),
        el("div", { class: "nm-teams" }, [
          TM.img.clubImg(homeClub, "nm-crest"), el("span", { text: homeClub.name }),
          el("span", { class: "nm-x", text: "×" }),
          el("span", { text: awayClub.name }), TM.img.clubImg(awayClub, "nm-crest")
        ]),
        TM.ui.stadiumBanner(homeClub, { compact: true, label: "Mandante: " + homeClub.name }),
        el("div", { class: "setting-hint", style: "text-align:center", text: "🎥 O técnico " + co.name + " comanda a equipe." }),
        TM.ui.button("▶ Avançar jogo", function () {
          var r = advance(c);
          if (r.seasonEnd) { TM.storage.saveCoachCareer(c); }
          TM.ui.go("director-hub");
        }, "btn primary")
      ]);
      var compId = TM.coachCompId ? TM.coachCompId(c, pend.key) : null;
      if (compId) { TM.ui.applyCompTheme(card, compId); var banner = TM.ui.compBanner(compId, pend.label || pend.name); if (banner) card.insertBefore(banner, card.firstChild); }
      screen.appendChild(card);
    }

    // lembrete: o dirigente é o diretor — não escala, não faz tática e não contrata jogadores (o técnico faz isso)
    screen.appendChild(el("div", { class: "dir-note", text: "🎬 Você é o diretor do clube. O técnico comanda o time em campo e monta o elenco (contrata os jogadores). Você adiciona dinheiro, libera a verba de transferências, escolhe o técnico, patrocínios e a estrutura." }));

    // ações do diretor (gestão — sem elenco/escalação/contratações manuais)
    screen.appendChild(el("div", { class: "hub-actions six" }, [
      dbtn("🧑‍💼", "Técnico", "director-coach"),
      dbtn("💬", "Vestiário", "director-messages"),
      dbtn("💰", "Finanças", "director-finance"),
      dbtn("💸", "Verba p/ reforços", "director-transfer"),
      dbtn("🤝", "Patrocínios", "director-sponsors"),
      dbtn("🏟️", "Estádio", "director-stadium"),
      dbtn("🏋️", "CT", "director-ct"),
      dbtn("🏆", "Competições", "coach-comps"),
      dbtn("📅", "Calendário", "coach-calendar"),
      dbtn("🗂️", "Títulos", "coach-honours")
    ]));
    function dbtn(icon, label, route) { return el("button", { class: "hub-btn", on: { click: function () { TM.ui.go(route); } } }, [ el("span", { class: "hub-ic", text: icon }), el("span", { text: label }) ]); }
  });

  function finTile(label, val, cls) {
    return el("div", { class: "tile " + (cls || "") }, [ el("div", { class: "tile-val", text: val }), el("div", { class: "tile-lbl", text: label }) ]);
  }
  function coachFace(co, cls) {
    if (co.photoKey) { var fake = { id: co.id, name: co.name, photoKey: co.photoKey }; return TM.img.coachImg(fake, cls); }
    return el("div", { class: cls + " placeholder", text: "👔" });
  }

  function directorSeasonEnd(screen, c) {
    var st = C().standings(c.comps.league.table);
    var pos = st.findIndex(function (r) { return r.id === c.teamId; }) + 1;
    var ev = C().evaluateObjective(c);
    var saldo = c.fin.incomeM - c.fin.expenseM;
    var box = el("div", { class: "next-match season-end" }, [
      el("div", { class: "nm-label", text: "🏁 Fim da temporada " + c.season }),
      el("div", { class: "nm-teams", text: pos + "º na liga" }),
      el("div", { class: "obj-desc", text: "Balanço financeiro: " + (saldo >= 0 ? "+" : "") + money(c, saldo) + " · Caixa final: " + money(c, c.budget) })
    ]);
    if (ev.met) {
      box.appendChild(el("div", { class: "obj-result good", text: "✔ Meta cumprida: " + c.objective.desc }));
      box.appendChild(TM.ui.button("Iniciar próxima temporada", function () {
        C().newSeason(c);
        c.wagesM = seasonWageBill(c); c.fin = { incomeM: 0, expenseM: 0 }; c.aporteUsedSeason = false; c._lastSim = null;
        TM.storage.saveCoachCareer(c); TM.ui.go("director-hub");
      }, "btn primary"));
    } else {
      box.appendChild(el("div", { class: "obj-result bad", text: "✖ Meta NÃO cumprida (" + c.objective.desc + ")" }));
      box.classList.add("fired");
      box.appendChild(el("div", { class: "fired-msg", text: "🚪 A diretoria decidiu encerrar o seu ciclo como dirigente." }));
      box.appendChild(TM.ui.button("Encerrar carreira", function () { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }, "btn primary"));
    }
    screen.appendChild(box);
  }

  /* ================= TÉCNICO: contratar / demitir ================= */
  function fireFine(c) {
    var co = c.coach; if (!co || co.isInterino) return 0;
    if (co.contractMonths <= 6) return 0;
    return Math.round(co.salaryM * (co.contractMonths / 12) * 0.6);
  }
  TM.ui.register("director-coach", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("🧑‍💼 Comando técnico", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // técnico atual
    var co = c.coach, months = Math.round(co.contractMonths), fine = fireFine(c);
    body.appendChild(el("div", { class: "player-card" }, [
      coachFace(co, "pc-face"),
      el("div", { class: "pc-info" }, [
        el("div", { class: "pc-name", text: co.name + (co.isInterino ? " (interino)" : "") }),
        el("div", { class: "pc-sub", text: co.age + " anos · salário " + money(c, co.salaryM) + "/temp · contrato " + months + " mês(es)" })
      ]),
      TM.ui.ovBadge(co.rating)
    ]));
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: fine > 0
        ? "⚠️ Demitir agora custa uma multa rescisória de " + money(c, fine) + " (contrato com mais de 6 meses)."
        : "Sem multa: o contrato tem 6 meses ou menos." }),
      TM.ui.button("🚪 Demitir técnico", function () {
        TM.ui.confirm("Demitir " + co.name + "?", fine > 0 ? "Você pagará " + money(c, fine) + " de multa. Um interino assume até você contratar." : "Um interino assume até você contratar.", "Demitir", function () {
          if (fine > 0) { c.budget -= fine; c.fin.expenseM += fine; }
          TM.notify.push(c, { icon: "🚪", title: "Técnico demitido", text: co.name + " foi demitido" + (fine > 0 ? " (multa de " + money(c, fine) + ")" : "") + ". Um interino assume o comando." });
          c.coach = interino(c);
          TM.storage.saveCoachCareer(c); TM.ui.go("director-coach");
        }, true);
      }, "btn ghost")
    ]));

    // mercado de técnicos
    body.appendChild(el("div", { class: "list-head", text: "Contratar novo técnico" }));
    var search = el("input", { class: "text-input", type: "text", placeholder: "🔎 Buscar técnico…" });
    body.appendChild(search);
    var list = el("div", { class: "coach-hire-list" });
    body.appendChild(list);

    var pool = TM.data.coaches().filter(function (x) { return x.id !== co.id; })
      .map(function (x) { return { co: x, r: coachRating(x) }; })
      .sort(function (a, b) { return b.r - a.r; });
    function render(q) {
      TM.ui.clear(list);
      pool.filter(function (o) { return !q || o.co.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 60).forEach(function (o) {
        var cost = coachHireCost(c, o.r), sal = coachSalary(c, o.r);
        var afford = c.budget >= cost;
        var row = el("div", { class: "coach-hire" }, [
          coachFace(o.co, "chh-face"),
          el("div", { class: "chh-info" }, [
            el("div", { class: "chh-name", text: o.co.name }),
            el("div", { class: "chh-sub", text: "Custo " + money(c, cost) + " · salário " + money(c, sal) + "/temp" })
          ]),
          TM.ui.ovBadge(o.r),
          TM.ui.button("Contratar", function () {
            if (!afford) { TM.ui.toast("Caixa insuficiente para a contratação"); return; }
            TM.ui.confirm("Contratar " + o.co.name + "?", "Custo de " + money(c, cost) + " + salário de " + money(c, sal) + "/temporada. Contrato de 24 meses.", "Contratar", function () {
              c.budget -= cost; c.fin.expenseM += cost;
              c.coach = makeContract(c, o.co, 24);
              TM.notify.push(c, { icon: "✍️", title: "Novo técnico", text: o.co.name + " (" + o.r + ") foi contratado por " + money(c, cost) + " (salário " + money(c, sal) + "/temp)." });
              TM.storage.saveCoachCareer(c); TM.ui.go("director-hub");
            });
          }, "btn " + (afford ? "primary" : "ghost") + " small")
        ]);
        list.appendChild(row);
      });
    }
    search.addEventListener("input", function () { render(search.value.trim().toLowerCase()); });
    render("");
  });

  /* ================= VESTIÁRIO: resultados + recado ao técnico ================= */
  TM.ui.register("director-messages", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("💬 Vestiário", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // últimos resultados
    body.appendChild(el("div", { class: "list-head", text: "Últimos resultados" }));
    var results = (c.results || []).slice(-8).reverse();
    if (!results.length) {
      body.appendChild(el("p", { class: "intro-text", text: "Ainda não há jogos disputados nesta temporada." }));
    } else {
      var rl = el("div", { class: "res-list" });
      results.forEach(function (r) {
        var opp = TM.data.club(r.oppId);
        rl.appendChild(el("div", { class: "res-row " + (r.res === "V" ? "win" : r.res === "D" ? "loss" : "draw") }, [
          el("span", { class: "res-badge", text: r.res }),
          opp ? TM.img.clubImg(opp, "res-crest") : el("span", {}),
          el("div", { class: "res-main" }, [
            el("div", { class: "res-teams", text: (r.home ? "🏠 " : "✈️ ") + r.oppName }),
            el("div", { class: "res-comp", text: r.compName })
          ]),
          el("span", { class: "res-score", text: r.home ? (r.me + " × " + r.op) : (r.op + " × " + r.me) })
        ]));
      });
      body.appendChild(rl);
    }

    // humor atual do técnico
    var mo = MOOD[moodOf(c)];
    body.appendChild(el("div", { class: "mood-banner mood-" + moodOf(c) }, [
      el("span", { class: "mood-emoji", text: mo.emoji }),
      el("div", {}, [ el("div", { class: "mood-title", text: c.coach.name }), el("div", { class: "mood-sub", text: "Humor: " + mo.label } ) ])
    ]));

    // conversa
    if ((c.coachChat || []).length) {
      var chat = el("div", { class: "coach-chat" });
      c.coachChat.slice(-8).forEach(function (m) {
        chat.appendChild(el("div", { class: "chat-bubble " + (m.who === "dir" ? "me" : "coach") }, [
          el("div", { class: "chat-who", text: m.who === "dir" ? "Você (diretor)" : "👔 " + c.coach.name }),
          el("div", { class: "chat-text", text: m.text })
        ]));
      });
      body.appendChild(chat);
    }

    // escrever recado
    body.appendChild(el("div", { class: "list-head", text: "Mandar um recado ao técnico" }));
    var input = el("textarea", { class: "text-input", rows: "3", maxlength: "240", placeholder: "Escreva sua mensagem… (elogie, motive, cobre, pressione — o humor dele muda conforme o tom)" });
    body.appendChild(input);
    body.appendChild(el("div", { class: "setting-hint", text: "Dica: elogios e incentivo animam; críticas e ameaças irritam ou entristecem. O humor do técnico influencia o rendimento do time." }));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("📨 Enviar recado", function () {
        var txt = (input.value || "").trim();
        if (txt.length < 2) { TM.ui.toast("Escreva uma mensagem."); return; }
        var mood = classifyMessage(txt);
        c.coach.mood = mood;
        var reply = composeReply(c, txt, mood);
        c.coachChat = c.coachChat || [];
        c.coachChat.push({ who: "dir", text: txt });
        c.coachChat.push({ who: "coach", text: reply, mood: mood });
        if (c.coachChat.length > 16) c.coachChat = c.coachChat.slice(-16);
        TM.notify.push(c, { icon: MOOD[mood].emoji, title: "Recado ao técnico", text: c.coach.name + " agora está " + MOOD[mood].label.toLowerCase() + "." });
        TM.storage.saveCoachCareer(c);
        TM.ui.go("director-messages");
      }, "btn primary")
    ]));
  });

  /* ================= FINANÇAS ================= */
  TM.ui.register("director-finance", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("💰 Finanças", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    body.appendChild(el("div", { class: "market-budget" + (c.budget < 0 ? " debt" : ""), text: (c.budget < 0 ? "🔴 Dívida atual: " : "💰 Caixa: ") + money(c, c.budget) }));

    function line(label, val, cls) { return el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: label }), el("span", { class: "deal-val " + (cls || ""), text: val }) ]); }
    var saldo = c.fin.incomeM - c.fin.expenseM;
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "📊 Balanço da temporada " + c.season }),
      line("Receitas (bilheteria, TV, prêmios)", money(c, c.fin.incomeM), "good"),
      line("Despesas (salários, técnico, CT)", "-" + money(c, c.fin.expenseM), "bad"),
      line("Saldo da temporada", (saldo >= 0 ? "+" : "") + money(c, saldo), saldo >= 0 ? "good" : "bad"),
      line("Folha salarial do elenco (temp.)", money(c, c.wagesM)),
      line("Salário do técnico (temp.)", money(c, c.coach.salaryM)),
      line("Manutenção do CT (temp.)", money(c, ctUpkeep(c, c.ctLevel))),
      line("Patrocínio (temp.)", c.sponsor ? "+" + money(c, c.sponsor.seasonM) + " · " + c.sponsor.name : "sem patrocínio", c.sponsor ? "good" : "")
    ]));

    // aporte de investidor — adiciona verba ao caixa para gastar em contratações
    var invPanel = el("div", { class: "nego-panel" });
    invPanel.appendChild(el("div", { class: "nego-quote", text: "💵 Capte um aporte de investidor: adiciona verba direta ao caixa para você gastar em contratações." }));
    var invRow = el("div", { class: "inv-row" });
    [50, 100, 250].forEach(function (eur) {
      var amt = Math.round(eur * mult(c));
      invRow.appendChild(TM.ui.button("+ " + money(c, amt), function () {
        c.budget += amt; c.fin.incomeM += amt;
        TM.notify.push(c, { icon: "💵", title: "Aporte de investidor", text: "Um investidor injetou " + money(c, amt) + " no clube para reforços." });
        TM.storage.saveCoachCareer(c); TM.ui.toast("Caixa reforçado: +" + money(c, amt)); TM.ui.go("director-finance");
      }, "btn primary small"));
    });
    invPanel.appendChild(invRow);
    body.appendChild(invPanel);

    // pedir aporte à diretoria
    var aporte = el("div", { class: "nego-panel" });
    aporte.appendChild(el("div", { class: "nego-quote", text: "🏦 Peça um aporte à diretoria para reforçar o caixa (uma vez por temporada)." }));
    if (c.aporteUsedSeason) {
      aporte.appendChild(el("div", { class: "setting-hint", text: "Você já solicitou um aporte nesta temporada." }));
    } else {
      aporte.appendChild(TM.ui.button("Pedir aporte à diretoria", function () {
        var pos = C().currentPosition(c);
        var boardMood = c.board === "aceitavel" ? 1 : c.board === "rigorosa" ? -1 : 0;
        var chance = 0.5 + (pos <= (c.objective.maxPos || 6) ? 0.25 : -0.15) + boardMood * 0.1;
        c.aporteUsedSeason = true;
        if (Math.random() < chance) {
          var baseEur = 20 + Math.max(0, (TM.data.clubRating(c.teamId) - 60)) * 1.5;
          var grant = Math.round(baseEur * (0.6 + Math.random() * 0.8) * mult(c));
          c.budget += grant; c.fin.incomeM += grant;
          TM.notify.push(c, { icon: "🏦", title: "Aporte aprovado", text: "A diretoria liberou " + money(c, grant) + " de aporte para o clube." });
          TM.ui.toast("Aporte aprovado: " + money(c, grant));
        } else {
          TM.notify.push(c, { icon: "🚫", title: "Aporte negado", text: "A diretoria negou o pedido de aporte neste momento." });
          TM.ui.toast("A diretoria negou o aporte.");
        }
        TM.storage.saveCoachCareer(c); TM.ui.go("director-finance");
      }, "btn primary"));
    }
    body.appendChild(aporte);
  });

  /* ================= PATROCÍNIOS ================= */
  TM.ui.register("director-sponsors", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("🤝 Patrocínios", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    if (c.sponsor) {
      body.appendChild(el("div", { class: "nego-panel" }, [
        el("div", { class: "nego-quote happy", text: "✅ Patrocinador atual: " + c.sponsor.name + " — " + money(c, c.sponsor.seasonM) + "/temporada." }),
        el("div", { class: "setting-hint", text: "A receita do patrocínio entra a cada jogo, ao longo da temporada. Você pode trocar por outra proposta abaixo." })
      ]));
    } else {
      body.appendChild(el("p", { class: "intro-text", text: "Feche um patrocínio para gerar receita e reforçar o caixa. Escolha a proposta que combina com o seu projeto." }));
    }

    sponsorOffers(c).forEach(function (s) {
      body.appendChild(el("div", { class: "sponsor-card" }, [
        el("div", { class: "sp-head" }, [ el("div", { class: "sp-name", text: "🤝 " + s.name }), el("div", { class: "sp-desc", text: s.desc }) ]),
        el("div", { class: "sp-vals" }, [
          el("span", { class: "sp-tag good", text: "Bônus imediato: " + money(c, s.bonusM) }),
          el("span", { class: "sp-tag", text: "Receita: " + money(c, s.seasonM) + "/temp" })
        ]),
        TM.ui.button(c.sponsor && c.sponsor.id === s.id ? "Patrocinador atual" : "Fechar patrocínio", function () {
          if (c.sponsor && c.sponsor.id === s.id) { TM.ui.toast("Já é o seu patrocinador."); return; }
          c.budget += s.bonusM; c.fin.incomeM += s.bonusM;
          c.sponsor = { id: s.id, name: s.name, seasonM: s.seasonM };
          TM.notify.push(c, { icon: "🤝", title: "Patrocínio fechado", text: s.name + " — bônus de " + money(c, s.bonusM) + " e " + money(c, s.seasonM) + "/temporada." });
          TM.storage.saveCoachCareer(c); TM.ui.toast("Patrocínio fechado! +" + money(c, s.bonusM)); TM.ui.go("director-hub");
        }, "btn " + (c.sponsor && c.sponsor.id === s.id ? "ghost" : "primary") + " small")
      ]));
    });
  });

  /* ================= VERBA DE TRANSFERÊNCIAS (o técnico contrata) ================= */
  TM.ui.register("director-transfer", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("💸 Verba p/ reforços", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "market-budget" + (c.budget < 0 ? " debt" : ""), text: "💰 Caixa disponível: " + money(c, c.budget) }));
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "Libere uma verba e o técnico " + c.coach.name + " reforça o elenco com ela — ele escolhe e contrata os jogadores que melhoram o time, gastando até o valor liberado." })
    ]));

    function release(cap) {
      cap = Math.min(cap, c.budget);
      if (cap < 3) { TM.ui.toast("Caixa insuficiente para liberar verba."); return; }
      var r = autoSign(c, cap);
      if (!r.signed.length) {
        TM.notify.push(c, { icon: "🤷", title: "Sem reforços", text: "O técnico não encontrou reforços que melhorassem o elenco dentro da verba de " + money(c, cap) + "." });
      } else {
        r.signed.forEach(function (s) {
          TM.notify.push(c, { icon: "✍️", title: "Reforço contratado", text: "O técnico contratou " + s.name + " (" + s.ov + ", " + s.pos + ") por " + money(c, s.cost) + "." });
        });
        TM.notify.push(c, { icon: "💸", title: "Verba aplicada", text: c.coach.name + " gastou " + money(c, r.spent) + " em " + r.signed.length + " reforço(s)." });
      }
      TM.storage.saveCoachCareer(c);
      TM.ui.toast(r.signed.length ? (r.signed.length + " reforço(s) contratado(s)!") : "Nenhum reforço encontrado.");
      TM.ui.go("director-hub");
    }

    var row = el("div", { class: "inv-row" });
    [50, 100, 250].forEach(function (eur) {
      var amt = Math.round(eur * mult(c));
      row.appendChild(TM.ui.button(money(c, amt), function () { release(amt); }, "btn primary small"));
    });
    body.appendChild(el("div", { class: "nego-panel" }, [ el("div", { class: "nego-quote", text: "Escolha quanto liberar:" }), row,
      TM.ui.button("Liberar TODO o caixa (" + money(c, Math.max(0, c.budget)) + ")", function () { release(c.budget); }, "btn ghost")
    ]));
  });

  /* ================= ESTÁDIO (capacidade / receita) ================= */
  TM.ui.register("director-stadium", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    var club = TM.data.club(c.teamId), st = TM.data.stadium(club);
    screen.appendChild(TM.ui.topbar("🏟️ Estádio", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var sb = TM.ui.stadiumBanner(club, { label: st.name + " · +" + Math.round((stadIncomeMult(c) - 1) * 100) + "% de receita" });
    if (sb) body.appendChild(sb);
    var bar = el("div", { class: "ct-bar" });
    for (var i = 1; i <= 3; i++) bar.appendChild(el("div", { class: "ct-seg" + (i <= (c.stadiumUp || 0) ? " on" : "") }));
    body.appendChild(bar);
    body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "Ampliar o estádio aumenta a capacidade e a receita de bilheteria (mais dinheiro por jogo)." }));
    if ((c.stadiumUp || 0) >= 3) {
      body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "🏟️ Estádio no tamanho máximo." }));
    } else {
      var next = (c.stadiumUp || 0) + 1, cost = stadUpgradeCost(c, next), afford = c.budget >= cost;
      body.appendChild(el("div", { class: "nego-panel" }, [
        el("div", { class: "nego-quote", text: "Ampliação nível " + next + ": custa " + money(c, cost) + " e eleva a receita para +" + Math.round((1 + 0.14 * next - 1) * 100) + "%." }),
        TM.ui.button("🏗️ Ampliar estádio (" + money(c, cost) + ")", function () {
          if (!afford) { TM.ui.toast("Caixa insuficiente."); return; }
          TM.ui.confirm("Ampliar o estádio?", "Custo de " + money(c, cost) + ".", "Ampliar", function () {
            c.budget -= cost; c.fin.expenseM += cost; c.stadiumUp = next;
            TM.notify.push(c, { icon: "🏟️", title: "Estádio ampliado", text: "A capacidade do " + st.name + " aumentou — mais receita de bilheteria por jogo." });
            TM.storage.saveCoachCareer(c); TM.ui.go("director-stadium");
          });
        }, "btn " + (afford ? "primary" : "ghost"))
      ]));
    }
  });

  /* ================= CT (centro de treinamento) ================= */
  TM.ui.register("director-ct", function (screen) {
    var c = TM.storage.coachCareer(); ensureDirector(c);
    screen.appendChild(TM.ui.topbar("🏟️ Centro de Treinamento", function () { TM.ui.go("director-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    body.appendChild(el("div", { class: "ct-level" }, [
      el("div", { class: "ct-badge", text: "Nível " + c.ctLevel }),
      el("div", {}, [ el("div", { class: "ct-name", text: ctDesc(c.ctLevel) + " CT" }), el("div", { class: "setting-hint", text: "Um CT melhor dá um empurrão nos resultados do time (o elenco rende mais). Quanto maior o nível, mais forte o efeito." }) ])
    ]));

    // barra de níveis
    var bar = el("div", { class: "ct-bar" });
    for (var i = 1; i <= 5; i++) bar.appendChild(el("div", { class: "ct-seg" + (i <= c.ctLevel ? " on" : "") }));
    body.appendChild(bar);

    if (c.ctLevel >= 5) {
      body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "🏆 Seu CT já é elite mundial — nível máximo." }));
    } else {
      var next = c.ctLevel + 1, cost = ctUpgradeCost(c, next), afford = c.budget >= cost;
      body.appendChild(el("div", { class: "nego-panel" }, [
        el("div", { class: "nego-quote", text: "Melhorar para o nível " + next + " (" + ctDesc(next) + ") custa " + money(c, cost) + "." }),
        TM.ui.button("🏗️ Melhorar CT (" + money(c, cost) + ")", function () {
          if (!afford) { TM.ui.toast("Caixa insuficiente para a obra"); return; }
          TM.ui.confirm("Investir no CT?", "Custo de " + money(c, cost) + " para chegar ao nível " + next + ".", "Investir", function () {
            c.budget -= cost; c.fin.expenseM += cost; c.ctLevel = next;
            TM.notify.push(c, { icon: "🏟️", title: "CT melhorado", text: "O CT foi elevado ao nível " + next + " (" + ctDesc(next) + ")." });
            TM.storage.saveCoachCareer(c); TM.ui.go("director-ct");
          });
        }, "btn " + (afford ? "primary" : "ghost"))
      ]));
    }
  });

  TM.director = { start: start, ensureDirector: ensureDirector, coachRating: coachRating };
})(window);
