/* ================= TOTAL MATCH — Total Messenger (aba 💬) =================
   Conversas com jogadores, diretoria, empresários, capitão e imprensa. Cada mensagem chega com contexto real da
   carreira (minutos, lesão, contrato a vencer, campanha, caixa, propostas) e você responde por respostas prontas.
   Cada resposta tem efeito: moral do jogador, confiança da diretoria, popularidade, pedido de transferência.
   E cuidado: algumas respostas VAZAM para a imprensa e viram manchete e post nas redes. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };

  var MAX_THREADS = 40;
  function day(c) { return c.currentDay || 0; }
  function save(c) { TM.storage.saveCoachCareer(c); }
  function st(c) { c.msgr = c.msgr || { threads: [], seq: 0, gen: {} }; if (!Array.isArray(c.msgr.threads)) c.msgr.threads = []; c.msgr.gen = c.msgr.gen || {}; return c.msgr; }
  function money(c, v) { try { return C().fmtMoney(c, v); } catch (e) { return v + "M"; } }
  function dateTxt(c, d) { try { return C().dateOf(c, d).short; } catch (e) { return ""; } }
  function myClub(c) { try { return TM.data.club(c.teamId); } catch (e) { return null; } }
  function clubName(c) { var cl = myClub(c); return cl ? cl.name : "clube"; }
  function boardName(c) { try { return C().boardLabel(c) || "A diretoria"; } catch (e) { return "A diretoria"; } }
  function coachName(c) { return c.coachName || "Treinador"; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function shortName(n) { var p = String(n || "").split(" "); return p.length > 1 ? p[0][0] + ". " + p[p.length - 1] : n; }
  function played(c) { return (c.stats && c.stats.p) || 0; }
  function appsOf(c, id) { var s = c.pstats && c.pstats[id]; return s ? s.apps : 0; }
  function sinceJoin(c, id) { var j = (c.joinedAt && c.joinedAt[id] != null) ? c.joinedAt[id] : 0; return Math.max(0, (c.matchNo || 0) - j); }
  function pos(c) { try { return C().currentPosition(c); } catch (e) { return 0; } }
  function squad(c) { try { return C().userSquad(c) || []; } catch (e) { return []; } }

  /* ---------- efeitos ---------- */
  function bumpMorale(c, pid, v) {
    if (!pid || !v) return;
    c.confidence = (c.confidence && typeof c.confidence === "object") ? c.confidence : {};
    c.confidence[pid] = Math.max(-5, Math.min(5, (c.confidence[pid] || 0) + v));
    try { if (TM.social && TM.social.nudgeMorale) TM.social.nudgeMorale(c, v > 0 ? 1 : -1); } catch (e) {}
  }
  function bumpBoard(c, v) {
    if (!v) return;
    if (typeof c.boardTrust !== "number" || !isFinite(c.boardTrust)) c.boardTrust = 50;
    c.boardTrust = Math.max(0, Math.min(100, c.boardTrust + v));
  }
  function bumpPop(c, v) { if (!v) return; c.popularity = Math.max(0, Math.min(100, (c.popularity || 40) + v)); }

  // vaza para a imprensa: vira manchete (Notícias) e post nas redes
  function leak(c, t, r) {
    var quote = r.quote || r.label;
    var who = t.fromName;
    var txt = "Trecho de uma conversa privada entre " + coachName(c) + " e " + who + " vazou: “" + quote + "”.";
    TM.notify.push(c, { icon: "📢", title: "Conversa privada vaza na imprensa", news: true, text: txt + " O " + clubName(c) + " não comentou o episódio." });
    try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: "📢", title: "Vazou", name: who, toName: clubName(c), free: true, val: 0 }); } catch (e) {}
    t.leaked = true;
    bumpPop(c, -2);
    if (t.pid) bumpMorale(c, t.pid, -1);
    else bumpBoard(c, -3);
  }

  /* ---------- construção de conversas ---------- */
  function newThread(c, o) {
    var S = st(c);
    S.seq = (S.seq || 0) + 1;
    var t = {
      id: "m" + S.seq, key: o.key || "", kind: o.kind, fromName: o.fromName, fromSub: o.fromSub || "",
      pid: o.pid || null, clubId: o.clubId || null, subject: o.subject, day: day(c), season: c.season || 1,
      msgs: [{ who: "them", text: o.text, day: day(c) }], replies: o.replies || [], unread: true, done: false, leaked: false
    };
    S.threads.unshift(t);
    if (S.threads.length > MAX_THREADS) S.threads.length = MAX_THREADS;
    return t;
  }
  function unread(c) { return st(c).threads.filter(function (t) { return t.unread; }).length; }
  function pending(c) { return st(c).threads.filter(function (t) { return !t.done; }).length; }

  /* ---------- geradores ---------- */
  // cada gerador devolve true se criou uma conversa
  var GENS = [
    // 1) jogador com poucos minutos
    function (c) {
      var p = squad(c).filter(function (p) {
        return sinceJoin(c, p.id) >= 5 && p.overall >= 70 && appsOf(c, p.id) <= Math.floor(sinceJoin(c, p.id) * 0.3) && !(c.injuries && c.injuries[p.id]);
      })[0];
      if (!p) return false;
      newThread(c, { key: "minutos:" + p.id, kind: "player", pid: p.id, fromName: p.name, fromSub: TM.data.posLabel(p) + " · " + p.overall + " OVR",
        subject: "Quero jogar mais",
        text: "Professor, queria conversar sobre minha situação. Venho treinando forte e não tenho tido chance. Em " + sinceJoin(c, p.id) + " jogos do time eu entrei em " + appsOf(c, p.id) + ". O que falta para eu jogar?",
        replies: [
          { label: "Você vai ter chance no próximo jogo.", quote: "Vou te dar chance no próximo jogo, pode se preparar.", morale: 2, promise: true, leak: 0.10 },
          { label: "Trabalhe mais no treino que a vaga aparece.", quote: "Quem treina bem joga. A vaga é conquistada aqui dentro.", morale: 0, leak: 0.08 },
          { label: "Hoje você não é titular. É a minha decisão.", quote: "Hoje você não é titular e a decisão é minha.", morale: -2, board: 1, leak: 0.30 },
          { label: "Se não está feliz, pode procurar outro clube.", quote: "Se não está feliz aqui, procure outro clube.", morale: -3, req: true, leak: 0.55 }
        ] });
      return true;
    },
    // 2) jogador em fase artilheira quer reconhecimento
    function (c) {
      var best = null, bestG = 0;
      squad(c).forEach(function (p) { var s = c.pstats && c.pstats[p.id]; if (s && s.goals >= 4 && s.goals > bestG) { bestG = s.goals; best = p; } });
      if (!best) return false;
      newThread(c, { key: "fase:" + best.id + ":" + bestG, kind: "player", pid: best.id, fromName: best.name, fromSub: bestG + " gols na temporada",
        subject: "Estou vivendo um bom momento",
        text: "Professor, são " + bestG + " gols e sinto que posso ajudar ainda mais. Queria saber se o senhor pensa em mim como peça principal do projeto.",
        replies: [
          { label: "Você é o nosso líder técnico. Conte comigo.", quote: "Ele é o líder técnico do grupo e conta comigo.", morale: 2, pop: 1, leak: 0.20 },
          { label: "Está indo bem, mas o time vem antes.", quote: "Ele vai bem, mas aqui o time vem antes de qualquer nome.", morale: 0, board: 1, leak: 0.15 },
          { label: "Se vier proposta grande, o clube vai ouvir.", quote: "Se aparecer proposta grande, o clube vai ouvir.", morale: -2, board: 2, leak: 0.60 }
        ] });
      return true;
    },
    // 3) contrato a vencer
    function (c) {
      if (!c.contracts) return false;
      var ids = Object.keys(c.contracts).filter(function (id) { return (c.roster || []).indexOf(id) >= 0 && (c.contracts[id].years || 9) <= 1; });
      if (!ids.length) return false;
      var p = C().resolvePlayer(c, ids[0]); if (!p) return false;
      newThread(c, { key: "contrato:" + p.id + ":" + (c.season || 1), kind: "player", pid: p.id, fromName: p.name, fromSub: "Contrato acaba nesta temporada",
        subject: "Meu contrato está acabando",
        text: "Professor, meu vínculo termina no fim da temporada e meu empresário já recebeu sondagens. Gosto daqui, mas preciso saber se o clube quer renovar.",
        replies: [
          { label: "Quero você aqui. Vou falar com a diretoria hoje.", quote: "Quero ele aqui e já pedi à diretoria para renovar.", morale: 2, board: -1, leak: 0.25 },
          { label: "É assunto da diretoria, fale com eles.", quote: "Renovação é assunto da diretoria.", morale: -1, leak: 0.12 },
          { label: "Mostre em campo que merece a renovação.", quote: "Ele precisa mostrar em campo que merece a renovação.", morale: -1, board: 1, leak: 0.35 }
        ] });
      return true;
    },
    // 4) lesionado
    function (c) {
      if (!c.injuries) return false;
      var id = Object.keys(c.injuries).filter(function (id) { return (c.injuries[id] || 0) >= 3 && (c.roster || []).indexOf(id) >= 0; })[0];
      if (!id) return false;
      var p = C().resolvePlayer(c, id); if (!p) return false;
      newThread(c, { key: "lesao:" + id + ":" + (c.injuries[id] || 0), kind: "player", pid: id, fromName: p.name, fromSub: "Departamento médico",
        subject: "Recuperação",
        text: "Professor, a recuperação está evoluindo. Queria saber se posso forçar um pouco para voltar antes. Odeio ficar de fora.",
        replies: [
          { label: "Nada de pressa. Sua saúde vem primeiro.", quote: "Nada de pressa com ele. Saúde em primeiro lugar.", morale: 2, pop: 1, leak: 0.10 },
          { label: "Se puder antecipar, o time precisa de você.", quote: "Se ele puder antecipar o retorno, o time precisa dele.", morale: 1, risk: true, leak: 0.30 },
          { label: "Volte quando o departamento médico liberar.", quote: "Ele volta quando o departamento médico liberar.", morale: 0, leak: 0.05 }
        ] });
      return true;
    },
    // 5) diretoria cobra ou elogia campanha
    function (c) {
      var p = pos(c), target = (c.objective && c.objective.maxPos) || 10, pl = played(c);
      if (pl < 4) return false;
      var ruim = p > target;
      newThread(c, { key: "board:" + (c.season || 1) + ":" + Math.floor(pl / 6) + ":" + (ruim ? "d" : "u"), kind: "board", fromName: boardName(c), fromSub: clubName(c),
        subject: ruim ? "Precisamos conversar sobre a campanha" : "Parabéns pela sequência",
        text: ruim
          ? "Treinador, estamos em " + p + "º e a meta é terminar entre os " + target + " primeiros. O conselho está preocupado. Como o senhor avalia o momento e o que precisa para virar o jogo?"
          : "Treinador, a campanha agrada: " + p + "º lugar e a meta é entre os " + target + " primeiros. Queremos saber como podemos ajudar para manter o ritmo.",
        replies: ruim ? [
          { label: "Assumo a responsabilidade. Vamos reagir.", quote: "A responsabilidade é minha e vamos reagir.", board: 4, pop: 1, leak: 0.15 },
          { label: "Preciso de reforço para brigar de igual.", quote: "Sem reforço não dá para brigar de igual.", board: -2, grant: 12, leak: 0.40 },
          { label: "O elenco é curto, os números explicam.", quote: "O elenco é curto, os números explicam a situação.", board: -4, pop: -1, leak: 0.50 }
        ] : [
          { label: "Obrigado. Seguimos com os pés no chão.", quote: "Seguimos com os pés no chão.", board: 3, leak: 0.10 },
          { label: "Com um reforço, podemos sonhar mais alto.", quote: "Com um reforço podemos sonhar mais alto.", board: 0, grant: 15, leak: 0.35 },
          { label: "Quero renovar meu contrato agora.", quote: "Pedi renovação de contrato agora.", board: -2, leak: 0.55 }
        ] });
      return true;
    },
    // 6) diretoria: caixa
    function (c) {
      if ((c.budget || 0) > 5) return false;
      newThread(c, { key: "caixa:" + (c.season || 1) + ":" + Math.floor((c.currentDay || 0) / 60), kind: "board", fromName: "Departamento financeiro", fromSub: clubName(c),
        subject: "Situação do caixa",
        text: "Treinador, o caixa está em " + money(c, c.budget || 0) + ". Precisamos de disciplina nas próximas janelas. O senhor pretende pedir mais contratações?",
        replies: [
          { label: "Vou trabalhar com o que tenho.", quote: "Vou trabalhar com o elenco que tenho.", board: 4, leak: 0.08 },
          { label: "Podemos vender alguém para reforçar.", quote: "Podemos vender alguém para reforçar outra posição.", board: 2, leak: 0.35 },
          { label: "Sem investimento não há milagre.", quote: "Sem investimento não existe milagre.", board: -3, pop: 1, leak: 0.55 }
        ] });
      return true;
    },
    // 7) empresário oferece cliente
    function (c) {
      var W = TM.data.world();
      var others = W.clubs.filter(function (cl) { return cl.id !== c.teamId; });
      if (!others.length) return false;
      var cl = pick(others), ids = cl.playerIds || []; if (!ids.length) return false;
      var p = TM.data.player(ids[rint(0, Math.min(ids.length, 12) - 1)]); if (!p) return false;
      var ag = null; try { ag = TM.coachUI && TM.coachUI.agentOf ? TM.coachUI.agentOf(p) : null; } catch (e) {}
      var agName = (ag && ag.name) || pick(["Ricardo Bastos", "Sandra Vilela", "Otávio Prado", "Marcelo Quintana", "Bianca Réus"]);
      var val = 0; try { val = C().fmtMoney(c, TM.data.marketValue(p) * (c.money ? c.money.mult : 1)); } catch (e) {}
      newThread(c, { key: "agente:" + p.id + ":" + (c.currentDay || 0), kind: "agent", pid: null, clubId: cl.id, fromName: agName, fromSub: "Empresário de " + p.name,
        subject: "Tenho um jogador para o senhor",
        text: "Treinador, represento " + p.name + " (" + p.overall + ", " + TM.data.posLabel(p) + ", " + (p.age || 25) + " anos) do " + cl.name + ". Ele admira seu trabalho e sairia por volta de " + val + ". Tem interesse?",
        replies: [
          { label: "Tenho. Peça ao clube para nos procurar.", quote: "Temos interesse no atleta.", pop: 1, leak: 0.45 },
          { label: "Vou avaliar com calma. Obrigado.", quote: "Vamos avaliar com calma.", leak: 0.12 },
          { label: "Não tenho interesse.", quote: "Não temos interesse no atleta.", leak: 0.20 }
        ] });
      return true;
    },
    // 8) capitão sobre o clima do vestiário
    function (c) {
      var cap = c.captainId ? C().resolvePlayer(c, c.captainId) : squad(c)[0];
      if (!cap) return false;
      var form = (c.recentForm || []).slice(-4), ruim = form.filter(function (x) { return x === "D"; }).length >= 2;
      newThread(c, { key: "capitao:" + (c.matchNo || 0), kind: "player", pid: cap.id, fromName: cap.name, fromSub: "Capitão",
        subject: ruim ? "O grupo está preocupado" : "O grupo está confiante",
        text: ruim
          ? "Professor, o vestiário sentiu os últimos resultados. Alguns companheiros estão inseguros. O senhor quer que eu passe alguma mensagem ao grupo?"
          : "Professor, o grupo está num bom momento e a confiança está alta. Queria saber se o senhor quer reforçar alguma mensagem antes do próximo jogo.",
        replies: [
          { label: "Diga que confio em cada um deles.", quote: "Confio em cada jogador deste elenco.", morale: 2, pop: 1, leak: 0.12 },
          { label: "Fale que a cobrança vai aumentar.", quote: "A cobrança aqui dentro vai aumentar.", morale: -1, board: 2, leak: 0.35 },
          { label: "Deixe comigo. Falo no vestiário.", quote: "Vou falar com o grupo pessoalmente.", morale: 1, leak: 0.05 }
        ] });
      return true;
    },
    // 9) imprensa pede entrevista exclusiva
    function (c) {
      var veic = pick(["Total News", "Diário da Bola", "Placar Central", "Gazeta do Mercado"]);
      var rep = pick(["Marina Castelo", "Rafael Duarte", "Camila Nogueira", "Thiago Bastos", "Letícia Fonseca", "Bruno Sampaio"]);
      newThread(c, { key: "imprensa:" + (c.matchNo || 0), kind: "press", fromName: rep, fromSub: veic,
        subject: "Uma pergunta rápida, treinador",
        text: "Treinador, tudo bem? Estou fechando uma matéria sobre o " + clubName(c) + ". Em off: como o senhor avalia o apoio da diretoria ao seu trabalho?",
        replies: [
          { label: "Tenho total apoio da diretoria.", quote: "Tenho total apoio da diretoria.", board: 3, leak: 0.30 },
          { label: "Prefiro não comentar.", quote: "Prefiro não comentar.", leak: 0.10 },
          { label: "Podiam ter me apoiado mais no mercado.", quote: "Podiam ter me apoiado mais no mercado.", board: -5, pop: 2, leak: 0.85 }
        ] });
      return true;
    },
    // 10) jogador insatisfeito que já pediu para sair
    function (c) {
      var id = Object.keys(c.transferReq || {}).filter(function (id) { return (c.roster || []).indexOf(id) >= 0; })[0];
      if (!id) return false;
      var p = C().resolvePlayer(c, id); if (!p) return false;
      newThread(c, { key: "saida:" + id + ":" + (c.matchNo || 0), kind: "player", pid: id, fromName: p.name, fromSub: "Pediu para sair",
        subject: "Sobre a minha saída",
        text: "Professor, já falei com a diretoria. Continuo achando melhor para todos que eu saia. Mas se o senhor me convencer do contrário, eu fico.",
        replies: [
          { label: "Fique. Você é importante para mim.", quote: "Pedi para ele ficar, é importante para mim.", morale: 3, clearReq: true, leak: 0.25 },
          { label: "Respeito. Vou liberar sua negociação.", quote: "Vou liberar a negociação dele.", morale: 0, list: true, leak: 0.45 },
          { label: "Ninguém sai no meio da temporada.", quote: "Ninguém sai no meio da temporada.", morale: -2, board: 1, leak: 0.40 }
        ] });
      return true;
    }
  ];

  // roda a cada visita ao hub: cria no máximo 1 conversa por dia de carreira
  function tick(c) {
    var S = st(c);
    // limpa conversas de jogadores que saíram
    var before = S.threads.length;
    S.threads = S.threads.filter(function (t) { return !t.pid || (c.roster || []).indexOf(t.pid) >= 0; });
    var changed = S.threads.length !== before;
    var d = day(c);
    if (S.lastDay === d) { if (changed) save(c); return; }
    var gap = S.lastDay == null ? 1 : d - S.lastDay;
    S.lastDay = d;
    if (gap <= 0) { if (changed) save(c); return; }
    var tries = Math.min(3, Math.max(1, Math.round(gap / 4)));
    for (var n = 0; n < tries; n++) {
      if (Math.random() > 0.55) continue;
      var order = GENS.slice().sort(function () { return Math.random() - 0.5; });
      for (var i = 0; i < order.length; i++) {
        var snap = S.threads.length;
        var ok = false;
        try { ok = order[i](c); } catch (e) { ok = false; }
        if (ok && S.threads.length > snap) {
          var t = S.threads[0];
          // não repete a mesma conversa
          var dup = S.threads.slice(1).some(function (x) { return x.key && x.key === t.key; });
          if (dup) { S.threads.shift(); continue; }
          changed = true; break;
        }
      }
    }
    if (changed) save(c);
  }

  /* ---------- responder ---------- */
  function reply(c, t, ri) {
    var r = t.replies[ri]; if (!r || t.done) return;
    t.msgs.push({ who: "me", text: r.label, day: day(c) });
    t.done = true; t.unread = false; t.answeredAt = day(c);
    if (r.morale && t.pid) bumpMorale(c, t.pid, r.morale);
    if (r.board) bumpBoard(c, r.board);
    if (r.pop) bumpPop(c, r.pop);
    if (r.grant) { c.budget = (c.budget || 0) + r.grant * (c.money ? c.money.mult : 1); }
    if (r.req && t.pid) { c.transferReq = c.transferReq || {}; c.transferReq[t.pid] = true; }
    if (r.clearReq && t.pid && c.transferReq) delete c.transferReq[t.pid];
    if (r.list && t.pid) { c.transferList = c.transferList || []; if (c.transferList.indexOf(t.pid) < 0) c.transferList.push(t.pid); }
    if (r.promise && t.pid) { c.promises = c.promises || {}; c.promises[t.pid] = { type: "minutos", until: (c.matchNo || 0) + 3 }; }
    if (r.risk && t.pid && c.injuries && c.injuries[t.pid]) c.injuries[t.pid] = Math.max(1, (c.injuries[t.pid] || 1) - 1);
    // resposta do outro lado
    var back = r.morale > 0 ? pick(["Obrigado, professor. É o que eu precisava ouvir.", "Pode deixar. Vou retribuir em campo."])
      : r.morale < 0 ? pick(["Entendido.", "Tudo bem. Respeito a decisão."])
      : t.kind === "board" ? pick(["Anotado. Vamos acompanhar de perto.", "Certo. Seguimos conversando."])
      : t.kind === "press" ? pick(["Obrigado pelo retorno, treinador.", "Anotado. Boa sorte no próximo jogo."])
      : pick(["Certo, professor.", "Combinado."]);
    t.msgs.push({ who: "them", text: back, day: day(c) });
    var pLeak = r.leak || 0;
    if (Math.random() < pLeak) leak(c, t, r);
    else if (r.grant) TM.notify.push(c, { icon: "💰", title: "Verba aprovada", news: true, text: boardName(c) + " liberou " + money(c, r.grant * (c.money ? c.money.mult : 1)) + " para reforços após a sua conversa." });
    save(c);
  }

  /* ---------- telas ---------- */
  function avatarOf(c, t, cls) {
    if (t.pid) { var p = C().resolvePlayer(c, t.pid); if (p) return TM.img.playerImg(p, cls + " tm-face"); }
    if (t.kind === "board") { var cl = myClub(c); if (cl) return TM.img.clubImg(cl, cls + " tm-crest"); }
    if (t.clubId) { var cl2 = TM.data.club(t.clubId); if (cl2) return TM.img.clubImg(cl2, cls + " tm-crest"); }
    return el("span", { class: cls + " tm-emoji", text: t.kind === "press" ? "🎙️" : t.kind === "agent" ? "💼" : "💬" });
  }
  var KIND_LBL = { player: "Jogador", board: "Diretoria", agent: "Empresário", press: "Imprensa" };

  TM.ui.register("coach-messenger", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    try { tick(c); } catch (e) {}
    var S = st(c), filt = (params && params.f) || "all";
    screen.appendChild(TM.ui.topbar("💬 Total Messenger", function () { TM.ui.go("coach-hub"); }));
    if (TM.coachUI && TM.coachUI.addBar) TM.coachUI.addBar(screen, "coach-messenger");
    var body = el("div", { class: "panel-narrow tm-wrap" }); screen.appendChild(body);
    var np = pending(c);
    body.appendChild(el("div", { class: "tm-head" }, [
      el("div", { class: "tm-head-t", text: "Caixa de entrada" }),
      el("div", { class: "tm-head-s", text: np ? np + " conversa" + (np > 1 ? "s" : "") + " esperando sua resposta" : "Nenhuma conversa pendente. Elas chegam conforme a temporada avança." })
    ]));
    var tabs = el("div", { class: "nw-tabs" });
    [["all", "Todas"], ["player", "Jogadores"], ["board", "Diretoria"], ["agent", "Empresários"], ["press", "Imprensa"]].forEach(function (f) {
      tabs.appendChild(el("button", { class: "nw-tab" + (filt === f[0] ? " on" : ""), text: f[1], on: { click: function () { TM.ui.go("coach-messenger", { f: f[0] }); } } }));
    });
    body.appendChild(tabs);
    var list = S.threads.filter(function (t) { return filt === "all" || t.kind === filt; });
    if (!list.length) { body.appendChild(el("p", { class: "intro-text", text: "Sem mensagens por aqui ainda. Jogue partidas, mexa no mercado e converse com o elenco." })); return; }
    list.forEach(function (t) {
      var last = t.msgs[t.msgs.length - 1];
      body.appendChild(el("div", { class: "tm-row clickable" + (t.unread ? " unread" : "") + (t.done ? " done" : ""), on: { click: function () { TM.ui.go("coach-message", { id: t.id, f: filt }); } } }, [
        avatarOf(c, t, "tm-av"),
        el("div", { class: "tm-mid" }, [
          el("div", { class: "tm-line1" }, [ el("span", { class: "tm-name", text: t.fromName }), el("span", { class: "tm-kind", text: KIND_LBL[t.kind] || "" }) ]),
          el("div", { class: "tm-subj", text: t.subject }),
          el("div", { class: "tm-prev", text: (last.who === "me" ? "Você: " : "") + last.text })
        ]),
        el("div", { class: "tm-right" }, [
          el("span", { class: "tm-date", text: dateTxt(c, t.day) }),
          t.unread ? el("span", { class: "tm-dot" }) : (t.done ? el("span", { class: "tm-ok", text: "✓" }) : null),
          t.leaked ? el("span", { class: "tm-leak", title: "Vazou na imprensa", text: "📢" }) : null
        ].filter(Boolean))
      ]));
    });
  });

  TM.ui.register("coach-message", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    var S = st(c), t = S.threads.filter(function (x) { return x.id === (params && params.id); })[0];
    var back = function () { TM.ui.go("coach-messenger", { f: (params && params.f) || "all" }); };
    if (!t) { back(); return; }
    if (t.unread) { t.unread = false; save(c); }
    screen.appendChild(TM.ui.topbar(t.fromName, back));
    var body = el("div", { class: "panel-narrow tm-chat" }); screen.appendChild(body);
    body.appendChild(el("div", { class: "tm-chat-head" }, [
      avatarOf(c, t, "tm-av big"),
      el("div", { class: "tm-mid" }, [
        el("div", { class: "tm-name", text: t.fromName }),
        el("div", { class: "tm-sub", text: (KIND_LBL[t.kind] || "") + (t.fromSub ? " · " + t.fromSub : "") })
      ]),
      t.pid ? TM.ui.button("👤", function () { var p = C().resolvePlayer(c, t.pid); if (p && TM.coachUI && TM.coachUI.openPlayer) TM.coachUI.openPlayer(p, "coach-messenger"); }, "btn ghost small") : null
    ].filter(Boolean)));
    body.appendChild(el("div", { class: "tm-subj-big", text: t.subject }));
    var chat = el("div", { class: "tm-bubbles" });
    t.msgs.forEach(function (m) {
      chat.appendChild(el("div", { class: "tm-bub " + (m.who === "me" ? "me" : "them") }, [
        el("div", { class: "tm-bub-tx", text: m.text }),
        el("div", { class: "tm-bub-dt", text: dateTxt(c, m.day) })
      ]));
    });
    body.appendChild(chat);
    if (t.leaked) body.appendChild(el("div", { class: "tm-leak-box", text: "📢 Um trecho desta conversa vazou para a imprensa." }));
    if (t.done) {
      body.appendChild(el("div", { class: "actions" }, [ TM.ui.button("← Voltar à caixa de entrada", back, "btn") ]));
      return;
    }
    body.appendChild(el("div", { class: "tm-replies-t", text: "Sua resposta" }));
    var box = el("div", { class: "tm-replies" });
    t.replies.forEach(function (r, i) {
      var risco = (r.leak || 0) >= 0.5 ? "🔥 pode vazar" : (r.leak || 0) >= 0.25 ? "⚠️ risco de vazar" : "";
      box.appendChild(el("button", { class: "tm-reply", on: { click: function () {
        reply(c, t, i);
        TM.ui.go("coach-message", { id: t.id, f: (params && params.f) || "all" });
      } } }, [
        el("span", { class: "tm-reply-tx", text: r.label }),
        risco ? el("span", { class: "tm-reply-risk", text: risco }) : null
      ].filter(Boolean)));
    });
    body.appendChild(box);
  });

  TM.msgr = { tick: tick, unread: unread, pending: pending, threads: function (c) { return st(c).threads; }, reply: reply, state: st };
})(window);
