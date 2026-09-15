/* ================= TOTAL MATCH — Técnico sem clube =================
   Ficar desempregado deixa de ser uma tela de espera: os dias passam, o
   mundo joga, a imprensa e as redes falam da sua demissão, e as propostas
   chegam no tempo delas — não quando você aperta atualizar. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function save(c) { TM.storage.saveCoachCareer(c); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function ensure(c) {
    if (!c) return null;
    if (!c.free) c.free = { since: c.currentDay || 0, days: 0, feed: [], greeted: false };
    return c.free;
  }
  function daysOut(c) { var f = ensure(c); return f ? f.days : 0; }

  /* ---------- repercussão da sua saída ---------- */
  function lastClubName(c) {
    var h = (c.clubHistory || []);
    return h.length ? h[h.length - 1].clubName : (c.teamName || "seu último clube");
  }
  function lastLeft(c) {
    var h = (c.clubHistory || []);
    return h.length ? (h[h.length - 1].left || "deixou o clube") : "deixou o clube";
  }
  function feed(c, icon, who, text) {
    var f = ensure(c);
    f.feed.unshift({ icon: icon, who: who, text: text, day: c.currentDay || 0 });
    if (f.feed.length > 30) f.feed.length = 30;
  }
  // logo que fica sem clube, o assunto explode
  function openingBuzz(c) {
    var f = ensure(c); if (f.greeted) return;
    f.greeted = true;
    var clube = lastClubName(c), motivo = lastLeft(c);
    var nome = c.coachName || "o treinador";
    var demitido = /demitid|não renovado/i.test(motivo);
    if (demitido) {
      feed(c, "📰", "Imprensa", "Após a saída do " + clube + ", " + nome + " vira nome disponível no mercado. Dirigentes já sondam.");
      feed(c, "🗣️", "Torcedor do " + clube, pick([
        "Demissão tardia. Já devia ter saído faz tempo.",
        "Não foi só culpa dele, o elenco também não ajudou.",
        "Gostava do trabalho. A diretoria é que não teve paciência."
      ]));
      feed(c, "📊", "Análise", "Os números da passagem pelo " + clube + " vão pesar nas próximas conversas.");
    } else {
      feed(c, "📰", "Imprensa", nome + " deixa o " + clube + " por decisão própria e entra na lista dos clubes que procuram treinador.");
      feed(c, "🗣️", "Torcedor do " + clube, pick(["Saiu pela porta da frente.", "Pena, o trabalho estava começando a engrenar."]));
    }
    save(c);
  }
  // conversa do dia a dia enquanto você está parado
  var DIA = [
    { i: "📰", w: "Imprensa", t: "{n} aparece na lista de {clube} para a vaga de treinador." },
    { i: "📰", w: "Imprensa", t: "Dirigentes de {clube} avaliam nomes no mercado. {n} é um deles." },
    { i: "🗣️", w: "Torcedor", t: "Queria muito o {n} aqui no clube. Trabalho sério." },
    { i: "🗣️", w: "Torcedor", t: "{n}? Prefiro alguém com mais nome, sinceramente." },
    { i: "🎙️", w: "Comentarista", t: "{n} está livre no mercado e não deve demorar a aparecer em algum projeto." },
    { i: "📊", w: "Análise", t: "Sem clube há {d} dia(s): o mercado de treinadores está lento nesta época." },
    { i: "📰", w: "Imprensa", t: "{clube} demitiu o treinador. A vaga abriu e os nomes começam a circular." }
  ];
  function dailyBuzz(c) {
    if (Math.random() > 0.42) return;
    var t = pick(DIA), nome = c.coachName || "o treinador";
    var W = TM.data.world(), alvo = "";
    try {
      var lv = TM.job ? TM.job.coachLevel(c) : 20, alvoR = TM.job ? TM.job.targetRating(c) : 68;
      var cand = W.clubs.filter(function (cl) { var r = TM.data.clubRating(cl.id); return Math.abs(r - alvoR) <= 6; });
      alvo = cand.length ? pick(cand).name : pick(W.clubs).name;
    } catch (e) { alvo = "um clube"; }
    feed(c, t.i, t.w, t.t.replace("{n}", nome).replace("{clube}", alvo).replace("{d}", daysOut(c)));
  }

  /* ---------- passar os dias ---------- */
  function advance(c, n) {
    var f = ensure(c);
    var novas = 0;
    for (var i = 0; i < n; i++) {
      c.currentDay = (c.currentDay || 0) + 1;
      f.days++;
      // o mundo segue jogando
      try { if (TM.wl && TM.wl.tick) TM.wl.tick(c, 1); } catch (e) {}
      try { if (TM.obs) TM.obs.tick(c); } catch (e) {}
      try { if (TM.job && TM.job.tickSond) { var vv = TM.job.tickSond(c); if (vv) feed(c, "📨", "Proposta", "O boato virou proposta: o " + vv + " avançou."); } } catch (e) {}
      dailyBuzz(c);
      // as propostas chegam no tempo delas
      var antes = (c.jobOffers || []).length;
      c._lastOfferGen = 0;
      try { C().generateJobOffers(c); } catch (e) {}
      var depois = (c.jobOffers || []).length;
      if (depois > antes) {
        novas += depois - antes;
        var o = c.jobOffers[0];
        feed(c, "📨", "Proposta", "O " + o.clubName + " procurou você para uma conversa.");
      }
    }
    save(c);
    return novas;
  }

  /* ================= tela ================= */
  TM.ui.register("coach-free", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("modes"); return; }
    if (!c.unemployed) { TM.ui.go("coach-hub"); return; }
    var f = ensure(c);
    openingBuzz(c);
    save(c);

    screen.appendChild(TM.ui.topbar("Sem clube", function () { TM.ui.go("modes"); }));
    var wrap = el("div", { class: "free-wrap" });
    screen.appendChild(wrap);

    var ofertas = (c.jobOffers || []).length;
    var nivel = 0, rot = ""; try { nivel = TM.job.coachLevel(c); rot = TM.job.levelLabel(nivel); } catch (e) {}
    wrap.appendChild(el("div", { class: "free-head" }, [
      el("div", { class: "free-h-l" }, [
        el("div", { class: "free-h-t", text: c.coachName || "Treinador" }),
        el("div", { class: "free-h-s", text: "Sem clube há " + f.days + " dia(s) · saiu do " + lastClubName(c) })
      ]),
      el("div", { class: "free-lv" }, [ el("b", { text: nivel }), el("i", { text: "NÍVEL" }) ])
    ]));
    wrap.appendChild(el("div", { class: "free-rep", text: rot }));

    // passar o tempo
    wrap.appendChild(el("div", { class: "free-skip" }, [
      el("div", { class: "free-skip-t", text: "⏭ Passar o tempo" }),
      el("div", { class: "free-skip-s", text: "Os dias correm, as ligas jogam e os clubes tomam decisões. As propostas aparecem quando aparecem." }),
      el("div", { class: "free-skip-row" }, [
        TM.ui.button("1 dia", function () { pular(1); }, "btn small"),
        TM.ui.button("1 semana", function () { pular(7); }, "btn small"),
        (ofertas ? TM.ui.button("Ver proposta", function () { TM.ui.go("coach-offers"); }, "btn primary small")
                 : TM.ui.button("Até aparecer proposta", function () { pularAte(); }, "btn primary small"))
      ])
    ]));

    // o que fazer enquanto espera
    wrap.appendChild(el("div", { class: "hub-actions" }, [
      hub("📨", "Propostas" + (ofertas ? " (" + ofertas + ")" : ""), function () { TM.ui.go("coach-offers"); }),
      ((c.sackMode === "escolher1" || c.sackMode === "escolher2")
        ? hub("🎯", c.sackMode === "escolher2" ? "Escolher entre dois" : "Escolher clube", function () { TM.ui.go("coach-pick-club"); })
        : null),
      hub("🌍", "Acompanhar ligas", function () { TM.ui.go("coach-world", { from: "coach-free" }); }),
      hub("📱", "Redes sociais", function () { TM.ui.go("coach-social", { from: "coach-free" }); }),
      hub("📰", "Notícias", function () { TM.ui.go("coach-news", { from: "coach-free" }); })
    ]));

    // repercussão
    wrap.appendChild(el("h3", { class: "section-title", text: "O que estão falando" }));
    if (!f.feed.length) wrap.appendChild(el("p", { class: "intro-text", text: "Nada ainda. Deixe os dias correrem." }));
    f.feed.slice(0, 16).forEach(function (m) {
      wrap.appendChild(el("div", { class: "free-msg" }, [
        el("span", { class: "free-msg-ic", text: m.icon }),
        el("div", { class: "free-msg-b" }, [
          el("div", { class: "free-msg-w", text: m.who }),
          el("div", { class: "free-msg-t", text: m.text })
        ])
      ]));
    });

    function hub(ic, txt, fn) {
      return el("button", { class: "hub-btn", on: { click: fn } }, [ el("span", { class: "hub-ic", text: ic }), el("span", { text: txt }) ]);
    }
    function pular(n) {
      var novas = advance(c, n);
      if (novas) TM.ui.toast("📨 " + novas + " proposta(s) nova(s)!");
      TM.ui.go("coach-free");
    }
    function pularAte() {
      // já tem convite esperando? não faz sentido queimar dias
      if ((c.jobOffers || []).length) { TM.ui.toast("Você já tem proposta na mesa."); TM.ui.go("coach-offers"); return; }
      var total = 0, novas = 0;
      while (total < 120 && !novas) { novas = advance(c, 1); total++; }
      TM.ui.toast(novas ? ("📨 " + novas + " proposta(s) após " + total + " dia(s)") : "Ninguém procurou em 120 dias. Tente de novo.");
      TM.ui.go("coach-free");
    }
  });

  /* ---------- modos "escolher clube" da criação da carreira ---------- */
  function candidatos(c, n) {
    var W = TM.data.world(), out = [];
    var alvo = 68; try { alvo = TM.job.targetRating(c); } catch (e) {}
    W.clubs.forEach(function (cl) {
      if (cl.id === c.teamId) return;
      var r = TM.data.clubRating(cl.id);
      if (r > alvo + 4 || r < alvo - 12) return;
      var ok = true; try { ok = TM.job.wouldHire(c, cl.id).ok; } catch (e) {}
      if (ok) out.push({ cl: cl, r: r });
    });
    out.sort(function (a, b) { return b.r - a.r; });
    return n ? out.slice(0, n) : out;
  }
  TM.ui.register("coach-pick-club", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c || !c.unemployed) { TM.ui.go("coach-hub"); return; }
    var modo = c.sackMode || "propostas";
    var dois = modo === "escolher2";
    screen.appendChild(TM.ui.topbar(dois ? "Dois clubes te querem" : "Escolha o seu clube", function () { TM.ui.go("coach-free"); }));
    var wrap = el("div", { class: "free-wrap" });
    screen.appendChild(wrap);
    var lista = candidatos(c, 0);
    if (dois) {
      if (!c.free) ensure(c);
      if (!c.free.dois || !c.free.dois.length) {
        var emb = lista.slice();
        for (var i = emb.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = emb[i]; emb[i] = emb[j]; emb[j] = t; }
        c.free.dois = emb.slice(0, 2).map(function (o) { return o.cl.id; });
        save(c);
      }
      lista = c.free.dois.map(function (id) { var cl = TM.data.club(id); return cl ? { cl: cl, r: TM.data.clubRating(id) } : null; }).filter(Boolean);
    }
    wrap.appendChild(el("p", { class: "intro-text", text: dois
      ? "Dois clubes procuraram você. Escolha com quem vai conversar — o outro segue o caminho dele."
      : "Estes clubes aceitariam o seu currículo hoje. Escolha um para assumir." }));
    if (!lista.length) { wrap.appendChild(el("p", { class: "intro-text", text: "Nenhum clube no seu alcance agora. Passe alguns dias." })); return; }
    lista.slice(0, dois ? 2 : 40).forEach(function (o) {
      var lg = null; try { lg = TM.data.league(o.cl.leagueId); } catch (e) {}
      var row = el("button", { class: "free-club", on: { click: function () {
        TM.ui.confirm("Assumir o " + o.cl.name + "?", "Você passa a comandar o " + o.cl.name + " (força " + o.r + ").", "Assumir", function () {
          C().switchUserClub(c, o.cl.id);
          if (c.free) c.free.dois = null;
          save(c);
          TM.ui.toast("🤝 Você é o novo treinador do " + o.cl.name + "!");
          TM.ui.go("coach-hub");
        });
      } } }, [
        (function () { try { return TM.img.clubImg(o.cl, "free-club-crest"); } catch (e) { return el("span"); } })(),
        el("div", { class: "free-club-i" }, [
          el("div", { class: "free-club-n", text: o.cl.name }),
          el("div", { class: "free-club-s", text: (lg ? lg.name : "") + " · força " + o.r })
        ]),
        el("span", { class: "row-chev", text: "›" })
      ]);
      wrap.appendChild(row);
    });
  });

  TM.free = { ensure: ensure, advance: advance, daysOut: daysOut, openingBuzz: openingBuzz, feed: feed, candidatos: candidatos };
})(window);
