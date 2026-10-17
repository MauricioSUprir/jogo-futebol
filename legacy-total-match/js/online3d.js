/* ================= TOTAL MATCH — Online 3D (partida 1×1 no GOLAÇO, um aparelho contra o outro) =================
   Pedido do dono (16/10): "duas pessoas consigam jogar uma contra a outra, no modo jogável". Mais modos → "Online 3D":
   uma sala PRIVADA por código (ou link), o anfitrião aceita ou recusa quem entrou, os dois aparelhos se ligam DIRETO
   (WebRTC, sem servidor nosso, sem conta nova, grátis), cada um escolhe o SEU time e, com os dois prontos, cada aparelho
   abre o GOLAÇO 3D (golaco/index.html?tm=<id>, pedido com modo "online") controlando o seu time. Sem chat, sem partida
   com desconhecidos (o dono é menor de idade). Contrato completo: golaco/CONTRATOS.md "Online" (seções 3–5 e 14).

   ---------------------------------------------------------------------------------------------------------------
   1. A SALA no Firebase do TM (o mesmo login anônimo de js/net.js; NADA fora do nó salas3d/)
        salas3d/{CÓDIGO} = {
          anfitriao, nomeA, criada (ms do aparelho), versaoTM ("v373"), proto: 1, partidaN (1, 2…: a partida da vez),
          estado: 'esperando' | 'ligando' | 'conectado' | 'jogando' | 'fim'          (informativo)
          convidado?, nomeC?, versaoC?, naSalaC? (= partidaN: o convidado está na sala esperando essa partida),
          aceito? (uid do convidado aceito), recusados?: { uid: true }, pedeLigar? (contador: o convidado pede outra ligação),
          rtc?: { rodada, nova, oferta: {type, sdp}, resposta?: {r, type, sdp}, iceA?: {chave: {r, c}}, iceC?: {chave: {r, c}} } }
      Código: 5 letras de "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" (as do online de hoje, sem as ambíguas), sorteado por
      crypto.getRandomValues; criada por transação, com onDisconnect().remove() do anfitrião. O convidado entra por
      transação (só um), com onDisconnect que tira os campos dele. Sala sem convidado expira em 15 min.
      O nó rtc (que tem os IPs na SDP) é apagado assim que os aparelhos ligam, e também no onDisconnect dos dois.

   2. SINAL (A1, sinalFirebase): Sinal = { publicar(tipo, dados), aoReceber(fn(tipo, dados)), limpar(), fechar() }
        'oferta'   { rodada, nova, sdp }  só do anfitrião (nova: true = ligação nova; false = restartIce na mesma)
        'resposta' { rodada, sdp }        só do convidado
        'ice'      { rodada, c }          dos dois, aos poucos (trickle); de outra rodada é ignorado

   3. LIGAÇÃO (criarLigacao; a interface Transporte da seção 4.1):
        { enviar(ab), enviarControle(obj), aoReceber(fn(ab)), aoControle(fn(obj)), aoEstado(fn({estado, rtt, par, motivo})),
          religar(), fechar() }   estado: 'ligando' | 'aberto' | 'instavel' | 'fechado'
      Um RTCPeerConnection com dois DataChannels negotiated: 'jogo' {id: 1, ordered: false, maxRetransmits: 0} (binário,
      ArrayBuffer) e 'ctrl' {id: 2, confiável e ordenado; JSON em texto; acima de 16 000 caracteres vai em pedaços
      {c:'pedaco', id, i, n, s}}. iceServers: STUN do Google e da Cloudflare; SEM TURN. Prazo de 15 s para ligar: senão,
      a tela da seção 4.2 ("Não deu para ligar os dois aparelhos direto…"). Queda (ICE 'disconnected' por 4 s ou 'failed')
      → restartIce pelo anfitrião (o convidado pede pelo banco, pedeLigar), até 3 vezes seguidas.

   4. CANAL ctrl, família 'sala' (o lobby; só o TM lê):
        {c:'sala', tipo:'ola', nome, versaoTM, webgl2, proto}   os dois, ao abrir (versão diferente: não joga)
        {c:'sala', tipo:'ping'|'pong', t}                      10 pings do anfitrião ao abrir (e 1 a cada 2 s) → RTT e D0
        {c:'sala', tipo:'rtt', rtt, D0}                         anfitrião → convidado (a linha "Conexão boa (45 ms)")
        {c:'sala', tipo:'time', meia, info}                     o MEU time: meia = TM.tm3d.time3d (o time do pedido v2,
                                                                montado no aparelho de quem escolheu, com a edição dele);
                                                                info = { fonte: 'club'|'nation', id, nome, nota, escudo }
        {c:'sala', tipo:'pronto', sim}                          trocar de time desfaz o pronto
        {c:'sala', tipo:'pedido', pedido}                       anfitrião → convidado, com os dois prontos (seção 6)
        {c:'sala', tipo:'tchau'}                                saiu da sala
      família 'jogo' (o 3D; o TM só repassa, sem ler): {c:'jogo', m} ↔ porta {t:'c', m}

   5. PORTA TM ↔ quadro do 3D (a página do golaco segue isto; a ligação mora na página do TM, não no quadro)
      Entrega: o quadro manda window.parent.postMessage({tipo:'tm3d:pronto', id}) (ponte-tm.js); o TM responde
        quadro.postMessage({ tipo: 'tm3d:porta', id, proto: 1, porta }, origem, [porta])
      — a MessagePort vem em e.ports[0] (e também em e.data.porta). Se o quadro recarregar ou perder a porta, manda
      {tipo:'tm3d:pedePorta', id} (ou 'tm3d:pronto' de novo) e recebe uma porta NOVA (a velha é fechada).
      Mensagens na porta (structured clone):
        TM → quadro  {t:'j', b: ArrayBuffer}        pacote do canal 'jogo' que chegou do outro aparelho (b transferido)
                     {t:'c', m: objeto}             mensagem de controle do 3D do outro aparelho (a família 'jogo')
                     {t:'estado', estado: 'ligando'|'aberto'|'instavel'|'fechado', rtt: ms|null,
                      par: {local, remoto} (tipo do candidato ICE: 'host'|'srflx'|'prflx'|'relay') | null,
                      motivo?: 'canal'|'prazo'|'ice'|'saiu'|…, nome: o nome do outro jogador}
                      — logo depois da porta (o estado atual) e a cada mudança
        quadro → TM  {t:'j', b: ArrayBuffer}        manda pelo canal 'jogo' (não confiável, sem ordem); transfira o b
                     {t:'c', m: objeto}             manda pelo canal 'ctrl' (confiável e ordenado; grande vai em pedaços)
                     {t:'religar'}                  pede restartIce (o 3D não recebe nada há alguns segundos)
                     {t:'estado?'}                  pede o estado atual (volta um {t:'estado', …})
      O que chegar do outro aparelho antes da porta existir fica na fila e é entregue logo depois do 1º 'estado'.
      Fim: o quadro manda ao TM (window.parent) 'tm3d:fim' {resultado, online?: {hashFinal, wo?: {vencedor: 0|1, motivo},
      dessinc?}} (o online também pode vir dentro do resultado) ou 'tm3d:sair' {abandono?: true}. O TM fecha a porta e,
      1,5 s depois (o que estava saindo termina de sair), a ligação.

   6. PEDIDO (o anfitrião monta e manda; cada aparelho grava com o próprio id e lado e abre por TM.tm3d.jogarOnline):
        { v: 2, id (de cada aparelho), titulo: "Online 3D", origem: "online3d", modo: "online", controle: null,
          home: time3d do anfitrião (time 0, mandante: o estádio é o dele), away: time3d do convidado,
          partida: { neutro: false, publico, classico, nomeClassico, competicao: "Online 3D", estadio },
          edicao: a do anfitrião, userSide: 'home' (anfitrião) | 'away' (convidado),
          online: { sala: CÓDIGO, semente: u32 (crypto.getRandomValues, no anfitrião), nomes: [anfitrião, convidado],
                    D0: 3–10 (dos 10 pings: ⌈(RTT_p95/2 + 16,7)/16,7⌉), proto: 1, lado: 0 (anfitrião) | 1 (convidado) } }
      Os uniformes vão escolhidos pelo anfitrião (home.kitEscolhido / away.kitEscolhido; o mesmo clube dos dois lados = o
      2º uniforme no visitante): o convidado não recalcula.

   7. RESULTADO: a tela de fim mostra os dois nomes; SÓ o anfitrião grava o retrospecto (h2h) e o ranking, uma vez por
      partida, como o online de hoje. Sair no meio ('tm3d:sair' {abandono}) = derrota (fair play: TM.fairplay.recordAbandon;
      se quem saiu é o anfitrião, ele grava a derrota). Dessincronia (online.dessinc) = sem resultado, nada conta.
      "Jogar de novo" volta à mesma sala (partidaN + 1) e liga os aparelhos de novo (ligação nova).
   --------------------------------------------------------------------------------------------------------------- */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  function N() { return TM.net; }

  var api = {
    ICE: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }],   // sem TURN (caminho A)
    PRAZO_MS: 15000,            // para os aparelhos ligarem
    CONTA_MS: 9000,             // para a conta online ficar pronta
    EXPIRA_MS: 15 * 60000,      // sala sem convidado
    QUEDA_MS: 4000,             // ICE 'disconnected' por esse tempo → restartIce
    TENTATIVAS_ICE: 3,
    PEDACO: 16000,              // mensagem de controle maior que isto vai em pedaços
    PINGS: 10,
    PROTO: 1
  };
  var LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var TEXTO_FALHA = "Não deu para ligar os dois aparelhos direto. A rede de um de vocês bloqueia a conexão direta (comum no 4G). Tentem os dois no mesmo Wi-Fi, ou outro Wi-Fi.";

  /* ---------- utilidades ---------- */
  function agora() { return Date.now(); }
  function relogio() { try { return global.performance.now(); } catch (e) { return Date.now(); } }
  function versao() { try { return (TM.versao && TM.versao()) || ""; } catch (e) { return ""; } }
  function u32() {
    var r = new Uint32Array(1);
    try { global.crypto.getRandomValues(r); } catch (e) { r[0] = Math.floor(Math.random() * 4294967296); }
    return r[0] >>> 0;
  }
  function novoCodigo() { var c = ""; for (var i = 0; i < 5; i++) c += LETRAS[u32() % LETRAS.length]; return c; }
  // aceita o código (sem diferenciar maiúscula) ou o link colado inteiro
  function limpaCodigo(t) {
    t = String(t || "").trim();
    var m = t.match(/online3d=([A-Za-z0-9]+)/);
    if (m) t = m[1];
    return t.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function banco() { var n = N(); return n && n._db ? n._db : null; }
  function refSala(c) { return banco().ref("salas3d/" + c); }
  function linkDa(c) { return global.location.origin + global.location.pathname + "?online3d=" + c; }
  function qrSvg(t) { var qr = global.qrcode(0, "M"); qr.addData(t); qr.make(); return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  function copia(t, msg) {
    try { global.navigator.clipboard.writeText(t).then(function () { TM.ui.toast(msg, "ok"); }, function () { TM.ui.toast(t); }); }
    catch (e) { TM.ui.toast(t); }
  }
  function mediana(xs) { if (!xs.length) return null; var s = xs.slice().sort(function (a, b) { return a - b; }); return s[Math.floor((s.length - 1) / 2)]; }
  function p95(xs) { if (!xs.length) return null; var s = xs.slice().sort(function (a, b) { return a - b; }); return s[Math.max(0, Math.ceil(0.95 * s.length) - 1)]; }
  // atraso de entrada inicial (contrato 2.3, q = 1 no lobby): 3 a 10 ticks
  function calcD0(rtts) { var p = p95(rtts); if (p == null) p = 100; return Math.max(3, Math.min(10, Math.ceil((p / 2 + 16.7) / 16.7))); }
  function faixa(rtt) { return rtt == null ? null : rtt <= 80 ? "boa" : rtt <= 160 ? "media" : "lenta"; }

  /* ---------- 2. sinal pelo Firebase (A1) ---------- */
  function sinalFirebase(codigo, papel) {
    var r = refSala(codigo).child("rtc"), fn = null, h = null, vistos = {}, ofertaVista = 0, respostaVista = 0, rodadaPub = 0;
    var minha = papel === "A" ? "iceA" : "iceC", dele = papel === "A" ? "iceC" : "iceA";
    try { r.onDisconnect().remove(); } catch (e) {}
    function ouvir(snap) {
      var v = snap.val();
      if (!v || !fn) return;
      if (papel === "C" && v.oferta && typeof v.rodada === "number" && v.rodada > ofertaVista) {
        ofertaVista = v.rodada;
        fn("oferta", { rodada: v.rodada, nova: !!v.nova, sdp: v.oferta });
      }
      if (papel === "A" && v.resposta && v.resposta.r === rodadaPub && respostaVista < rodadaPub) {
        respostaVista = rodadaPub;
        fn("resposta", { rodada: rodadaPub, sdp: { type: v.resposta.type, sdp: v.resposta.sdp } });
      }
      var lista = v[dele], atual = papel === "A" ? rodadaPub : ofertaVista;
      if (lista) Object.keys(lista).sort().forEach(function (k) {
        if (vistos[k]) return;
        vistos[k] = 1;
        var it = lista[k];
        if (it && it.r === atual && it.c) fn("ice", { rodada: it.r, c: it.c });
      });
    }
    h = r.on("value", ouvir);
    return {
      publicar: function (tipo, d) {
        if (tipo === "oferta") { rodadaPub = d.rodada; return r.set({ rodada: d.rodada, nova: !!d.nova, oferta: { type: d.sdp.type, sdp: d.sdp.sdp } }); }
        if (tipo === "resposta") return r.child("resposta").set({ r: d.rodada, type: d.sdp.type, sdp: d.sdp.sdp });
        if (tipo === "ice") return r.child(minha).push({ r: d.rodada, c: d.c });
      },
      aoReceber: function (f) { fn = f; },
      limpar: function () { try { return r.remove(); } catch (e) {} },
      fechar: function () { fn = null; try { r.off("value", h); } catch (e) {} }
    };
  }

  /* ---------- 3. ligação WebRTC (Transporte) ---------- */
  // o = { papel: 'A'|'C', publicar(tipo, dados), pedirReligar() (convidado), proximaRodada() (anfitrião) }
  function criarLigacao(o) {
    var L = { estado: "ligando", rodada: 0, rtt: null, par: null, motivo: null, abriu: false };
    var fnJ = [], fnC = [], fnE = [];
    var pc, jogo, ctrl, remotaOk = false, iceFila = [], pedacos = {}, seq = 0, fechado = false;
    var prazo = null, queda = null, tentativas = 0;
    function info() { return { estado: L.estado, rtt: L.rtt, par: L.par, motivo: L.motivo }; }
    function emite() { var i = info(); fnE.slice().forEach(function (f) { try { f(i); } catch (e) { console.error(e); } }); }
    function muda(e, motivo) {
      if (L.estado === e && motivo == null) return;
      L.estado = e; L.motivo = motivo || null;
      emite();
    }
    try {
      pc = new global.RTCPeerConnection({ iceServers: api.ICE });
      jogo = pc.createDataChannel("jogo", { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
      ctrl = pc.createDataChannel("ctrl", { negotiated: true, id: 2 });
    } catch (e) {
      fechado = true; L.estado = "fechado"; L.motivo = "webrtc";
      setTimeout(emite, 0);
      return fachada();
    }
    jogo.binaryType = "arraybuffer";
    jogo.onmessage = function (e) { if (e.data instanceof ArrayBuffer) fnJ.slice().forEach(function (f) { f(e.data); }); };
    ctrl.onmessage = function (e) { if (typeof e.data === "string") recebeCtrl(e.data); };
    jogo.onopen = ctrl.onopen = confere;
    ctrl.onclose = jogo.onclose = function () { if (!fechado) fecha("canal"); };
    pc.onicecandidate = function (e) {
      // depois de ligar não publica mais nada (o nó rtc já foi apagado)
      if (e.candidate && L.estado !== "aberto") { try { o.publicar("ice", { rodada: L.rodada, c: e.candidate.toJSON() }); } catch (er) {} }
    };
    pc.oniceconnectionstatechange = function () {
      var s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") { clearTimeout(queda); queda = null; confere(); }
      else if (s === "disconnected") {
        if (L.abriu) { muda("instavel"); if (!queda) queda = setTimeout(function () { queda = null; if (!fechado && pc.iceConnectionState !== "connected" && pc.iceConnectionState !== "completed") religar(); }, api.QUEDA_MS); }
      } else if (s === "failed") {
        if (!L.abriu) fecha("ice");
        else { muda("instavel"); religar(); }
      }
    };
    pc.onconnectionstatechange = function () { if (pc.connectionState === "closed" && !fechado) fecha("canal"); };
    prazo = setTimeout(function () { if (!L.abriu && !fechado) fecha("prazo"); }, api.PRAZO_MS);

    function confere() {
      if (fechado || !ctrl || !jogo) return;
      if (ctrl.readyState !== "open" || jogo.readyState !== "open") return;
      var ice = pc.iceConnectionState;
      if (L.abriu && ice !== "connected" && ice !== "completed") return;
      clearTimeout(prazo);
      L.abriu = true; tentativas = 0;
      muda("aberto");
      medePar();
    }
    function medePar() {
      if (!pc || !pc.getStats) return;
      pc.getStats().then(function (st) {
        var par = null, cand = {};
        st.forEach(function (r) { if (r.type === "local-candidate" || r.type === "remote-candidate") cand[r.id] = r; });
        st.forEach(function (r) { if (r.type === "transport" && r.selectedCandidatePairId && st.get) par = st.get(r.selectedCandidatePairId) || par; });
        if (!par) st.forEach(function (r) { if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") par = r; });
        if (!par) return;
        L.par = { local: (cand[par.localCandidateId] || {}).candidateType || null, remoto: (cand[par.remoteCandidateId] || {}).candidateType || null };
        if (typeof par.currentRoundTripTime === "number" && L.rtt == null) L.rtt = Math.round(par.currentRoundTripTime * 1000);
        emite();
      }).catch(function () {});
    }
    function despeja() {
      var f = iceFila; iceFila = [];
      f.forEach(function (c) { pc.addIceCandidate(c).catch(function () {}); });
    }
    function sdpDe(d) { return { type: d.type, sdp: d.sdp }; }
    // anfitrião: a 1ª oferta (ligação nova)
    function iniciar(rodada) {
      if (fechado) return;
      L.rodada = rodada;
      pc.createOffer().then(function (of) { return pc.setLocalDescription(of); })
        .then(function () { return o.publicar("oferta", { rodada: L.rodada, nova: true, sdp: sdpDe(pc.localDescription) }); })
        .catch(function () { fecha("oferta"); });
    }
    // o que veio do Sinal
    function recebe(tipo, d) {
      if (fechado || !d) return;
      if (tipo === "oferta" && o.papel === "C") {
        L.rodada = d.rodada; remotaOk = false; iceFila = [];
        pc.setRemoteDescription(d.sdp)
          .then(function () { remotaOk = true; despeja(); return pc.createAnswer(); })
          .then(function (a) { return pc.setLocalDescription(a); })
          .then(function () { return o.publicar("resposta", { rodada: L.rodada, sdp: sdpDe(pc.localDescription) }); })
          .catch(function () { if (!L.abriu) fecha("oferta"); });
      } else if (tipo === "resposta" && o.papel === "A") {
        if (d.rodada !== L.rodada || pc.signalingState !== "have-local-offer") return;
        pc.setRemoteDescription(d.sdp).then(function () { remotaOk = true; despeja(); }).catch(function () { if (!L.abriu) fecha("resposta"); });
      } else if (tipo === "ice" && d.rodada === L.rodada) {
        if (remotaOk) pc.addIceCandidate(d.c).catch(function () {}); else iceFila.push(d.c);
      }
    }
    // a conexão caiu (ou o 3D pediu): o anfitrião refaz o ICE na mesma ligação; o convidado pede ao anfitrião
    function religar() {
      if (fechado || !L.abriu) return;
      if (tentativas >= api.TENTATIVAS_ICE) return;
      tentativas++;
      muda("instavel");
      if (o.papel !== "A") { try { o.pedirReligar && o.pedirReligar(); } catch (e) {} return; }
      L.rodada = o.proximaRodada ? o.proximaRodada() : L.rodada + 1;
      remotaOk = false; iceFila = [];
      try { if (pc.restartIce) pc.restartIce(); } catch (e) {}
      pc.createOffer({ iceRestart: true }).then(function (of) { return pc.setLocalDescription(of); })
        .then(function () { return o.publicar("oferta", { rodada: L.rodada, nova: false, sdp: sdpDe(pc.localDescription) }); })
        .catch(function () {});
    }
    function recebeCtrl(txt) {
      var m; try { m = JSON.parse(txt); } catch (e) { return; }
      if (!m || typeof m !== "object") return;
      if (m.c === "pedaco") {
        if (typeof m.id !== "number" || typeof m.i !== "number" || typeof m.n !== "number" || m.n < 1 || m.n > 4000 || m.i < 0 || m.i >= m.n || typeof m.s !== "string") return;
        var p = pedacos[m.id] || (pedacos[m.id] = { n: m.n, partes: [], conta: 0 });
        if (p.partes[m.i] == null) { p.partes[m.i] = m.s; p.conta++; }
        if (p.conta === p.n) { delete pedacos[m.id]; recebeCtrl(p.partes.join("")); }
        return;
      }
      fnC.slice().forEach(function (f) { try { f(m); } catch (e) { console.error(e); } });
    }
    function enviar(ab) {
      if (fechado || !jogo || jogo.readyState !== "open") return false;
      if (jogo.bufferedAmount > 262144) return false;       // não confiável: atrasado demais não serve
      try { jogo.send(ab); return true; } catch (e) { return false; }
    }
    function enviarControle(obj) {
      if (fechado || !ctrl || ctrl.readyState !== "open") return false;
      var s = JSON.stringify(obj);
      try {
        if (s.length <= api.PEDACO) { ctrl.send(s); return true; }
        var id = ++seq, n = Math.ceil(s.length / api.PEDACO);
        for (var i = 0; i < n; i++) ctrl.send(JSON.stringify({ c: "pedaco", id: id, i: i, n: n, s: s.slice(i * api.PEDACO, (i + 1) * api.PEDACO) }));
        return true;
      } catch (e) { return false; }
    }
    function fecha(motivo) {
      if (fechado) return;
      fechado = true;
      clearTimeout(prazo); clearTimeout(queda);
      try { jogo.close(); } catch (e) {}
      try { ctrl.close(); } catch (e) {}
      try { pc.close(); } catch (e) {}
      muda("fechado", motivo || "fechou");
    }
    // espera = ms para o que está saindo terminar de sair (fim de jogo)
    function fechar(motivo, espera) {
      if (fechado) return;
      if (!espera) { fecha(motivo || "saiu"); return; }
      var t0 = agora();
      (function tenta() {
        var vazio = (!ctrl || ctrl.bufferedAmount === 0) && (!jogo || jogo.bufferedAmount === 0);
        if (vazio || agora() - t0 >= espera) fecha(motivo || "saiu"); else setTimeout(tenta, 100);
      })();
    }
    function fachada() {
      return {
        enviar: enviar, enviarControle: enviarControle,
        aoReceber: function (f) { fnJ.push(f); }, aoControle: function (f) { fnC.push(f); }, aoEstado: function (f) { fnE.push(f); },
        religar: religar, fechar: fechar, iniciar: iniciar, recebe: recebe, info: info,
        get pc() { return pc; }
      };
    }
    return fachada();
  }

  /* ---------- a sala (estado deste aparelho) ---------- */
  var S = null;        // a sala em que estou (null = tela de entrada)
  var VIEW = { corpo: null, aviso: null, codigoAuto: null, autoFeito: false, linhaCon: null, ticker: null };

  function emJogo() { return S && (S.fase === "jogo"); }
  function noLobby() { return S && ["esperando", "entrou", "aguardaAceite", "ligando", "falhou", "times"].indexOf(S.fase) >= 0; }
  function novoEstado(papel, codigo, me) {
    return { papel: papel, codigo: codigo, fase: papel === "A" ? "esperando" : "aguardaAceite", eu: { uid: me.uid, nome: me.name || "Jogador" },
      outro: null, sala: null, partidaN: 1, rodada: 0, sinal: null, lig: null, rtts: [], rtt: null, D0: null,
      fonte: "club", meu: null, dele: null, prontoEu: false, prontoEle: false, olaEle: null, porta: null, fila: [],
      pedido: null, lado: papel === "A" ? 0 : 1, fim: null, gravado: {}, msg: null, pedeLigarVisto: 0, timers: {} };
  }
  function limpaTimers(s) { Object.keys(s.timers).forEach(function (k) { clearTimeout(s.timers[k]); clearInterval(s.timers[k]); }); s.timers = {}; }

  function redesenha() {
    if (TM.ui.current() !== "online3d" || !VIEW.corpo || !VIEW.corpo.isConnected) return;
    TM.ui.clear(VIEW.corpo);
    desenha(VIEW.corpo);
  }
  function avisoFinal(msg) { VIEW.aviso = msg; }

  /* ----- criar ----- */
  function criarSala(tentativa) {
    var n = N(), me = n && n.me;
    if (!me || !banco()) { TM.ui.toast("A conta online ainda não está pronta.", "erro"); return; }
    tentativa = tentativa || 0;
    var codigo = novoCodigo(), r = refSala(codigo);
    r.transaction(function (cur) {
      if (cur === null) return { anfitriao: me.uid, nomeA: me.name || "Jogador", criada: agora(), versaoTM: versao(), proto: api.PROTO, estado: "esperando", partidaN: 1 };
      return;   // o código já existe: tenta outro
    }, function (err, ok) {
      if (!err && ok) {
        try { r.onDisconnect().remove(); } catch (e) {}
        S = novoEstado("A", codigo, me);
        VIEW.aviso = null;
        ouvirSala();
        armaExpira();
        redesenha();
      } else if (tentativa < 6) criarSala(tentativa + 1);
      else TM.ui.toast("Não foi possível criar a sala. Tente de novo.", "erro");
    });
  }
  function armaExpira() {
    if (!S || S.papel !== "A") return;
    clearTimeout(S.timers.expira);
    var meu = S;
    S.timers.expira = setTimeout(function () {
      if (S !== meu || S.outro) return;
      sairDaSala();
      avisoFinal("A sala expirou: ninguém entrou em 15 minutos. Crie outra.");
      redesenha();
    }, api.EXPIRA_MS);
  }

  /* ----- entrar ----- */
  function entrar(texto, erroEl) {
    var codigo = limpaCodigo(texto);
    function erro(msg) { if (erroEl) { erroEl.textContent = msg; erroEl.hidden = false; } TM.ui.toast(msg, "erro"); }
    if (codigo.length !== 5) { erro("O código tem 5 letras."); return; }
    var n = N(), me = n && n.me;
    if (!me || !banco()) { erro("A conta online ainda não está pronta."); return; }
    if (S) sairDaSala();
    var r = refSala(codigo), minha = versao();
    r.once("value").then(function (snap) {
      var v = snap.val();
      if (!v) { erro("Código não encontrado."); return; }
      if (v.anfitriao === me.uid) { erro("Esta sala é sua: espere o seu amigo entrar."); return; }
      if ((v.versaoTM || "") !== minha || (v.proto || 1) !== api.PROTO) {
        erro("Versões diferentes do Total Match: atualizem a página nos dois aparelhos (" + (v.versaoTM || "?") + " × " + (minha || "?") + ")."); return;
      }
      if (v.recusados && v.recusados[me.uid]) { erro("O anfitrião recusou a sua entrada nesta sala."); return; }
      if (v.convidado && v.convidado !== me.uid) { erro("Essa sala já tem dois jogadores."); return; }
      var cheia = false;
      r.transaction(function (cur) {
        if (!cur) return cur;
        if (cur.convidado && cur.convidado !== me.uid) { cheia = true; return; }
        cur.convidado = me.uid; cur.nomeC = me.name || "Jogador"; cur.versaoC = minha; cur.naSalaC = cur.partidaN || 1;
        return cur;
      }, function (err, ok, snap2) {
        var v2 = snap2 && snap2.val();
        if (err || !ok || !v2) { erro(cheia ? "Essa sala já tem dois jogadores." : !v2 ? "Código não encontrado." : "Não foi possível entrar. Tente de novo."); return; }
        try { r.onDisconnect().update({ convidado: null, nomeC: null, versaoC: null, naSalaC: null, aceito: null }); } catch (e) {}
        S = novoEstado("C", codigo, me);
        S.outro = { uid: v2.anfitriao, nome: v2.nomeA || "Anfitrião" };
        S.partidaN = v2.partidaN || 1;
        VIEW.aviso = null;
        ouvirSala();
        if (TM.ui.current() !== "online3d") TM.ui.go("online3d"); else redesenha();
      });
    }).catch(function () { erro("Não foi possível entrar. Confira a internet e tente de novo."); });
  }

  /* ----- o nó da sala, ao vivo ----- */
  function ouvirSala() {
    var meu = S, r = refSala(S.codigo);
    var h = r.on("value", function (snap) { if (S !== meu) return; S.sala = snap.val(); if (S.papel === "A") naSalaA(S.sala); else naSalaC(S.sala); });
    S.paraSala = function () { try { r.off("value", h); } catch (e) {} };
  }
  function naSalaA(v) {
    if (!v) {
      if (noLobby()) { var s0 = S; sairDaSala(true, s0); avisoFinal("A sala foi encerrada."); redesenha(); }
      return;
    }
    if (v.convidado) {
      if (!S.outro || S.outro.uid !== v.convidado) {
        if (emJogo()) return;
        S.outro = { uid: v.convidado, nome: v.nomeC || "Jogador" };
        clearTimeout(S.timers.expira);
        if (S.fase === "esperando") S.fase = "entrou";
        redesenha();
      }
      // a ligação começa com o convidado aceito e na sala esperando a partida da vez
      if ((S.fase === "entrou" || S.fase === "esperando") && v.aceito === v.convidado && v.naSalaC === S.partidaN && v.partidaN === S.partidaN) comecaLigacao();
      if (v.pedeLigar && v.pedeLigar !== S.pedeLigarVisto) {
        S.pedeLigarVisto = v.pedeLigar;
        if (S.fase === "falhou" || S.fase === "ligando") comecaLigacao();
        else if (S.lig && (S.fase === "times" || S.fase === "jogo")) S.lig.religar();
      }
    } else if (S.outro && noLobby()) {
      var nome = S.outro.nome;
      S.outro = null;
      fechaLig("saiu");
      zeraTimes();
      S.fase = "esperando";
      armaExpira();
      TM.ui.toast(nome + " saiu da sala.", "alerta");
      redesenha();
    }
  }
  function naSalaC(v) {
    if (!v) { if (noLobby()) { sairDaSala(true); avisoFinal("A sala foi encerrada pelo anfitrião."); redesenha(); } return; }
    if (v.recusados && v.recusados[S.eu.uid]) { sairDaSala(true); avisoFinal("O anfitrião recusou a sua entrada."); redesenha(); return; }
    if (v.convidado !== S.eu.uid) { if (noLobby()) { sairDaSala(true); avisoFinal("Você não está mais nesta sala."); redesenha(); } return; }
    if (S.fase === "aguardaAceite" && v.aceito === S.eu.uid && v.naSalaC === S.partidaN && v.partidaN === S.partidaN) {
      S.fase = "ligando";
      garanteSinal();
      armaPrazoLig(3000);
      redesenha();
    }
  }

  /* ----- aceitar / recusar (anfitrião) ----- */
  function aceitar() {
    if (!S || S.papel !== "A" || !S.outro) return;
    refSala(S.codigo).update({ aceito: S.outro.uid });
  }
  function recusar() {
    if (!S || S.papel !== "A" || !S.outro) return;
    var uid = S.outro.uid, upd = { convidado: null, nomeC: null, versaoC: null, naSalaC: null, aceito: null, rtc: null, estado: "esperando" };
    upd["recusados/" + uid] = true;
    S.outro = null; S.fase = "esperando";
    fechaLig("recusado");
    refSala(S.codigo).update(upd);
    armaExpira();
    redesenha();
  }

  /* ----- ligar os aparelhos ----- */
  function garanteSinal() {
    if (S.sinal) return;
    var meu = S;
    S.sinal = sinalFirebase(S.codigo, S.papel);
    S.sinal.aoReceber(function (tipo, d) {
      if (S !== meu) return;
      if (S.papel === "C" && tipo === "oferta" && d.nova) {
        // ligação nova do anfitrião (a 1ª, "Tentar de novo" ou "Jogar de novo")
        // (o convidado pode ver a oferta antes do próprio nó da sala dizer que foi aceito: vale como aceite)
        if (["aguardaAceite", "ligando", "falhou", "times"].indexOf(S.fase) < 0) return;
        fechaLig("nova");
        zeraTimes();
        S.fase = "ligando";
        S.lig = novaLigacao();
        armaPrazoLig(3000);
        redesenha();
      }
      if (S.lig) S.lig.recebe(tipo, d);
    });
  }
  function novaLigacao() {
    var meu = S;
    var lig = criarLigacao({
      papel: S.papel,
      publicar: function (tipo, d) { if (S === meu && S.sinal) return S.sinal.publicar(tipo, d); },
      proximaRodada: function () { return ++meu.rodada; },
      pedirReligar: function () { if (S === meu) refSala(S.codigo).update({ pedeLigar: ((S.sala && S.sala.pedeLigar) || 0) + 1 }); }
    });
    lig.aoEstado(function (inf) { if (S === meu && S.lig === lig) naLigacao(inf); });
    lig.aoControle(function (m) { if (S === meu && S.lig === lig) naCtrl(m); });
    lig.aoReceber(function (ab) { if (S === meu && S.lig === lig) paraPorta({ t: "j", b: ab }, [ab]); });
    return lig;
  }
  function comecaLigacao() {
    if (!S || S.papel !== "A") return;
    fechaLig("nova");
    zeraTimes();
    S.fase = "ligando"; S.msg = null;
    garanteSinal();
    S.lig = novaLigacao();
    S.rodada++;
    refSala(S.codigo).update({ estado: "ligando" });
    S.lig.iniciar(S.rodada);
    armaPrazoLig(0);
    redesenha();
  }
  function armaPrazoLig(extra) {
    var meu = S;
    clearTimeout(S.timers.prazo);
    S.ligandoDesde = agora();
    S.timers.prazo = setTimeout(function () { if (S === meu && S.fase === "ligando") falhaLig(TEXTO_FALHA); }, api.PRAZO_MS + (extra || 0) + 500);
  }
  function falhaLig(msg) {
    fechaLig("falhou");
    S.fase = "falhou";
    S.msg = msg || TEXTO_FALHA;
    redesenha();
  }
  function tentarDeNovo() {
    if (!S) return;
    if (S.papel === "A") { comecaLigacao(); return; }
    S.fase = "ligando"; S.msg = null;
    garanteSinal();
    armaPrazoLig(3000);
    refSala(S.codigo).update({ pedeLigar: ((S.sala && S.sala.pedeLigar) || 0) + 1 });
    redesenha();
  }
  function fechaLig(motivo, espera) {
    if (!S) return;
    clearTimeout(S.timers.ping);
    if (S.lig) { var l = S.lig; S.lig = null; l.fechar(motivo, espera); }
  }
  // o meu time fica escolhido (vai de novo quando ligar); o do outro, os prontos e as medidas zeram
  function zeraTimes() { S.prontoEu = S.prontoEle = false; S.dele = null; S.olaEle = null; S.rtts = []; S.rtt = null; }
  function naLigacao(inf) {
    if (S.porta) S.porta.postMessage(estadoPorta(inf));
    if (inf.estado === "aberto") {
      if (S.sinal) S.sinal.limpar();                          // ligou (ou religou): o nó rtc, com os IPs, sai do banco
      if (S.fase === "ligando") {
        clearTimeout(S.timers.prazo);
        S.fase = "times";                                     // (o que o outro mandou antes deste aviso já está guardado)
        if (S.papel === "A") refSala(S.codigo).update({ estado: "conectado" });
        S.lig.enviarControle({ c: "sala", tipo: "ola", nome: S.eu.nome, versaoTM: versao(), webgl2: !!(TM.tm3d && TM.tm3d.disponivel && TM.tm3d.disponivel()), proto: api.PROTO });
        if (S.meu) mandaMeuTime();
        redesenha();
      } else atualizaLinhaCon();
    } else if (inf.estado === "fechado") {
      if (S.fase === "ligando") falhaLig(TEXTO_FALHA);
      else if (S.fase === "times") falhaLig("A conexão com " + (S.outro ? S.outro.nome : "o outro aparelho") + " caiu. Tentem ligar de novo.");
      // no jogo, o 3D decide (W.O. depois do prazo); ele já recebeu o estado pela porta
    } else atualizaLinhaCon();
  }

  /* ----- o lobby pelo canal ctrl ----- */
  function naCtrl(m) {
    if (m.c === "jogo") { paraPorta({ t: "c", m: m.m }); return; }
    if (m.c !== "sala") return;
    var t = m.tipo;
    if (t === "ola") {
      S.olaEle = { nome: m.nome, versaoTM: m.versaoTM, webgl2: !!m.webgl2, proto: m.proto };
      if ((m.versaoTM || "") !== versao() || (m.proto || 1) !== api.PROTO) {
        falhaLig("Versões diferentes do Total Match: atualizem a página nos dois aparelhos (" + (m.versaoTM || "?") + " × " + versao() + ").");
        return;
      }
      if (S.papel === "A") pings(api.PINGS);
      redesenha();
    } else if (t === "ping") S.lig.enviarControle({ c: "sala", tipo: "pong", t: m.t });
    else if (t === "pong") {
      if (typeof m.t !== "number") return;
      // janela dos últimos 60 (~30 s): o D0 sai do p95 dela (com 10 amostras, a maior); a linha mostra a mediana das
      // últimas 5 (um pico da tela ocupada não pinta "lenta")
      S.rtts.push(Math.max(0, relogio() - m.t));
      if (S.rtts.length > 60) S.rtts.shift();
      S.rtt = Math.round(mediana(S.rtts.slice(-5)));
      if (S.rtts.length >= api.PINGS) S.D0 = calcD0(S.rtts);
      S.lig.enviarControle({ c: "sala", tipo: "rtt", rtt: S.rtt, D0: S.D0 });
      atualizaLinhaCon();
    } else if (t === "rtt") { S.rtt = typeof m.rtt === "number" ? m.rtt : S.rtt; S.D0 = m.D0 || S.D0; atualizaLinhaCon(); }
    else if (t === "time") {
      if (!m.meia || !m.info) return;
      S.dele = { meia: m.meia, info: m.info };
      S.prontoEle = false;
      redesenha();
    } else if (t === "pronto") { S.prontoEle = !!m.sim; redesenha(); confereInicio(); }
    else if (t === "pedido" && S.papel === "C") { if (m.pedido) abre(m.pedido); }
    else if (t === "tchau") {
      if (S.papel === "A") { /* o convidado saiu: o banco avisa (naSalaA) */ fechaLig("saiu"); if (S.fase === "times" || S.fase === "ligando") { S.fase = "entrou"; redesenha(); } }
      else if (noLobby()) { sairDaSala(true); avisoFinal("O anfitrião fechou a sala."); redesenha(); }
    }
  }
  // 10 pings seguidos ao abrir (D0) e depois 2 por segundo enquanto escolhem os times
  function pings(n) {
    var meu = S;
    clearTimeout(S.timers.ping);
    (function vai(k) {
      if (S !== meu || !S.lig || (S.fase !== "times" && S.fase !== "ligando")) return;
      S.lig.enviarControle({ c: "sala", tipo: "ping", t: relogio() });
      S.timers.ping = setTimeout(function () { vai(k - 1); }, k > 1 ? 100 : 500);
    })(n);
  }
  function mandaMeuTime() { if (S && S.lig && S.meu) S.lig.enviarControle({ c: "sala", tipo: "time", meia: S.meu.meia, info: S.meu.info }); }
  function escolheTime(id) {
    if (!S) return;
    var fonte = S.fonte, t = fonte === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id);
    var meia = TM.tm3d.time3d(t, t.formation);
    S.meu = { meia: meia, info: { fonte: fonte, id: id, nome: meia.name, nota: meia.rating, escudo: (meia.identidade && meia.identidade.escudo) || null } };
    if (S.prontoEu) { S.prontoEu = false; if (S.lig) S.lig.enviarControle({ c: "sala", tipo: "pronto", sim: false }); }
    mandaMeuTime();
  }
  function alternaPronto() {
    if (!S || !S.meu || !S.lig) return;
    S.prontoEu = !S.prontoEu;
    S.lig.enviarControle({ c: "sala", tipo: "pronto", sim: S.prontoEu });
    redesenha();
    confereInicio();
  }
  function confereInicio() {
    if (!S || S.papel !== "A" || S.fase !== "times") return;
    if (!(S.prontoEu && S.prontoEle && S.meu && S.dele && S.olaEle && S.lig)) return;
    var base = montaPedido();
    if (!S.lig.enviarControle({ c: "sala", tipo: "pedido", pedido: base })) { TM.ui.toast("Não deu para mandar a partida ao outro aparelho.", "erro"); return; }
    abre(base);
  }

  /* ----- 6. o pedido ----- */
  function rgb(h) { h = String(h || "#888888").replace("#", ""); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function dist(a, b) { var x = rgb(a), y = rgb(b); return Math.sqrt((x[0] - y[0]) * (x[0] - y[0]) + (x[1] - y[1]) * (x[1] - y[1]) + (x[2] - y[2]) * (x[2] - y[2])); }
  // o mandante com o uniforme dele; o visitante com o 1º (casa, fora, terceiro) que não se confunde (o mesmo clube = o 2º)
  function escolheUniformes(home, away) {
    var kc = home.kitEscolhido === 0 || home.kitEscolhido === 1 || home.kitEscolhido === 2 ? home.kitEscolhido : 0;
    var lista = ["home", "away", "third"], camisaCasa = ((home.kits || {})[lista[kc]] || {}).shirt || (home.colors || {}).primary;
    var mesmo = home.id === away.id, melhor = 1, mDist = -1;
    for (var i = 0; i < 3; i++) {
      var k = (away.kits || {})[lista[i]]; if (!k) continue;
      if (mesmo && i === 0) continue;
      var d = dist(k.shirt, camisaCasa);
      if (d > 70) { melhor = i; mDist = Infinity; break; }
      if (d > mDist) { mDist = d; melhor = i; }
    }
    return [kc, melhor];
  }
  function montaPedido() {
    var home = clone(S.meu.meia), away = clone(S.dele.meia);
    var ku = escolheUniformes(home, away);
    home.kitEscolhido = ku[0]; away.kitEscolhido = ku[1];
    var classico = false, nomeCl = null, a = S.meu.info, b = S.dele.info;
    try {
      if (a.fonte === "club" && b.fonte === "club" && TM.data.areRivals) {
        classico = !!TM.data.areRivals(a.id, b.id);
        if (classico && TM.data.derbyName) nomeCl = TM.data.derbyName(a.id, b.id) || null;
      }
    } catch (e) {}
    var edicao = "public"; try { edicao = TM.storage.edition() === "pro" ? "pro" : "public"; } catch (e) {}
    return {
      v: 2, titulo: "Online 3D", origem: "online3d", modo: "online", controle: null,
      home: home, away: away,
      partida: { neutro: false, publico: 0.85, classico: classico, nomeClassico: nomeCl, competicao: "Online 3D",
                 estadio: (home.identidade && home.identidade.estadio) || null },
      edicao: edicao, userSide: "home",
      online: { sala: S.codigo, semente: u32() || 1, nomes: [S.eu.nome, S.outro ? S.outro.nome : "Convidado"],
                D0: calcD0(S.rtts), proto: api.PROTO, lado: 0 }
    };
  }

  /* ----- o quadro do 3D e a porta (seção 5) ----- */
  function abre(base) {
    if (!S || !TM.tm3d || !TM.tm3d.jogarOnline) return;
    clearTimeout(S.timers.ping);
    var p = clone(base);
    p.id = "o" + agora().toString(36) + (u32() % 1000000).toString(36);
    p.online.lado = S.papel === "A" ? 0 : 1;
    p.userSide = S.papel === "A" ? "home" : "away";
    S.lado = p.online.lado;
    S.pedido = p; S.fila = []; S.fim = null;
    S.fase = "jogo";
    if (S.papel === "A") refSala(S.codigo).update({ estado: "jogando" });
    redesenha();
    var meu = S;
    var ok = TM.tm3d.jogarOnline(p, {
      pronto: function (janela, id) { if (S === meu) entregaPorta(janela, id); },
      fim: function (r3, dados) { if (S === meu) fimJogo(r3, dados); },
      sair: function (dados) { if (S === meu) saiuJogo(dados); }
    });
    if (!ok && S === meu && S.fase === "jogo") saiuJogo(null);
  }
  function estadoPorta(inf) {
    inf = inf || (S.lig ? S.lig.info() : { estado: "fechado", rtt: null, par: null, motivo: "fechou" });
    var e = { t: "estado", estado: inf.estado, rtt: S.rtt != null ? S.rtt : (inf.rtt != null ? inf.rtt : null), par: inf.par || null, nome: S.outro ? S.outro.nome : "" };
    if (inf.motivo) e.motivo = inf.motivo;
    return e;
  }
  function entregaPorta(janela, id) {
    if (!S.pedido || S.pedido.id !== id || !janela) return;
    if (S.porta) { try { S.porta.close(); } catch (e) {} S.porta = null; }
    var ch = new global.MessageChannel();
    try { janela.postMessage({ tipo: "tm3d:porta", id: id, proto: api.PROTO, porta: ch.port2 }, global.location.origin, [ch.port2]); }
    catch (e) { return; }
    S.porta = ch.port1;
    S.porta.onmessage = daPorta;
    S.porta.postMessage(estadoPorta());
    var f = S.fila; S.fila = [];
    f.forEach(function (x) { try { S.porta.postMessage(x[0], x[1] || []); } catch (e) {} });
  }
  function paraPorta(msg, transf) {
    if (!S || S.fase !== "jogo") return;
    if (S.porta) { try { S.porta.postMessage(msg, transf || []); } catch (e) {} return; }
    if (msg.t === "j" && S.fila.length > 600) return;       // pacote de jogo velho não serve
    S.fila.push([msg, transf]);
  }
  function daPorta(e) {
    var d = e.data;
    if (!d || !S || S.fase !== "jogo") return;
    if (d.t === "j") { if (d.b instanceof ArrayBuffer && S.lig) S.lig.enviar(d.b); }
    else if (d.t === "c") { if (S.lig) S.lig.enviarControle({ c: "jogo", m: d.m }); }
    else if (d.t === "religar") { if (S.lig) S.lig.religar(); }
    else if (d.t === "estado?") { if (S.porta) S.porta.postMessage(estadoPorta()); }
  }
  function terminaJogo() {
    if (S.porta) { try { S.porta.close(); } catch (e) {} S.porta = null; }
    S.fila = [];
    fechaLig("fim", 1500);
    if (S.papel === "A") refSala(S.codigo).update({ estado: "fim" });
  }

  /* ----- 7. resultado ----- */
  function num(x) { x = Number(x); return isFinite(x) ? Math.max(0, Math.round(x)) : 0; }
  function fimJogo(r3, dados) {
    var on = (dados && dados.online) || (r3 && r3.online) || null;
    S.fim = { r3: r3 || null, online: on, abandono: false };
    terminaJogo();
    gravaResultado();
    S.fase = "resultado";
    TM.ui.go("online3d");
  }
  function saiuJogo(dados) {
    var abandono = !!(dados && (dados.abandono || (dados.online && dados.online.abandono)));
    S.fim = { r3: null, online: (dados && dados.online) || null, abandono: abandono, semQuadro: !dados };
    if (abandono) {
      var fp = null; try { fp = TM.fairplay ? TM.fairplay.recordAbandon() : null; } catch (e) {}
      S.fim.fp = fp;
      // o anfitrião é quem grava: saiu ele, grava a própria derrota (o convidado, quando sai, fica com o fair play)
      if (S.papel === "A" && S.outro && !S.gravado[S.partidaN]) {
        S.gravado[S.partidaN] = true;
        try { N().recordResult(S.eu.uid, S.outro.uid, S.outro.uid); N().recordWin(S.outro.uid, S.outro.nome, S.eu.uid, S.eu.nome); } catch (e) {}
      }
    }
    terminaJogo();
    S.fase = "resultado";
    TM.ui.go("online3d");
  }
  function gravaResultado() {
    if (S.papel !== "A" || !S.outro || S.gravado[S.partidaN]) return;
    var r3 = S.fim.r3, on = S.fim.online || {};
    if (!r3 || on.dessinc || on.semResultado) return;
    var hs = num(r3.homeGoals), as = num(r3.awayGoals);
    S.gravado[S.partidaN] = true;
    var A = S.eu, C = S.outro, win = hs > as ? A : as > hs ? C : null;
    try {
      N().recordResult(A.uid, C.uid, win ? win.uid : null);
      if (win) { var los = win === A ? C : A; N().recordWin(win.uid, win.nome, los.uid, los.nome); }
    } catch (e) {}
  }
  function jogarDeNovo() {
    if (!S) return;
    S.partidaN++;
    S.fim = null; S.pedido = null;
    S.prontoEu = S.prontoEle = false; S.dele = null;
    if (S.papel === "A") {
      S.fase = S.outro && S.sala && S.sala.convidado ? "entrou" : "esperando";
      var upd = { partidaN: S.partidaN, estado: "esperando" };
      if (!S.outro || !S.sala || !S.sala.convidado) { S.outro = null; armaExpira(); }
      refSala(S.codigo).update(upd);
    } else {
      S.fase = "aguardaAceite";
      refSala(S.codigo).update({ naSalaC: S.partidaN });
    }
    redesenha();
  }

  /* ----- sair ----- */
  // semBanco: a sala já não existe (ou fui tirado): só limpa este aparelho
  function sairDaSala(semBanco, s) {
    s = s || S;
    if (!s) return;
    if (S === s) S = null;
    try { if (s.lig) s.lig.enviarControle({ c: "sala", tipo: "tchau" }); } catch (e) {}
    limpaTimers(s);
    if (s.paraSala) s.paraSala();
    if (s.sinal) s.sinal.fechar();
    if (s.porta) { try { s.porta.close(); } catch (e) {} }
    if (s.lig) { var l = s.lig; s.lig = null; l.fechar("saiu", 400); }
    if (semBanco || !banco()) return;
    var r = refSala(s.codigo);
    try { r.onDisconnect().cancel(); } catch (e) {}
    if (s.papel === "A") { r.remove(); return; }
    var uid = s.eu.uid;
    r.once("value").then(function (snap) {
      var v = snap.val();
      if (v && v.convidado === uid) r.update({ convidado: null, nomeC: null, versaoC: null, naSalaC: null, aceito: null, rtc: null });
    }).catch(function () {});
  }
  function confirmaSair(depois) {
    if (!S || S.fase === "resultado") { sairDaSala(); if (depois) depois(); return; }
    var outro = S.outro ? S.outro.nome : null;
    TM.ui.confirm("Sair da sala?", outro ? outro + " fica sabendo que você saiu." : "A sala é fechada.", "Sair", function () { sairDaSala(); if (depois) depois(); });
  }

  /* ---------- telas ---------- */
  TM.ui.register("online3d", function (screen, params) {
    params = params || {};
    if (params.codigo && !VIEW.autoFeito) VIEW.codigoAuto = limpaCodigo(params.codigo);
    screen.appendChild(TM.ui.topbar("Online 3D", function () {
      if (!S) { TM.ui.go("modes"); return; }
      if (emJogo()) return;
      confirmaSair(function () { TM.ui.go("online3d"); });
    }));
    var corpo = el("div", { class: "panel-narrow o3d" });
    screen.appendChild(corpo);
    VIEW.corpo = corpo;
    desenha(corpo);
  });

  function desenha(corpo) {
    clearInterval(VIEW.ticker); VIEW.ticker = null; VIEW.linhaCon = null;
    if (!S) { desenhaEntrada(corpo); return; }
    var f = S.fase;
    if (f === "esperando") desenhaEsperando(corpo);
    else if (f === "entrou") desenhaEntrou(corpo);
    else if (f === "aguardaAceite") desenhaAguarda(corpo);
    else if (f === "ligando") desenhaLigando(corpo);
    else if (f === "falhou") desenhaFalhou(corpo);
    else if (f === "times") desenhaTimes(corpo);
    else if (f === "jogo") corpo.appendChild(cartao("Partida em andamento", "O estádio 3D está aberto por cima desta tela.", []));
    else if (f === "resultado") desenhaResultado(corpo);
  }
  function cartao(titulo, texto, botoes, cls) {
    return el("div", { class: "next-match o3d-cartao" + (cls ? " " + cls : "") }, [
      el("div", { class: "nm-label", text: titulo }),
      texto ? el("p", { class: "intro-text o3d-txt", text: texto }) : null,
      botoes && botoes.length ? el("div", { class: "o3d-acoes" }, botoes) : null
    ]);
  }
  function botao(rotulo, fn, cls) { var b = TM.ui.button(rotulo, fn, cls || "btn"); b.type = "button"; return b; }
  function linhaSala(corpo) {
    corpo.appendChild(el("div", { class: "o3d-sala" }, [
      el("span", { class: "o3d-sala-l", text: "Sala" }), el("span", { class: "o3d-sala-c", text: S.codigo }),
      S.outro ? el("span", { class: "o3d-sala-n", text: (S.papel === "A" ? "Você e " : S.outro.nome + " e ") + (S.papel === "A" ? S.outro.nome : "você") }) : null
    ]));
  }

  /* entrada: criar ou entrar */
  function desenhaEntrada(corpo) {
    if (VIEW.aviso) {
      corpo.appendChild(el("div", { class: "o3d-aviso", role: "status" }, [el("span", { class: "o3d-aviso-ic" }, [TM.ic("info")]), el("span", { text: VIEW.aviso })]));
    }
    if (!TM.tm3d || !TM.tm3d.disponivel || !TM.tm3d.disponivel()) {
      corpo.appendChild(cartao("Online 3D indisponível", "Este aparelho não tem WebGL 2, que o estádio 3D precisa. Atualize o navegador ou ative a aceleração de hardware.", [botao("Voltar", function () { TM.ui.go("modes"); }, "btn primary")]));
      return;
    }
    if (TM.fairplay && !TM.fairplay.gate(corpo)) return;
    var n = N();
    if (!n) { indisponivel(corpo, null); return; }
    try { n.init(); } catch (e) {}
    if (!n.available) { indisponivel(corpo, n.error); return; }
    if (!n.ready) {
      corpo.appendChild(cartao("Conectando…", "Entrando na sua conta online.", []));
      var meu = corpo;
      setTimeout(function () { if (meu.isConnected && !S && !N().ready) { TM.ui.clear(meu); indisponivel(meu, N().error); } }, api.CONTA_MS);
      n.onReady(function () { if (meu.isConnected && !S) redesenha(); });
      return;
    }
    corpo.appendChild(el("p", { class: "intro-text o3d-intro", text: "Jogue uma partida 3D contra um amigo, cada um no seu aparelho (celular deitado ou PC), cada um com o seu time. Crie uma sala e mande o código ou o link, ou entre com o código que ele te mandou." }));
    corpo.appendChild(botao("Criar sala", function () { criarSala(0); }, "btn primary big"));
    var erroEl = el("p", { class: "o3d-erro", role: "alert", hidden: true });
    var campo = el("input", { class: "select big-code o3d-codigo", type: "text", placeholder: "CÓDIGO", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": "Código da sala", value: VIEW.codigoAuto || "" });
    campo.addEventListener("keydown", function (e) { if (e.key === "Enter") entrar(campo.value, erroEl); });
    corpo.appendChild(el("div", { class: "setting o3d-entrar" }, [
      el("div", { class: "setting-label", text: "Entrar com código" }),
      campo,
      botao("Entrar", function () { entrar(campo.value, erroEl); }, "btn big"),
      erroEl
    ]));
    corpo.appendChild(el("p", { class: "o3d-nota", text: "Só com quem você conhece: sem chat e sem partida com desconhecidos. A partida liga os dois aparelhos direto, sem servidor. Sair no meio conta como derrota." }));
    if (VIEW.codigoAuto && !VIEW.autoFeito) { VIEW.autoFeito = true; var c = VIEW.codigoAuto; VIEW.codigoAuto = null; entrar(c, erroEl); }
  }
  function indisponivel(corpo, msg) {
    corpo.appendChild(cartao("Online indisponível", msg ? "Não foi possível conectar à conta online (" + msg + "). Confira a internet e tente de novo." : "Não foi possível conectar à conta online. Confira a internet e tente de novo.",
      [botao("Tentar de novo", function () { TM.ui.go("online3d"); }, "btn primary")]));
  }

  /* anfitrião: a sala criada, esperando alguém */
  function desenhaEsperando(corpo) {
    var link = linkDa(S.codigo);
    var qr = el("div", { class: "qr-box o3d-qr" });
    try { qr.innerHTML = qrSvg(link); } catch (e) { qr = null; }
    var acoes = [
      botao("Copiar código", function () { copia(S.codigo, "Código copiado."); }, "btn small"),
      botao("Copiar link", function () { copia(link, "Link copiado."); }, "btn small")
    ];
    if (global.navigator.share) acoes.push(botao("Compartilhar", function () {
      try { global.navigator.share({ title: "Total Match · Online 3D", text: "Entre na minha sala do Online 3D no Total Match: " + S.codigo, url: link }).catch(function () {}); } catch (e) {}
    }, "btn small"));
    corpo.appendChild(el("div", { class: "room-share o3d-share" }, [
      el("div", { class: "share-lbl", text: "Mande o código ou o link para o seu amigo:" }),
      el("div", { class: "share-code o3d-code", text: S.codigo }),
      el("div", { class: "o3d-link", text: link }),
      el("div", { class: "o3d-acoes" }, acoes),
      qr,
      el("div", { class: "waiting-line", text: "Aguardando o seu amigo entrar…" })
    ]));
    corpo.appendChild(el("div", { class: "o3d-acoes" }, [botao("Fechar a sala", function () { confirmaSair(function () { redesenha(); }); }, "btn ghost")]));
  }
  /* anfitrião: alguém entrou — aceitar ou recusar */
  function desenhaEntrou(corpo) {
    linhaSala(corpo);
    if (S.sala && S.sala.aceito && S.outro && S.sala.aceito === S.outro.uid) {
      corpo.appendChild(cartao("Jogar de novo", "Aguardando " + S.outro.nome + " voltar para a sala…", [botao("Fechar a sala", function () { confirmaSair(function () { redesenha(); }); }, "btn ghost")]));
      return;
    }
    corpo.appendChild(cartao((S.outro ? S.outro.nome : "Alguém") + " entrou na sala", "Aceite para ligar os dois aparelhos e escolher os times, ou recuse para tirar da sala.", [
      botao("Aceitar", aceitar, "btn primary"),
      botao("Recusar", recusar, "btn ghost")
    ]));
  }
  /* convidado: esperando o anfitrião aceitar */
  function desenhaAguarda(corpo) {
    linhaSala(corpo);
    corpo.appendChild(cartao("Aguardando " + (S.outro ? S.outro.nome : "o anfitrião"), S.partidaN > 1 ? "Esperando " + (S.outro ? S.outro.nome : "o anfitrião") + " voltar para a sala…" : "Você entrou na sala. Agora é só esperar o anfitrião aceitar.",
      [botao("Sair da sala", function () { confirmaSair(function () { redesenha(); }); }, "btn ghost")]));
  }
  /* ligando os aparelhos (até 15 s) */
  function desenhaLigando(corpo) {
    linhaSala(corpo);
    var seg = el("span", { class: "o3d-seg", text: "" });
    corpo.appendChild(el("div", { class: "next-match o3d-cartao" }, [
      el("div", { class: "nm-label", text: "Ligando os aparelhos" }),
      el("div", { class: "o3d-ligando" }, [el("span", { class: "o3d-giro", "aria-hidden": "true" }), el("span", { text: "Conectando direto com " + (S.outro ? S.outro.nome : "o outro aparelho") + "…" }), seg]),
      el("div", { class: "o3d-acoes" }, [botao("Sair da sala", function () { confirmaSair(function () { redesenha(); }); }, "btn ghost")])
    ]));
    function tic() { if (!S || !S.ligandoDesde) return; seg.textContent = Math.min(99, Math.floor((agora() - S.ligandoDesde) / 1000)) + " s"; }
    tic(); VIEW.ticker = setInterval(tic, 500);
  }
  function desenhaFalhou(corpo) {
    linhaSala(corpo);
    corpo.appendChild(cartao("Não deu para ligar", S.msg || TEXTO_FALHA, [
      botao("Tentar de novo", tentarDeNovo, "btn primary"),
      botao("Sair", function () { sairDaSala(); redesenha(); }, "btn ghost")
    ], "o3d-falha"));
  }
  /* os times: cada um escolhe o seu e vê o do outro */
  function linhaConexao() {
    var e = el("div", { class: "o3d-con" });
    VIEW.linhaCon = e;
    pintaCon(e);
    return e;
  }
  function pintaCon(e) {
    var est = S.lig ? S.lig.info().estado : "fechado";
    var fx = faixa(S.rtt);
    e.className = "o3d-con " + (est === "instavel" ? "media" : fx || "medindo");
    TM.ui.clear(e);
    e.appendChild(el("span", { class: "o3d-barras", "aria-hidden": "true" }, [el("i"), el("i"), el("i")]));
    e.appendChild(el("span", { text: est === "instavel" ? "Conexão instável, reconectando…" : fx == null ? "Medindo a conexão…" : (fx === "boa" ? "Conexão boa" : fx === "media" ? "Conexão razoável" : "Conexão lenta") + " (" + S.rtt + " ms)" }));
  }
  function atualizaLinhaCon() { if (VIEW.linhaCon && VIEW.linhaCon.isConnected && S) pintaCon(VIEW.linhaCon); }
  // o meu: o escudo do meu TM; o do outro: o MESMO que ele vê (o endereço que veio no time dele; a edição pode ser outra)
  function escudoImg(info, meia, cls, meu) {
    try {
      if (meu && info.fonte === "club" && TM.data.club(info.id)) return TM.img.clubImg(TM.data.club(info.id), cls);
      if (meu && info.fonte === "nation" && TM.data.nation(info.id)) return TM.img.nationImg(TM.data.nation(info.id), cls);
    } catch (e) {}
    if (info && info.escudo) return el("img", { class: cls, src: info.escudo, alt: "" });
    return el("span", { class: cls + " o3d-sigla", text: (meia && meia.short) || "" });
  }
  function desenhaTimes(corpo) {
    linhaSala(corpo);
    corpo.appendChild(linhaConexao());
    var outro = S.outro ? S.outro.nome : "Adversário";
    // o meu time
    var seg = el("div", { class: "segmented full" });
    [["club", "Clubes"], ["nation", "Seleções"]].forEach(function (o) {
      seg.appendChild(el("button", { class: "seg-btn" + (S.fonte === o[0] ? " active" : ""), type: "button", text: o[1], on: { click: function () {
        if (S.prontoEu) return;
        S.fonte = o[0]; redesenha();
      } } }));
    });
    corpo.appendChild(el("div", { class: "setting-label", text: "Seu time" }));
    if (!S.prontoEu) corpo.appendChild(seg);
    var abrePicker = function () {
      if (!S || S.prontoEu) return;
      TM.ui.pickTeam({ source: S.fonte, title: "Seu time", current: S.meu && S.meu.info.fonte === S.fonte ? S.meu.info.id : null, especiais: S.fonte === "club",
        back: function () { TM.ui.go("online3d"); },
        onPick: function (id) { escolheTime(id); TM.ui.go("online3d"); } });
    };
    if (!S.meu) corpo.appendChild(el("button", { class: "chosen-team empty", type: "button", on: { click: abrePicker } }, [el("span", { text: "Escolher o meu time" })]));
    else {
      var i = S.meu.info;
      var c = el("div", { class: "chosen-team o3d-time meu" + (S.prontoEu ? " pronto" : ""), on: { click: abrePicker } }, [
        escudoImg(i, S.meu.meia, "chosen-crest", true),
        el("div", { class: "chosen-info" }, [el("div", { class: "chosen-name", text: i.nome }), el("div", { class: "chosen-sub", text: S.prontoEu ? "Você está pronto" : "Toque para trocar" })]),
        TM.ui.ovBadge(i.nota)
      ]);
      corpo.appendChild(c);
    }
    corpo.appendChild(el("div", { class: "vs-divider", text: "VS" }));
    corpo.appendChild(el("div", { class: "setting-label", text: outro }));
    if (!S.dele) corpo.appendChild(el("div", { class: "chosen-team empty o3d-espera" }, [el("span", { text: outro + " está escolhendo o time…" })]));
    else {
      var d = S.dele.info;
      corpo.appendChild(el("div", { class: "chosen-team o3d-time" + (S.prontoEle ? " pronto" : "") }, [
        escudoImg(d, S.dele.meia, "chosen-crest", false),
        el("div", { class: "chosen-info" }, [el("div", { class: "chosen-name", text: d.nome }), el("div", { class: "chosen-sub", text: S.prontoEle ? outro + " está pronto" : "Escolhido por " + outro })]),
        TM.ui.ovBadge(d.nota)
      ]));
    }
    var st;
    if (S.prontoEu && S.prontoEle) st = "Os dois prontos. Abrindo o estádio…";
    else if (S.prontoEu) st = "Aguardando " + outro + " ficar pronto.";
    else if (S.prontoEle) st = outro + " está pronto. Falta você.";
    else st = "Cada um escolhe o próprio time. O anfitrião joga em casa.";
    corpo.appendChild(el("div", { class: "waiting-line o3d-status", text: st }));
    var bt = S.prontoEu ? botao("Desfazer pronto", alternaPronto, "btn ghost") : botao("Pronto", alternaPronto, "btn primary big");
    if (!S.meu) bt.classList.add("is-off");
    corpo.appendChild(el("div", { class: "o3d-acoes o3d-fim" }, [bt, botao("Sair da sala", function () { confirmaSair(function () { redesenha(); }); }, "btn ghost")]));
  }

  /* o fim da partida */
  // o time de cada lado para a tela de fim: o meu pelos dados do meu TM; o do outro só com o nome e os jogadores do
  // pedido (a edição dele pode ser outra) — o escudo dele entra depois, o mesmo que ele vê (trocaEscudo)
  function timeDoPoster(lado) {
    var meia = lado === 0 ? S.pedido.home : S.pedido.away;
    var t = { name: meia.name, players: (meia.players || []).map(function (p) { return { id: p.tmId, name: p.nomeCompleto || p.name }; }) };
    if (lado === S.lado && S.meu) {
      var info = S.meu.info; t.id = info.id;
      try { if (info.fonte === "club") t.club = TM.data.club(info.id) || null; else if (info.fonte === "nation") t.nation = TM.data.nation(info.id) || null; } catch (e) {}
    }
    return t;
  }
  function trocaEscudo(poster, lado) {
    var lados = poster.querySelectorAll(".mdp-time"), alvo = lados[lado] && lados[lado].querySelector(".mdp-escudo");
    var meia = lado === 0 ? S.pedido.home : S.pedido.away, info = S.dele && S.dele.info;
    if (!alvo) return;
    alvo.replaceWith(escudoImg(info || {}, meia, "mdp-escudo", false));
  }
  function desenhaResultado(corpo) {
    var F = S.fim || {}, on = F.online || {}, outro = S.outro ? S.outro.nome : "o adversário";
    var acoes = [botao("Jogar de novo", jogarDeNovo, "btn primary"), botao("Sair", function () { sairDaSala(); TM.ui.go("online3d"); }, "btn ghost")];
    if (F.abandono) {
      var fp = F.fp && F.fp.penaltyMs > 0 && TM.fairplay ? " Você ficou suspenso do online por " + TM.fairplay.fmt(F.fp.penaltyMs) + "." : "";
      corpo.appendChild(cartao("Você saiu da partida", "Conta como derrota por W.O. contra " + outro + "." + fp, acoes));
      if (TM.fairplay) corpo.appendChild(TM.fairplay.repCard());
      return;
    }
    if (on.dessinc) {
      corpo.appendChild(cartao("Partida encerrada sem resultado", "Os dois aparelhos ficaram diferentes por um erro do jogo. A partida foi encerrada sem resultado: nada conta.", acoes));
      return;
    }
    if (!F.r3) {
      corpo.appendChild(cartao("A partida não aconteceu", F.semQuadro ? "O estádio 3D não abriu neste aparelho." : "A partida foi encerrada sem resultado.", acoes));
      return;
    }
    var a = timeDoPoster(0), b = timeDoPoster(1), r = { stats: null };
    try { TM.tm3d.aplicaResultado(r, F.r3, a, b); } catch (e) { r.score = [num(F.r3.homeGoals), num(F.r3.awayGoals)]; r.events = []; }
    var hs = r.score[0], as = r.score[1], nomes = (S.pedido.online && S.pedido.online.nomes) || [];
    var res = TM.ui.resultadoDe(hs, as, S.lado), nota = null;
    if (on.wo && (on.wo.vencedor === 0 || on.wo.vencedor === 1)) {
      res = on.wo.vencedor === S.lado ? { cls: "v", txt: "Vitória por W.O." } : { cls: "d", txt: "Derrota por W.O." };
      nota = on.wo.vencedor === S.lado ? outro + " saiu da partida." : "Você saiu da partida.";
    }
    var poster = TM.ui.posterFim({ a: a, b: b, hs: hs, as: as, events: r.events, titulo: (nomes[0] || "Anfitrião") + " × " + (nomes[1] || "Convidado"), res: res, nota: nota, neutro: S.lado !== 0 });
    trocaEscudo(poster, 1 - S.lado);
    corpo.appendChild(poster);
    corpo.appendChild(el("p", { class: "o3d-nota", text: S.papel === "A" ? "Resultado gravado no retrospecto de vocês e no ranking." : "O anfitrião grava o resultado no retrospecto de vocês e no ranking." }));
    corpo.appendChild(el("div", { class: "o3d-acoes o3d-fim" }, acoes));
  }

  /* ---------- API (testes e outros módulos) ---------- */
  TM.online3d = {
    api: api,
    sinalFirebase: sinalFirebase,
    criarLigacao: criarLigacao,
    calcD0: calcD0,
    limpaCodigo: limpaCodigo,
    criarSala: function () { criarSala(0); },
    entrar: function (codigo) { entrar(codigo, null); },
    sair: function () { sairDaSala(); redesenha(); },
    /** Um retrato do estado deste aparelho (testes). */
    estado: function () {
      if (!S) return { fase: null, aviso: VIEW.aviso };
      return { fase: S.fase, papel: S.papel, codigo: S.codigo, partidaN: S.partidaN, outro: S.outro, rtt: S.rtt, D0: S.D0,
        lig: S.lig ? S.lig.info() : null, meu: S.meu && S.meu.info, dele: S.dele && S.dele.info, prontoEu: S.prontoEu, prontoEle: S.prontoEle,
        pedido: S.pedido ? { id: S.pedido.id, online: S.pedido.online } : null, porta: !!S.porta, fim: S.fim, msg: S.msg, aviso: VIEW.aviso };
    }
  };
})(window);
