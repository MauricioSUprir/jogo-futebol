/* ================= TOTAL MATCH — Redes Sociais (BolaSocial) ================= */
/* Feed social persistente: torcedores, imprensa e diretoria reagem à partida e
   ao clube. Posts têm curtidas (você também curte), comentários (ver todos),
   fotos em alguns, e de vez em quando rumores "HERE WE GO". Você pode postar —
   as pessoas curtem/comentam e pode repercutir na imprensa. Posts polêmicos
   mexem na MORAL do time. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function chance(p) { return Math.random() < p; }
  function fmtLikes(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n); }
  var uid = 0; function nid() { return "p" + (Date.now ? 0 : 0) + (++uid) + "_" + rint(1000, 9999); }

  // avatar de usuário (círculo colorido + inicial)
  function userAvatar(handle) {
    var h = 0; for (var i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) % 360;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">' +
      '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(' + h + ',60%,50%)"/><stop offset="1" stop-color="hsl(' + ((h + 30) % 360) + ',55%,34%)"/></linearGradient></defs>' +
      '<rect width="48" height="48" rx="24" fill="url(#a)"/>' +
      '<text x="24" y="31" font-family="Arial" font-size="20" font-weight="800" fill="#fff" text-anchor="middle">' +
      handle.replace(/[^A-Za-zÀ-ÿ]/g, "").slice(0, 1).toUpperCase() + '</text></svg>';
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  var FANS = ["@torcida_raiz", "@bola_de_cristal", "@ultras_norte", "@fanatico12", "@setor_azul", "@nacao_verde", "@rei_do_camarote", "@arquibancada_", "@voz_da_torcida", "@mister_gol", "@cafe_com_futebol", "@torcedor_padrao", "@vibra_geral", "@aquele_gol", "@sofa_stadium"];
  var PRESS = ["@GloboEsporte_", "@ge_mercado", "@bola_na_area", "@radar_esportivo", "@central_do_futebol", "@tribuna_fc", "@placar_agora"];
  var HEREWEGO = "@FabricioBall 🔴⚪";

  // fotos genéricas (assets/social) por tema — algumas postagens ganham imagem
  // SOMENTE fotos relacionadas a futebol (torcida, estádio, bola, jogo) — nada de retratos de pessoas.
  var STAD = ["st-30651230.jpg", "st-1171084.jpg", "st-270085.jpg", "st-17071576.jpg", "st-399187.jpg", "st-6295431.jpg", "st-9735500.jpg", "st-10287243.jpg"].map(function (s) { return "assets/estadios/" + s; });
  var PHOTOS = {
    torcida: ["assets/social/s-1884574.jpg"].concat(STAD),
    jogo: ["assets/social/s-274422.jpg", "assets/social/s-3148452.jpg", "assets/social/s-262524.jpg", "assets/social/s-685382.jpg"],
    bola: ["assets/social/s-274506.jpg", "assets/social/s-3621104.jpg", "assets/social/s-1171084.jpg"],
    uniao: ["assets/social/s-3755440.jpg"].concat(STAD.slice(0, 3))
  };
  var _lastPhoto = null;
  function photoOf(theme) {
    var a = PHOTOS[theme] || PHOTOS.jogo;
    var p = pick(a);
    if (a.length > 1) { var g = 0; while (p === _lastPhoto && g++ < 4) p = pick(a); }  // evita repetir a mesma seguidas vezes
    _lastPhoto = p; return p;
  }

  // comentários contextuais — reagem AO TOM E AO TEMA da postagem
  var COMMENTS = {
    win: ["QUE JOGO! 🔥", "esse time tá voando ✈️", "merecido demais", "VAMO QUE VAMO 💪", "orgulho dessa camisa ❤️", "melhor time disparado", "seguimos rumo ao título 🏆", "que atuação, parabéns 👏", "tô empolgado demais", "3 pontos e moral lá em cima", "esse elenco é especial", "chora, rival 😂", "jogando bonito assim dá gosto", "vitória convincente!", "tá on esse time 🟢"],
    loss: ["que vergonha…", "assim não dá pra torcer", "cadê a RAÇA?!", "precisa mudar TUDO", "jogou muito mal", "diretoria, ACORDA", "tá difícil viu", "perdemos fácil demais", "decepcionante", "voltou a decepcionar", "esse time não tem alma", "reforço URGENTE", "que atuação pobre…", "não dá mais pra aguentar", "cadê a intensidade?"],
    neutral: ["kkkk é isso aí", "bora o próximo jogo", "faltou capricho", "empate é pouco", "segue o jogo", "vamo com fé", "dava pra mais", "ponto é ponto", "sério isso?", "sei não hein", "vamo ver no próximo", "tá empatado o campeonato"],
    support: ["nação presente! ❤️", "sempre juntos 💪", "esse time é NOSSO", "confio no trabalho", "vamo pra cima!", "tamo junto professor", "não larga a mão não", "fé no elenco 🙏", "orgulho de torcer", "na alegria e na tristeza ❤️", "seguimos firmes"],
    bold: ["ousado hein 👀", "gostei da postura!", "isso que é atitude", "bota pra quebrar!", "confia no professor", "AGORA VAI", "falou como líder", "postura de campeão 👏", "esse é o discurso!", "comprou minha confiança", "faladíssimo 🎯", "é assim que se fala!"],
    agree: ["concordo demais", "falou tudo", "precisava ser dito", "verdade nua e crua", "é isso mesmo", "assinei embaixo", "não podia concordar mais", "tá certíssimo", "obrigado por falar isso", "alguém precisava dizer"],
    polemic: ["PRENDE ELE 😂", "vai dar ruim isso...", "polêmico hein", "comprou briga agora", "screenshot salvo 📸", "tretaaa", "guarda esse tweet", "já era", "coragem ou loucura?", "vixe, vai sobrar 🍿", "tá lançado o barraco"],
    // temas específicos (coerência com o assunto do post)
    mercado: ["VEM REFORÇO 🔥", "confia no mercado ✍️", "será que fecha mesmo?", "aeee, e a fila anda 👀", "toma que a diretoria mexeu", "esse aí ia ajudar muito", "fonte confiável, acredito", "cadê a placa de assinou? 📝", "se vier, é festa", "melhor que soltar o pipoco no fim da janela"],
    oficial: ["diretoria falou 📢", "confio na gestão", "só quero reforço, o resto é conversa", "papo bonito, cadê a prática?", "vamo cumprir o prometido", "nota oficial anotada ✅", "que venha o planejamento", "esperando as ações agora", "torcida cobrando resultado"],
    estrela: ["craque DEMAIS 👑", "vale ouro esse cara", "NÃO VENDE nunca!", "melhor do elenco disparado", "esse merece a seleção 🇧🇷", "joga muito, respeitem", "ídolo em construção", "blindem esse jogador 🔒", "orgulho de ter ele"],
    news: ["importante isso", "mercado fervendo 🔥", "boa matéria", "acredito na fonte", "seguindo de perto 👀", "notícia quente", "vamo ver no que dá", "anotado ✍️"],
    classico: ["É CLÁSSICO, é diferente! 🔥", "perder esse jogo NÃO PODE", "semana mais tensa do ano 😤", "vamo pra cima do rival! 💪", "quero ganhar de qualquer jeito", "clássico é DECISÃO", "só penso nesse jogo 👀", "rival não ganha da gente não!", "arrepiei só de pensar"]
  };
  function commentPool(mood) { return COMMENTS[mood] || COMMENTS.neutral; }
  function makeComments(n, mood) {
    // garante N comentários COERENTES; mistura uma pitada de reação genérica pra parecer real,
    // sem repetir o mesmo texto em seguida e sem esgotar (recicla o pool se precisar)
    var base = commentPool(mood).slice();
    var spice = COMMENTS.neutral;
    var out = [], last = null;
    for (var i = 0; i < n; i++) {
      var usePool = (base.length && (i % 4 !== 3)) ? base : spice; // 1 a cada ~4 é reação genérica
      if (!usePool.length) usePool = commentPool(mood);
      var txt = pick(usePool), guard = 0;
      while (txt === last && guard++ < 6) txt = pick(usePool);
      // remove do pool principal p/ variedade enquanto houver itens
      if (usePool === base) { var ix = base.indexOf(txt); if (ix >= 0) base.splice(ix, 1); }
      last = txt;
      out.push({ who: pick(FANS), txt: txt, likes: rint(0, 240), liked: false, verified: chance(0.06) });
    }
    return out;
  }
  // TEMA de um post do feed (por tipo/moral) — define QUAIS comentários combinam
  function moodOfPost(o) {
    if (!o) return "neutral";
    if (o.kind === "critica") return "loss";
    if (o.kind === "apoio") return "support";
    if (o.kind === "board") return "oficial";
    if (o.kind === "polemica") return "polemic";
    if (o.kind === "herewego") return "mercado";
    if (o.kind === "star") return "estrela";
    if (o.kind === "press") return "news";
    if (o.badge && /Clássico/i.test(o.badge)) return "classico";
    if (o.kind === "banter") { var mb = o.morale || 0; return mb > 0.2 ? "win" : "neutral"; }
    var m = o.morale || 0;
    return m > 0.3 ? "win" : m < -0.3 ? "loss" : "neutral";
  }
  // nº de comentários de acordo com a repercussão do post (posts "quentes" têm mais)
  function commentCountFor(o) {
    var big = o && (o.kind === "polemica" || o.kind === "herewego" || o.badge);
    var hot = o && Math.abs(o.morale || 0) >= 1;
    if (big) return rint(6, 11);
    if (hot) return rint(4, 8);
    return rint(3, 6);
  }
  // classifica o texto que O USUÁRIO postou p/ os comentários reagirem no tema
  function classifyUserPost(text) {
    var t = (text || "").toLowerCase();
    if (/desculp|erram|falha|pe[çc]o|humild|melhorar|reconhe|assumo/.test(t)) return "support";
    if (/roubo|arbitr|absurd|vergonha|injusti|ladr|\bvar\b|p[êe]nalti|expuls|impedi/.test(t)) return "agree";
    if (/t[íi]tulo|campe|ganhar|melhor|favorit|vencer|respeit|brigar|\btop\b|somos|pra cima|confia|foco/.test(t)) return "bold";
    if (/pol[êe]mic|treta|provoca|alfineta|cutuc/.test(t)) return "polemic";
    return null; // mistura empolgação/opinião
  }

  function ageLabel() { var r = Math.random(); return r < 0.25 ? "agora" : r < 0.6 ? rint(1, 59) + "min" : rint(1, 22) + "h"; }

  function post(o) {
    return {
      id: nid(), handle: o.handle, verified: !!o.verified, badge: o.badge || null, photo: o.photo || null,
      text: o.text, likes: o.likes != null ? o.likes : rint(20, 900), liked: false, reposts: rint(0, 300),
      comments: o.comments || makeComments(commentCountFor(o), moodOfPost(o)), kind: o.kind || "banter", age: ageLabel(),
      morale: o.morale || 0
    };
  }

  /* ---------- MORAL do time (0..100) influenciada pelas redes ---------- */
  function morale(career) { if (career.social && typeof career.social.morale === "number") return career.social.morale; return 60; }
  function nudgeMorale(career, d) {
    ensure(career);
    career.social.morale = Math.max(0, Math.min(100, Math.round((career.social.morale + d) * 10) / 10));
  }
  function moraleEdge(career) { var m = morale(career); return m >= 78 ? 1.5 : m >= 64 ? 0.7 : m <= 25 ? -1.5 : m <= 40 ? -0.7 : 0; }

  function ensure(career) {
    if (!career.social) career.social = { posts: [], lastGen: "", morale: 60 };
    if (typeof career.social.morale !== "number") career.social.morale = 60;
    if (!career.social.posts) career.social.posts = [];
  }

  /* ---------- geração de posts a partir do contexto ---------- */
  // clube "do usuário": treinador usa teamId, jogador (RÉ) usa clubId
  function mainClubId(career) { return career.teamId != null ? career.teamId : career.clubId; }

  function genBatch(career) {
    var W = TM.data.world();
    var cid = mainClubId(career);
    var myClub = TM.data.club(cid);
    if (!myClub) return [];
    var isPlayer = career.id === "me" || (career.teamId == null && career.clubId != null);
    var out = [];
    var form = (career.recentForm && career.recentForm.length) ? career.recentForm
      : (career.recentRatings || []).map(function (r) { return r >= 6.8 ? "V" : r >= 6 ? "E" : "D"; });
    var last = form.length ? form[form.length - 1] : null; // "V"/"E"/"D"
    var pos = null; try { pos = TM.comp.currentPosition(career); } catch (e) {}
    var rival = null; try { rival = TM.data.rivalName(cid); } catch (e) {}
    var squad = []; try { squad = TM.comp.userSquad(career) || []; } catch (e) {}
    var star = squad.length ? squad.slice().sort(function (a, b) { return b.overall - a.overall; })[0] : null;
    // no RÉ, a "estrela" é o próprio jogador
    if (!star && isPlayer) star = { name: career.name, overall: career.overall };

    // --- reação ao ÚLTIMO RESULTADO ---
    if (last === "D") { // DERROTA → críticas (e uma pitada de apoio)
      out.push(post({ handle: pick(FANS), kind: "critica", photo: chance(0.6) ? photoOf("torcida") : null, morale: -1.2,
        text: pick(["Que atuação VERGONHOSA do " + myClub.name + "... 😡 assim não dá!", "Perdemos de novo?? Esse time não joga NADA. Diretoria, acorda!", "Cadê a raça?? O " + myClub.name + " entrou em campo de salto alto. Inaceitável.", "Se depender desse elenco a gente cai. Que decepção. 📉"]),
        likes: rint(300, 5200) }));
      if (chance(0.7)) out.push(post({ handle: pick(FANS), kind: "critica", morale: -0.6, text: pick(["O técnico precisa mudar TUDO. Escalação errada de novo.", "Perdeu a mão. Não sabe o que fazer nos jogos decisivos.", star ? "Nem o " + star.name + " salvou. Que fase ruim..." : "Time sem alma. Precisa de reforço urgente."]), likes: rint(120, 2600) }));
      if (chance(0.45)) out.push(post({ handle: pick(FANS), kind: "apoio", morale: 0.6, text: pick(["Gente, é uma derrota só. VAMOS PRA CIMA no próximo! 💪", "Apoio sempre, na vitória e na derrota. Esse time é nosso! ❤️", "Cabeça erguida, " + myClub.name + ". A torcida tá junto!"]), likes: rint(60, 1400) }));
    } else if (last === "V") { // VITÓRIA → elogios / apoio
      out.push(post({ handle: pick(FANS), kind: "apoio", photo: chance(0.72) ? photoOf(chance(0.5) ? "jogo" : "torcida") : null, morale: 1.2,
        text: pick(["QUE JOGO! O " + myClub.name + " atropelou! 🔥🔥 esse time joga demais!", "Vitória suada e MERECIDA! Confia no processo, tá lindo de ver 🟢", star ? star.name + " deu SHOW hoje. Craque demais! 👏" : "Time ligado, entrega total. Respeitem o " + myClub.name + "!", "3 pontos e a torcida em festa! É ISSO! 🎉"]),
        likes: rint(400, 7000) }));
      if (chance(0.6)) out.push(post({ handle: pick(PRESS), verified: chance(0.6), kind: "press", photo: chance(0.45) ? photoOf("jogo") : null, text: pick([myClub.name + " embala e ganha moral na temporada. Técnico encontrou o time ideal.", "Boa vitória do " + myClub.name + "; o trabalho do treinador começa a dar frutos."]), likes: rint(200, 3200) }));
    } else if (last === "E") {
      out.push(post({ handle: pick(FANS), kind: "banter", photo: chance(0.35) ? photoOf("jogo") : null, morale: -0.2, text: pick(["Empate gosto de pouco... dava pra ganhar. 😐", "Mais um empate. Falta capricho na hora de finalizar.", "Ponto é ponto, mas a torcida quer VITÓRIA."]), likes: rint(80, 1800) }));
    }

    // --- post POLÊMICO (mexe na moral, às vezes forte) ---
    if (chance(0.5)) {
      var up = chance(0.5);
      out.push(post({ handle: pick(PRESS), verified: chance(0.5), kind: "polemica", badge: "⚡ Polêmica",
        photo: chance(0.55) ? photoOf(up ? "uniao" : "bola") : null, morale: up ? 2.2 : -2.4,
        text: up
          ? pick(["EXCLUSIVO: bastidores revelam elenco do " + myClub.name + " UNIDO e comprando a ideia do técnico. Clima ótimo no vestiário! 🔥", "Fontes internas: diretoria promete PREMIAÇÃO especial se o time seguir crescendo. Jogadores animados! 💰", "Torcida organizada marca FESTA na chegada do time. Elenco motivadíssimo pra próxima!"])
          : pick(["POLÊMICA: jogadores do " + myClub.name + " estariam INSATISFEITOS com o técnico nos bastidores. Clima pesado no vestiário. 👀", "Rumores de RACHA no elenco do " + myClub.name + ". Estrelas teriam batido boca no treino...", "Diretoria estuda mudanças e o nome do técnico estaria em xeque. Torcida se divide."]),
        likes: rint(500, 9000) }));
    }

    // --- post da DIRETORIA (oficial) de vez em quando ---
    if (chance(0.4)) {
      out.push(post({ handle: myClub.name + " 🏛️", verified: true, kind: "board", badge: "Oficial", photo: chance(0.5) ? photoOf("uniao") : null,
        text: pick(["Nota oficial: a diretoria reafirma total confiança no elenco e na comissão técnica. Juntos somos mais fortes! 💚", "Comunicado: seguimos trabalhando por reforços que elevem o nível do time. Contamos com a nossa torcida!", "A diretoria agradece o apoio incondicional da nossa nação. Vamos em busca dos nossos objetivos!", "Reunião definida com a comissão técnica para alinhar o planejamento da temporada."]),
        likes: rint(300, 4000), morale: 0.4 }));
    }

    // --- rumor HERE WE GO (mercado) ---
    if (chance(0.45)) {
      var stars = [];
      W.clubs.forEach(function (cl) { TM.data.clubPlayers(cl.id).forEach(function (p) { if (p.overall >= 80) stars.push(p); }); });
      if (stars.length >= 2) {
        var s = pick(stars), dest = pick(W.clubs);
        if (dest.id !== s.clubId) {
          var done = chance(0.5);
          out.push(post({ handle: HEREWEGO, verified: true, kind: "herewego", badge: "🗞️ Mercado", photo: chance(0.5) ? photoOf("bola") : null,
            text: done
              ? "🚨🔴⚪ HERE WE GO! " + s.name + " (" + s.overall + ") está ACERTADO com o " + dest.name + "! Contrato assinado, exames marcados. ✍️"
              : "🔵 " + dest.name + " abriu conversas por " + s.name + " (" + s.overall + "), hoje no " + ((TM.data.club(s.clubId) || {}).name || "clube") + ". Negócio avança nos bastidores...",
            likes: rint(800, 12000) }));
        }
      }
    }

    // --- SAF investe em clube pequeno / clube troca técnico (mundo) ---
    if (chance(0.3)) {
      var small = W.clubs.slice().sort(function (a, b) { return TM.data.clubRating(a.id) - TM.data.clubRating(b.id); })[rint(0, 40)];
      if (small) {
        var funds = ["Aurora Capital", "Vanguarda Sports", "Pantera Investimentos", "Meridian Group", "Atlas Holding"];
        out.push(post({ handle: pick(PRESS), verified: true, kind: "press", badge: "💼 SAF", photo: chance(0.4) ? photoOf("bola") : null,
          text: "🚨 " + pick(funds) + " assume a SAF do " + small.name + " e promete aporte de R$ " + rint(120, 900) + " milhões! Clube pequeno vai sonhar alto. 💰",
          likes: rint(300, 6000) }));
      }
    }
    if (chance(0.3)) {
      var c2 = pick(W.clubs);
      var techs = ["Renato Bianchi", "Héctor Salas", "Fábio Rebelo", "Diego Marques", "Paulo Vidal", "Andrés Coelho"];
      out.push(post({ handle: pick(PRESS), verified: chance(0.6), kind: "press", badge: "🔁 Bastidores",
        text: "OFICIAL: o " + c2.name + " demitiu o técnico e acertou com " + pick(techs) + ". Reformulação a caminho.",
        likes: rint(150, 3000) }));
    }

    // --- clássico / rival ---
    if (rival && chance(0.4)) {
      out.push(post({ handle: pick(FANS), kind: "banter", badge: "🔥 Clássico", morale: 0.3, photo: chance(0.4) ? photoOf("torcida") : null,
        text: pick(["Semana de CLÁSSICO contra o " + rival + "! Já tô sem dormir 😤🔥", "Perder pro " + rival + " NÃO é opção. NUNCA.", "90 minutos de guerra contra o " + rival + ". Bora, " + myClub.name + "! 💪"]),
        likes: rint(200, 4200) }));
    }

    // --- destaque de estrela ---
    if (star && chance(0.4)) {
      out.push(post({ handle: pick(PRESS), verified: chance(0.5), kind: "star", photo: chance(0.6) ? photoOf("jogo") : null,
        text: pick([star.name + " (" + star.overall + ") é simplesmente o melhor do elenco do " + myClub.name + ". Fenômeno.", "Olho no " + star.name + ": decisivo e já desperta interesse de clubes maiores 👀"]),
        likes: rint(200, 4500) }));
    }

    // --- notícias marcadas (news) viram posts ---
    (career.notifications || []).filter(function (n) { return n.news; }).slice(0, 2).forEach(function (n) {
      out.push(post({ handle: pick(PRESS), verified: true, kind: "press", text: "📰 " + (n.title ? n.title + ": " : "") + n.text, likes: rint(50, 2500) }));
    });

    // --- banter genérico ---
    if (out.length < 4 || chance(0.5)) out.push(post({ handle: pick(FANS), kind: "banter", text: pick(["Domingo tem jogo e eu já tô nervoso 😅⚽", "Alguém mais acha que o VAR vai roubar a gente de novo?", "Uniforme novo tá LINDO, vou comprar 👕", "Escala a molecada da base, confia nos garotos 🌱", "Esse campeonato tá imprevisível demais esse ano"]), likes: rint(10, 700) }));

    return out;
  }

  var FEED_V = 2; // versão do feed — sobe quando o formato de posts/comentários muda
  // gera novos posts quando há novidade (troca de matchNo/season), aplica moral
  function ensureFeed(career) {
    ensure(career);
    // migração: descarta posts antigos (contagem/comentários incoerentes) uma única vez
    if (career.social.v !== FEED_V) { career.social.posts = []; career.social.lastGen = ""; career.social.v = FEED_V; }
    var stamp = (career.matchNo || 0) + ":" + (career.season || 1);
    if (career.social.lastGen === stamp && career.social.posts.length) return;
    var fresh = genBatch(career);
    // aplica efeito de moral dos posts novos (uma vez)
    var mSum = 0; fresh.forEach(function (p) { mSum += (p.morale || 0); });
    if (mSum) nudgeMorale(career, mSum);
    // prepend, cap 60
    career.social.posts = fresh.concat(career.social.posts).slice(0, 60);
    career.social.lastGen = stamp;
  }

  /* ---------- postar como usuário (repercute na imprensa) ---------- */
  function userPost(career, text) {
    ensure(career);
    var isPlayer = career.id === "me" || (career.teamId == null && career.clubId != null);
    var who = career.coachName || (isPlayer ? career.name : null) || "voce";
    var clubNm = (TM.data.club(mainClubId(career)) || {}).name || "clube";
    var handle = "@" + (who.toLowerCase().replace(/[^a-zà-ÿ0-9]/g, "").slice(0, 14) || (isPlayer ? "jogador" : "treinador"));
    var p = post({ handle: handle, verified: true, kind: "user", text: text,
      likes: rint(40, 500), comments: makeComments(rint(3, 6), classifyUserPost(text)) });
    p.mine = true;
    // repercussão: às vezes a imprensa cita e vira manchete
    var repercuss = chance(0.55);
    career.social.posts = [p].concat(career.social.posts).slice(0, 60);
    if (repercuss) {
      var roleTxt = isPlayer ? career.name + ", do " + clubNm + "," : "técnico do " + clubNm;
      var pressReply = post({ handle: pick(PRESS), verified: true, kind: "press", badge: "🗞️ Repercussão",
        text: "Declaração de " + roleTxt + " viraliza: “" + (text.length > 90 ? text.slice(0, 88) + "…" : text) + "”. Torcida reage.",
        likes: rint(200, 3500) });
      career.social.posts = career.social.posts.slice(0, 1).concat([pressReply], career.social.posts.slice(1)).slice(0, 60);
      // vira notícia no jornal
      try { TM.notify.push(career, { icon: "🎙️", title: (isPlayer ? "Sua fala repercute" : "Fala do treinador repercute"), news: true, text: "“" + (text.length > 120 ? text.slice(0, 118) + "…" : text) + "” — declaração " + (isPlayer ? "de " + career.name : "do comando do " + clubNm) + " ganhou as redes e a imprensa." }); } catch (e) {}
    }
    if (isPlayer) TM.storage.savePlayerCareer(career); else TM.storage.saveCoachCareer(career);
    return repercuss;
  }

  /* ---------- UI ---------- */
  function moraleInfo(m) {
    return m >= 78 ? { cls: "ok", txt: "Moral elevada 🔥" } : m >= 60 ? { cls: "ok", txt: "Moral boa" } :
           m >= 42 ? { cls: "mid", txt: "Moral instável" } : m >= 25 ? { cls: "lo", txt: "Moral baixa" } : { cls: "crit", txt: "Moral em crise 🚨" };
  }

  function commentRow(cm, onLike) {
    var likeEl = el("span", { class: "pc-like" + (cm.liked ? " on" : ""), text: (cm.liked ? "❤️ " : "🤍 ") + fmtLikes(cm.likes) });
    likeEl.addEventListener("click", function () { cm.liked = !cm.liked; cm.likes += cm.liked ? 1 : -1; onLike(); });
    return el("div", { class: "pc-row" }, [
      el("img", { class: "pc-ava", src: userAvatar(cm.who) }),
      el("div", { class: "pc-body" }, [
        el("div", { class: "pc-top" }, [ el("span", { class: "pc-who", text: cm.who.replace("@", "") }), cm.verified ? el("span", { class: "post-verified", text: "✔" }) : null ]),
        el("div", { class: "pc-txt", text: cm.txt }),
        el("div", { class: "pc-meta" }, [ likeEl, el("span", { class: "pc-reply", text: "Responder" }) ])
      ])
    ]);
  }

  function openComments(career, p, save) {
    var overlay = el("div", { class: "modal-overlay", on: { click: function (e) { if (e.target === overlay) overlay.remove(); } } });
    var box = el("div", { class: "cmodal" });
    box.appendChild(el("div", { class: "cmodal-head" }, [ el("span", { text: "Comentários" }), el("button", { class: "cmodal-x", text: "✕", on: { click: function () { overlay.remove(); } } }) ]));
    var list = el("div", { class: "cmodal-list" });
    box.appendChild(list);
    function redraw() { TM.ui.clear(list); p.comments.forEach(function (cm) { list.appendChild(commentRow(cm, function () { save(); redraw(); })); }); }
    redraw();
    // caixa de comentar
    var input = el("input", { class: "text-input", type: "text", placeholder: "Escreva um comentário...", maxlength: "140" });
    var send = el("button", { class: "btn small", text: "Enviar", on: { click: function () {
      var t = input.value.trim(); if (!t) return;
      p.comments.unshift({ who: "@" + ((career.coachName || "voce").toLowerCase().replace(/[^a-zà-ÿ0-9]/g, "").slice(0, 14) || "voce"), txt: t, likes: 0, liked: false, mine: true });
      input.value = ""; save(); redraw();
    } } });
    box.appendChild(el("div", { class: "cmodal-compose" }, [ input, send ]));
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function postCard(career, p, save, refresh) {
    var likeBtn = el("span", { class: "pa pa-like" + (p.liked ? " on" : ""), text: (p.liked ? "❤️ " : "🤍 ") + fmtLikes(p.likes) });
    likeBtn.addEventListener("click", function () {
      p.liked = !p.liked; p.likes += p.liked ? 1 : -1;
      // curtir posts críticos/polêmicos afeta levemente a moral (você endossa)
      if (p.liked && p.morale) nudgeMorale(career, p.morale > 0 ? 0.4 : -0.4);
      save(); likeBtn.classList.toggle("on", p.liked); likeBtn.textContent = (p.liked ? "❤️ " : "🤍 ") + fmtLikes(p.likes);
    });
    var totalComments = p.comments.length;
    var cBtn = el("span", { class: "pa", text: "💬 " + totalComments });
    cBtn.addEventListener("click", function () { openComments(career, p, save); });

    var head = el("div", { class: "post-head" }, [
      el("img", { class: "post-ava", src: userAvatar(p.handle) }),
      el("div", { class: "post-id" }, [
        el("div", { class: "post-handle" }, [ el("span", { text: p.handle.replace(/🔴⚪|🏛️/g, "").trim() }), p.verified ? el("span", { class: "post-verified", text: "✔" }) : null ]),
        el("div", { class: "post-time", text: "há " + p.age })
      ]),
      p.badge ? el("span", { class: "post-badge" + (p.kind === "polemica" ? " hot" : ""), text: p.badge }) : null
    ]);
    var kids = [ head, el("div", { class: "post-text", text: p.text }) ];
    if (p.photo) {
      var img = el("img", { class: "post-photo", src: p.photo, alt: "" });
      img.addEventListener("error", function () { img.style.display = "none"; });
      kids.push(img);
    }
    kids.push(el("div", { class: "post-actions" }, [ likeBtn, cBtn, el("span", { class: "pa", text: "🔁 " + fmtLikes(p.reposts) }) ]));
    // prévia de comentários (2) + ver todos
    if (p.comments.length) {
      var cw = el("div", { class: "post-comments" });
      p.comments.slice(0, 2).forEach(function (cm) { cw.appendChild(commentRow(cm, save)); });
      if (totalComments > 2) cw.appendChild(el("button", { class: "see-all", text: "Ver todos os " + totalComments + " comentários", on: { click: function () { openComments(career, p, save); } } }));
      kids.push(cw);
    }
    return el("div", { class: "post" + (p.mine ? " mine" : "") }, kids);
  }

  function renderSocial(screen, mode) {
    var career = mode === "player" ? TM.storage.playerCareer() : TM.storage.coachCareer();
    var back = mode === "player" ? "player-hub" : "coach-hub";
    if (!career) { TM.ui.go(back); return; }
    ensureFeed(career);
    var saveCareer = mode === "player" ? function () { TM.storage.savePlayerCareer(career); } : function () { TM.storage.saveCoachCareer(career); };
    saveCareer();
    function save() { saveCareer(); }

    screen.appendChild(TM.ui.topbar("📱 Redes Sociais", function () { TM.ui.go(back); }));
    if (mode === "coach" && TM.coachUI) TM.coachUI.addBar(screen, "coach-social");
    var wrap = el("div", { class: "social-wrap" });
    screen.appendChild(wrap);

    wrap.appendChild(el("div", { class: "social-head" }, [ el("span", { class: "sh-logo", text: "⚽ BolaSocial" }), el("span", { class: "sh-sub", text: "o que estão falando agora" }) ]));

    // medidor de MORAL
    var m = morale(career), mi = moraleInfo(m);
    wrap.appendChild(el("div", { class: "morale-meter" }, [
      el("div", { class: "mm-row" }, [ el("span", { class: "mm-lbl", text: "😊 Moral do elenco (redes)" }), el("span", { class: "mm-val mm-" + mi.cls, text: Math.round(m) + "%" }) ]),
      el("div", { class: "mm-bar" }, [ el("div", { class: "mm-fill mm-" + mi.cls, style: "width:" + m + "%" }) ]),
      el("div", { class: "mm-msg mm-" + mi.cls, text: mi.txt + " · posts polêmicos e suas curtidas mexem aqui" })
    ]));

    // COMPOR post
    var composer = el("div", { class: "composer" });
    var ta = el("textarea", { class: "comp-ta", placeholder: "Diga algo à torcida e à imprensa...", maxlength: "180" });
    var postBtn = el("button", { class: "btn primary small", text: "Publicar", on: { click: function () {
      var t = ta.value.trim(); if (!t) { TM.ui.toast("Escreva algo primeiro"); return; }
      var rep = userPost(career, t); ta.value = "";
      TM.ui.toast(rep ? "📣 Seu post viralizou e virou notícia!" : "Post publicado");
      TM.ui.go(mode === "player" ? "player-social" : "coach-social");
    } } });
    composer.appendChild(el("div", { class: "comp-row" }, [ el("img", { class: "comp-ava", src: userAvatar((career.coachName || career.name || "T")) }), ta ]));
    composer.appendChild(el("div", { class: "comp-actions" }, [ el("span", { class: "comp-hint", text: "Sua fala pode repercutir na imprensa" }), postBtn ]));
    wrap.appendChild(composer);

    // FEED
    career.social.posts.forEach(function (p) { wrap.appendChild(postCard(career, p, save, function () { TM.ui.go(mode === "player" ? "player-social" : "coach-social"); })); });

    wrap.appendChild(el("button", { class: "btn ghost", style: "margin-top:8px", text: "🔄 Atualizar feed", on: { click: function () {
      // força uma leva nova mesmo sem trocar de jogo
      career.social.lastGen = ""; ensureFeed(career); save();
      TM.ui.go(mode === "player" ? "player-social" : "coach-social");
    } } }));
  }

  TM.social = { moraleEdge: moraleEdge, ensureFeed: ensureFeed, morale: morale, userPost: userPost, nudgeMorale: nudgeMorale };
  TM.ui.register("coach-social", function (screen) { renderSocial(screen, "coach"); });
  TM.ui.register("player-social", function (screen) { renderSocial(screen, "player"); });
})(window);
