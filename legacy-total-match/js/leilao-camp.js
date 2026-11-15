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
     reservado  { e, ab, esc, modo, por, motivo, trava, inicio? } a escolha está feita: os técnicos (ab), as escalações
                GRAVADAS no momento (esc: [{ formacao, tit }, …]; vale a partir do próximo jogo que não começou), o modo
                ('simulado'; '3d' no PR 4, com o `inicio`) e a TRAVA = a hora do servidor ao reservar. O simulado é
                comSemente("leilao:" + código + ":" + id + ":" + trava): ninguém o calcula antes de escolher
     feito      { …o reservado, e, res, ts } o resultado, gravado UMA vez (o reservado com a mesma trava) e só então mostrado
   Motivos de reservar: 'pedido' (a pessoa do jogo tocou em Simular), 'prazo' (o prazo venceu pela testemunha da hora),
   'abertura' (bot × bot; pessoa × pessoa até o PR 5), 'dono' (Simular os pendentes) e 'pendentes' (o mesmo botão tocado por
   outro técnico, com o dono fora há mais de 5 min). O 3D reservado que passa de
   2 × duração × 1,3 + 8 min sem resultado é W.O. de quem reservou (decisão 15; o 3D é do PR 4).

   O resultado gravado (`res`): o do motor nos 90' (score, events, stats, sentOff) e, no mata-mata empatado, `pror` { score,
   events (91' em diante, cortados no gol de ouro), ouro (o lado que fez o gol de ouro) } e `pen` { score, kicks: [{ side,
   name, scored, id }], winner }; `placar` = o que conta (o dos 90' ou o do fim da prorrogação) e `v` o vencedor (0 ou 1,
   o lado; -1 = empate, só na fase de pontos). W.O.: { placar, score, wo (o lado que perdeu), v }.

   API (TM.leilaoCamp):
     contexto(o)                 o: { codigo, semente, formato, T, ctx (o do TM.leilao), vivo, clubes [t], tipos ['bot'|'pessoa'],
                                    escal, prefs, inicio, duracao3d } → c (o campeonato; as contas abaixo recebem c)
     formatoDe(nome) · rodadasDe(formato, T) · jogosDe(formato, T) · duracaoEstimada({ T, tempo, formato, tresD?, duracao3d? })
     estrutura(c) · montar(c, jogos) (a vista: rodadas, jogos, tabela, atual, fim, campeão,
     classificação, artilharia, o melhor time) · tabela(c, jogos) · artilharia(c, jogos) · somaNotas(c)
     timeDoTecnico(c, t, esc?) · escalacaoDoJogo(c, t) · simularJogo(a, b, { semente, mataMata }) · sementeJogo(codigo, id, trava)
     resultadoDoJogo(c, id, j) (o simulado com a semente do jogo)
     A máquina (cada uma devolve { ok: true, jogo } ou { ok: false, motivo }): abrir, pausar, retomar, reservar, gravar, wo
     proximaAcao(c, g, info) (o que fazer agora com um jogo da vista) · conferirJogo(c, g, j) (o motivo, se a sala foi alterada)
     canon(v) (o texto canônico, como o Firebase guarda) */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  var FORMATOS = ["mata", "pontos", "misto"];
  var PRAZO = 120000;               // 2 min para começar o jogo de uma pessoa contra um bot (só com alguém do jogo presente)
  var REALISMO = 3;                 // a sala é fixa para todos: realismo 3, mando neutro
  var DURACAO_3D = 4;               // min por tempo no 3D (PR 4: a sala escolhe)
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
   *   — o leilão: medido com os robôs no PR 1 (~0,9 × o relógio por lote quando todos passam rápido, metade com 2 técnicos;
   *     o relógio + 7 s quando ninguém passa: o relógio inteiro, a pausa e a repescagem);
   *   — o campeonato, por rodada: simulado, de ~30 s (quem joga toca em Simular e vê) aos 2 min do prazo; no 3D (PR 4),
   *     de 2 × a duração + 4 min (a partida e as telas) a 2 × a duração × 1,3 + 5 min. */
  function duracaoEstimada(o) {
    o = o || {};
    var L = LE(), T = o.T || 0, n = (L ? L.LOTES_POR_TEC : 13) * T, s = (o.tempo > 0 ? o.tempo : (L ? L.DUR : 10000)) / 1000;
    var lo = n * (T <= 2 ? 0.5 : 0.9) * s / 60, hi = n * (s + 7) / 60;
    var fmt = formatoDe(o.formato), R = rodadasDe(fmt, T), dur = o.duracao3d || DURACAO_3D;
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
    if (o.mataMata && r.score[0] === r.score[1]) {
      var fora = [], amarelos = [];
      r.events.forEach(function (e) {
        if (e.type === "red" && e.playerId != null) fora.push(e.playerId);
        if (e.type === "yellow" && e.playerId != null) amarelos.push(e.playerId);
      });
      var et = TM.rng.comSemente(sem + ":pror", function () {
        return TM.engine.simulate(a, b, opcoesMotor({ startMinute: PARA_CORTE + 1, endMinute: 120, startScore: r.score.slice(), excludeIds: fora.slice(), yellowIds: amarelos }));
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
    }
    res.v = vencedorDe(res);
    return res;
  }
  /** O simulado de um jogo reservado (o que todo aparelho honesto recalcula igual): os times pelas escalações GRAVADAS no nó
   *  e a semente com a trava. */
  function resultadoDoJogo(c, id, j) {
    var ab = comoLista(j.ab), esc = comoLista(j.esc);
    var a = timeDoTecnico(c, ab[0], esc[0]), b = timeDoTecnico(c, ab[1], esc[1]);
    return simularJogo(a, b, { semente: sementeJogo(c.codigo, id, j.trava), mataMata: ehMata(id) });
  }
  function resultadoWO(perdedor) {
    var p = perdedor === 0 ? [0, WO] : [WO, 0];
    return { placar: p, score: p.slice(), wo: perdedor, v: 1 - perdedor };
  }
  function prazo3d(duracao) { return Math.round((2 * (duracao || DURACAO_3D) * 1.3 + 8) * 60000); }

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
    if (j.e === "reservado" && j.modo === "3d" && numero(j.inicio)) return j.inicio + prazo3d(c && c.duracao3d);
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
  function feito(j, res, ts) {
    var n = {}; Object.keys(j).forEach(function (k) { n[k] = j[k]; });
    n.e = "feito"; n.res = res; n.ts = ts;
    return n;
  }
  /** O resultado, UMA vez: só sobre o reservado com a mesma trava que o aparelho viu (o feito nunca é regravado).
   *  o: { trava, res, ts, mata (o jogo é do mata-mata: nunca empate) } */
  function gravar(j, o) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (!numero(j.trava) || j.trava !== o.trava) return nao("trava");
    if (!resValido(o.res, !!o.mata)) return nao("res");
    return sim(feito(j, o.res, o.ts));
  }
  /** O 3D reservado que passou do prazo sem resultado: W.O. de quem reservou (decisão 15; o 3D é do PR 4).
   *  o: { trava, hora (a testemunha), ts } */
  function wo(j, o, c) {
    if (!j || j.e !== "reservado") return nao(j ? j.e : "sem");
    if (j.modo !== "3d" || j.trava !== o.trava) return nao("trava");
    var pz = prazoDe(j, c);
    if (pz == null || !numero(o.hora) || o.hora < pz) return nao("cedo");
    var ab = comoLista(j.ab), lado = ab.indexOf(j.por);
    if (lado < 0) return nao("por");
    return sim(feito(j, resultadoWO(lado), o.ts));
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
   *   — bot × bot e (até o PR 5) pessoa × pessoa: reservar ao abrir a rodada (motivo 'abertura');
   *   — pessoa × bot: com a pessoa presente, abrir o prazo; correndo, ninguém do jogo presente = pausar (desde o último
   *     batimento); parado, alguém voltou = retomar; vencido = reservar ('prazo');
   *   — reservado e simulado: gravar o resultado (qualquer aparelho: o mesmo resultado); reservado no 3D e vencido: o W.O. */
  function proximaAcao(c, g, info) {
    if (!g || !g.aberta || g.a == null || g.b == null || g.e === "feito" || g.invalido) return null;
    var j = g.j;
    if (j && j.e === "reservado") {
      if (j.modo === "simulado") return { acao: "gravar", quando: 0 };
      var pz = prazoDe(j, c);
      return pz == null ? null : { acao: "wo", quando: pz };
    }
    var tipo = confronto(c, g);
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
   *  O simulado é RECALCULADO e comparado pelo texto canônico; o 3D (PR 4) só pela forma. g: o jogo da vista (montar). */
  function conferirJogo(c, g, j) {
    if (j == null) return null;
    if (!noValido(j, g.mata)) return "forma";
    if (j.e === "aberto") return j.resta >= 0 && j.resta <= PRAZO ? null : "forma";
    if (!g.aberta || g.a == null || g.b == null) return "vez";
    var ab = comoLista(j.ab);
    if (ab[0] !== g.a || ab[1] !== g.b) return "times";
    var esc = comoLista(j.esc);
    if (esc.length !== 2 || !escValida(c, ab[0], esc[0]) || !escValida(c, ab[1], esc[1])) return "escalacao";
    if (j.e !== "feito") return null;
    if (j.res.wo != null) return j.modo === "3d" && ab[j.res.wo] === j.por ? null : "wo";
    if (j.modo !== "simulado") return null;
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
      duracao3d: o.duracao3d || DURACAO_3D, _est: null, _sorteio: null
    };
  }

  TM.leilaoCamp = {
    FORMATOS: FORMATOS, PRAZO: PRAZO, REALISMO: REALISMO, MODOS: MODOS, MOTIVOS: MOTIVOS, ESTADOS: ESTADOS, WO: WO,
    contexto: contexto, formatoDe: formatoDe, rodadasDe: rodadasDe, jogosDe: jogosDe, duracaoEstimada: duracaoEstimada,
    estrutura: estrutura, montar: montar, tabela: tabela, artilharia: artilharia,
    somaNotas: somaNotas, ehMata: ehMata, vencedorDe: vencedorDe, resValido: resValido,
    timeDoTecnico: timeDoTecnico, escalacaoDoJogo: escalacaoDoJogo, simularJogo: simularJogo, sementeJogo: sementeJogo,
    resultadoDoJogo: resultadoDoJogo, resultadoWO: resultadoWO, prazo3d: prazo3d, prazoDe: prazoDe,
    abrir: abrir, pausar: pausar, retomar: retomar, reservar: reservar, gravar: gravar, wo: wo,
    confronto: confronto, proximaAcao: proximaAcao, conferirJogo: conferirJogo, canon: canon,
    // para os testes
    _turno: turno, _chaveInicial: chaveInicial, _espalha: espalha
  };
})(window);
