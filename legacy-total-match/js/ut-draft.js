/* ================= TOTAL ULTIMATE — DRAFT =================
   O Draft do Ultimate, do jeito do Total Match:
     1) entrada: 1 ficha de Draft ou 15.000 moedas;
     2) montagem: formação (1 de 5) → capitão (1 de 5, nota 84 a 91) → cada uma
        das 11 casas (1 de 5 cartas que jogam naquela função) → 3 reservas.
        Nota e química (até 33) aparecem ao vivo e cada opção mostra quanto
        ela muda a química do time;
     3) torneio: 4 jogos mata-mata (Rodada 1, Quartas, Semifinal e Final) contra
        elencos da CPU com a nota alvo subindo; empate vai para os pênaltis e
        quem perde está fora;
     4) prêmio pelas vitórias (0 a 4), entregue no fim (derrota, título ou desistência).
   As cartas do Draft são temporárias: NÃO entram no clube. Tudo fica salvo em
   s.draft — sair e voltar continua do mesmo ponto, com as mesmas ofertas — e o
   recorde em s.draftRec. Rotas: "ut-draft" (entrada) e "ut-draft-run" (o Draft
   em andamento: montagem, chaveamento e fim). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  function I() { return TM.ut._i; }
  function M() { return TM.utModos; }
  function ic(n, cls) { return TM.ic(n, cls); }
  function tx(t) { return document.createTextNode(String(t)); }

  /* ================= regras ================= */
  var CUSTO = 15000;                 // entrada em moedas (ou 1 ficha)
  var N_OP = 5, N_FORM = 5, N_RES = 3;
  // rodadas do mata-mata: nome, nome curto (chave), com artigo, e quanto o rival
  // fica acima/abaixo da nota do Draft (limitado a 70–92)
  var RODADAS = [
    { n: "Rodada 1",         t: "Rodada 1",  c: "Rodada 1", em: "na Rodada 1",  para: "a Rodada 1",          dif: -3 },
    { n: "Quartas de final", t: "Quartas",   c: "Quartas",  em: "nas Quartas",  para: "as Quartas de final", dif: -1 },
    { n: "Semifinal",        t: "Semifinal", c: "Semi",     em: "na Semifinal", para: "a Semifinal",         dif: 1 },
    { n: "Final",            t: "Final",     c: "Final",    em: "na Final",     para: "a Final",             dif: 3 }
  ];
  // prêmio pelo número de vitórias (0 a 4)
  var PREMIOS = [
    { v: 0, n: "Caiu na Rodada 1",  r: { coins: 1500,  packs: ["prata"],    xp: 200 } },
    { v: 1, n: "Caiu nas Quartas",  r: { coins: 3000,  packs: ["ouro"],     xp: 400 } },
    { v: 2, n: "Caiu na Semifinal", r: { coins: 6000,  packs: ["ourorare"], xp: 700 } },
    { v: 3, n: "Vice-campeão",      r: { coins: 12000, packs: ["jumbo"],    xp: 1000 } },
    { v: 4, n: "Campeão",           r: { coins: 25000, packs: ["mega"], pick: { n: 3, lo: 84 }, xp: 1500 } }
  ];
  // reservas: uma de cada setor (a da defesa pode vir goleiro)
  var RESERVAS = [
    { n: "Defesa",     setores: ["GK", "DF", "DF", "DF", "DF"] },
    { n: "Meio-campo", setores: ["MF", "MF", "MF", "MF", "MF"] },
    { n: "Ataque",     setores: ["FW", "FW", "FW", "FW", "FW"] }
  ];
  var ETAPAS = [["formacao", "Formação"], ["capitao", "Capitão"], ["casas", "Titulares"], ["reservas", "Reservas"], ["torneio", "Torneio"]];
  // sorteio das cartas: a maioria 75–83, às vezes 84–89 e, raramente, 90+
  var FAIXAS = [[0.74, 75, 83], [0.96, 84, 89], [1, 90, 99]];
  var CAP_FAIXA = [84, 91];
  var NOME_FUNCAO = {
    GOL: "goleiro", ZAG: "zagueiro", LD: "lateral-direito", LE: "lateral-esquerdo", VOL: "volante",
    MC: "meia central", MEI: "meia-atacante", MD: "meia-direita", ME: "meia-esquerda",
    CA: "centroavante", SA: "segundo atacante", PD: "ponta-direita", PE: "ponta-esquerda"
  };

  /* ================= utilidades ================= */
  function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }
  function vitTx(n) { return plural(n, "vitória", "vitórias"); }
  function recDe(s) {
    if (!s.draftRec) s.draftRec = { nota: 0, titulos: 0, runs: 0 };
    return s.draftRec;
  }
  function forma(d) { return TM.comp.FORMATIONS[d.f] || TM.comp.FORMATIONS["4-3-3"]; }
  function dadosXi(d) { var U = I(); return (d.xi || []).map(function (c) { return c ? U.cardData(c) : null; }); }
  function dadosBanco(d) { var U = I(); return (d.sub || []).map(function (c) { return c ? U.cardData(c) : null; }).filter(Boolean); }
  function notaDe(ds) { return I().notaEquipe(ds.map(function (x) { return x ? x.ov : 0; })); }
  // nota durante a montagem: a mesma conta do notaEquipe, só com quem já foi escolhido
  // (com os 11 dá exatamente o notaEquipe; antes disso mostra o nível das escolhas)
  function notaParcial(ds) {
    var v = ds.filter(Boolean).map(function (x) { return x.ov; });
    if (!v.length) return 0;
    if (v.length >= 11) return notaDe(ds);
    var S = 0, E = 0;
    v.forEach(function (x) { S += x; });
    var med = S / v.length;
    v.forEach(function (x) { if (x > med) E += x - med; });
    return Math.floor((S + E) / v.length + 1e-6);
  }
  function idxEtapa(fase) { for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i][0] === fase) return i; return ETAPAS.length; }
  function edicaoErrada(s) { return !!(s.ed && s.ed !== TM.storage.edition()); }
  function valido(d) { return !!(d && d.v === 1 && d.xi && d.xi.length === 11 && d.sub && d.ofs && d.jogos && RODADAS[d.rodada || 0]); }
  // Draft salvo que não dá para continuar (versão antiga, dado faltando): sai do caminho
  function limpaInvalido(s) { if (s.draft && !valido(s.draft)) { delete s.draft; I().save(); } }
  // carta do Draft a partir de uma oferta ({ p, v }): temporária, nunca vai para o clube
  function cartaDe(o, id) {
    var U = I(), p = o && TM.data.player(o.p);
    if (!p) return null;
    var v = o.v || "base";
    return { i: id, p: p.id, v: v, r: U.rarOf(U.clamp(p.overall + U.verBonus(v), 1, 99)) };
  }
  function dadosDe(o, id) { var c = cartaDe(o, id); return c ? I().cardData(c) : null; }

  /* ================= sorteios ================= */
  // jogadores por função (cada um entra em todas as funções que joga)
  var _porFuncao = null;
  try { TM.storage.onEditionChange(function () { _porFuncao = null; }); } catch (e) {}
  function porFuncao() {
    if (_porFuncao) return _porFuncao;
    var U = I(), m = {};
    U.pool().forEach(function (p) { U.posicoesDe(p).forEach(function (r) { (m[r] = m[r] || []).push(p); }); });
    _porFuncao = m;
    return m;
  }
  function faixa(rnd) {
    var r = rnd();
    for (var i = 0; i < FAIXAS.length; i++) if (r < FAIXAS[i][0]) return [FAIXAS[i][1], FAIXAS[i][2]];
    return [FAIXAS[0][1], FAIXAS[0][2]];
  }
  function sorteiaNa(lista, lo, hi, ex, rnd, filtro) {
    var c = [];
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i];
      if (!p || ex[p.id] || p.overall < lo || p.overall > hi) continue;
      if (filtro && !filtro(p)) continue;
      c.push(p);
    }
    return c.length ? c[Math.floor(rnd() * c.length)] : null;
  }
  // um jogador na faixa de nota; sem ninguém, a faixa abre aos poucos
  function sorteia(lista, fx, ex, rnd, filtro) {
    var tent = [[fx[0], fx[1]], [fx[0] - 3, fx[1] + 3], [fx[0] - 8, 99]];
    for (var t = 0; t < tent.length; t++) {
      var p = sorteiaNa(lista || [], tent[t][0], tent[t][1], ex, rnd, filtro);
      if (p) return p;
    }
    return null;
  }
  function versao(p, rnd, mult) { return I().sorteiaVersao(p, rnd, mult) || (rnd() < 0.6 ? "rare" : "base"); }
  // quem já está no Draft (escolhido ou numa oferta guardada) não aparece de novo
  function excluidos(d) {
    var ex = {};
    (d.xi || []).forEach(function (c) { if (c) ex[c.p] = 1; });
    (d.sub || []).forEach(function (c) { if (c) ex[c.p] = 1; });
    Object.keys(d.ofs || {}).forEach(function (k) { (d.ofs[k] || []).forEach(function (o) { ex[o.p] = 1; }); });
    (d.resOps || []).forEach(function (o) { ex[o.p] = 1; });
    return ex;
  }
  // vínculo com quem já está no time (mesma liga, país ou clube): é o que abre química
  function filtroVinculo(d, rnd) {
    var U = I(), ds = dadosXi(d).filter(Boolean);
    if (!ds.length) return null;
    var a = ds[Math.floor(rnd() * ds.length)], r = rnd();
    if (r < 0.45 && a.lg) { var lg = a.lg; return function (p) { return U.leagueOf(p) === lg; }; }
    if (r < 0.85 && a.nat) { var nat = a.nat; return function (p) { return p.nationId === nat; }; }
    if (a.club) { var cid = a.club.id; return function (p) { return p.clubId === cid; }; }
    return null;
  }

  function ofertasFormacao(d) {
    var U = I(), rnd = U.mulberry(U.hashStr(d.id + ":formacao"));
    return U.shuffle(Object.keys(TM.comp.FORMATIONS), rnd).slice(0, N_FORM);
  }
  // capitão: 5 cartas fortes, cada uma para uma casa de função diferente da formação
  function ofertasCapitao(d) {
    var U = I(), F = forma(d), rnd = U.mulberry(U.hashStr(d.id + ":capitao"));
    var ordem = U.shuffle(F.map(function (x, i) { return i; }), rnd), casas = [], vistas = {};
    ordem.forEach(function (i) { var r = U.slotRole(F[i]); if (casas.length < N_OP && !vistas[r]) { vistas[r] = 1; casas.push(i); } });
    ordem.forEach(function (i) { if (casas.length < N_OP && casas.indexOf(i) < 0) casas.push(i); });
    var ex = {}, out = [];
    casas.forEach(function (i) {
      var role = U.slotRole(F[i]);
      var p = sorteia(porFuncao()[role], CAP_FAIXA, ex, rnd) || sorteia(U.poolByPos()[U.SECTOR[role]], CAP_FAIXA, ex, rnd);
      if (!p) return;
      ex[p.id] = 1;
      var v = U.sorteiaVersao(p, rnd, 2.5);
      if (!v || p.overall + U.verBonus(v) > CAP_FAIXA[1]) v = "rare";
      out.push({ p: p.id, v: v, casa: i });
    });
    return out;
  }
  // 5 cartas que jogam na função da casa; até 2 tentam um vínculo com o time
  function ofertasCasa(d, casa) {
    var U = I(), F = forma(d), role = U.slotRole(F[casa]);
    var rnd = U.mulberry(U.hashStr(d.id + ":casa:" + casa));
    var ex = excluidos(d), lista = porFuncao()[role] || [], out = [], vinc = 0;
    for (var k = 0; k < N_OP; k++) {
      var fx = faixa(rnd), p = null;
      if (vinc < 2 && rnd() < 0.55) {
        var fil = filtroVinculo(d, rnd);
        if (fil) { p = sorteia(lista, fx, ex, rnd, fil); if (p) vinc++; }
      }
      if (!p) p = sorteia(lista, fx, ex, rnd);
      if (!p) p = sorteia(U.poolByPos()[U.SECTOR[role]], fx, ex, rnd);   // função rara: o setor inteiro
      if (!p) p = sorteia(U.pool(), [0, 99], ex, rnd);
      if (!p) break;
      ex[p.id] = 1;
      out.push({ p: p.id, v: versao(p, rnd, 1.6) });
    }
    return out;
  }
  function ofertasReserva(d, k) {
    var U = I(), R = RESERVAS[k] || RESERVAS[0], rnd = U.mulberry(U.hashStr(d.id + ":reserva:" + k));
    var ex = excluidos(d), out = [];
    U.shuffle(R.setores, rnd).forEach(function (sec) {
      var p = sorteia(U.poolByPos()[sec], faixa(rnd), ex, rnd) || sorteia(U.pool(), [0, 99], ex, rnd);
      if (!p) return;
      ex[p.id] = 1;
      out.push({ p: p.id, v: versao(p, rnd, 1.6) });
    });
    return out;
  }
  function proximaCasa(d) {
    for (var i = 0; i < d.xi.length; i++) if (!d.xi[i]) return i;
    return -1;
  }
  // gera (uma vez só) as ofertas da etapa atual e grava: sair e voltar não troca nada
  function garanteOfertas(d) {
    var mudou = false;
    if (d.fase === "formacao" && !(d.fOps && d.fOps.length)) { d.fOps = ofertasFormacao(d); mudou = true; }
    if (d.fase === "capitao" && !(d.capOps && d.capOps.length)) { d.capOps = ofertasCapitao(d); mudou = true; }
    if (d.fase === "casas") {
      if (d.alvo == null || d.alvo < 0 || d.xi[d.alvo]) { d.alvo = proximaCasa(d); mudou = true; }
      if (d.alvo >= 0 && !(d.ofs[d.alvo] && d.ofs[d.alvo].length)) { d.ofs[d.alvo] = ofertasCasa(d, d.alvo); mudou = true; }
    }
    if (d.fase === "reservas" && !(d.resOps && d.resOps.length)) { d.resOps = ofertasReserva(d, d.sub.length); mudou = true; }
    if (mudou) I().save();
  }

  /* ================= estado ================= */
  function novoDraft(ent) {
    var id = "d" + Date.now().toString(36) + Math.floor(Math.random() * 1e8).toString(36);
    var d = {
      v: 1, id: id, ent: ent, ed: TM.storage.edition(), t: Date.now(),
      fase: "formacao", fOps: null, f: null, capOps: null, cap: -1,
      xi: [null, null, null, null, null, null, null, null, null, null, null], sub: [],
      ofs: {}, alvo: -1, resOps: null,
      nota: 0, quim: 0, rodada: 0, vit: 0, jogos: [], emJogo: null, premio: null
    };
    garanteOfertas(d);
    return d;
  }
  // entrada: "ficha" ou "moedas". Devolve true se entrou.
  function entrar(s, modo) {
    var U = I();
    if (!s) return false;
    limpaInvalido(s);
    if (s.draft && s.draft.fase !== "fim") { TM.ui.toast("Você já tem um Draft em andamento.", "alerta"); return false; }
    if (s.draft) arquiva(s);
    if (modo === "ficha") {
      if (!((s.fichas || 0) > 0)) { TM.ui.toast("Você não tem fichas de Draft.", "erro"); return false; }
      s.fichas = (s.fichas || 0) - 1;
    } else {
      if ((s.coins || 0) < CUSTO) { U.faltaMoedas(s, CUSTO); return false; }
      U.pay(s, CUSTO);
    }
    s.draft = novoDraft(modo === "ficha" ? "ficha" : "moedas");
    U.save();
    return true;
  }
  var _popCasa = -1;     // casa que acabou de receber carta (anima uma vez)
  // confirma a opção k da etapa atual
  function confirma(s, d, k) {
    var U = I(), o;
    if (d.fase === "formacao") {
      if (!d.fOps || !d.fOps[k]) return false;
      d.f = d.fOps[k]; d.fase = "capitao"; d.capOps = null;
    } else if (d.fase === "capitao") {
      o = d.capOps && d.capOps[k]; if (!o) return false;
      var cc = cartaDe(o, "dr" + o.casa); if (!cc) return false;
      d.xi[o.casa] = cc; d.cap = o.casa; d.capOps = null; d.fase = "casas"; d.alvo = -1;
      _popCasa = o.casa;
    } else if (d.fase === "casas") {
      o = d.ofs[d.alvo] && d.ofs[d.alvo][k]; if (!o) return false;
      var c = cartaDe(o, "dr" + d.alvo); if (!c) return false;
      d.xi[d.alvo] = c; delete d.ofs[d.alvo]; _popCasa = d.alvo; d.alvo = -1;
      if (proximaCasa(d) < 0) { d.fase = "reservas"; d.ofs = {}; d.resOps = null; }
    } else if (d.fase === "reservas") {
      o = d.resOps && d.resOps[k]; if (!o) return false;
      var r = cartaDe(o, "dr" + (11 + d.sub.length)); if (!r) return false;
      d.sub.push(r); d.resOps = null;
      if (d.sub.length >= N_RES) iniciaTorneio(s, d);
    } else return false;
    garanteOfertas(d);
    U.save();
    return true;
  }
  function iniciaTorneio(s, d) {
    var U = I(), ds = dadosXi(d), ch = U.chemDe(ds, forma(d)), rec = recDe(s);
    d.nota = notaDe(ds); d.quim = ch.team;
    d.fase = "torneio"; d.rodada = 0; d.vit = 0; d.jogos = []; d.emJogo = null;
    d.recNota = d.nota > (rec.nota || 0);
    if (d.recNota) rec.nota = d.nota;
    if (d.quim > (rec.quim || 0)) rec.quim = d.quim;
  }
  function adversario(d, r) {
    var U = I(), R = RODADAS[r] || RODADAS[0];
    var alvo = U.clamp(Math.round((d.nota || 75) + R.dif), 70, 92);
    return M().elencoCPU(U.hashStr("draft:" + d.id + ":" + r), alvo);
  }
  function timeDoDraft(s, d) {
    var U = I(), ds = dadosXi(d), ch = U.chemDe(ds, forma(d));
    return M().timeDe(ds, ch.per, "Draft " + U.nomeExibido(s), U.siglaDe(s), d.f, 0, dadosBanco(d));
  }
  function jogarRodada(s, d) {
    var U = I(), r = d.rodada, R = RODADAS[r];
    if (d.fase !== "torneio" || !R) return;
    var adv = adversario(d, r), time = timeDoDraft(s, d);
    d.emJogo = { r: r, t: Date.now() };      // fechou o app no meio? conta W.O. ao voltar
    U.save();
    M().jogar({
      modo: "draft", titulo: "Draft · " + R.t, adv: adv, time: time, formacao: d.f,
      voltar: "ut-draft-run", mataMata: true,
      onFim: function (res) { return fimJogo(I().st(), res); }
    });
  }
  // fim de cada jogo: anda no chaveamento ou encerra o Draft (com o prêmio)
  function fimJogo(s, res) {
    var U = I(), d = s && s.draft;
    if (!d || d.fase !== "torneio" || !res) return {};
    d.emJogo = null;
    var r = d.rodada, R = RODADAS[r], notas = [], sub = null;
    var venceu = !!res.venceu;
    if (!res.venceu && !res.perdeu) {          // empate sem pênaltis (não deveria acontecer no mata-mata)
      venceu = Math.random() < 0.5;
      notas.push({ ic: "dices", tx: "Empate: a vaga foi decidida no sorteio." });
    }
    var adv = res.adv || {};
    d.jogos.push({
      r: r, gf: res.gf || 0, ga: res.ga || 0, pen: res.penaltis != null, v: venceu, wo: !!res.wo,
      adv: { nome: adv.nome || "Adversário", sigla: adv.sigla || "", cor: adv.cor || "", esc: adv.esc || null, ov: adv.ov || 0 }
    });
    if (venceu) {
      d.vit++;
      if (d.vit >= RODADAS.length) {
        sub = "CAMPEÃO DO DRAFT!";
        notas.push({ ic: "crown", tx: "Campeão do Draft: 4 vitórias em 4 jogos", cls: "bom" });
        notas = notas.concat(encerra(s, d, "campeao"));
      } else {
        d.rodada++;
        sub = "Classificado para " + RODADAS[d.rodada].para + "!";
        notas.push({ ic: "trophy", tx: "Vitória " + d.vit + " de 4 no Draft", cls: "bom" });
        notas.push({ ic: "arrow-right", tx: "Próximo jogo: " + RODADAS[d.rodada].n });
        notas.push({ ic: "gift", tx: "Prêmio garantido até aqui: " + M().recTexto(PREMIOS[d.vit].r) });
      }
    } else {
      sub = (res.wo ? "Derrota por W.O. " : "Eliminado ") + R.em;
      notas.push({ ic: "flag", tx: "Fim do Draft: " + vitTx(d.vit) });
      notas = notas.concat(encerra(s, d, "eliminado"));
    }
    U.save();
    return { notas: notas, sub: sub, botao: "Continuar", voltar: "ut-draft-run" };
  }
  // encerra o Draft: entrega o prêmio pelas vitórias e atualiza o recorde
  function encerra(s, d, motivo) {
    var U = I(), v = U.clamp(d.vit || 0, 0, 4), P = PREMIOS[v];
    var antes = (s.picks || []).length;
    var notas = M().darRecompensa(s, P.r, "Draft · " + (v >= 4 ? "campeão" : vitTx(v)));
    var pick = (s.picks || []).length > antes ? s.picks[s.picks.length - 1].id : null;
    var rec = recDe(s);
    rec.runs = (rec.runs || 0) + 1;
    rec.vit = (rec.vit || 0) + v;
    if (v >= 4) rec.titulos = (rec.titulos || 0) + 1;
    if (v > (rec.melhor || 0)) rec.melhor = v;
    d.fase = "fim"; d.motivo = motivo || "eliminado"; d.emJogo = null; d.ofs = {}; d.resOps = null; d.capOps = null;
    d.premio = { v: v, tx: M().recTexto(P.r), pick: pick, notas: notas.map(function (n) { return { ic: n.ic, tx: n.tx }; }) };
    d.fimT = Date.now();
    U.save();
    return notas;
  }
  // tira o Draft encerrado do caminho e guarda o resumo para a tela de entrada
  function arquiva(s) {
    var d = s.draft;
    if (!d) return;
    if (d.fase === "fim") {
      var cap = d.cap >= 0 && d.xi && d.xi[d.cap] ? { p: d.xi[d.cap].p, v: d.xi[d.cap].v } : null;
      s.draftUlt = { vit: d.vit || 0, nota: d.nota || 0, quim: d.quim || 0, f: d.f, motivo: d.motivo,
                     jogos: d.jogos || [], premio: d.premio ? d.premio.tx : "", t: d.fimT || Date.now(), cap: cap };
    }
    delete s.draft;
    I().save();
  }
  // fechou o app no meio da partida: igual a abandonar (derrota por W.O.)
  function woInterrompido(s, d) {
    if (!d || !d.emJogo) return false;
    if (d.fase !== "torneio") { d.emJogo = null; I().save(); return false; }
    var R = RODADAS[d.rodada] || RODADAS[0];
    fimJogo(s, { venceu: false, perdeu: true, empate: false, gf: 0, ga: 3, wo: true, penaltis: null, adv: adversario(d, d.rodada) });
    TM.ui.toast("A partida " + (d.rodada === 1 ? "das " : "da ") + R.t + " ficou no meio e contou como derrota por W.O. (0 × 3).", "alerta");
    return true;
  }
  function desistir(s, d) {
    var P = PREMIOS[d.vit || 0];
    TM.ui.confirm("Desistir do Draft?", "O Draft acaba agora e você recebe o prêmio de " + vitTx(d.vit || 0) + ": " + M().recTexto(P.r) + ".", "Desistir", function () {
      if (s.draft !== d || d.fase === "fim") return;
      encerra(s, d, "desistiu");
      I().goUT("ut-draft-run");
    }, true);
  }
  // resumo para o bloco do hub: { sub, badge }
  function resumoHub(s) {
    s = s || I().st();
    if (!s) return { sub: "", badge: null };
    var d = valido(s.draft) ? s.draft : null, f = s.fichas || 0;
    if (d && d.fase === "torneio") return { sub: "Próximo: " + RODADAS[d.rodada].n + " · " + vitTx(d.vit), badge: "!" };
    if (d && d.fase !== "fim") return { sub: "Montando o time: " + (d.xi || []).filter(Boolean).length + "/11", badge: "!" };
    return { sub: (f ? plural(f, "ficha", "fichas") + " · " : "") + "1 de 5 por posição · 4 jogos", badge: f ? String(f) : null };
  }

  /* ================= peças visuais ================= */
  function premioChips(r) {
    var U = I(), out = [];
    if (r.coins) out.push(el("span", { class: "utd-chip moeda" }, [ic("tm-moeda"), tx(U.fmtC(r.coins))]));
    (r.packs || []).forEach(function (pid) { var pk = U.packById(pid); out.push(el("span", { class: "utd-chip pacote" }, [ic("package"), tx(pk ? pk.name : "Pacote")])); });
    if (r.pick) out.push(el("span", { class: "utd-chip escolha" }, [ic("user-search"), tx("Escolha " + r.pick.lo + "+")]));
    if (r.xp) out.push(el("span", { class: "utd-chip xp" }, [ic("star"), tx(r.xp + " XP")]));
    return out;
  }
  // tabela de prêmios (0 a 4 vitórias); destaca o garantido até agora
  function tabelaPremios(atual) {
    return el("div", { class: "utd-premios" }, PREMIOS.slice().reverse().map(function (P) {
      return el("div", { class: "utd-pr" + (P.v === 4 ? " topo" : "") + (atual === P.v ? " on" : "") }, [
        el("div", { class: "utd-pr-v" }, [el("b", { text: P.v }), el("span", { text: P.v === 1 ? "vitória" : "vitórias" })]),
        el("div", { class: "utd-pr-i" }, [
          el("div", { class: "utd-pr-n" }, [P.v === 4 ? ic("trophy") : null, tx(P.n)]),
          el("div", { class: "utd-pr-c" }, premioChips(P.r))
        ])
      ]);
    }));
  }
  // chaveamento: as 4 etapas e a taça, com placar de cada jogo
  function chave(d) {
    var etapas = RODADAS.map(function (R, i) {
      var j = (d.jogos || []).filter(function (x) { return x.r === i; })[0];
      var cls = j ? (j.v ? "v" : "d") : (d.fase === "torneio" && i === d.rodada ? "on" : "");
      var placar = j ? (j.wo ? "W.O." : j.gf + " × " + j.ga) : (cls === "on" ? "agora" : "");
      return el("div", { class: "utd-et " + cls }, [
        el("div", { class: "utd-et-b" }, [j ? ic(j.v ? "check" : "x") : tx(i + 1)]),
        el("div", { class: "utd-et-n", text: R.c }),
        el("div", { class: "utd-et-p", text: placar }),
        j && j.pen ? el("div", { class: "utd-et-pen", text: "pênaltis" }) : null
      ]);
    });
    var campeao = (d.vit || 0) >= 4;
    etapas.push(el("div", { class: "utd-et taca" + (campeao ? " v" : "") }, [
      el("div", { class: "utd-et-b" }, [ic("trophy")]),
      el("div", { class: "utd-et-n", text: "Título" }),
      el("div", { class: "utd-et-p", text: campeao ? "campeão" : "" })
    ]));
    var feitos = (d.jogos || []).filter(function (j) { return j.v; }).length;
    var pct = Math.min(100, Math.round(feitos / 4 * 100));
    return el("div", { class: "utd-chave" }, [
      el("div", { class: "utd-chave-l" }, [el("i", { style: "width:" + pct + "%" })])
    ].concat(etapas));
  }
  // campo com as cartas (mini), a casa da vez e a prévia da opção escolhida
  function campoEl(F, ds, ch, o) {
    var U = I();
    o = o || {};
    var pitch = el("div", { class: "ut-pitch utd-campo" }, [
      el("div", { class: "ut-pmark circ" }), el("div", { class: "ut-pmark meio" }), el("div", { class: "ut-pmark area" })
    ]);
    F.forEach(function (slot, i) {
      var dd = ds[i] || null, role = U.slotRole(slot);
      var cls = "ut-slot utd-casa" + (dd ? "" : " vazia") + (i === o.alvo ? " alvo" : "") + (i === o.prev ? " previa" : "") + (!dd && o.onVazia ? " livre" : "");
      var holder = el("div", { class: cls, style: "left:" + slot[1] + "%;top:" + slot[2] + "%" }, [
        U.cardEl(dd, { cls: "mini" + (i === o.pop ? " pop" : "") + (dd && ch && !ch.emPos[i] ? " fora" : ""), chem: dd && ch ? ch.per[i] : null, role: role })
      ]);
      if (dd && ch && !ch.emPos[i]) { var pz = holder.querySelector(".utc-pos"); if (pz) pz.textContent = role; }
      if (dd && i === o.cap) holder.appendChild(el("span", { class: "utd-cap", title: "Capitão", text: "C" }));
      if (i === o.alvo && !dd) holder.appendChild(el("span", { class: "utd-casa-tx", text: "AGORA" }));
      holder.addEventListener("click", function () {
        if (!dd) { if (o.onVazia) o.onVazia(i); return; }
        if (i !== o.prev) ficha(dd);
      });
      pitch.appendChild(holder);
    });
    if (U.separaCampo) U.separaCampo(pitch);     // nada encostando no campo (formações apertadas no celular)
    return pitch;
  }
  function bancoEl(d, prev) {
    var U = I();
    return el("div", { class: "utd-banco" }, [
      el("div", { class: "utd-banco-t", text: "Reservas" }),
      el("div", { class: "utd-banco-l" }, RESERVAS.map(function (R, k) {
        var c = d.sub[k], dd = c ? U.cardData(c) : (prev && prev.k === k ? prev.dd : null);
        var alvo = d.fase === "reservas" && k === d.sub.length;
        return el("div", { class: "utd-banco-c" + (alvo ? " alvo" : "") + (!c && dd ? " previa" : "") }, [
          dd ? U.cardEl(dd, { cls: "tiny", on: c ? function () { ficha(dd); } : null }) : el("div", { class: "utd-banco-v" }, [ic("plus")]),
          el("span", { class: "utd-banco-n", text: R.n })
        ]);
      }))
    ]);
  }
  // ficha de uma carta do Draft (sem venda nem itens: ela não é do clube)
  function ficha(dd) {
    var U = I(), ov = el("div", { class: "ut-sheet" });
    function fecha() { ov.classList.remove("show"); setTimeout(function () { ov.remove(); }, 200); }
    function linha(a, b) { return el("div", { class: "ut-dl" }, [el("i", { text: a }), el("b", { text: b })]); }
    ov.appendChild(el("div", { class: "ut-sheet-in card-detail" }, [
      el("div", { class: "ut-sheet-h" }, [el("span", { text: dd.name }), el("button", { class: "ut-x", "aria-label": "Fechar", on: { click: fecha } }, [ic("x")])]),
      el("div", { class: "ut-detail" }, [
        U.cardEl(dd, { cls: "big" }),
        el("div", { class: "ut-detail-side" }, [
          linha("Clube", dd.club ? dd.club.name : "—"),
          linha("Liga", dd.lg ? U.nomeLiga(dd.lg) : "—"),
          linha("País", dd.nat ? U.nomePais(dd.nat) : "—"),
          linha("Idade", (dd.p.age || "—") + " anos"),
          linha("Posições", (dd.posicoes || []).join(" · ")),
          linha("Versão", U.verInfo(dd.ver).n)
        ])
      ]),
      el("div", { class: "ut-bars" }, U.statsOf(dd).map(function (x) {
        return el("div", { class: "ut-bar" }, [el("i", { text: x.l }), el("div", { class: "ut-bar-t" }, [el("div", { class: "ut-bar-f", style: "width:" + x.v + "%" })]), el("b", { text: x.v })]);
      })),
      el("div", { class: "ut-note", text: "Carta do Draft: vale só para este torneio e não entra no seu clube." })
    ]));
    ov.addEventListener("click", function (e) { if (e.target === ov) fecha(); });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("show"); });
  }
  // desenho pequeno da formação (pontos por setor)
  function miniFormacao(F) {
    return el("div", { class: "utd-fmini" }, F.map(function (slot) {
      return el("i", { class: "s-" + slot[0], style: "left:" + slot[1] + "%;top:" + slot[2] + "%" });
    }));
  }
  function contaSetores(F) {
    var n = { DF: 0, MF: 0, FW: 0 };
    F.forEach(function (sl) { if (n[sl[0]] != null) n[sl[0]]++; });
    return n.DF + " DEF · " + n.MF + " MEI · " + n.FW + " ATA";
  }
  // leque de 3 cartas fortes (enfeite do topo da entrada; muda a cada dia)
  function leque() {
    var U = I(), w = el("div", { class: "utd-leque", "aria-hidden": "true" });
    try {
      var rnd = U.mulberry(U.hashStr("draftleque" + U.today()));
      var fortes = U.pool().filter(function (p) { return p.overall >= 86; });
      var usados = {};
      for (var k = 0; k < 3 && fortes.length; k++) {
        var p = fortes[Math.floor(rnd() * fortes.length)];
        if (usados[p.id]) { k--; if (Object.keys(usados).length >= fortes.length) break; continue; }
        usados[p.id] = 1;
        var dd = U.cardData({ i: "lq" + k, p: p.id, v: "rare", r: U.rarOf(p.overall) });
        if (dd) w.appendChild(el("div", { class: "utd-leque-c c" + k }, [U.cardEl(dd, { cls: "tiny" })]));
      }
    } catch (e) {}
    return w;
  }

  /* ================= tela de entrada ================= */
  TM.ui.register("ut-draft", function (screen) {
    var U = I(), s = U.st();
    if (!s) { U.goUT("ut"); return; }
    if (edicaoErrada(s)) { U.goUT("ut"); return; }
    limpaInvalido(s);
    if (s.draft && woInterrompido(s, s.draft)) { U.goUT("ut-draft-run"); return; }
    if (s.draft && s.draft.fase === "fim") arquiva(s);
    var d = s.draft, rec = recDe(s), fichas = s.fichas || 0;
    screen.classList.add("ut-screen", "utd-screen");
    screen.appendChild(U.utTop("Draft", function () { U.goUT("ut"); }, s));
    var body = el("div", { class: "ut-body utd-body" });
    screen.appendChild(body);

    // topo: nome do modo, explicação curta e o leque de cartas
    body.appendChild(el("div", { class: "utd-hero" }, [
      el("div", { class: "utd-hero-i" }, [
        el("div", { class: "utd-hero-k", text: "ULTIMATE · MATA-MATA" }),
        el("div", { class: "utd-hero-t", text: "Draft" }),
        el("div", { class: "utd-hero-s", text: "Escolha 1 de 5 cartas em cada posição, monte a química e vença 4 jogos seguidos." })
      ]),
      leque()
    ]));

    // recorde
    body.appendChild(el("div", { class: "utd-rec" }, [
      el("div", { class: "utd-rec-b" }, [el("b", { text: rec.nota || "—" }), el("i", { text: "Melhor nota" })]),
      el("div", { class: "utd-rec-b ouro" }, [el("b", { text: rec.titulos || 0 }), el("i", { text: rec.titulos === 1 ? "Título" : "Títulos" })]),
      el("div", { class: "utd-rec-b" }, [el("b", { text: rec.runs || 0 }), el("i", { text: "Drafts" })])
    ]));

    if (d) {
      // Draft em andamento: só dá para continuar (ou desistir lá dentro)
      var et = d.fase === "torneio"
        ? "Próximo jogo: " + RODADAS[d.rodada].n + " · " + vitTx(d.vit) + " · nota " + d.nota
        : d.fase === "formacao" ? "Escolhendo a formação"
        : d.fase === "capitao" ? "Escolhendo o capitão · " + d.f
        : d.fase === "casas" ? "Titulares " + d.xi.filter(Boolean).length + "/11 · " + d.f
        : "Reservas " + d.sub.length + "/3 · " + d.f;
      body.appendChild(el("div", { class: "utd-cont" }, [
        el("div", { class: "utd-cont-k" }, [el("span", { class: "utd-vivo" }), tx("DRAFT EM ANDAMENTO")]),
        el("div", { class: "utd-cont-t", text: et }),
        el("button", { class: "btn primary wide utd-cont-bt", on: { click: function () { U.goUT("ut-draft-run"); } } }, [ic("play"), tx(" Continuar")])
      ]));
    } else {
      body.appendChild(el("div", { class: "ut-sec-t", text: "Entrar no Draft" }));
      body.appendChild(el("div", { class: "utd-ents" }, [
        el("button", { class: "utd-ent ficha" + (fichas > 0 ? "" : " off"), on: { click: function () {
          if (!(fichas > 0)) { TM.ui.toast("Você não tem fichas de Draft. Elas saem de recompensas do Ultimate.", "alerta"); return; }
          TM.ui.confirm("Entrar com 1 ficha?", "Você tem " + plural(fichas, "ficha", "fichas") + " de Draft. Depois de entrar, só sai do Draft no fim do torneio ou desistindo.", "Entrar", function () {
            if (entrar(s, "ficha")) U.goUT("ut-draft-run");
          });
        } } }, [
          el("span", { class: "utd-ent-ic" }, [ic("ticket")]),
          el("span", { class: "utd-ent-n", text: "Usar 1 ficha" }),
          el("span", { class: "utd-ent-s", text: fichas > 0 ? "Você tem " + plural(fichas, "ficha", "fichas") : "Sem fichas no momento" })
        ]),
        el("button", { class: "utd-ent moedas", on: { click: function () {
          if ((s.coins || 0) < CUSTO) { U.faltaMoedas(s, CUSTO); return; }
          TM.ui.confirm("Entrar por " + U.fmtC(CUSTO) + " moedas?", "Você tem " + U.fmtC(s.coins || 0) + " moedas. Depois de entrar, só sai do Draft no fim do torneio ou desistindo.", "Entrar", function () {
            if (entrar(s, "moedas")) U.goUT("ut-draft-run");
          });
        } } }, [
          el("span", { class: "utd-ent-ic" }, [ic("tm-moeda")]),
          el("span", { class: "utd-ent-n", text: U.fmtC(CUSTO) + " moedas" }),
          el("span", { class: "utd-ent-s", text: "Saldo: " + U.fmtC(s.coins || 0) })
        ])
      ]));
    }

    // como funciona
    body.appendChild(el("div", { class: "ut-sec-t", text: "Como funciona" }));
    body.appendChild(el("div", { class: "utd-passos" }, [
      ["layers", "Formação", "Escolha 1 de 5 esquemas sorteados."],
      ["crown", "Capitão", "Um craque de 84 a 91 para começar."],
      ["users", "Elenco", "1 de 5 cartas por casa: 11 titulares e 3 reservas."],
      ["trophy", "Mata-mata", "4 jogos. Empate vai para os pênaltis; perdeu, acabou."]
    ].map(function (p, i) {
      return el("div", { class: "utd-passo" }, [
        el("span", { class: "utd-passo-ic" }, [ic(p[0])]),
        el("div", { class: "utd-passo-i" }, [el("b", { text: (i + 1) + ". " + p[1] }), el("span", { text: p[2] })])
      ]);
    })));
    body.appendChild(el("div", { class: "utd-nota" }, [ic("info"), tx(" A química conta: vínculos de clube, liga e país dão embalo em campo. As cartas do Draft são só do torneio e não entram no seu clube.")]));

    // prêmios
    body.appendChild(el("div", { class: "ut-sec-t", text: "Prêmios por vitórias" }));
    body.appendChild(tabelaPremios(d && d.fase === "torneio" ? d.vit : -1));

    // último Draft
    var ult = s.draftUlt;
    if (ult) {
      var campeao = ult.vit >= 4;
      body.appendChild(el("div", { class: "ut-sec-t", text: "Último Draft" }));
      body.appendChild(el("div", { class: "utd-ult" + (campeao ? " campeao" : "") }, [
        el("div", { class: "utd-ult-ic" }, [ic(campeao ? "trophy" : ult.motivo === "desistiu" ? "flag" : "medal")]),
        el("div", { class: "utd-ult-i" }, [
          el("b", { text: campeao ? "Campeão" : ult.motivo === "desistiu" ? "Desistiu com " + vitTx(ult.vit) : PREMIOS[U.clamp(ult.vit, 0, 4)].n }),
          el("span", { text: (ult.nota ? "Nota " + ult.nota + " · química " + ult.quim + "/33 · " : "") + (ult.f || "") }),
          el("div", { class: "utd-ult-j" }, (ult.jogos || []).map(function (j) {
            return el("span", { class: j.v ? "v" : "d", text: (RODADAS[j.r] ? RODADAS[j.r].c : "") + " " + (j.wo ? "W.O." : j.gf + "×" + j.ga) });
          }))
        ])
      ]));
    }
  });

  /* ================= Draft em andamento ================= */
  TM.ui.register("ut-draft-run", function (screen) {
    var U = I(), s = U.st();
    if (!s) { U.goUT("ut"); return; }
    if (edicaoErrada(s)) { U.goUT("ut"); return; }
    limpaInvalido(s);
    var d = s.draft;
    if (!d) { U.goUT("ut-draft"); return; }
    woInterrompido(s, d);
    screen.classList.add("ut-screen", "utd-screen");
    screen.appendChild(U.utTop("Draft", function () { U.goUT("ut-draft"); }, s));
    var body = el("div", { class: "ut-body utd-body largo" });
    screen.appendChild(body);
    if (d.fase === "torneio") torneio(body, s, d);
    else if (d.fase === "fim") telaFim(body, s, d);
    else montagem(body, s, d);
  });

  /* ---------- montagem: formação, capitão, titulares e reservas ---------- */
  function montagem(body, s, d) {
    var U = I(), sel = -1;
    garanteOfertas(d);
    var raiz = el("div", { class: "utd-mont" });
    body.appendChild(raiz);
    desenha(false);

    // opções da etapa atual, já com a prévia de química de cada uma
    function opcoes(ds, F, ch) {
      if (d.fase === "formacao") return (d.fOps || []).map(function (f) { return { f: f }; });
      var lista = d.fase === "capitao" ? (d.capOps || []) : d.fase === "casas" ? (d.ofs[d.alvo] || []) : (d.resOps || []);
      return lista.map(function (o, k) {
        var dd = dadosDe(o, "op" + k);
        if (!dd) return null;
        var x = { o: o, dd: dd, k: k };
        if (d.fase === "reservas") { x.res = d.sub.length; return x; }
        x.casa = d.fase === "capitao" ? o.casa : d.alvo;
        var ds2 = ds.slice(); ds2[x.casa] = dd;
        var ch2 = U.chemDe(ds2, F);
        x.ds = ds2; x.ch = ch2; x.quim = ch2.team; x.delta = ch2.team - ch.team; x.per = ch2.per[x.casa]; x.nota = notaParcial(ds2);
        x.emPos = ch2.emPos[x.casa];
        return x;
      });
    }

    function desenha(topo) {
      var rol = raiz.querySelector(".utd-ops"), sx = rol ? rol.scrollLeft : 0, sy = window.pageYOffset || 0;
      TM.ui.clear(raiz);
      var F = d.f ? forma(d) : null;
      var ds = F ? dadosXi(d) : [];
      var ch = F ? U.chemDe(ds, F) : null;
      var ops = opcoes(ds, F, ch);
      var op = sel >= 0 ? ops[sel] : null;
      var nota = F ? notaParcial(ds) : 0;

      /* ---- etapas + nota e química ao vivo ---- */
      var ie = idxEtapa(d.fase), nTit = d.xi.filter(Boolean).length;
      raiz.appendChild(el("div", { class: "utd-topo" }, [
        el("div", { class: "utd-etapas" }, ETAPAS.map(function (e, i) {
          var cont = e[0] === "casas" ? nTit + "/11" : e[0] === "reservas" ? d.sub.length + "/3" : e[0] === "formacao" && d.f ? d.f : "";
          return el("div", { class: "utd-etapa" + (i < ie ? " feito" : i === ie ? " on" : "") }, [
            el("span", { class: "utd-etapa-b" }, [i < ie ? ic("check") : tx(i + 1)]),
            el("span", { class: "utd-etapa-n", text: e[1] }),
            el("span", { class: "utd-etapa-c", text: cont })
          ]);
        })),
        el("div", { class: "utd-nums" }, [
          numBox("NOTA", nota || "—", op && op.nota != null && op.nota !== nota ? op.nota : null),
          numBox("QUÍMICA", (ch ? ch.team : 0) + "/33", op && op.quim != null && ch && op.quim !== ch.team ? op.quim : null, "quim"),
          numBox("FORMAÇÃO", d.f || (op && op.f) || "—", null, "form")
        ])
      ]));

      /* ---- a escolha ---- */
      var esc = el("div", { class: "utd-esc" });
      raiz.appendChild(esc);
      var role = d.fase === "casas" && F && d.alvo >= 0 ? U.slotRole(F[d.alvo]) : null;
      var cab = d.fase === "formacao" ? ["PASSO 1 DE 5", "Escolha a formação", "5 esquemas sorteados. A formação define as 11 casas do campo."]
        : d.fase === "capitao" ? ["PASSO 2 DE 5", "Escolha o capitão", "Cartas de 84 a 91. Ele entra na casa da posição dele."]
        : d.fase === "casas" ? ["TITULAR " + (nTit + 1) + " DE 11 · " + role, "Escolha o " + (NOME_FUNCAO[role] || role), "Cada opção mostra quanto muda a química. Toque em outra casa vazia do campo para escolher outra posição."]
        : ["RESERVA " + (d.sub.length + 1) + " DE 3", "Reserva: " + (RESERVAS[d.sub.length] || RESERVAS[0]).n, "Reserva não soma química: entra se alguém se machucar ou for expulso."];
      esc.appendChild(el("div", { class: "utd-esc-h" }, [
        el("div", { class: "utd-esc-k", text: cab[0] }),
        el("div", { class: "utd-esc-t", text: cab[1] }),
        el("div", { class: "utd-esc-s", text: cab[2] })
      ]));

      if (d.fase === "formacao") {
        esc.appendChild(el("div", { class: "utd-forms" }, ops.map(function (x, k) {
          var Fk = TM.comp.FORMATIONS[x.f] || [];
          return el("button", { class: "utd-form" + (sel === k ? " sel" : ""), on: { click: function () { escolhe(k); } } }, [
            miniFormacao(Fk), el("b", { text: x.f }), el("span", { text: contaSetores(Fk) })
          ]);
        })));
      } else {
        var row = el("div", { class: "utd-ops" });
        ops.forEach(function (x, k) {
          if (!x) return;
          var chips = [];
          if (d.fase === "reservas") chips.push(el("span", { class: "utd-q res", text: (x.dd.posicoes || [x.dd.pos2]).join(" · ") }));
          else if (d.fase === "capitao") chips.push(el("span", { class: "utd-q cap" }, [ic("crown"), tx(" Joga de " + U.slotRole(F[x.casa]))]));
          else {
            chips.push(!x.emPos ? el("span", { class: "utd-q fora", text: "fora de posição" })
              : el("span", { class: "utd-q" + (x.delta > 0 ? " mais" : " zero"), text: "+" + x.delta + " química" }));
            // a carta mostra a posição principal; se ele entra pela alternativa, avisa
            if (x.emPos && x.dd.pos2 !== role) chips.push(el("span", { class: "utd-q alt", text: "joga de " + role }));
          }
          row.appendChild(el("div", { class: "utd-op" + (sel === k ? " sel" : ""), role: "button", tabindex: "0", "aria-pressed": sel === k ? "true" : "false",
            on: { click: function () { escolhe(k); }, keydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolhe(k); } } } }, [
            el("span", { class: "utd-op-ok" }, [ic("check")]),
            U.cardEl(x.dd, { cls: "big", chem: d.fase === "casas" ? x.per : null }),
            el("div", { class: "utd-op-chips" }, chips),
            el("span", { class: "utd-op-nm", text: x.dd.name }),
            el("span", { class: "utd-op-cl", text: x.dd.club ? x.dd.club.name : "" })
          ]));
        });
        esc.appendChild(row);
        if (!topo && sx) row.scrollLeft = sx;      // trocar a seleção não perde a rolagem das cartas
      }
      var rotulo = !op ? "Toque numa opção"
        : d.fase === "formacao" ? "Usar " + op.f
        : d.fase === "capitao" ? "Capitão: " + U.shortNm(op.dd.name)
        : d.fase === "reservas" ? "Levar " + U.shortNm(op.dd.name) + " para o banco"
        : "Escolher " + U.shortNm(op.dd.name);
      esc.appendChild(el("button", { class: "btn wide utd-confirma" + (op ? " primary" : " off"), on: { click: confirmar } }, [ic(op ? "check" : "hand"), tx(" " + rotulo)]));

      /* ---- campo, banco e vínculos ---- */
      var lado = el("div", { class: "utd-lado" });
      raiz.appendChild(lado);
      if (d.fase === "formacao") {
        if (op) {
          lado.appendChild(el("div", { class: "utd-lado-t", text: "Prévia · " + op.f }));
          var Fp = TM.comp.FORMATIONS[op.f];
          lado.appendChild(campoEl(Fp, Fp.map(function () { return null; }), null, {}));
        } else {
          lado.appendChild(el("div", { class: "utd-vazio" }, [ic("layers"), el("span", { text: "Toque numa formação para ver as casas no campo." })]));
        }
      } else {
        var pv = op && op.ds ? op : null;
        lado.appendChild(el("div", { class: "utd-lado-t", text: pv ? "Prévia com " + U.shortNm(op.dd.name) : "Seu time do Draft" }));
        lado.appendChild(campoEl(F, pv ? pv.ds : ds, pv ? pv.ch : ch, {
          alvo: d.fase === "casas" ? d.alvo : -1, prev: pv ? pv.casa : -1, cap: d.cap, pop: _popCasa,
          onVazia: d.fase === "casas" ? trocaCasa : null
        }));
        _popCasa = -1;
        if (d.fase === "casas" || d.fase === "reservas") lado.appendChild(bancoEl(d, op && d.fase === "reservas" ? { k: d.sub.length, dd: op.dd } : null));
        if (nTit) lado.appendChild(U.painelVinculos(pv ? pv.ch : ch));
      }
      lado.appendChild(el("button", { class: "btn ghost small utd-desistir", on: { click: function () { desistir(s, d); } } }, [ic("flag"), tx(" Desistir do Draft")]));

      if (topo) { try { window.scrollTo(0, 0); } catch (e) {} }
      else if (sy) { try { window.scrollTo(0, sy); } catch (e) {} }
    }
    function numBox(rot, val, novo, cls) {
      return el("div", { class: "utd-num" + (cls ? " " + cls : "") }, [
        el("i", { text: rot }),
        el("b", {}, [tx(val), novo != null ? el("span", { class: "utd-num-novo", text: " → " + novo }) : null])
      ]);
    }
    function escolhe(k) {
      if (sel === k) { confirmar(); return; }      // tocar de novo na escolhida confirma
      sel = k; desenha(false);
    }
    function confirmar() {
      if (sel < 0) { TM.ui.toast("Toque numa das opções primeiro.", "alerta"); return; }
      var k = sel; sel = -1;
      if (!confirma(s, d, k)) { desenha(false); return; }
      if (d.fase === "torneio") {
        TM.ui.toast("Time pronto! Nota " + d.nota + " · química " + d.quim + "/33" + (d.recNota ? " · novo recorde de nota" : ""), "ok");
        I().goUT("ut-draft-run");
        return;
      }
      desenha(true);
    }
    function trocaCasa(i) {
      if (d.fase !== "casas" || d.xi[i] || i === d.alvo) return;
      d.alvo = i; sel = -1;
      garanteOfertas(d);
      desenha(true);
    }
  }

  /* ---------- torneio: chaveamento e próximo jogo ---------- */
  function cabecaTime(s, d, ch) {
    var U = I();
    return el("div", { class: "utd-time" }, [
      U.escudoDe(s),
      el("div", { class: "utd-time-i" }, [
        el("div", { class: "utd-time-k", text: "SEU TIME DO DRAFT" }),
        el("div", { class: "utd-time-n", text: "Draft " + U.nomeExibido(s) }),
        el("div", { class: "utd-time-s", text: d.f + " · " + vitTx(d.vit || 0) })
      ]),
      el("div", { class: "utd-time-nums" }, [
        el("div", { class: "utd-num" }, [el("i", { text: "NOTA" }), el("b", { text: d.nota || "—" })]),
        el("div", { class: "utd-num quim" }, [el("i", { text: "QUÍMICA" }), el("b", { text: (ch ? ch.team : d.quim) + "/33" })])
      ])
    ]);
  }
  function torneio(body, s, d) {
    var U = I(), F = forma(d), ds = dadosXi(d), ch = U.chemDe(ds, F);
    var r = d.rodada, R = RODADAS[r], adv = adversario(d, r);
    body.appendChild(cabecaTime(s, d, ch));
    var cols = el("div", { class: "utd-cols" });
    var a = el("div", { class: "utd-col-a" }), b = el("div", { class: "utd-col-b" });
    cols.appendChild(a); cols.appendChild(b);
    body.appendChild(cols);

    a.appendChild(el("div", { class: "ut-sec-t", text: "Chaveamento" }));
    a.appendChild(chave(d));
    a.appendChild(el("div", { class: "ut-sec-t", text: "Próximo jogo · " + R.n }));
    a.appendChild(M().cartaoAdv(adv, {
      cls: "utd-adv",
      sub: "de " + adv.tag + " · " + M().temaTexto(adv),
      rodape: el("button", { class: "btn primary wide utd-jogar", on: { click: function () { jogarRodada(s, d); } } }, [ic("play"), tx(" Jogar " + R.n)])
    }));
    a.appendChild(el("div", { class: "utd-nota" }, [ic("info"), tx(" Mata-mata: empate vai para os pênaltis; perdeu, acabou. Sair no meio da partida conta como derrota por W.O.")]));
    a.appendChild(el("div", { class: "ut-sec-t", text: "Prêmios · garantido agora: " + vitTx(d.vit) }));
    a.appendChild(tabelaPremios(d.vit));

    b.appendChild(el("div", { class: "ut-sec-t", text: "Seu time" }));
    b.appendChild(campoEl(F, ds, ch, { cap: d.cap }));
    b.appendChild(bancoEl(d, null));
    b.appendChild(U.painelVinculos(ch));
    b.appendChild(el("button", { class: "btn ghost small utd-desistir", on: { click: function () { desistir(s, d); } } }, [ic("flag"), tx(" Desistir e receber o prêmio de " + vitTx(d.vit))]));
  }

  /* ---------- fim: resultado, prêmio e recorde ---------- */
  function telaFim(body, s, d) {
    var U = I(), F = forma(d), ds = dadosXi(d), ch = U.chemDe(ds, F), rec = recDe(s);
    var jogos = d.jogos || [], campeao = (d.vit || 0) >= 4, ult = jogos[jogos.length - 1];
    var R = ult && RODADAS[ult.r];
    var linha2 = campeao ? "4 vitórias em 4 jogos · nota " + d.nota
      : d.motivo === "desistiu" ? "Você desistiu com " + vitTx(d.vit)
      : (R ? "Caiu " + R.em : "Fim do Draft") + " · " + vitTx(d.vit);
    body.appendChild(el("div", { class: "utd-fim" + (campeao ? " campeao" : "") }, [
      el("div", { class: "utd-fim-ic" }, [ic(campeao ? "trophy" : d.motivo === "desistiu" ? "flag" : "medal")]),
      el("div", { class: "utd-fim-k", text: "TOTAL DRAFT" }),
      el("div", { class: "utd-fim-t", text: campeao ? "Campeão do Draft" : "Fim do Draft" }),
      el("div", { class: "utd-fim-s", text: linha2 })
    ]));
    body.appendChild(chave(d));
    if (d.premio) {
      body.appendChild(el("div", { class: "ut-sec-t", text: "Prêmio recebido" }));
      body.appendChild(el("div", { class: "utd-recebido" }, (d.premio.notas || []).map(function (n) {
        return el("div", { class: "utd-rb" }, [el("span", { class: "utd-rb-ic" }, [ic(n.ic || "gift")]), el("span", { text: n.tx })]);
      })));
    }
    var notasRec = [];
    if (d.recNota) notasRec.push("Novo recorde de nota: " + d.nota);
    notasRec.push("Recorde: melhor nota " + (rec.nota || "—") + " · " + plural(rec.titulos || 0, "título", "títulos") + " · " + plural(rec.runs || 0, "Draft", "Drafts"));
    body.appendChild(el("div", { class: "utd-nota" }, [ic("chart-column"), tx(" " + notasRec.join(" · "))]));
    var acoes = el("div", { class: "utd-acoes" });
    var temPick = d.premio && d.premio.pick && (s.picks || []).some(function (p) { return p.id === d.premio.pick; });
    if (temPick) acoes.appendChild(el("button", { class: "btn primary wide", on: { click: function () { var id = d.premio.pick; arquiva(s); U.goUT("ut-escolha", { id: id }); } } }, [ic("user-search"), tx(" Escolher meu jogador 84+")]));
    acoes.appendChild(el("button", { class: "btn " + (temPick ? "" : "primary ") + "wide", on: { click: function () { arquiva(s); U.goUT("ut-draft"); } } }, [ic("refresh-cw"), tx(" Novo Draft")]));
    acoes.appendChild(el("button", { class: "btn wide", on: { click: function () { arquiva(s); U.goUT("ut-store"); } } }, [ic("package"), tx(" Ver pacotes na Loja")]));
    acoes.appendChild(el("button", { class: "btn ghost wide", on: { click: function () { arquiva(s); U.goUT("ut"); } } }, [tx("Voltar ao Ultimate")]));
    body.appendChild(acoes);
    if (d.f && ds.some(Boolean)) {          // desistiu antes de ter time: não há o que mostrar
      body.appendChild(el("div", { class: "ut-sec-t", text: "Seu time do Draft · " + d.f }));
      body.appendChild(campoEl(F, ds, ch, { cap: d.cap }));
      if ((d.sub || []).length) body.appendChild(bancoEl(d, null));
    }
  }

  /* ================= API ================= */
  TM.utDraft = {
    CUSTO: CUSTO, PREMIOS: PREMIOS, RODADAS: RODADAS,
    abrir: function () { I().goUT("ut-draft"); },
    entrar: entrar,
    ativo: function (s) { s = s || I().st(); return !!(s && valido(s.draft) && s.draft.fase !== "fim"); },
    recorde: function (s) { s = s || I().st(); return s ? recDe(s) : null; },
    resumo: resumoHub,
    premio: function (v) { return PREMIOS[I().clamp(v || 0, 0, 4)]; },
    // usados pelos testes
    _t: { ofertasFormacao: ofertasFormacao, ofertasCapitao: ofertasCapitao, ofertasCasa: ofertasCasa, ofertasReserva: ofertasReserva,
          garanteOfertas: garanteOfertas, confirma: confirma, fimJogo: fimJogo, encerra: encerra, arquiva: arquiva,
          adversario: adversario, timeDoDraft: timeDoDraft, porFuncao: porFuncao }
  };
})(window);
