/* ================= TOTAL MATCH — Seleção (vida do cargo) =================
   O trabalho na seleção com pressão de verdade: aprovação do país,
   confiança da federação, ranking mundial, coletiva, repercussão da
   convocação, histórico do seu ciclo e o direito de pedir demissão. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function save(c) { TM.storage.saveCoachCareer(c); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function natName(id) { try { return TM.data.nation(id).name; } catch (e) { return "Seleção"; } }
  function rating(id) { try { return C().natRating(id); } catch (e) { return 70; } }

  /* ---------- estado do cargo ---------- */
  function ensure(c) {
    if (!c || !c.nation) return null;
    var j = c.nation.job;
    if (!j) {
      j = c.nation.job = {
        apr: 55, fed: 60,            // aprovação do país / confiança da federação
        j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0,
        streak: 0,                    // sequência (positiva = invicto, negativa = sem vencer)
        hist: [], feed: [],
        since: c.season || 1, sinceDay: c.currentDay || 0,
        rank: worldRank(c.nation.id), titles: 0
      };
    }
    if (j.rank == null) j.rank = worldRank(c.nation.id);
    return j;
  }
  // posição no ranking mundial: pela nota da seleção, ajustada pelo seu trabalho
  function worldRank(natId) {
    try {
      var all = TM.data.world().nations.slice().sort(function (a, b) { return rating(b.id) - rating(a.id); });
      for (var i = 0; i < all.length; i++) if (all[i].id === natId) return i + 1;
    } catch (e) {}
    return 20;
  }
  function recalcRank(c) {
    var j = ensure(c); if (!j) return;
    var base = worldRank(c.nation.id);
    // aproveitamento desloca o país no ranking (até 8 posições)
    var ap = j.j ? (j.v * 3 + j.e) / (j.j * 3) : 0.5;
    var shift = Math.round((ap - 0.5) * 16);
    j.rank = clamp(base - shift, 1, 60);
  }
  function aproveitamento(j) { return j.j ? Math.round((j.v * 3 + j.e) / (j.j * 3) * 100) : 0; }

  function feed(c, icon, text) {
    var j = ensure(c); if (!j) return;
    j.feed = j.feed || [];
    j.feed.unshift({ icon: icon, text: text, day: c.currentDay || 0 });
    if (j.feed.length > 14) j.feed.length = 14;
  }

  /* ---------- resultado de um jogo da seleção ---------- */
  function recordResult(c, o) {
    var j = ensure(c); if (!j) return;
    var hs = o.hs, as = o.as, oppId = o.oppId, tipo = o.tipo || "Eliminatórias";
    var meu = rating(c.nation.id), dele = rating(oppId);
    var gap = meu - dele;                       // > 0 = você era favorito
    j.j++; j.gp += hs; j.gc += as;
    var venceu = hs > as, empate = hs === as;
    // ganhar de quem é melhor vale muito; perder para quem é pior dói muito
    var peso = clamp(1 + Math.abs(gap) / 10, 1, 2.4);
    var dApr = 0, dFed = 0, linha = "";
    if (venceu) {
      j.v++; j.streak = j.streak >= 0 ? j.streak + 1 : 1;
      dApr = gap < 0 ? 7 * peso : 4; dFed = gap < 0 ? 6 * peso : 3;
      linha = gap <= -6 ? "O país comemora: vitória sobre uma seleção mais forte."
        : "Vitória bem recebida pela torcida.";
    } else if (empate) {
      j.e++; j.streak = 0;
      dApr = gap >= 6 ? -4 * peso : 1; dFed = gap >= 6 ? -3 * peso : 1;
      linha = gap >= 6 ? "Empate contra um adversário mais fraco gerou críticas." : "Empate visto como resultado justo.";
    } else {
      j.d++; j.streak = j.streak <= 0 ? j.streak - 1 : -1;
      dApr = gap >= 6 ? -10 * peso : -5; dFed = gap >= 6 ? -8 * peso : -4;
      linha = gap >= 6 ? "Derrota para um adversário mais fraco. A imprensa pegou pesado."
        : "Derrota dura, mas dentro do esperado pela imprensa.";
    }
    if (tipo === "Copa do Mundo") { dApr *= 1.6; dFed *= 1.5; }
    // sequência longa amplifica os dois lados
    if (j.streak >= 4) { dApr += 3; dFed += 2; }
    if (j.streak <= -3) { dApr -= 4; dFed -= 3; }
    j.apr = clamp(Math.round(j.apr + dApr), 0, 100);
    j.fed = clamp(Math.round(j.fed + dFed), 0, 100);
    j.hist.unshift({ s: c.season, dia: c.currentDay, tipo: tipo, opp: natName(oppId), hs: hs, as: as });
    if (j.hist.length > 40) j.hist.length = 40;
    recalcRank(c);
    feed(c, venceu ? "✅" : empate ? "➖" : "❌", tipo + " · " + hs + "x" + as + " contra " + natName(oppId) + ". " + linha);
    // a federação pode perder a paciência (com estabilidade no cargo, não demite)
    if (j.fed <= 12 && j.j >= 4 && !c.noSack) {
      TM.notify.push(c, { icon: "🚫", title: "Demitido da seleção", news: true,
        text: "A federação de " + c.nation.name + " anunciou a sua saída. Aproveitamento de " + aproveitamento(j) + "% e a sequência recente pesaram na decisão." });
      c.natRep = clamp((c.natRep == null ? 50 : c.natRep) - 12, 0, 100);
      c.nation = null; save(c); return { fired: true };
    }
    save(c);
    return { fired: false, dApr: Math.round(dApr), dFed: Math.round(dFed), linha: linha };
  }

  /* ---------- repercussão da convocação ---------- */
  // quem ficou de fora e merecia estar: gera barulho
  function callupReaction(c) {
    var j = ensure(c); if (!j) return [];
    var pool = [];
    try { pool = TM.data.nationSquad(c.nation.id) || []; } catch (e) { return []; }
    var dentro = {}; (c.nation.squad || []).forEach(function (id) { dentro[id] = 1; });
    var fora = pool.filter(function (p) { return !dentro[p.id]; }).sort(function (a, b) { return b.overall - a.overall; });
    var msgs = [];
    var melhorFora = fora[0];
    var piorDentro = (c.nation.squad || []).map(function (id) { return TM.data.player(id); })
      .filter(Boolean).sort(function (a, b) { return a.overall - b.overall; })[0];
    if (melhorFora && piorDentro && melhorFora.overall >= piorDentro.overall + 6) {
      var perda = Math.min(7, Math.round((melhorFora.overall - piorDentro.overall) / 2));
      j.apr = clamp(j.apr - perda, 0, 100);
      msgs.push({ icon: "🗣️", text: "A imprensa não entendeu a ausência de " + melhorFora.name + " (" + melhorFora.overall + "). “Fora da lista sem explicação.”" });
      feed(c, "🗣️", "Cobrança pela ausência de " + melhorFora.name + " na convocação.");
    }
    var jovens = (c.nation.squad || []).map(function (id) { return TM.data.player(id); })
      .filter(function (p) { return p && p.age <= 21; }).length;
    if (jovens >= 4) {
      j.apr = clamp(j.apr + 3, 0, 100);
      msgs.push({ icon: "🌱", text: "Lista com " + jovens + " garotos agradou quem pede renovação." });
      feed(c, "🌱", "Convocação com " + jovens + " jogadores de até 21 anos abriu o debate sobre renovação.");
    }
    var media = 0, n = 0;
    (c.nation.squad || []).forEach(function (id) { var p = TM.data.player(id); if (p) { media += p.overall; n++; } });
    media = n ? Math.round(media / n) : 0;
    msgs.push({ icon: "📋", text: "Lista com " + n + " nomes, média " + media + " de overall." });
    save(c);
    return msgs;
  }

  /* ---------- coletiva da seleção ---------- */
  var PERGUNTAS = [
    { q: "A torcida cobra um time mais ofensivo. O senhor vai mudar?",
      a: [ { t: "“Vamos com tudo para cima deles.”", apr: 4, edge: 1, risco: 1 },
           { t: "“Respeitamos o adversário e jogamos o nosso jogo.”", apr: 1, edge: 0, risco: 0 },
           { t: "“Quem escala sou eu, não a torcida.”", apr: -5, edge: -1, risco: 0 } ] },
    { q: "Muita gente questiona a sua lista. Ficou incomodado?",
      a: [ { t: "“Assumo todas as escolhas. A responsabilidade é minha.”", apr: 3, edge: 1, risco: 0 },
           { t: "“Quem critica não vê os treinos.”", apr: -3, edge: 1, risco: 1 },
           { t: "“Prefiro não comentar.”", apr: -1, edge: 0, risco: 0 } ] },
    { q: "A federação te deu prazo até a próxima Copa. Sente segurança?",
      a: [ { t: "“Tenho total apoio e trabalho tranquilo.”", apr: 1, edge: 0, risco: 0 },
           { t: "“Ninguém tem segurança nesse cargo. Trabalho por resultado.”", apr: 4, edge: 0, risco: 0 },
           { t: "“Se não quiserem, é só me avisar.”", apr: -2, edge: -1, risco: 2 } ] },
    { q: "O que o senhor promete ao país nesta caminhada?",
      a: [ { t: "“Prometo entrega. Resultado vem do trabalho.”", apr: 2, edge: 1, risco: 0 },
           { t: "“Vamos ganhar essa Copa. Pode cobrar.”", apr: 8, edge: 1, risco: 3 },
           { t: "“Promessa não ganha jogo.”", apr: -2, edge: 0, risco: 0 } ] },
    { q: "Um dos convocados vive má fase no clube. Por que ele está aqui?",
      a: [ { t: "“Conheço o jogador. Na seleção ele é outro.”", apr: 2, edge: 2, risco: 1 },
           { t: "“Está aqui porque merece, ponto.”", apr: 0, edge: 1, risco: 0 },
           { t: "“Foi um erro meu, vou reavaliar.”", apr: -4, edge: -2, risco: 0 } ] }
  ];
  function pressSet(c) {
    var seed = (c.season || 1) * 100 + ((c.nation && c.nation.job && c.nation.job.j) || 0);
    var out = [], usados = {};
    for (var i = 0; i < 3; i++) {
      var k = (seed * 7 + i * 13) % PERGUNTAS.length;
      while (usados[k]) k = (k + 1) % PERGUNTAS.length;
      usados[k] = 1; out.push(PERGUNTAS[k]);
    }
    return out;
  }
  function applyPress(c, escolhas) {
    var j = ensure(c); if (!j) return { edge: 0 };
    var apr = 0, edge = 0, risco = 0;
    escolhas.forEach(function (a) { apr += a.apr; edge += a.edge; risco += a.risco; });
    j.apr = clamp(Math.round(j.apr + apr), 0, 100);
    c.nation.pressEdge = clamp(edge, -3, 3);
    c.nation.pressDone = true;
    c.nation.promessa = risco >= 3 ? true : c.nation.promessa;
    feed(c, "🎤", "Coletiva da seleção: " + (apr > 0 ? "o país gostou do discurso." : apr < 0 ? "o discurso caiu mal." : "falas mornas, sem repercussão."));
    save(c);
    return { edge: edge, apr: apr, risco: risco };
  }

  /* ---------- pedir demissão ---------- */
  function resign(c, motivo) {
    var j = ensure(c); if (!j) return;
    var nome = c.nation.name, ap = aproveitamento(j), jogos = j.j;
    // sair bem ou sair mal muda como o mundo te vê
    var bem = ap >= 55 || j.titles > 0;
    var rep = clamp((c.natRep == null ? 50 : c.natRep) + (bem ? 4 : -10), 0, 100);
    c.natRep = rep;
    c.natHistory = c.natHistory || [];
    c.natHistory.push({ nation: nome, s0: j.since, s1: c.season, j: jogos, v: j.v, e: j.e, d: j.d, ap: ap, titles: j.titles, saida: "demissão" });
    // a federação não esquece: por um tempo ninguém te chama
    c.natCooldown = (c.season || 1) + (bem ? 1 : 2);
    TM.notify.push(c, { icon: "🚪", title: "Você deixou a seleção", news: true,
      text: "Você pediu demissão da seleção de " + nome + " após " + jogos + " jogo(s) e " + ap + "% de aproveitamento. " +
        (bem ? "A federação lamentou a saída e agradeceu o trabalho." : "A federação aceitou de imediato e já procura um substituto.") +
        (motivo ? " Motivo declarado: " + motivo : "") });
    try {
      if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: "🚪", title: "Saída da seleção", text: "Técnico deixa a seleção de " + nome + " por decisão própria." });
    } catch (e) {}
    c.nation = null;
    save(c);
  }

  /* ---------- rótulos ---------- */
  function aprLabel(v) {
    return v >= 80 ? "Aclamado" : v >= 62 ? "Bem avaliado" : v >= 45 ? "Dividido" : v >= 28 ? "Sob pressão" : "Insustentável";
  }
  function fedLabel(v) {
    return v >= 80 ? "Blindado" : v >= 62 ? "Apoiado" : v >= 45 ? "Observado" : v >= 25 ? "Na corda bamba" : "Prestes a cair";
  }
  function barra(cls, v, rot, txt) {
    return el("div", { class: "sel-meter " + cls }, [
      el("div", { class: "sel-m-top" }, [ el("span", { class: "sel-m-lbl", text: rot }), el("span", { class: "sel-m-v", text: txt }) ]),
      el("div", { class: "sel-m-track" }, [ el("div", { class: "sel-m-fill", style: "width:" + clamp(v, 0, 100) + "%" }) ])
    ]);
  }

  /* ---------- painel que entra na tela da seleção ---------- */
  function panel(c) {
    var j = ensure(c); if (!j) return el("span");
    var wrap = el("div", { class: "sel-panel" });
    wrap.appendChild(el("div", { class: "sel-top" }, [
      el("div", { class: "sel-rank" }, [ el("b", { text: "#" + j.rank }), el("i", { text: "RANKING" }) ]),
      el("div", { class: "sel-rec" }, [
        el("div", { class: "sel-rec-n", text: j.j + " jogos · " + j.v + "V " + j.e + "E " + j.d + "D" }),
        el("div", { class: "sel-rec-s", text: aproveitamento(j) + "% de aproveitamento" + (j.streak >= 3 ? " · " + j.streak + " jogos invicto" : j.streak <= -2 ? " · " + Math.abs(j.streak) + " sem vencer" : "") })
      ])
    ]));
    wrap.appendChild(barra("apr", j.apr, "Aprovação do país", aprLabel(j.apr)));
    wrap.appendChild(barra("fed", j.fed, "Confiança da federação", fedLabel(j.fed)));
    if (j.fed < 30) wrap.appendChild(el("div", { class: "sel-alert", text: c.noSack
      ? "⚠ A federação está impaciente, mas o seu cargo está garantido. A cobrança é só no discurso."
      : "⚠ A federação está impaciente. Mais tropeços e você cai." }));
    if (c.nation.promessa) wrap.appendChild(el("div", { class: "sel-promise", text: "🎙️ Você prometeu o título em público. O país vai cobrar." }));
    return wrap;
  }

  /* ================= telas ================= */

  /* coletiva da seleção */
  TM.ui.register("coach-nation-press", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c || !c.nation) { TM.ui.go("coach-hub"); return; }
    ensure(c);
    screen.appendChild(TM.ui.topbar("🎤 Coletiva · " + c.nation.name, function () { TM.ui.go("coach-nation"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    if (c.nation.pressDone) {
      body.appendChild(el("div", { class: "press-done", text: "🎤 Coletiva já realizada nesta convocação" + (c.nation.pressEdge > 0 ? " — elenco confiante" : c.nation.pressEdge < 0 ? " — clima tenso" : "") }));
      body.appendChild(TM.ui.button("Voltar", function () { TM.ui.go("coach-nation"); }, "btn wide"));
      return;
    }
    body.appendChild(el("p", { class: "intro-text", text: "A imprensa do país inteiro está na sala. O que você fala aqui mexe com a torcida e com a cabeça do grupo." }));
    var qs = pressSet(c), escolhas = [], i = 0;
    var box = el("div", {});
    body.appendChild(box);
    render();
    function render() {
      TM.ui.clear(box);
      if (i >= qs.length) {
        var r = applyPress(c, escolhas);
        box.appendChild(el("div", { class: "press-done", text: "🎤 Coletiva encerrada." }));
        box.appendChild(el("div", { class: "sel-press-res" }, [
          el("div", { text: (r.apr > 0 ? "📈 O país gostou (+" + r.apr + " de aprovação)" : r.apr < 0 ? "📉 Repercussão ruim (" + r.apr + " de aprovação)" : "➖ Sem repercussão") }),
          el("div", { text: r.edge > 0 ? "💪 O grupo entra confiante no próximo jogo." : r.edge < 0 ? "😬 O grupo ficou tenso." : "😐 O grupo seguiu na mesma." })
        ]));
        box.appendChild(TM.ui.button("Voltar à seleção", function () { TM.ui.go("coach-nation"); }, "btn primary wide"));
        return;
      }
      var q = qs[i];
      box.appendChild(el("div", { class: "press-q" }, [
        el("div", { class: "press-q-n", text: "Pergunta " + (i + 1) + " de " + qs.length }),
        el("div", { class: "press-q-t", text: "“" + q.q + "”" })
      ]));
      q.a.forEach(function (a) {
        box.appendChild(el("button", { class: "press-a", text: a.t, on: { click: function () { escolhas.push(a); i++; render(); } } }));
      });
    }
  });

  /* meu trabalho na seleção */
  TM.ui.register("coach-nation-job", function (screen) {
    var c = TM.storage.coachCareer();
    if (!c || !c.nation) { TM.ui.go("coach-hub"); return; }
    var j = ensure(c);
    screen.appendChild(TM.ui.topbar("📜 Meu trabalho", function () { TM.ui.go("coach-nation"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(panel(c));
    body.appendChild(el("div", { class: "sel-stats" }, [
      stat("Gols marcados", j.gp), stat("Gols sofridos", j.gc),
      stat("Saldo", (j.gp - j.gc > 0 ? "+" : "") + (j.gp - j.gc)),
      stat("No cargo desde", "temporada " + j.since)
    ]));
    if (j.feed && j.feed.length) {
      body.appendChild(el("h3", { class: "section-title", text: "Repercussão" }));
      j.feed.forEach(function (f) {
        body.appendChild(el("div", { class: "sel-feed" }, [ el("span", { class: "sel-feed-ic", text: f.icon }), el("span", { text: f.text }) ]));
      });
    }
    if (j.hist && j.hist.length) {
      body.appendChild(el("h3", { class: "section-title", text: "Resultados" }));
      j.hist.forEach(function (h) {
        var res = h.hs > h.as ? "v" : h.hs === h.as ? "e" : "d";
        body.appendChild(el("div", { class: "sel-res " + res }, [
          el("span", { class: "sel-res-b", text: res.toUpperCase() }),
          el("span", { class: "sel-res-t", text: h.tipo + " · " + h.opp }),
          el("span", { class: "sel-res-p", text: h.hs + "×" + h.as })
        ]));
      });
    }
    if (c.natHistory && c.natHistory.length) {
      body.appendChild(el("h3", { class: "section-title", text: "Passagens anteriores" }));
      c.natHistory.forEach(function (h) {
        body.appendChild(el("div", { class: "sel-feed" }, [ el("span", { class: "sel-feed-ic", text: "🏳️" }),
          el("span", { text: h.nation + " (" + h.s0 + "–" + h.s1 + "): " + h.j + " jogos, " + h.ap + "% · saída por " + h.saida }) ]));
      });
    }
    function stat(k, v) { return el("div", { class: "sel-stat" }, [ el("b", { text: String(v) }), el("i", { text: k }) ]); }
  });

  /* ---------- API ---------- */
  TM.sel = {
    ensure: ensure, panel: panel, recordResult: recordResult, callupReaction: callupReaction,
    resign: resign, aproveitamento: aproveitamento, worldRank: worldRank, feed: feed,
    aprLabel: aprLabel, fedLabel: fedLabel,
    // demissão com confirmação (usada pelo botão na tela da seleção)
    askResign: function (c, after) {
      var j = ensure(c); if (!j) return;
      var ap = aproveitamento(j);
      var aviso = j.fed >= 60
        ? "A federação confia em você — sair agora vai pegar mal lá fora."
        : "Com a federação assim, a saída não vai surpreender ninguém.";
      TM.ui.confirm("Pedir demissão da seleção?",
        "Você deixa o comando de " + c.nation.name + " com " + j.j + " jogo(s) e " + ap + "% de aproveitamento. " + aviso +
        " Sua carreira no clube continua normalmente, mas leva um tempo até outra seleção te procurar.",
        "Pedir demissão", function () {
          resign(c, null);
          TM.ui.toast("Você deixou a seleção.");
          if (after) after(); else TM.ui.go("coach-hub");
        }, true);
    }
  };
})(window);
