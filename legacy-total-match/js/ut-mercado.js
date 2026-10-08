/* ================= TOTAL ULTIMATE — MERCADO DE TRANSFERÊNCIAS =================
   O mercado no jeito do Ultimate Team do EA FC: leilão com lances (as moedas
   ficam reservadas), compre já, lista de observação, lista de transferências
   (as minhas vendas) e busca com filtros. Carregado DEPOIS de js/ultimate.js:
   registrar a rota "ut-market" aqui substitui a tela antiga do núcleo.

   Como o mercado anda
   - Os anúncios chegam em LOTES por hora, gerados por semente (clube + hora):
     parte chega na virada da hora e o resto pinga ao longo dela. Cada anúncio
     tem vendedor fictício, carta (jogador + versão), lance inicial, compre já e
     hora de término (de 5 min a 3 h). O lote não vai para o save: ele é refeito
     igual a partir da semente. Só o que o técnico mexeu (observar, dar lance)
     fica guardado, com uma cópia do anúncio.
   - Os outros técnicos (a IA) passam pelo anúncio em instantes sorteados, mais
     perto do fim. Cada anúncio tem um teto (perto do preço justo): a IA dá lance
     se o próximo lance cabe nele, com mais vontade quando está barato e no fim.
     Compre já abaixo do teto é comprado por alguém em minutos (o anúncio some).
   - Tudo é determinístico (semente do clube + id do anúncio + nº do lance): sair
     e voltar não sorteia de novo. O tempo anda pelo Date.now() sempre que a tela
     abre, e a cada segundo com ela aberta.
   - Incremento mínimo igual ao do FC: até 1.000 +50, até 10.000 +100, até 50.000
     +250, até 100.000 +500, acima +1.000. Taxa de 5% na venda. Faixa de preço por
     carta: de 50% a 300% do preço justo.

   Estado (dentro de s.mkt; `day` e `buy` são do mercado antigo e ficam como estão)
     sell: minha lista de transferências, formato v3:
           { v:3, id, card, ini, bin, t0, fim, dur, j, teto, tb, sold, st, preco, modo, exp, n, lance }
           SEM o campo `t` de propósito: o tickSales antigo do núcleo só vende quem tem `t`.
           `sold` (vendido e ainda não recebido) continua valendo para quem conta vendas.
     obs:  { id: { a: cópia do anúncio, t, E: estado do leilão depois do meu 1º lance } }
     won:  [{ id, card, preco, t, o }] itens ganhos (leilão ou compre já) esperando destino
     comp: { id: quando } anúncios que eu levei (somem da busca)
     hist: [{ t, k:"c"|"v", p, v, preco, o }] últimas transações
   Carta nunca fica em dois lugares: ou está em s.cards, ou num anúncio, ou num item ganho. */
