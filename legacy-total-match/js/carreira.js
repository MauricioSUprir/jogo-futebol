/* ================= TOTAL MATCH — Carreira do treinador =================
   Quem te procura depende do SEU currículo, não do elenco que você tinha.
   E assumir um clube passa a ser uma conversa: o dirigente apresenta o
   projeto, faz perguntas, e você negocia salário, contrato, verba e poder
   de decisão. Eles podem recusar e podem desistir. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function save(c) { TM.storage.saveCoachCareer(c); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function money(c, v) { return C().fmtMoney(c, v); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rating(id) { try { return TM.data.clubRating(id); } catch (e) { return 70; } }
  function phash(s) { s = String(s || ""); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ================= nível do treinador ================= */
  // peso de cada título no currículo
  function honourWeight(h) {
    if (!h) return 0;
    var w = 0;
    if (h.contChampion) w += 26;      // continental vale muito
    if (h.leagueChampion) w += 14;
    if (h.cupChampion) w += 8;
    if (h.leaguePos === 2) w += 5;
    else if (h.leaguePos === 3) w += 3;
    return w;
  }
  // 0..100 — o que o mercado enxerga em você
  function coachLevel(c) {
    if (!c) return 0;
    var lv = 0;
    (c.honours || []).forEach(function (h) { lv += honourWeight(h); });
    var cs = c.careerStats || { p: 0, w: 0 };
    if (cs.p >= 20) lv += clamp((cs.w / cs.p - 0.38) * 90, -14, 22);   // aproveitamento de carreira
    lv += clamp(((c.season || 1) - 1) * 2.2, 0, 16);                    // tempo de estrada
    // o tamanho dos clubes por onde passou conta como bagagem
    var maior = 0;
    (c.clubHistory || []).forEach(function (h) { var r = rating(h.clubId); if (r > maior) maior = r; });
    var atual = rating(c.teamId); if (atual > maior) maior = atual;
    lv += clamp((maior - 70) * 1.1, 0, 16);
    lv -= (c.sackCount || 0) * 6;                                        // demissões pesam
    if (c.unemployed) lv -= 6;                                           // sem clube, o mercado esfria
    lv += (c.repBias || 0);
    return clamp(Math.round(lv), 0, 100);
  }
  function levelLabel(lv) {
    return lv >= 85 ? "Treinador de elite mundial" : lv >= 68 ? "Nome respeitado na Europa"
      : lv >= 50 ? "Treinador consolidado" : lv >= 32 ? "Nome em ascensão"
      : lv >= 16 ? "Treinador em começo de carreira" : "Praticamente desconhecido";
  }
  // exigência de cada patamar de clube
  function tierOf(r) { return r >= 83 ? "elite" : r >= 78 ? "grande" : r >= 72 ? "medio" : "pequeno"; }
  var TIER_MIN = { elite: 72, grande: 55, medio: 32, pequeno: 0 };
  var TIER_LBL = { elite: "gigante", grande: "grande clube", medio: "clube de meio de tabela", pequeno: "clube pequeno" };
  // credencial: gigante não contrata quem nunca ganhou nada relevante
  function hasCredential(c, tier) {
    var hs = c.honours || [];
    if (tier === "elite") return hs.some(function (h) { return h.contChampion || h.leagueChampion; });
    if (tier === "grande") return hs.some(function (h) { return h.contChampion || h.leagueChampion || h.cupChampion || h.leaguePos <= 3; });
    return true;
  }
  function regionOfLeague(lg) {
    try { return TM.scouting && TM.scouting.regionOfLeague ? TM.scouting.regionOfLeague(lg) : "eu2"; } catch (e) { return "eu2"; }
  }
  // um clube te consideraria?
  function wouldHire(c, clubId) {
    var r = rating(clubId), tier = tierOf(r), lv = coachLevel(c);
    var cl = null; try { cl = TM.data.club(clubId); } catch (e) {}
    // 1) região: mudar de continente exige nome, e isso vale para qualquer porte
    var minha = regionOfLeague(c.leagueId), dele = cl ? regionOfLeague(cl.leagueId) : minha;
    if (minha !== dele && lv < TIER_MIN[tier] + 14) return { ok: false, motivo: "eles preferem alguém que já trabalhe na região" };
    // 2) porte: clube do mesmo tamanho (ou menor) do que você já dirigiu dispensa currículo
    var jaDirigiu = r <= biggestManaged(c) + 1;
    if (!jaDirigiu) {
      if (lv < TIER_MIN[tier]) return { ok: false, motivo: "currículo abaixo do que um " + TIER_LBL[tier] + " procura" };
      if (!hasCredential(c, tier)) return { ok: false, motivo: "falta um título de peso no currículo" };
    } else if (tier === "elite" || tier === "grande") {
      // gigante sempre cobra credencial, mesmo que você já tenha dirigido um
      if (!hasCredential(c, tier)) return { ok: false, motivo: "falta um título de peso no currículo" };
    }
    return { ok: true, lv: lv, tier: tier };
  }

  // maior clube que você já dirigiu (a bagagem não some numa demissão)
  function biggestManaged(c) {
    var m = 0;
    (c.clubHistory || []).forEach(function (h) { var r = rating(h.clubId); if (r > m) m = r; });
    var a = rating(c.teamId); if (a > m) m = a;
    return m;
  }
  // faixa de clube que combina com o seu momento: nível da carreira, mas nunca
  // abaixo de um degrau do maior clube por onde passou
  function targetRating(c) {
    var porNivel = 60 + coachLevel(c) * 0.30;      // nível 0 → 60 · nível 100 → 90
    var porBagagem = biggestManaged(c) - 6;         // caiu de um clube 70? volta na casa dos 64+
    return Math.max(porNivel, porBagagem);
  }

  /* ================= geração das propostas ================= */
  function generate(career) {
    if (!career.jobOffers) career.jobOffers = [];
    var matchNo = career.matchNo || 0;
    var unemployed = !!career.unemployed;
    career.jobOffers = career.jobOffers.filter(function (o) { return unemployed || (matchNo - (o.matchNo || 0)) <= 6; });
    var throttle = unemployed ? 0 : 3;
    if (!unemployed && (matchNo - (career._lastOfferGen || 0)) < throttle) return;
    var st = career.stats || { p: 0, w: 0 };
    var winRate = st.p >= 3 ? st.w / st.p : 0.4;
    var chance = unemployed ? 0.75 : (winRate > 0.6 ? 0.45 : winRate > 0.45 ? 0.24 : 0.09);
    if (Math.random() > chance) { career._lastOfferGen = matchNo; return; }
    if (career.jobOffers.length >= 4) { career._lastOfferGen = matchNo; return; }

    var alvo = targetRating(career), lv = coachLevel(career);
    var W = TM.data.world();
    var open = {}; career.jobOffers.forEach(function (o) { open[o.clubId] = true; });
    // 7% das vezes um clube acima do seu patamar arrisca em você — raro, mas acontece
    var surpresa = Math.random() < 0.07;
    var teto = alvo + (surpresa ? 10 : 4);
    var pool = W.clubs.filter(function (cl) {
      if (cl.id === career.teamId || open[cl.id]) return false;
      var r = rating(cl.id);
      if (r > teto || r < alvo - 11) return false;        // a faixa sai do SEU nível, não do elenco que você tinha
      if (surpresa && r > alvo + 4) {
        // no tiro de sorte, só o porte manda — a região ainda pesa
        var cl2 = null; try { cl2 = TM.data.club(cl.id); } catch (e) {}
        var mr = regionOfLeague(career.leagueId), dr = cl2 ? regionOfLeague(cl2.leagueId) : mr;
        return mr === dr || lv >= 45;
      }
      return wouldHire(career, cl.id).ok;
    });
    if (!pool.length) { career._lastOfferGen = matchNo; return; }
    // entre os elegíveis, os maiores aparecem mais — mas sem garantia
    pool.sort(function (a, b) { return rating(b.id) - rating(a.id); });
    var cl = pool[Math.floor(Math.pow(Math.random(), 1.6) * Math.min(pool.length, 8))] || pool[0];
    var r = rating(cl.id), lg = null; try { lg = TM.data.league(cl.leagueId); } catch (e) {}
    var descs = [
      "vê em você o perfil ideal para o projeto",
      "acaba de demitir o treinador e quer você no comando",
      "prepara uma reformulação e sonha com o seu trabalho",
      "tem ambições grandes e quer você para liderar o elenco"
    ];
    var base = 0; try { base = C().baseBudgetEur(r); } catch (e) { base = (r - 55) * 3; }
    career.jobOffers.unshift({
      id: "job-" + cl.id + "-" + matchNo + "-" + Math.floor(Math.random() * 999),
      clubId: cl.id, clubName: cl.name, leagueName: lg ? lg.name : "",
      rating: r, tier: tierOf(r), desc: (r > alvo + 4 ? "apostou alto e quer conversar com você mesmo fora do radar" : pick(descs)),
      surpresa: r > alvo + 4,
      wage: r2(Math.max(0.3, (r - 55) * 0.35) * mult(career)),
      matchNo: matchNo, season: career.season, seen: false, lv: lv
    });
    career._lastOfferGen = matchNo;
  }

  /* ================= a conversa com o clube ================= */
  var TALK = null;   // { offerId, step, interest, terms, ask, history, dir }

  // dirigente que te recebe: usa o técnico real do clube como rosto quando dá
  function directorOf(clubId) {
    var cl = null; try { cl = TM.data.club(clubId); } catch (e) {}
    var NOMES = ["Rui Costa", "Alexandre Mattos", "Marcos Braz", "Fernando Hierro", "Txiki Begiristain",
      "Andrea Berta", "Luís Campos", "Paulo Bracks", "Diego Cerri", "Juan Arnau"];
    var CARGOS = ["Diretor de futebol", "Presidente", "Vice de futebol", "Diretor executivo"];
    var h = phash("dir:" + clubId);
    return { nome: NOMES[h % NOMES.length], cargo: CARGOS[(h >> 3) % CARGOS.length], club: cl };
  }
  function projectOf(o) {
    var h = phash("proj:" + o.clubId + o.season);
    var P = [
      { t: "Reconstrução", d: "Elenco envelhecido, precisamos renovar com calma. Paciência no primeiro ano." , obj: "ficar no meio da tabela", pac: 2 },
      { t: "Briga por título", d: "O elenco está pronto. Queremos disputar o título já nesta temporada.", obj: "terminar no G4", pac: 0 },
      { t: "Voltar à elite", d: "Caímos e o clube inteiro cobra o acesso. Não tem outro objetivo.", obj: "conseguir o acesso", pac: 0 },
      { t: "Formar e vender", d: "A base é forte. Queremos garotos jogando e valorizando.", obj: "dar minutos aos jovens e não cair", pac: 2 },
      { t: "Estabilidade", d: "Vínhamos de trocas demais. Buscamos um trabalho longo.", obj: "terminar acima do meio da tabela", pac: 3 }
    ];
    return P[h % P.length];
  }
  // perguntas da entrevista — o que você responde muda o interesse deles
  function questions(o) {
    var h = phash("q:" + o.clubId + o.season), all = [
      { q: "Como o senhor quer que o time jogue aqui?",
        a: [ { t: "“Time agressivo, pressão alta, protagonismo.”", i: 8 },
             { t: "“Primeiro solidez, depois o resto.”", i: 4 },
             { t: "“Vou decidir depois de ver os treinos.”", i: -4 } ] },
      { q: "Temos um ídolo em fim de carreira. O que faria com ele?",
        a: [ { t: "“Respeito o que ele fez, mas quem joga é quem está bem.”", i: 6 },
             { t: "“Ele é titular. Ídolo se trata com respeito.”", i: 2 },
             { t: "“Ele sai. Preciso de espaço para renovar.”", i: -6 } ] },
      { q: "Se a temporada começar mal, o que o senhor faz?",
        a: [ { t: "“Assumo a responsabilidade e mudo o que for preciso.”", i: 8 },
             { t: "“Peço tempo. Todo trabalho leva tempo.”", i: 1 },
             { t: "“Aí é problema do elenco que me deram.”", i: -12 } ] },
      { q: "Por que o senhor, e não outro treinador?",
        a: [ { t: "“Pelo meu trabalho. Olhem o que já construí.”", i: 6 },
             { t: "“Porque eu entendo o momento do clube.”", i: 7 },
             { t: "“Vocês que me procuraram.”", i: -8 } ] }
    ];
    return [all[h % all.length], all[(h + 1) % all.length], all[(h + 2) % all.length]];
  }

  function startTalk(c, o) {
    var proj = projectOf(o);
    TALK = {
      offerId: o.id, clubId: o.clubId, step: "intro", interest: 50 + Math.round((coachLevel(c) - TIER_MIN[o.tier || "medio"]) * 0.35),
      proj: proj, dir: directorOf(o.clubId), qs: questions(o), qi: 0,
      base: { wage: o.wage, years: 3, budget: 1, power: false },
      ask: { wage: o.wage, years: 3, budget: 1, power: false },
      hist: [], rounds: 0, over: false
    };
    TALK.interest = clamp(TALK.interest, 20, 92);
    TALK.base.budget = 1; TALK.ask.budget = 1;
    return TALK;
  }
  function say(who, text, tone) { if (TALK) TALK.hist.push({ who: who, text: text, tone: tone || "" }); }

  // avalia o que você pediu
  function evaluate(c, o) {
    var t = TALK; if (!t) return null;
    t.rounds++;
    var custo = 0;
    var dw = (t.ask.wage - t.base.wage) / Math.max(0.1, t.base.wage);
    if (dw > 0) custo += dw * 55;                                  // salário acima do previsto
    if (t.ask.years > t.base.years) custo += (t.ask.years - t.base.years) * 9;
    if (t.ask.budget > 1) custo += (t.ask.budget - 1) * 42;        // verba extra
    if (t.ask.power) custo += 16;                                   // palavra final nas contratações
    var margem = t.interest - 45;
    if (custo <= margem) {
      say("them", "“Fechado. " + termosTxt(c, t.ask) + " Bem-vindo ao " + o.clubName + ".”", "happy");
      t.step = "done"; t.acordo = JSON.parse(JSON.stringify(t.ask));
      return { st: "aceita" };
    }
    if (custo <= margem + 30 && t.rounds <= 3) {
      // contraproposta: eles cedem no meio
      var meio = {
        wage: r2((t.ask.wage + t.base.wage) / 2),
        years: Math.min(t.ask.years, t.base.years + 1),
        budget: t.ask.budget > 1 ? r2((t.ask.budget + 1) / 2) : 1,
        power: t.ask.power && custo - 16 <= margem
      };
      t.base = meio; t.ask = JSON.parse(JSON.stringify(meio));
      t.interest -= 6;
      say("them", "“Nesse patamar não dá. Nossa proposta é: " + termosTxt(c, meio) + " É o que conseguimos fazer.”", "angry");
      return { st: "contra" };
    }
    t.interest -= 18;
    if (t.interest <= 22 || t.rounds >= 4) {
      say("them", "“Assim não vamos nos entender. Vamos procurar outro nome.”", "angry");
      t.step = "over"; t.over = true;
      return { st: "desistiu" };
    }
    say("them", "“Muito acima do que planejamos. Repense o pedido.”", "angry");
    return { st: "recusada" };
  }
  function termosTxt(c, t) {
    var p = [money(c, t.wage) + " por temporada", t.years + " temporada(s)"];
    if (t.budget > 1) p.push("verba " + Math.round((t.budget - 1) * 100) + "% acima do previsto");
    if (t.power) p.push("palavra final nas contratações");
    return p.join(", ") + ".";
  }
  // fecha o acordo: troca de clube e grava o contrato combinado
  function sign(c, o) {
    var t = TALK, acordo = (t && t.acordo) || { wage: o.wage, years: 3, budget: 1, power: false };
    C().switchUserClub(c, o.clubId);
    c.myContract = {
      years: acordo.years, wage: r2(acordo.wage), fine: r2(acordo.wage * 1.5),
      objective: (t && t.proj ? "Projeto: " + t.proj.t + " — " + t.proj.obj : (c.objective && c.objective.desc) || ""),
      signedSeason: c.season || 1, power: !!acordo.power
    };
    if (acordo.budget > 1) c.budget = r2((c.budget || 0) * acordo.budget);
    c.jobOffers = [];
    c.unemployed = false;
    TM.notify.push(c, { icon: "🤝", title: "Novo clube", news: true,
      text: "Você acertou com o " + o.clubName + ": " + termosTxt(c, acordo) + (t && t.proj ? " O projeto apresentado foi “" + t.proj.t + "”." : "") });
    save(c);
    TALK = null;
  }

  /* ================= tela da conversa ================= */
  TM.ui.register("coach-job-talk", function (screen, params) {
    var c = TM.storage.coachCareer();
    if (!c) { TM.ui.go("coach-hub"); return; }
    var oid = (params && params.id) || (TALK && TALK.offerId);
    var o = (c.jobOffers || []).filter(function (x) { return x.id === oid; })[0];
    if (!o) { TM.ui.go("coach-offers"); return; }
    if (!TALK || TALK.offerId !== o.id) startTalk(c, o);
    var t = TALK, cl = TM.data.club(o.clubId);

    screen.appendChild(TM.ui.topbar("Conversa com o " + o.clubName, function () { TALK = null; TM.ui.go("coach-offers"); }));
    var wrap = el("div", { class: "job-wrap" });
    screen.appendChild(wrap);

    // quem te recebe + o clube
    wrap.appendChild(el("div", { class: "job-head" }, [
      (function () { try { return cl ? TM.img.clubImg(cl, "job-crest") : el("span"); } catch (e) { return el("span"); } })(),
      el("div", { class: "job-id" }, [
        el("div", { class: "job-club", text: o.clubName }),
        el("div", { class: "job-lg", text: o.leagueName + " · força " + o.rating + " · " + TIER_LBL[o.tier || "medio"] }),
        el("div", { class: "job-dir", text: t.dir.cargo + ": " + t.dir.nome })
      ]),
      el("div", { class: "job-int" }, [ el("b", { text: Math.round(t.interest) + "%" }), el("i", { text: "INTERESSE" }) ])
    ]));

    // o projeto
    wrap.appendChild(el("div", { class: "job-proj" }, [
      el("div", { class: "job-proj-t", text: "📋 " + t.proj.t }),
      el("div", { class: "job-proj-d", text: "“" + t.proj.d + "”" }),
      el("div", { class: "job-proj-o", text: "Meta combinada: " + t.proj.obj + " · paciência da diretoria: " + ["baixíssima", "baixa", "média", "alta"][clamp(t.proj.pac, 0, 3)] })
    ]));

    // conversa
    if (t.hist.length) {
      var ch = el("div", { class: "job-chat" });
      t.hist.forEach(function (m) { ch.appendChild(el("div", { class: "job-msg " + m.who + (m.tone ? " " + m.tone : ""), text: m.text })); });
      wrap.appendChild(ch);
    }

    if (t.step === "over") {
      wrap.appendChild(el("div", { class: "job-over", text: "A conversa acabou. O " + o.clubName + " procurou outro treinador." }));
      wrap.appendChild(TM.ui.button("Voltar", function () {
        c.jobOffers = (c.jobOffers || []).filter(function (x) { return x.id !== o.id; });
        save(c); TALK = null; TM.ui.go("coach-offers");
      }, "btn wide"));
      return;
    }
    if (t.step === "done") {
      wrap.appendChild(el("div", { class: "job-deal" }, [
        el("div", { class: "job-deal-t", text: "🤝 Acordo fechado" }),
        el("div", { class: "job-deal-s", text: termosTxt(c, t.acordo) })
      ]));
      wrap.appendChild(TM.ui.button("Assinar com o " + o.clubName, function () {
        sign(c, o);
        TM.ui.toast("🤝 Você é o novo treinador do " + o.clubName + "!");
        TM.ui.go("coach-hub");
      }, "btn primary wide"));
      wrap.appendChild(TM.ui.button("Pensar melhor", function () { TALK = null; TM.ui.go("coach-offers"); }, "btn ghost wide"));
      return;
    }

    // entrevista antes de falar de dinheiro
    if (t.step === "intro") {
      var q = t.qs[t.qi];
      wrap.appendChild(el("div", { class: "job-q" }, [
        el("div", { class: "job-q-n", text: "Entrevista · pergunta " + (t.qi + 1) + " de " + t.qs.length }),
        el("div", { class: "job-q-t", text: "“" + q.q + "”" })
      ]));
      q.a.forEach(function (a) {
        wrap.appendChild(el("button", { class: "job-a", text: a.t, on: { click: function () {
          say("me", a.t);
          t.interest = clamp(t.interest + a.i, 0, 100);
          say("them", a.i >= 6 ? "“É exatamente o que queríamos ouvir.”" : a.i >= 1 ? "“Entendido.”" : "“Hum. Anotado.”", a.i >= 6 ? "happy" : a.i < 0 ? "angry" : "");
          t.qi++;
          if (t.qi >= t.qs.length) {
            t.step = "terms";
            if (t.interest < 30) {
              say("them", "“Para ser franco, a conversa não nos convenceu. Vamos seguir com outro nome.”", "angry");
              t.step = "over";
            } else {
              say("them", "“Então vamos ao que interessa. Nossa proposta: " + termosTxt(c, t.base) + "”");
            }
          }
          save(c); TM.ui.go("coach-job-talk", { id: o.id });
        } } }));
      });
      return;
    }

    // negociação dos termos
    var wageMax = r2(t.base.wage * 2.4), stepW = wageMax >= 10 ? 0.5 : 0.1;
    var wv = el("span", { class: "range-val", text: money(c, t.ask.wage) });
    var ws = el("input", { type: "range", class: "slider", min: r2(t.base.wage * 0.8), max: wageMax, step: stepW, value: t.ask.wage });
    ws.addEventListener("input", function () { t.ask.wage = r2(parseFloat(ws.value)); wv.textContent = money(c, t.ask.wage); });
    var yv = el("span", { class: "range-val", text: t.ask.years + " temporada(s)" });
    var ys = el("input", { type: "range", class: "slider", min: 1, max: 5, step: 1, value: t.ask.years });
    ys.addEventListener("input", function () { t.ask.years = parseInt(ys.value, 10); yv.textContent = t.ask.years + " temporada(s)"; });
    var bv = el("span", { class: "range-val", text: t.ask.budget > 1 ? "+" + Math.round((t.ask.budget - 1) * 100) + "%" : "o previsto" });
    var bs = el("input", { type: "range", class: "slider", min: 1, max: 2, step: 0.1, value: t.ask.budget });
    bs.addEventListener("input", function () { t.ask.budget = Math.round(parseFloat(bs.value) * 10) / 10; bv.textContent = t.ask.budget > 1 ? "+" + Math.round((t.ask.budget - 1) * 100) + "%" : "o previsto"; });
    var pw = el("button", { class: "switch" + (t.ask.power ? " on" : ""), on: { click: function () { t.ask.power = !t.ask.power; pw.classList.toggle("on", t.ask.power); } } }, [ el("span", { class: "switch-knob" }) ]);

    wrap.appendChild(el("div", { class: "job-terms" }, [
      el("div", { class: "job-terms-t", text: "O que você pede" }),
      el("div", { class: "nego-field" }, [ el("label", { text: "Salário por temporada" }), el("div", { class: "range-wrap" }, [ ws, wv ]) ]),
      el("div", { class: "nego-field" }, [ el("label", { text: "Duração do contrato" }), el("div", { class: "range-wrap" }, [ ys, yv ]) ]),
      el("div", { class: "nego-field" }, [ el("label", { text: "Verba para contratações" }), el("div", { class: "range-wrap" }, [ bs, bv ]) ]),
      el("div", { class: "setting row" }, [ el("div", { class: "setting-label", text: "🖊️ Palavra final nas contratações" }), pw ]),
      el("div", { class: "setting-hint", text: "Quanto mais você pede, mais gasta o interesse deles. Insistir demais faz o clube procurar outro nome." })
    ]));

    wrap.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("📤 Apresentar pedido", function () {
        say("me", "Quero " + termosTxt(c, t.ask));
        var r = evaluate(c, o);
        save(c);
        if (r.st === "desistiu") TM.ui.toast("O " + o.clubName + " desistiu.");
        TM.ui.go("coach-job-talk", { id: o.id });
      }, "btn primary"),
      TM.ui.button("✅ Aceitar como está", function () {
        t.acordo = JSON.parse(JSON.stringify(t.base)); t.step = "done";
        say("me", "Aceito os termos."); say("them", "“Ótimo. Bem-vindo.”", "happy");
        save(c); TM.ui.go("coach-job-talk", { id: o.id });
      }, "btn"),
      TM.ui.button("Sair da conversa", function () { TALK = null; TM.ui.go("coach-offers"); }, "btn ghost")
    ]));
  });

  TM.job = {
    coachLevel: coachLevel, levelLabel: levelLabel, tierOf: tierOf, TIER_LBL: TIER_LBL,
    wouldHire: wouldHire, targetRating: targetRating, generate: generate, biggestManaged: biggestManaged,
    startTalk: startTalk, evaluate: evaluate, sign: sign, talk: function () { return TALK; },
    reset: function () { TALK = null; }
  };
})(window);
