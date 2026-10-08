/* ================= TOTAL ULTIMATE — DME (Desafios de Montagem de Elenco) =================
   Como os SBC do Ultimate Team atual, em categorias:
     - Em alta: o DME de jogador da semana (carta especial em duas partes)
     - Melhorias: trocas repetíveis (cartas fracas → pacote ou jogador melhor)
     - Jogadores: cartas especiais que só saem montando elenco
     - Ligas e Países: um por liga/país grande
     - Básicos: os desafios clássicos do modo (uma vez cada)
     - Do dia: um desafio novo por dia
   Requisitos: nota da equipe (com a correção de quem está acima da média),
   química (0–33), raridade, raras, especiais, Seleção da Semana, mesma liga /
   país / clube, liga ou país específicos e no máximo N de uma liga.
   "Montar com as mais baratas" faz a busca local: começa com as cartas mais
   baratas na posição e vai trocando uma por uma até cumprir tudo gastando o
   mínimo (evita os titulares e as cartas especiais/evoluídas). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  function I() { return TM.ut._i; }
  function M() { return TM.utModos; }
  function ic(n) { return TM.ic(n); }

  var RAR_ORD = ["b", "s", "g", "l"];
  var LIGAS = [["br", "Brasileirão"], ["en", "Premier League"], ["es", "LaLiga"], ["it", "Serie A"], ["de", "Bundesliga"], ["fr", "Ligue 1"]];
  var PAISES = ["Brazil", "Argentina", "France", "England", "Spain", "Portugal"];
  var PAIS_PT = { Brazil: "Brasil", Argentina: "Argentina", France: "França", England: "Inglaterra", Spain: "Espanha", Portugal: "Portugal" };

  /* ---------- catálogo ---------- */
  // rep: 0 = uma vez · n>0 = n por semana · "dia" = uma por dia
  var BASICOS = [
    { id: "start", n: "Primeiros Passos", tip: "Um time inteiro, sem exigência de nota.", req: [{ t: "chem", v: 8 }], rec: { coins: 2500, packs: ["prata"] } },
    { id: "liga", n: "Liga Doméstica", tip: "Onze jogadores da mesma liga.", req: [{ t: "sameLeague", v: 11 }, { t: "ov", v: 68 }], rec: { coins: 4000, packs: ["ouro"] } },
    { id: "nacao", n: "Time Nacional", tip: "Onze jogadores do mesmo país.", req: [{ t: "sameNation", v: 11 }, { t: "ov", v: 70 }], rec: { coins: 6000, packs: ["ouro"] } },
    { id: "clube", n: "Base do Clube", tip: "Quatro jogadores do mesmo clube.", req: [{ t: "sameClub", v: 4 }, { t: "ov", v: 74 }], rec: { coins: 8000, packs: ["ouro"] } },
    { id: "ouro", n: "Elenco de Ouro", tip: "Só cartas Craque (ouro) ou melhores e química alta.", req: [{ t: "rar", r: "g", v: 11 }, { t: "chem", v: 20 }], rec: { coins: 15000, packs: ["ourorare"] } },
    { id: "raros", n: "Coleção de Raros", tip: "Onze cartas raras.", req: [{ t: "raras", v: 11 }, { t: "ov", v: 76 }], rec: { coins: 15000, packs: ["ourorare"] } },
    { id: "semana", n: "Seleção da Semana", tip: "Uma carta da Seleção da Semana no elenco.", req: [{ t: "totw", v: 1 }, { t: "ov", v: 78 }], rec: { coins: 25000, packs: ["mega"] } },
    { id: "elite", n: "Elite Continental", tip: "Nota 82 e química quase perfeita.", req: [{ t: "ov", v: 82 }, { t: "chem", v: 26 }], rec: { coins: 35000, packs: ["jumbo"] } },
    { id: "lenda", n: "Elenco Lendário", tip: "O desafio mais duro do modo.", req: [{ t: "ov", v: 86 }, { t: "chem", v: 30 }], rec: { coins: 120000, packs: ["premium"] } }
  ];
  var MELHORIAS = [
    { id: "m_base", n: "Troca de Base", tip: "Onze cartas Base (bronze) viram um Pacote Prata.", req: [{ t: "maxRar", r: "b" }], rec: { packs: ["prata"] }, rep: 99 },
    { id: "m_elite", n: "Melhoria Elite", tip: "Onze cartas Elite (prata) viram um Pacote Craque.", req: [{ t: "rar", r: "s", v: 11 }, { t: "maxRar", r: "s" }], rec: { packs: ["ouro"] }, rep: 99 },
    { id: "m_raros", n: "Troca de Raros", tip: "Onze raras de nota 75 viram um Craque Raro.", req: [{ t: "raras", v: 11 }, { t: "ov", v: 75 }], rec: { packs: ["ourorare"] }, rep: 5 },
    { id: "m_80", n: "Melhoria 80+", tip: "Um jogador 80 ou mais, sorteado.", req: [{ t: "ov", v: 79 }, { t: "chem", v: 12 }], rec: { carta: { lo: 80, hi: 99 } }, rep: 5 },
    { id: "m_83", n: "Melhoria 83+", tip: "Um jogador 83 ou mais, sorteado.", req: [{ t: "ov", v: 82 }, { t: "chem", v: 16 }], rec: { carta: { lo: 83, hi: 99 } }, rep: 3 },
    { id: "m_85", n: "Escolha 85+", tip: "Escolha 1 entre 3 jogadores 85 ou mais.", req: [{ t: "ov", v: 84 }, { t: "chem", v: 20 }, { t: "especial", v: 1 }], rec: { pick: { n: 3, lo: 85 } }, rep: 1 }
  ];
  function ligasPaises() {
    var out = [];
    LIGAS.forEach(function (L, i) {
      out.push({ id: "lg_" + L[0], n: "Desafio " + L[1], tip: "Cinco jogadores da " + L[1] + " e nota 72.", req: [{ t: "liga", lg: L[0], v: 5 }, { t: "ov", v: 72 }, { t: "chem", v: 14 }], rec: { coins: 6000, packs: ["ourorare"] } });
    });
    PAISES.forEach(function (P) {
      out.push({ id: "pa_" + P, n: "Desafio " + PAIS_PT[P], tip: "Cinco jogadores de " + PAIS_PT[P] + " e nota 74.", req: [{ t: "pais", pais: P, v: 5 }, { t: "ov", v: 74 }, { t: "chem", v: 14 }], rec: { coins: 8000, pick: { n: 3, lo: 82 } } });
    });
    return out;
  }
  // DME de jogador da semana: um craque 82–87 vira "Craque do Mês" em duas partes
  var _jog = null, _jogW = -1;
  function dmeJogador() {
    var U = I(), w = U.weekOf();
    if (_jog && _jogW === w) return _jog;
    var rnd = U.mulberry(U.hashStr("dmej" + w));
    var cands = U.pool().filter(function (p) { return p.overall >= 82 && p.overall <= 87; });
    var p = cands[Math.floor(rnd() * cands.length)];
    var p2 = cands[Math.floor(rnd() * cands.length)];
    var lg = p ? U.leagueOf(p) : null;
    _jog = [];
    if (p) _jog.push({
      id: "j_" + w + "_" + p.id, n: p.name, cat: "jog", tip: "Craque do Mês (+3) · termina na virada da semana", destaque: { p: p.id, v: "mes" },
      partes: [
        { id: "a", n: "Parte 1 · Nota 81", req: [{ t: "ov", v: 81 }, { t: "chem", v: 16 }] },
        { id: "b", n: "Parte 2 · " + U.nomeLiga(lg), req: [{ t: "liga", lg: lg, v: 3 }, { t: "ov", v: 80 }, { t: "chem", v: 18 }] }
      ],
      rec: { carta: { p: p.id, v: "mes" } }
    });
    if (p2 && p2 !== p) _jog.push({
      id: "j2_" + w + "_" + p2.id, n: p2.name, cat: "jog", tip: "Destaque da Rodada (+1) · termina na virada da semana", destaque: { p: p2.id, v: "rodada" },
      partes: [{ id: "a", n: "Nota 80", req: [{ t: "ov", v: 80 }, { t: "chem", v: 14 }] }],
      rec: { carta: { p: p2.id, v: "rodada" } }
    });
    _jogW = w;
    return _jog;
  }
  // desafio do dia: requisitos sorteados pela data
  function dmeDia() {
    var U = I(), d = U.today(), rnd = U.mulberry(U.hashStr("dmed" + d));
    var L = LIGAS[Math.floor(rnd() * LIGAS.length)];
    var ov = 68 + Math.floor(rnd() * 8);
    return { id: "dia_" + d, n: "Desafio do Dia", tip: "Muda todo dia.", rep: "dia",
             req: [{ t: "liga", lg: L[0], v: 2 + Math.floor(rnd() * 3) }, { t: "ov", v: ov }, { t: "chem", v: 10 + Math.floor(rnd() * 8) }],
             rec: { coins: 2500 + (ov - 68) * 600, packs: [ov >= 73 ? "ouro" : "prata"] } };
  }
  function catalogo() {
    return [
      { id: "alta", nome: "Em alta", lista: dmeJogador().concat([dmeDia()]) },
      { id: "melh", nome: "Melhorias", lista: MELHORIAS },
      { id: "jog", nome: "Jogadores", lista: dmeJogador() },
      { id: "lp", nome: "Ligas e Países", lista: ligasPaises() },
      { id: "bas", nome: "Básicos", lista: BASICOS }
    ];
  }
  function porId(id) {
    var achou = null;
    catalogo().forEach(function (c) { c.lista.forEach(function (x) { if (x.id === id) achou = x; }); });
    return achou;
  }

  /* ---------- situação de cada DME ---------- */
  function feitos(s) { s.sbc = s.sbc || {}; s.sbcRep = s.sbcRep || {}; s.sbcPartes = s.sbcPartes || {}; return s; }
  function situacao(s, x) {
    feitos(s);
    var U = I();
    if (x.partes) {
      var pf = s.sbcPartes[x.id] || {}, n = x.partes.filter(function (p) { return pf[p.id]; }).length;
      return { feito: !!s.sbc[x.id], txt: s.sbc[x.id] ? "Concluído" : n + "/" + x.partes.length + " partes", pode: !s.sbc[x.id] };
    }
    if (x.rep === "dia") { var dd = s.sbcRep[x.id]; return { feito: !!dd, txt: dd ? "Feito hoje" : "1 por dia", pode: !dd }; }
    if (x.rep) {
      var r = s.sbcRep[x.id], w = U.weekOf(), n2 = r && r.w === w ? r.n : 0;
      return { feito: n2 >= x.rep, txt: x.rep >= 99 ? "Repetível" + (n2 ? " · " + n2 + " feitos" : "") : n2 + "/" + x.rep + " nesta semana", pode: n2 < x.rep };
    }
    return { feito: !!s.sbc[x.id], txt: s.sbc[x.id] ? "Concluído" : "Uma vez", pode: !s.sbc[x.id] };
  }
  function marcaFeito(s, x, parte) {
    feitos(s);
    var U = I();
    if (x.partes) {
      var pf = s.sbcPartes[x.id] = s.sbcPartes[x.id] || {};
      pf[parte.id] = 1;
      var todas = x.partes.every(function (p) { return pf[p.id]; });
      if (todas) s.sbc[x.id] = 1;
      return todas;
    }
    if (x.rep === "dia") { s.sbcRep[x.id] = 1; return true; }
    if (x.rep) { var w = U.weekOf(), r = s.sbcRep[x.id]; if (!r || r.w !== w) r = s.sbcRep[x.id] = { w: w, n: 0 }; r.n++; return true; }
    s.sbc[x.id] = 1; return true;
  }

  /* ---------- requisitos ---------- */
  function rotulo(r) {
    var U = I();
    if (r.t === "ov") return "Nota da equipe: mín. " + r.v;
    if (r.t === "chem") return "Química do time: mín. " + r.v + " (de 33)";
    if (r.t === "sameLeague") return "Da mesma liga: " + r.v;
    if (r.t === "sameNation") return "Do mesmo país: " + r.v;
    if (r.t === "sameClub") return "Do mesmo clube: " + r.v;
    if (r.t === "rar") return "Cartas " + U.RAR_NAME[r.r] + " (" + U.RAR_COR[r.r] + ") ou melhores: " + r.v;
    if (r.t === "maxRar") return "Só cartas " + U.RAR_NAME[r.r] + " (" + U.RAR_COR[r.r] + ") ou mais fracas";
    if (r.t === "raras") return "Cartas raras ou especiais: " + r.v;
    if (r.t === "especial") return "Cartas especiais (TOTW, Craque do Mês...): " + r.v;
    if (r.t === "totw") return "Cartas da Seleção da Semana: " + r.v;
    if (r.t === "liga") return "Da " + U.nomeLiga(r.lg) + ": mín. " + r.v;
    if (r.t === "pais") return "De " + (PAIS_PT[r.pais] || r.pais) + ": mín. " + r.v;
    return "Requisito";
  }
  var _nid = {};
  function idPais(nome) { if (_nid[nome] === undefined) { var n = null; try { n = TM.data.nationByName(nome); } catch (e) {} _nid[nome] = n ? n.id : null; } return _nid[nome]; }
  function maxGrupo(ds, fn) { var m = {}, best = 0; ds.forEach(function (d) { var k = d && fn(d); if (!k) return; m[k] = (m[k] || 0) + 1; if (m[k] > best) best = m[k]; }); return best; }
  // nota "contínua" (antes de arredondar): serve para a busca saber que está chegando perto
  function notaBruta(ovs) {
    var S = 0; ovs.forEach(function (x) { S += x || 0; });
    var med = S / 11, E = 0;
    ovs.forEach(function (x) { if (x > med) E += x - med; });
    return Math.round(S + E) / 11;
  }
  function filtroReq(r) {
    if (r.t === "liga") return function (d) { return d.lg === r.lg; };
    if (r.t === "pais") { var nid = idPais(r.pais); return function (d) { return d.nat === nid; }; }
    if (r.t === "totw") return function (d) { return d.ver === "totw"; };
    if (r.t === "especial") return function (d) { return d.ver !== "base" && d.ver !== "rare"; };
    if (r.t === "raras") return function (d) { return d.ver !== "base"; };
    if (r.t === "rar") { var mi = RAR_ORD.indexOf(r.r); return function (d) { return RAR_ORD.indexOf(d.rar) >= mi; }; }
    if (r.t === "maxRar") { var mx = RAR_ORD.indexOf(r.r); return function (d) { return RAR_ORD.indexOf(d.rar) <= mx; }; }
    return null;
  }
  // avalia 11 cardData (ou nulos) na formação: { linhas[{label,have,need,ok}], ok, ov, chem, per, falta }
  function avaliaDs(req, ds, F) {
    var U = I(), cheios = ds.filter(Boolean);
    var ch = U.chemDe(ds, F), ovs = ds.map(function (d) { return d ? d.ov : 0; });
    var ov = U.notaEquipe(ovs), bruta = notaBruta(ovs);
    var linhas = [{ label: "Jogadores: 11", have: cheios.length, need: 11, ok: cheios.length === 11 }];
    var falta = (11 - cheios.length) * 6;
    req.forEach(function (r) {
      var have = 0, need = r.v, fx = filtroReq(r);
      if (r.t === "ov") { have = ov; falta += Math.max(0, r.v - bruta) * 4; }
      else if (r.t === "chem") have = ch.team;
      else if (r.t === "sameLeague") have = maxGrupo(cheios, function (d) { return d.lg; });
      else if (r.t === "sameNation") have = maxGrupo(cheios, function (d) { return d.nat; });
      else if (r.t === "sameClub") have = maxGrupo(cheios, function (d) { return d.club ? d.club.id : null; });
      else if (r.t === "maxRar") { have = cheios.filter(fx).length; need = 11; }
      else if (fx) have = cheios.filter(fx).length;
      if (r.t !== "ov") falta += Math.max(0, need - have) * (r.t === "chem" ? 1.2 : 2);
      linhas.push({ label: rotulo(r), have: have, need: need, ok: have >= need });
    });
    return { linhas: linhas, ok: linhas.every(function (l) { return l.ok; }), ov: ov, chem: ch.team, per: ch.per, falta: falta };
  }
  function avalia(req, cards, F) {
    var U = I();
    return avaliaDs(req, cards.map(function (c) { return c ? U.cardData(c) : null; }), F);
  }

  /* ---------- cartas que podem ir para o DME ---------- */
  function disponiveis(s) {
    var U = I(), listadas = {};
    ((s.mkt && s.mkt.sell) || []).forEach(function (L) { if (L && L.card) listadas[L.card.i] = 1; });
    return (s.cards || []).filter(function (c) { return !U.ehEmprestimo(c) && !listadas[c.i]; });
  }
  // custo de usar a carta: preço, e bem mais caro se for titular, especial ou evoluída
  function custo(s, c, xi) {
    var U = I(), d = U.cardData(c); if (!d) return 1e9;
    var v = U.basePrice(d.ov, d.ver);
    if (xi[c.i]) v = v * 2.5 + 3000;
    if (d.ver !== "base" && d.ver !== "rare") v *= 1.6;
    if (c.evo) v = v * 3 + 20000;
    try { if (TM.utEvo && TM.utEvo.emEvolucao(s, c.i)) v = v * 3 + 40000; } catch (e) {}
    return v;
  }
  /* busca local ("montar com as mais baratas"):
     1) só entram cartas que servem para as 11 (ex.: "só Base", "11 raras", "11 da mesma liga" → o grupo com mais cartas);
     2) as exigidas (liga, país, clube, TOTW, especiais...) entram primeiro, as mais baratas, de preferência na posição;
     3) o resto é preenchido com as mais baratas na posição;
     4) troca uma carta por outra (ou duas casas entre si) enquanto diminuir o que falta e, empatado, o custo. */
  function montaBarato(s, req, F) {
    var U = I(), xi = {};
    s.squad.xi.forEach(function (c) { if (c) xi[c] = 1; });
    var todas = disponiveis(s), D = {}, C = {};
    todas.forEach(function (c) { var d = U.cardData(c); if (d) { D[c.i] = d; C[c.i] = custo(s, c, xi); } });
    var validas = todas.filter(function (c) {
      var d = D[c.i]; if (!d) return false;
      return req.every(function (r) {
        var fx = filtroReq(r);
        if (r.t === "maxRar") return fx(d);
        if ((r.t === "rar" || r.t === "raras") && r.v >= 11) return fx(d);
        return true;
      });
    });
    req.forEach(function (r) {
      if ((r.t === "sameLeague" || r.t === "sameNation") && r.v >= 11) {
        var chave = r.t === "sameLeague" ? "lg" : "nat", cont = {};
        validas.forEach(function (c) { var k = D[c.i][chave]; if (k) cont[k] = (cont[k] || 0) + 1; });
        var top = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; })[0];
        validas = validas.filter(function (c) { return String(D[c.i][chave]) === String(top); });
      }
    });
    validas.sort(function (a, b) { return C[a.i] - C[b.i]; });
    var obrig = [];
    req.forEach(function (r) {
      var fx = filtroReq(r);
      if (fx && r.t !== "maxRar" && !((r.t === "rar" || r.t === "raras") && r.v >= 11)) obrig.push({ f: fx, n: r.v });
      if ((r.t === "sameClub") || ((r.t === "sameLeague" || r.t === "sameNation") && r.v < 11)) {
        var ch2 = r.t === "sameClub" ? function (d) { return d.club ? d.club.id : null; } : r.t === "sameLeague" ? function (d) { return d.lg; } : function (d) { return d.nat; };
        var cont2 = {};
        validas.forEach(function (c) { var k = ch2(D[c.i]); if (k) cont2[k] = (cont2[k] || 0) + 1; });
        var top2 = Object.keys(cont2).sort(function (a, b) { return cont2[b] - cont2[a]; })[0];
        if (top2) obrig.push({ f: function (d) { return String(ch2(d)) === String(top2); }, n: r.v });
      }
    });
    function busca(inicio) {
    var slots = F.map(function () { return null; }), usado = {};
    function poe(c) {
      var d = D[c.i], livre = -1;
      F.forEach(function (slot, i) { if (livre < 0 && !slots[i] && U.emPosicao(d, U.slotRole(slot))) livre = i; });
      if (livre < 0) F.forEach(function (slot, i) { if (livre < 0 && !slots[i] && slot[0] === d.pos) livre = i; });
      if (livre < 0) F.forEach(function (slot, i) { if (livre < 0 && !slots[i]) livre = i; });
      if (livre >= 0) { slots[livre] = c; usado[c.i] = 1; }
    }
    obrig.forEach(function (o) {
      var ja = slots.filter(function (c) { return c && o.f(D[c.i]); }).length;
      validas.forEach(function (c) { if (ja < o.n && !usado[c.i] && o.f(D[c.i])) { poe(c); ja++; } });
    });
    F.forEach(function (slot, i) {
      if (slots[i]) return;
      var role = U.slotRole(slot), achou = null;
      for (var k = 0; k < inicio.length && !achou; k++) { var c = inicio[k]; if (!usado[c.i] && U.emPosicao(D[c.i], role)) achou = c; }
      for (var k2 = 0; k2 < inicio.length && !achou; k2++) { var c2 = inicio[k2]; if (!usado[c2.i] && D[c2.i].pos === slot[0]) achou = c2; }
      for (var k3 = 0; k3 < inicio.length && !achou; k3++) { if (!usado[inicio[k3].i]) achou = inicio[k3]; }
      if (achou) { slots[i] = achou; usado[achou.i] = 1; }
    });
    function valor(sl) {
      var a = avaliaDs(req, sl.map(function (c) { return c ? D[c.i] : null; }), F), cs = 0;
      sl.forEach(function (c) { if (c) cs += C[c.i]; });
      return { f: a.falta, c: cs };
    }
    function melhorQue(a, b) { return a.f < b.f - 1e-9 || (Math.abs(a.f - b.f) < 1e-9 && a.c < b.c - 1); }
    var atual = valor(slots);
    var porNota = validas.slice().sort(function (a, b) { return D[b.i].ov - D[a.i].ov; });
    var cands = validas.slice(0, 110), visto = {};
    cands.forEach(function (c) { visto[c.i] = 1; });
    porNota.slice(0, 50).forEach(function (c) { if (!visto[c.i]) { cands.push(c); visto[c.i] = 1; } });
    for (var volta = 0; volta < 45; volta++) {
      var mv = atual, jogada = null;
      for (var i = 0; i < slots.length; i++) {
        for (var k4 = 0; k4 < cands.length; k4++) {
          var c4 = cands[k4]; if (usado[c4.i]) continue;
          var tenta = slots.slice(); tenta[i] = c4;
          var v = valor(tenta);
          if (melhorQue(v, mv)) { mv = v; jogada = { t: "troca", i: i, c: c4 }; }
        }
        for (var j = i + 1; j < slots.length; j++) {
          if (!slots[i] || !slots[j]) continue;
          var t2 = slots.slice(); t2[i] = slots[j]; t2[j] = slots[i];
          var v2 = valor(t2);
          if (melhorQue(v2, mv)) { mv = v2; jogada = { t: "casas", i: i, j: j }; }
        }
      }
      if (!jogada) break;
      if (jogada.t === "troca") { if (slots[jogada.i]) delete usado[slots[jogada.i].i]; slots[jogada.i] = jogada.c; usado[jogada.c.i] = 1; }
      else { var tmp = slots[jogada.i]; slots[jogada.i] = slots[jogada.j]; slots[jogada.j] = tmp; }
      atual = mv;
    }
    return { slots: slots, v: atual };
    }
    // duas largadas: das mais baratas e das de nota mais alta; fica a melhor
    var r1 = busca(validas);
    if (r1.v.f === 0) return r1.slots;
    var r2 = busca(validas.slice().sort(function (a, b) { return D[b.i].ov - D[a.i].ov || C[a.i] - C[b.i]; }));
    return (r2.v.f < r1.v.f - 1e-9 || (Math.abs(r2.v.f - r1.v.f) < 1e-9 && r2.v.c < r1.v.c)) ? r2.slots : r1.slots;
  }

  /* ================= telas ================= */
  function recIcone(r) { return r.carta ? "sparkles" : r.pick ? "user-search" : r.packs ? "package" : "tm-moeda"; }
  function custoEstimado(req) {
    var U = I(), ov = 0;
    req.forEach(function (r) { if (r.t === "ov") ov = r.v; });
    if (!ov) return null;
    return U.basePrice(ov - 1, "base") * 7 + U.basePrice(ov + 1, "base") * 4;
  }
  TM.ui.register("ut-sbc", function (screen, params) {
    var U = I(), s = U.st(); if (!s) { U.goUT("ut"); return; }
    feitos(s);
    var cats = catalogo(), aba = (params && params.aba) || s.sbcAba || "alta";
    screen.classList.add("ut-screen");
    screen.appendChild(U.utTop("DME", function () { U.goUT("ut"); }, s));
    var chips = el("div", { class: "ut-chips utq-cats" }), body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "ut-tip", text: "Desafios de Montagem de Elenco: monte 11 que cumpram os requisitos e troque por prêmios. As cartas enviadas saem do clube." }));
    body.appendChild(chips);
    var lista = el("div", { class: "utq-lista" });
    body.appendChild(lista);
    function desenha() {
      TM.ui.clear(chips); TM.ui.clear(lista);
      cats.forEach(function (c) {
        var abertos = c.lista.filter(function (x) { return situacao(s, x).pode; }).length;
        chips.appendChild(el("button", { class: "ut-chip" + (aba === c.id ? " on" : ""), text: c.nome + (abertos ? " · " + abertos : ""), on: { click: function () { aba = c.id; s.sbcAba = c.id; desenha(); } } }));
      });
      var cat = cats.filter(function (c) { return c.id === aba; })[0] || cats[0];
      cat.lista.forEach(function (x) { lista.appendChild(tile(x)); });
    }
    function tile(x) {
      var st = situacao(s, x), dest = null;
      if (x.destaque) {
        var pl = TM.data.player(x.destaque.p);
        if (pl) dest = U.cardData({ i: "dest", p: pl.id, v: x.destaque.v, r: U.rarOf(pl.overall + U.verBonus(x.destaque.v)) });
      }
      var reqs = x.partes ? x.partes.map(function (p) { return p.n; }) : x.req.map(rotulo);
      var ce = !x.partes && custoEstimado(x.req);
      return el("button", { class: "utq-tile" + (st.feito ? " feito" : "") + (dest ? " jog" : ""), on: { click: function () { if (st.pode) U.goUT("ut-sbc-build", { id: x.id }); else TM.ui.toast(x.n + ": " + st.txt); } } }, [
        dest ? U.cardEl(dest, { cls: "mini" }) : el("div", { class: "utq-ic" }, [ic(recIcone(x.rec))]),
        el("div", { class: "utq-i" }, [
          el("div", { class: "utq-n", text: x.n }),
          el("div", { class: "utq-t", text: x.tip }),
          el("div", { class: "utq-req", text: reqs.join(" · ") }),
          el("div", { class: "utq-rod" }, [
            el("span", { class: "utq-rec" }, [ic("gift"), document.createTextNode(" " + M().recTexto(x.rec))]),
            el("span", { class: "utq-st", text: st.txt + (ce ? " · custo ~" + U.fmtC(ce) : "") })
          ])
        ]),
        el("span", { class: "utq-go" }, [ic(st.feito ? "circle-check" : "chevron-right")])
      ]);
    }
    desenha();
  });

  TM.ui.register("ut-sbc-build", function (screen, params) {
    var U = I(), s = U.st(); if (!s) { U.goUT("ut"); return; }
    var x = porId((params || {}).id); if (!x) { U.goUT("ut-sbc"); return; }
    var parte = null;
    if (x.partes) {
      var pf = (feitos(s).sbcPartes[x.id]) || {};
      parte = x.partes.filter(function (p) { return !pf[p.id]; })[0] || x.partes[0];
    }
    var req = parte ? parte.req : x.req;
    var fName = "4-3-3", F = TM.comp.FORMATIONS[fName];
    var slots = [null, null, null, null, null, null, null, null, null, null, null];
    screen.classList.add("ut-screen");
    screen.appendChild(U.utTop(x.n, function () { U.goUT("ut-sbc"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    draw();

    function draw() {
      TM.ui.clear(body);
      var a = avalia(req, slots, F);
      body.appendChild(el("div", { class: "utq-head" }, [
        el("div", { class: "utq-head-i" }, [
          el("div", { class: "utq-head-n", text: parte ? parte.n : x.n }),
          el("div", { class: "utq-head-r" }, [ic("gift"), document.createTextNode(" " + M().recTexto(x.rec) + (x.partes ? " (ao concluir as " + x.partes.length + " partes)" : ""))])
        ]),
        el("div", { class: "ut-sq-stat" }, [el("b", { text: a.ov || "—" }), el("i", { text: "NOTA" })]),
        el("div", { class: "ut-sq-stat chem" }, [el("b", { text: a.chem }), el("i", { text: "QUÍMICA" })])
      ]));
      body.appendChild(el("div", { class: "ut-reqs" }, a.linhas.map(function (c) {
        return el("div", { class: "ut-req " + (c.ok ? "ok" : "no") }, [
          el("span", { class: "ut-req-ic" }, [ic(c.ok ? "check" : "minus")]),
          el("span", { class: "ut-req-l", text: c.label }),
          el("span", { class: "ut-req-v", text: c.have + "/" + c.need })
        ]);
      })));
      var pitch = el("div", { class: "ut-pitch small" });
      F.forEach(function (slot, i) {
        var c = slots[i], d = c ? U.cardData(c) : null, role = U.slotRole(slot);
        var h = el("div", { class: "ut-slot", style: "left:" + slot[1] + "%;top:" + slot[2] + "%" }, [
          U.cardEl(d, { role: role, cls: "mini", chem: d ? a.per[i] : null, on: function () { escolhe(i); } })
        ]);
        pitch.appendChild(h);
      });
      body.appendChild(pitch);
      var usadosNoTime = slots.filter(function (c) { return c && s.squad.xi.indexOf(c.i) >= 0; }).length;
      var valor = slots.reduce(function (t, c) { var d = c && U.cardData(c); return t + (d ? U.basePrice(d.ov, d.ver) : 0); }, 0);
      body.appendChild(el("div", { class: "utm-nota-l", text: "Valor das cartas: ~" + U.fmtC(valor) + " moedas" + (usadosNoTime ? " · " + usadosNoTime + " titular(es) do seu time — vão sair do elenco" : "") }));
      body.appendChild(el("div", { class: "ut-sbc-acts" }, [
        TM.ui.button("Montar com as mais baratas", function () {
          var t0 = Date.now();
          slots = montaBarato(s, req, F);
          var a2 = avalia(req, slots, F);
          TM.ui.toast(a2.ok ? "Pronto: cumpre tudo com as cartas mais baratas que encontrei." : "Não deu para cumprir tudo com o seu clube. Veja o que falta.", a2.ok ? "ok" : "alerta");
          draw();
        }, "btn ghost wide"),
        TM.ui.button("Limpar", function () { slots = slots.map(function () { return null; }); draw(); }, "btn ghost small"),
        el("button", {
          class: "btn primary wide" + (a.ok ? "" : " off"), text: a.ok ? "Enviar elenco" : "Requisitos não cumpridos",
          on: { click: function () {
            if (!a.ok) return;
            TM.ui.confirm("Enviar o elenco?", "As 11 cartas saem do seu clube" + (usadosNoTime ? " (inclusive " + usadosNoTime + " titular" + (usadosNoTime > 1 ? "es" : "") + ")" : "") + ". Prêmio: " + M().recTexto(x.rec) + (x.partes && x.partes.length > 1 ? " ao terminar todas as partes." : "."), "Enviar", function () {
              slots.forEach(function (c) { if (c) U.removeCard(s, c.i); });
              var tudo = marcaFeito(s, x, parte);
              var notas = tudo ? M().darRecompensa(s, x.rec, "DME " + x.n) : [];
              U.save();
              U.emit("dme", { s: s, sbc: x, parte: parte, completo: tudo });
              var msg = tudo ? "DME concluído! " + notas.map(function (n) { return n.tx; }).join(", ") : parte.n + " concluída. Falta " + (x.partes.length - Object.keys(s.sbcPartes[x.id] || {}).length) + " parte(s).";
              TM.ui.toast(msg, "ok");
              U.goUT(tudo || !x.partes ? "ut-sbc" : "ut-sbc-build", tudo || !x.partes ? undefined : { id: x.id });
            });
          } }
        })
      ]));
    }

    function escolhe(idx) {
      var usados = {};
      slots.forEach(function (c, i) { if (c && i !== idx) usados[c.i] = 1; });
      var role = U.slotRole(F[idx]), xi = {};
      s.squad.xi.forEach(function (c) { if (c) xi[c] = 1; });
      var lista = disponiveis(s).map(U.cardData).filter(Boolean).filter(function (d) { return !usados[d.card.i]; });
      lista.sort(function (a, b) { return (U.emPosicao(b, role) - U.emPosicao(a, role)) || (U.basePrice(a.ov, a.ver) - U.basePrice(b.ov, b.ver)); });
      var sheet = el("div", { class: "ut-sheet" });
      sheet.appendChild(el("div", { class: "ut-sheet-in" }, [
        el("div", { class: "ut-sheet-h" }, [el("span", { text: "Carta para " + role + " (mais baratas primeiro)" }), el("button", { class: "ut-x", text: "✕", on: { click: fecha } })]),
        slots[idx] ? el("button", { class: "btn ghost small wide", text: "Tirar desta casa", on: { click: function () { slots[idx] = null; fecha(); draw(); } } }) : null,
        el("div", { class: "ut-pick-grid" }, lista.slice(0, 90).map(function (d) {
          return el("div", { class: "ut-pick-it" }, [
            U.cardEl(d, { cls: "tiny" + (xi[d.card.i] ? " insquad" : ""), on: function () { slots[idx] = d.card; fecha(); draw(); } }),
            el("span", { class: "ut-pick-fit " + (U.emPosicao(d, role) ? "ok" : "bad"), text: xi[d.card.i] ? "titular" : U.fmtC(U.basePrice(d.ov, d.ver)) })
          ]);
        }))
      ]));
      sheet.addEventListener("click", function (e) { if (e.target === sheet) fecha(); });
      document.body.appendChild(sheet); requestAnimationFrame(function () { sheet.classList.add("show"); });
      function fecha() { sheet.classList.remove("show"); setTimeout(function () { sheet.remove(); }, 200); }
    }
  });

  TM.utDme = { catalogo: catalogo, porId: porId, avalia: avalia, montaBarato: montaBarato, situacao: situacao, abertos: function (s) {
    var n = 0; catalogo().forEach(function (c) { if (c.id === "jog") return; c.lista.forEach(function (x) { if (situacao(s, x).pode && (x.partes || x.rep === "dia")) n++; }); }); return n;
  } };
})(window);
