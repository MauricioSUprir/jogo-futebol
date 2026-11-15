/* ================= TOTAL MATCH — Modo Leilão: a sessão (fora das telas) ================= */
/* Plano: PLANO-LEILAO.md §1.1 (a sala), §1.3 (o lote), §1.4 (quem some), §2 (o que as telas mostram), §3.2 (os dados),
   §3.3 (o protocolo) e §3.5 (os robôs). Como o `S` do online3d.js, mas SEM DOM: a sessão ouve a sala pela rede
   (leilao-rede.js: a memória no treino, o firebase() no online, com a mesma interface), roda os relógios dos lotes, chama
   as funções PURAS do leilao.js DENTRO de rede.transacao e põe os robôs para agir. As telas (leilao-tela.js) só leem
   `ver()` e chamam as ações. Navegar para outra tela NÃO para a sessão: só "Sair da sala" encerra.

   A sala (os caminhos dentro de leiloes/{CÓDIGO}; no treino, a mesma árvore em memória, gravada no aparelho):
     sala    { meta: { dono, proto, regras, versaoTM, edicao, criada, estado, semente, atividade, treino, fimLeilao },
               cfg: { liga, ligaNome, T, tempo (ms do relógio do lote), formato, overall, vagas e bots (online) },
               tec: { uid: { nome, num, papel: 'dono'|'tecnico'|'bot', pronto, entrou, auth, saiu, clube: { nome, sigla, cor,
                      escudo ("forma|símbolo", o do Ultimate) }, formacao } },
               pedidos: { uid: { nome, num, auth, clube, formacao, versaoTM, edicao, ts, depois } } (online),
               recusados: { uid: true } (online),
               ordem: [uid × T] (o índice t de cada técnico; gravada no Começar) }
     lotes   { l: [retrato × 13T], f: [retrato] (os de fora, para completar de graça), T, liga (online) }  gravados uma vez
     vivo    o estado do leilão (leilao.js); SÓ por transação
     escal/{t}  { formacao, tit: [índice global × 11] (só a escalação feita à mão), pronto }; a automática é função pura
     vendas/{i} { t, v (o preço), s (o seq do lote) }: registro para a tela (a verdade é o vivo.d)
     pres/{uid}/{sid}  true por conexão (online; o onDisconnect apaga)
     bate/{uid}  { ts, sid, desde, ant, cont, falta } a cada 5 s com a página à vista (online; é a testemunha da hora). A
              presença contínua: ant = o bate anterior desta conta que este aparelho conhece (a hora do servidor), cont =
              desde quando ela está sem buraco de mais de 12 s, falta = o último bate antes desse buraco (corridaDe)
     relogio  só no treino: a hora do treino (ms) na última ação; o relógio do treino PARA com a página fechada ou
              escondida e volta daí (recarregar a página no meio volta ao mesmo ponto, com o tempo que faltava)
     jogos/{id}  a máquina de cada jogo do campeonato (leilao-camp.js: aberto → reservado → feito), SÓ por transação, uma
              por passo; o resultado mora dentro e é gravado UMA vez, antes de alguém o mostrar

   Estados da sala: saguao (online: pedidos, aceitar, configurar, Pronto) → leilao (Começar, por transação) → escalacao
   (o vivo chegou ao fim; qualquer aparelho) → camp (todos prontos ou 60 s; a transação grava meta.camp = a hora do
   servidor em que o campeonato começa: o calendário é função pura de cfg.formato, T e meta.semente) → fim (todos os jogos
   feitos; meta.fimCamp; a sala fica para consulta e some 24 h depois da última atividade, como as outras).

   O campeonato (§1.7; o núcleo puro é o leilao-camp.js): a vista (rodadas, tabela, chave, artilharia, o fim) é montada
   dos jogos GRAVADOS (ninguém recalcula partida para mostrar). Qualquer aparelho da sala age nos jogos da rodada da vez,
   escalonado como no leilão: bot × bot (e, até o PR 5, pessoa × pessoa) é reservado e simulado ao abrir a rodada; o jogo
   de uma pessoa contra um bot tem o prazo de 2 min para começar, que só corre com a pessoa presente (pausar/retomar pelo
   batimento dela; no treino ela está sempre presente: o relógio do treino é que para) e, vencido pela testemunha da hora,
   é simulado por qualquer um. Quem some sem ninguém ver (sozinha na sala, todos com o celular travado) não perde o prazo:
   o bate dela diz que houve um buraco depois de o prazo começar e o prazo para no último bate antes dele e volta a correr
   (qualquer aparelho, o dela primeiro); a pessoa toca em "Simular partida" (simular): reservar com a trava do servidor → simular
   com a semente e as escalações GRAVADAS → gravar → só então o resultado volta para a tela mostrar. O dono tem
   simularPendentes() (só os jogos que esperam por quem está AUSENTE; com o dono fora há mais de 5 min, qualquer técnico
   presente tem). A escalação mudada vale a partir do próximo jogo que não começou (a reserva grava a do momento).
   Quem saiu da sala ("Sair da sala") conta como bot nos jogos. Todo nó novo de jogos é conferido (leilao-camp.js
   conferirJogo: os times, as escalações e o simulado RECALCULADO uma vez por nó); o feito que muda ou o jogo que some
   congelam a sala, como o vivo.

   Quem age (§3.3, "sem martelo"): fechar o lote, o lance de um robô, o passe de quem sumiu, as trocas de estado da sala e
   apagar a sala vencida são transações IDEMPOTENTES que qualquer aparelho com a sala aberta roda; no online, o k-ésimo
   presente (na ordem) espera 1,5 s × k depois do momento certo (no treino e nos testes, `atraso` fixo). Duas ao mesmo
   tempo não estragam nada: a 2ª aborta pelo seq/n. Toda decisão por PRAZO no online (fechar pela hora, o passe de quem
   sumiu, o fim da escalação, a limpeza) passa antes pela TESTEMUNHA da hora: grava TIMESTAMP no próprio bate, espera o
   ack e só age se a hora que o servidor pôs já passou do prazo (o relógio de nenhum aparelho decide).

   Presença (online): pres/{uid}/{sid} por conexão (só a tela mostra); quem decide é o bate fresco (≤ 12 s): sem ele (ou
   com "Sair da sala"), o técnico PASSA sozinho em cada lote e não gasta nada (decisão 6); volta ao controle quando volta.
   O sid separa abas e aparelhos da mesma conta: só a sessão mais recente age (a outra fica `outraAba`; assumir() volta).

   Cada `vivo` novo é conferido contra o anterior (TM.leilao.conferir); se não bate, a sessão congela (`alterada`).

   API (TM.leilaoSessao):
     criarTreino(opc) → Promise(sessão)   opc: { liga, bots (1–7), formacao, tempo (s ou ms), formato ('mata' padrão,
                                           'pontos', 'misto'), clube?, semente?, codigo?
                                           e, só nos testes: relogio, agendar, cancelar, armazem, latencia, atraso }
     criarSala(opc) → Promise(sessão)     o online: { liga, ligaNome?, vagas (2–8, contando os bots), bots, tempo, formacao,
                                           formato, clube?, semente?, mundo? } — o código de 6 letras (sem I, O, 0 e 1) nasce por
                                           transação de null (sem colisão)
     entrar(codigo, opc) → Promise(sessão) o pedido (ou a volta de quem já é da sala); rejeita com `codigo`: codigo,
                                           naoExiste, recusado, cheia, edicao, regras, fairplay, conta, vencida, indisponivel
     abrir(codigo, opc) → Promise(sessão)  uma sala guardada (o treino depois de recarregar; a online das Minhas salas);
                                           opc.rede = uma rede já aberta (os testes: outro "aparelho"), opc.eu (-1 = só olha)
     atual() · salas() (as "Minhas salas" deste aparelho: treinos e online) · conferirSalas() (tira as que sumiram) ·
     esquecer(codigo) · limpaCodigo(texto) · acelerar(fator) (gancho de teste) · textoMotivo(m, info)
     Nos testes, o online recebe em opc: id { uid, auth, nome, num }, redePara(codigo), edicao(), suUnlocked(),
     trocarEdicao(ed), fairplay() (true = suspenso), doc (a visibilidade), sid, mundo, armazem, agendar, cancelar.
   A sessão: ver() (tudo o que as telas mostram; no campeonato, ver().camp) · lance('+1'|'+5'|'+10'|'tudo'|número) ·
     passar() · mudarFormacao(f) · trocar(a, b) · prontoEscalacao(sim) · sair() · parar() · aoMudar(fn) · on(evento, fn) ·
     escalacao(t) · hora()
     O campeonato: simular(id?) (o meu jogo da rodada, sem id) · simularPendentes() (o dono; sem ele há 5 min, qualquer
     técnico presente) · partida(id) (o jogo
     gravado com os dois times pelas escalações gravadas: o "Ver o jogo" no 2D)
     Só no online: aceitar(uid) · recusar(uid) · tirar(uid) · configurar(parcial; também o formato) · pronto(sim) ·
     meuClube(clube) · comecar() · passarClube(uidVelho, uidNovo) · encerrar() · assumir() · reconectar()
     Eventos: 'lote' {i, fase, k}, 'lance' {t, valor}, 'superado' {t, valor}, 'vendido' {i, t, preco}, 'semLance' {i},
     'formacao' {de, para}, 'fim', 'estado' {estado}, 'alterada' {motivo}; o campeonato: 'jogo' {id, a, b, placar, venc,
     eu} (um jogo foi gravado), 'rodada' {n, nome} (a rodada abriu); online: 'aceito', 'recusado', 'tirado',
     'passado' (o clube foi para outra conta), 'apagada', 'outraAba', 'conferindo', 'rede' {rede}
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
  var BATE_MS = 5000;            // o batimento (online), com a página à vista
  var AUSENTE_MS = 12000;        // sem bate fresco por mais que isso = ausente (passa sozinho)
  var ACK_MS = 3000;             // bate sem ack em 3 s = "Reconectando…"
  var VOLTA_MS = 5000;           // escondida por mais que isso: "Atualizando…" na volta (e, sem o ack, goOffline/goOnline)
  var ESCALONA_MS = 1500;        // o k-ésimo presente espera 1,5 s × k depois do momento certo
  var SALTO_MS = 1000;           // o relógio de parede e o monótono se desencontraram mais que isso: testemunha nova
  var DONO_FORA_MS = 5 * 60000;  // o dono fora há mais que isso: "Simular os pendentes" passa a qualquer técnico presente
  var SAGUAO_MS = 30 * 60000;    // a sala parada no saguão some depois de 30 min
  var VIDA_MS = 24 * 3600000;    // e depois de 24 h sem atividade
  var CHAVE_ONLINE = "leilao:online";   // o índice das salas online deste aparelho (Minhas salas)
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
  function LC() { return TM.leilaoCamp; }
  function formatoDe(x) { return LC() ? LC().formatoDe(x) : "mata"; }
  // o nó jogos como objeto (as chaves r1j0, m2j1… nunca viram lista no Firebase; o vazio volta null)
  function objJogos(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function jogoDaVista(V, id) {
    if (!V) return null;
    for (var r = 0; r < V.rodadas.length; r++) for (var k = 0; k < V.rodadas[r].jogos.length; k++) if (V.rodadas[r].jogos[k].id === id) return V.rodadas[r].jogos[k];
    return null;
  }
  // a hora mais nova gravada nos jogos (o treino reaberto não volta o relógio para antes dela; a limpeza conta como atividade)
  function horaJogos(js) {
    var h = 0;
    Object.keys(js || {}).forEach(function (k) { var j = js[k]; if (j) h = Math.max(h, num(j.ts, 0), num(j.trava, 0), num(j.ini, 0), num(j.inicio, 0)); });
    return h;
  }
  function UT() { return (TM.ut && TM.ut._i) || null; }
  function versao() { try { return (TM.versao && TM.versao()) || ""; } catch (e) { return ""; } }
  function edicao() { try { return (TM.storage && TM.storage.edition && TM.storage.edition()) || "public"; } catch (e) { return "public"; } }
  function u32() {
    var r = new Uint32Array(1);
    try { global.crypto.getRandomValues(r); } catch (e) { r[0] = Math.floor(Math.random() * 4294967296); }
    return r[0] >>> 0;
  }
  function novoCodigo() { var c = ""; for (var i = 0; i < 6; i++) c += LETRAS[u32() % LETRAS.length]; return c; }
  function novoSid() { return "s" + u32().toString(36) + u32().toString(36); }
  /** O código digitado ou o link colado inteiro (…?leilao=CÓDIGO), em maiúsculas e sem o resto. */
  function limpaCodigo(t) {
    t = String(t || "").trim();
    var m = t.match(/leilao=([A-Za-z0-9]+)/);
    if (m) t = m[1];
    return t.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function num(x, p) { return typeof x === "number" && isFinite(x) ? x : p; }
  // a presença contínua de um técnico pelo bate dele: { ini (desde quando ele está sem buraco de mais de 12 s entre dois
  // bates, pela hora do SERVIDOR; null = desde sempre), falta (o último bate antes desse buraco; null = não se sabe) }. O
  // 1º bate depois do buraco se reconhece pelo `ant` (o anterior); os seguintes levam o `cont` e a `falta`. O bate sem
  // `ant` (o 1º da conta na sala, ou de uma versão anterior) conta como presença contínua.
  function corridaDe(b) {
    if (!b || typeof b.ts !== "number") return null;
    if (typeof b.ant !== "number") return { ini: null, falta: null };
    if (b.ts - b.ant > AUSENTE_MS) return { ini: b.ts, falta: b.ant };
    return { ini: typeof b.cont === "number" ? b.cont : null, falta: typeof b.falta === "number" ? b.falta : null };
  }
  function lista(x) {
    // o Firebase devolve como lista um nó de chaves 0..n (escal/0, vendas/12…): aceita os dois
    if (!x) return {};
    if (Array.isArray(x)) { var o = {}; x.forEach(function (v, i) { if (v != null) o[i] = v; }); return o; }
    return x;
  }
  // o texto canônico de um valor como o Firebase guarda (sem null nem vazio, lista = objeto de índices, chaves em ordem):
  // compara o que este aparelho montou com o que voltou do servidor
  function canon(v) {
    function n(x) {
      if (x == null || typeof x === "function") return null;
      if (typeof x === "number") return isFinite(x) ? x : null;
      if (typeof x !== "object") return x;
      var o = {}, tem = false, ks = Array.isArray(x) ? x.map(function (y, i) { return String(i); }) : Object.keys(x).sort();
      ks.forEach(function (k) { var y = n(x[k]); if (y != null) { o[k] = y; tem = true; } });
      return tem ? o : null;
    }
    return JSON.stringify(n(v));
  }
  function erroCod(codigo, msg) { var e = new Error(msg || textoMotivo(codigo)); e.codigo = codigo; return e; }
  function meuUid() {
    try { var me = TM.net && TM.net.me; if (me && me.uid) return String(me.uid); } catch (e) {}
    return "eu";
  }
  function meuNome() {
    try { var me = TM.net && TM.net.me; if (me && me.name) return String(me.name).slice(0, 16); } catch (e) {}
    try { var n = global.localStorage && global.localStorage.getItem("tm_online_name"); if (n) return String(n).slice(0, 16); } catch (e) {}
    return "Você";
  }
  // a identidade online: o uid do TM (net.me.uid: o da conta vinculada, se houver) e o uid da AUTENTICAÇÃO (o
  // auth.uid, que é o que as regras do Firebase conhecem: na conta vinculada são diferentes)
  function idPadrao() {
    var me = null, auth = null;
    try { me = TM.net && TM.net.ready && TM.net.me; } catch (e) { me = null; }
    if (!me || !me.uid) return null;
    try { auth = TM.net._auth && TM.net._auth.currentUser && TM.net._auth.currentUser.uid; } catch (e) { auth = null; }
    return { uid: String(me.uid), auth: String(auth || me.uid), nome: String(me.name || "Jogador").slice(0, 16), num: me.number || null };
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
  function cores() { var u = UT(); return ((u && u.CORES) || CORES_RESERVA).map(function (c) { return String(c).toLowerCase(); }); }
  // os bots: nome pelo perfil, clube inventado, cor que não repete a de ninguém, forma e símbolo sorteados. t0 = o índice
  // do 1º bot na ordem (o treino: 1, depois do dono; o online: depois de todas as pessoas); usadas = as cores das pessoas
  function identidadesBots(semente, n, usadas, t0, online) {
    var u = UT(), L = LE(), r = rngDe(semente, "bots"), tira = {};
    (usadas || []).forEach(function (c) { tira[String(c).toLowerCase()] = 1; });
    var cs = ((u && u.CORES) || CORES_RESERVA).filter(function (c) { return !tira[String(c).toLowerCase()]; });
    cs = embaralha(cs.slice(), r);
    var formas = embaralha(((u && u.FORMA_ORDEM) || ["classico"]).slice(), r);
    var simbs = embaralha(((u && u.SIMBOLOS) || ["tm-bola"]).filter(function (s) { return s !== "tm-bola"; }), r);
    if (!simbs.length) simbs = ["tm-bola"];
    var clubes = embaralha(CLUBES_BOT.slice(), r), usados = {}, out = [];
    for (var k = 0; k < n; k++) {
      var t = t0 + k, perfil = L.perfilRobo(semente, t).perfil, nome = null;
      (NOMES_BOT[perfil] || []).concat(NOMES_BOT_EXTRA).some(function (x) { if (!usados[x]) { nome = x; return true; } return false; });
      nome = nome || ("Bot " + (k + 1)); usados[nome] = 1;
      var cl = clubes[k % clubes.length];
      out.push({
        uid: "bot" + (k + 1), nome: nome, papel: "bot", pronto: true, entrou: online ? 100 + k : t,
        clube: { nome: cl[0], sigla: cl[1], cor: cs.length ? cs[k % cs.length] : CORES_RESERVA[k % CORES_RESERVA.length], escudo: formas[k % formas.length] + "|" + simbs[k % simbs.length] },
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

  /* ---------- a sala online: funções puras sobre o nó `sala` (rodam DENTRO das transações) ---------- */
  function humanosDe(s) { var tec = (s && s.tec) || {}; return Object.keys(tec).filter(function (u) { return tec[u] && tec[u].papel !== "bot"; }); }
  function botsDe(s) { var tec = (s && s.tec) || {}; return Object.keys(tec).filter(function (u) { return tec[u] && tec[u].papel === "bot"; }); }
  // as pessoas da sala estão prontas (o dono conta como pronto: é ele quem toca em Começar)
  function prontosDe(s) {
    var out = { prontos: 0, total: 0, faltam: [] };
    humanosDe(s).forEach(function (u) {
      var tc = s.tec[u]; out.total++;
      if (tc.papel === "dono" || tc.pronto) out.prontos++; else out.faltam.push(tc.nome || "Técnico");
    });
    return out;
  }
  function lotada(s) { return humanosDe(s).length + botsDe(s).length >= num(s.cfg && s.cfg.vagas, LE().TEC_MAX); }
  // os bots refeitos depois de qualquer mudança nas pessoas ou na quantidade: sempre depois delas na ordem, com o perfil
  // do índice final e cores que nenhuma pessoa usa
  function refazBots(s) {
    var L = LE(), tec = s.tec || {}, hs = humanosDe(s);
    botsDe(s).forEach(function (u) { delete tec[u]; });
    var nb = Math.max(0, Math.min(Math.floor(num(s.cfg && s.cfg.bots, 0)), L.TEC_MAX - hs.length));
    var usadas = hs.map(function (u) { return tec[u].clube && tec[u].clube.cor; });
    identidadesBots(s.meta.semente, nb, usadas, hs.length, true).forEach(function (b) {
      tec[b.uid] = { nome: b.nome, papel: "bot", pronto: true, entrou: b.entrou, clube: b.clube, formacao: b.formacao };
    });
    s.tec = tec;
    return s;
  }
  // a cor do clube que entra: a dele, se ninguém usa; senão a 1ª livre
  function corLivre(clube, s, uidDele) {
    var usadas = {};
    humanosDe(s).forEach(function (u) { if (u !== uidDele && s.tec[u].clube) usadas[String(s.tec[u].clube.cor).toLowerCase()] = 1; });
    var c = limpaClube(clube);
    if (!usadas[c.cor]) return c;
    var livre = cores().filter(function (x) { return !usadas[x]; })[0];
    if (livre) c.cor = livre;
    return c;
  }
  function proxEntrou(s) { var m = 0; humanosDe(s).forEach(function (u) { m = Math.max(m, num(s.tec[u].entrou, 0)); }); return m + 1; }

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
      // info.rede: a conexão de pé, mas a sala ainda não está em dia (a volta da página, o bate sem resposta)
      case "conexao": return info.rede === "atualizando" ? "Atualizando a sala…" : info.rede === "reconectando" ? "Reconectando…" : "Sem conexão: aguarde";
      case "conferindo": return "Conferindo…";
      case "outraAba": return "A sala está aberta em outro aparelho ou aba";
      case "codigo": return "O código tem 6 letras";
      case "naoExiste": return "Código não encontrado";
      case "recusado": return "O dono da sala recusou a sua entrada";
      case "cheia": return "A sala está cheia";
      case "edicao": return "Esta sala é da Season Update: libere a chave para entrar";
      case "edicaoAparelho": return "O Total Match está em outra edição: volte à edição da sala";
      case "regras": return "Esta sala usa outra versão das regras: atualize a página";
      case "fairplay": return "Você está suspenso do online por abandonar partidas";
      case "conta": return "A conta online ainda não está pronta";
      case "indisponivel": return "O online não está disponível agora";
      case "vencida": return "A sala expirou";
      case "apagada": return "A sala foi encerrada";
      case "dono": return "Só o dono da sala pode fazer isso";
      case "comecou": return "O leilão já começou";
      case "naoComecou": return "O leilão ainda não começou";
      case "prontos": return "Falta gente confirmar Pronto";
      case "poucos": return "São precisos pelo menos 2 técnicos";
      case "semPedido": return "Esse pedido não existe mais";
      case "cor": return "Essa cor já é de outro técnico";
      case "vagas": return "Vagas a menos que os técnicos da sala";
      case "liga": return "Liga desconhecida";
      case "mudou": return "A sala mudou: tente de novo";
      case "naoMembro": return "Você não é técnico desta sala";
      case "rede": return "Falha na conexão: tente de novo";
      case "naoCamp": return "O campeonato ainda não começou";
      case "campFim": return "O campeonato acabou";
      case "semJogo": return "Você não joga nesta rodada";
      case "naoEhSeu": return "Esse jogo não é seu";
      case "espera": return "Esse jogo ainda não abriu";
      case "jogando": return "Esse jogo já está sendo jogado";
      case "semPendentes": return "Nenhum jogo esperando por quem não está aqui";
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
    S.online = rede.tipo === "firebase" || !!opc.online;
    S.id = opc.id || null;              // online: { uid, auth, nome, num }
    S.sid = opc.sid || novoSid();       // esta aba (a mais recente da mesma conta age)
    S.eu = -1;
    S.uidEu = S.online && S.id ? S.id.uid : null;
    S.sala = null; S.lotesG = null; S.ctx = null; S.vivo = null; S.vivoN = null;
    S.escal = {}; S.vendas = {}; S.bates = {}; S.pres = {};
    // o campeonato: os jogos gravados, a versão (sobe a cada mudança), os nós já conferidos (o texto canônico) e o contexto
    S.jogos = {}; S._jogosVer = 0; S._jogosVisto = false; S._jogoOk = {}; S._jogoTxt = {}; S._feitoVisto = {}; S._camp = null; S._campV = null;
    S._rodadaVista = null; S.alteradaJogo = null;
    S.bots = [];
    S.atraso = Math.max(0, num(opc.atraso, 0));
    S._atrasoDin = S.online && opc.atraso == null;
    S.parado = false; S.alterada = null; S.soOlhar = false; S.apagada = false;
    S.outraAba = false; S.conferindo = null; S.pedido = null;
    S.ultimo = null;               // o último fechamento visto: { tipo: 'vendido'|'semLance', i, t, preco, seq }
    S._agendar = opc.agendar || function (fn, ms) { return setTimeout(fn, ms); };
    S._cancelar = opc.cancelar || function (h) { clearTimeout(h); };
    S._timer = null; S._ocupado = false; S._falhas = {}; S._cedo = 0;
    S._mudou = []; S._ev = {}; S._notifica = false; S._paraOuvir = [];
    S._relogio = opc._relogio || null;   // o relógio do treino (só de quem abriu a rede da memória)
    S._horaGravada = -1;
    S._euFixo = typeof opc.eu === "number";
    S._mundo = opc.mundo || null;
    S._opcOutras = opc.outrasSalas || null;     // testes: outra sala online do TM aberta neste aparelho
    // a edição deste aparelho (os ganchos de teste ou o TM.storage) e a do mundo que veio em opc.mundo
    S._opcEd = { edicao: opc.edicao, suUnlocked: opc.suUnlocked, trocarEdicao: opc.trocarEdicao };
    S._mundoEd = S._mundo ? opcEdicao(S._opcEd) : null;
    S._armazem = opc.armazem || null;
    S._doc = opc.doc || null;
    // o online: o batimento, a rede e a testemunha
    S._estadoBate = "ok"; S._bateEmVoo = false; S._timerBate = null; S._bateN = 0; S._meuBate = 0; S._desde = null;
    S._oculta = false; S._ocultaDesde = 0; S._twFila = null; S._aoOk = []; S._presArmada = false; S._euAntes = null;
    // a presença contínua desta conta (corridaDe): herdada do bate que está no servidor no 1º bate desta sessão
    S._cont = null; S._falta = null; S._herdar = true;
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
  // No online o relógio é o do servidor: nada segura (a página escondida segue a regra do ausente).
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
    if (S.online) return S._carregarOnline();
    return Promise.all(["sala", "lotes", "vivo", "relogio", "escal", "vendas", "jogos"].map(function (c) { return rede.ler(c); })).then(function (r) {
      var sala = r[0], lotes = r[1];
      if (!sala || !sala.meta) throw erroCod("naoExiste");
      if (!S.online && (!lotes || !lotes.l)) throw new Error("sala");
      S.sala = sala; S.lotesG = lotes && lotes.l ? lotes : null;
      S.treino = !!sala.meta.treino;
      S.soOlhar = sala.meta.regras !== L.REGRAS;
      S.escal = lista(r[4]); S.vendas = lista(r[5]);
      S.jogos = objJogos(r[6]); S._jogosVer++;
      if (opc && typeof opc.eu === "number") S.eu = opc.eu;
      else S._defineEu();
      S.uidEu = S.eu >= 0 ? S._ordem()[S.eu] : null;
      S._montaCtx();
      // o estado lido já vale para as telas (os ouvintes confirmam logo depois com o mesmo valor)
      if (r[2]) {
        if (S.ctx) { var c0 = L.conferir(null, r[2], S.ctx); if (c0.ok) { S.vivo = r[2]; S.vivoN = L.norm(r[2], S.ctx); S._vivoVisto = true; } else S.alterada = c0.motivo; }
        else S._vivoPend = r[2];
      }
      // o treino reaberto: o relógio volta de onde parou (nunca antes do que já está gravado)
      if (S._relogio && opc && opc.retomar) {
        var v = r[2] || {}, h = Math.max(num(r[3], 0), num(v.abre, 0), num(v.t, 0), num(sala.meta.atividade, 0), num(sala.meta.criada, 0),
          num(sala.meta.camp, 0), num(sala.meta.fimCamp, 0), horaJogos(S.jogos));
        if (h > 0) { S._relogio.h0 = h; S._relogio.r0 = S._relogio.base(); }
      }
      S._ouvir();
      return S;
    });
  };
  // o online carrega pelos próprios ouvintes (cada caminho baixa uma vez: os lotes são a maior parte dos bytes); o
  // motor só anda depois do 1º valor de todos (sem os batimentos, todo mundo pareceria ausente)
  P._carregarOnline = function () {
    var S = this;
    return new Promise(function (ok, falha) {
      var falta = { sala: 1, lotes: 1, vivo: 1, escal: 1, vendas: 1, jogos: 1, bate: 1, pres: 1 };
      S._carga = {
        visto: function (c) { if (!falta[c]) return; delete falta[c]; if (!Object.keys(falta).length) { S._carga = null; ok(); } },
        falha: function (e) { S._carga = null; falha(e); }
      };
      S._ouvir();
    }).then(function () {
      if (!S.sala || !S.sala.meta) { S.parar(true); throw erroCod("naoExiste"); }
      S._situacaoPedido();
      return S;
    }, function (e) { S.parar(true); throw e; });
  };
  P._visto = function (c) { if (this._carga) this._carga.visto(c); };
  P._ordem = function () {
    var s = this.sala;
    if (s && Array.isArray(s.ordem) && s.ordem.length) return s.ordem;
    return ordemPrevista(s);
  };
  // o índice desta sessão na ordem: o dono no treino; no online, o meu uid (muda no saguão, quando alguém entra)
  P._defineEu = function () {
    var S = this, s = S.sala;
    if (S._euFixo || !s || !s.meta) return;
    if (S.treino) S.eu = S._ordem().indexOf(s.meta.dono);
    else if (S.online) S.eu = S.id ? S._ordem().indexOf(S.id.uid) : -1;
    else S.eu = S._ordem().indexOf(meuUid());
  };
  P._montaCtx = function () {
    var S = this, L = LE(), s = S.sala, lt = S.lotesG;
    if (!s || !s.meta || !lt || !lt.l) return;
    if (!S.treino && S.online && s.meta.estado === "saguao") return;     // os lotes do saguão ainda podem mudar
    var ordem = S._ordem(), T = ordem.length;
    if (S.ctx && S.ctx.T === T) return;
    if (lt.l.length !== L.LOTES_POR_TEC * T) return;                     // os lotes de outra lotação (ainda chegando)
    if (S.online) {
      // os lotes de outra liga ou de outra edição que a da sala, ou (no aparelho do dono) outros que os que ele gravou no
      // Começar (trocados entre as duas transações): a sala congela
      var edS = s.meta.edicao === "pro" ? "pro" : "public";
      if ((lt.liga != null && s.cfg && lt.liga !== s.cfg.liga) || (lt.ed != null && lt.ed !== edS) || (S._lotesMeus && canon(lt) !== S._lotesMeus)) { S._congela("lotes"); return; }
    }
    S.ctx = L.contexto({ T: T, lotes: lt.l, fora: lt.f || [], semente: s.meta.semente, tempo: s.cfg && s.cfg.tempo });
    S._lotesJson = S.online ? JSON.stringify(lt) : null;
    S.bots = [];
    ordem.forEach(function (uid, t) {
      var tc = s.tec && s.tec[uid];
      if (tc && tc.papel === "bot") S.bots.push(L.perfilRobo(S.ctx.semente, t));
    });
    if (S._vivoPend) { var v = S._vivoPend; S._vivoPend = null; S._naVivo(v); }
  };
  P._ouvir = function () {
    var S = this, rede = S.rede;
    function erro(e) { if (S._carga) S._carga.falha(e); else if (global.console) console.error(e); }
    S._paraOuvir.push(rede.ouvir("sala", function (v) { S._naSala(v); S._visto("sala"); }, erro));
    S._paraOuvir.push(rede.ouvir("vivo", function (v) { S._naVivo(v); S._visto("vivo"); }, erro));
    S._paraOuvir.push(rede.ouvir("escal", function (v) { S.escal = lista(v); S._notificar(); S._programa(); S._visto("escal"); }, erro));
    S._paraOuvir.push(rede.ouvir("vendas", function (v) { S.vendas = lista(v); S._notificar(); S._visto("vendas"); }, erro));
    S._paraOuvir.push(rede.ouvir("jogos", function (v) { S._naJogos(v); S._visto("jogos"); }, erro));
    if (S.online) {
      S._paraOuvir.push(rede.ouvir("lotes", function (v) { S._naLotes(v); S._visto("lotes"); }, erro));
      S._paraOuvir.push(rede.ouvir("bate", function (v) { S.bates = v || {}; S._naBate(); S._visto("bate"); }, erro));
      S._paraOuvir.push(rede.ouvir("pres", function (v) { S.pres = v || {}; S._notificar(); S._visto("pres"); }, erro));
      if (rede.aoVoltar) S._paraOuvir.push(rede.aoVoltar(function () { S._naVolta(); }));
      if (rede.aoCair) S._paraOuvir.push(rede.aoCair(function () { S._naQueda(); }));
    } else if (rede.aoCair) S._paraOuvir.push(rede.aoCair(function () { S._notificar(); }));
  };
  P._naSala = function (s) {
    var S = this;
    if (S.parado) return;
    if (!s && S._carga) return;            // a sala que não existe: a carga recusa
    if (!s) {
      S.sala = null; S._limpaTimer();
      if (S.online) {
        S.apagada = true; S._emite("apagada", {}); esquecer(S.codigo, S._armazem); S.parar(true);
        // o que este aparelho ainda tinha a caminho (o bate da testemunha, a presença, um registro de venda) chega ao
        // servidor DEPOIS de a sala sumir e recriaria leiloes/{código}/bate… para sempre: apagar a sala de novo pelo
        // mesmo socket (ordenado) vem depois de tudo isso. Apagar não recria nada.
        if (S.rede.varrer) { try { S.rede.varrer(); } catch (e) {} }
      }
      S._notificar(); return;
    }
    var antes = S.sala ? S.sala.meta && S.sala.meta.estado : undefined, euAntes = S.eu;
    S.sala = s;
    S.soOlhar = s.meta && s.meta.regras !== LE().REGRAS;
    S._defineEu();
    if (s.ordem && S.ctx && S.ctx.T !== s.ordem.length) S._montaCtx();
    if (!S.ctx) S._montaCtx();
    if (antes !== undefined && antes !== (s.meta && s.meta.estado)) {
      S._emite("estado", { estado: s.meta && s.meta.estado });
      if (s.meta && s.meta.estado === "camp") S._checaRodada(false);
    }
    S._confereJogos();
    if (S.online && !S._carga) {
      S._situacaoPedido(euAntes);
      if (S.parado) return;
      S._guardaIndice();
    }
    S._notificar(); S._programa();
  };
  // online: o pedido de quem ainda não é da sala (aceito, recusado) e quem deixou de ser (tirado, o clube passado)
  P._situacaoPedido = function (euAntes) {
    var S = this, s = S.sala, uid = S.uidEu;
    if (!S.online || !s || !uid || S._euFixo || S._saindo) return;
    var membro = !!(s.tec && s.tec[uid]), pedido = !!(s.pedidos && s.pedidos[uid]), recusado = !!(s.recusados && s.recusados[uid]);
    if (membro) {
      if (S.pedido) { S.pedido = null; S._emite("aceito", {}); S._ligaOnline(); }
      S._foiMembro = true;
      return;
    }
    if (pedido) { S.pedido = { estado: "esperando", depois: !!s.pedidos[uid].depois }; return; }
    // não é membro nem tem pedido
    if (S._foiMembro) {
      var depoisDoComeco = Array.isArray(s.ordem) && s.ordem.length;
      S._foiMembro = false;
      S._emite(depoisDoComeco ? "passado" : "tirado", {});
      esquecer(S.codigo, S._armazem);
      // tirado no saguão: a sessão acaba; o clube passado para outra conta: esta fica só olhando
      if (!depoisDoComeco || recusado) S.parar(true);
      else { S._paraBate(); S._tiraPresenca(); }
      return;
    }
    if (recusado) { S.pedido = { estado: "recusado" }; S._emite("recusado", {}); esquecer(S.codigo, S._armazem); S.parar(true); return; }
    if (S.pedido && S.pedido.estado === "esperando") { S.pedido = { estado: "sumiu" }; }
  };
  P._naLotes = function (v) {
    var S = this;
    if (S.parado) return;
    if (!S.ctx) { S.lotesG = v && v.l ? v : null; S._montaCtx(); S._notificar(); S._programa(); return; }
    // depois do Começar os lotes não mudam: mudou = adulterado
    if (!v || JSON.stringify(v) !== S._lotesJson) S._congela("lotes");
  };
  P._temVendas = function () { var vd = this.vendas || {}; return Object.keys(vd).some(function (k) { return vd[k] != null; }); };
  // o vivo apagado depois de existir (ou o vivo que falta com vendas gravadas): confere se a SALA ainda existe (com a sala
  // inteira apagada, o evento do vivo pode chegar antes do da sala) e, se existe, congela. Até a resposta, nada age.
  P._vivoSumiu = function () {
    var S = this;
    if (S._sumiu || S.alterada) return;
    S._sumiu = true; S._limpaTimer();
    S.rede.ler("sala").then(function (s) {
      if (S.parado) return;
      if (!s || !s.meta) return;            // a sala inteira sumiu: o _naSala encerra
      S._congela("vivo");
    }, function () { if (!S.parado) S._congela("vivo"); });
  };
  P._congela = function (motivo) {
    var S = this;
    if (S.alterada) return;
    S.alterada = motivo || "estrutura";
    S._limpaTimer();
    S._emite("alterada", { motivo: S.alterada });
    if (S.online) S._guardaIndice();
    S._notificar();
  };
  P._naVivo = function (v) {
    var S = this, L = LE(), ctx = S.ctx;
    if (S.parado) return;
    if (!ctx) { S._vivoPend = v; return; }
    var ant = S.vivo;
    if (v == null) {
      // o vivo que já existiu e sumiu (alguém apagou só ele): o leilão NÃO recomeça do zero; a sala congela (a sala
      // inteira apagada é o _naSala que trata)
      if (S._vivoVisto || S._temVendas()) { S._vivoSumiu(); return; }
      S.vivo = null; S.vivoN = null; S._notificar(); S._programa(); return;
    }
    if (S._sumiu) return;
    var c = L.conferir(ant, v, ctx);
    if (!c.ok) { S._congela(c.motivo); return; }
    S._vivoVisto = true;
    S.vivo = v; S.vivoN = L.norm(v, ctx);
    S._eventos(ant ? L.norm(ant, ctx) : null, S.vivoN);
    S._formacaoAuto();
    S._confereJogos();
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
          if (S.online) S._completaVenda(a.i, dono, preco, a.seq);
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
    if (S.eu < 0 || S.soOlhar || (S.online && !S._ativo())) return;
    var e = S.escalacao(S.eu), atual = (S.escal[S.eu] || {}).formacao || S._prefPadrao(S.eu);
    if (e && e.formacao && e.formacao !== atual) {
      S.rede.atualizar("escal/" + S.eu, { formacao: e.formacao, tit: null });
      S._emite("formacao", { de: atual, para: e.formacao });
    }
  };

  /* ---------- o campeonato: os jogos gravados, a vista e a conferência ---------- */
  // o contexto do campeonato (leilao-camp.js) a partir da sala, dos lotes e do vivo no fim; só no estado camp/fim. Os
  // campos que mudam (as escalações, quem saiu) são refeitos a cada chamada; o calendário fica no cache do contexto
  P._campCtx = function () {
    var S = this, s = S.sala, v = S.vivoN;
    if (!LC() || !s || !s.meta || !S.ctx || !v || v.fase !== "fim") return null;
    var est = s.meta.estado;
    if (est !== "camp" && est !== "fim") return null;
    var ordem = S._ordem(), T = S.ctx.T, fmt = formatoDe(s.cfg && s.cfg.formato), sem = String(s.meta.semente);
    var c = S._camp;
    if (!c || c.T !== T || c.formato !== fmt || c.semente !== sem || c.codigo !== String(S.codigo)) c = S._camp = LC().contexto({ codigo: S.codigo, semente: sem, formato: fmt, T: T });
    c.ctx = S.ctx; c.vivo = S.vivo; c.inicio = num(s.meta.camp, 0); c.escal = S.escal || {};
    c.clubes = []; c.nomes = []; c.tipos = []; c.prefs = [];
    ordem.forEach(function (uid, t) {
      var tc = (s.tec && s.tec[uid]) || {};
      c.clubes[t] = tc.clube || limpaClube(null);
      c.nomes[t] = tc.nome || ("Técnico " + (t + 1));
      // quem saiu da sala ("Sair da sala") não volta: os jogos dele andam como os de um bot
      c.tipos[t] = tc.papel === "bot" || tc.saiu ? "bot" : "pessoa";
      c.prefs[t] = S._prefPadrao(t);
    });
    return c;
  };
  // a vista do campeonato (montar) dos jogos GRAVADOS; refeita só quando os jogos (ou o começo) mudam
  P._vista = function () {
    var S = this, c = S._campCtx();
    if (!c) return null;
    var k = S._jogosVer + "|" + c.inicio + "|" + c.formato + "|" + c.T;
    if (S._campV && S._campV.k === k) return S._campV.V;
    var V = LC().montar(c, S.jogos || {});
    S._campV = { k: k, V: V };
    return V;
  };
  P._naJogos = function (v) {
    var S = this;
    if (S.parado) return;
    var js = objJogos(v), ant = S.jogos || {};
    // o nó inteiro que some depois de ter jogos (alguém apagou só ele): a sala congela, como o vivo
    if (!Object.keys(js).length && Object.keys(ant).length && S._jogosVisto) { S.jogos = js; S._jogosVer++; S.alteradaJogo = { id: null, motivo: "sumiu" }; S._congela("jogos"); return; }
    S.jogos = js; S._jogosVer++;
    var primeiro = !S._jogosVisto;
    S._jogosVisto = true;
    S._confereJogos();
    if (!S.alterada) {
      if (!primeiro) S._eventosCamp(ant);
      S._checaRodada(primeiro);
    }
    S._notificar(); S._programa();
  };
  // o evento do jogo gravado agora (não na carga: aí tudo já estava gravado)
  P._eventosCamp = function (ant) {
    var S = this, V = S._vista();
    if (!V) return;
    V.rodadas.forEach(function (R) {
      R.jogos.forEach(function (g) {
        var a = ant[g.id];
        if (g.e === "feito" && !(a && a.e === "feito")) S._emite("jogo", { id: g.id, a: g.a, b: g.b, placar: g.placar, venc: g.venc, eu: S.eu >= 0 && (g.a === S.eu || g.b === S.eu) });
      });
    });
  };
  // o evento da rodada que abriu (a 1ª abre quando a sala chega ao camp; as outras, quando a anterior acaba); na carga
  // (calado) só guarda a rodada da vez
  P._checaRodada = function (calado) {
    var S = this, V = S._vista();
    if (!V) return;
    var atual = V.atual >= 0 ? V.rodadas[V.atual].n : -1;
    if (S._rodadaVista == null && calado) { S._rodadaVista = atual; return; }
    if (atual >= 0 && atual !== S._rodadaVista) S._emite("rodada", { n: atual, nome: V.rodadas[V.atual].nome });
    S._rodadaVista = atual;
  };
  // a conferência dos jogos (§3.3): cada nó novo ou mudado é conferido UMA vez (o texto canônico guardado): os times da
  // vez, as escalações gravadas (só jogadores do técnico, nas vagas dos grupos dele) e o simulado RECALCULADO com a semente;
  // o feito que muda, o jogo que some ou um id fora do calendário congelam a sala. Antes do campeonato (sem o contexto),
  // espera: confere quando a sala chegar ao camp.
  P._confereJogos = function () {
    var S = this, js = S.jogos || {};
    if (S.alterada || S.parado || !Object.keys(js).length) return;
    var c = S._campCtx(), V = c ? S._vista() : null;
    if (!c || !V) return;
    var ok = S._jogoOk, porId = {};
    V.rodadas.forEach(function (R) { R.jogos.forEach(function (g) { porId[g.id] = g; }); });
    function falha(id, motivo) { S.alteradaJogo = { id: id, motivo: motivo }; S._congela("jogos"); }
    var ks = Object.keys(ok);
    for (var i = 0; i < ks.length; i++) if (js[ks[i]] == null) return falha(ks[i], "sumiu");
    var nos = Object.keys(js);
    for (var n = 0; n < nos.length; n++) {
      var id = nos[n], j = js[id];
      if (j == null) continue;
      var g = porId[id];
      if (!g) return falha(id, "id");
      // o atalho: o mesmo texto da última vez (o mesmo aparelho entrega o nó igual) = já conferido
      var tj = JSON.stringify(j);
      if (S._jogoTxt[id] === tj) continue;
      var cj = canon(j);
      if (ok[id] === cj) { S._jogoTxt[id] = tj; continue; }
      // a máquina só anda para a frente: o feito não muda; o reservado só vira o feito dele (a mesma trava, os mesmos
      // times e escalações): voltar o reservado ao aberto daria uma trava nova, outro sorteio (o "jogar de novo")
      var visto = S._feitoVisto[id];
      if (visto === "feito") return falha(id, "feito");
      if (visto && visto.e === "reservado" && !(j.e === "feito" && j.trava === visto.trava && canon(j.esc) === visto.esc && canon(j.ab) === visto.ab && j.modo === visto.modo)) return falha(id, "volta");
      var m = LC().conferirJogo(c, g, j);
      if (m) return falha(id, m);
      ok[id] = cj; S._jogoTxt[id] = tj;
      if (j.e === "feito") S._feitoVisto[id] = "feito";
      else if (j.e === "reservado") S._feitoVisto[id] = { e: "reservado", trava: j.trava, esc: canon(j.esc), ab: canon(j.ab), modo: j.modo };
    }
  };
  // o meu jogo da rodada da vez (null: folga, eliminado ou o fim)
  P._meuJogo = function (V) {
    var S = this;
    if (!V || S.eu < 0 || V.atual < 0) return null;
    var R = V.rodadas[V.atual];
    for (var k = 0; k < R.jogos.length; k++) if (R.jogos[k].a === S.eu || R.jogos[k].b === S.eu) return R.jogos[k];
    return null;
  };
  P._souDono = function () {
    var S = this, s = S.sala;
    if (!s || !s.meta || S.eu < 0) return false;
    if (!S.online) return S._ordem()[S.eu] === s.meta.dono;
    return !!(S.uidEu && s.meta.dono === S.uidEu);
  };
  // o dono fora da sala há mais de 5 min (pelo último bate dele, na hora `agora`; saiu da sala = fora): sem ele, o
  // "Simular os pendentes" passa a qualquer técnico presente (senão a rodada que espera pelo dono nunca andaria)
  P._donoFora = function (agora) {
    var S = this, s = S.sala, dono = s && s.meta && s.meta.dono, tc = dono && s.tec && s.tec[dono];
    if (!S.online || !tc) return false;
    if (tc.saiu) return true;
    var b = S.bates && S.bates[dono], visto = b && typeof b.ts === "number" ? b.ts : num(s.meta.camp, 0);
    return agora - visto >= DONO_FORA_MS;
  };
  // quem pode tocar em "Simular os pendentes" agora: 'dono', 'outro' (o dono fora há mais de 5 min) ou null
  P._quemPendentes = function (agora) {
    var S = this;
    if (!S.online || S.eu < 0 || S.soOlhar) return null;
    if (S._souDono()) return "dono";
    return S._donoFora(agora) ? "outro" : null;
  };
  /** Os jogos da rodada da vez que esperam por quem está AUSENTE (o jogo de uma pessoa contra um bot com ela fora: o prazo
   *  parado ou o jogo nem aberto): [{ id, a, b, t (quem não está aqui) }]. Bot × bot e (até o PR 5) amigo × amigo são
   *  simulados ao abrir a rodada; o jogo de quem está aqui tem o "Simular partida" dele (o meu também); o reservado é
   *  gravado por qualquer aparelho e o 3D em andamento (PR 4) fica. */
  P._pendentes = function (V, agora) {
    var S = this, c = S._campCtx(), out = [];
    if (!S.online || !c || !V || V.fim || V.atual < 0) return out;
    V.rodadas[V.atual].jogos.forEach(function (g) {
      if (!g.aberta || g.e === "feito" || g.a == null || g.b == null || g.invalido || (g.j && g.j.e === "reservado")) return;
      if (LC().confronto(c, g) !== "pessoaBot") return;
      var p = c.tipos[g.a] === "pessoa" ? g.a : g.b;
      if (p === S.eu || !S._ausente(p, agora)) return;
      out.push({ id: g.id, a: g.a, b: g.b, t: p });
    });
    return out;
  };

  // o registro da venda é de quem fechou o lote; se ele caiu antes de gravar, qualquer presente grava o mesmo valor
  // depois de 3 s (escalonado como o resto): a verdade continua sendo o vivo.d
  P._completaVenda = function (i, t, preco, seq) {
    var S = this;
    S._agendar(function () {
      if (S.parado || !S._ativo() || (S.vendas && S.vendas[i])) return;
      S.rede.gravar("vendas/" + i, { t: t, v: preco, s: seq }).then(null, function () {});
    }, 3000 + S._atrasoAgora(S.hora()));
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

  /* ---------- online: presença, batimento, testemunha e a rede ---------- */
  // esta sessão age (o motor e as ações da pessoa): no online, só com a conexão, à vista, a aba mais recente e técnico
  P._ativo = function () {
    var S = this;
    if (!S.online) return true;
    return !S.parado && !S.outraAba && !S._oculta && S.eu >= 0 && !S.pedido && S.rede.conectado() && S._emDia();
  };
  // a rede em dia (o último bate teve ack) e os relógios sem salto: um relógio que pulou (o aparelho dormiu e o monótono
  // parou) deixa a hora estimada errada até a próxima testemunha; aí a sessão não decide nada e pede uma na hora
  P._emDia = function () {
    var S = this;
    if (S._estadoBate !== "ok") return false;
    var sl = S.rede.salto ? S.rede.salto() : 0;
    if (Math.abs(sl) > SALTO_MS) {
      S._estadoBate = "atualizando"; S._bateEmVoo = false; S._bateN++;
      if (!S._pedeBate) { S._pedeBate = true; Promise.resolve().then(function () { S._pedeBate = false; S._bater(); S._notificar(); }); }
      return false;
    }
    return true;
  };
  P._estadoRede = function () {
    if (!this.online) return "ok";
    if (!this.rede.conectado()) return "offline";
    return this._estadoBate;
  };
  P._defBate = function (estado) {
    var S = this, antes = S._estadoBate;
    S._estadoBate = estado;
    if (antes === estado) return;
    if (estado === "ok") { var fs = S._aoOk; S._aoOk = []; fs.forEach(function (fn) { try { fn(); } catch (e) { if (global.console) console.error(e); } }); }
    S._emite("rede", { rede: S._estadoRede() });
    S._notificar();
  };
  // a próxima vez que a rede ficar em dia (o ack de um bate depois da volta: o que veio antes dele já chegou)
  P._quandoEmDia = function () {
    var S = this;
    return new Promise(function (ok) { S._aoOk.push(ok); });
  };
  // a testemunha da hora, uma de cada vez (duas ao mesmo tempo no mesmo caminho se atrapalham: a leitura de depois do
  // ack de uma veria o valor local da outra)
  P._testemunha = function () {
    var S = this, rede = S.rede, uid = S.uidEu, ant = null;
    var p = (S._twFila || Promise.resolve()).then(function () {
      // o bate anterior desta conta (o deste aparelho com ack ou, mais novo, o que está no servidor: outra aba, a sessão
      // antes de recarregar) e a corrida dele, herdada no 1º bate desta sessão
      var b = S.bates && S.bates[uid];
      if (S._herdar) { var c = corridaDe(b); S._cont = c ? c.ini : null; S._falta = c ? c.falta : null; S._herdar = false; }
      ant = Math.max(S._meuBate, num(b && b.ts, 0)) || null;
      var extra = { sid: S.sid, desde: S._desde != null ? S._desde : rede.TS };
      if (ant != null) extra.ant = ant;
      if (S._cont != null) extra.cont = S._cont;
      if (S._falta != null) extra.falta = S._falta;
      return rede.testemunha("bate/" + uid, extra);
    });
    S._twFila = p.then(null, function () {});
    return p.then(function (ts) {
      if (ts != null) {
        S._meuBate = Math.max(S._meuBate, ts); if (S._desde == null) S._desde = ts;
        // um buraco de mais de 12 s desde o bate anterior (pela hora do servidor): a presença recomeça aqui
        if (ant != null && ts - ant > AUSENTE_MS) { S._cont = ts; S._falta = ant; }
      }
      return ts;
    });
  };
  P._limpaBate = function () { if (this._timerBate != null) { this._cancelar(this._timerBate); this._timerBate = null; } };
  P._paraBate = function () { this._limpaBate(); };
  // o batimento: a cada 5 s com a página à vista; sem ack em 3 s, "Reconectando…"
  P._bater = function () {
    var S = this;
    if (!S.online || S.parado) return;
    S._limpaBate();
    if (S.outraAba) { S._timerBate = S._agendar(function () { S._timerBate = null; S._checaOutra(); }, BATE_MS); return; }
    if (S._oculta || S.eu < 0 || S.pedido || !S.uidEu) return;
    if (!S._bateEmVoo) {
      S._bateEmVoo = true;
      var meu = ++S._bateN;
      var t3 = S._agendar(function () {
        if (!S._bateEmVoo || meu !== S._bateN || S.parado || S.eu < 0) return;
        S._defBate("reconectando");
        // de volta depois de escondida e o bate sem resposta: o socket ficou meio aberto (o iPhone faz isso). Só então
        // derruba e refaz a conexão, e nunca com outra sala online do TM aberta (o goOffline vale para o TM inteiro: o
        // servidor rodaria o onDisconnect das salas do Online 3D e dos outros modos)
        if (S._desconfia) { S._desconfia = false; if (S.rede.conectado() && !S._outrasSalas()) S.reconectar(); }
      }, ACK_MS);
      S._testemunha().then(function (ts) {
        if (meu === S._bateN) S._bateEmVoo = false;
        S._cancelar(t3);
        if (S.parado) return;
        if (ts != null) { S._desconfia = false; S._defBate("ok"); S._programa(); }
      }, function (e) {
        if (meu === S._bateN) S._bateEmVoo = false;
        S._cancelar(t3);
        // a recusa por permissão (o .validate opcional publicado) não é queda de conexão: é o batimento que estava a caminho
        // quando esta conta deixou de ser da sala (o clube passado a outro aparelho, tirado); a sala nova chega e ela só olha
        if (!S.parado && !(e && e.codigo === "permissao") && S.eu >= 0) S._defBate("reconectando");
      });
    }
    S._timerBate = S._agendar(function () { S._timerBate = null; S._bater(); }, BATE_MS);
  };
  // presença por conexão: pres/{uid}/{sid}, apagada pelo servidor quando a conexão cai (rearmada a cada volta)
  P._armaPresenca = function () {
    var S = this, rede = S.rede;
    if (!S.online || S.parado || S.eu < 0 || S.pedido || !S.uidEu || !rede.aoDesconectar) return;
    var cam = "pres/" + S.uidEu + "/" + S.sid;
    S._presArmada = true;
    rede.aoDesconectar(cam).apagar().then(null, function () {});
    rede.gravar(cam, true).then(null, function () {});
  };
  P._tiraPresenca = function () {
    var S = this, rede = S.rede;
    if (!S.online || !S._presArmada || !S.uidEu) return;
    S._presArmada = false;
    var cam = "pres/" + S.uidEu + "/" + S.sid;
    try { rede.gravar(cam, null).then(null, function () {}); rede.aoDesconectar(cam).cancelar().then(null, function () {}); } catch (e) {}
  };
  // começa o online desta sessão (técnico da sala): presença, batimento, visibilidade
  P._ligaOnline = function () {
    var S = this;
    if (!S.online || S.parado || S.eu < 0 || S.pedido) return;
    if (!S._presArmada) S._armaPresenca();
    S._bater();
  };
  P._naQueda = function () {
    var S = this;
    if (S.parado) return;
    S._estadoBate = "atualizando";
    S._limpaTimer();
    S._emite("rede", { rede: S._estadoRede() });
    S._notificar();
  };
  P._naVolta = function () {
    var S = this;
    if (S.parado) return;
    S._estadoBate = "atualizando";
    S._bateEmVoo = false; S._bateN++;
    S._presArmada = false;
    S._ligaOnline();
    S._emite("rede", { rede: S._estadoRede() });
    S._notificar(); S._programa();
  };
  // o bate de outra aba ou aparelho da MESMA conta, que abriu depois desta: esta para de agir (outraAba)
  P._naBate = function () {
    var S = this, b = S.bates[S.uidEu];
    if (S.parado) return;
    if (S.online && S.uidEu && b && b.sid && b.sid !== S.sid && !S.outraAba && typeof b.ts === "number" && b.ts > S._meuBate &&
        S._desde != null && num(b.desde, b.ts) > S._desde) {
      S.outraAba = true; S._limpaTimer();
      S._emite("outraAba", {});
      S._bater();                          // daqui em diante, só confere se a outra sumiu
    }
    S._notificar(); S._programa();
  };
  // com outra aba no comando: a cada 5 s confere se ela sumiu (sem bate fresco) e, se sumiu, esta volta a agir
  P._checaOutra = function () {
    var S = this, b = S.bates[S.uidEu];
    if (S.parado || !S.outraAba) return;
    if (!b || b.sid === S.sid || S.hora() - num(b.ts, 0) > AUSENTE_MS) { S.assumir(); return; }
    S._timerBate = S._agendar(function () { S._timerBate = null; S._checaOutra(); }, BATE_MS);
  };
  /** A pessoa quer usar ESTA aba (a outra para de agir quando vir o bate desta). */
  P.assumir = function () {
    var S = this;
    if (!S.online || S.parado) return;
    S.outraAba = false; S._desde = null; S._bateEmVoo = false; S._bateN++; S._herdar = true;
    S._ligaOnline(); S._programa(); S._notificar();
  };
  /** Derruba e refaz a conexão (o socket meio aberto do iPhone). */
  P.reconectar = function () { var S = this; if (!S.online) return; S._estadoBate = "atualizando"; try { S.rede.reconectar(); } catch (e) {} S._notificar(); };
  // a página: escondida, não bate (vira ausente para os outros); de volta depois de > 5 s, reconecta e "Atualizando…"
  P._visivel = function (sim) {
    var S = this;
    if (!S.online || S.parado) return;
    if (!sim) {
      if (S._oculta) return;
      S._oculta = true; S._ocultaDesde = S.hora(); S._limpaBate(); S._limpaTimer(); S._notificar();
      return;
    }
    if (!S._oculta) return;
    S._oculta = false;
    // o socket costuma estar bom: "Atualizando…" até o ack do próximo bate; sem ack em 3 s, o _bater reconecta
    if (S.hora() - S._ocultaDesde > VOLTA_MS) { S._estadoBate = "atualizando"; S._bateEmVoo = false; S._bateN++; S._desconfia = true; }
    S._bater(); S._programa(); S._notificar();
  };
  // outra sala online do TM aberta neste aparelho (o Online 3D, a fila do aleatório): o goOffline derrubaria as dela
  P._outrasSalas = function () {
    if (this._opcOutras) { try { return !!this._opcOutras(); } catch (e) { return false; } }
    try { var e3 = TM.online3d && TM.online3d.estado && TM.online3d.estado(); if (e3 && e3.fase) return true; } catch (e) {}
    try { if (TM.net && TM.net._mmA) return true; } catch (e) {}
    return false;
  };
  P._bateFresco = function (uid, agora) { var b = this.bates[uid]; return !!b && typeof b.ts === "number" && agora - b.ts <= AUSENTE_MS; };
  // o técnico t está ausente (passa sozinho): saiu da sala, ou sem bate fresco (esta sessão, ativa, nunca)
  P._ausente = function (t, agora) {
    var S = this, uid = S._ordem()[t], tc = S.sala && S.sala.tec && S.sala.tec[uid];
    if (!tc || tc.papel === "bot") return false;
    if (tc.saiu) return true;
    if (t === S.eu && S._ativo()) return false;
    return !S._bateFresco(uid, agora);
  };
  // as pessoas presentes (índices na ordem): quem age primeiro na escala
  P._presentes = function (agora) {
    var S = this, out = [];
    S._ordem().forEach(function (uid, t) { var tc = S.sala.tec && S.sala.tec[uid]; if (tc && tc.papel !== "bot" && !S._ausente(t, agora)) out.push(t); });
    return out;
  };
  P._atrasoAgora = function (agora) {
    var S = this;
    if (!S._atrasoDin) return S.atraso;
    var ps = S._presentes(agora), k = ps.indexOf(S.eu);
    return ESCALONA_MS * (k < 0 ? ps.length : k);
  };
  // quando a sala vence (a limpeza, §1.1): 30 min parada no saguão, 24 h sem atividade (o bate desta aba não conta, menos
  // no campeonato: com alguém na sala, o campeonato em andamento não some — nem o que espera por um ausente)
  P._vencimento = function () {
    var S = this, s = S.sala;
    if (!S.online || !s || !s.meta) return null;
    var atv = Math.max(num(s.meta.atividade, 0), num(s.meta.criada, 0), num(s.meta.camp, 0), num(s.meta.fimCamp, 0)), v = S.vivoN;
    if (v) atv = Math.max(atv, v.abre, v.t);
    // no campeonato, cada passo de um jogo (abrir, retomar, reservar, gravar) é atividade (a conta só muda com os jogos)
    if (!S._horaJ || S._horaJ.ver !== S._jogosVer) S._horaJ = { ver: S._jogosVer, h: horaJogos(S.jogos) };
    atv = Math.max(atv, S._horaJ.h);
    Object.keys(S.bates || {}).forEach(function (u) {
      var b = S.bates[u], tc = s.tec && s.tec[u];
      if (b && tc && tc.papel !== "bot" && b.sid !== S.sid) atv = Math.max(atv, num(b.ts, 0));
    });
    if (s.meta.estado === "camp") atv = Math.max(atv, S._meuBate);
    return atv + (s.meta.estado === "saguao" ? SAGUAO_MS : VIDA_MS);
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
  // a "cara" do estado que o motor viu (o vivo e a fase da sala): a mesma cara = a mesma decisão
  P._chave = function () {
    var v = this.vivoN, s = this.sala;
    return (s && s.meta ? s.meta.estado : "-") + "|" + (v ? v.seq + ":" + v.n + ":" + v.p + ":" + v.fase : "nulo") + "|" + this._jogosVer;
  };
  P._programa = function () {
    var S = this, L = LE(), ctx = S.ctx;
    S._limpaTimer();
    if (S.parado || S.alterada || S._sumiu || S.soOlhar || !S.sala || !S.sala.meta || S.pausado()) return;
    if (S._ocupado) return;              // a ação em curso chama o _programa quando termina
    if (S.online && (S._carga || !S._ativo())) return;
    var est = S.sala.meta.estado, agora = S.hora(), atraso = S._atrasoAgora(agora);
    // depois do Começar o vivo só falta antes do 1º (e sem venda nenhuma): faltando depois disso, foi apagado
    if (ctx && !S.vivo && est !== "saguao" && (est !== "leilao" || S._vivoVisto || S._temVendas())) { S._vivoSumiu(); return; }
    var prox = null;
    function cand(q, tipo, extra) { if (!prox || q < prox.quando) { prox = extra || {}; prox.quando = q; prox.tipo = tipo; } }
    // a sala vencida primeiro: quem volta depois de 24 h não faz o leilão andar, apaga
    var venc = S.online ? S._vencimento() : null;
    if (venc != null && agora >= venc) { S._agenda(atraso, function () { S._acao("limpeza", { prazo: venc }); }); return; }
    if (est === "leilao" && ctx) {
      if (!S.vivo) { S._agenda(atraso, function () { S._acao("inicial", {}); }); return; }
      var v = S.vivoN;
      if (v.fase === "fim") { S._agenda(atraso, function () { S._acao("escalacao", {}); }); return; }
      var fim = L.fimDoLote(v, ctx), seq = v.seq, n = v.n, todos = L.todosPassaram(v, ctx);
      if (todos || agora >= fim) { S._agenda(atraso, function () { S._acao("fechar", { seq: seq, prazo: todos ? null : fim }); }); return; }
      cand(fim, "fechar", { seq: seq, prazo: fim });
      S.bots.forEach(function (b) {
        if (S._falhas[seq + ":" + n + ":" + b.t]) return;
        var a = L.robo(v, ctx, b);
        if (a) cand(a.quando, "robo", { seq: seq, n: n, bot: b });
      });
      // quem sumiu passa sozinho (§1.4): a partir de quando o lote libera ou de 12 s depois do último bate dele
      if (S.online) S._ordem().forEach(function (uid, t) {
        var tc = S.sala.tec && S.sala.tec[uid];
        if (!tc || tc.papel === "bot" || (t === S.eu && S._ativo())) return;
        if (!L.pode(v, ctx, t).pode) return;
        var b = S.bates[uid], q = Math.max(v.abre + ctx.espera, tc.saiu ? 0 : num(b && b.ts, 0) + AUSENTE_MS);
        // a testemunha já disse que ela está (o relógio daqui está adiantado): só com um bate novo dela
        if (!tc.saiu && S._voltou && S._voltou[uid] === num(b && b.ts, 0)) return;
        cand(q, "ausente", { seq: seq, t: t, prazo: q });
      });
    } else if (est === "escalacao") {
      var limite = num(S.sala.meta.fimLeilao, agora) + ESCAL_MS, prontos = S._todosProntos();
      cand(prontos ? agora : limite, "camp", { prazo: prontos ? null : limite });
    } else if (est === "camp" && ctx) {
      S._candidatosCamp(agora, cand);
    }
    if (venc != null) cand(venc, "limpeza", { prazo: venc });
    if (!prox) return;
    var a = prox, ms = a.quando - agora + atraso;
    // a ação abortou neste mesmo estado sem nada mudar (o vivo deste aparelho ainda não tem o que o cache já tem, como o
    // próprio lance a caminho do servidor): espera o estado novo ou 0,5 s, nunca tenta de novo na hora
    if (S._abortou && S._abortou.chave === S._chave() && a.tipo !== "limpeza") ms = Math.max(ms, S._abortou.ate - agora);
    S._agenda(ms, function () { S._acao(a.tipo, a); });
  };
  // o que fazer agora com os jogos da rodada da vez (os candidatos do _programa; §1.7 e §3.3). Cada aparelho começa por um
  // jogo diferente (pelo seu lugar entre os presentes): menos transações disputadas no mesmo nó
  P._candidatosCamp = function (agora, cand) {
    var S = this, V = S._vista();
    if (!V) return;
    if (V.fim) { cand(agora, "fimCamp", {}); return; }
    var R = V.atual >= 0 ? V.rodadas[V.atual] : null;
    if (!R || !R.aberta || !R.jogos.length) return;
    var ps = S.online ? S._presentes(agora) : [], off = Math.max(0, ps.indexOf(S.eu));
    for (var x = 0; x < R.jogos.length; x++) {
      var a = S._acaoJogo(R.jogos[(x + off) % R.jogos.length], agora);
      if (a) cand(a.quando, "jogo", a);
    }
  };
  /** A próxima ação num jogo da vista: { acao: 'abrir'|'retomar'|'pausar'|'reservar'|'gravar'|'wo', id, motivo?, quando,
   *  prazo? (as decisões por prazo passam pela testemunha da hora), t? (a pessoa do jogo), ini e falta? (a pausa pelo
   *  buraco) } ou null. A regra é a do leilao-camp.js proximaAcao; aqui entram o batimento de cada pessoa e o treino: a
   *  pessoa do treino está sempre presente (o relógio do treino é que para quando ela sai das telas da sala ou esconde a
   *  página). Para o prazo parar sem ninguém perceber, a pausa é marcada para 12 s depois do último batimento da pessoa (sem
   *  um batimento novo até lá, ela sumiu). E quando ninguém percebeu (sozinha na sala, todos com o celular travado), o bate
   *  dela diz que houve um buraco DEPOIS de o prazo começar: o prazo para no último bate antes do buraco (a `falta`) e volta
   *  a correr — nunca é simulado pelo prazo com ela presente menos de 2 min. */
  P._acaoJogo = function (g, agora) {
    var S = this, c = S._campCtx();
    if (!c || !g || !g.aberta || g.a == null || g.b == null || g.e === "feito" || g.invalido) return null;
    var j = g.j;
    if (j && j.e === "reservado") {
      if (j.modo === "simulado") return { acao: "gravar", id: g.id, quando: agora };
      var pz = LC().prazoDe(j, c);
      return pz == null ? null : { acao: "wo", id: g.id, quando: pz, prazo: pz };
    }
    if (LC().confronto(c, g) !== "pessoaBot") return { acao: "reservar", id: g.id, motivo: "abertura", quando: agora };
    var p = c.tipos[g.a] === "pessoa" ? g.a : g.b;
    var aqui = !S.online || !S._ausente(p, agora);
    if (!j) return aqui ? { acao: "abrir", id: g.id, quando: agora, t: p } : null;
    if (j.parado) return aqui ? { acao: "retomar", id: g.id, quando: agora, t: p } : null;
    var vence = j.ini + j.resta, reserva = { acao: "reservar", id: g.id, motivo: "prazo", quando: vence, prazo: vence, t: p };
    if (!S.online) return reserva;
    var eu = p === S.eu && S._ativo(), run = S._corrida(p);
    // eu, com o último bate velho (o aparelho travou sem esconder a página): o próximo bate diz se houve buraco
    if (eu && agora - S._meuBate > AUSENTE_MS) return null;
    if (run && run.ini != null && run.ini > j.ini) return { acao: "pausar", id: g.id, quando: agora, t: p, ini: j.ini, falta: run.falta != null ? run.falta : j.ini };
    if (eu) return reserva;
    var b = S.bates[S._ordem()[p]], visto = num(b && b.ts, 0), some = visto + AUSENTE_MS;
    if (some < vence) return { acao: "pausar", id: g.id, quando: some, prazo: some, t: p, desde: visto };
    return reserva;
  };
  // a presença contínua do técnico t (corridaDe): a minha pelo que este aparelho sabe (o ack de cada bate), a dos outros
  // pelo bate deles
  P._corrida = function (t) {
    var S = this;
    if (t === S.eu && S._ativo()) return { ini: S._cont, falta: S._falta };
    return corridaDe(S.bates[S._ordem()[t]]);
  };
  // a pessoa do jogo esteve presente sem buraco desde que o prazo começou a correr (o reservar pelo prazo confere de novo
  // depois da testemunha: o bate dela pode ter chegado no meio)
  P._semBuraco = function (t, j) {
    var run = this._corrida(t);
    return !(j && j.e === "aberto" && !j.parado && run && run.ini != null && run.ini > j.ini);
  };
  // a transação no vivo com uma função pura do leilao.js; quem fechou um lote vendido grava o registro da venda.
  // agora = a hora da decisão (a da testemunha no online; sem ela, a do relógio)
  P._transVivo = function (fn, agoraFixo) {
    var S = this, L = LE(), ctx = S.ctx, rede = S.rede, motivo = null, antes = null;
    return rede.transacao("vivo", function (cur) {
      motivo = null; antes = cur;
      var r = fn(cur, agoraFixo != null ? agoraFixo : rede.horaServidor());
      if (!r || !r.ok) { motivo = (r && r.motivo) || "nada"; return undefined; }
      return r.vivo;
    }).then(function (res) {
      res.motivo = motivo;
      if (res.feito && antes) {
        var a = L.norm(antes, ctx), b = res.valor ? L.norm(res.valor, ctx) : null;
        if (b && b.seq > a.seq && a.fase !== "fim" && a.lider >= 0 && a.i >= 0 && b.d.charAt(a.i) === L.letra(a.lider)) {
          rede.gravar("vendas/" + a.i, { t: a.lider, v: a.valor, s: a.seq }).then(null, function () {});
        }
        S.guardarHora(false);
      }
      return res;
    });
  };
  P._acao = function (tipo, a) {
    var S = this, L = LE(), ctx = S.ctx, rede = S.rede, TS = rede.TS;
    if (S.parado || S.alterada) return;
    if (S.online && !S._ativo()) return;
    S._ocupado = true;
    var chave = S._chave();
    // a testemunha da hora (online, decisões por prazo): só age se o SERVIDOR já passou do prazo
    var pre = S.online && a.prazo != null ? S._testemunha().then(function (hs) {
      if (hs == null) return { espera: 1000 };
      if (hs < a.prazo) return { espera: a.prazo - hs };
      return { hs: hs };
    }) : Promise.resolve({ hs: null });
    pre.then(function (w) {
      if (w.espera != null) return { feito: false, motivo: "cedo", espera: w.espera };
      var hs = w.hs;
      if (S.parado || S.alterada) return { feito: false, motivo: "parado" };
      if (tipo === "inicial") {
        return rede.transacao("vivo", function (cur) { return cur == null ? L.inicial(ctx, rede.horaServidor(), { carimbo: TS }) : undefined; });
      } else if (tipo === "fechar") {
        return S._transVivo(function (cur, agora) { return L.fechar(cur, ctx, a.seq, agora, { carimbo: TS }); }, hs);
      } else if (tipo === "robo") {
        return S._transVivo(function (cur, agora) { return L.aplicarRobo(cur, ctx, a.bot, a.seq, a.n, agora, { carimbo: TS }); });
      } else if (tipo === "ausente") {
        // confere de novo com o que chegou até agora: voltou (bate fresco) = não passa
        if (!S._ausente(a.t, hs)) {
          var uidA = S._ordem()[a.t], bA = S.bates[uidA];
          S._voltou = S._voltou || {}; S._voltou[uidA] = num(bA && bA.ts, 0);
          return { feito: false, motivo: "voltou" };
        }
        return S._transVivo(function (cur, agora) { return L.passar(cur, ctx, a.t, a.seq, agora, { carimbo: TS }); }, hs);
      } else if (tipo === "escalacao") {
        return rede.transacao("sala", function (s) {
          if (!s || !s.meta || s.meta.estado !== "leilao" || !S.vivoN || S.vivoN.fase !== "fim") return undefined;
          s.meta.estado = "escalacao"; s.meta.fimLeilao = TS; s.meta.atividade = TS;
          return s;
        });
      } else if (tipo === "camp") {
        // o campeonato nasce aqui, UMA vez (a transação só passa do estado escalacao): meta.camp = a hora do servidor em
        // que a 1ª rodada abre; o calendário é função pura do formato, do T e da semente da sala
        return rede.transacao("sala", function (s) {
          if (!s || !s.meta || s.meta.estado !== "escalacao") return undefined;
          if (!S._todosProntos() && (hs != null ? hs : rede.horaServidor()) < num(s.meta.fimLeilao, 0) + ESCAL_MS) return undefined;
          s.meta.estado = "camp"; s.meta.camp = TS; s.meta.atividade = TS;
          return s;
        });
      } else if (tipo === "jogo") {
        return S._acaoCamp(a, hs);
      } else if (tipo === "fimCamp") {
        // todos os jogos feitos: a sala passa ao fim (fica para consulta; a limpeza conta 24 h da última atividade)
        return rede.transacao("sala", function (s) {
          if (!s || !s.meta || s.meta.estado !== "camp") return undefined;
          var V = S._vista();
          if (!V || !V.fim) return undefined;
          s.meta.estado = "fim"; s.meta.fimCamp = TS; s.meta.atividade = TS;
          return s;
        });
      } else if (tipo === "limpeza") {
        var venc = S._vencimento();
        if (venc == null || hs < venc) return { feito: false, motivo: "cedo", espera: venc == null ? null : venc - hs };
        return rede.apagar().then(function () { return { feito: true }; });
      }
      return { feito: false, motivo: "nada" };
    }).then(function (res) {
      S._ocupado = false;
      if (res.espera != null) { S._agenda(res.espera + 20, function () { S._programa(); }); return; }
      // qualquer ação que não fez nada sem o estado mudar: a próxima tentativa espera o estado novo ou 0,5 s (no treino,
      // só as do campeonato, com 50 ms: o leilão do treino continua igual à máquina pura)
      if (!res.feito && S.online && S._chave() === chave) S._abortou = { chave: chave, ate: S.hora() + 500 };
      else if (!res.feito && !S.online && (tipo === "jogo" || tipo === "fimCamp") && S._chave() === chave) S._abortou = { chave: chave, ate: S.hora() + 50 };
      if (!res.feito) {
        if (tipo === "robo" && res.motivo !== "seq" && res.motivo !== "nada" && res.motivo !== "pausa" && res.motivo !== "tarde") S._falhas[a.seq + ":" + a.n + ":" + a.bot.t] = 1;
        // fechar cedo (o relógio deste aparelho chegou antes do da rede): espera um pouco antes de tentar de novo
        if (tipo === "fechar" && res.motivo === "cedo") { S._cedo++; if (S._cedo > 2) { S._agenda(50, function () { S._programa(); }); return; } }
      } else S._cedo = 0;
      S._programa();
    }, function (e) {
      S._ocupado = false;
      // a conexão caiu: a volta (aoVoltar) programa de novo
      if (e && e.codigo === "desconectado") return;
      if (e && e.codigo === "apagada") return;
      if (global.console) console.error(e);
      S._agenda(1000, function () { S._programa(); });
    });
  };

  /* ---------- o campeonato: os passos dos jogos (UMA transação por passo, no nó jogos/{id}) ---------- */
  // fn(cur) devolve o { ok, jogo, motivo } da máquina do leilao-camp.js; Promise({ feito, valor, motivo })
  P._transJogo = function (id, fn) {
    var S = this, motivo = null;
    return S.rede.transacao("jogos/" + id, function (cur) {
      motivo = null;
      var r = fn(cur);
      if (!r || !r.ok) { motivo = (r && r.motivo) || "nada"; return undefined; }
      return r.jogo;
    }).then(function (res) { res.motivo = motivo; if (res.feito) S.guardarHora(false); return res; });
  };
  // o resultado, UMA vez: calculado DENTRO da transação a partir do nó que o servidor tem (a trava e as escalações
  // gravadas; o mesmo em todo aparelho) e gravado só sobre o reservado com aquela trava
  P._gravarJogo = function (id) {
    var S = this, c = S._campCtx(), rede = S.rede, memo = {};
    if (!c) return Promise.resolve({ feito: false, motivo: "naoCamp" });
    return S._transJogo(id, function (cur) {
      if (!cur || cur.e !== "reservado") return { ok: false, motivo: cur ? cur.e : "sem" };
      if (cur.modo !== "simulado") return { ok: false, motivo: "modo" };
      var k = canon(cur), res = memo[k] || (memo[k] = LC().resultadoDoJogo(c, id, cur));
      return LC().gravar(cur, { trava: cur.trava, res: res, ts: rede.TS, mata: LC().ehMata(id) });
    });
  };
  // reservar com a trava do servidor (TS) e as escalações de AGORA (a do técnico vale a partir do próximo jogo que não
  // começou) e, se reservou, gravar na hora (os outros aparelhos gravariam o mesmo resultado; quem reservou não espera
  // ninguém). hora = a da testemunha (só no 'prazo'); por = o técnico que pediu (-1 = um aparelho qualquer)
  P._reservarEGravar = function (g, motivo, hora, por) {
    var S = this, c = S._campCtx(), rede = S.rede;
    if (!c) return Promise.resolve({ feito: false, motivo: "naoCamp" });
    var esc = [LC().escalacaoDoJogo(c, g.a), LC().escalacaoDoJogo(c, g.b)];
    return S._transJogo(g.id, function (cur) {
      return LC().reservar(cur, { ab: [g.a, g.b], esc: esc, modo: "simulado", por: por, motivo: motivo, ts: rede.TS, hora: hora });
    }).then(function (r) {
      // reservou, ou outro aparelho reservou no meio (o simulado): grava
      if (!r.feito && r.motivo !== "reservado") return r;
      return S._gravarJogo(g.id).then(function (r2) {
        if (r.feito) { r2.feito = true; r2.reservou = true; }
        return r2;
      });
    });
  };
  // a ação do motor num jogo (candidatos de _acaoJogo); hs = a hora da testemunha (online, nas decisões por prazo)
  P._acaoCamp = function (a, hs) {
    var S = this, c = S._campCtx(), V = S._vista(), g = jogoDaVista(V, a.id), rede = S.rede, TS = rede.TS;
    if (!c || !g || !g.aberta || g.e === "feito") return Promise.resolve({ feito: false, motivo: "nada" });
    var hora = hs != null ? hs : rede.horaServidor();
    if (a.acao === "abrir") return S._transJogo(g.id, function (cur) { return LC().abrir(cur, { ts: TS }); });
    if (a.acao === "retomar") return S._transJogo(g.id, function (cur) { return LC().retomar(cur, { ts: TS }); });
    if (a.acao === "pausar") {
      // o buraco depois de o prazo começar: para no último bate antes dele (só no mesmo trecho do prazo que se viu: quem
      // já parou e retomou deixou outro `ini`)
      if (a.falta != null) return S._transJogo(g.id, function (cur) {
        if (!cur || cur.e !== "aberto" || cur.parado || cur.ini !== a.ini) return { ok: false, motivo: "mudou" };
        return LC().pausar(cur, { quando: a.falta });
      });
      // confere de novo com os batimentos que chegaram até a testemunha: voltou (bate fresco) = o prazo continua
      if (!S._ausente(a.t, hora)) return Promise.resolve({ feito: false, motivo: "voltou" });
      var b = S.bates[S._ordem()[a.t]], run = corridaDe(b), desde = num(b && b.ts, num(a.desde, hora));
      // ela voltou e sumiu de novo sem ninguém ver: o prazo não corre no buraco de antes
      if (run && run.ini != null && g.j && run.ini > g.j.ini) desde = run.falta != null ? run.falta : g.j.ini;
      return S._transJogo(g.id, function (cur) { return LC().pausar(cur, { quando: desde }); });
    }
    if (a.acao === "reservar") {
      if (a.motivo === "prazo" && S.online && !S._semBuraco(a.t, g.j)) return Promise.resolve({ feito: false, motivo: "buraco" });
      return S._reservarEGravar(g, a.motivo, a.motivo === "prazo" ? hora : null, -1);
    }
    if (a.acao === "gravar") return S._gravarJogo(g.id);
    if (a.acao === "wo") return S._transJogo(g.id, function (cur) { return LC().wo(cur, { trava: cur && cur.trava, hora: hora, ts: TS }, c); });
    return Promise.resolve({ feito: false, motivo: "nada" });
  };

  /* ---------- o que as telas mostram ---------- */
  P.escalacao = function (t) {
    var S = this;
    if (!S.ctx || t < 0 || t >= S.ctx.T) return null;
    var v = S.vivo || { d: null, cx: [] };
    return LE().escalacaoDe(v, S.ctx, t, S.escal[t] || null, S._prefPadrao(t));
  };
  // o que impede a pessoa de agir agora, fora as regras do lote (online: a conexão, outra aba, o lance conferindo)
  P._impede = function () {
    var S = this;
    if (S.parado) return "parado";
    if (S.alterada) return "alterada";
    if (!S.online) return null;
    if (S.outraAba) return "outraAba";
    if (S.conferindo) return "conferindo";
    if (S._estadoRede() !== "ok" || !S._emDia()) return "conexao";
    return null;
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
    var imp = S._impede();
    if (imp) {
      r.pode = false; r.motivo = imp;
      if (imp === "conexao") { var er = S._estadoRede(); r.rede = er === "ok" ? "atualizando" : er; }
      return r;
    }
    if (!(alvo >= base + 1)) { r.pode = false; r.motivo = "valor"; return r; }
    if (alvo > pd.max) { r.pode = false; r.motivo = "max"; return r; }
    return r;
  };
  P.ver = function () {
    var S = this, L = LE(), ctx = S.ctx, v = S.vivoN, sala = S.sala || {}, meta = sala.meta || {}, cfg = sala.cfg || {};
    var agora = S.hora(), ordem = sala.meta ? S._ordem() : [];
    var out = {
      codigo: S.codigo, treino: S.treino, online: S.online, estado: meta.estado || null, alterada: S.alterada, soOlhar: S.soOlhar,
      conectado: S.rede.conectado ? S.rede.conectado() : true, pausado: S.pausado(), agora: agora, eu: S.eu,
      T: ctx ? ctx.T : ordem.length, liga: { id: cfg.liga || null, nome: cfg.ligaNome || "" }, cfg: cfg, fase: v ? v.fase : null,
      tecnicos: [], lote: null, botoes: null, proximos: [], vendas: [], ultimo: S.ultimo, meu: null, camp: null,
      formato: formatoDe(cfg.formato),
      fimEscalacao: meta.estado === "escalacao" ? num(meta.fimLeilao, agora) + ESCAL_MS : null,
      // online
      rede: S._estadoRede(), conferindo: !!S.conferindo, outraAba: S.outraAba, apagada: S.apagada, oculta: S._oculta,
      pedido: S.pedido, souDono: !!(S.online && S.uidEu && meta.dono === S.uidEu), saguao: null,
      versaoDiferente: !!(S.online && meta.versaoTM && meta.versaoTM !== versao()), edicao: meta.edicao || null,
      regrasSala: meta.regras != null ? meta.regras : null
    };
    ordem.forEach(function (uid, t) {
      var tc = (sala.tec && sala.tec[uid]) || {}, c = v ? v.cx[t] : [L.SALDO, L.VAGAS, 0, 0, 0, 0];
      var pres = S.pres && S.pres[uid];
      var o = {
        t: t, uid: uid, nome: tc.nome || ("Técnico " + (t + 1)), bot: tc.papel === "bot", papel: tc.papel || "tecnico",
        clube: tc.clube || limpaClube(null), eu: t === S.eu, num: tc.num || null, pronto: tc.papel === "bot" || tc.papel === "dono" || !!tc.pronto,
        formacao: tc.formacao || null,
        saldo: c[0], vagas: c[1], n: L.VAGAS - c[1], gk: c[2], df: c[3], mf: c[4], fw: c[5],
        max: v && ctx ? L.maximo(v, ctx, t) : 0, passou: false, lider: false, naoPode: null,
        saiu: !!tc.saiu, ausente: S.online && tc.papel !== "bot" && !!sala.meta && S._ausente(t, agora),
        conectado: tc.papel === "bot" || (!S.online) || !!(pres && Object.keys(pres).length) || (t === S.eu && S._ativo())
      };
      if (v && ctx && v.fase !== "fim" && v.i >= 0) {
        o.lider = v.lider === t; o.passou = v.p.charAt(t) === "1";
        if (!o.lider && !o.passou) { var pd = L.pode(v, ctx, t); if (!pd.pode) o.naoPode = pd.motivo; }
      }
      out.tecnicos.push(o);
    });
    if (S.online && meta.estado === "saguao") {
      var pr = prontosDe(sala), ped = sala.pedidos || {};
      out.saguao = {
        vagas: num(cfg.vagas, L.TEC_MAX), bots: num(cfg.bots, 0), humanos: humanosDe(sala).length,
        prontos: pr.prontos, total: pr.total, faltam: pr.faltam, lotada: lotada(sala),
        pedidos: Object.keys(ped).map(function (u) { var p = ped[u] || {}; return { uid: u, nome: p.nome || "Jogador", num: p.num || null, clube: p.clube || null, ts: num(p.ts, 0) }; })
          .sort(function (a, b) { return a.ts - b.ts || (a.uid < b.uid ? -1 : 1); }),
        podeComecar: humanosDe(sala).length + botsDe(sala).length >= L.TEC_MIN && pr.prontos === pr.total
      };
    } else if (S.online && sala.pedidos) {
      // depois do Começar: os pedidos de quem trocou de aparelho (o dono passa o clube)
      out.pedidosDepois = Object.keys(sala.pedidos).map(function (u) { var p = sala.pedidos[u] || {}; return { uid: u, nome: p.nome || "Jogador", num: p.num || null, ts: num(p.ts, 0) }; });
    }
    if (!ctx) return out;
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
    out.camp = S._verCamp(agora);
    return out;
  };
  /** O campeonato para as telas (null antes dele): { formato, T, rodadas (montar: cada jogo com e 'espera'|'livre'|
   *  'aberto'|'reservado'|'feito', res e placar GRAVADOS), atual, rodada (a da vez), tabela (pontos), ligaFeita, fim, campeao,
   *  classificacao, artilharia, melhorTime ({ t, soma }), notas ([{ t, soma }] no fim), tipos, meuJogo ({ id, rodada, a, b,
   *  adversario, contraBot, mata, e, prazo: { fim, restante, parado, resta } | null, placar, res, venc, podeSimular,
   *  motivo }), folga, eliminado, pendentes (quantos jogos da rodada da vez esperam por quem está ausente), pendLista
   *  ([{ id, a, b, t }]), podePendentes, pendQuem ('dono' | 'outro': o dono fora há mais de 5 min),
   *  inicio, fimCamp }. Nada aqui recalcula partida: tudo sai dos jogos gravados. */
  P._verCamp = function (agora) {
    var S = this, c = S._campCtx(), V = c ? S._vista() : null, s = S.sala;
    if (!c || !V) return null;
    var R = V.atual >= 0 ? V.rodadas[V.atual] : null, meu = S._meuJogo(V), mj = null, eu = S.eu;
    if (meu) {
      var j = meu.j, pz = null, adv = meu.a === eu ? meu.b : meu.a;
      if (j && j.e === "aberto") pz = j.parado ? { parado: true, resta: j.resta, fim: null, restante: j.resta } : { parado: false, resta: j.resta, fim: j.ini + j.resta, restante: Math.max(0, j.ini + j.resta - agora) };
      var imp = S._impede(), pode = meu.aberta && meu.e !== "feito" && !(j && j.e === "reservado" && j.modo !== "simulado") && !imp && !S.soOlhar;
      mj = {
        id: meu.id, rodada: meu.rodada, a: meu.a, b: meu.b, adversario: adv, contraBot: c.tipos[adv] === "bot", mata: meu.mata, e: meu.e,
        prazo: pz, placar: meu.placar, res: meu.res, venc: meu.venc, podeSimular: !!pode,
        motivo: pode ? null : (S.soOlhar ? "fase" : imp || (meu.e === "feito" ? "campFim" : !meu.aberta ? "espera" : "jogando"))
      };
    }
    var eliminado = false;
    if (eu >= 0) V.rodadas.forEach(function (Rx) {
      if (Rx.fase !== "mata") return;
      Rx.jogos.forEach(function (g) { if (g.e === "feito" && (g.a === eu || g.b === eu) && g.venc !== eu) eliminado = true; });
    });
    // no misto, quem não se classificou na fase de pontos
    if (eu >= 0 && c.formato === "misto" && V.ligaFeita && !eliminado) {
      var naMata = V.rodadas.some(function (Rx) { return Rx.fase === "mata" && Rx.jogos.some(function (g) { return g.a === eu || g.b === eu; }); });
      if (!naMata) eliminado = true;
    }
    var pend = S._pendentes(V, agora), quem = S._quemPendentes(agora);
    return {
      formato: c.formato, T: c.T, rodadas: V.rodadas, atual: V.atual, rodada: R, tabela: V.tabela, ligaFeita: V.ligaFeita, fim: V.fim,
      campeao: V.campeao, classificacao: V.classificacao, artilharia: V.artilharia, melhorTime: V.melhorTime,
      notas: V.fim ? LC().somaNotas(c) : null, tipos: c.tipos.slice(), meuJogo: mj,
      folga: !!(R && eu >= 0 && R.folgas.indexOf(eu) >= 0), eliminado: eliminado,
      pendentes: pend.length, pendLista: pend, pendQuem: quem, podePendentes: !!quem && pend.length > 0 && !V.fim && !S._impede(),
      inicio: c.inicio, fimCamp: s && s.meta ? num(s.meta.fimCamp, null) : null, alteradaJogo: S.alteradaJogo
    };
  };
  /** O jogo GRAVADO para o "Ver o jogo" no 2D: { id, rodada, a, b, mata, res, times: [A, B] } com os times pelas escalações
   *  gravadas no jogo (as do momento da reserva); null se o jogo não está feito. */
  P.partida = function (id) {
    var S = this, c = S._campCtx(), V = c ? S._vista() : null, g = jogoDaVista(V, id);
    if (!g || g.e !== "feito" || !g.j) return null;
    var ab = Array.isArray(g.j.ab) ? g.j.ab : [g.j.ab[0], g.j.ab[1]], esc = Array.isArray(g.j.esc) ? g.j.esc : [g.j.esc[0], g.j.esc[1]];
    return { id: g.id, rodada: g.rodada, a: g.a, b: g.b, mata: g.mata, res: g.res, times: [LC().timeDoTecnico(c, ab[0], esc[0]), LC().timeDoTecnico(c, ab[1], esc[1])] };
  };

  /* ---------- as ações da pessoa ---------- */
  function recusa(motivo, extra) { var r = { ok: false, estado: "recusado", motivo: motivo }; if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; }); return Promise.resolve(r); }
  // o lance (ou o passe) que caiu no meio da conexão: "Conferindo…" até a rede ficar em dia, e o resultado lido do vivo
  P._conferirDepois = function (dados) {
    var S = this;
    S.conferindo = dados;
    S._estadoBate = "atualizando";
    S._emite("conferindo", dados);
    S._notificar();
    if (S.rede.conectado()) S._bater();
    return S._quandoEmDia().then(function () {
      S.conferindo = null;
      S._notificar();
      return S.vivoN;
    });
  };
  /** Lance: '+1' | '+5' | '+10' (sobre o valor VISTO) | 'tudo' | um número (outro valor). Aborta se alguém deu lance
   *  depois do que a pessoa viu ("Alguém chegou antes": nunca sobe sozinho). Promise({ ok, estado: 'aceito' | 'antes'
   *  (o preço novo em `valor`) | 'fechado' (o lote já fechou) | 'recusado' (motivo), valor }). No online, com a conexão
   *  caindo antes da resposta, a promessa espera a volta ("Conferindo…") e responde pelo vivo lido de novo. */
  P.lance = function (tipo) {
    var S = this, L = LE(), ctx = S.ctx, rede = S.rede;
    if (S.parado) return recusa("parado");
    if (S.soOlhar) return recusa("fase");
    var agora = S.hora(), info = S._alvo(tipo, agora);
    if (!info.pode) return recusa(info.motivo, { max: info.max, valor: info.valor });
    var v = S.vivoN, seqV = v.seq, nV = v.n, iV = v.i, alvo = info.alvo, toque = agora, eu = S.eu;
    return S._transVivo(function (cur, ag) {
      if (cur) { var c = L.norm(cur, ctx); if (c.seq === seqV && c.n !== nV) return { ok: false, motivo: "antes" }; }
      return L.lance(cur, ctx, eu, alvo, seqV, ag, { toque: toque, carimbo: rede.TS });
    }).then(function (res) {
      if (res.feito) return { ok: true, estado: "aceito", valor: alvo };
      var c = res.valor ? L.norm(res.valor, ctx) : null, m = res.motivo;
      if (m === "antes" || m === "valor") return { ok: false, estado: "antes", motivo: "antes", valor: c ? c.valor : 0, lider: c ? c.lider : -1 };
      if (m === "seq" || m === "fim" || m === "tarde") return { ok: false, estado: "fechado", motivo: "fechado" };
      return { ok: false, estado: "recusado", motivo: m, max: info.max };
    }, function (e) {
      if (!S.online || !e || e.codigo !== "desconectado") return { ok: false, estado: "recusado", motivo: "rede" };
      return S._conferirDepois({ tipo: "lance", seq: seqV, n: nV, i: iV, alvo: alvo }).then(function (c) {
        if (!c) return { ok: false, estado: "fechado", motivo: "fechado" };
        if (c.seq === seqV) {
          // o lance de número nV+1 é o meu? (o histórico guarda os 5 últimos)
          var j = c.h.length - 1 - (c.n - (nV + 1)), h = j >= 0 && j < c.h.length ? c.h[j] : null;
          if (c.n >= nV + 1 && h && h[0] === eu && h[1] === alvo) return { ok: true, estado: "aceito", valor: alvo, conferido: true };
          return { ok: false, estado: "antes", motivo: "antes", valor: c.valor, lider: c.lider, conferido: true };
        }
        // o lote fechou: se ficou comigo, o lance entrou (quem já liderava não podia dar lance)
        if (iV >= 0 && c.d.charAt(iV) === L.letra(eu)) return { ok: true, estado: "aceito", valor: alvo, conferido: true };
        return { ok: false, estado: "fechado", motivo: "fechado", conferido: true };
      });
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
    }, function (e) {
      if (!S.online || !e || e.codigo !== "desconectado") return { ok: false, estado: "recusado", motivo: "rede" };
      return S._conferirDepois({ tipo: "passar", seq: seqV }).then(function (c) {
        if (c && c.seq === seqV && c.p.charAt(eu) === "1") return { ok: true, estado: "aceito", conferido: true };
        if (!c || c.seq !== seqV) return { ok: false, estado: "fechado", motivo: "fechado", conferido: true };
        return { ok: false, estado: "recusado", motivo: "rede", conferido: true };
      });
    });
  };
  // a transação no nó `sala` com a mudança de uma ação da pessoa (online): fn(s) devolve o motivo da recusa ou nada
  P._transSala = function (fn) {
    var S = this, rede = S.rede, motivo = null;
    return rede.transacao("sala", function (s) {
      motivo = null;
      if (!s || !s.meta) { motivo = "apagada"; return undefined; }
      var m = fn(s);
      if (m) { motivo = m; return undefined; }
      s.meta.atividade = rede.TS;
      return s;
    }).then(function (res) {
      return res.feito ? { ok: true, estado: "aceito" } : { ok: false, estado: "recusado", motivo: motivo || "mudou" };
    }, function (e) { return { ok: false, estado: "recusado", motivo: e && e.codigo === "desconectado" ? "conexao" : "rede" }; });
  };
  P._naoPodeSala = function (soDono) {
    var S = this, imp = S._impede();
    if (!S.online) return "fase";
    if (S.soOlhar) return "regras";
    if (imp && imp !== "conferindo") return imp;
    if (S.eu < 0 || S.pedido) return "naoMembro";
    if (soDono && !(S.sala && S.sala.meta && S.sala.meta.dono === S.uidEu)) return "dono";
    return null;
  };
  /** A formação preferida (durante o leilão e no saguão) ou a do time (depois): só uma em que o time cabe. */
  P.mudarFormacao = function (f) {
    var S = this, L = LE();
    if (S.parado) return recusa("parado");
    if (S.eu < 0 || S.soOlhar) return recusa("fase");
    if (L.FORMACOES.indexOf(f) < 0) return recusa("naoCabe");
    if (S.online && S.sala && S.sala.meta && S.sala.meta.estado === "saguao") {
      var m = S._naoPodeSala(false); if (m) return recusa(m);
      var uid = S.uidEu;
      return S._transSala(function (s) { if (s.meta.estado !== "saguao") return "comecou"; if (!s.tec[uid]) return "naoMembro"; s.tec[uid].formacao = f; return null; });
    }
    if (!S.ctx) return recusa("fase");
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

  /* ---------- o campeonato: as ações da pessoa ---------- */
  function respostaJogo(g, valor) {
    var j = valor || (g && g.j);
    if (!j || j.e !== "feito") return { ok: false, estado: "recusado", motivo: "rede" };
    return { ok: true, estado: "aceito", id: g.id, jogo: j, res: j.res, a: g.a, b: g.b, mata: g.mata };
  }
  /** "Simular partida" (o meu jogo da rodada; id = outro jogo meu): reserva com a trava do servidor (motivo 'pedido'),
   *  simula com a semente e as escalações GRAVADAS, grava e SÓ ENTÃO responde com o resultado para a tela mostrar (no 2D
   *  sem pausa: a pausa sortearia o resto de novo). Se outro aparelho chegou antes (o prazo venceu, o dono simulou os
   *  pendentes), responde com o resultado que ele gravou (gravando o reservado, se ainda faltar). Promise({ ok, estado:
   *  'aceito', id, jogo (o nó feito), res, a, b, mata }) ou a recusa com o motivo. */
  P.simular = function (id) {
    var S = this;
    if (S.parado) return recusa("parado");
    if (S.soOlhar) return recusa("fase");
    var imp = S._impede(); if (imp && imp !== "conferindo") return recusa(imp, imp === "conexao" ? { rede: S._estadoRede() } : null);
    var V = S._vista(); if (!V) return recusa("naoCamp");
    if (V.fim) return recusa("campFim");
    var g = id ? jogoDaVista(V, id) : S._meuJogo(V);
    if (!g) return recusa("semJogo");
    if (S.eu < 0 || (g.a !== S.eu && g.b !== S.eu)) return recusa("naoEhSeu");
    if (!g.aberta || g.a == null || g.b == null) return recusa("espera");
    if (g.e === "feito") return Promise.resolve(respostaJogo(g));
    if (g.j && g.j.e === "reservado" && g.j.modo !== "simulado") return recusa("jogando");
    var p = g.j && g.j.e === "reservado" ? S._gravarJogo(g.id) : S._reservarEGravar(g, "pedido", null, S.eu);
    return p.then(function (r) {
      if (r.valor && r.valor.e === "feito") return respostaJogo(g, r.valor);
      // a corrida terminou no feito de outro aparelho que esta transação não viu: lê o que ficou gravado
      return S.rede.ler("jogos/" + g.id).then(function (j) { return respostaJogo(g, j); });
    }, function (e) { return { ok: false, estado: "recusado", motivo: e && e.codigo === "desconectado" ? "conexao" : "rede" }; });
  };
  /** "Simular os pendentes": reserva e simula os jogos da rodada da vez que esperam por quem está AUSENTE (_pendentes: o
   *  prazo parado ou o jogo nem aberto; nunca o de quem está aqui com o prazo correndo, nem o meu). É do dono (motivo
   *  'dono'); com o dono fora há mais de 5 min, de qualquer técnico presente (motivo 'pendentes'; a testemunha da hora
   *  confirma pela hora do servidor). Promise({ ok, estado, n }). */
  P.simularPendentes = function () {
    var S = this;
    if (S.parado) return recusa("parado");
    if (S.soOlhar) return recusa("fase");
    var quem = S._quemPendentes(S.hora());
    if (!quem) return recusa("dono");
    var imp = S._impede(); if (imp && imp !== "conferindo") return recusa(imp, imp === "conexao" ? { rede: S._estadoRede() } : null);
    var V0 = S._vista(); if (!V0) return recusa("naoCamp");
    if (V0.fim) return recusa("campFim");
    if (!S._pendentes(V0, S.hora()).length) return recusa("semPendentes");
    var eu = S.eu, pre = quem === "dono" ? Promise.resolve(null) : S._testemunha();
    return pre.then(function (hs) {
      if (S.parado) return { ok: false, estado: "recusado", motivo: "parado" };
      if (quem !== "dono" && (hs == null || !S._donoFora(hs))) return { ok: false, estado: "recusado", motivo: "dono" };
      var V = S._vista(), pend = V ? S._pendentes(V, hs != null ? hs : S.hora()) : [];
      if (!pend.length) return { ok: false, estado: "recusado", motivo: "semPendentes" };
      return Promise.all(pend.map(function (x) {
        return S._reservarEGravar(jogoDaVista(V, x.id), quem === "dono" ? "dono" : "pendentes", null, eu).then(null, function () { return { feito: false }; });
      })).then(function (rs) {
        return { ok: true, estado: "aceito", n: rs.filter(function (r) { return r.feito; }).length, pendentes: pend.length };
      });
    });
  };

  /* ---------- o saguão (online; tudo por transação no nó `sala`) ---------- */
  /** O dono aceita o pedido (o técnico entra no fim da fila das pessoas, com uma cor que ninguém usa). */
  P.aceitar = function (uid) {
    var S = this, m = S._naoPodeSala(true); if (m) return recusa(m);
    return S._transSala(function (s) {
      if (s.meta.estado !== "saguao") return "comecou";
      var p = s.pedidos && s.pedidos[uid]; if (!p) return "semPedido";
      if (s.tec[uid]) { delete s.pedidos[uid]; return null; }
      if (lotada(s)) return "cheia";
      s.tec[uid] = { nome: String(p.nome || "Jogador").slice(0, 16), num: p.num || null, papel: "tecnico", pronto: false, auth: p.auth || uid,
        clube: corLivre(p.clube, s, uid), formacao: LE().FORMACOES.indexOf(p.formacao) >= 0 ? p.formacao : "4-4-2", entrou: proxEntrou(s) };
      delete s.pedidos[uid];
      refazBots(s);
      return null;
    });
  };
  /** O dono recusa o pedido (a pessoa não pode pedir de novo nesta sala). */
  P.recusar = function (uid) {
    var S = this, m = S._naoPodeSala(true); if (m) return recusa(m);
    return S._transSala(function (s) {
      if (!s.pedidos || !s.pedidos[uid]) return "semPedido";
      delete s.pedidos[uid];
      s.recusados = s.recusados || {}; s.recusados[uid] = true;
      return null;
    });
  };
  /** O dono tira alguém antes de começar (e não deixa pedir de novo). */
  P.tirar = function (uid) {
    var S = this, m = S._naoPodeSala(true); if (m) return recusa(m);
    return S._transSala(function (s) {
      if (s.meta.estado !== "saguao") return "comecou";
      var tc = s.tec[uid]; if (!tc || tc.papel !== "tecnico") return "naoMembro";
      delete s.tec[uid];
      s.recusados = s.recusados || {}; s.recusados[uid] = true;
      refazBots(s);
      return null;
    });
  };
  /** O dono muda a configuração no saguão: { liga, ligaNome, vagas, bots, tempo, formato }. Zera os Pronto. */
  P.configurar = function (parcial) {
    var S = this, L = LE(), m = S._naoPodeSala(true); if (m) return recusa(m);
    parcial = parcial || {};
    return S._transSala(function (s) {
      if (s.meta.estado !== "saguao") return "comecou";
      var cfg = s.cfg || {}, hs = humanosDe(s).length;
      var vagas = parcial.vagas != null ? Math.floor(parcial.vagas) : num(cfg.vagas, L.TEC_MAX);
      var nb = parcial.bots != null ? Math.floor(parcial.bots) : num(cfg.bots, 0);
      if (!(vagas >= L.TEC_MIN && vagas <= L.TEC_MAX) || !(nb >= 0) || hs + nb > vagas) return "vagas";
      var tempo = parcial.tempo != null ? (parcial.tempo < 1000 ? parcial.tempo * 1000 : parcial.tempo) : cfg.tempo;
      if (L.TEMPOS.indexOf(tempo) < 0) tempo = L.DUR;
      if (parcial.liga != null) { cfg.liga = String(parcial.liga); cfg.ligaNome = String(parcial.ligaNome || parcial.liga); }
      if (parcial.formato != null) cfg.formato = formatoDe(parcial.formato);
      else cfg.formato = formatoDe(cfg.formato);
      cfg.vagas = vagas; cfg.bots = nb; cfg.tempo = tempo;
      s.cfg = cfg;
      humanosDe(s).forEach(function (u) { if (s.tec[u].papel !== "dono") s.tec[u].pronto = false; });
      refazBots(s);
      return null;
    });
  };
  /** O meu "Pronto" no saguão. */
  P.pronto = function (sim) {
    var S = this, m = S._naoPodeSala(false); if (m) return recusa(m);
    var uid = S.uidEu;
    return S._transSala(function (s) {
      if (s.meta.estado !== "saguao") return "comecou";
      if (!s.tec[uid]) return "naoMembro";
      if (s.tec[uid].papel === "dono") return null;
      s.tec[uid].pronto = sim !== false;
      return null;
    });
  };
  /** O meu clube no saguão (nome 16, sigla 3, a cor que ninguém usa e o escudo do Ultimate). */
  P.meuClube = function (clube) {
    var S = this, m = S._naoPodeSala(false); if (m) return recusa(m);
    var uid = S.uidEu, c = limpaClube(clube);
    return S._transSala(function (s) {
      if (s.meta.estado !== "saguao") return "comecou";
      if (!s.tec[uid]) return "naoMembro";
      var usada = humanosDe(s).some(function (u) { return u !== uid && s.tec[u].clube && String(s.tec[u].clube.cor).toLowerCase() === c.cor; });
      if (usada) return "cor";
      s.tec[uid].clube = c;
      refazBots(s);
      return null;
    });
  };
  /** O Começar (só o dono): os lotes da liga para os técnicos de agora (do mundo-base deste aparelho), depois a
   *  transação que confere o saguão, a lotação, todos prontos e os lotes, e grava a ordem; o vivo inicial vem do motor. */
  P.comecar = function (opc) {
    var S = this, L = LE(), rede = S.rede, m = S._naoPodeSala(true); if (m) return recusa(m);
    var s0 = S.sala;
    if (s0.meta.estado !== "saguao") return recusa("comecou");
    var ordem = ordemPrevista(s0), T = ordem.length, liga = s0.cfg.liga;
    if (T < L.TEC_MIN) return recusa("poucos");
    if (prontosDe(s0).faltam.length) return recusa("prontos");
    // os lotes saem do mundo-base da edição DA SALA: a tela de início troca a edição sem recarregar e a sessão continua
    // viva (sem isto, os jogadores da Season Update iam para uma sala pública); volta à da sala, como o entrar()
    var ed = s0.meta.edicao === "pro" ? "pro" : "public", oe = S._opcEd;
    if (opcEdicao(oe) !== ed) {
      if (ed === "pro" && !opcLiberada(oe)) return recusa("edicao");
      opcTroca(oe, ed);
      if (opcEdicao(oe) !== ed) return recusa("edicaoAparelho");
    }
    var mundo = (opc && opc.mundo) || (S._mundo && S._mundoEd === ed ? S._mundo : null) || TM.data.mundoBase();
    var lg = mundo.leaguesById && mundo.leaguesById[liga];
    if (!lg) return recusa("liga");
    var lt = L.criarLotes(mundo, liga, T), dados = { l: lt.lotes, f: lt.fora, T: T, liga: liga, ed: ed }, meus = canon(dados);
    // os lotes que já estão lá só ficam se forem IGUAIS aos deste aparelho (gravados no saguão por outra conta: troca)
    return rede.transacao("lotes", function (cur) { return cur && canon(cur) === meus ? undefined : dados; }).then(function () {
      S._lotesMeus = meus;
      return S._transSala(function (s) {
        if (s.meta.estado !== "saguao") return "comecou";
        var ord = ordemPrevista(s);
        if (ord.length !== T || (s.cfg && s.cfg.liga) !== liga) return "mudou";
        if (ord.length < L.TEC_MIN || ord.length > L.TEC_MAX) return "poucos";
        if (prontosDe(s).faltam.length) return "prontos";
        s.meta.estado = "leilao"; s.ordem = ord; s.cfg.T = T;
        return null;
      });
    }, function (e) { return { ok: false, estado: "recusado", motivo: e && e.codigo === "desconectado" ? "conexao" : "rede" }; });
  };
  /** Depois do Começar, o dono passa o clube de quem trocou de aparelho (ou limpou os dados) para o pedido dessa pessoa. */
  P.passarClube = function (uidVelho, uidNovo) {
    var S = this, m = S._naoPodeSala(true); if (m) return recusa(m);
    return S._transSala(function (s) {
      if (s.meta.estado === "saguao" || !Array.isArray(s.ordem)) return "naoComecou";
      var tc = s.tec[uidVelho], p = s.pedidos && s.pedidos[uidNovo];
      if (!tc || tc.papel !== "tecnico") return "naoMembro";
      if (!p) return "semPedido";
      if (s.tec[uidNovo]) return "mudou";
      var i = s.ordem.indexOf(uidVelho); if (i < 0) return "naoMembro";
      var novo = {}; Object.keys(tc).forEach(function (k) { novo[k] = tc[k]; });
      novo.nome = String(p.nome || tc.nome).slice(0, 16); novo.num = p.num || null; novo.auth = p.auth || uidNovo; novo.saiu = null;
      s.tec[uidNovo] = novo; delete s.tec[uidVelho];
      s.ordem[i] = uidNovo;
      delete s.pedidos[uidNovo];
      if (s.recusados) delete s.recusados[uidNovo];
      return null;
    });
  };
  /** O dono encerra a sala (ela some para todos). */
  P.encerrar = function () {
    var S = this, m = S._naoPodeSala(true); if (m && m !== "conexao") return recusa(m);
    var rede = S.rede;
    S.parar(true);
    esquecer(S.codigo, S._armazem);
    return rede.apagar().then(function () { return { ok: true, estado: "aceito" }; }, function () { return { ok: false, estado: "recusado", motivo: "rede" }; });
  };

  /* ---------- parar e sair ---------- */
  /** Para os relógios e os ouvintes (a sala continua guardada; abrir() volta a ela). */
  P.parar = function (semGuardar) {
    var S = this;
    if (S.parado) return;
    if (!semGuardar) S.guardarHora(true);
    S._tiraPresenca();
    S.parado = true;
    S._limpaTimer(); S._limpaBate();
    S._paraOuvir.forEach(function (f) { try { f(); } catch (e) {} });
    S._paraOuvir = [];
    if (S._tiraVisibilidade) S._tiraVisibilidade();
    if (S.online && S.rede.fechar) { try { S.rede.fechar(); } catch (e) {} }
    if (_atual === S) _atual = null;
  };
  /** "Sair da sala": no treino, encerra e apaga a sala deste aparelho. No online: o pedido sai; no saguão o técnico sai
   *  (o dono encerra a sala); depois do Começar o clube fica e PASSA sozinho até o fim (§1.4). */
  P.sair = function () {
    var S = this, rede = S.rede, treino = S.treino;
    if (!S.online) {
      S.parar(treino);
      if (treino) { if (rede.apagar) rede.apagar(); else rede.gravar("", null); }
      return Promise.resolve({ ok: true });
    }
    var s = S.sala, uid = S.uidEu;
    if (s && s.meta && s.meta.dono === uid && s.meta.estado === "saguao") return S.encerrar();
    var fn = null;
    if (S.pedido) fn = function (x) { if (x.pedidos) delete x.pedidos[uid]; return null; };
    else if (s && s.meta && s.meta.estado === "saguao") fn = function (x) { if (x.meta.estado === "saguao" && x.tec[uid]) { delete x.tec[uid]; refazBots(x); } return null; };
    else if (S.eu >= 0) fn = function (x) { if (x.tec[uid]) x.tec[uid].saiu = true; return null; };
    S._saindo = true;
    var p = fn && !S.apagada ? S._transSala(fn) : Promise.resolve({ ok: true });
    var limite = new Promise(function (ok) { S._agendar(function () { ok({ ok: false }); }, 4000); });
    return Promise.race([p, limite]).then(function (r) {
      esquecer(S.codigo, S._armazem);
      S.parar(true);
      return { ok: true, estado: "aceito", gravou: !!r.ok };
    });
  };
  // a página escondida: o treino para (a pessoa não perde lotes atendendo o telefone); o online para de bater (os outros
  // a veem ausente) e, de volta depois de > 5 s, reconecta e fica "Atualizando…" até o ack do próximo bate
  P._ligaVisibilidade = function () {
    var S = this, doc = S._doc || global.document;
    if (!doc || !doc.addEventListener) return;
    if (S._relogio) {
      if (!global.addEventListener) return;
      var vis = function () { S.segurar("pagina", !!doc.hidden); };
      var sai = function () { S.guardarHora(true); };
      doc.addEventListener("visibilitychange", vis);
      global.addEventListener("pagehide", sai);
      S._tiraVisibilidade = function () { doc.removeEventListener("visibilitychange", vis); global.removeEventListener("pagehide", sai); };
      if (doc.hidden) S.segurar("pagina", true);
      return;
    }
    if (!S.online) return;
    var vis2 = function () { S._visivel(!doc.hidden); };
    doc.addEventListener("visibilitychange", vis2);
    S._tiraVisibilidade = function () { doc.removeEventListener("visibilitychange", vis2); };
    if (doc.hidden) S._visivel(false);
  };

  /* ---------- Minhas salas: o índice das salas online deste aparelho ---------- */
  function indiceOnline(armazem) {
    var a = armazem || armazemPadrao();
    try { var x = a.ler(CHAVE_ONLINE, []); return Array.isArray(x) ? x.slice() : []; } catch (e) { return []; }
  }
  function gravaIndice(armazem, ind) {
    var a = armazem || armazemPadrao();
    try { if (ind.length) a.gravar(CHAVE_ONLINE, ind); else a.apagar(CHAVE_ONLINE); } catch (e) {}
  }
  function poeIndice(armazem, entrada) {
    var ind = indiceOnline(armazem).filter(function (x) { return x && x.codigo !== entrada.codigo; });
    ind.unshift(entrada);
    gravaIndice(armazem, ind.slice(0, 20));
  }
  /** Tira a sala online das "Minhas salas" deste aparelho. */
  function esquecer(codigo, armazem) {
    var ind = indiceOnline(armazem), fora = ind.filter(function (x) { return x && x.codigo !== codigo; });
    if (fora.length !== ind.length) gravaIndice(armazem, fora);
  }
  function noIndice(codigo, armazem) { return indiceOnline(armazem).some(function (x) { return x && x.codigo === codigo; }); }
  // o resumo da sala para as Minhas salas (gravado quando muda)
  P._guardaIndice = function () {
    var S = this, s = S.sala;
    if (!S.online || !s || !s.meta || S.parado) return;
    var uid = S.uidEu, tc = (s.tec && s.tec[uid]) || null, v = S.vivoN;
    var e = {
      codigo: S.codigo, online: true, treino: false, liga: s.cfg && s.cfg.liga, ligaNome: (s.cfg && s.cfg.ligaNome) || "",
      T: S._ordem().length, estado: s.meta.estado, fase: v ? v.fase : null, k: v ? v.k : -1, criada: num(s.meta.criada, 0),
      clube: tc ? tc.clube : null, regrasOk: s.meta.regras === LE().REGRAS, pedido: !!(S.pedido && S.pedido.estado === "esperando"),
      edicao: s.meta.edicao || "public", alterada: !!S.alterada, formato: formatoDe(s.cfg && s.cfg.formato)
    };
    var chave = JSON.stringify([e.estado, e.T, e.clube, e.pedido, e.ligaNome, e.regrasOk, e.alterada]);
    if (chave === S._indiceVisto) return;
    S._indiceVisto = chave;
    poeIndice(S._armazem, e);
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
    if (S.online) { S._ligaOnline(); S._guardaIndice(); }
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
      identidadesBots(semente, nb, [clube.cor], 1, false).forEach(function (b) { tec[b.uid] = { nome: b.nome, papel: b.papel, pronto: true, entrou: b.entrou, clube: b.clube, formacao: b.formacao }; });
      var sala = {
        meta: { dono: uid, proto: PROTO, regras: L.REGRAS, versaoTM: versao(), edicao: edicao(), criada: TS, estado: "saguao", semente: semente, atividade: TS, treino: true },
        cfg: { liga: opc.liga, ligaNome: lg.name || opc.liga, T: T, tempo: tempo, formato: formatoDe(opc.formato), overall: "mostra" },
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

  /* ---------- o online: criar, entrar e abrir ---------- */
  function opcEdicao(opc) { return opc.edicao ? opc.edicao() : edicao(); }
  function opcLiberada(opc) { if (opc.suUnlocked) return !!opc.suUnlocked(); try { return !!(TM.storage && TM.storage.suUnlocked && TM.storage.suUnlocked()); } catch (e) { return false; } }
  function opcTroca(opc, ed) { if (opc.trocarEdicao) return opc.trocarEdicao(ed); try { if (TM.storage && TM.storage.switchEdition) TM.storage.switchEdition(ed); } catch (e) {} return ed; }
  function opcSuspenso(opc) { if (opc.fairplay) return !!opc.fairplay(); try { return !!(TM.fairplay && TM.fairplay.status && TM.fairplay.status().banned); } catch (e) { return false; } }
  function redePara(codigo, opc) {
    if (opc.redePara) return opc.redePara(codigo);
    try { return TM.leilaoRede.firebase(codigo); } catch (e) { throw (e && e.codigo ? e : erroCod("indisponivel")); }
  }
  function identidade(opc) { var id = opc.id || idPadrao(); if (!id || !id.uid) throw erroCod("conta"); return id; }
  function abrirCom(rede, codigo, opc, id) {
    var S = new Sessao(rede, Object.assign({}, opc, { online: true, id: id }));
    return S._carregar({}).then(function () { return comeca(S, opc); }, function (e) { try { rede.fechar(); } catch (er) {} throw e; });
  }
  // a sala vencida pela hora ESTIMADA (só para recusar a entrada; quem apaga é a sessão de quem é da sala, pela testemunha)
  function vencidaEstimada(s, agora) {
    var atv = Math.max(num(s.meta.atividade, 0), num(s.meta.criada, 0));
    return agora > atv + (s.meta.estado === "saguao" ? SAGUAO_MS : VIDA_MS) + 60000;
  }
  /** Cria a sala online: o código nasce por transação de null (colidiu: tenta outro, até 6 vezes). */
  function criarSala(opc) {
    opc = opc || {};
    var L = LE();
    return Promise.resolve().then(function () {
      var id = identidade(opc);
      if (opcSuspenso(opc)) throw erroCod("fairplay");
      var vagas = Math.floor(num(opc.vagas, 4)), nb = Math.floor(num(opc.bots, 0));
      if (!(vagas >= L.TEC_MIN && vagas <= L.TEC_MAX) || !(nb >= 0 && nb <= vagas - 1)) throw erroCod("vagas");
      var tempo = num(opc.tempo, L.DUR); if (tempo < 1000) tempo *= 1000;
      if (L.TEMPOS.indexOf(tempo) < 0) tempo = L.DUR;
      var formacao = L.FORMACOES.indexOf(opc.formacao) >= 0 ? opc.formacao : "4-4-2";
      var ligaNome = opc.ligaNome;
      if (!ligaNome) {
        var mundo = opc.mundo || null;
        try { if (!mundo && TM.data && TM.data.world) mundo = TM.data.world(); } catch (e) { mundo = null; }
        var lg = mundo && mundo.leaguesById && mundo.leaguesById[opc.liga];
        if (!lg) throw erroCod("liga");
        ligaNome = lg.name || opc.liga;
      }
      var semente = String(opc.semente != null ? opc.semente : u32());
      var clube = limpaClube(opc.clube || clubeDoUltimate() || CLUBE_PADRAO);
      function tenta(n) {
        var codigo = String(n === 0 && opc.codigo ? opc.codigo : novoCodigo()), rede = redePara(codigo, opc), TS = rede.TS;
        var tec = {};
        tec[id.uid] = { nome: id.nome, num: id.num || null, papel: "dono", pronto: true, auth: id.auth, entrou: 0, clube: clube, formacao: formacao };
        var sala = {
          meta: { dono: id.uid, proto: PROTO, regras: L.REGRAS, versaoTM: versao(), edicao: opcEdicao(opc), criada: TS, estado: "saguao", semente: semente, atividade: TS },
          cfg: { liga: opc.liga, ligaNome: String(ligaNome), vagas: vagas, bots: nb, tempo: tempo, formato: formatoDe(opc.formato), overall: "mostra" },
          tec: tec
        };
        refazBots(sala);
        return rede.transacao("sala", function (cur) { return cur == null ? sala : undefined; }).then(function (res) {
          if (res.feito) return { rede: rede, codigo: codigo };
          try { rede.fechar(); } catch (e) {}
          if (n >= 5) throw erroCod("rede", "Não foi possível criar a sala. Tente de novo.");
          return tenta(n + 1);
        });
      }
      return tenta(0).then(function (r) { return abrirCom(r.rede, r.codigo, opc, id); });
    });
  }
  /** Entra com o código (ou o link): quem já é da sala volta; os outros fazem o PEDIDO (o dono aceita). Depois do
   *  Começar o pedido continua valendo, para o dono passar o clube de quem trocou de aparelho. */
  function entrar(codigo, opc) {
    opc = opc || {};
    var L = LE();
    return Promise.resolve().then(function () {
      var cod = limpaCodigo(codigo);
      if (cod.length !== 6) throw erroCod("codigo");
      var id = identidade(opc);
      if (opcSuspenso(opc)) throw erroCod("fairplay");
      var rede = redePara(cod, opc);
      function falha(c) { try { rede.fechar(); } catch (e) {} throw erroCod(c); }
      return rede.ler("sala").then(function (s) {
        if (!s || !s.meta) { esquecer(cod, opc.armazem); falha("naoExiste"); }
        // quem já é da sala sempre volta (mesmo com outra versão do TM; com outras regras, só olha)
        if ((s.tec && s.tec[id.uid]) || (s.pedidos && s.pedidos[id.uid])) return abrirCom(rede, cod, opc, id);
        if (s.recusados && s.recusados[id.uid]) falha("recusado");
        if (s.meta.regras !== L.REGRAS) falha("regras");
        if (vencidaEstimada(s, rede.horaServidor())) falha("vencida");
        var ed = s.meta.edicao === "pro" ? "pro" : "public";
        if (ed !== opcEdicao(opc)) { if (ed === "pro" && !opcLiberada(opc)) falha("edicao"); opcTroca(opc, ed); }
        if (s.meta.estado === "saguao" && lotada(s)) falha("cheia");
        var motivo = null, minha = opcEdicao(opc), clube = limpaClube(opc.clube || clubeDoUltimate() || CLUBE_PADRAO);
        var formacao = L.FORMACOES.indexOf(opc.formacao) >= 0 ? opc.formacao : "4-4-2";
        return rede.transacao("sala", function (cur) {
          motivo = null;
          if (!cur || !cur.meta) { motivo = "naoExiste"; return undefined; }
          if (cur.tec && cur.tec[id.uid]) { motivo = "membro"; return undefined; }
          if (cur.recusados && cur.recusados[id.uid]) { motivo = "recusado"; return undefined; }
          if (cur.meta.regras !== L.REGRAS) { motivo = "regras"; return undefined; }
          if ((cur.meta.edicao === "pro" ? "pro" : "public") !== minha) { motivo = "edicao"; return undefined; }
          if (cur.meta.estado === "saguao" && lotada(cur)) { motivo = "cheia"; return undefined; }
          cur.pedidos = cur.pedidos || {};
          cur.pedidos[id.uid] = { nome: id.nome, num: id.num || null, auth: id.auth, clube: clube, formacao: formacao, versaoTM: versao(), edicao: minha, ts: rede.TS,
            depois: cur.meta.estado !== "saguao" ? true : null };
          cur.meta.atividade = rede.TS;
          return cur;
        }).then(function (res) {
          if (!res.feito && motivo !== "membro") falha(motivo || "rede");
          return abrirCom(rede, cod, opc, id);
        });
      });
    });
  }
  /** Volta a uma sala guardada (o treino depois de recarregar a página; a online das Minhas salas, conferindo se ela
   *  ainda existe), ou abre outro "aparelho" (opc.rede). */
  function abrir(codigo, opc) {
    opc = opc || {};
    if (opc.online || (!opc.rede && noIndice(codigo, opc.armazem))) {
      var id;
      try { id = identidade(opc); } catch (e) { return Promise.reject(e); }
      var rede = opc.rede;
      try { if (!rede) rede = redePara(codigo, opc); } catch (e) { return Promise.reject(e); }
      return rede.ler("sala").then(function (s) {
        if (!s || !s.meta) { esquecer(codigo, opc.armazem); try { rede.fechar(); } catch (e) {} throw erroCod("naoExiste"); }
        if (!(s.tec && s.tec[id.uid]) && !(s.pedidos && s.pedidos[id.uid])) { esquecer(codigo, opc.armazem); try { rede.fechar(); } catch (e) {} throw erroCod("naoMembro"); }
        return abrirCom(rede, codigo, opc, id);
      });
    }
    var rede2 = opc.rede, relogio = null;
    if (!rede2) { var R = redeTreino(String(codigo), opc); rede2 = R.rede; relogio = R.relogio; }
    var S = new Sessao(rede2, Object.assign({}, opc, { _relogio: relogio }));
    return S._carregar(Object.assign({}, opc, { retomar: !!relogio })).then(function () { return comeca(S, opc); });
  }
  /** As salas guardadas neste aparelho ("Minhas salas"): os treinos e as salas online, da mais nova para a mais antiga. */
  function salas(opc) {
    opc = opc || {};
    var armazem = opc.armazem || armazemPadrao(), out = [];
    TM.leilaoRede.salasGuardadas(armazem).forEach(function (c) {
      var a = null; try { a = armazem.ler(TM.leilaoRede.CHAVE_SALA + c, null); } catch (e) { a = null; }
      var s = a && a.sala; if (!s || !s.meta) return;
      var v = a.vivo || {}, ordem = s.ordem || ordemPrevista(s), dono = s.tec && s.tec[s.meta.dono];
      out.push({
        codigo: c, treino: !!s.meta.treino, online: false, liga: s.cfg && s.cfg.liga, ligaNome: (s.cfg && s.cfg.ligaNome) || "", T: ordem.length,
        estado: s.meta.estado, fase: v.fase || null, k: num(v.k, -1), criada: num(s.meta.criada, 0),
        clube: dono ? dono.clube : null, regrasOk: s.meta.regras === LE().REGRAS, formato: formatoDe(s.cfg && s.cfg.formato)
      });
    });
    indiceOnline(armazem).forEach(function (x) { if (x && x.codigo) out.push(x); });
    return out.sort(function (x, y) { return y.criada - x.criada; });
  }
  /** Confere as salas online das Minhas salas: tira as que não existem mais. Promise(salas()). */
  function conferirSalas(opc) {
    opc = opc || {};
    var ind = indiceOnline(opc.armazem);
    return Promise.all(ind.map(function (x) {
      var rede = null;
      try { rede = redePara(x.codigo, opc); } catch (e) { return null; }
      return rede.ler("sala").then(function (s) { try { rede.fechar(); } catch (e) {} if (!s || !s.meta) esquecer(x.codigo, opc.armazem); }, function () { try { rede.fechar(); } catch (e) {} });
    })).then(function () { return salas(opc); });
  }

  TM.leilaoSessao = {
    PROTO: PROTO, ESCAL_MS: ESCAL_MS, MAX_TREINOS: MAX_TREINOS, NOMES_BOT: NOMES_BOT, CLUBES_BOT: CLUBES_BOT,
    BATE_MS: BATE_MS, AUSENTE_MS: AUSENTE_MS, ACK_MS: ACK_MS, ESCALONA_MS: ESCALONA_MS, SAGUAO_MS: SAGUAO_MS, VIDA_MS: VIDA_MS,
    criarTreino: criarTreino, criarSala: criarSala, entrar: entrar, abrir: abrir, salas: salas, conferirSalas: conferirSalas,
    esquecer: esquecer, limpaCodigo: limpaCodigo, textoMotivo: textoMotivo, limpaClube: limpaClube,
    /** O clube com que a pessoa começa (o do Ultimate, se houver; senão "Meu Clube"): a Criar sala mostra e deixa mudar. */
    clubeInicial: function () { return clubeDoUltimate() || limpaClube(CLUBE_PADRAO); },
    atual: function () { return _atual; },
    /** Gancho de teste: o relógio dos treinos (o atual e os próximos) anda `fator` vezes mais rápido. */
    acelerar: function (fator) { FATOR = fator > 0 ? fator : 1; if (_atual) _atual.acelerar(FATOR); },
    // as funções puras da sala (os testes conferem)
    _sala: { refazBots: refazBots, prontosDe: prontosDe, lotada: lotada, ordemPrevista: ordemPrevista, corLivre: corLivre }
  };
})(window);
