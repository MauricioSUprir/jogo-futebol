/* ================= TOTAL MATCH — Modo Leilão: as telas ================= */
/* Plano: PLANO-LEILAO.md §2 (as telas, a barra da sessão, a carta, o campinho), §2.4 (a aba Leilão: a barra de lance, o
   relógio, o retorno do lance, a acessibilidade, a tela acesa), §2.5 (a Escalação) e §3.8 (o atalho). As telas só LEEM a
   sessão (TM.leilaoSessao: `ver()`) e chamam as ações dela; nenhuma regra mora aqui.
   Rotas: leilao (Entrada), leilao-criar (o Treino: você + 1 a 7 bots), leilao-lote (a aba Leilão), leilao-escalacao e
   leilao-camp (o campeonato é o PR 3: "em breve"). O online (criar sala, entrar com código, o saguão) é o PR 2: a Entrada
   mostra "em breve".
   No treino, sair das telas da sala (ir ao menu) SEGURA o relógio (sessão.segurar("tela")), como a página escondida: a
   pessoa não perde lotes. A região ao vivo do leitor de tela é a #lei-vivo do index.html (uma só, no HTML inicial).
   Ganchos de teste: TM.leilaoTela.anuncios() (o que foi para a região ao vivo). */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var doc = global.document;

  function el(tag, opts, kids) { return TM.ui.el(tag, opts, kids); }
  function ic(n) { return TM.ic ? TM.ic(n) : el("span"); }
  function L() { return TM.leilao; }
  function SS() { return TM.leilaoSessao; }
  function sessao() { return (SS() && SS().atual()) || null; }
  function UT() { return (TM.ut && TM.ut._i) || null; }
  function rs(v) { return "R$ " + Math.max(0, Math.round(+v || 0)); }
  function ler(k, p) { try { var v = TM.storage.read(k, p); return v == null ? p : v; } catch (e) { return p; } }
  function gravar(k, v) { try { TM.storage.write(k, v); } catch (e) {} }
  function agoraReal() { return Date.now(); }

  var ROTAS_SALA = { "leilao-lote": 1, "leilao-escalacao": 1, "leilao-camp": 1 };
  var GRUPO_CURTO = { GK: "GOL", DF: "DEF", MF: "MEI", FW: "ATA" };
  var GRUPO_NOME = { GK: "Goleiro", DF: "Defensor", MF: "Meio-campo", FW: "Atacante" };
  var GRUPO_FALTA = { GK: " goleiro", DF: " na defesa", MF: " no meio-campo", FW: " no ataque" };
  var FUNCAO = {
    GOL: "Goleiro", ZAG: "Zagueiro", LD: "Lateral direito", LE: "Lateral esquerdo", VOL: "Volante", MC: "Meio-campista",
    MEI: "Meia", MD: "Meia direita", ME: "Meia esquerda", PD: "Ponta direita", PE: "Ponta esquerda", CA: "Centroavante",
    SA: "Segundo atacante"
  };
  var FORMA_NOME = { "5-4-1": "Retranca", "4-2-4": "Tudo ou nada" };
  var ABAS = [
    { rota: "leilao-lote", nome: "Leilão", icone: "gavel" },
    { rota: "leilao-escalacao", nome: "Escalação", icone: "shirt" },
    { rota: "leilao-camp", nome: "Campeonato", icone: "trophy" }
  ];
  var C_ANEL = 2 * Math.PI * 44;      // o anel do relógio: r = 44 no viewBox 100
  var NS = "http://www.w3.org/2000/svg";

  var VIEW = {
    screen: null, rota: null, raf: 0, tick: null, desliga: [], partes: null, V: null, abas: null, avisoSala: null,
    conf: { ate: 0, seq: -1, valor: 0 },   // o "Tudo" de dois toques: o 1º vira "Confirmar R$ X" por 2 s
    enviando: null, msg: null, msgAte: 0, folha: null, sessaoLigada: null, selVaga: -1, criando: false,
    abertos: { time: false, tecnicos: false, proximos: false }, anuncios: [], anunciado5: -1
  };

  function funcaoDe(r) { return (r && (FUNCAO[r.pos2] || GRUPO_NOME[r.pos])) || ""; }
  function gruposDe(r) { return (r && r.grupos && r.grupos.length ? r.grupos : [r && r.pos]).filter(Boolean); }
  function nomeForma(f) { return FORMA_NOME[f] ? f + " · " + FORMA_NOME[f] : f; }

  /* ---------- o clube e a seleção do retrato (como no mundo-base) ---------- */
  // só os clubes do mundo-base ficam guardados (o mundo inteiro tem ~3,7 MB), e só enquanto a pessoa está na sala
  var _base = { ed: null, clubes: null };
  function clubesBase() {
    var ed = TM.storage.edition();
    if (_base.ed !== ed || !_base.clubes) { _base.ed = ed; _base.clubes = TM.data.mundoBase().clubsById; }
    return _base.clubes;
  }
  // o clube criado e o Editor mudam o clube no mundo da carreira: a carta mostra o do mundo-base (o dos lotes)
  function clube(id) {
    if (!id) return null;
    var c = null; try { c = TM.data.club(id); } catch (e) { c = null; }
    if (c && (c.custom || c.viverde || c.crestData)) { try { c = clubesBase()[id] || c; } catch (e) {} }
    return c || null;
  }
  function nacao(id) { try { return id ? TM.data.nation(id) : null; } catch (e) { return null; } }

  /* ---------- a carta (a do Ultimate, montada do retrato) e o escudo desenhado ---------- */
  function dadosCarta(r) {
    var u = UT(), ov = Math.round(r.overall || 0), p2 = r.pos2 || GRUPO_CURTO[r.pos];
    return {
      card: null, ov: ov, pos: r.pos, pos2: p2, posicoes: [p2], name: r.name, rar: u && u.rarOf ? u.rarOf(ov) : "b", ver: "base",
      evo: null, club: clube(r.clubId), lg: null, nat: r.nationId, attrs: r.attrs || {},
      p: { id: r.id, name: r.name, clubId: r.clubId, homeClubId: r.homeClubId, pos: r.pos, pos2: r.pos2, overall: ov, nationId: r.nationId, number: r.number }
    };
  }
  function cartaEl(r, cls, role) {
    if (!TM.ut || !TM.ut.cardEl) return el("div", { class: "lei-carta-reserva", text: r ? r.name : (role || "") });
    if (!r) return TM.ut.cardEl(null, { cls: cls, role: role });
    var c = TM.ut.cardEl(dadosCarta(r), { cls: cls });
    c.removeAttribute("title");
    return c;
  }
  function escudo(cl, cls) {
    var u = UT(); cl = cl || {};
    if (u && u.escudoEl && u.escudoCfg) return u.escudoEl(u.escudoCfg({ escudo: cl.escudo }), cl.cor || "#22c55e", cl.sigla || "", "lei-esc" + (cls ? " " + cls : ""));
    return el("span", { class: "lei-esc lei-esc-txt" + (cls ? " " + cls : ""), text: cl.sigla || "" });
  }

  /* ---------- som (Web Audio, liberado no 1º toque) e vibração ---------- */
  var SONS = {
    meu: [[660, 0, 0.06], [990, 0.06, 0.1]],
    superado: [[523, 0, 0.1, "triangle"], [392, 0.1, 0.16, "triangle"]],
    compra: [[659, 0, 0.08], [880, 0.08, 0.08], [1319, 0.16, 0.18]],
    tique: [[988, 0, 0.05]],
    fim: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.22]]
  };
  var Som = {
    ctx: null,
    ligado: function () { return ler("leilao:som", true) !== false; },
    alterna: function () { gravar("leilao:som", !this.ligado()); },
    destrava: function () {
      if (!this.ligado()) return;
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        if (!this.ctx) this.ctx = new AC();
        if (this.ctx.state === "suspended") this.ctx.resume();
      } catch (e) {}
    },
    toca: function (tipo) {
      var c = this.ctx, notas = SONS[tipo];
      if (!notas || !c || c.state !== "running" || !this.ligado()) return;
      try {
        var t0 = c.currentTime;
        notas.forEach(function (n) {
          var o = c.createOscillator(), g = c.createGain(), ini = t0 + n[1], fim = ini + n[2];
          o.type = n[3] || "sine"; o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, ini);
          g.gain.exponentialRampToValueAtTime(0.1, ini + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, fim);
          o.connect(g); g.connect(c.destination); o.start(ini); o.stop(fim + 0.02);
        });
      } catch (e) {}
    }
  };
  function vibra(p) { try { if (Som.ligado() && global.navigator && global.navigator.vibrate) global.navigator.vibrate(p); } catch (e) {} }
  doc.addEventListener("pointerdown", function () { if (sessao()) Som.destrava(); }, true);

  /* ---------- a região ao vivo (uma só, no index.html) ---------- */
  // o que chega junto vira UMA fala (o "Vendido para X por R$ Y" e o lote novo saem da mesma conferência: trocado no mesmo
  // quadro, o leitor de tela nunca ouvia a venda) e cada fala fica pelo menos VIVO_MIN ms na região antes da próxima
  var VIVO_MIN = 1200;
  var _vivo = { fila: [], h: null, ultima: 0 };
  var _lider = { t: 0, pend: null, h: null };
  function anuncia(txt) {
    if (!txt) return;
    VIEW.anuncios.push(txt); if (VIEW.anuncios.length > 40) VIEW.anuncios.shift();
    _vivo.fila.push(txt);
    if (!_vivo.h) _vivo.h = setTimeout(falaVivo, Math.max(40, _vivo.ultima + VIVO_MIN - agoraReal()));
  }
  function falaVivo() {
    _vivo.h = null;
    // (com o relógio acelerado dos testes chegam muitas: só as 4 últimas)
    var r = doc.getElementById("lei-vivo"), txt = _vivo.fila.slice(-4).join(". ");
    _vivo.fila = [];
    if (!r || !txt) return;
    _vivo.ultima = agoraReal();
    // a mesma fala de novo ("Sem lance" seguido): esvazia e escreve no tique seguinte, senão o leitor não repete
    if (r.textContent === txt) { r.textContent = ""; setTimeout(function () { r.textContent = txt; }, 40); }
    else r.textContent = txt;
  }
  // o líder no máximo a cada 2 s (com bots dando lance a todo instante, falar cada um afoga o resto)
  function anunciaLider(txt) {
    var agora = agoraReal(), espera = _lider.t + 2000 - agora;
    _lider.pend = txt;
    if (espera <= 0) { _lider.t = agora; _lider.pend = null; anuncia(txt); return; }
    if (!_lider.h) _lider.h = setTimeout(function () {
      _lider.h = null;
      if (_lider.pend && naSala()) { _lider.t = agoraReal(); anuncia(_lider.pend); }
      _lider.pend = null;
    }, espera);
  }

  /* ---------- a tela acesa durante o leilão (Wake Lock, pedida de novo a cada volta à aba) ---------- */
  var Wake = {
    s: null, quer: false, pedindo: false,
    pede: function () {
      var W = this, nav = global.navigator;
      W.quer = true;
      if (!nav || !nav.wakeLock || W.s || W.pedindo || doc.hidden) return;
      W.pedindo = true;
      nav.wakeLock.request("screen").then(function (s) {
        W.pedindo = false;
        if (!W.quer) { try { s.release(); } catch (e) {} return; }
        W.s = s;
        s.addEventListener("release", function () { if (W.s === s) W.s = null; });
      }, function () { W.pedindo = false; });
    },
    solta: function () { this.quer = false; var s = this.s; this.s = null; if (s) { try { s.release(); } catch (e) {} } }
  };
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden && Wake.quer) Wake.pede(); });

  /* ---------- a vida das telas da sala ---------- */
  function naSala() { try { return !!ROTAS_SALA[TM.ui.current()]; } catch (e) { return false; } }
  function desligaTela() {
    try { doc.documentElement.style.scrollPaddingBottom = ""; } catch (e) {}
    VIEW.desliga.forEach(function (f) { try { f(); } catch (e) {} });
    VIEW.desliga = []; VIEW.tick = null; VIEW.partes = null; VIEW.abas = null; VIEW.avisoSala = null;
  }
  function entrarNaSala(screen, rota, S) {
    desligaTela();
    fechaFolha();
    VIEW.screen = screen; VIEW.rota = rota;
    ligarSessao(S);
    if (S.segurar) S.segurar("tela", false);
    var off = S.aoMudar(function () { atualiza(); });
    VIEW.desliga.push(off);
    // a tela mudou de tamanho: o espaço do fim da página e as cartas do campinho afastadas de novo (nada sobre nada)
    function redim() {
      ajustaEspaco();
      var u = UT();
      if (u && u.separaCampo && VIEW.screen) [].forEach.call(VIEW.screen.querySelectorAll(".lei-pitch"), function (pt) { u.separaCampo(pt); });
    }
    global.addEventListener("resize", redim);
    VIEW.desliga.push(function () { global.removeEventListener("resize", redim); });
    if (!VIEW.raf) VIEW.raf = global.requestAnimationFrame(laco);
  }
  // a pessoa saiu das telas da sala (o menu, a Entrada…): o treino para até ela voltar
  function saiuDaSala() {
    desligaTela();
    fechaFolha();
    VIEW.screen = null; VIEW.rota = null;
    _base.clubes = null;
    Wake.solta();
    var S = sessao();
    if (S && S.segurar) S.segurar("tela", true);
  }
  function laco() {
    VIEW.raf = 0;
    if (!VIEW.screen) return;
    if (!VIEW.screen.isConnected || !sessao()) { saiuDaSala(); return; }
    try { if (VIEW.tick) VIEW.tick(sessao()); } catch (e) { if (global.console) console.error(e); }
    if (VIEW.msgAte && agoraReal() > VIEW.msgAte) { VIEW.msgAte = 0; VIEW.msg = null; atualizaBarra(VIEW.V); }
    if (VIEW.conf.ate && agoraReal() > VIEW.conf.ate) { VIEW.conf = { ate: 0, seq: -1, valor: 0 }; atualizaBarra(VIEW.V); }
    VIEW.raf = global.requestAnimationFrame(laco);
  }
  function atualiza() {
    var S = sessao();
    if (!S || !VIEW.screen || !VIEW.screen.isConnected) return;
    var V = VIEW.V = S.ver();
    if (V.estado === "leilao" && !V.alterada && !V.soOlhar) Wake.pede(); else Wake.solta();
    atualizaAbas(V);
    poeAvisoSala(V);
    if (VIEW.rota === "leilao-lote") atualizaLote(S, V);
    else if (VIEW.rota === "leilao-escalacao") atualizaEscalacao(S, V);
    else if (VIEW.rota === "leilao-camp") atualizaCamp(S, V);
    if (VIEW.folha && VIEW.folha.vivo) { TM.ui.clear(VIEW.folha.corpo); VIEW.folha.monta(VIEW.folha.corpo); }
  }

  // os eventos da sessão que falam com a pessoa (som, vibração, leitor de tela): ligados uma vez por sessão
  function ligarSessao(S) {
    if (VIEW.sessaoLigada === S) return;
    VIEW.sessaoLigada = S;
    function nomeTec(t) { var V = S.ver(), x = V.tecnicos[t]; return x ? (x.eu ? "você" : x.nome) : ""; }
    S.on("lote", function () { if (naSala()) anunciaLote(S.ver()); });
    S.on("lance", function (e) {
      if (!naSala()) return;
      if (!e.eu) anunciaLider(nomeTec(e.t) + " lidera com " + rs(e.valor));
    });
    S.on("superado", function (e) {
      if (!naSala()) return;
      Som.toca("superado"); vibra(90);
      anuncia("Você foi superado: " + rs(e.valor));
      var P = VIEW.partes;
      if (P && P.placar) { P.placar.classList.remove("lampejo"); void P.placar.offsetWidth; P.placar.classList.add("lampejo"); }
    });
    S.on("vendido", function (e) {
      if (!naSala()) return;
      if (e.eu) { Som.toca("compra"); vibra([40, 60, 40]); anuncia("Vendido para você por " + rs(e.preco)); }
      else anuncia("Vendido para " + nomeTec(e.t) + " por " + rs(e.preco));
    });
    S.on("semLance", function () { if (naSala()) anuncia("Sem lance"); });
    S.on("formacao", function (e) {
      if (naSala()) { mostraMsg("Formação agora é " + e.para + " (não cabia na " + e.de + ")", "alerta", 4000); anuncia("Sua formação passou para " + e.para + ": o time não cabia mais na " + e.de); }
    });
    S.on("fim", function () { if (naSala()) { Som.toca("fim"); anuncia("O leilão acabou"); } });
    S.on("estado", function (e) {
      // o leilão acabou: da aba Leilão vai sozinho para a Escalação (depois do "Vendido…")
      if (e.estado === "escalacao") setTimeout(function () { if (sessao() === S && TM.ui.current() === "leilao-lote") TM.ui.go("leilao-escalacao"); }, 1800);
    });
    S.on("alterada", function () { if (naSala()) TM.ui.toast("A sala foi alterada fora das regras: o leilão parou.", "erro"); });
  }

  /* ---------- a moldura das telas da sala: topo, abas e a barra da sessão ---------- */
  function subtitulo(V) { return (V.treino ? "Treino" : "Sala " + V.codigo) + (V.liga && V.liga.nome ? " · " + V.liga.nome : ""); }
  function moldura(screen, rota) {
    screen.classList.add("lei-screen", "lei-na-sala");
    var S = sessao();
    if (!S) { semSala(screen); return null; }
    entrarNaSala(screen, rota, S);
    var V = VIEW.V = S.ver();
    var voltar = el("button", { class: "tb-back", type: "button", "aria-label": "Voltar ao início do Leilão", title: "Voltar", on: { click: function () { TM.ui.go("leilao"); } } }, [ic("chevron-left")]);
    var cab = el("div", { class: "lei-cab" }, [
      el("div", { class: "lei-topo" }, [voltar, el("div", { class: "lei-tit" }, [el("h1", { text: "Leilão" }), el("span", { class: "lei-tit-sub", text: subtitulo(V) })])]),
      barraSessao(S),
      abasEl(V, rota)
    ]);
    screen.appendChild(cab);
    VIEW.avisoSala = el("div", { class: "lei-aviso-sala", role: "note", hidden: "hidden" });
    screen.appendChild(VIEW.avisoSala);
    poeAvisoSala(V);
    var corpo = el("div", { class: "lei-corpo" });
    screen.appendChild(corpo);
    if (V.estado === "leilao" && !V.alterada && !V.soOlhar) Wake.pede(); else Wake.solta();
    return { S: S, V: V, corpo: corpo };
  }
  function poeAvisoSala(V) {
    var a = VIEW.avisoSala; if (!a) return;
    var txt = V.alterada ? "A sala foi alterada fora das regras: o leilão parou."
      : V.soOlhar ? "Esta sala é de outra versão das regras: só dá para olhar. Atualize a página."
      : null;
    if (!txt) { a.hidden = true; return; }
    a.hidden = false;
    if (a.textContent !== txt) { TM.ui.clear(a); a.appendChild(el("span", { class: "lei-aviso-ic" }, [ic("triangle-alert")])); a.appendChild(el("span", { text: txt })); }
  }
  function abaFeita(V, rota) {
    if (rota === "leilao-lote") return V.estado === "escalacao" || V.estado === "camp";
    if (rota === "leilao-escalacao") return V.estado === "camp";
    return false;
  }
  function abasEl(V, rota) {
    var nav = el("nav", { class: "lei-abas", "aria-label": "Etapas da sala" });
    ABAS.forEach(function (a) {
      var on = a.rota === rota, feita = abaFeita(V, a.rota);
      var b = el("button", { class: "lei-aba" + (on ? " on" : "") + (feita ? " feita" : ""), type: "button", data: { rota: a.rota, feita: feita ? "1" : "" },
        on: { click: function () { if (!on) TM.ui.go(a.rota); } } }, [
        el("span", { class: "lei-aba-ic" }, [ic(feita ? "circle-check" : a.icone)]), el("span", { class: "lei-aba-lb", text: a.nome })
      ]);
      if (on) b.setAttribute("aria-current", "page");
      nav.appendChild(b);
    });
    VIEW.abas = nav;
    return nav;
  }
  function atualizaAbas(V) {
    if (!VIEW.abas) return;
    [].forEach.call(VIEW.abas.children, function (b) {
      var feita = abaFeita(V, b.dataset.rota);
      if (feita === (b.dataset.feita === "1")) return;
      b.dataset.feita = feita ? "1" : "";
      b.classList.toggle("feita", feita);
      var a = ABAS.filter(function (x) { return x.rota === b.dataset.rota; })[0], i = b.querySelector(".lei-aba-ic");
      TM.ui.clear(i); i.appendChild(ic(feita ? "circle-check" : a.icone));
    });
  }
  function barraSessao(S) {
    function bt(icone, curto, longo, fn, cls) {
      return el("button", { class: "lei-sb" + (cls ? " " + cls : ""), type: "button", "aria-label": longo, title: longo, on: { click: fn } }, [
        el("span", { class: "lei-sb-ic" }, [ic(icone)]),
        el("span", { class: "lei-sb-lb" }, [el("span", { class: "lei-curto", text: curto }), el("span", { class: "lei-longo", text: longo })])
      ]);
    }
    var som = bt(Som.ligado() ? "volume-2" : "volume-x", "Som", "Som", function () {
      Som.alterna(); Som.destrava();
      var lig = Som.ligado(), i = som.querySelector(".lei-sb-ic");
      som.setAttribute("aria-pressed", lig ? "true" : "false");
      som.title = lig ? "Som ligado" : "Som desligado";
      TM.ui.clear(i); i.appendChild(ic(lig ? "volume-2" : "volume-x"));
    });
    som.setAttribute("aria-pressed", Som.ligado() ? "true" : "false");
    som.title = Som.ligado() ? "Som ligado" : "Som desligado";
    return el("div", { class: "lei-sessao", role: "toolbar", "aria-label": "Sala" }, [
      bt("log-out", "Sair", "Sair da sala", function () { confirmaSair(S); }, "sair"),
      som,
      bt("info", "Regras", "Como funciona", function () { folhaComoFunciona(); }),
      bt("users", "Técnicos", "Participantes", function () { folhaParticipantes(); }),
      bt("receipt", "Vendas", "Vendas", function () { folhaVendas(-1); })
    ]);
  }
  function confirmaSair(S) {
    TM.ui.confirm("Sair da sala?", S.treino ? "O treino acaba e é apagado deste aparelho." : "O seu clube passa até o fim do leilão.", "Sair da sala", function () {
      fechaFolha();
      S.sair().then(function () { saiuDaSala(); TM.ui.go("leilao"); });
    }, true);
  }
  function semSala(screen) {
    screen.appendChild(TM.ui.topbar("Leilão", function () { TM.ui.go("leilao"); }));
    var guardadas = SS() ? SS().salas() : [];
    var corpo = el("div", { class: "panel-narrow" });
    corpo.appendChild(el("div", { class: "next-match lei-cartao" }, [
      el("div", { class: "nm-label", text: "Nenhuma sala aberta" }),
      el("p", { class: "intro-text", text: guardadas.length ? "Você tem um treino guardado neste aparelho." : "Comece um treino contra os bots no início do Leilão." }),
      el("div", { class: "lei-acoes" }, [
        guardadas.length ? botao("Continuar o treino", function () { continuar(guardadas[0].codigo); }, "btn primary") : null,
        botao("Ir ao Leilão", function () { TM.ui.go("leilao"); }, guardadas.length ? "btn" : "btn primary")
      ])
    ]));
    screen.appendChild(corpo);
  }
  function botao(rotulo, fn, cls, icone) {
    var b = el("button", { class: cls || "btn", type: "button", on: { click: fn } }, icone ? [el("span", { class: "lei-bt-ic" }, [ic(icone)]), el("span", { text: rotulo })] : [rotulo]);
    return b;
  }
  function rotaDoEstado(V) { return V.estado === "escalacao" ? "leilao-escalacao" : V.estado === "camp" ? "leilao-camp" : "leilao-lote"; }
  function continuar(codigo) {
    var S = sessao();
    if (S && S.codigo === codigo) { TM.ui.go(rotaDoEstado(S.ver())); return; }
    SS().abrir(codigo).then(function (S2) { TM.ui.go(rotaDoEstado(S2.ver())); }, function (e) {
      if (global.console) console.error(e);
      TM.ui.toast("Não deu para abrir essa sala.", "erro");
    });
  }

  /* ---------- a aba Leilão ---------- */
  function textoLote(l) { return (l.fase === "rep" ? "Repescagem " : "Jogador ") + l.ordem + " de " + l.total; }
  // o lote novo para o leitor de tela, uma vez por lote (pelo evento e ao entrar na aba: o 1º abre antes de a tela existir)
  function anunciaLote(V) {
    var l = V && V.lote; if (!l || VIEW.anunciadoSeq === l.seq) return;
    VIEW.anunciadoSeq = l.seq;
    anuncia(textoLote(l) + ": " + l.retrato.name + ", " + funcaoDe(l.retrato) + ", nota " + l.retrato.overall);
  }
  TM.ui.register("leilao-lote", function (screen) {
    var M = moldura(screen, "leilao-lote"); if (!M) return;
    M.corpo.classList.add("lei-corpo-lote");
    VIEW.partes = { corpo: M.corpo, modo: null, seq: null };
    VIEW.partes.bar = barraLance(screen);
    VIEW.tick = tickLote;
    atualizaLote(M.S, M.V);
  });
  function atualizaLote(S, V) {
    var P = VIEW.partes; if (!P) return;
    var modo = V.alterada ? "parada" : V.estado === "leilao" ? (V.lote ? "lote" : "espera") : "fim";
    if (modo !== P.modo) { P.modo = modo; P.seq = null; montaCorpoLote(S, V); }
    if (modo === "lote") {
      if (V.lote.seq !== P.seq) { P.seq = V.lote.seq; trocaLote(S, V); }
      atualizaPlacar(V);
      atualizaMeu(V);
      atualizaTecnicos(V);
      atualizaTime(S, V);
    }
    atualizaBarra(V);
  }
  function montaCorpoLote(S, V) {
    var P = VIEW.partes, c = P.corpo;
    TM.ui.clear(c);
    ["cab", "palco", "cartaBox", "vendido", "placar", "relogio", "arco", "num", "lider", "valor", "hist", "info", "meu", "tec", "time", "prox", "espaco"].forEach(function (k) { P[k] = null; });
    if (P.modo === "espera" || P.modo === "parada") {
      c.appendChild(el("div", { class: "lei-caixa lei-espera" }, [el("p", { class: "intro-text", text: P.modo === "parada" ? "O leilão parou." : V.fase === "fim" ? "Fechando o leilão…" : "Preparando o primeiro jogador…" })]));
      return;
    }
    if (P.modo === "fim") { montaFimLeilao(S, V); return; }
    var a = el("div", { class: "lei-col-a" }), b = el("div", { class: "lei-col-b" });
    P.cab = el("div", { class: "lei-lote-cab" });
    P.cartaBox = el("div", { class: "lei-carta-box" });
    P.vendido = el("div", { class: "lei-vendido", hidden: "hidden" });
    var svg = doc.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("aria-hidden", "true");
    var fundo = doc.createElementNS(NS, "circle"); fundo.setAttribute("class", "lei-rel-fundo"); fundo.setAttribute("cx", "50"); fundo.setAttribute("cy", "50"); fundo.setAttribute("r", "44");
    P.arco = doc.createElementNS(NS, "circle"); P.arco.setAttribute("class", "lei-rel-arco"); P.arco.setAttribute("cx", "50"); P.arco.setAttribute("cy", "50"); P.arco.setAttribute("r", "44");
    P.arco.setAttribute("stroke-dasharray", C_ANEL.toFixed(2));
    svg.appendChild(fundo); svg.appendChild(P.arco);
    P.num = el("span", { class: "lei-rel-num" });
    P.relogio = el("div", { class: "lei-relogio", role: "timer", "aria-label": "Tempo do lote" }, [svg, P.num]);
    P.lider = el("div", { class: "lei-lider" });
    P.valor = el("div", { class: "lei-valor-atual" });
    P.hist = el("ol", { class: "lei-hist", "aria-label": "Últimos lances" });
    P.placar = el("div", { class: "lei-placar" }, [P.relogio, P.lider, P.valor, P.hist]);
    P.palco = el("div", { class: "lei-palco" }, [P.cartaBox, P.placar, P.vendido]);
    P.info = el("div", { class: "lei-info" });
    a.appendChild(P.cab); a.appendChild(P.palco); a.appendChild(P.info);
    P.meu = montaMeu(V);
    b.appendChild(P.meu);
    P.time = bloco("time", "Seu time", "shirt");
    P.tec = bloco("tecnicos", "Técnicos", "users");
    P.prox = bloco("proximos", "Próximos lotes", "list");
    b.appendChild(P.time.raiz); b.appendChild(P.tec.raiz); b.appendChild(P.prox.raiz);
    P.tecLinhas = null; P.timeChave = null;
    c.appendChild(a); c.appendChild(b);
    P.espaco = el("div", { class: "lei-espaco", "aria-hidden": "true" });
    c.appendChild(P.espaco);
  }
  // um bloco recolhível (o estado fica entre as telas; no PC começa aberto)
  function bloco(chave, titulo, icone) {
    var pc = false; try { pc = global.matchMedia("(min-width: 760px) and (min-height: 521px)").matches; } catch (e) {}
    if (VIEW.abertos[chave] == null || VIEW.abertos["_" + chave] !== pc) { VIEW.abertos[chave] = pc; VIEW.abertos["_" + chave] = pc; }
    var corpo = el("div", { class: "lei-bloco-corpo", id: "lei-bloco-" + chave });
    var info = el("span", { class: "lei-bloco-info" });
    var bt = el("button", { class: "lei-bloco-bt", type: "button", "aria-controls": "lei-bloco-" + chave, on: { click: function () {
      VIEW.abertos[chave] = !VIEW.abertos[chave]; poe();
    } } }, [el("span", { class: "lei-bloco-ic" }, [ic(icone)]), el("span", { class: "lei-bloco-tit", text: titulo }), info, el("span", { class: "lei-bloco-seta" }, [ic("chevron-down")])]);
    var raiz = el("section", { class: "lei-bloco" }, [bt, corpo]);
    function poe() {
      var ab = !!VIEW.abertos[chave];
      raiz.classList.toggle("aberto", ab); bt.setAttribute("aria-expanded", ab ? "true" : "false"); corpo.hidden = !ab;
      ajustaEspaco();
    }
    poe();
    return { raiz: raiz, corpo: corpo, info: info };
  }
  function trocaLote(S, V) {
    var P = VIEW.partes, l = V.lote, r = l.retrato;
    VIEW.conf = { ate: 0, seq: -1, valor: 0 };
    if (P.bar && P.bar.valor && doc.activeElement !== P.bar.valor) P.bar.valor.value = "";
    TM.ui.clear(P.cab);
    P.cab.appendChild(el("h2", { class: "lei-lote-n", text: textoLote(l) }));
    P.cab.appendChild(el("span", { class: "lei-lote-t", text: V.T + " técnicos · " + rs(L().SALDO) + " cada" }));
    TM.ui.clear(P.cartaBox);
    P.cartaBox.appendChild(cartaEl(r, "big"));
    anunciaLote(V);
    // o nome, a função, o clube, o país e os grupos (onde ele cabe no time)
    TM.ui.clear(P.info);
    var cl = clube(r.clubId), na = nacao(r.nationId);
    P.info.appendChild(el("div", { class: "lei-info-l1" }, [
      el("h3", { class: "lei-nome", text: r.name }),
      el("button", { class: "lei-ficha-bt", type: "button", "aria-label": "Ficha de " + r.name, on: { click: function () { folhaFicha(r); } } }, [ic("info"), el("span", { text: "Ficha" })])
    ]));
    P.info.appendChild(el("div", { class: "lei-info-l2" }, [
      el("span", { class: "lei-funcao", text: funcaoDe(r) }),
      cl ? el("span", { class: "lei-sep", text: "·" }) : null,
      cl ? el("span", { class: "lei-clube" }, [TM.img.clubImg(cl, "lei-mini-esc"), el("span", { text: cl.name })]) : null
    ]));
    P.info.appendChild(el("div", { class: "lei-info-l3" }, [
      na ? el("span", { class: "lei-pais" }, [TM.img.flagImg(na, "lei-bandeira"), el("span", { text: na.name })]) : null,
      el("span", { class: "lei-grupos", title: "Joga de " + gruposDe(r).map(function (g) { return GRUPO_NOME[g].toLowerCase(); }).join(" e ") },
        gruposDe(r).map(function (g) { return el("span", { class: "lei-gr gr-" + g, text: GRUPO_CURTO[g] }); }))
    ]));
    atualizaProximos(V);
  }
  function atualizaPlacar(V) {
    var P = VIEW.partes, l = V.lote; if (!P.placar) return;
    var lid = l.lider >= 0 ? V.tecnicos[l.lider] : null;
    var chave = (lid ? lid.t : -1) + ":" + l.valor + ":" + l.n;
    if (chave !== P.placarChave) {
      P.placarChave = chave;
      TM.ui.clear(P.lider);
      if (lid) {
        P.lider.appendChild(escudo(lid.clube, "pp"));
        P.lider.appendChild(el("span", { class: "lei-lider-nome", text: lid.eu ? "Você lidera" : lid.nome + " lidera" }));
        P.lider.classList.toggle("eu", !!lid.eu);
      } else {
        P.lider.appendChild(el("span", { class: "lei-lider-nome", text: "Sem lance" }));
        P.lider.classList.remove("eu");
      }
      P.valor.textContent = lid ? rs(l.valor) : "R$ 1";
      P.valor.classList.toggle("vazio", !lid);
      P.valor.setAttribute("aria-label", lid ? "Valor atual " + rs(l.valor) : "Lance mínimo R$ 1");
      TM.ui.clear(P.hist);
      (l.h || []).slice().reverse().forEach(function (x) {
        var t = V.tecnicos[x[0]];
        P.hist.appendChild(el("li", { class: t && t.eu ? "eu" : "" }, [el("span", { class: "lei-hist-n", text: t ? (t.eu ? "Você" : t.nome) : "?" }), el("b", { text: rs(x[1]) })]));
      });
    }
    // "Vendido para X por R$ Y" na pausa entre os lotes (o lote novo já está na tela, com os botões desligados)
    var u = V.ultimo, mostra = l.pausa && u && u.seq === l.seq - 1;
    P.vendido.hidden = !mostra;
    if (mostra) {
      var k = u.tipo + ":" + u.seq;
      if (P.vendidoChave !== k) {
        P.vendidoChave = k;
        TM.ui.clear(P.vendido);
        if (u.tipo === "vendido") {
          var t = V.tecnicos[u.t];
          if (t) P.vendido.appendChild(escudo(t.clube, "pp"));
          P.vendido.appendChild(el("span", { text: "Vendido para " + (t ? (t.eu ? "você" : t.nome) : "?") + " por " + rs(u.preco) }));
        } else P.vendido.appendChild(el("span", { text: l.fase === "rep" ? "Sem lance" : "Sem lance: vai para a repescagem" }));
      }
    }
  }
  function montaMeu(V) {
    var P = VIEW.partes, t = V.tecnicos[V.eu] || {};
    P.meuSaldo = el("span", { class: "lei-meu-saldo" });
    P.meuBarra = el("i");
    P.meuLinha = el("div", { class: "lei-meu-linha" });
    P.meuMax = el("div", { class: "lei-meu-max" });
    P.meuGr = el("div", { class: "lei-meu-gr" });
    return el("div", { class: "lei-meu lei-caixa" }, [
      el("div", { class: "lei-meu-l1" }, [
        escudo(t.clube, "p"),
        el("div", { class: "lei-meu-nome" }, [el("span", { class: "lei-meu-clube", text: (t.clube && t.clube.nome) || "Meu Clube" }), el("span", { class: "lei-voce", text: "VOCÊ" })]),
        P.meuSaldo
      ]),
      el("div", { class: "lei-meu-barra", "aria-hidden": "true" }, [P.meuBarra]),
      P.meuLinha, el("div", { class: "lei-meu-l3" }, [P.meuGr, P.meuMax])
    ]);
  }
  function atualizaMeu(V) {
    var P = VIEW.partes, t = V.tecnicos[V.eu]; if (!t || !P.meuSaldo) return;
    P.meuSaldo.textContent = rs(t.saldo);
    P.meuBarra.style.width = Math.max(0, Math.min(100, Math.round(100 * t.saldo / L().SALDO))) + "%";
    P.meuLinha.textContent = t.vagas > 0
      ? rs(t.saldo) + " para " + t.vagas + (t.vagas === 1 ? " vaga" : " vagas") + " · média de " + rs(Math.floor(t.saldo / t.vagas)) + " por vaga"
      : "Time completo: " + rs(t.saldo) + " sobrando (não vale no campeonato)";
    P.meuMax.textContent = t.vagas > 0 ? "Máximo agora " + rs(t.max) : "";
    P.meuGr.textContent = "GOL " + t.gk + " · DEF " + t.df + " · MEI " + t.mf + " · ATA " + t.fw;
  }
  function estadoTec(t) {
    if (t.lider) return ["lidera", "Lidera"];
    if (t.vagas <= 0) return ["completo", "Completo"];
    if (t.passou) return ["passou", "Passou"];
    if (t.naoPode === "goleiro") return ["nao", "Tem goleiro"];
    if (t.naoPode === "posicao") return ["nao", "Sem vaga"];
    if (t.naoPode === "max") return ["nao", "Sem saldo"];
    return ["", ""];
  }
  function atualizaTecnicos(V) {
    var P = VIEW.partes; if (!P.tec) return;
    P.tec.info.textContent = V.T + " na sala";
    if (!P.tecLinhas || P.tecLinhas.length !== V.tecnicos.length) {
      TM.ui.clear(P.tec.corpo);
      P.tecLinhas = V.tecnicos.map(function (t) {
        var linha = { saldo: el("b", { class: "lei-tec-saldo" }), n: el("span", { class: "lei-tec-n" }), est: el("span", { class: "lei-tec-est" }) };
        linha.bt = el("button", { class: "lei-tec" + (t.eu ? " eu" : ""), type: "button", "aria-label": "Ver o time de " + (t.eu ? "você" : t.nome), on: { click: function () { folhaVendas(t.t); } } }, [
          escudo(t.clube, "p"),
          el("span", { class: "lei-tec-nome" }, [el("span", { class: "lei-tec-quem", text: t.eu ? "Você" : t.nome }), el("span", { class: "lei-tec-clube", text: t.clube.nome })]),
          el("span", { class: "lei-tec-dir" }, [linha.saldo, linha.n]), linha.est
        ]);
        P.tec.corpo.appendChild(linha.bt);
        return linha;
      });
    }
    V.tecnicos.forEach(function (t, i) {
      var x = P.tecLinhas[i], e = estadoTec(t);
      x.saldo.textContent = rs(t.saldo);
      x.n.textContent = t.n + "/" + L().VAGAS;
      x.est.textContent = e[1];
      x.est.className = "lei-tec-est" + (e[0] ? " " + e[0] : "");
      x.bt.classList.toggle("lidera", !!t.lider);
    });
  }
  function atualizaProximos(V) {
    var P = VIEW.partes; if (!P.prox) return;
    TM.ui.clear(P.prox.corpo);
    P.prox.info.textContent = V.proximos.length ? String(V.proximos.length) : "";
    if (!V.proximos.length) { P.prox.corpo.appendChild(el("p", { class: "lei-vazio", text: "Nenhum lote depois deste." })); return; }
    V.proximos.forEach(function (x) {
      var r = x.retrato, cl = clube(r.clubId);
      P.prox.corpo.appendChild(el("button", { class: "lei-prox", type: "button", "aria-label": "Ficha de " + r.name, on: { click: function () { folhaFicha(r); } } }, [
        el("span", { class: "lei-gr gr-" + r.pos, text: GRUPO_CURTO[r.pos] }),
        el("span", { class: "lei-prox-nome" }, [el("span", { class: "lei-prox-n", text: r.name }), el("span", { class: "lei-prox-c", text: funcaoDe(r) + (cl ? " · " + cl.name : "") })]),
        el("b", { class: "lei-prox-ov", text: String(r.overall) })
      ]));
    });
  }
  function atualizaTime(S, V) {
    var P = VIEW.partes; if (!P.time || !V.meu) return;
    var e = V.meu.escalacao, chave = e ? e.formacao + ":" + e.tit.join(",") : "-";
    P.time.info.textContent = (V.meu.time.length) + "/" + L().VAGAS + (e ? " · " + e.formacao : "");
    if (chave === P.timeChave) return;
    P.timeChave = chave;
    TM.ui.clear(P.time.corpo);
    P.time.corpo.appendChild(campinho(S, V.eu, { cls: "lei-pitch-lote" }));
  }
  function montaFimLeilao(S, V) {
    var P = VIEW.partes, c = P.corpo, t = V.tecnicos[V.eu];
    c.appendChild(el("div", { class: "next-match lei-cartao lei-fim" }, [
      el("div", { class: "nm-label", text: "O leilão acabou" }),
      t ? el("p", { class: "intro-text", text: "Seu time tem " + t.n + " jogadores" + (t.saldo ? "; sobraram " + rs(t.saldo) + ", que não valem no campeonato." : ".") }) : null,
      el("div", { class: "lei-acoes" }, [botao("Montar a escalação", function () { TM.ui.go("leilao-escalacao"); }, "btn primary", "shirt"), botao("Ver as vendas", function () { folhaVendas(-1); }, "btn", "receipt")])
    ]));
    var lista = el("div", { class: "lei-caixa lei-fim-tecs" });
    V.tecnicos.forEach(function (x) {
      lista.appendChild(el("button", { class: "lei-tec" + (x.eu ? " eu" : ""), type: "button", "aria-label": "Ver o time de " + (x.eu ? "você" : x.nome), on: { click: function () { folhaVendas(x.t); } } }, [
        escudo(x.clube, "p"),
        el("span", { class: "lei-tec-nome" }, [el("span", { class: "lei-tec-quem", text: x.eu ? "Você" : x.nome }), el("span", { class: "lei-tec-clube", text: x.clube.nome })]),
        el("span", { class: "lei-tec-dir" }, [el("b", { class: "lei-tec-saldo", text: rs(L().SALDO - x.saldo) }), el("span", { class: "lei-tec-n", text: "gastos" })])
      ]));
    });
    c.appendChild(lista);
  }

  /* ---------- o relógio (anel pela hora da sessão; o número muda 1 vez por segundo) ---------- */
  function tickLote(S) {
    var P = VIEW.partes, V = VIEW.V, l = V && V.lote;
    if (!P || !P.arco || !l || P.modo !== "lote") return;
    var agora = S.hora(), pausa = agora < l.liberado, rest = pausa ? l.dur : Math.max(0, l.fim - agora);
    var frac = Math.max(0, Math.min(1, rest / l.dur));
    P.arco.style.strokeDashoffset = (C_ANEL * (1 - frac)).toFixed(1);
    var seg = Math.ceil(rest / 1000), est = pausa ? "pausa" : rest <= 0 ? "fechando" : "aberto";
    var k = seg + ":" + est;
    if (k !== P.relChave) {
      P.relChave = k;
      P.num.textContent = String(seg);
      var alerta = est === "aberto" && seg <= 3;
      P.relogio.classList.toggle("alerta", alerta);
      P.relogio.classList.toggle("espera", est === "pausa");
      if (alerta && V.botoes && (V.botoes["+1"].pode || l.lider === V.eu)) Som.toca("tique");
      if (est === "aberto" && seg === 5 && VIEW.anunciado5 !== l.seq) { VIEW.anunciado5 = l.seq; anuncia("5 segundos"); }
    }
    // o lote liberou ou o tempo acabou: os botões mudam (o "Fechando…" fica até o lote mudar)
    if (est !== P.estVisto) { P.estVisto = est; atualiza(); }
  }

  /* ---------- a barra de lance (fixa embaixo em todo layout) ---------- */
  function botaoLance(tipo, rotulo) {
    return el("button", { class: "lei-lb lei-lb-passo", type: "button", "aria-describedby": "lei-lance-msg", data: { tipo: tipo },
      on: { click: function () { enviaLance(tipo); } } }, [el("span", { class: "lei-lb-t", text: rotulo }), el("span", { class: "lei-lb-v" })]);
  }
  function barraLance(screen) {
    var B = {};
    B.msg = el("div", { class: "lei-lance-msg", id: "lei-lance-msg" });
    B.b1 = botaoLance("+1", "+1"); B.b5 = botaoLance("+5", "+5"); B.b10 = botaoLance("+10", "+10");
    B.tudo = el("button", { class: "lei-lb lei-lb-tudo", type: "button", "aria-describedby": "lei-lance-msg", on: { click: clicaTudo } }, [el("span", { class: "lei-lb-t", text: "Tudo" }), el("span", { class: "lei-lb-v" })]);
    B.valor = el("input", { class: "lei-valor", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "3", autocomplete: "off", enterkeyhint: "send",
      "aria-label": "Outro valor, em reais", placeholder: "Outro valor",
      on: {
        keydown: function (e) { if (e.key === "Enter") { e.preventDefault(); daLanceOutro(); } },
        input: function () { var v = B.valor.value.replace(/\D/g, "").slice(0, 3); if (v !== B.valor.value) B.valor.value = v; }
      } });
    B.dar = el("button", { class: "lei-lb lei-lb-dar", type: "button", "aria-describedby": "lei-lance-msg", on: { click: daLanceOutro } }, [el("span", { class: "lei-lb-t", text: "Dar lance" })]);
    B.passar = el("button", { class: "lei-lb lei-lb-passar", type: "button", "aria-describedby": "lei-lance-msg", on: { click: passa } }, [el("span", { class: "lei-lb-t", text: "Passar" })]);
    B.raiz = el("div", { class: "lei-lance", role: "group", "aria-label": "Dar lance" }, [
      el("div", { class: "lei-lance-in" }, [B.msg, el("div", { class: "lei-l1" }, [B.b1, B.b5, B.b10, B.tudo]), el("div", { class: "lei-l2" }, [B.valor, B.dar, B.passar])])
    ]);
    screen.appendChild(B.raiz);
    return B;
  }
  function poeBotao(b, pode, valorTxt, rotuloAria) {
    b.disabled = !pode;
    var v = b.querySelector(".lei-lb-v");
    if (v && v.textContent !== valorTxt) v.textContent = valorTxt;
    if (rotuloAria) b.setAttribute("aria-label", rotuloAria);
  }
  function atualizaBarra(V) {
    var P = VIEW.partes, B = P && P.bar; if (!B || !V) return;
    var mostra = V.estado === "leilao" && !V.alterada && !V.soOlhar && V.eu >= 0;
    B.raiz.hidden = !mostra;
    ajustaEspaco();
    if (!mostra) return;
    var b = V.botoes, l = V.lote, ocup = !!VIEW.enviando;
    if (!b || !l) {
      [B.b1, B.b5, B.b10, B.tudo, B.dar, B.passar].forEach(function (x) { x.disabled = true; });
      poeMsg(B, "Aguarde o próximo jogador", "");
      return;
    }
    [["+1", B.b1], ["+5", B.b5], ["+10", B.b10]].forEach(function (p) {
      var x = b[p[0]];
      poeBotao(p[1], x.pode && !ocup, rs(x.alvo), x.pode ? "Lance de " + rs(x.alvo) : p[0] + ": " + SS().textoMotivo(x.motivo, x));
    });
    var tu = b.tudo, conf = VIEW.conf.ate && VIEW.conf.seq === l.seq && VIEW.conf.valor === tu.alvo && tu.pode;
    B.tudo.classList.toggle("confirma", !!conf);
    B.tudo.querySelector(".lei-lb-t").textContent = conf ? "Confirmar" : "Tudo";
    poeBotao(B.tudo, tu.pode && !ocup, rs(tu.alvo), conf ? "Confirmar o lance de " + rs(tu.alvo) : tu.pode ? "Tudo: lance de " + rs(tu.alvo) + " (pede confirmação)" : "Tudo: " + SS().textoMotivo(tu.motivo, tu));
    var o = b.outro, podeOutro = o.pode && !ocup;
    B.dar.disabled = !podeOutro;
    B.valor.disabled = !(o.pode || o.motivo === "pausa");
    B.valor.placeholder = o.pode || o.motivo === "pausa" ? "Até " + rs(o.max) : "Outro valor";
    B.passar.disabled = !(b.passar.pode && !ocup);
    // a linha de cima: o retorno do último toque por 2,5 s; senão o motivo de o +1 estar apagado; senão o máximo
    if (VIEW.msg && agoraReal() < VIEW.msgAte) { poeMsg(B, VIEW.msg.txt, VIEW.msg.tipo); return; }
    var x1 = b["+1"];
    if (!x1.pode) poeMsg(B, SS().textoMotivo(x1.motivo, x1), x1.motivo === "lider" ? "ok" : x1.motivo === "tarde" || x1.motivo === "pausa" ? "" : "alerta");
    else poeMsg(B, "Seu máximo neste jogador: " + rs(x1.max), "");
  }
  function poeMsg(B, txt, tipo) {
    if (B.msg.textContent !== txt) B.msg.textContent = txt;
    var cls = "lei-lance-msg" + (tipo ? " " + tipo : "");
    if (B.msg.className !== cls) B.msg.className = cls;
  }
  function mostraMsg(txt, tipo, ms) { VIEW.msg = { txt: txt, tipo: tipo || "" }; VIEW.msgAte = agoraReal() + (ms || 2500); atualizaBarra(VIEW.V); }
  // a página termina com um espaço da altura da barra (nada fica escondido atrás dela no fim da rolagem) e o foco do
  // teclado rola a página para o botão não ficar atrás dela (scroll-padding do documento)
  function ajustaEspaco() {
    var P = VIEW.partes; if (!P || !P.espaco) return;
    var h = P.bar && !P.bar.raiz.hidden ? P.bar.raiz.offsetHeight : 0;
    var px = (h ? h + 12 : 0) + "px", raiz = doc.documentElement.style;
    if (P.espaco.style.height !== px) P.espaco.style.height = px;
    if (raiz.scrollPaddingBottom !== (h ? px : "")) raiz.scrollPaddingBottom = h ? px : "";
  }
  function enviaLance(tipo, depois) {
    var S = sessao(), V = VIEW.V;
    if (!S || VIEW.enviando || !V || !V.botoes) return;
    VIEW.enviando = String(tipo);
    atualizaBarra(V);
    S.lance(tipo).then(function (r) {
      VIEW.enviando = null;
      if (r.ok) { mostraMsg("Lance de " + rs(r.valor) + ": você lidera", "ok"); Som.toca("meu"); anuncia("Seu lance de " + rs(r.valor) + " foi aceito"); }
      else if (r.estado === "antes") { mostraMsg("Alguém chegou antes: " + rs(r.valor), "alerta"); anuncia("Alguém chegou antes: " + rs(r.valor)); }
      else if (r.estado === "fechado") mostraMsg("Esse jogador já fechou", "alerta");
      else mostraMsg(SS().textoMotivo(r.motivo, r), "erro");
      if (depois) depois(!!r.ok);
      atualiza();
    }, function (e) {
      VIEW.enviando = null;
      if (global.console) console.error(e);
      mostraMsg("Não deu para dar o lance", "erro");
      atualiza();
    });
  }
  function clicaTudo() {
    var V = VIEW.V, b = V && V.botoes && V.botoes.tudo, l = V && V.lote;
    if (!b || !b.pode || !l || VIEW.enviando) return;
    var c = VIEW.conf;
    if (c.ate && agoraReal() < c.ate && c.seq === l.seq && c.valor === b.alvo) {
      VIEW.conf = { ate: 0, seq: -1, valor: 0 };
      enviaLance("tudo");
      return;
    }
    VIEW.conf = { ate: agoraReal() + 2000, seq: l.seq, valor: b.alvo };
    mostraMsg("Toque de novo para confirmar " + rs(b.alvo), "alerta", 2000);
  }
  function daLanceOutro() {
    var V = VIEW.V, P = VIEW.partes, B = P && P.bar, b = V && V.botoes;
    if (!b || !B) return;
    var n = parseInt(B.valor.value, 10);
    if (!(n > 0)) { mostraMsg("Digite o valor do lance", "alerta"); try { B.valor.focus(); } catch (e) {} return; }
    if (!b.outro.pode) { mostraMsg(SS().textoMotivo(b.outro.motivo, b.outro), "alerta"); return; }
    if (n < b.outro.min) { mostraMsg(SS().textoMotivo("valor", { valor: b.outro.min - 1 }), "alerta"); return; }
    if (n > b.outro.max) { mostraMsg(SS().textoMotivo("max", { max: b.outro.max }), "alerta"); return; }
    enviaLance(n, function (ok) { if (ok && B.valor.isConnected) B.valor.value = ""; });
  }
  function passa() {
    var S = sessao(); if (!S || VIEW.enviando) return;
    VIEW.enviando = "passar";
    atualizaBarra(VIEW.V);
    S.passar().then(function (r) {
      VIEW.enviando = null;
      if (r.ok) { mostraMsg("Você passou neste jogador", "ok"); anuncia("Você passou neste jogador"); }
      else if (r.estado === "fechado") mostraMsg("Esse jogador já fechou", "alerta");
      else mostraMsg(SS().textoMotivo(r.motivo, r), "erro");
      atualiza();
    }, function (e) { VIEW.enviando = null; if (global.console) console.error(e); atualiza(); });
  }

  /* ---------- o campinho (o do Ultimate: .ut-pitch, .ut-slot e a carta mini) ---------- */
  // opc: { cls, troca (a escalação: tocar em dois troca as vagas), sel (a vaga marcada) }
  function campinho(S, t, opc) {
    opc = opc || {};
    var e = S.escalacao(t), f = (e && e.formacao) || "4-4-2", slots = L().slotsDe(f) || [];
    var pitch = el("div", { class: "ut-pitch lei-pitch" + (opc.cls ? " " + opc.cls : ""), role: opc.troca ? "group" : "img",
      "aria-label": "Campinho na " + f }, [el("div", { class: "ut-pmark circ" }), el("div", { class: "ut-pmark meio" }), el("div", { class: "ut-pmark area" })]);
    slots.forEach(function (slot, s) {
      var k = e && e.tit ? e.tit[s] : -1, r = k >= 0 && S.ctx ? L().retratoDe(S.ctx, k) : null, pen = (e && e.pen && e.pen[s]) || 0;
      var role = GRUPO_CURTO[slot[0]];
      var carta = cartaEl(r, "mini" + (r && pen ? " fora" : ""), role);
      var kids = [carta];
      if (r && pen) kids.push(el("span", { class: "lei-pen", text: "−" + pen, title: "Fora da função: −" + pen }));
      var at = { class: "ut-slot lei-vaga" + (opc.sel === s ? " sel" : "") + (r && pen ? " fora" : ""), style: "left:" + slot[1] + "%;top:" + slot[2] + "%", data: { vaga: String(s) } };
      if (opc.troca && r) {
        at.role = "button"; at.tabindex = "0";
        at["aria-label"] = r.name + ", " + funcaoDe(r) + ", na vaga de " + GRUPO_NOME[slot[0]].toLowerCase() + (pen ? ", fora da função (−" + pen + ")" : "") + (opc.sel === s ? ", marcado" : "");
      }
      var v = el("div", at, kids);
      if (opc.troca && r) {
        v.addEventListener("click", function () { opc.troca(s); });
        v.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); opc.troca(s); } });
      }
      pitch.appendChild(v);
    });
    var u = UT(); if (u && u.separaCampo) u.separaCampo(pitch);
    return pitch;
  }

  /* ---------- a aba Escalação ---------- */
  TM.ui.register("leilao-escalacao", function (screen) {
    var M = moldura(screen, "leilao-escalacao"); if (!M) return;
    M.corpo.classList.add("lei-corpo-esc");
    VIEW.partes = { corpo: M.corpo, chave: null };
    VIEW.selVaga = -1;
    VIEW.tick = tickEscalacao;
    atualizaEscalacao(M.S, M.V);
  });
  function atualizaEscalacao(S, V) {
    var P = VIEW.partes; if (!P) return;
    var e = V.meu && V.meu.escalacao;
    var chave = [V.estado, V.alterada, V.soOlhar, e ? e.formacao + ":" + e.tit.join(",") + ":" + e.n + ":" + e.aviso : "-", V.meu && V.meu.pronto, VIEW.selVaga].join("|");
    if (chave !== P.chave) { P.chave = chave; montaEscalacao(S, V); }
    tickEscalacao(S);
  }
  function montaEscalacao(S, V) {
    var P = VIEW.partes, c = P.corpo;
    TM.ui.clear(c);
    if (!V.meu) { c.appendChild(el("p", { class: "intro-text", text: "Você só está olhando esta sala." })); return; }
    var e = V.meu.escalacao, time = V.meu.time.map(function (x) { return x.retrato; }), cheio = e && e.n === L().VAGAS;
    var media = time.length ? Math.round(time.reduce(function (s, r) { return s + r.overall; }, 0) / time.length) : 0;
    var pen = e ? e.pen.reduce(function (s, x) { return s + (x || 0); }, 0) : 0;
    // a ordem no celular: o título, as formações, o campinho, a dica e o Pronto (no PC o campinho vai à esquerda: CSS)
    var b = c;
    b.appendChild(el("div", { class: "lei-esc-cab" }, [
      el("h2", { class: "lei-esc-tit", text: "Sua escalação" }),
      el("div", { class: "lei-esc-resumo" }, [
        el("span", { class: "lei-esc-n", text: (e ? e.n : 0) + "/" + L().VAGAS }),
        time.length ? el("span", { text: "Média " + media }) : null,
        pen ? el("span", { class: "lei-esc-pen", text: "−" + pen + " fora da função" }) : null
      ])
    ]));
    var cnt = L().contaMascaras(time);
    var seg = el("div", { class: "segmented lei-formas", role: "group", "aria-label": "Formação" });
    L().FORMACOES.forEach(function (f) {
      var cabe = L().cabeEm(cnt, f), on = e && e.formacao === f;
      var bt = el("button", { class: "seg-btn lei-forma-bt" + (on ? " active" : ""), type: "button", "aria-pressed": on ? "true" : "false",
        title: cabe ? (FORMA_NOME[f] ? FORMA_NOME[f] : "Formação " + f) : "Seu time não cabe nessa formação",
        on: { click: function () {
          if (on) return;
          S.mudarFormacao(f).then(function (r) { if (!r.ok) TM.ui.toast(SS().textoMotivo(r.motivo), "erro"); else VIEW.selVaga = -1; atualiza(); });
        } } }, [el("span", { class: "lei-forma-f", text: f }), FORMA_NOME[f] ? el("span", { class: "lei-forma-n", text: FORMA_NOME[f] }) : null]);
      bt.disabled = !cabe || V.soOlhar || !!V.alterada;
      seg.appendChild(bt);
    });
    b.appendChild(el("div", { class: "lei-caixa lei-esc-formas" }, [el("div", { class: "lei-rotulo", text: "Formação" }), seg]));
    if (e && e.aviso) b.appendChild(el("div", { class: "lei-esc-aviso", role: "note" }, [ic("triangle-alert"), el("span", { text: "O seu time não cabe na " + e.pref + ": vale a " + e.formacao + "." })]));
    // o campinho (tocar em dois troca as vagas: só com os 11)
    var campo = campinho(S, V.eu, { cls: "lei-pitch-esc", sel: VIEW.selVaga, troca: cheio && !V.soOlhar && !V.alterada ? tocaVaga : null });
    b.appendChild(el("div", { class: "lei-esc-campo" }, [campo]));
    var dica = cheio ? "Toque em dois jogadores para trocar de lugar. Cada um só entra numa vaga da posição dele; −1 e −2 marcam quem está fora da função."
      : V.estado === "leilao" ? "Durante o leilão, a formação é a sua preferência: se uma compra não couber nela, ela muda sozinha. A troca de lugar abre com os 11."
      : "Escale depois de completar os 11.";
    b.appendChild(el("p", { class: "lei-esc-dica", text: dica }));
    if (V.estado === "escalacao") {
      P.prazo = el("span", { class: "lei-esc-prazo" });
      var pronto = !!V.meu.pronto;
      b.appendChild(el("div", { class: "lei-caixa lei-esc-pronto" }, [
        P.prazo,
        botao(pronto ? "Pronto (toque para cancelar)" : "Pronto", function () {
          S.prontoEscalacao(!pronto).then(function () { atualiza(); });
        }, pronto ? "btn" : "btn primary", pronto ? "circle-check" : "check")
      ]));
    } else {
      P.prazo = null;
      if (V.estado === "camp") b.appendChild(el("div", { class: "lei-caixa lei-esc-camp" }, [
        el("p", { class: "intro-text", text: "A escalação vale para o campeonato, que chega numa próxima atualização." }),
        botao("Ver o campeonato", function () { TM.ui.go("leilao-camp"); }, "btn", "trophy")
      ]));
    }
  }
  function tocaVaga(s) {
    var S = sessao(); if (!S) return;
    if (VIEW.selVaga < 0) { VIEW.selVaga = s; atualiza(); return; }
    if (VIEW.selVaga === s) { VIEW.selVaga = -1; atualiza(); return; }
    var a = VIEW.selVaga;
    VIEW.selVaga = -1;
    S.trocar(a, s).then(function (r) {
      if (!r.ok) TM.ui.toast(SS().textoMotivo(r.motivo), "erro");
      atualiza();
    });
  }
  function tickEscalacao(S) {
    var P = VIEW.partes, V = VIEW.V;
    if (!P || !P.prazo || !V || V.estado !== "escalacao" || !V.fimEscalacao) return;
    var rest = Math.max(0, V.fimEscalacao - S.hora()), s = Math.ceil(rest / 1000);
    var txt = rest > 0 ? "A escalação fecha em " + Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2) + " (ou quando todos estiverem prontos)" : "Fechando a escalação…";
    if (P.prazo.textContent !== txt) P.prazo.textContent = txt;
  }

  /* ---------- a aba Campeonato (PR 3) ---------- */
  TM.ui.register("leilao-camp", function (screen) {
    var M = moldura(screen, "leilao-camp"); if (!M) return;
    M.corpo.classList.add("lei-corpo-camp");
    VIEW.partes = { corpo: M.corpo, chave: null };
    VIEW.tick = null;
    atualizaCamp(M.S, M.V);
  });
  function atualizaCamp(S, V) {
    var P = VIEW.partes; if (!P) return;
    if (P.chave === V.estado) return;
    P.chave = V.estado;
    TM.ui.clear(P.corpo);
    P.corpo.appendChild(el("div", { class: "next-match lei-cartao lei-embreve" }, [
      el("span", { class: "lei-embreve-ic" }, [ic("trophy")]),
      el("div", { class: "nm-label", text: "Campeonato em breve" }),
      el("p", { class: "intro-text", text: V.estado === "camp"
        ? "Seu time está pronto. O campeonato (mata-mata, pontos corridos ou os dois), com Jogar ou Simular em cada jogo, chega numa próxima atualização."
        : "Primeiro o leilão e a escalação. O campeonato (mata-mata, pontos corridos ou os dois) chega numa próxima atualização." }),
      el("div", { class: "lei-acoes" }, [
        botao("Ver a escalação", function () { TM.ui.go("leilao-escalacao"); }, "btn", "shirt"),
        V.estado === "leilao" ? botao("Voltar ao leilão", function () { TM.ui.go("leilao-lote"); }, "btn primary", "gavel") : null
      ])
    ]));
  }

  /* ---------- as folhas: Como funciona, Participantes, Vendas (o time de cada um) e a ficha ---------- */
  function folha(titulo, monta, opc) {
    opc = opc || {};
    fechaFolha();
    var antes = doc.activeElement;
    var corpo = el("div", { class: "lei-folha-corpo" });
    var fechar = el("button", { class: "lei-folha-x", type: "button", "aria-label": "Fechar", on: { click: fechaFolha } }, [ic("x")]);
    var caixa = el("div", { class: "lei-folha-in" + (opc.cls ? " " + opc.cls : ""), role: "dialog", "aria-modal": "true", "aria-label": titulo }, [
      el("div", { class: "lei-folha-cab" }, [el("h2", { class: "lei-folha-tit", text: titulo }), fechar]), corpo
    ]);
    var fundo = el("div", { class: "lei-folha" }, [caixa]);
    fundo.addEventListener("click", function (e) { if (e.target === fundo) fechaFolha(); });
    doc.body.appendChild(fundo);
    // a tela por trás (com a barra de lance) fica inerte: o Tab e o leitor de tela não saem da folha (a #lei-vivo fica fora)
    var tela = doc.querySelector("#app > .screen");
    if (tela && !tela.inert) tela.inert = true; else tela = null;
    VIEW.folha = { fundo: fundo, caixa: caixa, corpo: corpo, monta: monta, antes: antes, vivo: !!opc.vivo, tela: tela };
    monta(corpo);
    global.requestAnimationFrame(function () { fundo.classList.add("show"); try { fechar.focus(); } catch (e) {} });
  }
  function fechaFolha() {
    var f = VIEW.folha; if (!f) return;
    VIEW.folha = null;
    if (f.tela) f.tela.inert = false;
    if (f.fundo.parentNode) f.fundo.parentNode.removeChild(f.fundo);
    try { if (f.antes && f.antes.isConnected && f.antes.focus) f.antes.focus(); } catch (e) {}
  }
  doc.addEventListener("keydown", function (e) {
    var f = VIEW.folha; if (!f) return;
    if (e.key === "Escape") { e.preventDefault(); fechaFolha(); return; }
    if (e.key !== "Tab") return;
    // o Tab dá a volta dentro da folha (do último ao primeiro e, com Shift, do primeiro ao último)
    var foc = [].filter.call(f.caixa.querySelectorAll("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"), function (x) {
      return !x.disabled && x.offsetParent !== null;
    });
    if (!foc.length) return;
    var prim = foc[0], ult = foc[foc.length - 1], at = doc.activeElement, dentro = f.caixa.contains(at);
    if (e.shiftKey ? (at === prim || !dentro) : (at === ult || !dentro)) { e.preventDefault(); (e.shiftKey ? ult : prim).focus(); }
  });

  function folhaComoFunciona() {
    var S = sessao(), V = S ? S.ver() : null, seg = V && V.cfg && V.cfg.tempo ? Math.round(V.cfg.tempo / 1000) : Math.round(L().DUR / 1000);
    folha("Como funciona", function (c) {
      var itens = [
        "Cada técnico entra com " + rs(L().SALDO) + " (dinheiro do jogo, nada de verdade) e monta um time de " + L().VAGAS + ".",
        "Vão a leilão os melhores jogadores da liga, por posição: tem goleiro para todo mundo.",
        "Cada jogador fica " + seg + " s no martelo. Lance com menos de " + Math.round(L().EXT / 1000) + " s faltando devolve o relógio a " + Math.round(Math.min(L().EXT, seg * 1000) / 1000) + " s.",
        "+1, +5 e +10 sobem sobre o valor que você vê. Se alguém deu lance antes, o seu não sobe sozinho: aparece o preço novo.",
        "O seu máximo guarda R$ 1 para cada vaga que falta. O Tudo dá o máximo e pede um 2º toque para confirmar.",
        "Passar vale só para aquele jogador. Quando todos passam, ele fecha na hora.",
        "O time tem de caber numa das 6 formações: ninguém compra dois goleiros.",
        "Jogador sem lance vai para a repescagem no fim (" + Math.round(L().DUR_REP / 1000) + " s). Quem ainda tiver vaga completa de graça com jogadores de fora dos lotes, que são piores.",
        "O que sobrar de dinheiro não vale nada no campeonato."
      ];
      c.appendChild(el("ul", { class: "lei-regras" }, itens.map(function (t) { return el("li", { text: t }); })));
    });
  }
  function folhaParticipantes() {
    folha("Participantes", function (c) {
      var S = sessao(); if (!S) return;
      var V = S.ver();
      V.tecnicos.forEach(function (t) {
        var e = estadoTec(t);
        c.appendChild(el("div", { class: "lei-part" + (t.eu ? " eu" : "") }, [
          escudo(t.clube, "p"),
          el("span", { class: "lei-tec-nome" }, [
            el("span", { class: "lei-tec-quem", text: t.nome }),
            el("span", { class: "lei-tec-clube", text: t.clube.nome + " · " + (t.eu ? "Você" : t.bot ? "Bot" : t.papel === "dono" ? "Dono da sala" : "Técnico") })
          ]),
          el("span", { class: "lei-tec-dir" }, [el("b", { class: "lei-tec-saldo", text: rs(t.saldo) }), el("span", { class: "lei-tec-n", text: t.n + "/" + L().VAGAS })]),
          V.estado === "leilao" ? el("span", { class: "lei-tec-est" + (e[0] ? " " + e[0] : ""), text: e[1] }) : null
        ]));
      });
    }, { vivo: true });
  }
  // as vendas e o time de cada técnico (tocar num técnico mostra o campinho dele: de que posição ele ainda precisa)
  function folhaVendas(tSel) {
    var S = sessao(); if (!S) return;
    var sel = tSel >= 0 ? tSel : S.ver().eu;
    folha("Vendas", function (c) {
      var V = S.ver();
      var grade = el("div", { class: "lei-vend-tecs", role: "group", "aria-label": "Técnicos" });
      V.tecnicos.forEach(function (t) {
        var on = t.t === sel;
        grade.appendChild(el("button", { class: "lei-vend-tec" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false",
          on: { click: function () { sel = t.t; TM.ui.clear(c); VIEW.folha.monta(c); } } }, [
          escudo(t.clube, "p"),
          el("span", { class: "lei-vend-tec-n", text: t.eu ? "Você" : t.nome }),
          el("span", { class: "lei-vend-tec-x", text: t.n + "/" + L().VAGAS + " · " + rs(t.saldo) })
        ]));
      });
      c.appendChild(grade);
      var ts = V.tecnicos[sel];
      if (ts) {
        c.appendChild(el("h3", { class: "lei-folha-sub", text: (ts.eu ? "Seu time" : "Time de " + ts.nome) + " · " + (S.escalacao(sel) || {}).formacao }));
        c.appendChild(el("div", { class: "lei-vend-campo" }, [campinho(S, sel, { cls: "lei-pitch-folha" })]));
        var falta = [];
        var e = S.escalacao(sel), slots = e ? L().slotsDe(e.formacao) : [];
        ["GK", "DF", "MF", "FW"].forEach(function (g) {
          var n = 0; slots.forEach(function (sl, i) { if (sl[0] === g && e.tit[i] < 0) n++; });
          if (n) falta.push(n + GRUPO_FALTA[g]);
        });
        c.appendChild(el("p", { class: "lei-vend-falta", text: falta.length ? "Faltam: " + falta.join(", ") + " (na " + e.formacao + ")." : "Time completo." }));
      }
      var vs = V.vendas.slice().reverse();
      c.appendChild(el("h3", { class: "lei-folha-sub", text: "Vendidos (" + vs.length + ")" }));
      if (!vs.length) c.appendChild(el("p", { class: "lei-vazio", text: "Nenhuma venda ainda." }));
      var lista = el("ol", { class: "lei-vend-lista" });
      vs.forEach(function (x) {
        var t = V.tecnicos[x.t], r = x.retrato;
        lista.appendChild(el("li", { class: "lei-vend" + (t && t.eu ? " eu" : "") }, [
          el("span", { class: "lei-gr gr-" + r.pos, text: GRUPO_CURTO[r.pos] }),
          el("span", { class: "lei-vend-j" }, [el("span", { class: "lei-vend-jn", text: r.name }), el("span", { class: "lei-vend-jo", text: "Nota " + r.overall + " · " + (t ? (t.eu ? "você" : t.nome) : "?") })]),
          el("b", { class: "lei-vend-p", text: rs(x.preco) })
        ]));
      });
      c.appendChild(lista);
    }, { cls: "lei-folha-larga" });
  }
  function folhaFicha(r) {
    folha(r.name, function (c) {
      var cl = clube(r.clubId), na = nacao(r.nationId);
      c.appendChild(el("div", { class: "lei-ficha" }, [
        el("div", { class: "lei-ficha-carta" }, [cartaEl(r, "big")]),
        el("dl", { class: "lei-ficha-dl" }, [
          el("dt", { text: "Função" }), el("dd", { text: funcaoDe(r) }),
          el("dt", { text: "Joga de" }), el("dd", { text: gruposDe(r).map(function (g) { return GRUPO_NOME[g]; }).join(", ") }),
          el("dt", { text: "Nota" }), el("dd", { text: String(r.overall) }),
          cl ? el("dt", { text: "Clube" }) : null, cl ? el("dd", { text: cl.name }) : null,
          na ? el("dt", { text: "País" }) : null, na ? el("dd", { text: na.name }) : null,
          r.number ? el("dt", { text: "Camisa" }) : null, r.number ? el("dd", { text: String(r.number) }) : null
        ])
      ]));
    });
  }

  /* ---------- Entrada (leilao) ---------- */
  function textoEstado(x) {
    if (x.estado === "leilao") return x.fase === "rep" ? "Repescagem" : x.k >= 0 ? "Jogador " + (x.k + 1) + " de " + (13 * x.T) : "Começando";
    if (x.estado === "escalacao") return "Escalação";
    if (x.estado === "camp") return "Campeonato em breve";
    return "Saguão";
  }
  TM.ui.register("leilao", function (screen) {
    screen.classList.add("lei-screen", "lei-entrada");
    screen.appendChild(TM.ui.topbar("Modo Leilão", function () { TM.ui.go("modes"); }));
    var corpo = el("div", { class: "panel-narrow lei-entrada-corpo" });
    screen.appendChild(corpo);
    var S = sessao();
    if (S) {
      var V = S.ver();
      corpo.appendChild(el("div", { class: "next-match lei-cartao lei-andamento" }, [
        el("div", { class: "nm-label", text: "Leilão em andamento" }),
        el("div", { class: "lei-sala-linha" }, [escudo((V.tecnicos[V.eu] || {}).clube, "p"), el("div", { class: "lei-sala-txt" }, [
          el("span", { class: "lei-sala-t", text: subtitulo(V) }),
          el("span", { class: "lei-sala-s", text: V.T + " técnicos · " + (V.lote ? textoLote(V.lote) : textoEstado({ estado: V.estado, fase: V.fase, k: -1, T: V.T })) + (S.pausado && S.pausado() ? " · parado" : "") })
        ])]),
        el("div", { class: "lei-acoes" }, [botao("Voltar à sala", function () { TM.ui.go(rotaDoEstado(S.ver())); }, "btn primary", "gavel")])
      ]));
    }
    corpo.appendChild(el("div", { class: "next-match lei-cartao lei-treino" }, [
      el("div", { class: "nm-label", text: "Treinar contra bots" }),
      el("p", { class: "intro-text", text: "Você contra 1 a 7 bots, neste aparelho: o leilão inteiro e a escalação. Funciona sem internet." }),
      el("div", { class: "lei-acoes" }, [botao("Treinar contra bots", function () { TM.ui.go("leilao-criar"); }, S ? "btn" : "btn primary", "bot")])
    ]));
    corpo.appendChild(el("div", { class: "next-match lei-cartao lei-online" }, [
      el("div", { class: "nm-label" }, [el("span", { text: "Com os amigos online" }), el("span", { class: "lei-tag", text: "Em breve" })]),
      el("p", { class: "intro-text", text: "Sala privada por código ou link, você aceita quem entra. Chega na próxima atualização." }),
      el("div", { class: "lei-acoes" }, [
        botao("Criar sala", function () {}, "btn lei-off", "gavel"),
        botao("Entrar com código", function () {}, "btn lei-off", "key-round")
      ])
    ]));
    corpo.querySelectorAll(".lei-off").forEach(function (b) { b.disabled = true; b.setAttribute("aria-disabled", "true"); });
    var salas = SS() ? SS().salas() : [];
    if (salas.length) {
      corpo.appendChild(el("h2", { class: "block-title", text: "Minhas salas" }));
      var lista = el("div", { class: "lei-salas" });
      salas.forEach(function (x) {
        var aberta = S && S.codigo === x.codigo;
        lista.appendChild(el("div", { class: "lei-sala" + (aberta ? " aberta" : "") }, [
          escudo(x.clube, "p"),
          el("div", { class: "lei-sala-txt" }, [
            el("span", { class: "lei-sala-t", text: (x.treino ? "Treino" : "Sala " + x.codigo) + (x.ligaNome ? " · " + x.ligaNome : "") }),
            el("span", { class: "lei-sala-s", text: x.T + " técnicos · " + textoEstado(x) + (x.regrasOk ? "" : " · só olhar") })
          ]),
          el("div", { class: "lei-sala-bts" }, [
            botao(aberta ? "Abrir" : "Continuar", function () { continuar(x.codigo); }, "btn small primary"),
            el("button", { class: "lei-sala-x", type: "button", "aria-label": "Excluir a sala", title: "Excluir", on: { click: function () { excluir(x.codigo); } } }, [ic("trash-2")])
          ])
        ]));
      });
      corpo.appendChild(lista);
    }
    corpo.appendChild(el("h2", { class: "block-title", text: "Como funciona" }));
    corpo.appendChild(el("ul", { class: "lei-regras lei-regras-curtas" }, [
      el("li", { text: "Cada técnico entra com R$ 100 (dinheiro do jogo) e compra os 11 do time no leilão dos melhores jogadores da liga escolhida." }),
      el("li", { text: "Cada jogador fica 10 s no martelo: +1, +5, +10, Tudo ou outro valor. Dá para passar." }),
      el("li", { text: "Depois, a escalação no campinho e o campeonato (em breve)." })
    ]));
  });
  function excluir(codigo) {
    TM.ui.confirm("Excluir a sala?", "O treino é apagado deste aparelho.", "Excluir", function () {
      var S = sessao();
      if (S && S.codigo === codigo) S.sair().then(function () { TM.ui.go("leilao"); });
      else { try { TM.leilaoRede.memoria(codigo, {}).apagar(); } catch (e) {} TM.ui.go("leilao"); }
    }, true);
  }

  /* ---------- Criar sala: o Treino (leilao-criar) ---------- */
  function duracaoEstimada(T, tempoMs) {
    // medido com os robôs (o leilão inteiro): ~0,9 × o relógio por lote quando todos passam rápido, ~relógio + 7 s quando
    // ninguém passa (o relógio inteiro, a pausa e a repescagem); com 2 técnicos, metade embaixo
    var n = L().LOTES_POR_TEC * T, s = tempoMs / 1000;
    var lo = n * (T <= 2 ? 0.5 : 0.9) * s / 60, hi = n * (s + 7) / 60;
    return { lo: Math.max(1, Math.round(lo)), hi: Math.max(2, Math.round(hi)), n: n };
  }
  function ligas() { try { return TM.data.world().leagues.slice(); } catch (e) { return []; } }
  TM.ui.register("leilao-criar", function (screen) {
    screen.classList.add("lei-screen", "lei-criar");
    screen.appendChild(TM.ui.topbar("Treinar contra bots", function () { TM.ui.go("leilao"); }));
    var lgs = ligas(), pref = ler("leilao:criar", {}) || {};
    var F = {
      liga: lgs.some(function (l) { return l.id === pref.liga; }) ? pref.liga : (lgs.some(function (l) { return l.id === "br"; }) ? "br" : (lgs[0] && lgs[0].id)),
      T: pref.T >= L().TEC_MIN && pref.T <= L().TEC_MAX ? pref.T : 4,
      formacao: L().FORMACOES.indexOf(pref.formacao) >= 0 ? pref.formacao : "4-4-2",
      tempo: L().TEMPOS.indexOf(pref.tempo) >= 0 ? pref.tempo : L().DUR,
      clube: SS().limpaClube(pref.clube || SS().clubeInicial())
    };
    var corpo = el("div", { class: "panel-narrow lei-criar-corpo" });
    screen.appendChild(corpo);
    var resumo = el("p", { class: "lei-criar-resumo" });
    function ligaDe(id) { return lgs.filter(function (l) { return l.id === id; })[0] || null; }

    // a liga
    var ligaBt = el("button", { class: "lei-liga-bt", type: "button", "aria-haspopup": "dialog", on: { click: function () {
      escolheLiga(lgs, F.liga, function (id) { F.liga = id; poeLiga(); poeResumo(); });
    } } });
    function poeLiga() {
      TM.ui.clear(ligaBt);
      var lg = ligaDe(F.liga), comp = null; try { comp = TM.data.competition("lg-" + F.liga); } catch (e) {}
      if (comp && TM.img.compImg) ligaBt.appendChild(TM.img.compImg(comp, "lei-liga-logo"));
      ligaBt.appendChild(el("span", { class: "lei-liga-txt" }, [
        el("span", { class: "lei-liga-n", text: lg ? lg.name : "Escolha a liga" }),
        el("span", { class: "lei-liga-s", text: "Os " + duracaoEstimada(F.T, F.tempo).n + " melhores dos clubes" + (lg ? " da " + lg.name : "") })
      ]));
      ligaBt.appendChild(el("span", { class: "lei-liga-trocar", text: "Trocar" }));
      ligaBt.setAttribute("aria-label", "Liga: " + (lg ? lg.name : "nenhuma") + ". Trocar");
    }
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [el("div", { class: "setting-label", text: "Liga" }), ligaBt]));

    // os técnicos (contando os bots)
    var nT = el("span", { class: "lei-passo-n", "aria-live": "polite" }), hintT = el("div", { class: "setting-hint" });
    var menos = el("button", { class: "lei-passo-bt", type: "button", "aria-label": "Menos um técnico", on: { click: function () { if (F.T > L().TEC_MIN) { F.T--; poeT(); } } } }, [ic("minus")]);
    var mais = el("button", { class: "lei-passo-bt", type: "button", "aria-label": "Mais um técnico", on: { click: function () { if (F.T < L().TEC_MAX) { F.T++; poeT(); } } } }, [ic("plus")]);
    function poeT() {
      nT.textContent = String(F.T);
      menos.disabled = F.T <= L().TEC_MIN; mais.disabled = F.T >= L().TEC_MAX;
      hintT.textContent = "Você e " + (F.T - 1) + (F.T - 1 === 1 ? " bot" : " bots") + " · " + duracaoEstimada(F.T, F.tempo).n + " jogadores no leilão";
      poeLiga(); poeResumo();
    }
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [
      el("div", { class: "lei-criar-linha" }, [
        el("div", { class: "lei-criar-lt" }, [el("div", { class: "setting-label", text: "Técnicos na sala" }), hintT]),
        el("div", { class: "lei-passo", role: "group", "aria-label": "Técnicos na sala" }, [menos, nT, mais])
      ])
    ]));

    // a formação (a preferência durante o leilão)
    var segF = el("div", { class: "segmented lei-formas", role: "group", "aria-label": "Sua formação" });
    var mini = el("div", { class: "lei-mini-campo", "aria-hidden": "true" });
    function poeF() {
      TM.ui.clear(segF);
      L().FORMACOES.forEach(function (f) {
        var on = f === F.formacao;
        segF.appendChild(el("button", { class: "seg-btn lei-forma-bt" + (on ? " active" : ""), type: "button", "aria-pressed": on ? "true" : "false",
          on: { click: function () { F.formacao = f; poeF(); poeResumo(); } } }, [el("span", { class: "lei-forma-f", text: f }), FORMA_NOME[f] ? el("span", { class: "lei-forma-n", text: FORMA_NOME[f] }) : null]));
      });
      TM.ui.clear(mini);
      (L().slotsDe(F.formacao) || []).forEach(function (s) {
        mini.appendChild(el("span", { class: "lei-mini-vaga gr-" + s[0], style: "left:" + s[1] + "%;top:" + s[2] + "%", text: GRUPO_CURTO[s[0]] }));
      });
      mini.appendChild(el("span", { class: "lei-mini-n", text: "0/" + L().VAGAS }));
    }
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [
      el("div", { class: "setting-label", text: "Sua formação" }),
      el("div", { class: "lei-criar-forma" }, [segF, mini]),
      el("div", { class: "setting-hint", text: "Se uma compra não couber nela, ela muda sozinha para a que cabe." })
    ]));

    // o seu clube: o nome, a sigla e o escudo desenhado (a forma, o símbolo e a cor do Ultimate)
    var prevEsc = el("span", { class: "lei-criar-esc" });
    var inNome = el("input", { class: "lei-campo", type: "text", maxlength: "16", autocomplete: "off", "aria-label": "Nome do clube", on: { input: function () { F.clube.nome = inNome.value; F.clube.sigla = SS().limpaClube({ nome: inNome.value }).sigla; inSigla.value = F.clube.sigla; poeEsc(false); } } });
    var inSigla = el("input", { class: "lei-campo lei-campo-sigla", type: "text", maxlength: "3", autocomplete: "off", "aria-label": "Sigla do clube", on: { input: function () { inSigla.value = inSigla.value.replace(/[^0-9A-Za-zÀ-ÿ]/g, "").toUpperCase().slice(0, 3); F.clube.sigla = inSigla.value; poeEsc(false); } } });
    var editor = el("div", { class: "lei-criar-escudo", id: "lei-criar-escudo" });
    var abreEsc = el("button", { class: "lei-bloco-bt lei-esc-abre", type: "button", "aria-controls": "lei-criar-escudo", "aria-expanded": "false", on: { click: function () {
      var ab = editor.hidden; editor.hidden = !ab; abreEsc.setAttribute("aria-expanded", ab ? "true" : "false"); abreEsc.classList.toggle("aberto", ab);
    } } }, [el("span", { class: "lei-bloco-ic" }, [ic("palette")]), el("span", { class: "lei-bloco-tit", text: "Mudar o escudo" }), el("span", { class: "lei-bloco-seta" }, [ic("chevron-down")])]);
    editor.hidden = true;
    function poeEsc(tudo) {
      TM.ui.clear(prevEsc); prevEsc.appendChild(escudo(F.clube, "g"));
      if (!tudo) return;
      inNome.value = F.clube.nome; inSigla.value = F.clube.sigla;
      TM.ui.clear(editor);
      var u = UT(); if (!u) return;
      var cfg = u.escudoCfg({ escudo: F.clube.escudo });
      var cores = el("div", { class: "lei-cores", role: "group", "aria-label": "Cor" });
      (u.CORES || []).forEach(function (cor) {
        var on = String(cor).toLowerCase() === String(F.clube.cor).toLowerCase();
        cores.appendChild(el("button", { class: "lei-cor" + (on ? " on" : ""), type: "button", style: "background:" + cor, "aria-label": "Cor " + cor, "aria-pressed": on ? "true" : "false",
          on: { click: function () { F.clube.cor = String(cor).toLowerCase(); poeEsc(true); } } }));
      });
      var formas = el("div", { class: "lei-formas-esc", role: "group", "aria-label": "Forma" });
      (u.FORMA_ORDEM || []).forEach(function (fm) {
        var on = fm === cfg.forma;
        formas.appendChild(el("button", { class: "lei-forma-esc" + (on ? " on" : ""), type: "button", "aria-label": "Forma " + fm, "aria-pressed": on ? "true" : "false",
          on: { click: function () { F.clube.escudo = fm + "|" + cfg.simb; poeEsc(true); } } }, [u.escudoEl({ forma: fm, simb: cfg.simb }, F.clube.cor, "", "lei-esc pp")]));
      });
      var simbs = el("div", { class: "lei-simbs", role: "group", "aria-label": "Símbolo" });
      (u.SIMBOLOS || []).forEach(function (sb) {
        var on = sb === cfg.simb;
        simbs.appendChild(el("button", { class: "lei-simb" + (on ? " on" : ""), type: "button", "aria-label": "Símbolo " + sb, "aria-pressed": on ? "true" : "false",
          on: { click: function () { F.clube.escudo = cfg.forma + "|" + sb; poeEsc(true); } } }, [ic(sb)]));
      });
      editor.appendChild(el("div", { class: "lei-rotulo", text: "Cor" })); editor.appendChild(cores);
      editor.appendChild(el("div", { class: "lei-rotulo", text: "Forma" })); editor.appendChild(formas);
      editor.appendChild(el("div", { class: "lei-rotulo", text: "Símbolo" })); editor.appendChild(simbs);
    }
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [
      el("div", { class: "setting-label", text: "Seu clube" }),
      el("div", { class: "lei-criar-clube" }, [prevEsc, el("div", { class: "lei-criar-campos" }, [inNome, inSigla])]),
      abreEsc, editor
    ]));

    // mais opções: o tempo de cada jogador
    var segT = el("div", { class: "segmented lei-tempos", role: "group", "aria-label": "Tempo de cada jogador" });
    function poeTempo() {
      TM.ui.clear(segT);
      L().TEMPOS.forEach(function (t) {
        var on = t === F.tempo;
        segT.appendChild(el("button", { class: "seg-btn" + (on ? " active" : ""), type: "button", "aria-pressed": on ? "true" : "false", text: (t / 1000) + " s",
          on: { click: function () { F.tempo = t; poeTempo(); poeT(); } } }));
      });
    }
    var maisOp = el("div", { class: "lei-mais-op", id: "lei-mais-op" });
    maisOp.hidden = true;
    var abreOp = el("button", { class: "lei-bloco-bt", type: "button", "aria-controls": "lei-mais-op", "aria-expanded": "false", on: { click: function () {
      var ab = maisOp.hidden; maisOp.hidden = !ab; abreOp.setAttribute("aria-expanded", ab ? "true" : "false"); abreOp.classList.toggle("aberto", ab);
    } } }, [el("span", { class: "lei-bloco-ic" }, [ic("sliders-horizontal")]), el("span", { class: "lei-bloco-tit", text: "Mais opções" }), el("span", { class: "lei-bloco-seta" }, [ic("chevron-down")])]);
    maisOp.appendChild(el("div", { class: "lei-rotulo", text: "Tempo de cada jogador no martelo" }));
    maisOp.appendChild(segT);
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [abreOp, maisOp]));

    // o fim da coluna: o resumo, a duração estimada e o Começar
    var comecar = botao("Começar o treino", function () { criar(F, comecar); }, "btn primary big lei-comecar", "gavel");
    function poeResumo() {
      var lg = ligaDe(F.liga), d = duracaoEstimada(F.T, F.tempo);
      resumo.textContent = (lg ? lg.name : "") + " · " + F.T + " técnicos · " + F.formacao + " · leilão de cerca de " + d.lo + " a " + d.hi + " min";
    }
    corpo.appendChild(el("div", { class: "lei-rodape" }, [resumo, comecar, el("p", { class: "lei-criar-nota", text: "Dinheiro do jogo: nada de Total Coins nem de dinheiro de verdade." })]));
    poeT(); poeF(); poeEsc(true); poeTempo(); poeResumo();
  });
  function escolheLiga(lgs, atual, fn) {
    folha("Escolha a liga", function (c) {
      var lista = el("div", { class: "lei-ligas" });
      lgs.forEach(function (lg) {
        var comp = null; try { comp = TM.data.competition("lg-" + lg.id); } catch (e) {}
        var on = lg.id === atual;
        lista.appendChild(el("button", { class: "lei-liga" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false", on: { click: function () { fechaFolha(); fn(lg.id); } } }, [
          comp && TM.img.compImg ? TM.img.compImg(comp, "lei-liga-logo") : el("span"),
          el("span", { class: "lei-liga-txt" }, [el("span", { class: "lei-liga-n", text: lg.name }), el("span", { class: "lei-liga-s", text: lg.clubIds.length + " clubes" })]),
          on ? el("span", { class: "lei-liga-ok" }, [ic("check")]) : null
        ]));
      });
      c.appendChild(lista);
    }, { cls: "lei-folha-larga" });
  }
  function criar(F, bt) {
    if (VIEW.criando) return;
    VIEW.criando = true;
    bt.disabled = true; bt.setAttribute("aria-busy", "true");
    var rot = bt.querySelector("span:last-child"); if (rot) rot.textContent = "Preparando os lotes…";
    var clubeLimpo = SS().limpaClube(F.clube);
    gravar("leilao:criar", { liga: F.liga, T: F.T, formacao: F.formacao, tempo: F.tempo, clube: clubeLimpo });
    // um quadro para o "Preparando…" aparecer antes da conta dos lotes (o mundo-base leva uma fração de segundo)
    setTimeout(function () {
      var mundo = null; try { mundo = TM.data.mundoBase(); } catch (e) { mundo = null; }
      SS().criarTreino({ liga: F.liga, bots: F.T - 1, formacao: F.formacao, tempo: F.tempo, clube: clubeLimpo, mundo: mundo || undefined }).then(function () {
        VIEW.criando = false;
        TM.ui.go("leilao-lote");
      }, function (e) {
        VIEW.criando = false;
        if (global.console) console.error(e);
        TM.ui.toast("Não deu para começar o treino. Tente de novo.", "erro");
        if (bt.isConnected) { bt.disabled = false; bt.removeAttribute("aria-busy"); if (rot) rot.textContent = "Começar o treino"; }
      });
    }, 40);
  }

  TM.leilaoTela = {
    /** Gancho de teste: o que foi para a região ao vivo (as últimas 40 falas). */
    anuncios: function () { return VIEW.anuncios.slice(); },
    duracaoEstimada: duracaoEstimada
  };
})(window);
