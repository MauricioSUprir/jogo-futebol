/* ================= TOTAL MATCH — Propostas recebidas v2 (imersivo) =================
   Proposta chega com porta-voz do clube comprador (técnico real, com foto), motivo, prazo, estrutura de pagamento
   (à vista/parcelado, bônus, % de venda futura) e humor. Você negocia numa conversa: contraproposta, exigir
   à vista, bônus e % de revenda, ouvir o jogador, consultar a diretoria, sentir a torcida, pedir prazo.
   O comprador tem paciência, faz proposta final, desiste ou entra em leilão com outro clube. Ao vender:
   decisão do jogador com motivo, despedida, notícias, redes, parcelas a receber em Finanças. */
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
  function day(c) { return c.currentDay || 0; }
  function phash(s) { s = String(s || ""); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function curVal(c, eur) { return R(eur * mult(c)); }
  function rating(id) { try { return TM.data.clubRating(id); } catch (e) { return 70; } }
  function myClub(c) { return TM.data.club(c.teamId); }
  function idol(c, p) { try { return TM.coachUI && TM.coachUI.idolStatus ? TM.coachUI.idolStatus(c, p) : null; } catch (e) { return null; } }
  function agent(p) { try { return TM.coachUI && TM.coachUI.agentOf ? TM.coachUI.agentOf(p) : null; } catch (e) { return null; } }
  function isRival(c, id) { try { return !!TM.data.areRivals(c.teamId, id); } catch (e) { return false; } }
  function dateTxt(c, d) { try { return C().dateOf(c, d).short; } catch (e) { return "dia " + d; } }

  /* ---------- enriquecimento da proposta (idempotente; também migra propostas antigas) ---------- */
  var REASONS = [
    "Nosso técnico pediu {p} pessoalmente: encaixa exatamente no sistema dele.",
    "Perdemos um titular para uma lesão longa e {p} é o substituto ideal.",
    "Estamos montando um elenco para brigar por títulos e {p} é peça-chave do projeto.",
    "Acompanhamos {p} há duas temporadas. É a nossa prioridade nesta janela.",
    "Nosso departamento de análise aponta {p} como o melhor custo-benefício da posição.",
    "Vamos vender um atleta caro e {p} chegaria para assumir a vaga imediatamente."
  ];
  var MOODS = [
    { id: "calmo", label: "Cordial", tone: "low", patience: 5 },
    { id: "direto", label: "Direto ao ponto", tone: "mid", patience: 4 },
    { id: "duro", label: "Osso duro", tone: "high", patience: 3 },
    { id: "ansioso", label: "Com pressa", tone: "mid", patience: 3 }
  ];
  function enrich(c, n) {
    var off = n && n.offer; if (!off) return null;
    if (off.v2) return off;
    var p = C().resolvePlayer(c, off.playerId), buyer = TM.data.club(off.buyerId); if (!p || !buyer) return off;
    var h = phash(n.id + ":" + off.playerId + ":" + off.buyerId);
    var mood = MOODS[h % MOODS.length];
    off.v2 = true; off.mood = mood.id; off.patience = mood.patience; off.rounds = 0; off.history = [];
    off.reason = REASONS[(h >>> 4) % REASONS.length].replace("{p}", p.name);
    off.deadlineDay = day(c) + 8 + ((h >>> 8) % 4);                    // 8 a 11 dias para responder (2 a 3 rodadas; os jogos avançam 4 dias)
    off.spokesman = buyer.coach ? { name: buyer.coach, role: "Técnico", photoKey: buyer.coachPhotoKey || null } : { name: "Diretor de futebol", role: "Diretoria", photoKey: null };
    off.parts = (off.fee || 0) >= 1 ? 1 + ((h >>> 12) % 3) : 1;          // 1, 2 ou 3 parcelas (só faz sentido acima de 1M)
    off.bonus = 0; off.sellOn = 0; off.upfront = off.parts > 1;
    off.final = !!off.finalOffer; off.ceil = ceiling(c, n);
    var w = wantsInfo(c, off, p); off.wants = w.wants; off.wantLine = w.line; off.forceWants = w.wants;
    off.arrivedDay = day(c);
    return off;
  }
  function ceiling(c, n) { try { return C().buyerCeiling(c, n); } catch (e) { return n.offer.fee * 1.2; } }

  /* ---------- o que o JOGADOR quer ---------- */
  function wantsInfo(c, off, p) {
    var my = rating(c.teamId), his = rating(off.buyerId), buyer = TM.data.club(off.buyerId);
    var score = 50 + (his - my) * 6;
    var ct = c.contracts && c.contracts[p.id]; if (ct && ct.years <= 1) score += 12;
    var st = c.pstats && c.pstats[p.id]; var played = (c.stats && c.stats.p) || 0;
    if (st && played >= 5 && st.apps / played < 0.4) score += 18;        // pouco espaço: quer sair
    var ido = idol(c, p); if (ido && (ido.cls === "idol" || ido.cls === "legend")) score -= 22;
    if ((p.age || 25) >= 32) score += 6;
    if (isRival(c, off.buyerId)) score -= 25;
    var dh = phash("wants:" + off.playerId + ":" + off.buyerId + ":" + (c.season || 1)) % 100;
    var wants = (dh < Math.max(8, Math.min(92, score)));
    var lines;
    if (wants) lines = his - my >= 4 ? ["“Treinador, é o " + buyer.name + ". É o passo que eu esperava. Peço que não dificulte.”", "“Sonho em jogar num clube desse tamanho. Aceite, por favor.”"]
      : (st && played >= 5 && st.apps / played < 0.4) ? ["“Não estou jogando aqui. Preciso de minutos, e o " + buyer.name + " me garante isso.”"]
      : ["“Se o clube achar bom, eu topo. Quero ser bem tratado, mas entendo o negócio.”", "“É uma boa proposta pra mim e pra minha família. Eu iria.”"];
    else lines = isRival(c, off.buyerId) ? ["“Pro " + buyer.name + "? Jamais. Não faço isso com a nossa torcida.”"]
      : (ido && ido.cls !== "home") ? ["“Minha história é aqui. Só saio se o senhor me mandar embora.”", "“Não quero sair. Aqui é a minha casa.”"]
      : ["“Prefiro ficar. Estou feliz e tenho objetivos aqui.”", "“Agora não. Quero terminar a temporada com o grupo.”"];
    return { wants: wants, line: pick(lines) };
  }
  /* ---------- diretoria e torcida ---------- */
  function boardInfo(c, off, p) {
    var value = curVal(c, C().valueOf ? C().valueOf(c, p) : TM.data.marketValue(p)), ido = idol(c, p);
    var minOk = R(value * (ido && ido.cls !== "home" ? 1.35 : 1.0));
    var debt = 0; try { debt = TM.fin ? TM.fin.debtInfo(c).level : 0; } catch (e) {}
    var line;
    if (debt >= 3) line = "“Estamos endividados. Qualquer valor acima de " + money(c, R(value * 0.85)) + " nos salva o mês. Venda.”";
    else if (off.fee >= value * 1.4) line = "“É dinheiro demais para recusar. A diretoria vê com bons olhos.”";
    else if (off.fee >= minOk) line = "“Valor justo. A decisão esportiva é sua.”";
    else line = ido && ido.cls !== "home" ? "“Ídolo não sai por menos de " + money(c, minOk) + ". Abaixo disso, a torcida cai em cima de nós.”" : "“Abaixo do valor de mercado não faz sentido. Peça mais.”";
    return { minOk: minOk, line: line, pressure: debt >= 3 || off.fee >= value * 1.4 };
  }
  function fansInfo(c, off, p) {
    var ido = idol(c, p), riv = isRival(c, off.buyerId);
    if (riv) return { risk: 3, line: "🔥 Vender para o " + TM.data.club(off.buyerId).name + "? A torcida promete protesto na porta do CT. Popularidade −6." };
    if (ido && ido.cls === "legend") return { risk: 3, line: "😡 Ídolo eterno. Camisas queimadas, sócios cancelando. Popularidade −5, moral do elenco cai." };
    if (ido && ido.cls === "idol") return { risk: 2, line: "😠 A torcida não vai gostar de ver um ídolo sair. Popularidade −3." };
    if ((p.overall || 0) >= rating(c.teamId) + 2) return { risk: 1, line: "😕 É um dos melhores do elenco. A torcida cobra reposição à altura." };
    return { risk: 0, line: "🙂 Venda tranquila. Se o dinheiro virar reforço, a torcida aprova." };
  }

  /* ---------- negociação ---------- */
  function say(off, who, text, tone) { off.history.push({ who: who, text: text, tone: tone || "" }); if (off.history.length > 30) off.history.shift(); }
  function buyerName(off) { return TM.data.club(off.buyerId).name; }
  // contraproposta: ask = { fee, upfront (exigir à vista), bonus (bônus por metas), sellOn (% revenda) }
  function counter(c, n, ask) {
    var off = n.offer, p = C().resolvePlayer(c, off.playerId), buyer = TM.data.club(off.buyerId);
    if (off.final) return { status: "final", text: buyer.name + " já fez a proposta final." };
    off.rounds++;
    var ceil = off.ceil || ceiling(c, n);
    // custo dos extras para o comprador (equivalente em dinheiro)
    var extra = 0; if (ask.upfront && off.parts > 1) extra += ceil * 0.04; if (ask.bonus) extra += ceil * 0.06; if (ask.sellOn) extra += ceil * 0.05;
    var eff = ask.fee + extra;
    var parts = [];
    if (ask.upfront) parts.push("pagamento à vista"); if (ask.bonus) parts.push("bônus por metas"); if (ask.sellOn) parts.push("10% de uma revenda");
    say(off, "me", "Quero " + money(c, ask.fee) + (parts.length ? " + " + parts.join(", ") : "") + ".");
    if (eff <= off.fee) { say(off, "them", "“Isso já está coberto. Fechamos por " + money(c, off.fee) + "?”", "happy"); return { status: "aceita" }; }
    if (eff <= ceil) {
      off.fee = R(ask.fee); if (ask.upfront) { off.parts = 1; off.upfront = false; } if (ask.bonus) off.bonus = R(ceil * 0.06); if (ask.sellOn) off.sellOn = 10;
      n.text = buyer.name + " aceitou pagar " + money(c, off.fee) + " por " + p.name + ".";
      say(off, "them", "“Fechado. " + money(c, off.fee) + (parts.length ? " com " + parts.join(", ") : "") + ". Agora é com vocês e com o jogador.”", "happy");
      return { status: "aceita" };
    }
    if (eff <= ceil * 1.15 || (off.patience <= 1 && eff <= ceil * 1.3)) {
      var meet = R((eff + ceil) / 2 - extra);
      off.fee = Math.max(off.fee, meet); off.final = true; off.finalOffer = true;
      if (ask.sellOn && Math.random() < 0.5) off.sellOn = 10;
      n.text = buyer.name + " subiu para " + money(c, off.fee) + " por " + p.name + " (proposta final).";
      say(off, "them", "“Chegamos até " + money(c, off.fee) + (off.sellOn ? " e aceitamos os 10% de revenda" : "") + ". É a nossa proposta final. Pegar ou largar.”", "angry");
      return { status: "final" };
    }
    off.patience--;
    // leilão: outro clube pode entrar na disputa quando o pedido é alto
    if (off.patience >= 1 && Math.random() < 0.28) {
      var rivalBid = otherBidder(c, off, p);
      if (rivalBid) { say(off, "them", "“Pedido alto. Sabemos que o " + rivalBid.name + " também quer o jogador… vamos pensar.”", "angry"); return { status: "leilao", text: rivalBid.name + " entrou na disputa por " + p.name + "!" }; }
    }
    if (off.patience <= 0 || Math.random() < 0.35) {
      say(off, "them", "“Pedido abusivo. Encerramos a conversa.”", "angry");
      TM.notify.remove(c, n.id); note(c, { icon: "🚪", title: "Proposta retirada", news: true, text: buyer.name + " desistiu de " + p.name + " depois da sua contraproposta." });
      return { status: "retirada", text: buyer.name + " retirou o interesse." };
    }
    say(off, "them", "“Muito acima do que podemos. Mantemos " + money(c, off.fee) + ".”", "angry");
    return { status: "recusada" };
  }
  function otherBidder(c, off, p) {
    var W = TM.data.world(), val = TM.data.marketValue(p);
    var cands = W.clubs.filter(function (cl) { return cl.id !== c.teamId && cl.id !== off.buyerId && rating(cl.id) >= (p.overall || 60) - 1 && rating(cl.id) >= rating(off.buyerId) - 3; });
    if (!cands.length) return null;
    var b = pick(cands), fee = R(Math.max(off.fee * 1.08, val * mult(c) * (1.05 + Math.random() * 0.3)));
    var n2 = note(c, { icon: "📨", title: "Leilão: nova proposta", news: true, text: b.name + " entrou na disputa e ofereceu " + money(c, fee) + " por " + p.name + ".", offer: { playerId: p.id, buyerId: b.id, fee: fee } });
    try { if (n2 && n2.offer) enrich(c, n2); } catch (e) {}
    try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: "📨", title: "Leilão", text: b.name + " e " + buyerName(off) + " disputam " + p.name + " do " + myClub(c).name + "." }); } catch (e) {}
    return b;
  }
  function askTime(c, n) {
    var off = n.offer;
    if (off.extended) { say(off, "them", "“Já demos mais prazo. Decidam.”", "angry"); return false; }
    off.extended = true;
    if (Math.random() < 0.7) { off.deadlineDay += 3; say(off, "them", "“Tudo bem, mais 3 dias. Depois disso fechamos com outro alvo.”"); return true; }
    off.patience--; say(off, "them", "“Não temos tempo. A proposta vale até " + dateTxt(c, off.deadlineDay) + ".”", "angry"); return false;
  }

  /* ---------- aceitar / recusar ---------- */
  function accept(c, n) {
    var off = n.offer, p = C().resolvePlayer(c, off.playerId), buyer = TM.data.club(off.buyerId);
    var fans = fansInfo(c, off, p);
    var res = C().resolveIncomingOffer(c, n, true);     // decisão do jogador (off.forceWants) + efeitos da venda
    if (res !== "vendido") {
      note(c, { icon: "🙅", title: p.name + " recusou a transferência", news: true, text: off.wantLine || "O jogador preferiu ficar." });
      return { sold: false };
    }
    // estrutura: parcelas a receber, bônus e % de revenda (Finanças)
    if (off.parts > 1 && TM.fin && TM.fin.addReceivable) {
      var per = R(off.fee / off.parts); c.budget = R(c.budget - (off.fee - per)); c.finc.soldM = R((c.finc.soldM || 0) - (off.fee - per));
      TM.fin.addReceivable(c, { name: p.name, from: buyer.name, fromId: buyer.id, per: per, parts: off.parts, kind: "venda" });
    }
    if (off.bonus && TM.fin && TM.fin.addReceivable) TM.fin.addReceivable(c, { name: p.name, from: buyer.name, fromId: buyer.id, per: off.bonus, parts: 1, kind: "bonus", cond: "20 jogos pelo " + buyer.name });
    if (off.sellOn) { c.sellOnRights = c.sellOnRights || {}; c.sellOnRights[p.id] = { pct: off.sellOn, from: buyer.name, fromId: buyer.id, name: p.name, season: c.season || 1 }; }
    // torcida e clima
    if (fans.risk >= 2) { c.popularity = Math.max(3, (c.popularity || 40) - (fans.risk === 3 ? 6 : 3)); c.boardTrust = Math.max(0, (c.boardTrust == null ? 50 : c.boardTrust) - 3); }
    else if (fans.risk === 0 && off.fee >= curVal(c, C().valueOf ? C().valueOf(c, p) : TM.data.marketValue(p)) * 1.2) c.boardTrust = Math.min(100, (c.boardTrust == null ? 50 : c.boardTrust) + 2);
    // despedida
    var farewell = pick(["“Obrigado por tudo. Levo esse clube no coração.”", "“Foi uma honra vestir essa camisa. Torcida, vocês são demais.”", "“Saio com a sensação de dever cumprido. Até um dia.”"]);
    note(c, { icon: "👋", title: "Despedida de " + p.name, news: true, text: p.name + " se despediu do elenco: " + farewell + " Vendido ao " + buyer.name + " por " + money(c, off.fee) + (off.parts > 1 ? " (" + off.parts + " parcelas)" : "") + (off.sellOn ? ", com " + off.sellOn + "% de uma revenda futura" : "") + "." });
    if (fans.risk >= 2) note(c, { icon: "😡", title: "Torcida revoltada", news: true, text: fans.line });
    try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { name: p.name, ov: p.overall, fromName: myClub(c).name, toName: buyer.name, val: TM.data.marketValue(p) }); } catch (e) {}
    try { if (TM.social && TM.social.marketPost && fans.risk >= 2) TM.social.marketPost(c, { icon: "😡", title: "Revolta", text: "Torcida do " + myClub(c).name + " protesta contra a venda de " + p.name + " ao " + buyer.name + "." }); } catch (e) {}
    // outros clubes ficam sabendo que você vende: sondagens por outros jogadores (imersão)
    return { sold: true, farewell: farewell, fans: fans };
  }
  function reject(c, n) {
    var off = n.offer, p = C().resolvePlayer(c, off.playerId), buyer = TM.data.club(off.buyerId);
    C().resolveIncomingOffer(c, n, false);
    if (off.wants && Math.random() < 0.6) note(c, { icon: "😤", title: p.name + " está chateado", text: "O jogador queria ir para o " + buyer.name + " e não gostou da recusa. Moral em baixa por algumas rodadas.", });
    if (Math.random() < 0.3) note(c, { icon: "🔁", title: buyer.name + " insiste", text: "O " + buyer.name + " avisou que vai voltar com uma proposta melhor na próxima janela." });
  }

  /* ---------- prazo e cartão ---------- */
  function pendingOffers(c) { return (c.notifications || []).filter(function (n) { return n.offer; }); }
  function tick(c) {
    var changed = false;
    pendingOffers(c).forEach(function (n) {
      var off = enrich(c, n); if (!off) return;
      if (!off.longDeadline) { off.longDeadline = true; if (off.deadlineDay != null && off.deadlineDay - (off.arrivedDay || day(c)) < 8) off.deadlineDay = (off.arrivedDay || day(c)) + 9; changed = true; }
      if (off.deadlineDay != null && day(c) > off.deadlineDay) {
        var p = C().resolvePlayer(c, off.playerId); TM.notify.remove(c, n.id); changed = true;
        note(c, { icon: "⌛", title: "Proposta expirou", text: buyerName(off) + " não teve resposta e desistiu de " + (p ? p.name : "seu jogador") + "." });
      }
    });
    if (changed) save(c);
  }
  function pendingLoans(c) { return (c.notifications || []).filter(function (n) { return n.loanOffer; }); }
  // card do hub: TODAS as propostas de compra e pedidos de empréstimo pendentes (cada um com seu botão)
  function card(c) {
    var list = pendingOffers(c), loans = pendingLoans(c);
    if (!list.length && !loans.length) return null;
    var kids = [ el("div", { class: "nm-label", text: "📨 " + (list.length ? list.length + " proposta" + (list.length > 1 ? "s" : "") : "") + (list.length && loans.length ? " · " : "") + (loans.length ? loans.length + " pedido" + (loans.length > 1 ? "s" : "") + " de empréstimo" : "") + " pelo seu elenco" }) ];
    list.slice(0, 4).forEach(function (n) {
      var off = enrich(c, n), p = C().resolvePlayer(c, off.playerId), buyer = TM.data.club(off.buyerId);
      if (!p || !buyer) return;
      var left = Math.max(0, (off.deadlineDay || day(c)) - day(c));
      kids.push(el("div", { class: "offer-row clickable", on: { click: function () { TM.ui.go("coach-offer", { noteId: n.id }); } } }, [
        TM.img.clubImg(buyer, "pre-crest"),
        el("div", { class: "offer-mid" }, [
          el("div", { class: "offer-t", text: buyer.name + " quer " + p.name }),
          el("div", { class: "offer-s", text: money(c, off.fee) + (off.parts > 1 ? " em " + off.parts + "x" : " à vista") + " · responde até " + dateTxt(c, off.deadlineDay) + (left ? " (" + left + " dia" + (left > 1 ? "s" : "") + ")" : " (hoje!)") })
        ]),
        TM.img.playerImg(p, "offer-face")
      ]));
      kids.push(el("div", { class: "actions" }, [ TM.ui.button("🤝 Sentar para negociar", function () { TM.ui.go("coach-offer", { noteId: n.id }); }, "btn primary") ]));
    });
    loans.slice(0, 3).forEach(function (n) {
      var lo = n.loanOffer, p = C().resolvePlayer(c, lo.playerId), buyer = TM.data.club(lo.buyerId);
      if (!p || !buyer) return;
      kids.push(el("div", { class: "offer-row clickable", on: { click: function () { TM.ui.go("coach-loan-offer", { noteId: n.id }); } } }, [
        TM.img.clubImg(buyer, "pre-crest"),
        el("div", { class: "offer-mid" }, [
          el("div", { class: "offer-t", text: buyer.name + " pede " + p.name + " emprestado" }),
          el("div", { class: "offer-s", text: (lo.buyOption ? "Com opção de compra de " + money(c, lo.buyPrice) + " · " : "") + "taxa " + money(c, lo.loanFee) })
        ]),
        TM.img.playerImg(p, "offer-face")
      ]));
      kids.push(el("div", { class: "actions" }, [ TM.ui.button("🔄 Ver pedido de empréstimo", function () { TM.ui.go("coach-loan-offer", { noteId: n.id }); }, "btn") ]));
    });
    if (list.length + loans.length > (Math.min(4, list.length) + Math.min(3, loans.length))) kids.push(el("div", { class: "offer-s", style: "text-align:center", text: "Todas as propostas estão em 🔔 Avisos." }));
    return el("div", { class: "next-match offer-card" }, kids);
  }

  /* ---------- TELA ---------- */
  TM.ui.register("coach-offer", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    var n = TM.notify.get(c, params.noteId);
    if (!n || !n.offer) { TM.ui.go("coach-notifications"); return; }
    var off = enrich(c, n); save(c);
    var p = C().resolvePlayer(c, off.playerId), buyer = TM.data.club(off.buyerId);
    if (!p || !buyer) { TM.notify.remove(c, n.id); save(c); TM.ui.go("coach-notifications"); return; }
    var value = curVal(c, C().valueOf ? C().valueOf(c, p) : TM.data.marketValue(p)), left = Math.max(0, (off.deadlineDay || day(c)) - day(c));
    var mood = MOODS.filter(function (m) { return m.id === off.mood; })[0] || MOODS[0];
    screen.appendChild(TM.ui.topbar("Proposta por " + p.name, function () { TM.ui.go("coach-notifications"); }));
    var wrap = el("div", { class: "nego2" }); screen.appendChild(wrap);

    // porta-voz do comprador
    var spk = off.spokesman || {};
    wrap.appendChild(el("div", { class: "nego2-call" }, [
      (TM.img && TM.img.clubImg ? TM.img.clubImg(buyer, "nego2-crest") : el("span", { class: "nego2-crest" })),
      el("div", { class: "nego2-callinfo" }, [
        el("div", { class: "nego2-role", text: "NA MESA COM" }),
        el("div", { class: "nego2-club", text: buyer.name + (isRival(c, buyer.id) ? " 🔥" : "") }),
        el("div", { class: "nego2-sub", text: (spk.role || "Diretoria") + ": " + (spk.name || "—") + " · OVR " + rating(buyer.id) + " · " + ((TM.data.league(buyer.leagueId) || {}).nation || "") })
      ]),
      spk.name && spk.role === "Técnico" ? TM.img.coachImg({ name: spk.name, photoKey: spk.photoKey }, "offer-spk") : el("div", { class: "nego2-tension " + mood.tone }, [ el("span", { class: "nego2-tdot" }), el("span", { text: mood.label }) ])
    ]));
    wrap.appendChild(el("div", { class: "offer-meta" }, [
      el("span", { class: "ctx-chip", text: "🧭 " + mood.label }),
      el("span", { class: "ctx-chip", text: "⏳ até " + dateTxt(c, off.deadlineDay) + (left ? " · " + left + " dia" + (left > 1 ? "s" : "") : " · HOJE") }),
      el("span", { class: "ctx-chip", text: off.final ? "🔒 proposta final" : "💬 paciência " + "●".repeat(Math.max(0, off.patience)) + "○".repeat(Math.max(0, 5 - off.patience)) })
    ]));

    // jogador
    var ido = idol(c, p), ct = c.contracts && c.contracts[p.id];
    wrap.appendChild(el("div", { class: "nego2-player" }, [
      TM.img.playerImg(p, "nego2-face"),
      el("div", { class: "nego2-pinfo" }, [
        el("div", { class: "nego2-pname", text: p.name + (ido ? " " + ido.ic : "") }),
        el("div", { class: "nego2-pmeta" }, [
          el("span", { class: "nego2-chip", html: "POS <b>" + TM.data.posLabel(p) + "</b>" }),
          el("span", { class: "nego2-chip", html: "IDADE <b>" + p.age + "</b>" }),
          el("span", { class: "nego2-chip", html: "VALOR <b>" + money(c, value) + "</b>" }),
          ct ? el("span", { class: "nego2-chip", html: "CONTRATO <b>" + ct.years + " temp." + "</b>" }) : null
        ].filter(Boolean)),
        ido ? el("div", { class: "setting-hint", text: ido.label }) : null
      ].filter(Boolean)),
      el("div", { class: "nego2-ovr" }, [ el("div", { class: "nego2-ovrn", text: p.overall }), el("div", { class: "nego2-ovrl", text: "OVR" }) ])
    ]));

    // termos atuais
    function line(label, val, cls) { return el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: label }), el("span", { class: "deal-val " + (cls || ""), text: val }) ]); }
    var good = off.fee >= value;
    wrap.appendChild(el("div", { class: "nego2-terms" }, [
      line("Proposta na mesa", money(c, off.fee), good ? "good" : "bad"),
      line("Pagamento", off.parts > 1 ? off.parts + " parcelas de " + money(c, R(off.fee / off.parts)) : "à vista"),
      off.bonus ? line("Bônus por metas", "+" + money(c, off.bonus), "good") : null,
      off.sellOn ? line("Revenda futura", off.sellOn + "% para você", "good") : null,
      line("Valor de mercado", money(c, value)),
      line("Caixa após a venda", money(c, R((c.budget || 0) + (off.parts > 1 ? off.fee / off.parts : off.fee))), "good")
    ].filter(Boolean)));

    // conversa
    var thread = el("div", { class: "nego-thread" }); wrap.appendChild(thread);
    function bubble(side, text, tone) { thread.appendChild(el("div", { class: "nego-bubble " + side + (tone ? " " + tone : "") }, [ el("span", { text: text }) ])); thread.scrollTop = thread.scrollHeight; }
    bubble("them", (spk.name ? spk.name + " (" + buyer.name + "): " : buyer.name + ": ") + "“" + off.reason + " Oferecemos " + money(c, off.fee) + (off.parts > 1 ? ", em " + off.parts + " parcelas" : ", à vista") + ".”");
    (off.history || []).forEach(function (h) { bubble(h.who, h.text, h.tone); });

    // consultas (imersão)
    var consult = el("div", { class: "offer-consult" });
    function consultBtn(label, fn) { return el("button", { class: "chip-btn", text: label, on: { click: fn } }); }
    consult.appendChild(consultBtn("🗣️ Ouvir o jogador", function () { var w = wantsInfo(c, off, p); off.wantLine = off.wantLine || w.line; bubble("info", "🗣️ " + p.name + ": " + off.wantLine); var ag = agent(p); if (ag) bubble("info", ag.ic + " " + ag.name + " (empresário): “" + (off.wants ? "Meu cliente quer ir. Facilita que a gente te ajuda na próxima." : "Ele não pediu pra sair. Se for pra vender, o clube que faça a proposta certa.") + "”"); }));
    consult.appendChild(consultBtn("🏛️ Consultar a diretoria", function () { var b = boardInfo(c, off, p); bubble("info", "🏛️ Diretoria: " + b.line); }));
    consult.appendChild(consultBtn("📣 Sentir a torcida", function () { bubble("info", "📣 Torcida: " + fansInfo(c, off, p).line); }));
    if (!off.final) consult.appendChild(consultBtn("⏳ Pedir mais prazo", function () { var ok = askTime(c, n); save(c); bubble("them", off.history[off.history.length - 1].text, ok ? "" : "angry"); }));
    wrap.appendChild(consult);

    // DISPUTA: outros clubes atrás do mesmo jogador
    try {
      if (TM.disp) {
        var race = TM.disp.ensureRace(c, n, p); if (race && !off.raceSaved) { off.raceSaved = 1; save(c); }
        var best = TM.disp.bestSuitor(off);
        var dp = TM.disp.panel(c, "⚔️ Quem mais quer " + p.name, (race && race.suitors) || [], {
          hint: best ? "Toque no clube para vender direto por " + money(c, best.bid) + "." : "Clubes observando. Uma contraproposta sua pode fazê-los entrar na disputa.",
          onPick: function (s) {
            TM.ui.confirm("Vender ao " + s.name + "?", "Você aceita a proposta de " + money(c, s.bid) + " do " + s.name + " e encerra a negociação com o " + buyer.name + "." + (s.rival ? " ATENÇÃO: é um rival — a torcida vai detestar." : ""), "Vender", function () {
              off.buyerId = s.id; off.fee = s.bid; off.parts = 1; off.bonus = 0; off.sellOn = 0;
              save(c); accept(c, n); TM.ui.go("coach-hub");
            });
          }
        });
        if (dp) wrap.appendChild(dp);
        var rv = TM.disp.rivalBuyerInfo(c, off.buyerId);
        if (rv) wrap.appendChild(el("div", { class: "fin-ban warn", text: "🔥 " + rv.line }));
      }
    } catch (e) {}

    // exigir a CLÁUSULA DE RESCISÃO (só se o contrato dele tiver uma): o clube comprador paga o valor cheio ou desiste
    var myCl = 0; try { myCl = TM.fin && TM.fin.myClause ? curVal(c, TM.fin.myClause(c, p.id)) : 0; } catch (e) {}
    if (myCl > 0 && !off.clausePaid) {
      var podePagar = rating(off.buyerId) >= (p.overall || 70) - 3;
      wrap.appendChild(el("div", { class: "nego-field clause-demand" }, [
        el("label", { text: "📜 Cláusula de rescisão do contrato" }),
        el("div", { class: "setting-hint", text: p.name + " tem cláusula de " + money(c, myCl) + ". Você pode exigir o valor cheio: o " + buyer.name + " paga tudo à vista ou desiste da contratação." }),
        el("div", { class: "actions" }, [ TM.ui.button("📜 Exigir a cláusula (" + money(c, myCl) + ")", function () {
          off.rounds = (off.rounds || 0) + 1;
          say(off, "me", "A cláusula de rescisão dele é " + money(c, myCl) + ". Se quiserem, paguem a cláusula.");
          var teto = off.ceil || 0, folga = podePagar ? teto * 2.6 : teto * 1.25;
          if (myCl <= folga) {
            off.fee = R(myCl); off.parts = 1; off.upfront = false; off.bonus = 0; off.sellOn = 0; off.clausePaid = true; off.final = true;
            n.text = buyer.name + " aceitou pagar a cláusula de " + money(c, myCl) + " por " + p.name + ".";
            say(off, "them", "“Tudo bem. Vamos depositar a cláusula: " + money(c, myCl) + ", à vista. Agora é com o jogador.”", "happy");
            TM.ui.toast("📜 " + buyer.name + " topou pagar a cláusula!");
          } else {
            off.patience = (off.patience || 2) - 1;
            if (off.patience <= 0) {
              say(off, "them", "“Não vamos pagar essa cláusula. Desistimos.”", "angry");
              TM.notify.remove(c, n.id); note(c, { icon: "🚪", title: "Proposta retirada", news: true, text: buyer.name + " desistiu de " + p.name + ": não quis pagar a cláusula de " + money(c, myCl) + "." });
              save(c); TM.ui.toast(buyer.name + " desistiu da contratação."); TM.ui.go("coach-notifications"); return;
            }
            say(off, "them", "“" + money(c, myCl) + " está muito acima do que podemos pagar. Vamos pensar.”", "angry");
            TM.ui.toast("O " + buyer.name + " achou a cláusula cara demais.");
          }
          save(c); TM.ui.go("coach-offer", { noteId: n.id });
        }, "btn") ])
      ]));
    }

    // contraproposta
    if (!off.final) {
      var ask = { fee: R(Math.max(off.fee * 1.15, value)), upfront: false, bonus: false, sellOn: false };
      var maxAsk = R(Math.max(off.fee * 2, value * 2)), step = maxAsk >= 50 ? 1 : maxAsk >= 10 ? 0.5 : 0.1;
      var askVal = el("span", { class: "range-val", text: money(c, ask.fee) });
      var slider = el("input", { type: "range", min: off.fee, max: maxAsk, step: step, value: ask.fee, class: "slider" });
      slider.addEventListener("input", function () { ask.fee = R(parseFloat(slider.value)); askVal.textContent = money(c, ask.fee); });
      function tog(label, key) { var b = el("button", { class: "sweet-chip", text: label, on: { click: function () { ask[key] = !ask[key]; b.classList.toggle("on", ask[key]); } } }); return b; }
      wrap.appendChild(el("div", { class: "nego-field" }, [
        el("label", { text: "Sua contraproposta" }),
        el("div", { class: "range-wrap" }, [ slider, askVal ]),
        el("div", { class: "sweet-row" }, [ off.parts > 1 ? tog("💵 Exigir à vista", "upfront") : null, tog("🎯 Bônus por metas", "bonus"), tog("📈 10% da revenda", "sellOn") ].filter(Boolean)),
        el("div", { class: "actions" }, [ TM.ui.button("📤 Enviar contraproposta", function () {
          var r = counter(c, n, ask);
          try { if (TM.disp) TM.disp.raceRound(c, n, p, ask.fee); } catch (e) {}
          save(c);
          if (r.status === "retirada") { TM.ui.toast(r.text); TM.ui.go("coach-notifications"); return; }
          if (r.status === "leilao") TM.ui.toast(r.text);
          TM.ui.go("coach-offer", { noteId: n.id });
        }, "btn") ])
      ]));
    }

    // decisão
    wrap.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("✅ Aceitar " + money(c, off.fee), function () {
        var fans = fansInfo(c, off, p);
        TM.ui.confirm("Vender " + p.name + "?", money(c, off.fee) + (off.parts > 1 ? " em " + off.parts + " parcelas" : " à vista") + ". " + (fans.risk >= 2 ? fans.line : "O jogador ainda precisa aceitar.") , "Vender", function () {
          var r = accept(c, n); save(c);
          if (r.sold) { TM.ui.toast("👋 " + p.name + " vendido ao " + buyer.name); TM.ui.go("coach-farewell", { pid: p.id, buyerId: buyer.id, fee: off.fee, farewell: r.farewell }); }
          else { TM.ui.toast("🙅 " + p.name + " recusou a transferência"); TM.ui.go("coach-notifications"); }
        }, fans.risk >= 2);
      }, "btn primary"),
      TM.ui.button("❌ Recusar", function () { reject(c, n); save(c); TM.ui.toast("Proposta recusada"); TM.ui.go("coach-notifications"); }, "btn ghost")
    ]));
  });

  // despedida (cena curta)
  TM.ui.register("coach-farewell", function (screen, params) {
    var c = TM.storage.coachCareer(); var p = TM.data.player(params.pid) || (c && C().resolvePlayer(c, params.pid)); var buyer = TM.data.club(params.buyerId);
    screen.appendChild(TM.ui.topbar("Despedida", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow farewell" }); screen.appendChild(body);
    body.appendChild(el("div", { class: "farewell-hero" }, [
      p ? TM.img.playerImg(p, "farewell-face") : null,
      el("div", { class: "farewell-name", text: p ? p.name : "" }),
      el("div", { class: "farewell-sub", text: (myClub(c) || {}).name + " → " + (buyer ? buyer.name : "") + " · " + money(c, params.fee || 0) }),
      el("div", { class: "farewell-quote", text: params.farewell || "“Obrigado por tudo.”" }),
      buyer ? TM.img.clubImg(buyer, "farewell-crest") : null
    ].filter(Boolean)));
    body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("Seguir em frente", function () { TM.ui.go("coach-hub"); }, "btn primary") ]));
  });

  TM.offers = { enrich: enrich, tick: tick, card: card, counter: counter, accept: accept, reject: reject, wantsInfo: wantsInfo, boardInfo: boardInfo, fansInfo: fansInfo, pending: pendingOffers };
})(window);
