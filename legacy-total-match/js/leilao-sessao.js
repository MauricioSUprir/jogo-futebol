/* ================= TOTAL MATCH — Modo Leilão: a sessão (fora das telas) ================= */
/* Plano: PLANO-LEILAO.md §1.1 (a sala), §1.3 (o lote), §1.4 (quem some), §2 (o que as telas mostram), §3.2 (os dados),
   §3.3 (o protocolo) e §3.5 (os robôs). Como o `S` do online3d.js, mas SEM DOM: a sessão ouve a sala pela rede
   (leilao-rede.js: a memória no treino; o firebase() do PR 2 tem a mesma interface), roda os relógios dos lotes, chama
   as funções PURAS do leilao.js DENTRO de rede.transacao e põe os robôs para agir. As telas (leilao-tela.js) só leem
   `ver()` e chamam as ações. Navegar para outra tela NÃO para a sessão: só "Sair da sala" encerra.

   A sala (os caminhos dentro de leiloes/{CÓDIGO}; no treino, a mesma árvore em memória, gravada no aparelho):
     sala    { meta: { dono, proto, regras, versaoTM, edicao, criada, estado, semente, atividade, treino, fimLeilao },
               cfg: { liga, ligaNome, T, tempo (ms do relógio do lote), formato, overall },
               tec: { uid: { nome, papel: 'dono'|'tecnico'|'bot', pronto, entrou, clube: { nome, sigla, cor, escudo
                      ("forma|símbolo", o do Ultimate) }, formacao } },
               ordem: [uid × T] (o índice t de cada técnico; gravada no Começar) }
     lotes   { l: [retrato × 13T], f: [retrato] (os de fora, para completar de graça) }   gravados uma vez
     vivo    o estado do leilão (leilao.js); SÓ por transação
     escal/{t}  { formacao, tit: [índice global × 11] (só a escalação feita à mão), pronto }; a automática é função pura
     vendas/{i} { t, v (o preço), s (o seq do lote) }: registro para a tela (a verdade é o vivo.d)
     relogio  só no treino: a hora do treino (ms) na última ação; o relógio do treino PARA com a página fechada ou
              escondida e volta daí (recarregar a página no meio volta ao mesmo ponto, com o tempo que faltava)

   Estados da sala: saguao → leilao (Começar, por transação) → escalacao (o vivo chegou ao fim; qualquer aparelho) →
   camp (todos prontos ou 60 s; o campeonato é o PR 3: a tela diz "em breve").

   Quem age (§3.3, "sem martelo"): fechar o lote, o lance de um robô e as trocas de estado da sala são transações
   IDEMPOTENTES que qualquer aparelho com a sala aberta roda; `atraso` (ms) é o escalonamento de cada um (no PR 2, o
   k-ésimo presente espera 1,5 s × k; no treino, 0). Duas ao mesmo tempo não estragam nada: a 2ª aborta pelo seq/n.
   A hora das decisões é rede.horaServidor() (no PR 2, a testemunha da hora entra nas decisões por prazo).

   Cada `vivo` novo é conferido contra o anterior (TM.leilao.conferir); se não bate, a sessão congela (`alterada`).

   API (TM.leilaoSessao):
     criarTreino(opc) → Promise(sessão)   opc: { liga, bots (1–7), formacao, tempo (s ou ms), clube?, semente?, codigo?
                                           e, só nos testes: relogio, agendar, cancelar, armazem, latencia, atraso }
     abrir(codigo, opc) → Promise(sessão)  uma sala guardada (o treino depois de recarregar); opc.rede = uma rede já
                                           aberta (os testes: outro "aparelho" no mesmo banco), opc.eu (-1 = só olha)
     atual() · salas() (as "Minhas salas" deste aparelho) · acelerar(fator) (gancho de teste) · textoMotivo(m, info)
   A sessão: ver() (tudo o que as telas mostram) · lance('+1'|'+5'|'+10'|'tudo'|número) · passar() · mudarFormacao(f) ·
     trocar(a, b) · prontoEscalacao(sim) · sair() · parar() · aoMudar(fn) · on(evento, fn) · escalacao(t) · hora()
     Eventos: 'lote' {i, fase, k}, 'lance' {t, valor}, 'superado' {t, valor}, 'vendido' {i, t, preco}, 'semLance' {i},
     'formacao' {de, para}, 'fim', 'estado' {estado}, 'alterada' {motivo}
   Ganchos de teste: acelerar(fator) e pular(ms) (o relógio do treino), pausar()/retomar().
   O relógio do treino também para com segurar(motivo, sim): a página escondida ("pagina") e a pessoa fora das telas da
   sala ("tela", pela leilao-tela.js); anda de novo quando ninguém segura. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  var PROTO = 1;
  var ESCAL_MS = 60000;          // a escalação depois do leilão: 60 s ou todos prontos (§2.5)
  var MAX_TREINOS = 3;           // salas de treino guardadas neste aparelho: a 4ª tira a mais antiga
  var HORA_CADA = 1000;          // o relógio do treino vai para a gravação no máximo a cada 1 s (de hora do treino)
  var LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var PASSOS = { "+1": 1, "+5": 5, "+10": 10 };
  // os bots de treino: nomes pelo perfil (fictícios, nunca de técnicos reais) e clubes inventados
  var NOMES_BOT = {
    estrelas: ["Bot Arrojado", "Bot Ousado", "Bot Vistoso"],
    equilibrado: ["Bot Sereno", "Bot Calculista", "Bot Prudente"],
    paciente: ["Bot Paciente", "Bot Estrategista", "Bot Tranquilo"]
  };
  var NOMES_BOT_EXTRA = ["Bot Curioso", "Bot Veloz", "Bot Teimoso", "Bot Atento", "Bot Matreiro", "Bot Firme", "Bot Faminto"];
  var CLUBES_BOT = [
    ["Cometa Azul FC", "CAZ"], ["Granito EC", "GRA"], ["Faísca AC", "FAI"], ["Lince Dourado FC", "LDO"],
    ["Maré Alta EC", "MAR"], ["Trovão do Vale", "TDV"], ["Brasa Rubra FC", "BRR"], ["Pedra Lisa AC", "PLA"],
    ["Neblina FC", "NEB"], ["Ventania EC", "VEN"]
  ];
  // reserva só se o Ultimate não estiver carregado (no app ele sempre vem antes)
  var CORES_RESERVA = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#0ea5e9"];
  var CLUBE_PADRAO = { nome: "Meu Clube", sigla: "MEU", cor: "#22c55e", escudo: "classico|tm-bola" };

  var _atual = null;
  var FATOR = 1;                 // o relógio dos treinos novos (gancho de teste: acelerar)

  /* ---------- utilidades ---------- */
  function LE() { return TM.leilao; }
  function UT() { return (TM.ut && TM.ut._i) || null; }
  function versao() { try { return (TM.versao && TM.versao()) || ""; } catch (e) { return ""; } }
  function edicao() { try { return (TM.storage && TM.storage.edition && TM.storage.edition()) || "public"; } catch (e) { return "public"; } }
  function u32() {
    var r = new Uint32Array(1);
    try { global.crypto.getRandomValues(r); } catch (e) { r[0] = Math.floor(Math.random() * 4294967296); }
    return r[0] >>> 0;
  }
  function novoCodigo() { var c = ""; for (var i = 0; i < 6; i++) c += LETRAS[u32() % LETRAS.length]; return c; }
  function num(x, p) { return typeof x === "number" && isFinite(x) ? x : p; }
  function lista(x) {
    // o Firebase devolve como lista um nó de chaves 0..n (escal/0, vendas/12…): aceita os dois
    if (!x) return {};
    if (Array.isArray(x)) { var o = {}; x.forEach(function (v, i) { if (v != null) o[i] = v; }); return o; }
    return x;
  }
  function meuUid() {
    try { var me = TM.net && TM.net.me; if (me && me.uid) return String(me.uid); } catch (e) {}
    return "eu";
  }
  function meuNome() {
    try { var me = TM.net && TM.net.me; if (me && me.name) return String(me.name).slice(0, 16); } catch (e) {}
    try { var n = global.localStorage && global.localStorage.getItem("tm_online_name"); if (n) return String(n).slice(0, 16); } catch (e) {}
    return "Você";
  }
  function rngDe(semente, nome) { return TM.rng.make(TM.rng.hashStr("leilao:" + semente + ":" + nome)); }
  function embaralha(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function siglaDe(nome) {
    var ps = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!ps.length) return "MEU";
    if (ps.length === 1) return ps[0].slice(0, 3).toUpperCase();
    return ps.slice(0, 3).map(function (x) { return x[0]; }).join("").toUpperCase();
  }
  // o clube do técnico (nome 16, sigla 3, a cor e o escudo "forma|símbolo"); começa com o do Ultimate, se houver
  function limpaClube(c) {
    c = c || {};
    var u = UT(), nome = String(c.nome || "").trim().slice(0, 16) || CLUBE_PADRAO.nome;
    var sigla = String(c.sigla || siglaDe(nome)).replace(/[^0-9A-Za-zÀ-ÿ]/g, "").slice(0, 3).toUpperCase() || "MEU";
    var esc = String(c.escudo || "");
    if (u && u.escudoCfg) { var cfg = u.escudoCfg({ escudo: esc }); esc = cfg.forma + "|" + cfg.simb; }
    else if (!/^[a-z]+\|[a-z0-9-]+$/.test(esc)) esc = CLUBE_PADRAO.escudo;
    var cor = /^#[0-9a-fA-F]{6}$/.test(String(c.cor || "")) ? String(c.cor).toLowerCase() : CLUBE_PADRAO.cor;
    return { nome: nome, sigla: sigla, cor: cor, escudo: esc };
  }
  function clubeDoUltimate() {
    var u = UT(), s = null;
    try { s = u && u.st && u.st(); } catch (e) { s = null; }
    if (!s) return null;
    return limpaClube({ nome: u.nomeExibido ? u.nomeExibido(s) : s.club, sigla: u.siglaDe ? u.siglaDe(s) : null, cor: s.cor, escudo: s.escudo });
  }
  // os bots: nome pelo perfil, clube inventado, cor que não repete a de ninguém, forma e símbolo sorteados
  function identidadesBots(semente, n, corHumano) {
    var u = UT(), L = LE(), r = rngDe(semente, "bots");
    var cores = ((u && u.CORES) || CORES_RESERVA).filter(function (c) { return String(c).toLowerCase() !== String(corHumano).toLowerCase(); });
    cores = embaralha(cores.slice(), r);
    var formas = embaralha(((u && u.FORMA_ORDEM) || ["classico"]).slice(), r);
    var simbs = embaralha(((u && u.SIMBOLOS) || ["tm-bola"]).filter(function (s) { return s !== "tm-bola"; }), r);
    if (!simbs.length) simbs = ["tm-bola"];
    var clubes = embaralha(CLUBES_BOT.slice(), r), usados = {}, out = [];
    for (var k = 0; k < n; k++) {
      var t = k + 1, perfil = L.perfilRobo(semente, t).perfil, nome = null;
      (NOMES_BOT[perfil] || []).concat(NOMES_BOT_EXTRA).some(function (x) { if (!usados[x]) { nome = x; return true; } return false; });
      nome = nome || ("Bot " + t); usados[nome] = 1;
      var cl = clubes[k % clubes.length];
      out.push({
        uid: "bot" + t, nome: nome, papel: "bot", pronto: true, entrou: t,
        clube: { nome: cl[0], sigla: cl[1], cor: cores[k % cores.length], escudo: formas[k % formas.length] + "|" + simbs[k % simbs.length] },
        formacao: L.perfilRobo(semente, t).formacao
      });
    }
    return out;
  }
  function armazemPadrao() {
    return {
      ler: function (k, p) { return TM.storage ? TM.storage.read(k, p) : p; },
      gravar: function (k, v) { if (TM.storage) TM.storage.write(k, v); },
      apagar: function (k) { if (TM.storage) TM.storage.remove(k); }
    };
  }

  /* ---------- textos dos motivos (as telas mostram; a sessão devolve o código) ---------- */
  function textoMotivo(m, info) {
    info = info || {};
    switch (m) {
      case "max": return "Acima do seu máximo R$ " + (info.max != null ? info.max : 0);
      case "goleiro": return "Você já tem goleiro";
      case "posicao": return "Sem vaga para essa posição";
      case "completo": return "Seu time está completo";
      case "lider": return "Você lidera";
      case "passou": return "Você passou neste jogador";
      case "pausa": return "Aguarde o próximo jogador";
      case "tarde": return "Fechando…";
      case "fim": return "O leilão acabou";
      case "valor": return "O lance tem de passar de R$ " + (info.valor != null ? info.valor : 0);
      case "antes": return "Alguém chegou antes: R$ " + (info.valor != null ? info.valor : 0);
      case "fechado": return "Esse jogador já fechou";
      case "naoCabe": return "Seu time não cabe nessa formação";
      case "incompleto": return "Escale depois de completar os 11";
      case "grupo": return "Esse jogador não joga nessa vaga";
      case "vaga": return "Escolha duas vagas diferentes";
      case "parado": return "A sala está parada";
      case "alterada": return "A sala foi alterada fora das regras";
      case "fase": return "Agora não dá";
      default: return "Agora não dá";
    }
  }

  /* ================= a sessão ================= */
  function Sessao(rede, opc) {
    opc = opc || {};
    var S = this;
    S.codigo = rede.codigo;
    S.rede = rede;
    S.treino = false;
    S.eu = -1;
    S.uidEu = null;
    S.sala = null; S.lotesG = null; S.ctx = null; S.vivo = null; S.vivoN = null;
    S.escal = {}; S.vendas = {};
    S.bots = [];
    S.atraso = Math.max(0, num(opc.atraso, 0));
    S.parado = false; S.alterada = null; S.soOlhar = false;
    S.ultimo = null;               // o último fechamento visto: { tipo: 'vendido'|'semLance', i, t, preco, seq }
    S._agendar = opc.agendar || function (fn, ms) { return setTimeout(fn, ms); };
    S._cancelar = opc.cancelar || function (h) { clearTimeout(h); };
    S._timer = null; S._ocupado = false; S._falhas = {}; S._cedo = 0;
    S._mudou = []; S._ev = {}; S._notifica = false; S._paraOuvir = [];
    S._relogio = opc._relogio || null;   // o relógio do treino (só de quem abriu a rede da memória)
    S._horaGravada = -1;
  }
  var P = Sessao.prototype;

  /* ---------- o relógio ---------- */
  // relógio do treino: anda com a página aberta e à vista; fator = o gancho de teste para acelerar
  function relogioTreino(base, inicio, fator) {
    var C = { base: base, h0: inicio, r0: base(), fator: fator || 1, pausado: false };
    C.hora = function () { return C.pausado ? C.h0 : C.h0 + (C.base() - C.r0) * C.fator; };
    C.rebase = function () { C.h0 = C.hora(); C.r0 = C.base(); };
    return C;
  }
  P.hora = function () { return this.rede.horaServidor(); };
  P._fator = function () { return this._relogio ? this._relogio.fator : 1; };
  P.acelerar = function (f) {
    if (!this._relogio || !(f > 0)) return;
    this._relogio.rebase(); this._relogio.fator = f; this._programa();
  };
  P.pular = function (ms) { if (!this._relogio) return; this._relogio.h0 += ms; this._programa(); };
  P.pausar = function () {
    var C = this._relogio; if (!C || C.pausado) return;
    C.h0 = C.hora(); C.pausado = true; this._limpaTimer(); this.guardarHora(true);
  };
  P.retomar = function () {
    var C = this._relogio; if (!C || !C.pausado) return;
    C.r0 = C.base(); C.pausado = false; this._programa(); this._notificar();
  };
  P.pausado = function () { return !!(this._relogio && this._relogio.pausado); };
  // quem segura o relógio do treino: a página escondida ("pagina") e as telas fora da sala ("tela": a pessoa foi ao menu
  // no meio do treino). Anda só quando ninguém segura; pausar()/retomar() continuam os ganchos diretos dos testes.
  P.segurar = function (motivo, sim) {
    var S = this;
    if (!S._relogio) return;
    S._seguros = S._seguros || {};
    if (sim) S._seguros[motivo] = 1; else delete S._seguros[motivo];
    if (Object.keys(S._seguros).length) S.pausar(); else S.retomar();
  };
  // a hora do treino vai para a gravação (a volta depois de recarregar começa dela)
  P.guardarHora = function (ja) {
    if (!this._relogio || this.parado) return;
    var h = Math.round(this.hora());
    if (!ja && this._horaGravada >= 0 && h - this._horaGravada < HORA_CADA) return;
    this._horaGravada = h;
    this.rede.gravar("relogio", h);
    if (ja && this.rede.salvarAgora) this.rede.salvarAgora();
  };

  /* ---------- carga ---------- */
  P._carregar = function (opc) {
    var S = this, L = LE(), rede = S.rede;
    return Promise.all([rede.ler("sala"), rede.ler("lotes"), rede.ler("vivo"), rede.ler("relogio"), rede.ler("escal"), rede.ler("vendas")]).then(function (r) {
      var sala = r[0], lotes = r[1];
      if (!sala || !sala.meta || !lotes || !lotes.l) throw new Error("sala");
      S.sala = sala; S.lotesG = lotes;
      S.treino = !!sala.meta.treino;
      S.soOlhar = sala.meta.regras !== L.REGRAS;
      S._montaCtx();
      // o estado lido já vale para as telas (os ouvintes confirmam logo depois com o mesmo valor)
      if (r[2]) { var c0 = L.conferir(null, r[2], S.ctx); if (c0.ok) { S.vivo = r[2]; S.vivoN = L.norm(r[2], S.ctx); } else S.alterada = c0.motivo; }
      S.escal = lista(r[4]); S.vendas = lista(r[5]);
      if (opc && typeof opc.eu === "number") S.eu = opc.eu;
      else if (S.treino) S.eu = S._ordem().indexOf(sala.meta.dono);
      else S.eu = S._ordem().indexOf(meuUid());
      S.uidEu = S.eu >= 0 ? S._ordem()[S.eu] : null;
      // o treino reaberto: o relógio volta de onde parou (nunca antes do que já está gravado)
      if (S._relogio && opc && opc.retomar) {
        var v = r[2] || {}, h = Math.max(num(r[3], 0), num(v.abre, 0), num(v.t, 0), num(sala.meta.atividade, 0), num(sala.meta.criada, 0));
        if (h > 0) { S._relogio.h0 = h; S._relogio.r0 = S._relogio.base(); }
      }
      S._ouvir();
      return S;
    });
  };
  P._ordem = function () {
    var s = this.sala;
    if (s && Array.isArray(s.ordem) && s.ordem.length) return s.ordem;
    return ordemPrevista(s);
  };
  P._montaCtx = function () {
    var S = this, L = LE(), s = S.sala, ordem = S._ordem(), T = ordem.length;
    if (S.ctx && S.ctx.T === T) return;
    S.ctx = L.contexto({ T: T, lotes: S.lotesG.l, fora: S.lotesG.f || [], semente: s.meta.semente, tempo: s.cfg && s.cfg.tempo });
    S.bots = [];
    ordem.forEach(function (uid, t) {
      var tc = s.tec && s.tec[uid];
      if (tc && tc.papel === "bot") S.bots.push(L.perfilRobo(S.ctx.semente, t));
    });
  };
  P._ouvir = function () {
    var S = this, rede = S.rede;
    S._paraOuvir.push(rede.ouvir("sala", function (v) { S._naSala(v); }));
    S._paraOuvir.push(rede.ouvir("vivo", function (v) { S._naVivo(v); }));
    S._paraOuvir.push(rede.ouvir("escal", function (v) { S.escal = lista(v); S._notificar(); S._programa(); }));
    S._paraOuvir.push(rede.ouvir("vendas", function (v) { S.vendas = lista(v); S._notificar(); }));
    if (rede.aoCair) S._paraOuvir.push(rede.aoCair(function () { S._notificar(); }));
  };
  P._naSala = function (s) {
    var S = this;
    if (S.parado) return;
    if (!s) { S.sala = null; S._limpaTimer(); S._notificar(); return; }
    var antes = S.sala && S.sala.meta && S.sala.meta.estado;
    S.sala = s;
    if (s.ordem && S.ctx && S.ctx.T !== s.ordem.length) S._montaCtx();
    if (antes !== (s.meta && s.meta.estado)) S._emite("estado", { estado: s.meta && s.meta.estado });
    S._notificar(); S._programa();
  };
  P._naVivo = function (v) {
    var S = this, L = LE(), ctx = S.ctx;
    if (S.parado || !ctx) return;
    var ant = S.vivo;
    if (v == null) { S.vivo = null; S.vivoN = null; S._notificar(); S._programa(); return; }
    var c = L.conferir(ant, v, ctx);
    if (!c.ok) {
      S.alterada = c.motivo || "estrutura";
      S._limpaTimer();
      S._emite("alterada", { motivo: S.alterada });
      S._notificar();
      return;
    }
    S.vivo = v; S.vivoN = L.norm(v, ctx);
    S._eventos(ant ? L.norm(ant, ctx) : null, S.vivoN);
    S._formacaoAuto();
    S._notificar(); S._programa();
  };
  P._eventos = function (a, b) {
    var S = this;
    if (!a) return;
    if (b.seq !== a.seq) {
      if (b.seq === a.seq + 1 && a.fase !== "fim" && a.i >= 0) {
        var dono = LE().LETRAS.indexOf(b.d.charAt(a.i));
        if (dono >= 0) {
          var preco = a.cx[dono][0] - b.cx[dono][0];
          S.ultimo = { tipo: "vendido", i: a.i, t: dono, preco: preco, seq: a.seq };
          S._emite("vendido", { i: a.i, t: dono, preco: preco, eu: dono === S.eu });
        } else {
          S.ultimo = { tipo: "semLance", i: a.i, t: -1, preco: 0, seq: a.seq };
          S._emite("semLance", { i: a.i });
        }
      }
      if (b.fase === "fim") { if (a.fase !== "fim") S._emite("fim", {}); }
      else S._emite("lote", { i: b.i, fase: b.fase, k: b.k });
      return;
    }
    if (b.n > a.n) {
      S._emite("lance", { t: b.lider, valor: b.valor, eu: b.lider === S.eu });
      if (a.lider === S.eu && b.lider !== S.eu && S.eu >= 0) S._emite("superado", { t: b.lider, valor: b.valor });
    }
  };
  // a formação preferida deixou de caber com a compra: muda sozinha para a que cabe e mais se parece (com aviso)
  P._formacaoAuto = function () {
    var S = this;
    if (S.eu < 0 || S.soOlhar) return;
    var e = S.escalacao(S.eu), atual = (S.escal[S.eu] || {}).formacao || S._prefPadrao(S.eu);
    if (e && e.formacao && e.formacao !== atual) {
      S.rede.atualizar("escal/" + S.eu, { formacao: e.formacao, tit: null });
      S._emite("formacao", { de: atual, para: e.formacao });
    }
  };

  /* ---------- eventos e quem ouve ---------- */
  P.aoMudar = function (fn) { var S = this; S._mudou.push(fn); return function () { S._mudou = S._mudou.filter(function (x) { return x !== fn; }); }; };
  P.on = function (nome, fn) {
    var S = this; (S._ev[nome] = S._ev[nome] || []).push(fn);
    return function () { S._ev[nome] = (S._ev[nome] || []).filter(function (x) { return x !== fn; }); };
  };
  P._emite = function (nome, dados) {
    (this._ev[nome] || []).slice().forEach(function (fn) { try { fn(dados); } catch (e) { if (global.console) console.error(e); } });
  };
  // as mudanças de dados chegam às telas juntas, uma vez por volta (várias gravações seguidas = um aviso)
  P._notificar = function () {
    var S = this;
    if (S._notifica) return;
    S._notifica = true;
    Promise.resolve().then(function () {
      S._notifica = false;
      S._mudou.slice().forEach(function (fn) { try { fn(S); } catch (e) { if (global.console) console.error(e); } });
    });
  };

  /* ---------- o motor: relógios, robôs e as trocas de estado (qualquer aparelho) ---------- */
  P._limpaTimer = function () { if (this._timer != null) { this._cancelar(this._timer); this._timer = null; } };
  P._agenda = function (msHora, fn) {
    var S = this;
    S._limpaTimer();
    S._timer = S._agendar(function () { S._timer = null; fn(); }, Math.max(0, msHora) / S._fator());
  };
  P._prefPadrao = function (t) {
    var s = this.sala, uid = this._ordem()[t], tc = s && s.tec && s.tec[uid];
    if (tc && tc.papel === "bot") { var b = this.bots.filter(function (x) { return x.t === t; })[0]; if (b) return b.formacao; }
    return (tc && tc.formacao) || "4-4-2";
  };
  P._humanos = function () {
    var s = this.sala, out = [];
    this._ordem().forEach(function (uid, t) { var tc = s && s.tec && s.tec[uid]; if (!tc || tc.papel !== "bot") out.push(t); });
    return out;
  };
  P._todosProntos = function () {
    var S = this;
    return S._humanos().every(function (t) { return !!(S.escal[t] && S.escal[t].pronto); });
  };
  P._programa = function () {
    var S = this, L = LE(), ctx = S.ctx;
    S._limpaTimer();
    if (S.parado || S.alterada || S.soOlhar || !ctx || !S.sala || !S.sala.meta || S.pausado()) return;
    if (S._ocupado) return;              // a ação em curso chama o _programa quando termina
    var est = S.sala.meta.estado, agora = S.hora();
    if (est === "leilao") {
      if (!S.vivo) { S._agenda(S.atraso, function () { S._acao("inicial"); }); return; }
      var v = S.vivoN;
      if (v.fase === "fim") { S._agenda(S.atraso, function () { S._acao("escalacao"); }); return; }
      var fim = L.fimDoLote(v, ctx), seq = v.seq, n = v.n;
      if (L.todosPassaram(v, ctx) || agora >= fim) { S._agenda(S.atraso, function () { S._acao("fechar", { seq: seq }); }); return; }
      var prox = { quando: fim, tipo: "fechar" };
      S.bots.forEach(function (b) {
        if (S._falhas[seq + ":" + n + ":" + b.t]) return;
        var a = L.robo(v, ctx, b);
        if (a && a.quando < prox.quando) prox = { quando: a.quando, tipo: "robo", bot: b };
      });
      S._agenda(prox.quando - agora + S.atraso, function () { S._acao(prox.tipo, { seq: seq, n: n, bot: prox.bot }); });
      return;
    }
    if (est === "escalacao") {
      var limite = num(S.sala.meta.fimLeilao, agora) + ESCAL_MS;
      S._agenda((S._todosProntos() ? 0 : limite - agora) + S.atraso, function () { S._acao("camp"); });
    }
  };
  // a transação no vivo com uma função pura do leilao.js; quem fechou um lote vendido grava o registro da venda
  P._transVivo = function (fn) {
    var S = this, L = LE(), ctx = S.ctx, rede = S.rede, motivo = null, antes = null;
    return rede.transacao("vivo", function (cur) {
      motivo = null; antes = cur;
      var r = fn(cur, rede.horaServidor());
      if (!r || !r.ok) { motivo = (r && r.motivo) || "nada"; return undefined; }
      return r.vivo;
    }).then(function (res) {
      res.motivo = motivo;
      if (res.feito && antes) {
        var a = L.norm(antes, ctx), b = res.valor ? L.norm(res.valor, ctx) : null;
        if (b && b.seq > a.seq && a.fase !== "fim" && a.lider >= 0 && a.i >= 0 && b.d.charAt(a.i) === L.letra(a.lider)) {
          rede.gravar("vendas/" + a.i, { t: a.lider, v: a.valor, s: a.seq });
        }
        S.guardarHora(false);
      }
      return res;
    });
  };
  P._acao = function (tipo, a) {
    var S = this, L = LE(), ctx = S.ctx, rede = S.rede, TS = rede.TS, p;
    if (S.parado || S.alterada) return;
    S._ocupado = true;
    if (tipo === "inicial") {
      p = rede.transacao("vivo", function (cur) { return cur == null ? L.inicial(ctx, rede.horaServidor(), { carimbo: TS }) : undefined; });
    } else if (tipo === "fechar") {
      p = S._transVivo(function (cur, agora) { return L.fechar(cur, ctx, a.seq, agora, { carimbo: TS }); });
    } else if (tipo === "robo") {
      p = S._transVivo(function (cur, agora) { return L.aplicarRobo(cur, ctx, a.bot, a.seq, a.n, agora, { carimbo: TS }); });
    } else if (tipo === "escalacao") {
      p = rede.transacao("sala", function (s) {
        if (!s || !s.meta || s.meta.estado !== "leilao" || !S.vivoN || S.vivoN.fase !== "fim") return undefined;
        s.meta.estado = "escalacao"; s.meta.fimLeilao = TS; s.meta.atividade = TS;
        return s;
      });
    } else if (tipo === "camp") {
      p = rede.transacao("sala", function (s) {
        if (!s || !s.meta || s.meta.estado !== "escalacao") return undefined;
        if (!S._todosProntos() && rede.horaServidor() < num(s.meta.fimLeilao, 0) + ESCAL_MS) return undefined;
        s.meta.estado = "camp"; s.meta.atividade = TS;
        return s;
      });
    } else { S._ocupado = false; return; }
    p.then(function (res) {
      S._ocupado = false;
      if (!res.feito) {
        if (tipo === "robo" && res.motivo !== "seq" && res.motivo !== "nada") S._falhas[a.seq + ":" + a.n + ":" + a.bot.t] = 1;
        // fechar cedo (o relógio deste aparelho chegou antes do da rede): espera um pouco antes de tentar de novo
        if (tipo === "fechar" && res.motivo === "cedo") { S._cedo++; if (S._cedo > 2) { S._agenda(50, function () { S._programa(); }); return; } }
      } else S._cedo = 0;
      S._programa();
    }, function (e) {
      S._ocupado = false;
      if (global.console) console.error(e);
      S._agenda(1000, function () { S._programa(); });
    });
  };

  /* ---------- o que as telas mostram ---------- */
  P.escalacao = function (t) {
    var S = this;
    if (!S.ctx || t < 0 || t >= S.ctx.T) return null;
    var v = S.vivo || { d: null, cx: [] };
    return LE().escalacaoDe(v, S.ctx, t, S.escal[t] || null, S._prefPadrao(t));
  };
  // o alvo de cada botão sobre o valor VISTO, e se pode (com o motivo)
  P._alvo = function (tipo, agora) {
    var S = this, L = LE(), v = S.vivoN, ctx = S.ctx;
    if (S.eu < 0 || !v) return { alvo: 0, pode: false, motivo: "fim", max: 0 };
    var pd = L.pode(v, ctx, S.eu, agora), base = v.valor, alvo;
    if (tipo === "tudo") alvo = pd.max;
    else if (typeof tipo === "number") alvo = Math.floor(tipo);
    else alvo = base + (PASSOS[tipo] || 1);
    var r = { alvo: alvo, pode: pd.pode, motivo: pd.motivo, max: pd.max, valor: base };
    if (!r.pode) return r;
    if (S.alterada) { r.pode = false; r.motivo = "alterada"; return r; }
    if (!(alvo >= base + 1)) { r.pode = false; r.motivo = "valor"; return r; }
    if (alvo > pd.max) { r.pode = false; r.motivo = "max"; return r; }
    return r;
  };
  P.ver = function () {
    var S = this, L = LE(), ctx = S.ctx, v = S.vivoN, sala = S.sala || {}, meta = sala.meta || {}, cfg = sala.cfg || {};
    var agora = S.hora(), ordem = ctx ? S._ordem() : [];
    var out = {
      codigo: S.codigo, treino: S.treino, estado: meta.estado || null, alterada: S.alterada, soOlhar: S.soOlhar,
      conectado: S.rede.conectado ? S.rede.conectado() : true, pausado: S.pausado(), agora: agora, eu: S.eu,
      T: ctx ? ctx.T : 0, liga: { id: cfg.liga || null, nome: cfg.ligaNome || "" }, cfg: cfg, fase: v ? v.fase : null,
      tecnicos: [], lote: null, botoes: null, proximos: [], vendas: [], ultimo: S.ultimo, meu: null,
      fimEscalacao: meta.estado === "escalacao" ? num(meta.fimLeilao, agora) + ESCAL_MS : null
    };
    if (!ctx) return out;
    ordem.forEach(function (uid, t) {
      var tc = (sala.tec && sala.tec[uid]) || {}, c = v ? v.cx[t] : [L.SALDO, L.VAGAS, 0, 0, 0, 0];
      var o = {
        t: t, uid: uid, nome: tc.nome || ("Técnico " + (t + 1)), bot: tc.papel === "bot", papel: tc.papel || "tecnico",
        clube: tc.clube || limpaClube(null), eu: t === S.eu,
        saldo: c[0], vagas: c[1], n: L.VAGAS - c[1], gk: c[2], df: c[3], mf: c[4], fw: c[5],
        max: v ? L.maximo(v, ctx, t) : 0, passou: false, lider: false, naoPode: null
      };
      if (v && v.fase !== "fim" && v.i >= 0) {
        o.lider = v.lider === t; o.passou = v.p.charAt(t) === "1";
        if (!o.lider && !o.passou) { var pd = L.pode(v, ctx, t); if (!pd.pode) o.naoPode = pd.motivo; }
      }
      out.tecnicos.push(o);
    });
    if (v && v.fase !== "fim" && v.i >= 0) {
      var fim = L.fimDoLote(v, ctx), libera = v.abre + ctx.espera;
      out.lote = {
        i: v.i, seq: v.seq, retrato: ctx.lotes[v.i], fase: v.fase, ordem: v.k + 1,
        total: v.fase === "rep" ? v.sem.length : ctx.fila.length,
        valor: v.valor, lider: v.lider, n: v.n, h: v.h.slice(), abre: v.abre, liberado: libera, fim: fim,
        dur: v.fase === "rep" ? ctx.durRep : ctx.dur, restante: Math.max(0, fim - Math.max(agora, libera)),
        pausa: agora < libera, fechando: agora >= fim
      };
      out.proximos = L.proximos(v, ctx, 5).map(function (i) { return { i: i, retrato: ctx.lotes[i] }; });
    }
    if (S.eu >= 0) {
      if (out.lote) {
        var b = {};
        ["+1", "+5", "+10", "tudo"].forEach(function (k) { b[k] = S._alvo(k, agora); });
        var o2 = S._alvo(v.valor + 1, agora);
        b.outro = { min: v.valor + 1, max: o2.max, pode: o2.pode, motivo: o2.motivo };
        b.passar = { pode: o2.pode, motivo: o2.motivo };
        out.botoes = b;
      }
      var esc = S.escalacao(S.eu);
      out.meu = {
        t: S.eu, time: L.timeIdx(S.vivo || { d: null, cx: [] }, ctx, S.eu).map(function (k) { return { idx: k, retrato: L.retratoDe(ctx, k) }; }),
        escalacao: esc, pronto: !!(S.escal[S.eu] && S.escal[S.eu].pronto)
      };
    }
    Object.keys(S.vendas || {}).forEach(function (k) {
      var x = S.vendas[k]; if (!x) return;
      var i = +k; out.vendas.push({ i: i, t: x.t, preco: x.v, seq: x.s || 0, retrato: ctx.lotes[i] });
    });
    out.vendas.sort(function (a, b2) { return a.seq - b2.seq; });
    return out;
  };

  /* ---------- as ações da pessoa ---------- */
  function recusa(motivo, extra) { var r = { ok: false, estado: "recusado", motivo: motivo }; if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; }); return Promise.resolve(r); }
  /** Lance: '+1' | '+5' | '+10' (sobre o valor VISTO) | 'tudo' | um número (outro valor). Aborta se alguém deu lance
   *  depois do que a pessoa viu ("Alguém chegou antes": nunca sobe sozinho). Promise({ ok, estado: 'aceito' | 'antes'
   *  (o preço novo em `valor`) | 'fechado' (o lote já fechou) | 'recusado' (motivo), valor }). */
  P.lance = function (tipo) {
    var S = this, L = LE(), ctx = S.ctx, rede = S.rede;
    if (S.parado) return recusa("parado");
    if (S.soOlhar) return recusa("fase");
    var agora = S.hora(), info = S._alvo(tipo, agora);
    if (!info.pode) return recusa(info.motivo, { max: info.max, valor: info.valor });
    var v = S.vivoN, seqV = v.seq, nV = v.n, alvo = info.alvo, toque = agora, eu = S.eu;
    return S._transVivo(function (cur, ag) {
      if (cur) { var c = L.norm(cur, ctx); if (c.seq === seqV && c.n !== nV) return { ok: false, motivo: "antes" }; }
      return L.lance(cur, ctx, eu, alvo, seqV, ag, { toque: toque, carimbo: rede.TS });
    }).then(function (res) {
      if (res.feito) return { ok: true, estado: "aceito", valor: alvo };
      var c = res.valor ? L.norm(res.valor, ctx) : null, m = res.motivo;
      if (m === "antes" || m === "valor") return { ok: false, estado: "antes", motivo: "antes", valor: c ? c.valor : 0, lider: c ? c.lider : -1 };
      if (m === "seq" || m === "fim" || m === "tarde") return { ok: false, estado: "fechado", motivo: "fechado" };
      return { ok: false, estado: "recusado", motivo: m, max: info.max };
    });
  };
  /** Passar (só neste jogador). Promise({ ok, estado, motivo }). */
  P.passar = function () {
    var S = this, L = LE(), ctx = S.ctx, rede = S.rede;
    if (S.parado) return recusa("parado");
    if (S.soOlhar) return recusa("fase");
    var agora = S.hora(), info = S._alvo(S.vivoN ? S.vivoN.valor + 1 : 1, agora);
    if (!info.pode) return recusa(info.motivo, { max: info.max });
    var seqV = S.vivoN.seq, eu = S.eu;
    return S._transVivo(function (cur, ag) { return L.passar(cur, ctx, eu, seqV, ag, { carimbo: rede.TS }); }).then(function (res) {
      if (res.feito) return { ok: true, estado: "aceito" };
      if (res.motivo === "seq" || res.motivo === "fim") return { ok: false, estado: "fechado", motivo: "fechado" };
      return { ok: false, estado: "recusado", motivo: res.motivo };
    });
  };
  /** A formação preferida (durante o leilão) ou a do time (depois): só uma em que o time cabe. */
  P.mudarFormacao = function (f) {
    var S = this, L = LE();
    if (S.parado) return recusa("parado");
    if (S.eu < 0 || S.soOlhar) return recusa("fase");
    if (L.FORMACOES.indexOf(f) < 0) return recusa("naoCabe");
    var time = L.timeIdx(S.vivo || { d: null, cx: [] }, S.ctx, S.eu).map(function (k) { return L.retratoDe(S.ctx, k); });
    if (!L.cabeEm(L.contaMascaras(time), f)) return recusa("naoCabe");
    return S.rede.atualizar("escal/" + S.eu, { formacao: f, tit: null }).then(function () { return { ok: true, estado: "aceito" }; });
  };
  /** Troca duas vagas da escalação (os 11 completos; cada um só numa vaga dos seus grupos). */
  P.trocar = function (a, b) {
    var S = this, L = LE();
    if (S.parado) return recusa("parado");
    if (S.eu < 0 || S.soOlhar) return recusa("fase");
    var e = S.escalacao(S.eu); if (!e) return recusa("incompleto");
    var r = L.trocarVagas(e, S.ctx, a, b);
    if (r.erro) return recusa(r.erro);
    return S.rede.atualizar("escal/" + S.eu, { formacao: e.formacao, tit: r.tit }).then(function () { return { ok: true, estado: "aceito" }; });
  };
  P.prontoEscalacao = function (sim) {
    var S = this;
    if (S.parado) return recusa("parado");
    if (S.eu < 0 || S.soOlhar) return recusa("fase");
    return S.rede.atualizar("escal/" + S.eu, { pronto: sim === false ? null : true }).then(function () { return { ok: true, estado: "aceito" }; });
  };

  /* ---------- parar e sair ---------- */
  /** Para os relógios e os ouvintes (a sala continua guardada; abrir() volta a ela). */
  P.parar = function (semGuardar) {
    var S = this;
    if (S.parado) return;
    if (!semGuardar) S.guardarHora(true);
    S.parado = true;
    S._limpaTimer();
    S._paraOuvir.forEach(function (f) { try { f(); } catch (e) {} });
    S._paraOuvir = [];
    if (S._tiraVisibilidade) S._tiraVisibilidade();
    if (_atual === S) _atual = null;
  };
  /** "Sair da sala": no treino, encerra e apaga a sala deste aparelho (o PR 2 faz a saída da sala online). */
  P.sair = function () {
    var S = this, rede = S.rede, treino = S.treino;
    S.parar(treino);
    if (treino) { if (rede.apagar) rede.apagar(); else rede.gravar("", null); }
    return Promise.resolve({ ok: true });
  };
  // o treino para com a página escondida e volta quando ela aparece (a pessoa não perde lotes atendendo o telefone)
  P._ligaVisibilidade = function () {
    var S = this, doc = global.document;
    if (!S._relogio || !doc || !doc.addEventListener || !global.addEventListener) return;
    function vis() { S.segurar("pagina", !!doc.hidden); }
    function sai() { S.guardarHora(true); }
    doc.addEventListener("visibilitychange", vis);
    global.addEventListener("pagehide", sai);
    S._tiraVisibilidade = function () { doc.removeEventListener("visibilitychange", vis); global.removeEventListener("pagehide", sai); };
    if (doc.hidden) S.segurar("pagina", true);
  };

  /* ================= criar e abrir ================= */
  function ordemPrevista(s) {
    var tec = (s && s.tec) || {};
    return Object.keys(tec).sort(function (a, b) {
      var A = tec[a], B = tec[b];
      return ((A.papel === "dono" ? 0 : 1) - (B.papel === "dono" ? 0 : 1)) || (num(A.entrou, 99) - num(B.entrou, 99)) || (a < b ? -1 : a > b ? 1 : 0);
    });
  }
  function redeTreino(codigo, opc) {
    var base = opc.relogio || function () { return Date.now(); };
    var C = relogioTreino(base, base(), opc.fator || FATOR);
    var rede = TM.leilaoRede.memoria(codigo, {
      relogio: C.hora, agendar: opc.agendar, latencia: opc.latencia, armazem: opc.armazem, guardar: opc.guardar
    });
    return { rede: rede, relogio: C };
  }
  function comeca(sessao, opc) {
    var S = sessao;
    if (_atual && _atual !== S && !opc.semAtual) _atual.parar();
    if (!opc.semAtual) _atual = S;
    S._ligaVisibilidade();
    S._programa();
    S._notificar();
    return S;
  }
  // as salas de treino guardadas: a mais antiga sai quando passa do limite
  function abreEspaco(armazem, codigoNovo) {
    var cods = TM.leilaoRede.salasGuardadas(armazem).filter(function (c) { return c !== codigoNovo; });
    if (cods.length < MAX_TREINOS) return;
    var info = cods.map(function (c) {
      var a = null; try { a = armazem.ler(TM.leilaoRede.CHAVE_SALA + c, null); } catch (e) { a = null; }
      return { c: c, criada: num(a && a.sala && a.sala.meta && a.sala.meta.criada, 0) };
    }).sort(function (x, y) { return x.criada - y.criada; });
    while (info.length >= MAX_TREINOS) {
      var c = info.shift().c;
      TM.leilaoRede.memoria(c, { armazem: armazem }).apagar();
    }
  }
  /** O treino: você + 1 a 7 bots, numa sala só deste aparelho. */
  function criarTreino(opc) {
    opc = opc || {};
    var L = LE();
    return Promise.resolve().then(function () {
      var nb = Math.floor(num(opc.bots, 3));
      if (!(nb >= L.TEC_MIN - 1 && nb <= L.TEC_MAX - 1)) throw new Error("bots");
      var mundo = opc.mundo || TM.data.mundoBase(), lg = mundo.leaguesById && mundo.leaguesById[opc.liga];
      if (!lg) throw new Error("liga");
      var T = nb + 1, semente = String(opc.semente != null ? opc.semente : u32()), codigo = String(opc.codigo || novoCodigo());
      var tempo = num(opc.tempo, L.DUR); if (tempo < 1000) tempo *= 1000;
      if (L.TEMPOS.indexOf(tempo) < 0) tempo = L.DUR;
      var formacao = L.FORMACOES.indexOf(opc.formacao) >= 0 ? opc.formacao : "4-4-2";
      var armazem = opc.armazem || armazemPadrao();
      if (opc.guardar !== false) abreEspaco(armazem, codigo);
      var lotes = L.criarLotes(mundo, opc.liga, T);
      var R = redeTreino(codigo, Object.assign({}, opc, { armazem: armazem })), rede = R.rede, TS = rede.TS;
      var uid = meuUid(), clube = limpaClube(opc.clube || clubeDoUltimate() || CLUBE_PADRAO);
      var tec = {};
      tec[uid] = { nome: meuNome(), papel: "dono", pronto: true, entrou: 0, clube: clube, formacao: formacao };
      identidadesBots(semente, nb, clube.cor).forEach(function (b) { tec[b.uid] = { nome: b.nome, papel: b.papel, pronto: true, entrou: b.entrou, clube: b.clube, formacao: b.formacao }; });
      var sala = {
        meta: { dono: uid, proto: PROTO, regras: L.REGRAS, versaoTM: versao(), edicao: edicao(), criada: TS, estado: "saguao", semente: semente, atividade: TS, treino: true },
        cfg: { liga: opc.liga, ligaNome: lg.name || opc.liga, T: T, tempo: tempo, formato: "mata", overall: "mostra" },
        tec: tec
      };
      var esc = {}; esc["escal/0"] = { formacao: formacao };
      return rede.atualizar("", { sala: sala, lotes: { l: lotes.lotes, f: lotes.fora } }).then(function () {
        return rede.atualizar("", esc);
      }).then(function () {
        // o Começar (§3.3): só do saguão, com todos prontos e os lotes gravados; grava a ordem dos técnicos
        return rede.transacao("sala", function (s) {
          if (!s || !s.meta || s.meta.estado !== "saguao") return undefined;
          var ordem = ordemPrevista(s), n = ordem.length;
          if (n < L.TEC_MIN || n > L.TEC_MAX || (s.cfg && s.cfg.T !== n)) return undefined;
          if (!ordem.every(function (u) { return s.tec[u].pronto; })) return undefined;
          s.meta.estado = "leilao"; s.meta.atividade = TS; s.ordem = ordem;
          return s;
        });
      }).then(function (r) {
        if (!r.feito) throw new Error("comecar");
        var S = new Sessao(rede, Object.assign({}, opc, { _relogio: R.relogio }));
        return S._carregar({ eu: 0 }).then(function () { return comeca(S, opc); });
      });
    });
  }
  /** Volta a uma sala guardada (o treino depois de recarregar a página), ou abre outro "aparelho" (opc.rede). */
  function abrir(codigo, opc) {
    opc = opc || {};
    var rede = opc.rede, relogio = null;
    if (!rede) { var R = redeTreino(String(codigo), opc); rede = R.rede; relogio = R.relogio; }
    var S = new Sessao(rede, Object.assign({}, opc, { _relogio: relogio }));
    return S._carregar(Object.assign({}, opc, { retomar: !!relogio })).then(function () { return comeca(S, opc); });
  }
  /** As salas guardadas neste aparelho ("Minhas salas"), da mais nova para a mais antiga. */
  function salas(opc) {
    opc = opc || {};
    var armazem = opc.armazem || armazemPadrao(), out = [];
    TM.leilaoRede.salasGuardadas(armazem).forEach(function (c) {
      var a = null; try { a = armazem.ler(TM.leilaoRede.CHAVE_SALA + c, null); } catch (e) { a = null; }
      var s = a && a.sala; if (!s || !s.meta) return;
      var v = a.vivo || {}, ordem = s.ordem || ordemPrevista(s), dono = s.tec && s.tec[s.meta.dono];
      out.push({
        codigo: c, treino: !!s.meta.treino, liga: s.cfg && s.cfg.liga, ligaNome: (s.cfg && s.cfg.ligaNome) || "", T: ordem.length,
        estado: s.meta.estado, fase: v.fase || null, k: num(v.k, -1), criada: num(s.meta.criada, 0),
        clube: dono ? dono.clube : null, regrasOk: s.meta.regras === LE().REGRAS
      });
    });
    return out.sort(function (x, y) { return y.criada - x.criada; });
  }

  TM.leilaoSessao = {
    PROTO: PROTO, ESCAL_MS: ESCAL_MS, MAX_TREINOS: MAX_TREINOS, NOMES_BOT: NOMES_BOT, CLUBES_BOT: CLUBES_BOT,
    criarTreino: criarTreino, abrir: abrir, salas: salas, textoMotivo: textoMotivo, limpaClube: limpaClube,
    /** O clube com que a pessoa começa (o do Ultimate, se houver; senão "Meu Clube"): a Criar sala mostra e deixa mudar. */
    clubeInicial: function () { return clubeDoUltimate() || limpaClube(CLUBE_PADRAO); },
    atual: function () { return _atual; },
    /** Gancho de teste: o relógio dos treinos (o atual e os próximos) anda `fator` vezes mais rápido. */
    acelerar: function (fator) { FATOR = fator > 0 ? fator : 1; if (_atual) _atual.acelerar(FATOR); }
  };
})(window);
