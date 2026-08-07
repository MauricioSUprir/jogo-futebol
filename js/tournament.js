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

  function create(teamIds, opts) {
    var perGroup = opts.perGroup || 4;
    var nGroups = opts.groups || (teamIds.length / perGroup);
    var ids = shuffle(teamIds);
    var groups = [];
    for (var g = 0; g < nGroups; g++) {
      var gt = ids.slice(g * perGroup, g * perGroup + perGroup);
      groups.push({ teamIds: gt, table: emptyTable(gt), fixtures: roundRobin(gt), round: 0 });
    }
    return {
      phase: "group", groups: groups, groupRound: 0, groupRounds: perGroup - 1, advance: opts.advance || 2,
      userId: opts.userId, ko: null, championId: null, aliveUser: true, userQualified: null
    };
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
  function ensureKO(state) {
    var ko = state.ko;
    if (ko.rounds[ko.roundIndex]) return;
    var teams = ko.roundIndex === 0 ? ko.teamIds : ko.rounds[ko.roundIndex - 1].map(function (t) { return t[4]; });
    var ties = []; for (var i = 0; i < teams.length; i += 2) ties.push([teams[i], teams[i + 1], null, null, null]);
    ko.rounds[ko.roundIndex] = ties;
  }
  function penWin(ctx, a, b) { var ra = ctx.rating(a), rb = ctx.rating(b); return Math.random() < ra / (ra + rb) ? a : b; }
  function resolveTie(ctx, tie) { var r = ctx.sim(tie[0], tie[1]); var hs = r.score[0], as = r.score[1]; tie[2] = hs; tie[3] = as; tie[4] = hs > as ? tie[0] : as > hs ? tie[1] : penWin(ctx, tie[0], tie[1]); return r; }
  function userTie(state) { var ko = state.ko, rd = ko.rounds[ko.roundIndex]; if (!rd) return null; for (var i = 0; i < rd.length; i++) if (rd[i][0] === state.userId || rd[i][1] === state.userId) return rd[i]; return null; }

  // constrói o chaveamento a partir dos classificados (cruzando 1º x 2º de grupos vizinhos)
  function buildKO(state) {
    var winners = state.groups.map(function (g) { return standings(g.table)[0].id; });
    var runners = state.groups.map(function (g) { return standings(g.table)[1].id; });
    var ids = [];
    for (var i = 0; i < winners.length; i++) { ids.push(winners[i]); ids.push(runners[(i + 1) % runners.length]); }
    state.ko = { teamIds: ids, rounds: [], roundIndex: 0 };
    state.userQualified = ids.indexOf(state.userId) >= 0;
    if (!state.userQualified) state.aliveUser = false;
    state.phase = "ko";
  }

  // avança auto-sims e retorna a próxima partida do usuário
  function nextUserMatch(state, ctx) {
    if (state.phase === "group") {
      var fix = userGroupFixture(state);
      return { phase: "group", groupRound: state.groupRound, homeId: fix[0], awayId: fix[1] };
    }
    if (state.phase === "ko") {
      var guard = 0;
      while (guard++ < 20) {
        if (state.championId) { state.phase = "done"; return { end: true, championId: state.championId }; }
        ensureKO(state);
        var tie = userTie(state);
        if (state.aliveUser && tie) return { phase: "ko", ko: true, homeId: tie[0], awayId: tie[1], round: state.ko.rounds[state.ko.roundIndex].length * 2 };
        // usuário fora: auto-sim a rodada
        state.ko.rounds[state.ko.roundIndex].forEach(function (t) { if (t[4] == null) resolveTie(ctx, t); });
        if (state.ko.rounds[state.ko.roundIndex].length === 1) state.championId = state.ko.rounds[state.ko.roundIndex][0][4];
        state.ko.roundIndex++;
      }
    }
    return { end: true, championId: state.championId };
  }

  function applyUserMatch(state, hs, as, ctx) {
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
      if (state.groupRound >= state.groupRounds) buildKO(state);
    } else if (state.phase === "ko") {
      var tie = userTie(state);
      tie[2] = hs; tie[3] = as; tie[4] = hs > as ? tie[0] : as > hs ? tie[1] : penWin(ctx, tie[0], tie[1]);
      if (tie[4] !== state.userId) state.aliveUser = false;
      state.ko.rounds[state.ko.roundIndex].forEach(function (t) { if (t[4] == null) resolveTie(ctx, t); });
      if (state.ko.rounds[state.ko.roundIndex].length === 1) state.championId = state.ko.rounds[state.ko.roundIndex][0][4];
      state.ko.roundIndex++;
    }
  }

  function koTitle(n) { return ({ 16: "Oitavas", 8: "Quartas", 4: "Semifinal", 2: "Final", 1: "Final" })[n] || (n + " times"); }
  function isDone(state) { return state.phase === "done" || !!state.championId; }

  TM.tournament = {
    create: create, nextUserMatch: nextUserMatch, applyUserMatch: applyUserMatch,
    standings: standings, koTitle: koTitle, isDone: isDone, userGroup: userGroup
  };
})(window);
