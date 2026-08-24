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

  // slug do nome do clube (casa com os arquivos em assets/estadios/<slug>.jpg)
  function stadSlug(name) {
    return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  }
  // clubes que têm foto real de estádio disponível (evita 404 nos demais)
  var STADIUM_PHOTOS = {};
  ("1-fc-koln,1-fc-magdeburg,aa-ponte-preta,ac-monza,ac-reggiana-1919,ad-ceuta-fc,ad-confianca,ado-den-haag,afc-bournemouth,ajax,akhmat-grozny,akron-togliatti,al-ahli-sfc,al-faisaly-fc,al-fateh-sc,al-fayha-fc,al-hazem-sc,al-hilal-sfc,al-ittihad-club,al-nassr-fc,al-riyadh-sc,al-shabab-fc,al-taawoun-fc,alanyaspor,albacete-balompie,america-mineiro,angers,argentinos-juniors,arminia-bielefeld,arsenal,as-nancy-lorraine,as-saint-etienne,aston-villa,atalanta,athletic-club,athletico-paranaense,atlanta-united,atlas-guadalajara,atletico-de-madrid,atletico-de-san-luis,atletico-goianiense,atletico-mineiro,austin-fc,auxerre,avai-fc,az-alkmaar,bahia,baltika-kaliningrad,barcelona,barcelona-sc-guayaquil,basaksehir-fk,bayer-leverkusen,bayern-de-munique,benfica,besiktas-jk,birmingham-city,blackburn-rovers,boca-juniors,bologna,borussia-dortmund,borussia-m-gladbach,botafogo,botafogo-fc,braga,brentford,brighton-hove-albion,bristol-city,burgos-cf,ca-boston-river,ca-cerro,ca-juventud,ca-penarol,cadiz-cf,cagliari,calcio-padova,cambuur,cd-castellon,cd-cruz-azul,cd-leganes,cd-leonesa,cd-mirandes,cd-universidad-catolica,ceara-sc,celta-de-vigo,central-espanol-fc,cerro-largo-fc,cesena-fc,cf-america,cf-atlante,cf-monterrey,cf-pachuca,chapecoense,charlton-athletic,chelsea,cincinnati,club-deportivo-maldonado,club-leon,club-nacional,club-necaxa,club-tijuana,columbus-crew,como,cordoba-cf,corinthians,coritiba,coventry-city,crb,criciuma-ec,cruzeiro,crystal-palace,cs-emelec,cska-moscou,cuiaba-ec,defensa-y-justicia,defensor-sporting-club,delfino-pescara-1936,deportivo-alaves,deportivo-cuenca,deportivo-guadalajara,deportivo-la-coruna,deportivo-toluca,derby-county,dijon-fco,dinamo-moscou,ea-guingamp,ec-juventude,eintracht-braunschweig,eintracht-frankfurt,elche,erzurumspor-fk,espanyol,estoril,estrela-da-amadora,estudiantes,everton,excelsior,fc-andorra,fc-annecy,fc-augsburg,fc-catanzaro,fc-dallas,fc-empoli,fc-energie-cottbus,fc-metz,fc-middlesbrough,fc-nantes,fc-portsmouth,fc-sochaux-montbeliard,fc-southampton,fc-st-pauli,fc-sudtirol,fc-watford,fenerbahce,feyenoord,figueirense-futebol-clube,fiorentina,fk-krasnodar,fk-orenburg,fk-rostov,flamengo,fluminense,fortaleza-ec,fortuna-sittard,frosinone,frosinone-calcio,fulham,galatasaray,gaziantep-fk,genclerbirligi-ankara,genoa,getafe,gil-vicente,gimnasia-la-plata,go-ahead-eagles,godoy-cruz,goias-ec,granada-cf,gremio,gremio-novorizontino,grenoble-foot-38,hamburger-sv,hannover-96,heerenveen,hertha-bsc,holstein-kiel,hull-city,huracan,independiente,independiente-del-valle,inter-de-milao,inter-miami,internacional,ipswich-town,ipswich-town-fc,juventus,karlsruher-sc,kasimpasa,kocaelispor,konyaspor,krylya-sovetov-samara,lafc,lazio,ldu-quito,le-mans,lecce,leeds-united,leicester-city-fc,leones-fc,levante,libertad-fc,lille,liverpool,liverpool-fc-montevideo,lokomotiv-moscou,londrina-ec,los-angeles-galaxy,mainz-05,malaga-cf,manchester-city,manchester-united,mantova-1911,maranhao-ac,maringa-fc,maritimo,milan,millwall-fc,minnesota-united,mirassol,modena-fc,monaco,montevideo-city-torque,montevideo-wanderers,montpellier-hsc,monza,moreirense,mushuc-runa-sc,nacional,napoli,nashville-sc,nautico,nec-nijmegen,new-york-city-fc,new-york-red-bulls,newcastle-united,newell-s-old-boys,norwich-city,nottingham-forest,olympique-de-lyon,olympique-de-marseille,orlando-city,osasuna,oxford-united,palermo-fc,palmeiras,paris-fc,paris-saint-germain,parma,pau-fc,paysandu-sc,pec-zwolle,philadelphia-union,portland-timbers,porto,preston-north-end,psv,puebla-fc,queens-park-rangers,queretaro-fc,racing-club,racing-santander,rayo-vallecano,rb-leipzig,real-betis,real-madrid,real-salt-lake,real-sociedad,real-sporting-de-gijon,real-valladolid-cf,real-zaragoza,red-bull-bragantino,red-star-fc,rennes,river-plate,rodez-af,roma,rosario-central,rubin-kazan,samsunspor,san-diego-fc,santos,santos-laguna,sao-bernardo-fc,sao-paulo,sassuolo,sc-freiburg,sc-paderborn,schalke-04,sd-aucas,sd-eibar,sd-huesca,seattle-sounders,sevilla,sg-dynamo-dresden,sheffield-united,sheffield-wednesday,sparta-rotterdam,spartak-moscou,spezia-calcio,sport-recife,sporting-cp,sporting-kansas-city,spvgg-greuther-furth,ss-juve-stabia,ssc-bari,st-louis-city,stade-lavallois,stade-reims,stoke-city,strasbourg,sunderland,sv-darmstadt-98,sv-elversberg,swansea-city-afc,talleres,tecnico-universitario,telstar,tigres-uanl,torino,tottenham-hotspur,toulouse,trabzonspor,troyes,tsg-hoffenheim,twente,uc-sampdoria,ud-almeria,ud-las-palmas,udinese,unam-pumas,union-berlin,us-avellino-1912,us-boulogne,usl-dunkerque,vasco-da-gama,velez-sarsfield,venezia,venezia-fc,vfb-stuttgart,vfl-bochum,vfl-osnabruck,vfl-wolfsburg,vila-nova-fc,villarreal,vitoria,vitoria-de-guimaraes,werder-bremen,west-bromwich-albion,willem-ii,wrexham-afc,ypiranga-fc,zenit-sao-petersburgo,atletico-nacional,cd-america-de-cali,millonarios-bogota,deportivo-cali,independiente-medellin,independiente-santa-fe,deportes-tolima,atletico-bucaramanga,once-caldas,internacional-de-bogota,fortaleza-ceif,cucuta-deportivo,deportivo-pasto,llaneros-fc,alianza-fc,deportivo-pereira,jaguares-de-cordoba,boyaca-chico-fc").split(",").forEach(function (s) { STADIUM_PHOTOS[s] = 1; });

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
    // Versão fictícia: só imagens GERADAS (nada de fotos/escudos/logos reais).
    coachImg: function (coach, cls) {
      return imgWithFallback(coachAvatarSVG(coach), coachAvatarSVG(coach), coach.name, cls);
    },
    clubImg: function (club, cls) {
      // escudo importado pelo jogador (clube personalizado) tem prioridade
      if (club.crestData) return imgWithFallback(club.crestData, crest(club), club.name, cls);
      return imgWithFallback(crest(club), crest(club), club.name, cls);
    },
    playerImg: function (player, cls) {
      var club = TM.data.club(player.clubId);
      var av = avatar(player, club);
      return imgWithFallback(av, av, player.name, cls);
    },
    nationImg: function (nation, cls) {
      // bandeira gerada por cores (países são reais/legais, mas mantemos consistência visual)
      return imgWithFallback(flag(nation), flag(nation), nation.name, cls);
    },
    stadiumImg: function (club, cls) {
      var art = stadiumArt(club);
      return imgWithFallback(art, art, (club.name + " — estádio"), cls);
    },
    compBadge: compBadge,
    compImg: function (comp, cls) {
      if (typeof comp === "string") comp = TM.data.competition(comp);
      if (!comp) return imgWithFallback("", "", "", cls);
      var klass = (cls || "") + (comp.darkBg ? " comp-onblack" : "");
      return imgWithFallback(compBadge(comp), compBadge(comp), comp.name, klass);
    }
  };
})(window);
