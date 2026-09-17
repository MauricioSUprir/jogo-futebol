/* ================= TOTAL ULTIMATE =================
   Modo de cartas: abra pacotes, monte o elenco com química,
   negocie no mercado, complete DMEs e suba de divisão nos Rivais. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var KEY = "ultimate";
  /* O clube do Total Ultimate é UM SÓ, não um por edição.
     Antes ele era gravado com o prefixo da edição ativa: quem montava o clube
     na Season Update e depois entrava na edição pública caía na tela de "criar
     clube" e achava que tinha perdido tudo. Agora ele mora sempre no mesmo
     lugar (prefixo base) e guarda em `ed` de qual edição são as cartas —
     porque o id dos jogadores muda de uma edição para a outra. */
  function lerClube() {
    var s = TM.storage.readRaw("public", KEY);
    if (s && s.squad) return s;
    // migração: clube antigo que ficou preso na Season Update
    var antigo = TM.storage.readRaw("pro", KEY);
    if (antigo && antigo.squad) {
      if (!antigo.ed) antigo.ed = "pro";
      TM.storage.writeRaw("public", KEY, antigo);
      TM.storage.removeRaw("pro", KEY);
      return antigo;
    }
    return null;
  }
  function gravarClube(s) { TM.storage.writeRaw("public", KEY, s); }
  function apagarClube() { TM.storage.removeRaw("public", KEY); TM.storage.removeRaw("pro", KEY); }

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
  // trocou de edição? o elenco de onde as cartas são sorteadas muda inteiro
  try { TM.storage.onEditionChange(function () { _pool = null; _byPos = null; }); } catch (e) {}
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
  // patamares do Total Match (em vez de bronze/prata/ouro): o topo é raro de verdade
  function rarOf(ov) { return ov >= 85 ? "l" : ov >= 75 ? "g" : ov >= 65 ? "s" : "b"; }
  var RAR_NAME = { b: "Base", s: "Elite", g: "Craque", l: "Lenda" };
  var RAR_ORDER = ["b", "s", "g", "l"];

  /* ---------- versões de carta ----------
     Cada versão tem cor própria, um ganho de nota e uma raridade no pacote.
     `sel` é o selo do rodapé; `pool` diz de onde o jogador é sorteado. */
  var VERSOES = {
    base:  { n: "Base",             sel: "",                    ov: 0, peso: 1,      cor: "#3a3f4a" },
    rare:  { n: "Rara",             sel: "",                    ov: 0, peso: 1,      cor: "#5b6270" },
    totw:  { n: "Seleção da Semana", sel: "Seleção da Semana",  ov: 2, peso: 0.060,  cor: "#111318" },
    rodada:{ n: "Destaque da Rodada", sel: "Destaque da Rodada", ov: 1, peso: 0.020, teto: 0.075, cor: "#0f766e", minOv: 72 },
    mes:   { n: "Craque do Mês",    sel: "Craque do Mês",       ov: 3, peso: 0.005, teto: 0.020, cor: "#7c2d12", minOv: 78 },
    joia:  { n: "Joia",             sel: "Joia",                ov: 4, peso: 0.009, teto: 0.030, cor: "#1e3a8a", minOv: 68, maxIdade: 21 },
    heroi: { n: "Herói",            sel: "Herói",               ov: 4, peso: 0.0028, teto: 0.012, cor: "#9a3412", minOv: 80 },
    tots:  { n: "Seleção da Temporada", sel: "Seleção da Temporada", ov: 5, peso: 0.010, cor: "#a16207", minOv: 82 },
    icone: { n: "Ícone",            sel: "Ícone",               ov: 6, peso: 0.004,  cor: "#d4af37", minOv: 84 }
  };
  var VER_ORDEM = ["base", "rare", "rodada", "totw", "mes", "joia", "heroi", "tots", "icone"];
  function verInfo(v) { return VERSOES[v] || VERSOES.base; }
  function verBonus(v) { return verInfo(v).ov || 0; }
  // versão especial sorteada para um jogador, respeitando os requisitos de cada uma
  function sorteiaVersao(p, rnd, mult) {
    mult = mult || 1;
    var cands = ["rodada", "mes", "joia", "heroi", "tots", "icone"];
    for (var i = cands.length - 1; i >= 0; i--) {     // das mais raras para as comuns
      var V = VERSOES[cands[i]];
      if (V.minOv && p.overall < V.minOv) continue;
      if (V.maxIdade && (p.age || 25) > V.maxIdade) continue;
      var ch = V.peso * mult;
      if (V.teto) ch = Math.min(ch, V.teto);      // pacote caro melhora a chance, mas não vira rotina
      if (rnd() < ch) return cands[i];
    }
    return null;
  }

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
    var ov = clamp(p.overall + verBonus(ver), 1, 99);
    return { i: "c" + (Date.now() % 1e7) + "_" + (_cardSeq++), p: p.id, r: rarOf(ov), v: ver, ut: 0,
             ct: contratoDe(ver), fit: FIT_CHEIA };
  }
  // dados completos de uma carta (jogador + nota efetiva da versão)
  function cardData(card) {
    var p = TM.data.player(card.p);
    if (!p) return null;
    var ov = clamp(p.overall + verBonus(card.v), 1, 99);
    return {
      card: card, p: p, ov: ov, pos: p.pos, pos2: card.pos2 || p.pos2 || p.pos,
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
    else if (ov <= 84) v = 6100 + (ov - 79) * 5200;
    else if (ov <= 88) v = 32100 + (ov - 84) * 52000;
    else v = 240100 + (ov - 88) * 260000;
    // versão especial vale bem mais que a nota sozinha explicaria
    var mult = { totw: 2.6, rodada: 1.7, mes: 2.9, joia: 2.2, heroi: 3.4, tots: 4.2, icone: 6.5 }[ver];
    if (mult) v = Math.round(v * mult);
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
  try { TM.storage.onEditionChange(function () { _linkCache = {}; }); } catch (e) {}
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
  // quem está sem contrato não pode entrar em campo
  function podeJogar(c) { return !!c && temContrato(c); }

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
      v: 2, club: "", ed: "", apelido: "", sigla: "", escudo: "", coins: 15000, cards: [],
      squad: { f: "4-3-3", xi: [null, null, null, null, null, null, null, null, null, null, null], sub: [] },
      mkt: { day: -1, buy: [], sell: [] },
      riv: { div: 10, pts: 0, pl: 0, w: 0, d: 0, l: 0, seas: 1, best: 10, wk: 0, wkDay: -1 },
      sbc: {}, obj: { day: -1, list: [] }, packs: [], itens: [], emprDia: -1,
      stats: { opened: 0, sold: 0, bought: 0, earned: 0 },
      created: Date.now(), seed: Math.floor(Math.random() * 1e9)
    };
  }
  function st() {
    if (S) return S;
    S = lerClube();
    if (!S || !S.squad) S = null;
    return S;
  }
  function save() { if (S) gravarClube(S); }
  function reset() { S = null; apagarClube(); }
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
    { id: "bronze",   name: "Pacote Bronze",  desc: "12 itens · 1 raro garantido",                         price: 1200,   n: 12, lo: 45, hi: 64, rare: 0.10, esp: 0.3, cons: 4 },
    { id: "prata",    name: "Pacote Prata",   desc: "12 itens · 1 raro garantido",                         price: 7500,   n: 12, lo: 62, hi: 74, rare: 0.16, up: 0.04, esp: 0.6, cons: 4 },
    { id: "ouro",     name: "Pacote Craque",  desc: "12 itens · mínimo 75 de nota",                        price: 27000,  n: 12, lo: 75, hi: 99, rare: 0.22, esp: 1, cons: 3 },
    { id: "ourorare", name: "Craque Raro",    desc: "12 itens · todos raros · chance de carta especial",   price: 90000,  n: 12, lo: 75, hi: 99, rare: 1, esp: 1.6, cons: 3 },
    { id: "jumbo",    name: "Jumbo Craque",   desc: "24 itens · todos raros · 1 jogador 80+ garantido",    price: 210000, n: 24, lo: 75, hi: 99, rare: 1, floor: 80, esp: 2.2, cons: 6 },
    { id: "mega",     name: "Mega Pacote",    desc: "24 itens · 1 jogador 83+ · boa chance de especial",   price: 540000, n: 24, lo: 78, hi: 99, rare: 1, floor: 83, esp: 3.5, cons: 6 },
    { id: "premium",  name: "Pacote Lendário", desc: "24 itens · 1 jogador 84+ · a melhor chance de Ícone", tc: 15, n: 24, lo: 80, hi: 99, rare: 1, floor: 84, esp: 6, cons: 6 }
  ];
  function packById(id) { for (var i = 0; i < PACKS.length; i++) if (PACKS[i].id === id) return PACKS[i]; return null; }

  // sorteio ponderado: quanto maior a nota, muito mais raro (igual a abrir pacote de verdade)
  function drawPlayer(lo, hi, rnd, forcePos) {
    var src = forcePos ? (poolByPos()[forcePos] || pool()) : pool();
    for (var tries = 0; tries < 220; tries++) {
      var p = src[Math.floor(rnd() * src.length)];
      if (!p || p.overall < lo || p.overall > hi) continue;
      var w = Math.pow(0.60, Math.max(0, p.overall - lo));
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
      // versões especiais (Ícone, Seleção da Temporada, Craque do Mês, Joia...)
      var esp = sorteiaVersao(p, rnd, pk.esp || 1);
      if (esp) ver = esp;
      else if (isTotw(p.id) && rnd() < (pk.totw || 0.05)) ver = "totw";
      out.push({ p: p, ver: ver });
    }
    // garantias do pacote
    if (pk.floor) {
      var best = out.reduce(function (a, b) { return (b.p.overall > (a ? a.p.overall : 0)) ? b : a; }, null);
      if (!best || best.p.overall < pk.floor) {
        var g = drawPlayer(pk.floor, 99, rnd);
        if (g) out[out.length - 1] = { p: g, ver: sorteiaVersao(g, rnd, pk.esp || 1) || "rare" };
      }
    }
    if (pk.up && rnd() < pk.up) { var u = drawPlayer(75, 82, rnd); if (u) out[1] = { p: u, ver: "rare" }; }
    var cards = out.map(function (o) {
      var c = mkCard(o.p, o.ver);
      c.ut = 1;   // veio de pacote: conta lealdade na química
      return c;
    });
    cards.forEach(function (c) { addCard(s, c); });
    // consumíveis: contrato, recuperação, estilo de química e posição
    var itens = [];
    for (var j = 0; j < (pk.cons || 0); j++) {
      var it = sorteiaItem(rnd, pk);
      if (it) { addItem(s, it); itens.push(it); }
    }
    s.stats.opened = (s.stats.opened || 0) + 1;
    save();
    return { cards: cards, itens: itens };
  }


  /* ================= contrato, forma, empréstimo e consumíveis =================
     A carta não é eterna: ela tem CONTRATO em número de jogos e FORMA FÍSICA.
     Acabou o contrato, o jogador não pode ser escalado até você aplicar um item.
     Jogador de EMPRÉSTIMO vem por X jogos, não pode ser vendido e vai embora
     quando acaba. Os itens saem dos pacotes, como no Ultimate Team. */
  var CT_INICIAL = { base: 7, rare: 10 };     // especiais vêm com 12
  var FIT_CHEIA = 100, FIT_JOGO = 9, FIT_DESCANSO = 6, FIT_ALERTA = 60;

  var ESTILOS = [
    { id: "cacador",  n: "Caçador",        ic: "🏹", b: { pac: 3, sho: 3 } },
    { id: "sniper",   n: "Sniper",         ic: "🎯", b: { sho: 4, dri: 2 } },
    { id: "motor",    n: "Motor",          ic: "⚙️", b: { pac: 2, pas: 2, dri: 2 } },
    { id: "maestro",  n: "Maestro",        ic: "🎼", b: { pas: 4, dri: 2 } },
    { id: "sombra",   n: "Sombra",         ic: "🌑", b: { pac: 3, def: 3 } },
    { id: "muralha",  n: "Muralha",        ic: "🧱", b: { def: 4, phy: 2 } },
    { id: "titan",    n: "Titã",           ic: "🛡️", b: { phy: 4, def: 2 } },
    { id: "luvas",    n: "Luvas de Ouro",  ic: "🧤", b: { def: 3, phy: 3 } }
  ];
  function estiloPor(id) { for (var i = 0; i < ESTILOS.length; i++) if (ESTILOS[i].id === id) return ESTILOS[i]; return null; }

  var _itemSeq = 0;
  function novoItem(o) { o.i = "it" + (Date.now() % 1e7) + "_" + (_itemSeq++); return o; }
  function addItem(s, it) { s.itens = s.itens || []; s.itens.push(it); return it; }
  function removeItem(s, iid) { s.itens = (s.itens || []).filter(function (x) { return x.i !== iid; }); }
  function itemNome(it) {
    if (it.t === "contrato") return "Contrato +" + it.n + " jogos";
    if (it.t === "forma") return "Recuperação física";
    if (it.t === "quimica") { var e = estiloPor(it.e); return "Estilo: " + (e ? e.n : it.e); }
    if (it.t === "posicao") return "Posição alternativa: " + it.p;
    return "Item";
  }
  function itemIcone(it) {
    if (it.t === "contrato") return "📄";
    if (it.t === "forma") return "💚";
    if (it.t === "quimica") { var e = estiloPor(it.e); return e ? e.ic : "🧪"; }
    if (it.t === "posicao") return "🔀";
    return "📦";
  }
  function sorteiaItem(rnd, pk) {
    var r = rnd();
    if (r < 0.42) {                               // contrato é o mais comum
      var n = rnd() < 0.55 ? 6 : rnd() < 0.85 ? 10 : 16;
      return novoItem({ t: "contrato", n: n });
    }
    if (r < 0.64) return novoItem({ t: "forma" });
    if (r < 0.92) return novoItem({ t: "quimica", e: ESTILOS[Math.floor(rnd() * ESTILOS.length)].id });
    var ps = ["DF", "MF", "FW"];
    return novoItem({ t: "posicao", p: ps[Math.floor(rnd() * ps.length)] });
  }

  // contrato inicial da carta, conforme a versão
  function contratoDe(ver) { return CT_INICIAL[ver] || 12; }
  function temContrato(c) { return (c.ct == null ? 1 : c.ct) > 0; }
  function ehEmprestimo(c) { return c.ln != null; }
  function podeVender(c) { return !ehEmprestimo(c); }

  // saves antigos não tinham contrato nem forma: preenche na primeira vez
  function migraCartas(s) {
    var mudou = false;
    (s.cards || []).forEach(function (c) {
      if (c.ct == null) { c.ct = contratoDe(c.v); mudou = true; }
      if (c.fit == null) { c.fit = FIT_CHEIA; mudou = true; }
    });
    if (!s.itens) { s.itens = []; mudou = true; }
    if (mudou) save();
  }

  // desconta um jogo de contrato e de forma de quem entrou em campo
  function gastaJogo(s) {
    var m = cardMap(s), saiu = [];
    s.squad.xi.forEach(function (cid) {
      var c = cid && m[cid]; if (!c) return;
      if (c.ct != null) c.ct = Math.max(0, c.ct - 1);
      c.fit = clamp((c.fit == null ? FIT_CHEIA : c.fit) - FIT_JOGO, 0, FIT_CHEIA);
      if (c.ln != null) { c.ln = Math.max(0, c.ln - 1); if (c.ln === 0) saiu.push(c); }
    });
    (s.squad.sub || []).forEach(function (cid) {          // quem ficou no banco descansa
      var c = m[cid]; if (!c) return;
      c.fit = clamp((c.fit == null ? FIT_CHEIA : c.fit) + FIT_DESCANSO, 0, FIT_CHEIA);
    });
    (s.cards || []).forEach(function (c) {                 // quem nem foi relacionado descansa mais
      var no = s.squad.xi.indexOf(c.i) >= 0 || (s.squad.sub || []).indexOf(c.i) >= 0;
      if (!no) c.fit = clamp((c.fit == null ? FIT_CHEIA : c.fit) + FIT_DESCANSO + 2, 0, FIT_CHEIA);
    });
    saiu.forEach(function (c) { removeCard(s, c.i); });
    save();
    return saiu;
  }

  // penalidade por cansaço: abaixo de 60 de forma o jogador rende menos
  function penFisica(fit) {
    if (fit == null || fit >= FIT_ALERTA) return 0;
    return Math.round((FIT_ALERTA - fit) * 0.12);
  }


  /* ---------- empréstimo: um craque por poucos jogos ----------
     Um por dia, de graça. Não pode vender, não entra em DME e vai embora
     quando acabam os jogos. É a forma de experimentar quem você não tem. */
  var EMPRESTIMOS = [
    { id: "e1", n: 3, lo: 84, hi: 87, ver: "rare",  tx: "3 jogos" },
    { id: "e2", n: 5, lo: 80, hi: 83, ver: "rare",  tx: "5 jogos" },
    { id: "e3", n: 2, lo: 88, hi: 99, ver: "totw",  tx: "2 jogos" },
    { id: "e4", n: 7, lo: 76, hi: 80, ver: "base",  tx: "7 jogos" }
  ];
  function emprestimoDoDia(s) {
    var d = today();
    var rnd = mulberry(hashStr("empr" + d + "" + s.seed));
    var op = EMPRESTIMOS[Math.floor(rnd() * EMPRESTIMOS.length)];
    var p = drawPlayer(op.lo, op.hi, rnd);
    return p ? { op: op, p: p, dia: d } : null;
  }
  function pegaEmprestimo(s, ofer) {
    var c = mkCard(ofer.p, ofer.op.ver);
    c.ln = ofer.op.n;                 // jogos de empréstimo
    c.ct = ofer.op.n;                 // contrato acompanha o empréstimo
    c.ut = 0;                         // emprestado não conta lealdade
    addCard(s, c);
    s.emprDia = ofer.dia;
    save();
    return c;
  }

  /* ================= mercado ================= */
  // o mercado do dia é gerado por semente: some quem foi comprado, repõe no dia seguinte
  function seedMarket(s) {
    var d = today();
    if (s.mkt.day === d && s.mkt.buy && s.mkt.buy.length) return;
    var rnd = mulberry(hashStr("mkt" + d + "" + s.seed));
    var list = [];
    // o mercado do dia vai até 86: quem quer Lenda (85+) precisa tirar de pacote,
    // fechar um DME difícil ou subir de divisão — não dá para simplesmente comprar
    var bands = [[45, 64, 16], [65, 74, 20], [75, 79, 18], [80, 83, 10], [84, 86, 3]];
    bands.forEach(function (b) {
      for (var i = 0; i < b[2]; i++) {
        var p = drawPlayer(b[0], b[1], rnd);
        if (!p) continue;
        var ver = rnd() < 0.12 ? "rare" : "base";
        if (isTotw(p.id) && rnd() < 0.5) ver = "totw";
        var ov = p.overall + (ver === "totw" ? 2 : 0);
        var base = basePrice(ov, ver);
        // quanto melhor a carta, mais os vendedores pedem acima da média
        var sobretaxa = ov >= 84 ? 1.6 : ov >= 80 ? 1.2 : 1;
        var bin = Math.round(base * sobretaxa * (0.9 + rnd() * 0.5) / 50) * 50;
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
    { id: "ouro", name: "Elenco de Ouro", tip: "Só cartas de ouro e química alta.", req: [{ t: "rar", r: "g", v: 11 }, { t: "chem", v: 65 }], rew: { coins: 15000, pack: "ourorare" } },
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
      else if (r.t === "rar") {
        var mi = RAR_ORDER.indexOf(r.r);
        have = filled.filter(function (d) { return RAR_ORDER.indexOf(d.rar) >= mi; }).length;
        label = "Cartas " + RAR_NAME[r.r] + " ou melhor: " + r.v;
      }
      else if (r.t === "rare") { have = filled.filter(function (d) { return d.ver === "rare" || d.ver === "totw"; }).length; label = "Cartas raras: " + r.v; }
      else if (r.t === "totw") { have = filled.filter(function (d) { return d.ver === "totw"; }).length; label = "Cartas do Time da Semana: " + r.v; }
      return { label: label, have: have, need: r.v, ok: have >= r.v };
    });
  }

  /* ================= objetivos diários ================= */
  var OBJ_POOL = [
    { id: "riv3", tx: "Jogue 3 partidas nos Rivais", n: 3, c: 2400 },
    { id: "win2", tx: "Vença 2 partidas nos Rivais", n: 2, c: 4000 },
    { id: "pack2", tx: "Abra 2 pacotes", n: 2, c: 1900 },
    { id: "sell3", tx: "Venda 3 jogadores no mercado", n: 3, c: 2900 },
    { id: "buy1", tx: "Compre 1 jogador no mercado", n: 1, c: 1600 },
    { id: "goal5", tx: "Marque 5 gols nos Rivais", n: 5, c: 3200 },
    { id: "chem70", tx: "Tenha um elenco com 70 de química", n: 1, c: 3500 },
    { id: "sbc1", tx: "Complete 1 DME", n: 1, c: 4800 }
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
    { d: 10, need: 12, ov: 58, win: 1300 }, { d: 9, need: 15, ov: 62, win: 1900 },
    { d: 8, need: 18, ov: 66, win: 2700 }, { d: 7, need: 21, ov: 70, win: 3700 },
    { d: 6, need: 24, ov: 73, win: 5000 }, { d: 5, need: 27, ov: 76, win: 6700 },
    { d: 4, need: 30, ov: 79, win: 9000 }, { d: 3, need: 33, ov: 82, win: 12000 },
    { d: 2, need: 36, ov: 85, win: 16000 }, { d: 1, need: 999, ov: 88, win: 24000 }
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
  // chem = química do jogador (0..10). O estilo rende proporcional à química,
  // igual ao Ultimate Team: sem química, o estilo quase não vale nada.
  function statsOf(d, chem) {
    var a = d.attrs || {}, isGk = d.pos === "GK";
    var bump = verBonus(d.ver);
    var est = d.card && d.card.sty ? estiloPor(d.card.sty) : null;
    var forca = chem == null ? 1 : clamp(chem / 10, 0, 1);
    var pen = penFisica(d.card ? d.card.fit : null);
    return ORDER.map(function (k) {
      var ganho = est && est.b[k] ? Math.round(est.b[k] * forca) : 0;
      return { k: k, l: (isGk ? GK_LABEL : ST_LABEL)[k], v: clamp(Math.round((a[k] || 50) + bump + ganho - pen), 1, 99), ganho: ganho, pen: pen };
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
    // um selo só no rodapé: a versão manda, senão o patamar
    var VI = verInfo(d.ver);
    kids.push(el("div", { class: "utc-tier" + (VI.sel ? " esp" : ""), text: VI.sel || (RAR_NAME[d.rar] || "") }));
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
    // O Total Ultimate é com JOGADOR REAL: ele roda sempre nos dados da Season
    // Update. As cartas guardam o id do jogador, que muda de uma edição para a
    // outra, então ao entrar aqui a edição é acertada sozinha, sem perguntar.
    if (s.ed && s.ed !== TM.storage.edition()) {
      if (s.ed !== "pro" || TM.storage.suUnlocked()) { TM.storage.switchEdition(s.ed); goUT("ut"); return; }
      renderEdicaoErrada(screen, s); return;      // clube de cartas reais sem a Season Update liberada
    }
    migraCartas(s); seedMarket(s); objRefresh(s); tickSales(s);
    renderHub(screen, s);
  });

  function nomeEdicao(e) { return e === "pro" ? "Season Update" : "edição pública"; }
  // só cai aqui quem tem um clube de cartas reais mas perdeu o acesso à Season Update
  function renderEdicaoErrada(screen, s) {
    screen.classList.add("ut-screen");
    screen.appendChild(TM.ui.topbar("Total Ultimate", function () { goUT("modes"); }));
    screen.appendChild(el("div", { class: "ut-intro" }, [
      el("div", { class: "ut-intro-logo", text: "🔒" }),
      el("h1", { class: "ut-intro-title", text: s.club || "Seu clube" }),
      el("p", { class: "ut-intro-tx", text: "Suas cartas são de jogadores reais e precisam da Season Update para aparecer." }),
      el("p", { class: "ut-intro-tx", text: (s.cards || []).length + " cartas · " + fmtC(s.coins || 0) + " moedas · Divisão " + ((s.riv && s.riv.div) || 10) + " — nada foi perdido, está tudo guardado." }),
      TM.ui.button("Voltar ao menu", function () { goUT("modes"); }, "btn primary wide")
    ]));
  }

  function renderIntro(screen) {
    // carta do Ultimate é de jogador REAL: se a Season Update está liberada,
    // entra nela antes de sortear o elenco inicial
    if (TM.storage.suUnlocked() && TM.storage.edition() !== "pro") {
      TM.storage.switchEdition("pro"); _pool = null; _byPos = null;
      goUT("ut"); return;
    }
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
        S.ed = TM.storage.edition();          // de qual edição são as cartas
        // pacote inicial: um elenco jogável para começar
        var start = packById("prata");
        openPack(S, { n: 16, lo: 60, hi: 73, rare: 0.25 });
        autoFill(S);
        save();
        TM.ui.toast("Clube criado! Seu elenco inicial está pronto.");
        goUT("ut");
      }, "btn primary wide")
    ]));
  }

  /* ---------- hub ---------- */
  function renderHub(screen, s) {
    screen.classList.add("ut-screen", "ut-hub");
    screen.appendChild(utTop(nomeExibido(s), function () { goUT("modes"); }, s));
    var r = squadRating(s);
    var pend = (s.mkt.sell || []).filter(function (L) { return L.sold; }).length;
    var objDone = (s.obj.list || []).filter(function (o) { return o.done; }).length;
    var objTot = (s.obj.list || []).length;
    var info = divInfo(s.riv.div);
    var itens = (s.itens || []).length;
    var empr = (s.cards || []).filter(function (c) { return c.ln != null; }).length;
    var semCt = (s.cards || []).filter(function (c) { return !temContrato(c); }).length;
    var ofer = emprestimoDoDia(s);
    var temEmpr = ofer && s.emprDia !== ofer.dia;
    var melhor = (s.cards || []).map(cardData).filter(Boolean).sort(function (a, b) { return b.ov - a.ov; })[0];

    /* ---- cabeçalho: escudo, nome, divisão e o craque do elenco ---- */
    var cab = el("div", { class: "ut-hero" }, [
      el("div", { class: "ut-hero-bg" }),
      el("div", { class: "ut-hero-in" }, [
        el("div", { class: "ut-escudo grande", style: "--c:" + (s.cor || "#22c55e") }, [el("span", { text: s.escudo || "🛡️" })]),
        el("div", { class: "ut-hero-txt" }, [
          el("div", { class: "ut-hero-nm", text: nomeExibido(s) }),
          el("div", { class: "ut-hero-sub" }, [
            el("span", { class: "ut-sig", text: siglaDe(s) }),
            el("span", { text: "Divisão " + s.riv.div }),
            el("span", { text: s.cards.length + " cartas" })
          ]),
          el("div", { class: "ut-hero-rec", text: s.riv.w + "V · " + s.riv.d + "E · " + s.riv.l + "D  ·  " + s.riv.pts + "/" + (info.need === 999 ? "—" : info.need) + " pts para subir" })
        ]),
        el("div", { class: "ut-hero-nums" }, [
          el("div", { class: "ut-hc-box" }, [el("b", { text: r.ov || "—" }), el("i", { text: "NOTA" })]),
          el("div", { class: "ut-hc-box chem" }, [el("b", { text: r.chem }), el("i", { text: "QUÍMICA" })])
        ])
      ])
    ]);
    if (info.need !== 999) {
      cab.querySelector(".ut-hero-in").appendChild(el("div", { class: "ut-hero-bar" }, [
        el("div", { class: "ut-hero-bar-f", style: "width:" + clamp(Math.round(s.riv.pts / info.need * 100), 0, 100) + "%" })
      ]));
    }
    screen.appendChild(cab);

    /* ---- avisos que pedem ação ---- */
    var avisos = [];
    if (semCt) avisos.push({ ic: "📄", tx: semCt + (semCt > 1 ? " cartas sem contrato" : " carta sem contrato"), r: "ut-club", cls: "alerta" });
    if (pend) avisos.push({ ic: "💰", tx: pend + (pend > 1 ? " vendas concluídas" : " venda concluída"), r: "ut-market", cls: "bom" });
    if (s.packs && s.packs.length) avisos.push({ ic: "📦", tx: s.packs.length + " pacote(s) guardado(s)", r: "ut-store", cls: "bom" });
    if (temEmpr) avisos.push({ ic: "🤝", tx: "Empréstimo do dia disponível", r: "ut-store", cls: "" });
    if (objDone && objDone === objTot && objTot) avisos.push({ ic: "🎯", tx: "Todos os objetivos do dia concluídos", r: "ut-obj", cls: "bom" });
    if (avisos.length) {
      screen.appendChild(el("div", { class: "ut-avisos" }, avisos.map(function (a) {
        return el("button", { class: "ut-aviso " + a.cls, on: { click: function () { goUT(a.r); } } }, [
          el("span", { class: "ut-av-ic", text: a.ic }), el("span", { text: a.tx }), el("span", { class: "ut-av-go", text: "›" })
        ]);
      })));
    }

    /* ---- o craque do elenco em destaque ---- */
    if (melhor) {
      screen.appendChild(el("div", { class: "ut-estrela" }, [
        cardEl(melhor, { cls: "mini", on: function () { showCard(melhor, s, function () { goUT("ut"); }); } }),
        el("div", { class: "ut-estrela-i" }, [
          el("div", { class: "ut-estrela-l", text: "Craque do elenco" }),
          el("div", { class: "ut-estrela-n", text: melhor.name }),
          el("div", { class: "ut-estrela-d", text: verInfo(melhor.ver).n + " · " + (melhor.club ? melhor.club.name : "") }),
          el("div", { class: "ut-estrela-d", text: "vale ~" + fmtC(basePrice(melhor.ov, melhor.ver)) })
        ])
      ]));
    }

    /* ---- abas agrupadas ---- */
    function tile(ic, name, sub, route, badge, acc) {
      return el("button", { class: "ut-tile" + (acc ? " a-" + acc : ""), on: { click: function () { goUT(route); } } }, [
        el("span", { class: "ut-t-ic", text: ic }),
        el("span", { class: "ut-t-nm", text: name }),
        el("span", { class: "ut-t-sub", text: sub }),
        badge ? el("span", { class: "ut-t-badge", text: badge }) : null
      ]);
    }
    function grupo(titulo, tiles) {
      screen.appendChild(el("div", { class: "ut-grupo-t", text: titulo }));
      screen.appendChild(el("div", { class: "ut-tiles" }, tiles));
    }

    grupo("Jogar", [
      tile("🏆", "Rivais", "Divisão " + s.riv.div + " · suba até a 1ª", "ut-rivals", null, "riv"),
      tile("🌐", "Online", "Enfrente elencos de verdade", "ut-online", null, "onl"),
      tile("🧩", "DME", "Desafios de construção", "ut-sbc", null, "dme"),
      tile("🎯", "Objetivos", objDone + "/" + objTot + " concluídos", "ut-obj", objTot && objDone < objTot ? String(objTot - objDone) : null, "obj")
    ]);
    grupo("Elenco", [
      tile("⚽", "Escalação", "Time, química e formação", "ut-squad", null, "esc"),
      tile("👥", "Meu Clube", s.cards.length + " cartas" + (empr ? " · " + empr + " emprestada(s)" : ""), "ut-club", semCt ? String(semCt) : null, "clb"),
      tile("🧪", "Itens", itens ? itens + " consumíveis" : "Contratos, forma e estilos", "ut-itens", itens ? String(itens) : null, "itn"),
      tile("🛡️", "Identidade", "Apelido, sigla e escudo", "ut-identidade", null, "idt")
    ]);
    grupo("Mercado", [
      tile("📦", "Loja", "Pacotes e empréstimo do dia", "ut-store", s.packs && s.packs.length ? String(s.packs.length) : (temEmpr ? "!" : null), "loj"),
      tile("💱", "Mercado", "Compre e venda cartas", "ut-market", pend ? String(pend) : null, "mkt"),
      tile("📊", "Estatísticas", "Sua caminhada no Ultimate", "ut-stats", null, "est")
    ]);

    screen.appendChild(el("div", { class: "ut-foot" }, [
      TM.ui.button("Reiniciar clube", function () {
        TM.ui.confirm("Recomeçar?", "Seu clube, cartas e moedas serão apagados. Não dá para desfazer.", "Apagar tudo", function () {
          reset(); goUT("ut");
        }, true);
      }, "btn ghost small")
    ]));
  }

  /* ---------- estatísticas do clube ---------- */
  TM.ui.register("ut-stats", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("Estatísticas", function () { goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    var ds = (s.cards || []).map(cardData).filter(Boolean);
    var porVer = {};
    ds.forEach(function (d) { porVer[d.ver] = (porVer[d.ver] || 0) + 1; });
    var valor = ds.reduce(function (a, d) { return a + basePrice(d.ov, d.ver); }, 0);
    var jogos = s.riv.pl || 0;
    function linha(l, v) { return el("div", { class: "ut-dl" }, [el("i", { text: l }), el("b", { text: v })]); }
    body.appendChild(el("div", { class: "ut-sec-t", text: "Clube" }));
    body.appendChild(el("div", { class: "ut-statbox" }, [
      linha("Cartas", ds.length),
      linha("Valor do elenco", fmtC(valor)),
      linha("Moedas", fmtC(s.coins || 0)),
      linha("Melhor divisão", "Divisão " + (s.riv.best || s.riv.div)),
      linha("Itens guardados", (s.itens || []).length)
    ]));
    body.appendChild(el("div", { class: "ut-sec-t", text: "Rivais" }));
    body.appendChild(el("div", { class: "ut-statbox" }, [
      linha("Partidas", jogos),
      linha("Vitórias", s.riv.w || 0),
      linha("Empates", s.riv.d || 0),
      linha("Derrotas", s.riv.l || 0),
      linha("Aproveitamento", jogos ? Math.round(((s.riv.w * 3 + s.riv.d) / (jogos * 3)) * 100) + "%" : "—")
    ]));
    body.appendChild(el("div", { class: "ut-sec-t", text: "Coleção por versão" }));
    var linhas = VER_ORDEM.filter(function (v) { return porVer[v]; }).map(function (v) {
      return el("div", { class: "ut-dl" }, [el("i", { text: verInfo(v).n }), el("b", { text: porVer[v] })]);
    });
    body.appendChild(el("div", { class: "ut-statbox" }, linhas.length ? linhas : [el("div", { class: "ut-empty-tx", text: "Sem cartas." })]));
    body.appendChild(el("div", { class: "ut-sec-t", text: "Pacotes" }));
    body.appendChild(el("div", { class: "ut-statbox" }, [
      linha("Abertos", s.stats.opened || 0),
      linha("Compras no mercado", s.stats.bought || 0),
      linha("Vendas", s.stats.sold || 0),
      linha("Moedas ganhas", fmtC(s.stats.earned || 0))
    ]));
  });

  function autoFill(s) {
    var F = TM.comp.FORMATIONS[s.squad.f] || TM.comp.FORMATIONS["4-3-3"];
    var used = {}, xi = [];
    var all = s.cards.map(cardData).filter(Boolean).filter(function (d) { return podeJogar(d.card); });
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
      pitch.appendChild(el("div", { class: "ut-pmark circ" }));
      pitch.appendChild(el("div", { class: "ut-pmark meio" }));
      pitch.appendChild(el("div", { class: "ut-pmark area" }));
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
          cardEl(d, { chem: d ? ch.per[i] : null, role: role, cls: "mini" })
        ]);
        if (d && !podeJogar(d.card)) holder.appendChild(el("span", { class: "ut-sem-contrato", text: "SEM CONTRATO" }));
        arrastavel(holder, i);
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

    /* Arrastar uma carta em cima de outra troca as duas de posição, igual à
       escalação da carreira. Toque simples continua abrindo a lista. */
    function arrastavel(holder, idx) {
      var arrastando = false, x0 = 0, y0 = 0, alvo = null;
      holder.addEventListener("pointerdown", function (ev) {
        if (ev.button != null && ev.button !== 0) return;
        x0 = ev.clientX; y0 = ev.clientY; arrastando = false;
        holder.setPointerCapture(ev.pointerId);
        function mover(e) {
          var dx = e.clientX - x0, dy = e.clientY - y0;
          if (!arrastando && Math.abs(dx) + Math.abs(dy) < 8) return;
          arrastando = true;
          holder.classList.add("arrastando");
          holder.style.transform = "translate(-50%,-50%) translate(" + dx + "px," + dy + "px)";
          var novo = casaSob(e.clientX, e.clientY, holder);
          if (novo !== alvo) {
            if (alvo) alvo.el.classList.remove("alvo");
            alvo = novo;
            if (alvo) alvo.el.classList.add("alvo");
          }
        }
        function soltar(e) {
          holder.removeEventListener("pointermove", mover);
          holder.removeEventListener("pointerup", soltar);
          holder.removeEventListener("pointercancel", soltar);
          holder.classList.remove("arrastando");
          holder.style.transform = "";
          if (alvo) alvo.el.classList.remove("alvo");
          if (arrastando && alvo && alvo.i !== idx) {
            var a = s.squad.xi[idx], b = s.squad.xi[alvo.i];
            s.squad.xi[idx] = b; s.squad.xi[alvo.i] = a;
            save(); draw();
          } else if (!arrastando) {
            pick(idx, slotRole(F[idx]));
          }
          alvo = null;
        }
        holder.addEventListener("pointermove", mover);
        holder.addEventListener("pointerup", soltar);
        holder.addEventListener("pointercancel", soltar);
      });
    }
    function casaSob(cx, cy, menos) {
      var achou = null;
      var todos = pitch.querySelectorAll(".ut-slot");
      for (var k = 0; k < todos.length; k++) {
        if (todos[k] === menos) continue;
        var r = todos[k].getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) { achou = { el: todos[k], i: k }; break; }
      }
      return achou;
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

  /* painel de contrato, forma física e estilo de química dentro da carta */
  function painelCarta(d, s, refresh) {
    var c = d.card;
    var ct = c.ct == null ? contratoDe(c.v) : c.ct;
    var fit = c.fit == null ? FIT_CHEIA : c.fit;
    var est = c.sty ? estiloPor(c.sty) : null;
    var linhas = [];

    if (ehEmprestimo(c)) {
      linhas.push(el("div", { class: "ut-gest-l emprestimo" }, [
        el("i", { text: "🤝 Empréstimo" }),
        el("div", { class: "ut-gest-bar" }, [ el("div", { class: "ut-gest-f emp", style: "width:" + clamp(c.ln * 20, 4, 100) + "%" }) ]),
        el("b", { text: c.ln + (c.ln === 1 ? " jogo" : " jogos") })
      ]));
    }
    linhas.push(el("div", { class: "ut-gest-l" + (ct <= 0 ? " zerado" : ct <= 2 ? " baixo" : "") }, [
      el("i", { text: "📄 Contrato" }),
      el("div", { class: "ut-gest-bar" }, [ el("div", { class: "ut-gest-f ct", style: "width:" + clamp(ct * 7, 0, 100) + "%" }) ]),
      el("b", { text: ct <= 0 ? "SEM CONTRATO" : ct + (ct === 1 ? " jogo" : " jogos") })
    ]));
    linhas.push(el("div", { class: "ut-gest-l" + (fit < FIT_ALERTA ? " baixo" : "") }, [
      el("i", { text: "💚 Forma" }),
      el("div", { class: "ut-gest-bar" }, [ el("div", { class: "ut-gest-f fit", style: "width:" + fit + "%" }) ]),
      el("b", { text: fit + "%" + (penFisica(fit) ? " (−" + penFisica(fit) + ")" : "") })
    ]));
    linhas.push(el("div", { class: "ut-gest-l" }, [
      el("i", { text: (est ? est.ic : "🧪") + " Estilo" }),
      el("div", { class: "ut-gest-txt", text: est ? est.n : "nenhum" }),
      el("b", { text: est ? "+" + ORDER.filter(function (k) { return est.b[k]; }).map(function (k) { return ST_LABEL[k]; }).join(" +") : "" })
    ]));

    var itens = (s.itens || []).filter(function (it) {
      if (it.t === "contrato") return true;
      if (it.t === "forma") return fit < FIT_CHEIA;
      if (it.t === "quimica") return true;
      if (it.t === "posicao") return it.p !== d.pos && it.p !== c.pos2;
      return false;
    });
    var acoes = el("div", { class: "ut-gest-acts" });
    if (!itens.length) {
      acoes.appendChild(el("div", { class: "ut-note", text: "Você não tem itens que sirvam para esta carta. Eles saem dos pacotes." }));
    } else {
      itens.slice(0, 14).forEach(function (it) {
        acoes.appendChild(el("button", { class: "ut-item-bt", on: { click: function () { aplicaItem(s, c, it); TM.ui.toast(itemNome(it) + " aplicado"); if (refresh) refresh(); } } }, [
          el("i", { text: itemIcone(it) }), el("span", { text: itemNome(it) })
        ]));
      });
    }
    return el("div", { class: "ut-gest" }, [ el("div", { class: "ut-gest-t", text: "Gestão da carta" }) ].concat(linhas).concat([acoes]));
  }
  function aplicaItem(s, c, it) {
    if (it.t === "contrato") c.ct = (c.ct == null ? contratoDe(c.v) : c.ct) + it.n;
    else if (it.t === "forma") c.fit = FIT_CHEIA;
    else if (it.t === "quimica") c.sty = it.e;
    else if (it.t === "posicao") c.pos2 = it.p;
    removeItem(s, it.i);
    save();
  }

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
          el("div", { class: "ut-dl" }, [el("i", { text: "Versão" }), el("b", { text: verInfo(d.ver).n })]),
          el("div", { class: "ut-dl" }, [el("i", { text: "Preço médio" }), el("b", { text: fmtC(basePrice(d.ov, d.ver)) })])
        ])
      ]),
      el("div", { class: "ut-bars" }, stats.map(function (x) {
        return el("div", { class: "ut-bar" }, [
          el("i", { text: x.l }), el("div", { class: "ut-bar-t" }, [el("div", { class: "ut-bar-f", style: "width:" + x.v + "%" })]), el("b", { text: x.v })
        ]);
      })),
      painelCarta(d, s, function () { close(); if (after) after(); }),
      el("div", { class: "ut-detail-acts" }, [
        ehEmprestimo(d.card) ? el("div", { class: "ut-note", text: "Jogador emprestado: não pode ser vendido nem usado em DME." }) : null,
        listed ? el("div", { class: "ut-note", text: "Esta carta já está à venda no mercado." }) : (sq[d.card.i] ? el("div", { class: "ut-note", text: "Está no elenco. Tire do time para vender." }) : null),
        (!listed && !sq[d.card.i] && podeVender(d.card)) ? TM.ui.button("Vender no mercado", function () { close(); listCard(d, s, after); }, "btn primary wide") : null,
        (!listed && !sq[d.card.i] && podeVender(d.card)) ? TM.ui.button("Venda rápida (" + fmtC(quickSell(d.ov, d.ver)) + ")", function () {
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

    /* ----- empréstimo do dia: um craque por poucos jogos, de graça ----- */
    var ofer = emprestimoDoDia(s);
    if (ofer) {
      var jaPegou = s.emprDia === ofer.dia;
      var dOf = cardData({ p: ofer.p.id, v: ofer.op.ver, r: rarOf(ofer.p.overall + verBonus(ofer.op.ver)), i: "prev", ut: 0 });
      body.appendChild(el("div", { class: "ut-sec-t", text: "Empréstimo do dia" }));
      body.appendChild(el("div", { class: "ut-emprestimo" }, [
        dOf ? cardEl(dOf, { cls: "tiny" }) : el("span"),
        el("div", { class: "ut-emp-i" }, [
          el("div", { class: "ut-emp-n", text: ofer.p.name }),
          el("div", { class: "ut-emp-d", text: "Por " + ofer.op.tx + ". Não pode vender nem usar em DME, e vai embora quando acabar." })
        ]),
        el("button", {
          class: "ut-pk-buy" + (jaPegou ? " off" : ""), text: jaPegou ? "PEGO HOJE" : "PEGAR",
          on: { click: function () {
            if (jaPegou) { TM.ui.toast("Você já pegou o empréstimo de hoje. Volta amanhã."); return; }
            pegaEmprestimo(s, ofer);
            TM.ui.toast(ofer.p.name + " chegou por " + ofer.op.tx + "!");
            goUT("ut-store");
          } }
        })
      ]));
    }

    /* ----- trocar Total Coins por moedas do Ultimate (caro de propósito) ----- */
    if (TM.coins) {
      body.appendChild(el("div", { class: "ut-sec-t", text: "Moedas do Ultimate" }));
      body.appendChild(el("div", { class: "ut-note", text: "Dá para trocar Total Coins por moedas, mas o câmbio é duro: o caminho barato é jogar os Rivais e cumprir objetivos." }));
      [{ tc: 5, m: 20000 }, { tc: 12, m: 60000 }, { tc: 30, m: 180000 }].forEach(function (op) {
        body.appendChild(el("div", { class: "ut-pack r-g" }, [
          el("div", { class: "ut-pk-ic", text: "🪙" }),
          el("div", { class: "ut-pk-i" }, [
            el("div", { class: "ut-pk-n", text: fmtC(op.m) + " moedas" }),
            el("div", { class: "ut-pk-d", text: "Custa " + op.tc + " Total Coins" })
          ]),
          el("button", { class: "ut-pk-buy tc", text: op.tc + " 🪙", on: { click: function () {
            if (!TM.coins.canPay(op.tc)) { TM.ui.toast("Total Coins insuficientes"); return; }
            TM.ui.confirm("Trocar " + op.tc + " Total Coins?", "Você recebe " + fmtC(op.m) + " moedas do Ultimate.", "Trocar", function () {
              TM.coins.pay(op.tc, "Moedas do Ultimate", function () { earn(s, op.m, "Troca de Total Coins"); goUT("ut-store"); });
            });
          } } })
        ]));
      });
    }
  });


  /* ---------- identidade do clube: apelido, sigla e escudo ---------- */
  var ESCUDOS = ["🦁","🦅","🐺","🐂","🦈","🐉","⚓","⚡","👑","🔥","⭐","🛡️","🏹","🐍","🐆","🌋","⚔️","💎"];
  var CORES = ["#22c55e","#ef4444","#3b82f6","#f59e0b","#a855f7","#14b8a6","#ec4899","#64748b","#d4af37"];
  function siglaAuto(nome) {
    var ps = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!ps.length) return "TUC";
    if (ps.length === 1) return ps[0].slice(0, 3).toUpperCase();
    return ps.slice(0, 3).map(function (x) { return x[0]; }).join("").toUpperCase();
  }
  function nomeExibido(s) { return (s && (s.apelido || s.club)) || "Meu Ultimate"; }
  function siglaDe(s) { return (s && s.sigla) || siglaAuto(s && (s.apelido || s.club)); }

  TM.ui.register("ut-identidade", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("Identidade", function () { goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);

    var nome = el("input", { class: "ut-input", type: "text", maxlength: "22", value: s.club || "", placeholder: "Nome do clube" });
    var apelido = el("input", { class: "ut-input", type: "text", maxlength: "18", value: s.apelido || "", placeholder: "Apelido (como o time é chamado)" });
    var sigla = el("input", { class: "ut-input sigla", type: "text", maxlength: "3", value: siglaDe(s), placeholder: "SIG" });
    var escolhido = s.escudo || ESCUDOS[0];
    var cor = s.cor || CORES[0];

    var previa = el("div", { class: "ut-id-previa" });
    function desenhaPrevia() {
      TM.ui.clear(previa);
      previa.appendChild(el("div", { class: "ut-escudo grande", style: "--c:" + cor }, [el("span", { text: escolhido })]));
      previa.appendChild(el("div", { class: "ut-id-txt" }, [
        el("div", { class: "ut-id-nome", text: (apelido.value || nome.value || "Meu Ultimate") }),
        el("div", { class: "ut-id-sig", text: (sigla.value || siglaAuto(nome.value)).toUpperCase() })
      ]));
    }
    [nome, apelido, sigla].forEach(function (i) { i.addEventListener("input", desenhaPrevia); });
    desenhaPrevia();

    body.appendChild(previa);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Nome e apelido" }));
    body.appendChild(nome);
    body.appendChild(apelido);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Abreviação (3 letras, aparece no placar)" }));
    body.appendChild(sigla);

    body.appendChild(el("div", { class: "ut-sec-t", text: "Escudo" }));
    var grade = el("div", { class: "ut-escudos" });
    ESCUDOS.forEach(function (e) {
      var b = el("button", { class: "ut-escudo" + (e === escolhido ? " sel" : ""), style: "--c:" + cor }, [el("span", { text: e })]);
      b.addEventListener("click", function () {
        escolhido = e;
        grade.querySelectorAll(".ut-escudo").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel"); desenhaPrevia();
      });
      grade.appendChild(b);
    });
    body.appendChild(grade);

    body.appendChild(el("div", { class: "ut-sec-t", text: "Cor" }));
    var cores = el("div", { class: "ut-cores" });
    CORES.forEach(function (c) {
      var b = el("button", { class: "ut-cor" + (c === cor ? " sel" : ""), style: "background:" + c });
      b.addEventListener("click", function () {
        cor = c;
        cores.querySelectorAll(".ut-cor").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        grade.querySelectorAll(".ut-escudo").forEach(function (x) { x.style.setProperty("--c", cor); });
        desenhaPrevia();
      });
      cores.appendChild(b);
    });
    body.appendChild(cores);

    body.appendChild(TM.ui.button("Salvar", function () {
      s.club = (nome.value || "").trim() || s.club || "Meu Ultimate";
      s.apelido = (apelido.value || "").trim();
      s.sigla = ((sigla.value || "").trim() || siglaAuto(s.apelido || s.club)).toUpperCase().slice(0, 3);
      s.escudo = escolhido; s.cor = cor;
      save();
      TM.ui.toast("Identidade salva");
      goUT("ut");
    }, "btn primary wide"));
  });

  /* ---------- meus itens (consumíveis) ---------- */
  TM.ui.register("ut-itens", function (screen) {
    var s = st(); if (!s) { goUT("ut"); return; }
    screen.classList.add("ut-screen");
    screen.appendChild(utTop("Itens", function () { goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    var itens = s.itens || [];
    body.appendChild(el("div", { class: "ut-note", text: "Os itens saem dos pacotes. Aplique-os na tela de cada carta: contrato dá mais jogos, recuperação enche a forma, estilo mexe nos atributos conforme a química e posição abre outra função." }));
    if (!itens.length) { body.appendChild(el("div", { class: "ut-empty-tx", text: "Nenhum item por enquanto. Abra pacotes." })); return; }
    var grupos = {};
    itens.forEach(function (it) { var k = itemNome(it); (grupos[k] = grupos[k] || []).push(it); });
    Object.keys(grupos).sort().forEach(function (k) {
      var g = grupos[k];
      body.appendChild(el("div", { class: "ut-item-lin" }, [
        el("span", { class: "ut-item-ic", text: itemIcone(g[0]) }),
        el("span", { class: "ut-item-nm", text: k }),
        el("span", { class: "ut-item-qt", text: "x" + g.length })
      ]));
    });
  });

  /* ---------- abertura de pacote (com revelação) ---------- */
  TM.ui.register("ut-pack", function (screen, params) {
    var s = st(); if (!s) { goUT("ut"); return; }
    var pk = packById((params || {}).pack) || PACKS[0];
    var aberto = openPack(s, pk);
    var cards = aberto.cards, itensGanhos = aberto.itens || [];
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
        itensGanhos.length ? el("div", { class: "ut-sum-b", text: "Itens: " + itensGanhos.length }) : null,
        itensGanhos.length ? el("div", { class: "ut-itens-lin" }, itensGanhos.map(function (it) {
          return el("span", { class: "ut-item-chip" }, [ el("i", { text: itemIcone(it) }), el("b", { text: itemNome(it) }) ]);
        })) : null,
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
      [["l", "Lenda"], ["g", "Craque"], ["s", "Elite"], ["b", "Base"]].forEach(function (o) {
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
      var pen = penFisica(d.card.fit);
      p.overall = clamp(effOv(d.ov, ch.per[i]) - pen, 1, 99);
      p.attrs = {};
      statsOf(d, ch.per[i]).forEach(function (x) { p.attrs[x.k] = x.v; });   // estilo + cansaço vão para o campo
      players.push(p);
    });
    (s.squad.sub || []).forEach(function (cid) {
      var c = m[cid]; if (!c) return;
      var d = cardData(c); if (!d) return;
      var p = Object.assign({}, d.p); p.overall = d.ov; players.push(p);
    });
    return { id: "utteam", name: nomeExibido(s), short: siglaDe(s), players: players };
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
        var foram = gastaJogo(s);        // contrato -1, forma -9, empréstimo -1
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
          // subir de divisão é o caminho mais confiável para uma Lenda
          s.packs = s.packs || []; s.packs.push(s.riv.div <= 2 ? "mega" : s.riv.div <= 4 ? "jumbo" : s.riv.div <= 7 ? "ourorare" : "ouro");
        }
        var r = squadRating(s);
        if (r.chem >= 70) objBump(s, "chem70", 1);
        save();
        if (foram.length) {
          var nomes = foram.map(function (c) { var pp = TM.data.player(c.p); return pp ? pp.name : "Jogador"; }).join(", ");
          TM.ui.toast("Empréstimo encerrado: " + nomes);
        }
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
