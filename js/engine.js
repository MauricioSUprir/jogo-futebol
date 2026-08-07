/* ================= TOTAL MATCH — motor de simulação ================= */
/* Simula uma partida entre dois times (clubes ou seleções), produzindo:
   - eventos minuto a minuto (para narração ao vivo)
   - placar final e estatísticas
   - desempenho de um "jogador em foco" (usado na Carreira de Jogador)   */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  var GOAL_LINES = [
    "GOLAÇO! {p} não perdoa!", "{p} balança as redes! Que golaço!",
    "É GOL! {p} apareceu na hora certa!", "{p} manda pra dentro! Golaço de {t}!",
    "Ninguém pega! {p} marca para o {t}!"
  ];
  var CHANCE_LINES = [
    "{p} arrisca de fora da área...", "{t} chega com perigo com {p}...",
    "Grande jogada de {t}, {p} finaliza...", "{p} tenta a jogada individual..."
  ];
  var MISS_LINES = [
    "...para fora! Quase!", "...mas o goleiro defende!", "...na trave! Inacreditável!",
    "...bloqueado pela defesa!", "...isolada, que desperdício!"
  ];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function fmt(s, p, t) { return s.replace("{p}", p).replace("{t}", t); }

  // Retira o XI titular e calcula forças de ataque/defesa/meio
  function teamProfile(side) {
    var players = side.players; // já ordenados por overall, cortados em 11+
    var xi = players.slice(0, 11);
    var fw = xi.filter(function (p) { return p.pos === "FW"; });
    var mf = xi.filter(function (p) { return p.pos === "MF"; });
    var df = xi.filter(function (p) { return p.pos === "DF"; });
    var gk = xi.filter(function (p) { return p.pos === "GK"; })[0] || xi[xi.length - 1];
    function avg(arr, fn) { return arr.length ? arr.reduce(function (s, p) { return s + fn(p); }, 0) / arr.length : 55; }

    var attack = (avg(fw.length ? fw : xi, function (p) { return (p.attrs.sho + p.attrs.pac + p.attrs.dri) / 3; }) * 0.6
                + avg(mf.length ? mf : xi, function (p) { return (p.attrs.pas + p.attrs.dri) / 2; }) * 0.4);
    var defense = (avg(df.length ? df : xi, function (p) { return (p.attrs.def + p.attrs.phy) / 2; }) * 0.7
                + (gk.attrs.def) * 0.3);
    var midfield = avg(mf.length ? mf : xi, function (p) { return p.attrs.pas; });

    return {
      xi: xi, attack: attack, defense: defense, midfield: midfield,
      scorers: (fw.concat(mf)).length ? fw.concat(mf) : xi
    };
  }

  // Escolhe o autor do lance, ponderando por capacidade ofensiva
  function chooseScorer(profile, focusId) {
    var pool = profile.scorers;
    var weights = pool.map(function (p) {
      var w = (p.attrs.sho + p.attrs.dri) / 2;
      if (p.pos === "FW") w *= 1.6; else if (p.pos === "MF") w *= 1.0; else w *= 0.4;
      if (p.id === focusId) w *= 1.35; // o craque em foco puxa a responsabilidade
      return w;
    });
    var total = weights.reduce(function (s, w) { return s + w; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[0];
  }

  function simulate(teamA, teamB, opts) {
    opts = opts || {};
    var realism = opts.realism || 3;         // 1..5
    var variance = 1.9 - (realism - 1) * 0.28; // menos realismo => mais imprevisível
    var focusId = opts.focusPlayerId || null;

    var A = teamProfile(teamA), B = teamProfile(teamB);
    // vantagem de casa leve
    var homeBoost = opts.neutral ? 0 : 3;
    var strA = A.attack + homeBoost, strB = B.attack;

    // probabilidade base de gerar um lance por minuto para cada lado
    function chanceProb(atk, opDef) {
      var edge = (atk - opDef);
      return Math.max(0.02, 0.09 + edge * 0.0022) * variance / 1.9;
    }
    var pA = chanceProb(strA, B.defense), pB = chanceProb(strB, A.defense);

    var events = [{ minute: 0, type: "kickoff", text: "🟢 Bola rolando! " + teamA.name + " x " + teamB.name }];
    var score = [0, 0];
    var shots = [0, 0], onTarget = [0, 0];
    var focusGoals = 0, focusInvolved = 0;

    for (var m = 1; m <= 90; m++) {
      if (m === 45) events.push({ minute: 45, type: "half", text: "⏸️ Fim do 1º tempo — " + score[0] + " x " + score[1] });
      [[0, pA, A, teamA, B], [1, pB, B, teamB, A]].forEach(function (row) {
        var side = row[0], prob = row[1], prof = row[2], team = row[3], opp = row[4];
        if (Math.random() < prob) {
          shots[side]++;
          var scorer = chooseScorer(prof, focusId);
          if (scorer.id === focusId) focusInvolved++;
          // probabilidade de converter: finalização do jogador vs goleiro/defesa adversária
          var gk = opp.xi.filter(function (p) { return p.pos === "GK"; })[0] || opp.xi[opp.xi.length - 1];
          var goalP = 0.30 + (scorer.attrs.sho - gk.attrs.def) * 0.006;
          goalP = Math.max(0.08, Math.min(0.62, goalP)) * (variance / 1.9);
          if (Math.random() < goalP) {
            onTarget[side]++;
            score[side]++;
            if (scorer.id === focusId) focusGoals++;
            events.push({ minute: m, type: "goal", team: side,
              text: "⚽ " + m + "' " + fmt(pick(GOAL_LINES), scorer.name, team.name) +
                    "  (" + score[0] + "x" + score[1] + ")", player: scorer.name });
          } else {
            if (Math.random() < 0.5) onTarget[side]++;
            events.push({ minute: m, type: "chance", team: side,
              text: "• " + m + "' " + fmt(pick(CHANCE_LINES), scorer.name, team.name) + " " + pick(MISS_LINES) });
          }
        }
      });
      // cartão eventual
      if (Math.random() < 0.012) {
        var s = Math.random() < 0.5 ? 0 : 1;
        var prof = s === 0 ? A : B, team = s === 0 ? teamA : teamB;
        var pl = pick(prof.xi);
        events.push({ minute: m, type: "card",
          text: "🟨 " + m + "' Cartão amarelo para " + pl.name + " (" + team.name + ")" });
      }
    }

    // posse de bola pela força de meio-campo
    var possA = Math.round(50 + (A.midfield - B.midfield) * 0.8);
    possA = Math.max(30, Math.min(70, possA));

    events.push({ minute: 90, type: "full",
      text: "🔚 Fim de jogo! " + teamA.name + " " + score[0] + " x " + score[1] + " " + teamB.name });

    // nota do jogador em foco (5.0 a 10.0)
    var focusRating = null;
    if (focusId) {
      var teamSide = teamA.players.some(function (p) { return p.id === focusId; }) ? 0 : 1;
      var won = score[teamSide] > score[1 - teamSide];
      var draw = score[0] === score[1];
      focusRating = 6.0 + focusGoals * 1.1 + focusInvolved * 0.15 + (won ? 0.6 : draw ? 0.1 : -0.4)
                    + (Math.random() - 0.5) * 0.6;
      focusRating = Math.max(4.5, Math.min(10, Math.round(focusRating * 10) / 10));
    }

    return {
      score: score,
      events: events,
      stats: {
        possession: [possA, 100 - possA],
        shots: shots,
        onTarget: onTarget
      },
      focus: focusId ? { goals: focusGoals, rating: focusRating } : null
    };
  }

  TM.engine = {
    simulate: simulate,
    // helper: monta o objeto "team" a partir de um clube
    teamFromClub: function (clubId) {
      var club = TM.data.club(clubId);
      return { id: club.id, name: club.name, players: TM.data.clubPlayers(clubId), club: club };
    },
    teamFromNation: function (natId) {
      var nat = TM.data.nation(natId);
      return { id: nat.id, name: nat.name, players: TM.data.nationSquad(natId), nation: nat };
    }
  };
})(window);
