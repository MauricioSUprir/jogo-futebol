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
  // nome curto da carta: o sobrenome, mas "Vinícius Júnior" vira "Vinícius Jr." (não "Júnior")
  // e partículas ficam junto ("van Dijk", "De Bruyne", "Mac Allister", "Di María")
  var SUFIXO = { "júnior": "Jr.", "junior": "Jr.", "jr": "Jr.", "jr.": "Jr.", "neto": "Neto", "filho": "Filho", "sobrinho": "Sobrinho", "ii": "II", "iii": "III" };
  var PARTICULA = { van: 1, von: 1, de: 1, da: 1, "do": 1, dos: 1, das: 1, di: 1, del: 1, della: 1, der: 1, den: 1, le: 1, la: 1, el: 1, al: 1, mac: 1, ter: 1, ten: 1, du: 1 };
  function shortNm(name) {
    var a = String(name || "").trim().split(/\s+/);
    if (a.length < 2) return a[0] || "—";
    var ult = a[a.length - 1], suf = SUFIXO[ult.toLowerCase()];
    if (suf) return a[a.length - 2] + " " + suf;
    var pen = a[a.length - 2];
    if (a.length > 2 && PARTICULA[pen.toLowerCase()]) return pen + " " + ult;
    if (a.length === 2 && PARTICULA[pen.toLowerCase()] && pen[0] === pen[0].toUpperCase()) return pen + " " + ult;   // "De Bruyne"
    return ult;
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
  // cor da carta de cada patamar: bronze, prata, ouro e, no topo, o verde do Total Match
  var RAR_COR = { b: "bronze", s: "prata", g: "ouro", l: "verde" };
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
  // a Evolução guarda os ganhos na própria carta (card.evo.b: ov e atributos)
  function cardData(card) {
    var p = TM.data.player(card.p);
    if (!p) return null;
    var evo = card.evo && card.evo.b ? card.evo.b : null;
    var ov = clamp(p.overall + verBonus(card.v) + ((evo && evo.ov) || 0), 1, 99);
    return {
      card: card, p: p, ov: ov, pos: p.pos, pos2: principal(p), posicoes: posicoesDe(p, card),
      name: p.name, rar: evo ? rarOf(ov) : card.r, ver: card.v, evo: evo,
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

  /* ================= química (modelo do Ultimate atual) =================
     Cada titular soma de 0 a 3 pontos e o time vai até 33. Só conta quem está
     NA POSIÇÃO (a principal ou uma alternativa): fora dela o jogador fica com 0
     e não ajuda ninguém. Os pontos vêm de quantos titulares em posição dividem
     o mesmo clube (2/4/7 → 1/2/3), a mesma liga (3/5/8) e o mesmo país (2/5/8),
     como nas notas oficiais da EA (Pitch Notes de química). Ícone e Herói já
     entram com 3 na posição; o Ícone vale 2 para o país dele e 1 para cada liga
     do time (não liga por clube); o Herói vale 2 para a liga. A química não tira
     nota de ninguém: ela LIBERA o estilo de química e dá o embalo em campo. */
  var LIM = { club: [2, 4, 7], lg: [3, 5, 8], nat: [2, 5, 8] };
  function ptsPor(n, lim) { return n >= lim[2] ? 3 : n >= lim[1] ? 2 : n >= lim[0] ? 1 : 0; }
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
  var ROLES_SETOR = { GK: ["GOL"], DF: ["ZAG", "LD", "LE"], MF: ["VOL", "MC", "MEI", "MD", "ME"], FW: ["CA", "SA", "PD", "PE"] };
  // de onde saem as posições alternativas de cada função
  var ALT_CAND = { GOL: [], ZAG: ["VOL", "LD", "LE"], LD: ["MD", "ZAG"], LE: ["ME", "ZAG"], VOL: ["MC", "ZAG"], MC: ["VOL", "MEI"],
                   MEI: ["MC", "SA"], MD: ["PD", "LD", "MC"], ME: ["PE", "LE", "MC"], PD: ["MD", "PE", "SA"], PE: ["ME", "PD", "SA"],
                   CA: ["SA"], SA: ["CA", "MEI"] };
  function principal(p) { var r = p && p.pos2; if (!r || !SECTOR[r]) r = (ROLES_SETOR[p && p.pos] || ["MC"])[0]; return r; }
  // alternativas fixas por jogador (sorteadas pelo id): 20% nenhuma, 50% uma, 30% duas
  var _alt = {};
  function altsDe(p) {
    if (!p) return [];
    if (_alt[p.id]) return _alt[p.id];
    var prim = principal(p), h = hashStr("alt" + p.id), k = h % 10 < 2 ? 0 : h % 10 < 7 ? 1 : 2;
    var cand = (ALT_CAND[prim] || []).slice().sort(function (a, b) { return (hashStr(p.id + a) % 97) - (hashStr(p.id + b) % 97); });
    _alt[p.id] = cand.slice(0, Math.min(k, cand.length));
    return _alt[p.id];
  }
  try { TM.storage.onEditionChange(function () { _alt = {}; }); } catch (e) {}
  function posicoesDe(p, card) {
    var out = [principal(p)];
    altsDe(p).concat((card && card.posx) || []).forEach(function (r) { if (SECTOR[r] && out.indexOf(r) < 0) out.push(r); });
    return out;
  }
  function emPosicao(d, role) { return !!d && (d.posicoes || [d.pos2]).indexOf(role) >= 0; }
  // quanto a carta se encaixa na casa (para montar o time sozinho): 1 = na posição
  function posFit(d, role) {
    if (!d) return 0;
    if (emPosicao(d, role)) return 1;
    var sec = SECTOR[role] || role;
    if (d.pos === sec) return 0.6;
    if ((NEAR[d.pos] || []).indexOf(sec) >= 0) return 0.3;
    return 0.05;
  }
  // quem está sem contrato não pode entrar em campo
  function podeJogar(c) { return !!c && temContrato(c); }

  // química de 11 cartas numa formação (serve para o time, DME e Draft)
  function chemDe(ds, F0) {
    var emPos = ds.map(function (d, i) { return !!d && !!F0[i] && emPosicao(d, slotRole(F0[i])); });
    var nClub = {}, nLg = {}, nNat = {}, icones = 0;
    ds.forEach(function (d, i) {
      if (!d || !emPos[i]) return;
      var ic = d.ver === "icone", he = d.ver === "heroi";
      if (ic) icones++;
      if (d.club && !ic) nClub[d.club.id] = (nClub[d.club.id] || 0) + 1;
      if (d.lg && !ic) nLg[d.lg] = (nLg[d.lg] || 0) + (he ? 2 : 1);
      if (d.nat) nNat[d.nat] = (nNat[d.nat] || 0) + (ic ? 2 : 1);
    });
    if (icones) Object.keys(nLg).forEach(function (k) { nLg[k] += icones; });   // Ícone soma 1 em cada liga
    var per = ds.map(function (d, i) {
      if (!d || !emPos[i]) return 0;
      if (d.ver === "icone" || d.ver === "heroi") return 3;
      var pt = 0;
      if (d.club) pt += ptsPor(nClub[d.club.id] || 0, LIM.club);
      if (d.lg) pt += ptsPor(nLg[d.lg] || 0, LIM.lg);
      if (d.nat) pt += ptsPor(nNat[d.nat] || 0, LIM.nat);
      return Math.min(3, pt);
    });
    var team = per.reduce(function (a, b) { return a + b; }, 0);
    return { per: per, team: team, max: 33, ds: ds, emPos: emPos, nClub: nClub, nLg: nLg, nNat: nNat };
  }
  function chemistry(s) {
    var F0 = TM.comp.FORMATIONS[s.squad.f] || TM.comp.FORMATIONS["4-3-3"];
    var byId = cardMap(s);
    return chemDe(s.squad.xi.map(function (cid) { return cid && byId[cid] ? cardData(byId[cid]) : null; }), F0);
  }
  // embalo em campo pela química do jogador (0..3): sem química rende menos
  var CHEM_OV = [-2, 0, 1, 2];
  function effOv(ov, chem) { return clamp(ov + CHEM_OV[clamp(Math.round(chem || 0), 0, 3)], 1, 99); }
  /* Nota da equipe do jeito do Ultimate: média dos 11 mais a "correção" de quem
     está acima da média (um craque puxa o time mais do que a média simples diz). */
  function notaEquipe(ovs) {
    var v = ovs.filter(function (x) { return x > 0; });
    if (!v.length) return 0;
    var S = 0; ovs.forEach(function (x) { S += x || 0; });
    var med = S / 11, E = 0;
    ovs.forEach(function (x) { if (x > med) E += x - med; });
    return Math.floor(Math.round(S + E) / 11);
  }
  function squadRating(s) {
    var c = chemistry(s);
    var vals = c.ds.map(function (d) { return d ? d.ov : 0; });
    if (!vals.filter(Boolean).length) return { ov: 0, chem: 0 };
    return { ov: notaEquipe(vals), chem: c.team };
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
  function addCard(s, card) { s.cards.push(card); resolveRepetido(s, card); return card; }

  /* ---------- repetidos: o clube fica com a melhor carta de cada jogador ----------
     Pedido do dono: o mesmo jogador duas vezes no clube vira venda rápida sozinho.
     A carta pior sai em venda rápida automática (empréstimo repetido só é dispensado,
     e empréstimo nunca derruba carta própria). Carta à venda no mercado não conta:
     ela já está de saída. Quem sai cede o lugar no time para quem fica. */
  function ovCarta(c) { var d = cardData(c); return d ? d.ov : 0; }
  function resolveRepetido(s, novo) {
    var listadas = {};
    ((s.mkt && s.mkt.sell) || []).forEach(function (L) { if (L && L.card) listadas[L.card.i] = 1; });
    if (listadas[novo.i]) return null;
    var velho = (s.cards || []).filter(function (c) { return c !== novo && c.p === novo.p && !listadas[c.i]; })[0];
    if (!velho) return null;
    var fica, sai;
    if (ehEmprestimo(novo) !== ehEmprestimo(velho)) { fica = ehEmprestimo(novo) ? velho : novo; }
    else fica = ovCarta(novo) > ovCarta(velho) ? novo : velho;
    sai = fica === novo ? velho : novo;
    var ganho = ehEmprestimo(sai) ? 0 : quickSell(ovCarta(sai), sai.v);
    var noTime = s.squad.xi.indexOf(fica.i) >= 0 || (s.squad.sub || []).indexOf(fica.i) >= 0;
    function lugar(cid) { if (cid !== sai.i) return cid; if (noTime) return null; noTime = true; return fica.i; }
    s.squad.xi = s.squad.xi.map(lugar);
    s.squad.sub = (s.squad.sub || []).map(lugar).filter(Boolean);
    removeCard(s, sai.i);
    if (ganho) earn(s, ganho, "Venda rápida automática (repetido)");
    sai.rep = ganho;                                   // a tela do pacote mostra o aviso
    if (fica === novo) fica.repTroca = ganho;          // a nova é melhor: a antiga saiu
    s.stats.repetidos = (s.stats.repetidos || 0) + 1;
    return { sai: sai, fica: fica, ganho: ganho };
  }
  // repetidos que já estavam no clube (antes da regra): limpa uma vez ao entrar
  function limpaRepetidos(s) {
    var n = 0, total = 0;
    (s.cards || []).slice().forEach(function (c) {
      if (s.cards.indexOf(c) < 0) return;
      var r = resolveRepetido(s, c);
      if (r) { n++; total += r.ganho; delete r.fica.repTroca; }
    });
    if (n) save();
    return n ? { n: n, ganho: total } : null;
  }
  function removeCard(s, cid) {
    s.cards = s.cards.filter(function (c) { return c.i !== cid; });
    s.squad.xi = s.squad.xi.map(function (c) { return c === cid ? null : c; });
    s.squad.sub = (s.squad.sub || []).filter(function (c) { return c !== cid; });
  }
  // faltou moeda: avisa quanto falta e leva direto para a compra (pedido do dono)
  function faltaMoedas(s, precisa) {
    TM.ui.toast("Moedas insuficientes: faltam " + fmtC(Math.max(0, precisa - (s.coins || 0))) + ".", "erro");
    goUT("ut-store", { secao: "moedas" });
  }
  function faltaTC(precisa) {
    var tem = 0; try { tem = TM.coins.balance(); } catch (e) {}
    TM.ui.toast("Total Coins insuficientes: faltam " + Math.max(0, precisa - tem) + ".", "erro");
    TM.ui.go("coins");
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
  /* Probabilidades publicadas: simula 600 aberturas do pacote e conta a chance de
     vir PELO MENOS uma carta de cada faixa (como as odds que o Ultimate mostra). */
  var _odds = {};
  function oddsDe(pk) {
    if (_odds[pk.id]) return _odds[pk.id];
    var N = pk.n >= 20 ? 320 : 500, rnd = mulberry(hashStr("odds" + pk.id)), faixas = [
      { k: "75+", f: function (o) { return o.ov >= 75; } }, { k: "80+", f: function (o) { return o.ov >= 80; } },
      { k: "83+", f: function (o) { return o.ov >= 83; } }, { k: "85+ (Lenda)", f: function (o) { return o.ov >= 85; } },
      { k: "88+", f: function (o) { return o.ov >= 88; } },
      { k: "Versão especial", f: function (o) { return o.ver !== "base" && o.ver !== "rare"; } },
      { k: "Ícone", f: function (o) { return o.ver === "icone"; } }
    ], cont = faixas.map(function () { return 0; }), media = 0;
    for (var i = 0; i < N; i++) {
      var itens = sorteiaPacote(pk, rnd).map(function (o) { return { ov: clamp(o.p.overall + verBonus(o.ver), 1, 99), ver: o.ver }; });
      media += itens.reduce(function (a, o) { return Math.max(a, o.ov); }, 0);
      faixas.forEach(function (fx, j) { if (itens.some(fx.f)) cont[j]++; });
    }
    _odds[pk.id] = { faixas: faixas.map(function (fx, j) { return { k: fx.k, p: cont[j] / N }; }), melhorMedia: Math.round(media / N) };
    return _odds[pk.id];
  }
  try { TM.storage.onEditionChange(function () { _odds = {}; }); } catch (e) {}
  function pctTxt(p) { return p >= 0.995 ? "100%" : p < 0.001 ? "<0,1%" : p < 0.1 ? (Math.round(p * 1000) / 10).toString().replace(".", ",") + "%" : Math.round(p * 100) + "%"; }
  function mostraOdds(pk) {
    var o = oddsDe(pk), ov = el("div", { class: "ut-sheet" });
    ov.appendChild(el("div", { class: "ut-sheet-in" }, [
      el("div", { class: "ut-sheet-h" }, [el("span", { text: "Probabilidades · " + pk.name }), el("button", { class: "ut-x", text: "✕", on: { click: fecha } })]),
      el("div", { class: "ut-note", text: "Chance de vir pelo menos uma carta de cada faixa neste pacote (" + pk.n + " itens). Calculado abrindo " + (pk.n >= 20 ? 320 : 500) + " pacotes de teste com o mesmo sorteio da loja." }),
      el("div", { class: "utp-odds" }, o.faixas.map(function (f) {
        return el("div", { class: "utp-odd" }, [el("span", { text: f.k }), el("div", { class: "utm-bar" }, [el("i", { style: "width:" + Math.max(1.5, f.p * 100) + "%" })]), el("b", { text: pctTxt(f.p) })]);
      })),
      el("div", { class: "ut-note", text: "Melhor carta, em média: " + o.melhorMedia + " de nota." })
    ]));
    ov.addEventListener("click", function (e) { if (e.target === ov) fecha(); });
    document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add("show"); });
    function fecha() { ov.classList.remove("show"); setTimeout(function () { ov.remove(); }, 200); }
  }
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
  // sorteia o conteúdo de um pacote sem mexer no clube: [{ p, ver }]
  function sorteiaPacote(pk, rnd) {
    var out = [], n = pk.n;
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
    return out;
  }
  function openPack(s, pk) {
    var rnd = Math.random, out = sorteiaPacote(pk, rnd);
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
    emit("pacote", { s: s, pk: pk, cards: cards });
    return { cards: cards, itens: itens };
  }


  /* ================= contrato, forma, empréstimo e consumíveis =================
     A carta não é eterna: ela tem CONTRATO em número de jogos e FORMA FÍSICA.
     Acabou o contrato, o jogador não pode ser escalado até você aplicar um item.
     Jogador de EMPRÉSTIMO vem por X jogos, não pode ser vendido e vai embora
     quando acaba. Os itens saem dos pacotes, como no Ultimate Team. */
  var CT_INICIAL = { base: 7, rare: 10 };     // especiais vêm com 12
  var FIT_CHEIA = 100, FIT_JOGO = 9, FIT_DESCANSO = 6, FIT_ALERTA = 60;

  /* Estilos de química: mexem nos atributos conforme a química do jogador
     (inteiro com 3, nada com 0). Sem estilo aplicado vale o Básico. GOL usa os
     mesmos campos (VEL, CHU, MAN, POS, ELA, REF). */
  var BASICO = { pac: 2, sho: 2, pas: 2, dri: 2, def: 2, phy: 2 };
  var ESTILOS = [
    { id: "cacador",   n: "Caçador",       ic: "zap",            b: { pac: 5, sho: 4 },          setor: "FW" },
    { id: "artilheiro",n: "Artilheiro",    ic: "flame",          b: { sho: 6, phy: 3 },          setor: "FW" },
    { id: "sniper",    n: "Sniper",        ic: "target",         b: { sho: 4, dri: 4 },          setor: "FW" },
    { id: "falcao",    n: "Falcão",        ic: "eye",            b: { pac: 3, sho: 3, phy: 3 },  setor: "FW" },
    { id: "artista",   n: "Artista",       ic: "brush",          b: { pas: 4, dri: 5 },          setor: "MF" },
    { id: "maestro",   n: "Maestro",       ic: "music",          b: { pas: 5, dri: 3, sho: 1 },  setor: "MF" },
    { id: "motor",     n: "Motor",         ic: "settings",       b: { pac: 3, pas: 3, dri: 3 },  setor: "MF" },
    { id: "arquiteto", n: "Arquiteto",     ic: "ruler",          b: { pas: 5, phy: 4 },          setor: "MF" },
    { id: "catalisador",n: "Catalisador",  ic: "sparkles",       b: { pac: 4, pas: 5 },          setor: "MF" },
    { id: "sombra",    n: "Sombra",        ic: "moon",           b: { pac: 4, def: 5 },          setor: "DF" },
    { id: "ancora",    n: "Âncora",        ic: "anchor",         b: { pac: 3, def: 3, phy: 3 },  setor: "DF" },
    { id: "sentinela", n: "Sentinela",     ic: "shield",         b: { def: 5, phy: 4 },          setor: "DF" },
    { id: "muralha",   n: "Muralha",       ic: "brick-wall",     b: { def: 6, phy: 2 },          setor: "DF" },
    { id: "titan",     n: "Titã",          ic: "biceps-flexed",  b: { phy: 6, def: 3 },          setor: "DF" },
    { id: "luvas",     n: "Luvas de Ouro", ic: "tm-luva",        b: { def: 4, dri: 3, phy: 2 },  setor: "GK" },
    { id: "felino",    n: "Felino",        ic: "hand",           b: { phy: 6, pac: 3 },          setor: "GK" }
  ];
  var SETOR_NOME = { GK: "gol", DF: "defesa", MF: "meio-campo", FW: "ataque" };
  function estiloPor(id) { for (var i = 0; i < ESTILOS.length; i++) if (ESTILOS[i].id === id) return ESTILOS[i]; return null; }

  var _itemSeq = 0;
  function novoItem(o) { o.i = "it" + (Date.now() % 1e7) + "_" + (_itemSeq++); return o; }
  function addItem(s, it) { s.itens = s.itens || []; s.itens.push(it); return it; }
  function removeItem(s, iid) { s.itens = (s.itens || []).filter(function (x) { return x.i !== iid; }); }
  function itemNome(it) {
    if (it.t === "contrato") return "Contrato +" + it.n + " jogos";
    if (it.t === "forma") return "Recuperação física";
    if (it.t === "quimica") { var e = estiloPor(it.e); return "Estilo: " + (e ? e.n : it.e); }
    if (it.t === "posicao") return "Nova posição: " + (SETOR_NOME[it.p] || it.p);
    return "Item";
  }
  // ícone (traço, sem emoji) de cada consumível
  function itemIcone(it) {
    var nm = it.t === "contrato" ? "file-text" : it.t === "forma" ? "heart" : it.t === "posicao" ? "shuffle"
      : it.t === "quimica" ? ((estiloPor(it.e) || {}).ic || "flask-conical") : "package";
    return TM.ic(nm);
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
      // o item antigo de posição gravava só o setor e não mudava nada em campo:
      // devolve o item para o jogador aplicar do jeito novo (escolhendo a função)
      if (c.pos2 && ROLES_SETOR[c.pos2]) { s.itens = s.itens || []; s.itens.push(novoItem({ t: "posicao", p: c.pos2 })); delete c.pos2; mudou = true; }
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

  /* ================= mercado =================
     O Mercado de Transferências (leilão, compre já, observação, lista de
     transferências e itens ganhos) mora em js/ut-mercado.js. */

  /* ================= DME =================
     Os Desafios de Montagem de Elenco moram em js/ut-dme.js (categorias,
     melhorias repetíveis, DME de jogador e o "montar com as mais baratas"). */

  /* ================= objetivos =================
     Os objetivos (diários, semanais, da temporada e Fundamentos) e o passe da
     temporada moram em js/ut-temporada.js e contam pelos eventos (partida,
     pacote, venda, compra, dme, item...). objBump ficou só por compatibilidade. */
  function objRefresh() {}
  function objBump() {}

  /* ================= Rivais (divisões) ================= */
  var DIVS = [
    { d: 10, need: 12, ov: 58, win: 1300 }, { d: 9, need: 15, ov: 62, win: 1900 },
    { d: 8, need: 18, ov: 66, win: 2700 }, { d: 7, need: 21, ov: 70, win: 3700 },
    { d: 6, need: 24, ov: 73, win: 5000 }, { d: 5, need: 27, ov: 76, win: 6700 },
    { d: 4, need: 30, ov: 79, win: 9000 }, { d: 3, need: 33, ov: 82, win: 12000 },
    { d: 2, need: 36, ov: 85, win: 16000 }, { d: 1, need: 999, ov: 88, win: 24000 }
  ];
  function divInfo(d) { for (var i = 0; i < DIVS.length; i++) if (DIVS[i].d === d) return DIVS[i]; return DIVS[0]; }
  /* ================= a carta (visual) ================= */
  var ST_LABEL = { pac: "RIT", sho: "FIN", pas: "PAS", dri: "DRI", def: "DEF", phy: "FÍS" };
  var GK_LABEL = { pac: "VEL", sho: "CHU", pas: "MAN", dri: "POS", def: "ELA", phy: "REF" };
  var ORDER = ["pac", "sho", "pas", "dri", "def", "phy"];
  // chem = química do jogador (0..3). O estilo rende proporcional à química, igual
  // ao Ultimate Team: com 0 não vale nada, com 3 vale inteiro. Sem estilo aplicado
  // vale o Básico (um pouco em tudo). Sem chem (fora de campo) mostra o atributo puro.
  function statsOf(d, chem) {
    var a = d.attrs || {}, isGk = d.pos === "GK";
    var bump = verBonus(d.ver), evo = d.evo || {};
    var est = d.card && d.card.sty ? estiloPor(d.card.sty) : null;
    var forca = chem == null ? 0 : clamp(chem / 3, 0, 1);
    var pen = penFisica(d.card ? d.card.fit : null);
    return ORDER.map(function (k) {
      var b = est ? (est.b[k] || 0) : BASICO[k];
      var ganho = Math.round(b * forca);
      return { k: k, l: (isGk ? GK_LABEL : ST_LABEL)[k], v: clamp(Math.round((a[k] || 50) + bump + (evo[k] || 0) + ganho - pen), 1, 99), ganho: ganho, pen: pen };
    });
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function silhueta() {
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 120"); svg.setAttribute("class", "utc-sil"); svg.setAttribute("aria-hidden", "true");
    [["ellipse", { cx: 50, cy: 43, rx: 18.5, ry: 22.5 }], ["path", { d: "M6 120C8 93 27 81 50 81S92 93 94 120Z" }]].forEach(function (f) {
      var n = document.createElementNS(SVGNS, f[0]);
      Object.keys(f[1]).forEach(function (k) { n.setAttribute(k, f[1][k]); });
      n.setAttribute("fill", "currentColor"); svg.appendChild(n);
    });
    return svg;
  }
  // A CARTA do Total Match: moldura chanfrada e brilho na cor da raridade (bronze,
  // prata, ouro e, no topo, verde; as versões especiais têm cor própria), nota grande,
  // faixa com bandeira e escudo, foto que se funde no fundo de triângulos, nome,
  // barra de força (pela nota) e a assinatura TOTAL MATCH no rodapé.
  function cardEl(d, opts) {
    opts = opts || {};
    if (!d) {
      return el("div", { class: "ut-card empty" + (opts.cls ? " " + opts.cls : "") }, [
        el("div", { class: "utc-plus", text: "+" }),
        opts.role ? el("div", { class: "utc-slot", text: opts.role }) : null
      ]);
    }
    function seguro(fn) { try { return fn(); } catch (e) { return el("span"); } }
    var VI = verInfo(d.ver), esp = !!VI.sel;
    var temFoto = false; try { temFoto = !TM.img.playerPhotoUrl || !!TM.img.playerPhotoUrl(d.p); } catch (e) {}
    var forca = Math.max(0.12, Math.min(1, (d.ov - 45) / 50));
    var miolo = el("div", { class: "utc-miolo" }, [
      el("span", { class: "utc-tri" }),
      el("span", { class: "utc-luz" }),
      // sem foto real: silhueta na cor da carta (em vez do avatar de iniciais)
      el("div", { class: "utc-face-wrap" }, [ temFoto ? seguro(function () { return TM.img.playerImg(d.p, "utc-face"); }) : silhueta() ]),
      el("span", { class: "utc-tm" }),
      el("div", { class: "utc-l" }, [
        el("div", { class: "utc-ov", text: d.ov }),
        el("div", { class: "utc-pos", text: (d.pos2 || d.pos) }),
        el("div", { class: "utc-fita" }, [
          seguro(function () { return TM.img.flagImg(TM.data.nation(d.nat), "utc-flag"); }),
          d.club ? seguro(function () { return TM.img.clubImg(d.club, "utc-crest"); }) : null
        ])
      ]),
      el("div", { class: "utc-name", text: shortNm(d.name).toUpperCase() }),
      el("div", { class: "utc-barra" }, [ el("i", { style: "width:" + Math.round(forca * 100) + "%" }) ]),
      el("div", { class: "utc-stats" }, statsOf(d).map(function (s) {
        return el("span", { class: "utc-st" }, [el("b", { text: s.v }), el("i", { text: s.l })]);
      })),
      // rodapé: a assinatura do jogo, ou o selo da versão especial (o preço, no mercado)
      opts.price != null ? null : el("div", { class: "utc-tier" + (esp ? " esp" : ""), text: esp ? VI.sel : "Total Match" })
    ]);
    var kids = [ el("div", { class: "utc-moldura" }, [ miolo ]) ];
    // química do jogador (0..3) em losangos, como no Ultimate
    if (opts.chem != null) {
      var nq = clamp(opts.chem | 0, 0, 3);
      kids.push(el("div", { class: "utc-chem c" + nq, title: "Química " + nq + " de 3" }, [0, 1, 2].map(function (k) { return el("i", { class: k < nq ? "on" : "" }); })));
    }
    if (d.evo) kids.push(el("div", { class: "utc-evo", title: "Evoluída" }, [TM.ic("dna")]));
    if (opts.price != null) kids.push(el("div", { class: "utc-price" }, [coinsEl(opts.price)]));
    var cls = "ut-card r-" + d.rar + " v-" + d.ver + (esp ? " especial" : "") + (opts.cls ? " " + opts.cls : "");
    var node = el("div", { class: cls, title: d.name + " · " + d.ov + " · " + (esp ? VI.n : RAR_NAME[d.rar] + " (" + RAR_COR[d.rar] + ")") }, kids);
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
    migraCartas(s);
    var lim = limpaRepetidos(s);
    if (lim) TM.ui.toast(lim.n + (lim.n > 1 ? " cartas repetidas viraram" : " carta repetida virou") + " venda rápida: +" + fmtC(lim.ganho) + " moedas.", "ok");
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
    // liga do elenco inicial: os 11 titulares vêm dela, encaixados na formação (química cheia)
    var ligaEsc = LIGAS_INICIAIS[Math.floor(Math.random() * 3)][0];
    var ligas = el("div", { class: "ut-chips ut-ligas-ini" });
    function pintaLigas() {
      TM.ui.clear(ligas);
      LIGAS_INICIAIS.forEach(function (L) {
        ligas.appendChild(el("button", { class: "ut-chip" + (ligaEsc === L[0] ? " on" : ""), text: L[1], on: { click: function () { ligaEsc = L[0]; pintaLigas(); } } }));
      });
    }
    pintaLigas();
    screen.appendChild(el("div", { class: "ut-intro" }, [
      el("img", { class: "ut-intro-logo", src: "assets/logo.png", alt: "" }),
      el("h1", { class: "ut-intro-title", text: "TOTAL ULTIMATE" }),
      el("p", { class: "ut-intro-tx", text: "Abra pacotes, monte seu elenco dos sonhos com química, negocie no mercado, suba da Divisão 10 até a 1 e dispute Batalhas, Champions e Draft." }),
      el("div", { class: "ut-intro-feats" }, [["package", "Pacotes"], ["link", "Química"], ["arrow-left-right", "Mercado"], ["puzzle", "DME"], ["trophy", "Rivais"],
         ["swords", "Batalhas"], ["crown", "Champions"], ["layers", "Draft"], ["dna", "Evoluções"], ["star", "Temporada"]].map(function (f) {
          return el("span", { class: "ut-feat" }, [TM.ic(f[0]), document.createTextNode(" " + f[1])]);
        })),
      input,
      el("div", { class: "ut-intro-l", text: "Liga do seu elenco inicial" }),
      ligas,
      TM.ui.button("Criar meu clube", function () {
        var nm = (input.value || "").trim() || "Meu Ultimate";
        S = blank(); S.club = nm;
        S.ed = TM.storage.edition();          // de qual edição são as cartas
        elencoInicial(S, ligaEsc);
        save();
        TM.ui.toast("Clube criado! Seu elenco inicial está pronto.", "ok");
        goUT("ut");
      }, "btn primary wide")
    ]));
  }

  /* ---------- elenco inicial ----------
     Como no Ultimate: você escolhe uma liga e recebe um time inteiro dela, cada um
     na sua posição (química alta desde o começo, nota baixa — a graça é subir). */
  var LIGAS_INICIAIS = [["br", "Brasileirão"], ["en", "Premier League"], ["es", "LaLiga"], ["it", "Serie A"],
                        ["de", "Bundesliga"], ["fr", "Ligue 1"], ["pt", "Liga Portugal"], ["ar", "Argentina"]];
  function elencoInicial(s, lg) {
    var F = TM.comp.FORMATIONS["4-3-3"], usados = {};
    var daLiga = pool().filter(function (p) { return leagueOf(p) === lg && p.overall >= 60 && p.overall <= 71; });
    if (daLiga.length < 30) daLiga = pool().filter(function (p) { return p.overall >= 60 && p.overall <= 71; });
    function pega(filtro) {
      var c = shuffle(daLiga.filter(function (p) { return !usados[p.id] && filtro(p); }));
      var p = c[0]; if (p) usados[p.id] = 1; return p;
    }
    function nova(p, ver) { var c = mkCard(p, ver); c.ut = 1; addCard(s, c); return c; }
    var xi = F.map(function (slot) {
      var role = slotRole(slot);
      var p = pega(function (q) { return posicoesDe(q).indexOf(role) >= 0; }) || pega(function (q) { return q.pos === slot[0]; });
      return p ? nova(p, Math.random() < 0.2 ? "rare" : "base").i : null;
    });
    var sub = [];
    // reservas: um goleiro e mais seis da mesma liga
    var g = pega(function (q) { return q.pos === "GK"; }); if (g) sub.push(nova(g, "base").i);
    for (var k = 0; k < 6; k++) { var q = pega(function () { return true; }); if (q) sub.push(nova(q, "base").i); }
    s.squad.f = "4-3-3"; s.squad.xi = xi; s.squad.sub = sub;
    s.ligaIni = lg;
  }

  /* ---------- hub ----------
     Como a tela inicial do Ultimate: cabeçalho do clube com a temporada, o que pede
     ação (prêmios, escolhas, vendas, contratos), destaques da semana, os modos de
     jogo com o progresso de cada um e o resto do clube agrupado. */
  function renderHub(screen, s) {
    screen.classList.add("ut-screen", "ut-hub");
    screen.appendChild(utTop(nomeExibido(s), function () { goUT("modes"); }, s));
    var r = squadRating(s), info = divInfo(s.riv.div);
    var pend = 0; try { pend = TM.utMercado && TM.utMercado.pendentes ? TM.utMercado.pendentes(s) : (s.mkt.sell || []).filter(function (L) { return L.sold; }).length; } catch (e) {}
    var itens = (s.itens || []).length;
    var empr = (s.cards || []).filter(function (c) { return c.ln != null; }).length;
    var semCt = (s.cards || []).filter(function (c) { return !temContrato(c); }).length;
    var ofer = emprestimoDoDia(s);
    var temEmpr = ofer && s.emprDia !== ofer.dia;
    var T = TM.utTemp, Mo = TM.utModos;
    var tp = T ? T.estado(s) : null, nv = tp ? T.nivelDe(tp.xp) : 0, tPend = T ? T.pendentes(s) : 0;

    /* ---- cabeçalho ---- */
    var cab = el("div", { class: "ut-hero" }, [
      el("div", { class: "ut-hero-bg" }),
      el("div", { class: "ut-hero-in" }, [
        escudoDe(s, "grande"),
        el("div", { class: "ut-hero-txt" }, [
          el("div", { class: "ut-hero-nm", text: nomeExibido(s) }),
          el("div", { class: "ut-hero-sub" }, [
            el("span", { class: "ut-sig", text: siglaDe(s) }),
            el("span", { text: "Divisão " + s.riv.div }),
            el("span", { text: s.cards.length + " cartas" })
          ]),
          el("div", { class: "ut-hero-rec", text: s.riv.w + "V · " + s.riv.d + "E · " + s.riv.l + "D nos Rivais" })
        ]),
        el("div", { class: "ut-hero-nums" }, [
          el("div", { class: "ut-hc-box" }, [el("b", { text: r.ov || "—" }), el("i", { text: "NOTA" })]),
          el("div", { class: "ut-hc-box chem" }, [el("b", { text: r.chem + "/33" }), el("i", { text: "QUÍMICA" })])
        ])
      ]),
      tp ? el("button", { class: "uth-temp", on: { click: function () { goUT("ut-temporada"); } } }, [
        el("span", { class: "uth-temp-ic" }, [TM.ic("star")]),
        el("span", { class: "uth-temp-t", text: T.tempNome(tp.id) + " · Nível " + nv }),
        el("span", { class: "uth-temp-bar" }, [el("i", { style: "width:" + (nv >= T.NIVEIS ? 100 : Math.round((tp.xp - nv * T.XP_NIVEL) / T.XP_NIVEL * 100)) + "%" })]),
        el("span", { class: "uth-temp-d", text: tPend ? tPend + " prêmio" + (tPend > 1 ? "s" : "") + "!" : T.diasRestantes() + " dias" })
      ]) : null
    ]);
    screen.appendChild(cab);

    /* ---- o que pede ação ---- */
    var avisos = [];
    if (tPend) avisos.push({ ic: "gift", tx: tPend + (tPend > 1 ? " prêmios da temporada para resgatar" : " prêmio da temporada para resgatar"), r: "ut-temporada", cls: "bom" });
    if (s.picks && s.picks.length) avisos.push({ ic: "user-search", tx: s.picks.length + (s.picks.length > 1 ? " escolhas de jogador esperando" : " escolha de jogador esperando"), r: "ut-store", cls: "bom" });
    if (s.batAntiga) avisos.push({ ic: "swords", tx: "Recompensa das Batalhas da semana passada", r: "ut-batalhas", cls: "bom" });
    if (s.champAntiga || (s.champ && s.champ.fase === "fim" && !s.champ.pago)) avisos.push({ ic: "crown", tx: "Recompensa da Champions para resgatar", r: "ut-champions", cls: "bom" });
    if (Mo) { var sem = Mo.rivSemana(s), marcosOk = [2, 4, 7].filter(function (m) { return sem.v >= m && !sem.ok[m]; }).length; if (marcosOk) avisos.push({ ic: "trophy", tx: "Recompensa semanal dos Rivais liberada", r: "ut-rivals", cls: "bom" }); }
    if (semCt) avisos.push({ ic: "file-text", tx: semCt + (semCt > 1 ? " cartas sem contrato" : " carta sem contrato"), r: "ut-club", cls: "alerta" });
    if (pend) avisos.push({ ic: "tm-moeda", tx: (TM.utMercado && TM.utMercado.resumo ? TM.utMercado.resumo(s).texto : pend + " pendência(s) no mercado"), r: "ut-market", cls: "bom" });
    if (s.packs && s.packs.length) avisos.push({ ic: "package", tx: s.packs.length + (s.packs.length > 1 ? " pacotes guardados" : " pacote guardado"), r: "ut-store", cls: "bom" });
    if (temEmpr) avisos.push({ ic: "handshake", tx: "Empréstimo do dia disponível", r: "ut-store", cls: "" });
    if (avisos.length) {
      screen.appendChild(el("div", { class: "ut-avisos" }, avisos.slice(0, 5).map(function (a) {
        return el("button", { class: "ut-aviso " + a.cls, on: { click: function () { goUT(a.r); } } }, [
          el("span", { class: "ut-av-ic" }, [TM.ic(a.ic)]), el("span", { text: a.tx }), el("span", { class: "ut-av-go" }, [TM.ic("chevron-right")])
        ]);
      })));
    }

    /* ---- destaques da semana ---- */
    var dest = [];
    try {
      var jog = TM.utDme && TM.utDme.catalogo()[2].lista[0];
      if (jog) {
        var pj = TM.data.player(jog.destaque.p);
        var dj = pj && cardData({ i: "hubj", p: pj.id, v: jog.destaque.v, r: rarOf(pj.overall + verBonus(jog.destaque.v)) });
        if (dj) dest.push(el("button", { class: "uth-dest jog", on: { click: function () { goUT("ut-sbc", { aba: "jog" }); } } }, [
          cardEl(dj, { cls: "mini" }),
          el("div", { class: "uth-dest-i" }, [el("div", { class: "uth-dest-k", text: "DME DE JOGADOR" }), el("div", { class: "uth-dest-t", text: shortNm(pj.name) + " · " + verInfo(jog.destaque.v).n }), el("div", { class: "uth-dest-s", text: "Monte elenco e leve a carta" })])
        ]));
      }
    } catch (e) {}
    try {
      var tw = (totwSet().__list || []).map(function (pid) { var p = TM.data.player(pid); return p ? cardData({ i: "hubt" + pid, p: pid, v: "totw", r: rarOf(p.overall + 2) }) : null; })
        .filter(Boolean).sort(function (a, b) { return b.ov - a.ov; }).slice(0, 3);
      if (tw.length) dest.push(el("button", { class: "uth-dest totw", on: { click: function () { goUT("ut-store"); } } }, [
        el("div", { class: "uth-dest-cartas" }, tw.map(function (d) { return cardEl(d, { cls: "mini" }); })),
        el("div", { class: "uth-dest-i" }, [el("div", { class: "uth-dest-k", text: "SELEÇÃO DA SEMANA" }), el("div", { class: "uth-dest-t", text: "+2 de nota, nos pacotes" }), el("div", { class: "uth-dest-s", text: "Troca toda semana" })])
      ]));
    } catch (e) {}
    if (dest.length) {
      screen.appendChild(el("div", { class: "ut-grupo-t", text: "Em destaque" }));
      screen.appendChild(el("div", { class: "uth-dests" }, dest));
    }

    /* ---- jogar ---- */
    function modo(icone, nome, linha, prog, rota, cor) {
      return el("button", { class: "uth-modo a-" + cor, on: { click: function () { goUT(rota); } } }, [
        el("span", { class: "uth-modo-ic" }, [TM.ic(icone)]),
        el("span", { class: "uth-modo-n", text: nome }),
        el("span", { class: "uth-modo-l", text: linha }),
        prog != null ? el("span", { class: "uth-modo-bar" }, [el("i", { style: "width:" + Math.max(3, Math.min(100, prog)) + "%" })]) : null
      ]);
    }
    var semR = Mo ? Mo.rivSemana(s) : { v: 0 }, prox = [2, 4, 7].filter(function (m) { return m > semR.v; })[0];
    var bat = Mo ? Mo.batEstado(s) : null, rk = bat && Mo.rankDe(bat.pts);
    var ch = Mo ? Mo.chEstado(s) : null;
    var chTx = !ch ? "" : ch.fase === "qual" ? "Classificação: " + Math.min(4, semR.v) + "/4 vitórias nos Rivais"
      : ch.fase === "elim" ? "Eliminatórias: " + ch.ev + " vitórias" : ch.fase === "finais" ? "Finais: " + ch.fv + " vitórias em " + ch.fj.length
      : ch.fase === "fim" ? "Finais encerradas: " + ch.fv + " vitórias" : "Volta na semana que vem";
    screen.appendChild(el("div", { class: "ut-grupo-t", text: "Jogar" }));
    screen.appendChild(el("div", { class: "uth-modos" }, [
      modo("trophy", "Rivais", "Divisão " + s.riv.div + " · " + semR.v + " vitória" + (semR.v === 1 ? "" : "s") + " na semana", info.need === 999 ? 100 : s.riv.pts / info.need * 100, "ut-rivals", "riv"),
      modo("swords", "Batalhas de Elenco", rk ? rk.n + " · " + bat.pts + " pts" : "Contra elencos da CPU", bat ? Math.min(100, bat.pts / 44) : null, "ut-batalhas", "bat"),
      modo("crown", "Champions", chTx, ch ? (ch.fase === "qual" ? semR.v / 4 * 100 : ch.fase === "elim" ? ch.ev / 3 * 100 : ch.fj.length * 10) : null, "ut-champions", "ch"),
      modo("layers", "Draft", TM.utDraft && TM.utDraft.resumo ? TM.utDraft.resumo(s).sub : "Monte e vença 4 seguidas", null, "ut-draft", "dr")
    ]));
    screen.appendChild(el("div", { class: "ut-tiles" }, [
      tile("globe", "Online", "Enfrente elencos de outros jogadores", "ut-online", null, "onl"),
      tile("dna", "Evoluções", TM.utEvo && TM.utEvo.ativas ? (TM.utEvo.ativas(s).length ? TM.utEvo.ativas(s).length + " em andamento" : "Melhore suas cartas jogando") : "Melhore suas cartas jogando", "ut-evolucoes", null, "evo")
    ]));

    /* ---- progresso ---- */
    var gs = T ? T.grupos(s) : [];
    function falta(id) { var g = gs.filter(function (x) { return x.id === id; })[0]; return g ? g.lista.filter(function (o) { return !g.ok[o.id]; }).length : 0; }
    var dmeAb = TM.utDme && TM.utDme.abertos ? TM.utDme.abertos(s) : 0;
    screen.appendChild(el("div", { class: "ut-grupo-t", text: "Progresso" }));
    screen.appendChild(el("div", { class: "ut-tiles" }, [
      tile("star", "Temporada", tp ? "Nível " + nv + " de " + T.NIVEIS : "Caminho de recompensas", "ut-temporada", tPend ? String(tPend) : null, "tmp"),
      tile("target", "Objetivos", T ? falta("d") + " diários · " + falta("s") + " semanais" : "Diários e semanais", "ut-obj", T && falta("d") ? String(falta("d")) : null, "obj"),
      tile("puzzle", "DME", "Melhorias, jogadores e ligas", "ut-sbc", dmeAb ? String(dmeAb) : null, "dme"),
      tile("chart-column", "Estatísticas", "Sua caminhada no Ultimate", "ut-stats", null, "est")
    ]));
    screen.appendChild(el("div", { class: "ut-grupo-t", text: "Clube" }));
    screen.appendChild(el("div", { class: "ut-tiles" }, [
      tile("tm-bola", "Escalação", "Time, química e formação", "ut-squad", null, "esc"),
      tile("users", "Meu Clube", s.cards.length + " cartas" + (empr ? " · " + empr + " emprestada" + (empr > 1 ? "s" : "") : ""), "ut-club", semCt ? String(semCt) : null, "clb"),
      tile("flask-conical", "Itens", itens ? itens + " consumíveis" : "Contratos, forma e estilos", "ut-itens", itens ? String(itens) : null, "itn"),
      tile("shield", "Identidade", "Nome, sigla e escudo", "ut-identidade", null, "idt")
    ]));
    screen.appendChild(el("div", { class: "ut-grupo-t", text: "Mercado" }));
    screen.appendChild(el("div", { class: "ut-tiles" }, [
      tile("package", "Loja", "Pacotes, escolhas e empréstimo", "ut-store", (s.packs && s.packs.length) || (s.picks && s.picks.length) ? String((s.packs || []).length + (s.picks || []).length) : (temEmpr ? "!" : null), "loj"),
      tile("arrow-left-right", "Mercado", "Leilão, compre já e observação", "ut-market", pend ? String(pend) : null, "mkt")
    ]));

    screen.appendChild(el("div", { class: "ut-foot" }, [
      TM.ui.button("Reiniciar clube", function () {
        TM.ui.confirm("Recomeçar?", "Seu clube, cartas e moedas serão apagados. Não dá para desfazer.", "Apagar tudo", function () {
          reset(); goUT("ut");
        }, true);
      }, "btn ghost small")
    ]));

    function tile(icone, name, sub, route, badge, acc) {
      return el("button", { class: "ut-tile" + (acc ? " a-" + acc : ""), on: { click: function () { goUT(route); } } }, [
        el("span", { class: "ut-t-ic" }, [TM.ic(icone)]),
        el("span", { class: "ut-t-nm", text: name }),
        el("span", { class: "ut-t-sub", text: sub }),
        badge ? el("span", { class: "ut-t-badge", text: badge }) : null
      ]);
    }
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
    // modos novos: temporada, batalhas, champions, draft e DME
    var T = TM.utTemp, Mo = TM.utModos, tp = T ? T.estado(s) : null, bat = Mo ? Mo.batEstado(s) : null, rk = bat && Mo.rankDe(bat.pts);
    var dmes = Object.keys(s.sbc || {}).length + Object.keys(s.sbcRep || {}).reduce(function (a, k) { var r = s.sbcRep[k]; return a + (r && r.n ? r.n : 1); }, 0);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Modos" }));
    body.appendChild(el("div", { class: "ut-statbox" }, [
      linha("Partidas (todos os modos)", s.stats.jogos || 0),
      tp ? linha(T.tempNome(tp.id), "Nível " + T.nivelDe(tp.xp) + " · " + fmtC(tp.xp) + " XP") : null,
      bat ? linha("Batalhas na semana", fmtC(bat.pts) + " pts" + (rk ? " · " + rk.n : "")) : null,
      s.champ ? linha("Champions na semana", s.champ.fase === "qual" ? "classificação" : s.champ.fase === "elim" ? "eliminatórias (" + s.champ.ev + "V)" : (s.champ.fv || 0) + " vitórias nas finais") : null,
      s.draftRec ? linha("Draft", (s.draftRec.titulos || 0) + " título(s) · melhor nota " + (s.draftRec.nota || "—")) : null,
      linha("DME enviados", dmes),
      linha("Repetidos vendidos sozinhos", s.stats.repetidos || 0)
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
    // segunda passada: troca um por um enquanto o time render mais em campo
    // (nota com o embalo da química; fora de posição pesa bastante)
    var byI = {}; all.forEach(function (d) { byI[d.card.i] = d; });
    function valor(ids) {
      var ds = ids.map(function (id) { return id ? byI[id] : null; }), c = chemDe(ds, F), v = 0;
      // fora de posição pesa pelo encaixe: meia em outra função do meio perde pouco,
      // goleiro na zaga perde muito (ninguém quer isso em campo)
      ds.forEach(function (d, i) { if (d) v += effOv(d.ov, c.per[i]) - (1 - posFit(d, slotRole(F[i]))) * 25; });
      return v;
    }
    var atual = valor(xi);
    for (var volta = 0; volta < 3; volta++) {
      var melhorou = false;
      for (var i = 0; i < xi.length; i++) {
        var achou = null, alvo = atual;
        all.forEach(function (d) {
          if (used[d.card.i]) return;
          var tenta = xi.slice(); tenta[i] = d.card.i;
          var v = valor(tenta);
          if (v > alvo + 0.01) { alvo = v; achou = d; }
        });
        if (achou) { if (xi[i]) delete used[xi[i]]; xi[i] = achou.card.i; used[achou.card.i] = 1; atual = alvo; melhorou = true; }
      }
      if (!melhorou) break;
    }
    s.squad.xi = xi;
    // banco: os 7 melhores que sobraram
    var rest = all.filter(function (d) { return !used[d.card.i]; }).sort(function (a, b) { return b.ov - a.ov; });
    s.squad.sub = rest.slice(0, 7).map(function (d) { return d.card.i; });
    save();
  }

  /* ---------- vínculos da química: quantos de cada clube/liga/país e o próximo degrau ---------- */
  function nomeClube(id) { var c = TM.data.club(id); return c ? c.name : "—"; }
  function nomeLiga(id) { try { var L = TM.data.league(id); return L ? L.name : "—"; } catch (e) { return "—"; } }
  function nomePais(id) { try { var n = TM.data.nation(id); return n ? n.name : "—"; } catch (e) { return "—"; } }
  function painelVinculos(ch) {
    function coluna(titulo, mapa, lim, nome) {
      var lin = Object.keys(mapa).map(function (k) { return { k: k, n: mapa[k] }; })
        .filter(function (x) { return x.n >= 2; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 4);
      return el("div", { class: "ut-vin-col" }, [
        el("div", { class: "ut-vin-t", text: titulo + " · " + lim.join("/") }),
        lin.length ? null : el("div", { class: "ut-vin-vazio", text: "nenhum vínculo ainda" })
      ].concat(lin.map(function (x) {
        var pts = ptsPor(x.n, lim), prox = lim.filter(function (v) { return v > x.n; })[0];
        return el("div", { class: "ut-vin-l" + (pts ? " on" : "") }, [
          el("span", { class: "ut-vin-n", text: nome(x.k) }),
          el("span", { class: "ut-vin-c", text: x.n + (prox ? "/" + prox : "") }),
          el("b", { text: pts ? "+" + pts : "0" })
        ]);
      })));
    }
    var fora = ch.emPos.filter(function (v, i) { return ch.ds[i] && !v; }).length;
    return el("div", { class: "ut-vin" }, [
      el("div", { class: "ut-vin-h" }, [
        el("span", { text: "Química do time" }),
        el("b", { text: ch.team + " de 33" })
      ]),
      fora ? el("div", { class: "ut-vin-alerta", text: fora + (fora > 1 ? " jogadores fora de posição: ficam" : " jogador fora de posição: fica") + " com química 0 e não somam vínculo." }) : null,
      el("div", { class: "ut-vin-cols" }, [
        coluna("Clubes", ch.nClub, LIM.club, nomeClube),
        coluna("Ligas", ch.nLg, LIM.lg, nomeLiga),
        coluna("Países", ch.nNat, LIM.nat, nomePais)
      ]),
      el("div", { class: "ut-vin-dica", text: "Cada jogador soma até 3: clube, liga e país dão pontos quando o time junta 2/4/7 do mesmo clube, 3/5/8 da mesma liga e 2/5/8 do mesmo país. Ícone e Herói já entram com 3 (o Ícone vale 2 para o país e 1 para cada liga; o Herói vale 2 para a liga)." })
    ]);
  }

  /* ---------- campo sem nada encostando (pedido do dono: "nada sobre nada") ----------
     Depois que o campo entra na tela, mede as cartas e afasta na vertical as que
     ficariam a menos de 4 px uma da outra (formações apertadas no celular, como a
     4-1-2-1-2). Fica tudo dentro do campo. */
  function separaCampo(pitch) {
    function roda() {
      if (!pitch.isConnected) return;
      var hs = [].slice.call(pitch.querySelectorAll(".ut-slot")), H = pitch.clientHeight;
      if (!H || hs.length < 2) return;
      for (var volta = 0; volta < 8; volta++) {
        var mexeu = false;
        for (var a = 0; a < hs.length; a++) for (var b = a + 1; b < hs.length; b++) {
          var ra = hs[a].getBoundingClientRect(), rb = hs[b].getBoundingClientRect();
          var ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          var iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ix > 0 && iy > -4) {
            var cima = ra.top <= rb.top ? hs[a] : hs[b], baixo = cima === hs[a] ? hs[b] : hs[a];
            var dy = (iy + 4) / 2 / H * 100;
            cima.style.top = Math.max(7, parseFloat(cima.style.top) - dy).toFixed(2) + "%";
            baixo.style.top = Math.min(93, parseFloat(baixo.style.top) + dy).toFixed(2) + "%";
            mexeu = true;
          }
        }
        if (!mexeu) break;
      }
    }
    requestAnimationFrame(roda);
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
        el("div", { class: "ut-sq-stat chem" }, [el("b", { text: ch.team + "/33" }), el("i", { text: "QUÍMICA" })]),
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
      F.forEach(function (slot, i) {
        var d = ch.ds[i], role = slotRole(slot);
        // fora de posição aparece DENTRO da carta (borda vermelha + a função da casa no
        // lugar da posição): rótulo pendurado embaixo encostava na carta de baixo
        var fora = d && !ch.emPos[i];
        var holder = el("div", { class: "ut-slot", title: d ? (fora ? "Fora de posição em " + role + ": química 0" : "Na posição: " + role) : role, style: "left:" + slot[1] + "%;top:" + slot[2] + "%" }, [
          cardEl(d, { chem: d ? ch.per[i] : null, role: role, cls: "mini" + (fora ? " fora" : "") + (d && !podeJogar(d.card) ? " semct" : "") })
        ]);
        if (fora) { var pz = holder.querySelector(".utc-pos"); if (pz) pz.textContent = role; }
        arrastavel(holder, i);
        pitch.appendChild(holder);
      });
      body.appendChild(pitch);
      separaCampo(pitch);

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
      body.appendChild(painelVinculos(ch));
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
      el("i", {}, [TM.ic("shuffle"), document.createTextNode(" Posições")]),
      el("div", { class: "ut-gest-txt", text: d.posicoes.join(" · ") }),
      el("b", { text: d.posicoes.length > 1 ? (d.posicoes.length - 1) + " alternativa" + (d.posicoes.length > 2 ? "s" : "") : "só a principal" })
    ]));
    linhas.push(el("div", { class: "ut-gest-l" }, [
      el("i", {}, [TM.ic(est ? est.ic : "flask-conical"), document.createTextNode(" Estilo")]),
      el("div", { class: "ut-gest-txt", text: est ? est.n : "Básico" }),
      el("b", { text: est ? ORDER.filter(function (k) { return est.b[k]; }).map(function (k) { return "+" + est.b[k] + " " + (d.pos === "GK" ? GK_LABEL : ST_LABEL)[k]; }).join(" ") : "+2 em tudo" })
    ]));

    var itens = (s.itens || []).filter(function (it) {
      if (it.t === "contrato") return true;
      if (it.t === "forma") return fit < FIT_CHEIA;
      if (it.t === "quimica") return true;
      if (it.t === "posicao") return (c.posx || []).length < 2 && ROLES_SETOR[it.p].some(function (r) { return d.posicoes.indexOf(r) < 0; });
      return false;
    });
    var acoes = el("div", { class: "ut-gest-acts" });
    if (!itens.length) {
      acoes.appendChild(el("div", { class: "ut-note", text: "Você não tem itens que sirvam para esta carta. Eles saem dos pacotes." }));
    } else {
      itens.slice(0, 14).forEach(function (it) {
        acoes.appendChild(el("button", { class: "ut-item-bt", on: { click: function () {
          if (it.t === "posicao") {      // escolhe a função dentro do setor do item
            var livres = ROLES_SETOR[it.p].filter(function (r) { return d.posicoes.indexOf(r) < 0; });
            TM.ui.optionsMenu("Nova posição para " + shortNm(d.name), livres.map(function (r) {
              return { label: r, fn: function () { c.posx = (c.posx || []).concat([r]); removeItem(s, it.i); save(); TM.ui.toast(shortNm(d.name) + " agora joga de " + r, "ok"); if (refresh) refresh(); } };
            }));
            return;
          }
          aplicaItem(s, c, it); TM.ui.toast(itemNome(it) + " aplicado", "ok"); if (refresh) refresh(); } } }, [
          el("i", {}, [itemIcone(it)]), el("span", { text: itemNome(it) })
        ]));
      });
    }
    return el("div", { class: "ut-gest" }, [ el("div", { class: "ut-gest-t", text: "Gestão da carta" }) ].concat(linhas).concat([acoes]));
  }
  function aplicaItem(s, c, it) {
    if (it.t === "contrato") c.ct = (c.ct == null ? contratoDe(c.v) : c.ct) + it.n;
    else if (it.t === "forma") c.fit = FIT_CHEIA;
    else if (it.t === "quimica") c.sty = it.e;
    removeItem(s, it.i);
    save();
    emit("item", { s: s, it: it, card: c });
  }

  // Evolução em andamento desta carta (para avisar antes de vender)
  function evoDaCarta(s, cid) {
    try {
      if (!TM.utEvo || !TM.utEvo.emEvolucao(s, cid)) return null;
      var a = TM.utEvo.ativas(s).filter(function (x) { return x.c === cid; })[0], E = a && TM.utEvo.evo(a.id);
      return E ? { n: E.nome || E.n || "Evolução", nv: (a.nv || 0) + 1, tot: (E.niveis || []).length || 1 } : null;
    } catch (e) { return null; }
  }
  function showCard(d, s, after) {
    var sq = inSquad(s), evoAtiva = evoDaCarta(s, d.card.i);
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
          el("div", { class: "ut-dl" }, [el("i", { text: "Raridade" }), el("b", { text: RAR_NAME[d.rar] + " · " + RAR_COR[d.rar] })]),
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
        evoAtiva ? el("div", { class: "ut-note evo" }, [TM.ic("dna"), document.createTextNode(" Em Evolução: " + evoAtiva.n + " (nível " + evoAtiva.nv + " de " + evoAtiva.tot + "). Vender ou usar em DME cancela a Evolução.")]) : null,
        listed ? el("div", { class: "ut-note", text: "Esta carta já está à venda no mercado." }) : (sq[d.card.i] ? el("div", { class: "ut-note", text: "Está no elenco. Tire do time para vender." }) : null),
        (!listed && !sq[d.card.i] && podeVender(d.card)) ? TM.ui.button("Vender no mercado", function () { close(); TM.utMercado.anunciar(d, s, after); }, "btn primary wide") : null,
        (!listed && !sq[d.card.i] && podeVender(d.card)) ? TM.ui.button("Venda rápida (" + fmtC(quickSell(d.ov, d.ver)) + ")", function () {
          TM.ui.confirm("Venda rápida?", d.name + " some da sua coleção por " + fmtC(quickSell(d.ov, d.ver)) + " moedas. Costuma valer bem menos que o mercado." + (evoAtiva ? " A Evolução " + evoAtiva.n + " será cancelada." : ""), "Vender", function () {
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

  /* ---------- loja de pacotes ---------- */
  TM.ui.register("ut-store", function (screen, params) {
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

    // escolhas de jogador ganhas (Temporada, Rivais, Champions, DME...)
    if (s.picks && s.picks.length) {
      body.appendChild(el("div", { class: "ut-sec-t", text: "Escolhas de jogador" }));
      body.appendChild(el("div", { class: "ut-owned" }, s.picks.map(function (pk) {
        return el("button", { class: "ut-owned-it escolha", on: { click: function () { goUT("ut-escolha", { id: pk.id }); } } }, [
          el("span", { class: "ut-o-ic" }, [TM.ic("user-search")]),
          el("span", { text: "1 de " + (pk.n || 3) + " · " + pk.lo + "+" + (pk.ver ? " " + verInfo(pk.ver).n : "") }),
          el("span", { class: "ut-o-go", text: "ESCOLHER" })
        ]);
      })));
    }

    body.appendChild(el("div", { class: "ut-sec-t", text: "Pacotes" }));
    PACKS.forEach(function (pk) {
      var isTC = !!pk.tc;
      body.appendChild(el("div", { class: "ut-pack r-" + (pk.id === "bronze" ? "b" : pk.id === "prata" ? "s" : "g") + (isTC ? " prem" : "") }, [
        el("div", { class: "ut-pk-ic", text: isTC ? "🎁" : "📦" }),
        el("div", { class: "ut-pk-i" }, [
          el("div", { class: "ut-pk-n", text: pk.name }),
          el("div", { class: "ut-pk-d", text: pk.desc }),
          el("button", { class: "utp-odds-bt", on: { click: function (e) { e.stopPropagation(); mostraOdds(pk); } } }, [TM.ic("chart-column"), document.createTextNode(" Probabilidades")])
        ]),
        el("button", {
          class: "ut-pk-buy" + (isTC ? " tc" : ""),
          text: isTC ? (pk.tc + " 🪙") : fmtC(pk.price),
          on: {
            click: function () {
              if (isTC) {
                if (!TM.coins) return;
                if (!TM.coins.canPay(pk.tc)) { faltaTC(pk.tc); return; }
                TM.ui.confirm("Comprar " + pk.name + "?", "Custa " + pk.tc + " Total Coins.", "Comprar", function () {
                  TM.coins.pay(pk.tc, pk.name + " · Ultimate", function () { goUT("ut-pack", { pack: pk.id }); });
                });
              } else {
                if ((s.coins || 0) < pk.price) { faltaMoedas(s, pk.price); return; }
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
      var secMoedas = el("div", { class: "ut-sec-t", id: "ut-sec-moedas", text: "Moedas do Ultimate" });
      body.appendChild(secMoedas);
      if (params && params.secao === "moedas") {
        secMoedas.classList.add("destaque");
        setTimeout(function () { try { secMoedas.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { secMoedas.scrollIntoView(); } }, 120);
      }
      body.appendChild(el("div", { class: "ut-note", text: "Dá para trocar Total Coins por moedas, mas o câmbio é duro: o caminho barato é jogar os Rivais e cumprir objetivos." }));
      [{ tc: 5, m: 20000 }, { tc: 12, m: 60000 }, { tc: 30, m: 180000 }].forEach(function (op) {
        body.appendChild(el("div", { class: "ut-pack r-g" }, [
          el("div", { class: "ut-pk-ic", text: "🪙" }),
          el("div", { class: "ut-pk-i" }, [
            el("div", { class: "ut-pk-n", text: fmtC(op.m) + " moedas" }),
            el("div", { class: "ut-pk-d", text: "Custa " + op.tc + " Total Coins" })
          ]),
          el("button", { class: "ut-pk-buy tc", text: op.tc + " 🪙", on: { click: function () {
            if (!TM.coins.canPay(op.tc)) { faltaTC(op.tc); return; }
            TM.ui.confirm("Trocar " + op.tc + " Total Coins?", "Você recebe " + fmtC(op.m) + " moedas do Ultimate.", "Trocar", function () {
              TM.coins.pay(op.tc, "Moedas do Ultimate", function () { earn(s, op.m, "Troca de Total Coins"); goUT("ut-store"); });
            });
          } } })
        ]));
      });
    }
  });


  /* ---------- identidade do clube: apelido, sigla e escudo ----------
     O escudo é DESENHADO (forma + símbolo em traço + cor + sigla), sem emoji:
     o emoji de bicho o conversor de ícones tirava e o escudo ficava vazio. */
  var ESCUDOS_ANTIGOS = ["🦁","🦅","🐺","🐂","🦈","🐉","⚓","⚡","👑","🔥","⭐","🛡️","🏹","🐍","🐆","🌋","⚔️","💎"];
  var CORES = ["#22c55e","#ef4444","#3b82f6","#f59e0b","#a855f7","#14b8a6","#ec4899","#64748b","#d4af37","#111827","#ffffff","#0ea5e9"];
  var FORMAS = {
    classico: "M50 3 L93 15 V52 C93 80 73 99 50 109 C27 99 7 80 7 52 V15 Z",
    moderno:  "M15 6 H85 Q93 6 93 14 V58 C93 85 71 101 50 109 C29 101 7 85 7 58 V14 Q7 6 15 6 Z",
    redondo:  "M50 6 A47 47 0 1 1 49.99 6 Z",
    diamante: "M50 3 L95 54 L50 109 L5 54 Z",
    hexagono: "M50 3 L93 28 V82 L50 108 L7 82 V28 Z",
    flamula:  "M8 5 H92 V72 L50 109 L8 72 Z"
  };
  var FORMA_ORDEM = ["classico", "moderno", "redondo", "diamante", "hexagono", "flamula"];
  var SIMBOLOS = ["tm-bola", "star", "crown", "flame", "zap", "anchor", "swords", "trophy", "gem", "target", "rocket", "shield", "sparkles", "sun", "moon", "flag", "medal", "award"];
  function escudoCfg(s) {
    var e = (s && s.escudo) || "", m = /^([a-z]+)\|([a-z0-9-]+)$/.exec(e);
    if (m && FORMAS[m[1]]) return { forma: m[1], simb: m[2] };
    var i = ESCUDOS_ANTIGOS.indexOf(e);          // escudo antigo (emoji): vira o clássico
    return { forma: "classico", simb: SIMBOLOS[i >= 0 ? i % SIMBOLOS.length : 0] };
  }
  var _escSeq = 0;
  function claro(cor) { var h = String(cor || "").replace("#", ""); if (h.length !== 6) return false; var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 170; }
  function escudoEl(cfg, cor, sigla, cls) {
    var NS = "http://www.w3.org/2000/svg", id = "utx" + (_escSeq++);
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 112"); svg.setAttribute("class", "utx-forma"); svg.setAttribute("aria-hidden", "true");
    function no(tag, at) { var n = document.createElementNS(NS, tag); Object.keys(at).forEach(function (k) { n.setAttribute(k, at[k]); }); return n; }
    var d = FORMAS[cfg.forma] || FORMAS.classico;
    var defs = no("defs", {}), clip = no("clipPath", { id: id });
    clip.appendChild(no("path", { d: d })); defs.appendChild(clip);
    var grad = no("linearGradient", { id: id + "g", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(no("stop", { offset: "0", "stop-color": "#fff", "stop-opacity": ".28" }));
    grad.appendChild(no("stop", { offset: ".55", "stop-color": "#fff", "stop-opacity": "0" }));
    grad.appendChild(no("stop", { offset: "1", "stop-color": "#000", "stop-opacity": ".28" }));
    defs.appendChild(grad); svg.appendChild(defs);
    svg.appendChild(no("path", { d: d, fill: cor || "#22c55e" }));
    var g = no("g", { "clip-path": "url(#" + id + ")" });
    g.appendChild(no("rect", { x: "38", y: "0", width: "24", height: "112", fill: "#000", "fill-opacity": ".16" }));
    g.appendChild(no("rect", { x: "0", y: "0", width: "100", height: "112", fill: "url(#" + id + "g)" }));
    svg.appendChild(g);
    svg.appendChild(no("path", { d: d, fill: "none", stroke: "rgba(255,255,255,.6)", "stroke-width": "3.5" }));
    var tinta = claro(cor) ? " escuro" : "";
    return el("div", { class: "utx-escudo" + tinta + (cls ? " " + cls : "") }, [
      svg, el("div", { class: "utx-simb" }, [TM.ic(cfg.simb)]),
      sigla ? el("div", { class: "utx-sig", text: sigla }) : null
    ]);
  }
  function escudoDe(s, cls) { return escudoEl(escudoCfg(s), s && s.cor || "#22c55e", siglaDe(s), cls); }
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
    var cfg = escudoCfg(s), cor = s.cor || CORES[0];

    var previa = el("div", { class: "ut-id-previa" });
    var formas = el("div", { class: "ut-escudos" }), simbs = el("div", { class: "ut-escudos simbs" }), cores = el("div", { class: "ut-cores" });
    function sig() { return (sigla.value || siglaAuto(apelido.value || nome.value)).toUpperCase(); }
    function desenha() {
      TM.ui.clear(previa);
      previa.appendChild(escudoEl(cfg, cor, sig(), "grande"));
      previa.appendChild(el("div", { class: "ut-id-txt" }, [
        el("div", { class: "ut-id-nome", text: (apelido.value || nome.value || "Meu Ultimate") }),
        el("div", { class: "ut-id-sig", text: sig() })
      ]));
      TM.ui.clear(formas);
      FORMA_ORDEM.forEach(function (f) {
        formas.appendChild(el("button", { class: "ut-esc-op" + (cfg.forma === f ? " sel" : ""), on: { click: function () { cfg.forma = f; desenha(); } } }, [escudoEl({ forma: f, simb: cfg.simb }, cor, "")]));
      });
      TM.ui.clear(simbs);
      SIMBOLOS.forEach(function (ic) {
        simbs.appendChild(el("button", { class: "ut-esc-op simb" + (cfg.simb === ic ? " sel" : ""), on: { click: function () { cfg.simb = ic; desenha(); } } }, [TM.ic(ic)]));
      });
      TM.ui.clear(cores);
      CORES.forEach(function (c) {
        cores.appendChild(el("button", { class: "ut-cor" + (c === cor ? " sel" : ""), style: "background:" + c, on: { click: function () { cor = c; desenha(); } } }));
      });
    }
    [nome, apelido, sigla].forEach(function (i) { i.addEventListener("input", function () { previa.firstChild && previa.replaceChild(escudoEl(cfg, cor, sig(), "grande"), previa.firstChild); previa.lastChild.firstChild.textContent = apelido.value || nome.value || "Meu Ultimate"; previa.lastChild.lastChild.textContent = sig(); }); });
    desenha();

    body.appendChild(previa);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Nome e apelido" }));
    body.appendChild(nome);
    body.appendChild(apelido);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Abreviação (3 letras, aparece no placar e no escudo)" }));
    body.appendChild(sigla);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Forma do escudo" }));
    body.appendChild(formas);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Símbolo" }));
    body.appendChild(simbs);
    body.appendChild(el("div", { class: "ut-sec-t", text: "Cor" }));
    body.appendChild(cores);

    body.appendChild(TM.ui.button("Salvar", function () {
      s.club = (nome.value || "").trim() || s.club || "Meu Ultimate";
      s.apelido = (apelido.value || "").trim();
      s.sigla = ((sigla.value || "").trim() || siglaAuto(s.apelido || s.club)).toUpperCase().slice(0, 3);
      s.escudo = cfg.forma + "|" + cfg.simb; s.cor = cor;
      save();
      TM.ui.toast("Identidade salva", "ok");
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
        el("span", { class: "ut-item-ic" }, [itemIcone(g[0])]),
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
    // walkout (bandeira → posição → clube → carta) para a melhor carta, se for 84+ ou versão especial forte
    var temWalk = !!best && (best.ov >= 85 || ["mes", "heroi", "tots", "icone"].indexOf(best.ver) >= 0);
    var walkFeito = false;
    showNext();

    function showNext() {
      TM.ui.clear(stage);
      if (idx >= ds.length) {
        if (temWalk && !walkFeito) { walkFeito = true; idx = ds.length - 1; walkout(best, function () { idx = ds.length; showNext(); }); return; }
        summary(); return;
      }
      var d = ds[idx];
      if (temWalk && !walkFeito && d === best) { walkFeito = true; walkout(d, showNext); return; }
      var walk = d.ov >= 84;
      var wrap = el("div", { class: "ut-reveal" + (walk ? " walkout" : "") }, [
        el("div", { class: "ut-rev-count", text: (idx + 1) + " de " + ds.length }),
        walk ? el("div", { class: "ut-walk-tx", text: "⭐ JOGADOR ESPECIAL" }) : null,
        cardEl(d, { cls: "big pop" }),
        el("div", { class: "ut-rev-nm", text: d.name }),
        el("div", { class: "ut-rev-sub", text: (d.club ? d.club.name : "") + " · vale ~" + fmtC(basePrice(d.ov, d.ver)) }),
        d.card.rep != null ? el("div", { class: "ut-rep", text: "Repetido: você já tem " + d.name + (d.card.rep ? ". Venda rápida automática: +" + fmtC(d.card.rep) + " moedas." : ". Empréstimo dispensado.") }) : null,
        d.card.repTroca != null ? el("div", { class: "ut-rep melhor", text: "Melhor que a sua: a carta antiga virou venda rápida (+" + fmtC(d.card.repTroca) + ")." }) : null,
        TM.ui.button(idx === ds.length - 1 ? "Ver resumo" : "Próximo", function () { idx++; showNext(); }, "btn primary wide"),
        el("button", { class: "btn ghost small", text: "Revelar tudo", on: { click: function () { idx = ds.length; showNext(); } } })
      ]);
      stage.appendChild(wrap);
    }
    function walkout(d, depois) {
      TM.ui.clear(stage);
      var VI = verInfo(d.ver), esp = !!VI.sel;
      var passo = el("div", { class: "utw-passo" });
      var pular = el("button", { class: "utw-pular", text: "Pular" });
      var cena = el("div", { class: "utw" + (esp ? " esp" : "") + (d.ov >= 88 ? " top" : "") }, [
        el("div", { class: "utw-raios" }), el("div", { class: "utw-luz" }), passo, pular
      ]);
      stage.appendChild(cena);
      var etapas = [
        function () { return el("div", { class: "utw-item" }, [TM.img.flagImg(TM.data.nation(d.nat), "utw-flag"), el("div", { class: "utw-lbl", text: nomePais(d.nat) })]); },
        function () { return el("div", { class: "utw-item" }, [el("div", { class: "utw-pos", text: d.pos2 }), el("div", { class: "utw-lbl", text: "Posição" })]); },
        function () { return el("div", { class: "utw-item" }, [d.club ? TM.img.clubImg(d.club, "utw-crest") : el("span"), el("div", { class: "utw-lbl", text: d.club ? d.club.name : "" })]); }
      ];
      var k = 0, fim = false, tm = null;
      function prox() {
        if (fim) return;
        clearTimeout(tm);
        if (k >= etapas.length) { acaba(); return; }
        var no; try { no = etapas[k](); } catch (e) { no = el("span"); }
        TM.ui.clear(passo); no.classList.add("entra"); passo.appendChild(no);
        k++; tm = setTimeout(prox, 1100);
      }
      function acaba() { if (fim) return; fim = true; clearTimeout(tm); depois(); }
      pular.addEventListener("click", function (e) { e.stopPropagation(); acaba(); });
      cena.addEventListener("click", function () { prox(); });     // tocar adianta a próxima etapa
      tm = setTimeout(prox, 450);
    }
    function summary() {
      TM.ui.clear(stage);
      stage.appendChild(el("div", { class: "ut-sum" }, [
        el("div", { class: "ut-sum-t", text: pk.name + " aberto" }),
        el("div", { class: "ut-sum-b", text: "Melhor carta: " + (best ? best.name + " (" + best.ov + ")" + (best.card.rep != null ? " · repetida, virou moedas" : "") : "—") }),
        el("div", { class: "ut-sum-grid" }, ds.slice().reverse().map(function (d) {
          if (d.card.rep != null) return cardEl(d, { cls: "tiny vendida" });     // já foi vendida: só mostra
          return cardEl(d, { cls: "tiny", on: function () { showCard(d, s, null); } });
        })),
        (function () {
          var reps = ds.filter(function (d) { return d.card.rep != null; }), tot = reps.reduce(function (a, d) { return a + (d.card.rep || 0); }, 0);
          cards.forEach(function (c) { delete c.repTroca; }); save();
          return reps.length ? el("div", { class: "ut-rep", text: reps.length + (reps.length > 1 ? " repetidos viraram" : " repetido virou") + " venda rápida: +" + fmtC(tot) + " moedas." }) : null;
        })(),
        itensGanhos.length ? el("div", { class: "ut-sum-b", text: "Itens: " + itensGanhos.length }) : null,
        itensGanhos.length ? el("div", { class: "ut-itens-lin" }, itensGanhos.map(function (it) {
          return el("span", { class: "ut-item-chip" }, [ el("i", {}, [itemIcone(it)]), el("b", { text: itemNome(it) }) ]);
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

  /* ================= eventos (para os módulos: temporada, evoluções, modos) =================
     "partida" { s, modo, gf, ga, venceu, empate, perdeu, golsPor{pid:n}, xi[cid], dif }
     "pacote" { s, pk, cards } · "dme" { s, sbc } · "venda" { s, n } · "compra" { s } */
  var _ouv = {};
  function on(ev, fn) { (_ouv[ev] = _ouv[ev] || []).push(fn); }
  function emit(ev, dado) { (_ouv[ev] || []).forEach(function (fn) { try { fn(dado); } catch (e) { try { console.warn("ut evento " + ev, e); } catch (e2) {} } }); }

  /* ================= API ================= */
  TM.ut = {
    state: st, save: save, reset: reset,
    chemistry: chemistry, squadRating: squadRating, cardData: cardData, cardEl: cardEl,
    basePrice: basePrice, openPack: openPack, PACKS: PACKS, DIVS: DIVS,
    autoFill: autoFill, slotRole: slotRole, posFit: posFit, isTotw: isTotw, notaEquipe: notaEquipe, chemDe: chemDe,
    effOv: effOv, earn: earn, statsOf: statsOf, quickSell: quickSell, packById: packById,
    addCard: addCard, limpaRepetidos: limpaRepetidos, resolveRepetido: resolveRepetido,
    _new: function (name) { S = blank(); S.club = name || "Meu Ultimate"; save(); return S; }
  };
  // API interna para os módulos do Ultimate (ut-modos, ut-temporada, ut-evolucoes, ut-dme, ut-draft...)
  TM.ut._i = {
    st: st, save: save, el: el, clamp: clamp, fmtC: fmtC, coinsEl: coinsEl, shuffle: shuffle, mulberry: mulberry, hashStr: hashStr,
    today: today, weekOf: weekOf, shortNm: shortNm,
    pool: pool, poolByPos: poolByPos, leagueOf: leagueOf, clubOf: clubOf, drawPlayer: drawPlayer,
    rarOf: rarOf, RAR_NAME: RAR_NAME, RAR_COR: RAR_COR, VERSOES: VERSOES, verInfo: verInfo, verBonus: verBonus,
    sorteiaVersao: sorteiaVersao, isTotw: isTotw, totwSet: totwSet,
    mkCard: mkCard, cardData: cardData, basePrice: basePrice, quickSell: quickSell, addCard: addCard, removeCard: removeCard,
    cardMap: cardMap, inSquad: inSquad,
    chemistry: chemistry, chemDe: chemDe, effOv: effOv, notaEquipe: notaEquipe, squadRating: squadRating, LIM: LIM, ptsPor: ptsPor,
    slotRole: slotRole, posFit: posFit, posicoesDe: posicoesDe, principal: principal, emPosicao: emPosicao, ROLES_SETOR: ROLES_SETOR, SECTOR: SECTOR,
    earn: earn, pay: pay, faltaMoedas: faltaMoedas, faltaTC: faltaTC,
    PACKS: PACKS, packById: packById, openPack: openPack, novoItem: novoItem, addItem: addItem, ESTILOS: ESTILOS, estiloPor: estiloPor,
    itemNome: itemNome, itemIcone: itemIcone,
    statsOf: statsOf, cardEl: cardEl, showCard: showCard, autoFill: autoFill, gastaJogo: gastaJogo, penFisica: penFisica,
    podeJogar: podeJogar, temContrato: temContrato, ehEmprestimo: ehEmprestimo, podeVender: podeVender,
    objBump: objBump, utTeam: utTeam, goUT: goUT, utTop: utTop, wallet: wallet,
    escudoDe: escudoDe, escudoEl: escudoEl, nomeExibido: nomeExibido, siglaDe: siglaDe, painelVinculos: painelVinculos, separaCampo: separaCampo,
    DIVS: DIVS, divInfo: divInfo, nomeClube: nomeClube, nomeLiga: nomeLiga, nomePais: nomePais,
    on: on, emit: emit
  };
})(window);
