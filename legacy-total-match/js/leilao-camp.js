/* ================= TOTAL MATCH — Modo Leilão: o campeonato (o núcleo PURO) ================= */
/* Plano: PLANO-LEILAO.md §1.7 (os formatos e as partidas), §1.8 (o fim), §3.2 (o nó jogos/{id}), §3.3 (quem age) e §3.6
   (a simulação). Sem DOM, sem rede e sem relógio: toda hora chega como argumento (a do servidor, pela testemunha) e todo
   sorteio é o TM.rng com a semente da sala. As MESMAS funções rodam no treino, dentro das transações do Firebase e nos
   testes em Node (ferramentas/testar-leilao.mjs, bloco C).

   Os formatos (cfg.formato da sala):
     mata    mata-mata em jogo único (o padrão). Empate: prorrogação com GOL DE OURO (91'–120', o 1º gol acaba) e, seguindo
             empatado, pênaltis. T que não é potência de 2: a semente escolhe quem folga na 1ª rodada (as folgas espalhadas
             pela chave). 2 rodadas com 4 técnicos, 3 com 8
     pontos  pontos corridos, turno e returno, 3/1/0; com T ímpar uma folga por rodada. 6 rodadas com 4, 14 com 8
     misto   turno único e depois o mata-mata dos classificados: até 4 técnicos, os 2 primeiros fazem a final; de 5 a 8, os
             4 primeiros (1º × 4º, 2º × 3º) e a final. 4 rodadas com 4, 9 com 8
   Desempate da tabela: pontos, saldo, gols pró, confronto direto (a tabela só dos jogos entre os empatados, de novo entre
   os que seguem empatados), o sorteio pela semente e o técnico. Tudo pela ordem do calendário, nunca pela das chaves do
   objeto `jogos` (o Firebase devolve as chaves na ordem dele).

   Os jogos: o id diz a fase e o lugar — "r{rodada}j{k}" na fase de pontos (rodada 1, 2… do campeonato) e "m{rodada do
   mata-mata}j{par}" no mata-mata (o par é o lugar na chave: "m2j0" = o vencedor de m1j0 × o de m1j1). A próxima rodada abre
   quando todos os jogos da atual estão feitos (o feito nunca volta: quem vê a rodada aberta vê certo).

   A máquina de cada jogo (jogos/{id}; UMA transação por passo; ninguém recalcula para mostrar):
     (sem nó)   a rodada abriu e ninguém mexeu
     aberto     { e, ini, resta, parado? } o prazo de 2 min para começar (só no jogo de uma pessoa contra um bot): corre de
                `ini` com `resta` ms; com ninguém do jogo presente fica `parado` (guarda o que resta) e volta a correr quando
                alguém do jogo volta
     reservado  { e, ab, esc, modo, por, motivo, trava, inicio?, abriu? } a escolha está feita: os técnicos (ab), as escalações
                GRAVADAS no momento (esc: [{ formacao, tit }, …]; vale a partir do próximo jogo que não começou), o modo
                ('simulado' ou '3d': o "Jogar" da pessoa contra um bot, com o `inicio` = a trava e, quando o 3D chega a abrir
                — a tela antes do jogo à vista —, o `abriu` = a hora do servidor) e a TRAVA = a hora do servidor ao reservar.
                O simulado é comSemente("leilao:" + código + ":" + id + ":" + trava): ninguém o calcula antes de escolher
     feito      { …o reservado, e, res, ts, fim?, escSim? } o resultado, gravado UMA vez (o reservado com a mesma trava) e só
                então mostrado. No 3D, `fim` diz como ele acabou: '3d' (o resultado do 3D; o que veio depois dos 90' no
                mata-mata empatado — o gol de ouro e os pênaltis — é simulado com a semente) ou 'simulado' (o "Simular partida"
                da tela do 3D, ou o 3D que nem chegou a abrir no prazo de começar; escSim = as escalações da tela, só quando
                mudaram)
   O PAR (PR 5; só nas salas de regras ≥ 4, c.par): o jogo de DUAS pessoas no Online 3D, cada uma no seu aparelho. O nó
   ganha `par: true`, `vem0`/`vem1` (a hora do servidor em que cada lado tocou em "Jogar"; o de quem reservou = o inicio) e o
   `abriu` (o 1º 3D à vista, de qualquer lado, só com os dois). Antes do toque, como o jogo contra um bot: o prazo de 2 min
   (aberto) que só corre com uma das duas presente e, vencido, o simulado. O 1º "Jogar" reserva (reservarPar) e o outro tem
   2 min (desde o inicio) para tocar também (entrarPar; o toque dele vem DEPOIS do inicio): sem ele, W.O. de quem não veio
   (naoVeio, `woPor: 'naoVeio'`) se ele estava na sala sem buraco desde o chamado; fora dela, o simulado (naoAbriu).
   Com os dois: 2 min (desde o 2º toque) para o 3D abrir e, aberto, o prazo da partida (2 × duração × 1,3 + 8 min + as
   pausas combinadas, 6 min, desde o abriu: prazoPar); vencido qualquer um dos dois sem resultado, o simulado (naoAbriu; a
   ligação que não dá — sem TURN — é isso). O resultado: o do 3D (gravar '3d', de qualquer um dos dois aparelhos: o mesmo
   jogo nos dois; só com o abriu), o simulado (gravar 'simulado': qualquer um escolheu Simular, a ligação falhou ou caiu no
   meio, os aparelhos dessincronizaram) ou o W.O. de quem SAIU no meio (woPar, `woPor: 'saiu'`, só com o abriu: o "Sair da
   partida" dele, avisado pelo 3D do outro, ou ele mesmo saiu/aceitou o W.O.).
   Motivos de reservar: 'pedido' (a pessoa do jogo tocou em Simular ou em Jogar), 'prazo' (o prazo venceu pela testemunha da
   hora), 'abertura' (bot × bot; pessoa × pessoa nas salas de regras 1 a 3, antes do par), 'dono' (Simular os pendentes) e 'pendentes' (o mesmo botão tocado por
   outro técnico, com o dono fora há mais de 5 min). O 3D reservado que abriu e passa de 2 × duração × 1,3 + 8 min (desde o
   `inicio`) sem resultado é W.O. de quem reservou (decisão 15); o que não chegou a abrir em 2 min é simulado (por qualquer
   aparelho, com a semente). Quem reservou pode aceitar o W.O. antes do prazo (o 3D fechou sem resultado: `desistir`; o feito
   leva `desistiu: true`).

   O resultado gravado (`res`): o do motor nos 90' (score, events, stats, sentOff) e, no mata-mata empatado, `pror` { score,
   events (91' em diante, cortados no gol de ouro), ouro (o lado que fez o gol de ouro) } e `pen` { score, kicks: [{ side,
   name, scored, id }], winner }; `placar` = o que conta (o dos 90' ou o do fim da prorrogação) e `v` o vencedor (0 ou 1,
   o lado; -1 = empate, só na fase de pontos). W.O.: { placar, score, wo (o lado que perdeu), v }. O do 3D (resDo3d): o mesmo
   formato, com em3d: true, os gols e cartões do 3D como lances do motor e as estatísticas dele.

   API (TM.leilaoCamp):
     contexto(o)                 o: { codigo, semente, formato, T, ctx (o do TM.leilao), vivo, clubes [t], tipos ['bot'|'pessoa'],
                                    escal, prefs, inicio, duracao3d, dificuldade3d, par (a sala tem o par: regras ≥ 4) } → c (o campeonato; as contas abaixo recebem c)
     duracao3dDe(x) · dificuldade3dDe(x) (a duração e a dificuldade do 3D da sala; padrões 4 min e 'normal')
     formatoDe(nome) · rodadasDe(formato, T) · jogosDe(formato, T) · duracaoEstimada({ T, tempo, formato, tresD?, duracao3d? })
     estrutura(c) · montar(c, jogos) (a vista: rodadas, jogos, tabela, atual, fim, campeão,
     classificação, artilharia, o melhor time) · tabela(c, jogos) · artilharia(c, jogos) · somaNotas(c)
     timeDoTecnico(c, t, esc?) · escalacaoDoJogo(c, t) · simularJogo(a, b, { semente, mataMata }) · sementeJogo(codigo, id, trava)
     resultadoDoJogo(c, id, j) (o simulado com a semente do jogo) · resDo3d(c, id, j, r3) (o resultado do 3D → o res) ·
     res3dValido(c, id, j) · escDaTela(c, j, titulares) (as escalações da tela do 3D, se mudaram)
     A máquina (cada uma devolve { ok: true, jogo } ou { ok: false, motivo }): abrir, pausar, retomar, reservar, marcarAbriu,
     gravar, naoAbriu, wo, desistir; o par: reservarPar, entrarPar, naoVeio, woPar (e vieram(j), vemDe(j, lado), ladoDe(j, t))
     proximaAcao(c, g, info) (o que fazer agora com um jogo da vista) · conferirJogo(c, g, j) (o motivo, se a sala foi alterada)
     canon(v) (o texto canônico, como o Firebase guarda) */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  var FORMATOS = ["mata", "pontos", "misto"];
  var PRAZO = 120000;               // 2 min para começar o jogo de uma pessoa contra um bot (só com alguém do jogo presente);
                                    // também o do 3D reservado que não chegou a abrir
  var REALISMO = 3;                 // a sala é fixa para todos: realismo 3, mando neutro
  var DURACAO_3D = 4;               // min por tempo no 3D (o padrão; a sala escolhe uma das DURACOES_3D)
  var DURACOES_3D = [3, 4, 5, 6, 8, 10];
  var DIFICULDADE_3D = "normal";    // a dos bots no 3D (o padrão; a sala escolhe, travada no 3D)
  var DIFICULDADES = ["facil", "normal", "dificil", "lenda"];
  var FINS = ["3d", "simulado"];    // como o 3D acabou (o `fim` do feito)
  var TIPOS_3D = ["goal", "pengoal", "yellow", "red", "half", "full"];   // os lances de um resultado do 3D
  var MODOS = ["simulado", "3d"];
  var MOTIVOS = ["pedido", "prazo", "abertura", "dono", "pendentes"];
  var ESTADOS = ["aberto", "reservado", "feito"];
  var WO = 3;                       // o W.O.: 3 × 0
  var PARA_CORTE = 90;              // a prorrogação começa no 91'

  function LE() { return TM.leilao; }
  function seq(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function inteiro(x) { return typeof x === "number" && isFinite(x) && Math.floor(x) === x; }
  function numero(x) { return typeof x === "number" && isFinite(x); }
  function rngCamp(semente, nome) { return TM.rng.make(TM.rng.hashStr("leilao:" + semente + ":camp:" + nome)); }
  function embaralha(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function cmpId(a, b) { a = String(a); b = String(b); return (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0); }
  function copia(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function duracao3dDe(x) { x = +x; return DURACOES_3D.indexOf(x) >= 0 ? x : DURACAO_3D; }
  function dificuldade3dDe(x) { return DIFICULDADES.indexOf(x) >= 0 ? x : DIFICULDADE_3D; }
  // o Firebase devolve como lista um nó de chaves 0..n e como objeto uma lista com buracos: aceita os dois
  function comoLista(x) {
    if (Array.isArray(x)) return x;
    if (!x || typeof x !== "object") return [];
    var out = []; Object.keys(x).forEach(function (k) { if (/^\d+$/.test(k)) out[+k] = x[k]; });
    return out;
  }
  // o texto canônico de um valor como o Firebase guarda (sem null nem vazio, lista = objeto de índices, chaves em ordem):
  // o resultado recalculado por um aparelho honesto contra o que voltou do servidor
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

  /* ---------- o calendário ---------- */
  /** O formato da sala pelo nome (aceita "mataMata"/"mata-mata" e "pontosCorridos"); desconhecido = o padrão, "mata". */
  function formatoDe(x) {
    var s = String(x == null ? "" : x).toLowerCase().replace(/[^a-z]/g, "");
    if (s === "pontos" || s === "pontoscorridos") return "pontos";
    if (s === "misto") return "misto";
    return "mata";
  }
  function rodadasDe(formato, T) {
    if (!(T >= 2 && T <= 8)) return 0;
    var turnoN = T % 2 ? T : T - 1, mata = 0, P = 1;
    while (P < T) { P *= 2; mata++; }
    if (formato === "pontos") return 2 * turnoN;
    if (formato === "misto") return turnoN + (T <= 4 ? 1 : 2);
    return mata;
  }
  /** Quantos jogos o campeonato tem: T − 1 no mata-mata, T·(T − 1) nos pontos corridos e o turno único + 1 (até 4) ou + 3
   *  jogos do mata-mata no misto. */
  function jogosDe(formato, T) {
    if (!(T >= 2 && T <= 8)) return 0;
    if (formato === "pontos") return T * (T - 1);
    if (formato === "misto") return T * (T - 1) / 2 + (T <= 4 ? 1 : 3);
    return T - 1;
  }
  /** A duração estimada (em minutos) para a Criar sala mostrar. o: { T, tempo (ms do relógio do lote), formato, tresD?,
   *  duracao3d? (min por tempo; padrão 4) } → { leilao: { lo, hi, n (lotes) }, camp: { lo, hi, rodadas, jogos }, total: { lo,
   *  hi } }.
   *   — o leilão: n = os lotes por técnico do leilao.js × T; medido com os robôs nos 1 000 leilões do testar-leilao L7 com 20
   *     por técnico (15/11): ~0,75 × o relógio por lote quando todos passam rápido (2, 4 e 8 técnicos: 0,73, 0,79 e 0,77);
   *     o relógio + 7 s quando ninguém passa (o relógio inteiro, a pausa e a repescagem);
   *   — o campeonato, por rodada: simulado, de ~30 s (quem joga toca em Simular e vê) aos 2 min do prazo; no 3D (PR 4),
   *     de 2 × a duração + 4 min (a partida e as telas) a 2 × a duração × 1,3 + 5 min. */
  function duracaoEstimada(o) {
    o = o || {};
    var L = LE(), T = o.T || 0, n = L.LOTES_POR_TEC * T, s = (o.tempo > 0 ? o.tempo : L.DUR) / 1000;
    var lo = n * 0.75 * s / 60, hi = n * (s + 7) / 60;
    var fmt = formatoDe(o.formato), R = rodadasDe(fmt, T), dur = duracao3dDe(o.duracao3d);
    var clo = o.tresD ? R * (2 * dur + 4) : R * 0.5, chi = o.tresD ? R * (2 * dur * 1.3 + 5) : R * PRAZO / 60000;
    function par(a, b) { var x = Math.max(1, Math.round(a)); return { lo: x, hi: Math.max(x + 1, Math.round(b)) }; }
    var le = par(lo, hi), ca = par(clo, chi);
    return {
      leilao: { lo: le.lo, hi: le.hi, n: n },
      camp: { lo: ca.lo, hi: ca.hi, rodadas: R, jogos: jogosDe(fmt, T) },
      total: { lo: le.lo + ca.lo, hi: le.hi + ca.hi }
    };
  }
  /** Um turno pelo método do círculo: n = T (ou T + 1 com T ímpar: a vaga a mais é a folga); a vaga n − 1 fica parada e as
   *  outras giram (na rodada r, a posição p tem a vaga (p + r) mod (n − 1)). Pares: (posição 0, vaga parada) e
   *  (p, n − 1 − p). O mando: quem está na posição ímpar é o da casa — como cada vaga desce uma posição por rodada, cada
   *  técnico alterna (uma quebra por turno) e fica com a diferença de no máximo 1 entre casa e fora; a vaga parada é da
   *  casa nas rodadas pares. Os técnicos entram nas vagas pela semente (a parada é a folga com T ímpar).
   *  → [ { jogos: [[a, b] …], folga: [t] } × (n − 1) ] */
  function turno(T, semente) {
    var n = T % 2 ? T + 1 : T, perm = embaralha(seq(T), rngCamp(semente, "rodizio")), out = [];
    function tec(vaga) { return vaga < T ? perm[vaga] : -1; }
    for (var r = 0; r < n - 1; r++) {
      var pares = [], jogos = [], folga = [];
      var x0 = r % (n - 1);
      pares.push(r % 2 === 0 ? [n - 1, x0] : [x0, n - 1]);
      for (var p = 1; p < n / 2; p++) {
        var a = (p + r) % (n - 1), b = (n - 1 - p + r) % (n - 1);
        pares.push(p % 2 === 1 ? [a, b] : [b, a]);
      }
      for (var k = 0; k < pares.length; k++) {
        var ta = tec(pares[k][0]), tb = tec(pares[k][1]);
        if (ta < 0) folga.push(tb); else if (tb < 0) folga.push(ta); else jogos.push([ta, tb]);
      }
      out.push({ jogos: jogos, folga: folga });
    }
    return out;
  }
  // a ordem que espalha m lugares (m potência de 2) pela chave: 0, m/2, m/4, 3m/4… (a inversão dos bits)
  function espalha(m) {
    var b = 0, out = [];
    while ((1 << b) < m) b++;
    for (var i = 0; i < m; i++) { var r = 0; for (var k = 0; k < b; k++) if (i & (1 << k)) r |= 1 << (b - 1 - k); out.push(r); }
    return out;
  }
  /** A 1ª rodada do mata-mata: P = a potência de 2 ≥ T; P − T folgas, nos pares espalhados pela chave (nenhuma folga
   *  encontra outra na rodada seguinte enquanto houver jogo para isso); quem folga e quem joga com quem, pela semente. */
  function chaveInicial(T, semente) {
    var P = 1; while (P < T) P *= 2;
    var folgas = P - T, ordem = embaralha(seq(T), rngCamp(semente, "chave")), nPares = P / 2, folgaNo = {}, k = 0, out = [];
    espalha(nPares).slice(0, folgas).forEach(function (i) { folgaNo[i] = true; });
    for (var i = 0; i < nPares; i++) {
      if (folgaNo[i]) out.push([ordem[k++], -1]);
      else { out.push([ordem[k], ordem[k + 1]]); k += 2; }
    }
    return out;
  }
  function nomeMata(nTimes) { return nTimes <= 2 ? "Final" : nTimes <= 4 ? "Semifinal" : "Quartas de final"; }
  // as rodadas do mata-mata a partir dos pares da 1ª (cada lado é uma "fonte": { t }, { venc: id } ou { pos: k } da tabela)
  function montaMata(rod, pares) {
    var k = 1;
    for (;;) {
      var n = rod.length + 1, jogos = [], folgas = [], venc = [];
      for (var i = 0; i < pares.length; i++) {
        var pr = pares[i];
        if (!pr[1]) { folgas.push(pr[0]); venc.push(pr[0]); continue; }
        var id = "m" + k + "j" + i;
        jogos.push({ id: id, src: [pr[0], pr[1]] });
        venc.push({ venc: id });
      }
      rod.push({ n: n, fase: "mata", nome: nomeMata(pares.length * 2), jogos: jogos, folgas: folgas });
      if (pares.length <= 1) return;
      var prox = [];
      for (var j = 0; j < venc.length; j += 2) prox.push([venc[j], venc[j + 1]]);
      pares = prox; k++;
    }
  }
  /** As rodadas do campeonato (o que se sabe sem resultado nenhum): [{ n, fase: 'liga'|'mata', nome, turno?, jogos:
   *  [{ id, src: [fonte A, fonte B] }], folgas: [fonte] }]. A fonte é { t } (o técnico), { venc: id } (o vencedor daquele
   *  jogo) ou { pos: k } (o (k+1)º da tabela da fase de pontos, quando ela acaba). */
  function estrutura(c) {
    var chave = c.formato + "|" + c.T + "|" + c.semente;
    if (c._est && c._est.chave === chave) return c._est.rod;
    var T = c.T, rod = [];
    if (c.formato === "pontos" || c.formato === "misto") {
      var tr = turno(T, c.semente), voltas = c.formato === "pontos" ? 2 : 1;
      for (var v = 0; v < voltas; v++) {
        for (var r = 0; r < tr.length; r++) {
          var n = rod.length + 1;
          rod.push({
            n: n, fase: "liga", nome: "Rodada " + n, turno: v + 1,
            jogos: tr[r].jogos.map(function (pr, k) {
              return { id: "r" + n + "j" + k, src: v ? [{ t: pr[1] }, { t: pr[0] }] : [{ t: pr[0] }, { t: pr[1] }] };
            }),
            folgas: tr[r].folga.map(function (t) { return { t: t }; })
          });
        }
      }
    }
    if (c.formato === "mata") {
      montaMata(rod, chaveInicial(T, c.semente).map(function (pr) { return [{ t: pr[0] }, pr[1] < 0 ? null : { t: pr[1] }]; }));
    } else if (c.formato === "misto") {
      montaMata(rod, T <= 4 ? [[{ pos: 0 }, { pos: 1 }]] : [[{ pos: 0 }, { pos: 3 }], [{ pos: 1 }, { pos: 2 }]]);
    }
    c._est = { chave: chave, rod: rod };
    return rod;
  }
  function ehMata(id) { return String(id).charAt(0) === "m"; }

  /* ---------- o resultado gravado: leitura ---------- */
  function placarOk(p) { p = comoLista(p); return p.length === 2 && inteiro(p[0]) && inteiro(p[1]) && p[0] >= 0 && p[1] >= 0; }
  // o vencedor pelo que está gravado: os pênaltis, senão o placar que conta; -1 = empate
  function vencedorDe(res) {
    if (!res) return null;
    if (res.pen && (res.pen.winner === 0 || res.pen.winner === 1)) return res.pen.winner;
    var p = comoLista(res.placar);
    return p[0] > p[1] ? 0 : p[1] > p[0] ? 1 : -1;
  }
  /** O resultado tem a forma certa? (o placar que conta, o vencedor coerente; no mata-mata nunca empate) */
  function resValido(res, mata) {
    if (!res || typeof res !== "object" || !placarOk(res.placar) || !placarOk(res.score)) return false;
    var v = res.v, venc = vencedorDe(res);
    if (v !== venc || !(v === -1 || v === 0 || v === 1)) return false;
    if (mata && v < 0) return false;
    if (res.wo != null) {
      var p = comoLista(res.placar);
      return (res.wo === 0 || res.wo === 1) && p[res.wo] === 0 && p[1 - res.wo] === WO && v === 1 - res.wo;
    }
    if (!comoLista(res.events).length) return false;
    var esperado = res.pror ? res.pror.score : res.score;
    if (!placarOk(esperado) || canon(comoLista(esperado)) !== canon(comoLista(res.placar))) return false;
    if (res.pror && !mata) return false;
    if (res.pen) {
      var pp = comoLista(res.placar);
      if (pp[0] !== pp[1] || !res.pror || !placarOk(res.pen.score)) return false;
    }
    return true;
  }

  /* ---------- a vista: as rodadas resolvidas pelos jogos gravados ---------- */
  // a tabela de uma lista de jogos { a, b, placar } (só os feitos)
  function linhas(T, js) {
    var rows = seq(T).map(function (t) { return { t: t, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 }; });
    js.forEach(function (g) {
      var p = comoLista(g.placar), A = rows[g.a], B = rows[g.b];
      if (!A || !B) return;
      A.j++; B.j++; A.gp += p[0]; A.gc += p[1]; B.gp += p[1]; B.gc += p[0];
      if (p[0] > p[1]) { A.v++; B.d++; A.pts += 3; } else if (p[1] > p[0]) { B.v++; A.d++; B.pts += 3; } else { A.e++; B.e++; A.pts++; B.pts++; }
    });
    rows.forEach(function (r) { r.sg = r.gp - r.gc; });
    return rows;
  }
  function cmpLinha(x, y) { return (y.pts - x.pts) || (y.sg - x.sg) || (y.gp - x.gp); }
  // separa os técnicos em blocos de empatados (pts, saldo, gols pró), do melhor para o pior
  function blocos(ts, porT) {
    var o = ts.slice().sort(function (a, b) { return cmpLinha(porT[a], porT[b]) || (a - b); }), out = [];
    o.forEach(function (t) {
      var ult = out[out.length - 1];
      if (ult && cmpLinha(porT[ult[0]], porT[t]) === 0) ult.push(t); else out.push([t]);
    });
    return out;
  }
  function sorteioDe(c) {
    if (c._sorteio) return c._sorteio;
    var perm = embaralha(seq(c.T), rngCamp(c.semente, "desempate")), s = [];
    perm.forEach(function (t, i) { s[t] = i; });
    return (c._sorteio = s);
  }
  // os empatados: o confronto direto (a tabela só dos jogos entre eles); quem ainda empata num grupo MENOR volta ao confronto
  // direto só entre si; o grupo que não diminui vai ao sorteio pela semente e, por fim, ao técnico
  function desempata(ts, js, sorteio, T) {
    if (ts.length < 2) return ts.slice();
    var dentro = {}; ts.forEach(function (t) { dentro[t] = 1; });
    var mini = linhas(T, js.filter(function (g) { return dentro[g.a] && dentro[g.b]; })), out = [];
    blocos(ts, mini).forEach(function (b) {
      if (b.length === 1) out.push(b[0]);
      else if (b.length < ts.length) out.push.apply(out, desempata(b, js, sorteio, T));
      else out.push.apply(out, b.slice().sort(function (x, y) { return (sorteio[x] - sorteio[y]) || (x - y); }));
    });
    return out;
  }
  function ordemTabela(c, js) {
    var rows = linhas(c.T, js), sorteio = sorteioDe(c), out = [];
    blocos(seq(c.T), rows).forEach(function (b) { out.push.apply(out, desempata(b, js, sorteio, c.T)); });
    return out.map(function (t, i) { var r = rows[t]; r.pos = i + 1; return r; });
  }
  function noValido(j, mata) {
    if (!j || typeof j !== "object" || ESTADOS.indexOf(j.e) < 0) return false;
    if (j.e === "aberto") return numero(j.resta) && (j.parado ? true : numero(j.ini));
    var ab = comoLista(j.ab);
    if (ab.length !== 2 || !inteiro(ab[0]) || !inteiro(ab[1]) || MODOS.indexOf(j.modo) < 0 || !numero(j.trava)) return false;
    if (j.e === "feito") return resValido(j.res, mata);
    return true;
  }
  /** A vista do campeonato a partir dos jogos GRAVADOS (nada recalcula partida):
   *  { rodadas: [{ n, fase, nome, turno?, jogos: [{ id, a, b, src, j, e ('espera'|'livre'|'aberto'|'reservado'|'feito'),
   *    aberta (a rodada dele abriu), invalido (o nó não tem a forma certa), mata, res, placar, venc }], folgas: [t], aberta,
   *    feita, abre (a hora em que abriu: o maior `ts` da anterior) }], atual (a rodada da vez; -1 no fim), tabela (a fase de
   *    pontos; null no mata-mata), ligaFeita, fim, campeao, classificacao, artilharia, melhorTime } */
  function montar(c, jogos0) {
    var jogos = jogos0 || {}, rod = estrutura(c), porId = {}, jsLiga = [], ligaFeita = true, tab = null;
    var out = { rodadas: [], atual: -1, tabela: null, ligaFeita: false, fim: false, campeao: null, classificacao: [], artilharia: [], melhorTime: null };
    var anteriorFeita = true, abre = numero(c.inicio) ? c.inicio : 0;
    function resolve(s) {
      if (!s) return null;
      if (s.t != null) return s.t;
      if (s.venc != null) { var g = porId[s.venc]; return g && g.venc != null ? g.venc : null; }
      if (s.pos != null) return tab && ligaFeita ? (tab[s.pos] ? tab[s.pos].t : null) : null;
      return null;
    }
    rod.forEach(function (r) {
      if (r.fase === "mata" && !tab && c.formato === "misto") tab = ordemTabela(c, jsLiga);
      var R = { n: r.n, fase: r.fase, nome: r.nome, turno: r.turno || null, jogos: [], folgas: [], aberta: false, feita: true, abre: null };
      var completa = true;
      r.jogos.forEach(function (gj) {
        var a = resolve(gj.src[0]), b = resolve(gj.src[1]), mata = r.fase === "mata";
        var j = jogos[gj.id] != null ? jogos[gj.id] : null, ok = noValido(j, mata);
        var g = { id: gj.id, a: a, b: b, src: gj.src, j: ok ? j : null, invalido: j != null && !ok, e: "espera", res: null, placar: null, venc: null, rodada: r.n, mata: mata };
        if (a == null || b == null) completa = false;
        if (ok && j.e === "feito") {
          g.e = "feito"; g.res = j.res; g.placar = comoLista(j.res.placar).slice();
          var v = vencedorDe(j.res);
          g.venc = v === 0 ? a : v === 1 ? b : null;
        } else {
          R.feita = false;
          if (ok) g.e = j.e;
        }
        porId[gj.id] = g;
        R.jogos.push(g);
      });
      R.folgas = r.folgas.map(resolve).filter(function (t) { return t != null; });
      R.aberta = anteriorFeita && completa;
      R.jogos.forEach(function (g) { g.aberta = R.aberta; });
      if (R.aberta) {
        R.abre = abre;
        R.jogos.forEach(function (g) { if (g.e === "espera") g.e = "livre"; });
      }
      if (!R.aberta) R.feita = false;
      if (R.feita) {
        var mx = abre;
        R.jogos.forEach(function (g) { if (numero(g.j.ts) && g.j.ts > mx) mx = g.j.ts; });
        abre = mx;
      }
      if (r.fase === "liga") {
        if (!R.feita) ligaFeita = false;
        R.jogos.forEach(function (g) { if (g.e === "feito") jsLiga.push({ a: g.a, b: g.b, placar: g.placar }); });
      }
      if (out.atual < 0 && !R.feita) out.atual = out.rodadas.length;
      anteriorFeita = anteriorFeita && R.feita;
      out.rodadas.push(R);
    });
    if (c.formato !== "mata") {
      out.tabela = tab || ordemTabela(c, jsLiga);
      out.ligaFeita = ligaFeita;
    }
    out.fim = out.atual < 0 && out.rodadas.length > 0;
    out.artilharia = artilhariaDe(out);
    if (out.fim) {
      out.classificacao = classificacaoDe(c, out);
      out.campeao = out.classificacao[0];
    }
    out.melhorTime = melhorTimeDe(c);
    return out;
  }
  function tabela(c, jogos) { return montar(c, jogos).tabela; }

  /* ---------- o fim: a classificação, a artilharia e o melhor time ---------- */
  // mata-mata e misto: pela rodada até onde chegou (o campeão, o vice, os que caíram na semifinal…); dentro dela, a posição na
  // fase de pontos (misto) ou a campanha nos jogos que fez (mata-mata), depois o sorteio e o técnico
  function classificacaoDe(c, V) {
    if (c.formato === "pontos") return V.tabela.map(function (r) { return r.t; });
    var alcance = seq(c.T).map(function () { return 0; }), jsTodos = [], ultima = null;
    V.rodadas.forEach(function (R, i) {
      if (R.fase !== "mata") return;
      R.folgas.forEach(function (t) { alcance[t] = Math.max(alcance[t], i + 1); });
      R.jogos.forEach(function (g) {
        if (g.a != null) alcance[g.a] = Math.max(alcance[g.a], i + 1);
        if (g.b != null) alcance[g.b] = Math.max(alcance[g.b], i + 1);
        ultima = g;
      });
    });
    V.rodadas.forEach(function (R) { R.jogos.forEach(function (g) { if (g.e === "feito") jsTodos.push({ a: g.a, b: g.b, placar: g.placar }); }); });
    if (ultima && ultima.venc != null) alcance[ultima.venc] += 1;
    var posLiga = [];
    if (V.tabela) V.tabela.forEach(function (r) { posLiga[r.t] = r.pos; });
    var camp = linhas(c.T, jsTodos), sorteio = sorteioDe(c);
    return seq(c.T).sort(function (x, y) {
      return (alcance[y] - alcance[x]) ||
        (V.tabela ? posLiga[x] - posLiga[y] : cmpLinha(camp[x], camp[y])) ||
        (sorteio[x] - sorteio[y]) || (x - y);
    });
  }
  // os gols de cada jogador (90' e prorrogação; os pênaltis da disputa não contam), pela ordem do calendário
  function artilhariaDe(V) {
    var por = {}, lista = [];
    V.rodadas.forEach(function (R) {
      R.jogos.forEach(function (g) {
        if (g.e !== "feito" || !g.res || g.res.wo != null) return;
        var evs = comoLista(g.res.events).concat(g.res.pror ? comoLista(g.res.pror.events) : []);
        evs.forEach(function (e) {
          if (!e || (e.type !== "goal" && e.type !== "pengoal") || e.playerId == null) return;
          var t = e.team === 0 ? g.a : e.team === 1 ? g.b : null;
          if (t == null) return;
          var k = String(e.playerId);
          if (!por[k]) { por[k] = { id: e.playerId, nome: e.player || "", t: t, gols: 0 }; lista.push(por[k]); }
          por[k].gols++;
        });
      });
    });
    return lista.sort(function (x, y) { return (y.gols - x.gols) || (x.t - y.t) || cmpId(x.id, y.id); });
  }
  function artilharia(c, jogos) { return montar(c, jogos).artilharia; }
  /** A soma das notas (overall) dos 11 de cada técnico, do maior para o menor: [{ t, soma }] (empate: o técnico). */
  function somaNotas(c) {
    if (!c.ctx || !c.vivo || !LE()) return [];
    var out = seq(c.T).map(function (t) {
      var s = 0; LE().timeDe(c.vivo, c.ctx, t).forEach(function (l) { s += l.overall || 0; });
      return { t: t, soma: s };
    });
    return out.sort(function (x, y) { return (y.soma - x.soma) || (x.t - y.t); });
  }
  function melhorTimeDe(c) { var s = somaNotas(c); return s.length ? s[0] : null; }

  /* ---------- o time do técnico e a simulação (§3.6) ---------- */
  function claro(cor) {
    var h = String(cor || "").replace("#", "");
    if (h.length !== 6) return false;
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 170;
  }
  /** A escalação do técnico t AGORA (a gravada à mão se ainda vale; senão a automática): { formacao, tit } — a que vai para
   *  o `esc` do jogo ao reservar. */
  function escalacaoDoJogo(c, t) {
    var e = LE().escalacaoDe(c.vivo, c.ctx, t, (c.escal && c.escal[t]) || null, (c.prefs && c.prefs[t]) || "4-4-2");
    return { formacao: e.formacao, tit: e.tit.slice() };
  }
  /** O time do técnico t para o motor (e o 2D/3D): os jogadores na ordem das vagas da formação, com o adjustForSlot (o −1/−2
   *  da função), a camisa pela vaga (o goleiro é o 1) e os grupos GRAVADOS no retrato (o playerVersa não recalcula nada);
   *  o id é único por técnico ("leilao_" + código + "_" + t). esc = { formacao, tit } (o gravado no jogo; sem ele, o de
   *  agora). */
  function timeDoTecnico(c, t, esc) {
    esc = esc || escalacaoDoJogo(c, t);
    var L = LE(), slots = L.slotsDe(esc.formacao) || [], tit = comoLista(esc.tit), cl = (c.clubes && c.clubes[t]) || {};
    var players = [];
    for (var s = 0; s < slots.length; s++) {
      var k = tit[s];
      if (!inteiro(k) || k < 0) continue;
      var l = L.retratoDe(c.ctx, k);
      if (!l) continue;
      var a = {}; Object.keys(l.attrs || {}).forEach(function (x) { a[x] = l.attrs[x]; });
      var p = {
        id: l.id, name: l.name, pos: l.pos, pos2: l.pos2 || null, overall: l.overall, attrs: a,
        nationId: l.nationId || null, clubId: l.clubId || null, homeClubId: l.homeClubId || l.clubId || null,
        number: s + 1, height: l.height || 0, weight: l.weight || 0,
        _versa: (l.grupos || [l.pos]).slice(1)
      };
      players.push(TM.comp && TM.comp.adjustForSlot ? TM.comp.adjustForSlot(p, slots[s]) : p);
    }
    var cor = cl.cor || "#22c55e";
    return {
      id: "leilao_" + c.codigo + "_" + t, t: t, name: cl.nome || ("Técnico " + (t + 1)), short: cl.sigla || "",
      tecnico: (c.nomes && c.nomes[t]) || "", players: players, formation: esc.formacao,
      colors: { primary: cor, secondary: claro(cor) ? "#0b1410" : "#ffffff" },
      escudoUT: { escudo: cl.escudo || "", cor: cor, sigla: cl.sigla || "" }
    };
  }
  function sementeJogo(codigo, id, trava) { return "leilao:" + codigo + ":" + id + ":" + trava; }
  function opcoesMotor(extra) {
    var o = { realism: REALISMO, neutral: true, semLesao: true };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  function semExpulsos(time, fora) {
    var f = {}; fora.forEach(function (id) { f[id] = 1; });
    var ps = time.players.filter(function (p) { return !f[p.id]; });
    return { id: time.id, name: time.name, players: ps.length ? ps : time.players };
  }
  /** A partida simulada com a semente (realismo 3, mando neutro, sem lesão). mataMata: o empate vai à prorrogação com GOL DE
   *  OURO — os 91'–120' do mesmo motor (startMinute/endMinute/startScore, com os expulsos fora e os amarelos valendo),
   *  cortados no 1º gol — e, seguindo empatado, aos pênaltis (TM.engine.shootout, sem os expulsos); cada parte na mesma
   *  semente com um sufixo (":pror", ":pen"). → o `res` gravado (ver o topo). */
  function simularJogo(a, b, o) {
    var sem = String(o.semente);
    var r = TM.rng.comSemente(sem, function () { return TM.engine.simulate(a, b, opcoesMotor()); });
    var res = { score: r.score.slice(), events: r.events, stats: r.stats, placar: r.score.slice(), v: 0 };
    if (r.sentOff && r.sentOff.length) res.sentOff = r.sentOff;
    if (o.mataMata && r.score[0] === r.score[1]) completarMata(res, a, b, sem);
    res.v = vencedorDe(res);
    return res;
  }
  /** O mata-mata empatado nos 90' (o simulado ou o do 3D): a prorrogação com o GOL DE OURO e, seguindo empatado, os pênaltis,
   *  na semente do jogo com os sufixos ":pror" e ":pen" (res.score e res.events = os 90'; os expulsos fora, os amarelos
   *  valendo). Escreve res.pror, res.placar e res.pen. */
  function completarMata(res, a, b, sem) {
    var score = comoLista(res.score).slice(), evs90 = comoLista(res.events);
    if (score[0] !== score[1]) return res;
    var fora = [], amarelos = [];
    evs90.forEach(function (e) {
      if (!e) return;
      if (e.type === "red" && e.playerId != null) fora.push(e.playerId);
      if (e.type === "yellow" && e.playerId != null) amarelos.push(e.playerId);
    });
    var et = TM.rng.comSemente(sem + ":pror", function () {
      return TM.engine.simulate(a, b, opcoesMotor({ startMinute: PARA_CORTE + 1, endMinute: 120, startScore: score.slice(), excludeIds: fora.slice(), yellowIds: amarelos }));
    });
    var evs = et.events, corte = -1;
    for (var i = 0; i < evs.length; i++) if ((evs[i].type === "goal" || evs[i].type === "pengoal") && evs[i].minute > PARA_CORTE) { corte = i; break; }
    var pror = { score: et.score.slice(), events: evs };
    if (corte >= 0) {
      var gol = evs[corte];
      pror.events = evs.slice(0, corte + 1);
      pror.score = comoLista(gol.score).slice();
      pror.ouro = gol.team;
      pror.events.push({ minute: gol.minute, type: "full", score: pror.score.slice(), text: "Gol de ouro! Fim de jogo." });
    }
    res.pror = pror;
    res.placar = pror.score.slice();
    if (pror.score[0] === pror.score[1]) {
      pror.events.forEach(function (e) { if (e.type === "red" && e.playerId != null) fora.push(e.playerId); });
      var sh = TM.rng.comSemente(sem + ":pen", function () { return TM.engine.shootout(semExpulsos(a, fora), semExpulsos(b, fora)); });
      res.pen = {
        score: sh.score.slice(), winner: sh.winner,
        kicks: sh.kicks.map(function (k) { return { side: k.side, name: k.name, scored: !!k.scored, id: k.player ? k.player.id : null }; })
      };
    }
    return res;
  }
  /** O simulado de um jogo reservado (o que todo aparelho honesto recalcula igual): os times pelas escalações GRAVADAS no nó
   *  e a semente com a trava. */
  function resultadoDoJogo(c, id, j) {
    var ab = comoLista(j.ab), esc = comoLista(j.escSim || j.esc);
    var a = timeDoTecnico(c, ab[0], esc[0]), b = timeDoTecnico(c, ab[1], esc[1]);
    return simularJogo(a, b, { semente: sementeJogo(c.codigo, id, j.trava), mataMata: ehMata(id) });
  }
  function resultadoWO(perdedor) {
    var p = perdedor === 0 ? [0, WO] : [WO, 0];
    return { placar: p, score: p.slice(), wo: perdedor, v: 1 - perdedor };
  }
  function prazo3d(duracao) { return Math.round((2 * duracao3dDe(duracao) * 1.3 + 8) * 60000); }
  // o par: o prazo da partida soma as pausas combinadas do Online 3D (3 de até 60 s para cada um dos dois: 6 min)
  var PAUSAS_PAR = 6 * 60000;
  function prazoPar(duracao) { return prazo3d(duracao) + PAUSAS_PAR; }

  /* ---------- o resultado do 3D (o "Jogar" da pessoa contra um bot; PR 4) ---------- */
  function nomeTxt(x) { var t = String(x == null ? "" : x).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40); return t || "Jogador"; }
  function minuto90(m) { m = Math.round(+m || 1); return Math.max(1, Math.min(90, m)); }
  function par2(x, d) {
    x = comoLista(x);
    return x.length === 2 && numero(x[0]) && numero(x[1]) && x[0] >= 0 && x[1] >= 0 ? [Math.round(x[0]), Math.round(x[1])] : d;
  }
  function timesDoJogo(c, j, esc) {
    var ab = comoLista(j.ab), e = comoLista(esc || j.esc);
    return [timeDoTecnico(c, ab[0], e[0]), timeDoTecnico(c, ab[1], e[1])];
  }
  // o jogador do time pelo tmId do 3D (o id do retrato) ou, sem ele, pelo nome
  function achaJogador(t, x) {
    var ps = t.players || [], k = x && x.tmId != null ? String(x.tmId) : null, i;
    if (k != null) for (i = 0; i < ps.length; i++) if (String(ps[i].id) === k) return ps[i];
    var n = x && x.nome != null ? String(x.nome) : null;
    if (n != null) for (i = 0; i < ps.length; i++) if (ps[i].name === n) return ps[i];
    return null;
  }
  /** O resultado do 3D (o do golaco: { homeGoals, awayGoals, gols: [{ lado, tmId, nome, minuto, penalti, contra }], cartoes:
   *  [{ lado, tmId, nome, minuto, cor }], stats: { possession, shots, onTarget } }) → o `res` gravado: os gols e os cartões
   *  viram os lances do motor (como o tm3d.js aplicaResultado: o autor pelo tmId; o gol contra sem autor), os times pelas
   *  escalações GRAVADAS na reserva; o placar = os gols (o que o 3D contar a mais entra sem autor, no 90'); no mata-mata
   *  empatado, o gol de ouro e os pênaltis simulados com a semente do jogo (completarMata). em3d: true. */
  function resDo3d(c, id, j, r3) {
    r3 = r3 || {};
    var T = timesDoJogo(c, j), placar = [0, 0], ev = [], sentOff = [];
    var gols = comoLista(r3.gols).filter(function (g) { return g && typeof g === "object"; }).map(function (g, i) { return { g: g, i: i, m: minuto90(g.minuto) }; });
    gols.sort(function (x, y) { return (x.m - y.m) || (x.i - y.i); });
    gols.forEach(function (x) {
      var g = x.g, lado = g.lado === 1 ? 1 : 0, t = T[lado];
      var pl = g.contra ? null : achaJogador(t, g), autor = g.contra ? achaJogador(T[1 - lado], g) : null;
      placar[lado]++;
      var quem = pl ? pl.name : g.contra ? (autor ? autor.name : nomeTxt(g.nome)) + " (contra)" : nomeTxt(g.nome);
      ev.push({ minute: x.m, type: g.penalti ? "pengoal" : "goal", team: lado, player: quem, playerId: pl ? pl.id : null, score: placar.slice(),
        text: g.contra ? "GOL CONTRA! " + quem.replace(" (contra)", "") + " desvia para o próprio gol. Ponto para o " + t.name + "."
          : (g.penalti ? "PÊNALTI CONVERTIDO! " : "GOL! ") + quem + " marca para o " + t.name + "." });
    });
    // o placar do 3D com mais gols que a lista (não deveria): os que faltam, sem autor, no 90'
    [r3.homeGoals, r3.awayGoals].forEach(function (n, lado) {
      while (inteiro(n) && n > placar[lado] && placar[lado] < 30) {
        placar[lado]++;
        ev.push({ minute: 90, type: "goal", team: lado, player: "Gol", playerId: null, score: placar.slice(), text: "GOL do " + T[lado].name + "." });
      }
    });
    comoLista(r3.cartoes).forEach(function (cc) {
      if (!cc || typeof cc !== "object") return;
      var lado = cc.lado === 1 ? 1 : 0, t = T[lado], pl = achaJogador(t, cc), quem = pl ? pl.name : nomeTxt(cc.nome), verm = cc.cor === "red", m = minuto90(cc.minuto);
      ev.push({ minute: m, type: verm ? "red" : "yellow", team: lado, player: quem, playerId: pl ? pl.id : null, text: (verm ? "Expulso: " : "Amarelo para ") + quem + " (" + t.name + ")" });
      if (verm) sentOff.push({ id: pl ? pl.id : null, name: quem, side: lado, minute: m });
    });
    var meio = [0, 0];
    ev.forEach(function (e) { if (e.minute <= 45 && (e.type === "goal" || e.type === "pengoal")) meio[e.team]++; });
    ev.push({ minute: 45, type: "half", score: meio, text: "Fim do 1º tempo" });
    ev.sort(function (x, y) { return (x.minute - y.minute) || ((x.type === "half" ? 1 : 0) - (y.type === "half" ? 1 : 0)); });
    ev.push({ minute: 90, type: "full", score: placar.slice(), text: "Fim de jogo! (partida jogada em 3D)" });
    var st = r3.stats || {}, h = placar[0], a = placar[1];
    var res = {
      score: placar.slice(), events: ev,
      stats: { possession: par2(st.possession, [50, 50]), shots: par2(st.shots, [Math.max(h, 1) + 4, Math.max(a, 1) + 4]), onTarget: par2(st.onTarget, [h + 1, a + 1]) },
      placar: placar.slice(), v: 0, em3d: true
    };
    if (sentOff.length) res.sentOff = sentOff;
    if (ehMata(id) && h === a) completarMata(res, T[0], T[1], sementeJogo(c.codigo, id, j.trava));
    res.v = vencedorDe(res);
    return res;
  }
  /** O resultado do 3D gravado tem a forma certa? (o 3D não se recalcula: os lances só dos tipos do 3D, nos 90', os gols que
   *  batem com o placar, os autores e os cartões de jogadores do time certo, as estatísticas; o que veio depois dos 90' no
   *  mata-mata empatado É recalculado com a semente) */
  function res3dValido(c, id, j) {
    var res = j && j.res;
    if (!res || res.em3d !== true || res.wo != null) return false;
    var T = timesDoJogo(c, j), ids = T.map(function (t) { var o = {}; t.players.forEach(function (p) { o[String(p.id)] = 1; }); return o; });
    var sc = comoLista(res.score), conta = [0, 0], evs = comoLista(res.events);
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (!e || TIPOS_3D.indexOf(e.type) < 0 || !inteiro(e.minute) || e.minute < 1 || e.minute > 90) return false;
      if (e.type === "half" || e.type === "full") continue;
      if (e.team !== 0 && e.team !== 1) return false;
      if (e.playerId != null && !ids[e.team][String(e.playerId)]) return false;
      if (e.type === "goal" || e.type === "pengoal") conta[e.team]++;
    }
    if (conta[0] !== sc[0] || conta[1] !== sc[1]) return false;
    var st = res.stats || {};
    if (!["possession", "shots", "onTarget"].every(function (k) { return par2(st[k], null) != null; })) return false;
    var base = copia(res);
    delete base.pror; delete base.pen;
    base.score = sc.slice(); base.events = evs; base.placar = sc.slice(); base.v = 0;
    if (ehMata(id) && sc[0] === sc[1]) completarMata(base, T[0], T[1], sementeJogo(c.codigo, id, j.trava));
    base.v = vencedorDe(base);
    return canon(base) === canon(res);
  }
  /** As escalações da tela do 3D ("Simular partida": { home: [tmId × 11], away }; home = o lado 0 do jogo) que MUDARAM em
   *  relação às gravadas na reserva: [esc0, esc1] ou null (nada mudou ou a tela não vale). Como o tm3d.js ordemDaTela: só o
   *  conjunto dos 11 conta (quem fica não muda de vaga; quem entra fica na vaga de quem saiu) e só jogadores do técnico.
   *  Sem reservas no leilão (decisão 12) o conjunto é sempre o mesmo: na prática, null. */
  function escDaTela(c, j, tit) {
    if (!tit || !c.ctx || !c.vivo) return null;
    var L = LE(), ab = comoLista(j.ab), esc = comoLista(j.esc), mudou = false, out = [];
    for (var k = 0; k < 2; k++) {
      var ids = tit[k === 0 ? "home" : "away"], e = esc[k], cur = comoLista(e && e.tit);
      out.push(e);
      if (!Array.isArray(ids) || ids.length !== 11) continue;
      var meu = {}; L.timeIdx(c.vivo, c.ctx, ab[k]).forEach(function (x) { var r = L.retratoDe(c.ctx, x); if (r) meu[String(r.id)] = x; });
      var quer = {}, ok = true;
      ids.forEach(function (id) { var s = String(id); if (meu[s] == null || quer[s]) ok = false; quer[s] = 1; });
      if (!ok) continue;
      var fica = {}, entram = [];
      cur.forEach(function (x) { var r = inteiro(x) && x >= 0 ? L.retratoDe(c.ctx, x) : null; if (r && quer[String(r.id)]) fica[String(r.id)] = 1; });
      ids.forEach(function (id) { if (!fica[String(id)]) entram.push(meu[String(id)]); });
      if (!entram.length) continue;
      var nt = cur.map(function (x) { var r = inteiro(x) && x >= 0 ? L.retratoDe(c.ctx, x) : null; return r && fica[String(r.id)] ? x : entram.length ? entram.shift() : x; });
      var ne = { formacao: e.formacao, tit: nt };
      if (!escValida(c, ab[k], ne)) continue;
      out[k] = ne; mudou = true;
    }
    return mudou ? out.map(function (x) { return { formacao: x.formacao, tit: comoLista(x.tit).slice() }; }) : null;
  }

  /* ---------- a máquina do jogo (dentro de rede.transacao("jogos/" + id)) ---------- */
  function nao(motivo) { return { ok: false, motivo: motivo }; }
  function sim(j) { return { ok: true, jogo: j }; }
  /** O prazo de começar passa a correr (o jogo de uma pessoa contra um bot, com alguém do jogo presente). o: { ts } */
  function abrir(j, o) {
    if (j != null) return nao("existe");
    return sim({ e: "aberto", ini: o.ts, resta: PRAZO });
  }
  /** Ninguém do jogo presente: o prazo para e guarda o que resta. o: { quando } (a hora em que o último do jogo foi visto,
   *  pela testemunha; o prazo não corre depois dela) */
  function pausar(j, o) {
    if (!j || j.e !== "aberto") return nao(j ? j.e : "sem");
    if (j.parado) return nao("parado");
    if (!numero(o.quando)) return nao("quando");
    return sim({ e: "aberto", parado: true, resta: Math.max(0, j.ini + j.resta - Math.max(j.ini, o.quando)) });
  }
  /** Alguém do jogo voltou: o prazo volta a correr com o que restava. o: { ts } */
  function retomar(j, o) {
    if (!j || j.e !== "aberto") return nao(j ? j.e : "sem");
    if (!j.parado) return nao("correndo");
    return sim({ e: "aberto", ini: o.ts, resta: j.resta });
  }
  /** Quando o prazo de começar vence (null: parado ou sem prazo). */
  function prazoDe(j, c) {
    if (!j) return null;
    if (j.e === "aberto") return j.parado ? null : j.ini + j.resta;
    // o par: o de tocar em Jogar (desde o inicio), o de abrir (desde o 2º toque) e o da partida (desde o abriu, com as pausas
    // combinadas dos dois: prazoPar)
    if (j.e === "reservado" && j.par === true && numero(j.inicio)) {
      if (!vieram(j)) return j.inicio + PRAZO;
      if (!numero(j.abriu)) return Math.max(j.vem0, j.vem1) + PRAZO;
      return j.abriu + prazoPar(c && c.duracao3d);
    }
    // o 3D reservado: o que abriu tem o prazo da partida (o W.O.); o que não abriu, o de começar (o simulado)
    if (j.e === "reservado" && j.modo === "3d" && numero(j.inicio)) return j.inicio + (numero(j.abriu) ? prazo3d(c && c.duracao3d) : PRAZO);
    return null;
  }
  /** A escolha: reserva o jogo com a TRAVA (a hora do servidor) e as escalações de agora. o: { ab: [a, b], esc: [{ formacao,
   *  tit } × 2], modo, por (o técnico; -1 = um aparelho qualquer), motivo, ts (o carimbo do servidor), hora (só no 'prazo':
   *  a hora da testemunha) }. Aceita o jogo sem nó ou aberto (no 'prazo', só aberto, correndo e vencido); reservado ou
   *  feito, nunca. */
  function reservar(j, o) {
    if (j && j.e !== "aberto") return nao(j.e);
    if (MODOS.indexOf(o.modo) < 0 || MOTIVOS.indexOf(o.motivo) < 0) return nao("opcao");
    var ab = comoLista(o.ab), esc = comoLista(o.esc);
    if (ab.length !== 2 || !inteiro(ab[0]) || !inteiro(ab[1]) || ab[0] === ab[1] || esc.length !== 2 || !esc[0] || !esc[1]) return nao("times");
    if (o.motivo === "prazo") {
      var pz = prazoDe(j);
      if (pz == null) return nao(j ? "parado" : "sem");
      if (!numero(o.hora) || o.hora < pz) return nao("cedo");
    }
    var n = {
      e: "reservado", ab: [ab[0], ab[1]], modo: o.modo, por: inteiro(o.por) ? o.por : -1, motivo: o.motivo, trava: o.ts,
      esc: esc.map(function (x) { return { formacao: x.formacao, tit: comoLista(x.tit).slice() }; })
    };
    if (o.modo === "3d") n.inicio = o.ts;
    return sim(n);
  }
  function copiaNo(j) { var n = {}; Object.keys(j).forEach(function (k) { n[k] = j[k]; }); return n; }
  function feito(j, res, ts) {
    var n = copiaNo(j);
    n.e = "feito"; n.res = res; n.ts = ts;
    return n;
  }
  /** O 3D chegou a abrir (a tela antes do jogo à vista): marca `abriu` = a hora do servidor, UMA vez, no reservado no 3D com
   *  a mesma trava. o: { trava, ts } */
  function marcarAbriu(j, o) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (j.modo !== "3d" || !numero(j.trava) || j.trava !== o.trava) return nao("trava");
    if (j.abriu != null) return nao("abriu");
    if (j.par === true && !vieram(j)) return nao("vem");
    var n = copiaNo(j); n.abriu = o.ts;
    return sim(n);
  }
  /** O resultado, UMA vez: só sobre o reservado com a mesma trava que o aparelho viu (o feito nunca é regravado).
   *  o: { trava, res, ts, mata (o jogo é do mata-mata: nunca empate), fim e escSim (só no 3D: '3d' | 'simulado'; as
   *  escalações da tela, se mudaram) } */
  function gravar(j, o) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (!numero(j.trava) || j.trava !== o.trava) return nao("trava");
    if (!resValido(o.res, !!o.mata)) return nao("res");
    var n = feito(j, o.res, o.ts);
    if (j.modo === "3d") {
      if (FINS.indexOf(o.fim) < 0) return nao("fim");
      // (o par: o resultado do 3D só depois de o 3D abrir — o que o aparelho adulterado não tem)
      if (j.par === true && o.fim === "3d" && !numero(j.abriu)) return nao("abriu");
      if ((o.fim === "3d") !== (o.res.em3d === true)) return nao("res");
      n.fim = o.fim;
      if (o.fim === "simulado" && o.escSim) n.escSim = comoLista(o.escSim).map(function (x) { return { formacao: x.formacao, tit: comoLista(x.tit).slice() }; });
    }
    return sim(n);
  }
  /** O 3D reservado que NÃO chegou a abrir e passou do prazo de começar (2 min desde o `inicio`): o simulado com a semente
   *  (decisão 15: "o 3D que nem chegou a abrir = simulado"). o: { trava, hora (a testemunha), ts, res (o simulado), mata } */
  function naoAbriu(j, o, c) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (j.modo !== "3d" || j.trava !== o.trava) return nao("trava");
    // (o par: com os dois, o 3D que não abriu em 2 min OU que abriu e passou do prazo da partida sem resultado — de quem é a
    // culpa ninguém sabe: o simulado. Com um só no Jogar e o outro FORA da sala no fim do prazo — revisão do PR 5, M2 —, também
    // o simulado: o W.O. de quem não veio é só de quem estava na sala e não tocou; quem decide é a sessão, pelos batimentos)
    if (j.par !== true && j.abriu != null) return nao("abriu");
    var pz = prazoDe(j, c);
    if (pz == null || !numero(o.hora) || o.hora < pz) return nao("cedo");
    if (!resValido(o.res, !!o.mata) || o.res.em3d) return nao("res");
    var n = feito(j, o.res, o.ts); n.fim = "simulado";
    return sim(n);
  }
  /** O 3D reservado que ABRIU e passou do prazo da partida (2 × duração × 1,3 + 8 min) sem resultado: W.O. de quem reservou
   *  (decisão 15). o: { trava, hora (a testemunha), ts } */
  function wo(j, o, c) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (j.modo !== "3d" || j.trava !== o.trava) return nao("trava");
    if (j.par === true) return nao("par");
    if (!numero(j.abriu)) return nao("naoAbriu");
    var pz = prazoDe(j, c);
    if (pz == null || !numero(o.hora) || o.hora < pz) return nao("cedo");
    var ab = comoLista(j.ab), lado = ab.indexOf(j.por);
    if (lado < 0) return nao("por");
    return sim(feito(j, resultadoWO(lado), o.ts));
  }

  /** Quem reservou o 3D desiste dele ANTES do prazo (o 3D abriu e fechou sem resultado: o app fechou, travou; a pessoa aceita o
   *  W.O. agora em vez de esperar o prazo — PR 4, revisão): o mesmo W.O. de quem reservou, com `desistiu: true` (a conferência
   *  aceita esse W.O. a qualquer hora depois do `abriu`). o: { trava, ts, por (o técnico que desiste: tem de ser quem reservou) } */
  function desistir(j, o) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (j.modo !== "3d" || j.trava !== o.trava) return nao("trava");
    if (j.par === true) return nao("par");
    if (!numero(j.abriu)) return nao("naoAbriu");
    if (o.por !== j.por) return nao("por");
    var ab = comoLista(j.ab), lado = ab.indexOf(j.por);
    if (lado < 0) return nao("por");
    var n = feito(j, resultadoWO(lado), o.ts); n.desistiu = true;
    return sim(n);
  }

  /* ---------- o par (PR 5): duas pessoas no Online 3D ---------- */
  /** O lado (0|1) do técnico t no jogo (-1: não é dele). */
  function ladoDe(j, t) { var ab = comoLista(j && j.ab); return ab[0] === t ? 0 : ab[1] === t ? 1 : -1; }
  /** A hora em que o lado tocou em "Jogar" (null: ainda não). */
  function vemDe(j, lado) { var v = j && j["vem" + lado]; return numero(v) ? v : null; }
  /** Os dois tocaram em "Jogar". */
  function vieram(j) { return vemDe(j, 0) != null && vemDe(j, 1) != null; }
  /** O 1º "Jogar" do par: reserva no 3D (motivo 'pedido', a trava = o inicio = a hora do servidor) com o lado de quem tocou já
   *  "veio". o: { ab: [a, b], esc, por (o técnico que tocou), ts }. Do jogo sem nó ou aberto (correndo ou parado). */
  function reservarPar(j, o) {
    if (j && j.e !== "aberto") return nao(j.e);
    var lado = comoLista(o.ab).indexOf(o.por);
    if (lado < 0) return nao("por");
    var r = reservar(j, { ab: o.ab, esc: o.esc, modo: "3d", por: o.por, motivo: "pedido", ts: o.ts });
    if (!r.ok) return r;
    r.jogo.par = true; r.jogo["vem" + lado] = o.ts;
    return r;
  }
  /** A outra pessoa toca em "Jogar": o lado dela "veio", uma vez, no par reservado com a mesma trava (o prazo de 2 min é da
   *  sessão: depois dele, o naoVeio). o: { trava, por (o técnico), ts } */
  function entrarPar(j, o) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (j.par !== true || j.trava !== o.trava) return nao("trava");
    var lado = ladoDe(j, o.por);
    if (lado < 0) return nao("por");
    if (vemDe(j, lado) != null) return nao("veio");
    var n = copiaNo(j); n["vem" + lado] = o.ts;
    return sim(n);
  }
  /** O par em que só um tocou em "Jogar" e passou do prazo (2 min desde o inicio): W.O. de quem não veio. o: { trava, hora (a
   *  testemunha), ts } */
  function naoVeio(j, o, c) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (j.par !== true || j.trava !== o.trava) return nao("trava");
    if (vieram(j)) return nao("vieram");
    var pz = prazoDe(j, c);
    if (pz == null || !numero(o.hora) || o.hora < pz) return nao("cedo");
    var n = feito(j, resultadoWO(vemDe(j, 0) == null ? 0 : 1), o.ts); n.woPor = "naoVeio";
    return sim(n);
  }
  /** O par: W.O. de quem SAIU no meio (o "Sair da partida" dele, avisado pelo 3D do outro; ou ele mesmo saiu ou aceitou o W.O.),
   *  a qualquer hora depois de o 3D abrir (antes do abriu, o abandono é o simulado: revisão do PR 5, M4). o: { trava, ts,
   *  perdedor (o lado: 0|1) } */
  function woPar(j, o) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (j.par !== true || j.trava !== o.trava) return nao("trava");
    if (!vieram(j)) return nao("vem");
    if (!numero(j.abriu)) return nao("naoAbriu");
    if (o.perdedor !== 0 && o.perdedor !== 1) return nao("lado");
    var n = feito(j, resultadoWO(o.perdedor), o.ts); n.woPor = "saiu";
    return sim(n);
  }

  /* ---------- quem age (§3.3: qualquer aparelho, escalonado pela sessão) ---------- */
  function tipoDe(c, t) { return (c.tipos && c.tipos[t]) === "pessoa" ? "pessoa" : "bot"; }
  /** O confronto: 'bots' (bot × bot), 'pessoaBot' ou 'pessoas'. */
  function confronto(c, g) {
    var n = (tipoDe(c, g.a) === "pessoa" ? 1 : 0) + (tipoDe(c, g.b) === "pessoa" ? 1 : 0);
    return n === 2 ? "pessoas" : n === 1 ? "pessoaBot" : "bots";
  }
  /** O que fazer agora com um jogo da vista (g de montar): { acao, motivo?, quando? } ou null. info: { presente(t) → bool,
   *  visto(t) → a hora do último batimento do técnico (ou null), hora (a do servidor, estimada) }. A sessão age na hora
   *  `quando` (os prazos, depois da testemunha) e com o escalonamento de 1,5 s × k.
   *   — bot × bot e, sem o par (regras 1 a 3), pessoa × pessoa: reservar ao abrir a rodada (motivo 'abertura');
   *   — pessoa × bot: com a pessoa presente, abrir o prazo; correndo, ninguém do jogo presente = pausar (desde o último
   *     batimento); parado, alguém voltou = retomar; vencido = reservar ('prazo');
   *   — pessoa × pessoa com o par: o mesmo prazo, correndo com UMA das duas presente;
   *   — reservado e simulado: gravar o resultado (qualquer aparelho: o mesmo resultado); reservado no 3D e vencido: o W.O.
   *     (abriu) ou o simulado (não abriu: 'naoAbriu'); o par vencido: 'naoVeio' (um só tocou em Jogar) ou 'naoAbriu' */
  function proximaAcao(c, g, info) {
    if (!g || !g.aberta || g.a == null || g.b == null || g.e === "feito" || g.invalido) return null;
    var j = g.j;
    if (j && j.e === "reservado") {
      if (j.modo === "simulado") return { acao: "gravar", quando: 0 };
      var pz = prazoDe(j, c);
      if (pz == null) return null;
      if (j.par === true) return { acao: vieram(j) ? "naoAbriu" : "naoVeio", quando: pz };
      return { acao: numero(j.abriu) ? "wo" : "naoAbriu", quando: pz };
    }
    var tipo = confronto(c, g);
    if (tipo === "pessoas" && c.par) {
      var ali = !!(info && info.presente && (info.presente(g.a) || info.presente(g.b)));
      if (!j) return ali ? { acao: "abrir", quando: 0 } : null;
      if (j.parado) return ali ? { acao: "retomar", quando: 0 } : null;
      if (!ali) {
        var va = info && info.visto ? info.visto(g.a) : null, vb = info && info.visto ? info.visto(g.b) : null;
        var vm = numero(va) && numero(vb) ? Math.max(va, vb) : numero(va) ? va : numero(vb) ? vb : null;
        return { acao: "pausar", quando: 0, desde: vm };
      }
      return { acao: "reservar", motivo: "prazo", quando: j.ini + j.resta };
    }
    if (tipo !== "pessoaBot") return { acao: "reservar", motivo: "abertura", quando: 0 };
    var pessoa = tipoDe(c, g.a) === "pessoa" ? g.a : g.b, aqui = !!(info && info.presente && info.presente(pessoa));
    if (!j) return aqui ? { acao: "abrir", quando: 0 } : null;
    if (j.parado) return aqui ? { acao: "retomar", quando: 0 } : null;
    if (!aqui) {
      var v = info && info.visto ? info.visto(pessoa) : null;
      return { acao: "pausar", quando: 0, desde: numero(v) ? v : null };
    }
    return { acao: "reservar", motivo: "prazo", quando: j.ini + j.resta };
  }

  /* ---------- a conferência pelos aparelhos honestos (§3.3) ---------- */
  function escValida(c, t, esc) {
    var L = LE();
    if (!esc || !L.slotsDe(esc.formacao)) return false;
    var slots = L.slotsDe(esc.formacao), tit = comoLista(esc.tit), idx = L.timeIdx(c.vivo, c.ctx, t), visto = {}, n = 0;
    if (tit.length !== slots.length) return false;
    for (var s = 0; s < tit.length; s++) {
      var k = tit[s];
      if (k === -1) continue;
      if (!inteiro(k) || idx.indexOf(k) < 0 || visto[k]) return false;
      visto[k] = 1; n++;
      if (L.custoVaga(L.retratoDe(c.ctx, k), slots[s]) >= L.FORA_VAGA) return false;
    }
    return n === Math.min(slots.length, idx.length);
  }
  /** O nó gravado bate com as regras? null = sim; senão o motivo ('forma', 'vez', 'times', 'escalacao', 'resultado', 'wo').
   *  O simulado é RECALCULADO e comparado pelo texto canônico (também o do 3D que acabou simulado, com as escalações da tela);
   *  o resultado do 3D, só pela forma (res3dValido; o gol de ouro e os pênaltis dele recalculados), o lado e quem reservou.
   *  g: o jogo da vista (montar). */
  function conferirJogo(c, g, j) {
    if (j == null) return null;
    if (!noValido(j, g.mata)) return "forma";
    if (j.e === "aberto") return j.resta >= 0 && j.resta <= PRAZO ? null : "forma";
    if (!g.aberta || g.a == null || g.b == null) return "vez";
    var ab = comoLista(j.ab);
    if (ab[0] !== g.a || ab[1] !== g.b) return "times";
    var esc = comoLista(j.esc);
    if (esc.length !== 2 || !escValida(c, ab[0], esc[0]) || !escValida(c, ab[1], esc[1])) return "escalacao";
    // o 3D: só pelo "Jogar" da pessoa do jogo (motivo 'pedido', quem reservou é um dos dois), com o `inicio`
    if (j.modo === "3d" && (j.motivo !== "pedido" || ab.indexOf(j.por) < 0 || !numero(j.inicio) || (j.abriu != null && !numero(j.abriu)))) return "forma";
    // o par: só nas salas com ele, no 3D; quem reservou "veio" no inicio e o outro DEPOIS dele (o 2º toque é outra transação:
    // o aparelho adulterado que grava os dois toques na mesma reserva fica com os dois iguais — revisão do PR 5, M4); os toques
    // são horas; o abriu só com os dois
    if (j.par != null || j.vem0 != null || j.vem1 != null) {
      if (j.par !== true || !c.par || j.modo !== "3d") return "forma";
      var lp = ab.indexOf(j.por), vo = vemDe(j, 1 - lp);
      if (vemDe(j, lp) !== j.inicio || (j.vem0 != null && !numero(j.vem0)) || (j.vem1 != null && !numero(j.vem1))) return "forma";
      if (vo != null && !(vo > j.inicio)) return "forma";
      if (j.abriu != null && !vieram(j)) return "forma";
    }
    if (j.e !== "feito") return null;
    // o W.O. do par: de quem não veio (depois do prazo de tocar em Jogar, pela hora do servidor) ou de quem saiu (com o 3D aberto,
    // gravado depois do abriu)
    if (j.par === true && j.res.wo != null) {
      if (j.woPor === "naoVeio") return vemDe(j, j.res.wo) == null && vemDe(j, 1 - j.res.wo) != null && numero(j.ts) && j.ts >= j.inicio + PRAZO ? null : "wo";
      if (j.woPor === "saiu") return vieram(j) && numero(j.abriu) && numero(j.ts) && j.ts >= j.abriu ? null : "wo";
      return "wo";
    }
    // (o resultado do 3D do par: só com o 3D aberto e gravado depois do abriu)
    if (j.par === true && j.fim === "3d" && !(numero(j.abriu) && numero(j.ts) && j.ts >= j.abriu)) return "resultado";
    if (j.woPor != null) return "forma";
    // o W.O.: só do 3D que abriu, de quem reservou e gravado depois do prazo da partida (pela hora do servidor) — ou, com o
    // `desistiu`, quando quem reservou aceitou o W.O. antes do prazo (depois do `abriu`)
    if (j.res.wo != null) return j.modo === "3d" && ab[j.res.wo] === j.por && numero(j.abriu) && numero(j.ts) && numero(j.inicio) &&
      (j.desistiu === true ? j.ts >= j.abriu : j.desistiu == null && j.ts >= j.inicio + prazo3d(c.duracao3d)) ? null : "wo";
    if (j.desistiu != null) return "forma";
    if (j.modo === "3d") {
      if (j.fim === "3d") return res3dValido(c, g.id, j) ? null : "resultado";
      if (j.fim !== "simulado") return "forma";
      if (j.escSim != null) {
        var es = comoLista(j.escSim);
        if (es.length !== 2 || !escValida(c, ab[0], es[0]) || !escValida(c, ab[1], es[1])) return "escalacao";
      }
    } else if (j.fim != null || j.escSim != null) return "forma";
    return canon(resultadoDoJogo(c, g.id, j)) === canon(j.res) ? null : "resultado";
  }

  /* ---------- o campeonato ---------- */
  function contexto(o) {
    var T = o.T || (o.ctx && o.ctx.T) || 0;
    return {
      codigo: String(o.codigo || ""), semente: String(o.semente != null ? o.semente : o.codigo || ""),
      formato: formatoDe(o.formato), T: T,
      ctx: o.ctx || null, vivo: o.vivo || null, clubes: o.clubes || [], nomes: o.nomes || [], tipos: o.tipos || [],
      escal: o.escal || {}, prefs: o.prefs || [], inicio: numero(o.inicio) ? o.inicio : 0,
      duracao3d: duracao3dDe(o.duracao3d), dificuldade3d: dificuldade3dDe(o.dificuldade3d), par: !!o.par, _est: null, _sorteio: null
    };
  }

  TM.leilaoCamp = {
    FORMATOS: FORMATOS, PRAZO: PRAZO, REALISMO: REALISMO, MODOS: MODOS, MOTIVOS: MOTIVOS, ESTADOS: ESTADOS, WO: WO,
    DURACAO_3D: DURACAO_3D, DURACOES_3D: DURACOES_3D, DIFICULDADE_3D: DIFICULDADE_3D, DIFICULDADES: DIFICULDADES,
    duracao3dDe: duracao3dDe, dificuldade3dDe: dificuldade3dDe,
    resDo3d: resDo3d, res3dValido: res3dValido, escDaTela: escDaTela, completarMata: completarMata,
    contexto: contexto, formatoDe: formatoDe, rodadasDe: rodadasDe, jogosDe: jogosDe, duracaoEstimada: duracaoEstimada,
    estrutura: estrutura, montar: montar, tabela: tabela, artilharia: artilharia,
    somaNotas: somaNotas, ehMata: ehMata, vencedorDe: vencedorDe, resValido: resValido,
    timeDoTecnico: timeDoTecnico, escalacaoDoJogo: escalacaoDoJogo, simularJogo: simularJogo, sementeJogo: sementeJogo,
    resultadoDoJogo: resultadoDoJogo, resultadoWO: resultadoWO, prazo3d: prazo3d, prazoPar: prazoPar, PAUSAS_PAR: PAUSAS_PAR, prazoDe: prazoDe,
    abrir: abrir, pausar: pausar, retomar: retomar, reservar: reservar, marcarAbriu: marcarAbriu, gravar: gravar, naoAbriu: naoAbriu, wo: wo, desistir: desistir,
    reservarPar: reservarPar, entrarPar: entrarPar, naoVeio: naoVeio, woPar: woPar, vieram: vieram, vemDe: vemDe, ladoDe: ladoDe,
    confronto: confronto, proximaAcao: proximaAcao, conferirJogo: conferirJogo, canon: canon,
    // para os testes
    _turno: turno, _chaveInicial: chaveInicial, _espalha: espalha
  };
})(window);
