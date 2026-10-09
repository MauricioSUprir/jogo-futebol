/* ================= TOTAL MATCH 3D — partidas em 3D =================
   O jogo é um só: o Total Match. O motor 3D (pasta futebol3d/, no mesmo site — era
   o GOLAÇO) roda a partida do seu time quando você escolhe "Jogar em 3D".

   Como os dois conversam (mesmo endereço = mesmo armazenamento do navegador):
     TM → localStorage["tm3d:pedido:<id>"] = { v, id, titulo, home, away, userSide, controle }
          e abre o 3D num quadro (iframe) por cima do TM: futebol3d/index.html?tm=<id>
     3D → window.parent.postMessage({ tipo: "tm3d:pronto" | "tm3d:fim" | "tm3d:sair", id, resultado })
          (o resultado também fica em localStorage["tm3d:resultado:<id>"], se a mensagem se perder)
   Os times vão no formato de time do 3D (futebol3d/tools/CONTRACTS.md): nome, sigla, cores,
   uniformes, escudo e os jogadores (11 titulares na ordem do TM + reservas) com atributos,
   posição e aparência. Cada jogador leva o tmId: o resultado volta com quem marcou de verdade.
   O 3D cuida só dos 90 minutos; prorrogação e pênaltis continuam com o Total Match.
   Os titulares vão com a vaga da prancheta do TM (slot): o 3D põe cada um na posição mais parecida.
   resultado = { homeGoals, awayGoals, gols: [{ lado: 0|1, tmId, nome, minuto, penalti, contra }],
                 cartoes: [{ lado, tmId, nome, minuto, cor }], stats: { possession, shots, onTarget },
                 jogador?: { tmId, nota, gols, assist } }   (o lado do 3D está em futebol3d/js/ponte-tm.js)
   Se o 3D não abrir (sem WebGL, sem internet para o three.js), a partida é simulada. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  var api = {
    PASTA: "futebol3d/index.html",          // os testes trocam por uma página de ensaio
    ESPERA_MS: 30000                          // sem sinal do 3D nesse tempo: oferece simular
  };

  /* ---------- utilidades ---------- */
  function webgl() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function sorteio(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function escolhe(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function rgb(h) { h = String(h || "#888888").replace("#", ""); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(h) { var c = rgb(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function dist(a, b) { var x = rgb(a), y = rgb(b); return Math.sqrt(Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2)); }
  function tom(h, f) { var c = rgb(h).map(function (v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }); return "#" + c.map(function (v) { return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
  function contraste(h) { return lum(h) > 0.55 ? "#111111" : "#ffffff"; }
  // mesmo clarear/escurecer dos uniformes do TM (placeholders.js)
  function soma(h, d) { var c = rgb(h).map(function (v) { v = Math.max(0, Math.min(255, Math.round(v + d))); return (v < 16 ? "0" : "") + v.toString(16); }); return "#" + c.join(""); }
  function clareia(h, pct) { return soma(h, Math.round(255 * pct / 100)); }
  function escurece(h, pct) { return soma(h, -Math.round(255 * pct / 100)); }

  /* ---------- preferência (Config) ---------- */
  function preferencia() { try { return TM.storage.settings().partidas3d || "perguntar"; } catch (e) { return "perguntar"; } }
  function salvaPreferencia(v) { try { var s = TM.storage.settings(); s.partidas3d = v; TM.storage.saveSettings(s); } catch (e) {} }

  /* ---------- time do TM → time do 3D ---------- */
  var POS_3D = { GOL: "GOL", ZAG: "ZAG", LD: "LD", LE: "LE", VOL: "VOL", MC: "MC", MEI: "MEI", MD: "MD", ME: "ME", CA: "CA", SA: "ATA", PD: "PD", PE: "PE" };
  var POS_SETOR = { GK: "GOL", DF: "ZAG", MF: "MC", FW: "CA" };
  // o 3D tem 4 desenhos táticos: cada formação do TM vai para o mais parecido
  var FORM_3D = { "4-3-3": "4-3-3", "4-2-3-1": "4-2-3-1", "4-4-2": "4-4-2", "3-5-2": "3-5-2",
    "4-1-4-1": "4-2-3-1", "4-5-1": "4-2-3-1", "4-4-1-1": "4-2-3-1", "4-1-2-1-2": "4-4-2", "4-2-2-2": "4-4-2", "4-2-4": "4-4-2",
    "3-4-3": "3-5-2", "3-4-1-2": "3-5-2", "3-4-2-1": "3-5-2", "5-3-2": "3-5-2", "5-4-1": "3-5-2", "5-2-3": "3-5-2" };
  var PELES = ["#f2d2bb", "#e8bf9f", "#dcaa85", "#c99169", "#b27a52", "#96603d", "#7a4a2d", "#5c3620", "#462817"];
  var CABELOS = ["#15110e", "#2e1f15", "#4d321e", "#79542f", "#b48d52", "#8f4a22"];
  var GOLEIRO = ["#c9e83a", "#2a9d5c", "#6b6f7a", "#d63b6a", "#f5a524", "#3a7bd5", "#9b5de5", "#ff7a00"];
  var FORMAS = ["heater", "badge", "clipped", "french", "hex", "oval", "roundel", "scallop"];
  var MOTIVOS = ["plain", "stripes", "halves", "hoops", "pales", "rays", "sash"];
  var EMBLEMAS = ["anchor", "falcon", "helm", "locomotive", "palm", "sun", "tower", "wolf"];

  function nomeCurto(n) {
    var a = String(n || "").trim().split(/\s+/);
    if (a.length < 2) return a[0] || "Jogador";
    return a[0][0] + ". " + a.slice(1).join(" ");
  }
  // aparência fixa por jogador (mesma em todo jogo): o 3D escolhe o rosto por ela
  function aparencia(p) {
    var r = sorteio(hash("look" + p.id));
    var si = Math.floor(r() * PELES.length), escura = si >= 5;
    var hc = escura ? (r() < 0.9 ? CABELOS[0] : CABELOS[1]) : CABELOS[Math.min(CABELOS.length - 1, Math.floor(Math.pow(r(), 1.4) * CABELOS.length))];
    var estilos = escura ? ["short", "buzz", "curly", "afro", "bald", "short", "buzz", "bun"] : ["short", "short", "buzz", "curly", "long", "bald", "bun", "short"];
    var alt = p.height ? p.height / 100 : 1.70 + r() * 0.2;
    var imc = (p.weight && p.height) ? p.weight / Math.pow(p.height / 100, 2) : 21.5 + r() * 3;
    return { skin: PELES[si], hair: escolhe(estilos, r), hairColor: hc, height: Math.round(alt * 100) / 100,
             build: Math.max(0, Math.min(1, (imc - 20) / 6)), beard: r() < 0.3 };
  }
  function jogador3d(p, i, vaga) {
    var r = sorteio(hash("pe" + p.id)), a = p.attrs || {};
    var pos = POS_3D[p.pos2] || POS_SETOR[p.pos] || "MC", gol = p.pos === "GK";
    var esq = /^(LE|PE|ME)$/.test(pos) ? r() < 0.75 : r() < 0.2;
    var nota = p.overall || 60;
    var j = {
      tmId: p.id, name: nomeCurto(p.name), nomeCompleto: p.name, num: p.number || (i + 1), pos: pos,
      attrs: { pac: a.pac || nota, sho: a.sho || nota, pas: a.pas || nota, dri: a.dri || nota, def: a.def || nota, phy: a.phy || nota,
               gk: gol ? nota : 8 + Math.floor(r() * 14) },
      overall: nota, foot: esq ? "E" : "D", look: aparencia(p)
    };
    if (vaga) j.slot = [vaga[0], vaga[1], vaga[2]];   // vaga na prancheta do TM: o 3D põe cada um no lugar mais parecido
    return j;
  }
  // 11 titulares (na ordem das vagas da formação) + reservas. Time sem escalação montada
  // (adversário da carreira vem ordenado por nota) passa pelo montador de escalação do TM.
  function escalacao(time, formacao) {
    var ps = (time.players || []).filter(Boolean);
    var F = (TM.comp && TM.comp.FORMATIONS) || {};
    var xi = ps.slice(0, 11);
    var gols = xi.filter(function (p) { return p.pos === "GK"; }).length;
    var pronta = !!F[formacao] && xi.length === 11 && gols === 1 && xi[0].pos === "GK";
    if (!pronta && TM.comp && TM.comp.buildBestLineup && ps.length >= 11) {
      var lu = TM.comp.buildBestLineup(ps, F[formacao] ? formacao : "auto");
      var porId = {}; ps.forEach(function (p) { porId[p.id] = p; });
      var tit = lu.starters.map(function (id) { return porId[id]; }).filter(Boolean), usado = {};
      tit.forEach(function (p) { usado[p.id] = 1; });
      ps = tit.concat(ps.filter(function (p) { return !usado[p.id]; }));
      formacao = lu.formation;
    }
    if (!F[formacao]) formacao = "4-4-2";
    return { players: ps, formacao: formacao, vagas: F[formacao] || [] };
  }
  function kit(shirt, sleeves, shorts, socks, pattern, second, trim, number, collar) {
    return { shirt: shirt, sleeves: sleeves, shorts: shorts, socks: socks, pattern: pattern, second: second, trim: trim, number: number,
             collar: collar || "crew", sponsor: "TOTAL MATCH", sponsorColor: number };
  }
  // os mesmos 3 uniformes que o TM desenha (placeholders.js kit): cores, padrão e gola pelo clube
  var PADRAO_TM = ["plain", "stripes", "halves", "sash", "hoops", "plain"];
  function uniformeTM(chave, p1, p2, v) {
    var p, s, semente;
    if (v === 1) { p = p2; s = p1; semente = "away"; }
    else if (v === 2) { p = lum(p1) < 0.28 ? clareia(p2, 26) : escurece(p1, 48); s = lum(p) < 0.32 ? clareia(p2, 22) : escurece(p1, 24); semente = "third"; }
    else { p = p1; s = p2; semente = "home"; }
    var h = hash(chave + semente);
    var calcao = dist(s, p) > 70 ? s : contraste(p);
    return kit(p, s, calcao, p, PADRAO_TM[h % 6], s, s, contraste(p), ((h >>> 4) % 2 === 0) ? "v" : "crew");
  }
  function goleiroLonge(cores, r) {
    var ops = GOLEIRO.filter(function (c) { return cores.every(function (x) { return dist(c, x) > 120; }); });
    return escolhe(ops.length ? ops : GOLEIRO, r);
  }
  /* time = time do motor do TM ({ id, name, short?, players, club?, nation?, colors?, kitVariant? }) */
  function time3d(time, formacao) {
    var clube = time.club || null, nac = time.nation || null;
    var base = clube || nac || {};
    var chave = base.id || base.name || time.id || time.name;
    var r = sorteio(hash("time" + chave));
    var cores = time.colors || base.colors || null;      // times do Ultimate trazem a cor do escudo
    var p1 = (cores && cores.primary) || escolhe(["#1e6fd9", "#d62828", "#2a9d5c", "#f5a524", "#6a4c93"], r);
    var p2 = (cores && cores.secondary) || "#ffffff";
    if (dist(p1, p2) < 60) p2 = lum(p1) > 0.5 ? "#111111" : "#ffffff";
    var casa = uniformeTM(chave, p1, p2, 0), fora = uniformeTM(chave, p1, p2, 1), terceiro = uniformeTM(chave, p1, p2, 2);
    var gk1 = goleiroLonge([p1, p2, terceiro.shirt], r), gk2 = goleiroLonge([p1, p2, terceiro.shirt, gk1], r);
    var sigla = (base.short || time.short || String(time.name || "TME").replace(/[^A-Za-zÀ-ú]/g, "").slice(0, 3)).toUpperCase().slice(0, 3);
    var esc = escalacao(time, formacao || time.formation);
    var jogs = esc.players.slice(0, 18).map(function (p, i) { return jogador3d(p, i, i < 11 ? esc.vagas[i] : null); });
    var xi = jogs.slice(0, 11), nota = xi.length ? Math.round(xi.reduce(function (s, p) { return s + p.overall; }, 0) / xi.length) : 70;
    var estadio = null; try { estadio = clube && TM.data.stadium ? TM.data.stadium(clube).name : null; } catch (e) {}
    var id = "tm_" + String(chave || hash(time.name)).replace(/[^a-zA-Z0-9_-]/g, "");
    var kv = time.kitVariant;
    return {
      id: id, name: time.name, short: sigla, city: "", nickname: "", stadium: estadio || ("Arena " + time.name),
      formation: FORM_3D[esc.formacao] || "4-4-2", formacaoTM: esc.formacao,
      rating: nota, style: { press: 0.5, width: 0.5, tempo: 0.5, directness: 0.5 },
      colors: { primary: p1, secondary: p2 }, collar: casa.collar, sponsor: "TOTAL MATCH",
      crest: { shape: escolhe(FORMAS, r), motif: escolhe(MOTIVOS, r), emblem: escolhe(EMBLEMAS, r), metal: r() < 0.5 ? "gold" : "silver",
               stars: 0, initials: sigla, field: p1, motifColor: p2, disc: tom(p1, -0.45), ink: contraste(p1), accent: p2,
               chief: tom(p1, -0.45), chiefText: "#ffffff", ribbon: tom(p1, -0.45), ribbonText: "#ffffff" },
      kits: {
        home: casa, away: fora, third: terceiro,
        gk: kit(gk1, gk1, gk1, gk1, "plain", contraste(gk1), contraste(gk1), contraste(gk1)),
        gkAway: kit(gk2, gk2, gk2, gk2, "plain", contraste(gk2), contraste(gk2), contraste(gk2))
      },
      kitEscolhido: (kv === 0 || kv === 1 || kv === 2) ? kv : null,
      players: jogs, tm: true
    };
  }

  /* ---------- resultado do 3D → resultado do TM (no mesmo objeto) ---------- */
  function achaJogador(t, g) {
    var ps = (t && t.players) || [];
    for (var i = 0; i < ps.length; i++) if (ps[i].id === g.tmId) return ps[i];
    for (var j = 0; j < ps.length; j++) if (nomeCurto(ps[j].name) === g.nome || ps[j].name === g.nome) return ps[j];
    return null;
  }
  function minuto(m) { return Math.max(1, Math.min(90, Math.round(m || 1))); }
  function aplicaResultado(result, r3, teamA, teamB) {
    var gols = (r3.gols || []).slice().sort(function (a, b) { return (a.minuto || 0) - (b.minuto || 0); });
    var placar = [0, 0], ev = [], expulsos = [];
    gols.forEach(function (g) {
      var lado = g.lado === 1 ? 1 : 0, t = lado === 0 ? teamA : teamB;
      // gol contra: o autor é do outro time e não conta como gol dele
      var pl = g.contra ? null : achaJogador(t, g);
      var autor = g.contra ? achaJogador(lado === 0 ? teamB : teamA, g) : null;
      placar[lado]++;
      var quem = pl ? pl.name : g.contra ? (autor ? autor.name : (g.nome || "Jogador")) + " (contra)" : (g.nome || "Jogador");
      ev.push({ minute: minuto(g.minuto), type: g.penalti ? "pengoal" : "goal", team: lado,
                player: quem, playerId: pl ? pl.id : null, score: placar.slice(),
                text: g.contra ? "GOL CONTRA! " + quem.replace(" (contra)", "") + " desvia para o próprio gol. Ponto para o " + t.name + "."
                  : (g.penalti ? "PÊNALTI CONVERTIDO! " : "GOL! ") + quem + " marca para o " + t.name + "." });
    });
    (r3.cartoes || []).forEach(function (c) {
      var lado = c.lado === 1 ? 1 : 0, t = lado === 0 ? teamA : teamB, pl = achaJogador(t, c);
      var quem = pl ? pl.name : (c.nome || "Jogador"), verm = c.cor === "red";
      ev.push({ minute: minuto(c.minuto), type: verm ? "red" : "yellow", team: lado, player: quem, playerId: pl ? pl.id : null,
                text: (verm ? "Expulso: " : "Amarelo para ") + quem + " (" + t.name + ")" });
      if (verm) expulsos.push({ id: pl ? pl.id : null, name: quem, side: lado, minute: minuto(c.minuto) });
    });
    var h = r3.homeGoals != null ? r3.homeGoals : placar[0], a = r3.awayGoals != null ? r3.awayGoals : placar[1];
    var meio = ev.filter(function (e) { return e.minute <= 45 && (e.type === "goal" || e.type === "pengoal"); });
    var intervalo = [meio.filter(function (e) { return e.team === 0; }).length, meio.filter(function (e) { return e.team === 1; }).length];
    ev.push({ minute: 45, type: "half", score: intervalo, text: "Fim do 1º tempo" });
    ev.sort(function (x, y) { return x.minute - y.minute || (x.type === "half" ? 1 : 0) - (y.type === "half" ? 1 : 0); });
    ev.push({ minute: 90, type: "full", score: [h, a], text: "Fim de jogo! (partida jogada em 3D)" });
    result.score = [h, a];
    result.events = ev;
    var st = r3.stats || {};
    result.stats = {
      possession: st.possession || (result.stats && result.stats.possession) || [50, 50],
      shots: st.shots || [Math.max(h, 1) + 4, Math.max(a, 1) + 4],
      onTarget: st.onTarget || [h + 1, a + 1]
    };
    result.injuries = []; result.sentOff = expulsos;
    result.em3d = true;
    if (result.focus && r3.jogador) {
      result.focus = { goals: r3.jogador.gols || 0, rating: r3.jogador.nota || result.focus.rating, injured: false, assists: r3.jogador.assist || 0 };
    }
    return result;
  }

  /* ---------- quadro do 3D por cima do TM ---------- */
  var ativo = null;
  function abre3d(pedido, fns) {
    if (ativo) fecha3d();
    try { localStorage.setItem("tm3d:pedido:" + pedido.id, JSON.stringify(pedido)); } catch (e) { fns.falhou("Sem espaço para preparar a partida 3D."); return; }
    var aviso = el("div", { class: "tm3d-aviso", text: "Abrindo o estádio 3D…" });
    var quadro = el("iframe", { class: "tm3d-quadro", src: api.PASTA + "?tm=" + encodeURIComponent(pedido.id), allow: "fullscreen; autoplay; gamepad", title: "Partida em 3D" });
    var sair = el("button", { class: "tm3d-sair", type: "button", title: "Voltar e simular", on: { click: function () {
      TM.ui.confirm("Sair do 3D?", "A partida é simulada do começo, como sem o 3D.", "Simular", function () { termina("sair"); });
    } } }, [TM.ic("x")]);
    var tela = el("div", { class: "tm3d-tela" }, [aviso, quadro, sair]);
    document.body.appendChild(tela);
    document.body.classList.add("tm3d-aberto");
    var pronto = false, acabou = false;
    var espera = setTimeout(function () {
      if (pronto || acabou) return;
      aviso.textContent = "O 3D está demorando para abrir.";
      aviso.appendChild(el("button", { class: "btn small", text: "Simular a partida", on: { click: function () { termina("sair"); } } }));
    }, api.ESPERA_MS);
    function lerResultado() { try { var t = localStorage.getItem("tm3d:resultado:" + pedido.id); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
    function ouvir(e) {
      if (e.origin !== global.location.origin || !e.data || e.data.id !== pedido.id) return;
      if (e.source && quadro.contentWindow && e.source !== quadro.contentWindow) return;
      // com o 3D no ar, o botão de sair é o do próprio 3D (pausa): o X do TM some para não ficar por cima do placar
      if (e.data.tipo === "tm3d:pronto") { pronto = true; aviso.style.display = "none"; sair.style.display = "none"; }
      else if (e.data.tipo === "tm3d:fim") termina("fim", e.data.resultado || lerResultado());
      else if (e.data.tipo === "tm3d:sair") termina("sair");
    }
    function termina(como, res) {
      if (acabou) return;
      acabou = true;
      clearTimeout(espera);
      fecha3d();
      try { localStorage.removeItem("tm3d:pedido:" + pedido.id); localStorage.removeItem("tm3d:resultado:" + pedido.id); } catch (e) {}
      if (como === "fim" && res) fns.fim(res); else fns.sair();
    }
    global.addEventListener("message", ouvir);
    ativo = { tela: tela, ouvir: ouvir };
  }
  function fecha3d() {
    if (!ativo) return;
    global.removeEventListener("message", ativo.ouvir);
    try { ativo.tela.remove(); } catch (e) {}
    document.body.classList.remove("tm3d-aberto");
    ativo = null;
  }

  /* ---------- escolha antes do jogo: Jogar em 3D ou Simular ---------- */
  function escolha(cfg, simular, tres) {
    var sempre = false;
    var ov = el("div", { class: "ut-sheet tm3d-escolha" });
    var caixa = el("label", { class: "tm3d-sempre" }, [
      el("input", { type: "checkbox", on: { change: function (e) { sempre = !!e.target.checked; } } }),
      el("span", { text: "Lembrar minha escolha (dá para mudar em Config)" })
    ]);
    function vai(fn, pref) { return function () { if (sempre) salvaPreferencia(pref); fecha(); fn(); }; }
    var a = cfg.teamA || {}, b = cfg.teamB || {};
    ov.appendChild(el("div", { class: "ut-sheet-in" }, [
      el("div", { class: "ut-sheet-h" }, [el("span", { text: cfg.title || "Partida" }), el("button", { class: "ut-x", text: "✕", on: { click: function () { fecha(); simular(); } } })]),
      el("div", { class: "tm3d-confronto", text: (a.name || "Casa") + " × " + (b.name || "Fora") }),
      el("button", { class: "tm3d-op tres", type: "button", on: { click: vai(tres, "3d") } }, [
        el("span", { class: "tm3d-op-ic" }, [TM.ic("gamepad-2")]),
        el("span", { class: "tm3d-op-i" }, [el("b", { text: "Jogar em 3D" }), el("span", { text: cfg.controle && cfg.controle.tmId ? "Você controla só o seu jogador, no estádio 3D." : "Você controla o seu time, no estádio 3D." })])
      ]),
      el("button", { class: "tm3d-op", type: "button", on: { click: vai(simular, "simular") } }, [
        el("span", { class: "tm3d-op-ic" }, [TM.ic("fast-forward")]),
        el("span", { class: "tm3d-op-i" }, [el("b", { text: "Simular" }), el("span", { text: "Acompanhe lance a lance, como sempre." })])
      ]),
      caixa
    ]));
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("show"); });
    function fecha() { ov.classList.remove("show"); setTimeout(function () { ov.remove(); }, 200); }
  }

  /* ---------- jogar uma partida do TM em 3D ----------
     cfg = o mesmo cfg do TM.matchview.play (teamA, teamB, result, pauseSide, formation,
     formationB, title, controle?). Ao fim, o result vira o do 3D e a tela de jogo do TM
     mostra o placar na hora (velocidade instantânea), seguindo o fluxo normal do modo. */
  function novoPedido(o) {
    return {
      v: 1, id: "j" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      titulo: o.title || "Partida", origem: (TM.ui.current && TM.ui.current()) || "",
      home: time3d(o.teamA, o.formation), away: time3d(o.teamB, o.formationB),
      userSide: o.userSide === 1 ? "away" : "home", controle: o.controle || null
    };
  }
  /* partida 3D fora da tela de jogo do TM (ex.: Rumo ao Estrelato, que tem a própria súmula):
     o = { teamA, teamB, formation?, formationB?, userSide: 0|1, controle?: { tmId }, title }
     fns.fim(resultado3d) | fns.sair() (voltou sem jogar: o modo simula como sempre) */
  function jogar3d(o, fns) {
    abre3d(novoPedido(o), { fim: fns.fim, sair: fns.sair,
      falhou: function (msg) { TM.ui.toast(msg || "O 3D não abriu: partida simulada.", "alerta"); fns.sair(); } });
  }
  function jogarCfg(screen, cfg, playOrig) {
    var pedido = novoPedido({ teamA: cfg.teamA, teamB: cfg.teamB, formation: cfg.formation, formationB: cfg.formationB,
      userSide: cfg.pauseSide === 1 ? 1 : 0, controle: cfg.controle, title: cfg.title });
    abre3d(pedido, {
      fim: function (r3) {
        aplicaResultado(cfg.result, r3, cfg.teamA, cfg.teamB);
        var s2 = Object.assign({}, cfg.settings || TM.storage.settings(), { matchSpeed: "instantaneo" });
        playOrig(screen, Object.assign({}, cfg, { settings: s2, ja3d: true }));
      },
      sair: function () { TM.ui.toast("Partida simulada.", "ok"); playOrig(screen, Object.assign({}, cfg, { ja3d: true })); },
      falhou: function (msg) { TM.ui.toast(msg || "O 3D não abriu: partida simulada.", "alerta"); playOrig(screen, Object.assign({}, cfg, { ja3d: true })); }
    });
  }
  // o 3D entra em toda partida que tem um lado do jogador (pauseSide) e não é online contra outra pessoa
  function ofereceEm(cfg) {
    if (!cfg || cfg.ja3d || cfg.sem3d || cfg.pauseSide == null || !cfg.teamA || !cfg.teamB || !cfg.result) return false;
    if (cfg.result.penaltyOnly) return false;
    return webgl();
  }

  if (TM.matchview && TM.matchview.play) {
    var playOrig = TM.matchview.play;
    TM.matchview.play = function (screen, cfg) {
      if (!ofereceEm(cfg)) return playOrig(screen, cfg);
      var pref = preferencia();
      if (pref === "simular") return playOrig(screen, cfg);
      if (pref === "3d") return jogarCfg(screen, cfg, playOrig);
      // a escolha aparece por cima da tela atual; a tela de jogo só é montada depois
      escolha(cfg, function () { playOrig(screen, cfg); }, function () { jogarCfg(screen, cfg, playOrig); });
    };
  }

  api.disponivel = webgl;
  api.preferencia = preferencia;
  api.salvaPreferencia = salvaPreferencia;
  api.time3d = time3d;
  api.aplicaResultado = aplicaResultado;
  api.jogarCfg = jogarCfg;
  api.jogar3d = jogar3d;
  api.escolha = escolha;
  api.fechar = fecha3d;
  TM.tm3d = api;
})(window);
