/* ================= TOTAL MATCH — geração do mundo ================= */
/* Cria ligas, clubes, jogadores (fictícios) e seleções (nomes de países reais).
   Tudo determinístico a partir de uma semente fixa: o mundo é idêntico
   a cada carregamento, o que permite salvar carreiras e casar imagens por id. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var R = TM.rng;
  var WORLD_SEED = 20260807;

  /* ---------- Culturas de nomes (para clubes e jogadores) ---------- */
  var NAMES = {
    br: { first: ["Gabriel","Lucas","Matheus","Rafael","Bruno","Thiago","Felipe","Vinícius","Rodrigo","João","Pedro","Caio","Diego","Éder","Igor","Murilo","Léo","Danilo","Wesley","Kaio"],
          last: ["Silva","Santos","Oliveira","Souza","Costa","Pereira","Almeida","Ferreira","Rocha","Barbosa","Nunes","Cardoso","Ribeiro","Gomes","Araújo","Moraes","Teixeira","Freitas"] },
    es: { first: ["Sergio","Álvaro","Javier","Carlos","Iker","Marco","Diego","Pablo","Andrés","Raúl","Fernando","Dani","Koke","Isco","Rodri","Mikel","Unai","Aitor"],
          last: ["García","Martínez","López","Sánchez","Fernández","Torres","Ramos","Morata","Reyes","Navas","Herrera","Vega","Castro","Molina","Cazorla","Iniesta"] },
    en: { first: ["Harry","Jack","James","Mason","Phil","Declan","Jude","Bukayo","Marcus","Callum","Reece","Kyle","Jordan","Ollie","Kieran","Tyler","Aaron","Cole"],
          last: ["Smith","Kane","Sterling","Rice","Foden","Bellingham","Saka","Rashford","Walker","Stones","Maddison","Grealish","Henderson","Trippier","Shaw"] },
    it: { first: ["Marco","Andrea","Lorenzo","Nicolò","Federico","Alessandro","Gianluca","Ciro","Matteo","Davide","Sandro","Manuel","Bryan","Giacomo","Riccardo"],
          last: ["Rossi","Verratti","Chiesa","Barella","Insigne","Immobile","Locatelli","Bonucci","Jorginho","Tonali","Zaniolo","Scamacca","Bastoni","Pellegrini"] },
    de: { first: ["Leon","Kai","Joshua","Timo","Serge","Jamal","Florian","Niklas","Leroy","Julian","Thomas","Marco","Ilkay","Antonio","Robin","Nico"],
          last: ["Müller","Goretzka","Havertz","Werner","Gnabry","Musiala","Wirtz","Süle","Kimmich","Brandt","Neuer","Rüdiger","Sané","Gündogan"] },
    fr: { first: ["Kylian","Antoine","Ousmane","Aurélien","Eduardo","Théo","Jules","Randal","Marcus","Christopher","Ibrahima","Youssouf","William","Lucas","Adrien"],
          last: ["Mbappé","Griezmann","Dembélé","Tchouaméni","Camavinga","Koundé","Saliba","Upamecano","Rabiot","Thuram","Fofana","Coman","Kolo","Maignan"] },
    pt: { first: ["Bruno","Bernardo","Diogo","Rafael","João","Gonçalo","Rúben","Vitinha","Nuno","André","Pedro","Ricardo","Fábio","Tiago","Otávio"],
          last: ["Fernandes","Silva","Jota","Leão","Cancelo","Neves","Dias","Ramos","Félix","Mendes","Palhinha","Horta","Vitória","Costa"] },
    nl: { first: ["Frenkie","Cody","Memphis","Virgil","Denzel","Nathan","Xavi","Tijjani","Steven","Jurriën","Wout","Teun","Micky","Noa"],
          last: ["de Jong","Gakpo","Depay","van Dijk","Dumfries","Aké","Simons","Reijnders","Bergwijn","Timber","Weghorst","Koopmeiners","Malen"] },
    ar: { first: ["Lionel","Julián","Enzo","Rodrigo","Ángel","Alexis","Lautaro","Nicolás","Emiliano","Nahuel","Exequiel","Gonzalo","Thiago","Cristian"],
          last: ["Messi","Álvarez","Fernández","De Paul","Di María","Mac Allister","Martínez","Otamendi","Molina","Paredes","Palacios","Romero","Tagliafico"] },
    af: { first: ["Sadio","Mohamed","Victor","Achraf","Riyad","Thomas","André","Franck","Kalidou","Serhou","Hakim","Youssef","Wilfried","Edouard","Nicolas"],
          last: ["Mané","Salah","Osimhen","Hakimi","Mahrez","Partey","Onana","Kessié","Koulibaly","Guirassy","Ziyech","En-Nesyri","Bailly","Mendy"] },
    us: { first: ["Christian","Weston","Tyler","Gio","Tim","Brenden","Yunus","Folarin","Ricardo","Sergiño","Antonee","Josh","Cameron","Malik"],
          last: ["Pulisic","McKennie","Adams","Reyna","Weah","Aaronson","Musah","Balogun","Pepi","Dest","Robinson","Sargent","Carter","Tillman"] },
    asia:{ first: ["Son","Takefusa","Wataru","Kaoru","Ritsu","Ao","Hidemasa","Daichi","Kim","Lee","Hwang","Cho","Sardar","Mehdi","Alireza"],
          last: ["Heung-min","Kubo","Endo","Mitoma","Doan","Tanaka","Morita","Kamada","Min-jae","Kang-in","Hee-chan","Gue-sung","Azmoun","Taremi","Jahanbakhsh"] }
  };

  /* ---------- Ligas (10) — clubes fictícios, cultura de nome por país ---------- */
  var CITY = {
    br: ["Rio","São Paulo","Salvador","Recife","Porto Alegre","Curitiba","Belo Horizonte","Fortaleza","Goiânia","Manaus","Vitória","Natal","Santos","Cuiabá","Belém","Maceió","Campinas","Londrina"],
    es: ["Madrid","Sevilla","Valencia","Bilbao","Málaga","Zaragoza","Vigo","Granada","Gijón","Cádiz","Murcia","Almería","León","Getafe","Elche","Huelva","Alavés","Osasuna"],
    en: ["London","Manchester","Liverpool","Leeds","Newcastle","Birmingham","Sheffield","Bristol","Nottingham","Leicester","Brighton","Southampton","Norwich","Sunderland","Hull","Wolves","Everton","Fulham"],
    it: ["Milano","Roma","Torino","Napoli","Firenze","Genova","Bologna","Verona","Bergamo","Palermo","Cagliari","Udine","Lecce","Parma","Empoli","Sassuolo","Salerno","Monza"],
    de: ["München","Berlin","Dortmund","Leipzig","Hamburg","Köln","Frankfurt","Bremen","Leverkusen","Stuttgart","Mönchengladbach","Freiburg","Augsburg","Wolfsburg","Mainz","Bochum","Hoffenheim","Union"],
    fr: ["Paris","Marseille","Lyon","Lille","Monaco","Nice","Rennes","Nantes","Bordeaux","Lens","Montpellier","Strasbourg","Toulouse","Reims","Brest","Nîmes","Angers","Metz"],
    pt: ["Lisboa","Porto","Braga","Guimarães","Coimbra","Faro","Setúbal","Aveiro","Leiria","Funchal","Vizela","Chaves","Portimão","Boavista","Estoril","Famalicão","Arouca","Moreirense"],
    nl: ["Amsterdam","Rotterdam","Eindhoven","Utrecht","Alkmaar","Enschede","Groningen","Nijmegen","Heerenveen","Tilburg","Breda","Arnhem","Sittard","Almere","Volendam","Zwolle","Waalwijk","Emmen"],
    ar: ["Buenos Aires","Rosario","Córdoba","La Plata","Mendoza","Avellaneda","Santa Fe","Tucumán","Mar del Plata","Salta","San Lorenzo","Quilmes","Lanús","Banfield","Vélez","Tigre","Colón","Newell's"],
    us: ["Los Angeles","New York","Seattle","Atlanta","Miami","Portland","Austin","Nashville","Cincinnati","Orlando","Dallas","Chicago","Denver","Kansas City","Columbus","Houston","San José","Charlotte"]
  };
  var SUFFIX = {
    br: ["FC","EC","AC","SC","Atlético","United"], es: ["CF","FC","Real","Atlético","Deportivo","Unión"],
    en: ["FC","City","United","Rovers","Town","Athletic"], it: ["FC","Calcio","AC","Inter","US","1909"],
    de: ["FC","SV","VfB","Borussia","1. FC","SC"], fr: ["FC","AS","Olympique","Racing","Sporting","US"],
    pt: ["FC","SC","CD","União","Sporting","Académico"], nl: ["FC","SC","VV","AZ","Sparta","Vitesse"],
    ar: ["FC","CA","Racing","Club","Atlético","Unión"], us: ["FC","City","SC","United","Rovers","Athletic"]
  };
  var LEAGUE_DEFS = [
    { id: "br", name: "Liga do Brasil",     nation: "Brazil",      culture: "br" },
    { id: "en", name: "Liga da Inglaterra", nation: "England",     culture: "en" },
    { id: "es", name: "Liga da Espanha",    nation: "Spain",       culture: "es" },
    { id: "it", name: "Liga da Itália",     nation: "Italy",       culture: "it" },
    { id: "de", name: "Liga da Alemanha",   nation: "Germany",     culture: "de" },
    { id: "fr", name: "Liga da França",     nation: "France",      culture: "fr" },
    { id: "pt", name: "Liga de Portugal",   nation: "Portugal",    culture: "pt" },
    { id: "nl", name: "Liga da Holanda",    nation: "Netherlands", culture: "nl" },
    { id: "ar", name: "Liga da Argentina",  nation: "Argentina",   culture: "ar" },
    { id: "us", name: "Liga dos EUA",       nation: "USA",         culture: "us" }
  ];

  /* ---------- 48 seleções (nomes reais + cores para bandeira placeholder + cultura) ---------- */
  var NATIONS = [
    ["Brazil","#009c3b","#ffdf00","br"],["Argentina","#75aadb","#ffffff","ar"],["France","#0055a4","#ffffff","fr"],
    ["England","#ffffff","#ce1124","en"],["Spain","#aa151b","#f1bf00","es"],["Germany","#000000","#dd0000","de"],
    ["Portugal","#006600","#ff0000","pt"],["Netherlands","#ae1c28","#21468b","nl"],["Italy","#008c45","#cd212a","it"],
    ["Belgium","#000000","#fae042","fr"],["Croatia","#ff0000","#171796","it"],["Uruguay","#7bafd4","#ffffff","ar"],
    ["Mexico","#006847","#ce1126","es"],["USA","#3c3b6e","#b22234","us"],["Colombia","#fcd116","#003893","es"],
    ["Japan","#bc002d","#ffffff","asia"],["South Korea","#003478","#c60c30","asia"],["Senegal","#00853f","#fdef42","af"],
    ["Morocco","#c1272d","#006233","af"],["Nigeria","#008751","#ffffff","af"],["Ghana","#006b3f","#fcd116","af"],
    ["Cameroon","#007a5e","#ce1126","af"],["Ivory Coast","#f77f00","#009e60","af"],["Egypt","#ce1126","#000000","af"],
    ["Switzerland","#d52b1e","#ffffff","de"],["Denmark","#c60c30","#ffffff","nl"],["Poland","#dc143c","#ffffff","de"],
    ["Sweden","#006aa7","#fecc00","nl"],["Austria","#ed2939","#ffffff","de"],["Serbia","#c6363c","#0c4076","it"],
    ["Ecuador","#ffdd00","#034ea2","es"],["Peru","#d91023","#ffffff","es"],["Chile","#0039a6","#d52b1e","es"],
    ["Paraguay","#d52b1e","#0038a8","ar"],["Canada","#ff0000","#ffffff","us"],["Australia","#00843d","#ffcd00","en"],
    ["Saudi Arabia","#006c35","#ffffff","af"],["Qatar","#8a1538","#ffffff","af"],["Iran","#239f40","#da0000","asia"],
    ["Norway","#ba0c2f","#00205b","nl"],["Scotland","#0065bf","#ffffff","en"],["Turkey","#e30a17","#ffffff","it"],
    ["Ukraine","#005bbb","#ffd500","de"],["Wales","#c8102e","#00ab39","en"],["Greece","#0d5eaf","#ffffff","it"],
    ["Costa Rica","#002b7f","#ce1126","es"],["Tunisia","#e70013","#ffffff","af"],["Algeria","#006233","#ffffff","af"]
  ].map(function (n, i) {
    return { id: "nat" + i, name: n[0], colors: { primary: n[1], secondary: n[2] }, culture: n[3], players: [] };
  });

  // Distribuição de posições no elenco de 20 jogadores (2 GK, 7 DF, 7 MF, 4 FW)
  var POS_POOL = ["GK","GK","DF","DF","DF","DF","DF","DF","DF","MF","MF","MF","MF","MF","MF","MF","FW","FW","FW","FW"];

  function fullName(rng, culture) {
    var c = NAMES[culture] || NAMES.br;
    return R.pick(rng, c.first) + " " + R.pick(rng, c.last);
  }

  function makeAttrs(rng, base, pos) {
    // atributos 1-99 em torno de uma base de "overall"
    var a = {
      pac: R.gaussian(rng, base, 6), sho: R.gaussian(rng, base, 7),
      pas: R.gaussian(rng, base, 6), dri: R.gaussian(rng, base, 6),
      def: R.gaussian(rng, base, 7), phy: R.gaussian(rng, base, 6)
    };
    // ajustes por posição
    if (pos === "GK") { a.def = base + 4; a.sho = base - 25; a.pac = base - 8; }
    if (pos === "DF") { a.def += 6; a.sho -= 10; }
    if (pos === "FW") { a.sho += 7; a.def -= 12; a.pac += 3; }
    Object.keys(a).forEach(function (k) { a[k] = Math.max(20, Math.min(99, a[k])); });
    return a;
  }

  function overallFrom(attrs, pos) {
    var w;
    if (pos === "GK") w = { def: .7, phy: .2, pas: .1, pac: 0, sho: 0, dri: 0 };
    else if (pos === "DF") w = { def: .5, phy: .25, pac: .15, pas: .1, sho: 0, dri: 0 };
    else if (pos === "FW") w = { sho: .4, pac: .2, dri: .25, phy: .1, pas: .05, def: 0 };
    else w = { pas: .3, dri: .25, phy: .15, def: .15, sho: .1, pac: .05 };
    var s = 0; Object.keys(w).forEach(function (k) { s += (attrs[k] || 0) * w[k]; });
    return Math.round(s);
  }

  function generateWorld() {
    var rng = R.make(WORLD_SEED);
    var leagues = [], clubs = [], playersById = {}, pid = 1;

    LEAGUE_DEFS.forEach(function (ld) {
      var league = { id: ld.id, name: ld.name, nation: ld.nation, culture: ld.culture, clubIds: [] };
      var cities = CITY[ld.culture].slice();
      for (var ci = 0; ci < 18; ci++) {
        var city = cities[ci % cities.length];
        var suffix = R.pick(rng, SUFFIX[ld.culture]);
        var clubId = ld.id + "-" + ci;
        var hue = R.int(rng, 0, 360);
        var strength = R.int(rng, 58, 84); // força média do clube
        var club = {
          id: clubId, name: city + " " + suffix, short: city.slice(0, 3).toUpperCase(),
          leagueId: ld.id, coach: fullName(rng, ld.culture),
          colors: { primary: "hsl(" + hue + ",65%,42%)", secondary: "hsl(" + ((hue + 40) % 360) + ",60%,55%)" },
          strength: strength, playerIds: []
        };
        // elenco de 20 jogadores
        for (var p = 0; p < 20; p++) {
          var pos = POS_POOL[p];
          // ~45% jogadores da nação da liga, resto espalhado entre as 48 seleções
          var nation = R.chance(rng, 0.45)
            ? NATIONS.filter(function (n) { return n.name === ld.nation; })[0] || R.pick(rng, NATIONS)
            : R.pick(rng, NATIONS);
          var base = Math.max(45, Math.min(92, R.gaussian(rng, strength, 7)));
          var attrs = makeAttrs(rng, base, pos);
          var ov = overallFrom(attrs, pos);
          var age = R.int(rng, 16, 36);
          // potencial: quanto mais jovem e melhor, maior o teto; veteranos ~ overall atual
          var growth = age >= 30 ? 0 : Math.max(0, Math.round((26 - age) * 0.8) + R.int(rng, -1, 4));
          var potential = Math.min(99, ov + growth);
          var player = {
            id: "p" + (pid++), name: fullName(rng, nation.culture), clubId: clubId,
            pos: pos, age: age, overall: ov, potential: potential, attrs: attrs,
            nationId: nation.id, nationName: nation.name,
            height: R.int(rng, 168, 196), weight: R.int(rng, 62, 92),
            form: 0, goals: 0
          };
          playersById[player.id] = player;
          club.playerIds.push(player.id);
          nation.players.push(player.id);
        }
        league.clubIds.push(clubId);
        clubs.push(club);
      }
      leagues.push(league);
    });

    // técnico de cada seleção
    NATIONS.forEach(function (n) { n.coach = fullName(rng, n.culture); });

    // agentes livres (sem clube) — variados
    var freeAgents = [];
    for (var fa = 0; fa < 44; fa++) {
      var fpos = POS_POOL[fa % POS_POOL.length];
      var fnat = R.pick(rng, NATIONS);
      var fbase = R.int(rng, 52, 82);
      var fattrs = makeAttrs(rng, fbase, fpos);
      var fov = overallFrom(fattrs, fpos);
      var fage = R.int(rng, 17, 37);
      var fgrowth = fage >= 30 ? 0 : Math.max(0, Math.round((26 - fage) * 0.7) + R.int(rng, -1, 3));
      var fid = "fa" + (fa + 1);
      var fp = {
        id: fid, name: fullName(rng, fnat.culture), clubId: "free", pos: fpos, age: fage,
        overall: fov, potential: Math.min(99, fov + fgrowth), attrs: fattrs,
        nationId: fnat.id, nationName: fnat.name, height: R.int(rng, 168, 196), weight: R.int(rng, 62, 92),
        form: 0, goals: 0, freeAgent: true
      };
      playersById[fid] = fp;
      freeAgents.push(fid);
    }

    return {
      seed: WORLD_SEED,
      leagues: leagues,
      freeAgents: freeAgents,
      clubs: clubs,
      clubsById: clubs.reduce(function (m, c) { m[c.id] = c; return m; }, {}),
      leaguesById: leagues.reduce(function (m, l) { m[l.id] = l; return m; }, {}),
      playersById: playersById,
      nations: NATIONS,
      nationsById: NATIONS.reduce(function (m, n) { m[n.id] = n; return m; }, {})
    };
  }

  /* ---------- API pública ---------- */
  var _world = null;
  TM.data = {
    world: function () { return _world || (_world = generateWorld()); },
    club: function (id) { return TM.data.world().clubsById[id]; },
    league: function (id) { return TM.data.world().leaguesById[id]; },
    player: function (id) { return TM.data.world().playersById[id]; },
    nation: function (id) { return TM.data.world().nationsById[id]; },
    clubPlayers: function (clubId) {
      return TM.data.club(clubId).playerIds.map(TM.data.player)
        .sort(function (a, b) { return b.overall - a.overall; });
    },
    // melhores XI da nação (para seleções)
    nationSquad: function (natId) {
      var ids = TM.data.nation(natId).players.map(TM.data.player);
      return ids.sort(function (a, b) { return b.overall - a.overall; }).slice(0, 23);
    },
    clubRating: function (clubId) {
      var ps = TM.data.clubPlayers(clubId).slice(0, 11);
      return Math.round(ps.reduce(function (s, p) { return s + p.overall; }, 0) / ps.length);
    },
    // valor de mercado base (em milhões, referência em euro)
    marketValue: function (p) {
      var base = Math.pow(Math.max(1, p.overall - 50), 1.8) / 7;
      var ageF = p.age < 24 ? 1.3 : p.age > 31 ? 0.55 : 1;
      var potF = 1 + Math.max(0, (p.potential || p.overall) - p.overall) * 0.03;
      return Math.max(1, Math.round(base * ageF * potF));
    },
    // nome aleatório por cultura (para jogadores da base, etc.)
    randomName: function (culture) {
      var c = NAMES[culture] || NAMES.br;
      function r(a) { return a[Math.floor(Math.random() * a.length)]; }
      return r(c.first) + " " + r(c.last);
    },
    cultureOfLeague: function (leagueId) { var l = TM.data.league(leagueId); return l ? l.culture : "br"; },
    nationByName: function (name) { return TM.data.world().nations.filter(function (n) { return n.name === name; })[0] || null; },
    // taxa de desenvolvimento (rótulo) pela idade e margem de potencial
    devRate: function (p) {
      var room = (p.potential || p.overall) - p.overall;
      if (p.age <= 20 && room >= 4) return "Muito alta";
      if (p.age <= 23 && room >= 2) return "Alta";
      if (p.age <= 27) return "Média";
      if (p.age <= 31) return "Baixa";
      return "Declínio";
    }
  };
})(window);
