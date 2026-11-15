/* O banco falso do Firebase Realtime Database para os testes do Total Match (PLANO-LEILAO.md §4.3). Nenhum teste fala com o
   Firebase de verdade, nem para ler.

   Duas metades:
     · BancoFalso — o SERVIDOR, aqui no Node: a árvore, UM relógio (relogio(): a hora do servidor; ligue-o ao relógio
       acelerado das páginas com relogioAcelerado()), os clientes (um por página ou por aparelho em Node), a latência de
       cada mensagem nos dois sentidos (em fila: o socket é ordenado), os onDisconnect de cada conexão, a queda e a volta.
     · sdkFalso(T) — o CLIENTE, no lugar do SDK compat 10.12.5 (firebase-app/auth/database-compat): roda na página (o
       texto SDK_PAGINA, servido no lugar do firebase-app-compat.js por banco.instalar(contexto)) ou em Node
       (banco.cliente()), com o seu cache, as escritas pendentes, as transações e o .info.

   O que ele IMITA do SDK (conferido no código do @firebase/database 1.0.7, o do firebase 10.12.5 — repoStartTransaction,
   repoSendTransactionQueue, repoRerunTransactionQueue, PersistentConnection.restoreState_/cancelSentTransactions_/
   onRealtimeDisconnect_, repoRunOnDisconnectEvents, ChildrenNode.val, validateFirebaseData; o compat Reference.transaction
   e o runTransaction):
     · transação: a 1ª rodada é NA HORA com o cache local (null se ninguém ouve o caminho: a função que devolve undefined
       para null aborta ali mesmo, sem perguntar ao servidor, e o onComplete recebe null); a transação ouve o caminho
       enquanto vive; o servidor confere a BASE (o "hash" do SDK) e responde "datastale" quando o cache era velho — os
       dados novos chegam ANTES dessa resposta (o socket é ordenado) e a função roda de novo; 25 tentativas e "maxretry";
       applyLocally (o 3º argumento) false = o valor novo não aparece para os ouvintes daqui até o servidor confirmar;
       o onComplete recebe a ESTIMATIVA local do TIMESTAMP (a hora certa chega pelos ouvintes, depois do ack);
     · ServerValue.TIMESTAMP resolvido no servidor (também dentro da transação) com o relógio do servidor; aqui, com a
       estimativa (relógio da página + .info/serverTimeOffset);
     · .info/serverTimeOffset por conexão (hora do servidor no aperto de mão − relógio da página na chegada: o erro é a
       latência de volta) e .info/connected (false até o 1º aperto de mão);
     · escrita: aparece na hora para os ouvintes daqui (os eventos dentro do próprio set/update, como o SDK); o servidor
       manda o dado novo a quem ouve (também a quem gravou) ANTES do ack;
     · sem conexão: escritas guardadas e mandadas na volta (também as que estavam no caminho quando caiu: o servidor pode
       aplicar duas vezes); a transação já mandada é CANCELADA na queda (Error("disconnect"): pode ter entrado ou não);
       a que não foi mandada vai na volta; os pedidos de onDisconnect sem resposta nunca respondem (o SDK esquece);
     · "gravou e o ack se perdeu": banco.cairNoProximoAck(cliente) — o servidor aplica, cai antes do ack;
     · onDisconnect set/update/remove/cancel executados NO SERVIDOR quando a conexão cai (e esquecidos: na volta não
       valem mais) e, no cliente, aplicados ao cache local na queda (repoRunOnDisconnectEvents);
     · on/off/once('value' e 'child_added'), o evento inicial NA HORA dentro do on() quando o cache já está completo;
     · val(): um nó de chaves 0..n vira lista quando a maior chave < 2 × o número de chaves (os buracos viram null);
       ninguém guarda null, objeto vazio nem lista vazia; os filhos na ordem de chave do Firebase;
     · validação como a do SDK: undefined, função, NaN/Infinity e chave inválida (. # $ / [ ]) levantam erro no set/update/
       onDisconnect e no valor devolvido pela transação;
     · erros de servidor: permission_denied (banco.negar) no set/update (Error com code PERMISSION_DENIED) e na transação
       (Error("permission_denied")).
   O que ele NÃO imita: regras de segurança de verdade (.read/.write/.validate: só o banco.negar), consultas (orderBy/
   limit/startAt… devolvem o próprio ref, sem filtrar), prioridades, ServerValue.increment, os eventos child_changed/
   child_removed/child_moved, a reconexão automática com espera crescente (a volta é do teste: banco.conectar/derrubar
   com {volta}), o atraso maior de reconectar com a aba escondida, a autenticação (login anônimo sempre aceito), o
   limite de tamanho e de conexões; duas transações do MESMO aparelho no mesmo lugar vão uma de cada vez (o SDK manda
   juntas); a transação que espera na fila só roda de novo na hora de ir (o SDK roda a cada dado novo); a exceção da
   função da transação numa rodada de novo vira rejeição (no SDK quebra o tratamento da mensagem); listas com null no meio
   ficam com null (o Firebase guarda sem o elemento e devolve um buraco).

   Uso no navegador (Playwright):
     const banco = new BancoFalso();
     await banco.instalar(contexto, { latencia: 40 });   // o gstatic trocado pelo SDK falso; window.__fbUid = o uid
   Uso em Node:
     const banco = new BancoFalso({ relogio, tempo, agendar });   // um relógio de mentira para os dois
     const a = banco.cliente({ uid: "uA", relogio: () => hora + 5000, latencia: 30 });   // a.firebase, a.db
   Controles: banco.derrubar(cid|pagina, { volta: ms }), banco.conectar(cid|pagina), banco.cairNoProximoAck(cid|pagina),
   banco.cairPagina(pagina), banco.definirLatencia(cid|pagina, lat), banco.bytes(cid|pagina), banco.ler/gravar/atualizar
   (direto no servidor), banco.negar = (op, caminho, valor, cliente) => true para recusar.
   A latência é um número (ms, cada sentido), { sobe, desce } ou fn(tipo, sentido, cliente) → ms. */

