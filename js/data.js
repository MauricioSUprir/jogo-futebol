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
    { id: "br", name: "Brasileirão Série A",  nation: "Brazil",      culture: "br" },
    { id: "en", name: "Premier League",       nation: "England",     culture: "en" },
    { id: "es", name: "LaLiga",               nation: "Spain",       culture: "es" },
    { id: "it", name: "Serie A",              nation: "Italy",       culture: "it" },
    { id: "de", name: "Bundesliga",           nation: "Germany",     culture: "de" },
    { id: "fr", name: "Ligue 1",              nation: "France",      culture: "fr" },
    { id: "pt", name: "Liga Portugal",        nation: "Portugal",    culture: "pt" },
    { id: "nl", name: "Eredivisie",           nation: "Netherlands", culture: "nl" },
    { id: "ar", name: "Liga Profesional",     nation: "Argentina",   culture: "ar" },
    { id: "us", name: "Major League Soccer",  nation: "USA",         culture: "us" }
  ];

  /* ---------- Clubes reais por liga: [nome, sigla, força] ----------
     A força define o nível médio do elenco gerado (grandes = mais fortes).
     Quantidade por liga = tamanho real (par, para o mata-mata de pontos-corridos). */
  var REAL_CLUBS = {
    // Brasileirão Série A 2026
    br: [
      ["Flamengo","FLA",85],["Palmeiras","PAL",84],["Cruzeiro","CRU",82],["Botafogo","BOT",80],
      ["São Paulo","SAO",79],["Bahia","BAH",79],["Fluminense","FLU",78],["Atlético Mineiro","CAM",78],
      ["Internacional","INT",77],["Corinthians","COR",77],["Red Bull Bragantino","RBB",76],["Grêmio","GRE",76],
      ["Vasco da Gama","VAS",76],["Santos","SAN",76],["Mirassol","MIR",75],["Vitória","VIT",73],
      ["Athletico Paranaense","CAP",74],["Coritiba","CFC",72],["Remo","REM",70],["Chapecoense","CHA",70]
    ],
    // Premier League 2026-27
    en: [
      ["Manchester City","MCI",88],["Arsenal","ARS",88],["Liverpool","LIV",87],["Chelsea","CHE",84],
      ["Newcastle United","NEW",83],["Manchester United","MUN",82],["Aston Villa","AVL",82],["Tottenham Hotspur","TOT",81],
      ["Nottingham Forest","NFO",79],["Brighton & Hove Albion","BHA",80],["AFC Bournemouth","BOU",78],["Crystal Palace","CRY",78],
      ["Everton","EVE",77],["Fulham","FUL",77],["Brentford","BRE",76],["Sunderland","SUN",76],
      ["Leeds United","LEE",75],["Coventry City","COV",73],["Ipswich Town","IPS",73],["Hull City","HUL",71]
    ],
    // LaLiga 2026-27
    es: [
      ["Real Madrid","RMA",89],["Barcelona","BAR",88],["Atlético de Madrid","ATM",85],["Athletic Club","ATH",81],
      ["Villarreal","VIL",80],["Real Betis","BET",79],["Real Sociedad","RSO",79],["Sevilla","SEV",77],
      ["Valencia","VAL",76],["Celta de Vigo","CEL",76],["Rayo Vallecano","RAY",75],["Osasuna","OSA",75],
      ["Getafe","GET",74],["Espanyol","ESP",74],["Deportivo Alavés","ALA",73],["Levante","LEV",73],
      ["Elche","ELC",73],["Racing Santander","RAC",73],["Deportivo La Coruña","DEP",73],["Málaga","MAL",72]
    ],
    // Serie A 2026-27
    it: [
      ["Inter de Milão","INT",85],["Napoli","NAP",84],["Milan","MIL",83],["Juventus","JUV",82],
      ["Atalanta","ATA",82],["Roma","ROM",81],["Lazio","LAZ",80],["Fiorentina","FIO",79],
      ["Bologna","BOL",79],["Como","COM",77],["Torino","TOR",76],["Udinese","UDI",75],
      ["Genoa","GEN",74],["Cagliari","CAG",73],["Parma","PAR",73],["Monza","MON",72],
      ["Lecce","LEC",72],["Sassuolo","SAS",72],["Frosinone","FRO",71],["Venezia","VEN",71]
    ],
    // Bundesliga 2026-27
    de: [
      ["Bayern de Munique","BAY",88],["Bayer Leverkusen","B04",84],["Borussia Dortmund","BVB",83],["RB Leipzig","RBL",82],
      ["Eintracht Frankfurt","SGE",80],["VfB Stuttgart","VfB",79],["SC Freiburg","SCF",77],["Mainz 05","M05",76],
      ["Borussia M'gladbach","BMG",75],["TSG Hoffenheim","HOF",74],["Werder Bremen","SVW",74],["Union Berlin","FCU",74],
      ["Hamburger SV","HSV",74],["FC Augsburg","FCA",73],["1. FC Köln","KOE",73],["Schalke 04","S04",73],
      ["SV Elversberg","ELV",70],["SC Paderborn","SCP",70]
    ],
    // Ligue 1 2026-27
    fr: [
      ["Paris Saint-Germain","PSG",88],["Olympique de Marseille","OM",81],["Monaco","ASM",80],["Olympique de Lyon","OL",78],
      ["Lille","LIL",78],["Nice","NIC",77],["Lens","RCL",77],["Rennes","REN",76],
      ["Strasbourg","RCS",76],["Toulouse","TFC",74],["Brest","SB29",74],["Paris FC","PFC",73],
      ["Auxerre","AJA",72],["Lorient","FCL",72],["Angers","SCO",71],["Le Havre","HAC",71],
      ["Troyes","TRO",70],["Le Mans","LMA",69]
    ],
    // Liga Portugal 2026-27
    pt: [
      ["Sporting CP","SCP",83],["Benfica","SLB",83],["Porto","POR",82],["Braga","SCB",78],
      ["Vitória de Guimarães","VSC",75],["Famalicão","FAM",73],["Moreirense","MOR",72],["Gil Vicente","GIL",72],
      ["Estoril","EST",72],["Casa Pia","CAS",71],["Rio Ave","RAV",71],["Arouca","ARO",71],
      ["Santa Clara","SCL",71],["Nacional","NAC",70],["Marítimo","MAR",70],["Estrela da Amadora","EAM",69],
      ["Alverca","ALV",69],["Académico de Viseu","AVI",69]
    ],
    // Eredivisie 2026-27
    nl: [
      ["PSV","PSV",83],["Ajax","AJA",82],["Feyenoord","FEY",82],["AZ Alkmaar","AZ",78],
      ["Twente","TWE",77],["Utrecht","UTR",76],["NEC Nijmegen","NEC",73],["Heerenveen","HEE",72],
      ["Go Ahead Eagles","GAE",72],["Groningen","GRO",72],["Fortuna Sittard","FOR",71],["Sparta Rotterdam","SPA",71],
      ["PEC Zwolle","ZWO",71],["Excelsior","EXC",70],["Willem II","WIL",70],["ADO Den Haag","ADO",70],
      ["Cambuur","CAM",69],["Telstar","TEL",68]
    ],
    // Liga Profesional Argentina 2026 (seleção dos 20 principais)
    ar: [
      ["River Plate","RIV",82],["Boca Juniors","BOC",80],["Racing Club","RAC",79],["Estudiantes","EST",77],
      ["Vélez Sarsfield","VEL",77],["Talleres","TAL",76],["Independiente","IND",76],["Rosario Central","ROS",74],
      ["Argentinos Juniors","ARG",74],["Lanús","LAN",74],["Defensa y Justicia","DYJ",74],["San Lorenzo","SLO",74],
      ["Newell's Old Boys","NOB",73],["Huracán","HUR",73],["Godoy Cruz","GOD",72],["Belgrano","BEL",72],
      ["Gimnasia La Plata","GIM",71],["Banfield","BAN",71],["Instituto","INS",71],["Tigre","TIG",71]
    ],
    // Major League Soccer 2026 (seleção dos 20 principais)
    us: [
      ["Inter Miami","MIA",79],["Columbus Crew","CLB",77],["LAFC","LAFC",77],["Los Angeles Galaxy","LAG",76],
      ["Cincinnati","CIN",76],["Seattle Sounders","SEA",75],["San Diego FC","SD",75],["Orlando City","ORL",74],
      ["Philadelphia Union","PHI",74],["New York City FC","NYC",74],["Atlanta United","ATL",74],["Real Salt Lake","RSL",73],
      ["New York Red Bulls","RBNY",73],["Portland Timbers","POR",73],["Nashville SC","NSH",73],["Minnesota United","MIN",73],
      ["Sporting Kansas City","SKC",72],["FC Dallas","DAL",72],["Austin FC","ATX",72],["St. Louis City","STL",72]
    ]
  };

  /* ---------- Competições do jogo (id estável para casar imagem em assets/competicoes/<id>.png) ---------- */
  // [id, nome, tipo, corPrimária, corSecundária]
  var COMPETITIONS = [
    // Ligas nacionais
    ["lg-br", "Brasileirão Série A", "liga", "#0a7d34", "#ffd200"],
    ["lg-en", "Premier League", "liga", "#37003c", "#00ff85"],
    ["lg-es", "LaLiga", "liga", "#ee1c25", "#ff8200"],
    ["lg-it", "Serie A", "liga", "#0a2f6e", "#00a3e0"],
    ["lg-de", "Bundesliga", "liga", "#d20515", "#000000"],
    ["lg-fr", "Ligue 1", "liga", "#091c3e", "#dcff00"],
    ["lg-pt", "Liga Portugal", "liga", "#006847", "#c8102e"],
    ["lg-nl", "Eredivisie", "liga", "#e2001a", "#000000"],
    ["lg-ar", "Liga Profesional", "liga", "#6cace4", "#ffffff"],
    ["lg-us", "Major League Soccer", "liga", "#001838", "#c39e6d"],
    // Copas nacionais
    ["cup-br", "Copa do Brasil", "copa", "#1b8a3a", "#f2c200"],
    ["cup-en", "Copa da Inglaterra", "copa", "#c8102e", "#0a2240"],
    ["cup-es", "Copa da Espanha", "copa", "#c60b1e", "#ffc400"],
    ["cup-it", "Copa da Itália", "copa", "#0b3d91", "#57b4e5"],
    ["cup-de", "Copa da Alemanha", "copa", "#111111", "#d20515"],
    ["cup-fr", "Copa da França", "copa", "#1c2b57", "#e30613"],
    ["cup-pt", "Copa de Portugal", "copa", "#046a38", "#da291c"],
    ["cup-nl", "Copa da Holanda", "copa", "#ff6a00", "#0a2240"],
    ["cup-ar", "Copa da Argentina", "copa", "#75aadb", "#0a3a6b"],
    ["cup-us", "Copa dos EUA", "copa", "#0a2240", "#c8102e"],
    // Continentais de clubes
    ["cont-eu", "Champions League", "continental", "#03063d", "#0f9bd7"],
    ["cont-sa", "Libertadores", "continental", "#0a6b3b", "#f2b100"],
    ["cont-na", "Copa dos Campeões (América do Norte)", "continental", "#1a1a1a", "#00b2a9"],
    // Mundiais de clubes
    ["cwc-world", "Mundial de Clubes", "mundial", "#c8a24a", "#0a2240"],
    ["cwc-inter", "Intercontinental", "mundial", "#1a1a1a", "#c39e6d"],
    // Copas de seleções
    ["nat-world", "Copa do Mundo", "selecao", "#c8a24a", "#0a2240"],
    ["nat-america", "Copa América", "selecao", "#0a6b3b", "#ffd200"],
    ["nat-euro", "Eurocopa", "selecao", "#0b1a3a", "#00a0e0"],
    ["nat-africa", "Copa Africana de Nações", "selecao", "#0a7d34", "#e30613"]
  ].map(function (c) {
    return { id: c[0], name: c[1], type: c[2], colors: { primary: c[3], secondary: c[4] } };
  });
  var COMPETITIONS_BY_ID = COMPETITIONS.reduce(function (m, c) { m[c.id] = c; return m; }, {});
  // logos com fundo escuro nativo (não usam a plaquinha branca)
  if (COMPETITIONS_BY_ID["nat-world"]) COMPETITIONS_BY_ID["nat-world"].darkBg = true;

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
    ["Ukraine","#005bbb","#ffd500","de"],["Wales","#c8102e","#00ab39","en"],["Bosnia","#002395","#fecb00","it"],
    ["Cape Verde","#003893","#f7d116","af"],["Tunisia","#e70013","#ffffff","af"],["Algeria","#006233","#ffffff","af"]
  ].map(function (n, i) {
    return { id: "nat" + i, name: n[0], colors: { primary: n[1], secondary: n[2] }, culture: n[3], players: [] };
  });

  // ~70 treinadores reais — [nome, cultura, idade]. Os mais fortes vão para os
  // clubes mais fortes; o jogador também pode escolher um deles na carreira.
  var COACHES = [
    ["Pep Guardiola","es",54],["Carlo Ancelotti","it",66],["Diego Simeone","ar",55],["Jürgen Klopp","de",58],
    ["José Mourinho","pt",62],["Antonio Conte","it",56],["Xabi Alonso","es",44],["Hansi Flick","de",60],
    ["Mikel Arteta","es",43],["Arne Slot","nl",47],["Luis Enrique","es",55],["Simone Inzaghi","it",49],
    ["Unai Emery","es",54],["Rúben Amorim","pt",41],["Erik ten Hag","nl",55],["Roberto De Zerbi","it",46],
    ["Thiago Motta","it",43],["Gian Piero Gasperini","it",67],["Massimiliano Allegri","it",58],["Maurizio Sarri","it",66],
    ["Stefano Pioli","it",60],["Vincenzo Italiano","it",48],["Ange Postecoglou","en",60],["Eddie Howe","en",48],
    ["Enzo Maresca","it",45],["Nuno Espírito Santo","pt",51],["Marco Silva","pt",48],["Andoni Iraola","es",43],
    ["Oliver Glasner","de",51],["Thomas Frank","nl",52],["Vincent Kompany","fr",39],["Julian Nagelsmann","de",38],
    ["Sebastian Hoeneß","de",43],["Paulo Fonseca","pt",52],["Bruno Génésio","fr",59],["Adi Hütter","de",55],
    ["Roger Schmidt","de",58],["Peter Bosz","nl",61],["Francesco Farioli","it",36],["Sérgio Conceição","pt",50],
    ["Ernesto Valverde","es",61],["Manuel Pellegrini","es",72],["Marcelino","es",60],["Zinedine Zidane","fr",53],
    ["Didier Deschamps","fr",57],["Gareth Southgate","en",55],["Roberto Martínez","es",52],["Ronald Koeman","nl",62],
    ["Lionel Scaloni","ar",47],["Marcelo Gallardo","ar",49],["Ramón Díaz","ar",66],["Gabriel Milito","ar",44],
    ["Martín Demichelis","ar",44],["Abel Ferreira","pt",46],["Tite","br",64],["Dorival Júnior","br",63],
    ["Fernando Diniz","br",51],["Renato Gaúcho","br",63],["Cuca","br",62],["Mano Menezes","br",63],
    ["Rogério Ceni","br",52],["Odair Hellmann","br",53],["Luis Zubeldía","ar",44],["Artur Jorge","pt",53],
    ["Pedro Caixinha","pt",54],["Filipe Luís","br",40],["Gerardo Martino","ar",63],["Gregg Berhalter","us",52],
    ["Mauricio Pochettino","ar",53],["Vítor Pereira","pt",57]
  ].map(function (c, i) { return { id: "coach" + i, name: c[0], culture: c[1], age: c[2] }; });

  // Distribuição de posições no elenco de 20 jogadores (2 GK, 7 DF, 7 MF, 4 FW)
  var POS_POOL = ["GK","GK","DF","DF","DF","DF","DF","DF","DF","MF","MF","MF","MF","MF","MF","MF","FW","FW","FW","FW"];

  // posições específicas em português (sigla) por categoria — para exibição
  var POS_PT = {
    GK: ["GOL"],
    DF: ["ZAG", "ZAG", "ZAG", "LD", "LE"],           // zagueiro, lateral direito/esquerdo
    MF: ["VOL", "VOL", "MC", "MC", "MEI", "MD", "ME"], // volante, meia central, meia, meia dir/esq
    FW: ["CA", "CA", "PD", "PE", "SA"]                 // centroavante, ponta dir/esq, segundo atacante
  };
  function specificPos(rng, pos) { var a = POS_PT[pos] || [pos]; return a[Math.floor(rng() * a.length)]; }
  var POS_FALLBACK = { GK: "GOL", DF: "ZAG", MF: "MC", FW: "CA" };

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
      var realList = REAL_CLUBS[ld.id];
      for (var ci = 0; ci < realList.length; ci++) {
        var rc = realList[ci];               // [nome, sigla, força]
        var clubId = ld.id + "-" + ci;
        var hue = R.int(rng, 0, 360);
        var strength = rc[2];                // força real do clube
        var club = {
          id: clubId, name: rc[0], short: rc[1],
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
            pos: pos, pos2: specificPos(rng, pos), age: age, overall: ov, potential: potential, attrs: attrs,
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

    // técnicos reais nos clubes mais fortes (os demais mantêm nome gerado)
    clubs.slice().sort(function (a, b) { return b.strength - a.strength || (a.id < b.id ? -1 : 1); })
      .forEach(function (c, i) { if (i < COACHES.length) { c.coach = COACHES[i].name; c.coachId = COACHES[i].id; } });

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
        id: fid, name: fullName(rng, fnat.culture), clubId: "free", pos: fpos, pos2: specificPos(rng, fpos), age: fage,
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
    competitions: function () { return COMPETITIONS; },
    competition: function (id) { return COMPETITIONS_BY_ID[id] || null; },
    coaches: function () { return COACHES; },
    // times que disputam uma competição -> { isNation, teamIds }
    competitionTeams: function (compId) {
      var W = TM.data.world();
      // ligas e copas nacionais: clubes da liga correspondente
      if (compId.indexOf("lg-") === 0 || compId.indexOf("cup-") === 0) {
        var lg = W.leaguesById[compId.slice(compId.indexOf("-") + 1)];
        return { isNation: false, teamIds: lg ? lg.clubIds.slice() : [] };
      }
      // continentais de clubes: melhores clubes das ligas da região
      var CONT = {
        "cont-eu": { leagues: ["en", "es", "it", "de", "fr", "pt", "nl"], size: 32 },
        "cont-sa": { leagues: ["br", "ar"], size: 32 },
        "cont-na": { leagues: ["us"], size: 16 }
      };
      if (CONT[compId]) {
        var def = CONT[compId], pool = [];
        def.leagues.forEach(function (l) { var L = W.leaguesById[l]; if (L) pool = pool.concat(L.clubIds); });
        pool.sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
        return { isNation: false, teamIds: pool.slice(0, def.size) };
      }
      // Mundial de Clubes: 32 melhores clubes de todas as ligas
      if (compId === "cwc-world") {
        var all = [];
        W.leagues.forEach(function (L) { all = all.concat(L.clubIds); });
        all.sort(function (a, b) { return TM.data.clubRating(b) - TM.data.clubRating(a); });
        return { isNation: false, teamIds: all.slice(0, 32) };
      }
      // Intercontinental: sem clubes fixos (campeão da Liberta x campeão da Champions, definido na carreira)
      if (compId === "cwc-inter") return { isNation: false, teamIds: [], dynamic: true };
      // copas de seleções
      if (compId === "nat-world") return { isNation: true, teamIds: NATIONS.map(function (n) { return n.id; }) };
      var NAT = {
        "nat-america": ["Brazil", "Argentina", "Uruguay", "Colombia", "Chile", "Peru", "Ecuador", "Paraguay"],
        "nat-euro": ["France", "England", "Spain", "Germany", "Portugal", "Netherlands", "Italy", "Belgium", "Croatia", "Switzerland", "Denmark", "Poland", "Serbia", "Austria", "Turkey", "Ukraine"],
        "nat-africa": ["Senegal", "Morocco", "Nigeria", "Egypt", "Cameroon", "Ghana", "Ivory Coast", "Algeria"]
      };
      if (NAT[compId]) {
        var ids = NAT[compId].map(function (nm) { var n = TM.data.nationByName(nm); return n ? n.id : null; }).filter(Boolean);
        return { isNation: true, teamIds: ids };
      }
      return { isNation: false, teamIds: [] };
    },
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
    // valor de mercado base (em milhões de euro) — curva realista:
    // ~60=4M, 70=18M, 80=55M, 85=85M, 90=125M, 95=175M
    marketValue: function (p) {
      var base = Math.pow(Math.max(0.6, (p.overall - 45) / 10), 3.2);
      var ageF = p.age <= 21 ? 1.35 : p.age <= 25 ? 1.15 : p.age <= 29 ? 1.0 : p.age <= 32 ? 0.55 : 0.28;
      var potF = 1 + Math.max(0, (p.potential || p.overall) - p.overall) * 0.04;
      var gkF = p.pos === "GK" ? 0.7 : 1; // goleiros valem um pouco menos
      var v = base * ageF * potF * gkF;
      // arredonda de forma "bonita" (passos maiores em valores altos)
      if (v >= 100) return Math.round(v / 5) * 5;
      if (v >= 30) return Math.round(v);
      return Math.max(1, Math.round(v));
    },
    // rótulo de posição específica em PT (sigla)
    posLabel: function (p) { return (p && p.pos2) || (p && POS_FALLBACK[p.pos]) || (p && p.pos) || "?"; },
    randomSpecificPos: function (pos) { var a = POS_PT[pos] || [pos]; return a[Math.floor(Math.random() * a.length)]; },
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
