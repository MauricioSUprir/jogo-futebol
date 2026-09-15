/* ================= TOTAL MATCH — Observação de alvos =================
   No mercado você não enxerga tudo de cara. Para abrir a ficha completa
   de um jogador é preciso mandar observá-lo, e isso leva dias: craque de
   liga grande todo mundo já conhece; desconhecido de liga distante dá
   trabalho. A informação vai aparecendo aos poucos. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function save(c) { TM.storage.saveCoachCareer(c); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function money(c, v) { return C().fmtMoney(c, v); }
  function curVal(c, eur) { return Math.round(eur * mult(c) * 100) / 100; }

  var MAX_OBS = 3;          // olheiros trabalhando ao mesmo tempo

  function ensure(c) {
    if (!c) return null;
    if (!c.obs) c.obs = {};
    return c.obs;
  }
  function leagueOf(p) {
    try {
      var cl = p.clubId && p.clubId !== "free" ? TM.data.club(p.clubId) : null;
      return cl ? (cl.homeLeagueId || cl.leagueId) : null;
    } catch (e) { return null; }
  }
  function regionOf(lg) {
    try { return TM.scouting && TM.scouting.regionOfLeague ? TM.scouting.regionOfLeague(lg) : "eu2"; } catch (e) { return "eu2"; }
  }
  // 0 = joga na sua liga · 1 = do outro lado do mundo
  function distance(c, p) {
    var mine = c.leagueId, his = leagueOf(p);
    if (!his) return 0.55;                       // sem clube: informação espalhada
    if (his === mine) return 0;
    var rm = regionOf(mine), rh = regionOf(his);
    if (rm === rh) return 0.28;
    // grupos vizinhos (Brasil ↔ América do Sul, Europa ↔ Europa 2, etc.)
    var VIZ = { br: ["sa"], sa: ["br"], eu: ["eu2"], eu2: ["eu"], na: ["sa"], asia: [], af: ["eu2"] };
    if ((VIZ[rm] || []).indexOf(rh) >= 0) return 0.55;
    // as cinco grandes da Europa passam na TV do mundo inteiro: sempre dá para acompanhar
    if (rh === "eu") return 0.5;
    return 1;
  }
  // 0 = ninguém sabe quem é · 1 = todo mundo conhece
  function fame(c, p) {
    var ov = p.overall || 60;
    var f = clamp((ov - 62) / 26, 0, 1) * 0.6;                 // nota
    try {
      var v = TM.data.marketValue(p);
      f += clamp(v / 60, 0, 1) * 0.25;                          // valor de mercado
    } catch (e) {}
    try {
      if (p.clubId && p.clubId !== "free") f += clamp((TM.data.clubRating(p.clubId) - 68) / 20, 0, 1) * 0.15;
    } catch (e) {}
    return clamp(f, 0, 1);
  }
  // quantos dias o olheiro leva
  function daysFor(c, p) {
    var d = distance(c, p), f = fame(c, p);
    return clamp(Math.round(4 + 15 * d - 7 * f), 3, 22);
  }
  function why(c, p) {
    var d = distance(c, p), f = fame(c, p), out = [];
    var his = leagueOf(p);
    out.push(d === 0 ? "joga na sua liga"
      : d <= 0.3 ? "joga numa liga vizinha"
      : (regionOf(his) === "eu") ? "joga numa liga grande, que passa em todo lugar"
      : d <= 0.6 ? "joga em outro continente"
      : "joga numa liga pouco vista por aqui");
    out.push(f >= 0.7 ? "é muito conhecido" : f >= 0.45 ? "tem alguma fama" : f >= 0.22 ? "é pouco conhecido" : "é um desconhecido");
    return out.join(" e ");
  }

  function running(c) {
    ensure(c);
    var n = 0;
    Object.keys(c.obs).forEach(function (k) { if (!c.obs[k].done) n++; });
    return n;
  }
  function stateOf(c, pid) {
    ensure(c);
    var j = c.obs[pid];
    if (!j) return { st: "none", pct: 0, left: 0 };
    if (j.done) return { st: "done", pct: 1, left: 0 };
    var passados = (c.currentDay || 0) - j.start;
    var pct = clamp(passados / Math.max(1, j.days), 0, 1);
    return { st: "run", pct: pct, left: Math.max(0, j.days - passados), days: j.days };
  }
  function start(c, p) {
    ensure(c);
    if (c.obs[p.id]) return { ok: false, msg: "Esse jogador já está sendo observado." };
    if (running(c) >= MAX_OBS) return { ok: false, msg: "Seus olheiros já estão em " + MAX_OBS + " observações. Espere uma terminar." };
    var d = daysFor(c, p);
    c.obs[p.id] = { start: c.currentDay || 0, days: d, done: false, name: p.name };
    save(c);
    TM.notify.push(c, { icon: "🔭", title: "Observação iniciada", text: "Um olheiro foi acompanhar " + p.name + ". Relatório completo em " + d + " dia(s)." });
    return { ok: true, days: d };
  }
  function cancel(c, pid) {
    ensure(c);
    if (c.obs[pid] && !c.obs[pid].done) { delete c.obs[pid]; save(c); return true; }
    return false;
  }
  // chamado quando o dia avança
  function tick(c) {
    if (!c || !c.obs) return;
    var mudou = false;
    Object.keys(c.obs).forEach(function (pid) {
      var j = c.obs[pid];
      if (j.done) return;
      if ((c.currentDay || 0) - j.start >= j.days) {
        j.done = true; j.doneDay = c.currentDay || 0; mudou = true;
        c.scouted = c.scouted || {}; c.scouted[pid] = true;      // potencial deixa de ser oculto
        var p = null; try { p = TM.data.player(pid); } catch (e) {}
        TM.notify.push(c, { icon: "📄", title: "Relatório pronto", text: "O olheiro fechou o relatório de " + (j.name || (p && p.name) || "um alvo") + ". A ficha completa já está no Mercado." });
      }
    });
    if (mudou) save(c);
  }

  /* ---------- faixas aproximadas enquanto a observação não termina ---------- */
  function band(v, larg) {
    var lo = Math.max(1, Math.round(v - larg)), hi = Math.round(v + larg);
    return lo + "–" + hi;
  }
  // o quanto ainda está borrado: 1 = nada se sabe, 0 = tudo aberto
  function fogOf(c, p) {
    var s = stateOf(c, p.id);
    if (s.st === "done") return 0;
    if (s.st === "none") return 1;
    return 1 - s.pct;
  }

  /* ================= tela: ficha do alvo ================= */
  var backTo = "coach-market";
  TM.ui.register("coach-target", function (screen, params) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach-hub"); return; }
    ensure(c);
    var pid = (params && params.pid) || null;
    if (params && params.back) backTo = params.back;
    var p = pid ? (C().resolvePlayer(c, pid) || TM.data.player(pid)) : null;
    if (!p) { TM.ui.go(backTo); return; }
    var s = stateOf(c, p.id), fog = fogOf(c, p);
    var aberto = s.st === "done";
    var lg = leagueOf(p), lgNome = "";
    try { var L = lg ? TM.data.league(lg) : null; lgNome = L ? L.name : "sem clube"; } catch (e) {}
    var clube = (p.clubId && p.clubId !== "free") ? TM.data.club(p.clubId) : null;

    screen.appendChild(TM.ui.topbar(aberto ? "📄 Relatório do olheiro" : "🔭 Alvo de mercado", function () { TM.ui.go(backTo); }));
    var wrap = el("div", { class: "obs-wrap" });
    screen.appendChild(wrap);

    // cabeçalho: isso qualquer um vê de fora
    wrap.appendChild(el("div", { class: "obs-head" }, [
      (function () { try { return TM.img.playerImg(p, "obs-face" + (aberto ? "" : " blur")); } catch (e) { return el("span"); } })(),
      el("div", { class: "obs-id" }, [
        el("div", { class: "obs-name", text: p.name }),
        el("div", { class: "obs-meta" }, [
          el("span", { class: "prof-pos pos-" + (p.pos || "MF"), text: TM.data.posLabel(p) }),
          el("span", { text: p.age + " anos" }),
          el("span", { text: p.nationName || "" })
        ]),
        el("div", { class: "obs-club" }, [
          (function () { try { return clube ? TM.img.clubImg(clube, "obs-crest") : el("span"); } catch (e) { return el("span"); } })(),
          el("span", { text: (clube ? clube.name : "Sem clube") + " · " + lgNome })
        ])
      ])
    ]));

    // nota: aberta, faixa, ou desconhecida
    var ovBox;
    if (aberto) {
      ovBox = el("div", { class: "obs-ov open" }, [ el("b", { text: p.overall }), el("i", { text: "OVERALL" }) ]);
    } else if (fog <= 0.6) {
      ovBox = el("div", { class: "obs-ov part" }, [ el("b", { text: band(p.overall, Math.round(2 + fog * 6)) }), el("i", { text: "NOTA ESTIMADA" }) ]);
    } else {
      ovBox = el("div", { class: "obs-ov none" }, [ el("b", { text: "?" }), el("i", { text: "SEM RELATÓRIO" }) ]);
    }
    var pot = p.potential || p.overall;
    var potBox = aberto
      ? el("div", { class: "obs-ov open" }, [ el("b", { text: pot }), el("i", { text: "POTENCIAL" }) ])
      : el("div", { class: "obs-ov none" }, [ el("b", { text: "?" }), el("i", { text: "POTENCIAL" }) ]);
    wrap.appendChild(el("div", { class: "obs-gauges" }, [ ovBox, potBox ]));

    // valor: sempre em faixa até fechar o relatório
    var dyn = TM.data.marketValue(p); try { dyn = C().dynValue(c, p); } catch (e) {}
    var vl = curVal(c, dyn);
    wrap.appendChild(el("div", { class: "obs-line" }, [
      el("span", { text: "Valor de mercado" }),
      el("b", { text: aberto ? money(c, vl) : (money(c, Math.round(vl * (1 - 0.35 * fog) * 100) / 100) + " – " + money(c, Math.round(vl * (1 + 0.45 * fog) * 100) / 100)) })
    ]));

    // atributos: só a partir da metade da observação
    if (fog <= 0.5) {
      var A = p.attrs || {};
      var LBL = p.pos === "GK"
        ? { pac: "Velocidade", sho: "Chute", pas: "Manejo", dri: "Posicionamento", def: "Elasticidade", phy: "Reflexos" }
        : { pac: "Ritmo", sho: "Finalização", pas: "Passe", dri: "Drible", def: "Defesa", phy: "Físico" };
      var bars = el("div", { class: "obs-attrs" });
      ["pac", "sho", "pas", "dri", "def", "phy"].forEach(function (k) {
        var v = A[k] || 50;
        bars.appendChild(el("div", { class: "obs-attr" }, [
          el("i", { text: LBL[k] }),
          el("div", { class: "obs-bar" }, [ el("div", { class: "obs-bar-f", style: "width:" + clamp(v, 0, 99) + "%" }) ]),
          el("b", { text: aberto ? String(v) : band(v, Math.round(3 + fog * 8)) })
        ]));
      });
      wrap.appendChild(el("h3", { class: "section-title", text: aberto ? "Atributos" : "Atributos (estimativa)" }));
      wrap.appendChild(bars);
    }

    // contrato e salário: só com o relatório fechado
    if (aberto) {
      var endTxt = "—";
      try { if (TM.fin && TM.fin.contractInfo) { var ci = TM.fin.contractInfo(p, c); if (ci && ci.label) endTxt = ci.label; } } catch (e) {}
      var wage = curVal(c, Math.max(0.05, TM.data.marketValue(p) * 0.15));
      wrap.appendChild(el("h3", { class: "section-title", text: "Situação" }));
      wrap.appendChild(el("div", { class: "obs-line" }, [ el("span", { text: "Salário estimado" }), el("b", { text: money(c, wage) + " / temporada" }) ]));
      wrap.appendChild(el("div", { class: "obs-line" }, [ el("span", { text: "Contrato" }), el("b", { text: endTxt }) ]));
      wrap.appendChild(el("div", { class: "obs-line" }, [ el("span", { text: "Pé / altura" }), el("b", { text: (p.height ? p.height + " cm" : "—") }) ]));
      var j = c.obs[p.id];
      if (j) wrap.appendChild(el("div", { class: "obs-note", text: "Relatório fechado em " + (j.days) + " dia(s) de observação." }));
    }

    // ação: observar / andamento / negociar
    if (s.st === "none") {
      var d = daysFor(c, p);
      wrap.appendChild(el("div", { class: "obs-cta" }, [
        el("div", { class: "obs-cta-t", text: "🔭 Mandar observar" }),
        el("div", { class: "obs-cta-s", text: "Leva cerca de " + d + " dia(s): ele " + why(c, p) + "." }),
        el("div", { class: "obs-cta-s dim", text: "Olheiros em campo: " + running(c) + " de " + MAX_OBS + "." }),
        TM.ui.button("Observar por " + d + " dia(s)", function () {
          var r = start(c, p);
          if (!r.ok) { TM.ui.toast(r.msg); return; }
          TM.ui.toast("🔭 Olheiro a caminho — relatório em " + r.days + " dia(s)");
          TM.ui.go("coach-target", { pid: p.id, back: backTo });
        }, "btn primary wide")
      ]));
    } else if (s.st === "run") {
      wrap.appendChild(el("div", { class: "obs-cta run" }, [
        el("div", { class: "obs-cta-t", text: "🔭 Observação em andamento" }),
        el("div", { class: "obs-prog" }, [ el("div", { class: "obs-prog-f", style: "width:" + Math.round(s.pct * 100) + "%" }) ]),
        el("div", { class: "obs-cta-s", text: s.left > 0 ? "Faltam " + s.left + " dia(s) para o relatório completo." : "O relatório sai no próximo dia." }),
        el("div", { class: "obs-cta-s dim", text: "A ficha vai abrindo conforme o olheiro acompanha os jogos." }),
        TM.ui.button("Cancelar observação", function () {
          TM.ui.confirm("Cancelar?", "O olheiro volta e você perde o que já foi levantado sobre " + p.name + ".", "Cancelar observação", function () {
            cancel(c, p.id); TM.ui.go("coach-target", { pid: p.id, back: backTo });
          }, true);
        }, "btn ghost wide")
      ]));
    }

    // negociar sempre é possível — só que no escuro
    var neg = el("div", { class: "actions" }, [
      TM.ui.button(aberto ? "🤝 Negociar" : "🤝 Negociar mesmo assim", function () {
        if (p.freeAgent || !p.clubId || p.clubId === "free") TM.ui.go("coach-nego-player", { pid: p.id });
        else TM.ui.go("coach-nego-club", { pid: p.id });
      }, "btn" + (aberto ? " primary" : "")),
      TM.ui.button("Voltar ao mercado", function () { TM.ui.go(backTo); }, "btn ghost")
    ]);
    wrap.appendChild(neg);
    if (!aberto) wrap.appendChild(el("div", { class: "obs-note", text: "Dá para contratar sem relatório, mas você assume o risco: nota, potencial e contrato seguem no escuro." }));
  });

  TM.obs = {
    ensure: ensure, tick: tick, start: start, cancel: cancel, stateOf: stateOf,
    daysFor: daysFor, fame: fame, distance: distance, why: why, running: running,
    isOpen: function (c, pid) { return stateOf(c, pid).st === "done"; }, MAX_OBS: MAX_OBS
  };
})(window);
