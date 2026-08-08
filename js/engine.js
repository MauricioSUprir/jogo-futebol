/* ================= TOTAL MATCH — motor de simulação ================= */
/* Simula uma partida entre dois times (clubes ou seleções), produzindo:
   - eventos minuto a minuto (gol, pênalti, cartão amarelo/vermelho)
   - placar final e estatísticas
   - desempenho de um "jogador em foco" (Carreira de Jogador)   */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  var GOAL_LINES = [
    "GOLAÇO! {p} não perdoa!", "{p} balança as redes!",
    "É GOL! {p} apareceu na hora certa!", "{p} manda pra dentro!",
    "Ninguém pega! {p} marca!"
  ];
  var CHANCE_LINES = [
    "{p} arrisca de fora da área...", "{t} chega com perigo com {p}...",
    "Grande jogada, {p} finaliza...", "{p} tenta a jogada individual..."
  ];
  var MISS_LINES = [
    "para fora! Quase!", "o goleiro defende!", "na trave! Inacreditável!",
    "a zaga bloqueia!", "isolada, que desperdício!"
  ];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function fmt(s, p, t) { return s.replace("{p}", p).replace("{t}", t); }

  function teamProfile(side) {
    var players = side.players;
    var xi = players.slice(0, 11);
    var fw = xi.filter(function (p) { return p.pos === "FW"; });
    var mf = xi.filter(function (p) { return p.pos === "MF"; });
    var df = xi.filter(function (p) { return p.pos === "DF"; });
    var gk = xi.filter(function (p) { return p.pos === "GK"; })[0] || xi[xi.length - 1];
    function avg(arr, fn) { return arr.length ? arr.reduce(function (s, p) { return s + fn(p); }, 0) / arr.length : 55; }
    var attack = (avg(fw.length ? fw : xi, function (p) { return (p.attrs.sho + p.attrs.pac + p.attrs.dri) / 3; }) * 0.6
                + avg(mf.length ? mf : xi, function (p) { return (p.attrs.pas + p.attrs.dri) / 2; }) * 0.4);
    var defense = (avg(df.length ? df : xi, function (p) { return (p.attrs.def + p.attrs.phy) / 2; }) * 0.7 + gk.attrs.def * 0.3);
    var midfield = avg(mf.length ? mf : xi, function (p) { return p.attrs.pas; });
    return { xi: xi, gk: gk, attack: attack, defense: defense, midfield: midfield,
      scorers: (fw.concat(mf)).length ? fw.concat(mf) : xi };
  }

  function chooseScorer(profile, focusId) {
    var pool = profile.scorers;
    var weights = pool.map(function (p) {
      var w = (p.attrs.sho + p.attrs.dri) / 2;
      if (p.pos === "FW") w *= 1.6; else if (p.pos === "MF") w *= 1.0; else w *= 0.4;
      if (p.id === focusId) w *= 1.35;
      return w;
    });
    var total = weights.reduce(function (s, w) { return s + w; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[0];
  }

  function simulate(teamA, teamB, opts) {
    opts = opts || {};
    var realism = opts.realism || 3;
    var variance = 1.9 - (realism - 1) * 0.28;
    var focusId = opts.focusPlayerId || null;

    var A = teamProfile(teamA), B = teamProfile(teamB);
    var homeBoost = opts.neutral ? 0 : 3;
    var redPenalty = [0, 0]; // redução de força por expulsão

    // modificadores de tática do time do usuário
    var atkMod = [1, 1], defMod = [1, 1];
    if (opts.tacticSide != null) {
      var t = opts.tactic, s = opts.tacticSide;
      if (t === "ofensivo") { atkMod[s] = 1.14; defMod[s] = 0.88; }
      else if (t === "defensivo") { atkMod[s] = 0.88; defMod[s] = 1.14; }
      else if (t === "contra-ataque") { atkMod[s] = 1.06; defMod[s] = 1.04; }
    }

    function chanceProb(atk, opDef, redsMine) {
      var edge = (atk - opDef);
      var base = Math.max(0.02, 0.09 + edge * 0.0022) * variance / 1.9;
      return base * (1 - redsMine * 0.16);
    }

    var startMinute = opts.startMinute || 1;
    var events = startMinute <= 1 ? [{ minute: 0, type: "kickoff", text: teamA.name + " x " + teamB.name }] : [];
    var score = opts.startScore ? opts.startScore.slice() : [0, 0];
    var shots = [0, 0], onTarget = [0, 0];
    var focusGoals = 0, focusInvolved = 0, focusInjured = false;
    var injuries = [], sentOff = [];

    function tryScore(side, prof, opp, team, minute, isPen) {
      shots[side]++;
      var scorer = isPen ? chooseScorer(prof, focusId) : chooseScorer(prof, focusId);
      if (scorer.id === focusId) focusInvolved++;
      var gk = opp.gk;
      var goalP = isPen ? 0.76 : Math.max(0.08, Math.min(0.62, 0.30 + (scorer.attrs.sho - gk.attrs.def) * 0.006)) * (variance / 1.9);
      if (Math.random() < goalP) {
        onTarget[side]++; score[side]++;
        if (scorer.id === focusId) focusGoals++;
        events.push({ minute: minute, type: isPen ? "pengoal" : "goal", team: side, player: scorer.name,
          score: score.slice(), text: (isPen ? "PÊNALTI CONVERTIDO! " : "") + fmt(pick(GOAL_LINES), scorer.name, team.name) });
      } else {
        if (Math.random() < 0.5) onTarget[side]++;
        events.push({ minute: minute, type: isPen ? "penmiss" : "chance", team: side, player: scorer.name,
          text: isPen ? (scorer.name + " cobra o pênalti... e o goleiro defende!") : (fmt(pick(CHANCE_LINES), scorer.name, team.name) + " " + pick(MISS_LINES)) });
      }
    }

    for (var m = startMinute; m <= 90; m++) {
      if (m === 45) events.push({ minute: 45, type: "half", score: score.slice(), text: "Fim do 1º tempo" });

      var pA = chanceProb((A.attack + homeBoost) * atkMod[0], B.defense * defMod[1], redPenalty[0]);
      var pB = chanceProb(B.attack * atkMod[1], A.defense * defMod[0], redPenalty[1]);

      [[0, pA, A, B, teamA], [1, pB, B, A, teamB]].forEach(function (row) {
        var side = row[0], prob = row[1], prof = row[2], opp = row[3], team = row[4];
        if (Math.random() < prob) {
          if (Math.random() < 0.07) {
            // pênalti!
            events.push({ minute: m, type: "penalty", team: side, text: "PÊNALTI para o " + team.name + "!" });
            tryScore(side, prof, opp, team, m, true);
          } else {
            tryScore(side, prof, opp, team, m, false);
          }
        }
      });

      // cartões
      if (Math.random() < 0.02) {
        var s = Math.random() < 0.5 ? 0 : 1;
        var prof2 = s === 0 ? A : B, team2 = s === 0 ? teamA : teamB;
        var pl = pick(prof2.xi);
        if (Math.random() < 0.14) {
          events.push({ minute: m, type: "red", team: s, text: "🟥 " + pl.name + " (" + team2.name + ") está EXPULSO!" });
          redPenalty[s]++;
          sentOff.push({ id: pl.id, name: pl.name, side: s });
        } else {
          events.push({ minute: m, type: "yellow", team: s, text: "Amarelo para " + pl.name + " (" + team2.name + ")" });
        }
      }
      // lesões
      if (Math.random() < 0.006) {
        var si = Math.random() < 0.5 ? 0 : 1;
        var prof3 = si === 0 ? A : B, team3 = si === 0 ? teamA : teamB;
        var inj = pick(prof3.xi);
        var weeks = 1 + Math.floor(Math.random() * 6);
        events.push({ minute: m, type: "injury", team: si, text: "🚑 " + inj.name + " (" + team3.name + ") se lesionou e deixa o campo." });
        injuries.push({ id: inj.id, name: inj.name, side: si, weeks: weeks });
        if (inj.id === focusId) focusInjured = weeks;
      }
    }

    var possA = Math.max(30, Math.min(70, Math.round(50 + (A.midfield - B.midfield) * 0.8)));
    events.push({ minute: 90, type: "full", score: score.slice(), text: "Fim de jogo!" });

    var focusRating = null;
    if (focusId) {
      var teamSide = teamA.players.some(function (p) { return p.id === focusId; }) ? 0 : 1;
      var won = score[teamSide] > score[1 - teamSide], draw = score[0] === score[1];
      focusRating = 6.0 + focusGoals * 1.1 + focusInvolved * 0.15 + (won ? 0.6 : draw ? 0.1 : -0.4) + (Math.random() - 0.5) * 0.6;
      focusRating = Math.max(4.5, Math.min(10, Math.round(focusRating * 10) / 10));
    }

    return {
      score: score, events: events,
      stats: { possession: [possA, 100 - possA], shots: shots, onTarget: onTarget },
      injuries: injuries, sentOff: sentOff,
      focus: focusId ? { goals: focusGoals, rating: focusRating, injured: focusInjured } : null
    };
  }

  TM.engine = {
    simulate: simulate,
    teamFromClub: function (clubId, rosterOverride) {
      var club = TM.data.club(clubId);
      var players = rosterOverride || TM.data.clubPlayers(clubId);
      return { id: club.id, name: club.name, players: players, club: club };
    },
    teamFromNation: function (natId, rosterOverride) {
      var nat = TM.data.nation(natId);
      return { id: nat.id, name: nat.name, players: rosterOverride || TM.data.nationSquad(natId), nation: nat };
    }
  };
})(window);
