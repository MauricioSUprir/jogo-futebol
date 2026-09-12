/* ================= TOTAL MATCH — motor de simulação ================= */
/* Simula uma partida entre dois times (clubes ou seleções), produzindo:
   - eventos minuto a minuto (gol, pênalti, cartão amarelo/vermelho)
   - placar final e estatísticas
   - desempenho de um "jogador em foco" (Carreira de Jogador)   */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  /* Táticas: [chave, rótulo] + modificadores [ataque, defesa] do lado do usuário */
  var TACTICS = [
    ["retranca", "Retranca"], ["defensivo", "Defensivo"], ["equilibrado", "Equilibrado"],
    ["contra-ataque", "Contra-ataque"], ["ofensivo", "Ofensivo"], ["pressao", "Pressão total"]
  ];
  var TACTIC_MODS = {
    muralha: [0.66, 1.32], retranca: [0.74, 1.26], defensivo: [0.88, 1.14], "contra-ataque": [1.07, 1.05],
    cadenciado: [1.02, 1.08], equilibrado: [1, 1], posse: [1.09, 1.05], "tiki-taka": [1.13, 1.02],
    pontas: [1.12, 0.97], direto: [1.11, 0.93], ofensivo: [1.15, 0.87], "linha-alta": [1.17, 0.83], pressao: [1.20, 0.80]
  };

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
    var ovr = avg(xi, function (p) { return p.overall || 60; });
    return { xi: xi, gk: gk, attack: attack, defense: defense, midfield: midfield, ovr: ovr,
      scorers: (fw.concat(mf)).length ? fw.concat(mf) : xi };
  }

  function chooseScorer(profile, focusId, focusMult) {
    var pool = profile.scorers;
    var weights = pool.map(function (p) {
      var w = (p.attrs.sho + p.attrs.dri) / 2;
      if (p.pos === "FW") w *= 1.6; else if (p.pos === "MF") w *= 1.0; else w *= 0.4;
      if (p.id === focusId) w *= 1.35 * (focusMult || 1);
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
    // realismo (1..5): quanto a QUALIDADE dos elencos pesa no resultado. Não muda a média de gols:
    // 1 = muito aleatório (zebras frequentes) · 3 = padrão · 5 = bem fiel aos elencos (zebra rara, mas possível)
    var variance = 1.34;                                   // fator fixo de gols (~2,6 a 3 por jogo)
    var kq = 0.6 + (realism - 1) * 0.2;                    // 0.6 .. 1.4
    var focusId = opts.focusPlayerId || null;

    var A = teamProfile(teamA), B = teamProfile(teamB);
    // CONTEXTO DE FUTEBOL (opcional): torcida/estádio (0..1), fase recente (-1..1 por lado), clássico, o que está em jogo (0..1 por lado)
    var crowd = opts.crowd == null ? 0.5 : Math.max(0, Math.min(1, opts.crowd));
    var homeBoost = opts.neutral ? 0 : 1.5 + crowd * 3;          // casa lotada pesa mais (1.5 .. 4.5)
    var form = opts.form || [0, 0], stakes = opts.stakes || [0, 0], derby = !!opts.derby;
    var redPenalty = [0, 0]; // redução de força por expulsão

    // modificadores de tática do time do usuário
    var atkMod = [1, 1], defMod = [1, 1];
    if (opts.tacticSide != null) {
      var t = opts.tactic, s = opts.tacticSide;
      var tm = TACTIC_MODS[t];
      if (tm) { atkMod[s] = tm[0]; defMod[s] = tm[1]; }
    }
    // online: cada lado pode ter a própria tática (opts.tactics = [táticaA, táticaB])
    if (opts.tactics) {
      opts.tactics.forEach(function (t, i) { var tm2 = t && TACTIC_MODS[t]; if (tm2) { atkMod[i] = tm2[0]; defMod[i] = tm2[1]; } });
    }
    // moral (ex.: coletiva de imprensa): pequeno empurrão no ataque e defesa do lado
    if (opts.moraleBoost && opts.moraleSide != null) {
      var mb = Math.max(-3, Math.min(3, opts.moraleBoost)) * 0.02; // ±6%
      atkMod[opts.moraleSide] *= (1 + mb); defMod[opts.moraleSide] *= (1 + mb);
    }
    // fase recente (embalo/crise) e motivação (briga por título/rebaixamento): até ±4% no ataque e ±2% na defesa
    [0, 1].forEach(function (i) {
      var f = Math.max(-1, Math.min(1, form[i] || 0)), st = Math.max(0, Math.min(1, stakes[i] || 0));
      atkMod[i] *= (1 + f * 0.04 + st * 0.03); defMod[i] *= (1 + f * 0.02 + st * 0.02);
    });
    // dificuldade: ajusta a força do time do usuário (fácil ajuda, lenda dificulta)
    var DIFF = { facil: 1.4, normal: 0, dificil: -1.4, lenda: -2.8 };
    if (opts.difficulty && opts.userSide != null && DIFF[opts.difficulty]) {
      var de = DIFF[opts.difficulty] * 0.02;
      atkMod[opts.userSide] *= (1 + de); defMod[opts.userSide] *= (1 + de);
    }

    function chanceProb(atk, opDef, redsMine, ovrGap, redsOpp) {
      var edge = (atk - opDef);
      // qualidade dos elencos pesa mais (setores + overall médio do time), sem impedir zebras:
      // o time pior sempre mantém um mínimo de chances por jogo. Em clássico a diferença técnica pesa menos.
      var kk = derby ? kq * 0.6 : kq;
      var base = Math.min(0.12 + kq * 0.01, Math.max(0.04 - kq * 0.006, 0.088 + (edge * 0.0040 + (ovrGap || 0) * 0.0012) * kk)) * variance / 1.9;
      if (derby) base *= 1.06;                                   // clássico: jogo mais aberto e intenso
      return base * (1 - redsMine * 0.16) * (1 + (redsOpp || 0) * 0.10);   // com um a mais, o adversário cria mais
    }
    // DINÂMICA DA PARTIDA: time pequeno se fecha, quem está atrás se lança, fim de jogo tem gol, embalo depois do gol
    var lastGoalMin = -99, lastGoalSide = -1;
    function dyn(side, minute) {
      var m = 1, diff = score[side] - score[1 - side], gap = (side === 0 ? A.ovr - B.ovr : B.ovr - A.ovr);
      var under = gap <= -6, fav = gap >= 6;
      if (under && diff >= 0 && minute < 65) m *= 0.85;         // zebra segurando o resultado: joga fechada
      if (fav && diff <= 0 && minute < 65 && (side === 0 ? B.ovr - A.ovr : A.ovr - B.ovr) <= -6) m *= 0.92; // e o favorito encontra o ônibus estacionado
      if (minute >= 60 && diff < 0) m *= (minute >= 80 ? 1.4 : 1.22);   // atrás no placar: vai para cima
      if (minute >= 60 && diff > 0) m *= (diff === 1 ? 0.86 : 0.8);      // na frente: administra (abre espaço para contra-ataque)
      if (minute >= 60 && diff > 0 && (side === 0 ? B : A).ovr < (side === 0 ? A : B).ovr - 3) m *= 1.08; // ...mas o time melhor mata no contra-ataque
      if (minute >= 86) m *= 1.25;                                  // acréscimos: bola na área, gol tardio
      if (minute - lastGoalMin <= 4 && lastGoalSide === side) m *= 1.12;   // embalo de quem acabou de marcar
      return m;
    }

    var startMinute = opts.startMinute || 1;
    var events = startMinute <= 1 ? [{ minute: 0, type: "kickoff", text: teamA.name + " x " + teamB.name }] : [];
    var score = opts.startScore ? opts.startScore.slice() : [0, 0];
    var shots = [0, 0], onTarget = [0, 0];
    var focusGoals = 0, focusInvolved = 0, focusInjured = false;
    var injuries = [], sentOff = [];

    // QUEM ESTÁ EM CAMPO: expulsos, lesionados e substituídos saem do jogo de verdade (não marcam gol nem levam cartão);
    // quem entra do banco passa a poder marcar. opts.excludeIds = já fora antes do startMinute (re-simulação após pausa)
    var excl = {}; (opts.excludeIds || []).forEach(function (id) { excl[id] = true; });
    var yellows = {}; (opts.yellowIds || []).forEach(function (id) { yellows[id] = 1; });
    var subsUsed0 = opts.subsUsed || [0, 0];
    var state = [A, B].map(function (prof, i) {
      var team = i === 0 ? teamA : teamB;
      return { pitch: prof.xi.filter(function (p) { return !excl[p.id]; }), bench: team.players.slice(11).filter(function (p) { return !excl[p.id]; }), subs: subsUsed0[i] || 0 };
    });
    function scorersOf(side) { var pl = state[side].pitch; var s = pl.filter(function (p) { return p.pos === "FW" || p.pos === "MF"; }); return s.length ? s : pl; }
    function gkOf(side, prof) {
      if (state[side].pitch.indexOf(prof.gk) >= 0) return prof.gk;
      var best = null; state[side].pitch.forEach(function (p) { if (!best || (p.attrs.def || 0) > (best.attrs.def || 0)) best = p; });
      return best || prof.gk;      // goleiro expulso: um jogador de linha vai para o gol
    }
    function leavePitch(side, p) { state[side].pitch = state[side].pitch.filter(function (x) { return x.id !== p.id; }); }
    function aiSub(side, outP, minute, team, inP) {
      var st = state[side]; if (st.subs >= 3 || !st.bench.length) return false;
      if (!inP || st.bench.indexOf(inP) < 0) inP = st.bench[0];
      st.bench = st.bench.filter(function (x) { return x !== inP; }); st.subs++;
      if (outP) leavePitch(side, outP);
      st.pitch.push(inP);
      events.push({ minute: minute, type: "sub", team: side, out: outP ? outP.name : "", outId: outP ? outP.id : null, "in": inP.name, inId: inP.id,
        text: "🔄 " + team.name + ": " + inP.name + " entra" + (outP ? " no lugar de " + outP.name : "") });
      return true;
    }

    function findIn(xi, id) { for (var i = 0; i < xi.length; i++) if (xi[i].id === id) return xi[i]; return null; }
    function tryScore(side, prof, opp, team, minute, isPen) {
      if (!state[side].pitch.length) return;
      shots[side]++;
      var isUser = (opts.userSide === side);
      var scorer = null;
      // batedor de pênalti designado (time do usuário) — só se estiver em campo
      if (isPen && isUser && opts.penTakerId) scorer = findIn(state[side].pitch, opts.penTakerId);
      // gol de falta do batedor designado (fração dos gols normais do usuário)
      var isFK = false;
      if (!scorer && !isPen && isUser && opts.fkTakerId && Math.random() < 0.16) { scorer = findIn(state[side].pitch, opts.fkTakerId); if (scorer) isFK = true; }
      if (!scorer) scorer = chooseScorer({ scorers: scorersOf(side) }, focusId, opts.focusFormMult);
      if (!scorer) return;
      if (scorer.id === focusId) focusInvolved++;
      var gk = gkOf(1 - side, opp);
      var goalP = isPen ? Math.max(0.68, Math.min(0.9, 0.72 + (scorer.attrs.sho - gk.attrs.def) * 0.004))
        : Math.max(0.08, Math.min(0.6, 0.29 + (scorer.attrs.sho - gk.attrs.def) * 0.0085)) * (variance / 1.9) * (score[side] - score[1 - side] >= 3 ? 0.8 : 1);
      if (Math.random() < goalP) {
        // VAR: parte dos gols (não-pênalti) passa por revisão; alguns são anulados
        var varOn = !isPen && Math.random() < 0.13;
        var annul = varOn && Math.random() < 0.42;
        if (varOn) {
          // tipo de revisão: impedimento, falta, mão na bola ou tecnologia de linha
          var okK = [
            { k: "offside", r: "Sem impedimento — posição legal" },
            { k: "foul", r: "Lance limpo, sem falta na origem" },
            { k: "handball", r: "A bola não tocou no braço" },
            { k: "goalline", r: "A bola cruzou totalmente a linha" }
          ];
          var noK = [
            { k: "offside", r: "Impedimento no início da jogada" },
            { k: "foul", r: "Falta do atacante no lance" },
            { k: "handball", r: "Mão na bola antes do gol" },
            { k: "goalline", r: "A bola não cruzou a linha por completo" }
          ];
          var kk = annul ? pick(noK) : pick(okK);
          events.push({ minute: minute, type: "var", team: side, player: scorer.name, kind: kk.k,
            decision: annul ? "annulled" : "confirmed", reason: kk.r });
        }
        if (annul) { return; } // gol anulado pelo VAR — não conta
        onTarget[side]++; score[side]++; lastGoalMin = minute; lastGoalSide = side;
        if (scorer.id === focusId) focusGoals++;
        events.push({ minute: minute, type: isPen ? "pengoal" : "goal", team: side, player: scorer.name, playerId: scorer.id,
          score: score.slice(), text: (isPen ? "PÊNALTI CONVERTIDO! " : isFK ? "GOL DE FALTA! " : "") + fmt(pick(GOAL_LINES), scorer.name, team.name) });
      } else {
        if (Math.random() < 0.5) onTarget[side]++;
        events.push({ minute: minute, type: isPen ? "penmiss" : "chance", team: side, player: scorer.name,
          text: isPen ? (scorer.name + " cobra o pênalti... e o goleiro defende!") : (fmt(pick(CHANCE_LINES), scorer.name, team.name) + " " + pick(MISS_LINES)) });
      }
    }

    // ---- substituições automáticas (IA) — o lado que NÃO é do usuário troca 2-3 jogadores ----
    var uSide = (opts.userSide != null) ? opts.userSide : (opts.tacticSide != null ? opts.tacticSide : (opts.pauseSide != null ? opts.pauseSide : -1));
    var subPlan = [];
    function planSubs(team, side) {
      var st = state[side]; var xi = st.pitch.slice(), bench = st.bench.slice();
      if (!bench.length) return;
      var n = Math.min(bench.length, 3 - st.subs, 2 + Math.floor(Math.random() * 2)); // 2-3 (respeita o limite de 3 no jogo)
      var outPool = [10, 9, 8, 7, 6, 5, 4].filter(function (i) { return xi[i]; });
      for (var k = 0; k < n; k++) {
        var mn = 58 + Math.floor(Math.random() * 30);
        if (mn < startMinute) mn = startMinute + 1;
        var oi = outPool[k % outPool.length];
        var op = xi[oi], ip = bench[k];
        if (op && ip) subPlan.push({ minute: mn, team: side, outObj: op, inObj: ip });
      }
    }
    if (uSide !== 0) planSubs(teamA, 0);
    if (uSide !== 1) planSubs(teamB, 1);
    subPlan.sort(function (a, b) { return a.minute - b.minute; });

    for (var m = startMinute; m <= 90; m++) {
      if (m === 45) events.push({ minute: 45, type: "half", score: score.slice(), text: "Fim do 1º tempo" });
      // subs agendadas p/ este minuto
      for (var si = 0; si < subPlan.length; si++) {
        if (subPlan[si].minute === m) {
          var sp = subPlan[si], stS = state[sp.team];
          var outP = stS.pitch.indexOf(sp.outObj) >= 0 ? sp.outObj : null;
          if (!outP) { // o planejado já saiu (expulso/lesionado): troca outro jogador de linha
            var cands = stS.pitch.filter(function (p) { return p.pos !== "GK"; });
            outP = cands.length ? cands[cands.length - 1] : null;
          }
          if (outP) aiSub(sp.team, outP, m, sp.team === 0 ? teamA : teamB, sp.inObj);
        }
      }

      var pA = chanceProb((A.attack + homeBoost) * atkMod[0], B.defense * defMod[1], redPenalty[0], A.ovr - B.ovr, redPenalty[1]) * dyn(0, m);
      var pB = chanceProb(B.attack * atkMod[1], A.defense * defMod[0], redPenalty[1], B.ovr - A.ovr, redPenalty[0]) * dyn(1, m);

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
      if (Math.random() < (derby ? 0.032 : 0.02)) {
        var s = Math.random() < 0.5 ? 0 : 1;
        var team2 = s === 0 ? teamA : teamB;
        var pl = state[s].pitch.length ? pick(state[s].pitch) : null;
        if (pl && Math.random() < 0.14) {
          events.push({ minute: m, type: "red", team: s, player: pl.name, playerId: pl.id, text: "🟥 " + pl.name + " (" + team2.name + ") está EXPULSO!" });
          redPenalty[s]++; leavePitch(s, pl);
          sentOff.push({ id: pl.id, name: pl.name, side: s, minute: m });
        } else if (pl) {
          yellows[pl.id] = (yellows[pl.id] || 0) + 1;
          if (yellows[pl.id] >= 2) {
            events.push({ minute: m, type: "red", team: s, player: pl.name, playerId: pl.id, second: true, text: "🟥 Segundo amarelo: " + pl.name + " (" + team2.name + ") está EXPULSO!" });
            redPenalty[s]++; leavePitch(s, pl);
            sentOff.push({ id: pl.id, name: pl.name, side: s, minute: m, second: true });
          } else {
            events.push({ minute: m, type: "yellow", team: s, player: pl.name, playerId: pl.id, text: "Amarelo para " + pl.name + " (" + team2.name + ")" });
          }
        }
      }
      // lesões
      if (Math.random() < 0.0028 && state[0].pitch.length && state[1].pitch.length) {
        var si = Math.random() < 0.5 ? 0 : 1;
        var team3 = si === 0 ? teamA : teamB;
        var inj = pick(state[si].pitch);
        var weeks = 1 + Math.floor(Math.random() * 6);
        events.push({ minute: m, type: "injury", team: si, player: inj.name, playerId: inj.id, text: "🚑 " + inj.name + " (" + team3.name + ") se lesionou e deixa o campo." });
        injuries.push({ id: inj.id, name: inj.name, side: si, weeks: weeks, minute: m });
        leavePitch(si, inj);
        if (inj.id === focusId) focusInjured = weeks;
        if (si !== uSide) aiSub(si, null, m, team3);   // IA coloca alguém do banco no lugar do lesionado
      }
    }

    var possA = Math.max(30, Math.min(70, Math.round(50 + (A.midfield - B.midfield) * 0.8)));
    events.push({ minute: 90, type: "full", score: score.slice(), text: "Fim de jogo!" });

    var focusRating = null;
    if (focusId) {
      var teamSide = teamA.players.some(function (p) { return p.id === focusId; }) ? 0 : 1;
      var won = score[teamSide] > score[1 - teamSide], draw = score[0] === score[1];
      focusRating = 6.0 + focusGoals * 1.1 + focusInvolved * 0.15 + (won ? 0.6 : draw ? 0.1 : -0.4) + (opts.focusForm || 0) + (Math.random() - 0.5) * 0.6;
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
    simulate: simulate, TACTICS: TACTICS, TACTIC_MODS: TACTIC_MODS,
    teamFromClub: function (clubId, rosterOverride) {
      var club = TM.data.club(clubId);
      var players = rosterOverride || TM.data.clubPlayers(clubId);
      return { id: club.id, name: club.name, players: players, club: club };
    },
    teamFromNation: function (natId, rosterOverride) {
      var nat = TM.data.nation(natId);
      return { id: nat.id, name: nat.name, players: rosterOverride || TM.data.nationSquad(natId), nation: nat };
    },
    shootout: shootout
  };

  /* ---------- disputa de pênaltis ----------
     Retorna { winner:0|1, score:[a,b], kicks:[{side, name, scored}] }.
     Melhor-de-5 com parada antecipada + morte súbita. */
  function shootout(teamA, teamB) {
    var teams = [teamA, teamB];
    function takers(t) {
      return (t.players || []).slice().filter(function (p) { return p.pos !== "GK"; })
        .sort(function (a, b) { return ((b.attrs.sho || 0) + (b.attrs.dri || 0)) - ((a.attrs.sho || 0) + (a.attrs.dri || 0)); });
    }
    var tk = [takers(teamA), takers(teamB)];
    if (!tk[0].length) tk[0] = teamA.players.slice();
    if (!tk[1].length) tk[1] = teamB.players.slice();
    function gkDefOf(t) {
      var g = t.gk;
      if (!g || !g.attrs) g = (t.players || []).filter(function (p) { return p.pos === "GK"; }).sort(function (a, b) { return (b.attrs.def || 0) - (a.attrs.def || 0); })[0];
      return g && g.attrs ? g.attrs.def : 72;
    }
    var gkDef = [ gkDefOf(teamB), gkDefOf(teamA) ]; // goleiro adversário de cada lado
    var idx = [0, 0], score = [0, 0], taken = [0, 0], kicks = [];
    function doKick(side) {
      var pool = tk[side], p = pool[idx[side] % pool.length]; idx[side]++;
      var sho = (p.attrs && p.attrs.sho) || 70;
      var prob = Math.max(0.5, Math.min(0.94, 0.66 + (sho - 70) * 0.006 - (gkDef[side] - 72) * 0.004));
      var scored = Math.random() < prob;
      taken[side]++; if (scored) score[side]++;
      kicks.push({ side: side, name: p.name, scored: scored, player: p });
    }
    function firstFiveDecided() {
      var remA = Math.max(0, 5 - taken[0]), remB = Math.max(0, 5 - taken[1]);
      return score[0] > score[1] + remB || score[1] > score[0] + remA;
    }
    var order = 0;
    while (taken[0] < 5 || taken[1] < 5) {
      var side = order % 2; order++;
      if (taken[side] >= 5) continue;
      doKick(side);
      if (firstFiveDecided()) break;
    }
    var guard = 0;
    while (score[0] === score[1] && guard < 40) { doKick(0); doKick(1); guard++; }
    return { winner: score[0] > score[1] ? 0 : 1, score: score, kicks: kicks };
  }
})(window);