/* ---------------- o cliente: o SDK compat falso (vai para a página como TEXTO: nada de fora desta função) ---------------- */
export function sdkFalso(T) {
  "use strict";
  var MAX_TENTATIVAS = 25;
  function partes(c) { return String(c == null ? "" : c).split("/").filter(Boolean); }
  function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function ehObj(x) { return !!x && typeof x === "object"; }
  function ehTS(v) { return ehObj(v) && !Array.isArray(v) && v[".sv"] === "timestamp"; }
  function canon(v) {
    return JSON.stringify(v === undefined ? null : v, function (k, x) {
      return x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce(function (o, c) { o[c] = x[c]; return o; }, {}) : x;
    });
  }
  function prefixo(a, b) { if (a.length > b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function relacionados(a, b) { return prefixo(a, b) || prefixo(b, a); }
  function pega(arv, ps) { var x = arv; for (var i = 0; i < ps.length; i++) { if (!ehObj(x)) return null; x = x[ps[i]]; if (x === undefined) return null; } return x === undefined ? null : x; }
  // grava v (forma interna) em ps dentro de arv (mexe nela); poda os vazios; devolve a árvore nova
  function poe(arv, ps, v) {
    if (!ps.length) return v == null ? null : v;
    var raiz = ehObj(arv) ? arv : (v == null ? null : {});
    if (raiz == null) return null;
    var x = raiz, pilha = [];
    for (var i = 0; i < ps.length - 1; i++) {
      var k = ps[i];
      if (!ehObj(x[k])) { if (v == null) return raiz; x[k] = {}; }
      pilha.push([x, k]); x = x[k];
    }
    var u = ps[ps.length - 1];
    if (v == null) delete x[u]; else x[u] = v;
    for (var j = pilha.length - 1; j >= 0; j--) { var pai = pilha[j][0], kk = pilha[j][1]; if (ehObj(pai[kk]) && !Object.keys(pai[kk]).length) delete pai[kk]; }
    return Object.keys(raiz).length ? raiz : null;
  }
  // a forma interna (a do servidor): só objetos (lista vira objeto de chaves "0".."n"), sem null nem vazio, TIMESTAMP resolvido
  function normaliza(v, hora) {
    if (v === undefined || v === null) return null;
    if (ehTS(v)) return hora;
    if (Array.isArray(v) || typeof v === "object") {
      var o = {}, tem = false;
      Object.keys(v).forEach(function (k) { var y = normaliza(v[k], hora); if (y != null) { o[k] = y; tem = true; } });
      return tem ? o : null;
    }
    if (typeof v === "number" && !isFinite(v)) return null;
    return v;
  }
  // a ordem das chaves do Firebase (nameCompare): inteiros primeiro, pelo número; depois o texto
  function chaveInt(s) { if (/^-?(0*)\d{1,10}$/.test(s)) { var n = Number(s); if (n >= -2147483648 && n <= 2147483647) return n; } return null; }
  function compNome(a, b) {
    if (a === b) return 0;
    var x = chaveInt(a), y = chaveInt(b);
    if (x !== null) { if (y !== null) return x - y === 0 ? a.length - b.length : x - y; return -1; }
    if (y !== null) return 1;
    return a < b ? -1 : 1;
  }
  // o val() do SDK: o nó de chaves 0..n vira lista quando a maior chave < 2 × o número de chaves
  function exporta(v) {
    if (!ehObj(v)) return v;
    var ks = Object.keys(v).sort(compNome), o = {}, max = 0, inteiros = true;
    ks.forEach(function (k) { o[k] = exporta(v[k]); if (inteiros && /^(0|[1-9]\d*)$/.test(k)) max = Math.max(max, Number(k)); else inteiros = false; });
    if (inteiros && ks.length && max < 2 * ks.length) { var a = []; ks.forEach(function (k) { a[k] = o[k]; }); return a; }
    return o;
  }
  // validateFirebaseData
  var CHAVE_RUIM = /[\[\].#$\/\u0000-\u001F\u007F]/;
  function onde(ps) { return ps.length ? "in property '" + ps.join(".") + "'" : ""; }
  function valida(pref, v, ps) {
    if (v === undefined) throw new Error(pref + "contains undefined " + onde(ps));
    if (typeof v === "function") throw new Error(pref + "contains a function " + onde(ps) + " with contents = " + String(v));
    if (typeof v === "number" && !isFinite(v)) throw new Error(pref + "contains " + String(v) + " " + onde(ps));
    if (ehObj(v)) Object.keys(v).forEach(function (k) {
      if (!(k === ".sv" || k === ".priority" || k === ".value" || (k.length && !CHAVE_RUIM.test(k))))
        throw new Error(pref + "contains an invalid key (" + k + ") " + onde(ps) + ".  Keys must be non-empty strings and can't contain \".\", \"#\", \"$\", \"/\", \"[\", or \"]\"");
      valida(pref, v[k], ps.concat(k));
    });
  }
  function erroServidor(cod, ps) {
    var motivo = cod === "permission_denied" ? "Client doesn't have permission to access the desired data." : "Unknown Error";
    var e = new Error(cod + " at /" + ps.join("/") + ": " + motivo);
    e.code = String(cod).toUpperCase();
    return e;
  }
  function guarda(fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }, 0); } }   // o exceptionGuard do SDK

  var E = {
    conectado: false, epoca: 0,
    info: { connected: false, serverTimeOffset: 0 },
    cache: null,          // os dados do servidor que chegaram (forma interna)
    escutas: {},          // caminho → { q, ps, n, completo, servidor }
    ouvintes: [],         // { ps, ev, cb, cancelar, ultimo, filhos, removido }
    pendentes: [],        // escritas sem ack, na ordem: { w, tipo: 'set'|'update', ps, v | itens, msg, visivel, tx }
    txs: [],              // transações vivas: { ordem, ps, fn, aplicar, estado: 'run'|'sent'|'fim', tentativas, wAtual, entrada, raw, local }
    aoCair: [],           // onDisconnect confirmados pelo servidor: { ps, op, v } (cru)
    filaOff: [],          // pedidos de onDisconnect feitos sem conexão
    esperas: {},          // w → { tipo, ps, ok, falha, aoOk, enviado }
    seqW: 0, seqQ: 0, ordem: 0
  };
  function estimativa() { return T.relogio() + (E.info.serverTimeOffset || 0); }
  function envia(m) { if (!E.conectado) return false; m.e = E.epoca; T.enviar(m); return true; }
  function listaEscutas() { return Object.keys(E.escutas).map(function (k) { return E.escutas[k]; }); }

  /* ----- as escutas no servidor (uma por caminho; o SDK não escuta de novo debaixo de quem já escuta) ----- */
  function coberto(ps) { return listaEscutas().some(function (e) { return e.completo && prefixo(e.ps, ps); }); }
  function reorganiza() {
    var es = listaEscutas();
    es.forEach(function (e) {
      var temPai = es.some(function (f) { return f !== e && f.ps.length < e.ps.length && prefixo(f.ps, e.ps); });
      if (!temPai && !e.servidor) { e.servidor = true; envia({ t: "ouvir", q: e.q, p: e.ps.join("/") }); }
      else if (temPai && e.servidor) { e.servidor = false; envia({ t: "parar", q: e.q }); }
    });
  }
  function escutar(ps) {
    var k = ps.join("/"), e = E.escutas[k];
    if (e) { e.n++; return; }
    E.escutas[k] = { q: ++E.seqQ, ps: ps, n: 1, completo: false, servidor: false };
    reorganiza();
  }
  function desescutar(ps) {
    var k = ps.join("/"), e = E.escutas[k];
    if (!e || --e.n > 0) return;
    // quem estava coberto por ela continua com o que tinha (o SDK guarda o cache da vista) até a escuta própria responder
    var cobertos = listaEscutas().filter(function (f) { return f !== e && coberto(f.ps); });
    if (e.servidor) envia({ t: "parar", q: e.q });
    delete E.escutas[k];
    cobertos.forEach(function (f) { if (!coberto(f.ps)) f.completo = true; });
    reorganiza();
  }

  /* ----- a vista: o cache + as escritas pendentes ----- */
  function visao(ps, o) {
    o = o || {};
    var completo = coberto(ps), v = completo ? clone(pega(E.cache, ps)) : null;
    E.pendentes.forEach(function (p) {
      if (o.soVisiveis && !p.visivel) return;
      if (o.excluir && o.excluir[p.w]) return;
      var itens = p.tipo === "set" ? [[p.ps, p.v]] : p.itens;
      itens.forEach(function (it) {
        var wps = it[0], wv = it[1];
        if (prefixo(wps, ps)) { v = clone(pega(wv, ps.slice(wps.length))); completo = true; }
        else if (prefixo(ps, wps) && completo) v = poe(v, wps.slice(ps.length), clone(wv));
      });
    });
    return { completo: completo, v: completo ? v : null };
  }
  function infoEm(ps) {
    if (ps.length === 1) return { connected: E.info.connected, serverTimeOffset: E.info.serverTimeOffset };
    var v = E.info[ps[1]];
    return v === undefined ? null : v;
  }

  /* ----- snapshot e ouvintes ----- */
  function snap(chave, v, ps) {
    var s = {
      key: chave,
      val: function () { return clone(exporta(v)); },
      exportVal: function () { return clone(exporta(v)); },
      toJSON: function () { return clone(exporta(v)); },
      exists: function () { return v != null; },
      forEach: function (f) {
        if (!ehObj(v)) return false;
        var ks = Object.keys(v).sort(compNome);
        for (var i = 0; i < ks.length; i++) if (f(snap(ks[i], v[ks[i]], ps.concat(ks[i]))) === true) return true;
        return false;
      },
      child: function (p) { var sub = partes(p); return snap(sub.length ? sub[sub.length - 1] : chave, pega(v, sub), ps.concat(sub)); },
      hasChild: function (p) { return pega(v, partes(p)) != null; },
      hasChildren: function () { return ehObj(v) && Object.keys(v).length > 0; },
      numChildren: function () { return ehObj(v) ? Object.keys(v).length : 0; }
    };
    Object.defineProperty(s, "ref", { get: function () { return ref(ps); } });
    return s;
  }
  function ultimaChave(ps) { return ps.length ? ps[ps.length - 1] : null; }
  function dispara(l, v) {
    if (l.removido) return;
    if (l.ev === "value") {
      var c = canon(v);
      if (c === l.ultimo) return;
      l.ultimo = c;
      guarda(function () { l.cb(snap(ultimaChave(l.ps), v, l.ps)); });
      return;
    }
    if (l.ev === "child_added") {
      var ks = ehObj(v) ? Object.keys(v).sort(compNome) : [];
      Object.keys(l.filhos).forEach(function (k) { if (ks.indexOf(k) < 0) delete l.filhos[k]; });
      ks.forEach(function (k) { if (!l.filhos[k] && !l.removido) { l.filhos[k] = true; guarda(function () { l.cb(snap(k, v[k], l.ps.concat(k))); }); } });
    }
  }
  function vistaDe(l) { return l.ps[0] === ".info" ? { completo: true, v: infoEm(l.ps) } : visao(l.ps, { soVisiveis: true }); }
  // os ouvintes cuja vista pode ter mudado: só os dos caminhos mexidos (sem caminhos, todos: a conexão caiu ou voltou).
  // A vista de um ouvinte só depende do cache e das escritas pendentes debaixo ou acima dele; o resto seria trabalho à toa
  // (cada vista é clonada e comparada inteira: os lotes de um leilão têm ~60 KB)
  function atualiza(caminhos) {
    E.ouvintes.slice().forEach(function (l) {
      if (l.removido) return;
      if (caminhos && !caminhos.some(function (c) { return relacionados(c, l.ps); })) return;
      var r = vistaDe(l); if (r.completo) dispara(l, r.v);
    });
  }
  function criaOuvinte(ps, ev, cb, cancelar) {
    var l = { ps: ps, ev: ev || "value", cb: cb, cancelar: cancelar, ultimo: undefined, filhos: {}, removido: false };
    E.ouvintes.push(l);
    if (ps[0] !== ".info") escutar(ps);
    return l;
  }
  function primeiroDisparo(l) { var r = vistaDe(l); if (r.completo) dispara(l, r.v); }
  function removeOuvinte(l) {
    if (l.removido) return;
    l.removido = true;
    E.ouvintes = E.ouvintes.filter(function (x) { return x !== l; });
    if (l.ps[0] !== ".info") desescutar(l.ps);
  }
  function uma(ps, ev, cb, cancelar) {
    return new Promise(function (ok, falha) {
      var feito = false, l = null, tirar = false;
      l = criaOuvinte(ps, ev, function (s) {
        if (feito) return;
        feito = true;
        if (l) removeOuvinte(l); else tirar = true;
        if (typeof cb === "function") cb(s);
        ok(s);
      }, function (e) { if (typeof cancelar === "function") cancelar(e); falha(e); });
      primeiroDisparo(l);
      if (tirar) removeOuvinte(l);
    });
  }

  /* ----- escritas ----- */
  function espera(w, tipo, ps) {
    return new Promise(function (ok, falha) { E.esperas[w] = { tipo: tipo, ps: ps, ok: ok, falha: falha }; });
  }
  function comCallback(p, f) { if (typeof f === "function") p.then(function () { f(null); }, function (e) { f(e); }); return p; }
  function grava(ps, v, f) {
    valida("Reference.set failed: First argument ", v, []);
    var w = ++E.seqW, raw = clone(v), msg = { t: "gravar", w: w, p: ps.join("/"), v: raw };
    abortaPorSet(ps);
    E.pendentes.push({ w: w, tipo: "set", ps: ps, v: normaliza(raw, estimativa()), msg: msg, visivel: true });
    var p = espera(w, "escrita", ps);
    atualiza([ps]);
    envia(msg);
    return comCallback(p, f);
  }
  function atualizaVarios(ps, o, f) {
    if (!ehObj(o) || Array.isArray(o)) throw new Error("Reference.update failed: First argument  must be an object containing the children to replace.");
    var ks = Object.keys(o), est = estimativa(), itens = [];
    ks.forEach(function (k) {
      var sub = partes(k);
      sub.forEach(function (s) { if (CHAVE_RUIM.test(s)) throw new Error("Reference.update failed: First argument contains an invalid key (" + k + ")"); });
      valida("Reference.update failed: First argument ", o[k], ps.concat(sub));
      itens.push([ps.concat(sub), normaliza(clone(o[k]), est)]);
    });
    for (var i = 0; i < itens.length; i++) for (var j = 0; j < itens.length; j++)
      if (i !== j && prefixo(itens[i][0], itens[j][0])) throw new Error("Reference.update failed: First argument contains a path /" + itens[i][0].join("/") + " that is ancestor of another path /" + itens[j][0].join("/"));
    if (!itens.length) return comCallback(Promise.resolve(), f);
    itens.forEach(function (it) { abortaPorSet(it[0]); });
    var w = ++E.seqW, msg = { t: "atualizar", w: w, p: ps.join("/"), o: clone(o) };
    E.pendentes.push({ w: w, tipo: "update", ps: ps, itens: itens, msg: msg, visivel: true });
    var p = espera(w, "escrita", ps);
    atualiza([ps]);
    envia(msg);
    return comCallback(p, f);
  }
  // repoAbortTransactions: set/update aborta as transações do mesmo lugar, de cima e de baixo; a que ainda não foi aborta
  // na hora (Error("set")), a já mandada só se voltar "datastale" (se o servidor gravou, vale)
  function abortaPorSet(ps) {
    E.txs.slice().forEach(function (tx) {
      if (!relacionados(ps, tx.ps)) return;
      if (tx.estado === "run") encerraTx(tx, new Error("set")); else if (tx.estado === "sent") tx.abortarSet = true;
    });
  }
  function tiraPendente(w) { E.pendentes = E.pendentes.filter(function (p) { return p.w !== w; }); }

  /* ----- transações ----- */
  function excluirDe(tx) {
    var s = {};
    E.txs.forEach(function (t) { if (t.ordem >= tx.ordem && t.wAtual != null) s[t.wAtual] = true; });
    if (tx.wAtual != null) s[tx.wAtual] = true;
    return s;
  }
  function entradaDe(tx) { var r = visao(tx.ps, { excluir: excluirDe(tx) }); return r.completo ? r.v : null; }
  // roda a função com a entrada mais nova; false = abortou (devolveu undefined)
  function rodaTx(tx, entrada) {
    var novo = tx.fn(clone(exporta(entrada)));
    if (novo === undefined) { encerraTx(tx, null, false, entrada); return false; }
    valida("transaction failed: Data returned ", novo, tx.ps);
    if (tx.wAtual != null) tiraPendente(tx.wAtual);
    tx.entrada = entrada; tx.raw = clone(novo); tx.local = normaliza(tx.raw, estimativa());
    tx.wAtual = ++E.seqW;
    E.pendentes.push({ w: tx.wAtual, tipo: "set", ps: tx.ps, v: tx.local, visivel: tx.aplicar, tx: tx });
    return true;
  }
  function rodaTxSeguro(tx, entrada) {
    try { return rodaTx(tx, entrada); } catch (e) { encerraTx(tx, e); return false; }
  }
  function encerraTx(tx, erro, feito, valor) {
    if (tx.estado === "fim") return;
    tx.estado = "fim";
    E.txs = E.txs.filter(function (t) { return t !== tx; });
    if (tx.wAtual != null) tiraPendente(tx.wAtual);
    // o SDK solta o ouvinte da transação na hora quando grava e depois (setTimeout 0) quando aborta
    if (feito) desescutar(tx.ps); else setTimeout(function () { desescutar(tx.ps); }, 0);
    if (erro) tx.falha(erro);
    else tx.ok({ committed: !!feito, snapshot: snap(ultimaChave(tx.ps), valor == null ? null : valor, tx.ps), toJSON: function () { return { committed: !!feito, snapshot: exporta(valor) }; } });
    atualiza([tx.ps]);
  }
  function enviaProntas() {
    if (!E.conectado) return;
    E.txs.slice().forEach(function (tx) {
      if (tx.estado !== "run") return;
      // uma de cada vez no mesmo lugar (o SDK manda a fila de um lugar junta; aqui, na ordem)
      if (E.txs.some(function (t) { return t !== tx && t.ordem < tx.ordem && t.estado !== "fim" && relacionados(t.ps, tx.ps); })) return;
      var entrada = entradaDe(tx);
      if (canon(entrada) !== canon(tx.entrada) && !rodaTxSeguro(tx, entrada)) return;
      tx.estado = "sent";
      tx.tentativas++;
      envia({ t: "trocar", w: tx.wAtual, p: tx.ps.join("/"), base: tx.entrada, v: tx.raw });
    });
  }
  function transacao(ps, fn, fim, aplicar) {
    var ok, falha, prom = new Promise(function (a, b) { ok = a; falha = b; });
    var tx = { ordem: ++E.ordem, ps: ps, fn: fn, aplicar: aplicar !== false, estado: "run", tentativas: 0, wAtual: null, entrada: null, raw: null, local: null, ok: ok, falha: falha };
    if (typeof fim === "function") prom.then(function (r) { fim(null, r.committed, r.snapshot); }, function (e) { fim(e, false, null); });
    escutar(ps);   // o SDK ouve o caminho enquanto a transação vive (onValue(ref, () => {}))
    E.txs.push(tx);
    var seguiu;
    try { seguiu = rodaTx(tx, entradaDe(tx)); }   // a 1ª rodada é NA HORA, com o cache local
    catch (e) { E.txs = E.txs.filter(function (t) { return t !== tx; }); desescutar(ps); throw e; }
    if (seguiu) { atualiza([ps]); enviaProntas(); }
    return prom;
  }
  function ackTx(tx, s) {
    if (s === "ok") { encerraTx(tx, null, true, tx.local); enviaProntas(); return; }
    if (s === "datastale") {
      if (tx.abortarSet) { encerraTx(tx, new Error("set")); enviaProntas(); return; }
      if (tx.tentativas >= MAX_TENTATIVAS) { encerraTx(tx, new Error("maxretry")); enviaProntas(); return; }
      tx.estado = "run";
      if (rodaTxSeguro(tx, entradaDe(tx))) atualiza([tx.ps]);
      enviaProntas();
      return;
    }
    encerraTx(tx, new Error(s));
    enviaProntas();
  }

  /* ----- onDisconnect ----- */
  function pedeAoCair(ps, op, v, f) {
    var w = ++E.seqW, msg = { t: "aoCair", w: w, p: ps.join("/"), op: op, v: v };
    var p = new Promise(function (ok, falha) {
      E.esperas[w] = { tipo: "aoCair", ps: ps, ok: ok, falha: falha, enviado: false, aoOk: function () {
        if (op === "cancel") E.aoCair = E.aoCair.filter(function (x) { return !prefixo(ps, x.ps); });
        else E.aoCair.push({ ps: ps, op: op, v: v });
      } };
    });
    if (envia(msg)) E.esperas[w].enviado = true; else E.filaOff.push(msg);
    return comCallback(p, f);
  }
  function aoCairDe(ps) {
    return {
      set: function (v, f) { valida("OnDisconnect.set failed: First argument ", v, []); return pedeAoCair(ps, "set", clone(v), f); },
      update: function (o, f) {
        if (!ehObj(o) || Array.isArray(o)) throw new Error("OnDisconnect.update failed: First argument  must be an object containing the children to replace.");
        Object.keys(o).forEach(function (k) { valida("OnDisconnect.update failed: First argument ", o[k], ps.concat(partes(k))); });
        return pedeAoCair(ps, "update", clone(o), f);
      },
      remove: function (f) { return pedeAoCair(ps, "set", null, f); },
      cancel: function (f) { return pedeAoCair(ps, "cancel", null, f); }
    };
  }

  /* ----- o que chega do servidor ----- */
  function aoConectar(m) {
    E.conectado = true; E.epoca = m.e;
    E.info.serverTimeOffset = m.hora - T.relogio();
    // como o restoreState_ do SDK: as escutas, depois as escritas, depois os onDisconnect pedidos sem conexão
    listaEscutas().forEach(function (e) { if (e.servidor) envia({ t: "ouvir", q: e.q, p: e.ps.join("/") }); });
    E.pendentes.forEach(function (p) { if (!p.tx && p.msg) envia(p.msg); });
    enviaProntas();
    var f = E.filaOff; E.filaOff = [];
    f.forEach(function (msg) { if (envia(msg) && E.esperas[msg.w]) E.esperas[msg.w].enviado = true; });
    E.info.connected = true;
    atualiza();
  }
  function aoCairConexao() {
    if (!E.conectado) return;
    E.conectado = false; E.info.connected = false;
    // a transação já mandada é cancelada (não se sabe se entrou); a que não foi fica para a volta
    E.txs.slice().forEach(function (tx) { if (tx.estado === "sent") encerraTx(tx, new Error("disconnect")); });
    // pedido de onDisconnect sem resposta: o SDK esquece (nunca responde)
    Object.keys(E.esperas).forEach(function (w) { var e = E.esperas[w]; if (e.tipo === "aoCair" && e.enviado) delete E.esperas[w]; });
    // os onDisconnect confirmados valem também aqui (repoRunOnDisconnectEvents)
    var hora = estimativa();
    E.aoCair.forEach(function (op) {
      if (op.op === "update") Object.keys(op.v || {}).forEach(function (k) { var sub = op.ps.concat(partes(k)); abortaPorSet(sub); E.cache = poe(E.cache, sub, normaliza(op.v[k], hora)); });
      else { abortaPorSet(op.ps); E.cache = poe(E.cache, op.ps, normaliza(op.v, hora)); }
    });
    E.aoCair = [];
    atualiza();
  }
  // um dado do servidor: a resposta de uma escuta (q) ou uma escrita (todos os pedaços dela juntos, como o "merge" do
  // servidor: os ouvintes veem a escrita inteira de uma vez)
  function aoDado(m) {
    (m.itens || []).forEach(function (it) { E.cache = poe(E.cache, partes(it[0]), it[1] == null ? null : it[1]); });
    var mexidos = (m.itens || []).map(function (it) { return partes(it[0]); });
    if (m.q != null) listaEscutas().forEach(function (e) { if (e.q === m.q) { e.completo = true; mexidos.push(e.ps); } });
    atualiza(mexidos);
    enviaProntas();
  }
  function aoAck(m) {
    var tx = E.txs.filter(function (t) { return t.wAtual === m.w && t.estado === "sent"; })[0];
    if (tx) { ackTx(tx, m.s); return; }
    var esp = E.esperas[m.w];
    delete E.esperas[m.w];
    tiraPendente(m.w);
    if (esp) {
      if (m.s === "ok") { if (esp.aoOk) esp.aoOk(); esp.ok(); }
      else esp.falha(erroServidor(m.s, esp.ps));
    }
    atualiza(esp && esp.ps ? [esp.ps] : undefined);
    enviaProntas();
  }
  T.receber = function (m) {
    if (!m) return;
    if (m.t === "con") return aoConectar(m);
    if (m.t === "caiu") return aoCairConexao();
    if (!E.conectado) return;
    if (m.t === "dado") return aoDado(m);
    if (m.t === "ack") return aoAck(m);
  };

  /* ----- a API do compat ----- */
  var PUSH = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz", ultimoPush = 0, aleaPush = [];
  function chavePush() {
    var agora = Math.floor(estimativa()), c = "", i, t = agora;
    var repete = agora === ultimoPush; ultimoPush = agora;
    for (i = 7; i >= 0; i--) { c = PUSH.charAt(t % 64) + c; t = Math.floor(t / 64); }
    if (!repete) { aleaPush = []; for (i = 0; i < 12; i++) aleaPush.push(Math.floor(Math.random() * 64)); }
    else { for (i = 11; i >= 0 && aleaPush[i] === 63; i--) aleaPush[i] = 0; if (i >= 0) aleaPush[i]++; }
    for (i = 0; i < 12; i++) c += PUSH.charAt(aleaPush[i]);
    return c;
  }
  function ref(ps) {
    ps = ps.slice();
    var r = {
      key: ultimaChave(ps),
      toString: function () { return "falso:/" + ps.join("/"); },
      isEqual: function (o) { return !!o && String(o) === r.toString(); },
      child: function (p) { return ref(ps.concat(partes(p))); },
      once: function (ev, cb, cancelar) { return uma(ps, ev || "value", cb, cancelar); },
      get: function () { return uma(ps, "value"); },
      on: function (ev, cb, cancelar) { var l = criaOuvinte(ps, ev, cb, cancelar); primeiroDisparo(l); return cb; },
      off: function (ev, cb) {
        E.ouvintes.slice().forEach(function (l) {
          if (l.ps.join("/") === ps.join("/") && (!ev || l.ev === ev) && (!cb || l.cb === cb)) removeOuvinte(l);
        });
      },
      set: function (v, f) { return grava(ps, v, f); },
      update: function (o, f) { return atualizaVarios(ps, o, f); },
      remove: function (f) { return grava(ps, null, f); },
      push: function (v, f) {
        var filho = ref(ps.concat(chavePush()));
        var p = v === undefined ? Promise.resolve() : filho.set(v, f);
        filho.then = function (a, b) { return p.then(function () { return filho; }).then(a, b); };
        filho.catch = function (b) { return p.catch(b); };
        return filho;
      },
      transaction: function (fn, fim, aplicar) { return transacao(ps, fn, fim, aplicar); },
      onDisconnect: function () { return aoCairDe(ps); },
      orderByChild: function () { return r; }, orderByKey: function () { return r; }, orderByValue: function () { return r; }, orderByPriority: function () { return r; },
      limitToLast: function () { return r; }, limitToFirst: function () { return r; }, startAt: function () { return r; }, endAt: function () { return r; }, equalTo: function () { return r; }
    };
    Object.defineProperty(r, "parent", { get: function () { return ps.length ? ref(ps.slice(0, -1)) : null; } });
    Object.defineProperty(r, "root", { get: function () { return ref([]); } });
    Object.defineProperty(r, "ref", { get: function () { return r; } });
    return r;
  }

  var usuario = { uid: T.uid, isAnonymous: true }, cbs = [];
  var auth = {
    currentUser: null,
    onAuthStateChanged: function (cb) { cbs.push(cb); if (auth.currentUser) setTimeout(function () { cb(auth.currentUser); }, 0); return function () { cbs = cbs.filter(function (x) { return x !== cb; }); }; },
    signInAnonymously: function () { return new Promise(function (ok) { setTimeout(function () { auth.currentUser = usuario; cbs.forEach(function (cb) { cb(usuario); }); ok({ user: usuario }); }, 30); }); },
    signOut: function () { auth.currentUser = null; cbs.forEach(function (cb) { cb(null); }); return Promise.resolve(); }
  };
  var db = null;
  function database() {
    if (db) return db;
    db = {
      ref: function (c) { return ref(partes(c)); },
      goOffline: function () { if (T.controle) T.controle("offline"); aoCairConexao(); },
      goOnline: function () { if (T.controle) T.controle("online"); },
      // só dos testes: o estado do cliente
      __falso: { estado: function () { return { conectado: E.conectado, offset: E.info.serverTimeOffset, pendentes: E.pendentes.length, txs: E.txs.length, escutas: Object.keys(E.escutas), aoCair: E.aoCair.length }; }, cache: function () { return clone(exporta(E.cache)); } }
    };
    if (T.ola) T.ola();
    return db;
  }
  database.ServerValue = { TIMESTAMP: { ".sv": "timestamp" } };
  return { initializeApp: function () { return {}; }, auth: function () { return auth; }, database: database, apps: [], SDK_VERSION: "10.12.5-falso" };
}

