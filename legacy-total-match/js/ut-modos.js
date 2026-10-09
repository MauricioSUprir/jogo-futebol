/* ================= TOTAL ULTIMATE — MODOS DE JOGO =================
   Rivais (divisões + recompensas da semana), Batalhas de Elenco (elencos montados
   pela CPU, quatro dificuldades e ranking semanal) e Champions (eliminatórias e
   finais da semana), mais o que todos usam:
     - o executor de partida: contrato/forma do elenco, abandono conta derrota,
       pênaltis no mata-mata e o evento "partida" (XP da temporada, objetivos,
       evoluções ouvem ele e escrevem as notas do resultado);
     - os elencos CPU (11 na formação, cada um na posição, nota perto do alvo,
       vínculo de liga ou de país, escudo desenhado);
     - as recompensas (moedas, pacotes, escolha de jogador, itens, fichas, XP).
   A estrutura segue o Ultimate Team atual (Division Rivals, Squad Battles,
   Champions); nomes, números e adversários são do Total Match. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  function I() { return TM.ut._i; }
  function ic(n, cls) { return TM.ic(n, cls); }

  /* ================= recompensas ================= */
  // r = { coins, packs:[id], pick:{n,lo,hi}, itens:[{t,...}], fichas, xp }
  function darRecompensa(s, r, origem) {
    var U = I(), notas = [];
    if (!r) return notas;
    if (r.coins) { U.earn(s, r.coins, origem); notas.push({ ic: "tm-moeda", tx: "+" + U.fmtC(r.coins) + " moedas" }); }
    (r.packs || []).forEach(function (pid) {
      s.packs = s.packs || []; s.packs.push(pid);
      var pk = U.packById(pid); notas.push({ ic: "package", tx: (pk ? pk.name : "Pacote") + " (guardado na Loja)" });
    });
    if (r.pick) {
      s.picks = s.picks || [];
      s.picks.push({ id: "pk" + Date.now() % 1e8 + "_" + s.picks.length, n: r.pick.n || 3, lo: r.pick.lo, hi: r.pick.hi || 99, ver: r.pick.ver || null, o: origem || "" });
      notas.push({ ic: "user-search", tx: "Escolha de jogador " + r.pick.lo + "+" + (r.pick.ver ? " (" + U.verInfo(r.pick.ver).n + ")" : "") + " · 1 de " + (r.pick.n || 3) + " (na Loja)" });
    }
    (r.itens || []).forEach(function (it) { U.addItem(s, U.novoItem(Object.assign({}, it))); notas.push({ ic: "flask-conical", tx: U.itemNome(it) }); });
    if (r.fichas) { s.fichas = (s.fichas || 0) + r.fichas; notas.push({ ic: "ticket", tx: r.fichas + (r.fichas > 1 ? " fichas" : " ficha") + " de Draft" }); }
    // carta direta: jogador fixo ({p, v}) ou sorteado numa faixa ({lo, hi})
    if (r.carta) {
      var pl = r.carta.p ? TM.data.player(r.carta.p) : U.drawPlayer(r.carta.lo || 75, r.carta.hi || 99, Math.random);
      if (pl) {
        var cv = r.carta.v || U.sorteiaVersao(pl, Math.random, 1.2) || "rare";
        var nc = U.mkCard(pl, cv); nc.ut = 1; U.addCard(s, nc);
        var dc = U.cardData(nc);
        notas.push({ ic: "sparkles", tx: "Nova carta: " + pl.name + " (" + (dc ? dc.ov : pl.overall) + (cv !== "base" && cv !== "rare" ? " · " + U.verInfo(cv).n : "") + ")" });
        r._carta = nc;
      }
    }
    if (r.xp && TM.utTemp) { TM.utTemp.ganhaXp(s, r.xp, origem); notas.push({ ic: "star", tx: "+" + r.xp + " XP da temporada" }); }
    U.save();
    return notas;
  }
  // texto curto de uma recompensa (para as tabelas de prêmios)
  function recTexto(r) {
    var U = I(), p = [];
    if (!r) return "—";
    if (r.coins) p.push(U.fmtC(r.coins) + " moedas");
    (r.packs || []).forEach(function (pid) { var pk = U.packById(pid); p.push(pk ? pk.name : "Pacote"); });
    if (r.pick) p.push("escolha " + r.pick.lo + "+" + (r.pick.ver ? " " + U.verInfo(r.pick.ver).n : ""));
    if (r.carta) p.push(r.carta.p ? ((TM.data.player(r.carta.p) || {}).name || "jogador") + (r.carta.v ? " (" + U.verInfo(r.carta.v).n + ")" : "") : "jogador " + (r.carta.lo || 75) + "+");
    (r.itens || []).forEach(function (it) { p.push(U.itemNome(it)); });
    if (r.fichas) p.push(r.fichas + " ficha" + (r.fichas > 1 ? "s" : "") + " de Draft");
    if (r.xp) p.push(r.xp + " XP");
    return p.join(" · ") || "—";
  }

  /* ---------- escolha de jogador: 1 entre N cartas ---------- */
  function opcoesDaEscolha(s, pk) {
    if (pk.op && pk.op.length) return pk.op;
    var U = I(), rnd = Math.random, out = [], usados = {};
    for (var i = 0; i < 60 && out.length < (pk.n || 3); i++) {
      var p = U.drawPlayer(pk.lo, pk.hi, rnd);
      if (!p || usados[p.id]) continue;
      usados[p.id] = 1;
      out.push({ p: p.id, v: pk.ver || U.sorteiaVersao(p, rnd, 1.5) || "rare" });
    }
    pk.op = out; U.save();               // sorteia uma vez só: sair e voltar não troca as opções
    return out;
  }
  TM.ui.register("ut-escolha", function (screen, params) {
    var U = I(), s = U.st(); if (!s) { U.goUT("ut"); return; }
    s.picks = s.picks || [];
    var pk = s.picks.filter(function (x) { return x.id === (params || {}).id; })[0] || s.picks[0];
    screen.classList.add("ut-screen");
    screen.appendChild(U.utTop("Escolha de jogador", function () { U.goUT("ut-store"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    if (!pk) { body.appendChild(el("div", { class: "ut-empty-tx", text: "Nenhuma escolha pendente." })); return; }
    var ops = opcoesDaEscolha(s, pk), sel = -1;
    body.appendChild(el("div", { class: "utm-esc-h" }, [
      el("div", { class: "utm-esc-t", text: "Escolha 1 de " + ops.length }),
      el("div", { class: "utm-esc-s", text: "Jogadores " + pk.lo + "+" + (pk.o ? " · " + pk.o : "") + ". Os outros vão embora." })
    ]));
    var grade = el("div", { class: "utm-esc-grade" });
    var bt = el("button", { class: "btn primary wide off", text: "Escolha uma carta" });
    function pinta() {
      TM.ui.clear(grade);
      ops.forEach(function (o, i) {
        var d = U.cardData({ i: "op" + i, p: o.p, v: o.v, r: U.rarOf((TM.data.player(o.p) || {}).overall + U.verBonus(o.v)) });
        if (!d) return;
        grade.appendChild(el("div", { class: "utm-esc-op" + (sel === i ? " sel" : "") }, [
          U.cardEl(d, { cls: "big", on: function () { sel = i; pinta(); } }),
          el("div", { class: "utm-esc-nm", text: d.name })
        ]));
      });
      if (sel >= 0) { bt.classList.remove("off"); bt.textContent = "Ficar com " + U.shortNm((TM.data.player(ops[sel].p) || {}).name); }
    }
    bt.addEventListener("click", function () {
      if (sel < 0) return;
      var o = ops[sel], p = TM.data.player(o.p); if (!p) return;
      var c = U.mkCard(p, o.v); c.ut = 1;
      s.picks = s.picks.filter(function (x) { return x !== pk; });
      U.addCard(s, c); U.save();
      TM.ui.toast(p.name + " chegou ao clube!", "ok");
      U.goUT(s.picks.length ? "ut-escolha" : "ut-club", s.picks.length ? { id: s.picks[0].id } : undefined);
    });
    pinta();
    body.appendChild(grade);
    body.appendChild(bt);
  });

  /* ================= elencos montados pela CPU ================= */
  var CLUBES_A = ["Real", "Atlético", "Sporting", "Dínamo", "Racing", "União", "Inter", "Olímpico", "Estrela", "Unidos", "Ferroviário", "Esporte"];
  var CLUBES_B = ["Trovão", "Relâmpago", "Vendaval", "Furacão", "Tempestade", "Avalanche", "Ciclone", "Meteoro", "Cometa", "Fênix",
                  "Leões", "Lobos", "Falcões", "Tubarões", "Dragões", "Titãs", "Gigantes", "Guerreiros", "Corsários", "Centauros"];
  var TAGS = ["Rafa_10", "Juninho.FC", "LeoMatador", "Tiagao99", "VitinhoPro", "Duda.FC", "PH_Craque", "CaioUltimate", "Lucca7",
              "MaiconRei", "DaviBomba", "EnzoGamer", "Kaua.FC", "Bielzinho", "TheoUT", "Murilo10", "PietroChute", "IgorPedrada",
              "Arthurzao", "Nina.FC", "Bia_Gol", "Lari10", "Sofia.UT", "MaluCraque", "Gui_Vapo", "Joao.Lenda", "Mel_10", "Cadu.UT"];
  var FORMS = ["4-3-3", "4-2-3-1", "4-4-2", "4-1-2-1-2", "3-5-2", "4-1-4-1", "3-4-3", "5-3-2", "4-2-2-2"];
  var FORMAS_ESC = ["classico", "moderno", "redondo", "diamante", "hexagono", "flamula"];
  var SIMB_ESC = ["tm-bola", "star", "crown", "flame", "zap", "anchor", "swords", "trophy", "gem", "target", "rocket", "shield"];
  var CORES_ESC = ["#ef4444", "#3b82f6", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#64748b", "#d4af37", "#0ea5e9", "#f97316", "#84cc16", "#e11d48"];

  // jogadores por função (cada um entra em todas as funções que joga) — índice para montar rápido
  var _porFuncao = null;
  try { TM.storage.onEditionChange(function () { _porFuncao = null; }); } catch (e) {}
  function porFuncao() {
    if (_porFuncao) return _porFuncao;
    var U = I(), m = {};
    U.pool().forEach(function (p) {
      U.posicoesDe(p).forEach(function (r) { (m[r] = m[r] || []).push(p); });
    });
    _porFuncao = m;
    return m;
  }
  function escolhe(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }

  // time pronto para o motor a partir das cartas (nota em campo com a química e um reforço opcional)
  function timeDe(ds, per, nome, sigla, f, reforco, banco) {
    var U = I(), players = [];
    reforco = reforco || 0;
    ds.forEach(function (d, i) {
      if (!d) return;
      var p = Object.assign({}, d.p);
      p.overall = U.clamp(U.effOv(d.ov, per[i]) + reforco, 1, 99);
      p.attrs = {};
      U.statsOf(d, per[i]).forEach(function (x) { p.attrs[x.k] = U.clamp(x.v + reforco, 1, 99); });
      players.push(p);
    });
    (banco || []).forEach(function (d) { if (!d) return; var p = Object.assign({}, d.p); p.overall = U.clamp(d.ov + reforco, 1, 99); players.push(p); });
    return { id: "cpu_" + (sigla || "x"), name: nome, short: sigla, players: players, formation: f };
  }

  /* elencoCPU(semente, alvo, opções) — opções: { f, tema: "liga"|"pais"|"misto"|"totw"|"joias"|"craques",
     nome, tag, reforco (dificuldade: soma na nota em campo) } */
  function elencoCPU(seed, alvo, opt) {
    opt = opt || {};
    var U = I(), rnd = U.mulberry(seed >>> 0), idx = porFuncao(), P = U.pool();
    alvo = U.clamp(Math.round(alvo), 50, 95);
    // os sorteios saem sempre na mesma ordem (com ou sem opções): a mesma semente
    // dá o mesmo elenco na lista e na hora de jogar
    var fSort = escolhe(FORMS, rnd), r1 = rnd(), r2 = rnd();
    var nomeSort = escolhe(CLUBES_A, rnd) + " " + escolhe(CLUBES_B, rnd), tagSort = escolhe(TAGS, rnd);
    var esc = { forma: escolhe(FORMAS_ESC, rnd), simb: escolhe(SIMB_ESC, rnd) }, cor = escolhe(CORES_ESC, rnd);
    var f = opt.f || fSort;
    var F = TM.comp.FORMATIONS[f] || TM.comp.FORMATIONS["4-3-3"];
    var tema = opt.tema || (r1 < 0.45 ? "liga" : r2 < 0.55 ? "pais" : "misto");
    var totw = tema === "totw" ? U.totwSet() : null;
    var fortes = P.filter(function (p) { return p.overall >= Math.max(68, alvo - 3) && p.overall <= alvo + 4; });
    var ancora = escolhe(fortes.length ? fortes : P, rnd);
    var ref = tema === "liga" ? U.leagueOf(ancora) : tema === "pais" ? ancora.nationId : null;
    function doTema(p) {
      if (tema === "liga") return U.leagueOf(p) === ref;
      if (tema === "pais") return p.nationId === ref;
      if (tema === "totw") return !!totw[p.id];
      if (tema === "joias") return (p.age || 30) <= 22;
      return true;
    }
    var usados = {}, ds = [];
    F.forEach(function (slot) {
      var role = U.slotRole(slot), lista = idx[role] || [], achou = null;
      var faixas = [2, 3, 5, 8, 14];
      for (var fx = 0; fx < faixas.length && !achou; fx++) {
        var lim = faixas[fx], c = [];
        for (var k = 0; k < lista.length; k++) {
          var p = lista[k];
          if (usados[p.id] || Math.abs(p.overall - alvo) > lim) continue;
          if (fx < 3 && tema !== "misto" && tema !== "craques" && !doTema(p)) continue;
          c.push(p);
        }
        if (c.length) achou = escolhe(c, rnd);
      }
      if (!achou) achou = escolhe(lista.length ? lista : P, rnd);
      usados[achou.id] = 1;
      var ver = rnd() < 0.55 ? "rare" : "base";
      if (tema === "totw" && totw[achou.id]) ver = "totw";
      else if (alvo >= 78 && rnd() < (tema === "craques" ? 0.35 : 0.1)) ver = U.sorteiaVersao(achou, rnd, 6) || ver;
      ds.push(U.cardData({ i: "cpu" + seed + "_" + ds.length, p: achou.id, v: ver, r: U.rarOf(achou.overall + U.verBonus(ver)) }));
    });
    var banco = [];
    for (var b = 0; b < 5; b++) {
      var bp = U.drawPlayer(Math.max(45, alvo - 6), alvo + 1, rnd);
      if (bp && !usados[bp.id]) { usados[bp.id] = 1; banco.push(U.cardData({ i: "cpub" + b, p: bp.id, v: "base", r: U.rarOf(bp.overall) })); }
    }
    var ch = U.chemDe(ds, F);
    // elenco em destaque (Seleção da Semana, Galácticos...) joga entrosado mesmo misturando ligas
    if (opt.entrosado) { ch.per = ch.per.map(function (v, i) { return ch.emPos[i] ? Math.max(v, 2) : v; }); ch.team = ch.per.reduce(function (a, b) { return a + b; }, 0); }
    var nome = opt.nome || nomeSort;
    var sigla = opt.sigla || nome.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 3).toUpperCase();
    if (sigla.length < 3) sigla = (sigla + nome.replace(/\s+/g, "").slice(1, 4)).slice(0, 3).toUpperCase();
    var reforco = opt.reforco || 0;
    var ov = U.notaEquipe(ds.map(function (d) { return d ? d.ov : 0; }));
    return {
      seed: seed, alvo: alvo, nome: nome, tag: opt.tag || tagSort, sigla: sigla, f: f, ov: ov, chem: ch.team, ds: ds,
      esc: esc, cor: cor, tema: tema, ref: ref, reforco: reforco,
      team: (function () { var t = timeDe(ds, ch.per, nome, sigla, f, reforco, banco); t.colors = { primary: cor, secondary: "#ffffff" }; return t; })()
    };
  }
  function temaTexto(e) {
    var U = I();
    if (e.tema === "liga") return U.nomeLiga(e.ref);
    if (e.tema === "pais") return U.nomePais(e.ref);
    if (e.tema === "totw") return "Seleção da Semana";
    if (e.tema === "joias") return "Joias (até 22 anos)";
    if (e.tema === "craques") return "Só craques";
    return "Elenco misto";
  }
  // cartão de adversário: escudo, nome, dono, nota/química/formação e os 3 melhores
  function cartaoAdv(e, extra) {
    var U = I();
    var top = e.ds.filter(Boolean).slice().sort(function (a, b) { return b.ov - a.ov; }).slice(0, 3);
    return el("div", { class: "utm-adv" + (extra && extra.cls ? " " + extra.cls : "") }, [
      el("div", { class: "utm-adv-top" }, [
        U.escudoEl(e.esc, e.cor, e.sigla),
        el("div", { class: "utm-adv-i" }, [
          el("div", { class: "utm-adv-n", text: e.nome }),
          el("div", { class: "utm-adv-s", text: (extra && extra.sub) || ("de " + e.tag + " · " + temaTexto(e)) }),
          el("div", { class: "utm-adv-num" }, [
            el("span", {}, [el("b", { text: e.ov + (e.reforco ? "" : "") }), document.createTextNode(" nota")]),
            el("span", {}, [el("b", { text: e.chem }), document.createTextNode(" química")]),
            el("span", { text: e.f })
          ])
        ])
      ]),
      el("div", { class: "utm-adv-cartas" }, top.map(function (d) { return U.cardEl(d, { cls: "tiny" }); })),
      extra && extra.rodape ? extra.rodape : null
    ]);
  }

  /* ================= executor de partida ================= */
  function prontoParaJogar(s) {
    var U = I(), m = U.cardMap(s);
    var n = s.squad.xi.filter(Boolean).length;
    if (n < 11) return "Escale 11 titulares antes de jogar (faltam " + (11 - n) + ").";
    var sem = s.squad.xi.map(function (cid) { return cid && m[cid]; }).filter(function (c) { return c && !U.temContrato(c); });
    if (sem.length) return (sem.length > 1 ? sem.length + " titulares estão" : "Um titular está") + " sem contrato: aplique um contrato ou troque na Escalação.";
    return null;
  }
  /* jogar({ modo, titulo, adv: elencoCPU, time? (Draft), formacao?, voltar, dif?, mataMata?,
             onFim(res) → { titulo?, sub? } }) */
  function jogar(cfg) {
    var U = I(), s = U.st(); if (!s) return;
    if (!cfg.time) {
      var erro = prontoParaJogar(s);
      if (erro) { TM.ui.toast(erro, "alerta"); U.goUT("ut-squad"); return; }
    }
    TM.ui.go("ut-jogo", cfg);
  }
  TM.ui.register("ut-jogo", function (screen, cfg) {
    var U = I(), s = U.st();
    if (!s || !cfg || !cfg.adv) { U.goUT("ut"); return; }
    var teamA = cfg.time || U.utTeam(s), teamB = cfg.adv.team;
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: true };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    var acabou = false;
    screen.classList.add("utm-jogo");
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, settings: settings, title: cfg.titulo,
      pauseSide: 0, simOpts: simOpts, formation: cfg.formacao || s.squad.f, formationB: cfg.adv.f,
      onBack: function () {
        if (acabou) { U.goUT(cfg.voltar || "ut"); return; }
        // sair no meio conta como derrota por W.O., igual no Ultimate
        TM.ui.confirm("Abandonar a partida?", "Sair agora conta como derrota por 3 a 0.", "Abandonar", function () {
          acabou = true;
          result.score = [0, 3]; result.events = (result.events || []).filter(function (e) { return e.type !== "goal" && e.type !== "pengoal"; });
          fimDeJogo(s, cfg, teamA, teamB, result, true);
        }, true);
      },
      onDone: function () { if (acabou) return; acabou = true; fimDeJogo(s, cfg, teamA, teamB, result, false); }
    });
  });

  function fimDeJogo(s, cfg, teamA, teamB, result, wo) {
    var U = I();
    var gf = result.score[0], ga = result.score[1];
    function segue(penaltis) {
      var golsPor = {};
      (result.events || []).forEach(function (e) {
        if ((e.type === "goal" || e.type === "pengoal") && e.team === 0 && e.playerId) golsPor[e.playerId] = (golsPor[e.playerId] || 0) + 1;
      });
      var venceu = gf > ga || (penaltis === 0), perdeu = gf < ga || (penaltis === 1);
      var res = {
        s: s, modo: cfg.modo, gf: gf, ga: ga, venceu: venceu, empate: !venceu && !perdeu, perdeu: perdeu, wo: !!wo,
        penaltis: penaltis, golsPor: golsPor, xi: cfg.time ? [] : s.squad.xi.slice(), dif: cfg.dif || null,
        adv: cfg.adv, notas: [], foram: []
      };
      if (!cfg.time) res.foram = U.gastaJogo(s);      // contrato -1, forma, empréstimo -1
      s.stats.jogos = (s.stats.jogos || 0) + 1;
      var tela = (cfg.onFim && cfg.onFim(res)) || {};
      U.emit("partida", res);                          // temporada, objetivos e evoluções escrevem em res.notas
      U.save();
      TM.ui.go("ut-resultado", { res: res, tela: tela, cfg: cfg });
    }
    // mata-mata empatado: pênaltis
    if (cfg.mataMata && gf === ga && !wo && TM.engine.shootout && TM.matchview.playShootout) {
      var shoot = TM.engine.shootout(teamA, teamB);
      TM.ui.go("ut-penaltis", { teamA: teamA, teamB: teamB, shoot: shoot, title: cfg.titulo + " · pênaltis", onDone: function (w) { segue(w); } });
      return;
    }
    segue(null);
  }
  TM.ui.register("ut-penaltis", function (screen, p) {
    if (!p || !p.shoot) { I().goUT("ut"); return; }
    screen.classList.add("ut-screen");
    TM.matchview.playShootout(screen, p);
  });

  /* ---------- tela de resultado: placar, prêmios e o que andou ---------- */
  TM.ui.register("ut-resultado", function (screen, p) {
    var U = I(), s = U.st();
    if (!s || !p || !p.res) { U.goUT("ut"); return; }
    var res = p.res, tela = p.tela || {}, cfg = p.cfg || {};
    screen.classList.add("ut-screen", "utm-res-screen");
    screen.appendChild(U.utTop(cfg.titulo || "Resultado", function () { U.goUT(cfg.voltar || "ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    var cls = res.venceu ? "v" : res.perdeu ? "d" : "e";
    var txt = res.wo ? "DERROTA POR W.O." : res.venceu ? "VITÓRIA" : res.perdeu ? "DERROTA" : "EMPATE";
    if (res.penaltis != null) txt += res.venceu ? " NOS PÊNALTIS" : " NOS PÊNALTIS";
    body.appendChild(el("div", { class: "utm-res " + cls }, [
      el("div", { class: "utm-res-tx", text: txt }),
      el("div", { class: "utm-res-placar" }, [
        el("div", { class: "utm-res-time" }, [U.escudoDe(s), el("span", { text: U.nomeExibido(s) })]),
        el("div", { class: "utm-res-gols", text: res.gf + " × " + res.ga }),
        el("div", { class: "utm-res-time" }, [U.escudoEl(res.adv.esc, res.adv.cor, res.adv.sigla), el("span", { text: res.adv.nome })])
      ]),
      tela.sub ? el("div", { class: "utm-res-sub", text: tela.sub }) : null
    ]));
    var gols = Object.keys(res.golsPor || {});
    if (gols.length) {
      body.appendChild(el("div", { class: "utm-res-gols-l" }, gols.map(function (pid) {
        var pl = TM.data.player(pid); return el("span", {}, [ic("tm-bola"), document.createTextNode(" " + (pl ? U.shortNm(pl.name) : "Gol") + (res.golsPor[pid] > 1 ? " ×" + res.golsPor[pid] : ""))]);
      })));
    }
    var notas = (tela.notas || []).concat(res.notas || []);
    if ((res.foram || []).length) notas.push({ ic: "handshake", tx: "Empréstimo encerrado: " + res.foram.map(function (c) { var pl = TM.data.player(c.p); return pl ? U.shortNm(pl.name) : "jogador"; }).join(", ") });
    if (notas.length) {
      body.appendChild(el("div", { class: "ut-sec-t", text: "Nesta partida" }));
      body.appendChild(el("div", { class: "utm-notas" }, notas.map(function (n) {
        return el("div", { class: "utm-nota" + (n.cls ? " " + n.cls : "") }, [el("span", { class: "utm-nota-ic" }, [ic(n.ic || "check")]), el("span", { text: n.tx })]);
      })));
    }
    body.appendChild(TM.ui.button(tela.botao || "Continuar", function () { U.goUT(tela.voltar || cfg.voltar || "ut"); }, "btn primary wide"));
  });

  /* ================= RIVAIS: divisões + recompensas da semana ================= */
  var RIV_MARCOS = [2, 4, 7];      // vitórias na semana que liberam prêmio (a de 4 classifica para a Champions)
  function rivSemana(s) {
    var w = I().weekOf();
    s.riv.sem = s.riv.sem && s.riv.sem.w === w ? s.riv.sem : { w: w, v: 0, j: 0, ok: {} };
    return s.riv.sem;
  }
  function rivPremio(div, marco) {
    var k = 10 - div;                    // 0 (Div 10) .. 9 (Div 1)
    if (marco === 2) return { coins: 1200 + k * 450, packs: [div <= 5 ? "ouro" : "prata"], xp: 300 };
    if (marco === 4) return { coins: 2500 + k * 900, packs: [div <= 3 ? "ourorare" : div <= 7 ? "ouro" : "prata"], xp: 500 };
    return { coins: 5000 + k * 1600, packs: [div <= 2 ? "jumbo" : div <= 5 ? "ourorare" : "ouro"], pick: div <= 4 ? { n: 3, lo: div <= 2 ? 84 : 82 } : null, xp: 800 };
  }
  function rivAdv(s) {
    var U = I(), info = U.divInfo(s.riv.div), sem = rivSemana(s);
    var seed = U.hashStr("riv" + s.seed + "_" + sem.w + "_" + (s.riv.pl || 0));
    var e = elencoCPU(seed, info.ov + ((seed % 5) - 2));
    return e;
  }
  TM.ui.register("ut-rivals", function (screen) {
    var U = I(), s = U.st(); if (!s) { U.goUT("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(U.utTop("Rivais", function () { U.goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    var info = U.divInfo(s.riv.div), sem = rivSemana(s), r = U.squadRating(s);
    var pct = info.need === 999 ? 100 : U.clamp(Math.round(s.riv.pts / info.need * 100), 0, 100);
    // faixa da divisão
    body.appendChild(el("div", { class: "utm-hero riv" }, [
      el("div", { class: "utm-hero-ic" }, [ic("trophy")]),
      el("div", { class: "utm-hero-i" }, [
        el("div", { class: "utm-hero-k", text: "DIVISION RIVALS · TOTAL MATCH" }),
        el("div", { class: "utm-hero-t", text: "Divisão " + s.riv.div }),
        el("div", { class: "utm-bar" }, [el("i", { style: "width:" + pct + "%" })]),
        el("div", { class: "utm-hero-s", text: s.riv.div > 1 ? (s.riv.pts + " de " + info.need + " pontos para subir · vitória +3, empate +1") : (s.riv.pts + " pontos · divisão máxima") })
      ])
    ]));
    // escada de divisões
    var escada = el("div", { class: "utm-escada" });
    U.DIVS.forEach(function (d) {
      escada.appendChild(el("span", { class: "utm-degrau" + (d.d === s.riv.div ? " on" : d.d > s.riv.div ? " feito" : ""), text: d.d }));
    });
    body.appendChild(escada);
    // semana
    body.appendChild(el("div", { class: "ut-sec-t", text: "Recompensas da semana · " + sem.v + (sem.v === 1 ? " vitória" : " vitórias") }));
    var marcos = el("div", { class: "utm-marcos" });
    RIV_MARCOS.forEach(function (m) {
      var pr = rivPremio(s.riv.div, m), feito = sem.v >= m, pego = !!sem.ok[m];
      marcos.appendChild(el("div", { class: "utm-marco" + (pego ? " pego" : feito ? " pronto" : "") }, [
        el("div", { class: "utm-marco-n" }, [el("b", { text: m }), el("span", { text: "vitórias" })]),
        el("div", { class: "utm-marco-r", text: recTexto(pr) + (m === 4 ? " · vaga na Champions" : "") }),
        pego ? el("span", { class: "utm-marco-ok" }, [ic("check")]) : feito ? el("button", { class: "ut-buy", text: "Resgatar", on: { click: function () {
          sem.ok[m] = 1; var notas = darRecompensa(s, pr, "Rivais · " + m + " vitórias");
          TM.ui.toast("Recompensa resgatada: " + notas.map(function (n) { return n.tx; }).join(", "), "ok");
          U.goUT("ut-rivals");
        } } }) : el("span", { class: "utm-marco-f", text: sem.v + "/" + m })
      ]));
    });
    body.appendChild(marcos);
    // elenco e adversário
    body.appendChild(el("div", { class: "ut-sq-mini" }, [
      el("div", { class: "ut-sq-mini-i" }, [el("b", { text: r.ov || "—" }), el("i", { text: "NOTA" })]),
      el("div", { class: "ut-sq-mini-i" }, [el("b", { text: r.chem + "/33" }), el("i", { text: "QUÍMICA" })]),
      el("button", { class: "btn ghost small", text: "Editar elenco", on: { click: function () { U.goUT("ut-squad"); } } })
    ]));
    var erro = prontoParaJogar(s);
    if (erro) {
      body.appendChild(el("div", { class: "ut-warn", text: erro }));
      body.appendChild(TM.ui.button("Montar automaticamente", function () { U.autoFill(s); U.goUT("ut-rivals"); }, "btn primary wide"));
      return;
    }
    var adv = rivAdv(s);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Próximo rival" }));
    body.appendChild(cartaoAdv(adv, { sub: "de " + adv.tag + " · Divisão " + s.riv.div + " · " + temaTexto(adv) }));
    body.appendChild(el("div", { class: "utm-nota-l", text: "Vitória: " + U.fmtC(info.win) + " moedas · Empate: " + U.fmtC(Math.round(info.win * 0.4)) + " · Derrota: " + U.fmtC(Math.round(info.win * 0.18)) }));
    body.appendChild(TM.ui.button("Jogar partida", function () {
      jogar({
        modo: "riv", titulo: "Rivais · Divisão " + s.riv.div, adv: adv, voltar: "ut-rivals",
        onFim: function (res) { return fimRivais(s, res); }
      });
    }, "btn primary wide"));
  });
  function fimRivais(s, res) {
    var U = I(), info = U.divInfo(s.riv.div), sem = rivSemana(s), notas = [];
    s.riv.pl++; sem.j++;
    var ganho;
    if (res.venceu) { s.riv.w++; s.riv.pts += 3; sem.v++; ganho = info.win; notas.push({ ic: "trending-up", tx: "+3 pontos na Divisão " + s.riv.div }); }
    else if (res.empate) { s.riv.d++; s.riv.pts += 1; ganho = Math.round(info.win * 0.4); notas.push({ ic: "minus", tx: "+1 ponto na Divisão " + s.riv.div }); }
    else { s.riv.l++; ganho = Math.round(info.win * 0.18); }
    U.earn(s, ganho, "Rivais"); notas.unshift({ ic: "tm-moeda", tx: "+" + U.fmtC(ganho) + " moedas" });
    if (res.venceu && RIV_MARCOS.indexOf(sem.v) >= 0) notas.push({ ic: "gift", tx: "Recompensa de " + sem.v + " vitórias liberada: resgate em Rivais", cls: "bom" });
    if (res.venceu && sem.v === 4) notas.push({ ic: "trophy", tx: "Classificado para a Champions desta semana!", cls: "bom" });
    var sub = null;
    if (s.riv.div > 1 && s.riv.pts >= info.need) {
      s.riv.div--; s.riv.pts = 0;
      if (s.riv.div < (s.riv.best || 10)) s.riv.best = s.riv.div;
      var pk = s.riv.div <= 2 ? "mega" : s.riv.div <= 4 ? "jumbo" : s.riv.div <= 7 ? "ourorare" : "ouro";
      darRecompensa(s, { packs: [pk] }, "Acesso à Divisão " + s.riv.div);
      notas.push({ ic: "trophy", tx: "SUBIU para a Divisão " + s.riv.div + "! " + (U.packById(pk) || {}).name + " guardado na Loja", cls: "bom" });
      sub = "Acesso para a Divisão " + s.riv.div + "!";
      U.emit("divisao", { s: s, div: s.riv.div });
    }
    return { notas: notas, sub: sub };
  }

  /* ================= BATALHAS DE ELENCO ================= */
  var DIFS = [
    { id: "amador", n: "Amador",          ref: -6, mult: 1.0 },
    { id: "pro",    n: "Profissional",    ref: -2, mult: 1.6 },
    { id: "mundial",n: "Craque Mundial",  ref: 2,  mult: 2.3 },
    { id: "lenda",  n: "Lendário",        ref: 5,  mult: 3.2 }
  ];
  var BAT_RANKS = [
    { n: "Elite 1",  min: 4400, r: { coins: 32000, packs: ["mega"], pick: { n: 3, lo: 84 }, xp: 2000 } },
    { n: "Elite 2",  min: 3500, r: { coins: 24000, packs: ["jumbo"], pick: { n: 3, lo: 83 }, xp: 1600 } },
    { n: "Ouro 1",   min: 2800, r: { coins: 16000, packs: ["jumbo"], xp: 1300 } },
    { n: "Ouro 2",   min: 2200, r: { coins: 12000, packs: ["ourorare"], xp: 1100 } },
    { n: "Ouro 3",   min: 1700, r: { coins: 9000, packs: ["ourorare"], xp: 900 } },
    { n: "Prata 1",  min: 1250, r: { coins: 6500, packs: ["ouro"], xp: 700 } },
    { n: "Prata 2",  min: 900,  r: { coins: 5000, packs: ["ouro"], xp: 550 } },
    { n: "Prata 3",  min: 600,  r: { coins: 3500, packs: ["prata"], xp: 450 } },
    { n: "Bronze 1", min: 350,  r: { coins: 2400, packs: ["prata"], xp: 350 } },
    { n: "Bronze 2", min: 160,  r: { coins: 1500, packs: ["bronze"], xp: 250 } },
    { n: "Bronze 3", min: 1,    r: { coins: 900, xp: 150 } }
  ];
  function rankDe(pts) { for (var i = 0; i < BAT_RANKS.length; i++) if (pts >= BAT_RANKS[i].min) return BAT_RANKS[i]; return null; }
  function posicaoRanking(pts) { return Math.max(1, Math.round(60000 * Math.exp(-pts / 820))); }
  function batEstado(s) {
    var U = I(), w = U.weekOf();
    if (!s.bat || s.bat.w !== w) {
      // semana nova: guarda o resultado da anterior para resgatar
      if (s.bat && s.bat.pts > 0 && !s.bat.pago) s.batAntiga = { w: s.bat.w, pts: s.bat.pts };
      s.bat = { w: w, pts: 0, j: 0, feitos: {}, dia: {} };
      U.save();
    }
    return s.bat;
  }
  // 8 elencos da semana (fixos) + 1 elenco em destaque por dia (+50% de pontos)
  function batLista(s) {
    var U = I(), b = batEstado(s), base = U.squadRating(s).ov || 70;
    var degraus = [-4, -2, 0, 1, 2, 3, 5, 7];
    var lista = degraus.map(function (dg, i) {
      return { k: "w" + i, e: elencoCPU(U.hashStr("bat" + s.seed + "_" + b.w + "_" + i), U.clamp(base + dg, 58, 90)) };
    });
    var temas = ["totw", "craques", "joias", "liga", "pais", "totw", "craques"];
    var dia = U.today(), tema = temas[dia % temas.length];
    var dest = elencoCPU(U.hashStr("batd" + dia), U.clamp(base + 3, 64, 90), { tema: tema, entrosado: true, nome: tema === "totw" ? "Seleção da Semana" : tema === "craques" ? "Galácticos TM" : tema === "joias" ? "Joias do Futuro" : null, tag: "Total Match" });
    lista.unshift({ k: "d" + dia, e: dest, destaque: true });
    return lista;
  }
  function batPontos(res, dif, destaque) {
    var base = res.venceu ? 100 : res.empate ? 45 : 15;
    base += Math.min(4, res.gf) * 10 + (res.ga === 0 ? 20 : 0);
    if (res.wo) base = 0;
    return Math.round(base * dif.mult * (destaque ? 1.5 : 1));
  }
  TM.ui.register("ut-batalhas", function (screen) {
    var U = I(), s = U.st(); if (!s) { U.goUT("ut"); return; }
    var b = batEstado(s);
    screen.classList.add("ut-screen");
    screen.appendChild(U.utTop("Batalhas de Elenco", function () { U.goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    // prêmio da semana passada
    if (s.batAntiga) {
      var ra = rankDe(s.batAntiga.pts);
      body.appendChild(el("div", { class: "utm-resgate" }, [
        el("div", {}, [el("b", { text: "Semana passada: " + (ra ? ra.n : "sem rank") }), el("span", { text: s.batAntiga.pts + " pontos" })]),
        el("button", { class: "ut-buy", text: "Resgatar", on: { click: function () {
          var notas = ra ? darRecompensa(s, ra.r, "Batalhas · " + ra.n) : [];
          s.batAntiga = null; U.save();
          TM.ui.toast(notas.length ? "Recompensa: " + notas.map(function (n) { return n.tx; }).join(", ") : "Sem recompensa nessa semana.", "ok");
          U.goUT("ut-batalhas");
        } } })
      ]));
    }
    var rk = rankDe(b.pts), prox = BAT_RANKS.slice().reverse().filter(function (x) { return x.min > b.pts; })[0];
    body.appendChild(el("div", { class: "utm-hero bat" }, [
      el("div", { class: "utm-hero-ic" }, [ic("swords")]),
      el("div", { class: "utm-hero-i" }, [
        el("div", { class: "utm-hero-k", text: "SQUAD BATTLES · SEMANA " + (b.w % 52 + 1) }),
        el("div", { class: "utm-hero-t", text: rk ? rk.n : "Sem rank ainda" }),
        el("div", { class: "utm-bar" }, [el("i", { style: "width:" + (prox ? U.clamp(Math.round(b.pts / prox.min * 100), 2, 100) : 100) + "%" })]),
        el("div", { class: "utm-hero-s", text: b.pts + " pontos · posição ~#" + U.fmtC(posicaoRanking(b.pts)) + (prox ? " · " + (prox.min - b.pts) + " para " + prox.n : " · topo da semana") })
      ])
    ]));
    // dificuldade
    var difSel = s.batDif || "pro";
    var difs = el("div", { class: "utm-difs" });
    function pintaDifs() {
      TM.ui.clear(difs);
      DIFS.forEach(function (d) {
        difs.appendChild(el("button", { class: "utm-dif" + (difSel === d.id ? " on" : ""), on: { click: function () { difSel = d.id; s.batDif = d.id; U.save(); pintaDifs(); } } }, [
          el("b", { text: d.n }), el("span", { text: "×" + String(d.mult).replace(".", ",") + " pontos" })
        ]));
      });
    }
    pintaDifs();
    body.appendChild(el("div", { class: "ut-sec-t", text: "Dificuldade" }));
    body.appendChild(difs);
    body.appendChild(el("div", { class: "utm-nota-l", text: "Pontos: vitória 100 · empate 45 · derrota 15 · +10 por gol (até 4) · +20 sem sofrer gol, vezes a dificuldade. Cada elenco vale uma vez por semana; o destaque do dia vale +50%." }));
    var erro = prontoParaJogar(s);
    if (erro) { body.appendChild(el("div", { class: "ut-warn", text: erro })); return; }
    body.appendChild(el("div", { class: "ut-sec-t", text: "Adversários da semana" }));
    batLista(s).forEach(function (o) {
      var feito = o.destaque ? b.dia[o.k] : b.feitos[o.k];
      var rod = feito
        ? el("div", { class: "utm-adv-feito" }, [ic("check"), document.createTextNode(" " + feito.r + " · " + feito.p + " pontos")])
        : el("button", { class: "btn primary small", text: "Jogar", on: { click: function () {
            var dif = DIFS.filter(function (d) { return d.id === difSel; })[0] || DIFS[1];
            var e = elencoCPU(o.e.seed, o.e.alvo, { tema: o.e.tema, nome: o.e.nome, tag: o.e.tag, reforco: dif.ref, f: o.e.f, entrosado: !!o.destaque });
            jogar({
              modo: "batalha", titulo: "Batalhas · " + dif.n, adv: e, voltar: "ut-batalhas", dif: dif.id,
              onFim: function (res) {
                var pts = batPontos(res, dif, o.destaque);
                b.pts += pts; b.j++;
                var reg = { r: res.gf + "×" + res.ga + " (" + dif.n + ")", p: pts };
                if (o.destaque) b.dia[o.k] = reg; else b.feitos[o.k] = reg;
                var moedas = res.venceu ? Math.round(400 * dif.mult) : res.empate ? Math.round(150 * dif.mult) : 60;
                U.earn(s, moedas, "Batalhas");
                var novo = rankDe(b.pts);
                return { notas: [{ ic: "tm-moeda", tx: "+" + U.fmtC(moedas) + " moedas" }, { ic: "swords", tx: "+" + pts + " pontos nas Batalhas (" + b.pts + " na semana" + (novo ? " · " + novo.n : "") + ")" }] };
              }
            });
          } } });
      body.appendChild(cartaoAdv(o.e, { cls: o.destaque ? "destaque" : "", sub: (o.destaque ? "ELENCO EM DESTAQUE · +50% · " : "de " + o.e.tag + " · ") + temaTexto(o.e), rodape: rod }));
    });
    body.appendChild(el("div", { class: "ut-sec-t", text: "Recompensas da semana (no fim da semana)" }));
    body.appendChild(el("div", { class: "utm-tabela" }, BAT_RANKS.map(function (x) {
      return el("div", { class: "utm-tab-l" + (rk === x ? " on" : "") }, [el("b", { text: x.n }), el("span", { class: "utm-tab-p", text: x.min + "+" }), el("span", { text: recTexto(x.r) })]);
    })));
  });

  /* ================= CHAMPIONS (eliminatórias + finais da semana) ================= */
  var CH_ELIM = 5, CH_ELIM_VAGA = 3, CH_FINAIS = 10;
  var CH_PREMIOS = [      // por vitórias nas finais
    { v: 10, n: "Rank 1", r: { coins: 50000, packs: ["mega", "mega"], pick: { n: 3, lo: 86 }, xp: 3000 } },
    { v: 8,  n: "Rank 2", r: { coins: 32000, packs: ["mega"], pick: { n: 3, lo: 84 }, xp: 2200 } },
    { v: 6,  n: "Rank 3", r: { coins: 20000, packs: ["jumbo"], pick: { n: 3, lo: 83 }, xp: 1700 } },
    { v: 4,  n: "Rank 4", r: { coins: 12000, packs: ["jumbo"], xp: 1300 } },
    { v: 2,  n: "Rank 5", r: { coins: 6500, packs: ["ourorare"], xp: 900 } },
    { v: 0,  n: "Rank 6", r: { coins: 3000, packs: ["ouro"], xp: 500 } }
  ];
  var CH_ELIM_PREMIO = [{ coins: 500 }, { coins: 1000 }, { coins: 2000 }, { coins: 4000, packs: ["prata"] }, { coins: 6000, packs: ["ouro"] }, { coins: 9000, packs: ["ourorare"] }];
  function chEstado(s) {
    var U = I(), w = U.weekOf();
    if (!s.champ || s.champ.w !== w) {
      if (s.champ && s.champ.fase === "finais" && !s.champ.pago) s.champAntiga = { w: s.champ.w, v: s.champ.fv };
      s.champ = { w: w, fase: "qual", ej: [], fj: [], fv: 0, ev: 0 };
      U.save();
    }
    var sem = rivSemana(s);
    if (s.champ.fase === "qual" && sem.v >= 4) { s.champ.fase = "elim"; U.save(); }
    return s.champ;
  }
  function chPremio(v) { for (var i = 0; i < CH_PREMIOS.length; i++) if (v >= CH_PREMIOS[i].v) return CH_PREMIOS[i]; return CH_PREMIOS[CH_PREMIOS.length - 1]; }
  function chAdv(s, c) {
    // a Champions é forte, mas acompanha o seu elenco (mais vitórias, adversário mais duro)
    var U = I(), base = Math.max(74, U.squadRating(s).ov || 72);
    var jogos = c.fase === "elim" ? c.ej.length : CH_ELIM + c.fj.length;
    var vit = c.fase === "elim" ? c.ev : c.fv;
    return elencoCPU(U.hashStr("ch" + s.seed + "_" + c.w + "_" + jogos), U.clamp(base + vit * 0.5 + (c.fase === "finais" ? 1 : 0), 72, 92));
  }
  TM.ui.register("ut-champions", function (screen) {
    var U = I(), s = U.st(); if (!s) { U.goUT("ut"); return; }
    var c = chEstado(s), sem = rivSemana(s);
    screen.classList.add("ut-screen");
    screen.appendChild(U.utTop("Champions", function () { U.goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    if (s.champAntiga) {
      var pa = chPremio(s.champAntiga.v);
      body.appendChild(el("div", { class: "utm-resgate" }, [
        el("div", {}, [el("b", { text: "Finais da semana passada: " + pa.n }), el("span", { text: s.champAntiga.v + " vitórias" })]),
        el("button", { class: "ut-buy", text: "Resgatar", on: { click: function () {
          var notas = darRecompensa(s, pa.r, "Champions · " + pa.n); s.champAntiga = null; U.save();
          TM.ui.toast("Recompensa: " + notas.map(function (n) { return n.tx; }).join(", "), "ok"); U.goUT("ut-champions");
        } } })
      ]));
    }
    var fases = [["qual", "Classificação"], ["elim", "Eliminatórias"], ["finais", "Finais"]];
    var idxF = c.fase === "qual" ? 0 : c.fase === "elim" ? 1 : 2;
    body.appendChild(el("div", { class: "utm-hero champ" }, [
      el("div", { class: "utm-hero-ic" }, [ic("crown")]),
      el("div", { class: "utm-hero-i" }, [
        el("div", { class: "utm-hero-k", text: "TOTAL CHAMPIONS · SEMANA " + (c.w % 52 + 1) }),
        el("div", { class: "utm-hero-t", text: c.fase === "qual" ? "Classificação" : c.fase === "elim" ? "Eliminatórias" : c.fase === "fimelim" ? "Eliminado" : "Finais" }),
        el("div", { class: "utm-fases" }, fases.map(function (f, i) { return el("span", { class: i < idxF ? "feito" : i === idxF ? "on" : "", text: f[1] }); }))
      ])
    ]));
    if (c.fase === "qual") {
      body.appendChild(el("div", { class: "utm-caixa" }, [
        el("b", { text: "Vença 4 partidas nos Rivais nesta semana" }),
        el("div", { class: "utm-bar" }, [el("i", { style: "width:" + U.clamp(Math.round(sem.v / 4 * 100), 0, 100) + "%" })]),
        el("span", { text: sem.v + " de 4 vitórias. Depois vêm as Eliminatórias (" + CH_ELIM + " jogos, " + CH_ELIM_VAGA + " vitórias dão a vaga) e as Finais (" + CH_FINAIS + " jogos)." })
      ]));
      body.appendChild(TM.ui.button("Ir para os Rivais", function () { U.goUT("ut-rivals"); }, "btn primary wide"));
    } else if (c.fase === "elim" || c.fase === "finais") {
      var lista = c.fase === "elim" ? c.ej : c.fj, total = c.fase === "elim" ? CH_ELIM : CH_FINAIS;
      body.appendChild(el("div", { class: "utm-jogos" }, Array.apply(null, Array(total)).map(function (_, i) {
        var j = lista[i];
        return el("span", { class: "utm-jg" + (j ? " " + j.c : i === lista.length ? " prox" : ""), text: j ? j.p : String(i + 1) });
      })));
      var vit = c.fase === "elim" ? c.ev : c.fv;
      body.appendChild(el("div", { class: "utm-nota-l", text: c.fase === "elim"
        ? vit + " vitórias de " + CH_ELIM_VAGA + " para a vaga nas Finais · " + (CH_ELIM - lista.length) + " jogos restantes"
        : vit + " vitórias · " + (CH_FINAIS - lista.length) + " jogos restantes · prêmio atual: " + chPremio(vit).n + " (" + recTexto(chPremio(vit).r) + ")" }));
      var erro = prontoParaJogar(s);
      if (erro) { body.appendChild(el("div", { class: "ut-warn", text: erro })); }
      else {
        var adv = chAdv(s, c);
        body.appendChild(el("div", { class: "ut-sec-t", text: "Próximo adversário" }));
        body.appendChild(cartaoAdv(adv));
        body.appendChild(TM.ui.button(c.fase === "elim" ? "Jogar eliminatória " + (lista.length + 1) : "Jogar final " + (lista.length + 1), function () {
          jogar({
            modo: "champions", titulo: "Champions · " + (c.fase === "elim" ? "Eliminatórias" : "Finais"), adv: adv, voltar: "ut-champions",
            onFim: function (res) { return fimChampions(s, res); }
          });
        }, "btn primary wide"));
      }
    } else if (c.fase === "fimelim") {
      body.appendChild(el("div", { class: "utm-caixa" }, [el("b", { text: "Não deu desta vez." }), el("span", { text: "Você fez " + c.ev + " vitórias nas Eliminatórias. A Champions volta na semana que vem." })]));
    } else if (c.fase === "fim") {
      var pf = chPremio(c.fv);
      body.appendChild(el("div", { class: "utm-caixa" }, [el("b", { text: "Finais encerradas: " + pf.n }), el("span", { text: c.fv + " vitórias em " + CH_FINAIS + " jogos. Prêmio: " + recTexto(pf.r) })]));
      if (!c.pago) body.appendChild(TM.ui.button("Resgatar prêmio das Finais", function () {
        var notas = darRecompensa(s, pf.r, "Champions · " + pf.n); c.pago = 1; U.save();
        TM.ui.toast("Recompensa: " + notas.map(function (n) { return n.tx; }).join(", "), "ok"); U.goUT("ut-champions");
      }, "btn primary wide"));
    }
    body.appendChild(el("div", { class: "ut-sec-t", text: "Prêmios das Finais" }));
    body.appendChild(el("div", { class: "utm-tabela" }, CH_PREMIOS.map(function (x) {
      return el("div", { class: "utm-tab-l" + ((c.fase === "finais" || c.fase === "fim") && chPremio(c.fv) === x ? " on" : "") }, [el("b", { text: x.n }), el("span", { class: "utm-tab-p", text: x.v + "+ V" }), el("span", { text: recTexto(x.r) })]);
    })));
  });
  function fimChampions(s, res) {
    var U = I(), c = chEstado(s), notas = [], sub = null;
    var marca = { c: res.venceu ? "v" : res.empate ? "e" : "d", p: res.gf + "×" + res.ga };
    var moedas = res.venceu ? 1500 : res.empate ? 600 : 300;
    U.earn(s, moedas, "Champions"); notas.push({ ic: "tm-moeda", tx: "+" + U.fmtC(moedas) + " moedas" });
    if (c.fase === "elim") {
      c.ej.push(marca); if (res.venceu) c.ev++;
      if (c.ev >= CH_ELIM_VAGA) {
        c.fase = "finais"; sub = "Classificado para as Finais!";
        notas.push({ ic: "trophy", tx: "Vaga nas Finais da Champions!", cls: "bom" });
        notas = notas.concat(darRecompensa(s, CH_ELIM_PREMIO[c.ev], "Eliminatórias"));
      } else if (c.ej.length >= CH_ELIM || (CH_ELIM - c.ej.length) < (CH_ELIM_VAGA - c.ev)) {
        c.fase = "fimelim"; sub = "Fim das Eliminatórias";
        notas = notas.concat(darRecompensa(s, CH_ELIM_PREMIO[c.ev], "Eliminatórias"));
      }
    } else if (c.fase === "finais") {
      c.fj.push(marca); if (res.venceu) c.fv++;
      notas.push({ ic: "crown", tx: "Finais: " + c.fv + " vitórias em " + c.fj.length + " jogos (" + chPremio(c.fv).n + ")" });
      if (c.fj.length >= CH_FINAIS) { c.fase = "fim"; sub = "Finais encerradas: " + chPremio(c.fv).n; }
    }
    U.save();
    return { notas: notas, sub: sub };
  }

  /* ================= API ================= */
  TM.utModos = {
    jogar: jogar, prontoParaJogar: prontoParaJogar, elencoCPU: elencoCPU, timeDe: timeDe, cartaoAdv: cartaoAdv,
    darRecompensa: darRecompensa, recTexto: recTexto, temaTexto: temaTexto,
    rivSemana: rivSemana, batEstado: batEstado, chEstado: chEstado, rankDe: rankDe, chPremio: chPremio,
    DIFS: DIFS, BAT_RANKS: BAT_RANKS, CH_PREMIOS: CH_PREMIOS
  };
})(window);
