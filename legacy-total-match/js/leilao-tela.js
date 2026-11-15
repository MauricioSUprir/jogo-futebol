/* ================= TOTAL MATCH — Modo Leilão: as telas ================= */
/* Plano: PLANO-LEILAO.md §2 (as telas, a barra da sessão, a carta, o campinho), §2.1 (a Entrada), §2.2 (a Criar sala),
   §2.3 (o Saguão), §2.4 (a aba Leilão: a barra de lance, o relógio, o retorno do lance, a acessibilidade, a tela acesa),
   §2.5 (a Escalação), §2.6 (o Campeonato), §1.8 (o fim) e §3.8 (o atalho e o link). As telas só LEEM a sessão
   (TM.leilaoSessao: `ver()`, no campeonato `ver().camp`) e chamam as ações dela; nenhuma regra mora aqui.
   Rotas: leilao (Entrada: Criar sala, Entrar com código, Treinar contra bots, Minhas salas), leilao-criar (o Treino;
   com { online: true }, a sala online; o Formato do campeonato e a duração estimada), leilao-saguao (a aba Saguão, só no
   online: o convite, os pedidos, os participantes, a configuração com o Formato, o meu clube e o Pronto/Começar),
   leilao-lote (a aba Leilão), leilao-escalacao, leilao-camp (o Campeonato: Seu jogo com o Simular partida, Simular os
   pendentes do dono, a rodada, a tabela, a chave, a artilharia e o fim) e leilao-jogo ({ id }: o "Ver o jogo", o
   resultado GRAVADO no 2D do TM.matchview sem pausa — pauseSide null —, a prorrogação com o gol de ouro e os pênaltis
   gravados; fora das rotas da sala: no treino o relógio para enquanto a pessoa vê o jogo).
   No treino, sair das telas da sala (ir ao menu) SEGURA o relógio (sessão.segurar("tela")), como a página escondida: a
   pessoa não perde lotes. No online o relógio é o do servidor: sair das telas não segura nada (a sessão continua batendo
   enquanto a página está à vista). A região ao vivo do leitor de tela é a #lei-vivo do index.html (uma só, no HTML
   inicial): fala o lote, os lances, as vendas, quem entra, quem fica pronto e a conexão, sem repetir.
   A conta online é a do TM (TM.net: login anônimo, nome e número do perfil). Sem ela (sem o SDK ou sem internet), a
   Entrada só oferece o Treino; com ela ainda entrando, "Entrando na sua conta online…".
   Ganchos de teste (o testar-leilao.mjs --tela e o testar-leilao-online.mjs, com o banco falso no lugar do Firebase):
     TM.leilaoTela.anuncios()       o que foi para a região ao vivo (as últimas 40 falas)
     TM.leilaoTela.convite(usar)    o código do link ?leilao= ainda não usado (usar = true o dá por usado)
     TM.leilaoTela.estado()         { rota, aviso (o texto da faixa da sala: rede, regras, outra aba), codigoVisivel,
                                     barra (o texto da barra do saguão), prazo (no Campeonato, o texto do prazo do meu
                                     jogo contra um bot; null sem ele), rodadaVista (a rodada à mostra; null = a da vez),
                                     jogo (o id do último jogo aberto no "Ver o jogo") }
     TM.leilaoTela.ajustes          { cheioMs (sem conexão por mais que isso, com a internet do aparelho ligada: "Servidor
                                     cheio, tente em alguns minutos"; padrão 15 s), contaMs (a conta que não fica pronta:
                                     padrão 9 s) } — os testes encurtam
   As ações online passam todas pela sessão (o banco falso dos testes é o SDK falso instalado na página: a tela não sabe
   que é de mentira). Seletores estáveis para os testes: .lei-online (o cartão da Entrada), .lei-entrar-cod (o campo do
   código), .lei-conv-cod (o código, •••••• até o olho .lei-olho), .lei-pedido (um pedido, com Aceitar e Recusar),
   .lei-part[data-uid] (um participante), .lei-sagbar (a barra fixa do saguão: .lei-sagbar-txt e o botão
   .lei-sagbar-bt), .lei-aviso-sala (a faixa da sala); o Formato: .lei-fmt[data-fmt] (aria-pressed); o Campeonato:
   .lei-seujogo (o Seu jogo; .lei-simular = o Simular partida), .lei-pend-bt (Simular os pendentes), .lei-rodada[data-rodada]
   (a rodada à mostra; .lei-rod-bt = ‹ ›), .lei-jogo[data-jogo][data-e] (um jogo com o estado; .lei-jg-ver = Ver o jogo),
   .lei-tabela, .lei-chave (.lei-ch-jogo[data-jogo]), .lei-art, e no fim .lei-campeao, .lei-class e .lei-dest. */
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

  var ROTAS_SALA = { "leilao-saguao": 1, "leilao-lote": 1, "leilao-escalacao": 1, "leilao-camp": 1 };
  // os prazos da tela (os testes encurtam): sem conexão com a internet ligada → "Servidor cheio"; a conta que não fica pronta
  var AJUSTES = { cheioMs: 15000, contaMs: 9000 };
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
    { rota: "leilao-saguao", nome: "Saguão", icone: "door-open", online: true },
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
    abertos: { time: false, tecnicos: false, proximos: false }, anuncios: [], anunciado5: -1,
    convite: null, conviteFeito: false,   // o código do link ?leilao= (app.js), guardado uma vez por carga da página
    aviso: null,                          // o recado para a Entrada depois de sair da sala à força (recusado, encerrada…)
    offDesde: 0, redeVista: "ok",         // a conexão: desde quando caiu (o "Servidor cheio") e a última falada
    codigoVisivel: false,                 // o código da sala aparece só com o olho (quem compartilha a tela não mostra)
    sag: null,                            // o saguão já falado (quem entrou, quem ficou pronto) e o meu Pronto visto
    meuClube: null,                       // o Meu clube sendo editado no saguão: { base (o gravado), F (a cópia), sujo }
    esperaConta: false, ocupado: null,    // a Entrada esperando a conta; a ação do saguão (ou do campeonato) a caminho
    campSel: null                         // a rodada à mostra no Campeonato (null = a da vez)
  };

  function funcaoDe(r) { return (r && (FUNCAO[r.pos2] || GRUPO_NOME[r.pos])) || ""; }
  function gruposDe(r) { return (r && r.grupos && r.grupos.length ? r.grupos : [r && r.pos]).filter(Boolean); }
  function nomeForma(f) { return FORMA_NOME[f] ? f + " · " + FORMA_NOME[f] : f; }
  function comNum(nome, n) { return n ? nome + " #" + n : nome; }

  /* ---------- a conta online (a do TM: TM.net) ---------- */
  function N() { return TM.net || null; }
  // 'indisponivel' (sem o SDK do Firebase ou sem o banco: sem internet), 'conectando' (entrando na conta) ou 'pronta'
  function contaEstado() {
    var n = N();
    if (!n || !TM.leilaoRede || !TM.leilaoRede.firebase) return "indisponivel";
    try { if (n.init) n.init(); } catch (e) {}
    if (!n.available || !n._db) return "indisponivel";
    return n.ready && n.me && n.me.uid ? "pronta" : "conectando";
  }
  // com a conta ainda entrando, a tela da vez é desenhada de novo quando ela fica pronta (um aviso só por vez)
  function quandoConta(rota) {
    var n = N();
    if (!n || !n.onReady || VIEW.esperaConta) return;
    VIEW.esperaConta = true;
    n.onReady(function () {
      VIEW.esperaConta = false;
      if (TM.ui.current() === rota) TM.ui.go(rota, rota === "leilao-criar" ? { online: true } : {});
    });
  }
  function suspenso() { try { var st = TM.fairplay && TM.fairplay.status && TM.fairplay.status(); return st && st.banned ? st : null; } catch (e) { return null; } }
  function semInternet() { try { return global.navigator && global.navigator.onLine === false; } catch (e) { return false; } }
  function linkDa(c) { return global.location.origin + global.location.pathname + "?leilao=" + c; }
  function copia(t, msg) {
    try { global.navigator.clipboard.writeText(t).then(function () { TM.ui.toast(msg, "ok"); }, function () { TM.ui.toast(t); }); }
    catch (e) { TM.ui.toast(t); }
  }
  function qr(texto) {
    var box = el("div", { class: "qr-box lei-qr", role: "img", "aria-label": "QR do convite" });
    try {
      if (TM.online3d && TM.online3d.qrSvg) box.innerHTML = TM.online3d.qrSvg(texto);
      else return null;
    } catch (e) { return null; }
    return box;
  }

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
    // a faixa da conexão muda também sem aviso da sessão ("Reconectando…" vira "Servidor cheio…" com o tempo)
    if (VIEW.V && VIEW.V.online) poeAvisoSala(VIEW.V);
    if (VIEW.msgAte && agoraReal() > VIEW.msgAte) { VIEW.msgAte = 0; VIEW.msg = null; atualizaBarra(VIEW.V); atualizaBarraSag(VIEW.V); }
    if (VIEW.conf.ate && agoraReal() > VIEW.conf.ate) { VIEW.conf = { ate: 0, seq: -1, valor: 0 }; atualizaBarra(VIEW.V); }
    VIEW.raf = global.requestAnimationFrame(laco);
  }
  function atualiza() {
    var S = sessao();
    if (!S || !VIEW.screen || !VIEW.screen.isConnected) return;
    var V = VIEW.V = S.ver();
    if (V.estado === "leilao" && !V.alterada && !V.soOlhar && V.eu >= 0) Wake.pede(); else Wake.solta();
    atualizaAbas(V);
    poeAvisoSala(V);
    anunciaSaguao(V);
    if (VIEW.rota === "leilao-saguao") atualizaSaguao(S, V);
    else if (VIEW.rota === "leilao-lote") atualizaLote(S, V);
    else if (VIEW.rota === "leilao-escalacao") atualizaEscalacao(S, V);
    else if (VIEW.rota === "leilao-camp") atualizaCamp(S, V);
    if (VIEW.folha && VIEW.folha.vivo) refazFolha();
  }

  // os eventos da sessão que falam com a pessoa (som, vibração, leitor de tela): ligados uma vez por sessão
  function ligarSessao(S) {
    if (VIEW.sessaoLigada === S) return;
    VIEW.sessaoLigada = S;
    VIEW.codigoVisivel = false; VIEW.sag = null; VIEW.redeVista = "ok"; VIEW.offDesde = 0; VIEW.campSel = null;
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
      // o campeonato começou: da Escalação vai sozinho para o Campeonato (quem já tinha confirmado o Pronto)
      if (e.estado === "camp") {
        if (naSala()) anuncia("O campeonato começou");
        setTimeout(function () { if (sessao() === S && TM.ui.current() === "leilao-escalacao" && S.ver().meu && S.ver().meu.pronto) TM.ui.go("leilao-camp"); }, 900);
      }
      if (e.estado === "fim" && naSala()) falaFim(S, S.ver());
      // o dono começou: do Saguão vai sozinho para a aba Leilão
      if (e.estado === "leilao" && S.online) {
        if (naSala()) anuncia("O leilão começou");
        setTimeout(function () { if (sessao() === S && TM.ui.current() === "leilao-saguao") TM.ui.go("leilao-lote"); }, 600);
      }
    });
    S.on("alterada", function () { if (naSala()) TM.ui.toast("A sala foi alterada fora das regras: o leilão parou.", "erro"); });
    // o campeonato: a rodada que abriu, o fim de jogo de quem joga e o fim do campeonato (a região ao vivo; som curto)
    S.on("rodada", function (e) { if (naSala()) { Som.toca("tique"); anuncia((e.nome || "Rodada " + e.n) + " começou"); } });
    S.on("jogo", function (e) {
      if (!naSala() || !e.eu) return;
      var V = S.ver();
      anuncia("Fim de jogo: " + nomeClube(V, e.a) + " " + e.placar[0] + " × " + e.placar[1] + " " + nomeClube(V, e.b) + ". " + resultadoMeu(V, e));
    });
    if (!S.online) return;
    // a sala online: o pedido aceito ou recusado, tirado, o clube passado, a sala encerrada, outra aba, a conexão
    function sai(txt) {
      // a Entrada mostra o recado uma vez; o evento sai antes de a sessão parar: a Entrada vem no tique seguinte, já sem ela
      VIEW.aviso = txt;
      anuncia(txt);
      var ali = naSala() || TM.ui.current() === "leilao";
      setTimeout(function () {
        if (ali) { saiuDaSala(); TM.ui.go("leilao"); }
        else TM.ui.toast(txt, "erro");
      }, 0);
    }
    S.on("aceito", function () {
      anuncia("O dono aceitou: você está na sala");
      TM.ui.toast("O dono aceitou: você está na sala.", "ok");
      if (sessao() === S && naSala() && TM.ui.current() !== "leilao-saguao" && S.ver().estado === "saguao") TM.ui.go("leilao-saguao");
    });
    S.on("recusado", function () { sai("O dono da sala recusou a sua entrada."); });
    S.on("tirado", function () { sai("O dono tirou você da sala."); });
    S.on("apagada", function () { sai("A sala foi encerrada."); });
    S.on("passado", function () {
      TM.ui.toast("O seu clube foi passado para outra conta: aqui você só olha.", "alerta");
      anuncia("O seu clube foi passado para outra conta: aqui você só olha");
    });
    S.on("outraAba", function () { if (naSala()) anuncia("A sala está aberta em outro aparelho ou aba"); });
    S.on("rede", function (e) {
      // fala a mudança uma vez: caiu, atualizando, de volta
      var r = e && e.rede, antes = VIEW.redeVista;
      if (r === antes) return;
      VIEW.redeVista = r;
      if (!naSala()) return;
      if (r === "offline" || r === "reconectando") { if (antes === "ok" || antes === "atualizando") anuncia("Reconectando"); }
      else if (r === "atualizando") anuncia("Atualizando a sala");
      else if (r === "ok" && antes !== "ok") anuncia("Conectado de novo");
    });
  }

  /* ---------- a moldura das telas da sala: topo, abas e a barra da sessão ---------- */
  // o código da sala online não aparece no topo (quem compartilha a tela não o mostra): só no Saguão, com o olho
  function subtitulo(V) { return (V.treino ? "Treino" : V.online ? "Sala online" : "Sala " + V.codigo) + (V.liga && V.liga.nome ? " · " + V.liga.nome : ""); }
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
    if (V.estado === "leilao" && !V.alterada && !V.soOlhar && V.eu >= 0) Wake.pede(); else Wake.solta();
    return { S: S, V: V, corpo: corpo };
  }
  // a faixa da sala (uma de cada vez, a mais grave): alterada fora das regras, outra versão das regras, outra aba e a
  // conexão (sem internet, Reconectando…, Servidor cheio…, Atualizando…)
  function textoRede(V) {
    if (!V.online || V.rede === "ok") { VIEW.offDesde = 0; return null; }
    if (V.rede === "atualizando") { VIEW.offDesde = 0; return ["Atualizando…", "rede"]; }
    if (!VIEW.offDesde) VIEW.offDesde = agoraReal();
    if (semInternet()) return ["Sem internet: reconectando…", "rede"];
    if (V.rede === "offline" && agoraReal() - VIEW.offDesde > AJUSTES.cheioMs) return ["Servidor cheio, tente em alguns minutos.", "rede"];
    return ["Reconectando…", "rede"];
  }
  function avisoDaSala(V) {
    if (V.alterada) return ["A sala foi alterada fora das regras: o leilão parou.", "erro"];
    if (V.soOlhar) {
      var nova = typeof V.regrasSala === "number" && L() && V.regrasSala > L().REGRAS;
      return [nova ? "Esta sala usa regras mais novas: atualize a página." : "Esta sala é de outra versão das regras: só dá para olhar.", "erro", nova ? "atualizar" : null];
    }
    if (V.online && V.outraAba) return ["A sala está aberta em outro aparelho ou aba: daqui você só olha.", "rede", "assumir"];
    return textoRede(V);
  }
  function poeAvisoSala(V) {
    var a = VIEW.avisoSala; if (!a || !V) return;
    var x = avisoDaSala(V);
    if (!x) { if (!a.hidden) { a.hidden = true; a.dataset.txt = ""; } return; }
    var chave = x.join("|");
    a.hidden = false;
    if (a.dataset.txt === chave) return;
    a.dataset.txt = chave;
    a.className = "lei-aviso-sala" + (x[1] === "rede" ? " rede" : "");
    TM.ui.clear(a);
    a.appendChild(el("span", { class: "lei-aviso-ic" }, [ic(x[1] === "rede" ? (V.rede === "atualizando" ? "refresh-cw" : "wifi") : "triangle-alert")]));
    a.appendChild(el("span", { class: "lei-aviso-txt", text: x[0] }));
    if (x[2] === "atualizar") a.appendChild(el("button", { class: "btn small lei-aviso-bt", type: "button", on: { click: function () { try { global.location.reload(); } catch (e) {} } } }, ["Atualizar"]));
    if (x[2] === "assumir") a.appendChild(el("button", { class: "btn small lei-aviso-bt", type: "button", on: { click: function () { var S = sessao(); if (S && S.assumir) S.assumir(); } } }, ["Usar aqui"]));
  }
  function abaFeita(V, rota) {
    if (rota === "leilao-saguao") return !!V.estado && V.estado !== "saguao" && !V.pedido;
    if (rota === "leilao-lote") return V.estado === "escalacao" || V.estado === "camp" || V.estado === "fim";
    if (rota === "leilao-escalacao") return V.estado === "camp" || V.estado === "fim";
    return false;
  }
  function abasEl(V, rota) {
    var abas = ABAS.filter(function (a) { return !a.online || (V.online && !V.treino); });
    var nav = el("nav", { class: "lei-abas" + (abas.length === 4 ? " quatro" : ""), "aria-label": "Etapas da sala" });
    // com o pedido esperando o dono, só o Saguão vale (a pessoa ainda não é da sala)
    if (V.pedido) nav.hidden = true;
    abas.forEach(function (a) {
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
    VIEW.abas.hidden = !!V.pedido;
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
  function textoSair(S) {
    if (S.treino) return ["Sair da sala?", "O treino acaba e é apagado deste aparelho.", "Sair da sala"];
    var V = S.ver();
    if (V.pedido) return ["Cancelar o pedido?", "O seu pedido de entrada sai da sala.", "Cancelar o pedido"];
    if (V.estado === "saguao" && V.souDono) return ["Encerrar a sala?", "A sala some para todos: quem está nela volta ao início do Leilão.", "Encerrar a sala"];
    if (V.estado === "saguao") return ["Sair da sala?", "Você sai do saguão. Para voltar, peça de novo pelo código.", "Sair da sala"];
    if (V.eu < 0) return ["Sair da sala?", "Você só estava olhando esta sala.", "Sair da sala"];
    if (V.estado === "fim") return ["Sair da sala?", "O campeonato acabou: a sala some da sua lista.", "Sair da sala"];
    if (V.estado === "camp" || V.estado === "escalacao") return ["Sair da sala?", "O seu clube fica no campeonato e os seus jogos passam a ser simulados como os de um bot.", "Sair da sala"];
    return ["Sair da sala?", "O seu clube fica e passa sozinho em cada jogador até o fim do leilão.", "Sair da sala"];
  }
  function confirmaSair(S) {
    var x = textoSair(S);
    TM.ui.confirm(x[0], x[1], x[2], function () {
      fechaFolha();
      S.sair().then(function () { saiuDaSala(); TM.ui.go("leilao"); });
    }, true);
  }
  function semSala(screen) {
    screen.appendChild(TM.ui.topbar("Leilão", function () { TM.ui.go("leilao"); }));
    var guardadas = SS() ? SS().salas() : [], x = guardadas[0];
    var corpo = el("div", { class: "panel-narrow" });
    corpo.appendChild(el("div", { class: "next-match lei-cartao" }, [
      el("div", { class: "nm-label", text: "Nenhuma sala aberta" }),
      el("p", { class: "intro-text", text: x ? (x.online ? "Você está numa sala online (" + (x.ligaNome || "Leilão") + ")." : "Você tem um treino guardado neste aparelho.") : "Comece um treino contra os bots ou crie uma sala no início do Leilão." }),
      el("div", { class: "lei-acoes" }, [
        x ? botao(x.online ? "Voltar à sala" : "Continuar o treino", function (ev) { continuar(x, ev && ev.currentTarget); }, "btn primary") : null,
        botao("Ir ao Leilão", function () { TM.ui.go("leilao"); }, x ? "btn" : "btn primary")
      ])
    ]));
    screen.appendChild(corpo);
  }
  function botao(rotulo, fn, cls, icone) {
    var b = el("button", { class: cls || "btn", type: "button", on: { click: fn } }, icone ? [el("span", { class: "lei-bt-ic" }, [ic(icone)]), el("span", { text: rotulo })] : [rotulo]);
    return b;
  }
  function rotaDoEstado(V) {
    if (V.pedido || (V.online && !V.treino && (V.estado === "saguao" || !V.estado))) return "leilao-saguao";
    return V.estado === "escalacao" ? "leilao-escalacao" : V.estado === "camp" || V.estado === "fim" ? "leilao-camp" : "leilao-lote";
  }
  // volta a uma sala das Minhas salas (x = a linha de SS().salas(), ou só o código): o treino pelo aparelho; a online pela
  // conta (com a edição da sala: a pública troca sozinha, a pro só com a chave)
  function continuar(x, bt) {
    if (typeof x === "string") x = { codigo: x };
    var S = sessao(), codigo = x.codigo;
    if (S && S.codigo === codigo) {
      // a sessão de agora continua viva com a edição trocada na tela de início: volta à edição da sala (os lotes e as
      // cartas são dela)
      var V0 = S.ver(), ed0 = V0.edicao === "pro" ? "pro" : "public";
      if (S.online) {
        try {
          if (ed0 !== TM.storage.edition()) {
            if (ed0 === "pro" && !TM.storage.suUnlocked()) { TM.ui.toast(SS().textoMotivo("edicao"), "erro"); return; }
            TM.storage.switchEdition(ed0);
          }
        } catch (e) {}
      }
      TM.ui.go(rotaDoEstado(V0)); return;
    }
    if (x.online) {
      var c = contaEstado();
      if (c !== "pronta") {
        TM.ui.toast(c === "conectando" ? "Entrando na sua conta online: tente de novo em instantes." : "Sem conexão com o servidor agora: tente de novo com internet.", "alerta");
        if (c === "conectando") quandoConta(TM.ui.current());
        return;
      }
      var ed = x.edicao === "pro" ? "pro" : "public";
      try {
        if (ed !== TM.storage.edition()) {
          if (ed === "pro" && !TM.storage.suUnlocked()) { TM.ui.toast(SS().textoMotivo("edicao"), "erro"); return; }
          TM.storage.switchEdition(ed);
        }
      } catch (e) {}
    }
    if (bt) { bt.disabled = true; bt.setAttribute("aria-busy", "true"); }
    var prazo = x.online ? setTimeout(function () { if (bt && bt.isConnected) TM.ui.toast(semInternet() ? "Sem internet: confira a conexão." : "Servidor cheio, tente em alguns minutos.", "alerta"); }, AJUSTES.cheioMs) : null;
    SS().abrir(codigo).then(function (S2) {
      clearTimeout(prazo);
      if (bt) { bt.disabled = false; bt.removeAttribute("aria-busy"); }
      TM.ui.go(rotaDoEstado(S2.ver()));
    }, function (e) {
      clearTimeout(prazo);
      if (bt && bt.isConnected) { bt.disabled = false; bt.removeAttribute("aria-busy"); }
      if (global.console && !(e && e.codigo)) console.error(e);
      var cod = e && e.codigo;
      TM.ui.toast(cod === "naoExiste" ? "Essa sala não existe mais." : cod === "naoMembro" ? "Você não está mais nessa sala." : cod ? SS().textoMotivo(cod) : "Não deu para abrir essa sala.", "erro");
      if (TM.ui.current() === "leilao") TM.ui.go("leilao");
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
    var modo = V.alterada ? "parada" : V.estado === "leilao" ? (V.lote ? "lote" : "espera") : (V.estado === "saguao" || !V.estado || V.pedido) ? "saguao" : "fim";
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
    if (P.modo === "saguao") {
      c.appendChild(el("div", { class: "next-match lei-cartao lei-embreve" }, [
        el("span", { class: "lei-embreve-ic" }, [ic("door-open")]),
        el("div", { class: "nm-label", text: "O leilão ainda não começou" }),
        el("p", { class: "intro-text", text: "Ele começa quando o dono da sala tocar em Começar, com todos prontos." }),
        el("div", { class: "lei-acoes" }, [botao("Ir ao saguão", function () { TM.ui.go("leilao-saguao"); }, "btn primary", "door-open")])
      ]));
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
        // o nome encolhe; o "lidera" fica sempre à vista
        if (lid.eu) P.lider.appendChild(el("span", { class: "lei-lider-nome", text: "Você lidera" }));
        else { P.lider.appendChild(el("span", { class: "lei-lider-nome", text: lid.nome })); P.lider.appendChild(el("span", { class: "lei-lider-v", text: "lidera" })); }
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
    // a linha de cima: o lance que caiu no meio da conexão ("Conferindo…" até a rede ficar em dia); o retorno do último
    // toque por 2,5 s; senão o motivo de o +1 estar apagado; senão o máximo
    if (V.conferindo) { poeMsg(B, "Conferindo…", "alerta"); return; }
    if (VIEW.msg && agoraReal() < VIEW.msgAte) { poeMsg(B, VIEW.msg.txt, VIEW.msg.tipo); return; }
    var x1 = b["+1"];
    if (!x1.pode) poeMsg(B, SS().textoMotivo(x1.motivo, x1), x1.motivo === "lider" ? "ok" : x1.motivo === "tarde" || x1.motivo === "pausa" ? "" : "alerta");
    else poeMsg(B, "Seu máximo neste jogador: " + rs(x1.max), "");
  }
  function poeMsg(B, txt, tipo) {
    if (B.msg.textContent !== txt) B.msg.textContent = txt;
    var cls = (B.msgBase || "lei-lance-msg") + (tipo ? " " + tipo : "");
    if (B.msg.className !== cls) B.msg.className = cls;
  }
  // o retorno de um toque na linha da barra fixa da tela (a de lance ou a do saguão)
  function mostraMsg(txt, tipo, ms) { VIEW.msg = { txt: txt, tipo: tipo || "" }; VIEW.msgAte = agoraReal() + (ms || 2500); atualizaBarra(VIEW.V); atualizaBarraSag(VIEW.V); }
  // a página termina com um espaço da altura da barra (nada fica escondido atrás dela no fim da rolagem) e o foco do
  // teclado rola a página para o botão não ficar atrás dela (scroll-padding do documento)
  function ajustaEspaco() {
    var P = VIEW.partes; if (!P || !P.espaco) return;
    // a barra fixa da tela: a de lance (aba Leilão) ou a do Pronto/Começar (Saguão)
    var fixa = P.bar ? P.bar.raiz : P.sagBar ? P.sagBar.raiz : null;
    var h = fixa && !fixa.hidden ? fixa.offsetHeight : 0;
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
      // (conferido = a conexão caiu no meio e o resultado saiu do leilão lido de novo na volta)
      if (r.ok) { mostraMsg((r.conferido ? "Conferido: lance de " : "Lance de ") + rs(r.valor) + ": você lidera", "ok"); Som.toca("meu"); anuncia("Seu lance de " + rs(r.valor) + " foi aceito"); }
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
    var chave = [V.estado, V.alterada, V.soOlhar, !!V.pedido, e ? e.formacao + ":" + e.tit.join(",") + ":" + e.n + ":" + e.aviso : "-", V.meu && V.meu.pronto, VIEW.selVaga].join("|");
    if (chave !== P.chave) { P.chave = chave; montaEscalacao(S, V); }
    tickEscalacao(S);
  }
  function montaEscalacao(S, V) {
    var P = VIEW.partes, c = P.corpo;
    TM.ui.clear(c);
    if (V.estado === "saguao" || V.pedido) {
      c.appendChild(el("div", { class: "next-match lei-cartao lei-embreve" }, [
        el("span", { class: "lei-embreve-ic" }, [ic("shirt")]),
        el("div", { class: "nm-label", text: "A escalação abre depois do leilão" }),
        el("p", { class: "intro-text", text: "No saguão você escolhe a sua formação preferida; o time vem das compras." }),
        el("div", { class: "lei-acoes" }, [botao("Ir ao saguão", function () { TM.ui.go("leilao-saguao"); }, "btn primary", "door-open")])
      ]));
      return;
    }
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
      if (V.estado === "camp" || V.estado === "fim") b.appendChild(el("div", { class: "lei-caixa lei-esc-camp" }, [
        el("p", { class: "intro-text", text: V.estado === "fim" ? "O campeonato acabou: esta foi a escalação do fim." : "A escalação mudada vale a partir do seu próximo jogo que ainda não começou." }),
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

  /* ---------- a aba Campeonato (PLANO-LEILAO.md §1.7, §1.8 e §2.6) ----------
     Tudo sai do ver().camp, que a sessão monta dos jogos GRAVADOS (nada aqui recalcula partida): "Seu jogo" (os escudos, o
     prazo pela hora do servidor, Simular partida; contra amigo, simulado ao abrir a rodada até o PR 5), "Simular os
     pendentes" (o dono, online), a rodada (‹ › por todas, cada jogo com o estado e o Ver o jogo), a tabela (pontos e misto),
     a chave (mata-mata e a fase final do misto), a artilharia e, no fim, o campeão, a classificação, o artilheiro e o melhor
     time. "Ver o jogo" e o "Simular partida" mostram o resultado GRAVADO no 2D sem pausa (rota leilao-jogo). */
  TM.ui.register("leilao-camp", function (screen) {
    var M = moldura(screen, "leilao-camp"); if (!M) return;
    M.corpo.classList.add("lei-corpo-camp");
    VIEW.partes = { corpo: M.corpo, chave: null, prazo: null, pendQuando: 0 };
    VIEW.tick = tickCamp;
    atualizaCamp(M.S, M.V);
  });
  function clubeDe(V, t) { var x = t != null ? V.tecnicos[t] : null; return x ? x.clube : null; }
  // o clube com o nome de outro técnico da sala (o "Meu Clube" de quem não tem o Ultimate): o primeiro nome do técnico
  // (ou "você") vai junto dele na aba Campeonato; null = o nome é único
  function chaveNome(n) { return String(n || "").trim().toLowerCase(); }
  function tecDoRepetido(V, t) {
    var x = t != null ? V.tecnicos[t] : null;
    if (!x || !x.clube) return null;
    var k = chaveNome(x.clube.nome);
    var rep = V.tecnicos.some(function (y, i) { return i !== t && y && y.clube && chaveNome(y.clube.nome) === k; });
    return !rep ? null : x.eu ? "você" : primeiroNome(x.nome);
  }
  function primeiroNome(n) { var p = String(n || "").trim().split(/\s+/)[0] || "Técnico"; return p.length > 12 ? p.slice(0, 11) + "…" : p; }
  function nomeClube(V, t) { var c = clubeDe(V, t), q = c ? tecDoRepetido(V, t) : null; return !c ? "A definir" : q ? c.nome + " (" + q + ")" : c.nome; }
  // o nome do clube numa linha estreita: o clube encolhe com as reticências e o técnico do nome repetido fica inteiro
  function nomeLinha(V, t, cls, vazio) {
    var x = t != null ? V.tecnicos[t] : null, q = tecDoRepetido(V, t);
    var n = el("span", { class: cls, text: x ? x.clube.nome : vazio });
    return q ? [n, el("span", { class: "lei-tec-tag", text: q })] : [n];
  }
  function quemTec(V, t) { var x = V.tecnicos[t]; return !x ? "" : x.eu ? "Você" : x.nome; }
  function placarDe(g) { return g.placar ? g.placar[0] + " × " + g.placar[1] : "×"; }
  // o que veio depois dos 90' (o texto curto): "pênaltis 4 × 3", "gol de ouro", "W.O."
  function extraDe(g) {
    var r = g.res; if (!r) return "";
    if (r.wo != null) return "W.O.";
    if (r.pen && r.pen.score) return "pênaltis " + r.pen.score[0] + " × " + r.pen.score[1];
    if (r.pror && r.pror.ouro != null) return "gol de ouro";
    return "";
  }
  function resultadoMeu(V, g) {
    var eu = V.eu, lado = g.a === eu ? 0 : 1, r = g.res || {};
    if (r.wo != null) return r.wo === lado ? "Derrota por W.O." : "Vitória por W.O.";
    var x = r.pen && r.pen.score ? " nos pênaltis (" + r.pen.score[lado] + " × " + r.pen.score[1 - lado] + ")" : r.pror && r.pror.ouro != null ? " no gol de ouro" : "";
    if (g.venc === eu) return "Vitória" + x;
    if (g.venc != null) return "Derrota" + x;
    return "Empate";
  }
  // o título da rodada ("Rodada 3 de 14"; no mata-mata o nome: "Semifinal") e a linha de baixo (a fase e o estado)
  function tituloRodada(C, R) { return R.fase === "liga" ? R.nome + " de " + C.rodadas.length : R.nome; }
  function faseRodada(C, R, i) {
    if (R.fase === "liga") return C.formato === "pontos" ? (R.turno === 2 ? "2º turno" : "1º turno") : "fase de pontos";
    return "rodada " + (i + 1) + " de " + C.rodadas.length;
  }
  function subRodada(C, R, i) { return faseRodada(C, R, i) + " · " + (R.feita ? "encerrada" : R.aberta ? "em andamento" : "ainda não abriu"); }
  function chaveCamp(V) {
    var C = V.camp;
    if (!C) return [V.estado, !!V.pedido, V.formato].join("|");
    var js = C.rodadas.map(function (R) {
      return R.jogos.map(function (g) { return g.id + ":" + g.e + ":" + (g.placar ? g.placar.join("-") : "") + ":" + g.a + ":" + g.b + ":" + extraDe(g); }).join(",") + "/" + R.folgas.join(",") + "/" + R.aberta;
    }).join("|");
    var mj = C.meuJogo;
    return JSON.stringify([V.estado, !!V.alterada, !!V.soOlhar, V.rede === "ok", js, C.atual, C.fim, mj && [mj.id, mj.e, mj.podeSimular, mj.motivo, mj.prazo ? mj.prazo.parado : null, mj.contraBot],
      C.folga, C.eliminado, C.pendentes, C.podePendentes, C.pendQuem, (C.pendLista || []).map(function (x) { return x.id + ":" + x.t; }).join(","),
      VIEW.campSel, VIEW.ocupado, pendVisivel(V),
      V.tecnicos.map(function (t) { return [t.clube.nome, t.clube.cor, t.clube.escudo, t.clube.sigla, t.nome, t.saiu, t.ausente]; })]);
  }
  // "Simular os pendentes" (online; o dono ou, com ele fora há mais de 5 min, qualquer técnico presente): só os jogos que
  // esperam por quem não está aqui, e só depois de a rodada estar aberta há 8 s (quem pisca não vira pendente)
  var PEND_ESPERA = 8000;
  function pendVisivel(V) {
    var C = V.camp;
    if (!C || !V.online || V.treino || !C.podePendentes || !C.rodada) return false;
    return V.agora - (C.rodada.abre || 0) >= PEND_ESPERA;
  }
  // o campeão na região ao vivo, uma vez por sala: na hora do fim ou, se a pessoa estava fora da sala (vendo um jogo no
  // 2D), quando ela volta ao Campeonato
  function falaFim(S, V) {
    var C = V && V.camp;
    if (!C || !C.fim || VIEW.fimFalado === S) return;
    VIEW.fimFalado = S;
    Som.toca("fim");
    anuncia("O campeonato acabou" + (C.campeao != null ? ": campeão " + nomeClube(V, C.campeao) : ""));
  }
  function atualizaCamp(S, V) {
    var P = VIEW.partes; if (!P) return;
    if (V.camp && V.camp.fim) falaFim(S, V);
    var chave = chaveCamp(V);
    if (chave !== P.chave) { P.chave = chave; montaCamp(S, V); }
    tickCamp(S);
  }
  function montaCamp(S, V) {
    var P = VIEW.partes, c = P.corpo, C = V.camp;
    // o foco do teclado volta ao mesmo botão depois de refazer (o ‹ › da rodada, o Simular, o Ver o jogo)
    var ae = doc.activeElement, foco = ae && c.contains(ae) && ae.dataset ? ae.dataset.foco || null : null;
    TM.ui.clear(c);
    P.prazo = null; P.pendQuando = 0;
    montaCampCorpo(S, V, C, c);
    if (foco) {
      var alvo = c.querySelector('[data-foco="' + foco + '"]');
      if ((!alvo || alvo.disabled) && /^rod-/.test(foco)) alvo = c.querySelector('[data-foco="' + (foco === "rod-ant" ? "rod-prox" : "rod-ant") + '"]');
      if (alvo && !alvo.disabled) { try { alvo.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  function montaCampCorpo(S, V, C, c) {
    var P = VIEW.partes;
    if (!C) {
      var antesSaguao = V.estado === "saguao" || !!V.pedido;
      c.appendChild(el("div", { class: "next-match lei-cartao lei-embreve" }, [
        el("span", { class: "lei-embreve-ic" }, [ic("trophy")]),
        el("div", { class: "nm-label", text: "O campeonato vem depois do leilão" }),
        el("p", { class: "intro-text", text: nomeFormato(V.formato) + ": " + fraseFormato(V.formato, V.T || 4).replace(/^./, function (x) { return x.toLowerCase(); }) +
          " Primeiro o leilão e a escalação; depois os jogos, simulados, e todos veem o mesmo resultado." }),
        el("div", { class: "lei-acoes" }, antesSaguao ? [
          botao("Ir ao saguão", function () { TM.ui.go("leilao-saguao"); }, "btn primary", "door-open")
        ] : [
          botao("Ver a escalação", function () { TM.ui.go("leilao-escalacao"); }, "btn", "shirt"),
          V.estado === "leilao" ? botao("Voltar ao leilão", function () { TM.ui.go("leilao-lote"); }, "btn primary", "gavel") : null
        ])
      ]));
      return;
    }
    var A = el("div", { class: "lei-camp-a" }), B = el("div", { class: "lei-camp-b" });
    if (C.fim) A.appendChild(fimCamp(S, V, C));
    else {
      A.appendChild(cabCamp(V, C));
      A.appendChild(seuJogo(S, V, C));
      if (pendVisivel(V)) A.appendChild(caixaPendentes(S, V, C));
      else if (V.online && !V.treino && C.podePendentes && C.rodada) P.pendQuando = (C.rodada.abre || 0) + PEND_ESPERA;
    }
    A.appendChild(caixaRodada(V, C));
    if (C.tabela) B.appendChild(caixaTabela(V, C));
    if (C.formato !== "pontos") B.appendChild(caixaChave(V, C));
    B.appendChild(caixaArtilharia(V, C));
    c.appendChild(A); c.appendChild(B);
  }
  function cabCamp(V, C) {
    var R = C.rodada;
    return el("div", { class: "lei-camp-cab" }, [
      el("h2", { class: "lei-camp-tit", text: nomeFormato(C.formato) }),
      el("span", { class: "lei-camp-sub", text: R ? tituloRodada(C, R) + " · " + faseRodada(C, R, C.atual) : "" })
    ]);
  }
  // um time grande ("Seu jogo"): o escudo, o clube e o técnico
  function timeGrande(V, t) {
    var x = t != null ? V.tecnicos[t] : null;
    return el("div", { class: "lei-sj-time" + (x && x.eu ? " eu" : "") }, [
      x ? escudo(x.clube, "") : el("span", { class: "lei-esc lei-esc-txt", text: "?" }),
      el("span", { class: "lei-sj-clube", text: x ? x.clube.nome : "A definir" }),
      el("span", { class: "lei-sj-tec", text: !x ? "" : x.eu ? "Você" : x.nome + (!x.bot && x.saiu ? " (saiu da sala)" : "") })
    ]);
  }
  function seuJogo(S, V, C) {
    var P = VIEW.partes, mj = C.meuJogo, R = C.rodada;
    var box = el("div", { class: "next-match lei-cartao lei-seujogo" });
    if (!mj) {
      box.classList.add("vazio");
      box.appendChild(el("div", { class: "nm-label", text: R ? R.nome : "Campeonato" }));
      box.appendChild(el("p", { class: "intro-text lei-sj-sem", text: C.folga ? "Você folga nesta rodada. Os outros jogos estão abaixo."
        : C.eliminado ? "Você foi eliminado. O campeonato segue: acompanhe abaixo." : V.eu < 0 ? "Você só está olhando esta sala." : "Sem jogo seu nesta rodada." }));
      return box;
    }
    var g = null;
    C.rodadas.forEach(function (Rx) { Rx.jogos.forEach(function (x) { if (x.id === mj.id) g = x; }); });
    var feito = mj.e === "feito";
    box.appendChild(el("div", { class: "nm-label", text: "Seu jogo · " + (R ? R.nome : "") }));
    var meio = feito ? [el("span", { class: "lei-sj-placar", text: placarDe(mj) }), g && extraDe(g) ? el("span", { class: "lei-sj-extra", text: extraDe(g) }) : null]
      : [el("span", { class: "lei-sj-x", text: "×" })];
    box.appendChild(el("div", { class: "lei-sj-times" }, [timeGrande(V, mj.a), el("div", { class: "lei-sj-meio" }, meio), timeGrande(V, mj.b)]));
    var est = el("p", { class: "lei-sj-estado" }), acoes = el("div", { class: "lei-acoes" });
    if (feito) {
      est.textContent = g ? resultadoMeu(V, g) : "Fim de jogo";
      est.classList.add(g && g.venc === V.eu ? "v" : g && g.venc != null ? "d" : "e");
      box.appendChild(est);
      if (R && !R.feita) box.appendChild(el("p", { class: "lei-sj-nota", text: "A próxima rodada abre quando os outros jogos desta acabarem." }));
      if (g && g.res && g.res.wo == null) { var bv = botao("Ver o jogo", function () { verJogo(mj.id); }, "btn primary", "play"); bv.dataset.foco = "sj-ver"; acoes.appendChild(bv); }
    } else if (mj.e === "reservado") {
      est.textContent = "Simulando…";
      box.appendChild(est);
    } else if (!mj.contraBot) {
      // contra um amigo, até o PR 5 (o Online 3D do par): simulado ao abrir a rodada
      est.textContent = "Contra um amigo: o jogo é simulado ao abrir a rodada.";
      box.appendChild(est);
    } else {
      P.prazo = est;
      box.appendChild(est);
      var ocupado = VIEW.ocupado === "simular";
      var bt = botao(ocupado ? "Simulando…" : "Simular partida", function () { simularMeu(S, bt); }, "btn primary", "fast-forward");
      bt.disabled = !mj.podeSimular || ocupado || !!VIEW.ocupado;
      bt.dataset.foco = "sj-simular"; bt.classList.add("lei-simular");
      if (ocupado) bt.setAttribute("aria-busy", "true");
      acoes.appendChild(bt);
      if (!mj.podeSimular && mj.motivo && mj.motivo !== "conferindo") box.appendChild(el("p", { class: "lei-sj-motivo", text: SS().textoMotivo(mj.motivo, { rede: V.rede }) }));
    }
    if (acoes.childNodes.length) box.appendChild(acoes);
    return box;
  }
  // o prazo do meu jogo contra um bot (a hora do servidor; no treino, o relógio da sala)
  function textoPrazo(mj, agora) {
    var pz = mj && mj.prazo;
    if (!pz) return "Toque em Simular partida. Sem o toque, ele é simulado sozinho em 2 min.";
    function mmss(ms) { var s = Math.ceil(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    if (pz.parado) return "Prazo parado em " + mmss(pz.resta) + ": volta a correr com você na sala.";
    var rest = pz.fim - agora;
    return rest > 0 ? "Simulado sozinho em " + mmss(rest) + " se você não tocar em Simular." : "O prazo acabou: simulando…";
  }
  function tickCamp(S) {
    var P = VIEW.partes, V = VIEW.V;
    if (!P || !V || !V.camp) return;
    if (P.pendQuando && S.hora() >= P.pendQuando) { P.pendQuando = 0; atualiza(); return; }
    if (!P.prazo) return;
    var txt = textoPrazo(V.camp.meuJogo, S.hora());
    if (P.prazo.textContent !== txt) P.prazo.textContent = txt;
  }
  function simularMeu(S, bt) {
    if (VIEW.ocupado) return;
    VIEW.ocupado = "simular";
    if (bt) { bt.disabled = true; bt.setAttribute("aria-busy", "true"); var r0 = bt.querySelector("span:last-child"); if (r0) r0.textContent = "Simulando…"; }
    S.simular().then(function (r) {
      if (!r || !r.ok) { VIEW.ocupado = null; TM.ui.toast(SS().textoMotivo(r && r.motivo, r || {}), "erro"); atualiza(); return; }
      // gravado: só então o 2D (sem pausa) mostra o que ficou gravado — com o jogo feito também na vista desta página (a
      // resposta da transação pode chegar antes do dado novo pelo ouvinte: sem esperar, a rota do 2D não achava o jogo
      // feito e voltava ao Campeonato)
      function abre() { return sessao() === S && TM.ui.current() === "leilao-camp" && !VIEW.ocupado && !!S.partida(r.id); }
      quandoNaVista(S, r.id, function () {
        VIEW.ocupado = null;
        if (abre()) verJogo(r.id);
        else atualiza();
      }, function () { if (abre()) verJogo(r.id); });
    }, function (e) {
      VIEW.ocupado = null;
      if (global.console) console.error(e);
      TM.ui.toast("Não deu para simular: tente de novo.", "erro");
      atualiza();
    });
  }
  // chama fim() quando o jogo gravado já está na vista da sessão (S.partida), ou em 8 s; o que chega depois dos 8 s (a rede
  // lenta) chama tarde(), até 2 min (a pessoa ainda no Campeonato vê o jogo que pediu)
  function quandoNaVista(S, id, fim, tarde) {
    if (S.partida(id)) { fim(); return; }
    var feito = false, off = null, t = null, t2 = null;
    function solta() { if (off) off(); off = null; clearTimeout(t); clearTimeout(t2); }
    off = S.aoMudar(function () {
      if (!S.partida(id)) return;
      solta();
      if (!feito) { feito = true; fim(); } else if (tarde) tarde();
    });
    t = setTimeout(function () { if (feito) return; feito = true; fim(); }, 8000);
    t2 = setTimeout(solta, 120000);
  }
  function caixaPendentes(S, V, C) {
    var oc = VIEW.ocupado === "pendentes";
    var bt = botao(oc ? "Simulando…" : "Simular os pendentes", function () {
      if (VIEW.ocupado) return;
      VIEW.ocupado = "pendentes"; atualiza();
      S.simularPendentes().then(function (r) {
        VIEW.ocupado = null;
        if (!r || !r.ok) TM.ui.toast(SS().textoMotivo(r && r.motivo, r || {}), "erro");
        else { TM.ui.toast(r.n === 1 ? "1 jogo simulado." : r.n + " jogos simulados.", "ok"); anuncia(r.n === 1 ? "1 jogo simulado" : r.n + " jogos simulados"); }
        atualiza();
      }, function () { VIEW.ocupado = null; TM.ui.toast("Falha na conexão: tente de novo", "erro"); atualiza(); });
    }, "btn", "fast-forward");
    bt.disabled = !!VIEW.ocupado || !podeAgir(V);
    bt.dataset.foco = "pendentes"; bt.classList.add("lei-pend-bt");
    // quais jogos e de quem: quem não está aqui em destaque
    var lista = el("ul", { class: "lei-pend-lista" }, (C.pendLista || []).map(function (x) {
      var y = V.tecnicos[x.t];
      return el("li", { class: "lei-pend-j", data: { jogo: x.id } }, [
        el("span", { class: "lei-pend-quem", text: (y ? y.nome : "Técnico") + " não está aqui" }),
        el("span", { class: "lei-pend-cl", text: nomeClube(V, x.a) + " × " + nomeClube(V, x.b) })
      ]);
    }));
    return el("div", { class: "lei-caixa lei-pend" }, [
      el("div", { class: "lei-pend-txt" }, [
        el("span", { class: "lei-pend-t", text: C.pendentes === 1 ? "1 jogo esperando quem não está aqui" : C.pendentes + " jogos esperando quem não está aqui" }),
        el("span", { class: "lei-pend-s", text: C.pendQuem === "outro"
          ? "O dono não está aqui há mais de 5 min: qualquer técnico pode simular estes jogos para a rodada andar."
          : "Você é o dono da sala: simule os jogos de quem não está aqui para a rodada andar." }),
        lista
      ]),
      bt
    ]);
  }
  // a rodada à mostra (‹ › por todas; começa na da vez): cada jogo com o placar, o estado e o Ver o jogo
  function caixaRodada(V, C) {
    var n = C.rodadas.length, i = VIEW.campSel != null ? VIEW.campSel : (C.atual >= 0 ? C.atual : n - 1);
    i = Math.max(0, Math.min(n - 1, i));
    var R = C.rodadas[i];
    function vai(k) { VIEW.campSel = Math.max(0, Math.min(n - 1, k)); atualiza(); }
    var ant = el("button", { class: "lei-rod-bt", type: "button", "aria-label": "Rodada anterior", title: "Rodada anterior", data: { foco: "rod-ant" }, on: { click: function () { vai(i - 1); } } }, [ic("chevron-left")]);
    var prox = el("button", { class: "lei-rod-bt", type: "button", "aria-label": "Próxima rodada", title: "Próxima rodada", data: { foco: "rod-prox" }, on: { click: function () { vai(i + 1); } } }, [ic("chevron-right")]);
    ant.disabled = i <= 0; prox.disabled = i >= n - 1;
    var box = el("div", { class: "lei-caixa lei-rodada", data: { rodada: String(R.n) } }, [
      el("div", { class: "lei-rod-cab" }, [ant, el("div", { class: "lei-rod-tit", "aria-live": "polite" }, [
        el("span", { class: "lei-rod-n", text: tituloRodada(C, R) }), el("span", { class: "lei-rod-s", text: subRodada(C, R, i) })
      ]), prox])
    ]);
    var ul = el("ul", { class: "lei-jogos" });
    R.jogos.forEach(function (g) { ul.appendChild(linhaJogo(V, C, g, R)); });
    box.appendChild(ul);
    if (R.folgas.length) box.appendChild(el("p", { class: "lei-rod-folga", text: "Folga: " + R.folgas.map(function (t) { return nomeClube(V, t); }).join(", ") }));
    if (C.atual >= 0 && i !== C.atual) { var bv = botao("Ir à rodada da vez", function () { VIEW.campSel = null; atualiza(); }, "btn small", "calendar"); bv.dataset.foco = "rod-vez"; box.appendChild(el("div", { class: "lei-acoes" }, [bv])); }
    return box;
  }
  function estadoJogo(g) {
    if (g.a == null || g.b == null) return ["def", "A definir"];
    if (g.e === "feito") { var x = extraDe(g); return ["feito", x === "W.O." ? "W.O." : "Simulado" + (x ? " · " + x : "")]; }
    if (g.e === "reservado") return ["anda", "Simulando…"];
    if (!g.aberta) return ["fechado", "Esperando a rodada"];
    return ["espera", "Esperando"];
  }
  function timeLinha(V, t, lado) {
    var x = t != null ? V.tecnicos[t] : null;
    return el("span", { class: "lei-jg-t " + lado + (x && x.eu ? " eu" : ""), title: x ? x.clube.nome + " · " + (x.eu ? "você" : x.nome) : "A definir" }, [
      x ? escudo(x.clube, "pp") : el("span", { class: "lei-esc pp lei-esc-txt", text: "?" })
    ].concat(nomeLinha(V, t, "lei-jg-nome", "A definir")));
  }
  function linhaJogo(V, C, g, R) {
    var meu = V.eu >= 0 && (g.a === V.eu || g.b === V.eu), est = estadoJogo(g);
    var li = el("li", { class: "lei-jogo" + (meu ? " meu" : ""), data: { jogo: g.id, e: g.e } }, [
      el("div", { class: "lei-jg-lin" }, [timeLinha(V, g.a, "a"), el("span", { class: "lei-jg-pl" + (g.e === "feito" ? " feito" : ""), text: placarDe(g) }), timeLinha(V, g.b, "b")])
    ]);
    var pe = el("div", { class: "lei-jg-pe" }, [el("span", { class: "lei-jg-est " + est[0], text: est[1] })]);
    if (g.e === "feito" && g.res && g.res.wo == null) {
      pe.appendChild(el("button", { class: "lei-jg-ver", type: "button", data: { foco: "ver-" + g.id }, "aria-label": "Ver o jogo " + nomeClube(V, g.a) + " " + placarDe(g) + " " + nomeClube(V, g.b),
        on: { click: function () { verJogo(g.id); } } }, [el("span", { class: "lei-bt-ic" }, [ic("play")]), el("span", { text: "Ver o jogo" })]));
    }
    li.appendChild(pe);
    return li;
  }
  // a tabela da fase de pontos (pontos corridos e o misto): # · Clube · J · V · E · D · SG · Pts
  function caixaTabela(V, C) {
    var misto = C.formato === "misto", nClass = C.T <= 4 ? 2 : 4;
    var box = el("div", { class: "lei-caixa lei-tab-box" }, [el("div", { class: "lei-rotulo", text: misto ? "Fase de pontos" : "Classificação" })]);
    var cab = [["#", "Posição"], ["Clube", null], ["J", "Jogos"], ["V", "Vitórias"], ["E", "Empates"], ["D", "Derrotas"], ["SG", "Saldo de gols"], ["Pts", "Pontos"]];
    var thead = el("thead", {}, [el("tr", {}, cab.map(function (x, k) {
      var th = el("th", { scope: "col", class: "c" + k + (k >= 3 && k <= 5 ? " ved" : ""), text: x[0] });
      if (x[1]) th.setAttribute("title", x[1]);
      if (x[1] && x[1] !== x[0]) th.setAttribute("aria-label", x[1]);
      return th;
    }))]);
    var tbody = el("tbody");
    C.tabela.forEach(function (r) {
      var x = V.tecnicos[r.t], eu = r.t === V.eu, cls = (eu ? "eu" : "") + (misto && r.pos <= nClass ? " classif" : "");
      tbody.appendChild(el("tr", { class: cls.trim() }, [
        el("td", { class: "c0", text: String(r.pos) }),
        el("td", { class: "c1" }, [el("span", { class: "lei-tab-clube", title: x ? x.clube.nome + " · " + (x.eu ? "você" : x.nome) : "" }, [escudo(x && x.clube, "pp")].concat(nomeLinha(V, r.t, "lei-tab-n", "")))]),
        el("td", { class: "c2", text: String(r.j) }), el("td", { class: "c3 ved", text: String(r.v) }), el("td", { class: "c4 ved", text: String(r.e) }), el("td", { class: "c5 ved", text: String(r.d) }),
        el("td", { class: "c6", text: (r.sg > 0 ? "+" : "") + r.sg }), el("td", { class: "c7", text: String(r.pts) })
      ]));
    });
    box.appendChild(el("div", { class: "lei-tab-rola" }, [el("table", { class: "lei-tabela" }, [thead, tbody])]));
    box.appendChild(el("p", { class: "lei-tab-nota", text: misto ? (nClass === 2 ? "Os 2 primeiros fazem a final." : "Os 4 primeiros vão às semifinais: 1º × 4º e 2º × 3º.") + " Desempate: pontos, saldo, gols pró, confronto direto e sorteio."
      : "Desempate: pontos, saldo, gols pró, confronto direto e sorteio." }));
    return box;
  }
  // a chave do mata-mata (no misto, a fase final): cada rodada com os jogos e as folgas; o vencedor em destaque
  function caixaChave(V, C) {
    var mata = C.rodadas.filter(function (R) { return R.fase === "mata"; });
    var box = el("div", { class: "lei-caixa lei-chave-box" }, [el("div", { class: "lei-rotulo", text: C.formato === "misto" ? "Mata-mata" : "Chave" })]);
    if (C.formato === "misto" && !C.ligaFeita) box.appendChild(el("p", { class: "lei-tab-nota", text: "Os classificados entram quando a fase de pontos acabar." }));
    var grade = el("div", { class: "lei-chave" + (mata.length >= 3 ? " tres" : "") });
    mata.forEach(function (R) {
      var col = el("div", { class: "lei-ch-col" }, [el("div", { class: "lei-ch-tit", text: R.nome })]);
      R.jogos.forEach(function (g) {
        var pen = g.res && g.res.pen && g.res.pen.score;
        function lado(t, k) {
          var x = t != null ? V.tecnicos[t] : null, venc = g.e === "feito" && g.venc === t && t != null;
          return el("div", { class: "lei-ch-l" + (venc ? " venc" : "") + (x && x.eu ? " eu" : "") + (g.e === "feito" && !venc ? " perdeu" : "") }, [
            x ? escudo(x.clube, "pp") : el("span", { class: "lei-esc pp lei-esc-txt", text: "?" })
          ].concat(nomeLinha(V, t, "lei-ch-n", "A definir"), [
            el("span", { class: "lei-ch-g", text: g.e === "feito" && g.placar ? String(g.placar[k]) + (pen ? " (" + pen[k] + ")" : "") : "" })
          ]));
        }
        col.appendChild(el("div", { class: "lei-ch-jogo", data: { jogo: g.id } }, [lado(g.a, 0), lado(g.b, 1)]));
      });
      R.folgas.forEach(function (t) {
        var x = V.tecnicos[t];
        col.appendChild(el("div", { class: "lei-ch-jogo folga" }, [el("div", { class: "lei-ch-l" + (x && x.eu ? " eu" : "") }, [
          escudo(x && x.clube, "pp")].concat(nomeLinha(V, t, "lei-ch-n", ""), [el("span", { class: "lei-ch-g folga", text: "folga" })])
        )]));
      });
      grade.appendChild(col);
    });
    box.appendChild(grade);
    return box;
  }
  function caixaArtilharia(V, C) {
    var box = el("div", { class: "lei-caixa lei-art-box" }, [el("div", { class: "lei-rotulo", text: "Artilharia" })]);
    var lista = (C.artilharia || []).slice(0, 5);
    if (!lista.length) { box.appendChild(el("p", { class: "lei-vazio", text: "Ninguém marcou ainda." })); return box; }
    var ol = el("ol", { class: "lei-art" }), pos = 0, ant = -1;
    lista.forEach(function (x, k) {
      if (x.gols !== ant) { pos = k + 1; ant = x.gols; }
      var cl = clubeDe(V, x.t);
      ol.appendChild(el("li", { class: "lei-art-l" + (x.t === V.eu ? " eu" : "") }, [
        el("span", { class: "lei-art-p", text: pos + "º" }), escudo(cl, "pp"),
        el("span", { class: "lei-art-txt" }, [el("span", { class: "lei-art-n", text: x.nome }), el("span", { class: "lei-art-s", text: cl ? nomeClube(V, x.t) : "" })]),
        el("span", { class: "lei-art-g", text: x.gols + (x.gols === 1 ? " gol" : " gols") })
      ]));
    });
    box.appendChild(ol);
    return box;
  }
  /* o fim (§1.8): o campeão em destaque (o pôster do fim de jogo do TM com o escudo desenhado), a classificação final, o
     artilheiro, o melhor time pela soma das notas, "Voltar" e "Criar outra sala" */
  function campanha(V, C, t) {
    if (C.formato === "pontos") {
      var r = (C.tabela || []).filter(function (x) { return x.t === t; })[0];
      return r ? r.pts + " pontos em " + r.j + " jogos · " + r.v + (r.v === 1 ? " vitória" : " vitórias") : "";
    }
    var fin = null;
    C.rodadas.forEach(function (R) { if (R.fase === "mata") R.jogos.forEach(function (g) { if (g.a === t || g.b === t) fin = g; }); });
    if (!fin || !fin.placar) return "";
    var lado = fin.a === t ? 0 : 1, adv = lado ? fin.a : fin.b, x = extraDe(fin);
    var s = "Final: " + fin.placar[lado] + " × " + fin.placar[1 - lado] + " contra " + nomeClube(V, adv);
    if (fin.res && fin.res.pen && fin.res.pen.score) s += " (pênaltis " + fin.res.pen.score[lado] + " × " + fin.res.pen.score[1 - lado] + ")";
    else if (x === "gol de ouro") s += " no gol de ouro";
    return s;
  }
  // até onde cada um foi (mata-mata e misto): Campeão, Vice, a rodada em que caiu ou a fase de pontos; nos pontos, os pontos
  function alcanceDe(V, C, t, i) {
    if (C.formato === "pontos") { var r = (C.tabela || []).filter(function (x) { return x.t === t; })[0]; return r ? r.pts + (r.pts === 1 ? " ponto" : " pontos") : ""; }
    if (i === 0) return "Campeão";
    var caiu = null;
    C.rodadas.forEach(function (R) { if (R.fase === "mata") R.jogos.forEach(function (g) { if ((g.a === t || g.b === t) && g.e === "feito" && g.venc !== t) caiu = R; }); });
    if (caiu) return caiu.nome === "Final" ? "Vice" : caiu.nome;
    if (C.formato === "misto") { var p = (C.tabela || []).filter(function (x) { return x.t === t; })[0]; return p ? "Fase de pontos · " + p.pos + "º" : "Fase de pontos"; }
    return "";
  }
  function fimCamp(S, V, C) {
    var wrap = el("div", { class: "lei-fim" }), t = C.campeao, x = V.tecnicos[t], eu = t === V.eu;
    var meuLugar = V.eu >= 0 ? C.classificacao.indexOf(V.eu) + 1 : 0;
    var pill = eu ? ["v", "Você é o campeão"] : meuLugar ? ["e", "Seu lugar: " + meuLugar + "º"] : ["e", "Campeão"];
    wrap.appendChild(el("div", { class: "md-poster fim lei-campeao res-v", role: "group", "aria-label": "Campeão: " + (x ? x.clube.nome : "") }, [
      el("span", { class: "mdp-foto mdp-neutro" }), el("span", { class: "mdp-tinta" }), el("span", { class: "mdp-veu" }), el("span", { class: "mdp-faixas" }),
      el("div", { class: "mdp-topo" }, [el("span", { class: "mdp-sobre", text: "Campeão" }), el("span", { class: "mdp-data", text: nomeFormato(C.formato) + " · " + ((V.liga && V.liga.nome) || "Leilão") })]),
      el("div", { class: "lei-cp-centro" }, [
        el("span", { class: "lei-cp-coroa" }, [ic("crown")]),
        escudo(x && x.clube, "g"),
        el("span", { class: "mdp-nome lei-cp-nome", text: x ? x.clube.nome : "" }),
        el("span", { class: "lei-cp-tec", text: x ? (x.eu ? "Você" : x.nome) : "" }),
        el("span", { class: "lei-cp-camp", text: campanha(V, C, t) })
      ]),
      el("div", { class: "mdp-res " + pill[0], text: pill[1] })
    ]));
    // a classificação final
    var ol = el("ol", { class: "lei-class" });
    C.classificacao.forEach(function (tt, i) {
      var y = V.tecnicos[tt];
      ol.appendChild(el("li", { class: "lei-cl" + (tt === V.eu ? " eu" : "") + (i === 0 ? " campeao" : "") }, [
        el("span", { class: "lei-cl-p", text: (i + 1) + "º" }), escudo(y && y.clube, "pp"),
        el("span", { class: "lei-cl-txt" }, [el("span", { class: "lei-cl-n", text: y ? y.clube.nome : "" }), el("span", { class: "lei-cl-s", text: y ? (y.eu ? "Você" : y.nome) : "" })]),
        el("span", { class: "lei-cl-x", text: alcanceDe(V, C, tt, i) })
      ]));
    });
    wrap.appendChild(el("div", { class: "lei-caixa lei-class-box" }, [el("div", { class: "lei-rotulo", text: "Classificação final" }), ol]));
    // o artilheiro e o melhor time pela soma das notas
    var art = (C.artilharia || [])[0], mt = C.melhorTime, clArt = art ? clubeDe(V, art.t) : null, clMt = mt ? clubeDe(V, mt.t) : null;
    var empArt = art ? C.artilharia.filter(function (y) { return y.gols === art.gols; }).length - 1 : 0;
    wrap.appendChild(el("div", { class: "lei-destaques" }, [
      el("div", { class: "lei-caixa lei-dest" }, [el("span", { class: "lei-dest-ic" }, [ic("target")]), el("div", { class: "lei-dest-txt" }, [
        el("span", { class: "lei-rotulo", text: "Artilheiro" }),
        el("span", { class: "lei-dest-n", text: art ? art.nome : "Ninguém marcou" }),
        el("span", { class: "lei-dest-s", text: art ? art.gols + (art.gols === 1 ? " gol" : " gols") + " · " + (clArt ? clArt.nome : "") + (empArt ? " (empatado com " + empArt + (empArt === 1 ? " outro)" : " outros)") : "") : "" })
      ])]),
      el("div", { class: "lei-caixa lei-dest" }, [el("span", { class: "lei-dest-ic" }, [ic("award")]), el("div", { class: "lei-dest-txt" }, [
        el("span", { class: "lei-rotulo", text: "Melhor time pela soma das notas" }),
        el("span", { class: "lei-dest-n", text: clMt ? clMt.nome : "" }),
        el("span", { class: "lei-dest-s", text: mt ? "Soma das notas dos 11: " + mt.soma + (mt.t === V.eu ? " · o seu" : "") : "" })
      ])])
    ]));
    wrap.appendChild(el("div", { class: "lei-acoes lei-fim-acoes" }, [
      botao("Voltar", function () { TM.ui.go("leilao"); }, "btn", "chevron-left"),
      botao("Criar outra sala", function () { TM.ui.go("leilao-criar", V.online && !V.treino ? { online: true } : {}); }, "btn primary", "gavel")
    ]));
    return wrap;
  }

  /* ---------- "Ver o jogo": o resultado GRAVADO no 2D, sem pausa (rota leilao-jogo) ----------
     O TM.matchview.play com pauseSide null: sem o botão de pausa (a pausa sortearia o resto de novo: resimRest) e sem o 3D
     (o tm3d.js só entra com um lado do jogador). Depois dos 90', a prorrogação com o gol de ouro e os pênaltis, também os
     gravados. Fora das rotas da sala: no treino o relógio para enquanto a pessoa vê o jogo. */
  function verJogo(id) { TM.ui.go("leilao-jogo", { id: id }); }
  function copiaRes(x) { return x == null ? null : JSON.parse(JSON.stringify(x)); }
  TM.ui.register("leilao-jogo", function (screen, params) {
    var S = sessao(), J = S && params && params.id && S.partida ? S.partida(params.id) : null;
    if (!J || !J.res || !TM.matchview || J.res.wo != null) { TM.ui.go(S ? "leilao-camp" : "leilao"); return; }
    screen.classList.add("lei-jogo-tela");
    var res = copiaRes(J.res), A = J.times[0], B = J.times[1], V = S.ver(), C = V.camp, R = null;
    if (C) C.rodadas.forEach(function (Rx) { if (Rx.n === J.rodada) R = Rx; });
    var titulo = (R ? R.nome : "Campeonato") + " · Leilão";
    VIEW.jogoVisto = J.id;
    function volta() { TM.ui.go("leilao-camp"); }
    TM.matchview.play(screen, {
      teamA: A, teamB: B,
      result: { score: (res.score || [0, 0]).slice(), events: res.events || [], stats: res.stats || null, sentOff: res.sentOff || [], injuries: [] },
      pauseSide: null, simOpts: { realism: 3, neutral: true }, formation: A.formation, formationB: B.formation,
      title: titulo, onBack: volta,
      onDone: function () {
        if (!res.pror) { volta(); return; }
        TM.ui.go("prorrogacao", {
          a: A.name, b: B.name, de: (res.score || [0, 0]).slice(), para: (res.pror.score || res.placar).slice(), ev: res.pror.events || [], golDeOuro: true, pen: !!res.pen, title: titulo,
          onDone: function () {
            if (!res.pen) { volta(); return; }
            TM.ui.go("pen-shootout", { teamA: A, teamB: B, shoot: res.pen, title: "Pênaltis · " + titulo, onDone: volta });
          }
        });
      }
    });
  });

  /* ---------- o Saguão (aba Saguão, só no online) ---------- */
  // a pessoa pode agir na sala agora (a conexão em dia, esta aba no comando, as regras iguais, a sala inteira)
  function podeAgir(V) { return !!V && V.rede === "ok" && !V.outraAba && !V.soOlhar && !V.alterada && V.conectado !== false; }
  // por que a pessoa não age agora (o podeAgir falso): a mesma ordem da faixa da sala; a conexão de pé com a sala ainda
  // atrasada diz "Atualizando a sala…"/"Reconectando…", não "Sem conexão"
  function motivoAgir(V) {
    var m = V.outraAba ? "outraAba" : V.alterada ? "alterada" : V.soOlhar ? "regras" : "conexao";
    return SS().textoMotivo(m, { rede: V.rede });
  }
  function papelDe(t) { return t.bot ? "Bot de treino" : t.papel === "dono" ? "Dono da sala" : "Técnico"; }
  // o estado de cada um (o selo da direita): no saguão Pronto / Falta confirmar; depois, Ausente / Saiu e o do lote
  function seloDe(V, t) {
    if (t.bot) return ["bot", "Bot"];
    if (V.online && t.saiu) return ["saiu", "Saiu"];
    if (V.online && t.ausente && !t.eu) return ["ausente", "Ausente"];
    if (V.estado === "saguao") return t.pronto ? ["pronto", "Pronto"] : ["falta", "Falta confirmar"];
    if (V.estado === "leilao") { var e = estadoTec(t); if (e[1]) return e; }
    return V.online ? ["pronto", "Presente"] : ["", ""];
  }
  // uma linha de participante (o Saguão e a folha Participantes); acoes = os botões do dono (Tirar)
  function linhaPart(V, t, acoes, comSaldo) {
    var s = seloDe(V, t);
    return el("div", { class: "lei-part" + (t.eu ? " eu" : "") + (t.ausente && !t.eu ? " longe" : ""), data: { uid: t.uid } }, [
      escudo(t.clube, "p"),
      el("span", { class: "lei-tec-nome" }, [
        el("span", { class: "lei-tec-quem" }, [
          el("span", { class: "lei-part-n", text: t.nome }),
          t.num && !t.bot ? el("span", { class: "lei-num", text: "#" + t.num }) : null,
          t.eu ? el("span", { class: "lei-voce", text: "VOCÊ" }) : null
        ]),
        el("span", { class: "lei-tec-clube", text: t.clube.nome + " · " + papelDe(t) })
      ]),
      // o saldo, o selo e os botões do dono: passam para a linha de baixo quando falta espaço para o nome
      el("span", { class: "lei-part-dir" }, [
        comSaldo ? el("span", { class: "lei-tec-dir" }, [el("b", { class: "lei-tec-saldo", text: rs(t.saldo) }), el("span", { class: "lei-tec-n", text: t.n + "/" + L().VAGAS })]) : null,
        s[1] ? el("span", { class: "lei-selo " + s[0], text: s[1] }) : null
      ].concat(acoes || []))
    ]);
  }
  // uma seção refeita só quando a chave muda; o foco do teclado volta ao mesmo botão (data-foco) depois de refeita
  // Sem o botão (o pedido aceito sumiu da lista), o foco vai ao próximo do mesmo tipo (o Aceitar do próximo pedido) ou ao
  // rótulo da seção; com os botões apagados (a ação em curso), fica no rótulo e volta a eles na refeita seguinte: nunca cai
  // no começo da página.
  function secao(P, nome, chave, monta) {
    var box = P[nome]; if (!box) return;
    if (P.k[nome] === chave) return;
    P.k[nome] = chave;
    P.fp = P.fp || {};
    var a = doc.activeElement, foco = a && box.contains(a) && a.dataset ? a.dataset.foco : null, sel = null;
    if (!foco && P.fp[nome] && (!a || a === doc.body || box.contains(a))) foco = P.fp[nome];
    delete P.fp[nome];
    if (foco && a && a.dataset && a.dataset.foco === foco && a.tagName === "INPUT") { try { sel = [a.selectionStart, a.selectionEnd]; } catch (e) { sel = null; } }
    TM.ui.clear(box);
    monta(box);
    if (!foco) return;
    var f = box.querySelector('[data-foco="' + foco + '"]');
    if (f && !f.disabled) { try { f.focus(); if (sel && f.setSelectionRange) f.setSelectionRange(sel[0], sel[1]); } catch (e) {} return; }
    if (f) { P.fp[nome] = foco; focaRotulo(box); return; }
    var tipo = foco.split("-")[0], livres = [].slice.call(box.querySelectorAll("[data-foco]")).filter(function (x) { return !x.disabled; });
    var g = livres.filter(function (x) { return x.dataset.foco.split("-")[0] === tipo; })[0] || livres[0];
    if (g) { try { g.focus(); } catch (e) {} return; }
    // nenhum botão livre agora (a ação em curso apaga todos): o rótulo segura o foco e a próxima refeita tenta de novo
    P.fp[nome] = foco; focaRotulo(box);
  }
  function focaRotulo(box) {
    var r = box.querySelector(".lei-rotulo"); if (!r) return;
    r.setAttribute("tabindex", "-1");
    try { r.focus({ preventScroll: true }); } catch (e) {}
  }
  TM.ui.register("leilao-saguao", function (screen) {
    var M = moldura(screen, "leilao-saguao"); if (!M) return;
    M.corpo.classList.add("lei-corpo-sag");
    VIEW.partes = { corpo: M.corpo, modo: null, k: {} };
    VIEW.partes.sagBar = barraSaguao(screen);
    VIEW.tick = null;
    atualizaSaguao(M.S, M.V);
  });
  function modoSaguao(V) {
    if (!V.online || V.treino) return "treino";
    if (V.pedido) return "pedido";
    return V.estado === "saguao" ? "saguao" : "depois";
  }
  function atualizaSaguao(S, V) {
    var P = VIEW.partes; if (!P || !P.k) return;
    var modo = modoSaguao(V);
    if (modo !== P.modo) { P.modo = modo; P.k = {}; montaSaguao(S, V); }
    if (modo === "pedido") secao(P, "sPed", JSON.stringify(V.pedido), function (b) { poePedido(b, S, V); });
    if (modo === "saguao" || modo === "depois") {
      secao(P, "sCab", JSON.stringify([modo, V.cfg, V.saguao && [V.saguao.vagas, V.saguao.bots], V.liga, V.versaoDiferente]), function (b) { poeCabSaguao(b, V, modo); });
      secao(P, "sConv", [V.codigo, VIEW.codigoVisivel, modo, V.souDono].join("|"), function (b) { poeConvite(b, V, modo); });
      var ag = podeAgir(V), oc = VIEW.ocupado || "";
      if (modo === "saguao") {
        secao(P, "sPedidos", JSON.stringify([V.souDono, V.saguao.pedidos, V.saguao.lotada, ag, oc]), function (b) { poePedidos(b, S, V); });
        secao(P, "sCfg", JSON.stringify([V.souDono, V.cfg, V.saguao.humanos, ag, oc]), function (b) { poeConfig(b, S, V); });
        var eu = V.tecnicos[V.eu] || null;
        var usadas = V.tecnicos.filter(function (t) { return !t.bot && !t.eu; }).map(function (t) { return String(t.clube.cor).toLowerCase(); }).sort();
        secao(P, "sClube", JSON.stringify([eu && SS().limpaClube(eu.clube), eu && eu.formacao, usadas, ag, oc === "clube" || oc === "forma"]), function (b) { poeMeuClube(b, S, V, usadas); });
      } else secao(P, "sPedidos", JSON.stringify([V.souDono, V.pedidosDepois, V.tecnicos.map(function (t) { return [t.uid, t.nome, t.papel, t.saiu, t.ausente]; }), ag, oc]), function (b) { poePedidosDepois(b, S, V); });
      secao(P, "sPart", JSON.stringify([modo, V.souDono, ag, oc, V.saguao && V.saguao.vagas, V.tecnicos.map(function (t) {
        return [t.uid, t.nome, t.num, t.papel, t.pronto, t.ausente, t.saiu, t.clube, t.eu];
      })]), function (b) { poeParticipantes(b, S, V, modo); });
    }
    atualizaBarraSag(V);
  }
  function montaSaguao(S, V) {
    var P = VIEW.partes, c = P.corpo;
    TM.ui.clear(c);
    c.classList.remove("uma");
    ["sPed", "sCab", "sConv", "sPedidos", "sPart", "sCfg", "sClube", "espaco"].forEach(function (k) { P[k] = null; });
    if (P.modo === "treino") {
      c.classList.add("uma");
      c.appendChild(el("div", { class: "next-match lei-cartao lei-embreve" }, [
        el("div", { class: "nm-label", text: "O treino começa direto no leilão" }),
        el("div", { class: "lei-acoes" }, [botao("Ir ao leilão", function () { TM.ui.go(rotaDoEstado(S.ver())); }, "btn primary", "gavel")])
      ]));
    } else if (P.modo === "pedido") {
      P.sPed = el("div", { class: "lei-sec" }); c.appendChild(P.sPed);
      c.classList.add("uma");
    } else {
      P.sCab = el("div", { class: "lei-sec lei-sag-cab" });
      P.sConv = el("section", { class: "lei-caixa lei-convite", "aria-label": "Convite" });
      P.sPedidos = el("section", { class: "lei-caixa lei-pedidos", "aria-label": "Pedidos de entrada" });
      P.sPart = el("section", { class: "lei-caixa lei-parts", "aria-label": "Participantes" });
      // a ordem: o resumo, o convite e os pedidos (o dono age), os participantes, a configuração e o meu clube (no PC, duas
      // colunas: à esquerda o convite, os pedidos e os participantes; à direita a configuração e o meu clube)
      var ca = el("div", { class: "lei-col-a" }), cb = el("div", { class: "lei-col-b" });
      c.appendChild(P.sCab); ca.appendChild(P.sConv); ca.appendChild(P.sPedidos); ca.appendChild(P.sPart);
      c.appendChild(ca);
      if (P.modo === "saguao") {
        P.sCfg = el("section", { class: "lei-caixa lei-cfg", "aria-label": "Configuração da sala" });
        P.sClube = el("section", { class: "lei-caixa lei-meuclube", "aria-label": "Meu clube" });
        cb.appendChild(P.sCfg); cb.appendChild(P.sClube);
        c.appendChild(cb);
      } else c.classList.add("uma");
    }
    P.espaco = el("div", { class: "lei-espaco", "aria-hidden": "true" });
    c.appendChild(P.espaco);
  }
  // o pedido esperando o dono (antes do Começar: aceitar; depois: passar o clube de quem trocou de aparelho)
  function poePedido(b, S, V) {
    var p = V.pedido, esperando = p.estado === "esperando";
    b.appendChild(el("div", { class: "next-match lei-cartao lei-pedido-meu" }, [
      el("span", { class: "lei-embreve-ic" }, [ic(esperando ? "hourglass" : "circle-x")]),
      el("div", { class: "nm-label", text: !esperando ? "O pedido saiu da sala" : p.depois ? "O leilão já começou" : "Pedido enviado" }),
      el("p", { class: "intro-text", text: !esperando ? "O seu pedido não está mais na sala. Peça de novo pelo código, se quiser."
        : p.depois ? "Esperando o dono passar o seu clube para esta conta (como quem trocou de aparelho ou limpou os dados)."
        : "Esperando o dono aceitar. Assim que ele aceitar, você entra no saguão." }),
      el("div", { class: "lei-acoes" }, [botao(esperando ? "Cancelar o pedido" : "Voltar ao início", function () {
        S.sair().then(function () { saiuDaSala(); TM.ui.go("leilao"); });
      }, "btn", esperando ? "x" : "log-out")])
    ]));
  }
  function poeCabSaguao(b, V, modo) {
    var cfg = V.cfg || {}, sg = V.saguao, seg = Math.round((cfg.tempo || L().DUR) / 1000);
    if (modo === "depois") {
      b.appendChild(el("div", { class: "next-match lei-cartao" }, [
        el("div", { class: "nm-label", text: "O leilão começou" }),
        el("p", { class: "intro-text", text: "A sala fechou para quem chega agora. Quem trocou de aparelho pede pelo código e o dono passa o clube." }),
        el("div", { class: "lei-acoes" }, [botao(V.estado === "leilao" ? "Ir ao leilão" : V.estado === "escalacao" ? "Ir à escalação" : "Ir ao campeonato", function () { TM.ui.go(rotaDoEstado(V)); }, "btn primary", "gavel")])
      ]));
      // quem volta depois de um deploy no meio do leilão (a sala é de outra versão do TM) também vê o aviso
      if (V.versaoDiferente) b.appendChild(el("p", { class: "lei-sag-nota", text: "A sala foi criada noutra versão do Total Match: se algo parecer diferente, atualize a página." }));
      return;
    }
    b.appendChild(el("h2", { class: "lei-sag-tit", text: "Prepare seu clube." }));
    b.appendChild(el("p", { class: "lei-sag-resumo", text: "Cada técnico entra com " + rs(L().SALDO) + " (dinheiro do jogo) e compra os " + L().VAGAS +
      " do time no leilão dos melhores da " + ((V.liga && V.liga.nome) || "liga") + ". O que sobrar não vale nada no campeonato." }));
    var vagas = sg ? sg.vagas : cfg.vagas;
    var etq = [(V.liga && V.liga.nome) || "", "Até " + vagas + " técnicos", sg && sg.bots ? sg.bots + (sg.bots === 1 ? " bot" : " bots") : "Só gente de verdade",
      nomeFormato(V.formato), seg + " s por jogador", "Sem chat"];
    b.appendChild(el("div", { class: "lei-etqs" }, etq.filter(Boolean).map(function (t) { return el("span", { class: "lei-etq", text: t }); })));
    // a duração estimada com a sala cheia: o leilão (a régua do PR 1) e o campeonato simulado
    var d = duracaoEstimada(vagas, cfg.tempo || L().DUR), dc = duracaoCamp(V.formato, vagas, cfg.tempo || L().DUR);
    b.appendChild(el("p", { class: "lei-sag-dur", text: "Com a sala cheia: leilão de cerca de " + d.lo + " a " + d.hi + " min e campeonato (" + nomeFormato(V.formato).toLowerCase() + ") de " + dc.lo + " a " + dc.hi + " min." }));
    if (V.versaoDiferente) b.appendChild(el("p", { class: "lei-sag-nota", text: "A sala foi criada noutra versão do Total Match: se algo parecer diferente, atualize a página." }));
  }
  // o convite: o código escondido (o olho mostra), Copiar convite (o link ?leilao=), Compartilhar (só com navigator.share)
  // e o QR (só com o código à mostra: ele leva o código)
  function poeConvite(b, V, modo) {
    var vis = VIEW.codigoVisivel, link = linkDa(V.codigo), cod = V.codigo || "";
    b.appendChild(el("div", { class: "lei-rotulo", text: modo === "depois" ? "Convite (para quem trocou de aparelho)" : "Convite" }));
    var olho = el("button", { class: "lei-olho", type: "button", "aria-pressed": vis ? "true" : "false", "aria-label": vis ? "Esconder o código" : "Mostrar o código",
      title: vis ? "Esconder o código" : "Mostrar o código", data: { foco: "olho" }, on: { click: function () { VIEW.codigoVisivel = !VIEW.codigoVisivel; atualiza(); } } }, [ic(vis ? "eye-off" : "eye")]);
    b.appendChild(el("div", { class: "lei-conv-l1" }, [
      el("span", { class: "lei-conv-rot", text: "Código" }),
      el("span", { class: "lei-conv-cod" + (vis ? " visivel" : ""), text: vis ? cod : "••••••", "aria-label": vis ? "Código " + cod.split("").join(" ") : "Código escondido" }),
      olho
    ]));
    var bts = [botao("Copiar convite", function () { copia(link, "Convite copiado: mande só para quem você conhece."); }, "btn small", "copy")];
    if (global.navigator && global.navigator.share) bts.push(botao("Compartilhar", function () {
      try { global.navigator.share({ title: "Total Match · Leilão", text: "Entre na minha sala do Leilão no Total Match", url: link }).catch(function () {}); } catch (e) {}
    }, "btn small", "share-2"));
    b.appendChild(el("div", { class: "lei-conv-bts" }, bts));
    if (vis) { var q = qr(link); if (q) b.appendChild(q); }
    b.appendChild(el("p", { class: "lei-conv-nota", text: vis ? "Quem tiver o convite pede para entrar e o dono aceita." : "O código fica escondido (quem compartilha a tela não o mostra): o olho mostra o código e o QR." }));
  }
  function acaoSala(S, chave, fn, ok) {
    if (VIEW.ocupado) return;
    VIEW.ocupado = chave; atualiza();
    fn().then(function (r) {
      VIEW.ocupado = null;
      if (r && r.ok) { if (ok) ok(r); } else TM.ui.toast(SS().textoMotivo(r && r.motivo), "erro");
      atualiza();
    }, function (e) { VIEW.ocupado = null; if (global.console) console.error(e); TM.ui.toast("Falha na conexão: tente de novo", "erro"); atualiza(); });
  }
  function poePedidos(b, S, V) {
    b.hidden = !V.souDono;
    if (!V.souDono) return;
    var sg = V.saguao, ps = sg.pedidos || [], ag = podeAgir(V) && !VIEW.ocupado;
    b.appendChild(el("div", { class: "lei-rotulo", text: "Pedidos de entrada" + (ps.length ? " (" + ps.length + ")" : "") }));
    if (!ps.length) { b.appendChild(el("p", { class: "lei-vazio", text: "Nenhum pedido agora. Quem tiver o convite pede para entrar e aparece aqui." })); return; }
    ps.forEach(function (p) {
      // (quem entrou a região ao vivo fala pela mudança do saguão: anunciaSaguao)
      var aceitar = botao("Aceitar", function () { acaoSala(S, "aceitar", function () { return S.aceitar(p.uid); }); }, "btn small primary", "check");
      var recusar = botao("Recusar", function () { acaoSala(S, "recusar", function () { return S.recusar(p.uid); }); }, "btn small", "x");
      aceitar.dataset.foco = "aceitar-" + p.uid; recusar.dataset.foco = "recusar-" + p.uid;
      aceitar.setAttribute("aria-label", "Aceitar " + comNum(p.nome, p.num)); recusar.setAttribute("aria-label", "Recusar " + comNum(p.nome, p.num));
      if (!ag || sg.lotada) aceitar.disabled = true;
      if (!ag) recusar.disabled = true;
      b.appendChild(el("div", { class: "lei-pedido", data: { uid: p.uid } }, [
        escudo(p.clube, "p"),
        el("span", { class: "lei-tec-nome" }, [
          el("span", { class: "lei-tec-quem" }, [el("span", { class: "lei-part-n", text: p.nome }), p.num ? el("span", { class: "lei-num", text: "#" + p.num }) : null]),
          el("span", { class: "lei-tec-clube", text: ((p.clube && p.clube.nome) || "Clube") + " · quer entrar" })
        ]),
        el("span", { class: "lei-pedido-bts" }, [aceitar, recusar])
      ]));
    });
    if (sg.lotada) b.appendChild(el("p", { class: "lei-sag-nota", text: "A sala está cheia: aumente os técnicos ou tire um bot na configuração para aceitar." }));
  }
  // depois do Começar, os pedidos de quem trocou de aparelho: o dono escolhe de quem é o clube (ou recusa)
  function poePedidosDepois(b, S, V) {
    var ps = V.pedidosDepois || [];
    b.hidden = !V.souDono || !ps.length;
    if (b.hidden) return;
    var ag = podeAgir(V) && !VIEW.ocupado;
    var donos = V.tecnicos.filter(function (t) { return !t.bot && t.papel === "tecnico"; });
    b.appendChild(el("div", { class: "lei-rotulo", text: "Pedidos de quem trocou de aparelho" }));
    ps.forEach(function (p) {
      var bts = donos.map(function (t) {
        var x = botao("Passar o clube de " + t.nome, function () {
          fechaFolha();   // o confirmar do TM fica numa camada abaixo das folhas
          TM.ui.confirm("Passar o clube?", "O clube " + t.clube.nome + " (de " + comNum(t.nome, t.num) + ") passa para " + comNum(p.nome, p.num) + ". A conta antiga só olha.", "Passar o clube", function () {
            acaoSala(S, "passar", function () { return S.passarClube(t.uid, p.uid); }, function () { TM.ui.toast("O clube passou para " + p.nome + ".", "ok"); anuncia("O clube de " + t.nome + " passou para " + p.nome); });
          });
        }, "btn small", "users");
        x.dataset.foco = "passar-" + p.uid + "-" + t.uid;
        if (!ag) x.disabled = true;
        return x;
      });
      var rec = botao("Recusar", function () { acaoSala(S, "recusar", function () { return S.recusar(p.uid); }); }, "btn small", "x");
      rec.dataset.foco = "recusar-" + p.uid;
      if (!ag) rec.disabled = true;
      b.appendChild(el("div", { class: "lei-pedido lei-pedido-depois", data: { uid: p.uid } }, [
        el("span", { class: "lei-tec-nome" }, [
          el("span", { class: "lei-tec-quem" }, [el("span", { class: "lei-part-n", text: p.nome }), p.num ? el("span", { class: "lei-num", text: "#" + p.num }) : null]),
          el("span", { class: "lei-tec-clube", text: donos.length ? "De quem é o clube dessa conta?" : "Nenhum técnico para passar o clube" })
        ]),
        el("div", { class: "lei-pedido-passar" }, bts.concat([rec]))
      ]));
    });
  }
  function poeParticipantes(b, S, V, modo) {
    var sg = V.saguao, ag = podeAgir(V) && !VIEW.ocupado;
    var n = V.tecnicos.length;
    b.appendChild(el("div", { class: "lei-rotulo", text: "Participantes" + (modo === "saguao" && sg ? " · " + n + " de " + sg.vagas : " · " + n) }));
    V.tecnicos.forEach(function (t) {
      var acoes = [];
      if (modo === "saguao" && V.souDono && !t.bot && t.papel === "tecnico") {
        var x = botao("Tirar", function () {
          TM.ui.confirm("Tirar " + t.nome + " da sala?", comNum(t.nome, t.num) + " sai do saguão e não pode pedir de novo nesta sala.", "Tirar da sala", function () {
            acaoSala(S, "tirar", function () { return S.tirar(t.uid); });
          }, true);
        }, "btn small lei-part-bt", "ban");
        x.setAttribute("aria-label", "Tirar " + comNum(t.nome, t.num) + " da sala");
        x.dataset.foco = "tirar-" + t.uid;
        if (!ag) x.disabled = true;
        acoes.push(x);
      }
      b.appendChild(linhaPart(V, t, acoes, false));
    });
    if (modo === "saguao" && sg && sg.vagas > n) b.appendChild(el("p", { class: "lei-vazio", text: (sg.vagas - n) + (sg.vagas - n === 1 ? " vaga livre" : " vagas livres") + ": mande o convite." }));
  }
  // a configuração (só o dono, só no saguão): a liga, as vagas, os bots e o tempo; mudar zera os Pronto de todos
  function poeConfig(b, S, V) {
    b.hidden = !V.souDono;
    if (!V.souDono) return;
    var cfg = V.cfg || {}, sg = V.saguao, hs = sg.humanos, vagas = sg.vagas, nb = sg.bots, des = !podeAgir(V) || !!VIEW.ocupado;
    function muda(parcial) { acaoSala(S, "cfg", function () { return S.configurar(parcial); }, function () { anuncia("Configuração mudada: os Pronto foram zerados"); }); }
    b.appendChild(el("div", { class: "lei-rotulo", text: "Configuração da sala" }));
    var lgs = ligas();
    var lb = botaoLiga(lgs, function () {
      escolheLiga(lgs, cfg.liga, function (id) {
        if (id === cfg.liga) return;
        var lg = lgs.filter(function (l) { return l.id === id; })[0];
        muda({ liga: id, ligaNome: lg ? lg.name : id });
      });
    });
    lb.poe(cfg.liga, vagas, { ate: true, desliga: des });
    b.appendChild(lb);
    var pV = passo("Técnicos na sala", "um técnico", function (v) { muda({ vagas: v }); }, { id: "vagas" });
    pV.poe(vagas, Math.max(L().TEC_MIN, hs + nb), L().TEC_MAX, des);
    var pB = passo("Bots de treino", "um bot", function (v) { muda({ bots: v }); }, { id: "bots" });
    pB.poe(nb, 0, Math.max(0, vagas - hs), des);
    b.appendChild(el("div", { class: "lei-criar-linha" }, [el("div", { class: "lei-criar-lt" }, [el("div", { class: "setting-label", text: "Técnicos na sala" }),
      el("div", { class: "setting-hint", text: hs + (hs === 1 ? " pessoa" : " pessoas") + " agora · dá para começar com dois" })]), pV]));
    b.appendChild(el("div", { class: "lei-criar-linha" }, [el("div", { class: "lei-criar-lt" }, [el("div", { class: "setting-label", text: "Bots de treino" }),
      el("div", { class: "setting-hint", text: nb ? (nb === 1 ? "1 bot completa a sala" : nb + " bots completam a sala") : "Só gente de verdade" })]), pB]));
    var segT = el("div", { class: "segmented lei-tempos", role: "group", "aria-label": "Tempo de cada jogador" });
    L().TEMPOS.forEach(function (t) {
      var on = t === cfg.tempo;
      var x = el("button", { class: "seg-btn" + (on ? " active" : ""), type: "button", "aria-pressed": on ? "true" : "false", text: (t / 1000) + " s", data: { foco: "tempo-" + t },
        on: { click: function () { if (!on) muda({ tempo: t }); } } });
      if (des) x.disabled = true;
      segT.appendChild(x);
    });
    b.appendChild(el("div", { class: "lei-cfg-tempo" }, [el("div", { class: "setting-label", text: "Tempo de cada jogador" }), segT]));
    b.appendChild(el("div", { class: "lei-cfg-tempo" }, [el("div", { class: "setting-label", text: "Formato" }),
      seletorFormato(V.formato, vagas, cfg.tempo || L().DUR, function (f) { muda({ formato: f }); }, { desliga: des })]));
    b.appendChild(el("p", { class: "lei-sag-nota", text: "Mudar a configuração zera os Pronto de todos." }));
  }
  // o meu clube no saguão (o nome, a sigla e o escudo; Salvar grava) e a formação preferida (vale na hora)
  function poeMeuClube(b, S, V, usadas) {
    var t = V.tecnicos[V.eu]; b.hidden = !t;
    if (!t) return;
    // as duas formas pelo MESMO canal (o limpaClube): o Firebase devolve as chaves em outra ordem (cor, escudo, nome, sigla)
    // e o "mudou?" pelo texto cru dava sempre sim (o Salvar nunca apagava e a cópia do editor não se renovava)
    var base = JSON.stringify(SS().limpaClube(t.clube)), M = VIEW.meuClube, des = !podeAgir(V) || !!VIEW.ocupado;
    if (!M || M.codigo !== V.codigo || (!M.sujo && M.base !== base)) M = VIEW.meuClube = { codigo: V.codigo, base: base, F: JSON.parse(base), sujo: false, aberto: false };
    b.appendChild(el("div", { class: "lei-rotulo", text: "Meu clube" }));
    var salvar = botao(VIEW.ocupado === "clube" ? "Salvando…" : "Salvar o clube", function () {
      acaoSala(S, "clube", function () { return S.meuClube(SS().limpaClube(M.F)); }, function () { M.sujo = false; M.base = null; TM.ui.toast("Clube salvo.", "ok"); anuncia("Clube salvo"); });
    }, "btn small primary lei-salvar", "save");
    salvar.dataset.foco = "salvar-clube";
    function poeSalvar() { M.sujo = JSON.stringify(SS().limpaClube(M.F)) !== base; salvar.disabled = des || !M.sujo; }
    b.appendChild(editorClube(M.F, poeSalvar, { id: "sag", usadas: usadas, desliga: des, aberto: M.aberto, aoAbrir: function (ab) { M.aberto = ab; } }));
    poeSalvar();
    b.appendChild(el("div", { class: "lei-salvar-l" }, [salvar]));
    var f = t.formacao || "4-4-2";
    var seg = el("div", { class: "segmented lei-formas", role: "group", "aria-label": "Sua formação" });
    L().FORMACOES.forEach(function (fm) {
      var on = fm === f;
      var x = el("button", { class: "seg-btn lei-forma-bt" + (on ? " active" : ""), type: "button", "aria-pressed": on ? "true" : "false", data: { foco: "forma-" + fm },
        on: { click: function () { if (!on) acaoSala(S, "forma", function () { return S.mudarFormacao(fm); }); } } },
        [el("span", { class: "lei-forma-f", text: fm }), FORMA_NOME[fm] ? el("span", { class: "lei-forma-n", text: FORMA_NOME[fm] }) : null]);
      if (des) x.disabled = true;
      seg.appendChild(x);
    });
    b.appendChild(el("div", { class: "lei-rotulo", text: "Sua formação" }));
    b.appendChild(seg);
    b.appendChild(el("p", { class: "lei-sag-nota", text: "É a sua preferência no leilão: se uma compra não couber nela, ela muda sozinha." }));
  }
  // a barra fixa do saguão: "X de N prontos. Falta confirmar: …" e o Pronto (ou o Começar, do dono, apagado com o motivo)
  function barraSaguao(screen) {
    var B = {};
    B.txt = el("p", { class: "lei-sagbar-txt" });
    B.msg = el("p", { class: "lei-lance-msg lei-sagbar-msg", id: "lei-sag-msg" });
    B.msgBase = "lei-lance-msg lei-sagbar-msg";
    B.bt = el("button", { class: "btn primary lei-sagbar-bt", type: "button", "aria-describedby": "lei-sag-msg", on: { click: clicaSagBar } }, [el("span", { class: "lei-bt-ic" }), el("span")]);
    B.raiz = el("div", { class: "lei-sagbar", role: "group", "aria-label": "Pronto para começar" }, [el("div", { class: "lei-sagbar-in" }, [el("div", { class: "lei-sagbar-l" }, [B.txt, B.msg]), B.bt])]);
    B.raiz.hidden = true;
    screen.appendChild(B.raiz);
    return B;
  }
  function atualizaBarraSag(V) {
    var P = VIEW.partes, B = P && P.sagBar; if (!B || !V) return;
    var sg = V.saguao, mostra = modoSaguao(V) === "saguao" && !!sg && V.eu >= 0;
    B.raiz.hidden = !mostra;
    ajustaEspaco();
    if (!mostra) return;
    var txt = sg.total <= 1 && !sg.bots ? "Só você na sala: mande o convite ou ponha bots."
      : sg.prontos + " de " + sg.total + (sg.total === 1 ? " pronto." : " prontos.") + (sg.faltam.length ? " Falta confirmar: " + sg.faltam.join(", ") + "." : " Todos prontos.");
    if (B.txt.textContent !== txt) B.txt.textContent = txt;
    var ag = podeAgir(V), eu = V.tecnicos[V.eu], ocup = VIEW.ocupado, rot, icone, cls, pode, motivo = "";
    if (V.souDono) {
      rot = ocup === "comecar" ? "Preparando os lotes…" : "Começar o leilão"; icone = "gavel"; cls = "btn primary lei-sagbar-bt";
      pode = ag && sg.podeComecar && !ocup;
      if (!ag) motivo = motivoAgir(V);
      else if (sg.humanos + sg.bots < L().TEC_MIN) motivo = SS().textoMotivo("poucos") + ": aceite alguém ou ponha um bot";
      else if (sg.faltam.length) motivo = SS().textoMotivo("prontos");
      else motivo = "Todos prontos: toque em Começar.";
    } else {
      var pronto = !!(eu && eu.pronto);
      rot = pronto ? "Pronto · toque para cancelar" : "Pronto"; icone = pronto ? "circle-check" : "check"; cls = "btn lei-sagbar-bt" + (pronto ? " on" : " primary");
      pode = ag && !ocup;
      if (!ag) motivo = motivoAgir(V);
      else motivo = pronto ? "Você está pronto: o dono começa quando todos estiverem." : "Toque em Pronto quando o seu clube estiver certo.";
    }
    if (B.bt.className !== cls) B.bt.className = cls;
    if (B.bt.lastChild.textContent !== rot) B.bt.lastChild.textContent = rot;
    if (B.icone !== icone) { B.icone = icone; TM.ui.clear(B.bt.firstChild); B.bt.firstChild.appendChild(ic(icone)); }
    B.bt.disabled = !pode;
    if (ocup === "comecar" || ocup === "pronto") B.bt.setAttribute("aria-busy", "true"); else B.bt.removeAttribute("aria-busy");
    if (VIEW.msg && agoraReal() < VIEW.msgAte) poeMsg(B, VIEW.msg.txt, VIEW.msg.tipo);
    else poeMsg(B, motivo, !ag ? "alerta" : "");
  }
  function clicaSagBar() {
    var S = sessao(), V = VIEW.V; if (!S || !V || VIEW.ocupado || !V.saguao) return;
    if (V.souDono) {
      VIEW.ocupado = "comecar"; atualizaBarraSag(V);
      // um quadro para o "Preparando os lotes…" aparecer antes da conta dos lotes (o mundo-base leva uma fração de segundo)
      setTimeout(function () {
        S.comecar().then(function (r) {
          VIEW.ocupado = null;
          if (!r.ok) mostraMsg(SS().textoMotivo(r.motivo), "erro", 4000);
          atualiza();
        }, function (e) { VIEW.ocupado = null; if (global.console) console.error(e); mostraMsg("Não deu para começar: tente de novo", "erro", 4000); atualiza(); });
      }, 40);
      return;
    }
    var eu = V.tecnicos[V.eu], sim = !(eu && eu.pronto);
    VIEW.ocupado = "pronto"; atualizaBarraSag(V);
    if (!sim && VIEW.sag) VIEW.sag.cancelei = true;
    S.pronto(sim).then(function (r) {
      VIEW.ocupado = null;
      if (!r.ok) { if (VIEW.sag) VIEW.sag.cancelei = false; mostraMsg(SS().textoMotivo(r.motivo), "erro", 4000); }
      else anuncia(sim ? "Você está pronto" : "Pronto cancelado");
      atualiza();
    }, function () { VIEW.ocupado = null; atualiza(); });
  }
  // a região ao vivo fala o saguão sem repetir: quem entrou, quem saiu, quem ficou pronto, o pedido novo (para o dono) e o
  // meu Pronto zerado pela configuração
  function anunciaSaguao(V) {
    if (!V || !V.online || V.treino || V.estado !== "saguao") { VIEW.sag = null; return; }
    var atual = {}, peds = {};
    V.tecnicos.forEach(function (t) { if (!t.bot) atual[t.uid] = { nome: t.nome, pronto: !!t.pronto, eu: !!t.eu }; });
    ((V.saguao && V.saguao.pedidos) || []).forEach(function (p) { peds[p.uid] = p.nome; });
    var antes = VIEW.sag && VIEW.sag.codigo === V.codigo ? VIEW.sag : null;
    VIEW.sag = { codigo: V.codigo, t: atual, p: peds, cancelei: antes ? antes.cancelei : false };
    if (!antes || !naSala()) return;
    Object.keys(atual).forEach(function (u) {
      var a = antes.t[u], x = atual[u];
      if (!a) { if (!x.eu) anuncia(x.nome + " entrou na sala"); return; }
      if (x.pronto && !a.pronto && !x.eu) anuncia(x.nome + " está pronto");
      if (x.eu && a.pronto && !x.pronto) {
        if (VIEW.sag.cancelei) VIEW.sag.cancelei = false;
        else { mostraMsg("O dono mudou a configuração: toque em Pronto de novo.", "alerta", 5000); anuncia("O dono mudou a configuração: toque em Pronto de novo"); }
      }
    });
    Object.keys(antes.t).forEach(function (u) { if (!atual[u] && !antes.t[u].eu) anuncia(antes.t[u].nome + " saiu da sala"); });
    if (V.souDono) Object.keys(peds).forEach(function (u) { if (!antes.p[u]) { anuncia(peds[u] + " pediu para entrar"); Som.toca("tique"); } });
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
    VIEW.folha = { fundo: fundo, caixa: caixa, corpo: corpo, monta: monta, antes: antes, vivo: !!opc.vivo, tela: tela, chave: opc.chave || null, visto: null };
    if (opc.chave) VIEW.folha.visto = opc.chave();
    monta(corpo);
    global.requestAnimationFrame(function () { fundo.classList.add("show"); try { fechar.focus(); } catch (e) {} });
  }
  // a folha ao vivo (Participantes) é refeita só quando o que ela mostra muda (com a sala online, os batimentos chegam a
  // todo instante): o foco volta ao mesmo botão
  function refazFolha() {
    var f = VIEW.folha; if (!f) return;
    if (f.chave) { var k = f.chave(); if (k === f.visto) return; f.visto = k; }
    var a = doc.activeElement, foco = a && f.corpo.contains(a) && a.dataset ? a.dataset.foco : null;
    TM.ui.clear(f.corpo); f.monta(f.corpo);
    if (foco) { var x = f.corpo.querySelector('[data-foco="' + foco + '"]'); if (x && !x.disabled) try { x.focus(); } catch (e) {} }
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
        "O que sobrar de dinheiro não vale nada no campeonato.",
        "Depois da escalação, o campeonato (" + nomeFormato(V && V.formato).toLowerCase() + "): " + fraseFormato(V && V.formato, V ? V.T : 4).replace(/^./, function (x) { return x.toLowerCase(); }),
        "O seu jogo contra um bot: toque em Simular partida; sem o toque, ele é simulado sozinho em 2 min (o prazo só corre com você na sala). Contra um amigo, o jogo é simulado quando a rodada abre. Os jogos dos bots, na hora.",
        "Cada resultado é gravado uma vez e todos veem o mesmo: ninguém joga de novo. A escalação mudada vale a partir do próximo jogo que ainda não começou.",
        "Não conta no ranking online nem no confronto direto, e não usa Total Coins."
      ];
      c.appendChild(el("ul", { class: "lei-regras" }, itens.map(function (t) { return el("li", { text: t }); })));
    });
  }
  function folhaParticipantes() {
    function chave() {
      var S = sessao(), V = S && S.ver(); if (!V) return "";
      return JSON.stringify([V.estado, V.souDono, podeAgir(V), VIEW.ocupado, V.pedidosDepois, V.tecnicos.map(function (t) {
        var e = seloDe(V, t); return [t.uid, t.nome, t.num, t.saldo, t.n, e[1], t.clube];
      })]);
    }
    folha("Participantes", function (c) {
      var S = sessao(); if (!S) return;
      var V = S.ver(), comSaldo = V.estado !== "saguao" && !!V.estado;
      if (V.online && V.estado === "saguao") c.appendChild(el("p", { class: "lei-vazio", text: (V.saguao ? V.saguao.prontos + " de " + V.saguao.total + " prontos" : "") + " · o dono aceita os pedidos no Saguão." }));
      V.tecnicos.forEach(function (t) {
        var acoes = [];
        if (V.online && V.souDono && V.estado === "saguao" && !t.bot && t.papel === "tecnico") {
          var x = botao("Tirar", function () {
            fechaFolha();   // o confirmar do TM fica numa camada abaixo das folhas
            TM.ui.confirm("Tirar " + t.nome + " da sala?", comNum(t.nome, t.num) + " sai do saguão e não pode pedir de novo nesta sala.", "Tirar da sala", function () {
              acaoSala(S, "tirar", function () { return S.tirar(t.uid); });
            }, true);
          }, "btn small lei-part-bt", "ban");
          x.setAttribute("aria-label", "Tirar " + comNum(t.nome, t.num) + " da sala");
          x.dataset.foco = "tirar-" + t.uid;
          if (!podeAgir(V) || VIEW.ocupado) x.disabled = true;
          acoes.push(x);
        }
        c.appendChild(linhaPart(V, t, acoes, comSaldo));
      });
      // depois do Começar, o dono passa o clube de quem trocou de aparelho (os pedidos que chegaram depois)
      if (V.online && V.souDono && V.estado !== "saguao" && (V.pedidosDepois || []).length) {
        var box = el("div", { class: "lei-pedidos lei-folha-pedidos" });
        poePedidosDepois(box, S, V);
        c.appendChild(box);
      }
    }, { vivo: true, chave: chave });
  }
  // as vendas e o time de cada técnico (tocar num técnico mostra o campinho dele: de que posição ele ainda precisa)
  function folhaVendas(tSel) {
    var S = sessao(); if (!S) return;
    var sel = tSel >= 0 ? tSel : S.ver().eu;
    folha("Vendas", function (c) {
      var V = S.ver();
      // antes do Começar (o saguão, o pedido) ainda não há lotes nem escalação
      if (!S.ctx || V.estado === "saguao" || V.pedido) { c.appendChild(el("p", { class: "lei-vazio", text: "O leilão ainda não começou: as vendas e o time de cada técnico aparecem aqui." })); return; }
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
    // (a sala online das Minhas salas guarda o estado, não o lote da vez)
    if (x.estado === "leilao" && x.online) return "Leilão em andamento";
    if (x.estado === "leilao") return x.fase === "rep" ? "Repescagem" : x.k >= 0 ? "Jogador " + (x.k + 1) + " de " + (13 * x.T) : "Começando";
    if (x.estado === "escalacao") return "Escalação";
    if (x.estado === "camp") return "Campeonato";
    if (x.estado === "fim") return "Encerrada";
    return "Saguão";
  }
  TM.ui.register("leilao", function (screen, params) {
    params = params || {};
    // o convite pelo link: guardado uma vez só (como o VIEW.autoFeito do Online 3D: voltar a esta tela não entra de novo);
    // o cartão do online entra sozinho com ele quando a conta está pronta
    if (params.codigo && params.auto && !VIEW.conviteFeito) { VIEW.conviteFeito = true; VIEW.convite = SS() ? SS().limpaCodigo(params.codigo) : String(params.codigo).toUpperCase(); }
    screen.classList.add("lei-screen", "lei-entrada");
    screen.appendChild(TM.ui.topbar("Modo Leilão", function () { TM.ui.go("modes"); }));
    var corpo = el("div", { class: "panel-narrow lei-entrada-corpo" });
    screen.appendChild(corpo);
    // o recado de quando a sala acabou para esta pessoa (recusado, tirado, encerrada): uma vez
    if (VIEW.aviso) {
      corpo.appendChild(el("div", { class: "lei-aviso-sala lei-aviso-entrada", role: "note" }, [el("span", { class: "lei-aviso-ic" }, [ic("info")]), el("span", { class: "lei-aviso-txt", text: VIEW.aviso })]));
      VIEW.aviso = null;
    }
    var S = sessao();
    if (S) {
      var V = S.ver(), tEu = V.tecnicos[V.eu];
      // a sala congelada pela conferência não está "em andamento": quem volta vê que ela parou antes de entrar
      var est = V.alterada ? "alterada fora das regras" : V.pedido ? (V.pedido.depois ? "esperando o dono passar o clube" : "esperando o dono aceitar") : V.lote ? textoLote(V.lote) : textoEstado({ estado: V.estado, fase: V.fase, k: -1, T: V.T });
      corpo.appendChild(el("div", { class: "next-match lei-cartao lei-andamento" + (V.alterada ? " parada" : "") }, [
        el("div", { class: "nm-label", text: V.alterada ? "Sala parada" : V.pedido ? "Pedido de entrada" : V.estado === "camp" ? "Campeonato em andamento" : V.estado === "fim" ? "Campeonato encerrado" : "Leilão em andamento" }),
        el("div", { class: "lei-sala-linha" }, [escudo((tEu || {}).clube, "p"), el("div", { class: "lei-sala-txt" }, [
          el("span", { class: "lei-sala-t", text: subtitulo(V) }),
          el("span", { class: "lei-sala-s", text: est + " · " + V.T + " técnicos" + (S.pausado && S.pausado() ? " · parado" : "") })
        ])]),
        el("div", { class: "lei-acoes" }, [botao("Voltar à sala", function () { TM.ui.go(rotaDoEstado(S.ver())); }, "btn primary", V.online ? "door-open" : "gavel")])
      ]));
    }
    corpo.appendChild(cartaoOnline(S));
    corpo.appendChild(el("div", { class: "next-match lei-cartao lei-treino" }, [
      el("div", { class: "nm-label", text: "Treinar contra bots" }),
      el("p", { class: "intro-text", text: "Você contra 1 a 7 bots, neste aparelho: o leilão, a escalação e o campeonato. Funciona sem internet." }),
      el("div", { class: "lei-acoes" }, [botao("Treinar contra bots", function () { TM.ui.go("leilao-criar"); }, "btn", "bot")])
    ]));
    var salasBox = el("div", { class: "lei-salas-box" });
    corpo.appendChild(salasBox);
    listaSalas(salasBox, S);
    // as salas online que sumiram (encerradas, vencidas) saem das Minhas salas
    if (contaEstado() === "pronta" && SS() && SS().salas().some(function (x) { return x.online; })) {
      var antes = SS().salas().map(function (x) { return x.codigo; }).join(",");
      SS().conferirSalas().then(function (xs) {
        if (salasBox.isConnected && xs.map(function (x) { return x.codigo; }).join(",") !== antes) listaSalas(salasBox, sessao());
      }, function () {});
    }
    corpo.appendChild(el("h2", { class: "block-title", text: "Como funciona" }));
    corpo.appendChild(el("ul", { class: "lei-regras lei-regras-curtas" }, [
      el("li", { text: "Cada técnico entra com R$ 100 (dinheiro do jogo) e compra os 11 do time no leilão dos melhores jogadores da liga escolhida." }),
      el("li", { text: "Cada jogador fica 10 s no martelo: +1, +5, +10, Tudo ou outro valor. Dá para passar." }),
      el("li", { text: "Depois, a escalação no campinho e o campeonato: mata-mata, pontos corridos ou os dois. Todos veem o mesmo resultado, gravado uma vez." })
    ]));
  });
  // o cartão "Com os amigos online": sem a conta (sem internet), só o Treino; com a conta entrando, a espera; suspenso
  // pelo fair play, o aviso; pronta, Criar sala e Entrar com código (o código ou o link colado; o convite do link entra
  // sozinho uma vez)
  function cartaoOnline(S) {
    var box = el("div", { class: "next-match lei-cartao lei-online" });
    box.appendChild(el("div", { class: "nm-label", text: "Com os amigos online" }));
    var conta = contaEstado(), fp = conta === "pronta" ? suspenso() : null;
    function desligados(txt, extra) {
      var p = el("p", { class: "intro-text lei-online-txt", text: txt });
      box.appendChild(p);
      var a = botao("Criar sala", function () {}, "btn lei-off", "gavel"), b = botao("Entrar com código", function () {}, "btn lei-off", "key-round");
      [a, b].forEach(function (x) { x.disabled = true; x.setAttribute("aria-disabled", "true"); });
      box.appendChild(el("div", { class: "lei-acoes" }, [a, b]));
      if (extra) box.appendChild(extra);
      return p;
    }
    var convite = VIEW.convite;
    if (convite && S && S.codigo === convite) { TM.leilaoTela.convite(true); convite = null; }
    if (conta === "indisponivel") {
      desligados("Sem conexão com o servidor agora: dá para treinar contra os bots. Com internet, crie uma sala privada ou entre com o código de um amigo." +
        (convite ? " O convite que você abriu fica guardado até lá." : ""));
      return box;
    }
    if (conta === "conectando") {
      box.setAttribute("aria-busy", "true");
      var p = desligados("Entrando na sua conta online…");
      quandoConta("leilao");
      // a conta que não fica pronta: o aviso e o Tentar de novo
      setTimeout(function () {
        if (!box.isConnected || contaEstado() !== "conectando") return;
        box.removeAttribute("aria-busy");
        p.textContent = "Não deu para entrar na sua conta online. Confira a internet e tente de novo.";
        box.appendChild(el("div", { class: "lei-acoes" }, [botao("Tentar de novo", function () { TM.ui.go("leilao"); }, "btn", "refresh-cw")]));
      }, AJUSTES.contaMs);
      return box;
    }
    if (fp) {
      desligados("Você está suspenso do online por " + (TM.fairplay.fmt ? TM.fairplay.fmt(fp.remainingMs) : "um tempo") + " por abandonar partidas. O treino continua liberado.");
      return box;
    }
    box.appendChild(el("p", { class: "intro-text", text: "Sala privada por código ou link: você manda o convite e aceita cada pedido. Sem chat." }));
    box.appendChild(el("div", { class: "lei-acoes" }, [botao("Criar sala", function () { TM.ui.go("leilao-criar", { online: true }); }, "btn primary", "gavel")]));
    var erro = el("p", { class: "lei-erro", role: "alert" });
    erro.hidden = true;
    var campo = el("input", { class: "lei-campo lei-entrar-cod", id: "lei-entrar-cod", type: "text", placeholder: "Código ou link", maxlength: "120", autocomplete: "off",
      autocapitalize: "characters", spellcheck: "false", enterkeyhint: "go" });
    var entrarBt = botao("Entrar", function () { entrarCom(campo.value, entrarBt, erro, campo); }, "btn lei-entrar-bt", "key-round");
    campo.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); entrarCom(campo.value, entrarBt, erro, campo); } });
    box.appendChild(el("div", { class: "lei-entrar" }, [
      el("label", { class: "lei-rotulo", for: "lei-entrar-cod", text: "Entrar com código" }),
      el("div", { class: "lei-entrar-l" }, [campo, entrarBt]),
      erro
    ]));
    // o convite do link entra sozinho (uma vez por carga da página)
    if (convite) {
      TM.leilaoTela.convite(true);
      campo.value = convite;
      setTimeout(function () { if (campo.isConnected) entrarCom(convite, entrarBt, erro, campo); }, 0);
    }
    return box;
  }
  function rotuloBt(bt, txt) { var s = bt.querySelector("span:last-child"); if (s) s.textContent = txt; else bt.textContent = txt; }
  function entrarCom(txt, bt, erroEl, campo) {
    function erro(m) { erroEl.textContent = m || ""; erroEl.hidden = !m; }
    var cod = SS().limpaCodigo(txt);
    erro("");
    if (cod.length !== 6) { erro(SS().textoMotivo("codigo")); try { campo.focus(); } catch (e) {} return; }
    var S = sessao();
    if (S && S.codigo === cod) { TM.ui.go(rotaDoEstado(S.ver())); return; }
    if (bt.disabled) return;
    bt.disabled = true; bt.setAttribute("aria-busy", "true"); rotuloBt(bt, "Entrando…");
    function volta() { if (bt.isConnected) { bt.disabled = false; bt.removeAttribute("aria-busy"); rotuloBt(bt, "Entrar"); } }
    // sem resposta: sem internet, ou o servidor cheio (o plano grátis do Firebase tem um limite de conexões)
    var prazo = setTimeout(function () { if (bt.isConnected) erro(semInternet() ? "Sem internet: confira a conexão." : "Servidor cheio, tente em alguns minutos."); }, AJUSTES.cheioMs);
    SS().entrar(cod).then(function (S2) {
      clearTimeout(prazo); volta();
      if (TM.ui.current() === "leilao") TM.ui.go(rotaDoEstado(S2.ver()));
    }, function (e) {
      clearTimeout(prazo); volta();
      var c = e && e.codigo;
      if (!c && global.console) console.error(e);
      erro(c ? SS().textoMotivo(c) : "Não deu para entrar: tente de novo.");
    });
  }
  // as Minhas salas (os treinos deste aparelho e as salas online em que você está); tocar abre
  function listaSalas(box, S) {
    TM.ui.clear(box);
    var salas = SS() ? SS().salas() : [];
    box.hidden = !salas.length;
    if (!salas.length) return;
    box.appendChild(el("h2", { class: "block-title", text: "Minhas salas" }));
    var lista = el("div", { class: "lei-salas" });
    salas.forEach(function (x) {
      var aberta = S && S.codigo === x.codigo;
      var t = (x.treino ? "Treino" : x.online ? "Sala online" : "Sala") + (x.ligaNome ? " · " + x.ligaNome : "");
      // o estado primeiro (é o que a linha diz de útil; no celular a linha quebra em duas em vez de cortar)
      var parada = x.alterada || (aberta && S.alterada);
      var s = (parada ? "Parada: alterada fora das regras" : textoEstado(x)) + (x.pedido ? " · esperando o dono" : "") + (x.regrasOk === false ? " · só olhar" : "") +
        " · " + x.T + " técnicos" + (x.online && x.edicao === "pro" ? " · Season Update" : "");
      lista.appendChild(el("div", { class: "lei-sala" + (aberta ? " aberta" : "") + (x.online ? " online" : ""), data: { codigo: x.codigo } }, [
        escudo(x.clube, "p"),
        el("div", { class: "lei-sala-txt" }, [el("span", { class: "lei-sala-t", text: t }), el("span", { class: "lei-sala-s", text: s })]),
        el("div", { class: "lei-sala-bts" }, [
          botao(aberta ? "Abrir" : x.online ? "Voltar" : "Continuar", function (ev) { continuar(x, ev && ev.currentTarget); }, "btn small primary"),
          el("button", { class: "lei-sala-x", type: "button", "aria-label": x.online && !aberta ? "Tirar das Minhas salas" : x.online ? "Sair da sala" : "Excluir a sala",
            title: x.online && !aberta ? "Tirar da lista" : x.online ? "Sair da sala" : "Excluir", on: { click: function () { excluir(x); } } }, [ic(x.online && !aberta ? "x" : "trash-2")])
        ])
      ]));
    });
    box.appendChild(lista);
  }
  function excluir(x) {
    if (typeof x === "string") x = { codigo: x };
    var S = sessao(), aberta = S && S.codigo === x.codigo;
    if (x.online && aberta) { confirmaSair(S); return; }
    if (x.online) {
      // a sala online sai só desta lista: a pessoa continua nela e volta pelo código
      TM.ui.confirm("Tirar das Minhas salas?", "A sala some desta lista, mas você continua nela: dá para voltar pelo código.", "Tirar da lista", function () {
        SS().esquecer(x.codigo); TM.ui.go("leilao");
      });
      return;
    }
    TM.ui.confirm("Excluir a sala?", "O treino é apagado deste aparelho.", "Excluir", function () {
      if (aberta) S.sair().then(function () { TM.ui.go("leilao"); });
      else { try { TM.leilaoRede.memoria(x.codigo, {}).apagar(); } catch (e) {} TM.ui.go("leilao"); }
    }, true);
  }

  /* ---------- o Meu clube: o nome, a sigla e o escudo desenhado (a forma, o símbolo e a cor do Ultimate) ---------- */
  // F = { nome, sigla, cor, escudo } (muda no lugar); aoMudar() a cada mudança; opc: id (o do editor do escudo), usadas
  // (as cores de outros técnicos, que ficam apagadas), desliga (tudo apagado)
  function editorClube(F, aoMudar, opc) {
    opc = opc || {};
    var usadas = {};
    (opc.usadas || []).forEach(function (c) { usadas[String(c).toLowerCase()] = 1; });
    var idEd = "lei-esc-ed-" + (opc.id || "c");
    var prevEsc = el("span", { class: "lei-criar-esc" });
    function muda() { if (aoMudar) aoMudar(); }
    var inNome = el("input", { class: "lei-campo", type: "text", maxlength: "16", autocomplete: "off", "aria-label": "Nome do clube", data: { foco: "clube-nome" },
      on: { input: function () { F.nome = inNome.value; F.sigla = SS().limpaClube({ nome: inNome.value }).sigla; inSigla.value = F.sigla; poeEsc(false); muda(); } } });
    var inSigla = el("input", { class: "lei-campo lei-campo-sigla", type: "text", maxlength: "3", autocomplete: "off", "aria-label": "Sigla do clube", data: { foco: "clube-sigla" },
      on: { input: function () { inSigla.value = inSigla.value.replace(/[^0-9A-Za-zÀ-ÿ]/g, "").toUpperCase().slice(0, 3); F.sigla = inSigla.value; poeEsc(false); muda(); } } });
    var editor = el("div", { class: "lei-criar-escudo", id: idEd });
    var abreEsc = el("button", { class: "lei-bloco-bt lei-esc-abre", type: "button", "aria-controls": idEd, "aria-expanded": "false", data: { foco: "clube-esc" }, on: { click: function () {
      var ab = editor.hidden; editor.hidden = !ab; abreEsc.setAttribute("aria-expanded", ab ? "true" : "false"); abreEsc.classList.toggle("aberto", ab);
      if (opc.aoAbrir) opc.aoAbrir(ab);
    } } }, [el("span", { class: "lei-bloco-ic" }, [ic("palette")]), el("span", { class: "lei-bloco-tit", text: "Mudar o escudo" }), el("span", { class: "lei-bloco-seta" }, [ic("chevron-down")])]);
    editor.hidden = !opc.aberto;
    if (opc.aberto) { abreEsc.setAttribute("aria-expanded", "true"); abreEsc.classList.add("aberto"); }
    function poeEsc(tudo) {
      TM.ui.clear(prevEsc); prevEsc.appendChild(escudo(F, "g"));
      if (!tudo) return;
      inNome.value = F.nome; inSigla.value = F.sigla;
      TM.ui.clear(editor);
      var u = UT(); if (!u) return;
      var cfg = u.escudoCfg({ escudo: F.escudo });
      var cores = el("div", { class: "lei-cores", role: "group", "aria-label": "Cor" });
      (u.CORES || []).forEach(function (cor) {
        var c = String(cor).toLowerCase(), on = c === String(F.cor).toLowerCase(), outra = !on && !!usadas[c];
        var b = el("button", { class: "lei-cor" + (on ? " on" : "") + (outra ? " usada" : ""), type: "button", style: "background:" + cor, "aria-label": "Cor " + cor + (outra ? " (de outro técnico)" : ""),
          "aria-pressed": on ? "true" : "false", title: outra ? "Já é de outro técnico" : "", data: { foco: "cor-" + c },
          on: { click: function () { F.cor = c; poeEsc(true); muda(); } } });
        if (outra) b.disabled = true;
        cores.appendChild(b);
      });
      var formas = el("div", { class: "lei-formas-esc", role: "group", "aria-label": "Forma" });
      (u.FORMA_ORDEM || []).forEach(function (fm) {
        var on = fm === cfg.forma;
        formas.appendChild(el("button", { class: "lei-forma-esc" + (on ? " on" : ""), type: "button", "aria-label": "Forma " + fm, "aria-pressed": on ? "true" : "false", data: { foco: "forma-" + fm },
          on: { click: function () { F.escudo = fm + "|" + cfg.simb; poeEsc(true); muda(); } } }, [u.escudoEl({ forma: fm, simb: cfg.simb }, F.cor, "", "lei-esc pp")]));
      });
      var simbs = el("div", { class: "lei-simbs", role: "group", "aria-label": "Símbolo" });
      (u.SIMBOLOS || []).forEach(function (sb) {
        var on = sb === cfg.simb;
        simbs.appendChild(el("button", { class: "lei-simb" + (on ? " on" : ""), type: "button", "aria-label": "Símbolo " + sb, "aria-pressed": on ? "true" : "false", data: { foco: "simb-" + sb },
          on: { click: function () { F.escudo = cfg.forma + "|" + sb; poeEsc(true); muda(); } } }, [ic(sb)]));
      });
      editor.appendChild(el("div", { class: "lei-rotulo", text: "Cor" })); editor.appendChild(cores);
      editor.appendChild(el("div", { class: "lei-rotulo", text: "Forma" })); editor.appendChild(formas);
      editor.appendChild(el("div", { class: "lei-rotulo", text: "Símbolo" })); editor.appendChild(simbs);
      if (opc.desliga) [].forEach.call(editor.querySelectorAll("button"), function (b) { b.disabled = true; });
      // o foco fica no botão tocado (o editor é refeito a cada escolha)
      if (foco) { var f = editor.querySelector('[data-foco="' + foco + '"]'); if (f) try { f.focus(); } catch (e) {} foco = null; }
    }
    var foco = null;
    editor.addEventListener("click", function (e) { var b = e.target && e.target.closest ? e.target.closest("[data-foco]") : null; if (b) foco = b.dataset.foco; }, true);
    poeEsc(true);
    if (opc.desliga) { inNome.disabled = true; inSigla.disabled = true; }
    return el("div", { class: "lei-editor-clube" }, [
      el("div", { class: "lei-criar-clube" }, [prevEsc, el("div", { class: "lei-criar-campos" }, [inNome, inSigla])]),
      abreEsc, editor
    ]);
  }
  // o − N + (técnicos, bots): um controle que se atualiza no lugar (poe(valor, min, max, desliga)); o toque lê o valor de
  // agora (o mesmo botão tocado várias vezes seguidas sobe ou desce um a cada toque)
  function passo(rotulo, nomeUm, fn, opc) {
    opc = opc || {};
    var st = { v: 0, min: 0, max: 0, desliga: false };
    var n = el("span", { class: "lei-passo-n", "aria-live": "polite" });
    var menos = el("button", { class: "lei-passo-bt", type: "button", "aria-label": "Menos " + nomeUm, data: { foco: "menos-" + (opc.id || nomeUm) }, on: { click: function () { if (!st.desliga && st.v > st.min) fn(st.v - 1); } } }, [ic("minus")]);
    var mais = el("button", { class: "lei-passo-bt", type: "button", "aria-label": "Mais " + nomeUm, data: { foco: "mais-" + (opc.id || nomeUm) }, on: { click: function () { if (!st.desliga && st.v < st.max) fn(st.v + 1); } } }, [ic("plus")]);
    var raiz = el("div", { class: "lei-passo", role: "group", "aria-label": rotulo }, [menos, n, mais]);
    raiz.poe = function (v, min, max, desliga) {
      st.v = v; st.min = min; st.max = max; st.desliga = !!desliga;
      n.textContent = String(v);
      menos.disabled = st.desliga || v <= min; mais.disabled = st.desliga || v >= max;
    };
    return raiz;
  }

  /* ---------- o formato do campeonato (Criar sala e Saguão; PLANO-LEILAO.md §1.7 e §2.2) ---------- */
  function LC() { return TM.leilaoCamp || null; }
  var FORMATOS = [
    { id: "mata", nome: "Mata-mata", icone: "swords" },
    { id: "pontos", nome: "Pontos corridos", icone: "list" },
    { id: "misto", nome: "Pontos + mata-mata", icone: "layers" }
  ];
  function formatoId(f) { return LC() ? LC().formatoDe(f) : (f === "pontos" || f === "misto" ? f : "mata"); }
  function nomeFormato(f) { f = formatoId(f); return FORMATOS.filter(function (x) { return x.id === f; })[0].nome; }
  function fraseFormato(f, T) {
    f = formatoId(f);
    if (f === "pontos") return "Turno e returno: 3 pontos por vitória e 1 pelo empate.";
    if (f === "misto") return T <= 4 ? "Turno único; os 2 primeiros fazem a final." : "Turno único; os 4 primeiros vão às semifinais (1º × 4º, 2º × 3º) e à final.";
    return "Jogo único. Empate: prorrogação com gol de ouro e, seguindo empatado, pênaltis.";
  }
  // "2 rodadas com 4 técnicos · ~1 a 4 min" (o campeonato simulado; o 3D chega no PR 4)
  function linhaFormato(f, T, tempo) {
    if (!LC()) return "";
    var d = LC().duracaoEstimada({ T: T, tempo: tempo, formato: formatoId(f) }).camp;
    return d.rodadas + (d.rodadas === 1 ? " rodada" : " rodadas") + " com " + T + " técnicos · ~" + d.lo + " a " + d.hi + " min";
  }
  function duracaoCamp(f, T, tempo) { return LC() ? LC().duracaoEstimada({ T: T, tempo: tempo, formato: formatoId(f) }).camp : { lo: 1, hi: 2 }; }
  // os 3 cartões do formato (um grupo de botões com aria-pressed); fn(id) no toque; opc.desliga apaga todos
  function seletorFormato(atual, T, tempo, fn, opc) {
    opc = opc || {};
    atual = formatoId(atual);
    var g = el("div", { class: "lei-formatos", role: "group", "aria-label": "Formato do campeonato" });
    FORMATOS.forEach(function (x) {
      var on = x.id === atual;
      var b = el("button", { class: "lei-fmt" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false", data: { foco: "fmt-" + x.id, fmt: x.id },
        on: { click: function () { if (!on && !opc.desliga) fn(x.id); } } }, [
        el("span", { class: "lei-fmt-ic" }, [ic(x.icone)]),
        el("span", { class: "lei-fmt-txt" }, [
          el("span", { class: "lei-fmt-n", text: x.nome }),
          el("span", { class: "lei-fmt-f", text: fraseFormato(x.id, T) }),
          el("span", { class: "lei-fmt-s", text: linhaFormato(x.id, T, tempo) })
        ]),
        el("span", { class: "lei-fmt-ok" }, [on ? ic("circle-check") : null])
      ]);
      if (opc.desliga) b.disabled = true;
      g.appendChild(b);
    });
    return g;
  }

  /* ---------- Criar sala: o Treino e a sala online (leilao-criar; { online: true }) ---------- */
  function duracaoEstimada(T, tempoMs) {
    // medido com os robôs (o leilão inteiro): ~0,9 × o relógio por lote quando todos passam rápido, ~relógio + 7 s quando
    // ninguém passa (o relógio inteiro, a pausa e a repescagem); com 2 técnicos, metade embaixo
    var n = L().LOTES_POR_TEC * T, s = tempoMs / 1000;
    var lo = n * (T <= 2 ? 0.5 : 0.9) * s / 60, hi = n * (s + 7) / 60;
    return { lo: Math.max(1, Math.round(lo)), hi: Math.max(2, Math.round(hi)), n: n };
  }
  function ligas() { try { return TM.data.world().leagues.slice(); } catch (e) { return []; } }
  // o botão da liga (o mesmo nó; poe(idLiga, T, opc) refaz o que ele mostra): tocar abre a folha das ligas
  function botaoLiga(lgs, aoAbrir) {
    var bt = el("button", { class: "lei-liga-bt", type: "button", "aria-haspopup": "dialog", data: { foco: "liga" }, on: { click: function () { aoAbrir(); } } });
    bt.poe = function (idLiga, T, opc) {
      opc = opc || {};
      var lg = lgs.filter(function (l) { return l.id === idLiga; })[0] || null, comp = null;
      try { comp = TM.data.competition("lg-" + idLiga); } catch (e) {}
      TM.ui.clear(bt);
      if (comp && TM.img.compImg) bt.appendChild(TM.img.compImg(comp, "lei-liga-logo"));
      bt.appendChild(el("span", { class: "lei-liga-txt" }, [
        el("span", { class: "lei-liga-n", text: lg ? lg.name : "Escolha a liga" }),
        el("span", { class: "lei-liga-s", text: "Os " + duracaoEstimada(T, L().DUR).n + " melhores dos clubes" + (lg ? " da " + lg.name : "") + (opc.ate ? ", com a sala cheia" : "") })
      ]));
      bt.appendChild(el("span", { class: "lei-liga-trocar", text: "Trocar" }));
      bt.setAttribute("aria-label", "Liga: " + (lg ? lg.name : "nenhuma") + ". Trocar");
      bt.disabled = !!opc.desliga;
    };
    return bt;
  }
  TM.ui.register("leilao-criar", function (screen, params) {
    var online = !!(params && params.online);
    screen.classList.add("lei-screen", "lei-criar");
    if (online) screen.classList.add("lei-criar-online");
    screen.appendChild(TM.ui.topbar(online ? "Criar sala" : "Treinar contra bots", function () { TM.ui.go("leilao"); }));
    var lgs = ligas(), pref = ler(online ? "leilao:criarOnline" : "leilao:criar", {}) || {};
    var F = {
      liga: lgs.some(function (l) { return l.id === pref.liga; }) ? pref.liga : (lgs.some(function (l) { return l.id === "br"; }) ? "br" : (lgs[0] && lgs[0].id)),
      T: pref.T >= L().TEC_MIN && pref.T <= L().TEC_MAX ? pref.T : 4,
      bots: online && pref.bots >= 0 && pref.bots <= L().TEC_MAX - 1 ? pref.bots : 0,
      formacao: L().FORMACOES.indexOf(pref.formacao) >= 0 ? pref.formacao : "4-4-2",
      tempo: L().TEMPOS.indexOf(pref.tempo) >= 0 ? pref.tempo : L().DUR,
      formato: formatoId(pref.formato),
      clube: SS().limpaClube(pref.clube || SS().clubeInicial())
    };
    if (online && F.bots > F.T - 1) F.bots = F.T - 1;
    var corpo = el("div", { class: "panel-narrow lei-criar-corpo" });
    screen.appendChild(corpo);
    var resumo = el("p", { class: "lei-criar-resumo" });
    function ligaDe(id) { return lgs.filter(function (l) { return l.id === id; })[0] || null; }
    if (online && contaEstado() !== "pronta") {
      // a conta ainda entrando (ou sem conexão): a tela fica, o Criar espera por ela
      var c = contaEstado();
      corpo.appendChild(el("div", { class: "lei-aviso-sala rede", role: "note" }, [el("span", { class: "lei-aviso-ic" }, [ic("wifi")]),
        el("span", { class: "lei-aviso-txt", text: c === "conectando" ? "Entrando na sua conta online…" : "Sem conexão com o servidor agora: a sala online precisa de internet." })]));
      if (c === "conectando") quandoConta("leilao-criar");
    }

    // a liga
    var ligaBt = botaoLiga(lgs, function () { escolheLiga(lgs, F.liga, function (id) { F.liga = id; poeLiga(); poeResumo(); }); });
    function poeLiga() { ligaBt.poe(F.liga, F.T, { ate: online }); }
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [el("div", { class: "setting-label", text: "Liga" }), ligaBt]));

    // os técnicos (contando os bots); no online, as vagas da sala e os bots de treino que completam
    var hintT = el("div", { class: "setting-hint" }), hintB = el("div", { class: "setting-hint" });
    var passoT = passo("Técnicos na sala", "um técnico", function (v) { F.T = v; if (online && F.bots > F.T - 1) F.bots = F.T - 1; poeT(); }, { id: "tec" });
    var passoB = passo("Bots de treino", "um bot", function (v) { F.bots = v; poeT(); }, { id: "bot" });
    function poeT() {
      passoT.poe(F.T, L().TEC_MIN, L().TEC_MAX);
      if (online) {
        hintT.textContent = "Até " + F.T + " técnicos, contando os bots · dá para começar com dois";
        passoB.poe(F.bots, 0, F.T - 1);
        hintB.textContent = F.bots ? (F.bots === 1 ? "1 bot completa a sala" : F.bots + " bots completam a sala") + " · as vagas que sobram são de gente de verdade" : "Só gente de verdade";
      } else hintT.textContent = "Você e " + (F.T - 1) + (F.T - 1 === 1 ? " bot" : " bots") + " · " + duracaoEstimada(F.T, F.tempo).n + " jogadores no leilão";
      poeLiga(); poeFmt(); poeResumo();
    }
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [
      el("div", { class: "lei-criar-linha" }, [el("div", { class: "lei-criar-lt" }, [el("div", { class: "setting-label", text: "Técnicos na sala" }), hintT]), passoT])
    ]));
    if (online) corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [
      el("div", { class: "lei-criar-linha" }, [el("div", { class: "lei-criar-lt" }, [el("div", { class: "setting-label", text: "Bots de treino" }), hintB]), passoB])
    ]));

    // o formato do campeonato (o padrão é o mata-mata; a duração de cada um pelo número de técnicos)
    var caixaFmt = el("div", { class: "lei-fmt-caixa" });
    function poeFmt() {
      TM.ui.clear(caixaFmt);
      caixaFmt.appendChild(seletorFormato(F.formato, F.T, F.tempo, function (f) { F.formato = f; poeFmt(); poeResumo(); }));
    }
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [
      el("div", { class: "setting-label", text: "Formato" }), caixaFmt,
      el("div", { class: "setting-hint", text: online ? "Os jogos são simulados: o seu contra um bot quando você tocar em Simular (ou em 2 min); contra um amigo, quando a rodada abre."
        : "Os jogos são simulados: o seu quando você tocar em Simular (ou em 2 min); os dos bots, na hora." })
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

    // o seu clube: o nome, a sigla e o escudo desenhado (começa com o do seu Ultimate, se houver)
    corpo.appendChild(el("div", { class: "setting lei-criar-bloco" }, [el("div", { class: "setting-label", text: "Seu clube" }), editorClube(F.clube, null, { id: "criar" })]));

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

    // o fim da coluna: o resumo, a duração estimada e o Começar (treino) ou o Criar sala (online)
    var comecar = online ? botao("Criar sala", function () { criarSalaOnline(F, comecar, lgs); }, "btn primary big lei-comecar", "gavel")
      : botao("Começar o treino", function () { criar(F, comecar); }, "btn primary big lei-comecar", "gavel");
    function poeResumo() {
      var lg = ligaDe(F.liga), d = duracaoEstimada(F.T, F.tempo), dc = duracaoCamp(F.formato, F.T, F.tempo);
      var tempos = "leilão de cerca de " + d.lo + " a " + d.hi + " min e campeonato de " + dc.lo + " a " + dc.hi + " min";
      resumo.textContent = online
        ? (lg ? lg.name : "") + " · até " + F.T + " técnicos" + (F.bots ? " (" + F.bots + (F.bots === 1 ? " bot" : " bots") + ")" : "") + " · " + F.formacao + " · " + nomeFormato(F.formato) + " · com a sala cheia, " + tempos
        : (lg ? lg.name : "") + " · " + F.T + " técnicos · " + F.formacao + " · " + nomeFormato(F.formato) + " · " + tempos;
    }
    corpo.appendChild(el("div", { class: "lei-rodape" }, [resumo, comecar, el("p", { class: "lei-criar-nota", text: online
      ? "Sala privada: só entra quem tiver o convite e for aceito por você. Dinheiro do jogo: nada de Total Coins nem de dinheiro de verdade; não conta no ranking."
      : "Dinheiro do jogo: nada de Total Coins nem de dinheiro de verdade." })]));
    poeT(); poeF(); poeTempo(); poeResumo();
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
    gravar("leilao:criar", { liga: F.liga, T: F.T, formacao: F.formacao, tempo: F.tempo, formato: F.formato, clube: clubeLimpo });
    // um quadro para o "Preparando…" aparecer antes da conta dos lotes (o mundo-base leva uma fração de segundo)
    setTimeout(function () {
      var mundo = null; try { mundo = TM.data.mundoBase(); } catch (e) { mundo = null; }
      SS().criarTreino({ liga: F.liga, bots: F.T - 1, formacao: F.formacao, tempo: F.tempo, formato: F.formato, clube: clubeLimpo, mundo: mundo || undefined }).then(function () {
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
  // a sala online: o código nasce no servidor (sem colisão) e a pessoa vai para o Saguão
  function criarSalaOnline(F, bt, lgs) {
    if (VIEW.criando) return;
    var c = contaEstado();
    if (c !== "pronta") {
      TM.ui.toast(c === "conectando" ? "Entrando na sua conta online: tente de novo em instantes." : "Sem conexão com o servidor agora: a sala online precisa de internet.", "alerta");
      if (c === "conectando") quandoConta("leilao-criar");
      return;
    }
    VIEW.criando = true;
    bt.disabled = true; bt.setAttribute("aria-busy", "true"); rotuloBt(bt, "Criando a sala…");
    var clubeLimpo = SS().limpaClube(F.clube), lg = lgs.filter(function (l) { return l.id === F.liga; })[0];
    gravar("leilao:criarOnline", { liga: F.liga, T: F.T, bots: F.bots, formacao: F.formacao, tempo: F.tempo, formato: F.formato, clube: clubeLimpo });
    var prazo = setTimeout(function () { if (bt.isConnected) TM.ui.toast(semInternet() ? "Sem internet: confira a conexão." : "Servidor cheio, tente em alguns minutos.", "alerta"); }, AJUSTES.cheioMs);
    SS().criarSala({ liga: F.liga, ligaNome: lg ? lg.name : F.liga, vagas: F.T, bots: F.bots, tempo: F.tempo, formacao: F.formacao, formato: F.formato, clube: clubeLimpo }).then(function () {
      clearTimeout(prazo);
      VIEW.criando = false;
      VIEW.codigoVisivel = false;
      TM.ui.go("leilao-saguao");
    }, function (e) {
      clearTimeout(prazo);
      VIEW.criando = false;
      if (global.console && !(e && e.codigo)) console.error(e);
      TM.ui.toast(e && e.codigo ? SS().textoMotivo(e.codigo) : "Não deu para criar a sala. Tente de novo.", "erro");
      if (bt.isConnected) { bt.disabled = false; bt.removeAttribute("aria-busy"); rotuloBt(bt, "Criar sala"); }
    });
  }

  TM.leilaoTela = {
    /** Gancho de teste: o que foi para a região ao vivo (as últimas 40 falas). */
    anuncios: function () { return VIEW.anuncios.slice(); },
    /** O código do convite (?leilao=) ainda não usado, ou null; usar(true) o dá por usado. */
    convite: function (usar) { var c = VIEW.convite; if (usar) VIEW.convite = null; return c; },
    /** Gancho de teste: o que a tela mostra agora (a rota, a faixa da sala, o código à mostra, a barra do saguão). */
    estado: function () {
      var P = VIEW.partes, a = VIEW.avisoSala, sb = P && P.sagBar;
      return {
        rota: (function () { try { return TM.ui.current(); } catch (e) { return null; } })(),
        aviso: a && !a.hidden ? a.textContent : null, codigoVisivel: VIEW.codigoVisivel,
        barra: sb && !sb.raiz.hidden ? sb.txt.textContent : null,
        // o Campeonato: o texto do prazo do meu jogo (null sem ele) e a rodada à mostra (null = a da vez)
        prazo: P && P.prazo ? P.prazo.textContent : null, rodadaVista: VIEW.campSel,
        // o "Ver o jogo": o id do jogo à mostra no 2D (a rota leilao-jogo e as telas da prorrogação e dos pênaltis dele)
        jogo: VIEW.jogoVisto || null
      };
    },
    /** Gancho de teste: os prazos da tela (cheioMs, contaMs). */
    ajustes: AJUSTES,
    duracaoEstimada: duracaoEstimada
  };
})(window);
