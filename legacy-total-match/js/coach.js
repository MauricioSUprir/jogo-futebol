/* ================= TOTAL MATCH — Carreira de Treinador ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };

  function rivalryEnabled() { try { return TM.storage.settings().rivalry !== false; } catch (e) { return true; } }

  // ----- MORAL individual do jogador (por minutos jogados) -----
  // ajuste de moral vindo de conversas (elogiar/cobrar) — decai com o tempo
  function moraleAdjOf(c, id) {
    if (!c.moraleAdj || !c.moraleAdj[id]) return 0;
    var a = c.moraleAdj[id];
    var age = (c.matchNo || 0) - (a.at || 0);   // decai ~2 pontos por partida
    var v = a.v > 0 ? Math.max(0, a.v - age * 2) : Math.min(0, a.v + age * 2);
    return v;
  }
  function playerMorale(c, p) {
    var played = (c.stats && c.stats.p) || 0;
    var adj = moraleAdjOf(c, p.id);
    var capBonus = (c.captainId === p.id) ? 5 : 0;   // vestir a braçadeira dá orgulho
    if (c.transferReq && c.transferReq[p.id]) { var vv = Math.max(6, 18 + adj); return { v: vv, cls: "crit", txt: "Quer sair" }; }
    if (played < 3) { var v0 = Math.max(10, Math.min(98, 68 + adj + capBonus)); return { v: v0, cls: v0 >= 70 ? "ok" : "mid", txt: v0 >= 70 ? "Tranquilo" : "Atento" }; }
    var st = c.pstats && c.pstats[p.id]; var apps = st ? st.apps : 0;
    var ratio = apps / played;
    var m = 46 + Math.round(ratio * 48);
    if (p.overall >= 80 && ratio < 0.3) m -= 12;   // craque encostado fica mais irritado
    m += adj + capBonus;
    m = Math.max(10, Math.min(98, m));
    var cls = m >= 70 ? "ok" : m >= 45 ? "mid" : "lo";
    return { v: m, cls: cls, txt: m >= 78 ? "Feliz" : m >= 55 ? "Satisfeito" : m >= 35 ? "Incomodado" : "Insatisfeito" };
  }
  // liderança do capitão: moral do capitão + faixa etária -> bônus/ônus no vestiário (-3..+4)
  function captainLeadership(c) {
    if (!c.captainId) return { edge: 0, name: null };
    var p = null; try { p = C().resolvePlayer(c, c.captainId); } catch (e) {}
    if (!p) return { edge: 0, name: null };
    var mo = playerMorale(c, p);
    var edge = mo.v >= 80 ? 4 : mo.v >= 65 ? 2 : mo.v >= 45 ? 0 : -3;
    if ((p.age || 24) >= 30) edge += 1;   // experiência conta
    edge = Math.max(-3, Math.min(4, edge));
    return { edge: edge, name: p.name, morale: mo.v, exp: (p.age || 24) >= 30 };
  }
  // jogador com poucos minutos pode pedir transferência (esporádico)
  function maybePlayerUnrest(c) {
    var played = (c.stats && c.stats.p) || 0;
    if (played < 5) return;
    if (!c.transferReq) c.transferReq = {};
    // auto-resolve: quem voltou a jogar bastante deixa de querer sair
    Object.keys(c.transferReq).forEach(function (id) {
      var st = c.pstats && c.pstats[id];
      var clk = (c.careerStats && c.careerStats.p) || 0;
      var jd = (c.joinedAt && c.joinedAt[id] != null) ? c.joinedAt[id] : 0, sinceJ = Math.max(1, clk - jd);
      var reqAt = (c.transferReqAt && c.transferReqAt[id] != null) ? c.transferReqAt[id] : 0;
      // voltou a jogar depois do pedido: a insatisfação passa
      if (clk - reqAt >= 3 && st && (st.apps / sinceJ) > 0.45) {
        delete c.transferReq[id]; if (c.transferReqAt) delete c.transferReqAt[id];
        var plr = C().resolvePlayer(c, id);
        if (plr) TM.notify.push(c, { icon: "🤝", title: "Clima resolvido", text: plr.name + " voltou a jogar com regularidade e retirou o pedido de transferência." });
      }
    });
    var clock = (c.careerStats && c.careerStats.p) || 0;
    var stamp = (c.matchNo || 0) + ":" + (c.season || 1);
    if (c._lastUnrest === stamp) return;
    if (Math.random() < 0.88) return;   // esporádico (raro)
    if (clock - (c._lastUnrestAt || -99) < 10) return;   // descanso entre pedidos
    c._lastUnrestAt = clock;
    c._lastUnrest = stamp;
    var squad = []; try { squad = C().userSquad(c) || []; } catch (e) {}
    var MIN_CASA = 12;                     // só reclama depois de 12 jogos no clube (reforço recém-chegado tem paciência)
    var cand = squad.filter(function (p) {
      if (c.transferReq[p.id]) return false;
      if ((p.age || 24) > 32 || p.overall < 73) return false;
      var joined = (c.joinedAt && c.joinedAt[p.id] != null) ? c.joinedAt[p.id] : 0;
      var since = clock - joined;                       // jogos da carreira desde que ele chegou ao clube
      if (since < MIN_CASA) return false;               // acabou de chegar: nada de pedido de transferência
      if (c.injuries && c.injuries[p.id]) return false; // lesionado não reclama de falta de minutos
      if (c.promises && c.promises[p.id] && (c.promises[p.id].until || 0) >= (c.matchNo || 0)) return false;  // você prometeu minutos
      var st = c.pstats && c.pstats[p.id]; var apps = st ? st.apps : 0;
      return apps <= Math.floor(since * 0.25);          // praticamente não joga
    }).sort(function (a, b) { return b.overall - a.overall; });
    if (!cand.length) return;
    var p = cand[0];
    var joinedP = (c.joinedAt && c.joinedAt[p.id] != null) ? c.joinedAt[p.id] : 0;
    var sinceOf = Math.max(1, clock - joinedP), appsOf = (c.pstats && c.pstats[p.id] && c.pstats[p.id].apps) || 0;
    c.transferReq[p.id] = true;
    c.transferReqAt = c.transferReqAt || {}; c.transferReqAt[p.id] = clock;
    TM.notify.push(c, { icon: "😤", title: "Pedido de transferência", news: true, text: p.name + " entrou em campo em apenas " + appsOf + " dos últimos " + sinceOf + " jogos do clube e pediu para ser negociado. Dê mais minutos, converse com ele no Total Messenger ou avalie uma venda." });
    try { if (c.social) c.social.lastGen = ""; } catch (e) {}
  }

  // ----- ESTILOS DE JOGO / FILOSOFIA (mapeiam para as táticas do motor) -----
  var PLAY_STYLES = [
    { key: "posse", ic: "🎯", name: "Posse de bola", desc: "Controlar o jogo com a bola nos pés, com cadência e paciência.", id: "posse de bola e controle" },
    { key: "pressao", ic: "🔥", name: "Gegenpress", desc: "Pressão altíssima para recuperar a bola no campo adversário.", id: "pressão agressiva" },
    { key: "contra-ataque", ic: "⚡", name: "Contra-ataque", desc: "Recuar e explorar os espaços na velocidade das transições.", id: "transições rápidas" },
    { key: "direto", ic: "🎿", name: "Jogo direto", desc: "Bola longa e objetiva, buscando o ataque de forma vertical.", id: "jogo direto e vertical" },
    { key: "retranca", ic: "🛡️", name: "Defesa baixa", desc: "Bloco baixo e compacto, priorizando não sofrer gols.", id: "solidez defensiva" },
    { key: "ofensivo", ic: "⚔️", name: "Futebol ofensivo", desc: "Buscar o gol a todo custo, com muitos jogadores no ataque.", id: "futebol ofensivo" },
    { key: "pontas", ic: "↔️", name: "Jogo pelas pontas", desc: "Amplitude e cruzamentos, explorando as laterais do campo.", id: "jogo pelas pontas" },
    { key: "tiki-taka", ic: "🎼", name: "Construção curta", desc: "Trocas de passe curtas, saindo jogando desde a defesa.", id: "construção curta e toque de bola" }
  ];
  function playStyleOf(key) { for (var i = 0; i < PLAY_STYLES.length; i++) if (PLAY_STYLES[i].key === key) return PLAY_STYLES[i]; return null; }
  // identidade estável de um clube (o do usuário usa a filosofia escolhida)
  function clubStyle(c, clubId) {
    if (c && clubId === c.teamId) { var st = playStyleOf(c.tactic); return st || PLAY_STYLES[0]; }
    return PLAY_STYLES[phash("cstyle:" + clubId) % PLAY_STYLES.length];
  }
  // frase de identidade: "O <Clube> de <Técnico> é conhecido por <identidade>."
  function clubIdentityPhrase(c, clubId) {
    var club = TM.data.club(clubId); if (!club) return "";
    var st = clubStyle(c, clubId);
    var coach = (clubId === c.teamId) ? (c.coachName || "você") : (club.coach || "seu técnico");
    return "O " + club.name + " de " + coach + " é conhecido por " + st.id + ".";
  }
  TM.coachUI = TM.coachUI || {};
  TM.coachUI.identityPhrase = clubIdentityPhrase;
  TM.coachUI.clubStyle = clubStyle;
  TM.coachUI.playStyleOf = playStyleOf;

  // ----- SETORES do treinador (barra de abas deslizável) -----
  function coachSectors(c, active) {
    var unread = 0; try { unread = TM.notify.unread(c); } catch (e) {}
    var props = 0; try { props = (c.jobOffers || []).filter(function (o) { return !o.seen; }).length; } catch (e) {}
    return [
      { ic: "🏠", label: "Início", route: "coach-hub" },
      { ic: "👥", label: "Elenco", route: "coach-squad" },
      { ic: "📋", label: "Escalação", route: "coach-lineup" },
      { ic: "🌱", label: "Base", route: "coach-youth" },
      { ic: "🔁", label: "Mercado", route: "coach-market" },
      { ic: "🔭", label: "Olheiros", route: "coach-scouting" },
      { ic: "🏆", label: "Competições", route: "coach-comps" },
      { ic: "🌍", label: "Mundo", route: "coach-world" },
      { ic: "💬", label: "Mensagens", route: "coach-messenger", badge: (function () { try { return TM.msgr ? TM.msgr.unread(c) : 0; } catch (e) { return 0; } })() },
      { ic: "💰", label: "Finanças", route: "coach-finance" },
      { ic: "📜", label: "Contrato", route: "coach-contract" },
      { ic: "📅", label: "Calendário", route: "coach-calendar" },
      { ic: "🔄", label: "Movim.", route: "coach-transfers" },
      { ic: "💼", label: "Propostas", route: "coach-offers", badge: props },
      { ic: "📰", label: "Notícias", route: "coach-news" },
      { ic: "📱", label: "Redes", route: "coach-social" },
      { ic: "🔔", label: "Avisos", route: "coach-notifications", badge: unread }
    ].map(function (s) { if (s.route === active) s.active = true; return s; });
  }
  // sheet (modal) com TODOS os setores — aberto pelo botão "Mais" (⋯) da nav inferior
  function openSectorSheet(c, active) {
    var overlay = el("div", { class: "sheet-overlay", on: { click: function (e) { if (e.target === overlay) close(); } } });
    function close() { overlay.classList.remove("show"); setTimeout(function () { overlay.remove(); }, 220); }
    var grid = el("div", { class: "sheet-grid" });
    coachSectors(c, active).forEach(function (s) {
      grid.appendChild(el("button", { class: "sheet-tile" + (s.active ? " on" : ""), on: { click: function () { close(); if (!s.active) TM.ui.go(s.route); } } }, [
        el("span", { class: "sheet-ic", text: s.ic }),
        el("span", { class: "sheet-lb", text: s.label }),
        s.badge ? el("span", { class: "sheet-badge", text: s.badge > 9 ? "9+" : s.badge }) : null
      ]));
    });
    var sheet = el("div", { class: "sheet" }, [
      el("div", { class: "sheet-handle" }),
      el("div", { class: "sheet-title", text: "Todas as seções" }),
      grid
    ]);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("show"); });
  }
  // NAV inferior (estilo app): setores primários fixos no rodapé + "Mais" (⋯) para o resto
  function bottomNav(c, active) {
    var items = [
      { ic: "🏠", label: "Início", route: "coach-hub" },
      { ic: "👥", label: "Elenco", route: "coach-squad" },
      { ic: "📋", label: "Escalar", route: "coach-lineup" },
      { ic: "🔁", label: "Mercado", route: "coach-market" },
      { ic: "🔭", label: "Olheiros", route: "coach-scouting" },
      { ic: "🌍", label: "Mundo", route: "coach-world" },
      { ic: "💬", label: "Msgs", route: "coach-messenger", badge: (function () { try { return TM.msgr ? TM.msgr.unread(c) : 0; } catch (e) { return 0; } })() }
    ];
    var nav = el("nav", { class: "bottom-nav" });
    items.forEach(function (it) {
      var on = it.route === active;
      nav.appendChild(el("button", { class: "bn-item" + (on ? " on" : ""), on: { click: function () { if (!on) TM.ui.go(it.route); } } }, [
        el("span", { class: "bn-ic", text: it.ic }),
        el("span", { class: "bn-lb", text: it.label }),
        it.badge ? el("span", { class: "bn-badge", text: it.badge > 9 ? "9+" : it.badge }) : null
      ].filter(Boolean)));
    });
    // botão "Mais" (⋯) — abre o sheet com todas as seções; badge soma avisos/propostas
    var extra = 0;
    try { extra = (TM.notify.unread(c) || 0) + ((c.jobOffers || []).filter(function (o) { return !o.seen; }).length || 0); } catch (e) {}
    var primary = { "coach-hub": 1, "coach-squad": 1, "coach-lineup": 1, "coach-market": 1, "coach-scouting": 1, "coach-world": 1, "coach-messenger": 1 };
    var moreActive = !primary[active];
    nav.appendChild(el("button", { class: "bn-item bn-more" + (moreActive ? " on" : ""), on: { click: function () { openSectorSheet(c, active); } } }, [
      el("span", { class: "bn-ic", text: "⋯" }),
      el("span", { class: "bn-lb", text: "Mais" }),
      extra ? el("span", { class: "bn-badge", text: extra > 9 ? "9+" : extra }) : null
    ]));
    return nav;
  }
  // injeta a barra de setores (topo no celular / SIDEBAR no PC) + a nav inferior (celular)
  function addSectorBar(screen, active) {
    var c = TM.storage.coachCareer(); if (!c) return;
    var bar = TM.ui.sectorBar(coachSectors(c, active), active);
    // cabeçalho do sidebar (só aparece no PC via CSS)
    var club = TM.data.club(c.teamId);
    bar.insertBefore(el("div", { class: "sb-brand" }, [
      el("span", { class: "sb-logo" }, [ el("img", { class: "sb-mark", src: "assets/logo.png", alt: "" }), el("span", { text: "Total Match" + ((TM.storage.edition && TM.storage.edition() === "pro") ? " · Season Update" : "") }) ]),
      el("div", { class: "sb-club-row" }, [
        club ? TM.img.clubImg(club, "sb-crest") : null,
        el("div", { class: "sb-club-info" }, [
          el("div", { class: "sb-club", text: club ? club.name : "Carreira" }),
          el("div", { class: "sb-sub", text: "Temporada " + (c.season || 1) })
        ])
      ])
    ]), bar.firstChild);
    screen.appendChild(bar);
    screen.appendChild(bottomNav(c, active));
    screen.appendChild(el("div", { class: "bottom-nav-spacer" }));
    screen.classList.add("has-sidebar");
  }
  TM.coachUI = TM.coachUI || {};
  TM.coachUI.sectors = coachSectors; TM.coachUI.addBar = addSectorBar;

  // recados contextuais do AUXILIAR TÉCNICO e da DIRETORIA (chegam na Central de avisos)
  function maybeStaffMessage(c) {
    try {
      var stamp = (c.matchNo || 0) + ":" + (c.season || 1);
      if (c._lastStaffStamp === stamp) return;      // no máx. 1 recado por ciclo de jogo
      c._lastStaffStamp = stamp;
      if ((c.matchNo || 0) < 1 || Math.random() < 0.30) return;   // nem sempre há recado
      var squad = C().userSquad(c) || []; if (!squad.length) return;
      var byOv = squad.slice().sort(function (a, b) { return b.overall - a.overall; });
      var msgs = [];
      // --- AUXILIAR TÉCNICO ---
      var young = squad.filter(function (p) { return (p.age || 24) <= 20 && (p.potential || p.overall) >= 77; });
      if (young.length) msgs.push({ w: 3, icon: "🧑‍🏫", title: "Auxiliar técnico", text: "Fica de olho no garoto " + young[0].name + ": o potencial (" + (young[0].potential || young[0].overall) + ") é alto. Dar minutos acelera a evolução dele." });
      var vet = squad.slice().sort(function (a, b) { return (b.age || 0) - (a.age || 0); })[0];
      if (vet && (vet.age || 0) >= 33) msgs.push({ w: 2, icon: "🧑‍🏫", title: "Auxiliar técnico", text: vet.name + " (" + vet.age + ") pesa a experiência, mas talvez precise de rodízio para render 90 minutos." });
      // setor mais fraco
      var sect = [["GK", "goleiro"], ["DF", "defesa"], ["MF", "meio-campo"], ["FW", "ataque"]].map(function (s) {
        var arr = squad.filter(function (p) { return p.pos === s[0]; }).sort(function (a, b) { return b.overall - a.overall; }).slice(0, s[0] === "GK" ? 1 : 3);
        return { name: s[1], f: arr.length ? Math.round(arr.reduce(function (t, p) { return t + p.overall; }, 0) / arr.length) : 0 };
      }).sort(function (a, b) { return a.f - b.f; })[0];
      if (sect && sect.f) msgs.push({ w: 2, icon: "🧑‍🏫", title: "Auxiliar técnico", text: "Analisando o elenco, o nosso ponto mais fraco é o " + sect.name + " (~" + sect.f + "). Vale buscar reforço no mercado." });
      msgs.push({ w: 1, icon: "🧑‍🏫", title: "Auxiliar técnico", text: "Estudei o próximo adversário: bola parada pode ser o caminho. Treinamos escanteios essa semana." });
      msgs.push({ w: 1, icon: "🧑‍🏫", title: "Auxiliar técnico", text: byOv[0].name + " está treinando muito bem. Se mantiver, é titular garantido." });
      // --- DIRETORIA ---
      var conf = boardConfidence(c);
      if (conf < 35) msgs.push({ w: 4, icon: "🏛️", title: "Diretoria", text: "Os resultados não estão à altura do clube. A diretoria espera uma reação imediata — a sua permanência depende disso." });
      else if (conf > 78) msgs.push({ w: 3, icon: "🏛️", title: "Diretoria", text: "A diretoria está muito satisfeita com o seu trabalho. Confiança total no projeto — continue assim!" });
      else msgs.push({ w: 2, icon: "🏛️", title: "Diretoria", text: "A diretoria acompanha de perto. Mantenha a regularidade e cumpra a meta da temporada." });
      if ((c.budget || 0) > 5000000) msgs.push({ w: 2, icon: "🏛️", title: "Diretoria", text: "Liberamos verba para reforços. Traga nomes que façam a diferença — a torcida pede." });
      var rivalNm = TM.data.rivalName(c.teamId);
      if (rivalNm && rivalryEnabled()) msgs.push({ w: 2, icon: "🏛️", title: "Diretoria", text: "Bater o " + rivalNm + " no clássico vale ouro para a nossa torcida. Prepare o time para essa guerra." });
      // sorteio ponderado
      var total = msgs.reduce(function (t, m) { return t + m.w; }, 0), r = Math.random() * total, pick = msgs[0];
      for (var i = 0; i < msgs.length; i++) { r -= msgs[i].w; if (r <= 0) { pick = msgs[i]; break; } }
      TM.notify.push(c, { icon: pick.icon, title: pick.title, text: pick.text, staff: true });
    } catch (e) {}
  }

  // informações do dia do jogo (determinísticas): horário, clima e lotação
  function matchDayInfo(c, homeClub, matchNo, pending) {
    var key = (homeClub.id || "") + ":" + (c.season || 1) + ":" + (matchNo || 0);
    var h = 2166136261; for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } h = h >>> 0;
    var times = ["11:00", "15:00", "16:00", "16:30", "18:30", "19:00", "20:00", "21:00", "21:30"];
    var W = [["☀️", "Ensolarado", 24, 33], ["🌤️", "Sol entre nuvens", 21, 29], ["⛅", "Parcialmente nublado", 18, 26], ["☁️", "Nublado", 14, 22], ["🌧️", "Chuva", 11, 18], ["⛈️", "Tempestade", 12, 19]];
    // override editável pelo usuário (horário/clima) para este jogo
    var over = (c.mdOverride && c.mdOverride.mn === (matchNo || 0)) ? c.mdOverride : null;
    var time = over && over.time ? over.time : times[h % times.length];
    var w = (over && over.w != null && W[over.w]) ? W[over.w] : W[(h >>> 3) % W.length];
    var wTemp = w[2] + ((h >>> 7) % (w[3] - w[2] + 1));
    var cap = 30000; try { cap = TM.data.stadium(homeClub).capacity || 30000; } catch (e) {}
    var rating = 68; try { rating = TM.data.clubRating(homeClub.id); } catch (e) {}
    var fill = 0.50 + (rating - 60) * 0.012;
    if (rivalryEnabled() && pending && TM.data.areRivals(pending.homeId, pending.awayId)) fill += 0.28; // clássico lota
    if (w[0] === "🌧️" || w[0] === "⛈️") fill -= 0.06;                                                   // chuva esvazia um pouco
    fill += (((h >>> 11) % 11) - 5) * 0.01;
    fill = Math.max(0.30, Math.min(1, fill));
    var attend = Math.round(cap * fill / 100) * 100;
    return { time: time, wIcon: w[0], wLabel: w[1], wTemp: wTemp, attend: attend.toLocaleString("pt-BR") + " / " + cap.toLocaleString("pt-BR") };
  }

  // confiança da diretoria (0-100): posição vs meta, ajustada pelo rigor do conselho
  function boardConfidence(c) {
    try {
      // saves antigos: 'confidence' é o mapa de confiança por jogador; se virou número/NaN por engano, restaura o mapa
      if (c && (typeof c.confidence !== "object" || c.confidence === null)) c.confidence = {};
      if (c && (typeof c.boardTrust !== "number" || !isFinite(c.boardTrust))) c.boardTrust = 50;
      var pos = C().currentPosition(c), target = (c.objective && c.objective.maxPos) || 10;
      var diff = target - pos;                         // + = melhor que a meta
      var rigor = c.board === "rigorosa" ? 1.35 : c.board === "tranquila" ? 0.7 : 1;
      var v = 58 + diff * 6 * rigor;
      if (typeof c.boardTrust === "number" && isFinite(c.boardTrust)) v += (c.boardTrust - 50) * 0.2;   // confiança acumulada (SAF, dívidas, vendas) influencia
      if (!isFinite(v)) v = 58;
      return Math.max(3, Math.min(100, Math.round(v)));
    } catch (e) { return 60; }
  }

  function sym(c) { return c.money ? c.money.sym : "€"; }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function r2(n) { return Math.round(n * 100) / 100; }                   // 2 casas (mantém sub-1M)
  function curVal(c, eur) { return r2(eur * mult(c)); }                  // euro -> moeda da carreira (mantém frações)
  // valor já na moeda da carreira: >=1M mostra "M", <1M mostra em mil
  function money(c, cur) {
    var s = sym(c), sign = cur < 0 ? "-" : "", n = Math.abs(cur);
    if (n >= 1) { var m = n < 10 ? Math.round(n * 10) / 10 : Math.round(n); return sign + s + " " + m + "M"; }
    var k = Math.round(n * 1000);
    return k <= 0 ? s + " 0" : sign + s + " " + k + " mil";
  }
  // passo do slider conforme a grandeza do valor (permite frações abaixo de 1M)
  function moneyStep(maxv) { return maxv >= 50 ? 1 : maxv >= 10 ? 0.5 : maxv >= 3 ? 0.1 : 0.05; }

  // ----- CONTRATOS (duração, salário, cláusula de rescisão) -----
  function phash(s) { s = String(s || ""); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function ensureContracts(c) {
    if (!c.contracts) c.contracts = {};
    (c.roster || []).forEach(function (id) {
      if (!c.contracts[id]) {
        var p = TM.data.player(id); if (!p) return;
        var val = TM.data.marketValue ? TM.data.marketValue(p) : (p.overall || 70) / 10;
        c.contracts[id] = { years: 1 + (phash(id + ":ct") % 4), wage: r2(Math.max(0.02, val * 0.10)), clause: (phash(id + ":hc") % 100 < 55) ? r2(val * (2 + (phash(id + ":cl") % 20) / 10)) : 0 };
      }
    });
    var keepCt = {}; (c.pendingArrivals || []).forEach(function (a) { keepCt[a.pid] = 1; });   // pré-contratos / chegadas pendentes mantêm o contrato
    Object.keys(c.contracts).forEach(function (id) { if ((c.roster || []).indexOf(id) < 0 && !keepCt[id]) delete c.contracts[id]; });
  }
  function getContract(c, id) { ensureContracts(c); return c.contracts[id]; }

  // lista um jogador para venda — se for ídolo, avisa e a torcida/elenco reage
  function listForSale(c, p) {
    function doList(reaction) {
      c.transferList = c.transferList || []; if (c.transferList.indexOf(p.id) < 0) c.transferList.push(p.id);
      if (reaction) {
        try { if (TM.social && TM.social.nudgeMorale) TM.social.nudgeMorale(c, -14); } catch (e) {}
        try { if (c.social) c.social.lastGen = ""; } catch (e) {}
        c.moraleAdj = c.moraleAdj || {};
        (c.roster || []).forEach(function (id) { c.moraleAdj[id] = { v: Math.max(-20, (moraleAdjOf(c, id)) - 6), at: (c.matchNo || 0) }; });
        TM.notify.push(c, { icon: "😡", title: "Revolta da torcida", news: true, text: "Colocar " + p.name + ", um ídolo do clube, à venda irritou a torcida e abalou o vestiário. Pense bem antes de negociá-lo." });
      }
      TM.storage.saveCoachCareer(c);
      TM.ui.toast(p.name + " na lista de transferências.");
      TM.ui.go("coach-player");
    }
    var idol = idolStatus(c, p);
    if (idol && (idol.cls === "idol" || idol.cls === "legend")) {
      TM.ui.confirm("Vender um ídolo?", p.name + " é " + idol.label.toLowerCase() + ". Listá-lo para venda vai revoltar a torcida e derrubar a moral do elenco. Tem certeza?", "Listar mesmo assim", function () { doList(true); }, true);
    } else { doList(false); }
  }

  // ----- ÍDOLOS / CRIAS DO CLUBE (tempo de casa + formados na base) -----
  function ensureTenure(c) {
    if (!c.tenure) c.tenure = {};
    if (!c.homegrown) c.homegrown = {};
    (c.roster || []).forEach(function (id) {
      if (c.tenure[id] == null) {
        // no elenco inicial, distribui tempo de casa (0-6) e marca ~28% como crias da base
        var isInitial = !c.signedFrom || !(id in c.signedFrom);
        c.tenure[id] = isInitial ? (phash(id + ":ten") % 7) : 0;
        if (isInitial && c.homegrown[id] == null) {
          var pl0 = null, lg0 = null; try { pl0 = C().resolvePlayer(c, id); lg0 = TM.data.league(c.leagueId); } catch (e) {}
          var sameNation = !pl0 || !lg0 || !lg0.nation || !pl0.nationName || pl0.nationName === lg0.nation;
          c.homegrown[id] = sameNation && (!pl0 || (pl0.age || 25) <= 29) && (phash(id + ":hg") % 100) < 28;
        }
      }
      if (c.homegrown[id] == null) c.homegrown[id] = false;
    });
  }
  // status de ídolo: cria com casa OU muito tempo de casa (servo leal)
  function idolStatus(c, p) {
    if (!c || !p) return null;
    ensureTenure(c);
    if ((c.roster || []).indexOf(p.id) < 0) return null;
    var t = c.tenure[p.id] || 0, hg = !!c.homegrown[p.id];
    if (hg && t >= 5) return { cls: "legend", label: "Ídolo eterno da base", ic: "👑" };
    if (t >= 7) return { cls: "legend", label: "Ídolo do clube", ic: "👑" };
    if (hg && t >= 3) return { cls: "idol", label: "Cria e ídolo do clube", ic: "⭐" };
    if (t >= 5) return { cls: "idol", label: "Ídolo do clube", ic: "⭐" };
    if (hg) return { cls: "home", label: "Cria da base", ic: "🌱" };
    if (t >= 3) return { cls: "home", label: "Veterano da casa", ic: "🎖️" };
    return null;
  }

  // ----- CONTRATO DO PRÓPRIO TREINADOR (salário, duração, multa, objetivo) -----
  function ensureMyContract(c) {
    if (c.myContract) return c.myContract;
    var rating = 70; try { rating = TM.data.clubRating(c.teamId); } catch (e) {}
    var baseWageEur = Math.max(0.3, (rating - 55) * 0.35);            // ~0.3M a ~14M/ano
    var obj = (c.objective && c.objective.desc) || "Cumprir as metas da diretoria";
    c.myContract = {
      years: 2 + (phash("myc:" + c.teamId) % 2),                     // 2-3 temporadas
      wage: r2(baseWageEur * mult(c)),                                // salário/ano na moeda
      fine: r2(baseWageEur * mult(c) * 1.5),                          // multa para sair antes
      objective: obj, signedSeason: c.season || 1
    };
    return c.myContract;
  }
  // renovação oferecida pela diretoria — melhora conforme confiança + reputação
  function renewalTerms(c) {
    var mc = ensureMyContract(c);
    var conf = boardConfidence(c), rep = 0; try { rep = C().computeReputation(c); } catch (e) {}
    var raise = 1 + Math.max(0, (conf - 55)) / 140 + Math.max(0, (rep - 20)) / 260;   // até ~+55%
    return { years: mc.years + 2, wage: r2(mc.wage * raise), fine: r2(mc.wage * raise * 1.6), raisePct: Math.round((raise - 1) * 100) };
  }

  // DEADLINE DAY — dispara boatos de mercado uma vez por janela
  function maybeDeadlineRumors(c, win) {
    if (!win) return;
    var key = "dd:" + c.season + ":" + Math.round(win.closeDay);
    c.ddRumors = c.ddRumors || {};
    if (c.ddRumors[key]) return;
    c.ddRumors[key] = true;
    try {
      var clubs = (TM.data.world().clubs || []).filter(function (cl) { return cl.id !== c.teamId; });
      var pool = [];
      clubs.forEach(function (cl) { (cl.squad || []).forEach(function (id) { var p = TM.data.player(id); if (p && (p.overall || 0) >= 78) pool.push({ p: p, cl: cl }); }); });
      for (var i = pool.length - 1; i > 0; i--) { var j = phash("dd" + key + i) % (i + 1); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      var picks = pool.slice(0, 3);
      var verbs = ["está perto de acertar com", "recebe proposta milionária de", "pode trocar de clube: alvo d", "tem futuro em aberto na reta final da janela em"];
      picks.forEach(function (o, k) {
        var dest = clubs[phash("dst" + key + k) % clubs.length];
        TM.notify.push(c, { icon: "📰", title: "Boato de mercado", news: true, text: o.p.name + " (" + o.cl.name + ") " + verbs[k % verbs.length] + (verbs[k % verbs.length].endsWith("d") ? "o " + dest.name : " " + dest.name) + "." });
      });
      TM.notify.push(c, { icon: "⏰", title: "DEADLINE DAY", news: true, text: "Última chamada: a " + win.name + " fecha em breve. Feche seus reforços!" });
    } catch (e) {}
    TM.storage.saveCoachCareer(c);
  }

  function roundTitle(nTies) { return ({ 8: "Oitavas de final", 4: "Quartas de final", 2: "Semifinal", 1: "Final" })[nTies] || (nTies * 2 + " times"); }

  // rascunho da configuração de carreira (persiste ao abrir a lista de treinadores e voltar)
  var pendingSetup = null;
  // repasse do jogador aposentado (Rumo ao Estrelato) que virou treinador
  var exPlayerHandoff = null;
  function freshSetup(clubId, mode) {
    var s = { clubId: clubId, currency: "eur", injection: 0, coachName: "", coachPhoto: null, coachId: null, coachMode: mode || "create", nationId: null, board: "intermediaria", role: "treinador", allowRestart: false };
    if (exPlayerHandoff) { s.coachName = exPlayerHandoff.name || ""; s.coachPhoto = exPlayerHandoff.photo || null; s.coachMode = "create"; }
    return s;
  }
  // chamado pela tela de aposentadoria do jogador: inicia a Master League já com o nome/foto do ex-jogador
  TM.coach = TM.coach || {};
  TM.coach.startFromPlayer = function (info) { exPlayerHandoff = info || null; pendingSetup = null; TM.ui.go("coach"); };
  // avatar do treinador: foto real se existir, senão iniciais em círculo colorido
  function coachAvatar(co, cls) { return TM.img.coachImg(co, cls); }

  /* ---------- entrada ---------- */
  TM.ui.register("coach", function (screen) {
    var _exist = TM.storage.coachCareer();
    if (_exist && !exPlayerHandoff) { if (_exist.type === "director") TM.club.migrateDirector(_exist); TM.ui.go("coach-hub"); return; }
    // navegando clubes reais: garante o mundo "normal" (limpa clube personalizado pendente)
    try { if (TM.storage.read("customClub", null)) { TM.storage.remove("customClub"); TM.data.resetWorld(); } } catch (e) {}
    screen.appendChild(TM.ui.topbar("🎯 Master League", function () { exPlayerHandoff = null; TM.ui.go("modes"); }));
    screen.appendChild(el("div", { class: "panel-narrow", style: "padding-bottom:0" }, [
      el("button", { class: "create-club-cta", on: { click: function () { TM.ui.go("coach-create-club"); } } }, [
        el("span", { class: "ccc-ic", text: "➕" }),
        el("div", { class: "ccc-txt" }, [ el("div", { class: "ccc-title", text: "Criar meu próprio clube" }), el("div", { class: "ccc-sub", text: "Nome, escudo, cores, verba e nível — do zero" }) ]),
        el("span", { class: "ccc-arrow", text: "›" })
      ])
    ]));
    if (exPlayerHandoff) screen.appendChild(el("div", { class: "twin-bar open", style: "max-width:620px;margin:0 auto 4px" }, [ el("span", { text: "🎽➡️🎯 " + exPlayerHandoff.name + " começa a carreira de treinador" }), el("span", { class: "twin-sub", text: "escolha o clube para comandar" }) ]));
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

  /* ---------- criar meu próprio clube ---------- */
  var customDraft = null;
  function levelLabel(v) { return v >= 82 ? "Elite" : v >= 76 ? "Forte" : v >= 70 ? "Bom" : v >= 63 ? "Médio" : "Modesto"; }
  TM.ui.register("coach-create-club", function (screen) {
    if (!customDraft) customDraft = { name: "", short: "", colors: { primary: "#1f7a3c", secondary: "#f4f4f4" }, crestData: null, kitData: null, kitAwayData: null, kitThirdData: null, leagueId: "br", level: 68 };
    var d = customDraft;
    screen.appendChild(TM.ui.topbar("➕ Criar meu clube", function () { TM.ui.go("coach"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    // pré-visualização do escudo
    var preview = el("div", { class: "cc-preview" });
    function drawPreview() {
      TM.ui.clear(preview);
      var mock = { name: d.name || "Meu Clube", colors: d.colors, crestData: d.crestData, kitData: d.kitData, kitAwayData: d.kitAwayData, kitThirdData: d.kitThirdData, id: "preview" };
      preview.appendChild(TM.img.clubImg(mock, "cc-preview-crest"));
      preview.appendChild(el("div", { class: "cc-preview-info" }, [
        el("div", { class: "cc-preview-name", text: d.name || "Meu Clube" }),
        el("div", { class: "cc-preview-sub", text: (d.short || "MEU") + " · nível " + levelLabel(d.level) })
      ]));
      preview.appendChild(el("div", { class: "cc-preview-kits" }, [
        TM.img.kitImg(mock, "cc-preview-kit", 0),
        TM.img.kitImg(mock, "cc-preview-kit", 1),
        TM.img.kitImg(mock, "cc-preview-kit", 2)
      ]));
    }
    body.appendChild(preview);

    // nome + sigla
    var nameIn = el("input", { class: "text-input", type: "text", maxlength: "22", placeholder: "Nome do clube", value: d.name });
    nameIn.addEventListener("input", function () { d.name = nameIn.value; if (!d._shortEdited) { d.short = (d.name.replace(/[^A-Za-zÀ-ú]/g, "").slice(0, 3) || "").toUpperCase(); shortIn.value = d.short; } drawPreview(); });
    var shortIn = el("input", { class: "text-input", type: "text", maxlength: "3", placeholder: "SIG", value: d.short, style: "text-transform:uppercase" });
    shortIn.addEventListener("input", function () { d._shortEdited = true; d.short = shortIn.value.toUpperCase(); drawPreview(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Nome e sigla" }), el("div", { class: "cc-name-row" }, [ nameIn, shortIn ]) ]));

    // escudo (upload) + cores
    var crestBox = el("div", { class: "photo-drop small" }, [ d.crestData ? el("img", { src: d.crestData, class: "photo-img" }) : el("span", { text: "🛡️ Escudo" }) ]);
    var crestFile = el("input", { type: "file", accept: "image/*", style: "display:none" });
    crestBox.addEventListener("click", function () { crestFile.click(); });
    crestFile.addEventListener("change", function () {
      var f = crestFile.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (ev) { var img = new Image(); img.onload = function () {
        var cv = document.createElement("canvas"), sc = Math.min(1, 256 / Math.max(img.width, img.height));
        cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        d.crestData = cv.toDataURL("image/png"); TM.ui.clear(crestBox); crestBox.appendChild(el("img", { src: d.crestData, class: "photo-img" })); drawPreview();
      }; img.src = ev.target.result; };
      r.readAsDataURL(f);
    });
    var cPrim = el("input", { type: "color", class: "cc-color", value: d.colors.primary });
    cPrim.addEventListener("input", function () { d.colors.primary = cPrim.value; drawPreview(); });
    var cSec = el("input", { type: "color", class: "cc-color", value: d.colors.secondary });
    cSec.addEventListener("input", function () { d.colors.secondary = cSec.value; drawPreview(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Escudo e cores" }),
      el("div", { class: "cc-brand-row" }, [ crestBox, crestFile,
        el("div", { class: "cc-colors" }, [ el("label", { class: "cc-color-lab" }, [ cPrim, el("span", { text: "Principal" }) ]), el("label", { class: "cc-color-lab" }, [ cSec, el("span", { text: "Secundária" }) ]) ]) ]),
      el("div", { class: "setting-hint", text: "Sem escudo? O jogo gera um com as suas cores e a sigla." }) ]));

    // uniformes (upload dos 3: principal / reserva / terceiro)
    function kitSlot(key, label, ph) {
      var box = el("div", { class: "photo-drop small" });
      var fileIn = el("input", { type: "file", accept: "image/*", style: "display:none" });
      var caption = el("div", { class: "cc-kit-cap", text: label });
      function paint() {
        TM.ui.clear(box);
        if (d[key]) box.appendChild(el("img", { src: d[key], class: "photo-img" }));
        else box.appendChild(el("span", { text: ph }));
      }
      box.addEventListener("click", function () { fileIn.click(); });
      fileIn.addEventListener("change", function () {
        var f = fileIn.files[0]; if (!f) return;
        var r = new FileReader();
        r.onload = function (ev) { var img = new Image(); img.onload = function () {
          var cv = document.createElement("canvas"), sc = Math.min(1, 300 / Math.max(img.width, img.height));
          cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          d[key] = cv.toDataURL("image/png"); paint(); ctrl.classList.add("has"); drawPreview();
        }; img.src = ev.target.result; };
        r.readAsDataURL(f);
      });
      var rm = el("button", { class: "cc-kit-rm", text: "✕", title: "Remover", on: { click: function (e) { e.stopPropagation(); d[key] = null; paint(); ctrl.classList.remove("has"); drawPreview(); } } });
      paint();
      var ctrl = el("div", { class: "cc-kit-slot" + (d[key] ? " has" : "") }, [ box, fileIn, rm, caption ]);
      return ctrl;
    }
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Uniformes (opcional)" }),
      el("div", { class: "cc-kit-grid" }, [
        kitSlot("kitData", "Principal", "👕 1"),
        kitSlot("kitAwayData", "Reserva", "👕 2"),
        kitSlot("kitThirdData", "Terceiro", "👕 3")
      ]),
      el("div", { class: "setting-hint", text: "Importe a camisa 1, 2 e 3 do seu time — ou deixe em branco que o jogo gera pelas cores." }) ]));

    // liga onde vai jogar
    var lgSel = el("select", { class: "select" });
    TM.data.world().leagues.forEach(function (lg) { lgSel.appendChild(el("option", { value: lg.id, text: lg.name, selected: lg.id === d.leagueId })); });
    lgSel.addEventListener("change", function () { d.leagueId = lgSel.value; d.slotClubId = null; d.rivalClubId = null; fillClubs(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Liga onde vai jogar" }), lgSel ]));

    // clube que será SUBSTITUÍDO pelo seu
    var repSel = el("select", { class: "select" });
    repSel.addEventListener("change", function () { d.slotClubId = repSel.value; fillRivals(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Substituir qual time?" }), repSel,
      el("div", { class: "setting-hint", text: "Seu clube entra na liga NO LUGAR desse time." }) ]));

    // RIVAL do seu clube (clássico forte)
    var rivSel = el("select", { class: "select" });
    rivSel.addEventListener("change", function () { d.rivalClubId = rivSel.value; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "🔥 Escolha seu maior RIVAL" }), rivSel,
      el("div", { class: "setting-hint", text: "Jogos contra o rival viram CLÁSSICO — clima quente, e quase nunca há transferências entre vocês." }) ]));

    function leagueClubs() {
      return TM.data.league(d.leagueId).clubIds.map(TM.data.club)
        .sort(function (a, b) { return TM.data.clubRating(b.id) - TM.data.clubRating(a.id); });
    }
    function fillClubs() {
      var cs = leagueClubs();
      TM.ui.clear(repSel);
      // padrão: substituir o mais fraco
      if (!d.slotClubId) d.slotClubId = cs[cs.length - 1].id;
      cs.forEach(function (c) { repSel.appendChild(el("option", { value: c.id, text: c.name + " (" + TM.data.clubRating(c.id) + ")", selected: c.id === d.slotClubId })); });
      fillRivals();
    }
    function fillRivals() {
      var cs = leagueClubs().filter(function (c) { return c.id !== d.slotClubId; });
      TM.ui.clear(rivSel);
      if (!d.rivalClubId || d.rivalClubId === d.slotClubId) d.rivalClubId = cs[0].id; // padrão: o mais forte
      cs.forEach(function (c) { rivSel.appendChild(el("option", { value: c.id, text: c.name + " (" + TM.data.clubRating(c.id) + ")", selected: c.id === d.rivalClubId })); });
    }
    fillClubs();

    // nível inicial
    var lvlVal = el("span", { class: "range-val" });
    var lvlSlider = el("input", { type: "range", min: 55, max: 85, step: 1, value: d.level, class: "slider" });
    function updLvl() { lvlVal.textContent = " " + levelLabel(d.level) + " (~" + d.level + ")"; }
    lvlSlider.addEventListener("input", function () { d.level = parseInt(lvlSlider.value, 10); updLvl(); drawPreview(); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode("Nível inicial do elenco"), lvlVal ]), lvlSlider,
      el("div", { class: "setting-hint", text: "Quanto mais alto, mais forte o time começa (e maior o orçamento). Comece modesto para o desafio de subir na base." }) ]));

    updLvl(); drawPreview();

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Continuar →", function () {
        if (!(d.name || "").trim()) { TM.ui.toast("Dê um nome ao clube"); return; }
        if (!(d.short || "").trim()) d.short = (d.name.replace(/[^A-Za-zÀ-ú]/g, "").slice(0, 3) || "CLB").toUpperCase();
        var slotId = d.slotClubId || TM.data.league(d.leagueId).clubIds.map(TM.data.club).sort(function (a, b) { return TM.data.clubRating(a.id) - TM.data.clubRating(b.id); })[0].id;
        if (d.rivalClubId === slotId) d.rivalClubId = null;   // rival não pode ser o substituído
        var spec = { slotClubId: slotId, rivalClubId: d.rivalClubId || null, name: d.name.trim(), short: d.short.trim().toUpperCase(),
          colors: { primary: d.colors.primary, secondary: d.colors.secondary }, crestData: d.crestData || null,
          kitData: d.kitData || null, kitAwayData: d.kitAwayData || null, kitThirdData: d.kitThirdData || null,
          level: d.level, nation: TM.data.league(d.leagueId).nation };
        TM.storage.write("customClub", spec);
        TM.data.resetWorld();
        TM.ui.go("coach-setup", { clubId: slotId, custom: true });
      }, "btn primary big")
    ]));
  });

  /* ---------- opções pré-carreira: técnico + moeda + aporte ---------- */
  function activeCustomSpec(clubId) {
    try { var s = TM.storage.read("customClub", null); return (s && s.slotClubId === clubId) ? s : null; } catch (e) { return null; }
  }
  TM.ui.register("coach-setup", function (screen, params) {
    var clubId = params.clubId;
    var isCustom = params.custom || !!activeCustomSpec(clubId);
    var club = TM.data.club(clubId);
    // reusa o rascunho ao voltar da lista de treinadores; senão começa novo
    if (!pendingSetup || pendingSetup.clubId !== clubId) {
      pendingSetup = freshSetup(clubId);
    }
    var opts = pendingSetup;

    screen.appendChild(TM.ui.topbar("Opções da carreira", function () { pendingSetup = null; TM.ui.go(isCustom ? "coach-create-club" : "coach"); }));
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

    // reiniciar partidas (permitir rejogar ao sair no meio)
    var restartToggle = el("button", { class: "switch" + (opts.allowRestart ? " on" : ""), on: { click: function () {
      opts.allowRestart = !opts.allowRestart; restartToggle.classList.toggle("on", opts.allowRestart);
    } } }, [ el("span", { class: "switch-knob" }) ]);
    body.appendChild(el("div", { class: "setting" }, [
      el("div", { class: "setting row" }, [ el("div", { class: "setting-label", text: "🔁 Reiniciar partidas" }), restartToggle ]),
      el("div", { class: "setting-hint", text: "Ligado: você pode sair no meio da partida e jogá-la de novo. Desligado (recomendado): sair no meio registra o resultado — sem rejogar, como na vida real." })
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

    // popularidade e reputação iniciais (editáveis)
    {
      var defPop = 40; try { var rr0 = TM.data.clubRating(clubId); defPop = Math.max(5, Math.min(72, rr0 - 28)); } catch (e) {}
      if (opts.startPop == null) opts.startPop = defPop;
      if (opts.startRep == null) opts.startRep = 18;
      function sliderRow(label, key, min, max, labelFn) {
        var val = el("span", { class: "rep-val" });
        var inp = el("input", { type: "range", min: min, max: max, value: opts[key], class: "tm-range" });
        function upd() { val.textContent = opts[key] + " · " + labelFn(opts[key]); }
        inp.addEventListener("input", function () { opts[key] = parseInt(inp.value, 10); upd(); });
        upd();
        return el("div", { class: "setting" }, [ el("div", { class: "rep-top" }, [ el("span", { class: "rep-lbl", text: label }), val ]), inp ]);
      }
      body.appendChild(el("div", { class: "setting-label", text: "Início da carreira (opcional)" }));
      body.appendChild(sliderRow("📣 Popularidade do clube", "startPop", 5, 95, function (v) { return popularityLabel(v); }));
      body.appendChild(sliderRow("⭐ Sua reputação", "startRep", 3, 95, function (v) { return C().reputationLabel(v); }));
      body.appendChild(el("div", { class: "setting-hint", text: "Comece com um clube mais/menos famoso e você mais/menos renomado. Deixe no padrão para uma jornada do zero." }));
    }

    var summary = el("div", { class: "market-budget" });
    body.appendChild(summary);
    function updateInfo() {
      var m = CUR[opts.currency];
      injVal.textContent = m.sym + " " + opts.injection + "M";
      // usa a MESMA fórmula da carreira (baseBudgetEur) para não divergir
      var baseEur = C().baseBudgetEur(TM.data.clubRating(clubId));
      var total = Math.round(baseEur * m.mult) + opts.injection;
      summary.textContent = "💰 Orçamento inicial: " + m.sym + " " + total + "M";
    }
    updateInfo();

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Começar carreira", function () {
        if (opts.coachMode === "existing" && !opts.coachName) { TM.ui.toast("Escolha um treinador da lista"); return; }
        var career = C().newClubCareer(clubId, opts);
        career.allowRestart = !!opts.allowRestart;
        if (isCustom) { career.isCustomClub = true; customDraft = null; }
        TM.storage.saveCoachCareer(career);
        pendingSetup = null; exPlayerHandoff = null;
        TM.ui.go("coach-hub");
      }, "btn primary big")
    ]));
  });

  /* ---------- lista de treinadores (escolher existente) ---------- */
  TM.ui.register("coach-pick", function (screen, params) {
    var clubId = params.clubId;
    if (!pendingSetup || pendingSetup.clubId !== clubId) { pendingSetup = freshSetup(clubId, "existing"); }
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
          el("div", { class: "cc-age", text: (coClubId ? TM.data.club(coClubId).name + " · " : (co.free ? "Sem clube no jogo · " : "")) + co.age + " anos" })
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
    if (c.type === "director") TM.club.migrateDirector(c);
    if (c.unemployed) {
      screen.appendChild(TM.ui.topbar("Carreira", function () { TM.ui.go("modes"); }));
      addSectorBar(screen, "coach-offers");
      screen.appendChild(el("div", { class: "panel-narrow" }, [
        el("div", { class: "prof-empty" }, [
          el("div", { class: "pe-ic", text: "🧳" }),
          el("div", { class: "pe-t", text: "Você está sem clube" }),
          el("div", { class: "pe-s", text: "Livre no mercado. Veja as propostas e assuma um novo clube para continuar a carreira." })
        ]),
        TM.ui.button("💼 Ver propostas", function () { TM.ui.go("coach-offers"); }, "btn primary")
      ]));
      return;
    }
    C().migrateCareer(c);
    C().processCalendar(c); // janelas de transferência + mercado da IA + notificações
    try { TM.club.ensure(c); TM.club.maybeSafOffer(c); } catch (e) {} // propostas de SAF nas janelas
    try { if (TM.fin) TM.fin.tick(c); } catch (e) {}                 // parcelas, bônus, transfer ban, endividamento
    try { if (TM.pre) TM.pre.tick(c); } catch (e) {}                 // convites de torneio de pré-temporada
    try { if (TM.offers) TM.offers.tick(c); } catch (e) {}           // prazos das propostas recebidas
    try { if (TM.wl) TM.wl.tick(c); } catch (e) {}
    try { if (TM.msgr) TM.msgr.tick(c); } catch (e) {}                 // Total Messenger: novas conversas                   // observação de ligas do mundo + rodadas das ligas acompanhadas
    ensureContracts(c);     // garante contratos do elenco
    ensureMyContract(c);    // garante o contrato do próprio treinador
    ensureTenure(c);        // tempo de casa / crias da base (ídolos)
    ensurePopularity(c);    // popularidade mundial do clube
    maybeBoardObjectiveShift(c); // diretoria muda meta / cobra no meio da temporada
    applyPosOverrides(c);   // reaplica reposicionamentos concluídos (mundo regenera)
    applyKitOverrides(c);   // reaplica uniformes importados do clube (mundo regenera)
    maybeStaffMessage(c);   // recados do auxiliar técnico e da diretoria
    maybePlayerUnrest(c);   // jogador insatisfeito pedindo transferência
    try { C().generateJobOffers(c); } catch (e) {}   // propostas de outros clubes
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
        { label: (c.allowRestart ? "🔁 Reiniciar partidas: LIGADO" : "🔒 Reiniciar partidas: DESLIGADO"), fn: function () { c.allowRestart = !c.allowRestart; TM.storage.saveCoachCareer(c); TM.ui.toast(c.allowRestart ? "Agora você pode rejogar partidas" : "Sair no meio agora registra o resultado"); } },
        { label: "📤 Salvar e sair", fn: function () { TM.saves.park("coach"); TM.ui.toast("Carreira guardada em Minhas Carreiras"); TM.ui.go("modes"); } },
        { label: "🏠 Voltar ao menu (sem sair)", fn: function () { TM.ui.go("modes"); } },
        { label: "👔 Aposentar / finalizar carreira", danger: true, fn: function () { TM.ui.go("coach-retire"); } }
      ]);
    } } });
    var mUn = 0; try { mUn = TM.msgr ? TM.msgr.unread(c) : 0; } catch (e) {}
    var chat = el("button", { class: "tb-bell tb-chat", title: "Total Messenger", on: { click: function () { TM.ui.go("coach-messenger"); } } }, [
      el("span", { text: "💬" }), mUn ? el("span", { class: "bell-badge", text: mUn > 9 ? "9+" : mUn }) : null
    ]);
    var right = el("div", { class: "tb-actions" }, [ chat, bell, dots ]);
    screen.appendChild(TM.ui.topbar("Carreira", function () { TM.ui.go("modes"); }, right));
    addSectorBar(screen, "coach-hub");

    var myCoach = c.coachId ? TM.data.coaches().filter(function (x) { return x.id === c.coachId; })[0] : null;
    var coachFace = c.coachPhoto ? el("img", { src: c.coachPhoto, class: "coach-mini" })
      : myCoach ? TM.img.coachImg(myCoach, "coach-mini")
      : el("div", { class: "coach-mini placeholder", text: "👔" });
    screen.appendChild(el("div", { class: "club-header ch-clickable", title: "Ver informações do clube", on: { click: function () { TM.ui.go("coach-club-info", { clubId: c.teamId, back: "coach-hub" }); } } }, [
      TM.img.clubImg(club, "ch-crest"),
      el("div", { class: "ch-info" }, [
        el("div", { class: "ch-name", text: club.name }),
        el("div", { class: "ch-sub", text: TM.data.league(c.leagueId).name + " · Temporada " + c.season + "  ℹ️" }),
        el("div", { class: "ch-budget", text: "💰 Orçamento: " + money(c, c.budget) })
      ]),
      TM.img.kitImg(club, "ch-kit"),
      el("div", { class: "coach-tag" }, [ coachFace, el("div", { class: "coach-tag-name", text: c.coachName || "Treinador" }) ])
    ]));

    // seleção: verifica prazo e mostra botão de trocar
    C().checkNationDeadlines(c); TM.storage.saveCoachCareer(c);
    if (c.nation) {
      var np = C().nationPending(c);
      var natNat = TM.data.nation(c.nation.id);
      var nsSub = c.nation.eliminated ? "😞 Fora da Copa (Eliminatórias) →"
        : np.needConvoke ? (np.wc ? "⚠ Convocação da Copa pendente!" : "⚠ Convocação pendente!")
        : np.readyMatch ? (np.wc ? "🏆 Jogo da Copa do Mundo!" : "🌍 Jogo das Eliminatórias!")
        : (c.nation.wc ? "🏆 Copa do Mundo →" : "🌍 Eliminatórias da Copa →");
      screen.appendChild(el("button", { class: "nation-switch" + (np.needConvoke || np.readyMatch ? " alert" : ""), on: { click: function () { TM.ui.go("coach-nation"); } } }, [
        TM.img.nationImg(natNat, "ns-flag"),
        el("div", { class: "ns-info" }, [ el("div", { class: "ns-name", text: "Seleção de " + c.nation.name }),
          el("div", { class: "ns-sub", text: nsSub }) ]),
        el("span", { class: "ns-arrow", text: "🔄" })
      ]));
    }

    // meta da diretoria + PRESSÃO (confiança da diretoria)
    var pos = C().currentPosition(c);
    var conf = boardConfidence(c);
    var within = pos <= c.objective.maxPos;
    // reputação do treinador (badge)
    c.reputation = C().computeReputation(c);
    var repLbl = C().reputationLabel(c.reputation);
    screen.appendChild(el("div", { class: "rep-badge" }, [
      el("span", { class: "rep-star", text: "⭐" }),
      el("div", { class: "rep-info" }, [
        el("div", { class: "rep-top" }, [ el("span", { class: "rep-lbl", text: "Reputação do treinador" }), el("span", { class: "rep-val", text: c.reputation + " · " + repLbl }) ]),
        el("div", { class: "rep-bar" }, [ el("div", { class: "rep-fill", style: "width:" + c.reputation + "%" }) ])
      ])
    ]));
    // popularidade mundial do clube
    (function () {
      var pop = ensurePopularity(c);
      screen.appendChild(el("div", { class: "rep-badge pop-badge" }, [
        el("span", { class: "rep-star", text: "🌐" }),
        el("div", { class: "rep-info" }, [
          el("div", { class: "rep-top" }, [ el("span", { class: "rep-lbl", text: "Popularidade mundial" }), el("span", { class: "rep-val", text: pop + " · " + popularityLabel(pop) }) ]),
          el("div", { class: "rep-bar" }, [ el("div", { class: "rep-fill", style: "width:" + pop + "%" }) ])
        ])
      ]));
    })();
    // liderança do capitão no vestiário
    (function () {
      var lead = captainLeadership(c);
      if (!lead.name) return;
      var cls = lead.edge >= 3 ? "ok" : lead.edge >= 1 ? "mid" : lead.edge <= -1 ? "lo" : "mid";
      var txt = lead.edge >= 3 ? "Vestiário unido — liderança forte" : lead.edge >= 1 ? "Boa influência no elenco" : lead.edge <= -1 ? "Capitão desmotivado contagia o grupo" : "Liderança neutra";
      screen.appendChild(el("div", { class: "cap-badge cap-" + cls, on: { click: function () { try { TM.coachUI.openPlayer(C().resolvePlayer(c, c.captainId), "coach-hub"); } catch (e) {} } } }, [
        el("span", { class: "cap-ic", text: "🅲" }),
        el("div", { class: "cap-info" }, [
          el("div", { class: "cap-top", text: "Capitão: " + shortName(lead.name) + (lead.exp ? " (experiente)" : "") }),
          el("div", { class: "cap-sub", text: txt + " · " + (lead.edge >= 0 ? "+" : "") + lead.edge + " no jogo" })
        ])
      ]));
    })();
    // identidade / estilo de jogo do time (clicável -> escolher filosofia)
    (function () {
      var st = playStyleOf(c.tactic) || PLAY_STYLES[0];
      screen.appendChild(el("div", { class: "style-badge", on: { click: function () { TM.ui.go("coach-style"); } } }, [
        el("span", { class: "style-badge-ic", text: st.ic }),
        el("div", { class: "style-badge-info" }, [
          el("div", { class: "style-badge-top", text: "Estilo: " + st.name }),
          el("div", { class: "style-badge-sub", text: "Conhecido por " + st.id + " · toque para mudar" })
        ]),
        el("span", { class: "style-badge-arrow", text: "›" })
      ]));
    })();
    // aviso de fadiga: titulares no vermelho pedem rodízio
    (function () {
      if (!c.fatigue) return;
      var starters = (c.lineup && c.lineup.starters) || [];
      var tired = starters.map(function (id) { return C().resolvePlayer(c, id); }).filter(function (p) { return p && (c.fatigue[p.id] || 0) >= 78; });
      if (!tired.length) return;
      tired.sort(function (a, b) { return (c.fatigue[b.id] || 0) - (c.fatigue[a.id] || 0); });
      var names = tired.slice(0, 3).map(function (p) { return shortName(p.name); }).join(", ");
      screen.appendChild(el("div", { class: "fatigue-warn", on: { click: function () { TM.ui.go("coach-lineup"); } } }, [
        el("span", { class: "fw-ic", text: "🥵" }),
        el("div", { class: "fw-info" }, [
          el("div", { class: "fw-t", text: tired.length + " titular(es) desgastado(s)" }),
          el("div", { class: "fw-s", text: names + (tired.length > 3 ? " e outros" : "") + " precisam descansar — faça rodízio ou caem de rendimento e arriscam lesão." })
        ]),
        el("span", { class: "fw-arrow", text: "›" })
      ]));
    })();
    var pInfo = conf >= 70 ? { cls: "ok", txt: "Diretoria confiante" } : conf >= 40 ? { cls: "mid", txt: "Diretoria observando" } : conf >= 20 ? { cls: "lo", txt: "Sob pressão" } : { cls: "crit", txt: "🚨 Risco de demissão" };
    screen.appendChild(el("div", { class: "objective obj-card" }, [
      el("div", { class: "obj-top" }, [
        el("span", { class: "obj-ic", text: "🎯" }),
        el("div", { class: "obj-main" }, [
          el("div", { class: "obj-desc", text: "Meta da diretoria: " + c.objective.desc }),
          el("div", { class: "obj-prog", text: "Posição atual: " + pos + "º" + (within ? " ✓ dentro da meta" : " ⚠ abaixo da meta") })
        ])
      ]),
      el("div", { class: "board-meter" }, [
        el("div", { class: "bm-row" }, [ el("span", { class: "bm-lbl", text: "Confiança da diretoria" }), el("span", { class: "bm-val bm-" + pInfo.cls, text: conf + "%" }) ]),
        el("div", { class: "bm-bar" }, [ el("div", { class: "bm-fill bm-" + pInfo.cls, style: "width:" + conf + "%" }) ]),
        el("div", { class: "bm-msg bm-" + pInfo.cls, text: pInfo.txt })
      ])
    ]));
    try { var safEl = TM.club.safCard(c, "coach-hub"); if (safEl) screen.appendChild(safEl); } catch (e) {}
    try { var preEl = TM.pre && TM.pre.card(c); if (preEl) screen.appendChild(preEl); } catch (e) {}
    try { var offEl = TM.offers && TM.offers.card(c); if (offEl) screen.appendChild(offEl); } catch (e) {}
    // Total Messenger: conversas esperando resposta
    try {
      var mq = TM.msgr ? TM.msgr.pending(c) : 0;
      if (mq) screen.appendChild(el("div", { class: "next-match tm-hub clickable", on: { click: function () { TM.ui.go("coach-messenger"); } } }, [
        el("div", { class: "nm-label", text: "💬 Total Messenger" }),
        el("div", { class: "offer-row" }, [ el("div", { class: "offer-mid" }, [
          el("div", { class: "offer-t", text: mq + " mensagem" + (mq > 1 ? "s" : "") + " esperando sua resposta" }),
          el("div", { class: "offer-s", text: "Jogadores, diretoria, empresários e imprensa querem falar com você." })
        ]), el("span", { class: "wl-hub-go", text: "›" }) ])
      ]));
    } catch (e) {}
    // atalho para 🌍 Ligas do mundo (observação de 8 dias) — a aba fica no menu "Mais"
    try {
      var wlS = (c.wl && c.wl.seen) ? Object.keys(c.wl.seen).length : 0, wlO = (c.wl && c.wl.obs) ? Object.keys(c.wl.obs).filter(function (k) { return !(c.wl.seen && c.wl.seen[k]); }).length : 0;
      screen.appendChild(el("div", { class: "next-match wl-hub clickable", on: { click: function () { TM.ui.go("coach-world"); } } }, [
        el("div", { class: "nm-label", text: "🌍 Ligas do mundo" }),
        el("div", { class: "offer-row" }, [ el("div", { class: "offer-mid" }, [
          el("div", { class: "offer-t", text: wlS ? wlS + " liga" + (wlS > 1 ? "s" : "") + " acompanhada" + (wlS > 1 ? "s" : "") + (wlO ? " · " + wlO + " em observação" : "") : (wlO ? wlO + " liga" + (wlO > 1 ? "s" : "") + " em observação" : "Escolha uma liga para observar") }),
          el("div", { class: "offer-s", text: "Observe uma liga por 8 dias e acompanhe tabela, rodadas e artilheiros do mundo inteiro." })
        ]), el("span", { class: "wl-hub-go", text: "›" }) ])
      ]));
    } catch (e) {}

    var pending;
    try { pending = C().advanceToUserMatch(c); }
    catch (errAdv) {                                   // calendario corrompido: remonta a temporada e segue
      try { C().rebuildSeason(c); TM.storage.saveCoachCareer(c); pending = C().advanceToUserMatch(c); }
      catch (e2) { pending = { seasonEnd: true }; }
    }
    if (pending.seasonEnd) {
      renderSeasonEnd(screen, c);
    } else {
      var nextDay = C().matchDay(c.matchNo), daysLeft = nextDay - c.currentDay;
      // barra de data / calendário
      screen.appendChild(el("div", { class: "date-bar" }, [
        el("div", { class: "date-now" }, [ el("span", { class: "date-ic", text: "📅" }), el("span", { text: C().dateOf(c, c.currentDay).full }) ]),
        el("button", { class: "date-cal-btn", text: "Calendário →", on: { click: function () { TM.ui.go("coach-calendar"); } } })
      ]));

      // Deadline Day — último(s) dia(s) da janela aberta
      try {
        var _win = C().currentWindow(c);
        if (_win && (_win.closeDay - c.currentDay) <= 1) {
          var _dd = _win.closeDay - c.currentDay;
          maybeDeadlineRumors(c, _win);
          var ddBanner = el("div", { class: "deadline-banner" }, [
            el("div", { class: "dd-flash", text: "⏰ DEADLINE DAY" }),
            el("div", { class: "dd-sub", text: _dd <= 0 ? "Último dia da " + _win.name + " — o mercado fecha hoje!" : "A " + _win.name + " fecha amanhã (" + C().dateOf(c, _win.closeDay).full + ")." }),
            TM.ui.button("💼 Ir ao mercado", function () { TM.ui.go("coach-market"); }, "btn small")
          ]);
          screen.appendChild(ddBanner);
        }
      } catch (e) {}

      var compId = compIdFor(c, pending.key);
      var homeClub = TM.data.club(pending.homeId), awayClub = TM.data.club(pending.awayId);
      var badgeText = pending.label ? pending.label : (pending.ko ? "Mata-mata" : "Liga");
      var matchDate = C().dateOf(c, nextDay);
      // uniforme escolhido para este jogo (padrão: mandante 1º, visitante 2º)
      var kitPick = (c.kitPick && c.kitPick.mn === c.matchNo) ? c.kitPick : null;
      var homeVar = kitPick ? kitPick.home : 0, awayVar = kitPick ? kitPick.away : 1;
      var homeKitImg = TM.img.kitImg(homeClub, "md-kit", homeVar);
      var awayKitImg = TM.img.kitImg(awayClub, "md-kit", awayVar);
      var kids = [
        el("div", { class: "nm-date", text: "🗓️ " + matchDate.full + (daysLeft > 0 ? " · faltam " + daysLeft + " dia(s)" : " · é hoje!") }),
        // confronto com escudo + uniforme de cada time
        el("div", { class: "md-versus" }, [
          el("div", { class: "md-team" }, [ TM.img.clubImg(homeClub, "md-crest"), homeKitImg, el("div", { class: "md-name", text: homeClub.name }) ]),
          el("div", { class: "md-vs", text: "VS" }),
          el("div", { class: "md-team" }, [ TM.img.clubImg(awayClub, "md-crest"), awayKitImg, el("div", { class: "md-name", text: awayClub.name }) ])
        ])
      ];
      // jogo de VOLTA: resultado da ida e placar agregado
      var _leg = null; try { _leg = C().legInfo(c, pending); } catch (e) {}
      if (_leg) {
        var favor = _leg.meuGol > _leg.delesGol ? "up" : _leg.meuGol < _leg.delesGol ? "down" : "even";
        kids.push(el("div", { class: "agg-box " + favor }, [
          el("div", { class: "agg-t", text: "🔁 Jogo de volta" }),
          el("div", { class: "agg-line" }, [
            TM.img.clubImg(TM.data.club(_leg.aId), "agg-crest"),
            el("span", { class: "agg-sc", text: _leg.firstHs + " x " + _leg.firstAs }),
            TM.img.clubImg(TM.data.club(_leg.bId), "agg-crest"),
            el("span", { class: "agg-lbl", text: "resultado da ida" })
          ]),
          el("div", { class: "agg-agg", text: "Agregado: " + _leg.meuGol + " x " + _leg.delesGol + " · " + (_leg.meuGol > _leg.delesGol ? "você joga por um empate" : _leg.meuGol < _leg.delesGol ? "você precisa reverter " + (_leg.delesGol - _leg.meuGol) + (_leg.delesGol - _leg.meuGol > 1 ? " gols" : " gol") : "tudo igual: quem vencer avança") })
        ]));
      }
      if (rivalryEnabled() && TM.data.areRivals(homeClub.id, awayClub.id)) {
        var derby = null; try { derby = TM.data.derbyName(homeClub.id, awayClub.id); } catch (e) {}
        kids.push(el("div", { class: "classico-ribbon" }, [
          el("span", { class: "cr-flame", text: "🔥" }),
          el("span", { class: "cr-txt", text: derby ? derby.toUpperCase() : "CLÁSSICO" }),
          el("span", { class: "cr-sub", text: "Jogo de rivalidade — clima quente nas arquibancadas" })
        ]));
      }
      // informações do dia do jogo: horário, clima e lotação do estádio
      var md = matchDayInfo(c, homeClub, c.matchNo, pending);
      kids.push(el("div", { class: "matchday-info" }, [
        el("div", { class: "mdi-item" }, [ el("span", { class: "mdi-ic", text: "🕐" }), el("span", { class: "mdi-v", text: md.time }), el("span", { class: "mdi-l", text: "horário" }) ]),
        el("div", { class: "mdi-item" }, [ el("span", { class: "mdi-ic", text: md.wIcon }), el("span", { class: "mdi-v", text: md.wTemp + "°" }), el("span", { class: "mdi-l", text: md.wLabel }) ]),
        el("div", { class: "mdi-item" }, [ el("span", { class: "mdi-ic", text: "👥" }), el("span", { class: "mdi-v", text: md.attend }), el("span", { class: "mdi-l", text: "público" }) ])
      ]));
      // editar horário e clima antes do jogo
      var mdEdit = el("div", { class: "md-edit" }); kids.push(mdEdit);
      (function () {
        var editing = false;
        function renderMdEdit() {
          mdEdit.innerHTML = "";
          if (!editing) { mdEdit.appendChild(el("button", { class: "md-edit-btn", text: "✏️ Editar horário e clima", on: { click: function () { editing = true; renderMdEdit(); } } })); return; }
          var times = ["11:00", "15:00", "16:00", "16:30", "18:30", "19:00", "20:00", "21:00", "21:30"];
          var Wl = [["☀️", "Ensolarado"], ["🌤️", "Sol entre nuvens"], ["⛅", "Parc. nublado"], ["☁️", "Nublado"], ["🌧️", "Chuva"], ["⛈️", "Tempestade"]];
          var tSel = el("select", { class: "select mini" }); times.forEach(function (t) { var o = el("option", { value: t, text: t }); if (t === md.time) o.selected = true; tSel.appendChild(o); });
          var wSel = el("select", { class: "select mini" }); Wl.forEach(function (w, i) { var o = el("option", { value: i, text: w[0] + " " + w[1] }); wSel.appendChild(o); });
          var curW = Wl.map(function (w) { return w[0]; }).indexOf(md.wIcon); if (curW >= 0) wSel.value = String(curW);
          mdEdit.appendChild(el("div", { class: "md-edit-row" }, [
            el("label", { class: "md-edit-lab" }, [ el("span", { text: "🕐 Horário" }), tSel ]),
            el("label", { class: "md-edit-lab" }, [ el("span", { text: "🌦️ Clima" }), wSel ])
          ]));
          mdEdit.appendChild(TM.ui.button("Salvar", function () {
            c.mdOverride = { mn: c.matchNo, time: tSel.value, w: parseInt(wSel.value, 10) };
            TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub");
          }, "btn small"));
        }
        renderMdEdit();
      })();

      // editar uniformes (1/2/3) dos dois times antes do jogo
      var kitEdit = el("div", { class: "md-edit" }); kids.push(kitEdit);
      (function () {
        var editing = false;
        var VLBL = ["1º (principal)", "2º (reserva)", "3º (terceiro)"];
        function persist() {
          c.kitPick = { mn: c.matchNo, home: homeVar, away: awayVar };
          TM.storage.saveCoachCareer(c);
        }
        function kitChooser(club, cur, onPick) {
          var wrap = el("div", { class: "kit-choose" });
          [0, 1, 2].forEach(function (v) {
            var opt = el("button", { class: "kit-opt" + (v === cur ? " on" : ""), on: { click: function () { onPick(v); } } }, [
              TM.img.kitImg(club, "kit-opt-img", v),
              el("span", { class: "kit-opt-lbl", text: (v + 1) + "º" })
            ]);
            wrap.appendChild(opt);
          });
          return wrap;
        }
        function render() {
          kitEdit.innerHTML = "";
          if (!editing) { kitEdit.appendChild(el("button", { class: "md-edit-btn", text: "👕 Escolher uniformes", on: { click: function () { editing = true; render(); } } })); return; }
          kitEdit.appendChild(el("div", { class: "kit-edit-title", text: "👕 Uniformes deste jogo" }));
          kitEdit.appendChild(el("div", { class: "kit-edit-team" }, [ el("div", { class: "kit-edit-nm", text: homeClub.name + " (mandante) — " + VLBL[homeVar] }), kitChooser(homeClub, homeVar, function (v) { homeVar = v; persist(); homeKitImg.src = TM.img.kitImg(homeClub, "md-kit", v).src; render(); }) ]));
          kitEdit.appendChild(el("div", { class: "kit-edit-team" }, [ el("div", { class: "kit-edit-nm", text: awayClub.name + " (visitante) — " + VLBL[awayVar] }), kitChooser(awayClub, awayVar, function (v) { awayVar = v; persist(); awayKitImg.src = TM.img.kitImg(awayClub, "md-kit", v).src; render(); }) ]));
          kitEdit.appendChild(el("button", { class: "md-edit-btn", text: "✓ Pronto", on: { click: function () { editing = false; render(); } } }));
        }
        render();
      })();

      if (!pending.ko || pending.homeId) { var sbn = TM.ui.stadiumBanner(homeClub, { compact: true, label: "Mandante: " + homeClub.name }); if (sbn) kids.push(sbn); }
      var oppId = pending.homeId === c.teamId ? pending.awayId : pending.homeId;
      // contexto do jogo (o que pesa além dos elencos)
      try { var ctxL = C().contextLabels(c, pending.homeId, pending.awayId, pending.ko); if (ctxL.length) kids.push(el("div", { class: "ctx-line" }, ctxL.map(function (t) { return el("span", { class: "ctx-chip", text: t }); }))); } catch (e) {}
      kids.push(TM.ui.button("🔍 Analisar adversário", function () {
        TM.ui.go("scout", { teamId: oppId, isNation: false, compId: compId, back: function () { TM.ui.go("coach-hub"); } });
      }, "btn ghost"));
      if (daysLeft > 0) {
        kids.push(el("div", { class: "skip-row" }, [
          TM.ui.button("⏭ Pular 1 dia", function () { c.currentDay++; TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }, "btn ghost small"),
          TM.ui.button("⏩ Avançar até o jogo", function () { var pd = TM.pre && TM.pre.nextDay ? TM.pre.nextDay(c) : null; c.currentDay = (pd != null && pd > c.currentDay && pd < nextDay) ? pd : nextDay; TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }, "btn small")
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
      hubBtn("🌍", "Mundo", function () { TM.ui.go("coach-world"); }),
      hubBtn("💬", "Mensagens" + (function () { try { var u = TM.msgr ? TM.msgr.unread(c) : 0; return u ? " (" + u + ")" : ""; } catch (e) { return ""; } })(), function () { TM.ui.go("coach-messenger"); }),
      hubBtn("🔁", "Mercado", function () { TM.ui.go("coach-market"); }),
      hubBtn("🔭", "Olheiros", function () { TM.ui.go("coach-scouting", { from: "coach-hub" }); }),
      hubBtn("⭐", "Central", function () { TM.ui.go("coach-shortlist"); }),
      hubBtn("💰", "Finanças", function () { TM.ui.go("coach-finance"); }),
      hubBtn("🤝", "Patrocínios", function () { TM.ui.go("club-sponsors", { from: "coach-hub" }); }),
      hubBtn("🔥", "Motivar (" + (TM.coins ? TM.coins.COST.morale : 0) + "🪙)", function () {
        if (!TM.coins) return;
        TM.ui.confirm("Motivação extra", "Uma preleção especial: todo o elenco ganha +12 de moral por algumas partidas. Custa " + TM.coins.COST.morale + " 🪙.", "Motivar", function () {
          TM.coins.pay(TM.coins.COST.morale, "Motivação extra · Master League", function () {
            c.moraleAdj = c.moraleAdj || {};
            (c.roster || []).forEach(function (id) { var cur = (c.moraleAdj[id] && c.moraleAdj[id].v) || 0; c.moraleAdj[id] = { v: Math.min(20, Math.max(cur, 0) + 12), at: c.matchNo || 0 }; });
            TM.storage.saveCoachCareer(c); TM.ui.toast("Elenco motivado! 🔥"); TM.ui.go("coach-hub");
          });
        });
      }),
      hubBtn("🏟️", "Estádio", function () { TM.ui.go("club-stadium", { from: "coach-hub" }); }),
      hubBtn("🏋️", "CT", function () { TM.ui.go("club-ct", { from: "coach-hub" }); }),
      hubBtn("📜", "Meu contrato", function () { TM.ui.go("coach-contract"); }),
      hubBtn("🔄", "Movimentações", function () { TM.ui.go("coach-transfers"); }),
      hubBtn("📅", "Calendário", function () { TM.ui.go("coach-calendar"); }),
      hubBtn("🌍", "Mundo", function () { TM.ui.go("coach-world"); }),
      hubBtn("🗂️", "Títulos", function () { TM.ui.go("coach-honours"); }),
      hubBtn("🌟", "Seleção da Semana", function () { TM.ui.go("coach-totw"); }),
      hubBtn("📰", "Notícias", function () { TM.ui.go("coach-news"); }),
      hubBtn("📱", "Redes Sociais", function () { TM.ui.go("coach-social"); })
    ]));
    function hubBtn(icon, label, fn) { return el("button", { class: "hub-btn", on: { click: fn } }, [ el("span", { class: "hub-ic", text: icon }), el("span", { text: label }) ]); }

    // ---- rail lateral direito (SÓ desktop): elenco, moral e torcida preenchendo a tela ----
    try { buildHubRail(screen, c); screen.classList.add("has-rightrail"); } catch (e) {}
  });

  // painel direito do hub no PC — jogadores em destaque, moral do clube e posts da torcida
  function buildHubRail(screen, c) {
    var rail = el("aside", { class: "coach-rail", "aria-hidden": "true" });

    // -- forma recente --
    var form = (c.recentForm || []).slice(-6);
    if (form.length) {
      rail.appendChild(el("div", { class: "cr-title", text: "📊 Forma recente" }));
      var fr = el("div", { class: "cr-form" });
      form.forEach(function (r) { fr.appendChild(el("span", { class: "cr-fp cr-fp-" + r, text: r })); });
      rail.appendChild(fr);
    }

    // -- mini classificação da liga --
    try {
      if (c.comps && c.comps.league && c.comps.league.table) {
        var st = C().standings(c.comps.league.table);
        var myIdx = st.findIndex(function (r) { return r.id === c.teamId; });
        rail.appendChild(el("div", { class: "cr-title", text: "🏆 Classificação" }));
        var tbl = el("div", { class: "cr-table" });
        // mostra top 5 + a linha do usuário se estiver fora do top 5
        var rows = st.slice(0, 5);
        if (myIdx >= 5) rows.push(st[myIdx]);
        rows.forEach(function (row) {
          var idx = st.indexOf(row), mine = row.id === c.teamId, cl = TM.data.club(row.id);
          tbl.appendChild(el("div", { class: "cr-trow" + (mine ? " me" : "") }, [
            el("span", { class: "cr-tpos", text: (idx + 1) }),
            (TM.img && TM.img.clubImg && cl) ? TM.img.clubImg(cl, "cr-tcrest") : el("span", { class: "cr-tcrest" }),
            el("span", { class: "cr-tname", text: cl ? cl.name : "—" }),
            el("span", { class: "cr-tpts", text: (row.pts || 0) })
          ]));
        });
        rail.appendChild(tbl);
        rail.appendChild(el("button", { class: "cr-more", text: "Ver tabela completa →", on: { click: function () { TM.ui.go("coach-comps"); } } }));
      }
    } catch (e) {}

    // -- últimas transferências do mercado --
    rail.appendChild(el("div", { class: "cr-title", text: "🔁 Mercado da bola" }));
    var feed = (c.marketFeed || []).slice(0, 6);
    var tw = el("div", { class: "cr-market" });
    if (feed.length) {
      feed.forEach(function (mv) {
        var ic = mv.kind === "fire" ? "🚨" : mv.kind === "free" ? "✍️" : "→";
        var toCl = TM.data.club(mv.toId);
        var feeTxt = mv.kind === "free" ? "Livre" : money(c, curVal(c, mv.val || 0));
        tw.appendChild(el("div", { class: "cr-mv" }, [
          (TM.img && TM.img.clubImg && toCl) ? TM.img.clubImg(toCl, "cr-mvcrest") : el("span", { class: "cr-mvcrest" }),
          el("div", { class: "cr-mvmid" }, [
            el("div", { class: "cr-mvname" }, [
              el("span", { class: "cr-mvic", text: ic }),
              el("span", { text: mv.name }),
              el("span", { class: "cr-mvov", text: mv.ov })
            ]),
            el("div", { class: "cr-mvroute", text: (mv.fromName || "—") + " → " + (mv.toName || "—") })
          ]),
          el("span", { class: "cr-mvfee" + (mv.kind === "free" ? " free" : ""), text: feeTxt })
        ]));
      });
    } else {
      tw.appendChild(el("div", { class: "cr-mv cr-mv-empty" }, [ el("div", { class: "cr-mvroute", text: "Mercado calmo — avance no calendário para ver os clubes se mexerem." }) ]));
    }
    rail.appendChild(tw);
    rail.appendChild(el("button", { class: "cr-more", text: "Abrir o mercado →", on: { click: function () { TM.ui.go("coach-market"); } } }));

    // -- moral do clube --
    var mor = 60; try { mor = TM.social.morale(c); } catch (e) {}
    var mcls = mor >= 70 ? "ok" : mor >= 45 ? "mid" : "lo";
    var mtxt = mor >= 78 ? "Vestiário eufórico" : mor >= 60 ? "Clima positivo" : mor >= 45 ? "Clima neutro" : mor >= 30 ? "Torcida cobrando" : "Clima pegando fogo";
    rail.appendChild(el("div", { class: "cr-title", text: "📣 Moral do clube" }));
    rail.appendChild(el("div", { class: "cr-morale" }, [
      el("div", { class: "cr-mtop" }, [ el("span", { text: mtxt }), el("span", { class: "cr-mval mm-" + mcls, text: Math.round(mor) + "%" }) ]),
      el("div", { class: "cr-mbar" }, [ el("div", { class: "cr-mfill mm-" + mcls, style: "width:" + mor + "%" }) ])
    ]));

    // -- torcida agora (posts) --
    rail.appendChild(el("div", { class: "cr-title", text: "💬 Torcida agora" }));
    var posts = (c.social && c.social.posts && c.social.posts.slice(0, 6)) || [];
    var pw = el("div", { class: "cr-posts" });
    if (posts.length) {
      posts.forEach(function (p) {
        pw.appendChild(el("div", { class: "cr-post" }, [
          el("div", { class: "cr-phandle", text: p.handle || "@torcedor" }),
          el("div", { class: "cr-ptext", text: p.text || "" }),
          el("div", { class: "cr-plikes", text: "♥ " + (p.likes != null ? p.likes : 0) })
        ]));
      });
    } else {
      pw.appendChild(el("div", { class: "cr-post" }, [ el("div", { class: "cr-ptext", text: "A torcida ainda está quieta — jogue uma partida para movimentar as redes." }) ]));
    }
    rail.appendChild(pw);
    rail.appendChild(el("button", { class: "cr-more", text: "Abrir redes sociais →", on: { click: function () { TM.ui.go("coach-social"); } } }));

    screen.appendChild(rail);
  }

  /* ---------- finanças do clube (receitas / despesas / lucro) ---------- */
  // folha salarial estimada do elenco (na moeda da carreira)
  function seasonWageBillCur(c) {
    var sum = 0;
    C().rosterPlayers(c).forEach(function (p) { var li = c.loanedIn && c.loanedIn[p.id]; var sh = li && li.share != null ? li.share / 100 : 1; sum += TM.data.marketValue(p) * 0.075 * sh; });
    return r2(sum * mult(c));
  }
  // balanço financeiro estimado da temporada — receitas fixas (TV, bilheteria, patrocínio)
  // estimadas pelo porte do clube + movimentações reais (prêmios, compras e vendas) já registradas
  function coachFinances(c) {
    var m = mult(c), r = TM.data.clubRating(c.teamId);
    var fc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 };
    var over = Math.max(0, r - 55);
    var tv = r2((10 + over * 2.0) * m);          // cotas de TV
    var stadM = 1; try { stadM = TM.club.stadIncomeMult(c); } catch (e) {}
    var gate = r2((5 + over * 1.3) * m * stadM);  // bilheteria + sócios (+ ampliação do estádio)
    var deals = 0; try { deals = TM.club.sponsorIncome(c); } catch (e) {}
    var sponsor = deals ? r2(deals + (2 + over * 0.3) * m) : r2((4 + over * 1.0) * m);      // patrocínios (contratos) + publicidade
    var sold = fc.soldM || 0, prize = fc.prizeM || 0, bonus = fc.bonusM || 0, saf = fc.safM || 0, loan = fc.loanM || 0;
    var income = r2(tv + gate + sponsor + sold + prize + bonus + saf + loan);
    var wages = seasonWageBillCur(c);
    var upkeep = 0; try { upkeep = TM.club.ctUpkeep(c, c.ctLevel || 2); } catch (e) {}
    var ops = r2((3 + over * 0.6) * m + upkeep);  // estrutura, CT, comissão técnica
    var spent = fc.spentM || 0;
    var loanDue = 0; try { loanDue = TM.club.loansDue(c); } catch (e) {}
    var expense = r2(wages + ops + spent + loanDue);
    var profit = r2(income - expense);
    return { r: r, tv: tv, gate: gate, sponsor: sponsor, sold: sold, prize: prize, bonus: bonus, saf: saf, loan: loan, income: income, wages: wages, ops: ops, spent: spent, loanDue: loanDue, expense: expense, profit: profit };
  }

  TM.ui.register("coach-contract", function (screen) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    var mc = ensureMyContract(c); TM.storage.saveCoachCareer(c);
    var club = TM.data.club(c.teamId);
    screen.appendChild(TM.ui.topbar("📜 Meu contrato", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-hub");
    var conf = boardConfidence(c);
    var wrap = el("div", { class: "panel-narrow" });
    screen.appendChild(wrap);

    wrap.appendChild(el("div", { class: "mc-club" }, [
      club ? TM.img.clubImg(club, "mc-crest") : null,
      el("div", {}, [
        el("div", { class: "mc-club-name", text: club ? club.name : "Clube" }),
        el("div", { class: "mc-club-sub", text: "Técnico: " + (c.coachName || "você") + " · Temporada " + (c.season || 1) })
      ])
    ]));
    var yrsTxt = mc.years <= 0 ? "⚠ EXPIRADO" : mc.years === 1 ? "1 temporada (último ano)" : mc.years + " temporadas";
    wrap.appendChild(el("div", { class: "contract-card" }, [
      el("div", { class: "cc-h", text: "📜 Seu vínculo" }),
      el("div", { class: "cc-grid" }, [
        el("div", { class: "cc-cell" }, [ el("div", { class: "cc-v" + (mc.years <= 1 ? " warn" : ""), text: mc.years <= 0 ? "0" : mc.years }), el("div", { class: "cc-l", text: "temporadas" }) ]),
        el("div", { class: "cc-cell" }, [ el("div", { class: "cc-v", text: money(c, mc.wage) }), el("div", { class: "cc-l", text: "salário/ano" }) ]),
        el("div", { class: "cc-cell" }, [ el("div", { class: "cc-v", text: money(c, mc.fine) }), el("div", { class: "cc-l", text: "multa p/ sair" }) ])
      ]),
      el("div", { class: "cc-note", text: yrsTxt + " · Objetivo: " + mc.objective })
    ]));

    // renovação (a diretoria oferece termos conforme confiança/reputação)
    var rt = renewalTerms(c);
    var canRenew = conf >= 35;
    wrap.appendChild(el("div", { class: "mc-offer" + (canRenew ? "" : " locked") }, [
      el("div", { class: "mc-offer-h", text: canRenew ? "✍️ Proposta de renovação" : "🔒 Renovação indisponível" }),
      el("div", { class: "mc-offer-s", text: canRenew
        ? "A diretoria oferece renovar por +" + rt.years + " temporada(s) com salário de " + money(c, rt.wage) + "/ano (" + (rt.raisePct >= 0 ? "+" : "") + rt.raisePct + "%)."
        : "A diretoria está insatisfeita (confiança " + conf + "%). Melhore os resultados para destravar uma renovação." }),
      canRenew ? TM.ui.button("✍️ Aceitar renovação", function () {
        mc.years = rt.years; mc.wage = rt.wage; mc.fine = rt.fine; mc.signedSeason = c.season;
        TM.storage.saveCoachCareer(c);
        TM.notify.push(c, { icon: "✍️", title: "Renovação assinada", news: true, text: "Você renovou com o " + (club ? club.name : "clube") + " por mais " + rt.years + " temporada(s)." });
        TM.ui.toast("Contrato renovado!"); TM.ui.go("coach-contract");
      }, "btn primary") : null
    ]));

    // negociar orçamento com a diretoria
    wrap.appendChild(el("div", { class: "mc-budget" }, [
      el("div", { class: "mc-offer-h", text: "💰 Negociar orçamento" }),
      el("div", { class: "mc-offer-s", text: "Peça mais verba para reforços. A chance de aprovação depende da confiança da diretoria (" + conf + "%)." }),
      TM.ui.button("💬 Pedir mais verba", function () { askBudget(c); }, "btn ghost")
    ]));

    // sair do clube (fim de temporada de graça, ou agora pagando a multa)
    wrap.appendChild(el("div", { class: "mc-leave" }, [
      el("div", { class: "mc-offer-h", text: "🚪 Deixar o clube" }),
      el("div", { class: "mc-offer-s", text: "Peça demissão e fique livre no mercado. Ao fim da temporada é de graça; agora, custa a multa (" + money(c, mc.fine) + ")." }),
      el("div", { class: "mc-leave-acts" }, [
        TM.ui.button("Sair no fim da temporada", function () {
          c.leaveAtSeasonEnd = true; try { if (TM.saf) TM.saf.onLeave(c); } catch (e) {} TM.storage.saveCoachCareer(c);
          TM.notify.push(c, { icon: "🚪", title: "Saída anunciada", news: true, text: "Você anunciou que deixará o " + (club ? club.name : "clube") + " ao fim da temporada." });
          TM.ui.toast("Saída marcada para o fim da temporada."); TM.ui.go("coach-contract");
        }, "btn ghost small"),
        TM.ui.button("Rescindir agora (multa)", function () {
          TM.ui.confirm("Rescindir agora?", "Você paga " + money(c, mc.fine) + " de multa e fica livre imediatamente.", "Rescindir", function () {
            c.budget = r2((c.budget || 0) - mc.fine);
            c.unemployed = true; if (!c.clubHistory) c.clubHistory = [];
            c.clubHistory.push({ clubId: c.teamId, clubName: c.teamName, season: c.season, left: "rescindiu contrato" });
            c._lastOfferGen = 0; try { C().generateJobOffers(c); } catch (e) {}
            TM.storage.saveCoachCareer(c); TM.ui.go("coach-offers");
          }, true);
        }, "btn danger small")
      ])
    ]));
  });
  // pedido de mais verba à diretoria (chance depende da confiança)
  function askBudget(c) {
    var conf = boardConfidence(c);
    var stamp = "budget:" + (c.season || 1);
    c._budgetAsk = c._budgetAsk || {};
    if (c._budgetAsk[stamp]) { TM.ui.toast("A diretoria já respondeu nesta temporada."); return; }
    c._budgetAsk[stamp] = true;
    var m = mult(c), rating = 70; try { rating = TM.data.clubRating(c.teamId); } catch (e) {}
    var ask = Math.round(Math.max(5, (rating - 55) * 1.2) * m);
    var chance = Math.max(0.1, Math.min(0.9, (conf - 30) / 70));
    if (Math.random() < chance) {
      var grant = Math.round(ask * (0.5 + Math.random() * 0.6));
      c.budget = r2((c.budget || 0) + grant);
      TM.notify.push(c, { icon: "💰", title: "Verba aprovada", news: true, text: "A diretoria liberou +" + money(c, grant) + " para reforços. Use com sabedoria." });
      TM.ui.toast("✔ Verba aprovada: +" + money(c, grant));
    } else {
      TM.notify.push(c, { icon: "🚫", title: "Pedido negado", text: "A diretoria negou mais verba no momento. Mostre resultados para convencê-los." });
      TM.ui.toast("Pedido negado.");
    }
    TM.storage.saveCoachCareer(c);
    TM.ui.go("coach-contract");
  }

  TM.ui.register("coach-finance", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    screen.appendChild(TM.ui.topbar("💰 Finanças", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-finance");
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var club = TM.data.club(c.teamId);
    var f = coachFinances(c);

    var pos = f.profit >= 0;

    // ---- heros: caixa + resultado da temporada (com degradê) ----
    body.appendChild(el("div", { class: "fin-heros" }, [
      el("div", { class: "fin-hero " + (c.budget < 0 ? "red" : "green") }, [
        el("div", { class: "fin-hero-ic", text: c.budget < 0 ? "🔴" : "💰" }),
        el("div", { class: "fin-hero-lbl", text: c.budget < 0 ? "Caixa em dívida" : "Caixa disponível" }),
        el("div", { class: "fin-hero-val", text: money(c, c.budget) })
      ]),
      el("div", { class: "fin-hero " + (pos ? "green" : "red") }, [
        el("div", { class: "fin-hero-ic", text: pos ? "📈" : "📉" }),
        el("div", { class: "fin-hero-lbl", text: (pos ? "Lucro" : "Prejuízo") + " da temporada" }),
        el("div", { class: "fin-hero-val", text: (pos ? "+" : "") + money(c, f.profit) })
      ])
    ]));
    body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: club.name + " · Temporada " + c.season + " · Porte do clube: OVR " + f.r }));

    // linha com barra proporcional
    function catLine(icon, label, val, total, cls) {
      var pct = Math.max(2, Math.round((Math.abs(val) / Math.max(1, total)) * 100));
      return el("div", { class: "fin-cline" }, [
        el("div", { class: "fin-ctop" }, [
          el("span", { class: "fin-clbl", html: icon + " " + label }),
          el("span", { class: "fin-cval " + cls, text: (cls === "bad" ? "-" : "") + money(c, Math.abs(val)) })
        ]),
        el("div", { class: "fin-cbar" }, [ el("div", { class: "fin-cfill " + cls, style: "width:" + pct + "%" }) ])
      ]);
    }

    // receitas
    body.appendChild(el("div", { class: "fin-cat" }, [
      el("div", { class: "fin-cat-h good", html: "📈 Receitas <b>" + money(c, f.income) + "</b>" }),
      catLine("📺", "Cotas de TV", f.tv, f.income, "good"),
      catLine("🎟️", "Bilheteria e sócios", f.gate, f.income, "good"),
      catLine("🤝", "Patrocínios e publicidade" + (function () { var n = []; try { n = TM.club.sponsorNames(c); } catch (e) {} return n.length ? " (" + n.join(" · ") + ")" : ""; })(), f.sponsor, f.income, "good"),
      f.bonus ? catLine("🎁", "Bônus de assinatura (patrocínios)", f.bonus, f.income, "good") : null,
      f.saf ? catLine("💼", "Aporte de investidor (SAF)", f.saf, f.income, "good") : null,
      f.loan ? catLine("🏦", "Empréstimo bancário", f.loan, f.income, "good") : null,
      catLine("💸", "Vendas de jogadores", f.sold, f.income, "good"),
      catLine("🏆", "Prêmios de competições", f.prize, f.income, "good")
    ]));

    // despesas
    body.appendChild(el("div", { class: "fin-cat" }, [
      el("div", { class: "fin-cat-h bad", html: "📉 Despesas <b>" + money(c, f.expense) + "</b>" }),
      catLine("👥", "Folha salarial do elenco", f.wages, f.expense, "bad"),
      catLine("🏗️", "Estrutura, CT e comissão", f.ops, f.expense, "bad"),
      catLine("✍️", "Contratações e obras", f.spent, f.expense, "bad"),
      f.loanDue ? catLine("🏦", "Parcelas de empréstimo (temp.)", f.loanDue, f.expense, "bad") : null
    ]));

    // balanço receitas x despesas
    var total = Math.max(1, f.income + f.expense);
    var incPct = Math.round((f.income / total) * 100);
    body.appendChild(el("div", { class: "fin-cat" }, [
      el("div", { class: "fin-cat-h", text: "⚖️ Balanço da temporada" }),
      el("div", { class: "fin-bar" }, [
        el("div", { class: "fin-bar-in", style: "width:" + incPct + "%" }),
        el("div", { class: "fin-bar-out", style: "width:" + (100 - incPct) + "%" })
      ]),
      el("div", { class: "fin-bar-legend" }, [
        el("span", { class: "good", text: "▮ Receitas " + money(c, f.income) }),
        el("span", { class: "bad", text: "▮ Despesas " + money(c, f.expense) })
      ]),
      el("div", { class: "setting-hint", text: pos
        ? "As contas estão no azul. Reinvista o lucro em reforços pelo Mercado."
        : "As contas estão no vermelho. Venda jogadores, ganhe títulos ou reduza a folha para equilibrar." })
    ]));

    try { if (TM.fin) TM.fin.panels(c, body); } catch (e) {}
    try { TM.club.financePanels(c, body, "coach-finance"); } catch (e) {}
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("🔄 Ver movimentações", function () { TM.ui.go("coach-transfers"); }, "btn"),
      TM.ui.button("🔁 Ir ao Mercado", function () { TM.ui.go("coach-market"); }, "btn ghost")
    ]));
  });

  /* ---------- movimentações: contratações e vendas por data ---------- */
  function dealKindLabel(k) {
    return { buy: "Compra", free: "Contratação livre", loan: "Empréstimo", loanBuy: "Empréstimo c/ opção", sale: "Venda", pre: "Pré-contrato (luvas)", clause: "Cláusula paga", swap: "Troca", installment: "Parcela", bonus: "Bônus por metas", sellon: "% de venda" }[k] || (k || "");
  }
  TM.ui.register("coach-transfers", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    screen.appendChild(TM.ui.topbar("🔄 Movimentações", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-transfers");
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var deals = c.deals || [];

    // balanço geral
    var gasto = 0, arrec = 0;
    deals.forEach(function (d) { if (d.type === "out") arrec += d.fee || 0; else gasto += d.fee || 0; });
    gasto = r2(gasto); arrec = r2(arrec); var saldo = r2(arrec - gasto);
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "📊 Balanço de transferências (carreira)" }),
      el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "Contratações" }), el("span", { class: "deal-val bad", text: "-" + money(c, gasto) }) ]),
      el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "Vendas" }), el("span", { class: "deal-val good", text: money(c, arrec) }) ]),
      el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "Saldo" }), el("span", { class: "deal-val " + (saldo >= 0 ? "good" : "bad"), text: (saldo >= 0 ? "+" : "") + money(c, saldo) }) ])
    ]));

    // filtro entradas/saídas
    var filter = "all";
    var seg = el("div", { class: "segmented full" });
    [["all", "Todas"], ["in", "Contratações"], ["out", "Vendas"]].forEach(function (o) {
      var b = el("button", { class: "seg-btn" + (o[0] === filter ? " active" : ""), text: o[1], on: { click: function () {
        filter = o[0]; seg.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active"); render();
      } } });
      seg.appendChild(b);
    });
    body.appendChild(seg);

    var listWrap = el("div", { class: "deal-log" });
    body.appendChild(listWrap);

    function dealRow(d) {
      var isIn = d.type === "in";
      var side = isIn ? "de " + (d.other || "") : "para " + (d.other || "");
      var feeTxt = (d.fee ? (isIn ? "-" : "+") + money(c, d.fee) : "grátis");
      return el("div", { class: "mv-row" }, [
        el("div", { class: "mv-ic " + (isIn ? "in" : "out"), text: isIn ? "⬇" : "⬆" }),
        el("div", { class: "mv-main" }, [
          el("div", { class: "mv-name", text: d.name + "  ·  " + (TM.data.posLabel({ pos: d.pos, pos2: null }) || d.pos) + " · " + (d.ov || "?") + " OVR" }),
          el("div", { class: "mv-sub", text: dealKindLabel(d.kind) + " · " + side + " · 📅 " + (d.date || d.dateShort || "") })
        ]),
        el("div", { class: "mv-fee " + (isIn ? "out" : "in"), text: feeTxt })
      ]);
    }

    function render() {
      listWrap.innerHTML = "";
      var rows = deals.filter(function (d) { return filter === "all" || d.type === filter; });
      if (!rows.length) {
        listWrap.appendChild(el("p", { class: "intro-text", text: deals.length ? "Nenhuma movimentação neste filtro." : "Nenhuma contratação ou venda ainda. Vá ao Mercado para reforçar o elenco — cada negócio aparece aqui com a data." }));
        return;
      }
      var curSeason = null;
      rows.forEach(function (d) {
        if (d.season !== curSeason) { curSeason = d.season; listWrap.appendChild(el("div", { class: "list-head", text: "Temporada " + curSeason })); }
        listWrap.appendChild(dealRow(d));
      });
    }
    render();
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
    if (c.comps.mundial && c.comps.mundial.championId === c.teamId) add("mundial", ((TM.data.competition("cwc-world") || {}).name || "Mundial de Clubes"), TITLE_PRIZE_EUR.mundial, "cwc-world");
    if (c.interChampion && c.interChampion === c.teamId) add("inter", ((TM.data.competition("cwc-inter") || {}).name || "Copa Intercontinental"), TITLE_PRIZE_EUR.inter, "cwc-inter");
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
    c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.prizeM += prizeCur;
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
      box.appendChild(el("div", { class: "fired-msg", text: "🚪 A diretoria decidiu te demitir por não atingir os objetivos da temporada. Mas sua carreira continua — outros clubes podem te contratar." }));
      box.appendChild(el("div", { class: "actions" }, [
        TM.ui.button("🔍 Procurar novo clube", function () {
          c.unemployed = true; c.sackCount = (c.sackCount || 0) + 1;
          if (!c.clubHistory) c.clubHistory = [];
          c.clubHistory.push({ clubId: c.teamId, clubName: c.teamName, season: c.season, left: "demitido pela diretoria" });
          c._lastOfferGen = 0; try { C().generateJobOffers(c); } catch (e) {}
          TM.storage.saveCoachCareer(c); TM.ui.go("coach-offers");
        }, "btn primary"),
        TM.ui.button("🗑️ Encerrar carreira", function () { TM.storage.clearCoachCareer(); TM.ui.go("modes"); }, "btn ghost")
      ]));
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
    addSectorBar(screen, "coach-calendar");
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

    function compClass(key) { return key === "cup" ? "cup" : key === "cont" ? "cont" : key === "mundial" ? "cont" : "league"; }
    function compGlyph(key) { return key === "cup" ? "🏆" : (key === "cont" || key === "mundial") ? "🌍" : "⚽"; }

    // legenda (estilo FIFA)
    body.appendChild(el("div", { class: "cal-legend" }, [
      el("span", { class: "leg league", text: "⚽ Jogo de Liga" }),
      el("span", { class: "leg cup", text: "🏆 Jogo de Copa" }),
      el("span", { class: "leg cont", text: "🌍 Continental" }),
      el("span", { text: "🟢 Janela abre" }),
      el("span", { text: "🔴 Janela fecha" }),
      el("span", { class: "leg today", text: "▣ Hoje" })
    ]));

    var todayOff = c.currentDay;
    var start = C().dateOf(c, c.currentDay), last = C().dateOf(c, endOff);
    var ym = start.y * 12 + (start.m - 1), ymEnd = last.y * 12 + (last.m - 1), guard = 0;
    while (ym <= ymEnd && guard++ < 14) {
      var year = Math.floor(ym / 12), month = (ym % 12) + 1; ym++;
      var monthCard = el("div", { class: "cal-fmonth" });
      monthCard.appendChild(el("div", { class: "cal-mtitle", text: MES_FULL[month - 1] + " " + year }));

      var gridWrap = el("div", { class: "fc-grid" });
      WD_PT_F.forEach(function (w) { gridWrap.appendChild(el("div", { class: "fc-wd", text: w })); });

      var daysIn = new Date(year, month, 0).getDate();
      var firstWd = new Date(year, month - 1, 1).getDay();
      var prevDaysIn = new Date(year, month - 1, 0).getDate();
      var totalCells = Math.ceil((firstWd + daysIn) / 7) * 7;

      for (var i = 0; i < totalCells; i++) {
        var dayNum, otherMonth = false;
        if (i < firstWd) { dayNum = prevDaysIn - firstWd + 1 + i; otherMonth = true; }
        else if (i < firstWd + daysIn) { dayNum = i - firstWd + 1; }
        else { dayNum = i - (firstWd + daysIn) + 1; otherMonth = true; }

        var cls = "fc-cell" + (otherMonth ? " other" : "");
        var kids = [ el("div", { class: "fc-num", text: dayNum }) ];
        if (!otherMonth) {
          var off = offMap[year + "-" + month + "-" + dayNum];
          if (off === todayOff) cls += " today";
          var mt = off != null ? matchByOff[off] : null;
          if (mt) {
            cls += " " + compClass(mt.key);
            kids.push(el("div", { class: "fc-badge", text: compGlyph(mt.key) }));
            if (mt.tbd) {
              kids.push(el("div", { class: "fc-ev-glyph", text: compGlyph(mt.key) }));
            } else {
              var opp = TM.data.club(mt.homeId === c.teamId ? mt.awayId : mt.homeId);
              var home = mt.homeId === c.teamId;
              kids.push(TM.img.clubImg(opp, "fc-crest"));
              kids.push(el("div", { class: "fc-oppname", text: (home ? "" : "@ ") + (opp.short || opp.name.split(" ")[0]) }));
            }
          }
          if (off != null && winOpenOff[off] != null) { cls += " win-open"; kids.push(el("div", { class: "fc-win open", text: "🟢" })); }
          if (off != null && winCloseOff[off] != null) { cls += " win-close"; kids.push(el("div", { class: "fc-win close", text: "🔴" })); }
        }
        gridWrap.appendChild(el("div", { class: cls }, kids));
      }
      monthCard.appendChild(gridWrap);
      body.appendChild(monthCard);
    }
  });
  var WD_PT_F = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

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
      el("div", {}, [ el("div", { class: "ch-name", text: "Seleção de " + c.nation.name }), el("div", { class: "ch-sub", text: "Convocados: " + c.nation.squad.length + (isWC ? " · Copa do Mundo " + c.seasonYear : " · Eliminatórias da Copa") }) ]),
      el("button", { class: "date-cal-btn", text: "🔄 Voltar ao clube", on: { click: function () { TM.ui.go("coach-hub"); } } })
    ]));
    screen.appendChild(el("div", { class: "date-bar" }, [ el("div", { class: "date-now" }, [ el("span", { class: "date-ic", text: "📅" }), el("span", { text: "Hoje: " + C().dateOf(c, c.currentDay).full }) ]) ]));

    if (isWC) { renderWorldCupPanel(screen, c); return; }

    // ano da Copa mas a seleção não se classificou
    if (c.nation.eliminated) {
      screen.appendChild(el("div", { class: "next-match season-end" }, [
        el("div", { class: "nm-label", text: "😞 Fora da Copa do Mundo" }),
        el("div", { class: "nm-teams", text: c.nation.name + " não se classificou nas Eliminatórias." }),
        el("p", { class: "intro-text", style: "text-align:center", text: "Nesta temporada não há Copa para a seleção. Prepare o próximo ciclo de Eliminatórias." })
      ]));
      screen.appendChild(el("div", { class: "hub-actions" }, [
        el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-standings"); } } }, [ el("span", { class: "hub-ic", text: "📊" }), el("span", { text: "Tabela final" }) ]),
        el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-hub"); } } }, [ el("span", { class: "hub-ic", text: "🔄" }), el("span", { text: "Voltar ao clube" }) ])
      ]));
      return;
    }

    var w = C().nationNextWindow(c);
    if (!w) {
      screen.appendChild(el("div", { class: "next-match" }, [ el("div", { class: "nm-label", text: "Rodada de Eliminatórias encerrada nesta temporada. Avance para a próxima." }) ]));
    } else {
      var opp = TM.data.nation(w.oppId), open = c.currentDay >= w.openDay;
      var fdate = C().dateOf(c, w.friendlyDay), ddate = C().dateOf(c, w.deadlineDay);
      if (!open) {
        screen.appendChild(el("div", { class: "next-match" }, [
          el("div", { class: "nm-label", text: "🔒 Janela de seleção fechada" }),
          el("div", { class: "nm-date", text: "A convocação abre em " + (w.openDay - c.currentDay) + " dia(s) (" + C().dateOf(c, w.openDay).full + ")." }),
          el("p", { class: "intro-text", style: "text-align:center", text: "Volte perto do jogo para convocar e escalar." })
        ]));
      } else {
        var confName = C().CONFED_NAME[C().confedOf(c.nation.id)] || "";
        var kids = [
          el("div", { class: "nm-label", text: "🌍 Eliminatórias · " + confName }),
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
              TM.notify.push(c, { icon: "📋", title: "Convocação enviada", text: "Convocação de " + c.nation.name + " confirmada para as Eliminatórias contra " + opp.name + "." });
              TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation");
            }, "btn primary small")
          ]));
        } else if (c.currentDay >= w.friendlyDay) {
          kids.push(el("div", { class: "nm-date", text: "✔ Convocação confirmada — é dia de jogo!" }));
          kids.push(TM.ui.button("🔍 Analisar adversário", function () { TM.ui.go("scout", { teamId: w.oppId, isNation: true, compId: "nat-world", back: function () { TM.ui.go("coach-nation"); } }); }, "btn ghost"));
          kids.push(TM.ui.button("▶ Jogar Eliminatórias", function () { TM.ui.go("coach-nation-play"); }, "btn primary"));
        } else {
          kids.push(el("div", { class: "nm-date", text: "✔ Convocação confirmada. Amistoso em " + (w.friendlyDay - c.currentDay) + " dia(s)." }));
          kids.push(el("p", { class: "intro-text", style: "text-align:center", text: "Avance os dias no clube até a data do amistoso." }));
        }
        screen.appendChild(el("div", { class: "next-match" }, kids));
      }
    }

    screen.appendChild(el("div", { class: "hub-actions" }, [
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-standings"); } } }, [ el("span", { class: "hub-ic", text: "📊" }), el("span", { text: "Tabela das Eliminatórias" }) ]),
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-scout"); } } }, [ el("span", { class: "hub-ic", text: "🔍" }), el("span", { text: "Scout / Convocar" }) ]),
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("coach-nation-lineup"); } } }, [ el("span", { class: "hub-ic", text: "📋" }), el("span", { text: "Escalação" }) ])
    ]));
  });

  /* ---------- tabela das Eliminatórias (confederação do usuário) ---------- */
  TM.ui.register("coach-nation-standings", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.nation) { TM.ui.go("coach-hub"); return; }
    C().ensureQuali(c); TM.storage.saveCoachCareer(c);
    var q = c.quali;
    var confName = C().CONFED_NAME[q.confed] || q.confed;
    var slots = C().CONFED_SLOTS[q.confed] || 4;
    screen.appendChild(TM.ui.topbar("📊 Eliminatórias · " + confName, function () { TM.ui.go("coach-nation"); }));
    screen.appendChild(el("p", { class: "intro-text", style: "text-align:center", text: "Classificam-se as " + slots + " primeiras seleções para a Copa do Mundo." }));
    var rows = C().qualiStandings(q.table);
    var table = el("div", { class: "quali-table" });
    table.appendChild(el("div", { class: "quali-row quali-head" }, [
      el("span", { class: "qr-pos", text: "#" }), el("span", { class: "qr-name", text: "Seleção" }),
      el("span", { class: "qr-n", text: "P" }), el("span", { class: "qr-n", text: "J" }),
      el("span", { class: "qr-n", text: "SG" }), el("span", { class: "qr-n qr-pts", text: "Pts" })
    ]));
    rows.forEach(function (r, i) {
      var nn = TM.data.nation(r.id);
      var cls = "quali-row" + (i < slots ? " quali-in" : "") + (r.id === c.nation.id ? " quali-me" : "");
      table.appendChild(el("div", { class: cls }, [
        el("span", { class: "qr-pos", text: (i + 1) }),
        el("span", { class: "qr-name" }, [ TM.img.nationImg(nn, "qr-flag"), el("span", { text: nn.name }) ]),
        el("span", { class: "qr-n", text: r.p }),
        el("span", { class: "qr-n", text: r.w + "-" + r.d + "-" + r.l }),
        el("span", { class: "qr-n", text: (r.gf - r.ga > 0 ? "+" : "") + (r.gf - r.ga) }),
        el("span", { class: "qr-n qr-pts", text: r.pts })
      ]));
    });
    screen.appendChild(table);
    screen.appendChild(el("p", { class: "intro-text", style: "text-align:center;margin-top:10px", text: "🟩 Zona de classificação (top " + slots + ")" }));
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
        var wcOpp = m.homeId === c.nation.id ? m.awayId : m.homeId;
        wkids.push(TM.ui.button("🔍 Analisar adversário", function () { TM.ui.go("scout", { teamId: wcOpp, isNation: true, compId: "nat-world", back: function () { TM.ui.go("coach-nation"); } }); }, "btn ghost"));
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
    // pool: TODOS os jogadores da nacionalidade que existem no jogo (clubes de todas as ligas) + pool fixo da seleção
    var seen = {}, pool = [];
    function addP(p) { if (p && !seen[p.id]) { seen[p.id] = true; pool.push(p); } }
    nat.players.map(TM.data.player).forEach(addP);
    try {
      var W = TM.data.world();
      Object.keys(W.playersById || {}).forEach(function (id) { var p = W.playersById[id]; if (p && p.nationId === nat.id && p.clubId && p.clubId !== "free") addP(p); });
      (c.roster || []).forEach(function (id) { var p = C().resolvePlayer(c, id); if (p && p.nationId === nat.id) addP(p); });
    } catch (e) {}
    pool.sort(function (a, b) { return b.overall - a.overall; });
    // filtros: posição + busca por nome
    var natFilter = TM.ui._natFilter || { pos: "", q: "" };
    var fbar = el("div", { class: "mkt-filters nat-filters" });
    [["", "Todos"], ["GK", "GOL"], ["DF", "DEF"], ["MF", "MEI"], ["FW", "ATA"]].forEach(function (f) {
      fbar.appendChild(el("button", { class: "seg-btn" + (natFilter.pos === f[0] ? " active" : ""), text: f[1], on: { click: function () { natFilter.pos = f[0]; TM.ui._natFilter = natFilter; TM.ui.go("coach-nation-scout"); } } }));
    });
    var qIn = el("input", { class: "select", type: "text", placeholder: "buscar jogador…", value: natFilter.q || "" });
    qIn.addEventListener("input", function () { natFilter.q = qIn.value; TM.ui._natFilter = natFilter; renderList(); });
    body.appendChild(fbar); body.appendChild(qIn);
    var listBox = el("div", { class: "build-list" }); body.appendChild(listBox);
    var infoLine = el("div", { class: "setting-hint" }); body.appendChild(infoLine);
    function norm(x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
    function renderList() {
      TM.ui.clear(listBox);
      var q = norm(natFilter.q), shown = 0;
      pool.forEach(function (p) {
        if (natFilter.pos && p.pos !== natFilter.pos) return;
        if (q && norm(p.name).indexOf(q) < 0) return;
        if (shown >= 120) return;
        shown++;
        listBox.appendChild(rowFor(p));
      });
      infoLine.textContent = pool.length + " jogador(es) de " + c.nation.name + " no jogo" + (shown >= 120 ? " · mostrando os 120 melhores do filtro" : "");
    }
    function rowFor(p) {
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
      return row;
    }
    renderList();
  });

  /* ---------- campinho da seleção ---------- */
  var natPick = null;
  TM.ui.register("coach-nation-lineup", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.nation) { TM.ui.go("coach-hub"); return; }
    var lu = c.nation.lineup;
    screen.appendChild(TM.ui.topbar("📋 Escalação · " + c.nation.name, function () { natPick = null; TM.ui.go("coach-nation"); }));

    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("h3", { class: "block-title", text: "📐 Esquema tático" }),
      TM.ui.dropdown("Formação", Object.keys(C().FORMATIONS), lu.formation, function (f) {
        c.nation.lineup = C().buildLineup(c.nation.squad.map(TM.data.player), f); natPick = null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation-lineup");
      }),
      TM.ui.dropdown("Tática", TM.engine.TACTICS, c.nation.tactic, function (v) { c.nation.tactic = v; TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation-lineup"); })
    ]));

    var slots = C().FORMATIONS[lu.formation];
    if (!lu.pos) lu.pos = {};
    function natFieldY(sy) { return Math.round((20 + (sy - 15) * (88 - 20) / (88 - 15)) * 10) / 10; }
    var pitch = el("div", { class: "pitch" });
    pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
    pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
    lu.starters.forEach(function (id, i) {
      var p = TM.data.player(id); if (!p) return;
      var baseSlot = slots[i] || [null, 50, 50];
      var cp = lu.pos[i];
      var x = cp ? cp[0] : baseSlot[1], y = cp ? cp[1] : natFieldY(baseSlot[2]);
      // se arrastado, identifica a NOVA posição e ajusta o overall
      var slot = cp ? C().fieldSlot(x, y) : baseSlot;
      var chip = el("button", { class: "pl-chip" + (natPick === i ? " picked" : "") + (cp ? " custom" : ""), style: "left:" + x + "%;top:" + y + "%" },
        TM.ui.chipKids(p, slot, { name: shortName(p.name) })
      );
      attachNatChipDrag(chip, i, pitch);
      pitch.appendChild(chip);
    });
    screen.appendChild(pitch);
    var natHasCustom = Object.keys(lu.pos).length > 0;
    screen.appendChild(el("div", { class: "lineup-hint", text: natPick != null ? "Toque num reserva para colocar no lugar do titular." : "👆 Toque para trocar · ✋ Arraste pelo campo para reposicionar (a posição e o overall se ajustam)." }));
    if (natHasCustom) screen.appendChild(TM.ui.button("↩️ Redefinir posições da formação", function () { lu.pos = {}; TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation-lineup"); }, "btn ghost small"));
    screen.appendChild(TM.ui.posPanel(lu.starters.map(function (id, i) { return { player: TM.data.player(id), slot: C().slotForLineup(lu, i) }; })));

    function attachNatChipDrag(chip, i, pitchEl) {
      var sx = null, sy = null, dragging = false, pid = null, nx = null, ny = null;
      chip.style.touchAction = "none";
      chip.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; dragging = false; pid = e.pointerId; nx = ny = null; });
      chip.addEventListener("pointermove", function (e) {
        if (sx == null) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (!dragging && (dx * dx + dy * dy) > 36) { dragging = true; try { chip.setPointerCapture(pid); } catch (er) {} chip.classList.add("dragging"); }
        if (dragging) {
          var r = pitchEl.getBoundingClientRect();
          nx = Math.max(5, Math.min(95, (e.clientX - r.left) / r.width * 100));
          ny = Math.max(6, Math.min(95, (e.clientY - r.top) / r.height * 100));
          chip.style.left = nx + "%"; chip.style.top = ny + "%";
        }
      });
      function end() {
        if (sx == null) return;
        var wasDrag = dragging; sx = sy = null; dragging = false; chip.classList.remove("dragging");
        if (wasDrag && nx != null) { lu.pos[i] = [Math.round(nx * 10) / 10, Math.round(ny * 10) / 10]; TM.storage.saveCoachCareer(c); TM.ui.go("coach-nation-lineup"); }
        else { natPick = (natPick === i ? null : i); TM.ui.go("coach-nation-lineup"); }
      }
      chip.addEventListener("pointerup", end);
      chip.addEventListener("pointercancel", function () { sx = sy = null; dragging = false; chip.classList.remove("dragging"); });
    }

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
      teamA: teamA, teamB: teamB, result: result, title: "Eliminatórias · " + c.nation.name, pauseSide: 0, simOpts: simOpts, formation: c.nation.lineup && c.nation.lineup.formation,
      onBack: function () { TM.ui.go("coach-nation"); },
      onDone: function () {
        w.played = true; w.hs = result.score[0]; w.as = result.score[1];
        C().applyQualiResult(c, w); // pontua na tabela + simula os outros jogos da rodada
        var res = result.score[0] > result.score[1] ? "Vitória" : result.score[0] < result.score[1] ? "Derrota" : "Empate";
        TM.notify.push(c, { icon: "🌍", title: "Eliminatórias da Copa", text: res + " " + result.score[0] + "x" + result.score[1] + " contra " + teamB.name + "." });
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
    // uniforme escolhido no pré-jogo (mandante = teamA, visitante = teamB)
    var _kp = (c.kitPick && c.kitPick.mn === c.matchNo) ? c.kitPick : null;
    teamA.kitVariant = _kp ? _kp.home : 0;
    teamB.kitVariant = _kp ? _kp.away : 1;
    var userSide = p.homeId === c.teamId ? 0 : 1;
    var socialEdge = 0; try { socialEdge = TM.social.moraleEdge(c); } catch (e) {}
    var capEdge = 0; try { capEdge = captainLeadership(c).edge; } catch (e) {}
    var fatigueEdge = 0;
    try {
      if (c.fatigue) {
        var st2 = (c.lineup && c.lineup.starters) || [];
        var tiredN = st2.filter(function (id) { return (c.fatigue[id] || 0) >= 78; }).length;
        fatigueEdge = -Math.min(3, Math.floor(tiredN / 2));   // muitos titulares cansados pesam
      }
    } catch (e) {}
    var simOpts = { realism: TM.storage.settings().realism, difficulty: TM.storage.settings().difficulty, neutral: p.ko, tacticSide: userSide, tactic: c.tactic, moraleBoost: (c.pressEdge || 0) + socialEdge + capEdge + fatigueEdge + (function () { try { return TM.club.clubEdge(c); } catch (e) { return 0; } })(), moraleSide: userSide, userSide: userSide, penTakerId: c.penTakerId || null, fkTakerId: c.fkTakerId || null };
    try { Object.assign(simOpts, C().matchContext(c, p.homeId, p.awayId, p.ko)); } catch (e) {}   // fase, clássico, torcida, o que está em jogo
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    var legI = null; try { legI = C().legInfo(c, p); } catch (e) {}
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, title: p.name, leg: legI,
      pauseSide: userSide, simOpts: simOpts, formation: c.lineup && c.lineup.formation,
      onBack: function () {
        // sair no meio: se "reiniciar partidas" estiver desligado, o resultado é registrado (sem rejogar)
        if (c.allowRestart) { TM.ui.go("coach-hub"); return; }
        TM.ui.confirm("Sair da partida?", "Sair agora REGISTRA o resultado atual da partida — você não poderá jogá-la de novo. (Para poder rejogar, ligue \"Reiniciar partidas\" nas opções da carreira.)", "Sair e registrar", function () {
          C().processUserMatch(c, result, userSide);
          try { C().recordPlayerStats(c, result, userSide, (userSide === 0 ? teamB : teamA).name); } catch (e) {}
          try { tickRetrain(c, (c.lineup && c.lineup.starters) || []); } catch (e) {}
          var hs = result.score[0], as = result.score[1];
          var penCtx = hs === as ? C().userPenContext(c, hs, as) : null;
          var penWinnerId = null;
          if (penCtx) { var sh = TM.engine.shootout(C().anyTeam(c, penCtx.aId), C().anyTeam(c, penCtx.bId)); penWinnerId = sh.winner === 0 ? penCtx.aId : penCtx.bId; }
          C().applyUserResult(c, hs, as, penWinnerId);
          try { TM.club.matchIncome(c, userSide === 0); } catch (e) {}
          try { TM.scouting.tick(c); } catch (e) {}
          c.pressEdge = 0;
          TM.storage.saveCoachCareer(c);
          TM.ui.toast("Resultado registrado: " + hs + " × " + as);
          TM.ui.go("coach-hub");
        });
      },
      onDone: function () {
        C().processUserMatch(c, result, userSide);
        try { C().recordPlayerStats(c, result, userSide, (userSide === 0 ? teamB : teamA).name); } catch (e) {}
          try { tickRetrain(c, (c.lineup && c.lineup.starters) || []); } catch (e) {}
        try { var _opp = p.homeId === c.teamId ? p.awayId : p.homeId; trackClassico(c, _opp, result.score[userSide], result.score[1 - userSide]); } catch (e) {}
        var hs = result.score[0], as = result.score[1];
        var penCtx = hs === as ? C().userPenContext(c, hs, as) : null;
        function finish(penWinnerId) {
          C().applyUserResult(c, hs, as, penWinnerId);
          try { TM.club.matchIncome(c, userSide === 0); } catch (e) {}
          try { TM.scouting.tick(c); } catch (e) {}
          c.pressEdge = 0; // consome o efeito da coletiva
          TM.storage.saveCoachCareer(c);
          TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result, ko: p.ko, compId: compId, penWinnerId: penWinnerId, leg: legI, userSide: userSide });
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
    var legR = params.leg || null;
    var win = r.score[0] > r.score[1] ? a.name : r.score[1] > r.score[0] ? b.name : null;
    var penName = params.penWinnerId ? (params.penWinnerId === a.id ? a.name : b.name) : null;
    var tag = win ? "🏆 " + win + " venceu" : penName ? "🎯 " + penName + " venceu nos pênaltis" : (params.ko ? "Empate — decidido nos pênaltis" : "🤝 Empate");
    screen.appendChild(el("div", { class: "result-hero" }, [
      el("div", { class: "result-score" }, [
        el("span", { class: "rs-team", text: a.name }), el("span", { class: "rs-num", text: r.score[0] + " × " + r.score[1] }), el("span", { class: "rs-team", text: b.name })
      ]),
      el("div", { class: "result-tag", text: tag })
    ]));
    if (legR) {
      var meNow = (params.userSide != null) ? params.userSide : (a.id === (TM.storage.coachCareer() || {}).teamId ? 0 : 1);
      var meuTotal = legR.meuGol + r.score[meNow], delesTotal = legR.delesGol + r.score[1 - meNow];
      screen.appendChild(el("div", { class: "agg-box " + (meuTotal > delesTotal ? "up" : meuTotal < delesTotal ? "down" : "even") }, [
        el("div", { class: "agg-t", text: "🔁 Confronto de ida e volta" }),
        el("div", { class: "agg-line" }, [
          TM.img.clubImg(TM.data.club(legR.aId), "agg-crest"),
          el("span", { class: "agg-sc", text: legR.firstHs + " x " + legR.firstAs }),
          TM.img.clubImg(TM.data.club(legR.bId), "agg-crest"),
          el("span", { class: "agg-lbl", text: "ida" })
        ]),
        el("div", { class: "agg-agg", text: "Agregado: " + meuTotal + " x " + delesTotal + " · " + (meuTotal > delesTotal ? "você avança" : meuTotal < delesTotal ? "você está eliminado" : "empate no agregado — decisão nos pênaltis") })
      ]));
    }
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
  // perguntas específicas de CLÁSSICO (entram primeiro quando o adversário é rival)
  var RIVAL_Q = [
    { id: "rv1", q: "Clássico contra o {opp}: o que esse jogo representa para a torcida?", a: [
      { t: "É o jogo do ano, vamos deixar a alma em campo.", e: 1, r: "A torcida rival promete lotar as arquibancadas ao seu lado." },
      { t: "Respeitamos a rivalidade, mas é mais uma final.", e: 0, r: "Postura madura elogiada pela imprensa." },
      { t: "Sinceramente, é só mais três pontos.", e: -1, r: "A frieza irrita a torcida em pleno clássico." } ] },
    { id: "rv2", q: "A provocação da torcida do {opp} tomou conta da semana. Comentário?", a: [
      { t: "A resposta a gente dá dentro de campo.", e: 1, r: "O vestiário compra a briga e se motiva." },
      { t: "Ignoro provocação, foco no jogo.", e: 0, r: "Serenidade bem recebida." },
      { t: "Eles vão se arrepender, prometo.", e: -1, r: "A promessa vira manchete e aumenta a pressão sobre você." } ] },
    { id: "rv3", q: "Vencer o rival {opp} salva uma temporada irregular?", a: [
      { t: "Bater o rival muda o humor de todo o clube.", e: 1, r: "A frase incendeia a torcida no bom sentido." },
      { t: "Ajuda muito, mas o campeonato é longo.", e: 0, r: "Equilíbrio aprovado." },
      { t: "Não muda nada se continuarmos mal.", e: -1, r: "O discurso derrotista pega mal às vésperas do clássico." } ] }
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
    // clássico: força uma pergunta de rivalidade como abertura da coletiva
    var isClassic = rivalryEnabled() && TM.data.areRivals(c.teamId, oppId);
    if (isClassic) {
      var rq = RIVAL_Q[Math.floor(Math.random() * RIVAL_Q.length)];
      picked = [rq].concat(picked.filter(function (q) { return q.id !== rq.id; })).slice(0, 4);
    }

    // repórteres (rotativos) e cores de avatar
    var REPORTERS = [
      { n: "Rafael Tavares", o: "Canal Esporte" }, { n: "Bianca Rocha", o: "Rádio Gol" },
      { n: "Otávio Nunes", o: "Jornal Lance" }, { n: "Marina Prado", o: "TV Placar" },
      { n: "Diego Farias", o: "PodBola" }, { n: "Camila Souza", o: "Portal Chute" },
      { n: "Henrique Dias", o: "Rede Esporte" }, { n: "Letícia Amaral", o: "Gazeta FC" }
    ];
    var RCOLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#14b8a6", "#06b6d4"];
    var reporters = pressShuffle(REPORTERS.slice()).slice(0, 4);

    // barra AO VIVO com nº de espectadores
    var viewers = Math.max(8, Math.round((TM.data.clubRating(c.teamId) - 40) * (isClassic ? 3.4 : 1.7)) + Math.floor(Math.random() * 11) + 4);
    screen.appendChild(el("div", { class: "press-live" }, [
      el("span", { class: "plive-dot" }),
      el("span", { class: "plive-txt", text: "AO VIVO · Sala de imprensa" }),
      el("span", { class: "plive-views", text: "👁️ " + viewers + " mil" })
    ]));

    // palco: flashes de câmera + confronto + púlpito do técnico + subtítulo
    screen.appendChild(el("div", { class: "press-stage" }, [
      el("span", { class: "press-flash f1", "aria-hidden": "true" }),
      el("span", { class: "press-flash f2", "aria-hidden": "true" }),
      el("span", { class: "press-flash f3", "aria-hidden": "true" }),
      el("div", { class: "press-match" }, [
        el("div", { class: "pm-side" }, [ TM.img.clubImg(TM.data.club(c.teamId), "pm-crest"), el("span", { class: "pm-nm", text: myName }) ]),
        el("span", { class: "pm-vs", text: "VS" }),
        el("div", { class: "pm-side" }, [ TM.img.clubImg(TM.data.club(oppId), "pm-crest"), el("span", { class: "pm-nm", text: oppName }) ])
      ]),
      el("div", { class: "press-podium" }, [
        el("div", { class: "ppod-ava", text: (c.coachName || "T").charAt(0).toUpperCase() }),
        el("div", { class: "ppod-info" }, [
          el("div", { class: "ppod-name", text: c.coachName || "Treinador" }),
          el("div", { class: "ppod-role", text: "Técnico · " + myName })
        ]),
        el("span", { class: "ppod-mic", text: "🎙️" })
      ]),
      el("div", { class: "press-substage", text: "🎤 Coletiva pré-jogo" + (compName ? " · " + compName : "") + (isClassic ? " · ⚔️ CLÁSSICO" : "") })
    ]));

    // medidor de clima (ao vivo)
    var idx = 0, edge = 0;
    var meter = el("div", { class: "press-meter" });
    screen.appendChild(meter);
    function updMeter() {
      var pct = Math.max(4, Math.min(96, Math.round(((edge + 4) / 8) * 100)));
      var cls = edge >= 2 ? "hi" : edge > 0 ? "mid-hi" : edge === 0 ? "mid" : edge <= -2 ? "lo" : "mid-lo";
      var lbl = edge >= 2 ? "Imprensa impressionada 😎" : edge > 0 ? "Clima positivo 🙂" : edge === 0 ? "Clima neutro 😐" : edge <= -2 ? "Clima tenso 😬" : "Leve tensão 😕";
      meter.innerHTML = "";
      meter.appendChild(el("div", { class: "pmeter-top" }, [ el("span", { text: "🌡️ Clima da coletiva" }), el("span", { class: "pmeter-lbl " + cls, text: lbl }) ]));
      meter.appendChild(el("div", { class: "pmeter-track" }, [ el("div", { class: "pmeter-fill " + cls, style: "width:" + pct + "%" }) ]));
    }
    updMeter();

    var panel = el("div", { class: "panel-narrow press-panel" });
    screen.appendChild(panel);

    function render() {
      panel.innerHTML = "";
      if (idx >= 4) { done(); return; }
      var rep = reporters[idx % reporters.length];
      var col = RCOLORS[idx % RCOLORS.length];
      panel.appendChild(el("div", { class: "press-progress" }, [ el("span", { text: "Pergunta " + (idx + 1) + " de 4" }), el("span", { class: "press-vs", text: "vs " + oppName }) ]));
      var q = picked[idx];
      panel.appendChild(el("div", { class: "press-reporter" }, [
        el("div", { class: "press-ava", style: "background:" + col, text: rep.n.charAt(0) }),
        el("div", { class: "press-rmid" }, [
          el("div", { class: "press-rname" }, [ el("span", { text: rep.n }), el("span", { class: "press-outlet", text: rep.o }) ]),
          el("div", { class: "press-q", text: fill(q.q) })
        ])
      ]));
      var opts = el("div", { class: "press-opts" });
      q.a.forEach(function (opt) {
        opts.appendChild(el("button", { class: "press-opt", on: { click: function () {
          edge += opt.e; updMeter();
          if (c.pressUsed.indexOf(q.id) < 0) c.pressUsed.push(q.id);
          panel.innerHTML = "";
          panel.appendChild(el("div", { class: "press-answer" }, [ el("span", { class: "press-you", text: "Você:" }), el("span", { text: " " + fill(opt.t) }) ]));
          panel.appendChild(el("div", { class: "press-react " + (opt.e > 0 ? "good" : opt.e < 0 ? "bad" : "") , text: (opt.e > 0 ? "😎 " : opt.e < 0 ? "😬 " : "🎙️ ") + opt.r }));
          var room = opt.e > 0 ? "👏 A sala reage bem — alguns aplausos e cliques de câmera." : (opt.e < 0 ? "😯 Murmúrios na sala de imprensa e olhares trocados." : "🎙️ A sala anota em silêncio e segue para a próxima pergunta.");
          panel.appendChild(el("div", { class: "press-room " + (opt.e > 0 ? "good" : opt.e < 0 ? "bad" : ""), text: room }));
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
      // manchete gerada pela imprensa a partir do tom das respostas
      var headline = good
        ? fill("“Viemos para vencer”: comando do {team} passa confiança antes de encarar o {opp}")
        : bad
          ? fill("Clima quente: técnico do {team} bate de frente com a imprensa na véspera do jogo com o {opp}")
          : fill("{team} mantém discurso cauteloso na véspera do duelo com o {opp}");
      panel.appendChild(el("div", { class: "press-manchete" }, [
        el("div", { class: "pman-tag", text: "🗞️ MANCHETE DE AMANHÃ" }),
        el("div", { class: "pman-txt", text: headline })
      ]));
      panel.appendChild(el("div", { class: "actions" }, [
        TM.ui.button("▶ Ir para o jogo", function () { TM.ui.go("coach-play"); }, "btn primary"),
        TM.ui.button("Voltar ao hub", function () { TM.ui.go("coach-hub"); }, "btn ghost")
      ]));
    }
    render();
  });

  /* ---------- helpers: import de imagem + histórico + uniformes ---------- */
  function importImage(cb, maxSize) {
    maxSize = maxSize || 512;
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
    inp.addEventListener("change", function () {
      var f = inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement("canvas"), sc = Math.min(1, maxSize / Math.max(img.width, img.height));
          cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc));
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          try { cb(cv.toDataURL("image/png")); } catch (e) {}
        };
        img.src = ev.target.result;
      };
      r.readAsDataURL(f);
    });
    inp.click();
  }
  // troca de escudo/uniforme: UMA vez por temporada cada (escudo, 1º, 2º e 3º uniforme)
  function kitChangeSlot(c, slot) {
    c.kitChanges = c.kitChanges || {};
    if (c.kitChanges.season !== (c.season || 1)) c.kitChanges = { season: c.season || 1, used: {} };
    return c.kitChanges.used[slot] ? false : true;
  }
  function kitChangeUse(c, slot) { kitChangeSlot(c, slot); c.kitChanges.used[slot] = true; }
  function applyKitOverrides(c) {
    if (!c) return;
    if (c.crestOverride) { var cl0 = TM.data.club(c.teamId); if (cl0) cl0.crestData = c.crestOverride; }
    if (!c.kitOverrides) return;
    var club = TM.data.club(c.teamId); if (!club) return;
    if (c.crestOverride) club.crestData = c.crestOverride;
    if (c.kitOverrides[0]) club.kitData = c.kitOverrides[0];
    if (c.kitOverrides[1]) club.kitAwayData = c.kitOverrides[1];
    if (c.kitOverrides[2]) club.kitThirdData = c.kitOverrides[2];
  }
  TM.coachUI = TM.coachUI || {}; TM.coachUI.applyKitOverrides = applyKitOverrides;
  function clubHistory(club) {
    var s = String(club.id || club.name), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    var founded = 1895 + (h % 106);
    var rating = TM.data.clubRating(club.id);
    var porte = rating >= 85 ? "gigante" : rating >= 79 ? "grande" : rating >= 73 ? "tradicional" : rating >= 67 ? "de médio porte" : "modesto";
    var league = TM.data.league(club.leagueId), nation = league ? league.nation : "";
    var titlesNat = Math.max(0, Math.round((rating - 62) / 2.2));
    var titlesCont = rating >= 82 ? Math.max(1, Math.round((rating - 80) / 2)) : 0;
    var myst = rating >= 82 ? "É uma potência respeitada dentro e fora das quatro linhas, sempre entre os favoritos."
      : rating >= 74 ? "Tem uma torcida fiel e um histórico de boas campanhas na temporada."
      : "Luta temporada após temporada para crescer e surpreender os grandes.";
    var desc = "Fundado em " + founded + ", o " + club.name + " é um clube " + porte + (nation ? " da " + nation : "") +
      ". Ao longo da história conquistou " + titlesNat + " título" + (titlesNat !== 1 ? "s" : "") + " nacio" + (titlesNat !== 1 ? "nais" : "nal") +
      (titlesCont ? " e " + titlesCont + " internaciona" + (titlesCont !== 1 ? "is" : "l") : "") + ". " + myst;
    return { founded: founded, rating: rating, porte: porte, nation: nation, titlesNat: titlesNat, titlesCont: titlesCont, desc: desc };
  }

  /* ---------- INFORMAÇÕES DO CLUBE (clicar no nome do time) ---------- */
  TM.ui.register("coach-club-info", function (screen, params) {
    var c = TM.storage.coachCareer();
    var clubId = (params && params.clubId) || (c && c.teamId);
    var club = TM.data.club(clubId);
    if (!club) { TM.ui.go(c ? "coach-hub" : "modes"); return; }
    var back = (params && params.back) || "coach-hub";
    var mine = c && club.id === c.teamId;
    var hist = clubHistory(club);
    var stad = TM.data.stadium(club);

    screen.appendChild(TM.ui.topbar("Sobre o clube", function () { TM.ui.go(back); }));
    var body = el("div", { class: "panel-narrow ci-wrap" }); screen.appendChild(body);

    body.appendChild(el("div", { class: "ci-head" }, [
      TM.img.clubImg(club, "ci-crest"),
      el("div", { class: "ci-hinfo" }, [ el("div", { class: "ci-name", text: club.name }), el("div", { class: "ci-league", text: (TM.data.league(club.leagueId) || {}).name || "" }) ]),
      TM.ui.ovBadge(hist.rating)
    ]));

    body.appendChild(el("div", { class: "ci-stadium" }, [
      TM.img.stadiumImg(club, "ci-stad-img"),
      el("div", { class: "ci-stad-cap" }, [ el("span", { text: "🏟️ " + stad.name }), el("span", { text: "👥 " + (stad.capacity || 0).toLocaleString("pt-BR") + " lugares" }) ])
    ]));

    body.appendChild(el("div", { class: "ci-card" }, [ el("div", { class: "ci-ct", text: "📖 História" }), el("div", { class: "ci-desc", text: hist.desc }) ]));

    function stat(l, v) { return el("div", { class: "ci-stat" }, [ el("div", { class: "ci-sv", text: v }), el("div", { class: "ci-sl", text: l }) ]); }
    body.appendChild(el("div", { class: "ci-stats" }, [
      stat("Fundação", hist.founded), stat("Força", hist.rating), stat("Títulos nac.", hist.titlesNat), stat("Internac.", hist.titlesCont)
    ]));

    body.appendChild(el("div", { class: "ci-card" }, [ el("div", { class: "ci-ct", text: "🎨 Cores" }),
      el("div", { class: "ci-colors" }, [
        el("div", { class: "ci-swatch", style: "background:" + club.colors.primary }),
        el("div", { class: "ci-swatch", style: "background:" + club.colors.secondary })
      ]) ]));

    var kitsCard = el("div", { class: "ci-card" });
    kitsCard.appendChild(el("div", { class: "ci-ct", text: "👕 Uniformes" }));
    var krow = el("div", { class: "ci-kits" });
    ["1º", "2º", "3º"].forEach(function (lbl, v) {
      var tile = el("div", { class: "ci-kit" }, [ TM.img.kitImg(club, "ci-kit-img", v), el("div", { class: "ci-kit-lbl", text: lbl } ) ]);
      if (mine) {
        var canK = kitChangeSlot(c, "kit" + v);
        tile.appendChild(el("button", { class: "ci-kit-edit" + (canK ? "" : " locked"), text: canK ? "✏️ Trocar" : "🔒 Trocado nesta temporada", on: { click: function () {
          if (!kitChangeSlot(c, "kit" + v)) { TM.ui.toast("O " + lbl + " uniforme já foi trocado nesta temporada. Só na próxima."); return; }
          importImage(function (data) { c.kitOverrides = c.kitOverrides || {}; c.kitOverrides[v] = data; kitChangeUse(c, "kit" + v); applyKitOverrides(c); TM.storage.saveCoachCareer(c); TM.ui.toast("Uniforme " + lbl + " atualizado!"); TM.ui.go("coach-club-info", { clubId: clubId, back: back }); });
        } } }));
      }
      krow.appendChild(tile);
    });
    kitsCard.appendChild(krow);
    if (mine) kitsCard.appendChild(el("div", { class: "setting-hint", text: "Toque em Trocar para importar a imagem do uniforme do seu clube. Regra: cada uniforme só pode ser trocado UMA vez por temporada." }));
    body.appendChild(kitsCard);
    // escudo (uma troca por temporada)
    if (mine) {
      var canC = kitChangeSlot(c, "crest");
      body.appendChild(el("div", { class: "ci-card" }, [
        el("div", { class: "ci-ct", text: "🛡️ Escudo" }),
        el("div", { class: "ci-crest-row" }, [
          TM.img.clubImg(club, "ci-crest"),
          el("div", { class: "note-actions" }, [
            el("button", { class: "ci-kit-edit" + (canC ? "" : " locked"), text: canC ? "✏️ Trocar escudo" : "🔒 Trocado nesta temporada", on: { click: function () {
              if (!kitChangeSlot(c, "crest")) { TM.ui.toast("O escudo já foi trocado nesta temporada. Só na próxima."); return; }
              importImage(function (data) { c.crestOverride = data; kitChangeUse(c, "crest"); applyKitOverrides(c); TM.storage.saveCoachCareer(c); TM.ui.toast("Escudo atualizado!"); TM.ui.go("coach-club-info", { clubId: clubId, back: back }); }, 256);
            } } }),
            c.crestOverride ? el("button", { class: "ci-kit-edit", text: "↩ Escudo original", on: { click: function () { c.crestOverride = null; var cl1 = TM.data.club(c.teamId); if (cl1) delete cl1.crestData; TM.storage.saveCoachCareer(c); TM.ui.go("coach-club-info", { clubId: clubId, back: back }); } } }) : null
          ].filter(Boolean))
        ]),
        el("div", { class: "setting-hint", text: "O escudo só pode ser trocado UMA vez por temporada." })
      ]));
    }
  });

  /* ---------- competições ---------- */
  // id da imagem da competição conforme a aba
  function compIdFor(c, key) {
    if (key === "cup") return "cup-" + c.leagueId;
    if (key === "cont") return "cont-" + (C().REGION[c.leagueId] || "eu");
    if (key === "cont2") return "cont2-" + (C().REGION[c.leagueId] || "eu");
    if (key === "contPre") return "cont-" + (C().REGION[c.leagueId] || "eu");
    if (key === "mundial") return "cwc-world";
    if (key === "inter") return "cwc-inter";
    return "lg-" + c.leagueId;
  }
  TM.coachCompId = compIdFor;
  TM.ui.register("coach-comps", function (screen, params) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🏆 Competições", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-comps");
    var tabs = [ { key: "league", label: c.comps.league.name } ];
    if (c.comps.cup) tabs.push({ key: "cup", label: c.comps.cup.name });
    if (c.comps.contPre) tabs.push({ key: "contPre", label: c.comps.contPre.name });
    if (c.comps.cont) tabs.push({ key: "cont", label: c.comps.cont.name });
    if (c.comps.cont2) tabs.push({ key: "cont2", label: c.comps.cont2.name });
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
      el("div", { class: "ch-name", text: activeTab.label }),
      (active === "cont" && c.contVia) ? el("div", { class: "setting-hint", text: "Vaga conquistada como " + c.contVia + " na temporada passada." })
        : (active === "cont2" && c.cont2Via) ? el("div", { class: "setting-hint", text: "Vaga da continental secundária: " + c.cont2Via + " na temporada passada (zona do 7º ao 12º)." })
        : (active === "contPre" && c.contPreVia) ? el("div", { class: "setting-hint", text: "Fase pré: " + c.contPreVia + " na temporada passada. Quem passa entra na competição principal; quem cai vai para a secundária." }) : null
    ].filter(Boolean)));

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
    // ZONAS: o que cada posição vale (continental principal, secundária, acesso, rebaixamento)
    var nL = st.length, lgId = c.leagueId, REG = C().REGION[lgId] || "eu";
    var temCima = !!C().DIV_UP_MAP && !!C().DIV_UP_MAP[lgId], temBaixo = !!C().DIV_DOWN_MAP && !!C().DIV_DOWN_MAP[lgId];
    function compName(id, fb) { try { var cp = TM.data.competition(id); return (cp && cp.name) || fb; } catch (e) { return fb; } }
    var zonas = [];
    if (temCima) {
      zonas.push({ cls: "z-up", ate: 4, de: 1, lbl: "Acesso à " + ((TM.data.league(C().DIV_UP_MAP[lgId]) || {}).name || "divisão de cima"), ic: null, comp: "lg-" + C().DIV_UP_MAP[lgId] });
    } else {
      var nDir = 4, nPre = (C().CONT_PRE_N || 2);
      zonas.push({ cls: "z-cont", de: 1, ate: nDir, lbl: compName("cont-" + REG, "Continental"), comp: "cont-" + REG });
      zonas.push({ cls: "z-pre", de: nDir + 1, ate: nDir + nPre, lbl: "Fase pré da " + compName("cont-" + REG, "Continental"), comp: "cont-" + REG });
      zonas.push({ cls: "z-cont2", de: nDir + nPre + 1, ate: 12, lbl: compName("cont2-" + REG, "Continental II"), comp: "cont2-" + REG });
    }
    if (temBaixo) zonas.push({ cls: "z-releg", de: nL - 3, ate: nL, lbl: "Rebaixamento para a " + ((TM.data.league(C().DIV_DOWN_MAP[lgId]) || {}).name || "divisão de baixo"), comp: "lg-" + C().DIV_DOWN_MAP[lgId] });
    function zoneOf(pos) { for (var z = 0; z < zonas.length; z++) if (pos >= zonas[z].de && pos <= zonas[z].ate) return zonas[z]; return null; }

    st.forEach(function (row, i) {
      var club = TM.data.club(row.id);
      var z = zoneOf(i + 1), zona = z ? z.cls : "";
      tb.appendChild(el("tr", { class: (row.id === c.teamId ? "me " : "") + zona, title: z ? z.lbl : "" }, [
        el("td", { text: i + 1 }), el("td", { class: "lt-club" }, [ TM.img.clubImg(club, "lt-crest"), el("span", { text: club.name }) ]),
        el("td", { class: "lt-pts", text: row.pts }), el("td", { text: row.p }), el("td", { text: row.w }), el("td", { text: row.d }), el("td", { text: row.l }),
        el("td", { text: (row.gf - row.ga > 0 ? "+" : "") + (row.gf - row.ga) })
      ]));
    });
    table.appendChild(tb);
    screen.appendChild(el("div", { class: "table-wrap" }, [ table ]));
    if (zonas.length) {
      var key = el("div", { class: "zone-key" });
      zonas.forEach(function (z) {
        var logo = null; try { logo = TM.img.compImg(z.comp, "zk-logo"); } catch (e) {}
        key.appendChild(el("div", { class: "zk " + z.cls }, [
          el("span", { class: "zk-dot" }),
          logo, el("span", { class: "zk-pos", text: z.de === z.ate ? z.de + "º" : z.de + "º-" + z.ate + "º" }),
          el("span", { class: "zk-lbl", text: z.lbl })
        ].filter(Boolean)));
      });
      screen.appendChild(key);
    }
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
    screen.appendChild(TM.ui.topbar("🗂️ Currículo & Títulos", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" });

    // ---- currículo (resumo da carreira) ----
    var st = c.stats || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    var titles = { liga: 0, copa: 0, cont: 0, mundial: 0, inter: 0 };
    (c.honours || []).forEach(function (h) {
      if (h.leagueChampion) titles.liga++; if (h.cupChampion) titles.copa++;
      if (h.contChampion) titles.cont++; if (h.mundialChampion) titles.mundial++; if (h.interChampion) titles.inter++;
    });
    var totalTitles = titles.liga + titles.copa + titles.cont + titles.mundial + titles.inter;
    var anos = c.season || 1;
    var winPct = st.p ? Math.round(st.w / st.p * 100) : 0;
    function stat(v, lab) { return el("div", { class: "cv-stat" }, [ el("div", { class: "cv-num", text: v }), el("div", { class: "cv-lab", text: lab }) ]); }
    var natName = TM.data.club(c.teamId) ? TM.data.club(c.teamId).name : (c.teamName || "");
    body.appendChild(el("div", { class: "cv-card" }, [
      el("div", { class: "cv-head" }, [
        (c.coachPhoto ? el("img", { src: c.coachPhoto, class: "cv-ava" }) : el("div", { class: "cv-ava cv-ava-i", text: (c.coachName || "T").slice(0, 1).toUpperCase() })),
        el("div", {}, [ el("div", { class: "cv-name", text: c.coachName || "Treinador" }), el("div", { class: "cv-club", text: natName }) ])
      ]),
      el("div", { class: "cv-grid" }, [
        stat("🏆 " + totalTitles, "Títulos"),
        stat(anos, "Temporadas"),
        stat(st.p, "Jogos"),
        stat(winPct + "%", "Aproveit."),
        stat(st.w + "-" + st.d + "-" + st.l, "V-E-D"),
        stat((st.gf - st.ga >= 0 ? "+" : "") + (st.gf - st.ga), "Saldo")
      ]),
      totalTitles ? el("div", { class: "cv-titles" }, [
        titles.liga ? el("span", { class: "cv-tchip", text: "🏆 " + titles.liga + " Liga" + (titles.liga > 1 ? "s" : "") }) : null,
        titles.copa ? el("span", { class: "cv-tchip", text: "🏆 " + titles.copa + " Copa" + (titles.copa > 1 ? "s" : "") }) : null,
        titles.cont ? el("span", { class: "cv-tchip", text: "🏆 " + titles.cont + " Continental" }) : null,
        titles.mundial ? el("span", { class: "cv-tchip", text: "🌎 " + titles.mundial + " Mundial" }) : null,
        titles.inter ? el("span", { class: "cv-tchip", text: "🌍 " + titles.inter + " Interc." }) : null
      ]) : null
    ]));
    body.appendChild(el("div", { class: "list-head", text: "Histórico por temporada" }));
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

  /* ---------- APOSENTADORIA: retrospectiva da carreira ---------- */
  TM.ui.register("coach-retire", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("modes"); return; }
    var hon = c.honours || [];
    var trophies = 0, leagueT = 0, cupT = 0, contT = 0, mundT = 0;
    hon.forEach(function (h) {
      if (h.leagueChampion) { trophies++; leagueT++; }
      if (h.cupChampion) { trophies++; cupT++; }
      if (h.contChampion) { trophies++; contT++; }
      if (h.mundialChampion) { trophies++; mundT++; }
      if (h.interChampion) { trophies++; }
    });
    // clubes comandados (histórico + atual)
    var clubs = (c.clubHistory || []).map(function (h) { return h.clubName; });
    if (c.teamName && clubs.indexOf(c.teamName) < 0) clubs.push(c.teamName);
    var cs = c.careerStats || { p: 0, w: 0 };
    var rep = C().computeReputation(c);
    var repLbl = C().reputationLabel(rep);
    var aprov = cs.p ? Math.round(cs.w / cs.p * 100) : 0;

    screen.appendChild(TM.ui.topbar("👔 Fim de uma era", function () { TM.ui.go("coach-hub"); }));
    var wrap = el("div", { class: "retire-wrap" });
    screen.appendChild(wrap);

    var verdict = trophies >= 10 ? "Uma LENDA se aposenta. Seu nome fica eternizado na história do futebol." :
      trophies >= 4 ? "Uma carreira vitoriosa e respeitada chega ao fim. Muitos troféus, muitas histórias." :
      trophies >= 1 ? "Uma trajetória digna, com conquistas que ficam na memória da torcida." :
      "O apito final. Nem sempre vieram os títulos, mas a paixão pelo jogo esteve sempre presente.";

    wrap.appendChild(el("div", { class: "retire-hero" }, [
      el("div", { class: "rh-emoji", text: trophies >= 4 ? "🏆" : "👔" }),
      el("div", { class: "rh-name", text: c.coachName || "Treinador" }),
      el("div", { class: "rh-rep", text: "Reputação final: " + rep + " · " + repLbl }),
      el("div", { class: "rh-verdict", text: verdict })
    ]));

    wrap.appendChild(el("div", { class: "retire-grid" }, [
      rtile(c.season, "Temporadas"), rtile(clubs.length, "Clubes"), rtile(trophies, "Troféus"),
      rtile(cs.p, "Jogos"), rtile(cs.w, "Vitórias"), rtile(aprov + "%", "Aproveitamento")
    ]));

    // vitrine de títulos
    if (trophies) {
      var tc = el("div", { class: "retire-titles" }, [ el("div", { class: "rt-h", text: "🏅 Galeria de Títulos" }) ]);
      if (leagueT) tc.appendChild(rtRow("🏆 Ligas nacionais", leagueT));
      if (cupT) tc.appendChild(rtRow("🏆 Copas nacionais", cupT));
      if (contT) tc.appendChild(rtRow("🌎 Continentais", contT));
      if (mundT) tc.appendChild(rtRow("🌍 Mundiais", mundT));
      wrap.appendChild(tc);
    }

    // passagens
    var pc = el("div", { class: "retire-titles" }, [ el("div", { class: "rt-h", text: "🗂️ Clubes que comandou" }) ]);
    clubs.forEach(function (nm) { pc.appendChild(el("div", { class: "rt-club", text: "• " + nm })); });
    wrap.appendChild(pc);

    wrap.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Encerrar carreira", function () {
        TM.saves && TM.saves.park && TM.saves.park("coach");
        TM.storage.clearCoachCareer(); TM.ui.go("modes");
      }, "btn primary big"),
      TM.ui.button("Voltar (continuar jogando)", function () { TM.ui.go("coach-hub"); }, "btn ghost")
    ]));

    function rtile(v, l) { return el("div", { class: "rtile" }, [ el("div", { class: "rt-v", text: v }), el("div", { class: "rt-l", text: l }) ]); }
    function rtRow(l, n) { return el("div", { class: "rt-row" }, [ el("span", { text: l }), el("span", { class: "rt-n", text: "×" + n }) ]); }
  });

  /* ---------- Seleção da Semana (Time da Rodada) ---------- */
  TM.ui.register("coach-totw", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    var round = (c.comps && c.comps.league) ? c.comps.league.round : (c.season || 1);
    screen.appendChild(TM.ui.topbar("🌟 Seleção da Semana", function () { TM.ui.go("coach-hub"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Os destaques da Rodada " + round + " da " + TM.data.league(c.leagueId).name + "." }));

    // pontuação determinística por rodada
    var seed = round * 9301 + 49297;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; }
    var lg = TM.data.league(c.leagueId);
    var pool = [];
    lg.clubIds.forEach(function (cid) {
      TM.data.clubPlayers(cid).forEach(function (p) {
        pool.push({ p: p, cid: cid, score: p.overall + rnd() * 8 });
      });
    });
    // monta um 4-3-3 pegando os melhores por grupo
    function topBy(group, n) {
      return pool.filter(function (x) { return x.p.pos === group; }).sort(function (a, b) { return b.score - a.score; }).slice(0, n);
    }
    var xi = topBy("GK", 1).concat(topBy("DF", 4)).concat(topBy("MF", 3)).concat(topBy("FW", 3));
    var slots = C().FORMATIONS["4-3-3"] || C().FORMATIONS["4-4-2"];

    var pitch = el("div", { class: "pitch totw-pitch" });
    pitch.appendChild(el("div", { class: "pitch-mark center-circle" }));
    pitch.appendChild(el("div", { class: "pitch-mark mid-line" }));
    xi.forEach(function (x, i) {
      var slot = slots[i] || [null, 50, 50];
      var mine = x.cid === c.teamId;
      var chip = el("div", { class: "pl-chip totw-chip" + (mine ? " mine" : ""), style: "left:" + slot[1] + "%;top:" + slot[2] + "%" },
        TM.ui.chipKids(x.p, slot, { name: shortName(x.p.name) }));
      var club = TM.data.club(x.cid);
      chip.appendChild(el("span", { class: "totw-club", text: club.short || club.name.slice(0, 3).toUpperCase() }));
      pitch.appendChild(chip);
    });
    body.appendChild(pitch);
    var mineCount = xi.filter(function (x) { return x.cid === c.teamId; }).length;
    body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: mineCount ? ("🎉 " + mineCount + " jogador(es) do seu time na seleção da rodada!") : "Nenhum jogador seu desta vez — corra atrás na próxima rodada." }));
  });

  /* ---------- elenco ---------- */
  // Raio-X do elenco: médias, força por setor, destaques e alertas de profundidade
  function squadXray(c, players) {
    function avg(arr, f) { return arr.length ? arr.reduce(function (s, p) { return s + f(p); }, 0) / arr.length : 0; }
    function sectorTop(pos, n) {
      return players.filter(function (p) { return p.pos === pos; }).sort(function (a, b) { return b.overall - a.overall; }).slice(0, n);
    }
    function sectorForce(pos, n) { var t = sectorTop(pos, n); return t.length ? Math.round(avg(t, function (p) { return p.overall; })) : 0; }
    var ovAvg = Math.round(avg(players, function (p) { return p.overall; }));
    var ageAvg = Math.round(avg(players, function (p) { return p.age || 24; }) * 10) / 10;
    var totalVal = players.reduce(function (s, p) { return s + (TM.data.marketValue(p) || 0); }, 0);
    // força por setor
    var sectors = [
      { key: "GK", label: "Goleiro", f: sectorForce("GK", 1) },
      { key: "DF", label: "Defesa", f: sectorForce("DF", 4) },
      { key: "MF", label: "Meio", f: sectorForce("MF", 3) },
      { key: "FW", label: "Ataque", f: sectorForce("FW", 3) }
    ];
    // destaques
    var byOv = players.slice().sort(function (a, b) { return b.overall - a.overall; });
    var craque = byOv[0];
    var promessa = players.slice().filter(function (p) { return (p.age || 24) <= 21; })
      .sort(function (a, b) { return ((b.potential || b.overall) - b.overall) - ((a.potential || a.overall) - a.overall) || (b.potential || 0) - (a.potential || 0); })[0];
    var veterano = players.slice().sort(function (a, b) { return (b.age || 0) - (a.age || 0); })[0];
    // profundidade
    var counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    players.forEach(function (p) { counts[p.pos] = (counts[p.pos] || 0) + 1; });
    var need = { GK: 2, DF: 5, MF: 4, FW: 3 }, alerts = [];
    Object.keys(need).forEach(function (k) { if ((counts[k] || 0) < need[k]) alerts.push({ k: k, have: counts[k] || 0, need: need[k] }); });

    var wrap = el("div", { class: "panel-narrow xray" });
    // tiles resumo
    wrap.appendChild(el("div", { class: "xray-tiles" }, [
      xTile("Overall médio", ovAvg, "🎯"),
      xTile("Idade média", ageAvg, "🎂"),
      xTile("Jogadores", players.length, "👥"),
      xTile("Valor do plantel", money(c, totalVal), "💰")
    ]));
    // estatísticas do TIME na temporada
    var st = c.stats || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    var apr = st.p ? Math.round(st.w * 3 + st.d) / (st.p * 3) * 100 : 0;
    wrap.appendChild(el("div", { class: "xray-season" }, [
      el("div", { class: "xray-h", text: "📊 Temporada " + (c.season || 1) },),
      el("div", { class: "xs-grid" }, [
        xsCell("Jogos", st.p), xsCell("Vitórias", st.w, "ok"), xsCell("Empates", st.d), xsCell("Derrotas", st.l, "bad"),
        xsCell("Gols pró", st.gf), xsCell("Gols contra", st.ga), xsCell("Saldo", (st.gf - st.ga >= 0 ? "+" : "") + (st.gf - st.ga)), xsCell("Aprov.", Math.round(apr) + "%")
      ])
    ]));
    // barras de setor
    var bars = el("div", { class: "xray-sectors" }, [ el("div", { class: "xray-h", text: "🧭 Força por setor" }) ]);
    sectors.forEach(function (s) {
      var pct = Math.max(4, Math.min(100, (s.f - 40) / 59 * 100));
      var cls = s.f >= 82 ? "hi" : s.f >= 74 ? "mid" : "lo";
      bars.appendChild(el("div", { class: "xsec" }, [
        el("span", { class: "xsec-lbl", text: s.label }),
        el("span", { class: "xsec-bar" }, [ el("span", { class: "xsec-fill " + cls, style: "width:" + pct + "%" }) ]),
        el("span", { class: "xsec-val", text: s.f || "—" })
      ]));
    });
    wrap.appendChild(bars);
    // destaques
    var hi = el("div", { class: "xray-highs" });
    if (craque) hi.appendChild(xHigh("⭐ Craque", craque, craque.overall + " OVR"));
    if (promessa) hi.appendChild(xHigh("💎 Promessa", promessa, "pot. " + (promessa.potential || promessa.overall)));
    if (veterano) hi.appendChild(xHigh("🧓 Veterano", veterano, (veterano.age || "?") + " anos"));
    wrap.appendChild(hi);
    // alertas de profundidade
    if (alerts.length) {
      var al = el("div", { class: "xray-alert" }, [ el("span", { class: "xa-ic", text: "⚠️" }),
        el("span", { text: "Pouca profundidade: " + alerts.map(function (a) { return ({ GK: "gols", DF: "zaga", MF: "meio", FW: "ataque" })[a.k] + " (" + a.have + "/" + a.need + ")"; }).join(", ") + ". Considere reforços no mercado." }) ]);
      al.addEventListener("click", function () { TM.ui.go("coach-market"); });
      al.classList.add("clickable");
      wrap.appendChild(al);
    }
    return wrap;
  }
  function xTile(label, val, ic) { return el("div", { class: "xtile" }, [ el("div", { class: "xt-ic", text: ic }), el("div", { class: "xt-val", text: String(val) }), el("div", { class: "xt-lbl", text: label }) ]); }
  function xsCell(label, val, tone) { return el("div", { class: "xs-cell" }, [ el("div", { class: "xs-v" + (tone ? " xs-" + tone : ""), text: String(val) }), el("div", { class: "xs-l", text: label }) ]); }
  function xHigh(tag, p, meta) {
    return el("div", { class: "xhigh" }, [
      TM.img.playerImg(p, "xh-face"),
      el("div", { class: "xh-info" }, [ el("div", { class: "xh-tag", text: tag }), el("div", { class: "xh-name", text: p.name }), el("div", { class: "xh-meta", text: TM.data.posLabel(p) + " · " + meta }) ])
    ]);
  }

  TM.ui.register("coach-squad", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("👥 Central do Elenco", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-squad");
    var players = C().userSquad(c);
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    players.sort(function (a, b) { return order[a.pos] - order[b.pos] || b.overall - a.overall; });
    screen.appendChild(squadXray(c, players));
    screen.appendChild(el("div", { class: "setting-hint", style: "max-width:620px", text: "Toque num jogador para ver detalhes. Use “Listar” para colocá-lo na lista de transferências (recebe mais propostas)." }));
    var list = el("div", { class: "panel-narrow squad-list" });
    var lastPos = null;
    c.transferList = c.transferList || [];
    players.forEach(function (p) {
      if (p.pos !== lastPos) { list.appendChild(el("div", { class: "pos-header", text: ({ GK: "Goleiros", DF: "Defensores", MF: "Meio-campistas", FW: "Atacantes" })[p.pos] })); lastPos = p.pos; }
      var row = TM.ui.playerRow(p, { onClick: function (pl) { TM.coachUI.openPlayer(pl, TM.ui.current()); } });
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
  function mktDefault() { return { q: "", pos: "", pos2: "", nat: "", region: "", league: "", club: "", age: 40, ageMin: 15, ovMin: 0, potMin: 0, valMax: 0, affordable: false, free: false, scouted: false, ending: false, sort: "ov", limit: 60 }; }
  var MKT = mktDefault();
  TM.ui.register("coach-market", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🔁 Mercado", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-market");
    screen.appendChild(el("div", { class: "market-budget", text: "💰 Orçamento: " + money(c, c.budget) }));
    if (TM.fin && TM.fin.banned(c)) screen.appendChild(el("div", { class: "fin-ban", text: TM.fin.banLabel(c) + " · vendas liberadas" }));
    if ((c.pendingArrivals || []).length) screen.appendChild(el("div", { class: "fin-ban warn", text: "⏳ " + c.pendingArrivals.map(function (a) { return a.name + (a.pre ? " (pré-contrato, próxima temporada)" : ""); }).join(", ") + " — chega" + (c.pendingArrivals.length > 1 ? "m" : "") + " " + (c.pendingArrivals.every(function (a) { return a.pre; }) ? "no início da próxima temporada" : nextWinTxt(c)) + "." }));

    var world = TM.data.world();
    var rosterSet = {}; c.roster.forEach(function (id) { rosterSet[id] = true; });

    // ---- radar do olheiro: setor mais carente do elenco ----
    var GROUP_LBL = { GK: "goleiro", DF: "defesa", MF: "meio-campo", FW: "ataque" };
    (function scoutTip() {
      try {
        var cnt = { GK: 0, DF: 0, MF: 0, FW: 0 }, best = { GK: 0, DF: 0, MF: 0, FW: 0 };
        C().rosterPlayers(c).forEach(function (p) { var g = (p.pos in cnt) ? p.pos : "MF"; cnt[g]++; if (p.overall > best[g]) best[g] = p.overall; });
        var need = { GK: 3, DF: 8, MF: 8, FW: 5 }, worst = null, worstScore = -99;
        ["GK", "DF", "MF", "FW"].forEach(function (g) { var s = (need[g] - cnt[g]) * 2 + (best[g] < (TM.data.clubRating(c.teamId) - 3) ? 3 : 0); if (s > worstScore) { worstScore = s; worst = g; } });
        var msg = worstScore > 0
          ? "🔍 Olheiros recomendam reforçar o " + GROUP_LBL[worst] + " — é o setor mais carente do elenco."
          : "🔍 Elenco equilibrado. Busque oportunidades de mercado para elevar o nível.";
        var tipOpts = { class: "scout-tip" };
        if (worstScore > 0) tipOpts.on = { click: function () { MKT.pos = worst; MKT.sort = "ov"; TM.ui.go("coach-market"); } };
        var tip = el("div", tipOpts, [
          el("span", { class: "scout-tip-tx", text: msg }),
          worstScore > 0 ? el("span", { class: "scout-tip-go", text: "ver " + worst + " →" }) : null
        ]);
        screen.appendChild(tip);
      } catch (e) {}
    })();

    // ---- filtros rápidos (chips) ----
    var chipRow = el("div", { class: "mkt-chips" });
    function chip(label, active, fn) { return el("button", { class: "mkt-chip" + (active ? " on" : ""), text: label, on: { click: fn } }); }
    var isProm = MKT.potMin >= 78 && MKT.age <= 21, isStar = MKT.ovMin >= 82, isCheap = MKT.valMax > 0 && MKT.valMax <= 12;
    chipRow.appendChild(chip("💎 Promessas", isProm, function () { MKT.potMin = 78; MKT.age = 21; MKT.ageMin = 15; MKT.ovMin = 0; MKT.sort = "pot"; MKT.free = false; TM.ui.go("coach-market"); }));
    chipRow.appendChild(chip("⭐ Estrelas", isStar, function () { MKT.ovMin = 82; MKT.potMin = 0; MKT.age = 40; MKT.sort = "ov"; MKT.free = false; TM.ui.go("coach-market"); }));
    chipRow.appendChild(chip("🆓 Livres", MKT.free, function () { MKT.free = !MKT.free; TM.ui.go("coach-market"); }));
    chipRow.appendChild(chip("💰 Baratos", isCheap, function () { MKT.valMax = 12; MKT.sort = "ov"; MKT.ovMin = 0; MKT.age = 40; MKT.free = false; TM.ui.go("coach-market"); }));
    chipRow.appendChild(chip("💵 No orçamento", MKT.affordable, function () { MKT.affordable = !MKT.affordable; TM.ui.go("coach-market"); }));
    chipRow.appendChild(chip("🔭 Indicados", MKT.scouted, function () { MKT.scouted = !MKT.scouted; TM.ui.go("coach-market"); }));
    chipRow.appendChild(chip("📝 Fim de contrato", MKT.ending, function () { MKT.ending = !MKT.ending; MKT.free = false; TM.ui.go("coach-market"); }));
    chipRow.appendChild(chip("🕵️ Olheiros", false, function () { TM.ui.go("coach-scouting", { from: "coach-market" }); }));
    chipRow.appendChild(chip("📰 Negócios", false, function () { TM.ui.go("coach-market-feed"); }));
    screen.appendChild(chipRow);

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
    // posição detalhada (LD, ZAG, VOL, MEI, PE, CA...)
    var pos2Sel = el("select", { class: "select" });
    pos2Sel.appendChild(el("option", { value: "", text: "Função específica: qualquer" }));
    [["GOL", "Goleiro"], ["LD", "Lateral direito"], ["LE", "Lateral esquerdo"], ["ZAG", "Zagueiro"], ["VOL", "Volante"], ["MC", "Meio-campo central"], ["MEI", "Meia armador"], ["PD", "Ponta direita"], ["PE", "Ponta esquerda"], ["SA", "Segundo atacante"], ["CA", "Centroavante"]].forEach(function (o) {
      var op = el("option", { value: o[0], text: o[1] }); if (MKT.pos2 === o[0]) op.selected = true; pos2Sel.appendChild(op);
    });
    pos2Sel.addEventListener("change", function () { MKT.pos2 = pos2Sel.value; renderResults(); });
    panel.appendChild(pos2Sel);

    // ordenação
    var sortRow = el("div", { class: "segmented full" });
    [["ov", "Overall"], ["pot", "Potencial"], ["val", "Mais caros"], ["valasc", "Mais baratos"], ["age", "Mais jovens"], ["name", "Nome"]].forEach(function (o) {
      sortRow.appendChild(el("button", { class: "seg-btn" + (MKT.sort === o[0] ? " active" : ""), text: o[1], on: { click: function () { MKT.sort = o[0]; sortRow.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); this.classList.add("active"); renderResults(); } } }));
    });
    panel.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Ordenar por" }), sortRow ]));

    // país
    var natSel = el("select", { class: "select" });
    natSel.appendChild(el("option", { value: "", text: "Todos os países" }));
    world.nations.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (n) { var o = el("option", { value: n.id, text: n.name }); if (MKT.nat === n.id) o.selected = true; natSel.appendChild(o); });
    natSel.addEventListener("change", function () { MKT.nat = natSel.value; renderResults(); });

    // região + liga + clube
    var REG = (TM.scouting && TM.scouting.REGIONS) || {}, REG_ORDER = (TM.scouting && TM.scouting.REGION_ORDER) || [];
    var regionSel = el("select", { class: "select" });
    regionSel.appendChild(el("option", { value: "", text: "Todas as regiões" }));
    REG_ORDER.forEach(function (r) { var o = el("option", { value: r, text: REG[r].label }); if (MKT.region === r) o.selected = true; regionSel.appendChild(o); });
    var leagueSel = el("select", { class: "select" });
    function fillLeagues() {
      TM.ui.clear(leagueSel); leagueSel.appendChild(el("option", { value: "", text: "Todas as ligas" }));
      world.leagues.filter(function (lg) { return !MKT.region || !REG[MKT.region] || REG[MKT.region].leagues.indexOf(lg.id) >= 0; })
        .forEach(function (lg) { var o = el("option", { value: lg.id, text: lg.name }); if (MKT.league === lg.id) o.selected = true; leagueSel.appendChild(o); });
    }
    var clubSel = el("select", { class: "select" });
    function fillClubs() {
      TM.ui.clear(clubSel); clubSel.appendChild(el("option", { value: "", text: "Todos os clubes" }));
      var L = MKT.league ? TM.data.league(MKT.league) : null;
      if (L) L.clubIds.map(TM.data.club).filter(Boolean).sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (cl) { var o = el("option", { value: cl.id, text: cl.name }); if (MKT.club === cl.id) o.selected = true; clubSel.appendChild(o); });
    }
    regionSel.addEventListener("change", function () { MKT.region = regionSel.value; MKT.league = ""; MKT.club = ""; fillLeagues(); fillClubs(); renderResults(); });
    leagueSel.addEventListener("change", function () { MKT.league = leagueSel.value; MKT.club = ""; fillClubs(); renderResults(); });
    clubSel.addEventListener("change", function () { MKT.club = clubSel.value; renderResults(); });
    fillLeagues(); fillClubs();
    panel.appendChild(el("div", { class: "filter-grid" }, [ natSel, regionSel, leagueSel, clubSel ]));

    // sliders
    function slider(label, key, min, max, suffix) {
      var val = el("span", { class: "range-val", text: MKT[key] + (suffix || "") });
      var inp = el("input", { type: "range", min: min, max: max, value: MKT[key], class: "slider" });
      inp.addEventListener("input", function () { MKT[key] = parseInt(inp.value, 10); val.textContent = MKT[key] + (suffix || ""); renderResults(); });
      return el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode(label), val ]), inp ]);
    }
    panel.appendChild(slider("Idade mínima", "ageMin", 15, 40, " anos"));
    panel.appendChild(slider("Idade máxima", "age", 17, 40, " anos"));
    panel.appendChild(slider("Overall mínimo", "ovMin", 0, 95, ""));
    panel.appendChild(slider("Potencial mínimo", "potMin", 0, 95, ""));
    // valor máximo (0 = sem limite)
    (function () {
      var val = el("span", { class: "range-val", text: MKT.valMax ? MKT.valMax + " M" : "sem limite" });
      var inp = el("input", { type: "range", min: 0, max: 200, step: 5, value: MKT.valMax || 0, class: "slider" });
      inp.addEventListener("input", function () { MKT.valMax = parseInt(inp.value, 10); val.textContent = MKT.valMax ? MKT.valMax + " M" : "sem limite"; renderResults(); });
      panel.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode("Valor máximo "), val ]), inp ]));
    })();
    // só o que cabe no orçamento
    var affToggle = el("button", { class: "switch" + (MKT.affordable ? " on" : ""), on: { click: function () { MKT.affordable = !MKT.affordable; affToggle.classList.toggle("on", MKT.affordable); renderResults(); } } }, [ el("span", { class: "switch-knob" }) ]);
    panel.appendChild(el("div", { class: "setting row" }, [ el("div", { class: "setting-label", text: "💰 Só dentro do orçamento" }), affToggle ]));

    panel.appendChild(el("button", { class: "btn ghost", text: "Limpar filtros", on: { click: function () { MKT = mktDefault(); TM.ui.go("coach-market"); } } }));

    var results = el("div", { class: "panel-narrow" });
    screen.appendChild(results);

    function renderResults() {
      TM.ui.clear(results);
      try { renderResultsInner(); } catch (e) { results.appendChild(el("p", { class: "intro-text", text: "Erro ao filtrar: " + (e && e.message ? e.message : e) })); }
    }
    function renderResultsInner() {
      var pool;
      if (MKT.free) pool = (world.freeAgents || []).map(TM.data.player).filter(Boolean);
      else pool = Object.keys(world.playersById).map(function (id) { return world.playersById[id]; }).filter(function (p) { return p && !p.freeAgent && !rosterSet[p.id] && p.clubId && TM.data.club(p.clubId); });
      var q = MKT.q.trim().toLowerCase();
      var qn = q ? q.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
      var regLeagues = null; if (MKT.region && REG[MKT.region]) { regLeagues = {}; REG[MKT.region].leagues.forEach(function (l) { regLeagues[l] = 1; }); }
      var list = pool.filter(function (p) {
        if (q) { var nm = (p.name || "").toLowerCase(); if (nm.indexOf(q) < 0 && nm.normalize("NFD").replace(/[\u0300-\u036f]/g, "").indexOf(qn) < 0) return false; }
        if (MKT.pos && p.pos !== MKT.pos) return false;
        if (MKT.pos2 && (p.pos2 || "") !== MKT.pos2) return false;
        if (MKT.nat && p.nationId !== MKT.nat) return false;
        var cl = (p.clubId && p.clubId !== "free") ? TM.data.club(p.clubId) : null;
        if (MKT.league && (!cl || cl.leagueId !== MKT.league)) return false;
        if (regLeagues && (!cl || !regLeagues[cl.leagueId])) return false;
        if (MKT.club && p.clubId !== MKT.club) return false;
        if ((p.age || 0) > MKT.age) return false;
        if (MKT.ageMin && (p.age || 0) < MKT.ageMin) return false;
        if ((p.overall || 0) < MKT.ovMin) return false;
        if ((p.potential || p.overall || 0) < MKT.potMin) return false;
        if (MKT.valMax && TM.data.marketValue(p) > MKT.valMax) return false;
        if (MKT.affordable && curVal(c, askingPrice(p)) > (c.budget || 0)) return false;
        if (MKT.scouted && !(TM.scouting && TM.scouting.isScouted(c, p.id))) return false;
        if (MKT.ending && !(TM.fin && TM.fin.endingContract(p, c))) return false;
        return true;
      }).sort(function (a, b) {
        if (MKT.sort === "pot") return (b.potential || b.overall) - (a.potential || a.overall) || b.overall - a.overall;
        if (MKT.sort === "val") return TM.data.marketValue(b) - TM.data.marketValue(a);
        if (MKT.sort === "valasc") return TM.data.marketValue(a) - TM.data.marketValue(b) || b.overall - a.overall;
        if (MKT.sort === "age") return (a.age || 0) - (b.age || 0) || b.overall - a.overall;
        if (MKT.sort === "name") return (a.name || "").localeCompare(b.name || "");
        return b.overall - a.overall || (b.potential || 0) - (a.potential || 0);
      });
      var total = list.length; list = list.slice(0, MKT.limit || 60);

      results.appendChild(el("div", { class: "results-count", text: total + " jogador(es)" + (total > list.length ? " · mostrando " + list.length : "") + (MKT.free ? " — passe livre (contrate só negociando com o jogador, sem custo de transferência)" : "") }));
      if (!total) { results.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador com esses filtros." })); return; }
      c.shortlist = c.shortlist || [];
      list.forEach(function (p) {
        var row = TM.ui.playerRow(p, { showClub: true });
        row.classList.add("clickable");
        if (TM.scouting && TM.scouting.isScouted(c, p.id)) { var nmEl = row.querySelector(".prow-name, .pr-name"); (nmEl || row).appendChild(el("span", { class: "mkt-scouted", text: "🔭 indicado" })); }
        if (!p.freeAgent && TM.fin && TM.fin.endingContract(p, c)) { var nmEl2 = row.querySelector(".prow-name, .pr-name"); (nmEl2 || row).appendChild(el("span", { class: "mkt-scouted ending", text: "📝 fim de contrato" })); }
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
      if (total > list.length) results.appendChild(TM.ui.button("Mostrar mais (" + (total - list.length) + ")", function () { MKT.limit = (MKT.limit || 60) + 60; renderResults(); }, "btn ghost mkt-more"));
    }
    renderResults();
  });

  /* ---------- 📰 negócios do mercado: transferências entre os outros clubes ---------- */
  TM.ui.register("coach-market-feed", function (screen) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    screen.appendChild(TM.ui.topbar("📰 Negócios do mercado", function () { TM.ui.go("coach-market"); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    var feed = (c.marketFeed || []);
    var open = C().windowOpenNow(c);
    body.appendChild(el("div", { class: "market-budget", text: (open ? "🟢 Janela aberta" : "🔴 Janela fechada") + " · " + feed.length + " movimentações registradas" }));
    if (!feed.length) { body.appendChild(el("p", { class: "intro-text", text: "Nenhuma transferência registrada ainda. Durante as janelas os outros clubes negociam entre si — cada dia que passa gera negócios (e o fim da janela é um frenesi)." })); return; }
    var bySeason = {}; feed.forEach(function (m) { var k = m.season || 1; (bySeason[k] = bySeason[k] || []).push(m); });
    Object.keys(bySeason).sort(function (a, b) { return b - a; }).forEach(function (sk) {
      body.appendChild(el("h3", { class: "section-title", text: "Temporada " + sk }));
      bySeason[sk].forEach(function (mv) {
        var ic = mv.kind === "fire" ? "🚨" : mv.kind === "free" ? "✍️" : "🔁";
        var toCl = TM.data.club(mv.toId), fromCl = mv.fromId && mv.fromId !== "free" ? TM.data.club(mv.fromId) : null;
        var feeTxt = mv.kind === "free" ? "Livre" : money(c, curVal(c, mv.val || 0));
        var dtx = ""; try { dtx = C().dateOf(c, mv.day || 0).short; } catch (e) {}
        var row = el("div", { class: "feed-mv" }, [
          (TM.img && TM.img.clubImg && toCl) ? TM.img.clubImg(toCl, "cr-mvcrest") : el("span", { class: "cr-mvcrest" }),
          el("div", { class: "feed-mid" }, [
            el("div", { class: "feed-name" }, [ el("span", { text: ic + " " + mv.name + " " }), el("span", { class: "cr-mvov", text: mv.ov }) ]),
            el("div", { class: "feed-sub", text: (fromCl ? fromCl.name : (mv.fromName || "sem clube")) + " → " + (toCl ? toCl.name : mv.toName) + (dtx ? " · " + dtx : "") })
          ]),
          el("div", { class: "feed-fee" + (mv.kind === "fire" ? " fire" : ""), text: feeTxt })
        ]);
        var pl = mv.pid ? TM.data.player(mv.pid) : null;
        if (pl) { row.classList.add("clickable"); row.addEventListener("click", function () { openPlayerProfile(pl, "coach-market-feed"); }); }
        body.appendChild(row);
      });
    });
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
  function askingPrice(p) { return Math.max(0.1, r2(TM.data.marketValue(p) * 1.3)); }
  function wageDemand(p) { return Math.max(0.05, r2(TM.data.marketValue(p) * 0.15)); }
  // EMPRESÁRIOS: cada jogador tem um agente que influencia salário e cobra comissão
  var AGENT_NAMES = ["Jorge Vendas", "R. Pimenta", "V. Struth", "K. Joorab", "F. Pastorello", "G. Bertolucci", "C. Leão", "André Cury", "Mino R.", "P. Zorc"];
  var AGENT_TYPES = [
    { type: "greedy", label: "Empresário durão", ic: "💼", wageMult: 1.35, feePct: 10, line: "Meu cliente é caro. Prepare o cheque." },
    { type: "normal", label: "Empresário", ic: "🤝", wageMult: 1.10, feePct: 6, line: "Vamos conversar, mas o salário tem que ser justo." },
    { type: "loyal", label: "Empresário parceiro", ic: "🫱", wageMult: 0.95, feePct: 4, line: "Meu cliente quer jogar no seu projeto. Facilito o acordo." }
  ];
  function agentOf(p) {
    var h = phash("agent:" + p.id);
    var t = AGENT_TYPES[h % 3];
    return { name: AGENT_NAMES[h % AGENT_NAMES.length], type: t.type, label: t.label, ic: t.ic, wageMult: t.wageMult, feePct: t.feePct, line: t.line };
  }
  // REPOSICIONAMENTO (retrain)
  var POS_LABELS = { GK: "Goleiro", DF: "Defensor", MF: "Meio-campo", FW: "Atacante" };
  function posGroupOf(p) { var g = p && p.pos; return (g === "GK" || g === "DF" || g === "MF" || g === "FW") ? g : "MF"; }
  // avança o treino de reposicionamento dos titulares que jogaram; ao concluir, muda a posição
  function tickRetrain(c, starterIds) {
    if (!c.retrain) return;
    c.posOverride = c.posOverride || {};
    (starterIds || []).forEach(function (id) {
      var rt = c.retrain[id]; if (!rt) return;
      rt.prog = (rt.prog || 0) + 1;
      if (rt.prog >= 8) {
        var pl = C().resolvePlayer(c, id); if (pl) { pl.pos2 = pl.pos; pl.pos = rt.toPos; c.posOverride[id] = rt.toPos; }
        delete c.retrain[id];
        TM.notify.push(c, { icon: "🔧", title: "Nova posição dominada", news: true, text: (pl ? pl.name : "Jogador") + " concluiu o reposicionamento e agora joga como " + POS_LABELS[rt.toPos] + "." });
      }
    });
  }
  function applyPosOverrides(c) {
    if (!c.posOverride) return;
    Object.keys(c.posOverride).forEach(function (id) { var pl = null; try { pl = C().resolvePlayer(c, id); } catch (e) {} if (pl) pl.pos = c.posOverride[id]; });
  }
  // PRESSÃO POR CLÁSSICOS: perder 3 clássicos seguidos gera crise mesmo indo bem na liga
  function trackClassico(c, oppId, gf, ga) {
    try { if (!rivalryEnabled() || !oppId || !TM.data.areRivals(c.teamId, oppId)) return; } catch (e) { return; }
    var res = gf > ga ? "W" : gf < ga ? "L" : "D";
    c.classicoLoss = res === "L" ? (c.classicoLoss || 0) + 1 : 0;
    if (c.classicoLoss >= 3) {
      c.classicoLoss = 0;
      c.boardTrust = Math.max(0, (c.boardTrust == null ? 50 : c.boardTrust) - 3);
      try { if (TM.social && TM.social.nudgeMorale) TM.social.nudgeMorale(c, -18); } catch (e) {}
      TM.notify.push(c, { icon: "💀", title: "Crise nos clássicos", news: true, text: "Três clássicos perdidos seguidos! A torcida está revoltada e a diretoria pressiona — mesmo com boa campanha na liga, o clima é de crise." });
    } else if (res === "W") {
      try { if (TM.social && TM.social.nudgeMorale) TM.social.nudgeMorale(c, 8); } catch (e) {}
    }
  }
  // POPULARIDADE MUNDIAL do clube (cresce com bom desempenho; clube pequeno pode virar gigante)
  function ensurePopularity(c) {
    if (c.popularity == null) { var r = 70; try { r = TM.data.clubRating(c.teamId); } catch (e) {} c.popularity = Math.max(5, Math.min(72, r - 28)); }
    return c.popularity;
  }
  function popularityLabel(v) { return v >= 85 ? "Fenômeno global" : v >= 68 ? "Grande clube mundial" : v >= 50 ? "Clube reconhecido" : v >= 32 ? "Em ascensão" : v >= 16 ? "Clube regional" : "Clube modesto"; }
  // DIRETORIA DINÂMICA no meio da temporada: muda a meta ou cobra resultados
  function maybeBoardObjectiveShift(c) {
    var mn = c.matchNo || 0;
    if (mn < 6) return;
    if (c._objShiftAt != null && mn - c._objShiftAt < 6) return;
    var pos; try { pos = C().currentPosition(c); } catch (e) { return; }
    if (!pos) return;
    var target = (c.objective && c.objective.maxPos) || 10;
    if (pos <= Math.max(1, target - 3) && target > 2) {
      c._objShiftAt = mn;
      var nt = Math.max(2, target - 2);
      c.objective = { desc: nt <= 2 ? "Brigar pelo título da liga" : "Terminar entre os " + nt + " primeiros", maxPos: nt };
      TM.notify.push(c, { icon: "📈", title: "Nova meta da diretoria", news: true, text: "Impressionada com a campanha, a diretoria elevou a meta: " + c.objective.desc + "." });
    } else if (pos >= target + 5) {
      c._objShiftAt = mn;
      TM.notify.push(c, { icon: "⚠️", title: "Cobrança da diretoria", news: true, text: "O time está bem abaixo da meta (" + ((c.objective && c.objective.desc) || "as metas") + "). A diretoria exige reação imediata, sob risco de demissão." });
    }
  }
  // JOGADOR INTRANSFERÍVEL: joia jovem de peso num clube grande não sai por qualquer proposta
  function isUntransferable(p) {
    if (!p || p.freeAgent) return false;
    var club = TM.data.club(p.clubId); if (!club) return false;
    var clubRat = 70; try { clubRat = TM.data.clubRating(club.id); } catch (e) {}
    // estrela jovem (<=23) e muito boa, em clube forte → pilar do projeto, não vendável
    return (p.age || 24) <= 23 && (p.overall || 0) >= 84 && clubRat >= 82;
  }

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
    if (!p) { TM.ui.go("coach-market"); return; }
    var sellClub = p.clubId ? TM.data.club(p.clubId) : null;
    if (!sellClub) { NEGO = { pid: p.id, oldClubId: null, fee: 0 }; TM.ui.go("coach-nego-player"); return; }
    var stance = C().clubStance(p);
    var mval = curVal(c, C().valueOf ? C().valueOf(c, p) : TM.data.marketValue(p));   // fim de contrato barateia

    screen.appendChild(TM.ui.topbar("Negociação", function () { TM.ui.go("coach-market"); }));
    if (TM.fin && TM.fin.banned(c)) { screen.appendChild(TM.fin.banBox(c, "coach-market")); return; }
    if ((c.pendingArrivals || []).some(function (a) { return a.pid === p.id; })) { screen.appendChild(el("div", { class: "untransfer-box" }, [ el("div", { class: "ut-ic", text: "⏳" }), el("div", { class: "ut-t", text: p.name + " já tem pré-contrato com você" }), el("div", { class: "ut-s", text: "Ele chega quando a janela abrir." }), TM.ui.button("← Voltar ao mercado", function () { TM.ui.go("coach-market"); }, "btn") ])); return; }
    if (!C().windowOpenNow(c)) screen.appendChild(el("div", { class: "fin-ban warn", text: "🔴 Janela fechada — dá para negociar e assinar pré-contrato, mas o jogador só chega " + nextWinTxt(c) + "." }));
    var clauseV = TM.fin ? curVal(c, TM.fin.worldClause(p)) : 0, clauseMode = (TM.fin && clauseV) ? TM.fin.clauseMode(p, stance) : null;
    screen.appendChild(el("div", { class: "nego-step" }, [
      el("div", { class: "nego-dot active", text: "1. Com o clube" }),
      el("div", { class: "nego-dot", text: "2. Com o jogador" })
    ]));
    // RIVAL: negociar com o maior rival é quase impossível
    var rivalInfo = null; try { rivalInfo = TM.disp ? TM.disp.rivalSellerInfo(c, sellClub.id) : null; } catch (e) {}
    if (rivalInfo) {
      stance = { willSell: false, isKey: true, priceMult: (stance.priceMult || 1.2) * rivalInfo.priceMult, line: "Com você? Nem pensar." };
      screen.appendChild(el("div", { class: "fin-ban warn", text: "🔥 " + rivalInfo.line }));
    }
    // CONCORRÊNCIA: outros clubes atrás do mesmo alvo
    var BRACE = null; try { BRACE = TM.disp ? TM.disp.buyRace(c, p, sellClub) : null; } catch (e) {}
    var braceBox = el("div");
    function renderRace() {
      TM.ui.clear(braceBox);
      if (!BRACE || !TM.disp) return;
      var pn = TM.disp.panel(c, "⚔️ Concorrência por " + p.name, BRACE.suitors, { hint: BRACE.lost ? "Você perdeu a disputa." : "Se demorar ou oferecer pouco, outro clube pode fechar antes." });
      if (pn) braceBox.appendChild(pn);
    }
    var negTension = stance.isKey ? "high" : (stance.willSell ? "low" : "mid");
    var negTLbl = negTension === "low" ? "Aberto a negociar" : negTension === "high" ? "Peça-chave — difícil" : "Vai resistir";
    screen.appendChild(el("div", { class: "nego2-call" }, [
      (TM.img && TM.img.clubImg ? TM.img.clubImg(sellClub, "nego2-crest") : el("span", { class: "nego2-crest" })),
      el("div", { class: "nego2-callinfo" }, [
        el("div", { class: "nego2-role", text: "NEGOCIANDO COM" }),
        el("div", { class: "nego2-club", text: sellClub.name }),
        el("div", { class: "nego2-sub", text: "Caixa disponível: " + money(c, c.budget) })
      ]),
      el("div", { class: "nego2-tension " + negTension }, [ el("span", { class: "nego2-tdot" }), el("span", { text: negTLbl }) ])
    ]));
    screen.appendChild(braceBox); renderRace();
    screen.appendChild(el("div", { class: "nego2-player", style: "max-width:640px;margin:10px auto 0" }, [
      TM.img.playerImg(p, "nego2-face"),
      el("div", { class: "nego2-pinfo" }, [
        el("div", { class: "nego2-pname", text: p.name }),
        el("div", { class: "nego2-pmeta" }, [
          el("span", { class: "nego2-chip", html: "POS <b>" + TM.data.posLabel(p) + "</b>" }),
          el("span", { class: "nego2-chip", html: "IDADE <b>" + p.age + "</b>" }),
          el("span", { class: "nego2-chip", html: "VALOR <b>" + money(c, mval) + "</b>" }),
          clauseV ? el("span", { class: "nego2-chip clause", html: "CLÁUSULA <b>" + money(c, clauseV) + "</b>" }) : null
        ])
      ]),
      el("div", { class: "nego2-ovr" }, [ el("div", { class: "nego2-ovrn", text: p.overall }), el("div", { class: "nego2-ovrl", text: "OVR" }) ])
    ]));

    // pagar a cláusula de rescisão: o clube não pode recusar (o jogador ainda precisa aceitar o contrato)
    function clauseButton(cls) {
      var can = c.budget >= clauseV;
      return TM.ui.button("💥 Pagar cláusula de " + money(c, clauseV) + (can ? "" : " (sem caixa)"), function () {
        if (!can) { TM.ui.toast("Seu caixa não cobre a cláusula (" + money(c, c.budget) + ")."); return; }
        TM.ui.confirm("Pagar a cláusula?", "Você deposita " + money(c, clauseV) + " à vista e o " + sellClub.name + " é obrigado a liberar " + p.name + ". Depois é só acertar o contrato com o jogador.", "Pagar", function () {
          goPlayer({ pid: p.id, oldClubId: p.clubId, type: "buy", fee: clauseV, parts: 1, viaClause: true });
        });
      }, cls || "btn primary");
    }

    // jogador INTRANSFERÍVEL — o clube não vende de jeito nenhum (só a cláusula de rescisão obriga)
    if (isUntransferable(p)) {
      screen.appendChild(el("div", { class: "untransfer-box" }, [
        el("div", { class: "ut-ic", text: "🔒" }),
        el("div", { class: "ut-t", text: p.name + " é INTRANSFERÍVEL" }),
        el("div", { class: "ut-s", text: "O " + sellClub.name + " considera " + p.name + " (" + p.overall + ", " + p.age + " anos) um pilar do projeto e não aceita vendê-lo por nenhum valor." + (clauseV ? " A única saída é pagar a cláusula de rescisão de " + money(c, clauseV) + "." : "") }),
        clauseV ? clauseButton("btn primary") : null,
        TM.ui.button("← Voltar ao mercado", function () { TM.ui.go("coach-market"); }, "btn")
      ].filter(Boolean)));
      return;
    }
    // clube que SÓ libera pela cláusula: não senta para negociar
    if (clauseMode === "only") {
      screen.appendChild(el("div", { class: "untransfer-box clause-only" }, [
        el("div", { class: "ut-ic", text: "📜" }),
        el("div", { class: "ut-t", text: sellClub.name + " não negocia " + p.name }),
        el("div", { class: "ut-s", text: "“Não vamos sentar para conversar. Quem quiser o jogador paga a cláusula de rescisão: " + money(c, clauseV) + ", à vista.”" + (stance.willLoan ? " O clube até aceita conversar sobre empréstimo." : "") }),
        clauseButton("btn primary"),
        stance.willLoan ? TM.ui.button("🔁 Propor empréstimo", function () { deal.type = "loan"; clauseMode = null; TM.ui.toast("Negociando empréstimo…"); render(); }, "btn") : null,
        TM.ui.button("← Voltar ao mercado", function () { TM.ui.go("coach-market"); }, "btn ghost")
      ].filter(Boolean)));
    }

    // FIM DE CONTRATO: pré-contrato (Lei Bosman) — de graça, chega na próxima temporada
    if (TM.fin && TM.fin.endingContract(p, c)) {
      var preOk = TM.fin.preOpen(c);
      screen.appendChild(el("div", { class: "pre-box" }, [
        el("div", { class: "pre-t", text: "📝 Contrato com o " + sellClub.name + " termina no fim da temporada" }),
        el("div", { class: "pre-s", text: preOk
          ? "Você pode assinar um pré-contrato direto com o jogador: sem taxa de transferência, ele chega no início da próxima temporada. Custa apenas as luvas (bônus de assinatura) e o salário combinado."
          : "Pré-contratos só podem ser assinados a partir da segunda metade da temporada (dia " + TM.fin.PRE_DAY + "; hoje é o dia " + (c.currentDay || 0) + "). Até lá, só comprando do clube." }),
        preOk ? TM.ui.button("📝 Negociar pré-contrato (grátis)", function () {
          if (!TM.fin.preWilling(c, p)) { TM.ui.toast(p.name + " prefere esperar: quer renovar com o " + sellClub.name + " ou um clube maior."); return; }
          goPlayer({ pid: p.id, oldClubId: p.clubId, type: "pre", fee: 0, parts: 1, preContract: true });
        }, "btn primary") : null
      ].filter(Boolean)));
    }
    // postura do clube dono
    var stanceLines = [];
    stanceLines.push(stance.willSell ? "• Aberto a vender por um bom valor." : "• Reluta em vender — quer segurar o jogador.");
    stanceLines.push(stance.willLoan ? (stance.willBuyOption ? "• Aceita empréstimo (com ou sem opção de compra)." : "• Aceita apenas empréstimo simples.") : "• Não quer emprestar este jogador.");
    screen.appendChild(el("div", { class: "nego2-quote", style: "max-width:640px;margin:10px auto 0", text:
      (stance.willSell ? "Podemos ouvir uma boa proposta por " + p.name + "." : p.name + " é importante pra gente — só sai por muito. ") + " " + stanceLines[1].replace("• ", "") }));

    // seletor de tipo de negócio
    var types = [["buy", "Comprar"]];
    if (stance.willLoan) types.push(["loan", "Empréstimo"]);
    if (stance.willBuyOption) types.push(["loanBuy", "Empr. c/ opção"]);
    var deal = { type: "buy" };
    var panel = el("div", { class: "nego-panel" });
    var typeRow = el("div", { class: "nego-field" }, [ el("label", { text: "Tipo de negócio" }), segCtl(types, deal.type, function (v) { deal.type = v; render(); }) ]);
    if (clauseMode === "only") typeRow.style.display = "none";
    screen.appendChild(typeRow);
    screen.appendChild(panel);

    function goPlayer(nego) { NEGO = nego; TM.ui.go("coach-nego-player"); }

    var onlyClause = clauseMode === "only";
    function render() {
      panel.innerHTML = "";
      if (onlyClause && deal.type === "buy") { if (clauseMode === null) panel.appendChild(el("div", { class: "nego-quote angry", text: sellClub.name + ": “Compra só pela cláusula de rescisão (" + money(c, clauseV) + "). Empréstimo a gente conversa.”" })); return; }
      typeRow.style.display = "";
      if (deal.type === "buy") renderBuy();
      else renderLoan(deal.type === "loanBuy");
    }

    /* --- compra definitiva (mais rígida) --- */
    function renderBuy() {
      var asking = r2(mval * stance.priceMult * (stance.willSell ? 1 : 1.12));
      var maxPat = stance.isKey ? 4 : 6;
      var st = { bid: Math.min(r2(asking * 0.75), c.budget), rounds: 0, patience: maxPat, agreed: false };
      // adoçantes da proposta (facilitam o acordo por um valor em dinheiro menor)
      var sweet = { bonus: false, sellOn: false, parts: 1 };
      var swap = { id: null, val: 0, name: "" };            // jogador incluído na troca
      function sweetDiscount() { return (sweet.bonus ? 0.10 : 0) + (sweet.sellOn ? 0.08 : 0); }
      function effAsking() { return Math.max(0.05, Math.round((asking * (1 - sweetDiscount()) - swap.val) * 100) / 100); }

      panel.appendChild(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "Valor de mercado" }), el("span", { class: "deal-val", text: money(c, mval) }) ]));
      if (clauseV) panel.appendChild(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "📜 Cláusula de rescisão (atalho: paga e leva)" }), el("span", { class: "deal-val", text: money(c, clauseV) }) ]));

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
      var bidMax = Math.max(0.05, c.budget), bStep = moneyStep(bidMax);
      var slider = el("input", { type: "range", min: bStep, max: bidMax, step: bStep, value: Math.min(st.bid, bidMax), class: "slider" });
      slider.addEventListener("input", function () { st.bid = r2(parseFloat(slider.value)); bidVal.textContent = money(c, st.bid); });
      function setBid(v) { st.bid = r2(Math.max(bStep, Math.min(c.budget, v))); slider.value = Math.min(st.bid, bidMax); bidVal.textContent = money(c, st.bid); }
      var quick = el("div", { class: "nego-quick" }, [
        el("button", { class: "chip-btn", text: "−5%", on: { click: function () { setBid(st.bid * 0.95); } } }),
        el("button", { class: "chip-btn", text: "+5%", on: { click: function () { setBid(st.bid * 1.05); } } }),
        el("button", { class: "chip-btn", text: "Igualar pedido", on: { click: function () { setBid(asking); } } })
      ]);
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Sua proposta (à vista)" }), el("div", { class: "range-wrap" }, [ slider, bidVal ]), quick ]));

      // ADOÇANTES: bônus por metas, % de venda futura, parcelamento
      var bonusAmt = Math.round(asking * 0.15 * 100) / 100;
      var sweetNote = el("div", { class: "sweet-note" });
      function updSweet() {
        sweetNote.innerHTML = "";
        var parts = [];
        if (sweet.bonus) parts.push("bônus de " + money(c, bonusAmt) + " se o jogador fizer " + (TM.fin ? TM.fin.BONUS_APPS : 20) + " jogos na temporada");
        if (sweet.sellOn) parts.push("10% de uma venda futura");
        if (sweet.parts > 1) parts.push("parcelado em " + sweet.parts + "x");
        sweetNote.textContent = parts.length ? "Proposta inclui: " + parts.join(", ") + "." : "";
      }
      function sweetToggle(label, get, set) {
        var b = el("button", { class: "sweet-chip" + (get() ? " on" : ""), text: label, on: { click: function () { set(!get()); b.classList.toggle("on", get()); updSweet(); } } });
        return b;
      }
      var partSeg = segCtl([[1, "À vista"], [2, "2x"], [3, "3x"]], 1, function (v) { sweet.parts = parseInt(v, 10); updSweet(); });
      panel.appendChild(el("div", { class: "nego-field" }, [
        el("label", { text: "Adoçantes (ajudam a fechar por menos à vista)" }),
        el("div", { class: "sweet-row" }, [
          sweetToggle("💰 Bônus por metas", function () { return sweet.bonus; }, function (v) { sweet.bonus = v; }),
          sweetToggle("📈 10% venda futura", function () { return sweet.sellOn; }, function (v) { sweet.sellOn = v; })
        ]),
        el("div", { class: "sweet-parts" }, [ el("span", { class: "sweet-parts-lbl", text: "Pagamento:" }), partSeg ]),
        sweetNote
      ]));

      // TROCA: incluir um jogador seu no negócio para abater o valor à vista
      var swapNote = el("div", { class: "sweet-note" });
      var swapSel = el("select", { class: "select" });
      swapSel.appendChild(el("option", { value: "", text: "— nenhum (só dinheiro) —" }));
      (c.roster || []).map(function (id) { return C().resolvePlayer(c, id); }).filter(Boolean)
        .sort(function (a, b) { return TM.data.marketValue(b) - TM.data.marketValue(a); })
        .forEach(function (pl) {
          swapSel.appendChild(el("option", { value: pl.id, text: pl.name + " (" + TM.data.posLabel(pl) + " " + pl.overall + ") · " + money(c, curVal(c, TM.data.marketValue(pl))) }));
        });
      swapSel.addEventListener("change", function () {
        swap.id = swapSel.value || null;
        if (swap.id) { var sp = C().resolvePlayer(c, swap.id); swap.name = sp.name; swap.val = curVal(c, TM.data.marketValue(sp) * 0.9); swapNote.textContent = "Inclui " + sp.name + " (abate " + money(c, swap.val) + " do valor à vista)."; }
        else { swap.val = 0; swap.name = ""; swapNote.textContent = ""; }
      });
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "🔄 Incluir jogador na troca" }), swapSel, swapNote ]));

      var actionWrap = el("div", { class: "actions", style: "margin-top:6px" });
      var offerBtn = TM.ui.button("💬 Fazer proposta", doOffer, "btn primary");
      var acceptBtn = TM.ui.button("✅ Aceitar contraproposta", function () { setBid(effAsking()); doOffer(); }, "btn primary");
      acceptBtn.style.display = "none";
      var nextBtn = TM.ui.button("Negociar com o jogador →", function () {
        goPlayer({ pid: p.id, oldClubId: p.clubId, type: "buy", fee: st.bid,
          bonus: sweet.bonus ? bonusAmt : 0, sellOn: sweet.sellOn ? 10 : 0, parts: sweet.parts || 1,
          swapId: swap.id || null, swapName: swap.name || "", swapVal: swap.val || 0 });
      }, "btn primary next-step");
      nextBtn.style.display = "none";

      function lockControls() { offerBtn.disabled = true; slider.disabled = true; acceptBtn.style.display = "none"; quick.querySelectorAll("button").forEach(function (b) { b.disabled = true; }); }
      function doOffer() {
        if (st.agreed || offerBtn.disabled) return;
        st.rounds++;
        bubble("me", "Ofereço " + money(c, st.bid) + ".");
        acceptBtn.style.display = "none";
        // rival: a diretoria deles pode simplesmente encerrar
        if (rivalInfo && Math.random() < rivalInfo.refuseChance) {
          bubble("them", "“Não vendemos para vocês. Procurem outro jogador.”", "angry");
          lockControls(); return;
        }
        // concorrência reage
        if (BRACE && TM.disp) {
          var evs = TM.disp.buyRound(c, p, BRACE, st.bid, sellClub);
          renderRace();
          evs.forEach(function (t) { bubble("info", "⚔️ " + t); });
          if (BRACE.lost) { lockControls(); TM.storage.saveCoachCareer(c); return; }
        }
        var partsNow = sweet.parts > 1 ? st.bid / sweet.parts : st.bid;   // à vista, só a 1ª parcela pesa agora
        if (partsNow > c.budget) { bubble("them", "Seu caixa não cobre nem a entrada (" + money(c, c.budget) + ").", "angry"); return; }
        var ea = effAsking();
        if (st.bid >= ea * 0.93) {
          var extra = (sweetDiscount() > 0 ? " (com os adoçantes)" : "");
          bubble("them", "Fechado! " + p.name + " é seu por " + money(c, st.bid) + extra + ". Agora acerte com o jogador.", "happy");
          st.agreed = true; lockControls(); nextBtn.style.display = "block";
        } else if (st.bid >= ea * 0.78 && st.patience > 0) {
          st.patience--; asking = Math.round((asking + st.bid) / 2);
          bubble("them", "Estamos perto... chegue a " + money(c, effAsking()) + " e fechamos.");
          acceptBtn.textContent = "✅ Aceitar " + money(c, effAsking()); acceptBtn.style.display = "block";
        } else if (st.rounds >= 7 || st.patience <= 0) {
          bubble("them", "Encerramos a conversa por ora. Volte com uma proposta melhor.", "angry"); lockControls();
        } else {
          st.patience--; bubble("them", "Ainda está bem abaixo do que pedimos (" + money(c, asking) + ").", "angry");
        }
        updateMood();
      }

      updateMood();
      actionWrap.appendChild(offerBtn); actionWrap.appendChild(acceptBtn); actionWrap.appendChild(nextBtn);
      if (clauseV) actionWrap.appendChild(clauseButton("btn ghost"));
      panel.appendChild(actionWrap);
    }

    /* --- empréstimo (simples ou com opção de compra) --- */
    function renderLoan(withOption) {
      var d = { termYears: 1, loanFee: Math.max(0.05, r2(mval * 0.08)), buyPrice: r2(mval * stance.priceMult * 1.15), share: 100 };
      var minBuy = r2(mval * stance.priceMult); // o clube dono exige no mínimo isso
      // divisão do salário: o clube dono aceita bancar parte, mas quanto menos você paga, mais taxa ele exige
      var minShare = stance.isKey ? 80 : stance.willSell ? 40 : 60;
      function minFeeFor(share) { return r2(Math.max(0.05, mval * 0.05 * (1 + (100 - share) / 60))); }
      var quote = el("div", { class: "nego-quote", text: sellClub.name + ": “" + (withOption ? "Topamos emprestar " + p.name + " com opção — mas a opção não sai por menos de " + money(c, minBuy) + "." : "Podemos emprestar " + p.name + ". Combine a taxa e o tempo.") + "”" });
      panel.appendChild(quote);

      // duração
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Tempo de empréstimo" }),
        segCtl([[0.5, "6 meses"], [1, "1 ano"], [1.5, "1 ano e meio"]], 1, function (v) { d.termYears = parseFloat(v); }) ]));

      // taxa de empréstimo
      var feeVal = el("span", { class: "range-val", text: money(c, d.loanFee) });
      var feeMax = Math.max(0.2, r2(mval * 0.25)), feeStep = moneyStep(feeMax);
      var feeSlider = el("input", { type: "range", min: feeStep, max: feeMax, step: feeStep, value: Math.min(d.loanFee, feeMax), class: "slider" });
      feeSlider.addEventListener("input", function () { d.loanFee = r2(parseFloat(feeSlider.value)); feeVal.textContent = money(c, d.loanFee); });
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Taxa de empréstimo" }), el("div", { class: "range-wrap" }, [ feeSlider, feeVal ]) ]));

      // divisão do salário no período do empréstimo
      var wDem = curVal(c, wageDemand(p));
      var shVal = el("span", { class: "range-val", text: "você 100% · " + sellClub.name + " 0%" });
      var shSlider = el("input", { type: "range", min: 0, max: 100, step: 10, value: 100, class: "slider" });
      var shNote = el("div", { class: "sweet-note", text: "Salário estimado " + money(c, wDem) + "/ano — você paga " + money(c, wDem) + "." });
      shSlider.addEventListener("input", function () {
        d.share = parseInt(shSlider.value, 10);
        shVal.textContent = "você " + d.share + "% · " + sellClub.name + " " + (100 - d.share) + "%";
        shNote.textContent = "Salário estimado " + money(c, wDem) + "/ano — você paga " + money(c, r2(wDem * d.share / 100)) + ". " + (d.share < minShare ? "⚠ O " + sellClub.name + " não banca mais de " + (100 - minShare) + "%." : d.share < 100 ? "O clube dono vai pedir taxa mínima de " + money(c, minFeeFor(d.share)) + "." : "");
      });
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Divisão do salário no período" }), el("div", { class: "range-wrap" }, [ shSlider, shVal ]), shNote ]));

      // preço da opção de compra
      if (withOption) {
        var bpVal = el("span", { class: "range-val", text: money(c, d.buyPrice) });
        var bpMax = Math.max(minBuy + 0.2, r2(minBuy * 2)), bpStep = moneyStep(bpMax);
        var bpSlider = el("input", { type: "range", min: bpStep, max: bpMax, step: bpStep, value: Math.min(d.buyPrice, bpMax), class: "slider" });
        bpSlider.addEventListener("input", function () { d.buyPrice = r2(parseFloat(bpSlider.value)); bpVal.textContent = money(c, d.buyPrice); });
        panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Preço da opção de compra (mín. " + money(c, minBuy) + ")" }), el("div", { class: "range-wrap" }, [ bpSlider, bpVal ]) ]));
      }

      var actionWrap = el("div", { class: "actions", style: "margin-top:6px" });
      var offerBtn = TM.ui.button("Propor empréstimo", function () {
        if (d.loanFee > c.budget) { quote.className = "nego-quote angry"; quote.textContent = "Você não tem orçamento nem para a taxa (" + money(c, c.budget) + ")."; return; }
        if (d.share < minShare) { quote.className = "nego-quote angry"; quote.textContent = sellClub.name + ": “Não vamos pagar " + (100 - d.share) + "% do salário de um jogador que vai jogar por vocês. No máximo " + (100 - minShare) + "%.”"; return; }
        if (d.share < 100 && d.loanFee < minFeeFor(d.share)) { quote.className = "nego-quote angry"; quote.textContent = sellClub.name + ": “Se vamos bancar " + (100 - d.share) + "% do salário, a taxa tem que ser de pelo menos " + money(c, minFeeFor(d.share)) + ".”"; return; }
        if (withOption && d.buyPrice < minBuy) {
          quote.className = "nego-quote angry"; quote.textContent = sellClub.name + ": “A opção de compra é baixa demais. No mínimo " + money(c, minBuy) + ".”"; return;
        }
        quote.className = "nego-quote happy"; quote.textContent = sellClub.name + ": “Acordo de empréstimo encaminhado. Agora convença o jogador.”";
        offerBtn.disabled = true; nextBtn.style.display = "block";
      }, "btn primary");
      var nextBtn = TM.ui.button("Negociar com o jogador →", function () {
        goPlayer({ pid: p.id, oldClubId: p.clubId, type: withOption ? "loanBuy" : "loan", loanFee: d.loanFee, termYears: d.termYears, buyPrice: withOption ? d.buyPrice : 0, share: d.share });
      }, "btn primary next-step");
      nextBtn.style.display = "none";
      actionWrap.appendChild(offerBtn); actionWrap.appendChild(nextBtn);
      panel.appendChild(actionWrap);
    }

    render();
  });

  var NEGO = null;

  // CHEGADA do reforço (entra no elenco). Fora da janela, fica pendente e só acontece quando a janela abrir.
  function completeSigning(c, p, nego, terms, share, quiet) {
    var isLoan = nego.type === "loan" || nego.type === "loanBuy";
    if (isLoan) {
      C().signLoan(c, p, { parentClubId: nego.oldClubId, buyOption: nego.type === "loanBuy", buyPrice: nego.buyPrice || 0, termYears: nego.termYears || 1, loanFee: 0, wage: terms.wage, share: share, noLog: true });
      if (c.loanedIn && c.loanedIn[p.id]) c.loanedIn[p.id].share = share;
    } else {
      if (c.roster.indexOf(p.id) < 0) c.roster.push(p.id);
      c.signedFrom[p.id] = nego.oldClubId;
      // TROCA: o jogador incluído sai do seu elenco rumo ao clube vendedor
      if (nego.swapId && nego.oldClubId) {
        var swp = C().resolvePlayer(c, nego.swapId);
        c.roster = c.roster.filter(function (id) { return id !== nego.swapId; });
        delete c.signedFrom[nego.swapId];
        if (c.contracts) delete c.contracts[nego.swapId];
        try { C().executeWorldTransfer(c, nego.swapId, nego.oldClubId); } catch (e) {}
        c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.soldM = (c.finc.soldM || 0) + (nego.swapVal || 0);
        C().logDeal(c, { type: "out", kind: "swap", pid: nego.swapId, name: nego.swapName || (swp && swp.name) || "Jogador", pos: swp ? swp.pos : "", ov: swp ? swp.overall : 0, fee: nego.swapVal || 0, other: TM.data.club(nego.oldClubId) ? TM.data.club(nego.oldClubId).name : "" });
        TM.notify.push(c, { icon: "🔄", title: "Troca fechada", news: true, text: (nego.swapName || "Um jogador") + " foi incluído na negociação e se transferiu para o " + (TM.data.club(nego.oldClubId) ? TM.data.club(nego.oldClubId).name : "clube vendedor") + "." });
      }
      C().syncLineup(c); // já entra no banco de reservas
    }
    // OFICIALIZA a contratação: notícia + post nas redes + feed do mercado
    try {
      var myNm = TM.data.club(c.teamId).name;
      var fromNm = nego.oldClubId && TM.data.club(nego.oldClubId) ? TM.data.club(nego.oldClubId).name : "sem clube";
      var annTxt = isLoan
        ? myNm + " garante " + p.name + " (" + p.overall + ", " + TM.data.posLabel(p) + ") por empréstimo junto ao " + fromNm + "."
        : myNm + " anuncia a contratação de " + p.name + " (" + p.overall + ", " + TM.data.posLabel(p) + ")" + (nego.oldClubId ? " junto ao " + fromNm + ((nego.fee || 0) > 0 ? " por " + money(c, nego.fee || 0) : "") : ", que estava livre no mercado") + ".";
      TM.notify.push(c, { icon: "✍️", title: quiet ? "Reforço chegou" : "Reforço oficializado", news: true, text: annTxt + (quiet ? " A janela abriu e o jogador já está à disposição." : "") });
      C().recordMarketMove(c, { pid: p.id, name: p.name, ov: p.overall, fromId: nego.oldClubId || null, fromName: fromNm, toId: c.teamId, toName: myNm, val: nego.fee || 0 }, isLoan ? "buy" : (nego.oldClubId ? "buy" : "free"));
      if (TM.social && TM.social.announceSigning) TM.social.announceSigning(c, p, myNm, fromNm, nego.fee || 0, isLoan);
    } catch (e) {}
  }
  // "chega em 04/01/2027" ou "chega no início da próxima temporada"
  function nextWinTxt(c) { var nxt = C().nextWindowOpenDay(c); return nxt != null ? "em " + C().dateOf(c, nxt).full : "no início da próxima temporada (janela de verão)"; }
  // janela abriu: os reforços fechados fora da janela entram no elenco
  function arrivePending(c) {
    var list = c.pendingArrivals || []; if (!list.length) return 0;
    var n = 0, cur = c.season || 1;
    c.pendingArrivals = list.filter(function (a) { return a.arriveSeason && cur < a.arriveSeason; });
    list.forEach(function (a) {
      if (a.arriveSeason && cur < a.arriveSeason) return;
      var p = TM.data.player(a.pid) || C().resolvePlayer(c, a.pid); if (!p) return;
      try { completeSigning(c, p, a.nego, a.terms, a.share == null ? 100 : a.share, true); n++; } catch (e) {}
    });
    if (n) TM.storage.saveCoachCareer(c);
    return n;
  }
  TM.coachUI = TM.coachUI || {}; TM.coachUI.arrivePending = arrivePending;

  /* ---------- negociação: com o jogador ---------- */
  TM.ui.register("coach-nego-player", function (screen) {
    var c = TM.storage.coachCareer();
    if (!NEGO) { TM.ui.go("coach-market"); return; }
    var p = TM.data.player(NEGO.pid);
    var ag = agentOf(p);
    var demand = curVal(c, wageDemand(p) * ag.wageMult);
    var agentFee = Math.round((NEGO.fee || 0) * ag.feePct / 100 * 100) / 100;
    var terms = { wage: demand, years: 3, role: "titular", release: false, clauseM: 0 };
    NEGO.agentFee = agentFee;
    var mvalCur = curVal(c, TM.data.marketValue(p));
    var isLoanDeal = NEGO.type === "loan" || NEGO.type === "loanBuy";
    var share = isLoanDeal && NEGO.share != null ? NEGO.share : 100;

    var isFree = !NEGO.oldClubId;
    screen.appendChild(TM.ui.topbar("Negociação", function () { TM.ui.go("coach-market"); }));
    if (TM.fin && TM.fin.banned(c)) { screen.appendChild(TM.fin.banBox(c, "coach-market")); return; }
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
    if (NEGO.viaClause) panel.appendChild(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "📜 Cláusula de rescisão depositada" }), el("span", { class: "deal-val", text: money(c, NEGO.fee || 0) }) ]));
    var isPre = NEGO.type === "pre", luvas = isPre ? r2(demand * 0.5) : 0;
    if (isPre) panel.appendChild(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "📝 Pré-contrato — chega na próxima temporada, sem taxa · luvas (bônus de assinatura)" }), el("span", { class: "deal-val", text: money(c, luvas) }) ]));
    if (isLoanDeal) panel.appendChild(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "🔁 Empréstimo de " + C().loanTermLabel(NEGO.termYears || 1) + (NEGO.type === "loanBuy" ? " com opção de compra" : "") }), el("span", { class: "deal-val", text: "você paga " + share + "% do salário" }) ]));
    // empresário do jogador
    panel.appendChild(el("div", { class: "agent-line agent-" + ag.type }, [
      el("span", { class: "agent-ic", text: ag.ic }),
      el("div", { class: "agent-info" }, [
        el("div", { class: "agent-name", text: ag.label + " · " + ag.name }),
        el("div", { class: "agent-note", text: "“" + ag.line + "”" + (agentFee > 0 ? " Comissão de " + ag.feePct + "% (" + money(c, agentFee) + ")." : " Comissão de " + ag.feePct + "%.") })
      ])
    ]));

    // salário
    function wageTxt() { return money(c, terms.wage) + "/ano" + (share < 100 ? " (sua parte: " + money(c, r2(terms.wage * share / 100)) + ")" : ""); }
    var wageVal = el("span", { class: "range-val", text: wageTxt() });
    var wageMax = Math.max(0.15, r2(demand * 3)), wStep = moneyStep(wageMax);
    var wageSlider = el("input", { type: "range", min: wStep, max: wageMax, step: wStep, value: Math.min(terms.wage, wageMax), class: "slider" });
    wageSlider.addEventListener("input", function () { terms.wage = r2(parseFloat(wageSlider.value)); wageVal.textContent = wageTxt(); });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Salário anual" }), el("div", { class: "range-wrap" }, [ wageSlider, wageVal ]) ]));

    // tempo de contrato (empréstimo: o período já foi acertado com o clube dono)
    if (isLoanDeal) {
      terms.years = Math.max(1, Math.round(NEGO.termYears || 1));
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Período" }), el("div", { class: "setting-hint", text: "Empréstimo de " + C().loanTermLabel(NEGO.termYears || 1) + " — o vínculo do jogador continua com o " + (TM.data.club(NEGO.oldClubId) || {}).name + "; não há contrato longo a negociar." }) ]));
    } else {
      var yearsSeg = seg(["1", "2", "3", "4", "5"], "3", function (v) { terms.years = parseInt(v, 10); });
      panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Tempo de contrato (anos)" }), yearsSeg ]));
    }

    // função no elenco
    var roleSeg = seg([["estrela", "Estrela"], ["titular", "Titular"], ["rodizio", "Rodízio"], ["promessa", "Promessa"]], "titular", function (v) { terms.role = v; });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Função no elenco" }), roleSeg ]));

    // cláusula de rescisão (você escolhe o valor; baixa agrada o jogador, alta protege o clube mas ele pede mais salário)
    if (!isLoanDeal) {
      var clMin = Math.max(0.1, r2(mvalCur * 1)), clMax = Math.max(clMin + 0.5, r2(mvalCur * 6)), clStep = moneyStep(clMax);
      terms.clauseM = r2(Math.min(clMax, Math.max(clMin, mvalCur * 2.5)));
      var clVal = el("span", { class: "range-val", text: money(c, terms.clauseM) });
      var clSlider = el("input", { type: "range", min: clMin, max: clMax, step: clStep, value: terms.clauseM, class: "slider" });
      var clNote = el("div", { class: "sweet-note" });
      function clTxt() { var m = terms.clauseM / Math.max(0.01, mvalCur); clNote.textContent = "Cláusula = " + m.toFixed(1) + "x o valor de mercado. " + (m <= 1.5 ? "Baixa: o jogador aceita salário menor, mas qualquer clube pode levá-lo pagando esse valor." : m >= 4 ? "Alta: protege o clube, mas o jogador pede ~10% a mais de salário." : "Equilibrada."); }
      clSlider.addEventListener("input", function () { terms.clauseM = r2(parseFloat(clSlider.value)); clVal.textContent = money(c, terms.clauseM); clTxt(); });
      var clWrap = el("div", { class: "nego-field", style: "display:none" }, [ el("label", { text: "Valor da cláusula de rescisão" }), el("div", { class: "range-wrap" }, [ clSlider, clVal ]), clNote ]);
      clTxt();
      var relBtn = el("button", { class: "switch" + (terms.release ? " on" : ""), on: { click: function () { terms.release = !terms.release; relBtn.classList.toggle("on", terms.release); clWrap.style.display = terms.release ? "" : "none"; } } }, [ el("span", { class: "switch-knob" }) ]);
      panel.appendChild(el("div", { class: "nego-field", style: "flex-direction:row;justify-content:space-between;align-items:center" }, [ el("label", { text: "Incluir cláusula de rescisão" }), relBtn ]));
      panel.appendChild(clWrap);
    }

    var actionWrap = el("div", { class: "actions" });
    var proposeBtn = TM.ui.button("Oferecer contrato", function () {
      // avaliação do jogador
      var roleScore = { estrela: 1.2, titular: 1.0, rodizio: 0.7, promessa: 0.6 }[terms.role];
      var clMult = (!isLoanDeal && terms.release) ? terms.clauseM / Math.max(0.01, mvalCur) : 0;
      var clFactor = clMult ? (clMult <= 1.5 ? 0.85 : clMult >= 4 ? 1.1 : 1) : 1;
      var wageOk = terms.wage >= demand * (terms.role === "promessa" || terms.role === "rodizio" ? 1.15 : 0.9) * clFactor;
      var roleOk = !((p.overall >= 80 && (terms.role === "rodizio" || terms.role === "promessa")));
      if (wageOk && roleOk) {
        // fechado!
        var isLoan = NEGO.type === "loan" || NEGO.type === "loanBuy";
        var winOpen = C().windowOpenNow(c);
        if (isPre) {
          if (c.budget < luvas) { quote.className = "nego-quote angry"; quote.textContent = "Seu caixa não cobre as luvas (" + money(c, luvas) + ")."; return; }
          c.budget -= luvas; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM += luvas;
          c.contracts = c.contracts || {};
          c.contracts[p.id] = { years: terms.years, wage: r2(terms.wage / mult(c)), clause: terms.release ? r2(terms.clauseM / mult(c)) : 0, role: terms.role };
          C().logDeal(c, { type: "in", kind: "pre", pid: p.id, name: p.name, pos: p.pos, ov: p.overall, fee: luvas, other: (TM.data.club(NEGO.oldClubId) || {}).name || "" });
          var psnap = {}; Object.keys(NEGO).forEach(function (k) { psnap[k] = NEGO[k]; }); psnap.oldClubId = NEGO.oldClubId; psnap.type = "buy"; psnap.fee = 0;
          c.pendingArrivals = c.pendingArrivals || [];
          c.pendingArrivals.push({ pid: p.id, name: p.name, nego: psnap, terms: { wage: terms.wage, years: terms.years, role: terms.role, release: terms.release, clauseM: terms.clauseM }, share: 100, isLoan: false, pre: true, arriveSeason: (c.season || 1) + 1, season: c.season || 1, day: c.currentDay || 0 });
          TM.notify.push(c, { icon: "📝", title: "Pré-contrato assinado", news: true, text: p.name + " (" + p.overall + ", " + TM.data.posLabel(p) + ") assinou pré-contrato com o " + TM.data.club(c.teamId).name + ": chega de graça no início da próxima temporada, quando o contrato com o " + ((TM.data.club(NEGO.oldClubId) || {}).name || "clube atual") + " terminar. Luvas pagas: " + money(c, luvas) + "." });
          try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: "📝", title: "Pré-contrato", text: TM.data.club(c.teamId).name + " acerta pré-contrato com " + p.name + " (" + ((TM.data.club(NEGO.oldClubId) || {}).name || "") + "), que chega de graça na próxima temporada." }); } catch (e) {}
          TM.storage.saveCoachCareer(c);
          quote.className = "nego-quote happy"; quote.textContent = "✔ " + p.name + " assinou pré-contrato! Chega de graça no início da próxima temporada.";
          actionWrap.innerHTML = ""; actionWrap.appendChild(TM.ui.button("Voltar ao mercado", function () { NEGO = null; TM.ui.go("coach-market"); }, "btn primary"));
          return;
        }
        if (isLoan) {
          // taxa de empréstimo paga agora; o vínculo (signLoan) acontece na chegada
          var lFee = NEGO.loanFee || 0;
          c.budget -= lFee; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM += lFee;
          C().logDeal(c, { type: "in", kind: NEGO.type === "loanBuy" ? "loanBuy" : "loan", pid: p.id, name: p.name, pos: p.pos, ov: p.overall, fee: lFee, other: TM.data.club(NEGO.oldClubId) ? TM.data.club(NEGO.oldClubId).name : "" });
          if (share < 100) TM.notify.push(c, { icon: "🔁", title: "Salário dividido", text: "No empréstimo de " + p.name + ", o " + ((TM.data.club(NEGO.oldClubId) || {}).name || "clube dono") + " paga " + (100 - share) + "% do salário; você paga " + money(c, r2(terms.wage * share / 100)) + "/ano." });
        } else {
          var fee = NEGO.fee || 0, parts = Math.max(1, NEGO.parts || 1);
          var upfront = r2(fee / parts);
          var agFee = NEGO.agentFee || 0;                 // comissão do empresário (paga à vista)
          c.budget -= (upfront + agFee);
          c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM += (upfront + agFee);
          if (agFee > 0) TM.notify.push(c, { icon: "💼", title: "Comissão de empresário", text: "Paga comissão de " + money(c, agFee) + " ao empresário de " + p.name + "." });
          // parcelas futuras: vencimentos com aviso, pagamento MANUAL em Finanças
          var sellNm = NEGO.oldClubId ? (TM.data.club(NEGO.oldClubId) || {}).name : "";
          if (parts > 1) {
            if (TM.fin) TM.fin.addInstallments(c, { pid: p.id, name: p.name, per: upfront, parts: parts, toName: sellNm, toId: NEGO.oldClubId || null });
            else { c.installments = c.installments || []; c.installments.push({ pid: p.id, name: p.name, per: upfront, left: parts - 1, to: sellNm }); }
          }
          // bônus por metas (20 jogos na temporada) e % de venda futura — cobrados quando acontecem
          if (NEGO.bonus || NEGO.sellOn) {
            if (TM.fin) TM.fin.setDealTerms(c, { pid: p.id, bonus: NEGO.bonus || 0, sellOn: NEGO.sellOn || 0, toId: NEGO.oldClubId || null, toName: sellNm, fee: fee });
            else { c.dealTerms = c.dealTerms || {}; c.dealTerms[p.id] = { bonus: NEGO.bonus || 0, sellOn: NEGO.sellOn || 0 }; }
          }
          // contrato conforme o negociado (salário e cláusula guardados em euro-base)
          c.contracts = c.contracts || {};
          c.contracts[p.id] = { years: terms.years, wage: r2(terms.wage / mult(c)), clause: terms.release ? r2(terms.clauseM / mult(c)) : 0, role: terms.role };
          if (NEGO.viaClause) TM.notify.push(c, { icon: "📜", title: "Cláusula paga", news: true, text: "Você depositou a cláusula de rescisão de " + money(c, fee) + " e o " + (sellNm || "clube") + " foi obrigado a liberar " + p.name + "." });
          C().logDeal(c, { type: "in", kind: NEGO.oldClubId ? "buy" : "free", pid: p.id, name: p.name, pos: p.pos, ov: p.overall, fee: fee, other: NEGO.oldClubId && TM.data.club(NEGO.oldClubId) ? TM.data.club(NEGO.oldClubId).name : "Sem clube (livre)" });
        }
        var snap = {}; Object.keys(NEGO).forEach(function (k) { snap[k] = NEGO[k]; });
        var tsnap = { wage: terms.wage, years: terms.years, role: terms.role, release: terms.release, clauseM: terms.clauseM };
        if (winOpen) {
          completeSigning(c, p, snap, tsnap, share, false);
        } else {
          // FORA DA JANELA: pré-contrato assinado, o jogador só chega quando a próxima janela abrir
          c.pendingArrivals = c.pendingArrivals || [];
          c.pendingArrivals.push({ pid: p.id, name: p.name, nego: snap, terms: tsnap, share: share, isLoan: isLoan, season: c.season || 1, day: c.currentDay || 0 });
          TM.notify.push(c, { icon: "⏳", title: "Pré-contrato assinado", news: true, text: p.name + " (" + p.overall + ", " + TM.data.posLabel(p) + ") acertou com o " + TM.data.club(c.teamId).name + (isLoan ? " por empréstimo" : "") + ", mas a janela está fechada: ele só chega e pode ser registrado " + nextWinTxt(c) + "." });
        }
        TM.storage.saveCoachCareer(c);
        quote.className = "nego-quote happy";
        quote.textContent = !winOpen
          ? "✔ " + p.name + " assinou pré-contrato! A janela está fechada: ele chega " + nextWinTxt(c) + "."
          : isLoan
          ? "✔ " + p.name + " chega por empréstimo (" + C().loanTermLabel(NEGO.termYears) + ")" + (NEGO.type === "loanBuy" ? " com opção de compra!" : "!")
          : "✔ " + p.name + " assinou com o " + TM.data.club(c.teamId).name + "!";
        actionWrap.innerHTML = "";
        actionWrap.appendChild(TM.ui.button("Voltar ao mercado", function () { NEGO = null; TM.ui.go("coach-market"); }, "btn primary"));
        // ceninha de apresentação do reforço (só quando ele chega de fato)
        if (winOpen) TM.ui.arrivalCutscene(p, TM.data.club(c.teamId), null);
      } else if (!roleOk) {
        quote.className = "nego-quote angry"; quote.textContent = p.name + ": “Sou titular indiscutível. Não aceito função de reserva.”";
      } else if (clFactor > 1) {
        quote.className = "nego-quote angry"; quote.textContent = p.name + ": “Com uma cláusula tão alta, quero pelo menos " + money(c, r2(demand * 1.1)) + "/ano — ou baixe a cláusula.”";
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

  /* ---------- PROPOSTAS de outros clubes + movimentos de carreira ---------- */
  TM.ui.register("coach-offers", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach"); return; }
    // marca todas como vistas
    (c.jobOffers || []).forEach(function (o) { o.seen = true; });
    TM.storage.saveCoachCareer(c);
    screen.appendChild(TM.ui.topbar("💼 Propostas", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-offers");
    var wrap = el("div", { class: "offers-wrap" });
    screen.appendChild(wrap);

    var club = TM.data.club(c.teamId);
    wrap.appendChild(el("div", { class: "offers-cur" }, [
      club ? TM.img.clubImg(club, "oc-crest") : null,
      el("div", { class: "oc-info" }, [
        el("div", { class: "oc-lbl", text: c.unemployed ? "Situação atual" : "Clube atual" }),
        el("div", { class: "oc-name", text: c.unemployed ? "Sem clube (livre no mercado)" : (club ? club.name : "—") }),
        el("div", { class: "oc-sub", text: c.unemployed ? "Aguarde propostas ou aceite uma abaixo." : (TM.data.league(c.leagueId).name + " · Temporada " + c.season) })
      ])
    ]));

    var offers = c.jobOffers || [];
    if (!offers.length) {
      wrap.appendChild(el("div", { class: "offers-empty" }, [
        el("div", { class: "oe-ic", text: "📭" }),
        el("div", { class: "oe-t", text: "Nenhuma proposta no momento" }),
        el("div", { class: "oe-s", text: "Vença jogos e conquiste títulos para atrair o interesse de outros clubes. As propostas aparecem aqui." })
      ]));
    } else {
      wrap.appendChild(el("div", { class: "offers-hd", text: offers.length + " proposta(s) na mesa" }));
      offers.forEach(function (o) {
        var ocl = TM.data.club(o.clubId);
        var better = o.rating > TM.data.clubRating(c.teamId);
        var card = el("div", { class: "offer-card" }, [
          el("div", { class: "of-head" }, [
            ocl ? TM.img.clubImg(ocl, "of-crest") : null,
            el("div", { class: "of-id" }, [
              el("div", { class: "of-name", text: o.clubName }),
              el("div", { class: "of-lg", text: o.leagueName + " · força " + o.rating + (better ? " ↑" : "") })
            ]),
            el("span", { class: "of-badge" + (better ? " up" : ""), text: better ? "Clube maior" : "Convite" })
          ]),
          el("div", { class: "of-desc", text: "O " + o.clubName + " " + o.desc + "." }),
          el("div", { class: "of-wage", text: "💰 Salário oferecido: " + money(c, o.wage) + "/temporada" }),
          el("div", { class: "of-acts" }, [
            TM.ui.button("✅ Aceitar", function () {
              TM.ui.confirm("Assumir o " + o.clubName + "?", "Você deixará o " + (club ? club.name : "clube atual") + " e recomeçará no novo clube. Seu histórico e títulos são mantidos.", "Aceitar proposta", function () {
                C().switchUserClub(c, o.clubId);
                TM.storage.saveCoachCareer(c);
                TM.ui.toast("🤝 Você é o novo treinador do " + o.clubName + "!");
                TM.ui.go("coach-hub");
              });
            }, "btn primary"),
            TM.ui.button("Recusar", function () {
              c.jobOffers = c.jobOffers.filter(function (x) { return x.id !== o.id; });
              TM.storage.saveCoachCareer(c);
              TM.ui.go("coach-offers");
            }, "btn ghost")
          ])
        ]);
        wrap.appendChild(card);
      });
    }

    // pedir demissão
    if (!c.unemployed) {
      wrap.appendChild(el("div", { class: "offers-resign" }, [
        el("div", { class: "or-t", text: "Deixar o clube" }),
        el("div", { class: "or-s", text: "Peça demissão para ficar livre no mercado. Propostas passam a chegar com mais frequência — mas você fica sem clube até aceitar uma." }),
        TM.ui.button("🚪 Pedir demissão", function () {
          TM.ui.confirm("Pedir demissão do " + (club ? club.name : "clube") + "?", "Você ficará sem clube e dependerá de propostas para voltar a trabalhar.", "Pedir demissão", function () {
            c.unemployed = true;
            if (!c.clubHistory) c.clubHistory = [];
            c.clubHistory.push({ clubId: c.teamId, clubName: c.teamName, season: c.season, left: "pediu demissão" });
            TM.notify.push(c, { icon: "🚪", title: "Demissão", news: true, text: "Você deixou o comando do " + (club ? club.name : "clube") + " e está livre no mercado." });
            // gera propostas imediatamente
            c._lastOfferGen = 0; try { C().generateJobOffers(c); } catch (e) {}
            TM.storage.saveCoachCareer(c);
            TM.ui.go("coach-offers");
          }, true);
        }, "btn danger")
      ]));
    } else {
      wrap.appendChild(TM.ui.button("🔄 Procurar propostas", function () {
        c._lastOfferGen = 0; try { C().generateJobOffers(c); } catch (e) {}
        TM.storage.saveCoachCareer(c);
        TM.ui.go("coach-offers");
      }, "btn"));
    }

    // histórico de clubes
    if ((c.clubHistory || []).length) {
      var hist = el("div", { class: "offers-hist" }, [ el("div", { class: "oh-t", text: "🗂️ Passagens anteriores" }) ]);
      c.clubHistory.slice().reverse().forEach(function (h) {
        hist.appendChild(el("div", { class: "oh-row", text: (h.clubName || "Clube") + " — temporada " + (h.season || "?") + " · " + (h.left || "") }));
      });
      wrap.appendChild(hist);
    }
  });

  /* ---------- PERFIL / ANÁLISE do jogador (tela cheia, com abas) ---------- */
  var profilePid = null, profileBack = "coach-squad", profileTab = "geral";
  function openPlayerProfile(player, back) { profilePid = player.id; profileBack = back || "coach-squad"; profileTab = "geral"; TM.ui.go("coach-player"); }
  TM.coachUI.openPlayer = openPlayerProfile;
  TM.coachUI.idolStatus = idolStatus; TM.coachUI.agentOf = agentOf;

  function gaugeSVG(val, max, label, color) {
    var pct = Math.max(0, Math.min(1, val / max));
    var r = 30, cx = 36, cy = 36, circ = 2 * Math.PI * r;
    var dash = (pct * circ).toFixed(1) + " " + circ.toFixed(1);
    return el("div", { class: "gauge" }, [
      el("div", { class: "gauge-ring", html:
        '<svg viewBox="0 0 72 72" width="72" height="72">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="6"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + dash + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
        '<text x="36" y="42" text-anchor="middle" font-family="Arial" font-size="20" font-weight="800" fill="#fff">' + val + '</text></svg>' }),
      el("div", { class: "gauge-lbl", text: label })
    ]);
  }
  function gaugeHidden(label) {
    var r = 30, cx = 36, cy = 36, circ = 2 * Math.PI * r;
    return el("div", { class: "gauge" }, [
      el("div", { class: "gauge-ring", html:
        '<svg viewBox="0 0 72 72" width="72" height="72">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="6"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(74,222,128,.35)" stroke-width="6" stroke-dasharray="4 8"/>' +
        '<text x="36" y="44" text-anchor="middle" font-family="Arial" font-size="26" font-weight="800" fill="#4ade80">?</text></svg>' }),
      el("div", { class: "gauge-lbl", text: label })
    ]);
  }
  function formPill(res) { return el("span", { class: "fp fp-" + res, text: res }); }

  /* ---------- análise do jogador: gráficos (radar, campinho, projeção) ---------- */
  var ATTR6 = [["pac", "VEL", "Velocidade"], ["sho", "FIN", "Finalização"], ["pas", "PAS", "Passe"], ["dri", "DRI", "Drible"], ["def", "DEF", "Defesa"], ["phy", "FÍS", "Físico"]];
  function attrColor(v) { return v >= 85 ? "#f5c542" : v >= 75 ? "#22c55e" : v >= 62 ? "#eab308" : "#ef4444"; }
  function radarSVG(a, avg, color) {
    var cx = 125, cy = 100, R = 76, n = ATTR6.length;
    function pt(i, r) { var ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]; }
    var grid = "";
    [0.25, 0.5, 0.75, 1].forEach(function (f) { grid += '<polygon points="' + ATTR6.map(function (k, i) { return pt(i, R * f).join(","); }).join(" ") + '" fill="none" stroke="rgba(255,255,255,.12)"/>'; });
    var axes = ATTR6.map(function (k, i) { var e = pt(i, R); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0] + '" y2="' + e[1] + '" stroke="rgba(255,255,255,.12)"/>'; }).join("");
    function poly(vals) { return ATTR6.map(function (k, i) { return pt(i, R * Math.max(0.05, Math.min(1, (vals[k[0]] || 40) / 100))).join(","); }).join(" "); }
    var avgPoly = avg ? '<polygon points="' + poly(avg) + '" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/>' : "";
    var labels = ATTR6.map(function (k, i) { var e = pt(i, R + 16); var v = a[k[0]] || 40; return '<text x="' + e[0] + '" y="' + (e[1] + 4) + '" text-anchor="middle" font-size="10" font-weight="800" fill="' + attrColor(v) + '">' + k[1] + ' ' + v + '</text>'; }).join("");
    var dots = ATTR6.map(function (k, i) { var e = pt(i, R * Math.max(0.05, Math.min(1, (a[k[0]] || 40) / 100))); return '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="3" fill="' + attrColor(a[k[0]] || 40) + '"/>'; }).join("");
    return '<svg viewBox="0 0 250 200" class="radar-svg"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".75"/><stop offset="1" stop-color="#f5c542" stop-opacity=".45"/></linearGradient></defs>' + grid + axes + avgPoly + '<polygon points="' + poly(a) + '" fill="url(#rg)" stroke="' + color + '" stroke-width="2"/>' + dots + labels + '</svg>';
  }
  var PITCH_XY = { GOL: [50, 128], LD: [84, 100], LE: [16, 100], ZAG: [50, 108], VOL: [50, 82], MC: [50, 66], MEI: [50, 50], PD: [84, 34], PE: [16, 34], SA: [50, 32], CA: [50, 14] };
  var POS_ALT = { GOL: [], LD: ["PD"], LE: ["PE"], ZAG: ["VOL"], VOL: ["ZAG", "MC"], MC: ["VOL", "MEI"], MEI: ["MC", "SA"], PD: ["LD", "SA"], PE: ["LE", "SA"], SA: ["MEI", "CA"], CA: ["SA"] };
  var ROLE_TXT = { GOL: "Goleiro: reflexos, saída do gol e segurança nos cruzamentos.", LD: "Lateral direito: apoio pelo lado, cruzamentos e recomposição.", LE: "Lateral esquerdo: profundidade, cruzamentos e marcação do ponta.", ZAG: "Zagueiro: jogo aéreo, antecipação e saída de bola.", VOL: "Volante: proteção da zaga, desarmes e distribuição curta.", MC: "Meio-campo central: equilíbrio entre marcação e construção.", MEI: "Meia armador: último passe, visão e finalização de fora.", PD: "Ponta direita: velocidade, drible e chegada ao fundo.", PE: "Ponta esquerda: 1x1, diagonal e cruzamentos.", SA: "Segundo atacante: flutuação entre as linhas e tabelas.", CA: "Centroavante: finalização, pivô e presença de área." };
  function pitchSVG(p) {
    var main = p.pos2 || (p.pos === "GK" ? "GOL" : p.pos === "DF" ? "ZAG" : p.pos === "FW" ? "CA" : "MC");
    var alts = POS_ALT[main] || [];
    var out = '<svg viewBox="0 0 100 140" class="pitch-svg"><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f7a3a"/><stop offset="1" stop-color="#0e4d24"/></linearGradient></defs><rect x="0" y="0" width="100" height="140" rx="4" fill="url(#pg)"/>';
    out += '<g stroke="rgba(255,255,255,.55)" fill="none" stroke-width="1"><rect x="4" y="4" width="92" height="132"/><line x1="4" y1="70" x2="96" y2="70"/><circle cx="50" cy="70" r="11"/><rect x="24" y="4" width="52" height="20"/><rect x="24" y="116" width="52" height="20"/><rect x="38" y="4" width="24" height="8"/><rect x="38" y="128" width="24" height="8"/></g>';
    Object.keys(PITCH_XY).forEach(function (k) {
      var xy = PITCH_XY[k], isMain = k === main, isAlt = alts.indexOf(k) >= 0;
      if (k === "ZAG" || k === "MC") { /* duplica zagueiro/meia central nos dois lados */ }
      var fill = isMain ? "#f5c542" : isAlt ? "rgba(34,197,94,.9)" : "rgba(255,255,255,.18)";
      out += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="' + (isMain ? 7 : 5) + '" fill="' + fill + '" stroke="' + (isMain ? "#fff" : "rgba(255,255,255,.4)") + '" stroke-width="' + (isMain ? 1.5 : 0.8) + '"/>';
      out += '<text x="' + xy[0] + '" y="' + (xy[1] + 2.4) + '" text-anchor="middle" font-size="' + (isMain ? 5.2 : 4.2) + '" font-weight="800" fill="' + (isMain ? "#1a1a1a" : "#fff") + '">' + k + '</text>';
    });
    return out + '</svg>';
  }
  function traitsOf(p) {
    var a = p.attrs || {}, t = [];
    if (a.pac >= 84) t.push(["⚡", "Velocista"]); if (a.sho >= 82) t.push(["🎯", "Finalizador"]); if (a.pas >= 83) t.push(["🧠", "Maestro"]);
    if (a.dri >= 83) t.push(["🌀", "Driblador"]); if (a.def >= 83) t.push(["🧱", "Muralha"]); if (a.phy >= 83) t.push(["💪", "Força física"]);
    if (p.pos === "MF" && Math.abs((a.def || 0) - (a.pas || 0)) <= 6 && a.phy >= 74) t.push(["🔁", "Box-to-box"]);
    if (p.pos === "FW" && a.pas >= 78 && a.dri >= 78) t.push(["🎩", "Criador"]);
    if (p.pos === "DF" && a.pas >= 76) t.push(["📤", "Saída de bola"]);
    if ((p.age || 25) <= 21 && (p.potential || p.overall) - p.overall >= 8) t.push(["💎", "Promessa"]);
    if ((p.age || 25) >= 32) t.push(["🎖️", "Experiente"]);
    if (!t.length) t.push(["⚖️", "Equilibrado"]);
    return t.slice(0, 4);
  }
  function projectionSVG(p) {
    var age = p.age || 25, ov = p.overall, pot = p.potential || ov, W = 300, H = 110, x0 = 30, y0 = 8, w = W - 40, h = H - 30;
    var ages = [], vals = [], peak = 27, end = 36;
    for (var a2 = age; a2 <= end; a2++) {
      var v;
      if (a2 <= peak) v = ov + (pot - ov) * Math.min(1, (a2 - age) / Math.max(1, peak - age));
      else v = pot - (a2 - peak) * (a2 - peak) * 0.45;
      ages.push(a2); vals.push(Math.max(40, v));
    }
    var minV = Math.min.apply(null, vals) - 4, maxV = Math.max.apply(null, vals) + 4;
    function X(i) { return x0 + (i / Math.max(1, ages.length - 1)) * w; }
    function Y(v) { return y0 + (1 - (v - minV) / Math.max(1, maxV - minV)) * h; }
    var path = vals.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join(" ");
    var area = path + " L" + X(vals.length - 1).toFixed(1) + " " + (y0 + h) + " L" + x0 + " " + (y0 + h) + " Z";
    var ticks = ages.filter(function (a3, i) { return i % 3 === 0 || i === ages.length - 1; }).map(function (a3) { var i = ages.indexOf(a3); return '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.6)">' + a3 + '</text>'; }).join("");
    var pk = vals.indexOf(Math.max.apply(null, vals));
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="proj-svg"><defs><linearGradient id="pj" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22c55e" stop-opacity=".55"/><stop offset="1" stop-color="#22c55e" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#pj)"/><path d="' + path + '" fill="none" stroke="#22c55e" stroke-width="2.2"/>' +
      '<circle cx="' + X(0) + '" cy="' + Y(vals[0]) + '" r="4" fill="#fff"/><text x="' + (X(0) + 6) + '" y="' + (Y(vals[0]) - 6) + '" font-size="10" font-weight="800" fill="#fff">' + ov + ' hoje</text>' +
      (pk > 0 ? '<circle cx="' + X(pk) + '" cy="' + Y(vals[pk]) + '" r="4" fill="#f5c542"/><text x="' + Math.min(W - 60, X(pk) + 6) + '" y="' + (Y(vals[pk]) - 6) + '" font-size="10" font-weight="800" fill="#f5c542">pico ' + Math.round(vals[pk]) + ' aos ' + ages[pk] + '</text>' : "") + ticks + '</svg>';
  }
  // helpers do perfil gráfico, reaproveitados pelo modal de jogador de todos os modos
  TM.profile = { ATTR6: ATTR6, radarSVG: radarSVG, pitchSVG: pitchSVG, traitsOf: traitsOf, projectionSVG: projectionSVG, gaugeSVG: gaugeSVG, attrColor: attrColor, POS_ALT: POS_ALT, ROLE_TXT: ROLE_TXT };
  function squadAvgAttrs(c) {
    var ps = []; try { ps = C().rosterPlayers(c); } catch (e) {}
    if (!ps.length) return null;
    var avg = {}; ATTR6.forEach(function (k) { var sum = 0, n = 0; ps.forEach(function (q) { if (q.attrs && q.attrs[k[0]] != null) { sum += q.attrs[k[0]]; n++; } }); avg[k[0]] = n ? Math.round(sum / n) : 50; });
    return avg;
  }

  // ----- número da camisa: escolha 1–99; número ocupado troca com o dono (persistido em c.numbers) -----
  function setNumber(c, p, n) {
    c.numbers = c.numbers || {};
    p.number = n; c.numbers[p.id] = n;
  }
  function openNumberPicker(c, p) {
    var owners = {};
    C().rosterPlayers(c).forEach(function (q) { if (q.id !== p.id && q.number > 0) owners[q.number] = q; });
    var overlay = el("div", { class: "sheet-overlay modal show", on: { click: function (e) { if (e.target === overlay) overlay.remove(); } } });
    var grid = el("div", { class: "num-grid" });
    for (var n = 1; n <= 99; n++) {
      (function (n) {
        var own = owners[n], mine = p.number === n;
        var b = el("button", { class: "num-cell" + (mine ? " mine" : own ? " taken" : ""), title: own ? own.name : "" }, [
          el("span", { class: "nc-n", text: n }), own ? el("span", { class: "nc-who", text: shortName(own.name) }) : null
        ]);
        b.addEventListener("click", function () {
          if (mine) { overlay.remove(); return; }
          if (own) {
            overlay.remove();
            TM.ui.confirm("Trocar números?", "A camisa " + n + " é de " + own.name + ". " + p.name + " fica com a " + n + " e " + own.name + (p.number > 0 ? " passa a usar a " + p.number + "." : " fica sem número."), "Trocar", function () {
              var old = p.number || 0; setNumber(c, p, n); setNumber(c, own, old);
              TM.storage.saveCoachCareer(c); TM.ui.toast("🔢 " + p.name + " agora usa a camisa " + n + "."); TM.ui.go("coach-player");
            });
            return;
          }
          setNumber(c, p, n); TM.storage.saveCoachCareer(c); overlay.remove();
          TM.ui.toast("🔢 " + p.name + " agora usa a camisa " + n + "."); TM.ui.go("coach-player");
        });
        grid.appendChild(b);
      })(n);
    }
    var sheet = el("div", { class: "sheet num-sheet" }, [
      el("div", { class: "sheet-title", text: "Camisa de " + p.name + (p.number > 0 ? " (atual: " + p.number + ")" : "") }),
      el("div", { class: "sheet-msg", text: "Toque num número livre. Número ocupado mostra o dono: tocar troca as camisas entre os dois." }),
      grid,
      el("button", { class: "sheet-item cancel", text: "Cancelar", on: { click: function () { overlay.remove(); } } })
    ]);
    overlay.appendChild(sheet); document.body.appendChild(overlay);
  }
  TM.coachUI.openNumberPicker = openNumberPicker;

  /* ---------- RENOVAÇÃO DE CONTRATO (negociação igual à de contratação) ---------- */
  var RENEW = null;   // { pid, rounds, demandWage, demandYears, lastLine }
  function renewOpen(c, p) {
    var ct = (c.contracts && c.contracts[p.id]) || { years: 1, wage: wageDemand(p), clause: 0 };
    var ag = agentOf(p);
    var idol = null; try { idol = idolStatus(c, p); } catch (e) {}
    var apps = (c.pstats && c.pstats[p.id] && c.pstats[p.id].apps) || 0, jogos = c.matchNo || 0;
    var usoRatio = jogos ? apps / jogos : 0.5;
    // quanto ele pede: mercado x empresário x fase x minutos x tempo de casa
    var base = wageDemand(p) * ag.wageMult;
    base *= (usoRatio >= 0.6 ? 1.12 : usoRatio <= 0.25 ? 0.9 : 1);
    if (idol && idol.cls === "legend") base *= 0.92;                       // ídolo facilita
    if ((ct.years || 0) <= 1) base *= 1.1;                                  // fim de contrato: força na negociação
    if ((p.age || 25) >= 33) base *= 0.8;
    var st = c.pstats && c.pstats[p.id];
    if (st && st.rn && (st.rsum / st.rn) >= 7.2) base *= 1.15;              // temporada de gala
    RENEW = { pid: p.id, rounds: 0, demandWage: r2(curVal(c, base)), demandYears: (p.age || 25) >= 32 ? 1 : (p.age || 25) <= 23 ? 4 : 3, done: false };
    TM.ui.go("coach-renew");
  }
  TM.coachUI.renewOpen = renewOpen;

  TM.ui.register("coach-renew", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c || !RENEW) { TM.ui.go("coach-squad"); return; }
    var p = C().resolvePlayer(c, RENEW.pid);
    if (!p) { RENEW = null; TM.ui.go("coach-squad"); return; }
    var ct = (c.contracts && c.contracts[p.id]) || { years: 1, wage: 0, clause: 0 };
    var ag = agentOf(p), idol = null; try { idol = idolStatus(c, p); } catch (e) {}
    var mvalCur = curVal(c, TM.data.marketValue(p));
    var curWage = curVal(c, ct.wage || 0);
    var terms = { wage: RENEW.demandWage, years: RENEW.demandYears, role: "titular", release: !!ct.clause, clauseM: ct.clause ? curVal(c, ct.clause) : r2(mvalCur * 2.5) };

    screen.appendChild(TM.ui.topbar("Renovação de contrato", function () { RENEW = null; TM.ui.go("coach-player"); }));
    screen.appendChild(el("div", { class: "nego-step" }, [ el("div", { class: "nego-dot active", text: "Conversa com " + p.name + " e o empresário" }) ]));

    screen.appendChild(el("div", { class: "nego2-player", style: "max-width:640px;margin:10px auto 0" }, [
      TM.img.playerImg(p, "nego2-face"),
      el("div", { class: "nego2-pinfo" }, [
        el("div", { class: "nego2-pname", text: p.name + (idol ? " " + idol.ic : "") }),
        el("div", { class: "nego2-pmeta" }, [
          el("span", { text: TM.data.posLabel(p) }), el("span", { text: (p.age || 25) + " anos" }), el("span", { text: p.overall + " OVR" })
        ])
      ])
    ]));

    var panel = el("div", { class: "nego-panel" }); screen.appendChild(panel);
    panel.appendChild(el("div", { class: "deal-line" }, [
      el("span", { class: "deal-lbl", text: "📜 Contrato atual" }),
      el("span", { class: "deal-val", text: (ct.years || 0) + " temporada(s) · " + money(c, curWage) + "/ano" + (ct.clause ? " · cláusula " + money(c, curVal(c, ct.clause)) : " · sem cláusula") })
    ]));
    var quote = el("div", { class: "nego-quote", text: RENEW.lastLine || (p.name + ": “Gosto daqui. Para renovar, quero cerca de " + money(c, RENEW.demandWage) + " por ano e " + RENEW.demandYears + " temporada(s).”") });
    panel.appendChild(quote);
    panel.appendChild(el("div", { class: "agent-line agent-" + ag.type }, [
      el("span", { class: "agent-ic", text: ag.ic }),
      el("div", { class: "agent-info" }, [
        el("div", { class: "agent-name", text: ag.label + " · " + ag.name }),
        el("div", { class: "agent-note", text: "“" + ag.line + "”" })
      ])
    ]));

    function segRow(options, def, cb) {
      var row = el("div", { class: "segmented" });
      options.forEach(function (o) {
        var val = Array.isArray(o) ? o[0] : o, lbl = Array.isArray(o) ? o[1] : o;
        var b = el("button", { class: "seg-btn" + (String(val) === String(def) ? " active" : ""), text: lbl, on: { click: function () {
          Array.prototype.forEach.call(row.children, function (x) { x.classList.remove("active"); });
          b.classList.add("active"); cb(val);
        } } });
        row.appendChild(b);
      });
      return row;
    }

    var wageVal = el("span", { class: "range-val", text: money(c, terms.wage) + "/ano" });
    var wageMax = Math.max(0.15, r2(RENEW.demandWage * 3)), wStep = moneyStep(wageMax);
    var wageSlider = el("input", { type: "range", min: wStep, max: wageMax, step: wStep, value: Math.min(terms.wage, wageMax), class: "slider" });
    wageSlider.addEventListener("input", function () { terms.wage = r2(parseFloat(wageSlider.value)); wageVal.textContent = money(c, terms.wage) + "/ano"; });
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Novo salário anual (hoje: " + money(c, curWage) + ")" }), el("div", { class: "range-wrap" }, [ wageSlider, wageVal ]) ]));

    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Tempo de contrato (anos)" }), segRow(["1", "2", "3", "4", "5"], String(terms.years), function (v) { terms.years = parseInt(v, 10); }) ]));
    panel.appendChild(el("div", { class: "nego-field" }, [ el("label", { text: "Função no elenco" }), segRow([["estrela", "Estrela"], ["titular", "Titular"], ["rodizio", "Rodízio"], ["promessa", "Promessa"]], "titular", function (v) { terms.role = v; }) ]));

    var clMin = Math.max(0.1, r2(mvalCur * 1)), clMax = Math.max(clMin + 0.5, r2(mvalCur * 6)), clStep = moneyStep(clMax);
    terms.clauseM = r2(Math.min(clMax, Math.max(clMin, terms.clauseM)));
    var clVal = el("span", { class: "range-val", text: money(c, terms.clauseM) });
    var clSlider = el("input", { type: "range", min: clMin, max: clMax, step: clStep, value: terms.clauseM, class: "slider" });
    var clNote = el("div", { class: "sweet-note" });
    function clTxt() { var m = terms.clauseM / Math.max(0.01, mvalCur); clNote.textContent = "Cláusula = " + m.toFixed(1) + "x o valor de mercado. " + (m <= 1.5 ? "Baixa: ele aceita salário menor, mas sai fácil." : m >= 4 ? "Alta: protege o clube, porém ele pede mais salário." : "Equilibrada."); }
    clSlider.addEventListener("input", function () { terms.clauseM = r2(parseFloat(clSlider.value)); clVal.textContent = money(c, terms.clauseM); clTxt(); });
    var clWrap = el("div", { class: "nego-field", style: terms.release ? "" : "display:none" }, [ el("label", { text: "Valor da cláusula de rescisão" }), el("div", { class: "range-wrap" }, [ clSlider, clVal ]), clNote ]);
    clTxt();
    var relBtn = el("button", { class: "switch" + (terms.release ? " on" : ""), on: { click: function () { terms.release = !terms.release; relBtn.classList.toggle("on", terms.release); clWrap.style.display = terms.release ? "" : "none"; } } });
    panel.appendChild(el("div", { class: "nego-field", style: "flex-direction:row;justify-content:space-between;align-items:center" }, [ el("label", { text: "Incluir cláusula de rescisão" }), relBtn ]));
    panel.appendChild(clWrap);

    panel.appendChild(el("div", { class: "setting-hint", text: "Rodada " + (RENEW.rounds + 1) + " de 3. Se a conversa travar, ele só volta a negociar mais para a frente." }));

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("🤝 Oferecer renovação", function () {
        var roleScore = { estrela: 1.18, titular: 1.0, rodizio: 0.78, promessa: 0.7 }[terms.role] || 1;
        var clMult = terms.release ? terms.clauseM / Math.max(0.01, mvalCur) : 0;
        var clFactor = clMult ? (clMult <= 1.5 ? 0.88 : clMult >= 4 ? 1.12 : 1) : 1.05;   // sem cláusula ele pede um pouco mais
        var precisa = RENEW.demandWage * clFactor / roleScore;
        var anosOk = terms.years >= Math.max(1, RENEW.demandYears - 1);
        if (!anosOk) precisa *= 1.12;
        RENEW.rounds++;
        if (terms.wage >= precisa * 0.98) {
          c.contracts = c.contracts || {};
          var novo = c.contracts[p.id] || {};
          novo.years = terms.years;
          novo.wage = r2(terms.wage / (c.money ? c.money.mult : 1));
          novo.clause = terms.release ? r2(terms.clauseM / (c.money ? c.money.mult : 1)) : 0;
          novo.role = terms.role;
          c.contracts[p.id] = novo;
          if (c.leavingFree) delete c.leavingFree[p.id];
          if (c.transferReq) delete c.transferReq[p.id];
          try { C().logDeal(c, { type: "renew", kind: "renew", pid: p.id, name: p.name, pos: p.pos, ov: p.overall, fee: 0, other: (TM.data.club(c.teamId) || {}).name }); } catch (e) {}
          TM.notify.push(c, { icon: "✍️", title: "Renovação assinada", news: true,
            text: p.name + " renovou com o " + (TM.data.club(c.teamId) || {}).name + " por mais " + terms.years + " temporada(s), a " + money(c, terms.wage) + "/ano" + (terms.release ? ", com cláusula de " + money(c, terms.clauseM) : ", sem cláusula de rescisão") + "." });
          try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { name: p.name, ov: p.overall, toName: (TM.data.club(c.teamId) || {}).name, free: true, val: 0 }); } catch (e) {}
          try { if (c.confidence && typeof c.confidence === "object") c.confidence[p.id] = Math.min(5, (c.confidence[p.id] || 0) + 2); } catch (e) {}
          RENEW = null; TM.storage.saveCoachCareer(c);
          TM.ui.toast("✍️ " + p.name + " renovou!"); TM.ui.go("coach-player"); return;
        }
        // recusa: ele explica e (se ainda houver rodada) pede um meio-termo
        var falta = Math.round((precisa / Math.max(0.01, terms.wage) - 1) * 100);
        if (RENEW.rounds >= 3) {
          c.renewBlock = c.renewBlock || {}; c.renewBlock[p.id] = (c.matchNo || 0) + 8;
          TM.notify.push(c, { icon: "🚪", title: "Renovação travada", text: p.name + " encerrou a conversa sobre renovação. Ele só volta a negociar daqui a algumas rodadas." });
          try { if (c.confidence && typeof c.confidence === "object") c.confidence[p.id] = Math.max(-5, (c.confidence[p.id] || 0) - 1); } catch (e) {}
          RENEW = null; TM.storage.saveCoachCareer(c);
          TM.ui.toast("A negociação travou."); TM.ui.go("coach-player"); return;
        }
        var meio = r2(Math.min(precisa, terms.wage + (precisa - terms.wage) * 0.6));
        RENEW.demandWage = meio;
        RENEW.lastLine = p.name + ": “" + (falta >= 40 ? "Está bem longe do que eu esperava." : falta >= 15 ? "Ainda falta um pouco." : "Estamos quase lá.") + " Por " + money(c, meio) + " por ano" + (anosOk ? "" : " e pelo menos " + Math.max(1, RENEW.demandYears - 1) + " temporadas") + " eu assino.”";
        TM.storage.saveCoachCareer(c);
        TM.ui.go("coach-renew");
      }, "btn primary"),
      TM.ui.button("Deixar para depois", function () { RENEW = null; TM.ui.go("coach-player"); }, "btn ghost")
    ]));
  });

  TM.ui.register("coach-player", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c || !profilePid) { TM.ui.go(profileBack); return; }
    var p = C().resolvePlayer(c, profilePid) || TM.data.player(profilePid);
    if (!p) { TM.ui.go(profileBack); return; }
    var st = (c.pstats && c.pstats[p.id]) || null;
    var pot = p.potential || p.overall;
    var baseEur = TM.data.marketValue(p);
    var dynEur = baseEur; try { dynEur = C().dynValue(c, p); } catch (e) {}
    var val = curVal(c, dynEur);
    var valTrend = dynEur > baseEur * 1.08 ? "up" : dynEur < baseEur * 0.92 ? "down" : "";
    var nation = p.nationId ? TM.data.nation(p.nationId) : null;

    screen.appendChild(TM.ui.topbar("Análise do jogador", function () { TM.ui.go(profileBack); }));
    addSectorBar(screen, "coach-squad");

    var wrap = el("div", { class: "prof-wrap" });
    screen.appendChild(wrap);

    // ---- header ----
    var pcl = (p.clubId && p.clubId !== "free") ? TM.data.club(p.clubId) : null;
    var pc1 = (pcl && pcl.colors && pcl.colors.primary) || "#1e9e4a", pc2 = (pcl && pcl.colors && pcl.colors.secondary) || "#0b2a1a";
    var head = el("div", { class: "prof-head prof-head-grad", style: "background: linear-gradient(135deg, " + pc1 + "cc 0%, " + pc2 + "cc 55%, var(--panel) 100%)" }, [
      TM.img.playerImg(p, "prof-face"),
      el("div", { class: "prof-id" }, [
        el("div", { class: "prof-name" }, [
          (p.number > 0 ? el("span", { class: "prof-num", text: "#" + p.number }) : null), document.createTextNode(p.name),
          (c.roster.indexOf(p.id) >= 0) ? el("button", { class: "num-edit", title: "Trocar número da camisa", text: "🔢", on: { click: function () { openNumberPicker(c, p); } } }) : null
        ].filter(Boolean)),
        el("div", { class: "prof-meta" }, [
          (p.nationName || (nation && nation.name)) ? el("span", { class: "prof-nat", text: p.nationName || nation.name }) : null,
          el("span", { text: p.age + " anos" }),
          el("span", { class: "prof-pos pos-" + (p.pos || "MF"), text: TM.data.posLabel(p) }),
          el("span", { class: "prof-val" + (valTrend ? " vt-" + valTrend : ""), html: money(c, val) + (valTrend === "up" ? " <span class='vt-arrow'>▲</span>" : valTrend === "down" ? " <span class='vt-arrow'>▼</span>" : "") })
        ])
      ]),
      el("div", { class: "prof-gauges" }, [
        gaugeSVG(p.overall, 99, "OVR", "#22c55e"),
        (p.hiddenPot && !(c.scouted && c.scouted[p.id]))
          ? gaugeHidden("POT")
          : gaugeSVG(pot, 99, "POT", pot > p.overall ? "#4ade80" : "#8aa0b2")
      ])
    ]);
    wrap.appendChild(head);
    wrap.appendChild(el("div", { class: "trait-row" }, traitsOf(p).map(function (t) { return el("span", { class: "trait-chip", text: t[0] + " " + t[1] }); }).concat([
      pcl ? el("span", { class: "trait-chip club", text: "🏟️ " + pcl.name }) : null,
      p.pos2 ? el("span", { class: "trait-chip pos", text: "📍 " + p.pos2 }) : null
    ])));

    // ---- potencial oculto / joia rara (jogadores jovens ainda não observados) ----
    if (p.hiddenPot) {
      var scouted = c.scouted && c.scouted[p.id];
      if (!scouted) {
        wrap.appendChild(el("div", { class: "scout-pot" }, [
          el("div", { class: "sp-info" }, [
            el("div", { class: "sp-t", text: "🔎 Potencial desconhecido" }),
            el("div", { class: "sp-s", text: "Coloque um observador para revelar o teto de " + shortName(p.name) + "." })
          ]),
          TM.ui.button("👁️ Observar", function () {
            c.scouted = c.scouted || {}; c.scouted[p.id] = true;
            TM.storage.saveCoachCareer(c);
            var jw = p.jewel || p.potential >= 82;
            TM.notify.push(c, { icon: jw ? "💎" : "🔎", title: jw ? "JOIA RARA revelada!" : "Relatório do observador",
              text: "O observador avaliou " + p.name + ": potencial " + p.potential + (jw ? ". Um talento raro — segure esse jogador!" : ".") });
            TM.ui.toast(jw ? "💎 Joia rara descoberta!" : "Potencial revelado."); TM.ui.go("coach-player");
          }, "btn primary small")
        ]));
      } else if (p.jewel || p.potential >= 82) {
        wrap.appendChild(el("div", { class: "jewel-badge", html: "💎 <b>JOIA RARA</b> — potencial " + p.potential + ", segure esse talento!" }));
      }
    }

    // ---- moral individual (só faz sentido para jogadores do meu elenco) ----
    var inMySquad = (c.roster || []).indexOf(p.id) >= 0;
    if (inMySquad) {
      // selo de ídolo / cria do clube
      var idol = idolStatus(c, p);
      if (idol) {
        var tn = (c.tenure && c.tenure[p.id]) || 0;
        wrap.appendChild(el("div", { class: "idol-badge idol-" + idol.cls }, [
          el("span", { class: "idol-ic", text: idol.ic }),
          el("div", { class: "idol-info" }, [
            el("div", { class: "idol-t", text: idol.label }),
            el("div", { class: "idol-s", text: (c.homegrown && c.homegrown[p.id] ? "Formado na base · " : "") + tn + " temporada(s) de casa" })
          ])
        ]));
      }
      var mo = playerMorale(c, p);
      wrap.appendChild(el("div", { class: "pmorale mm-" + mo.cls }, [
        el("span", { class: "pmo-face", text: mo.v >= 70 ? "😃" : mo.v >= 45 ? "😐" : "😞" }),
        el("div", { class: "pmo-info" }, [
          el("div", { class: "pmo-top" }, [ el("span", { class: "pmo-lbl", text: "Moral · " + mo.txt }), el("span", { class: "pmo-val mm-" + mo.cls, text: mo.v + "%" }) ]),
          el("div", { class: "pmo-bar" }, [ el("div", { class: "pmo-fill mm-" + mo.cls, style: "width:" + mo.v + "%" }) ])
        ])
      ]));

      // ---- conversa individual (elogiar / cobrar / explicar o banco) ----
      (function () {
        var talkedAt = (c.talkedAt && c.talkedAt[p.id]);
        var onCooldown = talkedAt != null && talkedAt === (c.matchNo || 0);
        function doTalk(kind) {
          c.moraleAdj = c.moraleAdj || {}; c.talkedAt = c.talkedAt || {};
          c.talkedAt[p.id] = (c.matchNo || 0);
          var cur = playerMorale(c, p).v, msg, delta;
          if (kind === "praise") {
            delta = cur >= 85 ? 3 : 9;   // já muito feliz, elogio rende menos
            msg = { icon: "👏", title: "Elogio", text: "Você elogiou " + p.name + " pelo empenho. Ele saiu da conversa mais confiante." };
          } else if (kind === "demand") {
            var motivated = Math.random() < (cur < 55 ? 0.72 : 0.5);
            delta = motivated ? 7 : -8;
            msg = motivated
              ? { icon: "📢", title: "Cobrança", text: "Você cobrou mais de " + p.name + ". Ele encarou como desafio e prometeu responder em campo." }
              : { icon: "😠", title: "Cobrança", text: p.name + " não gostou da cobrança e saiu contrariado do vestiário." };
          } else { // bench
            delta = 6;
            if (c.transferReq && c.transferReq[p.id] && Math.random() < 0.5) delete c.transferReq[p.id];
            msg = { icon: "🪑", title: "Papo franco", text: "Você explicou o momento no banco a " + p.name + ". Ele entendeu a situação e vai seguir trabalhando." };
          }
          c.moraleAdj[p.id] = { v: Math.max(-20, Math.min(20, (moraleAdjOf(c, p.id)) + delta)), at: (c.matchNo || 0) };
          TM.storage.saveCoachCareer(c);
          TM.notify.push(c, msg);
          TM.ui.toast(delta >= 0 ? "Conversa positiva 👍" : "Não foi bem 👎");
          TM.ui.go("coach-player");
        }
        var card = el("div", { class: "talk-card" }, [ el("div", { class: "talk-h", text: "💬 Conversar com " + shortName(p.name) }) ]);
        if (onCooldown) {
          card.appendChild(el("div", { class: "talk-cd", text: "Você já conversou com ele nesta semana. Fale de novo após a próxima partida." }));
        } else {
          card.appendChild(el("div", { class: "talk-acts" }, [
            TM.ui.button("👏 Elogiar", function () { doTalk("praise"); }, "btn ghost small"),
            TM.ui.button("📢 Cobrar", function () { doTalk("demand"); }, "btn ghost small"),
            TM.ui.button("🪑 Explicar banco", function () { doTalk("bench"); }, "btn ghost small")
          ]));
        }
        wrap.appendChild(card);
      })();

      // pedido de transferência: ações
      if (c.transferReq && c.transferReq[p.id]) {
        wrap.appendChild(el("div", { class: "treq-banner" }, [
          el("div", { class: "treq-t", text: "😤 " + shortName(p.name) + " pediu para ser negociado" }),
          el("div", { class: "treq-s", text: "Por falta de minutos. Você pode prometer mais oportunidades ou colocá-lo na lista de transferências." }),
          el("div", { class: "treq-acts" }, [
            TM.ui.button("🤝 Prometer minutos", function () {
              delete c.transferReq[p.id]; TM.storage.saveCoachCareer(c);
              TM.notify.push(c, { icon: "🤝", title: "Conversa", text: "Você prometeu mais minutos a " + p.name + ". Ele topou dar a volta por cima — agora precisa jogar de verdade." });
              TM.ui.toast("Promessa feita — dê minutos a ele!"); TM.ui.go("coach-player");
            }, "btn primary small"),
            TM.ui.button("📋 Listar p/ venda", function () { listForSale(c, p); }, "btn ghost small")
          ])
        ]));
      }
    }

    // ---- contrato (jogadores do meu elenco) ----
    if (inMySquad) {
      var ct = getContract(c, p.id);
      if (ct) {
        var yrsTxt = ct.years <= 0 ? "⚠ Contrato EXPIRADO" : ct.years === 1 ? "1 temporada (último ano)" : ct.years + " temporadas";
        wrap.appendChild(el("div", { class: "contract-card" }, [
          el("div", { class: "cc-h", text: "📜 Contrato" }),
          el("div", { class: "cc-grid" }, [
            el("div", { class: "cc-cell" }, [ el("div", { class: "cc-v" + (ct.years <= 1 ? " warn" : ""), text: ct.years <= 0 ? "0" : ct.years }), el("div", { class: "cc-l", text: "temporadas" }) ]),
            el("div", { class: "cc-cell" }, [ el("div", { class: "cc-v", text: money(c, curVal(c, ct.wage)) }), el("div", { class: "cc-l", text: "salário/ano" }) ]),
            el("div", { class: "cc-cell" }, [ el("div", { class: "cc-v", text: ct.clause ? money(c, curVal(c, ct.clause)) : "—" }), el("div", { class: "cc-l", text: ct.clause ? "cláusula" : "sem cláusula" }) ])
          ]),
          el("div", { class: "cc-note", text: yrsTxt + (c.leavingFree && c.leavingFree[p.id] ? " · 📝 assinou pré-contrato com o " + ((TM.data.club(c.leavingFree[p.id]) || {}).name || "outro clube") + " — sai de graça no fim da temporada" : "") }),
          (c.leavingFree && c.leavingFree[p.id]) ? el("div", { class: "setting-hint", text: "Não é mais possível renovar. Se quiser algum retorno, coloque-o à venda ainda nesta janela." }) :
          ((c.renewBlock && (c.renewBlock[p.id] || 0) > (c.matchNo || 0))
            ? el("div", { class: "setting-hint", text: "A conversa de renovação travou. Ele volta a negociar em " + ((c.renewBlock[p.id] || 0) - (c.matchNo || 0)) + " jogo(s)." })
            : TM.ui.button("✍️ Negociar renovação", function () { renewOpen(c, p); }, "btn small"))
        ]));
      }

      // ---- BARRA DE ÍDOLO ----
      try {
        var isc = C().idolScore ? C().idolScore(c, p) : null;
        if (isc && (c.roster || []).indexOf(p.id) >= 0) {
          var ibox = el("div", { class: "idol-box lv-" + isc.level.key }, [
            el("div", { class: "idol-head" }, [
              el("span", { class: "idol-ic", text: isc.level.ic }),
              el("div", { class: "idol-hinfo" }, [
                el("div", { class: "idol-lvl", text: isc.level.label }),
                el("div", { class: "idol-sub", text: isc.next ? "Faltam " + isc.faltam + " pontos para " + isc.next.label.toLowerCase() : "Nível máximo alcançado" })
              ]),
              el("span", { class: "idol-pts", text: isc.pts })
            ]),
            el("div", { class: "idol-bar" }, [ el("i", { style: "width:" + isc.pct + "%" }) ]),
            el("div", { class: "idol-steps" }, (C().IDOL_LEVELS || []).map(function (L) {
              return el("span", { class: "idol-step" + (isc.pts >= L.min ? " on" : ""), title: L.label + " (" + L.min + " pts)", text: L.ic });
            }))
          ]);
          var idet = el("div", { class: "idol-parts" });
          isc.parts.forEach(function (pt) {
            idet.appendChild(el("div", { class: "idol-part" + (pt.v < 0 ? " bad" : "") }, [
              el("span", { class: "idol-part-v", text: (pt.v > 0 ? "+" : "") + pt.v }),
              el("span", { class: "idol-part-l", text: pt.lbl })
            ]));
          });
          if (!isc.parts.length) idet.appendChild(el("div", { class: "setting-hint", text: "Ele ainda não construiu história aqui. Jogos, gols, assistências, títulos e tempo de casa aumentam o carinho da torcida." }));
          ibox.appendChild(idet);
          ibox.appendChild(el("div", { class: "setting-hint", text: "Ídolo pesa na hora de vender: a torcida se revolta e ele aceita ficar por menos." }));
          wrap.appendChild(ibox);
        }
      } catch (e) {}

      // ---- fim de contrato derruba o valor de mercado ----
      try {
        var cf = C().contractFactor ? C().contractFactor(c, p) : 1;
        if (cf < 0.98) wrap.appendChild(el("div", { class: "fin-ban warn", text: "📉 " + (cf <= 0.45 ? "Contrato encerrado ou pré-contrato assinado com outro clube" : cf <= 0.8 ? "Último ano de contrato" : "Contrato curto") + ": o valor de mercado dele caiu " + Math.round((1 - cf) * 100) + "%. Renove para recuperar o valor." }));
      } catch (e) {}

      // ---- quem está de olho nele (mercado) ----
      try { var ip = TM.disp ? TM.disp.interestPanel(c, p) : null; if (ip) wrap.appendChild(ip); } catch (e) {}

      // ---- histórico médico / risco de lesão ----
      var hist = (c.injHistory && c.injHistory[p.id]) || [];
      var injured = c.injuries && c.injuries[p.id] > 0;
      var risk = (c.injRisk && c.injRisk[p.id]) || 0;
      if (hist.length || injured || risk > 0) {
        var med = el("div", { class: "med-card" }, [ el("div", { class: "med-h", text: "🏥 Departamento médico" }) ]);
        if (injured) {
          var last = hist.length ? hist[hist.length - 1] : null;
          med.appendChild(el("div", { class: "med-status sev-" + (last ? last.sev : "leve") },
            [ el("span", { text: "🩼 Lesionado: " + (last ? last.label : "recuperando") + " · fora por ~" + c.injuries[p.id] + " jogo(s)" }) ]));
        } else if (risk >= 4) {
          med.appendChild(el("div", { class: "med-status sev-grave", html: "⚠ <b>Alto risco de recaída</b> — voltou há pouco de lesão séria. Evite forçar." }));
        } else if (risk > 0) {
          med.appendChild(el("div", { class: "med-status sev-moderada", text: "⚠ Em recuperação — risco de recaída elevado por mais alguns jogos." }));
        } else {
          med.appendChild(el("div", { class: "med-status sev-ok", text: "✔ Sem lesões no momento." }));
        }
        if (hist.length) {
          var histWrap = el("div", { class: "med-hist" });
          histWrap.appendChild(el("div", { class: "med-hist-t", text: "Histórico (" + hist.length + ")" }));
          hist.slice(-5).reverse().forEach(function (h) {
            histWrap.appendChild(el("div", { class: "med-row" }, [
              el("span", { class: "med-dot sev-" + h.sev }),
              el("span", { class: "med-lbl", text: (h.relapse ? "↻ " : "") + h.label }),
              el("span", { class: "med-meta", text: "T" + h.season + " · ~" + h.weeks + "j" })
            ]));
          });
          med.appendChild(histWrap);
        }
        wrap.appendChild(med);
      }

      // ---- mudança de posição (retrain) ----
      (function () {
        c.retrain = c.retrain || {};
        var rt = c.retrain[p.id];
        var card = el("div", { class: "retrain-card" }, [ el("div", { class: "rt-h", text: "🔧 Reposicionamento" }) ]);
        if (rt) {
          var pct = Math.min(100, Math.round((rt.prog || 0) / 8 * 100));
          card.appendChild(el("div", { class: "rt-prog-txt", text: "Treinando para " + POS_LABELS[rt.toPos] + " — " + pct + "% concluído (joga nessa posição para evoluir)." }));
          card.appendChild(el("div", { class: "rt-bar" }, [ el("div", { class: "rt-fill", style: "width:" + pct + "%" }) ]));
          card.appendChild(TM.ui.button("✖ Cancelar treino", function () { delete c.retrain[p.id]; TM.storage.saveCoachCareer(c); TM.ui.toast("Reposicionamento cancelado."); TM.ui.go("coach-player"); }, "btn ghost small"));
        } else {
          card.appendChild(el("div", { class: "rt-s", text: "Ensine " + shortName(p.name) + " a jogar em outra posição. Escolha o destino:" }));
          var opts = el("div", { class: "rt-opts" });
          ["GK", "DF", "MF", "FW"].filter(function (g) { return posGroupOf(p) !== g; }).forEach(function (g) {
            opts.appendChild(el("button", { class: "rt-opt", text: POS_LABELS[g], on: { click: function () {
              c.retrain[p.id] = { toPos: g, prog: 0 }; TM.storage.saveCoachCareer(c);
              TM.notify.push(c, { icon: "🔧", title: "Reposicionamento", text: p.name + " começou a treinar como " + POS_LABELS[g] + ". Dê minutos nessa função para ele evoluir." });
              TM.ui.toast("Treino iniciado!"); TM.ui.go("coach-player");
            } } }));
          });
          card.appendChild(opts);
        }
        wrap.appendChild(card);
      })();
    }

    // ---- ação: jogadores similares (scout) ----
    wrap.appendChild(el("button", { class: "prof-scout-btn", on: { click: function () { openSimilar(p, "coach-player"); } } }, [
      el("span", { text: "🧬 Buscar jogadores similares" }), el("span", { class: "psb-arrow", text: "›" })
    ]));

    // ---- abas ----
    var TABS = [["geral", "Visão Geral"], ["attrs", "Atributos"], ["tat", "Tático"], ["hist", "Histórico"], ["ins", "Insights"]];
    var tabBar = el("div", { class: "prof-tabs" });
    TABS.forEach(function (t) {
      tabBar.appendChild(el("button", { class: "prof-tab" + (profileTab === t[0] ? " on" : ""), text: t[1], on: { click: function () { profileTab = t[0]; TM.ui.go("coach-player"); } } }));
    });
    wrap.appendChild(tabBar);
    var body = el("div", { class: "prof-body" });
    wrap.appendChild(body);

    function statCell(v, lbl, cls) { return el("div", { class: "pstat-cell" }, [ el("div", { class: "pstat-v " + (cls || ""), text: v }), el("div", { class: "pstat-l", text: lbl }) ]); }

    if (profileTab === "geral") {
      // ESTADO ATUAL
      if (st && st.last) {
        var estado = el("div", { class: "prof-card" }, [
          el("div", { class: "prof-card-h", text: "ESTADO ATUAL" }),
          el("div", { class: "estado-row" }, [
            el("div", { class: "estado-last" }, [
              el("span", { class: "el-res el-" + st.last.res, text: st.last.res }),
              el("div", {}, [ el("div", { class: "el-opp", text: "vs " + st.last.opp }), el("div", { class: "el-score", text: st.last.score }) ])
            ]),
            el("div", { class: "estado-nota" }, [ el("div", { class: "en-v", text: st.last.rating.toFixed(1) }), el("div", { class: "en-l", text: "última nota" }) ])
          ]),
          el("div", { class: "estado-form" }, [ el("span", { class: "ef-lbl", text: "Últimas " + st.form.length + ":" }) ].concat(st.form.map(formPill))),
          st.noScore > 0 && (p.pos === "FW" || p.pos === "MF") ? el("div", { class: "estado-note", text: st.noScore + " jogo(s) sem marcar" }) : null
        ]);
        body.appendChild(estado);
        // MELHOR PARTIDA
        if (st.best) body.appendChild(el("div", { class: "prof-card best-match" }, [
          el("div", { class: "bm-l" }, [ el("span", { class: "bm-star", text: "★" }), el("div", {}, [ el("div", { class: "bm-t", text: "MELHOR PARTIDA" }), el("div", { class: "bm-opp", text: st.best.opp + " · " + st.best.score }) ]) ]),
          el("div", { class: "bm-rate", text: st.best.rating.toFixed(1) + "★" })
        ]));
        // GRID
        var ga = st.goals + st.assists;
        var aprov = st.apps ? Math.round((st.form.filter(function (x) { return x === "V"; }).length / st.form.length) * 100) : 0;
        var avgR = st.rn ? (st.rsum / st.rn) : 0;
        body.appendChild(el("div", { class: "pstat-grid" }, [
          statCell(st.apps, "Partidas"), statCell(st.goals, "Gols", "c-green"), statCell(st.assists, "Assist.", "c-blue"),
          statCell(ga, "G+A", "c-purple"), statCell(avgR.toFixed(1), "Rating", "c-gold"), statCell(aprov + "%", "Aprov.", "c-gold")
        ]));
        // barra V/E/D
        var w = st.form.filter(function (x) { return x === "V"; }).length, d = st.form.filter(function (x) { return x === "E"; }).length, l = st.form.filter(function (x) { return x === "D"; }).length;
        var tot = Math.max(1, w + d + l);
        body.appendChild(el("div", { class: "wdl-bar" }, [
          el("div", { class: "wdl w", style: "width:" + (w / tot * 100) + "%", text: w ? w + "V" : "" }),
          el("div", { class: "wdl d", style: "width:" + (d / tot * 100) + "%", text: d ? d + "E" : "" }),
          el("div", { class: "wdl l", style: "width:" + (l / tot * 100) + "%", text: l ? l + "D" : "" })
        ]));
      } else {
        body.appendChild(el("div", { class: "prof-empty" }, [
          el("div", { class: "pe-ic", text: "📊" }),
          el("div", { class: "pe-t", text: "Sem jogos registrados nesta temporada" }),
          el("div", { class: "pe-s", text: "As estatísticas aparecem aqui conforme " + shortName(p.name) + " joga pelo seu time." })
        ]));
      }
    } else if (profileTab === "attrs") {
      var a = p.attrs || {};
      var avgA = inMySquad ? squadAvgAttrs(c) : null;
      body.appendChild(el("div", { class: "prof-card radar-card pblock" }, [
        el("div", { class: "prof-card-h", text: "RADAR DE ATRIBUTOS" + (avgA ? " · tracejado = média do elenco" : "") }),
        el("div", { class: "radar-wrap", html: radarSVG(a, avgA, pc1) })
      ]));
      function attrBarX(k) {
        var v = a[k[0]] || 50, av = avgA ? avgA[k[0]] : null, diff = av != null ? v - av : null;
        return el("div", { class: "attr attr-x" }, [
          el("span", { class: "attr-label", text: k[2] }),
          el("div", { class: "attr-bar" }, [ el("div", { class: "attr-fill", style: "width:" + v + "%; background: linear-gradient(90deg, " + attrColor(v) + "88, " + attrColor(v) + ")" }), av != null ? el("div", { class: "attr-avg", style: "left:" + av + "%" }) : null ]),
          el("span", { class: "attr-val", style: "color:" + attrColor(v), text: v }),
          diff != null ? el("span", { class: "attr-diff " + (diff >= 0 ? "up" : "down"), text: (diff >= 0 ? "+" : "") + diff }) : null
        ]);
      }
      body.appendChild(el("div", { class: "attrs" }, ATTR6.map(attrBarX)));
      body.appendChild(el("div", { class: "player-detail-grid" }, [
        el("div", { class: "pd-item" }, [ el("div", { class: "pd-val", text: p.overall }), el("div", { class: "pd-lbl", text: "Overall" }) ]),
        el("div", { class: "pd-item" }, [ el("div", { class: "pd-val " + (pot > p.overall ? "up" : ""), text: pot }), el("div", { class: "pd-lbl", text: "Potencial" }) ]),
        el("div", { class: "pd-item" }, [ el("div", { class: "pd-val", text: money(c, val) }), el("div", { class: "pd-lbl", text: "Valor" }) ]),
        el("div", { class: "pd-item" }, [ el("div", { class: "pd-val", text: (p.height || "?") + "cm" }), el("div", { class: "pd-lbl", text: "Altura" }) ])
      ]));
      body.appendChild(el("div", { class: "prof-card pblock" }, [
        el("div", { class: "prof-card-h", text: "PROJEÇÃO DE EVOLUÇÃO" }),
        el("div", { class: "proj-wrap", html: projectionSVG(p) }),
        el("div", { class: "setting-hint", text: pot > p.overall ? "Com minutos e bom CT, pode chegar a " + pot + ". Jovens evoluem mais rápido jogando." : (p.age || 25) >= 30 ? "No auge ou em declínio suave: mantenha a forma e evite lesões." : "Perto do teto: rendimento estável nas próximas temporadas." })
      ]));
    } else if (profileTab === "tat") {
      var mainPos = p.pos2 || (p.pos === "GK" ? "GOL" : p.pos === "DF" ? "ZAG" : p.pos === "FW" ? "CA" : "MC");
      var alts = POS_ALT[mainPos] || [];
      body.appendChild(el("div", { class: "prof-card tat-card pblock" }, [
        el("div", { class: "prof-card-h", text: "POSIÇÕES EM CAMPO" }),
        el("div", { class: "tat-row" }, [
          el("div", { class: "pitch-wrap", html: pitchSVG(p) }),
          el("div", { class: "tat-info" }, [
            el("div", { class: "tat-main" }, [ el("span", { class: "tat-dot main" }), el("span", { text: "Principal: " + mainPos }) ]),
            alts.length ? el("div", { class: "tat-alt" }, [ el("span", { class: "tat-dot alt" }), el("span", { text: "Também joga: " + alts.join(", ") }) ]) : null,
            el("div", { class: "tat-role", text: ROLE_TXT[mainPos] || "" })
          ])
        ])
      ]));
      if (inMySquad) {
        var same = C().rosterPlayers(c).filter(function (q) { return q.pos === p.pos; }).sort(function (x, y) { return y.overall - x.overall; });
        var rank = same.findIndex(function (q) { return q.id === p.id; }) + 1;
        var lu = c.lineup || {}, isStarter = (lu.starters || []).indexOf(p.id) >= 0, isBench = (lu.bench || []).indexOf(p.id) >= 0;
        var best = same[0];
        body.appendChild(el("div", { class: "prof-card pblock" }, [
          el("div", { class: "prof-card-h", text: "ENCAIXE NO SEU TIME" }),
          el("div", { class: "fit-grid" }, [
            el("div", { class: "fit-cell" }, [ el("div", { class: "fit-v " + (isStarter ? "c-green" : isBench ? "c-gold" : ""), text: isStarter ? "Titular" : isBench ? "Banco" : "Fora" }), el("div", { class: "fit-l", text: "escalação atual" }) ]),
            el("div", { class: "fit-cell" }, [ el("div", { class: "fit-v", text: rank + "º/" + same.length }), el("div", { class: "fit-l", text: "entre os " + POS_LABELS[posGroupOf(p)].toLowerCase() + "s" }) ]),
            el("div", { class: "fit-cell" }, [ el("div", { class: "fit-v " + (p.overall >= TM.data.clubRating(c.teamId) ? "c-green" : ""), text: (p.overall - TM.data.clubRating(c.teamId) >= 0 ? "+" : "") + (p.overall - TM.data.clubRating(c.teamId)) }), el("div", { class: "fit-l", text: "vs. média do time" }) ])
          ]),
          el("div", { class: "setting-hint", text: best && best.id !== p.id ? "Concorre com " + shortName(best.name) + " (" + best.overall + ") pela vaga." : "É a referência da posição no elenco." })
        ]));
        var tips = [];
        var a2 = p.attrs || {};
        if (a2.pac >= 80 && p.pos === "FW") tips.push("Explore a velocidade: bolas em profundidade e contra-ataques.");
        if (a2.pas >= 80 && p.pos === "MF") tips.push("Faça dele o organizador: posse de bola e construção pelo meio.");
        if (a2.def >= 80 && p.pos === "DF") tips.push("Linha alta funciona bem com ele: ganha duelos e antecipa.");
        if (a2.phy >= 80) tips.push("Aguenta jogos seguidos; bom em partidas físicas e disputas aéreas.");
        if (a2.dri >= 80) tips.push("Peça 1x1 pelos lados e infiltrações.");
        if ((c.fatigue && c.fatigue[p.id] || 0) >= 70) tips.push("Está cansado: considere poupar no próximo jogo.");
        if (!tips.length) tips.push("Jogador de sistema: rende melhor com o time organizado ao redor.");
        body.appendChild(el("div", { class: "prof-card pblock" }, [ el("div", { class: "prof-card-h", text: "DICAS TÁTICAS" }) ].concat(tips.map(function (t) { return el("div", { class: "tip-row", text: "• " + t }); }))));
      }
    } else if (profileTab === "hist") {
      if (st) {
        var avg = st.rn ? (st.rsum / st.rn).toFixed(1) : "—";
        body.appendChild(el("div", { class: "pstat-grid" }, [
          statCell(st.apps, "Jogos"), statCell(st.goals, "Gols", "c-green"), statCell(st.assists, "Assist.", "c-blue"),
          statCell(avg, "Média", "c-gold"), statCell(st.best ? st.best.rating.toFixed(1) : "—", "Melhor", "c-gold"), statCell(st.goals + st.assists, "G+A", "c-purple")
        ]));
        body.appendChild(el("div", { class: "estado-form", style: "margin-top:10px" }, [ el("span", { class: "ef-lbl", text: "Forma:" }) ].concat((st.form || []).map(formPill))));
      } else body.appendChild(el("div", { class: "prof-empty" }, [ el("div", { class: "pe-t", text: "Ainda sem histórico nesta temporada." }) ]));
    } else {
      // Insights
      var tips = [];
      if (pot - p.overall >= 6) tips.push("💎 Potencial alto (" + pot + "): com minutos, tende a evoluir bastante.");
      else if (pot - p.overall <= 1) tips.push("🧱 Já perto do teto de evolução (" + pot + ").");
      if ((p.age || 24) <= 20) tips.push("🌱 Jovem (" + p.age + "): ideal para desenvolver como titular ou rodízio.");
      if ((p.age || 24) >= 33) tips.push("🎓 Veterano (" + p.age + "): experiência valiosa, mas precisa de rodízio.");
      if (st && st.goals >= 3) tips.push("🔥 Boa fase de gols (" + st.goals + " na temporada).");
      if (st && st.noScore >= 4 && (p.pos === "FW" || p.pos === "MF")) tips.push("❄️ Jejum de gols: pode precisar de confiança ou descanso.");
      tips.push("💰 Valor de mercado atual: " + money(c, val) + ".");
      var insList = el("div", { class: "prof-card" }, [ el("div", { class: "prof-card-h", text: "INSIGHTS" }) ]);
      tips.forEach(function (t) { insList.appendChild(el("div", { class: "insight-row", text: t })); });
      body.appendChild(insList);
    }
  });

  /* ---------- SCOUT: jogadores similares + comparação (Análise) ---------- */
  var similarRefId = null, similarBack = "coach-player", similarFilter = { afford: false, young: false };
  var compareAId = null, compareBId = null, compareBack = "coach-similar";
  function openSimilar(player, back) { similarRefId = player.id; similarBack = back || "coach-squad"; TM.ui.go("coach-similar"); }
  function openCompare(aId, bId, back) { compareAId = aId; compareBId = bId; compareBack = back || "coach-similar"; TM.ui.go("coach-compare"); }
  TM.coachUI.openSimilar = openSimilar;

  var ATTR_KEYS = [["pac", "Velocidade"], ["sho", "Finalização"], ["pas", "Passe"], ["dri", "Drible"], ["def", "Defesa"], ["phy", "Físico"]];
  function attrDist(a, b) { var A = a.attrs || {}, B = b.attrs || {}, d = 0; ATTR_KEYS.forEach(function (k) { d += Math.abs((A[k[0]] || 50) - (B[k[0]] || 50)); }); return d; }
  function matchPct(ref, p) {
    var m = 100 - attrDist(ref, p) * 0.42 - Math.abs((ref.overall || 70) - (p.overall || 70)) * 1.4;
    return Math.max(35, Math.min(99, Math.round(m)));
  }
  function playerTags(p) {
    var t = [];
    if (p.overall >= 85) t.push({ cls: "gold", txt: "Top mundial" });
    else if (p.overall >= 78) t.push({ cls: "silver", txt: "Destaque" });
    if ((p.age || 24) <= 21 && (p.potential || p.overall) >= 82) t.push({ cls: "green", txt: "Promessa" });
    if ((p.age || 24) >= 33) t.push({ cls: "brown", txt: "Veterano" });
    return t;
  }
  function similarPlayers(ref, n) {
    var W = TM.data.world(), out = [], ids = Object.keys(W.playersById);
    for (var i = 0; i < ids.length; i++) {
      var p = W.playersById[ids[i]];
      if (!p || p.id === ref.id || p.pos !== ref.pos) continue;
      out.push({ p: p, m: matchPct(ref, p) });
    }
    out.sort(function (a, b) { return b.m - a.m; });
    return out.slice(0, n || 40);
  }

  TM.ui.register("coach-similar", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c || !similarRefId) { TM.ui.go(similarBack); return; }
    var ref = C().resolvePlayer(c, similarRefId) || TM.data.player(similarRefId);
    if (!ref) { TM.ui.go(similarBack); return; }
    screen.appendChild(TM.ui.topbar("🐺 Scout · Similares", function () { TM.ui.go(similarBack); }));
    addSectorBar(screen, "coach-market");
    var wrap = el("div", { class: "similar-wrap" });
    screen.appendChild(wrap);

    // referência
    wrap.appendChild(el("div", { class: "sim-ref" }, [
      TM.img.playerImg(ref, "sim-ref-face"),
      el("div", { class: "sim-ref-id" }, [
        el("div", { class: "sim-ref-t", text: "Jogadores similares a" }),
        el("div", { class: "sim-ref-n", text: ref.name + " · " + TM.data.posLabel(ref) })
      ]),
      el("button", { class: "sim-perfil-btn", text: "👤 Perfil", on: { click: function () { openPlayerProfile(ref, "coach-similar"); } } })
    ]));

    var all = similarPlayers(ref, 60);
    // filtros simples
    var list = all.filter(function (o) {
      if (similarFilter.afford && curVal(c, TM.data.marketValue(o.p)) > (c.budget || 0)) return false;
      if (similarFilter.young && (o.p.age || 24) > 23) return false;
      return true;
    }).slice(0, 20);

    var fbar = el("div", { class: "sim-filters" });
    function fchip(key, label) {
      var b = el("button", { class: "sim-fchip" + (similarFilter[key] ? " on" : ""), text: label, on: { click: function () { similarFilter[key] = !similarFilter[key]; TM.ui.go("coach-similar"); } } });
      return b;
    }
    fbar.appendChild(el("span", { class: "sim-count", text: "👥 " + list.length + " encontrados" }));
    fbar.appendChild(fchip("afford", "💰 No orçamento"));
    fbar.appendChild(fchip("young", "🌱 Jovens"));
    wrap.appendChild(fbar);
    wrap.appendChild(el("div", { class: "sim-hint", text: "Toque em Análise para a leitura de scouting: radar, DNA da similaridade e comparação direta — instantâneo." }));

    list.forEach(function (o) {
      var p = o.p, club = TM.data.club(p.clubId), nation = p.nationId ? TM.data.nation(p.nationId) : null;
      var tags = [{ cls: "match", txt: o.m + "% match" }].concat(playerTags(p));
      wrap.appendChild(el("div", { class: "sim-card" }, [
        el("div", { class: "sim-top" }, [
          TM.img.playerImg(p, "sim-face"),
          el("div", { class: "sim-info" }, [
            el("div", { class: "sim-name", text: p.name }),
            el("div", { class: "sim-club" }, [ club ? TM.img.clubImg(club, "sim-crest") : null, el("span", { text: club ? club.name : "" }) ]),
            el("div", { class: "sim-sub" }, [ el("span", { text: (p.nationName || (nation && nation.name) ? (p.nationName || nation.name) + " · " : "") + (p.age || "?") + " anos · " + TM.data.posLabel(p) }) ])
          ]),
          el("div", { class: "sim-ovp" }, [
            el("div", { class: "sim-ovp-row" }, [ el("span", { class: "sim-ovp-v", text: p.overall }), el("span", { class: "sim-ovp-v pot", text: p.potential || p.overall }) ]),
            el("div", { class: "sim-ovp-l", text: "OVR  POT" })
          ])
        ]),
        el("div", { class: "sim-tags" }, tags.map(function (t) { return el("span", { class: "sim-tag " + t.cls, text: t.txt }); })),
        el("div", { class: "sim-acts" }, [
          TM.ui.button("✨ Análise", function () { openCompare(ref.id, p.id, "coach-similar"); }, "btn primary sim-analise"),
          TM.ui.button("👤 Perfil", function () { openPlayerProfile(p, "coach-similar"); }, "btn ghost")
        ])
      ]));
    });
  });

  TM.ui.register("coach-compare", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c || !compareAId || !compareBId) { TM.ui.go(compareBack); return; }
    var A = C().resolvePlayer(c, compareAId) || TM.data.player(compareAId);
    var B = C().resolvePlayer(c, compareBId) || TM.data.player(compareBId);
    if (!A || !B) { TM.ui.go(compareBack); return; }
    screen.appendChild(TM.ui.topbar("Análise · Comparação", function () { TM.ui.go(compareBack); }));
    addSectorBar(screen, "coach-market");
    var wrap = el("div", { class: "compare-wrap" });
    screen.appendChild(wrap);

    var m = matchPct(A, B);
    // cabeçalho com os dois
    function col(p) { return el("div", { class: "cmp-col" }, [ TM.img.playerImg(p, "cmp-face"), el("div", { class: "cmp-name", text: shortName(p.name) }), el("div", { class: "cmp-ov", text: p.overall + " OVR" }) ]); }
    wrap.appendChild(el("div", { class: "cmp-head" }, [
      col(A),
      el("div", { class: "cmp-dna" }, [ el("div", { class: "cmp-dna-v", text: m + "%" }), el("div", { class: "cmp-dna-l", text: "DNA similar" }) ]),
      col(B)
    ]));

    // barras comparativas por atributo
    var rows = el("div", { class: "cmp-rows" });
    ATTR_KEYS.forEach(function (k) {
      var va = (A.attrs && A.attrs[k[0]]) || 50, vb = (B.attrs && B.attrs[k[0]]) || 50;
      rows.appendChild(el("div", { class: "cmp-row" }, [
        el("div", { class: "cmp-bar-l" }, [ el("div", { class: "cmp-fill l" + (va >= vb ? " win" : ""), style: "width:" + va + "%" }), el("span", { class: "cmp-va", text: va }) ]),
        el("div", { class: "cmp-attr", text: k[1] }),
        el("div", { class: "cmp-bar-r" }, [ el("div", { class: "cmp-fill r" + (vb >= va ? " win" : ""), style: "width:" + vb + "%" }), el("span", { class: "cmp-vb", text: vb }) ])
      ]));
    });
    wrap.appendChild(rows);

    // leitura de scouting
    var diff = ATTR_KEYS.map(function (k) { return { k: k[1], d: ((B.attrs && B.attrs[k[0]]) || 50) - ((A.attrs && A.attrs[k[0]]) || 50) }; });
    var bestB = diff.slice().sort(function (a, b) { return b.d - a.d; })[0];
    var bestA = diff.slice().sort(function (a, b) { return a.d - b.d; })[0];
    var reading = [];
    reading.push("🧬 DNA de similaridade: " + m + "% — " + (m >= 82 ? "perfis muito parecidos." : m >= 68 ? "perfis parecidos, com nuances." : "mesma posição, estilos diferentes."));
    if (bestB && bestB.d >= 3) reading.push("↗️ " + shortName(B.name) + " leva vantagem em " + bestB.k + " (+" + bestB.d + ").");
    if (bestA && bestA.d <= -3) reading.push("↘️ " + shortName(A.name) + " é melhor em " + bestA.k + " (+" + (-bestA.d) + ").");
    reading.push("💰 Valor: " + shortName(A.name) + " " + money(c, curVal(c, TM.data.marketValue(A))) + " · " + shortName(B.name) + " " + money(c, curVal(c, TM.data.marketValue(B))));
    var rcard = el("div", { class: "prof-card" }, [ el("div", { class: "prof-card-h", text: "LEITURA DE SCOUTING" }) ]);
    reading.forEach(function (t) { rcard.appendChild(el("div", { class: "insight-row", text: t })); });
    wrap.appendChild(rcard);

    wrap.appendChild(el("div", { class: "cmp-btns" }, [
      TM.ui.button("👤 Perfil de " + shortName(B.name), function () { openPlayerProfile(B, "coach-compare"); }, "btn"),
      TM.ui.button("← Voltar aos similares", function () { TM.ui.go("coach-similar"); }, "btn ghost")
    ]));
  });

  /* ---------- MUNDO: ranking mundial de clubes + prêmios da temporada ---------- */
  function seasonDrift(id, season) { var h = 2166136261, s = String(id) + ":" + season; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 91) / 10 - 4.5; }
  function worldRankList(season) {
    var W = TM.data.world();
    var arr = W.clubs.map(function (cl) { return { id: cl.id, name: cl.name, region: (C().REGION[cl.leagueId] || "eu"), power: TM.data.clubRating(cl.id) + seasonDrift(cl.id, season) }; });
    arr.sort(function (a, b) { return b.power - a.power; });
    arr.forEach(function (o, i) { o.rank = i + 1; });
    return arr;
  }
  function rankMapOf(season) { var m = {}; worldRankList(season).forEach(function (o) { m[o.id] = o.rank; }); return m; }
  function seasonAwards(career) {
    var W = TM.data.world(), season = career.season;
    var all = []; W.clubs.forEach(function (cl) { TM.data.clubPlayers(cl.id).forEach(function (p) { all.push(p); }); });
    function seed(p) { var h = 2166136261, s = String(p.id) + ":" + season; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }
    var best = all.slice().sort(function (a, b) { return (b.overall + seed(b) * 6) - (a.overall + seed(a) * 6); })[0];
    var scPool = all.filter(function (p) { return p.pos === "FW" || p.pos === "MF"; });
    var scorer = scPool.slice().sort(function (a, b) { return (b.overall * 0.7 + seed(b) * 30) - (a.overall * 0.7 + seed(a) * 30); })[0];
    var scorerGoals = Math.round(20 + seed(scorer) * 18);
    var uTop = null, uMax = 0; if (career.pstats) Object.keys(career.pstats).forEach(function (id) { var st = career.pstats[id]; if (st.goals > uMax) { uMax = st.goals; uTop = id; } });
    if (uTop && uMax > scorerGoals) { var up = C().resolvePlayer(career, uTop); if (up) { scorer = up; scorerGoals = uMax; } }
    var young = all.filter(function (p) { return (p.age || 24) <= 21; }).sort(function (a, b) { return ((b.potential || b.overall) + seed(b) * 4) - ((a.potential || a.overall) + seed(a) * 4); })[0];
    var gk = all.filter(function (p) { return p.pos === "GK"; }).sort(function (a, b) { return (b.overall + seed(b) * 5) - (a.overall + seed(a) * 5); })[0];
    var coachName = "Comissão técnica", coachClub = null;
    try { var st = C().standings(career); if (st && st[0]) { coachClub = TM.data.club(st[0].id); coachName = (st[0].id === career.teamId) ? (career.coachName || "Você") : ((coachClub && coachClub.coach) || "Comissão técnica"); } } catch (e) {}
    return { best: best, scorer: scorer, scorerGoals: scorerGoals, young: young, gk: gk, coachName: coachName, coachClub: coachClub };
  }

  var worldTab = "rank";
  TM.ui.register("coach-world", function (screen) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    screen.appendChild(TM.ui.topbar("🌍 Mundo", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-comps");
    var wrap = el("div", { class: "world-wrap" }); screen.appendChild(wrap);
    var tabs = el("div", { class: "prof-tabs" });
    [["rank", "🏅 Ranking de Clubes"], ["awards", "🏆 Prêmios"]].forEach(function (t) {
      tabs.appendChild(el("button", { class: "prof-tab" + (worldTab === t[0] ? " on" : ""), text: t[1], on: { click: function () { worldTab = t[0]; TM.ui.go("coach-world"); } } }));
    });
    wrap.appendChild(tabs);
    var body = el("div", { class: "prof-body" }); wrap.appendChild(body);

    if (worldTab === "rank") {
      var cur = worldRankList(c.season), prev = rankMapOf(c.season - 1);
      body.appendChild(el("div", { class: "rank-note", text: "Ranking mundial · Temporada " + c.season + " (sobe e desce a cada temporada)" }));
      var REGNAME = { sa: "América do Sul", eu: "Europa", na: "Norte/Centro", as: "Ásia/Outros" };
      cur.slice(0, 50).forEach(function (o) {
        var club = TM.data.club(o.id);
        var prevRank = prev[o.id] || o.rank, mv = prevRank - o.rank;
        var mvEl = mv > 0 ? el("span", { class: "rk-mv up", text: "▲" + mv }) : mv < 0 ? el("span", { class: "rk-mv dn", text: "▼" + (-mv) }) : el("span", { class: "rk-mv eq", text: "–" });
        body.appendChild(el("div", { class: "rank-row" + (o.id === c.teamId ? " me" : "") }, [
          el("span", { class: "rk-pos", text: o.rank }),
          club ? TM.img.clubImg(club, "rk-crest") : null,
          el("div", { class: "rk-info" }, [ el("div", { class: "rk-name", text: o.name }), el("div", { class: "rk-reg", text: REGNAME[o.region] || "" }) ]),
          mvEl,
          el("span", { class: "rk-pw", text: Math.round(o.power) })
        ]));
      });
    } else {
      // prêmios só saem NO FIM da temporada (quando a liga acabou)
      var stA = C().standings(c.comps.league.table);
      var meA = stA.filter(function (r) { return r.id === c.teamId; })[0] || { p: 0 };
      var totalRounds = (stA.length - 1) * 2;
      var leagueLeft = Math.max(0, totalRounds - (meA.p || 0));
      if (leagueLeft > 0) {
        body.appendChild(el("div", { class: "award-locked" }, [
          el("div", { class: "awl-ic", text: "🔒" }),
          el("div", { class: "awl-h", text: "Prêmios saem no fim da temporada" }),
          el("div", { class: "awl-sub", text: "Ainda faltam " + leagueLeft + " rodada" + (leagueLeft > 1 ? "s" : "") + " da liga. Termine a temporada para conhecer o Melhor do Mundo, Artilheiro, Melhor Jovem e mais." })
        ]));
        return;
      }
      var a = seasonAwards(c);
      function awCard(icon, title, player, extra, club) {
        if (!player) return null;
        var pClub = club || TM.data.club(player.clubId);
        return el("div", { class: "award-card" }, [
          el("div", { class: "aw-top" }, [ el("span", { class: "aw-ic", text: icon }), el("span", { class: "aw-title", text: title }) ]),
          el("div", { class: "aw-body" }, [
            player.name ? TM.img.playerImg(player, "aw-face") : (pClub ? TM.img.clubImg(pClub, "aw-face") : null),
            el("div", { class: "aw-info" }, [
              el("div", { class: "aw-name", text: player.name || player }),
              el("div", { class: "aw-sub", text: (pClub ? pClub.name : "") + (extra ? " · " + extra : "") })
            ]),
            player.overall ? TM.ui.ovBadge(player.overall) : null
          ])
        ]);
      }
      body.appendChild(el("div", { class: "rank-note", text: "🏆 Prêmios da Temporada " + c.season }));
      body.appendChild(awCard("🌟", "Melhor do Mundo", a.best, "Bola de Ouro"));
      body.appendChild(awCard("⚽", "Artilheiro", a.scorer, a.scorerGoals + " gols"));
      body.appendChild(awCard("💎", "Melhor Jovem", a.young, "revelação (pot. " + (a.young ? (a.young.potential || a.young.overall) : "") + ")"));
      body.appendChild(awCard("🧤", "Goleiro do Ano", a.gk, null));
      body.appendChild(awCard("👔", "Treinador do Ano", { name: a.coachName }, "campeão da liga", a.coachClub));
    }
  });

  /* ---------- central de notificações ---------- */
  TM.ui.register("coach-notifications", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🔔 Avisos", function () { TM.notify.markAllRead(c); TM.storage.saveCoachCareer(c); TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-notifications");
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
          TM.ui.button("🤝 Sentar para negociar", function () { TM.ui.go("coach-offer", { noteId: n.id }); }, "btn primary small")
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
      } else if (n.saf) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("💼 Ver proposta", function () { TM.ui.go("club-saf-offer", { from: "coach-notifications" }); }, "btn primary small")
        ]));
      } else if (n.safEvent) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("💼 Responder", function () { TM.ui.go("club-saf-event", { noteId: n.id }); }, "btn primary small")
        ]));
      } else if (n.fin) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("💰 Ir a Finanças", function () { TM.ui.go("coach-finance"); }, "btn primary small")
        ]));
      } else if (n.preseason) {
        card.appendChild(el("div", { class: "note-actions" }, [
          TM.ui.button("🏖️ Ver os torneios", function () { TM.ui.go("coach-preseason"); }, "btn primary small")
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

    screen.appendChild(TM.ui.topbar("Negociação", function () { TM.ui.go("coach-notifications"); }));

    function line(label, val, cls) { return el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: label }), el("span", { class: "deal-val " + (cls || ""), text: val }) ]); }
    var value = curVal(c, TM.data.marketValue(player));
    var fee = off.fee, diff = r2(fee - value), good = fee >= value;
    var caixa = r2((c.budget || 0) + fee);
    var wage = 0; try { wage = curVal(c, wageDemand(player)); } catch (e) {}
    var tension = off.finalOffer ? "high" : (fee >= value * 1.08 ? "low" : (fee < value * 0.9 ? "high" : "mid"));
    var tensionLbl = tension === "low" ? "Baixa tensão" : (tension === "high" ? "Alta tensão" : "Tensão média");

    var wrap = el("div", { class: "nego2" });

    // ---- "na linha com" o clube comprador ----
    wrap.appendChild(el("div", { class: "nego2-call" }, [
      (TM.img && TM.img.clubImg ? TM.img.clubImg(buyer, "nego2-crest") : el("span", { class: "nego2-crest" })),
      el("div", { class: "nego2-callinfo" }, [
        el("div", { class: "nego2-role", text: "NA MESA COM" }),
        el("div", { class: "nego2-club", text: buyer.name }),
        el("div", { class: "nego2-sub", text: "Direção de futebol · OVR " + TM.data.clubRating(off.buyerId) })
      ]),
      el("div", { class: "nego2-tension " + tension }, [ el("span", { class: "nego2-tdot" }), el("span", { text: tensionLbl }) ])
    ]));

    // ---- fala do clube ----
    var quote = off.finalOffer
      ? "Essa é a nossa proposta final: " + money(c, fee) + " por " + player.name + ". É pegar ou largar."
      : (good ? "Temos grande interesse em " + player.name + ". Colocamos " + money(c, fee) + " na mesa — um bom valor. O que acha?"
              : "Gostaríamos de contar com " + player.name + ". Oferecemos " + money(c, fee) + " por ele.");
    wrap.appendChild(el("div", { class: "nego2-quote", text: quote }));

    // ---- card do jogador (estilo FC) ----
    wrap.appendChild(el("div", { class: "nego2-player" }, [
      TM.img.playerImg(player, "nego2-face"),
      el("div", { class: "nego2-pinfo" }, [
        el("div", { class: "nego2-pname", text: player.name }),
        el("div", { class: "nego2-pmeta" }, [
          el("span", { class: "nego2-chip", html: "POS <b>" + TM.data.posLabel(player) + "</b>" }),
          el("span", { class: "nego2-chip", html: "IDADE <b>" + player.age + "</b>" }),
          el("span", { class: "nego2-chip", html: "SALÁRIO <b>" + (wage ? money(c, wage) : "—") + "</b>" })
        ])
      ]),
      el("div", { class: "nego2-ovr" }, [ el("div", { class: "nego2-ovrn", text: player.overall }), el("div", { class: "nego2-ovrl", text: "OVR" }) ])
    ]));

    // ---- termos do negócio ----
    wrap.appendChild(el("div", { class: "nego2-terms" }, [
      line("Proposta na mesa", money(c, fee), good ? "good" : "bad"),
      line("Valor de mercado", money(c, value)),
      line("Diferença", (diff >= 0 ? "+" : "") + money(c, diff), good ? "good" : "bad"),
      line("Caixa após a venda", money(c, caixa), "good")
    ]));

    // ---- pedir mais (contraproposta) ----
    if (!off.finalOffer) {
      var demandInput = el("input", { class: "text-input", type: "number", min: fee, step: 0.05, value: r2(fee * 1.2), placeholder: "valor" });
      wrap.appendChild(el("div", { class: "nego2-counter" }, [
        el("div", { class: "nego2-ch", text: "💬 Peça mais pelo jogador" }),
        el("div", { class: "nego-row" }, [ el("span", { class: "deal-lbl", text: "Quero " + sym(c) }), demandInput, el("span", { class: "deal-lbl", text: "M" }) ]),
        TM.ui.button("📤 Enviar contraproposta", function () {
          var d = r2(parseFloat(demandInput.value));
          if (!d || d <= 0) { TM.ui.toast("Informe um valor válido"); return; }
          var r = C().counterIncomingOffer(c, note, d); TM.storage.saveCoachCareer(c);
          TM.ui.toast(r.text || "");
          if (r.status === "retirada") { TM.ui.go("coach-notifications"); }
          else { TM.ui.go("coach-offer", { noteId: note.id }); }
        }, "btn small")
      ]));
    } else {
      wrap.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "🔒 Proposta final — não dá pra pedir mais." }));
    }

    // ---- ações ----
    wrap.appendChild(el("div", { class: "nego2-actions" }, [
      TM.ui.button("✅ Aceitar e vender", function () {
        var r = C().resolveIncomingOffer(c, note, true); TM.storage.saveCoachCareer(c);
        TM.ui.toast(r === "vendido" ? "💰 Jogador vendido!" : "O jogador recusou sair."); TM.ui.go("coach-notifications");
      }, "btn primary"),
      TM.ui.button("📞 Encerrar negociação", function () { C().resolveIncomingOffer(c, note, false); TM.storage.saveCoachCareer(c); TM.ui.go("coach-notifications"); }, "btn danger")
    ]));

    screen.appendChild(wrap);
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
      var feeInput = el("input", { class: "text-input", type: "number", min: lo.loanFee, step: 0.05, value: r2(lo.loanFee * 1.5) || 0.05, placeholder: "Taxa (milhões)" });
      negWrap.appendChild(el("div", { class: "nego-row" }, [ el("span", { class: "deal-lbl", text: "Taxa " + sym(c) }), feeInput, el("span", { class: "deal-lbl", text: "M" }) ]));
      var askOpt = el("button", { class: "switch" + (lo.buyOption ? " on" : ""), on: { click: function () { askOpt.classList.toggle("on"); priceRow.style.display = askOpt.classList.contains("on") ? "" : "none"; } } }, [ el("span", { class: "switch-knob" }) ]);
      negWrap.appendChild(el("div", { class: "setting row" }, [ el("div", { class: "deal-lbl", text: "Exigir opção de compra" }), askOpt ]));
      var priceInput = el("input", { class: "text-input", type: "number", min: 0.05, step: 0.05, value: lo.buyPrice || r2(curVal(c, TM.data.marketValue(player)) * 1.2), placeholder: "Preço da opção (milhões)" });
      var priceRow = el("div", { class: "nego-row", style: lo.buyOption ? "" : "display:none" }, [ el("span", { class: "deal-lbl", text: "Compra " + sym(c) }), priceInput, el("span", { class: "deal-lbl", text: "M" }) ]);
      negWrap.appendChild(priceRow);
      negWrap.appendChild(TM.ui.button("📤 Enviar contraproposta", function () {
        var want = { loanFee: r2(parseFloat(feeInput.value)) || lo.loanFee, askOption: askOpt.classList.contains("on"), buyPrice: r2(parseFloat(priceInput.value)) || 0 };
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

  /* ---------- estilo de jogo / filosofia ---------- */
  TM.ui.register("coach-style", function (screen) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    screen.appendChild(TM.ui.topbar("🎭 Estilo de jogo", function () { TM.ui.go("coach-lineup"); }));
    addSectorBar(screen, "coach-lineup");
    var cur = playStyleOf(c.tactic) || PLAY_STYLES[0];
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("div", { class: "style-hero" }, [
        el("div", { class: "style-hero-ic", text: cur.ic }),
        el("div", {}, [
          el("div", { class: "style-hero-name", text: cur.name }),
          el("div", { class: "style-hero-id", text: "Seu time é conhecido por " + cur.id + "." })
        ])
      ]),
      el("div", { class: "style-hint", text: "A filosofia molda como o time joga e sua identidade no mundo. Escolha a que combina com seu elenco." })
    ]));
    var list = el("div", { class: "style-list panel-narrow" });
    PLAY_STYLES.forEach(function (st) {
      var mods = (TM.engine.TACTIC_MODS && TM.engine.TACTIC_MODS[st.key]) || [1, 1];
      var atk = Math.round((mods[0] - 1) * 100), con = Math.round((mods[1] - 1) * 100);
      var on = st.key === c.tactic;
      list.appendChild(el("button", { class: "style-card" + (on ? " on" : ""), on: { click: function () {
        c.tactic = st.key; TM.storage.saveCoachCareer(c);
        TM.notify.push(c, { icon: st.ic, title: "Nova filosofia", text: "Seu time agora joga com " + st.name + " — conhecido por " + st.id + "." });
        TM.ui.toast("Estilo: " + st.name); TM.ui.go("coach-style");
      } } }, [
        el("div", { class: "style-card-top" }, [
          el("span", { class: "style-card-ic", text: st.ic }),
          el("span", { class: "style-card-name", text: st.name }),
          on ? el("span", { class: "style-card-on", text: "✓ Ativo" }) : null
        ]),
        el("div", { class: "style-card-desc", text: st.desc }),
        el("div", { class: "style-card-mods" }, [
          el("span", { class: "scm " + (atk >= 0 ? "up" : "down"), text: "Ataque " + (atk >= 0 ? "+" : "") + atk + "%" }),
          el("span", { class: "scm " + (con <= 0 ? "up" : "down"), text: "Sofre gols " + (con >= 0 ? "+" : "") + con + "%" })
        ])
      ]));
    });
    screen.appendChild(list);
  });

  /* ---------- escalação (campinho) ---------- */
  var pickSlot = null; // índice de titular selecionado para troca
  TM.ui.register("coach-lineup", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c.lineup) c.lineup = C().buildBestLineup(C().rosterPlayers(c));
    C().syncLineup(c); TM.storage.saveCoachCareer(c); // garante contratados no banco
    screen.appendChild(TM.ui.topbar("📋 Escalação", function () { pickSlot = null; TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-lineup");

    // formação + tática (dropdowns compactos)
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("h3", { class: "block-title", text: "📐 Esquema tático" }),
      TM.ui.dropdown("Formação", Object.keys(C().FORMATIONS), c.lineup.formation, function (f) {
        c.lineup = C().buildLineup(C().rosterPlayers(c), f); pickSlot = null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-lineup");
      }),
      (function () {
        var st = playStyleOf(c.tactic) || PLAY_STYLES[0];
        return el("button", { class: "style-btn", on: { click: function () { TM.ui.go("coach-style"); } } }, [
          el("span", { class: "style-btn-ic", text: st.ic }),
          el("div", { class: "style-btn-info" }, [
            el("div", { class: "style-btn-lbl", text: "Estilo de jogo" }),
            el("div", { class: "style-btn-name", text: st.name })
          ]),
          el("span", { class: "style-btn-arrow", text: "›" })
        ]);
      })()
    ]));

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
    // capitão
    function captainSelect() {
      var selEl = el("select", { class: "select" });
      selEl.appendChild(el("option", { value: "", text: "Automático (líder dos titulares)" }));
      // APENAS os 11 titulares podem ser capitão
      var starterIds = (c.lineup && c.lineup.starters) || [];
      var starters = starterIds.map(function (id) { return C().resolvePlayer(c, id); }).filter(Boolean)
        .sort(function (a, b) { return b.overall - a.overall; });
      // se o capitão atual não é titular, cai para automático
      if (c.captainId && starterIds.indexOf(c.captainId) < 0) { c.captainId = null; }
      starters.forEach(function (pl) {
        var o = el("option", { value: pl.id, text: pl.name + " (" + TM.data.posLabel(pl) + " · " + pl.overall + ")" });
        if (c.captainId === pl.id) o.selected = true;
        selEl.appendChild(o);
      });
      selEl.addEventListener("change", function () { c.captainId = selEl.value || null; TM.storage.saveCoachCareer(c); TM.ui.go("coach-lineup"); });
      return el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "🎽 Capitão (titular)" }), selEl ]);
    }
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("h3", { class: "block-title", text: "⚽ Cobradores e capitão" }),
      takerSelect("penTakerId", "Batedor de pênalti"),
      takerSelect("fkTakerId", "Batedor de falta"),
      captainSelect(),
      el("div", { class: "setting-hint", text: "Cobradores só valem se o jogador estiver em campo; senão, o melhor finalizador cobra." })
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
      if (!c.lineup.pos) c.lineup.pos = {};
      // empurra só os ATACANTES um pouco para baixo (não cruzam a área); goleiro fica no fundo
      function fieldY(sy) { return Math.round((20 + (sy - 15) * (88 - 20) / (88 - 15)) * 10) / 10; }
      c.lineup.starters.forEach(function (id, i) {
        var p = C().resolvePlayer(c, id); if (!p) return;
        var baseSlot = slots[i] || [null, 50, 50];
        var unavail = !C().available(c, id);
        var cp = c.lineup.pos[i];
        var x = cp ? cp[0] : baseSlot[1], y = cp ? cp[1] : fieldY(baseSlot[2]);
        // se foi arrastado, identifica a NOVA posição (grupo + rótulo) e ajusta o overall
        var slot = cp ? C().fieldSlot(x, y) : baseSlot;
        var tiredChip = !unavail && c.fatigue && (c.fatigue[id] || 0) >= 78;
        var chipFlag = unavail ? el("span", { class: "chip-flag", text: c.injuries[id] ? "🚑" : "🟥" })
          : (tiredChip ? el("span", { class: "chip-flag", text: "🥵" }) : null);
        var chip = el("button", { class: "pl-chip" + (pickSlot === i ? " picked" : "") + (unavail ? " unavail" : "") + (tiredChip ? " tired" : "") + (cp ? " custom" : ""),
          style: "left:" + x + "%;top:" + y + "%" },
          TM.ui.chipKids(p, slot, { name: shortName(p.name), age: false, captain: c.captainId === id, dyn: C().dynamicInfo(c, p), flag: chipFlag })
        );
        attachChipDrag(chip, i, pitch);
        pitch.appendChild(chip);
      });
      board.appendChild(pitch);

      var hasCustom = Object.keys(c.lineup.pos).length > 0;
      var hintRow = el("div", { class: "lineup-hint" }, [
        document.createTextNode(pickSlot != null
          ? "Toque em OUTRO titular para trocar, ou num reserva para substituir. 👆 Arraste para mover livre."
          : "👆 Toque para trocar/substituir · ✋ Arraste o jogador pelo campo para posicioná-lo livremente.")
      ]);
      board.appendChild(hintRow);
      if (hasCustom) {
        board.appendChild(TM.ui.button("↩️ Redefinir posições da formação", function () {
          c.lineup.pos = {}; TM.storage.saveCoachCareer(c); renderBoard();
        }, "btn ghost small"));
      }
      board.appendChild(TM.ui.posPanel(c.lineup.starters.map(function (id, i) { return { player: C().resolvePlayer(c, id), slot: C().lineupSlot(c, i) }; })));

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
    // arrastar o jogador livremente pelo campo (movimentação manual, como pediram)
    function attachChipDrag(chip, i, pitch) {
      var sx = null, sy = null, dragging = false, pid = null, nx = null, ny = null;
      chip.style.touchAction = "none";
      chip.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; dragging = false; pid = e.pointerId; nx = ny = null; });
      chip.addEventListener("pointermove", function (e) {
        if (sx == null) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (!dragging && (dx * dx + dy * dy) > 36) { dragging = true; try { chip.setPointerCapture(pid); } catch (er) {} chip.classList.add("dragging"); }
        if (dragging) {
          var r = pitch.getBoundingClientRect();
          nx = Math.max(5, Math.min(95, (e.clientX - r.left) / r.width * 100));
          ny = Math.max(6, Math.min(95, (e.clientY - r.top) / r.height * 100));
          chip.style.left = nx + "%"; chip.style.top = ny + "%";
        }
      });
      function end() {
        if (sx == null) return;
        var wasDrag = dragging; sx = sy = null; dragging = false; chip.classList.remove("dragging");
        if (wasDrag && nx != null) {
          if (!c.lineup.pos) c.lineup.pos = {};
          c.lineup.pos[i] = [Math.round(nx * 10) / 10, Math.round(ny * 10) / 10];
          TM.storage.saveCoachCareer(c);
          renderBoard();
        } else { onStarterClick(i); }
      }
      chip.addEventListener("pointerup", end);
      chip.addEventListener("pointercancel", function () { sx = sy = null; dragging = false; chip.classList.remove("dragging"); });
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
  var youthTab = "all";
  TM.ui.register("coach-youth", function (screen) {
    var c = TM.storage.coachCareer();
    screen.appendChild(TM.ui.topbar("🌱 Categorias de Base", function () { TM.ui.go("coach-hub"); }));
    addSectorBar(screen, "coach-youth");
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("p", { class: "intro-text", text: "Elenco da base do seu clube (até 21 anos). Promova jogadores de 15 anos ou mais para o profissional. Quem completar 22 anos sem subir é dispensado e vai para os passes livres." }),
      el("div", { class: "actions", style: "margin-top:6px" }, [
        TM.ui.button("⚽ Disputar partida de base", function () { TM.ui.go("coach-youth-match"); }, "btn primary"),
        TM.ui.button("🔭 Olheiros da base", function () { TM.ui.go("coach-scouting", { from: "coach-youth", tab: "youth" }); }, "btn")
      ])
    ]));

    // abas por categoria: Sub-17 (<=16), Sub-20 (17-19) e Sub-21 (20-21)
    var all = c.youth || [];
    var sub17 = all.filter(function (p) { return (p.age || 15) <= 16; });
    var sub20 = all.filter(function (p) { return (p.age || 15) >= 17 && (p.age || 15) <= 19; });
    var sub21 = all.filter(function (p) { return (p.age || 15) >= 20; });
    var TABS = [["all", "Todos", all], ["s17", "Sub-17", sub17], ["s20", "Sub-20", sub20], ["s21", "Sub-21", sub21]];
    if (!youthTab) youthTab = "all";
    var tabRow = el("div", { class: "youth-tabs panel-narrow" });
    TABS.forEach(function (t) {
      tabRow.appendChild(el("button", { class: "youth-tab" + (youthTab === t[0] ? " on" : ""), on: { click: function () { youthTab = t[0]; TM.ui.go("coach-youth"); } } }, [
        el("span", { text: t[1] }), el("span", { class: "youth-tab-n", text: t[2].length })
      ]));
    });
    screen.appendChild(tabRow);

    var shown = (TABS.filter(function (t) { return t[0] === youthTab; })[0] || TABS[0])[2];
    var list = el("div", { class: "panel-narrow squad-list" });
    var order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    shown.slice().sort(function (a, b) { return order[a.pos] - order[b.pos] || b.potential - a.potential; }).forEach(function (p) {
      var row = TM.ui.playerRow(p, { onClick: function (pl) { TM.coachUI.openPlayer(pl, TM.ui.current()); } });
      var cat = (p.age || 15) <= 16 ? "Sub-17" : (p.age || 15) <= 19 ? "Sub-20" : "Sub-21";
      row.appendChild(el("span", { class: "youth-cat" + ((p.age || 15) >= 21 ? " last" : ""), text: (p.age || 15) >= 21 ? "⏳ último ano" : cat }));
      if (p.scoutedBy) row.appendChild(el("span", { class: "youth-cat", text: "🔭 " + p.scoutedBy }));
      var canPromote = p.age >= 15;
      row.appendChild(el("button", { class: "buy-btn" + (canPromote ? "" : " disabled"), text: canPromote ? "Subir ↑" : p.age + " anos", on: { click: function (e) {
        e.stopPropagation();
        if (!canPromote) { TM.ui.toast("Mínimo de 15 anos para promover"); return; }
        if (C().promoteYouth(c, p.id)) { TM.storage.saveCoachCareer(c); TM.ui.toast("✔ " + p.name + " promovido ao profissional!"); TM.ui.go("coach-youth"); }
      } } }));
      list.appendChild(row);
    });
    if (!shown.length) list.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador nesta categoria." }));
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
      onDone: function () { driftYouthPotential(c, result, myYouth); TM.storage.saveCoachCareer(c); TM.ui.go("coach-match", { teamA: teamA, teamB: teamB, result: result }); }
    });
  });
  // o potencial da base SOBE ou CAI conforme o desempenho nas partidas de base
  function driftYouthPotential(c, result, myPlayers) {
    var won = result.score[0] > result.score[1], lost = result.score[0] < result.score[1];
    var scorers = {}; (result.events || []).forEach(function (e) { if ((e.type === "goal" || e.type === "pengoal") && e.team === 0 && e.player) scorers[e.player] = true; });
    var ups = [], downs = [];
    (myPlayers || []).forEach(function (mp) {
      var yp = (c.youth || []).filter(function (y) { return y.id === mp.id; })[0]; if (!yp) return;
      var pot = yp.potential || yp.overall || 60;
      var pUp = won ? 0.30 : lost ? 0.08 : 0.16;         // chance base de subir
      var pDn = lost ? 0.26 : won ? 0.04 : 0.10;         // chance base de cair
      if (scorers[mp.name]) { pUp += 0.30; pDn = 0; }    // quem decidiu, cresce
      if ((yp.age || 18) <= 17) pUp += 0.06;             // mais jovem = mais volátil p/ cima
      var r = Math.random();
      if (r < pUp && pot < 95) { yp.potential = pot + 1; ups.push(yp.name); }
      else if (r > 1 - pDn && pot > (yp.overall || 50) + 1) { yp.potential = pot - 1; downs.push(yp.name); }
    });
    if (ups.length || downs.length) {
      var parts = [];
      if (ups.length) parts.push("📈 " + ups.slice(0, 4).join(", ") + (ups.length > 4 ? " e +" + (ups.length - 4) : "") + " evoluíram");
      if (downs.length) parts.push("📉 " + downs.slice(0, 3).join(", ") + (downs.length > 3 ? " e +" + (downs.length - 3) : "") + " regrediram");
      TM.notify.push(c, { icon: "🌱", title: "Potencial da base atualizado", text: parts.join(" · ") + " após a partida de base." });
    }
  }
})(window);