(function (global) {
  "use strict";
  var TM = global.TM;
  if (!TM || !TM.ui || !TM.ut || !TM.ut._i) return;
  var el = TM.ui.el;
  function U() { return TM.ut._i; }
  function ic(n, cls) { return TM.ic ? TM.ic(n, cls) : document.createTextNode(""); }
  function agora() { return Date.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtC(n) { return U().fmtC(n); }
  function toast(m, t) { TM.ui.toast(m, t); }

  /* ================= números do mercado ================= */
  var MIN = 60000, HORA = 3600000;
  var TAXA = 0.05;
  var LIM_OBS = 50, LIM_LISTA = 100;               // os limites do FC (alvos e lista de transferências)
  var PRECO_MIN_INI = 150, PRECO_MIN_BIN = 200;
  var FAIXA_MIN = 0.5, FAIXA_MAX = 3;              // faixa de preço da carta (sobre o preço justo)
  var DURACOES = [[10 * MIN, "10 min"], [HORA, "1 h"], [3 * HORA, "3 h"], [6 * HORA, "6 h"], [12 * HORA, "12 h"], [24 * HORA, "24 h"]];
  // faixas de nota de cada lote (até 86 no mercado comum, como antes; especiais podem passar)
  var BANDAS = [[45, 64, 15], [65, 74, 21], [75, 79, 19], [80, 83, 12], [84, 86, 5]];
  // duração dos anúncios dos outros técnicos (minutos, peso): de 5 min a 3 h
  var DUR_MERC = [[5, 8], [10, 9], [15, 9], [20, 8], [30, 12], [45, 10], [60, 14], [90, 10], [120, 10], [180, 10]];

  // incremento mínimo do lance (tabela do FC) e a grade de preços válidos
  function passo(v) { return v < 1000 ? 50 : v < 10000 ? 100 : v < 50000 ? 250 : v < 100000 ? 500 : 1000; }
  function acima(v) { return v + passo(v); }                      // próximo preço válido
  function abaixo(v) { return Math.max(0, v - passo(v - 1)); }     // preço válido logo abaixo
  function arred(v) { v = Math.max(0, v); var p = passo(v); return Math.round(v / p) * p; }
  function arredBaixo(v) { v = Math.max(0, v); var p = passo(v); return Math.floor(v / p) * p; }
  function arredCima(v) { v = Math.max(0, v); var p = passo(v); return Math.ceil(v / p) * p; }
  function liquido(v) { return Math.round(v * (1 - TAXA)); }
  // quanto vender para não perder dinheiro (com a taxa)
  function empate(pago) { return arredCima(pago / (1 - TAXA)); }

  function rndDe(chave) { var I = U(); return I.mulberry(I.hashStr(chave)); }
  function seedDe(s) { return (s && s.seed) || 1; }
  function edicao() { try { return TM.storage.edition(); } catch (e) { return ""; } }
  function norm(t) {
    t = String(t || "").toLowerCase();
    try { t = t.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) {}
    return t;
  }
  function fmtTempo(ms) {
    if (ms <= 0) return "0:00";
    var t = Math.ceil(ms / 1000);
    if (t < 3600) return Math.floor(t / 60) + ":" + pad(t % 60);
    return Math.floor(t / 3600) + "h" + pad(Math.floor((t % 3600) / 60));
  }
  function clsTempo(ms) { return ms <= MIN ? "crit" : ms <= 5 * MIN ? "quase" : ""; }
  function fmtPct(x) { return (Math.round(x * 1000) / 10).toFixed(1).replace(".", ",") + "%"; }
  function rotDur(ms) { for (var i = 0; i < DURACOES.length; i++) if (DURACOES[i][0] === ms) return DURACOES[i][1]; return Math.round(ms / HORA) + " h"; }

  /* ================= preço justo, faixa e tendência ================= */
  function justo(d) { return U().basePrice(d.ov, d.ver); }
  function faixa(d) {
    var j = justo(d);
    var mn = Math.max(PRECO_MIN_INI, arredCima(j * FAIXA_MIN));
    var mx = Math.max(acima(acima(mn)), arredBaixo(j * FAIXA_MAX));
    return { min: mn, max: mx, justo: j };
  }
  // preço médio dos últimos 7 dias: passeio por semente que termina no preço justo de hoje
  function tendencia(d) {
    var j = justo(d), rnd = rndDe("utk-tend:" + d.p.id + ":" + d.ver + ":" + U().today());
    var k = j < 1000 ? 0.35 : j < 10000 ? 0.75 : 1;          // carta barata quase não mexe (fica no piso)
    var drift = (rnd() - 0.5) * 0.06 * k, pts = [j];
    for (var i = 1; i < 7; i++) pts.unshift(Math.max(PRECO_MIN_INI, pts[0] * (1 - drift + (rnd() - 0.5) * 0.07 * k)));
    return pts.map(function (v) { return Math.round(v); });
  }
  // "comparar preço": os menores compre já desta carta agora (os do mercado + a referência da hora)
  function comparaveis(s, d, now) {
    var j = justo(d), out = [];
    mercado(s, now).forEach(function (A) { if (A.p === d.p.id && A.v === d.ver) out.push(A.bin); });
    var rnd = rndDe("utk-cmp:" + d.p.id + ":" + d.ver + ":" + Math.floor(now / HORA) + ":" + seedDe(s));
    var n = 3 + Math.floor(rnd() * 3);
    for (var i = 0; i < n; i++) out.push(Math.max(PRECO_MIN_BIN, arred(j * (0.93 + rnd() * 0.3))));
    out.sort(function (a, b) { return a - b; });
    return out.filter(function (v, k) { return out.indexOf(v) === k; }).slice(0, 4);
  }
  function estimativa(ini, bin, j) {
    var r = bin / Math.max(1, j);
    var tx = r <= 0.85 ? "Compre já abaixo do mercado: deve sair em instantes."
      : r <= 1.0 ? "Compre já no preço de mercado: deve vender em poucos minutos."
      : r <= 1.05 ? "Compre já perto do mercado: deve vender logo."
      : r <= 1.15 ? "Compre já um pouco acima: pode levar uma hora ou mais."
      : r <= 1.25 ? "Compre já acima do mercado: pode levar horas."
      : r <= 1.4 ? "Compre já caro: dificilmente sai por ele." : "Compre já muito caro: ninguém paga; só o leilão anda.";
    var cls = r <= 1.05 ? "bom" : r <= 1.3 ? "medio" : "ruim";
    var leilao = ini > j * 1.05 ? "Lance inicial acima do que os técnicos pagam: o leilão deve ficar sem lances."
      : "No leilão, os lances costumam fechar entre " + fmtC(arred(j * 0.85)) + " e " + fmtC(arred(j * 1.05)) + ".";
    return { tx: tx, cls: cls, leilao: leilao };
  }

  /* ================= os lotes de anúncios ================= */
  var NOMES = ["Rafa", "Dudu", "Biel", "Leo", "Caio", "Teco", "Juca", "Nando", "Vini", "Gabs", "Mari", "Bia", "Duda", "Lari", "Tati",
               "Zeca", "Guto", "Lipe", "Fefe", "Nina", "Carol", "Manu", "Thi", "Gui", "Rods", "Lu", "Dani", "Paulinho", "Nico", "Bruna"];
  var SUFIXOS = ["FC", "Trader", "Ultimate", "Mister", "Boleiro", "Tatico", "Varzea", "Craque", "Coach", "Gol", "Raiz", "Mercado"];
  function vendedor(rnd) {
    var a = NOMES[Math.floor(rnd() * NOMES.length)], b = SUFIXOS[Math.floor(rnd() * SUFIXOS.length)];
    return a + "_" + b + (rnd() < 0.55 ? String(1 + Math.floor(rnd() * 98)) : "");
  }
  function sorteiaDur(rnd) {
    var tot = 0, i; for (i = 0; i < DUR_MERC.length; i++) tot += DUR_MERC[i][1];
    var r = rnd() * tot;
    for (i = 0; i < DUR_MERC.length; i++) { r -= DUR_MERC[i][1]; if (r < 0) return DUR_MERC[i][0]; }
    return 60;
  }
  function montaAnuncio(I, p, rnd, H, idx) {
    var ver = rnd() < 0.14 ? "rare" : "base";
    var esp = I.sorteiaVersao(p, rnd, 0.9);            // especiais: raras, com os requisitos de cada versão
    if (esp) ver = esp;
    else if (I.isTotw(p.id) && rnd() < 0.35) ver = "totw";
    var ov = clamp(p.overall + I.verBonus(ver), 1, 99);
    var j = I.basePrice(ov, ver);
    // pedida do vendedor: algumas pechinchas (somem rápido), a maioria no mercado, várias caras
    var r = rnd(), f;
    if (r < 0.13) f = 0.74 + rnd() * 0.16;
    else if (r < 0.62) f = 0.95 + rnd() * 0.2;
    else f = 1.15 + rnd() * 0.45;
    if (ov >= 84) f *= 1.12; else if (ov >= 80) f *= 1.05;   // carta boa: pedem mais
    var bin = Math.max(PRECO_MIN_BIN, arred(j * f));
    var ini = Math.max(PRECO_MIN_INI, Math.min(arred(j * (0.32 + rnd() * 0.45)), abaixo(bin)));
    var teto = j * (0.8 + rnd() * 0.28);                // até onde os outros técnicos vão neste leilão
    var dur = sorteiaDur(rnd) * MIN;
    // 40% chega na virada da hora (o lote novo); o resto pinga ao longo dela
    var t0 = H * HORA + Math.floor(rnd() < 0.4 ? rnd() * 2 * MIN : rnd() * HORA);
    var fim = t0 + dur, tc = 0, rc = rnd();
    // compre já abaixo do teto: alguém compra em minutos; no preço justo, às vezes
    if (bin <= teto) tc = t0 + Math.round((0.6 + rc * 11) * MIN);
    else if (bin <= j * 1.02 && rc < 0.35) tc = t0 + Math.round((5 + rnd() * 90) * MIN);
    if (tc >= fim) tc = 0;
    var vend = vendedor(rnd), ri = rnd();
    var it = ri < 0.18 ? 0.3 : ri < 0.82 ? 1 : 1.3;     // interesse: frio (pechincha possível), normal, disputado
    return { id: "m" + H + "_" + idx, p: p.id, v: ver, vend: vend, ini: ini, bin: bin, t0: t0, fim: fim, j: j,
             teto: Math.round(Math.min(teto, abaixo(bin))), tc: tc, it: it };
  }
  var _lotes = {}, _nLotes = 0;
  function lote(s, H) {
    var k = H + ":" + seedDe(s) + ":" + edicao();
    if (_lotes[k]) return _lotes[k];
    if (++_nLotes > 30) { _lotes = {}; _nLotes = 1; }
    var I = U(), rnd = rndDe("utk-lote:" + H + ":" + seedDe(s)), out = [];
    if (I.pool().length) {
      BANDAS.forEach(function (b) {
        for (var i = 0; i < b[2]; i++) {
          var p = I.drawPlayer(b[0], b[1], rnd);
          if (p) out.push(montaAnuncio(I, p, rnd, H, out.length));
        }
      });
    }
    _lotes[k] = out;
    return out;
  }
  // o que está no ar agora (lotes das últimas horas que ainda não acabaram)
  function mercado(s, now) {
    var H = Math.floor(now / HORA), out = [], comp = (s.mkt && s.mkt.comp) || {};
    for (var h = H - 3; h <= H; h++) {
      lote(s, h).forEach(function (A) {
        if (A.t0 > now || A.fim <= now) return;
        if (A.tc && A.tc <= now) return;
        if (comp[A.id]) return;
        out.push(A);
      });
    }
    return out;
  }
  // a carta do anúncio (cardData de uma carta "de vitrine")
  var _dados = {};
  function dadosAnuncio(A) {
    var k = A.id + ":" + A.p + ":" + A.v + ":" + edicao();
    if (_dados[k] !== undefined) return _dados[k];
    var I = U(), p = TM.data.player(A.p), d = null;
    if (p) d = I.cardData({ i: "utk_" + A.id, p: A.p, v: A.v, r: I.rarOf(clamp(p.overall + I.verBonus(A.v), 1, 99)), ut: 0 });
    _dados[k] = d;
    return d;
  }
  function snap(A) {
    return { id: A.id, p: A.p, v: A.v, vend: A.vend, ini: A.ini, bin: A.bin, t0: A.t0, fim: A.fim, j: A.j, teto: A.teto, tc: A.tc || 0, it: A.it || 1 };
  }

  /* ================= o leilão (a IA) ================= */
  // instantes em que algum técnico da IA olha o anúncio (concentrados perto do fim)
  var _vis = {}, _nVis = 0;
  function visitas(s, A) {
    var k = A.id + ":" + seedDe(s);
    if (_vis[k]) return _vis[k];
    if (++_nVis > 4000) { _vis = {}; _nVis = 1; }
    var rnd = rndDe("utk-vis:" + k), D = Math.max(MIN, A.fim - A.t0);
    var n = Math.max(2, Math.round((5 + Math.min(16, D / HORA * 3) + rnd() * 6) * (A.it || 1))), v = [];
    for (var i = 0; i < n; i++) {
      var t = A.fim - D * Math.pow(rnd(), 2.3);
      v.push({ t: Math.round(Math.min(t, A.fim - 1)), r1: rnd(), r2: rnd(), r3: rnd() });
    }
    v.sort(function (a, b) { return a.t - b.t; });
    _vis[k] = v;
    return v;
  }
  function minLance(A, E) { return E.n ? acima(E.lance) : A.ini; }
  function maxLance(A) { return abaixo(A.bin); }
  // um técnico da IA decide se cobre: só até o teto; mais provável barato e no fim
  function lanceIA(A, E, r1, r2, r3, t, reacao) {
    var prox = minLance(A, E);
    if (prox > A.teto || prox >= A.bin) return 0;
    var rem = A.fim - t, ratio = prox / Math.max(1, A.j), fimPerto = rem < 2 * MIN;
    var p = 0.42 + (1 - ratio) * 0.75;
    if (rem < 10 * MIN) p += 0.12;
    if (fimPerto) p += 0.15;
    p *= Math.min(1.15, A.it || 1);
    if (reacao) p = E.quem === "eu" ? p * 0.85 : 0;
    if (r1 >= clamp(p, 0.05, 0.95)) return 0;
    var v = prox, folga = A.teto - prox;
    // no fim a disputa esquenta: o lance pula para perto do teto
    if (r2 < (fimPerto ? 0.75 : 0.45) && folga > 2 * passo(prox)) v = Math.max(prox, arredBaixo(prox + folga * (fimPerto ? 0.45 + r3 * 0.5 : 0.1 + r3 * 0.4)));
    if (v >= A.bin) v = abaixo(A.bin);
    return v >= prox ? v : 0;
  }
  // anda o leilão até `ate`: visitas da IA, a reação ao meu lance e o compre já de outro técnico
  function simula(s, A, E, ate) {
    if (E.f || E.comprado) return E;
    var vis = visitas(s, A), lim = Math.min(ate, A.fim);
    for (var g = 0; g < 600; g++) {
      var tv = E.vi < vis.length ? vis[E.vi].t : Infinity;
      var tr = E.rx || Infinity, tc = A.tc || Infinity;
      var t = Math.min(tv, tr, tc);
      if (t > lim || t >= A.fim) break;
      if (t === tc) { E.comprado = tc; E.quem = "outro"; break; }
      var r1, r2, r3, reac = false;
      if (t === tr) {
        var rr = rndDe("utk-rx:" + A.id + ":" + E.rxn + ":" + seedDe(s));
        r1 = rr(); r2 = rr(); r3 = rr(); E.rx = 0; reac = true;
        if (!(E.quem === "eu" && E.n === E.rxn)) continue;
      } else { var vv = vis[E.vi]; E.vi++; r1 = vv.r1; r2 = vv.r2; r3 = vv.r3; }
      var x = lanceIA(A, E, r1, r2, r3, t, reac);
      if (x) { E.lance = x; E.n++; E.quem = "ia"; E.tu = t; }
    }
    return E;
  }
  function estadoBase(s, A, now) { return simula(s, A, { lance: 0, n: 0, quem: null, vi: 0, rx: 0 }, now); }
  // estado para mostrar: o guardado (se dei lance) ou o caminho da IA até agora
  function estadoDe(s, A, now) {
    var M = s.mkt, o = M.obs[A.id];
    if (o && o.E) return o.E;
    if (M.comp[A.id]) return { lance: 0, n: 0, quem: null, meu: 1, levei: 1 };
    return estadoBase(s, A, now);
  }
  // ativo · ganhando · superado · venci · perdi · encerrado · vendido · meu
  function situacao(s, A, E, now) {
    if (E.levei || s.mkt.comp[A.id]) return "meu";
    if (E.comprado) return E.meu ? "perdi" : "vendido";
    if (E.f || now >= A.fim) return E.quem === "eu" ? "venci" : (E.meu ? "perdi" : "encerrado");
    if (E.quem === "eu") return "ganhando";
    if (E.meu) return "superado";
    return "ativo";
  }
  function emAndamento(sit) { return sit === "ativo" || sit === "ganhando" || sit === "superado"; }
  var ROT = { ganhando: "Ganhando", superado: "Superado", venci: "Vencido", perdi: "Perdido", encerrado: "Encerrado", vendido: "Vendido", meu: "Comprado" };

  /* ================= minhas vendas (a IA compra) ================= */
  // teto dos compradores e a hora do compre já, fixos pelo id do anúncio
  function iaVenda(s, L) {
    var r = rndDe("utk-venda:" + L.id + ":" + seedDe(s));
    var W = L.j * (0.85 + r() * 0.2);
    L.teto = Math.round(W);
    var q = L.bin / Math.max(1, L.j);
    // compre já perto do justo vende rápido; caro demora ou não sai (minutos, média)
    var media = q <= 0.85 ? 1.5 : q <= 1.0 ? 5 : q <= 1.05 ? 12 : q <= 1.15 ? 60 : q <= 1.25 ? 240 : q <= 1.4 ? 900 : 0;
    if (L.bin <= W) media = Math.min(media || 4, 4);
    var tb = media ? L.t0 + Math.round(-Math.log(1 - r() * 0.999) * media * MIN) : 0;   // acima de 1,4x ninguém paga o compre já
    L.tb = tb && tb < L.fim ? tb : 0;
  }
  // estado de um anúncio meu em `ate` (função pura: lances da IA, compre já e o fim)
  function simulaVenda(s, L, ate) {
    var vis = visitas(s, L), E = { lance: 0, n: 0 }, lim = Math.min(ate, L.fim);
    for (var i = 0; i < vis.length; i++) {
      var v = vis[i];
      if (v.t > lim || v.t >= L.fim) break;
      if (L.tb && L.tb <= v.t) break;
      var x = lanceIA(L, E, v.r1, v.r2, v.r3, v.t, false);
      if (x) { E.lance = x; E.n++; }
    }
    if (L.tb && L.tb <= lim) return { sold: 1, preco: L.bin, st: L.tb, n: E.n, lance: E.lance, modo: "bin" };
    if (ate >= L.fim) return E.n ? { sold: 1, preco: E.lance, st: L.fim, n: E.n, lance: E.lance, modo: "lance" } : { exp: 1, n: 0, lance: 0 };
    return { n: E.n, lance: E.lance };
  }

  /* ================= estado salvo ================= */
  var _seq = 0;
  function novoId(pre) { return pre + agora().toString(36) + (_seq++).toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  // anúncio do formato antigo ({ card, bin, t, sold, st }): vira v3 sem perder a carta nem o preço
  function converteAntigo(s, L, now) {
    var d = null; try { d = U().cardData(L.card); } catch (e) {}
    var j = d ? justo(d) : Math.max(PRECO_MIN_BIN, L.bin || 1000);
    var bin = Math.max(PRECO_MIN_BIN, arred(L.bin || j));
    var t0 = L.t || now;
    L.v = 3; L.id = novoId("L"); L.ant = 1;
    L.bin = bin; L.ini = Math.max(PRECO_MIN_INI, abaixo(bin));   // era só compre já: o leilão começa logo abaixo
    L.t0 = t0; L.dur = 24 * HORA; L.fim = Math.max(t0 + L.dur, now + HORA);
    L.j = j; L.n = 0; L.lance = 0;
    delete L.t;
    if (L.sold) { L.preco = L.preco || bin; L.st = L.st || now; L.modo = "bin"; }
    else iaVenda(s, L);
  }
  function prepara(s) {
    if (!s) return;
    if (!s.mkt || typeof s.mkt !== "object") s.mkt = { day: -1, buy: [], sell: [] };
    var M = s.mkt, mudou = false, now = agora();
    if (!Array.isArray(M.sell)) { M.sell = []; mudou = true; }
    if (!M.obs || typeof M.obs !== "object" || Array.isArray(M.obs)) { M.obs = {}; mudou = true; }
    if (!Array.isArray(M.won)) { M.won = []; mudou = true; }
    if (!M.comp || typeof M.comp !== "object") { M.comp = {}; mudou = true; }
    if (!Array.isArray(M.hist)) { M.hist = []; mudou = true; }
    if (!s.stats) s.stats = {};
    // uma carta, um lugar: se a mesma carta está no clube e num anúncio/item ganho, fica no clube
    var onde = {};
    (s.cards || []).forEach(function (c) { if (c && c.i) onde[c.i] = 1; });
    M.sell = M.sell.filter(function (L) {
      if (!L || !L.card || !L.card.i || onde[L.card.i]) { mudou = true; return false; }
      onde[L.card.i] = 1;
      if (L.v !== 3) { converteAntigo(s, L, now); mudou = true; }
      else if (L.t != null) { delete L.t; mudou = true; }
      return true;
    });
    M.won = M.won.filter(function (w) {
      if (!w || !w.card || !w.card.i || onde[w.card.i]) { mudou = true; return false; }
      onde[w.card.i] = 1; return true;
    });
    if (mudou) U().save();
  }
  function historico(s, h) {
    h.t = h.t || agora();
    s.mkt.hist.unshift(h);
    if (s.mkt.hist.length > 30) s.mkt.hist.length = 30;
  }
  // a carta comprada (compre já) ou vencida (leilão) vai para os itens ganhos
  function ganha(s, A, preco, origem) {
    var I = U(), p = TM.data.player(A.p);
    if (!p) return null;
    var c = I.mkCard(p, A.v);
    c.ut = 0;                                   // comprada: sem lealdade
    var w = { id: A.id, card: c, preco: preco, t: agora(), o: origem };
    s.mkt.won.push(w);
    s.mkt.comp[A.id] = agora();
    s.stats.bought = (s.stats.bought || 0) + 1;
    historico(s, { k: "c", p: A.p, v: A.v, preco: preco, o: origem });
    I.save();
    I.emit("compra", { s: s, card: c, preco: preco, origem: origem });
    return w;
  }
  function avancaLeilao(s, o, now, evs) {
    var E = o.E, A = o.a, antes = E.quem, res = E.res || 0, n0 = E.n, avisou = false;
    simula(s, A, E, now);
    var mudou = E.n !== n0 || !!E.comprado;
    if (antes === "eu" && E.quem !== "eu") {        // cobriram (ou alguém levou no compre já): as moedas voltam
      if (res) { s.coins = Math.round((s.coins || 0) + res); E.res = 0; }
      evs.push({ k: E.comprado ? "outro" : "superado", p: A.p, v: res });
      avisou = true; mudou = true;
    }
    if (!E.f && (E.comprado || now >= A.fim)) {
      E.f = 1; mudou = true;
      if (!E.comprado && E.quem === "eu") {
        var preco = E.lance; E.res = 0; E.fs = "venci";
        var w = ganha(s, A, preco, "lance");
        if (!w) { s.coins = Math.round((s.coins || 0) + preco); evs.push({ k: "erro", p: A.p, v: preco }); }
        else evs.push({ k: "venci", p: A.p, v: preco });
        delete s.mkt.obs[A.id];
      } else {
        E.fs = E.meu ? "perdi" : "encerrado";
        if (E.meu && !avisou) evs.push({ k: "perdi", p: A.p });
      }
    }
    return mudou;
  }
  // faz o mercado andar até agora: meus lances, minhas vendas; devolve o que aconteceu
  function avanca(s, now) {
    prepara(s);
    var M = s.mkt, evs = [], mudou = false;
    Object.keys(M.obs).forEach(function (id) {
      var o = M.obs[id];
      if (!o || !o.a) { delete M.obs[id]; mudou = true; return; }
      if (!o.E || o.E.f) return;
      if (avancaLeilao(s, o, now, evs)) mudou = true;
    });
    M.sell.forEach(function (L) {
      if (L.sold || L.exp) return;
      var R = simulaVenda(s, L, now);
      if (R.sold) {
        L.sold = 1; L.preco = R.preco; L.st = R.st; L.modo = R.modo; L.n = R.n; L.lance = R.lance;
        historico(s, { k: "v", p: L.card.p, v: L.card.v, preco: R.preco, o: R.modo, t: R.st });
        evs.push({ k: "vendido", p: L.card.p, v: R.preco }); mudou = true;
      } else if (R.exp) {
        L.exp = 1; L.n = 0; L.lance = 0;
        evs.push({ k: "expirou", p: L.card.p }); mudou = true;
      }
    });
    // o que eu levei de lotes que já saíram do ar não precisa mais ser lembrado
    var velho = now - 6 * HORA;
    Object.keys(M.comp).forEach(function (id) { if (M.comp[id] < velho) { delete M.comp[id]; mudou = true; } });
    if (mudou) U().save();
    return evs;
  }

  /* ================= ações ================= */
  function nObs(s) { return Object.keys(s.mkt.obs).length; }
  function nLista(s) { return s.mkt.sell.length; }
  function jaTem(s, pid) { return (s.cards || []).filter(function (c) { return c.p === pid; })[0] || null; }
  function nomeDe(pid) { var p = TM.data.player(pid); return p ? U().shortNm(p.name) : "Carta"; }

  // estrela: segue ou deixa de seguir um anúncio
  function alternaObs(s, A) {
    var M = s.mkt, o = M.obs[A.id];
    if (o) {
      if (o.E && o.E.quem === "eu" && !o.E.f) { toast("Você tem o maior lance: o anúncio fica na lista até o fim.", "alerta"); return true; }
      delete M.obs[A.id]; U().save(); return false;
    }
    if (nObs(s) >= LIM_OBS) { toast("Lista de observação cheia (" + LIM_OBS + "). Limpe os encerrados.", "alerta"); return false; }
    M.obs[A.id] = { a: snap(A), t: agora() };
    U().save();
    return true;
  }
  // lance: as moedas saem do saldo e ficam reservadas no anúncio
  function darLance(s, A, valor) {
    var I = U(), M = s.mkt, now = agora();
    avanca(s, now);
    var E0 = estadoDe(s, A, now), sit = situacao(s, A, E0, now);
    if (sit === "ganhando") return { erro: "Você já tem o maior lance." };
    if (!emAndamento(sit)) return { erro: sit === "vendido" || sit === "perdi" ? "Tarde demais: este anúncio saiu do mercado." : "Este leilão já terminou." };
    var mn = minLance(A, E0), mx = maxLance(A);
    if (mn > mx) return { erro: "Não cabe mais lance: só o compre já." };
    valor = arred(valor || mn);
    if (valor < mn) valor = mn;
    if (valor > mx) return { erro: "O lance precisa ficar abaixo do compre já (" + fmtC(A.bin) + ")." };
    if ((s.coins || 0) < valor) return { falta: valor };
    var o = M.obs[A.id];
    if (!o) {
      if (nObs(s) >= LIM_OBS) return { erro: "Lista de observação cheia (" + LIM_OBS + "). Limpe os encerrados." };
      o = M.obs[A.id] = { a: snap(A), t: now };
    }
    var E = o.E || estadoBase(s, A, now);
    if (!I.pay(s, valor)) return { falta: valor };
    E.lance = valor; E.n++; E.quem = "eu"; E.res = valor; E.meu = valor; E.tu = now;
    // a IA pode reagir em segundos (sorteio fixo pelo nº do lance)
    var rr = rndDe("utk-rxd:" + A.id + ":" + E.n + ":" + seedDe(s));
    var rx = now + Math.round((3 + rr() * 40) * 1000);
    E.rxn = E.n; E.rx = rx < A.fim ? rx : 0;
    o.E = E;
    I.save();
    return { ok: 1, valor: valor };
  }
  // compre já: compra na hora; um lance meu que estava na frente volta para o saldo
  function compraJa(s, A) {
    var I = U(), M = s.mkt, now = agora();
    avanca(s, now);
    var E = estadoDe(s, A, now), sit = situacao(s, A, E, now);
    if (sit === "meu") return { erro: "Você já levou este anúncio." };
    if (!emAndamento(sit)) return { erro: E.comprado ? "Tarde demais: outro técnico comprou." : "Este anúncio já terminou." };
    var o = M.obs[A.id], res = (o && o.E && o.E.quem === "eu") ? (o.E.res || 0) : 0;
    if ((s.coins || 0) + res < A.bin) return { falta: A.bin - res };
    if (!TM.data.player(A.p)) return { erro: "Não foi possível comprar esta carta agora." };
    if (res) { s.coins = Math.round((s.coins || 0) + res); o.E.res = 0; }
    I.pay(s, A.bin);
    if (o) delete M.obs[A.id];
    var w = ganha(s, A, A.bin, "bin");
    return { ok: 1, w: w };
  }
  // item ganho -> clube (o núcleo resolve repetido: a carta pior vira venda rápida)
  function paraClube(s, w, silencioso) {
    var I = U(), c = w.card;
    s.mkt.won = s.mkt.won.filter(function (x) { return x !== w; });
    I.addCard(s, c);
    I.save();
    var nm = nomeDe(c.p), ficou = s.cards.indexOf(c) >= 0, msg;
    if (!ficou) msg = "Você já tinha uma carta melhor de " + nm + ": esta virou venda rápida (+" + fmtC(c.rep || 0) + ").";
    else if (c.repTroca) { msg = nm + " foi para o clube; a carta antiga dele virou venda rápida (+" + fmtC(c.repTroca) + ")."; delete c.repTroca; I.save(); }
    else msg = nm + " foi para o seu clube.";
    if (!silencioso) toast(msg, ficou ? "ok" : "alerta");
    return msg;
  }
  function todosAoClube(s) {
    var n = s.mkt.won.length, rep = 0;
    s.mkt.won.slice().forEach(function (w) { if (paraClube(s, w, true).indexOf("venda rápida") >= 0) rep++; });
    if (n) toast(n + (n > 1 ? " cartas foram para o clube" : " carta foi para o clube") + (rep ? " (" + rep + " repetida" + (rep > 1 ? "s viraram" : " virou") + " venda rápida)" : "") + ".", "ok");
    return n;
  }
  function criaAnuncio(s, card, ini, bin, dur) {
    var d = U().cardData(card), now = agora();
    var L = { v: 3, id: novoId("L"), card: card, ini: ini, bin: bin, t0: now, dur: dur, fim: now + dur, j: d ? justo(d) : bin, n: 0, lance: 0 };
    iaVenda(s, L);
    s.mkt.sell.push(L);
    return L;
  }
  // tira o anúncio (só sem lances) e a carta volta ao clube
  function retira(s, L) {
    var R = simulaVenda(s, L, agora());
    if (L.sold || L.exp || R.sold) return { erro: "Este anúncio já terminou." };
    if (R.n) return { erro: "Já tem lance neste anúncio: ele vai até o fim." };
    s.mkt.sell = s.mkt.sell.filter(function (x) { return x !== L; });
    U().addCard(s, L.card); U().save();
    return { ok: 1 };
  }
  // não vendido -> clube
  function devolve(s, L) {
    if (L.sold) return null;
    s.mkt.sell = s.mkt.sell.filter(function (x) { return x !== L; });
    return paraClube(s, { card: L.card }, true);
  }
  // não vendido -> anuncia de novo (mesmos preços e duração, ajustados à faixa)
  function reanuncia(s, L) {
    if (L.sold || !L.exp) return null;
    var d = U().cardData(L.card), ini = L.ini, bin = L.bin;
    if (d) {
      var fx = faixa(d);
      bin = clamp(bin, acima(fx.min), fx.max);
      ini = clamp(ini, fx.min, abaixo(bin));
    }
    s.mkt.sell = s.mkt.sell.filter(function (x) { return x !== L; });
    var N = criaAnuncio(s, L.card, ini, bin, L.dur || HORA);
    U().save();
    return N;
  }
  function reanunciaTodos(s) {
    var n = 0;
    s.mkt.sell.filter(function (L) { return L.exp && !L.sold; }).forEach(function (L) { if (reanuncia(s, L)) n++; });
    return n;
  }
  // receber as vendas: 5% de taxa
  function recebe(s) {
    var I = U(), got = 0, n = 0;
    s.mkt.sell = s.mkt.sell.filter(function (L) {
      if (!L.sold) return true;
      got += liquido(L.preco || L.bin || 0); n++;
      return false;
    });
    if (n) {
      I.earn(s, got, "Vendas no mercado");
      s.stats.sold = (s.stats.sold || 0) + n;
      I.save();
      I.emit("venda", { s: s, n: n });
    }
    return { moedas: got, n: n };
  }
  function limpaEncerrados(s) {
    var M = s.mkt, now = agora(), n = 0;
    Object.keys(M.obs).forEach(function (id) {
      var o = M.obs[id], E = estadoDe(s, o.a, now), sit = situacao(s, o.a, E, now);
      if (!emAndamento(sit)) { delete M.obs[id]; n++; }
    });
    if (n) U().save();
    return n;
  }
  function contaCartas(s) { return (s.cards || []).length + s.mkt.sell.length + s.mkt.won.length; }
  // números para o hub e para as abas
  function resumo(s) {
    var M = s.mkt, now = agora();
    var r = { vendidas: 0, moedas: 0, expiradas: 0, ativas: 0, ganhos: M.won.length, ganhando: 0, superados: 0, reservado: 0, observando: 0 };
    M.sell.forEach(function (L) {
      if (L.sold) { r.vendidas++; r.moedas += liquido(L.preco || L.bin || 0); }
      else if (L.exp) r.expiradas++;
      else r.ativas++;
    });
    Object.keys(M.obs).forEach(function (id) {
      var o = M.obs[id], E = estadoDe(s, o.a, now), sit = situacao(s, o.a, E, now);
      if (sit === "ganhando") { r.ganhando++; r.reservado += E.res || 0; }
      else if (sit === "superado") r.superados++;
      else if (sit === "ativo") r.observando++;
    });
    r.total = r.vendidas + r.ganhos;
    var p = [];
    if (r.vendidas) p.push(r.vendidas + (r.vendidas > 1 ? " vendas concluídas" : " venda concluída"));
    if (r.ganhos) p.push(r.ganhos + (r.ganhos > 1 ? " cartas ganhas" : " carta ganha"));
    if (r.expiradas) p.push(r.expiradas + (r.expiradas > 1 ? " sem comprador" : " sem comprador"));
    r.texto = p.join(" · ");
    return r;
  }

  /* ================= peças da tela ================= */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, at) { var n = document.createElementNS(SVGNS, tag); Object.keys(at).forEach(function (k) { n.setAttribute(k, at[k]); }); return n; }
  function moeda(n, cls) {
    var tx = document.createTextNode(fmtC(n));
    var sp = el("span", { class: "utk-m" + (cls ? " " + cls : "") }, [ic("tm-moeda"), tx]);
    sp._v = n;
    sp.set = function (v) { if (v !== sp._v) { sp._v = v; tx.nodeValue = fmtC(v); } };
    return sp;
  }
  function vazio(t, s2, bt) {
    return el("div", { class: "utk-vazio" }, [el("span", { class: "utk-vazio-ic" }, [ic("store")]), el("b", { text: t }), s2 ? el("p", { text: s2 }) : null, bt || null]);
  }
  function secT(t, n, extra) {
    return el("div", { class: "utk-sec" }, [el("span", { class: "utk-sec-t", text: t + (n != null ? " (" + n + ")" : "") }), extra || null]);
  }
  function dl(l, v) { return el("div", { class: "ut-dl" }, [el("i", { text: l }), (typeof v === "object" && v) ? v : el("b", { text: String(v == null ? "—" : v) })]); }
  function sparkSVG(pts) {
    var W = 140, H = 42, P = 3, mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
    var xy = pts.map(function (v, i) { return [P + i * (W - 2 * P) / (pts.length - 1), P + (H - 2 * P) * (1 - (v - mn) / rg)]; });
    var linha = xy.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "utk-spark-svg", "aria-hidden": "true", preserveAspectRatio: "none" });
    svg.appendChild(svgEl("path", { d: "M" + xy[0][0] + "," + H + " L" + linha.split(" ").join(" L") + " L" + xy[xy.length - 1][0] + "," + H + " Z", class: "utk-spark-a" }));
    svg.appendChild(svgEl("polyline", { points: linha, class: "utk-spark-l" }));
    var u = xy[xy.length - 1];
    svg.appendChild(svgEl("circle", { cx: u[0], cy: u[1], r: 3, class: "utk-spark-p" }));
    return svg;
  }
  function blocoPreco(d) {
    var pts = tendencia(d), j = pts[pts.length - 1], v0 = pts[0], vari = (j - v0) / v0;
    var cls = vari > 0.01 ? "sobe" : vari < -0.01 ? "desce" : "estavel";
    var fx = faixa(d);
    return el("div", { class: "utk-preco " + cls }, [
      el("div", { class: "utk-preco-i" }, [
        el("i", { text: "Preço médio" }),
        moeda(j, "grande"),
        el("span", { class: "utk-var" }, [ic(cls === "sobe" ? "trending-up" : cls === "desce" ? "trending-down" : "chart-line"),
          el("span", { text: (vari >= 0 ? "+" : "−") + fmtPct(Math.abs(vari)) + " em 7 dias" })])
      ]),
      el("div", { class: "utk-spark" }, [sparkSVG(pts), el("div", { class: "utk-spark-x" }, [el("span", { text: "7 dias" }), el("span", { text: "hoje" })])]),
      el("div", { class: "utk-faixa" }, [
        el("span", { text: "Mín. 7 dias " + fmtC(Math.min.apply(null, pts)) + " · máx. " + fmtC(Math.max.apply(null, pts)) }),
        el("span", { text: "Faixa de preço: " + fmtC(fx.min) + " a " + fmtC(fx.max) })
      ])
    ]);
  }
  // seletor de valor com − / + na grade de preços do FC
  function stepper(v0, mn, mx, rotulo, onChange) {
    var v = v0, alvo = "";
    var inp = el("input", { class: "utk-step-v", type: "text", inputmode: "numeric", autocomplete: "off", "aria-label": rotulo });
    var menos = el("button", { class: "utk-step-b", type: "button", "aria-label": "Diminuir " + rotulo, on: { click: function () { set(v <= mn ? mn : abaixo(v), true); } } }, [ic("minus")]);
    var mais = el("button", { class: "utk-step-b", type: "button", "aria-label": "Aumentar " + rotulo, on: { click: function () { set(acima(v), true); } } }, [ic("plus")]);
    inp.addEventListener("focus", function () { alvo = inp.value; try { inp.select(); } catch (e) {} });
    inp.addEventListener("change", function () { var n = parseInt(String(inp.value).replace(/\D/g, ""), 10); set(isNaN(n) ? v : n, true); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") inp.blur(); });
    function set(n, avisa) {
      n = arred(n); if (n < mn) n = mn; if (n > mx) n = mx;
      var mudou = n !== v; v = n;
      inp.value = fmtC(v);
      menos.disabled = v <= mn; mais.disabled = v >= mx;
      if (avisa && mudou && onChange) onChange(v);
    }
    set(v, false);
    return {
      node: el("div", { class: "utk-step" }, [menos, inp, mais]),
      get: function () { return v; },
      set: function (n) { set(n, true); },
      limites: function (a, b) {
        if (a === mn && b === mx) return;
        mn = a; mx = b;
        if (v < mn || v > mx) set(v, true);
        else { menos.disabled = v <= mn; mais.disabled = v >= mx; }
      }
    };
  }
  // folha (bottom sheet) no estilo das outras do Ultimate
  function folha(titulo, kids, cls, aoFechar) {
    var ov = el("div", { class: "ut-sheet utk-sheet" });
    var aberto = true;
    function fecha() {
      if (!aberto) return; aberto = false;
      ov.classList.remove("show");
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 200);
      if (aoFechar) try { aoFechar(); } catch (e) {}
    }
    var inn = el("div", { class: "ut-sheet-in utk-folha " + (cls || "") }, [
      el("div", { class: "ut-sheet-h" }, [el("span", { class: "utk-folha-t", text: titulo }), el("button", { class: "ut-x", type: "button", "aria-label": "Fechar", on: { click: fecha } }, [ic("x")])])
    ].concat(kids));
    ov.appendChild(inn);
    ov.addEventListener("click", function (e) { if (e.target === ov) fecha(); });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("show"); });
    return { ov: ov, inn: inn, fecha: fecha, aberto: function () { return aberto; } };
  }
  function subDe(d) {
    var I = U(), V = I.verInfo(d.ver), partes = [d.pos2 || d.pos];
    if (d.club) partes.push(d.club.name);
    if (d.ver !== "base") partes.push(V.n);
    return partes.join(" · ");
  }

  /* ================= linha de leilão (busca e observação) ================= */
  function linhaLeilao(ctx, A, d) {
    var s = ctx.s, I = U();
    d = d || dadosAnuncio(A);
    if (!d) return null;
    var row = el("div", { class: "utk-row" });
    function abre() { abreFicha(ctx, A); }
    var star = el("button", { class: "utk-star", type: "button", "aria-label": "Observar anúncio", on: { click: function (e) { e.stopPropagation(); alternaObs(s, A); upd(agora(), true); ctx.topo(); } } }, [ic("star")]);
    var lL = el("i"), vL = moeda(A.ini), tTx = el("span"), nb = el("span", { class: "utk-nb" }), st = el("span", { class: "utk-st" });
    var tempo = el("span", { class: "utk-tempo" }, [ic("clock"), tTx]);
    var bL = el("button", { class: "utk-pr lance", type: "button", on: { click: function (e) { e.stopPropagation(); abreFicha(ctx, A, "lance"); } } }, [lL, vL]);
    var bB = el("button", { class: "utk-pr bin", type: "button", on: { click: function (e) { e.stopPropagation(); pedeCompraJa(ctx, A, null); } } }, [el("i", { text: "Compre já" }), moeda(A.bin)]);
    row.appendChild(I.cardEl(d, { cls: "tiny", on: abre }));
    row.appendChild(el("div", { class: "utk-row-i" }, [
      el("div", { class: "utk-row-top" }, [
        el("button", { class: "utk-row-tx", type: "button", on: { click: abre } }, [el("span", { class: "utk-row-n", text: d.name }), el("span", { class: "utk-row-s", text: subDe(d) })]),
        star
      ]),
      el("div", { class: "utk-prs" }, [bL, bB]),
      el("div", { class: "utk-row-b" }, [tempo, nb, st])
    ]));
    var ult = "";
    function upd(now, ini) {
      if (!ini && !row.isConnected) return false;
      var E = estadoDe(s, A, now), sit = situacao(s, A, E, now), rest = A.fim - now, vivo = emAndamento(sit);
      lL.textContent = E.n ? (E.quem === "eu" ? "Seu lance" : "Lance atual") : "Lance inicial";
      vL.set(E.n ? E.lance : A.ini);
      nb.textContent = E.n ? E.n + (E.n > 1 ? " lances" : " lance") : "sem lances";
      tTx.textContent = vivo ? fmtTempo(rest) : (sit === "vendido" || sit === "meu" ? "Fora do ar" : "Encerrado");
      tempo.className = "utk-tempo " + (vivo ? clsTempo(rest) : "fim");
      var chave = sit + "|" + !!s.mkt.obs[A.id];
      if (chave !== ult) {
        ult = chave;
        row.className = "utk-row s-" + sit;
        st.textContent = sit === "ativo" ? "" : (ROT[sit] || "");
        st.className = "utk-st " + sit;
        star.classList.toggle("on", !!s.mkt.obs[A.id]);
        star.setAttribute("aria-pressed", s.mkt.obs[A.id] ? "true" : "false");
        bL.disabled = !vivo || sit === "ganhando";
        bB.disabled = !vivo;
      }
      if (vivo && sit !== "ganhando") bL.disabled = minLance(A, E) > maxLance(A);
    }
    upd(agora(), true);
    ctx.vivo(upd);
    return row;
  }

  /* ================= ficha do anúncio (lance, compre já, preço médio) ================= */
  function abreFicha(ctx, A, foco) {
    var s = ctx.s, I = U(), d = dadosAnuncio(A);
    if (!d) return;
    var V = I.verInfo(d.ver), now = agora(), E0 = estadoDe(s, A, now);
    var tTx = el("b"), nTx = el("b"), stBox = el("div", { class: "utk-fst" }), lL = el("i"), lV = moeda(0, "grande");
    var mn0 = minLance(A, E0), mx0 = maxLance(A);
    var stp = stepper(Math.min(mn0, mx0), Math.min(mn0, mx0), mx0, "valor do lance", function () { pintaBotao(); });
    var btL = el("button", { class: "btn primary wide utk-bt", type: "button", on: { click: lance } });
    var btB = el("button", { class: "btn wide utk-bt utk-bt-bin", type: "button", on: { click: function () { pedeCompraJa(ctx, A, F); } } });
    var btO = el("button", { class: "btn ghost wide utk-bt", type: "button", on: { click: function () { alternaObs(s, A); upd(agora(), true); ctx.topo(); } } });
    var boxL = el("div", { class: "utk-lbox" }, [
      el("div", { class: "utk-lbox-h" }, [el("div", { class: "utk-lbox-at" }, [lL, lV]), el("div", { class: "utk-lbox-n" }, [ic("hammer"), nTx])]),
      el("label", { class: "utk-lbl", text: "Seu lance" }),
      stp.node,
      btL,
      el("div", { class: "utk-nota", text: "As moedas do lance ficam reservadas até o fim. Se outro técnico cobrir, elas voltam na hora." })
    ]);
    var F = folha(d.name, [
      el("div", { class: "utk-ficha" }, [
        I.cardEl(d, { cls: "big" }),
        el("div", { class: "utk-ficha-i" }, [
          dl("Vendedor", A.vend),
          dl("Clube", d.club ? d.club.name : "—"),
          dl("Liga", d.lg ? I.nomeLiga(d.lg) : "—"),
          dl("País", d.p.nationName || I.nomePais(d.nat)),
          dl("Versão", V.n),
          dl("Termina em", tTx)
        ])
      ]),
      stBox, boxL, btB,
      el("div", { class: "utk-sec" }, [el("span", { class: "utk-sec-t", text: "Preço médio" })]),
      blocoPreco(d),
      btO
    ], "utk-ficha-f");
    ctx.folha(F);
    var ult = "";
    function pintaBotao() {
      var now2 = agora(), E = estadoDe(s, A, now2), sit = situacao(s, A, E, now2);
      var pode = emAndamento(sit) && sit !== "ganhando" && minLance(A, E) <= maxLance(A);
      btL.textContent = sit === "ganhando" ? "Você está ganhando" : pode ? "Dar lance de " + fmtC(stp.get()) : "Lance indisponível";
      btL.disabled = !pode;
    }
    function upd(now2, ini) {
      if (!ini && !F.aberto()) return false;
      var E = estadoDe(s, A, now2), sit = situacao(s, A, E, now2), vivo = emAndamento(sit), rest = A.fim - now2;
      tTx.textContent = vivo ? fmtTempo(rest) : (ROT[sit] || "Encerrado");
      tTx.className = "utk-tt " + (vivo ? clsTempo(rest) : "fim");
      nTx.textContent = E.n ? E.n + (E.n > 1 ? " lances" : " lance") : "sem lances";
      lL.textContent = E.n ? (E.quem === "eu" ? "Seu lance (o maior)" : "Lance atual") : "Lance inicial";
      lV.set(E.n ? E.lance : A.ini);
      if (vivo && sit !== "ganhando") { var mn = minLance(A, E), mx = maxLance(A); if (mn <= mx) stp.limites(mn, mx); }
      var chave = sit + "|" + !!s.mkt.obs[A.id];
      if (chave !== ult) {
        ult = chave;
        TM.ui.clear(stBox);
        stBox.className = "utk-fst " + sit;
        var msg = {
          ganhando: ["check", "Você está ganhando. " + fmtC(E.res || E.lance) + " moedas reservadas."],
          superado: ["triangle-alert", "Seu lance foi superado. As moedas voltaram: cubra se ainda valer."],
          venci: ["check", "Leilão vencido: a carta está em Itens ganhos."],
          perdi: ["x", E.comprado ? "Outro técnico comprou no compre já." : "Leilão perdido."],
          encerrado: ["clock", "Leilão encerrado."],
          vendido: ["x", "Outro técnico comprou no compre já."],
          meu: ["check", "Você levou esta carta. Veja em Itens ganhos."]
        }[sit];
        if (msg) { stBox.appendChild(ic(msg[0])); stBox.appendChild(el("span", { text: msg[1] })); }
        stBox.hidden = !msg;
        boxL.hidden = !vivo;
        btB.hidden = !vivo;
        TM.ui.clear(btB); btB.appendChild(ic("zap")); btB.appendChild(el("span", { text: "Compre já por " })); btB.appendChild(moeda(A.bin));
        TM.ui.clear(btO); btO.appendChild(ic(s.mkt.obs[A.id] ? "x" : "star")); btO.appendChild(el("span", { text: s.mkt.obs[A.id] ? "Tirar da lista de observação" : "Observar este anúncio" }));
      }
      pintaBotao();
    }
    function lance() {
      var r = darLance(s, A, stp.get());
      if (r.falta) { F.fecha(); I.faltaMoedas(s, r.falta); return; }
      if (r.erro) { toast(r.erro, "erro"); upd(agora(), true); return; }
      toast("Lance de " + fmtC(r.valor) + " dado: moedas reservadas.", "ok");
      upd(agora(), true); ctx.topo(); ctx.tickLinhas();
    }
    upd(now, true);
    ctx.vivo(upd);
    if (foco === "lance") setTimeout(function () { try { boxL.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} }, 260);
  }

  function pedeCompraJa(ctx, A, F) {
    var s = ctx.s, I = U(), d = dadosAnuncio(A);
    if (!d) return;
    var now = agora(), E = estadoDe(s, A, now), sit = situacao(s, A, E, now);
    if (!emAndamento(sit)) { toast(sit === "meu" ? "Você já levou este anúncio." : E.comprado ? "Tarde demais: outro técnico comprou." : "Este anúncio já terminou.", "alerta"); return; }
    var res = E.quem === "eu" ? (E.res || 0) : 0;
    if ((s.coins || 0) + res < A.bin) { if (F) F.fecha(); I.faltaMoedas(s, A.bin - res); return; }
    var dup = jaTem(s, A.p);
    TM.ui.confirm("Comprar agora?", d.name + " (" + I.verInfo(d.ver).n + ", " + d.ov + ") por " + fmtC(A.bin) + " moedas." +
      (res ? " Seu lance de " + fmtC(res) + " volta para o saldo." : "") +
      (dup ? " Você já tem esse jogador no clube." : ""), "Comprar por " + fmtC(A.bin), function () {
      var r = compraJa(s, A);
      if (r.falta) { if (F) F.fecha(); I.faltaMoedas(s, r.falta); return; }
      if (r.erro || !r.w) { toast(r.erro || "Não foi possível comprar.", "erro"); return; }
      if (F) F.fecha();
      ctx.topo(); ctx.tickLinhas();
      folhaComprado(ctx, r.w);
    });
  }

  // depois do compre já: mandar ao clube, anunciar de novo ou deixar em Itens ganhos
  function folhaComprado(ctx, w) {
    var s = ctx.s, I = U(), d = I.cardData(w.card);
    if (!d) return;
    var dup = jaTem(s, w.card.p), dd = dup ? I.cardData(dup) : null;
    var F = folha("Comprado!", [
      el("div", { class: "utk-ok" }, [
        I.cardEl(d, { cls: "big pop" }),
        el("div", { class: "utk-ok-t", text: d.name }),
        el("div", { class: "utk-ok-s" }, [el("span", { text: "Pago " }), moeda(w.preco), el("span", { text: " · equilíbrio para revender: " }), moeda(empate(w.preco))]),
        dd ? el("div", { class: "utk-aviso" }, [ic("triangle-alert"), el("span", { text: "Você já tem " + U().shortNm(dd.name) + " (" + dd.ov + ") no clube. Se mandar esta para lá, a carta pior vira venda rápida." })]) : null
      ]),
      el("div", { class: "utk-acts" }, [
        el("button", { class: "btn primary wide", type: "button", on: { click: function () { F.fecha(); paraClube(s, w); ctx.topo(); ctx.redesenha(); } } }, [ic("check"), el("span", { text: "Enviar ao clube" })]),
        el("button", { class: "btn wide", type: "button", on: { click: function () { F.fecha(); folhaAnuncio(s, d, { tipo: "ganho", w: w }, function () { ctx.topo(); ctx.redesenha(); }); } } }, [ic("tag"), el("span", { text: "Anunciar no mercado" })]),
        el("button", { class: "btn ghost wide", type: "button", on: { click: function () { F.fecha(); ctx.topo(); ctx.redesenha(); } } }, [el("span", { text: "Deixar em Itens ganhos" })])
      ])
    ], "utk-comprado");
    ctx.folha(F);
  }

  /* ================= anunciar (lance inicial + compre já + duração) ================= */
  var _durPadrao = HORA;
  function preset(k, fx) {
    var m = { rapida: [0.55, 0.9], justo: [0.7, 1.0], lucro: [0.9, 1.2] }[k] || [0.7, 1];
    var bin = clamp(arred(fx.justo * m[1]), acima(fx.min), fx.max);
    var ini = clamp(arred(fx.justo * m[0]), fx.min, abaixo(bin));
    return { ini: ini, bin: bin };
  }
  // origem: { tipo: "clube" } | { tipo: "ganho", w } | { tipo: "relista", L }
  function folhaAnuncio(s, d, origem, depois, ctx) {
    var I = U(), fx = faixa(d), now = agora();
    var base = origem.L ? { ini: origem.L.ini, bin: origem.L.bin } : preset("justo", fx);
    base.bin = clamp(base.bin, acima(fx.min), fx.max); base.ini = clamp(base.ini, fx.min, abaixo(base.bin));
    var dur = origem.L ? (origem.L.dur || _durPadrao) : _durPadrao;
    var trava = false, pk = origem.L ? "" : "justo";
    var hint = el("div", { class: "utk-est" }), hint2 = el("div", { class: "utk-est2" });
    var recIni = moeda(0), recBin = moeda(0);
    var stIni = stepper(base.ini, fx.min, abaixo(fx.max), "lance inicial", function (v) {
      if (trava) return; trava = true;
      if (stBin.get() <= v) stBin.set(acima(v));
      trava = false; pk = ""; pinta();
    });
    var stBin = stepper(base.bin, acima(fx.min), fx.max, "compre já", function (v) {
      if (trava) return; trava = true;
      if (stIni.get() >= v) stIni.set(abaixo(v));
      trava = false; pk = ""; pinta();
    });
    var chipsP = el("div", { class: "ut-chips utk-presets" });
    var chipsD = el("div", { class: "ut-chips utk-durs" });
    var btOk = el("button", { class: "btn primary wide utk-bt", type: "button", on: { click: confirma } });
    var cmp = comparaveis(s, d, now);
    var cmpBox = el("div", { class: "utk-cmp" }, [
      el("div", { class: "utk-cmp-t" }, [ic("search"), el("span", { text: "Comparar preço: menores compre já agora (toque para ficar logo abaixo)" })]),
      el("div", { class: "utk-cmp-l" }, cmp.map(function (v) {
        return el("button", { class: "utk-cmp-v", type: "button", on: { click: function () { var alvo = Math.max(acima(fx.min), abaixo(v)); stBin.set(alvo); } } }, [moeda(v)]);
      }))
    ]);
    var ganho = origem.tipo === "ganho" && origem.w ? origem.w : null;
    var F = folha("Anunciar " + I.shortNm(d.name), [
      el("div", { class: "utk-an-top" }, [
        I.cardEl(d, { cls: "mini" }),
        el("div", { class: "utk-an-i" }, [
          el("b", { text: d.name }),
          el("span", { text: I.verInfo(d.ver).n + " · " + d.ov + " · " + (d.pos2 || d.pos) }),
          ganho ? el("span", { class: "utk-an-pago" }, [el("span", { text: "Pago " }), moeda(ganho.preco), el("span", { text: " · equilíbrio " }), moeda(empate(ganho.preco))]) : null
        ])
      ]),
      blocoPreco(d),
      cmpBox,
      el("div", { class: "utk-lbl", text: "Preço sugerido" }), chipsP,
      el("div", { class: "utk-an-campos" }, [
        el("div", { class: "utk-an-c" }, [el("label", { class: "utk-lbl", text: "Lance inicial" }), stIni.node, el("div", { class: "utk-rec" }, [el("span", { text: "recebe " }), recIni])]),
        el("div", { class: "utk-an-c" }, [el("label", { class: "utk-lbl", text: "Compre já" }), stBin.node, el("div", { class: "utk-rec" }, [el("span", { text: "recebe " }), recBin])])
      ]),
      el("div", { class: "utk-lbl", text: "Duração" }), chipsD,
      hint, hint2,
      el("div", { class: "utk-nota", text: "Taxa de 5% sobre o valor da venda. Com lance, o anúncio vai até o fim; sem lance dá para retirar." }),
      btOk
    ], "utk-anunciar-f");
    if (ctx) ctx.folha(F);
    function pinta() {
      TM.ui.clear(chipsP);
      [["rapida", "Venda rápida"], ["justo", "Preço justo"], ["lucro", "Com lucro"]].forEach(function (o) {
        chipsP.appendChild(el("button", { class: "ut-chip" + (pk === o[0] ? " on" : ""), type: "button", text: o[1], on: { click: function () {
          var p = preset(o[0], fx); trava = true; stBin.set(fx.max); stIni.set(p.ini); stBin.set(p.bin); trava = false; pk = o[0]; pinta();
        } } }));
      });
      TM.ui.clear(chipsD);
      DURACOES.forEach(function (o) {
        chipsD.appendChild(el("button", { class: "ut-chip" + (dur === o[0] ? " on" : ""), type: "button", text: o[1], on: { click: function () { dur = o[0]; _durPadrao = dur; pinta(); } } }));
      });
      recIni.set(liquido(stIni.get())); recBin.set(liquido(stBin.get()));
      var e = estimativa(stIni.get(), stBin.get(), fx.justo);
      hint.textContent = e.tx; hint.className = "utk-est " + e.cls;
      hint2.textContent = e.leilao;
      btOk.textContent = "Anunciar por " + rotDur(dur);
    }
    function confirma() {
      var ini = stIni.get(), bin = stBin.get();
      if (!(ini >= fx.min && bin <= fx.max && ini < bin)) { toast("Confira os preços: o lance inicial precisa ficar abaixo do compre já.", "erro"); return; }
      if (origem.tipo !== "relista" && nLista(s) >= LIM_LISTA) { toast("Lista de transferências cheia (" + LIM_LISTA + "). Receba ou retire alguma.", "alerta"); return; }
      var card = d.card;
      if (origem.tipo === "clube") {
        if (!(s.cards || []).some(function (c) { return c.i === card.i; })) { toast("Esta carta não está mais no seu clube.", "erro"); F.fecha(); return; }
        if (I.inSquad(s)[card.i]) { toast("Está no elenco. Tire do time para vender.", "alerta"); return; }
        I.removeCard(s, card.i);
      } else if (origem.tipo === "ganho") {
        if (s.mkt.won.indexOf(origem.w) < 0) { toast("Este item já saiu de Itens ganhos.", "erro"); F.fecha(); return; }
        s.mkt.won = s.mkt.won.filter(function (x) { return x !== origem.w; });
      } else if (origem.tipo === "relista") {
        if (s.mkt.sell.indexOf(origem.L) < 0 || origem.L.sold) { toast("Este anúncio já mudou.", "erro"); F.fecha(); return; }
        s.mkt.sell = s.mkt.sell.filter(function (x) { return x !== origem.L; });
      }
      criaAnuncio(s, card, ini, bin, dur);
      I.save();
      F.fecha();
      toast(I.shortNm(d.name) + " anunciado: compre já " + fmtC(bin) + " por " + rotDur(dur) + ".", "ok");
      if (depois) try { depois(); } catch (e) {}
    }
    pinta();
    return F;
  }
  // pública: o botão "Vender no mercado" da ficha da carta (núcleo) chama esta
  function anunciar(d, s, depois) {
    var I = U();
    s = s || I.st();
    if (!s || !d || !d.card) return null;
    prepara(s);
    if (!I.podeVender(d.card)) { toast("Jogador emprestado não pode ser vendido.", "erro"); return null; }
    if (I.inSquad(s)[d.card.i]) { toast("Está no elenco. Tire do time para vender.", "alerta"); return null; }
    if (!(s.cards || []).some(function (c) { return c.i === d.card.i; })) { toast("Esta carta não está no seu clube.", "erro"); return null; }
    return folhaAnuncio(s, d, { tipo: "clube" }, depois, null);
  }
  // escolher uma carta do clube para anunciar (de dentro do mercado)
  function folhaEscolhe(ctx) {
    var s = ctx.s, I = U(), sq = I.inSquad(s);
    var lista = (s.cards || []).filter(function (c) { return I.podeVender(c) && !sq[c.i]; }).map(I.cardData).filter(Boolean)
      .sort(function (a, b) { return I.basePrice(b.ov, b.ver) - I.basePrice(a.ov, a.ver); });
    var F = folha("Anunciar uma carta", [
      el("p", { class: "utk-nota", text: "Só aparecem cartas fora do time (titulares e reservas não podem ser vendidos) e que não são emprestadas." }),
      lista.length ? el("div", { class: "ut-pick-grid utk-pick" }, lista.slice(0, 150).map(function (d) {
        return el("div", { class: "ut-pick-it" }, [
          I.cardEl(d, { cls: "tiny", on: function () { F.fecha(); folhaAnuncio(s, d, { tipo: "clube" }, function () { ctx.topo(); ctx.redesenha(); }, ctx); } }),
          el("span", { class: "utk-pick-v" }, [moeda(justo(d))])
        ]);
      })) : vazio("Nenhuma carta disponível para vender.", "Tire cartas do time (ou abra pacotes) para anunciar.")
    ], "utk-escolhe");
    ctx.folha(F);
  }

  /* ================= a tela ================= */
  var _aba = "buscar", _painel = false, _res = null;
  function filtrosVazios() { return { q: "", setor: "", fun: "", rar: "", ver: "", lg: "", nat: "", ovMin: "", ovMax: "", lanceMax: "", binMax: "", ord: "fim" }; }
  var _f = filtrosVazios();
  var SETORES = [["", "Todos"], ["GK", "GOL"], ["DF", "DEF"], ["MF", "MEI"], ["FW", "ATA"]];
  var FUNCOES = [["GOL", "Goleiro"], ["ZAG", "Zagueiro"], ["LD", "Lateral direito"], ["LE", "Lateral esquerdo"], ["VOL", "Volante"],
                 ["MC", "Meio-campista"], ["MEI", "Meia"], ["MD", "Meia direita"], ["ME", "Meia esquerda"], ["PD", "Ponta direita"],
                 ["PE", "Ponta esquerda"], ["CA", "Centroavante"], ["SA", "Segundo atacante"]];
  var ORDENS = [["fim", "Término"], ["lance", "Lance"], ["bin", "Compre já"], ["nota", "Nota"]];

  function filtra(s, now, f) {
    var I = U(), q = norm(f.q), out = [];
    mercado(s, now).forEach(function (A) {
      var d = dadosAnuncio(A); if (!d) return;
      if (q && norm(d.name).indexOf(q) < 0) return;
      if (f.setor && d.pos !== f.setor) return;
      if (f.fun && (d.posicoes || [d.pos2]).indexOf(f.fun) < 0) return;
      if (f.rar && d.rar !== f.rar) return;
      if (f.ver === "esp") { if (!I.verInfo(d.ver).sel) return; }
      else if (f.ver && d.ver !== f.ver) return;
      if (f.lg && d.lg !== f.lg) return;
      if (f.nat && d.nat !== f.nat) return;
      if (f.ovMin && d.ov < +f.ovMin) return;
      if (f.ovMax && d.ov > +f.ovMax) return;
      if (f.binMax && A.bin > +f.binMax) return;
      var E = estadoDe(s, A, now), pr = E.n ? E.lance : A.ini;
      if (f.lanceMax && pr > +f.lanceMax) return;
      out.push({ A: A, d: d, pr: pr });
    });
    var ord = f.ord;
    out.sort(function (a, b) {
      if (ord === "lance") return a.pr - b.pr || a.A.fim - b.A.fim;
      if (ord === "bin") return a.A.bin - b.A.bin || a.A.fim - b.A.fim;
      if (ord === "nota") return b.d.ov - a.d.ov || a.A.fim - b.A.fim;
      return a.A.fim - b.A.fim;
    });
    return out;
  }
  function nFiltros(f) {
    var n = 0;
    ["fun", "rar", "ver", "lg", "nat", "ovMin", "ovMax", "lanceMax", "binMax"].forEach(function (k) { if (f[k]) n++; });
    return n;
  }

  function montaTela(screen, s) {
    var I = U(), vivos = [], folhas = [];
    var ctx = {
      s: s,
      vivo: function (fn) { vivos.push(fn); },
      folha: function (F) { folhas.push(F); },
      redesenha: function () { desenha(); },
      topo: function () { pintaTopo(agora()); },
      tickLinhas: function () { var now = agora(); vivos = vivos.filter(function (fn) { try { return fn(now) !== false; } catch (e) { return false; } }); },
      ir: function (aba) { _aba = aba; desenha(); window.scrollTo(0, 0); }
    };
    screen.classList.add("ut-screen", "utk-screen");
    screen.appendChild(I.utTop("Mercado", function () { I.goUT("ut"); }, s));

    /* ---- cabeçalho: o mercado agora e o meu saldo ---- */
    var hNum = el("span"), hSub = el("span");
    var sDisp = moeda(s.coins || 0), sRes = moeda(0), sRec = moeda(0);
    screen.appendChild(el("div", { class: "utk-topo" }, [
      el("div", { class: "utk-hero" }, [
        el("div", { class: "utk-hero-top" }, [
          el("span", { class: "utk-hero-ic" }, [ic("store")]),
          el("div", { class: "utk-hero-i" }, [
            el("div", { class: "utk-hero-k", text: "MERCADO DE TRANSFERÊNCIAS" }),
            el("div", { class: "utk-hero-t" }, [hNum]),
            el("div", { class: "utk-hero-s" }, [ic("timer"), hSub])
          ])
        ]),
        el("div", { class: "utk-saldo" }, [
          el("div", { class: "utk-sd" }, [el("i", { text: "Disponível" }), sDisp]),
          el("div", { class: "utk-sd res" }, [el("i", {}, [ic("lock"), el("span", { text: "Reservado" })]), sRes]),
          el("div", { class: "utk-sd rec" }, [el("i", { text: "A receber" }), sRec])
        ])
      ])
    ]));
    var abas = el("div", { class: "ut-tabs utk-abas", role: "tablist" });
    var corpo = el("div", { class: "ut-body utk-corpo" });
    screen.appendChild(abas); screen.appendChild(corpo);
    var badges = {};
    [["buscar", "search", "Buscar"], ["obs", "eye", "Observação"], ["vendas", "tag", "Vendas"]].forEach(function (t) {
      badges[t[0]] = el("span", { class: "utk-badge" });
      abas.appendChild(el("button", { class: "ut-tab utk-aba", type: "button", role: "tab", "data-aba": t[0], on: { click: function () { ctx.ir(t[0]); } } },
        [ic(t[1]), el("span", { class: "utk-aba-t", text: t[2] }), badges[t[0]]]));
    });
    var _moedas = s.coins;
    function pintaTopo(now) {
      var n = mercado(s, now).length, falta = HORA - (now % HORA), r = resumo(s);
      hNum.textContent = n + (n === 1 ? " anúncio no ar" : " anúncios no ar");
      hSub.textContent = "Novo lote em " + (falta < MIN ? "segundos" : Math.ceil(falta / MIN) + " min") + " · taxa de 5%";
      sDisp.set(s.coins || 0); sRes.set(r.reservado); sRec.set(r.moedas);
      sRes.parentNode.classList.toggle("on", r.reservado > 0);
      sRec.parentNode.classList.toggle("on", r.moedas > 0);
      var bo = r.ganhos + r.superados, bv = r.vendidas + r.expiradas;
      badges.obs.textContent = bo ? String(bo) : ""; badges.obs.hidden = !bo;
      badges.vendas.textContent = bv ? String(bv) : ""; badges.vendas.hidden = !bv;
      badges.buscar.hidden = true;
      badges.obs.parentNode.classList.toggle("tem-badge", !!bo);
      badges.vendas.parentNode.classList.toggle("tem-badge", !!bv);
      Array.prototype.forEach.call(abas.children, function (b) { var on = b.getAttribute("data-aba") === _aba; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
      if (s.coins !== _moedas) {             // saldo mudou: atualiza a carteira do topo
        _moedas = s.coins;
        var w = screen.querySelector(".ut-wallet");
        if (w && w.parentNode) w.parentNode.replaceChild(I.wallet(s), w);
      }
    }
    function desenha() {
      TM.ui.clear(corpo);
      if (_aba === "obs") abaObs(); else if (_aba === "vendas") abaVendas(); else abaBuscar();
      pintaTopo(agora());
    }

    /* ---- aba Buscar ---- */
    function abaBuscar() {
      var f = _f;
      var q = el("input", { class: "utk-q-in", type: "search", placeholder: "Nome do jogador", autocomplete: "off", "aria-label": "Buscar pelo nome do jogador" });
      q.value = f.q;
      var tq = null;
      q.addEventListener("input", function () { clearTimeout(tq); tq = setTimeout(function () { f.q = q.value; nova(); }, 220); });
      corpo.appendChild(el("div", { class: "utk-q" }, [ic("search"), q]));
      var chips = el("div", { class: "ut-chips utk-chips" });
      var nF = el("span", { class: "utk-nf" });
      var btF = el("button", { class: "ut-chip utk-btf", type: "button", on: { click: function () { _painel = !_painel; pintaControles(); } } }, [ic("sliders-horizontal"), el("span", { text: "Filtros" }), nF]);
      corpo.appendChild(el("div", { class: "utk-linha-f" }, [chips, btF]));
      // painel de filtros
      function sel(rot, ops, k) {
        var x = el("select", { class: "utk-sel", "aria-label": rot }, ops.map(function (o) { return el("option", { value: o[0], text: o[1] }); }));
        x.value = f[k] || "";
        x.addEventListener("change", function () { f[k] = x.value; if (k === "fun" && x.value) f.setor = ""; nova(); });
        return el("label", { class: "utk-campo" }, [el("span", { text: rot }), x]);
      }
      function num(rot, k, ph) {
        var x = el("input", { class: "utk-num", type: "number", inputmode: "numeric", min: "0", placeholder: ph, "aria-label": rot });
        x.value = f[k] || "";
        var tn = null;
        x.addEventListener("input", function () { clearTimeout(tn); tn = setTimeout(function () { f[k] = x.value; nova(); }, 300); });
        return el("label", { class: "utk-campo" }, [el("span", { text: rot }), x]);
      }
      var w = TM.data.world();
      var ligas = [["", "Todas"]].concat((w.leagues || []).map(function (L) { return [L.id, L.name]; }));
      var paises = (w.nations || []).map(function (n) { return [n.id, n.name]; }).sort(function (a, b) { return a[1].localeCompare(b[1], "pt-BR"); });
      var versoes = [["", "Todas"], ["base", "Comum"], ["rare", "Rara"], ["esp", "Qualquer especial"]];
      ["totw", "rodada", "mes", "joia", "heroi", "tots", "icone"].forEach(function (v) { versoes.push([v, I.verInfo(v).n]); });
      var painel = el("div", { class: "utk-painel" }, [
        el("div", { class: "utk-grade" }, [
          sel("Função", [["", "Todas"]].concat(FUNCOES.map(function (o) { return [o[0], o[0] + " · " + o[1]]; })), "fun"),
          sel("Raridade", [["", "Todas"], ["b", "Base (bronze)"], ["s", "Elite (prata)"], ["g", "Craque (ouro)"], ["l", "Lenda (verde)"]], "rar"),
          sel("Versão", versoes, "ver"),
          sel("Liga", ligas, "lg"),
          sel("País", [["", "Todos"]].concat(paises), "nat"),
          el("div", { class: "utk-par" }, [num("Nota mín.", "ovMin", "45"), num("Nota máx.", "ovMax", "99")]),
          el("div", { class: "utk-par" }, [num("Lance máx.", "lanceMax", "qualquer"), num("Compre já máx.", "binMax", "qualquer")])
        ]),
        el("button", { class: "btn ghost small utk-limpa", type: "button", on: { click: function () { var o = f.ord; _f = filtrosVazios(); _f.ord = o; _res = null; desenha(); } } }, [ic("x"), el("span", { text: "Limpar filtros" })])
      ]);
      corpo.appendChild(painel);
      var ordem = el("div", { class: "utk-ordem" });
      var btAt = el("button", { class: "utk-atualiza", type: "button", title: "Buscar de novo", "aria-label": "Buscar de novo", on: { click: function () { nova(); toast("Mercado atualizado.", "info"); } } }, [ic("refresh-cw")]);
      corpo.appendChild(el("div", { class: "utk-linha-o" }, [ordem, btAt]));
      var conta = el("div", { class: "utk-conta" });
      corpo.appendChild(conta);
      var lista = el("div", { class: "utk-lista" });
      corpo.appendChild(lista);
      function pintaControles() {
        TM.ui.clear(chips);
        SETORES.forEach(function (o) {
          chips.appendChild(el("button", { class: "ut-chip" + (f.setor === o[0] && !f.fun ? " on" : ""), type: "button", text: o[1], on: { click: function () {
            f.setor = o[0]; f.fun = ""; var sf = painel.querySelector("select"); if (sf) sf.value = ""; nova();
          } } }));
        });
        var n = nFiltros(f);
        nF.textContent = n ? String(n) : ""; nF.hidden = !n;
        btF.classList.toggle("on", _painel || n > 0);
        painel.classList.toggle("on", _painel);
        TM.ui.clear(ordem);
        ordem.appendChild(el("span", { class: "utk-ordem-l", text: "Ordenar" }));
        ORDENS.forEach(function (o) {
          ordem.appendChild(el("button", { class: "utk-ord" + (f.ord === o[0] ? " on" : ""), type: "button", text: o[1], on: { click: function () { f.ord = o[0]; nova(); } } }));
        });
      }
      function nova() { _res = { lista: filtra(s, agora(), f), n: 30 }; pintaControles(); pintaLista(); }
      function pintaLista() {
        TM.ui.clear(lista);
        var L = _res.lista;
        conta.textContent = L.length ? L.length + (L.length > 1 ? " anúncios encontrados" : " anúncio encontrado") : "";
        if (!L.length) {
          lista.appendChild(vazio("Nenhum anúncio com esses filtros.", "Afrouxe os filtros ou volte daqui a pouco: chegam anúncios novos o tempo todo."));
          return;
        }
        L.slice(0, _res.n).forEach(function (x) { var r = linhaLeilao(ctx, x.A, x.d); if (r) lista.appendChild(r); });
        if (L.length > _res.n) lista.appendChild(el("button", { class: "btn ghost wide utk-mais", type: "button", text: "Mostrar mais (" + (L.length - _res.n) + ")", on: { click: function () { _res.n += 30; pintaLista(); } } }));
      }
      if (!_res) nova(); else { pintaControles(); pintaLista(); }
    }

    /* ---- aba Observação ---- */
    function abaObs() {
      var M = s.mkt, now = agora();
      if (M.won.length) {
        corpo.appendChild(secT("Itens ganhos", M.won.length, el("button", { class: "utk-sec-bt", type: "button", on: { click: function () { todosAoClube(s); ctx.topo(); desenha(); } } }, [ic("check"), el("span", { text: "Todos ao clube" })])));
        var g = el("div", { class: "utk-lista" });
        M.won.slice().reverse().forEach(function (w) { var r = linhaGanho(w); if (r) g.appendChild(r); });
        corpo.appendChild(g);
      }
      var lances = [], seguindo = [], fim = [];
      Object.keys(M.obs).forEach(function (id) {
        var o = M.obs[id], E = estadoDe(s, o.a, now), sit = situacao(s, o.a, E, now);
        if (sit === "ganhando" || sit === "superado") lances.push(o);
        else if (sit === "ativo") seguindo.push(o);
        else fim.push(o);
      });
      function porFim(a, b) { return a.a.fim - b.a.fim; }
      lances.sort(porFim); seguindo.sort(porFim); fim.sort(function (a, b) { return b.a.fim - a.a.fim; });
      function bloco(t, arr, extra) {
        if (!arr.length) return;
        corpo.appendChild(secT(t, arr.length, extra));
        var b = el("div", { class: "utk-lista" });
        arr.forEach(function (o) { var r = linhaLeilao(ctx, o.a); if (r) b.appendChild(r); });
        corpo.appendChild(b);
      }
      bloco("Lances ativos", lances);
      bloco("Observando", seguindo);
      bloco("Encerrados", fim, el("button", { class: "utk-sec-bt", type: "button", on: { click: function () { var n = limpaEncerrados(s); if (n) toast(n + (n > 1 ? " anúncios removidos." : " anúncio removido."), "ok"); desenha(); } } }, [ic("trash-2"), el("span", { text: "Limpar" })]));
      if (!M.won.length && !lances.length && !seguindo.length && !fim.length) {
        corpo.appendChild(vazio("Sua lista de observação está vazia.", "Toque na estrela de um anúncio para acompanhar. Quando você dá um lance, ele entra aqui sozinho.",
          el("button", { class: "btn primary", type: "button", on: { click: function () { ctx.ir("buscar"); } } }, [ic("search"), el("span", { text: "Buscar no mercado" })])));
      } else {
        corpo.appendChild(el("p", { class: "utk-rodape", text: nObs(s) + " de " + LIM_OBS + " na lista de observação." }));
      }
    }
    function linhaGanho(w) {
      var d = I.cardData(w.card); if (!d) return null;
      var dup = jaTem(s, w.card.p);
      return el("div", { class: "utk-row s-venci utk-ganho" }, [
        I.cardEl(d, { cls: "tiny" }),
        el("div", { class: "utk-row-i" }, [
          el("div", { class: "utk-row-top" }, [el("div", { class: "utk-row-tx" }, [el("span", { class: "utk-row-n", text: d.name }), el("span", { class: "utk-row-s", text: subDe(d) })]),
            el("span", { class: "utk-st venci", text: w.o === "bin" ? "Comprado" : "Vencido" })]),
          el("div", { class: "utk-row-pago" }, [el("span", { text: "Pago " }), moeda(w.preco), el("span", { class: "utk-eq", text: " · equilíbrio " + fmtC(empate(w.preco)) })]),
          dup ? el("div", { class: "utk-row-dup" }, [ic("triangle-alert"), el("span", { text: "Repetido: no clube, a carta pior vira venda rápida." })]) : null,
          el("div", { class: "utk-row-acts" }, [
            el("button", { class: "ut-buy", type: "button", on: { click: function () { paraClube(s, w); ctx.topo(); desenha(); } } }, [ic("check"), el("span", { text: "Ao clube" })]),
            el("button", { class: "ut-buy ghost", type: "button", on: { click: function () { folhaAnuncio(s, d, { tipo: "ganho", w: w }, function () { ctx.topo(); desenha(); }, ctx); } } }, [ic("tag"), el("span", { text: "Anunciar" })])
          ])
        ])
      ]);
    }

    /* ---- aba Vendas (lista de transferências) ---- */
    function abaVendas() {
      var M = s.mkt;
      var vend = M.sell.filter(function (L) { return L.sold; });
      var exp = M.sell.filter(function (L) { return !L.sold && L.exp; });
      var atv = M.sell.filter(function (L) { return !L.sold && !L.exp; }).sort(function (a, b) { return a.fim - b.fim; });
      if (vend.length) {
        var tot = vend.reduce(function (a, L) { return a + liquido(L.preco || L.bin || 0); }, 0);
        corpo.appendChild(el("div", { class: "utk-receber" }, [
          el("div", { class: "utk-receber-i" }, [
            el("b", { text: vend.length + (vend.length > 1 ? " cartas vendidas" : " carta vendida") }),
            el("span", {}, [el("span", { text: "Você recebe " }), moeda(tot), el("span", { text: " (já sem a taxa de 5%)" })])
          ]),
          el("button", { class: "btn primary utk-receber-bt", type: "button", on: { click: function () {
            var r = recebe(s);
            if (r.n) toast("+" + fmtC(r.moedas) + " moedas de " + r.n + (r.n > 1 ? " vendas." : " venda."), "ok");
            ctx.topo(); desenha();
          } } }, [ic("tm-moeda"), el("span", { text: "Receber" })])
        ]));
      }
      corpo.appendChild(el("button", { class: "utk-novo", type: "button", on: { click: function () { folhaEscolhe(ctx); } } }, [
        el("span", { class: "utk-novo-ic" }, [ic("plus")]),
        el("span", { class: "utk-novo-t" }, [el("b", { text: "Anunciar uma carta do clube" }), el("small", { text: nLista(s) + " de " + LIM_LISTA + " na lista de transferências" })])
      ]));
      if (vend.length) {
        corpo.appendChild(secT("Vendidos", vend.length));
        var bv = el("div", { class: "utk-lista" });
        vend.forEach(function (L) { var r = linhaVendida(L); if (r) bv.appendChild(r); });
        corpo.appendChild(bv);
      }
      if (atv.length) {
        corpo.appendChild(secT("À venda", atv.length));
        var ba = el("div", { class: "utk-lista" });
        atv.forEach(function (L) { var r = linhaAtiva(L); if (r) ba.appendChild(r); });
        corpo.appendChild(ba);
      }
      if (exp.length) {
        corpo.appendChild(secT("Não vendidos", exp.length, el("button", { class: "utk-sec-bt", type: "button", on: { click: function () {
          var n = reanunciaTodos(s); if (n) toast(n + (n > 1 ? " cartas anunciadas de novo." : " carta anunciada de novo."), "ok"); ctx.topo(); desenha();
        } } }, [ic("refresh-cw"), el("span", { text: "Reanunciar todos" })])));
        var be = el("div", { class: "utk-lista" });
        exp.forEach(function (L) { var r = linhaExpirada(L); if (r) be.appendChild(r); });
        corpo.appendChild(be);
      }
      if (!vend.length && !atv.length && !exp.length) corpo.appendChild(vazio("Nada à venda.", "Anuncie cartas com lance inicial, compre já e duração. Os técnicos da IA dão lances e compram com o tempo."));
      if (M.hist.length) {
        corpo.appendChild(secT("Últimas transações"));
        corpo.appendChild(el("div", { class: "utk-hist" }, M.hist.slice(0, 10).map(function (h) {
          var p = TM.data.player(h.p);
          return el("div", { class: "utk-hist-l " + h.k }, [
            el("span", { class: "utk-hist-ic" }, [ic(h.k === "v" ? "arrow-up" : "arrow-down")]),
            el("span", { class: "utk-hist-n", text: (h.k === "v" ? "Venda · " : "Compra · ") + (p ? I.shortNm(p.name) : "Carta") + (h.v && h.v !== "base" ? " (" + I.verInfo(h.v).n + ")" : "") }),
            el("span", { class: "utk-hist-o", text: h.o === "bin" ? "compre já" : "leilão" }),
            moeda(h.preco || 0)
          ]);
        })));
      }
    }
    function cabLinha(d, extra) {
      return el("div", { class: "utk-row-top" }, [el("div", { class: "utk-row-tx" }, [el("span", { class: "utk-row-n", text: d.name }), el("span", { class: "utk-row-s", text: subDe(d) })]), extra || null]);
    }
    function linhaVendida(L) {
      var d = I.cardData(L.card); if (!d) return null;
      return el("div", { class: "utk-row s-vendida" }, [
        I.cardEl(d, { cls: "tiny" }),
        el("div", { class: "utk-row-i" }, [
          cabLinha(d, el("span", { class: "utk-st venci", text: "Vendido" })),
          el("div", { class: "utk-row-pago" }, [el("span", { text: (L.modo === "lance" ? "No leilão por " : "No compre já por ") }), moeda(L.preco || L.bin)]),
          el("div", { class: "utk-row-liq" }, [el("span", { text: "Você recebe " }), moeda(liquido(L.preco || L.bin), "liq")])
        ])
      ]);
    }
    function linhaAtiva(L) {
      var d = I.cardData(L.card); if (!d) return null;
      var lL = el("i"), vL = moeda(L.ini), tTx = el("span"), tempo = el("span", { class: "utk-tempo" }, [ic("clock"), tTx]), nb = el("span", { class: "utk-nb" });
      var btR = el("button", { class: "ut-buy ghost utk-retira", type: "button", on: { click: function () {
        var r = retira(s, L);
        if (r.erro) { toast(r.erro, "alerta"); return; }
        toast(I.shortNm(d.name) + " voltou para o clube.", "ok"); ctx.topo(); desenha();
      } } }, [ic("undo-2"), el("span", { text: "Retirar" })]);
      var row = el("div", { class: "utk-row s-avenda" }, [
        I.cardEl(d, { cls: "tiny" }),
        el("div", { class: "utk-row-i" }, [
          cabLinha(d),
          el("div", { class: "utk-prs" }, [
            el("div", { class: "utk-pr lance" }, [lL, vL]),
            el("div", { class: "utk-pr bin" }, [el("i", { text: "Compre já" }), moeda(L.bin)])
          ]),
          el("div", { class: "utk-row-b" }, [tempo, nb, btR])
        ])
      ]);
      function upd(now, ini) {
        if (!ini && !row.isConnected) return false;
        if (L.sold || L.exp) { tTx.textContent = L.sold ? "Vendido" : "Sem comprador"; tempo.className = "utk-tempo fim"; btR.hidden = true; return; }
        var R = simulaVenda(s, L, now), rest = L.fim - now;
        lL.textContent = R.n ? "Lance atual" : "Lance inicial";
        vL.set(R.n ? R.lance : L.ini);
        nb.textContent = R.n ? R.n + (R.n > 1 ? " lances" : " lance") : "sem lances";
        tTx.textContent = fmtTempo(rest);
        tempo.className = "utk-tempo " + clsTempo(rest);
        btR.hidden = !!R.n;
      }
      upd(agora(), true);
      ctx.vivo(upd);
      return row;
    }
    function linhaExpirada(L) {
      var d = I.cardData(L.card); if (!d) return null;
      return el("div", { class: "utk-row s-expirada" }, [
        I.cardEl(d, { cls: "tiny", on: function () { folhaAnuncio(s, d, { tipo: "relista", L: L }, function () { ctx.topo(); desenha(); }, ctx); } }),
        el("div", { class: "utk-row-i" }, [
          cabLinha(d, el("span", { class: "utk-st encerrado", text: "Sem comprador" })),
          el("div", { class: "utk-row-pago" }, [el("span", { text: "Pedia " }), moeda(L.bin), el("span", { text: " · inicial " + fmtC(L.ini) })]),
          el("div", { class: "utk-row-acts" }, [
            el("button", { class: "ut-buy", type: "button", on: { click: function () { if (reanuncia(s, L)) toast(I.shortNm(d.name) + " anunciado de novo.", "ok"); ctx.topo(); desenha(); } } }, [ic("refresh-cw"), el("span", { text: "Reanunciar" })]),
            el("button", { class: "ut-buy ghost", type: "button", on: { click: function () { folhaAnuncio(s, d, { tipo: "relista", L: L }, function () { ctx.topo(); desenha(); }, ctx); } } }, [ic("pen"), el("span", { text: "Mudar preço" })]),
            el("button", { class: "ut-buy ghost", type: "button", on: { click: function () { var m = devolve(s, L); if (m) toast(m, "ok"); ctx.topo(); desenha(); } } }, [ic("undo-2"), el("span", { text: "Ao clube" })])
          ])
        ])
      ]);
    }

    /* ---- avisos do que aconteceu enquanto o mercado andava ---- */
    function avisa(evs) {
      if (!evs.length) return;
      if (evs.length === 1) {
        var e = evs[0], nm = nomeDe(e.p);
        var t = {
          venci: ["Você venceu o leilão de " + nm + " por " + fmtC(e.v) + "! Está em Itens ganhos.", "ok"],
          superado: ["Seu lance em " + nm + " foi superado. " + fmtC(e.v) + " moedas voltaram.", "alerta"],
          outro: ["Outro técnico comprou " + nm + " no compre já. Seu lance voltou.", "alerta"],
          perdi: ["O leilão de " + nm + " terminou: você perdeu.", "alerta"],
          vendido: [nm + " vendido por " + fmtC(e.v) + "! Receba na aba Vendas.", "ok"],
          expirou: [nm + " não vendeu: está em Não vendidos.", "alerta"],
          erro: ["Não deu para entregar " + nm + ": as moedas voltaram.", "erro"]
        }[e.k];
        if (t) toast(t[0], t[1]);
        return;
      }
      var c = {};
      evs.forEach(function (x) { c[x.k] = (c[x.k] || 0) + 1; });
      var p = [];
      function n(k, um, varios) { if (c[k]) p.push(c[k] + " " + (c[k] > 1 ? varios : um)); }
      n("venci", "leilão vencido", "leilões vencidos");
      n("vendido", "carta vendida", "cartas vendidas");
      n("superado", "lance superado", "lances superados");
      n("outro", "anúncio levado no compre já", "anúncios levados no compre já");
      n("perdi", "leilão perdido", "leilões perdidos");
      n("expirou", "anúncio sem comprador", "anúncios sem comprador");
      toast("Mercado: " + p.join(" · ") + ".", (c.venci || c.vendido) ? "ok" : "alerta");
    }

    /* ---- relógio: o mercado anda a cada segundo com a tela aberta ---- */
    var timer = setInterval(function () {
      if (!screen.isConnected) {
        clearInterval(timer);
        folhas.forEach(function (F) { try { F.fecha(); } catch (e) {} });
        return;
      }
      var now = agora(), evs = [];
      try { evs = avanca(s, now); } catch (e) { try { console.warn("mercado", e); } catch (e2) {} }
      if (evs.length) { avisa(evs); if (_aba !== "buscar") desenha(); }
      vivos = vivos.filter(function (fn) { try { return fn(now) !== false; } catch (e) { return false; } });
      folhas = folhas.filter(function (F) { return F.aberto(); });
      pintaTopo(now);
    }, 1000);

    ctx.avisa = avisa;
    desenha();
    return ctx;
  }

  TM.ui.register("ut-market", function (screen, params) {
    var I = U(), s = I.st();
    if (!s) { I.goUT("ut"); return; }
    if (s.ed && TM.storage && TM.storage.edition && s.ed !== TM.storage.edition()) { I.goUT("ut"); return; }
    prepara(s);
    var evs = avanca(s, agora());
    if (params && params.aba) _aba = params.aba;
    _res = null;                         // entrar na tela = busca nova
    var ctx = montaTela(screen, s);
    if (evs.length) ctx.avisa(evs);
  });

  /* ================= API ================= */
  TM.utMercado = {
    anunciar: anunciar,
    // hub: quantas coisas esperam o técnico no mercado (vendas a receber + cartas ganhas)
    pendentes: function (s) {
      s = s || U().st(); if (!s) return 0;
      try { avanca(s, agora()); return resumo(s).total; } catch (e) { return 0; }
    },
    resumo: function (s) { s = s || U().st(); if (!s) return null; avanca(s, agora()); return resumo(s); },
    avanca: function (s) { s = s || U().st(); if (!s) return []; return avanca(s, agora()); },
    prepara: prepara,
    justo: justo, faixa: faixa, passo: passo, arred: arred,
    abrir: function (aba) { U().goUT("ut-market", { aba: aba || "buscar" }); },
    // para os testes
    _t: {
      lote: lote, mercado: mercado, visitas: visitas, simula: simula, estadoBase: estadoBase, estadoDe: estadoDe, situacao: situacao,
      darLance: darLance, compraJa: compraJa, paraClube: paraClube, todosAoClube: todosAoClube, criaAnuncio: criaAnuncio,
      simulaVenda: simulaVenda, recebe: recebe, reanuncia: reanuncia, devolve: devolve, retira: retira, limpaEncerrados: limpaEncerrados,
      alternaObs: alternaObs, contaCartas: contaCartas, filtra: filtra, tendencia: tendencia, comparaveis: comparaveis,
      acima: acima, abaixo: abaixo, minLance: minLance, maxLance: maxLance, empate: empate, liquido: liquido, dadosAnuncio: dadosAnuncio,
      filtros: function () { return _f; }, setFiltros: function (f) { _f = Object.assign(filtrosVazios(), f || {}); _res = null; }
    }
  };
})(window);
