/* ================= TOTAL ULTIMATE — EVOLUÇÕES =================
   Como as Evolutions do Ultimate Team: você escolhe uma carta do clube que
   cumpre os requisitos de uma Evolução e ela sobe de nota e de atributos,
   nível a nível, conforme cumpre objetivos jogando como TITULAR.
     - até 3 Evoluções em andamento ao mesmo tempo;
     - cada Evolução vale uma vez por clube (s.evo.usadas[id]). Se a carta sair
       do clube no meio (venda, DME, repetido), a Evolução volta a ficar livre;
       se você desistir, a carta devolve o que ganhou nela e a Evolução também
       volta a ficar livre (assim ninguém repete os ganhos em várias cartas);
     - os ganhos ficam na própria carta (card.evo.b: ov e atributos), que o núcleo
       já soma na nota, nos atributos, na raridade e no selo de DNA da carta;
       uma carta pode fazer outra Evolução depois de concluir a anterior (soma);
     - cada Evolução tem um teto de nota e de atributo: o ganho para no teto;
     - só conta quem começou jogando (res.xi do evento "partida") num modo com o
       elenco do clube; o Draft (xi vazio) e a partida abandonada não contam.
   Estado em s.evo:
     ativas: [{ id, c (carta), p (jogador), nv (nível atual, 0..), prog: [por objetivo], g: {ganho até agora}, t, ov0 }]
     usadas: { id: { c, t, fim? } }   feitas: [{ id, c, p, nome, gk, ov0, ov1, g, t0, t }]
     avisos: [Evoluções canceladas porque a carta saiu do clube, ainda não mostradas]
   Na carta: card.evo = { b: {ov, pac...} (soma de todas), id, nv (última Evolução), feitas: [ids], fim }.
   Rotas: "ut-evolucoes" (Disponíveis · Em andamento · Concluídas) e "ut-evo-escolha"
   (cartas elegíveis → prévia antes/depois → confirmar). API: TM.utEvo. */
