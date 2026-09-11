/* ================= TOTAL MATCH — Finanças avançadas =================
   Parcelas de contratações com vencimento (pagas MANUALMENTE em Finanças), avisos de pagamento,
   transfer ban por inadimplência (1 a 3 janelas), bônus por metas e % de venda futura que realmente
   pagam, cláusulas de rescisão (valor escolhido pelo treinador / clubes que só liberam pela cláusula)
   e sistema de endividamento com consequências progressivas até o rompimento da SAF. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function money(c, v) { return C().fmtMoney(c, v); }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function R(n) { return Math.round(n * 100) / 100; }
  function save(c) { TM.storage.saveCoachCareer(c); }
  function note(c, n) { return TM.notify.push(c, n); }
  function season(c) { return c.season || 1; }
  function day(c) { return c.currentDay || 0; }
  function finc(c) { c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; return c.finc; }
  function phash(s) { s = String(s || ""); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dateTxt(c, s, d) {
    if (s === season(c)) { try { return C().dateOf(c, d).short; } catch (e) { return "dia " + d; } }
    return "temp. " + s + " (dia " + d + ")";
  }
  var SEASON_LEN = 330;          // parcelas que passam do fim da temporada vencem no início da próxima
  var INSTALL_GAP = 120;         // dias entre parcelas (~4 meses)

  /* =================== PARCELAS =================== */
  function migrate(c) {
    if (!c) return;
    c.installments = c.installments || [];
    c.installments.forEach(function (it, i) {
      if (it.id == null) it.id = "in" + (Date.now().toString(36)) + i;
      if (it.total == null) it.total = (it.left || 0) + 1;
      if (it.dueSeason == null) { var d = due(c, i + 1); it.dueSeason = d.s; it.dueDay = d.d; }
      if (it.paidCount == null) it.paidCount = 1;
    });
  }
  function due(c, k) {
    var s = season(c), d = day(c) + INSTALL_GAP * k;
    while (d > SEASON_LEN) { d -= SEASON_LEN; s++; }
    return { s: s, d: d };
  }
  // cria as parcelas de uma compra parcelada (a entrada já foi paga)
  function addInstallments(c, o) {
    c.installments = c.installments || [];
    var n = Math.max(0, (o.parts || 1) - 1); if (n <= 0) return null;
    var d = due(c, 1);
    var it = { id: "in" + Date.now().toString(36) + Math.floor(Math.random() * 1e4), pid: o.pid, name: o.name, per: R(o.per), left: n, total: o.parts,
      to: o.toName || "", toId: o.toId || null, dueSeason: d.s, dueDay: d.d, paidCount: 1, overdue: false, warned: false, since: null };
    c.installments.push(it);
    note(c, { icon: "💳", title: "Compra parcelada", fin: true, text: o.name + " em " + o.parts + "x de " + money(c, it.per) + ". A próxima parcela vence em " + dateTxt(c, d.s, d.d) + " — o pagamento é feito por você em 💰 Finanças." });
    return it;
  }
  function isDue(c, it) { return season(c) > it.dueSeason || (season(c) === it.dueSeason && day(c) >= it.dueDay); }
  function daysToDue(c, it) { return (it.dueSeason - season(c)) * SEASON_LEN + it.dueDay - day(c); }
  function daysOverdue(c, it) { return Math.max(0, -daysToDue(c, it)); }
  function pending(c) { return (c.installments || []).filter(function (it) { return (it.left || 0) > 0; }); }
  function overdueList(c) { return pending(c).filter(function (it) { return isDue(c, it); }); }
  function overdueCreditors(c) {
    var seen = {}; overdueList(c).forEach(function (it) { seen[it.toId || it.pid] = 1; });
    return Object.keys(seen).length;
  }
  function pendingTotal(c) { return R(pending(c).reduce(function (s, it) { return s + it.per * it.left; }, 0)); }
  function overdueTotal(c) { return R(overdueList(c).reduce(function (s, it) { return s + it.per; }, 0)); }
  function payInstallment(c, it) {
    if (!it || it.left <= 0) return false;
    if (c.budget < it.per) { TM.ui.toast("Caixa insuficiente para pagar " + money(c, it.per) + "."); return false; }
    c.budget = R(c.budget - it.per); finc(c).spentM = R((finc(c).spentM || 0) + it.per);
    it.left--; it.paidCount = (it.paidCount || 1) + 1; it.overdue = false; it.warned = false;
    if (it.left > 0) { var d = due(c, 1); it.dueSeason = d.s; it.dueDay = d.d; }
    c.installments = c.installments.filter(function (x) { return x.left > 0; });
    note(c, { icon: "✅", title: "Parcela paga", text: "Paga a parcela de " + money(c, it.per) + " de " + it.name + (it.to ? " ao " + it.to : "") + (it.left > 0 ? ". Faltam " + it.left + " (próxima em " + dateTxt(c, it.dueSeason, it.dueDay) + ")." : ". Compra quitada.") });
    try { C().logDeal(c, { type: "out", kind: "installment", pid: it.pid, name: "Parcela · " + it.name, pos: "", ov: 0, fee: it.per, other: it.to || "" }); } catch (e) {}
    save(c);
    return true;
  }

  /* =================== TRANSFER BAN =================== */
  // próximos fechamentos de janela (nesta e nas próximas temporadas), em ordem
  function upcomingWindowCloses(c, n) {
    var out = [], ws = (c.windows || []).slice().sort(function (a, b) { return a.openDay - b.openDay; });
    if (!ws.length) ws = [{ openDay: 0, closeDay: 60 }, { openDay: 150, closeDay: 200 }];
    for (var s = season(c); out.length < n && s < season(c) + 4; s++) {
      ws.forEach(function (w) { if (out.length < n && (s > season(c) || w.closeDay > day(c))) out.push({ s: s, d: w.closeDay, name: w.name || "janela" }); });
    }
    return out;
  }
  function banned(c) {
    var b = c && c.transferBan; if (!b) return false;
    if (season(c) > b.untilSeason || (season(c) === b.untilSeason && day(c) >= b.untilDay)) {
      c.transferBan = null; note(c, { icon: "🟢", title: "Transfer ban encerrado", news: true, text: "O clube cumpriu a punição e volta a poder registrar contratações." }); save(c); return false;
    }
    return true;
  }
  function banInfo(c) { return banned(c) ? c.transferBan : null; }
  function applyBan(c, windows, why) {
    windows = Math.max(1, Math.min(3, windows));
    var closes = upcomingWindowCloses(c, windows), last = closes[closes.length - 1];
    var cur = c.transferBan;
    if (cur && (cur.untilSeason > last.s || (cur.untilSeason === last.s && cur.untilDay >= last.d))) return cur; // já está punido por mais tempo
    c.transferBan = { windows: windows, untilSeason: last.s, untilDay: last.d, why: why, sinceSeason: season(c), sinceDay: day(c) };
    c.confidence = Math.max(0, (c.confidence == null ? 50 : c.confidence) - 8);
    note(c, { icon: "🚫", title: "TRANSFER BAN", news: true, fin: true, text: "A FIFA proibiu o clube de registrar contratações por " + windows + " janela(s) — " + why + ". A punição vale até " + dateTxt(c, last.s, last.d) + ". Vendas continuam liberadas." });
    try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: "🚫", title: "Transfer ban", text: TM.data.club(c.teamId).name + " é punido pela FIFA com transfer ban de " + windows + " janela(s) por dívidas de transferências." }); } catch (e) {}
    return c.transferBan;
  }
  function banLabel(c) {
    var b = banInfo(c); if (!b) return "";
    return "🚫 Transfer ban até " + dateTxt(c, b.untilSeason, b.untilDay) + " (" + b.windows + " janela" + (b.windows > 1 ? "s" : "") + ") — " + b.why;
  }
  // caixa de aviso para as telas de negociação/mercado
  function banBox(c, back) {
    var b = banInfo(c); if (!b) return null;
    return el("div", { class: "untransfer-box" }, [
      el("div", { class: "ut-ic", text: "🚫" }),
      el("div", { class: "ut-t", text: "Transfer ban em vigor" }),
      el("div", { class: "ut-s", text: "O clube não pode registrar contratações (compras, empréstimos ou jogadores livres) até " + dateTxt(c, b.untilSeason, b.untilDay) + ". Motivo: " + b.why + ". Quite as parcelas em 💰 Finanças para não estender a punição." }),
      el("div", { class: "note-actions" }, [
        TM.ui.button("💰 Ir a Finanças", function () { TM.ui.go("coach-finance"); }, "btn primary small"),
        back ? TM.ui.button("← Voltar", function () { TM.ui.go(back); }, "btn ghost small") : null
      ].filter(Boolean))
    ]);
  }

  /* =================== BÔNUS POR METAS e % DE VENDA FUTURA =================== */
  var BONUS_APPS = 20;   // meta: 20 jogos na temporada pelo clube
  function dealTerm(c, pid) { return c.dealTerms && c.dealTerms[pid]; }
  function setDealTerms(c, o) {
    c.dealTerms = c.dealTerms || {};
    c.dealTerms[o.pid] = { bonus: o.bonus || 0, sellOn: o.sellOn || 0, toId: o.toId || null, toName: o.toName || "", target: BONUS_APPS, paid: false, season: season(c), fee: o.fee || 0 };
  }
  function checkBonuses(c) {
    var dt = c.dealTerms; if (!dt) return;
    Object.keys(dt).forEach(function (pid) {
      var t = dt[pid]; if (!t || !t.bonus || t.paid) return;
      if ((c.roster || []).indexOf(pid) < 0) return;
      var st = c.pstats && c.pstats[pid]; var apps = st ? (st.apps || 0) : 0;
      if (apps >= (t.target || BONUS_APPS)) {
        t.paid = true; c.budget = R(c.budget - t.bonus); finc(c).spentM = R((finc(c).spentM || 0) + t.bonus);
        var p = C().resolvePlayer(c, pid);
        note(c, { icon: "🎯", title: "Bônus por metas pago", fin: true, text: (p ? p.name : "Jogador") + " completou " + apps + " jogos na temporada: o bônus de " + money(c, t.bonus) + " combinado na compra foi pago ao " + (t.toName || "clube vendedor") + "." });
        try { C().logDeal(c, { type: "out", kind: "bonus", pid: pid, name: "Bônus por metas · " + (p ? p.name : ""), pos: "", ov: 0, fee: t.bonus, other: t.toName || "" }); } catch (e) {}
      }
    });
  }
  // venda de um jogador comprado com % de venda futura -> parte vai ao clube anterior
  function onSale(c, pid, fee) {
    var t = dealTerm(c, pid); if (!t || !t.sellOn || !fee) return 0;
    var cut = R(fee * t.sellOn / 100);
    c.budget = R(c.budget - cut); finc(c).spentM = R((finc(c).spentM || 0) + cut);
    var p = C().resolvePlayer(c, pid);
    note(c, { icon: "📈", title: "% de venda futura", fin: true, text: "O " + (t.toName || "clube anterior") + " tinha direito a " + t.sellOn + "% da venda de " + (p ? p.name : "jogador") + ": " + money(c, cut) + " repassados." });
    try { C().logDeal(c, { type: "out", kind: "sellon", pid: pid, name: t.sellOn + "% de venda · " + (p ? p.name : ""), pos: "", ov: 0, fee: cut, other: t.toName || "" }); } catch (e) {}
    delete c.dealTerms[pid];
    return cut;
  }
  function seasonEnd(c) {
    // bônus não atingido nesta temporada: a meta vale de novo na próxima (o clube vendedor segue esperando)
    // parcelas continuam com seus vencimentos; nada é debitado automaticamente
    migrate(c);
    var dt = c.dealTerms || {};
    Object.keys(dt).forEach(function (pid) { if ((c.roster || []).indexOf(pid) < 0) delete dt[pid]; });
  }

  /* =================== ENDIVIDAMENTO =================== */
  function clubRevenue(c) { try { var r = TM.data.clubRating(c.teamId), m = mult(c); return Math.max(3 * m, (19 + Math.max(0, r - 55) * 4.3) * m); } catch (e) { return 20; } }
  function debtInfo(c) {
    var rev = clubRevenue(c), f = [], score = 0;
    var neg = c.budget < 0 ? -c.budget : 0;
    if (neg > 0) { var s1 = Math.min(45, Math.round(neg / rev * 60)); score += s1; f.push({ t: "Caixa negativo: " + money(c, neg), v: s1 }); }
    var od = overdueTotal(c), on = overdueList(c).length;
    if (on) { var s2 = Math.min(35, 8 * on + Math.round(od / rev * 40)); score += s2; f.push({ t: on + " parcela(s) vencida(s): " + money(c, od), v: s2 }); }
    var loans = (c.loans || []).filter(function (l) { return l.left > 0; });
    if (loans.length) { var tot = loans.reduce(function (s, l) { return s + l.perM * l.left; }, 0); var s3 = Math.min(20, Math.round(tot / rev * 25)); score += s3; f.push({ t: loans.length + " empréstimo(s) bancário(s): " + money(c, R(tot)) + " a pagar", v: s3 }); }
    var pen = pendingTotal(c) - od;
    if (pen > 0) { var s4 = Math.min(10, Math.round(pen / rev * 12)); score += s4; f.push({ t: "Parcelas a vencer: " + money(c, R(pen)), v: s4 }); }
    var wages = 0; try { C().rosterPlayers(c).forEach(function (p) { var li = c.loanedIn && c.loanedIn[p.id]; wages += (TM.data.marketValue(p) || 0) * 0.075 * (li && li.share != null ? li.share / 100 : 1); }); wages = R(wages * mult(c)); } catch (e) {}
    if (wages > rev * 0.85) { var s5 = Math.min(15, Math.round((wages / rev - 0.85) * 40)); score += s5; f.push({ t: "Folha salarial acima da receita (" + Math.round(wages / rev * 100) + "%)", v: s5 }); }
    if (banInfo(c)) { score += 10; f.push({ t: "Transfer ban em vigor", v: 10 }); }
    score = Math.max(0, Math.min(100, score));
    var level = score >= 85 ? 4 : score >= 60 ? 3 : score >= 35 ? 2 : score >= 15 ? 1 : 0;
    var LBL = ["Saudável", "Atenção", "Endividado", "Crise", "Insolvência"], ICO = ["🟢", "🟡", "🟠", "🔴", "💀"];
    return { score: score, level: level, label: LBL[level], icon: ICO[level], factors: f, rev: rev };
  }
  var CONSEQ = [
    "Sem consequências. As contas estão em dia.",
    "A diretoria pede cautela. Nada ainda, mas o investidor e os patrocinadores observam.",
    "A diretoria perde confiança a cada mês. O investidor da SAF fica insatisfeito. Bancos cobram juros maiores.",
    "Confiança despenca; SAF ameaça romper; a FIFA pode aplicar transfer ban; patrocinadores podem sair.",
    "Insolvência: rompimento da SAF, transfer ban imediato e risco real de demissão pela diretoria."
  ];
  function tickDebt(c) {
    var di = debtInfo(c);
    c.debt = c.debt || { level: 0, sinceDay: null, sinceSeason: null, lastTickAbs: -999, lastLevel: 0 };
    var abs = season(c) * SEASON_LEN + day(c);
    if (di.level !== c.debt.level) {
      var up = di.level > c.debt.level;
      c.debt.level = di.level; c.debt.sinceSeason = season(c); c.debt.sinceDay = day(c);
      if (di.level >= 2 || (!up && c.debt.lastLevel >= 2)) note(c, { icon: di.icon, title: "Endividamento: " + di.label, news: di.level >= 3, fin: true, text: (up ? "A situação financeira piorou. " : "A situação financeira melhorou. ") + CONSEQ[di.level] + " Índice " + di.score + "/100 — detalhes em 💰 Finanças." });
      c.debt.lastLevel = di.level;
    }
    if (abs - c.debt.lastTickAbs < 30) return;      // consequências a cada ~30 dias
    c.debt.lastTickAbs = abs;
    if (di.level >= 2) { c.confidence = Math.max(0, (c.confidence == null ? 50 : c.confidence) - (di.level >= 4 ? 12 : di.level === 3 ? 7 : 3)); }
    if (di.level >= 2 && c.saf && TM.saf && TM.saf.sat) TM.saf.sat(c, di.level >= 4 ? -25 : di.level === 3 ? -14 : -6, "endividamento do clube (" + di.label.toLowerCase() + ")");
    if (di.level >= 3) {
      var months = Math.round((abs - (c.debt.sinceSeason * SEASON_LEN + c.debt.sinceDay)) / 30);
      if (c.saf && months >= 2 && Math.random() < 0.5) { note(c, { icon: "⚠️", title: "Investidor ameaça sair", fin: true, text: c.saf.investor + " avisa: se o endividamento não cair em 30 dias, a SAF será rompida." }); c.debt.safWarned = true; }
      if (c.saf && c.debt.safWarned && months >= 3 && TM.saf && TM.saf.breakSaf) { TM.saf.breakSaf(c, "endividamento do clube"); c.debt.safWarned = false; }
      if (di.level >= 4 && !banInfo(c)) applyBan(c, 1, "insolvência financeira");
      if (di.level >= 4 && Math.random() < 0.35) {
        var tier = (c.sponsors && ["master", "secondary", "sleeve"].filter(function (t) { return c.sponsors[t]; })[0]);
        if (tier) { var nm = c.sponsors[tier].name; c.sponsors[tier] = null; c.sponsor = c.sponsors.master || null; note(c, { icon: "🤝", title: "Patrocinador saiu", news: true, text: nm + " rompeu o contrato de patrocínio por causa da situação financeira do clube." }); }
      }
      if (di.level >= 4 && c.saf && TM.saf && TM.saf.breakSaf && months >= 1) { TM.saf.breakSaf(c, "insolvência do clube"); }
      if (di.level >= 4 && months >= 4 && Math.random() < 0.4 && !c.leaveAtSeasonEnd) { c.confidence = 0; note(c, { icon: "🪑", title: "Diretoria em pânico", news: true, text: "Com o clube insolvente, a diretoria coloca seu cargo em risco: a confiança chegou a zero." }); }
    }
  }

  /* =================== TICK (a cada visita ao hub) =================== */
  function tick(c) {
    if (!c) return; migrate(c);
    var changed = false;
    pending(c).forEach(function (it) {
      var dd = daysToDue(c, it);
      if (dd > 0 && dd <= 10 && !it.warned) { it.warned = true; changed = true; note(c, { icon: "🔔", title: "Parcela vence em " + dd + " dia" + (dd > 1 ? "s" : ""), fin: true, text: "Parcela de " + money(c, it.per) + " de " + it.name + (it.to ? " (" + it.to + ")" : "") + " vence em " + dateTxt(c, it.dueSeason, it.dueDay) + ". Pague em 💰 Finanças para não entrar na lista de inadimplentes." }); }
      if (dd <= 0 && !it.overdue) { it.overdue = true; it.since = { s: season(c), d: day(c) }; changed = true; note(c, { icon: "⚠️", title: "Parcela VENCIDA", fin: true, text: "Você não pagou a parcela de " + money(c, it.per) + " de " + it.name + (it.to ? " ao " + it.to : "") + ". O clube credor registrou a dívida na FIFA. Mais de 2 clubes/jogadores sem pagamento = transfer ban." }); }
      if (dd <= -30 && it.overdue && !it.warned2) { it.warned2 = true; changed = true; note(c, { icon: "📮", title: "Cobrança formal", fin: true, text: (it.to || "O credor") + " notificou a FIFA pelo atraso de 30 dias na parcela de " + it.name + " (" + money(c, it.per) + ")." }); }
    });
    var creditors = overdueCreditors(c);
    if (creditors > 2) {
      var maxDays = Math.max.apply(null, overdueList(c).map(function (it) { return daysOverdue(c, it); }).concat([0]));
      var w = 1 + (creditors >= 4 ? 1 : 0) + (maxDays >= 60 ? 1 : 0);
      if (!banInfo(c)) { applyBan(c, w, "parcelas de " + creditors + " clubes/jogadores em atraso"); changed = true; }
      else if (c.transferBan.windows < w && !c.transferBan.extended) { c.transferBan.extended = true; applyBan(c, w, "inadimplência persistente"); changed = true; }
    }
    banned(c);
    checkBonuses(c);
    tickDebt(c);
    if (changed) save(c);
  }

  /* =================== CLÁUSULAS DE RESCISÃO =================== */
  // cláusula de um jogador de outro clube (determinística): ~50% têm; múltiplo 1.6x a 4x do valor (mais para peças-chave)
  function worldClause(p) {
    if (!p || p.freeAgent || !p.clubId) return 0;
    var h = phash(p.id + ":wcl");
    if (h % 100 >= 50) return 0;
    var val = TM.data.marketValue(p) || 1;
    var m = 1.6 + ((h >>> 8) % 25) / 10;                      // 1.6 .. 4.0
    if ((p.overall || 0) >= 84) m += 1.2;
    if ((p.age || 25) <= 22 && (p.potential || 0) - (p.overall || 0) >= 6) m += 0.8;
    return R(val * m);
  }
  // como o clube trata a cláusula: "only" (só libera pela cláusula), "either" (negocia, mas a cláusula é atalho), null (sem cláusula)
  function clauseMode(p, stance) {
    var cl = worldClause(p); if (!cl) return null;
    var h = phash(p.id + ":cmode") % 100;
    if (isNaN(h)) h = 50;
    var only = (stance && (stance.isKey || !stance.willSell)) ? h < 70 : h < 30;
    return only ? "only" : "either";
  }
  function myClause(c, pid) { var ct = c.contracts && c.contracts[pid]; return ct && ct.clause ? ct.clause : 0; }

  /* =================== PAINÉIS (tela Finanças) =================== */
  function panels(c, body) {
    migrate(c);
    // ---- parcelas ----
    var list = pending(c);
    var head = el("div", { class: "fin-cat" });
    head.appendChild(el("div", { class: "fin-cat-h", html: "💳 Parcelas de contratações <b>" + (list.length ? money(c, pendingTotal(c)) : "nenhuma") + "</b>" }));
    var b = banInfo(c);
    if (b) head.appendChild(el("div", { class: "fin-ban", text: banLabel(c) }));
    if (!list.length) head.appendChild(el("div", { class: "setting-hint", text: "Nenhuma parcela em aberto. Compras parceladas aparecem aqui com data de vencimento — o pagamento é manual." }));
    list.sort(function (a, b2) { return daysToDue(c, a) - daysToDue(c, b2); }).forEach(function (it) {
      var dd = daysToDue(c, it), over = dd <= 0;
      var st = over ? "VENCIDA há " + (-dd) + " dia" + (-dd !== 1 ? "s" : "") : dd <= 10 ? "vence em " + dd + " dia" + (dd !== 1 ? "s" : "") : "vence em " + dateTxt(c, it.dueSeason, it.dueDay);
      head.appendChild(el("div", { class: "inst-row" + (over ? " over" : dd <= 10 ? " soon" : "") }, [
        el("div", { class: "inst-info" }, [
          el("div", { class: "inst-name", text: it.name + (it.to ? " → " + it.to : "") }),
          el("div", { class: "inst-sub", text: "Parcela " + (it.paidCount || 1) + "/" + (it.total || (it.left + 1)) + " · " + money(c, it.per) + " · " + st + (it.left > 1 ? " · faltam " + it.left : "") })
        ]),
        TM.ui.button(c.budget >= it.per ? "Pagar " + money(c, it.per) : "Sem caixa", function () { if (payInstallment(c, it)) { TM.ui.toast("Parcela paga ✅"); TM.ui.go("coach-finance"); } }, "btn " + (over ? "primary" : "") + " small")
      ]));
    });
    if (list.length > 1) {
      var tot = R(list.reduce(function (s, it) { return s + it.per; }, 0));
      head.appendChild(el("div", { class: "note-actions" }, [ TM.ui.button("Pagar todas as próximas (" + money(c, tot) + ")", function () {
        if (c.budget < tot) { TM.ui.toast("Caixa insuficiente."); return; }
        list.slice().forEach(function (it) { payInstallment(c, it); }); TM.ui.go("coach-finance");
      }, "btn ghost small") ]));
    }
    head.appendChild(el("div", { class: "setting-hint", text: "Regra: mais de 2 clubes/jogadores com parcelas vencidas = transfer ban (1 janela; 2 com 4+ credores; 3 se algum atraso passar de 60 dias)." }));
    body.appendChild(head);

    // ---- compromissos (bônus e % de venda) ----
    var dt = c.dealTerms || {}, keys = Object.keys(dt).filter(function (pid) { return dt[pid] && (dt[pid].bonus && !dt[pid].paid || dt[pid].sellOn) && (c.roster || []).indexOf(pid) >= 0; });
    if (keys.length) {
      var box = el("div", { class: "fin-cat" }, [ el("div", { class: "fin-cat-h", text: "🎯 Compromissos de compra" }) ]);
      keys.forEach(function (pid) {
        var t = dt[pid], p = C().resolvePlayer(c, pid); if (!p) return;
        var st = c.pstats && c.pstats[pid]; var apps = st ? st.apps || 0 : 0; var parts = [];
        if (t.bonus && !t.paid) parts.push("bônus de " + money(c, t.bonus) + " ao atingir " + (t.target || BONUS_APPS) + " jogos na temporada (" + apps + "/" + (t.target || BONUS_APPS) + ")");
        if (t.sellOn) parts.push(t.sellOn + "% de uma venda futura para o " + (t.toName || "clube anterior"));
        box.appendChild(el("div", { class: "inst-row" }, [ el("div", { class: "inst-info" }, [ el("div", { class: "inst-name", text: p.name }), el("div", { class: "inst-sub", text: parts.join(" · ") }) ]) ]));
      });
      body.appendChild(box);
    }

    // ---- endividamento ----
    var di = debtInfo(c);
    var dbox = el("div", { class: "fin-cat" }, [
      el("div", { class: "fin-cat-h", html: "📊 Endividamento <b>" + di.icon + " " + di.label + " · " + di.score + "/100</b>" }),
      el("div", { class: "debt-bar" }, [ el("div", { class: "debt-fill lv" + di.level, style: "width:" + Math.max(3, di.score) + "%" }) ]),
      el("div", { class: "setting-hint", text: CONSEQ[di.level] })
    ]);
    if (di.factors.length) di.factors.forEach(function (f) { dbox.appendChild(el("div", { class: "debt-f" }, [ el("span", { text: f.t }), el("span", { class: "debt-fv", text: "+" + f.v }) ])); });
    else dbox.appendChild(el("div", { class: "debt-f" }, [ el("span", { text: "Sem dívidas relevantes." }) ]));
    dbox.appendChild(el("div", { class: "setting-hint", text: "Como cai: pague parcelas vencidas, tire o caixa do negativo (venda jogadores, prêmios, patrocínios) e quite empréstimos. Endividamento alto derruba a confiança, irrita o investidor da SAF (até rompê-la), gera transfer ban e pode custar o seu cargo." }));
    body.appendChild(dbox);
  }

  TM.fin = { migrate: migrate, tick: tick, seasonEnd: seasonEnd, addInstallments: addInstallments, pending: pending, overdueList: overdueList, payInstallment: payInstallment,
    banned: banned, banInfo: banInfo, banBox: banBox, banLabel: banLabel, applyBan: applyBan, setDealTerms: setDealTerms, onSale: onSale, checkBonuses: checkBonuses,
    debtInfo: debtInfo, panels: panels, worldClause: worldClause, clauseMode: clauseMode, myClause: myClause, BONUS_APPS: BONUS_APPS };
})(window);
