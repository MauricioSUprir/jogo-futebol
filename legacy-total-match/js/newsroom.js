/* ================= TOTAL MATCH — Redação (aba 📰 Notícias, versão jornal) =================
   Um portal esportivo de verdade: veículos e repórteres fictícios, crônicas de cada partida sua, análise semanal
   da tabela, giro do mercado (negócios seus e dos outros clubes), giro pelo mundo (ligas observadas) e os avisos
   marcados como notícia reescritos em linguagem jornalística, com linha fina, contexto e aspas.
   Texto determinístico (semente por artigo): a mesma notícia não muda a cada abertura da aba. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };

  /* ---------- utilidades ---------- */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rngOf(seed) { var x = hash(seed) || 1; return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  function pick(r, arr) { arr = arr || []; return arr[Math.floor(r() * arr.length)]; }
  function arr(x) { return Array.isArray(x) ? x : (x && typeof x === "object" ? Object.keys(x).map(function (k) { return x[k]; }) : []); }
  function club(id) { return id ? TM.data.club(id) : null; }
  function cname(id) { var c = club(id); return c ? c.name : "clube"; }
  function money(c, v) { try { return C().fmtMoney(c, v); } catch (e) { return v + "M"; } }
  function dateTxt(c, d) { try { return C().dateOf(c, d).full; } catch (e) { return ""; } }
  function ago(c, d) { var n = (c.currentDay || 0) - (d || 0); return n <= 0 ? "hoje" : n === 1 ? "ontem" : "há " + n + " dias"; }
  function coachName(c) { return c.coachName || "o treinador"; }
  function myClub(c) { return club(c.teamId); }
  function oppCoach(cl) { return cl && cl.coach ? cl.coach : null; }
  function posLabel(p) { try { return TM.data.posLabel(p); } catch (e) { return p.pos || ""; } }
  function firstSentence(t) { var m = /^(.+?[.!?])(\s|$)/.exec(t || ""); return m ? m[1] : (t || ""); }
  function cleanTitle(t) { return (t || "").replace(/^[^\wÀ-ÿ]+\s*/, "").trim(); }

  /* ---------- veículos e repórteres ---------- */
  var OUTLETS = {
    tn: { name: "Total News", short: "TN", style: "geral" },
    db: { name: "Diário da Bola", short: "DB", style: "campo" },
    pc: { name: "Placar Central", short: "PC", style: "analise" },
    gm: { name: "Gazeta do Mercado", short: "GM", style: "mercado" },
    bf: { name: "Bastidores FC", short: "BFC", style: "bastidores" },
    mf: { name: "Mundo Futebol", short: "MF", style: "mundo" }
  };
  var REPORTERS = ["Marina Castelo", "Rafael Duarte", "Camila Nogueira", "Thiago Bastos", "Letícia Fonseca", "Bruno Sampaio", "Helena Azevedo", "Caio Menezes", "Júlia Tavares", "Diego Lacerda", "Renata Prado", "Vinícius Rocha", "Sofia Albuquerque", "Gustavo Peixoto"];
  function reporter(seed) { return REPORTERS[hash("rep" + seed) % REPORTERS.length]; }
  var SECTIONS = [ ["all", "Todas"], ["club", "Meu clube"], ["campo", "Campo"], ["mercado", "Mercado"], ["bastidores", "Bastidores"], ["mundo", "Mundo"] ];

  /* ---------- artigo ---------- */
  function article(o) {
    o.id = o.id || hash(o.headline + "|" + o.day);
    o.author = o.author || reporter(o.id);
    o.outlet = OUTLETS[o.outlet] || OUTLETS.tn;
    o.paras = (o.paras || []).filter(Boolean);
    o.quotes = (o.quotes || []).filter(Boolean);
    o.priority = o.priority || 0;
    return o;
  }
  function ctxPara(c, r) {
    try {
      var pos = C().currentPosition(c), st = C().standings(c.comps.league.table), me = st.filter(function (x) { return x.id === c.teamId; })[0];
      var form = (c.recentForm || []).slice(-5).join("");
      var mood = pos <= 3 ? "vive bom momento" : pos <= 8 ? "faz campanha regular" : pos <= 14 ? "oscila na tabela" : "vive fase delicada";
      return "O " + myClub(c).name + " " + mood + ": ocupa a " + pos + "ª colocação da " + c.comps.league.name + (me ? ", com " + me.pts + " pontos em " + me.p + " jogos" : "") + (form ? " (últimos resultados: " + form.split("").join("-") + ")" : "") + ".";
    } catch (e) { return null; }
  }
  function nextPara(c) {
    try {
      var nx = C().peekSchedule(c, 1)[0]; if (!nx || nx.tbd) return null;
      var opp = nx.homeId === c.teamId ? nx.awayId : nx.homeId;
      return "O próximo compromisso é contra o " + cname(opp) + ", " + (nx.homeId === c.teamId ? "em casa" : "fora de casa") + ", pela " + nx.name + ", em " + dateTxt(c, nx.day) + ".";
    } catch (e) { return null; }
  }

  /* ---------- 1) crônicas das partidas ---------- */
  function matchArticles(c) {
    var out = [], me = myClub(c); if (!me) return out;
    arr(c.matchLog).forEach(function (m) { try {
      if (!m || m.season !== (c.season || 1)) return;
      var home = club(m.homeId), away = club(m.awayId); if (!home || !away) return;
      var r = rngOf("match" + m.season + "-" + m.matchNo + "-" + m.hs + m.as);
      var gf = m.userSide === 0 ? m.hs : m.as, ga = m.userSide === 0 ? m.as : m.hs, opp = m.userSide === 0 ? away : home;
      var won = gf > ga, lost = gf < ga, diff = Math.abs(gf - ga), atHome = m.userSide === 0;
      var scorers = arr(m.scorers).filter(Boolean), reds = arr(m.reds).filter(Boolean);
      var mine = scorers.filter(function (s) { return s.t === m.userSide; }), theirs = scorers.filter(function (s) { return s.t !== m.userSide; });
      var top = null, cnt = {}; mine.forEach(function (s) { cnt[s.n] = (cnt[s.n] || 0) + 1; if (!top || cnt[s.n] > cnt[top]) top = s.n; });
      var head, sub;
      if (won && diff >= 3) { head = pick(r, [me.name + " atropela o " + opp.name + " e vence por " + gf + " a " + ga, "Show de bola: " + me.name + " goleia o " + opp.name, me.name + " passeia " + (atHome ? "em casa" : "fora de casa") + " e aplica " + gf + " a " + ga + " no " + opp.name]); }
      else if (won && top && cnt[top] >= 2) { head = pick(r, [top + " decide, e " + me.name + " bate o " + opp.name, "Dia de " + top + ": " + me.name + " vence o " + opp.name + " por " + gf + " a " + ga]); }
      else if (won) { head = pick(r, [me.name + " vence o " + opp.name + " por " + gf + " a " + ga + (atHome ? " e faz a festa da torcida" : " longe de casa"), me.name + " supera o " + opp.name + " e soma três pontos", "Vitória " + (diff === 1 ? "suada" : "convincente") + ": " + me.name + " " + gf + " x " + ga + " " + opp.name]); }
      else if (lost && diff >= 3) { head = pick(r, [me.name + " é goleado pelo " + opp.name + " e liga o alerta", "Noite para esquecer: " + opp.name + " aplica " + ga + " a " + gf + " no " + me.name]); }
      else if (lost) { head = pick(r, [me.name + " perde para o " + opp.name + " por " + ga + " a " + gf, opp.name + " leva a melhor sobre o " + me.name, "Derrota " + (atHome ? "em casa" : "fora") + ": " + me.name + " cai diante do " + opp.name]); }
      else if (gf === 0) { head = pick(r, [me.name + " e " + opp.name + " empatam sem gols", "Zero a zero: " + me.name + " não sai do empate com o " + opp.name]); }
      else { head = pick(r, [me.name + " e " + opp.name + " empatam em " + gf + " a " + ga, "Jogo movimentado: " + me.name + " " + gf + " x " + ga + " " + opp.name]); }
      sub = (m.name ? m.name + (m.label ? " · " + m.label : "") + ". " : "") + (mine.length ? "Gols de " + mine.map(function (s) { return s.n + " (" + s.m + "'" + (s.pen ? ", pênalti" : "") + ")"; }).join(", ") + (theirs.length ? "; " : ".") : "") + (theirs.length ? (mine.length ? "" : "Marcaram ") + theirs.map(function (s) { return s.n + " (" + s.m + "')"; }).join(", ") + " para o " + opp.name + "." : "");
      var stad = null; try { stad = TM.data.stadium(home).name; } catch (e) {}
      var p1 = "Em partida válida pela " + (m.name || c.comps.league.name) + ", o " + home.name + " " + (m.hs > m.as ? "venceu" : m.hs < m.as ? "perdeu para" : "empatou com") + " o " + away.name + " por " + m.hs + " a " + m.as + (stad ? ", no " + stad : "") + ", " + dateTxt(c, m.day) + ".";
      var p2 = scorers.length ? "O placar foi aberto por " + scorers[0].n + " aos " + scorers[0].m + " minutos" + (scorers.length > 1 ? ", e o jogo ainda teve " + (scorers.length - 1) + " gol" + (scorers.length > 2 ? "s" : "") + " depois disso" : "") + "." + (reds.length ? " A partida ficou marcada pela expulsão de " + reds.map(function (x) { return x.n + " (" + x.m + "')"; }).join(" e ") + "." : "") : "Faltou pontaria: apesar das chances, nenhum dos dois times balançou as redes." + (reds.length ? " Houve ainda expulsão de " + reds.map(function (x) { return x.n; }).join(" e ") + "." : "");
      var p3 = m.stats && m.stats.poss ? "Nos números, o " + home.name + " teve " + m.stats.poss[0] + "% de posse de bola e finalizou " + (m.stats.shots ? m.stats.shots[0] : "-") + " vezes, contra " + (m.stats.shots ? m.stats.shots[1] : "-") + " do " + away.name + "." : null;
      var q1 = won ? pick(r, ["Foi uma vitória de equipe. O grupo entendeu o plano e executou.", "Os três pontos eram fundamentais. Agora é descansar e pensar no próximo.", "Gostei da postura. Quando o time é intenso assim, fica difícil para o adversário."]) : lost ? pick(r, ["Não foi a nossa noite. Erramos em momentos decisivos e pagamos caro.", "A responsabilidade é minha. Vamos corrigir na semana.", "O resultado dói, mas o campeonato é longo. Cabeça erguida."]) : pick(r, ["Um ponto fora de casa tem valor, mas queríamos mais.", "Criamos o suficiente para vencer. Faltou o último passe.", "Empate justo pelo que os dois times produziram."]);
      var oc = oppCoach(opp), q2 = oc ? (won ? pick(r, ["Eles foram mais eficientes. Parabéns ao " + me.name + ".", "Tivemos volume de jogo, mas faltou capricho."]) : lost ? pick(r, ["Vitória merecida. O time se doou do primeiro ao último minuto.", "Sabíamos que seria difícil aqui, e o grupo respondeu."]) : pick(r, ["Foi um jogo equilibrado, o empate reflete o que aconteceu.", "Poderíamos ter vencido, mas respeito o ponto."])) : null;
      out.push(article({ id: hash("m" + m.season + "-" + m.matchNo), day: m.day, section: "campo", outlet: "db", tag: won ? "CRÔNICA · VITÓRIA" : lost ? "CRÔNICA · DERROTA" : "CRÔNICA · EMPATE",
        headline: head, sub: sub, paras: [p1, p2, p3, nextPara(c)], priority: 3,
        quotes: [ { who: coachName(c) + ", técnico do " + me.name, text: q1 }, q2 ? { who: oc + ", técnico do " + opp.name, text: q2 } : null ],
        img: { type: "stadium", clubId: home.id }, clubId: opp.id, playerName: top || null, motm: top }));
    } catch (e) {} });
    return out;
  }

  /* ---------- 2) análise semanal da tabela ---------- */
  function analysisArticle(c) {
    var me = myClub(c); if (!me || !c.comps || !c.comps.league) return null;
    var st = C().standings(c.comps.league.table) || [], idx = st.findIndex(function (x) { return x.id === c.teamId; }); if (idx < 0 || st.length < 2) return null;
    var row = st[idx]; if (!row.p) return null;
    var r = rngOf("ana" + (c.season || 1) + "-" + (c.matchNo || 0));
    var lead = st[0], gapTop = lead.pts - row.pts, n = st.length, relLine = st[Math.max(0, n - 4)], gapRel = row.pts - relLine.pts;
    var form = (c.recentForm || []).slice(-5), wins = form.filter(function (x) { return x === "V"; }).length, losses = form.filter(function (x) { return x === "D"; }).length;
    var pos = idx + 1, target = (c.objective && c.objective.maxPos) || 10;
    var head, tag;
    if (pos === 1) { head = pick(r, [me.name + " lidera a " + c.comps.league.name + " e vira o time a ser batido", "Na ponta: " + me.name + " mantém a liderança"]); tag = "ANÁLISE · LIDERANÇA"; }
    else if (pos <= 4) { head = pick(r, [me.name + " se firma no G-4 e mira a liderança", "Campanha sólida coloca o " + me.name + " entre os primeiros"]); tag = "ANÁLISE · TABELA"; }
    else if (pos >= n - 3) { head = pick(r, [me.name + " entra na zona de rebaixamento e pressão cresce sobre " + coachName(c), "Alerta vermelho: " + me.name + " afunda na tabela"]); tag = "ANÁLISE · CRISE"; }
    else if (wins >= 3) { head = pick(r, ["Embalado: " + me.name + " vence " + wins + " dos últimos " + form.length + " e sobe na tabela", me.name + " vive melhor sequência da temporada"]); tag = "ANÁLISE · FASE"; }
    else if (losses >= 3) { head = pick(r, [me.name + " acumula derrotas e vê a meta ficar distante", "Sequência ruim coloca " + coachName(c) + " sob pressão"]); tag = "ANÁLISE · PRESSÃO"; }
    else { head = pick(r, [me.name + " oscila e busca regularidade na " + c.comps.league.name, "Meio da tabela: o que falta ao " + me.name]); tag = "ANÁLISE · TABELA"; }
    function pl(n, s1, s2) { return n + " " + (n === 1 ? s1 : s2); }
    var p1 = "Após " + pl(row.p, "rodada", "rodadas") + ", o " + me.name + " ocupa a " + pos + "ª posição com " + pl(row.pts, "ponto", "pontos") + " (" + pl(row.w, "vitória", "vitórias") + ", " + pl(row.d, "empate", "empates") + " e " + pl(row.l, "derrota", "derrotas") + ", saldo " + (row.gf - row.ga >= 0 ? "+" : "") + (row.gf - row.ga) + ").";
    var p2 = pos === 1 ? "A vantagem para o vice-líder " + cname(st[1].id) + " é de " + (row.pts - st[1].pts) + " ponto(s)." : "A distância para o líder " + cname(lead.id) + " é de " + gapTop + " ponto(s); para a zona de rebaixamento, " + gapRel + ".";
    var p3 = "A diretoria estabeleceu como meta terminar entre os " + target + " primeiros. " + (pos <= target ? "Por ora, o objetivo está sendo cumprido." : "Hoje o time está " + (pos - target) + " posição(ões) abaixo do exigido, e a cobrança tende a aumentar.");
    var q = pos <= target ? pick(r, ["Estamos no caminho, mas ninguém aqui relaxa. Cada jogo é uma final.", "O grupo merece o crédito. Seguimos com os pés no chão."]) : pick(r, ["Sei da cobrança e ela é justa. Vamos responder dentro de campo.", "A tabela não mente, mas ainda há muito campeonato pela frente."]);
    return article({ id: hash("ana" + (c.season || 1) + "-" + (c.matchNo || 0)), day: c.currentDay || 0, section: "campo", outlet: "pc", tag: tag, headline: head,
      sub: "Raio-X da campanha do " + me.name + " na " + c.comps.league.name + " até aqui.", paras: [p1, p2, p3, nextPara(c)], quotes: [ { who: coachName(c), text: q } ], img: { type: "club", clubId: c.teamId }, priority: 2 });
  }

  /* ---------- 3) mercado: seus negócios + giro dos outros clubes ---------- */
  var KIND_TXT = { in: "contrata", out: "vende", loanIn: "recebe por empréstimo", loanOut: "empresta", free: "assina com", pre: "assina pré-contrato com", clause: "paga a cláusula de", swap: "fecha troca por" };
  function marketArticles(c) {
    var out = [], me = myClub(c); if (!me) return out;
    arr(c.deals).slice(0, 10).forEach(function (d, i) { try {
      if (!d || d.season !== (c.season || 1)) return;
      var r = rngOf("deal" + d.season + "-" + d.day + "-" + d.pid + "-" + d.type);
      var incoming = d.type === "in" || d.type === "loanIn" || d.type === "free" || d.type === "pre";
      var other = d.other || "outro clube";
      var head = incoming ? pick(r, [me.name + " anuncia " + d.name + (d.fee ? " por " + money(c, d.fee) : "") , "Reforço: " + d.name + " é o novo " + (d.pos ? posLabel({ pos: d.pos }).toLowerCase() : "jogador") + " do " + me.name, me.name + " confirma a chegada de " + d.name + (d.kind === "loan" || d.type === "loanIn" ? " por empréstimo" : "")])
        : pick(r, [d.name + " deixa o " + me.name + " rumo ao " + other + (d.fee ? " por " + money(c, d.fee) : ""), me.name + " negocia " + d.name + " com o " + other, "Adeus: " + d.name + " é vendido ao " + other]);
      var p1 = (incoming ? "O " + me.name + " oficializou a " + (d.type === "loanIn" ? "chegada por empréstimo" : d.type === "free" ? "contratação sem custos" : d.type === "pre" ? "assinatura de pré-contrato" : "contratação") + " de " + d.name : "O " + me.name + " acertou a " + (d.type === "loanOut" ? "saída por empréstimo" : "venda") + " de " + d.name + " para o " + other) + (d.ov ? " (overall " + d.ov + ")" : "") + (d.fee ? ", em negócio de " + money(c, d.fee) : "") + ", " + dateTxt(c, d.day) + ".";
      var p2 = incoming ? pick(r, ["A negociação foi conduzida pessoalmente por " + coachName(c) + ", que pediu o reforço à diretoria como prioridade para a posição.", "Nos bastidores, o clube tratou a contratação como resposta direta às cobranças da torcida por elenco mais competitivo.", "O jogador passou por exames e já treina com o grupo; a estreia depende da regularização."]) : pick(r, ["A saída abre espaço na folha salarial e deve financiar novas contratações.", "Parte da torcida lamentou nas redes sociais, mas a diretoria defendeu o negócio como necessário para as contas.", "O jogador deixa o clube com a gratidão do vestiário, segundo pessoas próximas ao elenco."]);
      var q = incoming ? { who: coachName(c), text: pick(r, ["É um atleta que encaixa no que queremos jogar. Chega para brigar por posição.", "Pedi esse reforço e a diretoria fez o esforço. Agora é trabalho.", "Conhece bem a competição e vai nos ajudar já."]) } : { who: coachName(c), text: pick(r, ["Foi uma decisão de clube. Desejo sorte a ele.", "Toda negociação tem dois lados. Ficamos com a parte boa: o que ele entregou aqui.", "O elenco segue forte. Confio em quem fica."]) };
      out.push(article({ id: hash("deal" + d.season + "-" + d.day + "-" + d.pid + "-" + d.type), day: d.day || 0, section: "mercado", outlet: "gm", tag: incoming ? "MERCADO · REFORÇO" : "MERCADO · SAÍDA", headline: head,
        sub: firstSentence(p1), paras: [p1, p2, ctxPara(c, r)], quotes: [q], img: { type: d.pid && d.pid[0] !== "y" ? "player" : "club", pid: d.pid, clubId: c.teamId }, playerId: d.pid, priority: 2 }));
    } catch (e) {} });
    // giro do mercado: negócios dos outros clubes (agrupados por dia da carreira)
    var feed = arr(c.marketFeed).filter(function (m) { return m && m.season === (c.season || 1); }).slice(0, 40);
    var byDay = {}; feed.forEach(function (m) { var k = m.day || 0; (byDay[k] = byDay[k] || []).push(m); });
    Object.keys(byDay).sort(function (a, b) { return b - a; }).slice(0, 6).forEach(function (k) { try {
      var list = byDay[k].slice().sort(function (a, b) { return (b.val || 0) - (a.val || 0); }), big = list[0];
      var r = rngOf("giro" + (c.season || 1) + "-" + k);
      var head = big.val ? pick(r, [big.toName + " fecha com " + big.name + " por " + money(c, big.val) + (list.length > 1 ? " e movimenta o mercado" : ""), "Giro do mercado: " + big.name + " é o negócio do dia" + (list.length > 1 ? " entre " + list.length + " transferências" : "")]) : pick(r, [big.toName + " anuncia " + big.name, "Giro do mercado: " + list.length + " negócio(s) fechado(s)"]);
      var p1 = "O mercado da bola teve movimentação " + dateTxt(c, +k) + ". O principal negócio foi a ida de " + big.name + (big.ov ? " (" + big.ov + ")" : "") + " para o " + big.toName + (big.fromName ? ", deixando o " + big.fromName : "") + (big.val ? ", por " + money(c, big.val) : ", sem custos") + ".";
      var p2 = list.length > 1 ? "Também mudaram de clube: " + list.slice(1, 6).map(function (m) { return m.name + " (" + (m.fromName || "livre") + " → " + m.toName + (m.val ? ", " + money(c, m.val) : "") + ")"; }).join("; ") + (list.length > 6 ? " e outros " + (list.length - 6) + " negócios" : "") + "." : null;
      var toC = club(big.toId), oc = oppCoach(toC);
      out.push(article({ id: hash("giro" + (c.season || 1) + "-" + k), day: +k, section: "mercado", outlet: "gm", tag: "GIRO DO MERCADO", headline: head, sub: firstSentence(p1), paras: [p1, p2, "Acompanhe todos os negócios em Mercado → 📰 Negócios."],
        quotes: oc ? [ { who: oc + ", técnico do " + big.toName, text: pick(r, ["Era o nome que pedimos. Chega para nos dar mais opções.", "Reforço de qualidade, que conhece a competição.", "Estamos montando um grupo forte para a temporada."]) } ] : [], img: { type: big.pid && big.pid[0] !== "y" ? "player" : "club", pid: big.pid, clubId: big.toId }, clubId: big.toId, priority: 1 }));
    } catch (e) {} });
    return out;
  }

  /* ---------- 4) mundo: ligas observadas ---------- */
  function worldArticles(c) {
    var out = []; if (!c.wl || !c.wl.leagues) return out;
    Object.keys(c.wl.leagues).forEach(function (lid) { try {
      var L = c.wl.leagues[lid], lg = TM.data.league(lid); if (!L || !lg || !L.round || !L.table || L.season !== (c.season || 1)) return;
      var st = Object.keys(L.table).map(function (k) { return L.table[k]; }).sort(function (a, b) { return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga); });
      var lead = st[0], sec = st[1]; if (!lead) return;
      var r = rngOf("world" + lid + "-" + L.round), sc = TM.wl && TM.wl.topScorers ? TM.wl.topScorers(L, 1)[0] : null;
      var head = L.championId ? cname(L.championId) + " é campeão da " + lg.name : pick(r, [cname(lead.id) + " lidera a " + lg.name + " após " + L.round + " rodadas", lg.name + ": " + cname(lead.id) + " na ponta, " + cname(sec.id) + " a " + (lead.pts - sec.pts) + " ponto(s)"]);
      var p1 = "Na " + lg.name + ", o " + cname(lead.id) + " soma " + lead.pts + " pontos em " + lead.p + " jogos e ocupa a liderança" + (sec ? ", seguido por " + cname(sec.id) + " (" + sec.pts + ")" : "") + ".";
      var p2 = sc ? "Na artilharia, " + sc.p.name + " (" + cname(sc.p.clubId) + ") lidera com " + sc.g + " gol" + (sc.g > 1 ? "s" : "") + "." : null;
      var last = (L.last || []).slice(0, 3).map(function (m) { return cname(m[0]) + " " + m[2] + " x " + m[3] + " " + cname(m[1]); }).join(" · ");
      out.push(article({ id: hash("world" + lid + "-" + L.round), day: L.lastDay || c.currentDay || 0, section: "mundo", outlet: "mf", tag: "MUNDO · " + lg.name.toUpperCase(), headline: head, sub: firstSentence(p1),
        paras: [p1, p2, last ? "Resultados recentes: " + last + "." : null, "Tabela completa, rodadas e artilheiros em 🌍 Ligas."], img: { type: "club", clubId: lead.id }, clubId: lead.id, priority: 1 }));
    } catch (e) {} });
    return out;
  }

  /* ---------- 4b) NOTÍCIAS DO MUNDO (outros clubes, sem depender de observação) ---------- */
  var BIG_LEAGUES = ["en", "es", "it", "de", "fr", "br", "ar", "pt", "nl"];
  function worldPool(c) {
    var W = TM.data.world(), clubs = [];
    BIG_LEAGUES.forEach(function (lid) { var lg = TM.data.league(lid); if (lg) clubs = clubs.concat((lg.clubIds || []).map(function (id) { return TM.data.club(id); }).filter(Boolean)); });
    var my = null; try { my = TM.data.club(c.teamId); } catch (e) {}
    if (my && clubs.indexOf(my) < 0) { var mlg = TM.data.league(my.leagueId); if (mlg) clubs = clubs.concat((mlg.clubIds || []).map(function (id) { return TM.data.club(id); }).filter(Boolean)); }
    return clubs.filter(function (cl) { return cl.id !== c.teamId; });
  }
  function bigStars(c, clubs, minOv) {
    var out = [];
    clubs.forEach(function (cl) {
      try { TM.data.clubPlayers(cl.id).forEach(function (p) { if (p && p.overall >= (minOv || 84)) out.push(p); }); } catch (e) {}
    });
    return out;
  }
  // bloco de notícias do mundo: renova a cada 2 jogos seus, com semente fixa (não muda ao reabrir)
  function worldNews(c) {
    var out = [], clubs = worldPool(c);
    if (clubs.length < 8) return out;
    var blk = Math.floor((c.matchNo || 0) / 2), seed = "wn" + (c.season || 1) + "-" + blk;
    var r = rngOf(seed), day0 = c.currentDay || 0;
    function clubAt(i) { return clubs[Math.floor(r() * clubs.length)]; }
    function lgOf(cl) { var L = TM.data.league(cl.leagueId); return L ? L.name : ""; }
    var stars = bigStars(c, clubs, 85); if (stars.length < 3) stars = bigStars(c, clubs, 82);
    var used = {};
    function add(a) { if (a && !used[a.id]) { used[a.id] = 1; out.push(a); } }

    // 1) craque em fase artilheira
    if (stars.length) {
      var s1 = stars[Math.floor(r() * stars.length)], c1 = club(s1.clubId), g = 4 + Math.floor(r() * 9);
      if (c1) add(article({ id: hash(seed + "star" + s1.id), day: day0, section: "mundo", outlet: "mf", tag: "MUNDO · DESTAQUE",
        headline: pick(r, [s1.name + " engata sequência e assume a artilharia " + (lgOf(c1) ? "da " + lgOf(c1) : ""), "Fase artilheira: " + s1.name + " decide mais uma pelo " + c1.name, s1.name + " vive a melhor fase da carreira no " + c1.name]),
        sub: s1.name + " (" + s1.overall + ", " + posLabel(s1) + ", " + (s1.age || 26) + " anos) chegou a " + g + " gols na temporada pelo " + c1.name + ".",
        paras: [ "O " + posLabel(s1).toLowerCase() + " " + s1.name + " virou o nome da temporada " + (lgOf(c1) ? "na " + lgOf(c1) : "no futebol europeu") + ". São " + g + " gols e uma média que o coloca na frente da artilharia.",
          "Clubes de todo o mundo observam a situação, mas o " + c1.name + " garante que não pretende negociá-lo agora.",
          "Para quem enfrenta o " + c1.name + ", o recado é claro: parar " + s1.name.split(" ")[0] + " virou o principal problema tático da temporada." ],
        quotes: [ { who: (c1.coach || "O técnico") + ", técnico do " + c1.name, text: pick(r, ["Ele está num momento raro. Nosso trabalho é dar a bola para ele.", "É um jogador diferenciado, e está com confiança total."]) } ],
        img: { type: "player", pid: s1.id, clubId: c1.id }, clubId: c1.id, playerId: s1.id, priority: 1 }));
    }
    // 2) gigante em crise / técnico pressionado
    var c2 = clubAt(); 
    if (c2) add(article({ id: hash(seed + "crise" + c2.id), day: day0, section: "mundo", outlet: "bf", tag: "MUNDO · BASTIDORES",
      headline: pick(r, ["Pressão no " + c2.name + ": diretoria se reúne para avaliar o comando técnico", c2.name + " vive clima tenso após sequência irregular", "Torcida do " + c2.name + " protesta e cobra reação"]),
      sub: "O " + c2.name + " passa por um momento delicado " + (lgOf(c2) ? "na " + lgOf(c2) : "") + ", segundo pessoas ligadas ao clube.",
      paras: [ "Nos bastidores, o " + c2.name + " discute mudanças. A diretoria evita falar em demissão, mas admite que a paciência tem prazo.",
        "O elenco foi reapresentado com treinos fechados e conversa entre líderes e comissão técnica.",
        "Nomes já circulam no mercado de treinadores, embora o clube negue qualquer sondagem." ],
      quotes: [ { who: (c2.coach || "O técnico") + ", técnico do " + c2.name, text: pick(r, ["Sei onde estou. Cobrança faz parte de clube grande.", "Trabalho é a única resposta que eu conheço."]) } ],
      img: { type: "club", clubId: c2.id }, clubId: c2.id, priority: 1 }));
    // 3) clássico no fim de semana
    var c3 = clubAt(), riv = null;
    try { var rs = TM.data.rivalsOf(c3.id) || []; riv = rs.length ? club(rs[0]) : null; } catch (e) {}
    if (c3 && riv) add(article({ id: hash(seed + "class" + c3.id), day: day0, section: "mundo", outlet: "db", tag: "MUNDO · CLÁSSICO",
      headline: pick(r, ["Clima esquenta para " + c3.name + " x " + riv.name, c3.name + " e " + riv.name + " se enfrentam num clássico decisivo"]),
      sub: "O clássico " + (lgOf(c3) ? "da " + lgOf(c3) : "") + " promete casa cheia e as duas torcidas em festa.",
      paras: [ "A rivalidade entre " + c3.name + " e " + riv.name + " é das mais antigas do futebol e volta a pesar na tabela nesta rodada.",
        "Os dois clubes fecharam os treinos e trocam alfinetadas pela imprensa desde o início da semana.",
        "A expectativa é de estádio lotado e ingressos esgotados horas depois de abrir a venda." ],
      quotes: [ { who: (c3.coach || "O técnico") + ", técnico do " + c3.name, text: "Clássico não se joga, se ganha." },
        { who: (riv.coach || "O técnico") + ", técnico do " + riv.name, text: "Respeitamos o adversário, mas vamos impor o nosso jogo." } ],
      img: { type: "club", clubId: c3.id }, clubId: c3.id, priority: 1 }));
    // 4) joia revelada
    var jovens = [];
    clubs.forEach(function (cl) { try { TM.data.clubPlayers(cl.id).forEach(function (p) { if (p && (p.age || 30) <= 20 && p.overall >= 76) jovens.push(p); }); } catch (e) {} });
    if (jovens.length) {
      var j = jovens[Math.floor(r() * jovens.length)], cj = club(j.clubId);
      if (cj) add(article({ id: hash(seed + "joia" + j.id), day: day0, section: "mundo", outlet: "gm", tag: "MUNDO · REVELAÇÃO",
        headline: pick(r, [j.name + ", de " + (j.age || 19) + " anos, vira alvo dos gigantes", "Joia do " + cj.name + ": " + j.name + " chama a atenção do mercado"]),
        sub: j.name + " (" + j.overall + ", " + posLabel(j) + ") é apontado como uma das maiores promessas do futebol mundial.",
        paras: [ "Com " + (j.age || 19) + " anos, " + j.name + " ganhou espaço no " + cj.name + " e já é tratado como peça de futuro pelo clube.",
          "Olheiros de vários países acompanham os jogos dele, e o entorno do atleta admite sondagens.",
          "O " + cj.name + " trabalha para blindar o jogador com renovação e cláusula alta." ],
        quotes: [ { who: "Empresário de " + j.name, text: pick(r, ["Meu cliente está feliz, mas o futebol dá voltas.", "Ele quer jogar. Onde, o tempo dirá."]) } ],
        img: { type: "player", pid: j.id, clubId: cj.id }, clubId: cj.id, playerId: j.id, priority: 1 }));
    }
    // 5) veterano/ídolo
    var velhos = [];
    clubs.forEach(function (cl) { try { TM.data.clubPlayers(cl.id).forEach(function (p) { if (p && (p.age || 20) >= 35 && p.overall >= 74) velhos.push(p); }); } catch (e) {} });
    if (velhos.length) {
      var v = velhos[Math.floor(r() * velhos.length)], cv = club(v.clubId);
      if (cv) add(article({ id: hash(seed + "vet" + v.id), day: day0, section: "mundo", outlet: "tn", tag: "MUNDO · HISTÓRIA",
        headline: pick(r, [v.name + ", aos " + (v.age || 36) + ", segue decisivo no " + cv.name, "Eterno: " + v.name + " desafia o tempo no " + cv.name]),
        sub: "Aos " + (v.age || 36) + " anos, " + v.name + " continua entre os nomes mais influentes do elenco do " + cv.name + ".",
        paras: [ "A carreira de " + v.name + " atravessa gerações e ele segue como referência dentro e fora de campo no " + cv.name + ".",
          "O clube já discute o futuro do atleta: renovação por mais uma temporada ou início de uma despedida planejada." ],
        quotes: [ { who: (cv.coach || "O técnico") + ", técnico do " + cv.name, text: "Profissional exemplar. Os jovens aprendem só de olhar." } ],
        img: { type: "player", pid: v.id, clubId: cv.id }, clubId: cv.id, playerId: v.id, priority: 1 }));
    }
    // 6) panorama de uma liga grande
    var lgId = BIG_LEAGUES[Math.floor(r() * BIG_LEAGUES.length)], lgo = TM.data.league(lgId);
    if (lgo && lgo.clubIds && lgo.clubIds.length > 4) {
      var rank = lgo.clubIds.slice().sort(function (a, b) { var ra = 0, rb = 0; try { ra = TM.data.clubRating(a); rb = TM.data.clubRating(b); } catch (e) {} return rb - ra; });
      var l1 = club(rank[0]), l2 = club(rank[1]), l3 = club(rank[2]);
      if (l1 && l2) add(article({ id: hash(seed + "lg" + lgId), day: day0, section: "mundo", outlet: "pc", tag: "MUNDO · " + lgo.name.toUpperCase(),
        headline: pick(r, [lgo.name + ": " + l1.name + " e " + l2.name + " prometem briga ponto a ponto", "Quem leva a " + lgo.name + "? " + l1.name + " lidera as apostas"]),
        sub: "Análise do momento da " + lgo.name + " e dos favoritos ao título.",
        paras: [ "A " + lgo.name + " chega à parte decisiva com " + l1.name + " e " + l2.name + " como principais candidatos" + (l3 ? ", e o " + l3.name + " logo atrás" : "") + ".",
          "Elencos equilibrados e um calendário apertado devem decidir o campeonato nos detalhes.",
          "Acompanhe tabela, rodadas e artilheiros observando a liga em 🌍 Mundo." ],
        quotes: [], img: { type: "club", clubId: l1.id }, clubId: l1.id, priority: 1 }));
    }
    return out;
  }

  /* ---------- 5) avisos marcados como notícia → texto jornalístico ---------- */
  var CATS = {
    "😤": { section: "bastidores", outlet: "bf", tag: "VESTIÁRIO", lead: "Clima tenso nos bastidores.", q: ["Conversei com ele. Situações assim se resolvem dentro do vestiário.", "Todo jogador quer jogar; respeito, mas quem escala sou eu."] },
    "😡": { section: "club", outlet: "bf", tag: "TORCIDA", lead: "A arquibancada reagiu.", q: ["Entendo a torcida. Só peço que confiem no trabalho.", "A paixão é legítima. Nossa resposta tem que ser em campo."] },
    "📰": { section: "mercado", outlet: "gm", tag: "RUMOR", lead: "O mercado agita os bastidores.", q: ["Não comento boatos. Estou focado no próximo jogo.", "Se houver algo concreto, o clube se posiciona."] },
    "⏰": { section: "mercado", outlet: "gm", tag: "DEADLINE DAY", lead: "Contagem regressiva no mercado.", q: ["Estamos atentos a oportunidades até o último minuto.", "O elenco que temos é bom, mas se aparecer algo, avaliamos."] },
    "✍️": { section: "club", outlet: "tn", tag: "OFICIAL", lead: "Anúncio oficial do clube.", q: ["É um passo importante para o projeto.", "Agora é trabalhar para corresponder."] },
    "📝": { section: "mercado", outlet: "gm", tag: "PRÉ-CONTRATO", lead: "Movimento de mercado.", q: ["Planejamento é isso: antecipar cenários.", "É uma peça pensada para a próxima temporada."] },
    "📜": { section: "mercado", outlet: "gm", tag: "CONTRATOS", lead: "Questão contratual em pauta.", q: ["Contrato é papel; o que vale é o compromisso diário.", "A diretoria cuida disso; eu cuido do campo."] },
    "🚪": { section: "bastidores", outlet: "bf", tag: "BASTIDORES", lead: "Mudança nos bastidores.", q: ["Ciclos começam e terminam. Faz parte.", "Saio com a consciência tranquila do trabalho feito."] },
    "💰": { section: "club", outlet: "tn", tag: "DIRETORIA", lead: "Decisão da cúpula do clube.", q: ["Agradeço a confiança. Vamos investir com responsabilidade.", "Recurso é importante, mas o que ganha jogo é trabalho."] },
    "🔧": { section: "club", outlet: "db", tag: "TREINO", lead: "Novidade do departamento técnico.", q: ["Ele se dedicou muito. Agora temos mais uma opção.", "Versatilidade é ouro numa temporada longa."] },
    "💀": { section: "club", outlet: "bf", tag: "CRISE", lead: "Pressão máxima.", q: ["Sei o que o clássico representa. Vamos dar a resposta.", "Não vou me esconder. A cobrança é justa."] },
    "📈": { section: "club", outlet: "pc", tag: "ANÁLISE", lead: "Números em alta.", q: ["Crescimento é fruto de treino e de oportunidade.", "Fico feliz pelos jogadores. É mérito deles."] },
    "⚠️": { section: "club", outlet: "bf", tag: "DIRETORIA", lead: "Sinal amarelo na cúpula.", q: ["Conversamos com franqueza. Estamos alinhados.", "Cobrança faz parte do futebol. Vamos responder."] },
    "🔄": { section: "mercado", outlet: "gm", tag: "TROCA", lead: "Negociação criativa.", q: ["Foi um bom negócio para os dois lados.", "Encaixou o que precisávamos."] },
    "🤝": { section: "club", outlet: "tn", tag: "OFICIAL", lead: "Acordo fechado.", q: ["É um dia importante para o clube.", "Seguimos juntos. Isso é o que importa."] },
    "💼": { section: "club", outlet: "gm", tag: "SAF · NEGÓCIOS", lead: "Movimentação societária.", q: ["Quem ganha é o clube.", "O importante é ter estrutura para competir."] },
    "🩼": { section: "club", outlet: "db", tag: "DEPARTAMENTO MÉDICO", lead: "Baixa importante no elenco.", q: ["É uma perda grande, mas o grupo vai se unir.", "Vamos cuidar dele com calma. Saúde em primeiro lugar."] },
    "🚑": { section: "club", outlet: "db", tag: "DEPARTAMENTO MÉDICO", lead: "Boletim médico.", q: ["Torcemos pela recuperação rápida.", "Faz parte do jogo. Quem entrar vai dar conta."] },
    "👋": { section: "club", outlet: "tn", tag: "DESPEDIDA", lead: "Fim de um ciclo.", q: ["Só tenho a agradecer pelo que ele deu ao clube.", "Deixa um legado. As portas seguem abertas."] },
    "🎖️": { section: "mundo", outlet: "mf", tag: "ADEUS AOS GRAMADOS", lead: "O futebol se despede de um craque.", q: ["Um ídolo do esporte. Sorte de quem viu jogar.", "Referência para qualquer geração."] },
    "⭐": { section: "mercado", outlet: "gm", tag: "MERCADO", lead: "Movimento de mercado.", q: ["Sabíamos que era um nome disputado.", "O mercado é assim: quem decide rápido, leva."] },
    "🔁": { section: "mercado", outlet: "gm", tag: "MERCADO", lead: "Movimento de mercado.", q: ["Acompanhamos tudo, mas cada clube tem sua estratégia.", "O mercado está quente."] },
    "🚨": { section: "club", outlet: "gm", tag: "FINANÇAS", lead: "Alerta nas contas.", q: ["Vamos ser responsáveis. O clube vem antes de tudo.", "Estamos revendo prioridades."] },
    "🔴": { section: "mercado", outlet: "gm", tag: "JANELA FECHADA", lead: "Balanço da janela.", q: ["Agora é com o que temos. E é um bom grupo.", "A janela fechou; o foco é 100% campo."] },
    "🟢": { section: "mercado", outlet: "gm", tag: "JANELA", lead: "Mercado em movimento.", q: ["Estamos preparados para a janela.", "Temos nomes mapeados."] },
    "🌱": { section: "club", outlet: "db", tag: "BASE", lead: "Notícias da base.", q: ["A base é o futuro do clube.", "Quem se destaca, sobe. Simples assim."] },
    "🏆": { section: "mundo", outlet: "mf", tag: "TÍTULO", lead: "Festa garantida.", q: ["Campanha impecável.", "Mérito de todo o grupo."] },
    "🏖️": { section: "club", outlet: "db", tag: "PRÉ-TEMPORADA", lead: "Preparação para a temporada.", q: ["É o momento de testar e ajustar.", "Jogos assim valem por semanas de treino."] },
    "🚫": { section: "club", outlet: "gm", tag: "PUNIÇÃO", lead: "Decisão da FIFA.", q: ["Vamos recorrer, mas respeitamos a decisão.", "Foco no que podemos controlar."] },
    "📄": { section: "club", outlet: "gm", tag: "PATROCÍNIO", lead: "Movimentação comercial.", q: ["Parcerias fortalecem o clube.", "Receita é o que sustenta o projeto."] },
    "🏟️": { section: "club", outlet: "tn", tag: "ESTRUTURA", lead: "Investimento em estrutura.", q: ["Estrutura é o que sustenta resultados.", "A torcida merece."] },
    "🏋️": { section: "club", outlet: "tn", tag: "ESTRUTURA", lead: "Investimento em estrutura.", q: ["Melhores condições de treino, melhor time.", "É um passo de clube grande."] },
    "🔭": { section: "club", outlet: "gm", tag: "OLHEIROS", lead: "Relatório da observação.", q: ["Mapear o mercado é o primeiro passo.", "Temos nomes interessantes no radar."] },
    "🙅": { section: "mercado", outlet: "gm", tag: "MERCADO", lead: "Negociação melada.", q: ["Respeito a decisão do jogador.", "Ele está feliz aqui, isso é bom sinal."] },
    "📨": { section: "mercado", outlet: "gm", tag: "LEILÃO", lead: "Disputa no mercado.", q: ["Vamos ouvir todas as partes. Sem pressa.", "O jogador é valorizado, e isso é bom para o clube."] },
    "🎙️": { section: "bastidores", outlet: "bf", tag: "REPERCUSSÃO", lead: "Declaração repercute.", q: ["Falei o que penso. Sigo em frente.", "A imprensa faz o papel dela."] },
    "💥": { section: "club", outlet: "gm", tag: "SAF", lead: "Ruptura societária.", q: ["Momento difícil, mas o clube é maior que tudo.", "Vamos reorganizar a casa."] },
    "🏅": { section: "club", outlet: "gm", tag: "SAF", lead: "Metas cumpridas.", q: ["Trabalho reconhecido.", "Agora é reinvestir."] }
  };
  function noteArticles(c) {
    var out = [], me = myClub(c);
    arr(c.notifications).filter(function (n) { return n && n.news && !n.offer && !n.loanOffer; }).slice(0, 40).forEach(function (n) { try {
      var cat = CATS[n.icon] || { section: "club", outlet: "tn", tag: "ÚLTIMA HORA", lead: "", q: ["Seguimos trabalhando.", "O foco é o próximo jogo."] };
      var r = rngOf("note" + n.id + n.ts), title = cleanTitle(n.title), text = n.text || "";
      var head = title.length < 26 && me ? title + ": " + firstSentence(text).replace(/\.$/, "") : title;
      if (head.length > 110) head = title;
      var ctx = ctxPara(c, r);
      out.push(article({ id: hash("note" + n.id), day: n.day != null ? n.day : (c.currentDay || 0), section: cat.section, outlet: cat.outlet, tag: cat.tag, headline: head, sub: firstSentence(text),
        paras: [ (cat.lead ? cat.lead + " " : "") + text, ctx ], quotes: [ { who: coachName(c) + (me ? ", técnico do " + me.name : ""), text: pick(r, cat.q) } ], img: { type: "club", clubId: c.teamId }, priority: n.day === (c.currentDay || 0) ? 2 : 1 }));
    } catch (e) {} });
    return out;
  }

  /* ---------- feed ---------- */
  var cache = { key: null, items: [] };
  function feed(c) {
    var key = [c.season, c.currentDay, c.matchNo, (c.notifications || []).length, (c.deals || []).length, (c.marketFeed || []).length, c._nseq].join("|");
    if (cache.key === key) return cache.items;
    function safe(fn) { try { var v = fn(c); return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); } catch (e) { try { console.warn("notícia ignorada:", e); } catch (e2) {} return []; } }
    var items = [].concat(safe(matchArticles), safe(analysisArticle), safe(marketArticles), safe(worldArticles), safe(worldNews), safe(noteArticles));
    items.sort(function (a, b) { return (b.day - a.day) || (b.priority - a.priority) || (a.id - b.id); });
    cache = { key: key, items: items };
    return items;
  }
  function byId(c, id) { return feed(c).filter(function (a) { return String(a.id) === String(id); })[0] || null; }

  /* ---------- imagens ---------- */
  function imgOf(a, cls) {
    try {
      var im = a.img || {};
      if (im.type === "player" && im.pid) { var p = TM.data.player(im.pid); if (p) return TM.img.playerImg(p, cls + " nw-face"); }
      if (im.type === "stadium" && im.clubId) { var cl = club(im.clubId); if (cl) return TM.img.stadiumImg(cl, cls + " nw-stad"); }
      var c2 = club(im.clubId || a.clubId); if (c2) return TM.img.clubImg(c2, cls + " nw-crest");
    } catch (e) {}
    return el("span", { class: cls + " nw-emoji", text: "📰" });
  }
  function byline(c, a) { return el("div", { class: "nw-byline" }, [ el("span", { class: "nw-outlet", text: a.outlet.name }), el("span", { text: " · Por " + a.author + " · " + dateTxt(c, a.day) + " (" + ago(c, a.day) + ")" }) ]); }

  /* ---------- telas ---------- */
  TM.ui.register("coach-news", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    var sec = (params && params.sec) || "all";
    screen.appendChild(TM.ui.topbar("📰 Notícias", function () { TM.ui.go("coach-hub"); }));
    if (TM.coachUI && TM.coachUI.addBar) TM.coachUI.addBar(screen, "coach-news");
    var wrap = el("div", { class: "news-wrap nw" }); screen.appendChild(wrap);
    var items = feed(c), me = myClub(c);
    wrap.appendChild(el("div", { class: "news-masthead" }, [
      el("div", { class: "nm-brand", text: "TOTAL NEWS" }),
      el("div", { class: "nm-tagline", text: "Edição nº " + ((c.matchNo || 0) + 1) + " · Temporada " + (c.season || 1) + " · " + dateTxt(c, c.currentDay || 0) })
    ]));
    var tabs = el("div", { class: "nw-tabs" });
    SECTIONS.forEach(function (s) { tabs.appendChild(el("button", { class: "nw-tab" + (sec === s[0] ? " on" : ""), text: s[1], on: { click: function () { TM.ui.go("coach-news", { sec: s[0] }); } } })); });
    wrap.appendChild(tabs);
    var list = sec === "all" ? items : sec === "club" ? items.filter(function (a) { return a.section === "club" || a.section === "campo" || (a.section === "mercado" && a.outlet.short === "GM" && a.tag.indexOf("GIRO") < 0) || a.section === "bastidores"; }) : items.filter(function (a) { return a.section === sec; });
    if (!list.length) { wrap.appendChild(el("div", { class: "news-empty", text: "Sem notícias nesta editoria por enquanto. Jogue partidas, movimente o mercado e observe ligas para gerar manchetes." })); return; }
    var lead = list[0];
    wrap.appendChild(el("div", { class: "nw-lead clickable", on: { click: function () { TM.ui.go("coach-news-article", { id: lead.id, sec: sec }); } } }, [
      el("div", { class: "nw-lead-img" }, [ imgOf(lead, "nw-lead-pic") ]),
      el("div", { class: "nw-lead-body" }, [
        el("span", { class: "nw-tag", text: lead.tag }),
        el("div", { class: "nw-head", text: lead.headline }),
        el("div", { class: "nw-sub", text: lead.sub }),
        byline(c, lead)
      ])
    ]));
    var grid = el("div", { class: "news-list" });
    list.slice(1, 40).forEach(function (a) {
      grid.appendChild(el("div", { class: "news-item nw-item clickable", on: { click: function () { TM.ui.go("coach-news-article", { id: a.id, sec: sec }); } } }, [
        imgOf(a, "nw-thumb"),
        el("div", { class: "ni-body" }, [ el("span", { class: "nw-tag small", text: a.tag }), el("div", { class: "ni-head", text: a.headline }), el("div", { class: "ni-text", text: a.sub }), byline(c, a) ])
      ]));
    });
    wrap.appendChild(grid);
  });

  TM.ui.register("coach-news-article", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; }
    var a = byId(c, params && params.id); var back = function () { TM.ui.go("coach-news", { sec: (params && params.sec) || "all" }); };
    if (!a) { back(); return; }
    screen.appendChild(TM.ui.topbar(a.outlet.name, back));
    var wrap = el("div", { class: "news-wrap nw-article" }); screen.appendChild(wrap);
    wrap.appendChild(el("div", { class: "nw-art-img" }, [ imgOf(a, "nw-art-pic") ]));
    wrap.appendChild(el("span", { class: "nw-tag", text: a.tag }));
    wrap.appendChild(el("h1", { class: "nw-art-head", text: a.headline }));
    if (a.sub) wrap.appendChild(el("div", { class: "nw-art-sub", text: a.sub }));
    wrap.appendChild(byline(c, a));
    arr(a.paras).forEach(function (p, i) {
      wrap.appendChild(el("p", { class: "nw-p" + (i === 0 ? " lead" : ""), text: p }));
      if (i === 0 && arr(a.quotes)[0]) wrap.appendChild(el("blockquote", { class: "nw-quote" }, [ el("div", { class: "nw-q-text", text: "“" + a.quotes[0].text + "”" }), el("div", { class: "nw-q-who", text: "— " + a.quotes[0].who }) ]));
    });
    arr(a.quotes).slice(1).forEach(function (q) { wrap.appendChild(el("blockquote", { class: "nw-quote" }, [ el("div", { class: "nw-q-text", text: "“" + q.text + "”" }), el("div", { class: "nw-q-who", text: "— " + q.who }) ])); });
    var rel = el("div", { class: "actions nw-rel" });
    var relClub = club(a.clubId || (a.img && a.img.clubId));
    if (relClub) rel.appendChild(TM.ui.button("🏟️ " + relClub.name, function () { TM.ui.go("coach-club-info", { clubId: relClub.id, back: "coach-news" }); }, "btn ghost small"));
    if (a.playerId) { var pl = C().resolvePlayer(c, a.playerId); if (pl && TM.coachUI && TM.coachUI.openPlayer) rel.appendChild(TM.ui.button("👤 " + pl.name, function () { TM.coachUI.openPlayer(pl, "coach-news"); }, "btn ghost small")); }
    rel.appendChild(TM.ui.button("← Voltar ao jornal", back, "btn small"));
    wrap.appendChild(rel);
  });

  TM.newsroom = { feed: feed, byId: byId };
})(window);
