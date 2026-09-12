/* ================= TOTAL ULTIMATE =================
   Modo de cartas: abra pacotes, monte o elenco com química,
   negocie no mercado, complete DMEs e suba de divisão nos Rivais. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var KEY = "ultimate";

  /* ================= utilidades ================= */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function shortNm(name) {
    var a = String(name || "").trim().split(/\s+/);
    return a.length > 1 ? a[a.length - 1] : (a[0] || "—");
  }
  function fullShort(name) {
    var a = String(name || "").trim().split(/\s+/);
    if (a.length < 2) return a[0] || "—";
    return a[0][0] + ". " + a[a.length - 1];
  }
  // moeda do modo (moedas UT) — formato 1.234.567
  function fmtC(n) {
    n = Math.round(n || 0);
    var s = String(Math.abs(n)), out = "";
    while (s.length > 3) { out = "." + s.slice(-3) + out; s = s.slice(0, -3); }
    return (n < 0 ? "−" : "") + s + out;
  }
  function coinsEl(n, cls) {
    return el("span", { class: "ut-coin " + (cls || "") }, [
      el("span", { class: "ut-coin-ic", text: "⬤" }), el("span", { text: fmtC(n) })
    ]);
  }
  function shuffle(a, rnd) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rnd ? rnd() : Math.random()) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // gerador determinístico (para TOTW e mercado do dia)
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function today() { return Math.floor(Date.now() / 86400000); }
  function weekOf() { return Math.floor(today() / 7); }

  /* ================= pool de jogadores ================= */
  var _pool = null, _byPos = null;
  function pool() {
    if (_pool) return _pool;
    var out = [];
    try {
      TM.data.world().clubs.forEach(function (c) {
        TM.data.clubPlayers(c.id).forEach(function (p) { if (p && p.overall) out.push(p); });
      });
    } catch (e) { out = []; }
    _pool = out;
    return _pool;
  }
  function poolByPos() {
    if (_byPos) return _byPos;
    _byPos = { GK: [], DF: [], MF: [], FW: [] };
    pool().forEach(function (p) { (_byPos[p.pos] || (_byPos[p.pos] = [])).push(p); });
    return _byPos;
  }
  function leagueOf(p) {
    var c = p && p.clubId ? TM.data.club(p.clubId) : null;
    return c ? (c.homeLeagueId || c.leagueId) : null;
  }
  function clubOf(p) { return p && p.clubId ? TM.data.club(p.clubId) : null; }

  /* ================= cartas ================= */
  // raridade pela nota; versões: base / rara / TOTW (Time da Semana)
  function rarOf(ov) { return ov >= 75 ? "g" : ov >= 65 ? "s" : "b"; }
  var RAR_NAME = { b: "Bronze", s: "Prata", g: "Ouro" };

  // Time da Semana: 23 jogadores sorteados por semana, com +2 de nota
  var _totw = null, _totwWeek = -1;
  function totwSet() {
    var w = weekOf();
    if (_totw && _totwWeek === w) return _totw;
    var rnd = mulberry(hashStr("totw" + w));
    var cands = pool().filter(function (p) { return p.overall >= 74; });
    var picked = {}, list = [];
    for (var i = 0; i < 400 && list.length < 23; i++) {
      var p = cands[Math.floor(rnd() * cands.length)];
      if (!p || picked[p.id]) continue;
      picked[p.id] = 1; list.push(p.id);
    }
    _totw = picked; _totwWeek = w; _totw.__list = list;
    return _totw;
  }
  function isTotw(pid) { var t = totwSet(); return !!t[pid]; }

  var _cardSeq = 0;
  function mkCard(p, ver) {
    ver = ver || "base";
    var ov = p.overall + (ver === "totw" ? 2 : 0);
    return { i: "c" + (Date.now() % 1e7) + "_" + (_cardSeq++), p: p.id, r: rarOf(ov), v: ver, ut: 0 };
  }
  // dados completos de uma carta (jogador + nota efetiva da versão)
  function cardData(card) {
    var p = TM.data.player(card.p);
    if (!p) return null;
    var ov = p.overall + (card.v === "totw" ? 2 : 0);
    return {
      card: card, p: p, ov: ov, pos: p.pos, pos2: p.pos2 || p.pos,
      name: p.name, rar: card.r, ver: card.v,
      club: clubOf(p), lg: leagueOf(p), nat: p.nationId,
      attrs: p.attrs || {}
    };
  }
  // preço-base de mercado de uma carta (moedas UT)
  function basePrice(ov, ver) {
    var v;
    if (ov <= 63) v = 200;
    else if (ov <= 69) v = 250 + (ov - 63) * 60;
    else if (ov <= 74) v = 650 + (ov - 69) * 190;
    else if (ov <= 79) v = 1600 + (ov - 74) * 900;
    else if (ov <= 84) v = 6100 + (ov - 79) * 4200;
    else if (ov <= 88) v = 27100 + (ov - 84) * 22000;
    else v = 115100 + (ov - 88) * 90000;
    if (ver === "totw") v = Math.round(v * 2.6);
    return Math.round(v);
  }
  function quickSell(ov, ver) { return Math.max(100, Math.round(basePrice(ov, ver) * 0.14)); }

  /* ================= química ================= */
  // papel específico de cada casa da formação (a partir das coordenadas)
  function slotRole(slot) {
    var pos = slot[0], x = slot[1], y = slot[2];
    if (pos === "GK") return "GOL";
    if (pos === "DF") { if (x <= 22) return "LE"; if (x >= 78) return "LD"; return "ZAG"; }
    if (pos === "MF") {
      if (x <= 18) return "ME"; if (x >= 82) return "MD";
      if (y >= 54) return "VOL"; if (y <= 36) return "MEI"; return "MC";
    }
    if (x <= 28) return "PE"; if (x >= 72) return "PD";
    return y >= 26 ? "SA" : "CA";
  }
  var SECTOR = { GOL: "GK", ZAG: "DF", LD: "DF", LE: "DF", VOL: "MF", MC: "MF", MEI: "MF", MD: "MF", ME: "MF", CA: "FW", PD: "FW", PE: "FW", SA: "FW" };
  var NEAR = { GK: ["DF"], DF: ["MF"], MF: ["DF", "FW"], FW: ["MF"] };
  // quanto a carta se encaixa na casa: 1 = posição exata
  function posFit(d, role) {
    if (!d) return 0;
    if (d.pos2 === role) return 1;
    var sec = SECTOR[role] || role;
    if (d.pos === sec) return 0.72;
    if ((NEAR[d.pos] || []).indexOf(sec) >= 0) return 0.34;
    return 0.08;
  }
  // ligações da formação: cada casa liga nas vizinhas mais próximas
  var _linkCache = {};
  function linksOf(fname) {
    if (_linkCache[fname]) return _linkCache[fname];
    var F = TM.comp.FORMATIONS[fname] || TM.comp.FORMATIONS["4-3-3"];
    var pairs = [], seen = {};
    F.forEach(function (a, i) {
      var ds = [];
      F.forEach(function (b, j) {
        if (i === j) return;
        var dx = a[1] - b[1], dy = (a[2] - b[2]) * 1.25;
        ds.push({ j: j, d: Math.sqrt(dx * dx + dy * dy) });
      });
      ds.sort(function (m, n) { return m.d - n.d; });
      ds.slice(0, 3).forEach(function (o) {
        if (o.d > 42) return;
        var k = Math.min(i, o.j) + "-" + Math.max(i, o.j);
        if (seen[k]) return; seen[k] = 1; pairs.push([Math.min(i, o.j), Math.max(i, o.j)]);
      });
    });
    _linkCache[fname] = pairs;
    return pairs;
  }
  // força da ligação entre duas cartas: 0 nada · 1 fraca · 2 boa · 3 perfeita
  function linkVal(a, b) {
    if (!a || !b) return 0;
    var n = 0;
    if (a.club && b.club && a.club.id === b.club.id) n += 1;
    if (a.lg && b.lg && a.lg === b.lg) n += 1;
    if (a.nat && b.nat && a.nat === b.nat) n += 1;
    return n;
  }
  // química completa do time: por jogador (0-10) e do time (0-100)
  function chemistry(s) {
    var F = s.squad.f, links = linksOf(F), F0 = TM.comp.FORMATIONS[F] || TM.comp.FORMATIONS["4-3-3"];
    var byId = cardMap(s);
    var ds = s.squad.xi.map(function (cid) { return cid && byId[cid] ? cardData(byId[cid]) : null; });
    var acc = ds.map(function () { return { n: 0, t: 0 }; });
    links.forEach(function (L) {
      var v = linkVal(ds[L[0]], ds[L[1]]);
      acc[L[0]].n++; acc[L[0]].t += v;
      acc[L[1]].n++; acc[L[1]].t += v;
    });
    var per = ds.map(function (d, i) {
      if (!d) return 0;
      var fit = posFit(d, slotRole(F0[i]));
      var avg = acc[i].n ? acc[i].t / acc[i].n : 0;      // 0..3
      var loyal = d.card.ut ? 1 : 0;                       // veio de pacote: lealdade
      return clamp(Math.round(fit * (3 + 6 * (avg / 3)) + loyal), 0, 10);
    });
    var filled = ds.filter(Boolean).length;
    var team = filled ? Math.round(per.reduce(function (a, b) { return a + b; }, 0) / 11 * 10) : 0;
    return { per: per, team: clamp(team, 0, 100), ds: ds, links: links };
  }
  // nota efetiva com química: −4 (química 0) a +4 (química 10)
  function effOv(ov, chem) { return clamp(ov + Math.round((chem - 5) * 0.8), 1, 99); }
  function squadRating(s) {
    var c = chemistry(s);
    var vals = c.ds.map(function (d) { return d ? d.ov : 0; });
    var n = vals.filter(function (v) { return v > 0; }).length;
    if (!n) return { ov: 0, chem: 0 };
    return { ov: Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / 11), chem: c.team };
  }

  /* ================= estado salvo ================= */
  var S = null;
  function blank() {
    return {
      v: 1, club: "", coins: 25000, cards: [],
      squad: { f: "4-3-3", xi: [null, null, null, null, null, null, null, null, null, null, null], sub: [] },
      mkt: { day: -1, buy: [], sell: [] },
      riv: { div: 10, pts: 0, pl: 0, w: 0, d: 0, l: 0, seas: 1, best: 10, wk: 0, wkDay: -1 },
      sbc: {}, obj: { day: -1, list: [] }, packs: [],
      stats: { opened: 0, sold: 0, bought: 0, earned: 0 },
      created: Date.now(), seed: Math.floor(Math.random() * 1e9)
    };
  }
  function st() {
    if (S) return S;
    S = TM.storage.read(KEY, null);
    if (!S || !S.squad) S = null;
    return S;
  }
  function save() { if (S) TM.storage.write(KEY, S); }
  function reset() { S = null; TM.storage.remove(KEY); }
  function cardMap(s) {
    var m = {};
    (s.cards || []).forEach(function (c) { m[c.i] = c; });
    return m;
  }
  function inSquad(s) {
    var m = {};
    s.squad.xi.forEach(function (c) { if (c) m[c] = 1; });
    (s.squad.sub || []).forEach(function (c) { if (c) m[c] = 1; });
    return m;
  }
  function addCard(s, card) { s.cards.push(card); return card; }
  function removeCard(s, cid) {
    s.cards = s.cards.filter(function (c) { return c.i !== cid; });
    s.squad.xi = s.squad.xi.map(function (c) { return c === cid ? null : c; });
    s.squad.sub = (s.squad.sub || []).filter(function (c) { return c !== cid; });
  }
  function earn(s, n, why) { s.coins = Math.round((s.coins || 0) + n); s.stats.earned = (s.stats.earned || 0) + Math.max(0, n); save(); }
  function pay(s, n) { if ((s.coins || 0) < n) return false; s.coins = Math.round(s.coins - n); save(); return true; }

  /* ================= pacotes ================= */
  var PACKS = [
    { id: "bronze", name: "Pacote Bronze", desc: "12 itens · 1 raro garantido", price: 400, n: 12, lo: 45, hi: 64, rare: 0.10 },
    { id: "prata", name: "Pacote Prata", desc: "12 itens · 1 raro garantido", price: 2500, n: 12, lo: 62, hi: 74, rare: 0.16, up: 0.04 },
    { id: "ouro", name: "Pacote Ouro", desc: "12 itens · mínimo 75 de nota", price: 7500, n: 12, lo: 75, hi: 99, rare: 0.22 },
    { id: "ourorare", name: "Ouro Raro", desc: "12 itens · todos raros", price: 25000, n: 12, lo: 75, hi: 99, rare: 1 },
    { id: "jumbo", name: "Jumbo Ouro Raro", desc: "24 itens · todos raros · 1 jogador 83+ garantido", price: 55000, n: 24, lo: 75, hi: 99, rare: 1, floor: 83 },
    { id: "mega", name: "Mega Pacote", desc: "24 itens · 1 jogador 86+ garantido · chance de Time da Semana", price: 125000, n: 24, lo: 78, hi: 99, rare: 1, floor: 86, totw: 0.35 },
    { id: "premium", name: "Pacote Premium", desc: "24 itens · 1 jogador 87+ garantido · alta chance de Time da Semana", tc: 15, n: 24, lo: 80, hi: 99, rare: 1, floor: 87, totw: 0.6 }
  ];
  function packById(id) { for (var i = 0; i < PACKS.length; i++) if (PACKS[i].id === id) return PACKS[i]; return null; }

  // sorteio ponderado: quanto maior a nota, muito mais raro (igual a abrir pacote de verdade)
  function drawPlayer(lo, hi, rnd, forcePos) {
    var src = forcePos ? (poolByPos()[forcePos] || pool()) : pool();
    for (var tries = 0; tries < 220; tries++) {
      var p = src[Math.floor(rnd() * src.length)];
      if (!p || p.overall < lo || p.overall > hi) continue;
      var w = Math.pow(0.70, Math.max(0, p.overall - lo));
      if (rnd() < w) return p;
    }
    // rede de segurança: pega qualquer um na faixa
    var f = src.filter(function (p) { return p.overall >= lo && p.overall <= hi; });
    return f.length ? f[Math.floor(rnd() * f.length)] : src[Math.floor(rnd() * src.length)];
  }
  function openPack(s, pk) {
    var rnd = Math.random, out = [];
    var n = pk.n;
    for (var i = 0; i < n; i++) {
      var p = drawPlayer(pk.lo, pk.hi, rnd, i === 0 ? "GK" : null);
      if (!p) continue;
      var ver = "base";
      if (rnd() < (pk.rare === 1 ? 1 : pk.rare)) ver = "rare";
      if (isTotw(p.id) && rnd() < (pk.totw || 0.05)) ver = "totw";
      out.push({ p: p, ver: ver });
    }
    // garantias do pacote
    if (pk.floor) {
      var best = out.reduce(function (a, b) { return (b.p.overall > (a ? a.p.overall : 0)) ? b : a; }, null);
      if (!best || best.p.overall < pk.floor) {
        var g = drawPlayer(pk.floor, 99, rnd);
        if (g) out[out.length - 1] = { p: g, ver: (isTotw(g.id) && rnd() < (pk.totw || 0.1)) ? "totw" : "rare" };
      }
    }
    if (pk.up && rnd() < pk.up) { var u = drawPlayer(75, 82, rnd); if (u) out[1] = { p: u, ver: "rare" }; }
    // vira cartas (do pacote = intransferível por lealdade? não: em FUT vêm negociáveis)
    var cards = out.map(function (o) {
      var c = mkCard(o.p, o.ver === "rare" ? "rare" : o.ver);
      c.ut = 1;   // veio de pacote: conta lealdade na química
      return c;
    });
    cards.forEach(function (c) { addCard(s, c); });
    s.stats.opened = (s.stats.opened || 0) + 1;
    save();
    return cards;
  }

  /* ================= mercado ================= */
  // o mercado do dia é gerado por semente: some quem foi comprado, repõe no dia seguinte
  function seedMarket(s) {
    var d = today();
    if (s.mkt.day === d && s.mkt.buy && s.mkt.buy.length) return;
    var rnd = mulberry(hashStr("mkt" + d + "" + s.seed));
    var list = [];
    var bands = [[45, 64, 16], [65, 74, 20], [75, 79, 18], [80, 83, 12], [84, 86, 7], [87, 99, 3]];
    bands.forEach(function (b) {
      for (var i = 0; i < b[2]; i++) {
        var p = drawPlayer(b[0], b[1], rnd);
        if (!p) continue;
        var ver = rnd() < 0.12 ? "rare" : "base";
        if (isTotw(p.id) && rnd() < 0.5) ver = "totw";
        var ov = p.overall + (ver === "totw" ? 2 : 0);
        var base = basePrice(ov, ver);
        var bin = Math.round(base * (0.85 + rnd() * 0.45) / 50) * 50;
        list.push({ k: "m" + d + "_" + list.length, p: p.id, v: ver, bin: Math.max(200, bin) });
      }
    });
    s.mkt.day = d; s.mkt.buy = shuffle(list, rnd);
    save();
  }
  // vendas do jogador: a IA compra com o tempo, dependendo do preço pedido
  function tickSales(s) {
    var now = Date.now(), changed = false;
    (s.mkt.sell || []).forEach(function (L) {
      if (L.sold) return;
      var d = cardData(L.card); if (!d) return;
      var fair = basePrice(d.ov, d.ver);
      var ratio = L.bin / Math.max(1, fair);
      // preço justo vende rápido; caro demora muito ou não vende
      var mins = (now - L.t) / 60000;
      var speed = ratio <= 0.8 ? 2 : ratio <= 1 ? 6 : ratio <= 1.25 ? 20 : ratio <= 1.6 ? 90 : 600;
      var chance = 1 - Math.exp(-mins / speed);
      if (Math.random() < chance) { L.sold = 1; L.st = now; changed = true; }
    });
    if (changed) save();
  }
  function claimSales(s) {
    var got = 0, n = 0;
    s.mkt.sell = (s.mkt.sell || []).filter(function (L) {
      if (!L.sold) return true;
      got += Math.round(L.bin * 0.95);   // taxa de 5%, igual ao mercado do FUT
      n++;
      return false;
    });
    if (got) { earn(s, got, "Vendas"); s.stats.sold = (s.stats.sold || 0) + n; }
    return { coins: got, n: n };
  }

  /* ================= DME (desafios de construção) ================= */
  var SBCS = [
    { id: "start", name: "Primeiros Passos", tip: "Um time inteiro, sem exigência de nota.", req: [{ t: "chem", v: 25 }], rew: { coins: 2500, pack: "prata" } },
    { id: "liga", name: "Liga Doméstica", tip: "Onze jogadores da mesma liga.", req: [{ t: "sameLeague", v: 11 }, { t: "ov", v: 68 }], rew: { coins: 4000, pack: "ouro" } },
    { id: "nacao", name: "Time Nacional", tip: "Onze jogadores do mesmo país.", req: [{ t: "sameNation", v: 11 }, { t: "ov", v: 70 }], rew: { coins: 6000, pack: "ouro" } },
    { id: "ouro", name: "Elenco de Ouro", tip: "Só cartas de ouro e química alta.", req: [{ t: "rar", r: "g", v: 11 }, { t: "chem", v: 65 }], rew: { coins: 9000, pack: "ourorare" } },
    { id: "raros", name: "Coleção de Raros", tip: "Onze cartas raras no elenco.", req: [{ t: "rare", v: 11 }, { t: "ov", v: 76 }], rew: { coins: 15000, pack: "ourorare" } },
    { id: "elite", name: "Elite Continental", tip: "Nota 82 e química quase perfeita.", req: [{ t: "ov", v: 82 }, { t: "chem", v: 80 }], rew: { coins: 35000, pack: "jumbo" } },
    { id: "clube", name: "Base do Clube", tip: "Quatro jogadores do mesmo clube.", req: [{ t: "sameClub", v: 4 }, { t: "ov", v: 74 }], rew: { coins: 8000, pack: "ouro" } },
    { id: "semana", name: "Time da Semana", tip: "Uma carta do Time da Semana no elenco.", req: [{ t: "totw", v: 1 }, { t: "ov", v: 78 }], rew: { coins: 25000, pack: "mega" } },
    { id: "lenda", name: "Elenco Lendário", tip: "O desafio mais duro do modo.", req: [{ t: "ov", v: 86 }, { t: "chem", v: 90 }], rew: { coins: 120000, pack: "premium" } }
  ];
  function sbcById(id) { for (var i = 0; i < SBCS.length; i++) if (SBCS[i].id === id) return SBCS[i]; return null; }
  // avalia um conjunto de 11 cartas contra os requisitos
  function checkSbc(sbc, cards, formation) {
    var ds = cards.map(function (c) { return c ? cardData(c) : null; });
    var filled = ds.filter(Boolean);
    var fake = { squad: { f: formation || "4-3-3", xi: cards.map(function (c) { return c ? c.i : null; }) }, cards: cards.filter(Boolean) };
    var ch = filled.length === 11 ? chemistry(fake) : { team: 0 };
    var ov = filled.length ? Math.round(filled.reduce(function (a, d) { return a + d.ov; }, 0) / 11) : 0;
    function countBy(keyFn) {
      var m = {}, best = 0;
      filled.forEach(function (d) { var k = keyFn(d); if (!k) return; m[k] = (m[k] || 0) + 1; if (m[k] > best) best = m[k]; });
      return best;
    }
    return sbc.req.map(function (r) {
      var have = 0, label = "";
      if (r.t === "ov") { have = ov; label = "Nota do elenco " + r.v + "+"; }
      else if (r.t === "chem") { have = ch.team; label = "Química " + r.v + "+"; }
      else if (r.t === "sameLeague") { have = countBy(function (d) { return d.lg; }); label = "Jogadores da mesma liga: " + r.v; }
      else if (r.t === "sameNation") { have = countBy(function (d) { return d.nat; }); label = "Jogadores do mesmo país: " + r.v; }
      else if (r.t === "sameClub") { have = countBy(function (d) { return d.club ? d.club.id : null; }); label = "Jogadores do mesmo clube: " + r.v; }
      else if (r.t === "rar") { have = filled.filter(function (d) { return d.rar === r.r; }).length; label = "Cartas " + RAR_NAME[r.r] + ": " + r.v; }
      else if (r.t === "rare") { have = filled.filter(function (d) { return d.ver === "rare" || d.ver === "totw"; }).length; label = "Cartas raras: " + r.v; }
      else if (r.t === "totw") { have = filled.filter(function (d) { return d.ver === "totw"; }).length; label = "Cartas do Time da Semana: " + r.v; }
      return { label: label, have: have, need: r.v, ok: have >= r.v };
    });
  }

  /* ================= objetivos diários ================= */
  var OBJ_POOL = [
    { id: "riv3", tx: "Jogue 3 partidas nos Rivais", n: 3, c: 1500 },
    { id: "win2", tx: "Vença 2 partidas nos Rivais", n: 2, c: 2500 },
    { id: "pack2", tx: "Abra 2 pacotes", n: 2, c: 1200 },
    { id: "sell3", tx: "Venda 3 jogadores no mercado", n: 3, c: 1800 },
    { id: "buy1", tx: "Compre 1 jogador no mercado", n: 1, c: 1000 },
    { id: "goal5", tx: "Marque 5 gols nos Rivais", n: 5, c: 2000 },
    { id: "chem70", tx: "Tenha um elenco com 70 de química", n: 1, c: 2200 },
    { id: "sbc1", tx: "Complete 1 DME", n: 1, c: 3000 }
  ];
  function objRefresh(s) {
    var d = today();
    if (s.obj.day === d && s.obj.list && s.obj.list.length) return;
    var rnd = mulberry(hashStr("obj" + d + "" + s.seed));
    var pick = shuffle(OBJ_POOL, rnd).slice(0, 4);
    s.obj = { day: d, list: pick.map(function (o) { return { id: o.id, tx: o.tx, n: o.n, c: o.c, p: 0, done: 0 }; }) };
    save();
  }
  function objBump(s, id, by) {
    objRefresh(s);
    var hit = false;
    s.obj.list.forEach(function (o) {
      if (o.id !== id || o.done) return;
      o.p = Math.min(o.n, o.p + (by || 1));
      if (o.p >= o.n) { o.done = 1; earn(s, o.c, "Objetivo"); hit = true; }
    });
    save();
    if (hit) TM.ui.toast("🎯 Objetivo concluído!");
  }

  /* ================= Rivais (divisões) ================= */
  var DIVS = [
    { d: 10, need: 9, ov: 58, win: 1200 }, { d: 9, need: 12, ov: 62, win: 1800 },
    { d: 8, need: 15, ov: 66, win: 2600 }, { d: 7, need: 18, ov: 70, win: 3600 },
    { d: 6, need: 21, ov: 73, win: 4800 }, { d: 5, need: 24, ov: 76, win: 6500 },
    { d: 4, need: 27, ov: 79, win: 8500 }, { d: 3, need: 30, ov: 82, win: 11000 },
    { d: 2, need: 33, ov: 85, win: 15000 }, { d: 1, need: 999, ov: 88, win: 22000 }
  ];
  function divInfo(d) { for (var i = 0; i < DIVS.length; i++) if (DIVS[i].d === d) return DIVS[i]; return DIVS[0]; }
  // adversário dos Rivais: clube real com nota próxima da divisão
  function rivalOpp(s) {
    var info = divInfo(s.riv.div);
    var W = TM.data.world();
    var best = null, bd = 1e9;
    var tries = shuffle(W.clubs).slice(0, 90);
    tries.forEach(function (c) {
      var r = TM.data.clubRating(c.id);
      var dist = Math.abs(r - info.ov) + Math.random() * 2;
      if (dist < bd) { bd = dist; best = c; }
    });
    return best || W.clubs[0];
  }

  /* ================= a carta (visual) ================= */
  var ST_LABEL = { pac: "RIT", sho: "FIN", pas: "PAS", dri: "DRI", def: "DEF", phy: "FÍS" };
  var GK_LABEL = { pac: "VEL", sho: "CHU", pas: "MAN", dri: "POS", def: "ELA", phy: "REF" };
  var ORDER = ["pac", "sho", "pas", "dri", "def", "phy"];
  function statsOf(d) {
    var a = d.attrs || {}, isGk = d.pos === "GK";
    var bump = d.ver === "totw" ? 2 : 0;
    return ORDER.map(function (k) {
      return { k: k, l: (isGk ? GK_LABEL : ST_LABEL)[k], v: clamp(Math.round((a[k] || 50) + bump), 1, 99) };
    });
  }
  // cartão estilo Ultimate Team
  function cardEl(d, opts) {
    opts = opts || {};
    if (!d) {
      return el("div", { class: "ut-card empty" + (opts.cls ? " " + opts.cls : "") }, [
        el("div", { class: "utc-plus", text: "+" }),
        opts.role ? el("div", { class: "utc-slot", text: opts.role }) : null
      ]);
    }
    var kids = [];
    kids.push(el("div", { class: "utc-l" }, [
      el("div", { class: "utc-ov", text: d.ov }),
      el("div", { class: "utc-pos", text: (d.pos2 || d.pos) }),
      el("div", { class: "utc-sep" }),
      (function () { try { return TM.img.nationImg(TM.data.nation(d.nat), "utc-flag"); } catch (e) { return el("span"); } })(),
      (function () { try { return d.club ? TM.img.clubImg(d.club, "utc-crest") : el("span"); } catch (e) { return el("span"); } })()
    ]));
    kids.push(el("div", { class: "utc-face-wrap" }, [
      (function () { try { return TM.img.playerImg(d.p, "utc-face"); } catch (e) { return el("span"); } })()
    ]));
    kids.push(el("div", { class: "utc-name", text: shortNm(d.name).toUpperCase() }));
    var stats = statsOf(d);
    kids.push(el("div", { class: "utc-stats" }, stats.map(function (s) {
      return el("span", { class: "utc-st" }, [el("b", { text: s.v }), el("i", { text: s.l })]);
    })));
    if (opts.chem != null) {
      var lv = opts.chem >= 9 ? "c3" : opts.chem >= 7 ? "c2" : opts.chem >= 4 ? "c1" : "c0";
      kids.push(el("div", { class: "utc-chem " + lv, text: opts.chem }));
    }
    if (d.ver === "totw") kids.push(el("div", { class: "utc-tag", text: "TDS" }));
    if (opts.price != null) kids.push(el("div", { class: "utc-price" }, [coinsEl(opts.price)]));
    var cls = "ut-card r-" + d.rar + " v-" + d.ver + (opts.cls ? " " + opts.cls : "");
    var node = el("div", { class: cls }, kids);
    if (opts.on) node.addEventListener("click", opts.on);
    return node;
  }

  /* ================= telas ================= */
  function goUT(r, p) { TM.ui.go(r, p); }
  // cabeçalho com saldo em moedas e Total Coins
  function wallet(s) {
    return el("div", { class: "ut-wallet" }, [
      el("div", { class: "ut-w-item" }, [coinsEl(s.coins, "big")]),
      (TM.coins ? el("div", { class: "ut-w-item tc" }, [el("span", { text: "🪙 " + TM.coins.balance() })]) : null)
    ]);
  }
  function utTop(title, back, s) {
    return TM.ui.topbar(title, back, s ? wallet(s) : null);
  }

  /* ---------- criação do clube ---------- */
  TM.ui.register("ut", function (screen) {
    var s = st();
    if (!s) { renderIntro(screen); return; }
    seedMarket(s); objRefresh(s); tickSales(s);
    renderHub(screen, s);
  });

  function renderIntro(screen) {
    screen.classList.add("ut-screen");
    screen.appendChild(TM.ui.topbar("Total Ultimate", function () { goUT("modes"); }));
    var input = el("input", { class: "ut-input", type: "text", maxlength: "22", placeholder: "Nome do seu clube" });
    screen.appendChild(el("div", { class: "ut-intro" }, [
      el("div", { class: "ut-intro-logo", text: "⬤" }),
      el("h1", { class: "ut-intro-title", text: "TOTAL ULTIMATE" }),
      el("p", { class: "ut-intro-tx", text: "Abra pacotes, monte seu elenco dos sonhos com química, negocie no mercado e suba da Divisão 10 até a 1." }),
      el("div", { class: "ut-intro-feats" }, [
        el("span", { class: "ut-feat", text: "📦 Pacotes" }), el("span", { class: "ut-feat", text: "🔗 Química" }),
        el("span", { class: "ut-feat", text: "💱 Mercado" }), el("span", { class: "ut-feat", text: "🧩 DME" }),
        el("span", { class: "ut-feat", text: "🏆 Rivais" })
      ]),
      input,
      TM.ui.button("Criar meu clube", function () {
        var nm = (input.value || "").trim() || "Meu Ultimate";
        S = blank(); S.club = nm;
        // pacote inicial: um elenco jogável para começar
        var start = packById("prata");
        openPack(S, { n: 16, lo: 62, hi: 76, rare: 0.3 });
        autoFill(S);
        save();
        TM.ui.toast("Clube criado! Seu elenco inicial está pronto.");
        goUT("ut");
      }, "btn primary wide")
    ]));
  }

  /* ---------- hub ---------- */
  function renderHub(screen, s) {
    screen.classList.add("ut-screen");
    screen.appendChild(utTop(s.club || "Total Ultimate", function () { goUT("modes"); }, s));
    var r = squadRating(s);
    var pend = (s.mkt.sell || []).filter(function (L) { return L.sold; }).length;
    var objDone = (s.obj.list || []).filter(function (o) { return o.done; }).length;

    screen.appendChild(el("div", { class: "ut-headcard" }, [
      el("div", { class: "ut-hc-l" }, [
        el("div", { class: "ut-hc-club", text: s.club || "Meu clube" }),
        el("div", { class: "ut-hc-div", text: "Divisão " + s.riv.div + " · " + s.cards.length + " cartas" })
      ]),
      el("div", { class: "ut-hc-r" }, [
        el("div", { class: "ut-hc-box" }, [el("b", { text: r.ov || "—" }), el("i", { text: "NOTA" })]),
        el("div", { class: "ut-hc-box chem" }, [el("b", { text: r.chem }), el("i", { text: "QUÍMICA" })])
      ])
    ]));

    function tile(ic, name, sub, route, badge) {
      return el("button", { class: "ut-tile", on: { click: function () { goUT(route); } } }, [
        el("span", { class: "ut-t-ic", text: ic }),
        el("span", { class: "ut-t-nm", text: name }),
        el("span", { class: "ut-t-sub", text: sub }),
        badge ? el("span", { class: "ut-t-badge", text: badge }) : null
      ]);
    }
    screen.appendChild(el("div", { class: "ut-tiles" }, [
      tile("⚽", "Escalação", "Monte o time e a química", "ut-squad"),
      tile("📦", "Loja", "Pacotes de jogadores", "ut-store", s.packs && s.packs.length ? String(s.packs.length) : null),
      tile("💱", "Mercado", "Compre e venda cartas", "ut-market", pend ? String(pend) : null),
      tile("👥", "Meu Clube", s.cards.length + " jogadores", "ut-club"),
      tile("🏆", "Rivais", "Divisão " + s.riv.div, "ut-rivals"),
      tile("🧩", "DME", "Desafios de construção", "ut-sbc"),
      tile("🎯", "Objetivos", objDone + "/" + (s.obj.list || []).length + " concluídos", "ut-obj"),
      tile("🌐", "Online", "Enfrente elencos de verdade", "ut-online")
    ]));

    screen.appendChild(el("div", { class: "ut-foot" }, [
      TM.ui.button("Reiniciar clube", function () {
        TM.ui.confirm("Recomeçar?", "Seu clube, cartas e moedas serão apagados. Não dá para desfazer.", "Apagar tudo", function () {
          reset(); goUT("ut");
        }, true);
      }, "btn ghost small")
    ]));
  }

  /* ---------- escalação automática ---------- */
  function autoFill(s) {
    var F = TM.comp.FORMATIONS[s.squad.f] || TM.comp.FORMATIONS["4-3-3"];
    var used = {}, xi = [];
    var all = s.cards.map(cardData).filter(Boolean);
    F.forEach(function (slot) {
      var role = slotRole(slot), best = null, bs = -1;
      all.forEach(function (d) {
        if (used[d.card.i]) return;
        var sc = d.ov * (0.45 + 0.55 * posFit(d, role));
        if (sc > bs) { bs = sc; best = d; }
      });
      if (best) { used[best.card.i] = 1; xi.push(best.card.i); } else xi.push(null);
    });
    s.squad.xi = xi;
    // banco: os 7 melhores que sobraram
    var rest = all.filter(function (d) { return !used[d.card.i]; }).sort(function (a, b) { return b.ov - a.ov; });
    s.squad.sub = rest.slice(0, 7).map(function (d) { return d.card.i; });
    save();
  }

  /* ---------- escalação ---------- */
  TM.ui.register("ut-squad", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    screen.classList.add("ut-screen");
    var body = el("div", { class: "ut-squad-body" });
    screen.appendChild(utTop("Escalação", function () { goUT("ut"); }, s));
    screen.appendChild(body);
    draw();

    function draw() {
      TM.ui.clear(body);
      var ch = chemistry(s), F = TM.comp.FORMATIONS[s.squad.f] || TM.comp.FORMATIONS["4-3-3"];
      var r = squadRating(s);

      body.appendChild(el("div", { class: "ut-sq-head" }, [
        el("div", { class: "ut-sq-stat" }, [el("b", { text: r.ov || "—" }), el("i", { text: "NOTA" })]),
        el("div", { class: "ut-sq-stat chem" }, [el("b", { text: ch.team }), el("i", { text: "QUÍMICA" })]),
        TM.ui.dropdown ? null : null,
        el("button", {
          class: "ut-sq-form", text: s.squad.f + " ▾", on: {
            click: function () {
              var opts = Object.keys(TM.comp.FORMATIONS).map(function (f) {
                return { label: f, fn: function () { s.squad.f = f; save(); draw(); } };
              });
              TM.ui.optionsMenu("Formação", opts);
            }
          }
        }),
        el("button", { class: "ut-sq-auto", text: "Auto", on: { click: function () { autoFill(s); draw(); TM.ui.toast("Elenco montado automaticamente"); } } })
      ]));

      // campo com as cartas e as linhas de ligação
      var pitch = el("div", { class: "ut-pitch" });
      var NS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "ut-links"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none");
      ch.links.forEach(function (L) {
        var a = F[L[0]], b = F[L[1]];
        var v = linkVal(ch.ds[L[0]], ch.ds[L[1]]);
        var has = ch.ds[L[0]] && ch.ds[L[1]];
        var ln = document.createElementNS(NS, "line");
        ln.setAttribute("x1", a[1]); ln.setAttribute("y1", a[2]);
        ln.setAttribute("x2", b[1]); ln.setAttribute("y2", b[2]);
        ln.setAttribute("class", "utl " + (!has ? "l-none" : v >= 3 ? "l3" : v === 2 ? "l2" : v === 1 ? "l1" : "l0"));
        svg.appendChild(ln);
      });
      pitch.appendChild(svg);

      F.forEach(function (slot, i) {
        var d = ch.ds[i], role = slotRole(slot);
        var holder = el("div", { class: "ut-slot", style: "left:" + slot[1] + "%;top:" + slot[2] + "%" }, [
          cardEl(d, { chem: d ? ch.per[i] : null, role: role, cls: "mini", on: function () { pick(i, role); } })
        ]);
        pitch.appendChild(holder);
      });
      body.appendChild(pitch);

      // banco de reservas
      var subs = (s.squad.sub || []).map(function (cid) {
        var c = cardMap(s)[cid];
        return c ? cardData(c) : null;
      }).filter(Boolean);
      body.appendChild(el("div", { class: "ut-bench" }, [
        el("div", { class: "ut-bench-t", text: "Reservas" }),
        el("div", { class: "ut-bench-row" }, subs.length ? subs.map(function (d) {
          return cardEl(d, { cls: "tiny", on: function () { showCard(d, s, draw); } });
        }) : [el("div", { class: "ut-empty-tx", text: "Nenhum reserva. Use o Auto ou escolha no Meu Clube." })])
      ]));
    }

    // escolher quem joga numa casa
    function pick(idx, role) {
      var used = {}, m = cardMap(s);
      s.squad.xi.forEach(function (c, i) { if (c && i !== idx) used[c] = 1; });
      var list = s.cards.map(cardData).filter(Boolean).filter(function (d) { return !used[d.card.i]; });
      list.sort(function (a, b) { return (b.ov * (0.5 + posFit(b, role))) - (a.ov * (0.5 + posFit(a, role))); });
      var cur = s.squad.xi[idx];
      var sheet = el("div", { class: "ut-sheet" });
      var inner = el("div", { class: "ut-sheet-in" }, [
        el("div", { class: "ut-sheet-h" }, [
          el("span", { text: "Escolher para " + role }),
          el("button", { class: "ut-x", text: "✕", on: { click: close } })
        ]),
        cur ? el("button", { class: "btn ghost small wide", text: "Tirar do time", on: { click: function () { s.squad.xi[idx] = null; save(); close(); draw(); } } }) : null,
        el("div", { class: "ut-pick-grid" }, list.slice(0, 60).map(function (d) {
          return el("div", { class: "ut-pick-it" }, [
            cardEl(d, { cls: "tiny", on: function () { s.squad.xi[idx] = d.card.i; save(); close(); draw(); } }),
            el("span", { class: "ut-pick-fit " + (posFit(d, role) >= 1 ? "ok" : posFit(d, role) >= 0.7 ? "mid" : "bad"), text: d.pos2 })
          ]);
        }))
      ]);
      sheet.appendChild(inner);
      sheet.addEventListener("click", function (e) { if (e.target === sheet) close(); });
      document.body.appendChild(sheet);
      requestAnimationFrame(function () { sheet.classList.add("show"); });
      function close() { sheet.classList.remove("show"); setTimeout(function () { sheet.remove(); }, 200); }
    }
  });

  /* ---------- ficha da carta + ações ---------- */
  function showCard(d, s, after) {
    var sq = inSquad(s);
    var listed = (s.mkt.sell || []).some(function (L) { return L.card.i === d.card.i; });
    var overlay = el("div", { class: "ut-sheet" });
    var stats = statsOf(d);
    var inner = el("div", { class: "ut-sheet-in card-detail" }, [
      el("div", { class: "ut-sheet-h" }, [
        el("span", { text: d.name }),
        el("button", { class: "ut-x", text: "✕", on: { click: close } })
      ]),
      el("div", { class: "ut-detail" }, [
        cardEl(d, { cls: "big" }),
        el("div", { class: "ut-detail-side" }, [
          el("div", { class: "ut-dl" }, [el("i", { text: "Clube" }), el("b", { text: d.club ? d.club.name : "—" })]),
          el("div", { class: "ut-dl" }, [el("i", { text: "País" }), el("b", { text: d.p.nationName || "—" })]),
          el("div", { class: "ut-dl" }, [el("i", { text: "Idade" }), el("b", { text: (d.p.age || "—") + " anos" })]),
          el("div", { class: "ut-dl" }, [el("i", { text: "Versão" }), el("b", { text: d.ver === "totw" ? "Time da Semana" : d.ver === "rare" ? "Rara" : "Base" })]),
          el("div", { class: "ut-dl" }, [el("i", { text: "Preço médio" }), el("b", { text: fmtC(basePrice(d.ov, d.ver)) })])
        ])
      ]),
      el("div", { class: "ut-bars" }, stats.map(function (x) {
        return el("div", { class: "ut-bar" }, [
          el("i", { text: x.l }), el("div", { class: "ut-bar-t" }, [el("div", { class: "ut-bar-f", style: "width:" + x.v + "%" })]), el("b", { text: x.v })
        ]);
      })),
      el("div", { class: "ut-detail-acts" }, [
        listed ? el("div", { class: "ut-note", text: "Esta carta já está à venda no mercado." }) : (sq[d.card.i] ? el("div", { class: "ut-note", text: "Está no elenco. Tire do time para vender." }) : null),
        (!listed && !sq[d.card.i]) ? TM.ui.button("Vender no mercado", function () { close(); listCard(d, s, after); }, "btn primary wide") : null,
        (!listed && !sq[d.card.i]) ? TM.ui.button("Venda rápida (" + fmtC(quickSell(d.ov, d.ver)) + ")", function () {
          TM.ui.confirm("Venda rápida?", d.name + " some da sua coleção por " + fmtC(quickSell(d.ov, d.ver)) + " moedas. Costuma valer bem menos que o mercado.", "Vender", function () {
            earn(s, quickSell(d.ov, d.ver), "Venda rápida"); removeCard(s, d.card.i); save(); close(); if (after) after();
          }, true);
        }, "btn ghost wide") : null
      ])
    ]);
    overlay.appendChild(inner);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("show"); });
    function close() { overlay.classList.remove("show"); setTimeout(function () { overlay.remove(); }, 200); }
  }

  // colocar à venda: preço sugerido pelo mercado
  function listCard(d, s, after) {
    var fair = basePrice(d.ov, d.ver);
    var overlay = el("div", { class: "ut-sheet" });
    var inp = el("input", { class: "ut-input", type: "number", value: String(Math.round(fair / 50) * 50), min: "200", step: "50" });
    var hint = el("div", { class: "ut-hint", text: "" });
    function upd() {
      var v = Math.max(200, Math.round(Number(inp.value) || 0));
      var ratio = v / fair;
      hint.textContent = ratio <= 0.85 ? "Abaixo do mercado — vende muito rápido."
        : ratio <= 1.05 ? "Preço de mercado — deve vender logo."
        : ratio <= 1.3 ? "Acima do mercado — pode demorar."
        : ratio <= 1.7 ? "Caro — vai demorar bastante." : "Muito caro — talvez nem venda.";
      hint.className = "ut-hint " + (ratio <= 1.05 ? "good" : ratio <= 1.3 ? "mid" : "bad");
    }
    inp.addEventListener("input", upd); upd();
    overlay.appendChild(el("div", { class: "ut-sheet-in" }, [
      el("div", { class: "ut-sheet-h" }, [el("span", { text: "Vender " + shortNm(d.name) }), el("button", { class: "ut-x", text: "✕", on: { click: close } })]),
      el("div", { class: "ut-sell-box" }, [
        cardEl(d, { cls: "mini" }),
        el("div", { class: "ut-sell-f" }, [
          el("label", { class: "ut-lbl", text: "Preço de compra imediata" }), inp, hint,
          el("div", { class: "ut-fee", text: "Preço médio de mercado: " + fmtC(fair) + " · taxa de 5% na venda" })
        ])
      ]),
      TM.ui.button("Colocar à venda", function () {
        var v = Math.max(200, Math.round(Number(inp.value) || 0));
        s.mkt.sell = s.mkt.sell || [];
        s.mkt.sell.push({ card: d.card, bin: v, t: Date.now() });
        s.cards = s.cards.filter(function (c) { return c.i !== d.card.i; });
        save(); close(); TM.ui.toast("Anunciado por " + fmtC(v));
        if (after) after();
      }, "btn primary wide")
    ]));
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("show"); });
    function close() { overlay.classList.remove("show"); setTimeout(function () { overlay.remove(); }, 200); }
  }

  /* ---------- loja de pacotes ---------- */
  TM.ui.register("ut-store", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("Loja", function () { goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);

    if (s.packs && s.packs.length) {
      body.appendChild(el("div", { class: "ut-sec-t", text: "Pacotes guardados" }));
      body.appendChild(el("div", { class: "ut-owned" }, s.packs.map(function (pid, i) {
        var pk = packById(pid); if (!pk) return el("span");
        return el("button", {
          class: "ut-owned-it", on: {
            click: function () { s.packs.splice(i, 1); save(); goUT("ut-pack", { pack: pid }); }
          }
        }, [el("span", { class: "ut-o-ic", text: "📦" }), el("span", { text: pk.name }), el("span", { class: "ut-o-go", text: "ABRIR" })]);
      })));
    }

    body.appendChild(el("div", { class: "ut-sec-t", text: "Pacotes" }));
    PACKS.forEach(function (pk) {
      var isTC = !!pk.tc;
      body.appendChild(el("div", { class: "ut-pack r-" + (pk.id === "bronze" ? "b" : pk.id === "prata" ? "s" : "g") + (isTC ? " prem" : "") }, [
        el("div", { class: "ut-pk-ic", text: isTC ? "🎁" : "📦" }),
        el("div", { class: "ut-pk-i" }, [
          el("div", { class: "ut-pk-n", text: pk.name }),
          el("div", { class: "ut-pk-d", text: pk.desc })
        ]),
        el("button", {
          class: "ut-pk-buy" + (isTC ? " tc" : ""),
          text: isTC ? (pk.tc + " 🪙") : fmtC(pk.price),
          on: {
            click: function () {
              if (isTC) {
                if (!TM.coins) return;
                if (!TM.coins.canPay(pk.tc)) { TM.ui.toast("Total Coins insuficientes"); return; }
                TM.ui.confirm("Comprar " + pk.name + "?", "Custa " + pk.tc + " Total Coins.", "Comprar", function () {
                  TM.coins.pay(pk.tc, pk.name + " · Ultimate", function () { goUT("ut-pack", { pack: pk.id }); });
                });
              } else {
                if ((s.coins || 0) < pk.price) { TM.ui.toast("Moedas insuficientes"); return; }
                pay(s, pk.price);
                goUT("ut-pack", { pack: pk.id });
              }
            }
          }
        })
      ]));
    });
  });

  /* ---------- abertura de pacote (com revelação) ---------- */
  TM.ui.register("ut-pack", function (screen, params) {
    var s = st(); if (!s) { goUT("ut"); return; }
    var pk = packById((params || {}).pack) || PACKS[0];
    var cards = openPack(s, pk);
    objBump(s, "pack2", 1);
    var ds = cards.map(cardData).filter(Boolean).sort(function (a, b) { return a.ov - b.ov; });
    var best = ds[ds.length - 1];
    var idx = 0;

    screen.classList.add("ut-screen", "ut-packscreen");
    var stage = el("div", { class: "ut-stage" });
    screen.appendChild(stage);
    showNext();

    function showNext() {
      TM.ui.clear(stage);
      if (idx >= ds.length) { summary(); return; }
      var d = ds[idx];
      var walk = d.ov >= 84;
      var wrap = el("div", { class: "ut-reveal" + (walk ? " walkout" : "") }, [
        el("div", { class: "ut-rev-count", text: (idx + 1) + " de " + ds.length }),
        walk ? el("div", { class: "ut-walk-tx", text: "⭐ JOGADOR ESPECIAL" }) : null,
        cardEl(d, { cls: "big pop" }),
        el("div", { class: "ut-rev-nm", text: d.name }),
        el("div", { class: "ut-rev-sub", text: (d.club ? d.club.name : "") + " · vale ~" + fmtC(basePrice(d.ov, d.ver)) }),
        TM.ui.button(idx === ds.length - 1 ? "Ver resumo" : "Próximo", function () { idx++; showNext(); }, "btn primary wide"),
        el("button", { class: "btn ghost small", text: "Revelar tudo", on: { click: function () { idx = ds.length; showNext(); } } })
      ]);
      stage.appendChild(wrap);
    }
    function summary() {
      TM.ui.clear(stage);
      stage.appendChild(el("div", { class: "ut-sum" }, [
        el("div", { class: "ut-sum-t", text: pk.name + " aberto" }),
        el("div", { class: "ut-sum-b", text: "Melhor carta: " + (best ? best.name + " (" + best.ov + ")" : "—") }),
        el("div", { class: "ut-sum-grid" }, ds.slice().reverse().map(function (d) {
          return cardEl(d, { cls: "tiny", on: function () { showCard(d, s, null); } });
        })),
        TM.ui.button("Ir para o Meu Clube", function () { goUT("ut-club"); }, "btn primary wide"),
        TM.ui.button("Voltar à loja", function () { goUT("ut-store"); }, "btn ghost wide")
      ]));
    }
  });

  /* ---------- meu clube (coleção) ---------- */
  TM.ui.register("ut-club", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("Meu Clube", function () { goUT("ut"); }, s));
    var f = { pos: "", rar: "", sort: "ov", q: "" };
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    draw();

    function draw() {
      TM.ui.clear(body);
      var sq = inSquad(s);
      var search = el("input", { class: "ut-input search", type: "text", placeholder: "Buscar jogador…", value: f.q });
      search.addEventListener("input", function () { f.q = search.value; render(); });
      body.appendChild(search);

      var chips = el("div", { class: "ut-chips" });
      [["", "Todos"], ["GK", "GOL"], ["DF", "DEF"], ["MF", "MEI"], ["FW", "ATA"]].forEach(function (o) {
        chips.appendChild(el("button", {
          class: "ut-chip" + (f.pos === o[0] ? " on" : ""), text: o[1],
          on: { click: function () { f.pos = o[0]; draw(); } }
        }));
      });
      [["g", "Ouro"], ["s", "Prata"], ["b", "Bronze"]].forEach(function (o) {
        chips.appendChild(el("button", {
          class: "ut-chip r" + o[0] + (f.rar === o[0] ? " on" : ""), text: o[1],
          on: { click: function () { f.rar = f.rar === o[0] ? "" : o[0]; draw(); } }
        }));
      });
      chips.appendChild(el("button", {
        class: "ut-chip sort", text: f.sort === "ov" ? "Nota ▾" : "Valor ▾",
        on: { click: function () { f.sort = f.sort === "ov" ? "val" : "ov"; draw(); } }
      }));
      body.appendChild(chips);
      var grid = el("div", { class: "ut-grid" });
      body.appendChild(grid);
      render();

      function render() {
        TM.ui.clear(grid);
        var list = s.cards.map(cardData).filter(Boolean).filter(function (d) {
          if (f.pos && d.pos !== f.pos) return false;
          if (f.rar && d.rar !== f.rar) return false;
          if (f.q && String(d.name).toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
          return true;
        });
        list.sort(function (a, b) { return f.sort === "ov" ? b.ov - a.ov : basePrice(b.ov, b.ver) - basePrice(a.ov, a.ver); });
        if (!list.length) { grid.appendChild(el("div", { class: "ut-empty-tx", text: "Nenhuma carta com esses filtros." })); return; }
        grid.appendChild(el("div", { class: "ut-count", text: list.length + " de " + s.cards.length + " cartas" }));
        var wrap = el("div", { class: "ut-cards" });
        list.forEach(function (d) {
          var node = cardEl(d, { cls: "tiny" + (sq[d.card.i] ? " insquad" : ""), on: function () { showCard(d, s, function () { draw(); }); } });
          wrap.appendChild(node);
        });
        grid.appendChild(wrap);
      }
    }
  });

  /* ---------- mercado ---------- */
  TM.ui.register("ut-market", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    seedMarket(s); tickSales(s);
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("Mercado", function () { goUT("ut"); }, s));
    var tab = "buy";
    var body = el("div", { class: "ut-body" });
    var tabs = el("div", { class: "ut-tabs" });
    screen.appendChild(tabs); screen.appendChild(body);
    function mkTabs() {
      TM.ui.clear(tabs);
      var pend = (s.mkt.sell || []).filter(function (L) { return L.sold; }).length;
      [["buy", "Comprar"], ["sell", "Minhas vendas" + (pend ? " (" + pend + ")" : "")]].forEach(function (t) {
        tabs.appendChild(el("button", { class: "ut-tab" + (tab === t[0] ? " on" : ""), text: t[1], on: { click: function () { tab = t[0]; draw(); } } }));
      });
    }
    draw();

    function draw() { mkTabs(); TM.ui.clear(body); if (tab === "buy") buyTab(); else sellTab(); }

    function buyTab() {
      var f = { pos: "", min: 0, max: 0 };
      var chips = el("div", { class: "ut-chips" });
      [["", "Todos"], ["GK", "GOL"], ["DF", "DEF"], ["MF", "MEI"], ["FW", "ATA"]].forEach(function (o) {
        chips.appendChild(el("button", { class: "ut-chip" + (f.pos === o[0] ? " on" : ""), text: o[1], on: { click: function () { f.pos = o[0]; paint(); } } }));
      });
      body.appendChild(chips);
      var minI = el("input", { class: "ut-input mini", type: "number", placeholder: "Nota mín." });
      var maxI = el("input", { class: "ut-input mini", type: "number", placeholder: "Preço máx." });
      minI.addEventListener("input", paint); maxI.addEventListener("input", paint);
      body.appendChild(el("div", { class: "ut-filters" }, [minI, maxI]));
      var list = el("div", { class: "ut-list" });
      body.appendChild(list);
      paint();

      function paint() {
        // repinta os chips de posição sem redesenhar tudo
        Array.prototype.forEach.call(chips.children, function (b, i) {
          var val = ["", "GK", "DF", "MF", "FW"][i];
          b.classList.toggle("on", f.pos === val);
        });
        TM.ui.clear(list);
        var mn = Number(minI.value) || 0, mx = Number(maxI.value) || 0;
        var items = (s.mkt.buy || []).map(function (L) {
          var p = TM.data.player(L.p); if (!p) return null;
          var ov = p.overall + (L.v === "totw" ? 2 : 0);
          return { L: L, d: cardData({ i: L.k, p: L.p, r: rarOf(ov), v: L.v, ut: 0 }) };
        }).filter(function (x) {
          if (!x || !x.d) return false;
          if (f.pos && x.d.pos !== f.pos) return false;
          if (mn && x.d.ov < mn) return false;
          if (mx && x.L.bin > mx) return false;
          return true;
        });
        items.sort(function (a, b) { return a.L.bin - b.L.bin; });
        if (!items.length) { list.appendChild(el("div", { class: "ut-empty-tx", text: "Nada encontrado. O mercado renova todo dia." })); return; }
        items.slice(0, 60).forEach(function (x) {
          var can = (s.coins || 0) >= x.L.bin;
          list.appendChild(el("div", { class: "ut-row" }, [
            cardEl(x.d, { cls: "tiny", on: function () { showMarketCard(x.d, x.L); } }),
            el("div", { class: "ut-row-i" }, [
              el("div", { class: "ut-row-n", text: x.d.name }),
              el("div", { class: "ut-row-s", text: (x.d.club ? x.d.club.name : "—") + " · " + (x.d.pos2 || x.d.pos) }),
              el("div", { class: "ut-row-p" }, [coinsEl(x.L.bin)])
            ]),
            el("button", {
              class: "ut-buy" + (can ? "" : " off"), text: can ? "Comprar" : "Sem moedas",
              on: { click: function () { if (can) buyIt(x); } }
            })
          ]));
        });
      }
      function buyIt(x) {
        if (!pay(s, x.L.bin)) { TM.ui.toast("Moedas insuficientes"); return; }
        var c = mkCard(x.d.p, x.d.ver === "base" ? "base" : x.d.ver);
        c.ut = 0;   // comprado: sem bônus de lealdade
        addCard(s, c);
        s.mkt.buy = s.mkt.buy.filter(function (L) { return L.k !== x.L.k; });
        s.stats.bought = (s.stats.bought || 0) + 1;
        save();
        objBump(s, "buy1", 1);
        TM.ui.toast(shortNm(x.d.name) + " comprado!");
        paint();
      }
      function showMarketCard(d, L) {
        var ov = el("div", { class: "ut-sheet" });
        ov.appendChild(el("div", { class: "ut-sheet-in card-detail" }, [
          el("div", { class: "ut-sheet-h" }, [el("span", { text: d.name }), el("button", { class: "ut-x", text: "✕", on: { click: cl } })]),
          el("div", { class: "ut-detail" }, [
            cardEl(d, { cls: "big" }),
            el("div", { class: "ut-detail-side" }, [
              el("div", { class: "ut-dl" }, [el("i", { text: "Clube" }), el("b", { text: d.club ? d.club.name : "—" })]),
              el("div", { class: "ut-dl" }, [el("i", { text: "País" }), el("b", { text: d.p.nationName || "—" })]),
              el("div", { class: "ut-dl" }, [el("i", { text: "Pedido" }), el("b", { text: fmtC(L.bin) })]),
              el("div", { class: "ut-dl" }, [el("i", { text: "Preço médio" }), el("b", { text: fmtC(basePrice(d.ov, d.ver)) })])
            ])
          ]),
          el("div", { class: "ut-bars" }, statsOf(d).map(function (x) {
            return el("div", { class: "ut-bar" }, [el("i", { text: x.l }), el("div", { class: "ut-bar-t" }, [el("div", { class: "ut-bar-f", style: "width:" + x.v + "%" })]), el("b", { text: x.v })]);
          }))
        ]));
        ov.addEventListener("click", function (e) { if (e.target === ov) cl(); });
        document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add("show"); });
        function cl() { ov.classList.remove("show"); setTimeout(function () { ov.remove(); }, 200); }
      }
    }

    function sellTab() {
      var sold = (s.mkt.sell || []).filter(function (L) { return L.sold; });
      if (sold.length) {
        body.appendChild(el("div", { class: "ut-claim" }, [
          el("div", { class: "ut-claim-t", text: sold.length + " carta(s) vendida(s)!" }),
          TM.ui.button("Receber moedas", function () {
            var r = claimSales(s);
            objBump(s, "sell3", r.n);
            TM.ui.toast("+" + fmtC(r.coins) + " moedas");
            draw();
          }, "btn primary wide")
        ]));
      }
      var open = (s.mkt.sell || []).filter(function (L) { return !L.sold; });
      body.appendChild(el("div", { class: "ut-sec-t", text: "À venda (" + open.length + ")" }));
      if (!open.length) body.appendChild(el("div", { class: "ut-empty-tx", text: "Nada anunciado. Vá ao Meu Clube e coloque cartas à venda." }));
      open.forEach(function (L) {
        var d = cardData(L.card); if (!d) return;
        var mins = Math.round((Date.now() - L.t) / 60000);
        body.appendChild(el("div", { class: "ut-row" }, [
          cardEl(d, { cls: "tiny" }),
          el("div", { class: "ut-row-i" }, [
            el("div", { class: "ut-row-n", text: d.name }),
            el("div", { class: "ut-row-s", text: "há " + (mins < 60 ? mins + " min" : Math.round(mins / 60) + " h") + " · pede " + fmtC(L.bin) }),
            el("div", { class: "ut-row-p" }, [coinsEl(Math.round(L.bin * 0.95), "net")])
          ]),
          el("button", {
            class: "ut-buy ghost", text: "Retirar", on: {
              click: function () {
                s.mkt.sell = s.mkt.sell.filter(function (x) { return x !== L; });
                addCard(s, L.card); save(); TM.ui.toast("Anúncio retirado"); draw();
              }
            }
          })
        ]));
      });
    }
  });

  /* ---------- Rivais ---------- */
  // time do jogador com a nota já ajustada pela química
  function utTeam(s) {
    var ch = chemistry(s), players = [], m = cardMap(s);
    ch.ds.forEach(function (d, i) {
      if (!d) return;
      var p = Object.assign({}, d.p);
      p.overall = effOv(d.ov, ch.per[i]);
      p.attrs = Object.assign({}, d.attrs);
      players.push(p);
    });
    (s.squad.sub || []).forEach(function (cid) {
      var c = m[cid]; if (!c) return;
      var d = cardData(c); if (!d) return;
      var p = Object.assign({}, d.p); p.overall = d.ov; players.push(p);
    });
    return { id: "utteam", name: s.club || "Meu Ultimate", players: players };
  }

  TM.ui.register("ut-rivals", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("Rivais", function () { goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    draw();

    function draw() {
      TM.ui.clear(body);
      var info = divInfo(s.riv.div), r = squadRating(s);
      var pct = clamp(Math.round(s.riv.pts / info.need * 100), 0, 100);
      body.appendChild(el("div", { class: "ut-div" }, [
        el("div", { class: "ut-div-n", text: "DIVISÃO " + s.riv.div }),
        el("div", { class: "ut-div-bar" }, [el("div", { class: "ut-div-f", style: "width:" + pct + "%" })]),
        el("div", { class: "ut-div-s", text: s.riv.div > 1 ? (s.riv.pts + " / " + info.need + " pontos para subir") : (s.riv.pts + " pontos · divisão máxima") }),
        el("div", { class: "ut-div-rec", text: s.riv.w + "V " + s.riv.d + "E " + s.riv.l + "D · melhor divisão: " + s.riv.best })
      ]));

      var filled = s.squad.xi.filter(Boolean).length;
      body.appendChild(el("div", { class: "ut-sq-mini" }, [
        el("div", { class: "ut-sq-mini-i" }, [el("b", { text: r.ov || "—" }), el("i", { text: "NOTA" })]),
        el("div", { class: "ut-sq-mini-i" }, [el("b", { text: r.chem }), el("i", { text: "QUÍMICA" })]),
        el("button", { class: "btn ghost small", text: "Editar elenco", on: { click: function () { goUT("ut-squad"); } } })
      ]));

      if (filled < 11) {
        body.appendChild(el("div", { class: "ut-warn", text: "Você precisa de 11 titulares para jogar. Faltam " + (11 - filled) + "." }));
        body.appendChild(TM.ui.button("Montar automaticamente", function () { autoFill(s); draw(); }, "btn primary wide"));
        return;
      }

      var opp = rivalOpp(s);
      body.appendChild(el("div", { class: "ut-next" }, [
        el("div", { class: "ut-next-t", text: "PRÓXIMO ADVERSÁRIO" }),
        el("div", { class: "ut-next-c" }, [
          (function () { try { return TM.img.clubImg(opp, "ut-next-crest"); } catch (e) { return el("span"); } })(),
          el("div", {}, [
            el("div", { class: "ut-next-n", text: opp.name }),
            el("div", { class: "ut-next-s", text: "Nota " + TM.data.clubRating(opp.id) })
          ])
        ]),
        el("div", { class: "ut-next-rew", text: "Vitória: " + fmtC(info.win) + " moedas · Empate: " + fmtC(Math.round(info.win * 0.4)) })
      ]));
      body.appendChild(TM.ui.button("Jogar partida", function () { goUT("ut-play", { opp: opp.id }); }, "btn primary wide"));
    }
  });

  TM.ui.register("ut-play", function (screen, params) {
    var s = st(); if (!s) { goUT("ut"); return; }
    var oppId = (params || {}).opp;
    var opp = TM.data.club(oppId) || rivalOpp(s);
    var teamA = utTeam(s), teamB = TM.engine.teamFromClub(opp.id);
    if (teamA.players.length < 11) { TM.ui.toast("Elenco incompleto"); goUT("ut-rivals"); return; }
    var settings = TM.storage.settings();
    var simOpts = { realism: settings.realism, neutral: true };
    var result = TM.engine.simulate(teamA, teamB, simOpts);
    TM.matchview.play(screen, {
      teamA: teamA, teamB: teamB, result: result, settings: settings, title: "Rivais · Divisão " + s.riv.div,
      pauseSide: 0, simOpts: simOpts, formation: s.squad.f,
      onBack: function () { goUT("ut-rivals"); },
      onDone: function () {
        var hs = result.score[0], as = result.score[1];
        var info = divInfo(s.riv.div);
        s.riv.pl++;
        objBump(s, "riv3", 1);
        if (hs > as) {
          s.riv.w++; s.riv.pts += 3; earn(s, info.win, "Vitória Rivais");
          objBump(s, "win2", 1);
        } else if (hs === as) {
          s.riv.d++; s.riv.pts += 1; earn(s, Math.round(info.win * 0.4), "Empate Rivais");
        } else {
          s.riv.l++; earn(s, Math.round(info.win * 0.18), "Derrota Rivais");
        }
        if (hs > 0) objBump(s, "goal5", hs);
        var promoted = false;
        if (s.riv.div > 1 && s.riv.pts >= info.need) {
          s.riv.div--; s.riv.pts = 0; promoted = true;
          if (s.riv.div < s.riv.best) s.riv.best = s.riv.div;
          s.packs = s.packs || []; s.packs.push(s.riv.div <= 3 ? "jumbo" : s.riv.div <= 6 ? "ourorare" : "ouro");
        }
        var r = squadRating(s);
        if (r.chem >= 70) objBump(s, "chem70", 1);
        save();
        if (promoted) {
          TM.ui.confirm("🏆 Subiu de divisão!", "Bem-vindo à Divisão " + s.riv.div + ". Um pacote de recompensa foi guardado na Loja.", "Boa!", function () { goUT("ut-rivals"); });
        } else {
          goUT("ut-rivals");
        }
      }
    });
  });

  /* ---------- DME ---------- */
  TM.ui.register("ut-sbc", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("DME", function () { goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "ut-tip", text: "Desafios de Montagem de Elenco: monte um time que cumpra os requisitos. As cartas usadas são consumidas." }));
    SBCS.forEach(function (sbc) {
      var done = !!s.sbc[sbc.id];
      body.appendChild(el("button", {
        class: "ut-sbc" + (done ? " done" : ""), on: { click: function () { if (!done) goUT("ut-sbc-build", { id: sbc.id }); } }
      }, [
        el("div", { class: "ut-sbc-i" }, [
          el("div", { class: "ut-sbc-n", text: sbc.name }),
          el("div", { class: "ut-sbc-d", text: sbc.tip }),
          el("div", { class: "ut-sbc-r", text: "Prêmio: " + (sbc.rew.coins ? fmtC(sbc.rew.coins) + " moedas" : "") + (sbc.rew.pack ? (sbc.rew.coins ? " + " : "") + (packById(sbc.rew.pack) || {}).name : "") })
        ]),
        el("span", { class: "ut-sbc-go", text: done ? "✓" : "›" })
      ]));
    });
  });

  TM.ui.register("ut-sbc-build", function (screen, params) {
    var s = st(); if (!s) { goUT("ut"); return; }
    var sbc = sbcById((params || {}).id); if (!sbc) { goUT("ut-sbc"); return; }
    var slots = [null, null, null, null, null, null, null, null, null, null, null];
    var F = "4-3-3";
    screen.classList.add("ut-screen");
    screen.appendChild(utTop(sbc.name, function () { goUT("ut-sbc"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    draw();

    function draw() {
      TM.ui.clear(body);
      var checks = checkSbc(sbc, slots, F);
      var allOk = checks.every(function (c) { return c.ok; }) && slots.filter(Boolean).length === 11;
      body.appendChild(el("div", { class: "ut-reqs" }, checks.map(function (c) {
        return el("div", { class: "ut-req " + (c.ok ? "ok" : "no") }, [
          el("span", { class: "ut-req-ic", text: c.ok ? "✓" : "•" }),
          el("span", { class: "ut-req-l", text: c.label }),
          el("span", { class: "ut-req-v", text: c.have + "/" + c.need })
        ]);
      })));
      var FF = TM.comp.FORMATIONS[F];
      var pitch = el("div", { class: "ut-pitch small" });
      FF.forEach(function (slot, i) {
        var c = slots[i], d = c ? cardData(c) : null;
        pitch.appendChild(el("div", { class: "ut-slot", style: "left:" + slot[1] + "%;top:" + slot[2] + "%" }, [
          cardEl(d, { role: slotRole(slot), cls: "mini", on: function () { pickFor(i); } })
        ]));
      });
      body.appendChild(pitch);
      body.appendChild(el("div", { class: "ut-sbc-acts" }, [
        TM.ui.button("Preencher automático", function () {
          var used = {}; var all = s.cards.map(cardData).filter(Boolean).sort(function (a, b) { return b.ov - a.ov; });
          slots = FF.map(function (slot) {
            var role = slotRole(slot), best = null, bs = -1;
            all.forEach(function (d) {
              if (used[d.card.i]) return;
              var sc = d.ov * (0.45 + 0.55 * posFit(d, role));
              if (sc > bs) { bs = sc; best = d; }
            });
            if (best) { used[best.card.i] = 1; return best.card; }
            return null;
          });
          draw();
        }, "btn ghost wide"),
        el("button", {
          class: "btn primary wide" + (allOk ? "" : " off"), text: allOk ? "Enviar elenco" : "Requisitos não cumpridos",
          on: {
            click: function () {
              if (!allOk) return;
              TM.ui.confirm("Enviar?", "As 11 cartas usadas serão consumidas e você recebe o prêmio.", "Enviar", function () {
                slots.forEach(function (c) { if (c) removeCard(s, c.i); });
                s.sbc[sbc.id] = 1;
                if (sbc.rew.coins) earn(s, sbc.rew.coins, "DME " + sbc.name);
                if (sbc.rew.pack) { s.packs = s.packs || []; s.packs.push(sbc.rew.pack); }
                save(); objBump(s, "sbc1", 1);
                TM.ui.confirm("🧩 DME concluído!", "Prêmio creditado." + (sbc.rew.pack ? " O pacote está guardado na Loja." : ""), "Beleza", function () { goUT("ut-sbc"); });
              });
            }
          }
        })
      ]));
    }

    function pickFor(idx) {
      var used = {};
      slots.forEach(function (c, i) { if (c && i !== idx) used[c.i] = 1; });
      var sq = inSquad(s);
      var list = s.cards.map(cardData).filter(Boolean).filter(function (d) { return !used[d.card.i]; });
      list.sort(function (a, b) { return b.ov - a.ov; });
      var sheet = el("div", { class: "ut-sheet" });
      sheet.appendChild(el("div", { class: "ut-sheet-in" }, [
        el("div", { class: "ut-sheet-h" }, [el("span", { text: "Escolher carta" }), el("button", { class: "ut-x", text: "✕", on: { click: close } })]),
        slots[idx] ? el("button", { class: "btn ghost small wide", text: "Remover", on: { click: function () { slots[idx] = null; close(); draw(); } } }) : null,
        el("div", { class: "ut-pick-grid" }, list.slice(0, 80).map(function (d) {
          return el("div", { class: "ut-pick-it" }, [
            cardEl(d, { cls: "tiny" + (sq[d.card.i] ? " insquad" : ""), on: function () { slots[idx] = d.card; close(); draw(); } }),
            sq[d.card.i] ? el("span", { class: "ut-pick-fit bad", text: "no time" }) : null
          ]);
        }))
      ]));
      sheet.addEventListener("click", function (e) { if (e.target === sheet) close(); });
      document.body.appendChild(sheet); requestAnimationFrame(function () { sheet.classList.add("show"); });
      function close() { sheet.classList.remove("show"); setTimeout(function () { sheet.remove(); }, 200); }
    }
  });

  /* ---------- objetivos ---------- */
  TM.ui.register("ut-obj", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    objRefresh(s);
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("Objetivos", function () { goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "ut-tip", text: "Os objetivos trocam todo dia. Cumpra e receba moedas na hora." }));
    (s.obj.list || []).forEach(function (o) {
      var pct = clamp(Math.round(o.p / o.n * 100), 0, 100);
      body.appendChild(el("div", { class: "ut-obj" + (o.done ? " done" : "") }, [
        el("div", { class: "ut-obj-t" }, [
          el("span", { class: "ut-obj-x", text: o.tx }),
          el("span", { class: "ut-obj-c", text: o.done ? "✓" : fmtC(o.c) })
        ]),
        el("div", { class: "ut-obj-bar" }, [el("div", { class: "ut-obj-f", style: "width:" + pct + "%" })]),
        el("div", { class: "ut-obj-p", text: o.p + " / " + o.n })
      ]));
    });
  });

  /* ================= API ================= */
  TM.ut = {
    state: st, save: save, reset: reset,
    chemistry: chemistry, squadRating: squadRating, cardData: cardData, cardEl: cardEl,
    basePrice: basePrice, openPack: openPack, PACKS: PACKS, SBCS: SBCS, DIVS: DIVS,
    autoFill: autoFill, slotRole: slotRole, posFit: posFit, linkVal: linkVal, isTotw: isTotw,
    effOv: effOv, earn: earn, statsOf: statsOf, quickSell: quickSell, packById: packById,
    _new: function (name) { S = blank(); S.club = name || "Meu Ultimate"; save(); return S; }
  };
})(window);