/* ---------------- o texto que vai para a página no lugar do firebase-app-compat.js ---------------- */
export const SDK_PAGINA = `(function () {
  var T = {
    cid: "c" + Math.random().toString(36).slice(2) + Date.now().toString(36),
    uid: window.__fbUid || ("u" + Math.random().toString(36).slice(2)),
    relogio: function () { return Date.now(); },
    receber: null,
    enviar: function (m) { window.__fbEnvia(T.cid, m); },
    controle: function (c) { window.__fbEnvia(T.cid, { t: "$" + c }); },
    ola: function () { window.__fbEnvia(T.cid, { t: "ola", uid: T.uid }); }
  };
  window.__fbRecebe = function (cid, m) { if (cid === T.cid && T.receber) T.receber(m); };
  window.firebase = (${sdkFalso.toString()})(T);
})();`;

/* ---------------- utilidades do servidor (as mesmas contas da forma interna do cliente) ---------------- */
const ehObj = x => !!x && typeof x === "object";
const partes = c => String(c == null ? "" : c).split("/").filter(Boolean);
const clone = v => (v == null ? null : JSON.parse(JSON.stringify(v)));
export const canon = v => JSON.stringify(v === undefined ? null : v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => (o[c] = x[c], o), {}) : x));
const prefixo = (a, b) => a.length <= b.length && a.every((x, i) => x === b[i]);
function pega(arv, ps) { let x = arv; for (const p of ps) { if (!ehObj(x)) return null; x = x[p]; if (x === undefined) return null; } return x === undefined ? null : x; }
function poe(arv, ps, v) {
  if (!ps.length) return v == null ? null : v;
  const raiz = ehObj(arv) ? arv : (v == null ? null : {});
  if (raiz == null) return null;
  let x = raiz; const pilha = [];
  for (let i = 0; i < ps.length - 1; i++) { const k = ps[i]; if (!ehObj(x[k])) { if (v == null) return raiz; x[k] = {}; } pilha.push([x, k]); x = x[k]; }
  const u = ps[ps.length - 1];
  if (v == null) delete x[u]; else x[u] = v;
  for (let j = pilha.length - 1; j >= 0; j--) { const [pai, k] = pilha[j]; if (ehObj(pai[k]) && !Object.keys(pai[k]).length) delete pai[k]; }
  return Object.keys(raiz).length ? raiz : null;
}
function normaliza(v, hora) {
  if (v === undefined || v === null) return null;
  if (ehObj(v) && !Array.isArray(v) && v[".sv"] === "timestamp") return hora;
  if (ehObj(v)) { const o = {}; let tem = false; for (const k of Object.keys(v)) { const y = normaliza(v[k], hora); if (y != null) { o[k] = y; tem = true; } } return tem ? o : null; }
  if (typeof v === "number" && !isFinite(v)) return null;
  return v;
}
function chaveInt(s) { if (/^-?(0*)\d{1,10}$/.test(s)) { const n = Number(s); if (n >= -2147483648 && n <= 2147483647) return n; } return null; }
function compNome(a, b) { if (a === b) return 0; const x = chaveInt(a), y = chaveInt(b); if (x !== null) { if (y !== null) return x - y === 0 ? a.length - b.length : x - y; return -1; } if (y !== null) return 1; return a < b ? -1 : 1; }
export function exporta(v) {
  if (!ehObj(v)) return v;
  const ks = Object.keys(v).sort(compNome), o = {}; let max = 0, inteiros = true;
  for (const k of ks) { o[k] = exporta(v[k]); if (inteiros && /^(0|[1-9]\d*)$/.test(k)) max = Math.max(max, Number(k)); else inteiros = false; }
  if (inteiros && ks.length && max < 2 * ks.length) { const a = []; for (const k of ks) a[k] = o[k]; return a; }
  return o;
}

