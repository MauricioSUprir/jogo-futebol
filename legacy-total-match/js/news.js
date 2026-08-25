/* ================= TOTAL MATCH — Aba Notícias (jornal) ================= */
/* Feed de notícias para as duas carreiras: junta os avisos marcados como
   news:true com manchetes geradas do mundo (clássicos, joias, mercado). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function clubName(id) { var c = TM.data.club(id); return c ? c.name : ""; }

  // manchetes geradas a partir do mundo (evergreen, dão vida ao jornal)
  function generated(career) {
    var W = TM.data.world(), out = [];
    var myLeagueId = null;
    try { myLeagueId = TM.data.club(career.clubId).leagueId; } catch (e) {}
    var league = myLeagueId ? TM.data.league(myLeagueId) : pick(W.leagues);
    if (!league) return out;
    var clubs = league.clubIds.map(TM.data.club).filter(Boolean);
    if (clubs.length < 4) return out;

    // 1) clássico da rodada (rivalidade)
    var withRival = clubs.filter(function (c) { return TM.data.rivalsOf(c.id).length; });
    if (withRival.length) {
      var a = pick(withRival), b = TM.data.club(TM.data.rivalsOf(a.id)[0]);
      if (b) out.push({ icon: "🔥", tag: "CLÁSSICO", thumb: a.id,
        headline: "Clima esquenta para o clássico " + a.name + " x " + b.name,
        body: "A rivalidade histórica promete lotar o estádio. Torcidas prometem festa e os dois técnicos já trocam alfinetadas na imprensa." });
    }
    // 2) joia para observar
    var young = [];
    clubs.forEach(function (c) { TM.data.clubPlayers(c.id).forEach(function (p) { if (p.age <= 20 && p.overall >= 74) young.push(p); }); });
    if (young.length) {
      var j = pick(young);
      out.push({ icon: "💎", tag: "REVELAÇÃO", thumb: j.clubId,
        headline: j.name + " brilha e vira alvo dos grandes",
        body: "Com apenas " + j.age + " anos, o " + TM.data.posLabel(j) + " do " + clubName(j.clubId) + " (overall " + j.overall + ") é apontado como uma das maiores joias da liga." });
    }
    // 3) rumor de mercado
    var stars = [];
    clubs.forEach(function (c) { TM.data.clubPlayers(c.id).forEach(function (p) { if (p.overall >= 82) stars.push(p); }); });
    if (stars.length >= 2) {
      var s = pick(stars), dest = pick(clubs);
      if (dest.id !== s.clubId) out.push({ icon: "💰", tag: "MERCADO", thumb: s.clubId,
        headline: "Rumor: " + s.name + " na mira do " + dest.name,
        body: "Segundo a imprensa esportiva, o " + dest.name + " sonda a situação de " + s.name + " (" + s.overall + "), estrela do " + clubName(s.clubId) + ". Negócio ainda embrionário." });
    }
    // 4) destaque de liderança/artilharia (fictício de fase)
    var scorer = pick(stars.length ? stars : clubs.map(function (c) { return TM.data.clubPlayers(c.id)[0]; }).filter(Boolean));
    if (scorer) out.push({ icon: "⚽", tag: "ARTILHARIA", thumb: scorer.clubId,
      headline: scorer.name + " embala e lidera a artilharia",
      body: "Em grande fase, " + scorer.name + " do " + clubName(scorer.clubId) + " vem sendo decisivo e aparece na ponta da lista de goleadores da temporada." });

    // 5) SAF: investimento pesado num clube pequeno (de vez em quando)
    if (Math.random() < 0.5) {
      var small = clubs.slice().sort(function (a, b) { return TM.data.clubRating(a.id) - TM.data.clubRating(b.id); })[Math.floor(Math.random() * Math.min(4, clubs.length))];
      if (small) {
        var funds = ["Aurora Capital", "Vanguarda Sports", "Pantera Investimentos", "GreenField Partners", "Meridian Group", "Atlas Holding", "Nova Era Capital"];
        var val = (rint(120, 900));
        out.push({ icon: "💼", tag: "SAF", thumb: small.id,
          headline: small.name + " recebe aporte bilionário da " + pick(funds),
          body: "Em movimento que agita o mercado, o fundo assumiu a SAF do " + small.name + " e promete investir cerca de R$ " + val + " milhões em reforços e infraestrutura. O clube pequeno sonha alto." });
      }
    }
    // 6) clube troca de treinador (de vez em quando)
    if (Math.random() < 0.5) {
      var club2 = pick(clubs);
      var names = ["Renato Bianchi", "Oswaldo Prado", "Héctor Salas", "Miguel Antunes", "Fábio Rebelo", "Diego Marques", "Paulo Vidal", "Sérgio Lemos", "Andrés Coelho", "Vítor Nunes"];
      var why = pick(["após sequência ruim de resultados", "por decisão da nova diretoria", "em comum acordo, buscando novo ciclo", "após eliminação precoce"]);
      out.push({ icon: "🔁", tag: "BASTIDORES", thumb: club2.id,
        headline: club2.name + " demite o técnico e anuncia " + pick(names),
        body: "O " + club2.name + " oficializou a troca no comando técnico " + why + ". O novo treinador chega com a missão de reerguer o time na temporada." });
    }
    return out;
  }

  function feed(career) {
    var news = (career.notifications || []).filter(function (n) { return n.news; })
      .map(function (n) { return { icon: n.icon || "📰", tag: "ÚLTIMA HORA", headline: n.title || "Notícia", body: n.text || "", thumb: null, ts: n.ts }; });
    var gen = generated(career);
    // intercala: manchetes reais primeiro (recentes), depois geradas
    return news.concat(gen);
  }

  function renderNews(screen, mode) {
    var career = mode === "player" ? TM.storage.playerCareer() : TM.storage.coachCareer();
    var back = mode === "player" ? "player-hub" : "coach-hub";
    if (!career) { TM.ui.go(back); return; }
    screen.appendChild(TM.ui.topbar("📰 Notícias", function () { TM.ui.go(back); }));
    if (mode === "coach" && TM.coachUI) TM.coachUI.addBar(screen, "coach-news");

    var items = feed(career);
    var wrap = el("div", { class: "news-wrap" });
    screen.appendChild(wrap);

    // masthead do jornal
    var today = "";
    try { today = mode === "coach" && TM.comp && TM.comp.dateOf ? TM.comp.dateOf(career, career.currentDay).full : ""; } catch (e) {}
    wrap.appendChild(el("div", { class: "news-masthead" }, [
      el("div", { class: "nm-brand", text: "TOTAL NEWS" }),
      el("div", { class: "nm-tagline", text: "⚽ O jornal do futebol" + (today ? " · " + today : "") })
    ]));

    if (!items.length) {
      wrap.appendChild(el("div", { class: "news-empty", text: "Sem notícias por enquanto. Jogue partidas e movimente o mercado para gerar manchetes." }));
      return;
    }

    // manchete principal (lead)
    var lead = items[0];
    var leadCard = el("div", { class: "news-lead" }, [
      lead.thumb ? el("div", { class: "nl-thumb" }, [ TM.img.clubImg(TM.data.club(lead.thumb), "nl-crest") ]) : el("div", { class: "nl-thumb nl-emoji", text: lead.icon }),
      el("div", { class: "nl-body" }, [
        el("span", { class: "nl-tag", text: lead.tag }),
        el("div", { class: "nl-head", text: lead.headline }),
        el("div", { class: "nl-text", text: lead.body })
      ])
    ]);
    wrap.appendChild(leadCard);

    // demais manchetes
    var list = el("div", { class: "news-list" });
    items.slice(1).forEach(function (it) {
      list.appendChild(el("div", { class: "news-item" }, [
        it.thumb ? TM.img.clubImg(TM.data.club(it.thumb), "ni-crest") : el("span", { class: "ni-emoji", text: it.icon }),
        el("div", { class: "ni-body" }, [
          el("span", { class: "ni-tag", text: it.tag }),
          el("div", { class: "ni-head", text: it.headline }),
          el("div", { class: "ni-text", text: it.body })
        ])
      ]));
    });
    wrap.appendChild(list);
  }

  TM.ui.register("coach-news", function (screen) { renderNews(screen, "coach"); });
  TM.ui.register("player-news", function (screen) { renderNews(screen, "player"); });

  TM.news = { feed: feed };
})(window);
