/* ================= TOTAL MATCH — Redes Sociais (feed) ================= */
/* Feed estilo rede social: torcedores e jornalistas comentam a partida e o
   clube, e de vez em quando saem rumores de transferência ("HERE WE GO"). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function fmtLikes(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n); }

  // avatar de usuário (círculo colorido + inicial)
  function userAvatar(handle) {
    var h = 0; for (var i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) % 360;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">' +
      '<rect width="48" height="48" rx="24" fill="hsl(' + h + ',55%,42%)"/>' +
      '<text x="24" y="31" font-family="Arial" font-size="20" font-weight="800" fill="#fff" text-anchor="middle">' +
      handle.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() + '</text></svg>';
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  var FANS = ["@torcida_raiz", "@bola_de_cristal", "@ultras_norte", "@fanatico12", "@setor_azul", "@nacao_verde", "@rei_do_camarote", "@arquibancada_", "@voz_da_torcida", "@mister_gol"];
  var PRESS = ["@GloboEsporte_", "@ge_mercado", "@bola_na_area", "@radar_esportivo", "@central_do_futebol"];
  var HEREWEGO = "@FabricioBall 🔴⚪";

  function comments() {
    var pool = ["kkkkk é isso aí", "concordo demais", "não é bem assim não", "tá sonhando 😂", "esse aí é fenômeno", "prende ele!", "vai dar ruim", "sou obrigado a concordar", "melhor do time disparado", "chora time pequeno", "aiaiai meu coração", "confia demais nesse elenco", "táticamente perfeito", "vendido!!", "poupa esse cara pelo amor"];
    var n = rint(0, 2), out = [];
    for (var i = 0; i < n; i++) out.push({ who: pick(FANS), txt: pick(pool) });
    return out;
  }

  function feed(career) {
    var W = TM.data.world();
    var myClub = TM.data.club(career.teamId);
    var posts = [];
    // --- rumor "HERE WE GO" ---
    (function () {
      var clubs = W.clubs;
      var stars = [];
      clubs.forEach(function (cl) { TM.data.clubPlayers(cl.id).forEach(function (p) { if (p.overall >= 80) stars.push(p); }); });
      if (stars.length >= 2) {
        var s = pick(stars), dest = pick(clubs);
        if (dest.id !== s.clubId) {
          var done = Math.random() < 0.5;
          posts.push({
            handle: HEREWEGO, verified: true, time: rint(1, 40) + "min",
            text: done
              ? "🚨🔴⚪ HERE WE GO! " + s.name + " (" + s.overall + ") está ACERTADO com o " + dest.name + "! Contrato assinado, exames marcados. Vem aí! ✍️"
              : "🔵 Novidade: " + dest.name + " abriu conversas por " + s.name + " (" + s.overall + "), hoje no " + (TM.data.club(s.clubId) || {}).name + ". Negócio avança nos bastidores. Mais em breve...",
            likes: rint(800, 9000), comments: comments(), badge: "🗞️ Mercado"
          });
        }
      }
    })();
    // --- reação ao clube / posição ---
    (function () {
      var pos = null; try { pos = TM.comp.currentPosition(career); } catch (e) {}
      var good = pos && pos <= 4, bad = pos && pos >= 14;
      var t = good ? pick(["Que fase do " + myClub.name + "! Esse time joga MUITO 🔥", myClub.name + " na parte de cima da tabela, respeitem! 🟢", "Confia no processo, esse elenco é raça pura!"])
        : bad ? pick(["Que vergonha esse " + myClub.name + "... diretoria acorda! 😡", "Se continuar assim é rebaixamento na certa 📉", "Cadê o técnico?? Precisa mudar tudo"])
        : pick(["O " + myClub.name + " tá crescendo aos poucos, dá pra sonhar", "Time irregular mas com potencial, bora!", "Jogo a jogo, sem ansiedade 🙏"]);
      posts.push({ handle: pick(FANS), time: rint(1, 3) + "h", text: t, likes: rint(30, 1200), comments: comments() });
    })();
    // --- clássico / rival ---
    var rival = null; try { rival = TM.data.rivalName(career.teamId); } catch (e) {}
    if (rival && Math.random() < 0.6) {
      posts.push({ handle: pick(FANS), time: rint(1, 6) + "h",
        text: pick(["Semana de CLÁSSICO contra o " + rival + "! Já tô sem dormir 😤🔥", "Perder pro " + rival + " não é opção. NUNCA.", "Rivalidade é isso: 90 minutos de guerra contra o " + rival + " 💪"]),
        likes: rint(100, 3000), comments: comments(), badge: "🔥 Clássico" });
    }
    // --- destaque de jogador do elenco ---
    (function () {
      var squad = []; try { squad = TM.comp.userSquad(career) || []; } catch (e) {}
      if (squad.length) {
        var star = squad.slice().sort(function (a, b) { return b.overall - a.overall; })[0];
        posts.push({ handle: pick(PRESS), verified: Math.random() < 0.5, time: rint(1, 5) + "h",
          text: pick([star.name + " é simplesmente o melhor do elenco do " + myClub.name + " (" + star.overall + " de overall). Fenômeno.", "Olho no " + star.name + ": vem sendo decisivo e já desperta interesse de clubes maiores 👀"]),
          likes: rint(200, 4000), comments: comments() });
      }
    })();
    // --- notícias do clube (avisos marcados como news) viram posts ---
    (career.notifications || []).filter(function (n) { return n.news; }).slice(0, 2).forEach(function (n) {
      posts.push({ handle: pick(PRESS), verified: true, time: rint(1, 8) + "h", text: "📰 " + (n.title ? n.title + ": " : "") + n.text, likes: rint(50, 2500), comments: comments() });
    });
    // --- banter genérico ---
    posts.push({ handle: pick(FANS), time: rint(1, 12) + "h", text: pick(["Domingo tem jogo e eu já tô nervoso 😅⚽", "Alguém mais acha que o VAR vai roubar a gente de novo?", "Uniforme novo tá lindo, vou comprar 👕", "Escala o time da base, diretoria! Confia na molecada 🌱"]), likes: rint(10, 600), comments: comments() });
    // embaralha um pouco, mantendo o HERE WE GO no topo às vezes
    if (Math.random() < 0.5) posts.sort(function () { return Math.random() - 0.5; });
    return posts;
  }

  function renderSocial(screen, mode) {
    var career = mode === "player" ? TM.storage.playerCareer() : TM.storage.coachCareer();
    var back = mode === "player" ? "player-hub" : "coach-hub";
    if (!career) { TM.ui.go(back); return; }
    screen.appendChild(TM.ui.topbar("📱 Redes Sociais", function () { TM.ui.go(back); }));
    var wrap = el("div", { class: "social-wrap" });
    screen.appendChild(wrap);
    wrap.appendChild(el("div", { class: "social-head" }, [ el("span", { class: "sh-logo", text: "⚽ BolaSocial" }), el("span", { class: "sh-sub", text: "o que estão falando agora" }) ]));
    var posts = feed(career);
    posts.forEach(function (p) {
      var card = el("div", { class: "post" }, [
        el("div", { class: "post-head" }, [
          el("img", { class: "post-ava", src: userAvatar(p.handle) }),
          el("div", { class: "post-id" }, [
            el("div", { class: "post-handle" }, [ el("span", { text: p.handle.replace(/🔴⚪/g, "").trim() }), p.verified ? el("span", { class: "post-verified", text: "✔" }) : null ]),
            el("div", { class: "post-time", text: p.time + " atrás" })
          ]),
          p.badge ? el("span", { class: "post-badge", text: p.badge }) : null
        ]),
        el("div", { class: "post-text", text: p.text }),
        el("div", { class: "post-actions" }, [
          el("span", { class: "pa", text: "❤️ " + fmtLikes(p.likes) }),
          el("span", { class: "pa", text: "💬 " + (p.comments.length + rint(0, 40)) }),
          el("span", { class: "pa", text: "🔁 " + rint(0, 300) })
        ])
      ]);
      if (p.comments.length) {
        var cw = el("div", { class: "post-comments" });
        p.comments.forEach(function (cm) { cw.appendChild(el("div", { class: "pc-row" }, [ el("span", { class: "pc-who", text: cm.who }), el("span", { class: "pc-txt", text: cm.txt }) ])); });
        card.appendChild(cw);
      }
      wrap.appendChild(card);
    });
    wrap.appendChild(el("button", { class: "btn ghost", style: "margin-top:8px", text: "🔄 Atualizar feed", on: { click: function () { TM.ui.go(mode === "player" ? "player-social" : "coach-social"); } } }));
  }

  TM.ui.register("coach-social", function (screen) { renderSocial(screen, "coach"); });
  TM.ui.register("player-social", function (screen) { renderSocial(screen, "player"); });
})(window);