/* ---------------- o servidor ---------------- */
export class BancoFalso {
  /** opc: relogio() a hora do servidor (padrão Date.now) · tempo() o relógio do agendador (padrão performance.now) ·
   *  agendar(fn, ms) (padrão setTimeout) · latencia (padrão 0) · negar(op, caminho, valor, cliente) → true = recusa */
  constructor(opc = {}) {
    this.relogio = opc.relogio || (() => Date.now());
    this.tempo = opc.tempo || (() => performance.now());
    this.agendar = opc.agendar || ((fn, ms) => setTimeout(fn, ms));
    this.latencia = opc.latencia ?? 0;
    this.negar = opc.negar || null;
    this.raiz = null;
    this.clientes = new Map();
    this.gravacoes = 0;
    this.seq = 0;
  }

  /* ----- direto no servidor (os testes semeiam e conferem) ----- */
  /** O valor como o val() do SDK o devolve (null quando não há). */
  ler(c) { if (c === ".info/connected") return true; if (c === ".info/serverTimeOffset") return 0; return clone(exporta(pega(this.raiz, partes(c)))); }
  gravar(c, v) { this._escreve([[partes(c), v]]); }
  atualizar(c, o) { const base = partes(c); this._escreve(Object.keys(o || {}).map(k => [base.concat(partes(k)), o[k]])); }