(function (global) {
  "use strict";
  var TM = global.TM;
  if (!TM || !TM.ui || !TM.ut || !TM.ut._i) return;
  if (TM.utEvo && TM.utEvo._ok) return;        // carregado duas vezes: não ouve a partida em dobro
  var el = TM.ui.el;
  function I() { return TM.ut._i; }
  function ic(n, cls) { return TM.ic ? TM.ic(n, cls) : document.createTextNode(""); }

  var MAX_ATIVAS = 3;
  var ORDER = ["pac", "sho", "pas", "dri", "def", "phy"];
  var ST_LABEL = { pac: "RIT", sho: "FIN", pas: "PAS", dri: "DRI", def: "DEF", phy: "FÍS" };
  var GK_LABEL = { pac: "VEL", sho: "CHU", pas: "MAN", dri: "POS", def: "ELA", phy: "REF" };
  // atributos-chave de cada função (o "+N nos atributos da função" das Evoluções abertas)
  var FUN = { GOL: ["def", "phy"], ZAG: ["def", "phy"], LD: ["pac", "def"], LE: ["pac", "def"], VOL: ["def", "pas"],
              MC: ["pas", "dri"], MEI: ["pas", "dri"], MD: ["pac", "dri"], ME: ["pac", "dri"], PD: ["pac", "dri"],
              PE: ["pac", "dri"], SA: ["sho", "dri"], CA: ["sho", "pac"] };
  var FUN_SETOR = { GK: ["def", "phy"], DF: ["def", "phy"], MF: ["pas", "dri"], FW: ["sho", "pac"] };
  // estilo de química do prêmio das Evoluções abertas a qualquer posição
  var ESTILO_SETOR = { GK: "luvas", DF: "sentinela", MF: "catalisador", FW: "cacador" };

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dataTx(t) { var d = new Date(t || Date.now()); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }
  function lbl(k, gk) { return (gk ? GK_LABEL : ST_LABEL)[k]; }
  function ehGk(d) { return !!d && d.pos === "GK"; }

  // valor "puro" do atributo na carta (sem química e sem cansaço): base + versão + Evoluções
  function valorAttr(d, k) {
    var U = I(), a = d.attrs || {}, evo = d.evo || {};
    return U.clamp(Math.round((a[k] || 50) + U.verBonus(d.ver) + (evo[k] || 0)), 1, 99);
  }

  /* ================= requisitos ================= */
  function rq(tx, fn) { return { tx: tx, ok: fn }; }
  function notaAte(n) { return rq("Nota até " + n, function (d) { return d.ov <= n; }); }
  // requisito de perfil (posição, idade): a lista "quase lá" não sugere carta de outro perfil
  function perfil(r) { r.perfil = true; return r; }
  function funcoes(lista, tx) { return perfil(rq(tx, function (d) { return lista.indexOf(d.pos2) >= 0; })); }
  function setores(lista, tx) { return perfil(rq(tx, function (d) { return lista.indexOf(d.pos) >= 0; })); }
  function attrAte(k, n) { return rq(ST_LABEL[k] + " até " + n, function (d) { return valorAttr(d, k) <= n; }); }
  function idadeAte(n) { return perfil(rq("Até " + n + " anos", function (d) { return ((d.p && d.p.age) || 99) <= n; })); }

  /* ================= as Evoluções =================
     obj (objetivos de partida, todos do nível precisam fechar):
       j = jogue N como titular · v = vença N · g = gols dele · cs = jogos sem sofrer gol
       dest = destaque (atacante/meia: gols; defensor/goleiro: jogos sem sofrer gol)
     g (ganho do nível): ov = nota; pac/sho/pas/dri/def/phy = atributo;
       fun = nos 2 atributos-chave da função da carta; tudo = em todos os atributos
     teto: a Evolução não passa disso (nota e atributo); premio: no fim de tudo. */
  var EVOS = [
    { id: "velocista", n: "Velocista", ic: "zap",
      tx: "Arranque e aceleração para quem vive de atacar o espaço.",
      req: [setores(["FW", "MF"], "Atacante ou meia"), notaAte(80), attrAte("pac", 85)],
      teto: { ov: 83, at: 92 },
      niveis: [
        { obj: [{ t: "j", n: 2 }], g: { ov: 1, pac: 2 } },
        { obj: [{ t: "v", n: 2 }], g: { ov: 1, pac: 2, dri: 1 } },
        { obj: [{ t: "j", n: 3 }, { t: "g", n: 1 }], g: { ov: 1, pac: 2, sho: 1 } }
      ],
      premio: { itens: [{ t: "quimica", e: "cacador" }], xp: 300 } },
    { id: "muralha", n: "Muralha Total", ic: "brick-wall",
      tx: "Marcação, força e tempo de bola para fechar a área.",
      req: [funcoes(["ZAG"], "Zagueiro (ZAG)"), notaAte(79)],
      teto: { ov: 82, at: 90 },
      niveis: [
        { obj: [{ t: "j", n: 2 }], g: { ov: 1, def: 2 } },
        { obj: [{ t: "v", n: 2 }, { t: "cs", n: 1 }], g: { ov: 1, def: 2, phy: 2 } },
        { obj: [{ t: "cs", n: 2 }], g: { ov: 1, def: 1, pac: 1, phy: 1 } }
      ],
      premio: { itens: [{ t: "quimica", e: "muralha" }], xp: 300 } },
    { id: "maestro", n: "Maestro", ic: "music",
      tx: "Visão de jogo e passe para comandar o meio-campo.",
      req: [funcoes(["VOL", "MC", "MEI"], "Volante ou meia central (VOL, MC, MEI)"), notaAte(80)],
      teto: { ov: 83, at: 91 },
      niveis: [
        { obj: [{ t: "j", n: 2 }], g: { ov: 1, pas: 2 } },
        { obj: [{ t: "v", n: 2 }], g: { ov: 1, pas: 2, dri: 1 } },
        { obj: [{ t: "j", n: 3 }, { t: "v", n: 2 }], g: { ov: 1, pas: 1, dri: 2, sho: 1 } }
      ],
      premio: { itens: [{ t: "quimica", e: "maestro" }], xp: 300 } },
    { id: "paredao", n: "Paredão", ic: "tm-luva", gk: true,
      tx: "Reflexo, elasticidade e posicionamento debaixo das traves.",
      req: [funcoes(["GOL"], "Goleiro (GOL)"), notaAte(80)],
      teto: { ov: 83, at: 90 },
      niveis: [
        { obj: [{ t: "j", n: 2 }], g: { ov: 1, phy: 2 } },
        { obj: [{ t: "v", n: 2 }, { t: "cs", n: 1 }], g: { ov: 1, def: 2, dri: 1 } },
        { obj: [{ t: "cs", n: 2 }], g: { ov: 1, phy: 1, def: 1, pas: 1 } }
      ],
      premio: { itens: [{ t: "quimica", e: "felino" }], xp: 300 } },
    { id: "joia", n: "Joia em Ascensão", ic: "sprout",
      tx: "Para o garoto do elenco: sobe mais que as outras, em 4 níveis.",
      req: [idadeAte(23), notaAte(76)],
      teto: { ov: 81, at: 88 },
      niveis: [
        { obj: [{ t: "j", n: 2 }], g: { ov: 2, fun: 2 } },
        { obj: [{ t: "v", n: 2 }], g: { ov: 2, tudo: 1 } },
        { obj: [{ t: "j", n: 3 }], g: { ov: 1, fun: 2 } },
        { obj: [{ t: "v", n: 3 }], g: { ov: 2, fun: 1, tudo: 1 } }
      ],
      premio: { setor: true, xp: 400 } },
    { id: "artilheiro", n: "Artilheiro", ic: "flame",
      tx: "Faro de gol: cada gol dele empurra a Evolução.",
      req: [funcoes(["CA", "SA"], "Centroavante ou segundo atacante (CA, SA)"), notaAte(81)],
      teto: { ov: 84, at: 93 },
      niveis: [
        { obj: [{ t: "g", n: 2 }], g: { ov: 1, sho: 2 } },
        { obj: [{ t: "j", n: 3 }, { t: "v", n: 2 }], g: { ov: 1, sho: 2, phy: 1 } },
        { obj: [{ t: "g", n: 3 }], g: { ov: 1, sho: 1, dri: 1, pac: 1 } }
      ],
      premio: { itens: [{ t: "quimica", e: "artilheiro" }], xp: 300 } },
    { id: "lateral", n: "Lateral Moderno", ic: "arrow-left-right",
      tx: "Vai e volta o jogo todo: apoia no ataque e fecha o corredor.",
      req: [funcoes(["LD", "LE"], "Lateral (LD, LE)"), notaAte(79)],
      teto: { ov: 82, at: 90 },
      niveis: [
        { obj: [{ t: "j", n: 2 }], g: { ov: 1, pac: 2 } },
        { obj: [{ t: "v", n: 2 }], g: { ov: 1, pas: 2, dri: 1 } },
        { obj: [{ t: "cs", n: 2 }], g: { ov: 1, def: 2, pac: 1 } }
      ],
      premio: { itens: [{ t: "quimica", e: "sombra" }], xp: 300 } },
    { id: "lenda", n: "Rumo à Lenda", ic: "crown", custo: 25000,
      tx: "Evolução premium: o maior salto do modo, para levar um craque ao patamar de Lenda.",
      req: [notaAte(84)],
      teto: { ov: 88, at: 95 },
      niveis: [
        { obj: [{ t: "j", n: 3 }], g: { ov: 1, fun: 2 } },
        { obj: [{ t: "v", n: 3 }], g: { ov: 1, tudo: 1 } },
        { obj: [{ t: "dest", n: 2 }], g: { ov: 1, fun: 2 } },
        { obj: [{ t: "v", n: 4 }], g: { ov: 2, fun: 2, tudo: 1 } }
      ],
      premio: { setor: true, xp: 1000 } }
  ];
  function evoPor(id) { for (var i = 0; i < EVOS.length; i++) if (EVOS[i].id === id) return EVOS[i]; return null; }

  /* ================= estado ================= */
  function estado(s) {
    if (!s.evo || typeof s.evo !== "object") s.evo = {};
    var e = s.evo;
    if (!Array.isArray(e.ativas)) e.ativas = [];
    if (!e.usadas || typeof e.usadas !== "object") e.usadas = {};
    if (!Array.isArray(e.feitas)) e.feitas = [];
    if (!Array.isArray(e.avisos)) e.avisos = [];
    return e;
  }
  function anuncio(s, cid) {
    var L = ((s.mkt && s.mkt.sell) || []).filter(function (x) { return x && x.card && x.card.i === cid; })[0];
    return L || null;
  }
  // a carta de uma Evolução ativa: no clube, ou parada num anúncio do mercado
  function cartaDe(s, a) {
    var c = I().cardMap(s)[a.c];
    if (c) return c;
    var L = anuncio(s, a.c);
    return L && !L.sold ? L.card : null;
  }
  function emAtiva(s, cid) { return estado(s).ativas.some(function (a) { return a.c === cid; }); }
  function libera(e, a) { if (e.usadas[a.id] && !e.usadas[a.id].fim) delete e.usadas[a.id]; }

  /* Tira das ativas quem não está mais no clube (venda, venda rápida, DME, repetido)
     e Evolução que não existe mais. Carta anunciada e ainda não vendida fica parada. */
  function limpa(s) {
    var U = I(), e = estado(s), m = U.cardMap(s), saiu = [];
    e.ativas = e.ativas.filter(function (a) {
      var E = evoPor(a.id);
      if (E && m[a.c]) return true;
      var L = E ? anuncio(s, a.c) : null;
      if (L && !L.sold) return true;
      saiu.push(a);
      return false;
    });
    if (!saiu.length) return saiu;
    saiu.forEach(function (a) {
      libera(e, a);
      var E = evoPor(a.id), pl = TM.data.player(a.p);
      if (E) e.avisos.push("Evolução " + E.n + " cancelada: " + (pl ? U.shortNm(pl.name) : "a carta") + " saiu do clube.");
    });
    U.save();
    return saiu;
  }
  // mostra (uma vez) os avisos de Evolução cancelada
  function avisar(s) {
    var e = estado(s);
    if (!e.avisos.length) return;
    TM.ui.toast(e.avisos.join(" "), "alerta");
    e.avisos = [];
    I().save();
  }
  function statusDe(s, E) {
    var u = estado(s).usadas[E.id];
    if (!u) return "livre";
    return u.fim ? "feita" : "ativa";
  }
  function ativaDe(s, id) { return estado(s).ativas.filter(function (a) { return a.id === id; })[0] || null; }

  /* ================= elegibilidade ================= */
  function checa(s, E, card) {
    var U = I(), d = card ? U.cardData(card) : null, falhas = [];
    if (!d) return { ok: false, falhas: ["Carta indisponível"], d: null };
    if (d.ver === "icone") falhas.push("Ícone não entra em Evolução");
    else if (d.ver === "heroi") falhas.push("Herói não entra em Evolução");
    if (U.ehEmprestimo(card)) falhas.push("Jogador emprestado");
    if (emAtiva(s, card.i)) falhas.push("Já está em outra Evolução");
    E.req.forEach(function (r) { if (!r.ok(d)) falhas.push(r.tx); });
    return { ok: !falhas.length, falhas: falhas, d: d };
  }
  // cartas do clube que podem começar a Evolução (as titulares primeiro, depois pela nota)
  function elegiveis(s, id) {
    var E = typeof id === "string" ? evoPor(id) : id;
    if (!E || !s) return [];
    var xi = (s.squad && s.squad.xi) || [];
    return (s.cards || []).map(function (c) { return checa(s, E, c); })
      .filter(function (x) { return x.ok; }).map(function (x) { return x.d; })
      .sort(function (a, b) { return (xi.indexOf(b.card.i) >= 0) - (xi.indexOf(a.card.i) >= 0) || b.ov - a.ov; });
  }

  /* ================= ganhos ================= */
  function funDe(d) { return FUN[d.pos2] || FUN_SETOR[d.pos] || ["pas", "dri"]; }
  // ganho do nível para esta carta (resolve "fun" e "tudo")
  function resolve(g, d) {
    var out = { ov: g.ov || 0 }, fun = funDe(d);
    ORDER.forEach(function (k) { out[k] = (g[k] || 0) + (g.tudo || 0) + (g.fun && fun.indexOf(k) >= 0 ? g.fun : 0); });
    return out;
  }
  function valores(d) { var v = { ov: d.ov }; ORDER.forEach(function (k) { v[k] = valorAttr(d, k); }); return v; }
  // o ganho respeita o teto da Evolução (e o 99)
  function capa(E, vals, g) {
    var out = { ov: Math.max(0, Math.min(g.ov || 0, Math.min(99, E.teto.ov) - vals.ov)) };
    ORDER.forEach(function (k) { out[k] = Math.max(0, Math.min(g[k] || 0, Math.min(99, E.teto.at) - vals[k])); });
    return out;
  }
  function soma(a, b) { a = a || {}; ["ov"].concat(ORDER).forEach(function (k) { if (b && b[k]) a[k] = (a[k] || 0) + b[k]; }); return a; }
  function vazio(g) { return !g || !["ov"].concat(ORDER).some(function (k) { return g[k]; }); }
  // simula os níveis que faltam (a partir de "desde") com os tetos: ganho de cada um, total e valores finais
  function simula(E, d, desde) {
    var vals = valores(d), niveis = [], total = {};
    for (var n = desde || 0; n < E.niveis.length; n++) {
      var g = capa(E, vals, resolve(E.niveis[n].g, d));
      vals.ov += g.ov; ORDER.forEach(function (k) { vals[k] += g[k]; });
      soma(total, g); niveis.push(g);
    }
    return { niveis: niveis, total: total, fim: vals };
  }
  // carta de mentira com os ganhos somados (para a prévia "depois")
  function cartaPrevia(card, extra) {
    var b = soma(soma({}, (card.evo && card.evo.b) || {}), extra);
    if (b.ov == null) b.ov = 0;
    return { i: card.i + "_evo", p: card.p, v: card.v, r: card.r, ut: card.ut, ct: card.ct, fit: card.fit, sty: card.sty, posx: card.posx, evo: { b: b } };
  }

  /* ================= textos ================= */
  function tipoObj(o, d) { return o.t !== "dest" ? o.t : (d && (d.pos === "GK" || d.pos === "DF") ? "cs" : "g"); }
  function textoObj(o, d) {
    var n = o.n, t = d ? tipoObj(o, d) : o.t;
    if (t === "j") return "Jogue " + plural(n, "partida", "partidas") + " como titular";
    if (t === "v") return "Vença " + plural(n, "partida", "partidas");
    if (t === "g") return "Marque " + plural(n, "gol", "gols") + " com ele";
    if (t === "cs") return plural(n, "jogo", "jogos") + " sem sofrer gol";
    if (t === "dest") return "Marque " + plural(n, "gol", "gols") + " (defensor ou goleiro: " + plural(n, "jogo", "jogos") + " sem sofrer gol)";
    return "Objetivo";
  }
  function curtoObj(o, d) {
    var t = tipoObj(o, d);
    return t === "j" ? "jogos" : t === "v" ? "vitórias" : t === "g" ? "gols" : t === "cs" ? "sem sofrer gol" : "objetivo";
  }
  var NB = "\u00a0";                // espaço que não quebra: "+1 DEF" nunca se divide entre linhas
  // ganho já resolvido: "+1 nota, +2 RIT"
  function textoGanho(g, gk) {
    var p = [];
    if (g && g.ov) p.push("+" + g.ov + NB + "nota");
    ORDER.forEach(function (k) { if (g && g[k]) p.push("+" + g[k] + NB + lbl(k, gk)); });
    return p.length ? p.join(", ") : "sem ganho (já no teto)";
  }
  // ganho do catálogo (pode ter "fun" e "tudo")
  function textoNominal(g, gk) {
    var p = [];
    if (g.ov) p.push("+" + g.ov + NB + "nota");
    ORDER.forEach(function (k) { if (g[k]) p.push("+" + g[k] + NB + lbl(k, gk)); });
    if (g.fun) p.push("+" + g.fun + NB + "nos atributos da função");
    if (g.tudo) p.push("+" + g.tudo + NB + "em todos os atributos");
    return p.join(" · ");
  }
  function premioDe(E, d) {
    var pr = E.premio || {}, out = { itens: (pr.itens || []).slice(), xp: pr.xp || 0 };
    if (pr.setor) out.itens.push({ t: "quimica", e: ESTILO_SETOR[d && d.pos] || "motor" });
    if (pr.coins) out.coins = pr.coins;
    return out;
  }
  function textoPremio(E, d) {
    var U = I(), pr = E.premio || {}, p = [];
    (pr.itens || []).forEach(function (it) { var est = U.estiloPor(it.e); p.push("Estilo " + (est ? est.n : it.e)); });
    if (pr.setor) { var est = d ? U.estiloPor(ESTILO_SETOR[d.pos]) : null; p.push(est ? "Estilo " + est.n : "Estilo de química do setor da carta"); }
    if (pr.coins) p.push(U.fmtC(pr.coins) + " moedas");
    if (pr.xp && TM.utTemp) p.push(U.fmtC(pr.xp) + " XP da temporada");
    return p.join(" + ") || "—";
  }
  function darPremio(s, pr, origem) {
    if (TM.utModos && TM.utModos.darRecompensa) return TM.utModos.darRecompensa(s, pr, origem) || [];
    var U = I(), notas = [];
    (pr.itens || []).forEach(function (it) { U.addItem(s, U.novoItem(Object.assign({}, it))); notas.push({ ic: "flask-conical", tx: U.itemNome(it) }); });
    if (pr.coins) { U.earn(s, pr.coins, origem); notas.push({ ic: "tm-moeda", tx: "+" + U.fmtC(pr.coins) + " moedas" }); }
    U.save();
    return notas;
  }

  /* ================= começar, desistir, subir de nível, concluir ================= */
  function iniciar(s, id, cid) {
    var U = I(), E = evoPor(id);
    if (!s) return { erro: "Clube não encontrado." };
    var e = estado(s);
    limpa(s);
    if (!E) return { erro: "Evolução não encontrada." };
    if (e.usadas[id]) return { erro: e.usadas[id].fim ? "Você já concluiu a Evolução " + E.n + " neste clube." : "A Evolução " + E.n + " já está em andamento." };
    if (e.ativas.length >= MAX_ATIVAS) return { erro: "Você já tem " + MAX_ATIVAS + " Evoluções em andamento. Conclua uma antes de começar outra." };
    var card = U.cardMap(s)[cid];
    var ck = checa(s, E, card);
    if (!ck.ok) return { erro: "Essa carta não cumpre: " + ck.falhas.join(", ") + "." };
    if (E.custo) {
      if ((s.coins || 0) < E.custo) return { erro: "moedas", falta: E.custo - (s.coins || 0) };
      if (!U.pay(s, E.custo)) return { erro: "moedas", falta: E.custo };
    }
    var a = { id: id, c: cid, p: card.p, nv: 0, prog: [], g: {}, t: Date.now(), ov0: ck.d.ov, pago: E.custo || 0 };
    e.ativas.push(a);
    e.usadas[id] = { c: cid, t: a.t };
    U.save();
    U.emit("evolucao-inicio", { s: s, card: card, id: id, evo: E });
    return { ok: true, a: a };
  }
  // desistir: a carta devolve o que ganhou nesta Evolução (volta a ser como era) e ela fica livre de novo
  function desistir(s, cid) {
    var U = I(), e = estado(s), a = e.ativas.filter(function (x) { return x.c === cid; })[0];
    if (!a) return false;
    var card = cartaDe(s, a);
    if (card && card.evo && card.evo.b && !vazio(a.g)) {
      var b = card.evo.b, fe = card.evo.feitas || [];
      ["ov"].concat(ORDER).forEach(function (k) { if (a.g[k]) { b[k] = (b[k] || 0) - a.g[k]; if (!b[k] && k !== "ov") delete b[k]; } });
      if (vazio(b)) delete card.evo.b;
      if (fe.length) { card.evo.id = fe[fe.length - 1]; var E0 = evoPor(card.evo.id); if (E0) card.evo.nv = E0.niveis.length; }
      else { delete card.evo.id; delete card.evo.nv; }
      if (!card.evo.b && !fe.length) delete card.evo;
    }
    e.ativas = e.ativas.filter(function (x) { return x !== a; });
    libera(e, a);
    U.save();
    return true;
  }
  // aplica o ganho do nível atual na carta (card.evo.b) e passa para o próximo nível
  function sobeNivel(s, a, card, E) {
    var U = I(), d = U.cardData(card), N = E.niveis[a.nv];
    var g = capa(E, valores(d), resolve(N.g, d));
    card.evo = card.evo || {};
    var b = card.evo.b || (card.evo.b = {});
    soma(b, g);
    if (b.ov == null) b.ov = 0;
    card.evo.id = E.id;
    card.evo.nv = a.nv + 1;
    a.g = soma(a.g || {}, g);
    a.nv++;
    a.prog = [];
    U.save();
    return g;
  }
  function concluir(s, a, E, card, notas) {
    var U = I(), e = estado(s), d = U.cardData(card);
    e.ativas = e.ativas.filter(function (x) { return x !== a; });
    e.usadas[E.id] = { c: card.i, t: a.t, fim: Date.now() };
    e.feitas.unshift({ id: E.id, c: card.i, p: card.p, nome: d ? d.name : "", gk: ehGk(d), ov0: a.ov0, ov1: d ? d.ov : a.ov0, g: a.g || {}, t0: a.t, t: Date.now() });
    card.evo = card.evo || {};
    card.evo.fim = Date.now();
    card.evo.feitas = (card.evo.feitas || []).concat([E.id]);
    var nts = darPremio(s, premioDe(E, d), "Evolução " + E.n);
    if (notas) {
      notas.push({ ic: "dna", tx: "Evolução " + E.n + " concluída: " + (d ? U.shortNm(d.name) : "a carta") + " foi de " + a.ov0 + " para " + (d ? d.ov : a.ov0) + " de nota", cls: "bom ute-nota" });
      if (nts.length) notas.push({ ic: "gift", cls: "bom ute-nota",
        tx: "Prêmio da Evolução " + E.n + ": " + nts.map(function (n) { return String(n.tx).replace(/^Estilo: /, "Estilo "); }).join(" · ") });
    }
    U.save();
    U.emit("evolucao", { s: s, card: card, id: E.id, evo: E });
    return nts;
  }

  /* ================= fim de partida: progresso, ganhos e notas do resultado ================= */
  function incremento(o, d, res, gols) {
    var t = tipoObj(o, d);
    if (t === "j") return 1;
    if (t === "v") return res.venceu ? 1 : 0;
    if (t === "g") return gols || 0;
    if (t === "cs") return res.ga === 0 ? 1 : 0;
    return 0;
  }
  function aoFimDaPartida(res) {
    var U = I(), s = (res && res.s) || U.st();
    if (!res || !s) return;
    var e = estado(s);
    limpa(s);
    res.notas = res.notas || [];
    if (e.avisos.length) {                               // carta que saiu do clube: avisa aqui mesmo
      e.avisos.forEach(function (tx) { res.notas.push({ ic: "dna", tx: tx, cls: "ute-nota" }); });
      e.avisos = [];
      U.save();
    }
    if (!e.ativas.length) return;
    if (!res.xi || !res.xi.length) return;              // Draft (elenco de fora): não conta
    if (res.wo) { res.notas.push({ ic: "dna", tx: "Partida abandonada não conta para as Evoluções.", cls: "ute-nota" }); return; }
    var m = U.cardMap(s), parados = [], fim = [];
    e.ativas.slice().forEach(function (a) {
      var E = evoPor(a.id), card = m[a.c];
      if (!E || !card) return;
      var d = U.cardData(card);
      if (!d) return;
      var nome = U.shortNm(d.name);
      if (res.xi.indexOf(a.c) < 0) { parados.push(nome); return; }
      var N = E.niveis[a.nv];
      if (!N) return;
      var gols = (res.golsPor || {})[card.p] || 0, andou = false;
      a.prog = a.prog || [];
      N.obj.forEach(function (o, k) {
        var antes = a.prog[k] || 0;
        a.prog[k] = Math.min(o.n, antes + incremento(o, d, res, gols));
        if (a.prog[k] > antes) andou = true;
      });
      var completo = N.obj.every(function (o, k) { return (a.prog[k] || 0) >= o.n; });
      if (!completo) {
        if (andou) res.notas.push({ ic: "dna", cls: "ute-nota",
          tx: "Evolução " + E.n + " · " + nome + ": " + N.obj.map(function (o, k) { return curtoObj(o, d) + " " + (a.prog[k] || 0) + "/" + o.n; }).join(" · ") + " (nível " + (a.nv + 1) + " de " + E.niveis.length + ")" });
        return;
      }
      var g = sobeNivel(s, a, card, E);
      res.notas.push({ ic: "dna", cls: "bom ute-nota",
        tx: "Evolução " + E.n + ": " + nome + " completou o nível " + a.nv + " de " + E.niveis.length + " (" + textoGanho(g, ehGk(d)) + ")" });
      if (a.nv >= E.niveis.length) fim.push({ a: a, E: E, card: card });
    });
    fim.forEach(function (f) { concluir(s, f.a, f.E, f.card, res.notas); });
    if (parados.length) res.notas.push({ ic: "dna", cls: "ute-nota",
      tx: (parados.length > 1 ? "Evoluções paradas: " : "Evolução parada: ") + parados.join(", ") + (parados.length > 1 ? " não começaram jogando" : " não começou jogando") + " (só conta como titular)." });
    U.save();
  }
  I().on("partida", aoFimDaPartida);

  /* ================= consultas para o hub ================= */
  function ativas(s) {
    s = s || I().st();
    if (!s) return [];
    limpa(s);
    return estado(s).ativas.slice();
  }
  function resumo(s) {
    s = s || I().st();
    if (!s) return { ativas: 0, max: MAX_ATIVAS, vagas: MAX_ATIVAS, feitas: 0, disponiveis: EVOS.length };
    var at = ativas(s), e = estado(s);
    return { ativas: at.length, max: MAX_ATIVAS, vagas: Math.max(0, MAX_ATIVAS - at.length), feitas: e.feitas.length,
             disponiveis: EVOS.filter(function (E) { return statusDe(s, E) === "livre"; }).length };
  }

  /* ================= telas ================= */
  function num(v, l) { return el("div", { class: "ute-num" }, [el("b", { text: v }), el("i", { text: l })]); }
  function heroEl(s) {
    var e = estado(s), livres = EVOS.filter(function (E) { return statusDe(s, E) === "livre"; }).length;
    return el("div", { class: "ute-hero" }, [
      el("span", { class: "ute-hero-deco" }, [ic("dna")]),
      el("div", { class: "ute-hero-ic" }, [ic("dna")]),
      el("div", { class: "ute-hero-i" }, [
        el("div", { class: "ute-hero-k", text: "EVOLUÇÕES · TOTAL ULTIMATE" }),
        el("div", { class: "ute-hero-t", text: "Faça suas cartas crescerem" }),
        el("div", { class: "ute-hero-s", text: "Escolha uma carta que cumpre os requisitos e suba a nota dela cumprindo objetivos nas partidas." })
      ]),
      el("div", { class: "ute-hero-nums" }, [
        num(e.ativas.length + "/" + MAX_ATIVAS, "EM ANDAMENTO"),
        num(e.feitas.length, "CONCLUÍDAS"),
        num(livres, "DISPONÍVEIS")
      ])
    ]);
  }
  function regrasEl(vagas) {
    function it(icn, tx) { return el("div", { class: "ute-regra" }, [ic(icn), el("span", { text: tx })]); }
    return el("div", { class: "ute-regras" }, [
      it("layers", "Até " + MAX_ATIVAS + " ao mesmo tempo · " + (vagas > 0 ? plural(vagas, "vaga livre", "vagas livres") : "sem vaga")),
      it("users", "Só conta jogando como titular (Rivais, Batalhas, Champions)"),
      it("lock", "Cada Evolução vale uma vez por clube"),
      it("shield", "Ícone, Herói e emprestado não evoluem")
    ]);
  }
  // linha do tempo dos níveis (catálogo: ganho nominal; prévia: ganho real da carta)
  function niveisEl(E, d, reais) {
    return el("div", { class: "ute-nvs" }, E.niveis.map(function (N, i) {
      return el("div", { class: "ute-nv" }, [
        el("span", { class: "ute-nv-n", text: i + 1 }),
        el("span", { class: "ute-nv-o", text: N.obj.map(function (o) { return textoObj(o, d); }).join(" + ") }),
        el("span", { class: "ute-nv-g", text: reais ? textoGanho(reais[i], ehGk(d)) : textoNominal(N.g, !!E.gk) })
      ]);
    }));
  }
  function custoEl(E) {
    return el("span", { class: "ute-custo" + (E.custo ? " pago" : "") }, E.custo ? [I().coinsEl(E.custo)] : [document.createTextNode("GRÁTIS")]);
  }
  function topoEvo(E) {
    return el("div", { class: "ute-evo-top" }, [
      el("span", { class: "ute-evo-ic" }, [ic(E.ic)]),
      el("div", { class: "ute-evo-i" }, [
        el("div", { class: "ute-evo-n" }, [document.createTextNode(E.n), E.custo ? el("span", { class: "ute-tag prem", text: "PREMIUM" }) : null]),
        el("div", { class: "ute-evo-d", text: E.tx })
      ]),
      custoEl(E)
    ]);
  }
  function reqsEl(E) {
    return el("div", { class: "ute-reqs" }, E.req.map(function (r) { return el("span", { class: "ute-req", text: r.tx }); }));
  }

  // cartão de uma Evolução na aba Disponíveis
  function cartaoEvo(s, E, vagas, irAba) {
    var U = I(), st = statusDe(s, E), cumprem = st === "livre" ? elegiveis(s, E).length : 0;
    var rod = el("div", { class: "ute-evo-rod" }, [
      el("span", {}, [ic("trending-up"), document.createTextNode(" Teto: nota " + E.teto.ov + " · atributos " + E.teto.at)]),
      el("span", {}, [ic("gift"), document.createTextNode(" Prêmio final: " + textoPremio(E, null))])
    ]);
    var acts;
    if (st === "livre") {
      acts = el("div", { class: "ute-evo-acts" }, [
        el("span", { class: "ute-cumprem" + (cumprem ? "" : " zero") }, [el("b", { text: cumprem }), document.createTextNode(cumprem === 1 ? " carta sua cumpre" : " cartas suas cumprem")]),
        el("button", { class: "ut-buy ute-go" + (vagas <= 0 ? " off" : !cumprem ? " ghost" : ""), on: { click: function () {
          if (vagas <= 0) { TM.ui.toast("Você já tem " + MAX_ATIVAS + " Evoluções em andamento. Conclua uma para começar outra.", "alerta"); return; }
          U.goUT("ut-evo-escolha", { id: E.id });
        } } }, [document.createTextNode(cumprem ? "Escolher carta" : "Ver requisitos"), ic("chevron-right")])
      ]);
    } else {
      var a = ativaDe(s, E.id), u = estado(s).usadas[E.id] || {};
      var card = a ? cartaDe(s, a) : null, dd = card ? U.cardData(card) : null;
      var f = st === "feita" ? estado(s).feitas.filter(function (x) { return x.id === E.id; })[0] : null;
      acts = el("div", { class: "ute-evo-acts" }, st === "ativa" ? [
        el("span", { class: "ute-st and" }, [ic("timer"), document.createTextNode(" Em andamento" + (dd ? " com " + U.shortNm(dd.name) : "") + (a ? " · nível " + (a.nv + 1) + " de " + E.niveis.length : ""))]),
        el("button", { class: "ut-buy ute-go", on: { click: function () { irAba("and"); } } }, [document.createTextNode("Ver progresso"), ic("chevron-right")])
      ] : [
        el("span", { class: "ute-st ok" }, [ic("circle-check"), document.createTextNode(" Concluída" + (f && f.nome ? " com " + U.shortNm(f.nome) : "") + (u.fim ? " em " + dataTx(u.fim) : ""))])
      ]);
    }
    return el("div", { class: "ute-evo" + (E.custo ? " premium" : "") + (st !== "livre" ? " " + st : "") }, [
      topoEvo(E), reqsEl(E), niveisEl(E, null, null), rod, acts
    ]);
  }

  function abaDisponiveis(s, box, irAba) {
    var e = estado(s), vagas = MAX_ATIVAS - e.ativas.length;
    box.appendChild(regrasEl(vagas));
    if (vagas <= 0) box.appendChild(el("div", { class: "ut-warn", text: "Você já tem " + MAX_ATIVAS + " Evoluções em andamento. Conclua uma (ou desista) para começar outra." }));
    var ordem = { livre: 0, ativa: 1, feita: 2 };
    var lista = EVOS.map(function (E, i) { return { E: E, i: i, o: ordem[statusDe(s, E)] }; })
      .sort(function (a, b) { return a.o - b.o || a.i - b.i; });
    box.appendChild(el("div", { class: "ute-lista" }, lista.map(function (x) { return cartaoEvo(s, x.E, vagas, irAba); })));
  }

  function barraObj(o, d, v) {
    var pct = Math.max(0, Math.min(100, Math.round(v / o.n * 100)));
    return el("div", { class: "ute-obj" + (v >= o.n ? " ok" : "") }, [
      el("div", { class: "ute-obj-t" }, [
        el("span", {}, [v >= o.n ? ic("circle-check") : null, document.createTextNode((v >= o.n ? " " : "") + textoObj(o, d))]),
        el("b", { text: v + "/" + o.n })
      ]),
      el("div", { class: "ute-bar" }, [el("i", { style: "width:" + pct + "%" })])
    ]);
  }
  function cartaoAndamento(s, a, pinta) {
    var U = I(), E = evoPor(a.id), card = cartaDe(s, a), d = card ? U.cardData(card) : null;
    if (!E || !d) return null;
    var N = E.niveis[a.nv];
    if (!N) return null;
    var gk = ehGk(d), sim = simula(E, d, a.nv), parada = !U.cardMap(s)[a.c];
    var titular = ((s.squad && s.squad.xi) || []).indexOf(a.c) >= 0;
    return el("div", { class: "ute-and" + (E.custo ? " premium" : "") }, [
      el("div", { class: "ute-and-top" }, [
        U.cardEl(d, { cls: "tiny", on: function () { if (!parada) U.showCard(d, s, pinta); } }),
        el("div", { class: "ute-and-i" }, [
          el("div", { class: "ute-and-k" }, [ic(E.ic), document.createTextNode(" " + E.n.toUpperCase())]),
          el("div", { class: "ute-and-n", text: d.name }),
          el("div", { class: "ute-and-ov" }, [document.createTextNode("Nota " + d.ov + " "), ic("arrow-right"), el("b", { class: "ute-up", text: " " + sim.fim.ov }), document.createTextNode(" no fim")]),
          el("div", { class: "ute-segs" }, E.niveis.map(function (x, i) { return el("i", { class: i < a.nv ? "ok" : i === a.nv ? "on" : "" }); })),
          el("div", { class: "ute-and-nv", text: "Nível " + (a.nv + 1) + " de " + E.niveis.length + (titular ? " · titular" : " · fora dos titulares") })
        ])
      ]),
      parada ? el("div", { class: "ut-warn", text: "Está à venda no mercado: a Evolução fica parada até você retirar o anúncio." })
        : (!titular ? el("div", { class: "ute-dica" }, [ic("info"), document.createTextNode(" Escale " + U.shortNm(d.name) + " entre os titulares: só conta quem começa jogando.")]) : null),
      el("div", { class: "ute-objs" }, N.obj.map(function (o, k) { return barraObj(o, d, (a.prog || [])[k] || 0); })),
      el("div", { class: "ute-prox" }, [
        el("span", { text: a.nv + 1 < E.niveis.length ? "Ao concluir o nível " + (a.nv + 1) + ":" : "Último nível — ao concluir:" }),
        el("b", { text: textoGanho(sim.niveis[0], gk) + (a.nv + 1 >= E.niveis.length ? " + " + textoPremio(E, d) : "") })
      ]),
      el("div", { class: "ute-and-rod" }, [
        el("span", { class: "ute-ganhou", text: vazio(a.g) ? "Ainda sem ganhos" : "Já ganhou: " + textoGanho(a.g, gk) }),
        el("button", { class: "ute-desistir", text: "Desistir", on: { click: function () {
          var nm = U.shortNm(d.name);
          TM.ui.confirm("Desistir de " + E.n + "?",
            (vazio(a.g) ? nm + " ainda não ganhou nada nesta Evolução." : nm + " devolve o que ganhou nela (" + textoGanho(a.g, gk) + ") e volta a ter nota " + a.ov0 + ".") +
            " A Evolução volta para as Disponíveis" + (E.custo ? ", mas as " + U.fmtC(E.custo) + " moedas não voltam." : "."),
            "Desistir", function () { desistir(s, a.c); TM.ui.toast("Você desistiu da Evolução " + E.n + ".", "alerta"); pinta(); }, true);
        } } })
      ])
    ]);
  }
  function abaAndamento(s, box, pinta, irAba) {
    var e = estado(s);
    box.appendChild(el("div", { class: "ut-sec-t", text: "Em andamento · " + e.ativas.length + " de " + MAX_ATIVAS + " vagas" }));
    if (!e.ativas.length) {
      box.appendChild(el("div", { class: "ute-vazio" }, [
        el("span", { class: "ute-vazio-ic" }, [ic("dna")]),
        el("b", { text: "Nenhuma Evolução em andamento" }),
        el("span", { text: "Escolha uma Evolução, uma carta do clube e jogue com ela como titular." }),
        el("button", { class: "ut-buy ute-go", on: { click: function () { irAba("disp"); } } }, [document.createTextNode("Ver Disponíveis"), ic("chevron-right")])
      ]));
      return;
    }
    var lista = el("div", { class: "ute-lista" });
    e.ativas.forEach(function (a) { var n = cartaoAndamento(s, a, pinta); if (n) lista.appendChild(n); });
    box.appendChild(lista);
  }
  function abaFeitas(s, box, pinta, irAba) {
    var U = I(), e = estado(s), m = U.cardMap(s);
    box.appendChild(el("div", { class: "ut-sec-t", text: "Concluídas · " + e.feitas.length }));
    if (!e.feitas.length) {
      box.appendChild(el("div", { class: "ute-vazio" }, [
        el("span", { class: "ute-vazio-ic" }, [ic("award")]),
        el("b", { text: "Nenhuma Evolução concluída ainda" }),
        el("span", { text: "Quando uma carta passar pelo último nível, ela aparece aqui com tudo o que ganhou." }),
        el("button", { class: "ut-buy ute-go", on: { click: function () { irAba(e.ativas.length ? "and" : "disp"); } } }, [document.createTextNode(e.ativas.length ? "Ver em andamento" : "Ver Disponíveis"), ic("chevron-right")])
      ]));
      return;
    }
    box.appendChild(el("div", { class: "ute-lista" }, e.feitas.map(function (f) {
      var E = evoPor(f.id), card = m[f.c], d = card ? U.cardData(card) : null;
      return el("div", { class: "ute-feita" + (E && E.custo ? " premium" : "") }, [
        d ? U.cardEl(d, { cls: "tiny", on: function () { U.showCard(d, s, pinta); } })
          : el("div", { class: "ute-feita-sai" }, [ic("user"), el("span", { text: "Saiu do clube" })]),
        el("div", { class: "ute-feita-i" }, [
          el("div", { class: "ute-and-k" }, [ic(E ? E.ic : "dna"), document.createTextNode(" " + (E ? E.n : f.id).toUpperCase())]),
          el("div", { class: "ute-and-n", text: f.nome || "—" }),
          el("div", { class: "ute-and-ov" }, [document.createTextNode("Nota " + f.ov0 + " "), ic("arrow-right"), el("b", { class: "ute-up", text: " " + f.ov1 })]),
          el("div", { class: "ute-feita-g", text: textoGanho(f.g, f.gk) }),
          el("div", { class: "ute-feita-d", text: "Concluída em " + dataTx(f.t) })
        ])
      ]);
    })));
  }

  TM.ui.register("ut-evolucoes", function (screen, params) {
    var U = I(), s = U.st();
    if (!s) { U.goUT("ut"); return; }
    limpa(s);
    var aba = (params && params.aba) || "disp";
    screen.classList.add("ut-screen", "ute-screen");
    screen.appendChild(U.utTop("Evoluções", function () { U.goUT("ut"); }, s));
    var body = el("div", { class: "ut-body" });
    var hero = el("div"), tabs = el("div", { class: "ut-tabs ute-tabs" }), conteudo = el("div", { class: "ute-conteudo" });
    body.appendChild(hero); body.appendChild(tabs); body.appendChild(conteudo);
    screen.appendChild(body);
    function irAba(x) { aba = x; pinta(); }
    function pinta() {
      limpa(s);
      var e = estado(s);
      TM.ui.clear(hero); hero.appendChild(heroEl(s));
      TM.ui.clear(tabs);
      [["disp", "Disponíveis", 0], ["and", "Em andamento", e.ativas.length], ["feitas", "Concluídas", e.feitas.length]].forEach(function (t) {
        tabs.appendChild(el("button", { class: "ut-tab" + (aba === t[0] ? " on" : ""), on: { click: function () { irAba(t[0]); } } }, [
          document.createTextNode(t[1]), t[2] ? el("span", { class: "ute-tab-n", text: t[2] }) : null
        ]));
      });
      TM.ui.clear(conteudo);
      if (aba === "and") abaAndamento(s, conteudo, pinta, irAba);
      else if (aba === "feitas") abaFeitas(s, conteudo, pinta, irAba);
      else abaDisponiveis(s, conteudo, irAba);
      avisar(s);
    }
    pinta();
  });

  /* ---------- escolher a carta: elegíveis → prévia antes/depois → confirmar ---------- */
  TM.ui.register("ut-evo-escolha", function (screen, params) {
    var U = I(), s = U.st();
    if (!s) { U.goUT("ut"); return; }
    var E = evoPor(params && params.id);
    if (!E) { U.goUT("ut-evolucoes"); return; }
    limpa(s);
    screen.classList.add("ut-screen", "ute-screen");
    screen.appendChild(U.utTop(E.n, function () { U.goUT("ut-evolucoes"); }, s));
    var body = el("div", { class: "ut-body" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "ute-evo ute-esc-h" + (E.custo ? " premium" : "") }, [
      topoEvo(E), reqsEl(E), niveisEl(E, null, null),
      el("div", { class: "ute-evo-rod" }, [
        el("span", {}, [ic("trending-up"), document.createTextNode(" Teto: nota " + E.teto.ov + " · atributos " + E.teto.at)]),
        el("span", {}, [ic("gift"), document.createTextNode(" Prêmio final: " + textoPremio(E, null))])
      ])
    ]));
    var st = statusDe(s, E), e = estado(s);
    if (st !== "livre") {
      body.appendChild(el("div", { class: "ut-warn", text: st === "feita" ? "Você já concluiu esta Evolução neste clube." : "Esta Evolução já está em andamento." }));
      body.appendChild(TM.ui.button("Ver minhas Evoluções", function () { U.goUT("ut-evolucoes", { aba: st === "feita" ? "feitas" : "and" }); }, "btn primary wide"));
      return;
    }
    if (e.ativas.length >= MAX_ATIVAS) body.appendChild(el("div", { class: "ut-warn", text: "Você já tem " + MAX_ATIVAS + " Evoluções em andamento. Conclua uma para começar esta." }));
    var lista = elegiveis(s, E), xi = (s.squad && s.squad.xi) || [];
    body.appendChild(el("div", { class: "ut-sec-t", text: "Escolha a carta · " + (!lista.length ? "nenhuma cumpre" : lista.length === 1 ? "1 cumpre" : lista.length + " cumprem") }));
    if (!lista.length) {
      body.appendChild(el("div", { class: "ute-vazio" }, [
        el("span", { class: "ute-vazio-ic" }, [ic("user-search")]),
        el("b", { text: "Nenhuma carta do seu clube cumpre os requisitos" }),
        el("span", { text: "Abra pacotes ou compre no mercado uma carta que encaixe. Ícone, Herói e emprestado não entram." })
      ]));
    } else {
      body.appendChild(el("div", { class: "ute-dica" }, [ic("info"), document.createTextNode(" Toque na carta para ver como ela fica no fim. Só conta jogando como titular.")]));
      body.appendChild(el("div", { class: "ute-grade" }, lista.map(function (d) {
        var sim = simula(E, d, 0);
        return el("div", { class: "ute-op" }, [
          U.cardEl(d, { cls: "tiny", on: function () { previa(s, E, d); } }),
          el("div", { class: "ute-op-ov" }, [el("span", { text: d.ov }), ic("arrow-right"), el("b", { text: sim.fim.ov })]),
          xi.indexOf(d.card.i) >= 0 ? el("span", { class: "ute-op-tit", text: "TITULAR" }) : null
        ]);
      })));
    }
    // quase lá: cartas do perfil certo que falham em um requisito só (nota alta, já em outra Evolução...)
    var dePerfil = E.req.filter(function (r) { return r.perfil; }).map(function (r) { return r.tx; });
    var reqTx = E.req.map(function (r) { return r.tx; });
    var quase = (s.cards || []).map(function (c) { return checa(s, E, c); })
      .filter(function (x) { return !x.ok && x.d && x.falhas.length === 1 && dePerfil.indexOf(x.falhas[0]) < 0; })
      .sort(function (a, b) { return b.d.ov - a.d.ov; }).slice(0, 8);
    if (quase.length) {
      body.appendChild(el("div", { class: "ut-sec-t", text: "Quase lá · falta um requisito" }));
      body.appendChild(el("div", { class: "ute-quase" }, quase.map(function (x) {
        return el("div", { class: "ute-quase-l" }, [
          U.cardEl(x.d, { cls: "mini" }),
          el("div", { class: "ute-quase-i" }, [el("b", { text: x.d.name }), el("span", { text: (reqTx.indexOf(x.falhas[0]) >= 0 ? "Não cumpre: " : "") + x.falhas[0] })])
        ]);
      })));
    }
  });

  function previa(s, E, d) {
    var U = I(), sim = simula(E, d, 0), gk = ehGk(d);
    var depois = U.cardData(cartaPrevia(d.card, sim.total));
    if (!depois) return;
    var antes = U.statsOf(d), dep = U.statsOf(depois), vagas = MAX_ATIVAS - estado(s).ativas.length;
    var overlay = el("div", { class: "ut-sheet ute-sheet" });
    function fecha() { overlay.classList.remove("show"); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200); }
    function tag(tx, cls) { return el("span", { class: "ute-tagx" + (cls ? " " + cls : ""), text: tx }); }
    function comecar() {
      var r = iniciar(s, E.id, d.card.i);
      if (r.erro === "moedas") { fecha(); U.faltaMoedas(s, E.custo); return; }
      if (r.erro) { TM.ui.toast(r.erro, "erro"); return; }
      fecha();
      TM.ui.toast("Evolução " + E.n + " começou com " + U.shortNm(d.name) + "!", "ok");
      U.goUT("ut-evolucoes", { aba: "and" });
    }
    var rotulo = vagas <= 0 ? MAX_ATIVAS + " Evoluções em andamento" : E.custo ? "Pagar " + U.fmtC(E.custo) + " e começar" : "Começar Evolução";
    var bt = el("button", { class: "btn primary wide ute-comecar" + (vagas <= 0 ? " off" : ""), text: rotulo, on: { click: function () {
      if (vagas <= 0) { TM.ui.toast("Você já tem " + MAX_ATIVAS + " Evoluções em andamento. Conclua uma para começar outra.", "alerta"); return; }
      if (E.custo) {
        if ((s.coins || 0) < E.custo) { fecha(); U.faltaMoedas(s, E.custo); return; }
        TM.ui.confirm("Pagar " + U.fmtC(E.custo) + " moedas?", "A Evolução " + E.n + " começa agora com " + d.name + ". O valor não volta se você desistir ou se a carta sair do clube.", "Pagar e começar", comecar);
        return;
      }
      comecar();
    } } });
    var inner = el("div", { class: "ut-sheet-in ute-prev" + (E.custo ? " premium" : "") }, [
      el("div", { class: "ut-sheet-h" }, [
        el("span", { class: "ute-prev-t" }, [ic(E.ic), document.createTextNode(" " + E.n + " · " + U.shortNm(d.name))]),
        el("button", { class: "ut-x", text: "✕", "aria-label": "Fechar", on: { click: fecha } })
      ]),
      el("div", { class: "ute-ad" }, [
        el("div", { class: "ute-ad-c" }, [el("div", { class: "ute-ad-l", text: "ANTES" }), U.cardEl(d, { cls: "big" })]),
        el("div", { class: "ute-ad-seta" }, [ic("chevron-right")]),
        el("div", { class: "ute-ad-c dep" }, [el("div", { class: "ute-ad-l", text: "DEPOIS" }), U.cardEl(depois, { cls: "big" })])
      ]),
      el("div", { class: "ute-ad-tags" }, [
        tag("Nota " + d.ov + " → " + depois.ov, "nota"),
        d.rar !== depois.rar ? tag(U.RAR_NAME[d.rar] + " → " + U.RAR_NAME[depois.rar], "rar") : null,
        tag(plural(E.niveis.length, "nível", "níveis")),
        tag(E.custo ? U.fmtC(E.custo) + " moedas" : "Grátis", E.custo ? "pago" : "")
      ]),
      el("div", { class: "ute-ad-attrs" }, antes.map(function (x, i) {
        var y = dep[i], dif = y.v - x.v;
        return el("div", { class: "ute-at" + (dif ? " up" : "") }, [
          el("i", { text: x.l }),
          el("div", { class: "ute-at-bar" }, [
            el("span", { class: "base", style: "width:" + x.v + "%" }),
            dif ? el("span", { class: "add", style: "left:" + x.v + "%;width:" + dif + "%" }) : null
          ]),
          el("b", { text: y.v }),
          el("em", { text: dif ? "+" + dif : "" })
        ]);
      })),
      el("div", { class: "ut-sec-t", text: "Níveis desta carta" }),
      niveisEl(E, d, sim.niveis),
      el("div", { class: "ute-prev-nota", text: "Os ganhos entram nível a nível, quando você cumpre os objetivos jogando com ela como titular. Prêmio final: " + textoPremio(E, d) + ". Teto desta Evolução: nota " + E.teto.ov + " e atributos " + E.teto.at + "." }),
      bt
    ]);
    overlay.appendChild(inner);
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) fecha(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("show"); });
  }

  /* ================= API ================= */
  TM.utEvo = {
    _ok: true, MAX_ATIVAS: MAX_ATIVAS, EVOS: EVOS,
    lista: function () { return EVOS.slice(); }, evo: evoPor,
    ativas: ativas, resumo: resumo, status: function (s, id) { var E = evoPor(id); return E && s ? statusDe(s, E) : null; },
    feitas: function (s) { s = s || I().st(); return s ? estado(s).feitas.slice() : []; },
    elegiveis: elegiveis, checa: function (s, id, card) { var E = evoPor(id); return E ? checa(s, E, card) : { ok: false, falhas: ["Evolução não encontrada"] }; },
    // a carta está numa Evolução em andamento? (para DME/mercado avisarem antes de consumir ou vender)
    emEvolucao: function (s, cid) { s = s || I().st(); return !!s && emAtiva(s, cid); },
    iniciar: iniciar, desistir: desistir, limpa: limpa, aoFimDaPartida: aoFimDaPartida,
    simula: function (id, d, desde) { var E = evoPor(id); return E && d ? simula(E, d, desde) : null; },
    textoGanho: textoGanho
  };
})(window);
