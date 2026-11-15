/* ================= TOTAL MATCH — Modo Leilão: o transporte ================= */
/* A MESMA interface nos dois casos (PLANO-LEILAO.md §3.1 e §3.3): a sessão (leilao-sessao.js) chama as funções puras
   do leilao.js dentro de `transacao`, com a memória (o treino e os testes) ou com o Firebase (o online, PR 2).
   Cada rede é UMA sala (`leiloes/{CÓDIGO}`); os caminhos são relativos a ela ("sala", "lotes", "vivo", "escal/0"…).

     ler(caminho)                → Promise(valor | null)
     ouvir(caminho, fn)          → fn(valor) agora e a cada mudança naquele caminho; devolve a função que para de ouvir
     transacao(caminho, fn)      → fn(atual) devolve o novo valor ou undefined (aborta); Promise({ feito, valor })
     gravar(caminho, valor)      → Promise (valor null apaga)
     atualizar(caminho, parcial) → Promise ({ "a/b": x, c: y } relativos ao caminho; null apaga)
     horaServidor()              → ms (a hora do servidor; no treino, a do aparelho)
     aoCair(fn)                  → fn() quando a conexão cai; devolve a função que para de avisar
     conectado()                 → bool
     TS                          → o carimbo da hora do servidor: gravado dentro de um valor, vira a hora de quem grava
                                   (como o ServerValue.TIMESTAMP)
   Como o Firebase, ninguém guarda null, lista vazia nem objeto vazio: quem lê aceita a falta (o leilao.js aceita).

   memoria(codigo, opc) — o treino num aparelho e os testes em Node. opc:
     relogio()        a hora (padrão Date.now; os testes passam um relógio acelerado)
     latencia         ms (ou fn(op) → ms) de cada operação até o "servidor" (padrão 0; os testes simulam a rede)
     agendar(fn, ms)  quem espera a latência (padrão setTimeout)
     guardar          false = não grava no aparelho (padrão: grava em TM.storage "leilao:sala:<código>", com o índice
                      "leilao:salas": o treino volta depois de recarregar a página)
     armazem          { ler(chave, padrao), gravar(chave, valor), apagar(chave) } (padrão TM.storage read/write/remove)
   Também: apagar() (some com a sala e com a gravação; depois disso nada mais grava) e salvarAgora() (grava no aparelho
   sem esperar: a página vai fechar).
   Os testes ainda têm: outroCliente(opc) (outro aparelho no MESMO banco, com a sua latência e a sua conexão), _cair(),
   _voltar() e _arvore().

   firebase(codigo) — PR 2. A mesma interface sobre `leiloes/{código}` do Realtime Database do TM (TM.net._db):
     ler = once('value'); ouvir = on('value') (o off devolvido); transacao = ref.transaction(fn, fim, false) — SEM
     applyLocally (nada de líder falso piscando) e repetindo com o valor do servidor quando o cache local é velho;
     gravar = set; atualizar = update; TS = firebase.database.ServerValue.TIMESTAMP (resolvido no servidor; o
     onComplete recebe a estimativa local, a hora certa se lê depois do ack); horaServidor = Date.now() + o
     .info/serverTimeOffset recalibrado pelo `bate` (a amostra de menor ida e volta); conectado/aoCair = .info/connected.
     Presença (pres/{uid}/{chave} com onDisconnect().remove()), batimento e a testemunha da hora são da sessão. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  var TS = { ".sv": "timestamp" };
  var CHAVE_SALA = "leilao:sala:";
  var CHAVE_INDICE = "leilao:salas";

  function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function ehTS(v) { return !!v && typeof v === "object" && !Array.isArray(v) && v[".sv"] === "timestamp"; }
  // a hora do servidor no lugar do carimbo, e nada vazio (como o Firebase guarda)
  function resolve(v, hora) {
    if (ehTS(v)) return hora;
    if (v == null) return null;
    if (Array.isArray(v)) {
      var a = v.map(function (x) { return resolve(x, hora); });
      var vazio = a.every(function (x) { return x == null; });
      return vazio ? null : a;
    }
    if (typeof v === "object") {
      var o = {}, tem = false;
      Object.keys(v).forEach(function (k) { var x = resolve(v[k], hora); if (x != null) { o[k] = x; tem = true; } });
      return tem ? o : null;
    }
    if (typeof v === "number" && !isFinite(v)) return null;
    return v;
  }
  function partes(caminho) { return String(caminho || "").split("/").filter(Boolean); }
  function pega(arv, ps) { var x = arv; for (var i = 0; i < ps.length; i++) { if (x == null || typeof x !== "object") return null; x = x[ps[i]]; } return x == null ? null : x; }
  // grava `valor` em `ps` dentro de `arv` (objeto) e poda os pais que ficaram vazios; devolve a árvore nova
  function poe(arv, ps, valor) {
    if (!ps.length) return valor == null ? {} : valor;
    var raiz = arv && typeof arv === "object" ? arv : {}, x = raiz, pilha = [];
    for (var i = 0; i < ps.length - 1; i++) {
      var k = ps[i];
      if (x[k] == null || typeof x[k] !== "object") x[k] = {};
      pilha.push([x, k]); x = x[k];
    }
    var ult = ps[ps.length - 1];
    if (valor == null) delete x[ult]; else x[ult] = valor;
    for (var j = pilha.length - 1; j >= 0; j--) {
      var pai = pilha[j][0], kk = pilha[j][1], filho = pai[kk];
      if (filho && typeof filho === "object" && !Object.keys(filho).length) delete pai[kk];
    }
    return raiz;
  }
  function relacionados(a, b) { var n = Math.min(a.length, b.length); for (var i = 0; i < n; i++) if (a[i] !== b[i]) return false; return true; }

  /* ---------- o "servidor" em memória (um por sala; os clientes são os aparelhos) ---------- */
  function Banco(codigo, opc) {
    this.codigo = String(codigo);
    this.relogio = opc.relogio || function () { return Date.now(); };
    this.agendar = opc.agendar || function (fn, ms) { return setTimeout(fn, ms); };
    this.armazem = opc.guardar === false ? null : (opc.armazem || armazemPadrao());
    this.arv = {};
    this.ouvintes = [];
    this.sujo = false;
    if (this.armazem) {
      var salvo = null;
      try { salvo = this.armazem.ler(CHAVE_SALA + this.codigo, null); } catch (e) { salvo = null; }
      if (salvo && typeof salvo === "object") this.arv = salvo;
    }
  }
  Banco.prototype.muda = function (ps, valor) {
    if (this.apagado) return;            // a sala apagada não volta (nem por uma gravação que já estava a caminho)
    this.arv = poe(this.arv, ps, valor);
    var self = this;
    this.ouvintes.slice().forEach(function (o) { if (relacionados(o.ps, ps)) self.avisa(o); });
    this.marcaSujo();
  };
  Banco.prototype.avisa = function (o) {
    if (o.parado || !o.cliente.on) return;
    var v = pega(this.arv, o.ps), txt = JSON.stringify(v);
    if (o.visto === txt) return;
    o.visto = txt;
    try { o.fn(clone(v)); } catch (e) { if (global.console) console.error(e); }
  };
  Banco.prototype.marcaSujo = function () {
    if (!this.armazem || this.sujo || this.apagado) return;
    this.sujo = true;
    var self = this;
    this.agendar(function () { self.salva(); }, 200);
  };
  Banco.prototype.salva = function () {
    this.sujo = false;
    if (!this.armazem || this.apagado) return;
    try {
      this.armazem.gravar(CHAVE_SALA + this.codigo, this.arv);
      var ind = this.armazem.ler(CHAVE_INDICE, []) || [];
      if (ind.indexOf(this.codigo) < 0) { ind.push(this.codigo); this.armazem.gravar(CHAVE_INDICE, ind); }
    } catch (e) {}
  };
  Banco.prototype.apaga = function () {
    this.arv = {};
    this.apagado = true;
    var self = this;
    this.ouvintes.slice().forEach(function (o) { self.avisa(o); });
    if (!this.armazem) return;
    try {
      this.armazem.apagar(CHAVE_SALA + this.codigo);
      var ind = (this.armazem.ler(CHAVE_INDICE, []) || []).filter(function (c) { return c !== self.codigo; });
      if (ind.length) this.armazem.gravar(CHAVE_INDICE, ind); else this.armazem.apagar(CHAVE_INDICE);
    } catch (e) {}
  };

  function armazemPadrao() {
    return {
      ler: function (k, p) { return TM.storage ? TM.storage.read(k, p) : p; },
      gravar: function (k, v) { if (TM.storage) TM.storage.write(k, v); },
      apagar: function (k) { if (TM.storage) TM.storage.remove(k); }
    };
  }

  /* ---------- um cliente (um aparelho) ---------- */
  function cliente(banco, opc) {
    opc = opc || {};
    var lat = opc.latencia || 0;
    var C = { on: true, fila: [], quedas: [] };
    function atraso(op) { return typeof lat === "function" ? Math.max(0, lat(op) || 0) : lat; }
    // cada operação chega ao "servidor" depois da latência; sem conexão, espera a volta (como o Firebase guarda)
    function envia(op, aplicar) {
      return new Promise(function (ok, falha) {
        function vai() {
          if (!C.on) { C.fila.push(vai); return; }
          try { ok(aplicar()); } catch (e) { falha(e); }
        }
        var ms = atraso(op);
        if (ms > 0) banco.agendar(vai, ms); else Promise.resolve().then(vai);
      });
    }
    var rede = {
      tipo: "memoria",
      codigo: banco.codigo,
      TS: TS,
      horaServidor: function () { return banco.relogio(); },
      conectado: function () { return C.on; },
      aoCair: function (fn) { C.quedas.push(fn); return function () { C.quedas = C.quedas.filter(function (x) { return x !== fn; }); }; },
      ler: function (caminho) { var ps = partes(caminho); return envia("ler", function () { return clone(pega(banco.arv, ps)); }); },
      ouvir: function (caminho, fn) {
        var o = { ps: partes(caminho), fn: fn, visto: undefined, cliente: C, parado: false };
        banco.ouvintes.push(o);
        envia("ouvir", function () { banco.avisa(o); });
        return function () { o.parado = true; banco.ouvintes = banco.ouvintes.filter(function (x) { return x !== o; }); };
      },
      gravar: function (caminho, valor) {
        var ps = partes(caminho), v = clone(valor);
        return envia("gravar", function () { banco.muda(ps, resolve(v, banco.relogio())); return true; });
      },
      atualizar: function (caminho, parcial) {
        var base = partes(caminho), p = clone(parcial) || {};
        return envia("atualizar", function () {
          var hora = banco.relogio();
          Object.keys(p).forEach(function (k) { banco.muda(base.concat(partes(k)), resolve(p[k], hora)); });
          return true;
        });
      },
      // a transação roda UMA vez, no "servidor", com o valor de lá (o Firebase pode rodar mais vezes: a fn é pura)
      transacao: function (caminho, fn) {
        var ps = partes(caminho);
        return envia("transacao", function () {
          var atual = clone(pega(banco.arv, ps)), novo = fn(atual);
          if (novo === undefined) return { feito: false, valor: atual };
          var gravado = resolve(clone(novo), banco.relogio());
          banco.muda(ps, gravado);
          return { feito: true, valor: clone(gravado) };
        });
      },
      apagar: function () { banco.apaga(); },
      // grava no aparelho agora (sem esperar os 200 ms): a página vai fechar ou esconder
      salvarAgora: function () { banco.salva(); },
      // ----- só dos testes -----
      outroCliente: function (o) { return cliente(banco, o); },
      _cair: function () {
        if (!C.on) return;
        C.on = false;
        C.quedas.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
      },
      _voltar: function () {
        if (C.on) return;
        C.on = true;
        var f = C.fila; C.fila = [];
        f.forEach(function (vai) { vai(); });
        banco.ouvintes.forEach(function (o) { if (o.cliente === C) banco.avisa(o); });
      },
      _arvore: function () { return clone(banco.arv); },
      _salvar: function () { banco.salva(); }
    };
    return rede;
  }

  function memoria(codigo, opc) { return cliente(new Banco(codigo, opc || {}), opc || {}); }
  /** Os códigos das salas de treino guardadas neste aparelho (na edição em uso). */
  function salasGuardadas(armazem) {
    var a = armazem || armazemPadrao();
    try { return (a.ler(CHAVE_INDICE, []) || []).slice(); } catch (e) { return []; }
  }

  TM.leilaoRede = { TS: TS, memoria: memoria, salasGuardadas: salasGuardadas, resolve: resolve, CHAVE_SALA: CHAVE_SALA, CHAVE_INDICE: CHAVE_INDICE };
})(window);
