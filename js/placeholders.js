/* ================= TOTAL MATCH — imagens placeholder ================= */
/* Gera escudos, "fotos" de jogadores e bandeiras de seleção por código (SVG).
   Se um dia existir uma imagem real em assets/ (convenção de nome), o jogo
   usa a imagem; senão, cai neste placeholder. Assim nada fica quebrado. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  function initials(name, max) {
    return name.split(/\s+/).filter(Boolean).slice(0, max || 2)
      .map(function (w) { return w[0].toUpperCase(); }).join("");
  }
  function svgURI(svg) {
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  // Escudo do clube: brasão simples com iniciais e cores do clube
  function crest(club) {
    var c = club.colors;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 90" width="80" height="90">' +
      '<path d="M40 2 L76 14 V46 C76 68 58 82 40 88 C22 82 4 68 4 46 V14 Z" fill="' + c.primary + '" stroke="#0a0a0a" stroke-width="2"/>' +
      '<path d="M40 2 L76 14 V30 H4 V14 Z" fill="' + c.secondary + '" opacity="0.85"/>' +
      '<circle cx="40" cy="52" r="18" fill="rgba(255,255,255,0.14)"/>' +
      '<text x="40" y="59" font-family="Arial" font-size="20" font-weight="800" fill="#fff" text-anchor="middle">' +
      initials(club.name, 2) + '</text></svg>';
    return svgURI(svg);
  }

  // "Foto" de jogador: avatar com iniciais e cor derivada da nação/posição
  function avatar(player, club) {
    var base = (club && club.colors.primary) || "#444";
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + base + '"/><stop offset="1" stop-color="#111"/></linearGradient></defs>' +
      '<rect width="80" height="80" rx="10" fill="url(#g)"/>' +
      '<circle cx="40" cy="30" r="15" fill="rgba(255,255,255,0.85)"/>' +
      '<path d="M15 76 C15 56 65 56 65 76 Z" fill="rgba(255,255,255,0.85)"/>' +
      '<text x="40" y="35" font-family="Arial" font-size="15" font-weight="800" fill="' + base + '" text-anchor="middle">' +
      initials(player.name, 2) + '</text></svg>';
    return svgURI(svg);
  }

  // Bandeira placeholder da seleção (duas cores + sigla)
  function flag(nation) {
    var c = nation.colors;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="60" height="40">' +
      '<rect width="60" height="40" fill="' + c.primary + '"/>' +
      '<rect width="60" height="14" fill="' + c.secondary + '"/>' +
      '<rect y="26" width="60" height="14" fill="' + c.secondary + '"/>' +
      '<text x="30" y="25" font-family="Arial" font-size="11" font-weight="800" fill="#fff" stroke="#000" stroke-width="0.4" text-anchor="middle">' +
      nation.name.slice(0, 3).toUpperCase() + '</text></svg>';
    return svgURI(svg);
  }

  // Emblema placeholder de competição: medalhão com iniciais + cor da competição
  function compBadge(comp) {
    var c = comp.colors, ico = ({ liga: "", copa: "🏆", continental: "★", selecao: "🌍" })[comp.type] || "";
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">' +
      '<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + c.primary + '"/><stop offset="1" stop-color="#0c0c0c"/></linearGradient></defs>' +
      '<circle cx="40" cy="40" r="37" fill="url(#cg)" stroke="' + c.secondary + '" stroke-width="3"/>' +
      '<circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>' +
      '<text x="40" y="47" font-family="Arial" font-size="22" font-weight="800" fill="#fff" text-anchor="middle">' +
      initials(comp.name, 2) + '</text>' +
      (ico ? '<text x="40" y="20" font-size="11" text-anchor="middle">' + ico + '</text>' : '') +
      '</svg>';
    return svgURI(svg);
  }

  // Tenta uma imagem real em assets/ (por convenção); se falhar, usa fallback.
  // Uso: <img src="fallback" data-try="assets/clubes/xxx.png" onerror=...>
  function imgWithFallback(realPath, fallbackURI, alt, cls) {
    var img = document.createElement("img");
    img.className = cls || "";
    img.alt = alt || "";
    img.src = realPath;
    img.addEventListener("error", function handler() {
      img.removeEventListener("error", handler);
      img.src = fallbackURI;
    });
    return img;
  }

  // imagem embutida (data URI) quando o jogo roda como arquivo único (artifact),
  // onde não há pasta assets/. Se ausente, cai no caminho de arquivo normal.
  function embedded(kind, id) {
    var E = global.TM_EMBED;
    return (E && E[kind] && E[kind][id]) || null;
  }

  // ilustração do estádio (SVG gerado, tintado com as cores do clube) — funciona offline
  function stadiumArt(club) {
    var col = (club && club.colors) || { primary: "#2f8f4e", secondary: "#eeeeee" };
    var p = col.primary, s = col.secondary;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220" width="400" height="220">' +
      '<defs>' +
      '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1c2b"/><stop offset="1" stop-color="#173651"/></linearGradient>' +
      '<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff8d0" stop-opacity="0.85"/><stop offset="1" stop-color="#fff8d0" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#33a457"/><stop offset="1" stop-color="#1f7a3c"/></linearGradient>' +
      '<clipPath id="pc"><ellipse cx="200" cy="152" rx="128" ry="44"/></clipPath>' +
      '</defs>' +
      '<rect width="400" height="220" fill="url(#sky)"/>' +
      '<circle cx="44" cy="28" r="36" fill="url(#glow)"/><circle cx="356" cy="28" r="36" fill="url(#glow)"/>' +
      '<ellipse cx="200" cy="150" rx="188" ry="74" fill="' + p + '"/>' +
      '<ellipse cx="200" cy="150" rx="188" ry="74" fill="#000" opacity="0.18"/>' +
      '<ellipse cx="200" cy="140" rx="188" ry="70" fill="none" stroke="' + s + '" stroke-width="4" opacity="0.45"/>' +
      '<ellipse cx="200" cy="151" rx="152" ry="57" fill="#0c0c0c" opacity="0.55"/>' +
      '<ellipse cx="200" cy="152" rx="128" ry="44" fill="url(#pitch)"/>' +
      '<g clip-path="url(#pc)">' +
      '<g opacity="0.12"><rect x="150" y="104" width="20" height="96" fill="#000"/><rect x="190" y="104" width="20" height="96" fill="#000"/><rect x="230" y="104" width="20" height="96" fill="#000"/></g>' +
      '<line x1="200" y1="106" x2="200" y2="198" stroke="#fff" stroke-width="1.5" opacity="0.5"/>' +
      '<ellipse cx="200" cy="152" rx="18" ry="9" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.5"/>' +
      '</g>' +
      '<g stroke="#0a0a0a" stroke-width="3"><line x1="44" y1="30" x2="44" y2="118"/><line x1="356" y1="30" x2="356" y2="118"/></g>' +
      '<rect x="30" y="20" width="28" height="14" rx="3" fill="#fdf6c9"/><rect x="342" y="20" width="28" height="14" rx="3" fill="#fdf6c9"/>' +
      '</svg>';
    return svgURI(svg);
  }

  // avatar placeholder do treinador: círculo colorido (cor derivada do nome) + iniciais
  function coachAvatarSVG(coach) {
    var h = 0; for (var i = 0; i < coach.name.length; i++) h = (h * 31 + coach.name.charCodeAt(i)) % 360;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">' +
      '<rect width="80" height="80" rx="40" fill="hsl(' + h + ',42%,32%)"/>' +
      '<text x="40" y="50" font-family="Arial" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">' +
      initials(coach.name, 2) + '</text></svg>';
    return svgURI(svg);
  }

  TM.img = {
    crest: crest,
    avatar: avatar,
    flag: flag,
    initials: initials,
    coachAvatarSVG: coachAvatarSVG,
    // <img> do treinador: foto real (assets/treinadores/<chave>.png) se existir, senão avatar de iniciais
    coachImg: function (coach, cls) {
      var key = coach.photoKey, E = global.TM_EMBED, emb = embedded("treinadores", key);
      var fb = coachAvatarSVG(coach);
      // no artefato embutido, só usa foto se ela estiver embutida (evita 404); fora dele, tenta o arquivo
      var real = emb || ((E && E.treinadores) ? null : ("assets/treinadores/" + key + ".png"));
      return imgWithFallback(real || fb, fb, coach.name, cls);
    },
    // devolve <img> para clube, jogador ou seleção, já com tentativa de imagem real
    clubImg: function (club, cls) {
      return imgWithFallback(embedded("clubes", club.id) || ("assets/clubes/" + club.id + ".png"), crest(club), club.name, cls);
    },
    playerImg: function (player, cls) {
      var key = player.ph || player.id, E = global.TM_EMBED;
      var club = TM.data.club(player.clubId);
      var fb = avatar(player, club);
      var real = embedded("jogadores", key) || ((E && E.jogadores) ? null : ("assets/jogadores/" + key + ".jpg"));
      return imgWithFallback(real || fb, fb, player.name, cls);
    },
    nationImg: function (nation, cls) {
      return imgWithFallback(embedded("selecoes", nation.id) || ("assets/selecoes/" + nation.id + ".png"), flag(nation), nation.name, cls);
    },
    // "foto" do estádio: foto real (assets/estadios/<id>.jpg) se existir, senão ilustração gerada
    stadiumImg: function (club, cls) {
      var art = stadiumArt(club);
      var real = embedded("estadios", club.id) || ((global.TM_EMBED && global.TM_EMBED.estadios) ? null : ("assets/estadios/" + club.id + ".jpg"));
      return imgWithFallback(real || art, art, (club.name + " — estádio"), cls);
    },
    compBadge: compBadge,
    // comp pode ser o id (string) ou o objeto de competição
    compImg: function (comp, cls) {
      if (typeof comp === "string") comp = TM.data.competition(comp);
      if (!comp) return imgWithFallback("", "", "", cls);
      var klass = (cls || "") + (comp.darkBg ? " comp-onblack" : "");
      return imgWithFallback(embedded("competicoes", comp.id) || ("assets/competicoes/" + comp.id + ".png"), compBadge(comp), comp.name, klass);
    }
  };
})(window);
