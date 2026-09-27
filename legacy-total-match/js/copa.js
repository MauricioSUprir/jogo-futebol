/* ================= TOTAL MATCH — Copa Online =================
   Competição de mata-mata que as pessoas entram por código. O dono escolhe
   quantos participantes, cada um escolhe o seu time, e na hora do sorteio as
   vagas que sobraram viram BOTS. O chaveamento é sorteado e todo mundo
   acompanha a mesma chave.

   Os jogos que não são seus são simulados com SEMENTE FIXA (código + rodada +
   confronto), então todo aparelho chega exatamente no mesmo resultado sem
   precisar combinar nada. Os seus jogos você joga, e o resultado é gravado
   com transação: o primeiro a gravar manda, e quem chegar depois vê o
   mesmo placar. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var N = function () { return TM.net; };
  var KEY = "copa";

  /* ---------- estado local ---------- */
  function carrega() { try { return TM.storage.read(KEY, null); } catch (e) { return null; } }
  function grava(s) { try { TM.storage.write(KEY, s); } catch (e) {} }
  function apaga() { try { TM.storage.remove(KEY); } catch (e) {} }

  var TAMANHOS = [4, 8, 16, 32];
  var NOMES_BOT = ["Rafa", "Gui", "Duda", "Léo", "Bia", "Caio", "Nina", "Théo", "Alice", "Davi", "Manu", "Enzo",
    "Lara", "Pedro", "Cecília", "Miguel", "Helena", "Arthur", "Laura", "Bernardo", "Isa", "Noah", "Maitê", "Ravi",
    "Sophia", "Gael", "Liz", "Anthony", "Aurora", "Benício", "Elisa", "Murilo"];

  /* ---------- sorteio com semente (todo mundo chega no mesmo resultado) ---------- */
  function hashStr(s) {
    var h = 2166136261; s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // roda fn() com o Math.random preso a uma semente e devolve o que ela retornar
  function comSemente(semente, fn) {
    var orig = Math.random;
    Math.random = mulberry(hashStr(semente));
    try { return fn(); } finally { Math.random = orig; }
  }

  /* ---------- montagem da chave ---------- */
  function clubesLivres(usados) {
    var out = [];
    TM.data.world().clubs.forEach(function (c) { if (!usados[c.id]) out.push(c.id); });
    return out;
  }
  // monta os participantes: gente que entrou + bots nas vagas que sobraram
  function montaChave(code, size, players) {
    var slots = [], usados = {}, nomesTomados = {};
    Object.keys(players || {}).forEach(function (uid) {
      var p = players[uid] || {};
      if (!p.teamId) return;                       // quem não escolheu time fica de fora
      if (usados[p.teamId]) return;                // dois jogadores no mesmo time: o segundo vira bot depois
      usados[p.teamId] = 1;
      var nm = p.name || "Jogador";
      nomesTomados[nm.toLowerCase()] = 1;          // bot nenhum vai se chamar igual a alguém de verdade
      slots.push({ tipo: "humano", uid: uid, nome: nm, teamId: p.teamId });
    });
    slots = slots.slice(0, size);
    return comSemente("copa:" + code + ":sorteio", function () {
      var pool = clubesLivres(usados);
      for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      var livres = NOMES_BOT.filter(function (n) { return !nomesTomados[n.toLowerCase()]; });
      if (!livres.length) livres = NOMES_BOT.slice();
      var b = 0;
      while (slots.length < size && pool.length) {
        slots.push({ tipo: "bot", nome: livres[b % livres.length] + (b >= livres.length ? " " + (Math.floor(b / livres.length) + 1) : "") + " (bot)", teamId: pool.shift() });
        b++;
      }
      // embaralha a ordem: quem enfrenta quem é sorte
      for (var k = slots.length - 1; k > 0; k--) { var m = Math.floor(Math.random() * (k + 1)); var tmp = slots[k]; slots[k] = slots[m]; slots[m] = tmp; }
      return { size: size, slots: slots };
    });
  }
  function nRodadas(size) { var n = 0, s = size; while (s > 1) { s /= 2; n++; } return n; }
  function nomeRodada(size, r) {
    var faltam = size >> r;
    if (faltam === 2) return "Final";
    if (faltam === 4) return "Semifinal";
    if (faltam === 8) return "Quartas";
    if (faltam === 16) return "Oitavas";
    return "Primeira fase";
  }
  // quem está em cada posição da rodada r, a partir dos resultados já gravados
  function participantes(chave, res, r) {
    if (r === 0) return chave.slots.slice();
    var ant = participantes(chave, res, r - 1), out = [];
    for (var i = 0; i * 2 < ant.length; i++) {
      var k = (r - 1) + "_" + i, v = res && res[k];
      if (!v) { out.push(null); continue; }
      out.push(v.vencedor === 0 ? ant[i * 2] : ant[i * 2 + 1]);
    }
    return out;
  }
  function confrontos(chave, res, r) {
    var gente = participantes(chave, res, r), jogos = [];
    for (var i = 0; i * 2 < gente.length; i++) {
      jogos.push({ id: r + "_" + i, r: r, i: i, a: gente[i * 2], b: gente[i * 2 + 1], res: (res && res[r + "_" + i]) || null });
    }
    return jogos;
  }
  function meuSlot(chave, uid) {
    for (var i = 0; i < chave.slots.length; i++) if (chave.slots[i].tipo === "humano" && chave.slots[i].uid === uid) return chave.slots[i];
    return null;
  }
  function souEu(slot, uid) { return !!(slot && slot.tipo === "humano" && slot.uid === uid); }

  /* ---------- simular um confronto (sem mim) ---------- */
  function timeDe(slot) { return TM.engine.teamFromClub(slot.teamId); }
  function simulaConfronto(code, jogo) {
    return comSemente("copa:" + code + ":" + jogo.id, function () {
      var ta = timeDe(jogo.a), tb = timeDe(jogo.b);
      var r = TM.engine.simulate(ta, tb, { realism: 3, neutral: true });
      var ga = r.score[0], gb = r.score[1], pen = null;
      if (ga === gb) {
        var s = TM.engine.shootout(ta, tb);
        pen = s.score ? s.score.join("-") : null;
        return { ga: ga, gb: gb, pen: pen, vencedor: s.winner };
      }
      return { ga: ga, gb: gb, pen: null, vencedor: ga > gb ? 0 : 1 };
    });
  }

  /* ---------- telas ---------- */
  function semRede(screen, voltar) {
    screen.appendChild(el("div", { class: "panel-narrow" }, [
      el("div", { class: "untransfer-box" }, [
        el("div", { class: "ut-ic", text: "📡" }),
        el("div", { class: "ut-t", text: "Sem conexão com a nuvem" }),
        el("div", { class: "ut-s", text: "A Copa Online precisa de internet para as pessoas entrarem com o código." }),
        TM.ui.button("← Voltar", voltar, "btn")
      ])
    ]));
  }

  TM.ui.register("copa", function (screen) {
    screen.appendChild(TM.ui.topbar("🏆 Copa Online", function () { TM.ui.go("online"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Uma competição de mata-mata que as pessoas entram por código. Quem entrar escolhe o time; o que sobrar de vaga o sorteio preenche com bots." }));

    var s = carrega();
    if (s && s.code) {
      body.appendChild(el("div", { class: "list-head", text: "Você está em uma" }));
      body.appendChild(el("button", { class: "chosen-team", on: { click: function () { TM.ui.go(s.chave ? "copa-chave" : "copa-sala"); } } }, [
        el("span", { class: "copa-code-mini", text: s.code }),
        el("div", { class: "chosen-info" }, [
          el("div", { class: "chosen-name", text: (s.size || "?") + " participantes" }),
          el("div", { class: "chosen-sub", text: s.chave ? "chave sorteada — toque para continuar" : "esperando o sorteio" })
        ])
      ]));
      body.appendChild(TM.ui.button("Sair desta competição", function () {
        TM.ui.confirm("Sair da competição?", "Você perde a sua vaga. Se você é o dono e o sorteio ainda não foi feito, a sala é encerrada para todo mundo.", "Sair", function () {
          try { N().sairCopa(s.code); } catch (e) {}
          apaga(); TM.ui.go("copa");
        }, true);
      }, "btn ghost small"));
    }

    body.appendChild(el("div", { class: "list-head", text: "Começar" }));
    body.appendChild(TM.ui.button("➕ Criar competição", function () { TM.ui.go("copa-criar"); }, "btn primary big"));
    body.appendChild(TM.ui.button("🔑 Entrar com código", function () { TM.ui.go("copa-entrar"); }, "btn big"));
  });

  /* ---- criar ---- */
  var rascunho = { size: 8, meuTime: null };   // sobrevive à ida e volta da escolha de time
  TM.ui.register("copa-criar", function (screen) {
    screen.appendChild(TM.ui.topbar("Criar competição", function () { TM.ui.go("copa"); }));
    if (!N() || !N().available) { semRede(screen, function () { TM.ui.go("copa"); }); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    var size = rascunho.size, meuTime = rascunho.meuTime;
    var linha = el("div", { class: "segmented full" });
    TAMANHOS.forEach(function (n) {
      linha.appendChild(el("button", { class: "seg-btn" + (size === n ? " active" : ""), text: n, on: { click: function () {
        size = n; rascunho.size = n;
        Array.prototype.forEach.call(linha.children, function (x) { x.classList.remove("active"); });
        this.classList.add("active"); dica.textContent = textoDica();
      } } }));
    });
    function textoDica() { return "Mata-mata de " + size + ": " + nRodadas(size) + " rodada(s) até a final. Quem não entrar a tempo vira bot."; }
    var dica = el("div", { class: "setting-hint", text: textoDica() });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Participantes" }), linha, dica ]));

    body.appendChild(el("div", { class: "list-head", text: "Seu time" }));
    var caixaTime = el("div");
    body.appendChild(caixaTime);
    function desenhaTime() {
      TM.ui.clear(caixaTime);
      if (meuTime) {
        var c = TM.data.club(meuTime);
        caixaTime.appendChild(el("div", { class: "chosen-team", on: { click: escolher } }, [
          TM.img.clubImg(c, "chosen-crest"),
          el("div", { class: "chosen-info" }, [ el("div", { class: "chosen-name", text: c.name }), el("div", { class: "chosen-sub", text: "toque para trocar" }) ]),
          TM.ui.ovBadge(TM.data.clubRating(meuTime))
        ]));
      } else {
        caixaTime.appendChild(el("button", { class: "chosen-team empty", on: { click: escolher } }, [ el("span", { text: "➕ Escolher seu time" }) ]));
      }
    }
    function escolher() {
      TM.ui.pickTeam({ source: "club", title: "Escolha o seu time", back: "copa-criar", current: meuTime,
        onPick: function (id) { rascunho.meuTime = id; TM.ui.go("copa-criar"); } });
    }
    desenhaTime();

    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Criar e pegar o código", function () {
        if (!meuTime) { TM.ui.toast("Escolha o seu time primeiro"); return; }
        TM.ui.toast("Criando a sala…");
        N().onReady(function () {
          N().criarCopa(size, meuTime, function (code, erro) {
            if (!code) { TM.ui.toast(erro || "Não consegui criar a sala"); return; }
            grava({ code: code, size: size, host: true, meuTime: meuTime });
            rascunho = { size: 8, meuTime: null };
            TM.ui.go("copa-sala");
          });
        });
      }, "btn primary big")
    ]));
  });

  /* ---- entrar ---- */
  TM.ui.register("copa-entrar", function (screen) {
    screen.appendChild(TM.ui.topbar("Entrar com código", function () { TM.ui.go("copa"); }));
    if (!N() || !N().available) { semRede(screen, function () { TM.ui.go("copa"); }); return; }
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var campo = el("input", { class: "select copa-code-in", type: "text", placeholder: "CÓDIGO", maxlength: "5" });
    campo.addEventListener("input", function () { campo.value = campo.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Código da competição" }), campo,
      el("div", { class: "setting-hint", text: "Peça o código para quem criou a competição." }) ]));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Entrar", function () {
        var code = (campo.value || "").trim().toUpperCase();
        if (code.length < 4) { TM.ui.toast("Digite o código"); return; }
        TM.ui.toast("Procurando a sala…");
        N().onReady(function () {
          N().entrarCopa(code, function (ok, erro) {
            if (!ok) { TM.ui.toast(erro || "Não achei essa competição"); return; }
            grava({ code: code, host: false, meuTime: null });
            TM.ui.go("copa-sala");
          });
        });
      }, "btn primary big")
    ]));
  });

  /* ---- sala de espera ---- */
  var pararSala = null;
  TM.ui.register("copa-sala", function (screen) {
    var s = carrega();
    if (!s || !s.code) { TM.ui.go("copa"); return; }
    screen.appendChild(TM.ui.topbar("Sala " + s.code, function () { if (pararSala) { pararSala(); pararSala = null; } TM.ui.go("copa"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    body.appendChild(el("div", { class: "copa-code", on: { click: function () {
      try { navigator.clipboard.writeText(s.code); TM.ui.toast("Código copiado: " + s.code); } catch (e) {}
    } } }, [
      el("div", { class: "copa-code-lbl", text: "CÓDIGO DA COMPETIÇÃO" }),
      el("div", { class: "copa-code-val", text: s.code }),
      el("div", { class: "copa-code-hint", text: "toque para copiar e mandar para a galera" })
    ]));

    var caixaTime = el("div");
    body.appendChild(el("div", { class: "list-head", text: "Seu time" }));
    body.appendChild(caixaTime);
    function desenhaTime() {
      TM.ui.clear(caixaTime);
      if (s.meuTime) {
        var c = TM.data.club(s.meuTime);
        caixaTime.appendChild(el("div", { class: "chosen-team", on: { click: escolher } }, [
          TM.img.clubImg(c, "chosen-crest"),
          el("div", { class: "chosen-info" }, [ el("div", { class: "chosen-name", text: c.name }), el("div", { class: "chosen-sub", text: "toque para trocar" }) ]),
          TM.ui.ovBadge(TM.data.clubRating(s.meuTime))
        ]));
      } else {
        caixaTime.appendChild(el("button", { class: "chosen-team empty", on: { click: escolher } }, [ el("span", { text: "➕ Escolher seu time" }) ]));
      }
    }
    function escolher() {
      TM.ui.pickTeam({ source: "club", title: "Escolha o seu time", back: "copa-sala", current: s.meuTime, onPick: function (id) {
        var st = carrega(); st.meuTime = id; grava(st);
        try { N().copaTime(st.code, id); } catch (e) {}
        TM.ui.go("copa-sala");
      } });
    }
    desenhaTime();

    var lista = el("div", { class: "copa-lista" });
    var contador = el("div", { class: "setting-hint", text: "carregando…" });
    body.appendChild(el("div", { class: "list-head", text: "Quem já entrou" }));
    body.appendChild(contador);
    body.appendChild(lista);
    var acoes = el("div", { class: "actions" });
    body.appendChild(acoes);

    if (pararSala) { pararSala(); pararSala = null; }
    N().onReady(function () {
      pararSala = N().ouvirCopa(s.code, function (v) {
        if (!v) { TM.ui.toast("A sala foi encerrada pelo dono."); apaga(); TM.ui.go("copa"); return; }
        var st = carrega(); if (!st) return;
        st.size = v.size; grava(st);
        if (v.status === "sorteado" && v.chave) {
          var s2 = carrega(); s2.chave = v.chave; grava(s2);
          if (pararSala) { pararSala(); pararSala = null; }
          TM.ui.go("copa-chave"); return;
        }
        TM.ui.clear(lista); TM.ui.clear(acoes);
        var uids = Object.keys(v.players || {});
        var comTime = uids.filter(function (u) { return v.players[u].teamId; }).length;
        contador.textContent = uids.length + " de " + v.size + " vaga(s) — " + comTime + " já escolheram o time. As vagas que sobrarem viram bots no sorteio.";
        uids.forEach(function (uid) {
          var pl = v.players[uid] || {};
          var cl = pl.teamId ? TM.data.club(pl.teamId) : null;
          lista.appendChild(el("div", { class: "copa-item" + (uid === v.host ? " dono" : "") }, [
            cl ? TM.img.clubImg(cl, "copa-crest") : el("span", { class: "copa-crest vazio", text: "?" }),
            el("div", { class: "copa-item-info" }, [
              el("div", { class: "copa-item-nome", text: pl.name || "Jogador" + (uid === v.host ? " · dono" : "") }),
              el("div", { class: "copa-item-sub", text: cl ? cl.name : "ainda escolhendo o time" })
            ])
          ]));
        });
        for (var i = uids.length; i < v.size; i++) {
          lista.appendChild(el("div", { class: "copa-item bot" }, [
            el("span", { class: "copa-crest vazio", text: "🤖" }),
            el("div", { class: "copa-item-info" }, [
              el("div", { class: "copa-item-nome", text: "Vaga livre" }),
              el("div", { class: "copa-item-sub", text: "vira bot no sorteio" })
            ])
          ]));
        }
        if (v.host === (N().me && N().me.uid)) {
          acoes.appendChild(TM.ui.button("🎲 Sortear a chave e começar", function () {
            if (!carrega().meuTime) { TM.ui.toast("Escolha o seu time antes de sortear"); return; }
            var chave = montaChave(s.code, v.size, v.players);
            N().sortearCopa(s.code, chave, function (ok) { if (!ok) TM.ui.toast("Não consegui sortear. Tente de novo."); });
          }, "btn primary big"));
          acoes.appendChild(el("div", { class: "setting-hint", text: "Pode sortear a qualquer momento: quem não tiver entrado vira bot." }));
        } else {
          acoes.appendChild(el("div", { class: "setting-hint", text: "Esperando " + (v.hostName || "o dono") + " sortear a chave…" }));
        }
      });
    });
  });

  /* ---- chave ---- */
  var pararChave = null;
  TM.ui.register("copa-chave", function (screen) {
    var s = carrega();
    if (!s || !s.code || !s.chave) { TM.ui.go("copa"); return; }
    screen.appendChild(TM.ui.topbar("🏆 Copa " + s.code, function () { if (pararChave) { pararChave(); pararChave = null; } TM.ui.go("copa"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var aviso = el("div", { class: "copa-aviso" });
    var caixa = el("div");
    body.appendChild(aviso);
    body.appendChild(caixa);

    if (pararChave) { pararChave(); pararChave = null; }
    N().onReady(function () {
      pararChave = N().ouvirCopa(s.code, function (v) {
        if (!v || !v.chave) { TM.ui.toast("A competição não existe mais."); apaga(); TM.ui.go("copa"); return; }
        desenha(v);
      });
    });

    function desenha(v) {
      var chave = v.chave, res = v.res || {}, uid = N().me ? N().me.uid : null;
      TM.ui.clear(caixa); TM.ui.clear(aviso);
      var rodadas = nRodadas(chave.size);
      var meu = meuSlot(chave, uid);
      var meuJogo = null, eliminado = false, campeao = null;

      // campeão?
      var ultimo = res[(rodadas - 1) + "_0"];
      if (ultimo) {
        var finalistas = participantes(chave, res, rodadas - 1);
        campeao = ultimo.vencedor === 0 ? finalistas[0] : finalistas[1];
      }

      for (var r = 0; r < rodadas; r++) {
        var jogos = confrontos(chave, res, r);
        var sec = el("div", { class: "copa-rodada" }, [ el("div", { class: "copa-rodada-t", text: nomeRodada(chave.size, r) }) ]);
        jogos.forEach(function (j) {
          var pronto = !!j.res, temTodos = j.a && j.b;
          if (temTodos && !pronto && (souEu(j.a, uid) || souEu(j.b, uid)) && !meuJogo) meuJogo = j;
          sec.appendChild(linhaJogo(j, uid, pronto));
        });
        caixa.appendChild(sec);
      }

      if (meu) {
        // continuo vivo?
        var vivo = false;
        for (var rr = 0; rr <= rodadas; rr++) {
          var gente = participantes(chave, res, Math.min(rr, rodadas - 1));
          if (rr === rodadas) { vivo = campeao && campeao.uid === uid; break; }
          if (gente.some(function (g) { return g && g.uid === uid; })) vivo = true; else { vivo = false; break; }
        }
        eliminado = !vivo && !(campeao && campeao.uid === uid);
      }

      if (campeao) {
        aviso.appendChild(el("div", { class: "copa-campeao" }, [
          el("span", { class: "copa-taca", text: "🏆" }),
          el("div", { text: "Campeão: " + campeao.nome + " · " + (TM.data.club(campeao.teamId) || {}).name })
        ]));
      } else if (meuJogo) {
        aviso.appendChild(el("div", { class: "copa-vez" }, [
          el("div", { class: "copa-vez-t", text: "Sua vez: " + nomeRodada(chave.size, meuJogo.r) }),
          el("div", { class: "copa-vez-s", text: (TM.data.club(meuJogo.a.teamId) || {}).name + " × " + (TM.data.club(meuJogo.b.teamId) || {}).name })
        ]));
        aviso.appendChild(TM.ui.button("▶ Jogar agora", function () {
          var st = carrega(); st.jogo = meuJogo.id; grava(st);
          TM.ui.go("copa-jogo", { id: meuJogo.id });
        }, "btn primary big"));
      } else if (eliminado) {
        aviso.appendChild(el("div", { class: "copa-vez fora" }, [ el("div", { class: "copa-vez-t", text: "Você está fora desta copa." }),
          el("div", { class: "copa-vez-s", text: "Dá para acompanhar o resto da chave por aqui." }) ]));
      } else if (!meu) {
        aviso.appendChild(el("div", { class: "copa-vez fora" }, [ el("div", { class: "copa-vez-t", text: "Você está só assistindo." }),
          el("div", { class: "copa-vez-s", text: "Você não entrou a tempo ou não escolheu time antes do sorteio." }) ]));
      } else {
        aviso.appendChild(el("div", { class: "copa-vez espera" }, [ el("div", { class: "copa-vez-t", text: "Esperando os outros jogos da rodada." }),
          el("div", { class: "copa-vez-s", text: "Toque em “Rodar os jogos dos bots” para destravar." }) ]));
      }

      // jogos sem gente de verdade: qualquer aparelho pode rodar, o resultado é o mesmo
      var pendentes = [];
      for (var r2 = 0; r2 < rodadas; r2++) {
        confrontos(chave, res, r2).forEach(function (j) {
          if (!j.res && j.a && j.b && !souEu(j.a, uid) && !souEu(j.b, uid)) pendentes.push(j);
        });
      }
      if (pendentes.length) {
        aviso.appendChild(TM.ui.button("⚙️ Rodar os jogos dos bots (" + pendentes.length + ")", function () {
          var faltam = pendentes.length;
          pendentes.forEach(function (j) {
            var r3 = simulaConfronto(s.code, j);
            N().gravarResultadoCopa(s.code, j.id, r3, function () { faltam--; if (faltam <= 0) TM.ui.toast("Rodada atualizada"); });
          });
        }, "btn"));
      }
    }

    function linhaJogo(j, uid, pronto) {
      function lado(slot, gols, ganhou) {
        if (!slot) return el("div", { class: "copa-lado vazio" }, [ el("span", { class: "copa-crest vazio", text: "?" }), el("span", { class: "copa-nome", text: "a definir" }) ]);
        var cl = TM.data.club(slot.teamId) || { name: "?" };
        return el("div", { class: "copa-lado" + (ganhou ? " ganhou" : "") + (souEu(slot, uid) ? " eu" : "") }, [
          TM.img.clubImg(cl, "copa-crest"),
          el("div", { class: "copa-lado-txt" }, [
            el("span", { class: "copa-nome", text: cl.name }),
            el("span", { class: "copa-dono", text: slot.tipo === "bot" ? slot.nome : (souEu(slot, uid) ? "você" : slot.nome) })
          ]),
          el("span", { class: "copa-gols", text: gols == null ? "" : String(gols) })
        ]);
      }
      var ga = pronto ? j.res.ga : null, gb = pronto ? j.res.gb : null;
      var vA = pronto && j.res.vencedor === 0, vB = pronto && j.res.vencedor === 1;
      var wrap = el("div", { class: "copa-jogo" + (pronto ? " feito" : "") }, [ lado(j.a, ga, vA), lado(j.b, gb, vB) ]);
      if (pronto && j.res.pen) wrap.appendChild(el("div", { class: "copa-pen", text: "pênaltis " + j.res.pen }));
      return wrap;
    }
  });

  /* ---- jogar o meu confronto ---- */
  TM.ui.register("copa-jogo", function (screen, params) {
    var s = carrega();
    if (!s || !s.chave) { TM.ui.go("copa"); return; }
    var id = (params && params.id) || s.jogo;
    var uid = N().me ? N().me.uid : null;
    N().onReady(function () {
      // relê o estado da nuvem: o adversário pode ter jogado primeiro
      var parar = N().ouvirCopa(s.code, function (v) {
        parar();
        if (!v || !v.chave) { TM.ui.go("copa"); return; }
        var res = v.res || {};
        if (res[id]) { TM.ui.toast("Esse jogo já foi decidido."); TM.ui.go("copa-chave"); return; }
        var r = parseInt(id.split("_")[0], 10), i = parseInt(id.split("_")[1], 10);
        var jogos = confrontos(v.chave, res, r), j = jogos[i];
        if (!j || !j.a || !j.b) { TM.ui.go("copa-chave"); return; }
        joga(v, j);
      });
    });

    function joga(v, j) {
      var ta = timeDe(j.a), tb = timeDe(j.b);
      var meuLado = souEu(j.a, uid) ? 0 : 1;
      var simOpts = { realism: 3, neutral: true, tacticSide: meuLado };
      var result = TM.engine.simulate(ta, tb, simOpts);
      TM.matchview.play(screen, {
        teamA: ta, teamB: tb, result: result, title: nomeRodada(v.chave.size, j.r) + " · Copa " + s.code,
        pauseSide: meuLado, simOpts: simOpts,
        onBack: function () { TM.ui.go("copa-chave"); },
        onDone: function () {
          var ga = result.score[0], gb = result.score[1], pen = null, vencedor;
          if (ga === gb) {
            var sh = TM.engine.shootout(ta, tb);
            pen = sh.score ? sh.score.join("-") : null;
            vencedor = sh.winner;
            TM.ui.go("pen-shootout", { teamA: ta, teamB: tb, shoot: sh, title: "Pênaltis · Copa " + s.code, onDone: function () { grava2(ga, gb, pen, vencedor); } });
            return;
          }
          vencedor = ga > gb ? 0 : 1;
          grava2(ga, gb, pen, vencedor);
        }
      });
      function grava2(ga, gb, pen, vencedor) {
        N().gravarResultadoCopa(s.code, j.id, { ga: ga, gb: gb, pen: pen, vencedor: vencedor }, function (fui, valor) {
          if (!fui && valor) TM.ui.toast("O seu adversário registrou primeiro: " + valor.ga + "×" + valor.gb + ".");
          TM.ui.go("copa-chave");
        });
      }
    }
  });

  TM.copa = { montaChave: montaChave, confrontos: confrontos, participantes: participantes, nRodadas: nRodadas, nomeRodada: nomeRodada, simulaConfronto: simulaConfronto };
})(window);
