/* ================= TOTAL ULTIMATE — TEMPORADA E OBJETIVOS =================
   Passe da temporada (40 níveis, XP de tudo o que se joga, prêmio em cada nível
   e marcos fortes de 5 em 5) e os objetivos em quatro grupos:
     - Diários (4, trocam todo dia) · Semanais (5, trocam na virada da semana)
     - Temporada (marcos grandes, valem a temporada inteira)
     - Fundamentos (uma vez só: ensinam o modo a quem chega)
   Tudo conta pelos eventos do Ultimate (partida, pacote, venda, compra, dme,
   item, evolucao, divisao) — nenhuma tela precisa chamar nada à mão.
   Como no Ultimate Team atual (Rewards Path + Objectives), com prêmios do
   Total Match e sem pacote pago dando XP (progresso é jogando). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  function I() { return TM.ut._i; }
  function M() { return TM.utModos; }
  function ic(n) { return TM.ic(n); }

  var SEMANAS = 6, NIVEIS = 40, XP_NIVEL = 1000;

  /* ================= temporada ================= */
  function tempId() { return Math.floor(I().weekOf() / SEMANAS); }
  // a Temporada 1 é a que começou junto com este modo novo (outubro de 2026)
  var TEMP_BASE = 493;
  function tempNome(id) { return "Temporada " + Math.max(1, id - TEMP_BASE + 1); }
  function diasRestantes() {
    var fimDia = (tempId() + 1) * SEMANAS * 7;          // dia (desde 1970) em que a próxima começa
    return Math.max(1, fimDia - I().today());
  }
  function estado(s) {
    var id = tempId();
    if (!s.temp || s.temp.id !== id) {
      // temporada nova: prêmios que ficaram sem resgatar são entregues
      if (s.temp && s.temp.id != null) {
        var pend = [];
        for (var n = 1; n <= nivelDe(s.temp.xp); n++) if (!s.temp.pegos[n]) pend.push(n);
        pend.forEach(function (n) { M().darRecompensa(s, recNivel(n), tempNome(s.temp.id) + " · nível " + n); });
        if (pend.length) s.tempAviso = tempNome(s.temp.id) + " acabou: " + pend.length + (pend.length > 1 ? " prêmios entregues" : " prêmio entregue") + " no seu clube.";
      }
      s.temp = { id: id, xp: 0, pegos: {} };
      s.objT = { id: id, prog: {}, ok: {} };
      I().save();
    }
    return s.temp;
  }
  function nivelDe(xp) { return Math.min(NIVEIS, Math.floor((xp || 0) / XP_NIVEL)); }
  // prêmio de cada nível: marcos fortes de 5 em 5, o resto alterna moedas, pacotes e itens
  function recNivel(n) {
    var M5 = {
      5: { pick: { n: 3, lo: 80 } },
      10: { packs: ["ourorare"], itens: [{ t: "quimica", e: "cacador" }] },
      15: { fichas: 1, coins: 5000 },
      20: { pick: { n: 3, lo: 83 } },
      25: { packs: ["jumbo"] },
      30: { pick: { n: 3, lo: 84, ver: "tots" } },
      35: { packs: ["mega"] },
      40: { pick: { n: 3, lo: 85, ver: "icone" } }
    };
    if (M5[n]) return M5[n];
    var k = n % 5;
    if (k === 1) return { coins: 1000 + n * 60 };
    if (k === 2) return { packs: [n < 20 ? "prata" : "ouro"] };
    if (k === 3) return { coins: 1500 + n * 80 };
    return n % 10 === 4 ? { itens: [{ t: "contrato", n: 10 }, { t: "forma" }] } : { packs: [n < 15 ? "ouro" : "ourorare"] };
  }
  function ganhaXp(s, n, origem) {
    if (!s || !n) return 0;
    var t = estado(s), antes = nivelDe(t.xp);
    t.xp = Math.min(NIVEIS * XP_NIVEL, (t.xp || 0) + n);
    var depois = nivelDe(t.xp);
    I().save();
    if (depois > antes) {
      I().emit("nivel", { s: s, nivel: depois });
      try { TM.ui.toast("Temporada: nível " + depois + "! Resgate o prêmio em Temporada.", "ok"); } catch (e) {}
    }
    return depois - antes;
  }
  function pendentes(s) {
    var t = estado(s), n = 0;
    for (var i = 1; i <= nivelDe(t.xp); i++) if (!t.pegos[i]) n++;
    return n;
  }
  function resgata(s, n) {
    var t = estado(s);
    if (t.pegos[n] || n > nivelDe(t.xp)) return [];
    t.pegos[n] = 1;
    return M().darRecompensa(s, recNivel(n), tempNome(t.id) + " · nível " + n);
  }

  /* ================= objetivos ================= */
  // conta(ev, dado) devolve quanto o evento soma no objetivo
  function P(f) { return function (ev, d) { return ev === "partida" ? f(d) : 0; }; }
  var DIARIOS = [
    { id: "d_jogar3", tx: "Jogue 3 partidas em qualquer modo", n: 3, r: { coins: 1500, xp: 200 }, conta: P(function () { return 1; }) },
    { id: "d_vencer2", tx: "Vença 2 partidas", n: 2, r: { coins: 2000, xp: 250 }, conta: P(function (d) { return d.venceu ? 1 : 0; }) },
    { id: "d_gols5", tx: "Marque 5 gols", n: 5, r: { coins: 1800, xp: 200 }, conta: P(function (d) { return d.gf || 0; }) },
    { id: "d_riv2", tx: "Jogue 2 partidas nos Rivais", n: 2, r: { coins: 1500, xp: 200 }, conta: P(function (d) { return d.modo === "riv" ? 1 : 0; }) },
    { id: "d_bat1", tx: "Vença 1 Batalha de Elenco no Profissional ou acima", n: 1, r: { coins: 2500, xp: 250 }, conta: P(function (d) { return d.modo === "batalha" && d.venceu && d.dif && d.dif !== "amador" ? 1 : 0; }) },
    { id: "d_semsofrer", tx: "Termine 1 partida sem sofrer gol", n: 1, r: { coins: 1800, xp: 200 }, conta: P(function (d) { return d.ga === 0 && !d.wo ? 1 : 0; }) },
    { id: "d_chem", tx: "Jogue com 25 ou mais de química", n: 1, r: { coins: 1500, xp: 200 }, conta: P(function (d) { return !d.xi.length ? 0 : (I().squadRating(d.s).chem >= 25 ? 1 : 0); }) },
    { id: "d_pack1", tx: "Abra 1 pacote", n: 1, r: { coins: 800, xp: 100 }, conta: function (ev) { return ev === "pacote" ? 1 : 0; } },
    { id: "d_merc1", tx: "Compre ou venda 1 carta no mercado", n: 1, r: { coins: 1200, xp: 150 }, conta: function (ev, d) { return ev === "compra" ? 1 : ev === "venda" ? (d.n || 1) : 0; } },
    { id: "d_dme1", tx: "Complete 1 DME", n: 1, r: { coins: 2000, xp: 250 }, conta: function (ev) { return ev === "dme" ? 1 : 0; } }
  ];
  var SEMANAIS = [
    { id: "s_vencer10", tx: "Vença 10 partidas", n: 10, r: { coins: 8000, xp: 800, packs: ["ouro"] }, conta: P(function (d) { return d.venceu ? 1 : 0; }) },
    { id: "s_gols25", tx: "Marque 25 gols", n: 25, r: { coins: 6000, xp: 700 }, conta: P(function (d) { return d.gf || 0; }) },
    { id: "s_riv5", tx: "Vença 5 partidas nos Rivais", n: 5, r: { coins: 7000, xp: 800, packs: ["ourorare"] }, conta: P(function (d) { return d.modo === "riv" && d.venceu ? 1 : 0; }) },
    { id: "s_bat5", tx: "Jogue 5 Batalhas de Elenco", n: 5, r: { coins: 5000, xp: 600 }, conta: P(function (d) { return d.modo === "batalha" ? 1 : 0; }) },
    { id: "s_champ1", tx: "Jogue 1 partida da Champions", n: 1, r: { xp: 600, packs: ["ouro"] }, conta: P(function (d) { return d.modo === "champions" ? 1 : 0; }) },
    { id: "s_dme3", tx: "Complete 3 DME", n: 3, r: { coins: 6000, xp: 700 }, conta: function (ev) { return ev === "dme" ? 1 : 0; } },
    { id: "s_draft2", tx: "Jogue 2 partidas de Draft", n: 2, r: { xp: 600, fichas: 1 }, conta: P(function (d) { return d.modo === "draft" ? 1 : 0; }) },
    { id: "s_semsofrer3", tx: "3 partidas sem sofrer gol", n: 3, r: { coins: 5000, xp: 600 }, conta: P(function (d) { return d.ga === 0 && !d.wo ? 1 : 0; }) },
    { id: "s_pack5", tx: "Abra 5 pacotes", n: 5, r: { coins: 3000, xp: 400 }, conta: function (ev) { return ev === "pacote" ? 1 : 0; } },
    { id: "s_vender5", tx: "Venda 5 cartas no mercado", n: 5, r: { coins: 4000, xp: 500 }, conta: function (ev, d) { return ev === "venda" ? (d.n || 1) : 0; } }
  ];
  var TEMPORADA = [
    { id: "t_jogos50", tx: "Jogue 50 partidas", n: 50, r: { xp: 2500, packs: ["jumbo"] }, conta: P(function () { return 1; }) },
    { id: "t_vit30", tx: "Vença 30 partidas", n: 30, r: { xp: 3000, pick: { n: 3, lo: 84 } }, conta: P(function (d) { return d.venceu ? 1 : 0; }) },
    { id: "t_gols100", tx: "Marque 100 gols", n: 100, r: { xp: 2500, coins: 25000 }, conta: P(function (d) { return d.gf || 0; }) },
    { id: "t_div5", tx: "Chegue à Divisão 5 nos Rivais", n: 1, r: { xp: 2500, packs: ["mega"] }, conta: function (ev, d) { return (ev === "divisao" && d.div <= 5) || (ev === "partida" && d.s.riv.div <= 5) ? 1 : 0; } },
    { id: "t_dme10", tx: "Complete 10 DME", n: 10, r: { xp: 2000, packs: ["jumbo"] }, conta: function (ev) { return ev === "dme" ? 1 : 0; } },
    { id: "t_evo3", tx: "Conclua 3 Evoluções", n: 3, r: { xp: 2000, pick: { n: 3, lo: 83 } }, conta: function (ev) { return ev === "evolucao" ? 1 : 0; } },
    { id: "t_finais", tx: "Chegue às Finais da Champions", n: 1, r: { xp: 3000, packs: ["mega"] }, conta: P(function (d) { return d.s.champ && (d.s.champ.fase === "finais" || d.s.champ.fase === "fim") ? 1 : 0; }) },
    { id: "t_draft10", tx: "Vença 10 partidas de Draft", n: 10, r: { xp: 2000, fichas: 2 }, conta: P(function (d) { return d.modo === "draft" && d.venceu ? 1 : 0; }) }
  ];
  var FUNDAMENTOS = [
    { id: "f_quimica", tx: "Monte um time titular com 20 ou mais de química", n: 1, r: { coins: 2000, xp: 300 }, conta: function (ev, d) { return d && d.s && I().squadRating(d.s).chem >= 20 ? 1 : 0; } },
    { id: "f_riv", tx: "Jogue uma partida nos Rivais", n: 1, r: { coins: 1500, xp: 300, packs: ["prata"] }, conta: P(function (d) { return d.modo === "riv" ? 1 : 0; }) },
    { id: "f_bat", tx: "Jogue uma Batalha de Elenco", n: 1, r: { coins: 1500, xp: 300 }, conta: P(function (d) { return d.modo === "batalha" ? 1 : 0; }) },
    { id: "f_estilo", tx: "Aplique um estilo de química numa carta (Itens)", n: 1, r: { coins: 1500, xp: 300 }, conta: function (ev, d) { return ev === "item" && d.it && d.it.t === "quimica" ? 1 : 0; } },
    { id: "f_pacote", tx: "Abra um pacote", n: 1, r: { coins: 1000, xp: 200 }, conta: function (ev) { return ev === "pacote" ? 1 : 0; } },
    { id: "f_venda", tx: "Venda uma carta no mercado", n: 1, r: { coins: 2000, xp: 300 }, conta: function (ev) { return ev === "venda" ? 1 : 0; } },
    { id: "f_dme", tx: "Complete um DME", n: 1, r: { xp: 300, packs: ["ouro"] }, conta: function (ev) { return ev === "dme" ? 1 : 0; } },
    { id: "f_draft", tx: "Jogue uma partida de Draft", n: 1, r: { coins: 2000, xp: 300 }, conta: P(function (d) { return d.modo === "draft" ? 1 : 0; }) }
  ];
  var TODOS = {};
  [DIARIOS, SEMANAIS, TEMPORADA, FUNDAMENTOS].forEach(function (g) { g.forEach(function (o) { TODOS[o.id] = o; }); });

  // as listas do dia e da semana (sorteadas por semente: o mesmo dia mostra os mesmos)
  function sorteia(lista, n, seed) {
    var U = I(), rnd = U.mulberry(seed >>> 0);
    return U.shuffle(lista, rnd).slice(0, n).map(function (o) { return o.id; });
  }
  function objEstado(s) {
    var U = I(), d = U.today(), w = U.weekOf();
    s.objs = s.objs || {};
    var o = s.objs;
    if (o.dia !== d) { o.dia = d; o.d = sorteia(DIARIOS, 4, U.hashStr("od" + d + "_" + s.seed)); o.dp = {}; o.dok = {}; }
    if (o.sem !== w) { o.sem = w; o.s = sorteia(SEMANAIS, 5, U.hashStr("os" + w + "_" + s.seed)); o.sp = {}; o.sok = {}; }
    o.fp = o.fp || {}; o.fok = o.fok || {};
    estado(s);                          // garante s.objT da temporada
    return o;
  }
  function grupos(s) {
    var o = objEstado(s), t = s.objT;
    return [
      { id: "d", nome: "Diários", lista: o.d.map(function (id) { return TODOS[id]; }).filter(Boolean), prog: o.dp, ok: o.dok, fim: "renova amanhã" },
      { id: "s", nome: "Semanais", lista: o.s.map(function (id) { return TODOS[id]; }).filter(Boolean), prog: o.sp, ok: o.sok, fim: "renova na virada da semana" },
      { id: "t", nome: "Temporada", lista: TEMPORADA, prog: t.prog, ok: t.ok, fim: "valem até o fim da temporada" },
      { id: "f", nome: "Fundamentos", lista: FUNDAMENTOS, prog: o.fp, ok: o.fok, fim: "uma vez só" }
    ];
  }
  // processa um evento em todos os objetivos ativos; conclusão entrega o prêmio na hora
  function processa(ev, d) {
    var s = d && d.s; if (!s) return;
    var feitos = [];
    grupos(s).forEach(function (g) {
      g.lista.forEach(function (o) {
        if (g.ok[o.id]) return;
        var soma = 0; try { soma = o.conta(ev, d) || 0; } catch (e) { soma = 0; }
        if (!soma) return;
        g.prog[o.id] = Math.min(o.n, (g.prog[o.id] || 0) + soma);
        if (g.prog[o.id] >= o.n) {
          g.ok[o.id] = 1;
          var notas = M().darRecompensa(s, o.r, "Objetivo: " + o.tx);
          feitos.push({ o: o, g: g, notas: notas });
        }
      });
    });
    I().save();
    feitos.forEach(function (f) {
      var tx = ({ d: "Objetivo diário", s: "Objetivo semanal", t: "Objetivo da temporada", f: "Fundamento" })[f.g.id] + " concluído: " + f.o.tx;
      if (ev === "partida" && d.notas) d.notas.push({ ic: "target", tx: tx + " (" + M().recTexto(f.o.r) + ")", cls: "bom" });
      else { try { TM.ui.toast(tx + " · " + M().recTexto(f.o.r), "ok"); } catch (e) {} }
    });
  }
  // XP de cada partida (qualquer modo) — vale também o Draft
  function xpDaPartida(d) {
    if (d.wo) return 30;
    return (d.venceu ? 250 : d.empate ? 150 : 100) + Math.min(4, d.gf || 0) * 30;
  }
  function liga() {
    var U = I();
    U.on("partida", function (d) {
      var xp = xpDaPartida(d);
      ganhaXp(d.s, xp, "Partida");
      d.notas.push({ ic: "star", tx: "+" + xp + " XP da temporada (nível " + nivelDe(estado(d.s).xp) + ")" });
      processa("partida", d);
    });
    ["pacote", "venda", "compra", "dme", "item", "evolucao", "divisao"].forEach(function (ev) {
      U.on(ev, function (d) {
        if (ev === "dme" && d && d.s) ganhaXp(d.s, 300, "DME");
        processa(ev, d);
      });
    });
  }

  /* ================= telas ================= */
  function barra(pct) { return el("div", { class: "utm-bar" }, [el("i", { style: "width:" + Math.max(0, Math.min(100, pct)) + "%" })]); }
  function cabecalho(s) {
    var t = estado(s), nv = nivelDe(t.xp), dentro = t.xp - nv * XP_NIVEL;
    return el("div", { class: "utm-hero temp" }, [
      el("div", { class: "utm-hero-ic" }, [ic("star")]),
      el("div", { class: "utm-hero-i" }, [
        el("div", { class: "utm-hero-k", text: tempNome(t.id).toUpperCase() + " · FALTAM " + diasRestantes() + " DIAS" }),
        el("div", { class: "utm-hero-t", text: nv >= NIVEIS ? "Nível máximo" : "Nível " + nv }),
        barra(nv >= NIVEIS ? 100 : dentro / XP_NIVEL * 100),
        el("div", { class: "utm-hero-s", text: nv >= NIVEIS ? "Você completou a temporada." : dentro + " / " + XP_NIVEL + " XP para o nível " + (nv + 1) })
      ])
    ]);
  }
  function icRec(r) {
    if (r.pick) return "user-search"; if (r.fichas) return "ticket"; if (r.packs) return "package"; if (r.itens) return "flask-conical"; return "tm-moeda";
  }
  TM.ui.register("ut-temporada", function (screen) {
    var U = I(), s = U.st(); if (!s) { U.goUT("ut"); return; }
    var t = estado(s), nv = nivelDe(t.xp);
    screen.classList.add("ut-screen");
    screen.appendChild(U.utTop("Temporada", function () { U.goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    if (s.tempAviso) { body.appendChild(el("div", { class: "utm-resgate" }, [el("div", {}, [el("b", { text: s.tempAviso })])])); s.tempAviso = null; U.save(); }
    body.appendChild(cabecalho(s));
    var pend = pendentes(s);
    if (pend) body.appendChild(TM.ui.button("Resgatar " + pend + (pend > 1 ? " prêmios" : " prêmio"), function () {
      var notas = [];
      for (var n = 1; n <= nivelDe(t.xp); n++) if (!t.pegos[n]) notas = notas.concat(resgata(s, n));
      TM.ui.toast(notas.length + (notas.length > 1 ? " prêmios resgatados" : " prêmio resgatado") + ". Pacotes e escolhas ficam na Loja.", "ok");
      U.goUT("ut-temporada");
    }, "btn primary wide"));
    body.appendChild(el("div", { class: "utm-nota-l", text: "XP vem de tudo o que você joga: partida (100 a 370), objetivos, DME e Evoluções. Abrir pacote não dá XP." }));
    var trilha = el("div", { class: "utt-trilha" });
    for (var n = 1; n <= NIVEIS; n++) {
      (function (n) {
        var r = recNivel(n), feito = n <= nv, pego = !!t.pegos[n], marco = n % 5 === 0;
        trilha.appendChild(el("button", {
          class: "utt-nivel" + (marco ? " marco" : "") + (pego ? " pego" : feito ? " pronto" : "") + (n === nv + 1 ? " prox" : ""),
          on: { click: function () {
            if (pego) { TM.ui.toast("Já resgatado: " + M().recTexto(r)); return; }
            if (!feito) { TM.ui.toast("Nível " + n + ": " + M().recTexto(r) + ". Faltam " + (n * XP_NIVEL - t.xp) + " XP."); return; }
            var notas = resgata(s, n); TM.ui.toast("Nível " + n + ": " + notas.map(function (x) { return x.tx; }).join(", "), "ok"); U.goUT("ut-temporada");
          } }
        }, [
          el("span", { class: "utt-n", text: n }),
          el("span", { class: "utt-ic" }, [ic(pego ? "check" : feito ? icRec(r) : (marco ? icRec(r) : "lock"))]),
          el("span", { class: "utt-r", text: M().recTexto(r) })
        ]));
      })(n);
    }
    body.appendChild(el("div", { class: "ut-sec-t", text: "Caminho de recompensas" }));
    body.appendChild(trilha);
    body.appendChild(TM.ui.button("Ver objetivos", function () { U.goUT("ut-obj"); }, "btn ghost wide"));
  });

  TM.ui.register("ut-obj", function (screen, params) {
    var U = I(), s = U.st(); if (!s) { U.goUT("ut"); return; }
    var gs = grupos(s), aba = (params && params.aba) || s.objAba || "d";
    screen.classList.add("ut-screen");
    screen.appendChild(U.utTop("Objetivos", function () { U.goUT("ut"); }, s));
    var tabs = el("div", { class: "ut-tabs utt-tabs" }), body = el("div", { class: "ut-body" });
    screen.appendChild(tabs); screen.appendChild(body);
    function desenha() {
      TM.ui.clear(tabs); TM.ui.clear(body);
      gs.forEach(function (g) {
        var falta = g.lista.filter(function (o) { return !g.ok[o.id]; }).length;
        tabs.appendChild(el("button", { class: "ut-tab" + (aba === g.id ? " on" : ""), text: g.nome + (falta ? " (" + falta + ")" : ""), on: { click: function () { aba = g.id; s.objAba = g.id; desenha(); } } }));
      });
      var g = gs.filter(function (x) { return x.id === aba; })[0] || gs[0];
      body.appendChild(cabecalho(s));
      var feitos = g.lista.filter(function (o) { return g.ok[o.id]; }).length;
      body.appendChild(el("div", { class: "ut-sec-t", text: g.nome + " · " + feitos + "/" + g.lista.length + " · " + g.fim }));
      g.lista.forEach(function (o) {
        var p = Math.min(o.n, g.prog[o.id] || 0), ok = !!g.ok[o.id];
        body.appendChild(el("div", { class: "utt-obj" + (ok ? " ok" : "") }, [
          el("div", { class: "utt-obj-ic" }, [ic(ok ? "circle-check" : "target")]),
          el("div", { class: "utt-obj-i" }, [
            el("div", { class: "utt-obj-t", text: o.tx }),
            barra(p / o.n * 100),
            el("div", { class: "utt-obj-s" }, [el("span", { text: p + " / " + o.n }), el("span", { class: "utt-obj-r", text: M().recTexto(o.r) })])
          ])
        ]));
      });
    }
    desenha();
  });

  liga();
  TM.utTemp = {
    estado: estado, ganhaXp: ganhaXp, nivelDe: nivelDe, pendentes: pendentes, recNivel: recNivel, tempNome: tempNome,
    diasRestantes: diasRestantes, grupos: grupos, objEstado: objEstado, XP_NIVEL: XP_NIVEL, NIVEIS: NIVEIS
  };
})(window);
