/* ================= TOTAL MATCH — motor de torneio (grupos + mata-mata) ================= */
/* Fase de grupos (mini pontos-corridos) seguida de mata-mata. Genérico:
   o caller injeta ctx = { sim(aId,bId)->{score:[h,a]}, rating(id)->num }.
   Usado no modo Competição e na competição continental da carreira. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function emptyTable(ids) { var t = {}; ids.forEach(function (id) { t[id] = { id: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }); return t; }
  function applyRes(t, h, a, hs, as) { var H = t[h], A = t[a]; H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs; if (hs > as) { H.w++; A.l++; H.pts += 3; } else if (hs < as) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; } }
  function standings(t) { return Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf; }); }
  function roundRobin(ids) {
    var n = ids.length, arr = ids.slice(), rounds = [];
    for (var r = 0; r < n - 1; r++) { var rd = []; for (var i = 0; i < n / 2; i++) rd.push(r % 2 === 0 ? [arr[i], arr[n - 1 - i]] : [arr[n - 1 - i], arr[i]]); rounds.push(rd); arr.splice(1, 0, arr.pop()); }
    return rounds;
  }
  function doubleRoundRobin(ids) {
    var first = roundRobin(ids);
    var second = first.map(function (round) { return round.map(function (m) { return [m[1], m[0]]; }); });
    return first.concat(second);
  }

  function create(teamIds, opts) {
    var perGroup = opts.perGroup || 4;
    var nGroups = opts.groups || (teamIds.length / perGroup);
    var dbl = !!opts.doubleGroups;   // grupos com turno e returno (copas de clubes)
    var ids = shuffle(teamIds);
    var groups = [];
    for (var g = 0; g < nGroups; g++) {
      var gt = ids.slice(g * perGroup, g * perGroup + perGroup);
      groups.push({ teamIds: gt, table: emptyTable(gt), fixtures: dbl ? doubleRoundRobin(gt) : roundRobin(gt), round: 0 });
    }
    return {
      phase: "group", groups: groups, groupRound: 0, groupRounds: (perGroup - 1) * (dbl ? 2 : 1), advance: opts.advance || 2,
      bestThirds: opts.bestThirds || 0,   // Copa do Mundo 48: melhores 3os colocados também avançam
      twoLeg: !!opts.twoLeg,              // mata-mata em ida e volta (copas de clubes)
      userId: opts.userId, ko: null, championId: null, aliveUser: true, userQualified: null
    };
  }

  /* ================= FASE DE LIGA (formato da Champions desde 2024/25) =================
     36 clubes numa TABELA ÚNICA. Cada um joga 8 partidas contra 8 adversários
     diferentes — 4 em casa e 4 fora — sendo 2 de cada pote (um em casa, um
     fora). Clubes do mesmo país não se enfrentam. Ao fim:
       1º ao 8º   -> direto às oitavas (cabeças de chave)
       9º ao 24º  -> play-off eliminatório em ida e volta
       25º ao 36º -> eliminados, SEM vaga na competição secundária.
     Modelado como um "grupo" de 36 para reaproveitar tabela, rodadas e telas. */
  function embaralha(a) { return shuffle(a); }
  /* Calendário da fase de liga.
     Cada rodada precisa ser um emparelhamento PERFEITO dos 36 (todo mundo joga
     uma vez por rodada), e ao mesmo tempo cada clube precisa terminar com 2
     adversários de cada pote. Sorteio cego nunca fecha isso, então a montagem
     é determinística:
       rodadas 1-6: dois potes inteiros se cruzam (0x1 + 2x3, 0x2 + 1x3,
                    0x3 + 1x2), cada par com deslocamento 1 e 2 — dá os 6 jogos
                    contra os outros potes, 3 em casa e 3 fora;
       rodadas 7-8: jogos dentro do próprio pote. Como o pote tem 9 (ímpar),
                    sobra um clube por pote; os 4 que sobram se enfrentam entre
                    si naquela rodada. */
  function jogosCruzados(pa, pb, d, casaA) {
    var out = [];
    for (var i = 0; i < 9; i++) {
      var a = pa[i], b = pb[(i + d) % 9];
      out.push(casaA ? [a, b] : [b, a]);
    }
    return out;
  }
  function rodadasDaLiga(potes) {
    var rodadas = [];
    var combos = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    combos.forEach(function (cb) {
      for (var d = 1; d <= 2; d++) {
        var rd = [];
        cb.forEach(function (par) {
          rd = rd.concat(jogosCruzados(potes[par[0]], potes[par[1]], d, d === 1));
        });
        rodadas.push(rd);
      }
    });
    // duas rodadas dentro do pote. Como o pote tem 9 (ímpar), sobra um clube em
    // cada uma — os 4 que sobram se enfrentam. Sobra o índice 0 na primeira e o
    // 1 na segunda, o que garante confrontos diferentes nas duas rodadas.
    for (var r = 0; r < 2; r++) {
      var rd2 = [], sobras = [];
      for (var q = 0; q < 4; q++) {
        var P = potes[q];
        sobras.push(P[r]);
        // r=0: (1,2)(3,4)(5,6)(7,8) · r=1: (2,3)(4,5)(6,7)(8,0)
        for (var i = 0; i < 4; i++) {
          var a = P[(1 + r + i * 2) % 9], b = P[(2 + r + i * 2) % 9];
          rd2.push([a, b]);
        }
      }
      rd2.push([sobras[0], sobras[1]]);
      rd2.push([sobras[2], sobras[3]]);
      rodadas.push(rd2);
    }
    return rodadas;
  }
  // conta duelos entre clubes do mesmo país (tem que ser zero)
  function compatriotas(rodadas, paisDe) {
    var n = 0;
    rodadas.forEach(function (r) { r.forEach(function (m) { if (paisDe(m[0]) && paisDe(m[0]) === paisDe(m[1])) n++; }); });
    return n;
  }
  // As 6 primeiras rodadas já saem 3 em casa e 3 fora. Nas duas últimas cada
  // clube tem exatamente 2 jogos, então esses jogos formam ciclos: orientando
  // cada ciclo no mesmo sentido, todo mundo fica com 1 em casa e 1 fora — e
  // fecha 4 e 4. Orientar jogo a jogo por contagem deixava gente com 5 e 3.
  function equilibraMando(rodadas) {
    var arestas = [];
    for (var r = 6; r < rodadas.length; r++) {
      rodadas[r].forEach(function (m, i) { arestas.push({ r: r, i: i, a: m[0], b: m[1] }); });
    }
    var porTime = {};
    arestas.forEach(function (e) {
      (porTime[e.a] = porTime[e.a] || []).push(e);
      (porTime[e.b] = porTime[e.b] || []).push(e);
    });
    var visto = {};
    arestas.forEach(function (ini) {
      if (visto[ini.r + ":" + ini.i]) return;
      // percorre o ciclo a partir desta aresta, orientando sempre no mesmo sentido
      var atual = ini, de = ini.a;
      while (atual && !visto[atual.r + ":" + atual.i]) {
        visto[atual.r + ":" + atual.i] = 1;
        var para = (atual.a === de) ? atual.b : atual.a;
        rodadas[atual.r][atual.i] = [de, para];      // "de" manda neste jogo
        var viz = porTime[para] || [], prox = null;
        for (var k = 0; k < viz.length; k++) if (!visto[viz[k].r + ":" + viz[k].i]) { prox = viz[k]; break; }
        atual = prox; de = para;
      }
    });
    return rodadas;
  }
  function createLiga(teamIds, opts) {
    opts = opts || {};
    var ids = teamIds.slice(0, 36);
    var nota = opts.ratingOf || function () { return 0; };
    var paisDe = opts.countryOf || function () { return null; };
    var ord = ids.slice().sort(function (a, b) { return nota(b) - nota(a); });
    var potes = [ord.slice(0, 9), ord.slice(9, 18), ord.slice(18, 27), ord.slice(27, 36)];
    // A ordem DENTRO do pote é livre e é ela que decide quem enfrenta quem.
    // Busca local com reinícios: troca dois clubes de lugar no pote enquanto
    // isso não piorar os duelos entre compatriotas. Um reinício só empacava
    // quando o chaveamento tinha 4 ou 5 clubes do mesmo país (o caso real).
    var pp = null, melhor = 1e9;
    for (var ini = 0; ini < 12 && melhor > 0; ini++) {
      var cand = potes.map(function (P) { return shuffle(P.slice()); });
      var atual = compatriotas(rodadasDaLiga(cand), paisDe);
      for (var it = 0; it < 3000 && atual > 0; it++) {
        var q = Math.floor(Math.random() * 4);
        var i = Math.floor(Math.random() * 9), j = Math.floor(Math.random() * 9);
        if (i === j) continue;
        var tmp = cand[q][i]; cand[q][i] = cand[q][j]; cand[q][j] = tmp;
        var novo2 = compatriotas(rodadasDaLiga(cand), paisDe);
        if (novo2 <= atual) atual = novo2;
        else { var t2 = cand[q][i]; cand[q][i] = cand[q][j]; cand[q][j] = t2; }
      }
      if (atual < melhor) { melhor = atual; pp = cand; }
    }
    potes = pp;
    var rodadas = equilibraMando(rodadasDaLiga(potes));
    var limpo = melhor === 0;
    var grupo = { teamIds: ids, table: emptyTable(ids), fixtures: rodadas, round: 0 };
    return {
      phase: "group", liga: true, semCompatriotas: limpo, potes: potes,
      groups: [grupo], groupRound: 0, groupRounds: 8, advance: 24,
      twoLeg: true, userId: opts.userId, ko: null, championId: null, aliveUser: true, userQualified: null
    };
  }
  // chaveamento do formato novo, todo definido pela posição na tabela
  function buildKOLiga(state) {
    var tab = standings(state.groups[0].table).map(function (t) { return t.id; });
    var P = function (n) { return tab[n - 1]; };            // P(1) = líder
    // play-off: 9/10 x 23/24 · 11/12 x 21/22 · 13/14 x 19/20 · 15/16 x 17/18
    // o cabeça de chave decide em casa (joga a volta como mandante) -> [visitante, mandante]
    var bandas = [[9, 10, 23, 24], [11, 12, 21, 22], [13, 14, 19, 20], [15, 16, 17, 18]];
    var po = [];
    bandas.forEach(function (b) {
      var alto = shuffle([P(b[0]), P(b[1])]), baixo = shuffle([P(b[2]), P(b[3])]);
      for (var i = 0; i < 2; i++) po.push([baixo[i], alto[i]]);   // ida na casa do pior
    });
    state.ko = {
      teamIds: [], rounds: [], roundIndex: 0,
      labels: ["Play-off", "Oitavas", "Quartas", "Semifinal", "Final"],
      cabecas: [P(1), P(2), P(3), P(4), P(5), P(6), P(7), P(8)],
      liga: true, finalUnica: true
    };
    state.ko.rounds[0] = po.map(function (t) { return [t[0], t[1], null, null, null, null, null, null, null, 0]; });
    var pos = tab.indexOf(state.userId) + 1;
    state.userLigaPos = pos;
    state.userQualified = pos > 0 && pos <= 24;
    if (!state.userQualified) state.aliveUser = false;
    state.phase = "ko";
  }
  function roundLabel(state) {
    var ko = state.ko;
    if (!ko) return "";
    if (ko.labels && ko.labels[ko.roundIndex]) return ko.labels[ko.roundIndex];
    return koTitle(((ko.rounds[ko.roundIndex] || []).length) * 2);
  }

  function userGroup(state) {
    for (var i = 0; i < state.groups.length; i++) if (state.groups[i].teamIds.indexOf(state.userId) >= 0) return state.groups[i];
    return null;
  }
  function userGroupFixture(state) {
    var g = userGroup(state); if (!g) return null;
    var rd = g.fixtures[state.groupRound];
    for (var i = 0; i < rd.length; i++) if (rd[i][0] === state.userId || rd[i][1] === state.userId) return rd[i];
    return null;
  }

  /* ---- mata-mata ---- */
  // a final do formato novo é jogo único em campo neutro; o resto é ida e volta
  function duasMaos(state, nTies) {
    if (!state.twoLeg) return false;
    if (state.ko && state.ko.finalUnica && nTies === 1) return false;
    return true;
  }
  function ensureKO(state) {
    var ko = state.ko;
    if (ko.rounds[ko.roundIndex]) return;
    var pares = [];
    if (ko.liga && ko.roundIndex === 1) {
      // OITAVAS do formato novo: 1º/2º pegam o vencedor do play-off IV,
      // 3º/4º o do III, 5º/6º o do II e 7º/8º o do I. O cabeça decide em casa.
      var venc = ko.rounds[0].map(function (t) { return t[4]; });   // I(0,1) II(2,3) III(4,5) IV(6,7)
      var baseDe = [6, 6, 4, 4, 2, 2, 0, 0];
      var confrontos = [];
      for (var r = 0; r < 8; r++) confrontos.push([venc[baseDe[r] + (r % 2)], ko.cabecas[r]]);
      // chave fechada pela posição: 1x8, 4x5, 3x6, 2x7 nas quartas
      [1, 8, 4, 5, 3, 6, 2, 7].forEach(function (rank) { pares.push(confrontos[rank - 1]); });
    } else {
      var teams = ko.roundIndex === 0 ? ko.teamIds : ko.rounds[ko.roundIndex - 1].map(function (t) { return t[4]; });
      for (var i = 0; i < teams.length; i += 2) pares.push([teams[i], teams[i + 1]]);
    }
    var ida = duasMaos(state, pares.length);
    ko.rounds[ko.roundIndex] = pares.map(function (p) {
      // ida e volta: [a, b, dispA, dispB, winner, ga1, gb1, ga2, gb2, legs]
      return ida ? [p[0], p[1], null, null, null, null, null, null, null, 0] : [p[0], p[1], null, null, null];
    });
  }
  function penWin(ctx, a, b) { var ra = ctx.rating(a), rb = ctx.rating(b); return Math.random() < ra / (ra + rb) ? a : b; }
  function resolveTie(ctx, tie) { var r = ctx.sim(tie[0], tie[1]); var hs = r.score[0], as = r.score[1]; tie[2] = hs; tie[3] = as; tie[4] = hs > as ? tie[0] : as > hs ? tie[1] : penWin(ctx, tie[0], tie[1]); return r; }
  // decide vencedor de um confronto ida e volta (agregado; gol fora; pênaltis)
  function decideTwoLeg(ctx, tie, forcedPenWinner) {
    var aggA = tie[5] + tie[8], aggB = tie[6] + tie[7];   // a: ga1+ga2 · b: gb1+gb2
    tie[2] = aggA; tie[3] = aggB;
    if (aggA !== aggB) { tie[4] = aggA > aggB ? tie[0] : tie[1]; return; }
    var awayA = tie[8], awayB = tie[6];                   // gols fora: a marcou na volta; b marcou na ida
    tie[4] = awayA > awayB ? tie[0] : awayB > awayA ? tie[1] : (forcedPenWinner || penWin(ctx, tie[0], tie[1]));
  }
  function resolveTieTwoLeg(ctx, tie) {
    var l1 = ctx.sim(tie[0], tie[1]); tie[5] = l1.score[0]; tie[6] = l1.score[1];   // a em casa
    var l2 = ctx.sim(tie[1], tie[0]); tie[7] = l2.score[0]; tie[8] = l2.score[1];   // b em casa
    tie[9] = 2; decideTwoLeg(ctx, tie);
  }
  function userTie(state) { var ko = state.ko, rd = ko.rounds[ko.roundIndex]; if (!rd) return null; for (var i = 0; i < rd.length; i++) if (rd[i][0] === state.userId || rd[i][1] === state.userId) return rd[i]; return null; }

  // constrói o chaveamento a partir dos classificados (cruzando 1º x 2º de grupos vizinhos)
  function buildKO(state) {
    var winners = state.groups.map(function (g) { return standings(g.table)[0]; });
    var runners = state.groups.map(function (g) { return standings(g.table)[1]; });
    var ids = [];
    if (state.bestThirds) {
      // formato Copa do Mundo 48: 2 por grupo + melhores 3os colocados
      var thirds = state.groups.map(function (g) { return standings(g.table)[2]; }).filter(Boolean);
      thirds.sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf; });
      var qual = thirds.slice(0, state.bestThirds).map(function (t) { return t.id; });
      var run = runners.map(function (r) { return r.id; });
      var half = Math.floor(run.length / 2);
      var lowers = run.slice(half).concat(run.slice(0, half)).concat(qual); // rotaciona vices p/ não repetir grupo
      var win = winners.map(function (w) { return w.id; });
      for (var i = 0; i < win.length; i++) { ids.push(win[i]); ids.push(lowers[i]); }        // vencedor x (vice/3o)
      for (var j = win.length; j + 1 < lowers.length; j += 2) { ids.push(lowers[j]); ids.push(lowers[j + 1]); } // resto entre si
    } else {
      for (var k = 0; k < winners.length; k++) { ids.push(winners[k].id); ids.push(runners[(k + 1) % runners.length].id); }
    }
    state.ko = { teamIds: ids, rounds: [], roundIndex: 0 };
    state.userQualified = ids.indexOf(state.userId) >= 0;
    if (!state.userQualified) state.aliveUser = false;
    state.phase = "ko";
  }

  // avança auto-sims e retorna a próxima partida do usuário
  function nextUserMatch(state, ctx) {
    if (state.phase === "group") {
      var fix = userGroupFixture(state);
      return { phase: "group", liga: !!state.liga, groupRound: state.groupRound, homeId: fix[0], awayId: fix[1] };
    }
    if (state.phase === "ko") {
      var guard = 0;
      while (guard++ < 20) {
        if (state.championId) { state.phase = "done"; return { end: true, championId: state.championId }; }
        ensureKO(state);
        var tie = userTie(state);
        var nteams = state.ko.rounds[state.ko.roundIndex].length * 2;
        var duas = duasMaos(state, state.ko.rounds[state.ko.roundIndex].length);
        if (state.aliveUser && tie) {
          if (duas) {
            if (tie[9] === 0) return { phase: "ko", ko: true, homeId: tie[0], awayId: tie[1], round: nteams, leg: 1, faseNome: faseNome(state, nteams) };
            if (tie[9] === 1) return { phase: "ko", ko: true, homeId: tie[1], awayId: tie[0], round: nteams, leg: 2, faseNome: faseNome(state, nteams) };
          } else {
            return { phase: "ko", ko: true, homeId: tie[0], awayId: tie[1], round: nteams, faseNome: faseNome(state, nteams) };
          }
        }
        // usuário fora: auto-sim a rodada
        state.ko.rounds[state.ko.roundIndex].forEach(function (t) { if (t[4] == null) (duas ? resolveTieTwoLeg : resolveTie)(ctx, t); });
        if (state.ko.rounds[state.ko.roundIndex].length === 1) state.championId = state.ko.rounds[state.ko.roundIndex][0][4];
        state.ko.roundIndex++;
      }
    }
    return { end: true, championId: state.championId };
  }

  // peek: a partida do usuário vai para pênaltis? { aId, bId } ou null
  function userPenContext(state, hs, as, ctx) {
    if (state.phase !== "ko") return null;
    var tie = userTie(state);
    if (!tie) return null;
    if (duasMaos(state, state.ko.rounds[state.ko.roundIndex].length)) {
      if (tie[9] !== 1) return null;
      var aggA = tie[5] + as, aggB = tie[6] + hs;
      if (aggA !== aggB) return null;
      return as === tie[6] ? { aId: tie[0], bId: tie[1] } : null;
    }
    return hs === as ? { aId: tie[0], bId: tie[1] } : null;
  }

  function applyUserMatch(state, hs, as, ctx, penWinnerId) {
    if (state.phase === "group") {
      state.groups.forEach(function (g) {
        var rd = g.fixtures[state.groupRound];
        rd.forEach(function (m) {
          if (m[0] === state.userId || m[1] === state.userId) applyRes(g.table, m[0], m[1], hs, as);
          else { var r = ctx.sim(m[0], m[1]); applyRes(g.table, m[0], m[1], r.score[0], r.score[1]); }
        });
        g.round++;
      });
      state.groupRound++;
      if (state.groupRound >= state.groupRounds) (state.liga ? buildKOLiga : buildKO)(state);
    } else if (state.phase === "ko") {
      var tie = userTie(state);
      if (duasMaos(state, state.ko.rounds[state.ko.roundIndex].length)) {
        if (tie[9] === 0) {          // ida (usuário mandante): a=tie[0]
          tie[5] = hs; tie[6] = as; tie[9] = 1;
          return;                    // aguarda a volta (não avança a rodada)
        }
        // volta (usuário visitante): mandante é tie[1]
        tie[7] = hs; tie[8] = as; tie[9] = 2; decideTwoLeg(ctx, tie, penWinnerId);
        if (tie[4] !== state.userId) state.aliveUser = false;
        state.ko.rounds[state.ko.roundIndex].forEach(function (t) { if (t[4] == null) resolveTieTwoLeg(ctx, t); });
      } else {
        tie[2] = hs; tie[3] = as; tie[4] = hs > as ? tie[0] : as > hs ? tie[1] : (penWinnerId || penWin(ctx, tie[0], tie[1]));
        if (tie[4] !== state.userId) state.aliveUser = false;
        state.ko.rounds[state.ko.roundIndex].forEach(function (t) { if (t[4] == null) resolveTie(ctx, t); });
      }
      if (state.ko.rounds[state.ko.roundIndex].length === 1) state.championId = state.ko.rounds[state.ko.roundIndex][0][4];
      state.ko.roundIndex++;
    }
  }

  function koTitle(n) { return ({ 32: "16 avos de final", 16: "Oitavas", 8: "Quartas", 4: "Semifinal", 2: "Final", 1: "Final" })[n] || (n + " times"); }
  // nome da fase: no formato de liga o play-off tem 16 times, mas não é "oitavas"
  function faseNome(state, nteams) {
    if (state && state.ko && state.ko.labels) {
      var l = state.ko.labels[state.ko.roundIndex];
      if (l) return l;
    }
    return koTitle(nteams);
  }
  function isDone(state) { return state.phase === "done" || !!state.championId; }

  TM.tournament = {
    create: create, createLiga: createLiga, nextUserMatch: nextUserMatch, applyUserMatch: applyUserMatch, userPenContext: userPenContext,
    standings: standings, koTitle: koTitle, faseNome: faseNome, roundLabel: roundLabel, isDone: isDone, userGroup: userGroup
  };
})(window);
