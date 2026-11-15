/* ================= TOTAL MATCH — Modo Leilão: o transporte ================= */
/* A MESMA interface nos dois casos (PLANO-LEILAO.md §3.1 e §3.3): a sessão (leilao-sessao.js) chama as funções puras
   do leilao.js dentro de `transacao`, com a memória (o treino e os testes) ou com o Firebase (o online, PR 2).
   Cada rede é UMA sala (`leiloes/{CÓDIGO}`); os caminhos são relativos a ela ("sala", "lotes", "vivo", "escal/0"…).

     ler(caminho)                → Promise(valor | null)
     ouvir(caminho, fn, aoErro?) → fn(valor) agora e a cada mudança naquele caminho, sempre DEPOIS (nunca dentro da própria
                                   chamada nem de uma gravação) e na ordem; devolve a função que para de ouvir
     transacao(caminho, fn)      → fn(atual) devolve o novo valor ou undefined (aborta); Promise({ feito, valor }). A fn
                                   pode rodar mais de uma vez (é pura). `valor` = o que ficou gravado (feito) ou o que a fn
                                   viu por último (abortou). No online, o carimbo dentro de `valor` é a ESTIMATIVA da hora
                                   (a hora certa chega pelo ouvir); a conexão que cai antes da resposta REJEITA com
                                   codigo 'desconectado' (pode ter entrado: confira lendo de novo)
     gravar(caminho, valor)      → Promise (valor null apaga)
     atualizar(caminho, parcial) → Promise ({ "a/b": x, c: y } relativos ao caminho; null apaga)
     testemunha(caminho, extra?) → Promise(hora do servidor | null): grava { ...extra, ts: TS } e devolve a hora que o
                                   SERVIDOR pôs (a testemunha da hora, §3.3; null = outra aba gravou por cima). No online
                                   também recalibra o horaServidor()
     horaServidor()              → ms (a hora do servidor; no treino, a do relógio da sala)
     salto()                     → ms: o desencontro entre o relógio de parede e o monótono desde a última testemunha (um
                                   deles pulou: o aparelho dormiu ou a hora mudou); a memória dá sempre 0
     aoCair(fn) · aoVoltar(fn)   → fn() quando a conexão cai · volta; devolvem a função que para de avisar
     conectado()                 → bool
     aoDesconectar(caminho)      → { gravar(v), atualizar(o), apagar(), cancelar() }: o que o SERVIDOR faz quando esta
                                   conexão cai (o onDisconnect; vale uma vez: rearme a cada volta)
     reconectar()                → derruba e refaz a conexão (o iPhone deixa o socket meio aberto depois de dormir)
     fechar()                    → para todos os ouvintes desta rede
     TS                          → o carimbo da hora do servidor: gravado dentro de um valor, vira a hora de quem grava
                                   (como o ServerValue.TIMESTAMP)
   Erros (rejeições) têm `codigo`: 'desconectado' (a resposta não chegou), 'permissao', 'disputa' (o servidor recusou
   25 vezes), 'sobrescrita' (uma gravação por cima cancelou a transação), 'apagada' (a sala foi apagada por esta rede),
   'rede' (o resto).
   Como o Firebase, ninguém guarda null, lista vazia nem objeto vazio: quem lê aceita a falta (o leilao.js aceita). Um nó de
   chaves 0..n pode voltar do Firebase como LISTA (escal/0, vendas/12…): quem lê aceita os dois (a sessão tem `lista`).

   memoria(codigo, opc) — o treino num aparelho e os testes em Node. opc:
     relogio()        a hora (padrão Date.now; os testes passam um relógio acelerado)
     latencia         ms (ou fn(op) → ms) de cada operação até o "servidor" (padrão 0; os testes simulam a rede)
     agendar(fn, ms)  quem espera a latência (padrão setTimeout)
     guardar          false = não grava no aparelho (padrão: grava em TM.storage "leilao:sala:<código>", com o índice
                      "leilao:salas": o treino volta depois de recarregar a página)
     armazem          { ler(chave, padrao), gravar(chave, valor), apagar(chave) } (padrão TM.storage read/write/remove)
   Também: apagar() (some com a sala e com a gravação; depois disso nada mais grava) e salvarAgora() (grava no aparelho
   sem esperar: a página vai fechar).
   Os testes ainda têm: outroCliente(opc) (outro aparelho no MESMO banco, com a sua latência e a sua conexão), _cair()
   (também roda os aoDesconectar dele no "servidor"), _voltar() e _arvore().

   firebase(codigo, opc) — o online: a mesma interface sobre `leiloes/{código}` do Realtime Database do TM (TM.net._db; sem
   ele, levanta um erro com codigo 'indisponivel'). opc (os testes passam o banco falso): db, firebase (o SDK, pelo
   ServerValue), raiz ("leiloes"), relogio() (monótono: padrão performance.now), relogioParede() (padrão Date.now).
     ler = once('value'); ouvir = on('value') (o off devolvido); gravar = set; atualizar = update; TS = o
     ServerValue.TIMESTAMP; os valores passam pela mesma limpeza da memória (sem undefined, NaN nem vazio: o SDK recusa).
     transacao = ref.transaction(fn, fim, false): SEM applyLocally (nada de líder falso piscando). O SDK roda a fn a 1ª
     vez com o cache LOCAL — null num caminho que ninguém ouve — e, se ela abortar ali, nem pergunta ao servidor (o
     onComplete recebe aquele null): por isso a transação OUVE o caminho e espera o 1º valor do servidor antes de rodar
     (o feito:false é sempre sobre um valor que veio do servidor); com o cache velho, o servidor diz "datastale" e o SDK
     roda a fn de novo com o valor de lá (até 25 vezes).
     horaServidor = o relógio monótono + a diferença para o servidor da amostra de MENOR ida e volta (numa janela das 12
     últimas testemunhas; a que não cruza a escolhida — o relógio do aparelho pulou ou dormiu — recomeça a janela); antes
     da 1ª testemunha, Date.now() + .info/serverTimeOffset (o aperto de mão do SDK). conectado/aoCair/aoVoltar =
     .info/connected; reconectar = goOffline()/goOnline() (vale para o TM inteiro, como o SDK: o servidor roda o
     onDisconnect das salas dos OUTROS modos também; a sessão só chama com o socket preso e nenhuma outra sala online
     aberta); aoDesconectar = ref.onDisconnect(); varrer() = apagar a sala de novo, também depois de apagada (quem vê a
     sala sumir manda pelo mesmo socket, depois do que ainda tinha a caminho: nada fica órfão). Presença
     (pres/{uid}/{chave}), batimento e as decisões pela testemunha são da sessão. */
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
    var C = { on: true, fila: [], quedas: [], voltas: [], aoCairOps: [], meus: [] };
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
      salto: function () { return 0; },
      conectado: function () { return C.on; },
      aoCair: function (fn) { C.quedas.push(fn); return function () { C.quedas = C.quedas.filter(function (x) { return x !== fn; }); }; },
      aoVoltar: function (fn) { C.voltas.push(fn); return function () { C.voltas = C.voltas.filter(function (x) { return x !== fn; }); }; },
      ler: function (caminho) { var ps = partes(caminho); return envia("ler", function () { return clone(pega(banco.arv, ps)); }); },
      ouvir: function (caminho, fn) {
        var o = { ps: partes(caminho), fn: fn, visto: undefined, cliente: C, parado: false };
        banco.ouvintes.push(o);
        C.meus.push(o);
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
      // a testemunha da hora: grava { ...extra, ts } e devolve a hora que o "servidor" pôs
      testemunha: function (caminho, extra) {
        var ps = partes(caminho), v = clone(extra) || {};
        return envia("testemunha", function () { var h = banco.relogio(); v.ts = h; banco.muda(ps, resolve(v, h)); return h; });
      },
      // o que o "servidor" faz quando esta conexão cai (_cair): vale uma vez, como o onDisconnect
      aoDesconectar: function (caminho) {
        var ps = partes(caminho);
        function poeOp(op) { return envia("aoDesconectar", function () { C.aoCairOps.push(op); return true; }); }
        return {
          gravar: function (v) { return poeOp({ ps: ps, v: clone(v) }); },
          atualizar: function (o) { return poeOp({ ps: ps, parcial: clone(o) || {} }); },
          apagar: function () { return poeOp({ ps: ps, v: null }); },
          cancelar: function () {
            // como o cancel(): tira o que foi pedido neste caminho e debaixo dele
            return envia("aoDesconectar", function () { C.aoCairOps = C.aoCairOps.filter(function (op) { return !(op.ps.length >= ps.length && relacionados(ps, op.ps)); }); return true; });
          }
        };
      },
      reconectar: function () { rede._cair(); rede._voltar(); },
      fechar: function () {
        C.meus.forEach(function (o) { o.parado = true; });
        banco.ouvintes = banco.ouvintes.filter(function (o) { return C.meus.indexOf(o) < 0; });
        C.meus = [];
      },
      apagar: function () { banco.apaga(); },
      // grava no aparelho agora (sem esperar os 200 ms): a página vai fechar ou esconder
      salvarAgora: function () { banco.salva(); },
      // ----- só dos testes -----
      outroCliente: function (o) { return cliente(banco, o); },
      _cair: function () {
        if (!C.on) return;
        C.on = false;
        // o "servidor" roda o que esta conexão deixou pedido (aoDesconectar) e esquece
        var ops = C.aoCairOps, hora = banco.relogio(); C.aoCairOps = [];
        ops.forEach(function (op) {
          if (op.parcial) Object.keys(op.parcial).forEach(function (k) { banco.muda(op.ps.concat(partes(k)), resolve(op.parcial[k], hora)); });
          else banco.muda(op.ps, resolve(op.v, hora));
        });
        C.quedas.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
      },
      _voltar: function () {
        if (C.on) return;
        C.on = true;
        var f = C.fila; C.fila = [];
        f.forEach(function (vai) { vai(); });
        banco.ouvintes.forEach(function (o) { if (o.cliente === C) banco.avisa(o); });
        C.voltas.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
      },
      _arvore: function () { return clone(banco.arv); },
      _salvar: function () { banco.salva(); }
    };
    return rede;
  }

  function memoria(codigo, opc) { return cliente(new Banco(codigo, opc || {}), opc || {}); }

  /* ---------- firebase(codigo, opc): o online sobre o Realtime Database do TM ---------- */
  var JANELA = 12, FOLGA_MS = 2;
  // o erro do SDK (ou do servidor) num erro claro, com `codigo`
  function erroRede(e, acao) {
    var cod = String((e && (e.code || e.message)) || e || "").toLowerCase(), codigo, msg;
    if (/permission/.test(cod)) { codigo = "permissao"; msg = "O servidor recusou: sem permissão"; }
    else if (/disconnect/.test(cod)) { codigo = "desconectado"; msg = "A conexão caiu antes da resposta: pode ter entrado ou não"; }
    else if (/maxretry/.test(cod)) { codigo = "disputa"; msg = "Muita gente mexendo ao mesmo tempo"; }
    else if (cod === "set") { codigo = "sobrescrita"; msg = "Uma gravação por cima cancelou a transação"; }
    else { codigo = "rede"; msg = "Falha na conexão com o servidor"; }
    var err = new Error(msg + (acao ? " (" + acao + ")" : "") + ".");
    err.codigo = codigo; err.original = e;
    return err;
  }
  function erroCodigo(codigo, msg) { var e = new Error(msg); e.codigo = codigo; return e; }
  // a limpeza da memória (sem undefined, NaN nem vazio: o SDK levanta erro), com o TIMESTAMP do SDK no lugar do carimbo
  function limpa(v, TSv) {
    if (ehTS(v)) return TSv;
    if (v == null || typeof v === "function") return null;
    if (Array.isArray(v)) {
      var a = v.map(function (x) { return limpa(x, TSv); });
      return a.every(function (x) { return x == null; }) ? null : a;
    }
    if (typeof v === "object") {
      var o = {}, tem = false;
      Object.keys(v).forEach(function (k) { var x = limpa(v[k], TSv); if (x != null) { o[k] = x; tem = true; } });
      return tem ? o : null;
    }
    if (typeof v === "number" && !isFinite(v)) return null;
    return v;
  }
  function firebase(codigo, opc) {
    opc = opc || {};
    var fb = opc.firebase || global.firebase;
    var db = opc.db || (TM.net && TM.net._db);
    if (!db || !fb || !fb.database) throw erroCodigo("indisponivel", "O online não está disponível agora (sem conexão com o servidor).");
    var TSv = (fb.database.ServerValue && fb.database.ServerValue.TIMESTAMP) || TS;
    var perf = global.performance;
    var mono = opc.relogio || (perf && perf.now ? function () { return perf.now(); } : function () { return Date.now(); });
    var parede = opc.relogioParede || function () { return Date.now(); };
    var raiz = db.ref((opc.raiz || "leiloes") + "/" + String(codigo));
    function ref(c) { var ps = partes(c); return ps.length ? raiz.child(ps.join("/")) : raiz; }
    var ligado = false, offsetSdk = 0, quedas = [], voltas = [], amostras = [], escolhida = null, meus = [], apagada = false, nonce = 0, difBase = null;

    function avisa(lista) { lista.slice().forEach(function (fn) { Promise.resolve().then(function () { try { fn(); } catch (e) { if (global.console) console.error(e); } }); }); }
    function remover(lista, fn) { return function () { var i = lista.indexOf(fn); if (i >= 0) lista.splice(i, 1); }; }
    var refCon = db.ref(".info/connected"), refOff = db.ref(".info/serverTimeOffset");
    var hCon = refCon.on("value", function (s) {
      var v = !!s.val(), antes = ligado;
      ligado = v;
      if (antes && !v) avisa(quedas);
      if (!antes && v) avisa(voltas);
    });
    var hOff = refOff.on("value", function (s) { offsetSdk = +s.val() || 0; });

    // uma amostra da testemunha: mandou em s, a resposta em r (relógio monótono), o servidor pôs T. A diferença verdadeira
    // está em [T − r, T + 1 − s]; vale a de menor ida e volta; a que não cruza a escolhida recomeça a janela
    function amostra(s, r, T) {
      var a = { off: T + 0.5 - (s + r) / 2, ida: r - s, lo: T - r, hi: T + 1 - s };
      if (escolhida && (a.hi < escolhida.lo - FOLGA_MS || a.lo > escolhida.hi + FOLGA_MS)) amostras = [];
      amostras.push(a);
      if (amostras.length > JANELA) amostras.shift();
      escolhida = amostras.reduce(function (m, x) { return !m || x.ida < m.ida ? x : m; }, null);
      difBase = parede() - mono();
    }
    function horaServidor() { return escolhida ? mono() + escolhida.off : parede() + offsetSdk; }
    function vivo(acao) { if (apagada) return Promise.reject(erroCodigo("apagada", "A sala foi apagada (" + acao + ").")); return null; }
    function falhou(acao) { return function (e) { throw erroRede(e, acao); }; }

    var rede = {
      tipo: "firebase",
      codigo: String(codigo),
      TS: TSv,
      horaServidor: horaServidor,
      // o quanto o relógio de parede e o monótono se desencontraram desde a última testemunha (ms): um deles pulou (o
      // aparelho dormiu, a hora foi ajustada); a sessão não decide nada até a próxima testemunha
      salto: function () { return difBase == null ? 0 : (parede() - mono()) - difBase; },
      conectado: function () { return ligado; },
      aoCair: function (fn) { quedas.push(fn); return remover(quedas, fn); },
      aoVoltar: function (fn) { voltas.push(fn); return remover(voltas, fn); },
      ler: function (caminho) { return ref(caminho).once("value").then(function (s) { return s.val(); }, falhou("ler")); },
      ouvir: function (caminho, fn, aoErro) {
        var r = ref(caminho), item = { parado: false };
        // o SDK chama na hora (dentro do on() com o cache pronto, dentro do set de quem grava): aqui sempre depois, na ordem
        var h = r.on("value", function (s) {
          var v = s.val();
          Promise.resolve().then(function () { if (!item.parado) { try { fn(v); } catch (e) { if (global.console) console.error(e); } } });
        }, function (e) { if (!item.parado && aoErro) aoErro(erroRede(e, "ouvir")); });
        item.para = function () { if (item.parado) return; item.parado = true; r.off("value", h); var i = meus.indexOf(item); if (i >= 0) meus.splice(i, 1); };
        meus.push(item);
        return item.para;
      },
      transacao: function (caminho, fn) {
        var morta = vivo("transação"); if (morta) return morta;
        var r = ref(caminho);
        // ouve antes: o 1º valor vem do servidor (o SDK rodaria a fn com o cache vazio, null, e abortaria sem perguntar)
        return new Promise(function (pronto) {
          var feito = false, h = null;
          h = r.on("value", function () { if (feito) return; feito = true; pronto(function () { r.off("value", h); }); });
        }).then(function (soltar) {
          return r.transaction(function (cur) {
            var novo = fn(cur);
            return novo === undefined ? undefined : limpa(novo, TSv);
          }, undefined, false).then(function (res) {
            soltar();
            return { feito: !!res.committed, valor: res.snapshot ? res.snapshot.val() : null };
          }, function (e) { soltar(); throw erroRede(e, "transação"); });
        });
      },
      gravar: function (caminho, valor) {
        var morta = vivo("gravar"); if (morta) return morta;
        return ref(caminho).set(limpa(valor, TSv)).then(function () { return true; }, falhou("gravar"));
      },
      atualizar: function (caminho, parcial) {
        var morta = vivo("atualizar"); if (morta) return morta;
        var p = {};
        Object.keys(parcial || {}).forEach(function (k) { if (parcial[k] !== undefined) p[k] = limpa(parcial[k], TSv); });
        if (!Object.keys(p).length) return Promise.resolve(true);
        return ref(caminho).update(p).then(function () { return true; }, falhou("atualizar"));
      },
      testemunha: function (caminho, extra) {
        var morta = vivo("testemunha"); if (morta) return morta;
        var r = ref(caminho), n = String(++nonce) + "-" + Math.floor(mono()), v = limpa(extra, TSv) || {};
        v.ts = TSv; v.n = n;
        var s = mono();
        return r.set(v).then(function () {
          var t1 = mono();
          // depois do ack, o cache (ou o servidor) tem o que o SERVIDOR pôs; a marca n diz se é a nossa
          return r.once("value").then(function (snap) {
            var x = snap.val();
            if (!x || x.n !== n || typeof x.ts !== "number") return null;
            amostra(s, t1, x.ts);
            return x.ts;
          });
        }).then(null, falhou("testemunha"));
      },
      aoDesconectar: function (caminho) {
        var od = ref(caminho).onDisconnect();
        function ok() { return true; }
        return {
          gravar: function (v) { return od.set(limpa(v, TSv)).then(ok, falhou("aoDesconectar")); },
          atualizar: function (o) { var p = {}; Object.keys(o || {}).forEach(function (k) { if (o[k] !== undefined) p[k] = limpa(o[k], TSv); }); return od.update(p).then(ok, falhou("aoDesconectar")); },
          apagar: function () { return od.remove().then(ok, falhou("aoDesconectar")); },
          cancelar: function () { return od.cancel().then(ok, falhou("aoDesconectar")); }
        };
      },
      reconectar: function () { try { db.goOffline(); db.goOnline(); } catch (e) {} },
      fechar: function () {
        meus.slice().forEach(function (it) { it.para(); });
        refCon.off("value", hCon); refOff.off("value", hOff);
      },
      apagar: function () {
        if (apagada) return Promise.resolve(true);
        apagada = true;
        return raiz.remove().then(function () { return true; }, falhou("apagar"));
      },
      // apaga a sala de novo, mesmo depois de apagada (a sessão chama quando vê a sala sumir): pelo mesmo socket, vai
      // depois de tudo o que este aparelho ainda tinha a caminho e não deixa nó órfão (apagar não recria nada)
      varrer: function () { return raiz.remove().then(function () { return true; }, function () { return false; }); },
      salvarAgora: function () {},
      // só dos testes: a amostra escolhida da hora
      _hora: function () { return { escolhida: escolhida, amostras: amostras.length, offsetSdk: offsetSdk }; }
    };
    return rede;
  }
  /** Os códigos das salas de treino guardadas neste aparelho (na edição em uso). */
  function salasGuardadas(armazem) {
    var a = armazem || armazemPadrao();
    try { return (a.ler(CHAVE_INDICE, []) || []).slice(); } catch (e) { return []; }
  }

  TM.leilaoRede = { TS: TS, memoria: memoria, firebase: firebase, salasGuardadas: salasGuardadas, resolve: resolve, limpa: limpa, erroRede: erroRede, CHAVE_SALA: CHAVE_SALA, CHAVE_INDICE: CHAVE_INDICE };
})(window);
