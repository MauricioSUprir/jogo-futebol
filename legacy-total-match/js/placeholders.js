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
  // escudo gerado com ESTILO próprio por clube (listras, faixa, metades, roundel),
  // estrelas e tipografia — genérico, mas com cara de clube de verdade.
  function crestHash(s) { s = String(s || ""); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // gradiente vertical de brilho para dar volume (claro em cima -> escuro embaixo)
  function shadeDefs(id) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fff" stop-opacity=".22"/>' +
      '<stop offset=".5" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>';
  }
  // ESCUDO — brasão profissional: moldura dourada, campo com padrão do clube,
  // faixa superior (chief) com estrelas, medalhão central e brilho.
  function crest(club) {
    var c = club.colors, p = c.primary, s = c.secondary;
    var h = crestHash(club.id || club.name);
    var style = h % 7;                 // 0 listras 1 sash 2 metades 3 hoops 4 quartos 5 chevron 6 roundel
    var stars = ((h >>> 3) % 6 === 0) ? 3 : ((h >>> 4) % 3 === 0) ? 2 : ((h >>> 6) % 2 === 0) ? 1 : 0;
    var chief = ((h >>> 8) % 2 === 0); // faixa superior?
    var gold = "#e8c65a", goldDk = "#b8912f";
    var ini = initials(club.name, 2);
    var W = 80, HH = 92;
    var shieldPath = "M40 3 L74 14 V44 C74 66 58 81 40 89 C22 81 6 66 6 44 V14 Z";
    var defs = '<clipPath id="sc"><path d="' + shieldPath + '"/></clipPath>' +
      '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e39a"/><stop offset=".5" stop-color="' + gold + '"/><stop offset="1" stop-color="' + goldDk + '"/></linearGradient>' +
      shadeDefs("gl") +
      '<radialGradient id="rg" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>';

    // ---- ROUNDEL (estilo circular, comum na América do Sul) ----
    if (style === 6) {
      var svgR =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 92" width="80" height="92"><defs>' + shadeDefs("gl") +
        '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e39a"/><stop offset="1" stop-color="' + goldDk + '"/></linearGradient></defs>' +
        '<circle cx="40" cy="46" r="38" fill="url(#rim)"/>' +
        '<circle cx="40" cy="46" r="34" fill="' + s + '" stroke="#0a0a0a" stroke-width="1"/>' +
        '<circle cx="40" cy="46" r="27" fill="' + p + '"/>' +
        // gomos/raios sutis
        '<circle cx="40" cy="46" r="27" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>' +
        '<circle cx="40" cy="46" r="16" fill="rgba(255,255,255,.94)" stroke="' + s + '" stroke-width="2"/>' +
        '<text x="40" y="52" font-family="Georgia, serif" font-size="17" font-weight="800" fill="' + p + '" text-anchor="middle">' + ini + '</text>' +
        starRow(stars, 40, 24) +
        '<circle cx="40" cy="46" r="34" fill="url(#gl)"/>' +
        '</svg>';
      return svgURI(svgR);
    }

    // ---- campo interno conforme o estilo ----
    var inner = '<rect width="80" height="92" fill="' + p + '"/>';
    if (style === 0) {                 // LISTRAS verticais
      for (var i = 0; i < 5; i++) inner += '<rect x="' + (10 + i * 12) + '" y="0" width="6" height="92" fill="' + s + '"/>';
    } else if (style === 1) {          // FAIXA diagonal
      inner += '<polygon points="0,58 0,86 26,90 80,30 80,4 52,2" fill="' + s + '"/>';
    } else if (style === 2) {          // METADES
      inner = '<rect width="40" height="92" fill="' + p + '"/><rect x="40" width="40" height="92" fill="' + s + '"/>';
    } else if (style === 3) {          // HOOPS (faixas horizontais)
      for (var j = 0; j < 5; j++) inner += '<rect x="0" y="' + (8 + j * 16) + '" width="80" height="8" fill="' + s + '"/>';
    } else if (style === 4) {          // QUARTOS
      inner = '<rect width="40" height="46" fill="' + p + '"/><rect x="40" width="40" height="46" fill="' + s + '"/>' +
              '<rect y="46" width="40" height="46" fill="' + s + '"/><rect x="40" y="46" width="40" height="46" fill="' + p + '"/>';
    } else {                           // CHEVRON
      inner += '<polygon points="0,30 40,58 80,30 80,50 40,78 0,50" fill="' + s + '"/>';
    }
    // faixa superior (chief) com estrelas
    var chiefG = "";
    if (chief) {
      chiefG = '<rect x="0" y="10" width="80" height="18" fill="' + s + '"/>' +
               '<rect x="0" y="26" width="80" height="2" fill="rgba(0,0,0,.25)"/>';
    }

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 92" width="80" height="92"><defs>' + defs + '</defs>' +
      // moldura dourada
      '<path d="' + shieldPath + '" fill="url(#rim)"/>' +
      '<g clip-path="url(#sc)"><g transform="translate(40 46) scale(.9) translate(-40 -46)">' +
        inner + chiefG +
      '</g>' +
      '<rect width="80" height="92" fill="url(#gl)"/>' +
      '<rect width="80" height="92" fill="url(#rg)"/>' +
      '</g>' +
      // contorno interno + externo
      '<path d="' + shieldPath + '" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.4"/>' +
      // estrelas (na chief se houver, senão no topo do campo)
      starRow(stars, 40, chief ? 19 : 22) +
      // medalhão central com iniciais
      '<circle cx="40" cy="54" r="15" fill="rgba(255,255,255,.95)" stroke="' + goldDk + '" stroke-width="1.6"/>' +
      '<circle cx="40" cy="54" r="15" fill="url(#gl)"/>' +
      '<text x="40" y="60" font-family="Georgia, serif" font-size="16" font-weight="800" fill="' + p + '" text-anchor="middle">' + ini + '</text>' +
      '</svg>';
    return svgURI(svg);
  }
  function starRow(n, cx, cy) {
    if (!n) return "";
    var out = "", gap = 8.5, x0 = cx - (n - 1) * gap / 2;
    for (var i = 0; i < n; i++) out += star(x0 + i * gap, cy, 3.2);
    return out;
  }
  function star(cx, cy, r) {
    var pts = "";
    for (var i = 0; i < 10; i++) { var ang = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; pts += (cx + rr * Math.cos(ang)).toFixed(1) + "," + (cy + rr * Math.sin(ang)).toFixed(1) + " "; }
    return '<polygon points="' + pts + '" fill="#ffd54a" stroke="#00000055" stroke-width="0.5"/>';
  }

  // FOTO fictícia do jogador (rostos gerados por IA — pessoas que não existem).
  // Mapeia cada jogador a um rosto do acervo de forma determinística.
  var FACE_COUNT = 120;
  function pad3(n) { return n < 10 ? "00" + n : n < 100 ? "0" + n : "" + n; }
  function facePhoto(player) {
    var idx = crestHash(player.id || player.name) % FACE_COUNT;
    return "assets/faces/f-" + pad3(idx) + ".jpg";
  }

  // "Foto" de jogador: avatar com iniciais e cor derivada da nação/posição (fallback)
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

  // UNIFORME (camisa) — silhueta com mangas, gola, punhos, sombreado e mini-escudo
  function kit(club, away) {
    var c = club.colors, p = away ? c.secondary : c.primary, s = away ? c.primary : c.secondary;
    var h = crestHash((club.id || club.name) + (away ? "away" : "home")), style = h % 6;
    var vneck = ((h >>> 4) % 2 === 0);
    // corpo (torso) e mangas separados para punhos/detalhes
    var shirt = "M16 22 L29 10 C35 5 45 5 51 10 L64 22 L73 32 L62 43 L56 37 L56 71 C46 75 34 75 24 71 L24 37 L18 43 L7 32 Z";
    var body = "M24 37 L24 71 C34 75 46 75 56 71 L56 37 L51 10 C45 5 35 5 29 10 Z";
    var pat = '<rect width="80" height="80" fill="' + p + '"/>';
    if (style === 1) {                 // listras verticais
      for (var i = 0; i < 6; i++) pat += '<rect x="' + (12 + i * 9.5) + '" y="0" width="4.6" height="80" fill="' + s + '"/>';
    } else if (style === 2) {          // metades
      pat = '<rect width="40" height="80" fill="' + p + '"/><rect x="40" width="40" height="80" fill="' + s + '"/>';
    } else if (style === 3) {          // faixa diagonal (banda no peito)
      pat += '<polygon points="10,60 10,74 74,20 74,6" fill="' + s + '"/>';
    } else if (style === 4) {          // hoops (faixas horizontais)
      for (var j = 0; j < 5; j++) pat += '<rect x="0" y="' + (12 + j * 13) + '" width="80" height="6.5" fill="' + s + '"/>';
    } else if (style === 5) {          // faixa central + laterais (placket)
      pat += '<rect x="36" y="0" width="8" height="80" fill="' + s + '"/>';
    }
    var collar = vneck
      ? '<path d="M31 11 L40 22 L49 11 L46 9 L40 17 L34 9 Z" fill="' + s + '"/>'
      : '<path d="M29 10 C35 5 45 5 51 10 L47 16 C43 12.5 37 12.5 33 16 Z" fill="' + s + '"/>';
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><defs>' +
      '<clipPath id="kc"><path d="' + shirt + '"/></clipPath>' +
      '<clipPath id="kb"><path d="' + body + '"/></clipPath>' +
      '<linearGradient id="ksh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>' +
      '<radialGradient id="kr" cx="42%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
      // mangas na cor secundária (sob o corpo)
      '<g clip-path="url(#kc)"><rect width="80" height="80" fill="' + s + '"/></g>' +
      // corpo com o padrão
      '<g clip-path="url(#kb)">' + pat + '<rect width="80" height="80" fill="url(#ksh)"/><rect width="80" height="80" fill="url(#kr)"/></g>' +
      // punhos das mangas
      '<path d="M73 32 L67.5 37.5 L57 33 L62 27 Z" fill="' + p + '" opacity=".9"/>' +
      '<path d="M7 32 L12.5 37.5 L23 33 L18 27 Z" fill="' + p + '" opacity=".9"/>' +
      // gola
      collar +
      // mini-escudo no peito
      '<circle cx="50" cy="30" r="4.4" fill="rgba(255,255,255,.92)" stroke="' + s + '" stroke-width="1"/>' +
      '<text x="50" y="32.6" font-family="Georgia, serif" font-size="5" font-weight="800" fill="' + p + '" text-anchor="middle">' + initials(club.name, 1) + '</text>' +
      // contorno
      '<path d="' + shirt + '" fill="none" stroke="#0a0a0a" stroke-width="2.2" stroke-linejoin="round"/>' +
      '</svg>';
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
  // cores geradas de forma estável a partir de um texto (fallback p/ comps sem cor)
  function genCompColors(key) {
    key = String(key || "comp"); var h = 0;
    for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
    return { primary: "hsl(" + h + ",62%,34%)", secondary: "hsl(" + ((h + 45) % 360) + ",70%,60%)" };
  }
  function compBadge(comp) {
    var c = (comp && comp.colors) || genCompColors(comp && (comp.id || comp.name)),
        ico = ({ liga: "", copa: "🏆", continental: "★", mundial: "🌐", selecao: "🌍" })[comp && comp.type] || "🏆";
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

  // fotos genéricas de estádio (livres p/ uso comercial — Pexels). Distribuídas
  // por clube de forma determinística; SVG serve de fallback se a foto não carregar.
  var STADIUM_POOL = ["10287243", "10463656", "1171084", "17071576", "17779076", "270085", "30651230", "399187", "6295431", "9735500"];
  function stadiumPhoto(club) {
    var key = (club && (club.id || club.name)) || "x";
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return "assets/estadios/st-" + STADIUM_POOL[h % STADIUM_POOL.length] + ".jpg";
  }

  // ilustração do estádio (SVG gerado, tintado com as cores do clube) — fallback offline
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
      if (coach.photo) return imgWithFallback(coach.photo, coachAvatarSVG(coach), coach.name, cls);
      return imgWithFallback(coachAvatarSVG(coach), coachAvatarSVG(coach), coach.name, cls);
    },
    clubImg: function (club, cls) {
      // escudo importado pelo jogador (clube personalizado) tem prioridade
      if (club.crestData) return imgWithFallback(club.crestData, crest(club), club.name, cls);
      return imgWithFallback(crest(club), crest(club), club.name, cls);
    },
    kit: kit,
    kitImg: function (club, cls, away) {
      // uniforme importado pelo jogador tem prioridade (kitData / kitAwayData)
      var custom = away ? club.kitAwayData : club.kitData;
      if (custom) return imgWithFallback(custom, kit(club, away), club.name + " — uniforme", cls);
      return imgWithFallback(kit(club, away), kit(club, away), club.name + " — uniforme", cls);
    },
    playerImg: function (player, cls) {
      var club = TM.data.club(player.clubId);
      // foto importada pelo jogador (carreira própria) tem prioridade; senão avatar gerado (SVG)
      if (player.photo) return imgWithFallback(player.photo, avatar(player, club), player.name, cls);
      var av = avatar(player, club);
      return imgWithFallback(av, av, player.name, cls);
    },
    facePhoto: facePhoto,
    nationImg: function (nation, cls) {
      // bandeira gerada por cores (países são reais/legais, mas mantemos consistência visual)
      return imgWithFallback(flag(nation), flag(nation), nation.name, cls);
    },
    stadiumImg: function (club, cls) {
      // foto real (genérica) com fallback pro SVG gerado
      return imgWithFallback(stadiumPhoto(club), stadiumArt(club), (club.name + " — estádio"), cls);
    },
    compBadge: compBadge,
    compImg: function (comp, cls) {
      var raw = comp;
      if (typeof comp === "string") comp = TM.data.competition(comp);
      // comp desconhecido/sem dados: gera um badge mesmo assim (nunca fica sem foto)
      if (!comp) comp = { id: (typeof raw === "string" ? raw : "comp"), name: (typeof raw === "string" ? raw : "Competição"), type: "copa" };
      var klass = (cls || "") + (comp.darkBg ? " comp-onblack" : "");
      return imgWithFallback(compBadge(comp), compBadge(comp), comp.name, klass);
    }
  };
})(window);