  /* ----- os clientes ----- */
  _novo(cid, o) {
    const C = {
      cid, uid: o.uid, pagina: o.pagina || null, entregar: o.entregar, latencia: o.latencia,
      conectado: false, epoca: 0, escutas: new Map(), aoCair: [], cairNoAck: 0,
      filas: { sobe: { itens: [], armado: false, cauda: 0, gen: 0 }, desce: { itens: [], armado: false, cauda: 0, gen: 0 } },
      bytes: { sobe: 0, desce: 0 }
    };
    this.clientes.set(cid, C);
    return C;
  }
  _cli(x) {
    if (x == null) return null;
    if (typeof x === "string") return this.clientes.get(x) || null;
    if (x.cid && this.clientes.has(x.cid)) return this.clientes.get(x.cid);
    for (const C of this.clientes.values()) if (C.pagina === x) return C;   // a página (o cliente mais novo dela)
    return null;
  }
  _clis(x) { if (typeof x === "string" || (x && x.cid)) { const C = this._cli(x); return C ? [C] : []; } return [...this.clientes.values()].filter(C => C.pagina === x); }
  /** Um aparelho em Node: { cid, uid, firebase, db } (o db já criado e conectando). o: uid, relogio (o da "página"), latencia, conectar (padrão true). */
  cliente(o = {}) {
    const cid = o.cid || "n" + (++this.seq);
    const T = { cid, uid: o.uid || "u" + cid, relogio: o.relogio || this.relogio, receber: null };
    this._novo(cid, { uid: T.uid, latencia: o.latencia, entregar: m => { if (T.receber) T.receber(m); } });
    T.enviar = m => this.receber(cid, m);
    T.controle = c => this.controle(cid, c);
    if (o.conectar !== false) T.ola = () => this.conectar(cid);
    const firebase = sdkFalso(T);
    const db = firebase.database();
    return { cid, uid: T.uid, firebase, db, T };
  }
  /** Liga o banco a um contexto do Playwright: o SDK do gstatic vira o falso e a ponte com a página. o: latencia. */
  async instalar(contexto, o = {}) {
    await contexto.route(/^https:\/\/www\.gstatic\.com\//, r => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await contexto.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/firebase-app-compat\.js/, r => r.fulfill({ status: 200, contentType: "text/javascript", body: SDK_PAGINA }));
    await contexto.exposeBinding("__fbEnvia", (src, cid, m) => this._daPagina(src.page, cid, m, o));
  }
  _daPagina(pagina, cid, m, o) {
    if (!m || !m.t) return;
    if (m.t === "ola") {
      // a página recarregou: o cliente velho dela caiu
      for (const C2 of [...this.clientes.values()]) if (C2.pagina === pagina && C2.cid !== cid) { this.derrubar(C2.cid); this.clientes.delete(C2.cid); }
      if (!this.clientes.has(cid)) {
        let fila = Promise.resolve();
        this._novo(cid, { uid: m.uid, pagina, latencia: o.latencia, entregar: msg => { fila = fila.then(() => pagina.evaluate(([c, x]) => window.__fbRecebe && window.__fbRecebe(c, x), [cid, msg])).catch(() => {}); } });
        if (!pagina.__bancoFalso) { pagina.__bancoFalso = true; pagina.once("close", () => this.cairPagina(pagina)); }
      }
      this.conectar(cid);
      return;
    }
    if (m.t[0] === "$") { this.controle(cid, m.t.slice(1)); return; }
    this.receber(cid, m);
  }
  controle(cid, c) {
    if (c === "offline") this.derrubar(cid, { semAviso: true });
    else if (c === "online") this.conectar(cid);
  }
  definirLatencia(x, lat) { for (const C of this._clis(x)) C.latencia = lat; }
  bytes(x) { const r = { sobe: 0, desce: 0 }; for (const C of this._clis(x)) { r.sobe += C.bytes.sobe; r.desce += C.bytes.desce; } return r; }
  /** O cliente conecta (o aperto de mão leva a hora do servidor: .info/serverTimeOffset). */
  conectar(x) {
    for (const C of this._clis(x)) {
      if (C.conectado) continue;
      C.conectado = true; C.epoca++; C.escutas = new Map();
      this._desce(C, { t: "con", e: C.epoca, hora: this.relogio() });
    }
  }
  /** A conexão cai: o que estava no caminho se perde, os onDisconnect dela rodam AQUI e o aparelho fica sabendo.
   *  o: volta (ms: reconecta sozinho depois), semAviso (o próprio aparelho fechou: goOffline). */
  derrubar(x, o = {}) {
    for (const C of this._clis(x)) {
      const estava = C.conectado;
      C.conectado = false; C.epoca++; C.escutas = new Map();
      for (const q of [C.filas.sobe, C.filas.desce]) { q.itens = []; q.armado = false; q.cauda = 0; q.gen++; }
      if (estava) {
        const ops = C.aoCair; C.aoCair = [];
        const itens = [];
        for (const op of ops) {
          if (op.op === "update") for (const k of Object.keys(op.v || {})) itens.push([op.ps.concat(partes(k)), op.v[k]]);
          else itens.push([op.ps, op.v]);
        }
        if (itens.length) this._escreve(itens);
        if (!o.semAviso) this.agendar(() => C.entregar({ t: "caiu" }), 0);
      }
      if (o.volta != null) this.agendar(() => this.conectar(C.cid), o.volta);
    }
  }
  cairPagina(pagina, o) { this.derrubar(pagina, o); }
  /** "Gravou e o ack se perdeu": a próxima escrita deste cliente vale no servidor e a conexão cai antes do ack. */
  cairNoProximoAck(x) { for (const C of this._clis(x)) C.cairNoAck++; }

  /* ----- as filas (o socket é ordenado nos dois sentidos) ----- */
  _lat(C, tipo, sentido) {
    const L = C.latencia ?? this.latencia;
    if (typeof L === "function") return Math.max(0, +L(tipo, sentido, C) || 0);
    if (ehObj(L)) return Math.max(0, +L[sentido] || 0);
    return Math.max(0, +L || 0);
  }
  _fila(C, sentido, tipo, fn) {
    const q = C.filas[sentido];
    const due = Math.max(q.cauda, this.tempo() + this._lat(C, tipo, sentido));
    q.cauda = due;
    q.itens.push({ due, ep: C.epoca, fn });
    this._arma(C, sentido);
  }
  _arma(C, sentido) {
    const q = C.filas[sentido];
    if (q.armado || !q.itens.length) return;
    q.armado = true;
    const g = q.gen;
    this.agendar(() => { if (q.gen !== g) return; q.armado = false; this._bombeia(C, sentido); }, Math.max(0, q.itens[0].due - this.tempo()));
  }
  _bombeia(C, sentido) {
    const q = C.filas[sentido];
    while (q.itens.length && q.itens[0].due <= this.tempo() + 1e-6) {
      const it = q.itens.shift();
      if (it.ep !== C.epoca || !C.conectado) continue;   // a conexão caiu no caminho: perdeu
      try { it.fn(); } catch (e) { console.error(e); }
    }
    this._arma(C, sentido);
  }
  _desce(C, m) {
    C.bytes.desce += JSON.stringify(m).length;
    this._fila(C, "desce", m.t, () => C.entregar(m));
  }
  /** Uma mensagem do aparelho (chega depois da latência de ida, na ordem). */
  receber(cid, m) {
    const C = this.clientes.get(cid);
    if (!C || !C.conectado || m.e !== C.epoca) return;   // mandou com a conexão que já caiu
    C.bytes.sobe += JSON.stringify(m).length;
    this._fila(C, "sobe", m.t, () => this._processa(C, m));
  }

  /* ----- o servidor processa ----- */
  _ack(C, w, s) {
    if (C.cairNoAck > 0) { C.cairNoAck--; this.derrubar(C.cid); return; }
    this._desce(C, { t: "ack", w, s });
  }
  _negado(op, ps, v, C) { return !!(this.negar && this.negar(op, ps.join("/"), v, C)); }
  _processa(C, m) {
    const ps = partes(m.p);
    switch (m.t) {
      case "ouvir":
        C.escutas.set(m.q, ps);
        this._desce(C, { t: "dado", q: m.q, itens: [[ps.join("/"), clone(pega(this.raiz, ps))]] });
        return;
      case "parar": C.escutas.delete(m.q); return;
      case "gravar":
        if (this._negado("gravar", ps, m.v, C)) return this._ack(C, m.w, "permission_denied");
        this._escreve([[ps, m.v]]);
        return this._ack(C, m.w, "ok");
      case "atualizar": {
        const itens = Object.keys(m.o || {}).map(k => [ps.concat(partes(k)), m.o[k]]);
        if (itens.some(([p2, v]) => this._negado("atualizar", p2, v, C))) return this._ack(C, m.w, "permission_denied");
        this._escreve(itens);
        return this._ack(C, m.w, "ok");
      }
      case "trocar": {
        // a transação: o servidor confere a base (o hash do SDK); diferente = "datastale" (o dado novo já foi para quem ouve)
        if (canon(pega(this.raiz, ps)) !== canon(m.base == null ? null : m.base)) return this._ack(C, m.w, "datastale");
        if (this._negado("transacao", ps, m.v, C)) return this._ack(C, m.w, "permission_denied");
        this._escreve([[ps, m.v]]);
        return this._ack(C, m.w, "ok");
      }
      case "aoCair":
        if (m.op === "cancel") C.aoCair = C.aoCair.filter(x => !prefixo(ps, x.ps));
        else C.aoCair.push({ ps, op: m.op, v: m.v });
        return this._ack(C, m.w, "ok");
    }
  }
  // grava (TIMESTAMP pela hora do servidor) e manda o dado novo a quem ouve, ANTES do ack de quem gravou; uma escrita vai
  // numa mensagem só para cada aparelho (o update de vários caminhos chega inteiro)
  _escreve(itens) {
    const hora = this.relogio();
    for (const [ps, v] of itens) this.raiz = poe(this.raiz, ps, normaliza(clone(v), hora));
    this.gravacoes++;
    const escritos = itens.map(([ps]) => ps);
    for (const C of this.clientes.values()) {
      if (!C.conectado) continue;
      const mandar = [];
      for (const lp of C.escutas.values()) for (const w of escritos) {
        const p = prefixo(lp, w) ? w : prefixo(w, lp) ? lp : null;
        if (p && !mandar.some(x => x.join("/") === p.join("/"))) mandar.push(p);
      }
      // quem está debaixo de outro que vai junto não precisa ir
      const final = mandar.filter(p => !mandar.some(o => o !== p && o.length < p.length && prefixo(o, p)));
      if (final.length) this._desce(C, { t: "dado", itens: final.map(p => [p.join("/"), clone(pega(this.raiz, p))]) });
    }
  }
}

/* ---------------- o relógio acelerado: o servidor (Node) e as páginas na MESMA conta ---------------- */
/** Um relógio que anda `fator` vezes mais rápido a partir de agora. agora() é a hora (para o BancoFalso: relogio) e
 *  scriptPagina(desvio) o texto para o addInitScript: Date.now/new Date(), performance.now e os timers da página no mesmo
 *  relógio (com um desvio próprio do aparelho, em ms, só no Date). */
export function relogioAcelerado({ fator = 1, inicio = Date.now() } = {}) {
  const real0 = Date.now();
  const agora = () => inicio + (Date.now() - real0) * fator;
  function patch(real0, inicio, fator, desvio) {
    var D = Date, agoraReal = D.now.bind(D), perf = performance.now.bind(performance), p0 = perf();
    function agora() { return inicio + (agoraReal() - real0) * fator + desvio; }
    function Falso() {
      if (!(this instanceof Falso)) return new D(agora()).toString();
      if (!arguments.length) return new D(agora());
      return new (Function.prototype.bind.apply(D, [null].concat([].slice.call(arguments))))();
    }
    Falso.prototype = D.prototype; Falso.now = agora; Falso.UTC = D.UTC; Falso.parse = D.parse;
    window.Date = Falso;
    performance.now = function () { return p0 + (perf() - p0) * fator; };
    var st = window.setTimeout, si = window.setInterval;
    window.setTimeout = function (fn, ms) { var a = [].slice.call(arguments, 2); return st.apply(window, [fn, (+ms || 0) / fator].concat(a)); };
    window.setInterval = function (fn, ms) { var a = [].slice.call(arguments, 2); return si.apply(window, [fn, (+ms || 0) / fator].concat(a)); };
  }
  return { fator, agora, scriptPagina: (desvio = 0) => `(${patch.toString()})(${real0}, ${inicio}, ${fator}, ${desvio});` };
}
