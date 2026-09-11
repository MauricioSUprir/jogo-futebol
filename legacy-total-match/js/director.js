/* ================= TOTAL MATCH — Gestão do clube (Master League) ================= */
/* Patrocínios por nível (master / secundário / pequeno), fornecedora de material,
   investidores (SAF), empréstimos, estádio e CT. Tudo dentro da carreira de treinador. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function money(c, v) { return C().fmtMoney(c, v); }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function isPro() { try { return TM.storage.edition && TM.storage.edition() === "pro"; } catch (e) { return false; } }
  function matchesPerSeason(c) { return Math.max(30, (c.order || []).length); }

  /* ---------- CT (centro de treinamento) ---------- */
  var CT_UP_EUR = { 2: 12, 3: 28, 4: 55, 5: 95 };
  function ctUpgradeCost(c, toLevel) { return Math.round((CT_UP_EUR[toLevel] || 0) * mult(c)); }
  function ctUpkeep(c, level) { return Math.round((level || 1) * 1.2 * mult(c)); }
  function ctDesc(level) { return ["", "Básico", "Modesto", "Bom", "Excelente", "Elite mundial"][level] || "—"; }
  // efeito do CT no rendimento (pequeno empurrão de moral no simulador)
  function clubEdge(c) { return Math.max(-0.4, Math.min(1.2, ((c.ctLevel || 2) - 2) * 0.35)); }

  /* ---------- estádio (capacidade / receita) ---------- */
  var STAD_UP_EUR = { 1: 20, 2: 45, 3: 85 };
  function stadUpgradeCost(c, to) { return Math.round((STAD_UP_EUR[to] || 0) * mult(c)); }
  function stadIncomeMult(c) { return 1 + 0.14 * (c.stadiumUp || 0); }

  /* ---------- patrocinadores ---------- */
  // [nome, categoria, região, porte]  região: br | latam | eu | us | mena | asia | global   porte: 2 grande · 1 médio
  var SPONSORS_REAL = [
    // casas de apostas — pagam muito
    ["Betano","bet","global",2],["Superbet","bet","br",2],["Esportes da Sorte","bet","br",2],["Betnacional","bet","br",2],["EstrelaBet","bet","br",1],
    ["Pixbet","bet","br",1],["Sportingbet","bet","br",1],["Parimatch","bet","global",1],["Bet365","bet","global",2],["Novibet","bet","br",1],
    ["Vaidebet","bet","br",1],["Rei do Pitaco","bet","br",1],["Bet7k","bet","br",1],["BetMGM","bet","us",2],["Betfair","bet","global",1],
    ["1xBet","bet","global",1],["Stake","bet","global",2],["Betsson","bet","latam",1],["Aposta Ganha","bet","br",1],["F12.bet","bet","br",1],
    // bancos & fintechs
    ["Itaú","banco","br",2],["Bradesco","banco","br",2],["Banco do Brasil","banco","br",2],["Caixa","banco","br",2],["Nubank","banco","br",2],
    ["PicPay","banco","br",1],["Santander","banco","global",2],["Standard Chartered","banco","eu",2],["Allianz","banco","eu",2],["Visa","banco","global",2],["Mastercard","banco","global",2],
    ["XP Investimentos","banco","br",1],["BTG Pactual","banco","br",2],["Stone","banco","br",1],["PagBank","banco","br",1],["Cielo","banco","br",1],["Revolut","banco","eu",1],["Inter","banco","br",1],
    // seguros & saúde
    ["Porto Seguro","seguro","br",1],["SulAmérica","seguro","br",1],["Bradesco Seguros","seguro","br",1],["Unimed","saude","br",2],["Hapvida","saude","br",1],["Amil","saude","br",1],
    ["Drogasil","saude","br",1],["Droga Raia","saude","br",1],["Ultrafarma","saude","br",1],["Herbalife","saude","global",1],["Bupa","saude","eu",1],
    // bebidas
    ["Coca-Cola","bebida","global",2],["Pepsi","bebida","global",2],["Heineken","bebida","global",2],["Brahma","bebida","br",2],["Skol","bebida","br",1],
    ["Guaraná Antarctica","bebida","br",1],["Red Bull","bebida","global",2],["Monster","bebida","global",1],["Gatorade","bebida","global",1],["Ambev","bebida","br",2],
    // telecom & tech
    ["TIM","telecom","br",2],["Vivo","telecom","br",2],["Claro","telecom","br",2],["Etisalat","telecom","mena",2],["Samsung","tech","global",2],
    ["LG","tech","asia",1],["Sony","tech","asia",1],["Microsoft","tech","global",2],["Google","tech","global",2],["Amazon","tech","global",2],
    ["Spotify","tech","global",2],["Netflix","tech","global",1],["Rakuten","tech","asia",2],["Binance","tech","global",2],["Crypto.com","tech","global",1],
    ["Xiaomi","tech","asia",1],["Motorola","tech","global",1],["Huawei","tech","asia",1],["TikTok","tech","global",2],["Kwai","tech","br",1],["Philips","tech","eu",1],
    // games & entretenimento
    ["PlayStation","games","global",2],["Xbox","games","global",1],["EA Sports","games","global",2],["Konami","games","asia",1],["Globoplay","midia","br",1],["Disney+","midia","global",1],["Cazé TV","midia","br",1],
    // aéreas & turismo
    ["Emirates","aereo","mena",2],["Qatar Airways","aereo","mena",2],["Etihad","aereo","mena",2],["Turkish Airlines","aereo","eu",1],["Latam","aereo","latam",2],["Gol","aereo","br",1],["Azul","aereo","br",1],
    ["Booking.com","turismo","global",1],["Airbnb","turismo","global",1],["CVC","turismo","br",1],["Decolar","turismo","latam",1],["Expedia","turismo","us",1],["Marriott","turismo","global",1],
    // energia
    ["Petrobras","energia","br",2],["Shell","energia","global",2],["Ipiranga","energia","br",1],["TotalEnergies","energia","eu",2],["Vale","energia","br",2],["Raízen","energia","br",1],
    // varejo, e-commerce & delivery
    ["Mercado Livre","varejo","latam",2],["Magalu","varejo","br",1],["Casas Bahia","varejo","br",1],["Havan","varejo","br",1],["Assaí","varejo","br",1],["Renner","varejo","br",1],["iFood","varejo","br",1],["Uber","varejo","global",1],
    ["Shopee","varejo","global",1],["AliExpress","varejo","global",1],["Centauro","varejo","br",1],["Netshoes","varejo","br",1],["Riachuelo","varejo","br",1],["C&A","varejo","global",1],["Rappi","varejo","latam",1],["99","varejo","br",1],["Havaianas","moda","br",1],
    // alimentos & cosméticos
    ["JBS","alimento","br",2],["BRF","alimento","br",1],["Sadia","alimento","br",1],["Seara","alimento","br",1],["Nestlé","alimento","global",2],["Danone","alimento","eu",1],["Bauducco","alimento","br",1],["Cacau Show","alimento","br",1],
    ["McDonald's","alimento","global",2],["Burger King","alimento","global",1],["Subway","alimento","global",1],["KFC","alimento","global",1],["Starbucks","alimento","global",1],["Natura","cosmetico","br",1],["O Boticário","cosmetico","br",1],
    // automotivo & indústria
    ["Hyundai","auto","global",2],["Kia","auto","global",1],["Toyota","auto","asia",2],["Chevrolet","auto","us",1],["Jeep","auto","global",1],["Localiza","auto","br",1],
    ["Volkswagen","auto","eu",2],["Fiat","auto","eu",1],["Honda","auto","asia",1],["BYD","auto","asia",2],["Michelin","auto","eu",1],["Pirelli","auto","eu",1],["Bosch","auto","eu",1],
    // construção, imóveis, logística, agro, educação
    ["MRV","construcao","br",1],["Gerdau","construcao","br",2],["Tigre","construcao","br",1],["Votorantim","construcao","br",1],["Suzano","construcao","br",1],["Tramontina","construcao","br",1],
    ["DHL","logistica","eu",1],["FedEx","logistica","us",1],["Correios","logistica","br",1],["Loggi","logistica","br",1],["Maersk","logistica","eu",1],
    ["Estácio","educacao","br",1],["Cogna","educacao","br",1],["Uninter","educacao","br",1],["Kumon","educacao","asia",1],
    ["Electrolux","eletro","eu",1],["Brastemp","eletro","br",1],["Whirlpool","eletro","us",1]
  ];
  var SPONSORS_GENERIC = [
    ["Bet Arena","bet","global",2],["Aposta Já","bet","global",2],["Lucky Gol","bet","global",1],["ProBet","bet","global",1],["Gol de Ouro Bet","bet","global",1],
    ["Banco Aliança","banco","global",2],["Crédito Nacional","banco","global",1],["Fintech Azul","banco","global",1],["Seguros Horizonte","seguro","global",1],["Vida Saúde","saude","global",1],
    ["Refrigerantes Solar","bebida","global",2],["Cerveja Estádio","bebida","global",1],["Energético Turbo","bebida","global",1],
    ["TeleMax","telecom","global",2],["NovaTech","tech","global",2],["Stream+","midia","global",1],["PlayZone","games","global",1],
    ["AeroSul","aereo","global",1],["Viagens Mundo","turismo","global",1],["Energia Vale","energia","global",2],
    ["Loja Mundial","varejo","global",1],["Compra Rápida","varejo","global",1],["Alimentos Campo","alimento","global",1],["Lanche Bom","alimento","global",1],["Beleza Pura","cosmetico","global",1],
    ["AutoPrime","auto","global",1],["Pneus Forte","auto","global",1],["Construtora Base","construcao","global",1],["Entrega Já","logistica","global",1],["Faculdade Futuro","educacao","global",1],["Eletro Lar","eletro","global",1]
  ];
  var SUPPLIERS_REAL = ["Nike","Adidas","Puma","Umbro","New Balance","Kappa","Castore","Macron","Joma","Hummel","Mizuno","Le Coq Sportif","Diadora","Under Armour","Lotto","Erreà","Topper","Penalty","Volt","Reebok"];
  var SUPPLIERS_GENERIC = ["Sportiva","Atleta Pro","Vento Sport","Campo & Cia","Gol Wear","Fibra Esportes"];
  // categoria: [mult valor/temp, mult bônus, ícone, descrição]
  var CAT = {
    bet: [1.9, 1.6, "🎰", "Casa de apostas: a maior receita, com bônus alto."], banco: [1.3, 1.3, "🏦", "Banco/fintech: receita sólida e estável."],
    seguro: [1.15, 1.1, "🛡️", "Seguradora: contrato longo e seguro."], saude: [1.0, 1.0, "🏥", "Saúde: parceria com plano e clínica."],
    bebida: [1.1, 1.2, "🥤", "Bebidas: forte presença no estádio."], telecom: [1.2, 1.1, "📱", "Telecom: exposição nacional."],
    tech: [1.25, 1.2, "💻", "Tecnologia: marca global."], games: [1.1, 1.3, "🎮", "Games: bônus alto e público jovem."], midia: [0.95, 1.0, "📺", "Mídia: exposição e conteúdo."],
    aereo: [1.15, 1.1, "✈️", "Companhia aérea: viagens e visibilidade."], turismo: [0.95, 1.0, "🧳", "Turismo: viagens e hospedagem."],
    energia: [1.3, 1.2, "⛽", "Energia: contrato robusto."], varejo: [1.0, 1.1, "🛒", "Varejo: receita e ativações."], moda: [0.9, 1.0, "🩴", "Moda: produtos licenciados."],
    alimento: [0.9, 1.0, "🍽️", "Alimentos: parceria de base."], cosmetico: [0.9, 1.0, "💄", "Cosméticos: ativações com a torcida."],
    auto: [1.1, 1.1, "🚗", "Automotiva: frota e bônus."], construcao: [1.05, 1.0, "🏗️", "Construção/indústria: obras no CT e estádio."],
    logistica: [0.95, 1.0, "🚚", "Logística: transporte da delegação."], educacao: [0.85, 0.9, "🎓", "Educação: bolsas e projetos sociais."], eletro: [0.9, 1.0, "🔌", "Eletrodomésticos: ativações e brindes."]
  };
  // níveis de cota: master (frente da camisa), secundário (manga/costas), pequeno (calção/placas)
  var TIERS = {
    master: { label: "Master", desc: "Frente da camisa — a maior cota do clube.", mult: 1, bonus: 1, years: [1, 2], n: 5, icon: "👑" },
    secundario: { label: "Secundário", desc: "Manga ou costas da camisa.", mult: 0.42, bonus: 0.4, years: [1, 2], n: 4, icon: "🎽" },
    pequeno: { label: "Pequeno", desc: "Calção, placas e ativações.", mult: 0.18, bonus: 0.15, years: [1, 1], n: 4, icon: "📣" }
  };
  var TIER_ORDER = ["master", "secundario", "pequeno"];
  var LEAGUE_REGION = { br: "br", ar: "latam", uy: "latam", py: "latam", co: "latam", ec: "latam", mx: "latam", us: "us", sa: "mena", ma: "mena", jp: "asia", en: "eu", es: "eu", it: "eu", de: "eu", fr: "eu", pt: "eu", nl: "eu", be: "eu", ch: "eu", tr: "eu", ru: "eu", rus: "eu" };
  function seededRng(seed) { var h = 2166136261; for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  function clubRegion(c) { var club = TM.data.club(c.teamId); return (club && LEAGUE_REGION[club.leagueId]) || "global"; }
  function pickWeighted(list, rng, n, region, used) {
    var out = [], pool = list.filter(function (x) { return !used[x[0]]; });
    for (var k = 0; k < n && pool.length; k++) {
      var tot = 0, ws = pool.map(function (x) { var w = x[2] === region ? 3 : x[2] === "global" ? 1.2 : 0.25; w *= x[3] === 2 ? 1.3 : 1; tot += w; return w; });
      var r = rng() * tot, idx = 0; for (var i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) { idx = i; break; } }
      out.push(pool[idx]); used[pool[idx][0]] = 1; pool.splice(idx, 1);
    }
    return out;
  }
  // propostas da temporada (determinísticas por clube+temporada) — as três cotas são sorteadas juntas, sem repetir empresa
  var _offersCache = {};
  function allOffers(c) {
    var key = (c.teamId || "x") + "|" + (c.season || 1) + "|" + (isPro() ? "pro" : "pub") + "|" + (c.sponsorRenew || 0);
    if (_offersCache[key]) return _offersCache[key];
    var r = TM.data.clubRating(c.teamId), m = mult(c);
    var rng = seededRng(key);
    var list = isPro() ? SPONSORS_REAL : SPONSORS_GENERIC, region = clubRegion(c), used = {}, out = {};
    TIER_ORDER.forEach(function (tier) {
      var T = TIERS[tier], base = (6 + Math.max(0, (r - 60)) * 0.7) * T.mult; // euros M
      var nBet = tier === "master" ? 2 : tier === "secundario" ? 1 : 0;
      var bets = pickWeighted(list.filter(function (x) { return x[1] === "bet"; }), rng, nBet, region, used);
      var others = pickWeighted(list.filter(function (x) { return x[1] !== "bet"; }), rng, T.n - nBet, region, used);
      out[tier] = bets.concat(others).map(function (x) {
        var cat = CAT[x[1]] || CAT.varejo, big = x[3] === 2 ? 1.2 : 0.9, jitter = 0.85 + rng() * 0.3;
        var yrs = x[1] === "bet" ? T.years[0] : T.years[1];
        return { id: "sp:" + x[0], name: x[0], cat: x[1], tier: tier, icon: cat[2], desc: cat[3],
          seasonM: Math.max(1, Math.round(base * cat[0] * big * jitter * m)), bonusM: Math.max(0, Math.round(base * cat[1] * big * jitter * T.bonus * m)), years: yrs };
      }).sort(function (a, b) { return b.seasonM - a.seasonM; });
    });
    _offersCache = {}; _offersCache[key] = out;
    return out;
  }
  function sponsorOffers(c, tier) { return allOffers(c)[tier || "master"]; }
  function supplierOffers(c) {
    var r = TM.data.clubRating(c.teamId), m = mult(c);
    var base = 3 + Math.max(0, (r - 60)) * 0.45;
    var rng = seededRng((c.teamId || "x") + "|" + (c.season || 1) + "|kit");
    var list = (isPro() ? SUPPLIERS_REAL : SUPPLIERS_GENERIC).slice();
    var tierBig = r >= 80, cand = list.filter(function (n, i) { return tierBig ? i < 8 : i >= 3; });
    var out = [];
    for (var k = 0; k < 3 && cand.length; k++) { var i = Math.floor(rng() * cand.length); out.push(cand[i]); cand.splice(i, 1); }
    return out.map(function (n, i) { var f = (1.25 - i * 0.15) * (0.9 + rng() * 0.2);
      return { id: "kit:" + n, name: n, seasonM: Math.round(base * f * m), bonusM: Math.round(base * 0.8 * f * m), years: 3, desc: i === 0 ? "Fornecedora premium: material completo + maior receita." : "Contrato de material esportivo (camisas, treino, chuteiras)." }; });
  }
  function announceDeal(c, kind, name, seasonM, tier) {
    var club = TM.data.club(c.teamId), cname = club ? club.name : "Clube";
    var what = kind === "kit" ? "Nova fornecedora" : tier === "master" ? "Novo patrocinador master" : "Novo patrocinador";
    try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: kind === "kit" ? "👕" : "🤝", title: what, text: (kind === "kit" ? cname + " anuncia " + name + " como nova fornecedora de material esportivo" : cname + " fecha patrocínio " + (TIERS[tier] ? TIERS[tier].label.toLowerCase() : "") + " com " + name) + " — " + money(c, seasonM) + " por temporada." }); } catch (e) {}
  }
  // receita total de patrocínio + fornecedora (por temporada)
  function sponsorIncome(c) {
    var s = 0; TIER_ORDER.forEach(function (t) { var d = c.sponsors && c.sponsors[t]; if (d) s += d.seasonM || 0; });
    if (c.supplier) s += c.supplier.seasonM || 0;
    return s;
  }
  function sponsorNames(c) {
    var n = []; TIER_ORDER.forEach(function (t) { var d = c.sponsors && c.sponsors[t]; if (d) n.push(d.name); });
    if (c.supplier) n.push(c.supplier.name);
    return n;
  }

  /* ---------- investidor / SAF (raro) — com cláusulas, contrapartidas e consequências ---------- */
  var INVESTORS_REAL = ["Grupo 777 Partners", "Eagle Football", "City Football Group", "Red Bull", "Fundo Mubadala", "Grupo Textor", "Fundo PIF", "Clearlake Capital", "RedBird Capital", "Grupo Fenway", "Grupo Squadra", "Ares Management", "Fundo QSI", "Grupo Pacific Media", "Grupo Amazônia Capital"];
  var INVESTORS_GENERIC = ["Grupo Atlas Capital", "Fundo Meridiano", "Horizonte Sports Group", "Fundo Vértice", "Grupo Alfa Esportes", "Continental Sports Fund", "Grupo Pátria Sports", "Nova Era Capital"];
  function pickInvestor(c) { var l = isPro() ? INVESTORS_REAL : INVESTORS_GENERIC; return l[Math.floor(Math.random() * l.length)]; }
  function isEuroClub(clubId) { try { var cl = TM.data.club(clubId); var R = C().REGION || {}; return cl && R[cl.leagueId] === "eu"; } catch (e) { return false; } }
  // cláusulas possíveis (o investidor escolhe 2-3): when = "season" (avaliada no fim da temporada) | "event" (avaliada na hora)
  function makeClauses(c) {
    var pool = [];
    var meta = Math.max(1, ((c.objective && c.objective.maxPos) || 8) - 1);
    pool.push({ id: "meta", when: "season", pos: meta, finePct: 0.15, text: "Terminar a liga em " + meta + "º lugar ou melhor" });
    pool.push({ id: "euro", when: "event", finePct: 0.10, text: "Aceitar qualquer proposta de clube europeu acima do valor de mercado por um jogador seu (o investidor quer retorno)" });
    try {
      var best = C().rosterPlayers(c).slice().sort(function (x, y) { return y.overall - x.overall; })[0];
      if (best) pool.push({ id: "simbolo", when: "event", pid: best.id, pname: best.name, finePct: 0.25, text: "Não vender " + best.name + ", o jogador-símbolo do projeto" });
    } catch (e) {}
    var wage = 0; try { wage = C().rosterPlayers(c).reduce(function (sum, p) { return sum + TM.data.marketValue(p) * 0.075; }, 0) * mult(c); } catch (e) {}
    if (wage) pool.push({ id: "folha", when: "season", limitM: Math.round(wage * 1.15), finePct: 0.10, text: "Manter a folha salarial do elenco abaixo de " + money(c, Math.round(wage * 1.15)) + " por temporada" });
    pool.push({ id: "jovens", when: "season", n: 3, finePct: 0.08, text: "Ter ao menos 3 jogadores de até 21 anos no elenco ao fim da temporada" });
    pool.push({ id: "semEmprestimo", when: "event", finePct: 0.10, text: "Não pegar empréstimos bancários enquanto a SAF vigorar" });
    pool.push({ id: "reforcos", when: "season", pct: 0.5, finePct: 0.10, text: "Investir ao menos metade do aporte em contratações nesta temporada" });
    if (TM.data.clubRating(c.teamId) >= 78) pool.push({ id: "titulo", when: "season", finePct: 0.12, text: "Conquistar ao menos um título nesta temporada" });
    // meta esportiva sempre + 1 ou 2 sorteadas
    var out = [pool[0]], rest = pool.slice(1), n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (var i = 0; i < n && rest.length; i++) { var k = Math.floor(Math.random() * rest.length); out.push(rest[k]); rest.splice(k, 1); }
    return out;
  }
  function maybeSafOffer(c) {
    if (TM.saf) { TM.saf.tick(c); return; }   // SAF v2 (saf.js)
    if (!c.windows) return;
    var d = c.currentDay || 0;
    if (c.safOffer && d >= c.safOffer.closeDay) { c.safOffer = null; }
    c.windows.forEach(function (w) {
      var open = d >= w.openDay && d < w.closeDay;
      if (!open || w.safRolled) return;
      w.safRolled = true;
      if (c.safOffer || c.saf) return;                                  // já tem investidor: sem novas propostas
      if ((c.season || 1) - (c.safLastSeason || -9) < 2) return;         // no máximo uma proposta a cada 2 temporadas
      var rep = c.reputation || 18, pop = c.popularity || 40;
      var chance = 0.05 + (c.budget < 0 ? 0.06 : 0) + (pop > 60 ? 0.02 : 0) + (rep > 50 ? 0.02 : 0);   // RARO
      if (Math.random() >= chance) return;
      var r = TM.data.clubRating(c.teamId), m = mult(c);
      var base = Math.round((40 + Math.max(0, r - 60) * 6) * m);
      var fromCash = Math.round(Math.max(0, c.budget) * 0.25);
      var amount = base + fromCash;
      var pct = 30 + Math.floor(Math.random() * 41); // 30–70% do clube
      c.safOffer = { amountM: amount, pct: pct, closeDay: w.closeDay, windowName: w.name, investor: pickInvestor(c), clauses: makeClauses(c) };
      c.safLastSeason = c.season || 1;
      TM.notify.push(c, { icon: "💼", title: "Proposta de SAF", saf: true, news: true,
        text: c.safOffer.investor + " quer comprar " + pct + "% do clube (SAF) e injetar " + money(c, amount) + " no caixa nesta " + w.name + ", com " + c.safOffer.clauses.length + " contrapartidas. Decida em 💰 Finanças." });
    });
  }
  function acceptSaf(c, route) {
    var o = c.safOffer; if (!o) return;
    c.budget += o.amountM; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.safM = (c.finc.safM || 0) + o.amountM;
    c.saf = { investor: o.investor, pct: o.pct, season: c.season || 1, amountM: o.amountM, clauses: o.clauses || [], strikes: 0, spentAt: c.finc.spentM || 0, honoursAt: (c.honours || []).length, log: [] };
    TM.notify.push(c, { icon: "💼", title: "SAF fechada", news: true, text: o.investor + " comprou " + o.pct + "% do clube e injetou " + money(c, o.amountM) + ". Cumpra as contrapartidas: " + c.saf.clauses.map(function (x) { return x.text; }).join("; ") + "." });
    try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: "💼", title: "SAF", text: TM.data.club(c.teamId).name + " vira SAF: " + o.investor + " assume " + o.pct + "% do clube com aporte de " + money(c, o.amountM) + "." }); } catch (e) {}
    c.safOffer = null; TM.storage.saveCoachCareer(c); TM.ui.toast("Investimento aceito: +" + money(c, o.amountM)); TM.ui.go(route);
  }
  // penalidade por descumprir uma cláusula (multa + strike; 2 strikes = investidor rompe)
  function safPenalty(c, cl, why) {
    if (!c.saf) return;
    var fine = Math.round(c.saf.amountM * (cl.finePct || 0.1));
    c.budget -= fine; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + fine;
    c.saf.strikes = (c.saf.strikes || 0) + 1; c.saf.log.push({ season: c.season || 1, id: cl.id, why: why, fine: fine });
    c.confidence = Math.max(0, (c.confidence == null ? 50 : c.confidence) - 12);
    TM.notify.push(c, { icon: "⚠️", title: "Cláusula da SAF descumprida", news: true, text: why + " " + c.saf.investor + " aplicou multa de " + money(c, fine) + " (" + c.saf.strikes + "ª advertência)." });
    if (c.saf.strikes >= 2) {
      var out = Math.round(c.saf.amountM * 0.2);
      c.budget -= out; c.finc.spentM += out; c.confidence = Math.max(0, c.confidence - 15);
      TM.notify.push(c, { icon: "💥", title: "SAF rompida", news: true, text: c.saf.investor + " deixou o clube por descumprimento das contrapartidas, levando " + money(c, out) + " de volta. A diretoria está furiosa." });
      try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: "💥", title: "Crise", text: c.saf.investor + " rompe a SAF com o " + TM.data.club(c.teamId).name + " após contrapartidas descumpridas." }); } catch (e) {}
      c.safEnded = { investor: c.saf.investor, season: c.season || 1 }; c.saf = null;
    }
  }
  function clauseOf(c, id) { return (c.saf && c.saf.clauses || []).filter(function (x) { return x.id === id; })[0]; }
  // eventos: proposta recusada / jogador vendido / empréstimo
  function onOfferRejected(c, player, fee, buyerId) {
    if (TM.saf) { TM.saf.onOfferRejected(c, player, fee, buyerId); return; }
    var cl = clauseOf(c, "euro"); if (!cl || !player) return;
    if (isEuroClub(buyerId) && fee >= TM.data.marketValue(player) * mult(c)) safPenalty(c, cl, "Você recusou " + money(c, fee) + " de um clube europeu por " + player.name + " (acima do valor de mercado).");
  }
  function onPlayerSold(c, player, fee, buyerId) {
    if (TM.saf) { TM.saf.onPlayerSold(c, player, fee, buyerId); return; }
    var cl = clauseOf(c, "simbolo"); if (!cl || !player || cl.pid !== player.id) return;
    safPenalty(c, cl, "Você vendeu " + player.name + ", o jogador-símbolo do projeto.");
  }
  function onLoanTaken(c) { if (TM.saf) { TM.saf.onLoanTaken(c); return; } var cl = clauseOf(c, "semEmprestimo"); if (cl) safPenalty(c, cl, "Você pegou um empréstimo bancário durante a SAF."); }
  // fim da temporada: avalia as cláusulas de temporada; tudo cumprido = aporte extra
  function evaluateSaf(c) {
    if (!c.saf) return;
    var fails = [];
    c.saf.clauses.forEach(function (cl) {
      if (cl.when !== "season") return;
      var ok = true, why = "";
      try {
        if (cl.id === "meta") { var pos = C().currentPosition(c); ok = pos <= cl.pos; why = "O time terminou em " + pos + "º; a meta era " + cl.pos + "º."; }
        else if (cl.id === "folha") { var wage = C().rosterPlayers(c).reduce(function (sum, p) { return sum + TM.data.marketValue(p) * 0.075; }, 0) * mult(c); ok = wage <= cl.limitM; why = "A folha ficou em " + money(c, Math.round(wage)) + ", acima do limite de " + money(c, cl.limitM) + "."; }
        else if (cl.id === "jovens") { var n = C().rosterPlayers(c).filter(function (p) { return (p.age || 30) <= 21; }).length; ok = n >= cl.n; why = "Só " + n + " jogador(es) de até 21 anos no elenco; o mínimo era " + cl.n + "."; }
        else if (cl.id === "reforcos") { var spent = ((c.finc && c.finc.spentM) || 0) - (c.saf.spentAt || 0); ok = spent >= c.saf.amountM * cl.pct; why = "Foram investidos " + money(c, Math.max(0, Math.round(spent))) + " em contratações; o mínimo era " + money(c, Math.round(c.saf.amountM * cl.pct)) + "."; }
        else if (cl.id === "titulo") { ok = (c.honours || []).length > (c.saf.honoursAt || 0); why = "Nenhum título conquistado na temporada."; }
      } catch (e) {}
      if (!ok) fails.push({ cl: cl, why: why });
    });
    if (!fails.length) {
      var bonus = Math.round(c.saf.amountM * 0.15);
      c.budget += bonus; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.safM = (c.finc.safM || 0) + bonus;
      c.confidence = Math.min(100, (c.confidence == null ? 50 : c.confidence) + 8);
      TM.notify.push(c, { icon: "💼", title: "Contrapartidas cumpridas", news: true, text: c.saf.investor + " aprovou a temporada e liberou um aporte extra de " + money(c, bonus) + "." });
    } else {
      fails.forEach(function (f) { if (c.saf) safPenalty(c, f.cl, f.why); });
    }
    if (c.saf) { c.saf.spentAt = (c.finc && c.finc.spentM) || 0; c.saf.honoursAt = (c.honours || []).length; c.saf.clauses = c.saf.clauses.map(function (cl) { if (cl.id === "meta") { var meta = Math.max(1, ((c.objective && c.objective.maxPos) || 8) - 1); cl.pos = meta; cl.text = "Terminar a liga em " + meta + "º lugar ou melhor"; } return cl; }); }
  }
  function clauseList(c, clauses) {
    return el("ul", { class: "saf-clauses" }, (clauses || []).map(function (cl) { return el("li", { text: (cl.when === "season" ? "📅 " : "⚡ ") + cl.text + " (multa " + Math.round((cl.finePct || 0.1) * 100) + "% do aporte)" }); }));
  }
  function safCard(c, route) {
    if (TM.saf) return TM.saf.card(c, route);
    if (!c.safOffer) return null;
    var o = c.safOffer;
    return el("div", { class: "saf-card" }, [
      el("div", { class: "saf-title", text: "💼 Proposta de SAF — " + o.investor }),
      el("div", { class: "saf-text", text: "O grupo quer comprar " + o.pct + "% do clube e injetar " + money(c, o.amountM) + " no caixa nesta " + (o.windowName || "janela") + ". Em troca, exige contrapartidas. Duas advertências e o investidor rompe o contrato, levando 20% do aporte de volta. Cumprindo tudo, libera +15% ao fim da temporada." }),
      clauseList(c, o.clauses),
      el("div", { class: "note-actions" }, [
        TM.ui.button("✅ Aceitar " + money(c, o.amountM), function () { TM.ui.confirm("Aceitar a SAF?", o.investor + " passa a ter " + o.pct + "% do clube em troca de " + money(c, o.amountM) + " e das contrapartidas listadas.", "Aceitar", function () { acceptSaf(c, route); }); }, "btn primary small"),
        TM.ui.button("Recusar", function () {
          TM.notify.push(c, { icon: "🚫", title: "SAF recusada", text: "Você recusou a proposta de " + o.investor + "." });
          c.safOffer = null; TM.storage.saveCoachCareer(c); TM.ui.go(route);
        }, "btn ghost small")
      ])
    ]);
  }

  /* ---------- empréstimos bancários (pagos em 3 temporadas com juros) ---------- */
  var LOAN_EUR = [25, 60, 120];
  function loanOptions(c) {
    var r = TM.data.clubRating(c.teamId), m = mult(c);
    var cap = r >= 84 ? 3 : r >= 76 ? 2 : 1;
    return LOAN_EUR.slice(0, cap).map(function (e) { var amt = Math.round(e * m); var rate = r >= 84 ? 0.08 : r >= 76 ? 0.11 : 0.15; return { amountM: amt, rate: rate, totalM: Math.round(amt * (1 + rate)), perM: Math.round(amt * (1 + rate) / 3), years: 3 }; });
  }
  function loansDue(c) { return (c.loans || []).reduce(function (s, l) { return s + (l.left > 0 ? l.perM : 0); }, 0); }
  function takeLoan(c, o, route) {
    c.loans = c.loans || [];
    if (c.loans.filter(function (l) { return l.left > 0; }).length >= 2) { TM.ui.toast("O banco não libera mais de 2 empréstimos ativos."); return; }
    c.loans.push({ amountM: o.amountM, totalM: o.totalM, perM: o.perM, left: o.years, season: c.season || 1 });
    onLoanTaken(c);
    c.budget += o.amountM; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.loanM = (c.finc.loanM || 0) + o.amountM;
    TM.notify.push(c, { icon: "🏦", title: "Empréstimo aprovado", text: "O banco liberou " + money(c, o.amountM) + ". Você pagará " + money(c, o.perM) + " por temporada durante " + o.years + " temporadas (juros de " + Math.round(o.rate * 100) + "%)." });
    TM.storage.saveCoachCareer(c); TM.ui.toast("+" + money(c, o.amountM) + " no caixa"); TM.ui.go(route);
  }

  /* ---------- painéis de finanças (usados na tela Finanças da carreira) ---------- */
  function financePanels(c, body, route) {
    var saf = safCard(c, route); if (saf) body.appendChild(saf);
    var cur = [];
    TIER_ORDER.forEach(function (t) { var d = c.sponsors && c.sponsors[t]; if (d) cur.push(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: TIERS[t].icon + " " + TIERS[t].label + " · " + d.name + (d.until ? " (até temp. " + d.until + ")" : "") }), el("span", { class: "deal-val good", text: "+" + money(c, d.seasonM) + "/temp" }) ])); });
    if (c.supplier) cur.push(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "👕 Material · " + c.supplier.name + (c.supplier.until ? " (até temp. " + c.supplier.until + ")" : "") }), el("span", { class: "deal-val good", text: "+" + money(c, c.supplier.seasonM) + "/temp" }) ]));
    if (c.saf && TM.saf) { cur.push(TM.saf.card(c, route)); }
    else if (c.saf) { cur.push(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "💼 SAF · " + c.saf.investor + " (" + c.saf.pct + "%) · " + (c.saf.strikes || 0) + "/" + (c.saf.patience || 2) + " advertências" }), el("span", { class: "deal-val", text: "aporte " + money(c, c.saf.amountM) }) ])); cur.push(clauseList(c, c.saf.clauses)); }
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "🤝 Contratos comerciais" }),
      cur.length ? el("div", {}, cur) : el("div", { class: "setting-hint", text: "Nenhum patrocínio fechado. Casas de apostas pagam mais; grandes marcas dão estabilidade." }),
      TM.ui.button("Ver propostas de patrocínio", function () { TM.ui.go("club-sponsors", { from: route }); }, "btn small")
    ]));
    // empréstimos
    var lp = el("div", { class: "nego-panel" });
    lp.appendChild(el("div", { class: "nego-quote", text: "🏦 Empréstimo bancário — dinheiro agora, pago em 3 temporadas com juros." }));
    var active = (c.loans || []).filter(function (l) { return l.left > 0; });
    active.forEach(function (l) { lp.appendChild(el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "Empréstimo de " + money(c, l.amountM) + " (temp. " + l.season + ")" }), el("span", { class: "deal-val bad", text: "-" + money(c, l.perM) + "/temp · " + l.left + " restante(s)" }) ])); });
    var row = el("div", { class: "inv-row" });
    loanOptions(c).forEach(function (o) { row.appendChild(TM.ui.button("+ " + money(c, o.amountM) + " (" + Math.round(o.rate * 100) + "%)", function () { TM.ui.confirm("Pegar empréstimo?", "Recebe " + money(c, o.amountM) + " agora e paga " + money(c, o.perM) + " por temporada em 3 temporadas (total " + money(c, o.totalM) + ").", "Pegar", function () { takeLoan(c, o, route); }); }, "btn ghost small")); });
    lp.appendChild(row);
    body.appendChild(lp);
    // estrutura
    body.appendChild(el("div", { class: "nego-panel" }, [
      el("div", { class: "nego-quote", text: "🏗️ Estrutura do clube" }),
      el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "🏟️ Estádio · ampliação " + (c.stadiumUp || 0) + "/3" }), el("span", { class: "deal-val good", text: "+" + Math.round((stadIncomeMult(c) - 1) * 100) + "% bilheteria" }) ]),
      el("div", { class: "deal-line" }, [ el("span", { class: "deal-lbl", text: "🏋️ CT · nível " + (c.ctLevel || 2) + " (" + ctDesc(c.ctLevel || 2) + ")" }), el("span", { class: "deal-val bad", text: "-" + money(c, ctUpkeep(c, c.ctLevel || 2)) + "/temp" }) ]),
      el("div", { class: "inv-row" }, [ TM.ui.button("🏟️ Estádio", function () { TM.ui.go("club-stadium", { from: route }); }, "btn ghost small"), TM.ui.button("🏋️ CT", function () { TM.ui.go("club-ct", { from: route }); }, "btn ghost small") ])
    ]));
  }

  /* ---------- fluxo de caixa por jogo e por temporada ---------- */
  function ensure(c) {
    if (!c) return c;
    if (c.ctLevel == null) c.ctLevel = 2;
    if (c.stadiumUp == null) c.stadiumUp = 0;
    if (!c.sponsors) c.sponsors = {};
    if (c.sponsor && !c.sponsors.master) { c.sponsors.master = c.sponsor; }
    c.sponsor = c.sponsors.master || null; // compatibilidade
    return c;
  }
  // chamado após cada jogo do usuário: receita de patrocínio + bilheteria extra do estádio − manutenção do CT
  function matchIncome(c, isHome) {
    ensure(c);
    var mps = matchesPerSeason(c), m = mult(c);
    var inc = Math.round(sponsorIncome(c) / mps * 10) / 10;
    var r = TM.data.clubRating(c.teamId), over = Math.max(0, r - 55);
    var gateExtra = isHome ? Math.round((5 + over * 1.3) * m * (stadIncomeMult(c) - 1) / (mps / 2) * 10) / 10 : 0;
    var upkeep = Math.round(ctUpkeep(c, c.ctLevel) / mps * 10) / 10;
    var net = Math.round((inc + gateExtra - upkeep) * 10) / 10;
    c.budget = Math.round((c.budget + net) * 10) / 10;
    c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 };
    c.finc.sponsorM = Math.round(((c.finc.sponsorM || 0) + inc) * 10) / 10;
    c.finc.gateExtraM = Math.round(((c.finc.gateExtraM || 0) + gateExtra) * 10) / 10;
    c.finc.upkeepM = Math.round(((c.finc.upkeepM || 0) + upkeep) * 10) / 10;
    return net;
  }
  // virada de temporada: contratos vencem, parcelas de empréstimo
  function seasonTick(c) {
    ensure(c);
    try { if (TM.saf) TM.saf.seasonEnd(c); else evaluateSaf(c); } catch (e) {}
    var s = c.season || 1, ended = [];
    TIER_ORDER.forEach(function (t) { var d = c.sponsors[t]; if (d && d.until && s > d.until) { ended.push(TIERS[t].label + ": " + d.name); c.sponsors[t] = null; } });
    if (c.supplier && c.supplier.until && s > c.supplier.until) { ended.push("Material: " + c.supplier.name); c.supplier = null; }
    c.sponsor = c.sponsors.master || null;
    if (ended.length) TM.notify.push(c, { icon: "📄", title: "Contratos encerrados", news: true, text: ended.join(" · ") + ". Veja novas propostas em Patrocínios." });
    if (c.loans && c.loans.length) {
      var paid = 0; c.loans.forEach(function (l) { if (l.left > 0) { c.budget -= l.perM; paid += l.perM; l.left--; } });
      c.loans = c.loans.filter(function (l) { return l.left > 0; });
      if (paid) TM.notify.push(c, { icon: "🏦", title: "Parcela do empréstimo", text: "O banco debitou " + money(c, paid) + " da parcela do empréstimo." });
    }
    // sem nenhum patrocínio: a diretoria cobra
    if (!c.sponsors.master) TM.notify.push(c, { icon: "🤝", title: "Sem patrocinador master", text: "O clube começa a temporada sem patrocinador master. Feche um contrato em 🤝 Patrocínios para reforçar o caixa." });
  }
  // migração de saves antigos da extinta carreira de dirigente -> carreira de treinador
  function migrateDirector(c) {
    if (!c || c.type !== "director") return c;
    c.type = "club"; c.role = "treinador";
    delete c.coach; delete c.coachChat; delete c._lastSim;
    ensure(c);
    try { if (!c.lineup) c.lineup = C().buildBestLineup(C().rosterPlayers(c)); } catch (e) {}
    TM.notify.push(c, { icon: "🎯", title: "Agora você é o treinador", text: "A carreira de dirigente foi unificada com a Master League: você comanda o time em campo e também a gestão (patrocínios, SAF, estádio e CT)." });
    TM.storage.saveCoachCareer(c);
    return c;
  }

  /* ================= PATROCÍNIOS ================= */
  TM.ui.register("club-sponsors", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; } ensure(c);
    var back = (params && params.from) || "coach-hub";
    screen.appendChild(TM.ui.topbar("🤝 Patrocínios & Parcerias", function () { TM.ui.go(back); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    var total = sponsorIncome(c);
    var cur = [];
    TIER_ORDER.forEach(function (t) { var d = c.sponsors[t]; if (d) cur.push(el("div", { class: "nego-quote happy", text: TIERS[t].icon + " " + TIERS[t].label + ": " + d.name + " — " + money(c, d.seasonM) + "/temporada" + (d.until ? " (até a temp. " + d.until + ")" : "") + "." })); });
    if (c.supplier) cur.push(el("div", { class: "nego-quote happy", text: "👕 Fornecedora de material: " + c.supplier.name + " — " + money(c, c.supplier.seasonM) + "/temporada" + (c.supplier.until ? " (até a temp. " + c.supplier.until + ")" : "") + "." }));
    if (cur.length) { cur.push(el("div", { class: "setting-hint", text: "Receita comercial total: " + money(c, total) + "/temporada — entra no caixa a cada jogo. Trocar um patrocinador antes do fim do contrato custa multa (metade do bônus recebido)." })); body.appendChild(el("div", { class: "nego-panel" }, cur)); }
    else body.appendChild(el("p", { class: "intro-text", text: "Feche cotas de patrocínio (master, secundária e pequena) e um contrato de material esportivo. Casas de apostas pagam mais; grandes marcas dão estabilidade. As propostas mudam a cada temporada." }));

    function accept(kind, s) {
      var tier = s.tier || "master";
      var curDeal = kind === "kit" ? c.supplier : c.sponsors[tier];
      if (curDeal && curDeal.id === s.id) { TM.ui.toast("Já é o seu contrato atual."); return; }
      var fine = (curDeal && curDeal.until && (c.season || 1) < curDeal.until) ? Math.round((curDeal.bonusM || 0) / 2) : 0;
      var go = function () {
        c.budget += s.bonusM - fine; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.bonusM = (c.finc.bonusM || 0) + s.bonusM; if (fine) c.finc.spentM = (c.finc.spentM || 0) + fine;
        var deal = { id: s.id, name: s.name, cat: s.cat || "kit", tier: kind === "kit" ? "kit" : tier, seasonM: s.seasonM, bonusM: s.bonusM, until: (c.season || 1) + (s.years || 1) };
        if (kind === "kit") c.supplier = deal; else { c.sponsors[tier] = deal; c.sponsor = c.sponsors.master || null; }
        TM.notify.push(c, { icon: kind === "kit" ? "👕" : "🤝", title: kind === "kit" ? "Fornecedora fechada" : "Patrocínio " + TIERS[tier].label.toLowerCase() + " fechado", news: true, text: s.name + " — bônus de " + money(c, s.bonusM) + (fine ? " (multa de " + money(c, fine) + " pela rescisão)" : "") + " e " + money(c, s.seasonM) + "/temporada por " + (s.years || 1) + " temporada(s)." });
        announceDeal(c, kind, s.name, s.seasonM, tier);
        TM.storage.saveCoachCareer(c); TM.ui.toast((kind === "kit" ? "Fornecedora" : "Patrocínio") + " fechado! +" + money(c, s.bonusM - fine)); TM.ui.go("club-sponsors", { from: back });
      };
      if (fine) TM.ui.confirm("Rescindir contrato atual?", "Sair de " + curDeal.name + " antes do fim custa " + money(c, fine) + " de multa.", "Trocar", go, true); else go();
    }
    function card(kind, s, curDeal) {
      var mine = curDeal && curDeal.id === s.id;
      return el("div", { class: "sponsor-card" + (mine ? " current" : "") }, [
        el("div", { class: "sp-head" }, [ el("div", { class: "sp-name", text: (s.icon || "👕") + " " + s.name }), el("div", { class: "sp-desc", text: s.desc }) ]),
        el("div", { class: "sp-vals" }, [
          el("span", { class: "sp-tag good", text: "Bônus: " + money(c, s.bonusM) }),
          el("span", { class: "sp-tag", text: money(c, s.seasonM) + "/temp" }),
          el("span", { class: "sp-tag", text: (s.years || 1) + " temp." })
        ]),
        TM.ui.button(mine ? "Contrato atual" : "Fechar contrato", function () { accept(kind, s); }, "btn " + (mine ? "ghost" : "primary") + " small")
      ]);
    }
    if (TM.coins) body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("🔁 Pedir novas propostas por " + TM.coins.COST.sponsorRenew + " 🪙", function () {
        TM.coins.pay(TM.coins.COST.sponsorRenew, "Novas propostas de patrocínio", function () { c.sponsorRenew = (c.sponsorRenew || 0) + 1; TM.storage.saveCoachCareer(c); TM.ui.toast("Novas empresas na mesa! 🤝"); TM.ui.go("club-sponsors", { from: "coach-hub" }); });
      }, "btn ghost small")
    ]));
    TIER_ORDER.forEach(function (t) {
      body.appendChild(el("h3", { class: "section-title", text: TIERS[t].icon + " Cota " + TIERS[t].label.toLowerCase() + " — " + TIERS[t].desc }));
      sponsorOffers(c, t).forEach(function (s) { body.appendChild(card("sp", s, c.sponsors[t])); });
    });
    body.appendChild(el("h3", { class: "section-title", text: "👕 Material esportivo — fornecedoras interessadas" }));
    supplierOffers(c).forEach(function (s) { body.appendChild(card("kit", s, c.supplier)); });
  });

  /* ================= ESTÁDIO (capacidade / receita) ================= */
  TM.ui.register("club-stadium", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; } ensure(c);
    var back = (params && params.from) || "coach-hub";
    var club = TM.data.club(c.teamId), st = TM.data.stadium(club);
    screen.appendChild(TM.ui.topbar("🏟️ Estádio", function () { TM.ui.go(back); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var sb = TM.ui.stadiumBanner(club, { label: st.name + " · +" + Math.round((stadIncomeMult(c) - 1) * 100) + "% de receita" });
    if (sb) body.appendChild(sb);
    var bar = el("div", { class: "ct-bar" });
    for (var i = 1; i <= 3; i++) bar.appendChild(el("div", { class: "ct-seg" + (i <= (c.stadiumUp || 0) ? " on" : "") }));
    body.appendChild(bar);
    body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "Ampliar o estádio aumenta a capacidade e a receita de bilheteria (mais dinheiro por jogo em casa)." }));
    if ((c.stadiumUp || 0) >= 3) {
      body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "🏟️ Estádio no tamanho máximo." }));
    } else {
      var next = (c.stadiumUp || 0) + 1, cost = stadUpgradeCost(c, next), afford = c.budget >= cost;
      body.appendChild(el("div", { class: "nego-panel" }, [
        el("div", { class: "nego-quote", text: "Ampliação nível " + next + ": custa " + money(c, cost) + " e eleva a receita de bilheteria para +" + Math.round(0.14 * next * 100) + "%." }),
        TM.ui.button("🏗️ Ampliar estádio (" + money(c, cost) + ")", function () {
          if (!afford) { TM.ui.toast("Caixa insuficiente."); return; }
          TM.ui.confirm("Ampliar o estádio?", "Custo de " + money(c, cost) + ".", "Ampliar", function () {
            c.budget -= cost; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + cost; c.stadiumUp = next;
            TM.notify.push(c, { icon: "🏟️", title: "Estádio ampliado", news: true, text: "A capacidade do " + st.name + " aumentou — mais receita de bilheteria por jogo." });
            TM.storage.saveCoachCareer(c); TM.ui.go("club-stadium", { from: back });
          });
        }, "btn " + (afford ? "primary" : "ghost"))
      ]));
    }
  });

  /* ================= CT (centro de treinamento) ================= */
  TM.ui.register("club-ct", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("coach"); return; } ensure(c);
    var back = (params && params.from) || "coach-hub";
    screen.appendChild(TM.ui.topbar("🏋️ Centro de Treinamento", function () { TM.ui.go(back); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "ct-level" }, [
      el("div", { class: "ct-badge", text: "Nível " + c.ctLevel }),
      el("div", {}, [ el("div", { class: "ct-name", text: ctDesc(c.ctLevel) + " CT" }), el("div", { class: "setting-hint", text: "Um CT melhor dá um empurrão no rendimento do time nos jogos e custa manutenção por temporada (" + money(c, ctUpkeep(c, c.ctLevel)) + ")." }) ])
    ]));
    var bar = el("div", { class: "ct-bar" });
    for (var i = 1; i <= 5; i++) bar.appendChild(el("div", { class: "ct-seg" + (i <= c.ctLevel ? " on" : "") }));
    body.appendChild(bar);
    if (c.ctLevel >= 5) {
      body.appendChild(el("div", { class: "setting-hint", style: "text-align:center", text: "🏆 Seu CT já é elite mundial — nível máximo." }));
    } else {
      var next = c.ctLevel + 1, cost = ctUpgradeCost(c, next), afford = c.budget >= cost;
      body.appendChild(el("div", { class: "nego-panel" }, [
        el("div", { class: "nego-quote", text: "Melhorar para o nível " + next + " (" + ctDesc(next) + ") custa " + money(c, cost) + "." }),
        TM.ui.button("🏗️ Melhorar CT (" + money(c, cost) + ")", function () {
          if (!afford) { TM.ui.toast("Caixa insuficiente para a obra"); return; }
          TM.ui.confirm("Investir no CT?", "Custo de " + money(c, cost) + " para chegar ao nível " + next + ".", "Investir", function () {
            c.budget -= cost; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + cost; c.ctLevel = next;
            TM.notify.push(c, { icon: "🏋️", title: "CT melhorado", news: true, text: "O CT foi elevado ao nível " + next + " (" + ctDesc(next) + ")." });
            TM.storage.saveCoachCareer(c); TM.ui.go("club-ct", { from: back });
          });
        }, "btn " + (afford ? "primary" : "ghost"))
      ]));
    }
  });

  // rotas antigas (saves/links antigos)
  TM.ui.register("director-hub", function () { migrateDirector(TM.storage.coachCareer()); TM.ui.go("coach-hub"); });
  TM.ui.register("director-sponsors", function (screen, params) { TM.ui.go("club-sponsors", params); });

  TM.club = { ensure: ensure, migrateDirector: migrateDirector, maybeSafOffer: maybeSafOffer, safCard: safCard, financePanels: financePanels, onOfferRejected: onOfferRejected, onPlayerSold: onPlayerSold, evaluateSaf: evaluateSaf, safClauses: makeClauses, safPenalty: safPenalty, acceptSaf: acceptSaf,
    sponsorIncome: sponsorIncome, sponsorNames: sponsorNames, matchIncome: matchIncome, seasonTick: seasonTick, clubEdge: clubEdge,
    ctUpkeep: ctUpkeep, stadIncomeMult: stadIncomeMult, loansDue: loansDue, TIERS: TIERS };
  TM.director = { ensureDirector: ensure };
})(window);
