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

  // Treinadores reais 2025/26 — [nome, cultura, idade, clube(real) ou null=livre].
  // Cada técnico é alocado ao seu clube real; os "livres" (null) ficam só disponíveis
  // para o jogador escolher na carreira.
  var COACH_DATA = [
    // Premier League
    ["Pep Guardiola","es",55,"Manchester City"],["Mikel Arteta","es",43,"Arsenal"],["Arne Slot","nl",47,"Liverpool"],
    ["Xabi Alonso","es",44,"Chelsea"],["Eddie Howe","en",48,"Newcastle United"],["Michael Carrick","en",44,"Manchester United"],
    ["Unai Emery","es",54,"Aston Villa"],["Roberto De Zerbi","it",46,"Tottenham Hotspur"],["Fabian Hürzeler","de",32,"Brighton & Hove Albion"],
    ["Andoni Iraola","es",43,"AFC Bournemouth"],["Oliver Glasner","de",51,"Crystal Palace"],["Álvaro Arbeloa","es",42,"Fulham"],
    // LaLiga
    ["José Mourinho","pt",63,"Real Madrid"],["Hansi Flick","de",60,"Barcelona"],["Diego Simeone","ar",55,"Atlético de Madrid"],
    ["Ernesto Valverde","es",61,"Athletic Club"],["Marcelino","es",60,"Villarreal"],["Manuel Pellegrini","es",72,"Real Betis"],
    ["Matías Almeyda","ar",52,"Sevilla"],["Pellegrino Matarazzo","de",48,"Real Sociedad"],
    // Serie A
    ["Antonio Conte","it",56,"Napoli"],["Cristian Chivu","it",45,"Inter de Milão"],["Massimiliano Allegri","it",58,"Milan"],
    ["Luciano Spalletti","it",66,"Juventus"],["Raffaele Palladino","it",41,"Atalanta"],["Gian Piero Gasperini","it",67,"Roma"],
    ["Maurizio Sarri","it",67,"Lazio"],["Paolo Vanoli","it",53,"Fiorentina"],["Vincenzo Italiano","it",48,"Bologna"],
    // Bundesliga
    ["Vincent Kompany","fr",39,"Bayern de Munique"],["Niko Kovač","de",54,"Borussia Dortmund"],["Kasper Hjulmand","de",53,"Bayer Leverkusen"],
    ["Ole Werner","de",37,"RB Leipzig"],["Albert Riera","es",43,"Eintracht Frankfurt"],["Sebastian Hoeneß","de",43,"VfB Stuttgart"],
    ["Julian Schuster","de",40,"SC Freiburg"],
    // Ligue 1
    ["Luis Enrique","es",55,"Paris Saint-Germain"],["Bruno Génésio","fr",59,"Olympique de Marseille"],["Filipe Luís","br",40,"Monaco"],
    ["Paulo Fonseca","pt",52,"Olympique de Lyon"],["Claude Puel","fr",64,"Nice"],["Davide Ancelotti","it",36,"Lille"],
    // Liga Portugal
    ["Marco Silva","pt",48,"Benfica"],["Francesco Farioli","it",37,"Porto"],["Rui Borges","pt",44,"Sporting CP"],["Carlos Vicens","es",38,"Braga"],
    // Eredivisie
    ["Peter Bosz","nl",62,"PSV"],["Fred Grim","nl",60,"Ajax"],["Robin van Persie","nl",42,"Feyenoord"],
    // Brasileirão (todos os 20)
    ["Leonardo Jardim","pt",51,"Flamengo"],["Abel Ferreira","pt",47,"Palmeiras"],["Artur Jorge","pt",53,"Cruzeiro"],
    ["Franclim Carvalho","pt",45,"Botafogo"],["Hernán Crespo","ar",50,"São Paulo"],["Rogério Ceni","br",52,"Bahia"],
    ["Luís Zubeldía","ar",44,"Fluminense"],["Eduardo Domínguez","ar",47,"Atlético Mineiro"],["Paulo Pezzolano","ar",42,"Internacional"],
    ["Fernando Diniz","br",51,"Corinthians"],["Vagner Mancini","br",59,"Red Bull Bragantino"],["Luís Castro","pt",64,"Grêmio"],
    ["Pedro Emanuel","pt",49,"Vasco da Gama"],["Cuca","br",62,"Santos"],["Rafael Guanaes","br",44,"Mirassol"],
    ["Jair Ventura","br",47,"Vitória"],["Odair Hellmann","br",53,"Athletico Paranaense"],["Fernando Seabra","br",44,"Coritiba"],
    ["Léo Condé","br",51,"Remo"],["Rafael Lacerda","br",43,"Chapecoense"],
    // Argentina
    ["Marcelo Gallardo","ar",49,"River Plate"],["Claudio Úbeda","ar",54,"Boca Juniors"],["Gustavo Costas","ar",62,"Racing Club"],
    ["Alexander Medina","ar",47,"Estudiantes"],["Guillermo Barros Schelotto","ar",52,"Vélez Sarsfield"],
    // MLS
    ["Javier Mascherano","ar",41,"Inter Miami"],["Greg Vanney","us",51,"Los Angeles Galaxy"],["Marc Dos Santos","us",48,"LAFC"],
    ["Henrik Rydström","nl",49,"Columbus Crew"],["Brian Schmetzer","us",63,"Seattle Sounders"],
    // Livres / lendas (selecionáveis, sem clube fixo)
    ["Carlo Ancelotti","it",66,null],["Jürgen Klopp","de",58,null],["Zinedine Zidane","fr",53,null],
    ["Julian Nagelsmann","de",38,null],["Mauricio Pochettino","ar",53,null],["Ange Postecoglou","en",60,null],
    ["Thiago Motta","it",43,null],["Sérgio Conceição","pt",50,null],["Nuno Espírito Santo","pt",52,null],
    ["Rúben Amorim","pt",41,null],["Enzo Maresca","it",45,null],["Renato Gaúcho","br",63,null],
    ["Mano Menezes","br",63,null],["Stefano Pioli","it",60,null],["Sébastien Pocognoli","fr",38,null],
    ["Tite","br",64,null],["Dorival Júnior","br",63,null],["Jorge Sampaoli","ar",65,null],
    ["Thomas Frank","de",52,null],["Liam Rosenior","en",41,null],["Martín Anselmi","ar",40,null],
    ["Juan Pablo Vojvoda","ar",50,null]
  ];
  function coachSlug(name) { return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  var COACHES = COACH_DATA.map(function (c, i) { return { id: "coach" + i, name: c[0], culture: c[1], age: c[2], photoKey: coachSlug(c[0]) }; });
  // mapa clube(real) -> treinador
  var COACH_CLUB = {};
  COACH_DATA.forEach(function (c, i) { if (c[3]) COACH_CLUB[c[3]] = COACHES[i]; });

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

  var REAL_SQUADS_BR = {
  "Flamengo":[{n:"Lucas Paquetá",p:"MF",q:"MEI",a:28,o:84,t:88,v:32000000,nat:"Brazil"},{n:"Giorgian de Arrascaeta",p:"MF",q:"MEI",a:32,o:84,t:86,v:14000000,nat:"Uruguay"},{n:"Pedro",p:"FW",q:"CA",a:29,o:82,t:86,v:20000000,nat:"Brazil"},{n:"Agustín Rossi",p:"GK",q:"GOL",a:30,o:81,t:83,v:10000000,nat:"Argentina"},{n:"Léo Ortiz",p:"DF",q:"ZAG",a:30,o:81,t:83,v:12000000,nat:"Brazil"},{n:"Léo Pereira",p:"DF",q:"ZAG",a:30,o:81,t:83,v:12000000,nat:"Brazil"},{n:"Samuel Lino",p:"FW",q:"PE",a:26,o:81,t:85,v:15000000,nat:"Brazil"},{n:"Vitão",p:"DF",q:"ZAG",a:26,o:80,t:83,v:10000000,nat:"Brazil"},{n:"Erick Pulgar",p:"MF",q:"VOL",a:32,o:80,t:81,v:4500000,nat:"Chile"},{n:"Jorginho",p:"MF",q:"VOL",a:34,o:80,t:81,v:4000000,nat:"Italy"},{n:"Nicolás de la Cruz",p:"MF",q:"MC",a:29,o:80,t:83,v:8000000,nat:"Uruguay"},{n:"Danilo",p:"DF",q:"ZAG",a:35,o:79,t:79,v:2000000,nat:"Brazil"},{n:"Everton",p:"FW",q:"PE",a:30,o:79,t:80,v:7000000,nat:"Brazil"},{n:"Gonzalo Plata",p:"FW",q:"PD",a:25,o:79,t:83,v:9000000,nat:"Ecuador"},{n:"Ayrton Lucas",p:"DF",q:"LE",a:29,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Emerson Royal",p:"DF",q:"LD",a:27,o:78,t:80,v:5000000,nat:"Brazil"},{n:"Jorge Carrascal",p:"MF",q:"MEI",a:28,o:78,t:81,v:13000000,nat:"Colombia"},{n:"Luiz Araújo",p:"FW",q:"PD",a:30,o:78,t:79,v:7000000,nat:"Brazil"},{n:"Andrew",p:"GK",q:"GOL",a:25,o:77,t:80,v:5000000,nat:"Brazil"},{n:"Alex Sandro",p:"DF",q:"LE",a:35,o:77,t:77,v:1000000,nat:"Brazil"},{n:"Guillermo Varela",p:"DF",q:"LD",a:33,o:77,t:77,v:1000000,nat:"Uruguay"},{n:"Saúl Ñíguez",p:"MF",q:"MC",a:31,o:77,t:77,v:1000000,nat:"Spain"},{n:"Wallace Yan",p:"FW",q:"CA",a:21,o:76,t:84,v:5000000,nat:"Brazil"},{n:"Bruno Henrique",p:"FW",q:"CA",a:35,o:76,t:76,v:750000,nat:"Brazil"},{n:"Evertton Araújo",p:"MF",q:"VOL",a:23,o:75,t:81,v:10000000,nat:"Brazil"},{n:"Lorran",p:"MF",q:"MEI",a:20,o:75,t:84,v:4500000,nat:"Brazil"},{n:"Dyogo Alves",p:"GK",q:"GOL",a:22,o:72,t:78,v:400000,nat:"Brazil"},{n:"João Souza",p:"DF",q:"ZAG",a:19,o:71,t:81,v:800000,nat:"Brazil"}],
  "Palmeiras":[{n:"Vitor Roque",p:"FW",q:"CA",a:21,o:82,t:92,v:38000000,nat:"Brazil"},{n:"Andreas Pereira",p:"MF",q:"MC",a:30,o:81,t:83,v:14000000,nat:"Brazil"},{n:"Jhon Arias",p:"FW",q:"PD",a:28,o:81,t:85,v:15000000,nat:"Colombia"},{n:"Gustavo Gómez",p:"DF",q:"ZAG",a:33,o:80,t:81,v:3500000,nat:"Paraguay"},{n:"Joaquín Piquerez",p:"DF",q:"LE",a:27,o:80,t:83,v:12000000,nat:"Uruguay"},{n:"Paulinho",p:"FW",q:"SA",a:26,o:80,t:83,v:9000000,nat:"Brazil"},{n:"Flaco López",p:"FW",q:"CA",a:25,o:80,t:85,v:25000000,nat:"Argentina"},{n:"Carlos Miguel",p:"GK",q:"GOL",a:27,o:79,t:81,v:7000000,nat:"Brazil"},{n:"Alexander Barboza",p:"DF",q:"ZAG",a:31,o:79,t:80,v:5000000,nat:"Argentina"},{n:"Agustín Giay",p:"DF",q:"LD",a:22,o:79,t:87,v:10000000,nat:"Argentina"},{n:"Emiliano Martínez",p:"MF",q:"VOL",a:26,o:79,t:81,v:6500000,nat:"Uruguay"},{n:"Lucas Evangelista",p:"MF",q:"MC",a:31,o:79,t:80,v:4000000,nat:"Brazil"},{n:"Allan",p:"FW",q:"PD",a:22,o:79,t:88,v:20000000,nat:"Brazil"},{n:"Murilo",p:"DF",q:"ZAG",a:29,o:78,t:80,v:5000000,nat:"Brazil"},{n:"Bruno Fuchs",p:"DF",q:"ZAG",a:27,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Khellven",p:"DF",q:"LD",a:25,o:78,t:81,v:6000000,nat:"Brazil"},{n:"Mauricio",p:"MF",q:"MEI",a:25,o:78,t:83,v:15000000,nat:"Paraguay"},{n:"Felipe Anderson",p:"FW",q:"PE",a:33,o:78,t:78,v:1500000,nat:"Brazil"},{n:"Jefté",p:"DF",q:"LE",a:22,o:77,t:84,v:4000000,nat:"Brazil"},{n:"Marlon Freitas",p:"MF",q:"VOL",a:31,o:77,t:78,v:6000000,nat:"Brazil"},{n:"Ramón Sosa",p:"FW",q:"SA",a:26,o:77,t:80,v:10000000,nat:"Paraguay"},{n:"Kaique Pereira",p:"GK",q:"GOL",a:23,o:76,t:80,v:2000000,nat:"Brazil"},{n:"Luis Benedetti",p:"DF",q:"ZAG",a:20,o:76,t:85,v:4000000,nat:"Brazil"},{n:"Arthur Gabriel",p:"DF",q:"LE",a:20,o:75,t:84,v:3000000,nat:"Brazil"},{n:"Marcelo Lomba",p:"GK",q:"GOL",a:39,o:71,t:71,v:75000,nat:"Brazil"},{n:"Larson",p:"MF",q:"MC",a:21,o:71,t:78,v:400000,nat:"Brazil"},{n:"Erick Belé",p:"MF",q:"MEI",a:19,o:71,t:81,v:1000000,nat:"Brazil"},{n:"Riquelme Fillipi",p:"FW",q:"PE",a:19,o:71,t:81,v:1000000,nat:"Brazil"},{n:"Luis Pacheco",p:"MF",q:"VOL",a:18,o:69,t:81,v:500000,nat:"Brazil"}],
  "Cruzeiro":[{n:"Kaio Jorge",p:"FW",q:"CA",a:24,o:82,t:87,v:25000000,nat:"Brazil"},{n:"Gerson",p:"MF",q:"MC",a:29,o:81,t:85,v:18000000,nat:"Brazil"},{n:"Matheus Pereira",p:"MF",q:"MEI",a:30,o:81,t:83,v:14000000,nat:"Brazil"},{n:"Fabrício Bruno",p:"DF",q:"ZAG",a:30,o:79,t:81,v:12000000,nat:"Brazil"},{n:"Jonathan Jesus",p:"DF",q:"ZAG",a:22,o:79,t:89,v:8000000,nat:"Brazil"},{n:"Lucas Romero",p:"MF",q:"VOL",a:32,o:79,t:79,v:2500000,nat:"Argentina"},{n:"Matheus Henrique",p:"MF",q:"MC",a:28,o:79,t:81,v:4500000,nat:"Brazil"},{n:"Luciano Rodríguez",p:"FW",q:"CA",a:23,o:79,t:85,v:9000000,nat:"Uruguay"},{n:"Gabriel Rojas",p:"DF",q:"LE",a:29,o:78,t:80,v:4000000,nat:"Argentina"},{n:"William",p:"DF",q:"LD",a:31,o:78,t:79,v:3000000,nat:"Brazil"},{n:"Luis Sinisterra",p:"FW",q:"PE",a:27,o:78,t:81,v:11000000,nat:"Colombia"},{n:"Wanderson",p:"FW",q:"PE",a:31,o:78,t:79,v:3000000,nat:"Brazil"},{n:"Keny Arroyo",p:"FW",q:"PD",a:20,o:78,t:88,v:10000000,nat:"Ecuador"},{n:"Gabriel Pec",p:"FW",q:"PD",a:25,o:78,t:81,v:7000000,nat:"Brazil"},{n:"João Marcelo",p:"DF",q:"ZAG",a:26,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Lucas Villalba",p:"DF",q:"ZAG",a:31,o:77,t:77,v:1700000,nat:"Argentina"},{n:"Kauã Prates",p:"DF",q:"LE",a:17,o:76,t:90,v:10000000,nat:"Brazil"},{n:"Zé Lucas",p:"MF",q:"VOL",a:18,o:76,t:90,v:8000000,nat:"Brazil"},{n:"Wesley",p:"FW",q:"PE",a:21,o:76,t:84,v:4000000,nat:"Brazil"},{n:"Bruno Rodrigues",p:"FW",q:"PE",a:29,o:76,t:77,v:1200000,nat:"Brazil"},{n:"Néiser Villarreal",p:"FW",q:"CA",a:21,o:76,t:84,v:4000000,nat:"Colombia"},{n:"Chico da Costa",p:"FW",q:"CA",a:31,o:76,t:76,v:1000000,nat:"Brazil"},{n:"Lucas Silva",p:"MF",q:"VOL",a:33,o:75,t:75,v:450000,nat:"Brazil"},{n:"Kaique Kenji",p:"FW",q:"PE",a:20,o:75,t:84,v:3000000,nat:"Brazil"},{n:"João Costa",p:"FW",q:"PD",a:21,o:75,t:82,v:2500000,nat:"Portugal"},{n:"Léo Aragão",p:"GK",q:"GOL",a:24,o:74,t:76,v:800000,nat:"Brazil"},{n:"Cássio",p:"GK",q:"GOL",a:39,o:74,t:74,v:250000,nat:"Brazil"},{n:"Fagner",p:"DF",q:"LD",a:37,o:74,t:74,v:200000,nat:"Brazil"},{n:"Fabrizio Peralta",p:"MF",q:"MC",a:24,o:74,t:76,v:800000,nat:"Paraguay"},{n:"Marquinhos",p:"FW",q:"PD",a:23,o:74,t:78,v:2500000,nat:"Brazil"},{n:"Kauã Moraes",p:"DF",q:"LD",a:19,o:73,t:83,v:2000000,nat:"Brazil"},{n:"Ian Luccas",p:"MF",q:"VOL",a:23,o:72,t:76,v:500000,nat:"Brazil"},{n:"Otávio Costa",p:"GK",q:"GOL",a:20,o:71,t:89,v:500000,nat:"Brazil"}],
  "Botafogo":[{n:"Danilo",p:"MF",q:"MC",a:25,o:83,t:88,v:32000000,nat:"Brazil"},{n:"Vitinho",p:"DF",q:"LD",a:27,o:80,t:83,v:9000000,nat:"Brazil"},{n:"Arthur Cabral",p:"FW",q:"CA",a:28,o:80,t:83,v:9000000,nat:"Brazil"},{n:"Alex Telles",p:"DF",q:"LE",a:33,o:79,t:79,v:2800000,nat:"Brazil"},{n:"Cristian Medina",p:"MF",q:"MC",a:24,o:79,t:83,v:9000000,nat:"Argentina"},{n:"Santiago Rodríguez",p:"MF",q:"MEI",a:26,o:79,t:81,v:6000000,nat:"Uruguay"},{n:"Gabriel Batista",p:"GK",q:"GOL",a:28,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Nahuel Ferraresi",p:"DF",q:"ZAG",a:27,o:78,t:80,v:4500000,nat:"Colombia"},{n:"Matheus Martins",p:"FW",q:"PE",a:23,o:78,t:83,v:6000000,nat:"Brazil"},{n:"Júnior Santos",p:"FW",q:"PD",a:31,o:78,t:79,v:3000000,nat:"Brazil"},{n:"Warleson",p:"GK",q:"GOL",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Kaio",p:"DF",q:"ZAG",a:30,o:77,t:77,v:1800000,nat:"Brazil"},{n:"Allan",p:"MF",q:"VOL",a:35,o:77,t:77,v:1000000,nat:"Brazil"},{n:"Mateo Ponte",p:"DF",q:"LD",a:23,o:76,t:80,v:2000000,nat:"Uruguay"},{n:"Álvaro Montoro",p:"FW",q:"PE",a:19,o:76,t:88,v:10000000,nat:"Argentina"},{n:"Danilo",p:"FW",q:"CA",a:27,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Domingos Andrade",p:"MF",q:"VOL",a:23,o:75,t:79,v:1500000,nat:"Cape Verde"},{n:"Jordan Barrera",p:"MF",q:"MEI",a:20,o:75,t:83,v:2500000,nat:"Colombia"},{n:"Lucas Villalba",p:"FW",q:"PD",a:25,o:75,t:77,v:1500000,nat:"Uruguay"},{n:"Paulinho",p:"DF",q:"LE",a:31,o:74,t:74,v:400000,nat:"Brazil"},{n:"Marçal",p:"DF",q:"LE",a:37,o:74,t:74,v:200000,nat:"Brazil"},{n:"Edenilson",p:"MF",q:"MC",a:36,o:74,t:74,v:250000,nat:"Brazil"},{n:"Raul",p:"GK",q:"GOL",a:29,o:73,t:74,v:400000,nat:"Brazil"},{n:"Lucas Monzón",p:"DF",q:"ZAG",a:24,o:73,t:75,v:550000,nat:"Uruguay"},{n:"Kadir Barría",p:"FW",q:"CA",a:19,o:73,t:83,v:2000000,nat:"Mexico"},{n:"Cristhian Loor",p:"GK",q:"GOL",a:20,o:71,t:79,v:350000,nat:"Ecuador"},{n:"Gabriel Justino",p:"DF",q:"ZAG",a:20,o:71,t:79,v:500000,nat:"Brazil"},{n:"Ythallo",p:"DF",q:"ZAG",a:22,o:71,t:77,v:300000,nat:"Brazil"},{n:"Caio Roque",p:"DF",q:"LE",a:24,o:71,t:73,v:200000,nat:"Brazil"},{n:"Wallace Davi",p:"MF",q:"VOL",a:19,o:71,t:81,v:1000000,nat:"Brazil"},{n:"Anthony",p:"DF",q:"ZAG",a:21,o:70,t:77,v:300000,nat:"Brazil"},{n:"Jhoan Hernández",p:"DF",q:"LE",a:20,o:69,t:77,v:150000,nat:"Colombia"},{n:"Huguinho",p:"MF",q:"VOL",a:19,o:68,t:78,v:300000,nat:"Brazil"}],
  "São Paulo":[{n:"Marcos Antônio",p:"MF",q:"MC",a:26,o:80,t:83,v:12000000,nat:"Brazil"},{n:"Artur",p:"FW",q:"PD",a:28,o:80,t:83,v:8000000,nat:"Brazil"},{n:"Damián Bobadilla",p:"MF",q:"MC",a:25,o:79,t:83,v:8000000,nat:"Paraguay"},{n:"Victor Sá",p:"FW",q:"PE",a:32,o:79,t:79,v:2500000,nat:"Brazil"},{n:"Lucas Moura",p:"FW",q:"PD",a:33,o:79,t:79,v:2000000,nat:"Brazil"},{n:"Enzo Díaz",p:"DF",q:"LE",a:30,o:78,t:79,v:3000000,nat:"Argentina"},{n:"Wendell",p:"DF",q:"LE",a:33,o:78,t:78,v:1500000,nat:"Brazil"},{n:"Cauly",p:"MF",q:"MEI",a:30,o:78,t:79,v:3000000,nat:"Brazil"},{n:"Ferreirinha",p:"FW",q:"PE",a:28,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Jonathan Calleri",p:"FW",q:"CA",a:32,o:78,t:78,v:1500000,nat:"Argentina"},{n:"Luciano",p:"FW",q:"CA",a:33,o:78,t:78,v:1300000,nat:"Brazil"},{n:"Rafael Tolói",p:"DF",q:"ZAG",a:35,o:77,t:77,v:800000,nat:"Italy"},{n:"Aurélio Buta",p:"DF",q:"LD",a:29,o:77,t:78,v:2000000,nat:"Portugal"},{n:"Pablo Maia",p:"MF",q:"VOL",a:24,o:77,t:80,v:5000000,nat:"Brazil"},{n:"Newton",p:"MF",q:"VOL",a:26,o:77,t:79,v:3000000,nat:"Brazil"},{n:"André Silva",p:"FW",q:"CA",a:29,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Carlos Coronel",p:"GK",q:"GOL",a:29,o:76,t:77,v:1500000,nat:"Paraguay"},{n:"Lucas Ramon",p:"DF",q:"LD",a:32,o:76,t:76,v:700000,nat:"Brazil"},{n:"Danielzinho",p:"MF",q:"MC",a:31,o:76,t:76,v:1000000,nat:"Brazil"},{n:"Rafael",p:"GK",q:"GOL",a:37,o:75,t:75,v:400000,nat:"Brazil"},{n:"Sabino",p:"DF",q:"ZAG",a:29,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Robert Arboleda",p:"DF",q:"ZAG",a:34,o:75,t:75,v:400000,nat:"Ecuador"},{n:"Cédric Soares",p:"DF",q:"LD",a:34,o:75,t:75,v:500000,nat:"Portugal"},{n:"Luan",p:"MF",q:"VOL",a:27,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Matheus Belém",p:"DF",q:"ZAG",a:23,o:74,t:78,v:800000,nat:"Brazil"},{n:"Maik",p:"DF",q:"LD",a:21,o:74,t:81,v:1500000,nat:"Brazil"},{n:"Ryan Francisco",p:"FW",q:"CA",a:19,o:74,t:85,v:4500000,nat:"Brazil"},{n:"Lucca",p:"FW",q:"PE",a:19,o:73,t:84,v:3000000,nat:"Brazil"},{n:"Hugo Leonardo",p:"MF",q:"VOL",a:22,o:71,t:77,v:200000,nat:"Brazil"},{n:"Tetê",p:"FW",q:"PE",a:19,o:71,t:81,v:1000000,nat:"Brazil"},{n:"João Pedro",p:"GK",q:"GOL",a:20,o:70,t:78,v:200000,nat:"Brazil"},{n:"Felipe Preis",p:"GK",q:"GOL",a:20,o:70,t:78,v:200000,nat:"Brazil"},{n:"Isac",p:"DF",q:"ZAG",a:20,o:70,t:78,v:200000,nat:"Brazil"},{n:"Paulinho",p:"FW",q:"CA",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Young",p:"GK",q:"GOL",a:24,o:69,t:71,v:100000,nat:"Brazil"},{n:"Djhordney",p:"MF",q:"MC",a:19,o:69,t:79,v:500000,nat:"Brazil"},{n:"Luis Osorio",p:"DF",q:"ZAG",a:19,o:68,t:78,v:200000,nat:"Brazil"},{n:"Nicolas",p:"DF",q:"LE",a:19,o:68,t:78,v:200000,nat:"Brazil"},{n:"Igor Felisberto",p:"DF",q:"LD",a:19,o:68,t:78,v:200000,nat:"Brazil"},{n:"Pedro Ferreira",p:"MF",q:"MEI",a:19,o:68,t:78,v:200000,nat:"Brazil"}],
  "Bahia":[{n:"Luciano Juba",p:"DF",q:"LE",a:26,o:81,t:84,v:14000000,nat:"Brazil"},{n:"Jean Lucas",p:"MF",q:"MC",a:28,o:81,t:84,v:13000000,nat:"Brazil"},{n:"Santiago Ramos Mingo",p:"DF",q:"ZAG",a:24,o:79,t:83,v:12000000,nat:"Argentina"},{n:"Caio Alexandre",p:"MF",q:"VOL",a:27,o:79,t:81,v:7000000,nat:"Brazil"},{n:"Nicolás Acevedo",p:"MF",q:"VOL",a:27,o:79,t:81,v:6000000,nat:"Uruguay"},{n:"Rodrigo Nestor",p:"MF",q:"MC",a:26,o:79,t:81,v:7000000,nat:"Brazil"},{n:"Erick Pulga",p:"FW",q:"PE",a:25,o:79,t:83,v:11000000,nat:"Brazil"},{n:"Guido Herrera",p:"GK",q:"GOL",a:34,o:78,t:78,v:1500000,nat:"Argentina"},{n:"Iago",p:"DF",q:"LE",a:29,o:78,t:80,v:3500000,nat:"Brazil"},{n:"Erick",p:"MF",q:"VOL",a:28,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Ronaldo",p:"GK",q:"GOL",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Kanu",p:"DF",q:"ZAG",a:29,o:77,t:79,v:3000000,nat:"Brazil"},{n:"David Duarte",p:"DF",q:"ZAG",a:31,o:77,t:77,v:1500000,nat:"Brazil"},{n:"Everton Ribeiro",p:"MF",q:"MEI",a:37,o:77,t:77,v:1000000,nat:"Brazil"},{n:"Cristian Olivera",p:"FW",q:"PD",a:24,o:77,t:80,v:5000000,nat:"Uruguay"},{n:"Michel Araújo",p:"FW",q:"PD",a:29,o:77,t:78,v:2500000,nat:"Uruguay"},{n:"Alejo Veliz",p:"FW",q:"CA",a:22,o:77,t:84,v:4000000,nat:"Argentina"},{n:"Willian José",p:"FW",q:"CA",a:34,o:77,t:77,v:1200000,nat:"Brazil"},{n:"Ruan Pablo",p:"FW",q:"PE",a:18,o:76,t:90,v:8000000,nat:"Brazil"},{n:"Mateo Sanabria",p:"FW",q:"PE",a:22,o:76,t:82,v:2000000,nat:"Argentina"},{n:"Ademir",p:"FW",q:"PD",a:31,o:76,t:76,v:1200000,nat:"Brazil"},{n:"Román Gómez",p:"DF",q:"LD",a:22,o:75,t:81,v:1500000,nat:"Argentina"},{n:"Everaldo",p:"FW",q:"CA",a:35,o:75,t:75,v:350000,nat:"Brazil"},{n:"Léo Vieira",p:"GK",q:"GOL",a:35,o:74,t:74,v:200000,nat:"Brazil"},{n:"Marco Moreno",p:"DF",q:"ZAG",a:25,o:74,t:76,v:900000,nat:"Spain"},{n:"Dell",p:"FW",q:"CA",a:18,o:74,t:87,v:4000000,nat:"Brazil"},{n:"Luiz Gustavo",p:"DF",q:"ZAG",a:20,o:72,t:80,v:600000,nat:"Brazil"},{n:"Marcos Victor",p:"DF",q:"ZAG",a:24,o:72,t:74,v:450000,nat:"Brazil"},{n:"Zé Guilherme",p:"DF",q:"LE",a:21,o:71,t:78,v:400000,nat:"Brazil"},{n:"Victor",p:"GK",q:"GOL",a:20,o:70,t:78,v:200000,nat:"Brazil"},{n:"Fredi Gomes",p:"DF",q:"ZAG",a:20,o:70,t:78,v:200000,nat:"Brazil"},{n:"Roger Gabriel",p:"MF",q:"MEI",a:19,o:68,t:78,v:200000,nat:"Brazil"}],
  "Fluminense":[{n:"Martinelli",p:"MF",q:"VOL",a:24,o:80,t:85,v:16000000,nat:"Brazil"},{n:"Hércules",p:"MF",q:"MC",a:25,o:80,t:85,v:15000000,nat:"Brazil"},{n:"Jefferson Savarino",p:"MF",q:"MEI",a:29,o:80,t:83,v:8000000,nat:"Colombia"},{n:"Luciano Acosta",p:"MF",q:"MEI",a:32,o:80,t:81,v:5000000,nat:"Argentina"},{n:"Agustín Canobbio",p:"FW",q:"PD",a:27,o:80,t:83,v:8000000,nat:"Uruguay"},{n:"Guilherme Arana",p:"DF",q:"LE",a:29,o:79,t:81,v:6000000,nat:"Brazil"},{n:"John Kennedy",p:"FW",q:"CA",a:24,o:79,t:83,v:9000000,nat:"Brazil"},{n:"Rodrigo Castillo",p:"FW",q:"CA",a:27,o:79,t:81,v:6000000,nat:"Argentina"},{n:"Juan Pablo Freytes",p:"DF",q:"ZAG",a:26,o:78,t:80,v:5000000,nat:"Argentina"},{n:"Julián Millán",p:"DF",q:"ZAG",a:28,o:78,t:80,v:3500000,nat:"Colombia"},{n:"Yeferson Soteldo",p:"FW",q:"PE",a:29,o:78,t:80,v:3500000,nat:"Colombia"},{n:"Kevin Serna",p:"FW",q:"PD",a:28,o:78,t:80,v:5000000,nat:"Colombia"},{n:"Jemmes",p:"DF",q:"ZAG",a:26,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Ignácio",p:"DF",q:"ZAG",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Igor Rabello",p:"DF",q:"ZAG",a:31,o:77,t:77,v:1400000,nat:"Brazil"},{n:"Guga",p:"DF",q:"LD",a:27,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Otávio",p:"MF",q:"VOL",a:32,o:77,t:77,v:1200000,nat:"Brazil"},{n:"Nonato",p:"MF",q:"MC",a:28,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Alisson",p:"MF",q:"MC",a:33,o:77,t:77,v:800000,nat:"Brazil"},{n:"Hulk",p:"FW",q:"CA",a:40,o:77,t:77,v:1000000,nat:"Brazil"},{n:"David Terans",p:"MF",q:"MEI",a:31,o:76,t:76,v:1000000,nat:"Uruguay"},{n:"Thiago Silva",p:"DF",q:"ZAG",a:41,o:75,t:75,v:500000,nat:"Brazil"},{n:"Renê",p:"DF",q:"LE",a:33,o:75,t:75,v:400000,nat:"Brazil"},{n:"Riquelme",p:"FW",q:"PD",a:19,o:75,t:86,v:6000000,nat:"Brazil"},{n:"Germán Cano",p:"FW",q:"CA",a:38,o:75,t:75,v:500000,nat:"Argentina"},{n:"Samuel Xavier",p:"DF",q:"LD",a:36,o:74,t:74,v:200000,nat:"Brazil"},{n:"Ganso",p:"MF",q:"MEI",a:36,o:74,t:74,v:300000,nat:"Brazil"},{n:"Vitor Eudes",p:"GK",q:"GOL",a:27,o:73,t:74,v:400000,nat:"Brazil"},{n:"Marcelo Pitaluga",p:"GK",q:"GOL",a:23,o:71,t:75,v:200000,nat:"Brazil"},{n:"Fábio",p:"GK",q:"GOL",a:45,o:71,t:71,v:75000,nat:"Brazil"},{n:"Yago Ferreira",p:"MF",q:"MEI",a:25,o:71,t:73,v:200000,nat:"Brazil"},{n:"Julio Fidelis",p:"DF",q:"LD",a:19,o:68,t:78,v:300000,nat:"Brazil"},{n:"Matheus Reis",p:"FW",q:"PE",a:19,o:68,t:78,v:200000,nat:"Brazil"}],
  "Atlético Mineiro":[{n:"Renan Lodi",p:"DF",q:"LE",a:28,o:80,t:83,v:11000000,nat:"Brazil"},{n:"Gustavo Scarpa",p:"MF",q:"MEI",a:32,o:80,t:81,v:4500000,nat:"Brazil"},{n:"Mateo Cassierra",p:"FW",q:"CA",a:29,o:80,t:83,v:8000000,nat:"Colombia"},{n:"Tomás Cuello",p:"FW",q:"PE",a:26,o:79,t:81,v:6000000,nat:"Argentina"},{n:"Lyanco",p:"DF",q:"ZAG",a:29,o:78,t:80,v:4500000,nat:"Brazil"},{n:"Ruan",p:"DF",q:"ZAG",a:27,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Léo Duarte",p:"DF",q:"ZAG",a:30,o:78,t:78,v:2500000,nat:"Brazil"},{n:"Angelo Preciado",p:"DF",q:"LD",a:28,o:78,t:80,v:3500000,nat:"Ecuador"},{n:"Alexsander",p:"MF",q:"VOL",a:22,o:78,t:85,v:5500000,nat:"Brazil"},{n:"Victor Hugo",p:"MF",q:"MC",a:22,o:78,t:85,v:7000000,nat:"Brazil"},{n:"Alan Franco",p:"MF",q:"MC",a:27,o:78,t:80,v:4500000,nat:"Ecuador"},{n:"Everson",p:"GK",q:"GOL",a:36,o:77,t:77,v:900000,nat:"Brazil"},{n:"Natanael",p:"DF",q:"LD",a:24,o:77,t:80,v:4500000,nat:"Brazil"},{n:"Maycon",p:"MF",q:"MC",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Igor Gomes",p:"MF",q:"MEI",a:27,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Dudu",p:"FW",q:"PE",a:34,o:77,t:77,v:800000,nat:"Brazil"},{n:"Thiago Borbas",p:"FW",q:"CA",a:24,o:77,t:80,v:3500000,nat:"Uruguay"},{n:"Reinier",p:"MF",q:"MEI",a:24,o:76,t:78,v:2000000,nat:"Brazil"},{n:"Bernard",p:"FW",q:"PE",a:33,o:76,t:76,v:600000,nat:"Brazil"},{n:"Alan Minda",p:"FW",q:"PD",a:23,o:76,t:81,v:3000000,nat:"Ecuador"},{n:"Vitor Hugo",p:"DF",q:"ZAG",a:35,o:75,t:75,v:500000,nat:"Brazil"},{n:"Tomás Pérez",p:"MF",q:"VOL",a:20,o:75,t:84,v:3000000,nat:"Argentina"},{n:"Patrick",p:"MF",q:"VOL",a:22,o:75,t:81,v:1500000,nat:"Brazil"},{n:"Iván Román",p:"DF",q:"ZAG",a:20,o:74,t:82,v:1500000,nat:"Chile"},{n:"Pedro Cobra",p:"GK",q:"GOL",a:20,o:72,t:80,v:600000,nat:"Brazil"},{n:"Rômulo",p:"DF",q:"ZAG",a:22,o:72,t:78,v:450000,nat:"Brazil"},{n:"Gabriel Delfim",p:"GK",q:"GOL",a:24,o:71,t:73,v:300000,nat:"Brazil"},{n:"Mamady Cissé",p:"MF",q:"MC",a:19,o:71,t:81,v:1000000,nat:"Senegal"},{n:"Robert",p:"GK",q:"GOL",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Kauã Pascini",p:"DF",q:"LE",a:18,o:69,t:81,v:500000,nat:"Brazil"},{n:"Cauã Soares",p:"FW",q:"CA",a:18,o:69,t:81,v:500000,nat:"Brazil"},{n:"Vitão",p:"DF",q:"ZAG",a:18,o:68,t:80,v:200000,nat:"Brazil"},{n:"Índio",p:"MF",q:"MC",a:18,o:68,t:80,v:200000,nat:"Brazil"}],
  "Internacional":[{n:"Guillermo Maripán",p:"DF",q:"ZAG",a:32,o:79,t:79,v:2000000,nat:"Chile"},{n:"Alexandro Bernabei",p:"DF",q:"LE",a:25,o:79,t:83,v:8000000,nat:"Argentina"},{n:"Alan Patrick",p:"MF",q:"MEI",a:35,o:79,t:79,v:2000000,nat:"Brazil"},{n:"Johan Carbonero",p:"FW",q:"PE",a:27,o:79,t:81,v:6000000,nat:"Colombia"},{n:"Sergio Rochet",p:"GK",q:"GOL",a:33,o:78,t:78,v:1800000,nat:"Uruguay"},{n:"Bruno Gomes",p:"DF",q:"LD",a:25,o:78,t:81,v:6000000,nat:"Brazil"},{n:"Vitinho",p:"FW",q:"PE",a:27,o:78,t:80,v:5000000,nat:"Brazil"},{n:"Victor Gabriel",p:"DF",q:"ZAG",a:22,o:77,t:84,v:5000000,nat:"Brazil"},{n:"Matheus Bahia",p:"DF",q:"LE",a:26,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Braian Aguirre",p:"DF",q:"LD",a:26,o:77,t:78,v:2500000,nat:"Argentina"},{n:"Rodrigo Villagra",p:"MF",q:"VOL",a:25,o:77,t:80,v:3500000,nat:"Argentina"},{n:"Thiago Maia",p:"MF",q:"VOL",a:29,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Ronaldo",p:"MF",q:"VOL",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Kayky",p:"FW",q:"PD",a:23,o:77,t:82,v:5000000,nat:"Brazil"},{n:"Alerrandro",p:"FW",q:"CA",a:26,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Anthoni",p:"GK",q:"GOL",a:24,o:76,t:79,v:3000000,nat:"Brazil"},{n:"Matheus Cunha",p:"GK",q:"GOL",a:25,o:76,t:79,v:3000000,nat:"Brazil"},{n:"Calebe",p:"MF",q:"MEI",a:26,o:76,t:77,v:1800000,nat:"Brazil"},{n:"Félix Torres",p:"DF",q:"ZAG",a:29,o:75,t:76,v:1000000,nat:"Ecuador"},{n:"Juninho",p:"DF",q:"ZAG",a:31,o:75,t:75,v:700000,nat:"Brazil"},{n:"Richard",p:"MF",q:"VOL",a:32,o:75,t:75,v:500000,nat:"Brazil"},{n:"Paulinho Paula",p:"MF",q:"MC",a:29,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Clayton",p:"DF",q:"ZAG",a:26,o:74,t:75,v:700000,nat:"Brazil"},{n:"Bruno Henrique",p:"MF",q:"MC",a:36,o:74,t:74,v:300000,nat:"Brazil"},{n:"Allex",p:"MF",q:"MEI",a:20,o:73,t:81,v:1000000,nat:"Brazil"},{n:"Gabriel Mercado",p:"DF",q:"ZAG",a:39,o:72,t:72,v:100000,nat:"Argentina"},{n:"Kauan",p:"GK",q:"GOL",a:23,o:71,t:75,v:200000,nat:"Brazil"},{n:"Raykkonen",p:"FW",q:"CA",a:18,o:71,t:83,v:1000000,nat:"Brazil"},{n:"Diego Esser",p:"GK",q:"GOL",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Benjamin",p:"MF",q:"VOL",a:20,o:70,t:78,v:200000,nat:"Ghana"},{n:"Yago Noal",p:"MF",q:"MEI",a:19,o:69,t:79,v:500000,nat:"Brazil"}],
  "Corinthians":[{n:"Breno Bidon",p:"MF",q:"MC",a:21,o:82,t:92,v:22000000,nat:"Brazil"},{n:"Yuri Alberto",p:"FW",q:"CA",a:25,o:82,t:87,v:23000000,nat:"Brazil"},{n:"Memphis Depay",p:"FW",q:"CA",a:32,o:81,t:82,v:7000000,nat:"Netherlands"},{n:"Hugo Souza",p:"GK",q:"GOL",a:27,o:80,t:83,v:11000000,nat:"Brazil"},{n:"Rodrigo Garro",p:"MF",q:"MEI",a:28,o:80,t:83,v:12000000,nat:"Argentina"},{n:"Matheus Bidu",p:"DF",q:"LE",a:27,o:79,t:81,v:7000000,nat:"Brazil"},{n:"Matheuzinho",p:"DF",q:"LD",a:25,o:79,t:83,v:8000000,nat:"Brazil"},{n:"André",p:"MF",q:"MC",a:20,o:79,t:90,v:16000000,nat:"Brazil"},{n:"Jesse Lingard",p:"MF",q:"MEI",a:33,o:79,t:79,v:2000000,nat:"England"},{n:"Raniele",p:"MF",q:"VOL",a:29,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Tchoca",p:"DF",q:"ZAG",a:22,o:77,t:84,v:4000000,nat:"Brazil"},{n:"Allan",p:"MF",q:"VOL",a:29,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Matheus Pereira",p:"MF",q:"MC",a:28,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Kaio César",p:"FW",q:"PD",a:22,o:77,t:84,v:4000000,nat:"Brazil"},{n:"Pedro Raul",p:"FW",q:"CA",a:29,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Charles",p:"MF",q:"VOL",a:30,o:76,t:76,v:900000,nat:"Brazil"},{n:"Alex Santana",p:"MF",q:"MC",a:31,o:76,t:76,v:1000000,nat:"Brazil"},{n:"André Carrillo",p:"MF",q:"MC",a:35,o:76,t:76,v:800000,nat:"Peru"},{n:"André Ramalho",p:"DF",q:"ZAG",a:34,o:75,t:75,v:800000,nat:"Brazil"},{n:"Gabriel Paulista",p:"DF",q:"ZAG",a:35,o:75,t:75,v:500000,nat:"Brazil"},{n:"Léo Mana",p:"DF",q:"LD",a:22,o:75,t:81,v:500000,nat:"Brazil"},{n:"Kayke",p:"FW",q:"PE",a:22,o:75,t:81,v:1500000,nat:"Brazil"},{n:"Gui Negão",p:"FW",q:"CA",a:19,o:75,t:86,v:7000000,nat:"Brazil"},{n:"Gustavo Henrique",p:"DF",q:"ZAG",a:33,o:74,t:74,v:700000,nat:"Brazil"},{n:"Hugo",p:"DF",q:"LE",a:28,o:74,t:75,v:700000,nat:"Brazil"},{n:"Fabrizio Angileri",p:"DF",q:"LE",a:32,o:74,t:74,v:400000,nat:"Argentina"},{n:"Pedro Milans",p:"DF",q:"LD",a:24,o:74,t:76,v:1500000,nat:"Uruguay"},{n:"Dieguinho",p:"FW",q:"PD",a:18,o:74,t:87,v:4000000,nat:"Brazil"},{n:"Zakaria Labyad",p:"MF",q:"MEI",a:33,o:73,t:73,v:400000,nat:"Brazil"},{n:"Vitinho",p:"FW",q:"PE",a:32,o:73,t:73,v:800000,nat:"Brazil"},{n:"Felipe Longo",p:"GK",q:"GOL",a:21,o:71,t:78,v:500000,nat:"Brazil"},{n:"Kauê",p:"GK",q:"GOL",a:22,o:71,t:77,v:300000,nat:"Brazil"},{n:"Renato Santos",p:"DF",q:"ZAG",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Bahia",p:"MF",q:"MC",a:20,o:70,t:78,v:200000,nat:"Brazil"}],
  "Red Bull Bragantino":[{n:"Juninho Capixaba",p:"DF",q:"LE",a:29,o:80,t:83,v:8000000,nat:"Brazil"},{n:"Pedro Henrique",p:"DF",q:"ZAG",a:30,o:79,t:80,v:3500000,nat:"Brazil"},{n:"Isidro Pitta",p:"FW",q:"CA",a:26,o:79,t:81,v:7500000,nat:"Paraguay"},{n:"Cleiton",p:"GK",q:"GOL",a:28,o:78,t:80,v:5000000,nat:"Brazil"},{n:"Guzmán Rodríguez",p:"DF",q:"ZAG",a:26,o:78,t:80,v:3500000,nat:"Uruguay"},{n:"Agustín Sant'Anna",p:"DF",q:"LD",a:28,o:78,t:80,v:3500000,nat:"Uruguay"},{n:"Rodriguinho",p:"MF",q:"MEI",a:22,o:78,t:85,v:6000000,nat:"Brazil"},{n:"Lucas Barbosa",p:"FW",q:"PD",a:25,o:78,t:81,v:6000000,nat:"Brazil"},{n:"Tiago Volpi",p:"GK",q:"GOL",a:35,o:77,t:77,v:900000,nat:"Brazil"},{n:"Gustavo Marques",p:"DF",q:"ZAG",a:24,o:77,t:80,v:5000000,nat:"Brazil"},{n:"Alix",p:"DF",q:"ZAG",a:26,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Fabinho",p:"MF",q:"VOL",a:24,o:77,t:80,v:5000000,nat:"Brazil"},{n:"Gabriel",p:"MF",q:"VOL",a:34,o:77,t:77,v:900000,nat:"Brazil"},{n:"Ignacio Sosa",p:"MF",q:"MC",a:22,o:77,t:84,v:5000000,nat:"Uruguay"},{n:"Eric Ramires",p:"MF",q:"MC",a:25,o:77,t:80,v:3500000,nat:"Brazil"},{n:"Gustavo Neves",p:"MF",q:"MC",a:22,o:77,t:84,v:3500000,nat:"Brazil"},{n:"Vinicinho",p:"FW",q:"PE",a:22,o:77,t:84,v:3500000,nat:"Brazil"},{n:"Henry Mosquera",p:"FW",q:"PE",a:24,o:77,t:80,v:3500000,nat:"Colombia"},{n:"Eduardo Sasha",p:"FW",q:"CA",a:34,o:77,t:77,v:800000,nat:"Brazil"},{n:"Vanderlan",p:"DF",q:"LE",a:23,o:76,t:81,v:3000000,nat:"Brazil"},{n:"José Andrés Hurtado",p:"DF",q:"LD",a:24,o:76,t:79,v:3000000,nat:"Ecuador"},{n:"José Herrera",p:"FW",q:"PD",a:23,o:76,t:80,v:2500000,nat:"Argentina"},{n:"Fernando",p:"FW",q:"CA",a:27,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Matheus Fernandes",p:"MF",q:"VOL",a:28,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Ignacio Laquintana",p:"FW",q:"PD",a:27,o:75,t:76,v:1000000,nat:"Uruguay"},{n:"Eduardo",p:"DF",q:"ZAG",a:28,o:74,t:75,v:750000,nat:"Brazil"},{n:"Praxedes",p:"MF",q:"MC",a:24,o:74,t:76,v:1200000,nat:"Brazil"},{n:"Bruninho",p:"MF",q:"MEI",a:23,o:74,t:78,v:1000000,nat:"Brazil"},{n:"Gabriel Novaes",p:"FW",q:"CA",a:27,o:74,t:75,v:600000,nat:"Brazil"},{n:"Fernando Costa",p:"GK",q:"GOL",a:22,o:71,t:77,v:200000,nat:"Brazil"},{n:"Ryan Augusto",p:"DF",q:"LD",a:18,o:71,t:83,v:1000000,nat:"Brazil"},{n:"João Neto",p:"MF",q:"MC",a:23,o:71,t:75,v:200000,nat:"Brazil"},{n:"Marcelinho Braz",p:"MF",q:"MEI",a:21,o:71,t:78,v:400000,nat:"Brazil"},{n:"Davi Gomes",p:"FW",q:"PE",a:21,o:71,t:78,v:400000,nat:"Brazil"},{n:"Kawê",p:"FW",q:"PD",a:24,o:71,t:73,v:300000,nat:"Brazil"},{n:"Fabrício",p:"GK",q:"GOL",a:26,o:70,t:71,v:100000,nat:"Brazil"},{n:"Gustavo Reis",p:"GK",q:"GOL",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Cauê Nascimento",p:"DF",q:"LE",a:19,o:69,t:79,v:500000,nat:"Brazil"}],
  "Grêmio":[{n:"Francis Amuzu",p:"FW",q:"PE",a:26,o:80,t:83,v:9000000,nat:"Ghana"},{n:"Tetê",p:"FW",q:"PD",a:26,o:80,t:83,v:9000000,nat:"Brazil"},{n:"Carlos Vinícius",p:"FW",q:"CA",a:31,o:80,t:81,v:7000000,nat:"Brazil"},{n:"Juan Nardoni",p:"MF",q:"MC",a:24,o:79,t:83,v:9000000,nat:"Argentina"},{n:"Marlon",p:"DF",q:"LE",a:29,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Leonel Pérez",p:"MF",q:"VOL",a:22,o:78,t:85,v:6000000,nat:"Argentina"},{n:"Mathías Villasanti",p:"MF",q:"VOL",a:29,o:78,t:80,v:4000000,nat:"Paraguay"},{n:"Gustavo Martins",p:"DF",q:"ZAG",a:23,o:77,t:82,v:4000000,nat:"Brazil"},{n:"Wagner Leonardo",p:"DF",q:"ZAG",a:27,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Fabián Balbuena",p:"DF",q:"ZAG",a:34,o:77,t:77,v:900000,nat:"Paraguay"},{n:"Caio Paulista",p:"DF",q:"LE",a:28,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Cristian Pavón",p:"DF",q:"LD",a:30,o:77,t:77,v:1700000,nat:"Argentina"},{n:"Erick Noriega",p:"MF",q:"VOL",a:24,o:77,t:80,v:5000000,nat:"Peru"},{n:"Filip Krovinovic",p:"MF",q:"VOL",a:30,o:77,t:77,v:1500000,nat:"Croatia"},{n:"Gabriel Mec",p:"MF",q:"MEI",a:18,o:77,t:92,v:16000000,nat:"Brazil"},{n:"Miguel Monsalve",p:"MF",q:"MEI",a:22,o:77,t:84,v:3500000,nat:"Colombia"},{n:"José Enamorado",p:"FW",q:"PD",a:27,o:77,t:79,v:3000000,nat:"Colombia"},{n:"Martin Braithwaite",p:"FW",q:"CA",a:35,o:77,t:77,v:1000000,nat:"Denmark"},{n:"Gabriel Grando",p:"GK",q:"GOL",a:26,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Weverton",p:"GK",q:"GOL",a:38,o:76,t:76,v:700000,nat:"Brazil"},{n:"João Pedro",p:"DF",q:"LD",a:29,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Matheus Nascimento",p:"FW",q:"CA",a:22,o:76,t:82,v:2000000,nat:"Brazil"},{n:"Walter Kannemann",p:"DF",q:"ZAG",a:35,o:75,t:75,v:350000,nat:"Argentina"},{n:"Dodi",p:"MF",q:"VOL",a:30,o:75,t:75,v:700000,nat:"Brazil"},{n:"Jovane Cabral",p:"FW",q:"PE",a:28,o:75,t:76,v:1000000,nat:"Cape Verde"},{n:"Willian",p:"FW",q:"PE",a:38,o:75,t:75,v:400000,nat:"Brazil"},{n:"Diego Caito",p:"DF",q:"LD",a:22,o:74,t:80,v:800000,nat:"Brazil"},{n:"Marcos Rocha",p:"DF",q:"LD",a:37,o:74,t:74,v:200000,nat:"Brazil"},{n:"Pedro Gabriel",p:"DF",q:"LE",a:19,o:73,t:83,v:2000000,nat:"Brazil"},{n:"Riquelme",p:"MF",q:"MEI",a:19,o:73,t:83,v:2000000,nat:"Brazil"},{n:"Thiago Beltrame",p:"GK",q:"GOL",a:23,o:71,t:75,v:200000,nat:"Brazil"},{n:"Wallace",p:"DF",q:"ZAG",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Tiaguinho",p:"MF",q:"MC",a:18,o:69,t:81,v:500000,nat:"Brazil"},{n:"Roger",p:"FW",q:"PD",a:18,o:69,t:81,v:400000,nat:"Brazil"},{n:"Gabriel Menegon",p:"GK",q:"GOL",a:17,o:68,t:80,v:200000,nat:"Brazil"},{n:"Luis Eduardo",p:"DF",q:"ZAG",a:18,o:68,t:80,v:200000,nat:"Brazil"}],
  "Vasco da Gama":[{n:"Léo Jardim",p:"GK",q:"GOL",a:31,o:80,t:81,v:7000000,nat:"Brazil"},{n:"Carlos Cuesta",p:"DF",q:"ZAG",a:27,o:80,t:83,v:8000000,nat:"Colombia"},{n:"Paulo Henrique",p:"DF",q:"LD",a:30,o:80,t:81,v:6000000,nat:"Brazil"},{n:"Robert Renan",p:"DF",q:"ZAG",a:22,o:79,t:87,v:10000000,nat:"Brazil"},{n:"Cuiabano",p:"DF",q:"LE",a:23,o:79,t:85,v:10000000,nat:"Brazil"},{n:"Andrés Gómez",p:"FW",q:"PE",a:23,o:79,t:85,v:11000000,nat:"Colombia"},{n:"Nuno Moreira",p:"FW",q:"PD",a:27,o:79,t:81,v:7000000,nat:"Portugal"},{n:"Lucas Piton",p:"DF",q:"LE",a:25,o:78,t:81,v:6000000,nat:"Italy"},{n:"Thiago Mendes",p:"MF",q:"VOL",a:34,o:78,t:78,v:1300000,nat:"Brazil"},{n:"Facundo Colidio",p:"FW",q:"CA",a:26,o:78,t:80,v:5000000,nat:"Argentina"},{n:"Brenner",p:"FW",q:"CA",a:26,o:78,t:80,v:4000000,nat:"Brazil"},{n:"Cauan Barros",p:"MF",q:"VOL",a:22,o:77,t:84,v:5000000,nat:"Brazil"},{n:"Tchê Tchê",p:"MF",q:"MC",a:33,o:77,t:77,v:800000,nat:"Brazil"},{n:"Johan Rojas",p:"MF",q:"MEI",a:23,o:77,t:82,v:3800000,nat:"Colombia"},{n:"David",p:"FW",q:"PE",a:30,o:77,t:77,v:1500000,nat:"Brazil"},{n:"Marino Hinestroza",p:"FW",q:"PD",a:24,o:77,t:80,v:4800000,nat:"Colombia"},{n:"Claudio Spinelli",p:"FW",q:"CA",a:29,o:77,t:79,v:3000000,nat:"Argentina"},{n:"José Luis Rodríguez",p:"DF",q:"LD",a:29,o:76,t:77,v:1500000,nat:"Uruguay"},{n:"Jair",p:"MF",q:"VOL",a:31,o:76,t:76,v:800000,nat:"Brazil"},{n:"Adson",p:"FW",q:"PD",a:25,o:76,t:78,v:2500000,nat:"Brazil"},{n:"Daniel Fuzato",p:"GK",q:"GOL",a:29,o:75,t:76,v:900000,nat:"Brazil"},{n:"JP",p:"MF",q:"MC",a:21,o:75,t:82,v:2000000,nat:"Brazil"},{n:"Loide Augusto",p:"FW",q:"PD",a:26,o:75,t:76,v:1200000,nat:"Cape Verde"},{n:"Alan Saldivia",p:"DF",q:"ZAG",a:24,o:74,t:76,v:1200000,nat:"Uruguay"},{n:"Lucas Freitas",p:"DF",q:"ZAG",a:25,o:74,t:76,v:1000000,nat:"Brazil"},{n:"Mateus Carvalho",p:"MF",q:"VOL",a:24,o:74,t:76,v:1200000,nat:"Brazil"},{n:"Riquelme",p:"DF",q:"LE",a:23,o:73,t:77,v:700000,nat:"Brazil"},{n:"Paulinho",p:"DF",q:"LE",a:22,o:73,t:79,v:600000,nat:"Brazil"},{n:"Guilherme Estrella",p:"MF",q:"MEI",a:21,o:73,t:80,v:1000000,nat:"Brazil"},{n:"Walace Falcão",p:"DF",q:"ZAG",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"JV Fonseca",p:"DF",q:"LD",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Lukas Zuccarello",p:"MF",q:"MEI",a:19,o:69,t:79,v:400000,nat:"Brazil"},{n:"Pablo",p:"GK",q:"GOL",a:23,o:67,t:71,v:50000,nat:"Brazil"}],
  "Santos":[{n:"Neymar",p:"MF",q:"MEI",a:34,o:82,t:84,v:8000000,nat:"Brazil"},{n:"Benjamín Rollheiser",p:"FW",q:"PD",a:26,o:80,t:83,v:9000000,nat:"Argentina"},{n:"Gabriel Brazão",p:"GK",q:"GOL",a:25,o:79,t:83,v:12000000,nat:"Brazil"},{n:"Lucas Veríssimo",p:"DF",q:"ZAG",a:31,o:79,t:80,v:4500000,nat:"Brazil"},{n:"Rony",p:"FW",q:"CA",a:31,o:79,t:80,v:4500000,nat:"Brazil"},{n:"João Paulo",p:"GK",q:"GOL",a:31,o:78,t:78,v:2000000,nat:"Brazil"},{n:"Mayke",p:"DF",q:"LD",a:33,o:78,t:78,v:1500000,nat:"Brazil"},{n:"Gabriel Bontempo",p:"MF",q:"MC",a:21,o:78,t:87,v:9000000,nat:"Brazil"},{n:"Gabriel Menino",p:"MF",q:"MC",a:25,o:78,t:81,v:7000000,nat:"Brazil"},{n:"Álvaro Barreal",p:"FW",q:"PE",a:25,o:78,t:81,v:7000000,nat:"Argentina"},{n:"Adonis Frías",p:"DF",q:"ZAG",a:28,o:77,t:79,v:3000000,nat:"Argentina"},{n:"Igor Vinícius",p:"DF",q:"LD",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Christian Oliva",p:"MF",q:"VOL",a:30,o:77,t:77,v:1400000,nat:"Uruguay"},{n:"Willian Arão",p:"MF",q:"VOL",a:34,o:77,t:77,v:800000,nat:"Brazil"},{n:"Miguelito",p:"MF",q:"MEI",a:22,o:77,t:84,v:5000000,nat:"Peru"},{n:"Moisés",p:"FW",q:"PE",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Gabriel Barbosa",p:"FW",q:"CA",a:29,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Alexis Duarte",p:"DF",q:"ZAG",a:26,o:76,t:77,v:1800000,nat:"Paraguay"},{n:"Luan Peres",p:"DF",q:"ZAG",a:32,o:76,t:76,v:700000,nat:"Brazil"},{n:"João Schmidt",p:"MF",q:"VOL",a:33,o:76,t:76,v:700000,nat:"Brazil"},{n:"Thaciano",p:"MF",q:"MEI",a:31,o:76,t:76,v:1000000,nat:"Brazil"},{n:"Gonzalo Escobar",p:"DF",q:"LE",a:29,o:75,t:76,v:800000,nat:"Argentina"},{n:"Vinicius Lira",p:"DF",q:"LE",a:18,o:74,t:87,v:4000000,nat:"Brazil"},{n:"Gustavo Caballero",p:"FW",q:"PE",a:24,o:74,t:76,v:1000000,nat:"Paraguay"},{n:"Robinho Junior",p:"FW",q:"PD",a:18,o:74,t:87,v:5000000,nat:"Brazil"},{n:"Alex",p:"DF",q:"ZAG",a:27,o:73,t:74,v:400000,nat:"Brazil"},{n:"Diógenes",p:"GK",q:"GOL",a:25,o:71,t:73,v:200000,nat:"Brazil"},{n:"Gustavinho",p:"MF",q:"VOL",a:21,o:71,t:78,v:500000,nat:"Brazil"},{n:"Rodrigo Falcão",p:"GK",q:"GOL",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Enzo Boer",p:"FW",q:"PD",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"João Ananias",p:"DF",q:"ZAG",a:19,o:69,t:79,v:500000,nat:"Brazil"},{n:"Mateus Xavier",p:"FW",q:"PE",a:19,o:69,t:79,v:400000,nat:"Brazil"},{n:"João Alencar",p:"DF",q:"ZAG",a:19,o:68,t:78,v:200000,nat:"Brazil"},{n:"Pepê Fermino",p:"MF",q:"MEI",a:19,o:68,t:78,v:200000,nat:"Brazil"}],
  "Mirassol":[{n:"Neto Moura",p:"MF",q:"VOL",a:30,o:78,t:78,v:2000000,nat:"Brazil"},{n:"Antonio Galeano",p:"FW",q:"PD",a:26,o:78,t:80,v:3500000,nat:"Paraguay"},{n:"Willian Machado",p:"DF",q:"ZAG",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Igor Formiga",p:"DF",q:"LD",a:27,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Alesson",p:"FW",q:"PE",a:27,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Negueba",p:"FW",q:"PD",a:26,o:77,t:79,v:3000000,nat:"Brazil"},{n:"André Luis",p:"FW",q:"CA",a:32,o:77,t:77,v:1000000,nat:"Brazil"},{n:"João Victor",p:"DF",q:"ZAG",a:28,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Lucas Oliveira",p:"DF",q:"ZAG",a:30,o:76,t:76,v:1000000,nat:"Brazil"},{n:"Denilson",p:"MF",q:"MC",a:25,o:76,t:78,v:2000000,nat:"Brazil"},{n:"José Aldo",p:"MF",q:"MC",a:28,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Eduardo",p:"MF",q:"MEI",a:36,o:76,t:76,v:600000,nat:"Brazil"},{n:"Edson Carioca",p:"FW",q:"CA",a:29,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Reinaldo",p:"DF",q:"LE",a:36,o:75,t:75,v:350000,nat:"Brazil"},{n:"Wallisson",p:"MF",q:"VOL",a:28,o:75,t:76,v:900000,nat:"Brazil"},{n:"Shaylon",p:"MF",q:"MEI",a:29,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Gustavo Silva",p:"FW",q:"PD",a:28,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Thomazella",p:"GK",q:"GOL",a:35,o:74,t:74,v:200000,nat:"Brazil"},{n:"Victor Luís",p:"DF",q:"LE",a:33,o:74,t:74,v:300000,nat:"Brazil"},{n:"Elias",p:"DF",q:"LD",a:27,o:74,t:75,v:550000,nat:"Brazil"},{n:"Daniel Borges",p:"DF",q:"LD",a:33,o:74,t:74,v:300000,nat:"Brazil"},{n:"Gustavo Cazonatti",p:"MF",q:"VOL",a:30,o:74,t:74,v:450000,nat:"Brazil"},{n:"Japa",p:"MF",q:"MC",a:22,o:74,t:80,v:1000000,nat:"Brazil"},{n:"Fernandinho",p:"FW",q:"PE",a:29,o:74,t:75,v:600000,nat:"Brazil"},{n:"Walter",p:"GK",q:"GOL",a:38,o:73,t:73,v:150000,nat:"Brazil"},{n:"Gabriel",p:"DF",q:"ZAG",a:22,o:73,t:79,v:700000,nat:"Brazil"},{n:"Chico Kim",p:"MF",q:"MEI",a:35,o:73,t:73,v:150000,nat:"Brazil"},{n:"Carlos Eduardo",p:"FW",q:"PD",a:29,o:73,t:74,v:500000,nat:"Brazil"},{n:"Bruno Santos",p:"FW",q:"CA",a:29,o:72,t:73,v:200000,nat:"Brazil"},{n:"Alex Muralha",p:"GK",q:"GOL",a:36,o:71,t:71,v:75000,nat:"Brazil"},{n:"Georgemy",p:"GK",q:"GOL",a:30,o:69,t:69,v:50000,nat:"Brazil"},{n:"Wesley Santos",p:"DF",q:"LD",a:22,o:69,t:75,v:100000,nat:"Brazil"},{n:"Luiz Filipe",p:"FW",q:"PD",a:25,o:69,t:71,v:100000,nat:"Brazil"}],
  "Vitória":[{n:"Tomás Pochettino",p:"MF",q:"MEI",a:30,o:79,t:80,v:3500000,nat:"Argentina"},{n:"Walace",p:"MF",q:"VOL",a:31,o:78,t:78,v:2500000,nat:"Brazil"},{n:"Lucas Arcanjo",p:"GK",q:"GOL",a:28,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Baralhas",p:"MF",q:"VOL",a:27,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Matheuzinho",p:"MF",q:"MEI",a:28,o:77,t:79,v:3000000,nat:"Brazil"},{n:"Emmanuel Martínez",p:"MF",q:"MEI",a:32,o:77,t:77,v:1200000,nat:"Argentina"},{n:"Erick",p:"FW",q:"PD",a:28,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Riccieli",p:"DF",q:"ZAG",a:27,o:76,t:77,v:1800000,nat:"Brazil"},{n:"Cacá",p:"DF",q:"ZAG",a:27,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Luan Cândido",p:"DF",q:"LE",a:25,o:76,t:79,v:3000000,nat:"Brazil"},{n:"Ramon",p:"DF",q:"LE",a:25,o:76,t:78,v:2000000,nat:"Brazil"},{n:"Fabiano",p:"DF",q:"LD",a:26,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Diego Tarzia",p:"FW",q:"PE",a:23,o:76,t:80,v:2000000,nat:"Argentina"},{n:"Renato Kayzer",p:"FW",q:"CA",a:30,o:76,t:76,v:1000000,nat:"Brazil"},{n:"Gabriel",p:"GK",q:"GOL",a:33,o:75,t:75,v:450000,nat:"Brazil"},{n:"Zé Marcos",p:"DF",q:"ZAG",a:28,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Edu Ribeiro",p:"DF",q:"ZAG",a:26,o:75,t:76,v:800000,nat:"Brazil"},{n:"Emanuel Brítez",p:"DF",q:"ZAG",a:34,o:75,t:75,v:500000,nat:"Argentina"},{n:"Jamerson",p:"DF",q:"LE",a:27,o:75,t:76,v:800000,nat:"Brazil"},{n:"Nathan Mendes",p:"DF",q:"LD",a:23,o:75,t:79,v:1500000,nat:"Brazil"},{n:"Mateus Silva",p:"DF",q:"LD",a:27,o:75,t:76,v:800000,nat:"Brazil"},{n:"Rúben Ismael",p:"MF",q:"VOL",a:27,o:75,t:76,v:1200000,nat:"Portugal"},{n:"Lucas Braga",p:"FW",q:"PE",a:29,o:75,t:76,v:900000,nat:"Brazil"},{n:"Camutanga",p:"DF",q:"ZAG",a:32,o:74,t:74,v:250000,nat:"Brazil"},{n:"Dudu",p:"MF",q:"VOL",a:27,o:74,t:75,v:600000,nat:"Brazil"},{n:"Caíque Gonçalves",p:"MF",q:"VOL",a:30,o:74,t:74,v:500000,nat:"Brazil"},{n:"Renê",p:"FW",q:"PE",a:22,o:74,t:80,v:1000000,nat:"Brazil"},{n:"Lucas Silva",p:"FW",q:"PD",a:26,o:74,t:75,v:700000,nat:"Brazil"},{n:"Marinho",p:"FW",q:"PD",a:36,o:74,t:74,v:200000,nat:"Brazil"},{n:"Fabri",p:"FW",q:"CA",a:25,o:74,t:76,v:900000,nat:"Brazil"},{n:"Zé Vitor",p:"MF",q:"MC",a:26,o:73,t:74,v:500000,nat:"Brazil"},{n:"Yuri Sena",p:"GK",q:"GOL",a:25,o:71,t:73,v:200000,nat:"Brazil"},{n:"Anderson Pato",p:"FW",q:"PE",a:23,o:71,t:75,v:250000,nat:"Brazil"},{n:"Osvaldo",p:"FW",q:"PD",a:39,o:71,t:71,v:75000,nat:"Brazil"},{n:"Fintelman",p:"GK",q:"GOL",a:25,o:69,t:71,v:100000,nat:"Brazil"}],
  "Athletico Paranaense":[{n:"Kevin Viveros",p:"FW",q:"CA",a:26,o:80,t:83,v:10000000,nat:"Colombia"},{n:"Gastón Benavídez",p:"DF",q:"LD",a:30,o:79,t:80,v:3500000,nat:"Argentina"},{n:"Gilberto",p:"DF",q:"LD",a:33,o:79,t:79,v:2200000,nat:"Brazil"},{n:"Lucas Esquivel",p:"DF",q:"LE",a:24,o:78,t:81,v:7000000,nat:"Argentina"},{n:"Juan Portilla",p:"MF",q:"MC",a:27,o:78,t:80,v:5000000,nat:"Colombia"},{n:"Jádson",p:"MF",q:"MC",a:32,o:77,t:77,v:1000000,nat:"Brazil"},{n:"Bruno Zapelli",p:"MF",q:"MEI",a:24,o:77,t:80,v:4500000,nat:"Argentina"},{n:"Kerwin Vargas",p:"FW",q:"PD",a:24,o:77,t:80,v:3500000,nat:"Colombia"},{n:"Mycael",p:"GK",q:"GOL",a:22,o:76,t:82,v:2000000,nat:"Brazil"},{n:"Carlos Terán",p:"DF",q:"ZAG",a:25,o:76,t:78,v:2000000,nat:"Colombia"},{n:"Juan Felipe Aguirre",p:"DF",q:"ZAG",a:29,o:76,t:77,v:1500000,nat:"Colombia"},{n:"Léo",p:"DF",q:"ZAG",a:30,o:76,t:76,v:1200000,nat:"Brazil"},{n:"Dudu",p:"MF",q:"MEI",a:20,o:76,t:85,v:5000000,nat:"Brazil"},{n:"Stiven Mendoza",p:"FW",q:"PE",a:34,o:76,t:76,v:600000,nat:"Colombia"},{n:"Jorge Rivaldo",p:"FW",q:"CA",a:22,o:76,t:82,v:2000000,nat:"Colombia"},{n:"Renan Peixoto",p:"FW",q:"CA",a:26,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Santos",p:"GK",q:"GOL",a:36,o:75,t:75,v:400000,nat:"Brazil"},{n:"Léo Derik",p:"DF",q:"LE",a:21,o:75,t:82,v:2500000,nat:"Brazil"},{n:"Gilberto Junior",p:"DF",q:"LD",a:21,o:75,t:82,v:2000000,nat:"Brazil"},{n:"João Cruz",p:"MF",q:"MC",a:20,o:75,t:83,v:2000000,nat:"Brazil"},{n:"Chiqueti",p:"MF",q:"MEI",a:20,o:75,t:84,v:3000000,nat:"Brazil"},{n:"Bruninho",p:"FW",q:"PD",a:17,o:75,t:88,v:7000000,nat:"Brazil"},{n:"Luiz Gustavo",p:"MF",q:"VOL",a:39,o:74,t:74,v:200000,nat:"Brazil"},{n:"Felipinho",p:"MF",q:"MC",a:24,o:74,t:76,v:1000000,nat:"Brazil"},{n:"Isaac",p:"FW",q:"PE",a:22,o:74,t:80,v:1200000,nat:"Brazil"},{n:"Leozinho",p:"FW",q:"PD",a:27,o:74,t:75,v:750000,nat:"Brazil"},{n:"Arthur Dias",p:"DF",q:"ZAG",a:19,o:73,t:84,v:3000000,nat:"Brazil"},{n:"Dantas",p:"DF",q:"ZAG",a:22,o:73,t:79,v:700000,nat:"Brazil"},{n:"Alejandro García",p:"MF",q:"MC",a:25,o:73,t:75,v:700000,nat:"Colombia"},{n:"Daniel Aguilar",p:"FW",q:"PE",a:22,o:71,t:77,v:200000,nat:"Colombia"},{n:"Renan Viana",p:"FW",q:"CA",a:23,o:71,t:75,v:225000,nat:"Brazil"},{n:"Matheus Soares",p:"GK",q:"GOL",a:21,o:70,t:77,v:200000,nat:"Brazil"}],
  "Coritiba":[{n:"Breno Lopes",p:"FW",q:"PE",a:30,o:78,t:79,v:3000000,nat:"Brazil"},{n:"Pedro Morisco",p:"GK",q:"GOL",a:22,o:77,t:84,v:5000000,nat:"Brazil"},{n:"Jacy",p:"DF",q:"ZAG",a:29,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Felipe Jonatan",p:"DF",q:"LE",a:28,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Sebastián Gómez",p:"MF",q:"MC",a:30,o:77,t:77,v:1800000,nat:"Colombia"},{n:"Fernando Sobral",p:"MF",q:"MC",a:31,o:77,t:77,v:1500000,nat:"Brazil"},{n:"Lucas Ronier",p:"FW",q:"PD",a:21,o:77,t:85,v:6000000,nat:"Brazil"},{n:"Pedro Rocha",p:"FW",q:"CA",a:31,o:77,t:77,v:1500000,nat:"Brazil"},{n:"JP Chermont",p:"DF",q:"LD",a:20,o:76,t:85,v:4000000,nat:"Brazil"},{n:"Joaquín Lavega",p:"FW",q:"PE",a:21,o:76,t:84,v:4000000,nat:"Uruguay"},{n:"Pedro Rangel",p:"GK",q:"GOL",a:26,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Tiago Cóser",p:"DF",q:"ZAG",a:22,o:75,t:81,v:1500000,nat:"Brazil"},{n:"Tinga",p:"DF",q:"LD",a:32,o:75,t:75,v:450000,nat:"Brazil"},{n:"Josué",p:"MF",q:"MEI",a:35,o:75,t:75,v:350000,nat:"Portugal"},{n:"Brian Ocampo",p:"FW",q:"PE",a:27,o:75,t:76,v:1000000,nat:"Uruguay"},{n:"Fabinho",p:"FW",q:"PD",a:26,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Bruno Melo",p:"DF",q:"LE",a:33,o:74,t:74,v:250000,nat:"Brazil"},{n:"Vini Paulista",p:"MF",q:"VOL",a:25,o:74,t:76,v:1000000,nat:"Brazil"},{n:"Keno",p:"FW",q:"PE",a:36,o:74,t:74,v:300000,nat:"Brazil"},{n:"Renato Marques",p:"FW",q:"CA",a:22,o:74,t:80,v:1000000,nat:"Brazil"},{n:"Rodrigo Rodrigues",p:"FW",q:"CA",a:30,o:74,t:74,v:500000,nat:"Brazil"},{n:"Keiller",p:"GK",q:"GOL",a:29,o:73,t:74,v:500000,nat:"Brazil"},{n:"Maicon",p:"DF",q:"ZAG",a:37,o:72,t:72,v:100000,nat:"Brazil"},{n:"Rodrigo Moledo",p:"DF",q:"ZAG",a:38,o:72,t:72,v:100000,nat:"Brazil"},{n:"Thiago Santos",p:"DF",q:"ZAG",a:36,o:72,t:72,v:100000,nat:"Brazil"},{n:"Gustavo",p:"MF",q:"MEI",a:23,o:72,t:76,v:500000,nat:"Brazil"},{n:"João Almeida",p:"DF",q:"LE",a:20,o:71,t:79,v:400000,nat:"Brazil"},{n:"Éberth",p:"FW",q:"CA",a:23,o:71,t:75,v:250000,nat:"Brazil"},{n:"Benassi",p:"GK",q:"GOL",a:22,o:67,t:73,v:50000,nat:"Brazil"}],
  "Remo":[{n:"Zé Ivaldo",p:"DF",q:"ZAG",a:29,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Leonel Picco",p:"MF",q:"VOL",a:27,o:77,t:79,v:3000000,nat:"Argentina"},{n:"João Lucas",p:"DF",q:"LD",a:28,o:76,t:77,v:1500000,nat:"Brazil"},{n:"Zé Welison",p:"MF",q:"VOL",a:31,o:76,t:76,v:1000000,nat:"Brazil"},{n:"Patrick",p:"MF",q:"MC",a:34,o:76,t:76,v:600000,nat:"Brazil"},{n:"Vitor Bueno",p:"MF",q:"MEI",a:31,o:76,t:76,v:1000000,nat:"Brazil"},{n:"Yago Pikachu",p:"FW",q:"PD",a:34,o:76,t:76,v:600000,nat:"Brazil"},{n:"Gabriel Taliari",p:"FW",q:"CA",a:29,o:76,t:77,v:1800000,nat:"Brazil"},{n:"Ivan",p:"GK",q:"GOL",a:29,o:75,t:76,v:1000000,nat:"Brazil"},{n:"Tchamba",p:"DF",q:"ZAG",a:28,o:75,t:76,v:800000,nat:"Brazil"},{n:"Marllon",p:"DF",q:"ZAG",a:34,o:75,t:75,v:350000,nat:"Brazil"},{n:"Matheus Alexandre",p:"DF",q:"LD",a:27,o:75,t:76,v:900000,nat:"Brazil"},{n:"Jajá",p:"FW",q:"PE",a:27,o:75,t:76,v:800000,nat:"Brazil"},{n:"Alef Manga",p:"FW",q:"PE",a:31,o:75,t:75,v:600000,nat:"Brazil"},{n:"Matheus Felipe",p:"DF",q:"ZAG",a:27,o:74,t:75,v:650000,nat:"Brazil"},{n:"Cristian Tassano",p:"DF",q:"ZAG",a:30,o:74,t:74,v:350000,nat:"Uruguay"},{n:"Marcelinho",p:"DF",q:"LD",a:28,o:74,t:75,v:600000,nat:"Brazil"},{n:"Rafael Monti",p:"FW",q:"CA",a:26,o:74,t:75,v:600000,nat:"Argentina"},{n:"Léo Andrade",p:"DF",q:"ZAG",a:28,o:73,t:74,v:350000,nat:"Brazil"},{n:"Mayk",p:"DF",q:"LE",a:26,o:73,t:74,v:500000,nat:"Brazil"},{n:"David Braga",p:"MF",q:"VOL",a:24,o:73,t:75,v:650000,nat:"Brazil"},{n:"Edson Fernando",p:"MF",q:"VOL",a:28,o:73,t:74,v:500000,nat:"Brazil"},{n:"Zé Ricardo",p:"MF",q:"VOL",a:27,o:73,t:74,v:500000,nat:"Brazil"},{n:"Franco Catarozzi",p:"MF",q:"MC",a:26,o:73,t:74,v:350000,nat:"Uruguay"},{n:"Jáderson",p:"FW",q:"PE",a:25,o:73,t:75,v:750000,nat:"Brazil"},{n:"Gabriel Poveda",p:"FW",q:"CA",a:28,o:73,t:74,v:500000,nat:"Brazil"},{n:"Edson Kauã",p:"DF",q:"LE",a:22,o:71,t:77,v:200000,nat:"Brazil"},{n:"Guty",p:"MF",q:"MEI",a:23,o:71,t:75,v:200000,nat:"Brazil"},{n:"Marcelo Rangel",p:"GK",q:"GOL",a:38,o:70,t:70,v:50000,nat:"Brazil"},{n:"Ygor Vinhas",p:"GK",q:"GOL",a:32,o:70,t:70,v:50000,nat:"Brazil"},{n:"Caio Magalhães",p:"DF",q:"LD",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"Tico",p:"FW",q:"PD",a:19,o:68,t:78,v:200000,nat:"Brazil"},{n:"Eduardo Melo",p:"FW",q:"CA",a:25,o:68,t:70,v:75000,nat:"Brazil"}],
  "Chapecoense":[{n:"Carvalheira",p:"MF",q:"VOL",a:27,o:77,t:78,v:2500000,nat:"Brazil"},{n:"Camilo",p:"MF",q:"VOL",a:27,o:77,t:78,v:2000000,nat:"Brazil"},{n:"Doma",p:"DF",q:"ZAG",a:27,o:75,t:76,v:1200000,nat:"Brazil"},{n:"Maurício Garcez",p:"FW",q:"PE",a:29,o:75,t:76,v:800000,nat:"Brazil"},{n:"Kevin Ramírez",p:"FW",q:"PE",a:32,o:75,t:75,v:400000,nat:"Uruguay"},{n:"Marcinho",p:"FW",q:"PD",a:31,o:75,t:75,v:650000,nat:"Brazil"},{n:"Franco Rossi",p:"FW",q:"CA",a:24,o:75,t:77,v:1500000,nat:"Uruguay"},{n:"Neto Pessoa",p:"FW",q:"CA",a:32,o:75,t:75,v:350000,nat:"Brazil"},{n:"João Paulo",p:"DF",q:"ZAG",a:29,o:74,t:75,v:700000,nat:"Brazil"},{n:"Victor Caetano",p:"DF",q:"ZAG",a:28,o:74,t:75,v:700000,nat:"Brazil"},{n:"Bruno Leonardo",p:"DF",q:"ZAG",a:30,o:74,t:74,v:400000,nat:"Brazil"},{n:"Rafael Thyere",p:"DF",q:"ZAG",a:33,o:74,t:74,v:250000,nat:"Brazil"},{n:"Bruno Pacheco",p:"DF",q:"LE",a:34,o:74,t:74,v:250000,nat:"Brazil"},{n:"Robert Santos",p:"MF",q:"MEI",a:23,o:74,t:78,v:1000000,nat:"Brazil"},{n:"Ênio",p:"FW",q:"PE",a:25,o:74,t:76,v:800000,nat:"Brazil"},{n:"Bruno Tubarão",p:"FW",q:"PD",a:31,o:74,t:74,v:400000,nat:"Brazil"},{n:"Anderson",p:"GK",q:"GOL",a:28,o:73,t:74,v:450000,nat:"Brazil"},{n:"Fernando",p:"DF",q:"LE",a:26,o:73,t:74,v:400000,nat:"Brazil"},{n:"Everton",p:"DF",q:"LD",a:31,o:73,t:73,v:300000,nat:"Brazil"},{n:"Vinicius Balieiro",p:"MF",q:"VOL",a:27,o:73,t:74,v:400000,nat:"Brazil"},{n:"Bruno Matias",p:"MF",q:"MC",a:27,o:73,t:74,v:500000,nat:"Brazil"},{n:"Max",p:"MF",q:"MEI",a:25,o:73,t:75,v:600000,nat:"Brazil"},{n:"Giovanni Augusto",p:"MF",q:"MEI",a:36,o:73,t:73,v:150000,nat:"Brazil"},{n:"Yannick Bolasie",p:"FW",q:"CA",a:37,o:73,t:73,v:150000,nat:"Brazil"},{n:"Matheus Aurélio",p:"GK",q:"GOL",a:27,o:72,t:73,v:200000,nat:"Brazil"},{n:"Mancha",p:"DF",q:"LE",a:25,o:72,t:74,v:500000,nat:"Brazil"},{n:"Da Silva",p:"DF",q:"LE",a:26,o:72,t:73,v:200000,nat:"Brazil"},{n:"Rafael Santos",p:"GK",q:"GOL",a:37,o:71,t:71,v:75000,nat:"Brazil"},{n:"Gabriel Werner",p:"GK",q:"GOL",a:23,o:71,t:75,v:200000,nat:"Brazil"},{n:"Kauan Faria",p:"DF",q:"ZAG",a:23,o:71,t:75,v:200000,nat:"Brazil"},{n:"Gustavo Talles",p:"DF",q:"LD",a:23,o:71,t:75,v:200000,nat:"Brazil"},{n:"Kaíque Maciel",p:"FW",q:"PE",a:25,o:71,t:73,v:200000,nat:"Brazil"},{n:"Rubens",p:"FW",q:"PD",a:23,o:71,t:75,v:250000,nat:"Brazil"},{n:"Vinicius Eduardo",p:"DF",q:"ZAG",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"David Antunes",p:"MF",q:"MC",a:20,o:70,t:78,v:200000,nat:"Brazil"},{n:"Tulio Eduardo",p:"FW",q:"CA",a:21,o:70,t:77,v:200000,nat:"Brazil"},{n:"João Bom",p:"FW",q:"CA",a:21,o:70,t:77,v:200000,nat:"Brazil"}]
};

  function natByName(nm) { for (var i = 0; i < NATIONS.length; i++) if (NATIONS[i].name === nm) return NATIONS[i]; return null; }

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
        // elenco: real (licenciado via Transfermarkt) quando existir; senão gerado
        var realSquad = REAL_SQUADS_BR[rc[0]];
        if (realSquad) {
          for (var rp = 0; rp < realSquad.length; rp++) {
            var rpl = realSquad[rp];
            var rnat = natByName(rpl.nat) || natByName(ld.nation) || NATIONS[0];
            var rplayer = {
              id: "p" + (pid++), name: rpl.n, clubId: clubId,
              pos: rpl.p, pos2: rpl.q, age: rpl.a, overall: rpl.o, potential: rpl.t,
              attrs: makeAttrs(rng, rpl.o, rpl.p),
              nationId: rnat.id, nationName: rnat.name,
              height: R.int(rng, 168, 196), weight: R.int(rng, 62, 92),
              valueEur: rpl.v, form: 0, goals: 0
            };
            playersById[rplayer.id] = rplayer;
            club.playerIds.push(rplayer.id);
            rnat.players.push(rplayer.id);
          }
        } else {
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
        }
        league.clubIds.push(clubId);
        clubs.push(club);
      }
      leagues.push(league);
    });

    // técnicos reais alocados ao seu clube real (os demais mantêm nome gerado)
    clubs.forEach(function (c) { var co = COACH_CLUB[c.name]; if (co) { c.coach = co.name; c.coachId = co.id; } });

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
    // clubId do time que o treinador comanda (ou null se for livre)
    coachClub: function (coachId) {
      var W = TM.data.world();
      if (!W._coachClub) { W._coachClub = {}; W.clubs.forEach(function (c) { if (c.coachId) W._coachClub[c.coachId] = c.id; }); }
      return W._coachClub[coachId] || null;
    },
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
      if (p.valueEur != null) return p.valueEur / 1e6;
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
